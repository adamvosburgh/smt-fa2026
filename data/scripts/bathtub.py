#!/usr/bin/env python3
"""
bathtub.py - processing pipeline for Sandbox 07, Bathtub.

WHAT THE MODEL IS
-----------------
A bathtub flood model is a threshold plus a connectivity test. A cell is
"flooded" if the waterline is above the ground. That is the whole model, and it
is - modified with a connectivity step and a spatially varying tidal surface -
what NOAA's Sea Level Rise Viewer publishes, so it is worth being precise about.

WHAT THIS SCRIPT IS FOR
-----------------------
Not compression. The processed files are smaller than the originals, but the
reason they exist is that they are RESHAPED, so that the browser does a
comparison instead of a computation.

The clearest case is `spill.png`. A naive bathtub can be drawn straight from a
DEM: flooded = elevation <= waterline. Adding hydraulic connectivity normally
means re-running a connected-components pass every time the slider moves, which
no browser is going to do sixty times a second over 33 million cells. So we run
it once, here, and store the answer per cell:

    the SPILL ELEVATION of a cell is the lowest waterline at which that cell
    becomes hydraulically connected to open water.

With that precomputed, connectivity also becomes one comparison:

    naive bathtub      flooded(i) = elevation[i] <= waterline
    with connectivity  flooded(i) = spill[i]     <= waterline

Both are a single threshold test in a fragment shader, so both the slider and
the connectivity toggle are instant, and there is no per-step payload at all.
The set of cells where `elevation <= waterline < spill` is exactly the inland
depressions that a naive bathtub floods and water cannot physically reach -
which is the argument the sandbox exists to make, and it falls out of the file
format for free.

Note what precomputing asserts: that connectivity is a static property of
terrain. In a real coastline it is not - culverts, tide gates, pumps and surge
barriers change the answer on a timescale of hours. The file format cannot
express that, so the sandbox cannot either. That belongs in the model card.

INPUTS  (data/original/, as downloaded, never edited in place)
-------------------------------------------------------------
  output_USGS10m.tif
      USGS 3DEP 1/3 arc-second DEM (~10m), clipped to the NYC bounding box.
      EPSG:4269, float32, meters above NAVD88, nodata -999999.
      TAKEN: one number per cell - ground elevation. Nothing else.

  BUILDING_20260830.geojson                                   [--scope full]
      NYC Building Footprints (Open Data). ~1.08M MultiPolygons.
      TAKEN per building: a representative point, `ground_elevation` and
      `height_roof` (both FEET, NAVD88 - converted to meters here),
      `base_bbl`, `bin`. The polygons themselves are NOT used: the basemap
      draws buildings, so we only need to count them.
      Using the recorded `ground_elevation` rather than sampling the DEM is
      deliberate - a 10m cell is larger than many row-house lots.

  nyc_mappluto_26v2_shp/MapPLUTO.dbf                          [--scope full]
      MapPLUTO. 856,687 records, 101 fields. Only the .dbf is read; the 141MB
      .shp geometry is never opened.
      TAKEN: two columns, `BBL` and `UnitsRes`, joined to footprints on BBL.

  acs_tracts.geojson                                          [optional]
      2020 Census Tracts, NYC Open Data 63ge-mke6, exported as GeoJSON.
      TAKEN: the tract polygon and its GEOID. Nothing else.

  tract population - any ONE of these shapes, found anywhere under original/:
      * DECENNIALDP2020.DP1-Data.csv   a data.census.gov table download.
        GEO_ID looks like "1400000US36005000100"; total population is
        DP1_0001C; the second line of the file is a label row, not data.
      * acs_tract_pop*.json            a Census API response, either one file
        or one per county. Total population is P1_001N (2020 decennial, exact)
        or B01003_001E (ACS 5-year, estimate).
      TAKEN: one number per tract. Joined to the geometry on GEOID.

      Population is reported AT TRACT RESOLUTION and never allocated down to
      individual buildings. Allocating it would be invented precision, which is
      the failure this course is about.

Two more inputs are not files and are already in the repo, hardcoded with their
citations in `scripts/build-data.js`:
  - NPCC4 sea level rise projections (NYC Open Data 38ps-fnsg, Braneon 2024)
  - Tidal datums at The Battery (NOAA CO-OPS station 8518750)

OUTPUTS (data/processed/bathtub/)
---------------------------------
  manifest.json     grid dimensions, bounds, encoding, provenance
  elev.png          ground elevation, 16-bit packed into R and G channels
  spill.png         spill elevation, same encoding, same grid
  buildings.bin     packed point table                        [--scope full]
  tracts.json       simplified tract polygons + population    [if input present]
  tractid.png       which tract each grid cell belongs to, 16-bit in R and G
                    (0 = no tract), so the browser can total population over
                    exactly the flooded cells instead of against a table of
                    precomputed waterline steps

Both PNGs are reprojected to EPSG:3857 so that a deck.gl BitmapLayer over a
Mercator basemap is pixel-correct without any per-frame reprojection.

Encoding: value_metres = ((R * 256 + G) - 1000) / 10, i.e. decimetres with a
+1000 offset so that below-sea-level ground fits in an unsigned channel pair.

USAGE
-----
Run from the repo root.

    pip install numpy rasterio pillow

    # everything
    python data/scripts/bathtub.py --scope full

    # DEM and tracts only; skips both large files entirely
    python data/scripts/bathtub.py --scope minimal

    # re-run one step after changing it (the DEM step is the slow one)
    python data/scripts/bathtub.py --scope full --steps buildings

    # smaller grid while iterating - divides both dimensions
    python data/scripts/bathtub.py --scope minimal --downsample 4

RUNTIME AND RESOLUTION, measured
--------------------------------
    --downsample 8   744 x 729     0.5M cells   ~2s    0.8MB of PNG
    --downsample 2  2979 x 2916    8.3M cells   ~64s   8.2MB of PNG
    --downsample 1  5952 x 5832   34.7M cells   ~5min  ~30MB of PNG

**--downsample 2 is the shipping setting.** 34MB of texture is too much to send
a browser, and 8MB is not.

Say that plainly rather than hiding it: the shipped grid is about 20m, derived
from a 10m source. The precision of the argument a student can make is set by
the precision of the file that shipped, and that belongs on the face of the
sandbox rather than in a footnote. It also means building-level claims are
already coarser than they look - which is why building flooding is decided from
the footprint's own recorded ground elevation and not from this grid.

The spill-elevation pass is a Priority-Flood over every cell and is the slow
part; use --downsample 8 while iterating on anything else. The building pass
streams the GeoJSON one feature per line and never holds it in memory - the full
1.08M features take well under a minute.
"""

