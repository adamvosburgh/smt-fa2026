// One board. `?since=<version>` answers { version, unchanged: true } when the
// caller is already up to date, which is what the polling fallback in
// src/lib/board/transport.js would lean on.
import { identify } from '$lib/server/auth.js';
import { get, reply, unauthorized, notFound } from '$lib/server/boards.js';

export async function GET({ params, request, url }) {
  const who = await identify(request);
  if (who.kind !== 'student') return unauthorized();
  const board = await get(params.slug);
  if (!board) return notFound();
  const since = url.searchParams.get('since');
  if (since !== null && Number(since) === board.version) {
    return reply({ version: board.version, unchanged: true });
  }
  return reply(board);
}
