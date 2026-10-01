// Build doctor, stage 1: deterministic validation.
//
// No model involved. Every failure here produces a precise message and a
// hardcoded pointer to a tutorial anchor. This catches most of what goes wrong.
// Stages 2 (headless run) and 3 (diagnose) only exist for what gets past it.
import Ajv from 'ajv/dist/2020.js';
import manifestSchema from '../../../schemas/manifest.schema.json' with { type: 'json' };
import { bySlug } from '../sandboxes/index.js';
import { doc, isLive, publishDate } from '../content.js';

const ajv = new Ajv({ allErrors: true, strict: false });
const validateManifest = ajv.compile(manifestSchema);

// The hand-written failure map. Keys are stable; values point at a tutorial
// anchor. Grow this as real failures come in - a failure that lands here is one
// no model has to diagnose.
export const FAILURE_MAP = {
  'manifest/missing-gallery-text': '/assignments/#either-way-submit',
  'manifest/bad-sandbox': '/sandboxes/',
  'params/out-of-range': '#what-came-out',
  'params/unknown-key': '#what-came-out',
  'assets/too-large': '#the-parts',
  'assets/path-escape': '#the-parts',
  'assets/missing-gltf-layer': '#the-parts',
  // Assignment uploads. These anchors are on the assignment page itself, so the
  // pointer is built from the assignment slug rather than a sandbox tutorial.
  'assignment/not-open': '/assignments/',
  'assignment/no-file': '#submission',
  'assignment/bad-type': '#submission',
  'assignment/missing-answer': '#requirements',
  'assignment/bad-link': '#submit',
  'assignment/no-screenshot': '#submit',
  // A model upload is the one assignment kind whose pointer goes to a SANDBOX
  // dev note rather than to the assignment page, because what went wrong is in
  // the file, not in the hand-in. The assignment's `sandbox_ref` frontmatter
  // says which dev note.
  'assets/bad-model': '#the-parts'
};

// What an assignment page may accept, keyed by the `accepts` frontmatter list.
// Checked by extension, not by the browser-reported MIME type, which lies.
const ACCEPTS = {
  image: ['.png', '.jpg', '.jpeg', '.webp'],
  pdf: ['.pdf'],
  html: ['.html'],
  // A 3D model, handed in to be RUN in a sandbox rather than shown. Binary glTF
  // only: one file with the geometry and the materials inside it, so there is
  // nothing to lose between the student's machine and the gallery.
  model: ['.glb']
};

// The four site values a model submission may carry. Everything else about the
// sandbox's state is the visitor's to move; these describe the model itself and
// cannot be worked out from the file.
const MODEL_PARAM_KEYS = ['latitude', 'longitude', 'timezone', 'north_deg'];

// A glTF binary header: the magic, a version, and the total length, which must
// equal the file's own length. This catches a truncated upload and a .glb that
// is really a .gltf renamed, both of which otherwise fail silently in the
// browser with a blank viewport.
function checkGlb(file) {
  const b = file.buffer;
  if (!b || b.length < 12) return 'is too short to be a glTF binary file.';
  if (b.toString('ascii', 0, 4) !== 'glTF') {
    return 'does not start with the four bytes glTF. Export as glTF BINARY (.glb), not as .gltf.';
  }
  const declared = b.readUInt32LE(8);
  if (declared !== b.length) {
    return `says it is ${declared} bytes and is ${b.length}. The upload was cut short, or the file was edited after export.`;
  }
  return null;
}

// A model assignment's failures point at the dev notes of the sandbox that runs
// the model, named by the assignment's `sandbox_ref`, rather than at the
// assignment page - what went wrong is in the file, not in the hand-in.
function modelPointer(assignment, code) {
  const anchor = FAILURE_MAP[code];
  const tut = bySlug[assignment?.sandbox_ref ?? 'sunlight']?.tutorial;
  return anchor && anchor.startsWith('#') && tut ? tut + anchor : null;
}

function pointer(code, sandbox, kind) {
  const anchor = FAILURE_MAP[code];
  if (!anchor) return null;
  if (anchor.startsWith('#')) {
    if (kind === 'assignment') return `/assignments/${sandbox}/${anchor}`;
    const tut = bySlug[sandbox]?.tutorial;
    return tut ? tut + anchor : null;
  }
  return anchor;
}

