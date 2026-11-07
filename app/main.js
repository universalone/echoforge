// EchoForge — main process: splash, window, storage, scanning, firmware checks, hardware probe, launching.
const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const { tally, binProblem, recycleAll } = require('./recycle');

const DATA_FILE = () => path.join(app.getPath('userData'), 'echoforge-data.json');
const ICON = path.join(__dirname, 'assets', 'icon.png');

let splash = null;
let win = null;
let running = null; // { child, gameId, started }

if (process.env.EF_PROFILE) app.setPath('userData', process.env.EF_PROFILE); // isolated test profile
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });

// Hardware acceleration can be turned off from Settings → Advanced (takes effect on restart).
try {
  const raw = JSON.parse(fs.readFileSync(DATA_FILE(), 'utf8'));
  if (raw && raw.settings && raw.settings.disableGpu) app.disableHardwareAcceleration();
} catch { /* first run */ }

function createSplash() {
  splash = new BrowserWindow({
    width: 560, height: 380, frame: false, transparent: true, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, show: false, icon: ICON,
    webPreferences: { preload: path.join(__dirname, 'splash-preload.js'), contextIsolation: true, sandbox: true }
  });
  splash.loadFile(path.join(__dirname, 'splash.html'));
  splash.once('ready-to-show', () => splash.show());
}

