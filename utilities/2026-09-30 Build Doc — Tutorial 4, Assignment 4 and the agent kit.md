# Build doc: Tutorial 4, Assignment 4 and the agent kit

Prompt for Claude Code, working in `smt-fa2026`. Read the repo's `CLAUDE.md` first; its rules apply (no commits, no invented data, no example submissions, kill any server you start). The prose is already drafted; three files come with this doc. Place them, build the mechanics around them, and don't rewrite their text beyond what the code forces. Where you do have to write prose (a README, a note), keep it flat and short and mark the file with `<!-- PROSE DRAFT -->` on the first line. American English.

Files that come with this doc:

- `AGENTS-draft.md` → `kit/AGENTS.md`
- `04-tutorial-draft.md` → `src/content/tutorials/04-notebook-to-sandbox.md`
- `assignment-04-draft.md` → `src/content/assignments/assignment-04.md`

Four passes, in this order. Stop after each one and say what changed.

1. The agent kit
2. Tutorial 4
3. Assignment 4
4. Site changes

Items marked **[decide]** are calls Adam hasn't made. Make the choice that is least work, say which you made, and don't build both.

---

## 1. The agent kit

A folder students download, unzip, and open in VS Code. It gives their coding agent the course's context. Tutorial 4 links it at `/kit/smt-kit.zip`.

- Source folder: `kit/` at the repo root, with four files.
  - `AGENTS.md`: from `AGENTS-draft.md`. Strip the `<!-- PROSE DRAFT -->` comment; this one is student-facing as shipped.
  - `CLAUDE.md`: one line, `@AGENTS.md`. Claude Code reads it; other agents read `AGENTS.md` directly.
  - `.gitignore`: `.env`, `node_modules/`, `.DS_Store`, `work/`. Only matters for the GitHub route.
  - `README.txt`: five plain lines. What this folder is, unzip it, open it in VS Code, start your agent here, then go to Tutorial 4. No markdown.
- Served from `static/kit/`: `smt-kit.zip`, plus copies of `AGENTS.md` and `CLAUDE.md` beside it so a student can read them in a browser. The zip unpacks to a folder named `smt-kit/`.
- `scripts/build-kit.js` builds `static/kit/` from `kit/`. Add `npm run kit`, and call it from `prebuild` after `sync-assets`. Check `predev` and `prebuild` are both still intact when you're done. Commit the built files under `static/kit/`; they're small. **[decide]** whether `static/kit/` should be gitignored like the other mirrored folders and built on `predev` too, or committed. Committed is simpler for the freeze.
- Add a line to the repo's root `CLAUDE.md` saying `kit/CLAUDE.md` and `kit/AGENTS.md` are for students' agents, not for work on this repo.
- No data in the kit. The tutorial data goes in the course Google Drive folder, like Tutorials 2 and 3.

---

## 2. Tutorial 4

- Replace `src/content/tutorials/04-notebook-to-sandbox.md` with `04-tutorial-draft.md`. Keep the slug; Assignment 4 links to it. The title in the draft ("From a Prompt to a Sandbox") is a proposal; leave it and Adam will change it if he wants.
- The draft's `## The prompt` section is a bulleted list for Adam to write from. Leave it as is.
- Images: the draft references only `[WIRE]` (`street-trees-wireframe.svg`). `three-documents.svg` is no longer used; leave it in `images/w4/` but don't reference it. `01-planting-sites.png` is no longer used either. The draft has `<!-- IMAGE: ... -->` comments where Adam will add screenshots later; leave them in place (they're HTML comments and don't render).
- Data: `demos/04-notebook-to-sandbox/street-trees.json` (1.3MB; 12,715 trees, 15,787 sites, 580 blocks) is the file the tutorial tells students to download. Copy it to `demos/04-notebook-to-sandbox/content/street-trees.json` next to the centerline file, so everything that goes to Drive for this tutorial is in one place. Tell Adam it needs uploading to the course folder under the tutorial's name.
- The old Step 1 (planting-site code, exporting the JSON) is gone from the student-facing tutorial. The notebook that produced the file is `demos/04-notebook-to-sandbox/04-notebook-to-sandbox.ipynb`; leave it.
- Check that `SMT_SHOW_UNPUBLISHED=1 npm run dev` renders the page, the `.gap` callout, the code block and the image. Browser console, not HTTP status.

