# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

The course site for **Simulations, Models, Twins**, Columbia GSAPP, Fall 2026.
Served at **simmodeltwin.net**, self-hosted on Adam's box.

Predecessor course: Methods in Spatial Research (Spring 2026), repo
`methods-in-spatial-research-sp2026`, site methodsinspatialresearch.xyz. The
visual design and the content conventions are carried over from it deliberately -
match them rather than improving on them.

## Rules

- **Never `git commit` or `git push`.** Adam commits. Leave the working tree
  with your changes in it and say what you changed.
- **No example submissions.** `src/submissions/` is empty until students submit,
  and an empty gallery is the intended state. Older build docs in the vault ask
  for a worked `_example/<slug>/` entry - that is out of date; never recreate
  one, and never write a manifest under `src/submissions/` by hand.
- **Never invent data.** No fabricated URLs, field names, figures, or datasets.
  If a source is unverified, say so in the file. There is a note in
  `utilities/constraints.md` in the Obsidian vault about which URLs in the
  course longlists were never checked - assume unverified unless told otherwise.
- Read `utilities/writing-style-guide.md` in the vault before drafting any
  course prose. The voice is specific and it is easy to get wrong.
- Kill any dev server you start.

## Commands

```
npm install
npm run sync      # mirror content images and data/processed into static/ (and
                  #   submissions, in archive mode only)
                  #   (also runs automatically via predev / prebuild)
npm run dev       # dev server
SMT_SHOW_UNPUBLISHED=1 npm run dev
                  # ...also showing everything held back: pages past a
                  #   `publish:` date, anything with `published: false`
                  #   (dev notes, the sunlight sandbox), and hidden
                  #   sandboxes. Each is tagged
                  #   `unpublished` or `publishes 9/17` so a preview is never
                  #   mistaken for the live site. See src/lib/visibility.js.
npm run build     # production build (adapter-node)
npm start         # run the built server
npm run covers    # Playwright cover images + build-doctor stage 2
                  #   npm run covers -- --base http://localhost:5173
                  #   CHROMIUM_PATH=... to use an existing browser
npm run audit:freeze
node scripts/agent-frame-time.js --base http://localhost:5173   # mouse agents cost
npm run tokens -- "Lastname, Firstname"
```

Freeze: `SMT_MODE=archive npm run build` swaps in
adapter-static and prerenders. `npm run audit:freeze` fails if a route has drifted
somewhere that can't prerender - run it before believing the freeze still works.

## Stack

SvelteKit (Svelte 5, runes) on adapter-node. Content is markdown rendered with
markdown-it, **not** mdsvex - so `{` and `<` in a code sample are never mistaken
for Svelte syntax, and `markdown-it-attrs` keeps the Methods `#img-full`
convention working. A tutorial embeds a live sandbox with a mount div, not a
component tag:

```html
<div data-sandbox="bathtub" data-mode="view" data-params='{"slr_m":1.5}'></div>
```

## Layout

```
src/content/        markdown, images beside it
  syllabus/ tutorials/ assignments/ resources/
src/submissions/    <student>/<sandbox>/manifest.json + assets/ + review.json
src/lib/
  content.js        markdown pipeline + collections
  sandboxes/        one folder per sandbox: meta.js, schema.json, Component.svelte
  components/       SandboxFrame, ParamPanel, ModelCard, SubmitDialog, Assistant
  server/           auth, budget, validate, repo, config  (server-only)
src/routes/
  api/              server-only; never prerendered, excluded from the archive build
data/               original/ (sources, shared), processed/<sandbox>/ (derived,
                    what ships), scripts/ (one pipeline per sandbox, Python)
scripts/            cover, issue-tokens, prerender-audit, sync-assets
static/data/        packed grids the sandboxes read in archive mode
static/covers/      sandbox cover images (committed; regenerate with npm run covers)
static/<mirrored>/  written by sync-assets on predev/prebuild. Gitignored.
var/                tokens, budget, sessions, logs. Gitignored. Never commit.
```

Anything the app *imports* lives under `src/`. Anything the browser *fetches as a
file* is served from `static/`. `scripts/sync-assets.js` mirrors the overlap
(content images, submission covers and assets) on `predev` and `prebuild`;
`src/` is the source of truth and the copies in `static/` are gitignored.

## Platform and build traps

Three of these have already cost a debugging session. They all fail the same
confusing way - a clean 200 from the server, a dead page in the browser, and
nothing in the terminal - because the failure is at hydration, not in SSR.
**Checking an HTTP status is not verification. Check the browser console.**

- **No `$env/static/public`.** A missing `PUBLIC_` variable makes that module
  throw on every page. The freeze switch is `SMT_MODE`, read once in
  `vite.config.js` and exposed as the `__SMT_MODE__` define. A fresh clone must
  run with no `.env` at all.
- **`src/lib/content.js` runs in the browser** - it is imported by universal
  `load` functions. Nothing Node-only may be imported there. That is why
  frontmatter is parsed with `js-yaml` and a regex rather than `gray-matter`,
  which reaches for `Buffer`.
- **`predev` and `prebuild` are load-bearing.** They run
  `scripts/sync-assets.js`, which mirrors `src/content/*/images` and
  `data/processed/*` into `static/` (and `src/submissions`, for the archive
  build only). Without them the
  browser silently serves whatever `static/` happened to contain last - which
  looks like a data bug, not a config one. Never edit `package.json` scripts
  without checking both are still there.
