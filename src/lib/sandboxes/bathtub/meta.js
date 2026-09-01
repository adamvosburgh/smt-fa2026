export default {
  slug: 'bathtub',
  number: 7,
  title: 'Bathtub',
  subtitle:
    'A flood map with the lid off. Raise the water and watch the map decide what counts as underwater.',
  status: 'reference',
  statusNote:
    'Built first, as the reference implementation of the sandbox contract. Everything in it is real data: the USGS terrain for New York, the NPCC4 projections, the tidal datums from the gauge at the Battery, the city building footprints. Read this one before building any of the others.',
  kind: 'model',
  blurb:
    "You have seen a lot of flood maps. This is one, taken apart. Pick a year and a projection, the sandbox works out a single water height for the whole city, and every piece of ground below that height gets coloured in. The switch that matters most is hydraulic connectivity. Turn it off and the map floods inland dips that the sea can't physically reach - which is a modelling choice, made for you, in every flood map you've ever looked at.",
  controls: [
    'how much the sea rises (metres)',
    'which storm, chosen by how often it happens - or a height set by hand',
    'which point in the tide cycle',
    'which projection out of the four published',
    'how far into the future',
    'whether water has to be able to reach a place to flood it'
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
    'Storms: NOAA exceedance probability levels at the same station, read 1 September 2026. Four levels - 99%, 50%, 10%, 1% - and no others are published. Still-water levels fitted to annual maxima, so no waves, and lower than a FEMA base flood elevation.',
    'Buildings: NYC Building Footprints. We keep a point, the recorded ground height and the roof height, both converted from feet.',
    'Homes: MapPLUTO, two columns only (BBL and UnitsRes), joined to the footprints by lot.',
    'People: 2020 Census tract population (table DP1), on tract boundaries from NYC Open Data.'
  ],
  cannotSee:
    "Water moving. There's no time in this model, so there's no rain, no drainage, no waves, no storm that arrives and then leaves, no pump, no sea wall someone builds in 2043. It is a line drawn where the ground meets a number - including when that number is a hundred-year storm, which arrives here as a still water surface with no waves in it. That is also, more or less, the model most cities publish.",
  tutorial: '/tutorials/07-bathtub/',
  live: false
};
