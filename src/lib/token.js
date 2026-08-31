// The student's submission token. Pasted once, kept in localStorage, sent as a
// bearer token on submit and on assistant calls. No accounts, no passwords.
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const KEY = 'smt.token';
const initial = browser ? (localStorage.getItem(KEY) ?? '') : '';

export const token = writable(initial);

if (browser) {
  token.subscribe((v) => {
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  });
}
