// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/server/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'coefficients',
  title: 'A City Simulator, Opened Up',
  subtitle:
    'The original SimCity engine, as open-sourced, running with every internal layer drawn as it updates and the constants behind its rules turned into sliders.',
  status: 'built',
  statusNote:
    'Built from micropolisJS at commit f13a1624, vendored under src/lib/sandboxes/coefficients/vendor/ with its licenses intact. See NOTICE.md for what was taken and every change made to it, including a fix to a crime scan that had never run.',
  kind: 'simulation',
  blurb:
    'The engine plays as the game it is, and beside it the fifteen grids it keeps about the city are drawn as they are written: land value, crime, pollution, traffic, police cover, distance from the center. The rules that drive them are about twenty named constants, and each is a slider. Change one and watch which layer moves.',
  controls: [
    'the simulation transport: run, pause, and step the sixteen phases one at a time',
    'which internal layer is drawn over the city, or follow the rotation and watch each one being written',
    'the crime constant, and the weights on land value and police',
    'the land value at the center, and how fast it falls with distance',
    'how far traffic will look for a destination',
    'how many times police coverage is blurred outward',
    'the birth rate and demand from outside the city',
    'the random seed, how many seeded runs to compare, and how many steps each runs'
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
    'The simulation core is about 2,400 lines across ten files; the whole tree is about 13,500. There is no dataset and no pipeline; the source code is the material.',
    'The tile atlas: one 512x512 image of 1,024 tiles at 16 pixels. Loaded by URL, so replacing it needs no code.',
    'The starting city is ours, not the engine\'s: a fixed grid of zones, roads, wires and power laid on a blank map, identical on every run so that repeated runs differ only by their seed.'
  ],
  cannotSee:
    "Anyone. There are no people in it, only densities, rates and a growth valve. It cannot represent a city whose center is not its most valuable place, because land value is written as a number falling with distance from the center and there is nowhere in the file format to put anything else. Nothing in it can be fitted to a real city, because every rule is a constant and there is no place to put data.",
  license:
    'GPLv3 with additional terms, plus the Micropolis Public Name License. This site is AGPL-3.0 and its repository is public, which satisfies GPLv3 section 13 and the source-availability obligation. Student submissions are modified GPL code redistributed here under the same license. See NOTICE.md.',
  tutorial: '/tutorials/03-coefficients/',
  live: false
};
