// The sidewalk heat map, over typed arrays.
//
// What replaced the agent layer. The old version walked sprites along a street
// graph from station exits; this one asks a smaller and more answerable
// question - how many people does each building put onto the pavement near it
// in each hour - and draws that.
//
// The shape of the computation:
//
//   the pipeline ships   a 10 m grid, a sidewalk mask, and per building the
//                        list of sidewalk cells within 50 m of its footprint
//                        edge with a Gaussian weight on that distance,
//                        normalized so a building's weights sum to 1 (CSR)
//   this file computes   for all 24 hours at once, two channels per cell:
//                          O[c] = sum over office buildings of
//                                 w_bc * J_b * (arr[h] + dep[h])
//                          R[c] = sum over residential buildings of
//                                 w_bc * R_b * flow[h]
//   the component draws  a texture per frame, interpolating between the two
//                        hour bins the clock is between
//
// The whole 24-hour pass is redone when the conversion set changes - any
// assumption move - and never per frame. 24 x cells Float32 is a few megabytes
// and the pass is a walk of the CSR array, so it is measured rather than
// worried about: the component prints the number.

import { STRIDE, OFFICE_AREA, RES_AREA, DISTRICT, DISTRICT_INDEX } from './gates.js';

export const HOURS = 24;

/**
 * People per building, per channel.
 *
 * OFFICE. LODES counts office-using jobs for the whole district; they are
 * allocated to buildings by office floor area, which is the same allocation
 * the job-displacement metric uses. A converted building has no office people
 * left.
 *
 * RESIDENTIAL. Apartments times the district's persons per household. A
 * converted building's apartments are the ones the deal made; an existing
 * residential building's are its own, from the floor area at the same measured
 * square feet per apartment.
 */
export function peoplePerBuilding(buildings, manifest, result, p) {
  const n = buildings.length / STRIDE;
  const jobs = new Float32Array(n);
  const residents = new Float32Array(n);
  const householdSize = manifest.household_size ?? 2.01;
  const sfPerUnit =
    manifest?.economics?.sensitivity_to_the_unit_floor?.[
      String(p.min_units_for_conversion_sample ?? 10)
    ]?.sf_per_unit ?? manifest?.economics?.sf_per_unit ?? 1152;

  // Office-using jobs per district, and the office floor area they sit on, so
  // the allocation is by area rather than by a rule of thumb.
  const districts = manifest.districts ?? [];
  const jobsOf = districts.map(
    (k) => manifest.presence?.districts?.[k]?.office_using_jobs ?? 0
  );
  const officeAreaOf = new Float64Array(districts.length);
  for (let i = 0; i < n; i++) {
    const d = buildings[i * STRIDE + DISTRICT];
    if (d >= 0 && d < districts.length) officeAreaOf[d] += buildings[i * STRIDE + OFFICE_AREA];
  }

  for (let i = 0; i < n; i++) {
    const base = i * STRIDE;
    const d = buildings[base + DISTRICT];
    const office = buildings[base + OFFICE_AREA];
    const res = buildings[base + RES_AREA];

    if (result.state[i] === 2) {
      // Converted: the offices are gone and the apartments the deal made are here.
      residents[i] = result.unitsOf[i] * householdSize;
    } else {
      if (office > 0 && officeAreaOf[d] > 0) {
        jobs[i] = (jobsOf[d] * office) / officeAreaOf[d];
      }
      if (res > 0) residents[i] = (res / sfPerUnit) * householdSize;
    }
  }
  return { jobs, residents };
}

/**
 * The two channels, for all 24 hours.
 *
 * Returns { office, residential } as Float32Arrays of HOURS * cells, hour-major,
 * plus the 98th percentile of the summed activity, which is what the color ramp
 * is normalized against.
 *
 * `inDistrict` is a per-building test so that choosing one district does not
 * silently keep the other one's people on the shared grid.
 */
export function computeChannels(grid, csr, buildings, people, districtParam) {
  const cells = grid.width * grid.height;
  const nBuildings = grid.buildings;
  const office = new Float32Array(HOURS * cells);
  const residential = new Float32Array(HOURS * cells);
  const { offsets, cellIds, weights } = csr;
  const wanted = districtParam === 'both' ? null : DISTRICT_INDEX[districtParam];

  for (let b = 0; b < nBuildings; b++) {
    if (wanted !== null && buildings[b * STRIDE + DISTRICT] !== wanted) continue;
    const J = people.jobs[b];
    const R = people.residents[b];
    if (J <= 0 && R <= 0) continue;
    const from = offsets[b];
    const to = offsets[b + 1];
    for (let k = from; k < to; k++) {
      const c = cellIds[k];
      const w = weights[k];
      if (J > 0) for (let h = 0; h < HOURS; h++) office[h * cells + c] += w * J;
      if (R > 0) for (let h = 0; h < HOURS; h++) residential[h * cells + c] += w * R;
    }
  }

  return { office, residential, cells };
}

/**
 * Scale the per-building totals by the hour curves.
 *
 * Done as a second pass rather than inside the accumulation, because the curve
 * is the same for every building in a channel: accumulating the unscaled sum
 * once and multiplying by 24 numbers afterwards is 24 multiplications per cell
 * instead of 24 per building-cell pair.
 */
