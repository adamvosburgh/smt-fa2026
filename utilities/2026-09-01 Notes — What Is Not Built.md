---
title: Notes — what is not built
date: 2026-09-01
type: content
---

# What is not built

Written at the end of the 2026-09-01 pass, which closed stages 1–5 of
`Fixing The Three Sandboxes`. Everything below is either shipped-but-compromised
or not shipped at all. It is a register, not a plan: each item says what the
limitation actually is, what it costs the sandbox, and what would close it.

The standing rule still governs, and item 1 is the reason this file exists:
**a sandbox that cannot complete a step is not thereby making a point about the
limits of models.** Naming a gap is not the same as filling it, and none of the
entries below should be read as a decision that the gap is fine.

Figures were read from the shipped payloads on 2026-09-01, not recalled.

---

## 1. After Five has no agent layer, and this is the one that is not acceptable

**Status: still not built, after the pass that was supposed to build it.**

`2026-08-31 Build Doc — 03b After Five, The Agent Layer.md` set out five options
and recommended **B now, A later, C as the check on both**. What shipped is
weaker than B.

### What shipped

A presence *comparison*, in a panel over the map: the two populations that the
district actually holds, and what conversion does to each.

| | office-using jobs | residents (2020) |
| --- | --- | --- |
| MN01, Lower Manhattan | 198,677 | 85,841 |
| MN05, Midtown South | 667,498 | 92,438 |

Jobs are LEHD LODES 8 WAC 2023, joined on MapPLUTO `BCTCB2020` — an ID join, not
a spatial one. Residents are the 2020 decennial count by tract. Manhattan's
tracts sum to 1,694,251, which is the published New York County population
exactly; that check is what made the join believable, and it caught an earlier
`UnitsRes` × 2.01 estimate that overstated CD1 by 19%.

At a 25% asking-to-effective discount, MN01 trades roughly 5,450 office jobs for
roughly 4,600 residents. MN05 trades 34,000 for 19,000.

### What did not ship, and why the reason given is only half right

There is no curve and no movement. The stated reason — on the card, in
`meta.js`, in the tutorial and on the face of the sandbox — is that no published
table says when a Manhattan office empties: NHTS Table 8-1 is national and six
bands wide (28% of trips begin somewhere between 6pm and midnight), and ACS
B08302's universe is departures *to* work, so it describes the morning.

That is true, and it is a fair account of the **trip** tables. It is not a fair
account of option B, and this is the honest failure of the pass:

> **Option B's time source was ATUS — the American Time Use Survey — which
> publishes the share of the population engaged in activities by time of day,
> including "at home". ATUS was never fetched, never read, and is referenced
> nowhere in `src/` or `data/scripts/`. It appears in exactly one file on disk:
> the build doc that recommended it.**

ATUS is a presence source, not a trip source. The two tables that were evaluated
and rejected are both about *movement*, which is option A's problem, not option
B's. So the recommendation was not tested — a different question was answered
instead, and the sandbox now carries a well-written paragraph about an absence
that the recommended source may well have filled in half a session.

**This is the first thing to do next.** The work is: fetch ATUS, establish
whether its activity-by-time-of-day tables can be cut to something defensible
for a workplace district, and if they can, build the 24-hour curve option B
describes. If they cannot, the paragraph on the sandbox becomes true as written
and should say ATUS was checked and why it failed.

### What remains true regardless

