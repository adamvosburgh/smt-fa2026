<script>
  // The chrome every sandbox lives inside. It owns params, draws the control
  // panels from the schema, and enforces the three contracts the rest of the
  // pipeline depends on:
  //
  //   window.__metrics     - what the headless run reads back
  //   data-cover-ready     - what the Playwright cover screenshot waits on
  //   window.__hidePanels  - how the cover script gets the panels off the map
  //
  // A sandbox component never sets these itself. It reports metrics up and says
  // when it has settled; the frame publishes them. That way all seven behave the
  // same and the cover pipeline has exactly one thing to wait for.
  //
  // TWO LAYOUTS, AND THE PROP IS NOT `mode`.
  //
  //   layout="contained"  a map at 4:3 with a docked column beside it. Used
  //                       wherever the sandbox is a guest on someone else's
  //                       page - a tutorial mount, a gallery entry - and it has
  //                       to stay contained there or it breaks the page it is
  //                       sitting in. Nothing floats there; the column shows the
  //                       two headed groups one after the other.
  //   layout="full"       the map fills the stage and four panels float over it:
  //                       description, assumptions, representation, metrics.
  //                       The sandbox route only.
  //
  // It is gated on its own prop rather than on `mode === 'edit'` because those
  // are different questions. A tutorial can mount an editable sandbox mid-prose
  // and must not have it eat the window.
  //
  // TWO PANELS, NOT ONE. Anything that changes the underlying data or the
  // model's numbers is an assumption; anything that changes how that data is
  // drawn is representation. Which one a control belongs to is a fact about the
  // control, so it is declared in the schema as `x-panel` and read here.
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
  // A metrics object carrying `rows` is a table (bathtub reports one row per
  // waterline); anything else is the flat list every other sandbox reports.
  const metricRows = $derived(Array.isArray(metrics?.rows) ? metrics.rows : null);
  const metricColumns = $derived(metricRows ? (metrics.columns ?? []) : []);
  const flatMetrics = $derived(
    Object.entries(metrics ?? {}).filter(([k]) => k !== 'rows' && k !== 'columns')
  );

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

  // ---------------------------------------------------------------------- //
  // The floating panels.                                                    //
  // ---------------------------------------------------------------------- //
  //
  // Four elements over the map. Each is draggable by its header and collapses
  // to that header; where it was left and whether it was closed are kept per
  // sandbox in localStorage, and `reset panels` throws that away.
  //
  // Default placement is computed rather than written in CSS because one of the
  // four depends on another: representation sits 12px under assumptions, so
  // collapsing assumptions has to move it up. A ResizeObserver on all four is
  // what makes that fall out for free.
  const PANELS = ['description', 'assumptions', 'representation', 'metrics'];
  const MARGIN = 16;
  const GAP = 12;

  let stage = $state(null);
  let panelEls = $state({});
  let stageSize = $state({ w: 0, h: 0 });
  let panelSize = $state({});
  let pos = $state({});          // only panels the reader has dragged
  let collapsed = $state({});
  let floating = $state(false);  // false under 900px, where the four just stack
  let hidden = $state(false);    // the cover script, for one screenshot

  const storageKey = $derived(`smt.panels.${meta?.slug ?? 'unknown'}`);

  function readStored() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      pos = saved?.pos ?? {};
      collapsed = saved?.collapsed ?? {};
    } catch {
      // Private windows, blocked site data: the panels just start where they start.
    }
  }
  function writeStored() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ pos, collapsed }));
    } catch {
      // As above. Losing the layout is not worth an error.
    }
  }
  function resetPanels() {
    pos = {};
    collapsed = {};
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // As above.
    }
  }

  // Where a panel sits if it has not been dragged.
  function defaultPos(name) {
    const { w, h } = stageSize;
    const size = panelSize[name] ?? { w: 320, h: 200 };
    if (name === 'description') return { x: MARGIN, y: MARGIN };
    if (name === 'assumptions') return { x: w - MARGIN - size.w, y: MARGIN };
    if (name === 'representation') {
      const above = pos.assumptions ?? defaultPos('assumptions');
      const h2 = panelSize.assumptions?.h ?? 0;
      return { x: w - MARGIN - size.w, y: above.y + h2 + GAP };
    }
    // Metrics: a strip under the map, aligned with it. The build doc said
    // "centered, max-width 70% of the viewport", which was written before the
    // map was inset - at 70% of the stage it ran under the right-hand panels.
    // The map's own width is what "under the map" means now.
    const left = (panelSize.description?.w ?? 0) + MARGIN * 2;
    return { x: left, y: h - MARGIN - size.h };
  }

  function clamp(name, p) {
    const { w, h } = stageSize;
    const size = panelSize[name] ?? { w: 320, h: 200 };
    return {
      x: Math.min(Math.max(0, p.x), Math.max(0, w - size.w)),
      y: Math.min(Math.max(0, p.y), Math.max(0, h - size.h))
    };
  }

  const placement = $derived.by(() => {
    if (!floating || !stageSize.w) return {};
    const out = {};
    for (const name of PANELS) out[name] = clamp(name, pos[name] ?? defaultPos(name));
    return out;
  });

  // THE MAP IS INSET, so the panels sit on the page beside it rather than over
  // it. The inset is the panels' DEFAULT footprint, not where they have been
  // dragged to: a map that resized every time a panel moved would be unusable,
  // and the point of the inset is a stable rectangle to read.
  //
  // Collapsing a panel does shrink its footprint, so folding the description
  // away gives the map that column back. That is the one case where the map
  // moving is what the reader asked for.
  const inset = $derived.by(() => {
    if (!floating || !stageSize.w) return null;
    const w = (name) => panelSize[name]?.w ?? 0;
    const h = (name) => panelSize[name]?.h ?? 0;
    return {
      left: w('description') + MARGIN * 2,
      right: Math.max(w('assumptions'), w('representation')) + MARGIN * 2,
      top: MARGIN,
      bottom: h('metrics') + MARGIN * 2
    };
  });

  // The description panel is capped at the map's own height rather than the
  // stage's, so a long card scrolls beside the map instead of running down past
  // it and under the metrics strip.
  const mapHeight = $derived(
    inset ? Math.max(200, stageSize.h - inset.top - inset.bottom) : 0
  );
  const mapWidth = $derived(
    inset ? Math.max(320, stageSize.w - inset.left - inset.right) : 0
  );

  // Pointer drag, not HTML5 drag: the map underneath is itself a drag surface,
  // and a dragstart on top of it is one more thing for the map to fight with.
  let dragging = null;
  function startDrag(name, e) {
    if (!floating || e.button !== 0) return;
    const rect = stage.getBoundingClientRect();
    const at = placement[name] ?? { x: 0, y: 0 };
    // Where in the panel the pointer grabbed it, so the panel does not jump.
    dragging = { name, dx: e.clientX - rect.left - at.x, dy: e.clientY - rect.top - at.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function moveDrag(e) {
    if (!dragging) return;
    const rect = stage.getBoundingClientRect();
    pos = {
      ...pos,
      [dragging.name]: clamp(dragging.name, {
        x: e.clientX - rect.left - dragging.dx,
        y: e.clientY - rect.top - dragging.dy
      })
    };
  }
  function endDrag() {
    if (!dragging) return;
    dragging = null;
    writeStored();
  }

  function toggleCollapse(name) {
    collapsed = { ...collapsed, [name]: !collapsed[name] };
    writeStored();
  }

  $effect(() => {
    if (!full || !stage || typeof window === 'undefined') return;
    // Untracked: every panel element is bound before effects run, and reading
    // them tracked would restart the observer once per binding.
    return untrack(() => setUpPanels());
  });

  function setUpPanels() {
    readStored();

    const wide = window.matchMedia('(min-width: 901px)');
    const applyWide = () => (floating = wide.matches);
    applyWide();
    wide.addEventListener('change', applyWide);

    const ro = new ResizeObserver(() => {
      const r = stage.getBoundingClientRect();
      stageSize = { w: r.width, h: r.height };
      const next = {};
      for (const name of PANELS) {
        const el = panelEls[name];
        if (el) next[name] = { w: el.offsetWidth, h: el.offsetHeight };
      }
      panelSize = next;
    });
    ro.observe(stage);
    for (const name of PANELS) if (panelEls[name]) ro.observe(panelEls[name]);

    // The cover screenshot is of the map, and the panels are on top of it.
    // One call, right before the shot; nothing restores it, because the page
    // is thrown away straight afterwards.
    window.__hidePanels = () => {
      hidden = true;
    };

    return () => {
      ro.disconnect();
      wide.removeEventListener('change', applyWide);
      if (window.__hidePanels) delete window.__hidePanels;
    };
  }
</script>

{#snippet titleBlock()}
  {#if meta.number != null}
    <span class="num">{String(meta.number).padStart(2, '0')}</span>
  {/if}
  <h2>{meta.title}</h2>
  <p class="sub">{meta.subtitle}</p>
{/snippet}

{#snippet metricList()}
  {#if metricRows}
    <div class="metric-table-wrap">
      <table class="metric-table">
        <thead>
          <tr>
            <th></th>
            {#each metricColumns as c (c)}<th>{c}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each metricRows as row (row.label)}
            <tr>
              <th scope="row">{row.label}</th>
              {#each row.values as v, i (i)}<td>{v}</td>{/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    {#each flatMetrics as [k, v] (k)}
      <div class="metric"><span>{k}</span><b>{v}</b></div>
    {:else}
      <p class="waiting">…</p>
    {/each}
  {/if}
{/snippet}

{#snippet panelHeader(name, extra = false)}
  <div
    class="float-head"
    onpointerdown={(e) => startDrag(name, e)}
    onpointermove={moveDrag}
    onpointerup={endDrag}
    onpointercancel={endDrag}
  >
    <span class="float-name">{name}</span>
    {#if extra}
      <button class="reset" type="button" onclick={resetPanels}>reset panels</button>
    {/if}
    <button
      class="chevron"
      type="button"
      aria-expanded={!collapsed[name]}
      aria-label={collapsed[name] ? `expand ${name}` : `collapse ${name}`}
      onpointerdown={(e) => e.stopPropagation()}
      onclick={() => toggleCollapse(name)}
    >
      {collapsed[name] ? '▸' : '▾'}
    </button>
  </div>
{/snippet}

<div
  class="sandbox"
  class:full
  class:view={mode === 'view'}
  class:bare={!showChrome}
  data-sandbox={meta.slug}
  data-mode={mode}
  data-panels={hidden ? 'hidden' : 'shown'}
  data-cover-ready={ready ? 'true' : 'false'}
  data-timeline-paused={transport.paused ? 'true' : 'false'}
>
  <div class="stage" bind:this={stage}>
    <div
      class="viewport"
      style={inset
        ? `left:${inset.left}px; right:${inset.right}px; top:${inset.top}px; bottom:${inset.bottom}px`
        : ''}
    >
      <Component
        {params}
        {assets}
        {mode}
        dataBase={dataBase(meta.slug)}
        {onmetrics}
        {onready}
        {ontransport}
      />
      <!-- Every sandbox is still being built, and says so. Inside the viewport
           so it sits on the map's own top edge whatever the map is inset by,
           and hidden along with the panels for a cover screenshot. -->
      <p class="under-construction">under construction</p>
    </div>

    {#if full}
      <!-- The four floating panels. The layer itself takes no pointer events,
           so the map stays draggable between them. -->
      <div class="floats" class:floating>
        <section
          class="float description"
          class:collapsed={collapsed.description}
          bind:this={panelEls.description}
          style={floating && placement.description
            ? `left:${placement.description.x}px; top:${placement.description.y}px;
               max-height:${mapHeight}px`
            : ''}
        >
          {@render panelHeader('description', true)}
          <div class="float-body">
            <header>{@render titleBlock()}</header>
            <SandboxCard {meta} variant="inline" />
          </div>
        </section>

        <section
          class="float assumptions"
          class:collapsed={collapsed.assumptions}
          bind:this={panelEls.assumptions}
          style={floating && placement.assumptions
            ? `left:${placement.assumptions.x}px; top:${placement.assumptions.y}px`
            : ''}
        >
          {@render panelHeader('assumptions')}
          <div class="float-body">
            {#if mode === 'edit' && schema}
              <ParamPanel {schema} bind:params {transport} {assets} panel="assumptions" />
            {/if}
            {#if mode === 'edit' && submittable}
              <button class="submit" type="button" onclick={() => (submitting = true)}
                >Submit this state</button
              >
            {/if}
          </div>
        </section>

        <section
          class="float representation"
          class:collapsed={collapsed.representation}
          bind:this={panelEls.representation}
          style={floating && placement.representation
            ? `left:${placement.representation.x}px; top:${placement.representation.y}px`
            : ''}
        >
          {@render panelHeader('representation')}
          <div class="float-body">
            {#if mode === 'edit' && (schema || transport.external)}
              <ParamPanel
                schema={schema ?? null}
                bind:params
                {transport}
                {assets}
                panel="representation"
              />
            {/if}
          </div>
        </section>

        <section
          class="float metrics"
          class:collapsed={collapsed.metrics}
          class:table={metricRows}
          bind:this={panelEls.metrics}
          style={floating && placement.metrics
            ? `left:${placement.metrics.x}px; top:${placement.metrics.y}px;
               width:${mapWidth}px`
            : ''}
        >
          {@render panelHeader('metrics')}
          <div class="float-body strip">{@render metricList()}</div>
        </section>
      </div>
    {/if}
  </div>

  {#if showChrome && !full}
    <aside class="panel">
      <header>
        {@render titleBlock()}
        <SandboxCard {meta} />
      </header>

      {#if mode === 'edit' && (schema || transport.external)}
        <h3 class="section">assumptions</h3>
        <ParamPanel schema={schema ?? null} bind:params {transport} {assets} panel="assumptions" />
        <h3 class="section spaced">representation</h3>
        <ParamPanel
          schema={schema ?? null}
          bind:params
          {transport}
          {assets}
          panel="representation"
        />
      {/if}

      <div class="metrics">
        <h3 class="section spaced">what that gives you</h3>
        {@render metricList()}
      </div>

      {#if mode === 'edit' && submittable}
        <button class="submit" type="button" onclick={() => (submitting = true)}
          >Submit this state</button
        >
      {/if}
    </aside>
  {/if}
</div>

{#if submitting}
  <SubmitDialog {meta} {params} {metrics} onclose={() => (submitting = false)} />
{/if}

<style>
  /* The sandbox chrome stays neutral - white ground, black text - on purpose.
     The site's blue and green would fight the map colors, which are the thing
     being read. Nothing in here uses the site's tokens. */
  .sandbox {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 1.5rem;
    align-items: start;
    border: 1px solid #000;
    background: #fff;
    color: #000;
  }
  .sandbox.bare { grid-template-columns: 1fr; border: 0; gap: 0; }
  .viewport { position: relative; aspect-ratio: 4 / 3; background: #f4f4f2; overflow: hidden; }
  .sandbox.view .viewport { aspect-ratio: 16 / 10; }
  .panel {
    padding: 1.25rem 1.25rem 1.25rem 0;
    font-size: 0.8rem;
  }
  .sandbox:not(.full) .panel { max-height: 78vh; overflow-y: auto; }
  header { margin-bottom: 1.75rem; }
  .num { font-size: 0.7rem; color: #999; }
  h2 { font-size: 1rem; margin: 0.1rem 0 0.3rem; }
  .sub { font-size: 0.75rem; color: #666; line-height: 1.55; margin: 0; }
  .section {
    font-size: 0.7rem; text-transform: lowercase; letter-spacing: 0.06em;
    color: #000; font-weight: 700; margin: 0 0 0.85rem;
  }
  .section.spaced { margin-top: 1.75rem; }
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

  /* One row per waterline. Used by the flood map, where a single figure would
     have to be one of five and the point is that there are five. */
  .metric-table-wrap { overflow-x: auto; max-width: 100%; }
  .metric-table { border-collapse: collapse; font-size: 0.68rem; width: 100%; }
  .metric-table th, .metric-table td {
    padding: 0.25rem 0.55rem; text-align: right; white-space: nowrap;
    border: 0; border-bottom: 1px solid #e6e6e4;
    background: none; color: #000;
  }
  .metric-table thead th {
    font-weight: 400; color: #888; font-size: 0.6rem; line-height: 1.3;
    vertical-align: bottom; white-space: normal; min-width: 5.5rem;
  }
  .metric-table tbody th { text-align: left; font-weight: 700; }
  .metric-table td { font-variant-numeric: tabular-nums; }
  .metric-table tbody tr:last-child th, .metric-table tbody tr:last-child td { border-bottom: 0; }

  /* ---------------------------------------------------------------- */
  /* The full-width layout: one map, four panels floating over it.     */
  /* ---------------------------------------------------------------- */

  /* NO GROUND. The contained layout is a white card because it is a guest on a
     prose page and needs an edge; the full layout is a map with panels floating
     beside it, and the page's own color is what they float on. A white ground
     here put a sheet of paper behind the whole thing. */
  .sandbox.full {
    display: block;
    border: 0;
    background: none;
  }
  .sandbox.full .stage {
    position: relative;
    /* --chrome-top is the fixed header plus the fixed nav, set in app.css so
       the two cannot drift apart. */
    height: calc(100vh - var(--chrome-top) - 3rem);
    min-height: 720px;
  }
  /* Inset by the panels' footprint - see the `inset` derivation. The border is
     on the map rather than on the stage, because the stage is now mostly page. */
  .sandbox.full .viewport {
    aspect-ratio: auto;
    position: absolute;
    inset: 0;
    border: 1px solid #000;
    transition: left 0.15s ease, right 0.15s ease, top 0.15s ease, bottom 0.15s ease;
  }

  .floats {
    position: absolute;
    inset: 0;
    /* The space BETWEEN panels belongs to the map. */
    pointer-events: none;
    z-index: 10;
  }
  .float {
    pointer-events: auto;
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid #000;
    color: #000;
    font-size: 0.8rem;
  }
  .floats.floating .float {
    position: absolute;
    display: flex;
    flex-direction: column;
    max-height: calc(100% - 2rem);
  }
  .floats.floating .description { width: 320px; }
  .floats.floating .assumptions,
  .floats.floating .representation { width: 300px; }
  /* The two right-hand panels are capped so both fit in the column. Without
     this, a schema with a dozen assumptions makes that panel as tall as the
     stage, representation's default position (12px under it) gets clamped back
     up, and the two land on top of each other - which is the one arrangement
     the split is meant to prevent. */
  .floats.floating .assumptions { max-height: 52%; }
  .floats.floating .representation { max-height: 40%; }
  /* Width comes from the map, inline - see defaultPos('metrics'). */
  .floats.floating .float-body { overflow-y: auto; min-height: 0; }
  .floats.floating .description .float-body { padding: 0.9rem 1rem 1.1rem; }
  .floats.floating .assumptions .float-body,
  .floats.floating .representation .float-body { padding: 0.8rem 0.9rem 1rem; }
  .float.collapsed .float-body { display: none; }

  .float-head {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 6px 6px 6px 0.6rem;
    border-bottom: 1px solid #000;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .float.collapsed .float-head { border-bottom: 0; }
  .float-head:active { cursor: grabbing; }
  .float-name {
    font-size: 0.65rem; text-transform: lowercase; letter-spacing: 0.06em;
    font-weight: 700; flex: 1;
  }
  .chevron, .reset {
    font: inherit; background: none; border: 0; cursor: pointer; color: #666;
    padding: 0 0.25rem; line-height: 1;
  }
  .reset { font-size: 0.58rem; }
  .chevron:hover, .reset:hover { color: #000; }

  /* The metrics strip is one wrapping row rather than a scroller. */
  .float.metrics .float-body.strip {
    display: flex; flex-wrap: wrap; padding: 0;
  }
  .float.metrics.table .float-body.strip { display: block; padding: 0.35rem 0.5rem; }
  .float.metrics .metric {
    flex: 1 1 7rem; min-width: 7rem;
    display: flex; flex-direction: column; justify-content: flex-end;
    gap: 0.15rem; padding: 0.45rem 0.7rem;
    border-right: 1px solid #e6e6e4;
    font-size: 0.7rem;
  }
  .float.metrics .metric:last-child { border-right: 0; }
  .float.metrics .metric span { font-size: 0.6rem; line-height: 1.35; color: #888; }
  .float.metrics .metric b { font-size: 0.78rem; }
  .float.metrics .waiting { padding: 0.6rem 0.7rem; }

  .float .submit { margin-top: 1.25rem; }

  /* One call from the cover script hides all four for the screenshot. */
  .sandbox[data-panels='hidden'] .floats,
  .sandbox[data-panels='hidden'] .under-construction { display: none; }
  /* Hiding the panels collapses the inset and the map takes the whole stage,
     which is what a cover wants. No transition: the screenshot must not catch
     it mid-resize. */
  .sandbox[data-panels='hidden'] .viewport { transition: none; }

  /* The under-construction note. Top center of the map, over everything the
     sandbox itself draws and under the panels, which the reader is using. */
  .under-construction {
    position: absolute;
    left: 50%;
    top: 0;
    transform: translateX(-50%);
    /* Over the sandbox's own legends (z-index 5) and under the panels. */
    z-index: 6;
    margin: 0;
    padding: 0.25rem 0.7rem;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid #000;
    border-top: 0;
    font-size: 0.62rem;
    text-transform: lowercase;
    letter-spacing: 0.08em;
    pointer-events: none;
    white-space: nowrap;
  }


  /* Under 900px nothing floats: the four blocks stack under the map, full
     width, in the order description, representation, assumptions, metrics. */
  @media (max-width: 900px) {
    .sandbox:not(.full) { grid-template-columns: 1fr; }
    .sandbox:not(.full) .panel { padding: 0 1.25rem 1.25rem; max-height: none; }

    .sandbox.full .stage { height: auto; min-height: 0; }
    .sandbox.full .viewport { position: relative; inset: auto; aspect-ratio: 4 / 3; }
    .floats {
      position: static;
      pointer-events: auto;
      display: flex;
      flex-direction: column;
    }
    .float { border: 0; border-top: 1px solid #000; background: #fff; }
    .sandbox.full { background: #fff; border: 1px solid #000; }
    .float-head { cursor: default; }
    .float .float-body { padding: 0.9rem 1rem 1.1rem; }
    .description { order: 1; }
    .representation { order: 2; }
    .assumptions { order: 3; }
    .metrics { order: 4; }
  }
</style>
