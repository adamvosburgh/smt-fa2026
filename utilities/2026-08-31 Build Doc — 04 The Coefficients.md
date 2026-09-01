---
title: Build Doc — Sandbox 04, The Coefficients
date: 2026-08-31
type: content
---

> **These are now BUILT. Read
> `2026-08-31 Build Notes — What The Build Changed.md` first.**
> Several factual claims below were checked during the build and turned out to
> be wrong — datasets that are not what they say, an engine bug that had
> disabled a whole subsystem, and a join that validated cleanly while being
> wrong one time in five. Where that document and this one disagree, that one is
> later and was checked against the data.
> Specific to this doc: there are 15 block maps, not 14; the seeded-PRNG work was
> already done upstream and took one line; `landValue -= 20` is in
> `pollutionTerrainLandValueScan`, not `crimeScan`; and **the crime function had
> never run at all** — its loop was bounded by two properties that do not exist.


# 04 — The Coefficients

Read `2026-08-31 Build Docs — Handoff.md` first. Prose written for this sandbox is a draft: terse and explanatory, marked with the PROSE DRAFT line, rewritten later.

Slug `coefficients`. Stubs already in the repo at `src/lib/sandboxes/coefficients/`.

**Build this one first of the three.** There is no data pipeline. The engine exists and is about 2,400 lines. The work is exposure, one refactor, and two decisions that belong to Adam.

---

## What it is

micropolisJS with its guts exposed. The city runs as usual, and beside it a panel renders every internal layer as it updates each tick. The game stops looking like a game and starts looking like a stack of rasters being blurred into each other.

Also on screen: the RCI valves, the census, and a divergence chart across repeated runs of the same starting city.

**The teaching claim.** A simulation that produces emergent-looking behaviour is a small pile of named constants and a fixed order of operations. Both are readable in an afternoon. When you can see the layers being written, the city stops being a world and becomes a data structure — and the constants stop being physics and become claims.

---

## Two decisions for Adam, before any code that depends on them

### 1. Student-submitted `rules.js` is arbitrary JavaScript running on a public site

The spec's third edit surface lets a student rewrite a pluggable function and submit the file. The gallery then runs it. That is arbitrary code execution in every visitor's browser, authored by a third party, on `simmodeltwin.net`.

Options, roughly in order of cost:

- **Sandboxed iframe.** Run the engine in an iframe with a restrictive `sandbox` attribute and no same-origin access, communicating by `postMessage`. Student code can wreck its own frame and nothing else. Most robust, and it changes how the sandbox component is structured — hence the decision coming first.
- **Web Worker.** No DOM, no parent access, structured-clone messaging only. Cheaper, and a worker can still make network requests unless a CSP forbids it.
- **Restrict the surface.** Students edit a small expression language rather than JavaScript, parsed and evaluated by us. Safest, and it removes the third edit surface as designed.
- **Accept it.** Small trusted cohort, code review before it goes in the gallery. Viable if Adam reviews every submission anyway, but it makes the review blocking and the spec says the doctor is not a reviewer.

**Until this is decided, build the first two edit surfaces only** — `coefficients.json` and the tile atlas — and leave `rules.js` unwired. Both are useful on their own and neither executes submitted code.

### 2. Licensing

Better than it looks. The facts:

- micropolisJS is `graememcc/micropolisJS`, GPLv3 with additional terms, plus the Micropolis Public Name License. "MICROPOLIS" is a registered trademark of Micropolis GmbH, licensed as a courtesy to the original authors.
- **`smt-fa2026` is already AGPL-3.0** and its repo is public at `github.com/adamvosburgh/smt-fa2026`. GPLv3 section 13 expressly permits combining GPLv3 code with an AGPLv3 work, so vendoring the engine into this site is fine, and the source-availability obligation is already satisfied by the public repo.

So what is left is bookkeeping, not a legal problem:

