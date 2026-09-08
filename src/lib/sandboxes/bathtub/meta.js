// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/server/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'bathtub',
  title: 'Sea Level Flood Map',
  subtitle:
    'A flood map of New York that shows the range in the city\'s sea level projections instead of picking one. Choose a storm, and the map draws where it reaches today and where it would reach under each of the four published projections for a future year.',
  status: 'reference',
  statusNote:
    'Built first, as the reference implementation of the sandbox contract. Everything in it is published data: the USGS terrain for New York, the NPCC4 projections, the tidal datums and storm levels from the gauge at the Battery, the city building footprints. Read this one before building any of the others.',
  kind: 'model',
  blurb:
    "Flood maps usually arrive finished, with the date, the projection and the method already chosen. The city publishes four projections for each date and no middle one, so this map draws all four. Pick a storm and a year: the fill is the storm at today's sea level, and the four lines are where the same storm reaches under each projection. A second view draws every storm and every projection at once. The switch that matters most is hydraulic connectivity: off, the map floods inland dips the sea can't physically reach, which is a choice made silently in many published flood maps.",
  controls: [
    'whether to draw one storm with its four projections, or every storm and every projection at once',
    'which storm, chosen by how often it happens',
    'how far into the future the four projection lines are drawn for',
    'which point in the tide cycle',
    'whether water has to be able to reach a place to flood it',
    'a sea level rise or a surge height set by hand, in place of the published figures',
    'whether the flood is shaded by depth, and whether the flood line is drawn'
  ],
  metrics: [
    'one row per waterline: today and the four projections in the one-storm view, the four storms in the all-storms view',
    'the water height of that row, in meters above NAVD88',
    'land that is dry today and under water at that height',
    'buildings standing on that land',
    'homes in those buildings',
    'people in the census tracts it covers',
    'land that only floods when connectivity is switched off'
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
    "Water moving. There is no time in this model, so there is no rain, no drainage, no waves, no storm that arrives and then leaves, no pump, no sea wall someone builds in 2043. It is a line drawn where the ground meets a number, including when that number is a hundred-year storm, which arrives here as a still water surface with no waves in it. That is also, more or less, the model most cities publish. It draws the range in the projections, but it cannot say which of the four is more likely, because the panel does not.",
  tutorial: '/tutorials/05-bathtub/',
  live: false
};
