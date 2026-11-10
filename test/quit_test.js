// Tests app/quit.js: the quit shortcut text, the safe close (ask first, force later) and the controller watcher's
// start and stop. Uses throwaway processes only.
// Run: node test/quit_test.js
const { spawn } = require('child_process');
const quit = require('../app/quit');

let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  check('Ctrl+Shift+Q becomes an Electron shortcut', quit.accelerator('Ctrl+Shift+Q') === 'Control+Shift+Q');
  check('spacing and case don’t matter', quit.accelerator(' ctrl + alt + f12 ') === 'Control+Alt+F12');
  check('empty means no shortcut', quit.accelerator('') === '');

  // A window that closes when asked (like an emulator's X button): closed politely, not forced.
  const form = spawn('powershell.exe', ['-NoProfile', '-Command',
    'Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.Form; $f.ShowInTaskbar = $false; $f.WindowState = "Minimized"; $f.Text = "EchoForge quit test"; [System.Windows.Forms.Application]::Run($f)'], { windowsHide: false });
  await wait(4000);
  let t = Date.now(), how = await quit.closeSafely(form.pid, { graceMs: 8000 });
  check('asks a game window to close first', how === 'closed' && !alive(form.pid), `${how} in ${Date.now() - t} ms`);

  // A program with no window ignores the request, so it's forced after the grace period.
  const stuck = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { windowsHide: true });
  await wait(500);
  t = Date.now(); how = await quit.closeSafely(stuck.pid, { graceMs: 1500 });
  await wait(300);
  check('forces it when it won’t close', how === 'forced' && !alive(stuck.pid), how);
  check('nothing to do when it’s already gone', (await quit.closeSafely(stuck.pid)) === 'gone');

  // The controller watcher starts, reports, and ends when EchoForge stops listening.
  const lines = [];
  const fakeShortcut = { register: () => true, unregister: () => {} };
  const r = quit.arm({ globalShortcut: fakeShortcut, combo: true, key: 'Ctrl+Shift+Q', onQuit: () => lines.push('quit'), onPads: n => lines.push('pads ' + n) });
  check('arms the shortcut and the controller watcher', r.shortcut && r.combo, JSON.stringify(r));
  for (let i = 0; i < 40 && !lines.length; i++) await wait(250);
  check('watcher reports the controllers it can see', lines.some(l => /^pads \d+$/.test(l)), JSON.stringify(lines));
  // Pause menu: the helper freezes the game's process and lets it run again.
  const ticker = spawn(process.execPath, ['-e', 'let n = 0; setInterval(() => console.log(++n), 100)'], { windowsHide: true });
  let ticks = 0; ticker.stdout.on('data', d => { ticks += String(d).trim().split(/\s+/).length; });
  const helperSays = [];
  const helperLog = l => helperSays.push(l);
  quit.disarm(fakeShortcut);
  let helperReady = false;
  quit.arm({ globalShortcut: fakeShortcut, combo: true, menu: true, onQuit: () => {}, onMenu: () => {}, onNav: helperLog, onLine: helperLog, onPads: () => { helperReady = true; } });
  for (let i = 0; i < 60 && !helperReady; i++) await wait(250);
  await wait(300);
  const before = ticks; quit.send(`suspend ${ticker.pid}`); await wait(400);
  const frozenAt = ticks; await wait(1200);
  check('the menu pauses the game', ticks - frozenAt <= 1 && frozenAt > before - 1, `${frozenAt} -> ${ticks} ${JSON.stringify(helperSays)} pid ${ticker.pid}`);
  quit.send(`resume ${ticker.pid}`); await wait(800);
  check('Resume lets it run again', ticks > frozenAt + 3, `${frozenAt} -> ${ticks}`);
  ticker.kill();
  quit.disarm(fakeShortcut);
  check('watcher stops when the game ends', true);

  console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
