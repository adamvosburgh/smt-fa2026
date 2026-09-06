"""After Five, the agent layer - gateways, flows, streets, routes, occupancy.

Builds the five files the agent animation reads. Everything the animation
MOVES is counted; everything it ASSUMES is named in agents.json and on the
canvas. The register:

  MEASURED   how many people arrive at and depart from each subway complex in
             the study districts, per hour of a 2024 weekday - MTA's
             origin-destination ridership estimate, fetched as a server-side
             aggregate (the table is 116M rows; the aggregate is 984).
  MEASURED   where the entrances to each complex are - MTA's entrances file.
  MEASURED   what share of workers in management, business, financial and
             professional occupations are AT their workplace through the day -
             ATUS 2003-2025, the occupancy curve the animation is checked
             against.
  ASSUMED    a complex's flow splits evenly across its entrances.
  ASSUMED    which building a trip starts at (proportional to jobs; the
             browser does that part).
  ASSUMED    the route - shortest path on the street network, not the path
             anyone actually walks.

INPUTS (data/original/)
-----------------------
  mta_od_arrivals_study_districts_2024.csv    41 complexes x 24h, Oct 2024
  mta_od_departures_study_districts_2024.csv  weekdays, jsu2-fbtj aggregates
  mta_hourly_entries_lowermanhattan_oct2025.csv  the published cross-check
  mta_subway_entrances_2024.csv               i9wp-a4ja, full file
  nyc_street_centerline_cscl.geojson          inkn-q76z, full export
  atusact-0325.zip / atusresp-0325.zip        BLS ATUS multi-year files

OUTPUTS (data/processed/after-five/)
------------------------------------
  gateways.json   entrances in the districts, grouped by complex, each with
                  the graph node it snaps to and the routes.bin row for it
  flow.json       arrivals and departures per complex per hour, plus the
                  schedule defaults derived from the curves
  graph.bin       Float32 node lon/lat pairs, then Uint16 edge node pairs -
                  the walkable street graph, clipped to the districts
  routes.bin      one Uint16 predecessor array per unique gateway node,
                  from a single Dijkstra each - the browser walks these to
                  build any path in microseconds. NO BAKED TRIP SNAPSHOTS.
  occupancy.json  the ATUS at-workplace share in 96 15-minute bins
  agents.json     the sidecar manifest: formats, counts, sources, checks,
                  and every assumption written down

after-five.py's manifest.json is NOT touched - it is that script's output,
and a file two scripts write is a file with two truths. The component reads
agents.json alongside it.

USAGE
-----
    .venv/bin/python data/scripts/after-five-agents.py
    .venv/bin/python data/scripts/after-five-agents.py --skip-evening
"""
import argparse
import csv
import heapq
import io
import json
import math
import sys
import urllib.request
import zipfile
from datetime import date
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import original_dir, env  # noqa: E402

FT_PER_DEG_LAT = 364000.0
OUT = Path("data/processed/after-five")

# Walkable CSCL rw_type codes, from the dataset's documented field list:
# 1 Street, 3 Bridge, 5 Boardwalk, 6 Path/Trail, 7 Step Street, 10 Alley.
# Dropped: 2 Highway, 4 Tunnel, 8 Driveway, 9 Ramp, 12 Non-Physical,
# 13 U-turn, 14 Ferry Route. Segments marked non-pedestrian are dropped too.
# This is a data-handling rule of ours and it is recorded in agents.json.
WALKABLE_RW = {"1", "3", "5", "6", "7", "10"}


def dist_ft(lon1, lat1, lon2, lat2):
    kx = FT_PER_DEG_LAT * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot((lon2 - lon1) * kx, (lat2 - lat1) * FT_PER_DEG_LAT)


# --------------------------------------------------------------------------
# 1. Flows, and the check that the field means what the dictionary says
# --------------------------------------------------------------------------

