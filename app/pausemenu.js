'use strict';
// The in-game pause menu: a see-through window on top of the game. Opened with a quick tap of Select + Start on a
// controller (Share/Create + Options on PlayStation, Back + Start on Xbox) or the menu shortcut. The game's process is paused while it's open (setting), and
// the controller drives the menu through the game helper (padwatch.ps1), so it works without taking focus.
const { BrowserWindow, screen, desktopCapturer, app } = require('electron');
const path = require('path');
const fsp = require('fs').promises;
const quit = require('./quit');

// The default quick save / load keys of emulators that have them (slot 1 or the current slot).
const STATE_KEYS = {
  retroarch: { save: 'F2', load: 'F4' },
  pcsx2: { save: 'F1', load: 'F3' },
  ppsspp: { save: 'F2', load: 'F4' },
  dolphin: { save: 'Shift+F1', load: 'F1' }
};

let overlay = null, state = null, deps = null;
function init(d) { deps = d; } // { globalShortcut, getWin, getRunning, quitGame }
const isOpen = () => !!state;

function ensureOverlay() {
  if (overlay && !overlay.isDestroyed()) return overlay;
  overlay = new BrowserWindow({
    show: false, frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true, resizable: false, movable: false,
    minimizable: false, maximizable: false, fullscreenable: false, hasShadow: false, backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'overlay-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.loadFile(path.join(__dirname, 'overlay.html'));
  overlay.on('closed', () => { overlay = null; });
  return overlay;
}

// The launcher's current skin colors, so the menu matches.
async function themeVars() {
  const w = deps.getWin(); if (!w || w.isDestroyed()) return {};
  try {
    return await w.webContents.executeJavaScript(`(() => { const cs = getComputedStyle(document.documentElement), o = {};
      for (const k of ['--a1','--a2','--a3','--bg','--bg2','--panel-solid','--text','--muted','--line2','--display','--font','--grad']) o[k] = cs.getPropertyValue(k).trim(); return o; })()`);
  } catch { return {}; }
}

const safeName = t => String(t || 'Game').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Game';
// Local date and time for file names, e.g. "2026-11-09 18-04-28".
const stamp = (d = new Date()) => { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`; };

// Where the game is: its window (asked from the helper), limited to the screen it's on. Several monitors can show up
// as one wide screen (spanned displays), so the window, not the screen, decides where the menu goes.
async function gameArea(pid) {
  let disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()), area = null;
  if (pid) {
    const r = await quit.request(`rect ${pid}`, `rect ${pid} `);
    const m = r && /^rect \d+ (-?\d+) (-?\d+) (-?\d+) (-?\d+)$/.exec(r);
    if (m) {
      const [l, t, rr, b] = m.slice(1).map(Number);
      const px = { x: l, y: t, width: Math.max(1, rr - l), height: Math.max(1, b - t) };
      try {
        const dip = process.platform === 'win32' ? screen.screenToDipRect(null, px) : px;
        disp = screen.getDisplayMatching(dip);
        const B = disp.bounds, x = Math.max(dip.x, B.x), y = Math.max(dip.y, B.y);
        const w = Math.min(dip.x + dip.width, B.x + B.width) - x, h = Math.min(dip.y + dip.height, B.y + B.height) - y;
        if (w >= 480 && h >= 320) area = { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };
      } catch {}
    }
  }
  return { disp, area: area || disp.bounds };
}
// A picture of the game's area, cut from the picture of the whole desktop.
async function captureArea(area) {
  const all = screen.getAllDisplays();
  const minX = Math.min(...all.map(d => d.bounds.x)), minY = Math.min(...all.map(d => d.bounds.y));
  const maxX = Math.max(...all.map(d => d.bounds.x + d.bounds.width)), maxY = Math.max(...all.map(d => d.bounds.y + d.bounds.height));
  const sf = Math.max(...all.map(d => d.scaleFactor || 1));
  const srcs = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round((maxX - minX) * sf), height: Math.round((maxY - minY) * sf) } });
  // Each source is one screen; find the one holding the area and cut the area out of it.
  for (const d of all) {
    const B = d.bounds; if (area.x < B.x || area.y < B.y || area.x + area.width > B.x + B.width + 1 || area.y + area.height > B.y + B.height + 1) continue;
    const src = srcs.find(x => String(x.display_id) === String(d.id)) || (srcs.length === 1 ? srcs[0] : null);
    if (!src || src.thumbnail.isEmpty()) continue;
    const k = src.thumbnail.getSize().width / B.width;
    return src.thumbnail.crop({ x: Math.round((area.x - B.x) * k), y: Math.round((area.y - B.y) * k), width: Math.round(area.width * k), height: Math.round(area.height * k) });
  }
  return null;
}

async function open() {
  const r = deps.getRunning(); if (!r || r.quitting || state) return false;
  const pid = r.child ? r.child.pid : r.pid;
  const { area } = await gameArea(pid);
  // The screenshot is taken before the menu appears, so it shows the game.
  let shot = null;
  try { shot = await captureArea(area); } catch {}
  state = { pid, gameId: r.gameId, title: r.title || 'Your game', emuId: r.emuId || '', started: r.started, freeze: r.freeze !== false && !!pid, shot, pads: r.pads };
  if (state.freeze) quit.send(`suspend ${pid}`);
  quit.send('nav on');
  quit.bindMenuKeys(deps.globalShortcut, nav);
  const theme = await themeVars();
  const w = ensureOverlay();
  w.setBounds(area);
  const keys = STATE_KEYS[state.emuId];
  const payload = {
    title: state.title, paused: state.freeze, seconds: Math.round((Date.now() - state.started) / 1000), theme,
    items: [
      { id: 'resume', label: 'Resume' },
      { id: 'save', label: 'Quick save', off: !keys, note: keys ? `Saves to the emulator’s current slot (${keys.save})` : 'Not available for this emulator yet' },
      { id: 'load', label: 'Quick load', off: !keys, note: keys ? `Loads the emulator’s current slot (${keys.load})` : 'Not available for this emulator yet' },
      { id: 'shot', label: 'Take a screenshot', off: !shot, note: shot ? 'Saved to Pictures › EchoForge Screenshots' : 'Couldn’t capture the screen' },
      { id: 'pads', label: 'Controller check' },
      { id: 'quit', label: 'Quit to EchoForge', danger: true }
    ]
  };
  const show = () => { if (!state) return; w.webContents.send('menu:open', payload); w.show(); w.setAlwaysOnTop(true, 'screen-saver'); w.moveTop(); w.focus(); };
  if (w.webContents.isLoading()) w.webContents.once('did-finish-load', show); else show();
  return true;
}

function nav(dir) { if (state && overlay && !overlay.isDestroyed()) overlay.webContents.send('menu:nav', dir); }

// Closes the menu and lets the game run again.
function close({ front = true } = {}) {
  if (!state) return;
  const s = state; state = null;
  quit.unbindMenuKeys(deps.globalShortcut); quit.send('nav off');
  if (s.freeze) quit.send(`resume ${s.pid}`);
  if (overlay && !overlay.isDestroyed()) { overlay.webContents.send('menu:close'); overlay.hide(); }
  if (front && s.pid) quit.send(`front ${s.pid}`);
  return s;
}

async function act(id) {
  if (!state) return { ok: false };
  if (id === 'resume') { close(); return { ok: true }; }
  if (id === 'quit') { close({ front: false }); deps.quitGame('menu'); return { ok: true }; }
  if (id === 'save' || id === 'load') {
    const keys = STATE_KEYS[state.emuId]; if (!keys) return { ok: false, msg: 'Quick save isn’t available for this emulator yet.' };
    const s = close({ front: false });
    setTimeout(() => quit.send(`key ${s.pid} ${keys[id]}`), 350); // after the game is running again
    return { ok: true };
  }
  if (id === 'shot') {
    if (!state.shot) return { ok: false, msg: 'Couldn’t capture the screen.' };
    try {
      const dir = path.join(app.getPath('pictures'), 'EchoForge Screenshots'); await fsp.mkdir(dir, { recursive: true });
      const file = path.join(dir, `${safeName(state.title)} ${stamp()}.png`);
      await fsp.writeFile(file, state.shot.toPNG());
      return { ok: true, msg: `Saved ${path.basename(file)} in Pictures › EchoForge Screenshots.` };
    } catch (e) { return { ok: false, msg: `Couldn’t save the screenshot (${e.message}).` }; }
  }
  if (id === 'pads') {
    const n = deps.getRunning() && deps.getRunning().pads;
    const seen = n == null ? 'EchoForge is still looking for controllers.' : n === 0 ? 'No controller found. Turn yours on or plug it in.' : `${n} controller${n === 1 ? '' : 's'} connected.`;
    return { ok: true, msg: `${seen} Tap Select + Start (Share + Options on PlayStation, Back + Start on Xbox) to open this menu; hold them for 2 seconds to quit.` };
  }
  return { ok: false };
}

function register({ ipcMain }) {
  ipcMain.handle('menu:act', (_e, id) => act(String(id || '')));
}

module.exports = { init, register, open, close, nav, act, isOpen, STATE_KEYS };
