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

// ---- PCSX2 (PS2) ----
// A PCSX2 that has never been opened waits for its first-time setup window before it boots anything, and its PS2
// controller is mapped to the keyboard. Before a PS2 game EchoForge finishes the setup (choosing a BIOS from PCSX2's
// BIOS folder when none is chosen) and, when player 1 has keyboard keys only, adds your controller in any of the first
// four controller slots (a wheel often takes the first). Wheels show up as joysticks, whose inputs have other names,
// so a wheel can't press PS2 buttons. Keyboard keys stay, and a controller mapping the user made is never changed.
const PS2_PAD = {
  Up: 'DPadUp', Right: 'DPadRight', Down: 'DPadDown', Left: 'DPadLeft', Triangle: 'FaceNorth', Circle: 'FaceEast',
  Cross: 'FaceSouth', Square: 'FaceWest', Select: 'Back', Start: 'Start', L1: 'LeftShoulder', L2: '+LeftTrigger',
  R1: 'RightShoulder', R2: '+RightTrigger', L3: 'LeftStick', R3: 'RightStick', LUp: '-LeftY', LRight: '+LeftX',
  LDown: '+LeftY', LLeft: '-LeftX', RUp: '-RightY', RRight: '+RightX', RDown: '+RightY', RLeft: '-RightX'
};
const US_BIOS = /usa|[-_ ]us\b|scph-?(10001|15001|18001|30001|30004r?|35001|37001|39001|50001|70001|70011|70012|75001|77001|79001|90001)/i;
// The BIOS to use when none is chosen yet: a USA one (by its usual file names) when there is one, else the first.
function pickBios(names) {
  const bins = names.filter(n => /\.(bin|rom0)$/i.test(n)).sort();
  return bins.find(n => US_BIOS.test(n)) || bins[0] || '';
}
function pcsx2Paths(exe) {
  const dir = path.dirname(exe);
  const portable = fs.existsSync(path.join(dir, 'portable.txt')) || fs.existsSync(path.join(dir, 'portable.ini'));
  const root = portable ? dir : path.join(require('os').homedir(), 'Documents', 'PCSX2');
  return { ini: path.join(root, 'inis', 'PCSX2.ini'), root };
}
// The lines of one [section] of an ini (null when there's no such section), with where it starts and ends.
function findSection(rows, name) {
  const start = rows.findIndex(r => r.trim().toLowerCase() === `[${name.toLowerCase()}]`);
  if (start < 0) return null;
  let end = start + 1; while (end < rows.length && !/^\s*\[/.test(rows[end])) end++;
  return { start, end, lines: rows.slice(start + 1, end) };
}
const value = (lines, key) => { const l = lines.find(x => x.split('=')[0].trim().toLowerCase() === key.toLowerCase()); return l ? l.slice(l.indexOf('=') + 1).trim() : null; };
// Works on the ini's text: returns the new text and what changed.
function pcsx2Fix(ini, bios) {
  const eol = ini.includes('\r\n') ? '\r\n' : '\n', changed = [];
  const rows = ini ? ini.split(/\r?\n/) : [];
  const put = (name, lines) => { // replace a section, or add it at the end
    const s = findSection(rows, name);
    if (s) rows.splice(s.start, s.end - s.start, `[${name}]`, ...lines, '');
    else { while (rows.length && !rows[rows.length - 1].trim()) rows.pop(); if (rows.length) rows.push(''); rows.push(`[${name}]`, ...lines, ''); }
  };
  const files = findSection(rows, 'Filenames'), chosen = files && value(files.lines, 'BIOS');
  if (!chosen) {
    if (!bios) return { ini, changed, noBios: true };
    put('Filenames', [...(files ? files.lines.filter(l => l.trim() && value([l], 'BIOS') === null) : []), `BIOS = ${bios}`]);
    changed.push('bios');
  }
  // PCSX2 throws away a settings file without SettingsVersion (and shows its setup window again), so it's added too.
  const ui = findSection(rows, 'UI');
  if (!ui || (value(ui.lines, 'SetupWizardIncomplete') || '').toLowerCase() !== 'false' || value(ui.lines, 'SettingsVersion') === null) {
    const keep = ui ? ui.lines.filter(l => l.trim() && value([l], 'SetupWizardIncomplete') === null) : [];
    if (value(keep, 'SettingsVersion') === null) keep.unshift('SettingsVersion = 1');
    put('UI', [...keep, 'SetupWizardIncomplete = false']);
    changed.push('setup');
  }
  const pad = findSection(rows, 'Pad1');
  if (!pad || !pad.lines.some(l => /=\s*(SDL|XInput|DInput)-\d/i.test(l))) {
    const keep = pad ? pad.lines.filter(l => l.trim() && value([l], 'Type') === null) : [];
    const lines = [`Type = ${(pad && value(pad.lines, 'Type')) || 'DualShock2'}`];
    const add = k => { for (let i = 0; i < 4; i++) lines.push(`${k} = SDL-${i}/${PS2_PAD[k]}`); };
    for (const l of keep) { lines.push(l); const k = l.split('=')[0].trim(); if (PS2_PAD[k]) add(k); }
    for (const k of Object.keys(PS2_PAD)) if (!keep.some(l => l.split('=')[0].trim() === k)) add(k);
    put('Pad1', lines);
    changed.push('controller');
  }
  return { ini: changed.length ? rows.join(eol) : ini, changed };
}
async function pcsx2Setup(exe) {
  if (!exe || !path.isAbsolute(exe) || !/pcsx2[^\\/]*\.exe$/i.test(exe)) return { ok: false, error: 'PCSX2 isn’t linked yet.' };
  const { ini: file, root } = pcsx2Paths(exe);
  let ini = ''; try { ini = await fsp.readFile(file, 'utf8'); } catch {}
  const folders = findSection(ini.split(/\r?\n/), 'Folders');
  const biosDir = path.resolve(root, (folders && value(folders.lines, 'Bios')) || 'bios');
  let names = []; try { names = await fsp.readdir(biosDir); } catch {}
  const r = pcsx2Fix(ini, pickBios(names));
  if (r.noBios) return { ok: false, error: 'No PS2 BIOS found in PCSX2’s BIOS folder.' };
  if (!r.changed.length) return { ok: true, changed: [] };
  await fsp.mkdir(path.dirname(file), { recursive: true });
  if (ini) { const b = file + '.before-echoforge'; if (!fs.existsSync(b)) await fsp.copyFile(file, b); }
  await fsp.writeFile(file, r.ini);
  return { ok: true, changed: r.changed, file };
}

function register({ ipcMain }) {
  ipcMain.handle('pads:status', (_e, exe) => status(exe));
  ipcMain.handle('pads:setup', (_e, { exe, force }) => setup(exe, { force: !!force }).catch(e => ({ ok: false, error: e.message })));
  ipcMain.handle('pads:pcsx2', (_e, exe) => pcsx2Setup(exe).catch(e => ({ ok: false, error: e.message })));
}

module.exports = { register, classify, profile, status, setup, NAMES, pcsx2Fix, pcsx2Setup, pickBios };
