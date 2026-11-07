// Shared games: one PC offers its library over the home network, another picks games and installs them.
// Off until turned on. Needs the pairing code, answers only private network addresses and is read-only.
// The other PC only ever names a game id and file number, so it can't ask for any other file on this PC.
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { pipeline, Transform } = require('stream');

const PORT = +process.env.EF_SHARE_PORT || 47800; // tests use their own port
const MAX_WRONG_CODES = 10, WRONG_CODE_WINDOW = 10 * 60 * 1000;

let server = null, pairCode = '', games = new Map(), tools = new Map(), libFolders = {}, manifests = new Map();
const wrong = new Map(), installs = new Map();

function isPrivate(addr) {
  const a = String(addr || '').replace(/^::ffff:/, '');
  return a === '::1' || /^127\./.test(a) || /^10\./.test(a) || /^192\.168\./.test(a) || /^169\.254\./.test(a) || /^172\.(1[6-9]|2\d|3[01])\./.test(a) || /^f[cd]/i.test(a) || /^fe80:/i.test(a);
}
function sameCode(a, b) { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function newCode() { const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from(crypto.randomBytes(8), b => abc[b % abc.length]).join(''); }
function addresses() { return Object.values(os.networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address); }
const sendJson = (res, code, v) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(v)); };

async function walk(dir, base = dir) {
  const out = [];
  for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p, base));
    else if (e.isFile()) out.push({ abs: p, rel: path.relative(base, p), size: (await fsp.stat(p)).size });
  }
  return out;
}
// An emulator's folder holds saves, caches, firmware and sometimes games too. Those stay behind; only its program and settings go.
const LEAVE_BEHIND = {
  rpcs3: ['dev_flash', 'dev_flash2', 'dev_flash3', 'dev_hdd0', 'dev_hdd1', 'dev_bdvd', 'dev_usb000', 'cache', 'captures', 'games', 'log', 'savestates', 'shaderlog', 'test'],
  xenia: ['cache', 'cache0', 'cache1', 'cache_host', 'content', 'recent.toml'],
  pcsx2: ['bios', 'memcards', 'sstates', 'cache', 'logs', 'covers', 'snaps', 'videos', 'textures'],
  duckstation: ['bios', 'memcards', 'savestates', 'cache', 'covers', 'screenshots', 'videos', 'textures'],
  dolphin: ['User\\Cache', 'User\\GC', 'User\\Wii', 'User\\StateSaves', 'User\\ScreenShots', 'User\\Logs', 'User\\Dump'],
  ppsspp: ['memstick\\PSP\\GAME', 'memstick\\PSP\\SAVEDATA', 'memstick\\PSP\\PPSSPP_STATE', 'memstick\\PSP\\TEXTURES'],
  shadps4: ['sys_modules', 'user'],
  xemu: ['bios', 'mcpx', 'firmware'],
  retroarch: ['system', 'roms', 'roms-cleanup', 'saves', 'states', 'playlists', 'downloads', 'logs', 'thumbnails', 'screenshots', 'recordings']
};
const FIRMWARE_FILE = /(^|[\\/])((scph|mcpx|eeprom)[^\\/]*|[^\\/]*bios[^\\/]*)\.(bin|rom|img)$|\.(qcow2?|sprx)$/i;
const MAX_TOOL_BYTES = 20 * 2 ** 30;
// An emulator sitting loose on the Desktop or in Downloads doesn't get that whole folder offered.
function toolDirOk(dir) {
  const p = path.parse(dir), low = path.resolve(dir).toLowerCase();
  if (low === p.root.toLowerCase() || low === os.homedir().toLowerCase()) return false;
  return !['desktop', 'downloads', 'documents', 'onedrive', 'programs', 'program files', 'program files (x86)', 'programdata', 'users', 'windows', 'temp'].includes(path.basename(low));
}
async function toolManifest(t) {
  const dir = t.dir || path.dirname(t.path);
  if (!toolDirOk(dir)) return null;
  const skip = [...(LEAVE_BEHIND[t.emu] || []), ...(t.bios || []).map(b => path.relative(dir, b.dir))].map(x => x.toLowerCase());
  const files = (await walk(dir)).filter(f => { const r = f.rel.toLowerCase(); return !r.endsWith('.log') && !FIRMWARE_FILE.test(r) && !(t.emu === 'xemu' && r.endsWith('.bin')) && !skip.some(x => r === x || r.startsWith(x + path.sep)); });
  if (files.reduce((n, f) => n + f.size, 0) > MAX_TOOL_BYTES) return null;
  return { dirName: t.dirName || path.basename(dir), launch: t.path ? path.relative(dir, t.path) : '', sourceDir: dir, files };
}
// Every file a game needs: a game folder goes whole, a disc image goes with its tracks.
async function manifestOf(id, gameUnit) {
  if (manifests.has(id)) return manifests.get(id);
  if (tools.has(id)) { const m = await toolManifest(tools.get(id)); manifests.set(id, m); return m; }
  const g = games.get(id); if (!g) return null;
  const u = await gameUnit(g.path, libFolders[g.console] || []);
  const m = u.dir
    ? { dirName: path.basename(u.dir), launch: u.rel, files: await walk(u.dir) }
    : { dirName: '', launch: path.basename(g.path), files: await Promise.all(u.files.map(async f => ({ abs: f, rel: path.basename(f), size: (await fsp.stat(f)).size }))) };
  manifests.set(id, m);
  return m;
}

