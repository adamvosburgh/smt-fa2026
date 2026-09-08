---
title: Build Doc — Sandbox Reframe
date: 2026-09-08
type: build-doc
---

# Build Doc — Sandbox Reframe

For Claude Code, on Opus. Repo `smt-fa2026`. Written 2026-09-08 from Adam's 09-06 revision notes and the decisions he made on 09-08. This document is the specification; the prose for every panel is in `utilities/2026-09-08 sandbox text/<slug>.md` in the repo (copied from the vault) and is copied, not rewritten.

## 0. Read first

- `CLAUDE.md`, then `src/lib/sandboxes/bathtub/` (the reference implementation), `src/lib/components/SandboxFrame.svelte`, `ParamPanel.svelte`, `transport.svelte.js`.
- `utilities/2026-09-04 Build Doc — Finishing The Sandboxes.md` for the play pass, the published flags and the data that is on disk. Where this document disagrees with it, this one wins.
- The five files in `utilities/2026-09-08 sandbox text/`. Every title, label, option, note, legend entry, metric label and card paragraph comes from there. If a string you need is missing from the text file, write the plainest possible sentence and mark it `<!-- PROSE DRAFT -->` in a comment beside it, so it can be found.

Rules that do not bend:

- **Never `git commit` or `git push`.** Leave the working tree dirty and list what changed.
- **Never invent data.** No made-up figure, field name, URL or dataset. Where this document says a source is unverified, keep it unverified in the text.
- **American English** in every string, comment and identifier you write. The 09-08 pass converted the existing text; do not reintroduce `colour`, `programme`, `metre`, `neighbour`, `grey`, `centre`, `storey`.
- **Every sandbox renders from static data.** The rule that makes the December freeze mechanical. `npm run audit:freeze` must still pass.
- **The register is flat.** No clever lines, no titled mini-sections, no ALL-CAPS in control text, no "the finding is."
- Kill any dev server you start.
- `python3 data/scripts/checks/preflight.py` is the gate after any data change.

## 1. Why

Adam's ruling, 09-08: exposing every control was too much information, and no amount of panel text fixes it. The course treats simulations, models and twins as representational mediums for design practice, so each sandbox now shows an authored view. Controls that do not serve that view are removed. Two panels replace the one: **assumptions** (anything that changes the underlying data or the model's numbers) and **representation** (anything that changes how that data is drawn: the timeline, the view chooser, color-by, layers, drawing toggles).

## 2. Every sandbox: the frame

### 2.1 Layout

The `layout="full"` sandbox route changes from three docked columns to a map that fills the stage with panels floating over it.

- `.sandbox.full` becomes a single grid cell: the `.stage` fills `calc(100vh - var(--chrome-top) - 3rem)` with `min-height: 720px`, the `.viewport` fills the stage, and the map is the whole thing.
- Four floating elements sit over the viewport, `position: absolute`, `z-index` above the map, `pointer-events: auto` on the panel and `none` on the space between panels so the map stays draggable:
  - **description** (left, top): the title block (`num`, `title`, `subtitle`) and `SandboxCard` inline. Width 320px, `max-height: calc(100% - 2rem)`, its own scroll.
  - **assumptions** (right, top): heading `assumptions`, then the controls whose schema property carries `"x-panel": "assumptions"`, then the **Submit this state** button at the foot.
  - **representation** (right, below assumptions, or top-right when assumptions is collapsed): heading `representation`, then the controls with `"x-panel": "representation"`. The transport (play/pause/step/speed) draws here for any `x-timeline` property, and for the external engine clock (coefficients).
  - **metrics** (bottom, centered): the metrics strip, one row, wrapping as today. For bathtub it becomes a small table (§4.5).
