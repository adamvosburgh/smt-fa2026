# Sea Level Flood Map — sandbox text

Every string a reader sees in the sandbox's menus, in reading order, for the 09-08 rebuild. This is the prose the build doc points Claude Code at; copy from here, do not rewrite. Register: flat, explanatory, model card.

## Title block

**Title.** Sea Level Flood Map

**Subtitle.** A flood map of New York that draws the full range of the city's sea level projections instead of picking one.

## Description panel (card.md)

## Description

The city publishes its sea level projections as a range, not a single figure. For each future date, the New York City Panel on Climate Change gives four values, the 10th, 25th, 75th and 90th percentiles of its projections, and no middle value.[^npcc] A percentile describes where a value sits in the spread of the panel's projections: the 90th percentile is a rise that 90 percent of the projections fall below. Most published flood maps pick one of the four on the reader's behalf, and most do not say which. This map draws all four.

You choose a storm, by how often it happens, and a future year. The ground comes from a national elevation survey,[^dem] the tides and storm levels from the gauge at the Battery,[^tides] and the buildings, homes and people from the city and the census.[^buildings] A storm level, a sea level rise and a tide offset are added into one waterline, in meters above NAVD88, and a cell floods if its ground is below it and water can reach it from open water. The map fills in the ground the storm reaches at today's sea level, and draws four lines showing where the same storm would reach under each of the four projections for that year. A second view draws every storm and every projection at once.

It is called a bathtub model because that is what it does: it fills the city like a tub, up to a line. NOAA's Sea Level Rise Viewer uses the same method with a connectivity step and a varying tidal surface, so the gap between this sandbox and an official map is small.

