---
title: Build Doc — Sandbox 02, Does It Pencil
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
> Specific to this doc: there is no City of Yes ADU eligibility layer (confirmed
> absent); MapPLUTO's `TrnstZone` field resolves the transit-zone question with
> no extra download; the `owner_occupancy` control was removed because it
> changed nothing; and property tax is ignored outright.


# 02 — Does It Pencil

Read `2026-08-31 Build Docs — Handoff.md` first. Prose written for this sandbox is a draft: terse and explanatory, marked with the PROSE DRAFT line, rewritten later.

Slug `pencil`. Stubs already in the repo at `src/lib/sandboxes/pencil/`.

---

## What it is

Queens. Every one-to-two-family lot tested against the published terms of one real subsidy programme, and tinted by the monthly cash flow an ADU on it would produce. Not by whether an ADU is legal there — that map is a zoning map and it is boring. The question is whether the deal works, and the answer moves when you move the terms.

A time scrubber releases passing lots at a capped annual rate, so ADUs appear as volumes over years.

**The teaching claim.** A subsidy programme is a small number of published constants. Change one and the geography of who gets a unit changes. The constants are not natural facts and they are all visible here.

---

## The model

**The financial model is published, not invented.** This is what makes the sandbox honest and it is the thing to protect. Every term below comes from HPD's Plus One ADU term sheet.

### Verified 2026-08-31, from `nyc.gov/assets/hpd/downloads/pdfs/services/adu-term-sheet.pdf`

| Term | Value, quoted |
| --- | --- |
| Maximum HPD loan | "$220,000 per borrower" |
| Maximum HCR grant | "$175,000 per grantee" |
| Interest rate | "5%. Rate may be reduced." (to 0%) |
| Amortization | "180 months (15 years.)", extendable to 360 |
| Borrower income limit | "household income below 165% of Area Medium Income (AMI)" |
| Rent cap | "rented at or below 100% of the Area Median Income" |
| Rent escalation | "Rent must not be increased by more than 2% annually" |
| Owner occupancy | "resides in the home no less than 270 days per year" |
| The test | "Monthly loan payments will be set so that the household has at least $200 monthly cash flow available after household debt obligations are subtracted" |

**Read the last row carefully, because the sandbox bends it.** In the programme, the $200 cushion is a *household* test and it sizes the loan: HPD lends whatever leaves the borrower with $200. In the sandbox it is recast as a per-lot *build / don't build* test on the ADU's own cash flow, because the sandbox has no household data and cannot have any.

That substitution is a modelling choice of exactly the kind this course is about. It must appear in `card.md` under "What it assumes" and in the tutorial under `## The assumptions`, stated plainly. Do not paper over it.

### The pro-forma, per lot

Stated as steps. Parameter names in **bold** are exposed controls; everything else is precomputed or constant.

1. **Floor area** `A` — from the sizing step below, capped at 800 sf.
2. **Development cost** `C = A × cost_per_sf + soft_cost`. `cost_per_sf` is a control. `soft_cost` is a flat constant; name its source or name it an assumption.
3. **Grant** `S = min(grant_max, C)` where `grant_max` is a control defaulting to the published $175,000.
4. **Equity** `E = equity_share × C`, a control. Guard `E = 0` before dividing by it.
5. **Financed** `F = max(0, C − S − E)`, then capped at the $220,000 loan maximum. A lot whose remaining cost exceeds the loan cap does not pencil, and the reason is worth reporting separately from failing the cushion.
6. **Debt service** `D = F × r / (1 − (1 + r)^(−n))` where `r = interest_rate / 12` and `n = term_months`. Both controls. At `r = 0`, `D = F / n` — handle it, the rate slider reaches zero because the programme does.
7. **Gross rent** `R` — from the rent basis control, per tract. Either the 100% AMI cap implied by the programme, or HUD Fair Market Rent, or a flat dollar amount.
8. **Effective rent** `R_eff = R × (1 − vacancy)`.
9. **Operating cost** `O = opex_share × R_eff`. Constant unless a source is found; if it stays an assumption, say so in the description text.
10. **Incremental tax** `T` — an assumption. MapPLUTO carries `AssessTot`, but the marginal assessment of an added ADU is not in any dataset. Either model it as a flat monthly figure and label it an assumption, or drop it and say the model ignores property tax. Do not derive a number that looks sourced and is not.
11. **Monthly margin** `M = R_eff − O − T − D`.
12. **Pencils** if `M ≥ cushion`, default $200.
13. **Return on equity** `ROE = 12 × M / E`.

### Time

Rank passing lots by `ROE` descending. Release the top `permits_per_year` each year from a start year. A lot's release year is its rank divided by the annual capacity. The scrubber reveals lots released at or before the selected year.

State the claim this makes: **the binding constraint is permitting throughput, not demand.** Nothing in the model represents a homeowner deciding.