// Assignment uploads: a file (or a few) from an assignment page, not a sandbox
// state. The assignment's markdown frontmatter says whether it takes uploads
// (`submit: true`) and what kinds (`accepts: [image, pdf, html]`). Nothing here
// is about quality - only whether the gallery will be able to show it.
function validateAssignment({ manifest, files, sandbox, maxBytes, hasCover, errors }) {
  const add = (code, message) => errors.push({ code, message, see: pointer(code, sandbox, 'assignment') });

  const a = doc('assignments', sandbox);
  if (!a || a.submit !== true) {
    add('assignment/not-open', `"${sandbox}" is not an assignment that takes uploads.`);
    return;
  }
  // An assignment that has not reached its `publish:` date is not on the site,
  // so it does not take uploads either. Same test as the pages use.
  if (!isLive(a)) {
    add('assignment/not-open', `"${a.title}" is not open yet. It publishes on ${publishDate(a)}.`);
    return;
  }
  if (!validateManifest(manifest)) {
    for (const e of validateManifest.errors) {
      add('manifest/schema', `manifest.json${e.instancePath}: ${e.message}`);
    }
  }
  if (!manifest.gallery_text?.trim()) {
    add('manifest/missing-gallery-text', 'The two-sentence gallery text is required.');
  }

  // Short-answer questions from the assignment's `questions:` frontmatter. Each
  // one needs an answer, a dropdown's must be one of its `options`, and only the
  // keys the assignment asks for are kept.
  const questions = Array.isArray(a.questions) ? a.questions.filter((q) => q?.key) : [];
  if (questions.length) {
    const given = manifest.answers && typeof manifest.answers === 'object' ? manifest.answers : {};
    manifest.answers = Object.fromEntries(
      questions.map((q) => [q.key, String(given[q.key] ?? '').trim().slice(0, 2000)])
    );
    for (const q of questions) {
      if (!manifest.answers[q.key]) {
        add('assignment/missing-answer', `"${q.label ?? q.key}" needs an answer.`);
      } else if (Array.isArray(q.options) && !q.options.includes(manifest.answers[q.key])) {
        add('assignment/bad-answer', `"${q.label ?? q.key}" must be one of: ${q.options.join(', ')}.`);
      }
    }
  } else {
    delete manifest.answers;
  }

  const kinds = Array.isArray(a.accepts) && a.accepts.length ? a.accepts : ['image', 'pdf'];
  const allowed = kinds.flatMap((k) => ACCEPTS[k] ?? []);
  const ext = (p) => p.toLowerCase().replace(/^.*(\.[a-z0-9]+)$/, '$1');
  const formBoxes = Array.isArray(a.form) ? a.form : [];

  // A link, where the assignment's `form:` has a `link` box. It must be https;
  // the gallery frames it. With a link and no file, the screenshot is uploaded
  // as the primary, so an image is allowed as the primary whatever `accepts` says.
  if (manifest.link !== undefined) {
    let ok = false;
    try {
      ok = new URL(String(manifest.link)).protocol === 'https:';
    } catch {}
    if (!formBoxes.includes('link')) {
      add('assignment/bad-link', `"${a.title}" does not take a link.`);
    } else if (!ok) {
      add('assignment/bad-link', 'The link has to be a full address starting with https://.');
    }
  }
  if (manifest.link) allowed.push(...ACCEPTS.image);

  // Where the form asks for a screenshot, a link or an HTML file needs one: it
  // is the only cover those submissions get. A PDF's cover is drawn from its
  // first page, and an image is its own.
  const primaryPath = manifest.primary ?? files[0]?.path ?? '';
  if (formBoxes.includes('screenshot') && !hasCover && (manifest.link || /\.html?$/i.test(primaryPath))) {
    add('assignment/no-screenshot', 'A screenshot is required with an HTML file or a link. It is what Student Work shows.');
  }

  if (!files.length) {
    add('assignment/no-file', `Nothing was attached. This assignment takes ${kinds.join(' or ')} files.`);
  }
  const primary = files.find((f) => f.path === manifest.primary) ?? files[0];
  if (primary && !allowed.includes(ext(primary.path))) {
    add(
      'assignment/bad-type',
      `"${primary.path}" is not a file type this assignment takes (${allowed.join(', ')}).`
    );
  }
  if (primary && !manifest.primary) manifest.primary = primary.path;

  // A model assignment: check the file really is a glTF binary, and check its
  // params against the sunlight schema restricted to the four site keys.
  if (kinds.includes('model') && primary && ext(primary.path) === '.glb') {
    const addModel = (code, message) => errors.push({ code, message, see: modelPointer(a, code) });
    const bad = checkGlb(primary);
    if (bad) addModel('assets/bad-model', `"${primary.path}" ${bad}`);

    const schema = bySlug[a.sandbox_ref ?? 'sunlight']?.schema;
    const supplied = manifest.params ?? {};
    for (const key of Object.keys(supplied)) {
      if (!MODEL_PARAM_KEYS.includes(key)) {
        addModel('params/unknown-key', `params/${key}: a model submission carries only ${MODEL_PARAM_KEYS.join(', ')}.`);
      }
    }
    if (schema) {
      const restricted = {
        type: 'object',
        additionalProperties: false,
        properties: Object.fromEntries(
          MODEL_PARAM_KEYS.filter((k) => schema.properties?.[k]).map((k) => [k, schema.properties[k]])
        )
      };
      const vp = ajv.compile(restricted);
      const only = Object.fromEntries(
        Object.entries(supplied).filter(([k]) => MODEL_PARAM_KEYS.includes(k))
      );
      if (!vp(only)) {
        for (const e of vp.errors) {
          addModel('params/out-of-range', `params${e.instancePath}: ${e.message}`);
        }
      }
    }
  }

  let total = 0;
  for (const f of files) {
    total += f.bytes;
    const p = f.path.replace(/\\/g, '/');
    if (p.includes('..') || p.startsWith('/') || !p.startsWith('assets/')) {
      add('assets/path-escape', `"${f.path}" is not a legal asset path. Assets go under assets/.`);
    }
  }
  if (total > maxBytes) {
    add(
      'assets/too-large',
      `Submission is ${(total / 1048576).toFixed(1)}MB. The cap is ${(maxBytes / 1048576).toFixed(0)}MB. ` +
        'Export a smaller image, or a PDF with the images downsampled.'
    );
  }
}

