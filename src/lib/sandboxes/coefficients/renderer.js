// Drawing. Canvas 2D only - no deck.gl, no three.js.
//
// This sandbox is deliberately the cheapest in the set and the only 2D one. The
// argument it makes is about arithmetic, and the pictures it needs are a tile
// grid and fifteen small heatmaps.

/** Atlas geometry, from vendor/src/tileSet.js. A replacement must match it. */
export const ATLAS = { tileSize: 16, perRow: 32, count: 1024, side: 512 };

/**
 * Load the tile atlas by URL.
 *
 * By URL, not by import, so that a submitted `tiles.png` replaces it with no
 * code change: same rules, different world, and a student who will not touch
 * JavaScript has still made an arguable submission.
 */
export function loadAtlas(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.width !== ATLAS.side || img.height !== ATLAS.side) {
        reject(new Error(
          `tile atlas must be ${ATLAS.side}x${ATLAS.side} (${ATLAS.perRow} tiles ` +
          `of ${ATLAS.tileSize}px across); this one is ${img.width}x${img.height}`));
        return;
      }
      resolve(img);
    };
    img.onerror = () => reject(new Error(`could not load tile atlas: ${url}`));
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

/**
 * Draw the city.
 *
 * Tiles are blitted at `scale` pixels rather than the atlas's own 16, because a
 * 120x100 map at full size is 1920x1600 and the viewport is not.
 */
export function drawCity(ctx, map, atlas, scale) {
  const { tileSize, perRow } = ATLAS;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const v = map.getTile(x, y).getValue();
      if (v < 0 || v >= ATLAS.count) continue;
      ctx.drawImage(
        atlas,
        (v % perRow) * tileSize, Math.floor(v / perRow) * tileSize, tileSize, tileSize,
        x * scale, y * scale, scale, scale
      );
    }
  }
}

// A single ramp for every layer, so that two layers side by side are comparable
// and the eye is not asked to learn fifteen colour schemes. Low is pale, high is
// dark; the one diverging case (rate of growth, which is signed) is handled by
// normalising against its own min and max, which are known constants.
function ramp(t) {
  const u = Math.max(0, Math.min(1, t));
  const r = Math.round(250 - 210 * u);
  const g = Math.round(248 - 200 * u);
  const b = Math.round(240 - 120 * u);
  return `rgb(${r},${g},${b})`;
}

/**
 * Draw one block map into its own small canvas.
 *
 * Block maps are COARSER THAN THE TILE MAP - a block is 2, 4 or 8 tiles across
 * depending on the map - and that is drawn honestly here rather than smoothed
 * away. The chunkiness is the resolution the simulation actually thinks at.
 */
export function drawBlockMap(ctx, blockMap, meta) {
  const w = blockMap.width;
  const h = blockMap.height;
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  const px = cw / w;
  const py = ch / h;
  const span = (meta.max - meta.min) || 1;

  ctx.clearRect(0, 0, cw, ch);
  for (let by = 0; by < h; by++) {
    for (let bx = 0; bx < w; bx++) {
      const v = blockMap.get(bx, by);
      ctx.fillStyle = ramp((v - meta.min) / span);
      ctx.fillRect(Math.floor(bx * px), Math.floor(by * py),
                   Math.ceil(px), Math.ceil(py));
    }
  }
}

/** Highest value currently in a block map, for the readout beside its name. */
export function peak(blockMap) {
  let m = -Infinity;
  for (let by = 0; by < blockMap.height; by++) {
    for (let bx = 0; bx < blockMap.width; bx++) {
      const v = blockMap.get(bx, by);
      if (v > m) m = v;
    }
  }
  return Number.isFinite(m) ? m : 0;
}

/**
 * The divergence chart: mean and range of one metric across seeded runs.
 *
 * The argument it makes is that the rules are deterministic and the outcomes
 * are not, which is the thing students most often have backwards about
 * emergence. Every run below used identical rules and an identical starting
 * city, and differed only in the seed.
 */
export function drawDivergence(ctx, runs, key, label) {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  ctx.clearRect(0, 0, cw, ch);
  if (!runs?.length) return;

  const pad = { l: 34, r: 6, t: 8, b: 18 };
  const n = runs[0].length;
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of runs) for (const p of r) {
    if (p[key] < lo) lo = p[key];
    if (p[key] > hi) hi = p[key];
  }
  if (!Number.isFinite(lo)) return;
  if (hi === lo) { hi = lo + 1; }

  const X = (i) => pad.l + (cw - pad.l - pad.r) * (i / Math.max(1, n - 1));
  const Y = (v) => ch - pad.b - (ch - pad.t - pad.b) * ((v - lo) / (hi - lo));

  // The band between the lowest and highest run at each sample.
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const v = Math.max(...runs.map((r) => r[i]?.[key] ?? 0));
    i === 0 ? ctx.moveTo(X(i), Y(v)) : ctx.lineTo(X(i), Y(v));
  }
  for (let i = n - 1; i >= 0; i--) {
    const v = Math.min(...runs.map((r) => r[i]?.[key] ?? 0));
    ctx.lineTo(X(i), Y(v));
  }
  ctx.closePath();
  ctx.fill();

  // Each individual run, faint.
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  for (const r of runs) {
    ctx.beginPath();
    r.forEach((p, i) => (i === 0 ? ctx.moveTo(X(i), Y(p[key])) : ctx.lineTo(X(i), Y(p[key]))));
    ctx.stroke();
  }

  // The mean, solid.
  ctx.lineWidth = 1.75;
  ctx.strokeStyle = '#000';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const v = runs.reduce((a, r) => a + (r[i]?.[key] ?? 0), 0) / runs.length;
    i === 0 ? ctx.moveTo(X(i), Y(v)) : ctx.lineTo(X(i), Y(v));
  }
  ctx.stroke();

  ctx.fillStyle = '#888';
  ctx.font = '9px ui-monospace, monospace';
  ctx.fillText(String(Math.round(hi)), 2, pad.t + 7);
  ctx.fillText(String(Math.round(lo)), 2, ch - pad.b);
  ctx.fillText(label, pad.l, ch - 5);
}