def read_flow(original):
    """Per-complex hourly arrival and departure curves, October 2024 weekdays.

    jsu2-fbtj estimates ridership for every origin-destination pair by year,
    month, day of week and hour. Aggregating DESTINATIONS inside the district
    gives arrivals; aggregating ORIGINS gives departures. These CSVs are
    server-side aggregates and must stay aggregates - a row pull with a $limit
    would silently truncate a 116,279,069-row table and the curve would be
    wrong in a way nothing downstream could catch.
    """
    flows = {}
    for fname, direction in (("mta_od_arrivals_study_districts_2024.csv", "arrivals"),
                             ("mta_od_departures_study_districts_2024.csv", "departures")):
        prefix = "destination" if direction == "arrivals" else "origin"
        for r in csv.DictReader(open(original / fname)):
            cx = r[f"{prefix}_station_complex_id"]
            f = flows.setdefault(cx, {
                "name": r[f"{prefix}_station_complex_name"],
                "lat": float(r[f"{prefix}_latitude"]),
                "lon": float(r[f"{prefix}_longitude"]),
                "arrivals": [0.0] * 24, "departures": [0.0] * 24
            })
            f[direction][int(r["hour_of_day"])] = float(r["riders"])
    return flows


def check_flow(flows, original):
    """The 5pm peak is the check that the fields mean what they say.

    Lower Manhattan is a jobs destination, so people ENTER its stations to
    leave it - the published all-days entries table peaks at 17:00 at about
    2.5x the 08:00 figure. Reproduce that from the cross-check file, then
    require our weekday curves to peak where a jobs district must: arrivals
    in the morning, departures at 17:00, with the asymmetry narrower than
    the all-days one (weekday arrivals are commuters, so the morning peak
    catches up).
    """
    hourly = {}
    for r in csv.DictReader(open(original / "mta_hourly_entries_lowermanhattan_oct2025.csv")):
        hourly[int(r["hour"])] = float(r["entries"])
    ratio = hourly[17] / hourly[8]
    assert 2.0 < ratio < 3.0, f"published entries 17:00/08:00 ratio {ratio:.2f}, expected ~2.5"

    arr = [sum(f["arrivals"][h] for f in flows.values()) for h in range(24)]
    dep = [sum(f["departures"][h] for f in flows.values()) for h in range(24)]
    assert arr.index(max(arr)) in (7, 8, 9), f"arrivals peak at {arr.index(max(arr))}:00, not morning"
    assert dep.index(max(dep)) == 17, f"departures peak at {dep.index(max(dep))}:00, not 17:00"
    weekday_ratio = dep[17] / arr[8]
    assert weekday_ratio < ratio, (
        f"weekday 17:00-departures/08:00-arrivals {weekday_ratio:.2f} should be "
        f"narrower than the all-days entries asymmetry {ratio:.2f}")
    print(f"flow: published all-days entries 17:00/08:00 = {ratio:.2f}; "
          f"our weekday curves peak {arr.index(max(arr))}:00 in / 17:00 out, "
          f"asymmetry {weekday_ratio:.2f}")
    return {"published_alldays_17_over_08": round(ratio, 3),
            "weekday_17dep_over_08arr": round(weekday_ratio, 3)}


def schedule_defaults(flows):
    """Medians and spreads read off the measured curves.

    These are the DEFAULTS of the parametric schedule controls, so a reader
    who flips schedule_source to parametric starts from the measured day and
    moves away from it knowingly. Median is the interpolated 50% crossing of
    the cumulative curve; spread is half the 16th-84th percentile range - a
    standard deviation if the peak were normal, which it is not, and the
    control is a control precisely so that judgement is movable.

    Both are computed over the COMMUTE WINDOW of each curve - arrivals before
    13:00, departures after 12:00 - because the counted curves are not split
    by who is riding: the full-day arrival median lands at half past noon
    only because the evening's returning residents are in the same column as
    the morning's arriving workers. The window is the same one the sampler
    uses, and it is the one assumption the measured schedule carries.
    """
    def stats(curve, h0, h1):
        total = sum(curve[h0:h1])
        cum = 0.0
        marks = {}
        for h in range(h0, h1):
            prev = cum
            cum += curve[h]
            for q in (0.16, 0.5, 0.84):
                if prev < q * total <= cum and q not in marks:
                    marks[q] = h + (q * total - prev) / max(curve[h], 1e-9)
        return round(marks[0.5], 2), round((marks[0.84] - marks[0.16]) / 2, 2)

    arr = [sum(f["arrivals"][h] for f in flows.values()) for h in range(24)]
    dep = [sum(f["departures"][h] for f in flows.values()) for h in range(24)]
    am, asp = stats(arr, 4, 13)
    dm, dsp = stats(dep, 12, 24)
    print(f"flow: arrival median {am}h spread {asp}h; departure median {dm}h spread {dsp}h")
    return {"arrival_median": am, "arrival_spread": asp,
            "departure_median": dm, "departure_spread": dsp}


