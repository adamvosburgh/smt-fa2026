// PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide.
//
// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'anthromes',
  title: 'Anthromes',
  subtitle:
    'Twelve thousand years of land use, classified live in the browser with every threshold in the classification as a slider.',
  status: 'built',
  kind: 'model',
  blurb:
    "A map of the world's land from 10,000 BC to 2017, colored by how people were using it. The Anthromes classification is about a dozen thresholds applied to six input grids from HYDE, a historical land-use database; here every threshold is a slider and the classification runs in the browser. None of the inputs are observations. The crossover, the first time step at which used land exceeds wild, is recomputed from all 75 time steps as the sliders move.",
  controls: [
    'Year: the 75 HYDE time steps from 10000BC to 2017AD, playing by default',
    'Color by: anthrome, used land, population, or vs published',
    'Used-land threshold, the one that decides the crossover year',
    'Cropland threshold',
    'Grazing threshold',
    'Rice threshold',
    'Irrigation threshold',
    'Urban area threshold',
    'Urban density',
    'Dense settlement density',
    'Residential density',
    'Populated density',
    'Forested biomes: how many of the fifteen potential-vegetation classes count as forested'
  ],
  metrics: [
    'the crossover: the first time step at which used land exceeds wild, recomputed in a worker as the sliders move',
    'used and wild land shares at the current year',
    'agreement with the published method run at native resolution',
    'land cells classified'
  ],
  data: [
    'HYDE 3.2 input grids (doi:10.7910/DVN/E3H3AK, raw-data.zip): cropland, grazing, irrigated rice, total irrigation, built-up area and population count at 5 arc-minutes, 75 time steps, plus the supporting grids for potential vegetation and land area.',
    'The Anthromes 2.1 method (Ellis, Beusen & Klein Goldewijk 2020, Land 9(5):129), taken from the reference implementation in the replication archive doi:10.7910/DVN/IB4VCI. The pipeline\'s port agrees with it cell for cell on the archive\'s own test data, and that check is recorded in the manifest.',
    'HYDE 3.5\'s published classified series, majority-aggregated to the same 33km grid, as the version-comparison layer. Its input grids could not be used: the 3.5 distribution is missing the 2000-2023 inputs, which is why the timeline ends at 2017 and why 3.2 is the base.'
  ],
  cannotSee:
    "Any observation. Every input is a model's output: HYDE spreads national and regional estimates across cells, and that allocation is the larger uncertainty and has no slider. The potential vegetation model underneath has no controls either. The further back the timeline runs, the more of the map is reconstruction, though it looks equally confident at every date. The inputs are HYDE 3.2, because 3.5's distribution is missing its 2000-2023 input grids, so the timeline ends at 2017. The thresholds are the published ones at the defaults, but the paper presents them without derivation, and aggregating to 33 km before classifying means the default map will not match the published one everywhere.",
  provenanceNote:
    'The inputs are HYDE 3.2, not 3.5, for two reasons the card spells out: 3.5\'s own distribution is missing the 2000-2023 input grids (verified 2026-09-04 from the archive\'s file headers), and its classification paper is in preparation, so 3.2 remains the documented method of record. The 3.5 classified series rides along as a comparison layer to 2025AD.',
  tutorial: null,
  live: false
};
