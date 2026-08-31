import { all } from '$lib/submissions.js';
export function load() {
  return { submissions: all, title: 'Student Work' };
}
