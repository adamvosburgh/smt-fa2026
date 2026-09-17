---
title: Build Doc — Whiteboard
date: 2026-09-16
type: build-doc
---

# Build Doc — Whiteboard

For Claude Code (Opus). Repo `smt-fa2026`. Written 2026-09-16.

A shared whiteboard for pin-ups and in-class exercises, behind the student token.
One board per assignment is built from the submissions at 9:00 New York on the
morning it is due. Exercise boards are made by Adam by hand. Everyone with a token
can add images, video, text and sticky notes, move things, lock things, and see each
other's cursors. Nothing here touches the sandboxes, the submit flow's validation,
or the assistant.

Counts and file facts in this document were read from the working tree on
2026-09-16.

## 0. Read first

- `CLAUDE.md`, in full. The freeze rule and the "check the browser console" trap
  both apply here.
- `src/lib/server/auth.js`, `store.js`, `config.js`, `repo.js`.
- `src/routes/api/submit/+server.js` and `src/routes/api/presence/+server.js`.
- `src/routes/api/submissions/+server.js` and
  `src/routes/api/submissions/[student]/[sandbox]/[...file]/+server.js`.
- `src/lib/submissions.js`, `src/lib/content.js` (`startOfDayNY`, `isLive`,
  `collection`), `src/lib/visibility.js`, `src/lib/data.js`, `src/lib/token.js`.
- `src/lib/components/Assistant.svelte` (the token row) and
  `AssignmentSubmit.svelte` (`drawCover`, the multipart post, the modal styles).
- `src/lib/components/MouseAgents.svelte` (the arrow, the `--hi` read, the
  sandbox-route exclusion).
- `src/routes/+layout.svelte`, `+layout.js`, `src/lib/site.js`, `src/app.css`.
- `scripts/sync-assets.js`, `scripts/prerender-audit.js`, `svelte.config.js`,
  `ecosystem.config.cjs`.

Working rules for this repo:

- Do not `git commit` or `git push`. Leave the working tree with your changes in it
  and list what changed.
- Do not invent data. No made-up figure, field name, URL or dataset.
- American English in every string, comment and identifier.
- `npm run audit:freeze` has to keep passing, and `SMT_MODE=archive npm run build`
  has to keep working.
- No new npm dependency. The canvas is DOM and CSS transforms; the realtime layer
  is a streaming `Response`. If you find you need a library, stop and say so in
  the summary instead.
- Every string a student sees is in §9. Use them as written. Where you need a
  string §9 does not have, add it to §9 in your summary rather than inventing it
  silently.
- Kill any dev server you start.

The `.env` values in §11 are Adam's to set, not yours.

## 1. What exists and what is new

| piece | state |
|---|---|
| token identity, `identify()` → `{ kind, student, name }` | built; gains `role` (§2) |
| owner identity | new: `SMT_OWNER` slug in `.env` (§2) |
| JSON persistence, `store.update()` serialized under `var/` | built; boards use it (§3) |
| streaming file route with path containment and MIME map | built for submissions; copy for board assets (§4) |
| multipart upload with the 15MB cap, browser-drawn cover | built in `/api/submit` and `AssignmentSubmit`; reuse the pattern and `drawCover` (§4) |
| realtime | new: SSE hub in module memory (§5) |
| scheduler | new: one-minute ticker in `src/hooks.server.js` (§6) |
| `due: "M/DD"` as a date | new: `dueAt()` in `content.js` (§6) |
| canvas component | new (§7) |
| pages and nav | new: `/whiteboard/` and `/whiteboard/[slug]/`, one line in `site.js` (§8) |
| freeze | new: `scripts/export-boards.js`, `src/boards/`, `src/lib/boards.js` (§10) |

## 2. Owner identity

There is no role anywhere today. Add one field.

- `src/lib/server/config.js`: `owner: env.SMT_OWNER || ''`.
- `src/lib/server/auth.js`, `identify()`: return
  `{ kind: 'student', student, name, role: rec.student === config.owner ? 'owner' : 'student' }`.
  `config.js` is already imported by `store.js`; importing it in `auth.js` is fine.
- `src/routes/api/whoami/+server.js`: add `role` to the reply.
- `.env.example`: a `# --- whiteboard ---` block with `SMT_OWNER=` and one comment
  line saying it is the token slug that may create boards.

Nothing else reads the role. Students and the owner have the same rights on a
board's contents.

## 3. Board data

### 3.1 On disk (live)

```
var/boards/<slug>.json
var/boards/<slug>/assets/<id>.<ext>            original upload
var/boards/<slug>/assets/<id>.display.jpg      browser-drawn copy, images only
```

