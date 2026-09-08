<script>
  import { load as loadSandbox, defaults } from '$lib/sandboxes/index.js';
  import SandboxFrame from '$lib/components/SandboxFrame.svelte';
  let { data } = $props();

  let Component = $state(null);
  let params = $state({});

  $effect(() => {
    params = defaults(data.meta.slug);
    loadSandbox(data.meta.slug).then((m) => (Component = m.default));
  });
</script>

{#if Component}
  {#key data.meta.slug}
    <SandboxFrame
      meta={data.meta}
      schema={data.meta.schema}
      {Component}
      mode="edit"
      layout="full"
      bind:params
    />
  {/key}
{/if}

{#if data.meta.tutorial}
  <p class="tut">
    <a href={data.meta.tutorial}>Dev notes</a>: what went into this one, where it got stuck, and
    what a rebuild won't have.
  </p>
{/if}

{#if data.submissions.length}
  <section class="forks">
    <h2>Forks</h2>
    <div class="fork-grid">
      {#each data.submissions as s (s.url)}
        <a href={s.url} class="fork">
          <img src="{s.assetBase}cover.png" alt="" loading="lazy" />
          <b>{s.title}</b>
          <span>{s.student}</span>
        </a>
      {/each}
    </div>
  </section>
{/if}

<style>
  .tut { font-size: 0.78rem; color: #666; margin-top: 1.5rem; max-width: 62ch; }
  .forks { margin-top: 3.5rem; border-top: 1px solid #000; padding-top: 1.25rem; }
  .forks h2 { font-size: 0.8rem; text-transform: lowercase; margin: 0 0 1rem; }
  .fork-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1.25rem; }
  .fork { text-decoration: none; color: inherit; font-size: 0.72rem; display: block; }
  .fork img { width: 100%; aspect-ratio: 4/3; object-fit: cover; background: #f0f0ee; border: 1px solid #ddd; }
  .fork b { display: block; margin-top: 0.4rem; font-size: 0.75rem; }
  .fork span { color: #999; }
</style>
