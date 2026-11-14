// Tests app/anyps5.js (porting PS5 games with AnyPS5) against a fake game and a stand-in relinker in Temp.
// Run: node test/anyps5_test.js
const fs = require('fs'), path = require('path'), os = require('os');
const a = require('../app/anyps5');

let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const T = path.join(os.tmpdir(), 'ef-anyps5-test'); fs.rmSync(T, { recursive: true, force: true });
const inst = path.join(T, 'AnyPS5'), game = path.join(T, 'Games', 'My Game (PPSA00000)'), ports = path.join(T, 'ports');
fs.mkdirSync(path.join(inst, 'libs'), { recursive: true }); fs.writeFileSync(path.join(inst, 'libs', 'libkernel.prx'), 'lib');
const relinker = path.join(inst, 'relinker.exe'); fs.writeFileSync(relinker, '');
fs.mkdirSync(path.join(game, 'sce_module'), { recursive: true }); fs.mkdirSync(path.join(game, 'sce_sys'));
const eboot = path.join(game, 'eboot.bin'); fs.writeFileSync(eboot, 'elf');

// The stand-in relinker writes the output program and remembers what it was asked.
let calls = [];
const fake = (ok = true) => async (exe, args, cwd) => { calls.push({ exe, args, cwd }); if (ok) fs.writeFileSync(args[args.length - 1], 'exe'); return ok ? { code: 0, out: 'Converted.' } : { code: 2, out: 'reading eboot\nFAIL: Unsupported relocation type 42\n' }; };
const opts = (o = {}) => ({ version: 'relinker 62bd7dd', run: fake(), intel: false, ...o });

(async () => {
  let r = await a.prepare(relinker, eboot, ports, () => {}, opts());
  const dir = a.portDir(ports, game);
  check('a game is ported the first time', r.ok && r.ported && r.exe === path.join(dir, 'app.exe') && fs.existsSync(r.exe), JSON.stringify(r));
  check('the relinker makes a Windows GUI program from the eboot', calls.length === 1 && calls[0].args.join(' ') === `--windows --windows-gui ${eboot} ${path.join(dir, 'app.exe')}` && calls[0].cwd === dir, JSON.stringify(calls[0] && calls[0].args));
  check('app0 is a link to the game folder (nothing copied)', fs.lstatSync(path.join(dir, 'app0')).isSymbolicLink() && fs.existsSync(path.join(dir, 'app0', 'eboot.bin')));
  check('libs is a link to AnyPS5’s libraries', fs.lstatSync(path.join(dir, 'libs')).isSymbolicLink() && fs.existsSync(path.join(dir, 'libs', 'libkernel.prx')));
  check('the port folder is named after the game', path.basename(dir).startsWith('My Game (PPSA00000)-'));
  check('the relinker’s output is kept as a log', fs.readFileSync(path.join(dir, 'relinker.log'), 'utf8') === 'Converted.');

  calls = [];
  r = await a.prepare(relinker, eboot, ports, () => {}, opts());
  check('played again: the port is reused, not made again', r.ok && !r.ported && calls.length === 0);

  calls = [];
  r = await a.prepare(relinker, eboot, ports, () => {}, opts({ version: 'relinker 99aa000' }));
  check('after an AnyPS5 update the game is ported again', r.ok && r.ported && calls.length === 1);

  calls = []; fs.writeFileSync(eboot, 'elf, updated'); const later = Date.now() / 1000 + 5; fs.utimesSync(eboot, later, later);
  r = await a.prepare(relinker, eboot, ports, () => {}, opts({ version: 'relinker 99aa000' }));
  check('after the game changes it’s ported again', r.ok && r.ported && calls.length === 1);

  calls = [];
  r = await a.prepare(relinker, eboot, ports, () => {}, opts({ version: 'relinker 99aa000', intel: true }));
  check('on an Intel processor --to-intel is added', r.ok && calls.length === 1 && calls[0].args.includes('--to-intel'));

  // A failed port says why, in AnyPS5's words, and isn't reused.
  fs.rmSync(path.join(dir, 'app.exe')); calls = [];
  r = await a.prepare(relinker, eboot, ports, () => {}, opts({ version: 'relinker 0000000', run: fake(false) }));
  check('a failed port reports the relinker’s reason', !r.ok && /couldn’t port this game: FAIL: Unsupported relocation type 42/.test(r.error), r.error);
  r = await a.prepare(relinker, eboot, ports, () => {}, opts({ version: 'relinker 0000000', run: fake(true) }));
  check('and the next try ports again', r.ok && r.ported);

  // Things that stop it before porting.
  r = await a.prepare(relinker, path.join(game, 'game.iso'), ports, () => {}, opts());
  check('only an eboot.bin can be ported', !r.ok && /eboot\.bin/.test(r.error));
  r = await a.prepare(relinker, path.join(T, 'Gone', 'eboot.bin'), ports, () => {}, opts());
  check('a missing game says so', !r.ok && /missing/.test(r.error));
  fs.rmSync(path.join(inst, 'libs', 'libkernel.prx'));
  r = await a.prepare(relinker, eboot, ports, () => {}, opts());
  check('without AnyPS5’s libraries it asks for an install', !r.ok && /libraries are missing/.test(r.error));
  fs.writeFileSync(path.join(inst, 'libs', 'libkernel.prx'), 'lib');
  r = await a.prepare(relinker, eboot, ports, () => {}, opts({ version: '' }));
  check('a relinker that doesn’t start asks for an install', !r.ok && /relinker didn’t start/.test(r.error));

  // A link that points somewhere else is corrected.
  fs.unlinkSync(path.join(dir, 'libs')); fs.symlinkSync(game, path.join(dir, 'libs'), 'junction');
  await a.prepare(relinker, eboot, ports, () => {}, opts({ version: 'relinker 0000000', run: fake(true) }));
  check('a link pointing at the wrong folder is fixed', path.resolve(fs.readlinkSync(path.join(dir, 'libs'))).toLowerCase() === path.join(inst, 'libs').toLowerCase());

  // The game's own last log line, for a game that closes at once.
  fs.writeFileSync(path.join(dir, 'anyps5.log'), 'starting\n[libkernel] missing CPU extension: MOVBE\n');
  check('the last line of anyps5.log is read', await a.lastLog(dir) === '[libkernel] missing CPU extension: MOVBE');

  fs.rmSync(T, { recursive: true, force: true });
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