function createMain() {
  win = new BrowserWindow({
    width: 1440, height: 880, minWidth: 1040, minHeight: 640,
    frame: false, backgroundColor: '#0b0c10', show: false, icon: ICON,
    title: 'EchoForge',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('maximize', () => win.webContents.send('win:state', true));
  win.on('unmaximize', () => win.webContents.send('win:state', false));
  // Links never open inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(() => {
  createSplash();
  const shownAt = Date.now();
  createMain();
  // Renderer says when the library is loaded; the splash stays at least 2.4 s so the animation finishes.
  ipcMain.once('app:ready', () => {
    const wait = Math.max(0, 2400 - (Date.now() - shownAt));
    setTimeout(() => {
      if (splash) { splash.webContents.send('splash:done'); }
      setTimeout(() => { if (splash) splash.destroy(); splash = null; win.show(); win.focus(); }, 450);
    }, wait);
  });
});
app.on('window-all-closed', () => app.quit());

ipcMain.on('splash:status', (_e, msg) => { if (splash) splash.webContents.send('splash:status', msg); });

// Dev aid, from source only: EF_SNAP=<dir> saves screenshots (and the visible text) of the splash and main window, then quits.
// Screenshots fail while the display is off or locked; the .txt files are still written.
if (process.env.EF_SNAP && !app.isPackaged) {
  // Keep painting while covered by other windows, or captures come back as stale frames.
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.whenReady().then(() => {
    const dir = process.env.EF_SNAP; fs.mkdirSync(dir, { recursive: true });
    const snap = async (wc, name) => {
      try { fs.writeFileSync(path.join(dir, name + '.png'), (await wc.capturePage()).toPNG()); } catch (e) { console.log('snap capture failed', name, e.message); }
      fs.writeFileSync(path.join(dir, name + '.txt'), String(await wc.executeJavaScript('document.body.innerText').catch(() => '')));
    };
    setTimeout(() => { if (splash) snap(splash.webContents, 'splash'); }, 1900);
    setTimeout(async () => {
      await snap(win.webContents, 'main');
      if (process.env.EF_SNAP_JS) {
        for (const [i, js] of process.env.EF_SNAP_JS.split('|||').entries()) {
          await win.webContents.executeJavaScript(js).catch(e => console.log('snap js error', e.message));
          await new Promise(r => setTimeout(r, 900));
          await snap(win.webContents, `view${i + 1}`);
        }
      }
      app.exit(0);
    }, 5200);
  });
}

// ---------- storage ----------
ipcMain.handle('store:load', async () => {
  try { return JSON.parse(await fsp.readFile(DATA_FILE(), 'utf8')); } catch { return null; }
});
let saveChain = Promise.resolve();
ipcMain.handle('store:save', (_e, data) => {
  // Write to a temp file, then rename: a crash mid-write never corrupts the library.
  saveChain = saveChain.then(async () => {
    const f = DATA_FILE(); const tmp = f + '.tmp';
    await fsp.mkdir(path.dirname(f), { recursive: true });
    await fsp.writeFile(tmp, JSON.stringify(data, null, 1));
    await fsp.rename(tmp, f);
  }).catch(() => {});
  return saveChain.then(() => true);
});
ipcMain.handle('store:export', async (_e, data) => {
  const r = await dialog.showSaveDialog(win, { title: 'Back up EchoForge', defaultPath: `echoforge-backup-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'EchoForge backup', extensions: ['json'] }] });
  if (r.canceled) return false;
  await fsp.writeFile(r.filePath, JSON.stringify(data, null, 1)); return r.filePath;
});
ipcMain.handle('store:import', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Restore EchoForge backup', properties: ['openFile'], filters: [{ name: 'EchoForge backup', extensions: ['json'] }] });
  if (r.canceled) return null;
  return JSON.parse(await fsp.readFile(r.filePaths[0], 'utf8'));
});

// ---------- dialogs / shell ----------
ipcMain.handle('dialog:file', async (_e, opts = {}) => {
  const r = await dialog.showOpenDialog(win, { title: opts.title || 'Choose a file', defaultPath: opts.defaultPath, properties: ['openFile'], filters: opts.filters });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('dialog:folder', async (_e, opts = {}) => {
  const r = await dialog.showOpenDialog(win, { title: opts.title || 'Choose a folder', defaultPath: opts.defaultPath, properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('shell:external', (_e, url) => { if (/^https:\/\//.test(url)) return shell.openExternal(url); });
ipcMain.handle('shell:path', (_e, p) => shell.openPath(p));
ipcMain.handle('shell:reveal', (_e, p) => shell.showItemInFolder(p));
ipcMain.handle('app:loginItem', (_e, on) => { app.setLoginItemSettings({ openAtLogin: !!on }); return true; });
ipcMain.handle('app:relaunch', () => { app.relaunch(); app.exit(0); });
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:paths', () => ({ userData: app.getPath('userData'), home: os.homedir() }));

ipcMain.on('win:min', () => win.minimize());
ipcMain.on('win:max', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.on('win:close', () => win.close());
ipcMain.on('win:fullscreen', (_e, on) => win.setFullScreen(!!on));

// ---------- filesystem ----------
ipcMain.handle('fs:exists', async (_e, p) => { try { await fsp.access(p); return true; } catch { return false; } });
ipcMain.handle('fs:existsMany', async (_e, list) => Promise.all(list.map(async p => { try { await fsp.access(p); return true; } catch { return false; } })));
ipcMain.handle('fs:readText', async (_e, p) => { try { return (await fsp.readFile(p, 'utf8')).slice(0, 4096); } catch { return null; } });
ipcMain.handle('fs:mkdirs', async (_e, list) => { for (const d of list) { try { await fsp.mkdir(d, { recursive: true }); } catch {} } return true; });
ipcMain.handle('fs:readImage', async (_e, p) => {
  try { const b = await fsp.readFile(p); return 'data:image/' + (p.toLowerCase().endsWith('.jpg') || p.toLowerCase().endsWith('.jpeg') ? 'jpeg' : 'png') + ';base64,' + b.toString('base64'); } catch { return null; }
});

async function dirSize(dir) {
  let total = 0, ents; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of ents) { const p = path.join(dir, e.name); if (e.isDirectory()) total += await dirSize(p); else { try { total += (await fsp.stat(p)).size; } catch {} } }
  return total;
}
// A .cue is a few bytes of text; the game is the .bin track(s) it lists.
async function cueSize(cue) {
  let total = 0, txt = ''; try { txt = await fsp.readFile(cue, 'utf8'); } catch { return 0; }
  for (const m of txt.matchAll(/^\s*FILE\s+"?([^"\r\n]+?)"?\s+\w+\s*$/gim)) { try { total += (await fsp.stat(path.join(path.dirname(cue), m[1]))).size; } catch {} }
  return total;
}
// Folder games (EBOOT.BIN etc.): the game root is above PS3_GAME\USRDIR, or the eboot's own folder for PS4.
function gameRoot(file) {
  let d = path.dirname(file);
  if (path.basename(d).toLowerCase() === 'usrdir') d = path.dirname(d);
  if (path.basename(d).toLowerCase() === 'ps3_game') d = path.dirname(d);
  return d;
}

// ---------- moving games between drives ----------
// What "the game" is on disk: a whole folder (PS3/PS4/360 folder games), a .cue plus its tracks, or one file.
async function gameUnit(file, libFolders = []) {
  const low = path.basename(file).toLowerCase();
  if (['eboot.bin', 'default.xex', 'appxmanifest.xml'].includes(low)) { const root = gameRoot(file); return { dir: root, rel: path.relative(root, file) }; }
  const files = [file];
  if (low.endsWith('.cue')) {
    let txt = ''; try { txt = await fsp.readFile(file, 'utf8'); } catch {}
    for (const m of txt.matchAll(/^\s*FILE\s+"?([^"\r\n]+?)"?\s+\w+\s*$/gim)) files.push(path.join(path.dirname(file), m[1]));
  }
  // A game alone in its own subfolder (e.g. Playstation\Crash Bandicoot (USA)\) moves with that folder, never a library folder itself.
  const parent = path.dirname(file);
  if (!libFolders.some(f => f.toLowerCase().replace(/[\\/]+$/, '') === parent.toLowerCase())) {
    let names = []; try { names = (await fsp.readdir(parent)).map(n => n.toLowerCase()); } catch {}
    const mine = new Set(files.map(f => path.basename(f).toLowerCase()));
    if (names.length && names.every(n => mine.has(n))) return { dir: parent, rel: path.basename(file) };
  }
  return { files };
}
ipcMain.handle('game:move', async (_e, { file, destDir, libFolders }) => {
  try {
    const u = await gameUnit(file, libFolders || []);
    const pairs = (u.dir ? [u.dir] : u.files).map(s => [s, path.join(destDir, path.basename(s))]);
    if (pairs.some(([s, d]) => s.toLowerCase() === d.toLowerCase())) return { ok: false, error: 'It is already there.' };
    for (const [, d] of pairs) if (fs.existsSync(d)) return { ok: false, error: `${d} already exists.` };
    const before = []; let need = 0;
    for (const [s] of pairs) { const t = await tally(s); before.push(t); need += t.bytes; }
    await fsp.mkdir(destDir, { recursive: true });
    const st = await fsp.statfs(destDir);
    if (st.bavail * st.bsize < need + 2 * 1024 ** 3) return { ok: false, error: `Not enough space on ${destDir.slice(0, 2)} (needs ${(need / 1024 ** 3).toFixed(1)} GB plus 2 GB spare).` };
    for (const [s, d] of pairs) await fsp.cp(s, d, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
    for (let i = 0; i < pairs.length; i++) { // verify every byte count before touching the original
      const after = await tally(pairs[i][1]);
      if (after.bytes !== before[i].bytes || after.files !== before[i].files) {
        for (const [, d] of pairs) await fsp.rm(d, { recursive: true, force: true });
        return { ok: false, error: 'The copy did not match the original, so nothing was moved.' };
      }
    }
    for (const [s] of pairs) await fsp.rm(s, { recursive: true, force: true });
    const moved = u.dir ? path.join(destDir, path.basename(u.dir), u.rel) : path.join(destDir, path.basename(file));
    return { ok: true, path: moved, bytes: need };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ---------- sending a game to the Recycle Bin ----------
// What would go, or why it can't: never a drive root, and never a folder that holds a library folder, another game or an emulator.
async function recyclePlan({ file, libFolders, keep }) {
  const u = await gameUnit(file, libFolders || []);
  const norm = p => path.resolve(p).toLowerCase().replace(/[\\/]+$/, '');
  if (u.dir) {
    const d = norm(u.dir);
    if (path.parse(u.dir).root.toLowerCase().replace(/[\\/]+$/, '') === d) return { error: 'The game sits at the top of a drive, so EchoForge can’t tell which files are its own.' };
    if ((keep || []).some(k => norm(k) === d || norm(k).startsWith(d + path.sep))) return { error: `${u.dir} also holds a library folder, another game or an emulator, so EchoForge won’t recycle it. Remove the game’s files by hand.` };
  }
  const paths = u.dir ? [u.dir] : u.files.filter(f => fs.existsSync(f));
  if (!paths.length) throw new Error('The game’s file wasn’t found.');
  let bytes = 0, files = 0;
  for (const p of paths) { const t = await tally(p); bytes += t.bytes; files += t.files; }
  const problem = await binProblem(paths, bytes);
  if (problem) return { error: problem };
  return { paths, bytes, files };
}
ipcMain.handle('game:recycleInfo', async (_e, o) => {
  try { const p = await recyclePlan(o); return p.error ? { ok: false, error: p.error } : { ok: true, ...p }; }
  catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('game:recycle', async (_e, o) => {
  try {
    const p = await recyclePlan(o); if (p.error) return { ok: false, error: p.error };
    const x = await recycleAll(shell, p.paths);
    if (!x.ok) return { ok: false, recycled: x.recycled, error: `Windows wouldn’t put it in the Recycle Bin, so ${x.recycled.length ? 'the rest was' : 'nothing was'} left where it is. It may be in use. (${x.error})` };
    return { ok: true, paths: p.paths, bytes: p.bytes };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ---------- box art ----------
// Covers come from the libretro thumbnails library (the open collection RetroArch uses). Only console + game names are sent.
const ART_BASE = 'https://thumbnails.libretro.com/';
const ART_SYSTEMS = { ps1: 'Sony - PlayStation', ps2: 'Sony - PlayStation 2', ps3: 'Sony - PlayStation 3', ps4: 'Sony - PlayStation 4', psp: 'Sony - PlayStation Portable', gc: 'Nintendo - GameCube', wii: 'Nintendo - Wii', xbox: 'Microsoft - Xbox', x360: 'Microsoft - Xbox 360' };
const artLists = new Map();
// kind: Named_Boxarts (covers), Named_Snaps (in-game screenshots) or Named_Titles (title screens).
async function artList(sys, kind = 'Named_Boxarts') {
  const key = sys + '|' + kind; if (artLists.has(key)) return artLists.get(key);
  const cache = path.join(app.getPath('userData'), 'art-index', sys + (kind === 'Named_Boxarts' ? '' : ' ' + kind) + '.json');
  try { if (Date.now() - (await fsp.stat(cache)).mtimeMs < 7 * 864e5) { const l = JSON.parse(await fsp.readFile(cache, 'utf8')); artLists.set(key, l); return l; } } catch {}
  const res = await fetch(ART_BASE + encodeURIComponent(sys) + '/' + kind + '/', { headers: { 'User-Agent': 'EchoForge' } });
  if (!res.ok) throw new Error(kind + ' index HTTP ' + res.status);
  const list = [...(await res.text()).matchAll(/href="([^"]+\.png)"/g)].map(m => decodeURIComponent(m[1]));
  await fsp.mkdir(path.dirname(cache), { recursive: true }); await fsp.writeFile(cache, JSON.stringify(list));
  artLists.set(key, list); return list;
}
// Loose name key: no regions/tags, "Title, The" -> "The Title", no articles or "vs.", only letters and digits.
const artKey = s => s.toLowerCase().replace(/\.png$/, '').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/^(.*?),\s*the\b/, 'the $1')
  .replace(/&/g, ' and ').replace(/[™®]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\b(the|a|an|vs|versus)\b/g, ' ').replace(/\s+/g, ' ').trim();
const artSafe = s => s.replace(/[&*/:`<>?\\|"]/g, '_'); // libretro's file-name substitutions
function pickArt(list, names) {
  const lower = new Map(list.map(n => [n.toLowerCase(), n]));
  for (const n of names) { const hit = lower.get(artSafe(n).toLowerCase() + '.png'); if (hit) return hit; } // exact No-Intro/Redump name
  for (const n of names) {
    const k = artKey(n); if (!k) continue;
    const hits = list.filter(x => artKey(x) === k);
    if (hits.length) return hits.find(x => /\(USA/.test(x)) || hits.find(x => /\(World/.test(x)) || hits[0];
  }
  return null;
}
// Xbox 360: libretro has almost no covers, so fall back to XboxUnity (the database Aurora uses), keyed by the disc's title ID.
const XDVDFS_MAGIC = 'MICROSOFT*XBOX*MEDIA', XSECTOR = 2048;
async function readAt(fh, pos, len) { const b = Buffer.alloc(len); await fh.read(b, 0, len, pos); return b; }
function xexTitleId(head) {
  if (head.toString('latin1', 0, 4) !== 'XEX2') return null;
  const count = head.readUInt32BE(0x14);
  for (let i = 0; i < count && 0x1C + i * 8 < head.length; i++) {
    if (head.readUInt32BE(0x18 + i * 8) !== 0x00040006) continue; // execution info: media id, version, base version, title id
    const off = head.readUInt32BE(0x1C + i * 8);
    return off + 16 <= head.length ? head.readUInt32BE(off + 12).toString(16).toUpperCase().padStart(8, '0') : null;
  }
  return null;
}
async function x360TitleId(file) {
  const fh = await fsp.open(file, 'r');
  try {
    let xexPos;
    if (/\.xex$/i.test(file)) xexPos = 0;
    else {
      // Disc image: the game partition starts at 0xFD90000 (XGD2), 0x2080000 (XGD3) or 0 (trimmed XISO); its volume descriptor is 32 sectors in.
      let base = null;
      for (const p of [0xFD90000, 0x2080000, 0]) if ((await readAt(fh, p + 32 * XSECTOR, 20)).toString('latin1') === XDVDFS_MAGIC) { base = p; break; }
      if (base === null) return null;
      const vd = await readAt(fh, base + 32 * XSECTOR, 28);
      const dir = await readAt(fh, base + vd.readUInt32LE(20) * XSECTOR, Math.min(vd.readUInt32LE(24), 1 << 20));
      const find = off => { // root directory is a binary tree of 4-byte-aligned entries
        const e = off * 4; if (e + 14 > dir.length) return null;
        const left = dir.readUInt16LE(e), right = dir.readUInt16LE(e + 2); if (left === 0xFFFF && right === 0xFFFF) return null;
        if (dir.toString('latin1', e + 14, e + 14 + dir[e + 13]).toLowerCase() === 'default.xex') return dir.readUInt32LE(e + 4);
        return (left && find(left)) || (right && find(right)) || null;
      };
      const sec = find(0); if (sec == null) return null;
      xexPos = base + sec * XSECTOR;
    }
    const first = await readAt(fh, xexPos, 0x18);
    if (first.toString('latin1', 0, 4) !== 'XEX2') return null;
    return xexTitleId(await readAt(fh, xexPos, Math.min(first.readUInt32BE(0x08), 0x40000)));
  } finally { await fh.close(); }
}
async function xboxUnityCover(titleId) {
  const info = await fetch('https://xboxunity.net/Resources/Lib/CoverInfo.php?titleid=' + titleId, { headers: { 'User-Agent': 'EchoForge' } });
  if (!info.ok) return null;
  let covers = []; try { covers = JSON.parse(await info.text()).Covers || []; } catch { return null; }
  if (!covers.length) return null;
  const best = covers.find(c => c.Official === '1') || [...covers].sort((a, b) => (+b.Rating || 0) - (+a.Rating || 0))[0];
  const img = await fetch('https://xboxunity.net/Resources/Lib/Cover.php?size=large&cid=' + encodeURIComponent(best.CoverID), { headers: { 'User-Agent': 'EchoForge' } });
  if (!img.ok) return null;
  let pic = nativeImage.createFromBuffer(Buffer.from(await img.arrayBuffer()));
  if (pic.isEmpty()) return null;
  const { width: w, height: h } = pic.getSize();
  if (w > h * 1.3) { const x = Math.round(w * 0.5244); pic = pic.crop({ x, y: 0, width: w - x, height: h }); } // full wrap (back|spine|front): keep the front
  return pic.toPNG();
}

ipcMain.handle('art:fetch', async (_e, { id, console: cid, names, file, xboxUnity }) => {
  const sys = ART_SYSTEMS[cid]; if (!sys) return { ok: false, reason: 'unsupported' };
  try {
    let buf = null, name = null;
    const hit = pickArt(await artList(sys), (names || []).filter(Boolean));
    if (hit) {
      const res = await fetch(ART_BASE + encodeURIComponent(sys) + '/Named_Boxarts/' + encodeURIComponent(hit), { headers: { 'User-Agent': 'EchoForge' } });
      if (res.ok) { buf = Buffer.from(await res.arrayBuffer()); name = hit; }
    }
    if (!buf && xboxUnity && cid === 'x360' && file) {
      const tid = await x360TitleId(file).catch(() => null);
      if (tid) { buf = await xboxUnityCover(tid); name = 'XboxUnity ' + tid; }
    }
    if (!buf) return { ok: false, reason: 'nomatch' };
    if (buf.subarray(1, 4).toString() !== 'PNG') return { ok: false, reason: 'not an image' };
    const dir = path.join(app.getPath('userData'), 'covers'); await fsp.mkdir(dir, { recursive: true });
    const out = path.join(dir, String(id).replace(/[^\w-]/g, '') + '.png'); await fsp.writeFile(out, buf);
    return { ok: true, path: out, name };
  } catch (e) { return { ok: false, reason: e.message }; }
});

// Gameplay screenshot and title screen for the game page and backdrops, from the same library and matched the same way.
ipcMain.handle('art:shots', async (_e, { id, console: cid, names }) => {
  const sys = ART_SYSTEMS[cid]; if (!sys) return { ok: false, reason: 'unsupported' };
  const dir = path.join(app.getPath('userData'), 'shots'), out = {};
  try {
    await fsp.mkdir(dir, { recursive: true });
    for (const [kind, tag] of [['Named_Snaps', 'snap'], ['Named_Titles', 'title']]) {
      const hit = pickArt(await artList(sys, kind).catch(() => []), (names || []).filter(Boolean)); if (!hit) continue;
      const res = await fetch(ART_BASE + encodeURIComponent(sys) + '/' + kind + '/' + encodeURIComponent(hit), { headers: { 'User-Agent': 'EchoForge' } });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer()); if (buf.subarray(1, 4).toString() !== 'PNG') continue;
      const file = path.join(dir, `${String(id).replace(/[^\w-]/g, '')}-${tag}.png`); await fsp.writeFile(file, buf); out[tag] = file;
    }
    return { ok: true, ...out };
  } catch (e) { return { ok: false, reason: e.message }; }
});

const SKIP_DIRS = new Set(['$recycle.bin', 'system volume information', 'node_modules', '.git', 'windows', 'program files', 'program files (x86)', 'programdata']);

// Walks a folder and returns files matching any of the console's rules.
// rule: { ext: ['.iso'], names: ['eboot.bin'] }
ipcMain.handle('fs:scan', async (_e, { folder, rule, maxDepth = 6 }) => {
  const exts = new Set((rule.ext || []).map(s => s.toLowerCase()));
  const names = new Set((rule.names || []).map(s => s.toLowerCase()));
  const out = [];
  async function walk(dir, depth) {
    let entries; try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const full = path.join(dir, ent.name); const low = ent.name.toLowerCase();
      if (ent.isDirectory()) {
        if (depth < maxDepth && !SKIP_DIRS.has(low) && !low.startsWith('.')) await walk(full, depth + 1);
      } else if (names.has(low) || exts.has(path.extname(low))) {
        let size = 0;
        if (names.has(low)) size = await dirSize(gameRoot(full));
        else if (low.endsWith('.cue')) size = await cueSize(full);
        else { try { size = (await fsp.stat(full)).size; } catch {} }
        out.push({ path: full, size, meta: await readMeta(full) });
      }
      if (out.length > 20000) return;
    }
  }
  await walk(folder, 0);
  return out;
});

// PlayStation PARAM.SFO reader: gives the real title, title id and the bundled icon as cover art.
function parseSfo(buf) {
  if (buf.readUInt32LE(0) !== 0x46535000) return null; // "\0PSF"
  const keyTable = buf.readUInt32LE(8), dataTable = buf.readUInt32LE(12), count = buf.readUInt32LE(16);
  const res = {};
  for (let i = 0; i < count; i++) {
    const o = 20 + i * 16;
    const keyOff = buf.readUInt16LE(o), fmt = buf.readUInt16LE(o + 2), len = buf.readUInt32LE(o + 4), dataOff = buf.readUInt32LE(o + 12);
    let k = ''; for (let j = keyTable + keyOff; buf[j]; j++) k += String.fromCharCode(buf[j]);
    const d = dataTable + dataOff;
    res[k] = fmt === 0x0404 ? buf.readUInt32LE(d) : buf.slice(d, d + len).toString('utf8').replace(/\0+$/, '');
  }
  return res;
}
async function tryRead(p) { try { return await fsp.readFile(p); } catch { return null; } }
async function firstExisting(list) { for (const p of list) { try { await fsp.access(p); return p; } catch {} } return null; }

async function readMeta(file) {
  const low = path.basename(file).toLowerCase();
  const dir = path.dirname(file);
  try {
    if (low === 'eboot.bin') {
      // PS4/PS5: <game>/eboot.bin + <game>/sce_sys/param.sfo|param.json.  PS3: <game>/PS3_GAME/USRDIR/EBOOT.BIN
      const ps3Root = path.basename(dir).toLowerCase() === 'usrdir' ? path.dirname(dir) : null;
      if (ps3Root) {
        const sfo = await tryRead(path.join(ps3Root, 'PARAM.SFO'));
        const s = sfo && parseSfo(sfo);
        // PIC1.PNG is the game's 1920x1080 XMB background: the game page and backdrop use it.
        return { title: s && s.TITLE, titleId: s && s.TITLE_ID, category: s && s.CATEGORY, icon: await firstExisting([path.join(ps3Root, 'ICON0.PNG'), path.join(ps3Root, 'PIC1.PNG')]), bg: await firstExisting([path.join(ps3Root, 'PIC1.PNG'), path.join(ps3Root, 'PIC0.PNG')]) };
      }
      const sys = path.join(dir, 'sce_sys');
      const json = await tryRead(path.join(sys, 'param.json'));
      if (json) {
        const j = JSON.parse(json.toString('utf8'));
        const loc = j.localizedParameters || {}; const lang = loc.defaultLanguage || 'en-US';
        return { title: (loc[lang] && loc[lang].titleName) || j.titleName, titleId: j.titleId, icon: await firstExisting([path.join(sys, 'icon0.png'), path.join(sys, 'pic0.png')]), ps5: true };
      }
      const sfo = await tryRead(path.join(sys, 'param.sfo'));
      const s = sfo && parseSfo(sfo);
      return { title: s && s.TITLE, titleId: s && s.TITLE_ID, icon: await firstExisting([path.join(sys, 'icon0.png'), path.join(sys, 'pic0.png')]), bg: await firstExisting([path.join(sys, 'pic1.png'), path.join(sys, 'pic0.png')]) };
    }
    if (low === 'appxmanifest.xml') {
      const x = (await fsp.readFile(file, 'utf8'));
      const m = x.match(/<DisplayName>([^<]+)<\/DisplayName>/);
      return { title: m && !m[1].startsWith('ms-resource') ? m[1] : null };
    }
    if (low.endsWith('.iso')) return await pspIsoMeta(file);
  } catch {}
  return null;
}

// PSP UMD images are plain ISO9660: pull PSP_GAME\ICON0.PNG (the game's own 144x80 icon) and the disc ID out of PARAM.SFO.
// The icon is a stand-in (iconSmall): box art from the cover sources still wins when one exists.
async function pspIsoMeta(file) {
  const fh = await fsp.open(file, 'r');
  try {
    const pvd = Buffer.alloc(2048); await fh.read(pvd, 0, 2048, 0x8000);
    if (pvd.toString('latin1', 1, 6) !== 'CD001' || !pvd.toString('latin1', 8, 40).startsWith('PSP GAME')) return null;
    const find = async (lba, size, want) => { // walk one directory's records
      const buf = Buffer.alloc(Math.min(size, 1 << 20)); await fh.read(buf, 0, buf.length, lba * 2048);
      for (let o = 0; o < buf.length;) {
        const len = buf[o]; if (!len) { o = (Math.floor(o / 2048) + 1) * 2048; continue; }
        const name = buf.toString('latin1', o + 33, o + 33 + buf[o + 32]).replace(/;1$/, '');
        if (name.toUpperCase() === want) return { lba: buf.readUInt32LE(o + 2), size: buf.readUInt32LE(o + 10) };
        o += len;
      }
      return null;
    };
    const game = await find(pvd.readUInt32LE(156 + 2), pvd.readUInt32LE(156 + 10), 'PSP_GAME'); if (!game) return null;
    const meta = {};
    const sfoAt = await find(game.lba, game.size, 'PARAM.SFO');
    if (sfoAt && sfoAt.size < 1 << 16) { const b = Buffer.alloc(sfoAt.size); await fh.read(b, 0, b.length, sfoAt.lba * 2048); const s = parseSfo(b); if (s) meta.titleId = s.DISC_ID; }
    // ICON0 is the game's icon; PIC1 is its 480x272 menu background, used behind the icon and as the full-screen backdrop.
    const base = path.join(app.getPath('userData'), 'icons', crypto.createHash('md5').update(file.toLowerCase()).digest('hex'));
    const pull = async (want, out) => {
      const at = await find(game.lba, game.size, want);
      if (at && at.size < 4 << 20 && !fs.existsSync(out)) {
        const b = Buffer.alloc(at.size); await fh.read(b, 0, b.length, at.lba * 2048);
        if (b.subarray(1, 4).toString() === 'PNG') { await fsp.mkdir(path.dirname(out), { recursive: true }); await fsp.writeFile(out, b); }
      }
      return fs.existsSync(out) ? out : null;
    };
    const icon = await pull('ICON0.PNG', base + '.png'); if (icon) { meta.icon = icon; meta.iconSmall = true; }
    const bg = await pull('PIC1.PNG', base + '-bg.png'); if (bg) meta.bg = bg;
    return meta;
  } finally { await fh.close(); }
}

require('./inbox').register({ ipcMain, shell, getWin: () => win });
require('./compat').register({ ipcMain, app, getWin: () => win, x360TitleId });
require('./backup').register({ ipcMain, app, shell });
require('./downloads').register({ ipcMain });
require('./share').register({ ipcMain, getWin: () => win, gameUnit });

// ---------- firmware / BIOS ----------
function md5(file) {
  return new Promise((resolve) => {
    const h = crypto.createHash('md5'); const s = fs.createReadStream(file);
    s.on('data', d => h.update(d)); s.on('end', () => resolve(h.digest('hex'))); s.on('error', () => resolve(null));
  });
}
// item: { file?: 'mcpx_1.0.bin', pattern?: '^scph.*\\.bin$', dir?: true, md5?: '...' }
ipcMain.handle('bios:check', async (_e, { folder, items }) => {
  let listing = [];
  try { listing = await fsp.readdir(folder, { withFileTypes: true }); } catch { return items.map(() => ({ found: false, reason: 'folder' })); }
  return Promise.all(items.map(async it => {
    let match = null;
    if (it.any) return { found: listing.length > 0, path: folder, count: listing.length };
    if (it.file) match = listing.find(e => e.name.toLowerCase() === it.file.toLowerCase());
    else if (it.pattern) { const re = new RegExp(it.pattern, 'i'); match = listing.find(e => re.test(e.name)); }
    if (!match) return { found: false };
    const full = path.join(folder, match.name);
    if (it.dir) {
      let n = 0; try { n = (await fsp.readdir(full)).length; } catch {}
      return { found: n > 0, path: full, count: n, reason: n ? null : 'empty' };
    }
    if (match.isDirectory()) return { found: false, reason: 'isdir' };
    if (it.md5) { const h = await md5(full); return { found: true, path: full, md5ok: h === it.md5.toLowerCase(), md5: h }; }
    return { found: true, path: full };
  }));
});

// ---------- hardware probe ----------
function run(cmd, args, timeout = 8000) {
  return new Promise(res => execFile(cmd, args, { timeout, windowsHide: true }, (err, out) => res(err ? '' : String(out))));
}
// The full probe (nvidia-smi + disk queries) takes several seconds, so startup uses the last saved
// result plus live RAM, and the renderer asks for a fresh probe in the background afterwards.
let hwCache = null;
const HW_FILE = () => path.join(app.getPath('userData'), 'hw-cache.json');
ipcMain.handle('hw:probe', async (_e, opts = {}) => {
  if (opts.fast) {
    const cpus = os.cpus();
    let saved = null; try { saved = JSON.parse(await fsp.readFile(HW_FILE(), 'utf8')); } catch {}
    return { drives: [], gpu: null, vramGB: null, driver: null, ...(saved || {}), cpu: cpus[0] ? cpus[0].model.trim() : 'Unknown CPU', threads: cpus.length,
      ramGB: Math.round(os.totalmem() / 1073741824), freeRamGB: +(os.freemem() / 1073741824).toFixed(1), cached: !!saved };
  }
  if (hwCache) return { ...hwCache, freeRamGB: +(os.freemem() / 1073741824).toFixed(1) };
  const cpus = os.cpus();
  const hw = {
    cpu: cpus[0] ? cpus[0].model.trim() : 'Unknown CPU', threads: cpus.length,
    ramGB: Math.round(os.totalmem() / 1073741824), freeRamGB: +(os.freemem() / 1073741824).toFixed(1),
    gpu: null, vramGB: null, driver: null, drives: [], os: `${os.type()} ${os.release()}`
  };
  const smi = await run('nvidia-smi', ['--query-gpu=name,memory.total,driver_version', '--format=csv,noheader,nounits']);
  if (smi.trim()) { const [n, m, d] = smi.trim().split('\n')[0].split(',').map(s => s.trim()); hw.gpu = n; hw.vramGB = Math.round(+m / 1024); hw.driver = d; }
  if (process.platform === 'win32') {
    const ps = 'Get-Partition | ? DriveLetter | % { $d = Get-PhysicalDisk | ? DeviceId -eq $_.DiskNumber; $v = Get-Volume -DriveLetter $_.DriveLetter; [pscustomobject]@{L=[string]$_.DriveLetter;M=[string]$d.MediaType;B=[string]$d.BusType;N=$d.FriendlyName;S=$v.Size;F=$v.SizeRemaining} } | ConvertTo-Json -Compress';
    const out = await run('powershell.exe', ['-NoProfile', '-Command', ps], 15000);
    try {
      let arr = JSON.parse(out); if (!Array.isArray(arr)) arr = [arr];
      hw.drives = arr.map(d => ({ letter: d.L, media: d.M, bus: d.B, name: d.N, sizeGB: Math.round(d.S / 1073741824), freeGB: Math.round(d.F / 1073741824), kind: driveKind(d.M, d.B) }));
    } catch {}
    if (!hw.gpu) {
      const g = await run('powershell.exe', ['-NoProfile', '-Command', '(Get-CimInstance Win32_VideoController | Sort-Object AdapterRAM -Descending | Select-Object -First 1).Name']);
      hw.gpu = g.trim() || 'Unknown GPU';
    }
  }
  hwCache = hw;
  fsp.writeFile(HW_FILE(), JSON.stringify(hw)).catch(() => {});
  return hw;
});
function driveKind(media, bus) {
  const usb = /usb/i.test(bus);
  if (/nvme/i.test(bus)) return { label: 'NVMe SSD', speed: 3 };
  if (/ssd/i.test(media)) return usb ? { label: 'USB SSD', speed: 2 } : { label: 'SATA SSD', speed: 2 };
  if (/hdd/i.test(media)) return usb ? { label: 'USB HDD', speed: 0 } : { label: 'Hard drive', speed: 1 };
  return { label: usb ? 'USB drive' : 'Drive', speed: 1 };
}
ipcMain.handle('hw:freeRam', () => +(os.freemem() / 1073741824).toFixed(1));

// ---------- launching ----------
// Turns  -g "{rom}" --fullscreen  into an argv array after token substitution. Quotes group, they are not passed through.
function buildArgs(template, tokens) {
  const filled = template.replace(/\{(\w+)\}/g, (m, k) => (k in tokens ? tokens[k] : m));
  const args = []; let cur = ''; let q = false; let has = false;
  for (const ch of filled) {
    if (ch === '"') { q = !q; has = true; continue; }
    if (!q && /\s/.test(ch)) { if (has || cur) args.push(cur); cur = ''; has = false; continue; }
    cur += ch; has = true;
  }
  if (has || cur) args.push(cur);
  return args;
}

ipcMain.handle('emu:launch', async (_e, req) => {
  if (running) return { ok: false, error: 'A game is already running. Close it first.' };
  try { await fsp.access(req.exe); } catch { return { ok: false, error: 'The emulator program was not found. Check its path in Emulators.' }; }
  if (req.rom) { try { await fsp.access(req.rom); } catch { return { ok: false, error: 'The game file is missing. Is its drive plugged in?' }; } }
  const args = buildArgs(req.args || '', { rom: req.rom || '', romdir: req.rom ? path.dirname(req.rom) : '', core: req.core || '', emudir: path.dirname(req.exe) });
  if (!req.rom) { const i = args.indexOf(''); if (i >= 0) args.splice(i, 1); }
  let child;
  try {
    child = spawn(req.exe, req.rom ? args : [], { cwd: path.dirname(req.exe), detached: false, windowsHide: false, env: { ...process.env, ...(req.env || {}) } });
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
  const started = Date.now();
  running = { child, gameId: req.gameId, started };
  let errOut = '';
  child.stderr && child.stderr.on('data', d => { errOut = (errOut + d).slice(-2000); });
  child.on('error', err => { win.webContents.send('game:exit', { gameId: req.gameId, seconds: 0, code: -1, error: err.message }); running = null; restoreWindow(); });
  child.on('exit', code => {
    const seconds = Math.round((Date.now() - started) / 1000);
    running = null;
    win.webContents.send('game:exit', { gameId: req.gameId, seconds, code, error: code && seconds < 5 ? (errOut.trim().split('\n').pop() || `Emulator closed with code ${code}`) : null });
    restoreWindow(req.restoreFullscreen);
  });
  // Give the game the CPU: raise priority and get the launcher out of the way.
  if (req.priority && req.priority !== 'normal') {
    const map = { above: os.constants.priority.PRIORITY_ABOVE_NORMAL, high: os.constants.priority.PRIORITY_HIGH };
    try { os.setPriority(child.pid, map[req.priority]); } catch {}
  }
  if (req.onLaunch === 'minimize') win.minimize();
  else if (req.onLaunch === 'hide') win.hide();
  return { ok: true, args };
});
function restoreWindow() { if (!win) return; if (!win.isVisible()) win.show(); if (win.isMinimized()) win.restore(); win.focus(); }
ipcMain.handle('emu:stop', () => { if (running) { try { running.child.kill(); } catch {} return true; } return false; });
ipcMain.handle('emu:running', () => (running ? { gameId: running.gameId, started: running.started } : null));

// Looks for known emulator executables in the usual places on every drive.
ipcMain.handle('emu:detect', async (_e, catalog) => {
  const roots = [];
  for (const L of 'CDEFGHIJ') { const r = `${L}:\\`; try { await fsp.access(r); roots.push(r); } catch {} }
  const bases = [];
  for (const r of roots) bases.push(r, path.join(r, 'Emulators'), path.join(r, 'Games'), path.join(r, 'Program Files'), path.join(r, 'Program Files (x86)'));
  bases.push(path.join(os.homedir(), 'Desktop'), path.join(os.homedir(), 'Downloads'), path.join(os.homedir(), 'OneDrive', 'Desktop'), path.join(os.homedir(), 'AppData', 'Local', 'Programs'), path.join(os.homedir(), 'Documents'));
  const found = {};
  for (const emu of catalog) {
    const exes = emu.exe.map(s => s.toLowerCase());
    // emu.exe is in order of preference (e.g. PPSSPPWindows64.exe before the 32-bit PPSSPPWindows.exe).
    const pick = names => exes.map(x => names.find(n => n.toLowerCase() === x)).find(Boolean);
    outer: for (const b of bases) {
      let ents; try { ents = await fsp.readdir(b, { withFileTypes: true }); } catch { continue; }
      const top = pick(ents.filter(e => e.isFile()).map(e => e.name));
      if (top) { found[emu.id] = path.join(b, top); break outer; }
      for (const e of ents) {
        if (!e.isDirectory()) continue;
        const sub = path.join(b, e.name);
        if (!emu.hint.some(h => e.name.toLowerCase().includes(h))) continue;
        let inner; try { inner = await fsp.readdir(sub); } catch { continue; }
        const hit = pick(inner);
        if (hit) { found[emu.id] = path.join(sub, hit); break outer; }
      }
    }
  }
  return found;
});

ipcMain.handle('app:icon', () => nativeImage.createFromPath(ICON).isEmpty() ? null : ICON);
