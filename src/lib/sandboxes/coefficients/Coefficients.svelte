<script>
  // Sandbox 04 - The Coefficients.
  //
  // micropolisJS with its guts exposed. The city runs as usual on the left, and
  // beside it every internal layer is drawn as it updates.
  //
  // The contract, as bathtub sets it out:
  //   props in : params, assets, mode ('edit' | 'view'), dataBase
  //   props in : onmetrics(obj), onready(bool)  - supplied by SandboxFrame
  //   never    : this component does not touch window.__metrics or
  //              data-cover-ready. It reports; the frame publishes.
  //
  // Nothing is fetched from dataBase at all, because this sandbox has no data
  // pipeline: its data is source code. `dataBase` points at data/processed via
  // static/data, which is gitignored and rebuilt by sync-assets from the Python
  // pipelines - and there is no coefficients pipeline to write anything there.
  //
  // The tile atlas is a VENDORED ASSET, committed at static/coefficients/, and
  // it is referenced by a plain absolute URL so it resolves identically in dev,
  // under adapter-node, and in the frozen static build. It is loaded by URL
  // rather than imported so that a submitted tiles.png replaces it with no code
  // change at all.
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { BLOCK_MAPS, PHASES, createCity, run, readMetrics } from './engine.js';
  import { drawCity, drawBlockMap, drawDivergence, loadAtlas, peak } from './renderer.js';
  import DivergenceWorker from './divergence.worker.js?worker';

  let { params, assets = {}, mode = 'edit', dataBase, onmetrics, onready } = $props();

  const view = $derived(mode === 'view');

  let cityCanvas = $state(null);
  let layerCanvas = $state(null);
  let divCanvas = $state(null);
  let error = $state(null);
  let atlas = $state(null);
  let phase = $state(0);
  // Which phases fired since the panel last repainted, and how fast the cycle
  // is actually turning. Both are throttled to a readable rate - see the note
  // above the phase strip in the markup.
  let litPhases = $state(new Set());
  let cyclesPerSecond = $state(0);
  let tally = $state(null);
  let divergenceState = $state('idle');
  let divergenceSpread = $state(null);
  let panelCanvases = $state({});

  let map, sim, frame, worker, started = false, announcedReady = false;
  // Display bookkeeping for the phase strip. Deliberately NOT $state: they are
  // written every animation frame and read only when the throttle fires, so
  // making them reactive would schedule sixty re-renders a second to no end.
  let cycleCount = 0;
  let lastRateAt = 0;
  let lastDisplayAt = 0;

  // In view mode the sandbox is a gallery card, not the sandbox: a small canvas,
  // no layer panel, no divergence runs, and it stops after a fixed number of
  // steps. Thirty live city simulations on one gallery page would melt a laptop.
  const VIEW_TICKS = 600;

  // Committed at static/coefficients/tiles.png. See the note above boot().
  const DEFAULT_ATLAS = '/coefficients/tiles.png';
  const SCALE = $derived(view ? 4 : 6);

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
  // heatmaps a frame is wasted work, and not on a timer, because then the panel
  // and the simulation drift out of step with each other.
  let firedPhases = new Set();
  let pendingLit = new Set();

  function paint(all = false) {
    if (atlas && cityCanvas) {
      drawCity(cityCanvas.getContext('2d'), map, atlas, SCALE);
    }
    if (!view) {
      for (const meta of BLOCK_MAPS) {
        const c = panelCanvases[meta.key];
        if (c && (all || firedPhases.has(meta.phase))) {
          drawBlockMap(c.getContext('2d'), sim.blockMaps[meta.key], meta);
        }
      }
      firedPhases.clear();
    }
    if (layerCanvas && params.layer && params.layer !== 'none') {
      const meta = BLOCK_MAPS.find((b) => b.key === params.layer);
      if (meta) drawBlockMap(layerCanvas.getContext('2d'), sim.blockMaps[meta.key], meta);
    }
  }

  function loop() {
    const steps = view ? 4 : [0, 2, 6, 16][params.speed ?? 2];
    for (let i = 0; i < steps; i++) {
      sim.simTickImmediate();
      const ph = sim._phaseCycle;
      if (ph === 0) cycleCount += 1;
      firedPhases.add(ph);
      pendingLit.add(ph);
    }
    paint();

    // THE SIMULATION RUNS FAR FASTER THAN ANYONE CAN READ. At the default speed
    // it takes six phases per animation frame - about 360 a second, or twenty
    // complete cycles. A caption naming "the current phase" was therefore
    // strobing, and because its text ran to one line for `power` and three for
    // `pollution, terrain, land value`, the whole panel below it jumped on
    // every frame and the layer list was unreadable.
    //
    // So the strip reports WHICH PHASES RAN since the last repaint rather than
    // where a playhead is, the repaint is throttled to about six a second, and
    // the caption is a fixed-height line that says how fast the cycle is
    // actually turning. All three are honest about the same fact: this thing is
    // quicker than perception, and pretending otherwise made it illegible.
    const now = performance.now();
    if (now - lastDisplayAt > 160) {
      lastDisplayAt = now;
      phase = sim._phaseCycle;
      litPhases = new Set(pendingLit);
      pendingLit.clear();
    }
    if (now - lastRateAt > 500) {
      cyclesPerSecond = Math.round((cycleCount * 1000) / (now - lastRateAt));
      cycleCount = 0;
      lastRateAt = now;
    }
    // The census is cleared at phase 0 and refilled by the scan over phases 1-8,
    // so reporting at phase 0 would announce a population of zero forever.
    if (phase === 10) metricsOut();

    if (view && sim._cityTime * 16 >= VIEW_TICKS) {
      if (!announcedReady) { announcedReady = true; onready?.(true); }
      return;
    }
    frame = requestAnimationFrame(loop);
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
      rebuild();
      if (view) {
        // Nothing async is outstanding, but the cover screenshot still waits for
        // the run to reach VIEW_TICKS - see loop().
      } else {
        startDivergence();
      }
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
    if (browser && cityCanvas && !started) boot();
  });

  // A changed seed means a different run and the city has to be rebuilt from
  // the beginning - a seed applied halfway through means nothing. Every other
  // constant is read at call time by the engine, so it takes effect on the
  // running city without a restart, which is far more instructive.
  $effect(() => {
    void params.seed;
    if (started && sim) rebuild();
  });

  onDestroy(() => {
    cancelAnimationFrame(frame);
    worker?.terminate();
  });
