// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/server/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'anthromes',
  title: 'Anthromes',
  subtitle: 'Twelve thousand years of land use, classified live in the browser from the published input grids, with every threshold in the classification as a slider.',
  status: 'built',
  kind: 'model',
  blurb:
    "Re-derive the Anthromes classification from HYDE's population and land-use grids, with the published thresholds as sliders. Move the used-land threshold and the date at which used land first exceeded wild moves by millennia. Two reference layers ride along, the same method at native resolution and HYDE 3.5's newer series, and the tooltip shows all three for any cell.",
  controls: [
    'the year: 75 HYDE time steps from 10000BC to 2017AD, playing by default',
    'the six fraction thresholds: used land (the one that moves the crossover), cropland, grazing, rice, irrigation, urban area',
    'the four density cutoffs: urban, dense settlement, residential, populated',
    'how many of the fifteen potential-vegetation classes count as forested',
    'what colors the map: anthrome class, used fraction, population density, or disagreement with the published method at native resolution'
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
    "Most of the uncertainty. The sliders move the classification, but HYDE's allocation, meaning how a national population estimate gets distributed across cells, is a far larger source of uncertainty with no slider at all, and HYDE's own lower and upper population scenarios are not wired in. The woodland and dryland splits depend on a potential vegetation map that is a static input from a separate model. Nothing in the inputs is an observation. The map is drawn equirectangular, which exaggerates the high latitudes where most of what the classification calls wild lives; the area statistics use real cell areas, but the picture does not.",
  provenanceNote:
    'The inputs are HYDE 3.2, not 3.5, for two reasons the card spells out: 3.5\'s own distribution is missing the 2000-2023 input grids (verified 2026-09-04 from the archive\'s file headers), and its classification paper is in preparation, so 3.2 remains the documented method of record. The 3.5 classified series rides along as a comparison layer to 2025AD.',
  tutorial: '/tutorials/04-anthromes/',
  live: false
};
