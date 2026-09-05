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
  lots.bin        Float32Array, row-major, 9 floats per lot:
                    lon, lat, lot_front, required_rear_yard_depth, lot_area,
                    rent_fmr, tract_income, tract_idx, bldg_type
                  tract_idx indexes tracts.json's array. It is here because the
                  concentration metric - the share of new units landing in the
                  top tenth of tracts - has to GROUP by tract, which an income
                  value alone cannot do.
  rear.bin        Int16Array, five per lot, whole feet, lots.bin's row order:
                    rear_box_x, rear_box_y, rear_box_depth, rear_box_width,
                    frontage_count
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
import re
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

# --- the ADU rules, from the Zoning Resolution itself -----------------------
# ZR 23-341(b)(4) and ZR 23-342, verified 2026-09-01 from
# zoningresolution.planning.nyc.gov. The previous version of this pipeline took
# its sizing from a secondary reading and applied the one-third fraction to the
# WHOLE open area of the lot. The rule applies it to the REQUIRED REAR YARD,
# which is a much smaller and district-dependent thing - which is why the old
# median came out at 707sf with 109,032 lots pinned to the 800sf cap, and the
# corrected median is about 230sf with the cap never binding at all.
MAX_ADU_SF = 800                    # ZR 12-10, "not exceeding 800 square feet"
DETACHED_EXCLUDED_DISTRICTS = ("R1-2A", "R2A", "R3A")

# ZR 23-341(b)(4), permitted obstructions in required rear yards:
#   "the size shall be limited to an area not exceeding one-third of the rear
#    yard or rear yard equivalent"
#   "where such building is free-standing ... it shall not be closer than five
#    feet to a rear lot line or side lot line"
# The section names DETACHED, ZERO LOT LINE and SEMI-DETACHED buildings.
# ATTACHED buildings are not in it, so an attached house cannot have a backyard
# ADU at all. The last build's "detached only" reading was wrong in both
# directions: it excluded semi-detached, which the rule allows, and it reasoned
# about attached, which the rule excludes.
REAR_YARD_FRACTION = 1.0 / 3.0
SIDE_SETBACK_FT = 5.0

# ZR 23-342, required rear yard depth, in feet.
REAR_YARD_DEPTH = {
    "detached": 20.0,               # and zero lot line. 30 above 75ft of height,
                                    # which no one-to-two-family house reaches.
    "semi_narrow": 30.0,            # semi-detached / attached, lot width < 40ft
    "semi_wide": 20.0,              # semi-detached / attached, lot width >= 40ft
}
# Shallow interior lots - under 95 feet deep, existing since 1961-12-15 - reduce
# the required depth by six inches per foot of deficiency, with a floor of ten
# feet. The 1961 vintage test is not checkable from MapPLUTO and is treated as
# satisfied; that is named in the manifest.
SHALLOW_LOT_DEPTH_FT = 95.0
SHALLOW_LOT_REDUCTION_PER_FT = 0.5
SHALLOW_LOT_FLOOR_FT = 10.0

# THE NARROW SEMI-DETACHED CASE GETTING A DEEPER REQUIRED YARD IS NOT A MISREAD.
# It means the one-third allowance is larger on exactly the narrow lots you would
# expect to be worst off, and there is a cliff at 40 feet of lot width where it
# drops back. HPD's guidebook gives a flat "20 feet" for everything, which is the
# detached case only - the ZR is used here and the guidebook is cited for the
# plain-language framing.

# The practical floor. HPD's ADU Homeowner Guidebook states that combining the
# habitability minimums - a 70sf habitable room at 7ft minimum dimension, a
# kitchen, a bathroom and a code-compliant egress - puts "the practical minimum
# size for most ADUs" at 250 to 300 square feet. Take 300. Below it the lot
# produces no unit.
MIN_ADU_SF = 300

# --- building type: DOF's own field, not our threshold ---------------------
# MapPLUTO carries ProxCode, the Department of Finance proximity code:
#   1 detached   2 semi-attached   3 attached   0 not available
# It is populated on 246,640 of the 246,921 Queens one-to-two-family lots.
#
# The build doc classified type from the LotFront - BldgFront gap with cutoffs
# at 2 and 10 feet, on the belief that MapPLUTO had no building-type field. It
# does. The gap proxy is still computed, but only as a CROSS-CHECK reported in
# the manifest - the same way BldgClass A*/B* and LandUse 01 are two independent
# tests of the same thing, reported separately so a disagreement is visible
# rather than averaged away.
#
# One interpretation is being made and it belongs in the card: DOF says
# "semi-attached" and the Zoning Resolution says "semi-detached", and they are
# being treated as the same category.
PROX_CODE = {"1": "detached", "2": "semi_detached", "3": "attached"}
GAP_SEMI_FT = 2.0        # LotFront - BldgFront below this reads as attached
GAP_DETACHED_FT = 10.0   # and above this as detached

# --- HPD's own numbers, recovered from HPD's own tools ---------------------
# Not assumptions. Each was read off a published HPD product on 2026-09-01.
HPD_BUDGET = {
    "source": "HPD ADU Budgeting Tool, housing.hpd.nyc.gov/adu/budget. The "
              "defaults were read off the controls and the behaviour was "
              "measured by varying one control at a time at a $500,000 hard "
              "cost, on 2026-09-01.",
    "soft_cost_flat": 50000,
    "soft_cost_share_of_hard": 0.48,
    "soft_cost_formula": "soft cost = $50,000 + 0.48 x hard cost. Exact, checked "
                         "at hard costs of 100k, 200k, 300k and 500k.",
    "the_unlabelled_term": (
        "THE FINDING WORTH TEACHING, AND IT IS WHY THIS PIPELINE USES THE "
        "MEASURED FORMULA RATHER THAN THE PUBLISHED INPUTS. The tool exposes "
        "four cost inputs that together account for 0.20 + 0.08 of hard cost "
        "plus $50,000 flat. Its actual output is 0.48 of hard cost plus $50,000. "
        "There is a 20%-of-hard-cost term the tool never shows the user, equal "
        "in size to the largest one it does show. It is probably general "
        "contractor overhead and profit. It is not labelled anywhere in the "
        "interface, and it was found by moving one slider at a time."),
    "published_inputs": {
        "design_survey_permitting_share": 0.20,   # published range 0.10-0.25
        "contingency_share": 0.08,                # published range 0.05-0.10
        "site_prep": 20000,                       # published range 0-40,000
        "utility_hookup": 30000,                  # published range 10,000-50,000
    },
    "operating": {
        "upkeep_share": 0.20,        # published range 0.10-0.30
        "management_share": 0.04,    # published range 0-0.08
        "insurance_monthly": 200,    # published range 0-300
        "turnover_rate": 0.15,       # published range 0.05-0.25
    },
    "financing_note": (
        "HPD IS RUNNING TWO DIFFERENT FINANCINGS FOR THE SAME BUILDING. The "
        "budgeting tool assumes a 7.5%, 20-year market loan; Plus One is 5% over "
        "15 years, extendable to 30. Both are HPD, on the same website. This "
        "sandbox models Plus One, because Plus One is the programme it is about, "
        "and the operating figures above are taken from the budgeting tool "
        "because Plus One's term sheet does not carry any."),
}

# --- the Pre-Approved Plan Library -----------------------------------------
# housing.hpd.nyc.gov/adu/library. Eleven designs, each publishing dimensions,
# square footage and a cost range. Transcribed to data/original/hpd_papl_plans.json
# on 2026-09-01 and re-verified against the live index the same day.
PAPL_FILE = "hpd_papl_plans.json"
# The city's building footprints, used only to work out which way the back of a
# lot is. 962MB, streamed and regex-filtered - see read_building_centroids.
BUILDINGS_FILE = "BUILDING_20260830.geojson"
# The narrowest DETACHED design in the library, in feet. SITU ADU at 14ft.
# The library's narrowest design overall is 12ft, but that one is attached, and
# an attached ADU is not what this pipeline sizes.
NARROWEST_DETACHED_PLAN_FT = 14.0

