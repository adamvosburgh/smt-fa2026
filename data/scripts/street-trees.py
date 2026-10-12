#!/usr/bin/env python3
"""
street-trees.py - processing pipeline for the Street Tree Stormwater sandbox.

WHAT THE MODEL IS
-----------------
The run from Tutorials 3 and 4. Every living street tree in the upper Manhattan
subset of the 2015 census catches a share of the rain that falls on its crown.
The crown comes from the species' Urban Tree Database equation, the trees grow
by the same database's age curves, some die each year, and new trees can be
planted on the sites the census recorded as dead trees or stumps. The clock runs
from 2015 to 2045.

WHAT THIS SCRIPT IS FOR
-----------------------
Joining and cleaning, nothing else. Every number the sandbox draws depends on a
slider (rain, interception, deaths, plantings), so this script ships the inputs
to the rule and never its answers:

  - each living tree's position, trunk diameter, the Queens species it is
    modelled as, and the census block it stands in
  - each planting site's position and block
  - the census blocks, as lon/lat polygons
  - the equations for the species that are used

The growth, the crowns and the stormwater are all worked out in the browser
(src/lib/sandboxes/street-trees/model.js), so this file and that one together
are the whole of the rule.

NO GEO STACK. The tree census carries both lon/lat and State Plane feet for
every tree, so the point-in-polygon join is done in State Plane feet, where the
block shapefile already is. Only the block outlines are reprojected, with the
Lambert conformal conic inverse below, and that inverse is checked against the
census's own lon/lat pairs before anything is written.

INPUTS  (data/original/, the Tutorial 4 data folder)
----------------------------------------------------
  2015_Street_Tree_Census_subset_um.csv
      The 2015 TreesCount! census, NYC Open Data uvpi-gqnh, clipped to upper
      Manhattan for the tutorials. 12,715 rows.
      TAKEN: status, tree_dbh, spc_latin, spc_common, address, latitude,
      longitude, x_sp, y_sp.
  nycb2010_um/nycb2010_um.shp + .dbf
      2010 census blocks, NYC Department of City Planning, clipped to the same
      area. 580 blocks, EPSG:2263 (NY Long Island State Plane, US feet).
      TAKEN: the polygons and BCTCB2010.
  queens_tree_equations.csv
      Urban Tree Database (McPherson, van Doorn and Peper 2016) Table S6,
      Northeast region (Queens, 2005), for 21 species.
      TAKEN: crown_diameter_from_dbh, age_from_dbh, dbh_from_age.

OUTPUTS  (data/processed/street-trees/)
---------------------------------------
  trees.json     columnar: lon, lat, dbh_in, sp, block, address, common
  sites.json     columnar: lon, lat, block, address, status
  blocks.json    GeoJSON FeatureCollection, lon/lat, one feature per block
                 with a tree or a site in it
  manifest.json  equations, species list, counts, bounds, sources

Run from the repo root:  python3 data/scripts/street-trees.py
"""

import csv
import json
import math
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _common import original_dir  # noqa: E402

OUT = Path("data/processed/street-trees")

# The three equations the run uses. The file has two more per species (height
# and dry weight) for the CO2 part of Tutorial 3, which this sandbox leaves out.
USED = ("crown_diameter_from_dbh", "age_from_dbh", "dbh_from_age")

# Tutorial 3, step 2: for a species that is not one of the 21, the most common
# Queens species of the same genus; anything else is modelled as a honeylocust.
SAME_GENUS = {
    "Acer": "ACRU", "Quercus": "QUPA", "Tilia": "TICO", "Ulmus": "ULAM",
    "Prunus": "PRSE2", "Malus": "MA2", "Fraxinus": "FRPE", "Pinus": "PIST",
}
FALLBACK = "GLTR"

# Over 60 inches is a data entry error (Tutorial 3, step 1). The subset has one,
# at 228 inches.
DBH_MAX_IN = 60


# --------------------------------------------------------------------------- #
# EPSG:2263 -> lon/lat. Lambert conformal conic, two standard parallels, GRS80. #
# --------------------------------------------------------------------------- #
FT = 0.304800609601219  # US survey foot
A = 6378137.0
F = 1 / 298.257222101
E = math.sqrt(2 * F - F * F)
LAT1, LAT2 = math.radians(41 + 2 / 60), math.radians(40 + 40 / 60)
LAT0, LON0 = math.radians(40 + 10 / 60), math.radians(-74)
X0 = 984250.0 * FT


def _m(phi):
    return math.cos(phi) / math.sqrt(1 - (E * math.sin(phi)) ** 2)


def _t(phi):
    s = E * math.sin(phi)
    return math.tan(math.pi / 4 - phi / 2) / ((1 - s) / (1 + s)) ** (E / 2)


N = (math.log(_m(LAT1)) - math.log(_m(LAT2))) / (math.log(_t(LAT1)) - math.log(_t(LAT2)))
FF = _m(LAT1) / (N * _t(LAT1) ** N)
RHO0 = A * FF * _t(LAT0) ** N


