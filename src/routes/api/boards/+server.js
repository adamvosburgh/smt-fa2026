// The board index, and creating a board. Only the owner creates; anyone with a
// token lists. See src/lib/server/boards.js.
import { identify, sameOrigin } from '$lib/server/auth.js';
import { config } from '$lib/server/config.js';
import { doc } from '$lib/content.js';
import { list, create, slugify, reply, unauthorized, badOrigin, MESSAGES } from '$lib/server/boards.js';

export async function GET({ request }) {
  const who = await identify(request);
  if (who.kind !== 'student') return unauthorized();
  return reply(await list());
}

export async function POST({ request }) {
  if (!sameOrigin(request, config.origin)) return badOrigin();
  const who = await identify(request);
  if (who.kind !== 'student') return unauthorized();
  if (who.role !== 'owner') return reply({ ok: false, error: MESSAGES.notOwner }, 403);

  let body = {};
  try {
    body = await request.json();
  } catch {
    // Falls through to the missing-title message.
  }
  const title = String(body.title ?? '').trim().slice(0, 140);
  const slug = slugify(title);
  if (!title || !slug) return reply({ ok: false, error: MESSAGES.noTitle }, 422);

  const kind = body.kind === 'assignment' ? 'assignment' : 'exercise';
  // An assignment board is tied to an assignment only when the slug is one.
  const assignment = kind === 'assignment' && doc('assignments', slug) ? slug : null;
  const r = await create({ slug, title, kind, assignment, by: who.student });
  if (!r.ok) return reply(r, 409);
  console.log(`boards: ${who.student} created ${slug}`);
  return reply({ ok: true, slug, href: `/whiteboard/${slug}/` }, 201);
}
