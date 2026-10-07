// Submissions are plain folders in the repo:
//
//   src/submissions/<lastname-firstname>/<sandbox-slug>/manifest.json
//   src/submissions/<lastname-firstname>/<sandbox-slug>/cover.jpg|cover.png
//   src/submissions/<lastname-firstname>/<sandbox-slug>/assets/...
//   src/submissions/<lastname-firstname>/<sandbox-slug>/review.json  (build doctor)
//
// /api/submit writes them. There is no database. Where they are read from
// depends on the same SMT_MODE switch as src/lib/data.js:
//
//   live    - /api/submissions reads the folders from disk on every request,
//             and /api/submissions/<student>/<sandbox>/... serves the files.
//             A submission shows up the moment it is written, with no rebuild.
//             The pages that list submissions opt out of prerendering in this
//             mode, or they would be frozen at whatever existed at build time.
//   archive - import.meta.glob reads the manifests at build time, and the files
//             are mirrored into static/submissions/ by scripts/sync-assets.js.
//
// They live under src/ because that is where Vite will transform an imported
// JSON file into a module. Outside src/ the dev server hands the browser the
// raw file with a JSON MIME type instead, and the page dies at hydration.
import { error } from '@sveltejs/kit';
import { MODE } from './data.js';
import { SHOW_UNPUBLISHED } from './visibility.js';

// The mode is a build-time constant, so in the live build these globs fold away
// and no manifest is baked into the bundle.
const manifests =
  MODE === 'archive' ? import.meta.glob('/src/submissions/*/*/manifest.json', { eager: true }) : {};
const reviews =
  MODE === 'archive' ? import.meta.glob('/src/submissions/*/*/review.json', { eager: true }) : {};

function parse({ student, sandbox, manifest: m, review }) {
  const assetBase =
    MODE === 'archive' ? `/submissions/${student}/${sandbox}/` : `/api/submissions/${student}/${sandbox}/`;
  return {
    ...m,
    // 'sandbox' (a forked state, rendered live) or 'assignment' (an uploaded
    // file from an assignment page; `sandbox` is then the assignment slug).
    kind: m.kind === 'assignment' ? 'assignment' : 'sandbox',
    student,
    sandbox,
    url: `/gallery/${student}/${sandbox}/`,
    assetBase,
    // An assignment upload brings a JPEG drawn in the browser; everything else
    // gets a PNG from `npm run covers`.
    coverUrl: `${assetBase}${m.cover_file ?? 'cover.png'}`,
    review: review ?? null
  };
}

// Every submission, newest first. Pass the `fetch` from a load function; the
// archive build does not need it.
//
// `published: false` in a manifest holds a submission back.
// SMT_SHOW_UNPUBLISHED=1 shows those, the same switch that shows unpublished
// pages and sandboxes. There are no example submissions in the repo - the
// gallery is empty until a student submits, and that is the intended state.
export async function submissions(fetch) {
  let rows;
  if (MODE === 'archive') {
    rows = Object.entries(manifests).map(([p, mod]) => {
      const [, , , student, sandbox] = p.split('/');
      return {
        student,
        sandbox,
        manifest: mod.default ?? mod,
        review: reviews[`/src/submissions/${student}/${sandbox}/review.json`]?.default ?? null
      };
    });
  } else {
    const res = await fetch('/api/submissions');
    if (!res.ok) error(502, 'could not read submissions');
    rows = await res.json();
  }
  return rows
    .map(parse)
    .filter((s) => SHOW_UNPUBLISHED || s.published !== false)
    .sort((a, b) => (b.submitted ?? '').localeCompare(a.submitted ?? ''));
}

// The student's prompt file, where the assignment asked for one: the form's
// prompt box, or for submissions made before the form had one, a prompt.md
// handed in as an extra. Takes a manifest or a parsed submission.
export function promptPathOf(m) {
  return m.prompt ?? (m.assets ?? []).find((a) => /^assets\/prompt\.(md|markdown|txt)$/i.test(a.path))?.path ?? null;
}

export async function bySandbox(fetch, slug) {
  return (await submissions(fetch)).filter((s) => s.sandbox === slug);
}
export async function one(fetch, student, sandbox) {
  return (await submissions(fetch)).find((s) => s.student === student && s.sandbox === sandbox) ?? null;
}
