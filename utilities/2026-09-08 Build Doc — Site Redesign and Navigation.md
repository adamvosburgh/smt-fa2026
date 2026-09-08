---
title: Build Doc — Site Redesign and Navigation
date: 2026-09-08
type: build-doc
---

# Build Doc — Site Redesign and Navigation

For Claude Code, on Opus. Repo `smt-fa2026`. Written 2026-09-08 from Adam's 09-06 revision notes and his 09-08 answers. Independent of the sandbox build doc of the same date except where §5 says so; do this one first, it is smaller.

## 0. Read first

- `CLAUDE.md`. The rules there apply: never commit or push, never invent, American English, kill dev servers.
- `src/app.css`, `src/routes/+layout.svelte`, `src/routes/+page.svelte` and `+page.js`, `src/lib/content.js`, `src/routes/tutorials/` and `src/routes/assignments/`, `vite.config.js` (the `__SMT_MODE__` define pattern), `src/routes/api/`.
- What is already done on 09-08 and must not be redone: the syllabus is rewritten (`src/content/syllabus/syllabus.md`) with `{#week-N}` ids on every week heading and class plans in HTML comments; the projects page (`src/content/resources/references.md`) is organized by week with `{#week-N}` ids; the readings page is deleted; assignments are renumbered 1–5 and every tutorial and assignment carries a `publish:` date in its frontmatter; British spellings are gone.

## 1. Color scheme

Site-wide, every page except the inside of a sandbox's floating panels and the maps themselves (those stay neutral; see the sandbox build doc §2.1). Define tokens once at `:root` in `app.css` and use them everywhere; no literal colors elsewhere.

```
--bg:        #2424e0;   /* blue. Adam asked for RGB blue softened for reading; he will tune this one value */
--fg:        #ffffff;   /* text */
--hi:        #00ff00;   /* highlight: selection, hover, active nav, links on hover */
--hi-fg:     #000000;   /* text on a highlight */
--fg-dim:    rgba(255,255,255,0.75);  /* secondary text, the 75% opacity rule in §3 reuses it */
--rule:      rgba(255,255,255,0.35);  /* borders, table rules */
--code-bg:   rgba(0,0,0,0.25);        /* code blocks, tables' header rows */
```