---

## Eligibility

### Verified 2026-08-31, from DCP's *City of Yes for Housing Opportunity* ADU guide

`nyc.gov/assets/planning/downloads/pdf/our-work/plans/citywide/city-of-yes-housing-opportunity/housing-opportunity-guide-adus.pdf`

- On the same lot as a 1- or 2-family home.
- 800 square feet or less.
- Basement and detached ADUs are not allowed in an expanded flood area — the 2050 and 2080 floodplains.
- Detached ADUs are not allowed in historic districts, or in R1-2A, R2A and R3A outside the greater transit zone.
- The homeowner must live at the property.
- Legalizing an existing unit is a different rule set. **Out of scope — say so.**

### Not verified — check before writing code that depends on it

- **A DCP "City of Yes ADU eligibility layer" may not exist as a published GIS dataset.** The spec names one. Search NYC Open Data and the DCP data portal. If it exists, use it and record its ID. If it does not, derive eligibility from MapPLUTO plus the flood layer, and record in the script docstring that the eligibility flags are **ours, derived from the published rules**, not a city product. That distinction matters and the card must carry it.
- **The expanded flood area (2050 / 2080 floodplains)** is a specific published layer and it is *not* MapPLUTO's `PFIRM15_FL`, which flags the 2015 preliminary FIRM. Find the real one or drop the flood exclusion and say it is dropped.
- **Rear-yard and height limits** — a secondary source gives "no more than 33% of the required rear yard" and 15 feet for detached units. Verify against the adopted zoning text before using either number.
- **The greater transit zone** boundary is a published layer. Find it or treat the R1-2A/R2A/R3A exclusion as unmodelled and say so.

---

## Data

### Already on disk

`data/original/nyc_mappluto_26v2_shp/MapPLUTO.dbf` — MapPLUTO 26v2, 856,687 records, 101 fields. Only the DBF is read; the 141MB `.shp` is never opened. **Reuse `bathtub.py`'s fixed-width DBF reader.**

**Field names below are verified — read directly from the DBF header on 2026-08-31.**

| Field | Type | Use |
| --- | --- | --- |
| `BBL` | F | Join key. **Stored as a DBF float field. Read it as an integer or a string — a float64 BBL loses the lot digits.** |
| `BoroCode` | N | Filter to 4 (Queens). |
| `Borough` `Block` `Lot` | C N N | Fallback BBL construction. |
| `BldgClass` | C | One- and two-family filter. Verify whether A* / B* is the right test against the PLUTO data dictionary, which is in the folder as `pluto_datadictionary.pdf`. |
| `LandUse` | C | Cross-check on the same filter (01 and 02). |
| `UnitsRes` `UnitsTotal` `NumBldgs` | N | Confirm the 1–2 family test and catch lots with several buildings. |
| `LotArea` `BldgArea` `ResArea` | N | Sizing and the rear-yard estimate. |
| `LotFront` `LotDepth` `BldgFront` `BldgDepth` | F | Rear-yard geometry proxy. |
| `NumFloors` `BuiltFAR` `ResidFAR` | F | Zoning capacity check. |
| `ZoneDist1` `Overlay1` `SPDist1` | C | R1-2A / R2A / R3A exclusion. |
| `HistDist` | C | Historic district exclusion. Non-empty means in one. |
| `YearBuilt` | N | Context only. |
| `OwnerType` | C | Screening out city-owned lots. |
| `BCT2020` | C | Census tract join for income and rent. |
| `Latitude` `Longitude` | F | Centroids for rendering. Prefer these over `XCoord`/`YCoord`, which are State Plane feet. |
| `AssessTot` | F | Only if property tax is modelled. |

### To be sourced

| Source | Needed for | Status |
| --- | --- | --- |
| HUD Income Limits (AMI) | The 100% AMI rent cap and the 165% borrower limit. Metro-area figures, by household size. | Publisher verified as HUD; no URL checked. Record the vintage year in the manifest. |
| HUD Fair Market Rents | The alternative rent basis. | Same. |
| ACS tract income and tenure | The "median tract income of lots receiving units" metric, and an owner-occupancy screen. | Table numbers unverified. Tract geometry is already on disk (`2020_Census_Tracts_20260830.geojson`, NYC Open Data `63ge-mke6`). |
| HPD "ADU for You" cost figures | The default `cost_per_sf`. | Existence unverified. If it can't be found, make the default an explicit assumption in the schema description and say where the number came from. |

**Total every join before believing it.** Count Queens 1–2 family lots against a published figure. The bathtub `UnitsRes` bug — a lot-level figure joined per building — is the same shape as the bug waiting here, since a lot can carry several buildings.

---

## Pipeline

`data/scripts/pencil.py`. Docstring follows `bathtub.py`: what the model is, what the script is for, inputs with fields taken and units, outputs, usage.

