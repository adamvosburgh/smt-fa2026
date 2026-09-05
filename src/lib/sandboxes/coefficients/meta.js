// PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide.
//
// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/server/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'coefficients',
  title: 'The Coefficients',
  subtitle:
    'A city simulation from 1989, opened up. Every internal layer drawn as it updates, and the constants that drive them turned into sliders.',
  status: 'built',
  statusNote:
    'Built from micropolisJS at commit f13a1624, vendored under src/lib/sandboxes/coefficients/vendor/ with its licences intact. See NOTICE.md for what was taken and every change made to it.',
  kind: 'simulation',
  blurb:
    "The engine plays as the game it is, and beside it the fifteen rasters it keeps about the city are drawn as they update - land value, crime, pollution, traffic, police cover, distance from the centre. Watching them being written is the point: the city stops looking like a world and starts looking like a stack of grids being blurred into each other on a fixed rotation. The rules driving all of it are about twenty named constants, and two of them carry a contested claim about cities each.",
  controls: [
    'the simulation transport - run, pause, and single-step the sixteen phases one at a time',
    'which internal layer washes over the city, tile for tile - or follow the rotation and watch each one being written',
    'the crime constant, and the weights on land value and police',
    'how fast land value falls with distance from the centre',
    'how far traffic will look for a destination',
    'how many times police coverage is blurred outward',
    'the birth rate and demand from outside the city',
    'the random seed, and how many seeded runs to compare'
  ],
  metrics: [
    'population',
    'the residential, commercial and industrial demand valves',
    'mean land value',
    'mean crime',
    'the spread across repeated runs at the final step',
    'steps run'
  ],
  data: [
    'micropolisJS (Graeme McCutcheon), a JavaScript port of Micropolis, the open-source release of the original SimCity engine. Commit f13a1624, GPLv3 with additional terms plus the Micropolis Public Name License.',
    'The simulation core is about 2,400 lines across ten files; the whole tree is about 13,500. The data in this sandbox is the source code - there is no dataset and no pipeline.',
    'The tile atlas: one 512x512 image of 1,024 tiles at 16 pixels. Loaded by URL, so replacing it needs no code.',
    'The starting city is ours, not the engine\'s: a fixed grid of zones, roads, wires and power laid on a blank map, identical on every run so that repeated runs differ only by their seed.'
  ],
  cannotSee:
    "Anyone. There are no people in it - only densities, rates, and a growth valve. It cannot represent a city whose centre is not its most valuable place, because land value is written as a number falling with distance from the centre and there is nowhere in the file format to put anything else. Nothing in it can be fitted to a real city, because every rule is a constant and there is no place to put data.",
  license:
    'GPLv3 with additional terms, plus the Micropolis Public Name License. This site is AGPL-3.0 and its repository is public, which satisfies GPLv3 section 13 and the source-availability obligation. Student submissions are modified GPL code redistributed here under the same licence. See NOTICE.md.',
  tutorial: '/tutorials/03-coefficients/',
  live: false
};
