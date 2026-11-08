'use strict';
// EchoForge UI. Plain DOM, no framework: one state object, views rendered from it, actions via data-act.

const C = window.EF_CONSOLES, E = window.EF_EMULATORS, G = window.EF_GROUPS;
const byId = (arr, id) => arr.find(x => x.id === id);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hueVars = c => `--h1:${c.hue[0]};--h2:${c.hue[1]}`;

const I = {
  home: '<path d="M3 11 12 4l9 7v9H3z"/><path d="M9 20v-6h6v6"/>',
  lib: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  pc: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/>',
  emu: '<path d="M6 12h4M8 10v4"/><circle cx="15" cy="11" r="1"/><circle cx="17" cy="13" r="1"/><path d="M7 6h10a5 5 0 0 1 5 5v1a5 5 0 0 1-9 3h-2a5 5 0 0 1-9-3v-1a5 5 0 0 1 5-5z"/>',
  chip: '<path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M12 22V12M3 7l9 5 9-5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  play: '<path d="M7 4v16l13-8z" fill="currentColor" stroke="none"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
  scan: '<path d="M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3M7 12h10"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  link: '<path d="M14 4h6v6M20 4 10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  wand: '<path d="m15 4 5 5L9 20H4v-5zM13 6l5 5"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  stack: '<rect x="7" y="7" width="14" height="14" rx="2"/><path d="M4 17V5a1 1 0 0 1 1-1h12"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  save: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8V3M7 21v-7h10v7"/>'
};
const ico = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;

// ---------------- state ----------------
const DEFAULTS = {
  startView: 'home', launchAtLogin: false, autoScan: true,
  theme: 'ember', mode: 'dark', card: 184, titles: true, fx: true, neon: 'breathe', neonSpeed: 100, bgArt: true, bgBlur: 12, bgArtStrength: 45, motion: 'full', scale: 100, cover: 'portrait', compact: false,
  sort: 'title', hideOffline: false, showHidden: false, scanDepth: 6, ignore: '', romRoot: 'D:\\ROMs', storageRoot: '', autoArt: true, xboxUnityArt: false, gameTdbArt: false,
  shareOn: false, shareCode: '', shareHost: '', shareRemoteCode: '', shareDest: '',
  inboxFolder: '', inboxRecycle: true, inboxAutoClean: true, inboxMinFree: 15,
  dlAutoSwitch: false, dlSwitchAtGB: 100, dlTarget: 'D:\\Downloads', dlPrevFolder: '', dlSwitchedAt: 0, dlWarned: '', compatCheck: true, compatBadges: true,
  emuUpdateCheck: true, emuUpdateLast: 0, appUpdateCheck: true, appUpdateLast: 0, appUpdateLater: '',
  backupRoot: '', backupAfterPlay: true, backupWeekly: true, backupKeep: 10, backupLast: 0,
  onLaunch: 'minimize', priority: 'above', ramGuard: true, playtime: true, confirmStop: true, gameMode: true,
  gamepad: true, padLabels: 'xbox', deadzone: 0.35, rumble: true,
  sounds: true, volume: 40,
  bigpicStart: false, bigpicFullscreen: true,
  disableGpu: false, firmwareRoot: '', highContrast: false, focusStrong: false
};
let S = null;            // persisted state
let hw = { drives: [] };  // hardware probe
let route = { view: 'home', param: null };
let lib = { console: 'all', fav: false, layout: 'grid', q: '', series: '' };
let bios = {};            // console id -> check results
let inEmu = {};           // console id -> { bios id: version } found inside the emulator's own folder
let onlineRoots = {};     // 'D:\\' -> true/false
let running = null;       // { gid, started }
let emuUp = { ids: [], info: {}, busy: null, pct: 0, phase: '', checked: false }; // emulator updates (see app/emu-updates.js)
let appUp = { info: null, busy: false, pct: 0 }; // EchoForge's own updates (see app/app-updates.js)
const emuChannel = id => (S.emulators[id] || {}).channel || 'tested'; // Tested unless chosen otherwise on the Emulators page
const imgCache = new Map();

function freshState() {
  const consoles = {};
  for (const c of C) consoles[c.id] = { enabled: true, emulator: c.emulators[0], folders: [], biosDir: '', manual: {}, core: c.core || '' };
  return { v: 1, settings: { ...DEFAULTS }, emulators: {}, consoles, games: [], wizardDone: false, tourDone: false, guideCard: true, lastView: null };
}
function hydrate(raw) {
  const s = freshState();
  if (!raw) return s;
  s.settings = { ...DEFAULTS, ...(raw.settings || {}) };
  s.emulators = raw.emulators || {};
  for (const c of C) s.consoles[c.id] = { ...s.consoles[c.id], ...((raw.consoles || {})[c.id] || {}) };
  s.games = Array.isArray(raw.games) ? raw.games : [];
  s.wizardDone = !!raw.wizardDone; s.lastView = raw.lastView || null;
  s.tourDone = raw.tourDone ?? s.wizardDone; // the tour is for first installs: anyone already set up skips it
  s.guideCard = raw.guideCard ?? true;
  return s;
}
let saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { window.ef.save(S); syncShare(); }, 350); }
const set = () => (S ? S.settings : DEFAULTS);
const cc = id => S.consoles[id];
const game = id => S.games.find(g => g.id === id);
const enabledConsoles = () => C.filter(c => cc(c.id).enabled);

// ---------------- helpers ----------------
function hashId(str) { let h = 5381; for (const ch of str.toLowerCase()) h = ((h << 5) + h + ch.charCodeAt(0)) | 0; return 'g' + (h >>> 0).toString(36); }
function fmtTime(sec) { if (!sec) return 'Never played'; const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60); return h ? `${h} h ${m} m` : `${m || 1} min`; }
function fmtAgo(t) { if (!t) return '—'; const d = (Date.now() - t) / 1000; if (d < 3600) return `${Math.max(1, Math.round(d / 60))} min ago`; if (d < 86400) return `${Math.round(d / 3600)} h ago`; return `${Math.round(d / 86400)} days ago`; }
function fmtSize(b) { if (!b) return '—'; const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; while (b >= 1024 && i < 4) { b /= 1024; i++; } return `${b.toFixed(i > 1 ? 1 : 0)} ${u[i]}`; }
const rootOf = p => (p && /^[a-z]:/i.test(p) ? p.slice(0, 2).toUpperCase() + '\\' : null);
function driveInfo(p) { const r = rootOf(p); if (!r) return null; return hw.drives.find(d => d.letter && d.letter.toUpperCase() === r[0]) || null; }
function driveBadge(p) {
  const d = driveInfo(p); const r = rootOf(p) || '';
  if (!d) return `<span class="drivebadge">${esc(r)}</span>`;
  return `<span class="drivebadge s${d.kind.speed}" title="${esc(d.name)} · ${d.freeGB} GB free">${esc(r)} ${esc(d.kind.label)}</span>`;
}
function emuFor(id) { return byId(E, id); }
function emuPath(id) { return (S.emulators[id] || {}).path || ''; }
function emuArgs(id) { const e = S.emulators[id]; return (e && e.args) || emuFor(id).args; }
const trimRoot = r => (r || '').replace(/[\\/]+$/, '');
function romDir(cid) { const r = trimRoot(set().romRoot); return r ? `${r}\\${byId(C, cid).dir}` : ''; }
// Whether a game needs an SSD depends on what its console read from, never on its size: any hard drive beats a disc drive, so only PS4 and newer need one.
const needsSSD = g => byId(C, g.console).speed === 'fast';
// A game taking up SSD space it doesn't need, and where the Move button sends it.
const onSpareSSD = g => { const d = driveInfo(g.path); return !needsSSD(g) && !isOffline(g) && d && d.kind.speed >= 2; };
function storageMove(g) { const s = trimRoot(set().storageRoot), to = s && `${s}\\${byId(C, g.console).dir}`; return to && driveInfo(to) && rootOf(to) !== rootOf(g.path) ? { to } : null; }
// Where a console's games belong: "fast" consoles (PS4 and newer) on the fast root, the rest on the storage root when one is set.
function homeDir(cid) { const c = byId(C, cid), s = trimRoot(set().storageRoot); return c.speed === 'any' && s ? `${s}\\${c.dir}` : romDir(cid); }
// Suggests a better drive for a game, or null. Needs both drives online and a real speed difference.
function placement(g) {
  const c = byId(C, g.console), d = driveInfo(g.path), to = homeDir(g.console), t = driveInfo(to);
  if (!d || !t || isOffline(g) || rootOf(to) === rootOf(g.path)) return null;
  if (c.speed === 'fast' && d.kind.speed < 2 && t.kind.speed >= 2) return { to, why: `Loads slowly from a ${d.kind.label}. ${c.short} games are big and stream constantly.` };
  if (c.speed === 'any' && d.kind.speed >= 2 && t.kind.speed < d.kind.speed) return { to, why: `Doesn’t need ${d.kind.label} speed. Your ${t.kind.label} is faster than the original disc.` };
  return null;
}
const hasFolder = (cid, f) => cc(cid).folders.some(x => x.toLowerCase() === f.toLowerCase());
function biosDir(cid) { const c = cc(cid); if (c.biosDir) return c.biosDir; return set().firmwareRoot ? `${set().firmwareRoot}\\${cid}` : ''; }

function cleanTitle(file, cid) {
  const parts = file.split(/[\\/]/); let base = parts[parts.length - 1];
  if (/^eboot\.bin$/i.test(base)) {
    if (cid === 'ps3' && /usrdir/i.test(parts[parts.length - 2] || '')) base = parts[parts.length - 4] || parts[parts.length - 3];
    else base = parts[parts.length - 2];
  } else if (/^appxmanifest\.xml$/i.test(base) || /^default\.xex$/i.test(base)) base = parts[parts.length - 2];
  else base = base.replace(/\.[^.]+$/, '').replace(/\.nkit$/i, '');
  const region = (base.match(/\((USA|Europe|Japan|World|EU|US|JP|En[^)]*)[^)]*\)/i) || [])[1] || '';
  // Dots are word separators only in space-less names (Some.Game.Name); otherwise keep them (F.E.A.R. 2).
  base = base.replace(/\[[^\]]*\]|\([^)]*\)/g, '').replace(/_+/g, ' ');
  if (!/\s/.test(base.trim())) base = base.replace(/\.+/g, ' ');
  base = base.replace(/\s{2,}/g, ' ').trim();
  return { title: base || file, region };
}
// How a title is shown, like the box prints it: "Simpsons Game, The" -> "The Simpsons Game",
// "Star Wars - Battlefront II" -> "Star Wars: Battlefront II". Names the user typed are left alone.
function tt(g) { return g.renamed ? g.title : g.title.replace(/^(.*?),\s*The\b(.*)$/i, 'The $1$2').replace(/\s+-\s+/, ': '); }
function acceptFile(c, f) {
  const low = f.path.toLowerCase(); const isEboot = /[\\/]eboot\.bin$/.test(low);
  const parentUsr = /[\\/]usrdir[\\/]eboot\.bin$/.test(low);
  if (c.accept === 'ps5') return isEboot && f.meta && f.meta.ps5;
  if (c.accept === 'ps4') return low.endsWith('.pkg') || (isEboot && !(f.meta && f.meta.ps5) && !parentUsr);
  // RPCS3's dev_hdd0\game holds installed PSN games (category HG) and disc-game updates (GD); updates aren't games.
  if (c.accept === 'ps3') return low.endsWith('.iso') || (parentUsr && !(f.meta && f.meta.category === 'GD'));
  return true;
}

// ---------------- sounds ----------------
let actx = null;
function blip(kind = 'move') {
  if (!set().sounds || running) return;
  try {
    actx = actx || new AudioContext();
    const o = actx.createOscillator(), g = actx.createGain(); const v = set().volume / 100 * 0.08;
    const f = { move: 520, ok: 760, back: 300, play: 880, err: 180 }[kind] || 500;
    o.type = kind === 'play' ? 'triangle' : 'sine'; o.frequency.value = f;
    if (kind === 'play') o.frequency.exponentialRampToValueAtTime(1500, actx.currentTime + .18);
    g.gain.value = v; g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + (kind === 'play' ? .3 : .08));
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + .32);
  } catch {}
}

// ---------------- toasts & modals ----------------
function toast(msg, kind = '') {
  const t = document.createElement('div'); t.className = `toast ${kind}`; t.innerHTML = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 4200);
}
let modalOnClose = null;
function modal(html, { wide = false, onClose = null } = {}) {
  modalOnClose = onClose;
  $('#modal').innerHTML = `<div class="scrim" data-act="scrim"><div class="modal ${wide ? 'wide' : ''}" role="dialog">${html}</div></div>`;
  setTimeout(() => { const f = $('#modal .modal [data-autofocus]') || $('#modal .modal .btn.primary') || $('#modal .modal button'); f && f.focus(); }, 30);
}
function closeModal() { $('#modal').innerHTML = ''; const f = modalOnClose; modalOnClose = null; f && f(); }
function confirmBox(title, body, okLabel = 'Confirm', danger = false) {
  return new Promise(res => {
    modal(`<h3>${esc(title)}</h3><p class="muted">${body}</p>
      <div class="foot"><button class="btn ghost" data-act="cfNo">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-act="cfYes">${esc(okLabel)}</button></div>`, { onClose: () => res(false) });
    ACT.cfYes = () => { modalOnClose = null; closeModal(); res(true); };
    ACT.cfNo = () => { modalOnClose = null; closeModal(); res(false); };
  });
}

// ---------------- appearance ----------------
function applyLook() {
  const s = set(), r = document.documentElement;
  r.dataset.theme = s.theme; r.dataset.mode = s.mode; r.dataset.motion = s.motion;
  r.dataset.fx = s.fx ? 'on' : 'off'; const neon = s.neon === true ? 'breathe' : s.neon === false ? 'off' : s.neon; // older builds stored on/off
  r.dataset.neon = neon; r.dataset.glow = neon === 'off' ? 'off' : 'on'; r.style.setProperty('--nspd', (s.neonSpeed || 100) / 100);
  r.dataset.bgart = s.bgArt ? 'on' : 'off'; r.style.setProperty('--bgblur', `${s.bgBlur}px`); r.style.setProperty('--bgart-op', s.bgArtStrength / 100); r.dataset.cover = s.cover; r.dataset.titles = s.titles ? 'on' : 'off';
  r.dataset.compact = s.compact ? 'on' : 'off'; r.dataset.contrast = s.highContrast ? 'high' : 'normal'; r.dataset.focus = s.focusStrong ? 'strong' : 'normal';
  r.style.setProperty('--card', `${s.card}px`); r.style.setProperty('--scale', s.scale / 100);
}
let bigpic = false;
function setBigPicture(on) {
  bigpic = on; document.documentElement.dataset.bigpic = on ? 'on' : 'off';
  if (set().bigpicFullscreen) window.ef.win.fullscreen(on);
  if (on && set().gamepad) toast('Big Picture on — use a controller or arrow keys. F10 to exit.');
}

