// Tests app/pads.js (RPCS3 controller setup) against a fake RPCS3 folder in Temp.
// Run: node test/pads_test.js
const fs = require('fs'), path = require('path'), os = require('os');
const pads = require('../app/pads');

let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const T = path.join(os.tmpdir(), 'ef-pads-test'); fs.rmSync(T, { recursive: true, force: true }); fs.mkdirSync(T, { recursive: true });
const exe = path.join(T, 'rpcs3.exe'); fs.writeFileSync(exe, '');
const cfg = path.join(T, 'config', 'input_configs', 'global', 'Default.yml');

const DS4_BT = 'HID\\{00001124-0000-1000-8000-00805F9B34FB}_VID&0002054C_PID&09CC\\9&1F38EBC5&0&0000';
const DS4_USB = 'HID\\VID_054C&PID_05C4\\7&1234';
const DSENSE = 'HID\\VID_054C&PID_0CE6&MI_03\\8&abc';
const XBOX = 'HID\\VID_045E&PID_02FF&IG_00\\3&2b';
const MOUSE = 'HID\\VID_046D&PID_C52B&MI_02\\7&99';

(async () => {
  check('recognises a PS4 controller over Bluetooth', pads.classify([MOUSE, DS4_BT]) === 'ds4');
  check('recognises a PS4 controller over USB', pads.classify([DS4_USB]) === 'ds4');
  check('recognises a PS5 controller', pads.classify([DSENSE]) === 'dualsense');
  check('recognises an Xbox-style controller', pads.classify([XBOX]) === 'xinput');
  check('prefers a Sony pad over an Xbox one', pads.classify([XBOX, DS4_BT]) === 'ds4');
  check('no controller means nothing', pads.classify([MOUSE]) === null);

  for (const k of ['ds4', 'dualsense', 'xinput']) {
    const y = pads.profile(k);
    check(`${k} profile maps every PS3 button`, ['Start', 'Select', 'PS Button', 'Cross', 'Circle', 'Square', 'Triangle', 'L1', 'L2', 'L3', 'R1', 'R2', 'R3', 'Left Stick Up', 'Right Stick Left'].every(b => new RegExp(`\\n    ${b}: \\S`).test(y)));
  }
  check('PS4 profile uses the DualShock 4 handler', /Handler: DualShock 4\r\n  Device: "DS4 Pad #1"/.test(pads.profile('ds4')));
  check('PS5 profile maps Select to Create', /Select: Create/.test(pads.profile('dualsense')));
  check('Xbox profile maps Cross to A', /Cross: A\r/.test(pads.profile('xinput')));

  check('refuses a program that isn’t RPCS3', (await pads.status(path.join(T, 'other.exe'))).state === 'unknown');
  check('spots a missing profile', (await pads.status(exe)).state === 'missing');
  let r = await pads.setup(exe, { devices: [MOUSE] });
  check('asks for a controller when none is connected', !r.ok && /No controller/.test(r.error) && !fs.existsSync(cfg));
  r = await pads.setup(exe, { devices: [DS4_BT] });
  check('writes a profile for the connected controller', r.ok && r.kind === 'ds4' && fs.existsSync(cfg) && !r.backup);
  let s = await pads.status(exe);
  check('reads the profile back as set up', s.state === 'set' && s.handler === 'DualShock 4', JSON.stringify(s));

  // A profile the user made themselves is left alone.
  const mine = 'Player 1 Input:\n  Handler: XInput\n  Device: "XInput Pad #1"\n  Config:\n    Cross: B\n';
  fs.writeFileSync(cfg, mine);
  r = await pads.setup(exe, { devices: [DS4_BT] });
  check('never replaces a profile the user set up', r.ok && r.already && fs.readFileSync(cfg, 'utf8') === mine);

  // Keyboard only changes when asked, and the old file is kept.
  const kb = 'Player 1 Input:\n  Handler: Keyboard\n  Device: Keyboard\n';
  fs.writeFileSync(cfg, kb);
  check('spots a keyboard-only profile', (await pads.status(exe)).state === 'keyboard');
  r = await pads.setup(exe, { devices: [DS4_BT] });
  check('leaves the keyboard profile unless asked', !r.ok && fs.readFileSync(cfg, 'utf8') === kb);
  r = await pads.setup(exe, { devices: [DSENSE], force: true });
  check('switches to the controller when asked, keeping a backup', r.ok && r.kind === 'dualsense' && r.backup && fs.readFileSync(r.backup, 'utf8') === kb && /Handler: DualSense/.test(fs.readFileSync(cfg, 'utf8')));

  fs.rmSync(T, { recursive: true, force: true });
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
