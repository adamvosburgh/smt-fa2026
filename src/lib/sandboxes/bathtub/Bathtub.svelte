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
  //
  // FOUR PROJECTIONS, NOT ONE. The NPCC publishes its sea level rise as four
  // percentiles with no median, so there is no middle number to draw. This
  // sandbox draws all four as lines and lets the reader choose the storm
  // instead. In the all-storms view it draws every storm and every percentile
  // at once: four fills and sixteen lines.
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  // The MapLibre worker fix and the never-await-`load` fix both live in
  // _shared/maplibre.js now that a second sandbox needs them. Read the comments
  // there before changing anything about how this map is constructed.
  import { createMap, attachRedraw, toLngLat } from '../_shared/maplibre.js';

  let { params, assets = {}, mode = 'edit', dataBase, onmetrics, onready } = $props();

  let container = $state(null);
  let error = $state(null);
  let manifest = $state(null);
  let loading = $state('loading the ground heights…');

  let map, overlay, deck, grid, buildings, FloodLayer, detachRedraw;
  let ready = false;
  let basemapFailed = $state(false);
  let tileFailures = $state(0);
  // How long the CPU passes take, one per waterline. Read by the dev note
  // rather than assumed: the doc allowed for a worker if five runs went over
  // 100 ms, and whether they do is a measurement.
  let metricsMs = $state(0);

  // Return periods as the labels say them. 1/0.99 is 1.01 years, 1/0.50 is 2,
  // 1/0.10 is 10, 1/0.01 is 100.
  const AEP_RETURN = { '99': '1-year', '50': '2-year', '10': '10-year', '1': '100-year' };
  // Largest storm first, which is also the order the fills are drawn in: a cell
  // takes the color of the last (smallest) fill it is under.
  const ALL_STORMS = ['1', '10', '50', '99'];
  const PERCENTILES = [10, 25, 75, 90];

  // All-storms fills, matched to ALL_STORMS. Lightest and largest first.
  const STORM_FILL = {
    '1': [0.776, 0.859, 0.937], // #c6dbef, 100-year
    '10': [0.42, 0.62, 0.839], // #6baed6, 10-year
    '50': [0.129, 0.443, 0.71], // #2171b5, 2-year
    '99': [0.031, 0.188, 0.42] // #08306b, 1-year
  };
  // One hue for the percentile lines in the one-storm view. Four opacities,
  // 10th lightest to 90th darkest; opacity reads on this basemap where four
  // line weights did not.
  const PERCENTILE_HUE = [0.043, 0.184, 0.42]; // #0b2f6b
  const PERCENTILE_ALPHAS = [0.4, 0.6, 0.8, 1];
  // The one-storm fill's own color, before depth shading replaces it.
  const ONE_STORM_FILL = [0.36, 0.6, 0.75, 0.72];

  const allStorms = $derived(params.view === 'all');

  const aepM = $derived(
    manifest && !params.surge_by_hand && params.aep && params.aep !== 'none'
      ? (manifest.exceedanceM?.[params.aep] ?? null)
      : null
  );

  // The water the chosen storm puts on the ground TODAY, in meters NAVD88 - the
  // same datum the DEM is in, which is what makes the comparison legal. A storm
  // level already contains a high tide, so it replaces the tide offset rather
  // than being added to it; adding the two would count the tide twice.
  function stormLevel(aep) {
    if (!manifest) return 0;
    if (aep && aep !== 'none') return manifest.exceedanceM?.[aep] ?? 0;
    const surge = params.surge_by_hand ? (params.surge_m ?? 0) : 0;
    return surge + (manifest.tideOffsetsM?.[params.tide] ?? 0);
  }

  // The NPCC's rise for one percentile at the chosen horizon, or the by-hand
  // figure, in which case the four lines are one line.
  function rise(p) {
    if (params.slr_by_hand) return params.slr_m ?? 0;
    if (!manifest) return 0;
    const yi = manifest.years?.indexOf(params.year) ?? -1;
    const curve = manifest.projections?.[String(p)];
    return yi >= 0 && curve ? curve[yi] : 0;
  }

  // The rises to draw. By hand there is one number, so one line rather than
  // four coincident ones.
  const risesShown = $derived(
    params.slr_by_hand ? [params.slr_m ?? 0] : PERCENTILES.map(rise)
  );

  // Today's water, at the same tidal datum but with no rise and no storm.
  // Everything the sandbox reports is measured against this. Under an
  // exceedance level the tide control is not driving the waterline, so the
  // comparison is made against today's average daily high tide - the tide the
  // level itself was measured at.
  const baseline = $derived.by(() => {
    if (!manifest) return 0;
    const t = aepM !== null ? 'mhhw' : params.tide;
    return manifest.tideOffsetsM?.[t] ?? 0;
  });

  // What the shader is asked to draw, worked out here so the legend and the
  // metrics table read the same list the GPU does.
  const drawing = $derived.by(() => {
    if (!manifest) return { fills: [], fillColors: [], lines: [], lineHues: [], rows: [] };
    if (allStorms) {
      const fills = ALL_STORMS.map((s) => stormLevel(s));
      return {
        fills,
        fillColors: ALL_STORMS.map((s) => [...STORM_FILL[s], 0.7]),
        lines: ALL_STORMS.map((s) => padTo4(risesShown.map((r) => stormLevel(s) + r))),
        lineHues: ALL_STORMS.map((s) => STORM_FILL[s]),
        // One row per storm, at today's sea level.
        rows: ALL_STORMS.map((s, i) => ({ label: AEP_RETURN[s], level: fills[i] }))
      };
    }
    const fill = stormLevel(params.aep);
    return {
      fills: [fill],
      fillColors: [ONE_STORM_FILL],
      lines: [padTo4(risesShown.map((r) => fill + r))],
      lineHues: [PERCENTILE_HUE],
      rows: [
        { label: 'today', level: fill },
        ...risesShown.map((r, i) => ({
          label: params.slr_by_hand ? 'by hand' : `${PERCENTILES[i]}th`,
          level: fill + r
        }))
      ]
    };
  });

  // The shader reads four levels per storm whatever the view. One by-hand rise
  // means one distinct line; repeating it fills the vec4 without drawing a
  // second edge anywhere.
  function padTo4(levels) {
    const out = levels.slice(0, 4);
    while (out.length < 4) out.push(levels[levels.length - 1] ?? 0);
    return out;
  }

  async function boot() {
    try {
      const [deckLayers, flood, metrics] = await Promise.all([
        import('@deck.gl/layers'),
        import('./FloodLayer.js'),
        import('./metrics.js')
      ]);
      FloodLayer = flood.default;

      // The manifest carries both the derived grid's shape and the published
      // constants (NPCC projections, Battery tidal datums) with their citations.
      const m = await (await fetch(`${dataBase}/manifest.json`)).json();
      manifest = m;

      const [west, south, east, north] = m.bounds3857;
      const sw = toLngLat(west, south);
      const ne = toLngLat(east, north);

      ({ map, overlay } = await createMap({
        container,
        bounds: [sw, ne],
        interactive: mode === 'edit',
        onBasemapFail: () => { basemapFailed = true; },
        onTileFail: (n) => { tileFailures = n; }
      }));

      loading = 'reading the grid…';
      [grid, buildings] = await Promise.all([
        metrics.loadGrid(dataBase, m, 2),
        m.buildings ? metrics.loadBuildings(dataBase) : Promise.resolve(null)
      ]);
      deck = { metrics, layersModule: deckLayers, bounds: [sw[0], sw[1], ne[0], ne[1]] };

      loading = null;
      // Draw before the basemap has loaded, never after - see _shared/maplibre.js.
      render();
      detachRedraw = attachRedraw(map, container, render);
    } catch (err) {
      error = String(err?.message ?? err);
      onready?.(true); // never hang the cover pipeline on a data failure
    }
  }

  const METRIC_COLUMNS = [
    'water height (m NAVD88)',
    'land newly under water',
    'buildings on that land',
    'homes in those buildings',
    'people in the tracts it covers',
    'land that floods only without connectivity'
  ];

  function render() {
    if (!overlay || !deck || !manifest) return;
    const d = drawing;

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
          fills: d.fills,
          fillColors: d.fillColors,
          lines: d.lines,
          lineHues: d.lineHues,
          lineAlphas: PERCENTILE_ALPHAS,
          baseline,
          connectivity: !!params.connectivity,
          showLine: params.flood_line !== false,
          // Four fills cannot each carry a depth, so the all-storms view is flat.
          showDepth: !allStorms && params.basemap !== 'flat',
          opacity: 1,
          pickable: false
        })
      ]
    });

    // One CPU pass per waterline: five rows in the one-storm view, four in the
    // all-storms one. Measured on the shipped grid at stride 2 (2.2 million
    // cells) it is about 9 ms a row on this machine, so five runs stay well
    // inside a frame and no worker is needed - the figure is in the dev note.
    const t0 = performance.now();
    const rows = d.rows.map((r) => {
      const m = deck.metrics.compute(grid, buildings, r.level, baseline, !!params.connectivity);
      return {
        label: r.label,
        values: [
          `${r.level.toFixed(2)} m`,
          `${m.areaKm2.toFixed(1)} km²`,
          m.buildings.toLocaleString(),
          m.units.toLocaleString(),
          m.people.toLocaleString(),
          `${m.unreachableKm2.toFixed(1)} km²`
        ],
        raw: m
      };
    });

    metricsMs = performance.now() - t0;

    // The doctor's stage 2 compares numbers by key, so the first row is also
    // flattened into top-level keys with the names it has always had.
    const first = rows[0];
    onmetrics?.({
      columns: METRIC_COLUMNS,
      rows: rows.map(({ label, values }) => ({ label, values })),
      'water height': first.values[0],
      'land newly under water': first.values[1],
      'buildings on that land': first.values[2],
      'homes in those buildings': first.values[3],
      'people living there': first.values[4],
      'cut off from the sea': first.values[5]
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
    void [params.view, params.aep, params.basemap, params.flood_line, params.year,
          params.tide, params.connectivity, params.slr_by_hand, params.slr_m,
          params.surge_by_hand, params.surge_m, manifest];
    if (map && deck) render();
  });

  onDestroy(() => {
    try { detachRedraw?.(); } catch { /* never attached */ }
    try { map?.remove(); } catch { /* already gone */ }
  });

  const rgb = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
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
      {#if allStorms}
        {#each ALL_STORMS as s (s)}
          <span class="storm">
            <i class="sw" style="background:{rgb(STORM_FILL[s])}"></i>{AEP_RETURN[s]}
            <span class="shades">
              {#each PERCENTILE_ALPHAS as a, i (i)}
                <i
                  class="sw line"
                  style="background:{rgb(STORM_FILL[s])}; opacity:{a}"
                  title="{PERCENTILES[i]}th percentile"
                ></i>
              {/each}
            </span>
          </span>
        {/each}
        <span class="note">10th, 25th, 75th, 90th under each storm.</span>
      {:else}
        <span>
          <i class="sw water"></i>{aepM !== null
            ? `the ${AEP_RETURN[params.aep]} storm`
            : 'today’s high tide'}, today's sea level
        </span>
        {#each risesShown as _, i (i)}
          <span>
            <i class="sw line" style="background:{rgb(PERCENTILE_HUE)}; opacity:{PERCENTILE_ALPHAS[i]}"></i>
            {params.slr_by_hand
              ? `${(params.slr_m ?? 0).toFixed(2)} m by hand`
              : `${PERCENTILES[i]}th percentile, ${params.year}`}
          </span>
        {/each}
        {#if params.connectivity}
          <span><i class="sw unreachable"></i>floods only without connectivity</span>
        {:else}
          <span class="warn">connectivity off - inland dips are flooding too</span>
        {/if}
      {/if}

      <span class="note">
        Percentiles are the spread of the panel's projections: 90 percent of them fall below the
        90th percentile line.
      </span>

      {#if mode === 'edit' && metricsMs > 0}
        <span class="note">{drawing.rows.length} waterlines counted in {metricsMs.toFixed(0)}ms</span>
      {/if}
      {#if basemapFailed}
        <span class="warn">no basemap - the model still works</span>
      {:else if tileFailures > 3}
        <span class="warn">{tileFailures} basemap tiles blocked - the model still works</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .wrap { position: absolute; inset: 0; }
  .map { position: absolute; inset: 0; }
  /* Above the deck.gl canvas, which rides in MapLibre's control container at
     z-index 2 - an overlay without its own z-index paints under the model. */
  .loading, .err {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    font-size: 0.75rem; color: #888; background: rgba(255,255,255,0.9);
    padding: 0.4rem 0.7rem; z-index: 5;
  }
  .err { color: #a00; max-width: 70%; text-align: center; }
  /* Bottom left: the top corners and the bottom center belong to the floating
     panels, so the legend takes the one corner nothing else claims. */
  .key {
    position: absolute; left: 0.6rem; bottom: 0.6rem; z-index: 5;
    display: flex; flex-direction: column; gap: 0.2rem;
    background: rgba(255,255,255,0.88); padding: 0.4rem 0.55rem;
    font-size: 0.62rem; line-height: 1.4; color: #444; pointer-events: none;
    max-width: 17rem;
  }
  .key span { display: flex; align-items: flex-start; gap: 0.35rem; }
  .sw { width: 9px; height: 9px; display: inline-block; flex: none; margin-top: 0.2em; }
  .water { background: rgba(30,80,140,0.75); }
  .unreachable { background: rgba(209,69,61,0.6); }
  .line { height: 2px; margin-top: 0.45em; }
  .shades { display: flex; gap: 2px; margin-left: auto; }
  .warn { color: #a00; font-weight: 700; }
  .note { color: #222; display: block; }
</style>
