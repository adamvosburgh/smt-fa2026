<script>
  import Prose from '$lib/components/Prose.svelte';
  import AssignmentSubmit from '$lib/components/AssignmentSubmit.svelte';
  import { MODE } from '$lib/data.js';
  let { data } = $props();
  let submitting = $state(false);
  // In the archive build there is no server to post to, so no button.
  const canSubmit = $derived(data.doc.submit === true && MODE !== 'archive');
</script>

<Prose html={data.doc.html} />

{#if canSubmit}
  <div class="submit-row" id="upload">
    <button class="submit" type="button" onclick={() => (submitting = true)}>Submit your work</button>
    <span class="hint">Opens the upload form. Your submission appears under
      <a href="/gallery/#{data.doc.slug}">Student Work</a>.</span>
  </div>
{/if}

{#if data.submissions.length}
  <section class="handed-in">
    <h2>Handed in</h2>
    <div class="fork-grid">
      {#each data.submissions as s (s.url)}
        <a href={s.url} class="fork">
          <img src="{s.assetBase}cover.png" alt="" loading="lazy" onerror={(e) => (e.currentTarget.style.visibility = 'hidden')} />
          <b>{s.title}</b>
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

<style>
  .byline { font-size: 0.75rem; color: #666; margin-top: 3rem; border-top: 1px solid #eee; padding-top: 1rem; }
  .submit-row { margin-top: 2.5rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
  .submit { font: inherit; font-size: 0.78rem; padding: 0.6rem 1.2rem; border: 1px solid #000; background: #000; color: #fff; cursor: pointer; }
  .hint { font-size: 0.72rem; color: #666; }
  .handed-in { margin-top: 3rem; border-top: 1px solid #000; padding-top: 1.25rem; }
  .handed-in h2 { font-size: 0.8rem; text-transform: lowercase; margin: 0 0 1rem; }
  .fork-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1.25rem; }
  .fork { text-decoration: none; color: inherit; font-size: 0.72rem; display: block; }
  .fork img { width: 100%; aspect-ratio: 4/3; object-fit: cover; background: #f0f0ee; border: 1px solid #ddd; }
  .fork b { display: block; margin-top: 0.4rem; font-size: 0.75rem; }
  .fork span { color: #999; }
</style>
