// A board's uploaded files, read from disk. Copied from the submissions file
// route. In archive mode the same files are served from static/boards/ and this
// route is not built.
import { error } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { identify } from '$lib/server/auth.js';
import { SLUG, ASSET_FILE } from '$lib/board/model.js';
import { assetsDir, unauthorized } from '$lib/server/boards.js';

const TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4'
};

export async function GET({ params, request }) {
  const who = await identify(request);
  if (who.kind !== 'student') return unauthorized();
  const { slug, file } = params;
  if (!SLUG.test(slug) || !ASSET_FILE.test(file)) error(404, 'not found');

  const dir = path.resolve(assetsDir(slug));
  const target = path.resolve(dir, file);
  if (!target.startsWith(dir + path.sep)) error(404, 'not found');

  let s;
  try {
    s = await stat(target);
  } catch {
    error(404, 'not found');
  }
  if (!s.isFile()) error(404, 'not found');

  // A board asset is never replaced in place - a new upload gets a new id - so
  // the browser can keep it for a day.
  const modified = new Date(Math.floor(s.mtimeMs / 1000) * 1000);
  const headers = {
    'last-modified': modified.toUTCString(),
    'cache-control': 'private, max-age=86400',
    'x-content-type-options': 'nosniff'
  };
  const since = Date.parse(request.headers.get('if-modified-since') ?? '');
  if (!Number.isNaN(since) && since >= modified.getTime()) {
    return new Response(null, { status: 304, headers });
  }

  const type = TYPES[path.extname(target).toLowerCase()] ?? 'application/octet-stream';
  return new Response(Readable.toWeb(createReadStream(target)), {
    headers: { ...headers, 'content-type': type, 'content-length': String(s.size) }
  });
}
