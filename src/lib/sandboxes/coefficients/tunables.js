// The live constants, the pluggable function table, and the seeded generator.
//
// This is the seam between the vendored engine and the sandbox. The vendored
// files under vendor/ were edited in exactly one way: the places that held a
// literal now read a named value from here. Every edit is listed in NOTICE.md.
//
// Three things live here because all three are "the rules", and the sandbox is
// an argument about the rules being editable:
//
//   C    the constants, loaded from coefficients.json
//   FN   the pluggable functions, one entry per rule that can be replaced
//   rng  the seeded generator, so a run replays
//
// Values are read at CALL TIME, not captured at import. That is what lets a
// slider change the crime function of a city that is already running, without
// rebuilding the simulation. The exception is the seed: changing it restarts
// the run, because a seed applied halfway through means nothing.
import defaults from './coefficients.json';

// --- the constants -------------------------------------------------------

// Deep copy, so that resetting to the engine's own values is always possible
// and the imported JSON is never mutated by a student's uploaded file.
const clone = (o) => JSON.parse(JSON.stringify(o));

export const C = clone(defaults);

/** Reset every constant to the engine's own value. */
export function resetCoefficients() {
  Object.assign(C, clone(defaults));
}

/**
 * Merge an uploaded coefficients.json over the defaults.
 *
 * THE FILE WINS. A student can set a constant with a slider and also ship a
 * coefficients.json that sets it; the file's value is the starting point and
 * the panel shows it. This is the one place that rule is enforced.
 *
 * Unknown keys are ignored rather than rejected: the engine has more constants
 * than the schema exposes, and a file naming one we have not lifted out yet
 * should not fail the whole submission.
 */
export function applyCoefficients(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const [group, values] of Object.entries(obj)) {
    if (group.startsWith('_') || !C[group] || typeof values !== 'object') continue;
    for (const [key, value] of Object.entries(values)) {
      if (key.startsWith('_') || !(key in C[group])) continue;
      C[group][key] = value;
    }
  }
}

/** Write the flat params from the control panel into the nested constants. */
export function applyParams(p = {}) {
  const set = (group, key, value) => {
    if (value !== undefined) C[group][key] = value;
  };
  set('crime', 'base', p.crime_base);
  set('crime', 'land_value_weight', p.crime_land_value_weight);
  set('crime', 'police_weight', p.crime_police_weight);
  set('land_value', 'centre_base', p.land_value_centre_base);
  set('land_value', 'distance_divisor', p.land_value_distance_divisor);
  set('traffic', 'max_distance', p.max_traffic_distance);
  set('smoothing', 'police_passes', p.smooth_passes);
  set('demography', 'birth_rate', p.birth_rate);
}

// --- the pluggable functions ---------------------------------------------

// One entry per rule a submitted rules.js could replace. The table exists NOW,
// while rules.js is deliberately unwired, because building it later would be a
// rewrite and building it now makes wiring it a switch.
//
// NOTHING LOADS SUBMITTED CODE. Running a student's JavaScript on a public site
// is arbitrary code execution in every visitor's browser, and how to contain it
// (sandboxed iframe, worker, or a restricted expression language) is an open
// decision. Until it is made, these are only ever the defaults below.

const defaultFns = {
  /** Crime at a block. blockMapUtils.js crimeScan(). */
  crimeValue({ landValue, populationDensity, police }) {
    const k = C.crime;
    let v = k.base - k.land_value_weight * landValue;
    v += k.population_density_weight * populationDensity;
    v = Math.min(v, k.pre_police_clamp_max);
    v -= k.police_weight * police;
    return v;
  },

  /** Land value before terrain, pollution and crime. pollutionTerrainLandValueScan(). */
  landValue({ cityCentreDistance }) {
    const k = C.land_value;
    return (k.centre_base - Math.floor(cityCentreDistance / k.distance_divisor)) << k.shift;
  },

  /** How far a random walk may wander before it gives up. traffic.js. */
  trafficReach() {
    return C.traffic.max_distance;
  },

  /** How many blur passes police influence gets. crimeScan(). */
  smoothPasses() {
    return C.smoothing.police_passes;
  }
};

export const FN = { ...defaultFns };

/** Restore every rule to the engine's own implementation. */
export function resetFunctions() {
  Object.assign(FN, defaultFns);
}

// --- the seeded generator ------------------------------------------------

// The vendored engine calls Math.random exactly nowhere: all 112 call sites go
// through vendor/src/random.ts, whose getRandom() already takes an injectable
// object with random() and floor(). So seeding the whole simulation is one
// default parameter, not a hunt through 24 files.
//
// This is not optional. Three things need it: the divergence chart is only
// meaningful if runs differ by seed and nothing else, the cover screenshot has
// to be reproducible, and a submitted city has to replay to the state the
// student is arguing about.

/** mulberry32. Small, fast, and good enough for a city that is not a casino. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let current = mulberry32(1);

// Shaped like the `Math` the engine expects, so vendor/src/random.ts can take
// it as its default without knowing anything about seeding.
export const rng = {
  random: () => current(),
  floor: (n) => Math.floor(n)
};

/** Restart the generator. Call before building a city, never during one. */
export function seed(n) {
  current = mulberry32(Number(n) || 0);
}
