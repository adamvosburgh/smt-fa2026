<script>
  // STUB. See the Sandboxes spec for the build notes, and
  // src/lib/sandboxes/bathtub/ for the reference implementation of the contract.
  import NotBuilt from '$lib/components/NotBuilt.svelte';
  import meta from './meta.js';
  let { onmetrics, onready } = $props();
</script>

<NotBuilt {meta} {onmetrics} {onready} />
