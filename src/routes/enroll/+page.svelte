<script>
  // The link mailed out at the start of the semester. The token rides in the
  // query string; this page checks it, hands it to the same localStorage the
  // submit form writes, and then takes it back out of the address bar so it is
  // not left sitting in browser history.
  //
  // Prerendered like every other page. The query string is read in the browser
  // at run time, so there is no server load here and the December freeze is
  // unaffected - in the archive build there is no /api, and the check fails
  // closed with a sentence saying so.
  import { onMount } from 'svelte';
  import { replaceState } from '$app/navigation';
  import { token } from '$lib/token.js';

  let state = $state('checking');
  let name = $state('');

  onMount(async () => {
    const url = new URL(location.href);
    const t = (url.searchParams.get('t') ?? '').trim();
    try {
      if (!t) { state = 'missing'; return; }
      const res = await fetch('/api/whoami', { headers: { authorization: `Bearer ${t}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { state = 'rejected'; return; }
      token.set(t);
      name = data.name || data.student;
      state = 'done';
    } catch {
      state = 'unreachable';
    } finally {
      // Take the token back out of the address bar. SvelteKit owns the history
      // stack, so this is its replaceState rather than the browser's; the
      // fallback is there because that one throws if the router is not up yet,
      // and this page is always somebody's first load.
      if (t) {
        url.searchParams.delete('t');
        const to = url.pathname + url.search + url.hash;
        try {
          replaceState(to, {});
        } catch {
          history.replaceState(null, '', to);
        }
      }
    }
  });
</script>

<div class="content-article">
  {#if state === 'checking'}
    <p>Checking&hellip;</p>
  {:else if state === 'done'}
    <p>Done, {name}. This browser now has your token, and the submit form will not ask for it again on this computer.</p>
    <p>
      If you switch computers, open the same link again. If you have lost the email, ask me and
      I will send a new one. Next: <a href="/tutorials/01-setting-up/">Tutorial 1</a>.
    </p>
  {:else if state === 'missing'}
    <p>
      This page needs the link from your email - the whole thing, including everything after the
      question mark. If your mail client cut it short, copy the address by hand and paste it into
      the address bar.
    </p>
  {:else if state === 'rejected'}
    <p>
      That token was not recognized. The usual cause is a link broken across two lines in an
      email. Try copying the whole address by hand; if it still fails, ask me and I will issue a
      new one.
    </p>
  {:else}
    <p>The site could not check the token just now. Reload the page in a minute.</p>
  {/if}
</div>