// ---------------- health ----------------
function health(cid) {
  const c = byId(C, cid), conf = cc(cid), issues = [];
  const emu = emuFor(conf.emulator), noEmu = c.launch === 'appx';
  if (!noEmu && !emuPath(conf.emulator)) issues.push({ lvl: 'bad', text: `${emu.name} isn’t set up yet. EchoForge needs to know where its .exe is.`, fix: 'emulators', label: 'Set up emulator' });
  if (conf.emulator === 'retroarch' && !conf.core) issues.push({ lvl: 'bad', text: 'Pick which RetroArch core this console uses.', fix: 'console:' + cid, label: 'Choose core' });
  const res = bios[cid] || [];
  const dir = biosDir(cid);
  c.bios.forEach((b, i) => {
    if (conf.manual[b.id] || emuFw(cid, b.id)) return;
    if (conf.emulator === 'retroarch' && cid === 'ps1') return;
    const r = res[i];
    let msg = null;
    if (!dir) msg = `${b.label}: no firmware folder chosen.`;
    else if (!r || !r.found) msg = `${b.label} not found in the firmware folder.`;
    else if (r.md5ok === false) msg = `${b.label} is there, but its checksum is wrong — the dump is probably bad.`;
    if (msg) issues.push({ lvl: b.required ? 'bad' : 'warn', text: msg, fix: 'firmware', label: 'Open Firmware' });
  });
  const games = S.games.filter(g => g.console === cid && !g.hidden).length;
  if (!conf.folders.length) issues.push({ lvl: 'warn', text: 'No game folders added yet.', fix: 'console:' + cid, label: 'Add a folder' });
  const ready = !issues.some(i => i.lvl === 'bad');
  const emuOk = noEmu || !!emuPath(conf.emulator);
  const biosOk = !issues.some(i => i.fix === 'firmware' && i.lvl === 'bad');
  return { issues, ready, games, emuOk, biosOk, status: ready ? (issues.length ? 'warn' : 'ok') : 'bad' };
}
const statusColor = s => ({ ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)' }[s]);

async function checkBios(cid) {
  const c = byId(C, cid); const dir = biosDir(cid);
  if (!c.bios.length) { bios[cid] = []; return; }
  bios[cid] = dir ? await window.ef.checkBios({ folder: dir, items: c.bios }) : [];
  // Firmware the emulator has already installed into its own folder (e.g. RPCS3's dev_flash) counts as present.
  inEmu[cid] = {};
  for (const b of c.bios) {
    const ie = b.inEmu, exe = ie && cc(cid).emulator === ie.emulator && emuPath(ie.emulator);
    if (!exe) continue;
    const txt = await window.ef.readText(exe.replace(/[\\/][^\\/]+$/, '') + '\\' + ie.file);
    if (txt !== null) inEmu[cid][b.id] = ((ie.version && txt.match(ie.version)) || [])[1] || 'installed';
  }
}
const emuFw = (cid, bid) => (inEmu[cid] || {})[bid];
async function checkAllBios() { await Promise.all(C.map(c => checkBios(c.id))); }
async function checkDrives() {
  const roots = [...new Set(S.games.map(g => rootOf(g.path)).filter(Boolean))];
  const ok = await window.ef.existsMany(roots);
  onlineRoots = {}; roots.forEach((r, i) => { onlineRoots[r] = ok[i]; });
}
const isOffline = g => onlineRoots[rootOf(g.path)] === false;

// ---------------- scanning ----------------
let scanning = false;
const missingFolders = new Set();
async function scanConsole(cid, quiet = false) {
  const c = byId(C, cid), conf = cc(cid);
  if (!conf.folders.length) { if (!quiet) toast(`Add a game folder for ${c.name} first.`, 'bad'); return 0; }
  const ignore = set().ignore.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  let added = 0; const seen = new Set(); const scanned = [];
  for (const folder of conf.folders) {
    if (!(await window.ef.exists(folder))) { missingFolders.add(folder.toLowerCase()); if (!quiet) toast(`Skipped ${esc(folder)} — the drive or folder isn’t available.`, 'bad'); continue; }
    missingFolders.delete(folder.toLowerCase());
    scanned.push(folder.toLowerCase());
    const files = await window.ef.scan({ folder, rule: c.rule, maxDepth: set().scanDepth });
    for (const f of files) {
      if (!acceptFile(c, f)) continue;
      if (ignore.some(s => f.path.toLowerCase().includes(s))) continue;
      // Match by path so a game moved between drives keeps its id, playtime, favorite and cover.
      const existing = S.games.find(x => x.console === cid && x.path.toLowerCase() === f.path.toLowerCase());
      const id = existing ? existing.id : hashId(cid + '|' + f.path); seen.add(id);
      const t = cleanTitle(f.path, cid);
      const meta = f.meta || {};
      if (meta.title) meta.title = meta.title.replace(/[™®©]/g, '').replace(/\s{2,}/g, ' ').trim(); // "Need for Speed™ Most Wanted"
      if (existing) { existing.size = f.size; if (meta.icon) { existing.icon = meta.icon; existing.iconSmall = !!meta.iconSmall; } if (meta.bg) existing.bg = meta.bg; if (meta.titleId) existing.titleId = meta.titleId; if (!existing.renamed) existing.title = meta.title || t.title; continue; }
      S.games.push({ id, console: cid, path: f.path, title: meta.title || t.title, region: t.region, titleId: meta.titleId || '', icon: meta.icon || '', iconSmall: !!meta.iconSmall, bg: meta.bg || '', size: f.size, added: Date.now(), playtime: 0, lastPlayed: 0, fav: false, hidden: false });
      added++;
    }
  }
  // Only games under a folder that was actually scanned can be dropped; unplugged drives keep their games.
  await checkDrives();
  const before = S.games.length;
  S.games = S.games.filter(g => g.console !== cid || seen.has(g.id) || isOffline(g) || !scanned.some(f => g.path.toLowerCase().startsWith(f)));
  const removed = before - S.games.length;
  save();
  if (!quiet) toast(`${c.name}: ${added} new game${added === 1 ? '' : 's'} found${removed ? `, ${removed} missing removed` : ''}.`, 'ok');
  if (added && !scanning) fetchMissingArt();
  return added;
}
// Box art for games that have neither their own icon nor a cover. Misses are retried after a week.
let fetchingArt = false, artAgain = false;
async function fetchMissingArt(force = false) {
  if (fetchingArt) { artAgain = true; return 0; } // asked again mid-run (a cover source was turned on): go round once more
  if (!set().autoArt && !force) return 0;
  fetchingArt = true; let n = 0;
  for (const g of S.games) {
    // Small or wide disc icons (PSP, PS3) still look for box art, so every card is a full cover.
    if (g.cover || (g.icon && !g.iconSmall && g.console !== 'ps3') || g.noArt) continue;
    if (!force && g.artTried && Date.now() - g.artTried < 7 * 864e5) continue;
    const parts = g.path.split(/[\\/]/);
    const base = parts[parts.length - 1].replace(/\.[^.]+$/, '').replace(/\.nkit$/i, '');
    // A PS3 game is always EBOOT.BIN: its game folder ("Title [BLUS00001]") carries the name.
    const folder = /^eboot$/i.test(base) ? cleanTitle(g.path, g.console).title : parts[parts.length - 2];
    const r = await window.ef.fetchArt({ id: g.id, console: g.console, names: [g.title, folder, base], file: g.path, xboxUnity: set().xboxUnityArt, gameTdb: set().gameTdbArt, titleId: g.titleId });
    g.artTried = Date.now();
    if (r && r.ok) { imgCache.delete(r.path); g.cover = r.path; g.artAuto = true; n++; } // same file name may already be cached
  }
  fetchingArt = false;
  if (n) { save(); if (['home', 'library', 'console'].includes(route.view)) render(); }
  if (artAgain) { artAgain = false; n += await fetchMissingArt(force); }
  return n;
}
async function scanAll(quiet = true) {
  if (scanning) return; scanning = true;
  let n = 0; for (const c of enabledConsoles()) if (cc(c.id).folders.length) n += await scanConsole(c.id, true);
  scanning = false; fetchMissingArt();
  if (!quiet || n) toast(`Library scan finished — ${n} new game${n === 1 ? '' : 's'}.`, 'ok');
  renderSide(); if (['home', 'library', 'console'].includes(route.view)) render();
}

// ---------------- launching ----------------
async function play(gid) {
  const g = game(gid); if (!g) return;
  if (running) return toast('A game is already running. Stop it first.', 'bad');
  const c = byId(C, g.console), conf = cc(g.console);
  const emuId = g.emu || conf.emulator;
  if (isOffline(g) || !(await window.ef.exists(g.path))) {
    return modal(`<h3>Game file not found</h3><p class="muted">EchoForge can’t reach <span class="mono">${esc(g.path)}</span>.</p>
      <div class="issue">${ico('folder')}<div class="grow">If this game lives on a USB drive (${esc(rootOf(g.path))}), plug it in and try again. Nothing was deleted.</div></div>
      <div class="foot"><button class="btn ghost" data-act="close">Close</button><button class="btn primary" data-act="retryPlay" data-arg="${g.id}">Try again</button></div>`);
  }
  const h = health(g.console);
  const blocking = h.issues.filter(i => i.lvl === 'bad' && !(g.emu && i.fix === 'emulators'));
  if (g.emu && !emuPath(g.emu)) blocking.unshift({ lvl: 'bad', text: `${emuFor(g.emu).name} (set for this game) isn’t set up.`, fix: 'emulators', label: 'Set up emulator' });
  if (blocking.length) return fixModal(c, blocking);
  if (g.compat && g.compat.status === 'bad' && !g.compatOk) { // asked once per game
    const ok = await confirmBox(`${g.title} may not work yet`, `${esc(g.compat.source)} testers report <b>${esc(g.compat.label.toLowerCase())}</b>${g.compat.date ? ` (last tested ${esc(g.compat.date)})` : ''}. Newer emulator builds sometimes fix this, so it’s worth a try.`, 'Play anyway');
    if (!ok) return; g.compatOk = true; save();
  }
  if (set().ramGuard) {
    const free = await window.ef.freeRam();
    if (free < c.ram) {
      const go = await confirmBox('Low memory', `Only <b>${free} GB</b> of RAM is free and ${esc(c.short)} emulation wants about <b>${c.ram} GB</b>. Close browsers, Discord overlays or other games first for smooth play.`, 'Play anyway');
      if (!go) return;
    }
  }
  blip('play');
  const res = c.launch === 'appx'
    ? await window.ef.launchAppx({ manifest: g.path, gameId: g.id, onLaunch: set().onLaunch, priority: set().priority })
    : await window.ef.launch({ exe: emuPath(emuId), args: g.args || emuArgs(emuId), rom: g.path, core: conf.core, gameId: g.id, onLaunch: set().onLaunch, priority: set().priority });
  if (res.needsInstall) { blip('err'); return modal(`<h3>${esc(tt(g))} needs installing first</h3><p class="muted">${esc(res.error)}</p><div class="foot"><button class="btn ghost" data-act="close">Close</button><button class="btn primary" data-act="go" data-arg="guide">Open the Guide</button></div>`); }
  if (!res.ok) { blip('err'); return modal(`<h3>Couldn’t start the game</h3><div class="issue">${esc(res.error)}</div><div class="foot"><button class="btn ghost" data-act="close">Close</button><button class="btn primary" data-act="go" data-arg="emulators">Check emulator</button></div>`); }
  running = { gid: g.id, started: Date.now() };
  if (set().gameMode) document.body.classList.add('playing');
  $('#np').classList.add('on'); $('#npText').textContent = `Playing ${g.title}`;
  closeModal();
}
function fixModal(c, issues) {
  blip('err');
  modal(`<h3>${esc(c.name)} needs a quick fix</h3><p class="muted">Sort these out and the game will launch. Each button takes you to the right place.</p>
    ${issues.map(i => `<div class="issue ${i.lvl === 'warn' ? 'warn' : ''}"><div class="grow">${esc(i.text)}</div><button class="btn sm primary" data-act="go" data-arg="${i.fix}">${esc(i.label)}</button></div>`).join('')}
    <div class="foot"><button class="btn ghost" data-act="close">Close</button></div>`);
}
window.ef.onGameExit(({ gameId, seconds, error }) => {
  const g = game(gameId); running = null;
  document.body.classList.remove('playing'); $('#np').classList.remove('on');
  if (g) { if (set().playtime) g.playtime = (g.playtime || 0) + seconds; g.lastPlayed = Date.now(); save(); }
  if (g && !error && set().backupAfterPlay) backupSaves([g.emu || cc(g.console).emulator], 'after playing ' + g.title, true);
  if (error) {
    const appxGame = g && byId(C, g.console).launch === 'appx';
    if (appxGame) return modal(`<h3>The game didn’t start</h3><p class="muted">${esc(error)}</p><div class="foot"><button class="btn ghost" data-act="close">Close</button><button class="btn primary" data-act="go" data-arg="guide">Open the Guide</button></div>`);
    modal(`<h3>The emulator closed right away</h3><p class="muted">${g ? esc(g.title) : 'The game'} stopped after ${seconds}s.</p>
      <div class="issue"><span class="mono">${esc(error)}</span></div>
      <p class="small muted">Common causes: missing firmware, the wrong file type for this emulator, or launch options that don’t match the emulator version. Open the emulator on its own once to finish its first-time setup.</p>
      <div class="foot"><button class="btn ghost" data-act="close">Close</button><button class="btn primary" data-act="go" data-arg="emulators">Emulator settings</button></div>`);
  } else if (g && seconds > 30) toast(`Session saved — ${fmtTime(seconds)} in ${esc(tt(g))}.`, 'ok');
  render();
});

// ---------------- compatibility ----------------
// PS3 and Xbox 360 emulation is still young, so those games get a "will it run?" badge from the emulator's own tester list.
const COMPAT_CONSOLES = new Set(['ps3', 'x360']);
function compatBadge(g) {
  const k = g.compat; if (!set().compatBadges || !k || !COMPAT_CONSOLES.has(g.console)) return '';
  return `<span class="compat ${k.status}" title="${esc(`${k.label} · ${k.source}${k.date ? ' · tested ' + k.date : ''}`)}">${esc(k.label)}</span>`;
}
function applyCompat(id, result, titleId) {
  const g = game(id); if (!g) return;
  g.compat = { ...result, checked: Date.now() }; if (titleId && !g.titleId) g.titleId = titleId;
  save();
  for (const box of $$(`[data-play="${id}"] .cover`)) { const old = box.querySelector('.compat'); if (old) old.remove(); box.insertAdjacentHTML('beforeend', compatBadge(g)); }
}
async function checkCompat() {
  if (!set().compatCheck) return;
  const list = S.games.filter(g => COMPAT_CONSOLES.has(g.console) && !isOffline(g)).map(g => ({ id: g.id, console: g.console, titleId: g.titleId || '', file: g.path }));
  if (!list.length) return;
  const r = await window.ef.checkCompat(list);
  for (const [id, res] of Object.entries(r.now)) applyCompat(id, res);
}
window.ef.onCompat(v => applyCompat(v.id, v.result, v.titleId));

// ---------------- collections ----------------
// Series are found from titles: games sharing their leading words ("Star Wars …", "SOCOM U.S. Navy SEALs …") form a
// collection, across consoles. A one-word prefix that's too generic ("Dead", "Super") needs a second shared word.
// A game can also be put in a collection by hand (g.series = name) or kept out of one (g.series = '-').
const SERIES_STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'for', 'to', 'in', 'on', 'vs', 'vs.', '&']);
const SERIES_GENERIC = new Set(['dead', 'super', 'world', 'new', 'pro', 'real', 'big', 'ultimate', 'final', 'grand', 'dark', 'black', 'red', 'fast', 'great', 'little', 'mega', 'my', 'classic', 'extreme', 'total', 'legend', 'legends', 'top', 'air', 'street', 'space', 'star', 'hot', 'ghost', 'army']);
function seriesWords(title) {
  const t = title.replace(/^(.*?),\s*the\b/i, 'The $1').replace(/\s+[-–:]\s+|:\s+/g, ' ').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');
  const words = t.split(/\s+/).filter(Boolean);
  while (words.length && /^(the|a|an)$/i.test(words[0])) words.shift();
  return { words, keys: words.map(w => w.toLowerCase().replace(/['’]/g, '').replace(/[,;!?]+$/, '')) };
}
const seriesOk = ks => !SERIES_STOP.has(ks[0]) && !SERIES_STOP.has(ks[ks.length - 1]) && (ks.length > 1 || (!SERIES_GENERIC.has(ks[0]) && (ks[0].length >= 3 || /\d/.test(ks[0]))));
let seriesMemo = { sig: '', byGame: new Map(), list: [] };
function seriesData() {
  const vis = S.games.filter(g => !g.hidden);
  const sig = vis.map(g => g.id + '\u0001' + g.title + '\u0001' + (g.series || '')).join('\u0002');
  if (sig === seriesMemo.sig) return seriesMemo;
  const items = vis.filter(g => !g.series).map(g => ({ g, ...seriesWords(g.title) }));
  const cnt = new Map();
  for (const it of items) for (let n = 1; n <= Math.min(6, it.keys.length); n++) { const k = it.keys.slice(0, n).join(' '); cnt.set(k, (cnt.get(k) || 0) + 1); }
  const groups = new Map(); // key -> { key, name, games }
  const add = (key, name, g) => { if (!groups.has(key)) groups.set(key, { key, name, games: [] }); groups.get(key).games.push(g); };
  const loose = [];
  for (const it of items) {
    let n = 0;
    for (let i = 1; i <= Math.min(3, it.keys.length); i++) if ((cnt.get(it.keys.slice(0, i).join(' ')) || 0) >= 2 && seriesOk(it.keys.slice(0, i))) { n = i; break; }
    if (!n) { loose.push(it); continue; }
    while (n < it.keys.length && cnt.get(it.keys.slice(0, n + 1).join(' ')) === cnt.get(it.keys.slice(0, n).join(' '))) n++; // every member shares the next word too
    while (n > 1 && SERIES_STOP.has(it.keys[n - 1])) n--;
    add(it.keys.slice(0, n).join(' '), it.words.slice(0, n).join(' '), it.g);
  }
  // Leftovers that contain another title's opening words ("Escape Dead Island" + "Dead Island Riptide").
  const contains = (ks, ph) => { for (let i = 1; i + ph.length <= ks.length; i++) if (ph.every((p, j) => ks[i + j] === p)) return true; return false; };
  const used = new Set();
  for (const a of loose) for (let n = Math.min(4, a.keys.length); n >= 2; n--) {
    const ph = a.keys.slice(0, n); if (!seriesOk(ph) || used.has(a)) continue;
    const key = ph.join(' '), mates = loose.filter(b => b !== a && !used.has(b) && contains(b.keys, ph));
    if (groups.has(key) || mates.length) { for (const b of [a, ...mates]) { add(key, a.words.slice(0, n).join(' '), b.g); used.add(b); } break; }
  }
  for (const g of vis) if (g.series && g.series !== '-') { const k = seriesWords(g.series).keys.join(' '); add(k, groups.has(k) ? groups.get(k).name : g.series, g); } // chosen by hand; joins a found series of the same name
  const list = [...groups.values()].filter(s => s.games.length >= 2).sort((a, b) => b.games.length - a.games.length || a.name.localeCompare(b.name));
  const byGame = new Map(); for (const s of list) for (const g of s.games) byGame.set(g.id, s);
  seriesMemo = { sig, byGame, list };
  return seriesMemo;
}
const seriesOfGame = g => seriesData().byGame.get(g.id) || null;
function seriesTile(s) {
  const pics = s.games.filter(g => g.cover || g.icon).slice(0, 4), cons = [...new Set(s.games.map(g => byId(C, g.console).short))];
  return `<button class="stile" data-act="openSeries" data-arg="${esc(s.key)}" style="${hueVars(byId(C, s.games[0].console))}" title="${esc(s.name)}">
    <div class="mosaic n${pics.length}">${pics.map(g => `<div class="m"><img data-img="${esc(g.cover || g.icon)}" alt=""></div>`).join('')}</div>
    <div class="nm">${esc(s.name)}</div><div class="mk">${s.games.length} games · ${esc(cons.join(' · '))}</div></button>`;
}

// ---------------- covers ----------------
function coverHTML(g, opts = {}) {
  const c = byId(C, g.console); const src = g.cover || g.icon;
  return `<div class="cover" style="${hueVars(c)}">
    ${opts.tag !== false ? `<span class="tag">${esc(c.short)}</span>` : ''}
    ${opts.tag !== false ? compatBadge(g) : ''}
    ${g.fav ? `<span class="fav">${ico('star', 16)}</span>` : ''}
    <div class="gen"><div class="m">${esc(c.short)}</div><div class="t">${esc(tt(g))}</div></div>
    ${src ? `<img data-img="${esc(src)}" ${!g.cover && g.bg ? `data-bg="${esc(g.bg)}"` : ''} alt="" style="position:absolute;inset:0;opacity:0;transition:opacity .25s">` : ''}
    ${opts.play !== false ? `<div class="playov"><span>${ico('play', 22)}</span></div>` : ''}
  </div>`;
}
async function cachedImage(p) { let d = imgCache.get(p); if (d === undefined) { d = await window.ef.readImage(p); imgCache.set(p, d); } return d; }
const imgWide = new Map(); // src -> wide-icon flag, learned on first load so redraws can lay the card out at once
async function hydrateImages(root = document) {
  const imgs = $$('img[data-img]', root);
  const place = (img, d, bd, wide) => {
    const box = img.parentElement; box.classList.add('has-img');
    // Wide icons (PS3/PS4 ICON0 is 320x176) would be cropped in a tall card: fit them over a blurred copy instead.
    // PSP games show their icon over the game's own menu background (PIC1) when there's no box art.
    if (wide && box.clientHeight > box.clientWidth) { box.classList.add('wide-img'); if (bd) box.classList.add('psp-bg'); box.style.setProperty('--art', `url("${bd || d}")`); }
  };
  // Images already seen are put in place in the same frame as the redraw, so cards don't blank and fade in again.
  for (const img of imgs) {
    const p = img.dataset.img, bgP = img.dataset.bg, d = imgCache.get(p);
    if (!d || !imgWide.has(p) || (bgP && imgCache.get(bgP) === undefined)) continue;
    img.removeAttribute('data-img'); img.style.transition = 'none'; img.style.opacity = 1; img.src = d;
    place(img, d, bgP ? imgCache.get(bgP) : null, imgWide.get(p));
  }
  for (const img of imgs) {
    if (!img.dataset.img) continue;
    const p = img.dataset.img, bgP = img.dataset.bg; img.removeAttribute('data-img');
    const d = await cachedImage(p), bd = bgP ? await cachedImage(bgP) : null;
    if (d) { img.src = d; img.onload = () => {
      img.style.opacity = 1; const wide = img.naturalWidth > img.naturalHeight * 1.2; imgWide.set(p, wide); place(img, d, bd, wide);
    }; }
  }
}
// The best full-screen picture: the game's own HD/menu background (PS3/PSP PIC1), an in-game screenshot, then the cover.
const backdropOf = g => g && (g.bg || g.snap || g.titleShot || g.cover || g.icon);
// Background art: whichever game card is under the mouse or has controller focus. Stays on the last one.
let bgArtId = null, bgArtSide = 0, bgArtT = null;
function showBgArt(id) {
  if (!set().bgArt || id === bgArtId) return;
  clearTimeout(bgArtT);
  bgArtT = setTimeout(async () => {
    const src = backdropOf(game(id)); if (!src) return;
    const d = await cachedImage(src); if (!d) return;
    bgArtId = id; const layers = $$('#bgArt i'); bgArtSide ^= 1;
    layers[bgArtSide].style.backgroundImage = `url("${d}")`;
    layers[bgArtSide].classList.add('on'); layers[bgArtSide ^ 1].classList.remove('on');
  }, 120); // skip cards the pointer only passes over
}
// Card tilt: the cover leans toward the pointer (the CSS only applies it with full motion).
document.addEventListener('pointermove', e => {
  const card = e.target.closest && e.target.closest('.game'); if (!card || set().motion !== 'full') return;
  const box = card.querySelector('.cover'), r = box.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
  box.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`); box.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
});
document.addEventListener('pointerout', e => { const card = e.target.closest && e.target.closest('.game'); if (card && !card.contains(e.relatedTarget)) { const box = card.querySelector('.cover'); box.style.removeProperty('--rx'); box.style.removeProperty('--ry'); } });
for (const ev of ['mouseover', 'focusin']) document.addEventListener(ev, e => { const el = e.target.closest && e.target.closest('[data-play]'); if (el) showBgArt(el.dataset.play); });

function gameCard(g) {
  const c = byId(C, g.console);
  return `<button class="game ${isOffline(g) ? 'offline' : ''}" data-act="openGame" data-arg="${g.id}" data-play="${g.id}" title="${esc(tt(g))}">
    ${coverHTML(g)}
    <div class="gt">${esc(tt(g))}</div>
    <div class="gm">${isOffline(g) ? 'Drive offline' : g.lastPlayed ? fmtAgo(g.lastPlayed) : esc(c.name)}</div>
  </button>`;
}

// ---------------- sidebar ----------------
function renderSide() {
  const v = route.view, p = route.param;
  const nav = (view, label, icon, param = null, badge = '') =>
    `<button class="nav ${v === view && (param === null || p === param) ? 'active' : ''}" data-act="go" data-arg="${view}${param ? ':' + param : ''}">${ico(icon)}<span>${label}</span>${badge ? `<span class="badge">${badge}</span>` : ''}</button>`;
  const ib = inboxReady().length + inbox.items.filter(i => i.status === 'risky').length;
  let html = nav('home', 'Home', 'home') + nav('library', 'All Games', 'lib', null, S.games.filter(g => !g.hidden).length || '') + nav('collections', 'Collections', 'stack', null, seriesData().list.length || '') + nav('inbox', 'Import', 'inbox', null, ib || '') + nav('shared', 'Shared games', 'share') + nav('pc', 'Your PC', 'pc');
  for (const grp of G) {
    const cs = enabledConsoles().filter(c => c.group === grp.id); if (!cs.length) continue;
    html += `<h6>${esc(grp.name)}</h6>`;
    for (const c of cs) {
      const h = health(c.id);
      html += `<button class="nav ${v === 'console' && p === c.id ? 'active' : ''}" data-act="go" data-arg="console:${c.id}" title="${esc(c.name)}">
        <span class="chip" style="background:linear-gradient(140deg,${c.hue[0]},${c.hue[1]})">${esc(c.short)}</span><span>${esc(c.name)}</span>
        <span class="badge">${h.games || ''}</span><i class="st" style="background:${statusColor(h.status)}" title="${h.ready ? 'Ready' : 'Needs setup'}"></i></button>`;
    }
  }
  html += `<h6>Forge</h6>` + nav('emulators', 'Emulators', 'emu') + nav('firmware', 'Firmware & BIOS', 'shield') + nav('backups', 'Save backups', 'save') + nav('settings', 'Settings', 'gear') + nav('guide', 'Guide', 'book');
  if (html !== lastSide) { lastSide = html; $('#side').innerHTML = html; } // rebuilding restarts the neon animations: a visible flash
}
let lastSide = '', lastMain = '';

// ---------------- views ----------------
const V = {};

V.home = () => {
  const vis = S.games.filter(g => !g.hidden);
  const recent = vis.filter(g => g.lastPlayed).sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, 12);
  const added = [...vis].sort((a, b) => b.added - a.added).slice(0, 12);
  const favs = vis.filter(g => g.fav).slice(0, 12);
  const hero = recent[0];
  const totalTime = vis.reduce((s, g) => s + (g.playtime || 0), 0);
  const readyCount = enabledConsoles().filter(c => health(c.id).ready).length;
  const heroHTML = hero ? `
    <section class="hero" style="${hueVars(byId(C, hero.console))}">
      ${hero.cover || hero.icon ? `<div class="art" id="heroArt"></div>` : ''}
      <div class="kicker">Continue · ${esc(byId(C, hero.console).name)}</div>
      <div class="title">${esc(tt(hero))}</div>
      <div class="muted" style="margin-bottom:18px">${fmtTime(hero.playtime)} played · last session ${fmtAgo(hero.lastPlayed)}</div>
      <div class="row"><button class="btn primary lg" data-act="play" data-arg="${hero.id}">${ico('play')} Play</button><button class="btn lg ghost" data-act="openGame" data-arg="${hero.id}">Details</button></div>
    </section>` : `
    <section class="hero">
      <img class="welcome-mark" src="assets/logo.svg" alt="">
      <div class="kicker">Welcome to the forge</div>
      <div class="title">Every console.<br>One launcher.</div>
      <div class="muted" style="margin-bottom:18px;max-width:520px">${S.games.length ? 'Pick a game below to start your first session.' : 'Point EchoForge at your emulators and game folders — on any drive — and it builds your libraries automatically.'}</div>
      <div class="row"><button class="btn primary lg" data-act="wizard">${ico('wand')} ${S.wizardDone ? 'Run setup again' : 'Start setup'}</button><button class="btn lg ghost" data-act="go" data-arg="pc">See your PC</button></div>
    </section>`;
  const au = appUp.info, appCard = au && au.ok && au.update && set().appUpdateLater !== au.latest.version ? `<div class="panel glow guide-card"><div class="grow"><b>EchoForge ${esc(au.latest.version)} is ready</b><div class="small muted">You have ${esc(appVersion)}. Updating keeps your library and settings.</div></div>
      <button class="btn primary" data-act="appUpdate" ${appUp.busy ? 'disabled' : ''}>${appUp.busy ? `Downloading ${appUp.pct}%` : 'Update now'}</button><button class="btn ghost" data-act="url" data-arg="${esc(au.latest.page)}">What’s new</button><button class="btn ghost" data-act="appUpLater">Later</button></div>` : '';
  const guideCard = S.guideCard ? `<div class="panel glow guide-card"><div class="grow"><b>New here?</b><div class="small muted">The Guide walks you through everything step by step. Press F1 to open it any time.</div></div>
      <button class="btn primary" data-act="go" data-arg="guide">${ico('book')} Open the Guide</button><button class="btn ghost" data-act="tour">Take the tour</button><button class="btn ghost" data-act="guideCardClose" title="Hide this card">Close</button></div>` : '';
  return `<div class="view">
    ${heroHTML}
    ${appCard}
    ${guideCard}
    <div class="stats">
      <div class="panel stat"><div class="n">${vis.length}</div><div class="l">Games</div></div>
      <div class="panel stat"><div class="n">${readyCount}<span class="faint">/${enabledConsoles().length}</span></div><div class="l">Consoles ready</div></div>
      <div class="panel stat"><div class="n">${Math.round(totalTime / 3600)}<span class="faint"> h</span></div><div class="l">Played</div></div>
      <div class="panel stat"><div class="n">${favs.length}</div><div class="l">Favorites</div></div>
    </div>
    ${recent.length > 1 ? `<div class="h2">Jump back in</div><div class="shelf">${recent.slice(1).map(gameCard).join('')}</div>` : ''}
    ${favs.length ? `<div class="h2">Favorites</div><div class="shelf">${favs.map(gameCard).join('')}</div>` : ''}
    ${added.length ? `<div class="h2">Recently added</div><div class="shelf">${added.map(gameCard).join('')}</div>` : ''}
    ${seriesData().list.length ? `<div class="h2">Collections <button class="btn sm ghost" data-act="go" data-arg="collections" style="margin-left:10px">See all</button></div><div class="shelf colls">${seriesData().list.slice(0, 12).map(seriesTile).join('')}</div>` : ''}
    ${G.map(grp => { const cs = enabledConsoles().filter(c => c.group === grp.id); if (!cs.length) return '';
      return `<div class="h2">${esc(grp.name)}</div><p class="sub small" style="margin-top:-6px">${esc(grp.blurb)}</p><div class="ctiles">${cs.map(consoleTile).join('')}</div>`; }).join('')}
  </div>`;
};
function consoleTile(c) {
  const h = health(c.id);
  const pill = h.ready ? (h.games ? `<span class="pill ok">Ready</span>` : `<span class="pill warn">Add games</span>`) : `<span class="pill bad">Needs setup</span>`;
  const mat = c.maturity === 'experimental' ? `<span class="pill info plain">Experimental</span>` : '';
  return `<button class="ctile" style="${hueVars(c)}" data-act="go" data-arg="console:${c.id}">
    <i class="stripe"></i><span class="mono-big">${esc(c.short)}</span>
    <span class="nm">${esc(c.name)}</span><span class="mk">${esc(c.maker)} · ${c.year}</span>
    <span class="ft">${pill}${mat}<span class="grow"></span><span class="faint small">${h.games} games</span></span></button>`;
}

function filteredGames(cid) {
  const s = set(); const q = lib.q.trim().toLowerCase();
  let list = S.games.filter(g => (s.showHidden || !g.hidden) && (!s.hideOffline || !isOffline(g)) && cc(g.console).enabled);
  if (cid) list = list.filter(g => g.console === cid);
  else if (lib.console !== 'all') list = list.filter(g => g.console === lib.console);
  if (lib.fav) list = list.filter(g => g.fav);
  if (lib.series && !cid) list = list.filter(g => { const s = seriesOfGame(g); return s && s.key === lib.series; });
  if (q) list = list.filter(g => g.title.toLowerCase().includes(q) || (g.titleId || '').toLowerCase().includes(q));
  const sorters = { title: (a, b) => a.title.localeCompare(b.title), recent: (a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0), playtime: (a, b) => (b.playtime || 0) - (a.playtime || 0), added: (a, b) => b.added - a.added, size: (a, b) => (b.size || 0) - (a.size || 0) };
  return list.sort(sorters[s.sort] || sorters.title);
}
function gameToolbar(cid) {
  const s = set();
  return `<div class="toolbar">
    ${cid ? '' : `<div class="chips"><button class="fchip ${lib.console === 'all' ? 'on' : ''}" data-act="libConsole" data-arg="all">All</button>${enabledConsoles().filter(c => S.games.some(g => g.console === c.id)).map(c => `<button class="fchip ${lib.console === c.id ? 'on' : ''}" data-act="libConsole" data-arg="${c.id}">${esc(c.short)}</button>`).join('')}</div>`}
    <button class="fchip ${lib.fav ? 'on' : ''}" data-act="libFav">${ico('star', 13)} Favorites</button>
    ${!cid && lib.series ? `<button class="fchip on" data-act="clearSeries" title="Show every game">${ico('stack', 13)} ${esc((seriesData().list.find(s => s.key === lib.series) || { name: 'Collection' }).name)} ✕</button>` : ''}
    <span class="grow"></span>
    <select class="input" data-set="sort" title="Sort">${[['title', 'A → Z'], ['recent', 'Recently played'], ['playtime', 'Most played'], ['added', 'Recently added'], ['size', 'Largest']].map(([v, l]) => `<option value="${v}" ${s.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <button class="iconbtn ${lib.layout === 'grid' ? 'on' : ''}" data-act="libLayout" data-arg="grid" title="Grid">${ico('grid')}</button>
    <button class="iconbtn ${lib.layout === 'list' ? 'on' : ''}" data-act="libLayout" data-arg="list" title="List">${ico('list')}</button>
  </div>`;
}
function gameCollection(list, cid) {
  if (!list.length) {
    const c = cid && byId(C, cid);
    return `<div class="empty"><div class="big">${lib.q ? 'No matches' : 'No games here yet'}</div>
      <div>${lib.q ? `Nothing matches “${esc(lib.q)}”.` : c ? `Add a folder that holds your ${esc(c.name)} games — any drive works.` : 'Add game folders on a console page, then scan.'}</div>
      ${!lib.q && c ? `<div class="row" style="justify-content:center;margin-top:16px"><button class="btn primary" data-act="addFolder" data-arg="${c.id}">${ico('folder')} Add game folder</button></div>` : ''}</div>`;
  }
  if (lib.layout === 'list') {
    return `<div class="glist">${list.map(g => { const c = byId(C, g.console); return `<button class="li ${isOffline(g) ? 'offline' : ''}" data-act="openGame" data-arg="${g.id}" data-play="${g.id}">
      <div class="thumb">${coverHTML(g, { tag: false, play: false })}</div><div><b>${esc(tt(g))}</b><div class="small faint">${esc(g.titleId || g.region || '')}</div></div>
      <div class="small">${esc(c.short)}</div><div class="small muted">${fmtTime(g.playtime)}</div><div class="small muted">${fmtAgo(g.lastPlayed)}</div><div class="small faint">${isOffline(g) ? 'Offline' : fmtSize(g.size)}</div></button>`; }).join('')}</div>`;
  }
  return `<div class="games">${list.map(gameCard).join('')}</div>`;
}

V.collections = () => {
  const list = seriesData().list;
  return `<div class="view"><h1 class="h1">Collections</h1><p class="sub">Series EchoForge found in your library, across every console. Open a game’s details to move it into a collection or keep it out of one.</p>
    ${list.length ? `<div class="colls grid">${list.map(seriesTile).join('')}</div>` : `<div class="empty"><div class="big">No collections yet</div><div>When two or more games share a series name, they show up here.</div></div>`}</div>`;
};

V.library = () => {
  const list = filteredGames(null);
  const ser = lib.series && seriesData().list.find(s => s.key === lib.series);
  if (ser) return `<div class="view"><h1 class="h1">${esc(ser.name)}</h1><p class="sub">${list.length} game${list.length === 1 ? '' : 's'} in this collection.</p>
    ${gameToolbar(null)}${gameCollection(list, null)}</div>`;
  return `<div class="view"><h1 class="h1">All Games</h1><p class="sub">${list.length} game${list.length === 1 ? '' : 's'} across every console section.${lib.q ? ` Searching “${esc(lib.q)}”.` : ''}</p>
    ${gameToolbar(null)}${gameCollection(list, null)}</div>`;
};

let consoleTab = 'games';
V.console = (cid) => {
  const c = byId(C, cid); if (!c) return V.home();
  const conf = cc(cid), h = health(cid), emu = emuFor(conf.emulator);
  const tune = window.efTune(hw, cid);
  const chk = (ok, warn, title, body) => `<div class="check"><div class="ic ${ok ? 'ok' : warn ? 'warn' : 'bad'}">${ok ? '✓' : '!'}</div><div><b>${title}</b><div class="small muted">${body}</div></div></div>`;
  const biosNeeded = c.bios.some(b => b.required);
  const tabs = ['games', 'setup', 'tuning'];
  let body = '';
  if (consoleTab === 'games') body = gameToolbar(cid) + gameCollection(filteredGames(cid), cid);
  if (consoleTab === 'setup') body = consoleSetup(c);
  if (consoleTab === 'tuning') body = tuningPanel(c, tune);
  return `<div class="view">
    <section class="chead" style="${hueVars(c)}"><span class="big">${esc(c.short)}</span><i class="glowbar"></i>
      <div class="grow" style="position:relative">
        <div class="row" style="gap:8px">${c.maturity === 'experimental' ? '<span class="pill info plain">Experimental</span>' : ''}<span class="pill plain">${esc(c.maker)} · ${c.year}</span><span class="pill plain">For your PC: ${esc(tune.rating)}</span></div>
        <h1 class="h1" style="margin-top:10px">${esc(c.name)}</h1>
        <div class="checklist">
          ${chk(h.emuOk, false, 'Emulator', c.launch === 'appx' ? 'None needed: games installed with WinDurango start directly' : h.emuOk ? `${esc(emu.name)} linked` : `${esc(emu.name)} not linked`)}
          ${(() => { const miss = h.issues.filter(i => i.fix === 'firmware');
            return chk(!miss.length, h.biosOk, 'Firmware', !c.bios.length ? 'None needed' : !miss.length ? 'All present' : h.biosOk ? 'Optional files missing' : 'Missing files'); })()}
          ${chk(h.games > 0, true, 'Games', h.games ? `${h.games} in library` : 'None found yet')}
        </div>
      </div>
      <div style="position:relative;display:flex;flex-direction:column;gap:8px">
        <button class="btn primary" data-act="scanConsole" data-arg="${cid}">${ico('scan')} Scan now</button>
        <button class="btn" data-act="addFolder" data-arg="${cid}">${ico('folder')} Add folder</button>
        ${!h.ready ? `<button class="btn ghost" data-act="showFix" data-arg="${cid}">What’s missing?</button>` : ''}
      </div>
    </section>
    <div class="tabs">${tabs.map(t => `<button class="tab ${consoleTab === t ? 'on' : ''}" data-act="ctab" data-arg="${t}">${{ games: 'Library', setup: 'Setup', tuning: 'Tuned for your PC' }[t]}</button>`).join('')}</div>
    ${body}</div>`;
};
function consoleSetup(c) {
  const conf = cc(c.id);
  return `<div class="grid2" style="grid-template-columns:minmax(300px,1fr) minmax(460px,1.6fr)">
    <div class="panel"><div class="h2" style="margin-top:0">Emulator core</div>
      ${c.launch === 'appx' ? `<p class="small muted">No emulator to link. Install each game with WinDurango’s steps: copy WinDurango’s files into the game, turn on Developer Mode in Windows Settings and register the game. Then Play starts it. <button class="btn sm ghost" data-act="go" data-arg="guide">Open the Guide</button></p>` : `<div class="setrow"><div class="lbl"><b>Use this emulator</b><span>Every game in this section launches with it unless a game overrides it.</span></div>
        <select class="input" data-cfg="${c.id}.emulator">${c.emulators.map(id => `<option value="${id}" ${conf.emulator === id ? 'selected' : ''}>${esc(emuFor(id).name)}${emuPath(id) ? '' : ' (not set up)'}</option>`).join('')}</select></div>`}
      ${conf.emulator === 'retroarch' ? `<div class="setrow"><div class="lbl"><b>RetroArch core</b><span>File name without _libretro.dll, e.g. pcsx_rearmed</span></div><input class="input" data-cfg="${c.id}.core" value="${esc(conf.core)}"></div>` : ''}
      <div class="setrow"><div class="lbl"><b>Section enabled</b><span>Hide consoles you don’t use.</span></div><input type="checkbox" class="toggle" data-cfg="${c.id}.enabled" ${conf.enabled ? 'checked' : ''}></div>
      <div class="small muted" style="margin-top:12px">Accepted formats: ${esc(c.formats)}</div>
    </div>
    <div class="panel"><div class="h2" style="margin-top:0">Game folders</div>
      <p class="small muted" style="margin-top:-6px">Folders can be on any drive. Games on an unplugged drive stay in your library and show as offline.</p>
      ${conf.folders.map((f, i) => `<div class="folder">${ico('folder')}<span class="p mono" title="${esc(f)}">${esc(f)}</span>${missingFolders.has(f.toLowerCase()) ? '<span class="pill warn">Not found</span>' : ''}${driveBadge(f)}<button class="btn sm ghost" data-act="openPath" data-arg="${esc(f)}">Open</button><button class="btn sm danger" data-act="rmFolder" data-arg="${c.id}|${i}">Remove</button></div>`).join('') || '<div class="faint small" style="margin:10px 0">No folders yet.</div>'}
      <div class="row" style="margin-top:10px"><button class="btn primary" data-act="addFolder" data-arg="${c.id}">${ico('folder')} Add folder</button><button class="btn" data-act="scanConsole" data-arg="${c.id}">${ico('scan')} Scan</button>${homeDir(c.id) && !hasFolder(c.id, homeDir(c.id)) ? `<button class="btn ghost" data-act="useRomDirs" data-arg="${c.id}" title="Creates the folder if it doesn’t exist">Use ${esc(homeDir(c.id))}</button>` : ''}</div>
    </div>
  </div>`;
}
function tuningPanel(c, tune) {
  return `<div class="grid2">
    <div class="panel glow"><div class="h2" style="margin-top:0">Recommended ${esc(emuFor(cc(c.id).emulator).name)} settings</div>
      <p class="small muted" style="margin-top:-6px">Picked for ${esc(hw.gpu || 'your GPU')}${hw.vramGB ? ` (${hw.vramGB} GB)` : ''}, ${hw.threads} CPU threads and ${hw.ramGB} GB RAM. Set these inside the emulator once; they stick.</p>
      <div class="kv">${tune.settings.map(([k, v]) => `<div>${esc(k)}</div><div>${esc(v)}</div>`).join('')}</div></div>
    <div class="panel"><div class="h2" style="margin-top:0">What to expect</div>
      <p><span class="pill ${tune.rating.startsWith('Great') ? 'ok' : tune.rating.startsWith('Good') || tune.rating.startsWith('Playable') ? 'warn' : 'info'}">${esc(tune.rating)}</span></p>
      ${tune.notes.map(n => `<div class="issue warn">${esc(n)}</div>`).join('')}
      <p class="small muted">Wants about ${c.ram} GB of free RAM while playing. EchoForge warns you before launch if memory is short${set().ramGuard ? '' : ' (that check is off in Settings)'}.</p>
      <p class="small muted">Shader caches are built the first time you play, so expect short stutters in a new game's first minutes. Keeping the emulator on your fastest drive helps.</p></div>
  </div>`;
}

V.pc = () => {
  const ramUsed = hw.ramGB ? Math.max(0, hw.ramGB - hw.freeRamGB) : 0;
  const drives = hw.drives || [];
  const tierText = { high: 'High tier: 1080p+ upscaling on most cores, native-res PS4.', mid: 'Mid tier: native resolution recommended for the heavy cores.', low: 'Entry tier: stick to classic consoles and native resolution.' };
  const tier = window.efTune(hw, 'ps3').tier;
  return `<div class="view"><h1 class="h1">Your PC</h1><p class="sub">EchoForge checks your hardware and tunes its advice to it. It stays out of the way while you play: it minimizes, pauses its own animations and raises the emulator’s priority.</p>
    <div class="grid3">
      <div class="panel"><div class="small muted">GRAPHICS</div><div style="font:600 20px var(--display);margin:4px 0">${esc(hw.gpu || 'Detecting…')}</div><div class="muted small">${hw.vramGB ? `${hw.vramGB} GB VRAM · driver ${esc(hw.driver)}` : ''}</div><div style="margin-top:10px"><span class="pill ok">Vulkan 1.3 · D3D12</span></div></div>
      <div class="panel"><div class="small muted">PROCESSOR</div><div style="font:600 20px var(--display);margin:4px 0">${esc(hw.cpu || '…')}</div><div class="muted small">${hw.threads} threads</div><div style="margin-top:10px"><span class="pill ${hw.threads >= 12 ? 'ok' : 'warn'}">${hw.threads >= 12 ? 'Enough threads for RPCS3 / shadPS4' : 'Few threads: heavy cores may struggle'}</span></div></div>
      <div class="panel"><div class="small muted">MEMORY</div><div style="font:600 20px var(--display);margin:4px 0">${hw.ramGB} GB</div><div class="meter" style="margin:8px 0"><i style="width:${hw.ramGB ? (ramUsed / hw.ramGB * 100).toFixed(0) : 0}%"></i></div><div class="muted small">${hw.freeRamGB} GB free right now</div>
        <div style="margin-top:10px"><span class="pill ${hw.ramGB >= 32 ? 'ok' : 'warn'}">${hw.ramGB >= 32 ? 'Plenty' : 'Enough — close other apps before PS4/PS3'}</span></div></div>
    </div>
    <div class="panel glow" style="margin-top:14px"><b>${esc(tierText[tier])}</b> <span class="muted">Open any console’s “Tuned for your PC” tab for exact settings.</span></div>
    <div class="h2">Drives</div>
    <div class="grid2">${drives.map(d => `<div class="panel"><div class="row"><b style="font:600 22px var(--display)">${esc(d.letter)}:</b><span class="drivebadge s${d.kind.speed}">${esc(d.kind.label)}</span><span class="grow"></span><span class="small muted">${d.freeGB} GB free of ${d.sizeGB} GB</span></div>
      <div class="meter" style="margin:10px 0"><i style="width:${d.sizeGB ? ((d.sizeGB - d.freeGB) / d.sizeGB * 100).toFixed(0) : 0}%"></i></div>
      <div class="small muted">${esc(d.name || '')} — ${d.kind.speed >= 3 ? 'Best for emulators, shader caches and PS4 and newer games.' : d.kind.speed === 2 ? 'Fast. Great for any library, including PS4 and newer.' : 'Slower loading. Best for PS3, Xbox 360 and older games; PS4 and newer need an SSD.'}</div></div>`).join('') || '<div class="faint">Reading drives…</div>'}</div>
    ${storagePanel()}
    <div class="h2">Tuned for this machine</div>
    <div class="ctiles">${enabledConsoles().map(c => { const t = window.efTune(hw, c.id); return `<button class="ctile" style="${hueVars(c)};height:120px" data-act="tune" data-arg="${c.id}"><i class="stripe"></i><span class="mono-big">${esc(c.short)}</span><span class="nm">${esc(c.name)}</span><span class="ft"><span class="pill ${t.rating.startsWith('Great') ? 'ok' : t.rating.startsWith('Experimental') ? 'info' : 'warn'}">${esc(t.rating)}</span></span></button>`; }).join('')}</div>
  </div>`;
};

let moving = null; // id of the game being moved
let spareOpen = false; // the list of games that don't need an SSD
function storagePanel() {
  const s = set();
  if (!trimRoot(s.storageRoot)) return `<div class="h2">Game storage</div><div class="panel"><b>Put games on the right drive</b><div class="small muted" style="margin:4px 0 10px">PS4, PS5 and Xbox One games need an SSD. PS3, Xbox 360 and older games run fine from a hard drive, however big they are. Set a storage library in Settings → Library and EchoForge suggests where each game belongs.</div><button class="btn sm" data-act="libSettings">Open Library settings</button></div>`;
  const todo = S.games.map(g => ({ g, p: placement(g) })).filter(x => x.p && needsSSD(x.g));
  const gb = b => (b / 1024 ** 3).toFixed(1);
  const rows = todo.map(({ g, p }) => `<div class="folder"><span class="p"><b>${esc(g.title)}</b> <span class="small muted">${esc(byId(C, g.console).short)} · ${fmtSize(g.size)}</span><br><span class="small muted">${esc(p.why)}</span></span>${driveBadge(g.path)}<span class="small muted">→</span>${driveBadge(p.to)}<button class="btn sm ${moving === g.id ? '' : 'primary'}" data-act="moveGame" data-arg="${g.id}" ${moving ? 'disabled' : ''}>${moving === g.id ? 'Moving…' : 'Move'}</button></div>`).join('');
  const spare = S.games.filter(onSpareSSD).sort((a, b) => (b.size || 0) - (a.size || 0));
  const spareBytes = spare.reduce((n, g) => n + (g.size || 0), 0);
  const spareRows = spare.map(g => { const m = storageMove(g); return `<div class="folder"><span class="p"><b>${esc(g.title)}</b> <span class="small muted">${esc(byId(C, g.console).short)} · ${fmtSize(g.size)}</span></span>${driveBadge(g.path)}<button class="btn sm ghost" data-act="reveal" data-arg="${esc(g.path)}">Show file</button>${m ? `<button class="btn sm ${moving === g.id ? '' : 'primary'}" data-act="moveGame" data-arg="${g.id}" ${moving ? 'disabled' : ''}>${moving === g.id ? 'Moving…' : `Move to ${esc(rootOf(m.to))}`}</button>` : ''}</div>`; }).join('');
  return `<div class="h2">Game storage</div><div class="panel">
    <div class="row"><div class="grow"><b>${spare.length} game${spare.length === 1 ? '' : 's'} on an SSD don’t need one</b>
      <div class="small muted">${gb(spareBytes)} GB. PS3, Xbox 360 and older games run fine from a hard drive, however big they are. Only PS4, PS5 and Xbox One games need an SSD.</div></div>
      ${spare.length ? `<button class="btn" data-act="spareToggle">${spareOpen ? 'Hide list' : 'Show list'}</button>` : ''}${spare.some(storageMove) ? `<button class="btn primary" data-act="optimizeStorage" ${moving ? 'disabled' : ''}>Move all</button>` : ''}</div>
    ${spareOpen && spareRows ? `<div style="margin-top:10px">${spareRows}</div><div class="small faint" style="margin-top:8px">Moving a game yourself? Add its new folder on that console’s setup page and scan, so it stays in your library.</div>` : ''}</div>
  <div class="panel" style="margin-top:14px">
    <div class="row"><div class="grow"><b>${todo.length ? `${todo.length} game${todo.length === 1 ? '' : 's'} should be on an SSD` : 'Every game that needs an SSD is on one'}</b>
      <div class="small muted">Fast library <span class="mono">${esc(s.romRoot)}</span> ${driveBadge(s.romRoot)} for PS4 and newer · storage library <span class="mono">${esc(s.storageRoot)}</span> ${driveBadge(s.storageRoot)} for PS3, Xbox 360 and older.</div></div>
      ${todo.length > 1 ? `<button class="btn primary" data-act="optimizeStorage" ${moving ? 'disabled' : ''}>Optimize all</button>` : ''}</div>
    ${rows ? `<div style="margin-top:10px">${rows}</div>` : ''}
    <div class="small faint" style="margin-top:8px">Each game is copied, checked file by file, and only then removed from the old drive. Playtime, favorites and covers stay.</div></div>`;
}

// ---------------- inbox ----------------
// The main process reads each file's disc data to find its console, unpacks it into that console's library folder,
// checks every file and recycles the archive. Programs and shortcuts in the folder are never run.
let homePath = '';
let inbox = { items: [], error: null, busy: null, progress: {}, failed: {}, added: [], cleaned: [], loaded: false };
let inboxT = null;
let dlFolder = ''; // Windows' Downloads folder as it is now (it moves to another drive when this one runs low)
const inboxFolder = () => trimRoot(set().inboxFolder);
const inboxFolders = () => [inboxFolder()].filter(Boolean);
// When the Downloads drive drops below the limit, point Downloads at the other drive (see app/downloads.js).
async function checkDownloadsDrive(announce = true) {
  const s = set();
  const r = await window.ef.downloads.check({ enabled: s.dlAutoSwitch, thresholdGB: s.dlSwitchAtGB, target: trimRoot(s.dlTarget) });
  if (!r) return;
  const before = inboxFolders().join('|');
  if (r.switched) {
    s.dlPrevFolder = r.from; s.dlSwitchedAt = Date.now(); save(); dlFolder = r.to;
    if (announce) toast(`Your ${esc(r.from.slice(0, 2))} drive is down to ${Math.round(r.free)} GB, so new downloads now go to <b>${esc(r.to)}</b>. Restart your browser so it picks up the new folder.`, 'ok');
  } else {
    dlFolder = r.folder;
    if (r.error && announce && s.dlAutoSwitch && s.dlWarned !== r.error) { s.dlWarned = r.error; save(); toast(`Couldn’t move your Downloads folder: ${esc(r.error)}.`, 'bad'); }
  }
  if (inboxFolders().join('|') !== before) { window.ef.inbox.watch(inboxFolders()); refreshInbox(); if (route.view === 'settings') render(); }
}
const inboxReady = () => inbox.items.filter(i => i.status === 'ready');
function inboxDest(cid) { // where a console's games land, and the other library to use when that drive is short on space
  const c = byId(C, cid), s = trimRoot(set().storageRoot), fast = romDir(cid), slow = s ? `${s}\\${c.dir}` : '';
  return c.speed === 'any' && slow ? { dest: slow, fallback: fast } : { dest: fast, fallback: slow };
}
// A copy in progress changes the folder many times a second, so only redraw when what the inbox shows has changed.
const inboxSig = () => JSON.stringify([inbox.error, inbox.cleaned.length, inbox.items.map(i => [i.file, i.status, i.console, i.error])]);
let inboxRefreshing = false;
async function refreshInbox(quiet = true) {
  const folder = inboxFolder(); if (!folder || inboxRefreshing) return;
  if (inbox.busy) { clearTimeout(inboxT); inboxT = setTimeout(() => refreshInbox(quiet), 3000); return; } // finish the import first
  inboxRefreshing = true;
  const before = new Set(inboxReady().map(i => i.file)), sig = inboxSig();
  const results = await Promise.all(inboxFolders().map(f => window.ef.inbox.scan(f))).finally(() => { inboxRefreshing = false; });
  const r = results[0] || {}; // a folder that's gone or empty is no error
  inbox.items = results.flatMap(x => x.items || []); inbox.error = r.error || null; inbox.loaded = true;
  if (set().inboxAutoClean) for (const it of inbox.items.filter(i => i.status === 'risky' && i.auto)) {
    const x = await window.ef.inbox.recycle(it.file);
    if (x.ok) { inbox.cleaned.unshift({ name: it.name, why: it.why, at: Date.now() }); toast(`Removed <b>${esc(it.name)}</b>: ${esc(it.why.toLowerCase())}. It’s in the Recycle Bin.`, 'ok'); }
    else it.error = x.error;
  }
  inbox.items = inbox.items.filter(i => !inbox.cleaned.some(c => c.name === i.name && i.status === 'risky' && !i.error));
  const fresh = inboxReady().filter(i => !before.has(i.file)).length;
  if (fresh && !quiet && route.view !== 'inbox') toast(`${fresh} new game${fresh === 1 ? '' : 's'} in Import, ready to add.`, 'ok');
  clearTimeout(inboxT); if (inbox.items.some(i => i.status === 'copying')) inboxT = setTimeout(() => refreshInbox(false), 16000);
  if (inboxSig() === sig && !inbox.dirty) return;
  inbox.dirty = false; renderSide(); if (route.view === 'inbox') render();
}
async function importItem(file) {
  const it = inbox.items.find(i => i.file === file); if (!it || inbox.busy) return null;
  const { dest, fallback } = inboxDest(it.console);
  if (!dest) { toast('Set your library folders first (Settings → Library).', 'bad'); return null; }
  inbox.busy = file; delete inbox.failed[file]; inbox.progress[file] = { pct: 0, phase: 'Starting' }; render();
  const r = await window.ef.inbox.import({ file, o: { dest, fallback, minFreeGB: set().inboxMinFree, keepFreeGB: set().dlAutoSwitch ? set().dlSwitchAtGB : 0, rpcs3: emuPath('rpcs3'), recycle: set().inboxRecycle } });
  inbox.busy = null; delete inbox.progress[file];
  if (!r.ok) { inbox.failed[file] = r.error; render(); return null; }
  // Make sure the folder the game landed in is one the console scans (RPCS3's own folder for installed PS3 packages).
  const lib = r.libFolder || [dest, fallback].find(f => f && (r.dest + '\\').toLowerCase().startsWith(f.toLowerCase() + '\\')) || dest;
  if (!hasFolder(it.console, lib)) cc(it.console).folders.push(lib);
  inbox.added.unshift({ name: cleanTitle(it.name, it.console).title, console: it.console, dest: r.dest, note: r.note, exists: r.exists, fallbackUsed: r.fallbackUsed, recycled: r.recycled });
  inbox.items = inbox.items.filter(i => i.file !== file); save();
  return it.console;
}
async function importAll(files) {
  const touched = new Set();
  for (const f of files) { const cid = await importItem(f); if (cid) touched.add(cid); }
  for (const cid of touched) await scanConsole(cid, true);
  if (touched.size) { fetchMissingArt().then(fetchMissingShots); checkCompat(); toast('Added to your library. Covers are on their way.', 'ok'); }
  await refreshInbox(); renderSide(); render();
}
window.ef.inbox.onProgress(v => {
  inbox.progress[v.file] = v; const row = $(`#ib-${hashId(v.file)}`); if (!row) return;
  row.querySelector('.meter i').style.width = `${v.pct}%`; row.querySelector('.ph').textContent = `${v.phase || ''} · ${v.pct}%`;
});
window.ef.inbox.onChange(() => refreshInbox(false));

V.inbox = () => {
  const folder = inboxFolder(), ready = inboxReady(), by = s => inbox.items.filter(i => i.status === s);
  const chip = cid => { const c = byId(C, cid); return `<span class="chip" style="background:linear-gradient(140deg,${c.hue[0]},${c.hue[1]})">${esc(c.short)}</span>`; };
  const row = it => {
    const { dest } = inboxDest(it.console), p = inbox.progress[it.file], err = inbox.failed[it.file];
    const right = p ? `<div style="width:220px"><div class="meter"><i style="width:${p.pct}%"></i></div><div class="small muted ph" style="margin-top:4px">${esc(p.phase || '')} · ${p.pct}%</div></div>`
      : `<button class="btn sm primary" data-act="ibAdd" data-arg="${esc(it.file)}" ${inbox.busy ? 'disabled' : ''}>Add</button>`;
    return `<div class="folder" id="ib-${hashId(it.file)}">${chip(it.console)}<span class="p"><b>${esc(cleanTitle(it.name, it.console).title)}</b> <span class="small muted">${esc(it.why)} · ${fmtSize(it.gameSize || it.size)}${it.partCount ? ` · ${it.partCount} parts` : ''}</span>
      ${err ? `<br><span class="small" style="color:var(--bad)">${esc(err)}</span>` : it.warn ? `<br><span class="small" style="color:var(--warn)">${esc(it.warn)}</span>` : ''}</span>${driveBadge(dest)}${right}</div>`;
  };
  const plain = (it, btn = '') => `<div class="folder">${ico(it.status === 'risky' ? 'shield' : 'folder')}<span class="p"><b>${esc(it.name)}</b> <span class="small muted">${esc(it.why)} · ${fmtSize(it.size)}</span>${it.error ? `<br><span class="small" style="color:var(--bad)">${esc(it.error)}</span>` : ''}</span>${btn}</div>`;
  const reveal = it => `<button class="btn sm ghost" data-act="reveal" data-arg="${esc(it.file)}">Show</button>`;
  const err = inbox.error === 'no7z' ? `<div class="issue"><div class="grow"><b>7-Zip is needed to open game archives.</b><div class="small muted">Install it from the official site, then press Refresh.</div></div><button class="btn sm" data-act="url" data-arg="https://www.7-zip.org/">7-zip.org</button></div>`
    : inbox.error === 'nofolder' ? `<div class="issue"><b>The import folder doesn’t exist.</b>&nbsp;Pick another one.</div>` : '';
  const risky = by('risky'), unknown = by('unknown'), dl = by('copying');
  return `<div class="view"><h1 class="h1">Import</h1>
    <p class="sub">${folder ? `Game files in <span class="mono">${esc(folder)}</span>.` : 'Add game files you made from discs you own.'} EchoForge reads each disc to see which console it’s for, unpacks it to the right drive, checks every file and adds it with artwork. Programs and shortcuts here are never run.</p>
    <div class="row" style="margin-bottom:16px"><button class="btn primary" data-act="ibAddAll" ${!ready.length || inbox.busy ? 'disabled' : ''}>${ico('inbox')} Add all${ready.length ? ` (${ready.length})` : ''}</button>
      <button class="btn" data-act="ibRefresh">${ico('scan')} Refresh</button><button class="btn ghost" data-act="ibFolder">${folder ? 'Change folder' : 'Choose folder'}</button>${folder ? `<button class="btn ghost" data-act="openPath" data-arg="${esc(folder)}">Open folder</button>` : ''}</div>
    ${!folder ? '<div class="empty"><div class="big">Choose a folder</div><div>Nothing is checked until you pick one.</div></div>' : err}
    ${ready.length ? `<div class="h2">Ready to add</div>${ready.map(row).join('')}` : folder && inbox.loaded && !err ? `<div class="empty"><div class="big">All caught up</div><div>Put a game file in this folder and it shows up here on its own.</div></div>` : ''}
    ${risky.length ? `<div class="h2">Not games: be careful</div><p class="small muted" style="margin-top:-6px">These aren’t games. EchoForge never opens them.</p>${risky.map(it => plain(it, `<button class="btn sm danger" data-act="ibRecycle" data-arg="${esc(it.file)}">${ico('trash', 14)} Recycle</button>`)).join('')}` : ''}
    ${dl.length ? `<div class="h2">Still being copied</div>${dl.map(it => plain(it)).join('')}` : ''}
    ${unknown.length ? `<div class="h2">Couldn’t tell what these are</div>${unknown.map(it => plain(it, reveal(it))).join('')}` : ''}
    ${inbox.added.length ? `<div class="h2">Added</div>${inbox.added.map(a => `<div class="folder">${chip(a.console)}<span class="p"><b>${esc(a.name)}</b> <span class="small muted">${a.exists ? 'Already in your library' : 'Unpacked and checked'}${a.recycled ? ' · archive recycled' : ''}${a.fallbackUsed ? ' · put on your other drive to keep space free' : ''}</span>${a.note ? `<br><span class="small" style="color:var(--warn)">${esc(a.note)}</span>` : ''}</span>${driveBadge(a.dest)}<span class="pill ok">Added</span></div>`).join('')}` : ''}
    ${inbox.cleaned.length ? `<div class="h2">Cleaned up</div>${inbox.cleaned.map(c => `<div class="folder">${ico('shield')}<span class="p"><b>${esc(c.name)}</b> <span class="small muted">${esc(c.why)} · moved to the Recycle Bin ${fmtAgo(c.at)}</span></span></div>`).join('')}` : ''}
  </div>`;
};

// ---------------- save backups ----------------
// Each emulator keeps saves in its own folder; app/backup.js copies them to dated snapshots on the backup drive.
let bk = { status: null, loading: false, busy: false };
const linkedEmus = ids => Object.fromEntries((ids || E.map(e => e.id)).map(id => [id, emuPath(id)]).filter(([, p]) => p));
async function loadBackupStatus() {
  if (bk.loading) return; bk.loading = true;
  bk.status = await window.ef.backup.status({ emulators: linkedEmus(), dest: trimRoot(set().backupRoot) }).finally(() => { bk.loading = false; });
  if (route.view === 'backups') render();
}
async function backupSaves(ids, reason, quiet = false) {
  if (!trimRoot(set().backupRoot)) { if (!quiet) toast('Choose a backup folder first.', 'bad'); return; }
  if (bk.busy) return; bk.busy = true; if (route.view === 'backups') render();
  const r = await window.ef.backup.run({ emulators: linkedEmus(ids), dest: trimRoot(set().backupRoot), keep: set().backupKeep, reason }).finally(() => { bk.busy = false; });
  if (r.error) toast(esc(r.error), 'bad');
  else {
    const res = Object.entries(r.results), made = res.filter(([, x]) => x.ok && !x.skipped), bad = res.filter(([, x]) => !x.ok);
    if (!ids) { set().backupLast = Date.now(); save(); }
    if (bad.length) toast(`${esc(emuFor(bad[0][0]).name)} saves weren’t backed up: ${esc(bad[0][1].error)}`, 'bad');
    else if (made.length) toast(quiet ? `${esc(made.map(([id]) => emuFor(id).name).join(', '))} saves backed up.` : `Backed up ${made.length} emulator${made.length === 1 ? '' : 's'}.`, 'ok');
    else if (!quiet) toast('Nothing new to back up. Your latest backups are current.');
    if (res.some(([, x]) => x.oldKept)) toast('An old backup is too big for the Recycle Bin, so it was kept. Delete it by hand if you need the space.');
  }
  await loadBackupStatus();
}
// ---------------- shared games ----------------
// One PC shares its library (share.js); another browses it here and installs only the games picked.
const share = { info: null, hostError: '', list: null, tools: [], toolPicked: new Set(), toolsSeen: false, name: '', connecting: false, error: '', q: '', console: 'all', picked: new Set(), current: null, pct: 0, stopping: false, failed: {} };
let shareSig = null;
async function syncShare() {
  const s = set(), on = !!s.shareOn && !!s.shareCode;
  const list = on ? S.games.filter(g => !g.hidden && !isOffline(g)).map(g => ({ id: g.id, console: g.console, title: g.title, size: g.size, titleId: g.titleId, path: g.path })) : [];
  const emuDir = id => emuPath(id).replace(/[\\/][^\\/]+$/, ''), inside = (f, d) => (f + '\\').toLowerCase().startsWith(d.toLowerCase() + '\\');
  const linked = on ? E.filter(e => emuPath(e.id)) : [];
  // Firmware never travels: these folders are left out of what an emulator offers (see app/share.js).
  const firmwareOf = C.filter(c => c.bios.length && biosDir(c.id)).map(c => ({ console: c.id, dir: trimRoot(biosDir(c.id)) }));
  const toolList = !on ? [] : [...linked.map(e => ({ id: `emu:${e.id}`, kind: 'emulator', emu: e.id, name: e.name, path: emuPath(e.id), consoles: C.filter(c => cc(c.id).emulator === e.id).map(c => c.id), bios: firmwareOf.filter(b => inside(b.dir, emuDir(e.id))) }))];
  const sig = JSON.stringify([on, s.shareCode, list.map(g => g.path), toolList]);
  if (sig === shareSig) return;
  shareSig = sig;
  const r = await window.ef.share.host({ on, code: s.shareCode, list, toolList, folders: Object.fromEntries(C.map(c => [c.id, cc(c.id).folders])) });
  share.hostError = r.ok ? '' : r.error;
  share.info = await window.ef.share.info();
  if (route.view === 'shared') render();
}
const shareBase = () => trimRoot(set().shareDest) || (driveInfo(set().romRoot) ? trimRoot(set().romRoot) : '');
const shareHere = g => S.games.some(x => x.console === g.console && x.title === g.title && !isOffline(x));
const shareShown = () => (share.list || []).filter(g => (share.console === 'all' || g.console === share.console) && (!share.q || g.title.toLowerCase().includes(share.q.toLowerCase()))).sort((a, b) => a.title.localeCompare(b.title));
const toolHere = t => !!emuPath(t.emu);
const toolsPicked = () => share.tools.filter(t => share.toolPicked.has(t.id) && !toolHere(t));
const sharePicked = () => (share.list || []).filter(g => share.picked.has(g.id) && !shareHere(g));
V.shared = () => {
  const s = set(), i = share.info || {}, picked = sharePicked(), base = shareBase(), busy = !!share.current;
  const pickedSize = picked.reduce((n, g) => n + (g.size || 0), 0);
  const cons = share.list ? C.filter(c => share.list.some(g => g.console === c.id)) : [];
  const toolsSel = toolsPicked(), toolBytes = toolsSel.reduce((n, t) => n + t.size, 0);
  const toolRows = share.tools.map(t => { const here = toolHere(t), now = share.current === t.id; return `<div class="folder" id="sh-${esc(t.id)}">${here ? '<span class="pill plain">Installed</span>' : `<input type="checkbox" data-shtool="${esc(t.id)}" ${share.toolPicked.has(t.id) ? 'checked' : ''} ${busy ? 'disabled' : ''} aria-label="Copy ${esc(t.name)}">`}<span class="p"><b>${esc(t.name)}</b> <span class="small muted">${fmtSize(t.size)}${t.kind === 'emulator' && !t.consoles.length ? ' · not used by any console there' : ''}</span>${share.failed[t.id] ? `<br><span class="small" style="color:var(--bad,#ff6b6b)">${esc(share.failed[t.id])}</span>` : ''}</span>${now ? `<div class="meter" style="width:140px"><i style="width:${share.pct}%"></i></div><span class="small muted ph">${share.pct}%</span>` : ''}</div>`; }).join('');
  const rows = shareShown().map(g => { const c = byId(C, g.console), here = shareHere(g), now = share.current === g.id; return `<div class="folder" id="sh-${esc(g.id)}">${here ? '<span class="pill plain">Installed</span>' : `<input type="checkbox" data-shpick="${esc(g.id)}" ${share.picked.has(g.id) ? 'checked' : ''} ${busy ? 'disabled' : ''} aria-label="Install ${esc(g.title)}">`}<span class="p"><b>${esc(g.title)}</b> <span class="small muted">${esc(c.short)} · ${fmtSize(g.size)}</span>${share.failed[g.id] ? `<br><span class="small" style="color:var(--bad,#ff6b6b)">${esc(share.failed[g.id])}</span>` : ''}</span>${now ? `<div class="meter" style="width:140px"><i style="width:${share.pct}%"></i></div><span class="small muted ph">${share.pct}%</span>` : ''}</div>`; }).join('');
  return `<div class="view"><h1 class="h1">Shared games</h1><p class="sub">Move your own games and emulators between your own PCs over your home network. You choose what, and nothing else is copied.</p>
    <div class="h2">Get games from another PC</div><div class="panel">
      <div class="row"><input class="input grow" data-sh="shareHost" value="${esc(s.shareHost)}" placeholder="PC name or address, like GAMING or 192.168.1.33" aria-label="PC name or address"><input class="input" data-sh="shareRemoteCode" value="${esc(s.shareRemoteCode)}" placeholder="Code" aria-label="Sharing code" style="width:150px;text-transform:uppercase"><button class="btn primary" data-act="shareConnect" ${share.connecting || busy ? 'disabled' : ''}>${share.connecting ? 'Connecting…' : share.list ? 'Refresh' : 'Connect'}</button></div>
      ${share.error ? `<div class="small" style="margin-top:8px;color:var(--bad,#ff6b6b)">${esc(share.error)}</div>` : ''}
      ${share.list ? `<div class="setrow"><div class="lbl"><b>Install games to</b><span>${base ? `<span class="mono">${esc(base)}</span>, one folder per console.` : 'Choose a folder before installing.'}</span></div><button class="btn sm" data-act="shareDest" ${busy ? 'disabled' : ''}>${ico('folder', 14)} Choose folder</button></div>
      ${share.tools.length ? `<div class="row" style="margin-top:12px"><div class="grow"><b>Emulators from ${esc(share.name)}</b><div class="small muted">Programs and settings. Saves, caches and firmware stay behind, and nothing already on this PC is replaced.</div></div><button class="btn primary" data-act="shareTools" ${toolsSel.length && !busy ? '' : 'disabled'}>Copy${toolsSel.length ? ` (${toolsSel.length}, ${fmtSize(toolBytes)})` : ''}</button></div><div style="margin-top:10px">${toolRows}</div>` : ''}
      <div class="row" style="margin-top:12px"><b class="grow">${esc(share.name)}: ${share.list.length} game${share.list.length === 1 ? '' : 's'}${picked.length ? ` · ${picked.length} picked, ${fmtSize(pickedSize)}` : ''}</b>
        ${busy ? `<button class="btn" data-act="shareCancel" ${share.stopping ? 'disabled' : ''}>${share.stopping ? 'Stopping…' : 'Stop'}</button>` : `<button class="btn ghost" data-act="shareClear" ${picked.length ? '' : 'disabled'}>Clear</button><button class="btn primary" data-act="shareInstall" ${picked.length && base ? '' : 'disabled'}>Install${picked.length ? ` (${picked.length})` : ''}</button>`}</div>
      <div class="chips" style="margin-top:10px"><button class="fchip ${share.console === 'all' ? 'on' : ''}" data-act="shareConsole" data-arg="all">All</button>${cons.map(c => `<button class="fchip ${share.console === c.id ? 'on' : ''}" data-act="shareConsole" data-arg="${c.id}">${esc(c.short)}</button>`).join('')}</div>
      <input class="input" id="shQ" data-sh="q" value="${esc(share.q)}" placeholder="Search these games" aria-label="Search these games" style="width:100%;margin-top:10px">
      <div style="margin-top:10px">${rows || '<div class="faint small">No games match.</div>'}</div>` : ''}
    </div>
    <div class="h2">Share this PC’s games</div><div class="panel">
      <div class="row"><div class="grow"><b>${s.shareOn ? 'Sharing is on' : 'Sharing is off'}</b><div class="small muted">Your other PCs can see the titles and copy the games and emulators set up here. Saves stay here, and nothing can be changed or deleted. Stays on only while EchoForge is open.</div></div>
        ${s.shareOn ? '<button class="btn sm ghost" data-act="shareNewCode">New code</button>' : ''}<button class="btn ${s.shareOn ? '' : 'primary'}" data-act="shareToggle">${s.shareOn ? 'Turn off' : 'Turn on'}</button></div>
      ${share.hostError ? `<div class="small" style="margin-top:8px;color:var(--bad,#ff6b6b)">${esc(share.hostError)}</div>` : ''}
      ${s.shareOn && i.on ? `<div class="setrow"><div class="lbl"><b>On your other PC, enter</b><span>PC name <b class="mono">${esc(i.name)}</b>${(i.addresses || []).length ? ` or address <span class="mono">${esc(i.addresses.join(' / '))}</span>` : ''}</span></div><b class="mono" style="font-size:20px;letter-spacing:2px">${esc(s.shareCode)}</b></div><div class="small faint" style="margin-top:8px">If Windows Firewall asks, allow EchoForge on private networks. Each file is checksum-checked when it arrives. Traffic isn’t encrypted, so only use this on your own network.</div>` : ''}
    </div></div>`;
};
async function shareConnect() {
  const s = set(); share.connecting = true; share.error = ''; render();
  const r = await window.ef.share.list({ host: s.shareHost, code: (s.shareRemoteCode || '').trim().toUpperCase() });
  share.connecting = false;
  if (r.ok) {
    share.list = r.games; share.name = r.name;
    share.tools = (await window.ef.share.tools({ host: s.shareHost, code: (s.shareRemoteCode || '').trim().toUpperCase() })).tools || [];
    // Start with what the other PC actually uses ticked; anything else is one tick away.
    if (!share.toolsSeen && share.tools.length) { share.toolsSeen = true; share.tools.filter(t => t.consoles.length && !toolHere(t)).forEach(t => share.toolPicked.add(t.id)); }
  } else { share.list = null; share.error = r.error; }
  render();
}
window.ef.share.onProgress(v => {
  if (v.id !== share.current) return; share.pct = v.pct;
  const row = document.getElementById(`sh-${v.id}`); if (!row) return;
  const bar = row.querySelector('.meter i'), ph = row.querySelector('.ph');
  if (bar) bar.style.width = `${v.pct}%`; if (ph) ph.textContent = `${v.pct}%`;
});

V.backups = () => {
  const s = set(), dest = trimRoot(s.backupRoot), st = bk.status;
  if (!st && !bk.loading) setTimeout(loadBackupStatus, 0);
  const when = t => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const rows = E.filter(e => emuPath(e.id)).map(e => {
    const x = st && st[e.id]; if (!x) return '';
    const total = x.sources.reduce((n, y) => n + y.bytes, 0), last = x.snapshots[0];
    return `<div class="panel" style="margin-bottom:12px"><div class="row"><b style="font:600 18px var(--display)">${esc(e.name)}</b><span class="small muted">${total ? `${fmtSize(total)} of saves` : 'No saves yet'}</span><span class="grow"></span>
        ${last ? `<span class="pill ok">Backed up ${esc(fmtAgo(last.at))}</span>` : total ? '<span class="pill warn">Not backed up yet</span>' : ''}
        <button class="btn sm" data-act="bkOne" data-arg="${e.id}" ${bk.busy || !total || !dest ? 'disabled' : ''}>Back up</button>
        <button class="btn sm ghost" data-act="bkRestore" data-arg="${e.id}" ${x.snapshots.length ? '' : 'disabled'}>Restore…</button></div>
      ${x.sources.map(y => `<div class="small" style="margin-top:6px;display:flex;gap:10px"><span style="width:140px" class="muted">${esc(y.label)}</span><span class="mono faint grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(y.path)}">${esc(y.path)}</span><span class="muted">${y.exists ? `${y.files} file${y.files === 1 ? '' : 's'} · ${fmtSize(y.bytes)}` : 'not created yet'}</span></div>`).join('')}
      ${x.snapshots.length ? `<div class="small faint" style="margin-top:8px">${x.snapshots.length} backup${x.snapshots.length === 1 ? '' : 's'} kept · latest ${esc(when(last.at))}</div>` : ''}</div>`;
  }).join('');
  return `<div class="view"><h1 class="h1">Save backups</h1>
    <p class="sub">Every emulator keeps your progress in its own folder. EchoForge copies them to <span class="mono">${esc(dest || 'a folder you choose')}</span> as dated backups, so a reinstall, a bad emulator update or a wrong click never costs you a save.</p>
    <div class="row" style="margin-bottom:16px"><button class="btn primary" data-act="bkAll" ${bk.busy || !dest ? 'disabled' : ''}>${ico('save')} ${bk.busy ? 'Backing up…' : 'Back up now'}</button>
      <button class="btn ghost" data-act="bkFolder">${dest ? 'Change folder' : 'Choose folder'}</button>${dest ? `<button class="btn ghost" data-act="bkOpen">Open folder</button>` : ''}</div>
    <div class="panel" style="margin-bottom:18px">
      <div class="setrow"><div class="lbl"><b>Back up after every game</b><span>When you close a game, that emulator’s saves are copied. Takes a second.</span></div><input type="checkbox" class="toggle" data-set="backupAfterPlay" ${s.backupAfterPlay ? 'checked' : ''}></div>
      <div class="setrow"><div class="lbl"><b>Weekly full backup</b><span>Every emulator, once a week, in case you play outside EchoForge.${s.backupLast ? ` Last one ${esc(fmtAgo(s.backupLast))}.` : ''}</span></div><input type="checkbox" class="toggle" data-set="backupWeekly" ${s.backupWeekly ? 'checked' : ''}></div>
      <div class="setrow"><div class="lbl"><b>Backups to keep per emulator</b><span>Older ones go to the Recycle Bin. A backup is skipped when nothing changed.</span></div><div class="row"><input type="range" min="3" max="50" step="1" value="${s.backupKeep}" data-set="backupKeep" data-num><span class="mono" style="width:44px">${s.backupKeep}</span></div></div>
    </div>
    ${st ? rows || '<div class="empty"><div class="big">No emulators set up</div><div>Link your emulators on the Emulators page first.</div></div>' : '<div class="faint">Looking at your save folders…</div>'}
  </div>`;
};

// ---------------- EchoForge updates ----------------
async function checkAppUpdate(announce) {
  const r = await window.ef.appUpdates.check(); appUp.info = r;
  set().appUpdateLast = Date.now(); save();
  if (announce && r.ok && r.update && set().appUpdateLater !== r.latest.version) toast(`EchoForge <b>${esc(r.latest.version)}</b> is ready. Update from Home or Settings → About.`, 'ok');
  if (['home', 'settings'].includes(route.view)) render();
  return r;
}
function appUpdateText() {
  const u = appUp.info;
  if (!u) return 'Not checked yet';
  if (!u.ok) return esc(u.error);
  return u.update ? `Version ${esc(u.latest.version)} is ready` : `You have the latest version (${esc(appVersion)})`;
}
window.ef.appUpdates.onProgress(v => { appUp.pct = v.pct; if (['home', 'settings'].includes(route.view)) render(); });

// ---------------- emulator updates ----------------
async function checkEmuUpdates(announce) {
  emuUp.checked = true;
  if (!emuUp.ids.length) emuUp.ids = await window.ef.emuUpdates.list();
  const found = [];
  for (const id of emuUp.ids.filter(id => emuPath(id))) {
    const r = await window.ef.emuUpdates.check({ id, exe: emuPath(id), channel: emuChannel(id) }); emuUp.info[id] = r;
    if (r.ok && r.update) found.push(emuFor(id).name);
  }
  set().emuUpdateLast = Date.now(); save();
  if (announce && found.length) toast(`Update ready for <b>${esc(found.join(', '))}</b>. Open Emulators to install it.`, 'ok');
  if (route.view === 'emulators') render();
}
function emuUpdateRow(id) {
  const u = emuUp.info[id], busy = emuUp.busy === id;
  const ver = !u ? 'Not checked yet' : u.currentLabel ? `Version ${esc(u.currentLabel)}` : 'Version unknown';
  const state = !u ? '' : !u.ok ? ` · <span style="color:var(--bad,#ff6b6b)">${esc(u.error)}</span>`
    : u.kept ? ` · Kept on this version${u.latest && u.latest.tag !== u.current ? ` (newest is ${esc(u.latest.label)})` : ''}`
    : u.update ? ` · Update ready: <b>${esc(u.latest.label)}</b>` : u.ahead ? ' · Newer than the tested build' : u.latest ? ' · Up to date' : ' · No build ready yet';
  const ch = emuChannel(id), chans = [['tested', 'Tested'], ['latest', 'Latest'], ['keep', 'Keep this version']];
  const picker = `<select class="input" style="height:28px;font-size:12px" data-emuchan="${id}" title="Which builds to offer" ${emuUp.busy ? 'disabled' : ''}>${chans.map(([v, l]) => `<option value="${v}" ${ch === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const btns = busy ? `<span class="small muted" id="eu-${id}">${esc(emuUp.phase)} ${emuUp.pct}%</span>`
    : `${u && u.ok && u.update ? `<button class="btn sm primary" data-act="emuUpdate" data-arg="${id}" title="Install ${esc(u.latest.label)}" ${emuUp.busy ? 'disabled' : ''}>Update</button>` : ''}`
    + `${u && u.rollback ? `<button class="btn sm ghost" data-act="emuRollback" data-arg="${id}" title="Put ${esc(u.rollback.label)} back" ${emuUp.busy ? 'disabled' : ''}>Roll back</button>` : ''}`
    + `<button class="btn sm ghost" data-act="emuUpCheck" ${emuUp.busy ? 'disabled' : ''}>Check now</button>` + picker;
  return `<div style="padding:6px 0 10px"><div class="small"><b>Updates</b> <span class="muted">${ver}${state}</span></div><div class="row" style="margin-top:8px">${btns}</div></div>`;
}
window.ef.emuUpdates.onProgress(v => { if (v.id !== emuUp.busy) return; emuUp.pct = v.pct; emuUp.phase = v.phase; const el = $(`#eu-${v.id}`); if (el) el.textContent = `${v.phase} ${v.pct}%`; });

V.emulators = () => { if (!emuUp.checked) setTimeout(() => checkEmuUpdates(false)); return `<div class="view"><h1 class="h1">Emulators</h1>
  <p class="sub">EchoForge launches standalone emulators. Download them only from the official pages linked here. Fake “PS5 emulator” sites are a common way to spread malware.</p>
  <div class="row" style="margin-bottom:18px"><button class="btn primary" data-act="detect">${ico('scan')} Auto-detect on all drives</button><span class="small muted">Looks in drive roots, Emulators/Games folders, Program Files, Desktop and Downloads.</span></div>
  <div class="grid2">${E.map(e => {
    const p = emuPath(e.id); const st = { experimental: 'info', active: 'ok', mature: 'ok', good: 'ok' }[e.status];
    if (e.nolink) return `<div class="panel"><div class="row"><b style="font:600 20px var(--display);letter-spacing:.04em">${esc(e.name)}</b><span class="pill ${st} plain">${esc(e.status)}</span><span class="grow"></span><span class="pill plain">Nothing to link</span></div>
      <div class="small muted" style="margin:6px 0 12px">${e.for.map(id => esc(byId(C, id).name)).join(' · ')} — ${esc(e.note)}</div>
      <div class="row"><button class="btn sm ghost" data-act="url" data-arg="${esc(e.url)}">${ico('link', 14)} Official page</button><button class="btn sm ghost" data-act="go" data-arg="guide">${ico('book', 14)} How to set it up</button></div></div>`;
    return `<div class="panel ${p ? 'glow' : ''}"><div class="row"><b style="font:600 20px var(--display);letter-spacing:.04em">${esc(e.name)}</b><span class="pill ${st} plain">${esc(e.status)}</span><span class="grow"></span>${p ? '<span class="pill ok">Linked</span>' : '<span class="pill bad">Not set up</span>'}</div>
      <div class="small muted" style="margin:6px 0 12px">${e.for.map(id => esc(byId(C, id).name)).join(' · ')}${e.note ? ' — ' + esc(e.note) : ''}</div>
      <div class="folder"><span class="p mono" title="${esc(p)}">${p ? esc(p) : '<span class="faint">No program selected</span>'}</span>${p ? driveBadge(p) : ''}</div>
      ${p && emuUp.ids.includes(e.id) ? emuUpdateRow(e.id) : ''}
      <div class="setrow" style="border:0;padding:6px 0"><div class="lbl"><b>Launch options</b><span>{rom} = game file · {romdir} · {emudir} · {core}</span></div><input class="input mono" style="width:260px" data-emuargs="${e.id}" value="${esc(emuArgs(e.id))}"></div>
      <div class="row"><button class="btn sm primary" data-act="pickEmu" data-arg="${e.id}">${p ? 'Change' : 'Locate'} .exe</button>
        ${p ? `<button class="btn sm" data-act="runEmu" data-arg="${e.id}">Open emulator</button><button class="btn sm ghost" data-act="reveal" data-arg="${esc(p)}">Show folder</button>` : ''}
        <button class="btn sm ghost" data-act="url" data-arg="${esc(e.url)}">${ico('link', 14)} Official page</button>
        ${S.emulators[e.id] && S.emulators[e.id].args ? `<button class="btn sm ghost" data-act="resetArgs" data-arg="${e.id}">Reset options</button>` : ''}</div></div>`; }).join('')}</div></div>`; };

V.firmware = () => `<div class="view"><h1 class="h1">Firmware &amp; BIOS</h1>
  <p class="sub">Some consoles need system files from real hardware. EchoForge never downloads or shares them: dump them from consoles you own. Point each console at a folder and EchoForge checks the files, including checksums where they’re known.</p>
  <div class="panel glow" style="margin-bottom:18px"><div class="row"><div class="grow"><b>One folder for everything</b><div class="small muted">Choose a base folder and EchoForge uses a subfolder per console (for example <span class="mono">…\\ps2</span>). A console with its own folder set below overrides this.</div>
    <div class="mono small" style="margin-top:6px">${set().firmwareRoot ? esc(set().firmwareRoot) : '<span class="faint">Not set</span>'}</div></div>
    <button class="btn primary" data-act="pickFwRoot">${ico('folder')} Choose base folder</button>${set().firmwareRoot ? `<button class="btn" data-act="makeFwDirs">Create console subfolders</button>` : ''}</div></div>
  ${C.filter(c => c.bios.length && cc(c.id).enabled).map(c => { const dir = biosDir(c.id), res = bios[c.id] || [];
    return `<div class="panel" style="margin-bottom:14px;${hueVars(c)}"><div class="row"><span class="chip" style="width:34px;height:26px;display:grid;place-items:center;font:700 10px var(--display);color:#111;background:linear-gradient(140deg,${c.hue[0]},${c.hue[1]});clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)">${esc(c.short)}</span><b style="font:600 18px var(--display);letter-spacing:.05em">${esc(c.name)}</b><span class="grow"></span>
      <button class="btn sm" data-act="pickBios" data-arg="${c.id}">${ico('folder', 14)} ${cc(c.id).biosDir ? 'Change folder' : 'Use own folder'}</button>${dir ? `<button class="btn sm ghost" data-act="openPath" data-arg="${esc(dir)}">Open</button>` : ''}<button class="btn sm ghost" data-act="recheck" data-arg="${c.id}">Re-check</button></div>
      <div class="mono small muted" style="margin:8px 0 6px">${dir ? esc(dir) : 'No folder set'}</div>
      ${c.bios.map((b, i) => { const r = res[i] || {}; const man = cc(c.id).manual[b.id];
        const fw = emuFw(c.id, b.id);
        const st = fw ? ['ok', `Installed in ${emuFor(b.inEmu.emulator).name}${fw === 'installed' ? '' : ' · ' + fw}`] : man ? ['ok', 'Installed in emulator'] : r.found ? (r.md5ok === false ? ['bad', 'Bad checksum'] : ['ok', r.md5ok ? 'Verified' : 'Found']) : [b.required ? 'bad' : 'warn', b.required ? 'Missing' : 'Optional'];
        return `<div class="setrow"><div class="lbl"><b>${esc(b.label)}</b><span>${esc(b.help)}</span>${r.md5 && r.md5ok === false ? `<span class="mono small" style="display:block">md5 ${esc(r.md5)}</span>` : ''}</div>
          ${b.url ? `<button class="btn sm ghost" data-act="url" data-arg="${esc(b.url)}">${ico('link', 14)} Official info</button>` : ''}
          ${b.manual && !fw ? `<label class="row small"><input type="checkbox" class="toggle" data-manual="${c.id}.${b.id}" ${man ? 'checked' : ''}> Installed in emulator</label>` : ''}
          <span class="pill ${st[0]}">${st[1]}</span></div>`; }).join('')}</div>`; }).join('')}
  <div class="panel"><b>Consoles that need nothing:</b> <span class="muted">${C.filter(c => !c.bios.length).map(c => esc(c.name)).join(', ')}.</span></div></div>`;

// ---------------- settings ----------------
// Neon effects. Each id has a matching [data-neon="id"] block in styles.css; add new ones in both places.
const NEON_EFFECTS = [['breathe', 'Breathe'], ['pulse', 'Pulse (heartbeat)'], ['chase', 'Chase (light runs around borders)'], ['flicker', 'Neon flicker'], ['cycle', 'Color cycle'], ['steady', 'Steady glow'], ['off', 'Off']];
const SETTINGS = [
  { id: 'general', name: 'General', rows: [
    ['startView', 'Open on', 'Which page EchoForge shows when it starts.', 'select', [['home', 'Home'], ['library', 'All Games'], ['last', 'Last page used']]],
    ['launchAtLogin', 'Start with Windows', 'Launch EchoForge when you sign in.', 'toggle'],
    ['appUpdateCheck', 'Check for EchoForge updates', 'Once a day, EchoForge looks for a new version on its GitHub Releases page and tells you. Nothing installs until you press Update.', 'toggle'],
    ['emuUpdateCheck', 'Check for emulator updates', 'Once a day, EchoForge looks for new KytyPS5 and shadPS4 builds on their official GitHub pages and tells you, following each emulator’s Tested, Latest or Keep choice on the Emulators page. Nothing installs until you press Update.', 'toggle'],
    ['autoScan', 'Scan libraries on startup', 'Finds new games in your folders every time EchoForge opens.', 'toggle'],
    ['_wizard', 'Setup assistant', 'Walk through emulators, folders and firmware again.', 'button', 'Run setup']
  ] },
  { id: 'look', name: 'Appearance', rows: [
    ['theme', 'Accent', 'The forge color used across the app.', 'swatch'],
    ['mode', 'Background', '', 'select', [['dark', 'Graphite (dark)'], ['oled', 'OLED black'], ['light', 'Light']]],
    ['card', 'Cover size', '', 'range', [130, 280, 2]],
    ['cover', 'Cover shape', '', 'select', [['portrait', 'Box art (3:4)'], ['square', 'Square (PS icons)'], ['wide', 'Wide (16:9)']]],
    ['titles', 'Show titles under covers', '', 'toggle'],
    ['fx', 'Background glow and hex texture', '', 'toggle'],
    ['neon', 'Neon effect', 'Titles, headers and borders glow in your theme’s neon colors. Pauses while you play; follows Reduce motion.', 'select', NEON_EFFECTS],
    ['neonSpeed', 'Effect speed', 'Percent of normal speed.', 'range', [40, 250, 10]],
    ['bgArt', 'Highlighted game as background', 'The game under your mouse or controller fills the background, blurred, behind the glow.', 'toggle'],
    ['bgBlur', 'Background blur', 'Pixels. 0 = sharp.', 'range', [0, 40, 2]],
    ['bgArtStrength', 'Background strength', 'Percent. Lower keeps text easier to read.', 'range', [10, 90, 5]],
    ['compact', 'Compact sidebar', 'Icons only.', 'toggle'],
    ['scale', 'Interface size', 'Scales everything — useful on TVs and 4K monitors.', 'range', [80, 150, 5]]
  ] },
  { id: 'library', name: 'Library', rows: [
    ['sort', 'Default sort', '', 'select', [['title', 'A → Z'], ['recent', 'Recently played'], ['playtime', 'Most played'], ['added', 'Recently added'], ['size', 'Largest']]],
    ['hideOffline', 'Hide games on unplugged drives', 'Off = they show greyed out as “Drive offline”.', 'toggle'],
    ['showHidden', 'Show hidden games', '', 'toggle'],
    ['romRoot', 'Fast library root (SSD)', 'PS4, PS5 and Xbox One games, one subfolder per console, e.g. …\\Roms\\Playstation 4.', 'text'],
    ['storageRoot', 'Storage library root (hard drive)', 'Optional. PS3, Xbox 360 and older consoles (PS1, PS2, PSP, GameCube, Wii, Xbox) live here. Your PC → Game storage suggests moves.', 'text'],
    ['useRomDirs', 'Standard console folders', 'Creates a folder per console under the ROM library root and adds it to that console’s library.', 'button', 'Create & add folders'],
    ['autoArt', 'Download missing box art', 'Covers come from the libretro thumbnails library (the one RetroArch uses), Only console and game names are sent.', 'toggle'],
    ['xboxUnityArt', 'Xbox 360 covers from XboxUnity', 'A community cover database, used when libretro has no cover. Only the disc’s title ID is sent. Off until you turn it on.', 'toggle'],
    ['gameTdbArt', 'PS3 covers from GameTDB', 'A community cover database with box art for most PS3 games, used in place of the small disc icon. Only the disc’s title ID is sent. Off until you turn it on.', 'toggle'],
    ['compatCheck', 'Check which games run', 'Looks up PS3 games on RPCS3’s compatibility list and Xbox 360 games on Xenia Canary’s. Only the game’s disc ID is sent. Refreshed weekly.', 'toggle'],
    ['compatBadges', 'Show “will it run?” badges on covers', 'The game’s details always show it.', 'toggle'],
    ['scanDepth', 'Folder scan depth', 'How many subfolders deep to look. PS3/PS4 folders need at least 4.', 'range', [2, 10, 1]],
    ['ignore', 'Ignore paths containing', 'Comma separated, e.g. update, dlc, backup', 'text'],
    ['_rescan', 'Rescan everything', 'Runs a full scan of every console folder now.', 'button', 'Scan all']
  ] },
  { id: 'inbox', name: 'Import', rows: [
    ['inboxFolder', 'Import folder', 'The folder EchoForge checks for game files. Nothing is checked until you choose one.', 'text'],
    ['dlAutoSwitch', 'Move Downloads when the drive runs low', 'Windows’ Downloads folder is pointed at the folder below, so browsers save new downloads there. Files already downloaded stay put.', 'toggle'],
    ['dlSwitchAtGB', 'Move when free space drops below', 'GB left on the drive that holds Downloads. Games you import also go to your other library drive when their usual drive would drop below this.', 'range', [25, 300, 25]],
    ['dlTarget', 'New Downloads folder', 'On your other drive, e.g. D:\\Downloads.', 'text'],
    ['_dlBack', 'Downloads folder', '', 'button', 'Switch back'],
    ['inboxRecycle', 'Recycle archives after adding', 'The .7z / .zip goes to the Recycle Bin once every file is checked, so you can still restore it.', 'toggle'],
    ['inboxAutoClean', 'Remove shortcuts and screensavers automatically', 'Shortcuts and screensavers in the import folder go to the Recycle Bin. Nothing there is ever run.', 'toggle'],
    ['inboxMinFree', 'Keep free on each drive', 'GB. When a drive would drop below this, the game goes to your other library drive instead.', 'range', [5, 100, 5]]
  ] },
  { id: 'launch', name: 'Launching & performance', rows: [
    ['onLaunch', 'When a game starts', 'Getting the launcher out of the way frees GPU time for the game.', 'select', [['minimize', 'Minimize EchoForge'], ['hide', 'Hide EchoForge completely'], ['nothing', 'Do nothing']]],
    ['priority', 'Emulator CPU priority', 'Above normal is the sweet spot on a 6-core CPU. High can starve Windows audio.', 'select', [['normal', 'Normal'], ['above', 'Above normal (recommended)'], ['high', 'High']]],
    ['gameMode', 'Game mode', 'Pauses EchoForge animations, sounds and controller polling while you play.', 'toggle'],
    ['ramGuard', 'Low-memory warning', 'Warns before launch if free RAM is below what the console needs.', 'toggle'],
    ['playtime', 'Track play time', '', 'toggle'],
    ['disableGpu', 'Software rendering for EchoForge', 'Only if the launcher itself glitches. Needs a restart.', 'toggle']
  ] },
  { id: 'controller', name: 'Controller', rows: [
    ['gamepad', 'Navigate with a controller', 'D-pad / left stick moves, A selects, B goes back, Y favorites, LB/RB switch sections.', 'toggle'],
    ['padLabels', 'Button labels', '', 'select', [['xbox', 'Xbox (A B X Y)'], ['ps', 'PlayStation (✕ ○ □ △)']]],
    ['deadzone', 'Stick deadzone', '', 'range', [0.15, 0.7, 0.05]],
    ['rumble', 'Rumble on select', '', 'toggle']
  ] },
  { id: 'sound', name: 'Sound', rows: [
    ['sounds', 'Interface sounds', '', 'toggle'],
    ['volume', 'Volume', '', 'range', [0, 100, 5]]
  ] },
  { id: 'tv', name: 'Big Picture', rows: [
    ['bigpicStart', 'Start in Big Picture', 'For couch and TV setups.', 'toggle'],
    ['bigpicFullscreen', 'Go full screen in Big Picture', '', 'toggle'],
    ['_bigpic', 'Try it now', 'F10 toggles it anywhere.', 'button', 'Enter Big Picture']
  ] },
  { id: 'access', name: 'Accessibility', rows: [
    ['motion', 'Motion', '', 'select', [['full', 'Full'], ['reduced', 'Reduced'], ['off', 'Off']]],
    ['highContrast', 'High contrast', '', 'toggle'],
    ['focusStrong', 'Extra-bold focus outline', 'Makes the selected item easier to see from the couch.', 'toggle']
  ] },
  { id: 'data', name: 'Data & backup', rows: [
    ['_export', 'Back up', 'Saves settings, library, play time and favorites to a file.', 'button', 'Export'],
    ['_import', 'Restore', 'Loads a backup file. Replaces what’s here now.', 'button', 'Import'],
    ['_clearLib', 'Clear library', 'Removes all games from EchoForge. Your files are not touched.', 'danger', 'Clear'],
    ['_resetAll', 'Reset everything', 'Back to first launch. Your files are not touched.', 'danger', 'Reset']
  ] },
  { id: 'about', name: 'About', rows: [] }
];
let setTab = 'general';
const dlHelp = () => { const s = set(); return `Now ${dlFolder || 'your Downloads folder'}.` + (s.dlPrevFolder ? ` Moved from ${s.dlPrevFolder} ${fmtAgo(s.dlSwitchedAt)} because that drive was low. Switching back points Downloads there again and turns the automatic move off.` : ''); };
V.settings = () => {
  const s = set(); const sec = SETTINGS.find(x => x.id === setTab);
  const ctl = ([k, , , type, opt]) => {
    if (type === 'toggle') return `<input type="checkbox" class="toggle" data-set="${k}" ${s[k] ? 'checked' : ''}>`;
    if (type === 'select') return `<select class="input" data-set="${k}">${opt.map(([v, l]) => `<option value="${v}" ${String(s[k]) === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    if (type === 'range') return `<div class="row"><input type="range" min="${opt[0]}" max="${opt[1]}" step="${opt[2]}" value="${s[k]}" data-set="${k}" data-num><span class="mono" style="width:44px">${s[k]}</span></div>`;
    if (type === 'text') return `<input class="input" style="width:280px" data-set="${k}" value="${esc(s[k])}">`;
    if (type === 'swatch') return `<div class="swatches">${[['ember', '#ff6a1f,#e5145f'], ['glacier', '#3fc3ff,#4c5cff'], ['verdant', '#4fdc6b,#0f9d8a'], ['amethyst', '#b066ff,#5b3cff'], ['solar', '#ffc21f,#ff7a1f'], ['mono', '#c9c9d1,#7a7a86']].map(([n, g]) => `<button class="swatch ${s.theme === n ? 'on' : ''}" title="${n}" style="background:linear-gradient(135deg,${g})" data-act="theme" data-arg="${n}"></button>`).join('')}</div>`;
    if (k === '_dlBack' && !s.dlPrevFolder) return '';
    if (type === 'button') return `<button class="btn" data-act="${k}">${esc(opt)}</button>`;
    if (type === 'danger') return `<button class="btn danger" data-act="${k}">${esc(opt)}</button>`;
    return '';
  };
  const about = `<div class="panel" style="display:flex;gap:24px;align-items:center"><img src="assets/logo.svg" width="110" alt=""><div><div class="wordmark" style="font-size:26px">ECHO<b>FORGE</b></div><div class="muted">Version ${esc(appVersion)} · open-source launcher for next-gen console emulation</div>
    <p class="small muted">EchoForge doesn’t include games, firmware or BIOS files. Use content you own. Emulators are separate projects under their own licenses.</p>
    <div class="small" style="margin:10px 0"><b>Updates</b> <span class="muted">${appUpdateText()}</span></div>
    <div class="row">${appUp.info && appUp.info.ok && appUp.info.update ? `<button class="btn sm primary" data-act="appUpdate" ${appUp.busy ? 'disabled' : ''}>${appUp.busy ? `Downloading ${appUp.pct}%` : `Update to ${esc(appUp.info.latest.version)}`}</button>` : ''}<button class="btn sm" data-act="appUpCheck" ${appUp.busy ? 'disabled' : ''}>Check for updates</button><button class="btn sm" data-act="openData">Open data folder</button></div></div></div>`;
  return `<div class="view"><h1 class="h1">Settings</h1><p class="sub">Every change saves instantly.</p>
    <div class="setwrap"><div class="setnav">${SETTINGS.map(x => `<button class="${x.id === setTab ? 'on' : ''}" data-act="stab" data-arg="${x.id}">${esc(x.name)}</button>`).join('')}</div>
    <div class="panel">${setTab === 'about' ? about : sec.rows.map(r => { const help = r[0] === '_dlBack' ? dlHelp() : r[2]; return `<div class="setrow"><div class="lbl"><b>${esc(r[1])}</b>${help ? `<span>${esc(help)}</span>` : ''}</div>${ctl(r)}</div>`; }).join('')}</div></div></div>`;
};

// ---------------- game details ----------------
// ---------------- game page ----------------
// A full-screen page per game: its own HD background (PS3/PSP PIC1), an in-game screenshot or the cover behind it,
// then screenshots, more from its collection, and everything you can change about it under "Manage".
let gameBack = null; // where Back returns to, with its scroll position
function openGame(gid) {
  if (!game(gid)) return; closeModal();
  if (route.view === 'game' && route.param === gid) { render(); return; }
  if (route.view !== 'game') gameBack = { view: route.view, param: route.param, top: $('#main').scrollTop };
  go('game', gid);
}
function leaveGame() {
  const b = gameBack || { view: 'home', param: null, top: 0 }; gameBack = null;
  keepSeries = b.view === 'library' && !!lib.series; go(b.view, b.param); $('#main').scrollTop = b.top || 0;
}
// Screenshots and title screens from the same library as the covers (PS3 and Xbox 360 have almost none there).
let fetchingShots = false;
async function fetchMissingShots() {
  if (fetchingShots || !set().autoArt) return; fetchingShots = true; let n = 0;
  try {
    for (const g of S.games) {
      if (g.console === 'x360' || (g.shotsTried && Date.now() - g.shotsTried < 30 * 864e5)) continue;
      const parts = g.path.split(/[\\/]/), base = parts[parts.length - 1].replace(/\.[^.]+$/, '').replace(/\.nkit$/i, '');
      const r = await window.ef.fetchShots({ id: g.id, console: g.console, names: [base, /usrdir/i.test(parts[parts.length - 2]) ? '' : parts[parts.length - 2], g.title] });
      g.shotsTried = Date.now();
      if (r && r.ok) { for (const [k, f] of [['snap', r.snap], ['titleShot', r.title]]) if (f) { imgCache.delete(f); g[k] = f; } if (r.snap || r.title) n++; }
    }
  } finally { fetchingShots = false; }
  if (n) { save(); if (route.view === 'game') render(); }
  return n;
}
V.game = (gid) => {
  const g = game(gid); if (!g) return V.home();
  const c = byId(C, g.console), conf = cc(g.console), s = seriesOfGame(g), k = g.compat;
  const mates = s ? s.games.filter(x => x.id !== g.id) : [];
  const shots = [...new Set([g.snap, g.titleShot, g.console === 'psp' || g.console === 'ps3' ? g.bg : null].filter(Boolean))];
  return `<div class="view gpage" style="${hueVars(c)}">
    <div class="gp-back" id="gpBack"></div>
    <button class="btn sm ghost gp-backbtn" data-act="back">← Back</button>
    <section class="gp-hero">
      <div class="gp-cover">${coverHTML(g, { play: false, tag: false })}</div>
      <div class="gp-info">
        <div class="row" style="gap:8px;flex-wrap:wrap"><span class="pill plain">${esc(c.name)}</span>${g.titleId ? `<span class="pill plain mono">${esc(g.titleId)}</span>` : ''}${g.region ? `<span class="pill plain">${esc(g.region)}</span>` : ''}
          ${k && COMPAT_CONSOLES.has(g.console) ? `<span class="pill ${{ ok: 'ok', warn: 'warn', bad: 'bad' }[k.status] || 'info'}" title="${esc(k.source)}${k.date ? ' · tested ' + esc(k.date) : ''}">${esc(k.label)}</span>` : ''}
          ${s ? `<button class="pill plain gp-coll" data-act="openSeries" data-arg="${esc(s.key)}">${ico('stack', 12)} ${esc(s.name)}</button>` : ''}${isOffline(g) ? '<span class="pill warn">Drive offline</span>' : ''}<span class="pill plain" title="${needsSSD(g) ? 'Keep this game on an SSD.' : 'Runs fine from a hard drive, however big it is.'}">${needsSSD(g) ? 'Needs an SSD' : 'No SSD needed'}</span></div>
        <h1 class="gp-title">${esc(tt(g))}</h1>
        <div class="gp-stats">${g.lastPlayed ? `<span><b>${esc(fmtTime(g.playtime))}</b> played</span><span>Last played <b>${esc(fmtAgo(g.lastPlayed))}</b></span>` : '<span><b>Not played yet</b></span>'}<span><b>${esc(fmtSize(g.size))}</b></span>${driveBadge(g.path)}</div>
        <div class="row" style="margin-top:22px;gap:10px;flex-wrap:wrap">
          <button class="btn primary lg" data-act="play" data-arg="${g.id}" data-autofocus>${ico('play')} Play</button>
          <button class="btn lg ${g.fav ? 'primary' : 'ghost'}" data-act="fav" data-arg="${g.id}">${ico('star', 16)} ${g.fav ? 'Favorited' : 'Favorite'}</button>
          ${k && k.url ? `<button class="btn lg ghost" data-act="url" data-arg="${esc(k.url)}">Tester report</button>` : ''}</div>
        ${(k && k.tips || []).map(t => `<div class="small muted" style="margin-top:8px">Tip: ${esc(t)}</div>`).join('')}
      </div>
    </section>
    ${shots.length ? `<div class="h2">Screenshots</div><div class="gp-shots">${shots.map(p => `<button class="gp-shot" data-act="shot" data-arg="${esc(p)}"><img data-img="${esc(p)}" alt=""></button>`).join('')}</div>` : ''}
    ${mates.length ? `<div class="h2">More in ${esc(s.name)}</div><div class="shelf">${mates.map(gameCard).join('')}</div>` : ''}
    <div class="h2">Manage</div>
    <div class="panel">${gameManage(g, c, conf, s)}</div>
  </div>`;
};
function gameManage(g, c, conf, s) {
  const names = [...new Set(seriesData().list.map(x => x.name))];
  return `<div class="setrow"><div class="lbl"><b>Name</b><span>Shown as “${esc(tt(g))}”.</span></div><input class="input" style="width:320px" data-gtitle="${g.id}" value="${esc(g.title)}"></div>
    <div class="setrow"><div class="lbl"><b>Cover</b><span>${g.cover ? (g.artAuto ? 'Found online.' : 'Your own picture.') : g.icon ? 'The game’s own icon.' : 'None yet.'}</span></div><div class="row"><button class="btn sm" data-act="pickCover" data-arg="${g.id}">Change cover</button>${g.cover ? `<button class="btn sm ghost" data-act="resetCover" data-arg="${g.id}">Reset</button>` : `<button class="btn sm ghost" data-act="findArt" data-arg="${g.id}">Find cover online</button>`}</div></div>
    <div class="setrow"><div class="lbl"><b>Collection</b><span>${g.series === '-' ? 'Kept out of collections.' : s ? `In ${esc(s.name)} (${s.games.length} games)${g.series ? '' : ', found automatically'}.` : 'Not in a collection.'} Type a name to move it, “-” to keep it out, or clear it to go back to automatic.</span></div>
      <input class="input" style="width:220px" list="seriesNames" data-gseries="${g.id}" value="${esc(g.series || '')}" placeholder="${esc(s && !g.series ? s.name : 'Automatic')}"><datalist id="seriesNames">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist></div>
    ${c.launch === 'appx' ? '' : `<div class="setrow"><div class="lbl"><b>Emulator for this game</b></div><select class="input" data-gemu="${g.id}"><option value="">Section default (${esc(emuFor(conf.emulator).name)})</option>${c.emulators.map(id => `<option value="${id}" ${g.emu === id ? 'selected' : ''}>${esc(emuFor(id).name)}</option>`).join('')}</select></div>
    <div class="setrow"><div class="lbl"><b>Launch options for this game</b><span>Leave empty to use the emulator’s options.</span></div><input class="input mono" style="width:220px" data-gargs="${g.id}" value="${esc(g.args || '')}" placeholder="${esc(emuArgs(g.emu || conf.emulator))}"></div>`}
    <div class="setrow"><div class="lbl"><b>File</b><span class="mono" style="word-break:break-all">${esc(g.path)}</span></div><div class="row"><button class="btn sm ghost" data-act="reveal" data-arg="${esc(g.path)}">Show file</button><button class="btn sm ghost" data-act="hide" data-arg="${g.id}">${g.hidden ? 'Unhide' : 'Hide'}</button><button class="btn sm danger" data-act="rmGame" data-arg="${g.id}">Remove</button><button class="btn sm danger" data-act="binGame" data-arg="${g.id}">${ico('trash', 14)} Recycle Bin</button></div></div>`;
}

// ---------------- guide & tour ----------------
// Content lives in app/guide.js. The tour runs once, after setup on a first install, and any time from the Guide.
V.guide = () => `<div class="view guide"><h1 class="h1">Guide</h1>
  <p class="sub">Step-by-step help for everything EchoForge does. Press F1 to come back here any time.</p>
  <div class="row" style="margin-bottom:16px"><input class="input grow" id="guideQ" placeholder="Search the guide" spellcheck="false" style="max-width:420px" data-nav><button class="btn primary" data-act="tour">${ico('wand')} Take the tour</button></div>
  <div class="guide-index">${window.EF_GUIDE.map(s => `<button class="chip-link" data-act="guideJump" data-arg="${s.id}">${ico(s.icon, 14)} ${esc(s.title)}</button>`).join('')}</div>
  ${window.EF_GUIDE.map(s => `<section class="panel guide-sec" id="guide-${s.id}"><div class="h2" style="margin-top:0">${ico(s.icon, 16)} ${esc(s.title)}</div>
    <p class="muted" style="margin:-4px 0 12px">${esc(s.intro)}</p>
    <ol class="guide-steps">${s.steps.map(st => `<li data-gtext="${esc(st.text.toLowerCase())}"><span>${esc(st.text)}</span>${st.go ? `<button class="btn sm ghost" data-act="go" data-arg="${esc(st.go)}">Take me there</button>` : st.act ? `<button class="btn sm ghost" data-act="${esc(st.act)}">${esc(st.label || 'Open')}</button>` : ''}</li>`).join('')}</ol>
    ${(s.tips || []).map(t => `<div class="guide-tip small" data-gtext="${esc(t.toLowerCase())}">${esc(t)}</div>`).join('')}</section>`).join('')}
  <div class="empty" id="guideNone" hidden><div class="big">Nothing found</div><div>Try another word, like “firmware” or “controller”.</div></div></div>`;
function filterGuide(q) {
  q = q.trim().toLowerCase(); let any = false;
  for (const sec of $$('.guide-sec')) {
    let hits = 0; const inTitle = !q || sec.querySelector('.h2').textContent.toLowerCase().includes(q);
    for (const el of $$('[data-gtext]', sec)) { const ok = inTitle || el.dataset.gtext.includes(q); el.hidden = !ok; if (ok) hits++; }
    sec.hidden = !hits; if (hits) any = true;
  }
  const none = $('#guideNone'); if (none) none.hidden = any;
}
let tour = null; // { step }
function startTour() { closeModal(); if (route.view === 'game') go('home'); tour = { step: 0 }; showTour(); }
function showTour() {
  let box = $('#tour'); if (!box) { box = document.createElement('div'); box.id = 'tour'; document.body.appendChild(box); }
  const steps = window.EF_TOUR, st = steps[tour.step], el = st.target && $(st.target);
  if (el) el.scrollIntoView({ block: 'nearest' });
  const r = el && el.getBoundingClientRect(), pad = 6;
  const spot = r ? `<div class="tour-spot" style="left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px"></div>` : '<div class="tour-dim"></div>';
  // The card sits beside the highlight, kept on screen.
  let pos = 'left:50%;top:50%;transform:translate(-50%,-50%)';
  if (r) { const w = 360, left = r.right + 18 + w < innerWidth ? r.right + 18 : Math.max(16, r.left - w - 18); const top = Math.min(Math.max(16, r.top), innerHeight - 230); pos = `left:${left}px;top:${top}px`; }
  box.innerHTML = `${spot}<div class="tour-card panel" style="${pos}" role="dialog" aria-label="${esc(st.title)}">
    <div class="small faint">${tour.step + 1} of ${steps.length}</div><h3>${esc(st.title)}</h3><p class="muted">${esc(st.text)}</p>
    <div class="row"><button class="btn ghost sm" data-act="tourEnd">Skip</button><span class="grow"></span>
      ${tour.step ? '<button class="btn sm" data-act="tourBack">Back</button>' : ''}<button class="btn primary sm" data-act="tourNext" id="tourNext">${tour.step === steps.length - 1 ? 'Done' : 'Next'}</button></div></div>`;
  setTimeout(() => { const n = $('#tourNext'); n && n.focus(); }, 20);
}
function endTour() { tour = null; const box = $('#tour'); if (box) box.remove(); if (!S.tourDone) { S.tourDone = true; save(); } }
window.addEventListener('resize', () => { if (tour) showTour(); });

// ---------------- setup wizard ----------------
let wz = { step: 0 };
function wizard(step = 0) {
  wz.step = step; const steps = 5;
  const bar = `<div class="steps">${Array.from({ length: steps }, (_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>`;
  const nav = (back, next, nextLabel = 'Next') => `<div class="foot">${back ? `<button class="btn ghost" data-act="wzGo" data-arg="${step - 1}">Back</button>` : `<button class="btn ghost" data-act="wzSkip">Skip setup</button>`}<span class="grow"></span><button class="btn primary" data-act="${next}" data-arg="${step + 1}" data-autofocus>${nextLabel}</button></div>`;
  let body = '';
  if (step === 0) body = `<div style="display:flex;gap:22px;align-items:center"><img src="assets/logo.svg" width="96" alt=""><div><h3>Welcome to EchoForge</h3><p class="muted" style="margin:0">Four quick steps and your libraries will build themselves. You can change everything later.</p></div></div>
    <div class="panel" style="margin-top:18px"><b>Detected:</b> <span class="muted">${esc(hw.gpu || 'GPU')}${hw.vramGB ? ` ${hw.vramGB} GB` : ''} · ${esc(hw.cpu)} · ${hw.ramGB} GB RAM · ${hw.drives.length} drives</span></div>${nav(false, 'wzGo', 'Let’s go')}`;
  if (step === 1) body = `<h3>Which consoles do you play?</h3><p class="muted">Unchecked consoles are hidden. Turn them back on any time.</p>
    <div class="pick">${C.map(c => `<label><input type="checkbox" data-wzc="${c.id}" ${cc(c.id).enabled ? 'checked' : ''}> <span>${esc(c.name)}</span></label>`).join('')}</div>${nav(true, 'wzConsoles')}`;
  if (step === 2) {
    const need = [...new Set(enabledConsoles().flatMap(c => c.emulators))].map(emuFor).filter(e => !e.nolink);
    body = `<h3>Link your emulators</h3><p class="muted">Try auto-detect first. For anything not found, use “Locate” to pick its .exe, or “Get it” to open the official download page.</p>
      <div class="row" style="margin-bottom:12px"><button class="btn primary" data-act="detect">${ico('scan')} Auto-detect</button></div>
      ${need.map(e => `<div class="folder"><b style="width:120px">${esc(e.name)}</b><span class="p mono small">${emuPath(e.id) ? esc(emuPath(e.id)) : '<span class="faint">not linked</span>'}</span>${emuPath(e.id) ? '<span class="pill ok">OK</span>' : ''}<button class="btn sm" data-act="pickEmu" data-arg="${e.id}">Locate</button><button class="btn sm ghost" data-act="url" data-arg="${esc(e.url)}">Get it</button></div>`).join('')}${nav(true, 'wzGo')}`;
  }
  if (step === 3) body = `<h3>Where are your games?</h3><p class="muted">Add one or more folders per console, on any drive. Each one is labelled with its drive type.</p>
    ${set().romRoot ? `<div class="row" style="margin-bottom:10px"><button class="btn primary sm" data-act="useRomDirs">Use ${esc(set().romRoot)}\\&lt;console&gt; for every console</button></div>` : ''}
    ${enabledConsoles().map(c => `<div class="folder"><b style="width:140px">${esc(c.name)}</b><span class="p small">${cc(c.id).folders.map(f => `${esc(f)} ${driveBadge(f)}`).join('<br>') || '<span class="faint">no folder</span>'}</span><button class="btn sm" data-act="addFolder" data-arg="${c.id}">Add folder</button></div>`).join('')}${nav(true, 'wzGo')}`;
  if (step === 4) body = `<h3>Firmware & BIOS</h3><p class="muted">Pick one base folder for system files you dumped from your consoles. EchoForge can create a subfolder for each console.</p>
    <div class="folder"><span class="p mono">${set().firmwareRoot ? esc(set().firmwareRoot) : '<span class="faint">not set</span>'}</span><button class="btn sm" data-act="pickFwRoot">Choose folder</button>${set().firmwareRoot ? '<button class="btn sm ghost" data-act="makeFwDirs">Create subfolders</button>' : ''}</div>
    <p class="small muted">Not ready yet? Skip it. Each console page shows exactly what’s missing.</p>${nav(true, 'wzFinish', 'Finish & scan')}`;
  modal(bar + body, { wide: true });
}

// ---------------- actions ----------------
let appVersion = '';
const ACT = {
  go: (arg) => { const [v, p] = arg.split(':'); closeModal(); go(v, p || null); },
  close: () => closeModal(),
  scrim: (_a, el, ev) => { if (ev.target === el) closeModal(); },
  winMin: () => window.ef.win.min(), winMax: () => window.ef.win.max(), winClose: () => window.ef.win.close(),
  bigpic: () => setBigPicture(!bigpic), _bigpic: () => setBigPicture(true),
  play: (id) => play(id), retryPlay: async (id) => { await checkDrives(); closeModal(); play(id); },
  openGame: (id) => openGame(id),
  back: () => leaveGame(),
  shot: async (p) => { const d = await cachedImage(p); if (d) modal(`<img src="${d}" alt="" style="display:block;width:100%;border-radius:8px;image-rendering:auto"><div class="foot"><button class="btn ghost" data-act="close" data-autofocus>Close</button></div>`, { wide: true }); },
  stopGame: async () => { if (!set().confirmStop || await confirmBox('Stop the game?', 'Unsaved progress in the emulator will be lost.', 'Stop game', true)) window.ef.stop(); },
  fav: (id) => { const g = game(id); g.fav = !g.fav; save(); openGame(id); render(); },
  hide: (id) => { const g = game(id); g.hidden = !g.hidden; save(); closeModal(); render(); renderSide(); toast(g.hidden ? 'Game hidden. Show it again from Settings → Library.' : 'Game visible again.'); },
  rmGame: async (id) => { const g = game(id); if (await confirmBox('Remove from library?', `“${esc(tt(g))}” is removed from EchoForge. The file on disk is <b>not</b> deleted, and a rescan brings it back.`, 'Remove', true)) { S.games = S.games.filter(x => x.id !== id); save(); if (route.view === 'game') leaveGame(); else render(); renderSide(); } },
  binGame: async (id) => {
    const g = game(id); if (!g) return;
    if (running && running.gid === id) return toast('Close the game first.', 'bad');
    const o = { file: g.path, libFolders: cc(g.console).folders, keep: [...Object.values(S.consoles).flatMap(c => c.folders || []), ...S.games.filter(x => x.id !== id).map(x => x.path), ...Object.values(S.emulators).map(e => e.path).filter(Boolean)] };
    const p = await window.ef.recycleInfo(o);
    if (!p.ok) return toast(`${esc(tt(g))} can’t be recycled: ${esc(p.error)}`, 'bad');
    if (!await confirmBox('Send to the Recycle Bin?', `“${esc(tt(g))}” leaves your library and <b>${fmtSize(p.bytes)}</b> (${p.files} file${p.files === 1 ? '' : 's'}) goes to the Recycle Bin:<br><span class="mono" style="word-break:break-all">${p.paths.map(esc).join('<br>')}</span><br>You can restore it from the bin until it’s emptied. Saves in the emulator are kept. Windows clears the oldest items when the bin is full.`, 'Send to Recycle Bin', true)) return;
    const r = await window.ef.recycleGame(o);
    if (!r.ok) return toast(`${esc(tt(g))}: ${esc(r.error)}`, 'bad');
    S.games = S.games.filter(x => x.id !== id); save(); toast(`${esc(tt(g))} is in the Recycle Bin. ${fmtSize(r.bytes)} moved out of your library.`, 'ok');
    if (route.view === 'game') leaveGame(); else render(); renderSide();
  },
  pickCover: async (id) => { const f = await window.ef.pickFile({ title: 'Choose cover image', filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }] }); if (f) { game(id).cover = f; save(); openGame(id); render(); } },
  resetCover: (id) => { const g = game(id); if (g.artAuto) g.noArt = true; delete g.cover; delete g.artAuto; save(); openGame(id); render(); },
  findArt: async (id) => { const g = game(id); delete g.noArt; g.artTried = 0; toast('Looking for a cover…'); const n = await fetchMissingArt(true); toast(game(id).cover ? 'Cover found.' : 'No cover found for this game. Use “Change cover” to pick one.', game(id).cover ? 'ok' : ''); if (n || game(id).cover) openGame(id); },
  libConsole: (id) => { lib.console = id; render(); }, libFav: () => { lib.fav = !lib.fav; render(); }, libLayout: (l) => { lib.layout = l; render(); },
  ctab: (t) => { consoleTab = t; render(); }, stab: (t) => { setTab = t; render(); },
  tune: (cid) => { consoleTab = 'tuning'; go('console', cid); },
  showFix: (cid) => fixModal(byId(C, cid), health(cid).issues),
  scanConsole: async (cid) => { toast(`Scanning ${esc(byId(C, cid).name)}…`); await scanConsole(cid); renderSide(); render(); },
  addFolder: async (cid) => {
    const f = await window.ef.pickFolder({ title: `Folder with your ${byId(C, cid).name} games` }); if (!f) return;
    const conf = cc(cid); if (conf.folders.some(x => x.toLowerCase() === f.toLowerCase())) return toast('That folder is already added.');
    conf.folders.push(f); save(); toast(`Added ${esc(f)} — scanning…`); await scanConsole(cid); renderSide();
    if ($('#modal .steps')) wizard(wz.step); else render();
  },
  // Standard layout: <fast or storage root>\<console dir>, created if missing. No arg = every enabled console.
  useRomDirs: async (cid) => {
    const root = set().romRoot; if (!root) return toast('Set a ROM library root in Settings → Library first.', 'bad');
    const ids = (cid ? [cid] : enabledConsoles().map(c => c.id));
    const offline = [];
    for (const r of new Set(ids.map(homeDir).map(rootOf))) if (!await window.ef.exists(r)) offline.push(r);
    if (offline.length) return toast(`Drive ${esc(offline.join(', '))} isn’t connected.`, 'bad');
    await window.ef.mkdirs(ids.map(homeDir));
    let added = 0; for (const id of ids) if (!hasFolder(id, homeDir(id))) { cc(id).folders.push(homeDir(id)); added++; }
    save(); toast(cid ? `Using ${esc(homeDir(cid))}` : `Added ${added} console folder${added === 1 ? '' : 's'}.`, 'ok');
    for (const id of ids) await scanConsole(id, true);
    renderSide(); if ($('#modal .steps')) wizard(wz.step); else render();
  },
  libSettings: () => { setTab = 'library'; go('settings'); },
  moveGame: async (id) => {
    const g = game(id), p = g && (placement(g) || storageMove(g)); if (!p || moving) return;
    moving = id; render(); toast(`Moving ${esc(g.title)} to ${esc(rootOf(p.to))}… big games take a few minutes.`);
    const r = await window.ef.moveGame({ file: g.path, destDir: p.to, libFolders: cc(g.console).folders });
    moving = null;
    if (r.ok) {
      g.path = r.path; const conf = cc(g.console);
      if (!hasFolder(g.console, p.to)) conf.folders.push(p.to);
      save(); toast(`Moved ${esc(g.title)} to ${esc(rootOf(p.to))}.`, 'ok');
    } else toast(`${esc(g.title)} wasn’t moved: ${esc(r.error)}`, 'bad');
    render(); return r.ok;
  },
  shareToggle: async () => { const s = set(); s.shareOn = !s.shareOn; if (s.shareOn && !s.shareCode) s.shareCode = await window.ef.share.newCode(); save(); await syncShare(); render(); },
  shareNewCode: async () => { set().shareCode = await window.ef.share.newCode(); save(); await syncShare(); render(); },
  shareConnect: () => shareConnect(),
  shareConsole: (id) => { share.console = id; render(); },
  shareClear: () => { share.picked.clear(); render(); },
  shareDest: async () => { const f = await window.ef.pickFolder({ title: 'Folder to install shared games into' }); if (!f) return; set().shareDest = f; save(); render(); },
  shareCancel: () => { share.stopping = true; render(); window.ef.share.cancel(share.current); },
  shareTools: async () => {
    const s = set(), list = toolsPicked(); let ok = 0; share.failed = {};
    if (!list.length) return;
    const programs = await window.ef.share.toolsBase();
    for (const t of list) {
      if (share.stopping) break;
      share.current = t.id; share.pct = 0; render();
      const r = await window.ef.share.install({ host: s.shareHost, code: (s.shareRemoteCode || '').trim().toUpperCase(), id: t.id, destDir: programs, minFreeGB: s.inboxMinFree, tool: true });
      if (!r.ok) { if (!r.cancelled) share.failed[t.id] = r.error; continue; }
      ok++; share.toolPicked.delete(t.id);
      if (t.kind === 'emulator') { S.emulators[t.emu] = { ...(S.emulators[t.emu] || {}), path: r.path }; for (const cid of t.consoles) cc(cid).emulator = t.emu; }
      save();
    }
    share.current = null; share.stopping = false;
    await checkAllBios();
    toast(`${ok} of ${list.length} copied. Check each console’s setup page before playing.`, ok === list.length ? 'ok' : 'bad');
    renderSide(); render();
  },
  shareInstall: async () => {
    const s = set(), base = shareBase(), touched = new Set(); let ok = 0; const games = sharePicked(); share.failed = {};
    if (!base || !games.length) return;
    for (const g of games) {
      if (share.stopping) break;
      share.current = g.id; share.pct = 0; render();
      const dest = `${base}\\${byId(C, g.console).dir}`;
      const r = await window.ef.share.install({ host: s.shareHost, code: (s.shareRemoteCode || '').trim().toUpperCase(), id: g.id, destDir: dest, minFreeGB: s.inboxMinFree });
      if (r.ok) { ok++; share.picked.delete(g.id); touched.add(g.console); if (!hasFolder(g.console, dest)) cc(g.console).folders.push(dest); save(); }
      else if (!r.cancelled) share.failed[g.id] = r.error;
    }
    share.current = null; share.stopping = false; render();
    for (const cid of touched) await scanConsole(cid, true);
    if (touched.size) { fetchMissingArt().then(fetchMissingShots); checkCompat(); }
    toast(`${ok} of ${games.length} game${games.length === 1 ? '' : 's'} installed.`, ok === games.length ? 'ok' : 'bad');
    renderSide(); render();
  },
  spareToggle: () => { spareOpen = !spareOpen; render(); },
  optimizeStorage: async () => {
    const ids = S.games.filter(g => placement(g) || (onSpareSSD(g) && storageMove(g))).map(g => g.id); let ok = 0;
    for (const id of ids) if (await ACT.moveGame(id)) ok++;
    toast(`Storage optimized: ${ok} of ${ids.length} game${ids.length === 1 ? '' : 's'} moved.`, ok === ids.length ? 'ok' : 'bad');
  },
  rmFolder: async (arg) => { const [cid, i] = arg.split('|'); const conf = cc(cid); const f = conf.folders[+i];
    if (!await confirmBox('Remove this folder?', `Games found in <span class="mono">${esc(f)}</span> are removed from the library. Files stay on disk.`, 'Remove folder', true)) return;
    conf.folders.splice(+i, 1); S.games = S.games.filter(g => !(g.console === cid && g.path.toLowerCase().startsWith(f.toLowerCase()))); save(); render(); renderSide(); },
  openPath: (p) => window.ef.openPath(p), reveal: (p) => window.ef.reveal(p), url: (u) => window.ef.openUrl(u),
  bkAll: () => backupSaves(null, 'manual'),
  bkOne: (id) => backupSaves([id], 'manual'),
  bkOpen: () => window.ef.openPath(trimRoot(set().backupRoot)),
  bkFolder: async () => { const f = await window.ef.pickFolder({ title: 'Folder for your save backups (another drive is safest)' }); if (!f) return; set().backupRoot = f; save(); bk.status = null; render(); },
  bkRestore: (id) => {
    const x = bk.status && bk.status[id]; if (!x) return; const e = emuFor(id);
    modal(`<h3>Restore ${esc(e.name)} saves</h3><p class="muted">Pick a backup. Your current saves are backed up first, so you can undo this.</p>
      <div style="max-height:360px;overflow:auto">${x.snapshots.map(sn => `<div class="folder"><span class="p"><b>${esc(new Date(sn.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }))}</b> <span class="small muted">${esc(sn.reason || '')} · ${sn.files} file${sn.files === 1 ? '' : 's'} · ${fmtSize(sn.bytes)}</span></span>
        <button class="btn sm primary" data-act="bkDoRestore" data-arg="${id}|${esc(sn.stamp)}">Restore</button></div>`).join('')}</div>
      <div class="foot"><button class="btn ghost" data-act="close">Close</button></div>`, { wide: true });
  },
  bkDoRestore: async (arg) => {
    const [id, snap] = arg.split('|'), e = emuFor(id);
    if (!await confirmBox(`Restore ${e.name} saves from ${snap}?`, `Saves in that backup replace the same files in ${esc(e.name)}. Your current saves are backed up first. Close ${esc(e.name)} before you continue.`, 'Restore')) return;
    const r = await window.ef.backup.restore({ id, exe: emuPath(id), dest: trimRoot(set().backupRoot), snap, keep: set().backupKeep });
    if (r.ok) toast(`Restored ${r.files} file${r.files === 1 ? '' : 's'}. Your saves from before are in the backup “${esc(r.safety)}”.`, 'ok'); else toast(esc(r.error), 'bad');
    await loadBackupStatus();
  },
  openSeries: (key) => { closeModal(); lib.series = key; lib.console = 'all'; lib.fav = false; keepSeries = true; go('library'); },
  clearSeries: () => { lib.series = ''; render(); },
  ibAdd: (f) => importAll([f]),
  ibAddAll: () => importAll(inboxReady().map(i => i.file)),
  ibRefresh: async () => { inbox.dirty = true; await refreshInbox(); toast('Import folder refreshed.'); },
  ibRecycle: async (f) => { const it = inbox.items.find(i => i.file === f); const r = await window.ef.inbox.recycle(f);
    if (r.ok) { inbox.cleaned.unshift({ name: it ? it.name : f, why: it ? it.why : '', at: Date.now() }); inbox.items = inbox.items.filter(i => i.file !== f); toast('Moved to the Recycle Bin.', 'ok'); } else { if (it) it.error = r.error; toast(esc(r.error), 'bad'); }
    renderSide(); render(); },
  ibFolder: async () => { const f = await window.ef.pickFolder({ title: 'Folder that holds your game files' }); if (!f) return; set().inboxFolder = f; save(); window.ef.inbox.watch(f); await refreshInbox(); },
  pickEmu: async (id) => { const e = emuFor(id); const f = await window.ef.pickFile({ title: `Locate ${e.name} (${e.exe[0]})`, filters: [{ name: 'Programs', extensions: ['exe'] }] }); if (!f) return;
    const name = f.split('\\').pop().toLowerCase();
    if (!e.exe.map(x => x.toLowerCase()).includes(name) && !await confirmBox('Is this the right program?', `Expected <span class="mono">${esc(e.exe.join(' or '))}</span> but you picked <span class="mono">${esc(name)}</span>. Use it anyway?`, 'Use it')) return;
    S.emulators[id] = { ...(S.emulators[id] || {}), path: f }; save(); toast(`${esc(e.name)} linked.`, 'ok'); await checkAllBios(); renderSide(); if ($('#modal .steps')) wizard(wz.step); else render(); },
  appUpCheck: async () => { toast('Checking for EchoForge updates…'); const r = await checkAppUpdate(false); toast(!r.ok ? esc(r.error) : r.update ? `EchoForge <b>${esc(r.latest.version)}</b> is ready.` : 'EchoForge is up to date.', r.ok ? 'ok' : 'bad'); },
  appUpdate: async () => {
    const u = appUp.info; if (appUp.busy || !u || !u.ok || !u.update) return;
    if (running) return toast('Close your game first.', 'bad');
    if (!await confirmBox(`Update to EchoForge ${u.latest.version}?`, 'EchoForge downloads the installer from GitHub, checks it, then closes and opens the installer. Your library, settings and saves are kept.', 'Update')) return;
    appUp.busy = true; appUp.pct = 0; render();
    const r = await window.ef.appUpdates.install();
    if (!r.ok) { appUp.busy = false; toast(esc(r.error), 'bad'); render(); }
    else toast(`Opening the EchoForge ${esc(r.version)} installer…`, 'ok');
  },
  appUpLater: () => { if (appUp.info && appUp.info.latest) { set().appUpdateLater = appUp.info.latest.version; save(); render(); } },
  emuUpCheck: async () => { toast('Checking for emulator updates…'); await checkEmuUpdates(false); toast('Emulator updates checked.', 'ok'); },
  emuUpdate: async (id) => {
    if (emuUp.busy) return; const name = emuFor(id).name;
    emuUp.busy = id; emuUp.pct = 0; emuUp.phase = 'Starting'; render();
    const r = await window.ef.emuUpdates.update({ id, exe: emuPath(id), channel: emuChannel(id) }); emuUp.busy = null;
    if (!r.ok) toast(esc(r.error), 'bad');
    else toast(r.already ? `${esc(name)} is already up to date.` : `${esc(name)} updated to <b>${esc(r.label)}</b>. If it gives you trouble, use Roll back on this page.`, 'ok');
    emuUp.info[id] = await window.ef.emuUpdates.check({ id, exe: emuPath(id), channel: emuChannel(id) }); render();
  },
  emuRollback: async (id) => {
    const u = emuUp.info[id]; if (emuUp.busy || !u || !u.rollback) return; const name = emuFor(id).name;
    if (!await confirmBox(`Roll back ${name}?`, `This puts ${esc(u.rollback.label)} back. Settings and saves in its folder stay as they are.`, 'Roll back')) return;
    emuUp.busy = id; emuUp.phase = 'Rolling back'; emuUp.pct = 0; render();
    const r = await window.ef.emuUpdates.rollback({ id, exe: emuPath(id) }); emuUp.busy = null;
    toast(r.ok ? `${esc(name)} is back on <b>${esc(r.label)}</b>.` : esc(r.error), r.ok ? 'ok' : 'bad');
    emuUp.info[id] = await window.ef.emuUpdates.check({ id, exe: emuPath(id), channel: emuChannel(id) }); render();
  },
  runEmu: async (id) => { const r = await window.ef.launch({ exe: emuPath(id), args: '', rom: '', gameId: null, onLaunch: 'nothing', priority: 'normal' }); if (!r.ok) toast(esc(r.error), 'bad'); },
  resetArgs: (id) => { delete S.emulators[id].args; save(); render(); },
  detect: async () => { toast('Searching your drives for emulators…'); const found = await window.ef.detect(E.map(e => ({ id: e.id, exe: e.exe, hint: e.hint })));
    let n = 0; for (const [id, p] of Object.entries(found)) { if (!emuPath(id)) { S.emulators[id] = { ...(S.emulators[id] || {}), path: p }; n++; } }
    save(); toast(n ? `Linked ${n} emulator${n === 1 ? '' : 's'}: ${Object.keys(found).map(id => emuFor(id).name).join(', ')}.` : 'No new emulators found. Use Locate to pick them by hand.', n ? 'ok' : '');
    await checkAllBios(); renderSide(); if ($('#modal .steps')) wizard(wz.step); else render(); },
  pickFwRoot: async () => { const f = await window.ef.pickFolder({ title: 'Base folder for firmware & BIOS files' }); if (!f) return; set().firmwareRoot = f; save(); await checkAllBios(); renderSide(); if ($('#modal .steps')) wizard(wz.step); else render(); },
  makeFwDirs: async () => { const ids = C.filter(c => c.bios.length).map(c => c.id); await window.ef.mkdirs(ids.map(id => `${set().firmwareRoot}\\${id}`)); toast(`Created ${ids.length} console folders. Drop each console’s files in its folder.`, 'ok'); window.ef.openPath(set().firmwareRoot); },
  pickBios: async (cid) => { const f = await window.ef.pickFolder({ title: `Firmware folder for ${byId(C, cid).name}` }); if (!f) return; cc(cid).biosDir = f; save(); await checkBios(cid); renderSide(); render(); },
  recheck: async (cid) => { await checkBios(cid); renderSide(); render(); toast('Checked.', 'ok'); },
  theme: (n) => { set().theme = n; save(); applyLook(); render(); },
  wizard: () => wizard(0), _wizard: () => wizard(0),
  wzGo: (s) => wizard(+s), wzSkip: () => { S.wizardDone = true; save(); closeModal(); render(); if (!S.tourDone) setTimeout(startTour, 400); },
  wzConsoles: (s) => { $$('[data-wzc]').forEach(cb => { cc(cb.dataset.wzc).enabled = cb.checked; }); save(); renderSide(); wizard(+s); },
  wzFinish: async () => { S.wizardDone = true; save(); closeModal(); go('home'); if (!S.tourDone) setTimeout(startTour, 400); await scanAll(false); },
  tour: () => startTour(), tourNext: () => { if (tour.step >= window.EF_TOUR.length - 1) return endTour(); tour.step++; showTour(); },
  tourBack: () => { tour.step = Math.max(0, tour.step - 1); showTour(); }, tourEnd: () => endTour(),
  guideJump: (id) => { const el = $(`#guide-${id}`); if (el) { el.hidden = false; el.scrollIntoView({ block: 'start', behavior: set().motion === 'full' ? 'smooth' : 'auto' }); } },
  guideCardClose: () => { S.guideCard = false; save(); render(); },
  _rescan: () => scanAll(false),
  _dlBack: async () => {
    const s = set(), prev = s.dlPrevFolder; if (!prev) return;
    const r = await window.ef.downloads.set(prev);
    if (!r.ok) return toast('Windows didn’t accept that folder.', 'bad');
    s.dlAutoSwitch = false; s.dlPrevFolder = ''; dlFolder = r.folder; save();
    window.ef.inbox.watch(inboxFolders()); refreshInbox(); render();
    toast(`Downloads is back in <b>${esc(prev)}</b>. Restart your browser so it picks up the change.`, 'ok');
  },
  _export: async () => { const p = await window.ef.exportData(S); if (p) toast(`Backup saved to ${esc(p)}`, 'ok'); },
  _import: async () => { try { const d = await window.ef.importData(); if (!d) return; if (!await confirmBox('Restore this backup?', 'Your current library and settings are replaced.', 'Restore')) return; S = hydrate(d); save(); applyLook(); await checkAllBios(); await checkDrives(); renderSide(); render(); toast('Backup restored.', 'ok'); } catch { toast('That file isn’t an EchoForge backup.', 'bad'); } },
  _clearLib: async () => { if (await confirmBox('Clear the whole library?', 'All games, play time and favorites are removed from EchoForge. Files on disk are untouched.', 'Clear library', true)) { S.games = []; save(); renderSide(); render(); } },
  _resetAll: async () => { if (await confirmBox('Reset EchoForge?', 'Settings, emulator links, folders and library go back to a first launch. Files on disk are untouched.', 'Reset everything', true)) { S = freshState(); await window.ef.save(S); window.ef.relaunch(); } },
  openData: async () => { const p = await window.ef.paths(); window.ef.openPath(p.userData); }
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el) return;
  const fn = ACT[el.dataset.act]; if (!fn) return;
  if (el.dataset.act !== 'scrim') { ev.stopPropagation(); blip('ok'); }
  fn(el.dataset.arg, el, ev);
});
document.addEventListener('dblclick', (ev) => { const el = ev.target.closest('[data-play]'); if (el) { closeModal(); play(el.dataset.play); } });
document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.dataset.emuchan) { // Tested / Latest / Keep this version, then look again with that choice
    const id = el.dataset.emuchan; S.emulators[id] = { ...(S.emulators[id] || {}), channel: el.value }; save();
    emuUp.info[id] = await window.ef.emuUpdates.check({ id, exe: emuPath(id), channel: el.value }); render(); return;
  }
  if (el.dataset.shtool) { if (el.checked) share.toolPicked.add(el.dataset.shtool); else share.toolPicked.delete(el.dataset.shtool); render(); return; }
  if (el.dataset.shpick) { if (el.checked) share.picked.add(el.dataset.shpick); else share.picked.delete(el.dataset.shpick); render(); return; }
  if (el.dataset.set) {
    const k = el.dataset.set; const v = el.type === 'checkbox' ? el.checked : el.dataset.num !== undefined ? +el.value : el.value;
    set()[k] = v; save(); applyLook();
    if (k === 'launchAtLogin') window.ef.setLoginItem(v);
    if (k === 'disableGpu') toast('Restart EchoForge to apply.');
    if (k === 'inboxFolder') { window.ef.inbox.watch(inboxFolders()); refreshInbox(); }
    // A new cover source was turned on: look again now for the games it covers, rather than waiting a week.
    if ((k === 'gameTdbArt' || k === 'xboxUnityArt') && v) { const cid = k === 'gameTdbArt' ? 'ps3' : 'x360'; for (const g of S.games) if (g.console === cid && !g.cover) g.artTried = 0; fetchMissingArt(); }
    if (['dlAutoSwitch', 'dlTarget', 'dlSwitchAtGB'].includes(k)) { set().dlWarned = ''; checkDownloadsDrive(); }
    if (['sort', 'hideOffline', 'showHidden', 'titles', 'compact'].includes(k) || route.view === 'settings') render();
  }
  if (el.dataset.cfg) {
    const [cid, key] = el.dataset.cfg.split('.'); cc(cid)[key] = el.type === 'checkbox' ? el.checked : el.value.trim(); save();
    if (key === 'enabled' && !el.checked) toast(`${esc(byId(C, cid).name)} hidden. Turn it back on in the setup assistant or here.`);
    renderSide(); render();
  }
  if (el.dataset.emuargs) { const id = el.dataset.emuargs; S.emulators[id] = { ...(S.emulators[id] || {}), args: el.value.trim() }; save(); toast('Launch options saved.', 'ok'); }
  if (el.dataset.manual) { const [cid, bid] = el.dataset.manual.split('.'); cc(cid).manual[bid] = el.checked; save(); renderSide(); render(); }
  if (el.dataset.gtitle) { const g = game(el.dataset.gtitle); g.title = el.value.trim() || g.title; g.renamed = true; save(); render(); }
  if (el.dataset.gemu !== undefined && el.dataset.gemu) { const g = game(el.dataset.gemu); g.emu = el.value || undefined; save(); }
  if (el.dataset.gargs) { const g = game(el.dataset.gargs); g.args = el.value.trim() || undefined; save(); }
  if (el.dataset.gseries) { const g = game(el.dataset.gseries), v = el.value.trim(); g.series = v || undefined; save(); renderSide(); render(); openGame(g.id); toast(v === '-' ? 'Kept out of collections.' : v ? `Moved to ${esc(v)}.` : 'Back to automatic.', 'ok'); }
});
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.id === 'guideQ') return filterGuide(el.value);
  if (el.type === 'range' && el.dataset.set) { set()[el.dataset.set] = +el.value; el.nextElementSibling && (el.nextElementSibling.textContent = el.value); applyLook(); save(); }
  if (el.dataset.sh) { if (el.dataset.sh === 'q') { share.q = el.value; const at = el.selectionStart; render(); const n = $('#shQ'); if (n) { n.focus(); n.setSelectionRange(at, at); } } else { set()[el.dataset.sh] = el.value; share.error = ''; save(); } }
  if (el.id === 'q') { lib.q = el.value; if (route.view !== 'library' && route.view !== 'console') { go('library'); setTimeout(() => { $('#q').focus(); }, 0); } else render(); }
});

