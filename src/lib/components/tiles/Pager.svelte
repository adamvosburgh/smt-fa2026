<script>
  // The page-turning buttons under a multi-page PDF's cover. PAGER_H in
  // src/lib/board/tiles.js is the room for them.
  let { at, n, onturn } = $props();
</script>

<div class="pager">
  <button type="button" aria-label="Previous page" disabled={at === 0} onclick={() => onturn(at - 1)}>‹</button>
  <span>{at + 1} / {n}</span>
  <button type="button" aria-label="Next page" disabled={at === n - 1} onclick={() => onturn(at + 1)}>›</button>
</div>

<style>
  .pager { display: flex; align-items: center; gap: 0.6rem; margin: 0 0 0.6rem; font-size: 0.8rem; color: var(--fg-dim); }
  .pager button {
    font: inherit; font-size: 1.1rem; line-height: 1; width: 2rem; height: 2rem; padding: 0;
    background: none; color: var(--fg); border: 1px solid var(--rule); cursor: pointer;
  }
  .pager button:hover:not(:disabled) { background: var(--hi); color: var(--hi-fg); }
  .pager button:disabled { opacity: 0.35; cursor: default; }
</style>
