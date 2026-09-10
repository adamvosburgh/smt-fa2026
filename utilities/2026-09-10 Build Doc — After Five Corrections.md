---
title: Build Doc — After Five Corrections
date: 2026-09-10
type: build-doc
---

# Build Doc — After Five Corrections

For Claude Code, on Opus. Repo `smt-fa2026`, sandbox `after-five` (Office to Residential
Conversion). Written 2026-09-10 from two problems Adam found while reading the sandbox:
two of the four scenarios draw the identical map, and the street layer does not read as a
count of people.

Everything numbered in this document was measured against the shipped data on 2026-09-10.
Where a number is given as an acceptance target, it is what the current data produces; if
your run disagrees, something is wrong with the change, not with the target.

## 0. Read first

- `CLAUDE.md`, then `src/lib/sandboxes/bathtub/` (the reference implementation).
- `utilities/2026-09-08 Build Doc — Sandbox Reframe.md`, §5 (`after-five`). This document
  amends it; where they disagree, this one wins.
- `src/lib/sandboxes/after-five/` in full: `gates.js`, `heatmap.js`, `schema.json`,
  `meta.js`, `card.md`, `AfterFive.svelte`.
- `data/scripts/after-five.py` §4 (per-building constants) and `data/scripts/afterfive_day.py`
  §2 (the sidewalk grid).
- `data/scripts/after-five-agents.py` lines 80 and 224-300. The agent layer is dead but the
  CSCL reader and the walkable filter in it are correct and are reused in §3.2.

Rules that do not bend:

- **Never `git commit` or `git push`.** Leave the working tree dirty and list what changed.
- **Never invent data.** No made-up figure, field name, URL or dataset.
- **American English** in every string, comment and identifier.
- **Every sandbox renders from static data.** `npm run audit:freeze` must still pass.
- **The register is flat.** No clever lines, no titled mini-sections, no ALL-CAPS in control
  text, no "the finding is."
- Every prose file you write is a draft. First line
  `<!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->`
- `python3 data/scripts/checks/preflight.py` is the gate after any data change.
- Kill any dev server you start.

## 1. What is wrong

### 1.1 Two scenarios are the same map

At the default convertibility threshold of 0.5, in CD1:

| scenario | office value | residential value | score the deal needs | converts, of 381 |
|---|---|---|---|---|
| `asking_2024` | $638/sf | $886/sf | 1.29 | 0 |
| `downtown_b_2026` | $461/sf | $891/sf | 0.92 | 2 |
| `comptroller_2025` | $219/sf | $1,264/sf | **-0.09** | 274 |
| `assessor_distressed` | $252/sf | $1,264/sf | **-0.71** | 274 |

Both of the last two carry the Comptroller's residential side ($79 rent, 20% opex, 5.0%
cap = $1,264/sf) and differ only on the office side, which by then does not matter. A
negative required score means the financial gate is not binding: every building that clears
the convertibility threshold clears the deal automatically. The convertibility threshold is
the only thing deciding, and it is the same in both, so the two produce the identical set of
274 buildings.

The four scenarios therefore produce three outcomes: 0, 2, 274, 274.

### 1.2 The street layer does not read as a count

It is not a color problem. The sum over all cells is the district total for the hour, which
is what the metrics strip reports; the normalization to 1 in `weights.bin` is what conserves
it. A cell's value is the number of people landing on that 100 m² of ground, and since cells
are equal area, a per-cell count and a density are the same number.

What makes building size illegible is the kernel — the rule deciding how much ground each
building's people are spread over. Two faults:

**The spreading area grows with the building.** Across the 1,818 office buildings,
`corr(footprint_area, cell_count) = 0.80`. Per-cell intensity is therefore roughly
jobs ÷ footprint, which runs against size:

| office sf | footprint | cells | jobs | jobs/cell |
|---|---|---|---|---|
| 1,999,448 | 156,517 | 299 | 5,085 | 17.0 |
| 709,880 | 1,300 | 63 | 2,557 | 40.6 |

The larger building has twice the jobs and paints at 42% the intensity.

**The mask is not sidewalk.** `build_grid` in `afterfive_day.py` marks a cell as sidewalk
when its center is not inside a footprint: 609,412 of 635,175 cells, 96% of the grid. The
memorial plaza, the West Street roadbed and the Hudson all absorb people.