- Vendor the source under `src/lib/sandboxes/coefficients/vendor/` with its `LICENSE` and all copyright notices intact. It must sit under `src/` — `import.meta.glob` and the bundler only work there.
- Write `src/lib/sandboxes/coefficients/NOTICE.md`: what was taken, from where, at what commit, under what licence, and what was modified. Link it from the card.
- **The sandbox is called "The Coefficients", not Micropolis and not SimCity.** Read the Micropolis Public Name License at `graememcc.co.uk/micropolisJS/name_license.html` and follow whatever it requires for a modified version — expect a required attribution and a prohibition on implying endorsement. Get this wording in front of Adam rather than deciding it.
- Student submissions are modified GPL code redistributed by the site. They land in the public repo, which satisfies availability, but the tutorial should say so plainly: what you submit here is published under the same licence.

---

## Vendoring and verification

Clone `graememcc/micropolisJS`, record the commit, and **verify every claim below against the checkout before writing code against it.** The figures come from the spec and were not re-checked on 2026-08-31.

- ~2,400 lines across seven files.
- `simulation.js` builds 14 `blockMaps`: `landValueMap`, `crimeRateMap`, `pollutionDensityMap`, `populationDensityMap`, `trafficDensityMap`, `rateOfGrowthMap`, `terrainDensityMap`, `cityCentreDistScoreMap`, police and fire maps with their "effect" twins, and three scratch maps. **Enumerate them from the source and correct the list here if it is wrong.**
- The loop is `_simFrame` → `_simulate`, a 16-phase cycle keyed on `_phaseCycle & 15`. Phases 1–8 scan the map in eighths; 9 is the census; 12 is `pollutionTerrainLandValueScan`; 13 is `crimeScan`; 14 is `populationDensityScan`; 15 is `fireAnalysis`.
- Tunables sit as locals at the top of their functions, so they are findable by reading.

The engine has its own build setup. **Do not adopt it.** Vendor the source files and let Vite bundle them as part of the site; if the engine's module format resists, note what had to change in `NOTICE.md`.

---

## The refactor

About a day of work, and it is what turns a game into a sandbox.

### Pull tunables into `coefficients.json`

One flat file of named constants, loaded at startup, with every value the sandbox exposes. The named constants and where they live:

| Constant | Location | What it asserts |
| --- | --- | --- |
| Crime base `128`, and the `landValue`, `populationDensity`, `police` terms | `crimeScan` | Crime is poverty plus density minus policing. |
| `landValue -= 20` when crime > 190 | `crimeScan` | Crime lowers land value, which raises crime. Self-reinforcing by construction. |
| `34` and the `/2` distance divisor | `pollutionTerrainLandValueScan` | `landValue = 34 − cityCentreDistance/2`. A bid-rent gradient in one line, with no alternative geometry possible. |
| `MAX_TRAFFIC_DISTANCE = 30` | `traffic.js` | A zone has jobs if a random walk of ≤30 steps finds a destination. There is no routing. |
| `taxTable`, 21 values from +200 to −600 | `valves.js` | The entire response of the economy to tax rates. |
| `extMarketParamTable = [1.2, 1.1, 0.98]` | `valves.js` | Global demand, keyed to difficulty. |
| `birthRate = 0.02`, `labourBaseMax = 1.3`, `internalMarketDenom = 3.7` | `valves.js` | Demography. |
| Per-tile pollution constants | `getPollutionValue` | Which land uses are dirty, and by how much. |
| Smoothing passes, currently 3 | `smoothMap` | Police coverage spreads by blurring three times. Influence is a convolution. |
| Growth and decay thresholds | `residential.js`, `commercial.js`, `industrial.js` | When a zone develops or decays. |

Not every one of these becomes a slider. **Every one goes in `coefficients.json`**; the schema exposes a subset as controls, and the rest are edited by students in the submitted file.

### Make functions pluggable

`crimeValue()`, `landValue()`, `trafficReach()`, `pollutionValue()`, `taxResponse()`, `smoothPasses()`. Each becomes a named entry in a function table with the current implementation as the default, so a submitted `rules.js` can replace one entry without touching anything else. Build the table now even while `rules.js` is unwired — it is what makes the third surface a later switch rather than a later rewrite.

### Replace `Math.random` with an injectable seeded PRNG

**This is not optional and it is not in the spec.** Three things depend on it:

