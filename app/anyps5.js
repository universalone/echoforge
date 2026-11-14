'use strict';
// AnyPS5 (github.com/boykopovar/AnyPS5) doesn't emulate: its relinker turns a PS5 game's decrypted eboot.bin and
// sce_module/ into a native Windows program that runs on AnyPS5's own system libraries. EchoForge ports a game the
// first time it's played and starts the result after that, porting again only when the game or AnyPS5 changes.
//
// The port lives in EchoForge's data folder, not in the game folder, with the layout AnyPS5 expects:
//   app.exe            the ported game
//   libs\   -> a link to AnyPS5's libraries (installed once, shared by every game)
//   app0\   -> a link to the game folder (eboot.bin, sce_sys\, its data), so nothing tens of GB in size is copied
// The links are directory junctions, which need no admin rights. The relinker writes the game's converted modules
// (*.guest.prx) into app0\sce_module, so those few files land in the game's own sce_module folder.
// A ported game is an ordinary program: it runs with your account's permissions and none of the console's sandbox.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');

const STAMP = 'echoforge-port.json';

const relinkerVersion = exe => new Promise(res => execFile(exe, ['--version'], { windowsHide: true, timeout: 20000 }, (err, out) => res(err ? '' : String(out).trim())));
// Converted games use AMD-specific instructions, which Intel processors lack; --to-intel rewrites the ones it finds.
const intel = () => /intel/i.test((os.cpus()[0] || {}).model || '');

// One port folder per game folder, named so it's recognisable.
function portDir(root, gameDir) {
  const id = crypto.createHash('sha1').update(path.resolve(gameDir).toLowerCase()).digest('hex').slice(0, 10);
  const name = path.basename(gameDir).replace(/[^A-Za-z0-9 ._()[\]-]/g, '').trim().slice(0, 40) || 'game';
  return path.join(root, `${name}-${id}`);
}

// A directory junction at `link` pointing at `target`; an old link (or empty folder) there is replaced.
async function junction(link, target) {
  try {
    const st = await fsp.lstat(link);
    if (st.isSymbolicLink() || st.isDirectory()) {
      if (st.isSymbolicLink() && path.resolve(await fsp.readlink(link)).toLowerCase() === path.resolve(target).toLowerCase()) return;
      if (st.isSymbolicLink()) await fsp.unlink(link); else await fsp.rmdir(link); // rmdir only removes an empty folder
    }
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  await fsp.symlink(target, link, 'junction');
}

function run(exe, args, cwd) {
  return new Promise(res => {
    let out = '';
    const p = spawn(exe, args, { cwd, windowsHide: true });
    p.stdout.on('data', d => { out = (out + d).slice(-20000); });
    p.stderr.on('data', d => { out = (out + d).slice(-20000); });
    p.on('error', e => res({ code: -1, out: e.message }));
    p.on('close', code => res({ code, out }));
  });
}

// Readies a game for AnyPS5. relinker: AnyPS5's relinker.exe (its libs\ folder beside it). eboot: the game's eboot.bin.
// root: where ports are kept. Returns { ok, exe, dir, ported } or { ok: false, error }.
// opts (tests): version, run and intel stand in for the relinker and the processor check.
async function prepare(relinker, eboot, root, progress = () => {}, opts = {}) {
  const gameDir = path.dirname(eboot), libs = path.join(path.dirname(relinker), 'libs');
  if (!/^eboot\.bin$/i.test(path.basename(eboot))) return { ok: false, error: 'AnyPS5 needs the game’s eboot.bin.' };
  if (!fs.existsSync(eboot)) return { ok: false, error: 'The game file is missing. Is its drive plugged in?' };
  if (!fs.existsSync(path.join(libs, 'libkernel.prx'))) return { ok: false, error: 'AnyPS5’s libraries are missing. Install or update AnyPS5 on the Emulators page.' };
  const version = opts.version !== undefined ? opts.version : await relinkerVersion(relinker);
  if (!version) return { ok: false, error: 'AnyPS5’s relinker didn’t start. Install or update AnyPS5 on the Emulators page.' };

  const dir = portDir(root, gameDir), exe = path.join(dir, 'app.exe');
  const st = await fsp.stat(eboot), want = { version, eboot: path.resolve(eboot), size: st.size, mtime: Math.round(st.mtimeMs), intel: opts.intel !== undefined ? !!opts.intel : intel() };
  let have = null; try { have = JSON.parse(await fsp.readFile(path.join(dir, STAMP), 'utf8')); } catch {}
  await fsp.mkdir(dir, { recursive: true });
  await junction(path.join(dir, 'libs'), libs);
  await junction(path.join(dir, 'app0'), gameDir);
  if (have && fs.existsSync(exe) && Object.keys(want).every(k => have[k] === want[k])) return { ok: true, exe, dir, ported: false };

  progress('Porting the game for AnyPS5');
  const args = ['--windows', '--windows-gui', ...(want.intel ? ['--to-intel'] : []), eboot, exe];
  const r = await (opts.run || run)(relinker, args, dir);
  if (r.code !== 0 || !fs.existsSync(exe)) {
    const why = r.out.trim().split(/\r?\n/).filter(Boolean).pop() || `the relinker stopped with code ${r.code}`;
    await fsp.writeFile(path.join(dir, 'relinker.log'), r.out).catch(() => {});
    return { ok: false, error: `AnyPS5 couldn’t port this game: ${why}` };
  }
  await fsp.writeFile(path.join(dir, 'relinker.log'), r.out).catch(() => {});
  await fsp.writeFile(path.join(dir, STAMP), JSON.stringify(want, null, 1));
  return { ok: true, exe, dir, ported: true };
}

// The last lines AnyPS5 logged (a --windows-gui program writes anyps5.log beside itself), for an early exit's message.
async function lastLog(dir) {
  try { return (await fsp.readFile(path.join(dir, 'anyps5.log'), 'utf8')).trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] || ''; } catch { return ''; }
}

module.exports = { prepare, portDir, junction, lastLog, STAMP };
