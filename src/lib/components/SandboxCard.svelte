<script>
  // The sandbox card. Every sandbox carries one: what this is, why we are
  // looking at it, where the data came from, what it assumes, what it cannot
  // see. The prose lives in src/lib/sandboxes/<slug>/card.md so it can be
  // written as prose; this only decides how it is opened.
  //
  // Two ways in, and which one you get depends on how much room there is:
  //
  //   variant="button"  a modal. Used wherever the sandbox is a guest - the
  //                     gallery, a tutorial embed - because those pages have
  //                     their own argument running and the card is an aside.
  //   variant="inline"  the card open on the page, one <details> per section,
  //                     in the left dock of the full-width layout. The sandbox
  //                     route IS the card's page, so it should not be behind a
  //                     click there.
  //
  // The limits are the last section either way, on the reasoning that you have
  // to understand how a thing works before "what it misses" means anything.
  import { card, cardSections } from '$lib/sandboxes/cards.js';

  let { meta, open = false, variant = 'button' } = $props();
  let expanded = $state(false);
  let dialog = $state(null);
  const html = $derived(card(meta.slug));
  const sections = $derived(cardSections(meta.slug));

  $effect(() => { expanded = open; });
  // Escape has to land somewhere, so the dialog takes focus when it opens.
  $effect(() => { if (expanded && dialog) dialog.focus(); });
</script>

{#if variant === 'inline'}
  <div class="inline">
    {#each sections as s, i (s.title)}
      <details open={i === 0}>
        <summary>{s.title}</summary>
        <div class="body">{@html s.html}</div>
      </details>
    {/each}
    {#if meta.tutorial}
      <p class="tut">
        How it was built: <a href={meta.tutorial}>the {meta.title} tutorial</a>.
      </p>
    {/if}
  </div>
{:else}
  {#if html}
    <button
      class="open"
      type="button"
      aria-expanded={expanded}
      onclick={() => (expanded = true)}
    >
      <span class="i" aria-hidden="true">i</span> about this sandbox
    </button>
  {/if}

  {#if expanded && html}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
    <div
      class="scrim"
      role="dialog"
      aria-modal="true"
      aria-label="About the {meta.title} sandbox"
      tabindex="-1"
      bind:this={dialog}
      onkeydown={(e) => e.key === 'Escape' && (expanded = false)}
      onclick={(e) => e.target === dialog && (expanded = false)}
    >
      <article class="card">
        <header>
          {#if meta.number != null}
            <span class="num">{String(meta.number).padStart(2, '0')}</span>
          {/if}
          <h2>{meta.title}</h2>
          <button class="close" type="button" onclick={() => (expanded = false)}>close</button>
        </header>
        <div class="body">{@html html}</div>
        {#if meta.tutorial}
          <p class="tut">
            How it was built: <a href={meta.tutorial}>the {meta.title} tutorial</a>.
          </p>
        {/if}
      </article>
    </div>
  {/if}
{/if}

<style>
  .open {
    display: inline-flex; align-items: center; gap: 0.45rem;
    margin-top: 0.9rem; padding: 0.4rem 0.65rem 0.4rem 0.45rem;
    font: inherit; font-size: 0.72rem; color: #000;
    background: #fff; border: 1px solid #000; cursor: pointer;
  }
  .open:hover { background: #000; color: #fff; }
  .i {
    width: 14px; height: 14px; border: 1px solid currentColor; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 0.6rem; font-style: italic; line-height: 1;
  }

  .scrim:focus { outline: none; }
  .scrim {
    position: fixed; inset: 0; z-index: 50;
    background: rgba(20, 20, 20, 0.45);
    display: flex; align-items: flex-start; justify-content: center;
    padding: 4vh 1rem; overflow-y: auto;
  }
  .card {
    background: #fff; border: 1px solid #000;
    width: min(62ch, 100%); padding: 1.75rem 2rem 2rem;
    font-size: 0.82rem;
  }
  header {
    display: flex; align-items: baseline; gap: 0.6rem;
    border-bottom: 1px solid #000; padding-bottom: 0.6rem; margin-bottom: 1.25rem;
  }
  .num { font-size: 0.7rem; color: #999; }
  h2 { font-size: 1rem; margin: 0; }
  .close {
    margin-left: auto; font: inherit; font-size: 0.7rem; color: #666;
    background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline;
  }

  /* The dock version. Sections read as a contents list until one is opened. */
  .inline { margin-top: 1.25rem; }
  .inline details { border-top: 1px solid #e2e2e0; }
  .inline details:last-of-type { border-bottom: 1px solid #e2e2e0; }
  .inline summary {
    cursor: pointer; list-style: none;
    padding: 0.5rem 0; font-size: 0.7rem; font-weight: 700;
    text-transform: lowercase; letter-spacing: 0.03em;
    display: flex; align-items: baseline; gap: 0.45rem;
  }
  .inline summary::-webkit-details-marker { display: none; }
  .inline summary::before {
    content: '+'; color: #999; font-weight: 400; width: 0.7em; flex: none;
  }
  .inline details[open] > summary::before { content: '–'; }
  .inline summary:hover { color: #000; }
  .inline summary:hover::before { color: #000; }
  .inline .body { padding: 0 0 0.9rem 1.15rem; font-size: 0.72rem; }

  .body { line-height: 1.7; }
  .body :global(h2) {
    font-size: 0.72rem; text-transform: lowercase; letter-spacing: 0.04em;
    margin: 2rem 0 0.6rem; color: #000;
  }
  .body :global(h2:first-child) { margin-top: 0; }
  .body :global(p) { margin: 0 0 0.9rem; }
  .body :global(p:last-child) { margin-bottom: 0; }
  .body :global(ul) { margin: 0 0 0.9rem; padding-left: 1.1rem; }
  .body :global(li) { margin-bottom: 0.5rem; }
  .body :global(code) { font-size: 0.9em; background: #f2f2f0; padding: 0 0.2em; }
  .body :global(strong) { font-weight: 700; }
  /* Footnotes carry the sources. Small, ruled off, and at the end of whichever
     render they belong to - the whole card in the modal, the section in the dock. */
  .body :global(.footnote-ref a) { text-decoration: none; font-size: 0.75em; }
  .body :global(hr.footnotes-sep) { border: 0; border-top: 1px solid #e2e2e0; margin: 1rem 0 0.6rem; }
  .body :global(.footnotes) { font-size: 0.85em; color: #555; }
  .body :global(.footnotes-list) { margin: 0; padding-left: 1.2rem; }
  .body :global(.footnote-item p) { margin: 0 0 0.4rem; }
  .body :global(.footnote-backref) { text-decoration: none; }

  .tut { font-size: 0.75rem; color: #666; border-top: 1px solid #ddd; padding-top: 0.9rem; margin: 1.5rem 0 0; }
  .inline .tut { font-size: 0.68rem; border-top: 0; padding-top: 0; margin-top: 1rem; }

  @media (max-width: 900px) {
    .card { padding: 1.25rem 1.25rem 1.75rem; }
  }
</style>
