// Tests app/retro-install.js: picking Retro's Windows zip from its releases, and installing from a zip into a folder.
// The install part uses a real Retro zip when one has been built (EF_RETRO_ZIP or the Retro worktree's dist folder),
// else a small stand-in. Run: node test/retro_install_test.js
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const r = require('../app/retro-install');

let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const SHA = 'sha256:' + 'a'.repeat(64);
const rel = (v, o = {}) => ({ draft: !!o.draft, prerelease: !!o.pre, html_url: `https://github.com/x/releases/v${v}`,
  assets: [{ name: o.name || `EchoForge-Retro-Gaming-${v}-win64.zip`, size: 10, browser_download_url: o.url || `https://github.com/x/releases/download/v${v}/EchoForge-Retro-Gaming-${v}-win64.zip`, ...(o.nodigest ? {} : { digest: SHA }) }] });

(async () => {
  let n = r.newest([rel('2.5.0'), rel('2.10.0'), rel('2.9.0'), rel('3.0.0', { draft: true }), rel('3.1.0', { pre: true }), rel('3.2.0', { nodigest: true })]);
  check('the newest published zip with a checksum is chosen', n && n.version === '2.10.0', JSON.stringify(n && n.version));
  check('an installer .exe isn’t a Retro download', r.newest([rel('9.9.9', { name: 'EchoForge-Retro-Gaming-Setup-9.9.9.exe' })]) === null);
  check('only downloads from GitHub', r.newest([rel('9.9.9', { url: 'https://evil.example/x.zip' })]) === null);
  check('no release: nothing chosen', r.newest([]) === null && r.newest(null) === null);

  const T = path.join(os.tmpdir(), 'ef-retro-install-test'); fs.rmSync(T, { recursive: true, force: true }); fs.mkdirSync(T, { recursive: true });
  // A Retro zip: the real one if it's been built, else a stand-in with the same layout.
  let zip = process.env.EF_RETRO_ZIP || 'D:\\EchoForge Retro Gaming\\packaging\\dist\\EchoForge-Retro-Gaming-2.5.0-win64.zip', real = fs.existsSync(zip);
  if (!real) {
    const src = path.join(T, 'src'); fs.mkdirSync(path.join(src, 'app'), { recursive: true }); fs.mkdirSync(path.join(src, 'python'), { recursive: true });
    fs.writeFileSync(path.join(src, 'app', 'jl_retro.pyw'), '# retro'); fs.writeFileSync(path.join(src, 'python', 'pythonw.exe'), 'exe');
    zip = path.join(T, 'stand-in.zip'); execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-a', '-cf', zip, '-C', src, 'app', 'python']);
  }
  const dir = path.join(T, 'Programs', 'EchoForge Retro Gaming');
  let res = await r.installFromZip(zip, { dir, register: false });
  check(`installs from a zip${real ? ' (the real Retro zip)' : ''}`, res.ok && fs.existsSync(path.join(dir, 'app', 'jl_retro.pyw')) && fs.existsSync(path.join(dir, 'python', 'pythonw.exe')), JSON.stringify(res));
  res = await r.installFromZip(zip, { dir, register: false });
  check('a folder that already holds Retro is left alone (Retro updates itself)', res.ok && res.already);

  // The whole install with a checked download (the GitHub request and download stood in for).
  const sha = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
  const dir2 = path.join(T, 'Programs2', 'EchoForge Retro Gaming');
  const releases = [{ html_url: 'https://github.com/x', assets: [{ name: 'EchoForge-Retro-Gaming-2.5.0-win64.zip', size: fs.statSync(zip).size, browser_download_url: 'https://github.com/x/2.5.0.zip', digest: 'sha256:' + sha }] }];
  const copy = async (rl, file) => { fs.copyFileSync(zip, file); if (crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== rl.sha256) throw new Error('checksum'); };
  res = await r.install(() => {}, { dir: dir2, register: false, releases, download: copy });
  check('install: finds the release, downloads, checks and installs', res.ok && res.version === '2.5.0' && fs.existsSync(path.join(dir2, 'app', 'jl_retro.pyw')), JSON.stringify(res));
  res = await r.install(() => {}, { dir: path.join(T, 'P3'), register: false, releases: [], download: copy });
  check('install: no release says so', !res.ok && /No EchoForge Retro Gaming download/.test(res.error));
  const bad = path.join(T, 'bad.zip'); fs.writeFileSync(bad, 'not a zip');
  res = await r.installFromZip(bad, { dir: path.join(T, 'P4'), register: false }).catch(e => ({ ok: false, error: e.message }));
  check('a broken zip isn’t installed', !res.ok && !fs.existsSync(path.join(T, 'P4', 'app')), JSON.stringify(res));

  fs.rmSync(T, { recursive: true, force: true });
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
