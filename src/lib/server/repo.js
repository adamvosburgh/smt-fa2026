// Writes a submission to disk, and optionally commits it.
//
// The path is derived from the authenticated token, never from the request. A
// student token can write under submissions/<their-slug>/<sandbox>/ and nowhere
// else - not site code, not another student's folder. That containment is the
// actual security control here; the token being secret is secondary.
import { mkdir, writeFile, rm, rename, readdir, readFile } from 'node:fs/promises';
import { renderPdf } from './pdf-pages.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { config } from './config.js';
import { SHOW_UNPUBLISHED } from '$lib/visibility.js';
import { withoutPrivateAnswers } from '$lib/submissions.js';

const run = promisify(execFile);
const SLUG = /^[a-z0-9-]+$/;

export function submissionDir(student, sandbox) {
  if (!SLUG.test(student) || !SLUG.test(sandbox)) throw new Error('illegal slug');
  return path.join(config.submissionsDir, student, sandbox);
}

export async function write({ student, sandbox, manifest, files, cover = null }) {
  const dir = submissionDir(student, sandbox);
  // Replace wholesale: a resubmission is the new state, not a merge.
  await rm(path.join(dir, 'assets'), { recursive: true, force: true });
  await rm(path.join(dir, 'pages'), { recursive: true, force: true });
  for (const old of ['cover.png', 'cover.jpg']) await rm(path.join(dir, old), { force: true });
  await mkdir(path.join(dir, 'assets'), { recursive: true });

  for (const f of files) {
    const rel = f.path.replace(/\\/g, '/');
    const dest = path.resolve(dir, rel);
    // Belt and braces: even after validation, refuse anything that resolves out.
    if (!dest.startsWith(path.resolve(dir) + path.sep)) throw new Error('path escape');
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, f.buffer);
  }
  // Assignment uploads arrive with their own cover, a JPEG drawn in the browser
  // from the uploaded image, and the manifest says so. The browser can't draw a
  // PDF, so for one of those the pages are rendered here instead: the first is
  // the cover, and a PDF of two or more pages keeps them all under pages/ (see
  // pdf-pages.js). Sandbox submissions get a cover.png from `npm run covers`,
  // which screenshots the gallery page; that script also covers an assignment
  // whose primary is an HTML file.
  delete manifest.pages;
  delete manifest.page_count;
  if (manifest.kind === 'assignment' && /\.pdf$/i.test(manifest.primary ?? '')) {
    const r = await renderPdf(path.resolve(dir, manifest.primary), dir);
    cover ??= r.cover;
    if (r.pages.length) {
      manifest.pages = r.pages;
      manifest.page_count = r.count;
    }
  }
  if (cover) {
    await writeFile(path.join(dir, 'cover.jpg'), cover);
    manifest.cover_file = 'cover.jpg';
  } else {
    delete manifest.cover_file;
  }
  // The manifest goes last, and by rename, because /api/submissions reads these
  // folders live: a half-written manifest would drop the submission from the
  // gallery for as long as the write takes.
  const tmp = path.join(dir, 'manifest.json.tmp');
  await writeFile(tmp, JSON.stringify(manifest, null, 2));
  await rename(tmp, path.join(dir, 'manifest.json'));
  return dir;
}

export async function commit(dir, message) {
  if (!config.gitCommit) return { committed: false, reason: 'SMT_GIT_COMMIT is not true' };
  await run('git', ['add', '--', dir]);
  await run('git', ['commit', '-m', message, '--', dir]);
  await run('git', ['push', 'origin', config.gitBranch]);
  return { committed: true };
}

export async function writeReview(dir, review) {
  await writeFile(path.join(dir, 'review.json'), JSON.stringify(review, null, 2));
}

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

// Every submission on disk, as { student, sandbox, manifest, review }. Read by
// /api/submissions and by the whiteboard generator, which must not go through
// HTTP to get the same list.
export async function listSubmissions() {
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
      rows.push({
        student,
        sandbox,
        manifest: withoutPrivateAnswers(manifest, sandbox),
        review: await readJson(path.join(dir, 'review.json'))
      });
    }
  }
  return rows;
}
