<script>
  let { data } = $props();
</script>

<div class="content-list">
  {#each data.items as item (item.slug)}
    <div class="content-list-item">
      <a href={item.url}>
        {#if item.sequence !== undefined}<span class="sequence">{item.sequence}</span>{/if}
        {item.title}
      </a>{#if item.pending}<span class="pending">publishes {item.pending}</span>{/if}
    </div>
  {:else}
    <p class="content-article empty">Tutorials will be published one week before they are due.</p>
  {/each}
</div>

{#if data.devnotes.length}
  <p class="devnotes-note">
    Notes from building each sandbox (the data, the roadblocks, what came out) are on the
    <a href="/sandboxes/">sandbox pages</a>, not here.
  </p>
{/if}

<style>
  .pending { font-size: 0.7rem; color: var(--fg-dim); margin-left: 0.6rem; }
  .empty { max-width: 60ch; }
  .devnotes-note { font-size: 0.75rem; color: var(--fg-dim); margin-top: 2.5rem; max-width: 60ch; }
</style>
