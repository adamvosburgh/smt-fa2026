# Source datasets

**Nothing in this folder is committed.** It is gitignored except for this file.

These are the datasets as downloaded, never edited in place. They are large - the
folder is currently about 2.2GB - and every one of them is public and
re-downloadable, so keeping them in the repo would cost a great deal and buy
nothing. What ships is `data/processed/`, which *is* committed.

That means a fresh clone can run the site but cannot re-run the pipeline. To
re-run it you have to fetch the sources again. The header of each script in
`data/scripts/` is the authoritative record of what it reads and what it takes
from each file - read it before downloading anything, because in most cases only
one or two columns are used and the rest of the file is never opened.

## What is currently here

For `bathtub.py` (Sandbox 07). See its docstring for the fields taken, the units,
and the reprojection.

| File | Dataset |
| --- | --- |
| `output_USGS10m.tif` | USGS 3DEP 1/3 arc-second DEM, clipped to the NYC bounding box. EPSG:4269, metres above NAVD88. |
| `BUILDING_20260830.geojson` | NYC Building Footprints, NYC Open Data. |
| `nyc_mappluto_26v2_shp/` | MapPLUTO 26v2, shapefile release. Only `MapPLUTO.dbf` is read. |
| `2020_Census_Tracts_20260830.geojson` | 2020 Census Tracts, NYC Open Data `63ge-mke6`. |
| `DECENNIALDP2020.DP1_2026-08-30T202723/` | Decennial 2020 DP1 table, downloaded from data.census.gov. Total population is `DP1_0001C`. |

For `pencil.py` (Sandbox 02):

| File | Dataset |
| --- | --- |
| `fmr+incomelimit/fy2026_safmrs_revised.xlsx` | HUD Small Area Fair Market Rents FY2026, by ZIP code. Small Area rather than county on purpose - the county figure is one number for the whole metro and would not vary across Queens. |
| `fmr+incomelimit/summary_county_3608199999.csv` | HUD FY2026 Income Limits. **Not Queens** - these cover the whole New York, NY HUD Metro FMR Area: Bronx, Kings, New York, Putnam, Queens, Richmond, Rockland and Westchester. HUD publishes no smaller geography. |
| `future_floodplain_2050s_*.geojson` | Future Floodplain 2050s, NYC Open Data `27ya-gqtm`. |
| `sea_level_rise_2080s_100yr_*.geojson` | Sea Level Rise Maps, 2080s 100-year floodplain, NYC Open Data `ek8y-fsqz`. |
| `acs_queens_tracts_2023.json` | Cached Census API response, ACS 5-year 2023, tracts in state 36 county 081. Written by the script; delete it to refetch. |

For `after-five.py` (Sandbox 03):

| File | Dataset |
| --- | --- |
| `DA_WISE_GML/DA_WISE_GMLs/DA*.gml` | DCP 3-D Building Model as CityGML 2.0, NYC Open Data `tnru-abg2`. Twenty delivery areas, 13GB, EPSG:2263 in feet. Only DA12 and DA19 are read - they hold Manhattan Community Districts 1 and 5. Every surface carries its BIN, which is why this is used and not the file below. |
| `3D/NYC_3DModel_MN01.3dm`, `MN05` | The same survey as Rhino files, NYC Open Data `u5j4-zxpn`. **Not used.** They carry no attributes at all - no BIN, no BBL - so identity had to be inferred by position, and that was wrong for one building in five. Kept only because the comparison is documented in `afterfive_massing.py`. |
| `dob_manhattan_conversions.json` | Cached DOB responses: legacy job filings `ic3t-wcy2` and certificates of occupancy `pkdm-hqz6`. Written by the script; delete it to refetch. |

Download URLs are deliberately not listed here: they have not been verified
against what was actually fetched, and a stale URL that looks authoritative is
worse than none. Add one only once you have re-downloaded from it and the
pipeline has run clean.

Two further inputs to the bathtub model are not files and are already in the
repo, hardcoded with their citations: the NPCC4 sea level rise projections
(NYC Open Data `38ps-fnsg`, Braneon 2024) and the tidal datums at The Battery
(NOAA CO-OPS station 8518750).

## Conventions

- Shared across sandboxes, so no per-project subfolders. If two sandboxes need
  the same DEM, they read the same file.
- Never edited in place. If a source needs fixing, fix it in the script.
- Keep the downloaded filename. The dates in these names are download dates and
  they are the only provenance some of these files carry.
