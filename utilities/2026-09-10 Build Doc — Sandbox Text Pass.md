---
title: Build Doc — Sandbox Text Pass
date: 2026-09-10
type: build-doc
---

# Build Doc — Sandbox Text Pass

For Claude Code, on Opus. Repo `smt-fa2026`. Written 2026-09-10 after Adam rewrote the
sandbox text himself. This is a text and panel pass across all five built sandboxes, plus two
control removals in `after-five`. No pipeline runs, no data changes, no new views.

The prose for everything is in `utilities/2026-09-10 sandbox text/<slug>.md`. It supersedes
`utilities/2026-09-08 sandbox text/` in full. Copy from it; do not rewrite. If a string you
need is not in the text file, write the plainest possible sentence and mark it
`<!-- PROSE DRAFT -->` beside it so it can be found.

## 0. Read first

- `CLAUDE.md`. Its "Sandbox prose" section describes the five-section card; §1 below replaces
  that and you update `CLAUDE.md` to match.
- The five files in `utilities/2026-09-10 sandbox text/`. Every title, subtitle, option label,
  note, legend entry, metric label and card paragraph comes from there.
- `src/lib/sandboxes/cards.js` (the `##` split), `src/lib/components/SandboxCard.svelte`,
  `src/lib/components/ParamPanel.svelte` (the `why` fold, lines ~292-305).
- `src/lib/sandboxes/after-five/`: `schema.json`, `gates.js`, `heatmap.js`, `AfterFive.svelte`,
  `meta.js`, `card.md`.
- `utilities/2026-09-10 Build Doc — After Five Corrections, Amendment.md` §0, which still
  governs: name limitations, do not engineer them away.

Rules that do not bend:

- **Never `git commit` or `git push`.** Leave the working tree dirty and list what changed.
- **Never invent data.** No made-up figure, field name, URL or dataset. Every link in the text
  files was checked on 2026-09-10; copy them exactly.
- **American English** in every string, comment and identifier. Schema keys such as
  `colour_by` and `land_value_centre_base` stay as they are (renaming a key touches
  submissions); every title, label and description string is American.
- **Every sandbox renders from static data.** `npm run audit:freeze` must still pass.
- **The register is flat.** Copy the text as written. No clever lines, no titled
  mini-sections, no ALL-CAPS in control text.
- Every prose file you touch keeps or gets the first line
  `<!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->`
  (or the `//` form in `meta.js`).
- Kill any dev server you start.

## 1. The card has two sections now

Every `card.md` becomes two `##` sections, in this order:

1. `## Description` — two or three short paragraphs, with the footnotes for that section
   directly under it.
2. `## Assumptions + Limitations` — one flat bullet list, with any footnote it uses directly
   under it.

The text files give both sections in full, under the heading "Description panel (card.md)".
Copy the two `##` blocks and their footnotes; the line "## Description panel (card.md)" itself
is a heading in the text file, not in the card.

`cards.js` splits on `##` and renders each section separately, so a footnote must be defined
in the section that references it. The text files are already arranged that way. Check that
`SandboxCard.svelte` does not assume five sections or specific titles; from reading it, it
derives sections from the file, but confirm and fix if anything is hard-coded.

Footnotes now carry markdown links. Confirm `markdown-it` renders them as `<a>` in the card
and that links open in a new tab (`target="_blank" rel="noopener"`); add a link renderer rule
in `cards.js` if it does not already do this.

Update the "Sandbox prose" section of `CLAUDE.md`: two sections, their names, the footnote
rule unchanged, and a sentence that sources carry a link wherever one exists.

## 2. The panel fold is labeled "more"

In `ParamPanel.svelte`, the `<summary>` inside `<details class="why">` reads
`why these numbers`. Change it to `more`. Nothing else about the fold changes: a selected
enum stop's note still renders above the description under the same fold.

Grep the repo for "why these numbers" afterwards; the count must be zero outside
`utilities/` and `node_modules/`.

## 3. Copy the strings, every sandbox

For each of `pencil`, `after-five`, `coefficients`, `anthromes`, `bathtub`:

- `card.md`: replaced in full per §1.
- `schema.json`: `title`, `x-enum-labels`, `x-enum-notes`, `x-disabled-note`, and
  `description` on every property come from the text file. Where the text file gives no
  `More:` line for a control, remove that property's `description` so the fold does not
  render. Ranges, steps, defaults, `x-group`, `x-panel`, `x-emphasis`, `x-scenario-values`
  and `x-disabled-when` are unchanged unless §4 says so.
- `meta.js`: `subtitle` is the text file's subtitle verbatim. `cannotSee` is the "What it
  can't see (assistant prompt, meta.js `cannotSee`)" paragraph verbatim. `metrics` is the
  metrics strip list verbatim, in order. `controls` is a one-line-per-control list that
  agrees with the panel after this pass (drop lines for removed controls). `blurb` and
  `statusNote` should be shortened to agree with the new card; the assistant prompt reads
  `subtitle`, `controls` and `cannotSee` verbatim, so those three must agree with the card
  word for word where they overlap.
- Legends, status lines and warnings: the text file's strings, where the component carries
  them.

`pencil`: the assumptions panel's first group is now titled `the financing` (was `the program`); that is the `x-group` string on `grant_max`, `equity_share`, `interest_rate`, `term_months` and `cushion`. The card now distinguishes ADU for You (HPD's plan library and budgeting tool, where the costs come from) from Plus One ADU (the HPD/HCR financing); `meta.js` `blurb` and `data` must make the same distinction, and any string that calls Plus One "the program" whose rules the lots are tested against is wrong.

