export default {
  slug: 'anthromes',
  number: 6,
  title: 'Anthromes',
  subtitle: 'Seven thresholds that decide when a place stopped being wild.',
  status: 'planned',
  kind: 'model',
  blurb:
    "Re-derive the Anthromes classification from HYDE's population and land-use grids, with the published thresholds as sliders. Drag the used-land threshold and the date at which Earth stopped being majority-wild moves by millennia.",
  controls: ['dense settlement density', 'village density', 'residential density', 'populated density', 'cropland fraction', 'grazing fraction', 'used-land threshold'],
  metrics: ['land area per class', 'first appearance date per class', 'share used vs. wild over time', 'the crossover year', 'area reclassified vs. the published version'],
  data: ['HYDE 3.5 GeoTIFFs (Utrecht Yoda, 2025)', 'HYDE 3.2 ESSD paper for method', 'Ellis et al. 2020 for the classification', 'nick-gauthier/anthromes-12k as reference implementation'],
  cannotSee:
    "Two layers of it. The sliders move the classification, but HYDE's allocation - the distribution of, say, 3000 BCE population across Anatolia - is a far larger source of uncertainty with no slider at all. And the seminatural/wild splits depend on potential vegetation, a static input from an entirely different model. There is a model underneath the model with no controls on it.",
  provenanceNote:
    'HYDE 3.5 exists as data but not as a paper - the documented allocation method of record is still HYDE 3.2 (Klein Goldewijk et al., 2017). Use 3.5 data, cite 3.2 for method, name the gap.',
  tutorial: null,
  live: false
};
