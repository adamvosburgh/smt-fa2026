import { error } from '@sveltejs/kit';
import { all, one } from '$lib/submissions.js';
import { bySlug } from '$lib/sandboxes/index.js';

export function entries() {
  return all.map((s) => ({ student: s.student, sandbox: s.sandbox }));
}

export function load({ params }) {
  const sub = one(params.student, params.sandbox);
  if (!sub) error(404, 'not found');
  return { sub, meta: bySlug[params.sandbox], title: sub.title, showTitle: false, wide: true };
}
