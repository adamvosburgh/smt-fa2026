<script>
  // Sandbox 01 - ADU Forecast for Queens (slug pencil).
  //
  // Every one-to-two-family lot in Queens, run through three tests taken from
  // the published rules and numbers of one real subsidy program: whether a unit
  // is allowed on the lot, whether there is room for one, and whether the loan
  // and the rent would work for the owner. A lot that passes all three counts
  // as one added home. There is no time in it; the count is an upper bound and
  // the card says so.
  //
  // The contract, as bathtub sets it out:
  //   props in : params, assets, mode ('edit' | 'view'), dataBase
  //   props in : onmetrics(obj), onready(bool)  - supplied by SandboxFrame
  //              This component never touches window.__metrics or
  //              data-cover-ready. It reports; the frame publishes.
  //
  // The arithmetic is in proforma.js and runs on every parameter change over
  // 246,921 lots. The SAME pass produces the color array and the panel's
  // numbers, so the picture and the figures cannot disagree.
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { createMap, attachRedraw } from '../_shared/maplibre.js';
  import {
    compute, lotColors, volumeColor, siteUnit,
    STRIDE, RSTRIDE, COL, TESTS, FAIL_COLOR, TRACT_RAMP,
    quantileBreaks, rampIndex
  } from './proforma.js';

  let { params, assets = {}, mode = 'edit', dataBase, onmetrics, onready } = $props();

  let container = $state(null);
  let stageEl = $state(null);
  let error = $state(null);
  let loading = $state('reading the lots…');
  let manifest = $state(null);
  let basemapFailed = $state(false);
  let tileFailures = $state(0);
  let lastPassMs = $state(0);
  let zoom = $state(0);
  let stats = $state(null);
  let hover = $state(null);
  let tractLegend = $state(null);
  let noTractShapes = $state(false);

  // A lot mark scales with zoom: 2px at borough extent, 6px at block scale.
  // deck.gl gives that directly as a pixel radius clamped at both ends, which
  // is also what keeps a quarter of a million sub-pixel marks from turning
  // into moire at borough zoom.
  const LOT_MIN_PX = 2;
  const LOT_MAX_PX = 6;

  // THE HEIGHT IS THE RULE'S, NOT A GUESS AND NOT AN EXAGGERATION.
  // ZR 23-341(b)(4) limits an ancillary unit beside a detached, zero lot line or
  // semi-detached house to "one story, not to exceed 15 feet". The volumes are
  // drawn at that 15 feet. Nothing in the model computes a height, so drawing
  // the published ceiling is the only figure available that is anybody's.
  const ADU_HEIGHT_M = 15 * 0.3048;

  let map, overlay, detachRedraw;
  let SolidPolygonLayer, ScatterplotLayer, GeoJsonLayer;
  let lots, rear, flags, result;
  let tracts = null, tractShapes = null, queens = null;
  let ready = false;
  let pending = 0;

  const isTracts = $derived(params.view === 'tracts');
  const isLots = $derived(params.view === 'lots');
  const isVolumes = $derived(params.view === 'volumes');
  const currentTest = $derived(TESTS.find((t) => t.key === params.test) ?? TESTS[2]);

  async function boot() {
    try {
      const [deckLayers, m] = await Promise.all([
        import('@deck.gl/layers'),
        fetch(`${dataBase}/manifest.json`).then((r) => r.json())
      ]);
      SolidPolygonLayer = deckLayers.SolidPolygonLayer;
      ScatterplotLayer = deckLayers.ScatterplotLayer;
      GeoJsonLayer = deckLayers.GeoJsonLayer;
      manifest = m;

      loading = 'reading 247,000 lots…';
      const [lotsBuf, rearBuf, flagsBuf, tractsJson, shapesRes, queensRes] = await Promise.all([
        fetch(`${dataBase}/lots.bin`).then((r) => r.arrayBuffer()),
        fetch(`${dataBase}/rear.bin`).then((r) => r.arrayBuffer()),
        fetch(`${dataBase}/flags.bin`).then((r) => r.arrayBuffer()),
        fetch(`${dataBase}/tracts.json`).then((r) => r.json()),
        fetch(`${dataBase}/tract_shapes.json`),
        fetch(`${dataBase}/queens.json`)
      ]);
      lots = new Float32Array(lotsBuf);
      rear = new Int16Array(rearBuf);
      flags = new Uint8Array(flagsBuf);
      tracts = tractsJson.tracts;
      // Both are pipeline outputs that can legitimately be missing on a tree
      // where only part of the pipeline has been re-run. The map says so
      // rather than failing.
      tractShapes = shapesRes.ok ? await shapesRes.json() : null;
      queens = queensRes.ok ? await queensRes.json() : null;
      noTractShapes = !tractShapes;

      if (lots.length !== flags.length * STRIDE || rear.length !== flags.length * RSTRIDE) {
        throw new Error(
          `lots.bin, rear.bin and flags.bin disagree: ${lots.length / STRIDE} / ` +
          `${rear.length / RSTRIDE} rows against ${flags.length}. ` +
          `Re-run data/scripts/pencil.py.`);
      }
      // geoid -> index into tracts, so a tract polygon can find its numbers.
      tractByGeoid = new Map(tracts.map((t, i) => [t.geoid, i]));

      const [w, s, e, n] = m.bounds;
      ({ map, overlay } = await createMap({
        container,
        // Queens with 5% padding.
        bounds: [[w - (e - w) * 0.05, s - (n - s) * 0.05],
                 [e + (e - w) * 0.05, n + (n - s) * 0.05]],
        interactive: mode === 'edit',
        onBasemapFail: () => { basemapFailed = true; },
        onTileFail: (k) => { tileFailures = k; }
      }));

      loading = null;
      render();
      detachRedraw = attachRedraw(map, container, render);
      zoom = map.getZoom();
      map.on('zoom', () => { zoom = map.getZoom(); });
    } catch (err) {
      error = String(err?.message ?? err);
      onready?.(true); // never hang the cover pipeline on a data failure
    }
  }

  let tractByGeoid = new Map();

  // ---- the tract choropleth ---------------------------------------------
  //
  // Value per tract: the number of lots in it that pass all three tests, or
  // that count divided by the homes the tract already has (MapPLUTO UnitsRes
  // over every lot in it, all building classes, summed once in the pipeline).
  // Breaks are quantiles over the CURRENT values, because every assumption
  // slider moves the whole distribution and fixed breaks would leave the map
  // looking unchanged while the numbers under it moved.
  function tractValues() {
    const added = new Float64Array(tracts.length);
    for (const [idx, count] of result.perTract) {
      if (idx >= 0 && idx < tracts.length) added[idx] = count;
    }
    const values = new Float64Array(tracts.length);
    for (let i = 0; i < tracts.length; i++) {
      if (params.tract_measure === 'share') {
        const existing = tracts[i].units_res ?? 0;
        values[i] = existing > 0 ? added[i] / existing : 0;
      } else {
        values[i] = added[i];
      }
    }
    return { added, values };
  }

  function render() {
    if (!overlay || !manifest || !lots) return;

    const t0 = performance.now();
    result = compute(lots, rear, flags, manifest, params);
    lastPassMs = performance.now() - t0;

    // The 3D view is the only one worth tilting for. Volumes seen from
    // directly overhead are squares.
    const wantPitch = isVolumes ? 45 : 0;
    if (map && Math.abs(map.getPitch() - wantPitch) > 1) {
      try { map.easeTo({ pitch: wantPitch, duration: 400 }); } catch { /* not ready */ }
    }

    const layers = [];

    // THE MASK, NOT A CROP. The basemap is the whole metro; a white polygon at
    // 75% opacity covers it with Queens cut out, so the borough reads at full
    // strength and everything around it at a quarter. A crop hid where Queens
    // is, which is half of what a map of one borough is for.
    if (queens) {
      const P = 8; // past the horizon even in the tilted 3D view
      const [bw, bs, be, bn] = manifest.bounds;
      const outer = [[bw - P, bs - P], [be + P, bs - P], [be + P, bn + P], [bw - P, bn + P]];
      // Every ring of the borough becomes a hole. deck.gl takes one polygon as
      // [outer, ...holes], so the multipolygon flattens into the hole list.
      const holes = queens.geometry.coordinates.flatMap((poly) => [poly[0]]);
      layers.push(new SolidPolygonLayer({
        id: 'outside-queens',
        data: [{ p: [outer, ...holes] }],
        getPolygon: (d) => d.p,
        filled: true,
        pickable: false,
        material: false, // unlit, or the tilted view shades it like a surface
        getFillColor: [255, 255, 255, 191] // 75%
      }));
    }

    if (isTracts && tractShapes) {
      const { added, values } = tractValues();
      const breaks = quantileBreaks([...values]);
      const max = values.reduce((a, b) => (b > a ? b : a), 0);
      tractLegend = { breaks, max, measure: params.tract_measure };
      layers.push(new GeoJsonLayer({
        id: 'tracts',
        data: tractShapes,
        stroked: true,
        filled: true,
        pickable: mode === 'edit',
        getLineColor: [255, 255, 255, 60],
        lineWidthMinPixels: 0.5,
        getFillColor: (f) => {
          const i = tractByGeoid.get(f.properties.geoid);
          const v = i === undefined ? 0 : values[i];
          // A tract with nothing added is left as the faded basemap.
          if (!(v > 0)) return [0, 0, 0, 0];
          return [...TRACT_RAMP[rampIndex(v, breaks)], 205];
        },
        onHover: ({ object, x, y }) => {
          if (!object) { hover = null; return; }
          const i = tractByGeoid.get(object.properties.geoid);
          const existing = i === undefined ? 0 : (tracts[i].units_res ?? 0);
          const n = i === undefined ? 0 : added[i];
          hover = {
            x, y,
            geoid: object.properties.geoid,
            added: n,
            existing,
            share: existing > 0 ? n / existing : null
          };
        },
        updateTriggers: { getFillColor: [values, breaks] }
      }));
    } else {
      tractLegend = null;
    }

    if (isLots) {
      const rgba = lotColors(result, params.test);
      layers.push(new ScatterplotLayer({
        id: 'lots',
        data: { length: flags.length },
        pickable: mode === 'edit',
        stroked: false,
        radiusUnits: 'pixels',
        getRadius: 4,
        radiusMinPixels: LOT_MIN_PX,
        radiusMaxPixels: LOT_MAX_PX,
        getPosition: (_, { index, target }) => {
          const b = index * STRIDE;
          target[0] = lots[b]; target[1] = lots[b + 1]; target[2] = 0;
          return target;
        },
        getFillColor: (_, { index, target }) => {
          const o = index * 4;
          target[0] = rgba[o]; target[1] = rgba[o + 1];
          target[2] = rgba[o + 2]; target[3] = rgba[o + 3];
          return target;
        },
        onHover: ({ index, x, y }) => {
          hover = index >= 0
            ? {
                x, y,
                lot: index,
                outcome: result.outcome[index],
                aduSf: result.aduSf[index],
                income: lots[index * STRIDE + COL.TRACT_INCOME]
              }
            : null;
        },
        updateTriggers: { getFillColor: [rgba, params.test] }
      }));
    }

    if (isVolumes) {
      layers.push(new SolidPolygonLayer({
        id: 'units-3d',
        data: buildUnits(),
        extruded: true,
        pickable: false,
        getPolygon: (d) => d.ring,
        getElevation: () => ADU_HEIGHT_M,
        getFillColor: (d) => d.color
      }));
    }

    overlay.setProps({ layers });

    const mt = result.metrics;
    stats = mt;
    const pct = (x) => `${(x * 100).toFixed(1)}%`;
    onmetrics?.({
      'homes added (lots passing all three tests)': mt.works.toLocaleString(),
      'lots allowed under the rules': mt.allowed.toLocaleString(),
      'lots with room for a unit': mt.hasRoom.toLocaleString(),
      'share of allowed lots that work for the owner': pct(mt.shareOfAllowed),
      'unit size at the median passing lot': `${Math.round(mt.medianAduSf).toLocaleString()} sf`,
      'monthly margin at the median passing lot': `$${Math.round(mt.medianMargin).toLocaleString()}/mo`,
      'median tract income where homes land':
        mt.medianTractIncome > 0 ? `$${Math.round(mt.medianTractIncome).toLocaleString()}` : '—',
      'share of homes in the top tenth of tracts': pct(mt.concentration)
    });

    if (!ready) {
      ready = true;
      setTimeout(() => onready?.(true), 400);
    }
  }

  // The footprints of the units, for the 3D view.
  //
  // EVERY LOT WITH ROOM FOR ONE, whatever the other two tests said. A unit
  // standing on a lot the rules exclude is what this view is for, so test 2 is
  // evaluated on every lot rather than only on the ones that got that far.
  // A lot the pipeline could not site - no footprint on record, or a centroid
  // outside its own polygon, which is what an L-shaped or flag lot does - has
  // no room by definition and is simply absent.
  function buildUnits() {
    const out = [];
    const unitRatio = manifest.plan_library?.depth_to_width_ratio ?? 0.7;
    for (let i = 0; i < flags.length; i++) {
      if (!result.room[i]) continue;
      const ring = siteUnit(lots, rear, i, result.aduSf[i],
                            params.side_setback_ft, unitRatio);
      if (!ring) continue;
      out.push({ ring, color: [...volumeColor(result.outcome[i]), 235] });
    }
    return out;
  }

  const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  const tractRampStyle = `linear-gradient(to right, ${TRACT_RAMP.map(css).join(',')})`;
  const fmtTract = (v) =>
    params.tract_measure === 'share' ? `${(v * 100).toFixed(0)}%` : Math.round(v).toLocaleString();

  // 247,000 lots is a few milliseconds of arithmetic, but the color array and
  // deck.gl's upload are not free. Batch into a frame and tell the frame we are
  // unsettled, rather than debouncing the sliders - a slider that lags behind
  // its own readout is worse than one that takes a frame to land.
  function schedule() {
    if (!map || !manifest) return;
    if (pending) cancelAnimationFrame(pending);
    onready?.(false);
    pending = requestAnimationFrame(() => {
      pending = 0;
      render();
      onready?.(true);
    });
  }

  $effect(() => {
    if (browser && container && !map) boot();
  });

  $effect(() => {
    void [params.view, params.tract_measure, params.test,
          params.grant_max, params.equity_share, params.interest_rate,
          params.term_months, params.cushion, params.cost_per_sf,
          params.rent_basis, params.rent_flat, params.vacancy,
          params.rear_yard_denominator, params.side_setback_ft];
    schedule();
  });

  onDestroy(() => {
    cancelAnimationFrame(pending);
    try { detachRedraw?.(); } catch { /* never attached */ }
    try { map?.remove(); } catch { /* already gone */ }
  });
