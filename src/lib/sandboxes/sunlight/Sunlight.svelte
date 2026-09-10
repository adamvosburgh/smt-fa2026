<script>
  // Sandbox - Direct Sunlight in a Space (slug sunlight).
  //
  // A 3D model split into two parts: the CONTEXT, everything that casts shadows
  // and is not studied, and the SPACE, the geometry the study is about. The
  // sandbox shows where the sun falls at the hour on the clock, and, as a grid
  // of colored squares on the space's surfaces, how many hours a day of direct
  // sun each spot receives over a period.
  //
  // The contract, as bathtub sets it out:
  //   props in : params, assets, mode ('edit' | 'view'), dataBase
  //   props in : onmetrics(obj), onready(bool)  - supplied by SandboxFrame
  //   never    : this component does not touch window.__metrics or
  //              data-cover-ready. It reports; the frame publishes.
  //
  // WHAT THIS IS NOT. It computes direct sun hours. There is no sky, no
  // reflected light, no glass transmission and no lux. Those need a sky model
  // and a radiance solver, which is a different simulation. The card says so in
  // its first section, and so does this comment, because the number this
  // reports is easy to mistake for a daylight figure and it is not one.
  //
  // three.js is loaded with a dynamic import() inside boot(), the way After Five
  // loads deck.gl, so server-side rendering never sees it.
  import { untrack } from 'svelte';
  import { browser } from '$app/environment';
  import { instantFor, sunVector, sunAltAz, periodSchedule, dateOfYear } from './sun.js';
  import { buildIndex, countRoles, inputReport, ANALYSED_ROLES } from './tags.js';
  import { samplePoints, createAccumulator, fitOrtho } from './accumulate.js';
  import { buildRooms, requiredRatio, roomPasses, nearestGlazing } from './rooms.js';
  import { exteriorPlacement, interiorPlacement } from './cameras.js';

  let { params, assets = {}, mode = 'edit', dataBase, onmetrics, onready } = $props();

  // --- what the overlays and the table read -------------------------------
  let container = $state(null);
  let error = $state(null);
  let loading = $state('loading three.js…');
  let progress = $state(null);        // { done, total } while an accumulation runs
  let report = $state(null);          // the model contract's input report
  let runStats = $state(null);        // { points, passes, elapsedMs }
  let roomRows = $state([]);
  let legend = $state(null);
  let hover = $state(null);
  let selectedRoom = $state(null);
  let hoverRoom = $state(null);
  let sortKey = $state('id');
  let sortDir = $state(1);
  // Closed by default. Thirty-four rows over the model is the model gone, and
  // the cover is taken here.
  let tableOpen = $state(false);
  let cameraName = $state('exterior');
  let localFile = $state(null);       // a .glb read from disk, never uploaded
  let sunNow = $state(null);
  let metricsBase = $state(null);
  let truncated = $state(false);

  // --- three.js, deliberately outside $state ------------------------------
  // Everything below is imperative WebGL. A scene graph inside a $state proxy
  // makes Svelte deep-proxy every Vector3 in it, which is both slow and wrong:
  // three mutates these in place.
  let THREE = null;
  let GLTFLoader = null, OrbitControls = null, mergeGeometries = null;
  let renderer, scene, camera, controls, hemi, sun, sunTarget;
  let occluderScene, occContext, occAbove, occOpaque, occAboveCut;
  let dispContext, dispAbove, dispOpaque, dispAboveCut, dispGlazing;
  let ceilingTop = 0;
  let analysedGroup, overlayMesh;
  let acc = null;
  let raf = 0;
  let ro = null;

  let surfaces = [];        // every space surface, baked into world coordinates
  let analysedList = [];    // the subset that gets sample points, in point order
  let surfaceRole = [];     // role per index of analysedList
  let roomList = [];
  let glazingSegments = [];
  let points = null;
  let hoursPerPoint = null;
  let spaceBox = null, sceneBox = null, spaceCentre = null;
  let analysedFloorArea = 0;
  let placements = { exterior: null, interior: null };

  let schedule = null;
  let run = null;
  let sunDirty = true;
  let lastSunKey = '';
  let modelToken = 0;
  let recomputeTimer = 0;
  let lastAccumKey = '';

  // Dark blue at nothing, through the site's blue and a yellow, to near white at
  // the top of the scale.
  const RAMP = [
    [0.0, 16, 28, 66],
    [0.35, 60, 92, 138],
    [0.7, 232, 196, 66],
    [1.0, 255, 252, 240]
  ];
  const ABOVE = [232, 196, 66];
  const BELOW = [48, 58, 84];
  const FLOOR_ROLES = new Set(['room', 'floor']);

  const site = () => ({
    latitude: Number(params.latitude ?? 40.7026),
    longitude: Number(params.longitude ?? -74.0107),
    northDeg: Number(params.north_deg ?? 0),
    timeZone: params.timezone ?? 'America/New_York'
  });

  // --- which file the sandbox is looking at -------------------------------
  const modelUrl = $derived(
    localFile ??
      assets.model ??
      `${dataBase}/example-f${String(params.example_floor ?? 8).padStart(2, '0')}.glb`
  );

  // The accumulation depends on the period, the day that period stands for, the
  // grid, the neighbors and the site - and on nothing else. Scrubbing the hour
  // with the period on `year` recomputes nothing, which is what lets that clock
  // play at ten steps a second.
  const accumKey = $derived(
    [
      modelUrl,
      params.period,
      params.period === 'year'
        ? 'y'
        : params.period === 'month'
          ? dateOfYear(params.day_of_year ?? 172).month
          : Math.round(params.day_of_year ?? 172),
      params.grid_m,
      params.show_context,
      params.latitude,
      params.longitude,
      params.north_deg,
      params.timezone
    ].join('|')
  );

  function ramp(t) {
    const x = Math.max(0, Math.min(1, t));
    for (let i = 1; i < RAMP.length; i++) {
      if (x <= RAMP[i][0]) {
        const [t0, r0, g0, b0] = RAMP[i - 1];
        const [t1, r1, g1, b1] = RAMP[i];
        const k = (x - t0) / (t1 - t0 || 1);
        return [r0 + (r1 - r0) * k, g0 + (g1 - g0) * k, b0 + (b1 - b0) * k];
      }
    }
    return RAMP.at(-1).slice(1);
  }
  const css = (rgb) => `rgb(${rgb.map((v) => Math.round(v)).join(',')})`;

  // --- boot ---------------------------------------------------------------
  async function boot() {
    try {
      const [three, gltfMod, orbitMod, mergeMod] = await Promise.all([
        import('three'),
        import('three/addons/loaders/GLTFLoader.js'),
        import('three/addons/controls/OrbitControls.js'),
        import('three/addons/utils/BufferGeometryUtils.js')
      ]);
      THREE = three;
      GLTFLoader = gltfMod.GLTFLoader;
      OrbitControls = orbitMod.OrbitControls;
      mergeGeometries = mergeMod.mergeGeometries;

      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      // The display shadow map is redrawn only when the sun has actually moved.
      // Left on auto it redraws 86,000 triangles at 4096 square on every frame,
      // which is most of the budget an accumulation needs.
      renderer.shadowMap.autoUpdate = false;
      container.appendChild(renderer.domElement);
      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerleave', () => { hover = null; hoverRoom = null; });
      renderer.domElement.addEventListener('click', () => { if (hoverRoom) selectedRoom = hoverRoom; });

      scene = new THREE.Scene();
      scene.background = new THREE.Color().setRGB(0.9, 0.9, 0.89, THREE.SRGBColorSpace);

      hemi = new THREE.HemisphereLight(0xdfe6ee, 0x6b6b66, 1.1);
      sun = new THREE.DirectionalLight(0xfff4e0, 2.6);
      sun.castShadow = true;
      sun.shadow.mapSize.set(4096, 4096);
      sun.shadow.bias = -0.0005;
      sun.shadow.normalBias = 0.05;
      sunTarget = new THREE.Object3D();
      sun.target = sunTarget;
      scene.add(hemi, sun, sunTarget);

      camera = new THREE.PerspectiveCamera(45, 1, 0.5, 8000);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enabled = mode === 'edit';

      occluderScene = new THREE.Scene();
      analysedGroup = new THREE.Group();
      scene.add(analysedGroup);
      acc = createAccumulator({ THREE, renderer });

      ro = new ResizeObserver(resize);
      ro.observe(container);
      resize();
      raf = requestAnimationFrame(frame);

      await loadModel(untrack(() => modelUrl));
    } catch (err) {
      console.error(err);
      error = String(err?.message ?? err);
      loading = null;
      onready?.(true); // never hang the cover pipeline on a load failure
    }
  }

  function resize() {
    if (!renderer || !container) return;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    sunDirty = true;
  }

  // --- loading a model ----------------------------------------------------

  function bake(mesh) {
    let g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    // The example files carry POSITION and nothing else, on purpose - flat
    // shading is right for massing and smooth normals would round every
    // building's edges. Dropping the rest keeps mergeGeometries happy, since it
    // needs every input to agree on its attributes.
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    g.morphAttributes = {};
    return g;
  }

  function material(kind) {
    const c = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
    if (kind === 'glazing') {
      return new THREE.MeshLambertMaterial({
        color: c(0.55, 0.75, 0.9),
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        flatShading: true,
        depthWrite: false
      });
    }
    const color =
      kind === 'context' ? c(0.72, 0.71, 0.68)
      : kind === 'analyzed' ? c(0.97, 0.97, 0.95)
      : c(0.93, 0.92, 0.89);
    return new THREE.MeshLambertMaterial({
      color: color,
      // ZERO-THICKNESS WALLS. Single-sided depth lets the sun through a
      // partition from one side; single-sided drawing makes a wall vanish when
      // you orbit past it.
      side: THREE.DoubleSide,
      shadowSide: THREE.DoubleSide,
      flatShading: true
    });
  }

  function clearModel() {
    for (const m of [dispContext, dispAbove, dispOpaque, dispAboveCut, dispGlazing]) {
      if (!m) continue;
      scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    for (const m of [occContext, occAbove, occOpaque, occAboveCut]) if (m) occluderScene.remove(m);
    if (overlayMesh) {
      analysedGroup.remove(overlayMesh);
      overlayMesh.geometry.dispose();
      overlayMesh.material.dispose();
      overlayMesh = null;
    }
    for (const s of surfaces) {
      if (s.display) {
        analysedGroup.remove(s.display);
        s.display.material.dispose();
      }
      s.geometry?.dispose?.();
    }
    dispContext = dispAbove = dispOpaque = dispAboveCut = dispGlazing = null;
    occContext = occAbove = occOpaque = occAboveCut = null;
    surfaces = [];
    analysedList = [];
    surfaceRole = [];
    roomList = [];
    roomRows = [];
    glazingSegments = [];
    points = null;
    hoursPerPoint = null;
    metricsBase = null;
  }

  async function loadModel(url) {
    const token = ++modelToken;
    onready?.(false);
    loading = 'reading the model…';
    error = null;
    progress = null;
    run = null;

    let gltf;
    try {
      gltf = await new GLTFLoader().loadAsync(url);
    } catch (err) {
      if (token !== modelToken) return;
      error = `Couldn't read that model: ${err?.message ?? err}`;
      loading = null;
      onready?.(true);
      return;
    }
    if (token !== modelToken) return;

    gltf.scene.updateMatrixWorld(true);
    // GLTFLoader gives a Mesh the NODE's name whenever the node has one, so the
    // glTF mesh's own name has to be recovered from the parser's associations
    // table before the classifier can fall back to it.
    const assoc = gltf.parser.associations;
    const meshDefs = gltf.parser.json.meshes ?? [];
    const meshNameOf = (obj) => {
      const a = assoc.get(obj);
      return a && a.meshes != null ? (meshDefs[a.meshes]?.name ?? null) : null;
    };

    const entries = buildIndex(gltf.scene, { meshNameOf });
    clearModel();

    const box = new THREE.Box3();
    const whole = new THREE.Box3();
    let hasSpace = false;

    // Baked into world coordinates first, boxes and all, because the cut-away
    // needs to know where the ceiling is before it can decide which of the
    // opaque meshes are above it.
    const baked = entries.map((e) => {
      const geometry = bake(e.mesh);
      const gbox = new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position'));
      whole.union(gbox);
      if (e.inSpace) { box.union(gbox); hasSpace = true; }
      return { ...e, geometry, gbox };
    });
    gltf.scene.traverse((o) => o.geometry?.dispose?.());

    // The height the cut-away slices at, and with it the test for what is above
    // the plate. The doc names slab_ceiling; the test is geometric so it also
    // catches whatever a student's own model calls the slab over their space.
    const ceilingTops = baked.filter((e) => e.role === 'ceiling').map((e) => e.gbox.max.y);
    ceilingTop = ceilingTops.length ? Math.max(...ceilingTops) : (hasSpace ? box.max.y : whole.max.y);

    const contextGeos = [];
    const aboveGeos = [];
    const opaqueGeos = [];
    const aboveCutGeos = [];
    const glazingGeos = [];

    for (const e of baked) {
      const g = e.geometry;
      // An opaque space mesh sitting entirely above the ceiling surface - the
      // slab over the plate - has to come out of the picture with the cut-away
      // and stay in the shadow pass, so it is merged separately.
      const aboveCut = e.gbox.min.y > ceilingTop - 0.001;
      if (e.role === 'contextAbove') aboveGeos.push(g);
      else if (e.role === 'context' || e.role === 'other') contextGeos.push(g);
      else if (e.role === 'glazing') { glazingGeos.push(g); surfaces.push(e); }
      else if (e.role === 'slab') (aboveCut ? aboveCutGeos : opaqueGeos).push(g);
      else if (e.role === 'wall') { (aboveCut ? aboveCutGeos : opaqueGeos).push(g); surfaces.push(e); }
      else surfaces.push(e); // room, floor, ceiling
    }

    spaceBox = hasSpace ? box : whole.clone();
    sceneBox = whole.isEmpty() ? spaceBox.clone() : whole;
    spaceCentre = spaceBox.getCenter(new THREE.Vector3());

    // Merged for drawing and for casting. 663 draw calls times 880 accumulation
    // passes is not something to ask of a GPU; the analyzed floors, ceilings and
    // rooms stay separate because rooms are picked and highlighted one at a time.
    const merged = (list) => (list.length ? mergeGeometries(list, false) : null);
    const contextGeo = merged(contextGeos);
    const aboveGeo = merged(aboveGeos);
    const opaqueGeo = merged(opaqueGeos);
    const aboveCutGeo = merged(aboveCutGeos);
    const glazingGeo = merged(glazingGeos);
    // Only the context sources are freed. The opaque space geometries are still
    // held by `surfaces` for sampling, and merging has already copied what the
    // merged mesh needs.
    for (const g of [...contextGeos, ...aboveGeos]) g.dispose();

    const add = (geo, kind, casts) => {
      if (!geo) return null;
      const m = new THREE.Mesh(geo, material(kind));
      m.castShadow = casts;
      m.receiveShadow = true;
      scene.add(m);
      return m;
    };
    dispContext = add(contextGeo, 'context', true);
    dispAbove = add(aboveGeo, 'context', true);
    dispOpaque = add(opaqueGeo, 'space', true);
    dispAboveCut = add(aboveCutGeo, 'space', true);
    dispGlazing = add(glazingGeo, 'glazing', false);
    if (dispGlazing) dispGlazing.receiveShadow = false;

    // A second, plain scene holding only what casts. The accumulation renders
    // that one and nothing else, so what the display is doing - the cut-away, a
    // hidden ceiling, a material swap - can never change the number.
    const occMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const occ = (geo) => {
      if (!geo) return null;
      const m = new THREE.Mesh(geo, occMat);
      occluderScene.add(m);
      return m;
    };
    occContext = occ(contextGeo);
    occAbove = occ(aboveGeo);
    occOpaque = occ(opaqueGeo);
    occAboveCut = occ(aboveCutGeo);

    for (const s of surfaces) {
      // Walls are analyzed but drawn as part of the merged opaque mesh; glazing
      // is drawn merged and is not analyzed at all.
      if (s.role === 'glazing' || s.role === 'wall') continue;
      s.display = new THREE.Mesh(s.geometry, material('analyzed'));
      s.display.castShadow = false;
      s.display.receiveShadow = true;
      analysedGroup.add(s.display);
    }

    const built = buildRooms({ THREE, surfaces });
    roomList = built.rooms;
    glazingSegments = built.panes.map((p) => p.segment);
    const roomIndex = new Map(roomList.map((r, i) => [r.id, i]));
    for (const s of surfaces) s.roomIndex = s.role === 'room' ? (roomIndex.get(s.id) ?? -1) : -1;

    // The metric called "analyzed floor area" is the floors: room patches plus
    // any floor surface belonging to no room. Ceilings and walls are analyzed
    // too, and are counted in the input report's total instead.
    analysedFloorArea = roomList.reduce((a, r) => a + r.floorArea, 0);
    let analysedArea = analysedFloorArea;
    for (const s of surfaces) {
      if (s.role === 'floor') { const a = areaOf(s.geometry); analysedFloorArea += a; analysedArea += a; }
      else if (s.role === 'ceiling' || s.role === 'wall') analysedArea += areaOf(s.geometry);
    }

    report = inputReport({
      counts: countRoles(entries),
      box: hasSpace ? { min: box.min, max: box.max } : null,
      analysedArea,
      glazingOrphans: built.orphans,
      rooms: roomList.length
    });

    placeCameras();
    applyCutaway();
    applyContext();
    rebuildPoints();
    startAccumulation(true);
  }

  function areaOf(geometry) {
    const pos = geometry.getAttribute('position');
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
    const u = new THREE.Vector3(), v = new THREE.Vector3(), n = new THREE.Vector3();
    let a = 0;
    for (let t = 0; t < pos.count / 3; t++) {
      A.fromBufferAttribute(pos, t * 3);
      B.fromBufferAttribute(pos, t * 3 + 1);
      C.fromBufferAttribute(pos, t * 3 + 2);
      a += 0.5 * n.crossVectors(u.subVectors(B, A), v.subVectors(C, A)).length();
    }
    return a;
  }

  // --- cameras ------------------------------------------------------------
  function placeCameras() {
    const occluders = [occContext, occOpaque].filter(Boolean);
    placements.exterior = exteriorPlacement({ THREE, spaceBox, occluders });
    placements.interior = interiorPlacement({
      THREE,
      rooms: roomList,
      floors: surfaces
        .filter((s) => s.role === 'floor')
        .map((s) => {
          const b = new THREE.Box3().setFromBufferAttribute(s.geometry.getAttribute('position'));
          return { area: areaOf(s.geometry), centroid: b.getCenter(new THREE.Vector3()), level: b.min.y };
        }),
      spaceBox
    });
    useCamera('exterior');
  }

  function useCamera(which) {
    const p = placements[which];
    if (!p) return;
    cameraName = which;
    camera.fov = p.fov;
    camera.near = which === 'interior' ? 0.1 : 0.5;
    camera.updateProjectionMatrix();
    camera.position.copy(p.position);
    controls.target.copy(p.target);
    controls.update();
    sunDirty = true;
  }

  // --- the cut-away -------------------------------------------------------
  //
  // NEVER hide a shadow caster with visible = false: that takes it out of the
  // shadow pass too, and the whole point of the cut-away is that the towers stop
  // being drawn while their shadows carry on falling across the model. A
  // clipping plane does exactly that, because clipShadows is left false. The one
  // caster that has to go and is not above the plane is the ceiling slab, and it
  // is made invisible by writing neither color nor depth.
  function applyCutaway() {
    if (!renderer || !spaceBox) return;
    const on = params.cutaway !== false;
    renderer.clippingPlanes = on
      ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), ceilingTop + 0.2)]
      : [];
    // The ceiling surface does not cast, so switching it off is safe.
    for (const s of surfaces) if (s.role === 'ceiling' && s.display) s.display.visible = !on;
    // These two do cast. They are made invisible by writing neither color nor
    // depth, which leaves them in the shadow pass. The clipping plane alone is
    // not enough for the ceiling slab: it straddles the plane, and the 20 cm of
    // it below the cut would roof the plate over.
    for (const m of [dispAbove, dispAboveCut]) {
      if (!m) continue;
      m.material.colorWrite = !on;
      m.material.depthWrite = !on;
    }
    sunDirty = true;
  }

  function applyContext() {
    // The subject's OWN stories above and below the analyzed floor are context
    // too, and go with the neighbors: the control asks what the surroundings
    // cost, and its own tower is part of that.
    const on = params.show_context !== false;
    for (const m of [dispContext, dispAbove]) if (m) m.visible = on;
    for (const m of [occContext, occAbove]) if (m) m.visible = on;
    sunDirty = true;
  }

  // --- sample points and the overlay --------------------------------------
  function rebuildPoints() {
    const grid = Number(untrack(() => params.grid_m) ?? 0.5);
    analysedList = surfaces.filter((s) => ANALYSED_ROLES.has(s.role));
    surfaceRole = analysedList.map((s) => s.role);
    points = samplePoints({ THREE, surfaces: analysedList, gridM: grid, maxPoints: 262144 });
    truncated = points.truncated;
    acc.setPoints(points);
    buildOverlay(grid);
    hoursPerPoint = null;
  }

  function buildOverlay(grid) {
    if (overlayMesh) {
      analysedGroup.remove(overlayMesh);
      overlayMesh.geometry.dispose();
      overlayMesh.material.dispose();
      overlayMesh = null;
    }
    if (!points.count) return;
    const mat = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      // Slightly see-through, so the live shading - and the shadow at the hour
      // on the clock - still reads underneath the cumulative squares.
      opacity: 0.85,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    overlayMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(grid, grid), mat, points.count);
    overlayMesh.frustumCulled = false;
    overlayMesh.castShadow = false;
    overlayMesh.receiveShadow = false;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 0, 1);
    const n = new THREE.Vector3();
    const p = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    const gray = new THREE.Color(0.6, 0.6, 0.6);
    for (let i = 0; i < points.count; i++) {
      p.set(points.position[i * 4], points.position[i * 4 + 1], points.position[i * 4 + 2]);
      n.set(points.normal[i * 4], points.normal[i * 4 + 1], points.normal[i * 4 + 2]);
      q.setFromUnitVectors(up, n);
      overlayMesh.setMatrixAt(i, m.compose(p, q, one));
      overlayMesh.setColorAt(i, gray);
    }
    overlayMesh.instanceMatrix.needsUpdate = true;
    if (overlayMesh.instanceColor) overlayMesh.instanceColor.needsUpdate = true;
    analysedGroup.add(overlayMesh);
  }

  // --- the accumulation ---------------------------------------------------
  function startAccumulation(force = false) {
    if (!acc || !points || !spaceBox) return;
    const key = untrack(() => accumKey);
    if (!force && key === lastAccumKey) return;
    lastAccumKey = key;
    const s = untrack(() => site());
    schedule = periodSchedule({
      period: untrack(() => params.period) ?? 'year',
      dayOfYear: untrack(() => params.day_of_year) ?? 172,
      latitude: s.latitude,
      longitude: s.longitude,
      timeZone: s.timeZone
    });
    const steps = [];
    for (const d of schedule.days) for (const t of d.steps) steps.push({ date: t, weight: d.weight });
    acc.reset();
    run = { steps, i: 0, started: performance.now() };
    progress = { done: 0, total: steps.length };
    loading = null;
    onready?.(false);
  }

  function stepAccumulation() {
    const budgetEnd = performance.now() + 12;
    const dir = new THREE.Vector3();
    const s = site();
    while (run.i < run.steps.length && performance.now() < budgetEnd) {
      const step = run.steps[run.i++];
      const v = sunVector(step.date, s.latitude, s.longitude, s.northDeg);
      // Below the horizon there is no direct light, so the step adds nothing.
      // daySteps has already trimmed to daylight, so this only ever fires on the
      // first or last step of a day.
      if (!v) continue;
      dir.set(v.x, v.y, v.z).normalize();
      acc.pass({ dir, weight: step.weight, occluderScene, spaceBox, sceneBox });
    }
    progress = { done: run.i, total: run.steps.length };
    if (run.i >= run.steps.length) {
      const started = run.started;
      run = null;
      progress = null;
      // Timed through the readback, not up to it. Every pass is queued
      // asynchronously, so stopping the clock before readRenderTargetPixels
      // measures how fast the commands were written, not how long the GPU took.
      finishAccumulation(started);
    }
  }

  function finishAccumulation(started) {
    const counts = acc.read();
    const elapsedMs = performance.now() - started;
    // The counter holds weighted lit steps. Dividing by the total weight turns
    // it back into a figure PER DAY, whatever period it covered.
    const perDay = schedule.stepHours / (schedule.totalWeight || 1);
    hoursPerPoint = new Float32Array(points.count);
    for (let i = 0; i < points.count; i++) hoursPerPoint[i] = counts[i] * perDay;
    runStats = { points: points.count, passes: schedule.passes, elapsedMs };
    recolor();
    computeMetrics();
    onready?.(true);
  }

  // --- coloring and the numbers ------------------------------------------
  function recolor() {
    if (!overlayMesh || !hoursPerPoint) return;
    const overlay = params.overlay ?? 'hours';
    const threshold = Number(params.threshold_hours ?? 2);
    const maxHours = Math.max(0.01, schedule?.maxDayHours ?? 1);
    const daylight = Math.max(0.01, schedule?.daylightHours ?? 1);
    overlayMesh.visible = overlay !== 'none';
    if (overlay === 'none') { legend = null; return; }

    const c = new THREE.Color();
    for (let i = 0; i < points.count; i++) {
      const rgb =
        overlay === 'threshold' ? (hoursPerPoint[i] >= threshold ? ABOVE : BELOW)
        : overlay === 'share' ? ramp(hoursPerPoint[i] / daylight)
        : ramp(hoursPerPoint[i] / maxHours);
      c.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
      overlayMesh.setColorAt(i, c);
    }
    if (overlayMesh.instanceColor) overlayMesh.instanceColor.needsUpdate = true;

    legend =
      overlay === 'threshold'
        ? { kind: 'threshold', above: css(ABOVE), below: css(BELOW), threshold }
        : {
            kind: 'ramp',
            label: overlay === 'share' ? 'share of the period’s daylight' : 'hours of direct sun per day',
            lo: '0',
            hi: overlay === 'share' ? '100%' : `${maxHours.toFixed(1)} h`,
            stops: [0, 0.25, 0.5, 0.75, 1].map((t) => css(ramp(t)))
          };
  }

  function computeMetrics() {
    if (!points || !hoursPerPoint) return;
    const threshold = Number(params.threshold_hours ?? 2);
    const rule = params.window_rule ?? 'mdl30';
    const depthRule = params.depth_rule === true;

    // The points sit on a regular lattice, so counting them IS area weighting.
    let floorPoints = 0, floorSum = 0, floorAbove = 0, deepest = null;
    const perRoom = roomList.map(() => ({ n: 0, sum: 0, above: 0, deepest: null }));

    for (let i = 0; i < points.count; i++) {
      if (!FLOOR_ROLES.has(surfaceRole[points.surfaceOf[i]])) continue;
      const h = hoursPerPoint[i];
      const ri = points.roomOf[i];
      floorPoints++;
      floorSum += h;
      if (h >= threshold) floorAbove++;
      if (ri >= 0) {
        perRoom[ri].n++;
        perRoom[ri].sum += h;
        if (h >= threshold) perRoom[ri].above++;
      }
      // The deepest lit point: the farthest floor point from a window, in plan,
      // that still gets an hour a day.
      if (h >= 1 && glazingSegments.length) {
        const d = nearestGlazing(points.position[i * 4], points.position[i * 4 + 2], glazingSegments);
        if (deepest === null || d > deepest) deepest = d;
        if (ri >= 0 && (perRoom[ri].deepest === null || d > perRoom[ri].deepest)) perRoom[ri].deepest = d;
      }
    }

    // Built as a LOCAL array and assigned once. Reading roomRows back after
    // writing it inside this effect would make the effect depend on its own
    // output, and Svelte would re-run it until it gave up - which is exactly
    // what happened the first time this was written the obvious way.
    const rows = roomList.map((room, i) => {
      const r = perRoom[i];
      return {
        id: room.id,
        floor: room.floorArea,
        glazing: room.glazingArea,
        ratio: room.ratio,
        need: requiredRatio(rule, room.floorArea),
        pass: roomPasses(room, rule, depthRule),
        mean: r.n ? r.sum / r.n : 0,
        share: r.n ? (100 * r.above) / r.n : 0,
        deepest: r.deepest
      };
    });

    const passing = rows.filter((r) => r.pass).length;
    metricsBase = {
      'analyzed floor area': `${analysedFloorArea.toFixed(0)} m²`,
      'mean direct sun, floors': `${(floorPoints ? floorSum / floorPoints : 0).toFixed(2)} h/day`,
      'floor area at or above threshold': `${(floorPoints ? (100 * floorAbove) / floorPoints : 0).toFixed(0)}%`,
      'deepest lit point': deepest === null ? 'none' : `${deepest.toFixed(1)} m from a window`,
      rooms: String(rows.length),
      ruleKey: `rooms passing ${rule === 'mdl277' ? '§277' : '§30'}${depthRule ? ' + 30 ft' : ''}`,
      ruleValue: `${passing} of ${rows.length}`,
      'rooms passing but under threshold': String(rows.filter((r) => r.pass && r.mean < threshold).length)
    };
    roomRows = rows;
  }

  // --- the frame loop -----------------------------------------------------
  function updateSun() {
    const s = site();
    const key = [params.hour, params.day_of_year, s.timeZone, s.latitude, s.longitude, s.northDeg].join('|');
    if (key === lastSunKey && !sunDirty) return;
    lastSunKey = key;
    sunDirty = false;

    const when = instantFor({
      hour: Number(params.hour ?? 12),
      dayOfYear: Math.round(params.day_of_year ?? 172),
      timeZone: s.timeZone
    });
    const alt = sunAltAz(when, s.latitude, s.longitude);
    sunNow = alt.altitude > 0
      ? `${alt.altitude.toFixed(1)}° up, ${alt.azimuth.toFixed(0)}° from north`
      : 'below the horizon';

    const v = sunVector(when, s.latitude, s.longitude, s.northDeg);
    if (!v || !spaceBox) {
      // Below the horizon: no direct light, and the fill drops to a night level
      // so the picture reads as night rather than as a bug.
      sun.intensity = 0;
      hemi.intensity = 0.25;
      renderer.shadowMap.needsUpdate = true;
      return;
    }
    sun.intensity = 2.6;
    hemi.intensity = 1.1;
    const dir = new THREE.Vector3(v.x, v.y, v.z).normalize();
    const { distance } = fitOrtho({ THREE, camera: sun.shadow.camera, dir, spaceBox, sceneBox, margin: 60 });
    sun.position.copy(spaceCentre).addScaledVector(dir, distance);
    sunTarget.position.copy(spaceCentre);
    sunTarget.updateMatrixWorld();
    renderer.shadowMap.needsUpdate = true;
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!renderer || !scene || !camera) return;
    controls?.update();
    if (spaceBox) updateSun();
    if (run) stepAccumulation();
    renderer.render(scene, camera);
  }

  // --- picking ------------------------------------------------------------
  let lastPick = 0;
  function onPointerMove(e) {
    if (!overlayMesh || !hoursPerPoint || performance.now() - lastPick < 40) return;
    lastPick = performance.now();
    const rect = renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      ),
      camera
    );
    const hit = ray.intersectObject(overlayMesh, false)[0];
    if (!hit || hit.instanceId == null) { hover = null; hoverRoom = null; return; }
    const i = hit.instanceId;
    const ri = points.roomOf[i];
    hover = {
      hours: hoursPerPoint[i],
      share: (100 * hoursPerPoint[i]) / Math.max(0.01, schedule?.daylightHours ?? 1),
      room: ri >= 0 ? (roomList[ri]?.id ?? null) : null
    };
    hoverRoom = hover.room;
  }

  function sortBy(key) {
    if (sortKey === key) sortDir = -sortDir;
    else { sortKey = key; sortDir = key === 'id' ? 1 : -1; }
  }

  const sortedRows = $derived(
    [...roomRows].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === 'string') return sortDir * (va < vb ? -1 : va > vb ? 1 : 0);
      return sortDir * ((va ?? -1) - (vb ?? -1));
    })
  );

  function readLocal(e) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    if (localFile) URL.revokeObjectURL(localFile);
    localFile = URL.createObjectURL(file);
  }

  // --- effects ------------------------------------------------------------
  $effect(() => {
    if (!browser || !container) return;
    boot();
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(recomputeTimer);
      ro?.disconnect();
      acc?.dispose();
      renderer?.dispose();
      if (localFile) URL.revokeObjectURL(localFile);
    };
  });

  // A different model file: the floor control, a submitted upload, or the local
  // test bench. boot() loads the first one itself.
  $effect(() => {
    const url = modelUrl;
    if (!THREE || !renderer) return;
    lastAccumKey = '';
    loadModel(url);
  });

  // The accumulation's own dependencies, debounced so that dragging a latitude
  // slider does not queue twenty recomputations.
  $effect(() => {
    const key = accumKey;
    if (!acc || !points || key === lastAccumKey) return;
    clearTimeout(recomputeTimer);
    recomputeTimer = setTimeout(() => {
      if (Number(params.grid_m) !== points.gridM) rebuildPoints();
      startAccumulation(false);
    }, 250);
    return () => clearTimeout(recomputeTimer);
  });

  $effect(() => {
    params.cutaway;
    if (renderer && spaceBox) applyCutaway();
  });

  $effect(() => {
    params.show_context;
    if (renderer) applyContext();
  });

  // Cheap: recoloring and re-deriving the table needs no new sun positions.
  $effect(() => {
    params.overlay; params.threshold_hours; params.window_rule; params.depth_rule;
    if (hoursPerPoint) { recolor(); computeMetrics(); }
  });

  // Hovering a table row lights the room in the model, and hovering the model
  // lights the row.
  $effect(() => {
    const lit = hoverRoom ?? selectedRoom;
    if (!THREE) return;
    for (const s of surfaces) {
      if (!s.display || s.role !== 'room') continue;
      const [r, g, b] = s.id === lit ? [1, 0.92, 0.6] : [0.97, 0.97, 0.95];
      s.display.material.color.setRGB(r, g, b, THREE.SRGBColorSpace);
    }
  });

  // `sun now` moves with the clock; everything else moves only when the
  // accumulation finishes. They are published together, in the order the strip
  // reads, but recomputed apart - rebuilding the table thirty times a second
  // while the hour plays would be the most expensive thing on the page.
  $effect(() => {
    const base = metricsBase;
    const now = sunNow;
    if (!base) return;
    const { ruleKey, ruleValue, ...rest } = base;
    onmetrics?.({
      'sun now': now ?? '—',
      'analyzed floor area': rest['analyzed floor area'],
      'mean direct sun, floors': rest['mean direct sun, floors'],
      'floor area at or above threshold': rest['floor area at or above threshold'],
      'deepest lit point': rest['deepest lit point'],
      rooms: rest.rooms,
      [ruleKey]: ruleValue,
      'rooms passing but under threshold': rest['rooms passing but under threshold'],
      input: report?.line ?? '—'
    });
  });
