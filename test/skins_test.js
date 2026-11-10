// Tests app/skins.js: built-in skins, colors from cover pixels, generated skins and the safety checks on skin files.
// Run: node test/skins_test.js
const SK = require('../app/skins');

let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const HEX = /^#[0-9a-f]{6}$/;
const hue = h => SK.rgbToHsl(...SK.hexToRgb(h))[0];
const near = (a, b, d = 25) => { const x = Math.abs(a - b) % 360; return Math.min(x, 360 - x) <= d; };
// A fake cover: rows of colors with given weights.
function pixels(parts) { const out = []; for (const [hex, n] of parts) { const [r, g, b] = SK.hexToRgb(hex); for (let i = 0; i < n; i++) out.push(r, g, b, 255); } return Uint8ClampedArray.from(out); }

check('every built-in skin is valid', SK.PRESETS.every(p => SK.validate(p)), SK.PRESETS.length + ' skins');
check('built-in skin ids are unique', new Set(SK.PRESETS.map(p => p.id)).size === SK.PRESETS.length);

let p = SK.palette(pixels([['#d01818', 600], ['#1a40d0', 250], ['#101010', 1000]]));
check('a mostly red cover gives a red main color', near(hue(p.a2), 0), p.a2);
check('the second color comes from the blue', near(hue(p.a3), 228, 30), p.a3);
check('background stays dark enough to read on', SK.rgbToHsl(...SK.hexToRgb(p.bg))[2] < .1, p.bg);
check('every palette color is a hex color', ['a1', 'a2', 'a3', 'bg', 'bg2'].every(k => HEX.test(p[k])));
p = SK.palette(pixels([['#2bd96b', 900]]));
check('a single-color cover still gets a second color', HEX.test(p.a3) && p.a3 !== p.a2, `${p.a2} ${p.a3}`);
p = SK.palette(pixels([['#808080', 500], ['#202020', 500], ['#e0e0e0', 300]]));
check('a grey cover gives a silver skin', SK.rgbToHsl(...SK.hexToRgb(p.a2))[1] < .1, p.a2);
check('an empty picture doesn’t break it', HEX.test(SK.palette(new Uint8ClampedArray(0)).a2));

const g1 = SK.generate(.42), g2 = SK.generate(.42), g3 = SK.generate(.77);
check('generated skins are valid', SK.validate(g1) && SK.validate(g3));
check('the same seed gives the same skin', JSON.stringify(g1) === JSON.stringify(g2));
check('different seeds give different skins', g1.a2 !== g3.a2);

const bad = { name: '<script>x</script>', a1: '#ffffff', a2: '#ff0000', a3: '#00ff00', bg: '#000000', bg2: '#111111', corners: 'zig', font: 'not-a-font', onload: 'evil()', css: 'body{}' };
const v = SK.validate(bad);
check('skin files keep only known fields', v && !('onload' in v) && !('css' in v));
check('names lose HTML characters', v && !/[<>]/.test(v.name), v && v.name);
check('unknown corners and fonts fall back', v && v.corners === 'cut' && v.font === 'forge');
check('a skin with a bad color is refused', SK.validate({ ...bad, a2: 'red; background:url(x)' }) === null);
check('only picture data is accepted as a wallpaper', SK.validWallData('data:image/jpeg;base64,AAAA') && !SK.validWallData('data:text/html;base64,AAAA') && !SK.validWallData('javascript:alert(1)'));

check('there are plenty of fonts to pick from', Object.keys(SK.FONTS).length >= 20, Object.keys(SK.FONTS).length + ' fonts');
const full = SK.validate({ ...bad, font: 'georgia', bodyFont: 'verdana', fontCustom: 'Cooper Black', bodyCustom: "x'; } body { display:none", border: 9, cornerSize: -5, borderStyle: 'dashed', panelAlpha: 10, text: '#eeeeee', muted: 'grey', line: '#ff00ff' });
check('heading and body fonts are kept', full.font === 'georgia' && full.bodyFont === 'verdana');
check('an installed font name is kept', full.fontCustom === 'Cooper Black');
check('a font name that tries to inject CSS is dropped', !('bodyCustom' in full));
check('border, corner and see-through values stay in range', full.border === 4 && full.cornerSize === 0 && full.panelAlpha === 30 && full.borderStyle === 'dashed');
check('text and border colors are kept, bad ones dropped', full.text === '#eeeeee' && full.line === '#ff00ff' && !('muted' in full));
const fv = SK.cssVars(full);
check('fonts, borders and text reach the page', /^'Cooper Black', Georgia/.test(fv['--display']) && /Verdana/.test(fv['--font']) && fv['--bw'] === '4px' && fv['--bstyle'] === 'dashed' && fv['--text'] === '#eeeeee' && /255, 0, 255/.test(fv['--line']));

const css = SK.cssVars(SK.find('midnight'));
check('a skin sets the colors, font and corners', css['--a2'] === '#4d9dff' && /Segoe/.test(css['--display']) && css['--cut'] === '0px');
check('angled skins keep the cut corners', SK.cssVars(SK.find('crimson'))['--cut'] === '14px');
check('your own skins are found by id', SK.find('mine', [{ id: 'mine' }]).id === 'mine' && SK.find('nope') === null);

console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
