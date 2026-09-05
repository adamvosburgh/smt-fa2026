// The agent layer's arithmetic: sampling and routing, over typed arrays.
//
// Pure functions, importable from the page and from agents.worker.js alike.
// Everything an agent does is either COUNTED (how many people pass each
// gateway each hour - MTA O-D 2024) or a NAMED ASSUMPTION (which building,
// which route, who is a worker). The component prints the register on the
// canvas; this file only computes.
//
// THE DOC'S PASS/FAIL: converting an office must visibly move mass from the
// worker swarm to the resident swarm and reverse its direction of travel.
// That happens structurally here, not cosmetically - the same compute() state
// that colours the massing weights the sampling, so a building that converts
// stops emitting workers and starts emitting residents.

import { STRIDE, OFFICE_AREA, RES_AREA, LON, LAT, DISTRICT } from './gates.js';

// Walking pace, feet per second. A brisk city walk; an assumption, and it
// only stretches or squeezes trips - it moves no mass between hours.
export const WALK_FT_PER_S = 4.4;
const FT_PER_DEG_LAT = 364000;

/** Deterministic PRNG. Same seed, same crowd - a slider re-interprets the
 *  same uniforms instead of rerolling them, so a change reads as caused. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nearest graph node per building. Brute force once per load. */
export function nearestNodes(buildings, nodes) {
  const nB = buildings.length / STRIDE;
  const out = new Uint16Array(nB);
  const nN = nodes.length / 2;
  for (let i = 0; i < nB; i++) {
    const lon = buildings[i * STRIDE + LON];
    const lat = buildings[i * STRIDE + LAT];
    let best = Infinity, bi = 0;
    for (let j = 0; j < nN; j++) {
      const dx = (nodes[j * 2] - lon) * 0.757; // cos(40.7 deg)
      const dy = nodes[j * 2 + 1] - lat;
      const d = dx * dx + dy * dy;
      if (d < best) { best = d; bi = j; }
    }
    out[i] = bi;
  }
  return out;
}

/** Inverse-CDF draw from a 24-hour curve restricted to [h0, h1). Returns a
 *  fractional hour. The restriction is the one assumption the measured
 *  schedule needs: the counted curves are not split by who is riding, so
 *  before-noon arrivals and after-noon departures are attributed to workers,
 *  and the mirror to residents. Said on the canvas, not buried here. */
function drawHour(curve, h0, h1, u) {
  let total = 0;
  for (let h = h0; h < h1; h++) total += curve[h];
  if (total <= 0) return (h0 + h1) / 2;
  let target = u * total;
  for (let h = h0; h < h1; h++) {
    if (target < curve[h]) return h + target / curve[h];
    target -= curve[h];
  }
  return h1 - 1e-4;
}

/** A truncated-normal-ish draw for the parametric schedule: the sum of three
 *  uniforms is close enough to a bell for a crowd, and it needs no rejection
 *  loop, so the same uniforms always map to the same time. */
function drawNormal(median, spread, u1, u2, u3) {
  const z = (u1 + u2 + u3 - 1.5) * 2; // ~N(0,1)-ish in [-3,3]
  return Math.min(23.9, Math.max(0.1, median + z * spread));
}

/**
 * The sample. One agent = one person with an in-trip and an out-trip.
 *
 * Roles are split by the COUNTED populations (LODES jobs vs census residents,
 * plus what the conversions move); within a role a building is drawn
 * proportional to its floor area - office area for workers, residential area
 * (plus converted units at their floor area) for residents. Gateways are
 * drawn by their complex's counted share of the hour's flow, split evenly
 * across entrances.
 */
