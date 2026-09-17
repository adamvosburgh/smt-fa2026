<script>
  // A board's card on the index: the whole board zoomed out to its extents,
  // drawn from the sketch in summarize() (src/lib/board/model.js) rather than
  // from a captured image. Notes, text and tiles are boxes in the board's own
  // colors; the few images the sketch carries a source for are drawn in.
  //
  // `srcs` maps a sketch source to what an <image> can load: in the live site
  // board files sit behind the token, so the page fetches them into blob URLs.
  let { sketch, srcs = {} } = $props();

  // A margin around the extents, and at least 4:3 so a single long row of
  // tiles is not a sliver.
  const frame = $derived.by(() => {
    if (!sketch) return null;
    const pad = Math.max(sketch.w, sketch.h) * 0.06 + 40;
    let w = sketch.w + pad * 2;
    let h = sketch.h + pad * 2;
    if (w / h > 4 / 3) h = (w * 3) / 4;
    else w = (h * 4) / 3;
    return {
      x: sketch.x + sketch.w / 2 - w / 2,
      y: sketch.y + sketch.h / 2 - h / 2,
      w,
      h,
      stroke: w / 400
    };
  });
</script>

{#if frame}
  <svg viewBox="{frame.x} {frame.y} {frame.w} {frame.h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    {#each sketch.items as it, i (i)}
      {#if it.type === 'note'}
        <rect x={it.x} y={it.y} width={it.w} height={it.h} style="fill: var(--hi)" />
      {:else if it.type === 'text'}
        <rect x={it.x} y={it.y} width={it.w} height={Math.max(it.h, 24)} style="fill: var(--fg); opacity: 0.35" />
      {:else if it.type === 'tile'}
        <rect x={it.x} y={it.y} width={it.w} height={it.h} style="fill: none; stroke: var(--rule)" stroke-width={frame.stroke} />
        <rect x={it.x} y={it.y} width={it.w} height={it.w * 0.75} style="fill: var(--code-bg)" />
        {#if it.src && srcs[it.src]}
          <image href={srcs[it.src]} x={it.x} y={it.y} width={it.w} height={it.w * 0.75} preserveAspectRatio="xMidYMid slice" />
        {/if}
      {:else}
        <rect x={it.x} y={it.y} width={it.w} height={it.h} style="fill: var(--code-bg)" />
        {#if it.src && srcs[it.src]}
          <image href={srcs[it.src]} x={it.x} y={it.y} width={it.w} height={it.h} preserveAspectRatio="xMidYMid meet" />
        {/if}
      {/if}
    {/each}
  </svg>
{/if}

<style>
  svg { display: block; width: 100%; height: 100%; }
</style>
