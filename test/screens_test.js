// Tests app/screens.js: finding the game screen (the middle of three) and how a launch changes on it.
// Run: node test/screens_test.js
const fs = require('fs'), path = require('path'), os = require('os');
const s = require('../app/screens');

let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const r = g => JSON.stringify(g.rect);

// NVIDIA Surround: three 1920 × 1080 monitors with bezel correction, reported as one 5846 × 1080 display.
let g = s.gameScreen([{ x: 0, y: 0, width: 5846, height: 1080 }]);
check('a Surround screen counts as three, the middle 1920 × 1080 is the game screen', g.multi && g.spanned && g.count === 3 && r(g) === '{"x":1963,"y":0,"width":1920,"height":1080}', r(g));
g = s.gameScreen([{ x: 0, y: 0, width: 5760, height: 1080 }]);
check('without bezel correction too', g.multi && r(g) === '{"x":1920,"y":0,"width":1920,"height":1080}', r(g));
g = s.gameScreen([{ x: 0, y: 0, width: 7680, height: 1440 }]);
check('three 2560 × 1440 monitors spanned: the middle 2560 × 1440', g.multi && r(g) === '{"x":2560,"y":0,"width":2560,"height":1440}', r(g));

// Three separate monitors: the middle one by position, wherever the main one is.
g = s.gameScreen([{ x: 1920, y: 0, width: 1920, height: 1080 }, { x: 0, y: 0, width: 1920, height: 1080 }, { x: 3840, y: 0, width: 1920, height: 1080 }]);
check('three monitors: the middle one', g.multi && g.count === 3 && r(g) === '{"x":1920,"y":0,"width":1920,"height":1080}', r(g));
g = s.gameScreen([{ x: 0, y: 0, width: 1920, height: 1080 }, { x: -1920, y: 0, width: 1920, height: 1080 }, { x: 1920, y: 0, width: 1920, height: 1080 }]);
check('three monitors with the main one in the middle at 0,0', g.multi && r(g) === '{"x":0,"y":0,"width":1920,"height":1080}', r(g));

// One or two ordinary screens: no game screen, games go fullscreen as before.
check('one ordinary screen: fullscreen as before', !s.gameScreen([{ x: 0, y: 0, width: 1920, height: 1080 }]).multi);
check('an ultrawide screen isn’t three screens', !s.gameScreen([{ x: 0, y: 0, width: 3440, height: 1440 }]).multi);
check('two monitors aren’t three', !s.gameScreen([{ x: 0, y: 0, width: 1920, height: 1080 }, { x: 1920, y: 0, width: 1920, height: 1080 }]).multi);
check('two spanned monitors aren’t three', !s.gameScreen([{ x: 0, y: 0, width: 3840, height: 1080 }]).multi);
check('no screens at all', s.gameScreen([]).multi === false);

// Launch options.
check('RetroArch’s -f is dropped', JSON.stringify(s.dropFullscreen('retroarch', ['-f', '-L', 'core.dll', 'game.sfc'])) === '["-L","core.dll","game.sfc"]');
check('PCSX2’s -fullscreen is dropped, the rest kept', JSON.stringify(s.dropFullscreen('pcsx2', ['-batch', '-fullscreen', '--', 'game.iso'])) === '["-batch","--","game.iso"]');
check('a game file named like an option isn’t dropped for other emulators', JSON.stringify(s.dropFullscreen('dolphin', ['-b', '-e', '-f'])) === '["-b","-e","-f"]');
const cfg = s.retroarchCfg({ x: 1963, y: 0, width: 1920, height: 1080 });
check('RetroArch gets a borderless window on the game screen', /video_fullscreen = "false"/.test(cfg) && /video_window_show_decorations = "false"/.test(cfg) && /video_window_save_positions = "true"/.test(cfg) && /video_windowed_position_x = "1963"/.test(cfg) && /video_windowed_position_width = "1920"/.test(cfg) && /ui_menubar_enable = "false"/.test(cfg) && /config_save_on_exit = "false"/.test(cfg));
const dir = path.join(os.tmpdir(), 'ef-screens-test'); fs.rmSync(dir, { recursive: true, force: true });
const f = s.writeRetroarchCfg(dir, { x: 1963, y: 0, width: 1920, height: 1080 });
check('the RetroArch settings are written to a file of their own', fs.readFileSync(f, 'utf8') === cfg && path.basename(f) === 'retroarch-game-screen.cfg');
fs.rmSync(dir, { recursive: true, force: true });

console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
