"""Massing extraction for Sandbox 03, from CityGML.

WHY CITYGML AND NOT THE .3dm
----------------------------
DCP publishes the same 2014 survey twice: as Rhino .3dm per community district,
and as CityGML per "delivery area" (NYC Open Data tnru-abg2). Both were tried.

THE .3dm CARRIES NO ATTRIBUTES AT ALL. Not a name, not a user string, not a BIN
or a BBL on any of its 132,223 objects. It is pure geometry, so every join to a
filing, to PLUTO, or to employment has to be made by position.

That was built first and it looked fine: 1,744 of 1,752 footprints matched a
building footprint record, median distance 2 feet. Then it was checked against
the CityGML, which does carry BIN, and **the inferred BIN was wrong for one
building in five**.

The reason is worth keeping. "Nearest centroid" is not "same building". In a
district of party-wall buildings the centroids of neighbours are tens of feet
apart, so the nearest one is frequently the one next door - and the 2-foot
median distance measured how close the nearest centroid was, not whether it was
the right building. A confident-looking statistic about the wrong quantity.

So the massing comes from CityGML, where every surface carries its BIN, and
NOTHING in this pipeline is joined by position.

WHAT IS IN THE FILE, verified 2026-08-31
-----------------------------------------
CityGML 2.0, EPSG:2263 (NY State Plane Long Island), units FEET, LoD2.
Twenty delivery areas totalling 13GB and 1,083,437 buildings.

Each bldg:Building carries gen:stringAttributes BIN, DOITT_ID and SOURCE_ID, and
a set of bldg:boundedBy surfaces - GroundSurface, RoofSurface, WallSurface - each
a gml:Polygon with a flat posList. Roof surfaces at several heights per building
are what make this a massing rather than an extrusion.

Lower Manhattan is in DA12 (4,141 buildings inside the CD1 box) with a sliver in
DA19 (155).
"""

import re
from collections import defaultdict

VAL = re.compile(r"<gen:value>([^<]*)</gen:value>")
POS = re.compile(r"<gml:posList>([^<]*)</gml:posList>")

# Delivery areas that contain Manhattan Community Districts 1 and 5.
DELIVERY_AREAS = ["DA12", "DA19"]


def _ring_and_z(text):
    """A flat posList to a 2D ring plus its elevation."""
    p = text.split()
    if len(p) < 12:
        return None, None
    xs = [float(v) for v in p[0::3]]
    ys = [float(v) for v in p[1::3]]
    zs = [float(v) for v in p[2::3]]
    return list(zip(xs, ys)), sum(zs) / len(zs)


def _area(ring):
    a = 0.0
    n = len(ring)
    for i in range(n):
        x0, y0 = ring[i]
        x1, y1 = ring[(i + 1) % n]
        a += x0 * y1 - x1 * y0
    return abs(a) * 0.5


def read_citygml(paths, keep_bins=None, verbose=True):
    """Ground and roof surfaces per BIN, streamed.

    `keep_bins` restricts the result to a set of BIN strings; everything else is
    discarded as it is read, so the 13GB never lands in memory.

    Returns {bin: {"ground": [(ring, z)], "roofs": [(ring, z)]}}.
    """
    out = defaultdict(lambda: {"ground": [], "roofs": []})
    seen = 0
    for path in paths:
        cur_bin = None
        want_bin = False
        surface = None
        with open(path, "r", errors="replace") as f:
            for line in f:
                if "<bldg:Building " in line or "<bldg:Building>" in line:
                    cur_bin, want_bin, surface = None, False, None
                    seen += 1
                    continue
                if cur_bin is None:
                    if want_bin:
                        m = VAL.search(line)
                        if m:
                            cur_bin = m.group(1).strip()
                            want_bin = False
                    elif 'name="BIN"' in line:
                        want_bin = True
                    continue
                if keep_bins is not None and cur_bin not in keep_bins:
                    continue
                if "<bldg:GroundSurface" in line:
                    surface = "ground"
                elif "<bldg:RoofSurface" in line:
                    surface = "roofs"
                elif "<bldg:WallSurface" in line:
                    surface = None
                elif surface:
                    m = POS.search(line)
                    if m:
                        ring, z = _ring_and_z(m.group(1))
                        if ring:
                            out[cur_bin][surface].append((ring, z))
        if verbose:
            print(f"citygml: read {path.name}")
    if verbose:
        print(f"citygml: {seen:,} buildings scanned, {len(out):,} kept")
    return dict(out)


def to_buildings(raw, verbose=True):
    """One massing record per BIN.

    ring    the largest ground surface, in EPSG:2263 feet
    base_z  its elevation
    levels  [(height above base, area)] for each roof surface, low to high
    height  the tallest roof above the base
    """
    buildings = []
    no_ground = 0
    for b, parts in raw.items():
        if not parts["ground"]:
            no_ground += 1
            continue
        ring, base_z = max(parts["ground"], key=lambda t: _area(t[0]))
        levels = sorted(((z - base_z, _area(r)) for r, z in parts["roofs"]),
                        key=lambda t: t[0])
        buildings.append({
            "bin": int(b) if b.isdigit() else 0,
            "ring": ring,
            "base_z": base_z,
            "area": _area(ring),
            "levels": levels,
            "height": levels[-1][0] if levels else 0.0,
        })
    if verbose:
        hs = sorted(x["height"] for x in buildings if x["height"] > 0)
        print(f"massing: {len(buildings):,} buildings with a ground surface "
              f"({no_ground:,} had none and were dropped)")
        if hs:
            print(f"massing: heights {hs[0]:,.0f}ft to {hs[-1]:,.0f}ft, "
                  f"median {hs[len(hs) // 2]:,.0f}ft")
    return buildings


def to_wgs84(buildings):
    """EPSG:2263 feet to lon/lat. Adds `lonlat` and `centroid_ll`."""
    from pyproj import Transformer

    tr = Transformer.from_crs("EPSG:2263", "EPSG:4326", always_xy=True)
    for b in buildings:
        xs = [p[0] for p in b["ring"]]
        ys = [p[1] for p in b["ring"]]
        lons, lats = tr.transform(xs, ys)
        b["lonlat"] = [(lo, la) for lo, la in zip(lons, lats)]
        b["centroid_ll"] = (sum(lons) / len(lons), sum(lats) / len(lats))
    return buildings