export function sampleAgents({
  buildings, state, unitsOf, metrics, manifest, gateways, flow, params, seed = 20260904
}) {
  const nB = buildings.length / STRIDE;
  const rand = mulberry32(seed);
  const count = Math.max(1, Math.round(params.agent_count ?? 4000));
  const sfPerUnit = manifest?.economics?.sf_per_unit ?? 1152;

  // Building weights per role, from the same state that colours the massing.
  const wWork = new Float64Array(nB);
  const wRes = new Float64Array(nB);
  let workTot = 0, resTot = 0;
  for (let i = 0; i < nB; i++) {
    if (state[i] === 3) continue; // outside the selected district
    const base = i * STRIDE;
    if (state[i] !== 2) {
      wWork[i] = Math.max(0, buildings[base + OFFICE_AREA]);
      workTot += wWork[i];
    }
    wRes[i] = Math.max(0, buildings[base + RES_AREA]) +
              (state[i] === 2 ? (unitsOf[i] || 0) * sfPerUnit : 0);
    resTot += wRes[i];
  }

  // The role split comes from the counted people, not the floor area: jobs
  // here minus the jobs conversions removed, against residents plus the ones
  // conversions added. This is what makes the conversion sliders move the
  // swarm.
  const m = metrics ?? {};
  const jobs = Math.max(0, (m.officeJobsHere ?? 1) - (m.officeJobsRemoved ?? 0));
  const residents = Math.max(0, (m.residentsHere ?? 1) + (m.residentsAdded ?? 0));
  const workShare = jobs + residents > 0 ? jobs / (jobs + residents) : 0.5;

  // Cumulative weights for O(log n) draws.
  const cumW = new Float64Array(nB);
  const cumR = new Float64Array(nB);
  let aw = 0, ar = 0;
  for (let i = 0; i < nB; i++) { aw += wWork[i]; ar += wRes[i]; cumW[i] = aw; cumR[i] = ar; }
  const pick = (cum, total, u) => {
    let lo = 0, hi = cum.length - 1;
    const t = u * total;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < t) lo = mid + 1; else hi = mid; }
    return lo;
  };

  // Gateways are district-filtered: a Lower Manhattan worker exits a Lower
  // Manhattan station, not a Midtown one - the O-D counts are per complex,
  // and assigning a trip across districts would cross the study area on
  // foot. 'both' keeps every gateway.
  const dKey = { mn01: 'MN01', mn05: 'MN05' }[params.district];
  const box = dKey ? manifest?.district_view_bounds?.[dKey] : null;
  const pad = 0.004;
  const inDistrict = (gw) =>
    !box || (gw.lon >= box[0] - pad && gw.lat >= box[1] - pad &&
             gw.lon <= box[2] + pad && gw.lat <= box[3] + pad);

  // Gateway draw tables per hour and direction, entrance-even within complex.
  const gwByHour = { exit: [], entry: [] };
  for (let h = 0; h < 24; h++) {
    for (const dir of ['exit', 'entry']) {
      const curveKey = dir === 'exit' ? 'arrivals' : 'departures';
      const w = new Float64Array(gateways.length);
      let t = 0;
      for (let g = 0; g < gateways.length; g++) {
        const gw = gateways[g];
        if (!inDistrict(gw)) continue;
        if (dir === 'exit' && !gw.exit) continue;
        if (dir === 'entry' && !gw.entry) continue;
        const cx = flow.complexes[gw.complex_id];
        if (!cx) continue;
        w[g] = cx[curveKey][h] / (gw.n_entrances || 1);
        t += w[g];
      }
      const cum = new Float64Array(gateways.length);
      let acc = 0;
      for (let g = 0; g < gateways.length; g++) { acc += w[g]; cum[g] = acc; }
      gwByHour[dir][h] = { cum, total: t };
    }
  }
  const pickGw = (dir, hour, u) => {
    const { cum, total } = gwByHour[dir][Math.min(23, Math.floor(hour))];
    if (total <= 0) return 0;
    return pick(cum, total, u);
  };

  const role = new Uint8Array(count);        // 0 worker, 1 resident
  const bIdx = new Uint32Array(count);
  const gwIn = new Uint16Array(count);       // subway-exit gateway (into district)
  const gwOut = new Uint16Array(count);      // subway-entry gateway (out of it)
  const tIn = new Float32Array(count);       // seconds-of-day at the gateway
  const tOut = new Float32Array(count);
  const arr = flow.districtArrivals;         // 24-hour totals, precomputed
  const dep = flow.districtDepartures;
  const sd = flow.schedule_defaults;
  const parametric = params.schedule_source === 'parametric';

  for (let a = 0; a < count; a++) {
    // A fixed vector of uniforms per agent: params re-interpret, not reroll.
    const u = [rand(), rand(), rand(), rand(), rand(), rand(), rand(), rand(), rand()];
    const isWorker = u[0] < workShare && workTot > 0;
    role[a] = isWorker ? 0 : 1;
    bIdx[a] = isWorker ? pick(cumW, workTot, u[1]) : pick(cumR, resTot, u[1]);
    let hIn, hOut;
    if (parametric) {
      const am = params.arrival_median ?? sd.arrival_median;
      const asp = params.arrival_spread ?? sd.arrival_spread;
      const dm = params.departure_median ?? sd.departure_median;
      const dsp = params.departure_spread ?? sd.departure_spread;
      if (isWorker) {
        hIn = drawNormal(am, asp, u[2], u[3], u[4]);
        hOut = Math.max(hIn + 0.5, drawNormal(dm, dsp, u[5], u[6], u[7]));
      } else {
        hOut = drawNormal(am, asp, u[2], u[3], u[4]);
        hIn = Math.max(hOut + 0.5, drawNormal(dm, dsp, u[5], u[6], u[7]));
      }
    } else if (isWorker) {
      hIn = drawHour(arr, 4, 13, u[2]);
      hOut = Math.max(hIn + 0.5, drawHour(dep, 12, 24, u[3]));
    } else {
      hOut = drawHour(dep, 4, 13, u[2]);
      hIn = Math.max(hOut + 0.5, drawHour(arr, 12, 24, u[3]));
    }
    // Workers pass their in-gateway as a subway EXIT and their out-gateway as
    // an ENTRY; residents the reverse, at their own hours.
    if (isWorker) {
      gwIn[a] = pickGw('exit', hIn, u[8]);
      gwOut[a] = pickGw('entry', hOut, u[8]); // same uniform: the same person
    } else {
      gwOut[a] = pickGw('entry', hOut, u[8]);
      gwIn[a] = pickGw('exit', hIn, u[8]);
    }
    tIn[a] = hIn * 3600;
    tOut[a] = hOut * 3600;
  }
  return { role, bIdx, gwIn, gwOut, tIn, tOut, workShare };
}

