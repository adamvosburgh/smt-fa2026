<script>
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
        <h2><span>{s.title}</span></h2>
        <p class="sub">{s.subtitle}</p>
        <p class="status" data-status={s.status}>{s.status}</p>
      </div>
    </a>
  {/each}
</div>

<style>
  .sandbox-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.75rem; }
  .sandbox-card { text-decoration: none; color: inherit; display: block; }
  .cover { position: relative; aspect-ratio: 4/3; background: var(--code-bg); border: 1px solid var(--rule); overflow: hidden; transition: opacity 0.15s ease; }
  .cover img { width: 100%; height: 100%; object-fit: cover; }
  .num { position: absolute; top: 0.4rem; left: 0.5rem; font-size: 0.65rem; color: var(--fg-dim); }
  .info h2 { font-size: 0.9rem; margin: 0.6rem 0 0.25rem; }
  .info h2 span { display: inline-block; }
  .sub { font-size: 0.72rem; color: var(--fg-dim); line-height: 1.55; margin: 0; }
  .status { font-size: 0.62rem; color: var(--fg-dim); margin: 0.5rem 0 0; letter-spacing: 0.05em; }
  .status[data-status='reference'] { color: var(--fg); }
  .status[data-status='gated'] { color: var(--hi); }
  .sandbox-card:hover .cover { opacity: 0.85; border-color: var(--fg); }
  .sandbox-card:hover .info h2 span { background: var(--hi); color: var(--hi-fg); }
</style>
