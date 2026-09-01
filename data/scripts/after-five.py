#!/usr/bin/env python3
"""
after-five.py - processing pipeline for Sandbox 03, After Five.

WHAT THE MODEL IS
-----------------
A district of Lower Manhattan in 3D, running a slow clock. Office buildings
recolour to residential as they convert, and grow floors where a filing added
them. Two gates decide whether a building converts in a given year:

  1. a CONVERTIBILITY score, our reading of published criteria
  2. a PRO-FORMA, residential value against conversion cost and the office
     income given up

Neither gate is a prediction. Together they are a statement of what a
conversion-policy argument contains when you write it down.

WHAT THIS SCRIPT IS FOR
-----------------------
Reshaping. The browser gets per-building CONSTANTS and recomputes both gates on
every slider move, exactly as sandbox 02 does - because, as there, every control
changes the arithmetic rather than the data. What is precomputed is only what no
parameter can move: the geometry, the age, the floor areas, the filing record.

INPUTS  (data/original/, as downloaded, never edited in place)
--------------------------------------------------------------
  DA_WISE_GML/DA_WISE_GMLs/DA12 and DA19
      DCP 3-D Building Model as CityGML 2.0, NYC Open Data tnru-abg2.
      EPSG:2263, FEET, LoD2. Twenty delivery areas, 13GB, 1,083,437 buildings.
      TAKEN per building: its BIN, its GroundSurface outline, and every
      RoofSurface with its height - which gives a STACKED massing, podium and
      setback and tower each at their own level, rather than a flat extrusion.
      Lower Manhattan is in DA12; DA19 holds a sliver.

      THE SAME SURVEY IS ALSO PUBLISHED AS RHINO .3dm PER COMMUNITY DISTRICT and
      that was tried first. It carries NO ATTRIBUTES - no BIN, no BBL, nothing -
      so identity had to be inferred by matching each footprint to the nearest
      building-footprint centroid. That looked excellent: 99.5% matched, median
      distance 2 feet. Checked against the CityGML's real BINs, IT WAS WRONG FOR
      ONE BUILDING IN FIVE. In a district of party-wall buildings the nearest
      centroid is frequently the neighbour, and the 2-foot median measured how
      close the nearest one was rather than whether it was the right one.
      Nothing in this pipeline is now joined by position.

  BUILDING_20260830.geojson
      NYC Building Footprints. TAKEN: `bin` and `base_bbl` only, as a lookup
      table so a BIN can be turned into a lot. Streamed a line at a time.

  nyc_mappluto_26v2_shp/MapPLUTO.dbf
      TAKEN per lot, joined on BBL: BldgClass, BldgArea, OfficeArea, ComArea,
      ResArea, NumFloors, YearBuilt, LotArea, BldgFront, BldgDepth, BuiltFAR,
      CommFAR, ResidFAR, UnitsRes, Address. All field names verified against the
      DBF header on 2026-08-31.

  DOB job filings - TWO datasets, and you need both
      ic3t-wcy2   DOB Job Application Filings (the legacy BIS system)
      w9ak-ipjd   DOB NOW: Build - Job Application Filings

      Coverage, checked on 2026-08-31: legacy runs 2000-01-01 to 2025-12-31,
      DOB NOW runs 2016-09 to 2026-08.

      THE MIGRATION LOOKS EXACTLY LIKE A POLICY EFFECT AND IS NOT ONE. Manhattan
      change-of-occupancy filings in the legacy set: 2,293 (2016), 2,054 (2018),
      1,564 (2019), 1,109 (2020) - then 237, 77, 56, 81. The work did not stop;
      it moved systems. A time series off either dataset alone is wrong.

      The job type is coded differently in each, which is the mapping this
      script documents:
        legacy   job_type == 'A1'                    (change of use/occupancy)
        DOB NOW  job_type == 'Alteration CO'
              or job_type == 'ALT-CO - New Building with Existing Elements
                              to Remain'

      DOB NOW ROWS ARE ONE PER FILING DOCUMENT, NOT ONE PER JOB. A single job
      appears as -I1, -P2, -S1 and so on against one base number. Without
      deduplicating on the base number every conversion is counted three to five
      times - the same shape of bug as bathtub's UnitsRes.

      A FILING IS NOT A BUILDING. Applications get withdrawn, superseded, and
      never permitted. The status filter is stated in the manifest.

      Fields differ between the two systems and the difference decides what the
      sandbox can show:
        BOTH:     existing/proposed dwelling units  -> "units created"
        LEGACY ONLY: existing/proposed height and stories, enlargement sq
                  footage, and existing/proposed zoning sqft
        DOB NOW:  total_construction_floor_area only, which is the floor area of
                  the WORK and not of any ADDITION - a gut renovation with no
                  enlargement reports a large number, so it is NOT used as
                  added area.
      Consequence, stated in the card: ADDED FLOORS COME FROM LEGACY FILINGS
      ONLY. Buildings that converted through DOB NOW convert without growing.

OUTPUTS (data/processed/after-five/)
------------------------------------
  manifest.json     district bounds, building count, column order, the
                    convertibility weights (ours), the filing statuses kept, the
                    job-type mapping, source provenance, every join total
  buildings.bin     Float32Array, row-major, per building - see `columns`
  footprints.json   stacked massing outlines, keyed by index into buildings.bin
  filings.json      the historical change-of-occupancy record per BIN

WHAT IS CUT, AND WHY
--------------------
  THE BACK-TEST. The spec proposed seeding 1995 in FiDi and running to 2010
  against what 421-g produced. The legacy dataset's earliest pre-filing date is
  2000-01-01. It does not reach 1995 and no amount of care makes it. A
  validation that silently starts in 2003 is worse than none, so there is none,
  and the card says the model is not validated against history - which is true
  of most models a student will meet.

  THE WEEKEND ACTIVITY INDEX. It needs a weekend profile. Deriving one from a
  weekday distribution is invented precision.

USAGE
-----
Run from the repo root.

    .venv/bin/python data/scripts/after-five.py
    .venv/bin/python data/scripts/after-five.py --districts MN01 MN05
    .venv/bin/python data/scripts/after-five.py --skip-dob   # reuse cached filings
"""

