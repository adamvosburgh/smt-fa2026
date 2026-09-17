import { error } from '@sveltejs/kit';
import { MODE } from '$lib/data.js';
import { archivedSlugs, board } from '$lib/boards.js';

// A board is live state in live mode, fetched in the browser with the token,
// so this page is rendered per request there and prerendered only for the
// archive, where the board is baked in read-only.
export const prerender = MODE === 'archive';

export function entries() {
  return archivedSlugs().map((slug) => ({ slug }));
}

export async function load({ params, fetch }) {
  const page = { slug: params.slug, showTitle: false, wide: 'full' };
  if (MODE !== 'archive') return { ...page, board: null, title: params.slug };
  const b = await board(fetch, params.slug);
  if (!b) error(404, 'not found');
  return { ...page, board: b, title: b.title };
}
