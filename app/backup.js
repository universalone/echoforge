'use strict';
// Save backups: copies each emulator's save folders into dated snapshots on a backup drive.
//   <backup root>\<emulator>\<YYYY-MM-DD HH.MM.SS>\<label>\...   plus manifest.json (where each label came from)
// A snapshot is skipped when nothing changed since the last one. Older snapshots beyond "keep" go to the Recycle Bin.
// Restoring first snapshots the current saves, then copies the chosen snapshot's files back over them.
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const { execFile } = require('child_process');
const { recycleAll } = require('./recycle');

const portable = dir => ['portable.txt', 'portable.ini', 'portable'].some(f => fs.existsSync(path.join(dir, f)));
// Each source: { label, path, filter? } where filter(relativePath) picks what to keep inside a folder.
function sourcesFor(id, exe, docs) {
  const dir = path.dirname(exe), J = (...p) => path.join(...p);
  const base = (folder) => (portable(dir) ? dir : J(docs, folder));
  switch (id) {
    case 'rpcs3': { const h = J(dir, 'dev_hdd0', 'home', '00000001'); return [{ label: 'Saves', path: J(h, 'savedata') }, { label: 'Trophies', path: J(h, 'trophy') }, { label: 'Licenses', path: J(h, 'exdata') }]; }
    case 'pcsx2': return [{ label: 'Memory cards', path: J(base('PCSX2'), 'memcards') }, { label: 'Save states', path: J(base('PCSX2'), 'sstates') }];
    case 'duckstation': return [{ label: 'Memory cards', path: J(base('DuckStation'), 'memcards') }, { label: 'Save states', path: J(base('DuckStation'), 'savestates') }];
    case 'ppsspp': { const m = fs.existsSync(J(dir, 'memstick')) ? J(dir, 'memstick', 'PSP') : J(docs, 'PPSSPP', 'PSP'); return [{ label: 'Saves', path: J(m, 'SAVEDATA') }, { label: 'Save states', path: J(m, 'PPSSPP_STATE') }]; }
    case 'dolphin': { const u = portable(dir) ? J(dir, 'User') : J(docs, 'Dolphin Emulator'); return [{ label: 'GameCube', path: J(u, 'GC') }, { label: 'Wii saves', path: J(u, 'Wii', 'title') }, { label: 'Save states', path: J(u, 'StateSaves') }]; }
    // content\<profile>\<title id>\00000001 holds saves; DLC (00000002) and title updates (000B0000) can be gigabytes.
    case 'xenia': return [{ label: 'Saves', path: J(portable(dir) ? dir : J(docs, 'Xenia'), 'content'), filter: rel => rel.split(/[\\/]/)[2] === '00000001' }];
    case 'xemu': {
      let toml = ''; try { toml = fs.readFileSync(J(dir, 'xemu.toml'), 'utf8'); } catch {}
      const at = key => (toml.match(new RegExp(`^\\s*${key}\\s*=\\s*'([^']+)'`, 'm')) || [])[1];
      return [{ label: 'Hard drive (saves)', path: at('hdd_path') || J(dir, 'xbox_hdd.qcow2') }, { label: 'EEPROM', path: at('eeprom_path') || J(dir, 'eeprom.bin') }];
    }
    case 'shadps4': return [{ label: 'Saves', path: J(dir, 'user', 'savedata') }];
    case 'retroarch': return [{ label: 'Saves', path: J(dir, 'saves') }, { label: 'Save states', path: J(dir, 'states') }];
    default: return [];
  }
}

