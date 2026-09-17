<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { token } from '$lib/token.js';
  import { MODE } from '$lib/data.js';
  import { collection, dueLabel } from '$lib/content.js';
  import { boards as listBoards } from '$lib/boards.js';
  import { loadAsset, needsToken } from '$lib/board/assets.js';
  import TokenGate from '$lib/components/TokenGate.svelte';
  import BoardSketch from '$lib/components/BoardSketch.svelte';
  import { marquee } from '$lib/marquee.js';

  let { data } = $props();

  const TAB_KEY = 'smt.whiteboard.tab';
  let mounted = $state(false);
  let rows = $state(data.boards);
  let who = $state(null);
  let rejected = $state(false);
  let tab = $state('all');
  let covers = $state({});
  let tip = $state(false);
  let tipTimer = 0;

  let creating = $state(false);
  let newTitle = $state('');
  let newKind = $state('exercise');
  let createError = $state('');
  let busy = $state(false);

  onMount(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY);
      if (saved === 'assignment' || saved === 'exercise') tab = saved;
    } catch {
      // Default tab.
    }
    mounted = true;
  });

  function setTab(t) {
    tab = t;
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      // Not remembered; harmless.
    }
  }

  $effect(() => {
    if (MODE === 'archive' || !mounted) return;
    const t = $token;
    rows = null;
    who = null;
    rejected = false;
    if (!t) return;
    let live = true;
    listBoards(fetch, t)
      .then((r) => live && (rows = r))
      .catch(() => live && (rejected = true));
    fetch('/api/whoami', { headers: { authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then((d) => live && d.ok && (who = d))
      .catch(() => {});
    return () => (live = false);
  });

  // The pictures in each card's sketch. Board files sit behind the token, so
  // they are fetched with it and drawn from blob URLs; tile covers and the
  // archive's files are used as they are. See src/lib/board/assets.js.
  const requested = new Set();
  $effect(() => {
    for (const r of rows ?? []) {
      for (const it of r.sketch?.items ?? []) {
        if (!it.src || requested.has(it.src)) continue;
        requested.add(it.src);
        if (!needsToken(it.src)) covers[it.src] = it.src;
        else loadAsset(it.src, $token).then((u) => { if (u) covers[it.src] = u; });
      }
    }
  });

  const assignments = Object.fromEntries(collection('assignments', { all: true }).map((a) => [a.slug, a]));
  const DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'numeric', day: 'numeric' });

  function line2(b) {
    if (b.kind === 'assignment') {
      const a = assignments[b.assignment];
      if (!a) return 'Assignment';
      const due = dueLabel(a);
      return due ? `Assignment ${a.sequence} · due ${due}` : `Assignment ${a.sequence}`;
    }
    const d = new Date(b.created);
    return Number.isNaN(d.getTime()) ? 'Exercise' : `Exercise · ${DAY.format(d)}`;
  }

  const shown = $derived((rows ?? []).filter((b) => tab === 'all' || b.kind === tab));

  function newBoard() {
    if (who?.role !== 'owner') {
      clearTimeout(tipTimer);
      tip = false;
      requestAnimationFrame(() => (tip = true));
      tipTimer = setTimeout(() => (tip = false), 1500);
      return;
    }
    newTitle = '';
    newKind = 'exercise';
    createError = '';
    creating = true;
  }

  async function create() {
    if (!newTitle.trim()) {
      createError = 'Give the board a title.';
      return;
    }
    busy = true;
    createError = '';
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { authorization: `Bearer ${$token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), kind: newKind })
      });
      const d = await res.json().catch(() => null);
      if (d?.ok) {
        creating = false;
        goto(d.href);
      } else {
        createError = d?.error ?? '';
      }
    } finally {
      busy = false;
    }
  }
</script>

<p class="intro">Boards for pin-ups and in-class exercises.</p>

{#if MODE !== 'archive' && mounted && (!$token || rejected)}
  <TokenGate {rejected} />
{:else if rows}
  <div class="toggle" role="tablist">
    <button type="button" role="tab" class:on={tab === 'all'} aria-selected={tab === 'all'} onclick={() => setTab('all')}>All</button>
    <button type="button" role="tab" class:on={tab === 'assignment'} aria-selected={tab === 'assignment'} onclick={() => setTab('assignment')}>Assignments</button>
    <button type="button" role="tab" class:on={tab === 'exercise'} aria-selected={tab === 'exercise'} onclick={() => setTab('exercise')}>Exercises</button>
  </div>

  {#if !shown.length}
    <p class="empty">
      {tab === 'exercise'
        ? 'Nothing here yet.'
        : 'Nothing here yet. An assignment board appears at 9am on the morning it is due.'}
    </p>
  {/if}

  <div class="project-grid">
    {#each shown as b (b.slug)}
      <a href="/whiteboard/{b.slug}/" class="project-card">
        <div class="project-card-image">
          <BoardSketch sketch={b.sketch} srcs={covers} />
        </div>
        <div class="project-card-info">
          <h3 class="project-card-title marquee" use:marquee={b.title}><span>{b.title}</span></h3>
          <p class="project-card-author">{line2(b)}</p>
          <p class="project-card-author">{b.count === 1 ? '1 item' : `${b.count} items`}</p>
        </div>
      </a>
    {/each}

    {#if MODE !== 'archive'}
      <div class="new-wrap">
        <button type="button" class="new" onclick={newBoard}>
          <span class="plus">+</span>
          <span class="label">New board</span>
        </button>
        {#if tip}<span class="tip">you're not adam!</span>{/if}
      </div>
    {/if}
  </div>
{/if}

{#if creating}
  <div class="backdrop" onclick={() => (creating = false)} role="presentation"></div>
  <div class="dialog" role="dialog" aria-label="New board">
    <h2>New board</h2>
    <label>
      Title
      <input bind:value={newTitle} maxlength="140"
        onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }} />
    </label>
    <fieldset>
      <legend>Kind</legend>
      <label class="radio"><input type="radio" bind:group={newKind} value="exercise" /> Exercise</label>
      <label class="radio"><input type="radio" bind:group={newKind} value="assignment" /> Assignment</label>
    </fieldset>
    {#if createError}<p class="err">{createError}</p>{/if}
    <div class="actions">
      <button type="button" onclick={() => (creating = false)}>Cancel</button>
      <button type="button" class="go" onclick={create} disabled={busy}>Create</button>
    </div>
  </div>
{/if}

<style>
  .intro { font-size: 0.85rem; color: var(--fg-dim); margin: -1rem 0 1.5rem; }
  .toggle { display: inline-flex; border: 1px solid var(--rule); border-radius: 40px; padding: 0.2rem; margin-bottom: 1.75rem; }
  .toggle button {
    font: inherit; font-size: 0.78rem; padding: 0.35rem 0.9rem; border: 0; border-radius: 40px;
    background: none; color: var(--fg); cursor: pointer;
  }
  .toggle button.on, .toggle button:hover { background: var(--hi); color: var(--hi-fg); }
  .empty { font-size: 0.78rem; color: var(--fg-dim); margin: 0 0 1.5rem; }
  .project-card-author { margin: 0; }

  .new-wrap { position: relative; }
  .new {
    width: 100%; aspect-ratio: 4 / 3; border: 1px dashed var(--rule); border-radius: 4px;
    background: none; color: var(--fg); font: inherit; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem;
  }
  .new:hover { border-color: var(--hi); }
  .plus { font-size: 2rem; line-height: 1; }
  .label { font-size: 0.85rem; }
  .tip {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, 2.25rem);
    background: var(--hi); color: var(--hi-fg); font-size: 0.72rem; padding: 0.2rem 0.6rem;
    border-radius: 40px; white-space: nowrap; pointer-events: none;
    animation: fade 1.5s ease-in forwards;
  }
  @keyframes fade { from { opacity: 1; } to { opacity: 0; } }

  .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1100; }
  .dialog {
    position: fixed; z-index: 1101; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(420px, calc(100vw - 2rem));
    background: var(--bg); color: var(--fg); border: 1px solid var(--rule); padding: 1.5rem; font-size: 0.78rem;
  }
  h2 { font-size: 0.95rem; margin: 0 0 1.25rem; }
  label { display: block; margin-bottom: 0.9rem; font-size: 0.72rem; font-weight: 700; }
  input:not([type='radio']) { display: block; width: 100%; font: inherit; font-size: 0.78rem; font-weight: 400;
    margin-top: 0.3rem; padding: 0.4rem; border: 1px solid var(--rule); background: var(--code-bg); color: var(--fg); }
  fieldset { border: 0; padding: 0; margin: 0 0 0.9rem; }
  legend { font-size: 0.72rem; font-weight: 700; margin-bottom: 0.3rem; }
  .radio { display: inline-flex; align-items: center; gap: 0.35rem; margin: 0 1rem 0 0; font-weight: 400; }
  .err { font-weight: 700; font-size: 0.72rem; margin: 0 0 0.75rem; }
  .actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem; }
  .actions button { font: inherit; font-size: 0.72rem; padding: 0.45rem 0.9rem;
    border: 1px solid var(--fg); background: transparent; color: var(--fg); cursor: pointer; }
  .actions button:hover { background: var(--hi); color: var(--hi-fg); border-color: var(--hi); }
  .actions .go { background: var(--fg); color: var(--bg); }
  .actions .go:disabled { opacity: 0.4; cursor: default; }
</style>
