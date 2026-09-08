<script>
  import { load as loadSandbox, defaults } from '$lib/sandboxes/index.js';
  import SandboxFrame from '$lib/components/SandboxFrame.svelte';
  let { data } = $props();

  let Component = $state(null);
  let params = $state({});

  $effect(() => {
    if (data.unpublished) return;
    params = defaults(data.meta.slug);
    loadSandbox(data.meta.slug).then((m) => (Component = m.default));
  });
</script>

{#if data.unpublished}
  <section class="held">
    <h1>{data.meta.title}</h1>
    <p class="publishes">This sandbox is not published yet.</p>
    {#if data.meta.statusNote}<p class="why">{data.meta.statusNote}</p>{/if}
  </section>
{:else if Component}
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

{#if data.tutorial}
  <p class="tut">
    <a href={data.tutorial}>Dev notes</a>: what went into this one, where it got stuck, and
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
  .held { max-width: 62ch; padding-top: 1rem; }
  .held h1 { font-size: 1.4rem; margin: 0 0 0.5rem; }
  .held .publishes { font-size: 0.9rem; margin: 0 0 1rem; }
  .held .why { font-size: 0.78rem; color: var(--fg-dim); line-height: 1.7; }
  .tut { font-size: 0.78rem; color: var(--fg-dim); margin-top: 1.5rem; max-width: 62ch; }
  .forks { margin-top: 3.5rem; border-top: 1px solid var(--rule); padding-top: 1.25rem; }
  .forks h2 { font-size: 0.8rem; text-transform: lowercase; margin: 0 0 1rem; }
  .fork-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1.25rem; }
  .fork { text-decoration: none; color: inherit; font-size: 0.72rem; display: block; }
  .fork img { width: 100%; aspect-ratio: 4/3; object-fit: cover; background: var(--code-bg); border: 1px solid var(--rule); transition: opacity 0.15s ease; }
  .fork:hover img { opacity: 0.85; }
  .fork:hover b { background: var(--hi); color: var(--hi-fg); }
  .fork b { display: inline-block; margin-top: 0.4rem; font-size: 0.75rem; }
  .fork span { display: block; color: var(--fg-dim); }
</style>
