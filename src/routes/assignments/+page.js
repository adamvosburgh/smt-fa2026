import { collection } from '$lib/content.js';
export function load() {
  return { items: collection('assignments'), title: 'Assignments' };
}