Option A — trips on a street network — still carries the objection the build doc
raised and this pass confirmed: **which building a trip starts at is an
assumption doing as much work as the schedule is.** Any animation is more
specific than its inputs. If A is ever built, that sentence goes on the canvas
before the code is written, and the payload question (12–24MB of baked snapshots,
roughly doubling the site's data footprint) is still open and still Adam's.

---

## 2. After Five converts nothing at its own defaults

At the sourced office rent, the model converts **0 of 381** office buildings in
MN01 in every year to 2045, and three in 2050.

This is a real result and it is now the sandbox's headline: the office rent was
in the model twice at two different unsourced values (38 in `gates.js`, 62 in the
manifest), and the code was applying a 39% haircut to the larger one in a
comment. Replacing both with the Comptroller's published $54 empties the map.
The legend says so in words, so an empty map reads as an answer rather than a
failed load.

What it takes to make anything convert:

| change | converting, MN01 at 2035 |
| --- | --- |
| the published figures | 0 of 381 |
| 25% asking-to-effective discount | 67 |
| 40% discount, cost $200, res rent $110 | 142 |
| office rents fall 3%/yr | 18 |

Every row is a number nobody published.

**The limitation is that this is a judgement, not a finding.** Shipping an empty
default map is a choice about what the sandbox is for. It can be overruled by
changing one default — `office_rent_discount` — but doing so means adopting one
of those unpublished numbers as the house position. Flagged for Adam; not
decided here.

---

## 3. After Five: constants that are conventions, not measurements

- **The office rent is 28 months stale and cannot be refreshed from its own
  source.** $54/sf/yr asking, Manhattan class B and C combined, CoStar as of
  30 April 2024, in the Comptroller's *Spotlight* of 14 May 2024. Pinned to that
  edition deliberately: the November 2025 successor drops rent by class, so
  there is no later figure of the same shape. B and C are combined at source and
  the sandbox must not pretend to separate them.
- **Asking is not effective, and no effective series was found.** Hence the
  control, defaulting to zero.
- **`cap_rate` (0.055) and `opex_share` (0.35) are market conventions.** No
  published NYC office cap-rate series was verified. Worse, the same cap rate is
  applied to the office income and the residential income, so it scales both
  sides of the comparison and very nearly cancels. Office and residential do not
  trade at the same yield, and the gap between them is a large part of why
  anyone converts anything. **This is a known defect in the arithmetic, not just
  an unsourced input.**
- **Floor area per apartment is measured but fragile.** 1,152 sf, from 149 DOB
  filings 2001–2025 (15,561,117 sf / 13,506 units) where a Manhattan building
  with no apartments became a residential one of ten units or more. The ten-unit
  floor moves the answer by 40% — 1,366 sf at a one-unit floor, 907 at fifty —
  because `proposed_zoning_sqft` is the whole building's area, not the converted
  part. The whole ladder is in the manifest; the chosen rung is a judgement.
- **Displaced jobs are a subtraction, not a relocation.** The model removes them
  from the district and does not ask where they go.

## 4. After Five: the convertibility score is ours

Three of Gensler's published criteria are dropped outright because nothing
available measures them — **structural bay is now named as the third**, having
previously been carried silently inside the age proxy. Four criteria remain, each
with a proxy that is weaker than the criterion: `BldgDepth` halved assumes a
centred core and a rectangular plate; height over storeys averages the lobby and
the mechanical floors in with the rest.

Gensler's algorithm and weights are closed. The only checkable thing they
published is that about a quarter of the 1,300+ buildings they scored came out
suitable, so the legend marks where our threshold would have to sit to agree:
**0.767 in MN01, 0.715 in MN05.** It moves when the weights move. That mark is
the only place our judgement and theirs can be held beside each other, and it is
a calibration, not a validation.

## 5. After Five: `buildings.bin` was migrated, not regenerated

Exposing the four weights as controls meant shipping the four sub-scores as
columns — `STRIDE` 15 → 18. The CityGML source was not on disk at the time, so
the four sub-scores were derived from the stored composite by exact
rearrangement rather than by re-running the pipeline, with three checks:
recomposition error 5.96e-08, every sub-score inside [0,1], and 94.7% of implied
`BldgDepth` landing on whole feet, which is how MapPLUTO records it.

`after-five.py` was updated so a full re-run reproduces the same 18-column file,
and `manifest.regenerated_note` records that this is what happened. **But the two
migration scripts live in a scratchpad, not in the repo**, so the current
artefacts cannot be reproduced from the repo alone without the 13GB source.

**The source is now back on disk.** Re-running `after-five.py` end to end and
diffing against the shipped payload would close this item entirely, and is worth
doing before the December freeze.

---

## 6. Does It Pencil — carried forward

- **The DEP Interim Flood Risk Area Map is the layer ZR 12-10 actually points
  at, and it is not on disk.** Adoption of 15 RCNY 66-01 was not confirmed and
  no download format is known. The two flood flags are built from the NPCC
  layers instead and are labelled as our approximation of an adopted map we could
  not obtain.
- **Whether an ADU must sit inside the required rear yard is unresolved.** On a
  deep lot the space between the house and the required yard is governed by lot
  coverage and FAR, not by ZR 23-341. If an ADU may sit there, the one-third rule
  is not the binding cap and the Queens result is less harsh than the sandbox
  says. HPD's guidebook and eligibility tool both present the one-third rule as
  *the* cap, so modelling it that way is defensible — but the harsh number is
  being published on an unchecked reading.
- **Whether DEP's "moderate" 2.13 in/hr is the 10-year storm is not verified**
  and must not be asserted without the Stormwater Resiliency Plan. The stormwater
  geodatabases are published as intensities, not return periods, and are context
  only — they must not be substituted for the adopted map.
- The two legibility gaps from `2026-09-01 Notes — 02 Does It Pencil, What Is
  Still Wrong.md` are unchanged by this pass.

## 7. Bathtub — one dated dependency

The NOAA station 8518750 annual-exceedance-probability product **retires
30 September 2026**, replaced by the integrated *Sea Level Trends and Extremes*
site. The citation must be re-pointed before the December freeze or the sandbox
will cite a dead product.

## 8. Cross-cutting: the prose has not been checked against the style guide

`CLAUDE.md` requires reading `utilities/writing-style-guide.md` in the Obsidian
vault before drafting course prose. **That file is not in the repo and was not
available in any session of this build.** All card, tutorial, `meta.js` and
schema-description prose written on 2026-08-31 and 2026-09-01 was drafted by
matching the voice of existing cards and manifests instead. `meta.js` still
carries its `PROSE DRAFT: written for accuracy, not voice` header. This needs a
voice pass against the actual guide.

---

## What is worth doing next, in order

1. **Fetch ATUS and test option B properly.** It is the recommended path, it was
   never tried, and it is the difference between a sandbox that answers its own
   question and one that explains why it can't. Half a session if the tables
   cooperate.
2. **Re-run `after-five.py` end to end** now the CityGML is back, and diff
   against the shipped payload. Closes item 5 outright.
3. **Decide the office-rent default** (item 2). One line, but it is a position,
   not a fix.
4. **Split the cap rate** so office and residential do not share one yield
   (item 3). This is a genuine arithmetic defect and it is cheap to correct once
   a second rate can be sourced — or it becomes a second control, labelled as a
   convention.
5. **Re-point the NOAA citation** before 30 September 2026 (item 7).
6. **The voice pass** against the real style guide (item 8).
