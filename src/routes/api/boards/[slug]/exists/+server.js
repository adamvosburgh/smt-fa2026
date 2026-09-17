// Whether a board is there. No token and no body: the assignment page calls
// this to decide whether to show its board link, and a yes or no about a slug
// that is the assignment's own tells nobody anything.
import { exists } from '$lib/server/boards.js';

export async function GET({ params }) {
  const status = (await exists(params.slug)) ? 204 : 404;
  return new Response(null, { status, headers: { 'cache-control': 'no-store' } });
}
