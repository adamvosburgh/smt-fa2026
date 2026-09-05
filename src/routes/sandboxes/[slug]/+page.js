import { error } from '@sveltejs/kit';
import { allSandboxes, bySlug } from '$lib/sandboxes/index.js';
import { bySandbox } from '$lib/submissions.js';

// Hidden sandboxes still render (as NotBuilt) - their slugs are in old build
// docs, so they must not 404.
export function entries() {
  return allSandboxes.map((s) => ({ slug: s.slug }));
}

export function load({ params }) {
  const meta = bySlug[params.slug];
  if (!meta) error(404, 'no such sandbox');
  return {
    meta,
    submissions: bySandbox(params.slug),
    title: meta.title,
    showTitle: false,
    wide: 'full'
  };
}
