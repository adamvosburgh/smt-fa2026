<script>
  // Sandbox 02 - Office to Residential Conversion (slug after-five).
  //
  // Lower Manhattan and Midtown in 2040, after the state's conversion incentive
  // has closed. Office buildings become housing when a conversion would be
  // worth more than the office, and the sidewalks show how the district's day
  // changes when they do.
  //
  // The contract, as bathtub sets it out:
  //   props in : params, assets, mode ('edit' | 'view'), dataBase
  //   props in : onmetrics(obj), onready(bool)  - supplied by SandboxFrame
  //   never    : this component does not touch window.__metrics or
  //              data-cover-ready. It reports; the frame publishes.
  //
  // THE AGENTS ARE GONE, AS OF 2026-09-08. They walked sprites from station
  // exits along a street graph, which asked the reader to believe a route, a
  // speed and a choice of door - none of which is in any dataset. What replaced
  // them asks a smaller question that the data can answer: how many people does
  // each building put onto the pavement near it in each hour? That is its
  // people times the change in their presence from one hour to the next, spread
  // over the sidewalk cells within 50 m of the building. There are no gateways
  // in the model any more, so nothing concentrates at a station mouth except
  // insofar as buildings stand near one.
  //
  // THE YEAR IS GONE TOO. RPTL 467-m requires a conversion to finish by the end
  // of 2039, so the date is 2040 and everything that converts has converted.
  // The only clock is the hour of the day.
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { createMap, attachRedraw } from '../_shared/maplibre.js';
  import {
    compute, colors, STRIDE, HEIGHT, FLOORS, FLOORS_ADDED, DISTRICT,
    DISTRICT_INDEX, BUILDING_COLOR
  } from './gates.js';
  import {
    peoplePerBuilding, computeChannels, applyCurves, percentile98, paint,
    totalsAt, OFFICE_HUE, HOME_HUE
  } from './heatmap.js';

  const DISTRICT_KEY = { mn01: 'MN01', mn05: 'MN05' };
  const FT_TO_M = 0.3048;

  let { params, assets = {}, mode = 'edit', dataBase, onmetrics, onready } = $props();

  let container = $state(null);
  let error = $state(null);
  let loading = $state('loading the buildings…');
  let manifest = $state(null);
  let basemapFailed = $state(false);
  let tileFailures = $state(0);
  let heavyMs = $state(0);
  let result = $state(null);
  let maxPerCell = $state(0);

  let map, overlay, detachRedraw, PolygonLayer, SolidPolygonLayer, BitmapLayer;
  let buildings, footprints, grid, csr, sidewalk, day, outlines;
  // Footprints pre-filtered per district, built once. The arrays must be
  // STABLE identities: a fresh filter() on every render would make deck.gl
  // retessellate 3,700 polygons per frame while the hour plays.
  let fpByDistrict = null;
  let rgba = null;          // building colors, rebuilt only on a heavy pass
  let channels = null;      // 24 hours x cells, two channels
  let texture = null;       // the RGBA buffer paint() writes into
  let heatImage = null;     // an ImageData view of it
  // TWO canvases, alternated. deck.gl re-uploads a bitmap only when the image
  // IDENTITY changes, and these pixels change every frame - so the layer is
  // handed a different canvas each time rather than the same one twice. A
  // canvas rather than the ImageData itself because a canvas is a texture
  // source everywhere and ImageData is not.
  let heatCanvas = [null, null];
  let heatFlip = 0;
  let heatKey = '';         // what `channels` was last built for
  let ready = false;
  let pending = 0;

  const isHeat = $derived(params.view !== 'convertibility');

  /** Frame the district being looked at, not the union of both. */
  function boundsFor(m, district) {
    const key = DISTRICT_KEY[district];
    return (key && m.district_view_bounds?.[key]) || m.view_bounds || m.bounds;
  }

  function clampCamera() {
    if (!map || !manifest) return;
    const [w, s, e, n] = boundsFor(manifest, params.district);
    const pw = (e - w) * 0.4, ph = (n - s) * 0.4;
    try { map.setMaxBounds([[w - pw, s - ph], [e + pw, n + ph]]); } catch { /* not ready */ }
  }

  // THE MASK, NOT A CROP. The basemap is the city; a white polygon at 75%
  // opacity covers it with the selected district cut out of it, so the district
  // reads at full strength and everything around it at a quarter. The crop it
  // replaced ended the map at a rectangle, which hid where the district is -
  // half of what a map of one district is for.
  function maskLayer() {
    if (!outlines) return null;
    const wanted = params.district === 'both'
      ? Object.keys(outlines)
      : [DISTRICT_KEY[params.district]].filter((k) => outlines[k]);
    if (!wanted.length) return null;
    const [w, s, e, n] = manifest.bounds;
    // The outer ring has to outrun the HORIZON, not the pan limits - at pitch
    // 50 the camera sees tens of degrees past its own center.
    const P = 8;
    const outer = [[w - P, s - P], [e + P, s - P], [e + P, n + P], [w - P, n + P]];
    const holes = wanted.flatMap((k) => outlines[k].map((poly) => poly[0]));
    return new SolidPolygonLayer({
      id: 'outside-district',
      data: [{ p: [outer, ...holes] }],
      getPolygon: (d) => d.p,
      filled: true,
      pickable: false,
      // Unlit, or the tilted view shades the "page" like a surface in the scene.
      material: false,
      getFillColor: [255, 255, 255, 191], // 75%
      updateTriggers: { getPolygon: [params.district] }
    });
  }

  function fpFor(district) {
    if (!fpByDistrict) {
      footprints.forEach((f, i) => { f.i = i; });
      const of = (d) => footprints.filter(
        (f) => buildings[f.i * STRIDE + DISTRICT] === DISTRICT_INDEX[d]);
      fpByDistrict = { both: footprints, mn01: of('mn01'), mn05: of('mn05') };
    }
    return fpByDistrict[district] ?? footprints;
  }

  async function boot() {
    try {
      const [deckLayers, m] = await Promise.all([
        import('@deck.gl/layers'),
        fetch(`${dataBase}/manifest.json`).then((r) => r.json())
      ]);
      PolygonLayer = deckLayers.PolygonLayer;
      SolidPolygonLayer = deckLayers.SolidPolygonLayer;
      BitmapLayer = deckLayers.BitmapLayer;
      manifest = m;

      const [bBuf, fp, gridJson, sidewalkBuf, cellsBuf, weightsBuf, dayJson, distJson] =
        await Promise.all([
          fetch(`${dataBase}/buildings.bin`).then((r) => r.arrayBuffer()),
          fetch(`${dataBase}/footprints.json`).then((r) => r.json()),
          fetch(`${dataBase}/grid.json`).then((r) => r.json()),
          fetch(`${dataBase}/sidewalk.bin`).then((r) => r.arrayBuffer()),
          fetch(`${dataBase}/cells.bin`).then((r) => r.arrayBuffer()),
          fetch(`${dataBase}/weights.bin`).then((r) => r.arrayBuffer()),
          fetch(`${dataBase}/day.json`).then((r) => r.json()),
          fetch(`${dataBase}/districts.json`).then((r) => (r.ok ? r.json() : null))
        ]);
      buildings = new Float32Array(bBuf);
      footprints = fp;
      grid = gridJson;
      sidewalk = new Uint8Array(sidewalkBuf);
      csr = {
        offsets: Uint32Array.from(gridJson.offsets),
        cellIds: new Uint32Array(cellsBuf),
        weights: new Float32Array(weightsBuf)
      };
      day = dayJson;
      outlines = distJson;

      if (buildings.length / STRIDE !== footprints.length) {
        throw new Error(
          `buildings.bin has ${buildings.length / STRIDE} rows but ` +
          `footprints.json has ${footprints.length}. Re-run data/scripts/after-five.py.`);
      }
      if (grid.buildings !== footprints.length) {
        throw new Error(
          `grid.json was built for ${grid.buildings} buildings and there are ` +
          `${footprints.length}. Re-run data/scripts/after-five.py.`);
      }

      texture = new Uint8ClampedArray(grid.width * grid.height * 4);
      heatImage = new ImageData(texture, grid.width, grid.height);
      heatCanvas = [0, 1].map(() => {
        const c = document.createElement('canvas');
        c.width = grid.width;
        c.height = grid.height;
        return c;
      });

      const [w, s, e, n] = boundsFor(m, params.district);
      ({ map, overlay } = await createMap({
        container,
        bounds: [[w, s], [e, n]],
        interactive: mode === 'edit',
        padding: 4,
        onBasemapFail: () => { basemapFailed = true; },
        onTileFail: (k) => { tileFailures = k; }
      }));
      // Look at it from an angle - a massing model seen from directly above is
      // a footprint map, which is the thing this sandbox is not.
      map.setPitch(50);
      map.setBearing(-20);
      map.setMaxPitch(85);
      clampCamera();

      loading = null;
      render(true);
      detachRedraw = attachRedraw(map, container, () => render(false));
    } catch (err) {
      error = String(err?.message ?? err);
      onready?.(true); // never hang the cover pipeline on a data failure
    }
  }

  // The heavy pass: the two gates, the building colors, and the 24-hour
  // channels. Everything here depends on WHICH BUILDINGS CONVERT, so it is
  // redone when an assumption moves and never when the clock does.
  //
  // The normalization is the one thing that is NOT redone. The ramp is scaled
  // by the 98th percentile of the activity at the DEFAULT scenario, computed
  // once, so the colors mean the same thing across hours and across scenarios.
  // A ramp rescaled per scenario would show the shape of the color scale
  // rather than the shape of the day.
  function heavy() {
    const t0 = performance.now();
    result = compute(buildings, manifest, params);
    rgba = colors(result, buildings, params);

    const people = peoplePerBuilding(buildings, manifest, result, params);
    channels = applyCurves(
      computeChannels(grid, csr, buildings, people, params.district), day);
    if (!maxPerCell) maxPerCell = percentile98(channels);
    heavyMs = performance.now() - t0;
    heatKey = heatSignature();
  }

  // Everything the conversion set depends on. The clock and the view are not
  // in it, which is the point.
  function heatSignature() {
    return [params.district, params.scenario, params.office_rent, params.opex_office,
            params.cap_rate_office, params.residential_rent, params.opex_residential,
            params.cap_rate_residential, params.conversion_cost_sf,
            params.convertibility_threshold, params.w_depth, params.w_f2f,
            params.w_area, params.w_age, params.incentive_467m,
            params.min_units_for_conversion_sample].join('|');
  }

  function render(force = false) {
    if (!overlay || !manifest || !buildings) return;
    if (force || heatKey !== heatSignature()) heavy();

    const layers = [];
    const mask = maskLayer();
    if (mask) layers.push(mask);

    // The heat map, as one texture laid over the ground. Nearest sampling, so
    // the cells read as cells: this is a 10 m grid and pretending otherwise
    // would smooth an argument the reader should be able to count.
    if (isHeat && channels) {
      paint(channels, sidewalk, params.hour ?? 8, maxPerCell, params.view,
            texture, grid.width, grid.height);
      heatFlip ^= 1;
      const canvas = heatCanvas[heatFlip];
      canvas.getContext('2d').putImageData(heatImage, 0, 0);
      layers.push(new BitmapLayer({
        id: 'sidewalks',
        image: canvas,
        bounds: grid.bounds,
        textureParameters: { minFilter: 'nearest', magFilter: 'nearest' },
        pickable: false,
        opacity: 1
      }));
    }

    layers.push(new PolygonLayer({
      id: 'massing',
      data: fpFor(params.district),
      extruded: true,
      wireframe: false,
      filled: true,
      pickable: false,
      getPolygon: (d) => d.r,
      getFillColor: (d, { target }) => {
        const o = d.i * 4;
        target[0] = rgba[o]; target[1] = rgba[o + 1];
        target[2] = rgba[o + 2]; target[3] = rgba[o + 3];
        return target;
      },
      getElevation: (d) => {
        const base = d.i * STRIDE;
        let ft = buildings[base + HEIGHT];
        // Added floors: the existing roof pushed up by the stories a filing
        // added. This is the QUANTITY of change, not its form - a building
        // that grew four floors grows a four-floor block, with no setback
        // and no new envelope.
        if (params.added_floors !== false && result.state[d.i] === 2) {
          const floors = buildings[base + FLOORS];
          const added = buildings[base + FLOORS_ADDED];
          if (added > 0 && floors > 0) ft += (ft / floors) * added;
        }
        return ft * FT_TO_M;
      },
      updateTriggers: {
        getFillColor: [rgba],
        getElevation: [params.added_floors, result]
      }
    }));

    overlay.setProps({ layers });

    const m = result.metrics;
    const totals = isHeat && channels ? totalsAt(channels, params.hour ?? 8) : null;
    const n = (v) => Math.round(v).toLocaleString();
    onmetrics?.({
      'people on the sidewalks at this hour, from offices / from homes':
        totals ? `${n(totals.office)} / ${n(totals.residential)}` : '—',
      'homes created': n(m.unitsTotal),
      'office floor area removed': `${n(m.officeRemoved / 1e6)}M sf`,
      'buildings converted, of the office buildings there are':
        `${n(m.converted)} of ${n(m.officeBuildings)}`,
      'residents living there afterwards': n(m.residentsAdded),
      'office jobs displaced': n(m.officeJobsRemoved),
      'share of office buildings that converted':
        `${(m.shareConverted * 100).toFixed(1)}%`
    });

    if (!ready) {
      ready = true;
      setTimeout(() => onready?.(true), 400);
    }
  }

  // The clock ticks ~30 times a second while it plays, and a heavy pass on
  // every tick would stutter. The signature check inside render() is what keeps
  // the clock cheap; this only batches the moves into a frame.
  function schedule(heavyChange) {
    if (!map || !manifest) return;
    if (pending) cancelAnimationFrame(pending);
    if (heavyChange) onready?.(false);
    pending = requestAnimationFrame(() => {
      pending = 0;
      render(false);
      if (heavyChange) onready?.(true);
    });
  }

  const rgbcss = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  const perCell = $derived(maxPerCell > 0 ? maxPerCell : 0);

  // The convertibility legend's threshold mark, and where it would have to sit
  // to agree with Gensler's published quarter. Recomputed in gates.js when the
  // weights move, because a mark that stays put while the score changes
  // underneath it is a lie.
  const gensler = $derived(result?.gensler ?? null);

  $effect(() => {
    if (browser && container && !map) boot();
  });

  // The clock and the view: cheap, no recompute.
  $effect(() => {
    void [params.hour, params.view, params.added_floors];
    schedule(false);
  });

  // The assumptions: a heavy pass.
  $effect(() => {
    void [params.district, params.scenario, params.office_rent, params.opex_office,
          params.cap_rate_office, params.residential_rent, params.opex_residential,
          params.cap_rate_residential, params.conversion_cost_sf,
          params.convertibility_threshold, params.w_depth, params.w_f2f,
          params.w_area, params.w_age, params.incentive_467m,
          params.min_units_for_conversion_sample];
    schedule(true);
  });

  // Changing district reframes the camera as well as the model.
  $effect(() => {
    void params.district;
    if (map && manifest) {
      clampCamera();
      const [w, s, e, n] = boundsFor(manifest, params.district);
      try { map.fitBounds([[w, s], [e, n]], { padding: 4, duration: 500 }); } catch { /* not ready */ }
    }
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
      {#if params.view === 'activity'}
        <div class="ramp">
          <span class="what">sidewalk activity</span>
          <div class="bar activity"></div>
          <div class="ends">
            <span>none</span>
            <span>some · {(perCell / 2).toFixed(1)}</span>
            <span>busiest · {perCell.toFixed(1)}</span>
          </div>
          <span class="unit">people per hour per 10 m cell</span>
        </div>
      {:else if params.view === 'population'}
        <div class="ramp">
          <span class="what">who is on the street</span>
          <div class="bar" style="background: linear-gradient(to right, transparent, {rgbcss(OFFICE_HUE)})"></div>
          <span class="unit">from office buildings</span>
          <div class="bar" style="background: linear-gradient(to right, transparent, {rgbcss(HOME_HUE)})"></div>
          <span class="unit">from homes · up to {perCell.toFixed(1)} people per hour per cell</span>
        </div>
      {:else}
        <div class="ramp">
          <span class="what">convertibility score</span>
          <div class="bar convertibility"></div>
          <div class="ends">
            <span>0</span>
            <span>threshold {Number(params.convertibility_threshold).toFixed(2)}</span>
            <span>1</span>
          </div>
          {#if gensler !== null}
            <span class="unit">
              a quarter of this district's office buildings score {gensler.toFixed(2)} or above
            </span>
          {/if}
        </div>
      {/if}

      <span class="buildings">
        <i class="sw" style="background: {rgbcss(BUILDING_COLOR.office)}"></i>office
        <i class="sw" style="background: {rgbcss(BUILDING_COLOR.converted)}"></i>converted to homes
        <i class="sw" style="background: {rgbcss(BUILDING_COLOR.existing_homes)}"></i>existing homes
        <i class="sw" style="background: {rgbcss(BUILDING_COLOR.other)}"></i>other
      </span>

      {#if isHeat}
        <span class="note">subway riders and residents only; see what it can't see</span>
      {/if}

      {#if basemapFailed}
        <span class="warn">no basemap - the model still works</span>
      {:else if tileFailures > 3}
        <span class="warn">{tileFailures} basemap tiles blocked - the model still works</span>
      {/if}
      {#if mode === 'edit' && heavyMs > 0}
        <span class="note">
          {grid.buildings.toLocaleString()} buildings, {grid.pairs.toLocaleString()} building-cell
          pairs, 24 hours recomputed in {heavyMs.toFixed(0)}ms
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
    display: flex; flex-direction: column; gap: 0.25rem;
    background: rgba(255,255,255,0.88); padding: 0.4rem 0.55rem;
    font-size: 0.62rem; line-height: 1.4; color: #444; pointer-events: none;
    max-width: 21rem;
  }
  .key span { display: flex; align-items: flex-start; gap: 0.35rem; }
  .ramp { display: block; }
  .ramp .what { display: block; color: #444; margin-bottom: 0.25rem; }
  .ramp .bar { height: 9px; border: 1px solid rgba(0,0,0,0.25); }
  .ramp .bar + .unit { margin-bottom: 0.3rem; }
  .bar.activity {
    background: linear-gradient(to right, #9a9a9a, #f2d43c, #d7301f);
  }
  .bar.convertibility {
    background: linear-gradient(to right, rgb(238,233,222), rgb(38,83,162));
  }
  .ramp .ends {
    display: flex; justify-content: space-between; gap: 0.5rem;
    margin-top: 0.15rem; color: #888; font-size: 0.58rem;
    font-variant-numeric: tabular-nums;
  }
  .ramp .unit { display: block; color: #888; font-size: 0.58rem; margin-top: 0.1rem; }
  .buildings {
    display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.5rem;
    border-top: 1px solid #e0e0dd; margin-top: 0.2rem; padding-top: 0.3rem;
  }
  .sw { width: 9px; height: 9px; display: inline-block; flex: none; }
  .note { color: #999; }
  .warn { color: #a00; font-weight: 700; }
</style>