# --- assumptions that are still ours, not anybody's ------------------------
# Each of these is a number with no published source that we could find. They
# are named here, carried into the manifest, and stated in the model card. A
# figure that looks sourced and is not is the failure this course is about.
#
# THIS LIST USED TO BE LONGER. soft_cost, opex_share and cost_per_sf_default
# have all moved out of it and into HPD_BUDGET and the plan library, because
# they now have sources. That migration is the point of this build.
ASSUMPTIONS = {
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
    "shallow_lot_vintage": {
        "value": True,
        "note": "ZR 23-342's shallow-lot reduction applies to interior lots "
                "'existing on December 15, 1961'. MapPLUTO cannot say whether a "
                "lot line existed on that date, so every shallow lot is treated "
                "as qualifying. This makes the model slightly GENEROUS on the "
                "13.9% of lots the reduction touches.",
    },
    "adu_sits_in_the_required_rear_yard": {
        "value": True,
        "note": "OPEN QUESTION, AND IT IS THE ONE THAT WOULD MOVE THE ANSWER "
                "MOST. ZR 23-341 permits an ADU in the required rear yard, as an "
                "obstruction. A lot whose open area runs deeper than the required "
                "yard has space between the house and that yard which is not a "
                "required yard at all, and is governed by lot coverage and FAR "
                "instead. If an ADU may sit there, the one-third rule is not the "
                "binding cap on deep lots and this map is too harsh. HPD's "
                "guidebook and its eligibility tool both present the one-third "
                "rule as THE size cap, so modelling it as the cap is defensible - "
                "but it has not been checked against the lot coverage rules.",
    },
}

# --- flags.bin bitfield ----------------------------------------------------
# Eight bits, and all eight are spoken for.
#
# `eligible_attached` IS GONE. It named an attached ADU - an extension of the
# house - which this pipeline never measured and never priced: the unit is sized
# from the rear yard, which is what a backyard cottage occupies. The front end
# had `wantDetached = true` hardcoded, so the flag decided nothing. A flag that
# decides nothing is worse than a missing one, for the same reason the
# owner-occupancy control was cut in the last build.
#
# THE TWO FLOOD FLAGS ARE NEW AND THE OLD PAIR WERE NAMING THE WRONG RULE.
# See the flood section of main() for what the Zoning Resolution actually says.
FLAGS = {
    "two_family": 1 << 0,
    "eligible_backyard": 1 << 1,
    "in_10yr_rainfall_frra": 1 << 2,
    "in_coastal_frra": 1 << 3,
    "in_high_risk_flood_zone": 1 << 4,
    "in_historic_district": 1 << 5,
    "excluded_district": 1 << 6,
    "city_owned": 1 << 7,
}

# lots.bin column 7. Kept out of the bitfield because it is a category, not a
# predicate, and it needs three values plus "unknown".
BLDG_TYPE = {"attached": 0, "semi_detached": 1, "detached": 2, "unknown": 3}


# --------------------------------------------------------------------------
# Siting: where on the lot the unit would actually go
# --------------------------------------------------------------------------
#
# THIS IS THE ONLY PART OF THE PIPELINE THAT OPENS THE .shp, and it is worth
# saying why it had to. Every other question this sandbox asks is answered by
# the DBF - how big, how much, who is allowed. "Where on the lot" is not, and
# for a long time the sandbox dodged it by drawing each unit at the lot
# centroid. Zoomed in, that put every proposed backyard cottage on the roof of
# the house it belongs to. A drawing that is wrong in a way a reader can see is
# worse than no drawing.
#
# The rule the ZR states is positional: the unit goes in the REQUIRED REAR YARD,
# no closer than five feet to a rear or side lot line. So the sandbox either
# sites it or stops pretending to draw it.
#
# WHAT IS RECORDED AND WHAT IS INFERRED. Recorded: the lot's outline, from
# MapPLUTO's shapefile, and the footprints of the buildings on it, from the
# city's building layer. Inferred: which end of the lot is the back. Nothing in
# either dataset says where the street is. What is used instead is the house:
# the back of the lot is taken to be the direction away from the building that
# is already on it. That is a good rule for the ordinary case - a house set
# toward the street with a yard behind it - and it is wrong for a corner lot, a
# through lot, and a house set at the back of its own parcel. It is an
# INFERENCE, it is named as one in the card, and it is the reason the unit is
# drawn as a plain square rather than as a building.


def read_shape_index(base):
    """Byte offsets of every record in the .shp, from its .shx sidecar.

    A shapefile is a flat sequence of records with a fixed-length header, and
    the .shx is nothing but an offset table - so any single lot's outline can be
    seek-read without walking the 135MB .shp. Record i of the .shp is record i
    of the .dbf, which is what lets the two be joined by position.
    """
    with open(str(base) + ".shx", "rb") as f:
        head = f.read(100)
        count = (struct.unpack(">i", head[24:28])[0] * 2 - 100) // 8
        return np.frombuffer(f.read(count * 8), dtype=">i4").reshape(count, 2)


def read_outer_ring(handle, index, i):
    """The outer ring of lot i, as an (n, 2) array of State Plane feet.

    EPSG:2263, so the units are FEET - the same units ZR 23-341 and 23-342 are
    written in. No projection is needed to measure a setback.

    Inner rings (holes) and secondary parts are dropped. A lot with a hole in it
    is rare enough, and the ray cast below only needs the boundary it will hit
    first.
    """
    handle.seek(int(index[i, 0]) * 2 + 8)
    body = handle.read(int(index[i, 1]) * 2)
    if len(body) < 44 or struct.unpack("<i", body[0:4])[0] != 5:
        return None
    n_parts, n_pts = struct.unpack("<2i", body[36:44])
    if n_parts < 1 or n_pts < 4:
        return None
    parts = np.frombuffer(body[44:44 + 4 * n_parts], dtype="<i4")
    off = 44 + 4 * n_parts
    pts = np.frombuffer(body[off:off + 16 * n_pts], dtype="<f8").reshape(n_pts, 2)
    end = int(parts[1]) if n_parts > 1 else n_pts
    return pts[int(parts[0]):end]


def convex_hull(points):
    """Andrew's monotone chain. Returns the hull in counter-clockwise order.

    Here to answer one question cheaply: how far does the house reach towards
    the back of the lot? That is a maximum of a dot product over the footprint,
    and a maximum of a dot product over a polygon is always attained at a vertex
    of its convex hull - so the hull is all that has to be kept per lot, which
    is a handful of points instead of the whole outline of every building in
    Queens.
    """
    pts = sorted(set(map(tuple, points)))
    if len(pts) <= 2:
        return np.array(pts, dtype=np.float64)

    def half(seq):
        out = []
        for pt in seq:
            while len(out) >= 2:
                (ax, ay), (bx, by) = out[-2], out[-1]
                if (bx - ax) * (pt[1] - ay) - (by - ay) * (pt[0] - ax) > 0:
                    break
                out.pop()
            out.append(pt)
        return out[:-1]

    return np.array(half(pts) + half(reversed(pts)), dtype=np.float64)


def read_building_shapes(path, boro_digit="4"):
    """Per BBL: a representative point, and the convex hull of the footprints.

    The file is 962MB of GeoJSON, one feature per line, so it is filtered with a
    regex before anything is parsed - the borough digit of base_bbl rules out
    four fifths of the city before json.loads is ever called.

    Several buildings can share a lot, and they are pooled: the point is the
    average of all their vertices, and the hull wraps all of them together. For
    a house with a detached garage behind it that is the right answer twice
    over - the back of the lot is away from BOTH, and the new unit has to clear
    BOTH.
    """
    pattern = re.compile(rf'"base_bbl":"({boro_digit}\d{{9}})"')
    acc = {}
    features = 0
    with open(path) as f:
        f.readline()                      # the FeatureCollection opener
        for line in f:
            m = pattern.search(line)
            if not m:
                continue
            try:
                geom = json.loads(line.rstrip(",\n")).get("geometry")
            except ValueError:
                continue
            if not geom:
                continue
            polys = ([geom["coordinates"]] if geom["type"] == "Polygon"
                     else geom["coordinates"])
            sx = sy = sn = 0.0
            for poly in polys:
                for x, y in poly[0]:
                    sx += x; sy += y; sn += 1
            if not sn:
                continue
            features += 1
            bbl = int(m.group(1))
            verts = [tuple(v) for poly in polys for v in poly[0]]
            a = acc.get(bbl)
            if a is None:
                acc[bbl] = [sx, sy, sn, verts]
            else:
                a[0] += sx; a[1] += sy; a[2] += sn; a[3].extend(verts)
    print(f"site: {features:,} building footprints on {len(acc):,} lots")
    return {k: (v[0] / v[2], v[1] / v[2], convex_hull(v[3]))
            for k, v in acc.items()}


