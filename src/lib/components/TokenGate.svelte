<script>
  // The whiteboard pages' token row, copied from Assistant.svelte. Shown when
  // the browser has no token, or has one the server turned down.
  import { token } from '$lib/token.js';
  let { rejected = false } = $props();

  let replacing = $state(false);
  let draft = $state('');

  function save() {
    const t = draft.trim();
    if (!t) return;
    token.set(t);
    draft = '';
    replacing = false;
  }
</script>

<div class="gate">
  <p class="line">This page needs your submission token.</p>
  <div class="tokenrow">
    {#if $token && !replacing && !rejected}
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
          onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
        />
      </label>
      <button type="button" class="link" onclick={save} disabled={!draft.trim()}>save</button>
      {#if $token && replacing}
        <button type="button" class="link" onclick={() => { replacing = false; draft = ''; }}>cancel</button>
      {/if}
    {/if}
  </div>
  <p class="note">From the enrollment link you were emailed. The browser keeps it.</p>
</div>

<style>
  .gate { max-width: 420px; }
  .line { font-size: 0.9rem; margin: 0 0 1rem; }
  .note { font-size: 0.62rem; color: var(--fg-dim); line-height: 1.5; margin: 0.5rem 0 0; }
  .tokenrow { display: flex; align-items: flex-end; gap: 0.4rem; }
  .tokenrow label {
    flex: 1; display: flex; flex-direction: column; gap: 0.25rem;
    font-size: 0.62rem; color: var(--fg-dim);
  }
  .tokenrow input {
    font: inherit; font-size: 0.7rem; padding: 0.3rem;
    border: 1px solid var(--rule); background: var(--code-bg); color: var(--fg);
  }
  .tokenrow input:disabled { color: var(--fg-dim); opacity: 0.55; cursor: not-allowed; }
  .link {
    font: inherit; font-size: 0.62rem; padding: 0.3rem 0.1rem;
    background: none; border: 0; color: var(--fg-dim);
    text-decoration: underline; cursor: pointer;
  }
  .link:hover:not(:disabled) { color: var(--hi); }
  .link:disabled { opacity: 0.4; cursor: not-allowed; text-decoration: none; }
</style>
