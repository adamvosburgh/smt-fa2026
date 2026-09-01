---
title: Build Doc — fixing the three sandboxes
date: 2026-09-01
type: content
---

# Fixing the three sandboxes

**Read `2026-08-31 Build Notes — What The Build Changed.md` first.** This document
answers its closing section, *Things that are shaky and will need work*, item by
item. Where the two disagree, this one is later.

Everything marked **verified 2026-09-01** was read from the source on that date,
by fetching the page or running the numbers, not by recalling it. Everything else
is marked as unverified and must be checked before code depends on it.

The standing rule from the last build applies again and it is the reason this
document exists: **a sandbox that cannot complete a step is not thereby making a
point about the limits of models.** Each of these is a small simulation that takes
published data, applies a published method, and shows the result. If a step can't
be sourced, the fix is to find the source or change the step, not to write a
paragraph about why the gap is interesting.

---

## The decisions

| # | Was | Now |
| --- | --- | --- |
| 1 | After Five has no agent layer | **Option A.** Trips on a street network from a travel survey. 12-24MB of baked snapshots accepted. |
| 2 | The two gates are correlated by construction | Accepted and documented. But every metric feeding either gate gets a source or gets cut. |
| 3 | Economic constants are all assumptions | Sourced. Gensler's 25% becomes a calibration target, not a formula. Office rent from the Comptroller. |
| 4 | ADU sizing barely does anything | Rebuilt on ZR 23-341 and 23-342. Median cap falls from 707sf to **250sf** and the 800sf cap never binds. |
| 5 | Construction cost default is invented | HPD's budgeting tool reverse-engineered. Pre-Approved Plan Library gives 11 real cost ranges. |
| 6 | Floodplains are projection horizons, not return periods | Annual exceedance probability becomes its own control, in Pencil **and** Bathtub. |
| 7 | Sandboxes are too small and the panel is a wall | New three-column frame. Reading left, map centre, controls right. |

---

## 1. After Five: the agent layer

**Option A, from `03b`.** Trips on a street network, animated with `TripsLayer`.
Adam has accepted the payload, so the constraint that killed it is gone.

Sources:

- **Population, workers.** LEHD LODES `ny_wac_S000_JT00_2023.csv.gz`, jobs by census
  block. Already confirmed downloadable in the last build, not yet fetched.
- **Population, residents.** `units_created` from `buildings.bin` times
  `manifest.household_size` = 2.01 (ACS 5-year 2023 B25010). Already built.
- **Time.** NHTS 2022 departure-time distributions, or the Census Transportation
  Planning Products. **Unverified.** Run one of them down to a specific published
  table before writing the pipeline. This is the source whose absence stopped the
  layer last time; do not start the bake until a table is in hand.
- **Network.** NYC LION or CSCL street centrelines, or `osmnx`. The `.3dm`
  `Roadbed` layer is polygons of paved area and is not a shortcut.

Six baked snapshots, 2-4MB each, in `data/processed/after-five/`. Site assets, not
submission assets, so outside the 15MB cap.

**Write this sentence before the code, and put it on the face of the sandbox.** The
travel survey gives departure times for a metro population, not for these
buildings. Which building a trip starts at is an assumption, and it is doing as
much work as the schedule is. The animation will look far more specific than its
inputs. That admission is the price of the animation.

**Also build option B's presence curve**, beside the map, from the same population
numbers. It costs almost nothing once LODES is in, it is the metric the sandbox's
headline claim actually needs (`people on the street at 9pm`), and having a counted
number next to an animated crowd is the most useful thing on the page.

---

## 2. After Five: the two gates

The correlation between `convertibility_threshold` and `conversion_cost_sf` is
kept. An awkward building is genuinely more expensive per foot, and decoupling
them to make two sliders independent would be inventing an independence that
isn't there. It stays documented in the card.

What changes is the input side. **Only metrics with a source go into the score.**
Rebuild the convertibility score as:

| Criterion | Proxy | Source | Keep? |
| --- | --- | --- | --- |
| Floorplate depth | `BldgDepth` halved as core-to-window | MapPLUTO | Keep. Say it assumes a centred core and a rectangular plate. |
| Floor-to-floor | CityGML height / `NumFloors` | CityGML `tnru-abg2`, MapPLUTO | Keep. Averages over mechanical floors and lobbies. |
| Floorplate area | `BldgArea` / `NumFloors`, apportioned across buildings on the lot | MapPLUTO | Keep. Watch the lot-vs-building trap from the last build. |
| Age | `YearBuilt` | MapPLUTO | Keep, but it stands in for one thing, not two. Do not let it carry "structural bay" as well. |
| Window operability | none | - | **Cut.** Not derivable. Say it is missing. |
| Elevator count | none | - | **Cut.** Do not infer a count from floor area. |
| Structural bay | none | - | **Cut.** Previously smuggled in under `YearBuilt`. |

