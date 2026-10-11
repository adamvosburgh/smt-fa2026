<script>
  // `board_tile: interactive` (Assignment 4): the cover, which runs the work in
  // a frame when asked, and the student's prompt in a scrolling box under it.
  // Whether it is running is each viewer's own, like the page. A frame
  // swallows the pointer, so a tile runs only when asked and the board still
  // pans everywhere else.
  //
  // The frame is laid out at FRAME_W and scaled down to the tile, so the
  // student's page lays itself out for a laptop rather than a phone; zooming
  // the board in makes it readable.
  import TileText from './TileText.svelte';
  import Pager from './Pager.svelte';
  import { MODE } from '$lib/data.js';
  import { FRAME_CSP } from '$lib/frame-policy.js';
  let { el, src } = $props();

  const FRAME_W = 1280;
  let at = $state(0);
  let running = $state(false);
  const n = $derived(el.pages?.length ?? 0);
  const shown = $derived(n ? el.pages[Math.min(at, n - 1)] : el.cover);
  // A hosted site is not framed in the archive, the same as on the gallery page.
  const canRun = $derived(!!el.live && (MODE !== 'archive' || !/^https:/.test(el.live)));

  // The prompt is a public submission file, fetched once.
  let prompt = $state(undefined);
  $effect(() => {
    const url = el.prompt;
    if (!url) return;
    fetch(url)
      .then((res) => (res.ok ? res.text() : null))
      .then((text) => (prompt = text))
      .catch(() => (prompt = null));
  });
</script>

<div class="project-card-image" class:whole={el.ratio} class:runnable={canRun} style={el.ratio ? `aspect-ratio: 1 / ${el.ratio}` : ''}>
  {#if running}
    <iframe
      src={el.live}
      title={el.title}
      sandbox="allow-scripts"
      csp={MODE === 'archive' || /^https:/.test(el.live) ? undefined : FRAME_CSP}
      style="width: {FRAME_W}px; height: {Math.round(FRAME_W * (el.ratio ?? 0.75))}px; transform: scale({el.w / FRAME_W})"
    ></iframe>
    <button type="button" class="run" onclick={() => (running = false)}>Stop</button>
  {:else}
    {#if shown && src(shown)}
      <img src={src(shown)} alt="" draggable="false" onerror={(e) => (e.currentTarget.style.visibility = 'hidden')} />
    {/if}
    {#if canRun}
      <button type="button" class="run" onclick={() => (running = true)}>Run</button>
    {/if}
  {/if}
</div>
{#if n > 1}<Pager at={Math.min(at, n - 1)} {n} onturn={(i) => (at = i)} />{/if}
<TileText {el} />
{#if el.prompt && prompt !== null}
  <pre class="prompt" data-scroll>{prompt ?? 'Loading…'}</pre>
{/if}

<style>
  /* The prompt box sits at the foot of the tile, in the PROMPT_H that
     src/lib/board/tiles.js reserves for it. The tile itself is a column
     (.tile.interactive in Whiteboard.svelte). */
  .project-card-image { flex: none; margin-bottom: 0.6rem; }
  img { display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
  .whole img { object-fit: contain; }
  .runnable { position: relative; overflow: hidden; }
  iframe {
    position: absolute; left: 0; top: 0; border: 0; background: #fff; transform-origin: 0 0;
  }
  /* the frame is the student's own page; it keeps a white ground */
  .run {
    position: absolute; right: 0.5rem; bottom: 0.5rem;
    font: inherit; font-size: 0.8rem; padding: 0.25rem 0.75rem; cursor: pointer;
    background: var(--bg); color: var(--fg); border: 1px solid var(--rule);
  }
  .run:hover { background: var(--hi); color: var(--hi-fg); }
  .prompt {
    flex: none; box-sizing: border-box; height: 220px; margin: auto 0 0; padding: 0.5rem 0.6rem;
    overflow-y: auto; white-space: pre-wrap; overflow-wrap: anywhere;
    font-size: 0.7rem; line-height: 1.5; background: var(--code-bg); color: var(--fg);
    user-select: text; -webkit-user-select: text; cursor: text;
  }
</style>
