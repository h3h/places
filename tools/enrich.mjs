// Fill in derived fields on data/places.json:
//   co  - country, from the coordinates (point-in-polygon on Natural Earth 1:50m borders,
//         falling back to the nearest border vertex for coastal points just outside a polygon)
//   ci  - display city, cleaned from the address-derived "c" field; places without one borrow
//         the nearest city within 25 km (and get cin: 1 so hot-spot labels ignore it)
// Existing co/ci values are recomputed every run, so this is safe to re-run.
// Usage: npm run enrich
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { geoContains, geoDistance } from 'd3';
import { feature } from 'topojson-client';
const require = createRequire(import.meta.url);
const root = new URL('..', import.meta.url).pathname;

const world = JSON.parse(readFileSync(require.resolve('world-atlas/countries-50m.json')));
const countries = feature(world, world.objects.countries).features;
const verts = countries.map(f => {
  const g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates, v = [];
  polys.forEach(p => p.forEach(r => r.forEach(c => v.push(c)))); return v;
});
const RENAME = { 'United States of America': 'United States', 'Bosnia and Herz.': 'Bosnia and Herzegovina', 'Dominican Rep.': 'Dominican Republic' };
function countryOf(lon, lat) {
  for (const f of countries) if (geoContains(f, [lon, lat])) return RENAME[f.properties.name] || f.properties.name;
  let best = null, bd = Infinity;
  countries.forEach((f, i) => { for (const v of verts[i]) { const d = Math.abs(v[0] - lon) + Math.abs(v[1] - lat); if (d < bd) { bd = d; best = f.properties.name; } } });
  return RENAME[best] || best;
}

const US = new Set('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' '));
const CITY_NAMES = { CDMX: 'Mexico City', 'Ciudad de México': 'Mexico City', 'B.C.S.': 'Baja California Sur', Luzern: 'Lucerne', 'Zürich': 'Zurich', 'München': 'Munich' };
function cleanCity(c, country) {
  if (!c) return null;
  const i = c.indexOf(', '), first = i < 0 ? c : c.slice(0, i), rest = i < 0 ? '' : c.slice(i + 2).trim();
  if (US.has(rest)) return `${first}, ${rest}`;
  let s = first.replace(/^([A-Z]{2}\s+)+/, '')               // Dutch postcode letters, e.g. "KH Amsterdam"
    .replace(/\s+(QLD|NSW|VIC|WA|SA|TAS|NT|ACT)$/, '')       // Australian state suffixes
    .replace(/^\d[\d\s-]*/, '').trim();
  if (country === 'Australia') s = s.replace(/\s+City$/, '');
  s = CITY_NAMES[s] || s;
  return !s || s === country ? null : `${s}, ${country}`;
}

const path = root + 'data/places.json';
const places = JSON.parse(readFileSync(path, 'utf8'));
for (const p of places) { p.co = countryOf(p.lon, p.lat); const ci = cleanCity(p.c, p.co); delete p.cin; if (ci) p.ci = ci; else delete p.ci; }
const withCity = places.filter(p => p.ci);
for (const p of places) {
  if (p.ci) continue;
  let best = null, bd = 25;
  for (const q of withCity) { const d = geoDistance([p.lon, p.lat], [q.lon, q.lat]) * 6371; if (d < bd) { bd = d; best = q.ci; } }
  if (best) { p.ci = best; p.cin = 1; }
}
writeFileSync(path, '[\n' + places.map(p => JSON.stringify(p)).join(',\n') + '\n]\n');
console.log(`enriched ${places.length} places; ${places.filter(p => !p.ci).length} without a city`);
