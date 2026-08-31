<script>
  let { data } = $props();
</script>

<div class="content-list">
  {#each data.items as item (item.slug)}
    <div class="content-list-item">
      <a href={item.url}>
        {#if item.sequence !== undefined}<span class="sequence">{item.sequence}</span>{/if}
        {item.title}
      </a>
    </div>
  {:else}
    <p class="content-article">Nothing here yet.</p>
  {/each}
</div>
