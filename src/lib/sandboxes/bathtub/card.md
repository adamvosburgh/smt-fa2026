## What this is

A flood map of New York built one setting at a time. You pick a date and one of the published sea level projections; the sandbox turns that into a single water height for the harbour, adds a tide and optionally a storm, and colours in every piece of ground below it. The panel counts the buildings, homes and people on that ground. It's called a bathtub model because that is what it does: it fills the city like a tub, up to a line.

The ground comes from a national elevation survey,[^dem] the rise from the city's climate panel,[^npcc] the tides and storm levels from the gauge at the Battery,[^tides] and the buildings, homes and people from the city and the census.[^buildings]

[^dem]: USGS 3DEP, 1/3 arc-second (about 10 m), clipped to New York, metres above NAVD88; shipped at about 20 m per cell. Used instead of the city's one-foot lidar because it covers the whole country.
[^npcc]: NPCC4 (Braneon et al. 2024), NYC Open Data `38ps-fnsg`: 10th, 25th, 75th and 90th percentiles for the 2030s, 2050s, 2080s, 2100 and 2150, no median. In the 2030s the four are within 18 cm; by 2150 they run from 1.0 m to 4.5 m.
[^tides]: NOAA CO-OPS station 8518750, the Battery. Tidal datums on the 1983-2001 epoch relative to NAVD88 (low tide -0.85 m, high tide +0.70 m). Exceedance levels from NOAA's Sea Level Trends and Extremes site for the same station, read for October 2025: 99%, 50%, 10% and 1% annual chance, and no others. The product this succeeds retires 30 September 2026.
[^buildings]: NYC Building Footprints (470,578 kept, as points with recorded ground and roof heights), MapPLUTO `UnitsRes` for homes per lot, 2020 Census tract population (DP1) on NYC Open Data tract boundaries (2,325 tracts).

## What it's trying to show

- How a flood map gets made, and how many decisions sit inside one before any blue is drawn: the date, the projection, the tide, whether water needs a route to a place.
- How simple the method is. NOAA's Sea Level Rise Viewer is a bathtub model with a connectivity step and a varying tidal surface; the gap between this sandbox and an official map is small next to the gap between either and a flood.

## How it works

- Sea level rise, storm level and tide offset are added into one waterline, all in metres above NAVD88; a cell floods if its ground is below it.
- Storm levels already contain a high tide (NOAA fits them to annual maximum water levels; 2.51 m above NAVD88 equals 1.82 m above mean higher high water), so choosing a storm takes over the tide control rather than adding to it.
- Connectivity is precomputed as a "spill elevation" per cell, the lowest waterline at which the cell connects to open water; with the switch on the test becomes `spill <= waterline`, and the cells where `ground <= waterline < spill` are drawn red.
- Ground and spill heights are packed into the red and green channels of two PNGs and compared against the waterline in a shader; the flood line is wet cells next to dry ones.
- The panel's figures are computed separately on the CPU from the same two images with the same formula.
- A building is judged by its own recorded ground height; homes are divided across the buildings on a lot; population is counted in proportion to the share of a tract's area under water.
- Only new flooding is drawn, measured against today's high tide with no rise and no storm.

## What it assumes

- The sea is flat: one rise and one tide for the whole city.
- A storm is a higher number added everywhere at once, with no arrival, drain or wind.
- The storm levels are still-water levels with no waves; the 1% level is about 8.2 ft above NAVD88 and Sandy reached about 11.3 ft at this gauge. FEMA's base flood elevation is a different quantity that includes waves.
- Only four storms exist, because NOAA publishes four; the "500-year flood" is a FEMA figure.
- Storm levels (NOAA) and rise (NPCC) come from different agencies and are simply added; NOAA's own projected rise is never added too.
- Connectivity is a fixed property of terrain, though culverts, tide gates and pumps change it in hours.
- Buildings above 12 m are dropped, since the highest water the model can make is about 9.7 m.
- Homes are split evenly across a lot's buildings (counting the lot total per building gave 11.3 million homes in a city with 3.6 million).

## What it can't see

- Water moving: no rain, drainage, waves, storm that arrives and leaves, pump, or sea wall built in 2043.
- Anyone evacuating, or a basement filling from below.
- Anything most published flood maps see either; it is, more or less, the same model.
