---
title: "Sea Level Flood Map dev notes"
date: "2026-08-30"
author: Adam Vosburgh
sequence: 5
cat: tutorial
devnotes: true
published: false
---

Notes from building the [Sea Level Flood Map](/sandboxes/bathtub/) sandbox, the first one built and the reference implementation for the others. Pipeline: `data/scripts/bathtub.py`. Component: `src/lib/sandboxes/bathtub/`.

![the sandbox at its defaults](/covers/bathtub.png#img-full)

<div class="gap">

**What a rebuild won't have.** The sandbox ships terrain for all five boroughs, about 470,000 building footprints and every census tract. A rebuild should use a much smaller window; the processing is the same.

</div>

## The ambition

Flood maps are probably the simulation most of us use most often: the 100-year floodplain, the 500-year floodplain, blue over the Rockaways with a date on it. The question was how those lines are computationally derived, from ground heights, a tide gauge and a climate projection to a boundary on a map. The idea was to build one from public data with every choice left as a control, and to be plain about how simple the method is. The 09-08 rebuild went one step further: the city publishes four projections for each date and no middle one, so the map stopped picking one and now draws all four.

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
- Drawing four projections at once meant the shader could no longer take one waterline. It now takes up to four fill levels and up to sixteen line levels; the saving that makes that affordable is that the level a cell floods at does not depend on which line is being drawn, so the five texture decodes (this cell and its four neighbors) happen once and every line after that is arithmetic.
- Every uniform in the shader's block had to become a `vec4`, single numbers included. std140 packing of mixed scalars and vectors fails as a map shifted by one float rather than as an error, which is the worst way for it to fail.
- The metrics went from one figure to five rows, so `onmetrics` had to be able to report a table. The frame renders one when it sees a `rows` array and the flat list otherwise, and the first row is also flattened into the old top-level keys so the build doctor's stage 2 still compares numbers by name.
- Five CPU passes over the shipped grid, one per waterline, come out at about 35 ms in total on this machine (53 ms for the all-storms view's four deeper waterlines) - inside a frame, so no worker was needed. The build doc allowed for one above 100 ms; the figure is printed on the map so the next person can see whether it was measured or assumed.

## What came out

A map that floods New York up to a line you set, showing the whole published range rather than one number out of it. You choose the storm; the map draws where it reaches today and four lines for where it would reach under each projection.

### What you should see

The hundred-year storm, connectivity off, with the four projections for 2080:

<div data-sandbox="bathtub" data-mode="view" data-params='{"view":"one_storm","aep":"1","connectivity":false,"tide":"mhhw","year":2080,"basemap":"elevation","flood_line":true,"slr_by_hand":false,"slr_m":0.8,"surge_by_hand":false,"surge_m":0}'></div>

- The fill is the storm at today's sea level; the four lines are the same storm plus each projection's rise. They nest in percentile order and never cross.
- The red patches are ground below the waterline that water can't reach; turning connectivity on removes them.
- At the defaults - no storm, 2080s - the fill is essentially today's shoreline and the four lines show rise alone. That is the picture the four percentiles make on their own.
- The metrics table is one row per waterline: today, then the four projections. Land under water increases down the rows and never falls.
- The all-storms view draws four nested fills and sixteen lines, flat, with the depth shading grayed out - four fills cannot each carry a depth.
- Picking the 1% storm grays out the tide control and gives about 8.2 ft above NAVD88; Sandy reached about 11.3 ft at this gauge, the difference being waves.
- Zoomed in, the flood line becomes a staircase of grid cells.

### Limitations

- Precomputing the spill elevation asserts that connectivity is a fixed property of terrain; culverts, tide gates, pumps and barriers change it in hours.
- The sea is flat (one rise, one tide) and a storm is a higher number added everywhere at once, with no waves.
- Cells are about 20 m, so buildings are judged by their own recorded ground height, and population stays at tract resolution.
- There is no time: no rain, drainage, arrival or drain-down.
- Drawing all four projections says what the range is; it still cannot say which of them is more likely, because the panel does not publish a median.

---

Notes by Adam Vosburgh, Fall 2026.