`var/` is gitignored and machine-local, which is right: a board is runtime state
like the budget and the sessions, and §10 is how it gets into the archive.

### 3.2 The board file

```json
{
  "slug": "assignment-01",
  "title": "Assignment 1: Hello",
  "kind": "assignment",
  "assignment": "assignment-01",
  "created": "2026-09-17T13:00:02.000Z",
  "created_by": "site",
  "version": 412,
  "elements": {
    "k7f3q2": { "...": "..." }
  }
}
```

- `kind` is `assignment` or `exercise`. `assignment` is the assignment slug or
  null. `created_by` is a student slug, or `site` for the ticker.
- `version` is an integer that goes up by one per applied op batch. Clients use it
  to know whether they missed anything.
- `elements` is an object keyed by id, not an array, so an op can address one
  element without scanning. Ids are 6 to 10 chars of `[a-z0-9]`, made by the
  client with `crypto.getRandomValues` (a server-made id would mean waiting for
  the round trip before an element can be drawn).

Element fields, all types:

| field | meaning |
|---|---|
| `id`, `type` | `image`, `video`, `text`, `note`, `tile` |
| `x`, `y`, `w`, `h` | board units (1 unit = 1 css px at zoom 1), numbers |
| `z` | stacking, integer; new elements get `max(z) + 1` |
| `locked` | boolean |
| `by`, `name` | student slug and display name of who added it, or `site` / `Site` |
| `at` | ISO time added |

Per type:

- `image`: `file` (name under `assets/`), `display` (name of the display copy, or
  null if the original was small enough), `natural: { w, h }`.
- `video`: `file`. Rendered `<video autoplay loop muted playsinline>`.
- `text`: `text` (plain, up to 4000 chars), `size` (`normal` | `large`).
- `note`: `text` (plain, up to 1000 chars). Shows `name` and a short time.
- `tile`: `student`, `title`, `gallery_text`, `cover` (url or null), `href`.
  Only the generator makes these (§6). Students can move, lock, unlock and delete
  them like anything else.

### 3.3 The server module: `src/lib/server/boards.js`

One module owns the boards. Everything under `/api/boards` calls into it, and so do
the ticker and the submit hook. Keep the routes thin.

- `SLUG = /^[a-z0-9-]{1,60}$/`, the same shape as submissions.
- `list()` → `[{ slug, title, kind, assignment, created, count, cover }]`. Reads
  `var/boards/*.json`. `cover` is the `display` (or `file`) url of the lowest-`z`
  image on the board, or a tile's cover, or null.
- `get(slug)` → the board or null. Cache boards in a module `Map` after first read;
  the file is the source of truth on restart.
- `create({ slug, title, kind, assignment, by })`. Refuses an existing slug.
- `apply(slug, ops, who)` → `{ version, applied, rejected }`. Applies in order
  under `store.update('boards/<slug>.json')`, then broadcasts (§5). Ops:
  - `{ op: 'add', element }`: refused if the id exists. Server overwrites `by`,
    `name`, `at` from `who`, and clamps `w`, `h` to `[24, 6000]`.
  - `{ op: 'update', id, patch }`: refused if the element is locked, unless the
    patch is exactly `{ locked: false }`. Only these keys may be patched: `x`,
    `y`, `w`, `h`, `z`, `locked`, `text`, `size`.
  - `{ op: 'delete', id }`: refused if locked. Undo is the client sending `add`
    again with the element it kept (§7.6); no trash on the server.
  - `{ op: 'update', ..., transient: true }`: broadcast only, not persisted, not
    versioned. Used for live drag (§7.4).
- `slugify(title)`: lowercase, `[^a-z0-9]+` → `-`, trim `-`, max 60.

### 3.4 Limits

- Text 4000 chars, note 1000, title 140. Ops per request: 50. One client's ops
  requests: at most 20 a second, cursor posts at most 8 a second; over that,
  drop with 429 and no body. Track per token hash in module memory like
  `/api/presence` does, sweep every minute.
- Elements per board: 2000. `add` past that is refused with the §9 message.

## 4. Assets

### 4.1 `POST /api/boards/[slug]/assets`

Multipart, same shape as `/api/submit`:

1. `sameOrigin`, then `identify` (401 with the §9 token message).
2. Refuse on declared `content-length` above `config.maxSubmissionBytes + 2 MB`
   before reading, with the §9 size message. Same cap as a submission, on purpose.
