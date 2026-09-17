// The owner's "add new submissions" button: runs the assignment board generator
// by hand. Same thing the ticker and a late submission run; idempotent.
import { identify, sameOrigin } from '$lib/server/auth.js';
import { config } from '$lib/server/config.js';
import { doc } from '$lib/content.js';
import { buildAssignmentBoard } from '$lib/server/board-generate.js';
import { reply, unauthorized, badOrigin, notFound, MESSAGES } from '$lib/server/boards.js';

export async function POST({ params, request }) {
  if (!sameOrigin(request, config.origin)) return badOrigin();
  const who = await identify(request);
  if (who.kind !== 'student') return unauthorized();
  if (who.role !== 'owner') return reply({ ok: false, error: MESSAGES.notOwner }, 403);
  const a = doc('assignments', params.slug);
  if (!a || a.submit !== true) return notFound();
  const r = await buildAssignmentBoard(params.slug);
  console.log(`boards: ${who.student} ran the generator on ${params.slug} (${r.added} added)`);
  return reply({ ok: true, ...r });
}
