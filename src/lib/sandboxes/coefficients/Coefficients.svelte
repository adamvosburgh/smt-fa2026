<script>
  // Sandbox 03 - A City Simulator, Opened Up (slug coefficients).
  //
  // micropolisJS with its guts exposed. One big canvas: the city, with the
  // selected internal layer composited over it as a translucent heat wash,
  // tile-for-tile aligned - every block map shares the city's 120x100
  // geometry, so crime washed over the actual blocks shows which buildings
  // sit in the red. A hero panel top-right shows the layer the phase most
  // recently wrote; the fifteen rasters run in a rail below, each redrawn as
  // its phase fires.
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
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { BLOCK_MAPS, PHASES, createCity, run, readMetrics } from './engine.js';
  import { drawCity, drawBlockMap, drawWash, drawDivergence, loadAtlas } from './renderer.js';
  import DivergenceWorker from './divergence.worker.js?worker';

  let { params, assets = {}, mode = 'edit', dataBase, onmetrics, onready, ontransport } = $props();

  const view = $derived(mode === 'view');

  let stageEl = $state(null);
  let displayCanvas = $state(null);
  let viewCanvas = $state(null); // the old small canvas, view mode only
  let heroCanvas = $state(null);
  let divCanvas = $state(null);
  let error = $state(null);
  let atlas = $state(null);
  let phase = $state(0);
  let litPhases = $state(new Set());
  let cyclesPerSecond = $state(0);
  let tally = $state(null);
  let divergenceState = $state('idle');
  let divergenceSpread = $state(null);
  let panelCanvases = $state({});
  let paused = $state(false);
  let overlayMode = $state('wash'); // 'wash' | 'off' | 'solo'
  let followKey = $state('landValueMap'); // the layer the wash+hero track
  let heroPhase = $state(12);
  let railTab = $state('layers'); // 'layers' | 'divergence'
  let zoom = $state(1);

  let map, sim, frame, worker, started = false, announcedReady = false;
  let speedMult = 1;
  // Display bookkeeping. Deliberately NOT $state: written every animation
  // frame, read only when the throttle fires.
  let cycleCount = 0;
  let lastRateAt = 0;
  let lastDisplayAt = 0;

  // In view mode the sandbox is a gallery card: a small canvas, no rail, no
  // divergence runs, and it stops after a fixed number of steps. Thirty live
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
  let soloBuf = null;

  // Zoom/pan, CSS pixels. tx/ty is the content's top-left in the stage.
  let tx = 0, ty = 0;
  let userZoom = 1;
  let dragging = false, dragX = 0, dragY = 0, moved = false;

  const activeKey = $derived(
    params.layer && params.layer !== 'none' ? params.layer : followKey
  );
  const activeMeta = $derived(BLOCK_MAPS.find((b) => b.key === activeKey) ?? BLOCK_MAPS[0]);

  function metricsOut() {
    const m = readMetrics(sim);
    onmetrics?.({
      population: m.population.toLocaleString(),
      'residential / commercial / industrial demand':
        m.rci.map((v) => (v > 0 ? '+' : '') + v).join('  '),
      'mean land value': m.landValue,
      'mean crime': m.crime,
      'spread across runs at the final tick':
        divergenceSpread === null ? (view ? 'not run in view mode' : '…') : divergenceSpread,
      'ticks run': m.cityTime * 16
    });
  }

  // Which phases were stepped through since the last paint. A layer is redrawn
  // when the phase that writes it fires - not every frame, because fifteen
  // heatmaps a frame is wasted work.
  let firedPhases = new Set();
  let pendingLit = new Set();

  // The sweep reveal: when the hero's layer is rewritten slowly enough to
  // watch (stepping, or the cycle under ~2 a second), the new raster wipes
  // in left to right over a snapshot of the old one. The blur/decay itself is
  // synchronous inside one tick and cannot be observed live; the wipe is the
  // honest way to show "this layer was just recomputed, whole".
  let heroPrev = null;
  let heroNext = null;
  let sweepStart = 0;
  const SWEEP_MS = 300;

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
    if (overlayMode === 'solo') {
      if (soloBuf) ctx.drawImage(soloBuf, 0, 0, w, h);
    } else {
      ctx.drawImage(cityBuf, 0, 0, w, h);
      if (washVisible() && washBuf) ctx.drawImage(washBuf, 0, 0, w, h);
    }
  }

  function paintHero(withSweep) {
    if (!heroCanvas) return;
    const ctx = heroCanvas.getContext('2d');
    if (withSweep && heroPrev) {
      // snapshot old, draw new into heroNext, animate in the loop
      heroPrev.getContext('2d').drawImage(heroCanvas, 0, 0);
      drawBlockMap(heroNext.getContext('2d'), sim.blockMaps[activeMeta.key], activeMeta);
      sweepStart = performance.now();
    } else {
      drawBlockMap(ctx, sim.blockMaps[activeMeta.key], activeMeta);
    }
  }

  function sweepFrame(now) {
    if (!sweepStart || !heroCanvas) return false;
    const t = Math.min(1, (now - sweepStart) / SWEEP_MS);
    const ctx = heroCanvas.getContext('2d');
    const w = heroCanvas.width;
    ctx.drawImage(heroPrev, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, Math.round(w * t), heroCanvas.height);
    ctx.clip();
    ctx.drawImage(heroNext, 0, 0);
    ctx.restore();
    if (t >= 1) sweepStart = 0;
    return true;
  }

  // Whether the wash draws at all. Pinned, always. Following the rotation,
  // only at a speed a person can read - at 12 cycles a second a wash cycling
  // through fifteen layers is red noise, and several layers (crime, unspoilt
  // land) have a nonzero baseline over all empty terrain, so the noise covers
  // the whole map. Slowing the simulation down is what turns the x-ray on,
  // which is the right way round.
  const washVisible = () =>
    overlayMode === 'wash' &&
    ((params.layer && params.layer !== 'none') || paused || cyclesPerSecond <= 2);

  function paint(all = false) {
    if (view) {
      if (atlas && viewCanvas) drawCity(viewCanvas.getContext('2d'), map, atlas, 4);
      return;
    }
    if (atlas && cityBuf) drawCity(cityBuf.getContext('2d'), map, atlas, 6);
    if (washVisible() && washBuf) {
      drawWash(washBuf.getContext('2d'), sim.blockMaps[activeMeta.key], activeMeta);
    } else if (overlayMode === 'solo' && soloBuf) {
      drawBlockMap(soloBuf.getContext('2d'), sim.blockMaps[activeMeta.key], activeMeta);
    }
    blitDisplay();
    if (all || firedPhases.has(activeMeta.phase)) {
      paintHero(paused || cyclesPerSecond <= 2);
    }
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
    if (params.layer === 'none' || !params.layer) followKey = latestWritten();
    heroPhase = activeMeta.phase;
    paint();
    if (ph === 10) metricsOut();
  }

  function loop() {
    const steps = view ? 4 : paused ? 0 : ({ 0.5: 3, 1: 6, 2: 12, 4: 24 }[speedMult] ?? 6);
    for (let i = 0; i < steps; i++) {
      sim.simTickImmediate();
      const ph = sim._phaseCycle;
      if (ph === 0) cycleCount += 1;
      firedPhases.add(ph);
      pendingLit.add(ph);
    }
    const now = performance.now();
    const sweeping = sweepFrame(now);
    if (steps > 0) paint();
    else if (!sweeping && firedPhases.size) paint();

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
      if (params.layer === 'none' || !params.layer) followKey = latestWritten();
      heroPhase = activeMeta.phase;
    }
    if (now - lastRateAt > 500) {
      cyclesPerSecond = paused ? 0 : Math.round((cycleCount * 1000) / (now - lastRateAt));
      cycleCount = 0;
      lastRateAt = now;
    }
    // The census is cleared at phase 0 and refilled by the scan over phases
    // 1-8, so reporting at phase 0 would announce a population of zero.
    if (steps > 0 && phase === 10) metricsOut();

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
    if (!dragging) return;
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

  function startDivergence() {
    if (view) return;
    divergenceState = 'running';
    onready?.(false);
    worker?.terminate();
    worker = new DivergenceWorker();
    const seeds = Array.from({ length: params.run_count ?? 5 }, (_, i) => (params.seed ?? 1) + i);
    worker.onmessage = (e) => {
      if (e.data.type !== 'done') return;
      const runs = e.data.runs;
      if (divCanvas) drawDivergence(divCanvas.getContext('2d'), runs, 'population', 'population, by step');
      const finals = runs.map((r) => r.at(-1)?.population ?? 0);
      divergenceSpread = `${Math.min(...finals)} – ${Math.max(...finals)}`;
      divergenceState = 'done';
      metricsOut();
      onready?.(true);
    };
    worker.onerror = (e) => {
      divergenceState = 'failed';
      divergenceSpread = 'runs failed';
      onready?.(true);
      console.error('divergence worker failed', e);
    };
    worker.postMessage({
      seeds, params: $state.snapshot(params), assets: $state.snapshot(assets),
      ticks: params.ticks ?? 1000
    });
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
        soloBuf = document.createElement('canvas');
        soloBuf.width = 240;
        soloBuf.height = 200;
        heroPrev = document.createElement('canvas');
        heroNext = document.createElement('canvas');
        heroPrev.width = heroNext.width = 240;
        heroPrev.height = heroNext.height = 200;
        fitView();
        ontransport?.({
          label: 'the simulation',
          playing: true,
          play: () => { paused = false; },
          pause: () => { paused = true; cyclesPerSecond = 0; },
          step: () => { paused = true; stepOnce(); },
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
      if (!view) startDivergence();
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
    tally = built.tally;
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

  // A changed seed means a different run and the city has to be rebuilt from
  // the beginning. Every other constant is read at call time by the engine, so
  // it takes effect on the running city without a restart.
  $effect(() => {
    void params.seed;
    if (started && sim) rebuild();
  });

  // Pinning a different layer must repaint the wash and hero even while paused.
  $effect(() => {
    void params.layer;
    void overlayMode;
    if (started && sim && !view) paint(true);
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
    worker?.terminate();
  });
</script>

<div class="wrap" class:view>
  {#if view}
    <canvas bind:this={viewCanvas} width={480} height={400} class="city-view"></canvas>
  {:else}
    <div class="stage" bind:this={stageEl}>
      <canvas
        bind:this={displayCanvas}
        class="display"
        class:grabbing={dragging}
        onwheel={onWheel}
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        ondblclick={resetView}
      ></canvas>

      <div class="hero">
        <canvas bind:this={heroCanvas} width={240} height={200}></canvas>
        <p class="hero-caption">
          <b>{activeMeta.label}</b>
          <span>
            phase {activeMeta.phase} writes it ·
            {params.layer && params.layer !== 'none' ? 'pinned' : 'following the rotation'}
          </span>
        </p>
      </div>

      <div class="stage-chips">
        <div class="chip-group">
          {#each [['wash', 'overlay'], ['off', 'city'], ['solo', 'layer']] as [v, label] (v)}
            <button type="button" class:on={overlayMode === v} onclick={() => (overlayMode = v)}>
              {label}
            </button>
          {/each}
        </div>
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
            class:lit={paused ? p.n === phase : litPhases.has(p.n)}
            class:key={p.n === 12 || p.n === 13 || p.n === 14}
            title="{p.n}. {p.name} — writes {p.writes}"
          ></i>
        {/each}
      </div>
      <p class="phase-now">
        {#if paused}
          <b>Paused at phase {phase} — {PHASES[phase]?.name}.</b>
          Step to watch the sixteen phases write their layers one at a time.
        {:else if cyclesPerSecond > 2}
          <b>{cyclesPerSecond} complete cycles a second</b> — every box lights
          because the whole cycle runs many times between one frame and the
          next, far faster than you can read it. Slow it down or step.
        {:else}
          <b>Running slowly.</b> The playhead is real at this speed; watch the
          three that matter — land value, crime, density — fire in order.
        {/if}
      </p>
    </div>

    <div class="rail">
      <div class="rail-head">
        <button type="button" class:on={railTab === 'layers'} onclick={() => (railTab = 'layers')}>
          every layer the simulation keeps
        </button>
        <button
          type="button"
          class:on={railTab === 'divergence'}
          onclick={() => (railTab = 'divergence')}
        >
          same rules, different seed
          {#if divergenceState === 'running'}<span class="tag">running…</span>
          {:else if divergenceState === 'failed'}<span class="tag">failed</span>{/if}
        </button>
      </div>

      <div class="layers" hidden={railTab !== 'layers'}>
        {#each BLOCK_MAPS as meta (meta.key)}
          <button
            type="button"
            class="layer"
            class:scratch={meta.scratch}
            class:active={activeKey === meta.key}
            class:writing={litPhases.has(meta.phase)}
            onclick={() => pinLayer(meta.key)}
            title="{meta.note} — phase {meta.phase}, {meta.min}–{meta.max}. Click to wash it over the city."
          >
            <canvas bind:this={panelCanvases[meta.key]} width={104} height={88}></canvas>
            <span class="layer-label"><b>{meta.label}</b> <i>ph {meta.phase}</i></span>
          </button>
        {/each}
      </div>

      <div class="divergence" hidden={railTab !== 'divergence'}>
        <canvas bind:this={divCanvas} width={520} height={110}></canvas>
        {#if tally}
          <p class="tally">
            Starting city: {tally.zones} zones, {tally.services} stations,
            {tally.plants} power plants, {tally.roads} road and {tally.wires} wire
            tiles. Identical on every run; only the seed differs.
          </p>
        {/if}
      </div>
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

  .hero {
    position: absolute; right: 0.5rem; top: 0.5rem; width: 240px;
    border: 1px solid #000; background: #fff;
  }
  .hero canvas { display: block; width: 100%; height: auto; image-rendering: pixelated; }
  .hero-caption {
    margin: 0; padding: 0.25rem 0.4rem; font-size: 0.6rem; line-height: 1.4;
    border-top: 1px solid #eee; display: flex; flex-direction: column;
  }
  .hero-caption b { font-size: 0.66rem; }
  .hero-caption span { color: #999; }

  .stage-chips {
    position: absolute; left: 0.5rem; top: 0.5rem;
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

  .rail { border-top: 1px solid #000; background: #fbfbf9; }
  .rail-head { display: flex; border-bottom: 1px solid #e4e4e0; }
  .rail-head button {
    font: inherit; font-size: 0.62rem; text-transform: lowercase;
    letter-spacing: 0.06em; padding: 0.3rem 0.6rem;
    background: transparent; border: 0; border-right: 1px solid #e4e4e0;
    cursor: pointer; color: #999;
  }
  .rail-head button.on { color: #000; font-weight: 700; }
  .tag { color: #a00; font-weight: 700; margin-left: 0.3rem; }

  .layers {
    display: grid; grid-template-columns: repeat(8, 1fr); gap: 1px;
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
  /* The write flash: the border of the layer a firing phase just rewrote.
     Throttled with litPhases, same honesty as the phase strip. */
  .layer.writing canvas { border-color: #a03424; box-shadow: 0 0 0 1px #a03424; }
  .layer-label {
    display: flex; justify-content: space-between; align-items: baseline;
    font-size: 0.56rem; padding-top: 0.15rem;
  }
  .layer-label b { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .layer-label i { color: #aaa; font-style: normal; flex: none; }

  .divergence { padding: 0.4rem 0.6rem 0.5rem; }
  .divergence canvas { width: 100%; max-width: 560px; height: 110px;
                       background: #fff; border: 1px solid #e4e4e0; display: block; }
  .tally { margin: 0.35rem 0 0; font-size: 0.58rem; color: #999; line-height: 1.5; }

  @media (max-width: 900px) {
    .layers { grid-template-columns: repeat(5, 1fr); }
    .hero { width: 160px; }
  }
</style>