async function walk(root, filter) { // -> [{ rel, size, mtimeMs }] for a folder, or the single file itself
  let st; try { st = await fsp.stat(root); } catch { return null; }
  if (!st.isDirectory()) return [{ rel: '', size: st.size, mtimeMs: st.mtimeMs }];
  const out = [];
  async function go(dir, rel) {
    let ents = []; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const r = rel ? path.join(rel, e.name) : e.name, full = path.join(dir, e.name);
      if (e.isDirectory()) await go(full, r);
      else if (e.isFile() && (!filter || filter(r))) { const s = await fsp.stat(full); out.push({ rel: r, size: s.size, mtimeMs: s.mtimeMs }); }
    }
  }
  await go(root, '');
  return out;
}
const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}`; };

async function snapshots(dest, id) {
  const dir = path.join(dest, id), out = [];
  let ents = []; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    if (!e.isDirectory()) continue;
    try { const m = JSON.parse(await fsp.readFile(path.join(dir, e.name, 'manifest.json'), 'utf8')); out.push({ stamp: e.name, dir: path.join(dir, e.name), ...m }); } catch {}
  }
  return out.sort((a, b) => b.at - a.at);
}

function exeRunning(exe) {
  return new Promise(res => execFile('tasklist', ['/FI', `IMAGENAME eq ${path.basename(exe)}`, '/NH'], { windowsHide: true }, (err, out) => res(!err && out.toLowerCase().includes(path.basename(exe).toLowerCase()))));
}

function register({ ipcMain, app, shell }) {
  const docs = () => app.getPath('documents');

  async function status(id, exe, dest) {
    const sources = [];
    for (const s of sourcesFor(id, exe, docs())) {
      const files = await walk(s.path, s.filter);
      sources.push({ label: s.label, path: s.path, exists: !!files, files: files ? files.length : 0, bytes: files ? files.reduce((n, f) => n + f.size, 0) : 0 });
    }
    const snaps = dest ? (await snapshots(dest, id)).map(({ stamp, at, files, bytes, reason }) => ({ stamp, at, files, bytes, reason })) : [];
    return { sources, snapshots: snaps };
  }

  async function backupOne(id, exe, dest, keep, reason) {
    const srcs = sourcesFor(id, exe, docs()), found = [];
    for (const s of srcs) { const files = await walk(s.path, s.filter); if (files && files.length) found.push({ ...s, files }); }
    if (!found.length) return { ok: true, skipped: 'No saves yet' };
    const sig = crypto.createHash('sha1').update(JSON.stringify(found.map(s => [s.label, s.files.map(f => [f.rel, f.size, Math.round(f.mtimeMs)])]))).digest('hex');
    const prev = (await snapshots(dest, id))[0];
    if (prev && prev.sig === sig) return { ok: true, skipped: 'No changes since the last backup', stamp: prev.stamp };
    const name = stamp(), snap = path.join(dest, id, name), part = snap + '.partial';
    await fsp.mkdir(part, { recursive: true });
    let files = 0, bytes = 0;
    try {
      for (const s of found) for (const f of s.files) {
        const from = f.rel ? path.join(s.path, f.rel) : s.path, to = path.join(part, s.label, f.rel || path.basename(s.path));
        await fsp.mkdir(path.dirname(to), { recursive: true });
        await fsp.copyFile(from, to);
        if ((await fsp.stat(to)).size !== f.size) throw new Error(`Copy of ${f.rel || path.basename(s.path)} didn’t match`);
        await fsp.utimes(to, new Date(), new Date(f.mtimeMs)).catch(() => {});
        files++; bytes += f.size;
      }
      const manifest = { emulator: id, at: Date.now(), reason, sig, files, bytes, sources: found.map(s => ({ label: s.label, path: s.path, single: s.files.length === 1 && s.files[0].rel === '' })) };
      await fsp.writeFile(path.join(part, 'manifest.json'), JSON.stringify(manifest, null, 1));
      await fsp.rename(part, snap); // a snapshot only exists once every file is in and checked
    } catch (e) { await fsp.rm(part, { recursive: true, force: true }).catch(() => {}); return { ok: false, error: e.message }; }
    const all = await snapshots(dest, id);
    let oldKept = 0; // a snapshot too big for the bin stays on disk rather than being deleted for good
    for (const old of all.slice(Math.max(1, keep))) if (!(await recycleAll(shell, [old.dir])).ok) oldKept++;
    return { ok: true, stamp: name, files, bytes, oldKept };
  }

  ipcMain.handle('backup:status', async (_e, { emulators, dest }) => {
    const out = {};
    for (const [id, exe] of Object.entries(emulators)) if (exe) out[id] = await status(id, exe, dest).catch(e => ({ error: e.message, sources: [], snapshots: [] }));
    return out;
  });
  ipcMain.handle('backup:run', async (_e, { emulators, dest, keep = 10, reason = 'manual' }) => {
    if (!dest) return { error: 'Choose a backup folder first.' };
    try { await fsp.mkdir(dest, { recursive: true }); } catch (e) { return { error: `Can’t use ${dest}: ${e.message}` }; }
    const out = {};
    for (const [id, exe] of Object.entries(emulators)) if (exe) out[id] = await backupOne(id, exe, dest, keep, reason).catch(e => ({ ok: false, error: e.message }));
    return { results: out };
  });
  ipcMain.handle('backup:restore', async (_e, { id, exe, dest, snap, keep = 10 }) => {
    if (await exeRunning(exe)) return { ok: false, error: `Close ${path.basename(exe)} first. Restoring while it runs could be overwritten when it saves.` };
    const s = (await snapshots(dest, id)).find(x => x.stamp === snap);
    if (!s) return { ok: false, error: 'That backup is gone.' };
    const safety = await backupOne(id, exe, dest, keep + 1, 'before restore'); // the current saves, in case the restore was a mistake
    if (!safety.ok) return { ok: false, error: `Couldn’t back up your current saves first (${safety.error}), so nothing was changed.` };
    const now = new Map(sourcesFor(id, exe, docs()).map(x => [x.label, x.path])); // the emulator may have moved since
    let files = 0;
    for (const src of s.sources) {
      const target = now.get(src.label) || src.path, from = path.join(s.dir, src.label);
      const list = await walk(from); if (!list) continue;
      for (const f of list) {
        const to = src.single ? target : path.join(target, f.rel);
        await fsp.mkdir(path.dirname(to), { recursive: true });
        await fsp.copyFile(path.join(from, f.rel), to); files++;
      }
    }
    return { ok: true, files, safety: safety.stamp };
  });
}

module.exports = { register, sourcesFor };
