// Tests reading a PS1/PS2 disc's serial from SYSTEM.CNF (app/inbox.js discSerial, cueTrack) and Import telling a PS2 CD
// from a PS1 one, with small disc images written to a temp folder. Run: node test/disc_serial_test.js
const fs = require('fs'), os = require('os'), path = require('path');
const { discSerial, cueTrack, classifyDisc, reader } = require('../app/inbox');

let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };

// An ISO 9660 volume (2048-byte sectors) whose root holds SYSTEM.CNF with the given text.
function iso(cnf) {
  const b = Buffer.alloc(22 * 2048);
  const pvd = b.subarray(16 * 2048); pvd[0] = 1; pvd.write('CD001', 1, 'latin1'); pvd.write('PLAYSTATION'.padEnd(32), 8, 'latin1');
  pvd.writeUInt32LE(20, 158); pvd.writeUInt32LE(2048, 166);
  const name = 'SYSTEM.CNF;1', dir = b.subarray(20 * 2048), rec = 33 + name.length + (name.length % 2 ? 0 : 1);
  dir[0] = rec; dir.writeUInt32LE(21, 2); dir.writeUInt32LE(cnf.length, 10); dir[32] = name.length; dir.write(name, 33, 'latin1');
  b.write(cnf, 21 * 2048, 'latin1');
  return b;
}
// The same volume as raw 2352-byte CD sectors (mode 2: sync, header, subheader, then the data).
function rawCd(cnf) {
  const plain = iso(cnf), n = plain.length / 2048, b = Buffer.alloc(n * 2352);
  for (let i = 0; i < n; i++) {
    const s = b.subarray(i * 2352); Buffer.from('00ffffffffffffffffffff00', 'hex').copy(s); s[15] = 2;
    plain.copy(s, 24, i * 2048, (i + 1) * 2048);
  }
  return b;
}

(async () => {
  const T = path.join(os.tmpdir(), 'ef-disc-serial-test'); fs.rmSync(T, { recursive: true, force: true }); fs.mkdirSync(T, { recursive: true });
  const put = (name, buf) => { const f = path.join(T, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); return f; };

  let r = await discSerial(put('ps2.iso', iso('BOOT2 = cdrom0:\\SLUS_203.12;1\r\nVER = 1.00\r\n')));
  check('PS2 DVD image: serial and console', r && r.serial === 'SLUS-20312' && r.console === 'ps2', JSON.stringify(r));

  r = await discSerial(put('ps1/Game.bin', rawCd('BOOT = cdrom:\\SCUS_949.00;1\r\nTCB = 4\r\n')));
  check('PS1 raw CD image: serial and console', r && r.serial === 'SCUS-94900' && r.console === 'ps1', JSON.stringify(r));

  put('ps1/Game.cue', 'FILE "Game.bin" BINARY\r\n  TRACK 01 MODE2/2352\r\n    INDEX 01 00:00:00\r\n');
  r = await discSerial(path.join(T, 'ps1', 'Game.cue'));
  check('a .cue is read through its track', r && r.serial === 'SCUS-94900', JSON.stringify(r));

  // A .cue that still names the .bin from before it was renamed.
  put('cd2/Crazy Taxi.bin', rawCd('BOOT2 = cdrom0:\\SLUS_202.02;1\r\n'));
  put('cd2/Crazy Taxi.cue', 'FILE "Crazy Taxi (USA).bin" BINARY\r\n  TRACK 01 MODE2/2352\r\n    INDEX 01 00:00:00\r\n');
  const t = await cueTrack(path.join(T, 'cd2', 'Crazy Taxi.cue'));
  check('a .cue naming a missing .bin uses the folder’s only .bin, and says it’s broken', t && t.broken && path.basename(t.file) === 'Crazy Taxi.bin' && t.named === 'Crazy Taxi (USA).bin', JSON.stringify(t));
  r = await discSerial(path.join(T, 'cd2', 'Crazy Taxi.cue'));
  check('PS2 game on CD: serial says PS2', r && r.serial === 'SLUS-20202' && r.console === 'ps2', JSON.stringify(r));

  // Import: a PlayStation CD that boots with BOOT2 is a PS2 game, not a PS1 one.
  let read = reader(path.join(T, 'cd2', 'Crazy Taxi.bin'));
  r = await classifyDisc(read, 'Crazy Taxi.bin', fs.statSync(path.join(T, 'cd2', 'Crazy Taxi.bin')).size, true);
  check('Import: a PS2 CD is filed as PS2', r.console === 'ps2', JSON.stringify(r));
  read = reader(path.join(T, 'ps1', 'Game.bin'));
  r = await classifyDisc(read, 'Game.bin', fs.statSync(path.join(T, 'ps1', 'Game.bin')).size, true);
  check('Import: a PS1 CD is still PS1', r.console === 'ps1', JSON.stringify(r));

  r = await discSerial(put('nocnf.iso', iso('')));
  check('a disc without a boot line has no serial', r === null, JSON.stringify(r));
  r = await discSerial(put('game.chd', Buffer.alloc(100)));
  check('formats it can’t read give no serial', r === null);
  put('two/a.bin', Buffer.alloc(10)); put('two/b.bin', Buffer.alloc(10)); put('two/x.cue', 'FILE "gone.bin" BINARY\r\n');
  check('a broken .cue with several .bin files isn’t guessed', (await cueTrack(path.join(T, 'two', 'x.cue'))) === null);

  fs.rmSync(T, { recursive: true, force: true });
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
