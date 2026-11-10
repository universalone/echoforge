// Tests app/wheels.js against fake RPCS3 and PCSX2 folders in Temp.
// Run: node test/wheels_test.js
const fs = require('fs'), path = require('path'), os = require('os');
const W = require('../app/wheels');

let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const T = path.join(os.tmpdir(), 'ef-wheels-test'); fs.rmSync(T, { recursive: true, force: true });
const rp = path.join(T, 'RPCS3'), px = path.join(T, 'PCSX2');
fs.mkdirSync(path.join(rp, 'config'), { recursive: true }); fs.mkdirSync(path.join(px, 'inis'), { recursive: true });
fs.writeFileSync(path.join(rp, 'rpcs3.exe'), ''); fs.writeFileSync(path.join(px, 'pcsx2-qt.exe'), ''); fs.writeFileSync(path.join(px, 'portable.txt'), '');
const g27 = path.join(rp, 'config', 'LogitechG27.yml'), ini = path.join(px, 'inis', 'PCSX2.ini');
fs.writeFileSync(g27, 'steering:\n  device_type_id: 0\nenabled: false\n');
fs.writeFileSync(ini, '[Filenames]\nBIOS = scph39001.bin\n\n[USB1]\nType = None\n\n[Pad1]\nType = DualShock2\n');

// A Moza R5 as the setup steps record it.
const moza = { name: 'MOZA R5 Base', vid: '346e', pid: '0004', steer: 0, throttle: { axis: 2, rest: -1 }, brake: { axis: 3, rest: 1 }, clutch: null,
  buttons: { cross: 0, circle: 1, square: 2, triangle: 3, start: 9, select: 8, shift_up: 5, shift_down: 4, dpad_up: 'hat', dpad_down: 'hat', dpad_left: 14, dpad_right: 'hat', 'bad key!': 3, triangle2: 300, cross_x: 'hat' },
  sdl: { axes: 8, hats: 1, buttons: 128 } };
const ID = String((4n | (0x346en << 16n) | (8n << 32n) | (1n << 42n) | (128n << 52n)));

