'use strict';
// Quit to EchoForge. While a game runs, EchoForge listens for a keyboard shortcut and for Select + Start held on a
// controller (see padwatch.ps1). Closing is safe: the emulator is asked to close first, the way the window's X
// button does it, so it can save. Only if it is still open after a grace period is it closed by force.
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');

const GRACE_MS = 10000;
let watcher = null, shortcut = null;

// Packaged builds keep the script outside app.asar (see "asarUnpack" in package.json): PowerShell can't read inside it.
const script = () => path.join(__dirname.replace(/app\.asar(?=[\\/]|$)/, 'app.asar.unpacked'), 'padwatch.ps1');

function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }
const taskkill = (args) => new Promise(res => execFile('taskkill.exe', args, { windowsHide: true }, err => res(!err)));

// Asks the process (and anything it started) to close, then forces it after graceMs. Resolves with how it ended.
async function closeSafely(pid, { graceMs = GRACE_MS, isAlive = alive } = {}) {
  if (!pid || !isAlive(pid)) return 'gone';
  const asked = await taskkill(['/PID', String(pid), '/T']);
  if (asked) {
    const until = Date.now() + graceMs;
    while (Date.now() < until) { if (!isAlive(pid)) return 'closed'; await new Promise(r => setTimeout(r, 250)); }
  }
  if (!isAlive(pid)) return 'closed';
  await taskkill(['/PID', String(pid), '/T', '/F']);
  return 'forced';
}

// Electron accelerator from what people type: "Ctrl+Shift+Q" -> "Control+Shift+Q".
function accelerator(text) {
  const parts = String(text || '').split('+').map(s => s.trim()).filter(Boolean);
  if (!parts.length) return '';
  const map = { ctrl: 'Control', control: 'Control', shift: 'Shift', alt: 'Alt', win: 'Super', super: 'Super', cmd: 'Super' };
  return parts.map(p => map[p.toLowerCase()] || (p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1))).join('+');
}

// Starts listening while a game runs: the quit combo and shortcut, and the pause menu combo and shortcut.
// onQuit(source) / onMenu(source) are called once per press; onNav(dir) while the menu has navigation turned on.
let shortcuts = [];
function arm({ globalShortcut, combo = true, key = '', menu = false, menuKey = '', holdMs = 2000, onQuit, onMenu, onNav, onPads, onLine }) {
  disarm(globalShortcut);
  const bind = (text, fn) => { const acc = accelerator(text); if (!acc) return false; try { if (globalShortcut.register(acc, fn)) { shortcuts.push(acc); return true; } } catch {} return false; };
  const keyOk = bind(key, () => onQuit('key'));
  if (menu && onMenu) bind(menuKey, () => onMenu('key'));
  shortcut = keyOk ? accelerator(key) : null;
  if ((combo || menu) && fs.existsSync(script())) {
    try {
      watcher = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script(), '-HoldMs', String(holdMs)], { windowsHide: true });
      let buf = '';
      watcher.stdout.on('data', d => {
        buf += d; let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          const wi = waiting.findIndex(w => line.startsWith(w.prefix));
          if (wi >= 0) { const [w] = waiting.splice(wi, 1); w.res(line); continue; }
          if (line === 'quit') { if (combo) onQuit('combo'); }
          else if (line === 'menu') { if (menu && onMenu) onMenu('combo'); }
          else if (line.startsWith('nav ') && onNav) onNav(line.slice(4));
          else if (line.startsWith('pads ') && onPads) onPads(+line.slice(5));
          else if (onLine) onLine(line); // replies such as "suspended <pid>" or "error ..."
        }
      });
      // Only forget this helper if it's still the current one: an older one ending must not drop a newer one.
      const me = watcher;
      me.on('error', () => { if (watcher === me) watcher = null; });
      me.on('exit', () => { if (watcher === me) watcher = null; });
    } catch { watcher = null; }
  }
  return { shortcut: !!shortcut, combo: !!watcher };
}
// A command for the helper (see padwatch.ps1): "nav on", "suspend <pid>", "key <pid> F2" ...
function send(line) { if (!watcher) return false; try { watcher.stdin.write(line + '\n'); return true; } catch { return false; } }
// A command that gets a reply (e.g. "rect <pid>" -> "rect <pid> l t r b"). Resolves with the reply line, or null.
const waiting = [];
function request(line, prefix, ms = 700) {
  return new Promise(res => {
    const w = { prefix, res }; waiting.push(w);
    if (!send(line)) { waiting.splice(waiting.indexOf(w), 1); return res(null); }
    setTimeout(() => { const i = waiting.indexOf(w); if (i >= 0) { waiting.splice(i, 1); res(null); } }, ms);
  });
}
// Extra shortcuts only while the pause menu is open (arrows, Enter, Esc), so the menu works without having focus.
let menuKeys = [];
function bindMenuKeys(globalShortcut, onNav) {
  unbindMenuKeys(globalShortcut);
  for (const [acc, dir] of [['Up', 'up'], ['Down', 'down'], ['Left', 'left'], ['Right', 'right'], ['Return', 'ok'], ['Escape', 'back']]) {
    try { if (globalShortcut.register(acc, () => onNav(dir))) menuKeys.push(acc); } catch {}
  }
}
function unbindMenuKeys(globalShortcut) { for (const a of menuKeys) { try { globalShortcut.unregister(a); } catch {} } menuKeys = []; }

function disarm(globalShortcut) {
  for (const a of shortcuts) { try { globalShortcut.unregister(a); } catch {} }
  shortcuts = []; shortcut = null; unbindMenuKeys(globalShortcut);
  if (watcher) { try { watcher.stdin.end(); } catch {} const w = watcher; setTimeout(() => { try { w.kill(); } catch {} }, 1500); watcher = null; }
}

module.exports = { closeSafely, accelerator, arm, disarm, send, request, bindMenuKeys, unbindMenuKeys, script, GRACE_MS };
