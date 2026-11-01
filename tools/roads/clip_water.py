#!/usr/bin/env python3
"""Build data/water.json: Natural Earth 1:10m lakes and rivers (global + North America and Europe) near any place.

The page draws these with the roads once you zoom in to metro level. Output uses the roads format:
[kind, lon0, lat0, dlon1, dlat1, ...] in integer units of 1e-4 degrees, delta-encoded, where
kind 0 = river (clipped to within 50 km of a place) and kind 1 = one lake ring (outer edge or
island). A lake is kept whole when any part of it is within 50 km of a place.

Also builds data/lakes.json: {"coarse": every 1:110m lake, "fine": every 1:50m lake}, as lake rings
in the same format, so the Great Lakes and other big lakes show from the world view.

Usage:
  B=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson
  for f in 10m_lakes 10m_lakes_north_america 10m_lakes_europe 10m_rivers_lake_centerlines \
      10m_rivers_north_america 10m_rivers_europe 110m_lakes 50m_lakes; do
    curl -L -o tools/roads/ne_$f.geojson $B/ne_$f.geojson; done
  python3 tools/roads/clip_water.py
"""
import json, os
import numpy as np
from scipy.spatial import cKDTree
from clip_roads import HERE, ROOT, RADIUS_KM, SIMPLIFY_DEG, xyz, dp

# Global layers plus Natural Earth's regional supplements, which add the smaller lakes and rivers
# (Lake Travis, the Colorado through Austin, the Swiss lakes) the global files leave out.
LAKES = ["lakes", "lakes_north_america", "lakes_europe"]
RIVERS = ["rivers_lake_centerlines", "rivers_north_america", "rivers_europe"]
FINE_SIMPLIFY_DEG = 0.005  # ~500 m; the 50m lakes are only drawn below road zoom


def encode(kind, a):
    q = np.round(a * 1e4).astype(int)
    return [kind] + np.vstack([q[:1], np.diff(q, axis=0)]).flatten().tolist()


def features(names):
    return [f for n in names for f in json.load(open(os.path.join(HERE, f"{n}.geojson")))["features"] if f["geometry"]]


polys = lambda g: g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]


def lake_rings(g, tol):
    out = []
    for poly in polys(g):
        for i, r in enumerate(poly):
            r = np.array(r)
            m = len(r) // 2  # a closed ring has equal ends, which dp can't split; simplify each half
            s = np.vstack([dp(r[:m + 1], tol)[:-1], dp(r[m:], tol)])
            if len(s) < 4:
                continue
            # outer rings counterclockwise, islands clockwise, so the page's nonzero fill keeps islands
            # as land and a lake listed in two source files still fills once
            area = np.sum(s[:-1, 0] * s[1:, 1] - s[1:, 0] * s[:-1, 1])
            if (area > 0) == (i > 0):
                s = s[::-1]
            out.append(encode(1, s))
    return out


def main():
    places = json.load(open(os.path.join(ROOT, "data", "places.json")))
    tree = cKDTree(xyz(np.array([p["lat"] for p in places]), np.array([p["lon"] for p in places])))
    near = lambda a: np.isfinite(tree.query(xyz(a[:, 1], a[:, 0]), distance_upper_bound=RADIUS_KM / 6371.0)[0])
    enc = []

    for f in features(f"ne_10m_{n}" for n in LAKES):
        g = f["geometry"]
        if any(near(np.array(r)).any() for poly in polys(g) for r in poly):
            enc += lake_rings(g, SIMPLIFY_DEG)

    for f in features(f"ne_10m_{n}" for n in RIVERS):
        if f["properties"].get("featurecla") == "Lake Centerline":
            continue  # would draw a line across the lake
        g = f["geometry"]
        for line in (g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]):
            a = np.array(line)
            if len(a) < 2:
                continue
            idx = np.where(near(a))[0]
            for run in np.split(idx, np.where(np.diff(idx) > 1)[0] + 1) if len(idx) else []:
                seg = a[max(run[0] - 1, 0):min(run[-1] + 1, len(a) - 1) + 1]  # reach one point past the edge
                if len(seg) >= 2:
                    enc.append(encode(0, dp(seg, SIMPLIFY_DEG)))

    # every lake at 110m (drawn from the world view) and 50m (once the 50m borders are in)
    big = {"coarse": [e for f in features(["ne_110m_lakes"]) for e in lake_rings(f["geometry"], 0)],
           "fine": [e for f in features(["ne_50m_lakes"]) for e in lake_rings(f["geometry"], FINE_SIMPLIFY_DEG)]}
    out = os.path.join(ROOT, "data", "lakes.json")
    json.dump(big, open(out, "w"), separators=(",", ":"))
    print(f"{len(big['coarse'])} + {len(big['fine'])} big-lake rings -> data/lakes.json ({os.path.getsize(out) // 1024} KB)")

    out = os.path.join(ROOT, "data", "water.json")
    json.dump(enc, open(out, "w"), separators=(",", ":"))
    lakes = sum(e[0] for e in enc)
    print(f"{lakes} lake rings, {len(enc) - lakes} river segments -> data/water.json ({os.path.getsize(out) // 1024} KB)")


if __name__ == "__main__":
    main()
