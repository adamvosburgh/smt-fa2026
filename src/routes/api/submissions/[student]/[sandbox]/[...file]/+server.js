// Live-mode submission files: the cover and the uploaded assets, read from disk
// on every request. In archive mode the same files are served from
// static/submissions/ and this route is not built.
import { error } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { submissionDir } from '$lib/server/repo.js';

const TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.html': 'text/html; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.json': 'application/json'
};

// Only the cover, a PDF's rendered pages, and what is under assets/. The
// manifest and review are read through /api/submissions, which applies
// `published: false`.
const FILE = /^(cover\.(jpg|png)|pages\/\d+\.jpg|assets\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*)$/;

export async function GET({ params, request }) {
  const { student, sandbox, file } = params;
  if (!FILE.test(file) || file.split('/').some((s) => s === '.' || s === '..')) error(404, 'not found');

  let dir;
  try {
    dir = path.resolve(submissionDir(student, sandbox));
  } catch {
    error(404, 'not found');
  }
  const target = path.resolve(dir, file);
  if (!target.startsWith(dir + path.sep)) error(404, 'not found');

  let s;
  try {
    s = await stat(target);
  } catch {
    error(404, 'not found');
  }
  if (!s.isFile()) error(404, 'not found');

  // A resubmission replaces the files in place, so the browser revalidates
  // every time rather than keeping an old cover.
  const modified = new Date(Math.floor(s.mtimeMs / 1000) * 1000);
  const headers = {
    'last-modified': modified.toUTCString(),
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff'
  };
  const since = Date.parse(request.headers.get('if-modified-since') ?? '');
  if (!Number.isNaN(since) && since >= modified.getTime()) {
    return new Response(null, { status: 304, headers });
  }

  const type = TYPES[path.extname(target).toLowerCase()] ?? 'application/octet-stream';
  // A student's HTML runs in a sandboxed frame on the gallery page. Opened
  // directly ("Open full screen"), this header gives it the same sandbox, so it
  // can't read the submission token out of this origin's localStorage.
  if (type.startsWith('text/html')) headers['content-security-policy'] = 'sandbox allow-scripts';

  return new Response(Readable.toWeb(createReadStream(target)), {
    headers: { ...headers, 'content-type': type, 'content-length': String(s.size) }
  });
}
