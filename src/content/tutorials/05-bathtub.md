---
title: "Sea Level Flood Map dev notes"
date: "2026-08-30"
author: Adam Vosburgh
sequence: 5
cat: tutorial
devnotes: true
published: true
---

Notes from building the [Sea Level Flood Map](/sandboxes/bathtub/) sandbox, the first one built and the reference implementation for the others. Pipeline: `data/scripts/bathtub.py`. Component: `src/lib/sandboxes/bathtub/`.

![the sandbox at its defaults](/covers/bathtub.png#img-full)

<div class="gap">

**What a rebuild won't have.** The sandbox ships terrain for all five boroughs, about 470,000 building footprints and every census tract. A rebuild should use a much smaller window; the processing is the same.

</div>

## The ambition

Flood maps are probably the simulation most of us use most often: the 100-year floodplain, the 500-year floodplain, blue over the Rockaways with a date on it. The question was how those lines are computationally derived, from ground heights, a tide gauge and a climate projection to a boundary on a map. The idea was to build one from public data with every choice left as a control, and to be plain about how simple the method is.

## The parts

- **USGS 3DEP elevation, 1/3 arc-second** (about 10 m), clipped to New York, in meters above NAVD88. Gives the ground; shipped at about 20 m per cell.
- **NPCC4 sea level rise projections** (NYC Open Data `38ps-fnsg`): four percentiles for five dates, no median. Gives the rise.

![NPCC projections](/tutorials/images/05/npcc-projections.png#img-full)

- **NOAA station 8518750, the Battery.** Tidal datums (1983-2001 epoch) give the tide offsets; exceedance levels from the Sea Level Trends and Extremes site (October 2025) give the four storms.

![water levels on one scale](/tutorials/images/05/water-levels.png#img-full)

- **NYC Building Footprints, MapPLUTO (`UnitsRes`), 2020 census tract population.** Give the buildings, homes and people counted in the panel.
- **Spill elevation**, derived at build time: the lowest waterline at which each cell connects to open water. Gives the connectivity switch.

## Roadblocks

- Joining `UnitsRes` (homes per lot) onto every footprint gave 11.3 million homes in a city with about 3.6 million; the count is now divided across a lot's buildings.
- Open water is below the waterline too, so a plain threshold floods the harbour; everything is measured against today's high tide and only new flooding is drawn.
- A surge slider in meters meant nothing to anyone, so storms became NOAA's four published levels, named by annual chance, with the slider kept as an override.
- NOAA's exceedance levels already contain a high tide (the 1% level is stated both as 2.51 m above NAVD88 and as 1.82 m above mean higher high water), so picking one disables the tide control; adding both would have raised every 100-year map by about 70 cm.
- NOAA publishes exactly four levels; there is no 2% or 0.2%, and the "500-year flood" is a FEMA figure computed differently.
- The storm levels are NOAA's and the rise is the NPCC's; NOAA's own projected rise is never added as well, since that would count the rise twice.
- The NOAA product first cited retires on 30 September 2026; the values were re-read from its successor and the manifest records the month.

## What came out

A map that floods New York up to a line you set, with the choices usually made for you left as controls.

### What you should see

Connectivity off, 1.5 m of rise:

<div data-sandbox="bathtub" data-mode="view" data-params='{"slr_m":1.5,"link_year":false,"connectivity":false,"aep":"none","surge_m":0,"tide":"mhhw","percentile":75,"year":2080,"basemap":"elevation","flood_line":true}'></div>

- The red patches are ground below the waterline that water can't reach; turning connectivity on removes them.
- At 2150 the four projections run from 1.0 m to 4.5 m, and the spread is not symmetric.
- Picking the 1% storm grays out the tide control and gives about 8.2 ft above NAVD88; Sandy reached about 11.3 ft at this gauge, the difference being waves.
- Zoomed in, the flood line becomes a staircase of grid cells.

### Limitations

- Precomputing the spill elevation asserts that connectivity is a fixed property of terrain; culverts, tide gates, pumps and barriers change it in hours.
- The sea is flat (one rise, one tide) and a storm is a higher number added everywhere at once, with no waves.
- Cells are about 20 m, so buildings are judged by their own recorded ground height, and population stays at tract resolution.
- There is no time: no rain, drainage, arrival or drain-down.

---

Notes by Adam Vosburgh, Fall 2026.