- `body` background `--bg`, color `--fg`. `::selection` background `--hi`, color `--hi-fg`.
- Links: `--fg`, underlined; on hover, background `--hi`, color `--hi-fg`, no underline (a highlight bar, not a color change). The nav pill: background `--bg`, border 1px `--rule`, no box shadow (the 30px shadow was a white-on-white device; on blue it is fog); the active item gets background `--hi` and `--hi-fg`; hover the same.
- The site header text `--fg`; the title's hover the same highlight treatment.
- Headings `--fg`. Tables: border `--rule`, header row `--code-bg`, no zebra striping. Blockquotes: left border `--fg`, text `--fg-dim`. Code and `pre`: `--code-bg`, `--fg`, border 1px `--rule`; Prism token colors re-chosen for a blue ground (light values; keep contrast ≥ 4.5:1 against `--bg`). Images unchanged. The `.gap` callout: left border `--hi`.
- Buttons (`.launch-interactive`, submit buttons, the assistant's controls): background `--fg`, color `--bg`; hover background `--hi`, color `--hi-fg`.
- Sandbox cards on `/sandboxes/` and gallery cards: title `--fg`, author `--fg-dim`, hover: the image at 85% opacity and the title highlighted.
- The `--chrome-top` comment in `app.css` explains the nav shadow; once the shadow is gone, `--chrome-top` can drop to 8rem. Check every page's top padding after the change.
- Check contrast on every text color against `--bg` with a quick script and put the numbers in your summary.

## 2. Publish dates

Every tutorial and assignment has `publish: "YYYY-MM-DD"` in its frontmatter (set 09-08: seven days before its due date). The rule: a page is published from 00:00 America/New_York on that date. Before then it is not on the site.

- `content.js` runs in the browser too (see `CLAUDE.md`), so the filter is a pure function of `Date.now()`: `isLive(doc) = doc.published !== false && (!doc.publish || now >= startOfDayNY(doc.publish))`. Compute the New York midnight without a library: build the date at `T04:00:00Z` (EDT) for dates through 2026-10-31 and `T05:00:00Z` (EST) from 2026-11-01 (the 2026 DST change is 1 November); a two-line helper with the cutover date named.
- **Dev flag.** `SMT_SHOW_UNPUBLISHED=1` in the environment, read once in `vite.config.js` and exposed as the `__SMT_SHOW_UNPUBLISHED__` define, exactly like `SMT_MODE`. When set, `isLive` returns true for everything, and every unpublished item shows a small tag `publishes 9/17` after its title in lists and at the top of its page, so Adam can see what students cannot. Document it in `CLAUDE.md`'s Commands block: `SMT_SHOW_UNPUBLISHED=1 npm run dev`.
- Lists (`/tutorials/`, `/assignments/`) filter with `isLive`. Pages: an unpublished slug renders a short page, not a 404: the title and one line, `This page publishes on Thursday 9/17.` (date from the frontmatter, weekday computed), so a syllabus link clicked early explains itself. Server-side `load` must apply the same filter, so the archive build (`SMT_MODE=archive`) prerenders only what is live at build time; note that in the freeze audit's output.
- Dev notes (`devnotes: true`) have no `publish` date and are always live. Do not add one.
- The gallery and `/api/submit`: an assignment that is not yet live must refuse uploads (`assignment/not-open` already exists in `validate.js`; wire it to the same `isLive`).

## 3. Navigation aids on the home page

The syllabus is the home page. Three additions, all client-side over the rendered markdown, in `src/routes/+page.svelte` (a small script that runs after mount and on the `#week-N` anchors, not in the markdown pipeline). The class dates are the eleven Thursdays from `utilities/memory/course_schedule.md` in the vault; hardcode them in one array in `src/lib/schedule.js`, `['2026-09-10', '2026-09-17', ..., '2026-11-19']`, with a comment saying where they come from.

### 3.1 The arrow

- **Rule (Adam, 09-08):** the arrow marks the first class date strictly after today (New York time). On a class day the arrow already points at the following week: on 9/17 and on 9/18 it is at 9/24. After the last class it stays on 11/19.
- Draw it in the left margin of the **Course Overview** table row for that date and in the left margin of the corresponding `### … | Week N | …` heading. A right-pointing triangle, `--hi`, about 0.8em, positioned absolutely at `left: -1.6rem` of the row / heading, hidden under 768px (the margin is gone there; use a left border of 3px `--hi` on the row and heading instead).

### 3.2 Opacity

- Table rows and week sections up to and including the arrow's week: opacity 1. Rows and sections after it: opacity 0.75 (`--fg-dim` on text is equivalent; apply `opacity: 0.75` to the row and to the section wrapper so links and images fade too).
- Only the overview table and the weekly sections. Everything after the last week section (grading, learning objectives, AI policy, software, integrity, accessibility, email, student work) is untouched.

### 3.3 Jump from the table

- Each overview row with a date becomes clickable (`cursor: pointer`, `role="link"`, keyboard focusable) and scrolls to `#week-N`, expanding that section (§3.4) if it is collapsed. The `TBD | Website Due` row jumps to `#website-due`.

### 3.4 Collapsible weeks

- After mount, wrap each week's content (everything from a `h3[id^="week-"]` up to the next `h3` or the `## Class Requirements` h2) in a `<section class="week">` with the heading as its toggle. Clicking the heading toggles `open`; the heading gets a small chevron at its right and `aria-expanded`.
- Default state: open for the arrow's week and the week before it; every other week closed. Example from Adam: on 9/17 or 9/18, 9/17 and 9/24 are open. Weeks 10, 11 and the website-due block follow the same rule.
- Spacing: closed headings need room. `section.week` gets `margin: 1.75rem 0`; the heading `padding: 0.5rem 0`; a 1px `--rule` line under each closed heading so they do not run together.
- A hash in the URL (`#week-4`) opens that week on load. Do not persist open/closed state; the default rule is the state.
- The `{#week-N}` ids are set by markdown-it-attrs and must survive the wrap; the anchor plugin's permalink inside the heading stays.

## 4. The mouse agents

A small simulation that lives on every page on desktop, as a nod to the course.

- **What.** N tiny cursor arrows (12px, `--hi`, a simple SVG or a canvas path) that steer toward the real pointer, treat course content as obstacles, and point at the pointer. When one bumps an obstacle it turns (its heading takes the bounce), and then eases back toward pointing at the pointer over about a second.
- **How many.** `N = 3 × (people on the site right now)`, capped at 60. Presence comes from a new server route `GET /api/presence`: the client sends a beacon `POST /api/presence` every 30 s with a random session id kept in `sessionStorage`; the server keeps ids with last-seen times in memory (not `var/`), drops ids older than 75 s, and returns the count. In archive mode (`SMT_MODE=archive`) there is no server: N = 3. On a fetch failure, N = 3.
- **Where it runs.** Desktop only: `matchMedia('(pointer: fine) and (min-width: 900px)')` and not `prefers-reduced-motion`. Never on sandbox routes (`/sandboxes/[slug]`), where the map owns the pointer. Paused when the tab is hidden, when the pointer has not moved for 20 s, and when the pointer leaves the window (agents drift to a stop).
- **Cheap.** One full-window `<canvas>` overlay, `position: fixed`, `pointer-events: none`, `z-index` above content and below the nav pill. One `requestAnimationFrame` loop, a fixed 30 fps step (skip frames). Obstacles are axis-aligned rectangles: the bounding boxes of `p, h1–h4, li, table, img, pre, blockquote, .project-card, .content-list-item` inside `main`, collected once on load and again on `resize` and on scroll end (debounced 150 ms), stored in page coordinates and offset by `scrollY` per frame. Agents are plain arrays of x, y, vx, vy, heading; steering is one seek force toward the pointer, one separation force between agents (only among the 60, O(N²) at N=60 is 3,600 pairs, fine), and one axis-aligned rectangle test per obstacle per agent with an early exit on a coarse grid (bucket obstacles into a 200px grid). Nothing allocates per frame. Target under 1 ms per frame at N = 60 on a laptop; measure and put the number in your summary.
- **Behavior.** Max speed about 180 px/s, max turn rate about 4 rad/s, seek toward the pointer with arrival slowing inside 80px so they gather rather than pile on. On rectangle contact, reflect the velocity on the hit axis and set heading to the new velocity; each frame, ease heading toward the pointer bearing with a small gain so the correction takes about a second. Draw the arrow rotated to its heading.
- **Off switch.** A tiny text link in the footer or under the nav, `agents off`, that stores a flag in `localStorage` (try/catch) and stops the loop; `agents on` restores it.

## 5. Loose ends and checks

- Every internal link the 09-08 content pass created must resolve: `/resources/references/#week-2` … `#week-9`, `/assignments/assignment-01/` … `-05/`, `/tutorials/01-setting-up/` … `05-a-model-for-the-sun/`. Crawl the dev server for 404s and fragment ids that do not exist and list them.
- `src/lib/site.js` still has `code: 'A4XXX'` and the office hours link placeholder; leave them, note them.
- The sandbox build doc changes `SandboxFrame`; the layout and color work here must not touch the sandbox panels. If both docs are being built in one session, do this one first and keep `app.css` sandbox rules scoped under `.sandbox`.
- `npm run audit:freeze` at the end.

Say at the end: every file changed, the contrast numbers, the agent frame time, the 404 list, and anything here you could not do as written.
