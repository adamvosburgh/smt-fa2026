import { error } from '@sveltejs/kit';
import { submissions, one, promptPathOf } from '$lib/submissions.js';
import { MODE } from '$lib/data.js';
import { bySlug } from '$lib/sandboxes/index.js';
import { doc } from '$lib/content.js';

// Submissions are read at request time in live mode, so this page is rendered
// per request there and prerendered only for the archive.
export const prerender = MODE === 'archive';

// Only the archive build prerenders, and it reads the manifests without fetch.
// SvelteKit calls this while analysing the live build too, so it answers empty.
export async function entries() {
  if (MODE !== 'archive') return [];
  return (await submissions()).map((s) => ({ student: s.student, sandbox: s.sandbox }));
}

export async function load({ params, fetch }) {
  const sub = await one(fetch, params.student, params.sandbox);
  if (!sub) error(404, 'not found');
  const isAssignment = sub.kind === 'assignment';
  let promptText = null;
  const promptPath = promptPathOf(sub);
  if (isAssignment && promptPath) {
    try {
      const res = await fetch(`${sub.assetBase}${promptPath}`);
      if (res.ok) promptText = await res.text();
    } catch {}
  }
  return {
    sub,
    promptText,
    promptPath,
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
