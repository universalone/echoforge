// Tests Import with real 7-Zip archives made in Temp: the quick list with background checking, the forward-only
// reader, and PS3 games packed as a folder. Skipped when 7-Zip isn't installed.
// Run: node test/inbox_archive_test.js
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const ib = require('../app/inbox');

const Z = ['C:\\Program Files\\7-Zip\\7z.exe', 'C:\\Program Files (x86)\\7-Zip\\7z.exe'].find(p => fs.existsSync(p));
if (!Z) { console.log('7-Zip not installed: skipped'); console.log('ALL PASSED'); process.exit(0); }
let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const T = path.join(os.tmpdir(), 'ef-inbox-archive-test'); fs.rmSync(T, { recursive: true, force: true });
const src = path.join(T, 'src'), inbox = path.join(T, 'inbox'), lib = path.join(T, 'lib');
for (const d of [src, inbox, lib]) fs.mkdirSync(d, { recursive: true });
const old = Date.now() / 1000 - 3600; // older than the "still being written" window
const pack = (arc, cwd, items) => { spawnSync(Z, ['a', '-t7z', '-mx1', path.join(inbox, arc), ...items], { cwd }); fs.utimesSync(path.join(inbox, arc), old, old); };

// An original Xbox disc (XISO): the magic sits 64 KB in, with recognizable bytes further on for the reader test.
const xiso = Buffer.alloc(3 << 20); xiso.write('MICROSOFT*XBOX*MEDIA', 0x10000, 'latin1');
for (let i = 0; i < xiso.length; i += 4096) xiso.writeUInt32LE(i, i + 100); // clear of the magic at 0x10000
fs.writeFileSync(path.join(src, 'Game.iso'), xiso); pack('Xbox Game.7z', src, ['Game.iso']);

// A PS3 game folder with PARAM.SFO (TITLE, TITLE_ID) and a decrypted EBOOT.BIN, plus a readme outside the folder.
function sfo(fields) {
  const keys = Object.keys(fields), kt = 20 + keys.length * 16;
  const ktab = Buffer.from(keys.map(k => k + '\0').join(''), 'latin1'), dt = kt + ktab.length + ((4 - (ktab.length % 4)) % 4);
  const vals = keys.map(k => Buffer.from(fields[k] + '\0', 'utf8')), size = dt + vals.reduce((n, v) => n + v.length + 4, 0);
  const b = Buffer.alloc(size); b.writeUInt32LE(0x46535000, 0); b.writeUInt32LE(0x101, 4); b.writeUInt32LE(kt, 8); b.writeUInt32LE(dt, 12); b.writeUInt32LE(keys.length, 16);
  let ko = 0, dof = 0;
  keys.forEach((k, i) => { const o = 20 + i * 16; b.writeUInt16LE(ko, o); b.writeUInt16LE(0x0204, o + 2); b.writeUInt32LE(vals[i].length, o + 4); b.writeUInt32LE(vals[i].length + 4, o + 8); b.writeUInt32LE(dof, o + 12); ktab.copy(b, kt); vals[i].copy(b, dt + dof); ko += k.length + 1; dof += vals[i].length + 4; });
  return b;
}
const game = path.join(src, 'Racer', 'PS3_GAME');
fs.mkdirSync(path.join(game, 'USRDIR', 'DATA'), { recursive: true });
fs.writeFileSync(path.join(game, 'PARAM.SFO'), sfo({ TITLE: 'Night Racer', TITLE_ID: 'BLUS30001' }));
fs.writeFileSync(path.join(game, 'USRDIR', 'EBOOT.BIN'), Buffer.concat([Buffer.from('SCE\0'), Buffer.alloc(5000, 7)]));
fs.writeFileSync(path.join(game, 'USRDIR', 'DATA', 'TRACK1.BIN'), Buffer.alloc(200000, 3));
fs.writeFileSync(path.join(src, 'Racer', 'PS3_DISC.SFB'), Buffer.alloc(100, 1));
fs.writeFileSync(path.join(src, 'readme.html'), '<p>hi</p>');
pack('Racer (USA).7z', src, ['Racer', 'readme.html']);

// The same folder with an encrypted EBOOT.BIN is refused.
const enc = path.join(src, 'Locked', 'PS3_GAME'); fs.mkdirSync(path.join(enc, 'USRDIR'), { recursive: true });
fs.writeFileSync(path.join(enc, 'PARAM.SFO'), sfo({ TITLE: 'Locked', TITLE_ID: 'BLUS30002' }));
fs.writeFileSync(path.join(enc, 'USRDIR', 'EBOOT.BIN'), Buffer.alloc(100, 0x55));
pack('Locked.7z', src, ['Locked']);