3. Fields: `file` (required) and `display` (optional, a JPEG the browser drew).
4. Extension whitelist: `.png .jpg .jpeg .webp .gif .mp4`. Check the magic bytes
   too (PNG `89 50 4E 47`, JPEG `FF D8 FF`, WEBP `RIFF....WEBP`, GIF `GIF8`, MP4
   `ftyp` at byte 4). Mismatch → 422 with the §9 type message.
5. `display` is kept only if it is a JPEG under 2 MB; otherwise dropped, not an
   error.
6. Name: a fresh id plus the original's extension, lowercased. Write under
   `var/boards/<slug>/assets/`. Reply `{ ok: true, file, display, type }`.

The client draws `display` with the `drawCover` routine from
`AssignmentSubmit.svelte`, lifted into `src/lib/draw-copy.js` and parameterized:
1600 px on the long side, quality steps `[0.85, 0.7, 0.5]` until under 1 MB. Move
the function, do not copy it, and point `AssignmentSubmit` at the new module with
its old 1200 px call. Skip the copy when the original is already under 400 KB.
Videos get no copy.

### 4.2 `GET /api/boards/[slug]/assets/[file]`

Copy `src/routes/api/submissions/[student]/[sandbox]/[...file]/+server.js`. Path
regex `^[a-z0-9]+(\.display)?\.(png|jpg|jpeg|webp|gif|mp4)$`, containment check,
`stat`, 304 on `if-modified-since`, streamed. MIME map adds `.gif` and `.mp4`
(`video/mp4`). Board assets never change in place, so `cache-control` can be
`private, max-age=86400` rather than the submissions route's `no-cache`.

Tiles point at `/api/submissions/<student>/<assignment>/cover.jpg` (or `.png`)
directly. No copy is made.

## 5. Realtime

### 5.1 Why SSE and not WebSockets

Nothing on the site holds a connection open today. A WebSocket needs the `ws`
package and a custom server entry around adapter-node's handler, plus a change to
`ecosystem.config.cjs`. A Server-Sent Events stream is one `GET` route under `/api`
returning a `ReadableStream`, which SvelteKit on adapter-node serves as-is, and
the single-fork PM2 process means one in-memory subscriber list is the whole hub.
Upstream traffic (ops, cursors) is ordinary `POST`.

### 5.2 `GET /api/boards/[slug]/events`

- `identify` first. `EventSource` cannot send headers, so the client does not use
  it: it calls `fetch` with the `authorization` header and reads
  `response.body` with a `TextDecoder`, splitting on blank lines. The token never
  goes in a URL.
- Headers: `content-type: text/event-stream`, `cache-control: no-cache`,
  `x-accel-buffering: no`, `connection: keep-alive`.
- On open, send `event: hello` with `{ version, people: [{ student, name }] }`.
- Every 20 s send `: ping` (a comment line). Cloudflare's tunnel closes idle
  responses; 20 s is under any of its timeouts.
- Register the controller in the hub for that slug with `who`. On `cancel`,
  unregister and broadcast `presence`.
- Events broadcast by the hub: `ops` `{ version, ops, from }`, `cursor`
  `{ student, name, x, y }`, `presence` `{ people }`. `from` is the sender's
  student slug, so a client can skip echoes of its own persisted ops.
- Per-slug subscriber cap 200; past that, 503.

### 5.3 `POST /api/boards/[slug]/cursor`

Body `{ x, y }` in board units. Rebroadcast as `cursor` to every other subscriber
on that board, with `student` and `name` from the token. Not stored. Throttled
per §3.4. A cursor not heard from for 10 s is dropped by the clients.

### 5.4 Reconnect

`fetch` streams do not reconnect on their own. The client retries with backoff
(1 s, 2 s, 4 s, capped at 10 s), shows the §9 "Reconnecting…" banner after the
first failure, and on `hello` compares `version` with its own: if different,
refetch `GET /api/boards/[slug]` and replace state. This also covers a PM2
restart (`max_memory_restart: '600M'` in `ecosystem.config.cjs`).

If SSE proves unreliable through cloudflared in Adam's test (§11), the fallback is
polling `GET /api/boards/[slug]?since=<version>` every 2 s. Build the client so
that swap is one transport module, `src/lib/board-transport.js`, with `connect`,
`send`, `cursor`, `close`.

## 6. Assignment boards

### 6.1 The due moment

`due: "9/17"` is a display string and nothing parses it. Add to
`src/lib/content.js`, next to `startOfDayNY`:

```js
// 9:00 New York on the due date. The year is the year of `publish:`, so a due
// date is never ambiguous, and the DST rule above applies. Null when either
// field is missing.
export function dueAt(d) { ... }
```

