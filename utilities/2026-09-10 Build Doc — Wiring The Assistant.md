---
title: Build Doc — Wiring The Assistant
date: 2026-09-10
type: build-doc
---

# Build Doc — Wiring The Assistant

For Claude Code. Repo `smt-fa2026`. Written 2026-09-10, revised the same day after Adam
settled the context question (§5).

The assistant is built but not on. `Assistant.svelte`, `/api/assistant`, `server/budget.js`,
`server/auth.js`, `server/store.js` and the PM2 `--env-file` setup all exist and agree with
each other. This document closes the gaps between what is built and what the site says is
built, and gives the assistant the text of the page a student is looking at. It does not
change the route's budget or auth logic.

Counts in this document were measured against the working tree on 2026-09-10.

## 0. Read first

- `CLAUDE.md`, in full. The freeze rule under "Platform and build traps" is why §2 is
  done the way it is.
- `src/routes/api/assistant/+server.js`, including its header comment.
- `src/lib/server/assistant-prompt.js`, `src/lib/sandboxes/index.js`,
  `src/lib/sandboxes/cards.js`, `src/lib/visibility.js`.
- `src/lib/content.js` (`parse`, `collection`, `doc`, `isLive`).
- `src/routes/resources/[slug]/+page.js` and `+page.svelte`.
- `svelte.config.js` and `src/routes/+layout.js`.

Working rules for this repo:

- Do not `git commit` or `git push`. Leave the working tree with your changes in it and
  list what changed.
- Do not invent data. No made-up figure, field name, URL or dataset.
- American English in every string, comment and identifier.
- `npm run audit:freeze` has to keep passing.
- Prose you write is a draft for Adam to rewrite. Start each new prose file with
  `<!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->`.
  `src/content/resources/assistant.md` is already Adam's; do not rewrite it, only fix a
  path in it if one changes.
- Kill any dev server you start.

The `.env` values in §6 are Adam's to set, not yours.

## 1. State of play

| piece | state |
|---|---|
| `Assistant.svelte`, mounted in `+layout.svelte` | built |
| `POST /api/assistant`, server-held transcript | built |
| `GET /api/assistant`, the enabled probe | built |
| `server/budget.js`, daily ceiling + per-identity allowance | built |
| `server/auth.js`, token identity, shared with `/api/submit` | built |
| `server/assistant-prompt.js` | built, needs to move out of `server/` (§2) |
| `/resources/assistant/` | prose done, `published: false`, needs the prompt rendered (§3) |
| the sandbox count in the prompt | hardcoded "seven", should be five (§4) |
| what the prompt carries | sandbox catalog only; the site says more (§5) |
| the `sandbox` hint the client sends | wrong on tutorial pages (§5.5) |
| `.env` | assistant off, no API key (§6, Adam) |

With `SMT_ASSISTANT_ENABLED=false` and an empty `ANTHROPIC_API_KEY`, the route returns 503
and `Assistant.svelte` hides its button, so nothing in §2–§5 is visible on the running site
until §6 is done. Test with a `.env` of your own under `npm run dev`. Do not put a key in
the repo's `.env`.

## 2. Move `assistant-prompt.js` out of `src/lib/server/`

### 2.1 Why

`/resources/assistant/` prints the system prompt (§3). There are three ways to get the
prompt onto that page, and two of them break the December freeze:

- A `+page.server.js` on the resources route. `src/routes/+layout.js` sets
  `prerender = true` for everything outside `/api`, and `svelte.config.js` says nothing
  outside `/api` may depend on a server-only load. `npm run audit:freeze` fails.
- Fetching a new `/api/assistant/prompt` from the client. `/api` is left out of the archive
  build (`src/routes/api/+layout.js`), so the frozen site would show an empty page.
- Importing `systemPrompt()` into the page component and letting it render at prerender
  time. This works in both modes, so it is what to do.

The third is blocked today only by the folder: SvelteKit refuses any import of
`$lib/server/*` from code that reaches the browser, and fails the build.

The move is safe. `assistant-prompt.js` imports one module, `../sandboxes/index.js`, which
the browser already loads for the param panels. It reads no environment variable and touches
no filesystem. Its own header says the prompt is published on purpose, so there is nothing in
it to keep on the server. After §5 it will also import from `content.js`, which is a universal
module too.

### 2.2 The move