import argparse
import csv
import json
import math
import struct
import sys
from pathlib import Path

import numpy as np

FT_TO_M = 0.3048
ENCODE_OFFSET = 1000  # decimetres, so -100.0m is the lowest representable value

# Anything connected to the sea at or below this counts as water that is already
# there rather than as new flooding. Set above the highest hydro-flattened water
# surface in the DEM (+0.10m over Jamaica Bay) and below the lowest real land
# anyone would care about.
WATER_SURFACE_M = 0.3


# Published constants the sandbox needs alongside the derived grid. They are
# not derived from anything in data/original - they are numbers somebody
# else published, and they carry their citation here rather than in a
# comment in the front end.
#
# NPCC4 (Braneon et al. 2024), NYC Open Data 38ps-fnsg. Meters above the
# NPCC4 baseline, converted from the published inches. Note what is absent:
# NPCC4 reports the 10th, 25th, 75th and 90th percentiles and NO median, so
# there is no single number to put on a map and every published sea level
# map has quietly chosen one of these four.
PUBLISHED = {
    "years": [2030, 2050, 2080, 2100, 2150],
    "projections": {
        "10": [0.152, 0.305, 0.533, 0.635, 0.965],
        "25": [0.178, 0.356, 0.635, 0.762, 1.194],
        "75": [0.279, 0.483, 0.991, 1.270, 2.261],
        "90": [0.330, 0.584, 1.143, 1.651, 4.496],
    },
    # Tidal datums at The Battery (NOAA CO-OPS station 8518750, 1983-2001
    # epoch, accepted 19 Nov 2012), as meters relative to NAVD88 - derived
    # EXACTLY from the station's machine-readable metric datums endpoint,
    # saved at data/original/noaa_datums_8518750_metric.json:
    #   api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/8518750/
    #   datums.json?units=metric
    # STND-referenced values there: NAVD88 1.848, MHHW 2.543, MSL 1.785,
    # MLLW 1.002; each datum minus NAVD88 gives the offsets below. The old
    # values were taken in feet and rounded before conversion, which put MSL
    # and MLLW 2mm off; 2mm is far below the DEM's noise floor, but a number
    # that can be derived exactly should not be carried approximately.
    # read_datums() checks these against the saved file on every run.
    # One station applied across the whole grid. NOAA's own mapping uses a
    # spatially varying tidal surface instead; that gap goes in the model card.
    "tideOffsetsM": {"mllw": -0.846, "msl": -0.063, "mhhw": 0.695},
    "tideEpoch": "1983-2001, accepted 19 Nov 2012",

    # NOAA Sea Level Trends and Extremes, same station, Extreme High Water
    # Levels read 2026-09-04 for OCTOBER 2025 (the product's stated data
    # month, recorded in exceedanceMonth below). This is the successor to the
    # annual-exceedance product that retires 30 September 2026, and it
    # publishes the same four levels - there is no 2% and no 0.2%.
    #
    # Published in feet above MHHW; converted with the exact +0.695m MHHW
    # offset above:
    #     99% (1yr)   2.02 ft -> 0.616 m -> 1.311 m NAVD88
    #     50% (2yr)   2.82 ft -> 0.860 m -> 1.555 m NAVD88
    #     10% (10yr)  3.93 ft -> 1.198 m -> 1.893 m NAVD88
    #      1% (100yr) 5.96 ft -> 1.817 m -> 2.512 m NAVD88
    #
    # AN AEP LEVEL IS A FUNCTION OF DATE, not a constant - the product states
    # that the lines move with the average linear change of mean sea level,
    # which is why the month is recorded beside the values. The previous
    # manifest carried a second set exactly 0.100m higher labelled 2026; that
    # round number read as applied rather than read off the product, and the
    # two sets implied an MHHW offset 12mm away from the one three keys over.
    # One dated set replaces both, and main() removes the stale key from any
    # manifest it merges into.
    #
    # The product also publishes a LOW-water AEP series. Bathtub is about
    # flooding and ignores it; the card says so rather than leaving a reader
    # wondering which half was used.
    #
    # WHAT THESE ARE, which decides how the front end may use them. They are
    # still-water levels fitted to ANNUAL MAXIMA. An annual maximum happens at
    # high tide, so the tide is already inside the number - which is why the
    # sandbox substitutes an AEP level for the tide offset rather than adding
    # one to the other. They are also not FEMA base flood elevations: no wave
    # effects, so they come out lower.
    "exceedanceM": {"99": 1.311, "50": 1.555, "10": 1.893, "1": 2.512},
    "exceedanceMonth": "2025-10",
}