Parse `M/D` or `M/DD`, take the year from `publish` (`YYYY-MM-DD`), build
`YYYY-MM-DD`, and return `startOfDayNY(ymd) + 9 * 3600 * 1000`. Today every
`submit: true` assignment except `assignment-05` has both fields, so 05 gets no
automatic board until Adam adds `due:`.

Also export `dueLabel(d)` → `"9/17"` unchanged, so pages have one place to read.

### 6.2 The generator: `src/lib/server/board-generate.js`

`buildAssignmentBoard(slug)`:

1. Read the assignment with `doc('assignments', slug)`; require `submit: true`.
2. Read its submissions from disk. `src/routes/api/submissions/+server.js` walks
   the folders inline; move that walk into `src/lib/server/repo.js` as
   `listSubmissions()` and have the route call it, so the generator does not go
   through HTTP. Filter `published: false` the same way the route does.
3. Create the board if it does not exist: slug = assignment slug, title =
   `Assignment <sequence>: <title>`, `kind: 'assignment'`, `created_by: 'site'`.
   Add one locked `text` element at `(0, -160)`, `size: 'large'`, with the title.
4. For every submission whose student has no `tile` on the board yet, add a locked
   tile. Never move or change tiles that are there. Grid: 4 columns, tile 480
   wide, 600 tall, column pitch 720 (240 of margin), row pitch 840. Position =
   next free cell in row-major order, counting existing tiles, so late tiles land
   after the last one. Shuffle the new tiles into a random order before placing
   them (`crypto.randomInt` Fisher-Yates), so the board does not read as an
   alphabet or a submission timeline. Adam asked for this.
5. Tile fields: `student`, `title` (manifest title), `gallery_text`, `cover`
   (`/api/submissions/<student>/<slug>/<cover_file>` if `cover_file` is set,
   else `.../cover.png`, and null if neither file is on disk), `href`
   (`/gallery/<student>/<slug>/`), `by: 'site'`, `name: 'Site'`.
6. Return `{ created, added }`.

Idempotent: running it twice adds nothing the second time.

### 6.3 The ticker: `src/hooks.server.js`

There is no `hooks.server.js` today. Add one with the `init` hook (SvelteKit
2.10+; the tree has `^2.20.0`):

```js
import { building } from '$app/environment';
export async function init() {
  if (building) return;          // prerender and the archive build
  if (MODE === 'archive') return;
  tick(); setInterval(tick, 60_000).unref();
}
```

`tick()`: for every assignment from `collection('assignments', { all: true })`
with `submit: true`, if `dueAt(a)` is not null, `Date.now() >= dueAt(a)`, and no
board file exists, call `buildAssignmentBoard(a.slug)` and log one line to the
console. Errors are caught and logged, never thrown. Because the check is "past
due and no board", a deploy after a due date builds the missing board on start,
which is how Assignment 1 (due 9/17) gets its board if this ships later.

`scripts/prerender-audit.js` only walks `src/routes`, so the hook does not trip
it. Confirm the archive build still prerenders with the hook present.

### 6.4 Late submissions

In `src/routes/api/submit/+server.js`, after `write()` and `commit()`, if
`manifest.kind === 'assignment'` and a board file exists for that slug, call
`buildAssignmentBoard(sandbox)` without awaiting it (the same non-blocking spirit
as the comment above the return). The new tile is broadcast as an `add` op like
any other.

### 6.5 By hand

`POST /api/boards/[slug]/generate`, owner only, calls the generator and returns
its result. The board page shows the §9 "add new submissions" button to the owner
on assignment boards. No standalone `scripts/` entry: `config.js` reads
`$env/dynamic/private`, which plain node cannot import, so a script would have to
duplicate the store and config. The route is the manual path; a `curl` with the
owner token does the same from a shell.

## 7. The canvas: `src/lib/components/Whiteboard.svelte`

Props: `slug`, `mode` (`edit` | `view`), `initial` (the board, in view mode),
`who` (`{ student, name, role }` or null). Split the internals into
`src/lib/board/` (`transport.js`, `geometry.js`, `linkify.js`) if the component
passes ~600 lines; keep one component in the tree.

### 7.1 Surface

- The page is `wide: 'full'`, `showTitle: false`. The board fills the viewport
  below `--chrome-top` to the bottom edge, `overflow: hidden`.
- Background `--bg` with a dot grid: `radial-gradient(var(--rule) 1px, transparent 1px)`
  at 32 board units, moving with the pan and scaling with the zoom.
