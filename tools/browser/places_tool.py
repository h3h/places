#!/usr/bin/env python3
"""Glue between data/places.json and the browser scripts in tools/browser/.

  ids [--all | --missing]      print a JS array of feature IDs to pass to placeStatus()
                               default --missing: places without categories or with approximate coordinates
  apply RESULTS.json           merge placeStatus() output: drop permanently closed places (unless
                               --keep-closed), take Google's coordinates for approximate ones, set categories
  add-new NEW.json RESULTS.json --kind s|w
                               append places found by newestInList(), using placeStatus() results
                               for their coordinates and categories (permanently closed ones are skipped)

After any change: npm run enrich && npm run build
"""
import argparse, json, math, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PATH = os.path.join(ROOT, "data", "places.json")
FID = re.compile(r"(0x[0-9a-f]+:0x[0-9a-f]+)")


def load():
    return json.load(open(PATH))


def save(places):
    with open(PATH, "w") as f:
        f.write("[\n" + ",\n".join(json.dumps(p, ensure_ascii=False, separators=(",", ":")) for p in places) + "\n]\n")


def fid(p):
    m = FID.search(p.get("u", ""))
    if m:
        return m[1]
    m = re.search(r"cid=(\d+)", p.get("u", ""))
    return f"0x0:{int(m[1]):#x}" if m else None


def cmd_ids(a):
    ps = load()
    sel = ps if a.all else [p for p in ps if not p.get("g") or p.get("ap")]
    ids = sorted({fid(p) for p in sel if fid(p)})
    print(json.dumps(ids))
    print(f"// {len(ids)} places", file=sys.stderr)


def cmd_apply(a):
    res = json.load(open(a.results))
    ps, kept, closed, moved = load(), [], [], 0
    for p in ps:
        r = res.get(fid(p))
        if r:
            if r.get("st") == "CLOSED" and not a.keep_closed:
                closed.append(p["n"]); continue
            if r.get("g"):
                p["g"] = r["g"]
            if p.get("ap") and r.get("lat") is not None:
                d = math.hypot(r["lat"] - p["lat"], (r["lon"] - p["lon"]) * math.cos(math.radians(p["lat"]))) * 111
                p["lat"], p["lon"] = round(r["lat"], 5), round(r["lon"], 5); p.pop("ap"); moved += 1
                if d > 60:
                    print(f"note: {p['n']} moved {d:.0f} km to Google's location", file=sys.stderr)
        kept.append(p)
    save(kept)
    print(f"removed {len(closed)} permanently closed, fixed {moved} approximate positions")
    for n in closed:
        print("  closed:", n)


def cmd_add_new(a):
    new, res, ps = json.load(open(a.new)), json.load(open(a.results)), load()
    have = {fid(p) for p in ps}
    added = 0
    for item in new:
        r = res.get(item["id"]) or {}
        if not item.get("id") or item["id"] in have or r.get("st") == "CLOSED" or r.get("lat") is None:
            continue
        p = {"k": a.kind, "lat": round(r["lat"], 5), "lon": round(r["lon"], 5), "n": item["name"], "a": "", "c": None,
             "d": "", "u": "https://www.google.com/maps/place/x/data=!4m2!3m1!1s" + item["id"]}
        if r.get("g"):
            p["g"] = r["g"]
        ps.insert(0, p) if a.kind == "s" else ps.append(p)
        added += 1
    save(ps)
    print(f"added {added} places")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("ids"); g = s.add_mutually_exclusive_group(); g.add_argument("--all", action="store_true"); g.add_argument("--missing", action="store_true"); s.set_defaults(f=cmd_ids)
    s = sub.add_parser("apply"); s.add_argument("results"); s.add_argument("--keep-closed", action="store_true"); s.set_defaults(f=cmd_apply)
    s = sub.add_parser("add-new"); s.add_argument("new"); s.add_argument("results"); s.add_argument("--kind", choices=["s", "w"], required=True); s.set_defaults(f=cmd_add_new)
    a = ap.parse_args(); a.f(a)


if __name__ == "__main__":
    main()
