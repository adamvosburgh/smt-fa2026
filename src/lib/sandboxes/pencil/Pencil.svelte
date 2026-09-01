<script>
  // Sandbox 02 - Does It Pencil.
  //
  // Every one-to-two-family lot in Queens, tested against the published terms of
  // one real subsidy programme and tinted by the monthly cash flow an ADU on it
  // would produce.
  //
  // The contract, as bathtub sets it out:
  //   props in : params, assets, mode ('edit' | 'view'), dataBase
  //   props in : onmetrics(obj), onready(bool)  - supplied by SandboxFrame
  //              data-cover-ready. It reports; the frame publishes.
  //
  // The arithmetic is in proforma.js and runs on every parameter change over
  // 246,921 lots. The SAME pass produces the colour array and the panel's
  // numbers, so the picture and the figures cannot disagree.
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { createMap, attachRedraw } from '../_shared/maplibre.js';
  import { compute, colours, STRIDE } from './proforma.js';

  let { params, assets = {}, mode = 'edit', dataBase, onmetrics, onready } = $props();

  let container = $state(null);
  let error = $state(null);
  let loading = $state('reading the lots…');
  let manifest = $state(null);
  let basemapFailed = $state(false);
  let tileFailures = $state(0);
  let lastPassMs = $state(0);


  // The drawn footprint per lot.
  //
  // A square of the lot's true area does NOT work here, and the reason is worth
  // keeping. A typical Queens lot is 3,000 square feet, so its equal-area square
  // is about 17 metres on a side - but the lots themselves are 25 feet wide,
  // about 7.6 metres apart along a block. Each square therefore covers its two
  // neighbours, and a block of forty row houses fuses into one continuous
  // 17-metre band. The borough came out as a field of diagonal streaks, which
  // read as an artefact of the model and were an artefact of the drawing.
  //
  // So the square is scaled to the SPACING between lots rather than to their
  // area: half the equal-area side, which puts the median lot at about 8 metres
  // and lets a block resolve into houses. Bigger lots are still drawn bigger,
  // so the size still carries information - it is just no longer to scale.
  //
  // It is also clamped. 0.6% of these lots are over 10,000 square feet and the
  // largest is 1,106,431 - a genuine single-family house on a city-owned parcel
  // off Church Road. At true area that one lot is a 208-metre square, and a
  // handful of them painted over whole neighbourhoods.
  const FT2_TO_M = 0.3048;
  const AREA_TO_SPACING = 0.5;
  const MIN_SIDE_M = 5;
  const MAX_SIDE_M = 15;
  // ColumnLayer with diskResolution 4 draws a square whose corners sit at
  // `radius`, so the side is radius * sqrt(2).
  const SIDE_TO_RADIUS = 1 / Math.SQRT2;
  // Life size for a single storey is about 3.5m; this is roughly double, so the
  // volumes read at all when they are switched on.
  const ADU_HEIGHT_PER_SF = 0.008;

  function footprintRadius(lotAreaSqFt) {
    const side = Math.sqrt(Math.max(lotAreaSqFt, 0)) * FT2_TO_M * AREA_TO_SPACING;
    return Math.min(MAX_SIDE_M, Math.max(MIN_SIDE_M, side)) * SIDE_TO_RADIUS;
  }

  let map, overlay, detachRedraw, ColumnLayer, ScatterplotLayer;
  let lots, flags, result;
  let ready = false;
  let pending = 0;

  async function boot() {
    try {
      const [deckLayers, m] = await Promise.all([
        import('@deck.gl/layers'),
        fetch(`${dataBase}/manifest.json`).then((r) => r.json())
      ]);
      ColumnLayer = deckLayers.ColumnLayer;
      ScatterplotLayer = deckLayers.ScatterplotLayer;
      manifest = m;

      loading = 'reading 247,000 lots…';
      const [lotsBuf, flagsBuf] = await Promise.all([
        fetch(`${dataBase}/lots.bin`).then((r) => r.arrayBuffer()),
        fetch(`${dataBase}/flags.bin`).then((r) => r.arrayBuffer())
      ]);
      lots = new Float32Array(lotsBuf);
      flags = new Uint8Array(flagsBuf);
      if (lots.length !== flags.length * STRIDE) {
        throw new Error(
          `lots.bin and flags.bin disagree: ${lots.length / STRIDE} rows against ` +
          `${flags.length}. Re-run data/scripts/pencil.py.`);
      }

      const [w, s, e, n] = m.bounds;
      ({ map, overlay } = await createMap({
        container,
        bounds: [[w, s], [e, n]],
        interactive: mode === 'edit',
        onBasemapFail: () => { basemapFailed = true; },
        onTileFail: (k) => { tileFailures = k; }
      }));

      loading = null;
      render();
      detachRedraw = attachRedraw(map, container, render);
    } catch (err) {
      error = String(err?.message ?? err);
      onready?.(true); // never hang the cover pipeline on a data failure
    }
  }

  function render() {
    if (!overlay || !manifest || !lots) return;

    const t0 = performance.now();
    result = compute(lots, flags, manifest, params);
    const rgba = colours(result, lots, params, manifest);
    lastPassMs = performance.now() - t0;

    const showVolumes = params.volumes === true;
    // Volumes seen from directly overhead are just squares, so the map tilts
    // only when there is something to see in three dimensions. Flat is the
    // default: a quarter of a million columns at a shallow angle smear into
    // each other at borough zoom, and the pattern is the point.
    const wantPitch = showVolumes ? 35 : 0;
    if (map && Math.abs(map.getPitch() - wantPitch) > 1) {
      try { map.easeTo({ pitch: wantPitch, duration: 400 }); } catch { /* not ready */ }
    }
    // TWO LAYERS, AND THE REASON IS THE PIXEL GRID.
    //
    // At borough zoom the whole of Queens is about 850 pixels wide, so a lot is
    // roughly 0.2 of a pixel. A quarter of a million sub-pixel columns do not
    // render as a map; they render as moire - diagonal streaks that look like a
    // finding and are an artefact of the rasteriser. Making the squares bigger
    // or smaller changes nothing, because the problem is that they are smaller
    // than a pixel either way.
    //
    // So the flat view - the default, and the one the argument lives in - uses
    // a scatterplot with a MINIMUM PIXEL RADIUS. Every lot is guaranteed at
    // least a pixel and a bit, the pattern resolves cleanly, and zooming in
    // takes over from the minimum smoothly.
    //
    // The extruded view keeps the column layer, because a scatterplot cannot be
    // extruded. It is only legible zoomed in, which is what its control says.
    const layer = showVolumes
      ? new ColumnLayer({
          id: 'lots-3d',
          data: { length: flags.length },
          diskResolution: 4,
          extruded: true,
          pickable: false,
          getPosition: (_, { index }) => {
            const b = index * STRIDE;
            return [lots[b], lots[b + 1], 0];
          },
          getFillColor: (_, { index }) => {
            const o = index * 4;
            return [rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3]];
          },
          // Height is the unit's own floor area, standing only once the lot's
          // release year has arrived. A lot released later lies flat. Drawn at
          // roughly twice life size so it reads at all - named in the card.
          getElevation: (_, { index }) => {
            const y = result.releaseYear[index];
            if (y < 0 || y > params.year) return 0;
            return Math.max(2, lots[index * STRIDE + 2] * ADU_HEIGHT_PER_SF);
          },
          // ColumnLayer HAS NO getRadius ACCESSOR. Radius is a single prop for
          // every column, and an accessor passed here is silently ignored -
          // which left the default of 1000 METRES in place. At neighbourhood
          // zoom that is about 390 pixels a column, so the map became a stack
          // of overlapping shards and looked like corrupted geometry. It was
          // not corrupted; it was one prop that does not exist.
          //
          // So the extruded view draws every lot at the same footprint, about
          // the size of a small house. Per-lot sizing survives in the flat view,
          // where ScatterplotLayer does take an accessor.
          radius: 6,
          radiusUnits: 'meters',
          elevationScale: 1,
          updateTriggers: {
            getFillColor: [rgba],
            getElevation: [params.year, result]
          }
        })
      : new ScatterplotLayer({
          id: 'lots-flat',
          data: { length: flags.length },
          pickable: false,
          stroked: false,
          radiusUnits: 'meters',
          radiusMinPixels: 1.2,
          radiusMaxPixels: 40,
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
          getRadius: (_, { index }) => footprintRadius(lots[index * STRIDE + 3]),
          updateTriggers: { getFillColor: [rgba] }
        });

    overlay.setProps({ layers: [layer] });

    const mt = result.metrics;
    const pct = (x) => `${(x * 100).toFixed(1)}%`;
    onmetrics?.({
      'lots that pencil': `${mt.pencils.toLocaleString()} of ${mt.eligible.toLocaleString()} (${pct(mt.shareOfEligible)})`,
      'units built by this year': mt.builtByYear.toLocaleString(),
      'units this year': mt.builtThisYear.toLocaleString(),
      'margin at the median passing lot': `$${Math.round(mt.medianMargin).toLocaleString()}/mo`,
      'median tract income where units land':
        mt.medianTractIncome > 0 ? `$${Math.round(mt.medianTractIncome).toLocaleString()}` : '—',
      'share of units in the top tenth of tracts': pct(mt.concentration)
    });

    if (!ready) {
      ready = true;
      setTimeout(() => onready?.(true), 400);
    }
  }

  // 247,000 lots is a few milliseconds of arithmetic, but the colour array and
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
    void [params.grant_max, params.equity_share, params.interest_rate,
          params.term_months, params.cost_per_sf, params.rent_basis,
          params.rent_flat, params.vacancy, params.eligibility,
          params.cushion, params.permits_per_year,
          params.year, params.tint, params.volumes];
    schedule();
  });

  onDestroy(() => {
    cancelAnimationFrame(pending);
    try { detachRedraw?.(); } catch { /* never attached */ }
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

  {#if manifest && !error}
    <div class="key">
      {#if params.tint === 'eligibility'}
        <span><i class="sw pass"></i>the deal clears the cushion</span>
        <span><i class="sw fail"></i>eligible, but it doesn't pencil</span>
      {:else if params.tint === 'release_year'}
        <span><i class="sw pass"></i>built early - highest return first</span>
        <span><i class="sw late"></i>built later in the queue</span>
      {:else if params.tint === 'roe'}
        <span>darker is a higher return on the owner's own money</span>
      {:else}
        <span><i class="sw pass"></i>monthly margin above the cushion</span>
        <span><i class="sw fail"></i>below it - this one loses money</span>
      {/if}
      <span class="note">
        {#if params.volumes === true}
          One column per lot, all the same footprint. Zoom in.
        {:else}
          One mark per lot at its centroid, never smaller than a pixel.
        {/if}
      </span>
      {#if params.eligibility === 'all'}
        <span class="warn">ignoring eligibility - pricing every lot in Queens</span>
      {/if}
      {#if basemapFailed}
        <span class="warn">no basemap - the model still works</span>
      {:else if tileFailures > 3}
        <span class="warn">{tileFailures} basemap tiles blocked - the model still works</span>
      {/if}
      {#if mode === 'edit' && lastPassMs > 0}
        <span class="note">{flags.length.toLocaleString()} lots recomputed in {lastPassMs.toFixed(0)}ms</span>
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
    max-width: 18rem;
  }
  .key span { display: flex; align-items: flex-start; gap: 0.35rem; }
  .sw { width: 9px; height: 9px; display: inline-block; flex: none; margin-top: 0.2em; }
  .pass { background: rgb(30,80,140); }
  .fail { background: rgb(209,69,61); }
  .late { background: rgb(230,60,80); }
  .note { color: #999; }
  .warn { color: #a00; font-weight: 700; }
</style>
