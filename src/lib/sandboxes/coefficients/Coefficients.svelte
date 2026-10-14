<script>
  // Sandbox 03 - A City Simulator, Opened Up (slug coefficients).
  //
  // micropolisJS with its guts exposed. One big canvas: the city, with the
  // selected internal layer composited over it as a translucent heat wash,
  // tile-for-tile aligned - every block map shares the city's 120x100
  // geometry, so crime washed over the actual blocks shows which buildings
  // sit in the red. The fifteen rasters run in a rail above, each redrawn as
  // its phase fires. A key sits top left of the map, and hovering a tile
  // reads out what is on it and the layers' values there.
  //
  // There used to be a larger preview of the current layer in the corner
  // too. It showed nothing the wash and the rail did not, so it went.
  //
  // The contract, as bathtub sets it out:
  //   props in : params, assets, mode ('edit' | 'view'), dataBase
  //   props in : onmetrics(obj), onready(bool), ontransport(adapter)
  //   never    : this component does not touch window.__metrics or
  //              data-cover-ready. It reports; the frame publishes.
  //
  // The clock is the frame's transport, bound to the engine through the
  // ontransport adapter rather than to a schema property - this is the one
  // sandbox whose time axis is a live simulation, and the control should look
  // identical to the others' even though run/pause/step of an engine is a
  // different thing from scrubbing a year.
  //
  // Nothing is fetched from dataBase at all, because this sandbox has no data
  // pipeline: its data is source code. The tile atlas is a VENDORED ASSET,
  // committed at static/coefficients/, loaded by URL rather than imported so
  // that a submitted tiles.png replaces it with no code change at all.
  import { onDestroy, untrack } from 'svelte';
  import { browser } from '$app/environment';
  import { BLOCK_MAPS, PHASES, createCity, run, readMetrics, inspectTile } from './engine.js';
  import { drawCity, drawBlockMap, drawWash, drawTiles, loadAtlas } from './renderer.js';

  let { params, assets = {}, mode = 'edit', dataBase, onmetrics, onready, ontransport } = $props();

  const view = $derived(mode === 'view');

  let stageEl = $state(null);
  let displayCanvas = $state(null);
  let viewCanvas = $state(null); // the old small canvas, view mode only
  let divCanvas = $state(null);
  let error = $state(null);
  let atlas = $state(null);
  let phase = $state(0);
  let litPhases = $state(new Set());
  let cyclesPerSecond = $state(0);
  let panelCanvases = $state({});
  let paused = $state(false);
  let followKey = $state('landValueMap'); // the layer 'follow the cycle' shows
  let lastStep = $state(null); // the step that just ran, while paused
  let railTip = $state(null); // { label, note, left } while a thumbnail is hovered
  let railEl = $state(null);
  let autoFollowed = false; // pausing switched the layer to 'follow' itself
  let keyOpen = $state(true);
  let keyCanvases = $state({});
  let hover = $state(null); // { info, left, top } while the pointer is over a tile
  let zoom = $state(1);

  let map, sim, frame, started = false, announcedReady = false;
  let speedMult = 1;
  // Display bookkeeping. Deliberately NOT $state: written every animation
  // frame, read only when the throttle fires.
  let cycleCount = 0;
  let lastRateAt = 0;
  let lastDisplayAt = 0;
  // The census is complete only just after phase 9 runs. The loop notes when it
  // passes that point and reports the metrics a few times a second from there.
  let censusFresh = false;
  let lastMetricsAt = 0;
  let hoverTile = null; // the tile under the pointer, { x, y }, not $state
  let lastHoverAt = 0;

  // In view mode the sandbox is a gallery card: a small canvas, no rail, and
  // it stops after a fixed number of steps. Thirty live
  // city simulations on one gallery page would melt a laptop.
  const VIEW_TICKS = 600;
  const DEFAULT_ATLAS = '/coefficients/tiles.png';

  // Offscreen buffers. The city renders once per paint at 6px a tile into a
  // fixed 720x600 buffer, and the display canvas blits from it under the
  // zoom/pan transform - so panning a paused city costs one drawImage, not
  // 12,000 tile blits.
  const BUF_W = 720;
  const BUF_H = 600;
  let cityBuf = null;
  let washBuf = null; // 120x100, one pixel per tile, nearest-neighbor up

  // Zoom/pan, CSS pixels. tx/ty is the content's top-left in the stage.
  let tx = 0, ty = 0;
  let userZoom = 1;
  let dragging = false, dragX = 0, dragY = 0, moved = false;

  // 'none' draws the city alone. 'follow' shows whichever map was updated
  // last, which is only readable while stepping. Anything else pins a map.
  const layerMode = $derived(
    !params.layer || params.layer === 'none' ? 'none' : params.layer === 'follow' ? 'follow' : 'pinned'
  );
  const activeKey = $derived(layerMode === 'pinned' ? params.layer : followKey);
  const activeMeta = $derived(BLOCK_MAPS.find((b) => b.key === activeKey) ?? BLOCK_MAPS[0]);

  // The key. Each entry is drawn from the atlas: a zone from its first
  // (top-left) tile and its size, an empty lot and then a built one.
  const KEY_TILES = [
    { label: 'residential', size: 3, tiles: [240, 279] },
    { label: 'commercial', size: 3, tiles: [423, 450] },
    { label: 'industrial', size: 3, tiles: [612, 639] },
    { label: 'police station', size: 3, tiles: [770] },
    { label: 'fire station', size: 3, tiles: [761] },
    { label: 'coal power plant', size: 4, tiles: [745] },
    { label: 'road', size: 1, tiles: [66] },
    { label: 'power line', size: 1, tiles: [210] },
    { label: 'trees', size: 1, tiles: [40] }
  ];

  // The wash's scale for the key, as a CSS gradient matching drawWash.
  const washScale = $derived(
    activeMeta.min < 0
      ? 'linear-gradient(to right, rgba(35,70,160,0.45), rgba(35,70,160,0) 50%, rgba(180,45,30,0) 50%, rgba(180,45,30,0.45))'
      : 'linear-gradient(to right, rgba(180,45,30,0), rgba(180,45,30,0.45))'
  );

  function metricsOut() {
    const m = readMetrics(sim);
    onmetrics?.({
      population: m.population.toLocaleString(),
      'demand for housing, shops, industry':
        m.rci.map((v) => (v > 0 ? '+' : '') + v).join('  '),
      'average land value': m.landValue,
      'average crime': m.crime,
      'steps run': m.cityTime * 16
    });
  }

  // Which phases were stepped through since the last paint. A layer is redrawn
  // when the phase that writes it fires - not every frame, because fifteen
  // heatmaps a frame is wasted work.
  let firedPhases = new Set();
  let pendingLit = new Set();

  function fitView() {
    if (!stageEl || !displayCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = stageEl.clientWidth;
    const ch = stageEl.clientHeight;
    if (displayCanvas.width !== Math.round(cw * dpr)) displayCanvas.width = Math.round(cw * dpr);
    if (displayCanvas.height !== Math.round(ch * dpr)) displayCanvas.height = Math.round(ch * dpr);
    clampPan();
  }

  function contentSize() {
    const cw = stageEl?.clientWidth ?? BUF_W;
    const ch = stageEl?.clientHeight ?? BUF_H;
    const base = Math.min(cw / BUF_W, ch / BUF_H);
    return { w: BUF_W * base * userZoom, h: BUF_H * base * userZoom, cw, ch };
  }

  function clampPan() {
    const { w, h, cw, ch } = contentSize();
    tx = w <= cw ? (cw - w) / 2 : Math.min(0, Math.max(cw - w, tx));
    ty = h <= ch ? (ch - h) / 2 : Math.min(0, Math.max(ch - h, ty));
  }

  function blitDisplay() {
    if (!displayCanvas || !cityBuf) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = displayCanvas.getContext('2d');
    const { w, h } = contentSize();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, tx * dpr, ty * dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cityBuf, 0, 0, w, h);
    if (washVisible() && washBuf) {
      // With a map showing, the city goes gray and pale so the map is the only
      // color on screen. The game's own palette (salmon ground, saturated
      // green parks) otherwise swamps a red wash. Blend modes rather than
      // ctx.filter, which Safari did not support until recently.
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(washBuf, 0, 0, w, h);
    }
  }

  // Whether the wash draws at all. Never for 'none'. Pinned, always. Following
  // the rotation, only at a speed a person can read - at 12 cycles a second a wash cycling
  // through fifteen layers is red noise, and several layers (crime, unspoilt
  // land) have a nonzero baseline over all empty terrain, so the noise covers
  // the whole map. Slowing the simulation down is what turns the x-ray on,
  // which is the right way round.
  const washVisible = () =>
    layerMode === 'pinned' || (layerMode === 'follow' && (paused || cyclesPerSecond <= 2));

  function paint(all = false) {
    if (view) {
      if (atlas && viewCanvas) drawCity(viewCanvas.getContext('2d'), map, atlas, 4);
      return;
    }
    if (atlas && cityBuf) drawCity(cityBuf.getContext('2d'), map, atlas, 6);
    if (washVisible() && washBuf) {
      drawWash(washBuf.getContext('2d'), sim.blockMaps[activeMeta.key], activeMeta);
    }
    blitDisplay();
    for (const meta of BLOCK_MAPS) {
      const c = panelCanvases[meta.key];
      if (c && (all || firedPhases.has(meta.phase))) {
        drawBlockMap(c.getContext('2d'), sim.blockMaps[meta.key], meta);
      }
    }
    firedPhases.clear();
  }

  // Which layer did the last phase write? Follow mode tracks it, throttled to
  // the same 160ms as the phase strip so the wash does not strobe at full
  // speed. Scratch maps are skipped - they are working copies, not the story.
  function latestWritten() {
    for (let back = 0; back < 16; back++) {
      const ph = (sim._phaseCycle - back + 16) % 16;
      const m = BLOCK_MAPS.find((b) => b.phase === ph && !b.scratch);
      if (m) return m.key;
    }
    return 'landValueMap';
  }

  // The step that just ran, and whether it did anything this cycle: the
  // expensive scans run only every Nth cycle (see PHASES in engine.js).
  function noteLastStep() {
    if (!sim) return;
    const p = PHASES[(sim._phaseCycle + 15) % 16];
    lastStep = { ...p, ran: !p.every || sim._simCycle % p.every === 0 };
  }

  // Pausing is how you step through the cycle, and stepping only makes sense
  // with the maps showing, so a pause with no map chosen switches to 'follow
  // the cycle'. A map the reader pinned is left alone. Playing again puts
  // 'none' back, if the switch was ours and nobody has changed it since.
  function autoFollow() {
    if (params.layer && params.layer !== 'none') return;
    if (sim) followKey = latestWritten();
    params.layer = 'follow';
    autoFollowed = true;
  }

  function unFollow() {
    if (autoFollowed && params.layer === 'follow') params.layer = 'none';
    autoFollowed = false;
  }

  // The thumbnail tooltip. Drawn by hand rather than with title=, because the
  // write flash changes each thumbnail's class several times a second and the
  // browser's own tooltip never survived long enough to appear.
  function showRailTip(e, meta) {
    const r = e.currentTarget.getBoundingClientRect();
    const rail = railEl.getBoundingClientRect();
    const left = Math.min(Math.max(0, r.left - rail.left), rail.width - 240);
    railTip = { label: meta.label, note: meta.note, left };
  }

  function stepOnce() {
    if (!sim) return;
    sim.simTickImmediate();
    const ph = sim._phaseCycle;
    if (ph === 0) cycleCount += 1;
    firedPhases.add(ph);
    pendingLit.add(ph);
    phase = ph;
    litPhases = new Set(pendingLit);
    pendingLit.clear();
    if (layerMode === 'follow') followKey = latestWritten();
    noteLastStep();
    paint();
    if (ph === 10) metricsOut();
    refreshHover();
  }

  function loop() {
    const steps = view ? 4 : paused ? 0 : ({ 0.5: 3, 1: 6, 2: 12, 4: 24 }[speedMult] ?? 6);
    for (let i = 0; i < steps; i++) {
      sim.simTickImmediate();
      const ph = sim._phaseCycle;
      if (ph === 0) cycleCount += 1;
      firedPhases.add(ph);
      pendingLit.add(ph);
      if (ph === 10) censusFresh = true;
    }
    const now = performance.now();
    if (steps > 0 || firedPhases.size) paint();

    // THE SIMULATION RUNS FAR FASTER THAN ANYONE CAN READ. At full speed the
    // strip reports WHICH PHASES RAN since the last repaint rather than where
    // a playhead is, throttled to about six a second - honest about the fact
    // that this thing is quicker than perception. Paused and stepping, the
    // playhead is real.
    if (steps > 0 && now - lastDisplayAt > 160) {
      lastDisplayAt = now;
      phase = sim._phaseCycle;
      litPhases = new Set(pendingLit);
      pendingLit.clear();
      if (layerMode === 'follow') followKey = latestWritten();
    }
    if (now - lastRateAt > 500) {
      cyclesPerSecond = paused ? 0 : Math.round((cycleCount * 1000) / (now - lastRateAt));
      cycleCount = 0;
      lastRateAt = now;
    }
    // The census is cleared at phase 0 and refilled by the scan over phases
    // 1-8, so reporting at phase 0 would announce a population of zero. The
    // numbers are read at the step the census completed, not at whatever
    // phase the frame happens to end on: the old test (is the displayed phase
    // 10?) almost never came true at speed, and the metrics sat still.
    if (censusFresh && now - lastMetricsAt > 250) {
      censusFresh = false;
      lastMetricsAt = now;
      metricsOut();
    }
    if (hoverTile && now - lastHoverAt > 250) {
      lastHoverAt = now;
      refreshHover();
    }

    if (view && sim._cityTime * 16 >= VIEW_TICKS) {
      if (!announcedReady) { announcedReady = true; onready?.(true); }
      return;
    }
    frame = requestAnimationFrame(loop);
  }

  // --- zoom and pan. Pointer events and a wheel, no library. ---
  function onWheel(e) {
    e.preventDefault();
    const next = Math.min(8, Math.max(1, userZoom * Math.exp(-e.deltaY * 0.0015)));
    if (next === userZoom) return;
    const rect = displayCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const k = next / userZoom;
    tx = mx - (mx - tx) * k;
    ty = my - (my - ty) * k;
    userZoom = next;
    zoom = next;
    clampPan();
    blitDisplay();
  }
  function onPointerDown(e) {
    dragging = true;
    moved = false;
    dragX = e.clientX;
    dragY = e.clientY;
    displayCanvas.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!dragging) {
      updateHover(e);
      return;
    }
    hover = null;
    hoverTile = null;
    const dx = e.clientX - dragX;
    const dy = e.clientY - dragY;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    tx += dx;
    ty += dy;
    dragX = e.clientX;
    dragY = e.clientY;
    clampPan();
    blitDisplay();
  }
  function onPointerUp(e) {
    dragging = false;
    displayCanvas.releasePointerCapture?.(e.pointerId);
  }
  function onPointerLeave() {
    hover = null;
    hoverTile = null;
  }

  // The tile under the pointer. The city fills contentSize() at the pan
  // offset, one map tile to every (width / map.width) pixels.
  function updateHover(e) {
    if (!map || !sim) return;
    const rect = displayCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { w, h } = contentSize();
    const x = Math.floor(((mx - tx) / w) * map.width);
    const y = Math.floor(((my - ty) / h) * map.height);
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
      onPointerLeave();
      return;
    }
    hoverTile = { x, y, mx, my, cw: rect.width, ch: rect.height };
    refreshHover();
  }

  // Re-read the hovered tile, so the readout keeps up with a running city.
  function refreshHover() {
    if (!hoverTile || !sim) return;
    const { x, y, mx, my, cw, ch } = hoverTile;
    const info = inspectTile(map, sim, x, y);
    if (!info) return;
    // Beside the pointer, flipped to the other side near the stage's edges.
    const left = mx > cw - 200 ? mx - 186 : mx + 14;
    const top = my > ch - 170 ? my - 160 : my + 14;
    hover = { info, left, top };
  }

  function resetView() {
    userZoom = 1;
    zoom = 1;
    clampPan();
    blitDisplay();
  }

  function pinLayer(key) {
    // Clicking the pinned thumbnail unpins back to follow mode.
    params.layer = params.layer === key ? 'none' : key;
    paint(true);
  }

  async function boot() {
    try {
      started = true;
      atlas = await loadAtlas(assets.tiles ?? DEFAULT_ATLAS);
      if (!view) {
        cityBuf = document.createElement('canvas');
        cityBuf.width = BUF_W;
        cityBuf.height = BUF_H;
        washBuf = document.createElement('canvas');
        washBuf.width = 120;
        washBuf.height = 100;
        fitView();
        ontransport?.({
          label: 'the clock',
          playing: true,
          play: () => { paused = false; unFollow(); },
          pause: () => { paused = true; cyclesPerSecond = 0; noteLastStep(); autoFollow(); },
          step: () => { paused = true; autoFollow(); stepOnce(); },
          setSpeed: (m) => { speedMult = m; },
          readout: () =>
            sim
              ? paused
                ? `paused · tick ${sim._cityTime * 16}`
                : `${cyclesPerSecond} cycles/s · tick ${sim._cityTime * 16}`
              : ''
        });
      }
      rebuild();
    } catch (err) {
      error = String(err?.message ?? err);
      onready?.(true); // never hang the cover pipeline on a load failure
    }
  }

  function rebuild() {
    cancelAnimationFrame(frame);
    announcedReady = false;
    const built = createCity({
      seed: params.seed ?? 1,
      params: $state.snapshot(params),
      assets: $state.snapshot(assets)
    });
    map = built.map;
    sim = built.sim;
    // Get past the first cycle so the panel is not reporting an empty census.
    run(sim, 32);
    phase = sim._phaseCycle;
    metricsOut();
    paint(true);
    if (!view && !announcedReady) { announcedReady = true; onready?.(true); }
    frame = requestAnimationFrame(loop);
  }

  $effect(() => {
    if (browser && (view ? viewCanvas : displayCanvas) && !started) boot();
  });

  // A changed seed or starting city means a different run, and the city is
  // rebuilt from the beginning. Every other constant is read at call time by
  // the engine, so it takes effect on the running city without a restart.
  //
  // The rebuild is UNTRACKED. It reads half the component's state (the speed,
  // the pinned layer, every param through the snapshot), and an effect that
  // calls it untracked-free subscribes to all of it: after the first change of
  // seed, the city was rebuilt every time the cycles-per-second readout
  // ticked, twice a second, and never got off the ground.
  $effect(() => {
    void params.seed;
    void params.urban_form;
    untrack(() => {
      if (started && sim) rebuild();
    });
  });

  // Pinning a different layer must repaint the wash even while paused.
  $effect(() => {
    void params.layer;
    if (started && sim && !view) untrack(() => paint(true));
  });

  // The key's tile pictures, drawn from the same atlas as the city.
  $effect(() => {
    if (!atlas || !keyOpen) return;
    for (const item of KEY_TILES) {
      for (const [i, first] of item.tiles.entries()) {
        const c = keyCanvases[item.label + i];
        if (c) drawTiles(c.getContext('2d'), atlas, first, item.size);
      }
    }
  });

  $effect(() => {
    if (view || !stageEl) return;
    const ro = new ResizeObserver(() => {
      fitView();
      blitDisplay();
    });
    ro.observe(stageEl);
    return () => ro.disconnect();
  });

  onDestroy(() => {
    cancelAnimationFrame(frame);
  });