import argparse
import json
import sys
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from _common import env, original_dir, read_dbf     # noqa: E402
from afterfive_massing import (DELIVERY_AREAS, read_citygml, to_buildings,  # noqa: E402
                               to_wgs84)

FT2_PER_M2 = 10.7639

# --- 467-m, verified 2026-08-31 --------------------------------------------
# nyc.gov/assets/hpd/downloads/pdfs/services/467m-requirements-faq.pdf
#
# The BENEFIT SCHEDULE - the exemption percentage and its duration, which vary
# by area under RPTL 467-m - is NOT in the FAQ and was not verified. So 467-m is
# modelled as a BINARY ELIGIBILITY GATE ONLY. It does not change the arithmetic,
# it decides whether a building may play. The card says exactly that.
INCENTIVE_467M = {
    "source": "HPD 467-m requirements FAQ, read 2026-08-31",
    "prior_use_nonresidential_share": 0.90,   # CO for non-residential over
                                              # "not less than ninety percent"
    "min_units": 6,
    "min_preexisting_share": 0.50,            # "at least fifty percent ... must
                                              # consist of the pre-existing
                                              # building" - NOT CHECKABLE from
                                              # any dataset here; treated as
                                              # satisfied, and said to be
    "affordable_share": 0.25,
    "waami_cap_pct": 80,
    "commence_after": "2022-12-31",
    "commence_before": "2031-06-30",
    "complete_by": "2039-12-31",
    "benefit_schedule": "NOT VERIFIED - not carried in the FAQ. Modelled as a "
                        "binary eligibility gate only, with no abatement value.",
}

