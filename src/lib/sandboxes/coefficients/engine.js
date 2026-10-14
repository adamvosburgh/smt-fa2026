// The sandbox's view of the engine.
//
// Everything the component needs, and nothing about the DOM, so the same file
// also runs headless (the cover pipeline, and any test that builds a city).
//
// The engine's own user interface is not used at all. This imports the headless
// simulation core only, which is also why jQuery never enters the bundle.
import { Simulation } from './vendor/src/simulation.js';
import { Residential } from './vendor/src/residential.js';
import { Commercial } from './vendor/src/commercial.js';
import { Industrial } from './vendor/src/industrial.js';
import { TileUtils } from './vendor/src/tileUtils.js';
import * as TileValues from './vendor/src/tileValues.ts';
import { buildStartingCity, makeMap, PLAN, PLANS } from './startingCity.js';
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
    note: 'A base value, minus distance from the city center, plus undeveloped land nearby, minus pollution, minus 20 where crime is over 190.' },
  { key: 'crimeRateMap', label: 'crime', min: 0, max: 250, phase: 13,
    note: '128, minus land value, plus population density, minus police coverage. Crime also lowers land value, so each map feeds the other.' },
  { key: 'pollutionDensityMap', label: 'pollution', min: 0, max: 255, phase: 12,
    note: 'A fixed amount for each kind of tile, blurred twice. Housing and shops produce none.' },
  { key: 'populationDensityMap', label: 'population density', min: 0, max: 510, phase: 14,
    note: 'Zone populations, blurred three times, then doubled.' },
  { key: 'trafficDensityMap', label: 'traffic', min: 0, max: 240, phase: 10,
    note: 'Left behind by the random walks zones make along the roads. Not a count of trips.' },
  { key: 'rateOfGrowthMap', label: 'rate of growth', min: -200, max: 200, phase: 10,
    note: 'Where zones grew or declined recently. Fades back to zero on its own.' },
  { key: 'terrainDensityMap', label: 'undeveloped land', min: 0, max: 240, phase: 12,
    note: 'How much undeveloped land, such as trees, is nearby.' },
  { key: 'cityCentreDistScoreMap', label: 'distance from the center', min: -64, max: 64, phase: 14,
    note: 'Distance from the city center. The center is moved to the average position of the population in step 15, after land value has already used it in step 13.' },
  { key: 'policeStationMap', label: 'police coverage', min: 0, max: 1000, phase: 13,
    note: 'Police stations, blurred three times. How far a station reaches depends on the number of blurs.' },
  { key: 'policeStationEffectMap', label: 'police coverage (working copy)', min: 0, max: 1000, phase: 13,
    note: 'A second copy used while blurring; the engine blurs back and forth between the two.' },
  { key: 'fireStationMap', label: 'fire coverage', min: 0, max: 1000, phase: 15,
    note: 'Fire stations, blurred three times.' },
  { key: 'fireStationEffectMap', label: 'fire coverage (working copy)', min: 0, max: 1000, phase: 15,
    note: 'A second copy used while blurring.' },
  { key: 'tempMap1', label: 'scratch 1', min: 0, max: 255, phase: 12, scratch: true,
    note: 'Working space used during a step. Nothing else reads it.' },
  { key: 'tempMap2', label: 'scratch 2', min: 0, max: 255, phase: 12, scratch: true,
    note: 'Working space used during a step. Nothing else reads it.' },
  { key: 'tempMap3', label: 'scratch 3', min: 0, max: 240, phase: 12, scratch: true,
    note: 'Working space used during a step. Nothing else reads it.' }
];

/**
 * What each of the sixteen steps does, in plain words, for the step readout.
 *
 * "Every Nth cycle" is real: the engine was built to run its expensive scans
 * less often at higher speeds, and this sandbox runs it at its fastest
 * setting (speed 3 in simulation.js). So land value, crime and density are
 * recomputed only every seventeenth to nineteenth cycle, and in between the
 * zones grow against maps that are up to nineteen cycles old. `every` is that
 * divisor, from the speed tables in simulation.js; the step runs when the
 * engine's cycle count divides by it.
 */
