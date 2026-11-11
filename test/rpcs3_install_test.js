// RPCS3 stays open after installing a package. EchoForge must notice the result in its log and close it.
// Uses Node as a stand-in for RPCS3: it writes a log line, then keeps running.
// Run: node test/rpcs3_install_test.js
const fs = require('fs'), path = require('path'), os = require('os');
const ib = require('../app/inbox'), { installInRpcs3 } = ib;
let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const T = path.join(os.tmpdir(), 'ef-rpcs3-install-test'); fs.rmSync(T, { recursive: true, force: true }); fs.mkdirSync(path.join(T, 'log'), { recursive: true });
const pkg = path.join(T, 'My Game.pkg'); fs.writeFileSync(pkg, 'x');
const log = path.join(T, 'log', 'RPCS3.log');
// The stand-in writes `line` to the log after a moment, then stays open until killed.
const stand = path.join(T, 'fake-rpcs3.js');
fs.writeFileSync(stand, "const [log, line] = process.argv.slice(2); setTimeout(() => require('fs').appendFileSync(log, line + String.fromCharCode(10)), 300); setInterval(() => {}, 1000);");
const fake = line => [stand, log, line];
const go = (line, extra = {}) => installInRpcs3(process.execPath, pkg, { args: fake(line), logs: [log], everyMs: 100, limitMs: 10000, ...extra });

(async () => {
  fs.writeFileSync(log, `GUI: Successfully installed ${pkg} (old run)\n`); fs.utimesSync(log, 1, 1);
  let t = Date.now(), r = await go(`·S GUI: Successfully installed ${pkg} (title_id=NPUB00001)`);
  check('a successful install is noticed and RPCS3 is closed', r.installed && Date.now() - t < 5000, `${JSON.stringify(r)} in ${Date.now() - t} ms`);
  check('an old log from an earlier run is not taken as the answer', Date.now() - t >= 250);

  fs.writeFileSync(log, '');
  r = await go(`·E GUI: Failed to install ${pkg}`);
  check('a failed install is reported', r.failed, JSON.stringify(r));

  fs.writeFileSync(log, '');
  r = await go(`·S GUI: Successfully installed ${path.join(T, 'Other Game.pkg')}`, { limitMs: 1500 });
  check('another package’s result is ignored, and the time limit ends the wait', r.timedOut, JSON.stringify(r));

  r = await installInRpcs3(process.execPath, pkg, { args: ['-e', 'setTimeout(()=>{}, 200)'], logs: [log], everyMs: 100, limitMs: 10000 });
  check('RPCS3 closing by itself ends the wait', r.exited, JSON.stringify(r));

  // Cancel: the wait ends at once and RPCS3 is closed.
  fs.writeFileSync(log, '');
  ib._setJob({ kids: new Set(), stopped: false });
  t = Date.now(); const waiting = go('·! nothing to see', { limitMs: 20000 });
  setTimeout(() => ib.cancelImport(), 400);
  r = await waiting; const left = ib._job().kids.size; ib._setJob(null);
  check('Cancel ends the install wait and closes RPCS3', r.stopped && left === 0 && Date.now() - t < 3000, `${JSON.stringify(r)} in ${Date.now() - t} ms, ${left} still running`);
  check('Cancel with nothing running does nothing', ib.cancelImport() === false);

  fs.rmSync(T, { recursive: true, force: true });
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