- Panels are **draggable** by their header (pointer events, not HTML5 drag), clamped inside the viewport, and **collapsible** with a chevron in the header that leaves only the header bar. Positions and collapsed state persist per sandbox in `localStorage` under `smt.panels.<slug>` with try/catch around every read and write; a `reset panels` text button in the description header clears it. Default positions: description at (16px, 16px); assumptions at (right 16px, top 16px); representation directly under assumptions with a 12px gap; metrics at bottom 16px, centered, max-width 70% of the viewport.
- Panel styling stays neutral, as today: white background at 96% opacity, 1px black border, black text, `font-size: 0.8rem`, the existing `.section` heading style. **Do not apply the site's new blue/green scheme inside the sandbox** (Adam's call, 09-08); the map colors have to read cleanly. A 6px header bar with the panel name lowercase and the chevron at the right.
- Under 900px, no floating: the four blocks stack under the map in the order description, representation, assumptions, metrics, full width, as the contained layout does now.
- `layout="contained"` (tutorial mounts, gallery) keeps its docked column, but the column now shows two headed groups, `assumptions` then `representation`, drawn by the same `x-panel` split. Nothing floats there.

### 2.2 ParamPanel

- New schema keyword `x-panel`: `"assumptions"` or `"representation"`. Required on every property in every schema after this build; `ParamPanel` takes a `panel` prop and draws only the matching properties. Properties with no `x-panel` are an error in dev (`console.error` naming the key) and go to assumptions.
- `x-group` keeps working as the sub-heading inside a panel, in schema property order.
- New keyword `x-shown-when`: `{ "view": ["tracts"] }` shape, same semantics as `x-disabled-when` but the control is removed rather than grayed. Used for view-specific controls (ADU's `tract_measure` and `test`, bathtub's by-hand sliders).
- `x-disabled-when` and `x-disabled-note` unchanged, and used more: every by-hand override in bathtub grays out what it overrides, with the note from the text file.
- New keyword `x-scenario-of`: on a slider, names the enum control that sets it (after-five's `scenario`). Moving the slider writes the enum to `"custom"`. The enum control carries `x-scenario-values`: `{ "<stop>": { "<key>": value, ... } }`; selecting a stop writes every listed key. `custom` has no entry and writes nothing.
- Enum buttons for `scenario` draw as a vertical list of buttons (five, one per line) rather than the segmented row, because the labels are sentences.

### 2.3 Transport

Unchanged in behavior. Only one timeline per sandbox now (after-five loses the year), so the "held at" case only arises if a schema declares two; keep the code.

### 2.4 Cover pipeline

`scripts/cover.js` screenshots `.sandbox .viewport`, which the panels now cover. Add `window.__hidePanels()` to the frame (sets `data-panels="hidden"` on `.sandbox`, which hides the four floating elements) and call it in `cover.js` right after `__transportReset`, before waiting for `data-cover-ready`. Regenerate all covers at the end (`npm run covers`), because every sandbox's default view changes.

### 2.5 Schema validation

`src/lib/server/validate.js` validates submitted params against each schema. Removed keys must be removed from the schemas (so old manifests carrying them fail validation with the existing message) and `src/submissions/_example/<slug>/manifest.json` must be rewritten for each rebuilt sandbox to the new keys. Bump nothing else; the schema is the contract.

### 2.6 `colour_by` keys

`after-five` and `anthromes` schemas carry a `colour_by` key. After-five's is replaced (§5). Rename anthromes' to `color_by`, and update `Anthromes.svelte`, `meta.js` if it mentions the key, and `_example/anthromes/manifest.json` if one exists. This is the only identifier rename in this build.

## 3. ADU Forecast for Queens (`pencil`)

### 3.1 The reframe

From "does the deal work" to "how many homes could the program add, and where." No time dimension. Three tests, in this language and only this language: **allowed under the rules**, **room for a unit**, **works for the owner**. Never "pencil" in any user-facing string (the slug stays `pencil`). Detached backyard units only, stated in the first paragraph of the card.

### 3.2 Schema

Removed: `year`, `permits_per_year`, `tint`, `volumes`, `eligibility`.

| key | panel | type | control | default | range / options | notes |
|---|---|---|---|---|---|---|
| `view` | representation | string | enum | `tracts` | `tracts`, `lots`, `volumes` | labels from text file |
| `tract_measure` | representation | string | enum | `count` | `count`, `share` | `x-shown-when: {view: [tracts]}` |
| `test` | representation | string | enum | `financial` | `eligible`, `feasible`, `financial` | `x-shown-when: {view: [lots]}` |
| `grant_max` | assumptions, group "the program" | number | slider | 175000 | 0–250000, step 5000 | unchanged |
| `equity_share` | assumptions | number | slider | 0 | 0–0.5, step 0.05 | unchanged |
| `interest_rate` | assumptions | number | slider | 0.05 | 0–0.1, step 0.005 | unchanged |
| `term_months` | assumptions | integer | enum | 180 | 180, 360 | unchanged |
| `cushion` | assumptions | number | slider | 200 | 0–1000, step 50 | unchanged |
| `cost_per_sf` | assumptions, group "the market" | number | slider | 603 | 200–1600, step 1 | unchanged |
| `rent_basis` | assumptions | string | enum | `ami_cap` | `ami_cap`, `fmr`, `flat` | unchanged |
| `rent_flat` | assumptions | number | slider | 2000 | 500–5000 | `x-shown-when: {rent_basis: [flat]}` |
| `vacancy` | assumptions | number | slider | 0.15 | 0–0.25 | unchanged |
| `rear_yard_denominator` | assumptions, group "the rules" | integer | slider | 3 | 2–12 | unchanged |
| `side_setback_ft` | assumptions | number | slider | 5 | 0–15 | unchanged |

`x-emphasis` stays on `grant_max`, `cushion`, `rear_yard_denominator`.

### 3.3 The three tests

Evaluated per lot in order; a lot failing test *n* is not evaluated for *n+1*. Store per lot a one-byte outcome: 0 fails test 1, 1 fails test 2, 2 fails test 3, 3 passes all.

1. **Allowed under the rules.** The existing `coy` eligibility logic in `proforma.js` / `pencil.py`: building class A or B (one- to two-family), not in an LPC historic district (`HistDist`), not in the flood exclusion (the NPCC 2050s + 2080s stand-ins already on disk; keep the flag names `in_10yr_rainfall_fra` / `in_coastal_fra` and the card's note that they are stand-ins), and not (R1-2A/R2A/R3A outside the Greater Transit Zone). The `all` switch that ignored this test is gone.
2. **Room for a unit.** Two conditions, both required: (a) the one-third-of-required-rear-yard area, as computed today from `rear_yard_denominator` and ZR 23-342 depths, is at least 300 sf (capped at 800); (b) a rectangle at the plan library's median proportion (0.70) of that area fits in the open ground behind the house after `side_setback_ft` on each side and 5 ft from the rear line, using the existing footprint-and-outline placement code that currently only draws the unit. Today the setback check is reported ("only about a third … still pass"); now it is part of the test. Report both counts in dev output so the change is measurable.
3. **Works for the owner.** The existing pro forma unchanged: hard cost = area × `cost_per_sf`; soft cost = $50,000 + 0.48 × hard; less grant, less equity; loan ≤ $220,000 else fail; payment at rate and term; rent (by `rent_basis`) × (1 − vacancy) − operating cost − payment ≥ `cushion`.

No uptake rate. The metric label says the count is lots passing all three tests, and the card says it is an upper bound.

### 3.4 Views

**Tracts.** A choropleth by 2020 census tract (the tract field already joined from MapPLUTO; tract geometry from the bathtub pipeline's tract boundaries, `data/processed/bathtub/` — reuse, do not refetch). Value = count of lots with outcome 3, or that count divided by the tract's existing homes (sum of `UnitsRes` over all lots in the tract, all building classes, computed once in `pencil.py` and shipped in the tract file). Single-hue sequential ramp (a blue, six classes, quantile breaks computed on the current values), tracts with zero drawn as the faded basemap. Hover: tract, homes added, existing homes, share.

**Lots.** One point per lot at the lot centroid (the pipeline already ships centroids), radius scaled with zoom (2px at borough extent, 6px at block scale). For the selected `test`, lots whose outcome ≥ the test's index draw in that test's color; lots that reached the test and failed it draw red; lots that failed an earlier test are not drawn. Colors: fail `#e0312a`; eligible `#f2c230` (yellow); feasible `#3fae5a` (green); financial `#2b5bd7` (blue). Hover: the three outcomes as three words.

**Volumes.** The existing 3D unit drawing, on every lot with outcome ≥ 2 (has room). Color by outcome: 3 → blue `#2b5bd7`; 2 → yellow `#f2c230` (allowed, room, does not work for the owner); the "not allowed under the rules" red case (`#e0312a`) means outcome 0 lots that would otherwise have had room, so test 2 must also be evaluated for outcome-0 lots for this view only (compute test 2 on every lot regardless; it is cheap; keep the cumulative rule for counting). Pitch 45°, as the current volumes view.

**Basemap.** Carto Positron for the whole metro (the current style), no crop. Replace the page-colored crop mask with a white `SolidPolygonLayer` at 75% opacity covering the map extent with the Queens borough polygon cut out, so Queens reads at 100% and everything else at 25%. Queens geometry: NYC Borough Boundaries, NYC Open Data `tqmj-j8zm`, fetched into `data/original/` by a new line in the fetch script, simplified to about 1,000 vertices, shipped as `data/processed/pencil/queens.json`. Initial bounds: Queens with 5% padding.

### 3.5 Metrics

In the order and with the labels in the text file. Concentration and median-income metrics are computed as today over outcome-3 lots.

### 3.6 Pipeline

`pencil.py` gains: `UnitsRes` sum per tract, the Queens polygon, and nothing else. The per-lot arithmetic stays in the browser as now (246,921 lots, ~140 ms per move; `onready(false)` while recomputing).

### 3.7 Acceptance

- At defaults, the tract view shows a nonzero map and the metrics strip's first figure equals the number of blue dots in the lot view at `test = financial`.
- The count of lots passing test 2 is lower than today's 22,333 because the setback fit is now part of the test; write both numbers into the dev note.
- `test = eligible` shows more dots than `feasible`, which shows more than `financial`.
- Volumes view: no red volume stands on a lot that passes test 1.
- Nowhere in the UI does the word "pencil" appear.

## 4. Sea Level Flood Map (`bathtub`)

### 4.1 The reframe

The four percentiles are always drawn as lines; the storm is what the reader chooses. A second view draws everything. The percentiles are explained in words in the card and under the legend (text file).

### 4.2 Schema

Removed: `percentile`, `link_year`.

| key | panel | type | control | default | options / range | notes |
|---|---|---|---|---|---|---|
| `view` | representation | string | enum | `one_storm` | `one_storm`, `all` | |
| `aep` | representation | string | enum | `none` | `none`, `99`, `50`, `10`, `1` | `x-shown-when: {view: [one_storm]}`; `x-disabled-when: {surge_by_hand: true}` |
| `basemap` | representation | string | enum | `elevation` | `elevation`, `flat` | `x-disabled-when: {view: [all]}` with note |
| `flood_line` | representation | boolean | toggle | true | | |
| `year` | assumptions, "the scenario" | integer | enum | 2080 | 2030, 2050, 2080, 2100, 2150 | `x-disabled-when: {slr_by_hand: true}` |
| `tide` | assumptions, "the water" | string | enum | `mhhw` | `mllw`, `msl`, `mhhw` | disabled when `aep` ≠ none, as today |
| `connectivity` | assumptions, "the model" | boolean | toggle | true | | |
| `slr_by_hand` | assumptions, "by hand" | boolean | toggle | false | | |
| `slr_m` | assumptions | number | slider | 0.8 | 0–5, step 0.05 | `x-shown-when: {slr_by_hand: [true]}` |
| `surge_by_hand` | assumptions | boolean | toggle | false | | |
| `surge_m` | assumptions | number | slider | 0 | 0–4, step 0.1 | `x-shown-when: {surge_by_hand: [true]}` |

The "by hand" group is last in the assumptions panel. When `slr_by_hand` is on, `year` is grayed with its note; when `surge_by_hand` is on, `aep` is grayed with its note and the surge is added to the tide as today.

### 4.3 Waterlines

Let `storm(aep)` be the NOAA level for the chosen storm (meters NAVD88, already containing high tide), or `tide + surge_m` when `aep = none` (surge 0 unless by hand). Let `rise(year, p)` be the NPCC value for percentile p ∈ {10, 25, 75, 90} at the horizon, or `slr_m` for all p when by hand.

- **Fill**, one-storm view: `storm(aep)` alone (today's sea level). Shaded by depth when `basemap = elevation`.
- **Lines**, one-storm view: four, at `storm(aep) + rise(year, p)`. When by hand, the four coincide; draw one.
- **Fills**, all-storms view: four, at `storm(99)`, `storm(50)`, `storm(10)`, `storm(1)`, drawn lightest and largest first (100-year, light blue) to darkest and smallest last (1-year, dark blue), flat.
- **Lines**, all-storms view: sixteen, `storm(s) + rise(year, p)`, each in a shade of its storm's fill color (four opacities of the fill hue, 10th lightest to 90th darkest, or four line weights if opacity does not read on the basemap; try opacity first).

### 4.4 Rendering

`FloodLayer.js` already decides wet/dry on the GPU from one `waterline` uniform and draws the flood line by edge detection. Extend it rather than adding layers:

- Uniforms: `fillLevels[4]` with `fillCount`, `fillColors[4]`; `lineLevels[16]` with `lineCount`, `lineColors[16]`, `lineWidth`. The fragment shader tests the cell against each fill level in order and takes the color of the last (smallest) fill it is under; then tests each line level for the wet-next-to-dry condition and, if met, writes that line color on top. Depth shading applies only when `fillCount == 1` and `showDepth` is set.
- The connectivity red (`ground <= waterline < spill`) applies to the fill of the one-storm view only.
- Baseline (today's high tide with no rise and no storm) unchanged; "only new flooding is drawn" still holds for fills and lines.
- Colors: one-storm fill, the current blue ramp. Percentile lines, one hue (a dark blue, `#0b2f6b`) at four widths 1, 1.5, 2, 2.5 px scaled by zoom, or four opacities 0.4/0.6/0.8/1.0; pick what reads and keep the legend consistent. All-storms fills: `#08306b` (1-year), `#2171b5` (2-year), `#6baed6` (10-year), `#c6dbef` (100-year), at 70% opacity, flat.

### 4.5 Metrics

`metrics.js` computes land, buildings, homes, people and the connectivity-only land for one waterline on the CPU. Run it for each row: one-storm view, five rows (today's fill, then the four percentile lines); all-storms view, four rows (the storms at today's level). The metrics element becomes a table with the row label in the first column and the six metric columns from the text file. Compute in a Web Worker if five runs on the main thread exceed 100 ms at the shipped grid (measure and say so in the dev note). `onmetrics` receives an object with a `rows` array; `SandboxFrame` renders a table when it sees `rows`, the flat list otherwise. The cover pipeline reads `window.__metrics` as before; the doctor's stage 2 compares numbers by key, so keep the one-storm view's `today` row also flattened into top-level keys with the current names, for compatibility.

### 4.6 Acceptance

- Defaults (view one-storm, aep none, 2080s, high tide, connectivity on): the fill is today's high tide (essentially the current shoreline) and four lines show rise alone, nested in percentile order and never crossing.
- Choosing the 100-year storm: the fill is the current default map's 1% extent at zero rise; the 90th line encloses the 10th line everywhere.
- All-storms view: four nested fills, the 1-year inside the 2-year inside the 10-year inside the 100-year, and sixteen lines; depth shading off and its control grayed.
- By-hand sea level: `year` grayed, one line.
- Metrics table shows monotone non-decreasing land under water down the percentile rows.

## 5. Office to Residential Conversion (`after-five`)

### 5.1 The reframe

Agents removed. The year removed; the date is 2040 and is in the subtitle and card. The representation is a sidewalk heat map through the day, in two forms, plus the convertibility view. The financial test gets four cited scenarios and a default that converts. See the text file for every string and the four scenario notes.

### 5.2 Schema

Removed: `year`, `office_rent_trend`, `opex_share` (split in two), `colour_by` (replaced by `view`), `streets`, `ground_floor_p`, `compare_hours`, `hour_b`, `agent_count`, `schedule_source`, `resident_schedule`, `arrival_median`, `arrival_spread`, `departure_median`, `departure_spread`.

| key | panel | type | control | default | options / range | notes |
|---|---|---|---|---|---|---|
| `district` | representation | string | enum | `mn01` | `mn01`, `mn05`, `both` | |
| `view` | representation | string | enum | `activity` | `activity`, `population`, `convertibility` | |
| `hour` | representation | number | slider, `x-timeline: primary`, `x-format: clock`, `x-play-rate` as today, loop | 8 | 0–24, step 0.25 | `x-disabled-when: {view: [convertibility]}`; autoplay on the sandbox route in the two heat map views |
| `added_floors` | representation | boolean | toggle | true | | |
| `scenario` | assumptions, "the deal" | string | enum, vertical buttons | `comptroller_2025` | `asking_2024`, `downtown_b_2026`, `comptroller_2025`, `assessor_distressed`, `custom` | `x-enum-notes` from the text file; `x-scenario-values` below |
| `office_rent` | assumptions | number | slider | by scenario | 20–120, step 1 | `x-scenario-of: scenario`, `x-emphasis` |
| `opex_office` | assumptions | number | slider | by scenario | 0.15–0.60, step 0.01 | scenario-of |
| `cap_rate_office` | assumptions | number | slider | by scenario | 0.03–0.20, step 0.0025 | scenario-of |
| `residential_rent` | assumptions | number | slider | by scenario | 30–150, step 1 | scenario-of |
| `opex_residential` | assumptions | number | slider | by scenario | 0.15–0.60, step 0.01 | scenario-of |
| `cap_rate_residential` | assumptions | number | slider | by scenario | 0.03–0.10, step 0.0025 | scenario-of |
| `conversion_cost_sf` | assumptions | number | slider | by scenario | 100–800, step 5 | scenario-of |
| `convertibility_threshold` | assumptions, "the convertibility score" | number | slider | 0.5 | 0–1 | unchanged, `x-emphasis` |
| `w_depth`, `w_f2f`, `w_area`, `w_age` | assumptions | number | slider | 0.35, 0.25, 0.20, 0.20 | 0–1 | unchanged |
| `incentive_467m` | assumptions, "the rules" | boolean | toggle | true | | unchanged |
| `min_units_for_conversion_sample` | assumptions | integer | enum | 10 | 1, 2, 5, 10, 20, 50 | unchanged |

`x-scenario-values` (every figure is cited in the scenario notes in the text file; do not change one without changing the note):

| scenario | office_rent | opex_office | cap_rate_office | residential_rent | opex_residential | cap_rate_residential | conversion_cost_sf |
|---|---|---|---|---|---|---|---|
| `asking_2024` | 54 | 0.35 | 0.055 | 75 | 0.35 | 0.055 | 350 |
| `downtown_b_2026` | 39 | 0.35 | 0.055 | 72 | 0.35 | 0.0525 | 400 |
| `comptroller_2025` (default) | 54 | 0.35 | 0.16 | 79 | 0.20 | 0.05 | 500 |
| `assessor_distressed` | 46.84 | 0.49 | 0.0949 | 79 | 0.20 | 0.05 | 374 |

The deal test, unchanged in form: converts if `residential_rent × (1 − opex_residential) / cap_rate_residential − conversion_cost_sf > office_rent × (1 − opex_office) / cap_rate_office`, per square foot of floor area. Check at the defaults: office value 54 × 0.65 / 0.16 = $219; residential 79 × 0.80 / 0.05 − 500 = $764; converts. At `asking_2024`: $638 vs $536; does not. Print these four scenario outcomes (buildings converted, homes created) in the dev note.

### 5.3 The day

Two hourly curves, both 24 bins, both shipped in the manifest with their sources:

- **Workers.** The existing MTA curve: arrivals at and departures from the district's complexes by hour, October 2024 weekdays (`data/processed/after-five/` already has it). Normalize arrivals to sum to 1 and departures to sum to 1. A building's office population `J_b` (LODES jobs allocated by office floor area, as today) sends `J_b × (arrivals[h] + departures[h])` people onto the sidewalk in hour h.
- **Residents.** New: from the ATUS activity file already on disk (`atusact-0325.zip`, `atusresp-0325.zip`; weights `TUFNWGTP`, drop `TUYEAR = 2020`, weekdays only by `TUDIARYDAY` 2–6), the weighted share of all respondents at home (`TEWHERE = 1`) in each hour of the diary day (4 am to 4 am; remap to 0–24). Flow in hour h is `|home[h+1] − home[h]|`, normalized so the day's flows sum to 2 (one departure and one return per person on average; state this normalization in the dev note). A building's residents `R_b` (apartments × persons per household, as today) send `R_b × flow[h]` people onto the sidewalk. Existing residential buildings use the same curve.
- The old `after-five-agents.py` products (trips, predecessor arrays, gateway weights) are no longer read; leave the files in `data/processed/` but stop shipping them in the manifest, and delete `agents.js`, `agents.worker.js`, and the worker's import.

### 5.4 The heat map

- Grid: 10 m cells in EPSG:2263 (feet: 33 ft) over each district's bounding box, precomputed in `after-five.py` as a cell index with a per-cell "sidewalk" mask (1 where the cell center is not inside any building footprint, 0 otherwise). Ship the grid header (origin, size, cell) and the mask as a PNG or a packed Uint8Array.
- Per building, precompute the list of sidewalk cells within 50 m of the footprint edge, with a weight `exp(−d² / (2 × 25²))` on the edge distance d, normalized so a building's weights sum to 1. Ship as a CSR array (offsets, cell ids, weights). For CD1 and CD5 together this is on the order of 3,000 buildings × ~500 cells; under 2 MB as Uint16/Float32.
- In the browser, per hour h and per view: office channel `O[c] = Σ_b w_bc × J_b × (arr[h] + dep[h])` over office buildings; residential channel `R[c] = Σ_b w_bc × R_b × flow[h]` over residential buildings (converted plus existing). Recompute when the conversion set changes (any assumption move) for all 24 hours at once (24 × cells, Float32, trivial), then per frame interpolate between hour bins for the timeline. Do it in a worker only if a full recompute exceeds 50 ms.
- **Activity view:** `A[c] = O[c] + R[c]`, drawn with a `BitmapLayer` from a texture updated per frame, nearest sampling (pixelated by design), ramp gray `#9a9a9a` (0) → yellow `#f2d43c` → red `#d7301f`. Normalize by `A_max`, the 98th percentile of `A` over all cells and all 24 hours at the *default scenario* for the selected district, computed once and printed in the legend as people per hour per cell; clamp above. This keeps colors comparable across hours and across scenarios.
- **Population view:** two channels drawn in one texture: blue `#2b5bd7` with alpha ∝ O[c]/A_max and dark green `#1f6f3f` with alpha ∝ R[c]/A_max, blended (screen or plain alpha over the basemap; pick what reads and keep it).
- Buildings, all views: office light blue-gray `#c9d3e0`; converted to homes dark green `#1f6f3f` (replaces the orange); existing homes tan `#d9c9a3`; other gray `#bdbdbd`. Added floors as today.
- **Convertibility view:** the existing score coloring, threshold marked; heat map hidden; clock disabled.
- Crop: white 75% mask over the whole map with the selected district polygon(s) cut out (both when `district = both`). Community district geometry: NYC Open Data `yfnk-k7r4` (Community Districts), fetched to `data/original/`, the two polygons simplified and shipped in the manifest. Camera: the existing 3D view, initial bounds the selected district(s).
- Remove the street-graph coloring, the eye-height camera, the two-hour comparison and every agent sprite.

### 5.5 Metrics

In the order and with the labels in the text file. The first is `Σ O` and `Σ R` over the district's cells at the current hour, as two numbers on one row.

### 5.6 Acceptance

- Defaults (`comptroller_2025`, CD1, activity view, 08:00): a nonzero heat map concentrated around office buildings and the station exits' surroundings only insofar as buildings are near them (there are no gateways any more; say so in the dev note). Buildings converted > 0 and homes created > 0.
- Switch to `asking_2024`: buildings converted = 0, the heat map at 17:00 is office-only, and the population view shows no green anywhere except existing residential buildings.
- At `comptroller_2025`, 20:00: green present around converted buildings; 08:00 and 17:00 show the office peaks. The residential curve should show its own morning departure and evening return; if the ATUS at-home curve makes residential flow peak at the same hours as offices, print the curve in the dev note and do not tune it.
- Moving any deal slider switches the scenario button to `custom`.
- Hour plays and loops; no year control exists anywhere.

## 6. Anthromes and A City Simulator, Opened Up

Reorganize only. Text files give the two-panel split.

- **Anthromes:** `year` (timeline) and `color_by` (renamed from `colour_by`) get `x-panel: representation`; all eleven thresholds and densities and `tree_biomes` get `x-panel: assumptions` with their existing `x-group` sub-headings. No control added or removed.
- **Coefficients:** `layer` gets `x-panel: representation`, and the external engine transport draws at the top of the representation panel; every coefficient, `seed`, `run_count`, `ticks` get `x-panel: assumptions` with their existing groups. The fifteen-raster rail and the divergence chart stay where they are; with the map now filling the stage, revisit their size (the 09-04 doc's complaint that the window is too small to follow) and give the rail a strip along the top of the map that can be toggled from the representation panel with a new boolean `show_rail` (default on, `x-panel: representation`). This is the only control added anywhere in the reorganization.

## 7. Sunlight and studio twin

Unchanged and unpublished. Adam is providing a new 3D model; a later build doc covers it. Do not touch `src/lib/sandboxes/sunlight/` beyond what the frame change forces (its schema needs `x-panel` on every property: `date`, `hour`, drawing toggles and floor choice to representation, everything else to assumptions).

## 8. Data

New fetches (append to `data/scripts/fetch-sources-0904.sh` or a new `fetch-sources-0908.sh`; fetch scripts here have never been run by the machine that writes them, so validate content, not size, per `utilities/memory/fetch_traps.md` in the vault, summarized: Socrata returns `permission_denied` as HTTP 200; check for a JSON body with features):

- NYC Borough Boundaries, `tqmj-j8zm`, GeoJSON export → `data/original/borough_boundaries.geojson` → Queens polygon.
- NYC Community Districts, `yfnk-k7r4`, GeoJSON export → `data/original/community_districts.geojson` → `BoroCD` 101 and 105.
- ATUS: already on disk; the at-home curve is a new derivation in `after-five.py`.

`preflight.py` gains a check for each new file. Re-run it before building anything that reads them.

## 9. Prose

Copy strings from `utilities/2026-09-08 sandbox text/<slug>.md`. `card.md` sections are there in full; `meta.js` `subtitle`, `controls`, `metrics`, `data`, `cannotSee` must agree with the card (the assistant prompt reads them verbatim); the dev notes (`src/content/tutorials/01-pencil.md`, `02-after-five.md`, `05-bathtub.md`) need their Ambition / Parts / Roadblocks / What came out sections updated to the new views, with the figures the acceptance checks produce, and the `.gap` callout kept. Mark any sentence you had to write yourself with `<!-- PROSE DRAFT -->`.

## 10. Order

1. Frame: floating panels, `x-panel`, `x-shown-when`, `x-scenario-of`, cover hook. Verify on bathtub with only `x-panel` added to its schema, before any sandbox logic changes.
2. Anthromes and Coefficients reorganization (small, proves the frame on an engine clock).
3. Bathtub (§4).
4. Pencil (§3).
5. After Five (§5); the data fetches for §8 can run on Adam's machine while 3 and 4 are built.
6. Covers, `_example` manifests, dev notes, `npm run audit:freeze`, `preflight.py`.

Say at the end, in a short list: every file changed, every control removed, the four scenario outcomes, the two pencil test-2 counts, and anything in this document you could not do as written.