# --------------------------------------------------------------------------
# 2. Gateways
# --------------------------------------------------------------------------

def read_gateways(original, flows, bounds):
    """Entrances of the study complexes, inside the district bounds.

    `borough` is a single letter here ('M') while the ridership datasets spell
    it out ('Manhattan') - which is why the join is on complex_id and a
    bounding box, never on borough. A complex's flow SPLITS EVENLY across its
    entrances; that is an assumption and it goes on the card.
    """
    w, s, e, n = bounds
    out = []
    for r in csv.DictReader(open(original / "mta_subway_entrances_2024.csv")):
        if r["complex_id"] not in flows:
            continue
        if r["entry_allowed"] != "YES" and r["exit_allowed"] != "YES":
            continue
        lat = float(r["entrance_latitude"])
        lon = float(r["entrance_longitude"])
        if not (w <= lon <= e and s <= lat <= n):
            continue
        out.append({"complex_id": r["complex_id"], "lat": lat, "lon": lon,
                    "entry": r["entry_allowed"] == "YES",
                    "exit": r["exit_allowed"] == "YES"})
    per_cx = {}
    for g in out:
        per_cx[g["complex_id"]] = per_cx.get(g["complex_id"], 0) + 1
    for g in out:
        g["n_entrances"] = per_cx[g["complex_id"]]
    print(f"gateways: {len(out)} entrances across {len(per_cx)} complexes")
    return out


# --------------------------------------------------------------------------
# 3. The street graph
# --------------------------------------------------------------------------

def read_graph(original, boxes):
    """The walkable street graph, clipped to the padded district boxes.

    The CSCL export is one 196MB line of JSON, so features are decoded one at
    a time with raw_decode rather than the whole FeatureCollection at once.
    Nodes are segment endpoints, merged by rounding to 1e-6 degrees; interior
    vertices only contribute to an edge's length, so an edge is straight on
    screen but weighted by the street's real length.
    """
    text = (original / "nyc_street_centerline_cscl.geojson").read_text()
    start = text.index("[") + 1
    dec = json.JSONDecoder()
    pos = start
    nodes = {}
    coords = []
    edges = []
    kept = seen = 0

    def node_of(lon, lat):
        k = (round(lon, 6), round(lat, 6))
        i = nodes.get(k)
        if i is None:
            i = len(coords)
            nodes[k] = i
            coords.append((lon, lat))
        return i

    def inside(lon, lat):
        return any(w <= lon <= e and s <= lat <= n for (w, s, e, n) in boxes)

    while True:
        while pos < len(text) and text[pos] in ", \n\r\t":
            pos += 1
        if pos >= len(text) or text[pos] == "]":
            break
        feat, pos = dec.raw_decode(text, pos)
        seen += 1
        props = feat.get("properties") or {}
        if props.get("rw_type") not in WALKABLE_RW:
            continue
        # The nonped flag marks vehicle-only segments; 'V' is the value the
        # field dictionary gives for them.
        if (props.get("nonped") or "").strip().upper() == "V":
            continue
        geom = feat.get("geometry") or {}
        lines = ([geom["coordinates"]] if geom.get("type") == "LineString"
                 else geom.get("coordinates") or [])
        for line in lines:
            if len(line) < 2:
                continue
            if not (inside(*line[0][:2]) or inside(*line[-1][:2])):
                continue
            length = sum(dist_ft(line[i][0], line[i][1], line[i + 1][0], line[i + 1][1])
                         for i in range(len(line) - 1))
            a = node_of(*line[0][:2])
            b = node_of(*line[-1][:2])
            if a != b and length > 0:
                edges.append((a, b, length))
                kept += 1

    # Drop the true islands - a pier, a courtyard path - but KEEP EVERY
    # SUBSTANTIAL COMPONENT. The two district boxes are disjoint, so the graph
    # is legitimately (at least) two big components, one per district, and
    # keeping only the largest silently deleted a whole district's streets:
    # its buildings then snapped to nodes across the gap and five of every six
    # trips came back unreachable. The floor is 50 nodes, well above any pier
    # and well below either district.
    MIN_COMPONENT = 50
    adj = {}
    for a, b, L in edges:
        adj.setdefault(a, []).append(b)
        adj.setdefault(b, []).append(a)
    seen_c = set()
    keep = set()
    n_comps = 0
    for root in adj:
        if root in seen_c:
            continue
        comp = {root}
        stack = [root]
        while stack:
            u = stack.pop()
            for v in adj[u]:
                if v not in comp:
                    comp.add(v)
                    stack.append(v)
        seen_c |= comp
        if len(comp) >= MIN_COMPONENT:
            keep |= comp
            n_comps += 1
    remap = {}
    new_coords = []
    for old in sorted(keep):
        remap[old] = len(new_coords)
        new_coords.append(coords[old])
    new_edges = [(remap[a], remap[b], L) for a, b, L in edges if a in keep and b in keep]
    dropped = len(coords) - len(new_coords)
    assert len(new_coords) < 65535, "node count overflows Uint16"
    print(f"graph: {seen:,} CSCL features read, {kept:,} walkable segments kept, "
          f"{len(new_coords):,} nodes / {len(new_edges):,} edges in {n_comps} "
          f"components of {MIN_COMPONENT}+ nodes ({dropped:,} island nodes dropped)")
    return new_coords, new_edges