**Compounding these at the WTC:** PLUTO BBL 1000580001 (185 Greenwich) carries 7.17M sf of
office for the whole superblock. The CityGML has five buildings on that lot, and
`after-five.py` divides the lot's areas equally (`share = 1.0 / per_lot[bbl]`), so the tower
and a 1,400 sf entrance canopy each receive 1.43M sf and 3,646 jobs. The tower then spreads
its fifth over 220 cells and the canopies over 111-162, so the canopies paint brighter than
the tower. 1 WTC's peak within 70 m is 50 against a p98 of 96 — half alpha, which is what
reads as empty.

There is a real effect underneath: a tower set in a plaza does produce lower sidewalk
density than the same crowd emptying into narrow Financial District streets. It is currently
invisible because it is confounded with the plaza-is-sidewalk artifact.

## 2. The scenario gate

Adam's decision, 09-10: a scenario may set the convertibility threshold as well as the seven
deal numbers, and the fourth scenario becomes an explicit counterfactual.

### 2.1 Mechanism

No component change is needed. `writeScenario` in `src/lib/components/ParamPanel.svelte`
already writes every key in `x-scenario-values` into `params`. Two schema edits:

1. Add `"x-scenario-of": "scenario"` to `convertibility_threshold` in
   `src/lib/sandboxes/after-five/schema.json`, so moving it by hand writes `scenario` back
   to `custom`, as the seven deal sliders already do.
2. Add a `convertibility_threshold` entry to every stop in `x-scenario-values`. Every stop,
   not only the new one — a scenario that omits it would leave whatever the reader last set,
   which is the bug this control is meant to close.

### 2.2 The values

| stop | `convertibility_threshold` |
|---|---|
| `asking_2024` | 0.5 |
| `downtown_b_2026` | 0.5 |
| `comptroller_2025` | 0.5 |
| `maximum_incentive` | 0.3 |

At the default weights (0.35 / 0.25 / 0.2 / 0.2) the CD1 score distribution gives:

| threshold | converts, of 381 |
|---|---|
| 0.20 | 374 (98%) |
| 0.30 | 348 (91%) |
| 0.40 | 323 (85%) |
| 0.50 | 274 (72%) |
| 0.60 | 228 (60%) |

0.3 is the value that matches "all but the most difficult convert" without collapsing to
everything. Score quantiles for CD1 office buildings, for reference: 5th 0.26, 10th 0.33,
25th 0.49, median 0.65, 75th 0.77, 90th 0.83.

### 2.3 Replacing `assessor_distressed`

Rename the fourth stop `assessor_distressed` to `maximum_incentive`. Its seven deal numbers
stay exactly as they are — they are sourced and the sources are good; what changes is the
threshold, the label and the note.

- `enum`: `["asking_2024", "downtown_b_2026", "comptroller_2025", "maximum_incentive", "custom"]`
- `x-enum-labels`: the fourth becomes `"a program that reaches everything"`
- `default`: stays `comptroller_2025`

The note for the fourth stop is a draft below. It has one job the other three do not: it
must say plainly that this stop is invented and the other three are not. Keep the DOF and
222 Broadway citations, because those numbers are still what the stop uses.

```
<!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->
Not a published scenario. The deal numbers are the same ones the assessor's view used:
from the NYC Department of Finance FY2025 income-approach guidelines for Downtown
Financial District Class B office, median income $46.84 per square foot, expense ratio
49%, capitalization rate 9.49% (the assessor's rates are believed to include the
effective tax rate, which is why they run above market); those three value an office at
$252 per square foot, in line with the 2024 sale of 222 Broadway at $147.5 million for
770,416 square feet, or $191 per square foot, ahead of its conversion to 798 apartments.
Conversion cost $374, the building's $288 million construction loan divided by its area,
which is a floor on the cost rather than the cost. Residential rent $79, operating cost
share 20% and capitalization rate 5.0% are carried from the Comptroller pro forma. What
is invented here is the convertibility threshold, lowered from 0.5 to 0.3, which stands
for a program generous enough that a building's shape stops disqualifying it. Nothing
published supports that number. Almost everything convertible converts.
```

