#!/usr/bin/env python3
"""Turn Google Takeout exports into candidate place records.

Reads (all optional, skipped if missing):
  <takeout>/Maps (your places)/Saved Places.json   -> k="s" (starred / favorites)
  <takeout>/Maps (your places)/Reviews.json        -> k="r" (reviewed)
  <takeout>/Saved/<List>.csv                       -> k="w" for the lists named with --list

Writes data/import/candidates.json. Use --merge to append candidates whose Google place ID
is not already in data/places.json (existing records, and their curation, are never changed).

Coordinates: Takeout gives exact coordinates for starred places and reviews. Saved-list CSVs
only carry a Maps URL; its feature ID's first half is an S2 cell, decoded here to an
approximate position (usually within ~1 km, occasionally wrong). Records decoded that way get
"ap": 1. Run tools/browser/place-status.js afterwards to replace them with Google's coordinates.

Private curation (names to exclude, approximate coordinates for address-only pins) lives in
local/overrides.json, which is gitignored. See tools/takeout/overrides.example.json.

Usage:
  python3 tools/takeout/import_takeout.py --takeout takeout/Takeout --list "Want to go" [--merge]
"""
import argparse, csv, json, os, re, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UNNAMED = re.compile(r"^(dropped pin|pin colocado)$|^-?\d+(\.\d+)?[°,]|^\d[\d-]* [\w .]+ (St|Ave|Rd|Ln|Dr|Blvd|Way|Ct|Pl|Hwy|Pkwy|Trl|Cir)\.?$", re.I)


def place_key(url):
    """Stable identity: the CID (second half of the feature ID, or cid=...)."""
    m = re.search(r"0x[0-9a-f]+:0x([0-9a-f]+)", url or "")
    if m:
        return int(m[1], 16)
    m = re.search(r"cid=(\d+)", url or "")
    return int(m[1]) if m else None


def city_of(addr):
    if not addr:
        return None
    p = [s.strip() for s in addr.split(",")]
    if len(p) >= 3 and p[-1] in ("United States", "USA"):
        return f"{p[-3]}, {p[-2].split(' ')[0]}"
    if len(p) >= 2:
        c = re.sub(r"^\d[\d\s-]*", "", p[-2]).strip()
        c = re.sub(r"\s*\d{4,6}$", "", c).strip()
        return f"{c or p[-2]}, {p[-1]}"
    return p[0]


def load_overrides():
    path = os.path.join(ROOT, "local", "overrides.json")
    if not os.path.exists(path):
        return {"exclude": [], "approx": {}, "rename": {}}
    o = json.load(open(path))
    return {"exclude": o.get("exclude", []), "approx": o.get("approx", {}), "rename": o.get("rename", {})}


def from_geojson(path, kind, ov):
    out = []
    if not os.path.exists(path):
        return out
    for f in json.load(open(path))["features"]:
        pr = f["properties"]; loc = pr.get("location", {})
        lon, lat = f["geometry"]["coordinates"]
        name, addr, url = loc.get("name"), loc.get("address"), pr.get("google_maps_url", "")
        ap = False
        if [lon, lat] == [0, 0]:
            q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get("q", [""])[0]
            m = re.match(r"^(-?\d+\.\d+),(-?\d+\.\d+)$", q)
            if m:
                lat, lon = float(m[1]), float(m[2])
            elif q in ov["approx"]:
                lat, lon = ov["approx"][q]; addr = addr or q; ap = True
            else:
                continue
        if kind == "s" and not name:
            continue  # favorites must have a name
        p = {"k": kind, "lat": round(lat, 5), "lon": round(lon, 5), "n": name or (addr or "").split(",")[0],
             "a": addr or "", "c": city_of(addr), "d": pr.get("date", "")[:10], "u": url}
        if ap:
            p["ap"] = 1
        if kind == "r" and pr.get("five_star_rating_published"):
            p["st"] = pr["five_star_rating_published"]
        out.append(p)
    return out


def from_list_csv(path):
    import s2sphere
    lines = open(path, encoding="utf-8").read().splitlines(True)
    start = next(i for i, l in enumerate(lines) if l.startswith("Title,Note,URL"))
    out = []
    for r in csv.DictReader(lines[start:]):
        title, url = (r.get("Title") or "").strip(), r.get("URL") or ""
        if not title or UNNAMED.search(title):
            continue
        m = re.search(r"0x([0-9a-f]+):0x([0-9a-f]+)", url)
        if not m:
            continue
        ll = s2sphere.CellId(int(m[1], 16)).to_lat_lng()
        out.append({"k": "w", "lat": round(ll.lat().degrees, 5), "lon": round(ll.lng().degrees, 5), "n": title,
                    "a": r.get("Note") or "", "c": None, "d": "", "u": url, "ap": 1})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--takeout", required=True, help="path to the extracted Takeout folder")
    ap.add_argument("--list", action="append", default=[], help="Saved list name to import as want-to-go")
    ap.add_argument("--merge", action="store_true", help="append new places to data/places.json")
    a = ap.parse_args()
    ov = load_overrides()
    mp = os.path.join(a.takeout, "Maps (your places)")
    cands = from_geojson(os.path.join(mp, "Saved Places.json"), "s", ov) + from_geojson(os.path.join(mp, "Reviews.json"), "r", ov)
    for name in a.list:
        cands += from_list_csv(os.path.join(a.takeout, "Saved", name + ".csv"))
    excl = set(ov["exclude"])
    cands = [dict(p, n=ov["rename"].get(p["n"], p["n"])) for p in cands if p["n"] not in excl]
    os.makedirs(os.path.join(ROOT, "data", "import"), exist_ok=True)
    json.dump(cands, open(os.path.join(ROOT, "data", "import", "candidates.json"), "w"), ensure_ascii=False, indent=0)
    print(f"{len(cands)} candidates -> data/import/candidates.json")
    if a.merge:
        path = os.path.join(ROOT, "data", "places.json")
        places = json.load(open(path))
        have = {(p["k"], place_key(p["u"])) for p in places}
        new = [p for p in cands if (p["k"], place_key(p["u"])) not in have]
        places += new
        with open(path, "w") as f:
            f.write("[\n" + ",\n".join(json.dumps(p, ensure_ascii=False, separators=(",", ":")) for p in places) + "\n]\n")
        print(f"merged {len(new)} new places into data/places.json; now run npm run enrich")


if __name__ == "__main__":
    main()