def to_lonlat(x_ft, y_ft):
    x = x_ft * FT - X0
    y = RHO0 - y_ft * FT
    rho = math.copysign(math.hypot(x, y), N)
    t = (rho / (A * FF)) ** (1 / N)
    phi = math.pi / 2 - 2 * math.atan(t)
    for _ in range(8):
        s = E * math.sin(phi)
        phi = math.pi / 2 - 2 * math.atan(t * ((1 - s) / (1 + s)) ** (E / 2))
    lon = math.atan2(x, y) / N + LON0
    return math.degrees(lon), math.degrees(phi)


# --------------------------------------------------------------------------- #
# Shapefile polygons and DBF ids, read by hand.                                #
# --------------------------------------------------------------------------- #
def read_polygons(shp):
    """Yield a list of rings (lists of (x, y)) per record. Polygon type only."""
    buf = shp.read_bytes()
    pos = 100
    while pos < len(buf):
        _, length = struct.unpack(">ii", buf[pos:pos + 8])
        body = buf[pos + 8:pos + 8 + length * 2]
        pos += 8 + length * 2
        (kind,) = struct.unpack("<i", body[:4])
        if kind == 0:
            yield []
            continue
        if kind != 5:
            raise SystemExit(f"{shp.name}: shape type {kind}, expected polygons")
        n_parts, n_points = struct.unpack("<ii", body[36:44])
        parts = list(struct.unpack(f"<{n_parts}i", body[44:44 + 4 * n_parts]))
        off = 44 + 4 * n_parts
        pts = [struct.unpack("<2d", body[off + 16 * i:off + 16 * i + 16]) for i in range(n_points)]
        yield [pts[a:b] for a, b in zip(parts, parts[1:] + [n_points])]


