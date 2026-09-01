#!/usr/bin/env python3
"""
pencil.py - processing pipeline for Sandbox 02, Does It Pencil.

WHAT THE MODEL IS
-----------------
A pro-forma. Every one-to-two-family lot in Queens is tested against the
published terms of one real subsidy programme - HPD and HCR's Plus One ADU - and
tinted by the monthly cash flow an accessory dwelling unit on it would produce.

Not by whether an ADU is LEGAL there. That map is a zoning map and it is boring,
and the sandbox can draw it for comparison by setting `eligibility` to `all`.
The question is whether the deal works, and the answer moves when the terms move.

The financial model is published, not invented. That is the thing to protect.

WHAT THIS SCRIPT IS FOR
-----------------------
Not compression. RESHAPING - so that the browser does arithmetic over typed
arrays instead of a lookup.

The decision that shapes everything else: PRECOMPUTE THE INPUTS TO THE
PRO-FORMA, NEVER ITS ANSWERS. Every control in this sandbox changes the
arithmetic rather than the data, and the parameter space is continuous and
six-dimensional, so there is no set of precomputed results to ship. Instead we
ship the per-lot constants - where the lot is, how big an ADU fits on it, what
rent it could get - and the browser recomputes all 246,925 lots on every slider
move in one pass over the arrays.

This is the same reasoning as bathtub's spill.png reaching the OPPOSITE
conclusion. There, connectivity was precomputed because it is a property of
terrain that no parameter changes. Here, nothing can be precomputed because
every parameter changes the sum. Same question, different answer, and the
question is always "what does a parameter actually move".

INPUTS  (data/original/, as downloaded, never edited in place)
--------------------------------------------------------------
  nyc_mappluto_26v2_shp/MapPLUTO.dbf
      MapPLUTO 26v2. 856,687 records, 101 fields. Only the .dbf is read; the
      141MB .shp is never opened.
      All field names below were read from the DBF header on 2026-08-31.
      TAKEN, per lot:
        BBL                     join key. Stored as a DBF FLOAT - read as int.
        BoroCode                filter to 4 (Queens)
        BldgClass, LandUse      the 1-2 family test, cross-checked
        UnitsRes, NumBldgs      confirm the test, catch multi-building lots
        LotArea, BldgFront,
          BldgDepth             the rear-yard proxy that sizes the ADU
        ZoneDist1               R1-2A / R2A / R3A detached exclusion
        TrnstZone               the Greater Transit Zone, which that exclusion
                                depends on. This field exists and carries the
                                zone by name, so the exclusion is computable
                                from MapPLUTO alone with no extra download.
        HistDist                historic district exclusion; non-empty means in
        ZipCode                 join to HUD Small Area FMR
        BCT2020                 join to census tract (borough digit + 6-digit
                                tract; converted to an 11-digit GEOID here)
        OwnerType               screen out city-owned lots
        Latitude, Longitude     centroids for rendering. Preferred over
                                XCoord/YCoord, which are State Plane feet.
        YearBuilt               context only

  fmr+incomelimit/fy2026_safmrs_revised.xlsx
      HUD Small Area Fair Market Rents, FY2026, by ZIP code.
      TAKEN: the 1-bedroom SAFMR for each ZIP present in Queens.
      Small Area rather than the county figure ON PURPOSE: the county FMR is one
      number for the whole New York-Newark-Jersey City metro, which would tint
      every lot in Queens identically and make the rent control do nothing.

  fmr+incomelimit/summary_county_3608199999.csv
      HUD FY2026 Income Limits.
      TAKEN: the Very Low (50%) limits by household size, and the area median
      family income.
      NOTE WHAT GEOGRAPHY THIS IS. Despite the file name, these figures are not
      Queens. They cover the whole New York, NY HUD Metro FMR Area: Bronx,
      Kings, New York, Putnam, Queens, Richmond, Rockland and Westchester
      counties. HUD publishes no smaller geography for income limits. So the
      programme's rent cap does not vary across Queens AT ALL, while market rent
      does - and the AMI that sets it is computed partly from Westchester and
      Rockland incomes. That asymmetry is the point of the rent_basis control.

  future_floodplain_2050s_*.geojson        NYC Open Data 27ya-gqtm
  sea_level_rise_2080s_100yr_*.geojson     NYC Open Data ek8y-fsqz
      TAKEN: the polygons only, rasterised to a lookup grid over Queens.
      READ THE CAVEAT in the eligibility section below before trusting these.

  Census API, ACS 5-year 2023, tracts in state 36 county 081
      TAKEN: B19013_001E (median household income) and B25003_001E/002E
      (occupied units, owner-occupied) per tract.
      Needs CENSUS_API_KEY in .env.

  HPD Plus One ADU term sheet
      Not a file. The published constants are hardcoded below WITH their
      citation, the same way bathtub carries the NPCC projections.

OUTPUTS (data/processed/pencil/)
--------------------------------
  manifest.json   column order and units, bounds, lot count, the published
                  programme constants with their source, the non-control
                  assumptions with their justification, and every join total
  lots.bin        Float32Array, row-major, 7 floats per lot:
                    lon, lat, adu_sf, lot_area, rent_fmr, tract_income, tract_idx
                  tract_idx indexes tracts.json's array. It is here because the
                  concentration metric - the share of new units landing in the
                  top tenth of tracts - has to GROUP by tract, which an income
                  value alone cannot do.
  flags.bin       Uint8Array, one byte per lot, a bitfield - see FLAGS below
  tracts.json     simplified tract outlines with median income, for the
                  concentration metric and optional tract shading

The AMI rent cap is a SCALAR in the manifest, not a column, because it does not
vary by lot. Shipping it as a column would have implied a spatial variation that
does not exist, and 1MB of identical numbers is a poor way to make that point.

WHAT IS DERIVED HERE AND IS NOT A CITY PRODUCT
----------------------------------------------
The eligibility flags are OURS. NYC Open Data publishes no City of Yes ADU
eligibility layer - this was checked against the catalogue on 2026-08-31 and
there is none. So the flags below are derived from the published rules in DCP's
City of Yes for Housing Opportunity ADU guide, applied to MapPLUTO by us. That
distinction is carried into the model card and it matters: a reader should not
mistake our reading of a rule for the city's own determination.

USAGE
-----
Run from the repo root.

    .venv/bin/python data/scripts/pencil.py
    .venv/bin/python data/scripts/pencil.py --skip-census   # reuse cached ACS
"""

