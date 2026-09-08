# Sea Level Flood Map — sandbox text

Every string a reader sees in the sandbox's menus, in reading order, for the 09-08 rebuild. This is the prose the build doc points Claude Code at; copy from here, do not rewrite. Register: flat, explanatory, model card.

## Title block

**Title.** Sea Level Flood Map

**Subtitle.** A flood map of New York that shows the range in the city's sea level projections instead of picking one. Choose a storm, and the map draws where it reaches today and where it would reach under each of the four published projections for a future year.

## Description panel (card.md)

## What this is

A flood map of New York built from one number at a time. The city publishes its sea level projections as a range, not a single figure: for each future date, the New York City Panel on Climate Change gives four values, the 10th, 25th, 75th and 90th percentiles of its projections, and deliberately no middle value.[^npcc] A percentile describes where a value sits in the spread of the panel's projections: the 90th percentile is a rise that 90 percent of the projections fall below, and the 10th is one that only 10 percent fall below. There is no 50th, so there is no "most likely" number to draw. Most published flood maps pick one of the four on the reader's behalf, and most do not say which.

This map draws all four. You choose a storm, by how often it happens, and a future year. The map fills in the ground the storm reaches at today's sea level, and draws four lines showing where the same storm would reach under each of the four projections for that year. A second view draws every storm and every projection at once.

The ground comes from a national elevation survey,[^dem] the rise from the city's climate panel, the tides and storm levels from the gauge at the Battery,[^tides] and the buildings, homes and people from the city and the census.[^buildings] It is called a bathtub model because that is what it does: it fills the city like a tub, up to a line.

[^npcc]: NPCC4 (Braneon et al. 2024), NYC Open Data `38ps-fnsg`: 10th, 25th, 75th and 90th percentiles for the 2030s, 2050s, 2080s, 2100 and 2150, no median. In the 2030s the four are within 18 cm; by 2150 they run from 1.0 m to 4.5 m.
[^dem]: USGS 3DEP, 1/3 arc-second (about 10 m), clipped to New York, meters above NAVD88; shipped at about 20 m per cell. Used instead of the city's one-foot lidar because it covers the whole country.
[^tides]: NOAA CO-OPS station 8518750, the Battery. Tidal datums on the 1983-2001 epoch relative to NAVD88 (low tide -0.85 m, high tide +0.70 m). Exceedance levels from NOAA's Sea Level Trends and Extremes site for the same station, read for October 2025: 99%, 50%, 10% and 1% annual chance, and no others. The product this succeeds retires 30 September 2026.
[^buildings]: NYC Building Footprints (470,578 kept, as points with recorded ground and roof heights), MapPLUTO `UnitsRes` for homes per lot, 2020 Census tract population (DP1) on NYC Open Data tract boundaries (2,325 tracts).

## What it's trying to show

- That a sea level projection is a range, and what the range looks like on the ground: four lines for one storm and one year, sometimes close together and sometimes blocks apart.
- How a flood map gets made, and how many decisions sit inside one before any blue is drawn: the storm, the year, the projection, the tide, whether water needs a route to a place.
- How simple the method is. NOAA's Sea Level Rise Viewer is a bathtub model with a connectivity step and a varying tidal surface; the gap between this sandbox and an official map is small next to the gap between either and a flood.

## How it works

- A storm level, a sea level rise and a tide offset are added into one waterline, in meters above NAVD88; a cell floods if its ground is below it.
- Storm levels already contain a high tide (NOAA fits them to annual maximum water levels; 2.51 m above NAVD88 equals 1.82 m above mean higher high water), so choosing a storm takes over the tide control rather than adding to it.
- In the one-storm view, the fill is the chosen storm at today's sea level, and each of the four lines is the same storm plus one percentile's rise for the chosen year. In the all-storms view, the four storms are filled in four shades of blue at today's sea level, and each storm's four projection lines are drawn in shades of its own color.
- Connectivity is precomputed as a "spill elevation" per cell, the lowest waterline at which the cell connects to open water; with the switch on the test becomes `spill <= waterline`, and the cells where `ground <= waterline < spill` are drawn red.
- Ground and spill heights are packed into the red and green channels of two PNGs and compared against each waterline in a shader; every line is the set of wet cells next to dry ones at that waterline.
- The panel's figures are computed separately on the CPU from the same two images with the same formula, once for today and once for each projection.
- A building is judged by its own recorded ground height; homes are divided across the buildings on a lot; population is counted in proportion to the share of a tract's area under water.
- Only new flooding is drawn, measured against today's high tide with no rise and no storm.

## What it assumes

