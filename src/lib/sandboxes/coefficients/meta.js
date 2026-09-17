// PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide.
//
// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'coefficients',
  title: 'A City Simulator, Opened Up',
  subtitle:
    'The original SimCity engine, as open-sourced, with every internal layer drawn as it updates and the constants behind its rules turned into sliders.',
  status: 'built',
  statusNote:
    'Built from micropolisJS at commit f13a1624, vendored under src/lib/sandboxes/coefficients/vendor/ with its licenses intact. See NOTICE.md for what was taken and every change made to it, including a fix to a crime scan that had never run.',
  kind: 'simulation',
  blurb:
    'A city simulator from 1989 running in the browser with its internal layers showing. On one side the city plays as a game; beside it, each layer the simulation keeps about the city is drawn as it updates, and about twenty constants that the rules are built from are sliders. There is no dataset; the source code is the material.',
  controls: [
    'The clock: run, pause, step the sixteen phases, and the speed',
    'Layer over the city, or none to follow the rotation and watch each one being written',
    'Show the layer rail',
    'Crime base',
    'Weight on land value, in the crime rule',
    'Weight on police, in the crime rule',
    'Land value at the center',
    'Distance divisor, in the land value rule',
    'How far traffic looks',
    'Police smoothing passes',
    'Birth rate',
    'Outside demand: 1.2, 1.1 or 0.98',
    'Seed',
    'Runs to compare',
    'Steps per run'
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
    'Anyone. The model has densities, rates and a growth valve, but no people, no households and no migration. It cannot see a city whose most valuable place is not its center, because land value is written as a distance from one center. There is no data anywhere in it: every rule is a typed-in constant, and no city it produces can differ in kind from another. Access is a random walk with no routes or journey times, policing has no limit, and the ground is flat and empty. It could not see its own failures either: the crime scan never ran in the original port, and the game still looked like a working simulation.',
  license:
    'GPLv3 with additional terms, plus the Micropolis Public Name License. This site is AGPL-3.0 and its repository is public, which satisfies GPLv3 section 13 and the source-availability obligation. Student submissions are modified GPL code redistributed here under the same license. See NOTICE.md.',
  tutorial: null,
  live: false
};