(async () => {
  const c = W.clean(moza);
  check('builds RPCS3’s number from ids and SDL’s counts', c.vid === 0x346e && c.pid === 4 && W.typeId(c) === ID, W.typeId(c));
  check('D-pad directions are a hat or a button', c.buttons.dpad_up === 'hat' && c.buttons.dpad_left === 14 && !('cross_x' in c.buttons));
  check('keeps only sensible buttons', c.buttons.cross === 0 && !('bad key!' in c.buttons) && !('triangle2' in c.buttons));
  check('refuses a wheel without steering', W.clean({ ...moza, steer: undefined }) === null);
  check('refuses bad ids', W.clean({ ...moza, vid: 'zz' }) === null);

  let r = await W.rpcs3(path.join(rp, 'rpcs3.exe'), moza, true);
  let y = fs.readFileSync(g27, 'utf8');
  check('PS3: turns the G27 on for the game', r.ok && /^enabled: true$/m.test(y));
  check('PS3: steering is the wheel’s axis', y.includes(`steering:\n  device_type_id: ${ID}\n  type: axis\n  id: 0\n`));
  check('PS3: a pedal resting at + is reversed', y.includes(`brake:\n  device_type_id: ${ID}\n  type: axis\n  id: 3\n  hat: ""\n  reverse: true`));
  check('PS3: the gas pedal isn’t', /^throttle:\n(?: {2}.*\n){4} {2}reverse: false/m.test(y));
  check('PS3: buttons are mapped', y.includes(`cross:\n  device_type_id: ${ID}\n  type: button\n  id: 0`) && y.includes(`pause:\n  device_type_id: ${ID}\n  type: button\n  id: 9`));
  check('PS3: D-pad on the hat, or a button', y.includes(`\nup:\n  device_type_id: ${ID}\n  type: hat\n  id: 0\n  hat: up`) && y.includes(`\nleft:\n  device_type_id: ${ID}\n  type: button\n  id: 14`));
  check('PS3: unused parts point at no device', /^clutch:\n {2}device_type_id: 0\n/m.test(y));
  check('PS3: force feedback goes to the wheel', y.includes(`ffb_device_type_id: ${ID}
`));
  check('PS3: the original file is kept', fs.readFileSync(g27 + '.before-echoforge', 'utf8').includes('enabled: false'));
  r = await W.rpcs3(path.join(rp, 'rpcs3.exe'), moza, false);
  check('PS3: off for other games, mapping kept', /^enabled: false$/m.test(fs.readFileSync(g27, 'utf8')) && fs.readFileSync(g27, 'utf8').includes(`steering:
  device_type_id: ${ID}`));
  check('PS3: the backup isn’t overwritten later', fs.readFileSync(g27 + '.before-echoforge', 'utf8').includes('device_type_id: 0\nenabled: false'));
  fs.writeFileSync(g27, fs.readFileSync(g27, 'utf8').replace('enabled: false', 'enabled: true'));
  await W.rpcs3(path.join(rp, 'rpcs3.exe'), null, true);
  check('PS3: with no wheel learned it’s switched off', /^enabled: false$/m.test(fs.readFileSync(g27, 'utf8')));
  check('PS3: refuses a program that isn’t RPCS3', !(await W.rpcs3(path.join(px, 'pcsx2-qt.exe'), moza, true)).ok);

  r = await W.pcsx2(path.join(px, 'pcsx2-qt.exe'), moza, true, 1);
  let t = fs.readFileSync(ini, 'utf8');
  check('PS2: a Driving Force on USB port 1', r.ok && /\[USB1\]\nType = Pad\nPad_subtype = 0\n/.test(t));
  check('PS2: steering both ways', t.includes('Pad_SteeringLeft = SDL-1/-Axis0') && t.includes('Pad_SteeringRight = SDL-1/+Axis0'));
  check('PS2: pedals as full axes, reversed when resting at +', t.includes('Pad_Throttle = SDL-1/FullAxis2\n') && t.includes('Pad_Brake = SDL-1/FullAxis3~'));
  check('PS2: buttons and force feedback', t.includes('Pad_Cross = SDL-1/Button0') && t.includes('Pad_R1 = SDL-1/Button5') && t.includes('Pad_FFDevice = SDL-1'));
  check('PS2: D-pad on the hat, or a button', t.includes('Pad_DPadUp = SDL-1/Hat0North') && t.includes('Pad_DPadLeft = SDL-1/Button14') && t.includes('Pad_DPadRight = SDL-1/Hat0East'));
  check('PS2: the rest of the settings are untouched', t.includes('BIOS = scph39001.bin') && t.includes('[Pad1]\nType = DualShock2') && (t.match(/\[USB1\]/g) || []).length === 1);
  r = await W.pcsx2(path.join(px, 'pcsx2-qt.exe'), moza, false, 1);
  t = fs.readFileSync(ini, 'utf8');
  check('PS2: off for other games', /\[USB1\]\nType = None\n/.test(t) && !t.includes('Pad_Throttle'));
  check('PS2: the original file is kept', fs.readFileSync(ini + '.before-echoforge', 'utf8').includes('[USB1]\nType = None'));
  // Xbox 360: the wheel as an Xbox controller through an SDL mapping.
  const m = W.padMapping(moza);
  check('controller mapping starts with SDL’s id for the wheel', m.startsWith('030000006e3400000400000000000000,MOZA R5 Base,'), m.slice(0, 50));
  check('steering on the left stick, pedals on the triggers', m.includes(',leftx:a0,') && m.includes(',righttrigger:a2,') && m.includes(',lefttrigger:a3~,'));
  check('buttons, bumpers and D-pad', m.includes(',a:b0,') && m.includes(',start:b9,') && m.includes(',rightshoulder:b5,') && m.includes(',dpup:h0.1,') && m.includes(',dpleft:b14,'));
  check('ends like an SDL mapping', m.endsWith(',platform:Windows,'));
  check('no mapping without a wheel', W.padMapping(null) === null);
  check('a comma in the name can’t break the mapping', W.padMapping({ ...moza, name: 'Wheel, Pro' }).split(',')[1] === 'Wheel  Pro');

  check('a section is added when missing', W.setSection('[A]\nx = 1\n', 'USB1', ['[USB1]', 'Type = None']).includes('[A]\nx = 1\n\n[USB1]\nType = None'));

  fs.rmSync(T, { recursive: true, force: true });
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