- One inner `<div class="stage">` with `transform: translate(px, py) scale(k)`
  and `transform-origin: 0 0`. Every element is `position: absolute` inside it
  at its `x, y, w, h`. No `<canvas>` for content; the only canvas is the cursor
  overlay (§7.8).
- Pan: space + drag, middle button drag, or two-finger scroll (wheel without
  ctrl). Zoom: ctrl/cmd + wheel and pinch, about the cursor, clamped `[0.1, 4]`.
  Store the view in `sessionStorage` per slug (try/catch, like `token.js`).
- `MouseAgents.svelte` already stays off inside `/sandboxes/`; add
  `/whiteboard/` with a slug to the same test. The board owns the pointer.

### 7.2 Elements

- `image`: `<img src=display ?? file>` with `draggable="false"`; double-click
  opens the original in a new tab. Aspect kept on resize.
- `video`: `<video autoplay loop muted playsinline>` with the same handles.
- `text`: white on the blue, `font: inherit`, `normal` 0.9rem / `large` 1.6rem,
  `line-height: 1.5`, no background, `white-space: pre-wrap`. Editing is a
  `contenteditable="plaintext-only"` on double-click (fall back to
  `contenteditable="true"` with paste sanitized to text where the browser lacks
  it). Commit on blur or Escape; `text` op then. Links are made at render
  time from the plain text with `inlineMarkdown()` from
  `src/lib/inline-markdown.js` (markdown-it, `html: false`, `linkify: true`,
  opens in a new tab). That module escapes raw HTML, which is what makes
  `{@html}` safe here; do not build a second linkifier.
- `note`: background `--hi`, color `--hi-fg`, 0.8rem, padding 0.75rem, a 1px
  `--hi-fg` border at 25% for the edge, default 220 × 220. Same editing as text.
  Footer row in 0.62rem: `name` and the time as `9/17 10:04` in New York.
- `tile`: 480 wide. Cover in a 4:3 box (`--code-bg` behind it, hidden on
  `onerror` like the gallery), then title bold 0.9rem, student name 0.8rem
  `--fg-dim`, gallery text 0.8rem, and the §9 link. Same look as
  `.project-card` in `app.css`; reuse those classes where they fit.
- Every element in `edit` mode gets a 1px `--rule` outline on hover and a 2px
  `--hi` outline when selected. Locked elements show a small pill at the top
  right on hover with the §9 lock label.

### 7.3 Adding

- Double-click on empty stage: a three-item menu at the pointer (§9), positioned
  in screen space, closed by Escape, a click elsewhere, or choosing. `Image`
  opens a file input (`accept` from §4.1's list); `Text` and `Note` add an
  element at that board point and open it for editing at once.
- Drop: `dragover` on the stage sets `dropEffect = 'copy'`; `drop` takes every
  file in `dataTransfer.files`, rejects with the §9 messages by size and type
  before uploading, and places them at the drop point, offset 40 units each.
  Paste (`ctrl/cmd + V`) with image data in the clipboard does the same at the
  last pointer position; pasted plain text becomes a `text` element.
- While uploading, draw a `--code-bg` box of the image's natural size (read with
  `createImageBitmap`) scaled so the long side is 480, with the §9 uploading
  label. On reply, send the `add` op. On failure remove the box and show the
  error as a toast (§7.6).

### 7.4 Moving and resizing

- Drag with the primary button on an unlocked element (or on any element of the
  selection). Send `update { x, y, transient: true }` at most 10 times a second
  while dragging, and a persisted `update` on pointer-up. Other clients apply
  transient updates directly; nothing is echoed to the sender.
- Resize from the bottom-right handle; images and video keep aspect. Text and
  note resize freely, minimum 24 × 24.
- Arrow keys nudge the selection 1 unit (10 with shift). Delete/Backspace
  deletes (§7.6). Escape clears the selection.

### 7.5 Selecting and locking

- Click selects. Shift-click adds. Dragging on empty stage draws a marquee
  (`--hi` at 1px, 10% fill) and selects what it touches.
- A floating toolbar appears above the selection's bounding box: the count (§9),
  then `lock` or `unlock` (unlock if any selected element is locked), `delete`
  (only when none are locked), and for a single text element the size toggle.
- Clicking a locked element selects it too; the toolbar then shows `unlock` and
  nothing else. Anyone can unlock anything, including the generated tiles.
- Locked elements do not move, resize, edit or delete, on the client and again on
  the server (§3.3).

### 7.6 Delete and undo

