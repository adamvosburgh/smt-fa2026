<script>
  import { marquee } from '$lib/marquee.js';
  import { MODE } from '$lib/data.js';
  let { data } = $props();

  // Every section folds. An assignment's starts folded from the day after it is
  // due, so the current one sits at the top of the page; the archive opens all.
  const now = Date.now();
  const startsOpen = (sec) => MODE === 'archive' || !sec.closes || now < sec.closes;
</script>

{#each data.sections as sec (sec.id)}
  <details class="work-section" id={sec.id} open={startsOpen(sec)}>
    <summary><h2>
      {#if sec.kind === 'assignment'}<span class="seq">Assignment {sec.sequence}</span>{:else}<span class="seq">Sandbox {sec.sequence}</span>{/if}
      <a href={sec.href}>{sec.title}</a>
      {#if sec.due}<span class="due">due {sec.due}</span>{/if}
    </h2></summary>
    {#if sec.items.length}
      <div class="project-grid">
        {#each sec.items as s (s.url)}
          <a href={s.url} class="project-card">
            <div class="project-card-image">
              <img src={s.coverUrl} alt="Cover image for {s.title}" loading="lazy"
                onerror={(e) => (e.currentTarget.style.visibility = 'hidden')} />
            </div>
            <div class="project-card-info">
              <h3 class="project-card-title marquee" use:marquee={s.title}><span>{s.title}</span></h3>
              <p class="project-card-author">{s.student}</p>
            </div>
          </a>
        {/each}
      </div>
    {:else}
      <p class="empty">Nothing handed in yet.</p>
    {/if}
  </details>
{:else}
  <p class="content-article">No submissions yet.</p>
{/each}

<style>
  .work-section { margin-bottom: 3.5rem; }
  .work-section:not([open]) { margin-bottom: 1.25rem; }
  .work-section summary { cursor: pointer; list-style: none; }
  .work-section summary::-webkit-details-marker { display: none; }
  .work-section h2::before { content: '+'; color: var(--fg-dim); font-weight: 400; width: 0.7em; flex: none; }
  .work-section[open] h2::before { content: '–'; }
  .work-section:not([open]) h2 { margin-bottom: 0; }
  .work-section h2 { font-size: 0.9rem; margin: 0 0 1.25rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--rule); display: flex; gap: 0.75rem; align-items: baseline; flex-wrap: wrap; }
  .work-section h2 a { color: inherit; text-decoration: none; }
  .work-section h2 a:hover { background: var(--hi); color: var(--hi-fg); }
  .seq { font-size: 0.68rem; color: var(--fg-dim); text-transform: uppercase; letter-spacing: 0.05em; }
  .due { font-size: 0.68rem; color: var(--fg-dim); margin-left: auto; }
  .empty { font-size: 0.78rem; color: var(--fg-dim); }
</style>
