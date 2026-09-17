// Live-mode submission list. Reads the submission folders from disk on every
// request, so a new submission is on the site as soon as /api/submit has
// written it. In archive mode src/lib/submissions.js globs the same manifests
// at build time instead and this route is not built.
import { json } from '@sveltejs/kit';
import { listSubmissions } from '$lib/server/repo.js';

export async function GET() {
  return json(await listSubmissions(), { headers: { 'cache-control': 'no-store' } });
}
