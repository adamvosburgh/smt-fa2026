// Live-mode submission list. Reads the submission folders from disk on every
// request, so a new submission is on the site as soon as /api/submit has
// written it. In archive mode src/lib/submissions.js globs the same manifests
// at build time instead and this route is not built.
import { json } from '@sveltejs/kit';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '$lib/server/config.js';
import { SHOW_UNPUBLISHED } from '$lib/visibility.js';

const SLUG = /^[a-z0-9-]+$/;

async function folders(dir) {
  try {
    return (await readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && SLUG.test(e.name))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

export async function GET() {
  const root = config.submissionsDir;
  const rows = [];
  for (const student of await folders(root)) {
    for (const sandbox of await folders(path.join(root, student))) {
      const dir = path.join(root, student, sandbox);
      const manifest = await readJson(path.join(dir, 'manifest.json'));
      if (!manifest) continue;
      // Held-back submissions are dropped here, not in the browser, so they are
      // never sent at all.
      if (!SHOW_UNPUBLISHED && manifest.published === false) continue;
      rows.push({ student, sandbox, manifest, review: await readJson(path.join(dir, 'review.json')) });
    }
  }
  return json(rows, { headers: { 'cache-control': 'no-store' } });
}
