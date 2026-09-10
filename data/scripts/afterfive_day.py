"""
afterfive_day.py - the day, the sidewalk grid, and the district outlines.

A helper module of after-five.py, the same way afterfive_massing.py is: it is
imported and called from that pipeline's main(), not run on its own. Everything
here is what the 09-08 reframe needed when the agent layer came out and a
sidewalk heat map went in.

  reads   the buildings and footprints after-five.py has just built
          data/original/atusact-0325.zip            ATUS activity file
          data/original/atusresp-0325.zip           ATUS respondent file
          data/original/community_districts.geojson NYC Open Data 5crt-au7u
          data/original/nyc_street_centerline_cscl.geojson  NYC Open Data
                                                    inkn-q76z, for the street
                                                    mask

  writes  day.json        two hourly curves: workers (MTA) and residents (ATUS)
          grid.json       the grid header and the CSR index of building weights
          sidewalk.bin    Uint8, one byte per cell, 1 where a cell is sidewalk
          cells.bin       Uint32 cell ids
          weights.bin     Float32 CSR values
          districts.json  the two community district outlines, simplified

and returns the manifest fragments after-five.py merges into its own manifest.
"""

import io
import csv
import json
import zipfile
from pathlib import Path

import numpy as np
from pyproj import Transformer

CELL_M = 10.0          # the doc's 10 m cells
REACH_M = 50.0         # how far a building's people spread onto the sidewalk
SIGMA_M = 25.0         # the falloff, exp(-d^2 / (2 * 25^2))
# How wide a band around a street centerline counts as sidewalk. A JUDGMENT,
# with no source: roughly a curb-to-building depth plus a lane on a side
# street, and still too narrow for a wide avenue like West Street. It is
# carried into the manifest so the card can cite it as ours.
#
# It was 12.0 until 2026-09-10. Widening it spreads each building's people over
# more pavement, which takes some heat out of the peaks. It does NOT reach the
# memorial plaza and nothing in this range would: the pool centers are 47-99 m
# from the nearest walkable centerline. The plaza is not street and stays
# outside the model's ground.
STREET_BUFFER_M = 15.0

# Walkable CSCL rw_type codes, from the dataset's documented field list:
# 1 Street, 3 Bridge, 5 Boardwalk, 6 Path/Trail, 7 Step Street, 10 Alley.
# Dropped: 2 Highway, 4 Tunnel, 8 Driveway, 9 Ramp, 12 Non-Physical,
# 13 U-turn, 14 Ferry Route. Segments marked non-pedestrian are dropped too.
# THE FIELD IS A STRING. A set of integers matches nothing and produces an
# empty street layer without an error anywhere. Same set as
# after-five-agents.py used for its graph.
WALKABLE_RW = {"1", "3", "5", "6", "7", "10"}
# The two districts, by BoroCD in NYC Open Data 5crt-au7u.
DISTRICT_BOROCD = {"MN01": "101", "MN05": "105"}

# EPSG:2263 is the state plane the city publishes everything in, and it is in
# FEET - so a 10 m cell is 32.808 ft. The grid is built in meters and only
# converted at the edges, because every distance in the model is a metric one.
FT_PER_M = 1 / 0.3048


# --------------------------------------------------------------------------
# 1. The day: two hourly curves
# --------------------------------------------------------------------------

def worker_curve(flow):
    """Arrivals at and departures from the district's subway complexes.

    Already counted by after-five.py from the MTA's 2024 origin-destination
    estimate, October weekdays. Each is normalized to sum to 1 on its own, so a
    building's contribution in hour h is J_b * (arrivals[h] + departures[h]) -
    over the day that is two trips a worker, which is what a commute is.
    """
    arr = np.array(flow["districtArrivals"], dtype=np.float64)
    dep = np.array(flow["districtDepartures"], dtype=np.float64)
    arr = arr / arr.sum()
    dep = dep / dep.sum()
    return arr, dep


def _minutes(t):
    h, m, s = t.split(":")
    return int(h) * 60 + int(m)