const SCAN =
  'The map is scanned in eight strips, one a step, left to right; this one is STRIP. ' +
  'Each zone in the strip is counted into the census, and may grow or decline. The chance depends on ' +
  'demand for its kind of zone, the land value and pollution where it sits, whether it has power, and ' +
  'whether a random walk along the roads reaches the kind of zone it needs: housing needs shops, shops ' +
  'need industry, industry needs housing. This is the only step where the city itself changes.';

export const PHASES = [
  { n: 0, name: 'start of a cycle',
    about: 'The clock moves forward one turn. Every second turn, demand for housing, shops and industry is ' +
      'recalculated from the last census, the birth rate and outside demand. Then the census is cleared, so ' +
      'the scan in the next eight steps can count the city from zero.' },
  { n: 1, name: 'zone scan, strip 1 of 8',
    about: SCAN.replace('STRIP', 'columns 0 to 14') },
  { n: 2, name: 'zone scan, strip 2 of 8',
    about: SCAN.replace('STRIP', 'columns 15 to 29') },
  { n: 3, name: 'zone scan, strip 3 of 8',
    about: SCAN.replace('STRIP', 'columns 30 to 44') },
  { n: 4, name: 'zone scan, strip 4 of 8',
    about: SCAN.replace('STRIP', 'columns 45 to 59') },
  { n: 5, name: 'zone scan, strip 5 of 8',
    about: SCAN.replace('STRIP', 'columns 60 to 74') },
  { n: 6, name: 'zone scan, strip 6 of 8',
    about: SCAN.replace('STRIP', 'columns 75 to 89') },
  { n: 7, name: 'zone scan, strip 7 of 8',
    about: SCAN.replace('STRIP', 'columns 90 to 104') },
  { n: 8, name: 'zone scan, strip 8 of 8',
    about: SCAN.replace('STRIP', 'columns 105 to 119') },
  { n: 9, name: 'census',
    about: 'The counts made during the scan become the city\'s population figures. Every 48 turns, taxes are collected.' },
  { n: 10, name: 'fading',
    about: 'Traffic fades everywhere, and every fifth cycle the record of recent growth fades too, so both ' +
      'maps show what happened lately rather than everything that ever happened.' },
  { n: 11, every: 5, name: 'power',
    about: 'Power is traced out from each plant through wires and touching zones until it reaches everything ' +
      'connected, or until the plants\' capacity runs out. A zone it does not reach cannot grow. Every 5th cycle.' },
  { n: 12, every: 17, name: 'pollution and land value',
    about: 'Pollution is added up from what is on each tile, then blurred. Land value is computed for every ' +
      'block: a base value, minus distance from the city center, plus undeveloped land nearby, minus pollution, ' +
      'minus a penalty where crime is high. Every 17th cycle.' },
  { n: 13, every: 18, name: 'police and crime',
    about: 'Police coverage is made by blurring the map of police stations. Crime is computed for every block: ' +
      'base, minus land value, plus population density, minus police coverage. Every 18th cycle.' },
  { n: 14, every: 19, name: 'density and the city center',
    about: 'Population is spread into a density map by blurring. The city center is moved to the average ' +
      'position of the population; land value, in step 13, is measured from it. Every 19th cycle.' },
  { n: 15, every: 20, name: 'fire coverage',
    about: 'Fire coverage is made by blurring the map of fire stations, as police coverage is. The game would ' +
      'also roll for disasters here; they are switched off in this sandbox. Every 20th cycle.' }
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
  const plan = PLANS[params.urban_form ?? 'blocks'] ?? PLANS.blocks;
  const map = makeMap(plan);
  const sim = new Simulation(map, 0, 3);
  const tally = buildStartingCity(map, sim, plan);
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

// --- what is on a tile, for the hover readout --------------------------------

const T = TileValues;

/** Name a tile by its value. Zones are named from their center tile. */
function tileKind(v) {
  if (v === T.DIRT) return 'bare ground';
  if (v >= T.WATER_LOW && v <= T.WATER_HIGH) return 'water';
  if (v >= T.TREEBASE && v <= T.WOODS5) return 'trees';
  if (v >= T.RUBBLE && v <= T.LASTRUBBLE) return 'rubble';
  if (v >= T.FLOOD && v <= T.LASTFLOOD) return 'flood';
  if (v >= T.FIREBASE && v <= T.LASTFIRE) return 'fire';
  if (v >= T.ROADBASE && v <= T.LASTROAD) {
    const r = TileUtils.normalizeRoad(v);
    return r === T.HROADPOWER || r === T.VROADPOWER ? 'road, with a power line across' : 'road';
  }
  if (v >= T.POWERBASE && v <= T.LASTPOWER) return 'power line';
  if (v >= T.RAILBASE && v <= T.LASTRAIL) return 'rail';
  if (v >= T.HOSPITALBASE && v < T.CHURCHBASE) return 'hospital';
  if (v >= T.CHURCHBASE && v < T.COMBASE) return 'church';
  if (v >= T.RESBASE && v < T.HOSPITALBASE) return 'residential';
  if (v >= T.COMBASE && v < T.INDBASE) return 'commercial';
  if ((v >= T.INDBASE && v < T.PORTBASE) || (v >= T.INDBASE2 && v < T.TINYEXP)) return 'industrial';
  if (v >= T.COALBASE && v <= T.LASTPOWERPLANT) return 'coal power plant';
  if (v >= T.FIRESTBASE && v < T.POLICESTBASE) return 'fire station';
  if (v >= T.POLICESTBASE && v < T.STADIUMBASE) return 'police station';
  if (v >= T.FOUNTAIN && v < T.INDBASE2) return 'fountain';
  return 'other';
}

/** The center tile of the zone covering (x, y), if there is one. */
function zoneCenter(map, x, y) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const cx = x + dx;
      const cy = y + dy;
      if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) continue;
      const tile = map.getTile(cx, cy);
      if (!tile.isZone()) continue;
      // A 3x3 zone covers its center +-1; a 4x4 plant covers -1..+2.
      const big = tileKind(tile.getValue()) === 'coal power plant';
      const lo = -1;
      const hi = big ? 2 : 1;
      if (x - cx >= lo && x - cx <= hi && y - cy >= lo && y - cy <= hi) return { x: cx, y: cy, tile };
    }
  }
  return null;
}

