// The starting city.
//
// A generated Micropolis map is bare terrain - rivers and trees, no zones, no
// roads, no power. Nothing develops on it and every number stays zero, because
// in the real game a player builds the first city by hand.
//
// The divergence chart needs the opposite of a player: ONE city, identical
// every run, so that repeated runs differ by their seed and by nothing else.
// So the first city is laid out here, deterministically, by the same tools the
// game's own mouse uses.
//
// What this asserts is worth noticing, and it is in the model card. A real
// city's plan is the accumulated result of a great many decisions. This one is
// a grid, placed by a loop, because the sandbox needs a control condition. Any
// argument a student makes about how this city grows is an argument about how
// THIS plan grows, and a different plan is a different experiment.
// NOT vendor/src/gameTools.js. That module builds all sixteen tools including
// QueryTool, which imports jQuery, which would drag a DOM library into a
// headless worker for the sake of a tool this file never uses. The eight tools
// below are constructed with exactly the arguments gameTools.js gives them -
// same costs, same tile values, same sizes - so the city built here is the city
// the game's own toolbar would build.
import { BuildingTool } from './vendor/src/buildingTool.js';
import { RoadTool } from './vendor/src/roadTool.js';
import { WireTool } from './vendor/src/wireTool.js';
import { GameMap } from './vendor/src/gameMap.js';
import * as TileValues from './vendor/src/tileValues.ts';

function makeTools(map) {
  return {
    road: new RoadTool(map),
    wire: new WireTool(map),
    coal: new BuildingTool(3000, TileValues.POWERPLANT, map, 4, false),
    residential: new BuildingTool(100, TileValues.FREEZ, map, 3, false),
    commercial: new BuildingTool(100, TileValues.COMCLR, map, 3, false),
    industrial: new BuildingTool(100, TileValues.INDCLR, map, 3, false),
    police: new BuildingTool(500, TileValues.POLICESTATION, map, 3, false),
    fire: new BuildingTool(500, TileValues.FIRESTATION, map, 3, false)
  };
}

// The plan is generated rather than typed out, so that the reasoning is in the
// code instead of in a list of coordinates nobody can check.
//
// Micropolis has two adjacency rules that decide whether a zone does anything
// at all, and getting either wrong produces a city that runs, looks fine, and
// never grows:
//
//   POWER  spreads only through tiles with the conductive flag - wires and
//          zones, NOT roads. A zone with no conductive path back to the power
//          plant stays dark and never develops.
//   ROADS  a zone needs road access before it will develop.
//
// So the map is laid out in horizontal bands, each of which gives every zone in
// it both. A band is six tiles tall:
//
//     y+0   wire      (power, and it touches the zone's top row)
//     y+1   zone      3x3 zones, centred on y+2
//     y+2   zone      <- zone centres sit here
//     y+3   zone
//     y+4   road      (access, and it touches the zone's bottom row)
//     y+5   spare
//
// A vertical wire trunk down the left joins every band's wire to the plant.
//
// THE MAP IS BLANK, not generated. MapGenerator lays down rivers and forest,
// and on a generated map roughly a third of the zones here are simply refused
// because something is in the way, while a river across the wire trunk leaves
// half the city with no electricity - which looks, from the panel, exactly like
// a model whose parameters do nothing.
//
// A blank map is also the better control condition, and that is the real
// reason. The sandbox is an argument about one line - land value falling with
// distance from the city centre - and random terrain adds a second, louder
// source of spatial variation on top of it. With flat ground, every difference
// on the land value layer is the gradient, the plan, or a coefficient someone
// moved. That is a claim about this city and it belongs in the model card:
// there is no geography here at all.

const BAND_HEIGHT = 6;
const COL_SPACING = 4;   // 3-wide zones, centred every 4 columns, 1 tile apart

const TRUNK_X = 14;
const FIRST_X = 18;
const LAST_X = 102;
const FIRST_BAND_Y = 16;