function handler(gameUnit) {
  return async (req, res) => {
    const ip = req.socket.remoteAddress;
    if (!isPrivate(ip)) return sendJson(res, 403, { error: 'Home network only.' });
    const w = wrong.get(ip);
    if (w && Date.now() - w.at > WRONG_CODE_WINDOW) wrong.delete(ip);
    if (wrong.has(ip) && wrong.get(ip).n >= MAX_WRONG_CODES) return sendJson(res, 429, { error: 'Too many wrong codes. Try again in a few minutes.' });
    if (!sameCode(req.headers['x-ef-code'], pairCode)) { wrong.set(ip, { n: (wrong.get(ip)?.n || 0) + 1, at: Date.now() }); return sendJson(res, 401, { error: 'Wrong code.' }); }
    wrong.delete(ip);
    try {
      const url = req.url.split('?')[0].split('/').map(decodeURIComponent);
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'Read only.' });
      if (url[1] === 'games' && !url[2]) return sendJson(res, 200, { name: os.hostname(), games: [...games.values()].map(({ id, console: cid, title, size, titleId }) => ({ id, console: cid, title, size, titleId })) });
      if (url[1] === 'tools') {
        const out = [];
        for (const t of tools.values()) {
          const m = await manifestOf(t.id, gameUnit).catch(() => null); if (!m) continue;
          out.push({ id: t.id, kind: t.kind, emu: t.emu, name: t.name, consoles: t.consoles, size: m.files.reduce((n, f) => n + f.size, 0), files: m.files.length });
        }
        return sendJson(res, 200, { tools: out });
      }
      if (url[1] === 'games' && url[3] === 'manifest') {
        const m = await manifestOf(url[2], gameUnit); if (!m) return sendJson(res, 404, { error: 'That game isn’t shared.' });
        return sendJson(res, 200, { dirName: m.dirName, launch: m.launch, sourceDir: m.sourceDir, files: m.files.map(f => ({ rel: f.rel, size: f.size })) });
      }
      if (url[1] === 'file') {
        const m = await manifestOf(url[2], gameUnit), f = m && m.files[Number(url[3])];
        if (!f) return sendJson(res, 404, { error: 'That file isn’t shared.' });
        const size = (await fsp.stat(f.abs)).size, hash = crypto.createHash('sha256');
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'x-size': String(size), Trailer: 'x-sha256' });
        const tap = new Transform({
          transform(chunk, _e, cb) { hash.update(chunk); cb(null, chunk); },
          flush(cb) { res.addTrailers({ 'x-sha256': hash.digest('hex') }); cb(); }
        });
        return pipeline(fs.createReadStream(f.abs), tap, res, () => {});
      }
      sendJson(res, 404, { error: 'Not found.' });
    } catch (e) { if (!res.headersSent) sendJson(res, 500, { error: e.message }); else res.destroy(); }
  };
}

