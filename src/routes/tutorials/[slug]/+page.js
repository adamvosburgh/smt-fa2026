import { error } from '@sveltejs/kit';
import { collection, doc, isLive, pendingLabel, publishDate, publishWeekday } from '$lib/content.js';

// Every slug is an entry, published or not, so that a syllabus link clicked
// early lands on the "publishes on" page rather than a 404. The load below is
// what keeps unpublished prose off the site.
export function entries() {
  return collection('tutorials', { all: true }).map((d) => ({ slug: d.slug }));
}

export function load({ params }) {
  const d = doc('tutorials', params.slug);
  if (!d) error(404, 'not found');
  if (!isLive(d)) {
    return {
      doc: null,
      // A date to wait for, or no date at all - a decision rather than a clock.
      publishes: d.publish ? { date: publishDate(d), weekday: publishWeekday(d) } : null,
      title: d.title
    };
  }
  return { doc: d, pending: pendingLabel(d), title: d.title };
}
