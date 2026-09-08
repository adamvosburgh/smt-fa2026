---
title: "Data Sources"
date: "2026-09-06"
author: Adam Vosburgh
sequence: 4
cat: resource
published: true
---

The datasets the tutorials use, and places to look for more. Each sandbox's sources are footnoted on its own page.

## Used in the tutorials

- **2015 Street Tree Census.** NYC Parks, via [NYC Open Data](https://data.cityofnewyork.us/Environment/2015-Street-Tree-Census-Tree-Data/pi5s-9p35). About 666,000 trees, each visited by a volunteer. The tutorials use [a subset for upper Manhattan](https://drive.google.com/open?id=1ZpLafJbA2xRxJ55J8B4DsAveZBNSzUUD&usp=drive_fs) as a CSV. Coordinates are WGS 84.
- **2010 Census Blocks.** NYC Department of City Planning, via [NYC Open Data](https://data.cityofnewyork.us/City-Government/2010-Census-Blocks/v2h8-6mxf). The tutorials use [a subset](https://drive.google.com/open?id=1uIVLheQ73t7TlCwjRtuhjvSM9_4T0itM&usp=drive_fs) as a GeoPackage. `CT2010` is the tract, `CB2010` the block within it.
- **Land Cover 2010, 3 ft.** Made from aerial imagery for the city; the full attribution is in the metadata on [NYC Open Data](https://data.cityofnewyork.us/Environment/Landcover-Raster-Data-2010-3ft-Resolution/9auy-76zt), along with the data dictionary. EPSG:2263. The full raster is very large; Tutorial 2 uses a clip to the same area as the other two. **[Clip download: TBD.]**

## Where to look

- [NYC Open Data](https://opendata.cityofnewyork.us/). Most of the data the sandboxes use comes from here. The API behind it can return an error message with a success status code, so open what you downloaded and check that it is data.
- [NYC Department of City Planning](https://www.nyc.gov/content/planning/pages/resources): MapPLUTO, the 3D building model, zoning.
- [Columbia Library Geodata Portal](https://geodata.library.columbia.edu).
- [US Census Bureau](https://data.census.gov/), and the [TIGER/Line](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html) geographies.
- [HUD](https://www.huduser.gov/portal/datasets/fmr.html) for fair market rents and income limits, which the ADU sandbox uses.
- [NOAA Tides and Currents](https://tidesandcurrents.noaa.gov/) for the water levels under the Sea Level Flood Map.
- A general rule of thumb for finding data: think about who would have the motivation (and the money/resources) to create the dataset you are looking for then try to research that entity.

## Formats you'll meet

- Vector: shapefile (`.shp` plus four or five sidecar files, keep them together), GeoJSON, GeoPackage (`.gpkg`, one file, preferred), a CSV with latitude and longitude columns.
- Raster: GeoTIFF (`.tif`), or the older `.img` the land cover comes as. One number per cell, a coordinate system, a cell size.
- Coordinate reference systems: WGS 84 (`EPSG:4326`) for anything with latitude and longitude; New York State Plane, Long Island (`EPSG:2263`, feet) for local maps of the city. Check which one a dataset uses before you draw it.