Four criteria, four sources, three named absences. The weights are still ours. Put
them in `manifest.json` and in the card, and make them controls (see item 3).

---

## 3. After Five: the economic constants

### Gensler

We never had Gensler's metric and it is not published. **Verified 2026-09-01**
from `gensler.com/blog/what-we-learned-assessing-office-to-residential-conversions`:
the criteria are named in prose ("context, building form, location, floor plate
size, and several other factors"), the algorithm and weights are proprietary, and
one project is quoted at "a conversion score of 81%", which implies a 0-100 scale.

But the same page publishes the number that matters:

> "only 25% of the buildings scored make for suitable candidates for conversion"

across more than 1,300 buildings in 130-plus cities.

**So: our weights, published, calibrated against their share.** Expose the four
weights as controls. On the `convertibility_threshold` slider, mark the threshold
at which the district's pass rate is 25%. The card says, in one sentence, that the
weights are ours, that Gensler's algorithm is closed, and that the only thing we
can check ourselves against is the one share they published.

That converts an invented constant into a stated method with a published check.
It is also a better teaching object than a borrowed formula would have been.

### Office rent

`office_rent_base` = 38 $/sf/yr effective, unsourced, is replaced.

Source: **NYC Comptroller, *Spotlight: New York City's Office Market***
(`comptroller.nyc.gov/reports/spotlight-new-york-citys-office-market/`), which
publishes Manhattan asking rents by building class from CoStar. **Partially
verified 2026-09-01** - the report exists and carries class-level asking rents;
fetch the current edition and take the figures verbatim, with the vintage in the
manifest.

Two things the pipeline must get right:

- **Take the Class B and C figure, not the 5-star one.** Nobody converts a trophy
  tower. The conversion stock is the older, deeper-plate, worse-rented half of the
  market, and using an all-class average makes conversion look worse than it is.
- **Asking rent is not effective rent.** Free months and improvement allowances sit
  between them. Either find a published effective-rent series or expose the
  discount as a control with a default and a note. Do not silently apply a haircut.

### The rest

| Constant | Was | Now |
| --- | --- | --- |
| `cap_rate` 0.055 | unsourced | Expose as a control. If no published NYC office cap rate can be found, say in the card that it is a market convention and not a measurement. |
| `opex_share` 0.35 | unsourced | Use the operating figures recovered from HPD's budgeting tool (item 5) where they apply, and say where they don't. |
| `sf_per_unit` 900 | unsourced | Derive from the DOB certificate record already on disk: floor area divided by `proposed_dwelling_units` on completed A1 conversions. That is a measured figure from data we already have. |

`sf_per_unit` is the easy win here and it should not have been a constant.

---

## 4. Pencil: ADU sizing

The old rule, `min(0.33 × (LotArea − footprint), 800)`, is wrong in a specific way:
it applies the one-third fraction to *the whole open area of the lot*. The rule
applies it to *the required rear yard*, which is a much smaller and district-
dependent thing. That is why 109,032 lots hit the 800sf cap and the median came
out at 707sf.

### The rule, verified

**ZR 23-341(b)(4), "Permitted obstructions in required rear yards or rear yard
equivalents"** - verified 2026-09-01 from `zoningresolution.planning.nyc.gov`:

- "the size shall be limited to an area not exceeding one-third of the *rear yard*
  or *rear yard equivalent*"
- "where such *building* is free-standing from other existing *buildings* on the
  *zoning lot*, it shall not be closer than five feet to a *rear lot line* or
  *side lot line*"
- "for any *ancillary dwelling unit* associated with a *detached*, *zero lot line*
  or *semi-detached* *building*, the height, at any level, shall be limited to one
  *story*, not to exceed 15 feet"
- with accessory parking below, "shall not exceed two *stories* or 25 feet in
  height above adjoining grade, whichever is less, including the apex of a pitched
  roof"

**Note the building types.** The section names detached, zero lot line and
semi-detached. **Attached buildings are not in it.** So the last build's
"detached only" choice was wrong in both directions: it excluded semi-detached,
which the rule allows, and it never had to reason about attached, which the rule
excludes.

**ZR 23-342, required rear yard depth** - verified 2026-09-01, same source:

- Detached and zero lot line: **20 feet** (30 above 75 feet of height).
- Semi-detached and attached, lot width **under 40 feet**: **30 feet**.
- Semi-detached and attached, lot width **40 feet or more**: 20 feet.
- Shallow interior lots (under 95 feet deep, existing since 1961-12-15): reduce the
  required depth by six inches per foot of deficiency, **floor of 10 feet**.

The narrow semi-detached case getting a *deeper* required rear yard is not a
mistake in the reading. It means the one-third allowance is larger on exactly the
narrow lots you would expect to be worst off, and there is a cliff at 40 feet of
lot width where it drops back.

HPD's guidebook (p.22-25) gives a flat "20 feet" for everything. That is the
detached case only. **Use the ZR, cite the guidebook for the plain-language
framing.** The guidebook's worked example - a 500sf ADU needs a 1,500sf rear yard -
is correct and worth quoting in the card because it is the rule stated in the way
a homeowner meets it.

### The numbers, run

Run against MapPLUTO 26v2 on 2026-09-01. Queens, `BldgClass` A or B, `UnitsRes`
1 or 2, usable dimensions: **246,805 lots.**

Building type is a proxy, and must be named as one: `LotFront − BldgFront`, the
gap between lot width and building width. Under 2 feet is attached, 2 to 10 is
semi-detached, 10 or more is detached. MapPLUTO carries no building-type field.

```
attached  49,545  |  semi-detached  72,398  |  detached  124,862
lot width   median 30ft   p25 22   p75 40
lot depth   median 100ft
one-third cap   median 250 sf   p75 267   p90 333

eligible building type (not attached)   197,260   79.9%
...and 10ft of buildable width           182,915   74.1%
...and cap >= 280sf                       44,677   18.1%
...and cap >= 400sf                       11,652    4.7%
...and cap >= 600sf                        1,564    0.6%

the shallow-lot reduction bites on 34,394 lots (14%)
```

**The median Queens lot allows a 250 square foot ADU.** The 800sf statutory cap is
never the binding constraint; the one-third rule and the five-foot setbacks are.
Fewer than one lot in five can hold the smallest design in the City's own
pre-approved library.

What the two corrections are each worth, at the 280sf threshold:

```
detached only, ZR depths        34,414
detached + semi, ZR depths      44,677   (+10,263 from including semi-detached)
detached + semi, flat 20ft      34,865   (+9,812 from using the ZR's 30ft depth)
```

Both corrections matter and they are about the same size. Neither is a rounding
detail.

### Brooklyn was checked

```
BROOKLYN 1-2 family, usable dims: 155,967
attached 76,697 | semi 51,460 | detached 27,810
lot width median 20ft
one-third cap median 200 sf
eligible building type      79,270   50.8%
...and 10ft buildable width  61,175   39.2%
...and cap >= 280sf          11,367    7.3%
```

Half of Brooklyn's one-to-two-family stock is attached rowhouse, which ZR
23-341(b)(4) does not cover at all, and the median lot is 20 feet wide.
**Queens stays.** It is now the right choice for a reason from the data rather
than from the spec.

### What the pipeline does

Continuous sizing, with the cap taken from the rule rather than guessed.

1. Classify building type from the `LotFront − BldgFront` gap. Attached is
   ineligible under 23-341(b)(4).
2. Required rear yard depth from 23-342, by type and lot width, with the
   shallow-lot reduction.
3. `rear_yard_area = LotFront × required_depth`.
4. `adu_sf = min(rear_yard_area / 3, 800)`.
5. Setback fit: `LotFront − 10` must be at least 12 feet, the narrowest design in
   the Pre-Approved Plan Library. Below that no published design fits between the
   two five-foot side setbacks.
6. Floor at **300sf**. The guidebook states that combining the habitability
   minimums - a 70sf habitable room at 7ft minimum dimension, a kitchen, a
   bathroom, a code-compliant egress - puts "the practical minimum size for most
   ADUs" at 250 to 300 square feet. Take 300 and cite it. Below the floor, the lot
   produces no unit.

Expose `rear_yard_fraction` (default 1/3) and `side_setback_ft` (default 5) as
controls, so the map can be re-run against a rule the city didn't write. That is
the whole point of the sandbox and these are the two numbers doing the work.

**Sanity check the output against the Pre-Approved Plan Library.** Median published
design is 406sf; the range is 280 to 785. If the pipeline's median passing lot
lands far outside that, something is wrong.

---

## 5. Pencil: construction cost

`cost_per_sf = 500`, chosen because the interesting behaviour sat there, is
replaced. Two published sources, both verified 2026-09-01.

### The Pre-Approved Plan Library

`housing.hpd.nyc.gov/adu/library`. Eleven designs. Each detail page publishes
maximum width, maximum length, building height, square footage, and a cost range.
Read from the plan pages on 2026-09-01:

| Plan | Designer | Type | sf | W × L | H | Cost | $/sf mid |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Xanadu | BEAM Architects | Detached | 300 | 15 × 20 | 15 | 85-100k | 308 |
| SITU ADU | SITU | Detached | 280 | 14 × 20 | 15 | 220-280k | 893 |
| SMART LOFT | ANE Design | Detached | 343 | 16 × 22.5 | 15 | 100-120k | 321 |
| CDA Studio | Unit Two Development | Attached | 336 | 12 × 28 | 13.25 | 250-310k | 833 |
| Maisel House | Reform Architecture | Detached | 400 | 20 × 28 | 25 | 550-650k | 1,500 |
| Roof for Two | Morrison + Leiva Rivera | Attached | 406 | 15 × 39 | 13.5 | 215-275k | 603 |
| Studio ADU NYC | VL Architects | Detached | 439 | 16.6 × 26.5 | 14 | 185-265k | 513 |
| Still Point | EEREE | Detached | 472.5 | 15 × 31.5 | 15 | 100-140k | 254 |
| CDA One Bed | Unit Two Development | Detached | 600 | 20 × 30 | 13.25 | 360-430k | 658 |
| Far Nordic | FAR Architecture | Above new garage | 600 | 20 × 30 | 25 | 390-450k | 700 |
| Grand ADU | ANE Design | Detached | 785 | 20 × 25 | 25 | 160-230k | 248 |

Plan IDs are at `/adu/plan/<id>`: 1007, 1018, 1019, 1028, 1029, 1031, 1038, 1040,
1042, 1043, 1044. The pages are server-rendered and scrapeable; the fields are
labelled and stable.

Ship this table as `data/processed/pencil/plans.json` and put it in the card.

**Two things to say about it out loud.** The published midpoints run from **$248 to
$1,500 per square foot**, a six-fold spread on eleven designs that were all
reviewed by the same agency for the same purpose. Cost per square foot is not a
property of ADUs. And the estimates exclude, in the City's own words, "costs
associated with establishing site connections or any anticipated site specific
costs" - which is where the budgeting tool picks up.

Set `cost_per_sf`'s default to the **median of the published midpoints, $603/sf**,
with the full distribution drawn on the control or named in its description. Keep
the slider range wide enough to reach both ends of the published spread.

Note also that some prose descriptions disagree with the structured fields: the
Grand ADU page says "1,000 SF" in prose against 785 in the field, and Studio ADU
NYC says 444 against 439. Take the structured field and say so.

### The budgeting tool

`housing.hpd.nyc.gov/adu/budget`. Its assumptions are recoverable by driving the
sliders. Recovered 2026-09-01:

**Defaults, read off the controls:**

| Input | Default | Published range |
| --- | --- | --- |
| Additional design fees, land survey, permitting | 20% of hard cost | 10-25% |
| Construction contingencies | 8% | 5-10% |
| Site prep | $20,000 | 0-40,000 |
| Utility hookup | $30,000 | 10,000-50,000 |
| Construction duration | 18 months | up to 36 |
| Loan term | 20 years | 5-30 |
| Interest rate | 7.5% | 4-11% |
| Tenant turnover rate | 15% | 5-25% |
| Monthly insurance | $200 | 0-300 |
| Monthly upkeep | 20% | 10-30% |
| Management fee | 4% | 0-8% |

**Behaviour, measured by varying one control at a time at a $500,000 hard cost:**

```
soft cost = $50,000 + 0.48 × hard cost      (exact, checked at 100k/200k/300k/500k)
monthly payment factor = 0.008057 per $ of loan
   which is 7.5% over 240 months to four decimal places - the defaults, confirmed
construction duration changes nothing
```

**And a finding worth teaching.** The four exposed cost inputs account for
0.20 + 0.08 of hard cost plus $50,000 flat. The tool's actual output is 0.48 of
hard cost plus $50,000. **There is a 20%-of-hard-cost term the tool never shows
the user**, equal in size to the largest one it does show. It is probably general
contractor overhead and profit. It is not labelled anywhere in the interface.

That belongs in the tutorial. A public tool that exposes eleven assumptions and
hides a twelfth as large as any of them is exactly what this course is about, and
we found it by moving one slider at a time.

**Also note HPD is running two different financings.** The budgeting tool assumes a
7.5%, 20-year market loan. Plus One is 5%, 15 years, extendable to 30. Both are
HPD, on the same website, for the same building. The sandbox models Plus One and
should say why it isn't using the other one.

### What this replaces in the manifest

| Assumption | Was | Now |
| --- | --- | --- |
| `soft_cost` | $30,000 flat, "no published figure was found" | $50,000 + 0.48 × hard cost, HPD budgeting tool defaults, recovered 2026-09-01 |
| `cost_per_sf_default` | 500, invented | 603, median of eleven published PAPL midpoints |
| `opex_share` | 0.25, "a conventional rule of thumb" | HPD defaults: 20% upkeep + 4% management + $200/mo insurance, with turnover at 15% |
| `property_tax` | 0, ignored | Unchanged. Still not in any dataset. The note stays. |

The pro-forma keeps its shape. Every constant in it now has a source.

---

## 6. Flood: return periods, not horizons

*Rewritten 2026-09-01 after the sources were run down. See
`2026-09-01 Sources — The Unfetched Datasets.md` for the evidence behind every
figure and quotation here. The complaint that opened this item is still correct.
Most of what this item proposed as the fix was not.*

The NPCC 2050s and 2080s layers are not return periods. They are the same
1%-annual-chance line, projected forward under sea level rise scenarios. Two
independent axes were collapsed into one control:

- **Annual exceedance probability** - how rare a flood. A statistical statement
  about a distribution, not a place.
- **Projection horizon** - which decade's sea level the line is drawn on top of.

Show both, separately. That is what makes the line's construction visible.

### Bathtub

`surge_m`, a metres slider with a default of 0, is the wrong control. Storm surge
height *is* a return-period quantity, and treating it as a free parameter hides
exactly the step the sandbox exists to expose. Replace it with an annual
exceedance probability control.

Source: **NOAA Tides & Currents, Extreme Water Levels, station 8518750, The
Battery.** **Verified 2026-09-01**, values read off the stick diagram at
`tidesandcurrents.noaa.gov/est/stickdiagram.shtml?stnid=8518750` and cross-checked
against the station datums page.

| AEP | Return period | m above MSL (1983-2001) | **m above NAVD88** |
| --- | --- | --- | --- |
| 99% | 1 year | 1.26 | **1.20** |
| 50% | 2 years | 1.50 | **1.44** |
| 10% | 10 years | 1.84 | **1.78** |
| 1% | 100 years | 2.46 | **2.40** |

NAVD88 sits 0.063 m above the 1983-2001 MSL at this station, which is the
conversion applied. The station's own prose gives the 1% level as 1.7 m above
MHHW; MHHW is 0.758 m above MSL, and 2.46 − 0.758 = 1.70, so the reading checks.

**The probability values in this item were wrong.** It proposed 10%, 2%, 1% and
0.2%. NOAA publishes **99%, 50%, 10% and 1%** and nothing else. There is no 2% and
no 0.2% in this product. The control gets the four that exist. A 0.2% level is a
FEMA quantity from a different method, and putting it on the same slider would mix
two methods in one control, which is the thing this sandbox is against.

**The horizon axis is published by the same table.** The stick diagram's right-hand
column gives the same four levels for a chosen year - the linear sea level trend
for any year from 1992 to 2030, or one of the five 2022 Interagency Sea Level
Report scenarios for a future decade. Read for 2026, every level is 0.10 m higher:
1.36 / 1.60 / 1.94 / 2.56 above MSL. So both controls come from one source, and
the sandbox can show that the probability and the horizon are separate knobs
without leaving NOAA.

**Say this on the face of the sandbox.** These are still-water levels from a GEV
fit to annual maxima at one tide gauge, with the mean sea level trend removed.
They are not FEMA base flood elevations, which add wave effects and come out
higher. The 1% level is 2.40 m NAVD88, about 7.9 feet. Sandy peaked near 11.3 feet
NAVD88 at this gauge. A student who sets the slider to "100-year" and sees less
water than they remember is looking at the difference between two definitions, not
at a bug.

**The source moves on 30 September 2026.** Every page on this product carries a
banner: it is replaced by the integrated *Sea Level Trends and Extremes* site with
a new URL and new APIs. Record the read date, and re-point the citation before the
December freeze.

Keep the metres slider as a manual override behind `link_year`'s existing pattern,
so a student can still set a height by hand and see what probability it
corresponds to. The point is the mapping, not the removal of the number.

`surge_m` is in `schema.json`, so this changes submitted params. Old example
submissions need regenerating.

### Pencil

**This item's Pencil section had the wrong rule.** It asked for `27ya-gqtm` and
`ek8y-fsqz` plus a FEMA FIRM layer, and for flags named `in_1pct_current`,
`in_1pct_2050s`, `in_1pct_2080s`. None of that is what the Zoning Resolution says.

**"Expanded flood area" is not a term in the Zoning Resolution.** It was searched
for on 2026-09-01 and it is not in ZR 12-10 and not in ZR 64-11. The phrase came
from a secondary source and has been carried forward through two build docs and a
memory note. Stop using it.

**ZR 12-10, definition of *ancillary dwelling unit*** - verified 2026-09-01. An
additional dwelling unit on the same zoning lot as a single- or two-family
residence, not exceeding 800 square feet of floor area, one per residence. Then
the limitations, and there are **three separate flood restrictions, not one**:

1. **In the *high-risk flood zone*** (ZR 64-11): no ADU below the *flood-resistant
   construction elevation*. **This is not a ban.** It is an elevation requirement,
   and modelling it as an eligibility exclusion misreads it. It belongs on the
   cost side, if anywhere.
2. **In the DEP-designated *10-year rainfall flood risk area* and *coastal flood
   risk area*: no basement or cellar unit, and no backyard unit.** This is the ban,
   and it is the only one that matters for Pencil, which models backyard ADUs and
   nothing else.
3. Unrelated to flooding, and previously known: no backyard unit in R1-2A, R2A or
   R3A outside the Greater Transit Zone, none in an LPC historic district, and a
   backyard unit needs direct access through a side yard or open area at least five
   feet wide. At first occupancy the lot must be the owner's primary residence.

**ZR 64-11** - verified 2026-09-01. The *high-risk flood zone* is "the area, as
indicated on the *flood maps*, that has a one percent chance of flooding in a
given year". The *moderate-risk flood zone* is the 0.2 percent area outside it.
And *flood maps* is defined as "the most recent map or map data used as the basis
for *flood-resistant construction standards*" - the Resolution never names a
dataset, it points at whatever the Building Code is currently using. That is worth
saying in the card: the rule is written to move.

**The layer Pencil needs is the DEP Interim Flood Risk Area Map**, published at
`nyc.gov/dep/floodriskmap`. Traced 2026-09-01 through the DOB proposed ADU rule,
which defines both DEP terms as set out in the map established under Administrative
Code §24-809 and 15 RCNY §66-01, to the DEP proposed rule creating 15 RCNY Chapter
66:

- *10-year rainfall flood risk area*: "locations in the city where there is a 10
  percent chance or greater of rainfall-induced flooding in any year", built on
  NPCC 2050 sea level rise with a 50-foot perimeter buffer for uncertainty.
- *coastal flood risk area*: "locations in the city where there is a 1 percent
  chance or greater of flooding in any year", built on FEMA's 100-year coastal
  floodplain and NPCC 2080 sea level rise, 90th percentile.

So the two files already in `data/original/` are the **ingredients** of the coastal
flood risk area, not the area itself. Keep them. Relabel them. Do not cite them as
the rule.

**The flags become two, not three:** `in_10yr_rainfall_frra` and
`in_coastal_frra`, both from the DEP map, both barring a backyard ADU outright.
The high-risk flood zone is a third and separate thing and does not belong in the
eligibility test.

**Still open, and it blocks the download:** whether 15 RCNY 66-01 has been adopted
in final form, and what file format the interim map is published in. The rule was
proposed June 2025; the CHPC comment on it is dated 30 July 2025; adoption was not
confirmed on 2026-09-01. Check `nyc.gov/dep/floodriskmap` for a download before
assuming a shapefile exists. If there is no downloadable layer, the card says the
flag is our approximation of an adopted map we could not obtain, and names the two
NPCC layers it is built from instead - which is a much more specific admission
than the one this document started with.

**Adjacent and downloadable:** NYC Stormwater Flood Maps, NYC Open Data
`9i7c-xyvv`, DEP, updated 17 October 2024, one zip with four citywide layers
(extreme 3.66 in/hr with 2080 SLR; moderate 2.13 in/hr with 2050 SLR; moderate
with current sea levels; limited 1.77 in/hr with current). This is the stormwater
modelling behind the rainfall half of the DEP map. It is not the adopted map and
must not be substituted for it. Whether "moderate, 2.13 in/hr" is the 10-year storm
is **not verified** - do not assert it without checking the Stormwater Resiliency
Plan.

## 7. Layout

### What is wrong now

`src/routes/sandboxes/[slug]/+page.js` sets `wide: true`, giving
`.site-main.wide { max-width: 1240px }`. `SandboxFrame.svelte` then splits that
into `grid-template-columns: 1fr 300px` with `.viewport { aspect-ratio: 4/3 }`.

So the map is about 900 by 675 pixels, and a single 300-pixel column carries the
sandbox number, title, subtitle, the whole six-section card, every control group,
every metric and the submit button, scrolling inside `max-height: 78vh`.

Two separate problems. The map is too small for 246,805 lots or a 3D district.
And one narrow column is being asked to do reading, doing and reporting at once,
so none of them gets a hierarchy.

### The frame

Three columns, full width, viewport height. Applies to `mode="edit"` on the
sandbox route only; tutorial mounts and `mode="view"` keep the contained layout
they have.

```
┌──────────────────────────────────────────────────────────────────────┐
│ 02  Does It Pencil                                                    │
├────────────────┬─────────────────────────────────────┬───────────────┤
│                │                                     │               │
│  WHAT THIS IS  │                                     │  THE SUBSIDY  │
│  Why this one  │                                     │   grant max   │
│  The data      │              THE MAP                │   equity      │
│  How it's made │            fills the space          │   rate        │
│  What it       │                                     │  THE MARKET   │
│   assumes      │                                     │   cost / sf   │
│  What it       │                                     │   rent basis  │
│   can't see    ├─────────────────────────────────────┤  THE RULES    │
│                │ lots that pencil 44,677 · median    │   ...         │
│  320px         │ margin $312 · units by 2035 8,000   │  THE CLOCK    │
│  scrolls       │  metrics, one line, over the map    │   year        │
│                │                                     │               │
│                │                                     │  [ submit ]   │
└────────────────┴─────────────────────────────────────┴───────────────┘
     reading                    doing                     controlling
```

Specifics:

- **Break out of `.site-main`.** The sandbox route gets `wide: 'full'` or its own
  flag; the frame sets `width: 100vw` with a small gutter and
  `height: calc(100vh - var(--header) - var(--nav))`, `min-height: 720px`. Drop
  `aspect-ratio` from `.viewport` entirely - it is what is making the map small.
- **Left dock, 320px.** Number, title, subtitle, then the six card sections as
  `<details>`, with "what this is" open and the rest closed. The card stops being a
  wall and becomes navigable. Reading order is unchanged, so the explain-then-
  critique rule still holds.
- **Centre.** The viewport, filling. Metrics as a single horizontal strip along its
  bottom edge, over the map, tabular-nums, label above value. Numbers sit next to
  the thing they describe instead of at the end of a scroll.
- **Right dock, 320px.** Controls only. `x-group` headings become real section
  breaks. Each control keeps its description text - that text is where the model
  gets explained, and giving it its own column is most of what "better explained"
  means here. Submit pinned to the bottom of the dock.
- **Below the fold**, back inside the 800px measure: the tutorial link and the fork
  grid, as now.

Breakpoints:

- **Under 1200px:** right dock drops to 280px, left dock collapses to a single
  "about this sandbox" disclosure above the map.
- **Under 900px:** single column. Map at 4/3, then controls, then card. Roughly
  today's mobile behaviour.

Two things this breaks, both easy to forget:

- **`npm run covers` screenshots the sandbox route.** Changing the viewport's
  aspect ratio changes every cover. Regenerate all of them and check the framing.
- `.panel`'s `max-height: 78vh` and its `@media (max-width: 900px)` block both go.
  Don't leave the old rules behind competing with the new ones.

### Beyond the frame

The layout gets the map bigger and separates reading from doing. It does not by
itself make a two-hundred-thousand-square scatterplot legible, and that is the
other half of the complaint.

Three things belong in the same pass, all of them cheap:

- **A legend.** Every tint mode is a colour ramp with no key on screen. There is no
  way to know from the map what blue means or where the ramp's ends are.
- **Zoom-dependent representation, stated.** The last build already learned that
  sub-pixel marks are moiré and that outliers in a drawn dimension paint over the
  map. Whichever representation is active at the current zoom should be named on
  screen, because at borough zoom the user is looking at a density estimate and at
  block zoom at individual lots, and those are different pictures.
- **Say what a mark is.** One line under the legend: "one square, one tax lot,
  drawn at its own area." The screenshot shows squares that read as buildings and
  are not.

---

## New sources, and their status

| Source | For | Status |
| --- | --- | --- |
| ZR 23-341(b)(4) | ADU size, setbacks, height, eligible building types | **Verified 2026-09-01**, quoted |
| ZR 23-342 | Required rear yard depth by type and width, shallow-lot reduction | **Verified 2026-09-01**, quoted |
| HPD Pre-Approved Plan Library, 11 plans | Real ADU dimensions and published cost ranges | **Verified 2026-09-01**, full table above, and **re-verified against the live index the same day**. Shipped as `data/original/hpd_papl_plans.json`. |
| HPD ADU Budgeting Tool | Soft cost formula, financing and operating defaults | **Verified 2026-09-01** by driving the controls |
| HPD ADU Homeowner Guidebook | 800sf cap, 250-300sf practical minimum, plain-language framing | **Verified 2026-09-01** from the PDF |
| Gensler, "What we learned assessing office-to-residential conversions" | The 25% share, as a calibration target | **Verified 2026-09-01**, quoted |
| NYC Comptroller, *Spotlight: NYC's Office Market* | Office asking rent by class | **Figure in hand 2026-09-01.** $54/sf asking, Class B and C combined, Manhattan, CoStar, current as of 30 Apr 2024, published 14 May 2024. No separate B, no separate C. No effective-rent series found. |
| NOAA Extreme Water Levels, station 8518750 | Annual exceedance probability to water height | **Values in hand 2026-09-01**, converted to NAVD88, plus a published horizon column. Site retires 30 Sept 2026. |
| LEHD LODES `ny_wac_S000_JT00_2023` | Jobs by census block | **Located 2026-09-01**, 2.6 MB, posted 2025-12-03, LODES8 on 2020 blocks. Still needs downloading - `data/scripts/fetch-sources.sh`. |
| NHTS 2022 or CTPP departure times | The agent layer's time dimension | **Table in hand 2026-09-01**: NHTS *Summary of Travel Trends* Table 8-1, p.53. National, six bands, and the evening is one six-hour bin. **ACS B08302** is better - half-hour bands, tract level, same Census API the pipeline already uses - but it is departures *to* work only. Neither describes a Manhattan evening. |
| ~~ZR "expanded flood area"~~ | Pencil's flood exclusion | **The term does not exist in the ZR.** Corrected in item 6. The rule is ZR 12-10 and the layer is the **DEP Interim Flood Risk Area Map**, `nyc.gov/dep/floodriskmap`. Adoption status and file format unconfirmed. |

---

## Build order

Stop after each and check.

1. **Pencil sizing and cost.** Both are pipeline changes with sourced constants and
   no new rendering. The numbers in item 4 are already run, so the pipeline has a
   result to be checked against on the first pass. Smallest change, largest
   correction.
2. **The layout.** Everything else is easier to evaluate in a frame where the map
   is visible. Regenerate covers.
3. **Bathtub's exceedance control.** One source fetch, one schema change, one
   mapping. Regenerate the example submission.
4. **After Five's constants and the convertibility rebuild.** Item 2 and item 3
   together; they touch the same score.
5. **The agent layer.** Last, and only once the departure-time table is in hand.
   The presence curve first, then the trips, so there is a counted number to check
   the animation against.

---

## What is still open

1. **Does the ADU have to sit inside the required rear yard?** ZR 23-341 permits it
   there, as an obstruction. A lot whose open area is deeper than the required rear
   yard has space between the house and that yard which is not a required yard, and
   is governed by lot coverage and FAR instead. If an ADU may sit there, the
   one-third rule is not the binding cap on deep lots and the Queens numbers get
   less harsh. HPD's guidebook and eligibility tool both present the one-third rule
   as *the* size cap, so modelling it as the cap is defensible - but this should be
   checked against the lot coverage rules before the harsh result is published.
2. **Building type is a proxy.** MapPLUTO has no attached / semi-detached /
   detached field, so the classification is `LotFront − BldgFront` with thresholds
   at 2 and 10 feet. Those thresholds are ours. Is there a better source? DOF
   building class A5 is "one family attached or semi-detached", which is a partial
   check on the proxy and worth running.
3. **The Comptroller's report is a PDF that gets reissued.** Pin the edition and the
   date in the manifest, because the office rent figure will move and the sandbox
   should say which one it is quoting. **Partly closed 2026-09-01:** the edition is
   14 May 2024, figures as of 30 April 2024, and it publishes only two class
   figures - roughly $100/sf for 5-star and $54/sf for Class B and C combined. The
   November 2025 successor report drops rent by class entirely. So the figure is
   28 months old at course start and cannot be refreshed from this source.
4. **Has 15 RCNY 66-01 been adopted, and is the map downloadable?** The DEP
   Interim Flood Risk Area Map is the layer the ADU rule points at. The rule
   creating it was proposed in June 2025 and adoption was not confirmed on
   2026-09-01. Until a downloadable layer is found, Pencil's flood exclusion has
   no dataset, and the two NPCC layers on disk are an approximation that has to be
   labelled as one.

5. **Is DEP's "moderate" stormwater scenario the 10-year storm?** The Stormwater
   Flood Maps are published as intensities - 1.77, 2.13 and 3.66 inches per hour -
   not as return periods, and the ZR's term is a 10-year rainfall area. Do not
   assume the moderate layer is the 10-year event without checking the Stormwater
   Resiliency Plan.

6. **Does Pencil's time model survive?** Release is ranked by ROE at
   `permits_per_year`. With only 44,677 lots clearing the size test, and 8,000 units
   by 2035 at the default rate, the queue may no longer be the binding constraint
   the card claims it is. Re-read that claim against the new numbers.