# --- the convertibility score ----------------------------------------------
# From Gensler's published convertibility criteria. GENSLER'S ACTUAL SCORING AND
# WEIGHTS ARE NOT PUBLISHED in a form anyone can implement, so what is built
# here is OUR score of THEIR criteria. That sentence, or one like it, is in the
# model card. Do not present this as Gensler's algorithm.
#
# Two of their criteria are dropped outright rather than faked:
#   window operability - not derivable from anything available
#   elevator count     - not in MapPLUTO; inventing one from floor area would
#                        be exactly the failure this course is about
CONVERTIBILITY = {
    "note": "OUR score of published criteria, not Gensler's algorithm. Weights "
            "are ours and are exposed here so they can be argued with.",
    "weights": {
        "floorplate_depth": 0.35,
        "floor_to_floor": 0.25,
        "floorplate_area": 0.20,
        "age": 0.20,
    },
    "dropped": {
        "window_operability": "Not derivable from any dataset available. Dropped.",
        "elevator_count": "Not in MapPLUTO. Dropped rather than invented from "
                          "floor area.",
    },
    "proxies": {
        "floorplate_depth": "BldgDepth halved, as a core-to-window estimate. "
                            "Assumes a centred core and a rectangular plate; "
                            "both are often wrong.",
        "floor_to_floor": "Modelled height divided by NumFloors. Averages over "
                          "mechanical floors and lobbies.",
        "floorplate_area": "BldgArea / NumFloors.",
        "age": "YearBuilt, standing in for facade type AND structural bay - two "
               "criteria it does not actually measure.",
    },
}

DOB_LEGACY = "ic3t-wcy2"     # DOB Job Application Filings (legacy BIS)
DOB_CO = "pkdm-hqz6"         # DOB NOW: Certificate of Occupancy

# The build doc named w9ak-ipjd, "DOB NOW: Build - Job Application Filings", as
# the modern half of the record. IT CONTAINS ONLY BROOKLYN - 86,130 rows, every
# job filing number prefixed B, no Manhattan at all. Checked 2026-08-31. So it
# cannot repair the legacy dataset's Manhattan coverage and it is not used.
#
# pkdm-hqz6 is citywide (30,422 Manhattan rows) and is arguably the better
# source anyway: a certificate of occupancy is a COMPLETION, where a job filing
# is only an application. "A filing is not a building" - a CO very nearly is.
DOB_CO_TYPES = ("Alteration CO", "CO - New Building with Existing Elements to Remain")

# AND A CERTIFICATE IS NOT A CONVERSION EITHER, one layer deeper. Of the 81,139
# certificates in the dataset, 46,772 are "Renewal Without Change" and 6,595 are
# "Renewal With Change" - re-issued paperwork for buildings that converted years
# ago, or never converted at all. Counting those as conversions would invent a
# wave of activity out of an administrative process. Only the first certificate
# after the work counts.
DOB_CO_FILING_KEEP = ("Initial", "Final")

# MapPLUTO's own CD field. Manhattan CD1 is 101, CD5 is 105 - so the district
# is selected by an ID rather than by a boundary polygon, and a building is
# either in it or not.
DISTRICT_CD = {"MN01": 101, "MN05": 105}


def socrata(dataset, params, timeout=300):
    url = f"https://data.cityofnewyork.us/resource/{dataset}.json?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.loads(r.read().decode())


def fetch_filings(cache, skip):
    """Change-of-occupancy filings in Manhattan, from BOTH DOB systems."""
    if skip and cache.exists():
        print(f"dob: reusing {cache.name}")
        return json.loads(cache.read_text())

    print("dob: fetching legacy A1 filings (ic3t-wcy2)")
    legacy = socrata(DOB_LEGACY, {
        "$select": "bin__,bbl,pre__filing_date,job_status,existing_dwelling_units,"
                   "proposed_dwelling_units,existing_occupancy,proposed_occupancy,"
                   "existingno_of_stories,proposed_no_of_stories,existing_height,"
                   "proposed_height,enlargement_sq_footage,existing_zoning_sqft,"
                   "proposed_zoning_sqft,job__",
        "$where": "job_type='A1' AND borough='MANHATTAN'",
        "$limit": 100000,
    })
    print(f"dob: {len(legacy):,} legacy A1 rows")

    print("dob: fetching certificates of occupancy (pkdm-hqz6)")
    types = " OR ".join(f"job_type='{t}'" for t in DOB_CO_TYPES)
    filings = " OR ".join(f"c_of_o_filing_type='{t}'" for t in DOB_CO_FILING_KEEP)
    now = socrata(DOB_CO, {
        "$select": "bin,bbl,job_type,number_of_dwelling_units,"
                   "c_of_o_issuance_date,c_of_o_filing_type,c_of_o_status",
        "$where": f"({types}) AND ({filings}) AND borough='Manhattan'",
        "$limit": 100000,
    })
    print(f"dob: {len(now):,} Manhattan change-of-occupancy certificates "
          f"(initial and final only, renewals excluded)")

    out = {"legacy": legacy, "now": now}
    cache.write_text(json.dumps(out))
    return out