Delete sends the `delete` op and keeps the elements in a local list for 6 s. A
toast at the bottom center shows the §9 deleted message with an `undo` button;
undo sends `add` with the kept elements (same ids) and dismisses. After 6 s the
list is dropped. Toasts are also how upload errors show; one at a time, newest
replaces.

### 7.7 Sync

- On mount: `GET /api/boards/[slug]` → state, then open the stream (§5.2).
- Local ops apply immediately, then post. On a 4xx reply for an op (locked,
  cap), refetch the board and show the reply's message as a toast.
- Incoming `ops` with `from === who.student` and a version the client already
  applied are skipped; anything else applies in order. A version gap (incoming
  `version` > local + 1) triggers a refetch.
- Presence count from `hello` and `presence` events shows in the header bar (§9).

### 7.8 Cursors

- Send the pointer's board position at most 5 times a second while it is over
  the stage, and once with `{ x: null, y: null }` on leave.
- Draw other people's cursors on one full-board `<canvas>` overlay above the
  stage, `pointer-events: none`: the same 12 px arrow as `MouseAgents.svelte`
  (copy `draw()`), color `--hi` read the same way, with the display name in
  0.62rem `--hi-fg` on a `--hi` pill at the arrow's lower right. Ease each cursor
  toward its last received position over ~120 ms so 5 Hz does not stutter.
- Only in `edit` mode. Not on touch.

### 7.9 View mode

`mode: 'view'` (archive): no stream, no cursor, no editing, no double-click menu,
no toolbar. Pan and zoom only, plus the §9 frozen banner. Tiles still link.

## 8. Pages and nav

- `src/lib/site.js`: add `{ href: '/whiteboard/', label: 'Whiteboard' }` after
  Student Work.
- `src/routes/whiteboard/+page.js`: `prerender = MODE === 'archive'`; returns
  `{ title: 'Whiteboard', wide: true }` and, in archive mode, the board list from
  `src/lib/boards.js` (§10). In live mode the page fetches `/api/boards` on the
  client with the token; with no token it shows the token row and the §9 gate
  line and nothing else.
- `src/routes/whiteboard/+page.svelte`: the §9 intro line, the two-way toggle
  (`Assignments` / `Exercises`, the active one in `--hi` / `--hi-fg`, remembered
  in `localStorage` with try/catch, default Assignments), the card grid using
  `.project-grid` / `.project-card` from `app.css`, and the new-board square
  last in the grid: dashed 1px `--rule` border, a `+` at 2rem centered, the §9
  label under it, 4:3 like the cards. Click: if `who.role !== 'owner'`, show the
  §9 tooltip anchored to the square, fading out over 1.5 s; else open the create
  dialog (a modal in the `AssignmentSubmit` style: title input, kind radio with
  Exercise selected, Create and Cancel). Create posts `POST /api/boards` and
  navigates to the new board.
- `src/routes/whiteboard/[slug]/+page.js`: `prerender = MODE === 'archive'`;
  `entries()` from the archive glob; returns `{ title: <board title or slug>,
  showTitle: false, wide: 'full' }` and in archive mode the board itself.
- `src/routes/whiteboard/[slug]/+page.svelte`: a slim header bar under the nav
  (board title, the §9 back link, the presence count, and for the owner on an
  assignment board the §9 add-new-submissions button), then `<Whiteboard>`.
  Token handling as on the index.
- `src/routes/assignments/[slug]/+page.svelte`: after the submit row, show the
  §9 board link only once the board exists. In live mode the `load` calls
  `GET /api/boards/[slug]/exists` (below), which needs no token and returns
  204 or 404 with no body; in archive mode it checks the glob in
  `src/lib/boards.js`. Do not use the due time as a proxy; the link means the
  board is there.
- The syllabus links to exercise boards by hand; the `[In-class exercise](link-to-exercise)`
  placeholder in `syllabus.md` is Adam's to fill with `/whiteboard/<slug>/`.

`/api/boards` routes:

| route | method | who | does |
|---|---|---|---|
| `/api/boards` | GET | token | `list()` |
| `/api/boards` | POST | owner | `create()`; 403 with the §9 not-adam message otherwise |
| `/api/boards/[slug]` | GET | token | the board; `?since=<v>` returns `{ version, unchanged: true }` when equal |
| `/api/boards/[slug]/exists` | GET | anyone | 204 if the board file exists, 404 otherwise, no body. Only the assignment page calls it |
| `/api/boards/[slug]/ops` | POST | token | `apply()` |
| `/api/boards/[slug]/events` | GET | token | the stream |
| `/api/boards/[slug]/cursor` | POST | token | rebroadcast |
| `/api/boards/[slug]/assets` | POST | token | upload |
| `/api/boards/[slug]/assets/[file]` | GET | token | serve |
| `/api/boards/[slug]/generate` | POST | owner | `buildAssignmentBoard()` |

