// Board files in the live site sit behind the token, and an <img src> cannot
// send an authorization header. So the canvas fetches each one with the token
// and draws it from a blob URL. The browser's HTTP cache still applies (the
// route sends max-age), and this keeps one blob URL per file for the page.
//
// In the archive there is no token and no route: the files are plain static
// files, so the URL is used as it is. Tile covers are public in both modes.
import { MODE } from '$lib/data.js';

/** @type {Map<string, Promise<string|null>>} */
const cache = new Map();

export const needsToken = (url) => MODE !== 'archive' && typeof url === 'string' && url.startsWith('/api/boards/');

export function loadAsset(url, token) {
  if (!needsToken(url)) return Promise.resolve(url);
  if (!cache.has(url)) {
    const p = fetch(url, { headers: { authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => (blob ? URL.createObjectURL(blob) : null))
      .catch(() => null);
    cache.set(url, p);
    // A failure is not remembered, so a later render can try again.
    p.then((u) => { if (!u) cache.delete(url); });
  }
  return cache.get(url);
}
