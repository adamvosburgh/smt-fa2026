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
  // THE AGENTS ARE HERE NOW, AND THE HOURS ARE PUBLISHED. An earlier version
  // of this file claimed nothing published describes a Manhattan evening;
  // that was true of the two TRIP tables it had evaluated (NHTS 8-1, ACS
  // B08302) and false of the MTA's origin-destination ridership estimate,
  // which gives arrivals at and departures from every complex by hour and
  // day of week. The curves here are counted taps, October 2024 weekdays.
  //
  // What the animation ASSUMES is printed on the canvas, not buried:
  // which building a trip starts at (proportional to jobs), the route
  // (shortest path, not the chosen path), and the attribution of morning
  // arrivals to workers and evening arrivals to residents - the counted
  // curves are not split by who is riding. The gateway share is the one
  // measured piece, and it is labelled as such so the others read as what
  // they are.
  //
  // The two POPULATIONS stay counted, and the panel over the map shows them:
  // office-using jobs from LODES, residents from the 2020 census, what the
  // conversions do to each - and now the ATUS at-workplace curve underneath,
  // the counted number the animation is checked against.
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { createMap, attachRedraw } from '../_shared/maplibre.js';
  import { compute, colours, STRIDE, HEIGHT, FLOORS, FLOORS_ADDED,
           DISTRICT, DISTRICT_INDEX } from './gates.js';
  import AgentsWorker from './agents.worker.js?worker';

  const DISTRICT_KEY = { mn01: 'MN01', mn05: 'MN05' };
  const WORKER_RGB = [60, 92, 138];   // the massing's "still office" blue
  const RESIDENT_RGB = [205, 74, 60]; // the massing's "converted" red

  let { params, assets = {}, mode = 'edit', dataBase, onmetrics, onready } = $props();

  let container = $state(null);
  let error = $state(null);
  let loading = $state('reading the massing…');
  let manifest = $state(null);
  let basemapFailed = $state(false);
  let tileFailures = $state(0);

  let map, overlay, detachRedraw, PolygonLayer, ScatterplotLayer, TripsLayer;
  let buildings, footprints;
  // Footprints pre-filtered per district, built once. The arrays must be
  // STABLE identities: a fresh filter() on every render would make deck.gl
  // retessellate 3,700 polygons per frame while the hour plays.
  let fpByDistrict = null;
  // Scratch buffers for the agent dots, grown once and reused every frame.
  let dotPos = null, dotCol = null;
  // $state, not a plain let: the legend reads the district's Gensler
  // calibration and whether anything converted out of this, so it has to be
  // reactive. The rest of the render path is imperative deck.gl and does not.
  let result = $state(null);
  // The cached colour array, module-level ON PURPOSE. The hour ticks ~30
  // times a second while the clock plays, and rebuilding this each tick made
  // deck.gl re-upload 3,728 fills per frame - that stutter read as the
  // animation's fault. Identity-stable between heavy passes, so deck's
  // updateTriggers see nothing to do on an hour tick.
  let rgba = null;
  // Same idea for the TripsLayer's data wrapper: a fresh object literal per
  // frame makes deck re-diff the binary attributes. Built once per timetable.
  let tripsData = null;
  let ready = false;
  let pending = 0;
  let pendingHeavy = false;

  // --- the agent layer ---------------------------------------------------
  // A persistent worker builds the day's TIMETABLE - every trip, timestamped
  // in seconds-of-day - whenever a parameter that moves people changes.
  // Scrubbing the hour never regenerates anything: it only moves
  // TripsLayer's currentTime over the same binary attributes. A generation
  // counter drops stale answers; old trips keep rendering while new ones
  // build, so a slider move morphs rather than flashes.
  let agentWorker = null;
  let agentData = null;      // { gateways, flow, occupancy, agentsMeta }
  let trips = null;          // latest binary timetable from the worker
  let agentGen = 0;
  let agentsDirty = false;
  let workerReady = false;
  let occupancy = $state(null);
  let agentsOn = $state(false);

  const FT_TO_M = 0.3048;

  /**
   * The presence panel. Two counted populations and what the conversions do to
   * each, on one shared scale so the comparison is the graphic rather than
   * something the reader has to do in their head.
   *
   * The scale is the larger of the two standing populations, so the two deltas
   * come out as the slivers they are - which is the honest shape of this. A
   * conversion programme that reads as enormous in units is small against the
   * number of people who are already here in the daytime.
   */
  const bars = $derived.by(() => {
    const m = result?.metrics;
    if (!m) return [];
    const jobs = m.officeJobsHere ?? 0;
    const res = m.residentsHere ?? 0;
    const top = Math.max(jobs, res, 1);
    const n = (v) => Math.round(v).toLocaleString();
    // No sign on a zero: "-0" reads as a rounding artefact rather than as
    // "nothing converted", which at the shipped defaults is the actual answer.
    const d = (v, sign) => (Math.round(v) === 0 ? '0' : sign + n(v));
    return [
      { label: 'at work in offices, in the day', n: n(jobs), pct: 100 * jobs / top },
      { label: 'living here', n: n(res), pct: 100 * res / top },
      { label: 'office jobs the conversions take away', delta: true,
        n: d(m.officeJobsRemoved ?? 0, '\u2212'),
        pct: 100 * (m.officeJobsRemoved ?? 0) / top },
      { label: 'residents the conversions add', delta: true,
        n: d(m.residentsAdded ?? 0, '+'),
        pct: 100 * (m.residentsAdded ?? 0) / top }
    ];
  });

  /** Frame the district being looked at, not the union of both. */
  function boundsFor(m, district) {
    const key = DISTRICT_KEY[district];
    return (key && m.district_view_bounds?.[key]) || m.view_bounds || m.bounds;
  }

  // THE CROP. The simulation is a district, so the map is that district: a
  // rectangle of city on the page's own ground, not a city fading off into
  // basemap. Three pieces, and they only work together:
  //   - the mask, a page-coloured polygon with the district cut out of it,
  //     drawn as the ground so the basemap outside the rectangle never shows;
  //   - the massing filtered to the district, because a masked ground does
  //     nothing about a 3D tower standing on it a mile away;
  //   - the camera clamped near the rectangle, so you cannot pan off the
  //     model and find the blank paper.
  function clampCamera() {
    if (!map || !manifest) return;
    const [w, s, e, n] = boundsFor(manifest, params.district);
    const pw = (e - w) * 0.4, ph = (n - s) * 0.4;
    try { map.setMaxBounds([[w - pw, s - ph], [e + pw, n + ph]]); } catch { /* not ready */ }
  }

  function maskLayer() {
    const [w, s, e, n] = boundsFor(manifest, params.district);
    // The outer ring has to outrun the HORIZON, not the pan limits - at pitch
    // 50 the camera sees tens of degrees past its own centre.
    const P = 8;
    return new PolygonLayer({
      id: 'crop-mask',
      data: [{
        p: [
          [[w - P, s - P], [e + P, s - P], [e + P, n + P], [w - P, n + P]],
          [[w, s], [e, s], [e, n], [w, n]]
        ]
      }],
      getPolygon: (d) => d.p,
      filled: true,
      stroked: false,
      pickable: false,
      // Unlit, or the tilted view shades the "page" like a surface in the scene.
      material: false,
      getFillColor: [244, 244, 242, 255],
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
      ScatterplotLayer = deckLayers.ScatterplotLayer;
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
      clampCamera();

      loading = null;
      render();
      // Not `render` bare: attachRedraw calls back with a map event, which
      // would land in the `light` parameter and skip the first real pass.
      detachRedraw = attachRedraw(map, container, () => render());
      if (mode === 'edit') bootAgents();
    } catch (err) {
      error = String(err?.message ?? err);
      onready?.(true); // never hang the cover pipeline on a data failure
    }
  }

  // The agent layer loads after the massing and never blocks it: a missing
  // agents build degrades to the sandbox as it was, with a note in the
  // legend, rather than a dead page. View mode (the gallery) skips it -
  // thirty timetables on one page would melt a laptop for thirty thumbnails.
  async function bootAgents() {
    try {
      const [geoLayers, agentsMeta, gws, flow, occ, graphBuf, routesBuf] = await Promise.all([
        import('@deck.gl/geo-layers'),
        fetch(`${dataBase}/agents.json`).then((r) => { if (!r.ok) throw new Error('no agents.json'); return r.json(); }),
        fetch(`${dataBase}/gateways.json`).then((r) => r.json()),
        fetch(`${dataBase}/flow.json`).then((r) => r.json()),
        fetch(`${dataBase}/occupancy.json`).then((r) => r.json()),
        fetch(`${dataBase}/graph.bin`).then((r) => r.arrayBuffer()),
        fetch(`${dataBase}/routes.bin`).then((r) => r.arrayBuffer())
      ]);
      TripsLayer = geoLayers.TripsLayer;
      const nNodes = agentsMeta.graph.nodes;
      const nodes = graphBuf.slice(0, nNodes * 2 * 4);
      agentData = { gateways: gws.gateways, flow, agentsMeta };
      occupancy = occ;
      agentWorker = new AgentsWorker();
      agentWorker.onmessage = (e) => {
        const d = e.data;
        if (d.type === 'ready') {
          workerReady = true;
          agentsDirty = true;
          schedule();
          return;
        }
        if (d.type !== 'trips' || d.gen !== agentGen) return; // stale answer
        trips = d;
        tripsData = null; // new timetable, new wrapper
        agentsOn = true;
        onready?.(true);
        schedule(false); // the massing didn't change, only the crowd
      };
      agentWorker.onerror = (err) => {
        console.error('agents worker failed', err);
        agentsOn = false;
        onready?.(true);
      };
      agentWorker.postMessage({
        type: 'init',
        nodes,
        routes: routesBuf,
        gateways: gws.gateways,
        flow,
        manifest: $state.snapshot(manifest),
        buildings: buildings.buffer.slice(0)
      });
    } catch (err) {
      console.warn('agent layer unavailable:', err?.message ?? err);
    }
  }

  function postSample() {
    if (!workerReady || !result) return;
    agentGen += 1;
    onready?.(false);
    agentWorker.postMessage({
      type: 'sample',
      gen: agentGen,
      params: $state.snapshot(params),
      state: result.state.buffer.slice(0),
      unitsOf: result.unitsOf.buffer.slice(0),
      metrics: $state.snapshot(result.metrics),
      seed: 20260904
    });
  }

  // TWO RENDER PATHS, ONE FUNCTION. A heavy pass re-scores every building
  // (compute + colours); a light pass reuses the cached result and only moves
  // what the hour moves - the dots, the trail head, the mid-walk count. The
  // clock emits ~30 hour values a second while it plays, and every one of
  // them used to take the heavy path.
  function render(light = false) {
    if (!overlay || !manifest || !buildings) return;

    if (!light || !result || !rgba) {
      result = compute(buildings, manifest, params);
      rgba = colours(result, buildings, params);
    }

    // Each building is drawn as its ground outline extruded to its roof. The
    // CityGML carries several roof levels per building and only the tallest is
    // used here: the stack is in footprints.json for anyone who wants it, and
    // drawing it would be a different sandbox. The data is the district's own
    // footprints - the accessors go through d.i because the filtered array's
    // positions no longer line up with buildings.bin's rows.
    const layers = [
        maskLayer(),
        new PolygonLayer({
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
            // Added floors: the existing roof pushed up by the storeys a filing
            // added. This is the QUANTITY of change, not its form - a building
            // that grew four floors grows a four-floor block, with no setback
            // and no new envelope.
            if (params.added_floors !== false && result.convertedIn[d.i] >= 0
                && result.convertedIn[d.i] <= params.year) {
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
    ];

    // The agents: a DOT for every walker at their position this second, with a
    // short trail behind it for direction. Both layers share the depth buffer
    // with the massing, so a walker behind a tower is hidden by the tower -
    // real occlusion, which is what a crowd IN a city looks like. (An earlier
    // version drew the trails with the depth test off so nothing could hide
    // them; the result read as a diagram floating over the model.)
    //
    // The positions are interpolated here, on the main thread, every frame the
    // hour moves - the timetable already holds each trip's node times, so a
    // dot is one lerp per walker. The same loop counts who is mid-walk for the
    // metrics strip, so the picture and the number still share one source.
    const t = ((params.hour ?? 8) % 24) * 3600;
    let nDots = 0, walkingW = 0, walkingR = 0;
    if (trips && trips.length > 0) {
      if (!dotPos || dotPos.length < trips.length * 3) {
        dotPos = new Float32Array(trips.length * 3);
        dotCol = new Uint8Array(trips.length * 3);
      }
      for (let i = 0; i < trips.length; i++) {
        const s = trips.startIndices[i], e = trips.startIndices[i + 1];
        if (trips.timestamps[s] > t || trips.timestamps[e - 1] < t) continue;
        trips.roles[i] ? walkingR++ : walkingW++;
        let j = s;
        while (j < e - 2 && trips.timestamps[j + 1] < t) j++;
        const t0 = trips.timestamps[j], t1 = trips.timestamps[j + 1];
        const f = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
        const o = nDots * 3;
        dotPos[o] = trips.positions[2 * j] + (trips.positions[2 * (j + 1)] - trips.positions[2 * j]) * f;
        dotPos[o + 1] = trips.positions[2 * j + 1] + (trips.positions[2 * (j + 1) + 1] - trips.positions[2 * j + 1]) * f;
        dotPos[o + 2] = 0;
        const c = trips.roles[i] ? RESIDENT_RGB : WORKER_RGB;
        dotCol[o] = c[0]; dotCol[o + 1] = c[1]; dotCol[o + 2] = c[2];
        nDots++;
      }
    }
    if (trips && TripsLayer && trips.length > 0) {
      if (!tripsData) {
        tripsData = {
          length: trips.length,
          startIndices: trips.startIndices,
          attributes: {
            getPath: { value: trips.positions, size: 2 },
            getTimestamps: { value: trips.timestamps, size: 1 }
          }
        };
      }
      layers.push(new TripsLayer({
        id: 'agent-trails',
        data: tripsData,
        _pathType: 'open',
        getColor: (_, { index }) =>
          trips.roles[index] ? RESIDENT_RGB : WORKER_RGB,
        currentTime: t,
        trailLength: 240,
        fadeTrail: true,
        capRounded: true,
        jointRounded: true,
        opacity: 0.55,
        widthMinPixels: 1.5,
        updateTriggers: { getColor: [trips] }
      }));
    }
    if (nDots > 0 && ScatterplotLayer) {
      layers.push(new ScatterplotLayer({
        id: 'agent-dots',
        data: {
          length: nDots,
          attributes: {
            getPosition: { value: dotPos.subarray(0, nDots * 3), size: 3 },
            getFillColor: { value: dotCol.subarray(0, nDots * 3), size: 3 }
          }
        },
        pickable: false,
        // The halo is what makes a dot read against both the dark towers and
        // the pale ground; constant accessors, so it costs one uniform.
        stroked: true,
        getLineColor: [255, 255, 255, 210],
        lineWidthUnits: 'pixels',
        getLineWidth: 1,
        radiusUnits: 'meters',
        getRadius: 12,
        radiusMinPixels: 3,
        radiusMaxPixels: 9
      }));
    }
    overlay.setProps({ layers });

    // A slider that moves people means a new timetable; the flag is set by
    // the heavy effect and consumed here, after compute() has refreshed the
    // state the sampler weights by.
    if (agentsDirty && workerReady) {
      agentsDirty = false;
      postSample();
    }

    const mt = result.metrics;
    // Who is mid-walk at the current hour - counted in the same loop that
    // placed the dots, so the picture and the number share one source.
    const walking = trips && trips.length > 0
      ? `${walkingW.toLocaleString()} workers · ${walkingR.toLocaleString()} residents`
      : '';
    onmetrics?.({
      ...(walking ? { 'mid-walk at this hour': walking } : {}),
      'units created': Math.round(mt.unitsTotal).toLocaleString(),
      'office floor area removed': `${(mt.officeRemoved / 1e6).toFixed(1)}M sf`,
      'buildings converted': `${mt.converted.toLocaleString()} of ${mt.officeBuildings.toLocaleString()} office buildings`,
      'residents living here afterwards': Math.round(mt.residentsAdded).toLocaleString(),
      'office jobs displaced': Math.round(mt.officeJobsRemoved).toLocaleString(),
      'share of office buildings converted': `${(mt.shareConverted * 100).toFixed(1)}%`
    });

    if (!ready) {
      ready = true;
      setTimeout(() => onready?.(true), 500);
    }
  }

  // The four rent scenario stops, for the legend line naming which one is
  // selected and whose number it is. The full justifications live in the
  // schema's x-enum-notes; this is the short form the map carries.
  const RENT_STOPS = {
    54: { label: 'the published asking rent', provenance: 'sourced' },
    41: { label: 'what a landlord collects', provenance: 'ours' },
    32: { label: 'a building in trouble', provenance: 'ours' },
    70: { label: 'not really Class B', provenance: 'ours' }
  };
  const rentStop = $derived(RENT_STOPS[params.office_rent] ?? null);

  // One rAF, and heavy wins: if a slider and the clock both land before the
  // next frame, the frame is a heavy one.
  function schedule(heavy = true) {
    if (!map || !manifest) return;
    pendingHeavy = pendingHeavy || heavy;
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      const h = pendingHeavy;
      pendingHeavy = false;
      render(!h);
    });
  }

  $effect(() => {
    if (browser && container && !map) boot();
  });

  $effect(() => {
    void [params.year, params.conversion_cost_sf, params.residential_rent,
          params.office_rent_trend, params.office_rent,
          params.cap_rate_office, params.cap_rate_residential,
          params.min_units_for_conversion_sample,
          params.opex_share, params.incentive_467m,
          params.w_depth, params.w_f2f, params.w_area, params.w_age,
          params.convertibility_threshold, params.colour_by, params.added_floors,
          params.district,
          // ...and the ones that only move the crowd. Same heavy path: the
          // sampler weights by compute()'s output, so both rerun together.
          params.agent_count, params.schedule_source, params.arrival_median,
          params.arrival_spread, params.departure_median, params.departure_spread];
    agentsDirty = true;
    schedule();
  });

  // The hour is the light path: dots and currentTime only, never a new
  // timetable and never a re-score of the massing.
  $effect(() => {
    void params.hour;
    schedule(false);
  });

  // Changing district moves the camera as well as the filter - the two are a
  // mile and a half apart and leaving the view where it was looks like a bug.
  let lastDistrict = null;
  $effect(() => {
    const d = params.district;
    if (!map || !manifest || d === lastDistrict) { lastDistrict = d; return; }
    lastDistrict = d;
    clampCamera();
    const [w, s, e, n] = boundsFor(manifest, d);
    try { map.fitBounds([[w, s], [e, n]], { padding: 4, duration: 600 }); } catch { /* not ready */ }
  });

  onDestroy(() => {
    cancelAnimationFrame(pending);
    agentWorker?.terminate();
    try { detachRedraw?.(); } catch { /* never attached */ }
    try { map?.remove(); } catch { /* already gone */ }
  });

  // The occupancy sparkline: ATUS's at-workplace share for office
  // occupations, 96 bins, with a playhead at the current hour. This is the
  // COUNTED curve the animation gets checked against - if the swarm empties
  // while the survey says desks are full, the swarm is wrong.
  const occPath = $derived.by(() => {
    if (!occupancy) return null;
    const s = occupancy.at_workplace_share;
    const max = Math.max(...s, 0.01);
    return s.map((v, i) =>
      `${(i / (s.length - 1) * 100).toFixed(1)},${(30 - (v / max) * 28).toFixed(1)}`
    ).join(' ');
  });
  const occNow = $derived.by(() => {
    if (!occupancy) return null;
    const s = occupancy.at_workplace_share;
    const i = Math.min(s.length - 1, Math.floor(((params.hour ?? 8) / 24) * s.length));
    return { x: ((params.hour ?? 8) / 24) * 100, share: s[i] };
  });
</script>

<div class="wrap">
  <div class="map" bind:this={container}></div>

  {#if error}
    <p class="err">Couldn't load the data for this one: {error}</p>
  {:else if loading}
    <p class="loading">{loading}</p>
  {/if}

  {#if manifest && !error && result && manifest.presence?.districts}
    <!-- The two populations, counted - and now the two counted curves under
         them: MTA taps drive the animation, ATUS occupancy checks it. -->
    <div class="presence">
      <h4>who is here</h4>
      {#each bars as b}
        <div class="row" class:delta={b.delta}>
          <span class="bar" style="width:{b.pct}%"></span>
          <span class="n">{b.n}</span>
          <span class="l">{b.label}</span>
        </div>
      {/each}
      {#if occupancy && occPath}
        <div class="occ">
          <svg viewBox="0 0 100 32" preserveAspectRatio="none">
            <polyline points={occPath} fill="none" stroke="#3c5c8a" stroke-width="1" />
            {#if occNow}
              <line x1={occNow.x} y1="0" x2={occNow.x} y2="32" stroke="#a03424" stroke-width="0.6" />
            {/if}
          </svg>
          <p class="occ-note">
            {#if occNow}{Math.round(occNow.share * 100)}% of office-occupation
              workers at their workplace now{/if}
            — ATUS 2003–2025, the counted curve the swarm is checked against.
          </p>
        </div>
      {/if}
      <p class="gap">An earlier version said no published table describes this
        district's evening. That was true of the trip tables it had checked and
        false in general: the MTA's origin-destination estimate counts arrivals
        and departures at every complex by hour, and those counted taps are
        what the animation runs on.</p>
    </div>
  {/if}

  {#if agentsOn && !error}
    <!-- The register. Three lines, and only one of them is measured - which
         is the point of labelling it. -->
    <div class="assumptions">
      <span class="a"><i>assumed</i> which building a trip starts at: proportional to jobs</span>
      <span class="a"><i>assumed</i> the route: shortest path, not the chosen path</span>
      <span class="m"><i>measured</i> the gateway share: counted taps, MTA O-D 2024</span>
    </div>
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
      <!-- An empty map has to read as an ANSWER, not as a broken sandbox. At
           the published office rent nothing clears the deal, and a reader who
           is not told that will assume the data failed to load. -->
      {#if result && result.metrics.converted === 0}
        <span class="none">Nothing clears the deal at these numbers. That is the
          model's answer, not a failure to load - the office rent it is competing
          against is {rentStop ? `${rentStop.label}` : 'the published asking rent'}.</span>
      {/if}
      <!-- Which rent stop is selected, and whose number it is. One stop is
           sourced; the other three are ours, and the difference is the point. -->
      {#if rentStop}
        <span class="note">office rent ${params.office_rent}/sf/yr —
          {rentStop.label}, <b>{rentStop.provenance}</b></span>
      {/if}
      {#if result?.gensler != null}
        <span class="note">Gensler found about a quarter of the buildings they
          scored convertible. Our score passes a quarter of this district at a
          threshold of {result.gensler.toFixed(2)} - it moves when the weights
          move.</span>
      {/if}
      {#if agentsOn}
        <span><i class="sw worker"></i>workers, in by morning, out by evening</span>
        <span><i class="sw resident"></i>residents, the reverse</span>
      {:else}
        <span class="note">agents still loading — the counts are already right</span>
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
  /* Every HTML panel sits above z-index 5. The deck.gl canvas is added to the
     map as a control, and MapLibre's control container carries z-index 2 - so
     an overlay without its own z-index paints UNDER the model, and at pitch 50
     the towers walk straight over the prose. */
  .loading, .err {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    font-size: 0.75rem; color: #888; background: rgba(255,255,255,0.9);
    padding: 0.4rem 0.7rem; z-index: 5;
  }
  .err { color: #a00; max-width: 70%; text-align: center; }
  .key {
    position: absolute; left: 0.6rem; bottom: 0.6rem; z-index: 5;
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
  .worker { background: rgb(60,92,138); }
  .resident { background: rgb(205,74,60); }
  .note { color: #999; }
  .none { color: #222; }
  .presence {
    position: absolute; right: 0.6rem; top: 0.6rem; width: 15rem; z-index: 5;
    background: rgba(255,255,255,0.9); padding: 0.5rem 0.6rem 0.45rem;
    font-size: 0.62rem; line-height: 1.35; color: #444; pointer-events: none;
  }
  .presence h4 {
    margin: 0 0 0.4rem; font-size: 0.62rem; font-weight: 400; color: #999;
    text-transform: lowercase; letter-spacing: 0.06em;
    border-bottom: 1px solid #eee; padding-bottom: 0.3rem;
  }
  .presence .row { margin-bottom: 0.35rem; }
  .presence .bar {
    display: block; height: 5px; background: #3c5c8a; min-width: 1px;
    margin-bottom: 0.12rem;
  }
  .presence .delta .bar { background: #cd4a3c; }
  .presence .n { font-variant-numeric: tabular-nums; font-weight: 700; color: #222; }
  .presence .l { color: #666; }
  .presence .gap {
    margin: 0.5rem 0 0; padding-top: 0.4rem; border-top: 1px solid #eee;
    color: #666; font-size: 0.6rem;
  }
  .occ { margin-top: 0.45rem; padding-top: 0.35rem; border-top: 1px solid #eee; }
  .occ svg { display: block; width: 100%; height: 32px; }
  .occ-note { margin: 0.15rem 0 0; font-size: 0.58rem; color: #666; }
  .assumptions {
    position: absolute; left: 0.6rem; top: 0.6rem; z-index: 5;
    display: flex; flex-direction: column; gap: 0.15rem;
    background: rgba(255,255,255,0.88); padding: 0.4rem 0.55rem;
    font-size: 0.6rem; line-height: 1.4; color: #444; pointer-events: none;
  }
  .assumptions i {
    font-style: normal; font-size: 0.55rem; letter-spacing: 0.05em;
    margin-right: 0.3rem; padding: 0 0.2rem;
  }
  .assumptions .a i { background: #eee; color: #888; }
  .assumptions .m i { background: #000; color: #fff; }
  .warn { color: #a00; font-weight: 700; }
</style>
