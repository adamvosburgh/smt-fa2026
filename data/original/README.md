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
