<script>
  // The archived page. Same component as the sandbox, mode="view" - which is the
  // whole reason for the one-component-two-modes rule. Nothing here re-renders a
  // frozen screenshot; it runs the real thing at the student's parameters.
  import { load as loadSandbox } from '$lib/sandboxes/index.js';
  import SandboxFrame from '$lib/components/SandboxFrame.svelte';
  let { data } = $props();

  let Component = $state(null);
  $effect(() => {
    loadSandbox(data.sub.sandbox).then((m) => (Component = m.default));
  });
</script>

<header class="sub-header">
  <h1>{data.sub.title}</h1>
  <p class="who">{data.sub.student} · <a href="/sandboxes/{data.sub.sandbox}/">{data.meta?.title}</a></p>
  <p class="gallery-text">{data.sub.gallery_text}</p>
</header>

{#if Component}
  <SandboxFrame
    meta={data.meta}
    schema={data.meta?.schema}
    {Component}
    mode="view"
    params={data.sub.params}
    assets={data.sub.assets ?? {}}
  />
{/if}

{#if data.sub.description}
  <div class="content-article desc">{@html data.sub.description}</div>
{/if}

<details class="params-dump">
  <summary>Parameters as submitted</summary>
  <pre>{JSON.stringify(data.sub.params, null, 2)}</pre>
</details>

<style>
  .sub-header { margin-bottom: 1.5rem; }
  h1 { font-size: 1.4rem; margin: 0 0 0.3rem; }
  .who { font-size: 0.75rem; color: #666; margin: 0 0 1rem; }
  .gallery-text { font-size: 0.95rem; line-height: 1.7; max-width: 60ch; margin: 0; }
  .desc { margin-top: 2rem; max-width: 60ch; }
  .params-dump { margin-top: 2.5rem; font-size: 0.72rem; }
  .params-dump summary { cursor: pointer; color: #666; }
  .params-dump pre { background: #f6f6f4; padding: 0.75rem; overflow-x: auto; margin-top: 0.5rem; }
</style>
