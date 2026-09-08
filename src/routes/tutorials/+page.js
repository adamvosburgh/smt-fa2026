import { collection, pendingLabel } from '$lib/content.js';

// `collection` already drops anything held back, so the only items carrying a
// `pending` tag are the ones SMT_SHOW_UNPUBLISHED=1 let through.
const tag = (d) => ({ ...d, pending: pendingLabel(d) });

export function load() {
  const all = collection('tutorials');
  // The weekly tutorials. The sandbox dev notes (`devnotes: true`) keep their
  // URLs - the build doctor's FAILURE_MAP points into them - but are reached
  // from each sandbox's page rather than listed here.
  return {
    items: all.filter((d) => d.devnotes !== true).map(tag),
    devnotes: all.filter((d) => d.devnotes === true),
    title: 'Tutorials'
  };
}
