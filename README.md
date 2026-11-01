# Bradford's Places

An interactive heat map of my saved Google Maps places: starred favorites, reviewed places, and my
Want to go list. Live at https://h3h.github.io/places/

## Layout

| Path | What it is |
|---|---|
| `src/template.html` | The app: one HTML page (styles, d3 map code, search, filters) with `{{PTS}}`, `{{ROADS}}`, `{{COUNTRIES}}` and `{{STATES}}` placeholders for embedded data |
| `data/places.json` | The curated place list, one record per line (see fields below). This is the source of truth |
| `data/roads.json` | Natural Earth roads within 50 km of a place, compacted for the page |
| `tools/build.mjs` | Fills the template and writes `dist/index.html` |
| `tools/enrich.mjs` | Recomputes each place's country (`co`) and display city (`ci`) |
| `tools/takeout/import_takeout.py` | Turns a Google Takeout export into candidate places, optionally merging new ones |
| `tools/roads/clip_roads.py` | Rebuilds `data/roads.json` from the Natural Earth roads dataset |
| `tools/browser/*.js` | Console scripts for a logged-in Google Maps tab: read the newest places in a list, and look up status, coordinates and categories |
| `tools/browser/places_tool.py` | Feeds place IDs to those scripts and merges their results back into `data/places.json` |

GitHub Actions builds the page on Node 26 and deploys `dist/` to Pages on every push to `main`.

## Build locally

```sh
npm ci
npm run build        # -> dist/index.html
npm run serve        # build, then serve on http://localhost:8000
```

## Place records

```jsonc
{"k":"s",            // s = starred favorite, r = reviewed, w = want to go
 "lat":30.2672, "lon":-97.7431,
 "n":"Name", "a":"Street address", "c":"City, ST (from the address)",
 "d":"2026-10-23",   // date saved or reviewed ("" for list items, which have no date)
 "u":"Google Maps URL (carries the place's feature ID)",
 "st":5,             // review stars (reviews only)
 "g":["Coffee shop","Art gallery"],   // Google categories
 "ap":1,             // position is approximate (decoded from the feature ID)
 "co":"United States", "ci":"Austin, TX", "cin":1}  // derived by enrich; cin = city borrowed from a nearby place
```

## Updating the data

**New places added in Google Maps** (fastest, no export needed):

1. Open the list in Google Maps, paste `tools/browser/newest-in-list.js` into the DevTools console, and run `await newestInList("<newest place already on the map>")`. Save the copied JSON as `data/browser/new.json`.
2. Paste `tools/browser/place-status.js`, run `await placeStatus(IDS)` with the IDs from that file, and save the copied JSON as `data/browser/results.json`.
3. `python3 tools/browser/places_tool.py add-new data/browser/new.json data/browser/results.json --kind w` (or `--kind s` for starred).
4. `npm run enrich && npm run build`, check the page, then commit `data/places.json`.

**Re-check every place** for closures and categories: `python3 tools/browser/places_tool.py ids --all`, run `placeStatus()` with that list (about an hour for ~1,400 places at the default pace), then `places_tool.py apply results.json`.

**From a fresh Takeout export:** request "Maps (your places)" and "Saved", extract it into `takeout/` (gitignored), and run `python3 tools/takeout/import_takeout.py --takeout takeout/Takeout --list "Want to go" --merge`. Only places not already in `data/places.json` are added, so earlier curation is kept.

**Roads** (after places change a lot): download the Natural Earth roads GeoJSON (command in `tools/roads/clip_roads.py`) and run `python3 tools/roads/clip_roads.py`.

Python tools need `pip install -r requirements.txt`.

## Privacy

Raw Takeout exports, browser results and private overrides (`takeout/`, `local/`, `data/import/`, `data/browser/`) are gitignored and must never be committed. `local/overrides.json` holds names to keep off the map and coordinates for address-only pins; see `tools/takeout/overrides.example.json`.

## Data sources

Place data comes from my Google Maps account. Country borders: Natural Earth via `world-atlas` and `us-atlas`. Roads: Natural Earth 1:10m roads.
