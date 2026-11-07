'use strict';
// Emulator updates: checks the emulator's official GitHub releases, downloads the Windows build, checks it against the
// SHA-256 GitHub publishes, then replaces the program files in place. Files that get replaced are backed up first (with a
// list of the files that were added), so Roll back puts the previous version back. Settings and saves in the folder stay.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');

// Only these emulators update, and only from these repositories. stable: the emulator marks real releases, and its
// GitHub pre-releases are daily test builds.
const SOURCES = {
  kytyps5: { repo: 'KytyPS5/KytyPS5', asset: /-Windows-x64\.zip$/i, exe: ['kyty_emulator.exe'] },
  shadps4: { repo: 'shadps4-emu/shadPS4', asset: /^shadps4-win64-.*\.zip$/i, exe: ['shadPS4.exe', 'shadps4.exe'], stable: true }
};
const API = process.env.EF_GH_API || 'https://api.github.com'; // EF_GH_API: test feed (dev aid)
const SOURCE_FILE = 'ECHOFORGE_SOURCE.txt';
const KEEP_BACKUPS = 2;
const TESTED_HOURS = 48; // Tested, for emulators without stable releases: builds out at least this long
const backupRoot = () => path.join(process.env.EF_EMU_BACKUPS || path.join(process.env.LOCALAPPDATA || os.homedir(), 'EchoForge', 'emulator-backups'));
const sevenZip = () => ['C:\\Program Files\\7-Zip\\7z.exe', 'C:\\Program Files (x86)\\7-Zip\\7z.exe'].find(p => fs.existsSync(p)) || null;

const hashOf = f => new Promise((ok, bad) => { const h = crypto.createHash('sha256'); fs.createReadStream(f).on('data', d => h.update(d)).on('error', bad).on('end', () => ok(h.digest('hex'))); });
async function walk(dir, base = dir) {
  const out = [];
  for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p, base)); else if (e.isFile()) out.push(path.relative(base, p));
  }
  return out;
}
const exists = p => fsp.access(p).then(() => true, () => false);
// "KytyPS5-2026-11-07-589bd14" -> "2026-11-07 · 589bd14", "v.0.21.0" -> "0.21.0"
const label = tag => !tag ? '' : (tag.match(/(\d{4}-\d{2}-\d{2})-([0-9a-f]{7,})$/i) || []).slice(1).join(' · ') || tag.replace(/^v\.?/i, '');

// The emulator's own folder, never a drive root or a shared folder like Desktop. The exe must exist at a full path.
function folderOf(exe) {
  if (!exe || !path.isAbsolute(exe) || !/^[a-z]:[\\/]|^\\\\/i.test(exe) || !fs.existsSync(exe)) return null;
  const dir = path.dirname(exe), low = path.resolve(dir).toLowerCase();
  if (low === path.parse(low).root || low === os.homedir().toLowerCase()) return null;
  return ['desktop', 'downloads', 'documents', 'onedrive', 'programs', 'program files', 'program files (x86)', 'users', 'windows', 'temp'].includes(path.basename(low)) ? null : dir;
}

// ECHOFORGE_SOURCE.txt holds the download or release URL, then the version, then the date.
async function installed(dir) {
  try {
    const lines = (await fsp.readFile(path.join(dir, SOURCE_FILE), 'utf8')).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const fromUrl = (lines[0] || '').match(/\/releases\/(?:tag|download)\/([^/]+)/);
    return (fromUrl && decodeURIComponent(fromUrl[1])) || (lines[1] && !/^\d{4}-\d{2}-\d{2}T/.test(lines[1]) ? lines[1] : '');
  } catch { return ''; }
}

async function gh(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'EchoForge', Accept: 'application/vnd.github+json' } });
  if (res.status === 403 || res.status === 429) throw new Error('GitHub is limiting requests right now. Try again in an hour.');
  if (!res.ok) throw new Error(`GitHub answered ${res.status}.`);
  return res.json();
}

// Every release with a Windows build that has a published checksum, newest first.
async function builds(src) {
  const list = await gh(`${API}/repos/${src.repo}/releases?per_page=30`);
  list.sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || ''))); // GitHub's order isn't always newest first
  const out = [];
  for (const r of list) {
    if (r.draft) continue;
    const a = (r.assets || []).find(x => src.asset.test(x.name));
    if (!a || !/^sha256:[0-9a-f]{64}$/i.test(a.digest || '')) continue;
    out.push({ tag: r.tag_name, label: label(r.tag_name), date: r.published_at, pre: !!r.prerelease, page: r.html_url, url: a.browser_download_url, name: a.name, size: a.size, sha256: a.digest.slice(7).toLowerCase() });
  }
  return out;
}
// The build a choice points at. Latest: the newest build. Tested: the newest stable release where the emulator marks
// them, otherwise the newest build that has been out for two days (fixes for a broken build usually follow within hours).
function pick(all, src, channel) {
  if (channel === 'latest') return all[0] || null;
  if (src.stable) return all.find(b => !b.pre) || null;
  const cutoff = Date.now() - TESTED_HOURS * 3600e3;
  return all.find(b => Date.parse(b.date) <= cutoff) || null;
}
// A build counts as an update only if it's newer than the one installed: switching to Tested never downgrades.
const isNewer = (all, target, current) => { if (!target || target.tag === current) return false; const c = all.findIndex(b => b.tag === current); return c < 0 || all.indexOf(target) < c; };

