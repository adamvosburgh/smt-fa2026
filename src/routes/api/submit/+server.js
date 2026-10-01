// The write path.
//
//   student works in the sandbox -> Submit -> the app serialises state to
//   manifest.json + asset blobs -> multipart POST here with their token ->
//   stage 1 validation -> written under submissions/<student>/<sandbox>/.
//
// Assignment uploads take the same road with manifest.kind = 'assignment' and
// the assignment slug in the `sandbox` field, so they land at
// submissions/<student>/assignment-01/ and show up under Student Work with
// everything else. See validateAssignment in $lib/server/validate.js.
//
// No PR in the happy path. PR stays as the escape hatch; Tutorial 0 still
// teaches git.
import { json } from '@sveltejs/kit';
import { identify, sameOrigin } from '$lib/server/auth.js';
import { validate } from '$lib/server/validate.js';
import { write, commit } from '$lib/server/repo.js';
import { config } from '$lib/server/config.js';
import { exists as boardExists } from '$lib/server/boards.js';
import { buildAssignmentBoard } from '$lib/server/board-generate.js';

export async function POST({ request }) {
  if (!sameOrigin(request, config.origin)) {
    return json({ ok: false, error: 'bad origin' }, { status: 403 });
  }

  const who = await identify(request);
  if (who.kind !== 'student') {
    return json(
      {
        ok: false,
        error:
          'This needs your submission token. Open the enrollment link I emailed you at the start of the semester and this browser will remember it, or paste the token itself into the box. Lost the email? Ask me and I will send a new one.'
      },
      { status: 401 }
    );
  }

  // Refused on the declared size before reading anything. The form checks the
  // same cap when a file is chosen; this is for whatever gets past it, and it
  // answers in words instead of the server's bare body-size error. The extra
  // two megabytes are room for the browser-drawn cover and the manifest.
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > config.maxSubmissionBytes + 2 * 1048576) {
    return json(
      {
        ok: false,
        error: `This upload is ${(declared / 1048576).toFixed(1)}MB. The limit is ${(config.maxSubmissionBytes / 1048576).toFixed(0)}MB for everything together. Export smaller files and try again.`
      },
      { status: 413 }
    );
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'could not read the upload' }, { status: 400 });
  }

  let manifest;
  try {
    manifest = JSON.parse(form.get('manifest'));
  } catch {
    return json({ ok: false, error: 'manifest.json is not valid JSON' }, { status: 400 });
  }

  const sandbox = String(manifest.sandbox ?? '');
  // The identity comes from the token, never from the payload.
  manifest.student = who.student;
  manifest.submitted = new Date().toISOString();

  const files = [];
  let cover = null;
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') continue;
    if (key === 'cover') {
      // Client-drawn JPEG for assignment uploads. Small by construction (the
      // browser resizes to 2000px wide); anything bigger is dropped, not stored.
      const buffer = Buffer.from(await value.arrayBuffer());
      if (manifest.kind === 'assignment' && buffer.length <= 2_000_000) cover = buffer;
      continue;
    }
    if (key !== 'asset') continue;
    const buffer = Buffer.from(await value.arrayBuffer());
    // Flatten the name: no directories, nothing outside [A-Za-z0-9._-].
    const name = value.name.split(/[\\/]/).pop().replace(/[^A-Za-z0-9._-]/g, '_');
    files.push({ path: `assets/${name}`, type: value.type, bytes: buffer.length, buffer });
  }
  if (manifest.kind === 'assignment' && manifest.primary) {
    const name = String(manifest.primary).split(/[\\/]/).pop().replace(/[^A-Za-z0-9._-]/g, '_');
    manifest.primary = `assets/${name}`;
  }
  // An empty link is no link. A link on anything but an assignment is dropped.
  if (manifest.kind !== 'assignment' || manifest.link === '' || manifest.link === null) delete manifest.link;
  manifest.assets = files.map(({ path, type, bytes }) => ({ path, type, bytes }));

  const result = validate({
    manifest,
    files,
    sandbox,
    maxBytes: config.maxSubmissionBytes,
    hasCover: cover !== null
  });
  if (!result.ok) {
    return json({ ok: false, stage: 1, errors: result.errors }, { status: 422 });
  }

  const dir = await write({ student: who.student, sandbox, manifest, files, cover });
  const git = await commit(dir, `submission: ${who.student} / ${sandbox}`);

  // A late submission to an assignment whose board is already up gets its tile
  // now. Not awaited, for the same reason as the stages below.
  if (manifest.kind === 'assignment' && (await boardExists(sandbox))) {
    buildAssignmentBoard(sandbox).catch((err) => console.error(`boards: late tile for ${sandbox}: ${err?.message ?? err}`));
  }

  // Stages 2 and 3 (headless run, then diagnose) are deliberately not awaited.
  // They are non-blocking: if the run capture or the model call fails, the
  // student has already submitted successfully.
  return json({ ok: true, path: dir, git, next: `/gallery/${who.student}/${sandbox}/` });
}
