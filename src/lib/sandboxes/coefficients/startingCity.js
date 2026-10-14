// The starting city.
//
// A generated Micropolis map is bare terrain - rivers and trees, no zones, no
// roads, no power. Nothing develops on it and every number stays zero, because
// in the real game a player builds the first city by hand.
//
// The sandbox needs the opposite of a player: ONE city, identical every run,
// so that two runs differ by their seed and by nothing else. So the first city
// is laid out here, deterministically, by the same tools the game's own mouse
// uses. There are two plans, the blocks city (the default) and a grid.
//
// What this asserts is worth noticing, and it is in the model card. A real
// city's plan is the accumulated result of a great many decisions. These are
// placed by loops. Any argument a student makes about how this city grows is
// an argument about how THIS plan grows, and a different plan is a different
// experiment.
// NOT vendor/src/gameTools.js. That module builds all sixteen tools including
// QueryTool, which imports jQuery, which would drag a DOM library into a
// headless build for the sake of a tool this file never uses. The eight tools
// below are constructed with exactly the arguments gameTools.js gives them -
// same costs, same tile values, same sizes - so the city built here is the city
// the game's own toolbar would build.
import { BuildingTool } from './vendor/src/buildingTool.js';
import { RoadTool } from './vendor/src/roadTool.js';
import { WireTool } from './vendor/src/wireTool.js';
import { GameMap } from './vendor/src/gameMap.js';
import * as TileValues from './vendor/src/tileValues.ts';
import { BURNBIT, BULLBIT } from './vendor/src/tileFlags.ts';

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
//     y+1   zone      3x3 zones, centered on y+2
//     y+2   zone      <- zone centers sit here
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
// distance from the city center - and random terrain adds a second, louder
// source of spatial variation on top of it. With flat ground, every difference
// on the land value layer is the gradient, the plan, or a coefficient someone
// moved. That is a claim about this city and it belongs in the model card:
// there is no geography here at all.

const BAND_HEIGHT = 6;
const COL_SPACING = 4;   // 3-wide zones, centered every 4 columns, 1 tile apart

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
    for (const x of cols) zones.push({ tool: use, x, y: y + 2 });
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

// --- the blocks city ------------------------------------------------------
//
// The grid above is a control condition, and it looks like one: nine stripes
// with nothing to tell one part of the city from another. This is the city a
// player of the original game would build instead, and it is laid out by the
// same reasoning a player uses.
//
// THE BLOCK is the one every guide to the game recommends. A ring of road ten
// tiles on a side encloses a 9x9 interior, which holds eight zones around a
// middle square:
//
//     r r r r r r r r r r r
//     r Z Z Z Z Z Z Z Z Z r      Z  the eight ring lots, every one touching
//     r Z Z Z Z Z Z Z Z Z r         the road, which is the access rule
//     r Z Z Z Z Z Z Z Z Z r
//     r Z Z Z . . . Z Z Z r      .  the middle: a park, or nothing. It has no
//     r Z Z Z . . . Z Z Z r         road, so it is no use for a zone
//     r Z Z Z . . . Z Z Z r
//     r Z Z Z Z Z Z Z Z Z r
//     r Z Z Z Z Z Z Z Z Z r
//     r Z Z Z Z Z Z Z Z Z r
//     r r r r r r r r r r r
//
// Zones that touch conduct power to each other, so a block needs one wire to
// join it to the next, and routePower lays it.
//
// DENSITY falls with distance from downtown: full blocks with parks in the
// middle at the center, blocks with lots missing further out, wooded or empty,
// and a ragged edge where the city stops. Industry is the exception. It sits
// in its own district at the east edge, downwind as a player would put it,
// and it is built out fully, because a factory does not thin out with distance
// from the shops.
//
// USE is decided lot by lot rather than block by block, so blocks on the edge
// of a district come out mixed. Downtown is commercial; a commercial main
// street runs east along the central avenue to the industry; a few corner
// stores sit out in the residential blocks. Everything else is housing.
//
// That arrangement is not taste either. The engine's only test of access is a
// random walk of at most thirty road tiles: housing must find shops, shops
// must find industry, industry must find housing. A district plan that puts
// these too far apart produces zones that never grow, so the main street and
// the corner stores are there to keep every leg of that loop short.
//
// The variation from block to block comes from a fixed hash of the block's
// position, not from a seed. It looks irregular, and it is the same city
// every time, so that two runs still differ only by their seed.