def resident_curve(original):
    """The share of ALL respondents at home in each hour, and the flow it implies.

    §5.3 of the build doc, as written: the ATUS activity file, weights TUFNWGTP,
    TUYEAR 2020 dropped, weekdays only by TUDIARYDAY 2-6, the weighted share at
    home (TEWHERE = 1) in each hour of the diary day.

    Three things about the file decide the shape of this code.

    THE DIARY DAY RUNS 04:00 TO 04:00. Activity times are clock times, so no
    remapping of the minutes is needed; what the 4 am start means is that the
    first and last activities of a diary are the same night's sleep, and the
    curve wraps.

    PLACE IS NOT ALWAYS ASKED. TEWHERE is negative for sleeping, grooming and
    personal care, where the question is not put. Those minutes carry the last
    known state forward - a night's sleep after an evening at home is at home -
    and a diary that opens unknown takes its first known state backward, which
    is the same rule after-five-agents.py used for its own curves.

    TRAVEL IS NOT HOME. TEWHERE 12-21 and 99 are modes of travel. A person on a
    bus is away, which is what a curve of who is at home should say.

    The flow in hour h is |home[h+1] - home[h]|, normalized so the day's flows
    sum to 2: one departure and one return per person on average. That
    normalization is a choice and it is stated in the dev note - the raw curve
    does not sum to 2, because the survey's own transitions are smeared across
    a national sample of days.
    """
    eligible = {}
    dropped_2020 = dropped_weight = 0
    with zipfile.ZipFile(original / "atusresp-0325.zip") as z:
        with io.TextIOWrapper(z.open("atusresp_0325.dat"), encoding="ascii") as f:
            for r in csv.DictReader(f):
                if r["TUDIARYDAY"] not in ("2", "3", "4", "5", "6"):
                    continue
                if r.get("TUYEAR") == "2020":
                    dropped_2020 += 1
                    continue
                try:
                    w = float(r["TUFNWGTP"])
                except ValueError:
                    w = 0.0
                if w <= 0:
                    dropped_weight += 1
                    continue
                eligible[r["TUCASEID"]] = w

    # Activities, in file order, as (start minute, at-home / away / unknown).
    acts = {}
    with zipfile.ZipFile(original / "atusact-0325.zip") as z:
        with io.TextIOWrapper(z.open("atusact_0325.dat"), encoding="ascii") as f:
            for r in csv.DictReader(f):
                cid = r["TUCASEID"]
                if cid not in eligible:
                    continue
                try:
                    where = int(r["TEWHERE"])
                except ValueError:
                    where = -1
                state = 1 if where == 1 else (0 if where > 0 else -1)
                acts.setdefault(cid, []).append(
                    (_minutes(r["TUSTARTTIM"]), _minutes(r["TUSTOPTIME"]), state))

    hours = np.zeros(24)
    total = 0.0
    for cid, rows in acts.items():
        w = eligible[cid]
        # Carry the last known state forward, then the first known one backward.
        known = [s for _, _, s in rows if s >= 0]
        if not known:
            continue
        state = known[0]
        mask = np.zeros(1440, dtype=bool)
        for a, b, s in rows:
            if s >= 0:
                state = s
            if not state:
                continue
            # A diary activity may run past midnight into the next 4 am.
            spans = [(a, b)] if a <= b else [(a, 1440), (0, b)]
            for s0, s1 in spans:
                mask[s0:max(s0 + 1, s1)] = True
        # Minutes to hours of the clock, which is what the sandbox's timeline is.
        hours += w * mask.reshape(24, 60).mean(axis=1)
        total += w

    home = hours / total
    # |home[h+1] - home[h]| around the clock: what changes between one hour and
    # the next is what walked out of a door or in through one.
    raw = np.abs(np.roll(home, -1) - home)
    flow = raw * (2.0 / raw.sum()) if raw.sum() > 0 else raw

    print(f"atus: {len(eligible):,} weekday respondents "
          f"({dropped_2020:,} dropped for TUYEAR 2020, "
          f"{dropped_weight:,} for a missing TUFNWGTP)")
    print(f"atus: at home peaks {home.max():.3f} at "
          f"{int(home.argmax()):02d}:00, low {home.min():.3f} at "
          f"{int(home.argmin()):02d}:00")
    print("atus: home share by hour  " +
          " ".join(f"{v:.2f}" for v in home))
    print("atus: sidewalk flow       " +
          " ".join(f"{v:.2f}" for v in flow))
    return home, flow, {
        "respondents": len(eligible),
        "dropped_tuyear_2020": dropped_2020,
        "dropped_missing_weight": dropped_weight,
    }


