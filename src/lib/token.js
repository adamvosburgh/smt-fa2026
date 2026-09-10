// The student's submission token. Pasted once, kept in localStorage, sent as a
// bearer token on submit and on assistant calls. No accounts, no passwords.
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const KEY = 'smt.token';

// A browser set to block site data throws on every localStorage access, so both
// sides of this are wrapped: without the guard one privacy setting takes down
// every page on the site, not just the submit form. The cost of failing this
// way is that the token is asked for again on each visit.
function load() {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

const initial = browser ? load() : '';

export const token = writable(initial);

if (browser) {
  token.subscribe((v) => {
    try {
      if (v) localStorage.setItem(KEY, v);
      else localStorage.removeItem(KEY);
    } catch {
      // Nothing to do: the token still works for this page load.
    }
  });
}