const BLOCK = 10;
const BLOCK_X0 = 5;
const BLOCK_Y0 = 10;
const BLOCKS_ACROSS = 11;
const BLOCKS_DOWN = 8;
const DOWNTOWN = { x: 60, y: 50 };
const INDUSTRY_X = 95;     // the industrial column starts here; nothing else is built east of it
const MAIN_STREET_Y = 50;  // the central avenue, a road line
const CORNER_STORES = 0.25; // share of residential corner lots that are a shop instead
// Industrial blocks beyond the main column, beside the power plants.
const INDUSTRIAL_EXTRA = [[10, 1], [10, 5], [10, 6]];

// Lot centers, as offsets from a block's top-left road corner. Clockwise from
// the top left, so that any run of consecutive lots is a chain of zones that
// touch - which is what lets a part-built block still conduct power.
const RING = [[2, 2], [5, 2], [8, 2], [8, 5], [8, 8], [5, 8], [2, 8], [2, 5]];
const MIDDLE = [5, 5];

/** A fixed hash of integers to [0, 1). Deterministic; not a random generator. */
function hash(a, b, k) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(k, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Distance from downtown, stretched a little north-south so the city is wider than tall. */
function fromDowntown(x, y) {
  return Math.hypot(x - DOWNTOWN.x, (y - DOWNTOWN.y) * 1.25);
}

/** How many of a block's eight lots are built, and what goes in its middle. */
function blockDensity(bx, by, cx, cy) {
  const r = fromDowntown(cx, cy);
  const h = hash(bx, by, 1);
  if (isIndustrial(bx, by)) return { lots: 6 + Math.floor(h * 3), middle: 'none' };
  if (cx >= INDUSTRY_X) return { lots: 0, middle: 'none' };
  if (r < 16) return { lots: 8, middle: 'park' };
  if (r < 28) return { lots: 7 + Math.floor(h * 2), middle: h < 0.6 ? 'park' : 'none' };
  if (r < 40) return { lots: 4 + Math.floor(h * 3), middle: h < 0.3 ? 'park' : 'none' };
  if (r < 52) return { lots: 1 + Math.floor(h * 3), middle: 'none' };
  return { lots: 0, middle: 'none' };
}

/** The industrial district: the column at INDUSTRY_X, and a few blocks beside the power plants. */
function isIndustrial(bx, by) {
  return BLOCK_X0 + bx * BLOCK === INDUSTRY_X
    || INDUSTRIAL_EXTRA.some(([x, y]) => x === bx && y === by);
}

/** The land use of one lot, from where it is. */
function lotUse(bx, by, x, y, k) {
  if (isIndustrial(bx, by)) return 'industrial';
  if (fromDowntown(x, y) < 14) return 'commercial';
  if (Math.abs(y - MAIN_STREET_Y) === 2 && x > DOWNTOWN.x && x < INDUSTRY_X) return 'commercial';
  // A corner lot is the place for a shop.
  if (k % 2 === 0 && hash(bx, by, 10 + k) < CORNER_STORES) return 'commercial';
  return 'residential';
}

// Stations take a ring lot, never a middle: the middle has no road, and the
// engine halves the reach of a station that cannot reach a road. As on the
// grid, three police stations so that policing is visibly uneven, and one
// fire station.
const BLOCK_SERVICES = [
  { tool: 'police', bx: 5, by: 3, lot: 4 },
  { tool: 'police', bx: 2, by: 2, lot: 3 },
  { tool: 'police', bx: 7, by: 5, lot: 1 },
  { tool: 'fire', bx: 4, by: 5, lot: 2 }
];

// Plants go four to a block in the industrial district, in blocks of their
// own with no zones. TWELVE, though there are only about 3,600 conductive
// tiles and a plant supplies 700: the engine's power scan counts a tile again
// every time it backtracks to a junction, and a solid block of zones is
// nothing but junctions. With eight, the scan ran out partway through the
// industrial district and left it dark, with no warning.
const UTILITY_BLOCKS = [[10, 2], [10, 3], [10, 4]];

const PARK_TREES = [TileValues.WOODS2, TileValues.WOODS3, TileValues.WOODS4, TileValues.WOODS5];

function buildBlocksPlan() {
  const roadTiles = new Set();
  const zones = [];
  const services = [];
  const trees = [];
  const power = [];
  const ring = (ox, oy) => {
    for (let i = 0; i <= BLOCK; i++) {
      roadTiles.add(`${ox + i},${oy}`);
      roadTiles.add(`${ox + i},${oy + BLOCK}`);
      roadTiles.add(`${ox},${oy + i}`);
      roadTiles.add(`${ox + BLOCK},${oy + i}`);
    }
  };
  // A 3x3 square of park trees, centered on a lot.
  const grove = (x, y, bx, by, k, fountain = false) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tile = fountain && dx === 0 && dy === 0
          ? TileValues.FOUNTAIN
          : PARK_TREES[Math.floor(hash(x + dx, y + dy, k) * 4)];
        trees.push({ x: x + dx, y: y + dy, tile });
      }
    }
  };

  const utility = new Set(UTILITY_BLOCKS.map(([bx, by]) => `${bx},${by}`));

  for (let by = 0; by < BLOCKS_DOWN; by++) {
    for (let bx = 0; bx < BLOCKS_ACROSS; bx++) {
      const ox = BLOCK_X0 + bx * BLOCK;
      const oy = BLOCK_Y0 + by * BLOCK;

      if (utility.has(`${bx},${by}`)) {
        ring(ox, oy);
        // A 4x4 plant at (x, y) covers x-1..x+2, so these four fill the
        // interior with a one-tile cross between them.
        for (const [dx, dy] of [[2, 2], [7, 2], [2, 7], [7, 7]]) {
          power.push({ x: ox + dx, y: oy + dy });
        }
        continue;
      }

      const { lots, middle } = blockDensity(bx, by, ox + 5, oy + 5);
      const station = BLOCK_SERVICES.find((s) => s.bx === bx && s.by === by);
      if (lots === 0 && !station) continue;
      ring(ox, oy);

      // Built lots are a consecutive run of the ring, starting somewhere
      // different in each block.
      const start = Math.floor(hash(bx, by, 2) * RING.length);
      const built = new Set();
      for (let i = 0; i < lots; i++) built.add((start + i) % RING.length);
      if (station) built.add(station.lot);

      for (let k = 0; k < RING.length; k++) {
        const x = ox + RING[k][0];
        const y = oy + RING[k][1];
        if (station && station.lot === k) {
          services.push({ tool: station.tool, x, y });
        } else if (built.has(k)) {
          zones.push({ tool: lotUse(bx, by, x, y, k), x, y });
        } else if (hash(bx, by, 20 + k) < 0.5) {
          grove(x, y, bx, by, 30 + k);   // a wooded lot; the rest stay bare
        }
      }

      if (middle === 'park') {
        const [mx, my] = MIDDLE;
        grove(ox + mx, oy + my, bx, by, 40, fromDowntown(ox + 5, oy + 5) < 10);
      }
    }
  }

  const roads = [...roadTiles].map((key) => {
    const [x, y] = key.split(',').map(Number);
    return { x1: x, y1: y, x2: x, y2: y };
  });

  return {
    width: 120,
    height: 100,
    funds: 5000000,
    power,
    roads,
    wires: [],
    zones,
    services,
    trees,
    routePower: true,
    // The street grid's outer edge. Routed wires stay inside it if they can.
    bounds: {
      x1: BLOCK_X0, y1: BLOCK_Y0,
      x2: BLOCK_X0 + BLOCKS_ACROSS * BLOCK, y2: BLOCK_Y0 + BLOCKS_DOWN * BLOCK
    }
  };
}

