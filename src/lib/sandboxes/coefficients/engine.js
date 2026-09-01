// The sandbox's view of the engine.
//
// Everything the component and the divergence worker need, and nothing about
// the DOM - so the same file runs on the page and inside a Web Worker.
//
// The engine's own user interface is not used at all. This imports the headless
// simulation core only, which is also why jQuery never enters the bundle.
import { Simulation } from './vendor/src/simulation.js';
import { buildStartingCity, makeMap, PLAN } from './startingCity.js';
import { seed, applyParams, applyCoefficients, resetCoefficients, C } from './tunables.js';

/**
 * The block maps, with what each one is and who writes it.
 *
 * These are the sandbox's real subject: fourteen rasters the simulation keeps
 * about the city, updated on a fixed rotation, each one read by the next. The
 * ranges are the engine's own, from the comments in the Simulation constructor.
 *
 * `phase` is the phase of the sixteen-step cycle that writes the map. That is
 * the thing worth seeing: the maps are not updated together, they are updated
 * in an order, and the order decides what reads a fresh value and what reads
 * last cycle's.
 */
export const BLOCK_MAPS = [
  { key: 'landValueMap', label: 'land value', min: 0, max: 250, phase: 12,
    note: 'Distance from the city centre, plus unspoilt land, minus pollution, minus 20 where crime is over 190.' },
  { key: 'crimeRateMap', label: 'crime', min: 0, max: 250, phase: 13,
    note: 'Base 128, minus land value, plus population density, minus police. Reads the map above; the map above reads it back.' },
  { key: 'pollutionDensityMap', label: 'pollution', min: 0, max: 255, phase: 12,
    note: 'A per-tile constant by land use, smoothed twice. Housing and shops emit nothing at all.' },
  { key: 'populationDensityMap', label: 'population density', min: 0, max: 510, phase: 14,
    note: 'Zone populations, smoothed three times, then doubled.' },
  { key: 'trafficDensityMap', label: 'traffic', min: 0, max: 240, phase: 10,
    note: 'Left behind by random walks looking for somewhere to go. Not a count of journeys.' },
  { key: 'rateOfGrowthMap', label: 'rate of growth', min: -200, max: 200, phase: 10,
    note: 'Where zones grew or decayed recently. Decays back towards zero on its own.' },
  { key: 'terrainDensityMap', label: 'unspoilt land', min: 0, max: 240, phase: 12,
    note: 'How undeveloped a neighbourhood is. On the blank starting map this is nearly uniform.' },
  { key: 'cityCentreDistScoreMap', label: 'distance from centre', min: -64, max: 64, phase: 14,
    note: 'The city centre is recomputed as the mean of populated zones, AFTER the land value that depends on it has been written.' },
  { key: 'policeStationMap', label: 'police cover', min: 0, max: 1000, phase: 13,
    note: 'Station positions, blurred three times. How far a station reaches is a number of blur passes.' },
  { key: 'policeStationEffectMap', label: 'police cover (working copy)', min: 0, max: 1000, phase: 13,
    note: 'The other half of the blur. The two maps are smoothed into each other alternately.' },
  { key: 'fireStationMap', label: 'fire cover', min: 0, max: 1000, phase: 15, note: 'As police cover.' },
  { key: 'fireStationEffectMap', label: 'fire cover (working copy)', min: 0, max: 1000, phase: 15, note: 'As above.' },
  { key: 'tempMap1', label: 'scratch 1', min: 0, max: 255, phase: 12, scratch: true,
    note: 'Working space. Nothing reads it between phases.' },
  { key: 'tempMap2', label: 'scratch 2', min: 0, max: 255, phase: 12, scratch: true,
    note: 'Working space.' },
  { key: 'tempMap3', label: 'scratch 3', min: 0, max: 240, phase: 12, scratch: true,
    note: 'Working space.' }
];