[^npcc]: NPCC4 (Braneon et al. 2024), NYC Open Data [`38ps-fnsg`](https://data.cityofnewyork.us/d/38ps-fnsg): 10th, 25th, 75th and 90th percentiles for the 2030s, 2050s, 2080s, 2100 and 2150, no median. In the 2030s the four are within 18 cm; by 2150 they run from 1.0 m to 4.5 m.
[^dem]: [USGS 3DEP](https://www.usgs.gov/3d-elevation-program), 1/3 arc-second (about 10 m), clipped to New York, meters above NAVD88; shipped at about 20 m per cell. Used instead of the city's one-foot lidar because it covers the whole country.
[^tides]: [NOAA CO-OPS station 8518750, the Battery](https://tidesandcurrents.noaa.gov/stationhome.html?id=8518750). Tidal datums on the 1983-2001 epoch relative to NAVD88 (low tide -0.85 m, high tide +0.70 m). Exceedance levels from NOAA's [Sea Level Trends and Extremes](https://tidesandcurrents.noaa.gov/est/) for the same station, read for October 2025: 99%, 50%, 10% and 1% annual chance, and no others. The product this succeeds retires 30 September 2026.
[^buildings]: [NYC Building Footprints](https://data.cityofnewyork.us/d/5zhs-2jue) (470,578 kept, as points with recorded ground and roof heights), [MapPLUTO](https://www.nyc.gov/site/planning/data-maps/open-data/dwn-pluto-mappluto.page) `UnitsRes` for homes per lot, [2020 Census](https://data.census.gov/) tract population (DP1) on NYC Open Data tract boundaries (2,325 tracts).

## Assumptions + Limitations

- The sea is flat: one rise and one tide for the whole city.
- A storm is a higher number added everywhere at once, with no arrival, drain, wind or waves. The storm levels are still-water levels; the 1% level is about 8.2 ft above NAVD88 and Sandy reached about 11.3 ft at this gauge. FEMA's base flood elevation is a different quantity that includes waves.
- Storm levels already contain a high tide, so choosing a storm takes over the tide control rather than adding to it.
- Only four storms exist, because NOAA publishes four; the "500-year flood" is a FEMA figure.
- Storm levels (NOAA) and rise (NPCC) come from different agencies and are simply added. The storm levels are on the 1983-2001 epoch with no trend added since.
- Connectivity is precomputed per cell as the lowest waterline at which the cell connects to open water, and treated as a fixed property of terrain, though culverts, tide gates and pumps change it in hours. With connectivity off, every low place floods, and the cells the sea cannot reach are drawn red.
- Only new flooding is drawn, measured against today's high tide with no rise and no storm.
- A building is judged by its own recorded ground height; buildings above 12 m are dropped, since the highest water the model can make is about 9.7 m.
- Homes are split evenly across a lot's buildings, and population is counted in proportion to the share of a tract's area under water.
- There is no time in the model: no rain, drainage, storm that arrives and leaves, pump, or sea wall built later. No one evacuates, and no basement fills from below.
- The map draws the range in the projections, but cannot say which of the four is more likely, because the panel does not.

## Representation panel

Panel heading: **representation**

**Show** (`view`)
Options: one storm, four projections · every storm, every projection. Default: one storm, four projections.
More: The first view fills in one storm at today's sea level and draws where it reaches under each of the four projections for the chosen year. The second draws all four storms and all sixteen lines at once, flat.

**Storm, by how often** (`aep`, shown in the one-storm view)
Options: none · 1-year · 2-year · 10-year · 100-year. Default: none.
More: NOAA's exceedance levels for the Battery: the water level with a 99%, 50%, 10% and 1% chance of being exceeded in a given year. "None" is today's high tide, so the four lines then show sea level rise alone.
Disabled note, when surge is set by hand: `overridden by the surge set by hand`.

**Shade by water depth** (`basemap`)
Options: by depth · flat. Default: by depth.
More: Shading shows how deep the water is over each cell. The all-storms view is always flat.
Disabled note, in the all-storms view: `flat in this view`.

**Flood line** (`flood_line`)
On or off. Default on.
More: The edge of the fill, drawn as the wet cells next to dry ones. The four projection lines are always drawn.

Legend, one-storm view: the fill swatch labeled with the storm and `today's sea level`; four line swatches labeled `10th percentile`, `25th`, `75th`, `90th` with the year; a red swatch labeled `floods only without connectivity`.

Legend, all-storms view: four fill swatches from dark to light blue labeled `1-year`, `2-year`, `10-year`, `100-year`, each with its four line shades beneath it labeled 10th, 25th, 75th, 90th.

Line under either legend: `Percentiles are the spread of the panel's projections: 90 percent of them fall below the 90th percentile line.`

## Assumptions panel

Panel heading: **assumptions**

### the scenario

**How far ahead** (`year`)
Options: 2030s · 2050s · 2080s · 2100 · 2150. Default: 2080s.
More: The five horizons NPCC4 publishes. All four projection lines are drawn for the chosen horizon.
Disabled note, when sea level is set by hand: `overridden by the sea level set by hand`.

### the water

**Tide state** (`tide`)
Options: low tide · mean sea level · high tide. Default: high tide.
More: The Battery's tidal datums: mean lower low water, mean sea level and mean higher high water, on the 1983-2001 epoch. A storm level already contains a high tide, so this control is taken over when a storm is chosen.
Disabled note, when a storm is chosen: `a storm level already includes high tide`.

### the model

**Hydraulic connectivity** (`connectivity`)
On or off. Default on.
More: With connectivity on, a place floods only if water can reach it from open water at that waterline. With it off, every low place floods, including inland dips the sea cannot reach; those cells are drawn red.

### by hand

**Set sea level by hand** (`slr_by_hand`)
On or off. Default off.
More: Replaces the four projections with one number of your own. The four lines collapse to one.

**Sea level rise** (`slr_m`, shown when set by hand)
Range 0 to 5 meters. Default 0.8.

**Set the surge by hand** (`surge_by_hand`)
On or off. Default off.
More: Replaces the published storm levels with a height of your own, added to the tide.

**Storm surge** (`surge_m`, shown when set by hand)
Range 0 to 4 meters. Default 0.

Button at the foot of the panel: **Submit this state**

## Metrics strip

One row per waterline. In the one-storm view the rows are `today` and the four percentiles for the chosen year; in the all-storms view the rows are the four storms at today's sea level. Columns:
- water height (m NAVD88)
- land newly under water
- buildings on that land
- homes in those buildings
- people in the tracts it covers
- land that floods only without connectivity

## Warnings and status lines

- `loading the ground heights…`
- `reading the grid…`
- `no basemap - the model still works`
- `{n} basemap tiles blocked - the model still works`

## What it can't see (assistant prompt, meta.js `cannotSee`)

Water moving. There is no time in this model, so there is no rain, no drainage, no waves, no storm that arrives and then leaves, no pump, and no sea wall built later. It is a line drawn where the ground meets a number, including when that number is a hundred-year storm, which arrives as a still water surface with no waves in it. That is also, more or less, the model most cities publish. It draws the range in the projections, but it cannot say which of the four is more likely, because the panel does not.
