// Reading the numbers back off the same data the shader draws.
//
// The GPU decides what is blue. These functions decide what the panel says, and
// they have to agree with it, so they decode the identical PNGs with the
// identical formula rather than keeping a second copy of the truth.
//
// Everything here is a threshold comparison over a typed array. There is no
// table of precomputed answers per waterline step, which is why the sliders are
// continuous instead of snapping.

const R = 6378137.0;

export function mercator(lon, lat) {
  return [
    R * (lon * Math.PI) / 180,
    R * Math.log(Math.tan(Math.PI / 4 + ((lat * Math.PI) / 180) / 2))
  ];
}

/**
 * Decode a packed 16-bit PNG into a Uint16Array, optionally at a stride.
 *
 * Downscaling happens in the draw call with smoothing OFF, so it is a
 * nearest-neighbour pick of real cells. Any interpolation would blend the high
 * and low bytes of neighbouring values and produce elevations that exist
 * nowhere on earth.
 */
async function decodePacked(url, stride = 1) {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob());
  const w = Math.max(1, Math.floor(bitmap.width / stride));
  const h = Math.max(1, Math.floor(bitmap.height / stride));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  bitmap.close();

  const out = new Uint16Array(w * h);
  // Blue carries the existing-water mask on elev.png; unused elsewhere.
  const water = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = data[p] * 256 + data[p + 1];
    water[i] = data[p + 2] > 127 ? 1 : 0;
  }
  return { values: out, water, width: w, height: h };
}

export async function loadGrid(base, manifest, stride = 2) {
  const [elev, spill, tract] = await Promise.all([
    decodePacked(`${base}/elev.png`, stride),
    decodePacked(`${base}/spill.png`, stride),
    decodePacked(`${base}/tractid.png`, stride)
  ]);

  const tracts = await (await fetch(`${base}/tracts.json`)).json();
  // Index i of tracts.json is stored as i + 1 in the raster; 0 means no tract.
  const pop = new Float64Array(tracts.features.length + 1);
  tracts.features.forEach((f, i) => (pop[i + 1] = f.properties.pop || 0));

  // Cells per tract, so a partly flooded tract contributes its population in
  // proportion to the share of its area under water. This is the honest join:
  // population is a tract-level figure and stays one.
  const cellsPerTract = new Float64Array(pop.length);
  for (let i = 0; i < tract.values.length; i++) cellsPerTract[tract.values[i]]++;

  // Cell area. The grid is EPSG:3857, where a metre of map is not a metre of
  // ground; scale by cos(latitude) to get true area.
  const [west, south, east, north] = manifest.bounds3857;
  const midY = (south + north) / 2;
  const lat = (2 * Math.atan(Math.exp(midY / R)) - Math.PI / 2);
  const cellW = ((east - west) / elev.width) * Math.cos(lat);
  const cellH = ((north - south) / elev.height) * Math.cos(lat);
  const cellAreaKm2 = (cellW * cellH) / 1e6;

  return { elev, spill, tract, pop, cellsPerTract, cellAreaKm2,
           bounds: manifest.bounds3857, stride };
}

export async function loadBuildings(base) {
  const buf = await (await fetch(`${base}/buildings.bin`)).arrayBuffer();
  const a = new Float32Array(buf);
  return { array: a, count: a.length / 5 };
}

const toM = (v) => (v - 1000) / 10;

export function compute(grid, buildings, waterline, baseline, connectivity) {
  const { elev, spill, tract, pop, cellsPerTract, cellAreaKm2 } = grid;
  const src = connectivity ? spill.values : elev.values;
  const e = elev.values;
  const s = spill.values;
  const t = tract.values;
  const threshold = Math.round(waterline * 10) + 1000;
  // Existing water is two facts, and the shader reads both the same way.
  //   the stored mask - written into the blue channel by the pipeline, because
  //   3DEP hydro-flattens each water body to its own constant and no single
  //   threshold finds them all.
  //   below today's water - ground against the baseline, so "newly flooded"
  //   means newly. Ground, not spill: connectivity says where water will spread
  //   to, not where it already is, and the Jamaica Bay lagoons sit at 0.0m
  //   behind a 1.2m spill because their channels are thinner than a cell.
  const baseThreshold = Math.round(baseline * 10) + 1000;
  const isSea = elev.water;

  let wetCells = 0;
  let unreachableCells = 0;
  const wetPerTract = new Float64Array(pop.length);

  for (let i = 0; i < src.length; i++) {
    if (e[i] < 10) continue;             // sentinel: outside DEM coverage
    if (isSea[i] || e[i] <= baseThreshold) continue;     // wet already today
    const isWet = src[i] <= threshold;
    if (isWet) {
      wetCells++;
      wetPerTract[t[i]]++;
    } else if (e[i] <= threshold) {
      unreachableCells++;                // naive floods it; water cannot reach
    }
  }

  let people = 0;
  for (let k = 1; k < pop.length; k++) {
    if (wetPerTract[k] && cellsPerTract[k]) {
      people += pop[k] * (wetPerTract[k] / cellsPerTract[k]);
    }
  }

  // Buildings are decided by their own recorded ground elevation, not by the
  // grid - a 20m cell is wider than many row-house lots. Connectivity still
  // comes from the grid, since reachability is a property of the terrain.
  let wetBuildings = 0;
  let units = 0;
  if (buildings) {
    const { array, count } = buildings;
    const [west, south, east, north] = grid.bounds;
    const gw = elev.width, gh = elev.height;
    for (let b = 0; b < count; b++) {
      const o = b * 5;
      const ground = array[o + 2];
      if (ground > waterline) continue;
      if (connectivity) {
        const [mx, my] = mercator(array[o], array[o + 1]);
        const gx = Math.floor(((mx - west) / (east - west)) * gw);
        const gy = Math.floor(((north - my) / (north - south)) * gh);
        if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) continue;
        if (toM(s[gy * gw + gx]) > waterline) continue;
      }
      wetBuildings++;
      units += array[o + 4];
    }
  }

  return {
    waterline,
    areaKm2: wetCells * cellAreaKm2,
    unreachableKm2: unreachableCells * cellAreaKm2,
    buildings: wetBuildings,
    units: Math.round(units),
    people: Math.round(people)
  };
}
