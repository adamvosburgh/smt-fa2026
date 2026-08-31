// Writes a submission to disk, and optionally commits it.
//
// The path is derived from the authenticated token, never from the request. A
// student token can write under submissions/<their-slug>/<sandbox>/ and nowhere
// else - not site code, not another student's folder. That containment is the
// actual security control here; the token being secret is secondary.
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { config } from './config.js';

const run = promisify(execFile);
const SLUG = /^[a-z0-9-]+$/;

export function submissionDir(student, sandbox) {
  if (!SLUG.test(student) || !SLUG.test(sandbox)) throw new Error('illegal slug');
  return path.join(config.submissionsDir, student, sandbox);
}

export async function write({ student, sandbox, manifest, files }) {
  const dir = submissionDir(student, sandbox);
  // Replace wholesale: a resubmission is the new state, not a merge.
  await rm(path.join(dir, 'assets'), { recursive: true, force: true });
  await mkdir(path.join(dir, 'assets'), { recursive: true });

  for (const f of files) {
    const rel = f.path.replace(/\\/g, '/');
    const dest = path.resolve(dir, rel);
    // Belt and braces: even after validation, refuse anything that resolves out.
    if (!dest.startsWith(path.resolve(dir) + path.sep)) throw new Error('path escape');
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, f.buffer);
  }
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
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