const backupsFor = async id => (await fsp.readdir(path.join(backupRoot(), id)).catch(() => [])).sort();
async function lastBackup(id) {
  const all = await backupsFor(id); if (!all.length) return null;
  const dir = path.join(backupRoot(), id, all[all.length - 1]);
  try { return { dir, ...JSON.parse(await fsp.readFile(path.join(dir, 'backup.json'), 'utf8')) }; } catch { return null; }
}

// channel: 'tested', 'latest' or 'keep' (no updates; the newest build is still shown).
async function check(id, exe, channel = 'latest') {
  const src = SOURCES[id]; if (!src) return { ok: false, error: 'EchoForge can’t update this emulator.' };
  const dir = folderOf(exe); if (!dir) return { ok: false, error: 'Move the emulator into its own folder first.' };
  const current = await installed(dir), back = await lastBackup(id);
  const rollback = back && back.to === current ? { label: label(back.from) || 'the earlier version' } : null;
  try {
    const all = await builds(src), target = pick(all, src, channel === 'keep' ? 'latest' : channel);
    const c = all.findIndex(b => b.tag === current), ahead = c >= 0 && !!target && c < all.indexOf(target);
    return { ok: true, channel, current, currentLabel: label(current), latest: target, update: channel !== 'keep' && isNewer(all, target, current), kept: channel === 'keep', ahead, rollback };
  } catch (e) { return { ok: false, error: e.message, current, currentLabel: label(current), rollback }; }
}

// Running program files can't be replaced: refuse while any exe from the new build is running from this folder.
function runningIn(dir, exes) {
  return new Promise(ok => execFile('powershell', ['-NoProfile', '-Command', `Get-Process | Where-Object { $_.Path } | ForEach-Object { $_.Path }`], { windowsHide: true }, (err, out) => {
    if (err) return ok(false);
    const here = path.resolve(dir).toLowerCase() + path.sep;
    ok(out.split(/\r?\n/).some(p => p.trim().toLowerCase().startsWith(here) && exes.includes(path.basename(p.trim()).toLowerCase())));
  }));
}

async function download(rel, file, progress) {
  const res = await fetch(rel.url, { headers: { 'User-Agent': 'EchoForge' } });
  if (!res.ok || !res.body) throw new Error(`The download failed (${res.status}).`);
  const h = crypto.createHash('sha256'), out = fs.createWriteStream(file); let got = 0;
  for await (const chunk of res.body) {
    h.update(chunk); got += chunk.length; progress(got / (rel.size || got) * 80, 'Downloading');
    if (!out.write(chunk)) await new Promise(r => out.once('drain', r));
  }
  await new Promise((ok, bad) => out.end(err => (err ? bad(err) : ok())));
  if (h.digest('hex') !== rel.sha256) throw new Error('The download doesn’t match the checksum GitHub published, so nothing was changed.');
}

const unpack = (arc, dest) => new Promise((ok, bad) => {
  const z = sevenZip(); if (!z) return bad(new Error('7-Zip is needed to unpack emulator updates.'));
  const p = spawn(z, ['x', arc, '-o' + dest, '-y', '-bso0', '-bsp0'], { windowsHide: true });
  p.on('error', bad); p.on('close', c => (c ? bad(new Error('The update couldn’t be unpacked.')) : ok()));
});

// Puts a backup's files back: replaced files are restored and files the update added are removed.
async function restore(dir, back) {
  for (const rel of back.added) await fsp.rm(path.join(dir, rel), { force: true });
  for (const rel of back.replaced) await fsp.copyFile(path.join(back.dir, 'files', rel), path.join(dir, rel));
  if (back.source === null) await fsp.rm(path.join(dir, SOURCE_FILE), { force: true });
  else await fsp.writeFile(path.join(dir, SOURCE_FILE), back.source);
}

