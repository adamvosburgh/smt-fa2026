<script>
  import Prose from '$lib/components/Prose.svelte';
  let { data } = $props();
</script>

<Prose html={data.doc.html} />

{#if data.doc.author}
  <p class="byline">Module by {data.doc.author}{#if data.doc.date}, {data.doc.date}{/if}.</p>
{/if}

<style>
  .byline { font-size: 0.75rem; color: var(--fg-dim); margin-top: 3rem; border-top: 1px solid var(--rule); padding-top: 1rem; }
</style>