def write_graph(coords, edges):
    node_arr = np.array(coords, dtype="<f4")
    edge_arr = np.array([(a, b) for a, b, _ in edges], dtype="<u2")
    (OUT / "graph.bin").write_bytes(node_arr.tobytes() + edge_arr.tobytes())
    return node_arr, edge_arr


# --------------------------------------------------------------------------
# 4. Routes - one Dijkstra per unique gateway node, predecessors shipped
# --------------------------------------------------------------------------

def build_routes(coords, edges, gateways):
    """Predecessor arrays. The browser walks these to build a path in
    microseconds; nothing here bakes a trip.

    Several entrances snap to the same street node (both stair heads of one
    corner, say), so Dijkstra runs once per UNIQUE node and gateways carry an
    index into the resulting rows.
    """
    adj = {}
    for a, b, L in edges:
        adj.setdefault(a, []).append((b, L))
        adj.setdefault(b, []).append((a, L))

    def nearest(lon, lat):
        best, bi = 1e18, 0
        for i, (nx, ny) in enumerate(coords):
            d = (nx - lon) ** 2 * 0.57 + (ny - lat) ** 2
            if d < best:
                best, bi = d, i
        return bi

    snap_ft = []
    for g in gateways:
        g["node"] = nearest(g["lon"], g["lat"])
        nx, ny = coords[g["node"]]
        snap_ft.append(dist_ft(g["lon"], g["lat"], nx, ny))
    # The check that catches a mangled graph: an entrance that snaps to a node
    # a quarter-mile away is snapping across a gap, not to its own corner.
    snap_ft.sort()
    med = snap_ft[len(snap_ft) // 2]
    worst = snap_ft[-1]
    assert worst < 1320, f"a gateway snapped {worst:.0f}ft to its street node - the graph is missing its district"
    print(f"routes: gateway snap distance median {med:.0f}ft, worst {worst:.0f}ft")

    unique = sorted({g["node"] for g in gateways})
    row_of = {n: i for i, n in enumerate(unique)}
    for g in gateways:
        g["route_row"] = row_of[g["node"]]

    n = len(coords)
    rows = np.full((len(unique), n), 65535, dtype="<u2")
    for ri, src in enumerate(unique):
        dist = np.full(n, np.inf)
        dist[src] = 0.0
        prev = np.full(n, 65535, dtype=np.int64)
        prev[src] = src
        pq = [(0.0, src)]
        while pq:
            d, u = heapq.heappop(pq)
            if d > dist[u]:
                continue
            for v, L in adj.get(u, ()):  # noqa: B905
                nd = d + L
                if nd < dist[v]:
                    dist[v] = nd
                    prev[v] = u
                    heapq.heappush(pq, (nd, v))
        rows[ri] = prev
    (OUT / "routes.bin").write_bytes(rows.tobytes())
    print(f"routes: {len(unique)} unique gateway nodes x {n:,} nodes = "
          f"{rows.nbytes / 1e6:.2f}MB of predecessors")
    return len(unique)


# --------------------------------------------------------------------------
# 5. The occupancy curve - ATUS, the counted check on the animation
# --------------------------------------------------------------------------

def occupancy(original):
    """Weighted share of office-occupation workers AT their workplace, by
    15-minute bin - plus the residents' curves, from the same two files.

    Filters per the build doc: TELFS in (1,2) (employed), TUDIARYDAY 2-6
    (a weekday diary), TEIO1OCD 0010-3550 (the 2018 Census classification's
    management, business, financial and professional block). The multi-year
    weight is TUFNWGTP - TUFINLWGT is the single-year weight and is absent
    from these files - and cases with a missing weight (all of TUYEAR 2020)
    are dropped.

    TEWHERE codes 12-21 and 99 are MODES OF TRAVEL, not places: a person
    commuting is neither at home nor at the workplace, and this curve counts
    only code 2, "Respondent's workplace". That reading is recorded in
    agents.json.

    THE RESIDENTS' CURVES. A second universe on the same weekday-diary rule:
    respondents who are NOT employed (TELFS 3, 4, 5 - on layoff, looking,
    not in the labor force), no occupation filter. Three curves come out:
    the share at home per 15-minute bin (TEWHERE 1), and two 24-hour
    transition curves - when a known-at-home activity is followed by a
    known-away one (leaving home) and the reverse (returning). Activities
    whose place was not collected (TEWHERE < 0: sleeping, grooming) carry
    the last known state forward, so a night's sleep after an evening at
    home counts as at home; transitions are only counted between activities
    whose places are both known. National, all weekdays, not New York -
    that caveat ships with the curves.
    """
    eligible = {}
    res_eligible = {}
    dropped_weight = 0
    with zipfile.ZipFile(original / "atusresp-0325.zip") as z:
        with io.TextIOWrapper(z.open("atusresp_0325.dat"), encoding="ascii") as f:
            for r in csv.DictReader(f):
                if r["TUDIARYDAY"] not in ("2", "3", "4", "5", "6"):
                    continue
                try:
                    w = float(r["TUFNWGTP"])
                except ValueError:
                    w = 0.0
                if w <= 0:
                    dropped_weight += 1
                    continue
                if r["TELFS"] in ("3", "4", "5"):
                    res_eligible[r["TUCASEID"]] = w
                    continue
                if r["TELFS"] not in ("1", "2"):
                    continue
                try:
                    occ = int(r["TEIO1OCD"])
                except ValueError:
                    continue
                if not (10 <= occ <= 3550):
                    continue
                eligible[r["TUCASEID"]] = w

    def minutes(t):
        h, m, s = t.split(":")
        return int(h) * 60 + int(m)

    nb = 96
    at_work = {}
    res_acts = {}   # cid -> [(start_min, where_code)] in file order
    with zipfile.ZipFile(original / "atusact-0325.zip") as z:
        with io.TextIOWrapper(z.open("atusact_0325.dat"), encoding="ascii") as f:
            for r in csv.DictReader(f):
                cid = r["TUCASEID"]
                if cid in res_eligible:
                    try:
                        where = int(r["TEWHERE"])
                    except ValueError:
                        where = -1
                    res_acts.setdefault(cid, []).append(
                        (minutes(r["TUSTARTTIM"]), where))
                    continue
                if cid not in eligible or r["TEWHERE"] != "2":
                    continue
                a = minutes(r["TUSTARTTIM"])
                b = minutes(r["TUSTOPTIME"])
                mask = at_work.setdefault(cid, np.zeros(nb, dtype=bool))
                spans = [(a, b)] if a <= b else [(a, 1440), (0, b)]
                for s0, s1 in spans:
                    mask[s0 // 15: max(s0 // 15 + 1, (s1 + 14) // 15)] = True

    total_w = sum(eligible.values())
    bins = np.zeros(nb)
    for cid, mask in at_work.items():
        bins += eligible[cid] * mask
    share = (bins / total_w).round(4)
    peak_bin = int(share.argmax())
    print(f"occupancy: {len(eligible):,} eligible respondents "
          f"({dropped_weight:,} dropped for missing TUFNWGTP), at-work share "
          f"peaks {share.max():.3f} at {peak_bin // 4:02d}:{peak_bin % 4 * 15:02d}, "
          f"17:00 share {share[68]:.3f}")

    residents = resident_curves(res_eligible, res_acts, nb)
    return {
        "residents": residents,
        "bins_per_day": nb,
        "at_workplace_share": share.tolist(),
        "respondents": len(eligible),
        "dropped_missing_weight": dropped_weight,
        "filters": "TELFS in (1,2); TUDIARYDAY 2-6; TEIO1OCD 0010-3550 "
                   "(management, business, financial and professional, 2018 "
                   "Census Occupation Classification); weight TUFNWGTP",
        "travel_note": "TEWHERE 12-21 and 99 are modes of travel, not places. "
                       "A person commuting is neither at home nor at the "
                       "workplace, and this curve counts only TEWHERE 2.",
        "source": "ATUS 2003-2025 activity and respondent files, BLS, "
                  "atusact-0325.zip + atusresp-0325.zip, joined on TUCASEID"
    }


def resident_curves(res_eligible, res_acts, nb):
    """The not-employed day, as three curves.

    A diary runs 04:00 to 04:00 in activity order. Each activity gets a state
    - home (TEWHERE 1), away (any other known place, travel included: a
    person on a bus is on the street, which is what the animation cares
    about), or unknown (TEWHERE < 0, where the survey did not ask). Unknown
    states take the previous known one; a diary that OPENS unknown (it
    usually opens with sleep) takes the first known state that follows,
    which is nearly always home.
    """
    at_home = np.zeros(nb)
    leave = np.zeros(24)
    ret = np.zeros(24)
    total_w = 0.0
    for cid, acts in res_acts.items():
        w = res_eligible[cid]
        states = [1 if where == 1 else (0 if where >= 0 else -1)
                  for _, where in acts]
        known = [s for s in states if s >= 0]
        if not known:
            continue
        prev = known[0]  # backfill for a diary that opens with sleep
        filled = []
        for s in states:
            if s >= 0:
                prev = s
            filled.append(prev)
        total_w += w
        # The share at home, by 15-minute bin. An activity runs from its own
        # start to the next activity's start; the last runs to the diary's
        # 04:00 end.
        mask = np.zeros(nb, dtype=bool)
        for i, (start, _) in enumerate(acts):
            if filled[i] != 1:
                continue
            stop = acts[i + 1][0] if i + 1 < len(acts) else 4 * 60
            spans = [(start, stop)] if start < stop else [(start, 1440), (0, stop)]
            for s0, s1 in spans:
                mask[s0 // 15: max(s0 // 15 + 1, (s1 + 14) // 15)] = True
        at_home += w * mask
        # Transitions between consecutive filled states, timed at the start
        # of the activity being entered.
        for i in range(1, len(filled)):
            if filled[i - 1] == 1 and filled[i] == 0:
                leave[acts[i][0] // 60] += w
            elif filled[i - 1] == 0 and filled[i] == 1:
                ret[acts[i][0] // 60] += w
    share = (at_home / max(total_w, 1e-9)).round(4)
    # The checks that the codes mean what the dictionary says: a not-employed
    # weekday is overwhelmingly at home at 03:00, leaving peaks in daylight.
    assert share[12] > 0.9, f"at-home share at 03:00 is {share[12]:.2f} - TEWHERE reading is wrong"
    lp = int(np.argmax(leave))
    rp = int(np.argmax(ret))
    assert 7 <= lp <= 17, f"leaving-home curve peaks at {lp}:00"
    assert 9 <= rp <= 21, f"returning-home curve peaks at {rp}:00"
    print(f"occupancy: residents {len(res_acts):,} not-employed weekday diaries, "
          f"at-home share min {share.min():.3f} at "
          f"{int(share.argmin()) // 4:02d}:{int(share.argmin()) % 4 * 15:02d}, "
          f"leaving peaks {lp}:00, returning peaks {rp}:00")
    return {
        "at_home_share": share.tolist(),
        "leave_home": [round(v, 1) for v in leave.tolist()],
        "return_home": [round(v, 1) for v in ret.tolist()],
        "respondents": len(res_acts),
        "filters": "TELFS in (3,4,5) (not employed); TUDIARYDAY 2-6; weight "
                   "TUFNWGTP; no occupation filter",
        "state_rule": "home is TEWHERE 1; any other known place or mode of "
                      "travel is away; TEWHERE < 0 (sleep, grooming - place "
                      "not collected) carries the previous known state "
                      "forward, and a diary that opens unknown takes the "
                      "first known state that follows",
        "caveat": "National, all weekdays, not New York. The curves time the "
                  "sandbox's resident trips; they do not decide who makes one."
    }


# --------------------------------------------------------------------------
# 6. Evening destinations - optional, labels only
# --------------------------------------------------------------------------

def fetch_evening(original, flows):
    """Where the evening crowd goes. LABELS the animation; does not drive it.

    Refetched here because the 2026-09-04 fetch died on an invalid app token.
    The token is read from .env and sent as a header; on any failure this
    returns None and the layer ships without destination labels.
    """
    token = env("SOCRATA_APP_TOKEN")
    dest = {}
    try:
        for cx in sorted(flows):
            url = ("https://data.ny.gov/resource/jsu2-fbtj.json?"
                   "$select=destination_station_complex_id,destination_station_complex_name,"
                   "destination_latitude,destination_longitude,"
                   "sum(estimated_average_ridership)%20as%20riders"
                   f"&$where=origin_station_complex_id='{cx}'%20and%20month=10%20and%20"
                   "day_of_week%20in('Monday','Tuesday','Wednesday','Thursday','Friday')"
                   "%20and%20hour_of_day%20between%2016%20and%2021"
                   "&$group=destination_station_complex_id,destination_station_complex_name,"
                   "destination_latitude,destination_longitude&$limit=1000")
            req = urllib.request.Request(url)
            if token:
                req.add_header("X-App-Token", token)
            with urllib.request.urlopen(req, timeout=90) as resp:
                rows = json.load(resp)
            for r in rows:
                k = r["destination_station_complex_id"]
                d = dest.setdefault(k, {"name": r["destination_station_complex_name"],
                                        "lat": float(r["destination_latitude"]),
                                        "lon": float(r["destination_longitude"]),
                                        "riders": 0.0})
                d["riders"] += float(r["riders"])
    except Exception as exc:  # noqa: BLE001 - optional data, never fatal
        print(f"evening: fetch failed ({exc}); the layer ships without labels")
        return None
    # The CSV of record, replacing the token-error body the 2026-09-04 fetch
    # left behind - preflight checks this file by content, not size.
    with open(original / "mta_od_evening_destinations_2024.csv", "w", newline="") as f:
        wcsv = csv.writer(f)
        wcsv.writerow(["destination_station_complex_id", "destination_station_complex_name",
                       "destination_latitude", "destination_longitude", "riders"])
        for k, d in sorted(dest.items(), key=lambda kv: -kv[1]["riders"]):
            wcsv.writerow([k, d["name"], d["lat"], d["lon"], round(d["riders"], 4)])
    total = sum(d["riders"] for d in dest.values())
    top = sorted(dest.values(), key=lambda d: -d["riders"])[:25]
    for d in top:
        d["share"] = round(d["riders"] / total, 4)
        d["riders"] = round(d["riders"], 1)
    print(f"evening: {len(dest)} destinations, top {top[0]['name']} "
          f"({top[0]['share'] * 100:.1f}% of evening exits)")
    return {"note": "Weekday evenings (16:00-21:00), October 2024, exits from "
                    "the study complexes by destination complex. Labels the "
                    "animation; does not drive it.",
            "top": top}


# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--original", type=Path, default=None)
    ap.add_argument("--skip-evening", action="store_true")
    args = ap.parse_args()
    original = original_dir(args.original)
    OUT.mkdir(parents=True, exist_ok=True)

    manifest = json.loads((OUT / "manifest.json").read_text())
    dvb = manifest["district_view_bounds"]
    pad = 0.004  # about a quarter mile - keeps edge gateways connected
    boxes = [(b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad)
             for b in (dvb["MN01"], dvb["MN05"])]
    wide = (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))

    flows = read_flow(original)
    checks = check_flow(flows, original)
    sched = schedule_defaults(flows)
    gateways = read_gateways(original, flows, wide)
    coords, edges = read_graph(original, boxes)
    node_arr, edge_arr = write_graph(coords, edges)
    n_routes = build_routes(coords, edges, gateways)
    occ = occupancy(original)
    (OUT / "occupancy.json").write_text(json.dumps(occ, separators=(",", ":")))

    evening = None if args.skip_evening else fetch_evening(original, flows)

    (OUT / "flow.json").write_text(json.dumps({
        "period": "October 2024, weekdays (day_of_week in Monday-Friday)",
        "source": "MTA Subway Origin-Destination Ridership Estimate: 2024, "
                  "data.ny.gov jsu2-fbtj, server-side aggregates",
        "schedule_defaults": sched,
        "checks": checks,
        "districtArrivals": [round(sum(f["arrivals"][h] for f in flows.values()), 1)
                             for h in range(24)],
        "districtDepartures": [round(sum(f["departures"][h] for f in flows.values()), 1)
                               for h in range(24)],
        "complexes": flows
    }, separators=(",", ":")))

    (OUT / "gateways.json").write_text(json.dumps({
        "assumption": "A complex's flow splits evenly across its entrances. "
                      "Nothing in the data says which stair anyone uses.",
        "gateways": gateways
    }, separators=(",", ":")))

    if evening:
        (OUT / "evening_destinations.json").write_text(
            json.dumps(evening, separators=(",", ":")))

    sizes = {f: (OUT / f).stat().st_size for f in
             ("gateways.json", "flow.json", "graph.bin", "routes.bin", "occupancy.json")}
    (OUT / "agents.json").write_text(json.dumps({
        "generated": date.today().isoformat(),
        "graph": {"nodes": len(coords), "edges": len(edges),
                  "layout": "Float32[nodes][2] lon,lat then Uint16[edges][2] "
                            "node indices, little-endian",
                  "walkable_rw_types": sorted(WALKABLE_RW),
                  "walkable_note": "CSCL rw_type 1 street, 3 bridge, 5 "
                                   "boardwalk, 6 path, 7 step street, 10 "
                                   "alley; highways, tunnels, ramps, "
                                   "driveways, ferry routes and segments "
                                   "marked non-pedestrian dropped. Our rule."},
        "routes": {"rows": n_routes,
                   "layout": "Uint16[rows][nodes] predecessor per node, "
                             "65535 = unreachable; row index is route_row in "
                             "gateways.json"},
        "sizes_bytes": sizes,
        "checks": checks,
        "schedule_defaults": sched,
        "assumptions": [
            "Which building a trip starts at is proportional to jobs. Nothing "
            "says the people leaving 195 Broadway at 5:40 work there.",
            "The route is the shortest path, not the chosen path. Nobody "
            "walks the shortest path to the subway.",
            "The gateway share is real - counted taps, MTA O-D 2024 - and a "
            "complex's flow splits evenly across its entrances."
        ]
    }, indent=2))
    total = sum(sizes.values())
    print(f"write: {', '.join(f'{k} {v/1e3:.0f}KB' for k, v in sizes.items())} "
          f"- {total / 1e6:.2f}MB total")


if __name__ == "__main__":
    main()
