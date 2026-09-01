---
title: Build Doc — Sandbox 03, After Five
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
> Specific to this doc: `w9ak-ipjd` contains ONLY BROOKLYN and was replaced with
> certificates of occupancy; the Rhino `.3dm` files carry no identifiers at all
> and were replaced with CityGML; the back-test is cut because the data starts
> in 2000. **The agent layer is NOT built** — see
> `2026-08-31 Build Doc — 03b After Five, The Agent Layer.md` for the options.


# 03 — After Five

Read `2026-08-31 Build Docs — Handoff.md` first. Prose written for this sandbox is a draft: terse and explanatory, marked with the PROSE DRAFT line, rewritten later.

Slug `after-five`. Stubs already in the repo at `src/lib/sandboxes/after-five/`.

**Build this last.** It has the most moving parts of the three and two of its sources are unresolved. Sandboxes 04 and 02 both ship before this one starts. When it does start, build it in the order given under *Build order within the sandbox* below, and stop after each stage to check it is worth continuing.

---

## What it is

A district of Lower Manhattan and Midtown South in 3D, running two clocks at once.

The **slow clock** is years. Buildings recolour from office to residential as they convert, and grow floors where a filing added them. The **fast clock** is a single looping day: roughly two thousand agents move on the street network with a trailing effect.

You scrub the year while the day keeps looping, and you watch the district stop going dark at night.

**The teaching claim.** The interesting output of a conversion policy is not the unit count. It is what the street is like at nine in the evening, and that is a consequence of the unit count that nobody publishes.

---

## The three layers

### 1. Base massing

DCP 3D Building Model, downloaded by Community District. Joins to everything else on **BIN**.

Verify the current publication format before writing the loader — the model has been distributed as multipatch shapefiles and as DAE, and the format decides whether the pipeline extracts footprint-plus-height or converts meshes. **Prefer extracting footprint and height and re-extruding in deck.gl** over shipping meshes: it is smaller, it recolours per building for free, and it lets the added-floors step be a number rather than a geometry edit.

Pick the community districts before downloading. Lower Manhattan and Midtown South is roughly Manhattan CD 1 and CD 5; confirm against the district boundaries rather than assuming.

### 2. Change record

**Dataset IDs verified 2026-08-31 as existing on NYC Open Data:**

- `ic3t-wcy2` — DOB Job Application Filings (the legacy BIS system)
- `w9ak-ipjd` — DOB NOW: Build – Job Application Filings (the current system)

**These are two datasets covering two eras and you almost certainly need both.** DOB migrated job filings to DOB NOW over several years; a query against `ic3t-wcy2` alone will show conversions falling off a cliff on the migration date, which looks exactly like a policy effect and is not one. **Check the date coverage of each dataset before running any time series, and union them if they split.** Their schemas differ; the union needs a documented column mapping in the script.

Fields, from the spec, recorded there as schema-verified against `ic3t-wcy2` — re-check them against the live dataset and against `w9ak-ipjd`, which uses different names:

`job_type` (**A1** = change of use / occupancy, the conversion flag) · `existing_occupancy` / `proposed_occupancy` · `existing_dwelling_units` / `proposed_dwelling_units` · `existingno_of_stories` / `proposed_no_of_stories` · `existing_height` / `proposed_height` · `enlargement_sq_footage` · `bbl` · `bin__`

Joins to MapPLUTO on BBL and to the massing on BIN. MapPLUTO is already on disk; take `BldgClass`, `OfficeArea`, `BldgArea`, `NumFloors`, `YearBuilt`, `LotArea`, `BldgFront`, `BldgDepth`, `BuiltFAR`, `CommFAR`, `ResidFAR`, `Address`. All verified field names.

**A filing is not a building.** A job application is an application. Some are withdrawn, some are superseded, some never get a permit. Filter on status and say which status you filtered on, in the script docstring and in the card.

### 3. Geometry change

Added floors are the existing roof footprint extruded upward by `proposed_height − existing_height`.

