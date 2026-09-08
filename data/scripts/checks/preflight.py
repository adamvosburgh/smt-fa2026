"""Preflight: is every dataset the pipelines need actually on disk?

Run this BEFORE handing the repo to Claude Code, and again after any fetch
script. Every path here is the path the pipeline really constructs - copied from
the source, not from a build doc - so a PASS means the pipeline will find its
input, and a FAIL is a real blocker rather than a documentation drift.

    python3 data/scripts/checks/preflight.py

Exit code is the number of blocking failures.
"""
import json, os, sys, zipfile
from pathlib import Path

def content_ok(path):
    """Size is not enough. On 2026-09-04 three Socrata files arrived as HTTP 200
    with a {"code":"permission_denied"} JSON body, passed every size check, and
    were skipped as 'already here' on the next run. Look inside."""
    n = path.name
    try:
        if n.endswith(".csv"):
            head = path.open("rb").read(400)
            if head[:1] in (b"{", b"<"): return "a JSON or HTML error body, not CSV"
            if b'"error"' in head.lower(): return "an error body"
        elif n.endswith(".geojson"):
            if b'"FeatureCollection"' not in path.open("rb").read(200):
                return "not a GeoJSON FeatureCollection"
        elif n.endswith(".zip"):
            zipfile.ZipFile(path).namelist()
        elif n.endswith(".json"):
            json.load(path.open())
    except Exception as e:
        return f"unreadable: {e}"
    return None

REPO = Path(__file__).resolve().parents[3]
ORIG = REPO / "data" / "original"

