// Tests app/app-updates.js against a fake GitHub release feed on this PC.
// Run: node test/app_updates_test.js
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), crypto = require('crypto');

const PORT = 47912;
process.env.EF_GH_API = `http://127.0.0.1:${PORT}`;
const up = require('../app/app-updates');
const T = path.join(os.tmpdir(), 'ef-appup-test'); fs.rmSync(T, { recursive: true, force: true }); fs.mkdirSync(T, { recursive: true });

let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const installer = Buffer.from('fake installer ' + 'x'.repeat(5000));
const digest = 'sha256:' + crypto.createHash('sha256').update(installer).digest('hex');
const asset = (version, d = digest) => ({ name: `EchoForge-Setup-${version}.exe`, size: installer.length, digest: d, browser_download_url: `http://127.0.0.1:${PORT}/dl/EchoForge-Setup-${version}.exe` });
const rel = (version, extra = {}, assets = [asset(version)]) => ({ tag_name: 'v' + version, html_url: `https://github.com/x/y/releases/tag/v${version}`, draft: false, prerelease: false, body: 'notes', assets, ...extra });

let feed = [];
const server = http.createServer((req, res) => {
  if (/^\/repos\/universalone\/echoforge\/releases/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(feed)); }
  if (/^\/dl\//.test(req.url)) { res.writeHead(200); return res.end(installer); }
  res.writeHead(404); res.end();
});

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  check('0.1.10 is newer than 0.1.9', up.cmpVersion('0.1.10', '0.1.9') === 1 && up.cmpVersion('v0.2.0', '0.1.99') === 1 && up.cmpVersion('0.1.6', '0.1.6') === 0);

  feed = [rel('0.1.9', { draft: true }), rel('0.2.0', { prerelease: true }), rel('0.1.8'), rel('0.1.7'), rel('0.1.10', {}, [asset('0.1.10', null)]), rel('0.1.6')];
  let c = await up.checkApp('0.1.6', 'universalone/echoforge');
  check('offers the newest published release with a checksum', c.ok && c.update && c.latest.version === '0.1.8', JSON.stringify(c.latest && c.latest.version));
  c = await up.checkApp('0.1.8', 'universalone/echoforge');
  check('up to date on the newest version', c.ok && !c.update);
  c = await up.checkApp('0.2.5', 'universalone/echoforge');
  check('never offers an older version', c.ok && !c.update);
  feed = [rel('0.1.7', {}, [{ ...asset('0.1.7'), name: 'Something-Else.exe' }])];
  c = await up.checkApp('0.1.6', 'universalone/echoforge');
  check('ignores files that aren’t the installer', c.ok && !c.update && !c.latest);
  c = await up.checkApp('0.1.6', 'not a repo; rm -rf');
  check('refuses a bad update source', !c.ok);

  feed = [rel('0.1.7')];
  c = await up.checkApp('0.1.6', 'universalone/echoforge');
  const steps = []; const file = await up.download(c.latest, p => steps.push(p), T);
  check('downloads and checks the installer', fs.readFileSync(file).equals(installer) && steps[steps.length - 1] === 100);
  let err = null; try { await up.download({ ...c.latest, sha256: '0'.repeat(64) }, () => {}, path.join(T, 'bad')); } catch (e) { err = e.message; }
  check('refuses and deletes a mismatched download', /checksum/.test(err || '') && !fs.existsSync(path.join(T, 'bad', c.latest.name)), err);
  err = null; try { await up.download({ ...c.latest, name: 'evil.exe' }, () => {}, T); } catch (e) { err = e.message; }
  check('only downloads EchoForge installers', /isn’t an EchoForge installer/.test(err || ''), err);

  feed = null;
  c = await up.checkApp('0.1.6', 'universalone/echoforge');
  check('reports when GitHub fails', !c.ok, c.error);

  server.close(); fs.rmSync(T, { recursive: true, force: true });
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
