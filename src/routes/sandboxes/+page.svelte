<script>
  import { marquee } from '$lib/marquee.js';
  let { data } = $props();
</script>

<div class="sandbox-grid">
  {#each data.sandboxes as s (s.slug)}
    <a class="sandbox-card" href="/sandboxes/{s.slug}/">
      <div class="cover">
        <img src="/covers/{s.slug}.png" alt="" loading="lazy" onerror={(e) => (e.currentTarget.style.visibility = 'hidden')} />
        <span class="num">{String(s.number).padStart(2, '0')}</span>
      </div>
      <div class="info">
        <h2><span class="marquee" use:marquee={s.title}><span>{s.title}</span></span></h2>
        <p class="sub">{s.subtitle}</p>
      </div>
    </a>
  {/each}
</div>

<style>
  .sandbox-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.75rem; }
  @media (max-width: 600px) { .sandbox-grid { grid-template-columns: 1fr; } }
  .sandbox-card { text-decoration: none; color: inherit; display: block; }
  .cover { position: relative; aspect-ratio: 4/3; background: var(--code-bg); border: 1px solid var(--rule); overflow: hidden; transition: opacity 0.15s ease; }
  .cover img { width: 100%; height: 100%; object-fit: cover; }
  .num { position: absolute; top: 0.4rem; left: 0.5rem; font-size: 0.65rem; color: var(--fg-dim); }
  .info h2 { font-size: 0.9rem; margin: 0.6rem 0 0.25rem; }
  .info h2 > span { display: inline-block; }
  .sub { font-size: 0.72rem; color: var(--fg-dim); line-height: 1.55; margin: 0; }
  .sandbox-card:hover .cover { opacity: 0.85; border-color: var(--fg); }
  .sandbox-card:hover .info h2 > span { background: var(--hi); color: var(--hi-fg); }
</style>
