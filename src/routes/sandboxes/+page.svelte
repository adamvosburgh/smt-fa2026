<script>
  let { data } = $props();
</script>

<p class="intro content-article">
  Each of these runs in the browser and exposes a small set of parameters. Play with
  any of them - you do not need to be in the class. The tutorials are how to build
  one; these are the finished things.
</p>

<div class="sandbox-grid">
  {#each data.sandboxes as s (s.slug)}
    <a class="sandbox-card" href="/sandboxes/{s.slug}/">
      <div class="cover">
        <img src="/covers/{s.slug}.png" alt="" loading="lazy" onerror={(e) => (e.currentTarget.style.visibility = 'hidden')} />
        <span class="num">{String(s.number).padStart(2, '0')}</span>
      </div>
      <div class="info">
        <h2>{s.title}</h2>
        <p class="sub">{s.subtitle}</p>
        <p class="status" data-status={s.status}>{s.status}</p>
      </div>
    </a>
  {/each}
</div>

<style>
  .intro { max-width: 60ch; margin-bottom: 2.5rem; }
  .sandbox-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.75rem; }
  .sandbox-card { text-decoration: none; color: inherit; display: block; }
  .cover { position: relative; aspect-ratio: 4/3; background: #f0f0ee; border: 1px solid #ddd; overflow: hidden; }
  .cover img { width: 100%; height: 100%; object-fit: cover; }
  .num { position: absolute; top: 0.4rem; left: 0.5rem; font-size: 0.65rem; color: #999; }
  .info h2 { font-size: 0.9rem; margin: 0.6rem 0 0.25rem; }
  .sub { font-size: 0.72rem; color: #666; line-height: 1.55; margin: 0; }
  .status { font-size: 0.62rem; color: #999; margin: 0.5rem 0 0; letter-spacing: 0.05em; }
  .status[data-status='reference'] { color: #000; }
  .status[data-status='gated'] { color: #a00; }
  .sandbox-card:hover .cover { border-color: #000; }
</style>
