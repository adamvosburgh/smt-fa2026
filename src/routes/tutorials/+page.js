import { collection, pendingLabel } from '$lib/content.js';

// `collection` already drops anything held back, so the only items carrying a
// `pending` tag are the ones SMT_SHOW_UNPUBLISHED=1 let through.
const tag = (d) => ({ ...d, pending: pendingLabel(d) });

export function load() {
  const all = collection('tutorials');
  // The weekly tutorials only. The sandbox dev notes are archived
  // (archive/devnotes/) and never listed here.
  return {
    items: all.filter((d) => d.devnotes !== true).map(tag),
    title: 'Tutorials'
  };
}