# (label, path, minimum bytes, blocking?, who needs it)
CHECKS = [
  ("--- 01 Does It Pencil", None, 0, None, None),
  ("MapPLUTO .dbf",  ORIG/"nyc_mappluto_26v2_shp/MapPLUTO.dbf", 10**9, True, "pencil.py main() step 1, bathtub.py, after-five.py"),
  ("MapPLUTO .shp",  ORIG/"nyc_mappluto_26v2_shp/MapPLUTO.shp", 10**8, True, "pencil.py read_shape_index"),
  ("MapPLUTO .shx",  ORIG/"nyc_mappluto_26v2_shp/MapPLUTO.shx", 10**5, True, "pencil.py read_shape_index"),
  ("building footprints", ORIG/"BUILDING_20260830.geojson", 9*10**8, True, "pencil.py read_building_shapes, bathtub.py, after-five.py"),
  # pencil.py main() HUD step looks in fmr+incomelimit/ then falls back to data/original,
  # deliberately - "data/original is a download folder, not a schema". Mirror
  # that here rather than inventing a requirement the pipeline does not have.
  ("HUD income limits", [ORIG/"fmr+incomelimit/summary_county_3608199999.csv", ORIG/"summary_county_3608199999.csv"], 300, True, "pencil.py read_income_limits"),
  ("HUD SAFMR xlsx",  [ORIG/"fmr+incomelimit/fy2026_safmrs_revised.xlsx", ORIG/"fy2026_safmrs_revised.xlsx"], 10**6, True, "pencil.py read_safmr"),
  ("HPD plan library", ORIG/"hpd_papl_plans.json", 3000, True, "pencil.py read_papl"),
  ("ACS Queens tracts cache", ORIG/"acs_queens_tracts_2023.json", 10000, False, "pencil.py fetch_acs - refetched if absent and CENSUS_API_KEY is set"),
  ("NPCC 2050s floodplain", ORIG/"future_floodplain_2050s_20260831.geojson", 10**7, True, "pencil.py flood flags"),
  ("NPCC 2080s SLR", ORIG/"sea_level_rise_2080s_100yr_20260831.geojson", 10**6, True, "pencil.py flood flags"),

  ("--- 02 After Five, existing", None, 0, None, None),
  ("DOB conversions", ORIG/"dob_manhattan_conversions.json", 10**6, True, "after-five.py measure_sf_per_unit"),
  ("2020 decennial DP1", ORIG/"DECENNIALDP2020.DP1_2026-08-30T202723/DECENNIALDP2020.DP1-Data.csv", 10**6, True, "after-five.py rglob"),
  ("LODES 8 WAC 2023 NY", ORIG/"ny_wac_S000_JT00_2023.csv.gz", 10**6, True, "after-five.py LODES join"),
  ("CityGML delivery areas", ORIG/"DA_WISE_GML/DA_WISE_GMLs", 0, True, "after-five.py via afterfive_massing.read_citygml - dir of DA*_3D_Buildings_Merged.gml; 13GB, delivery areas 12 and 19 are the ones read"),

  ("--- 02 After Five, the agent layer (NEW)", None, 0, None, None),
  ("MTA subway entrances", ORIG/"mta_subway_entrances_2024.csv", 50000, True, "fetch-sources-0904.sh #1"),
  ("MTA O-D arrivals", ORIG/"mta_od_arrivals_study_districts_2024.csv", 20000, True, "fetch-sources-0904.sh #2"),
  ("MTA O-D departures", ORIG/"mta_od_departures_study_districts_2024.csv", 20000, True, "fetch-sources-0904.sh #2"),
  ("MTA evening destinations", ORIG/"mta_od_evening_destinations_2024.csv", 2000, False, "fetch-sources-0904.sh #2 - labels the animation, does not drive it"),
  ("MTA hourly entries (check)", ORIG/"mta_hourly_entries_lowermanhattan_oct2025.csv", 200, False, "fetch-sources-0904.sh #3 - cross-check only"),
  ("NYC street centerline CSCL", ORIG/"nyc_street_centerline_cscl.geojson", 10**7, False, "fetch-sources-0904.sh #4 - was the agent layer's trip network. The agents were removed on 2026-09-08 and nothing reads it now; kept as a warning rather than a blocker."),
  ("ATUS activity 2003-2025", ORIG/"atusact-0325.zip", 5*10**7, True, "fetch-sources-0904.sh #5 - afterfive_day.resident_curve, the at-home curve"),
  ("ATUS respondent 2003-2025", ORIG/"atusresp-0325.zip", 10**7, True, "fetch-sources-0904.sh #5 - TUDIARYDAY/TUFNWGTP/TUYEAR"),

  ("--- the 09-08 reframe (NEW)", None, 0, None, None),
  ("NYC borough boundaries", ORIG/"borough_boundaries.geojson", 10**6, True, "fetch-sources-0908.sh - pencil.py write_queens_polygon. The build doc's tqmj-j8zm does not exist; the script fetches gthc-hcne and says so."),
  ("NYC community districts", ORIG/"community_districts.geojson", 10**6, True, "fetch-sources-0908.sh - afterfive_day.district_outlines. The build doc's yfnk-k7r4 does not exist; the script fetches 5crt-au7u and says so."),
  ("bathtub tract outlines (derived)", REPO/"data/processed/bathtub/tracts.json", 10**5, True, "pencil.py reuses these for its own tract choropleth rather than refetching. Run bathtub.py first."),

  ("--- 04 Anthromes", None, 0, None, None),
  ("HYDE 3.2 raw-data.zip", ORIG/"anthromes-inputs/raw-data.zip", 8*10**8, True, "the six input grids + five supporting grids"),
  ("Anthromes reference code", ORIG/"anthromes-inputs/anthromes12k_replication_IB4VCI.zip", 3*10**7, False, "the cascade gets checked against it"),
  # The 18GB HYDE 3.5 archive was cleared once 3.2 was chosen - correctly, it is
  # not needed. The version-comparison plane is the ALREADY-AGGREGATED 33km grid
  # from the sibling repo: 13,870,228 bytes = 182,503 land cells x 76 years.
  ("HYDE 3.5 33km codes", ORIG/"anthromes-hyde35-33km/codes.bin", 13_870_000, False, "third comparison layer - copy from twosides/temp/grid/33km/"),
  ("HYDE 3.5 33km mask",  ORIG/"anthromes-hyde35-33km/mask.bin",      89_000, False, "same"),

  ("--- 05 Bathtub", None, 0, None, None),
  ("USGS 3DEP DEM", ORIG/"output_USGS10m.tif", 5*10**7, True, "bathtub.py step_dem"),
  ("2020 census tracts", ORIG/"2020_Census_Tracts_20260830.geojson", 10**6, True, "bathtub.py tracts"),
]

