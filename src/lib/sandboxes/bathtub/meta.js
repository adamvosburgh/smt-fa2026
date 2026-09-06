// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/server/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'bathtub',
  title: 'Sea Level Flood Map',
  subtitle:
    'A flood map of New York built one setting at a time: pick a date and a projection, get a water height, and every piece of ground below it is coloured in.',
  status: 'reference',
  statusNote:
    'Built first, as the reference implementation of the sandbox contract. Everything in it is published data: the USGS terrain for New York, the NPCC4 projections, the tidal datums and storm levels from the gauge at the Battery, the city building footprints. Read this one before building any of the others.',
  kind: 'model',
  blurb:
    "Flood maps usually arrive finished, with the date, the projection and the method already chosen. This one leaves those as controls. Pick a year and a projection, the sandbox works out one water height for the whole city, and every cell of ground below that height floods. The switch that matters most is hydraulic connectivity: off, the map floods inland dips the sea can't physically reach, which is a choice made silently in many published flood maps.",
  controls: [
    'how far into the future, and which of the four published projections',
    'how much the sea rises, in metres, if you would rather set it by hand',
    'which storm, chosen by how often it happens, or a surge height set by hand',
    'which point in the tide cycle',
    'whether water has to be able to reach a place to flood it',
    'whether the flood is shaded by depth, and whether the flood line is drawn'
  ],
  metrics: [
    'the water height the model is using',
    'land that is dry today and under water in this scenario',
    'buildings standing on that land',
    'homes in those buildings',
    'people living in the census tracts it covers',
    'land that only floods when connectivity is switched off'
  ],
  data: [
    'Ground height: USGS 3DEP 1/3 arc-second elevation model (about 10m per cell), clipped to New York. Heights are metres above NAVD88.',
    'Sea level rise: NPCC4 projections (Braneon et al. 2024, NYC Open Data 38ps-fnsg). Four percentiles, five horizons, no median.',
    'Tides: NOAA station 8518750 at the Battery, 1983-2001 epoch, relative to NAVD88.',
    'Storms: NOAA exceedance probability levels at the same station, from the Sea Level Trends and Extremes site, read for October 2025. Four levels (99%, 50%, 10%, 1%) and no others are published. Still-water levels fitted to annual maxima, so no waves, and lower than a FEMA base flood elevation.',
    'Buildings: NYC Building Footprints. We keep a point, the recorded ground height and the roof height, both converted from feet.',
    'Homes: MapPLUTO, two columns only (BBL and UnitsRes), joined to the footprints by lot.',
    'People: 2020 Census tract population (table DP1), on tract boundaries from NYC Open Data.'
  ],
  cannotSee:
    "Water moving. There's no time in this model, so there's no rain, no drainage, no waves, no storm that arrives and then leaves, no pump, no sea wall someone builds in 2043. It is a line drawn where the ground meets a number, including when that number is a hundred-year storm, which arrives here as a still water surface with no waves in it. That is also, more or less, the model most cities publish.",
  tutorial: '/tutorials/05-bathtub/',
  live: false
};
