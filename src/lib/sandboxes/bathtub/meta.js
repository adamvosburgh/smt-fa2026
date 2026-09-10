// PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide.
//
// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'bathtub',
  title: 'Sea Level Flood Map',
  subtitle:
    "A flood map of New York that draws the full range of the city's sea level projections instead of picking one.",
  status: 'reference',
  statusNote:
    'Built first, as the reference implementation of the sandbox contract. Everything in it is published data: the USGS terrain for New York, the NPCC4 projections, the tidal datums and storm levels from the gauge at the Battery, the city building footprints. Read this one before building any of the others.',
  kind: 'model',
  blurb:
    "The city publishes its sea level projections as a range, not a single figure: four percentiles for each future date and no middle value. Most flood maps pick one of the four on the reader's behalf. This one draws all four. The fill is a storm at today's sea level, and the four lines are where the same storm would reach under each projection for the chosen year. It is a bathtub model: it fills the city like a tub, up to a line.",
  controls: [
    'Show: one storm with its four projections, or every storm and every projection at once',
    'Storm, by how often it happens: none, 1-year, 2-year, 10-year, 100-year',
    'Shade by water depth, or flat',
    'Flood line',
    'How far ahead: the 2030s, 2050s, 2080s, 2100 or 2150',
    'Tide state: low tide, mean sea level or high tide',
    'Hydraulic connectivity',
    'Set sea level by hand, and the sea level rise it uses',
    'Set the surge by hand, and the storm surge it uses'
  ],
  metrics: [
    'one row per waterline: today and the four percentiles in the one-storm view, the four storms in the all-storms view',
    'water height (m NAVD88)',
    'land newly under water',
    'buildings on that land',
    'homes in those buildings',
    'people in the tracts it covers',
    'land that floods only without connectivity'
  ],
  data: [
    'Ground height: USGS 3DEP 1/3 arc-second elevation model (about 10m per cell), clipped to New York. Heights are meters above NAVD88.',
    'Sea level rise: NPCC4 projections (Braneon et al. 2024, NYC Open Data 38ps-fnsg). Four percentiles, five horizons, no median.',
    'Tides: NOAA station 8518750 at the Battery, 1983-2001 epoch, relative to NAVD88.',
    'Storms: NOAA exceedance probability levels at the same station, from the Sea Level Trends and Extremes site, read for October 2025. Four levels (99%, 50%, 10%, 1%) and no others are published. Still-water levels fitted to annual maxima, so no waves, and lower than a FEMA base flood elevation.',
    'Buildings: NYC Building Footprints. We keep a point, the recorded ground height and the roof height, both converted from feet.',
    'Homes: MapPLUTO, two columns only (BBL and UnitsRes), joined to the footprints by lot.',
    'People: 2020 Census tract population (table DP1), on tract boundaries from NYC Open Data.'
  ],
  cannotSee:
    "Water moving. There is no time in this model, so there is no rain, no drainage, no waves, no storm that arrives and then leaves, no pump, and no sea wall built later. It is a line drawn where the ground meets a number, including when that number is a hundred-year storm, which arrives as a still water surface with no waves in it. That is also, more or less, the model most cities publish. It draws the range in the projections, but it cannot say which of the four is more likely, because the panel does not.",
  tutorial: '/tutorials/05-bathtub/',
  live: false
};