Steps:

1. Read MapPLUTO DBF, filter to Queens 1–2 family.
2. Attach tract via `BCT2020`; attach AMI-derived rent and FMR per tract.
3. Compute eligibility flags.
4. Size the ADU. **This is the weakest step in the pipeline and the docstring should say so.** There is no rear-yard geometry in the DBF; `LotArea − (BldgFront × BldgDepth)` is a crude proxy for available rear yard, and lot shape is unknown. Cap at 800 sf. State the approximation in the card.
5. Write the outputs.

### What the pipeline ships, and why

**Precompute the inputs to the pro-forma, never its answers.** Every control in this sandbox changes the arithmetic, not the data, so shipping a precomputed result per parameter combination is impossible — the parameter space is continuous and six-dimensional. Ship the per-lot constants and recompute all of them on every slider move in one typed-array pass. This is the same reasoning as bathtub's `spill.png` reaching the opposite conclusion for a different reason, and it is worth a paragraph in the tutorial's `## The assumptions`.

`data/processed/pencil/`:

| File | Contents |
| --- | --- |
| `manifest.json` | Lot count, column order and units, bounds, tract table reference, source provenance with vintages, the constants that are not controls (soft cost, opex share, tax assumption) with their justification. |
| `lots.bin` | `Float32Array`, row-major, K floats per lot, K fixed by `manifest.columns`. Proposed columns: `lon`, `lat`, `adu_sf`, `lot_area`, `rent_ami`, `rent_fmr`, `tract_income`, `assess_tot`. |
| `flags.bin` | `Uint8Array`, one byte per lot, bitfield: eligible-attached, eligible-detached, in-flood-area, in-historic-district, excluded-district, owner-occupied-proxy. |
| `tracts.json` | Tract geometry simplified, with median income, for the income metric and optional tract-level shading. |

Target ~180k lots × 8 float32 ≈ 6MB, plus flags. Well inside the site's budget. If Queens alone comes in far under, note it — a citywide version may be affordable and Adam should get to choose.

---

## Rendering

deck.gl over MapLibre. Reuse the two fixes in `Bathtub.svelte`: hand MapLibre a Vite-emitted worker, and never await the `load` event. Read the comments there rather than re-deriving them.

**Layers**

- **Lots.** A `ColumnLayer` of square columns at lot centroids, footprint sized from `lot_area`. Colour by the selected tint. Height zero until the lot's release year, then the ADU volume.
- **ADU volumes.** The same layer's elevation, driven by the scrubber. A lot released in or before the selected year stands; others lie flat.
- **Optional glTF swap.** A `ScenegraphLayer` with one instanced generic ADU below a zoom threshold. Adam has a 400sf ADU in his modelling queue. Build the column layer first and treat this as a later addition.

**A simplification to declare.** Lots are drawn as squares of their own area at their centroid, not in their real shape, because 180k lot polygons is not a 6MB download. Put this in `card.md` under "What it assumes". It is a small honest note and it costs nothing.

**Context massing** from the DCP 3D Building Model is an open question, not a requirement — see below.

**Where the arithmetic runs.** One function over the typed arrays, called on every parameter change, producing both the colour array and the metrics. Same pass, same numbers. Do not compute the metrics separately.

At 180k lots this is a few milliseconds per pass; if it stutters, batch it into a `requestAnimationFrame` and call `onready(false)` / `onready(true)` around it rather than debouncing the sliders.

---

## Controls

Panel order is the reading order: pick the subsidy, then the market, then the rules, then the clock, then the drawing. `x-group` labels in lowercase.

| Property | Group | Type | Range / values | Default |
| --- | --- | --- | --- | --- |
| `grant_max` | the subsidy | number | 0–250000, step 5000, `x-unit` `$` | 175000 |
| `equity_share` | the subsidy | number | 0–0.5, step 0.05 | 0 |
| `interest_rate` | the subsidy | number | 0–0.10, step 0.005 | 0.05 |
| `term_months` | the subsidy | integer | enum 180, 360 — labels "15 years", "30 years" | 180 |
| `cost_per_sf` | the market | number | 200–800, step 25, `x-unit` `$/sf` | source-dependent |
| `rent_basis` | the market | string | enum `ami_cap`, `fmr`, `flat` | `ami_cap`, **`x-emphasis`** |
| `rent_flat` | the market | number | 500–5000, step 50, `x-unit` `$/mo`, `x-disabled-when` `rent_basis` ≠ `flat` | 2000 |
| `vacancy` | the market | number | 0–0.15, step 0.01 | 0.05 |
| `eligibility` | the rules | string | enum `coy`, `all` — "City of Yes rules" / "ignore eligibility" | `coy` |
| `owner_occupancy` | the rules | boolean | — | true |
| `cushion` | the rules | number | 0–1000, step 25, `x-unit` `$/mo` | 200 |
| `permits_per_year` | the rules | integer | 100–10000, step 100 | 1000, **`x-emphasis`** |
| `year` | the clock | integer | 2027–2050, step 1 | 2035 |
| `tint` | how it's drawn | string | enum `margin`, `roe`, `release_year`, `eligibility` | `margin` |
| `volumes` | how it's drawn | boolean | — | true |

