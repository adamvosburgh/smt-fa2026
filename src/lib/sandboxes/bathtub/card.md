<!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->

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