/** Walk the predecessor array from `node` back to the gateway row's source.
 *  Microseconds per path - this is why no trips are baked. */
function pathFrom(routes, nNodes, row, node) {
  const base = row * nNodes;
  const path = [node];
  let cur = node;
  for (let hop = 0; hop < 4096; hop++) {
    const prev = routes[base + cur];
    if (prev === 65535) return null; // unreachable
    if (prev === cur) return path;   // reached the source
    path.push(prev);
    cur = prev;
  }
  return null;
}

/**
 * The day's timetable, as TripsLayer binary attributes. Two trips per agent;
 * timestamps in seconds-of-day; positions straight along graph nodes. The
 * hour scrubbing NEVER calls this - it only moves currentTime.
 */
export function buildTimetable({ agents, nodes, routes, gateways, nearest, buildings, maxVerts = 4_000_000 }) {
  const nNodes = nodes.length / 2;
  const { role, bIdx, gwIn, gwOut, tIn, tOut } = agents;
  const count = role.length;
  const startIndices = [0];
  const positions = [];
  const timestamps = [];
  const roles = [];

  const pushTrip = (path, tStart, r, reverse) => {
    if (!path || path.length < 2) return;
    // Every other intermediate node is dropped if the budget is near - the
    // trip's shape coarsens before the crowd shrinks.
    const stride = positions.length / 2 > maxVerts * 0.9 ? 2 : 1;
    const pts = [];
    for (let i = 0; i < path.length; i += stride) pts.push(path[i]);
    if (pts[pts.length - 1] !== path[path.length - 1]) pts.push(path[path.length - 1]);
    if (reverse) pts.reverse();
    let t = tStart;
    let prev = null;
    for (const n of pts) {
      const lon = nodes[n * 2], lat = nodes[n * 2 + 1];
      if (prev) {
        const kx = FT_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
        const d = Math.hypot((lon - prev[0]) * kx, (lat - prev[1]) * FT_PER_DEG_LAT);
        t += d / WALK_FT_PER_S;
      }
      positions.push(lon, lat);
      timestamps.push(t);
      prev = [lon, lat];
    }
    startIndices.push(positions.length / 2);
    roles.push(r);
  };

  for (let a = 0; a < count; a++) {
    if (positions.length / 2 > maxVerts) break;
    const bNode = nearest[bIdx[a]];
    const gIn = gateways[gwIn[a]];
    const gOut = gateways[gwOut[a]];
    // pathFrom walks building -> gateway source; the IN trip is that path
    // reversed (gateway -> building).
    pushTrip(pathFrom(routes, nNodes, gIn.route_row, bNode), tIn[a], role[a], true);
    pushTrip(pathFrom(routes, nNodes, gOut.route_row, bNode), tOut[a], role[a], false);
  }
  return {
    length: startIndices.length - 1,
    startIndices: new Uint32Array(startIndices),
    positions: new Float32Array(positions),
    timestamps: new Float32Array(timestamps),
    roles: new Uint8Array(roles)
  };
}
