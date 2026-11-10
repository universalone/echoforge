// Tests app/synopsis.js with made-up Wikipedia and Wikidata answers (no internet needed).
// Run: node test/synopsis_test.js
const S = require('../app/synopsis');

let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };

const page = (index, title, description, extract, qid) => ({ index, title, description, extract, pageprops: qid ? { wikibase_item: qid } : undefined });
const BLACK = [
  page(1, 'Black Mesa (video game)', '2020 video game', 'Black Mesa is a 2020 first-person shooter.', 'Q1'),
  page(2, 'Black (video game)', '2006 video game', 'Black is a 2006 first-person shooter game developed by Criterion Games.\nIt was released for the PlayStation 2 and Xbox.', 'Q880040'),
  page(3, 'Black', 'Color', 'Black is a color.', 'Q2'),
];
const NFS = [
  page(1, 'Need for Speed', 'Racing video game franchise', 'Need for Speed is a franchise.', 'Q3'),
  page(2, 'List of Need for Speed video games', '', 'A list.', 'Q4'),
  page(3, 'Need for Speed: Carbon', '2006 racing video game', 'Need for Speed: Carbon is a 2006 racing video game.', 'Q219795'),
];
const AEON = [page(1, 'Æon Flux (film)', '2005 American sci-fi action film', 'A film.', 'Q5'), page(2, 'Æon Flux (video game)', '2005 video game', 'Æon Flux is a video game.', 'Q6')];

check('Æ, punctuation and “The” don’t matter', S.key('Æon Flux') === 'aeon flux' && S.key('Legend of Zelda, The - Wind Waker (USA)') === S.key('The Legend of Zelda: Wind Waker'));
check('Roman numerals match digits', S.words('Dirt III').join(' ') === S.words('DiRT 3').join(' '));
check('a short name gets its own article, not a longer one', S.pick(BLACK, ['Black']).title === 'Black (video game)');
check('the series and list pages are skipped', S.pick(NFS, ['Need for Speed - Carbon']).title === 'Need for Speed: Carbon');
check('films and TV shows are skipped', S.pick(AEON, ['Aeon Flux']).title === 'Æon Flux (video game)');
check('a game whose name doesn’t match gets nothing', S.pick(BLACK, ['Halo 3']) === null);
check('one word in common isn’t a match', S.pick([page(1, 'Black Tiger (video game)', '1987 video game', 'x')], ['Black']) === null);
check('a missing subtitle still matches', S.pick([page(1, 'Kingdom Hearts II: Final Mix', '2007 video game', 'x')], ['Kingdom Hearts II']).title === 'Kingdom Hearts II: Final Mix');
check('a sequel isn’t the first game', S.pick([page(1, 'Kingdom Hearts II', '2005 video game', 'x'), page(2, 'Halo 2', '2004 video game', 'x')], ['Kingdom Hearts', 'Halo']) === null);
check('“game” descriptions only', S.isGame('2006 racing video game') && S.isGame('2005 open world racing game') && !S.isGame('Video game franchise') && !S.isGame('Fictional character'));

const long = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
const t = S.trim(long + '\n' + long);
check('long text is cut at a sentence end', t.length <= 900 && t.endsWith('.'), t.length);
check('keeps two short paragraphs', S.trim('One.\nTwo.\nThree is long. ' + 'x'.repeat(900)) === 'One.\n\nTwo.');
check('empty pronunciation brackets go', S.trim('Æon Flux () is a game.') === 'Æon Flux is a game.');
check('earliest release year', S.firstYear(['+2006-12-21T00:00:00Z', '+2006-10-30T00:00:00Z', '+2007-01-01T00:00:00Z']) === 2006);

// Whole lookup with a fake web.
const urls = [];
const fake = async (url) => {
  urls.push(url); const u = new URL(url), q = u.searchParams;
  if (u.host === 'en.wikipedia.org') return { query: { pages: /carbon/i.test(q.get('gsrsearch')) ? NFS : [] } };
  if (q.get('props') === 'claims') return { entities: { Q219795: { claims: {
    P136: [{ mainsnak: { datavalue: { value: { id: 'Q10' } } } }, { mainsnak: { datavalue: { value: { id: 'Q11' } } } }],
    P178: [{ mainsnak: { datavalue: { value: { id: 'Q12' } } } }],
    P123: [{ mainsnak: { datavalue: { value: { id: 'Q13' } } } }],
    P577: [{ mainsnak: { datavalue: { value: { time: '+2006-11-19T00:00:00Z' } } } }, { mainsnak: { datavalue: { value: { time: '+2006-10-30T00:00:00Z' } } } }] } } } };
  return { entities: { Q10: { labels: { en: { value: 'crossover fiction' } } }, Q11: { labels: { en: { value: 'racing video game' } } }, Q12: { labels: { en: { value: 'EA Black Box' } } }, Q13: { labels: { en: { value: 'Electronic Arts' } } } } };
};
(async () => {
  const r = await S.lookup({ names: ['Need for Speed - Carbon', 'NFS Carbon (USA)'], consoleName: 'PlayStation 2' }, fake);
  check('finds the article', r.ok && r.title === 'Need for Speed: Carbon' && r.url === 'https://en.wikipedia.org/wiki/Need_for_Speed%3A_Carbon', r.url);
  check('year, genre, developer and publisher', r.year === 2006 && r.genre.join() === 'racing video game' && r.dev.join() === 'EA Black Box' && r.pub.join() === 'Electronic Arts', JSON.stringify(r.genre));
  check('only the game’s name is sent', urls.every(u => !/[A-Z]:\\|%5C|\.iso|\.7z/i.test(u)) && new URL(urls[0]).searchParams.get('gsrsearch') === 'need for speed carbon video game');
  urls.length = 0;
  const miss = await S.lookup({ names: ['Halo 3'], consoleName: 'Xbox 360' }, fake);
  check('no match says so', !miss.ok && miss.reason === 'nomatch');
  check('a second search adds the console', urls.some(u => new URL(u).searchParams.get('gsrsearch') === 'halo 3 Xbox 360 game'));
  check('no name, no search', (await S.lookup({ names: ['', '  '] }, fake)).reason === 'noname');
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
