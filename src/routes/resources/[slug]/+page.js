import { error } from '@sveltejs/kit';
import { collection, doc } from '$lib/content.js';

export function entries() {
  return collection('resources').map((d) => ({ slug: d.slug }));
}

export function load({ params }) {
  const d = doc('resources', params.slug);
  if (!d) error(404, 'not found');
  return { doc: d, title: d.title };
}