def read_datums(original):
    """Check the tide offsets against the saved NOAA metric datums file.

    The constants above are hand-carried so the pipeline runs offline; this
    re-derives them from the machine-readable record whenever it is on disk
    and refuses to ship a manifest that disagrees with it by more than 1mm.
    """
    path = original / "noaa_datums_8518750_metric.json"
    if not path.exists():
        print("tides: noaa_datums_8518750_metric.json not on disk; "
              "constants carried unverified")
        return
    d = json.loads(path.read_text())
    vals = {x["name"]: x["value"] for x in d["datums"]}
    navd = vals["NAVD88"]
    derived = {"mllw": vals["MLLW"] - navd, "msl": vals["MSL"] - navd,
               "mhhw": vals["MHHW"] - navd}
    for k, v in derived.items():
        carried = PUBLISHED["tideOffsetsM"][k]
        assert abs(v - carried) < 0.0015, (
            f"tideOffsetsM[{k}] = {carried} but the datums file derives "
            f"{v:.3f}; update the constant")
    print(f"tides: offsets verified against the saved datums file "
          f"(epoch {d['epoch']}, accepted {d['accepted']})")


# --------------------------------------------------------------------------
# step 1 - the ground, and the spill elevation derived from it
# --------------------------------------------------------------------------

def priority_flood(elev, valid):
    """Spill elevation per cell.

    For every cell, the lowest waterline at which a continuous below-waterline
    path exists from that cell to open water. Equivalently: the minimum, over
    all paths to the sea, of the highest elevation along that path.

    Standard Priority-Flood (Barnes, Lehman & Mulla 2014), which is the usual
    depression-filling algorithm - we are using its intermediate result rather
    than its output. Seeded from cells that are actually open water (nodata, or
    below the lowest tidal datum at the grid edge), not from the raster edge as
    such: seeding from the edge would let the map's own corners act as ocean.
    """
    import heapq

    h, w = elev.shape
    spill = np.full((h, w), np.inf, dtype=np.float32)
    done = np.zeros((h, w), dtype=bool)
    heap = []

    # Open water: anything invalid (the DEM's nodata over ocean), plus any valid
    # cell on the grid boundary that is at or below mean lower low water.
    seed = ~valid
    edge = np.zeros((h, w), dtype=bool)
    edge[0, :] = edge[-1, :] = edge[:, 0] = edge[:, -1] = True
    seed |= edge & valid & (elev <= -0.85)

    ys, xs = np.nonzero(seed)
    for y, x in zip(ys.tolist(), xs.tolist()):
        e = float(elev[y, x]) if valid[y, x] else -100.0
        spill[y, x] = e
        heapq.heappush(heap, (e, y, x))

    if not heap:
        raise SystemExit(
            "no open-water seed cells found - check the DEM's nodata value and "
            "that the bounding box actually reaches the coast"
        )

    push, pop = heapq.heappush, heapq.heappop
    while heap:
        key, y, x = pop(heap)
        if done[y, x]:
            continue
        done[y, x] = True
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if ny < 0 or nx < 0 or ny >= h or nx >= w or done[ny, nx]:
                continue
            e = float(elev[ny, nx]) if valid[ny, nx] else -100.0
            s = key if key > e else e
            if s < spill[ny, nx]:
                spill[ny, nx] = s
                push(heap, (s, ny, nx))

    spill[~np.isfinite(spill)] = 9999.0
    return spill


