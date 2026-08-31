<script>
  // Lets a tutorial embed a live sandbox in the middle of its prose. In markdown
  // you write:
  //
  //   <div data-sandbox="bathtub" data-mode="view"
  //        data-params='{"slr_m":1.5,"connectivity":false}'></div>
  //
  // ...and this finds it after render and mounts the real component into it.
  // Markdown stays markdown - no Svelte syntax in prose, no curly-brace
  // landmines in code samples - and tutorials still get live components.
  import { mount, unmount } from 'svelte';
  import { bySlug, load, defaults } from '$lib/sandboxes/index.js';
  import SandboxFrame from './SandboxFrame.svelte';

  let { container } = $props();
  let instances = [];

  $effect(() => {
    if (!container) return;
    const nodes = container.querySelectorAll('[data-sandbox]');
    (async () => {
      for (const node of nodes) {
        const slug = node.dataset.sandbox;
        const meta = bySlug[slug];
        if (!meta) { node.textContent = `[no such sandbox: ${slug}]`; continue; }
        const { default: Component } = await load(slug);
        let overrides = {};
        try { overrides = JSON.parse(node.dataset.params || '{}'); } catch { /* author typo; ignore */ }
        instances.push(
          mount(SandboxFrame, {
            target: node,
            props: {
              meta,
              schema: meta.schema,
              Component,
              mode: node.dataset.mode === 'edit' ? 'edit' : 'view',
              params: { ...defaults(slug), ...overrides },
              showChrome: node.dataset.chrome !== 'false'
            }
          })
        );
      }
    })();
    return () => { instances.forEach(unmount); instances = []; };
  });
</script>
