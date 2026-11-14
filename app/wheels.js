'use strict';
// Racing wheels. EchoForge learns the wheel's axes and buttons once (Settings → Controller → Racing wheel, using
// the browser's gamepad readings), then, before a game that has "Use racing wheel" on, sets the emulator up:
//   PS3 / RPCS3: Logitech G27 emulation (config\LogitechG27.yml). RPCS3 recognises the real wheel by a number made
//                from its vendor and product ids and the axes, hats and buttons SDL counts (app/sdlprobe.ps1).
//   PS2 / PCSX2: a Logitech Driving Force on USB port 1 (inis\PCSX2.ini, [USB1]).
// For games without it the emulated wheel is switched off again. The first time a file is changed, the original
// is kept next to it as "*.before-echoforge".
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const N = v => Number.isInteger(v) && v >= 0 && v < 128;
const DPAD = ['dpad_up', 'dpad_down', 'dpad_left', 'dpad_right'];
// A profile from the renderer, cleaned: only numbers in range. D-pad directions are a button number or 'hat'.
function clean(p) {
  if (!p || typeof p !== 'object') return null;
  const vid = parseInt(p.vid, 16), pid = parseInt(p.pid, 16);
  if (!(vid > 0 && vid < 0x10000 && pid >= 0 && pid < 0x10000) || !N(p.steer)) return null;
  const pedal = x => x && N(x.axis) ? { axis: x.axis, rest: x.rest > 0 ? 1 : -1 } : null;
  const buttons = {};
  for (const [k, v] of Object.entries(p.buttons || {})) if (/^[a-z_]{2,16}$/.test(k) && (N(v) || (DPAD.includes(k) && v === 'hat'))) buttons[k] = v;
  const sdl = p.sdl && [p.sdl.axes, p.sdl.hats, p.sdl.buttons].every(v => Number.isInteger(v) && v >= 0 && v < 1024) ? { axes: p.sdl.axes, hats: p.sdl.hats, buttons: p.sdl.buttons } : null;
  return { name: String(p.name || 'Racing wheel').replace(/[\r\n"]/g, '').slice(0, 60), vid, pid, steer: p.steer, throttle: pedal(p.throttle), brake: pedal(p.brake), clutch: pedal(p.clutch), buttons, sdl };
}
// RPCS3's number for a wheel model (LogitechG27Config.h, emulated_g27_device_type_id::as_u64).
function typeId(w) {
  const s = w.sdl || { axes: 0, hats: 0, buttons: 0 }, m = 1023n;
  return (BigInt(w.pid) | (BigInt(w.vid) << 16n) | ((BigInt(s.axes) & m) << 32n) | ((BigInt(s.hats) & m) << 42n) | ((BigInt(s.buttons) & m) << 52n)).toString();
}

// SDL's counts for each connected controller, through an SDL3.dll that an emulator installed (PCSX2 ships one).
let sdlCache = null;
function sdlDirs(extra = []) {
  const progs = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Programs');
  return [...extra, ...['PCSX2', 'DuckStation', 'Dolphin', 'xemu', 'PPSSPP', 'RPCS3'].map(d => path.join(progs, d))].filter(d => d && fs.existsSync(path.join(d, 'SDL3.dll')));
}
function sdlList(extraDirs) {
  if (sdlCache) return Promise.resolve(sdlCache);
  const dir = sdlDirs(extraDirs)[0];
  const script = path.join(__dirname.replace(/app\.asar(?=[\\/]|$)/, 'app.asar.unpacked'), 'sdlprobe.ps1');
  if (!dir || !fs.existsSync(script)) return Promise.resolve([]);
  return new Promise(res => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-SdlDir', dir], { windowsHide: true, timeout: 20000 }, (err, out) => {
    const list = String(out || '').split(/\r?\n/).map(l => /^joy ([0-9a-f]{4}) ([0-9a-f]{4}) (\d+) (\d+) (\d+)$/i.exec(l.trim())).filter(Boolean)
      .map(m => ({ vid: parseInt(m[1], 16), pid: parseInt(m[2], 16), axes: +m[3], hats: +m[4], buttons: +m[5] }));
    if (list.length) sdlCache = list;
    res(list);
  }));
}
async function withSdl(w, extraDirs) {
  if (w.sdl) return w;
  const hit = (await sdlList(extraDirs)).find(j => j.vid === w.vid && j.pid === w.pid);
  return hit ? { ...w, sdl: { axes: hit.axes, hats: hit.hats, buttons: hit.buttons } } : w;
}

async function backupOnce(file) {
  const b = file + '.before-echoforge';
  try { await fsp.access(b); } catch { try { await fsp.copyFile(file, b); } catch {} }
}

// ---- RPCS3 ----
const G27_BUTTONS = ['triangle', 'cross', 'square', 'circle', 'l2', 'l3', 'r2', 'r3', 'plus', 'minus', 'dial_clockwise', 'dial_anticlockwise', 'dial_center', 'select', 'pause', 'ps',
  'shifter_1', 'shifter_2', 'shifter_3', 'shifter_4', 'shifter_5', 'shifter_6', 'shifter_r'];
function g27Yaml(w, on) {
  const id = typeId(w), out = [];
  // An unused part points at device 0, which no real controller has.
  const entry = (name, type, n, hat = '', reverse = false) => out.push(`${name}:`, `  device_type_id: ${type === 'none' ? 0 : id}`, `  type: ${type === 'none' ? 'button' : type}`, `  id: ${type === 'none' ? 255 : n}`, `  hat: ${hat ? hat : '""'}`, `  reverse: ${reverse}`);
  entry('steering', 'axis', w.steer);
  // RPCS3's G27 copies Logitech's own pedals, which read highest when released (LogitechG27.cpp: the axis becomes
  // 0-255, and the G27 report has 00 = pressed, ff = released). So a pedal that rests at the axis minimum, like most
  // other makes' (Moza, Fanatec, Thrustmaster), is reversed; one that rests at the maximum is left as it is.
  for (const k of ['throttle', 'brake', 'clutch']) { const p = w[k]; if (p) entry(k, 'axis', p.axis, '', p.rest < 0); else entry(k, 'none', 0); }
  const b = w.buttons;
  entry('shift_up', b.shift_up != null ? 'button' : 'none', b.shift_up);
  entry('shift_down', b.shift_down != null ? 'button' : 'none', b.shift_down);
  // D-pad: the wheel's hat, or the buttons learned for each direction.
  for (const d of ['up', 'down', 'left', 'right']) { const v = b['dpad_' + d]; if (Number.isInteger(v)) entry(d, 'button', v); else entry(d, 'hat', 0, d); }
  const pick = { cross: b.cross, circle: b.circle, square: b.square, triangle: b.triangle, pause: b.start, select: b.select };
  for (const k of G27_BUTTONS) { const v = pick[k]; if (v != null) entry(k, 'button', v); else entry(k, 'none', 0); }
  out.push('reverse_effects: false', 'ffb_direction_type: steering_axis', 'compatibility_limit: 4', `ffb_device_type_id: ${id}`, `led_device_type_id: ${id}`, `enabled: ${on ? 'true' : 'false'}`, '');
  return out.join('\n');
}
async function rpcs3(exe, profile, on) {
  if (!exe || !/rpcs3\.exe$/i.test(exe)) return { ok: false, error: 'RPCS3 isn’t linked.' };
  const file = path.join(path.dirname(exe), 'config', 'LogitechG27.yml');
  let w = clean(profile);
  if (!w) { // no wheel learned: only make sure the emulated wheel is off
    try { const t = await fsp.readFile(file, 'utf8'); if (/^enabled:\s*true/m.test(t)) { await fsp.writeFile(file, t.replace(/^enabled:\s*true/m, 'enabled: false')); } } catch {}
    return { ok: true, on: false };
  }
  if (on) w = await withSdl(w, [path.dirname(exe)]);
  if (on && !w.sdl) return { ok: false, error: 'EchoForge couldn’t read the wheel’s details. Is it plugged in and on? (PCSX2 must be installed: EchoForge uses its SDL3.dll.)' };
  await fsp.mkdir(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) await backupOnce(file);
  if (!on) { // keep the wheel's mapping, just switch the emulated wheel off
    let t = ''; try { t = await fsp.readFile(file, 'utf8'); } catch {}
    if (t && /^enabled:/m.test(t)) { await fsp.writeFile(file, t.replace(/^enabled:.*$/m, 'enabled: false')); return { ok: true, on: false, file }; }
  }
  await fsp.writeFile(file, g27Yaml(w, on));
  return { ok: true, on, file };
}

// ---- PCSX2 ----
// Bindings look like "SDL-1/-Axis0" (one direction), "SDL-1/FullAxis2" (a pedal from released to pressed; "~" when
// it rests at +), "SDL-1/Button5" and "SDL-1/Hat0North". The number after SDL- is PCSX2's controller number.
function usbSection(w, on, n) {
  if (!on) return ['[USB1]', 'Type = None'];
  const sdl = `SDL-${n}`, lines = ['[USB1]', 'Type = Pad', 'Pad_subtype = 0',
    `Pad_SteeringLeft = ${sdl}/-Axis${w.steer}`, `Pad_SteeringRight = ${sdl}/+Axis${w.steer}`];
  if (w.throttle) lines.push(`Pad_Throttle = ${sdl}/FullAxis${w.throttle.axis}${w.throttle.rest > 0 ? '~' : ''}`);
  if (w.brake) lines.push(`Pad_Brake = ${sdl}/FullAxis${w.brake.axis}${w.brake.rest > 0 ? '~' : ''}`);
  const b = w.buttons, map = { Cross: b.cross, Circle: b.circle, Square: b.square, Triangle: b.triangle, Start: b.start, Select: b.select, R1: b.shift_up, L1: b.shift_down };
  for (const [k, v] of Object.entries(map)) if (v != null) lines.push(`Pad_${k} = ${sdl}/Button${v}`);
  for (const [d, compass] of [['Up', 'North'], ['Right', 'East'], ['Down', 'South'], ['Left', 'West']]) {
    const v = b['dpad_' + d.toLowerCase()]; lines.push(`Pad_DPad${d} = ${sdl}/${Number.isInteger(v) ? `Button${v}` : `Hat0${compass}`}`);
  }
  lines.push(`Pad_FFDevice = ${sdl}`);
  return lines;
}
function setSection(ini, name, lines) {
  const eol = ini.includes('\r\n') ? '\r\n' : '\n', rows = ini.split(/\r?\n/);
  const start = rows.findIndex(r => r.trim().toLowerCase() === `[${name.toLowerCase()}]`);
  if (start < 0) return (ini.replace(/\s*$/, '') + eol + eol + lines.join(eol) + eol).replace(/^\s+/, '');
  let end = start + 1; while (end < rows.length && !/^\s*\[/.test(rows[end])) end++;
  rows.splice(start, end - start, ...lines, '');
  return rows.join(eol);
}
async function pcsx2(exe, profile, on, n = 0) {
  if (!exe || !/pcsx2[^\\/]*\.exe$/i.test(exe)) return { ok: false, error: 'PCSX2 isn’t linked.' };
  const dir = path.dirname(exe);
  // Portable installs keep settings next to the program; others in Documents\PCSX2.
  const portable = fs.existsSync(path.join(dir, 'portable.txt')) || fs.existsSync(path.join(dir, 'portable.ini'));
  const file = portable ? path.join(dir, 'inis', 'PCSX2.ini') : path.join(os.homedir(), 'Documents', 'PCSX2', 'inis', 'PCSX2.ini');
  const w = clean(profile);
  let ini = ''; try { ini = await fsp.readFile(file, 'utf8'); } catch {}
  if (!w && !/^\s*\[USB1\]/mi.test(ini)) return { ok: true, on: false };
  await fsp.mkdir(path.dirname(file), { recursive: true });
  if (ini) await backupOnce(file);
  await fsp.writeFile(file, setSection(ini, 'USB1', usbSection(w || {}, !!(w && on), Number.isInteger(n) && n >= 0 && n < 16 ? n : 0)));
  return { ok: true, on: !!(w && on), file };
}

// ---- Wheel as a controller (Xbox 360 / Xenia) ----
// Emulators without wheel emulation see controllers through SDL's gamepad layer. An SDL controller mapping, given
// to the emulator in SDL_GAMECONTROLLERCONFIG, makes the wheel look like an Xbox controller: steering on the left
// stick, throttle on the right trigger, brake on the left trigger, learned buttons on A/B/X/Y, Start, Back and the
// bumpers, and the D-pad on the D-pad. No force feedback. The GUID is SDL's for a USB device with this vendor and
// product (SDL matches it without the name checksum and version).
function sdlGuid(w) {
  const le = n => (n & 0xff).toString(16).padStart(2, '0') + ((n >> 8) & 0xff).toString(16).padStart(2, '0');
  return `03000000${le(w.vid)}0000${le(w.pid)}000000000000`;
}
function padMapping(profile) {
  const w = clean(profile); if (!w) return null;
  const b = w.buttons, parts = [sdlGuid(w), w.name.replace(/,/g, ' ')];
  const btn = (k, v) => { if (Number.isInteger(v)) parts.push(`${k}:b${v}`); };
  btn('a', b.cross); btn('b', b.circle); btn('x', b.square); btn('y', b.triangle);
  btn('start', b.start); btn('back', b.select); btn('leftshoulder', b.shift_down); btn('rightshoulder', b.shift_up);
  for (const [k, d, bit] of [['dpup', 'dpad_up', 1], ['dpright', 'dpad_right', 2], ['dpdown', 'dpad_down', 4], ['dpleft', 'dpad_left', 8]]) {
    const v = b[d]; parts.push(Number.isInteger(v) ? `${k}:b${v}` : `${k}:h0.${bit}`);
  }
  parts.push(`leftx:a${w.steer}`);
  // A pedal resting at + is inverted ("~") so released reads as 0.
  if (w.throttle) parts.push(`righttrigger:a${w.throttle.axis}${w.throttle.rest > 0 ? '~' : ''}`);
  if (w.brake) parts.push(`lefttrigger:a${w.brake.axis}${w.brake.rest > 0 ? '~' : ''}`);
  parts.push('platform:Windows');
  return parts.join(',') + ',';
}

function register({ ipcMain }) {
  ipcMain.handle('wheel:padEnv', (_e, { profile }) => { const m = padMapping(profile); return m ? { SDL_GAMECONTROLLERCONFIG: m, SDL_JOYSTICK_GAMEINPUT_RAW: '0' } : null; });
  ipcMain.handle('wheel:rpcs3', (_e, { exe, profile, on }) => rpcs3(exe, profile, !!on).catch(e => ({ ok: false, error: e.message })));
  ipcMain.handle('wheel:pcsx2', (_e, { exe, profile, on, index }) => pcsx2(exe, profile, !!on, +index || 0).catch(e => ({ ok: false, error: e.message })));
}

module.exports = { register, clean, typeId, g27Yaml, usbSection, setSection, rpcs3, pcsx2, sdlList, sdlGuid, padMapping };
