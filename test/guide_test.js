// Checks app/guide.js against the app: every "Take me there" opens a real page, every button runs a real action,
// and every tour step highlights something that exists. Run: node test/guide_test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const win = {}; vm.runInNewContext(app('data.js') + '\n' + app('guide.js'), { window: win });
const renderer = app('renderer.js'), html = app('index.html');
const views = new Set([...renderer.matchAll(/^V\.(\w+) =/gm)].map(m => m[1]));
const navs = new Set([...renderer.matchAll(/nav\('(\w+)'/g)].map(m => m[1]));
const consoles = new Set(win.EF_CONSOLES.map(c => c.id));

let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };

check('guide has sections', Array.isArray(win.EF_GUIDE) && win.EF_GUIDE.length >= 10);
const ids = win.EF_GUIDE.map(s => s.id);
check('section ids are unique', new Set(ids).size === ids.length);
const bad = [];
for (const s of win.EF_GUIDE) {
  if (!s.title || !s.intro || !s.steps.length) bad.push(`${s.id}: missing title, intro or steps`);
  if (!/<path|<rect|<circle/.test((renderer.match(new RegExp(`^  ${s.icon}: '.*$`, 'm')) || [''])[0])) bad.push(`${s.id}: no icon "${s.icon}"`);
  for (const st of s.steps) {
    if (st.go) {
      const [v, p] = st.go.split(':');
      if (!views.has(v)) bad.push(`${s.id}: no page "${v}"`);
      if (v === 'console' && !consoles.has(p)) bad.push(`${s.id}: no console "${p}"`);
    }
    if (st.act && !new RegExp(`\\b${st.act}: `).test(renderer)) bad.push(`${s.id}: no action "${st.act}"`);
  }
}
check('every step opens a real page or runs a real action', !bad.length, bad.join('; '));

const tourBad = [];
for (const t of win.EF_TOUR) {
  if (!t.title || !t.text) tourBad.push('step without title or text');
  if (!t.target) continue;
  const nav = t.target.match(/data-arg="(\w+)"/), con = /data-arg\^="console:"/.test(t.target);
  if (nav && !navs.has(nav[1])) tourBad.push(`no menu item "${nav[1]}"`);
  if (con && !/data-arg="console:\$\{c\.id\}"/.test(renderer)) tourBad.push('no console menu items');
  if (/^#side/.test(t.target) && !/id="side"/.test(html)) tourBad.push('no menu');
  if (/\.search/.test(t.target) && !/class="search"/.test(html)) tourBad.push('no search box');
  if (/data-act="bigpic"/.test(t.target) && !/data-act="bigpic"/.test(html)) tourBad.push('no Big Picture button');
}
check('every tour step highlights something that exists', !tourBad.length, tourBad.join('; '));
check('Guide is in the menu and on F1', navs.has('guide') && views.has('guide') && /ev\.key === 'F1'/.test(renderer));
check('guide.js loads before the app', html.indexOf('guide.js') > 0 && html.indexOf('guide.js') < html.indexOf('renderer.js'));
check('tour only starts after setup when not done before', /wzFinish:.*if \(!S\.tourDone\) setTimeout\(startTour/.test(renderer) && /s\.tourDone = raw\.tourDone \?\? s\.wizardDone/.test(renderer));

console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
