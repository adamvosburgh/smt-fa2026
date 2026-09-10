---
title: Build Notes — Sandbox Text Pass, What Changed
date: 2026-09-10
type: build-notes
---

# Build Notes — Sandbox Text Pass, What Changed

Run of `2026-09-10 Build Doc — Sandbox Text Pass.md`. Every string comes from
`utilities/2026-09-10 sandbox text/`. Nothing committed; the working tree is dirty.

## The four CD1 counts, before and after

Measured in node against `data/processed/after-five/buildings.bin` and the manifest,
calling `compute()` from `gates.js` directly with each scenario's `x-scenario-values`,
CD1, 467-m on, weights at their defaults. Before any change, and again after §4.2 and
§4.3:

| scenario | before | after |
| --- | --- | --- |
| published asking rent, 2024 | 0 of 381 | 0 of 381 |
| Downtown Class B, effective rent, 2026 | 1 of 381 | 1 of 381 |
| Comptroller pro forma, 2025 | 137 of 381 | 137 of 381 |
| maximum housing | 199 of 381 | 199 of 381 |

Identical, and equal to the dev note's recorded 0 / 1 / 137 / 199. Homes created also
unchanged: 0 / 26 / 9,439 / 35,907, which is what `02-after-five.md` line 89 already
said, so no figure on that line needed correcting. The running sandbox agrees: the
re-rendered gallery cover reports "137 of 381" and 9,439 homes.

## Files touched

**Shared**

- `src/lib/markdown-links.js` — new. A markdown-it plugin putting `target="_blank"
  rel="noopener"` on every link, so a click on a source does not navigate away from a
  running sandbox.
- `src/lib/inline-markdown.js` — new. `renderInline` with `html: false`, for the
  panel's fold. Safe to hand to `{@html}`: markdown-it escapes any tag in the source
  rather than passing it through.
- `src/lib/sandboxes/cards.js` — uses the link plugin; header comment now describes the
  two-section card.
- `src/lib/components/SandboxCard.svelte` — link styling in `.body`, matching
  `.content-article a` elsewhere on the site. It derives sections from the file and
  hard-codes nothing about their number or titles, so §1 needed no structural change.
- `src/lib/components/ParamPanel.svelte` — the fold's `<summary>` reads `more`; the stop
  note and the description both render through `inlineMarkdown`; link styling on
  `.param-note`.
- `CLAUDE.md` — the "Sandbox prose" section now describes the two sections and the
  linked footnotes.

**Per sandbox** (`card.md` replaced in full, `schema.json` strings, `meta.js`
`subtitle` / `blurb` / `statusNote` / `controls` / `metrics` / `cannotSee`):
`pencil`, `after-five`, `coefficients`, `anthromes`, `bathtub`.

Component strings changed where the text file's differed:

- `coefficients/Coefficients.svelte` — the transport label is `the clock`, was
  `the simulation`. Three metric labels: `the residential, commercial and industrial
  demand valves`, `the spread across repeated runs at the final step`, `steps run`.
- `anthromes/Anthromes.svelte` — one metric label gains the text file's "run":
  `agreement with the published method run at native resolution`.
- `pencil` and `bathtub` components already carried the text file's legend, warning and
  metric strings verbatim; nothing to change.

**after-five specifics**

- `schema.json` — `added_floors` and `min_units_for_conversion_sample` deleted;
  `x-enum-labels[3]` is `maximum housing`; all five `x-enum-notes` replaced, each
  opening with a linked source; `hour`'s `x-disabled-note` kept.
- `AfterFive.svelte` — the `added_floors` branch in `getElevation` is gone and every
  building draws at its surveyed height; both dependency lists lose the unit-floor key;
  `residents living there afterwards` and `office jobs displaced` are off the metrics
  strip. `FLOORS` and `FLOORS_ADDED` dropped from the import, since nothing used them
  after the elevation change.
- `gates.js` — `sfPerUnitAt(manifest, 10)`. The function and its comment stay and now
  say why 10 rather than why it was a control.
- `heatmap.js` — reads the `"10"` row directly. `peoplePerBuilding`'s `p` argument was
  its only use, so the argument is gone from the signature and the one call site.
- `src/submissions/_example/after-five/manifest.json` — both keys out of `params` and
  `cover`. `cover.png` re-rendered at the same district, view, hour and scenario, with
  the boxes gone. `review.json` rewritten by the same run.
- `src/content/tutorials/02-after-five.md` — both keys out of the two `data-params`
  embeds; "the program that reaches everything" is now "maximum housing"; the
  "Added floors are a story count" bullet removed.
- `static/submissions/_example/after-five/` is a `sync-assets` output and gitignored;
  regenerated with `npm run sync`.

## Strings I had to write myself

Everything a reader sees came from the text files. Three places had no text-file string
and are marked in the file as PROSE DRAFT along with the rest of it:

