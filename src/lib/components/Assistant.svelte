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
      log = [...log, { role: d.ok ? 'assistant' : 'error', text: d.ok ? d.reply : d.error }];
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
    <p class="note">
      Additive, not required - every tutorial stands on its own. The prompt this runs
      on is <a href="/resources/assistant/">published</a>, and conversations are logged
      so I can see which sections keep tripping people up.
    </p>
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
    background: #000; color: #fff; border: 0; border-radius: 40px; cursor: pointer;
  }
  .panel {
    position: fixed; right: 1.25rem; bottom: 4rem; z-index: 900;
    width: min(380px, calc(100vw - 2.5rem)); max-height: 60vh;
    display: flex; flex-direction: column;
    background: #fff; border: 1px solid #000; padding: 0.9rem;
  }
  .note { font-size: 0.62rem; color: #888; line-height: 1.5; margin: 0 0 0.75rem; }
  .log { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.75rem; }
  .msg { line-height: 1.6; white-space: pre-wrap; }
  .msg.user { color: #000; font-weight: 700; }
  .msg.assistant { color: #333; }
  .msg.error { color: #a00; }
  .dim { color: #ccc; }
  form { display: flex; gap: 0.4rem; margin-top: 0.75rem; }
  textarea { flex: 1; font: inherit; font-size: 0.75rem; padding: 0.4rem; border: 1px solid #ccc; resize: none; }
  form button { font: inherit; font-size: 0.7rem; padding: 0 0.7rem; background: #000; color: #fff; border: 0; cursor: pointer; }
</style>
