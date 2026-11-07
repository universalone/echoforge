// Tests app/emu-updates.js against a fake GitHub release feed on this PC, with throwaway emulator folders.
// Run: node test/emu_updates_test.js   (needs 7-Zip, like the app)
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');

const T = path.join(os.tmpdir(), 'ef-emuup-test'); fs.rmSync(T, { recursive: true, force: true }); fs.mkdirSync(T, { recursive: true });
const PORT = 47911;
process.env.EF_GH_API = `http://127.0.0.1:${PORT}`;
process.env.EF_EMU_BACKUPS = path.join(T, 'backups');
const up = require('../app/emu-updates');

const SZ = ['C:\\Program Files\\7-Zip\\7z.exe', 'C:\\Program Files (x86)\\7-Zip\\7z.exe'].find(p => fs.existsSync(p));
let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const write = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const read = f => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// A build: files under an optional wrapper folder, zipped with 7-Zip.
function build(name, files, wrap = '') {
  const src = path.join(T, 'src-' + name); fs.rmSync(src, { recursive: true, force: true });
  for (const [rel, body] of Object.entries(files)) write(path.join(src, wrap, rel), body);
  const zip = path.join(T, 'dl', name); fs.mkdirSync(path.dirname(zip), { recursive: true }); fs.rmSync(zip, { force: true });
  execFileSync(SZ, ['a', '-tzip', zip, '.\\*', '-bso0', '-bsp0'], { cwd: src });
  return { name, size: fs.statSync(zip).size, digest: 'sha256:' + sha(zip) };
}
const asset = (b, digest = b.digest) => ({ name: b.name, size: b.size, digest, browser_download_url: `http://127.0.0.1:${PORT}/dl/${b.name}` });
const rel = (tag, assets, extra = {}) => ({ tag_name: tag, html_url: `https://github.com/x/y/releases/tag/${tag}`, published_at: '2026-11-07T10:00:00Z', draft: false, prerelease: false, assets, ...extra });