import argparse
import json
import math
import struct
import sys
import urllib.request
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from _common import env, original_dir, read_dbf  # noqa: E402

QUEENS_BORO = "4"
QUEENS_FIPS = ("36", "081")

# --- the programme, as published ------------------------------------------
# HPD / HCR Plus One ADU term sheet.
# nyc.gov/assets/hpd/downloads/pdfs/services/adu-term-sheet.pdf
# Every figure here is quoted from that document; verified 2026-08-31.
PROGRAMME = {
    "source": "HPD Plus One ADU term sheet, nyc.gov/assets/hpd/downloads/pdfs/"
              "services/adu-term-sheet.pdf, read 2026-08-31",
    "loan_max": 220000,          # "$220,000 per borrower"
    "grant_max": 175000,         # "$175,000 per grantee"
    "interest_rate": 0.05,       # "5%. Rate may be reduced." (to 0)
    "term_months": 180,          # "180 months (15 years.)", extendable to 360
    "borrower_income_limit_pct_ami": 165,
    "rent_cap_pct_ami": 100,
    "rent_escalation_max": 0.02,
    "owner_occupancy_days": 270,
    "cushion": 200,              # "at least $200 monthly cash flow available"
}

# --- City of Yes for Housing Opportunity, ADU rules ------------------------
# nyc.gov/assets/planning/downloads/pdf/our-work/plans/citywide/
#   city-of-yes-housing-opportunity/housing-opportunity-guide-adus.pdf
MAX_ADU_SF = 800
DETACHED_EXCLUDED_DISTRICTS = ("R1-2A", "R2A", "R3A")

