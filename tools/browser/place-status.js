// Look up Google Maps details for a list of places, slowly, from a logged-in Google Maps tab.
//
// Paste this whole file into the DevTools console of a https://www.google.com/maps tab, then run
//   await placeStatus(IDS)
// where IDS comes from `python3 tools/browser/places_tool.py ids` (an array of "0x…:0x…" feature IDs).
// When it finishes, it copies a JSON object to the clipboard; save it as data/browser/results.json
// and run `python3 tools/browser/places_tool.py apply data/browser/results.json`.
//
// For each place it records:
//   st   "OPEN", "CLOSED" (permanently closed), or "NOTYPE" (no business status, e.g. parks)
//   lat, lon   Google's current coordinates (null if Google no longer returns the listing)
//   g    up to 3 Google categories, e.g. ["Coffee shop", "Art gallery"]
//
// It goes one place at a time with 2–3.5 s pauses (plus a ~40 s break every 100) and stops at the
// first HTTP error or "unusual traffic" page. Progress is saved in localStorage, so re-running
// the same call resumes. Uses undocumented Google Maps endpoints: expect them to change.
async function placeStatus(ids, { minDelay = 2000, jitter = 1500 } = {}) {
  const KEY = 'placeStatus.results';
  const res = JSON.parse(localStorage.getItem(KEY) || '{}');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let n = 0;
  for (const id of ids) {
    if (res[id]) continue;
    const r1 = await fetch('/maps/place/x/data=!4m2!3m1!1s' + id);
    const h = await r1.text();
    if (r1.status !== 200 || /unusual traffic|sorry\/index|captcha/i.test(h)) { console.warn('Stopped: Google pushed back at', id); break; }
    const m = h.match(/href="(\/maps\/preview\/place[^"]*)"/);
    if (m) {
      await sleep(400 + Math.random() * 350);
      const r2 = await fetch(m[1].replace(/&amp;/g, '&'));
      const j = await r2.text();
      if (r2.status !== 200 || /unusual traffic|captcha/i.test(j.slice(0, 3000))) { console.warn('Stopped: Google pushed back at', id); break; }
      const cid = id.split(':')[1].slice(2);
      const st = j.match(/\[(?:"([A-Z_]+)",)?"SearchResult\.TYPE_[A-Z_]+"/);
      const c = j.match(/\[\[[\d.]+,(-?[\d.]+),(-?[\d.]+)\],\[0,0,0\]/);
      const g = j.match(new RegExp(':0x' + cid + '","(?:[^"\\\\]|\\\\.)*",null,\\[((?:"[^"]*",?)*)\\]'));
      const lat = c ? +c[2] : null, lon = c ? +c[1] : null;
      const dead = lat !== null && Math.abs(lat - 35.57838) < 1e-4 && Math.abs(lon + 106.05226) < 1e-4; // generic viewport = listing gone
      res[id] = { st: st ? (st[1] || 'OPEN') : 'NOTYPE', lat: dead ? null : lat, lon: dead ? null : lon,
                  g: g ? [...g[1].matchAll(/"([^"]*)"/g)].map(x => x[1].replace(/\\u0026/g, '&')).slice(0, 3) : [] };
    } else res[id] = { st: 'NOLINK' };
    localStorage.setItem(KEY, JSON.stringify(res));
    if (++n % 25 === 0) console.log(`${Object.keys(res).length}/${ids.length}`);
    await sleep(minDelay + Math.random() * jitter + (n % 100 === 0 ? 30000 + Math.random() * 15000 : 0));
  }
  const out = Object.fromEntries(ids.filter(id => res[id]).map(id => [id, res[id]]));
  try { copy(JSON.stringify(out)); console.log('Copied', Object.keys(out).length, 'results to the clipboard.'); } catch { console.log(JSON.stringify(out)); }
  return out;
}
