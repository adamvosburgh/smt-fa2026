import { error } from '@sveltejs/kit';
import { all, one } from '$lib/submissions.js';
import { bySlug } from '$lib/sandboxes/index.js';
import { doc } from '$lib/content.js';

export function entries() {
  return all.map((s) => ({ student: s.student, sandbox: s.sandbox }));
}

export function load({ params }) {
  const sub = one(params.student, params.sandbox);
  if (!sub) error(404, 'not found');
  const isAssignment = sub.kind === 'assignment';
  return {
    sub,
    meta: isAssignment ? null : bySlug[params.sandbox],
    assignment: isAssignment ? doc('assignments', params.sandbox) : null,
    // An assignment that takes a .glb is run rather than shown: the page mounts
    // the sandbox named in the assignment's `sandbox_ref` on the student's own
    // model. Passed down whether or not this submission is one, because the
    // page decides from the file extension.
    modelSandbox: isAssignment
      ? (bySlug[doc('assignments', params.sandbox)?.sandbox_ref ?? 'sunlight'] ?? null)
      : null,
    title: sub.title,
    showTitle: false,
    wide: true
  };
}