</script>

<div class="wrap" class:view>
  <div class="stage">
    <canvas
      bind:this={cityCanvas}
      width={120 * SCALE}
      height={100 * SCALE}
      class="city"
    ></canvas>

    {#if !view && params.layer && params.layer !== 'none'}
      <canvas bind:this={layerCanvas} width={240} height={200} class="overlay"></canvas>
    {/if}

    {#if error}
      <p class="err">Couldn't start the engine: {error}</p>
    {/if}
  </div>

  {#if !view}
    <div class="side">
      <div class="phases">
        <h4>the sixteen phases</h4>
        <div class="phase-row">
          {#each PHASES as p (p.n)}
            <i
              class:lit={litPhases.has(p.n)}
              class:key={p.n === 12 || p.n === 13 || p.n === 14}
              title="{p.n}. {p.name} — writes {p.writes}"
            ></i>
          {/each}
        </div>
        <p class="phase-now">
          {#if cyclesPerSecond > 0}
            <b>{cyclesPerSecond} complete cycles a second.</b>
            Every box lights because the whole cycle runs many times between
            one frame and the next — far faster than you can read it.
          {:else}
            <b>Paused.</b> Sixteen phases, always in this order.
          {/if}
        </p>
        <p class="phase-hint">
          Left to right: tick over, eight map scans, census, decay, power, then
          the three that matter here — <b>land value</b>, <b>crime</b>,
          <b>density</b> — and fire. Land value is written two phases before the
          city centre it depends on is moved.
        </p>
      </div>

      <div class="divergence">
        <h4>
          same rules, same city, different seed
          {#if divergenceState === 'running'}<span class="tag">running…</span>
          {:else if divergenceState === 'failed'}<span class="tag bad">failed</span>{/if}
        </h4>
        <canvas bind:this={divCanvas} width={260} height={110}></canvas>
      </div>

      <div class="layers">
        <h4>every layer the simulation keeps</h4>
        {#each BLOCK_MAPS as meta (meta.key)}
          <div class="layer" class:scratch={meta.scratch}>
            <canvas
              bind:this={panelCanvases[meta.key]}
              width={104}
              height={88}
            ></canvas>
            <div class="layer-meta">
              <b>{meta.label}</b>
              <span>phase {meta.phase} · {meta.min}–{meta.max}</span>
              <p>{meta.note}</p>
            </div>
          </div>
        {/each}
      </div>

      {#if tally}
        <p class="tally">
          Starting city: {tally.zones} zones, {tally.services} stations,
          {tally.plants} power plants, {tally.roads} road and {tally.wires} wire tiles.
          Identical on every run.
        </p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .wrap { position: absolute; inset: 0; display: grid; grid-template-columns: 1fr 300px;
          gap: 0.75rem; overflow: hidden; background: #f4f4f2; }
  .wrap.view { grid-template-columns: 1fr; }
  .stage { position: relative; overflow: hidden; min-width: 0; min-height: 0; }
  .city { image-rendering: pixelated; width: 100%; height: 100%;
          object-fit: contain; display: block; }
  .overlay { position: absolute; right: 0.4rem; top: 0.4rem; width: 120px; height: 100px;
             border: 1px solid #000; background: #fff; opacity: 0.92; }
  .err { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
         font-size: 0.75rem; color: #a00; background: rgba(255,255,255,0.9);
         padding: 0.4rem 0.7rem; max-width: 80%; text-align: center; }

  .side { overflow-y: auto; padding: 0.5rem 0.6rem 1rem 0; font-size: 0.7rem; }
  h4 { font-size: 0.62rem; text-transform: lowercase; letter-spacing: 0.06em;
       color: #999; font-weight: 400; margin: 0 0 0.4rem;
       border-bottom: 1px solid #e4e4e0; padding-bottom: 0.25rem; }
  .tag { color: #a00; font-weight: 700; }
  .tag.bad { color: #a00; }

  .phase-hint { margin: -0.55rem 0 1rem; font-size: 0.58rem; color: #999; line-height: 1.45; }
  .phase-hint b { color: #666; font-weight: 700; }
  .phase-row { display: flex; gap: 2px; margin-bottom: 0.3rem; }
  .phase-row i { flex: 1; height: 11px; background: #e6e6e2; display: block; }
  .phase-row i.key { background: #cfcfe8; }
  .phase-row i.lit { background: #000; }
  /* The caption is one line for "power" and three for "pollution, terrain,
     land value", so without a reserved height the whole panel below it jumped
     on every phase - sixteen times a second at speed 3, which made the layer
     list unreadable. Fixed to the tallest caption. */
  .phase-now {
    margin: 0 0 1rem; font-size: 0.62rem; color: #666; line-height: 1.45;
    min-height: calc(0.62rem * 1.45 * 3);
  }
  .phase-now b { color: #000; }

  .divergence { margin-bottom: 1rem; }
  .divergence canvas { width: 100%; height: 110px; background: #fff; border: 1px solid #e4e4e0; }

  .layer { display: flex; gap: 0.5rem; padding: 0.4rem 0; border-bottom: 1px solid #f0f0ed; }
  .layer.scratch { opacity: 0.5; }
  .layer canvas { width: 52px; height: 44px; flex: none; border: 1px solid #ddd; background: #fff; }
  .layer-meta { min-width: 0; }
  .layer-meta b { font-size: 0.66rem; display: block; }
  .layer-meta span { font-size: 0.58rem; color: #999; font-variant-numeric: tabular-nums; }
  .layer-meta p { margin: 0.15rem 0 0; font-size: 0.58rem; line-height: 1.4; color: #777; }

  .tally { margin: 0.8rem 0 0; font-size: 0.58rem; color: #999; line-height: 1.5; }

  @media (max-width: 900px) {
    .wrap { grid-template-columns: 1fr; }
  }
</style>