Ranges and defaults are proposals. Adjust them once the data is real, and adjust them so that the interesting behaviour is in the middle of the slider, not at one end.

**Emphasis, and why those two.** `rent_basis` because the rent cap is what the programme trades for the subsidy, and switching it to market rent shows what the affordability requirement costs. `permits_per_year` because it is the only control that changes *when* rather than *whether*, and it is the one the model claims is binding.

**`eligibility: all` is the boring-map control, inverted.** Setting it to `all` prices an ADU on every 1–2 family lot in Queens regardless of legality, so the difference between the two settings is exactly what the zoning rule costs. Say that in its description.

Every `description` field is teaching text at the length of bathtub's. Say what the control is, what it does to the model, and what the world does that the model doesn't.

---

## Metrics

Six, plain-language labels in `meta.js` style:

- `lots that pencil` — count and share of the eligible set
- `units built by this year` — cumulative
- `units this year`
- `margin at the median passing lot` — dollars per month
- `median tract income where units land`
- `share of units in the top tenth of tracts` — the concentration measure

The concentration metric needs a stated definition: tracts ranked by unit count, the share of all units falling in the top decile of tracts. Put the definition in the card, not just the number in the panel.

---

## card.md

Six sections. Notes on what each must contain.

**What this is.** Plain language. Everyone has seen a map of where something is allowed. This is a map of where it pays. One real programme, its published numbers, and the same arithmetic a homeowner's contractor would do, run on every lot in Queens at once.

**Why we're looking at this one.** A housing programme is a handful of constants in a term sheet. They are chosen, they are public, and almost nobody reads them. When they move, the map of who gets a unit moves — and it moves toward or away from particular neighbourhoods, which is a distributional outcome produced by a spreadsheet.

**The data.** MapPLUTO and what is taken from it. The term sheet with its figures. AMI and FMR with their vintages. Tract income. Whether the eligibility flags are the city's or ours.

**How the map gets made.** The pro-forma in order, in words. Why the parameters recompute rather than look up. Why release is a ranking and a rate.

**What it assumes.** The $200 household test recast as a per-lot test. ADU size from a rear-yard proxy with no real lot geometry. Lots drawn as squares. Property tax assumed or ignored. Operating cost as a share of rent. Rent uniform within a tract. Everyone builds the moment the deal clears, and permitting is the only queue.

**What it can't see.** Whether a homeowner can raise the equity, wants a tenant, or trusts the city. Lots that pass are not lots that build. There is no contractor, no financing rejection, no family, and no one who simply doesn't want to.

---

## Tutorial

`src/content/tutorials/02-pencil.md`, `sequence: 2`.

Opening paragraphs: what the module covers, what you can do afterward. Then an optional framing section — a good one here is on the difference between an eligibility map and a feasibility map, and why the first one gets published.

`<div class="gap">`: the tutorial version runs on one community district rather than the whole borough, and skips the instanced glTF layer. The arithmetic is identical, there is just less of it, and the model is the arithmetic.

**## Producing the data** — reading a 101-field DBF without a geo stack. What eight columns actually matter. The tract join and how to total it against a published figure. Where the eligibility flags come from and whether they are the city's. The rear-yard proxy, named as a proxy.

**## Setting up the web environment** — the sandbox contract, briefly; the panel drawn from the schema; why the arithmetic runs in the browser instead of shipping answers.

**## The parameters** — the term sheet, control by control, with an embedded `data-sandbox="pencil"` mount showing the eligibility-vs-margin comparison. Then the rent basis switch: what the affordability requirement costs and who pays it.

**## The assumptions** — the recast cushion test. Ranking as a stand-in for a decision. A tract-uniform rent. And the largest one: that a subsidy programme's reach is a function of its terms rather than of who hears about it.

**## Challenge** — point it at another borough, or at a different subsidy: change the grant to a tax abatement, or the loan to a forgivable one, and argue about what moves.

---

## Open questions for Adam

1. **Queens only, or citywide?** The payload suggests citywide is affordable. Queens is what the spec says.
2. **Context massing.** Should existing houses be drawn from the DCP 3D Building Model, or is the lot-column abstraction enough? Massing makes the ADU volumes legible and costs a large site asset.
3. **Property tax** — model it as an assumption, or state that the model ignores it?
4. **The eligibility layer.** If DCP publishes no ADU layer, is deriving our own from the published rules acceptable, with the derivation stated?