</script>

<div class="wrap" bind:this={container}>
  {#if error}
    <p class="err">{error}</p>
  {:else if loading}
    <p class="loading">{loading}</p>
  {:else if progress}
    <p class="loading">counting sun positions… {progress.done} / {progress.total}</p>
  {/if}

  <div class="cams">
    <button type="button" class:on={cameraName === 'exterior'} onclick={() => useCamera('exterior')}>exterior</button>
    <button type="button" class:on={cameraName === 'interior'} onclick={() => useCamera('interior')}>interior</button>
  </div>

  {#if report}
    <details class="report" open>
      <summary>what the sandbox read</summary>
      <p class="line">{report.line}</p>
      <p class="line dim">{report.analysedArea.toFixed(0)} m² analyzed</p>
      {#if runStats}
        <p class="line dim">
          {runStats.points.toLocaleString()} sample points, {runStats.passes} sun positions,
          {(runStats.elapsedMs / 1000).toFixed(1)} s
        </p>
      {/if}
      {#if truncated}
        <p class="problem">More sample points than the sandbox can hold. Choose a coarser spacing.</p>
      {/if}
      {#each report.problems as p}
        <p class="problem">{p}</p>
      {/each}
    </details>
  {/if}

  {#if legend}
    <div class="legend">
      {#if legend.kind === 'ramp'}
        <span class="lab">{legend.label}</span>
        <span class="bar" style="background:linear-gradient(90deg,{legend.stops.join(',')})"></span>
        <span class="ends"><i>{legend.lo}</i><i>{legend.hi}</i></span>
      {:else}
        <span class="lab">at or above {legend.threshold} h/day</span>
        <span class="ends">
          <i><b style="background:{legend.above}"></b> at or above</i>
          <i><b style="background:{legend.below}"></b> under</i>
        </span>
      {/if}
      {#if hover}
        <span class="hover">
          {hover.hours.toFixed(2)} h/day · {hover.share.toFixed(0)}% of daylight{#if hover.room} · room {hover.room}{/if}
        </span>
      {/if}
    </div>
  {/if}

  <div class="tools">
  {#if roomRows.length}
    <div class="table">
      <button class="toggle" type="button" onclick={() => (tableOpen = !tableOpen)}>
        {tableOpen ? 'hide' : 'show'} the rooms ({roomRows.length})
      </button>
      {#if tableOpen}
        <div class="scroll">
          <table>
            <thead>
              <tr>
                {#each [['id', 'room'], ['floor', 'floor m²'], ['glazing', 'glass m²'], ['ratio', 'ratio'], ['need', 'needs'], ['pass', 'rule'], ['mean', 'h/day'], ['share', '% over'], ['deepest', 'deepest m']] as [k, label] (k)}
                  <th><button type="button" onclick={() => sortBy(k)}>{label}</button></th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each sortedRows as r (r.id)}
                <tr
                  class:sel={selectedRoom === r.id}
                  class:hot={hoverRoom === r.id}
                  onmouseenter={() => (hoverRoom = r.id)}
                  onmouseleave={() => (hoverRoom = null)}
                  onclick={() => (selectedRoom = r.id)}
                >
                  <td>{r.id}</td>
                  <td>{r.floor.toFixed(1)}</td>
                  <td>{r.glazing.toFixed(1)}</td>
                  <td>{r.ratio.toFixed(3)}</td>
                  <td>{r.need.toFixed(2)}</td>
                  <td class:fail={!r.pass}>{r.pass ? 'passes' : 'fails'}</td>
                  <td>{r.mean.toFixed(2)}</td>
                  <td>{r.share.toFixed(0)}</td>
                  <td>{r.deepest == null ? '—' : r.deepest.toFixed(1)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}

  {#if mode === 'edit' && !assets.model}
    <!-- The test bench. Reads a .glb from disk into the sandbox and uploads
         nothing. This is how you check that your exporter kept your names,
         before you hand anything in. -->
    <label class="loadfile">
      <span>load a .glb from your machine</span>
      <input type="file" accept=".glb" onchange={readLocal} />
    </label>
  {/if}
  </div>
</div>

<style>
  .wrap { position: absolute; inset: 0; overflow: hidden; }
  .wrap :global(canvas) { display: block; width: 100%; height: 100%; }
  .loading, .err {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    margin: 0; padding: 0.5rem 0.9rem; background: rgba(255, 255, 255, 0.92);
    border: 1px solid #000; font-size: 0.72rem; z-index: 5; max-width: 80%;
  }
  .err { color: #a00; }

  .cams { position: absolute; top: 0.6rem; left: 0.6rem; display: flex; z-index: 4; }
  .cams button {
    font: inherit; font-size: 0.66rem; padding: 0.3rem 0.6rem; cursor: pointer;
    background: rgba(255, 255, 255, 0.92); border: 1px solid #000; border-right: 0; color: #444;
  }
  .cams button:last-child { border-right: 1px solid #000; }
  .cams button.on { background: #000; color: #fff; }

  .report {
    position: absolute; top: 0.6rem; right: 0.6rem; z-index: 4;
    max-width: min(360px, 46%);
    background: rgba(255, 255, 255, 0.94); border: 1px solid #000; padding: 0.4rem 0.6rem;
    font-size: 0.66rem; line-height: 1.5;
  }
  .report summary { cursor: pointer; font-weight: 700; font-size: 0.62rem; letter-spacing: 0.04em; }
  .report .line { margin: 0.35rem 0 0; font-variant-numeric: tabular-nums; }
  .report .dim { color: #888; }
  .report .problem { margin: 0.35rem 0 0; color: #a04000; }

  .legend {
    position: absolute; bottom: 0.6rem; right: 0.6rem; z-index: 4;
    background: rgba(255, 255, 255, 0.94); border: 1px solid #000; padding: 0.4rem 0.6rem;
    font-size: 0.64rem; display: flex; flex-direction: column; gap: 0.25rem; min-width: 190px;
  }
  .legend .lab { color: #666; }
  .legend .bar { display: block; height: 9px; border: 1px solid #ccc; }
  .legend .ends { display: flex; justify-content: space-between; gap: 0.5rem; }
  .legend .ends i { font-style: normal; color: #666; display: inline-flex; align-items: center; gap: 0.25rem; }
  .legend .ends b { width: 9px; height: 9px; display: inline-block; }
  .legend .hover { border-top: 1px solid #eee; padding-top: 0.25rem; font-variant-numeric: tabular-nums; }

  /* The bottom-left column: the room table and, in edit mode, the file input.
     Both are stacked so neither lands on top of the other, and the whole column
     stays out of the middle of the picture. */
  .tools {
    position: absolute; left: 0.6rem; bottom: 0.6rem; z-index: 4;
    display: flex; flex-direction: column; align-items: flex-start; gap: 0.4rem;
    max-width: min(560px, 62%);
  }
  .table {
    background: rgba(255, 255, 255, 0.94); border: 1px solid #000;
    font-size: 0.62rem; width: 100%;
  }
  .table .toggle {
    display: block; width: 100%; text-align: left; font: inherit; font-size: 0.62rem;
    padding: 0.3rem 0.5rem; background: none; border: 0; border-bottom: 1px solid #eee; cursor: pointer;
  }
  .table .scroll { max-height: min(34vh, 260px); overflow: auto; }
  table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
  th { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #000; }
  th button { font: inherit; font-size: 0.6rem; background: none; border: 0; cursor: pointer; padding: 0.25rem 0.4rem; color: #666; }
  td { padding: 0.15rem 0.4rem; border-bottom: 1px solid #f0f0ee; }
  tbody tr { cursor: pointer; }
  tbody tr.hot { background: #fff6d8; }
  tbody tr.sel { outline: 1px solid #000; }
  td.fail { color: #a00; }

  .loadfile {
    background: rgba(255, 255, 255, 0.94); border: 1px solid #000; padding: 0.35rem 0.5rem;
    font-size: 0.62rem; display: flex; flex-direction: column; gap: 0.2rem; max-width: 15rem;
  }
  .loadfile span { color: #666; }
  .loadfile input { font: inherit; font-size: 0.6rem; }
</style>
