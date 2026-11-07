'use strict';
// "Will it run?" badges: PS3 games are looked up on RPCS3's compatibility list, Xbox 360 games on Xenia Canary's
// (GitHub issues titled "<title id> - <name>" with a state-* label). Only the disc's title ID is sent.
// Results are cached for a week; Xenia lookups go through GitHub's search API, which allows 10 a minute without a login.
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

const DAY = 864e5, TTL = 7 * DAY, TTL_MISS = 3 * DAY, GH_GAP = 6500;
const UA = { 'User-Agent': 'EchoForge', Accept: 'application/vnd.github+json' };

const RPCS3 = { Playable: ['ok', 'Playable'], Ingame: ['warn', 'Runs with issues'], Intro: ['bad', 'Won’t play yet'], Loadable: ['bad', 'Won’t play yet'], Nothing: ['bad', 'Won’t start'] };
const XENIA = [ // most hopeful label wins when an issue carries several
  [/^state-playable$/, 'ok', 'Playable'], [/^state-gameplay$/, 'warn', 'Runs with issues'],
  [/^state-(menus|title|intro|load)$/, 'bad', 'Won’t play yet'], [/^state-(nothing|hang|crash)/, 'bad', 'Won’t start']
];
const XENIA_TIPS = { requires_hdd_install: 'Install the game to Xenia’s HDD first', requires_mount_cache: 'Turn on mount_cache in Xenia’s config', 'no-disc-install': 'Needs its disc install data', 'custom-patch-required': 'Needs a community patch', 'vsync-off-speedup': 'Runs better with vsync off' };
const SKIP = new Set(['issue-duplicate', 'issue-invalid', 'issue-superseded']);

async function rpcs3(id) {
  const r = await fetch('https://rpcs3.net/compatibility?api=v1&g=' + encodeURIComponent(id), { headers: UA });
  if (!r.ok) throw new Error('RPCS3 list unavailable');
  const j = await r.json(), e = j.results && j.results[id];
  if (!e) return { status: 'unknown', label: 'Not tested yet', source: 'RPCS3' };
  const [status, label] = RPCS3[e.status] || ['unknown', e.status];
  return { status, label, source: 'RPCS3', date: e.date, url: e.thread ? `https://forums.rpcs3.net/thread-${e.thread}.html` : 'https://rpcs3.net/compatibility?g=' + id };
}

let ghNext = 0;
async function xenia(id) {
  const wait = ghNext - Date.now(); if (wait > 0) await new Promise(r => setTimeout(r, wait));
  ghNext = Date.now() + GH_GAP;
  const q = encodeURIComponent(`repo:xenia-canary/game-compatibility in:title ${id}`);
  const r = await fetch(`https://api.github.com/search/issues?q=${q}&per_page=20`, { headers: UA });
  if (r.status === 403 || r.status === 429) { ghNext = Date.now() + 65000; throw Object.assign(new Error('rate limited'), { retry: true }); }
  if (!r.ok) throw new Error('Xenia list unavailable');
  const issues = ((await r.json()).items || []).filter(i => i.title.toUpperCase().startsWith(id) && !(i.labels || []).some(l => SKIP.has(l.name)));
  issues.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  for (const i of issues) {
    const names = (i.labels || []).map(l => l.name);
    const hit = XENIA.find(([re]) => names.some(n => re.test(n)));
    if (!hit) continue;
    const tips = names.map(n => XENIA_TIPS[n]).filter(Boolean);
    return { status: hit[1], label: hit[2], source: 'Xenia Canary', date: (i.updated_at || '').slice(0, 10), url: i.html_url, tips };
  }
  return { status: 'unknown', label: 'Not tested yet', source: 'Xenia Canary', url: issues[0] && issues[0].html_url };
}

function register({ ipcMain, app, getWin, x360TitleId }) {
  const FILE = () => path.join(app.getPath('userData'), 'compat-cache.json');
  let cache = null;
  const load = async () => { if (!cache) { try { cache = JSON.parse(await fsp.readFile(FILE(), 'utf8')); } catch { cache = {}; } } return cache; };
  const persist = () => fsp.writeFile(FILE(), JSON.stringify(cache)).catch(() => {});
  const send = v => { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send('compat:result', v); };
  const fresh = c => c && Date.now() - c.at < (c.result.status === 'unknown' ? TTL_MISS : TTL);

  const queue = new Map(); let working = false;
  async function work() {
    if (working) return; working = true;
    try {
      while (queue.size) {
        const [id, g] = queue.entries().next().value; queue.delete(id);
        try {
          const tid = g.console === 'x360' ? (g.titleId || await x360TitleId(g.file).catch(() => null)) : g.titleId;
          if (!tid) { send({ id, result: { status: 'unknown', label: 'No title ID on the disc', source: '' } }); continue; }
          const key = `${g.console}:${tid}`;
          if (!fresh(cache[key])) { cache[key] = { at: Date.now(), result: await (g.console === 'ps3' ? rpcs3(tid) : xenia(tid)) }; await persist(); }
          send({ id, titleId: tid, result: cache[key].result });
        } catch (e) { if (e.retry) queue.set(id, g); } // offline: try again next time EchoForge starts
      }
    } finally { working = false; }
  }
  // games: [{ id, console: 'ps3'|'x360', titleId, file }]. Answers from the cache right away; the rest arrive as compat:result.
  ipcMain.handle('compat:check', async (_e, games) => {
    await load(); const now = {};
    for (const g of games) {
      const c = g.titleId && cache[`${g.console}:${g.titleId}`];
      if (fresh(c)) now[g.id] = c.result; else queue.set(g.id, g);
    }
    work();
    return { now, pending: queue.size };
  });
}

module.exports = { register };