# --- assumptions that are ours, not anybody's ------------------------------
# Each of these is a number with no published source that we could find. They
# are named here, carried into the manifest, and stated in the model card. A
# figure that looks sourced and is not is the failure this course is about.
ASSUMPTIONS = {
    "soft_cost": {
        "value": 30000,
        "note": "Design, filing, permits and survey, as a flat sum per project. "
                "No published figure was found for New York ADUs. This is an "
                "assumption and the sandbox says so.",
    },
    "opex_share": {
        "value": 0.25,
        "note": "Operating cost - insurance, maintenance, water - as a share of "
                "effective rent. A conventional small-landlord rule of thumb, "
                "not a measured figure for ADUs.",
    },
    "property_tax": {
        "value": 0,
        "note": "THE MODEL IGNORES PROPERTY TAX. MapPLUTO carries AssessTot for "
                "the existing lot, but the marginal assessment of an added ADU "
                "is not in any dataset we found, and deriving one would produce "
                "a number that looks sourced and is not. Margins here are "
                "therefore optimistic by whatever the tax would have been.",
    },
    "adu_bedrooms": {
        "value": 1,
        "note": "Every ADU is priced as a one-bedroom. Rent limits are taken at "
                "1.5 persons per bedroom, which is the convention HUD's own "
                "rent schedules use.",
    },
    "cost_per_sf_default": {
        "value": 500,
        "note": "Default construction cost. HPD's 'ADU for You' cost figures "
                "could not be verified to exist, so this is an assumption and "
                "the schema description says so. It is a control - move it.",
    },
}

# --- flags.bin bitfield ----------------------------------------------------
FLAGS = {
    "two_family": 1 << 0,
    "eligible_attached": 1 << 1,
    "eligible_detached": 1 << 2,
    "in_flood_2050": 1 << 3,
    "in_flood_2080": 1 << 4,
    "in_historic_district": 1 << 5,
    "excluded_district": 1 << 6,
    "city_owned": 1 << 7,
}


# --------------------------------------------------------------------------
# HUD
# --------------------------------------------------------------------------

def read_income_limits(path):
    """Very Low (50%) limits by household size, and the area median income.

    HUD publishes 50% and 80% limits, not 100%. The 100% figure used for the
    programme's rent cap is taken as twice the 50% limit for the same household
    size, which is HUD's own construction - the 50% limit is the base from which
    the others are derived, and it already carries the caps and adjustments HUD
    applies. Doubling it is therefore closer to the published intent than
    halving the median family income would be, and the two differ: the 4-person
    50% limit is 84,800 against a median family income of 104,300.
    """
    import csv

    limits, mfi = {}, None
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.reader(f):
            if not row:
                continue
            head = row[0].strip()
            if head == "Median Family Income":
                mfi = int(row[1].replace("$", "").replace(",", ""))
            elif head.startswith("Very Low (50%)"):
                for i, v in enumerate(row[1:9], start=1):
                    if v.strip():
                        limits[i] = int(v.replace(",", ""))
    if not limits or mfi is None:
        raise SystemExit(f"could not read income limits from {path}")
    print(f"hud: median family income ${mfi:,}; "
          f"50% limits for 1-8 people {[limits[i] for i in sorted(limits)]}")
    return limits, mfi


def ami_rent_cap(limits, bedrooms=1):
    """The programme's 100%-AMI monthly rent cap.

    Household size is 1.5 persons per bedroom, so a one-bedroom is priced
    between the 1-person and 2-person limits. Rent is 30% of income, monthly.

    ONE NUMBER FOR EIGHT COUNTIES. It does not vary anywhere in Queens.
    """
    persons = 1.5 * bedrooms              # 1BR -> 1.5 -> interpolate 1 and 2
    lo, hi = math.floor(persons), math.ceil(persons)
    frac = persons - lo
    limit_50 = limits[lo] * (1 - frac) + limits[hi] * frac
    income_100 = limit_50 * 2
    rent = 0.30 * income_100 / 12
    print(f"hud: 100% AMI for a {bedrooms}BR ({persons} persons) is "
          f"${income_100:,.0f}; rent cap ${rent:,.0f}/mo")
    return rent, income_100, persons


def read_safmr(path, zips_wanted):
    """1-bedroom Small Area FMR per ZIP, for the ZIPs Queens actually uses."""
    import openpyxl

    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb[wb.sheetnames[0]]
    rows = ws.iter_rows(values_only=True)
    header = [str(h or "").replace("\n", " ").strip() for h in next(rows)]
    i_zip = header.index("ZIP Code")
    i_1br = header.index("SAFMR 1BR")
    out = {}
    for r in rows:
        z = str(r[i_zip] or "").strip().zfill(5)
        if z in zips_wanted and r[i_1br]:
            out[z] = float(r[i_1br])
    wb.close()
    print(f"hud: 1BR SAFMR for {len(out):,} of {len(zips_wanted):,} Queens ZIPs "
          f"(${min(out.values()):,.0f}-${max(out.values()):,.0f}/mo)")
    return out


