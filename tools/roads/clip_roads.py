#!/usr/bin/env python3
"""Build data/roads.json: Natural Earth 1:10m roads within 50 km of any place.

The page draws these as faint lines once you zoom in to metro level. Output is a compact list of
[major, lon0, lat0, dlon1, dlat1, ...] per segment, in integer units of 1e-4 degrees (~11 m),
delta-encoded; major = 1 for major highways, beltways and expressways.

Usage:
  curl -L -o tools/roads/ne_10m_roads.geojson \
    https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_roads.geojson
  python3 tools/roads/clip_roads.py
"""
import json, os
import numpy as np
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
RADIUS_KM = 50
SIMPLIFY_DEG = 0.0004  # Douglas-Peucker tolerance, ~40 m


def xyz(lat, lon):
    la, lo = np.radians(lat), np.radians(lon)
    return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], -1)


def dp(a, eps):
    if len(a) < 3:
        return a
    s, e = a[0], a[-1]
    v = e - s
    n = np.hypot(*v) or 1e-12
    w = a[1:-1] - s
    dist = np.abs(v[0] * w[:, 1] - v[1] * w[:, 0]) / n
    i = np.argmax(dist)
    if dist[i] > eps:
        return np.vstack([dp(a[:i + 2], eps)[:-1], dp(a[i + 1:], eps)])
    return np.array([s, e])


def main():
    places = json.load(open(os.path.join(ROOT, "data", "places.json")))
    tree = cKDTree(xyz(np.array([p["lat"] for p in places]), np.array([p["lon"] for p in places])))
    roads = json.load(open(os.path.join(HERE, "ne_10m_roads.geojson")))["features"]
    enc = []
    for f in roads:
        pr = f["properties"]
        if pr.get("type") in ("Ferry Route", "Track"):
            continue
        major = 1 if (pr.get("type") in ("Major Highway", "Beltway") or pr.get("expressway") == 1) else 0
        g = f["geometry"]
        for line in (g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]):
            a = np.array(line)
            if len(a) < 2:
                continue
            d, _ = tree.query(xyz(a[:, 1], a[:, 0]), distance_upper_bound=RADIUS_KM / 6371.0)
            idx = np.where(np.isfinite(d))[0]
            if not len(idx):
                continue
            for run in np.split(idx, np.where(np.diff(idx) > 1)[0] + 1):
                seg = a[max(run[0] - 1, 0):min(run[-1] + 1, len(a) - 1) + 1]  # reach one point past the edge
                if len(seg) < 2:
                    continue
                q = np.round(dp(seg, SIMPLIFY_DEG) * 1e4).astype(int)
                dq = np.vstack([q[:1], np.diff(q, axis=0)])
                if len(dq) >= 2:
                    enc.append([major] + dq.flatten().tolist())
    out = os.path.join(ROOT, "data", "roads.json")
    json.dump(enc, open(out, "w"), separators=(",", ":"))
    print(f"{len(enc)} road segments -> data/roads.json ({os.path.getsize(out) // 1024} KB)")


if __name__ == "__main__":
    main()
