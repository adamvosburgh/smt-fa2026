import { error } from '@sveltejs/kit';
import { allSandboxes, bySlug } from '$lib/sandboxes/index.js';
import { bySandbox } from '$lib/submissions.js';
import { doc, isLive } from '$lib/content.js';
import { isPublished } from '$lib/visibility.js';
import { MODE } from '$lib/data.js';

// Submissions are read at request time in live mode, so this page is rendered
// per request there and prerendered only for the archive.
export const prerender = MODE === 'archive';

// Hidden sandboxes still render (as NotBuilt) - their slugs are in old build
// docs, so they must not 404.
export function entries() {
  return allSandboxes.map((s) => ({ slug: s.slug }));
}

export async function load({ params, fetch }) {
  const meta = bySlug[params.slug];
  if (!meta) error(404, 'no such sandbox');

  // A sandbox held back keeps its URL - links elsewhere may name these slugs,
  // so they must not 404 - but does not mount. The page says so and shows the
  // status note, which is where the reason is written.
  if (!isPublished(meta)) {
    return {
      meta,
      unpublished: true,
      tutorial: null,
      submissions: [],
      title: meta.title,
      showTitle: false,
      wide: 'full'
    };
  }
  // The dev notes link only when the dev note is on the site. They are held
  // back at the moment, and a link to a page that answers "not published yet"
  // is worse than no link.
  const notes = meta.tutorial ? doc('tutorials', meta.tutorial.split('/').filter(Boolean).pop()) : null;
  return {
    meta,
    tutorial: notes && isLive(notes) ? meta.tutorial : null,
    submissions: await bySandbox(fetch, params.slug),
    title: meta.title,
    showTitle: false,
    wide: 'full'
  };
}
