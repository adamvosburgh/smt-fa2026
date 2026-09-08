<script>
  import Prose from '$lib/components/Prose.svelte';
  let { data } = $props();
</script>

{#if !data.doc}
  <p class="publishes">
    {#if data.publishes}
      This page publishes on {data.publishes.weekday} {data.publishes.date}.
    {:else}
      This page is not published yet.
    {/if}
  </p>
{:else}
  <Prose html={data.doc.html} />

  {#if data.doc.author}
    <p class="byline">Module by {data.doc.author}{#if data.doc.date}, {data.doc.date}{/if}.</p>
  {/if}
{/if}

<style>
  .byline { font-size: 0.75rem; color: var(--fg-dim); margin-top: 3rem; border-top: 1px solid var(--rule); padding-top: 1rem; }
  .publishes { font-size: 0.9rem; }
</style>
