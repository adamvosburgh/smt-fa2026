<script>
  // The text under every tile's work: title, name, group, gallery text and the
  // link to Student Work. TEXT_H in src/lib/board/tiles.js is the room for it.
  let { el } = $props();
</script>

<h3 class="project-card-title">{el.title}</h3>
<p class="project-card-author">{el.student}</p>
{#if el.group}<p class="group">{el.group}</p>{/if}
{#if el.gallery_text}<p class="gallery-text">{el.gallery_text}</p>{/if}
{#if el.href}
  <a class="tile-link" href={el.href} target="_blank" rel="noopener" draggable="false">Open in Student Work</a>
{/if}

<style>
  .project-card-title { display: block; margin: 0 0 0.2rem; }
  .project-card-author { margin: 0 0 0.5rem; }
  .group { font-size: 0.8rem; line-height: 1.5; margin: -0.3rem 0 0.5rem; color: var(--fg-dim); }
  .gallery-text { font-size: 0.8rem; line-height: 1.5; margin: 0 0 0.5rem; }
  .tile-link { font-size: 0.8rem; color: var(--fg); }
  .tile-link:hover { background: var(--hi); color: var(--hi-fg); }
</style>
