import { error } from '@sveltejs/kit';
import { collection, doc, isLive, pendingLabel, publishDate, publishWeekday } from '$lib/content.js';
import { bySandbox } from '$lib/submissions.js';

// Every slug is an entry, published or not - see the tutorial route.
export function entries() {
  return collection('assignments', { all: true }).map((d) => ({ slug: d.slug }));
}

export function load({ params }) {
  const d = doc('assignments', params.slug);
  if (!d) error(404, 'not found');
  if (!isLive(d)) {
    return {
      doc: null,
      submissions: [],
      publishes: d.publish ? { date: publishDate(d), weekday: publishWeekday(d) } : null,
      title: d.title
    };
  }
  // What's been handed in for this assignment so far. Only assignments that
  // take uploads (`submit: true`) collect anything here.
  return {
    doc: d,
    submissions: d.submit ? bySandbox(params.slug) : [],
    pending: pendingLabel(d),
    title: d.title
  };
}
