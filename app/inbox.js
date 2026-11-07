'use strict';
// Import folder: finds game archives and disc images in the folder you choose, works out the console from the disc data itself
// (never the file name), unpacks into that console's library folder, checks every file, then recycles the archive.
// Programs and shortcuts in the folder are never run: they're flagged, and shortcuts and screensavers are recycled.
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const zlib = require('zlib');
const { spawn } = require('child_process');
const { recycleAll } = require('./recycle');

const ARCHIVE_EXT = new Set(['.7z', '.zip', '.rar']);
const DISC_EXT = new Set(['.iso', '.cso', '.bin', '.img', '.rvz', '.gcm', '.ciso', '.gcz', '.wbfs', '.chd', '.xiso']);
const LOOSE_EXT = new Set(['.iso', '.cso', '.rvz', '.gcm', '.ciso', '.gcz', '.wbfs', '.xiso', '.pkg']); // single-file games
const PARTIAL_EXT = new Set(['.crdownload', '.part', '.partial', '.download', '.opdownload', '.tmp']);
const RISKY_EXT = new Set(['.exe', '.msi', '.lnk', '.url', '.scr', '.bat', '.cmd', '.com', '.pif', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.hta', '.ps1']);
const JUNK_INSIDE = /\.(txt|nfo|html?|url|dvd|jpe?g|png|sfv|md5)$/i; // readme/site files packed next to the disc
// Shortcuts and screensavers aren't games.
const autoRecycle = name => /\.(lnk|scr|pif)$/i.test(name);

const CD_SYNC = Buffer.from('00ffffffffffffffffffff00', 'hex');
const sevenZip = () => ['C:\\Program Files\\7-Zip\\7z.exe', 'C:\\Program Files (x86)\\7-Zip\\7z.exe'].find(p => fs.existsSync(p)) || null;

function run(exe, args, onLine) {
  return new Promise(res => {
    let out = '';
    const p = spawn(exe, args, { windowsHide: true });
    p.stdout.on('data', d => { const s = d.toString('utf8'); out += s; if (onLine) onLine(s); });
    p.stderr.on('data', d => { out += d.toString('utf8'); });
    p.on('error', e => res({ code: -1, out: e.message }));
    p.on('close', code => res({ code, out }));
  });
}

async function listing(arc, extra) {
  const { out } = await run(sevenZip(), ['l', '-slt', ...(extra || []), arc]);
  // 7-Zip prints a block per archive layer (a split set shows the Split, then the 7z inside it), then "----------"
  // and the files of the innermost one. Only that last part is the archive's contents.
  const lines = out.split(/\r?\n/), sep = lines.lastIndexOf('----------');
  if (sep < 0) return [];
  const files = []; let cur = null;
  for (const line of lines.slice(sep + 1)) {
    if (line.startsWith('Path = ')) { if (cur) files.push(cur); cur = { path: line.slice(7) }; }
    else if (cur && line.includes(' = ')) { const i = line.indexOf(' = '); cur[line.slice(0, i)] = line.slice(i + 3); }
  }
  if (cur) files.push(cur);
  return files.filter(f => f.Folder !== '+').map(f => ({ path: f.path, size: +f.Size || 0 }));
}

// Reads bytes [off, off+len) of a file inside an archive by streaming it out of 7-Zip and stopping early.
function streamRead(arc, inner, off, len, extra = []) {
  return new Promise(res => {
    const p = spawn(sevenZip(), ['e', '-so', ...extra, arc, inner], { windowsHide: true });
    const buf = Buffer.alloc(len); let pos = 0, got = 0, done = false;
    const finish = () => { if (done) return; done = true; try { p.kill(); } catch {} res(buf.subarray(0, got)); };
    p.stdout.on('data', ch => {
      const s = Math.max(0, off - pos), e = Math.min(ch.length, off + len - pos);
      if (e > s) { ch.copy(buf, got, s, e); got += e - s; }
      pos += ch.length; if (pos >= off + len) finish();
    });
    p.on('close', finish); p.on('error', finish);
  });
}
// A random-access reader over a loose file or one file inside an archive (the first MB is fetched once and reused).
function reader(file, inner, extra = []) {
  if (!inner) return async (off, len) => { const fh = await fsp.open(file, 'r'); try { const b = Buffer.alloc(len); const { bytesRead } = await fh.read(b, 0, len, off); return b.subarray(0, bytesRead); } finally { await fh.close(); } };
  let head = null; const HEAD = 1 << 20;
  return async (off, len) => {
    if (off + len <= HEAD) { head = head || await streamRead(file, inner, 0, HEAD, extra); return head.subarray(off, off + len); }
    return streamRead(file, inner, off, len, extra);
  };
}
// 2048-byte sectors of a plain ISO, or of a CSO (zlib-compressed ISO used for PSP and PS2).
function sectors(read, isCso) {
  if (!isCso) return (lba, n = 1) => read(lba * 2048, n * 2048);
  let hdr = null;
  return async (lba, n = 1) => {
    hdr = hdr || await read(0, 24);
    const bs = hdr.readUInt32LE(16), align = hdr[21], parts = [];
    for (let s = lba * 2048; s < (lba + n) * 2048; s += bs) {
      const blk = Math.floor(s / bs), idx = await read(24 + blk * 4, 8);
      const a = idx.readUInt32LE(0), b = idx.readUInt32LE(4);
      const from = (a & 0x7fffffff) * 2 ** align, to = (b & 0x7fffffff) * 2 ** align;
      const raw = await read(from, to - from);
      let data; try { data = a & 0x80000000 ? raw : zlib.inflateRawSync(raw); } catch { return Buffer.alloc(0); }
      parts.push(data.subarray(s % bs, s % bs + 2048));
    }
    return Buffer.concat(parts);
  };
}
async function isoFind(sec, dirLba, dirSize, want) {
  const buf = await sec(dirLba, Math.ceil(Math.min(dirSize, 1 << 16) / 2048));
  for (let o = 0; o < buf.length;) {
    const len = buf[o]; if (!len) { o = (Math.floor(o / 2048) + 1) * 2048; continue; }
    const name = buf.toString('latin1', o + 33, o + 33 + buf[o + 32]).replace(/;1$/, '');
    if (name.toUpperCase() === want) return { lba: buf.readUInt32LE(o + 2), size: buf.readUInt32LE(o + 10) };
    o += len;
  }
  return null;
}

// What console a disc image is for. read(off, len) reads the image; total is its size in bytes.
async function classifyDisc(read, name, total, isCD) {
  const ext = path.extname(name).toLowerCase();
  if (isCD) { // raw 2352-byte CD sectors: PVD system id at sector 16, after the 24-byte sector header
    const b = await read(16 * 2352 + 24 + 8, 32);
    return b.toString('latin1').includes('PLAYSTATION') ? { console: 'ps1', why: 'PlayStation CD' } : { console: '?', why: 'CD image of another system' };
  }
  let b = await read(0, 0x10000);
  if (b.length > 12 && b.subarray(0, 12).equals(CD_SYNC)) return classifyDisc(read, name, total, true); // lone .bin with raw sectors
  if (b.toString('latin1', 0, 4) === 'WBFS' || ext === '.wbfs') return { console: 'wii', why: 'Wii disc (WBFS)' };
  if (['RVZ\x01', 'WIA\x01'].includes(b.toString('latin1', 0, 4))) { const t = b.readUInt32BE(0x48); return t === 1 ? { console: 'gc', why: 'GameCube disc (RVZ)' } : t === 2 ? { console: 'wii', why: 'Wii disc (RVZ)' } : { console: '?', why: 'RVZ image' }; }
  const isCso = b.toString('latin1', 0, 4) === 'CISO' && b.readUInt32LE(16) === 2048 && b.readUInt32LE(4) === 0x18;
  if (b.toString('latin1', 0, 4) === 'CISO' && !isCso) b = b.subarray(0x8000); // Dolphin's compact ISO: block map, then the disc
  if (!isCso) {
    if (b.toString('latin1', 0, 0x1000).includes('PlayStation3') || b.includes('PS3VOLUME')) return { console: 'ps3', why: 'PS3 disc' };
    if (b.length > 0x20 && b.readUInt32BE(0x1C) === 0xC2339F3D) return { console: 'gc', why: 'GameCube disc' };
    if (b.length > 0x20 && b.readUInt32BE(0x18) === 0x5D1C9EA3) return { console: 'wii', why: 'Wii disc' };
  }
  const sec = sectors(read, isCso);
  const pvd = isCso ? await sec(16) : b.subarray(0x8000, 0x8800);
  if (pvd.length >= 190 && pvd.toString('latin1', 1, 6) === 'CD001') {
    const sys = pvd.toString('latin1', 8, 40).trim();
    if (sys.startsWith('PSP GAME')) return { console: 'psp', why: 'PSP UMD' };
    // PS2 discs boot with "BOOT2" in SYSTEM.CNF, PS1 discs with "BOOT". Some (bonus discs) leave the system id blank.
    const cnf = await isoFind(sec, pvd.readUInt32LE(158), pvd.readUInt32LE(166), 'SYSTEM.CNF');
    const txt = cnf ? (await sec(cnf.lba)).toString('latin1', 0, Math.min(cnf.size, 2048)) : '';
    if (/BOOT2/i.test(txt) || (sys.startsWith('PLAYSTATION') && !txt && total > 700 * 2 ** 20)) return { console: 'ps2', why: 'PlayStation 2 disc' };
    if (/BOOT/i.test(txt) || sys.startsWith('PLAYSTATION')) return { console: 'ps1', why: 'PlayStation disc' };
    if (await isoFind(sec, pvd.readUInt32LE(158), pvd.readUInt32LE(166), 'VIDEO_TS')) return { console: '?', why: 'DVD video (a movie or bonus disc), not a game' };
  }
  if (!isCso) { const x = await read(0x10000, 20); if (x.toString('latin1') === 'MICROSOFT*XBOX*MEDIA') return { console: 'xbox', why: 'Xbox disc (XISO)' }; }
  if (total >= 7e9) for (const off of [0xFDA0000, 0x2090000]) { const x = await read(off, 20); if (x.toString('latin1') === 'MICROSOFT*XBOX*MEDIA') return { console: 'x360', why: 'Xbox 360 disc' }; }
  if (ext === '.cso') return { console: 'psp', why: 'Compressed PSP image' };
  return { console: '?', why: 'Not a disc format EchoForge knows' };
}
async function classifyPkg(read) {
  const b = await read(0, 0x1000);
  const cid = (b.toString('latin1').match(/[A-Z]{2}\d{4}-[A-Z]{4}\d{5}_00-[A-Z0-9]{16}/) || [])[0] || '';
  const con = { '\x7fPKG': 'ps3', '\x7fCNT': 'ps4' }[b.toString('latin1', 0, 4)] || '?';
  return { console: con, why: con === '?' ? 'Unknown package' : `${con.toUpperCase()} digital game`, contentId: cid };
}

// Archives split into parts. 7-Zip opens the whole set from its first part:
//   Game.7z.001, .002 …   Game.part1.rar, .part2.rar …   Game.rar + Game.r00, .r01 …   Game.001, .002 … (raw split)
function partOf(name) {
  let m;
  if ((m = name.match(/^(.*\.(?:7z|zip|rar|iso))\.(\d{3})$/i)) || (m = name.match(/^(.*)\.(\d{3})$/))) return { set: m[1], n: +m[2] };
  if ((m = name.match(/^(.*)\.part(\d+)\.rar$/i))) return { set: m[1] + '.rar', n: +m[2] };
  if ((m = name.match(/^(.*)\.r(\d{2})$/i))) return { set: m[1] + '.rar', n: +m[2] + 2, old: true }; // .rar is part 1, .r00 part 2
  return null;
}
// files: [{ name, file, st }] -> Map(set name -> { first, parts: [...] , missing }) for every multi-part set in the folder.
function partSets(files) {
  const sets = new Map(), add = (k, f, n) => { if (!sets.has(k.toLowerCase())) sets.set(k.toLowerCase(), { name: k, parts: [] }); sets.get(k.toLowerCase()).parts.push({ ...f, n }); };
  for (const f of files) { const p = partOf(f.name); if (p) add(p.set, f, p.n); }
  for (const f of files) if (/\.rar$/i.test(f.name) && !/\.part\d+\.rar$/i.test(f.name) && sets.has(f.name.toLowerCase())) add(f.name, f, 1); // old-style first part
  for (const [k, s] of sets) {
    s.parts.sort((a, b) => a.n - b.n);
    s.first = s.parts.find(p => p.n === 1) || null;
    s.missing = []; for (let i = 1; i <= s.parts[s.parts.length - 1].n; i++) if (!s.parts.some(p => p.n === i)) s.missing.push(i);
  }
  return sets;
}

const cache = new Map(); // path -> { key, item } so a refresh doesn't re-open every archive
async function inspect(file, st, parts) {
  const name = path.basename(file), ext = path.extname(name).toLowerCase();
  const key = parts ? parts.map(p => `${p.st.size}|${p.st.mtimeMs}`).join(',') : `${st.size}|${st.mtimeMs}`, hit = cache.get(file);
  if (hit && hit.key === key) return hit.item;
  let item = { file, name, size: st.size, stem: name.replace(/\.[^.]+$/, '') };
  if (parts) { // show and size the whole set as one item
    const p0 = partOf(name), set = p0 ? p0.set : name; // old-style sets start with a plain Game.rar
    // 7z/zip/rar sets open normally from their first part. A raw split (Game.iso.001) needs -tsplit, or 7-Zip
    // joins it and then lists the files inside the disc image instead of the image itself.
    const tflag = /\.(7z|zip|rar)$/i.test(set) ? [] : ['-tsplit'];
    Object.assign(item, { name: set, stem: set.replace(/\.(7z|zip|rar)$/i, '').replace(/\.[^.]+$/, ''), size: parts.reduce((n, p) => n + p.st.size, 0), parts: parts.map(p => p.file), partCount: parts.length, tflag });
  }
  try {
    if (ARCHIVE_EXT.has(ext) || parts) {
      const files = await listing(file, item.tflag);
      const discs = files.filter(f => DISC_EXT.has(path.extname(f.path).toLowerCase()));
      const pkgs = files.filter(f => f.path.toLowerCase().endsWith('.pkg'));
      const risky = files.filter(f => RISKY_EXT.has(path.extname(f.path).toLowerCase()));
      item.kind = 'archive'; item.inner = files.filter(f => !JUNK_INSIDE.test(f.path)).map(f => f.path);
      if (!discs.length && pkgs.length) {
        const main = pkgs.sort((a, b) => b.size - a.size)[0];
        Object.assign(item, await classifyPkg(reader(file, main.path, item.tflag)), { pkg: main.path, gameSize: main.size });
      } else if (discs.length) {
        const main = discs.sort((a, b) => b.size - a.size)[0];
        const cue = files.some(f => f.path.toLowerCase().endsWith('.cue')) || /\(Track \d+\)/i.test(main.path);
        Object.assign(item, await classifyDisc(reader(file, main.path, item.tflag), main.path, main.size, cue), { disc: main.path, cue, gameSize: discs.reduce((n, f) => n + f.size, 0) });
        if (risky.length) item.warn = `Also contains ${risky.map(f => path.basename(f.path)).join(', ')}. EchoForge won't copy those.`;
        item.inner = item.inner.filter(p => !RISKY_EXT.has(path.extname(p).toLowerCase()));
      } else if (risky.length) Object.assign(item, { status: 'risky', why: `Archive holds a program (${path.basename(risky[0].path)}), not a game` });
      else Object.assign(item, { console: '?', why: files.length ? 'No disc image inside' : parts ? `Couldn’t open the set: a part after part ${parts.length} may still be missing` : 'Couldn’t open the archive' });
    } else if (ext === '.pkg') {
      Object.assign(item, { kind: 'loose', pkg: name, gameSize: st.size }, await classifyPkg(reader(file)));
    } else {
      Object.assign(item, { kind: 'loose', disc: name, gameSize: st.size }, await classifyDisc(reader(file), name, st.size, false));
    }
  } catch (e) { Object.assign(item, { console: '?', why: `Couldn’t read it: ${e.message}` }); }
  if (!item.status) item.status = item.console && item.console !== '?' ? 'ready' : 'unknown';
  cache.set(file, { key, item });
  return item;
}

async function scan(folder) {
  if (!sevenZip()) return { error: 'no7z', items: [] };
  let ents = []; try { ents = await fsp.readdir(folder, { withFileTypes: true }); } catch { return { error: 'nofolder', items: [] }; }
  const items = [], all = [];
  for (const e of ents) { if (!e.isFile()) continue; const file = path.join(folder, e.name); try { all.push({ name: e.name, file, st: await fsp.stat(file) }); } catch {} }
  // Split archives become one item, shown only once every part is there and finished copying.
  const sets = partSets(all), inSet = new Set(), partialNames = all.filter(f => PARTIAL_EXT.has(path.extname(f.name).toLowerCase())).map(f => f.name.toLowerCase());
  for (const s of sets.values()) {
    const arriving = partialNames.filter(n => n.startsWith(s.name.toLowerCase().replace(/\.rar$/, '')));
    if (s.parts.length === 1 && s.parts[0].n === 1 && !arriving.length) continue; // a lone .001 / .part1 with nothing after it is just a file
    for (const p of s.parts) inSet.add(p.file);
    const size = s.parts.reduce((n, p) => n + p.st.size, 0), file = (s.first || s.parts[0]).file;
    const fresh = s.parts.some(p => Date.now() - p.st.mtimeMs < 15000);
    if (!s.first || s.missing.length || arriving.length || fresh) {
      const why = arriving.length || fresh ? `Still being copied (${s.parts.length} part${s.parts.length === 1 ? '' : 's'} so far)` : `Waiting for part ${(s.first ? s.missing : [1, ...s.missing])[0]} of this set`;
      items.push({ file, name: s.name, size, status: 'copying', why, parts: s.parts.map(p => p.file) }); continue;
    }
    items.push(await inspect(s.first.file, s.first.st, s.parts));
  }
  for (const { name, file, st } of all) {
    if (inSet.has(file)) continue;
    const ext = path.extname(name).toLowerCase(), e = { name };
    if (PARTIAL_EXT.has(ext)) { if (![...sets.values()].some(s => name.toLowerCase().startsWith(s.name.toLowerCase().replace(/\.rar$/, '')))) items.push({ file, name: e.name, size: st.size, status: 'copying', why: 'Still being copied' }); continue; }
    if (RISKY_EXT.has(ext)) { items.push({ file, name: e.name, size: st.size, status: 'risky', auto: autoRecycle(e.name), why: ext === '.lnk' ? 'Shortcut, not a game' : 'Program, not a game' }); continue; }
    if (!ARCHIVE_EXT.has(ext) && !LOOSE_EXT.has(ext)) continue;
    if (Date.now() - st.mtimeMs < 15000) { items.push({ file, name: e.name, size: st.size, status: 'copying', why: 'Still being written' }); continue; }
    items.push(await inspect(file, st));
  }
  return { items };
}

// ---------- import ----------
async function freeBytes(dir) { let d = dir; while (d && !fs.existsSync(d)) d = path.dirname(d) === d ? null : path.dirname(d); if (!d) return 0; const s = await fsp.statfs(d); return s.bavail * s.bsize; }
async function sizesMatch(dir, want) { for (const [rel, size] of want) { try { if ((await fsp.stat(path.join(dir, rel))).size !== size) return false; } catch { return false; } } return true; }
const pct = report => s => { const m = [...s.matchAll(/(\d+)%/g)].pop(); if (m) report(+m[1]); };
// keepFree is the level where the main drive counts as running low: below it the game goes to the other drive, and only stays when that one can't take it.
async function pickBase(dest, fallback, need, minFree, keepFree = 0) {
  if (await freeBytes(dest) - need >= Math.max(minFree, keepFree)) return { base: dest, moved: false };
  if (fallback && fallback !== dest && await freeBytes(fallback) - need >= minFree) return { base: fallback, moved: true };
  if (await freeBytes(dest) - need >= minFree) return { base: dest, moved: false };
  return null;
}
const gb = b => (b / 2 ** 30).toFixed(1);
function sfoFields(buf) {
  if (buf.length < 20 || buf.readUInt32LE(0) !== 0x46535000) return {};
  const kt = buf.readUInt32LE(8), dt = buf.readUInt32LE(12), n = buf.readUInt32LE(16), out = {};
  for (let i = 0; i < n; i++) {
    const o = 20 + i * 16, ko = buf.readUInt16LE(o), fmt = buf.readUInt16LE(o + 2), len = buf.readUInt32LE(o + 4), dof = buf.readUInt32LE(o + 12);
    const k = buf.toString('latin1', kt + ko, buf.indexOf(0, kt + ko));
    out[k] = fmt === 0x0404 ? buf.readUInt32LE(dt + dof) : buf.toString('utf8', dt + dof, dt + dof + len).replace(/\0+$/, '');
  }
  return out;
}

// PS3 disc: the game folder (PS3_GAME\USRDIR\EBOOT.BIN) comes out of the image's UDF file system. Encrypted dumps are refused.
async function importPs3Disc(item, o, report) {
  const temp = path.join(o.tempRoot, 'EchoForge-temp', 'ps3-' + Date.now());
  await fsp.mkdir(temp, { recursive: true });
  try {
    let iso = item.file;
    if (item.kind === 'archive') {
      report(0, 'Unpacking disc image');
      await run(sevenZip(), ['e', ...(item.tflag || []), item.file, item.disc,`-o${temp}`, '-y', '-bso0', '-bsp1'], pct(p => report(p * 0.4)));
      iso = path.join(temp, path.basename(item.disc));
      if (!fs.existsSync(iso)) return { ok: false, error: 'The disc image didn’t come out of the archive.' };
    }
    const chk = path.join(temp, 'chk');
    await run(sevenZip(), ['e', '-tudf', iso, 'PS3_GAME\\PARAM.SFO', 'PS3_GAME\\USRDIR\\EBOOT.BIN', `-o${chk}`, '-y', '-bso0', '-bsp0']);
    let sfo, eboot; try { sfo = sfoFields(await fsp.readFile(path.join(chk, 'PARAM.SFO'))); eboot = (await fsp.readFile(path.join(chk, 'EBOOT.BIN'))).subarray(0, 3).toString('latin1'); } catch { return { ok: false, error: 'This isn’t a playable PS3 game disc (no PS3_GAME folder).' }; }
    if (eboot !== 'SCE') return { ok: false, error: 'The disc data is still encrypted, so RPCS3 can’t read it.' };
    const files = await listing(iso, ['-tudf']), need = files.reduce((n, f) => n + f.size, 0);
    const where = await pickBase(o.dest, o.fallback, need, o.minFree, o.keepFree);
    if (!where) return { ok: false, error: `Not enough space: needs ${gb(need)} GB plus ${gb(o.minFree)} GB spare.` };
    const title = (sfo.TITLE || item.stem).replace(/[^\x20-\x7E]/g, '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
    const out = path.join(where.base, `${title} [${sfo.TITLE_ID || ''}]`);
    if (fs.existsSync(out)) return { ok: true, exists: true, dest: out, console: 'ps3' };
    report(40, 'Unpacking game folder');
    await run(sevenZip(), ['x', '-tudf', iso, `-o${out}`, '-y', '-bso0', '-bsp1'], pct(p => report(40 + p * 0.55)));
    report(96, 'Checking files');
    if (!await sizesMatch(out, files.map(f => [f.path, f.size]))) { await fsp.rm(out, { recursive: true, force: true }); return { ok: false, error: 'Some files didn’t unpack correctly, so nothing was kept.' }; }
    return { ok: true, dest: out, console: 'ps3', fallbackUsed: where.moved, bytes: need };
  } finally { await fsp.rm(temp, { recursive: true, force: true }).catch(() => {}); }
}

// PS3 digital game: RPCS3 installs the .pkg into its dev_hdd0\game folder. Games without a free license need a .rap file.
async function importPs3Pkg(item, o, report) {
  if (!o.rpcs3 || !fs.existsSync(o.rpcs3)) return { ok: false, error: 'Set up RPCS3 first (Emulators page). It installs PS3 packages.' };
  const titleId = (item.contentId || '').slice(7, 16), gameDir = path.join(path.dirname(o.rpcs3), 'dev_hdd0', 'game');
  const temp = path.join(o.tempRoot, 'EchoForge-temp', 'pkg-' + Date.now());
  try {
    let pkg = item.file;
    if (item.kind === 'archive') {
      await fsp.mkdir(temp, { recursive: true });
      report(0, 'Unpacking package');
      await run(sevenZip(), ['e', ...(item.tflag || []), item.file, item.pkg,`-o${temp}`, '-y', '-bso0', '-bsp1'], pct(p => report(p * 0.5)));
      pkg = path.join(temp, path.basename(item.pkg));
      if (!fs.existsSync(pkg)) return { ok: false, error: 'The package didn’t come out of the archive.' };
    }
    report(50, 'Installing in RPCS3');
    await run(o.rpcs3, ['--installpkg', pkg]);
    const dir = titleId && path.join(gameDir, titleId);
    if (!dir || !fs.existsSync(path.join(dir, 'USRDIR', 'EBOOT.BIN'))) return { ok: false, error: 'RPCS3 didn’t finish installing it. Try opening RPCS3 and using File → Install Packages.' };
    let note = '';
    try { const e = (await fsp.readFile(path.join(dir, 'USRDIR', 'EBOOT.BIN'))).subarray(0, 0x1000); const i = e.indexOf('NPD\0'); if (i >= 0 && e.readUInt32BE(i + 8) !== 3) note = 'This game needs its license file (.rap) in RPCS3 before it will start.'; } catch {}
    return { ok: true, dest: dir, console: 'ps3', libFolder: gameDir, note };
  } finally { await fsp.rm(temp, { recursive: true, force: true }).catch(() => {}); }
}

async function importGeneric(item, o, report) {
  if (item.kind === 'loose') { // move the single file into the library: copy, check, then remove the original
    const where = await pickBase(o.dest, o.fallback, item.size, o.minFree, o.keepFree);
    if (!where) return { ok: false, error: `Not enough space: needs ${gb(item.size)} GB plus ${gb(o.minFree)} GB spare.` };
    const to = path.join(where.base, item.name);
    if (fs.existsSync(to)) return { ok: true, exists: true, dest: to, console: item.console };
    await fsp.mkdir(where.base, { recursive: true });
    report(10, 'Moving');
    try { await fsp.rename(item.file, to); } catch {
      await fsp.copyFile(item.file, to, fs.constants.COPYFILE_EXCL);
      if ((await fsp.stat(to)).size !== item.size) { await fsp.rm(to, { force: true }); return { ok: false, error: 'The copy didn’t match, so nothing was moved.' }; }
      await fsp.rm(item.file, { force: true });
    }
    return { ok: true, dest: to, console: item.console, moved: true, fallbackUsed: where.moved, bytes: item.size };
  }
  const files = (await listing(item.file, item.tflag)).filter(f => item.inner.includes(f.path));
  const need = files.reduce((n, f) => n + f.size, 0);
  const where = await pickBase(o.dest, o.fallback, need, o.minFree, o.keepFree);
  if (!where) return { ok: false, error: `Not enough space: needs ${gb(need)} GB plus ${gb(o.minFree)} GB spare.` };
  const out = item.cue || files.length > 1 ? path.join(where.base, item.stem) : where.base; // multi-file games get their own folder
  const want = files.map(f => [path.basename(f.path), f.size]);
  if (await sizesMatch(out, want)) return { ok: true, exists: true, dest: out, console: item.console };
  await fsp.mkdir(out, { recursive: true });
  report(0, 'Unpacking');
  await run(sevenZip(), ['e', ...(item.tflag || []), item.file, `-o${out}`, '-y', '-bso0', '-bsp1', ...files.map(f => f.path)], pct(report));
  report(98, 'Checking files');
  if (!await sizesMatch(out, want)) return { ok: false, error: 'Some files didn’t unpack correctly. The archive was kept.' };
  return { ok: true, dest: out, console: item.console, fallbackUsed: where.moved, bytes: need };
}

function register({ ipcMain, shell, getWin }) {
  const send = (ch, v) => { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send(ch, v); };
  ipcMain.handle('inbox:scan', (_e, folder) => scan(folder));
  ipcMain.handle('inbox:recycle', async (_e, file) => {
    const x = await recycleAll(shell, [file]);
    if (x.ok) { cache.delete(file); return { ok: true }; }
    return { ok: false, error: /busy|used by another|EBUSY|EPERM/i.test(x.error) ? 'It’s still running. End it in Task Manager first.' : x.error };
  });
  // o: { dest, fallback, minFreeGB, keepFreeGB, rpcs3, tempRoot, recycle }
  ipcMain.handle('inbox:import', async (_e, { file, o }) => {
    const hit = cache.get(file); const item = hit && hit.item;
    if (!item || item.status !== 'ready') return { ok: false, error: 'Refresh and try again.' };
    const opts = { ...o, minFree: (o.minFreeGB ?? 15) * 2 ** 30, keepFree: (o.keepFreeGB ?? 0) * 2 ** 30, tempRoot: o.tempRoot || path.parse(o.fallback || o.dest).root };
    const report = (p, phase) => send('inbox:progress', { file, pct: Math.round(p), phase });
    let r;
    try {
      r = item.console === 'ps3' && item.pkg ? await importPs3Pkg(item, opts, report)
        : item.console === 'ps3' ? await importPs3Disc(item, opts, report)
        : await importGeneric(item, opts, report);
    } catch (e) { r = { ok: false, error: e.message }; }
    // The archive (or a loose PS3 image/pkg that was unpacked or installed) is no longer needed once the game is in place.
    if (r.ok && o.recycle) { // every part of a split archive goes
      const left = (item.parts || [file]).filter(p => fs.existsSync(p));
      if (left.length) {
        const x = await recycleAll(shell, left); r.recycled = x.ok;
        if (!x.ok) r.note = [r.note, `The archive was kept. ${x.error}`].filter(Boolean).join(' ');
      }
    }
    if (r.ok) cache.delete(file);
    return r;
  });
  let watchers = [], t = null;
  ipcMain.handle('inbox:watch', (_e, folders) => { // one folder, or several
    for (const w of watchers) w.close();
    watchers = [];
    for (const folder of [].concat(folders || []).filter(Boolean)) {
      try { watchers.push(fs.watch(folder, () => { clearTimeout(t); t = setTimeout(() => send('inbox:changed'), 1500); })); } catch {}
    }
    return watchers.length > 0;
  });
}

module.exports = { register, scan };