# --------------------------------------------------------------------------
# 2. The sidewalk grid
# --------------------------------------------------------------------------

def point_in_ring(px, py, ring):
    """Ray casting. One ring, one point; used only to build the mask."""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > py) != (yj > py):
            if px < (xj - xi) * (py - yi) / (yj - yi + 1e-30) + xi:
                inside = not inside
        j = i
    return inside


def read_streets(original, ll_bounds):
    """The walkable street centerlines inside the grid, as lon/lat polylines.

    Same reader as after-five-agents.py's read_graph, for the same reason: the
    CSCL export is one 196MB line of JSON, so features are decoded one at a
    time with raw_decode rather than parsing the whole FeatureCollection. A
    line is kept if ANY of its vertices falls inside the grid's lon/lat box,
    which keeps the streets that run out of the district as well as the ones
    inside it.
    """
    src = original / "nyc_street_centerline_cscl.geojson"
    if not src.exists():
        print(f"streets: NOT FOUND - {src}. "
              f"Run data/scripts/fetch-sources-0904.sh.")
        return []
    w, s_, e, n = ll_bounds
    text = src.read_text()
    dec = json.JSONDecoder()
    pos = text.index("[") + 1
    lines = []
    seen = dropped_type = dropped_nonped = 0
    while True:
        while pos < len(text) and text[pos] in ", \n\r\t":
            pos += 1
        if pos >= len(text) or text[pos] == "]":
            break
        feat, pos = dec.raw_decode(text, pos)
        seen += 1
        props = feat.get("properties") or {}
        if props.get("rw_type") not in WALKABLE_RW:
            dropped_type += 1
            continue
        # The nonped flag marks vehicle-only segments; 'V' is the value the
        # field dictionary gives for them.
        if (props.get("nonped") or "").strip().upper() == "V":
            dropped_nonped += 1
            continue
        geom = feat.get("geometry") or {}
        segs = ([geom["coordinates"]] if geom.get("type") == "LineString"
                else geom.get("coordinates") or [])
        for line in segs:
            if len(line) < 2:
                continue
            if not any(w <= q[0] <= e and s_ <= q[1] <= n for q in line):
                continue
            lines.append([(q[0], q[1]) for q in line])
    print(f"streets: {len(lines):,} walkable lines inside the grid, from "
          f"{seen:,} CSCL features ({dropped_type:,} dropped on rw_type, "
          f"{dropped_nonped:,} on nonped)")
    return lines


