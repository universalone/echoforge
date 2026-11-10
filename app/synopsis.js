// Game synopses from Wikipedia, plus year, genre, developer and publisher from Wikidata.
// Only the game's name and the word "video game" are sent. Text is CC BY-SA, so the game page links back to the article.
const UA = { 'User-Agent': 'EchoForge (https://github.com/universalone/echoforge)' };
const WP = 'https://en.wikipedia.org/w/api.php?', WD = 'https://www.wikidata.org/w/api.php?';

// Loose name key: no tags, Æ -> ae, "Title, The" -> "The Title", no articles, only letters and digits.
const key = s => String(s || '').toLowerCase().normalize('NFKD').replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/[̀-ͯ]/g, '')
  .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/^(.*?),\s*the\b/, 'the $1').replace(/&/g, ' and ').replace(/[™®]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').replace(/\b(the|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();
// Roman numerals and digits count as the same ("Dirt 3" = "DiRT III").
const ROMAN = { ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10' };
const words = s => key(s).split(' ').filter(Boolean).map(w => ROMAN[w] || w);

const nums = s => s.split(' ').filter(x => /^\d+$/.test(x)).join(' ');
const isGame = d => /\bgame\b/i.test(d || '') && !/franchise|series|character|media|company|developer|console|engine|soundtrack|film|novel/i.test(d || '');

// Picks the article for a game from Wikipedia's search results, or null. Games whose name doesn't match are refused,
// so a short name like "Black" never ends up with the wrong article.
function pick(pages, names, consoleName = '') {
  const wanted = names.map(words).filter(w => w.length);
  if (!wanted.length) return null;
  const scored = [];
  for (const p of [...(pages || [])].sort((a, b) => (a.index || 0) - (b.index || 0))) {
    if (!isGame(p.description) || /^list of/i.test(p.title) || !p.extract) continue;
    const t = words(p.title).join(' ');
    let score = 0;
    for (const w of wanted) {
      const n = w.join(' ');
      if (t === n) score = Math.max(score, 3);
      else if (w.length > 1 && (t.startsWith(n + ' ') || n.startsWith(t + ' ')) && Math.min(t.length, n.length) >= 6 && !/^\d/.test((t.length > n.length ? t.slice(n.length) : n.slice(t.length)).trim())) score = Math.max(score, 2); // subtitle added or missing, never a sequel number
      else if (w.length > 1 && w.every(x => t.split(' ').includes(x)) && nums(t) === nums(n)) score = Math.max(score, 1); // same words, same sequel number
    }
    if (score) scored.push([score, p]);
  }
  if (!scored.length) return null;
  // Same name (an original and its remake): the one that mentions the console, then the oldest.
  const top = Math.max(...scored.map(x => x[0])), con = String(consoleName || '').toLowerCase();
  const rank = p => [con && String(p.extract).toLowerCase().includes(con) ? 0 : 1, +((p.description || '').match(/\b(?:19|20)\d\d\b/) || [9999])[0]];
  return scored.filter(x => x[0] === top).map(x => x[1]).sort((a, b) => { const ra = rank(a), rb = rank(b); return ra[0] - rb[0] || ra[1] - rb[1]; })[0];
}

// First paragraph or two, cut at a sentence end. Pronunciation and empty brackets are removed.
function trim(text, max = 900) {
  const paras = String(text || '').replace(/\s*\(\s*[;,]?\s*\)/g, '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  let out = '';
  for (const p of paras) { if (out && (out + '\n\n' + p).length > max) break; out = out ? out + '\n\n' + p : p; }
  if (out.length > max) { const cut = out.slice(0, max), end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n')); out = end > 200 ? cut.slice(0, end + 1) : cut.trimEnd() + '…'; }
  return out;
}

// Year, genre, developer and publisher from the article's Wikidata entry.
const GENRE = /game|shooter|racing|racer|platform|simulat|puzzle|fighting|beat|role-playing|adventure|strategy|sports|horror|stealth|rhythm|party|survival|hack and slash|open world/i;
const firstYear = times => { const y = (times || []).map(t => +(String(t).match(/^[+-]?(\d{4})/) || [])[1]).filter(Boolean).sort(); return y[0] || null; };
async function facts(qid, get) {
  if (!/^Q\d+$/.test(qid || '')) return {};
  const e = (await get(WD + new URLSearchParams({ action: 'wbgetentities', ids: qid, props: 'claims', format: 'json' }))).entities?.[qid];
  const claims = e && e.claims || {};
  const ids = p => (claims[p] || []).map(c => c.mainsnak?.datavalue?.value?.id).filter(Boolean).slice(0, 3);
  const pick3 = { genre: ids('P136'), dev: ids('P178'), pub: ids('P123') };
  const year = firstYear((claims.P577 || []).map(c => c.mainsnak?.datavalue?.value?.time));
  const all = [...new Set(Object.values(pick3).flat())];
  let labels = {};
  if (all.length) {
    const l = await get(WD + new URLSearchParams({ action: 'wbgetentities', ids: all.join('|'), props: 'labels', languages: 'en', format: 'json' }));
    for (const [id, v] of Object.entries(l.entities || {})) if (v.labels?.en) labels[id] = v.labels.en.value;
  }
  const out = {}; if (year) out.year = year;
  for (const [k, v] of Object.entries(pick3)) { const names = v.map(id => labels[id]).filter(Boolean); if (names.length) out[k] = names; }
  if (out.genre) { const g = out.genre.filter(n => GENRE.test(n)); out.genre = (g.length ? g : out.genre).slice(0, 2); } // skip themes like "crossover fiction"
  return out;
}

async function getJson(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
const search = (q, get) => get(WP + new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: q, gsrlimit: '8', prop: 'description|extracts|pageprops',
  exintro: '1', explaintext: '1', exlimit: 'max', ppprop: 'wikibase_item', redirects: '1', format: 'json', formatversion: '2' })).then(j => j.query?.pages || []);

// names: the game's title first, then other spellings (file or folder name). consoleName helps with games that share a name.
async function lookup({ names, consoleName }, get = getJson) {
  names = [...new Set((names || []).map(s => String(s || '').trim()).filter(s => key(s)))].slice(0, 3);
  if (!names.length) return { ok: false, reason: 'noname' };
  let page = null;
  for (const n of names) {
    page = pick(await search(`${key(n)} video game`, get), names, consoleName);
    if (!page && consoleName) page = pick(await search(`${key(n)} ${consoleName} game`, get), names, consoleName);
    if (page) break;
  }
  if (!page) return { ok: false, reason: 'nomatch' };
  const text = trim(page.extract); if (!text) return { ok: false, reason: 'nomatch' };
  let extra = {}; try { extra = await facts(page.pageprops?.wikibase_item, get); } catch {}
  return { ok: true, text, title: page.title, url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(page.title.replace(/ /g, '_')), ...extra };
}

function register(ipcMain) {
  ipcMain.handle('about:fetch', async (_e, o) => { try { return await lookup(o || {}); } catch (e) { return { ok: false, reason: e.message }; } });
}

module.exports = { key, words, isGame, pick, trim, firstYear, facts, lookup, register };
