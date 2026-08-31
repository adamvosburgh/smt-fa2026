<script>
  // Every sandbox carries its limits on the page, not in a footnote. The
  // "cannot see" line is the spine of the course - it is not optional chrome.
  let { meta, open = false } = $props();
  let expanded = $state(false);
  $effect(() => { expanded = open; });
</script>

<section class="model-card">
  <h3>What this cannot see</h3>
  <p class="cannot">{meta.cannotSee}</p>

  <button type="button" onclick={() => (expanded = !expanded)}>
    {expanded ? '−' : '+'} model card
  </button>

  {#if expanded}
    <dl>
      {#if meta.liveCapability}
        <dt>Live capability</dt>
        <dd>{meta.liveCapability}</dd>
      {/if}
      {#if meta.provenanceNote}
        <dt>Provenance</dt>
        <dd>{meta.provenanceNote}</dd>
      {/if}
      {#if meta.statusNote}
        <dt>Status</dt>
        <dd>{meta.statusNote}</dd>
      {/if}
      <dt>Data</dt>
      <dd><ul>{#each meta.data as d}<li>{d}</li>{/each}</ul></dd>
      {#if meta.license}
        <dt>License</dt>
        <dd>{meta.license}</dd>
      {/if}
    </dl>
  {/if}
</section>

<style>
  .model-card { border-top: 1px solid #000; padding-top: 1rem; margin-top: 1.5rem; font-size: 0.78rem; }
  h3 { font-size: 0.75rem; text-transform: lowercase; margin: 0 0 0.5rem; }
  .cannot { line-height: 1.65; margin: 0 0 0.75rem; }
  button { font: inherit; font-size: 0.7rem; background: none; border: 0; padding: 0; color: #666; cursor: pointer; text-decoration: underline; }
  dl { margin: 1rem 0 0; font-size: 0.72rem; }
  dt { font-weight: 700; margin-top: 0.75rem; }
  dd { margin: 0.2rem 0 0; color: #444; line-height: 1.6; }
  dd ul { margin: 0; padding-left: 1.1rem; }
</style>