// ---------------- routing ----------------
let keepSeries = false; // only "open collection" keeps the library filtered; the All Games button shows everything
function go(view, param = null) {
  if (view === 'library' && !keepSeries) lib.series = ''; keepSeries = false;
  if (view !== route.view || param !== route.param) { if (view === 'console' && route.param !== param && consoleTab !== 'tuning') consoleTab = 'games'; }
  route = { view, param }; S.lastView = view === 'console' ? `console:${param}` : view; save();
  renderSide(); render(); $('#main').scrollTop = 0;
}
function render() {
  const fn = V[route.view] || V.home; const q = document.activeElement && document.activeElement.id === 'q';
  const html = fn(route.param);
  if (html === lastMain) return; // nothing on screen changed: keep the page (and its animations) as it is
  lastMain = html; $('#main').innerHTML = html;
  hydrateImages($('#main'));
  const hero = $('#heroArt'); if (hero) { const g = S.games.filter(x => x.lastPlayed).sort((a, b) => b.lastPlayed - a.lastPlayed)[0]; const src = backdropOf(g); if (src) window.ef.readImage(src).then(d => { if (d) hero.style.backgroundImage = `url(${d})`; }); }
  const gb = $('#gpBack'), pg = route.view === 'game' && game(route.param);
  if (gb && pg) { const src = backdropOf(pg); gb.classList.toggle('soft', !(pg.bg || pg.snap || pg.titleShot)); // a cover is blurred; real art stays sharp
    if (src) cachedImage(src).then(d => { if (d) { gb.style.backgroundImage = `url("${d}")`; gb.classList.add('on'); } }); showBgArt(pg.id); }
  if (q) $('#q').focus();
}

