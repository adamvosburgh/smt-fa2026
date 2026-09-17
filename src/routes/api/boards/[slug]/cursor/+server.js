// Where someone's pointer is, in board units. Passed on to everyone else on the
// board and never stored. { x: null, y: null } means it left the board.
import { identify, sameOrigin } from '$lib/server/auth.js';
import { config } from '$lib/server/config.js';
import { SLUG } from '$lib/board/model.js';
import { broadcast, allow, unauthorized, badOrigin } from '$lib/server/boards.js';

const CID = /^[a-z0-9]{6,20}$/;
const coord = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : null);

export async function POST({ params, request }) {
  if (!sameOrigin(request, config.origin)) return badOrigin();
  const who = await identify(request);
  if (who.kind !== 'student') return unauthorized();
  if (!SLUG.test(params.slug)) return new Response(null, { status: 404 });
  if (!allow(request, 'cursor')) return new Response(null, { status: 429 });

  let body = {};
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const cid = typeof body.cid === 'string' && CID.test(body.cid) ? body.cid : null;
  broadcast(
    params.slug,
    'cursor',
    { student: who.student, name: who.name, cid, x: coord(body.x), y: coord(body.y) },
    cid
  );
  return new Response(null, { status: 204 });
}
