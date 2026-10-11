<script>
  // The default tile: the cover, or for a multi-page PDF every page, one at a
  // time. Which page is showing is each viewer's own, never an op.
  import TileText from './TileText.svelte';
  import Pager from './Pager.svelte';
  let { el, src } = $props();

  let at = $state(0);
  const n = $derived(el.pages?.length ?? 0);
  const shown = $derived(n ? el.pages[Math.min(at, n - 1)] : el.cover);
</script>

<div class="project-card-image" class:whole={el.ratio} style={el.ratio ? `aspect-ratio: 1 / ${el.ratio}` : ''}>
  {#if shown && src(shown)}
    <img src={src(shown)} alt="" draggable="false" onerror={(e) => (e.currentTarget.style.visibility = 'hidden')} />
  {/if}
</div>
{#if n > 1}<Pager at={Math.min(at, n - 1)} {n} onturn={(i) => (at = i)} />{/if}
<TileText {el} />

<style>
  .project-card-image { margin-bottom: 0.6rem; }
  img { display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
  .whole img { object-fit: contain; }
</style>