const feeds = { 'KytyPS5/KytyPS5': [], 'shadps4-emu/shadPS4': [] };
const server = http.createServer((req, res) => {
  const m = req.url.match(/^\/repos\/([^/]+\/[^/]+)\/releases/);
  if (m && feeds[m[1]]) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(feeds[m[1]])); }
  const d = req.url.match(/^\/dl\/(.+)$/);
  if (d && fs.existsSync(path.join(T, 'dl', d[1]))) { res.writeHead(200); return fs.createReadStream(path.join(T, 'dl', d[1])).pipe(res); }
  res.writeHead(404); res.end();
});

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const emu = path.join(T, 'Programs', 'KytyPS5'), exe = path.join(emu, 'kyty_emulator.exe');
  write(exe, 'old exe'); write(path.join(emu, 'Qt6Core.dll'), 'old dll'); write(path.join(emu, 'config.ini'), 'my settings'); write(path.join(emu, 'user', 'save.dat'), 'my save');

  const v2 = build('KytyPS5-2026-11-07-aaaaaaa-Windows-x64.zip', { 'kyty_emulator.exe': 'new exe v2', 'Qt6Core.dll': 'new dll v2', 'platforms/qwindows.dll': 'added v2' }, 'KytyPS5');
  const linux = build('KytyPS5-2026-11-08-bbbbbbb-Linux-x86_64.zip', { 'kyty_emulator': 'linux' });
  feeds['KytyPS5/KytyPS5'] = [
    rel('KytyPS5-2026-11-08-bbbbbbb', [asset(linux)]),                     // no Windows build: skipped
    rel('KytyPS5-2026-11-07-ccccccc', [asset(v2, null)]),                  // no checksum: skipped
    rel('KytyPS5-2026-11-07-aaaaaaa', [asset(v2)])
  ];

  let c = await up.check('kytyps5', exe);
  check('check finds the newest Windows build with a checksum', c.ok && c.update && c.latest.tag === 'KytyPS5-2026-11-07-aaaaaaa', JSON.stringify(c.latest && c.latest.tag));
  check('unknown current version shows as unknown', c.current === '' && !c.rollback);
  check('labels are short', up.label('KytyPS5-2026-11-07-589bd14') === '2026-11-07 · 589bd14' && up.label('v.0.21.0') === '0.21.0');

  const steps = []; let r = await up.update('kytyps5', exe, (p, ph) => steps.push(ph));
  check('update succeeds', r.ok && r.label === '2026-11-07 · aaaaaaa', r.error || '');
  check('program files replaced, wrapper folder handled', read(exe) === 'new exe v2' && read(path.join(emu, 'Qt6Core.dll')) === 'new dll v2' && read(path.join(emu, 'platforms', 'qwindows.dll')) === 'added v2');
  check('settings and saves untouched', read(path.join(emu, 'config.ini')) === 'my settings' && read(path.join(emu, 'user', 'save.dat')) === 'my save');
  check('version recorded', /KytyPS5-2026-11-07-aaaaaaa/.test(read(path.join(emu, 'ECHOFORGE_SOURCE.txt')) || ''));
  check('progress reported', steps.includes('Downloading') && steps.includes('Installing') && steps.includes('Done'));

  c = await up.check('kytyps5', exe);
  check('now up to date with roll back offered', c.ok && !c.update && c.currentLabel === '2026-11-07 · aaaaaaa' && c.rollback, JSON.stringify(c.rollback));
  r = await up.update('kytyps5', exe); check('updating again does nothing', r.ok && r.already);

  // A bad download is refused and nothing changes.
  const v3 = build('KytyPS5-2026-11-09-ddddddd-Windows-x64.zip', { 'kyty_emulator.exe': 'new exe v3', 'Qt6Core.dll': 'new dll v3' });
  feeds['KytyPS5/KytyPS5'] = [rel('KytyPS5-2026-11-09-ddddddd', [asset(v3, 'sha256:' + '0'.repeat(64))])];
  r = await up.update('kytyps5', exe);
  check('checksum mismatch refused', !r.ok && /checksum/.test(r.error), r.error);
  check('folder unchanged after refusal', read(exe) === 'new exe v2');

  // Refuses while the emulator is running from its folder (a copy of PING.EXE stands in for it).
  feeds['KytyPS5/KytyPS5'] = [rel('KytyPS5-2026-11-09-ddddddd', [asset(v3)])];
  const runDir = path.join(T, 'Programs', 'RunningKyty'), runExe = path.join(runDir, 'kyty_emulator.exe');
  fs.mkdirSync(runDir, { recursive: true }); fs.copyFileSync('C:\\Windows\\System32\\PING.EXE', runExe);
  const child = spawn(runExe, ['-n', '30', '127.0.0.1'], { windowsHide: true, stdio: 'ignore' });
  await new Promise(res => setTimeout(res, 800));
  r = await up.update('kytyps5', runExe);
  check('refuses while the emulator is running', !r.ok && /Close the emulator/.test(r.error), r.error);
  child.kill(); await new Promise(res => setTimeout(res, 500));

  // Roll back to the version before the last update.
  r = await up.update('kytyps5', exe); check('second update succeeds', r.ok && read(exe) === 'new exe v3', r.error || '');
  r = await up.rollback('kytyps5', exe);
  check('roll back succeeds', r.ok && read(exe) === 'new exe v2' && read(path.join(emu, 'Qt6Core.dll')) === 'new dll v2', r.error || r.label);
  check('roll back keeps settings and the earlier version label', read(path.join(emu, 'config.ini')) === 'my settings' && /aaaaaaa/.test(read(path.join(emu, 'ECHOFORGE_SOURCE.txt')) || ''));
  r = await up.rollback('kytyps5', exe);
  check('roll back again goes to the original', r.ok && read(exe) === 'old exe' && !fs.existsSync(path.join(emu, 'platforms', 'qwindows.dll')) && read(path.join(emu, 'ECHOFORGE_SOURCE.txt')) === null, r.error || '');
  r = await up.rollback('kytyps5', exe); check('nothing left to roll back', !r.ok && /no earlier version/i.test(r.error), r.error);

  // Only the newest backups are kept.
  for (const [tag, n] of [['KytyPS5-2026-11-10-eeeeeee', 'v4'], ['KytyPS5-2026-11-11-fffffff', 'v5'], ['KytyPS5-2026-11-12-1111111', 'v6']]) {
    const b = build(`${tag}-Windows-x64.zip`, { 'kyty_emulator.exe': 'exe ' + n });
    feeds['KytyPS5/KytyPS5'] = [rel(tag, [asset(b)])]; await up.update('kytyps5', exe);
  }
  check('keeps the 2 newest backups', fs.readdirSync(path.join(T, 'backups', 'kytyps5')).length === 2 && read(exe) === 'exe v6');

  // Roll back is refused if the folder changed outside EchoForge.
  write(path.join(emu, 'ECHOFORGE_SOURCE.txt'), 'https://x/releases/tag/SomethingElse\r\nSomethingElse');
  r = await up.rollback('kytyps5', exe); check('roll back refused after outside change', !r.ok && /changed/.test(r.error), r.error);

  // shadPS4: daily pre-releases are skipped for the stable release.
  const s = build('shadps4-win64-sdl-0.21.0.zip', { 'shadPS4.exe': 'stable' }), n = build('shadps4-win64-sdl-2026-11-07-33e7312.zip', { 'shadPS4.exe': 'nightly' });
  feeds['shadps4-emu/shadPS4'] = [rel('Pre-release-shadPS4-2026-11-07-33e7312', [asset(n)], { prerelease: true }), rel('v.0.21.0', [asset(s)])];
  const sdir = path.join(T, 'Programs', 'shadPS4'); write(path.join(sdir, 'shadps4.exe'), 'self built');
  c = await up.check('shadps4', path.join(sdir, 'shadps4.exe'));
  check('shadPS4 offers the stable release, not the daily build', c.ok && c.latest.tag === 'v.0.21.0' && c.latest.label === '0.21.0', JSON.stringify(c.latest && c.latest.tag));

  // GitHub's list isn't always newest first: the newest by date wins.
  const early = build('KytyPS5-2026-11-13-2222222-Windows-x64.zip', { 'kyty_emulator.exe': 'early' }), late = build('KytyPS5-2026-11-13-3333333-Windows-x64.zip', { 'kyty_emulator.exe': 'late' });
  feeds['KytyPS5/KytyPS5'] = [rel('KytyPS5-2026-11-13-2222222', [asset(early)], { published_at: '2026-11-13T05:47:00Z' }), rel('KytyPS5-2026-11-13-3333333', [asset(late)], { published_at: '2026-11-13T11:16:00Z' })];
  c = await up.check('kytyps5', exe); check('picks the newest by release date', c.ok && c.latest.tag === 'KytyPS5-2026-11-13-3333333', c.latest && c.latest.tag);

  // Folders EchoForge won't touch.
  c = await up.check('kytyps5', path.join(os.homedir(), 'Desktop', 'kyty_emulator.exe'));
  check('refuses an emulator sitting loose on the Desktop', !c.ok && /own folder/.test(c.error));
  c = await up.check('pcsx2', exe); check('refuses emulators it can’t update', !c.ok);
  c = await up.check('kytyps5', 'C:UsersexampleAppDataLocalProgramsKytyPS5kyty_emulator.exe'); check('refuses a path without its folders', !c.ok && /own folder/.test(c.error));
  c = await up.check('kytyps5', path.join(emu, 'missing.exe')); check('refuses a program that isn’t there', !c.ok);

  // GitHub refusing requests is reported plainly.
  feeds['KytyPS5/KytyPS5'] = null;
  c = await up.check('kytyps5', exe); check('feed errors are reported', !c.ok && /GitHub answered 404/.test(c.error), c.error);

  server.close(); fs.rmSync(T, { recursive: true, force: true });
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
