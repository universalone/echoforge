'use strict';
// Installs EchoForge Retro Gaming for Retro Forge (the button beside the search bar). Retro ships as a zip, not an
// installer program: its NSIS installer was flagged by Windows Defender's machine learning (Trojan:Win32/Bearfoos.A!ml,
// a false alarm on unsigned programs that unpack and run Python). EchoForge downloads the zip from Retro's official
// GitHub releases, checks it against the SHA-256 GitHub publishes, unpacks it into %LOCALAPPDATA%\Programs and runs
// Retro once with --install, which adds its Start menu and Desktop shortcuts and its entry in Windows' list of apps.
// After that Retro updates itself.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');

const REPO = 'universalone/echoforge-retro-gaming';
const API = process.env.EF_GH_API || 'https://api.github.com'; // EF_GH_API: a test feed (dev aid)
const PACKAGE = /^EchoForge-Retro-Gaming-(\d+\.\d+\.\d+)-win64\.zip$/i;
const installDir = () => path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Programs', 'EchoForge Retro Gaming');
const cmpVersion = (a, b) => { const pa = a.split('.').map(Number), pb = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0); return 0; };

// The newest published release with a Windows zip that has a checksum (drafts and pre-releases skipped).
function newest(releases) {
  let best = null;
  for (const r of Array.isArray(releases) ? releases : []) {
    if (r.draft || r.prerelease) continue;
    const a = (r.assets || []).find(x => PACKAGE.test(x.name || ''));
    if (!a || !/^sha256:[0-9a-f]{64}$/i.test(a.digest || '') || !/^https:\/\/github\.com\//.test(a.browser_download_url || '')) continue;
    const version = PACKAGE.exec(a.name)[1];
    if (!best || cmpVersion(version, best.version) > 0) best = { version, url: a.browser_download_url, name: a.name, size: a.size || 0, sha256: a.digest.slice(7).toLowerCase(), page: r.html_url };
  }
  return best;
}

async function releases() {
  const res = await fetch(`${API}/repos/${REPO}/releases?per_page=10`, { headers: { 'User-Agent': 'EchoForge', Accept: 'application/vnd.github+json' } });
  if (res.status === 403 || res.status === 429) throw new Error('GitHub is limiting requests right now. Try again in an hour.');
  if (!res.ok) throw new Error(`GitHub answered ${res.status}.`);
  return res.json();
}

async function download(rel, file, progress) {
  const res = await fetch(rel.url, { headers: { 'User-Agent': 'EchoForge' } });
  if (!res.ok || !res.body) throw new Error(`The download failed (${res.status}).`);
  const h = crypto.createHash('sha256'), out = fs.createWriteStream(file); let got = 0;
  for await (const chunk of res.body) {
    h.update(chunk); got += chunk.length; progress(Math.min(80, got / (rel.size || got) * 80), 'Downloading');
    if (!out.write(chunk)) await new Promise(r => out.once('drain', r));
  }
  await new Promise((ok, bad) => out.end(err => (err ? bad(err) : ok())));
  if (h.digest('hex') !== rel.sha256) throw new Error('The download doesn’t match the checksum GitHub published, so nothing was installed.');
}

const run = (exe, args, opts = {}) => new Promise(res => execFile(exe, args, { windowsHide: true, timeout: 120000, ...opts }, (err, out, errOut) => res({ code: err ? (err.code ?? 1) : 0, out: String(out || '') + String(errOut || '') })));

// Puts Retro in place from a checked zip. A folder already holding Retro is left alone (Retro updates itself).
// opts (tests): dir (where to install), register: false skips running --install.
async function installFromZip(zip, opts = {}, progress = () => {}) {
  const dir = opts.dir || installDir();
  if (fs.existsSync(path.join(dir, 'app', 'jl_retro.pyw'))) return { ok: true, already: true, dir };
  const stage = await fsp.mkdtemp(path.join(os.tmpdir(), 'echoforge-retro-'));
  try {
    progress(84, 'Unpacking');
    // Windows' own tar reads zip files (named in full: another tar earlier on PATH, like Git's, can't).
    const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
    const t = await run(tar, ['-xf', zip, '-C', stage]);
    if (t.code !== 0) throw new Error('The download couldn’t be unpacked.');
    for (const need of [['app', 'jl_retro.pyw'], ['python', 'pythonw.exe']]) if (!fs.existsSync(path.join(stage, ...need))) throw new Error('The download isn’t a complete copy of EchoForge Retro Gaming.');
    progress(92, 'Installing');
    await fsp.mkdir(dir, { recursive: true });
    await fsp.cp(stage, dir, { recursive: true, errorOnExist: false, force: true });
    if (opts.register !== false) {
      progress(97, 'Adding shortcuts');
      await run(path.join(dir, 'python', 'pythonw.exe'), [path.join(dir, 'app', 'jl_retro.pyw'), '--install'], { cwd: path.join(dir, 'app') });
    }
    progress(100, 'Done');
    return { ok: true, dir };
  } finally { await fsp.rm(stage, { recursive: true, force: true }).catch(() => {}); }
}

async function install(progress = () => {}, opts = {}) {
  const dir = opts.dir || installDir();
  if (fs.existsSync(path.join(dir, 'app', 'jl_retro.pyw'))) return { ok: true, already: true, dir };
  const work = await fsp.mkdtemp(path.join(os.tmpdir(), 'echoforge-retro-dl-'));
  try {
    progress(0, 'Checking');
    const rel = newest(opts.releases || await releases());
    if (!rel) return { ok: false, error: 'No EchoForge Retro Gaming download for Windows was found on its GitHub page.' };
    const zip = path.join(work, rel.name);
    await (opts.download || download)(rel, zip, progress);
    const r = await installFromZip(zip, opts, progress);
    return { ...r, version: rel.version };
  } catch (e) { return { ok: false, error: e.message }; }
  finally { await fsp.rm(work, { recursive: true, force: true }).catch(() => {}); }
}

function register({ ipcMain, getWin }) {
  const send = (ch, v) => { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send(ch, v); };
  ipcMain.handle('retro:install', () => install((pct, phase) => send('retro:installProgress', { pct: Math.round(pct), phase })));
}

module.exports = { register, install, installFromZip, newest, installDir, PACKAGE };