- `git mv src/lib/server/assistant-prompt.js src/lib/assistant-prompt.js`.
- Update the import in `src/routes/api/assistant/+server.js` to `$lib/assistant-prompt.js`.
- Add two sentences to the module header saying why it is not in `server/`: it is printed on
  `/resources/assistant/`, that page prerenders, and a prerendered page cannot import
  `$lib/server`.
- `assistant.md` already names the new path. The `meta.js` header comments in
  `src/lib/sandboxes/*/` name the old one; update those. Vault build docs also name the old
  path; leave them, they are dated records.
- `grep -rn "server/assistant-prompt" src scripts` should come back empty.

### 2.3 Acceptance

- `npm run build` succeeds.
- `SMT_MODE=archive npm run build` succeeds and `npm run audit:freeze` passes.
- The assistant still answers under `npm run dev` with a key set.

## 3. `/resources/assistant/` prints the prompt

`src/content/resources/assistant.md` has Adam's prose and, under `## The prompt`, a
sentence saying the prompt is printed below. Nothing prints it yet. The page is
`published: false`, while `Assistant.svelte` links to it from its panel and
`src/content/tutorials/01-setting-up.md` links to it from the first week. Both links are
dead to a student today.

### 3.1 How to render it

The frontmatter already carries `renders: assistant-prompt`, so the route does not need to
special-case the slug.

- In `src/routes/resources/[slug]/+page.svelte`, import `systemPrompt` from
  `$lib/assistant-prompt.js` and, when `data.doc.renders === 'assistant-prompt'`, render
  `systemPrompt()` after the prose inside a `<pre>`.
- Call it with no argument. With no context there is no "the student is on..." line and no
  page text (§5), which is right for a page showing the standing prompt.
- `parse()` in `content.js` spreads all frontmatter onto the document, so `data.doc.renders`
  is already there.
- Style the `<pre>` like the site's existing code blocks: `--code-bg`, the body monospace,
  `white-space: pre-wrap`, a rule above it. No copy button, no highlighting.

The prompt is baked in at prerender time. That matches the sentence on the page, which says
it is the prompt as of this build.

### 3.2 Publishing

Set `published: true` in `assistant.md` last, after §4 and §5, so a student never reads a
page that describes a prompt the site is not yet sending. It is the only resource with
`sequence: 1`, so it will be first on `/resources/`; leave that.

### 3.3 Acceptance

- `/resources/assistant/` is reachable, is listed on `/resources/`, and the text under
  `## The prompt` matches `systemPrompt()` with no argument.
- `npm run audit:freeze` passes with the page prerendered.
- The panel link and the Tutorial 1 link both resolve.

## 4. The sandbox count

`assistant-prompt.js` says "The site has seven sandboxes." `sandboxes` in
`src/lib/sandboxes/index.js` is `allSandboxes` filtered by `published !== false`, and today
that is five: pencil, after-five, coefficients, anthromes, bathtub. Studio twin and sunlight
are `published: false`. Seven is `allSandboxes.length`, and the catalog under that sentence
is built from `sandboxes`, so the sentence and the list disagree.

Take the number from `sandboxes.length`. Spell it as a word for one through ten and use
digits above that. The count then changes on its own when sunlight is unhidden.

Acceptance: with no flags the rendered prompt says five and lists five. Under
`SMT_SHOW_UNPUBLISHED=1 npm run dev` it says seven and lists seven.

## 5. What the prompt carries

### 5.1 Today

The prompt carries the sandbox catalog and nothing else: `subtitle`, `controls` and
`cannotSee` from each published `meta.js`, plus the behavior instructions. No tutorial text,
no dev notes, no `card.md`. It also tells itself to "point them at the tutorial section by
name," which it cannot do well, because it has never seen a tutorial heading.

Two published sentences promise more. Tutorial 1 says the assistant "uses the content of the
site as a reference" and "can point you in the right direction if you get stumped" when a
student is "tweaking the tutorials." `assistant.md` says it has "the section headings of every
tutorial, and the full text of whichever page you have open."

### 5.2 The decision, 2026-09-10

Adam chose: the prompt gets a heading index of every live tutorial and dev note, plus the
full text of the page the student has open. Not the whole corpus, and no prompt caching for
now.

