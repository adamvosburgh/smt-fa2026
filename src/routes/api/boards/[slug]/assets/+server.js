// Uploads to a board. Same multipart shape and the same cap as /api/submit, on
// purpose: `file` is the original, `display` an optional JPEG the browser drew
// from it (src/lib/draw-copy.js), so a phone photo does not have to be pulled
// down at full size by everyone looking at the board.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { identify, sameOrigin } from '$lib/server/auth.js';
import { config } from '$lib/server/config.js';
import { newId } from '$lib/board/model.js';
import { get, assetsDir, reply, unauthorized, badOrigin, notFound, MESSAGES } from '$lib/server/boards.js';

const EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4'];

// The extension is what the client says; the first bytes are what the file is.
function magicMatches(ext, b) {
  const at = (i, bytes) => bytes.every((v, k) => b[i + k] === v);
  const ascii = (i, s) => at(i, [...s].map((c) => c.charCodeAt(0)));
  switch (ext) {
    case 'png': return at(0, [0x89, 0x50, 0x4e, 0x47]);
    case 'jpg':
    case 'jpeg': return at(0, [0xff, 0xd8, 0xff]);
    case 'webp': return ascii(0, 'RIFF') && ascii(8, 'WEBP');
    case 'gif': return ascii(0, 'GIF8');
    case 'mp4': return ascii(4, 'ftyp');
    default: return false;
  }
}

const tooBig = (bytes) =>
  `That file is ${(bytes / 1048576).toFixed(1)}MB. The limit is ${(config.maxSubmissionBytes / 1048576).toFixed(0)}MB.`;

export async function POST({ params, request }) {
  if (!sameOrigin(request, config.origin)) return badOrigin();
  const who = await identify(request);
  if (who.kind !== 'student') return unauthorized();
  if (!(await get(params.slug))) return notFound();

  // Refused on the declared size before reading. Two extra megabytes for the
  // display copy and the form's own framing.
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > config.maxSubmissionBytes + 2 * 1048576) {
    return reply({ ok: false, error: tooBig(declared) }, 413);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return reply({ ok: false, error: 'could not read the upload' }, 400);
  }
  const original = form.get('file');
  if (!original || typeof original === 'string') return reply({ ok: false, error: 'no file' }, 400);
  if (original.size > config.maxSubmissionBytes) return reply({ ok: false, error: tooBig(original.size) }, 413);

  const ext = String(original.name ?? '').split('.').pop().toLowerCase();
  const buffer = Buffer.from(await original.arrayBuffer());
  if (!EXT.includes(ext) || !magicMatches(ext, buffer)) {
    return reply({ ok: false, error: MESSAGES.type }, 422);
  }

  const id = newId(10);
  const dir = assetsDir(params.slug);
  await mkdir(dir, { recursive: true });
  const file = `${id}.${ext}`;
  await writeFile(path.join(dir, file), buffer);

  // Kept only if it really is a small JPEG. Anything else is dropped quietly:
  // the board falls back to the original.
  let display = null;
  const copy = form.get('display');
  if (ext !== 'mp4' && copy && typeof copy !== 'string' && copy.size < 2_000_000) {
    const b = Buffer.from(await copy.arrayBuffer());
    if (magicMatches('jpg', b)) {
      display = `${id}.display.jpg`;
      await writeFile(path.join(dir, display), b);
    }
  }

  return reply({ ok: true, file, display, type: ext === 'mp4' ? 'video' : 'image' });
}