/** The layers the hover readout reports, in the order it reports them. */
const READOUT = [
  ['land value', 'landValueMap'],
  ['crime', 'crimeRateMap'],
  ['pollution', 'pollutionDensityMap'],
  ['population density', 'populationDensityMap'],
  ['traffic', 'trafficDensityMap'],
  ['police coverage', 'policeStationMap'],
  ['fire coverage', 'fireStationMap']
];

/**
 * What is on one tile, and the simulation's numbers for where it sits.
 *
 * The numbers come from the block maps, which are coarser than the tiles, so
 * neighbouring tiles often read the same: that is the resolution the
 * simulation itself works at.
 */
export function inspectTile(map, sim, x, y) {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
  const v = map.getTileValue(x, y);
  let kind = tileKind(v);
  const rows = [];
  const zone = zoneCenter(map, x, y);
  if (zone) {
    const cv = zone.tile.getValue();
    kind = tileKind(cv);
    if (kind === 'residential') {
      rows.push(['residents', Residential.getZonePopulation(map, zone.x, zone.y, cv)]);
    } else if (kind === 'commercial') {
      rows.push(['level', `${Commercial.getZonePopulation(map, zone.x, zone.y, cv)} of 5`]);
    } else if (kind === 'industrial') {
      rows.push(['level', `${Industrial.getZonePopulation(map, zone.x, zone.y, cv)} of 5`]);
    }
    rows.push(['power', zone.tile.isPowered() ? 'yes' : 'no']);
  }
  for (const [label, key] of READOUT) rows.push([label, sim.blockMaps[key].worldGet(x, y)]);
  return { x, y, kind, rows };
}

export { PLAN, PLANS, C };
