// PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide.
//
// subtitle, controls and cannotSee are read verbatim into the course assistant's
// prompt by src/lib/assistant-prompt.js, so they must agree with card.md.
//
// `title` is a working title. Nothing depends on it.
export default {
  published: false,
  slug: 'sunlight',
  title: 'Direct Sunlight in a Space',
  subtitle:
    'A floor of one Lower Manhattan office building, with the blocks around it, showing where the sun reaches inside it hour by hour and how many hours a day each part of it gets.',
  status: 'built',
  statusNote:
    'Built last, and the only sandbox whose input is a file you hand it. The example is one floor of 25 Water Street as the city\'s 2014 aerial survey recorded it, before the building was converted to apartments. Any model prepared to the same naming convention runs in the same page.',
  kind: 'simulation',
  blurb:
    'Direct sun only. The sandbox works out where the sun is from the date, the time and the coordinates, renders one shadow image per sun position, and counts how many of those positions reach each point on the floors, walls and ceiling. Scrub the hour and the shadows move; the colored squares are the count over a day, a month or a year. Beside it, the same rooms are tested against New York\'s light-and-air rule, which is a ratio of window area to floor area and knows nothing about whether any sun arrives.',
  controls: [
    'the time of day, and the day of the year, each of which plays',
    'which time zone the hour is read in',
    'whether the squares show hours a day, a share of daylight, or above and below a threshold',
    'whether the count covers a year, a month or a single day',
    'whether everything above the floor plate is cut away',
    'whether the surrounding buildings are there at all',
    'how far apart the sample points sit',
    'how many hours a day count as enough',
    'the latitude, longitude and north offset of the model',
    'which of the two New York light-and-air rules the room table applies'
  ],
  metrics: [
    'where the sun is right now, as an altitude and a bearing',
    'the floor area being analyzed',
    'the average direct sun on the floors, in hours per day',
    'how much of the floor reaches the threshold',
    'how far from a window the light still reaches',
    'how many rooms pass the light-and-air rule',
    'how many rooms pass the rule and are still under the threshold',
    'what the sandbox found in the model file it was given'
  ],
  data: [
    'DCP 3-D Building Model, CityGML 2.0 (NYC Open Data tnru-abg2), from the 2014 aerial survey. Delivery area DA12. Gives the subject building and the 552 neighbors within 3,000 ft, each extruded as one prism per surveyed roof polygon.',
    'The example floor plate is ours, not surveyed: 22 stories divided evenly into the surveyed 86.0 m roof, a rectangle through the surveyed outline, a continuous glazing band, 34 bays 30 ft deep, and a 30 m by 12 m core. Every one of these is listed as an assumption in data/processed/sunlight/manifest.json.',
    'NYC Building Footprints and MapPLUTO 26v2, used only to confirm which building this is (BIN 1000007, BBL 1000050010).',
    'Sun positions from suncalc 1.9.0, which implements the standard low-precision solar position formulae.',
    'New York Multiple Dwelling Law §30 and §277, read from law.justia.com on 2026-09-06.'
  ],
  cannotSee:
    'Everything except the direct beam. There is no sky, so an overcast day and a clear one are the same to it; no reflected light off the buildings opposite or off the floor; no glass, so a window is a hole; no curtains, no trees, no interior partitions beyond the ones in the file. A north-facing room reads as dark here and may be perfectly well lit in the world. It also does not know that this building was converted to apartments from 2023 with two courtyards cut into the plate, which is exactly where the light would now come from.',
  tutorial: '/tutorials/06-sunlight/',
  live: false
};