The reason is what the assistant is for. The assignments ask students to change the tutorial
they are on. An index alone lets the assistant name a section; the page text lets it talk
about the code in front of the student. The whole corpus would cost about 45,000 tokens a
turn, which the 2M/day ceiling does not cover for a class of thirty.

### 5.3 Sizes, measured 2026-09-10

Bytes on disk. Token figures are estimates at about four characters per token. Treat them as
an order of magnitude.

| body | chars | ≈ tokens |
|---|---|---|
| every `##`/`###` heading in `src/content/tutorials/` (99 lines, all 11 files) | 2,277 | ~600 |
| the same, live today (only Tutorial 1; every dev note is `published: false`, 5 lines) | 97 | ~25 |
| longest weekly tutorial, `02-mapping-where.md` | 28,131 | ~7,000 |
| a typical weekly tutorial | 12,000–17,000 | ~3,000–4,000 |
| longest `card.md` (sunlight) | 7,742 | ~1,900 |
| the current prompt, module and all | 3,003 | ~750 |

An earlier draft of this document put the heading index at 11,558 chars over 147 headings.
That count was wrong; the numbers above are from `grep "^##"` over the eleven files.

Per turn after this change: ~750 (prompt) + ~600 (index) + the page (0 to ~7,000) + the
transcript so far + up to 900 out. Call it 3,000–9,000 tokens a turn. At the 2M/day ceiling
that is roughly 200–600 messages a day across the whole site, against 44 with the whole corpus.
If that turns out to be tight before a deadline, the ceiling is Adam's number to raise (§6).

### 5.4 The build

Three pieces. Keep them separate so the browser bundle does not grow.

**(a) Headings, in `content.js`.** In `parse()`, add a `headings` array to each document,
built from the rendered `html` rather than the markdown, so the ids match the anchors the
site already uses. Match `<h2 ...>` and `<h3 ...>` with their `id`, strip the inner tags
(markdown-it-anchor wraps the text in a permalink `<a>`), and keep `{ level, id, text }`.
This is small; the module already carries the rendered html.

**(b) The index, in `assistant-prompt.js`.** After the sandbox catalog, add a section
listing each live tutorial from `collection('tutorials')` (live only; that function already
applies `isLive()`, so a tutorial that has not reached its `publish:` date stays out). Split
weekly tutorials from dev notes on `devnotes: true` (all six dev notes are `published: false`
today, so the dev-notes half of the index is empty until Adam publishes them). For each, one line with the title and
url, then its headings indented, `##` and `###` at two depths. Under the index, one sentence:
the assistant has these headings and not the text, and should name a section (title and
heading) rather than paraphrase one it has not read.

Watch the import direction. `content.js` eagerly globs and renders every markdown file. The
resources page already imports it, so nothing new lands there. Check that nothing else
importing the prompt module pulls `content.js` into a page that did not have it; the API
route is server-side and does not matter.

**(c) The page text, server-only.** A new module `src/lib/server/page-text.js` that does its
own raw globs (`import.meta.glob` needs an inline literal; two globs, one for
`/src/content/**/*.md` and one for `/src/lib/sandboxes/*/card.md`) and exports
`pageText(pathname)`:

- `/tutorials/<slug>/`, `/assignments/<slug>/`, `/resources/<slug>/`: the markdown body of
  `doc(section, slug)` if `isLive()` says it is live, with the frontmatter and the trailing
  image reference lines (`[NAME]: /path`) removed. Otherwise null.
- `/sandboxes/<slug>/`: that sandbox's `card.md` if the slug is in `sandboxes` (published),
  with the leading HTML comment stripped the way `cards.js` does. Otherwise null.
- Anything else (gallery, syllabus, index pages): null.
- Cap the text at 40,000 chars; nothing today is near it.

The raw markdown, not the html, goes to the model. It is shorter and it is what the student
sees in the tutorial's code blocks.

In `+server.js`, set `context.pageText = pageText(context.page)` after the existing context
block. In `systemPrompt(context)`, when `context.pageText` is present, append a final block:
a one-line heading saying this is the text of the page the student has open, the url, then
the text. With no context (the resources page) none of this appears.

### 5.5 The `sandbox` hint is wrong on tutorial pages

