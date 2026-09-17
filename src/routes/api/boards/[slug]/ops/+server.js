// Changes to a board: { ops: [...], cid }. `cid` is the sending tab's random
// id, so the stream can leave that tab out of what it already drew.
import { identify, sameOrigin } from '$lib/server/auth.js';
import { config } from '$lib/server/config.js';
import { LIMITS } from '$lib/board/model.js';
import { apply, allow, reply, unauthorized, badOrigin, notFound } from '$lib/server/boards.js';

const CID = /^[a-z0-9]{6,20}$/;

export async function POST({ params, request }) {
  if (!sameOrigin(request, config.origin)) return badOrigin();
  const who = await identify(request);
  if (who.kind !== 'student') return unauthorized();
  if (!allow(request, 'ops')) return new Response(null, { status: 429 });

  let body;
  try {
    body = await request.json();
  } catch {
    return reply({ ok: false, error: 'bad json' }, 400);
  }
  const ops = body?.ops;
  if (!Array.isArray(ops) || !ops.length || ops.length > LIMITS.opsPerRequest) {
    return reply({ ok: false, error: 'bad ops' }, 400);
  }
  const cid = typeof body.cid === 'string' && CID.test(body.cid) ? body.cid : null;

  const r = await apply(params.slug, ops, who, cid);
  if (!r) return notFound();
  if (r.rejected.length) {
    // The first refusal written as a sentence for a person (locked, full), if
    // any. The rest are races the client settles by refetching, with no toast.
    const error = r.rejected.find((x) => x.error.endsWith('.'))?.error ?? null;
    return reply({ ok: false, ...r, error }, 409);
  }
  return reply({ ok: true, ...r });
}
