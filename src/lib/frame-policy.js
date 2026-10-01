// The content security policy for a student's uploaded HTML. It allows what a
// self-contained page needs - inline scripts and styles, eval, data: and blob:
// URLs - and nothing from the network: no CDN script, no map tile, no fetch, no
// web font. Sent as a header on the file by
// src/routes/api/submissions/[student]/[sandbox]/[...file]/+server.js, and set
// as the `csp` attribute on the gallery page's frame, so opening the file
// directly and viewing it in the gallery behave the same.
//
// Not applied to a submitted link: a GitHub Pages site is several files by
// design and has to fetch them.
export const FRAME_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval' blob: data:",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data:',
  'media-src data: blob:',
  "connect-src 'none'"
].join('; ');
