// Submissions are plain folders in the repo:
//
//   src/submissions/<lastname-firstname>/<sandbox-slug>/manifest.json
//   src/submissions/<lastname-firstname>/<sandbox-slug>/assets/...
//   src/submissions/<lastname-firstname>/<sandbox-slug>/review.json  (build doctor)
//
// /api/submit writes them; the build reads them. There is no database.
//
// They live under src/ because that is where Vite will transform an imported
// JSON file into a module. Outside src/ the dev server hands the browser the
// raw file with a JSON MIME type instead, and the page dies at hydration.
// The covers and uploaded assets, which need to be served as files, are
// mirrored into static/submissions/ by scripts/sync-assets.js - the same
// mechanism the content images use. Source of truth here, served copy there.
// Globbed as raw text and parsed, not imported as modules. A JSON file outside
// src/ imported as a module gets served to the browser with a JSON MIME type,
// which the module loader rejects - the page then dies at hydration. ?raw is the
// same mechanism content.js uses for markdown, and it works anywhere.
const manifests = import.meta.glob('/src/submissions/*/*/manifest.json', { eager: true });
const reviews = import.meta.glob('/src/submissions/*/*/review.json', { eager: true });

function parse(path, mod) {
  const [, , , student, sandbox] = path.split('/');
  const m = mod.default ?? mod;
  return {
    ...m,
    // 'sandbox' (a forked state, rendered live) or 'assignment' (an uploaded
    // file from an assignment page; `sandbox` is then the assignment slug).
    kind: m.kind === 'assignment' ? 'assignment' : 'sandbox',
    student,
    sandbox,
    url: `/gallery/${student}/${sandbox}/`,
    assetBase: `/submissions/${student}/${sandbox}/`,
    review: reviews[`/src/submissions/${student}/${sandbox}/review.json`]?.default ?? null
  };
}

export const all = Object.entries(manifests)
  .map(([p, mod]) => parse(p, mod))
  .sort((a, b) => (b.submitted ?? '').localeCompare(a.submitted ?? ''));

export function bySandbox(slug) {
  return all.filter((s) => s.sandbox === slug);
}
export function one(student, sandbox) {
  return all.find((s) => s.student === student && s.sandbox === sandbox) ?? null;
}
