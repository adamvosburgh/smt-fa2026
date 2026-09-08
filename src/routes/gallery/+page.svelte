<script>
  let { data } = $props();
</script>

{#each data.sections as sec (sec.id)}
  <section class="work-section" id={sec.id}>
    <h2>
      {#if sec.kind === 'assignment'}<span class="seq">Assignment {sec.sequence}</span>{:else}<span class="seq">Sandbox {sec.sequence}</span>{/if}
      <a href={sec.href}>{sec.title}</a>
      {#if sec.due}<span class="due">due {sec.due}</span>{/if}
    </h2>
    {#if sec.items.length}
      <div class="project-grid">
        {#each sec.items as s (s.url)}
          <a href={s.url} class="project-card">
            <div class="project-card-image">
              <img src="{s.assetBase}cover.png" alt="Cover image for {s.title}" loading="lazy"
                onerror={(e) => (e.currentTarget.style.visibility = 'hidden')} />
            </div>
            <div class="project-card-info">
              <h3 class="project-card-title">{s.title}</h3>
              <p class="project-card-author">{s.student}</p>
            </div>
          </a>
        {/each}
      </div>
    {:else}
      <p class="empty">Nothing handed in yet.</p>
    {/if}
  </section>
{:else}
  <p class="content-article">No submissions yet.</p>
{/each}

<style>
  .work-section { margin-bottom: 3.5rem; }
  .work-section h2 { font-size: 0.9rem; margin: 0 0 1.25rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--rule); display: flex; gap: 0.75rem; align-items: baseline; flex-wrap: wrap; }
  .work-section h2 a { color: inherit; text-decoration: none; }
  .work-section h2 a:hover { background: var(--hi); color: var(--hi-fg); }
  .seq { font-size: 0.68rem; color: var(--fg-dim); text-transform: uppercase; letter-spacing: 0.05em; }
  .due { font-size: 0.68rem; color: var(--fg-dim); margin-left: auto; }
  .empty { font-size: 0.78rem; color: var(--fg-dim); }
</style>
