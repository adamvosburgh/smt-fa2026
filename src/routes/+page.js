import { syllabus } from '$lib/content.js';
export function load() {
  const doc = syllabus();
  return { doc, showTitle: false };
}
