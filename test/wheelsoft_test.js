// Tests app/wheelsoft.js: which wheel maker a wheel is from, and finding that maker's software by its Start Menu
// shortcut (a fake Start Menu in Temp).
// Run: node test/wheelsoft_test.js
const fs = require('fs'), path = require('path'), os = require('os');
const ws = require('../app/wheelsoft');

let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const id = w => (ws.brandOf(w) || {}).id;

check('MOZA by its vendor id', id({ vid: '346e', pid: '0004', name: 'R5 Base' }) === 'moza');
check('Fanatec by its vendor id', id({ vid: '0EB7', pid: '0020' }) === 'fanatec');
check('Logitech by its vendor id', id({ vid: '046d', pid: 'c24f', name: 'G29 Driving Force' }) === 'logitech');
check('Thrustmaster by its vendor id', id({ vid: '044f', pid: 'b66e' }) === 'thrustmaster');
check('Simagic EVO by its vendor id', id({ vid: '3670', pid: '0500' }) === 'simagic');
check('Simagic Alpha by vendor and product id (the vendor id is shared)', id({ vid: '0483', pid: '0522' }) === 'simagic');
check('another device on that shared vendor id isn’t taken for Simagic', id({ vid: '0483', pid: 'a355', name: 'Some device' }) === undefined);
check('VRS by its name', id({ vid: '0483', pid: 'a355', name: 'VRS DirectForce Pro' }) === 'vrs');
check('Simucube by its vendor id', id({ vid: '16d0', pid: '0d60' }) === 'simucube');
check('Asetek by its name', id({ vid: 'ffff', name: 'Asetek Invicta' }) === 'asetek');
check('an unknown wheel has no brand', ws.brandOf({ vid: '1234', pid: '5678', name: 'Mystery wheel' }) === null);
check('no wheel at all', ws.brandOf({}) === null && ws.brandOf() === null);
check('every brand has an https page for its software', ws.BRANDS.every(b => /^https:\/\//.test(b.url)));

// A fake Start Menu: MOZA's two apps, an uninstaller and a look-alike name that must not count.
const T = path.join(os.tmpdir(), 'ef-wheelsoft-test'); fs.rmSync(T, { recursive: true, force: true });
const a = path.join(T, 'all'), u = path.join(T, 'user');
for (const d of [path.join(a, 'MOZA Pit House'), u, path.join(a, 'DropIt')]) fs.mkdirSync(d, { recursive: true });
for (const f of [path.join(a, 'MOZA Pit House', 'MOZA Pit House.lnk'), path.join(a, 'MOZA Pit House', 'Uninstall MOZA Pit House.lnk'), path.join(u, 'MOZA Racing Lab.lnk'), path.join(a, 'DropIt', 'DropIt.lnk')]) fs.writeFileSync(f, '');
const moza = ws.brandOf({ vid: '346e' });
const found = ws.installed(moza, [a, u]);
check('both MOZA apps are found, from either Start Menu', found.map(x => x.label).join(',') === 'MOZA Pit House,MOZA Racing Lab', JSON.stringify(found.map(x => x.label)));
check('the uninstaller isn’t offered', !found.some(x => /uninstall/i.test(x.lnk)));
const info = ws.info({ vid: '346e', name: 'MOZA R5 Base' }, [a, u]);
check('info names the brand and lists its apps', info.brand.id === 'moza' && info.brand.get === 'MOZA Pit House' && info.apps.length === 2 && info.apps[1].i === 1);
check('a brand whose software isn’t installed lists none (so EchoForge offers its page)', ws.info({ vid: '0eb7' }, [a, u]).apps.length === 0);
check('an unknown wheel: no brand, no apps', JSON.stringify(ws.info({ vid: '1234' }, [a, u])) === '{"brand":null,"apps":[]}');

fs.rmSync(T, { recursive: true, force: true });
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