def stamp_streets(header, lines, to_m_many):
    """A 1 where a cell is within STREET_BUFFER_M of a walkable centerline.

    Each segment is walked in half-cell steps so the band is continuous, and a
    disc is stamped around the cell each step falls in. The disc's radius is
    STREET_BUFFER_M in CELL INDICES - 1.2 cells for a 12 m buffer on a 10 m
    grid - so what is marked is the step's own cell and its four edge
    neighbours. That makes 12 m a nominal width: a street running down the
    middle of a cell reaches 12 m either side, one running near a cell edge
    reaches most of a cell further. Doing it in indices rather than measuring
    each cell center is the cheaper half of a distinction finer than the grid,
    and it is the wider of the two, which is the safer way to be wrong about a
    mask that decides whether people have anywhere to stand.
    """
    x0, y0, w, h, cell = (header["x0"], header["y0"], header["w"],
                          header["h"], header["cell"])
    mask = np.zeros(w * h, dtype=np.uint8)
    if not lines:
        return mask

    # One projection call for every vertex of every line, then the walk.
    lens = [len(ln) for ln in lines]
    lons = np.fromiter((q[0] for ln in lines for q in ln), dtype=np.float64,
                       count=sum(lens))
    lats = np.fromiter((q[1] for ln in lines for q in ln), dtype=np.float64,
                       count=sum(lens))
    xs, ys = to_m_many(lons, lats)

    step = cell / 2.0
    px_parts, py_parts = [], []
    at = 0
    for n_pts in lens:
        lx = xs[at:at + n_pts]
        ly = ys[at:at + n_pts]
        at += n_pts
        ax, ay = lx[:-1], ly[:-1]
        bx, by = lx[1:], ly[1:]
        seg_len = np.hypot(bx - ax, by - ay)
        for i in range(len(seg_len)):
            k = int(np.ceil(seg_len[i] / step)) + 1
            t = np.linspace(0.0, 1.0, max(2, k))
            px_parts.append(ax[i] + (bx[i] - ax[i]) * t)
            py_parts.append(ay[i] + (by[i] - ay[i]) * t)
    if not px_parts:
        return mask
    px = np.concatenate(px_parts)
    py = np.concatenate(py_parts)

    cx = np.floor((px - x0) / cell).astype(np.int64)
    cy = np.floor((py - y0) / cell).astype(np.int64)
    radius = STREET_BUFFER_M / cell
    span = int(np.floor(radius))
    for dx in range(-span, span + 1):
        for dy in range(-span, span + 1):
            if dx * dx + dy * dy > radius * radius:
                continue
            gx = cx + dx
            gy = cy + dy
            ok = (gx >= 0) & (gx < w) & (gy >= 0) & (gy < h)
            if ok.any():
                mask[gy[ok] * w + gx[ok]] = 1
    print(f"streets: {len(px):,} steps stamped; "
          f"{int(mask.sum()):,} cells within {STREET_BUFFER_M:.0f}m "
          f"({radius:.1f} cells) of a walkable centerline")
    return mask


def build_grid(footprints, to_m, to_m_many, from_m, original):
    """A 10 m grid over each district's bounding box, with a sidewalk mask.

    A cell is sidewalk when it is WITHIN STREET_BUFFER_M OF A WALKABLE STREET
    CENTERLINE AND NOT INSIDE A FOOTPRINT.

    It used to be the second half of that alone, which made 96% of the grid
    sidewalk: the memorial plaza at the World Trade Center, the West Street
    roadbed and the Hudson River all absorbed people, so a tower set in a plaza
    painted fainter than the canopy beside it. The model still has no sidewalk
    dataset. What it has instead is the street network, and a band around it
    whose width is ours.

    Both masks are returned. The building-only one is what a building with no
    street cell near it falls back to, so nobody's people vanish.

    The two districts share one grid, over the union of their footprints, so
    "both" is one texture and not two.
    """
    xs, ys = [], []
    for fp in footprints:
        for lon, lat in fp["r"]:
            x, y = to_m(lon, lat)
            xs.append(x)
            ys.append(y)
    pad = REACH_M + CELL_M
    x0, x1 = min(xs) - pad, max(xs) + pad
    y0, y1 = min(ys) - pad, max(ys) + pad
    w = int(np.ceil((x1 - x0) / CELL_M))
    h = int(np.ceil((y1 - y0) / CELL_M))
    header = {"x0": x0, "y0": y0, "w": w, "h": h, "cell": CELL_M}
    print(f"grid: {w} x {h} cells of {CELL_M:.0f}m ({w * h:,} cells)")

    not_building = np.ones(w * h, dtype=np.uint8)
    rings_m = []
    for fp in footprints:
        ring = [to_m(lon, lat) for lon, lat in fp["r"]]
        rings_m.append(ring)
        rx = [p[0] for p in ring]
        ry = [p[1] for p in ring]
        cx0 = max(0, int((min(rx) - x0) / CELL_M))
        cx1 = min(w - 1, int((max(rx) - x0) / CELL_M))
        cy0 = max(0, int((min(ry) - y0) / CELL_M))
        cy1 = min(h - 1, int((max(ry) - y0) / CELL_M))
        for cy in range(cy0, cy1 + 1):
            py = y0 + (cy + 0.5) * CELL_M
            for cx in range(cx0, cx1 + 1):
                px = x0 + (cx + 0.5) * CELL_M
                if point_in_ring(px, py, ring):
                    not_building[cy * w + cx] = 0
    print(f"grid: {int(not_building.sum()):,} cells are not inside a footprint "
          f"({100 * not_building.mean():.1f}% of the grid) - what the mask used "
          f"to be")

    # The grid's own box, back in lon/lat, so a street is kept when a vertex
    # of it falls on the grid - not on a looser box of our own.
    sw_ll = from_m(x0, y0)
    ne_ll = from_m(x0 + w * CELL_M, y0 + h * CELL_M)
    ll_bounds = (sw_ll[0], sw_ll[1], ne_ll[0], ne_ll[1])
    streets = stamp_streets(header, read_streets(original, ll_bounds), to_m_many)
    mask = (streets & not_building).astype(np.uint8)
    print(f"grid: {int(mask.sum()):,} sidewalk cells "
          f"({100 * mask.mean():.1f}% of the grid)")
    return header, mask, rings_m, not_building