function stopHost() { return new Promise(ok => { if (!server) return ok(); server.close(() => ok()); server.closeAllConnections?.(); server = null; }); }
async function startHost(gameUnit) {
  if (server) return { ok: true };
  return new Promise(ok => {
    const s = http.createServer(handler(gameUnit));
    s.on('error', e => { server = null; ok({ ok: false, error: e.code === 'EADDRINUSE' ? `Port ${PORT} is already in use on this PC.` : e.message }); });
    s.listen(PORT, '0.0.0.0', () => { server = s; ok({ ok: true }); });
  });
}

// ---------- the PC that installs ----------
function target(host) { const m = String(host || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').match(/^(.+?)(?::(\d+))?$/); return { host: m ? m[1] : '', port: m && m[2] ? +m[2] : PORT }; }
function friendly(e) {
  if (/ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|timed out/i.test(e.code || e.message)) return 'That PC isn’t answering. Check EchoForge is open there with sharing turned on, and that Windows Firewall allowed it.';
  if (/ENOTFOUND|EAI_AGAIN/i.test(e.code || e.message)) return 'Can’t find a PC with that name. Try its address instead, like 192.168.1.33.';
  return e.message;
}
function request(host, code, urlPath, timeout = 8000) {
  const t = target(host);
  return new Promise((ok, bad) => {
    const req = http.get({ host: t.host, port: t.port, path: urlPath, headers: { 'x-ef-code': code } }, res => ok({ res, req }));
    req.setTimeout(timeout, () => req.destroy(new Error('timed out')));
    req.on('error', bad);
  });
}
async function getJson(host, code, urlPath) {
  const { res } = await request(host, code, urlPath);
  const chunks = []; for await (const c of res) chunks.push(c);
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  if (res.statusCode !== 200) throw new Error(body.error || `The other PC answered ${res.statusCode}.`);
  return body;
}
// Some emulators save full paths in their settings. Point those at this PC.
const CONFIG_FILE = /\.(ini|toml|ya?ml|json|cfg|conf|xml)$/i;
async function repointConfigs(root, from) {
  const forms = [from, from.replace(/\\/g, '/'), from.replace(/\\/g, '\\\\')], tos = [root, root.replace(/\\/g, '/'), root.replace(/\\/g, '\\\\')];
  const res = forms.map(f => new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
  for (const f of await walk(root)) {
    if (!CONFIG_FILE.test(f.rel) || f.size > 2 * 2 ** 20) continue;
    const was = await fsp.readFile(f.abs, 'utf8');
    let now = was; res.forEach((re, i) => { now = now.replace(re, () => tos[i]); });
    if (now !== was) await fsp.writeFile(f.abs, now);
  }
}
async function freeBytes(dir) { let d = dir; while (d && !fs.existsSync(d)) d = path.dirname(d) === d ? null : path.dirname(d); if (!d) return 0; const s = await fsp.statfs(d); return s.bavail * s.bsize; }
// Names come from the other PC, so nothing may land outside the game's folder.
function safeJoin(root, rel) {
  const to = path.resolve(root, rel), base = path.resolve(root);
  if (path.isAbsolute(rel) || !to.toLowerCase().startsWith(base.toLowerCase() + path.sep)) throw new Error('The other PC sent an unsafe file name, so nothing was installed.');
  return to;
}
async function fetchFile(job, urlPath, to, size, onBytes) {
  const part = to + '.part';
  await fsp.mkdir(path.dirname(to), { recursive: true });
  const { res, req } = await request(job.host, job.code, urlPath, 60000);
  job.req = req;
  if (res.statusCode !== 200) { res.resume(); throw new Error(`The other PC answered ${res.statusCode}.`); }
  const hash = crypto.createHash('sha256'); let got = 0;
  const tap = new Transform({ transform(chunk, _e, cb) { hash.update(chunk); got += chunk.length; onBytes(chunk.length); cb(null, chunk); } });
  try {
    await new Promise((ok, bad) => pipeline(res, tap, fs.createWriteStream(part), e => e ? bad(e) : ok()));
    if (job.cancelled) throw new Error('Cancelled.');
    if (got !== size || res.trailers['x-sha256'] !== hash.digest('hex')) throw new Error('A file didn’t match the original, so it wasn’t kept.');
    await fsp.rename(part, to);
  } catch (e) { await fsp.rm(part, { force: true }).catch(() => {}); throw e; }
}

function register({ ipcMain, getWin, gameUnit }) {
  const send = (ch, v) => { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send(ch, v); };
  ipcMain.handle('share:info', () => ({ name: os.hostname(), addresses: addresses(), port: PORT, on: !!server }));
  ipcMain.handle('share:newCode', () => newCode());
  ipcMain.handle('share:toolsBase', () => path.join(process.env.LOCALAPPDATA || os.homedir(), 'Programs'));
  ipcMain.handle('share:host', async (_e, { on, code, list, folders, toolList }) => {
    pairCode = code || ''; libFolders = folders || {}; manifests = new Map();
    games = new Map((list || []).map(g => [g.id, g]));
    tools = new Map((toolList || []).map(t => [t.id, t]));
    if (!on || !pairCode) { await stopHost(); return { ok: true, on: false }; }
    const r = await startHost(gameUnit);
    return { ...r, on: !!server };
  });
  ipcMain.handle('share:list', async (_e, { host, code }) => {
    try { return { ok: true, ...await getJson(host, code, '/games') }; } catch (e) { return { ok: false, error: friendly(e) }; }
  });
  // An older EchoForge on the other PC has no emulators to offer, which is fine: games still work.
  ipcMain.handle('share:tools', async (_e, { host, code }) => {
    try { return { ok: true, ...await getJson(host, code, '/tools') }; } catch (e) { return { ok: false, tools: [], error: friendly(e) }; }
  });
  // o: { host, code, id, destDir, minFreeGB, tool }. Files are verified one by one, so a stopped install picks up where it left off.
  // An emulator never replaces a file already on this PC.
  ipcMain.handle('share:install', async (_e, o) => {
    const job = { host: o.host, code: o.code, cancelled: false, req: null };
    installs.set(o.id, job);
    try {
      const id = encodeURIComponent(o.id), m = await getJson(o.host, o.code, `/games/${id}/manifest`);
      const root = m.dirName ? safeJoin(o.destDir, m.dirName) : o.destDir;
      const plan = m.files.map(f => ({ ...f, to: safeJoin(root, f.rel) }));
      const launch = m.launch ? safeJoin(root, m.launch) : root, total = plan.reduce((n, f) => n + f.size, 0);
      let done = 0, last = 0;
      const todo = [];
      for (let i = 0; i < plan.length; i++) {
        const st = await fsp.stat(plan[i].to).catch(() => null);
        if (st && (o.tool || st.size === plan[i].size)) done += plan[i].size; else todo.push(i);
      }
      const need = todo.reduce((n, i) => n + plan[i].size, 0), minFree = (o.minFreeGB ?? 15) * 2 ** 30;
      if (await freeBytes(o.destDir) - need < minFree) return { ok: false, error: `Not enough space: needs ${(need / 2 ** 30).toFixed(1)} GB plus ${(minFree / 2 ** 30).toFixed(0)} GB spare.` };
      const report = n => { done += n; if (Date.now() - last > 400) { last = Date.now(); send('share:progress', { id: o.id, pct: total ? Math.floor(done / total * 100) : 100, done, total }); } };
      report(0);
      for (const i of todo) {
        if (job.cancelled) throw new Error('Cancelled.');
        await fetchFile(job, `/file/${id}/${i}`, plan[i].to, plan[i].size, report);
      }
      if (o.tool && m.sourceDir) await repointConfigs(root, m.sourceDir);
      return { ok: true, path: m.launch ? launch : '', dest: root, bytes: total };
    } catch (e) { return { ok: false, cancelled: job.cancelled, error: job.cancelled ? 'Cancelled.' : friendly(e) }; }
    finally { installs.delete(o.id); }
  });
  ipcMain.handle('share:cancel', (_e, id) => { const j = installs.get(id); if (j) { j.cancelled = true; if (j.req) j.req.destroy(new Error('Cancelled.')); } return true; });
}

module.exports = { register };
