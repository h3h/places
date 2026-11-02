// Build dist/ from src/template.html + data/*.json + map boundary packages.
// index.html carries only what the first view needs (core point fields, 110m borders and lakes);
// details, 50m borders and lakes, states, roads and water are content-hashed files the page fetches when needed.
// Usage: npm run build
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spellOutAddress } from './states.mjs';
const require = createRequire(import.meta.url);
const root = new URL('..', import.meta.url).pathname;
const dist = root + 'dist/';
const read = p => readFileSync(root + p, 'utf8');
const pkg = p => readFileSync(require.resolve(p), 'utf8');
const min = s => JSON.stringify(JSON.parse(s));
// JSON embedded in <script type="application/json">: escape "</" so it can't close the tag.
const embed = s => s.replace(/<\//g, '<\\/');

// Category buckets for the filter list, matched against Google categories (first match wins).
const BUCKETS = [
  ['Hot springs & spas', /hot spring|\bspa\b|sauna|bath|thermal|onsen|jjimjilbang/i],
  ['Coffee & cafés', /coffee|caf[eé]|espresso|tea house|roaster/i],
  ['Bakeries & sweets', /bakery|donut|doughnut|ice cream|gelato|dessert|chocolat|pastry|churro|churrer|creamery|candy|pastelería|panader/i],
  ['Bars & breweries', /\bbar\b|pub|brew|winery|wine|distiller|taproom|cocktail|beer|lounge|saloon|speakeasy|mezcal|cantina/i],
  ['Bookstores & libraries', /book|library|librer|biblioteca/i],
  ['Lodging & camping', /hotel|motel|\binn\b|resort|lodge|campground|camping|rv park|hostel|cabin|glamping|bed & breakfast|vacation|naturist|nudist|guest house|holiday park|holiday apartment|villa|lodging|chalet/i],
  ['Restaurants', /restaurant|taco|taquer|barbecue|bbq|pizza|deli|food|diner|grill|sushi|ramen|burger|bistro|eatery|kitchen|brunch|breakfast|steak|seafood|noodle|sandwich|poke|birria|meal/i],
  ['Parks & outdoors', /park|trail|hik|beach|lake|river|falls|waterfall|nature|preserve|canyon|cave|grotto|mountain|scenic|lookout|viewpoint|garden|forest|recreation|wildlife|spring|island|peak|crater|dune|desert|reserve|sanctuary|bridge|overlook|ravine|cliff|golf|marina|off.road|atv|boat rental|tennis|swimming/i],
  ['Museums & sights', /museum|gallery|landmark|histor|attraction|monument|church|cathedral|castle|palace|observatory|\bart\b|cultur|theat|cinema|planetarium|aquarium|zoo|stadium|plaza|tour|ruin|temple|mission|memorial|sculpture|university|cemetery/i],
  ['Errands & services', /car wash|detailing|tint|storage|repair|laundr|dry clean|roofing|pest|propane|charging station|recycling|coworking|caterer|mechanic|contractor|barber|salon|hairdresser/i],
  ['Shops & markets', /store|shop|market|boutique|mall|grocer|outlet|tienda|mercado|supply|dealer/i],
];
function bucket(p) {
  const g = p.g || [];
  if (/hot springs?\b/i.test(p.n)) return 'Hot springs & spas';
  for (const c of g) for (const [b, re] of BUCKETS) if (re.test(c)) return b;
  return g.length ? 'Other' : 'Not categorized';
}

const places = JSON.parse(read('data/places.json'));
// First view: position, kind, year, category and city (hot-spot labels). A place with no city
// keeps its name, since a hot spot seeded there is labeled with it.
const core = places.map(p => {
  // y stays null (not missing) for undated places: the page's year filters rely on null >= 0.
  const o = { k: p.k, lat: p.lat, lon: p.lon, y: p.d ? +p.d.slice(0, 4) : null, b: bucket(p) };
  if (p.ci) o.ci = p.ci; else o.n = p.n;
  if (p.cin) o.cin = 1;
  return o;
});
// Everything else the card and search use, in the same order as core.
const details = places.map(p => {
  const o = {};
  for (const f of ['n', 'a', 'd', 'u', 'st', 'g', 'ap', 'co']) if (p[f] != null) o[f] = p[f];
  if (o.a) o.a = spellOutAddress(o.a);
  return o;
});

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
const files = {};
const emit = (name, s) => {
  const f = `${name}.${createHash('sha256').update(s).digest('hex').slice(0, 10)}.json`;
  writeFileSync(dist + f, s);
  files[name] = f;
};
emit('details', JSON.stringify(details));
emit('countries', min(pkg('world-atlas/countries-50m.json')));
emit('states', min(pkg('us-atlas/states-10m.json')));
emit('roads', min(read('data/roads.json')));
emit('water', min(read('data/water.json')));
const lakes = JSON.parse(read('data/lakes.json'));
emit('lakes', JSON.stringify(lakes.fine));

const parts = {
  PTS: embed(JSON.stringify(core)),
  COUNTRIES: embed(min(pkg('world-atlas/countries-110m.json'))),
  LAKES: embed(JSON.stringify(lakes.coarse)),
  FILES: embed(JSON.stringify(files)),
};
let html = read('src/template.html');
for (const [k, v] of Object.entries(parts)) {
  if (!html.includes(`{{${k}}}`)) throw new Error(`template is missing {{${k}}}`);
  html = html.replace(`{{${k}}}`, () => v);
}
writeFileSync(dist + 'index.html', html);
copyFileSync(root + '.nojekyll', dist + '.nojekyll');
console.log(`dist/index.html: ${(html.length / 1024).toFixed(0)} KB, ${places.length} places; lazy: ${Object.values(files).join(', ')}`);
