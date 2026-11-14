'use strict';
// The wheel maker's own software, for calibrating: centring the wheel, steering range, pedal deadzones and curves.
// Those settings are saved on the wheel base, so they work in every emulator and game, which is why EchoForge opens
// that software instead of keeping calibration of its own (RPCS3, PCSX2 and Xenia have no pedal deadzones).
// The brand comes from the wheel's USB vendor id, or its name when the id isn't known; the software is found through
// its Start Menu shortcut, so it works wherever it was installed. Windows' own game controller calibration
// (joy.cpl) works for every wheel and is always offered.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// vids: USB vendor ids ('vid' or 'vid:pid' where the vendor id is shared). names: words in the wheel's name.
// apps: Start Menu shortcut names. url: the maker's official page for the software, opened in the browser.
const BRANDS = [
  { id: 'moza', name: 'MOZA', vids: ['346e'], names: /\bmoza\b/i, url: 'https://mozaracing.com/pages/pit-house',
    apps: [['MOZA Pit House', /^MOZA Pit House$/i], ['MOZA Racing Lab', /^MOZA Racing Lab$/i]], get: 'MOZA Pit House' },
  { id: 'fanatec', name: 'Fanatec', vids: ['0eb7'], names: /fanatec|clubsport|podium|\bcsl\b|gran turismo dd/i, url: 'https://www.fanatec.com/eu/en/explorer/games/gaming-tips/fanatec-app-firmware-and-driver-updates/',
    apps: [['Fanatec App', /^Fanatec App$/i], ['Fanatec Control Panel', /^Fanatec.*(Control Panel|Wheel Property)/i]], get: 'Fanatec App' },
  { id: 'logitech', name: 'Logitech', vids: ['046d'], names: /logitech|\bg(25|27|29|92[03]|pro)\b|driving force/i, url: 'https://www.logitechg.com/innovation/g-hub.html',
    apps: [['Logitech G HUB', /^Logitech G HUB$/i]], get: 'Logitech G HUB' },
  { id: 'thrustmaster', name: 'Thrustmaster', vids: ['044f'], names: /thrustmaster|\bt(150|248|300|500|598|818|gt|mx|x)\b|ts-(pc|xw)/i, url: 'https://support.thrustmaster.com/',
    apps: [['Thrustmaster Control Panel', /^Thrustmaster.*(Control Panel|Panel)$/i]], get: 'Thrustmaster drivers' },
  { id: 'simagic', name: 'Simagic', vids: ['3670', '0483:0522'], names: /simagic/i, url: 'https://simagic.com/pages/download-center',
    apps: [['SimPro Manager', /^SimPro( Manager)?$/i]], get: 'SimPro Manager' },
  { id: 'simucube', name: 'Simucube', vids: ['16d0'], names: /simucube/i, url: 'https://docs.simucube.com/Tuner/index.html',
    apps: [['Simucube Tuner', /^Simucube Tuner/i], ['Simucube True Drive', /^Simucube.*True ?Drive|^True ?Drive/i]], get: 'Simucube Tuner' },
  { id: 'asetek', name: 'Asetek', vids: [], names: /asetek|invicta|la prima|forte/i, url: 'https://www.asetek.com/simsports/racehub/',
    apps: [['RaceHub', /RaceHub/i]], get: 'RaceHub' },
  { id: 'cammus', name: 'Cammus', vids: [], names: /cammus/i, url: 'https://www.cammusracing.com/',
    apps: [['Cammus software', /^cammus/i]], get: 'Cammus software' },
  { id: 'pxn', name: 'PXN', vids: [], names: /\bpxn\b/i, url: 'https://us.e-pxn.com/pages/download',
    apps: [['PXN software', /^pxn/i]], get: 'PXN software' },
  { id: 'vrs', name: 'VRS', vids: [], names: /\bvrs\b|directforce/i, url: 'https://vrs.racing/downloads',
    apps: [['VRS DirectForce Config Tool', /directforce/i]], get: 'VRS DirectForce Config Tool' },
  { id: 'simlab', name: 'Sim-Lab', vids: [], names: /sim-?lab/i, url: 'https://sim-lab.eu/pages/racedirector-software',
    apps: [['Sim-Lab RaceDirector', /racedirector/i]], get: 'RaceDirector' }
];
const SKIP = /uninstall|readme|manual|help|website|release notes|support|update/i;

// The brand of a wheel: by USB vendor id (and product id where the vendor id is shared), then by its name.
function brandOf({ vid, pid, name } = {}) {
  const v = String(vid || '').toLowerCase().padStart(4, '0'), p = String(pid || '').toLowerCase().padStart(4, '0');
  return BRANDS.find(b => b.vids.some(x => x.includes(':') ? x === `${v}:${p}` : x === v))
    || BRANDS.find(b => b.names.test(String(name || ''))) || null;
}

const menuDirs = () => [
  path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs')
];
function shortcuts(dirs, depth = 3) {
  const out = [];
  const walk = (d, n) => { let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) { const p = path.join(d, e.name); if (e.isDirectory() && n > 0) walk(p, n - 1); else if (/\.lnk$/i.test(e.name)) out.push(p); } };
  for (const d of dirs) walk(d, depth);
  return out;
}
// The brand's software that's installed: one entry per app, the first matching shortcut for each.
function installed(brand, dirs = menuDirs()) {
  if (!brand) return [];
  const links = shortcuts(dirs).filter(l => !SKIP.test(path.basename(l)));
  const found = [];
  for (const [label, re] of brand.apps) {
    const lnk = links.find(l => re.test(path.basename(l, '.lnk').trim()));
    if (lnk) found.push({ label, lnk });
  }
  return found;
}

function info(wheel, dirs) {
  const brand = brandOf(wheel || {});
  if (!brand) return { brand: null, apps: [] };
  return { brand: { id: brand.id, name: brand.name, get: brand.get }, apps: installed(brand, dirs).map((a, i) => ({ i, label: a.label })) };
}

function register({ ipcMain, shell }) {
  ipcMain.handle('wheelsoft:info', (_e, wheel) => info(wheel));
  // Opens the brand's software by its shortcut (looked up again here; nothing from the page is run).
  ipcMain.handle('wheelsoft:open', async (_e, { wheel, i }) => {
    const a = installed(brandOf(wheel || {}))[+i || 0];
    if (!a) return { ok: false, error: 'That software isn’t installed any more.' };
    const err = await shell.openPath(a.lnk);
    return err ? { ok: false, error: err } : { ok: true, label: a.label };
  });
  // The maker's official page for its software, in the browser.
  ipcMain.handle('wheelsoft:get', (_e, wheel) => { const b = brandOf(wheel || {}); if (!b) return false; shell.openExternal(b.url); return true; });
  // Windows' Game Controllers window: Properties › Settings › Calibrate works for any wheel.
  ipcMain.handle('wheelsoft:windows', () => new Promise(res => execFile('control.exe', ['joy.cpl'], { windowsHide: false }, () => res(true))));
}

module.exports = { register, brandOf, installed, info, BRANDS };