</script>

<div class="wrap" bind:this={stageEl}>
  <div class="map" bind:this={container}></div>

  <!-- The readout follows the pointer rather than sitting in the legend. Same
       tooltip as the Anthromes map: 230px, clamped inside the stage, no pointer
       events of its own so it never eats a drag. -->
  {#if hover && stageEl}
    <div
      class="tip"
      style="left:{Math.min(hover.x + 14, stageEl.clientWidth - 244)}px;
             top:{Math.min(hover.y + 14, stageEl.clientHeight - 110)}px"
    >
      {#if hover.geoid}
        <b>tract {hover.geoid}</b>
        <span>{hover.added.toLocaleString()} homes added</span>
        <span>{hover.existing.toLocaleString()} homes already there</span>
        <i>{hover.share === null
          ? 'no existing homes recorded'
          : `${(hover.share * 100).toFixed(1)}% of what the tract has`}</i>
      {:else}
        <b>{hover.outcome >= 3 ? 'adds a home' : 'no home here'}</b>
        <span>{hover.outcome >= 1 ? 'allowed under the rules' : 'not allowed under the rules'}</span>
        <span>{hover.outcome >= 2 ? 'room for a unit' : 'no room for a unit'}</span>
        <span>{hover.outcome >= 3 ? 'works for the owner' : 'does not work for the owner'}</span>
        {#if hover.aduSf > 0}<i>{Math.round(hover.aduSf).toLocaleString()} sf under the rear yard rule</i>{/if}
        {#if hover.income > 0}<i>tract median income ${Math.round(hover.income).toLocaleString()}</i>{/if}
      {/if}
    </div>
  {/if}

  {#if error}
    <p class="err">Couldn't load the data for this one: {error}</p>
  {:else if loading}
    <p class="loading">{loading}</p>
  {/if}

  {#if manifest && !error}
    <div class="key">
      {#if isTracts}
        {#if tractLegend}
          <div class="ramp">
            <span class="what">
              {params.tract_measure === 'share'
                ? 'homes added as a share of the homes the tract already has'
                : 'homes added, by census tract'}
            </span>
            <div class="bar" style="background: {tractRampStyle}"></div>
            <div class="ends">
              <span>0</span>
              <span>{fmtTract(tractLegend.max)}</span>
            </div>
          </div>
        {/if}
        {#if noTractShapes}
          <span class="warn">no tract outlines on disk - re-run data/scripts/pencil.py</span>
        {/if}
      {:else if isLots}
        <span><i class="sw" style="background: {css(FAIL_COLOR)}"></i>fails this test</span>
        <span>
          <i class="sw" style="background: {css(currentTest.color)}"></i>{currentTest.label}
        </span>
      {:else}
        <span><i class="sw" style="background: rgb(43,91,215)"></i>allowed, and works for the owner</span>
        <span><i class="sw" style="background: rgb(242,194,48)"></i>allowed, but does not work for the owner</span>
        <span><i class="sw" style="background: rgb(224,49,42)"></i>not allowed under the rules</span>
        <span class="note">Only lots with room for a unit are drawn.</span>
      {/if}

      <span class="note">Queens is drawn in full; the rest of the city is faded to 25%.</span>

      {#if basemapFailed}
        <span class="warn">no basemap - the model still works</span>
      {:else if tileFailures > 3}
        <span class="warn">{tileFailures} basemap tiles blocked - the model still works</span>
      {/if}
      {#if mode === 'edit' && lastPassMs > 0}
        <!-- The two counts the dev note reports: what test 2 used to be (the
             one-third area rule alone) and what it is now (a unit of that area
             fitting behind the house). The gap between them is the change the
             09-08 rebuild made, so it is measured on the map rather than
             asserted in prose. -->
        <span class="note">
          {stats.allowedWithArea.toLocaleString()} allowed lots clear the area rule ·
          {stats.hasRoom.toLocaleString()} of them fit a unit ·
          {flags.length.toLocaleString()} lots recomputed in {lastPassMs.toFixed(0)}ms
        </span>
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
    max-width: 20rem;
  }
  .key span { display: flex; align-items: flex-start; gap: 0.35rem; }
  .ramp { display: block; margin-bottom: 0.15rem; }
  .ramp .what { display: block; color: #444; margin-bottom: 0.25rem; }
  .ramp .bar { height: 9px; border: 1px solid rgba(0,0,0,0.25); }
  .ramp .ends {
    display: flex; justify-content: space-between; gap: 0.5rem;
    margin-top: 0.15rem; color: #888; font-size: 0.58rem;
    font-variant-numeric: tabular-nums;
  }
  .tip {
    position: absolute; width: 230px; pointer-events: none; z-index: 6;
    background: rgba(255,255,255,0.95); border: 1px solid #000;
    padding: 0.35rem 0.5rem; font-size: 0.62rem; line-height: 1.45;
    display: flex; flex-direction: column; gap: 0.05rem;
  }
  .tip b { font-size: 0.7rem; }
  .tip span { color: #555; }
  .tip i { color: #999; font-style: normal; }
  .sw { width: 9px; height: 9px; display: inline-block; flex: none; margin-top: 0.2em; }
  .note { color: #999; }
  .warn { color: #a00; font-weight: 700; }
</style>
