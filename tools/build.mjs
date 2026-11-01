// Build dist/index.html from src/template.html + data/*.json + map boundary packages.
// Usage: npm run build
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = new URL('..', import.meta.url).pathname;
const read = p => readFileSync(root + p, 'utf8');
const pkg = p => readFileSync(require.resolve(p), 'utf8');
// JSON embedded in <script type="application/json">: escape "</" so it can't close the tag.
const embed = s => JSON.stringify(JSON.parse(s)).replace(/<\//g, '<\\/');

const parts = {
  PTS: embed(read('data/places.json')),
  ROADS: embed(read('data/roads.json')),
  COUNTRIES: embed(pkg('world-atlas/countries-50m.json')),
  STATES: embed(pkg('us-atlas/states-10m.json')),
};
let html = read('src/template.html');
for (const [k, v] of Object.entries(parts)) {
  if (!html.includes(`{{${k}}}`)) throw new Error(`template is missing {{${k}}}`);
  html = html.replace(`{{${k}}}`, () => v);
}
mkdirSync(root + 'dist', { recursive: true });
writeFileSync(root + 'dist/index.html', html);
copyFileSync(root + '.nojekyll', root + 'dist/.nojekyll');
console.log(`dist/index.html: ${(html.length / 1024).toFixed(0)} KB, ${JSON.parse(read('data/places.json')).length} places`);
