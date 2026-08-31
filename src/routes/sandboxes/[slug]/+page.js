import { error } from '@sveltejs/kit';
import { sandboxes, bySlug } from '$lib/sandboxes/index.js';
import { bySandbox } from '$lib/submissions.js';

export function entries() {
  return sandboxes.map((s) => ({ slug: s.slug }));
}

export function load({ params }) {
  const meta = bySlug[params.slug];
  if (!meta) error(404, 'no such sandbox');
  return {
    meta,
    submissions: bySandbox(params.slug),
    title: meta.title,
    showTitle: false,
    wide: true
  };
}
