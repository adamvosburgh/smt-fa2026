<script>
  // Placeholder body for a sandbox that has not been built yet. It still honours
  // the contract - it reports metrics and declares itself ready - so the index,
  // the cover pipeline and the gallery all work against an unbuilt sandbox.
  let { meta, onmetrics, onready } = $props();
  $effect(() => {
    onmetrics?.({ status: meta.status });
    onready?.(true);
  });
</script>

<div class="nb">
  <p class="tag">not built yet</p>
  <p class="blurb">{meta.blurb}</p>
  {#if meta.statusNote}<p class="note">{meta.statusNote}</p>{/if}
</div>

<style>
  .nb { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center;
        gap: 0.75rem; padding: 2.5rem; background: repeating-linear-gradient(45deg,#f4f4f2,#f4f4f2 9px,#efefec 9px,#efefec 18px); }
  .tag { font-size: 0.62rem; letter-spacing: 0.08em; color: #999; margin: 0; }
  .blurb { font-size: 0.85rem; line-height: 1.65; margin: 0; max-width: 46ch; }
  .note { font-size: 0.7rem; color: #777; line-height: 1.6; margin: 0; max-width: 52ch; }
</style>