Every route: `sameOrigin` on POST, `identify` on all, `cache-control: no-store`
on JSON. Add the routes to the index in `src/routes/api/+server.js`.

## 9. Every string on the pages

Use these as written. Sentence case, no trailing periods on labels, periods on
sentences. `<n>` and `<name>` are substitutions.

**Nav**

- Tab: `Whiteboard`

**Index page `/whiteboard/`**

- Title (from load): `Whiteboard`
- Intro line under the title: `Boards for pin-ups and in-class exercises.`
- Toggle: `Assignments` · `Exercises`
- Empty, Assignments: `Nothing here yet. An assignment board appears at 9am on the morning it is due.`
- Empty, Exercises: `Nothing here yet.`
- Card line 2, assignment board: `Assignment <n> · due <M/D>` (from `dueLabel`)
- Card line 2, exercise board: `Exercise · <M/D>` (the created date, New York)
- Card line 3: `<n> items` (`1 item`)
- New-board square label: `New board`
- Tooltip, not the owner: `you're not adam!`
- Create dialog title: `New board`
- Field labels: `Title`, `Kind`; radio options: `Exercise`, `Assignment`
- Buttons: `Create`, `Cancel`
- Create errors: `Give the board a title.` · `A board with that name already exists.`

**Token gate (index and board pages, no token stored)**

- Line: `This page needs your submission token.`
- Token row, copied from `Assistant.svelte`: label `Submission token`, placeholder
  `paste it once`, buttons `save`, `replace`, `cancel`
- Note under the row: `From the enrollment link you were emailed. The browser keeps it.`
- Server 401 body, all board routes: `This needs your submission token. Open the enrollment link I emailed you at the start of the semester and this browser will remember it, or paste the token itself into the box. Lost the email? Ask me and I will send a new one.` (the same sentence `/api/submit` uses)

**Board page header**

- Back link: `← Whiteboard`
- Presence: `<n> here` (`1 here`)
- Owner button, assignment boards: `add new submissions`; after it runs:
  `Added <n>.` or `Nothing new.`
- Hint, shown until the first add or drop on this browser, then remembered:
  `Double-click to add something. Drop an image anywhere. Hold space and drag, or scroll, to move around.`
- Reconnecting banner: `Reconnecting…`
- Frozen banner (archive): `Frozen at the end of the semester.`

**Double-click menu**

- `Image` · `Text` · `Note`

**Elements**

- Text placeholder: `Type here`
- Note placeholder: `Write a note`
- Note footer: `<name> · <M/D H:MM>` (e.g. `Adam Vosburgh · 9/17 10:04`)
- Tile link: `Open in Student Work`
- Uploading box: `Uploading…`
- Locked pill on hover: `locked`

**Selection toolbar**

- Count: `<n> selected` (`1 selected`)
- Buttons: `lock` · `unlock` · `delete` · `large` · `normal`

**Toasts**

- Deleted: `Deleted.` with button `undo`
- Too big: `That file is <n>MB. The limit is 15MB.` (one decimal, e.g. `18.2MB`)
- Wrong type: `Images, GIFs and mp4 only.`
- Upload failed: `The upload did not go through. Try again.`
- Board full: `This board is full.`
- Locked (server refused): `That one is locked.`

**Assignment page**

- Link under the submit row: `Assignment <n> Whiteboard` → `/whiteboard/assignment-0<n>/`

**Generated board**

- Board title: `Assignment <n>: <title>` (e.g. `Assignment 1: Hello`)
- Title text element: the same string

**Server messages not shown to students** (console): keep them one line each,
prefixed `boards:`.

## 10. The freeze

The 07-31 infrastructure doc asked for canvas positions and notes to be baked into
static data at the end of the semester. This is that.

- `scripts/export-boards.js`: copies `var/boards/<slug>.json` to
  `src/boards/<slug>/board.json` and `var/boards/<slug>/assets/` to
  `src/boards/<slug>/assets/`, rewriting `/api/boards/<slug>/assets/` to
  `/boards/<slug>/assets/` and `/api/submissions/` to `/submissions/` in element
  urls. Idempotent; run before `SMT_MODE=archive npm run build`. Add
  `"boards:export": "node scripts/export-boards.js"` to `package.json` without
  touching `predev` / `prebuild`.
- `scripts/sync-assets.js`: mirror `src/boards` → `static/boards` in archive mode
  only, and delete `static/boards` otherwise, the same as submissions.
