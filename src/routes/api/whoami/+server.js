// Who a token belongs to.
//
// The enrollment link is the only thing that calls this. It exists so a link
// that has been mangled in transit fails on the spot, with a sentence, instead
// of putting a broken string into localStorage that only surfaces weeks later
// as a refused submission.
//
// No same-origin check: this hands back nothing the caller did not already
// have, and it neither writes anything nor spends anything.
import { json } from '@sveltejs/kit';
import { identify } from '$lib/server/auth.js';

export async function GET({ request }) {
  const who = await identify(request);
  if (who.kind !== 'student') return json({ ok: false }, { status: 401 });
  return json({ ok: true, student: who.student, name: who.name, role: who.role }, {
    headers: { 'cache-control': 'no-store' }
  });
}
