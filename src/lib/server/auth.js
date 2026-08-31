// Per-student tokens. No accounts, no OAuth, no passwords.
//
// A token is 32 random bytes, issued once at the start of the semester, pasted
// into the site once, and kept in localStorage. We store only the SHA-256 of it,
// so var/tokens.json leaking does not hand anyone a working token.
//
// The important property is not that the token is secret. It is that the token
// *is* the identity: the server derives the submission path from the token and
// ignores whatever `student` the client sent. A stolen token can overwrite that
// one student's own work and nothing else - not site code, not another student.
import { createHash, timingSafeEqual } from 'node:crypto';
import { read } from './store.js';

export function hashToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function constantTimeFind(hashes, target) {
  // Walk the whole list regardless of where the match is.
  let found = null;
  const t = Buffer.from(target, 'hex');
  for (const [h, rec] of hashes) {
    const b = Buffer.from(h, 'hex');
    if (b.length === t.length && timingSafeEqual(b, t)) found = rec;
  }
  return found;
}

export function bearer(request) {
  const h = request.headers.get('authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}

export async function identify(request) {
  const token = bearer(request);
  if (!token) return { kind: 'anonymous' };
  const table = await read('tokens.json', { tokens: {} });
  const rec = constantTimeFind(Object.entries(table.tokens), hashToken(token));
  if (!rec || rec.revoked) return { kind: 'anonymous' };
  return { kind: 'student', student: rec.student, name: rec.name ?? rec.student };
}

// Same-origin check. Trivially spoofable by a script and worth almost nothing
// against a determined caller - but it costs nothing and it stops the casual
// case of someone embedding these endpoints in their own page.
export function sameOrigin(request, origin) {
  const o = request.headers.get('origin');
  if (!o) return true; // non-browser callers; the token and quota still apply
  try {
    return new URL(o).host === new URL(origin).host;
  } catch {
    return false;
  }
}