- The sea is flat: one rise and one tide for the whole city.
- A storm is a higher number added everywhere at once, with no arrival, drain or wind.
- The storm levels are still-water levels with no waves; the 1% level is about 8.2 ft above NAVD88 and Sandy reached about 11.3 ft at this gauge. FEMA's base flood elevation is a different quantity that includes waves.
- Only four storms exist, because NOAA publishes four; the "500-year flood" is a FEMA figure.
- Storm levels (NOAA) and rise (NPCC) come from different agencies and are simply added; NOAA's own projected rise is never added too, and the storm levels are on the 1983-2001 epoch with no trend added since.
- Connectivity is a fixed property of terrain, though culverts, tide gates and pumps change it in hours.
- Buildings above 12 m are dropped, since the highest water the model can make is about 9.7 m.
- Homes are split evenly across a lot's buildings (counting the lot total per building gave 11.3 million homes in a city with 3.6 million).

## What it can't see

- Water moving: no rain, drainage, waves, storm that arrives and leaves, pump, or sea wall built in 2043.
- Anyone evacuating, or a basement filling from below.
- Anything most published flood maps see either; it is, more or less, the same model.

## Representation panel

Panel heading: **representation**

**Show** (`view`)
Options: one storm, four projections · every storm, every projection. Default: one storm, four projections.
Why these numbers: The first view fills in one storm at today's sea level and draws where it reaches under each of the four projections for the chosen year. The second draws all four storms and all sixteen lines at once, flat, so the whole published range is on one map.

**Storm, by how often** (`aep`, shown in the one-storm view)
Options: none · 1-year · 2-year · 10-year · 100-year. Default: none.
Why these numbers: NOAA's exceedance levels for the Battery, published as the water level with a 99%, 50%, 10% and 1% chance of being exceeded in a given year. "None" is today's high tide, so the four lines then show sea level rise alone. The levels are still water with no waves; the 100-year level is about 8.2 ft above NAVD88, and Sandy reached about 11.3 ft at this gauge.
Disabled note, when surge is set by hand: `overridden by the surge set by hand`.

**Shade by water depth** (`basemap`)
Options: by depth · flat. Default: by depth.
Why these numbers: Shading shows how deep the water is over each cell. The all-storms view is always flat, because four fills cannot each carry a depth.
Disabled note, in the all-storms view: `flat in this view`.

**Flood line** (`flood_line`)
On or off. Default on.
Why these numbers: The edge of the fill, drawn as the wet cells next to dry ones. The four projection lines are always drawn.

Legend, one-storm view: the fill swatch labeled with the storm and `today's sea level`; four line swatches labeled `10th percentile`, `25th`, `75th`, `90th` with the year; a red swatch labeled `floods only without connectivity`.

Legend, all-storms view: four fill swatches from dark to light blue labeled `1-year`, `2-year`, `10-year`, `100-year`, each with its four line shades beneath it labeled 10th, 25th, 75th, 90th.

Line under either legend: `Percentiles are the spread of the panel's projections: 90 percent of them fall below the 90th percentile line.`

## Assumptions panel

Panel heading: **assumptions**

### the scenario

**How far ahead** (`year`)
Options: 2030s · 2050s · 2080s · 2100 · 2150. Default: 2080s.
Why these numbers: The five horizons NPCC4 publishes. All four projection lines are drawn for the chosen horizon.
Disabled note, when sea level is set by hand: `overridden by the sea level set by hand`.

### the water

**Tide state** (`tide`)
Options: low tide · mean sea level · high tide. Default: high tide.
Why these numbers: The Battery's tidal datums: mean lower low water, mean sea level and mean higher high water, on the 1983-2001 epoch. A storm level already contains a high tide, so this control is taken over when a storm is chosen.
Disabled note, when a storm is chosen: `a storm level already includes high tide`.

### the model

**Hydraulic connectivity** (`connectivity`)
On or off. Default on.
Why these numbers: With connectivity on, a place floods only if water can reach it from open water at that waterline. With it off, every low place floods, including inland dips the sea cannot reach; those cells are drawn red. Many published maps make this choice without saying so.

### by hand

**Set sea level by hand** (`slr_by_hand`)
On or off. Default off.
Why these numbers: Replaces the four projections with one number of your own. The four lines collapse to one.

**Sea level rise** (`slr_m`, shown when set by hand)
Range 0 to 5 meters. Default 0.8.

**Set the surge by hand** (`surge_by_hand`)
On or off. Default off.
Why these numbers: Replaces the published storm levels with a height of your own, added to the tide.

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

Water moving. There is no time in this model, so there is no rain, no drainage, no waves, no storm that arrives and then leaves, no pump, no sea wall someone builds in 2043. It is a line drawn where the ground meets a number, including when that number is a hundred-year storm, which arrives here as a still water surface with no waves in it. That is also, more or less, the model most cities publish. It draws the range in the projections, but it cannot say which of the four is more likely, because the panel does not.