// Four bands of housing, two of shops, three of industry. The proportions are
// ours and they are a starting condition, not a finding.
const BAND_USES = [
  'residential', 'residential', 'residential', 'residential',
  'commercial', 'commercial',
  'industrial', 'industrial', 'industrial'
];

function buildPlan() {
  const roads = [];
  const wires = [];
  const zones = [];
  const cols = [];
  for (let x = FIRST_X; x <= LAST_X; x += COL_SPACING) cols.push(x);

  let y = FIRST_BAND_Y;
  const bandTops = [];
  for (const use of BAND_USES) {
    bandTops.push(y);
    wires.push({ x1: TRUNK_X, y1: y, x2: LAST_X + 2, y2: y });
    roads.push({ x1: TRUNK_X, y1: y + 4, x2: LAST_X + 2, y2: y + 4 });
    zones.push({ tool: use, row: y + 2, cols });
    y += BAND_HEIGHT;
  }

  // FOUR vertical wires, not one. Wires and roads cross each other happily -
  // the engine turns the crossing into a road-with-wire tile that still
  // conducts - but a wire cannot cross WATER, and the generated map puts
  // rivers wherever it likes. A single trunk severed by a river leaves most of
  // the city dark, the zones never develop, and the sandbox looks like a model
  // whose parameters do nothing rather than like a city with no electricity.
  const top = bandTops[0];
  const bottom = bandTops[bandTops.length - 1] + 4;
  for (const x of [TRUNK_X, 44, 74, LAST_X + 2]) {
    wires.push({ x1: x, y1: top, x2: x, y2: bottom });
  }
  roads.push({ x1: TRUNK_X - 2, y1: top, x2: TRUNK_X - 2, y2: bottom });
  roads.push({ x1: LAST_X + 2, y1: top, x2: LAST_X + 2, y2: bottom });

  return {
    width: 120,
    height: 100,
    funds: 5000000,
    // SIX plants, and the number is arithmetic rather than taste. A coal plant
    // in this engine supplies COAL_POWER_STRENGTH = 700 tiles (powerManager.js),
    // and power is consumed by every conductive tile the scan reaches, not by
    // every zone: roughly 200 zones at nine tiles each, plus about a thousand
    // tiles of wire, is on the order of 2,800. Two plants lit 77 zones of 198
    // and the city sat still. Six gives headroom.
    //
    // This is worth noticing rather than tuning away. Nothing warns you. The
    // city just stops growing, and every slider still moves.
    power: [
      { x: TRUNK_X + 2, y: top + 7, spurTo: TRUNK_X },
      { x: TRUNK_X + 2, y: bottom - 7, spurTo: TRUNK_X },
      { x: 46, y: top + 7, spurTo: 44 },
      { x: 46, y: bottom - 7, spurTo: 44 },
      { x: 76, y: top + 7, spurTo: 74 },
      { x: 76, y: bottom - 7, spurTo: 74 }
    ],
    roads,
    wires,
    zones,
    // Services take over ZONE SLOTS rather than sitting in a gap. A slot
    // already has a wire above it and a road below it, which is exactly what a
    // station needs, and there is no gap in this layout big enough for a 3x3
    // building anyway. The zone loop skips these positions.
    //
    // Without a police station the police term of the crime function is zero
    // across the whole map, and the sandbox's most important slider does
    // nothing at all. Three is enough to give the smoothing something to
    // spread, and few enough that policing is visibly uneven.
    services: [
      { tool: 'police', x: 30, y: FIRST_BAND_Y + BAND_HEIGHT * 1 + 2 },
      { tool: 'police', x: 78, y: FIRST_BAND_Y + BAND_HEIGHT * 4 + 2 },
      { tool: 'fire', x: 54, y: FIRST_BAND_Y + BAND_HEIGHT * 6 + 2 }
    ]
  };
}

export const PLAN = buildPlan();

/** Apply a building tool at one tile. Returns whether it was actually built. */
function place(tool, budget, blockMaps, x, y) {
  tool.doTool(x, y, blockMaps);
  return tool.modifyIfEnoughFunding(budget);
}

