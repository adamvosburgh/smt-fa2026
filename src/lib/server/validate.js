// Build doctor, stage 1: deterministic validation.
//
// No model involved. Every failure here produces a precise message and a
// hardcoded pointer to a tutorial anchor. This catches most of what goes wrong.
// Stages 2 (headless run) and 3 (diagnose) only exist for what gets past it.
import Ajv from 'ajv/dist/2020.js';
import manifestSchema from '../../../schemas/manifest.schema.json' with { type: 'json' };
import { bySlug } from '../sandboxes/index.js';

const ajv = new Ajv({ allErrors: true, strict: false });
const validateManifest = ajv.compile(manifestSchema);

// The hand-written failure map. Keys are stable; values point at a tutorial
// anchor. Grow this as real failures come in - a failure that lands here is one
// no model has to diagnose.
export const FAILURE_MAP = {
  'manifest/missing-gallery-text': '/assignments/#either-way-submit',
  'manifest/bad-sandbox': '/sandboxes/',
  'params/out-of-range': '#the-parameters',
  'params/unknown-key': '#the-parameters',
  'assets/too-large': '#producing-the-data',
  'assets/path-escape': '#setting-up-the-web-environment',
  'assets/missing-gltf-layer': '#producing-the-data'
};

function pointer(code, sandbox) {
  const anchor = FAILURE_MAP[code];
  if (!anchor) return null;
  if (anchor.startsWith('#')) {
    const tut = bySlug[sandbox]?.tutorial;
    return tut ? tut + anchor : null;
  }
  return anchor;
}

export function validate({ manifest, files, sandbox, maxBytes }) {
  const errors = [];
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
      `Submission is ${(total / 1e6).toFixed(1)}MB. The cap is ${(maxBytes / 1e6).toFixed(0)}MB. ` +
        'Decimating a mesh or dropping a column is an authorial act - decide what to lose.'
    );
  }

  return { ok: errors.length === 0, errors };
}