def index_filings(raw):
    """One record per BIN: units created, floors added, and when.

    Deduplicates DOB NOW on the BASE job filing number - the part before the
    document suffix - because one job appears as -I1, -P2, -S1 and counting the
    rows counts the same conversion several times over.
    """
    by_bin = defaultdict(lambda: {"units_before": 0, "units_after": 0,
                                  "floors_added": 0, "area_added": 0.0,
                                  "year": None, "source": None})
    stats = Counter()

    for r in raw["legacy"]:
        b = r.get("bin__")
        if not b:
            continue
        stats["legacy_rows"] += 1
        d = r.get("pre__filing_date") or ""
        year = int(d[-4:]) if len(d) >= 4 and d[-4:].isdigit() else None

        def num(k):
            try:
                return float(r.get(k) or 0)
            except (TypeError, ValueError):
                return 0.0

        eu, pu = num("existing_dwelling_units"), num("proposed_dwelling_units")
        es, ps = num("existingno_of_stories"), num("proposed_no_of_stories")
        ez, pz = num("existing_zoning_sqft"), num("proposed_zoning_sqft")
        rec = by_bin[str(b)]
        if pu > eu and (rec["year"] is None or (year or 9999) < rec["year"]):
            rec.update(units_before=eu, units_after=pu, year=year, source="legacy")
            rec["floors_added"] = max(0.0, ps - es)
            # Legacy carries a real floor-area delta. DOB NOW does not.
            rec["area_added"] = max(0.0, pz - ez) or num("enlargement_sq_footage")
            stats["legacy_conversions"] += 1

    for r in raw["now"]:
        b = r.get("bin")
        if not b:
            continue
        stats["co_rows"] += 1
        # "06/18/25  9:43:09 AM" - two-digit year, so 2000 + it.
        d = (r.get("c_of_o_issuance_date") or "").strip()
        year = None
        parts = d.split("/")
        if len(parts) >= 3 and parts[2][:2].isdigit():
            year = 2000 + int(parts[2][:2])

        try:
            units = float(r.get("number_of_dwelling_units") or 0)
        except (TypeError, ValueError):
            units = 0.0
        if units <= 0:
            stats["co_no_units"] += 1
            continue

        rec = by_bin[str(b)]
        # Keep the EARLIEST certificate per building - the one that recorded the
        # conversion rather than a later re-issue.
        if rec["year"] is None or (year or 9999) < rec["year"]:
            rec.update(units_before=0.0, units_after=units, year=year, source="co")
            # NO floors added from this source: a certificate of occupancy
            # carries no height, stories or enlargement figure at all.
            rec["floors_added"] = 0.0
            rec["area_added"] = 0.0
            stats["co_conversions"] += 1

    print(f"dob: {stats['legacy_conversions']:,} conversions from legacy filings, "
          f"{stats['co_conversions']:,} from certificates of occupancy")
    print(f"dob: dropped {stats['co_no_units']:,} certificates with no dwelling units")
    return dict(by_bin), stats