# Feet per degree of latitude, near enough at this latitude for offsets of a few
# tens of feet. Longitude is scaled by cos(latitude).
FT_PER_DEG_LAT = 364000.0


def _ray_reach(p1, edge, ox, oy, dx, dy):
    """Distance from (ox, oy) along (dx, dy) to the first edge it crosses."""
    den = dx * edge[:, 1] - dy * edge[:, 0]
    live = np.abs(den) > 1e-12
    safe = np.where(live, den, 1.0)
    qx, qy = p1[:, 0] - ox, p1[:, 1] - oy
    t = np.where(live, (qx * edge[:, 1] - qy * edge[:, 0]) / safe, -1.0)
    u = np.where(live, (qx * dy - qy * dx) / safe, -1.0)
    hit = live & (t > 0) & (u >= 0) & (u <= 1)
    return float(t[hit].min()) if hit.any() else None


# The frontage test. Constants match data/scripts/checks/frontage_unshared_edge.py,
# which is the measured evidence behind this method and the check to re-run
# against any change here.
FRONTAGE_SNAP = 3.0         # ft, the grid edge samples snap to
FRONTAGE_STEP = 3.0         # ft, the sampling interval along an edge
FRONTAGE_SHARED_FRAC = 0.5  # an edge is shared if this share of its samples is


def _ring_edge_samples(ring):
    """Each edge of a ring as (snap keys, midpoint, unit normal, length).

    Edges are densified at FRONTAGE_STEP and each sample snapped to a
    FRONTAGE_SNAP grid as a single int64 key, so that the same stretch of
    boundary walked from either of two adjoining lots lands on the same keys.
    The normal is not yet oriented; the caller flips it outward.
    """
    out = []
    for k in range(len(ring) - 1):
        p, q = ring[k], ring[k + 1]
        dx, dy = q[0] - p[0], q[1] - p[1]
        L = math.hypot(dx, dy)
        if L < 0.5:
            continue
        n = max(2, int(L / FRONTAGE_STEP) + 1)
        t = np.linspace(0.0, 1.0, n)
        kx = np.rint((p[0] + dx * t) / FRONTAGE_SNAP).astype(np.int64)
        ky = np.rint((p[1] + dy * t) / FRONTAGE_SNAP).astype(np.int64)
        out.append((kx * 4_000_000 + ky,
                    (p[0] + q[0]) / 2.0, (p[1] + q[1]) / 2.0,
                    dy / L, -dx / L, L))
    return out


def block_shared_keys(edge_lists):
    """The snap keys touched by two or more distinct lots in one block.

    A NYC tax block is bounded by streets, so every shared lot line lies
    inside a block - which is why sharing can be computed block by block and
    never needs a citywide spatial index.
    """
    K, O = [], []
    for li, es in enumerate(edge_lists):
        for e in es:
            K.append(e[0])
            O.append(np.full(e[0].shape, li, np.int32))
    if not K:
        return np.empty(0, np.int64)
    K = np.concatenate(K)
    O = np.concatenate(O)
    o = np.lexsort((O, K))
    K, O = K[o], O[o]
    u = np.ones(len(K), bool)
    u[1:] = (K[1:] != K[:-1]) | (O[1:] != O[:-1])
    ku, cn = np.unique(K[u], return_counts=True)
    return ku[cn >= 2]


def lot_frontage(edges, multi, cx, cy):
    """Frontage direction and count of street frontages, from unshared edges.

    Walks the lot's edges, drops every edge at least half of whose samples lie
    on a line another lot in the block also touches, groups what survives into
    CONTIGUOUS RUNS around the ring, and takes the length-weighted mean outward
    normal of the LONGEST run as the street frontage. That longest-run rule is
    the corner-lot decision: a corner lot has two street frontages and, in
    zoning terms, two front yards, and this method takes the longer one as THE
    front. It is our rule, and the count is recorded so the legend can say how
    many lots were resolved this way.

    Returns ((fx, fy), n_runs) with the frontage as a unit normal pointing out
    of the lot toward the street, or (None, 0) for a landlocked lot with no
    unshared edge at all.
    """
    free = []
    for (kk, mx, my, nx, ny, L) in edges:
        if len(kk) and float(np.isin(kk, multi).mean()) >= FRONTAGE_SHARED_FRAC:
            free.append(None)
            continue
        if (mx - cx) * nx + (my - cy) * ny < 0:
            nx, ny = -nx, -ny
        free.append((nx, ny, L))
    if not any(free):
        return None, 0

    # Contiguous unshared runs, circular - BUT a run also breaks where the
    # boundary turns hard. A corner lot's two street edges are adjacent around
    # the ring with nothing shared between them, and without the angle test
    # they fused into one diagonal "frontage" pointing out of the corner - so
    # only 2% of lots read as corners against the ~15% the block sample
    # measured. Two edges whose normals differ by more than 45 degrees are two
    # streets. A frontage split across several colinear polygon vertices is
    # still one street.
    COS_SAME_STREET = math.cos(math.radians(45.0))
    runs = []
    cur = None
    prev = None
    for e in free:
        if e is None:
            cur = None
            prev = None
            continue
        if cur is not None and prev is not None:
            if e[0] * prev[0] + e[1] * prev[1] < COS_SAME_STREET:
                cur = None
        if cur is None:
            cur = [0.0, 0.0, 0.0]
            runs.append(cur)
        cur[0] += e[0] * e[2]
        cur[1] += e[1] * e[2]
        cur[2] += e[2]
        prev = e
    # The ring wraps: if the first and last edges are unshared AND still the
    # same street by the angle test, they are the same run.
    first_e = free[0]
    last_e = free[-1]
    if (len(runs) > 1 and first_e is not None and last_e is not None
            and first_e[0] * last_e[0] + first_e[1] * last_e[1] >= COS_SAME_STREET):
        first = runs.pop(0)
        runs[-1][0] += first[0]
        runs[-1][1] += first[1]
        runs[-1][2] += first[2]

    best = max(runs, key=lambda r: r[2])
    mag = math.hypot(best[0], best[1])
    if mag < 1e-9:
        return None, len(runs)
    return (best[0] / mag, best[1] / mag), len(runs)


def rear_yard_box(ring, cx, cy, lat, lon, dx, dy, hull_deg):
    """The open rectangle behind the house, in feet from the lot centroid.

    (dx, dy) is the direction of the BACK of the lot, a unit vector in the
    ring's own State Plane frame - measured from the unshared lot edge by
    lot_frontage(), not inferred from where the house stands. Returns
    (centre_x, centre_y, depth, width), where depth runs toward the back and
    width runs across. The unit is placed inside this box by the browser,
    which is what lets the setback stay a control.

    A BOX RATHER THAN A DISTANCE, and the reason is the shape of the thing being
    placed. Measuring only how far the lot runs on before its boundary answers
    the wrong question: an ancillary unit is a rectangle, wider than it is deep,
    and on a narrow lot it is the SIDE lot lines that stop it, not the rear one.
    Casting a single ray missed that and put corners over the line; spreading
    the rays into a fan overcorrected, because a ray twenty degrees off the axis
    hits the side line almost immediately on a twenty-foot lot and made the rear
    yard look half its real depth. So both dimensions get measured, separately.

    On failure it returns a string naming the cause instead of a tuple -
    'geometry' for a centroid outside its own polygon or a failed width ray
    (an L-shaped or flag lot), 'house_at_rear_line' for a house that already
    reaches the rear lot line. The caller counts them apart, because a data
    quirk and a finding are different facts.
    """
    ft_per_deg_lon = FT_PER_DEG_LAT * math.cos(math.radians(lat))
    px, py = -dy, dx                           # across the lot

    # The polygon, in a frame centred on the lot centroid. Direction and
    # polygon are now BOTH State Plane, so the old true-north/grid-north
    # mismatch (about a third of a degree) is gone with the old method.
    poly = ring - np.array([cx, cy])
    p1, edge = poly[:-1], poly[1:] - poly[:-1]

    reach = _ray_reach(p1, edge, 0.0, 0.0, dx, dy)
    if reach is None:
        return "geometry"

    # How far the buildings already reach the same way. The maximum of a dot
    # product over a footprint is attained at a hull vertex, which is why only
    # the hull was kept.
    hx = (hull_deg[:, 0] - lon) * ft_per_deg_lon
    hy = (hull_deg[:, 1] - lat) * FT_PER_DEG_LAT
    house = max(float(np.max(hx * dx + hy * dy)) if len(hull_deg) else 0.0, 0.0)

    depth = reach - house
    if depth <= 0:
        return "house_at_rear_line"

    # Width, measured across the middle of that strip.
    mid = house + depth / 2.0
    mx, my = dx * mid, dy * mid
    left = _ray_reach(p1, edge, mx, my, px, py)
    right = _ray_reach(p1, edge, mx, my, -px, -py)
    if left is None or right is None:
        return "geometry"

    # The centre of the box: halfway back, and halfway across.
    off = (left - right) / 2.0
    return (mx + px * off, my + py * off, depth, left + right)


