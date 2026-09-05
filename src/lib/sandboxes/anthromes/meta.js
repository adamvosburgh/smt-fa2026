// PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide.
//
// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/server/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'anthromes',
  title: 'Anthromes',
  subtitle: 'Ten thousand years of the used world, reclassified live under a dozen thresholds that were somebody\'s judgement.',
  status: 'built',
  kind: 'model',
  blurb:
    "Re-derive the Anthromes classification from HYDE's population and land-use grids, with the published thresholds as sliders. Drag the used-land threshold and the date at which Earth stopped being majority-wild moves by millennia. Two reference layers ride along - the same method at native resolution, and HYDE 3.5's newer series - and the honest disagreement between all three is the exhibit.",
  controls: [
    'the year - 75 HYDE time steps from 10000BC to 2017AD, playing by default',
    'the six fraction thresholds: used land (the headline - it moves the crossover by millennia), cropland, grazing, rice, irrigation, urban area',
    'the four density cutoffs: urban, dense settlement, residential, populated',
    'how many of the fifteen potential-vegetation classes count as forested',
    'what colours the map: anthrome class, used fraction, population density, or disagreement with the published method'
  ],
  metrics: [
    'the crossover - the first time step at which used land exceeds wild, recomputed in a worker as the sliders move',
    'used and wild land shares at the current year',
    'agreement with the published method run at native resolution',
    'land cells classified'
  ],
  data: [
    'HYDE 3.2 input grids (doi:10.7910/DVN/E3H3AK, raw-data.zip): cropland, grazing, irrigated rice, total irrigation, built-up area and population count at 5 arc-minutes, 75 time steps, plus the five supporting grids - potential vegetation, potential villages, land area.',
    'The Anthromes 2.1 method (Ellis, Beusen & Klein Goldewijk 2020, Land 9(5):129), taken from the reference implementation in the replication archive doi:10.7910/DVN/IB4VCI - the code the published maps were computed with. The pipeline\'s port agrees with it cell for cell on the archive\'s own test data, and that check is recorded in the manifest.',
    'HYDE 3.5\'s published classified series, majority-aggregated to the same 33km grid, as the version-comparison layer. Its inputs could not be used: the 3.5 distribution is missing the 2000-2023 input grids, which is why the timeline ends at 2017 and why 3.2 is the base.'
  ],
  cannotSee:
    "Two layers of it. The sliders move the classification, but HYDE's allocation - the distribution of, say, 3000 BCE population across Anatolia - is a far larger source of uncertainty with no slider at all, and HYDE's own lower and upper population scenarios exist but are not wired in here. And the seminatural/wild splits depend on potential vegetation, a static input from an entirely different model. There is a model underneath the model with no controls on it. The map is drawn equirectangular, which badly exaggerates the boreal and polar latitudes where most of what the cascade calls wild lives - the numbers are computed with real cell areas, but the picture is not.",
  provenanceNote:
    'The inputs are HYDE 3.2, not 3.5, for two reasons the card spells out: 3.5\'s own distribution is missing the 2000-2023 input grids (verified 2026-09-04 from the archive\'s file headers), and its classification paper is in preparation, so 3.2 remains the documented method of record. The 3.5 classified series rides along as a comparison layer to 2025AD.',
  tutorial: '/tutorials/04-anthromes/',
  live: false
};