Anthromes and the City Simulator have panel headings (`representation`, `assumptions`) and
a Submit button in the text file that the 09-08 files did not have; add them if the
components lack them, matching the other three.

## 4. `after-five` specifics

### 4.1 Rename scenario 4

`x-enum-labels[3]` becomes `maximum housing`. The key `maximum_incentive` and its
`x-scenario-values` do not change. Its `x-enum-notes[3]` is the four-sentence note in the
text file. The other three notes are also replaced; each now starts with a linked source.
`x-enum-notes` render as plain text in the fold today; make the fold render markdown links
in notes (a small `markdown-it` inline render, or an `{@html}` on a sanitized inline render),
since every scenario note now carries one to four links.

The `scenario` description says the menu sets the seven deal numbers and the convertibility
threshold. That is already what `x-scenario-values` does; only the text changes.

### 4.2 Remove `added_floors`

The boxes it drew were not a model result: `floors_added` in `buildings.bin` is proposed
minus existing stories from a building's own past DOB filing, present on 99 office buildings
across both districts (28 in CD1), and no conversion rule for adding height exists anywhere in
the code. Adam's call is to draw nothing.

- `schema.json`: delete the `added_floors` property.
- `AfterFive.svelte`: remove the `params.added_floors` branch in `getElevation` (lines
  ~352-356) and the dependency on it (~361, ~418). Converted buildings are drawn at their
  surveyed height.
- `meta.js`: drop the control line and any mention of added floors in `blurb`, `statusNote`,
  `data`.
- Leave `floors_added` in `buildings.bin` and the pipeline alone. It is data about past
  filings and costs nothing; do not rerun the pipeline for this.

### 4.3 Remove `min_units_for_conversion_sample`

Fixed at the 10+ stop. The footnote in the card states the figure and the cutoff.

- `schema.json`: delete the property.
- `gates.js`: `sfPerUnitAt(manifest, p.min_units_for_conversion_sample ?? 10)` becomes
  `sfPerUnitAt(manifest, 10)`. Keep the function and its comment; it documents why 10.
- `heatmap.js` (~line 51): same, read the `"10"` row.
- `AfterFive.svelte`: remove the key from the two dependency strings (~243, ~429).
- `meta.js`: drop it from `controls`.

### 4.4 Metrics strip

The text file lists five metrics. Remove `residents living there afterwards` and
`office jobs displaced` from `onmetrics` in `AfterFive.svelte` and from `meta.js` `metrics`.
The values still exist in `result.metrics`; leave `gates.js` alone.

### 4.5 Conversion cost description

The `conversion_cost_sf` description now states the shape penalty in `gates.js`
(`cost * (1 + costPenalty * (1 - score))`). Text is in the file; no code change.

### 4.6 Everything that carries the two removed keys

`additionalProperties: false` means every stored param set that still carries
`added_floors` or `min_units_for_conversion_sample` fails validation after §4.2 and §4.3.
Fix all of these in the same pass:

- `src/submissions/_example/after-five/manifest.json`: remove both keys from `params` and
  `cover`. The `cover.png` was rendered with `added_floors: true`; re-render it with the
  boxes gone (same district, view, hour and scenario) so the gallery cover matches what the
  sandbox now draws.
- `src/content/tutorials/02-after-five.md`: the two `data-params` embeds at lines ~83 and
  ~87 carry both keys; remove them. Line ~103 ("Added floors are a story count...") goes.
  Line ~89 says "the program that reaches everything"; it is now "maximum housing". Re-read
  the four CD1 counts on that line against the running sandbox after this pass and correct
  them if they differ.
- `static/submissions/_example/after-five/` if it is a copy rather than a build output
  (check `CLAUDE.md`; if it is generated, regenerate).
- Grep `src/` and `static/` for both keys before finishing; zero hits outside vendor.

## 5. Acceptance

- `grep -rn "why these numbers" src` returns nothing.
- `grep -rniE "colour|programme|metres|neighbour|grey|capitalis|modell|centralis" src --include=*.md --include=*.js --include=*.svelte --include=*.json | grep -v vendor | grep -v "colour_by\|centre_base"` returns nothing.
- Every `card.md` has exactly two `##` headings, `Description` then `Assumptions + Limitations`,
  and every `[^x]` reference in a section has its definition in that section.
- `npm run audit:freeze` passes; the `_example` submission for `after-five` validates.
- `after-five`, CD1, 467-m on, threshold as set by each scenario: measure the four stops'
  conversion counts BEFORE you change anything and again after. They must be identical;
  nothing in this pass touches the gates. The last recorded figures are 0 / 1 / 137 / 199 of
  381 (dev note, after the 09-10 massing cap); 0 / 1 / 142 / 204 in the amendment doc is the
  pre-cap count. If your before and after differ, §4.2 or §4.3 touched something it should
  not have.
- Open each sandbox once; every panel fold reads "more"; the after-five representation panel
  has three controls (district, show, hour) and the assumptions panel has no unit-floor row.

## 6. Leave alone

- Pipeline scripts and everything under `data/`.
- `x-scenario-values`, ranges, steps, defaults, `x-emphasis`.
- The sunlight and studio-twin sandboxes; no text file exists for them yet.
- Dev notes other than the lines named in §4.6. Adam will rewrite the dev notes separately.

## 7. Report back

Write `utilities/2026-09-10 Build Notes — Sandbox Text Pass, What Changed.md`: files touched,
any string you had to write yourself (marked PROSE DRAFT), the four CD1 counts you measured,
and anything in the text files that did not match what the component could show.
