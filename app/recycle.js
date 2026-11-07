'use strict';
// Sending things to the Recycle Bin. Windows permanently deletes anything over a drive's bin limit and shell.trashItem still reports
// success, so everything recycled goes through binProblem first. An unknown limit counts as no room.
const path = require('path');
const fsp = require('fs').promises;
const { execFile } = require('child_process');

const BIN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\BitBucket';
const run = (cmd, args) => new Promise(res => execFile(cmd, args, { timeout: 8000, windowsHide: true }, (e, out) => res(e ? '' : String(out))));
const dword = async (key, name) => { const m = (await run('reg', ['query', key, '/v', name])).match(/REG_DWORD\s+0x([0-9a-f]+)/i); return m ? parseInt(m[1], 16) : null; };
const gb = b => (b / 1024 ** 3).toFixed(1);

async function tally(p) { // bytes + file count of a file or folder tree
  const st = await fsp.stat(p);
  if (!st.isDirectory()) return { bytes: st.size, files: 1 };
  let bytes = 0, files = 0;
  for (const e of await fsp.readdir(p, { withFileTypes: true })) { const t = await tally(path.join(p, e.name)); bytes += t.bytes; files += t.files; }
  return { bytes, files };
}

// Why these paths (all on one drive) can't safely go to the bin, or null when they can. Keeps a 10% margin under the limit.
async function binProblem(paths, bytes) {
  const drive = path.parse(paths[0]).root.slice(0, 2);
  const guid = /^[a-z]:$/i.test(drive) && ((await run('mountvol', [drive + '\\', '/L'])).match(/\{[0-9a-f-]+\}/i) || [])[0];
  if (!guid) return `EchoForge can’t tell whether ${drive || 'that location'} has a Recycle Bin, so nothing was touched.`;
  const vol = BIN_KEY + '\\Volume\\' + guid, mb = await dword(vol, 'MaxCapacity');
  if (await dword(vol, 'NukeOnDelete') === 1 || await dword(BIN_KEY, 'NukeOnDelete') === 1) return `The Recycle Bin on ${drive} is set to delete files right away, so nothing was touched.`;
  if (mb === null) return `EchoForge can’t read the size of the Recycle Bin on ${drive}, so nothing was touched.`;
  if (bytes === undefined) { bytes = 0; for (const p of paths) bytes += (await tally(p)).bytes; }
  const room = Math.floor(mb * 1024 ** 2 * 0.9);
  return bytes > room ? `It’s ${gb(bytes)} GB and the Recycle Bin on ${drive} safely holds ${gb(room)} GB. Windows would delete it for good instead of recycling it, so nothing was touched. Make the bin bigger in its Properties, or delete it by hand.` : null;
}

// All of the paths or none of them, as far as the size check goes. { ok } or { ok: false, error, recycled }.
async function recycleAll(shell, paths) {
  const done = [];
  try {
    const problem = await binProblem(paths);
    if (problem) return { ok: false, error: problem, recycled: done };
    for (const p of paths) { await shell.trashItem(p); done.push(p); }
    return { ok: true, recycled: done };
  } catch (e) { return { ok: false, error: e.message, recycled: done }; }
}

module.exports = { tally, binProblem, recycleAll };
