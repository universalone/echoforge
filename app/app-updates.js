'use strict';
// EchoForge's own updates: checks the project's GitHub Releases for a newer installer, downloads it, checks it against
// the SHA-256 GitHub publishes, then starts it and closes EchoForge so the installer can replace the program files.
// Library and settings live in the user's profile, so they're kept. Nothing installs until the user presses Update.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const API = process.env.EF_GH_API || 'https://api.github.com'; // EF_GH_API: test feed (dev aid)
const INSTALLER = /^EchoForge-Setup-(\d+\.\d+\.\d+)\.exe$/i;

// "0.1.10" is newer than "0.1.9": compare each number, not the text.
function cmpVersion(a, b) {
  const pa = String(a).replace(/^v/i, '').split('.').map(Number), pb = String(b).replace(/^v/i, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
}

// The newest published release with an installer that has a checksum. Drafts and pre-releases are skipped.
async function checkApp(current, repo) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) return { ok: false, error: 'No update source is set for this build.' };
  try {
    const res = await fetch(`${API}/repos/${repo}/releases?per_page=10`, { headers: { 'User-Agent': 'EchoForge', Accept: 'application/vnd.github+json' } });
    if (res.status === 403 || res.status === 429) return { ok: false, error: 'GitHub is limiting requests right now. Try again in an hour.' };
    if (!res.ok) return { ok: false, error: `GitHub answered ${res.status}.` };
    const list = await res.json(); if (!Array.isArray(list)) return { ok: false, error: 'GitHub sent an answer EchoForge didn’t expect.' };
    let best = null;
    for (const r of list) {
      if (r.draft || r.prerelease) continue;
      const a = (r.assets || []).find(x => INSTALLER.test(x.name));
      if (!a || !/^sha256:[0-9a-f]{64}$/i.test(a.digest || '')) continue;
      const version = a.name.match(INSTALLER)[1];
      if (!best || cmpVersion(version, best.version) > 0) best = { version, page: r.html_url, url: a.browser_download_url, name: a.name, size: a.size, sha256: a.digest.slice(7).toLowerCase(), notes: String(r.body || '').slice(0, 2000) };
    }
    return { ok: true, current, latest: best, update: !!best && cmpVersion(best.version, current) > 0 };
  } catch (e) { return { ok: false, error: `Couldn’t reach GitHub (${e.message}).` }; }
}

// Downloads the installer and checks it; returns its path. A mismatch is deleted and refused.
async function download(rel, progress = () => {}, dir = path.join(os.tmpdir(), 'echoforge-update')) {
  if (!INSTALLER.test(rel.name || '')) throw new Error('That isn’t an EchoForge installer.');
  await fsp.mkdir(dir, { recursive: true });
  const file = path.join(dir, rel.name);
  const res = await fetch(rel.url, { headers: { 'User-Agent': 'EchoForge' } });
  if (!res.ok || !res.body) throw new Error(`The download failed (${res.status}).`);
  const h = crypto.createHash('sha256'), out = fs.createWriteStream(file); let got = 0;
  for await (const chunk of res.body) {
    h.update(chunk); got += chunk.length; progress(Math.min(99, got / (rel.size || got) * 100));
    if (!out.write(chunk)) await new Promise(r => out.once('drain', r));
  }
  await new Promise((ok, bad) => out.end(err => (err ? bad(err) : ok())));
  if (h.digest('hex') !== rel.sha256) { await fsp.rm(file, { force: true }); throw new Error('The download doesn’t match the checksum GitHub published, so it was deleted.'); }
  progress(100);
  return file;
}

function register({ ipcMain, app, getWin, isPlaying }) {
  const repo = (() => { try { return require('../package.json').updateRepo; } catch { return ''; } })();
  const send = (ch, v) => { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send(ch, v); };
  let last = null;
  ipcMain.handle('appup:check', async () => (last = await checkApp(app.getVersion(), repo)));
  ipcMain.handle('appup:install', async () => {
    if (isPlaying()) return { ok: false, error: 'Close your game first.' };
    if (!last || !last.update) last = await checkApp(app.getVersion(), repo);
    if (!last.ok) return last;
    if (!last.update) return { ok: false, error: 'EchoForge is already up to date.' };
    try {
      const file = await download(last.latest, pct => send('appup:progress', { pct: Math.round(pct) }));
      spawn(file, [], { detached: true, stdio: 'ignore' }).unref(); // the installer asks before replacing anything
      setTimeout(() => app.quit(), 1500);
      return { ok: true, version: last.latest.version };
    } catch (e) { return { ok: false, error: e.message }; }
  });
}

module.exports = { register, checkApp, download, cmpVersion };
