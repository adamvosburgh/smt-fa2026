<script>
  import { token } from '$lib/token.js';
  let { meta, params, metrics, onclose } = $props();

  let title = $state('');
  let galleryText = $state('');
  let description = $state('');
  let files = $state([]);
  let result = $state(null);
  let busy = $state(false);

  async function submit() {
    busy = true;
    result = null;
    const fd = new FormData();
    fd.set(
      'manifest',
      JSON.stringify({
        sandbox: meta.slug,
        student: 'ignored-server-derives-this',
        title,
        gallery_text: galleryText,
        description,
        params,
        cover: params,
        app_version: meta.appVersion ?? '0.1.0'
      })
    );
    for (const f of files) fd.append('asset', f, f.name);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: $token ? { authorization: `Bearer ${$token}` } : {},
        body: fd
      });
      result = await res.json();
    } catch {
      result = { ok: false, error: 'Upload failed. Your work is not lost - try again.' };
    } finally {
      busy = false;
    }
  }
</script>

<div class="backdrop" onclick={onclose} role="presentation"></div>
<div class="dialog" role="dialog" aria-label="Submit">
  <h2>Submit — {meta.title}</h2>

  {#if !$token}
    <label>
      Submission token
      <input type="password" bind:value={$token} placeholder="paste it once" />
    </label>
    <p class="hint">You were given this at the start of the semester. The browser keeps it.</p>
  {/if}

  <label>Title<input bind:value={title} maxlength="140" /></label>
  <label>
    Gallery text
    <textarea bind:value={galleryText} rows="3" maxlength="600"
      placeholder="Two sentences. Text that might accompany a work of art."></textarea>
  </label>
  <label>
    Description
    <textarea bind:value={description} rows="5"
      placeholder="Longer text, annotations. What you changed and what it did."></textarea>
  </label>
  <label>
    Assets (50MB total)
    <input type="file" multiple onchange={(e) => (files = [...e.currentTarget.files])} />
  </label>

  <details>
    <summary>What gets sent</summary>
    <pre>{JSON.stringify({ params, metrics }, null, 2)}</pre>
  </details>

  {#if result}
    {#if result.ok}
      <p class="ok">Submitted. <a href={result.next}>See it</a>.</p>
    {:else if result.errors}
      <ul class="errs">
        {#each result.errors as e}
          <li>{e.message}{#if e.see} <a href={e.see}>Fix</a>{/if}</li>
        {/each}
      </ul>
    {:else}
      <p class="err">{result.error}</p>
    {/if}
  {/if}

  <div class="actions">
    <button type="button" onclick={onclose}>close</button>
    <button type="button" class="go" disabled={busy || !title || !galleryText} onclick={submit}>
      {busy ? 'sending…' : 'submit'}
    </button>
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 1100; }
  .dialog {
    position: fixed; z-index: 1101; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(520px, calc(100vw - 2rem)); max-height: 86vh; overflow-y: auto;
    background: #fff; border: 1px solid #000; padding: 1.5rem; font-size: 0.78rem;
  }
  h2 { font-size: 0.95rem; margin: 0 0 1.25rem; }
  label { display: block; margin-bottom: 0.9rem; font-size: 0.72rem; font-weight: 700; }
  input, textarea { display: block; width: 100%; font: inherit; font-size: 0.78rem; font-weight: 400;
    margin-top: 0.3rem; padding: 0.4rem; border: 1px solid #ccc; }
  .hint { font-size: 0.66rem; color: #888; margin: -0.5rem 0 1rem; }
  details { font-size: 0.7rem; color: #666; margin-bottom: 1rem; }
  pre { background: #f6f6f4; padding: 0.6rem; overflow-x: auto; font-size: 0.68rem; }
  .actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem; }
  .actions button { font: inherit; font-size: 0.72rem; padding: 0.45rem 0.9rem; border: 1px solid #000; background: #fff; cursor: pointer; }
  .actions .go { background: #000; color: #fff; }
  .ok { color: #060; }
  .err, .errs { color: #a00; }
  .errs { padding-left: 1.1rem; font-size: 0.72rem; }
</style>
