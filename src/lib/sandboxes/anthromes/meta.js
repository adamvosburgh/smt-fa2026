// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'anthromes',
  title: 'Anthromes',
  subtitle:
    "Land use from 10,000 BC to 2017, classified in the browser, with the classification's thresholds as sliders.",
  status: 'built',
  kind: 'model',
  blurb:
    "A map of the world's land from 10,000 BC to 2017, colored by how people used it. The Anthromes classification applies a set of thresholds to six input grids from HYDE, a historical land-use database. Here each threshold is a slider and the classification runs in the browser. None of the inputs are observations. The crossover, the first time step at which used land covers more area than wild land, is recomputed across all 75 time steps when a slider moves.",
  controls: [
    'Year: the 75 HYDE time steps from 10000BC to 2017AD, playing by default',
    'Color by: anthrome, used land, inhabited land, population, or vs published',
    'Used-land threshold: the used share that makes a remote or uninhabited cell count as used',
    'Cropland threshold',
    'Grazing threshold',
    'Rice threshold',
    'Irrigation threshold',
    'Urban area threshold',
    'Urban density',
    'Dense settlement density',
    'Residential density',
    'Populated density',
    'Wild cutoff: the population density below which a cell is uninhabited, in four steps from one person per 10,000 km² to one per 10 km²',
    'Forested biomes: how many of the fifteen potential vegetation classes count as forested'
  ],
  metrics: [
    'the first year used land covers more area than wild land, recomputed when a slider moves',
    'used, wild and inhabited land shares at the current year',
    'agreement with the same method run at native resolution',
    'land cells classified'
  ],
  data: [
    'HYDE 3.2 input grids (doi:10.7910/DVN/E3H3AK, raw-data.zip): cropland, grazing, irrigated rice, total irrigation, built-up area and population count at 5 arc-minutes, 75 time steps, plus the supporting grids for potential vegetation and land area.',
    "The Anthromes 2.1 method (Ellis, Beusen & Klein Goldewijk 2020, Land 9(5):129), taken from the reference implementation in the replication archive doi:10.7910/DVN/IB4VCI. The pipeline's port matched it on every cell of the archive's test data, and that check is recorded in the manifest.",
    "HYDE 3.5's published classified series, majority-aggregated to the same 33 km grid, for comparison. Its 2000-2023 input grids were missing from the downloaded archive, so the sandbox classifies HYDE 3.2 and the timeline ends at 2017."
  ],
  cannotSee:
    "Observations. Every input is the output of a model. HYDE distributes national and regional estimates across cells, and that distribution has no slider. The potential vegetation model has no controls. HYDE's estimates are less certain further back in time. The inputs are HYDE 3.2, whose grids end at 2017. The paper does not explain how the thresholds were chosen, and classifying after aggregating to 33 km means the default map does not match the published one everywhere. The inhabited land view shows where HYDE places people above the wild cutoff, not how those people changed the land.",
  provenanceNote:
    "The inputs are HYDE 3.2 rather than 3.5, because the downloaded 3.5 archive is missing the 2000-2023 input grids. The 3.5 classified series is included for comparison, to 2025.",
  tutorial: null,
  live: false
};