def norm(v, lo, hi):
    """Clamp to 0..1. Used to put four incomparable proxies on one scale."""
    if hi == lo:
        return 0.0
    return float(np.clip((v - lo) / (hi - lo), 0.0, 1.0))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--districts", nargs="+", default=["MN01", "MN05"],
                    choices=sorted(DISTRICT_CD))
    ap.add_argument("--original", type=Path, default=None)
    ap.add_argument("--out", type=Path, default=Path("data/processed/after-five"))
    ap.add_argument("--skip-dob", action="store_true")
    args = ap.parse_args()

    original = original_dir(args.original)
    out = args.out
    out.mkdir(parents=True, exist_ok=True)

    # ---- 1. the district, by ID -------------------------------------------
    # MapPLUTO carries CD, so the district is a filter on a number rather than a
    # point-in-polygon test against a boundary. Every join below is ID to ID.
    wanted_cd = {DISTRICT_CD[d] for d in args.districts}
    cols = ["BBL", "CD", "BoroCode", "BldgClass", "BldgArea", "OfficeArea",
            "ComArea", "ResArea", "NumFloors", "YearBuilt", "LotArea",
            "BldgFront", "BldgDepth", "BuiltFAR", "CommFAR", "ResidFAR",
            "UnitsRes", "Address"]
    pluto = {}
    for rec in read_dbf(original / "nyc_mappluto_26v2_shp" / "MapPLUTO.dbf", cols):
        if rec["borocode"] != "1":
            continue
        try:
            cd = int(float(rec["cd"] or 0))
            bbl = int(float(rec["bbl"]))
        except ValueError:
            continue
        if cd in wanted_cd:
            pluto[bbl] = rec
    print(f"pluto: {len(pluto):,} lots in {'/'.join(args.districts)} "
          f"(CD {sorted(wanted_cd)})")

    # ---- 2. BIN -> BBL, then the massing ----------------------------------
    # NYC Building Footprints is used ONLY as a lookup table here: it turns a
    # BIN into the lot it stands on. No geometry from it is used and nothing is
    # matched by position.
    bin_to_bbl = {}
    with open(original / "BUILDING_20260830.geojson", "r") as f:
        for line in f:
            line = line.strip().rstrip(",")
            if not line.startswith('{"type":"Feature"'):
                continue
            try:
                p_ = json.loads(line)["properties"]
                b, lot = p_.get("bin"), p_.get("base_bbl")
                if b and lot:
                    bin_to_bbl[str(int(b))] = int(lot)
            except (ValueError, KeyError, TypeError):
                continue
    keep_bins = {b for b, lot in bin_to_bbl.items() if lot in pluto}
    print(f"join: {len(bin_to_bbl):,} BIN-to-BBL pairs citywide; "
          f"{len(keep_bins):,} BINs stand on a lot in the district")

    gml_dir = original / "DA_WISE_GML" / "DA_WISE_GMLs"
    paths = [gml_dir / f"{da}_3D_Buildings_Merged.gml" for da in DELIVERY_AREAS]
    missing = [p_ for p_ in paths if not p_.exists()]
    if missing:
        raise SystemExit(f"CityGML not found: {', '.join(str(m) for m in missing)}")
    raw = read_citygml(paths, keep_bins=keep_bins)
    buildings = to_buildings(raw)
    to_wgs84(buildings)
    # Which district each building is in, by its lot's CD - an ID again, not a
    # boundary test. The index is into args.districts.
    cd_index = {DISTRICT_CD[d]: i for i, d in enumerate(args.districts)}
    for b in buildings:
        b["bbl"] = bin_to_bbl.get(str(b["bin"]), 0)
        rec = pluto.get(b["bbl"])
        try:
            b["district"] = cd_index.get(int(float(rec["cd"])), 0) if rec else 0
        except (ValueError, TypeError):
            b["district"] = 0
    print(f"massing: {len(buildings):,} of {len(keep_bins):,} district BINs "
          f"appear in the CityGML")

    # ---- 3. filings ------------------------------------------------------
    raw = fetch_filings(original / "dob_manhattan_conversions.json", args.skip_dob)
    filings, dob_stats = index_filings(raw)
    matched_filings = sum(1 for b in buildings if str(b["bin"]) in filings)
    print(f"dob: {matched_filings:,} of {len(buildings):,} modelled buildings "
          f"carry a conversion filing")

    # ---- 4. per-building constants ---------------------------------------
    #
    # MAPPLUTO AREAS ARE PER LOT, NOT PER BUILDING. Several buildings can stand
    # on one tax lot, and attributing the lot's whole floor area to each of them
    # multiplies the district's office stock several times over - the same bug,
    # in the same shape, as bathtub's UnitsRes. So the lot's area columns are
    # divided across the buildings that stand on it.
    #
    # It is a crude split: it gives a mechanical room the same share as the
    # tower beside it. Weighting by footprint area would be better and is not
    # done here, because the footprint we have is the ground surface and the
    # floor area is the whole stack. Named in the card.
    per_lot = Counter(b["bbl"] for b in buildings if b["bbl"])
    multi = sum(1 for v in per_lot.values() if v > 1)
    print(f"build: {multi:,} lots carry more than one modelled building; "
          f"their lot-level floor areas are divided across them")

    rows = []
    kept = 0
    for b in buildings:
        p = pluto.get(b["bbl"])
        if not p:
            continue

        share = 1.0 / max(1, per_lot.get(b["bbl"], 1))

        def num(k, per_building=False):
            try:
                v = float(p[k.lower()] or 0)
            except (ValueError, KeyError):
                return 0.0
            return v * share if per_building else v

        floors = num("NumFloors")
        bldg_area = num("BldgArea", True)
        office_area = num("OfficeArea", True)
        year_built = num("YearBuilt")
        depth = num("BldgDepth")
        height_ft = b["height"]          # from the CityGML roof surfaces, feet

        plate_area = bldg_area / floors if floors > 0 else 0.0
        f2f = height_ft / floors if floors > 0 else 0.0

        # The four proxies, each normalised to 0..1 where 1 is EASIER to convert.
        # The ranges are ours and they are in the manifest.
        s_depth = 1.0 - norm(depth / 2.0, 20.0, 70.0)      # shallow plate is better
        s_f2f = norm(f2f, 9.0, 16.0)                        # taller floor is better
        s_area = 1.0 - norm(plate_area, 5000.0, 40000.0)    # smaller plate is better
        s_age = 1.0 - norm(year_built, 1900.0, 1990.0)      # older is better
        w = CONVERTIBILITY["weights"]
        score = (w["floorplate_depth"] * s_depth + w["floor_to_floor"] * s_f2f
                 + w["floorplate_area"] * s_area + w["age"] * s_age)

        f = filings.get(str(b["bin"]))
        rows.append({
            "b": b, "p": p,
            "vals": [
                b["centroid_ll"][0], b["centroid_ll"][1],
                height_ft, floors, bldg_area, office_area,
                num("ResArea", True), num("ComArea", True), year_built,
                score,
                f["units_after"] - f["units_before"] if f else 0.0,
                f["floors_added"] if f else 0.0,
                f["year"] if (f and f["year"]) else 0.0,
                b["area"], float(b["district"]),
            ],
        })
        kept += 1

    print(f"build: {kept:,} buildings with both massing and PLUTO")
    scores = np.array([r["vals"][9] for r in rows])
    print(f"build: convertibility score {scores.min():.2f}-{scores.max():.2f}, "
          f"median {np.median(scores):.2f}")
    off = np.array([r["vals"][5] for r in rows])
    print(f"build: {int((off > 0).sum()):,} buildings carry office floor area "
          f"({off.sum() / 1e6:,.1f}M sf in total)")

    COLUMNS = ["lon", "lat", "height_ft", "floors", "bldg_area", "office_area",
               "res_area", "com_area", "year_built", "convertibility",
               "units_created", "floors_added", "converted_year", "footprint_area",
               "district"]
    arr = np.array([r["vals"] for r in rows], dtype=np.float32)
    (out / "buildings.bin").write_bytes(arr.tobytes())

    # ---- 5. footprints ---------------------------------------------------
    # The stacked massing: the outline, plus each roof level's height above the
    # base. Coordinates rounded to six decimals - about 10cm, far finer than a
    # 2014 aerial survey resolves - because the JSON is otherwise mostly digits.
    foot = []
    for r in rows:
        b = r["b"]
        ring = [[round(lo, 6), round(la, 6)] for lo, la in b["lonlat"]]
        levels = [round(h, 1) for h, _ in b["levels"]]
        foot.append({"r": ring, "l": levels})
    (out / "footprints.json").write_text(json.dumps(foot, separators=(",", ":")))

    # Only the district's buildings - the fetch covers all of Manhattan, and
    # shipping the rest would be 1.5MB of a borough nobody is looking at.
    district_bins = {str(r["b"]["bin"]) for r in rows}
    (out / "filings.json").write_text(json.dumps(
        {k: v for k, v in filings.items() if k in district_bins},
        separators=(",", ":")))

    sizes = {f: (out / f).stat().st_size for f in
             ("buildings.bin", "footprints.json", "filings.json")}
    for k, v in sizes.items():
        print(f"write: {k} {v / 1e6:.2f}MB")

    # Average household size, so "units created" can become "residents added".
    # ACS B25010_001E for the county, which is Manhattan. Published, not guessed.
    household_size = 0.0
    key = env("CENSUS_API_KEY")
    if key:
        try:
            url = ("https://api.census.gov/data/2023/acs/acs5?get=B25010_001E"
                   f"&for=county:061&in=state:36&key={key}")
            with urllib.request.urlopen(url, timeout=60) as r:
                rows_ = json.loads(r.read().decode())
            household_size = float(rows_[1][0])
            print(f"acs: average household size in Manhattan is {household_size}")
        except Exception as e:
            print(f"acs: household size unavailable ({e}); leaving it out")

    lons = arr[:, 0]
    lats = arr[:, 1]
    manifest = {
        "sandbox": "after-five",
        "generated": "2026-08-31",
        "districts": args.districts,
        "buildings": kept,
        "bounds": [float(lons.min()), float(lats.min()),
                   float(lons.max()), float(lats.max())],
        # Manhattan CD1 includes Governors Island, which is real and is a mile
        # from everything else, so the true bounds put the district in a corner
        # of the frame. The view box is the 2nd-98th percentile of building
        # positions: it frames where the buildings actually are, and the island
        # is still drawn.
        "view_bounds": [float(np.percentile(lons, 2)), float(np.percentile(lats, 2)),
                        float(np.percentile(lons, 98)), float(np.percentile(lats, 98))],
        "district_view_bounds": {
            d: ([float(np.percentile(arr[arr[:, 14] == i][:, 0], 2)),
                 float(np.percentile(arr[arr[:, 14] == i][:, 1], 2)),
                 float(np.percentile(arr[arr[:, 14] == i][:, 0], 98)),
                 float(np.percentile(arr[arr[:, 14] == i][:, 1], 98))]
                if (arr[:, 14] == i).any() else None)
            for i, d in enumerate(args.districts)
        },
        "columns": COLUMNS,
        "column_units": ["degrees", "degrees", "feet", "storeys", "sq ft", "sq ft",
                         "sq ft", "sq ft", "year", "0-1", "units", "storeys",
                         "year or 0", "sq ft", "index into districts"],
        "snapshot_years": [2025, 2030, 2035, 2040, 2045, 2050],
        "household_size": household_size or None,
        "household_size_source": "Census ACS 5-year 2023, B25010_001E, New York "
                                 "County. Used to turn units into residents. It "
                                 "is a borough average applied to every new "
                                 "unit, and new conversion units skew smaller "
                                 "than the borough's stock.",
        "browser_assumptions": {
            "note": "These live in the front end (gates.js) because they are "
                    "arithmetic rather than data. Each is ours unless marked.",
            "cap_rate": 0.055,
            "opex_share": 0.35,
            "office_rent_base_psf_yr": 62,
            "office_rent_base_note": "Asking rent per square foot per year for "
                                     "Lower Manhattan office space in the base "
                                     "year. AN ASSUMPTION - no published series "
                                     "was verified for it - and it sets where "
                                     "the office_rent_trend control bites.",
            "sf_per_unit": 900,
            "sf_per_unit_note": "Floor area per apartment, used to turn "
                                "converted office area into a unit count.",
            "base_year": 2025,
        },
        "convertibility": CONVERTIBILITY,
        "convertibility_ranges": {
            "floorplate_depth_ft": [20, 70],
            "floor_to_floor_ft": [9, 16],
            "floorplate_area_sf": [5000, 40000],
            "year_built": [1900, 1990],
            "note": "Ours. Each proxy is clamped to its range and normalised so "
                    "that 1 means easier to convert.",
        },
        "incentive_467m": INCENTIVE_467M,
        "dob": {
            "datasets": {"legacy": DOB_LEGACY, "certificates_of_occupancy": DOB_CO},
            "job_type_mapping": {
                "legacy": "job_type == 'A1' (change of use / occupancy)",
                "certificates_of_occupancy": list(DOB_CO_TYPES),
            },
            "co_filing_types_kept": list(DOB_CO_FILING_KEEP),
            "coverage": {"legacy": "2000-01-01 to 2025-12-31",
                         "certificates_of_occupancy": "roughly 2022 to 2025"},
            "dataset_not_used": {
                "id": "w9ak-ipjd",
                "name": "DOB NOW: Build - Job Application Filings",
                "why": "The build doc named this as the modern half of the "
                       "record. IT CONTAINS ONLY BROOKLYN - 86,130 rows, every "
                       "job filing number prefixed B, no Manhattan at all "
                       "(checked 2026-08-31). It cannot repair the legacy "
                       "dataset's Manhattan coverage, so it is not used.",
            },
            "counts": dict(dob_stats),
            "migration_warning": "Legacy Manhattan change-of-occupancy filings "
                                 "fall from 1,109 in 2020 to 237, 77 and 56 in "
                                 "2021-2023. That is the migration to DOB NOW, "
                                 "not a policy effect. A time series off the "
                                 "legacy dataset alone would show conversions "
                                 "collapsing exactly when everyone says they "
                                 "accelerated.",
            "renewal_warning": "Of 81,139 certificates of occupancy, 46,772 are "
                               "'Renewal Without Change' and 6,595 'Renewal "
                               "With Change' - re-issued paperwork for buildings "
                               "that converted years ago or never converted. "
                               "Counting them would invent a wave of activity "
                               "out of an administrative process. Only Initial "
                               "and Final certificates are kept, earliest per "
                               "building.",
            "added_floors_note": "Added floors come from LEGACY filings only. "
                                 "The other source carries none: its "
                                 "a certificate of occupancy carries no "
                                 "height, stories or enlargement figure at all. "
                                 "So buildings recorded as converting after "
                                 "about 2021 convert WITHOUT GROWING, and that "
                                 "is a limit of the record rather than of the "
                                 "buildings.",
        },
        "back_test": "CUT. The spec proposed validating against 421-g from 1995. "
                     "The legacy dataset's earliest pre-filing date is "
                     "2000-01-01, so it cannot reach. The model is not validated "
                     "against history and the card says so.",
        "sources": {
            "massing": "DCP NYC 3D Model by Community District (NYC Open Data "
                       "u5j4-zxpn), EPSG:2263 feet. THE FILE CARRIES NO "
                       "ATTRIBUTES - no BIN, no BBL, nothing - so identity is "
                       "inferred by spatial match against NYC Building "
                       "Footprints: 99.5% matched, median distance 2 feet.",
            "pluto": "MapPLUTO 26v2, joined on the BBL recovered by that match.",
            "dob": "DOB job filings, both systems, unioned.",
        },
        "why_this_shape": (
            "Per-building constants, both gates recomputed in the browser on "
            "every slider move. Same reasoning as sandbox 02: every control "
            "changes the arithmetic rather than the data, so there is nothing to "
            "precompute except what no parameter can move."),
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"\nwrote {out}/manifest.json")


if __name__ == "__main__":
    main()
