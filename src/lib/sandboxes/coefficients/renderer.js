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

/**
 * Draw an n x n block of atlas tiles into a whole canvas, for the key.
 *
 * Zones are stored in the atlas the way the map lays them down: top-left tile
 * first, row by row. So a zone is drawn from its first tile and its size.
 */
export function drawTiles(ctx, atlas, first, n) {
  const { tileSize, perRow } = ATLAS;
  const s = ctx.canvas.width / n;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let i = 0; i < n * n; i++) {
    const v = first + i;
    ctx.drawImage(
      atlas,
      (v % perRow) * tileSize, Math.floor(v / perRow) * tileSize, tileSize, tileSize,
      (i % n) * s, Math.floor(i / n) * s, s, s
    );
  }
}

// A single ramp for every layer, so that two layers side by side are comparable
// and the eye is not asked to learn fifteen color schemes. Low is pale, high is
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

/**
 * Draw one block map as a translucent heat wash, for compositing OVER the
 * city. Every block map shares the city's 120x100 tile geometry, so washed
 * over the tiles at the same transform it shows which actual blocks sit in
 * the red - the thing neither a thumbnail nor a detached heatmap can show.
 *
 * Low values are transparent (the city shows through untinted), high values
 * saturate. The one signed map (rate of growth) diverges: blue below zero,
 * red above. Alpha, not lightness, carries the value, so the atlas stays
 * readable underneath.
 */
export function drawWash(ctx, blockMap, meta) {
  const w = blockMap.width;
  const h = blockMap.height;
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  const px = cw / w;
  const py = ch / h;
  const signed = meta.min < 0;
  const span = (meta.max - meta.min) || 1;

  ctx.clearRect(0, 0, cw, ch);
  for (let by = 0; by < h; by++) {
    for (let bx = 0; bx < w; bx++) {
      const v = blockMap.get(bx, by);
      if (signed) {
        const t = Math.max(-1, Math.min(1, v / Math.max(Math.abs(meta.min), meta.max)));
        if (Math.abs(t) < 0.05) continue;
        ctx.fillStyle = t > 0
          ? `rgba(180,45,30,${(0.45 * t).toFixed(3)})`
          : `rgba(35,70,160,${(-0.45 * t).toFixed(3)})`;
      } else {
        const t = Math.max(0, Math.min(1, (v - meta.min) / span));
        if (t < 0.05) continue;
        ctx.fillStyle = `rgba(180,45,30,${(0.45 * t).toFixed(3)})`;
      }
      ctx.fillRect(Math.floor(bx * px), Math.floor(by * py), Math.ceil(px), Math.ceil(py));
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