// Password-protected archives: one with readable names, one with the names hidden too.
fs.writeFileSync(path.join(src, 'Secret.iso'), xiso);
spawnSync(Z, ['a', '-t7z', '-mx1', '-pSECRET', '-mhe=off', path.join(inbox, 'Locked Names.7z'), 'Secret.iso'], { cwd: src });
spawnSync(Z, ['a', '-t7z', '-mx1', '-pSECRET', '-mhe=on', path.join(inbox, 'Hidden Names.7z'), 'Secret.iso'], { cwd: src });
for (const n of ['Locked Names.7z', 'Hidden Names.7z']) fs.utimesSync(path.join(inbox, n), old, old);

(async () => {
  // The forward-only reader gives the same bytes as the file itself, reading forward and backward.
  const rd = ib.reader(path.join(inbox, 'Xbox Game.7z'), 'Game.iso');
  const spots = [[0x10000, 20], [1 << 20, 16], [(2 << 20) + 4096, 16], [4096, 16], [(3 << 20) - 16, 16]];
  let same = true; for (const [o, n] of spots) if (!(await rd(o, n)).equals(xiso.subarray(o, o + n))) same = false;
  rd.close();
  check('the archive reader returns the right bytes, forward and back', same);

  // The list comes back at once; each file is checked afterwards and reported.
  let changes = 0; const t = Date.now();
  const first = await ib.scan(inbox, { background: true, onChange: () => changes++ });
  check('the list is shown before any archive is opened', first.items.length === 5 && first.items.every(i => i.status === 'checking') && Date.now() - t < 2000, `${Date.now() - t} ms`);
  for (let i = 0; i < 200 && changes < 5; i++) await new Promise(r => setTimeout(r, 100));
  check('each file reports when it has been checked, password-protected ones too', changes === 5 && Date.now() - t < 15000, `${changes} in ${Date.now() - t} ms`);
  const after = await ib.scan(inbox, { background: true });
  const by = n => after.items.find(i => i.name === n) || {};
  check('Xbox disc inside a 7z', by('Xbox Game.7z').console === 'xbox' && by('Xbox Game.7z').status === 'ready', JSON.stringify(by('Xbox Game.7z').why));
  const racer = by('Racer (USA).7z');
  check('PS3 game folder: title and ID from PARAM.SFO', racer.console === 'ps3' && racer.title === 'Night Racer' && racer.titleId === 'BLUS30001', JSON.stringify([racer.why, racer.title, racer.titleId]));
  for (const n of ['Locked Names.7z', 'Hidden Names.7z']) check(`password-protected archive says so (${n})`, by(n).status === 'unknown' && /Password-protected/.test(by(n).why), by(n).why);
  check('PS3 folder with encrypted data is refused', by('Locked.7z').status === 'unknown' && /encrypted/.test(by('Locked.7z').why), by('Locked.7z').why);

  // Importing the PS3 folder puts "Title [ID]" in the library with every file, and nothing else.
  const r = await ib.importPs3Folder({ ...racer, stem: 'Racer (USA)' }, { dest: lib, minFree: 0, keepFree: 0 }, () => {});
  const out = path.join(lib, 'Night Racer [BLUS30001]');
  check('PS3 folder imported as "Title [ID]"', r.ok && r.dest === out && fs.existsSync(path.join(out, 'PS3_GAME', 'USRDIR', 'EBOOT.BIN')), JSON.stringify(r));
  check('every file arrived, the readme stayed behind', fs.statSync(path.join(out, 'PS3_GAME', 'USRDIR', 'DATA', 'TRACK1.BIN')).size === 200000 && fs.existsSync(path.join(out, 'PS3_DISC.SFB')) && !fs.existsSync(path.join(out, 'readme.html')));
  check('no unpacking folder is left behind', fs.readdirSync(lib).length === 1, fs.readdirSync(lib).join(', '));
  const again = await ib.importPs3Folder({ ...racer, stem: 'Racer (USA)' }, { dest: lib, minFree: 0, keepFree: 0 }, () => {});
  check('a game already in the library is left as it is', again.ok && again.exists);

  // Cancel during an unpack: 7-Zip is ended, the half-written files are removed and the archive stays.
  const mg = by('Xbox Game.7z');
  const glib = path.join(T, 'glib'); fs.mkdirSync(glib);
  ib._setJob({ kids: new Set(), stopped: false });
  const gr = await ib.importGeneric(mg, { dest: glib, minFree: 0, keepFree: 0 }, (p, phase) => { if (phase === 'Unpacking') ib.cancelImport(); }); ib._setJob(null);
  ib._setJob({ kids: new Set(), stopped: true }); // Cancel while the archive is still being listed
  const gl = await ib.importGeneric(mg, { dest: glib, minFree: 0, keepFree: 0 }, () => {}); ib._setJob(null);
  check('Cancel while listing is reported as stopped, not as already added', gl.cancelled && !gl.ok, JSON.stringify(gl));
  check('a cancelled unpack reports it and leaves nothing behind', gr.cancelled && !gr.ok && fs.readdirSync(glib).length === 0 && fs.existsSync(path.join(inbox, 'Xbox Game.7z')), JSON.stringify([gr, fs.readdirSync(glib)]));

  fs.rmSync(T, { recursive: true, force: true });
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
