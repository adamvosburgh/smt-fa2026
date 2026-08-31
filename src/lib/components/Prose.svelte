<script>
  // Rendered markdown, plus the hook that lets a tutorial embed a live sandbox
  // mid-prose. See SandboxMounts for the authoring syntax.
  import SandboxMounts from './SandboxMounts.svelte';
  let { html } = $props();
  let container = $state(null);
</script>

<article class="content-article" bind:this={container}>
  {@html html}
</article>
<SandboxMounts {container} />
