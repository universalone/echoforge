// Tests app/wheelgames.js: matching library names to the lists of games that support racing wheels.
// Run: node test/wheelgames_test.js
const WG = require('../app/wheelgames');

let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const is = (c, t, want) => { const got = WG.support(c, t); check(`${c} “${t}” → ${want}`, got === want, got === want ? '' : `got ${got}`); };

is('ps3', 'Gran Turismo 5', 'yes');
is('ps3', 'Gran Turismo 5 XL Edition', 'yes');
is('ps3', 'GRAN TURISMO 5 Prologue', 'yes');
is('ps3', 'Need for Speed Most Wanted', 'yes');          // the 2012 game, as named in this library
is('ps3', 'Need for Speed: Pro Street', 'yes');
is('ps3', 'Need for Speed ProStreet', 'yes');
is('ps3', 'DiRT 2', 'yes');
is('ps3', 'Race Driver: GRID', 'yes');
is('ps3', 'Hot Wheels World’s Best Driver', null);
is('ps3', 'Wheelman', null);
is('ps3', 'MotorStorm', 'no');
is('ps3', 'MotorStorm: Pacific Rift', 'no');
is('ps2', 'Burnout 3 - Takedown', 'yes');
is('ps2', 'Gran Turismo 4 (USA)', 'yes');
is('ps2', 'Smuggler’s Run 2: Hostile Territory', 'yes');
is('ps2', 'Smugglers Run 2 - Hostile Territory', 'yes');
is('gc', 'Mario Kart - Double Dash!!', 'yes');
is('x360', 'DiRT 3 Complete Edition', null);              // no Xbox 360 list
check('a different game that starts the same isn’t matched', WG.support('ps3', 'Gran Turismo 5 Racing Stickers Pack') === null);
check('wheels connect for PS3 and PS2 only', WG.connected('ps3') && WG.connected('ps2') && !WG.connected('ps4') && !WG.connected('x360'));
check('lists have no duplicates after matching', Object.values(WG.LISTS).every(l => l.length >= new Set(l.map(WG.norm)).size));

console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
