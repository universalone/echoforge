// Tests Import's disc check (app/inbox.js classifyDisc) with small fake disc images held in memory.
// Run: node test/inbox_test.js
const { classifyDisc } = require('../app/inbox');

let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };

// A sparse disc: only the bytes written are stored; everything else reads as zeros.
function disc() {
  const parts = [];
  return {
    put(off, buf) { parts.push([off, Buffer.from(buf)]); },
    read: async (off, len) => { const out = Buffer.alloc(len); for (const [o, b] of parts) { const s = Math.max(off, o), e = Math.min(off + len, o + b.length); if (s < e) b.copy(out, s - off, s - o, e - o); } return out; }
  };
}
// An ISO 9660 volume whose root folder holds one entry with the given name.
function iso(d, entry) {
  const pvd = Buffer.alloc(2048); pvd[0] = 1; pvd.write('CD001', 1, 'latin1'); pvd.fill(0x20, 8, 40);
  pvd.writeUInt32LE(20, 158); pvd.writeUInt32LE(2048, 166); d.put(16 * 2048, pvd);
  const dir = Buffer.alloc(2048), rec = 33 + entry.length + (entry.length % 2 ? 0 : 1);
  dir[0] = rec; dir.writeUInt32LE(30, 2); dir.writeUInt32LE(2048, 10); dir[32] = entry.length; dir.write(entry, 33, 'latin1'); d.put(20 * 2048, dir);
}
const XBOX = 'MICROSOFT*XBOX*MEDIA';

(async () => {
  let d = disc(); iso(d, 'VIDEO_TS'); d.put(0xFDA0000, XBOX);
  let r = await classifyDisc(d.read, 'Game.iso', 7.8e9, false);
  check('Xbox 360 disc with its video section (XGD2) is a game', r.console === 'x360', JSON.stringify(r));

  d = disc(); iso(d, 'VIDEO_TS'); d.put(0x2090000, XBOX);
  r = await classifyDisc(d.read, 'Game.iso', 8.5e9, false);
  check('Xbox 360 disc with its video section (XGD3) is a game', r.console === 'x360', JSON.stringify(r));

  d = disc(); iso(d, 'VIDEO_TS');
  r = await classifyDisc(d.read, 'Movie.iso', 4.4e9, false);
  check('a real DVD video is still not a game', r.console === '?' && /DVD video/.test(r.why), JSON.stringify(r));

  d = disc(); d.put(0x2090000, XBOX);
  r = await classifyDisc(d.read, 'Game.iso', 8.5e9, false);
  check('Xbox 360 disc without a video section', r.console === 'x360', JSON.stringify(r));

  d = disc(); d.put(0x10000, XBOX);
  r = await classifyDisc(d.read, 'Game.iso', 3e9, false);
  check('original Xbox XISO', r.console === 'xbox', JSON.stringify(r));

  d = disc(); iso(d, 'VIDEO_TS'); d.put(0x18310000, XBOX);
  r = await classifyDisc(d.read, 'Game.iso', 7.83e9, false);
  check('full original Xbox disc image (video section first) is a game', r.console === 'xbox' && r.xboxGameAt === 0x18300000, JSON.stringify(r));

  // Keeping only the game part of a file: everything from the offset on, nothing before it.
  const fs = require('fs'), os = require('os'), path = require('path'), { keepFrom } = require('../app/inbox');
  const f = path.join(os.tmpdir(), 'ef-keepfrom-test.iso'), body = Buffer.alloc(5000);
  for (let i = 0; i < body.length; i++) body[i] = i % 251;
  fs.writeFileSync(f, body); await keepFrom(f, 1234);
  check('keeps the file from the game part on', fs.readFileSync(f).equals(body.subarray(1234)));
  fs.rmSync(f, { force: true });

  console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