def _cells_near(ring, header, mask, reach):
    """The cells of `mask` within `reach` of the ring's edge, and their distances.

    Returns (ids, distances) or (None, None) when the ring reaches nothing.
    Pulled out of build_weights so the widening and the fallback can call it
    again with a different mask or a different reach.
    """
    x0, y0, w, h, cell = (header["x0"], header["y0"], header["w"],
                          header["h"], header["cell"])
    rx = np.array([q[0] for q in ring])
    ry = np.array([q[1] for q in ring])
    cx0 = max(0, int((rx.min() - reach - x0) / cell))
    cx1 = min(w - 1, int((rx.max() + reach - x0) / cell))
    cy0 = max(0, int((ry.min() - reach - y0) / cell))
    cy1 = min(h - 1, int((ry.max() + reach - y0) / cell))
    if cx1 < cx0 or cy1 < cy0:
        return None, None

    # Every cell center in the window, at once.
    gx = x0 + (np.arange(cx0, cx1 + 1) + 0.5) * cell
    gy = y0 + (np.arange(cy0, cy1 + 1) + 0.5) * cell
    px, py = np.meshgrid(gx, gy)
    px = px.ravel()
    py = py.ravel()
    ids = ((np.repeat(np.arange(cy0, cy1 + 1), len(gx)) * w)
           + np.tile(np.arange(cx0, cx1 + 1), len(gy)))
    keep = mask[ids] == 1
    if not keep.any():
        return None, None
    px, py, ids = px[keep], py[keep], ids[keep]

    # Distance to the polygon's edge: the minimum over its segments of the
    # distance to that segment. Vectorized over cells, looped over segments,
    # because a footprint has a few dozen segments and a window has a few
    # hundred cells.
    best = np.full(px.shape, np.inf)
    for i in range(len(ring) - 1):
        ax, ay = ring[i]
        bx, by = ring[i + 1]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy
        if L2 == 0:
            d = np.hypot(px - ax, py - ay)
        else:
            t = np.clip(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1)
            d = np.hypot(px - (ax + t * dx), py - (ay + t * dy))
        np.minimum(best, d, out=best)

    near = best <= reach
    if not near.any():
        return None, None
    return ids[near], best[near]