def encode_png(values_m, path, blue=None):
    """16-bit decimetres packed into the R and G channels of an RGB PNG.

    A browser decodes a 16-bit greyscale PNG down to 8 bits, so the value is
    split by hand: R is the high byte, G the low byte, and the shader
    reconstructs it. B is spare, and elev.png uses it for the water mask.
    """
    from PIL import Image

    q = np.clip(np.round(values_m * 10.0) + ENCODE_OFFSET, 0, 65535).astype(np.uint16)
    h, w = q.shape
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    rgb[:, :, 0] = (q >> 8).astype(np.uint8)
    rgb[:, :, 1] = (q & 0xFF).astype(np.uint8)
    if blue is not None:
        rgb[:, :, 2] = blue
    Image.fromarray(rgb, mode="RGB").save(path, optimize=True)
    return path.stat().st_size


def step_dem(args, out, state):
    import rasterio
    from rasterio.warp import calculate_default_transform, reproject, Resampling

    src_path = args.original / "output_USGS10m.tif"
    print(f"dem: reading {src_path.name}")
    with rasterio.open(src_path) as src:
        dst_crs = "EPSG:3857"
        transform, width, height = calculate_default_transform(
            src.crs, dst_crs, src.width, src.height, *src.bounds
        )
        if args.downsample > 1:
            width //= args.downsample
            height //= args.downsample
            transform, width, height = calculate_default_transform(
                src.crs, dst_crs, src.width, src.height, *src.bounds,
                dst_width=width, dst_height=height,
            )
        nodata = src.nodata if src.nodata is not None else -999999.0
        dst = np.full((height, width), nodata, dtype=np.float32)
        print(f"dem: reprojecting to {dst_crs} at {width} x {height}")
        reproject(
            source=rasterio.band(src, 1), destination=dst,
            src_transform=src.transform, src_crs=src.crs,
            dst_transform=transform, dst_crs=dst_crs,
            src_nodata=nodata, dst_nodata=nodata,
            resampling=Resampling.bilinear,
        )
        west, north = transform * (0, 0)
        east, south = transform * (width, height)

    valid = dst != nodata
    elev = np.where(valid, dst, -100.0).astype(np.float32)
    print(f"dem: {int(valid.sum()):,} valid cells, "
          f"{float(elev[valid].min()):.1f} to {float(elev[valid].max()):.1f} m")

    print("dem: computing spill elevation (this is the slow step)")
    spill = priority_flood(elev, valid)

    # WHERE THE WATER ALREADY IS.
    #
    # This cannot be inferred by comparing elevation against a tidal datum,
    # because 3DEP hydro-flattens each water body to its own constant and those
    # constants disagree: sampled over New York, Jamaica Bay sits at +0.10m, the
    # Atlantic at 0.00m, the Hudson at -1.30m and Upper New York Bay at -1.62m.
    # Compare against Mean Lower Low Water (-0.84m) and Jamaica Bay "floods".
    #
    # So water is detected once, here, and stored per cell: anything connected
    # to the sea at or below WATER_SURFACE_M. It rides in the spare blue channel
    # of elev.png, which costs nothing.
    water = ((spill <= WATER_SURFACE_M) & valid).astype(np.uint8) * 255
    print(f"dem: {int((water > 0).sum()):,} cells are existing water "
          f"(connected to the sea at or below {WATER_SURFACE_M}m)")

    b_elev = encode_png(elev, out / "elev.png", blue=water)
    b_spill = encode_png(spill, out / "spill.png")
    print(f"dem: elev.png {b_elev/1e6:.1f}MB, spill.png {b_spill/1e6:.1f}MB")

    at1m = int(((elev <= 1.0) & (spill > 1.0) & valid).sum())
    print(f"dem: at a 1.0m waterline, {at1m:,} cells flood naively but are "
          f"not hydraulically connected")

    return {
        "grid": {"width": int(width), "height": int(height),
                 "crs": "EPSG:3857", "order": "row-major, y down"},
        "bounds3857": [float(west), float(south), float(east), float(north)],
        "waterSurfaceM": WATER_SURFACE_M,
        "encoding": {"channels": "RG", "unit": "decimetres",
                     "offset": ENCODE_OFFSET,
                     "formula": "meters = ((R * 256 + G) - 1000) / 10"},
        "layers": {
            "elev": {"file": "elev.png", "bytes": b_elev,
                     "description": "ground elevation, meters NAVD88"},
            "spill": {"file": "spill.png", "bytes": b_spill,
                      "description": "lowest waterline at which the cell connects to open water"},
        },
    }


