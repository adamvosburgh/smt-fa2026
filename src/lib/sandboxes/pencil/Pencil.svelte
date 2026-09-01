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
  import { compute, colours, STRIDE, COL, siteUnit, RAMP, RAMP_SPAN } from './proforma.js';

  let { params, assets = {}, mode = 'edit', dataBase, onmetrics, onready } = $props();

  let container = $state(null);
  let error = $state(null);
  let loading = $state('reading the lots…');
  let manifest = $state(null);
  let basemapFailed = $state(false);
  let tileFailures = $state(0);
  let lastPassMs = $state(0);
  let unsitedBuilt = $state(0);
  let zoom = $state(0);
  let stats = $state(null);


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
  // ScatterplotLayer takes a radius; this is the flat view's mark only. The
  // extruded view no longer uses it - a sited unit is drawn at its real
  // footprint, so it needs no per-lot fudge.
  const SIDE_TO_RADIUS = 1 / Math.SQRT2;
  // THE HEIGHT IS THE RULE'S, NOT A GUESS AND NOT AN EXAGGERATION.
  // ZR 23-341(b)(4) limits an ancillary unit beside a detached, zero lot line or
  // semi-detached house to "one story, not to exceed 15 feet". The volumes are
  // drawn at that 15 feet. Nothing in the model computes a height, so drawing
  // the published ceiling is the only figure available that is anybody's.
  const ADU_HEIGHT_M = 15 * 0.3048;

  function footprintRadius(lotAreaSqFt) {
    const side = Math.sqrt(Math.max(lotAreaSqFt, 0)) * FT2_TO_M * AREA_TO_SPACING;
    return Math.min(MAX_SIDE_M, Math.max(MIN_SIDE_M, side)) * SIDE_TO_RADIUS;
  }

  let map, overlay, detachRedraw, SolidPolygonLayer, ScatterplotLayer;
  let lots, flags, result;
  let ready = false;
  let pending = 0;

  async function boot() {
    try {
      const [deckLayers, m] = await Promise.all([
        import('@deck.gl/layers'),
        fetch(`${dataBase}/manifest.json`).then((r) => r.json())
      ]);
      SolidPolygonLayer = deckLayers.SolidPolygonLayer;
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
      // Tracked only so the legend can say what a mark IS at this zoom. It does
      // not trigger a redraw - the layers do not depend on it.
      zoom = map.getZoom();
      map.on('zoom', () => { zoom = map.getZoom(); });
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
    // THE VOLUMES ARE THE UNITS, NOT THE LOTS, and that distinction is the
    // whole reason this branch exists. The flat view draws one mark per lot at
    // the lot's own centre, which is the right place for a fact about a lot.
    // The extruded view draws the proposed building, so it has to stand where
    // the building would stand - in the back yard, five feet off the lot line,
    // at its own floor area. It used to be drawn at the lot centroid, which is
    // where the house already is, so every cottage sat on a roof.
    //
    // Only the units built by the selected year are given geometry, so this
    // builds a few thousand squares rather than a quarter of a million.
    //
    // THE FLAT MARKS STAY ON WHEN THE VOLUMES COME UP, and that is a fix rather
    // than a decoration. The two layers draw different populations: every lot
    // that passes the pro-forma, against the far smaller set that the
    // permitting queue has released AND that has room behind the house. When
    // the volumes replaced the marks, the difference between those two numbers
    // - about eight to one at the defaults - looked like units failing to draw.
    // Drawn together, the queue and the placement are both visible, and the
    // legend below counts all three populations rather than one.
    const flat = new ScatterplotLayer({
      id: 'lots-flat',
      data: { length: flags.length },
      pickable: false,
      stroked: false,
      radiusUnits: 'meters',
      radiusMinPixels: 1.2,
      radiusMaxPixels: 40,
      // Held back under the volumes so a solid always reads on top of its own
      // mark rather than fighting it.
      opacity: showVolumes ? 0.55 : 1,
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
      getRadius: (_, { index }) => footprintRadius(lots[index * STRIDE + COL.LOT_AREA]),
      updateTriggers: { getFillColor: [rgba] }
    });

    const layers = [flat];
    if (showVolumes) {
      layers.push(new SolidPolygonLayer({
        id: 'units-3d',
        data: buildUnits(rgba),
        extruded: true,
        pickable: false,
        getPolygon: (d) => d.ring,
        getElevation: () => ADU_HEIGHT_M,
        getFillColor: (d) => d.colour,
        updateTriggers: { getFillColor: [rgba] }
      }));
    }

    overlay.setProps({ layers });

    const mt = result.metrics;
    stats = mt;
    const pct = (x) => `${(x * 100).toFixed(1)}%`;
    onmetrics?.({
      'lots that pencil': `${mt.pencils.toLocaleString()} of ${mt.eligible.toLocaleString()} (${pct(mt.shareOfEligible)})`,
      'units built by this year': mt.builtByYear.toLocaleString(),
      'units this year': mt.builtThisYear.toLocaleString(),
      'margin at the median passing lot': `$${Math.round(mt.medianMargin).toLocaleString()}/mo`,
      'unit size at the median passing lot': `${Math.round(mt.medianAduSf).toLocaleString()} sf`,
      'of those, with room behind the house':
        `${mt.placeable.toLocaleString()} (${pct(mt.builtByYear > 0 ? mt.placeable / mt.builtByYear : 0)})`,
      'median tract income where units land':
        mt.medianTractIncome > 0 ? `$${Math.round(mt.medianTractIncome).toLocaleString()}` : '—',
      'share of units in the top tenth of tracts': pct(mt.concentration)
    });

    if (!ready) {
      ready = true;
      setTimeout(() => onready?.(true), 400);
    }
  }

  // The footprints of the units standing in the selected year.
  //
  // A lot is skipped when it has not been released yet, and when the pipeline
  // could not work out which way its back garden faces - no building footprint
  // on record, or a centroid outside its own polygon, which is what an L-shaped
  // or flag lot does. Those are left flat rather than drawn somewhere invented.
  // The count of them is on the legend, because a silently missing building is
  // exactly the kind of absence this sandbox is supposed to make visible.
  function buildUnits(rgba) {
    const out = [];
    const unitRatio = manifest.plan_library?.depth_to_width_ratio ?? 0.7;
    let unsited = 0;
    for (let i = 0; i < flags.length; i++) {
      const y = result.releaseYear[i];
      if (y < 0 || y > params.year) continue;
      const ring = siteUnit(lots, i * STRIDE, result.aduSf[i],
                            params.side_setback_ft, unitRatio);
      if (!ring) { unsited += 1; continue; }
      const o = i * 4;
      out.push({ ring, colour: [rgba[o], rgba[o + 1], rgba[o + 2], 235] });
    }
    unsitedBuilt = unsited;
    return out;
  }

  // ---- the legend ------------------------------------------------------
  //
  // The gradient is drawn from the SAME functions the map is coloured with, so
  // a reader holding the key against the map is holding the real thing. A
  // sentence saying "darker is a higher return" is not a key.
  const css = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
  function bar(fn, n = 14) {
    const stops = [];
    for (let i = 0; i < n; i++) stops.push(css(fn(i / (n - 1))));
    return `linear-gradient(to right, ${stops.join(',')})`;
  }
  // Margin diverges around the cushion, and the step at the middle is real -
  // that is where the deal stops covering itself.
  function divergingBar(n = 8) {
    const stops = [];
    for (let i = 0; i < n; i++) stops.push(css(RAMP.marginBelow(1 - i / (n - 1))));
    for (let i = 0; i < n; i++) stops.push(css(RAMP.marginAbove(i / (n - 1))));
    return `linear-gradient(to right, ${stops.join(',')})`;
  }
  const money = (v) => `$${Math.round(v).toLocaleString()}`;
  const startYear = $derived(manifest?.start_year ?? 2027);

  const ramp = $derived.by(() => {
    if (!manifest) return null;
    if (params.tint === 'roe') {
      return { style: bar(RAMP.roe), left: '0%', right: `${RAMP_SPAN.roe * 100}% and over`,
               what: 'annual return on the money the owner put in' };
    }
    if (params.tint === 'release_year') {
      return { style: bar(RAMP.releaseYear), left: String(startYear),
               right: `${startYear + RAMP_SPAN.releaseYear} and later`,
               what: 'the year the queue reaches this lot' };
    }
    if (params.tint === 'margin') {
      return { style: divergingBar(), left: `${money(params.cushion - RAMP_SPAN.margin)}/mo`,
               mid: `the ${money(params.cushion)} cushion`,
               right: `+${money(params.cushion + RAMP_SPAN.margin)}/mo`,
               what: 'what is left each month after the loan and the running costs' };
    }
    return null;   // eligibility is categorical; it keeps its swatches
  });

  // WHAT A MARK IS, AT THIS ZOOM.
  //
  // The scatterplot holds every lot to a minimum of 1.2 pixels of radius, which
  // is the only reason a quarter of a million sub-pixel lots resolve into a
  // pattern instead of moire. The cost of that floor is that below roughly zoom
  // 14.5 the marks are wider than the lots under them and overlap their
  // neighbours - so the reader is looking at a density of lots, not at lots.
  // Above it the floor stops binding and the marks separate. Two different
  // pictures, and nothing on the map said which one was on screen.
  const PER_LOT_ZOOM = 14.5;
  const perLot = $derived(zoom >= PER_LOT_ZOOM);

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
          params.rear_yard_denominator, params.side_setback_ft,
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
      {#if ramp}
        <div class="ramp">
          <span class="what">{ramp.what}</span>
          <div class="bar" style="background: {ramp.style}"></div>
          <div class="ends">
            <span>{ramp.left}</span>
            {#if ramp.mid}<span class="mid">{ramp.mid}</span>{/if}
            <span>{ramp.right}</span>
          </div>
        </div>
      {:else}
        <span><i class="sw pass"></i>the deal clears the cushion</span>
        <span><i class="sw fail"></i>eligible, but it doesn't pencil</span>
      {/if}

      <!-- WHAT IS ON THE MAP, in populations, because the two layers draw
           different ones and the gap between them is not a drawing failure. -->
      {#if stats}
        <span class="pops">
          <b>{stats.pencils.toLocaleString()}</b> lots pencil
          {#if params.volumes === true}
            · <b>{stats.builtByYear.toLocaleString()}</b> released by {params.year}
            · <b>{stats.placeable.toLocaleString()}</b> standing
          {/if}
        </span>
      {/if}

      <span class="note">
        A mark is a TAX LOT, not a building: a two-family house is one mark.
        {#if perLot}
          One mark, one lot, at half the side of its equal-area square — so a
          block of row houses resolves into houses rather than a band.
        {:else}
          At this zoom every mark is held to a minimum of a pixel and a bit, so
          it is wider than its lot and overlaps its neighbours. You are reading
          a density of lots, not lots. Zoom past {PER_LOT_ZOOM} for one mark per lot.
        {/if}
      </span>

      {#if params.volumes === true}
        <span class="note">
          The solids are the units built by {params.year}, one per lot, at their
          own floor area and the plan library's proportions, 15ft tall — the
          rule's limit. Set behind the house, {params.side_setback_ft}ft off the
          rear lot line. Which way is "back" is inferred from where the house
          is, and it is often wrong: see the card.
        </span>
        {#if unsitedBuilt > 0}
          <span class="note">
            {unsitedBuilt.toLocaleString()} built units not drawn: no room behind
            the house for a unit this shape, or no footprint on record. The rule
            tests the AREA of the rear yard, which is not the same as a plan.
          </span>
        {/if}
      {/if}

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
  .ramp .ends .mid { color: #444; }
  .key .pops {
    display: block; color: #444; border-top: 1px solid #e0e0dd;
    margin-top: 0.2rem; padding-top: 0.25rem; font-variant-numeric: tabular-nums;
  }
  .key .pops b { font-weight: 700; color: #000; }
  .sw { width: 9px; height: 9px; display: inline-block; flex: none; margin-top: 0.2em; }
  .pass { background: rgb(30,80,140); }
  .fail { background: rgb(209,69,61); }
  .note { color: #999; }
  .warn { color: #a00; font-weight: 700; }
</style>
