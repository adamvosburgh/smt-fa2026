---
title: Build Notes — what the build changed
date: 2026-08-31
type: content
---

# What the build changed

**Read this before the three build docs.** They were written as specifications
and several of their factual claims turned out to be wrong. Where this document
and a build doc disagree, this one is later and was checked against the data.

Everything below was verified on 2026-08-31 by running it, not by reading about
it. Figures are quoted so they can be re-checked.

---

## Sources that were not what the spec said

### `w9ak-ipjd` contains only Brooklyn

The doc names "DOB NOW: Build – Job Application Filings" as the modern half of
the conversion record, and it is necessary because the legacy dataset's Manhattan
coverage collapses after 2020.

**It has 86,130 rows and every one is Brooklyn.** Every job filing number is
prefixed `B`. There is no Manhattan in it at all. Nothing in the dataset's title
or description says so; you find it by grouping on borough.

Replaced with **`pkdm-hqz6`, DOB NOW: Certificate of Occupancy**, which is
citywide (30,422 Manhattan rows) and is arguably better evidence anyway — a
certificate is a completion where a filing is only an application.

**And then the same trap one layer down.** Of 81,139 certificates, **46,772 are
"Renewal Without Change"** and 6,595 are "Renewal With Change" — re-issued
paperwork for buildings that converted years ago or never converted. Counting
them invents a wave of activity out of an administrative process. Only `Initial`
and `Final` are kept, earliest per building.

"A filing is not a building" was the warning. A certificate is not a conversion
either. Assume there is always one more layer.

### There is no City of Yes ADU eligibility layer

The 02 doc flagged this as unverified. **Confirmed: it does not exist.** The NYC
Open Data catalogue was searched and there is no published ADU eligibility
dataset. The flags in `pencil.py` are ours, derived from the published rules, and
the script docstring, the manifest and the card all say so.

### The Rhino 3D model carries no identifiers, and inferring them failed

DCP publishes the 2014 survey twice. The `.3dm` per community district is the
obvious choice — clean layers, one file per district.

**It has no attributes at all.** Not a name, not a user string, not a BIN or BBL,
on any of 132,223 objects. So identity has to be inferred by position.

That was built and it looked excellent: **1,744 of 1,752 buildings matched,
median distance 2 feet.** Then it was checked against the CityGML, which carries
real BINs, and **it was wrong for one building in five.**

The reason is the most useful thing in the whole build. *Nearest centroid* is not
*same building*. In a district of party-wall buildings the nearest centroid is
frequently the neighbour, and the two-foot median measured **how close the
nearest centroid was, not whether it was the right building.** A precise,
correct, well-calculated measurement of the wrong quantity.

Now uses **CityGML (`tnru-abg2`)**, delivery areas DA12 and DA19 for Manhattan
CD1 and CD5. Every surface carries its BIN. Nothing in that pipeline is joined by
position any more.

**Generalise this:** ask of every join statistic, *what would this number look
like if the join were wrong?* If the answer is "about the same", it is not a
validation.

### Sources the spec named that do exist and were used

- HPD Plus One ADU term sheet — every figure quoted verbatim, verified.
- 467-m FAQ — eligibility tests verified. **The benefit schedule is genuinely not
  in it**, so 467-m is modelled as a gate and not as money, exactly as the doc
  anticipated.
- Floodplain layers: `27ya-gqtm` (2050s) and `ek8y-fsqz` (2080s) both exist and
  download as GeoJSON. They are **not** the Zoning Resolution's "expanded flood
  area" and are used as the closest available approximation, stated.
- MapPLUTO's **`TrnstZone`** field exists and carries the Greater Transit Zone by
  name. This resolves the 02 doc's transit-zone question with no extra download.
- MapPLUTO's **`CD`** field lets a community district be selected by ID rather
  than a boundary polygon — worth knowing for any future district-scoped work.

---

## Facts about the engine the 04 doc got wrong

### There are 15 block maps, not 14

