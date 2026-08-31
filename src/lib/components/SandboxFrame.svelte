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
  import ParamPanel from './ParamPanel.svelte';
  import SandboxCard from './SandboxCard.svelte';
  import SubmitDialog from './SubmitDialog.svelte';
  import { dataBase } from '$lib/data.js';

  let {
    meta,
    schema,
    Component,
    mode = 'edit',
    params = $bindable({}),
    assets = {},
    showChrome = true
  } = $props();

  let metrics = $state({});
  let ready = $state(false);
  let submitting = $state(false);

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
</script>

<div
  class="sandbox"
  class:view={mode === 'view'}
  class:bare={!showChrome}
  data-sandbox={meta.slug}
  data-mode={mode}
  data-cover-ready={ready ? 'true' : 'false'}
>
  <div class="viewport">
    <Component {params} {assets} {mode} dataBase={dataBase(meta.slug)} {onmetrics} {onready} />
  </div>

  {#if showChrome}
    <aside class="panel">
      <header>
        <span class="num">{String(meta.number).padStart(2, '0')}</span>
        <h2>{meta.title}</h2>
        <p class="sub">{meta.subtitle}</p>
        <SandboxCard {meta} />
      </header>

      {#if mode === 'edit' && schema}
        <h3 class="section">Set it up</h3>
        <ParamPanel {schema} bind:params />
      {/if}

      <div class="metrics">
        <h3 class="section">What that gives you</h3>
        {#each Object.entries(metrics) as [k, v] (k)}
          <div class="metric"><span>{k}</span><b>{v}</b></div>
        {:else}
          <p class="waiting">…</p>
        {/each}
      </div>

      {#if mode === 'edit'}
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
    max-height: 78vh;
    overflow-y: auto;
    font-size: 0.8rem;
  }
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
  @media (max-width: 900px) {
    .sandbox { grid-template-columns: 1fr; }
    .panel { padding: 0 1.25rem 1.25rem; max-height: none; }
  }
</style>
