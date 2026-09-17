<script>
  import { onMount } from 'svelte';
  import { token } from '$lib/token.js';
  import { MODE } from '$lib/data.js';
  import Whiteboard from '$lib/components/Whiteboard.svelte';
  import TokenGate from '$lib/components/TokenGate.svelte';

  let { data } = $props();

  // The token lives in localStorage, which the server render cannot see; the
  // gate and the board wait for the browser so the two renders agree.
  let mounted = $state(false);
  let who = $state(null);
  let rejected = $state(false);
  let missing = $state(false);
  let meta = $state(null);
  let people = $state(0);
  let genBusy = $state(false);
  let genNote = $state('');
  let hintRequest = $state(0);

  onMount(() => (mounted = true));

  $effect(() => {
    if (MODE === 'archive' || !mounted) return;
    const t = $token;
    who = null;
    rejected = false;
    if (!t) return;
    let live = true;
    fetch('/api/whoami', { headers: { authorization: `Bearer ${t}` } })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!live) return;
        if (ok && d.ok) who = { student: d.student, name: d.name, role: d.role };
        else rejected = true;
      })
      .catch(() => live && (rejected = true));
    return () => (live = false);
  });

  const title = $derived(meta?.title ?? data.board?.title ?? data.slug);
  const kind = $derived(meta?.kind ?? data.board?.kind);

  async function generate() {
    genBusy = true;
    genNote = '';
    try {
      const res = await fetch(`/api/boards/${data.slug}/generate`, {
        method: 'POST',
        headers: { authorization: `Bearer ${$token}` }
      });
      const d = await res.json().catch(() => null);
      if (d?.ok) genNote = d.added ? `Added ${d.added}.` : 'Nothing new.';
      else genNote = d?.error ?? '';
    } finally {
      genBusy = false;
    }
  }
</script>

<div class="board-page">
  <div class="bar">
    <div class="left">
      <a class="back" href="/whiteboard/">← Whiteboard</a>
    </div>
    <div class="middle">
      <b class="title">{title}</b>
      {#if who && !missing}<span class="here">{people} here</span>{/if}
    </div>
    <div class="right">
      {#if who?.role === 'owner' && kind === 'assignment'}
        {#if genNote}<span class="gen-note">{genNote}</span>{/if}
        <button type="button" class="gen" onclick={generate} disabled={genBusy}>add new submissions</button>
      {/if}
      {#if who && !missing}
        <button type="button" class="help" aria-label="Show the controls" onclick={() => hintRequest++}>?</button>
      {/if}
    </div>
  </div>

  <div class="surface">
    {#if MODE === 'archive'}
      <Whiteboard slug={data.slug} mode="view" initial={data.board} />
    {:else if mounted}
      {#if !$token || rejected}
        <div class="pad"><TokenGate {rejected} /></div>
      {:else if missing}
        <p class="pad missing">No board here.</p>
      {:else if who}
        {#key $token}
          <Whiteboard
            slug={data.slug}
            mode="edit"
            {who}
            {hintRequest}
            onmeta={(b) => (meta = b)}
            onpresence={(n) => (people = n)}
            onerror={(status) => {
              if (status === 401) rejected = true;
              else if (status === 404) missing = true;
            }}
          />
        {/key}
      {/if}
    {/if}
  </div>
</div>

<style>
  .board-page {
    position: fixed; left: 0; right: 0; bottom: 0; top: var(--chrome-top);
    display: flex; flex-direction: column;
  }
  /* Three columns, the outer two equal, so the middle stays centered on the
     page whatever the sides hold. */
  .bar {
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 1rem;
    padding: 0 1.25rem 0.5rem; font-size: 0.78rem;
    border-bottom: 1px solid var(--rule);
  }
  .left, .middle, .right { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
  .middle { justify-content: center; text-align: center; }
  .right { justify-content: flex-end; }
  .back { color: var(--fg); text-decoration: none; }
  .back:hover { background: var(--hi); color: var(--hi-fg); }
  .title { font-size: 0.9rem; }
  .here { color: var(--fg-dim); font-size: 0.72rem; }
  .help {
    font: inherit; font-size: 0.72rem; width: 1.4rem; height: 1.4rem; padding: 0; line-height: 1;
    border: 1px solid var(--rule); border-radius: 50%; background: none; color: var(--fg); cursor: pointer;
  }
  .help:hover { background: var(--hi); color: var(--hi-fg); border-color: var(--hi); }
  .gen {
    font: inherit; font-size: 0.72rem; padding: 0.2rem 0.6rem;
    border: 1px solid var(--fg); background: transparent; color: var(--fg); cursor: pointer;
  }
  .gen:hover:not(:disabled) { background: var(--hi); color: var(--hi-fg); border-color: var(--hi); }
  .gen:disabled { opacity: 0.4; cursor: default; }
  .gen-note { font-size: 0.72rem; color: var(--fg-dim); }
  .surface { position: relative; flex: 1; min-height: 0; }
  .pad { padding: 2rem 1.25rem; }
  .missing { font-size: 0.9rem; }
</style>