The doc says 14 and then enumerates 15 (12 named plus 3 scratch). The
enumeration is right, the count is wrong.

### The 2,400-line figure is right about the wrong thing

The whole `src/` tree is **13,462 lines across 90 files**. The *simulation core*
the doc lists — `simulation.js`, `valves.js`, `traffic.js`, the zone files,
`census.js`, `blockMap.ts`, `blockMapUtils.js`, `random.ts` — is **2,446 lines
across ten files**. So "about 2,400 lines" is accurate for the model and wrong
for the project. The tutorial makes the distinction.

### `landValue -= 20` is not in `crimeScan`

The doc puts it there. It is in `pollutionTerrainLandValueScan`, at
`blockMapUtils.js:256`. Same feedback loop, different function.

### The seeded-PRNG refactor was already done upstream

The doc treats this as the hard part — "find every `Math.random` in the vendored
source". **There are zero literal `Math.random` calls outside `random.ts`.** All
112 `Random.*` call sites across 24 files already funnel through that one module,
whose `getRandom()` already takes an injectable object shaped like `Math`.

Seeding the entire simulation is **one default parameter in one file**.

### Three things the doc could not have known

**The crime function never ran.** `crimeScan`'s loop was bounded by
`crimeRateMap.mapWidth` and `.mapHeight` — properties `BlockMap` does not have.
Both read `undefined`, `0 < undefined` is false, the body never executed. Crime
was zero in every city, `census.crimeAverage` always exactly 0, and the
land-value penalty above crime 190 could never fire. **The feedback loop the
engine is famous for was switched off**, and nothing announced it: cities grew,
graphs moved, the overlay was simply always empty.

Fixed (`gameMapWidth` / `gameMapHeight`). With the fix, `crime_base` 40 → 128 →
220 gives average crime 23 → 92 → 171, and population falls as crime rises.

**Phase 9 threw on the first census.** `take10Census(budget)` referenced a bare
`budget` that does not exist in scope. Under ES modules that is a `ReferenceError`.
Fixed to `this.budget`.

**The engine's step is wall-clock throttled.** `_simFrame()` returns early unless
10–100 real milliseconds have passed. So "speed" is a rate limiter and calling
`simTick()` in a loop simulates almost nothing. A `simTickImmediate()` was added
alongside it — one call, one step, no clock — because the divergence chart, the
cover screenshot and replayable submissions all need it.

All three are recorded in `src/lib/sandboxes/coefficients/NOTICE.md`.

---

## Modelling decisions the specs left open, and what was chosen

| Question | Chosen | Why |
| --- | --- | --- |
| 02: property tax | **Ignored entirely** | The marginal assessment of an added unit is in no dataset. Margins are optimistic by whatever it would have been, and the card says so. |
| 02: `owner_occupancy` control | **Removed** | It changed nothing — the only screen it applied was already applied. A dead control is worse than a missing one because it implies the model knows something it does not. The requirement is now in "what it can't see". |
| 02: attached vs detached | **Detached only** | Follows from the sizing step: the unit is sized from the rear yard, which is what a detached cottage occupies. An attached extension is a different building on a different part of the lot and this pipeline has no measurement of it. |
| 03: back-test against 421-g | **Cut** | The legacy dataset's earliest pre-filing date is 2000-01-01. It cannot reach 1995. A validation that silently starts late is worse than none. |
| 03: weekend activity index | **Cut** | Needs a weekend profile. Deriving one from a weekday distribution is invented precision. |
| 03: districts | **Both CD1 and CD5, switchable** | CD1 alone is 612KB; both is 1.8MB. Negligible. |
| 04: `rules.js` | **Unwired** | The function table is built and the engine calls through it, so wiring it later is a switch. Nothing loads submitted code. |
| 04: panel vs file | **The uploaded file wins** | Enforced in one place, `tunables.js`. |

---

## Things that are shaky and will need work

Ranked by how much they would change a student's conclusions.

### 1. After Five has no agent layer