# --------------------------------------------------------------------------
# step 2 - buildings, and the one PLUTO column joined onto them
# --------------------------------------------------------------------------

def read_pluto_unitsres(dbf_path):
    """Read BBL and UnitsRes out of a DBF without a geo stack.

    A DBF is fixed-width records after a fixed-length header, so the two columns
    can be sliced by byte offset. The 141MB .shp alongside is never opened - we
    only want a number per lot, and the footprints already carry the geometry.
    """
    with open(dbf_path, "rb") as f:
        header = f.read(32)
        n_records, header_len, record_len = struct.unpack("<IHH", header[4:12])
        offset, cols = 1, {}
        for _ in range((header_len - 33) // 32):
            fd = f.read(32)
            if fd[:1] == b"\x0d":
                break
            name = fd[:11].split(b"\x00")[0].decode("latin-1")
            length = fd[16]
            cols[name.lower()] = (offset, length)
            offset += length

        for needed in ("bbl", "unitsres"):
            if needed not in cols:
                raise SystemExit(f"MapPLUTO.dbf has no {needed} column")
        (bbl_off, bbl_len), (ur_off, ur_len) = cols["bbl"], cols["unitsres"]

        units = {}
        f.seek(header_len)
        for _ in range(n_records):
            rec = f.read(record_len)
            if len(rec) < record_len:
                break
            try:
                bbl = int(float(rec[bbl_off:bbl_off + bbl_len]))
                ur = rec[ur_off:ur_off + ur_len].strip()
                units[bbl] = int(ur) if ur else 0
            except ValueError:
                continue
    print(f"pluto: {len(units):,} lots with a UnitsRes value")
    return units


def step_buildings(args, out, state):
    """Stream the footprints and write a packed point table.

    Never holds the 962MB file in memory: NYC's GeoJSON export puts one feature
    per line, so it is read a line at a time. The polygon is reduced to a single
    representative point - the basemap draws the buildings, we only count them.
    """
    src = args.original / "BUILDING_20260830.geojson"
    units = read_pluto_unitsres(args.original / "nyc_mappluto_26v2_shp" / "MapPLUTO.dbf")

    # A building far above any waterline this model can produce cannot flood,
    # so it does not need shipping. The ceiling is sea level rise (max 5m) plus
    # surge (max 4m) plus the highest tidal datum (0.7m); --keep-below adds
    # headroom on top of that. This is the whole payload story for this sandbox.
    keep_below = args.keep_below

    # UnitsRes is a property of the LOT, not of a building. Several footprints
    # can share one BBL, so attributing the lot's units to each of them
    # multiplies the city's housing stock several times over. Instead we count
    # how many buildings sit on each lot - including ones dropped by the
    # elevation filter, since they still occupy the lot - and divide.
    from collections import Counter
    buildings_per_bbl = Counter()

    lons, lats, ground, height, bbls = [], [], [], [], []
    skipped = above = 0
    with open(src, "r") as f:
        for line in f:
            line = line.strip().rstrip(",")
            if not line.startswith('{"type":"Feature"'):
                continue
            try:
                feat = json.loads(line)
                p = feat["properties"]
                ge = p.get("ground_elevation")
                if ge is None:
                    skipped += 1
                    continue
                # Representative point: centroid of the first ring's vertices.
                bbl = p.get("base_bbl") or p.get("mappluto_bbl")
                bbl = int(bbl) if bbl else 0
                buildings_per_bbl[bbl] += 1
                g_m = float(ge) * FT_TO_M
                if g_m > keep_below:
                    above += 1
                    continue
                ring = feat["geometry"]["coordinates"][0][0]
                xs = [c[0] for c in ring]
                ys = [c[1] for c in ring]
                lons.append(sum(xs) / len(xs))
                lats.append(sum(ys) / len(ys))
                ground.append(g_m)
                height.append(float(p.get("height_roof") or 0) * FT_TO_M)
                bbls.append(bbl)
            except (ValueError, KeyError, IndexError, TypeError):
                skipped += 1

    n = len(lons)
    print(f"buildings: {n:,} kept, {above:,} dropped as above {keep_below}m "
          f"(they cannot flood at any setting), {skipped:,} unparseable")

    share = np.array([units.get(b, 0) / buildings_per_bbl[b] for b in bbls],
                     dtype=np.float32)

    arr = np.empty((n, 5), dtype=np.float32)
    arr[:, 0] = lons
    arr[:, 1] = lats
    arr[:, 2] = ground
    arr[:, 3] = height
    arr[:, 4] = share

    (out / "buildings.bin").write_bytes(arr.tobytes())
    size = (out / "buildings.bin").stat().st_size
    print(f"buildings: buildings.bin {size/1e6:.1f}MB "
          f"({share.sum():,.0f} residential units on the buildings kept; "
          f"{sum(units.values()):,} in PLUTO citywide)")

    return {"buildings": {
        "file": "buildings.bin", "count": n, "bytes": size,
        "layout": "float32[n][5] = lon, lat, ground_m, height_m, units",
        "units_note": "UnitsRes is a lot-level figure, divided evenly among the "
                      "buildings on that lot. Summing over flooded buildings "
                      "therefore approximates the lot total rather than "
                      "multiplying it.",
        "keep_below_m": keep_below,
        "dropped_above_threshold": above,
        "note": "ground_m is the footprint's own recorded ground_elevation, "
                "converted from feet - not sampled from the DEM",
    }}


# --------------------------------------------------------------------------
# step 3 - tracts (population lives here, and stays here)
# --------------------------------------------------------------------------

def _read_population(original):
    """Tract population, from whichever export shape is present.

    Two are supported because the Census offers two and neither is obviously
    the right one to use: a data.census.gov table download (CSV), and a Census
    API response (JSON). Returns {11-digit GEOID: population}.
    """
    pop, src = {}, None

    # --- data.census.gov table download -----------------------------------
    for path in sorted(original.rglob("*-Data.csv")):
        with open(path, encoding="utf-8-sig", newline="") as f:
            rows = csv.reader(f)
            header = next(rows)
            if "GEO_ID" not in header:
                continue
            col = next((c for c in ("DP1_0001C", "P1_001N", "B01003_001E")
                        if c in header), None)
            if col is None:
                print(f"tracts: {path.name} has no total-population column - skipping")
                continue
            i_geo, i_val = header.index("GEO_ID"), header.index(col)
            n = 0
            for r in rows:
                # data.census.gov puts a human-readable label row directly
                # under the header. It has no "...US..." geography id.
                if "US" not in r[i_geo]:
                    continue
                geoid = r[i_geo].split("US")[-1]
                if len(geoid) != 11:
                    continue
                try:
                    pop[geoid] = int(r[i_val])
                    n += 1
                except (TypeError, ValueError):
                    continue
            src = f"{path.name}, column {col}"
            print(f"tracts: {n:,} tract populations from {path.name} ({col})")

    if pop:
        return pop, src

    # --- Census API response ----------------------------------------------
    files = sorted(original.rglob("acs_tract_pop*.json"))
    if not files:
        return {}, None

    variable = None
    for path in files:
        rows = json.loads(path.read_text())
        header, body = rows[0], rows[1:]
        col = next((c for c in ("P1_001N", "B01003_001E") if c in header), None)
        if col is None:
            print(f"tracts: {path.name} has no population column "
                  f"(looked for P1_001N or B01003_001E) - skipping")
            continue
        variable = variable or col
        i_val = header.index(col)
        i_st, i_co, i_tr = (header.index(k) for k in ("state", "county", "tract"))
        for r in body:
            geoid = f"{r[i_st]:0>2}{r[i_co]:0>3}{r[i_tr]:0>6}"
            try:
                pop[geoid] = int(r[i_val])
            except (TypeError, ValueError):
                pop[geoid] = 0

    src = ("2020 decennial P1_001N (exact count)" if variable == "P1_001N"
           else "ACS 5-year B01003_001E (estimate)")
    print(f"tracts: {len(pop):,} tract populations from {len(files)} file(s) - {src}")
    return pop, src


def _rdp(points, eps):
    """Ramer-Douglas-Peucker, iterative so a long ring cannot blow the stack."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        i0, i1 = stack.pop()
        ax, ay = points[i0]
        bx, by = points[i1]
        dx, dy = bx - ax, by - ay
        denom = math.hypot(dx, dy)
        best, best_d = -1, eps
        for i in range(i0 + 1, i1):
            px, py = points[i]
            if denom == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                d = abs(dy * px - dx * py + bx * ay - by * ax) / denom
            if d > best_d:
                best, best_d = i, d
        if best != -1:
            keep[best] = True
            stack.append((i0, best))
            stack.append((best, i1))
    return [pt for pt, k in zip(points, keep) if k]


def _simplify_geometry(geom, eps, ndigits):
    """Thin and round a tract outline.

    Tract boundaries are shipped at 14 decimal places by the source - about a
    millimetre, against a flood grid of about twenty meters. Both the thinning
    and the rounding are chosen to sit just under the grid, so nothing the
    sandbox can actually resolve is lost.
    """
    if geom is None:
        return None

    def ring(r):
        out = _rdp([tuple(c[:2]) for c in r], eps)
        if len(out) < 4:
            out = [tuple(c[:2]) for c in r]
        return [[round(x, ndigits), round(y, ndigits)] for x, y in out]

    if geom["type"] == "Polygon":
        return {"type": "Polygon", "coordinates": [ring(r) for r in geom["coordinates"]]}
    if geom["type"] == "MultiPolygon":
        return {"type": "MultiPolygon",
                "coordinates": [[ring(r) for r in poly] for poly in geom["coordinates"]]}
    return geom


def _mercator(lon, lat):
    """EPSG:4326 -> EPSG:3857, so tracts land on the same grid as the DEM."""
    R = 6378137.0
    x = R * math.radians(lon)
    y = R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return x, y


def _rasterize_tracts(features, out, grid, bounds):
    """Burn tract polygons onto the DEM grid, one 16-bit index per cell.

    The alternative is shipping a table of population-affected-at-each-waterline,
    which quantises the slider. This keeps the slider continuous: the browser
    runs one pass over the cells, totals flooded cells per tract index, and
    multiplies by that tract's population. Costs one more texture and buys exact
    numbers at any waterline.

    Index 0 means "no tract", so feature i is stored as i + 1.
    """
    from PIL import Image, ImageDraw

    w, h = grid["width"], grid["height"]
    west, south, east, north = bounds
    sx = w / (east - west)
    sy = h / (north - south)

    img = Image.new("I", (w, h), 0)
    draw = ImageDraw.Draw(img)
    for i, f in enumerate(features):
        g = f.get("geometry")
        if not g:
            continue
        polys = ([g["coordinates"]] if g["type"] == "Polygon"
                 else g["coordinates"])
        for poly in polys:
            ring = poly[0]
            pts = []
            for lon, lat in ring:
                mx, my = _mercator(lon, lat)
                pts.append(((mx - west) * sx, (north - my) * sy))
            if len(pts) >= 3:
                draw.polygon(pts, fill=i + 1)

    a = np.asarray(img).astype(np.uint16)
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    rgb[:, :, 0] = (a >> 8).astype(np.uint8)
    rgb[:, :, 1] = (a & 0xFF).astype(np.uint8)
    path = out / "tractid.png"
    Image.fromarray(rgb, mode="RGB").save(path, optimize=True)
    covered = int((a > 0).sum())
    print(f"tracts: tractid.png {path.stat().st_size/1e6:.1f}MB, "
          f"{covered:,} cells inside a tract")
    return path.stat().st_size, covered


def step_tracts(args, out, state):
    """Tract polygons plus one population number each.

    Population stops here. It is reported at the resolution it is published at
    and is never pushed down onto buildings - a tract count divided among lots
    by unit share would look far more precise than anything anyone measured.
    """
    geom_path = next(iter(sorted(args.original.glob("*ensus_Tracts*.geojson"))
                           + sorted(args.original.glob("acs_tracts.geojson"))), None)
    if geom_path is None:
        print("tracts: no tract geometry found (looked for *Census_Tracts*.geojson "
              "or acs_tracts.geojson) - skipping.")
        return {}

    data = json.loads(geom_path.read_text())
    features = data.get("features", [])
    pop, src = _read_population(args.original)

    # NYC Open Data spells the tract id differently across exports. Prefer a
    # real 11-digit federal GEOID; otherwise reconstruct one from DCP's
    # BoroCT2020, which is a borough digit followed by the six-digit tract and
    # will not match the Census API on its own.
    BORO_FIPS = {"1": "061", "2": "005", "3": "047", "4": "081", "5": "085"}

    def geoid_of(props):
        for k in ("geoid", "GEOID", "geoid20", "GEOID20"):
            v = props.get(k)
            if v and len(str(v)) == 11:
                return str(v)
        for k in ("boroct2020", "BoroCT2020", "boroct2010", "BoroCT2010"):
            v = str(props.get(k) or "")
            if len(v) == 7 and v[0] in BORO_FIPS:
                return f"36{BORO_FIPS[v[0]]}{v[1:]}"
        for k in ("ct2020", "CT2020"):
            v = str(props.get(k) or "")
            boro = str(props.get("borocode") or props.get("BoroCode") or "")
            if v and boro in BORO_FIPS:
                return f"36{BORO_FIPS[boro]}{v.zfill(6)}"
        return None

    matched = 0
    out_features = []
    for f in features:
        props = f.get("properties", {})
        geoid = geoid_of(props)
        p = pop.get(geoid)
        if p is not None:
            matched += 1
        out_features.append({
            "type": "Feature",
            "geometry": _simplify_geometry(f.get("geometry"),
                                           args.simplify, args.round),
            "properties": {"geoid": geoid, "pop": p if p is not None else 0},
        })

    if pop and matched == 0:
        sample = features[0].get("properties", {}) if features else {}
        print("tracts: WARNING - no GEOIDs matched between the geometry and the "
              "population file. The geometry's property names are:")
        print("        " + ", ".join(sorted(sample)[:20]))
    else:
        print(f"tracts: {matched:,} of {len(features):,} tracts matched a population")

    path = out / "tracts.json"
    path.write_text(json.dumps({"type": "FeatureCollection",
                                "features": out_features},
                               separators=(",", ":")))
    size = path.stat().st_size
    print(f"tracts: tracts.json {size/1e6:.1f}MB")

    # The index raster needs the DEM's grid. Take it from this run if the dem
    # step already ran, otherwise from a manifest a previous run left behind.
    raster = {}
    grid, bounds = state.get("grid"), state.get("bounds3857")
    if not (grid and bounds):
        dem_manifest = out / "manifest.json"
        if dem_manifest.exists():
            prev = json.loads(dem_manifest.read_text())
            grid, bounds = prev.get("grid"), prev.get("bounds3857")
    if grid and bounds:
        rsize, covered = _rasterize_tracts(out_features, out, grid, bounds)
        raster = {"tractid": {"file": "tractid.png", "bytes": rsize,
                              "cells_in_a_tract": covered,
                              "encoding": "index = R * 256 + G; 0 means no tract",
                              "note": "feature i of tracts.json is stored as i + 1"}}
    else:
        print("tracts: no DEM grid in manifest yet - run the dem step first "
              "for tractid.png")

    return {**raster, "tracts": {
        "file": "tracts.json", "count": len(out_features),
        "matched": matched, "bytes": size,
        "source": src or "geometry only, no population file present",
        "note": "population is reported at tract resolution and never "
                "allocated to individual buildings",
    }}


# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--scope", choices=["full", "minimal"], default="full",
                    help="minimal skips buildings and PLUTO entirely")
    ap.add_argument("--steps", nargs="*", default=None,
                    choices=["dem", "buildings", "tracts", "none"],
                    help="run only these steps; 'none' updates the manifest's "
                         "published constants without touching the grids")
    ap.add_argument("--simplify", type=float, default=0.0001, metavar="DEG",
                    help="Douglas-Peucker tolerance for tract outlines, in "
                         "degrees. 0.0001 is about 11m, just under the grid.")
    ap.add_argument("--round", type=int, default=5, metavar="N",
                    help="decimal places kept on tract coordinates")
    ap.add_argument("--keep-below", type=float, default=12.0, metavar="M",
                    help="drop buildings whose ground elevation is above this "
                         "many meters; they cannot flood at any setting")
    ap.add_argument("--downsample", type=int, default=1,
                    help="divide both grid dimensions; use while iterating")
    ap.add_argument("--original", type=Path, default=Path("data/original"))
    ap.add_argument("--out", type=Path, default=Path("data/processed/bathtub"))
    args = ap.parse_args()

    if not args.original.exists():
        raise SystemExit(f"{args.original} not found - run from the repo root")
    args.out.mkdir(parents=True, exist_ok=True)

    steps = args.steps or (["dem", "buildings", "tracts"] if args.scope == "full"
                           else ["dem", "tracts"])

    # Merge into whatever a previous run left, so that running one step does not
    # discard the record of the others.
    manifest = {}
    existing = args.out / "manifest.json"
    if existing.exists():
        try:
            manifest = json.loads(existing.read_text())
        except ValueError:
            manifest = {}

    read_datums(args.original)
    # The 2026-vintage exceedance set is gone from PUBLISHED - see the note
    # there - and the merge would otherwise carry it forward silently.
    manifest.pop("exceedance2026M", None)
    manifest.update({
        **PUBLISHED,
        "sandbox": "bathtub",
        "scope": args.scope,
        "downsample": args.downsample,
        "sources": {
            "dem": "USGS 3DEP 1/3 arc-second (~10m), clipped to NYC. EPSG:4269, "
                   "meters NAVD88.",
            "sea_level": "NPCC4 (Braneon et al. 2024), NYC Open Data 38ps-fnsg. "
                         "10th/25th/75th/90th percentiles - no median is published.",
            "tides": "NOAA CO-OPS station 8518750 (The Battery), 1983-2001 epoch, "
                     "relative to NAVD88, from the mdapi metric datums endpoint.",
            "exceedance": "NOAA Sea Level Trends and Extremes "
                          "(tidesandcurrents.noaa.gov/trends-and-extremes/), "
                          "station 8518750, Extreme High Water Levels, read for "
                          "October 2025. Successor to the annual-exceedance "
                          "product retired 30 September 2026.",
        },
    })
    if "buildings" in steps:
        manifest["sources"]["buildings"] = "NYC Building Footprints; MapPLUTO UnitsRes joined on BBL."
    manifest["steps_last_run"] = sorted(steps)

    # Order matters: tracts needs the grid the dem step defines.
    order = {"dem": 0, "buildings": 1, "tracts": 2}
    for step in sorted((s for s in steps if s != "none"), key=lambda s: order[s]):
        manifest.update({"dem": step_dem, "buildings": step_buildings,
                         "tracts": step_tracts}[step](args, args.out, manifest))

    (args.out / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"\nwrote {args.out}/manifest.json")


if __name__ == "__main__":
    main()