def read_dbf_column(dbf, column):
    buf = dbf.read_bytes()
    n, header_len, record_len = struct.unpack("<IHH", buf[4:12])
    offset, found = 1, None
    for i in range((header_len - 33) // 32):
        fd = buf[32 + 32 * i:64 + 32 * i]
        name = fd[:11].split(b"\x00")[0].decode("latin-1")
        if name == column:
            found = (offset, fd[16])
        offset += fd[16]
    if not found:
        raise SystemExit(f"{dbf.name} has no column {column}")
    o, w = found
    return [
        buf[header_len + r * record_len + o:header_len + r * record_len + o + w].decode("latin-1").strip()
        for r in range(n)
    ]


def inside(x, y, rings):
    """Even-odd ray cast over every ring, so holes come out right."""
    hit = False
    for ring in rings:
        j = len(ring) - 1
        for i in range(len(ring)):
            xi, yi = ring[i]
            xj, yj = ring[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                hit = not hit
            j = i
    return hit


def seg_dist2(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = 0 if dx == dy == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2


def main():
    src = original_dir()
    census = src / "2015_Street_Tree_Census_subset_um.csv"
    shp = src / "nycb2010_um" / "nycb2010_um.shp"
    dbf = src / "nycb2010_um" / "nycb2010_um.dbf"
    eq_csv = src / "queens_tree_equations.csv"
    for p in (census, shp, dbf, eq_csv):
        if not p.exists():
            raise SystemExit(f"missing {p} - see data/original/README.md")

    # ---- equations ----------------------------------------------------------
    equations, names = {}, {}
    with eq_csv.open(newline="", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            names[r["scientific_name"]] = r["SpCode"]
            if r["predicts"] not in USED:
                continue
            num = lambda k: float(r[k]) if r[k] else None  # noqa: E731
            equations.setdefault(r["SpCode"], {"latin": r["scientific_name"], "common": r["common_name"]})
            equations[r["SpCode"]][r["predicts"]] = {
                "form": r["form"], "a": num("a"), "b": num("b"), "c": num("c"), "d": num("d"),
                "x_max": num("x_max"),
            }
    forms = {e["form"] for sp in equations.values() for k, e in sp.items() if k in USED}
    known = {"lin", "quad", "cub", "loglogw1", "loglogw2", "expow1"}
    if forms - known:
        raise SystemExit(f"equation forms the browser cannot evaluate: {forms - known}")

    def match(latin):
        if not latin:
            return FALLBACK
        if latin in names:
            return names[latin]
        first_two = " ".join(latin.split()[:2])
        if first_two in names:
            return names[first_two]
        return SAME_GENUS.get(latin.split()[0], FALLBACK)

    # ---- blocks -------------------------------------------------------------
    ids = read_dbf_column(dbf, "BCTCB2010")
    polys = list(read_polygons(shp))
    assert len(ids) == len(polys), "shp and dbf disagree on record count"
    bbox = []
    for rings in polys:
        xs = [x for r in rings for x, _ in r]
        ys = [y for r in rings for _, y in r]
        bbox.append((min(xs), min(ys), max(xs), max(ys)) if xs else None)

    def block_of(x, y):
        for i, b in enumerate(bbox):
            if b and b[0] <= x <= b[2] and b[1] <= y <= b[3] and inside(x, y, polys[i]):
                return i, 0.0
        # A tree that falls in no block - on a centerline, or just past the
        # edge of the clip - goes to the nearest one, and the distance is kept
        # so the manifest can say how far the worst one was moved.
        best, bd = None, float("inf")
        for i, rings in enumerate(polys):
            b = bbox[i]
            if not b or (max(b[0] - x, 0, x - b[2]) ** 2 + max(b[1] - y, 0, y - b[3]) ** 2) > bd:
                continue
            for ring in rings:
                for (ax, ay), (bx, by) in zip(ring, ring[1:]):
                    d = seg_dist2(x, y, ax, ay, bx, by)
                    if d < bd:
                        best, bd = i, d
        return best, math.sqrt(bd)

    # ---- trees and sites ----------------------------------------------------
    trees = {k: [] for k in ("lon", "lat", "dbh_in", "sp", "block", "address", "common")}
    sites = {k: [] for k in ("lon", "lat", "block", "address", "status")}
    dropped_dbh, moved, worst_move = 0, 0, 0.0
    proj_err = 0.0
    with census.open(newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        x, y = float(r["x_sp"]), float(r["y_sp"])
        lon, lat = float(r["longitude"]), float(r["latitude"])
        plon, plat = to_lonlat(x, y)
        proj_err = max(proj_err, abs(plon - lon) * 84_000, abs(plat - lat) * 111_000)
        b, dist = block_of(x, y)
        if dist > 0:
            moved += 1
            worst_move = max(worst_move, dist)
        address = r["address"].title()
        if r["status"] == "Alive":
            dbh = float(r["tree_dbh"])
            if dbh > DBH_MAX_IN or dbh <= 0:
                dropped_dbh += 1
                continue
            trees["lon"].append(round(lon, 6))
            trees["lat"].append(round(lat, 6))
            trees["dbh_in"].append(dbh)
            trees["sp"].append(match(r["spc_latin"]))
            trees["block"].append(b)
            trees["address"].append(address)
            trees["common"].append(r["spc_common"] or "unknown")
        else:
            sites["lon"].append(round(lon, 6))
            sites["lat"].append(round(lat, 6))
            sites["block"].append(b)
            sites["address"].append(address)
            sites["status"].append(r["status"])

    if proj_err > 2:
        raise SystemExit(f"the State Plane inverse is off by {proj_err:.1f} m against the census")

    # ---- renumber the blocks that are used, project their outlines -----------
    used = sorted(set(trees["block"]) | set(sites["block"]))
    renum = {old: new for new, old in enumerate(used)}
    trees["block"] = [renum[b] for b in trees["block"]]
    sites["block"] = [renum[b] for b in sites["block"]]
    features = []
    for old in used:
        rings = [[[round(v, 6) for v in to_lonlat(x, y)] for x, y in ring] for ring in polys[old]]
        features.append({
            "type": "Feature",
            "properties": {"i": renum[old], "id": ids[old]},
            "geometry": {"type": "Polygon", "coordinates": rings},
        })

    species = sorted(set(trees["sp"]))
    sp_index = {s: i for i, s in enumerate(species)}
    trees["sp"] = [sp_index[s] for s in trees["sp"]]

    lons = trees["lon"] + sites["lon"]
    lats = trees["lat"] + sites["lat"]

    manifest = {
        "sandbox": "street-trees",
        "years": [2015, 2045],
        "species": [{"code": s, **equations[s]} for s in species],
        "fallback": FALLBACK,
        "counts": {
            "rows": len(rows),
            "trees": len(trees["lon"]),
            "dropped_dbh": dropped_dbh,
            "sites": len(sites["lon"]),
            "sites_dead": sites["status"].count("Dead"),
            "sites_stump": sites["status"].count("Stump"),
            "blocks": len(features),
            "moved_to_nearest_block": moved,
            "worst_move_ft": round(worst_move, 1),
        },
        "projection_check_m": round(proj_err, 3),
        "bounds": [min(lons), min(lats), max(lons), max(lats)],
        "sources": {
            "census": "2015 Street Tree Census, NYC Parks, NYC Open Data uvpi-gqnh, upper Manhattan subset",
            "blocks": "2010 Census Blocks, NYC Department of City Planning, upper Manhattan subset",
            "equations": "Urban Tree Database, McPherson, van Doorn and Peper 2016, doi:10.2737/RDS-2016-0005, Table S6, Northeast (Queens, 2005)",
        },
    }

    OUT.mkdir(parents=True, exist_ok=True)
    dump = lambda name, obj: (OUT / name).write_text(json.dumps(obj, separators=(",", ":")))  # noqa: E731
    dump("trees.json", trees)
    dump("sites.json", sites)
    dump("blocks.json", {"type": "FeatureCollection", "features": features})
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))

    c = manifest["counts"]
    print(f"{c['trees']:,} trees ({c['dropped_dbh']} dropped for diameter), "
          f"{c['sites']} planting sites, {c['blocks']} blocks")
    print(f"{moved} points outside every block, moved at most {worst_move:.0f} ft")
    print(f"projection checked against the census: worst {proj_err:.2f} m")
    print(f"species used: {', '.join(species)}")


if __name__ == "__main__":
    main()