- The divergence chart is only meaningful if the runs differ by seed and nothing else.
- The cover screenshot must be reproducible, which means a fixed seed and a fixed tick count.
- A submitted city has to replay to the same state, or a student's argument about their own run cannot be checked.

Find every `Math.random` in the vendored source and route it through one injectable generator. Seed is a parameter.

### Tile atlas as a swappable file

One image, loaded by URL rather than imported, so a submitted `tiles.png` replaces it with zero code. Document the atlas geometry — tile size, grid order, count — in the card and the tutorial, because a student replacing it needs to know the layout.

---

## What gets rendered

Three regions in the viewport.

1. **The city.** Canvas 2D, as the engine draws it. No deck.gl, no three.js. Sandbox 04 is deliberately the cheapest in the set and the only 2D one.
2. **The layer panel.** One small canvas per `blockMap`, redrawn from the typed array. Each labelled with the map's name, the phase that writes it, and the value range. Throttle the redraw — the maps update on their own phases, not every frame, so redraw a map when its phase fires rather than on a timer.
3. **The readouts.** RCI valve values, the census figures, and the divergence chart.

**The 16-phase diagram gets made once.** Sixteen boxes: what each phase writes and who reads it. A static inline SVG in the tutorial and in the card, not a live animation — though highlighting the current phase in the live panel is cheap and worth doing. This diagram is the single most useful artefact in the sandbox and it is reusable in a lecture.

### The divergence chart

Same starting city, `run_count` seeds, run headlessly at maximum speed in a Web Worker, record one metric per tick, plot mean and range against tick number.

Default `run_count` of 5 and a fixed tick budget. The chart is the argument that the rules are deterministic and the outcomes are not, which is the thing students most often get backwards about emergence.

Call `onready(false)` while the runs are in flight and `onready(true)` when the chart has drawn, so the cover screenshot waits for it.

### View mode

The spec says student versions run live in the gallery. A gallery page with thirty live city simulations will melt a laptop. So in `mode === 'view'`: smaller canvas, no layer panel, no divergence runs, and **auto-pause after a fixed tick count**. Say in the card that the gallery card is a short run, not the sandbox.

---

## Params and assets

This sandbox is unusual: most of what a student changes is a **file**, not a parameter. Keep the split clean.

**Params** (`schema.json`, validated server-side, drawn as the panel): the constants exposed as sliders, plus the view controls.

**Assets** (uploaded, listed in `manifest.assets`): `coefficients.json`, optional `rules.js`, optional `tiles.png`, a saved city, and a run log. Kilobytes, nowhere near the 15MB cap.

**The overlap needs one rule and it needs stating in the card.** A student can set a constant with a slider and also ship a `coefficients.json` that sets it. Decide which wins — the recommendation is that the uploaded file wins and the panel shows the file's values as the starting point — and enforce it in one place.

Note for the build doctor: the spec says sandboxes where students submit code must include the source in the submission so a stack trace resolves to a line. `rules.js` is that case. It is submitted as an asset already, which satisfies this; make sure source maps survive the build.

### Proposed schema

| Property | Group | Type | Range | Default |
| --- | --- | --- | --- | --- |
| `crime_base` | crime | integer | 0–255, step 1 | 128, **`x-emphasis`** |
| `crime_land_value_weight` | crime | number | 0–2, step 0.1 | 1 |
| `crime_police_weight` | crime | number | 0–4, step 0.1 | engine default |
| `land_value_centre_base` | land value | integer | 0–100, step 1 | 34 |
| `land_value_distance_divisor` | land value | number | 0.5–8, step 0.5 | 2, **`x-emphasis`** |
| `max_traffic_distance` | access | integer | 5–120, step 5 | 30 |
| `smooth_passes` | influence | integer | 0–8, step 1 | 3 |
| `birth_rate` | demography | number | 0–0.1, step 0.005 | 0.02 |
| `ext_market_index` | demography | integer | enum 0, 1, 2 | 1 |
| `seed` | the run | integer | 0–99999 | 1 |
| `run_count` | the run | integer | 1–12, step 1 | 5 |
| `ticks` | the run | integer | 100–5000, step 100 | 1000 |
| `layer` | how it's drawn | string | enum of blockMap names, plus `none` | `landValueMap` |
| `speed` | how it's drawn | integer | enum 1, 2, 3 | 2 |

