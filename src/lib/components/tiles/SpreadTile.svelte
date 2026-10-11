<script>
  // `board_tile: spread` (the draft proposal): every page of the PDF at once,
  // up to three across, each at its size on paper, like a pin-up. Where each
  // page goes comes from spreadLayout in src/lib/board/tiles.js, the same
  // function that sized the tile.
  import TileText from './TileText.svelte';
  import { SPREAD, spreadLayout } from '$lib/board/tiles.js';
  let { el, src } = $props();

  const pages = $derived(el.pages?.length ? el.pages : el.cover ? [el.cover] : []);
  const grid = $derived(spreadLayout({ pages, sizes: el.page_sizes, ratio: el.ratio }));
</script>

<div class="pages" style="height: {grid.h}px; margin-bottom: {SPREAD.gap}px">
  {#each pages as page, i (page)}
    {@const c = grid.cells[i]}
    <div class="page" style="left: {c.x}px; top: {c.y}px; width: {c.w}px; height: {c.h}px">
      {#if src(page)}
        <img src={src(page)} alt="Page {i + 1}" draggable="false" onerror={(e) => (e.currentTarget.style.visibility = 'hidden')} />
      {/if}
    </div>
  {/each}
</div>
<TileText {el} />

<style>
  .pages { position: relative; }
  .page { position: absolute; background-color: var(--code-bg); overflow: hidden; }
  img { display: block; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
</style>