def build_weights(header, mask, rings_m, fallback_mask):
    """Per building, the sidewalk cells within 50 m of its footprint edge.

    The weight on a cell is exp(-d^2 / (2 * 25^2)) on the distance from the
    footprint EDGE, normalized so a building's weights sum to 1 - so a building
    always puts all of its people on the sidewalk, and the falloff decides where
    rather than how many. THE NORMALIZATION IS WHAT CONSERVES HEADCOUNT: the
    metrics strip reports the sum over cells as the district's total for the
    hour, and it is only that because every building's weights sum to one.

    NOBODY IS ALLOWED AN EMPTY ROW. The street mask is much smaller than the
    not-a-building mask it replaced, and a handful of buildings - a pier shed, a
    building set deep inside a superblock - have no street cell within 50 m.
    Their people would silently vanish and the totals would stop summing to the
    district. So a building with nothing at 50 m widens its reach in 25 m steps
    to 150 m, and if it still has nothing it falls back to the old mask, the
    cells within 50 m that are merely not inside a building.

    Shipped as a CSR index: offsets[b] .. offsets[b+1] into cells and weights.
    """
    offsets = np.zeros(len(rings_m) + 1, dtype=np.uint32)
    all_cells, all_w = [], []
    two_sigma2 = 2 * SIGMA_M * SIGMA_M
    counts = {"street": 0, "widened": 0, "fallback": 0, "empty": 0}

    for bi, ring in enumerate(rings_m):
        ids, d = _cells_near(ring, header, mask, REACH_M)
        used = "street"
        if ids is None:
            for reach in (REACH_M + 25.0, REACH_M + 50.0,
                          REACH_M + 75.0, REACH_M + 100.0):
                ids, d = _cells_near(ring, header, mask, reach)
                if ids is not None:
                    used = "widened"
                    break
        if ids is None:
            ids, d = _cells_near(ring, header, fallback_mask, REACH_M)
            used = "fallback"
        if ids is None:
            counts["empty"] += 1
            offsets[bi + 1] = offsets[bi]
            continue

        wts = np.exp(-(d * d) / two_sigma2)
        s = wts.sum()
        if s <= 0:
            # Every cell so far away that its weight underflowed. Spread the
            # building's people evenly over what it did find rather than
            # dropping them.
            wts = np.full(len(ids), 1.0 / len(ids))
        else:
            wts = wts / s
        counts[used] += 1
        all_cells.append(ids.astype(np.uint32))
        all_w.append(wts.astype(np.float32))
        offsets[bi + 1] = offsets[bi] + len(wts)

    cells = (np.concatenate(all_cells) if all_cells
             else np.zeros(0, dtype=np.uint32))
    weights = (np.concatenate(all_w) if all_w
               else np.zeros(0, dtype=np.float32))
    per = (np.diff(offsets.astype(np.int64))
           if len(offsets) > 1 else np.zeros(0, dtype=np.int64))
    print(f"weights: {len(cells):,} building-cell pairs "
          f"({len(cells) / max(1, len(rings_m)):.0f} per building, median "
          f"{int(np.median(per)) if len(per) else 0}), "
          f"{(cells.nbytes + weights.nbytes) / 1e6:.2f}MB")
    print(f"weights: {counts['street']:,} buildings found street cells at "
          f"{REACH_M:.0f}m, {counts['widened']:,} needed a wider reach, "
          f"{counts['fallback']:,} fell back to the not-a-building mask, "
          f"{counts['empty']:,} found nothing at all")
    return offsets, cells, weights, counts


# --------------------------------------------------------------------------
# 3. The district outlines
# --------------------------------------------------------------------------