// ---------------- keyboard & controller ----------------
document.addEventListener('keydown', (ev) => {
  if (ev.ctrlKey && ev.key.toLowerCase() === 'f') { ev.preventDefault(); $('#q').focus(); $('#q').select(); }
  else if (ev.key === 'F1') { ev.preventDefault(); if (tour) endTour(); closeModal(); go('guide'); }
  else if (ev.key === 'Escape' && tour) endTour();
  else if (ev.key === 'Escape') { if ($('#modal').innerHTML) closeModal(); else if (document.activeElement.id === 'q') { $('#q').value = ''; lib.q = ''; render(); $('#q').blur(); } }
  else if (ev.key === 'F10') { ev.preventDefault(); setBigPicture(!bigpic); }
  else if (ev.key === 'F11') { ev.preventDefault(); window.ef.win.fullscreen(!document.fullscreenElement && !window.__fs); window.__fs = !window.__fs; }
  else if (ev.key === 'F5') { ev.preventDefault(); scanAll(false); }
  else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.key) && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && (bigpic || document.activeElement.closest('.games,.shelf,.ctiles,.colls'))) {
    ev.preventDefault(); moveFocus(ev.key.slice(5).toLowerCase());
  }
});
function focusables() {
  const root = $('#modal .modal') || document;
  return $$('button, input, select, [data-nav]', root).filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.disabled && el.offsetParent !== null; });
}
function moveFocus(dir) {
  const list = focusables(); const cur = document.activeElement && list.includes(document.activeElement) ? document.activeElement : null;
  if (!cur) { const first = $('.game', $('#modal .modal') || $('#main')) || list[0]; first && first.focus(); return; }
  const a = cur.getBoundingClientRect(); const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bestScore = Infinity;
  for (const el of list) {
    if (el === cur) continue; const b = el.getBoundingClientRect(); const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const dx = bx - ax, dy = by - ay;
    const ok = { left: dx < -4, right: dx > 4, up: dy < -4, down: dy > 4 }[dir]; if (!ok) continue;
    const main = dir === 'left' || dir === 'right' ? Math.abs(dx) : Math.abs(dy); const cross = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = main + cross * 2.5; if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) { best.focus({ preventScroll: true }); best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: set().motion === 'full' ? 'smooth' : 'auto' }); blip('move'); }
}
const pad = { prev: {}, next: 0 };
function padLoop() {
  requestAnimationFrame(padLoop);
  if (!set() || !set().gamepad || (running && set().gameMode) || !document.hasFocus()) return;
  const p = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(Boolean); if (!p) return;
  const b = i => !!(p.buttons[i] && p.buttons[i].pressed); const dz = set().deadzone;
  const now = performance.now();
  const dirs = { up: b(12) || p.axes[1] < -dz, down: b(13) || p.axes[1] > dz, left: b(14) || p.axes[0] < -dz, right: b(15) || p.axes[0] > dz };
  const held = Object.keys(dirs).find(k => dirs[k]);
  if (held) { if (pad.held !== held || now > pad.next) { moveFocus(held); pad.next = now + (pad.held === held ? 110 : 320); pad.held = held; } } else pad.held = null;
  const edge = i => { const v = b(i), was = pad.prev[i]; pad.prev[i] = v; return v && !was; };
  if (edge(0)) { const el = document.activeElement; if (el && el !== document.body) { el.click(); if (set().rumble && p.vibrationActuator) p.vibrationActuator.playEffect('dual-rumble', { duration: 40, strongMagnitude: .2, weakMagnitude: .3 }).catch(() => {}); } }
  if (edge(1)) { blip('back'); if ($('#modal').innerHTML) closeModal(); else if (route.view === 'game') leaveGame(); else go('home'); }
  if (edge(3)) { const el = document.activeElement; const id = el && el.dataset && el.dataset.play; if (id) { const g = game(id); g.fav = !g.fav; save(); toast(g.fav ? `★ ${esc(g.title)} added to favorites` : `${esc(g.title)} removed from favorites`); render(); } }
  if (edge(2)) { const el = document.activeElement; const id = el && el.dataset && el.dataset.play; if (id) play(id); }
  if (edge(9)) go('settings');
  if (edge(8)) setBigPicture(!bigpic);
  const lb = edge(4), rb = edge(5);
  if (lb || rb) {
    const order = ['home', 'library', 'collections', 'inbox', 'shared', ...enabledConsoles().map(c => 'console:' + c.id), 'emulators', 'firmware', 'backups', 'settings', 'guide'];
    const cur = route.view === 'console' ? 'console:' + route.param : route.view; let i = order.indexOf(cur); i = (i + (rb ? 1 : -1) + order.length) % order.length;
    const [v, prm] = order[i].split(':'); go(v, prm || null);
  }
}
window.addEventListener('gamepadconnected', (e) => { if (set() && set().gamepad) toast(`Controller connected: ${esc(e.gamepad.id.replace(/\(.*\)/, '').trim())}`, 'ok'); });

