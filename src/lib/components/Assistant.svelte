<script>
  // Course assistant, available site-wide. The client sends one message and a
  // session cookie; the server owns the transcript. See src/routes/api/assistant
  // for why.
  import { page } from '$app/state';
  import { token } from '$lib/token.js';
  import { MODE } from '$lib/data.js';

  let open = $state(false);
  let enabled = $state(false);
  let input = $state('');
  let busy = $state(false);
  let log = $state([]);

  // The token field. The submit forms hide theirs once a token is stored, which
  // is fine there because a student only meets that form a few times a term.
  // Here the field stays on screen and greys out instead: cookie-clearing and
  // private windows drop localStorage often enough that a student who has lost
  // their token needs somewhere obvious to put it back, and the assistant is
  // the one place they hit that wall mid-task. `replacing` re-opens it.
  let replacing = $state(false);
  let draft = $state('');

  function saveToken() {
    const t = draft.trim();
    if (!t) return;
    token.set(t);
    draft = '';
    replacing = false;
    // Drop the "needs your token" line so the panel isn't still telling them
    // to do the thing they just did.
    log = log.filter((m) => !m.needsToken);
  }

  $effect(() => {
    // The frozen archive has no server, so there is no assistant. Don't probe
    // for one - it would 404 on every page of the archived site forever.
    if (MODE === 'archive') return;
    fetch('/api/assistant')
      .then((r) => r.json())
      .then((d) => (enabled = d.enabled))
      .catch(() => (enabled = false));
  });

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    input = '';
    log = [...log, { role: 'user', text: message }];
    busy = true;
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...($token ? { authorization: `Bearer ${$token}` } : {})
        },
        body: JSON.stringify({
          message,
          sandbox: page.params.slug ?? page.params.sandbox ?? '',
          page: page.url.pathname
        })
      });
      const d = await res.json();
      log = [...log, { role: d.ok ? 'assistant' : 'error', text: d.ok ? d.reply : d.error, needsToken: d.needsToken }];
    } catch {
      log = [...log, { role: 'error', text: 'Could not reach the assistant.' }];
    } finally {
      busy = false;
    }
  }
</script>

{#if enabled}
  <button class="fab" onclick={() => (open = !open)} aria-expanded={open}>
    {open ? '×' : 'assistant'}
  </button>
{/if}

{#if open}
  <div class="panel">
    <div class="tokenrow">
      {#if $token && !replacing}
        <label>
          Submission token
          <input type="password" value={$token} disabled />
        </label>
        <button type="button" class="link" onclick={() => (replacing = true)}>replace</button>
      {:else}
        <label>
          Submission token
          <input
            type="password"
            bind:value={draft}
            placeholder="paste it once"
            onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveToken(); } }}
          />
        </label>
        <button type="button" class="link" onclick={saveToken} disabled={!draft.trim()}>save</button>
        {#if $token}
          <button type="button" class="link" onclick={() => { replacing = false; draft = ''; }}>cancel</button>
        {/if}
      {/if}
    </div>
    {#if !$token}
      <p class="note">
        From the enrollment link you were emailed. The browser keeps it, and the submit
        form will not ask again on this computer.
      </p>
    {/if}

    <div class="log">
      {#each log as m}
        <div class="msg {m.role}">{m.text}</div>
      {/each}
      {#if busy}<div class="msg assistant dim">…</div>{/if}
    </div>
    <form onsubmit={(e) => { e.preventDefault(); send(); }}>
      <textarea
        bind:value={input}
        rows="2"
        placeholder="What are you stuck on?"
        onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
      ></textarea>
      <button type="submit" disabled={busy}>send</button>
    </form>
  </div>
{/if}

<style>
  .fab {
    position: fixed; right: 1.25rem; bottom: 1.25rem; z-index: 900;
    font: inherit; font-size: 0.72rem; padding: 0.5rem 0.85rem;
    background: var(--fg); color: var(--bg); border: 0; border-radius: 40px; cursor: pointer;
  }
  .fab:hover {
    background: var(--hi); color: var(--hi-fg);
  }
  .panel {
    position: fixed; right: 1.25rem; bottom: 4rem; z-index: 900;
    width: min(380px, calc(100vw - 2.5rem)); max-height: 60vh;
    display: flex; flex-direction: column;
    background: var(--bg); color: var(--fg); border: 1px solid var(--rule); padding: 0.9rem;
  }
  .note { font-size: 0.62rem; color: var(--fg-dim); line-height: 1.5; margin: 0 0 0.75rem; }
  .tokenrow { display: flex; align-items: flex-end; gap: 0.4rem; margin-bottom: 0.75rem; }
  .tokenrow label {
    flex: 1; display: flex; flex-direction: column; gap: 0.25rem;
    font-size: 0.62rem; color: var(--fg-dim);
  }
  .tokenrow input {
    font: inherit; font-size: 0.7rem; padding: 0.3rem;
    border: 1px solid var(--rule); background: var(--code-bg); color: var(--fg);
  }
  /* Set and greyed out, which is the whole point of leaving it on screen: a
     student can see at a glance that the browser still has their token. */
  .tokenrow input:disabled { color: var(--fg-dim); opacity: 0.55; cursor: not-allowed; }
  .link {
    font: inherit; font-size: 0.62rem; padding: 0.3rem 0.1rem;
    background: none; border: 0; color: var(--fg-dim);
    text-decoration: underline; cursor: pointer;
  }
  .link:hover:not(:disabled) { color: var(--hi); }
  .link:disabled { opacity: 0.4; cursor: not-allowed; text-decoration: none; }
  .log { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.75rem; }
  .msg { line-height: 1.6; white-space: pre-wrap; }
  .msg.user { color: var(--fg); font-weight: 700; }
  .msg.assistant { color: var(--fg-dim); }
  .msg.error { color: var(--hi); }
  .dim { color: var(--fg-dim); }
  form { display: flex; gap: 0.4rem; margin-top: 0.75rem; }
  textarea { flex: 1; font: inherit; font-size: 0.75rem; padding: 0.4rem; border: 1px solid var(--rule); background: var(--code-bg); color: var(--fg); resize: none; }
  form button { font: inherit; font-size: 0.7rem; padding: 0 0.7rem; background: var(--fg); color: var(--bg); border: 0; cursor: pointer; }
  form button:hover { background: var(--hi); color: var(--hi-fg); }
</style>