**State the limit in the card:** this represents the *quantity* of change, not its form. No setbacks, no courtyards, no new envelope. A building that grew four floors grows a four-floor block.

**The two-tier fix.** Three to five marquee conversions — 25 Water, 160 Water, 55 Broad, One Wall — modelled or sourced properly and dropped in as resolved buildings inside a district of massing. The resolved ones are where someone actually looked, and the contrast between them and the blocks is the honest statement of what the massing is. Adam's modelling queue lists these as optional; treat them as a late addition, not a dependency.

---

## The agent layer

**The agents are not a simulation, and this is the simplification that makes the whole sandbox affordable.**

Each building emits trips according to a published occupancy schedule for its use. Convert a building, swap its schedule, and street activity follows. There is no agent-based model, no route choice, no calibration, and nobody in it is deciding anything.

Pipeline:

1. `osmnx` for the street graph of the district, and for shortest paths between building entrances.
2. For each of **six year-snapshots**, take the set of building uses at that year, generate trips from the schedules, and bake them to a file. 2–4MB each.
3. `TripsLayer` animates them on the GPU. The fast clock is `currentTime` looping over 24 hours.

Snapshots are **site assets, not submission assets** — they sit in `data/processed/after-five/` and are outside the 15MB submission cap.

File shape per snapshot: a binary of path vertices and timestamps plus an index, or GeoJSON if the size allows. Specify it in `manifest.json` alongside the year each snapshot represents. Six discrete snapshots means the year scrubber steps between them; either snap the scrubber to the six years or cross-fade, and say which in the card.

### The unresolved source

**The occupancy schedules need a citable published source and one has not been identified.** Without it the agent layer is an animation of a number someone made up, which is the failure this course exists to name.

Look for DOE commercial prototype building schedules, ASHRAE 90.1 Appendix G schedule sets, or an equivalent published occupancy profile for office and residential use. **Whatever is used gets named in the card, in `meta.js` `data`, and in the tutorial.** If nothing citable can be found, say so and either drop the agent layer or label it explicitly as an illustrative assumption with no source — do not let it look sourced.

---

## The conversion rule

Two gates, applied per building.

### Convertibility score

From Gensler's published convertibility criteria: floorplate depth core-to-window, floor-to-floor height, facade and window operability, structural bay, age, elevator count.

**Gensler's actual scoring and weights are not published in a form you can implement.** So what gets built is *our* score of *their* criteria. That sentence, or one like it, goes in the card. Do not present the result as Gensler's algorithm.

Proxies available from what is on disk, with their weaknesses:

| Criterion | Proxy | Weakness |
| --- | --- | --- |
| Floorplate depth | `BldgDepth` from MapPLUTO, halved as a core-to-window estimate | Assumes a centred core and a rectangular plate. Both are often wrong. |
| Floor-to-floor | Building height from the massing model divided by `NumFloors` | Averages over mechanical floors and lobbies. |
| Floorplate area | `BldgArea / NumFloors` | Fine. |
| Age, standing in for facade and structural bay | `YearBuilt` | A real proxy, and a crude one. Say it is standing in for two criteria it does not measure. |
| Window operability | none | Not derivable. Drop it and say so. |
| Elevator count | none in MapPLUTO | Drop it, or source it, or drop the criterion. Do not invent a count from floor area. |

The score is a weighted sum, the weights are ours, and `convertibility_threshold` is an exposed control. **The weights should be visible somewhere** — in the manifest at minimum, ideally in the card.

### Pro-forma gate

Conversion cost per square foot against the residential rent the converted units would command, net of the office rent given up, with 467-m applied if it is switched on. Same shape as sandbox 02's arithmetic: precompute the per-building constants, recompute the deal on every slider move.

### 467-m

**Verified 2026-08-31, from `nyc.gov/assets/hpd/downloads/pdfs/services/467m-requirements-faq.pdf`:**