// ---------------- boot ----------------
(async function boot() {
  const st = (p, m) => window.ef.splashStatus({ p, m });
  st(15, 'Loading your library');
  S = hydrate(await window.ef.load());
  applyLook();
  appVersion = await window.ef.version();
  window.ef.win.onState(() => {});
  st(35, 'Probing your hardware');
  try { hw = await window.ef.probe({ fast: true }); } catch {}
  st(60, 'Checking firmware');
  await checkAllBios();
  st(78, 'Finding your drives');
  await checkDrives();
  share.info = await window.ef.share.info(); syncShare();
  const r = await window.ef.runningGame(); if (r) running = { gid: r.gameId, started: r.started };
  st(92, 'Building console sections');
  const sv = set().startView === 'last' && S.lastView ? S.lastView : set().startView === 'last' ? 'home' : set().startView;
  const [v, p] = sv.split(':'); route = { view: V[v] ? v : 'home', param: p || null };
  renderSide(); render();
  if (set().bigpicStart) setBigPicture(true);
  window.ef.ready();
  requestAnimationFrame(padLoop);
  window.ef.probe().then(full => { hw = full; if (['pc', 'console'].includes(route.view) || $('#modal .steps')) { if ($('#modal .steps')) wizard(wz.step); else render(); } }).catch(() => {});
  if (!S.wizardDone) setTimeout(() => wizard(0), 2900);
  else if (set().autoScan) setTimeout(() => scanAll(true), 3200);
  setTimeout(checkCompat, set().autoScan ? 9000 : 2000); // after the startup scan has picked up new games
  setTimeout(async () => { while (scanning || fetchingArt) await new Promise(r => setTimeout(r, 2000)); fetchMissingShots(); }, set().autoScan ? 12000 : 3000);
  // Backups default to the storage drive (a different drive from the emulators); the folder can be changed on the page.
  if (!trimRoot(set().backupRoot) && rootOf(set().storageRoot)) { set().backupRoot = rootOf(set().storageRoot) + 'EchoForge Backups'; save(); }
  if (set().backupWeekly && Date.now() - (set().backupLast || 0) > 7 * 864e5) setTimeout(() => { if (!running) backupSaves(null, 'weekly', true); }, 25000);
  homePath = (await window.ef.paths()).home;
  dlFolder = (await window.ef.downloads.status()).folder || '';
  window.ef.inbox.watch(inboxFolders()); setTimeout(() => refreshInbox(false), 1500);
  if (set().appUpdateCheck && Date.now() - (set().appUpdateLast || 0) > 864e5) setTimeout(() => checkAppUpdate(true), 20000); // once a day
  if (set().emuUpdateCheck && Date.now() - (set().emuUpdateLast || 0) > 864e5) setTimeout(() => checkEmuUpdates(true), 30000); // once a day
  setTimeout(checkDownloadsDrive, 4000); setInterval(checkDownloadsDrive, 10 * 60 * 1000); // free space is checked every 10 minutes
})();