Also amend the `comptroller_2025` note. Its last sentence currently reads "Most convertible
buildings convert." Add, after it: "At these numbers the financial test stops discriminating
— every building past the convertibility threshold also clears the deal — so what converts is
decided by shape alone." That is the reading the two identical maps were hiding, and it is
worth stating rather than hiding again.

### 2.4 Acceptance

- CD1, default weights: `asking_2024` 0, `downtown_b_2026` 2, `comptroller_2025` 274,
  `maximum_incentive` 348.
- Selecting a scenario moves the convertibility threshold slider visibly.
- Moving the convertibility threshold slider writes `scenario` to `custom`.
- `npm run tokens` unaffected; schema validation still accepts a submitted
  `scenario: "maximum_incentive"`. Search the repo for the string `assessor_distressed`
  before finishing — it must not survive anywhere, including in submissions fixtures and
  `src/submissions/_example*`.

## 3. The street layer

Three changes, in this order. Each is separately testable and §3.4 gives the numbers for
each stage.

### 3.1 Split lot floor area by volume, not equally

`data/scripts/after-five.py`, §4, the `share` calculation.

Today: `share = 1.0 / max(1, per_lot.get(b["bbl"], 1))`, applied to `BldgArea`,
`OfficeArea`, `ResArea` and `ComArea`. The comment says weighting by footprint would be
better and declines it because the footprint is a ground surface and the floor area is a
stack. That objection is answered by using volume: the CityGML gives a per-building height
in feet (`b["height"]`, already on the record), so `footprint_area × height` is a per-building
proxy for the stack, and it is the quantity floor area is actually proportional to.

Replace the equal split with a volume-weighted one:

- Group buildings by `bbl`, as `per_lot` already does.
- For each lot, `vol_b = b["area"] * b["height"]`. Sum over the lot's buildings.
- `share_b = vol_b / sum(vol)`.
- Fall back to `1 / n` for a lot where the volume sum is zero or where any building has a
  missing height, and print the count of lots that fell back.
- Single-building lots are unaffected (`share = 1.0`).

215 office rows sit on a shared lot, so this touches a minority of buildings but includes
the largest sites. On the WTC lot the five buildings go from 20% each to 98.5% / 1.2% /
0.2% / 0.1% / 0.0%, giving the tower 7.06M of the lot's 7.17M sf of office instead of
1.43M.