/** Every starting city, by the value of the urban_form control. */
export const PLANS = {
  grid: PLAN,
  blocks: buildBlocksPlan()
};

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
    if (p.spurTo === undefined) continue;   // routePower joins it instead
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
  for (const z of plan.zones) {
    if (taken.has(z.x + ',' + z.y)) continue;
    tally.zonesWanted += 1;
    if (place(tools[z.tool], budget, blockMaps, z.x, z.y)) tally.zones += 1;
  }

  // 5. Trees, written straight onto the map. NOT the park tool: it picks its
  //    tile with the engine's own random generator, and building the city must
  //    not draw from the stream the run is seeded with.
  if (plan.trees) {
    tally.trees = 0;
    for (const t of plan.trees) {
      if (map.getTileValue(t.x, t.y) !== TileValues.DIRT) continue;
      map.setTile(t.x, t.y, t.tile, BURNBIT | BULLBIT);
      tally.trees += 1;
    }
  }

  // 6. Wires that nobody planned. A layout that is not drawn around its power
  //    lines gets them routed afterwards, by the shortest path the engine will
  //    accept.
  if (plan.routePower) tally.wires += routePower(map, tools.wire, budget, blockMaps, plan.bounds);

  tally.fundsLeft = budget.totalFunds;
  return tally;
}