- `src/lib/boards.js`, universal, the shape of `submissions.js`: in archive mode
  `import.meta.glob('/src/boards/*/board.json', { eager: true })`; in live mode
  the API. Exports `boards(fetch)` and `board(fetch, slug)`.
- `.gitignore`: nothing new. `src/boards/` is committed at the freeze like
  `src/submissions/`; until then it is empty. Do not create an example board.
- Add `/boards/` to the `handleHttpError` allowance in `svelte.config.js` next to
  `/covers/` and `/submissions/`.

## 11. Adam's part

Listed so you know what is outside the build, not for you to do.

- `SMT_OWNER=vosburgh-adam` in `/opt/smt-fa2026/.env` on the box (the file PM2
  reads). The checkout's `.env` is a different file.
- After deploy, open a board in two browsers on two networks and confirm an
  added note shows up on the other within a second. If it does not, the
  cloudflared tunnel is buffering the stream; the §5.4 polling fallback is the
  fix, and it is a one-module swap.
- Fill the syllabus's `link-to-exercise` placeholders with `/whiteboard/<slug>/`
  once the exercise boards exist.
- `assignment-05.md` has no `due:`; add one if it should get a board.

## 12. What is verified and what is not

Verified by reading the tree on 2026-09-16: no board, whiteboard, websocket, SSE
or lock code exists; `identify()` returns `{ kind, student, name }` and has no
role; `store.update` is single-process and writes the whole file; `/api/presence`
is module memory; `MouseAgents` reads `--hi` at runtime and skips sandbox routes;
`due:` is read only by the gallery page as a string; `assignment-01` through `-04`
have `due:` and `publish:`; `-05` has `submit: true` and `publish:` but no
`due:`; `prerender-audit.js`
walks only `src/routes`; `@sveltejs/kit` is `^2.20.0`; `AssignmentSubmit.svelte`
has `drawCover` at 1200 px with quality steps `[0.85, 0.7, 0.5]`.

Not verified: that SvelteKit's `init` hook fires under adapter-node's `build/index.js`
in this version (check the installed kit's changelog; if not, start the ticker from
`handle` on first request instead); that cloudflared passes SSE without buffering;
`contenteditable="plaintext-only"` support in current Safari.

## 13. Verification

- `npm run dev`, two browser windows with two different tokens (issue a second
  test token with `npm run tokens -- --dry-run` first to see the flow, then a
  real one into a scratch `var/tokens.json`): add, move, lock, unlock, delete,
  undo, drop an image, drop an mp4, paste an image, paste a link; every action
  appears in the other window. Cursors with names move in both.
- Check the browser console on every page, not the HTTP status.
- Set `due: "9/16"` on a copy of an assignment in a scratch tree, or temporarily
  change `dueAt` to return `Date.now() - 1`, restart, and confirm the board is
  built once and not twice. Upload a submission to that assignment and confirm a
  new locked tile appears without a restart.
- Not-owner click on the new-board square shows the tooltip and posts nothing;
  the owner creates a board; `POST /api/boards` with a student token is 403.
- `curl -N -H "authorization: Bearer <token>" localhost:5173/api/boards/<slug>/events`
  shows `hello`, then `: ping` every 20 s, then `ops` when the other window acts.
- Kill and restart the dev server with a board open: the banner shows, the
  stream comes back, and a note added during the outage in the other window
  appears after reconnect.
- `npm run audit:freeze` clean. `node scripts/export-boards.js`, then
  `SMT_MODE=archive npm run build`, then serve `build/` with any static server:
  `/whiteboard/` lists the board, `/whiteboard/<slug>/` renders it read-only
  with images from `/boards/<slug>/assets/`.
- `node scripts/agent-frame-time.js --base http://localhost:5173` unchanged.

## 14. Order of work

1. §2 owner role and whoami. §3 the boards module and `GET/POST /api/boards`,
   `GET /api/boards/[slug]`, `POST .../ops`. Test with curl.
2. §4 assets, both routes, and the `drawCover` move.
3. §7 the component with local state only, on the board page (§8), with the
   token gate. Get every interaction right in one window first.
4. §5 the stream, cursors, reconnect. Two windows.
5. §6 `dueAt`, `listSubmissions`, the generator, the ticker, the submit hook,
   the generate route and owner button.
6. §8 the index page, nav, the assignment-page link.
7. §10 export, sync, `boards.js`, archive build.
8. `npm run audit:freeze`. Report what changed file by file, the §9 strings you
   added, anything in §12 you could verify, and anything here you could not do
   as written.