Update the comment block above the split to say what it now does and why the previous
objection no longer applies. Update `meta.js` `data[]` ("Lot-level areas are divided across
the buildings on each lot") and `card.md` footnote `[^model]` ("lot-level areas are divided
across the buildings on a lot") to say the areas are divided in proportion to each
building's footprint times its height.

### 3.2 A street mask, not a not-a-building mask

`data/scripts/afterfive_day.py`, `build_grid`.

Today a cell is sidewalk when its center is not inside a footprint. Replace with: a cell is
sidewalk when it is **within 12 m of a walkable street centerline AND not inside a
footprint**.

The source is on disk: `data/original/nyc_street_centerline_cscl.geojson` (NYC Street
Centerline, `inkn-q76z`, 196 MB, one line of JSON). Do not re-download it.

Reuse the reader in `after-five-agents.py`:

- The file is one line, so decode features one at a time with `json.JSONDecoder().raw_decode`
  from the first `[`. Reading the whole `FeatureCollection` at once will not do.
- **`rw_type` is a string, not an integer.** `WALKABLE_RW = {"1", "3", "5", "6", "7", "10"}`
  at line 80 of `after-five-agents.py` is correct and is the set to use. A set of integers
  matches nothing and silently produces an empty street layer.
- Drop segments where `nonped` stripped and uppercased is `"V"`.
- Geometry is `MultiLineString` in this export; handle `LineString` too.
- Keep a line if any of its vertices falls inside the grid bounds. That gives 7,413 lines.

Rasterize: for each segment, walk the line in half-cell steps and stamp a disc of radius
1.2 cells (12 m at a 10 m cell) around each step. Then AND with the existing
not-inside-a-footprint mask.

12 m is a judgment, not a measurement, and must be named as one — it is roughly a curb-to-
building depth on a side street and too narrow for West Street. Put it in the module
constants next to `REACH_M` and `SIGMA_M` as `STREET_BUFFER_M = 12.0`, and carry it into
`manifest.sidewalk_grid` alongside `reach_m` and `sigma_m` so the card can cite it. A 15 m
buffer gives 163,324 cells if you want to see the sensitivity; do not change the default
without asking Adam.

Then rebuild the CSR in `build_weights` against the new mask. The Gaussian on distance from
the footprint edge is unchanged; only the set of eligible cells shrinks, and the
per-building normalization to 1 stays exactly as it is. That normalization is what conserves
headcount and must not be touched.

**Edge case:** 18 buildings have no street cell within 50 m under the new mask. None of them
carries office area, but their residents would silently vanish and the metrics would stop
summing to the district total. Handle it explicitly: for a building with zero street cells,
widen its reach in 25 m steps up to 150 m until it finds one, and if it still has none, fall
back to the not-inside-a-footprint cells within 50 m. Print the count in each category.
Do not leave a building with an empty CSR row.

### 3.3 A per-building readout

Headcount belongs on the building, not on the pavement. Add a hover tooltip to the building
layer in `AfterFive.svelte`, copying the pattern already working in
`src/lib/sandboxes/pencil/Pencil.svelte` (lines 208-260: `pickable`, `onHover`, and the
230px tooltip clamped inside the stage with no pointer events). The building layer is
currently `pickable: false` in three places; the massing layer becomes pickable.

The tooltip shows, for the building under the cursor:

- whether it is an office building, a converted one, existing homes, or neither
- its office floor area, and its convertibility score against the current threshold
- office jobs, or residents, whichever it has
- people it puts onto the street this hour
- if it stands on a lot with other buildings, that its floor area is a share of the lot's,
  and what share

Flat labels, one value per line, no units guessed — reuse the unit strings already in
`schema.json` and the metrics strip.

Adam approved this on 09-10. Build it.

### 3.4 Acceptance

Peak value within 70 m of 1 WTC (-74.01337, 40.71272) as a percentage of the p98 the ramp
normalizes against, at the default scenario:

| stage | 1 WTC peak / p98 | Oculus peak | tower's jobs | tower's cells |
|---|---|---|---|---|
| today | 52% | 69 | 3,646 | 220 |
| §3.1 only | 173% | 25 | 17,951 | 220 |
| §3.2 only | 116% | 177 | 3,646 | 49 |
| both | 505% | 31 | 17,951 | 49 |

The Oculus falling from 69 to 31 under §3.1 is correct: a transit hall was collecting a
full fifth of an office lot's floor area.

Also check:

- Cells in the new mask: 137,940, against 609,412 today. Cells per building: median 50,
  against 74 today.
- The 24-hour totals still sum to the district's people. `totalsAt` at any hour, summed over
  the day, must equal the sum of `peoplePerBuilding` times 2 for each channel (both curves
  are normalized to two trips per person per day). This is the test that catches a broken
  normalization; run it before and after and print both.
- 1 WTC at 5× the p98 means it clips hard against the ramp's top. That may be right — it is
  genuinely the largest single concentration in the district — but check that the map has
  not become one saturated blob with nothing else legible. Print the decile distribution of
  positive cell values before and after and put it in the handover notes. If the top end has
  swallowed the map, say so and stop rather than adjusting the ramp on your own; the
  percentile is `percentile98` in `heatmap.js` and changing it is Adam's call.
- `npm run covers` regenerates cleanly and the after-five cover still shows the district.
- `python3 data/scripts/checks/preflight.py` passes.

## 4. Prose that has to change

All of these are drafts for Adam to rewrite. Mark each with the PROSE DRAFT comment.

**`card.md`, "How it works", the heat map bullet.** It currently says people are spread over
"the cells within 50 m of its footprint, falling off with distance and never inside a
building." It must now say the cells are within 50 m of the footprint *and* within 12 m of a
walkable street centerline.

**`card.md`, "How it works", the day bullet — this is wrong today and is not part of the
change.** It says "Each building's people, multiplied by the change in its curve from one
hour to the next, is the number it sends onto the sidewalk that hour." That is right for
residents (`flow[h] = |home[h+1] - home[h]|`) and wrong for workers, where `heatmap.js`
multiplies by `arrivals[h] + departures[h]` — already a flow, not a difference of an
occupancy. Fix the sentence to describe both correctly.

**`card.md`, "What it assumes".** Replace "A cell is sidewalk when its center is not inside a
building footprint, which also counts streets, plazas, parks and the water. The model has no
sidewalk dataset." with a sentence saying the model has no sidewalk dataset and stands in a
12 m band around walkable street centerlines, which is roughly a curb-to-building depth on a
side street and too narrow for a wide avenue.

**`card.md`, "What it assumes", new bullet.** A building's people are spread evenly around
its own perimeter, so a building with more frontage puts fewer people on each stretch of it.
The map is people per 10 m of street, not people in a building.

**`card.md` footnote `[^model]`** and **`meta.js` `data[]`**: the lot split is now by
footprint times height, per §3.1.

**`meta.js` `subtitle`, `controls`, `cannotSee`.** These three are read verbatim into the
course assistant's prompt by `src/lib/server/assistant-prompt.js`, so they must agree with
`card.md`. `controls` needs the scenario line changed — the scenario now sets eight numbers,
not seven, and one of them is the convertibility threshold. `cannotSee` needs the sidewalk
sentence.

**`meta.js` `statusNote`.** Currently says "At the default settings nothing converts."
The default is `comptroller_2025` and 274 of 381 convert; the sentence describes an older
default and is wrong now. Rewrite it.

**`src/content/tutorials/02-after-five.md`**, the dev note. Four `##` sections, in order,
nothing more: The ambition / The parts / Roadblocks / What came out (with
`### What you should see` and `### Limitations`). Add to **Roadblocks** a one-sentence bullet
for each of: the equal lot split putting a tower and an entrance canopy on equal footing;
the not-a-building mask counting the memorial plaza as sidewalk; and the two scenarios that
turned out to draw the same map because the financial test stopped binding. Add to
**Limitations** that the map is people per 10 m of street rather than people in a building.
Keep the `.gap` callout. Do not let this section grow past the length of the others.

**`manifest.json` notes.** `sidewalk_note` in `afterfive_day.py` still describes the old
mask; rewrite it. Add `street_buffer_m` to `sidewalk_grid`. The `agents_removed` note stays
as it is, but add that the CSCL export is now read again, by `build_grid`, for the street
mask.

## 5. What is verified and what is not

**Measured on 2026-09-10 against the shipped data.** Every figure in §1, §2.2 and §3.4:
the conversion counts per scenario, the required scores, the threshold ladder, the score
quantiles, `corr(footprint, cell_count) = 0.80`, the two jobs-per-cell rows, the 609,412
and 137,940 cell counts, the 18 buildings with no street cell, the WTC lot's volume shares,
and the 1 WTC peak ratios. Do not re-derive them; use them as targets.

**Read from source on 2026-09-10.** MapPLUTO 26v2 BBL 1000580001 (185 GREENWICH STREET),
`OfficeArea` 7.17M sf, `BldgArea` 8.97M sf. PLUTO `OfficeArea` totals: CD1 97.4M sf,
CD5 216.6M sf. CSCL `rw_type` is a string field.

**Not verified, and must stay unverified in the text.** The 12 m street buffer is a judgment
with no source. The DOF assessor rates being tax-loaded is still believed, not confirmed —
`[[office-conversion-sources]]` marks it UNVERIFIED and the note must keep saying "believed."
The convertibility threshold of 0.3 for the fourth scenario is invented and its note says so.

**Left alone deliberately.** The p98 normalization in `percentile98`. The Gaussian sigma of
25 m. The 50 m reach. The per-building normalization to 1 — it is what conserves headcount
and touching it breaks the metrics.

## 6. Order of work

1. §2, the scenario gate. Schema only, no pipeline, testable in the browser immediately.
2. §3.1, the volume split. Pipeline rerun, then check the WTC lot shares.
3. §3.2, the street mask. Pipeline rerun, then §3.4's table.
4. §3.3, the readout.
5. §4, the prose drafts.
6. `preflight.py`, `npm run audit:freeze`, `npm run covers`.

Report what changed and leave the tree dirty.
