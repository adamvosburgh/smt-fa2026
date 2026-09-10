<script>
  import Prose from '$lib/components/Prose.svelte';
  // The assistant's system prompt is printed on its own resource page, which is
  // the whole reason assistant-prompt.js is not under $lib/server: this page
  // prerenders, so the prompt is baked in at build time. Called with no
  // argument, so what prints is the standing prompt - no "the student is
  // currently on..." line and no page text, both of which only exist per
  // request. See src/lib/assistant-prompt.js.
  import { systemPrompt } from '$lib/assistant-prompt.js';
  let { data } = $props();
</script>

<Prose html={data.doc.html} />

{#if data.doc.renders === 'assistant-prompt'}
  <div class="prompt">
    <pre>{systemPrompt()}</pre>
  </div>
{/if}

{#if data.doc.author}
  <p class="byline">Module by {data.doc.author}{#if data.doc.date}, {data.doc.date}{/if}.</p>
{/if}

<style>
  /* The site's global `pre` rule already gives this --code-bg, a border and
     padding, and the body font is the monospace. All it needs on top is the
     wrap - the prompt is prose in hard-wrapped lines, not code to scroll - and
     a rule separating it from the sentence that introduces it. */
  .prompt { border-top: 1px solid var(--rule); padding-top: 1.5rem; margin-top: 1.5rem; }
  .prompt pre { margin: 0; white-space: pre-wrap; font-size: 0.75rem; }
  .byline { font-size: 0.75rem; color: var(--fg-dim); margin-top: 3rem; border-top: 1px solid var(--rule); padding-top: 1rem; }
</style>