export function applyCurves(channels, day) {
  const { office, residential, cells } = channels;
  const arr = day.workers.arrivals;
  const dep = day.workers.departures;
  const flow = day.residents.flow;
  for (let h = 0; h < HOURS; h++) {
    const o = arr[h] + dep[h];
    const r = flow[h];
    const base = h * cells;
    for (let c = 0; c < cells; c++) {
      office[base + c] *= o;
      residential[base + c] *= r;
    }
  }
  return channels;
}

/**
 * The 98th percentile of O + R over every cell and every hour.
 *
 * Computed once, at the DEFAULT scenario, and held: the ramp has to mean the
 * same thing at 08:00 and at 20:00 and under every scenario, or the map shows
 * the shape of the color scale rather than the shape of the day. Clamped above,
 * so a handful of cells at a station mouth do not flatten everything else.
 *
 * A sample rather than a full sort - two million cells times 24 hours is 50
 * million floats and the percentile of a random tenth of them is the same
 * number to three figures.
 */
export function percentile98(channels) {
  const { office, residential } = channels;
  const n = office.length;
  const step = Math.max(1, Math.floor(n / 200000));
  const sample = [];
  for (let i = 0; i < n; i += step) {
    const v = office[i] + residential[i];
    if (v > 0) sample.push(v);
  }
  if (!sample.length) return 1;
  sample.sort((a, b) => a - b);
  return sample[Math.floor(sample.length * 0.98)] || 1;
}

// The activity ramp: gray (nothing) through yellow to red (the busiest cell in
// the district's day). Three stops, interpolated.
const RAMP = [
  [154, 154, 154], // #9a9a9a
  [242, 212, 60], // #f2d43c
  [215, 48, 31] // #d7301f
];

export function activityColor(t, out, o) {
  const v = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const seg = v < 0.5 ? 0 : 1;
  const f = seg === 0 ? v * 2 : (v - 0.5) * 2;
  const a = RAMP[seg];
  const b = RAMP[seg + 1];
  out[o] = a[0] + (b[0] - a[0]) * f;
  out[o + 1] = a[1] + (b[1] - a[1]) * f;
  out[o + 2] = a[2] + (b[2] - a[2]) * f;
}

// The population view's two channels, drawn into one texture: blue for people
// from office buildings, dark green for people from homes, alpha in proportion
// to each. Plain alpha over the basemap, with the larger of the two deciding
// the hue - screen blending washed both toward white where they met, which is
// exactly where the reader wants to be able to tell them apart.
export const OFFICE_HUE = [43, 91, 215]; // #2b5bd7
export const HOME_HUE = [31, 111, 63]; // #1f6f3f

/**
 * Paint one hour into an RGBA buffer.
 *
 * `hour` is fractional; the two bounding bins are interpolated, which is what
 * makes the timeline move rather than step. Nothing allocates: the buffer is
 * reused across frames.
 */
export function paint(channels, sidewalk, hour, max, view, rgba, width, height) {
  const { office, residential, cells } = channels;
  const h0 = Math.floor(hour) % HOURS;
  const h1 = (h0 + 1) % HOURS;
  const f = hour - Math.floor(hour);
  const b0 = h0 * cells;
  const b1 = h1 * cells;

  // The grid's row 0 is its SOUTH edge and an image's row 0 is its top, so the
  // write is flipped. Getting this wrong mirrors the whole heat map about the
  // district's waist, which reads as a plausible map of somewhere else.
  for (let c = 0; c < cells; c++) {
    const gx = c % width;
    const gy = (c / width) | 0;
    const o = ((height - 1 - gy) * width + gx) * 4;
    if (!sidewalk[c]) { rgba[o + 3] = 0; continue; }
    const O = office[b0 + c] + (office[b1 + c] - office[b0 + c]) * f;
    const R = residential[b0 + c] + (residential[b1 + c] - residential[b0 + c]) * f;

    if (view === 'population') {
      const to = Math.min(1, O / max);
      const tr = Math.min(1, R / max);
      const total = to + tr;
      if (total <= 0.002) { rgba[o + 3] = 0; continue; }
      const share = to / total;
      rgba[o] = OFFICE_HUE[0] * share + HOME_HUE[0] * (1 - share);
      rgba[o + 1] = OFFICE_HUE[1] * share + HOME_HUE[1] * (1 - share);
      rgba[o + 2] = OFFICE_HUE[2] * share + HOME_HUE[2] * (1 - share);
      rgba[o + 3] = Math.min(230, 255 * Math.min(1, total));
    } else {
      const t = (O + R) / max;
      if (t <= 0.002) { rgba[o + 3] = 0; continue; }
      activityColor(t, rgba, o);
      rgba[o + 3] = 200;
    }
  }
  return rgba;
}

/** The two totals the metrics strip reports, at the current hour. */
export function totalsAt(channels, hour) {
  const { office, residential, cells } = channels;
  const h0 = Math.floor(hour) % HOURS;
  const h1 = (h0 + 1) % HOURS;
  const f = hour - Math.floor(hour);
  let O = 0;
  let R = 0;
  for (let c = 0; c < cells; c++) {
    O += office[h0 * cells + c] + (office[h1 * cells + c] - office[h0 * cells + c]) * f;
    R += residential[h0 * cells + c]
       + (residential[h1 * cells + c] - residential[h0 * cells + c]) * f;
  }
  return { office: O, residential: R };
}
