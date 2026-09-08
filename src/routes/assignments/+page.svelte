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
    <p class="content-article empty">Assignments will be published one week before they are due.</p>
  {/each}
</div>

<style>
  .pending { font-size: 0.7rem; color: var(--fg-dim); margin-left: 0.6rem; }
  .empty { max-width: 60ch; }
</style>