- **`import.meta.glob` only works under `src/`,** and its options argument must
  be an inline object literal. A JSON file globbed from outside `src/` is served
  to the browser with a JSON MIME type and rejected by the module loader; that
  is why `src/content/` and `src/submissions/` are where they are.
- **Submissions are read at request time in live mode.** `/api/submissions`
  lists the folders and serves their files from disk, so an upload appears with
  no rebuild. The four pages that list submissions (gallery, gallery detail,
  assignment, sandbox) set `prerender = MODE === 'archive'`; if one is
  prerendered in live mode it freezes at build time and new work never shows.
  See `src/lib/submissions.js`.

## The sandbox contract

Read `src/lib/sandboxes/bathtub/` first - it is the reference implementation.

- One component, two modes. Props: `params`, `assets`, `mode` (`edit` | `view`),
  `dataBase`, and the callbacks `onmetrics(obj)` and `onready(bool)`.
- **A sandbox never sets `window.__metrics` or `data-cover-ready` itself.** It
  reports; `SandboxFrame` publishes. That gives the cover pipeline one thing to
  wait on across all seven.
- The JSON Schema in `schema.json` does two jobs: it draws the control panel and
  the server validates submitted params against it. Add a control there, not in
  the panel component.
- **Every sandbox must render from static data.** Anything that can't does not
  ship. Only the studio twin has a live source. This is the rule that makes the
  December freeze mechanical.

## Terminology - keep these straight

The course vocabulary collides with the discipline's, so these are load-bearing:

- **geometry** / **3D model** = a mesh, made in Rhino or Blender. **model**,
  unqualified, always means predictive logic. Never call a mesh a model.
- **twin = record** ("this is how it is"), **model = rule** ("this is how it
  works"), **simulation = run** ("this is what happens, if").
- **Sandbox** = the finished playable thing at `/sandboxes/<slug>`.
  **Tutorial** = the how-to for building one. Never collapse them.
- The syllabus says **participants**; tutorials and assignments say **you**.
- "World models" and "spatial intelligence" take scare quotes.
- "Pithy two-sentence summary" and "gallery text" are the recurring deliverable
  phrasings, carried over from Methods.

## Two kinds of tutorial

`src/content/tutorials/` holds both the **weekly tutorials** (`01-setting-up`,
`02-mapping-where`, `03-simulating-trees`, `04-notebook-to-sandbox`, ...) and
the **sandbox dev notes** (`01-pencil` ... `05-bathtub`, frontmatter
`devnotes: true`). The Tutorials tab lists only the weekly ones; dev notes are
linked from each sandbox page. Weekly tutorials follow the Methods shape and
voice (`utilities/writing-style-guide.md` § 2); dev notes follow the flat shape
below. Images: `images/w<n>/` for weekly, `images/<nn>/` for dev notes.

Assignments take uploads when their frontmatter says `submit: true`, with
`accepts: [image, pdf, html]` and `due: "M/DD"`. Uploads go through the same
`/api/submit` as sandbox forks with `manifest.kind = 'assignment'` and land under
`src/submissions/<student>/<assignment-slug>/`; Student Work shows a section per
assignment. See `src/lib/server/validate.js` (`validateAssignment`).

## Tutorial anchors are an API

The build doctor points students at `#what-came-out` and `#the-parts`, and
`FAILURE_MAP` in `src/lib/server/validate.js` hardcodes them. Renaming a
tutorial heading breaks it silently.

Every dev note is "<sandbox title> dev notes" and has the same four `##`
sections in the same order, and nothing more: **The ambition** (what we set out
to do, one short paragraph), **The parts** (bullets: dataset, then what is
derived from it), **Roadblocks** (bullets, one sentence each), **What came out**
(with `### What you should see` and `### Limitations` under it, bullets). No
Challenge section. Keep them short - they are a works-cited and model card, not
an essay - and put two or three images in each (the cover from `/covers/`, and
charts or diagrams under `src/content/tutorials/images/<nn>/`).

Every dev note also states explicitly what the sandbox can do that a rebuild
won't - use the `.gap` callout. Don't hide it. Weekly tutorials use the same
callout for what the class version has that the student's won't.

## Sandbox prose

Every sandbox carries `card.md` with two `##` sections in this order:
**Description** (two or three short paragraphs) and **Assumptions +
Limitations** (one flat bullet list). Sources are footnotes on the sentences
that use them, each carrying the citation plus one specific thing about that
dataset, and a markdown link wherever the source has a URL. `cards.js` renders
each section separately, so a footnote must be defined inside the section that
references it.

Links in a card, and in a schema `description` or `x-enum-note`, open in a new
tab - `src/lib/markdown-links.js` sets that on the token, and the panel's fold
renders its prose as inline markdown through `src/lib/inline-markdown.js`.

The register, for cards, `meta.js`, schema `description` fields and tutorials
alike: purely explanatory, written for someone who has never seen the work, as
plain as a model card. Bullets of one sentence each where the content is a list.
No lines written to drive a point home, no titled mini-sections ("The table
that..."), no ALL-CAPS emphasis, no "the finding is" framing. Adam rewrites
this text himself, so voice gets in his way; keep it flat.
