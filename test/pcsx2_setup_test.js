// Tests the PCSX2 first-run and controller setup in app/pads.js against a fake portable PCSX2 in Temp.
// Run: node test/pcsx2_setup_test.js
const fs = require('fs'), path = require('path'), os = require('os');
const pads = require('../app/pads');

let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const T = path.join(os.tmpdir(), 'ef-pcsx2-setup-test'); fs.rmSync(T, { recursive: true, force: true });
fs.mkdirSync(path.join(T, 'bios'), { recursive: true }); fs.mkdirSync(path.join(T, 'inis'), { recursive: true });
const exe = path.join(T, 'pcsx2-qt.exe'); fs.writeFileSync(exe, ''); fs.writeFileSync(path.join(T, 'portable.txt'), '');
const ini = path.join(T, 'inis', 'PCSX2.ini');
const lines = f => fs.readFileSync(f, 'utf8').split(/\r?\n/);

// What a fresh PCSX2 writes on its first run (trimmed): the setup window still to do, player 1 on the keyboard.
const FRESH = ['[Filenames]', 'BIOS = scph77001-us.bin', '', '', '[UI]', 'SettingsVersion = 1', 'SetupWizardIncomplete = true', '',
  '[Folders]', 'Bios = bios', '', '[Pad1]', 'Type = DualShock2', 'Deadzone = 0', 'Up = Keyboard/Up', 'Cross = Keyboard/K',
  'Start = Keyboard/Return', 'LUp = Keyboard/W', '', '[Pad2]', '', '[USB1]', 'Type = None', ''].join('\r\n');

(async () => {
  check('picks a USA BIOS when there is one', pads.pickBios(['scph10000-jp.bin', 'scph77001-us.bin', 'scph77004-eu.bin', 'notes.txt']) === 'scph77001-us.bin');
  check('otherwise the first BIOS file', pads.pickBios(['b-eu.bin', 'a-jp.bin', 'readme.txt']) === 'a-jp.bin');
  check('no BIOS files: none', pads.pickBios(['readme.txt']) === '');

  // A fresh PCSX2: setup finished, controller added in slots 0-3, keyboard keys and other sections kept.
  fs.writeFileSync(ini, FRESH);
  let r = await pads.pcsx2Setup(exe);
  let L = lines(ini);
  check('a fresh PCSX2 gets its setup finished and the controller added', r.ok && r.changed.includes('setup') && r.changed.includes('controller') && !r.changed.includes('bios'), JSON.stringify(r));
  check('the first-time setup window is marked done', L.includes('SetupWizardIncomplete = false') && !L.some(l => /SetupWizardIncomplete = true/.test(l)));
  check('Cross works from any of the first four controller slots', [0, 1, 2, 3].every(i => L.includes(`Cross = SDL-${i}/FaceSouth`)));
  check('keyboard keys stay', L.includes('Cross = Keyboard/K') && L.includes('Up = Keyboard/Up'));
  check('buttons missing from the old mapping are added too', L.includes('Triangle = SDL-0/FaceNorth') && L.includes('R2 = SDL-3/+RightTrigger'));
  check('other settings are left alone', L.includes('SettingsVersion = 1') && L.includes('Deadzone = 0') && L.includes('[USB1]') && L.includes('Type = None') && L.includes('[Pad2]'));
  check('Windows line endings are kept', fs.readFileSync(ini, 'utf8').includes('\r\n') && !/[^\r]\n/.test(fs.readFileSync(ini, 'utf8')));
  check('the original file is kept as a backup', fs.readFileSync(ini + '.before-echoforge', 'utf8') === FRESH);

  // Running again changes nothing.
  const after = fs.readFileSync(ini, 'utf8');
  r = await pads.pcsx2Setup(exe);
  check('a second run changes nothing', r.ok && r.changed.length === 0 && fs.readFileSync(ini, 'utf8') === after, JSON.stringify(r));

  // A controller mapping the user made is never touched.
  const mine = FRESH.replace('Cross = Keyboard/K', 'Cross = XInput-0/A').replace('SetupWizardIncomplete = true', 'SetupWizardIncomplete = false');
  fs.writeFileSync(ini, mine);
  r = await pads.pcsx2Setup(exe);
  check('a controller mapping you made yourself is left as it is', r.ok && r.changed.length === 0 && fs.readFileSync(ini, 'utf8') === mine, JSON.stringify(r));

  // PCSX2 never opened at all: no settings file yet. A BIOS is chosen from the BIOS folder.
  fs.rmSync(ini); fs.rmSync(ini + '.before-echoforge');
  fs.writeFileSync(path.join(T, 'bios', 'scph10000-jp.bin'), ''); fs.writeFileSync(path.join(T, 'bios', 'scph39001-us.bin'), '');
  r = await pads.pcsx2Setup(exe);
  L = lines(ini);
  check('with no settings file yet, one is made with a BIOS chosen', r.ok && r.changed.includes('bios') && L.includes('BIOS = scph39001-us.bin') && L.includes('SettingsVersion = 1') && L.includes('SetupWizardIncomplete = false') && L.includes('Start = SDL-2/Start'), JSON.stringify(r));
  check('no backup is made when there was nothing to back up', !fs.existsSync(ini + '.before-echoforge'));

  // No BIOS chosen and none in the folder: nothing is written (PCSX2's own setup will ask for one).
  fs.rmSync(ini); for (const f of fs.readdirSync(path.join(T, 'bios'))) fs.rmSync(path.join(T, 'bios', f));
  r = await pads.pcsx2Setup(exe);
  check('without any BIOS nothing is written', !r.ok && /BIOS/.test(r.error) && !fs.existsSync(ini), JSON.stringify(r));

  check('a program that isn’t PCSX2 is refused', !(await pads.pcsx2Setup(path.join(T, 'rpcs3.exe'))).ok);

  fs.rmSync(T, { recursive: true, force: true });
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