- `blurb` and `statusNote` in each `meta.js`. §3 says to shorten these to agree with the
  new card; they are not in the text files, so each is now a compression of that
  sandbox's Description section into two or three sentences.
- `controls` in each `meta.js`, one line per control. Written from the text file's own
  control titles and options, in panel order.
- `data` and `provenanceNote` blocks in `meta.js` were left as they stood, minus the
  after-five added-floors mention. They are not in the text files and §3 does not name
  them.

## Where the text file did not match what the component can show

- **`after-five`, convertibility legend.** The text file asks for "a ramp from 0 to 1
  with the threshold marked, and `passes` / `does not pass` swatches". The ramp and the
  threshold mark are there. The swatches are not, and I did not add them: the map ramps
  the score continuously and draws no two-class pass/fail color, so a swatch pair would
  have to be given colors the map never uses.
- **`pencil`, recompute status.** The text file lists `rerunning 246,921 lots…` "while
  recomputing". The component has no recompute status — the pass is synchronous and
  about 140 ms — so there was nothing to rename. Its load strings are
  `reading the lots…` then `reading 247,000 lots…`.
- **`coefficients`, the layer rail.** `show_rail` is still a control (the text file says
  no control is added or removed) but the text file gives it no `More:` line, so its
  description is gone and the fold no longer renders for it. The `layer` note the text
  file supplies says "All fifteen are drawn small in the rail regardless", which reads
  as though the rail is always on. Copied as written; worth a look.
- **`anthromes`, the stale crossover.** The text file says the stale value "is grayed
  until the new one arrives". The value lives in the metrics strip, which
  `SandboxFrame` renders, so the component cannot gray it; what it does instead is
  append `(recomputing…)` to the value and show a `recomputing the ledger…` note. Left
  alone — there was no string to copy.
- **`anthromes`, the key name.** The text file writes the color control as `colour_by`.
  The schema key has always been `color_by`, and renaming keys is off the table anyway,
  so it stays `color_by`.
- **`coefficients`, "unspoilt".** The text file's layer label list includes `unspoilt`,
  which is the label the schema already carries. It is British, and the doc asks for
  American English in every label. Copied as written rather than changed to
  "unspoiled" — flagging it rather than deciding it.
- **`bathtub`, projection line labels.** The text file gives `10th percentile`, `25th`,
  `75th`, `90th`. The component writes the percentile and the year on all four
  (`25th percentile, 2080s`). Left as it is; nothing in it is wrong.

## Other things found

- **British spellings outside the sandbox text.** The §5 grep also caught four hits I
  fixed: `recolour`/`recolouring` in `sunlight/Sunlight.svelte` (a local function, no
  other caller), `centimetres` in `sunlight/accumulate.js` (a comment),
  `context_neighbour_01` in `05-a-model-for-the-sun.md` (an example layer name; the tag
  matcher matches the `context` prefix only, and every other mention in that file
  already said "neighbors"), and `greying` in a `ParamPanel.svelte` comment. The one
  remaining hit is *Grey Room* in the syllabus bibliography, which is the journal's
  actual title.
- **`static/covers/after-five.png` had the same stale boxes** as the submission cover —
  the sandbox page runs at the schema defaults, and `added_floors` defaulted to true. It
  is committed, so I re-rendered it as well. §4.6 only named the submission cover.
- **`sunlight/card.md` still has the old five sections.** §5 says every `card.md` has
  exactly two; §6 says leave the sunlight sandbox alone because it has no text file yet.
  I took §6 as the more specific instruction. `CLAUDE.md` now describes two sections, so
  sunlight's card is the one file that disagrees with it.
- **`_example/coefficients` `cover` carries a `speed` key** that is not in that schema,
  so it fails a strict `additionalProperties` check. Pre-existing — the schema at HEAD
  has no `speed` either — and harmless, because `validate.js` validates `params` and not
  `cover`. Not touched.

## Checks run

- `grep -rn "why these numbers" src` — nothing.
- The §5 British-English grep — only *Grey Room*.
- Every `card.md` for the five sandboxes has exactly `## Description` then
  `## Assumptions + Limitations`, and every `[^x]` reference resolves to a definition in
  its own section, with no orphan definitions.
- Every stored param set under `src/submissions/` validated against its schema with Ajv:
  `_example/after-five` `params` and `cover` both pass.
- `npm run build` — clean. `npm run audit:freeze` — clean.
- All five sandboxes opened in headless Chromium at 1600×1000, waited on
  `data-cover-ready`: no console errors, no exceptions, no failed requests. Every
  `details.why` summary reads `more` (12, 10, 13, 13, 9 folds). Every external link in a
  card carries `target="_blank" rel="noopener"`; no in-page footnote anchor does. The
  after-five representation panel has exactly District, Show, Hour of day; its
  assumptions panel has no unit-floor row. Scenario 4 reads `maximum housing` and its
  note renders its link.
- Dev server on port 5199 killed.
