import { error } from '@sveltejs/kit';
import { collection, doc } from '$lib/content.js';

export function entries() {
  return collection('assignments').map((d) => ({ slug: d.slug }));
}

export function load({ params }) {
  const d = doc('assignments', params.slug);
  if (!d) error(404, 'not found');
  return { doc: d, title: d.title };
}
