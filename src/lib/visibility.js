// What is on the site, and the one switch that shows what is not.
//
// Three different things can be held back:
//
//   published: false     in a markdown file's frontmatter, in a sandbox's
//                        meta.js, or in a submission's manifest.json. Held back
//                        indefinitely, by a decision rather than a date.
//   publish: "YYYY-MM-DD" in a tutorial's or an assignment's frontmatter. Held
//                        back until that date - see isLive() in content.js.
//   status: 'gated'      a sandbox that is listed but not open. Different
//                        question; nothing here touches it.
//
// SMT_SHOW_UNPUBLISHED=1 reveals all of them at once, so there is ONE flag to
// remember rather than one per kind of thing:
//
//   SMT_SHOW_UNPUBLISHED=1 npm run dev
//
// Everything it reveals is tagged in the interface - `unpublished`, or
// `publishes 9/17` - so a preview is never mistaken for the live site.
//
// It lives in its own module, and not in content.js, because the sandbox
// registry and the submission list both need it: importing content.js there
// would pull the whole markdown corpus into every sandbox's bundle.
//
// Read as a build-time constant defined in vite.config.js, for the same reason
// SMT_MODE is - a missing PUBLIC_ variable makes $env/static/public throw at
// hydration on every page, and a fresh clone has to run with no .env at all.
// Guarded with typeof because scripts/ imports the sandbox registry from plain
// node, where the define does not exist. Vite still substitutes the identifier,
// so the check folds to a constant in the browser bundle.
export const SHOW_UNPUBLISHED =
  typeof __SMT_SHOW_UNPUBLISHED__ !== 'undefined' ? __SMT_SHOW_UNPUBLISHED__ : false;

/** True if `thing` is not held back by an explicit `published: false`. */
export function isPublished(thing) {
  return SHOW_UNPUBLISHED || thing?.published !== false;
}
