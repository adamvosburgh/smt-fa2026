// The write path.
//
//   student works in the sandbox -> Submit -> the app serialises state to
//   manifest.json + asset blobs -> multipart POST here with their token ->
//   stage 1 validation -> written under submissions/<student>/<sandbox>/.
//
// No PR in the happy path. PR stays as the escape hatch; Tutorial 0 still
// teaches git.
import { json } from '@sveltejs/kit';
import { identify, sameOrigin } from '$lib/server/auth.js';
import { validate } from '$lib/server/validate.js';
import { write, commit } from '$lib/server/repo.js';
import { config } from '$lib/server/config.js';

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
          'This needs your submission token. You were given one at the start of the semester - paste it once and the browser keeps it. Lost it? Email me and I will reissue.'
      },
      { status: 401 }
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
  for (const [key, value] of form.entries()) {
    if (key !== 'asset' || typeof value === 'string') continue;
    const buffer = Buffer.from(await value.arrayBuffer());
    files.push({ path: `assets/${value.name}`, type: value.type, bytes: buffer.length, buffer });
  }
  manifest.assets = files.map(({ path, type, bytes }) => ({ path, type, bytes }));

  const result = validate({
    manifest,
    files,
    sandbox,
    maxBytes: config.maxSubmissionBytes
  });
  if (!result.ok) {
    return json({ ok: false, stage: 1, errors: result.errors }, { status: 422 });
  }

  const dir = await write({ student: who.student, sandbox, manifest, files });
  const git = await commit(dir, `submission: ${who.student} / ${sandbox}`);

  // Stages 2 and 3 (headless run, then diagnose) are deliberately not awaited.
  // They are non-blocking: if the run capture or the model call fails, the
  // student has already submitted successfully.
  return json({ ok: true, path: dir, git, next: `/gallery/${who.student}/${sandbox}/` });
}