Verify every default against the vendored source. **A default that does not match the engine's own value is the worst possible bug here**, because the whole sandbox is an argument about what the defaults are.

**Emphasis on `crime_base` and `land_value_distance_divisor`** — the two single numbers that carry a contested social claim each. Their `description` fields are the most important prose in the sandbox. Say what the line of code is, what it asserts about cities, and that it is a constant rather than a finding.

---

## Metrics

- `population`
- `residential / commercial / industrial demand` — the RCI valves
- `mean land value`
- `mean crime`
- `spread across runs at the final tick` — the divergence number
- `ticks run`

---

## No data pipeline

There is no `data/scripts/coefficients.py` and no `data/processed/coefficients/`. Do not add rows to the data READMEs. The engine and its default `coefficients.json` are source, and they live under `src/`.

Say this in the tutorial's `## Producing the data` section rather than skipping the heading — the heading is an API and the doctor points at it. What goes there is where the engine came from, what a `blockMap` is as a data structure, and what the tile atlas is. **The data in this sandbox is the code**, which is a point worth making rather than working around.

---

## card.md

**What this is.** A city simulation from 1989, opened up. It plays like the game it is, and next to it every internal layer is drawn as it updates — the numbers the simulation keeps about land value, crime, pollution, traffic, and where the centre of the city is.

**Why we're looking at this one.** It is the ancestor of a great deal of urban simulation, and it is small enough to read. Its rules are about twenty named constants. Some of them encode claims about cities that people still argue about, written as a line of arithmetic with no argument attached. The clearest is the crime function.

**The data.** micropolisJS, its provenance and licence, and what a `blockMap` is. The tile atlas. That the data here is source code.

**How the map gets made.** The 16-phase cycle, with the diagram. What each phase writes and who reads it. Smoothing as the way influence spreads. That the maps are written in a fixed order and the order matters.

**What it assumes.** The named constants, with the crime function first and stated in full. Monocentricity as one line. Access as a random walk with no routing. Tax response as a hardcoded table. And the structural one: every one of these is a constant, so nothing in the model can learn, and no city in it can be different in kind from any other.

**What it can't see.** Anyone. There are no people in it — only densities, and rates, and a growth valve. It cannot represent a city where the centre is not the most valuable place, because the land value function makes that geometrically impossible.

---

## Tutorial

`src/content/tutorials/04-coefficients.md`, `sequence: 4`.

Framing section: reading a simulation as a text. The point is that 2,400 lines is small, that a student can read all of it, and that this is unusual and should be the expectation rather than the exception.

`<div class="gap">`: the sandbox runs the divergence chart across several seeded runs in a worker and renders all fourteen layers. The tutorial version runs one seed and renders one layer. Same engine.

**## Producing the data** — where the engine came from, the licence, what a `blockMap` is, the tile atlas layout.

**## Setting up the web environment** — vendoring third-party source under `src/`, the sandbox contract, and how the engine is isolated from the page.

**## The parameters** — the three edit surfaces at three floors of difficulty. Replace the tile atlas and change nothing else: same rules, different world, and a student who won't touch JavaScript has made an arguable submission. Then the constants. Then, if it is wired by then, a pluggable function. Embedded mounts at the default and at a changed `crime_base`.

**## The assumptions** — the constants table, and then the file-format point that runs through this whole course: these are constants because the file format is a constant. Nothing in the engine can be fitted to a city; there is no place to put data.

**## Challenge** — surface one assumption, show the layer it writes, change it, show the divergence. That is also the assignment.

---

## Open questions for Adam

1. **The `rules.js` sandboxing decision.** Blocks the third edit surface; nothing else.
2. **Name-licence wording** for the card and `NOTICE.md`.
3. **Panel or file wins** when both set a constant.
4. Whether the 16-phase diagram should be authored here or drawn by hand — it is worth a proper drawing and it will get reused.
