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

The complaint is correct and the fix is a reframing rather than a new dataset.

The NPCC 2050s and 2080s layers are not return periods. They are the **same
1%-annual-chance line**, projected forward under sea level rise scenarios. Two
independent axes were collapsed into one control:

- **Annual exceedance probability** - how rare a flood. 10%, 2%, 1%, 0.2% per year,
  which is what "10-year, 50-year, 100-year, 500-year" names. A statistical
  statement about a distribution, not a place.
- **Projection horizon** - which decade's sea level the line is drawn on top of.

Show both, separately. That is what makes the line's construction visible.

### Bathtub

`surge_m`, a metres slider with a default of 0, is the wrong control. Storm surge
height *is* a return-period quantity, and treating it as a free parameter hides
exactly the step the sandbox exists to expose.

Replace it with an annual-exceedance-probability control, mapped to a water height
through a published curve.

Source: **NOAA Tides & Currents, Extreme Water Levels, station 8518750, The
Battery** (`tidesandcurrents.noaa.gov/est/est_station.shtml?stnid=8518750`).
**Verified 2026-09-01 that the product exists and publishes 1%, 10%, 50% and 99%
annual exceedance probability levels** relative to MHHW, MLLW or MSL. The values
themselves are not yet fetched. Fetch them, record the datum, and convert to
NAVD88 the same way the tidal datums already are.

Keep the metres slider as a manual override behind `link_year`'s existing pattern,
so a student can still set a height by hand and see what probability it corresponds
to. The point is the mapping, not the removal of the number.

`surge_m` is in `schema.json`, so this changes submitted params. Old example
submissions need regenerating.

### Pencil

The flood exclusion is currently dropped: the 2050s and 2080s layers were never
downloaded into `data/original/` and the pipeline prints that the exclusion is not
applied. So there is nothing to correct in the code yet, only in what gets built.

Download `27ya-gqtm` (2050s) and `ek8y-fsqz` (2080s), and add the **FEMA effective
and preliminary FIRM 1%-annual-chance layer** alongside them. Then the eligibility
flag names the probability and the horizon separately: `in_1pct_current`,
`in_1pct_2050s`, `in_1pct_2080s`.

**Still unverified, and it matters:** the Zoning Resolution's "expanded flood area"
is a defined term and none of these three layers is it. Find the adopted definition
before the flag claims to implement the rule. If it can't be found, the card says
the flag is our approximation of a rule we could not locate as a layer, which is
what the last build already said and is still true.

---

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
| HPD Pre-Approved Plan Library, 11 plans | Real ADU dimensions and published cost ranges | **Verified 2026-09-01**, full table above |
| HPD ADU Budgeting Tool | Soft cost formula, financing and operating defaults | **Verified 2026-09-01** by driving the controls |
| HPD ADU Homeowner Guidebook | 800sf cap, 250-300sf practical minimum, plain-language framing | **Verified 2026-09-01** from the PDF |
| Gensler, "What we learned assessing office-to-residential conversions" | The 25% share, as a calibration target | **Verified 2026-09-01**, quoted |
| NYC Comptroller, *Spotlight: NYC's Office Market* | Office asking rent by class | Report verified to exist; **figures not yet taken** |
| NOAA Extreme Water Levels, station 8518750 | Annual exceedance probability to water height | Product verified to exist and to publish 1/10/50/99% levels; **values not yet fetched** |
| LEHD LODES `ny_wac_S000_JT00_2023` | Jobs by census block | Confirmed downloadable last build; **not yet fetched** |
| NHTS 2022 or CTPP departure times | The agent layer's time dimension | **Unverified. Nothing is built until a specific table is in hand.** |
| ZR "expanded flood area" as a published layer | Pencil's flood exclusion | **Unverified, and previously assumed. Find it or say it wasn't found.** |

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
   should say which one it is quoting.
4. **Does Pencil's time model survive?** Release is ranked by ROE at
   `permits_per_year`. With only 44,677 lots clearing the size test, and 8,000 units
   by 2035 at the default rate, the queue may no longer be the binding constraint
   the card claims it is. Re-read that claim against the new numbers.
