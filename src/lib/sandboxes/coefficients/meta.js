// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'coefficients',
  title: 'A City Simulator, Opened Up',
  subtitle:
    'The original SimCity engine, with the maps it keeps about the city drawn as they update and the numbers behind its rules turned into sliders.',
  status: 'built',
  statusNote:
    'Built from micropolisJS at commit f13a1624, vendored under src/lib/sandboxes/coefficients/vendor/ with its licenses intact. See NOTICE.md for what was taken and every change made to it, including a fix to a crime scan that had never run.',
  kind: 'simulation',
  blurb:
    'SimCity\'s engine running in the browser with its workings shown. The city plays as a game; beside it, the fifteen maps the simulation keeps about the city (land value, crime, pollution, density, traffic and others) are drawn as they update, and about twenty numbers the rules are built from are sliders. There is no dataset; the source code is the material.',
  controls: [
    'The clock: run, pause, step through the sixteen steps of a cycle, and the speed',
    'Layer over the city: none, one of the maps, or follow the cycle while stepping',
    'Show all fifteen maps above the city',
    'Starting city: blocks or grid',
    'Crime base',
    'Weight on land value, in the crime rule',
    'Weight on police, in the crime rule',
    'Land value at the center',
    'Distance divisor, in the land value rule',
    'How far traffic looks',
    'Police smoothing passes',
    'Birth rate',
    'Outside demand: 1.2, 1.1 or 0.98',
    'Seed, 1 to 99'
  ],
  metrics: [
    'population',
    'demand for housing, shops and industry',
    'average land value',
    'average crime',
    'steps run'
  ],
  data: [
    'micropolisJS (Graeme McCutcheon), a JavaScript port of Micropolis, the open-source release of the original SimCity engine. Commit f13a1624, GPLv3 with additional terms plus the Micropolis Public Name License.',
    'The simulation core is about 2,400 lines across ten files; the whole tree is about 13,500. There is no dataset and no pipeline; the source code is the material.',
    'The tile atlas: one 512x512 image of 1,024 tiles at 16 pixels. Loaded by URL, so replacing it needs no code.',
    'The starting city is laid out in code rather than built by hand: one of two fixed plans on a blank map, blocks of eight lots that thin out from a downtown, or a uniform grid, the same on every run so that two runs differ only by their seed.',
    'Kevin T. Baker, "Model Metropolis," Logic 6, January 2019: the history from Jay Forrester\'s Urban Dynamics to SimCity that the description opens with, and its argument about what the game teaches.'
  ],
  cannotSee:
    'Anyone. There are densities, rates and a growth valve, but no people, households or migration. Land value is measured from one center, so it cannot see a city whose most valuable place is not its center. No data goes into it: every rule is a constant, and no city it produces can differ in kind from another. Access is a random walk with no routes or journey times, policing has no limit, and the ground is flat. It could not see its own failures either: the crime calculation never ran in the original port, and the game still looked like it worked.',
  license:
    'GPLv3 with additional terms, plus the Micropolis Public Name License. This site is AGPL-3.0 and its repository is public, which satisfies GPLv3 section 13 and the source-availability obligation. Student submissions are modified GPL code redistributed here under the same license. See NOTICE.md.',
  tutorial: null,
  // Hides the frame's "under construction" note for this sandbox.
  underConstruction: false,
  live: false
};
