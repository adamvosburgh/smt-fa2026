import { MODE } from '$lib/data.js';
import { boards } from '$lib/boards.js';

// Boards are live state in live mode, listed in the browser with the token, so
// this page is rendered per request there and prerendered only for the archive.
export const prerender = MODE === 'archive';

export async function load({ fetch }) {
  return {
    title: 'Whiteboard',
    wide: true,
    boards: MODE === 'archive' ? await boards(fetch) : null
  };
}
