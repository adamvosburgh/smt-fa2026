<script>
  import { marquee } from '$lib/marquee.js';
  import Prose from '$lib/components/Prose.svelte';
  import AssignmentSubmit from '$lib/components/AssignmentSubmit.svelte';
  import { MODE } from '$lib/data.js';
  let { data } = $props();
  let submitting = $state(false);
  // In the archive build there is no server to post to, so no button.
  const canSubmit = $derived(data.doc?.submit === true && MODE !== 'archive');
</script>

{#if !data.doc}
  <p class="publishes">
    {#if data.publishes}
      This page publishes on {data.publishes.weekday} {data.publishes.date}.
    {:else}
      This page is not published yet.
    {/if}
  </p>
{:else}
  <Prose html={data.doc.html} />

  {#if canSubmit}
    <div class="submit-row" id="upload">
      <button class="submit" type="button" onclick={() => (submitting = true)}>Submit your work</button>
      <span class="hint">Opens the upload form. Your submission appears under
        <a href="/gallery/#{data.doc.slug}">Student Work</a>.</span>
    </div>
  {/if}

  {#if data.board}
    <p class="board-link"><a href="/whiteboard/{data.doc.slug}/">Assignment {data.doc.sequence} Whiteboard</a></p>
  {/if}

  {#if data.submissions.length}
    <section class="handed-in">
      <h2>Handed in</h2>
      <div class="fork-grid">
        {#each data.submissions as s (s.url)}
          <a href={s.url} class="fork">
            <img src={s.coverUrl} alt="" loading="lazy" onerror={(e) => (e.currentTarget.style.visibility = 'hidden')} />
            <b class="marquee" use:marquee={s.title}><span>{s.title}</span></b>
            <span>{s.student}</span>
          </a>
        {/each}
      </div>
    </section>
  {/if}

  {#if data.doc.author}
    <p class="byline">Module by {data.doc.author}{#if data.doc.date}, {data.doc.date}{/if}.</p>
  {/if}

  {#if submitting}
    <AssignmentSubmit doc={data.doc} onclose={() => (submitting = false)} />
  {/if}
{/if}

<style>
  .byline { font-size: 0.75rem; color: var(--fg-dim); margin-top: 3rem; border-top: 1px solid var(--rule); padding-top: 1rem; }
  .publishes { font-size: 0.9rem; }
  .submit-row { margin-top: 2.5rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
  .submit { font: inherit; font-size: 0.78rem; padding: 0.6rem 1.2rem; border: 0; background: var(--fg); color: var(--bg); cursor: pointer; }
  .submit:hover { background: var(--hi); color: var(--hi-fg); }
  .hint { font-size: 0.72rem; color: var(--fg-dim); }
  .board-link { margin-top: 1rem; font-size: 0.78rem; }
  .board-link a { color: var(--fg); }
  .board-link a:hover { background: var(--hi); color: var(--hi-fg); }
  .handed-in { margin-top: 3rem; border-top: 1px solid var(--rule); padding-top: 1.25rem; }
  .handed-in h2 { font-size: 0.8rem; text-transform: lowercase; margin: 0 0 1rem; }
  .fork-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.25rem; }
  @media (max-width: 600px) { .fork-grid { grid-template-columns: 1fr; } }
  .fork { text-decoration: none; color: inherit; font-size: 0.72rem; display: block; }
  .fork img { width: 100%; aspect-ratio: 4/3; object-fit: cover; background: var(--code-bg); border: 1px solid var(--rule); transition: opacity 0.15s ease; }
  .fork:hover img { opacity: 0.85; }
  .fork:hover b { background: var(--hi); color: var(--hi-fg); }
  .fork b { display: inline-block; margin-top: 0.4rem; font-size: 0.75rem; }
  .fork span { display: block; color: var(--fg-dim); }
</style>
