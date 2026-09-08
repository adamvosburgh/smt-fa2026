import { collection, pendingLabel } from '$lib/content.js';

export function load() {
  const items = collection('assignments').map((d) => ({ ...d, pending: pendingLabel(d) }));
  return { items, title: 'Assignments' };
}
