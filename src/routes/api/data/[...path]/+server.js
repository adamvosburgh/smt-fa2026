// Live-mode data source. In archive mode the sandboxes read /data/<...> as plain
// static files instead and this route is not built at all.
//
// Only the studio twin actually needs a live source. Everything else is static
// from day one, and passes straight through to the same files the archive
// serves - which is how we know the archive build works before December.
import { error } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

const TYPES = {
  '.json': 'application/json',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary',
  '.3dm': 'application/octet-stream'
};

export async function GET({ params }) {
  const rel = params.path;
  if (!/^[A-Za-z0-9._\-/]+$/.test(rel) || rel.includes('..')) error(400, 'bad path');

  // TODO(studio-twin): intercept here and serve the rolling sensor store
  // instead of a file. Everything else falls through.

  const file = path.resolve('static/data', rel);
  if (!file.startsWith(path.resolve('static/data') + path.sep)) error(400, 'bad path');
  try {
    const s = await stat(file);
    return new Response(Readable.toWeb(createReadStream(file)), {
      headers: {
        'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
        'content-length': String(s.size),
        'cache-control': 'public, max-age=300'
      }
    });
  } catch {
    error(404, 'no such data file');
  }
}