/** What each of the sixteen phases does. Used by the diagram and the panel. */
export const PHASES = [
  { n: 0, name: 'tick over', writes: 'city time, the RCI valves, and it CLEARS the census' },
  { n: 1, name: 'scan 1/8', writes: 'zones, and the census as it goes' },
  { n: 2, name: 'scan 2/8', writes: 'zones' },
  { n: 3, name: 'scan 3/8', writes: 'zones' },
  { n: 4, name: 'scan 4/8', writes: 'zones' },
  { n: 5, name: 'scan 5/8', writes: 'zones' },
  { n: 6, name: 'scan 6/8', writes: 'zones' },
  { n: 7, name: 'scan 7/8', writes: 'zones' },
  { n: 8, name: 'scan 8/8', writes: 'zones' },
  { n: 9, name: 'census', writes: 'the population figures, and tax every 48 turns' },
  { n: 10, name: 'decay', writes: 'traffic and growth maps decay towards zero' },
  { n: 11, name: 'power', writes: 'which tiles have electricity' },
  { n: 12, name: 'pollution, terrain, land value', writes: 'pollution, unspoilt land, LAND VALUE' },
  { n: 13, name: 'crime', writes: 'police cover, then CRIME' },
  { n: 14, name: 'density', writes: 'population density, then moves the city centre' },
  { n: 15, name: 'fire', writes: 'fire cover, and rolls for disasters' }
];

/**
 * Build a city.
 *
 * The seed is applied BEFORE anything is generated, and the coefficients before
 * the first tick, so that a run is a pure function of (seed, coefficients).
 *
 * `assets.coefficients` is a submitted coefficients.json. THE FILE WINS over the
 * panel: it is applied after the params, so where both set a constant the
 * file's value is what runs. That rule lives here and nowhere else.
 */
export function createCity({ seed: s = 1, params = {}, assets = {} } = {}) {
  resetCoefficients();
  applyParams(params);
  if (assets.coefficients) applyCoefficients(assets.coefficients);

  seed(s);
  const map = makeMap();
  const sim = new Simulation(map, 0, 3);
  const tally = buildStartingCity(map, sim);
  return { map, sim, tally };
}

/**
 * Advance a city by n steps, with no wall clock involved.
 *
 * Stops at phase 10, never at phase 0. The census is cleared at phase 0 and
 * refilled by the map scan over phases 1 to 8, so a city read at phase 0 reports
 * a population of zero however large it is. That is not a bug in the engine and
 * it cost an hour to see.
 */
export function run(sim, ticks) {
  for (let i = 0; i < ticks; i++) sim.simTickImmediate();
  let guard = 0;
  while (sim._phaseCycle !== 10 && guard++ < 32) sim.simTickImmediate();
}

/** The numbers the panel reports. Read at a phase where the census is complete. */
export function readMetrics(sim) {
  const c = sim._census;
  const v = sim._valves;
  return {
    population: c.totalPop,
    residents: c.resPop,
    commercial: c.comPop,
    industrial: c.indPop,
    landValue: c.landValueAverage,
    crime: c.crimeAverage,
    pollution: c.pollutionAverage,
    rci: [v.resValve, v.comValve, v.indValve],
    cityTime: sim._cityTime
  };
}

/**
 * One headless run, for the divergence chart.
 *
 * Records one metric per sample so the chart can show mean and range against
 * tick number. Runs in a worker; nothing here touches the DOM.
 */
export function headlessRun({ seed: s, params, assets, ticks, samples = 40 }) {
  const { sim } = createCity({ seed: s, params, assets });
  const every = Math.max(1, Math.floor(ticks / samples));
  const series = [];
  let done = 0;
  while (done < ticks) {
    const step = Math.min(every, ticks - done);
    run(sim, step);
    done += step;
    const m = readMetrics(sim);
    series.push({ t: done, population: m.population, crime: m.crime, landValue: m.landValue });
  }
  return series;
}

export { PLAN, C };
