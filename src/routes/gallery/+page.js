import { submissions } from '$lib/submissions.js';
import { MODE } from '$lib/data.js';
import { collection, closesAt } from '$lib/content.js';
import { sandboxes } from '$lib/sandboxes/index.js';

// Submissions are read at request time in live mode, so this page is rendered
// per request there and prerendered only for the archive.
export const prerender = MODE === 'archive';

// Student Work is one page with a section per thing you can hand in: every
// assignment that takes uploads, in sequence, then every sandbox that has been
// forked. An assignment with nothing in it yet still gets its section, so the
// page reads as the semester's pin-up wall from week one. An assignment's
// section starts folded from the day after it is due; see closesAt.

export async function load({ fetch }) {
  const all = await submissions(fetch);
  const assignments = collection('assignments')
    .filter((a) => a.submit === true)
    .map((a) => ({
      id: a.slug,
      kind: 'assignment',
      title: a.title,
      sequence: a.sequence,
      href: a.url,
      due: a.due ?? null,
      closes: closesAt(a),
      items: all.filter((s) => s.sandbox === a.slug)
    }));
  const forks = sandboxes
    .map((sb) => ({
      id: sb.slug,
      kind: 'sandbox',
      title: sb.title,
      sequence: sb.number,
      href: `/sandboxes/${sb.slug}/`,
      items: all.filter((s) => s.sandbox === sb.slug && s.kind !== 'assignment')
    }))
    .filter((g) => g.items.length);
  return { sections: [...assignments, ...forks], title: 'Student Work' };
}
