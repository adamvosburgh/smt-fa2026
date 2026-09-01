<script>
  // Sandbox 03 - After Five.
  //
  // Lower Manhattan in 3D, running one clock. Office buildings recolour to
  // residential as they pass two gates, and grow where a filing added floors.
  //
  // The contract, as bathtub sets it out:
  //   props in : params, assets, mode ('edit' | 'view'), dataBase
  //   props in : onmetrics(obj), onready(bool)  - supplied by SandboxFrame
  //   never    : this component does not touch window.__metrics or
  //              data-cover-ready. It reports; the frame publishes.
  //
  // WHAT IS NOT HERE. The sandbox is named for the street at nine in the
  // evening, and there are no agents in it. Building the moving crowd needs a
  // citable published schedule for who is where and when, and none was settled;
  // the number of residents present is computed from published data instead,
  // and nothing is animated. Drawing movement from a schedule nobody published
  // is precisely the failure this course exists to name, so it is not drawn.
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { createMap, attachRedraw } from '../_shared/maplibre.js';
  import { compute, colours, STRIDE, HEIGHT, FLOORS, FLOORS_ADDED } from './gates.js';

  const DISTRICT_KEY = { mn01: 'MN01', mn05: 'MN05' };

  let { params, assets = {}, mode = 'edit', dataBase, onmetrics, onready } = $props();

  let container = $state(null);
  let error = $state(null);
  let loading = $state('reading the massing…');
  let manifest = $state(null);
  let basemapFailed = $state(false);
  let tileFailures = $state(0);

  let map, overlay, detachRedraw, PolygonLayer;
  let buildings, footprints, result;
  let ready = false;
  let pending = 0;

  const FT_TO_M = 0.3048;

  /** Frame the district being looked at, not the union of both. */
  function boundsFor(m, district) {
    const key = DISTRICT_KEY[district];
    return (key && m.district_view_bounds?.[key]) || m.view_bounds || m.bounds;
  }

  async function boot() {
    try {
      const [deckLayers, m] = await Promise.all([
        import('@deck.gl/layers'),
        fetch(`${dataBase}/manifest.json`).then((r) => r.json())
      ]);
      PolygonLayer = deckLayers.PolygonLayer;
      manifest = m;

      const [bBuf, fp] = await Promise.all([
        fetch(`${dataBase}/buildings.bin`).then((r) => r.arrayBuffer()),
        fetch(`${dataBase}/footprints.json`).then((r) => r.json())
      ]);
      buildings = new Float32Array(bBuf);
      footprints = fp;
      if (buildings.length / STRIDE !== footprints.length) {
        throw new Error(
          `buildings.bin has ${buildings.length / STRIDE} rows but ` +
          `footprints.json has ${footprints.length}. Re-run data/scripts/after-five.py.`);
      }

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

      loading = null;
      render();
      detachRedraw = attachRedraw(map, container, render);
    } catch (err) {
      error = String(err?.message ?? err);
      onready?.(true); // never hang the cover pipeline on a data failure
    }
  }

  function render() {
    if (!overlay || !manifest || !buildings) return;

    result = compute(buildings, manifest, params);
    const rgba = colours(result, buildings, params);

    // Each building is drawn as its ground outline extruded to its roof. The
    // CityGML carries several roof levels per building and only the tallest is
    // used here: the stack is in footprints.json for anyone who wants it, and
    // drawing it would be a different sandbox.
    overlay.setProps({
      layers: [
        new PolygonLayer({
          id: 'massing',
          data: footprints,
          extruded: true,
          wireframe: false,
          filled: true,
          pickable: false,
          getPolygon: (d) => d.r,
          getFillColor: (_, { index, target }) => {
            const o = index * 4;
            target[0] = rgba[o]; target[1] = rgba[o + 1];
            target[2] = rgba[o + 2]; target[3] = rgba[o + 3];
            return target;
          },
          getElevation: (_, { index }) => {
            const base = index * STRIDE;
            let ft = buildings[base + HEIGHT];
            // Added floors: the existing roof pushed up by the storeys a filing
            // added. This is the QUANTITY of change, not its form - a building
            // that grew four floors grows a four-floor block, with no setback
            // and no new envelope.
            if (params.added_floors !== false && result.convertedIn[index] >= 0
                && result.convertedIn[index] <= params.year) {
              const floors = buildings[base + FLOORS];
              const added = buildings[base + FLOORS_ADDED];
              if (added > 0 && floors > 0) ft += (ft / floors) * added;
            }
            return ft * FT_TO_M;
          },
          updateTriggers: {
            getFillColor: [rgba],
            getElevation: [params.year, params.added_floors, result]
          }
        })
      ]
    });

    const mt = result.metrics;
    onmetrics?.({
      'units created': Math.round(mt.unitsTotal).toLocaleString(),
      'office floor area removed': `${(mt.officeRemoved / 1e6).toFixed(1)}M sf`,
      'buildings converted': `${mt.converted.toLocaleString()} of ${mt.officeBuildings.toLocaleString()} office buildings`,
      'residents living here afterwards': Math.round(mt.residentsAdded).toLocaleString(),
      'share of office buildings converted': `${(mt.shareConverted * 100).toFixed(1)}%`
    });

    if (!ready) {
      ready = true;
      setTimeout(() => onready?.(true), 500);
    }
  }

  function schedule() {
    if (!map || !manifest) return;
    if (pending) cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => { pending = 0; render(); });
  }

  $effect(() => {
    if (browser && container && !map) boot();
  });

  $effect(() => {
    void [params.year, params.conversion_cost_sf, params.residential_rent,
          params.office_rent_trend, params.incentive_467m,
          params.convertibility_threshold, params.colour_by, params.added_floors,
          params.district];
    schedule();
  });

  // Changing district moves the camera as well as the filter - the two are a
  // mile and a half apart and leaving the view where it was looks like a bug.
  let lastDistrict = null;
  $effect(() => {
    const d = params.district;
    if (!map || !manifest || d === lastDistrict) { lastDistrict = d; return; }
    lastDistrict = d;
    const [w, s, e, n] = boundsFor(manifest, d);
    try { map.fitBounds([[w, s], [e, n]], { padding: 4, duration: 600 }); } catch { /* not ready */ }
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
      {#if params.colour_by === 'convertibility'}
        <span>darker is easier to convert, by our score of published criteria</span>
      {:else if params.colour_by === 'year_converted'}
        <span><i class="sw early"></i>converted early</span>
        <span><i class="sw late"></i>converted late</span>
      {:else}
        <span><i class="sw office"></i>still office</span>
        <span><i class="sw conv"></i>converted to housing</span>
        <span><i class="sw other"></i>neither</span>
      {/if}
      <span class="note">No agents. The street at nine is a count, not a picture.</span>
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
  .office { background: rgb(60,92,138); }
  .conv { background: rgb(205,74,60); }
  .other { background: rgb(176,176,172); }
  .early { background: rgb(40,110,160); }
  .late { background: rgb(240,70,70); }
  .note { color: #999; }
  .warn { color: #a00; font-weight: 700; }
</style>