async function update(id, exe, progress = () => {}, channel = 'latest') {
  const src = SOURCES[id]; if (!src) return { ok: false, error: 'EchoForge can’t update this emulator.' };
  const dir = folderOf(exe); if (!dir) return { ok: false, error: 'Move the emulator into its own folder first.' };
  const work = await fsp.mkdtemp(path.join(os.tmpdir(), 'echoforge-emu-'));
  let back = null;
  try {
    progress(0, 'Checking');
    if (channel === 'keep') return { ok: false, error: 'This emulator is set to keep its version. Choose Tested or Latest to update it.' };
    const all = await builds(src), rel = pick(all, src, channel); if (!rel) return { ok: false, error: 'No Windows build with a checksum was found.' };
    const current = await installed(dir);
    if (!isNewer(all, rel, current)) return { ok: true, already: true, label: label(current) || rel.label };
    const arc = path.join(work, 'update.zip'); await download(rel, arc, progress);
    progress(82, 'Unpacking'); const stage = path.join(work, 'stage'); await unpack(arc, stage);
    // Some archives wrap everything in one folder: install from wherever the emulator's exe is.
    const staged = await walk(stage), exeRel = staged.find(f => src.exe.some(x => path.basename(f).toLowerCase() === x.toLowerCase()));
    if (!exeRel) throw new Error('The update doesn’t contain the emulator program.');
    const root = path.join(stage, path.dirname(exeRel)), files = await walk(root);
    const exes = files.filter(f => /\.exe$/i.test(f)).map(f => path.basename(f).toLowerCase());
    if (await runningIn(dir, exes)) return { ok: false, error: 'Close the emulator first, then try again.' };

    progress(88, 'Backing up');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    back = { dir: path.join(backupRoot(), id, stamp), from: current, to: rel.tag, replaced: [], added: [], source: null };
    back.source = await fsp.readFile(path.join(dir, SOURCE_FILE), 'utf8').catch(() => null);
    for (const rel2 of files) {
      const target = path.join(dir, rel2);
      if (await exists(target)) { const b = path.join(back.dir, 'files', rel2); await fsp.mkdir(path.dirname(b), { recursive: true }); await fsp.copyFile(target, b); back.replaced.push(rel2); }
      else back.added.push(rel2);
    }
    await fsp.mkdir(back.dir, { recursive: true });
    await fsp.writeFile(path.join(back.dir, 'backup.json'), JSON.stringify({ from: back.from, to: back.to, replaced: back.replaced, added: back.added, source: back.source }, null, 1));

    progress(92, 'Installing');
    try {
      for (const rel2 of files) { const t = path.join(dir, rel2); await fsp.mkdir(path.dirname(t), { recursive: true }); await fsp.copyFile(path.join(root, rel2), t); }
      for (const rel2 of files) if (await hashOf(path.join(root, rel2)) !== await hashOf(path.join(dir, rel2))) throw new Error('A file didn’t copy correctly.');
    } catch (e) { await restore(dir, back); await fsp.rm(back.dir, { recursive: true, force: true }); throw new Error(`${e.message} The previous version was put back.`); }
    await fsp.writeFile(path.join(dir, SOURCE_FILE), `${rel.page}\r\n${rel.tag}\r\n${new Date().toISOString().slice(0, 19)}`);

    const old = await backupsFor(id); // keep the newest few backups
    for (const name of old.slice(0, Math.max(0, old.length - KEEP_BACKUPS))) await fsp.rm(path.join(backupRoot(), id, name), { recursive: true, force: true });
    progress(100, 'Done');
    return { ok: true, label: rel.label, from: label(current) };
  } catch (e) { return { ok: false, error: e.message }; }
  finally { await fsp.rm(work, { recursive: true, force: true }).catch(() => {}); }
}

async function rollback(id, exe) {
  const dir = folderOf(exe); if (!SOURCES[id] || !dir) return { ok: false, error: 'EchoForge can’t roll this emulator back.' };
  const back = await lastBackup(id); if (!back) return { ok: false, error: 'There’s no earlier version saved.' };
  if (back.to !== await installed(dir)) return { ok: false, error: 'The emulator changed since the last update, so EchoForge left it alone.' };
  const exes = [...back.replaced, ...back.added].filter(f => /\.exe$/i.test(f)).map(f => path.basename(f).toLowerCase());
  if (await runningIn(dir, exes)) return { ok: false, error: 'Close the emulator first, then try again.' };
  try { await restore(dir, back); } catch (e) { return { ok: false, error: `Couldn’t put the earlier version back: ${e.message}` }; }
  await fsp.rm(back.dir, { recursive: true, force: true });
  return { ok: true, label: label(back.from) || 'the earlier version' };
}

function register({ ipcMain, getWin }) {
  const send = (ch, v) => { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send(ch, v); };
  ipcMain.handle('emuup:list', () => Object.keys(SOURCES));
  ipcMain.handle('emuup:check', (_e, { id, exe, channel }) => check(id, exe, channel));
  ipcMain.handle('emuup:update', (_e, { id, exe, channel }) => update(id, exe, (pct, phase) => send('emuup:progress', { id, pct: Math.round(pct), phase }), channel));
  ipcMain.handle('emuup:rollback', (_e, { id, exe }) => rollback(id, exe));
}

module.exports = { register, check, update, rollback, label, SOURCES, TESTED_HOURS };
