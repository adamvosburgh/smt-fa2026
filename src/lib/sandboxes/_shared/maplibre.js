// MapLibre + deck.gl bootstrap, shared by the map sandboxes.
//
// Extracted from Bathtub.svelte once a second sandbox needed it. Both of the
// fixes below cost a debugging session each, and both fail the same way: a
// clean 200 from the server and a dead or blank map in the browser, with
// nothing in the terminal. Do not re-derive them.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

export const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

/** Web Mercator meters to lng/lat, for manifests that carry EPSG:3857 bounds. */
export function toLngLat(x, y) {
  const R = 6378137;
  return [
    (x / R) * 180 / Math.PI,
    (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI
  ];
}

/**
 * Build a MapLibre map with a deck.gl overlay on top of it.
 *
 * Returns { map, overlay }. The caller sets layers on the overlay and never
 * waits for anything.
 *
 * FIX 1 - the worker.
 * MapLibre finds its tile-parsing worker with
 *   new Worker(new URL('./maplibre-gl-worker.mjs', import.meta.url))
 * which is only correct while maplibre-gl.mjs is served from its own dist
 * folder. It never is: in dev Vite pre-bundles it into .vite/deps, in the build
 * Rollup hashes it into _app/immutable/chunks, and in both cases the worker
 * 404s. Nothing announces it. The style loads, the attribution draws, and not
 * one vector tile is ever parsed - a blank basemap under a working overlay.
 * So hand MapLibre a worker Vite has actually emitted instead of letting it
 * guess. This must happen before any Map is constructed, because the worker
 * pool is built on demand and then reused for the life of the page.
 *
 * FIX 2 - never await `load`.
 * The deck.gl overlay is independent of the basemap. A style that never loads
 * must not hold up the model, so the caller draws immediately and redraws on
 * `load` and `styledata` rather than waiting for them.
 *
 * FIX 3 - resize.
 * The container is sized by CSS after the map is constructed, so MapLibre can
 * latch a stale size and render nothing at all.
 */
export async function createMap({
  container,
  bounds,
  interactive = true,
  padding = 10,
  style = BASEMAP_STYLE,
  onBasemapFail,
  onTileFail
}) {
  const [{ Map: MapLibre, setWorkerUrl }, { MapboxOverlay }] = await Promise.all([
    import('maplibre-gl'),
    import('@deck.gl/mapbox')
  ]);
  setWorkerUrl(maplibreWorkerUrl);
  await import('maplibre-gl/dist/maplibre-gl.css');

  const map = new MapLibre({
    container,
    // Third-party tiles: this course is not about cartography, and a real
    // basemap makes the result legible as a place rather than a blob.
    style,
    bounds,
    fitBoundsOptions: { padding },
    attributionControl: { compact: true },
    interactive
  });

  // The basemap is context, not the model. If Carto is unreachable - a blocked
  // network, a dead CDN, a student on a train - the model must still draw.
  //
  // Only a failure of the STYLE ITSELF is fatal to the basemap. An individual
  // tile that 404s or times out must not trigger the fallback: an earlier
  // version matched "Failed to fetch" anywhere, so one bad tile blanked the
  // whole map.
  let fellBack = false;
  let tileFailures = 0;
  map.on('error', (e) => {
    const msg = String(e?.error?.message ?? '');
    const url = String(e?.error?.url ?? e?.sourceId ?? '');
    const isTile = /\.(pbf|mvt|png|jpg|webp)(\?|$)/i.test(url);
    if (isTile) {
      tileFailures += 1;
      onTileFail?.(tileFailures);
      return;
    }
    if (!fellBack && /style/i.test(msg)) {
      fellBack = true;
      onBasemapFail?.();
      try {
        map.setStyle({
          version: 8,
          sources: {},
          glyphs: undefined,
          layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e9e9e6' } }]
        });
      } catch { /* nothing more to do */ }
    }
  });

  const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
  map.addControl(overlay);

  return { map, overlay };
}

/** Wire up the redraws and the resize handling. Call once, after the first draw. */
export function attachRedraw(map, container, render) {
  map.on('load', () => { map.resize(); render(); });
  map.on('styledata', render);
  requestAnimationFrame(() => map.resize());
  const ro = new ResizeObserver(() => map.resize());
  ro.observe(container);
  return () => ro.disconnect();
}