/**
 * Apply a building tool at the first clear tile near a target.
 *
 * Scans a square spiral outward in a fixed order, so the site chosen is a pure
 * function of the terrain and of what has already been built - which keeps the
 * starting city identical across runs, which is the whole point of it.
 */
function placeNear(tool, budget, blockMaps, tx, ty, radius = 8) {
  for (let r = 0; r <= radius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (place(tool, budget, blockMaps, tx + dx, ty + dy)) {
          return { x: tx + dx, y: ty + dy };
        }
      }
    }
  }
  return null;
}

function line(tool, budget, blockMaps, { x1, y1, x2, y2 }) {
  const dx = Math.sign(x2 - x1);
  const dy = Math.sign(y2 - y1);
  let x = x1;
  let y = y1;
  let placed = 0;
  for (;;) {
    tool.doTool(x, y, blockMaps);
    if (tool.modifyIfEnoughFunding(budget)) placed += 1;
    if (x === x2 && y === y2) break;
    x += dx;
    y += dy;
  }
  return placed;
}

/**
 * Build the starting city into a live simulation.
 *
 * Applies the tools in the order roads -> power -> wires -> zones -> services,
 * because a zone placed before there is a road beside it does not develop, and
 * the engine has no notion of "later".
 *
 * Returns a tally of what was placed, so the caller can assert the city is the
 * one it thinks it is. A silently half-built city looks exactly like a model
 * whose parameters do nothing.
 */
export function buildStartingCity(map, simulation, plan = PLAN) {
  const tools = makeTools(map);
  const budget = simulation.budget;
  const blockMaps = simulation.blockMaps;
  budget.setFunds(plan.funds);

  const tally = { roads: 0, wires: 0, zones: 0, zonesWanted: 0,
                  services: 0, plants: 0 };

  // 1. Roads, then wires. Order does not matter for crossings - the engine
  //    makes a road-with-wire tile either way - but it does matter that both
  //    are down before any zone, because a zone with no road never develops.
  for (const r of plan.roads) tally.roads += line(tools.road, budget, blockMaps, r);
  for (const w of plan.wires) tally.wires += line(tools.wire, budget, blockMaps, w);

  // 2. The plants, each spurred to its nearest vertical wire. A 4x4 building
  //    placed at (x, y) occupies x-1..x+2 by y-1..y+2, so the spur starts
  //    three tiles clear of the origin rather than on top of the plant.
  for (const p of plan.power) {
    const at = placeNear(tools.coal, budget, blockMaps, p.x, p.y);
    if (!at) continue;
    tally.plants += 1;
    const from = p.spurTo < at.x ? at.x - 2 : at.x + 3;
    tally.wires += line(tools.wire, budget, blockMaps,
                        { x1: from, y1: at.y, x2: p.spurTo, y2: at.y });
  }

  // 3. Services first, because they take over zone slots and the zone loop
  //    below has to find them already occupied rather than race them.
  const taken = new Set();
  for (const s of plan.services) {
    taken.add(s.x + ',' + s.y);
    if (place(tools[s.tool], budget, blockMaps, s.x, s.y)) tally.services += 1;
  }

  // 4. Zones, skipping the slots the services took.
  for (const band of plan.zones) {
    const tool = tools[band.tool];
    for (const x of band.cols) {
      if (taken.has(x + ',' + band.row)) continue;
      tally.zonesWanted += 1;
      if (place(tool, budget, blockMaps, x, band.row)) tally.zones += 1;
    }
  }

  tally.fundsLeft = budget.totalFunds;
  return tally;
}


/**
 * The blank map the starting city is built on.
 *
 * Every tile is dirt. See the note above the plan for why this is not
 * MapGenerator: reliability first, and a clean control condition second.
 */
export function makeMap(plan = PLAN) {
  return new GameMap(plan.width, plan.height, TileValues.DIRT);
}