</script>

<div class="wrap" class:view>
  {#if view}
    <canvas bind:this={viewCanvas} width={480} height={400} class="city-view"></canvas>
  {:else}
    {#if params.show_rail !== false}
      <div class="rail" bind:this={railEl}>
        <div class="layers" class:pinned={layerMode === 'pinned'}>
          {#each BLOCK_MAPS as meta (meta.key)}
            <button
              type="button"
              class="layer"
              class:scratch={meta.scratch}
              class:active={layerMode !== 'none' && activeKey === meta.key}
              class:writing={litPhases.has(meta.phase)}
              onclick={() => pinLayer(meta.key)}
              onpointerenter={(e) => showRailTip(e, meta)}
              onpointerleave={() => (railTip = null)}
              aria-label={meta.label}
            >
              <canvas bind:this={panelCanvases[meta.key]} width={104} height={88}></canvas>
              <span class="layer-label"><b>{meta.label}</b></span>
            </button>
          {/each}
        </div>
        {#if railTip}
          <div class="rail-tip" style:left="{railTip.left}px">
            <b>{railTip.label}</b>
            {railTip.note}
          </div>
        {/if}
      </div>
    {/if}

    <div class="stage" bind:this={stageEl}>
      <canvas
        bind:this={displayCanvas}
        class="display"
        class:grabbing={dragging}
        onwheel={onWheel}
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointerleave={onPointerLeave}
        ondblclick={resetView}
      ></canvas>

      <div class="legend" class:closed={!keyOpen}>
        <button type="button" class="legend-head" onclick={() => (keyOpen = !keyOpen)} aria-expanded={keyOpen}>
          key <span>{keyOpen ? '−' : '+'}</span>
        </button>
        {#if keyOpen}
          <ul class="legend-tiles">
            {#each KEY_TILES as item (item.label)}
              <li>
                <span class="legend-icons">
                  {#each item.tiles as _, i}
                    <canvas bind:this={keyCanvases[item.label + i]} width={24} height={24}></canvas>
                  {/each}
                </span>
                {item.label}
              </li>
            {/each}
          </ul>
          {#if washVisible()}
            <div class="legend-layer">
              <b>{activeMeta.label}</b>
              <i style:background={washScale}></i>
              <span><span>{activeMeta.min}</span><span>{activeMeta.max}</span></span>
            </div>
          {:else if layerMode === 'follow'}
            <div class="legend-layer">Pause or slow the clock to see the maps as they update.</div>
          {/if}
        {/if}
      </div>

      {#if hover}
        <div class="tip" style:left="{hover.left}px" style:top="{hover.top}px">
          <b>{hover.info.kind}</b>
          <table>
            <tbody>
              {#each hover.info.rows as [label, value] (label)}
                <tr><td>{label}</td><td>{value}</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      <div class="stage-chips">
        {#if zoom > 1.01}
          <button type="button" class="chip" onclick={resetView}>reset view · {zoom.toFixed(1)}×</button>
        {:else}
          <span class="chip quiet">scroll to zoom, drag to pan</span>
        {/if}
      </div>

      {#if error}
        <p class="err">Couldn't start the engine: {error}</p>
      {/if}
    </div>

    <div class="phasebar">
      <div class="phase-row">
        {#each PHASES as p (p.n)}
          <i
            class:lit={paused ? p.n === lastStep?.n : litPhases.has(p.n)}
            class:key={p.n === 12 || p.n === 13 || p.n === 14}
            title="Step {p.n + 1}: {p.name}. {p.about}"
          ></i>
        {/each}
      </div>
      <p class="phase-now">
        {#if paused && lastStep}
          <b>Step {lastStep.n + 1} of 16: {lastStep.name}.</b>
          {#if !lastStep.ran}<em>Skipped this cycle; it runs every {lastStep.every}th.</em>{/if}
          {lastStep.about}
        {:else if cyclesPerSecond > 2}
          <b>{cyclesPerSecond} cycles a second,</b> sixteen steps each. Pause and
          step forward to see what each step does.
        {:else}
          <b>Running slowly.</b> Pause and step forward to see what each step does.
        {/if}
      </p>
    </div>

  {/if}
</div>

<style>
  .wrap { position: absolute; inset: 0; display: flex; flex-direction: column;
          overflow: hidden; background: #f4f4f2; }
  .wrap.view { display: block; }
  .city-view { image-rendering: pixelated; width: 100%; height: 100%;
               object-fit: contain; display: block; }

  .stage { position: relative; flex: 1; min-height: 0; overflow: hidden; }
  .display { position: absolute; inset: 0; width: 100%; height: 100%;
             display: block; cursor: grab; touch-action: none; }
  .display.grabbing { cursor: grabbing; }

  /* Top left of the map, folding to its heading. The chips sit top center and
     the floating panels are outside the map, so the corner is free. */
  .legend {
    position: absolute; left: 0.5rem; top: 0.5rem; width: 150px;
    border: 1px solid #000; background: rgba(255,255,255,0.95);
    font-size: 0.6rem; line-height: 1.3;
  }
  .legend.closed { width: auto; }
  .legend-head {
    display: flex; justify-content: space-between; width: 100%; gap: 0.8rem;
    font: inherit; font-weight: 700; padding: 0.25rem 0.4rem;
    background: transparent; border: 0; cursor: pointer; text-align: left;
  }
  .legend-tiles { list-style: none; margin: 0; padding: 0 0.4rem 0.3rem; }
  .legend-tiles li { display: flex; align-items: center; gap: 0.35rem; padding: 1px 0; }
  .legend-icons { display: flex; gap: 2px; flex: 0 0 50px; }
  .legend-icons canvas { width: 24px; height: 24px; image-rendering: pixelated; }
  .legend-layer { border-top: 1px solid #eee; padding: 0.3rem 0.4rem 0.35rem; }
  .legend-layer i { display: block; height: 8px; margin: 0.2rem 0 0.1rem; border: 1px solid #ddd; }
  .legend-layer > span { display: flex; justify-content: space-between; color: #888; }

  /* The hover readout. pointer-events off, so it never steals the drag. */
  .tip {
    position: absolute; pointer-events: none; z-index: 2; min-width: 150px;
    background: #fff; border: 1px solid #000; padding: 0.3rem 0.45rem;
    font-size: 0.6rem; line-height: 1.35;
  }
  .tip b { display: block; margin-bottom: 0.15rem; }
  .tip table { border-collapse: collapse; width: 100%; }
  .tip td { padding: 0; }
  .tip td:last-child { text-align: right; padding-left: 0.8rem; font-variant-numeric: tabular-nums; }

  .stage-chips {
    position: absolute; left: 50%; transform: translateX(-50%); top: 0.5rem;
    display: flex; gap: 0.4rem; align-items: center;
  }
  .chip-group { display: flex; border: 1px solid #ccc; background: #fff; }
  .chip-group button {
    font: inherit; font-size: 0.62rem; padding: 0.25rem 0.5rem;
    background: #fff; border: 0; border-right: 1px solid #eee;
    cursor: pointer; color: #666;
  }
  .chip-group button:last-child { border-right: 0; }
  .chip-group button.on { background: #000; color: #fff; }
  .chip {
    font: inherit; font-size: 0.6rem; padding: 0.25rem 0.5rem;
    background: #fff; border: 1px solid #ccc; cursor: pointer; color: #666;
  }
  span.chip { cursor: default; border-color: #eee; color: #aaa; }

  .err { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
         font-size: 0.75rem; color: #a00; background: rgba(255,255,255,0.9);
         padding: 0.4rem 0.7rem; max-width: 80%; text-align: center; }

  .phasebar {
    display: flex; gap: 0.9rem; align-items: center;
    padding: 0.35rem 0.6rem; border-top: 1px solid #e4e4e0; background: #fbfbf9;
  }
  .phase-row { display: flex; gap: 2px; flex: 0 0 190px; }
  .phase-row i { flex: 1; height: 11px; background: #e6e6e2; display: block; }
  .phase-row i.key { background: #cfcfe8; }
  .phase-row i.lit { background: #000; }
  /* Reserved height: the caption is one line at some states and two at
     others, and without it the rail below jumps on every throttle tick. */
  .phase-now {
    margin: 0; font-size: 0.6rem; color: #666; line-height: 1.4; flex: 1;
    min-height: calc(0.6rem * 1.4 * 2);
  }
  .phase-now b { color: #000; }

  /* A strip along the top of the city, toggled from the representation
     panel. It was under the map until the 09-08 reframe; with the map now
     filling the stage there is room for it above, where the fifteen
     thumbnails are large enough to follow as they are written. */
  .rail { border-bottom: 1px solid #000; background: #fbfbf9; flex: none; position: relative; z-index: 3; }
  .rail-tip {
    position: absolute; top: calc(100% + 4px); width: 240px; pointer-events: none;
    background: #fff; border: 1px solid #000; padding: 0.3rem 0.45rem;
    font-size: 0.6rem; line-height: 1.4; color: #555;
  }
  .rail-tip b { display: block; color: #000; }

  .layers {
    display: grid; grid-template-columns: repeat(15, minmax(0, 1fr)); gap: 1px;
    background: #e4e4e0; border-bottom: 1px solid #e4e4e0;
  }
  .layer {
    display: flex; flex-direction: column; padding: 0.25rem 0.25rem 0.2rem;
    background: #fbfbf9; border: 0; cursor: pointer; font: inherit;
    text-align: left; position: relative;
  }
  .layer canvas { width: 100%; height: auto; border: 1px solid #ddd; background: #fff; }
  .layer.scratch { opacity: 0.5; }
  .layer.active canvas { border-color: #000; box-shadow: 0 0 0 1px #000; }
  /* With a map pinned, the others fade, so the strip says which one is on. */
  .layers.pinned .layer:not(.active) { opacity: 0.3; }
  .layers.pinned .layer:not(.active):hover { opacity: 0.7; }
  /* The write flash: the border of the layer a firing phase just rewrote.
     Throttled with litPhases, same honesty as the phase strip. */
  .layer.writing canvas { border-color: #a03424; box-shadow: 0 0 0 1px #a03424; }
  .layer-label {
    display: flex; justify-content: space-between; align-items: baseline;
    font-size: 0.56rem; padding-top: 0.15rem;
  }
  .layer-label b { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .layer-label i { color: #aaa; font-style: normal; flex: none; }


  @media (max-width: 1400px) {
    .layers { grid-template-columns: repeat(8, minmax(0, 1fr)); }
  }

  @media (max-width: 900px) {
    .layers { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  }
</style>