/**
 * Join every conductive island to a power plant with the least wire.
 *
 * Repeats until nothing is left over: find everything a plant reaches, search
 * outward from it across open ground for the nearest conductive tile it does
 * not reach, and lay wire back along that path. Power in this engine flows
 * through any adjacent conductive tiles, so a block of zones that touch each
 * other needs only one wire to join it to the next - usually a single tile
 * across a road.
 *
 * A wire can be laid on bare ground, and across a STRAIGHT road at right
 * angles; never along a road, through an intersection, or through trees.
 */
function routePower(map, wireTool, budget, blockMaps, bounds) {
  const W = map.width;
  const H = map.height;
  const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const conductive = (x, y) => map.getTile(x, y).isConductive();
  const within = (x, y) => !bounds
    || (x >= bounds.x1 && x <= bounds.x2 && y >= bounds.y1 && y <= bounds.y2);
  const layable = (x, y, dx, { throughTrees, outside }) => {
    if (!outside && !within(x, y)) return false;
    const v = map.getTileValue(x, y);
    return v === TileValues.DIRT
      || (v === TileValues.ROADS && dx === 0)     // horizontal road, crossed north-south
      || (v === TileValues.ROADS2 && dx !== 0)    // vertical road, crossed east-west
      || (throughTrees && v >= TileValues.WOODS2 && v <= TileValues.WOODS5);
  };

  // Everything a plant reaches.
  const network = () => {
    const net = new Uint8Array(W * H);
    const stack = [];
    for (let i = 0; i < W * H; i++) {
      if (map.getTileValue(i % W, Math.floor(i / W)) === TileValues.POWERPLANT) {
        net[i] = 1;
        stack.push(i);
      }
    }
    while (stack.length) {
      const i = stack.pop();
      const x = i % W;
      const y = (i - x) / W;
      for (const [dx, dy] of STEPS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (!net[j] && conductive(nx, ny)) { net[j] = 1; stack.push(j); }
      }
    }
    return net;
  };

  // Breadth first from the whole network at once, so the first island found
  // is the nearest one and the path to it is the shortest. Returns the path's
  // tiles, island end first, or null.
  const nearestIsland = (net, how) => {
    const prev = new Int32Array(W * H).fill(-1);
    const seen = net.slice();
    let queue = [];
    for (let i = 0; i < W * H; i++) if (net[i]) queue.push(i);
    while (queue.length) {
      const next = [];
      for (const i of queue) {
        const x = i % W;
        const y = (i - x) / W;
        for (const [dx, dy] of STEPS) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (seen[j]) continue;
          if (conductive(nx, ny)) {
            const path = [];
            for (let k = i; k !== -1 && !net[k]; k = prev[k]) path.push(k);
            return path;
          }
          if (!layable(nx, ny, dx, how)) continue;
          seen[j] = 1;
          prev[j] = i;
          next.push(j);
        }
      }
      queue = next;
    }
    return null;
  };

  let laid = 0;
  for (let guard = 0; guard < 1000; guard++) {
    const net = network();
    // Inside the city if there is a way, round its edge if not, and through
    // trees (the wire tool clears a tree it is laid on) only for a lot they
    // wall in entirely.
    const path = nearestIsland(net, { throughTrees: false, outside: false })
      ?? nearestIsland(net, { throughTrees: false, outside: true })
      ?? nearestIsland(net, { throughTrees: true, outside: true });
    if (!path) break;
    for (const i of path) {
      wireTool.doTool(i % W, Math.floor(i / W), blockMaps);
      if (wireTool.modifyIfEnoughFunding(budget)) laid += 1;
    }
  }
  return laid;
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
