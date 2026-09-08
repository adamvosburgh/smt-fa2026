import { error } from '@sveltejs/kit';
import { collection, doc } from '$lib/content.js';
import { bySandbox } from '$lib/submissions.js';

export function entries() {
  return collection('assignments').map((d) => ({ slug: d.slug }));
}

export function load({ params }) {
  const d = doc('assignments', params.slug);
  if (!d) error(404, 'not found');
  // What's been handed in for this assignment so far. Only assignments that
  // take uploads (`submit: true`) collect anything here.
  return { doc: d, submissions: d.submit ? bySandbox(params.slug) : [], title: d.title };
}