def simplify_ring(ring, target):
    """Thresholded Visvalingam. Same routine as pencil.py's, same reasoning:
    the one-at-a-time algorithm is O(n^2) without a heap and these rings are
    long enough for that to matter."""
    pts = ring[:-1] if ring[0] == ring[-1] else list(ring)
    if len(pts) <= target:
        return pts + [pts[0]]

    def sweep(threshold):
        kept = [pts[0]]
        for i in range(1, len(pts) - 1):
            a, b, c = kept[-1], pts[i], pts[i + 1]
            area = abs((b[0] - a[0]) * (c[1] - a[1])
                       - (c[0] - a[0]) * (b[1] - a[1])) / 2
            if area >= threshold:
                kept.append(b)
        kept.append(pts[-1])
        return kept

    lo, hi = 0.0, 1.0
    while len(sweep(hi)) > target and hi < 1e6:
        hi *= 4
    for _ in range(40):
        mid = (lo + hi) / 2
        if len(sweep(mid)) > target:
            lo = mid
        else:
            hi = mid
    out = sweep(hi)
    if len(out) < 4:
        out = pts[:: max(1, len(pts) // 4)][:4]
    return out + [out[0]]


def district_outlines(src, districts):
    """The chosen community districts, simplified, for the mask."""
    if not src.exists():
        print(f"districts: SKIPPED - {src} is not there. "
              f"Run data/scripts/fetch-sources-0908.sh.")
        return None
    fc = json.loads(src.read_text())
    want = {DISTRICT_BOROCD[d]: d for d in districts}
    out = {}
    for f in fc["features"]:
        code = str(f["properties"].get("boro_cd", "")).strip()
        if code not in want:
            continue
        g = f["geometry"]
        polys = (g["coordinates"] if g["type"] == "MultiPolygon"
                 else [g["coordinates"]])
        before = sum(len(r) for p in polys for r in p)
        kept = [[simplify_ring(r, max(24, int(400 * len(r) / before)))
                 for r in p] for p in polys]
        after = sum(len(r) for p in kept for r in p)
        out[want[code]] = kept
        print(f"districts: {want[code]} (BoroCD {code}) "
              f"{after:,} vertices from {before:,}")
    missing = [d for d in districts if d not in out]
    if missing:
        print(f"districts: NOT FOUND in {src.name}: {', '.join(missing)}")
    return out


# --------------------------------------------------------------------------

def write_day(out, original, flow):
    """day.json: the office curve from the MTA, the residents' from the ATUS."""
    arr, dep = worker_curve(flow)
    home, res_flow, atus_stats = resident_curve(original)

    (out / "day.json").write_text(json.dumps({
        "hours": 24,
        "workers": {
            "arrivals": [round(v, 6) for v in arr],
            "departures": [round(v, 6) for v in dep],
            "source": flow["source"],
            "period": flow["period"],
            "note": "Each normalized to sum to 1. A building's office people "
                    "in hour h is J_b * (arrivals[h] + departures[h]), which "
                    "over the day is two trips a worker.",
        },
        "residents": {
            "at_home_share": [round(v, 6) for v in home],
            "flow": [round(v, 6) for v in res_flow],
            "source": "American Time Use Survey 2003-2025 (BLS), activity and "
                      "respondent files, joined on TUCASEID.",
            "filters": "TUDIARYDAY 2-6 (a weekday diary); TUFNWGTP > 0; "
                       "TUYEAR 2020 dropped; TEWHERE = 1 is at home, any other "
                       "known code is away, and an activity with no place "
                       "carries the previous state forward.",
            "normalization": "flow[h] = |home[h+1] - home[h]|, scaled so the "
                             "day's flows sum to 2 - one departure and one "
                             "return per person on average. The raw curve does "
                             "not sum to 2; the scaling is ours and it is the "
                             "reason the residential channel is comparable "
                             "with the office one.",
            "national": "A national weekday average, not a New York count.",
            **atus_stats,
        },
    }, indent=2))
    print("write: day.json")
    return {
        "file": "day.json",
        "note": "Two hourly curves. Office workers on the MTA's counted "
                "arrivals and departures at the district's complexes; "
                "residents on the ATUS at-home share. Both are weekday.",
    }


def write_grid(out, footprints, original):
    """grid.json + the three binaries: a 10 m grid and the per-building weights.

    Meters, in a local equal-scale frame. EPSG:2263 is the city's own plane and
    it is in feet; the model's distances are all metric, so the grid is built in
    EPSG:3857 meters, which over four kilometers of Manhattan is the same grid
    to well under a cell. The scale factor at this latitude is divided out so a
    cell is 10 m on the ground and not 10 m on the web mercator sheet.
    """
    to3857 = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    lat0 = float(np.mean([p[1] for fp in footprints for p in fp["r"]]))
    k = np.cos(np.radians(lat0))

    def to_m(lon, lat):
        x, y = to3857.transform(lon, lat)
        return x * k, y * k

    # The same transform over arrays. The street file has hundreds of thousands
    # of vertices and pyproj is an order of magnitude faster given all of them
    # at once.
    def to_m_many(lons, lats):
        x, y = to3857.transform(np.asarray(lons), np.asarray(lats))
        return x * k, y * k

    # And back: local meters to lon/lat, for the grid's corners and for the box
    # the street reader clips to.
    to4326 = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)

    def from_m(x, y):
        return to4326.transform(x / k, y / k)

    header, mask, rings_m, not_building = build_grid(
        footprints, to_m, to_m_many, from_m, original)
    offsets, cells, weights, reach_counts = build_weights(
        header, mask, rings_m, not_building)

    (out / "sidewalk.bin").write_bytes(mask.tobytes())
    (out / "cells.bin").write_bytes(cells.tobytes())
    (out / "weights.bin").write_bytes(weights.tobytes())

    # The grid's corners as lon/lat, so the browser can lay the texture down
    # as a BitmapLayer without repeating the projection.
    x0, y0 = header["x0"], header["y0"]
    x1 = x0 + header["w"] * header["cell"]
    y1 = y0 + header["h"] * header["cell"]
    sw = from_m(x0, y0)
    ne = from_m(x1, y1)

    (out / "grid.json").write_text(json.dumps({
        "width": header["w"],
        "height": header["h"],
        "cell_m": CELL_M,
        "cell_ft": round(CELL_M * FT_PER_M, 3),
        "bounds": [sw[0], sw[1], ne[0], ne[1]],
        "order": "row-major, y UP - row 0 is the south edge",
        "buildings": len(rings_m),
        "offsets": offsets.tolist(),
        "pairs": int(len(cells)),
        "reach_m": REACH_M,
        "sigma_m": SIGMA_M,
        "street_buffer_m": STREET_BUFFER_M,
        "sidewalk_note": "A cell is sidewalk when it is within "
                         f"{STREET_BUFFER_M:.0f}m of a walkable street "
                         "centerline (NYC Street Centerline, NYC Open Data "
                         "inkn-q76z, rw_type 1, 3, 5, 6, 7 and 10, dropping "
                         "segments flagged non-pedestrian) AND not inside a "
                         "building footprint. The model has no sidewalk "
                         "dataset; the band is a judgment of ours, roughly a "
                         "curb-to-building depth on a side street and too "
                         "narrow for a wide avenue. It replaced a mask that "
                         "was only 'not inside a building', which made 96% of "
                         "the grid sidewalk and let the memorial plaza, the "
                         "West Street roadbed and the Hudson absorb people.",
        "street_reach": {
            **{k: int(v) for k, v in reach_counts.items()},
            "note": "Buildings by how they found their sidewalk cells: at 50m "
                    "on the street mask, at a reach widened in 25m steps to "
                    "150m, or falling back to the cells within 50m that are "
                    "merely not inside a building. No building is left with an "
                    "empty row - its people would vanish and the metrics would "
                    "stop summing to the district.",
        },
        "files": {
            "sidewalk": {"file": "sidewalk.bin", "dtype": "uint8",
                         "length": int(mask.size)},
            "cells": {"file": "cells.bin", "dtype": "uint32",
                      "length": int(cells.size)},
            "weights": {"file": "weights.bin", "dtype": "float32",
                        "length": int(weights.size)},
        },
    }))
    print("write: grid.json, sidewalk.bin, cells.bin, weights.bin")
    return {
        "file": "grid.json",
        "cell_m": CELL_M,
        "reach_m": REACH_M,
        "sigma_m": SIGMA_M,
        "street_buffer_m": STREET_BUFFER_M,
        "street_buffer_note": "Ours, and not measured. A cell counts as "
                              "sidewalk when it is within this many meters of "
                              "a walkable street centerline and not inside a "
                              "building. Roughly a curb-to-building depth on a "
                              "side street, and too narrow for a wide avenue.",
        "sidewalk_cells": int(mask.sum()),
        "street_reach": {k: int(v) for k, v in reach_counts.items()},
        "note": "10 m cells over the districts, with a per-building list of "
                "the sidewalk cells within 50 m of its footprint edge and a "
                "Gaussian weight on that distance, normalized per building.",
    }


def write_district_outlines(out, original, districts):
    """districts.json: the outlines the mask cuts out of the rest of the city."""
    outlines = district_outlines(original / "community_districts.geojson",
                                 districts)
    if not outlines:
        return None
    (out / "districts.json").write_text(json.dumps(outlines,
                                                   separators=(",", ":")))
    print("write: districts.json")
    return {
        "file": "districts.json",
        "source": "NYC Community Districts, NYC Open Data 5crt-au7u, "
                  "BoroCD 101 and 105. The build doc named yfnk-k7r4, which "
                  "does not exist on the portal.",
    }