- Prior building must be non-residential: a certificate of occupancy for non-residential use covering "not less than ninety percent of the aggregate floor area". Hotels and Class B multiple dwellings excluded.
- Must create "six or more dwelling units" and operate as rental housing.
- "At least fifty percent of the floor area of a completed Eligible Multiple Dwelling must consist of the pre-existing building."
- "Not less than 25% of the dwelling units are restricted as Affordable Housing Units."
- "The WAAMI of all Affordable Housing Units does not exceed 80% AMI", with "a minimum of 5% of the Affordable Housing Units is restricted at or below 40% AMI".
- Commence after 2022-12-31 and before 2031-06-30; complete by 2039-12-31.

**Not verified:** the benefit schedule — the exemption percentage and duration, which vary by area under RPTL 467-m. The FAQ does not carry them. Get them from the statute before the abatement affects the arithmetic; until then, model 467-m as a binary eligibility gate only and say that is what it is.

The non-residential-CO test and the 90% threshold are checkable from MapPLUTO `BldgClass` and the area columns. The 50%-of-floor-area-preserved test is not checkable from any dataset here — treat it as satisfied and say so.

---

## The back-test

The spec proposes seeding 1995 in FiDi and running to 2010 against what 421-g actually produced.

**This may not be possible from the named sources.** DOB's job filing datasets do not obviously reach back to 1995. **Check the earliest filing date in both datasets before committing to the back-test.** If they don't reach, the back-test either needs a different source or gets cut, and cutting it is fine — say in the card that the model is not validated against history, which is true of most models students will meet.

Do not build a back-test against a truncated dataset. A validation that silently starts in 2003 is worse than none.

---

## Pipeline

`data/scripts/after-five.py`. Docstring in the `bathtub.py` shape.

Outputs to `data/processed/after-five/`:

| File | Contents |
| --- | --- |
| `manifest.json` | District bounds, building count, column order, the six snapshot years, the convertibility weights, source provenance, which filing statuses were kept, which schedule source was used. |
| `buildings.bin` | `Float32Array`, row-major, per building: centroid, footprint reference, height, floors, floor area, office area, year built, convertibility score components, cost and rent constants. |
| `footprints.json` | Simplified building footprints for extrusion, keyed by BIN. Or a packed binary if the JSON is too large — measure first. |
| `trips-<year>.bin` × 6 | Baked trips per snapshot. |
| `filings.json` | The historical A1 record, for the back-test if it survives, and for the marquee buildings. |

---

## Rendering

deck.gl over MapLibre, same bootstrap as bathtub and sandbox 02.

- `PolygonLayer` extruded, from `footprints.json`, coloured by use and by conversion state.
- `TripsLayer` for the agents, `currentTime` on a 24-hour loop driven by an animation frame.
- `ScenegraphLayer` for the marquee buildings, if they get modelled.

Two clocks means two pieces of state that must not fight: `year` is a param and comes from the panel; `currentTime` is internal animation state and is not a param. **Do not put the time of day in `schema.json`** — it would be serialised into every submission and it is not a choice anyone is making. The cover screenshot needs a fixed time of day; pin it, and call `onready(true)` only once the trips for the current year have loaded and the clock has reached that time.

---

## Controls

| Property | Group | Type | Range / values | Default |
| --- | --- | --- | --- | --- |
| `year` | the clock | integer | enum of the six snapshot years | middle year |
| `conversion_cost_sf` | the deal | number | 100–600, step 25, `x-unit` `$/sf` | source-dependent |
| `residential_rent` | the deal | number | 30–150, step 5, `x-unit` `$/sf/yr` | source-dependent |
| `office_rent_trend` | the deal | number | −0.05 to 0.05, step 0.005, annual | 0 |
| `incentive_467m` | the rules | boolean | — | true, **`x-emphasis`** |
| `convertibility_threshold` | the rules | number | 0–1, step 0.05 | 0.5, **`x-emphasis`** |
| `agents` | how it's drawn | boolean | — | true |
| `colour_by` | how it's drawn | string | enum `use`, `convertibility`, `year_converted` | `use` |

