export default {
  slug: 'coefficients',
  number: 4,
  title: 'The Coefficients',
  subtitle: 'micropolisJS with its guts exposed.',
  status: 'planned',
  kind: 'simulation',
  blurb:
    'The city as usual, plus a live panel rendering every internal layer as it updates each tick. The game stops looking like a game and starts looking like a stack of rasters being blurred into each other. Beside it: the RCI valves, the census, and a divergence chart across repeated runs.',
  controls: ['coefficients.json (named constants)', 'pluggable functions (rules.js)', 'tile atlas'],
  metrics: ['14 blockMaps rendered live', 'RCI valves', 'census', 'divergence across repeated runs'],
  data: ['micropolisJS source (~2,400 lines, seven files)'],
  cannotSee:
    'Crime is 128 - landValue + populationDensity - police, and land value falls when crime is high. The model asserts that poverty plus density minus policing is crime, and then makes it self-reinforcing by construction.',
  license:
    'GPLv3 plus the Micropolis Public Name License. Publishing student variants distributes modified GPL code - source availability and notices required; the name license restricts what forks may be called.',
  tutorial: null,
  live: false
};
