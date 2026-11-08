'use strict';
// Controller setup for RPCS3 (PS3). A fresh or reinstalled RPCS3 has no controller profile, so every game falls back to
// the keyboard. EchoForge spots that, recognises the connected controller and writes a standard PS3-style profile to
// RPCS3's config\input_configs\global\Default.yml. A profile the user made themselves is never replaced without asking,
// and anything replaced is kept as a backup next to it.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { execFile } = require('child_process');

const SONY = '054C';
const DS4 = ['05C4', '09CC', '0BA0'];          // DualShock 4 (both versions) and its USB wireless adapter
const DUALSENSE = ['0CE6', '0DF2'];            // DualSense and DualSense Edge

// Which controller is connected, from Windows device IDs. Sony pads use their own RPCS3 handler; anything that shows
// up as an XInput device (Xbox and most PC pads) uses XInput.
function classify(ids) {
  let xinput = false;
  for (const id of ids) {
    const m = String(id).match(/VID[&_](?:0002)?([0-9A-F]{4})[&_]PID[&_]([0-9A-F]{4})/i);
    if (m && m[1].toUpperCase() === SONY) {
      const pid = m[2].toUpperCase();
      if (DUALSENSE.includes(pid)) return 'dualsense';
      if (DS4.includes(pid)) return 'ds4';
    }
    if (/IG_\d\d/i.test(id)) xinput = true;
  }
  return xinput ? 'xinput' : null;
}

const NAMES = { ds4: 'PS4 controller', dualsense: 'PS5 controller', xinput: 'Xbox-style controller' };

function profile(kind) {
  const sticks = (p) => ({ 'Left Stick Left': `${p}LS X-`, 'Left Stick Down': `${p}LS Y-`, 'Left Stick Right': `${p}LS X+`, 'Left Stick Up': `${p}LS Y+`,
    'Right Stick Left': `${p}RS X-`, 'Right Stick Down': `${p}RS Y-`, 'Right Stick Right': `${p}RS X+`, 'Right Stick Up': `${p}RS Y+` });
  const sony = (select) => ({ ...sticks(''), Start: 'Options', Select: select, 'PS Button': 'PS Button', Square: 'Square', Cross: 'Cross', Circle: 'Circle', Triangle: 'Triangle',
    Left: 'Left', Down: 'Down', Right: 'Right', Up: 'Up', R1: 'R1', R2: 'R2', R3: 'R3', L1: 'L1', L2: 'L2', L3: 'L3',
    'Left Stick Deadzone': 40, 'Right Stick Deadzone': 40, 'Left Trigger Threshold': 0, 'Right Trigger Threshold': 0 });
  const P = {
    ds4: { handler: 'DualShock 4', device: 'DS4 Pad #1', config: sony('Share') },
    dualsense: { handler: 'DualSense', device: 'DualSense Pad #1', config: sony('Create') },
    xinput: { handler: 'XInput', device: 'XInput Pad #1', config: { ...sticks(''), Start: 'Start', Select: 'Back', 'PS Button': 'Guide', Square: 'X', Cross: 'A', Circle: 'B', Triangle: 'Y',
      Left: 'Left', Down: 'Down', Right: 'Right', Up: 'Up', R1: 'RB', R2: 'RT', R3: 'RS', L1: 'LB', L2: 'LT', L3: 'LS',
      'Left Stick Deadzone': 7849, 'Right Stick Deadzone': 8689, 'Left Trigger Threshold': 30, 'Right Trigger Threshold': 30 } }
  }[kind];
  if (!P) throw new Error('Unknown controller type.');
  const cfg = { ...P.config, 'Left Stick Multiplier': 100, 'Right Stick Multiplier': 100, 'Enable Large Vibration Motor': true, 'Enable Small Vibration Motor': true };
  return ['# Written by EchoForge for your ' + NAMES[kind] + '. Change it any time in RPCS3: Configuration > Gamepads.',
    'Player 1 Input:', `  Handler: ${P.handler}`, `  Device: "${P.device}"`, '  Config:',
    ...Object.entries(cfg).map(([k, v]) => `    ${k}: ${v}`), ''].join('\r\n');
}

const fileFor = exe => path.join(path.dirname(exe), 'config', 'input_configs', 'global', 'Default.yml');

// 'missing': no profile, so RPCS3 uses the keyboard. 'keyboard': player 1 is set to the keyboard (or nothing).
// 'set': player 1 has a controller.
async function status(exe) {
  if (!exe || !path.isAbsolute(exe) || !/rpcs3\.exe$/i.test(exe)) return { state: 'unknown' };
  let txt; try { txt = await fsp.readFile(fileFor(exe), 'utf8'); } catch { return { state: 'missing' }; }
  const m = txt.match(/Player 1 Input:\s*\r?\n\s+Handler:\s*"?([^"\r\n]*)"?/);
  const handler = m ? m[1].trim() : '';
  if (!handler) return { state: 'missing' };
  return { state: /^(Keyboard|Null)$/i.test(handler) ? 'keyboard' : 'set', handler };
}

function connected() {
  return new Promise(resolve => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "Get-PnpDevice -PresentOnly -Class HIDClass -ErrorAction SilentlyContinue | ForEach-Object { $_.InstanceId }"],
    { windowsHide: true, timeout: 15000 }, (err, out) => resolve(err ? [] : String(out).split(/\r?\n/).filter(Boolean)));
  });
}

// Writes the profile. Without force it only fills in a missing profile, so a profile the user set up stays untouched.
async function setup(exe, { force = false, devices } = {}) {
  const st = await status(exe);
  if (st.state === 'unknown') return { ok: false, error: 'RPCS3 isn’t linked yet.' };
  if (st.state === 'set' && !force) return { ok: true, already: true, handler: st.handler };
  if (st.state === 'keyboard' && !force) return { ok: false, error: 'RPCS3 is set to use the keyboard.' };
  const kind = classify(devices || await connected());
  if (!kind) return { ok: false, error: 'No controller found. Turn your controller on or plug it in, then try again.' };
  const file = fileFor(exe);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  let backup = null;
  if (fs.existsSync(file)) { backup = file.replace(/\.yml$/i, `.before-echoforge-${Date.now()}.yml`); await fsp.copyFile(file, backup); }
  await fsp.writeFile(file, profile(kind));
  return { ok: true, kind, name: NAMES[kind], backup };
}

function register({ ipcMain }) {
  ipcMain.handle('pads:status', (_e, exe) => status(exe));
  ipcMain.handle('pads:setup', (_e, { exe, force }) => setup(exe, { force: !!force }).catch(e => ({ ok: false, error: e.message })));
}

module.exports = { register, classify, profile, status, setup, NAMES };