The sandbox is named for a crowd that is not in it. **See
`2026-08-31 Build Doc — 03b After Five, The Agent Layer.md`** for the options.
This is the largest outstanding gap on the site.

### 2. After Five's two gates are correlated by construction

Conversion cost was made to scale with the convertibility score, because an
awkward building really is more expensive per foot to convert. That is honest,
but it means the `convertibility_threshold` and `conversion_cost_sf` controls are
not independent — at the default settings the threshold does nothing between 0.2
and 0.7, because buildings that fail on shape already fail on money.

Either accept and document it (currently done), or decouple them and lose the
physical realism. Worth a decision.

### 3. After Five's economic constants are all assumptions

`office_rent_base` (38 $/sf/yr effective), `cap_rate` (0.055), `opex_share`
(0.35), `sf_per_unit` (900). None is sourced. The whole conversion argument is a
debate about exactly these numbers, and right now the sandbox asserts four of
them. At minimum `office_rent_base` should be sourced to a published series, or
exposed as a control.

### 4. Pencil's ADU sizing barely does anything

`min(0.33 × (LotArea − footprint), 800)` — and **109,032 of 246,921 lots hit the
800 cap**, with a median of 707. So for nearly half the borough this
careful-looking estimate resolves to a constant. It is stated in the card, but a
better rear-yard proxy would make the sizing step earn its place.

### 5. Pencil's construction cost default is invented

`cost_per_sf` defaults to 500 because that is where the interesting behaviour
sits, not because anyone published it. HPD's "ADU for You" cost guidance could
not be verified to exist. Everything downstream inherits it. It is labelled as an
assumption in the schema, and it is the number to distrust first.

### 6. The 2050s/2080s floodplains are not the zoning rule's flood area

Used as the closest available approximation. If the Zoning Resolution's
"expanded flood area" is published as a layer somewhere, it should replace them.

### 7. The Coefficients' starting city is a grid

A generated Micropolis map grows nothing, so the sandbox lays out its own
starting city by a loop on blank ground. That is a control condition and it is
the right choice for the divergence chart — but every argument a student makes
about how *this* city grows is an argument about how *a grid* grows. Stated in
the card. A second, differently-shaped starting city would let students test
whether the plan or the coefficients did the work.

---

## Two build traps worth adding to CLAUDE.md

**Lot-level areas are not building-level areas.** MapPLUTO's floor areas are per
tax lot, and several buildings can stand on one. Attributing the lot's whole
office area to each building gave Manhattan CD1 **112M sf of office space against
a real figure of roughly 90M**; dividing across buildings gives 78M. This is the
same bug as bathtub's `UnitsRes`, in the same shape, for the third time. It will
happen again.

**A silently ignored prop looks exactly like corrupted geometry.** deck.gl's
`ColumnLayer` has no `getRadius` accessor — radius is a single prop for every
column. Passing an accessor is not an error; it is ignored, and the default of
**1000 metres** stays in place. At neighbourhood zoom that is about 390 pixels a
column, and the sandbox rendered as a stack of overlapping shards that looked
like broken geometry for an hour. It was one prop that does not exist. When a
layer looks structurally wrong rather than wrongly scaled, check that every prop
you passed is one the layer actually has.

**Sub-pixel marks are moiré, not a map.** At borough zoom a Queens lot is about
0.2 of a pixel, and a quarter of a million sub-pixel columns render as diagonal
streaks that read as a finding. Changing their size changes nothing, because
they are smaller than a pixel either way. The flat view now uses a
`ScatterplotLayer` with `radiusMinPixels`, which is the only thing that fixes it.

**Outliers in a geometry column will paint over the map.** Pencil draws each lot
as a square of its own area. Queens one-to-two-family lots run 1,300–8,900 sq ft
between the 1st and 99th percentiles, but 0.6% are larger and the largest is
**1,106,431 sq ft** — a genuine single-family house on a city-owned parcel. Drawn
at true area that is a 208-metre square, and a handful of them made the whole
sandbox unreadable. Clamp anything that becomes a drawn dimension.