# --------------------------------------------------------------------------
# Census
# --------------------------------------------------------------------------

def fetch_acs(cache, skip):
    """Median household income and owner-occupancy share, by tract."""
    if skip and cache.exists():
        print(f"acs: reusing {cache.name}")
        return json.loads(cache.read_text())

    key = env("CENSUS_API_KEY")
    if not key:
        print("acs: no CENSUS_API_KEY in .env - tract income will be 0")
        return {}

    base = "https://api.census.gov/data/2023/acs/acs5"
    fields = "B19013_001E,B25003_001E,B25003_002E"
    url = (f"{base}?get=NAME,{fields}&for=tract:*"
           f"&in=state:{QUEENS_FIPS[0]}%20county:{QUEENS_FIPS[1]}&key={key}")
    with urllib.request.urlopen(url, timeout=120) as r:
        rows = json.loads(r.read().decode())
    head, body = rows[0], rows[1:]
    idx = {k: head.index(k) for k in
           ("B19013_001E", "B25003_001E", "B25003_002E", "state", "county", "tract")}
    out = {}
    for row in body:
        geoid = f"{row[idx['state']]}{row[idx['county']]}{row[idx['tract']]}"

        def num(k):
            v = row[idx[k]]
            try:
                v = float(v)
            except (TypeError, ValueError):
                return None
            return None if v < 0 else v   # Census uses -666666666 for suppressed

        total, owner = num("B25003_001E"), num("B25003_002E")
        out[geoid] = {
            "income": num("B19013_001E") or 0,
            "owner_share": (owner / total) if (total and owner is not None and total > 0) else 0,
        }
    cache.write_text(json.dumps(out))
    print(f"acs: {len(out):,} Queens tracts "
          f"({sum(1 for v in out.values() if v['income'] > 0):,} with an income figure)")
    return out


# --------------------------------------------------------------------------
# Floodplains, as a lookup grid
# --------------------------------------------------------------------------

def rasterise_floodplain(paths, bounds, size=2048):
    """Burn floodplain polygons onto a grid so a lot is one array lookup.

    246,925 point-in-polygon tests against 10,611 multipolygons is not something
    to do in Python. Rasterising once and indexing by cell is the same trick
    bathtub uses for census tracts, and at this grid the cell is about 20m -
    finer than a lot is wide, and far finer than the floodplain boundary is
    meaningful.
    """
    from PIL import Image, ImageDraw

    west, south, east, north = bounds
    sx = size / (east - west)
    sy = size / (north - south)
    out = []
    for path in paths:
        img = Image.new("1", (size, size), 0)
        draw = ImageDraw.Draw(img)
        data = json.loads(Path(path).read_text())
        n = 0
        for feat in data.get("features", []):
            g = feat.get("geometry")
            if not g:
                continue
            polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
            for poly in polys:
                ring = poly[0]
                pts = [((lon - west) * sx, (north - lat) * sy) for lon, lat in ring]
                if len(pts) >= 3:
                    draw.polygon(pts, fill=1)
                    n += 1
        arr = np.asarray(img, dtype=bool)
        print(f"flood: {Path(path).name} -> {n:,} rings, "
              f"{arr.sum() / arr.size * 100:.1f}% of the Queens box")
        out.append(arr)
    return out


# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--original", type=Path, default=None)
    ap.add_argument("--out", type=Path, default=Path("data/processed/pencil"))
    ap.add_argument("--skip-census", action="store_true",
                    help="reuse the cached ACS response instead of refetching")
    args = ap.parse_args()

    original = original_dir(args.original)
    out = args.out
    out.mkdir(parents=True, exist_ok=True)

    # ---- 1. MapPLUTO -----------------------------------------------------
    dbf = original / "nyc_mappluto_26v2_shp" / "MapPLUTO.dbf"
    cols = ["BBL", "BoroCode", "BldgClass", "LandUse", "UnitsRes", "NumBldgs",
            "LotArea", "BldgFront", "BldgDepth", "ZoneDist1", "TrnstZone",
            "HistDist", "ZipCode", "BCT2020", "OwnerType", "Latitude",
            "Longitude", "YearBuilt"]
    print(f"pluto: reading {dbf.name}")

    lots = []
    counts = {"queens": 0, "ab": 0, "landuse01": 0, "disagree": 0,
              "no_coords": 0, "bad_units": 0, "multi_building": 0}
    for rec in read_dbf(dbf, cols):
        if rec["borocode"] != QUEENS_BORO:
            continue
        counts["queens"] += 1
        cls = rec["bldgclass"]
        is_ab = cls[:1] in ("A", "B")
        is_lu01 = rec["landuse"] == "01"
        if is_ab:
            counts["ab"] += 1
        if is_lu01:
            counts["landuse01"] += 1
        if is_ab != is_lu01:
            counts["disagree"] += 1
        if not is_ab:
            continue

        try:
            units = int(rec["unitsres"] or 0)
        except ValueError:
            units = 0
        # A handful of A*/B* lots carry hundreds of units. They are
        # misclassified, not one-to-two-family, and they are dropped rather
        # than allowed to distort a per-lot model.
        if units not in (1, 2):
            counts["bad_units"] += 1
            continue

        try:
            lon = float(rec["longitude"]); lat = float(rec["latitude"])
        except ValueError:
            counts["no_coords"] += 1
            continue
        if not (-74.3 < lon < -73.6 and 40.4 < lat < 41.0):
            counts["no_coords"] += 1
            continue

        def f(k):
            try:
                return float(rec[k] or 0)
            except ValueError:
                return 0.0

        nb = int(f("numbldgs"))
        if nb > 1:
            counts["multi_building"] += 1

        lots.append({
            "bbl": int(float(rec["bbl"])) if rec["bbl"] else 0,
            "lon": lon, "lat": lat,
            "lot_area": f("lotarea"),
            "bldg_front": f("bldgfront"), "bldg_depth": f("bldgdepth"),
            "units": units, "numbldgs": nb,
            "zone": rec["zonedist1"], "trnst": rec["trnstzone"],
            "hist": rec["histdist"], "zip": rec["zipcode"].zfill(5)[:5],
            "bct": rec["bct2020"], "owner": rec["ownertype"],
        })

    n = len(lots)
    print(f"pluto: {counts['queens']:,} Queens lots; "
          f"{counts['ab']:,} are BldgClass A*/B*; {counts['landuse01']:,} are "
          f"LandUse 01; the two tests disagree on {counts['disagree']:,}")
    print(f"pluto: dropped {counts['bad_units']:,} with a UnitsRes outside 1-2 "
          f"and {counts['no_coords']:,} with no usable centroid")
    print(f"pluto: {counts['multi_building']:,} of the {n:,} kept have more than "
          f"one building on the lot")

    # ---- 2. HUD ----------------------------------------------------------
    hud = original / "fmr+incomelimit"
    limits, mfi = read_income_limits(hud / "summary_county_3608199999.csv")
    rent_cap, income_100, persons = ami_rent_cap(limits, ASSUMPTIONS["adu_bedrooms"]["value"])
    zips = {l["zip"] for l in lots if l["zip"].isdigit()}
    safmr = read_safmr(hud / "fy2026_safmrs_revised.xlsx", zips)
    missing_zip = sum(1 for l in lots if l["zip"] not in safmr)
    median_safmr = float(np.median(list(safmr.values()))) if safmr else 0.0
    print(f"hud: {missing_zip:,} lots have a ZIP with no SAFMR; they take the "
          f"Queens median of ${median_safmr:,.0f}")

    # ---- 3. ACS ----------------------------------------------------------
    # Cached into data/original, which is gitignored - it is a downloaded
    # response, not a processed output, and data/processed is committed.
    acs = fetch_acs(original / "acs_queens_tracts_2023.json", args.skip_census)

    def geoid_of(bct):
        # BCT2020 is a borough digit followed by a six-digit tract.
        return f"36081{bct[1:]}" if len(bct) == 7 and bct[0] == QUEENS_BORO else None

    matched = sum(1 for l in lots if geoid_of(l["bct"]) in acs)
    print(f"acs: {matched:,} of {n:,} lots joined to a tract "
          f"({matched / n * 100:.1f}%)")

    # ---- 4. floodplains --------------------------------------------------
    lon = np.array([l["lon"] for l in lots], dtype=np.float64)
    lat = np.array([l["lat"] for l in lots], dtype=np.float64)
    bounds = [lon.min(), lat.min(), lon.max(), lat.max()]
    flood_paths = (sorted(original.glob("future_floodplain_2050s*.geojson"))
                   + sorted(original.glob("sea_level_rise_2080s*.geojson")))
    if len(flood_paths) == 2:
        SIZE = 2048
        grids = rasterise_floodplain(flood_paths, bounds, SIZE)
        gx = np.clip(((lon - bounds[0]) / (bounds[2] - bounds[0]) * SIZE).astype(int), 0, SIZE - 1)
        gy = np.clip(((bounds[3] - lat) / (bounds[3] - bounds[1]) * SIZE).astype(int), 0, SIZE - 1)
        in_2050 = grids[0][gy, gx]
        in_2080 = grids[1][gy, gx]
        print(f"flood: {in_2050.sum():,} lots in the 2050s floodplain, "
              f"{in_2080.sum():,} in the 2080s")
        flood_note = ("NYC Open Data 27ya-gqtm (Future Floodplain 2050s) and "
                      "ek8y-fsqz (Sea Level Rise Maps, 2080s 100-year), "
                      "downloaded 2026-08-31, rasterised to a 2048-cell grid "
                      "over Queens (about 20m). NOTE: these are the published "
                      "floodplain layers, which are NOT identical to the Zoning "
                      "Resolution's 'expanded flood area' that the City of Yes "
                      "ADU rule actually names. They are used as the closest "
                      "available approximation and the card says so.")
    else:
        in_2050 = np.zeros(n, dtype=bool)
        in_2080 = np.zeros(n, dtype=bool)
        flood_note = "NOT APPLIED - floodplain files were not found in data/original."
        print("flood: layers not found - the flood exclusion is DROPPED")

    # ---- 5. size the ADU -------------------------------------------------
    # THE WEAKEST STEP IN THIS PIPELINE, and it is worth saying so here rather
    # than only in the card. There is no lot geometry in the DBF: no shape, no
    # orientation, no setbacks, no existing yard. LotArea minus the building's
    # own footprint is all there is, and it treats an L-shaped lot, a corner lot
    # and a flag lot identically. The 800sf cap is the rule; everything before
    # the cap is an estimate.
    lot_area = np.array([l["lot_area"] for l in lots], dtype=np.float64)
    footprint = np.array([l["bldg_front"] * l["bldg_depth"] for l in lots], dtype=np.float64)
    rear_yard = np.maximum(lot_area - footprint, 0.0)
    # Only part of a rear yard is buildable - the rest is setback, access and
    # the yard the rule requires to remain. A third is a guess, and it is named
    # as one in the manifest.
    BUILDABLE_SHARE = 0.33
    adu_sf = np.minimum(rear_yard * BUILDABLE_SHARE, MAX_ADU_SF)
    adu_sf[adu_sf < 200] = 0.0     # below this nothing habitable is being built
    print(f"size: {int((adu_sf > 0).sum()):,} lots fit an ADU of at least 200sf; "
          f"median {np.median(adu_sf[adu_sf > 0]):,.0f}sf; "
          f"{int((adu_sf >= MAX_ADU_SF).sum()):,} hit the {MAX_ADU_SF}sf cap")

    # ---- 6. eligibility flags (OURS, derived from the published rules) ----
    flags = np.zeros(n, dtype=np.uint8)
    for i, l in enumerate(lots):
        b = 0
        if l["units"] == 2:
            b |= FLAGS["two_family"]
        if l["hist"]:
            b |= FLAGS["in_historic_district"]
        if l["owner"] in ("C", "M", "O", "P"):
            b |= FLAGS["city_owned"]
        zone = l["zone"].strip().upper()
        beyond_transit = l["trnst"].strip().startswith("Beyond")
        if zone in DETACHED_EXCLUDED_DISTRICTS and beyond_transit:
            b |= FLAGS["excluded_district"]
        flags[i] = b
    flags |= (in_2050.astype(np.uint8) * FLAGS["in_flood_2050"])
    flags |= (in_2080.astype(np.uint8) * FLAGS["in_flood_2080"])

    has_room = adu_sf > 0
    not_city = (flags & FLAGS["city_owned"]) == 0

    # The published rule distinguishes the two, and so does this.
    #
    # ATTACHED: an extension of the house. Not barred by the flood rule - that
    # rule names basement and DETACHED units - so the only screens are that
    # there is room and that the city does not own the lot.
    attached_ok = has_room & not_city

    # DETACHED: a backyard cottage. Barred in the expanded flood area, in
    # historic districts, and in R1-2A / R2A / R3A outside the Greater Transit
    # Zone.
    #
    # THE SANDBOX PRICES THE DETACHED CASE, and that follows from the sizing
    # step rather than from a preference: the ADU is sized from the rear yard,
    # which is what a detached cottage occupies. An attached extension is a
    # different building on a different part of the lot and this pipeline has
    # no measurement of it. The card says so.
    detached_ok = (attached_ok
                   & ~in_2050 & ~in_2080
                   & ((flags & FLAGS["in_historic_district"]) == 0)
                   & ((flags & FLAGS["excluded_district"]) == 0))
    flags |= attached_ok.astype(np.uint8) * FLAGS["eligible_attached"]
    flags |= detached_ok.astype(np.uint8) * FLAGS["eligible_detached"]
    print(f"rules: {int(attached_ok.sum()):,} lots pass the attached-ADU rules, "
          f"{int(detached_ok.sum()):,} pass the detached rules "
          f"(of {n:,} one-to-two-family lots)")
    print(f"rules: excluded - {int((flags & FLAGS['in_historic_district'] > 0).sum()):,} "
          f"historic, {int((flags & FLAGS['excluded_district'] > 0).sum()):,} "
          f"low-density beyond the transit zone, "
          f"{int(in_2050.sum()):,} in the 2050s floodplain")

    # ---- 7. per-lot rent and tract income --------------------------------
    rent_fmr = np.array([safmr.get(l["zip"], median_safmr) for l in lots], dtype=np.float64)
    tract_income = np.array(
        [acs.get(geoid_of(l["bct"]) or "", {}).get("income", 0) for l in lots],
        dtype=np.float64)

    # ---- 8. tract index, then write --------------------------------------
    # An ordered tract list, and one index per lot into it. The concentration
    # metric needs to group units by tract; a per-lot income cannot do that.
    order = sorted({geoid_of(l["bct"]) for l in lots if geoid_of(l["bct"])})
    tract_pos = {g: i for i, g in enumerate(order)}
    tract_idx = np.array([tract_pos.get(geoid_of(l["bct"]) or "", -1) for l in lots],
                         dtype=np.float32)
    tract_rows = [{"geoid": g,
                   "income": acs.get(g, {}).get("income", 0),
                   "owner_share": round(acs.get(g, {}).get("owner_share", 0), 4),
                   "lots": int((tract_idx == i).sum())}
                  for i, g in enumerate(order)]
    (out / "tracts.json").write_text(json.dumps({"tracts": tract_rows},
                                                separators=(",", ":")))
    print(f"write: tracts.json {len(tract_rows):,} tracts "
          f"({int((tract_idx < 0).sum()):,} lots with no tract)")

    arr = np.empty((n, 7), dtype=np.float32)
    arr[:, 0] = lon
    arr[:, 1] = lat
    arr[:, 2] = adu_sf
    arr[:, 3] = lot_area
    arr[:, 4] = rent_fmr
    arr[:, 5] = tract_income
    arr[:, 6] = tract_idx
    (out / "lots.bin").write_bytes(arr.tobytes())
    (out / "flags.bin").write_bytes(flags.tobytes())
    lots_bytes = (out / "lots.bin").stat().st_size
    print(f"write: lots.bin {lots_bytes / 1e6:.1f}MB, "
          f"flags.bin {(out / 'flags.bin').stat().st_size / 1e6:.2f}MB")

    # tracts, for the concentration metric and optional shading

    manifest = {
        "sandbox": "pencil",
        "generated": "2026-08-31",
        "borough": "Queens (BoroCode 4)",
        "lots": n,
        "start_year": 2027,
        "start_year_note": "The first year the permitting queue releases lots. "
                           "A choice, not a finding - the programme has no start "
                           "date in it.",
        "bounds": [float(b) for b in bounds],
        "columns": ["lon", "lat", "adu_sf", "lot_area", "rent_fmr",
                    "tract_income", "tract_idx"],
        "column_units": ["degrees", "degrees", "square feet", "square feet",
                         "dollars per month", "dollars per year",
                         "index into tracts.json, -1 for none"],
        "flags": {k: int(v) for k, v in FLAGS.items()},
        "programme": PROGRAMME,
        "assumptions": ASSUMPTIONS,
        "adu_sizing": {
            "method": "min(0.33 * (LotArea - BldgFront * BldgDepth), 800), "
                      "zeroed below 200sf",
            "buildable_share": BUILDABLE_SHARE,
            "max_sf": MAX_ADU_SF,
            "note": "The weakest step in the pipeline. The DBF has no lot "
                    "geometry - no shape, no orientation, no setbacks - so an "
                    "L-shaped lot, a corner lot and a flag lot are treated "
                    "identically. The 800sf cap is the published rule; "
                    "everything before it is an estimate.",
        },
        "rent_ami_monthly": round(rent_cap, 2),
        "rent_ami_note": (
            f"The programme's 100%-AMI rent cap, for a "
            f"{ASSUMPTIONS['adu_bedrooms']['value']}-bedroom at {persons} persons. "
            f"ONE NUMBER FOR THE WHOLE OF QUEENS, and indeed for eight counties: "
            f"HUD publishes income limits only for the New York, NY HUD Metro FMR "
            f"Area (Bronx, Kings, New York, Putnam, Queens, Richmond, Rockland, "
            f"Westchester), so the AMI that sets this cap is computed partly from "
            f"Westchester and Rockland incomes. It is a scalar here rather than a "
            f"column because it genuinely does not vary. Market rent does."),
        "income_limits_100pct": round(income_100, 0),
        "median_family_income": mfi,
        "sources": {
            "pluto": "MapPLUTO 26v2 (data/original/nyc_mappluto_26v2_shp/MapPLUTO.dbf). "
                     "856,687 records, 101 fields; only the .dbf is read.",
            "safmr": "HUD Small Area Fair Market Rents FY2026, 1-bedroom, by ZIP. "
                     "Small Area rather than county on purpose - the county figure "
                     "is one number for the whole metro and would not vary.",
            "income_limits": "HUD FY2026 Income Limits, New York, NY HUD Metro FMR "
                             "Area - EIGHT COUNTIES, not Queens. No smaller "
                             "geography is published.",
            "acs": "Census ACS 5-year 2023, B19013_001E and B25003, tracts in "
                   "state 36 county 081.",
            "flood": flood_note,
            "eligibility": "DERIVED BY US from DCP's City of Yes for Housing "
                           "Opportunity ADU guide. NYC Open Data publishes no ADU "
                           "eligibility layer - the catalogue was searched on "
                           "2026-08-31 and there is none. These flags are our "
                           "reading of a published rule, not a city determination.",
        },
        "joins": {
            "queens_lots": counts["queens"],
            "bldgclass_a_or_b": counts["ab"],
            "landuse_01": counts["landuse01"],
            "tests_disagree": counts["disagree"],
            "dropped_bad_unitsres": counts["bad_units"],
            "dropped_no_centroid": counts["no_coords"],
            "kept": n,
            "lots_with_more_than_one_building": counts["multi_building"],
            "lots_joined_to_a_tract": matched,
            "lots_with_no_safmr_for_their_zip": missing_zip,
            "eligible_attached": int(attached_ok.sum()),
            "eligible_detached": int(detached_ok.sum()),
            "note": "Total every join against a published figure before believing "
                    "it. BldgClass A*/B* and LandUse 01 are independent tests of "
                    "the same thing and they are reported separately above so a "
                    "disagreement between them is visible rather than averaged "
                    "away.",
        },
        "why_this_shape": (
            "Precompute the INPUTS to the pro-forma, never its answers. Every "
            "control changes the arithmetic rather than the data, and the "
            "parameter space is continuous and six-dimensional, so there is no "
            "set of results to precompute. The browser recomputes every lot on "
            "every slider move in one pass over these arrays."),
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"\nwrote {out}/manifest.json")


if __name__ == "__main__":
    main()
