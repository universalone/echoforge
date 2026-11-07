'use strict';
// Downloads drive: when the drive holding Windows' Downloads folder runs low, point Downloads at a folder on another
// drive (D:\Downloads by default), so browsers save new downloads straight there. This is the same per-user setting
// as Downloads → Properties → Location in Explorer; nothing already downloaded is moved, and it can be switched back.
const { execFile } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');

const KEY_USER = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders';
const KEY_SHELL = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Shell Folders';
const DOWNLOADS = '{374DE290-123F-4565-9164-39C4925E467B}';

const reg = args => new Promise(res => execFile('reg.exe', args, { windowsHide: true }, (err, out) => res(err ? null : out)));
const expand = p => p.replace(/%([^%]+)%/g, (m, v) => process.env[v] ?? m);

async function current() {
  const out = await reg(['query', KEY_USER, '/v', DOWNLOADS]);
  const m = out && out.match(/REG_(?:EXPAND_)?SZ\s+(.+)/);
  return m ? expand(m[1].trim()) : path.join(os.homedir(), 'Downloads');
}

async function freeGB(dir) {
  let d = dir; while (d && !fs.existsSync(d)) d = path.dirname(d) === d ? null : path.dirname(d);
  if (!d) return null;
  try { const s = await fsp.statfs(d); return s.bavail * s.bsize / 2 ** 30; } catch { return null; }
}

const driveOf = p => path.parse(path.resolve(p)).root.toUpperCase();

async function setFolder(folder) {
  folder = path.resolve(folder);
  await fsp.mkdir(folder, { recursive: true });
  const a = await reg(['add', KEY_USER, '/v', DOWNLOADS, '/t', 'REG_EXPAND_SZ', '/d', folder, '/f']);
  const b = await reg(['add', KEY_SHELL, '/v', DOWNLOADS, '/t', 'REG_SZ', '/d', folder, '/f']);
  return a !== null && b !== null && (await current()).toLowerCase() === folder.toLowerCase();
}

async function status(target) {
  const folder = await current();
  return { folder, free: await freeGB(folder), target, targetFree: target ? await freeGB(target) : null };
}

// o: { enabled, thresholdGB, target } -> { switched?, from, to, free, error? }
async function check(o) {
  const s = await status(o.target);
  if (!o.enabled || !o.target || s.free == null || s.free >= o.thresholdGB) return { ...s };
  if (driveOf(s.folder) === driveOf(o.target)) return { ...s }; // already on the target drive
  if (s.targetFree != null && s.targetFree < o.thresholdGB) return { ...s, error: `${driveOf(o.target)} is low on space too` };
  if (!fs.existsSync(driveOf(o.target))) return { ...s, error: `${driveOf(o.target)} isn't connected` };
  const ok = await setFolder(o.target);
  return ok ? { switched: true, from: s.folder, to: path.resolve(o.target), free: s.free } : { ...s, error: 'Windows didn’t accept the new Downloads folder' };
}

function register({ ipcMain }) {
  ipcMain.handle('downloads:status', (_e, target) => status(target));
  ipcMain.handle('downloads:check', (_e, o) => check(o));
  ipcMain.handle('downloads:set', async (_e, folder) => ({ ok: await setFolder(folder), folder: await current() }));
}

module.exports = { register, current, check, setFolder };