export function validate({ manifest, files, sandbox, maxBytes, hasCover = false }) {
  const errors = [];
  if (manifest.kind === 'assignment') {
    validateAssignment({ manifest, files, sandbox, maxBytes, hasCover, errors });
    return { ok: errors.length === 0, errors };
  }

  const add = (code, message) => errors.push({ code, message, see: pointer(code, sandbox) });

  const meta = bySlug[sandbox];
  if (!meta) {
    add('manifest/bad-sandbox', `There is no sandbox called "${sandbox}".`);
    return { ok: false, errors };
  }

  if (!validateManifest(manifest)) {
    for (const e of validateManifest.errors) {
      add('manifest/schema', `manifest.json${e.instancePath}: ${e.message}`);
    }
  }
  if (!manifest.gallery_text?.trim()) {
    add('manifest/missing-gallery-text', 'The two-sentence gallery text is required.');
  }

  // Params, against the sandbox's own schema - the same file that draws the
  // control panel, so an out-of-range value means the client was bypassed.
  if (meta.schema) {
    const vp = ajv.compile(meta.schema);
    if (!vp(manifest.params ?? {})) {
      for (const e of vp.errors) {
        const code =
          e.keyword === 'additionalProperties' ? 'params/unknown-key' : 'params/out-of-range';
        add(code, `params${e.instancePath || '/' + (e.params?.additionalProperty ?? '')}: ${e.message}`);
      }
    }
  }

  // Assets: total size, and no path that escapes the submission folder.
  let total = 0;
  for (const f of files) {
    total += f.bytes;
    const p = f.path.replace(/\\/g, '/');
    if (p.includes('..') || p.startsWith('/') || !p.startsWith('assets/')) {
      add('assets/path-escape', `"${f.path}" is not a legal asset path. Assets go under assets/.`);
    }
  }
  if (total > maxBytes) {
    add(
      'assets/too-large',
      `Submission is ${(total / 1048576).toFixed(1)}MB. The cap is ${(maxBytes / 1048576).toFixed(0)}MB. ` +
        'Decimating a mesh or dropping a column is an authorial act - decide what to lose.'
    );
  }

  return { ok: errors.length === 0, errors };
}
