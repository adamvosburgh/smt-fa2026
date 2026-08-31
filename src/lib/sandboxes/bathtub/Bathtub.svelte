<script>
  // Sandbox 07 - Bathtub.
  //
  // Reference implementation of the sandbox contract. Read this one before
  // building any of the others.
  //
  // The contract, in full:
  //   props in : params, assets, mode ('edit' | 'view'), dataBase
  //   props in : onmetrics(obj), onready(bool)  - supplied by SandboxFrame
  //   never    : this component does not touch window.__metrics or
  //              data-cover-ready itself. It reports; the frame publishes.
  //   always   : it must render from `dataBase` whether that points at the live
  //              API route or at static files. Nothing here knows which.
  //
  // The model is a threshold plus a connectivity test, and both halves are one
  // comparison because the pipeline precomputed a spill elevation per cell. The
  // GPU decides what is blue (FloodLayer); the CPU decides what the panel says
  // (metrics.js); both decode the same two PNGs with the same formula.
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  // MapLibre finds its tile-parsing worker with
  //   new Worker(new URL('./maplibre-gl-worker.mjs', import.meta.url))
  // which is only correct while maplibre-gl.mjs is being served from its own
  // dist folder. It never is: in dev Vite pre-bundles it into .vite/deps, in the
  // build Rollup hashes it into _app/immutable/chunks, and in both cases the
  // worker 404s. Nothing announces this. The style still loads, the attribution
  // still draws, and not one vector tile is ever parsed - a blank basemap under
  // a working overlay, with a clean 200 for the page. Hand maplibre a worker
  // Vite has actually emitted instead of letting it guess.
  import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

  let { params, assets = {}, mode = 'edit', dataBase, onmetrics, onready } = $props();

  let container = $state(null);
  let error = $state(null);
  let manifest = $state(null);
  let loading = $state('loading the ground heights…');

  let map, overlay, deck, grid, buildings, FloodLayer;
  let ready = false;
  let basemapFailed = $state(false);
  let tileFailures = $state(0);

  // Water height in metres NAVD88, the same datum the DEM is in - which is what
  // makes the comparison legal in the first place.
  const waterline = $derived.by(() => {
    if (!manifest) return 0;
    const tide = manifest.tideOffsetsM?.[params.tide] ?? 0;
    let slr = params.slr_m;
    if (params.link_year) {
      const yi = manifest.years?.indexOf(params.year) ?? -1;
      const curve = manifest.projections?.[String(params.percentile)];
      if (yi >= 0 && curve) slr = curve[yi];
    }
    return slr + params.surge_m + tide;
  });

  // Today's water, at the same tidal datum but with no rise and no surge.
  // Everything the sandbox reports is measured against this.
  const baseline = $derived(manifest ? (manifest.tideOffsetsM?.[params.tide] ?? 0) : 0);

  async function boot() {
    try {
      const [{ Map: MapLibre, setWorkerUrl }, { MapboxOverlay }, deckLayers, flood, metrics] =
        await Promise.all([
          import('maplibre-gl'),
          import('@deck.gl/mapbox'),
          import('@deck.gl/layers'),
          import('./FloodLayer.js'),
          import('./metrics.js')
        ]);
      FloodLayer = flood.default;
      // Before any Map is constructed - the worker pool is built on demand and
      // then reused for the life of the page.
      setWorkerUrl(maplibreWorkerUrl);

      // The manifest carries both the derived grid's shape and the published
      // constants (NPCC projections, Battery tidal datums) with their citations.
      const m = await (await fetch(`${dataBase}/manifest.json`)).json();
      manifest = m;

      await import('maplibre-gl/dist/maplibre-gl.css');

      const [west, south, east, north] = m.bounds3857;
      const R = 6378137;
      const toLngLat = (x, y) => [
        (x / R) * 180 / Math.PI,
        (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI
      ];
      const sw = toLngLat(west, south);
      const ne = toLngLat(east, north);

      map = new MapLibre({
        container,
        // Third-party tiles: this course is not about cartography, and a real
        // basemap makes the flood extent legible as a place rather than a blob.
        style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        bounds: [sw, ne],
        fitBoundsOptions: { padding: 10 },
        attributionControl: { compact: true },
        interactive: mode === 'edit'
      });
      // The basemap is context, not the model. If Carto is unreachable - a
      // blocked network, a dead CDN, a student on a train - the flood extent
      // must still draw. Fall back to a blank ground and carry on.
      // Only a failure of the STYLE ITSELF is fatal to the basemap. An
      // individual tile that 404s or times out must not trigger the fallback -
      // the previous version matched "Failed to fetch" anywhere, so one bad
      // tile blanked the whole map.
      let fellBack = false;
      map.on('error', (e) => {
        const msg = String(e?.error?.message ?? '');
        const url = String(e?.error?.url ?? e?.sourceId ?? '');
        const isTile = /\.(pbf|mvt|png|jpg|webp)(\?|$)/i.test(url);
        // A basemap that silently renders nothing is the worst outcome, so
        // count tile failures and say so rather than showing a blank field.
        if (isTile) tileFailures += 1;
        if (!fellBack && !isTile && /style/i.test(msg)) {
          fellBack = true;
          basemapFailed = true;
          try {
            map.setStyle({
              version: 8, sources: {}, glyphs: undefined,
              layers: [{ id: 'bg', type: 'background',
                         paint: { 'background-color': '#e9e9e6' } }]
            });
          } catch { /* nothing more to do */ }
        }
      });

      overlay = new MapboxOverlay({ interleaved: false, layers: [] });
      map.addControl(overlay);

      loading = 'reading the grid…';
      [grid, buildings] = await Promise.all([
        metrics.loadGrid(dataBase, m, 2),
        m.buildings ? metrics.loadBuildings(dataBase) : Promise.resolve(null)
      ]);
      deck = { metrics, layersModule: deckLayers, bounds: [sw[0], sw[1], ne[0], ne[1]] };

      loading = null;
      // Do not wait on the map's load event to draw. The overlay is independent
      // of the basemap, and a style that never loads must not hold up the model.
      render();
      map.on('load', () => { map.resize(); render(); });
      map.on('styledata', render);
      // The container is sized by CSS after the map is constructed, so MapLibre
      // can latch a stale size and render nothing.
      requestAnimationFrame(() => map.resize());
      new ResizeObserver(() => map.resize()).observe(container);
    } catch (err) {
      error = String(err?.message ?? err);
      onready?.(true); // never hang the cover pipeline on a data failure
    }
  }

  function render() {
    if (!overlay || !deck || !manifest) return;
    const L = waterline;

    overlay.setProps({
      layers: [
        new FloodLayer({
          id: 'flood',
          image: `${dataBase}/elev.png`,
          spillImage: `${dataBase}/spill.png`,
          // Nearest sampling is mandatory: the 16-bit value is split across two
          // 8-bit channels, and interpolating them separately is meaningless.
          textureParameters: {
            minFilter: 'nearest',
            magFilter: 'nearest',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge'
          },
          bounds: deck.bounds,
          gridWidth: manifest.grid.width,
          gridHeight: manifest.grid.height,
          waterline: L,
          baseline,
          connectivity: !!params.connectivity,
          showLine: params.flood_line !== false,
          showDepth: params.basemap !== 'flat',
          opacity: 1,
          pickable: false
        })
      ]
    });

    const m = deck.metrics.compute(grid, buildings, L, baseline, !!params.connectivity);
    onmetrics?.({
      'water height': `${L.toFixed(2)} m`,
      'land newly under water': `${m.areaKm2.toFixed(1)} km²`,
      'buildings on that land': m.buildings.toLocaleString(),
      'homes in those buildings': m.units.toLocaleString(),
      'people living there': m.people.toLocaleString(),
      'cut off from the sea': `${m.unreachableKm2.toFixed(1)} km²`
    });

    if (!ready) {
      ready = true;
      // One frame for the tiles and the texture upload to land, so the cover
      // screenshot is never taken of a half-drawn map.
      setTimeout(() => onready?.(true), 400);
    }
  }

  $effect(() => {
    if (browser && container && !map) boot();
  });

  $effect(() => {
    void [params.slr_m, params.surge_m, params.tide, params.percentile,
          params.year, params.link_year, params.connectivity, params.basemap,
          params.flood_line, manifest];
    if (map && deck) render();
  });

  onDestroy(() => {
    try { map?.remove(); } catch { /* already gone */ }
  });
</script>

<div class="wrap">
  <div class="map" bind:this={container}></div>

  {#if error}
    <p class="err">Couldn't load the data for this one: {error}</p>
  {:else if loading}
    <p class="loading">{loading}</p>
  {/if}

  {#if manifest}
    <div class="key">
      <span><i class="sw water"></i>under water, and dry today</span>
      {#if params.connectivity}
        <span><i class="sw unreachable"></i>below the waterline, but the sea can't reach it</span>
      {:else}
        <span class="warn">connectivity off - inland dips are flooding too</span>
      {/if}
      {#if params.flood_line !== false}
        <span><i class="sw line"></i>the flood line, found by the model</span>
      {/if}
      {#if basemapFailed}
        <span class="warn">no basemap - the flood model still works</span>
      {:else if tileFailures > 3}
        <span class="warn">{tileFailures} basemap tiles blocked - the flood model still works</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .wrap { position: absolute; inset: 0; }
  .map { position: absolute; inset: 0; }
  .loading, .err {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    font-size: 0.75rem; color: #888; background: rgba(255,255,255,0.9);
    padding: 0.4rem 0.7rem;
  }
  .err { color: #a00; max-width: 70%; text-align: center; }
  .key {
    position: absolute; left: 0.6rem; bottom: 0.6rem;
    display: flex; flex-direction: column; gap: 0.2rem;
    background: rgba(255,255,255,0.88); padding: 0.4rem 0.55rem;
    font-size: 0.62rem; line-height: 1.4; color: #444; pointer-events: none;
    max-width: 17rem;
  }
  .key span { display: flex; align-items: flex-start; gap: 0.35rem; }
  .sw { width: 9px; height: 9px; display: inline-block; flex: none; margin-top: 0.2em; }
  .water { background: rgba(30,80,140,0.75); }
  .unreachable { background: rgba(209,69,61,0.6); }
  .line { background: #0d1729; height: 2px; }
  .warn { color: #a00; font-weight: 700; }
</style>
