'use strict';
// Which screen games use. On a PC with three screens the middle one is the game screen, at 1920 × 1080: either
// Windows reports three (or more) monitors, or one very wide screen made of several (NVIDIA Surround / AMD Eyefinity
// spanning, which Windows reports as a single display, e.g. 5846 × 1080 for three 1920 × 1080 monitors and their
// bezels). On one ordinary screen games keep going fullscreen as before.
//
// On the game screen a game runs in a borderless window filling it, not in real fullscreen: on a spanned screen,
// fullscreen would stretch across every monitor. RetroArch places its own window from settings handed to it at launch
// (retroarchCfg); other emulators' windows are moved there once they appear (app/winplace.ps1).
const fs = require('fs');
const path = require('path');

const WIDE = 4.4; // width / height of a spanned screen: three 16:9 monitors are 5.33, two are 3.56 (not treated as three)

// displays: [{ x, y, width, height }] (Electron's display.bounds). Returns { multi, count, rect } where rect is the game
// screen: the middle monitor, or the middle 16:9 part of a spanned one.
function gameScreen(displays) {
  const list = (displays || []).filter(d => d && d.width > 0 && d.height > 0);
  if (!list.length) return { multi: false, count: 0, rect: null };
  if (list.length >= 3) {
    const byX = [...list].sort((a, b) => a.x - b.x || a.y - b.y), mid = byX[Math.floor((byX.length - 1) / 2)];
    return { multi: true, count: list.length, rect: { x: mid.x, y: mid.y, width: mid.width, height: mid.height } };
  }
  const d = list.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a)); // the main (largest) screen
  if (d.width / d.height >= WIDE) {
    const w = Math.min(d.width, Math.round(d.height * 16 / 9)); // 1080 high -> 1920 wide
    return { multi: true, count: Math.round(d.width / w), spanned: true, rect: { x: d.x + Math.round((d.width - w) / 2), y: d.y, width: w, height: d.height } };
  }
  return { multi: false, count: list.length, rect: { x: d.x, y: d.y, width: d.width, height: d.height } };
}

// Launch options that make an emulator go fullscreen, removed when games use the game screen instead.
const FULLSCREEN_ARGS = { retroarch: ['-f', '--fullscreen'], pcsx2: ['-fullscreen'], duckstation: ['-fullscreen'], ppsspp: ['--fullscreen'] };
function dropFullscreen(emuId, args) {
  const drop = new Set((FULLSCREEN_ARGS[emuId] || ['-fullscreen', '--fullscreen']).map(s => s.toLowerCase()));
  return args.filter(a => !drop.has(String(a).toLowerCase()));
}

// RetroArch settings that put its window on the game screen, borderless, with no menu bar; given with --appendconfig
// so the user's own retroarch.cfg is never changed. RetroArch writes its settings back to retroarch.cfg when it closes,
// which would keep these there (RetroArch opened by itself would then be borderless too), so that's off for this
// session; core options, save states and remaps are saved separately and still are.
function retroarchCfg(rect) {
  return [
    'config_save_on_exit = "false"',
    'video_fullscreen = "false"', 'video_windowed_fullscreen = "false"', 'video_window_save_positions = "true"',
    'video_window_show_decorations = "false"', 'ui_menubar_enable = "false"',
    `video_windowed_position_x = "${rect.x}"`, `video_windowed_position_y = "${rect.y}"`,
    `video_windowed_position_width = "${rect.width}"`, `video_windowed_position_height = "${rect.height}"`
  ].join('\n') + '\n';
}
function writeRetroarchCfg(dir, rect) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'retroarch-game-screen.cfg');
  fs.writeFileSync(file, retroarchCfg(rect));
  return file;
}

module.exports = { gameScreen, dropFullscreen, retroarchCfg, writeRetroarchCfg, WIDE };
