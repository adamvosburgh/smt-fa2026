<script>
  // Sandbox 02 - Office to Residential Conversion (slug after-five).
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
  import { compute, colors, STRIDE, HEIGHT, FLOORS, FLOORS_ADDED,
           DISTRICT, DISTRICT_INDEX } from './gates.js';
  import { mulberry32 } from './agents.js';
  import AgentsWorker from './agents.worker.js?worker';

  const DISTRICT_KEY = { mn01: 'MN01', mn05: 'MN05' };
  const WORKER_RGB = [60, 92, 138];   // the massing's "still office" blue
  const RESIDENT_RGB = [205, 74, 60]; // the massing's "converted" red
  // The two-hour comparison recolours the crowd by HOUR instead of by role:
  // the main clock's crowd in slate, the second hour's in amber. Streets then
  // show the difference between the two, in the same two hues.
  const HOUR_A_RGB = [70, 82, 96];
  const HOUR_B_RGB = [224, 138, 43];
  // Ground floors: a converted building's frontage, lit or dark. The draw is
  // deterministic per building so the slider re-interprets the same luck.
  const LIT_RGB = [242, 178, 64, 245];
  const DARK_RGB = [48, 48, 56, 245];

  let { params, assets = {}, mode = 'edit', dataBase, onmetrics, onready } = $props();

  let container = $state(null);
  let error = $state(null);
  let loading = $state('loading the buildings…');
  let manifest = $state(null);
  let basemapFailed = $state(false);
  let tileFailures = $state(0);

  let map, overlay, detachRedraw, PolygonLayer, ScatterplotLayer, LineLayer,
      PathLayer, TripsLayer;
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
  // The cached color array, module-level ON PURPOSE. The hour ticks ~30
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

  // --- the street layer --------------------------------------------------
  // The graph's own geometry, kept on the main thread so each segment can be
  // drawn (and stood on). edgeHours arrives with every timetable: walkers per
  // segment per hour, counted in the worker over the un-coarsened paths.
  let graphNodes = null;     // Float32 lon/lat per node
  let graphEdges = null;     // Uint16 node pairs
  let nEdges = 0;
  let edgeSrc = null, edgeTgt = null;   // binary positions for LineLayer
  let streetCols = null, streetWidths = null, streetData = null;
  let streetKey = '';        // what the cached color arrays were built for
  let tripsVersion = 0;
  // The ground-floor rings: converted footprints, refiltered per heavy pass.
  let groundData = null;
  // Street view: the segment being stood on, or null for the district view.
  let streetView = $state(null);

  const FT_TO_M = 0.3048;

  /**
   * The presence panel. Two counted populations and what the conversions do to
   * each, on one shared scale so the comparison is the graphic rather than
   * something the reader has to do in their head.
   *
   * The scale is the larger of the two standing populations, so the two deltas
   * come out as the slivers they are - which is the honest shape of this. A
   * conversion program that reads as enormous in units is small against the
   * number of people who are already here in the daytime.
   */
  const bars = $derived.by(() => {
    const m = result?.metrics;
    if (!m) return [];
    const jobs = m.officeJobsHere ?? 0;
    const res = m.residentsHere ?? 0;
    const top = Math.max(jobs, res, 1);
    const n = (v) => Math.round(v).toLocaleString();
    // No sign on a zero: "-0" reads as a rounding artifact rather than as
    // "nothing converted", which at the shipped defaults is the actual answer.
    const d = (v, sign) => (Math.round(v) === 0 ? '0' : sign + n(v));
    return [
      { label: 'office jobs in the district by day', n: n(jobs), pct: 100 * jobs / top },
      { label: 'residents', n: n(res), pct: 100 * res / top },
      { label: 'office jobs removed by the conversions', delta: true,
        n: d(m.officeJobsRemoved ?? 0, '\u2212'),
        pct: 100 * (m.officeJobsRemoved ?? 0) / top },
      { label: 'residents added by the conversions', delta: true,
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
  //   - the mask, a page-colored polygon with the district cut out of it,
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
    // 50 the camera sees tens of degrees past its own center.
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
      LineLayer = deckLayers.LineLayer;
      PathLayer = deckLayers.PathLayer;
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
      // Street view needs to see down a street, not down at one. MapLibre's
      // default ceiling is 60; 85 is the library's own maximum.
      map.setMaxPitch(85);
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
      // The edges follow the nodes in graph.bin. They stay here for drawing
      // and go to the worker for counting, so the street a walker is drawn on
      // and the street their traversal is charged to are the same row.
      nEdges = agentsMeta.graph.edges;
      const edges = graphBuf.slice(nNodes * 2 * 4, nNodes * 2 * 4 + nEdges * 2 * 2);
      graphNodes = new Float32Array(nodes.slice(0));
      graphEdges = new Uint16Array(edges.slice(0));
      edgeSrc = new Float32Array(nEdges * 2);
      edgeTgt = new Float32Array(nEdges * 2);
      for (let i = 0; i < nEdges; i++) {
        const a = graphEdges[i * 2], b = graphEdges[i * 2 + 1];
        edgeSrc[i * 2] = graphNodes[a * 2]; edgeSrc[i * 2 + 1] = graphNodes[a * 2 + 1];
        edgeTgt[i * 2] = graphNodes[b * 2]; edgeTgt[i * 2 + 1] = graphNodes[b * 2 + 1];
      }
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
        tripsVersion += 1; // the street colors are cached against this
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
        edges,
        routes: routesBuf,
        gateways: gws.gateways,
        flow,
        residentCurves: occ.residents ?? null,
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
  // (compute + colors); a light pass reuses the cached result and only moves
  // what the hour moves - the dots, the trail head, the mid-walk count. The
  // clock emits ~30 hour values a second while it plays, and every one of
  // them used to take the heavy path.
  function render(light = false) {
    if (!overlay || !manifest || !buildings) return;

    if (!light || !result || !rgba) {
      result = compute(buildings, manifest, params);
      rgba = colors(result, buildings, params);
      // The converted footprints, for the ground-floor rings. Refiltered only
      // here: the set changes when the massing does, never with the clock.
      groundData = fpFor(params.district).filter((d) => result.state[d.i] === 2);
    }

    const cmp = params.compare_hours === true;
    const tB = ((params.hour_b ?? 20) % 24) * 3600;

    // Each building is drawn as its ground outline extruded to its roof. The
    // CityGML carries several roof levels per building and only the tallest is
    // used here: the stack is in footprints.json for anyone who wants it, and
    // drawing it would be a different sandbox. The data is the district's own
    // footprints - the accessors go through d.i because the filtered array's
    // positions no longer line up with buildings.bin's rows.
    const layers = [maskLayer()];

    // The street, counted. Every timetable arrives with walkers-per-segment-
    // per-hour; here the selected hour's column becomes color and width. The
    // scale is the day's busiest segment, so 20:00 and 08:00 are comparable
    // by eye. In compare mode the color is the DIFFERENCE between the two
    // hours: amber where the second hour has more walkers, slate where the
    // first does.
    const t = ((params.hour ?? 8) % 24) * 3600;
    const binA = Math.min(23, Math.floor((params.hour ?? 8) % 24));
    const binB = Math.min(23, Math.floor((params.hour_b ?? 20) % 24));
    if (params.streets !== false && LineLayer && trips?.edgeHours && nEdges > 0) {
      const key = `${binA}|${cmp ? binB : ''}|${tripsVersion}`;
      if (key !== streetKey || !streetCols) {
        streetKey = key;
        streetCols = new Uint8Array(nEdges * 4);
        streetWidths = new Float32Array(nEdges);
        const eh = trips.edgeHours;
        let max = 0;
        if (cmp) {
          for (let i = 0; i < nEdges; i++) {
            const d = Math.abs(eh[binB * nEdges + i] - eh[binA * nEdges + i]);
            if (d > max) max = d;
          }
        } else {
          for (let i = 0; i < eh.length; i++) if (eh[i] > max) max = eh[i];
        }
        const inv = max > 0 ? 1 / max : 0;
        for (let i = 0; i < nEdges; i++) {
          let v, c;
          if (cmp) {
            const d = eh[binB * nEdges + i] - eh[binA * nEdges + i];
            v = Math.sqrt(Math.abs(d) * inv);
            c = d > 0 ? HOUR_B_RGB : HOUR_A_RGB;
          } else {
            v = Math.sqrt(eh[binA * nEdges + i] * inv);
            c = [30, 32, 38];
          }
          const o = i * 4;
          streetCols[o] = c[0]; streetCols[o + 1] = c[1]; streetCols[o + 2] = c[2];
          // The floor alpha keeps the empty network faintly there - a blank
          // street is part of the answer, and it stays clickable.
          streetCols[o + 3] = Math.round(16 + v * 220);
          streetWidths[i] = 1 + 5 * v;
        }
        // A fresh wrapper object per recompute: the arrays are mutated in
        // place and deck only re-reads them when the data identity changes.
        streetData = {
          length: nEdges,
          attributes: {
            getSourcePosition: { value: edgeSrc, size: 2 },
            getTargetPosition: { value: edgeTgt, size: 2 },
            getColor: { value: streetCols, size: 4 },
            getWidth: { value: streetWidths, size: 1 }
          }
        };
      }
      layers.push(new LineLayer({
        id: 'street-counts',
        data: streetData,
        positionFormat: 'XY',
        widthUnits: 'pixels',
        widthMinPixels: 1,
        widthMaxPixels: 8,
        pickable: mode === 'edit',
        onClick: standOnStreet
      }));
    }

    layers.push(
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
            // Added floors: the existing roof pushed up by the stories a filing
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
    );

    // The ground-floor rule, drawn. Each converted building's frontage is a
    // ring at its base: warm where the per-building draw comes up active at
    // the slider's probability, dark where it doesn't. Deterministic per
    // building, so dragging the slider flips floors in a fixed order rather
    // than rerolling the district.
    if (PathLayer && groundData && groundData.length > 0) {
      const pGf = params.ground_floor_p ?? 0.5;
      layers.push(new PathLayer({
        id: 'ground-floors',
        data: groundData,
        getPath: (d) => d.r,
        getColor: (d) => (mulberry32(20260905 + d.i)() < pGf ? LIT_RGB : DARK_RGB),
        widthUnits: 'pixels',
        getWidth: 2.5,
        widthMinPixels: 2,
        widthMaxPixels: 5,
        pickable: false,
        updateTriggers: { getColor: [pGf], getPath: [groundData] }
      }));
    }

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
    let nDots = 0, walkingW = 0, walkingR = 0, walkingA = 0, walkingB = 0;
    if (trips && trips.length > 0) {
      const need = trips.length * 3 * (cmp ? 2 : 1);
      if (!dotPos || dotPos.length < need) {
        dotPos = new Float32Array(need);
        dotCol = new Uint8Array(need);
      }
      // One placement pass per drawn hour. In compare mode the same crowd is
      // placed twice and colored by hour; otherwise once, colored by role.
      const place = (tt, hourColour) => {
        let mid = 0;
        for (let i = 0; i < trips.length; i++) {
          const s = trips.startIndices[i], e = trips.startIndices[i + 1];
          if (trips.timestamps[s] > tt || trips.timestamps[e - 1] < tt) continue;
          mid++;
          trips.roles[i] ? walkingR++ : walkingW++;
          let j = s;
          while (j < e - 2 && trips.timestamps[j + 1] < tt) j++;
          const t0 = trips.timestamps[j], t1 = trips.timestamps[j + 1];
          const f = t1 > t0 ? (tt - t0) / (t1 - t0) : 0;
          const o = nDots * 3;
          dotPos[o] = trips.positions[2 * j] + (trips.positions[2 * (j + 1)] - trips.positions[2 * j]) * f;
          dotPos[o + 1] = trips.positions[2 * j + 1] + (trips.positions[2 * (j + 1) + 1] - trips.positions[2 * j + 1]) * f;
          dotPos[o + 2] = 0;
          const c = hourColour ?? (trips.roles[i] ? RESIDENT_RGB : WORKER_RGB);
          dotCol[o] = c[0]; dotCol[o + 1] = c[1]; dotCol[o + 2] = c[2];
          nDots++;
        }
        return mid;
      };
      walkingA = place(t, cmp ? HOUR_A_RGB : null);
      if (cmp) walkingB = place(tB, HOUR_B_RGB);
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
      // In compare mode the SAME timetable is drawn twice, once per hour,
      // each in its hour's color - two crowds on one street network, which
      // is the comparison without splitting the view.
      const trailProps = {
        data: tripsData,
        _pathType: 'open',
        trailLength: 240,
        fadeTrail: true,
        capRounded: true,
        jointRounded: true,
        opacity: 0.55,
        widthMinPixels: 1.5
      };
      if (cmp) {
        layers.push(
          new TripsLayer({ ...trailProps, id: 'agent-trails-a',
            getColor: HOUR_A_RGB, currentTime: t }),
          new TripsLayer({ ...trailProps, id: 'agent-trails-b',
            getColor: HOUR_B_RGB, currentTime: tB })
        );
      } else {
        layers.push(new TripsLayer({
          ...trailProps,
          id: 'agent-trails',
          getColor: (_, { index }) =>
            trips.roles[index] ? RESIDENT_RGB : WORKER_RGB,
          currentTime: t,
          updateTriggers: { getColor: [trips] }
        }));
      }
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
    // placed the dots, so the picture and the number share one source. In
    // compare mode the split by role gives way to the split by hour.
    const walking = trips && trips.length > 0
      ? (cmp
        ? `${walkingA.toLocaleString()} at ${clock(params.hour ?? 8)} · ` +
          `${walkingB.toLocaleString()} at ${clock(params.hour_b ?? 20)}`
        : `${walkingW.toLocaleString()} workers · ${walkingR.toLocaleString()} residents`)
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
    54: { label: 'published asking rent', provenance: 'sourced' },
    41: { label: '25% below asking', provenance: 'ours' },
    32: { label: '40% below asking', provenance: 'ours' },
    70: { label: 'top of the Class B/C band', provenance: 'ours' }
  };
  const rentStop = $derived(RENT_STOPS[params.office_rent] ?? null);

  function clock(h) {
    const m = Math.round(((h % 24) % 1) * 60);
    return `${String(Math.floor(h % 24)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // --- street view --------------------------------------------------------
  // Clicking a segment stands the camera on it: eye-ish height, looking down
  // the street, with the walkers passing. A camera change and nothing else -
  // the same massing, the same crowd, no new data. This is the cheapest
  // answer to "the map reads as disembodied from the space it describes".
  function standOnStreet(info) {
    if (!map || !graphEdges || info?.index == null || info.index < 0) return;
    const i = info.index;
    const a = graphEdges[i * 2], b = graphEdges[i * 2 + 1];
    const ax = graphNodes[a * 2], ay = graphNodes[a * 2 + 1];
    const bx = graphNodes[b * 2], by = graphNodes[b * 2 + 1];
    const bearing = (Math.atan2((bx - ax) * Math.cos((ay * Math.PI) / 180), by - ay)
      * 180) / Math.PI;
    streetView = { index: i };
    map.easeTo({
      center: [(ax + bx) / 2, (ay + by) / 2],
      zoom: 18.4, pitch: 84, bearing, duration: 900
    });
  }

  function leaveStreet() {
    if (!map || !manifest) { streetView = null; return; }
    streetView = null;
    const [w, s, e, n] = boundsFor(manifest, params.district);
    try {
      const cam = map.cameraForBounds([[w, s], [e, n]], { padding: 4 });
      map.easeTo({ ...cam, pitch: 50, bearing: -20, duration: 900 });
    } catch { /* not ready */ }
  }

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
          params.agent_count, params.schedule_source, params.resident_schedule,
          params.arrival_median,
          params.arrival_spread, params.departure_median, params.departure_spread];
    agentsDirty = true;
    schedule();
  });

  // The hour is the light path: dots and currentTime only, never a new
  // timetable and never a re-score of the massing. The street toggles, the
  // ground-floor probability and the two-hour comparison ride the same path:
  // they redraw layers over cached results and resample nothing.
  $effect(() => {
    void [params.hour, params.streets, params.ground_floor_p,
          params.compare_hours, params.hour_b];
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
    const wasStreet = !!streetView;
    streetView = null;
    const [w, s, e, n] = boundsFor(manifest, d);
    try {
      if (wasStreet) {
        // Coming up off a street as well as across town: the pitch and
        // bearing have to come back too, or the new district arrives at 84.
        const cam = map.cameraForBounds([[w, s], [e, n]], { padding: 4 });
        map.easeTo({ ...cam, pitch: 50, bearing: -20, duration: 600 });
      } else {
        map.fitBounds([[w, s], [e, n]], { padding: 4, duration: 600 });
      }
    } catch { /* not ready */ }
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

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && streetView) leaveStreet(); }} />

<div class="wrap">
  <div class="map" bind:this={container}></div>

  {#if streetView && mode === 'edit'}
    <button class="sv-btn" onclick={leaveStreet}>back to the district view</button>
  {/if}

  {#if error}
    <p class="err">Couldn't load the data for this one: {error}</p>
  {:else if loading}
    <p class="loading">{loading}</p>
  {/if}

  {#if manifest && !error && result && manifest.presence?.districts}
    <!-- The two populations, counted - and now the two counted curves under
         them: MTA taps drive the animation, ATUS occupancy checks it. -->
    <div class="presence">
      <h4>who is in the district</h4>
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
            ATUS 2003-2025: share of office-type workers at their workplace by hour{#if occNow},
              {Math.round(occNow.share * 100)}% now{/if}. An independent check on the crowd.
          </p>
        </div>
      {/if}
    </div>
  {/if}

  {#if agentsOn && !error}
    <!-- The register. Three lines, and only one of them is measured - which
         is the point of labelling it. -->
    <div class="assumptions">
      <span class="m"><i>measured</i> how many people pass each station, by hour (MTA O-D 2024)</span>
      <span class="a"><i>assumed</i> which building each trip goes to (in proportion to jobs)</span>
      <span class="a"><i>assumed</i> the route (shortest path)</span>
      {#if (params.resident_schedule ?? 'mirrored') === 'atus' && params.schedule_source !== 'parametric'}
        <span class="a"><i>assumed</i> residents' hours (ATUS, a national survey)</span>
      {/if}
      {#if result && result.metrics.converted > 0}
        <span class="a"><i>assumed</i> ground floors active with probability {(params.ground_floor_p ?? 0.5).toFixed(2)}</span>
      {/if}
    </div>
  {/if}

  {#if manifest && !error}
    <div class="key">
      {#if params.colour_by === 'convertibility'}
        <span>darker scores higher on our convertibility score</span>
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
        <span class="none">No building converts at these settings. The office rent
          is the {rentStop ? rentStop.label : 'published asking rent'}, and the
          residential deal never beats it. To see conversions, choose a lower
          office rent stop, a steeper downward trend, or a higher residential
          rent; each control says whose number it is.</span>
      {/if}
      <!-- Which rent stop is selected, and whose number it is. One stop is
           sourced; the other three are ours, and the difference is the point. -->
      {#if rentStop}
        <span class="note">office rent ${params.office_rent}/sf/yr:
          {rentStop.label}, <b>{rentStop.provenance}</b></span>
      {/if}
      {#if result?.gensler != null}
        <span class="note">Gensler published that about a quarter of the buildings
          it scored were convertible; our score reaches a quarter of this district
          at a threshold of {result.gensler.toFixed(2)}. That figure moves with
          the weights.</span>
      {/if}
      {#if agentsOn && params.compare_hours}
        <span><i class="sw ha"></i>the crowd at {clock(params.hour ?? 8)}</span>
        <span><i class="sw hb"></i>the crowd at {clock(params.hour_b ?? 20)}</span>
        <span class="note">streets take the color of the hour with more walkers;
          darker means a wider gap</span>
      {:else if agentsOn}
        <span><i class="sw worker"></i>workers (arrive morning, leave evening)</span>
        <span><i class="sw resident"></i>residents{(params.resident_schedule ?? 'mirrored') === 'atus'
          && params.schedule_source !== 'parametric'
          ? ' (hours from ATUS)' : ' (reverse of the workers)'}</span>
        {#if params.streets !== false && mode === 'edit'}
          <span class="note">streets darken with walkers this hour; click one
            to stand on it</span>
        {/if}
      {:else}
        <span class="note">crowd loading; the counts above are complete</span>
      {/if}
      {#if result && result.metrics.converted > 0}
        <span><i class="sw lit"></i>converted ground floor: active</span>
        <span><i class="sw dark"></i>converted ground floor: dark</span>
      {/if}
      {#if basemapFailed}
        <span class="warn">basemap unavailable; the model still works</span>
      {:else if tileFailures > 3}
        <span class="warn">{tileFailures} basemap tiles blocked; the model still works</span>
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
  .ha { background: rgb(70,82,96); }
  .hb { background: rgb(224,138,43); }
  .lit { background: rgb(242,178,64); }
  .dark { background: rgb(48,48,56); }
  .sv-btn {
    position: absolute; right: 0.6rem; bottom: 0.6rem; z-index: 6;
    font-size: 0.62rem; color: #222; background: rgba(255,255,255,0.92);
    border: 1px solid #ccc; padding: 0.3rem 0.55rem; cursor: pointer;
    font-family: inherit;
  }
  .sv-btn:hover { background: #fff; }
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