fails = warns = 0
print(f"repo: {REPO}\n")
for label, path, minb, blocking, who in CHECKS:
    if path is None:
        print(f"\n{label}"); continue
    if isinstance(path, list):                     # any-of; the pipeline falls back
        path = next((c for c in path if c.exists()), path[0])
    if path.is_dir():
        n = len(list(path.glob("*.gml"))) or len(list(path.iterdir()))
        ok, detail = n > 0, f"{n} files"
    elif path.exists():
        b = path.stat().st_size
        bad = content_ok(path)
        if bad:
            ok, detail = False, f"{b:,} bytes but {bad}"
        else:
            ok, detail = b >= minb, f"{b:,} bytes" + ("" if b >= minb else f" (under the {minb:,} floor)")
    else:
        ok, detail = False, "not found"
    if ok:
        print(f"  ok    {label:30} {detail}")
    elif blocking:
        fails += 1
        print(f"  FAIL  {label:30} {detail}\n          needed by {who}\n          {path.relative_to(REPO)}")
    else:
        warns += 1
        print(f"  warn  {label:30} {detail}  ({who})")

# things that are not files
print("\n--- other preconditions")
env = REPO/".env"
if env.exists() and "CENSUS_API_KEY" in env.read_text():
    print("  ok    CENSUS_API_KEY                 present in .env")
else:
    warns += 1
    print("  warn  CENSUS_API_KEY                 absent - pencil tract income is 0 and")
    print("          after-five household_size falls back. Both cache to data/original,")
    print("          so this only matters on a cold re-run.")

# The O-D curves: shape, not size. 41 complexes x 24 hours = 984 rows, and the
# departure peak must land in the evening or the join is wrong.
import csv as _csv, collections as _c
for lbl, f, idcol in (("O-D arrivals", "mta_od_arrivals_study_districts_2024.csv", "destination_station_complex_id"),
                      ("O-D departures", "mta_od_departures_study_districts_2024.csv", "origin_station_complex_id")):
    fp = ORIG/f
    if not fp.exists() or content_ok(fp):
        continue
    try:
        rows = list(_csv.DictReader(fp.open()))
        hrs = _c.Counter()
        for r in rows: hrs[int(r["hour_of_day"])] += float(r["riders"])
        cx = {r[idcol] for r in rows}
        peak = max(hrs, key=hrs.get)
        want_evening = "departures" in lbl
        good = len(hrs) == 24 and len(cx) >= 30 and ((peak >= 15) == want_evening)
        print(f"  {'ok  ' if good else 'FAIL'}  {lbl:30} {len(cx)} complexes, {len(hrs)}/24 hours, peak {peak:02d}:00")
        if not good:
            fails += 1
            print("          expected 24 hours, 30+ complexes, and a peak in the "
                  + ("evening" if want_evening else "morning"))
    except Exception as e:
        fails += 1; print(f"  FAIL  {lbl:30} unparseable: {e}")

# HYDE 3.2 internals, since a truncated download passes a size check
z = ORIG/"anthromes-inputs/raw-data.zip"
if z.exists():
    try:
        names = set(zipfile.ZipFile(z).namelist())
        need = {"raw-data/HYDE.zip", "raw-data/supporting_5m_grids.zip"}
        miss = need - names
        print("  ok    raw-data.zip structure        both nested archives present" if not miss
              else f"  FAIL  raw-data.zip structure        missing {miss}")
        if miss: fails += 1
    except Exception as e:
        fails += 1; print(f"  FAIL  raw-data.zip                   unreadable: {e}")

print(f"\n{fails} blocking, {warns} advisory")
if fails:
    print("\nBlocking items must be on disk before Claude Code starts. Run:")
    print("  bash data/scripts/fetch-sources-0904.sh")
    print("  bash data/scripts/fetch-anthromes-inputs.sh")
sys.exit(fails)