`Assistant.svelte` sends `sandbox: page.params.slug ?? page.params.sandbox ?? ''`. On
`/tutorials/01-setting-up/` that is `01-setting-up`, and the prompt then says "The student is
currently on the 01-setting-up sandbox." Fix it in the route rather than the component: keep
`context.sandbox` only when `context.page` starts with `/sandboxes/`, and take the slug from
the path. With the page text in the prompt (§5.4c) the sandbox line is mostly redundant, but
it is cheap and it is right once fixed.

### 5.6 Acceptance

- `systemPrompt()` with no argument: catalog, then the index, no page text. Under
  `SMT_SHOW_UNPUBLISHED=1` the index lists all eleven; without it, only the live ones.
- `systemPrompt({ page: '/tutorials/01-setting-up/', pageText })` ends with the tutorial's
  markdown, frontmatter removed.
- `pageText('/tutorials/02-mapping-where/')` is null before 2026-09-17 with no flags, and
  the text on or after it.
- `pageText('/sandboxes/pencil/')` is the pencil card; `pageText('/sandboxes/sunlight/')` is
  null with no flags.
- On a tutorial page the prompt has no "currently on the ... sandbox" line.
- `npm run audit:freeze` still passes.
- The client bundle for `/resources/assistant/` did not grow by the size of the corpus
  (compare `npm run build` output before and after).

### 5.7 Later, if the budget is tight: prompt caching

Not now. Noted so it is not rediscovered. The system prompt is the same for every turn on a
given page, so it could be sent as a system block with `cache_control: { type: 'ephemeral' }`
and reads would be billed at the cached rate. Two things would have to change with it:
`record()` in the route adds `usage.input_tokens + usage.output_tokens`, and with caching the
API reports the cached prefix under `cache_read_input_tokens` and
`cache_creation_input_tokens` while `input_tokens` shrinks to the rest, so the ledger would
undercount unless it adds all four. And the field names above are from the API docs, not
observed here; check them against a real response first.

## 6. Adam's part

Listed so you know why the assistant is dark, not for you to do.

- **The two switches.** `SMT_ASSISTANT_ENABLED=true` and a real `ANTHROPIC_API_KEY`, in
  `/opt/smt-fa2026/.env` on the box. That is the file PM2 reads through `--env-file`
  (`ecosystem.config.cjs`). The repo checkout's `.env` is a different file and changing it
  does nothing to the live site.
- **The ceiling.** `SMT_ASSISTANT_DAILY_TOKENS=2000000` is the `.env.example` default. After
  §5 it covers a few hundred messages a day site-wide (§5.3). At current Sonnet-class input
  pricing that ceiling is on the order of a few dollars a day at most; check the price list
  for the model chosen.
- **The model id.** `SMT_ASSISTANT_MODEL=claude-sonnet-4-5` has not been checked here (no
  key in this tree). An id the API rejects reaches the student as "The assistant could not be
  reached," because the route turns every upstream failure into that one message. One `curl`
  against the Messages API before students see it would confirm the id, and there may be a
  newer model worth using.
- **Tokens issued.** Anonymous visitors get `SMT_ASSISTANT_ANON_MSGS=10` a day; the student
  allowance (`SMT_ASSISTANT_STUDENT_MSGS=200`) needs a token in `var/tokens.json`. See
  `npm run tokens`.

## 7. What is verified and what is not

Verified by reading the tree on 2026-09-10: the file inventory in §1; that
`assistant-prompt.js` imports only `../sandboxes/index.js`; that `+layout.js` prerenders
everything outside `/api`; that `parse()` spreads frontmatter and does not keep the markdown
body; that `sandboxes` is filtered by `published`, that five are published and the prompt says
seven; `renders: assistant-prompt` and `published: false` in `assistant.md`; that
`Assistant.svelte` sends `page.params.slug` as `sandbox` on every `[slug]` route; every count
in §5.3; that `cards.js` globs `card.md` and strips a leading comment.

Not verified: that `claude-sonnet-4-5` resolves (no key); the token-per-char ratio in §5.3;
the cache field names in §5.7; current API pricing.

## 8. Order of work

1. §2, the move. Build both modes and run `audit:freeze` before going on.
2. §4, the count.
3. §5.4a and §5.4b, headings and the index. Build both modes again.
4. §5.4c and §5.5, the page text and the sandbox hint. Test with your own `.env` under
   `npm run dev`.
5. §3.1, the render. Leave `published: false` in place.
6. §3.2, publish the page.
7. Report what changed, file by file, and anything in §7 you were able to verify.
