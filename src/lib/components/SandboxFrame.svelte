<script>
  // The chrome every sandbox lives inside. It owns params, draws the control
  // panel from the schema, and enforces the two contracts the rest of the
  // pipeline depends on:
  //
  //   window.__metrics     - what the headless run reads back
  //   data-cover-ready     - what the Playwright cover screenshot waits on
  //
  // A sandbox component never sets these itself. It reports metrics up and says
  // when it has settled; the frame publishes them. That way all seven behave the
  // same and the cover pipeline has exactly one thing to wait for.
  //
  // TWO LAYOUTS, AND THE PROP IS NOT `mode`.
  //
  //   layout="contained"  the original. A map at 4:3 with a panel beside it.
  //                       Used wherever the sandbox is a guest on someone
  //                       else's page - a tutorial mount, a gallery entry -
  //                       and it has to stay contained there or it breaks the
  //                       page it is sitting in.
  //   layout="full"       three columns filling the window: the card on the
  //                       left, the map in the middle at whatever shape the
  //                       window is, the controls on the right, the metrics in
  //                       a strip under the map. The sandbox route only.
  //
  // It is gated on its own prop rather than on `mode === 'edit'` because those
  // are different questions. A tutorial can mount an editable sandbox mid-prose
  // and must not have it eat the window.
  import { untrack } from 'svelte';
  import ParamPanel from './ParamPanel.svelte';
  import SandboxCard from './SandboxCard.svelte';
  import SubmitDialog from './SubmitDialog.svelte';
  import { dataBase } from '$lib/data.js';
  import { createTransport } from './transport.svelte.js';

  let {
    meta,
    schema,
    Component,
    mode = 'edit',
    layout = 'contained',
    params = $bindable({}),
    assets = {},
    showChrome = true,
    // A gallery entry that runs a sandbox on a student's own uploaded model has
    // nothing to submit - the file IS the submission - so the button comes off
    // there and stays everywhere else.
    submittable = true
  } = $props();

  let metrics = $state({});
  let ready = $state(false);
  let submitting = $state(false);

  const full = $derived(layout === 'full' && showChrome);

  function onmetrics(m) {
    metrics = m;
    if (typeof window !== 'undefined') window.__metrics = m;
  }
  function onready(v = true) {
    ready = v;
    if (typeof window !== 'undefined') window.__coverReady = v;
  }
  // Readiness is the component's to declare, not the frame's to guess. A
  // sandbox that recomputes asynchronously calls onready(false) when it starts
  // and onready(true) when it has settled. The frame does not race it.

  // The frame owns the clock, for the same reason it owns __metrics: the cover
  // pipeline needs one thing to wait on across all the sandboxes. The transport
  // reads and writes params through closures so it never holds a stale copy.
  const transport = createTransport(
    schema,
    (k) => params[k],
    (k, v) => {
      params[k] = v;
    }
  );
  // A sandbox whose clock is an engine (the city simulator) registers here and
  // gets the same transport row as a schema timeline.
  function ontransport(adapter) {
    transport.setExternal(adapter);
  }

  // UNTRACKED, deliberately: play() and reset() read transport's own $state,
  // and a tracked effect would re-run - and re-autoplay - every time the user
  // paused. This effect runs once per mount and owns the clock for its life.
  $effect(() => {
    if (mode !== 'edit' || typeof window === 'undefined') return;
    return untrack(() => {
      window.__transportReset = () => transport.reset();
      let raf;
      let last = performance.now();
      let lastPoll = 0;
      const frame = (t) => {
        transport.tick((t - last) / 1000, ready);
        last = t;
        if (t - lastPoll > 160) {
          transport.pollExternal();
          lastPoll = t;
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      // Autoplay is for the sandbox route only, never a gallery of thirty cards.
      if (full) {
        for (const t of transport.timelines) if (t.auto) transport.play(t.key);
      }
      return () => {
        cancelAnimationFrame(raf);
        if (window.__transportReset) delete window.__transportReset;
      };
    });
  });
</script>

{#snippet titleBlock()}
  {#if meta.number != null}
    <span class="num">{String(meta.number).padStart(2, '0')}</span>
  {/if}
  <h2>{meta.title}</h2>
  <p class="sub">{meta.subtitle}</p>
{/snippet}

{#snippet metricList()}
  {#each Object.entries(metrics) as [k, v] (k)}
    <div class="metric"><span>{k}</span><b>{v}</b></div>
  {:else}
    <p class="waiting">…</p>
  {/each}
{/snippet}

<div
  class="sandbox"
  class:full
  class:view={mode === 'view'}
  class:bare={!showChrome}
  data-sandbox={meta.slug}
  data-mode={mode}
  data-cover-ready={ready ? 'true' : 'false'}
  data-timeline-paused={transport.paused ? 'true' : 'false'}
>
  {#if full}
    <aside class="dock reading">
      <header>{@render titleBlock()}</header>
      <SandboxCard {meta} variant="inline" />
    </aside>
  {/if}

  <div class="stage">
    <div class="viewport">
      <Component
        {params}
        {assets}
        {mode}
        dataBase={dataBase(meta.slug)}
        {onmetrics}
        {onready}
        {ontransport}
      />
    </div>

    {#if full}
      <div class="metrics strip">{@render metricList()}</div>
    {/if}
  </div>

  {#if showChrome}
    <aside class="panel" class:dock={full} class:controls={full}>
      {#if !full}
        <header>
          {@render titleBlock()}
          <SandboxCard {meta} />
        </header>
      {/if}

      {#if mode === 'edit' && schema}
        <h3 class="section">Set it up</h3>
        <ParamPanel {schema} bind:params {transport} {assets} />
      {:else if mode === 'edit' && transport.external}
        <h3 class="section">Set it up</h3>
        <ParamPanel schema={null} bind:params {transport} />
      {/if}

      {#if !full}
        <div class="metrics">
          <h3 class="section">What that gives you</h3>
          {@render metricList()}
        </div>
      {/if}

      {#if mode === 'edit' && submittable}
        <button class="submit" type="button" onclick={() => (submitting = true)}>Submit this state</button>
      {/if}
    </aside>
  {/if}
</div>

{#if submitting}
  <SubmitDialog {meta} {params} {metrics} onclose={() => (submitting = false)} />
{/if}

<style>
  .sandbox {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 1.5rem;
    align-items: start;
    border: 1px solid #000;
  }
  .sandbox.bare { grid-template-columns: 1fr; border: 0; gap: 0; }
  .viewport { position: relative; aspect-ratio: 4 / 3; background: #f4f4f2; overflow: hidden; }
  .sandbox.view .viewport { aspect-ratio: 16 / 10; }
  .panel {
    padding: 1.25rem 1.25rem 1.25rem 0;
    font-size: 0.8rem;
  }
  /* Scoped to the contained layout: the full one gives every dock its own
     scroller, and two competing height caps is how a panel ends up with an
     inner scrollbar it does not need. */
  .sandbox:not(.full) .panel { max-height: 78vh; overflow-y: auto; }
  header { margin-bottom: 1.75rem; }
  .num { font-size: 0.7rem; color: #999; }
  h2 { font-size: 1rem; margin: 0.1rem 0 0.3rem; }
  .sub { font-size: 0.75rem; color: #666; line-height: 1.55; margin: 0; }
  .section {
    font-size: 0.7rem; text-transform: lowercase; letter-spacing: 0.06em;
    color: #000; font-weight: 700; margin: 0 0 0.85rem;
  }
  .metrics { margin-top: 1.75rem; border-top: 1px solid #000; padding-top: 0.9rem; }
  .metric { display: flex; justify-content: space-between; gap: 1rem; padding: 0.2rem 0; font-size: 0.75rem; }
  .metric span { color: #666; }
  .metric b { font-variant-numeric: tabular-nums; }
  .waiting { color: #ccc; }
  .submit {
    margin-top: 1.5rem; width: 100%; padding: 0.6rem; font: inherit; font-size: 0.75rem;
    background: #000; color: #fff; border: 0; cursor: pointer;
  }
  .sandbox:not(.full) .stage { display: contents; }

  /* ---------------------------------------------------------------- */
  /* The full-width layout.                                            */
  /* ---------------------------------------------------------------- */

  .sandbox.full {
    grid-template-columns: 320px minmax(0, 1fr) 320px;
    gap: 0;
    align-items: stretch;
    /* --chrome-top is the fixed header plus the fixed nav, set in app.css so
       the two cannot drift apart. */
    height: calc(100vh - var(--chrome-top) - 3rem);
    min-height: 720px;
  }
  .sandbox.full .dock {
    overflow-y: auto;
    padding: 1.1rem 1.15rem 1.5rem;
    font-size: 0.8rem;
    min-width: 0;
  }
  .sandbox.full .dock.reading { border-right: 1px solid #000; }
  .sandbox.full .dock.controls {
    border-left: 1px solid #000;
    display: flex; flex-direction: column;
  }
  .sandbox.full .dock header { margin-bottom: 0; }
  /* The submit button sits at the foot of the controls, not immediately under
     the last slider, so it does not read as part of the last control. */
  .sandbox.full .submit { margin-top: auto; padding-top: 0.6rem; }

  .sandbox.full .stage {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    min-width: 0; min-height: 0;
  }
  .sandbox.full .viewport { aspect-ratio: auto; height: 100%; min-height: 0; }

  /* Metrics as a strip along the foot of the map. Label above value, because
     these labels are sentences and the values are short.
     FLEX AND WRAPPING, NOT A SCROLLING ROW. Pencil reports eight metrics and a
     single row of them does not fit a 900px map; as a grid with overflow-x the
     last two were simply off the edge, behind a scrollbar macOS does not draw.
     A metric nobody can see is worse than a strip two rows deep. */
  .sandbox.full .metrics.strip {
    margin: 0; padding: 0;
    border-top: 1px solid #000;
    display: flex;
    flex-wrap: wrap;
  }
  .sandbox.full .metrics.strip .metric {
    flex: 1 1 7rem; min-width: 7rem;
    display: flex; flex-direction: column; justify-content: flex-end;
    gap: 0.15rem; padding: 0.45rem 0.7rem;
    border-right: 1px solid #e6e6e4;
    font-size: 0.7rem;
  }
  .sandbox.full .metrics.strip .metric:last-child { border-right: 0; }
  .sandbox.full .metrics.strip .metric span {
    font-size: 0.6rem; line-height: 1.35; color: #888;
  }
  .sandbox.full .metrics.strip .metric b { font-size: 0.78rem; }
  .sandbox.full .metrics.strip .waiting { padding: 0.6rem 0.7rem; }

  /* Under 1200px the reading dock cannot hold a column of prose as well as the
     map can hold a map, so it becomes a row of closed disclosures above. */
  @media (max-width: 1200px) {
    .sandbox.full {
      grid-template-columns: minmax(0, 1fr) 280px;
      height: auto;
      min-height: 0;
    }
    /* Capped hard, because "what this is" is open by default and at 40vh it
       took a third of the window off the map. Below this width the card is a
       thing you scroll, not a column you read beside the map. */
    .sandbox.full .dock.reading {
      grid-column: 1 / -1;
      border-right: 0; border-bottom: 1px solid #000;
      max-height: 20vh;
    }
    .sandbox.full .stage {
      height: calc(100vh - var(--chrome-top) - 20vh - 1.5rem);
      min-height: 420px;
    }
  }

  @media (max-width: 900px) {
    .sandbox:not(.full) { grid-template-columns: 1fr; }
    .sandbox:not(.full) .panel { padding: 0 1.25rem 1.25rem; max-height: none; }

    .sandbox.full { grid-template-columns: 1fr; }
    .sandbox.full .dock.controls { border-left: 0; border-top: 1px solid #000; }
    .sandbox.full .stage { height: auto; }
    .sandbox.full .viewport { aspect-ratio: 4 / 3; height: auto; }
    .sandbox.full .metrics.strip { grid-auto-flow: row; grid-auto-columns: auto; }
    .sandbox.full .metrics.strip .metric { border-right: 0; border-bottom: 1px solid #e6e6e4; }
  }
</style>
