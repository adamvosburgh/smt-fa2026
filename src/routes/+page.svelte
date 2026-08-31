<script>
  import Prose from '$lib/components/Prose.svelte';
  let { data } = $props();
</script>

{#if data.doc}
  <Prose html={data.doc.html} />
{:else}
  <article class="content-article">
    <p>The syllabus is not written yet. It goes in <code>content/syllabus/syllabus.md</code>.</p>
  </article>
{/if}