Ranges are proposals; set them so the interesting behaviour is mid-slider.

**Emphasis on those two** because they are the two gates. The threshold is a number we chose standing in for a consultancy's proprietary judgement, and the incentive is a public subsidy switching on and off. Between them they decide the whole map.

---

## Metrics

- `units created`
- `office floor area removed`
- `buildings converted`
- `people on the street at 9pm` — **the headline**
- `share of trips starting or ending at a home`

The spec also lists a weekend activity index. **Cut it unless a weekend occupancy schedule is in whatever schedule source gets used.** A weekend number derived from a weekday schedule is invented precision.

"People on the street at 9pm" needs a stated definition — agents whose path places them on the network in the 21:00 hour of the looping day, counted once. Put the definition in the card.

---

## card.md

**What this is.** A piece of downtown, in 3D, running years and a single day at the same time. Office buildings become apartments as the years pass, and the crowd on the street at night changes because the buildings changed.

**Why we're looking at this one.** Office-to-residential conversion is argued in units and dollars. The thing people actually notice is whether the neighbourhood is dead after work. This sandbox puts both on screen at once so you can see one produce the other — and so you can see how thin the connection between them is in the model.

**The data.** Massing, filings across two DOB systems, MapPLUTO, the occupancy schedules with their source named, 467-m's published terms.

**How the map gets made.** The two gates, in order. Where the convertibility weights came from, which is us. How the trips are baked and why six snapshots. Why added floors are a block.

**What it assumes.** The agents follow average schedules; nobody in the model has a reason to be anywhere. Conversion is instant at the moment the deal clears. Added floors have no form. The convertibility score is our reading of published criteria, missing two of them. Rents are uniform across the district. Filings stand in for buildings.

**What it can't see.** Who moves in. Whether the ground floor gets a shop or a lobby. Anything about the people the office workers were, or the residents they are replaced by. And the thing the whole sandbox is a picture of — a street at night — is generated from a schedule, not observed.

---

## Tutorial

`src/content/tutorials/03-after-five.md`, `sequence: 3`.

Framing section: the difference between a model that simulates behaviour and a model that plays back a schedule, and why the second one is often the honest choice.

`<div class="gap">`: the sandbox ships six baked trip snapshots as site assets, several megabytes each. The tutorial version bakes one year on a smaller street graph. The baking is the same code; there is less of it.

**## Producing the data** — two DOB datasets and why. The status filter. The BIN and BBL joins. Where the schedules come from. `osmnx` and what a baked trip file contains.

**## Setting up the web environment** — the contract; two clocks and why only one of them is a parameter; site assets versus submission assets and the 15MB cap.

**## The parameters** — the two gates, with embedded mounts at threshold extremes. Then 467-m on and off at the same threshold.

**## The assumptions** — the schedule playback dressed as movement. Instant conversion. Our weights on their criteria. And the file format's assumption: six snapshots means the model has six opinions about the future and interpolates between them.

**## Challenge** — pick a district that isn't downtown Manhattan, or change the schedules: what does the street look like if the residents work nights.

---

## Build order within the sandbox

Stop and check after each.

1. Massing rendering from the DCP model, coloured by current use. No time, no agents. This proves the loader and the district choice.
2. The convertibility score and the pro-forma gate, with the year scrubber recolouring buildings. Still no agents. **This is already a complete sandbox** — if the agent layer turns out to be unaffordable, this is what ships.
3. Added floors.
4. The agent layer, once the schedule source is settled.
5. Marquee buildings and the back-test, both optional.

---

## Open questions for Adam

1. **Which community districts.** Manhattan 1 and 5 is the guess; confirm.
2. **The occupancy schedules.** If nothing citable turns up, does the agent layer ship as an explicitly unsourced illustration, or not at all?
3. **The back-test.** Cut it if DOB's data doesn't reach 1995?
4. **Marquee buildings.** Worth the modelling time, or does the district read well enough as massing alone?