# --------------------------------------------------------------------------
# The Pre-Approved Plan Library
# --------------------------------------------------------------------------

def read_papl(path):
    """The eleven published designs, and the two numbers they settle.

    HPD reviewed all eleven for the same purpose through the same process and
    published a cost range for each. THE MIDPOINTS RUN FROM $248 TO $1,500 PER
    SQUARE FOOT - a six-fold spread. Cost per square foot is not a property of
    ADUs, and the default this pipeline ships is a median of a wide
    distribution rather than a figure anyone would call typical.

    HPD also states the estimates exclude "costs associated with establishing
    site connections or any anticipated site specific costs", which is where the
    budgeting tool's site prep and utility hookup pick up.
    """
    data = json.loads(Path(path).read_text())
    plans = data["plans"]
    mids = sorted(p["cost_per_sf_mid"] for p in plans)
    sqfts = sorted(p["sqft"] for p in plans)
    detached = [p for p in plans if p["adu_type"].startswith("Detached")]
    narrowest = min(p["width_ft"] for p in detached)
    # The shape of a real one. Every published design is a rectangle, and the
    # ratio of its short side to its long one is remarkably consistent - 0.48 to
    # 0.80 across the nine detached plans, median 0.70. The sandbox draws units
    # at that proportion rather than as squares, and stands them with the long
    # side along the rear fence, which is how a backyard cottage actually goes
    # in. It is not cosmetic: a square needs more of the yard's DEPTH than a
    # rectangle of the same area, and depth is the scarce dimension here.
    ratios = sorted(min(p["width_ft"], p["length_ft"])
                    / max(p["width_ft"], p["length_ft"]) for p in detached)
    print(f"papl: {len(plans)} published designs; cost midpoints "
          f"${mids[0]:,}-${mids[-1]:,}/sf, median ${float(np.median(mids)):,.0f}; "
          f"floor areas {sqfts[0]:g}-{sqfts[-1]:g}sf, median {float(np.median(sqfts)):g}")
    print(f"papl: narrowest detached design is {narrowest:g}ft wide; "
          f"median short:long ratio {float(np.median(ratios)):.2f} "
          f"({ratios[0]:.2f}-{ratios[-1]:.2f})")
    return {
        "plans": plans,
        "source": data.get("_source"),
        "read": data.get("_read"),
        "note": data.get("_note"),
        "cost_per_sf_median": float(np.median(mids)),
        "cost_per_sf_min": mids[0],
        "cost_per_sf_max": mids[-1],
        "sqft_median": float(np.median(sqfts)),
        "sqft_min": sqfts[0],
        "sqft_max": sqfts[-1],
        "narrowest_detached_ft": narrowest,
        "depth_to_width_ratio": round(float(np.median(ratios)), 3),
        "depth_to_width_note": "Median short:long side ratio of the nine "
                               "published DETACHED designs. Range 0.48-0.80.",
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
            "Longitude", "YearBuilt", "XCoord", "YCoord",
            # Added for the ZR 23-341/23-342 rebuild. LotFront and LotDepth
            # size the required rear yard; ProxCode is DOF's building type;
            # FIRM07_FLA is FEMA's effective 1%-annual-chance area, which is
            # the Zoning Resolution's "high-risk flood zone".
            "LotFront", "LotDepth", "ProxCode", "FIRM07_FLA", "PFIRM15_FL",
            # Block is the unit the frontage test runs over: a tax block is
            # bounded by streets, so every shared lot line lies inside one.
            "Block"]
    print(f"pluto: reading {dbf.name}")

    lots = []
    counts = {"queens": 0, "ab": 0, "landuse01": 0, "disagree": 0,
              "no_coords": 0, "bad_units": 0, "multi_building": 0}
    # EVERY Queens lot's shapefile row, grouped by tax block - not only the
    # one-to-two-family ones. The frontage test needs both sides of a shared
    # line, and the neighbour may be a corner store.
    block_rows = {}
    # THE RECORD INDEX IS THE JOIN TO THE SHAPEFILE. Record i of the .dbf is
    # record i of the .shp; there is no key field to match on and none is
    # needed. Kept per lot so the siting step can seek straight to the outline.
    for row, rec in enumerate(read_dbf(dbf, cols)):
        if rec["borocode"] != QUEENS_BORO:
            continue
        counts["queens"] += 1
        block_rows.setdefault(rec["block"], []).append(row)
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

        def g(k):
            try:
                return float(rec[k] or 0)
            except ValueError:
                return 0.0

        lots.append({
            "row": row,
            "block": rec["block"],
            "bbl": int(float(rec["bbl"])) if rec["bbl"] else 0,
            "lon": lon, "lat": lat,
            "x": g("xcoord"), "y": g("ycoord"),
            "lot_area": f("lotarea"),
            "bldg_front": f("bldgfront"), "bldg_depth": f("bldgdepth"),
            "lot_front": f("lotfront"), "lot_depth": f("lotdepth"),
            "prox": rec["proxcode"].strip(),
            "firm07": rec["firm07_fla"].strip() == "1",
            "pfirm15": rec["pfirm15_fl"].strip() == "1",
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

    # ---- 1b. the plan library --------------------------------------------
    papl = read_papl(original / PAPL_FILE)

    # ---- 2. HUD ----------------------------------------------------------
    # The two HUD files were once in a fmr+incomelimit/ subdirectory and are now
    # loose in data/original/. Look in both rather than making the layout a
    # requirement - data/original is a download folder, not a schema.
    hud = original / "fmr+incomelimit"
    if not (hud / "summary_county_3608199999.csv").exists():
        hud = original
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

    # ---- 4. the flood rule, which this pipeline had wrong -----------------
    #
    # "EXPANDED FLOOD AREA" IS NOT A TERM IN THE ZONING RESOLUTION. It was
    # searched for on 2026-09-01 and it is in neither ZR 12-10 nor ZR 64-11.
    # The phrase came from a secondary source and was carried through two build
    # docs, a memory note and the previous version of this file. Stop using it.
    #
    # ZR 12-10's definition of an ANCILLARY DWELLING UNIT carries THREE separate
    # flood restrictions, not one, and they do different things:
    #
    #   1. In the HIGH-RISK FLOOD ZONE (ZR 64-11: "the area, as indicated on the
    #      flood maps, that has a one percent chance of flooding in a given
    #      year") - no ADU below the flood-resistant construction elevation.
    #      THIS IS NOT A BAN ON THE LOT. It is an elevation requirement, and
    #      modelling it as an eligibility exclusion misreads it. It is flagged
    #      here and deliberately kept OUT of the eligibility test.
    #
    #   2. In DEP's 10-YEAR RAINFALL FLOOD RISK AREA and COASTAL FLOOD RISK
    #      AREA - no basement or cellar unit, and no backyard unit. THIS is the
    #      ban, and it is the only one that matters here, because this pipeline
    #      models backyard ADUs and nothing else.
    #
    #   3. Not about flooding: R1-2A/R2A/R3A outside the Greater Transit Zone,
    #      LPC historic districts, and a five-foot access route. Below.
    #
    # ZR 64-11 defines "flood maps" as "the most recent map or map data used as
    # the basis for flood-resistant construction standards" - the Resolution
    # never names a dataset, it points at whatever the Building Code is
    # currently using. The rule is written to move. That goes in the card.
    #
    # THE LAYER THE RULE ACTUALLY POINTS AT is the DEP Interim Flood Risk Area
    # Map (nyc.gov/dep/floodriskmap), established under Administrative Code
    # 24-809 and 15 RCNY 66-01. IT IS NOT ON DISK. As of 2026-09-01 the rule
    # adopting it was proposed (June 2025) and adoption was not confirmed, and
    # no download format is known.
    #
    # So the two flags below are built from the two NPCC layers we do have,
    # which are the INGREDIENTS of the DEP areas and not the areas themselves:
    # the coastal flood risk area is built on FEMA's 100-year coastal floodplain
    # and NPCC 2080 sea level rise at the 90th percentile, and the 10-year
    # rainfall area on NPCC 2050 with a 50-foot perimeter buffer. That is a
    # defensible approximation and a bad citation, and the card says which it is.
    lon = np.array([l["lon"] for l in lots], dtype=np.float64)
    lat = np.array([l["lat"] for l in lots], dtype=np.float64)
    bounds = [lon.min(), lat.min(), lon.max(), lat.max()]

    # FEMA's effective 1%-annual-chance area, per lot, straight out of MapPLUTO.
    # This IS the ZR's high-risk flood zone and it needs no download and no
    # rasterising. PFIRM15_FL is the 2015 preliminary FIRM, carried for
    # comparison only - the effective map is the one the Building Code uses.
    in_high_risk = np.array([l["firm07"] for l in lots], dtype=bool)
    in_preliminary = np.array([l["pfirm15"] for l in lots], dtype=bool)
    print(f"flood: {in_high_risk.sum():,} lots in FEMA's effective "
          f"1%-annual-chance area (MapPLUTO FIRM07_FLA), "
          f"{in_preliminary.sum():,} in the 2015 preliminary map "
          f"(PFIRM15_FL). This is the ZR's high-risk flood zone: an ELEVATION "
          f"requirement, not a ban, and it is not in the eligibility test.")

    flood_paths = (sorted(original.glob("future_floodplain_2050s*.geojson"))
                   + sorted(original.glob("sea_level_rise_2080s*.geojson")))
    if len(flood_paths) == 2:
        SIZE = 2048
        grids = rasterise_floodplain(flood_paths, bounds, SIZE)
        gx = np.clip(((lon - bounds[0]) / (bounds[2] - bounds[0]) * SIZE).astype(int), 0, SIZE - 1)
        gy = np.clip(((bounds[3] - lat) / (bounds[3] - bounds[1]) * SIZE).astype(int), 0, SIZE - 1)
        # NPCC 2050 stands in for the 10-year rainfall area, NPCC 2080 100-year
        # for the coastal area. Both are the published ingredient, not the
        # adopted product.
        in_rainfall_frra = grids[0][gy, gx]
        in_coastal_frra = grids[1][gy, gx]
        print(f"flood: {in_rainfall_frra.sum():,} lots approximate the 10-year "
              f"rainfall flood risk area, {in_coastal_frra.sum():,} the coastal "
              f"flood risk area. BOTH ARE APPROXIMATIONS OF AN ADOPTED MAP WE "
              f"COULD NOT OBTAIN.")
        flood_note = (
            "APPROXIMATED, AND THE APPROXIMATION IS NAMED. ZR 12-10 bars a "
            "backyard ADU in DEP's 10-year rainfall flood risk area and coastal "
            "flood risk area, both designated on the DEP Interim Flood Risk Area "
            "Map (nyc.gov/dep/floodriskmap, established under Admin Code 24-809 "
            "and 15 RCNY 66-01). THAT MAP IS NOT PUBLISHED IN A FORM WE COULD "
            "DOWNLOAD - as of 2026-09-01 the rule adopting it was proposed in "
            "June 2025 and adoption was not confirmed. So these two flags are "
            "built from NYC Open Data 27ya-gqtm (Future Floodplain 2050s) and "
            "ek8y-fsqz (Sea Level Rise Maps, 2080s 100-year), downloaded "
            "2026-08-31 and rasterised to a 2048-cell grid over Queens (about "
            "20m). Those two layers are the INGREDIENTS of the DEP areas - the "
            "coastal area is built on FEMA's 100-year coastal floodplain plus "
            "NPCC 2080 at the 90th percentile, the rainfall area on NPCC 2050 "
            "with a 50-foot buffer - not the areas themselves. Separately, "
            "FIRM07_FLA from MapPLUTO IS the ZR's high-risk flood zone exactly, "
            "and it is flagged but excluded from the eligibility test because "
            "that rule is an elevation requirement and not a ban. NYC's "
            "Stormwater Flood Maps (NYC Open Data 9i7c-xyvv) are the stormwater "
            "modelling behind the rainfall half and were NOT substituted here: "
            "they are published as intensities, not return periods, and whether "
            "the 'moderate' 2.13 in/hr layer is the 10-year storm is unverified.")
    else:
        in_rainfall_frra = np.zeros(n, dtype=bool)
        in_coastal_frra = np.zeros(n, dtype=bool)
        flood_note = ("NOT APPLIED - the NPCC layers were not found in "
                      "data/original, and the DEP map the rule actually names "
                      "has never been downloadable.")
        print("flood: layers not found - the flood exclusion is DROPPED")

    # ---- 5. size the ADU, from ZR 23-341(b)(4) and ZR 23-342 -------------
    #
    # THIS STEP USED TO BE THE WEAKEST THING IN THE PIPELINE. It applied a
    # one-third fraction to the whole open area of the lot - LotArea minus the
    # building footprint - which is not what the rule says. The rule applies the
    # fraction to the REQUIRED REAR YARD, which is smaller, and which depends on
    # building type and lot width. The old version put the median at 707sf and
    # pinned 109,032 lots to the 800sf statutory cap; it looked precise and
    # resolved to a constant for nearly half the borough.
    #
    # What is still an estimate: MapPLUTO has no lot geometry, so the rear yard
    # is taken as LotFront x required_depth - a rectangle across the full width
    # of the lot. An L-shaped lot, a corner lot and a flag lot are still treated
    # identically. What is no longer an estimate is the DEPTH of that rectangle
    # and the fraction of it that may be built on. Both are quoted from the ZR.
    lot_front = np.array([l["lot_front"] for l in lots], dtype=np.float64)
    lot_depth = np.array([l["lot_depth"] for l in lots], dtype=np.float64)
    bldg_front = np.array([l["bldg_front"] for l in lots], dtype=np.float64)
    lot_area = np.array([l["lot_area"] for l in lots], dtype=np.float64)

    # --- building type. DOF's ProxCode, with the gap proxy as a cross-check.
    prox = np.array([l["prox"] for l in lots])
    gap = lot_front - bldg_front
    gap_type = np.where(gap < GAP_SEMI_FT, "attached",
                np.where(gap < GAP_DETACHED_FT, "semi_detached", "detached"))
    prox_type = np.where(prox == "1", "detached",
                 np.where(prox == "2", "semi_detached",
                  np.where(prox == "3", "attached", "")))
    # ProxCode 0 or blank means DOF did not record one. Those lots fall back to
    # the gap proxy rather than being dropped, and the count is in the manifest.
    prox_missing = prox_type == ""
    bldg_type = np.where(prox_missing, gap_type, prox_type)

    # The two classifications are INDEPENDENT TESTS OF THE SAME THING and they
    # are totalled against each other here, the way BldgClass A*/B* and
    # LandUse 01 already are. They disagree a great deal - the gap proxy calls
    # 30,000 more lots semi-detached than DOF does - and that disagreement is
    # exactly the reason to prefer the recorded field over our two thresholds.
    usable_dims = (lot_front > 0) & (lot_depth > 0) & (bldg_front > 0)
    type_agree = int(((prox_type == gap_type) & ~prox_missing & usable_dims).sum())
    type_counts = {t: int((bldg_type == t).sum()) for t in
                   ("detached", "semi_detached", "attached")}
    print(f"type: ProxCode {type_counts} "
          f"({int(prox_missing.sum()):,} lots had no ProxCode and fell back to "
          f"the gap proxy)")
    print(f"type: the gap proxy agrees with ProxCode on {type_agree:,} of "
          f"{int((~prox_missing & usable_dims).sum()):,} lots that have both "
          f"({type_agree / max(1, int((~prox_missing & usable_dims).sum())) * 100:.1f}%)")

    # --- required rear yard depth, ZR 23-342.
    required_depth = np.where(
        bldg_type == "detached", REAR_YARD_DEPTH["detached"],
        np.where(lot_front < 40.0, REAR_YARD_DEPTH["semi_narrow"],
                 REAR_YARD_DEPTH["semi_wide"]))
    # Shallow interior lots: six inches off the requirement per foot of
    # deficiency below 95 feet, floored at ten feet.
    deficiency = np.maximum(SHALLOW_LOT_DEPTH_FT - lot_depth, 0.0)
    shallow = (lot_depth > 0) & (deficiency > 0)
    required_depth = np.maximum(
        required_depth - SHALLOW_LOT_REDUCTION_PER_FT * deficiency,
        SHALLOW_LOT_FLOOR_FT)
    print(f"size: the shallow-lot reduction bites on {int(shallow.sum()):,} lots "
          f"({shallow.mean() * 100:.1f}%)")

    # --- the one-third rule.
    rear_yard_area = lot_front * required_depth
    adu_sf = np.minimum(rear_yard_area * REAR_YARD_FRACTION, MAX_ADU_SF)

    # --- the two screens that are not about area.
    #
    # ATTACHED BUILDINGS CANNOT HAVE ONE AT ALL. ZR 23-341(b)(4) names detached,
    # zero lot line and semi-detached. Attached is simply not in the section.
    type_ok = bldg_type != "attached"

    # Five feet of side setback on each side, from the same section. What is
    # left has to be wide enough for a real design: the narrowest detached plan
    # in HPD's own Pre-Approved Plan Library is 14 feet wide.
    #
    # SAY OUT LOUD THAT THIS TEST DOES NO WORK. At the 300sf floor below it
    # removes no lot the floor has not already removed. It is kept because it is
    # the rule and because a student changing side_setback_ft should see it
    # start to bite - not because it is deciding anything at the defaults.
    buildable_width = lot_front - 2 * SIDE_SETBACK_FT
    width_ok = buildable_width >= NARROWEST_DETACHED_PLAN_FT

    # --- the habitability floor.
    #
    # Everything from here to the end of this step is REPORTING, not shipping.
    # adu_sf is computed at the default rule numbers so the run can be checked
    # against the published figures and the plan library; the browser recomputes
    # it from lot_front, required_depth and the two rule controls.
    adu_sf = np.where(type_ok & width_ok & usable_dims, adu_sf, 0.0)
    below_floor = (adu_sf > 0) & (adu_sf < MIN_ADU_SF)
    adu_sf[adu_sf < MIN_ADU_SF] = 0.0

    fits = adu_sf > 0
    print(f"size: {int(type_ok.sum()):,} lots are an eligible building type "
          f"({type_ok.mean() * 100:.1f}%); "
          f"{int((type_ok & width_ok & usable_dims).sum()):,} also clear the "
          f"setbacks and have usable dimensions")
    print(f"size: the one-third cap has median "
          f"{np.median((rear_yard_area * REAR_YARD_FRACTION)[usable_dims]):,.0f}sf "
          f"across all lots with usable dimensions; "
          f"{int(below_floor.sum()):,} lots fall below the {MIN_ADU_SF}sf "
          f"habitability floor and produce no unit")
    print(f"size: {int(fits.sum()):,} lots fit an ADU "
          f"({fits.mean() * 100:.1f}%), median {np.median(adu_sf[fits]):,.0f}sf, "
          f"{int((adu_sf >= MAX_ADU_SF).sum()):,} at the {MAX_ADU_SF}sf statutory cap")

    # How little the statutory cap binds is the headline of this rebuild, and it
    # is MEASURED here rather than asserted, because the claim in the card
    # depends on it and a future MapPLUTO could move it.
    at_cap = int((adu_sf >= MAX_ADU_SF).sum())
    print(f"size: the {MAX_ADU_SF}sf statutory cap binds on {at_cap:,} lots - "
          f"{at_cap / max(1, int(fits.sum())) * 100:.1f}% of those that fit one, "
          f"against 109,032 under the old sizing. The one-third rule and the "
          f"setbacks are what decide this map.")

    # ---- 5b. site the unit on the lot ------------------------------------
    #
    # The map used to draw every proposed unit at the lot centroid, which is
    # where the house is. Zoomed in - which is exactly what the volumes control
    # tells you to do - each cottage sat on the roof of the building it was
    # meant to stand behind.
    #
    # WHICH WAY IS BACK is measured, not inferred, since the 2026-09-04 pass:
    # the street frontage is the unshared lot edge - the only stretch of a
    # lot's boundary no other lot in its tax block touches - and the back is
    # its opposite. Measured against 500 sampled blocks the frontage points
    # into the block 96.5% of the time; the old away-from-the-house inference
    # managed 55.5%, a coin flip, and put roughly a third of the cottages at
    # the wrong end of the lot. The evidence and the re-runnable check are in
    # data/scripts/checks/frontage_unshared_edge.py.
    shp_base = dbf.with_suffix("")
    rear_x = np.zeros(n, dtype=np.float64)
    rear_y = np.zeros(n, dtype=np.float64)
    rear_depth = np.zeros(n, dtype=np.float64)
    rear_width = np.zeros(n, dtype=np.float64)
    frontage_n = np.zeros(n, dtype=np.int32)
    # The unsited, split by cause - a data absence, a finding, and a geometry
    # failure are three different facts and the manifest reports them apart.
    causes = {"no_footprint": 0, "landlocked": 0, "house_at_rear_line": 0,
              "geometry": 0, "no_ring": 0}
    sited = 0
    if (shp_base.with_suffix(".shp").exists()
            and (original / BUILDINGS_FILE).exists()):
        shapes = read_building_shapes(original / BUILDINGS_FILE, QUEENS_BORO)
        shx = read_shape_index(shp_base)
        target_by_row = {l["row"]: i for i, l in enumerate(lots)}
        blocks_run = 0
        with open(str(shp_base) + ".shp", "rb") as handle:
            for blk, rows in block_rows.items():
                if not any(r in target_by_row for r in rows):
                    continue
                blocks_run += 1
                geoms = []
                for r in rows:
                    ring = read_outer_ring(handle, shx, r)
                    if ring is None or len(ring) < 4:
                        if r in target_by_row:
                            causes["no_ring"] += 1
                        continue
                    geoms.append((r, np.asarray(ring, dtype=np.float64)))
                edge_lists = [_ring_edge_samples(g[1]) for g in geoms]
                multi = block_shared_keys(edge_lists)
                for (r, ring), edges in zip(geoms, edge_lists):
                    i = target_by_row.get(r)
                    if i is None:
                        continue
                    l = lots[i]
                    cx = float(ring[:-1, 0].mean())
                    cy = float(ring[:-1, 1].mean())
                    front, n_runs = lot_frontage(edges, multi, cx, cy)
                    frontage_n[i] = n_runs
                    if front is None:
                        causes["landlocked"] += 1
                        continue
                    b = shapes.get(l["bbl"])
                    if not b or l["x"] == 0:
                        causes["no_footprint"] += 1
                        continue
                    # back = -frontage; the box is measured from the back lot
                    # line inward along a direction that is known, not guessed.
                    v = rear_yard_box(ring, l["x"], l["y"], l["lat"], l["lon"],
                                      -front[0], -front[1], b[2])
                    if isinstance(v, str):
                        causes[v] += 1
                        continue
                    rear_x[i], rear_y[i], rear_depth[i], rear_width[i] = v
                    sited += 1
        ok = rear_depth > 0
        corners = int((frontage_n >= 2).sum())
        print(f"site: frontage measured block by block over {blocks_run:,} tax "
              f"blocks; {corners:,} lots have two or more street frontages "
              f"({corners / n * 100:.1f}%) and take the longest run as the front")
        print(f"site: {sited:,} of {n:,} lots sited ({sited / n * 100:.1f}%); "
              f"the open ground behind the house is a median "
              f"{np.median(rear_depth[ok]):.0f}ft deep by "
              f"{np.median(rear_width[ok]):.0f}ft wide")
        print(f"site: not sited, by cause - "
              f"{causes['no_footprint']:,} no footprint on record, "
              f"{causes['landlocked']:,} landlocked (no unshared edge), "
              f"{causes['house_at_rear_line']:,} house already at the rear lot "
              f"line, {causes['geometry']:,} geometry (centroid outside its own "
              f"polygon or a failed width ray), {causes['no_ring']:,} no outline")
        print(f"site: {int((fits & ~ok).sum()):,} lots that fit a unit could not "
              f"be sited and will not be drawn as volumes")
    else:
        print("site: MapPLUTO.shp or the building footprints are missing - "
              "units cannot be sited and no volumes will be drawn")

    # ---- 6. eligibility flags (OURS, derived from the published rules) ----
    #
    # ONE ELIGIBILITY FLAG NOW, NOT TWO. The old pair named an attached ADU and a
    # detached one, but the front end had the detached case hardcoded, so the
    # attached flag decided nothing - and the sizing step only ever measured a
    # backyard cottage anyway. A control or a flag that changes nothing is worse
    # than a missing one, because it implies the model knows something it does
    # not. Same reasoning that cut the owner-occupancy switch last build.
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
    flags |= (in_rainfall_frra.astype(np.uint8) * FLAGS["in_10yr_rainfall_frra"])
    flags |= (in_coastal_frra.astype(np.uint8) * FLAGS["in_coastal_frra"])
    flags |= (in_high_risk.astype(np.uint8) * FLAGS["in_high_risk_flood_zone"])

    not_city = (flags & FLAGS["city_owned"]) == 0

    # A BACKYARD ADU, which is the only kind this pipeline sizes. Barred in the
    # two DEP flood risk areas, in historic districts, and in R1-2A / R2A / R3A
    # outside the Greater Transit Zone. The building-type and setback screens
    # are already folded into adu_sf, which is zero where they fail.
    #
    # in_high_risk IS DELIBERATELY ABSENT FROM THIS LINE. The high-risk flood
    # zone requires the unit to sit above the flood-resistant construction
    # elevation; it does not forbid it. Putting it here would have been the same
    # category error the old "expanded flood area" flag made.
    #
    # NOTE WHAT IS NOT IN THIS TEST: whether the lot has ROOM. It used to be,
    # and it cannot be any more, because rear_yard_fraction and side_setback_ft
    # are controls now and the size they produce changes as they move. The room
    # test is applied in the browser, against columns this pipeline ships. That
    # is the same rule the rest of this file follows - precompute the INPUTS to
    # the answer, never the answer.
    backyard_ok = (not_city
                   & ~in_rainfall_frra & ~in_coastal_frra
                   & ((flags & FLAGS["in_historic_district"]) == 0)
                   & ((flags & FLAGS["excluded_district"]) == 0))
    flags |= backyard_ok.astype(np.uint8) * FLAGS["eligible_backyard"]
    print(f"rules: {int(backyard_ok.sum()):,} of {n:,} one-to-two-family lots "
          f"clear the LEGAL screens for a backyard ADU "
          f"({backyard_ok.mean() * 100:.1f}%); at the default rule numbers "
          f"{int((backyard_ok & fits).sum()):,} of those also have room")
    print(f"rules: excluded - "
          f"{int((~fits).sum()):,} have no room at the DEFAULT ZR 23-341/23-342 "
          f"numbers (a browser-side test now - the two rule sliders move it), "
          f"{int(((flags & FLAGS['in_historic_district']) > 0).sum()):,} historic, "
          f"{int(((flags & FLAGS['excluded_district']) > 0).sum()):,} low-density "
          f"beyond the transit zone, "
          f"{int((in_rainfall_frra | in_coastal_frra).sum()):,} in a DEP flood "
          f"risk area (approximated), "
          f"{int((~not_city).sum()):,} city-owned")
    print(f"rules: {int((backyard_ok & in_high_risk).sum()):,} eligible lots are "
          f"ALSO in the high-risk flood zone - they may build, but not below the "
          f"flood-resistant construction elevation, and this model does not "
          f"price that")

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

    # Building type ships as a column rather than a flag: it is a category with
    # four values, and the bitfield's eight bits are all spoken for.
    type_col = np.array([BLDG_TYPE.get(t, BLDG_TYPE["unknown"]) for t in bldg_type],
                        dtype=np.float32)

    # LOT_FRONT AND REQUIRED_DEPTH, NOT ADU_SF. The unit's floor area is no
    # longer shipped, because rear_yard_fraction and side_setback_ft are
    # controls and the browser has to be able to recompute it. What ships is
    # what the rule needs: the width of the lot, the depth of the rear yard the
    # ZR requires on it, and what kind of building is standing there.
    arr = np.empty((n, 9), dtype=np.float32)
    arr[:, 0] = lon
    arr[:, 1] = lat
    arr[:, 2] = lot_front
    arr[:, 3] = required_depth
    arr[:, 4] = lot_area
    arr[:, 5] = rent_fmr
    arr[:, 6] = tract_income
    arr[:, 7] = tract_idx
    arr[:, 8] = type_col
    (out / "lots.bin").write_bytes(arr.tobytes())

    # The rear-yard box rides in its own file at Int16 - nothing in it is
    # precise to better than a foot, and four float32s per lot were 4MB of
    # false precision. rear_box_x/y are the box centre in feet from the lot
    # centroid (signed - a direction is in them); depth and width are the box.
    # (0, 0, 0, 0) means "could not site" and those lots are drawn flat.
    # frontage_count is the number of unshared street frontages the block test
    # found: 0 landlocked, 1 ordinary, 2+ corner and through lots, which took
    # the longest run as THE front - a rule of ours the legend can count.
    rear = np.empty((n, 5), dtype="<i2")
    rear[:, 0] = np.rint(rear_x)
    rear[:, 1] = np.rint(rear_y)
    rear[:, 2] = np.rint(rear_depth)
    rear[:, 3] = np.rint(rear_width)
    rear[:, 4] = np.clip(frontage_n, 0, 32767)
    (out / "rear.bin").write_bytes(rear.tobytes())

    # The plan library ships alongside, for the control's description and the
    # card. It is small and it is the evidence for the cost default.
    (out / "plans.json").write_text(json.dumps(papl, indent=2))
    print(f"write: plans.json {len(papl['plans'])} published designs")
    (out / "flags.bin").write_bytes(flags.tobytes())
    lots_bytes = (out / "lots.bin").stat().st_size
    print(f"write: lots.bin {lots_bytes / 1e6:.1f}MB, "
          f"rear.bin {(out / 'rear.bin').stat().st_size / 1e6:.2f}MB, "
          f"flags.bin {(out / 'flags.bin').stat().st_size / 1e6:.2f}MB")

    # tracts, for the concentration metric and optional shading

    manifest = {
        "sandbox": "pencil",
        "generated": "2026-09-04",
        "borough": "Queens (BoroCode 4)",
        "lots": n,
        "start_year": 2027,
        "start_year_note": "The first year the permitting queue releases lots. "
                           "A choice, not a finding - the programme has no start "
                           "date in it.",
        "bounds": [float(b) for b in bounds],
        "columns": ["lon", "lat", "lot_front", "required_rear_yard_depth",
                    "lot_area", "rent_fmr", "tract_income", "tract_idx",
                    "bldg_type"],
        "column_units": ["degrees", "degrees", "feet", "feet", "square feet",
                         "dollars per month", "dollars per year",
                         "index into tracts.json, -1 for none",
                         "0 attached, 1 semi-detached, 2 detached, 3 unknown"],
        "rear_columns": ["rear_box_x_ft", "rear_box_y_ft",
                         "rear_box_depth_ft", "rear_box_width_ft",
                         "frontage_count"],
        "rear_column_units": ["feet east of the lot centroid, to the centre of "
                              "the open ground behind the house",
                              "feet north of the same",
                              "feet, its depth toward the back lot line",
                              "feet, its width across the lot",
                              "unshared street frontages found by the block "
                              "test: 0 landlocked, 1 ordinary, 2+ corner and "
                              "through lots"],
        "rear_dtype": "<i2",
        "rear_note": "rear.bin is Int16, little-endian, five values per lot in "
                     "lots.bin's row order. Whole feet - nothing in a siting "
                     "box is precise to better than a foot, and four float32s "
                     "per lot were false precision. (0,0,0,0) means the lot "
                     "could not be sited; frontage_count says why not when it "
                     "is 0 (landlocked).",
        "columns_note": "adu_sf IS NOT SHIPPED. It was, and it could not stay: "
                        "rear_yard_fraction and side_setback_ft are controls, so "
                        "the unit's floor area moves when they move and the "
                        "browser computes it from these columns. Precompute the "
                        "inputs to the answer, never the answer - the same rule "
                        "the rest of this pipeline follows.",
        "flags": {k: int(v) for k, v in FLAGS.items()},
        "programme": PROGRAMME,
        "assumptions": ASSUMPTIONS,
        "adu_sizing": {
            "method": "adu_sf = min(LotFront * required_rear_yard_depth / 3, 800), "
                      "zeroed below 300sf, and zero for attached buildings and "
                      "for lots too narrow to hold a published design between "
                      "two five-foot side setbacks.",
            "source": "ZR 23-341(b)(4) and ZR 23-342, zoningresolution.planning."
                      "nyc.gov, verified 2026-09-01. HPD's ADU Homeowner "
                      "Guidebook is cited for the plain-language framing and for "
                      "the 250-300sf practical minimum, but its flat '20 feet' "
                      "rear yard is the DETACHED case only and the ZR is used "
                      "instead.",
            "rear_yard_fraction": REAR_YARD_FRACTION,
            "side_setback_ft": SIDE_SETBACK_FT,
            "required_rear_yard_depth_ft": REAR_YARD_DEPTH,
            "shallow_lot": {
                "under_depth_ft": SHALLOW_LOT_DEPTH_FT,
                "reduction_ft_per_ft": SHALLOW_LOT_REDUCTION_PER_FT,
                "floor_ft": SHALLOW_LOT_FLOOR_FT,
                "lots_affected": int(shallow.sum()),
            },
            "min_sf": MIN_ADU_SF,
            "max_sf": MAX_ADU_SF,
            "narrowest_detached_plan_ft": NARROWEST_DETACHED_PLAN_FT,
            "eligible_building_types": ["detached", "zero lot line",
                                        "semi-detached"],
            "median_cap_sf": float(np.median(
                (rear_yard_area * REAR_YARD_FRACTION)[usable_dims])),
            "median_adu_sf_where_it_fits": float(np.median(adu_sf[fits])) if fits.any() else 0.0,
            "lots_at_the_statutory_cap": int((adu_sf >= MAX_ADU_SF).sum()),
            "lots_below_the_habitability_floor": int(below_floor.sum()),
            "note": "THE 800sf STATUTORY CAP ALMOST NEVER BINDS. It is reached "
                    "on about 1% of the lots that fit a unit at all, against "
                    "109,032 under the old sizing. The one-third rule and the "
                    "five-foot setbacks are what decide this map. The "
                    "previous version of this pipeline applied the one-third "
                    "fraction to the whole open area of the lot rather than to "
                    "the required rear yard, which put the median at 707sf and "
                    "pinned 109,032 lots to the cap - a step that looked precise "
                    "and resolved to a constant for nearly half the borough. "
                    "What remains an estimate: MapPLUTO has no lot geometry, so "
                    "the rear yard is a rectangle LotFront wide, and an L-shaped "
                    "lot, a corner lot and a flag lot are still treated "
                    "identically. What is no longer an estimate is the depth of "
                    "that rectangle and the fraction of it that may be built on.",
        },
        "building_type": {
            "source": "MapPLUTO ProxCode, the Department of Finance proximity "
                      "code: 1 detached, 2 semi-attached, 3 attached, 0 not "
                      "available.",
            "counts": type_counts,
            "no_proxcode": int(prox_missing.sum()),
            "fallback": "Lots with no ProxCode take the LotFront - BldgFront gap "
                        "proxy instead, with cutoffs at 2 and 10 feet.",
            "cross_check": {
                "method": "LotFront - BldgFront, cutoffs at 2ft and 10ft. OURS.",
                "agrees_with_proxcode": type_agree,
                "of_lots_with_both": int((~prox_missing & usable_dims).sum()),
                "note": "Two independent tests of the same thing, totalled "
                        "against each other the way BldgClass A*/B* and LandUse "
                        "01 are. They disagree a great deal, and that "
                        "disagreement is the reason to prefer the field DOF "
                        "recorded over two cutoffs we chose. The build doc that "
                        "specified this rebuild believed MapPLUTO had no "
                        "building-type field; it has one.",
            },
            "interpretation": "DOF says 'semi-attached' and the Zoning "
                              "Resolution says 'semi-detached'. They are treated "
                              "here as the same category. That is a reading, not "
                              "a fact.",
        },
        "siting": {
            "sited": int(sited),
            "of_lots": n,
            "method": "The back of the lot is MEASURED, not inferred: the "
                      "street frontage is the unshared lot edge - the only "
                      "stretch of the boundary no other lot in the same tax "
                      "block touches - and the back is its opposite. A tax "
                      "block is bounded by streets, so every shared lot line "
                      "lies inside one, which is what lets the test run block "
                      "by block with no spatial index. The rear-yard box is "
                      "then measured from the back lot line inward, and the "
                      "browser finishes the sum, because the setback is a "
                      "control.",
            "measured_check": "Against 500 randomly sampled Queens blocks "
                              "(13,670 one-to-two-family lots, 2026-09-04), the "
                              "frontage found this way points out of the block "
                              "97.4% of the time and the implied back direction "
                              "points into it 96.5%. The away-from-the-house "
                              "inference this replaces managed 55.5% - a coin "
                              "flip - and had roughly a third of the drawn "
                              "cottages at the wrong end of the lot. The check "
                              "is re-runnable: data/scripts/checks/"
                              "frontage_unshared_edge.py.",
            "corner_rule": "A corner or through lot has two or more street "
                           "frontages and, in zoning terms, two front yards. "
                           "The LONGEST unshared run is taken as the front; the "
                           "others are treated as the side lot lines the "
                           "side-setback control already clears. That is our "
                           "rule, not the city's, and frontage_count in "
                           "rear.bin says which lots it decided.",
            "when_it_does_not_fit": "A unit whose square will not sit between "
                                    "the back of the house and the setback off "
                                    "the rear lot line is NOT DRAWN, and the "
                                    "legend counts it. It still counts as "
                                    "eligible and it still pencils, because the "
                                    "rule the programme applies is about the "
                                    "AREA of the required rear yard and not "
                                    "about whether a square fits behind the "
                                    "house. That gap between an area test and a "
                                    "plan is worth seeing rather than papering "
                                    "over.",
            "recorded": "The lot outline, from MapPLUTO's shapefile (EPSG:2263, "
                        "feet). The footprints of the buildings on it, from the "
                        "city's building layer, joined on base_bbl - still "
                        "needed for how far the house already reaches toward "
                        "the back, which is a different question from which "
                        "way back is.",
            "not_sited": {k: int(v) for k, v in causes.items()},
            "not_sited_note": "By cause, and the causes are different facts: "
                              "no_footprint is a data absence, "
                              "house_at_rear_line is a finding about the lot, "
                              "landlocked means no unshared edge at all, "
                              "geometry is a centroid outside its own polygon "
                              "or a failed width ray - an L-shaped or flag "
                              "lot. All are drawn flat and no volume is "
                              "guessed for them.",
        },
        "hpd_budget": HPD_BUDGET,
        "plan_library": {k: v for k, v in papl.items() if k != "plans"},
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
            "zoning": "ZR 12-10 (definition of ancillary dwelling unit), "
                      "ZR 23-341(b)(4) (permitted obstructions in required rear "
                      "yards), ZR 23-342 (required rear yard depth) and ZR 64-11 "
                      "(flood zone definitions), read from "
                      "zoningresolution.planning.nyc.gov on 2026-09-01 and quoted "
                      "in the constants at the top of this pipeline.",
            "plan_library": "HPD Pre-Approved Plan Library, "
                            "housing.hpd.nyc.gov/adu/library, eleven designs read "
                            "2026-09-01. Shipped as plans.json.",
            "budgeting_tool": "HPD ADU Budgeting Tool, "
                              "housing.hpd.nyc.gov/adu/budget. Defaults read off "
                              "the controls, behaviour measured by varying one "
                              "control at a time, 2026-09-01.",
            "eligibility": "DERIVED BY US from the Zoning Resolution itself, "
                           "with DCP's City of Yes ADU guide and HPD's guidebook "
                           "for the plain-language framing. NYC Open Data "
                           "publishes no ADU eligibility layer - the catalogue "
                           "was searched on 2026-08-31 and there is none. These "
                           "flags are our reading of a published rule, not a city "
                           "determination. AND ONE OF THEM IS AN APPROXIMATION OF "
                           "A LAYER WE COULD NOT OBTAIN - see sources.flood.",
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
            "usable_dimensions": int(usable_dims.sum()),
            "eligible_building_type": int(type_ok.sum()),
            "clears_the_setbacks": int((type_ok & width_ok & usable_dims).sum()),
            "fits_an_adu": int(fits.sum()),
            "eligible_backyard": int(backyard_ok.sum()),
            "eligible_and_in_the_high_risk_flood_zone":
                int((backyard_ok & in_high_risk).sum()),
            "note": "Total every join against a published figure before believing "
                    "it. BldgClass A*/B* and LandUse 01 are independent tests of "
                    "the same thing and they are reported separately above so a "
                    "disagreement between them is visible rather than averaged "
                    "away. ProxCode and the LotFront-BldgFront gap are a second "
                    "such pair; see building_type.cross_check.",
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