---

## 3. Assignment 4

- Replace `src/content/assignments/assignment-04.md` with `assignment-04-draft.md`.
- The frontmatter uses `questions:` (three reflections) the way `assignment_form` already supports. Check the keys don't collide with anything the form or gallery already uses.
- The frontmatter lists two new form boxes, `screenshot` and `link`. They don't exist yet; section 4 adds them. If you do the passes in order, the assignment renders with the boxes missing until pass 4 is done; that's fine in dev, but don't leave it that way.
- `accepts: [html, pdf]` stays. The PDF is the fallback hand-in.

---

## 4. Site changes

**Upload cap to 50MB.** `maxSubmissionBytes` in `src/lib/server/config.js` defaults to 15MB; make it 50MB. Find every place 15 appears as the limit in prose or the form (`AssignmentSubmit.svelte` has `LIMIT`; the validate message reads the config). The Node server's `BODY_SIZE_LIMIT` (adapter-node, default 512K) and any reverse proxy in front of it also cap the request, and neither is in the repo. Write a short deployment note wherever those live (README or a `docs/` note; find where the existing one is) saying both need to be at least 52M, and tell Adam explicitly in your summary.

**Screenshot as the cover.** An HTML upload gets no cover in the browser (`AssignmentSubmit.svelte` draws one only from an image), so Student Work and the whiteboard's assignment board would show blank tiles. Add a `screenshot` box to the assignment form, enabled by `form:`; it takes an image, is required when the work isn't an image, and is sent as the `cover` field that `/api/submit` already accepts (≤2MB; resize in the browser the way `drawCopy` does). When the work is an image, keep the current behavior. Confirm the whiteboard's assignment board picks up that cover the same way it does for image submissions.

**The link route.** Add a `link` box to the assignment form, enabled by `form:`, optional. When a link is given, the work upload becomes optional and the screenshot becomes the primary. Store it as `manifest.link` (add to `schemas/manifest.schema.json`; validate that it's an `https://` URL). On the gallery detail page, show the screenshot, the link, and frame the live page below it with the same `sandbox="allow-scripts"` attribute. In archive mode, drop the frame and keep the link and screenshot. In the gallery grid and on the board, a link submission looks like any other.

**Block the network in the frame.** `src/routes/api/submissions/[student]/[sandbox]/[...file]/+server.js` sends `content-security-policy: sandbox allow-scripts` on HTML. Add directives that allow inline scripts and styles, `data:` and `blob:` sources, and nothing else (`default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob: data:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'`, or the equivalent that works; test it). Add the same policy to the gallery page's iframe via the `csp` attribute if the browser honors it, so the frame and the direct URL behave the same. Test with a page that references a CDN script and confirm it fails in the gallery, and with `demos/04-notebook-to-sandbox/street-trees/index.html` and confirm it runs.

**Markdown as text.** Add `'.md': 'text/plain; charset=utf-8'` to `TYPES` in the same file so `prompt.md` opens in the browser instead of downloading.

**Assignment 4's board.** Check that an assignment board for `assignment-04` lists HTML and link submissions with their covers. Boards appear at 9am on the due date.

Test the upload end to end in dev with `SMT_SHOW_UNPUBLISHED=1` and a token you issue yourself, once each for: an HTML upload with a screenshot, a link with a screenshot, a PDF. Then delete the submission folders you made. Check the browser console.

---

## Open questions for Adam

- **Title** for Tutorial 4. The draft says "From a Prompt to a Sandbox".
- **The link route.** It's built here because `AGENTS.md` and the assignment both promise it. If it should wait, cut it from section 4 and change the two sentences in `AGENTS.md` and `assignment-04.md` that mention it.
- **`static/kit/` committed or built.** See the [decide] in section 1.
