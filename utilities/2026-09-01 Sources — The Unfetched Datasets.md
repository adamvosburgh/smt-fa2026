---
title: Sources - the unfetched datasets
date: 2026-09-01
type: content
---

# The unfetched datasets, run down

Companion to `2026-09-01 Build Doc - Fixing The Three Sandboxes.md`. That document
left eleven sources in its status table, five of them unfetched or unverified.
This one closes them. Where it disagrees with the build doc, this one is later.

**Verified 2026-09-01** means read from the source on that date, in this session,
by fetching the page or the API and reading the numbers off it.

**A constraint worth recording.** Neither shell available to this session can
reach the open internet - every host tried returned a policy denial from the
egress proxy. Pages were read through a browser and a fetch tool. **No binary
file could be downloaded.** Everything below that is a file rather than a figure
is specified with its exact URL and size, for Adam to fetch. Everything that is a
figure is here.

---

## 1. NOAA extreme water levels - RESOLVED, values below

Station **8518750, The Battery, NY**. Read 2026-09-01 from the *Tidal Datums and
Exceedance Probability Levels* stick diagram,
`tidesandcurrents.noaa.gov/est/stickdiagram.shtml?stnid=8518750`.

Metres relative to the 1983-2001 epoch MSL datum, and to NAVD88:

| AEP | Return period | m above MSL (1983-2001) | m above NAVD88 | ft above NAVD88 |
| --- | --- | --- | --- | --- |
| 99% | 1 year | 1.26 | **1.20** | 3.93 |
| 50% | 2 years | 1.50 | **1.44** | 4.72 |
| 10% | 10 years | 1.84 | **1.78** | 5.84 |
| 1% | 100 years | 2.46 | **2.40** | 7.87 |

Tidal datums at the same station, metres above MLLW, present epoch, read from
`tidesandcurrents.noaa.gov/datums.html?id=8518750`:

```
MHHW 1.541   MHW 1.443   MTL 0.753   MSL 0.783
DTL 0.771    NAVD88 0.846   MLW 0.063   MLLW 0.000
```

So **NAVD88 sits 0.063 m above MSL** at The Battery, and that is the conversion
applied above. Two independent checks that the reading is right:

- The station page states the 1% level as "1.7 meters (5.58 feet) above Mean
  Higher High Water". MHHW is 0.758 m above MSL, and 2.46 − 0.758 = 1.70. ✓
- The datums page and the stick diagram agree on every datum to 0.01 m. ✓

### Three things this changes

**The build doc's proposed control values are not the ones NOAA publishes.** The
doc names 10%, 2%, 1% and 0.2%. NOAA's Extreme Water Levels product publishes
**99%, 50%, 10% and 1%** and nothing else. There is no 2% and no 0.2% here. Use
the four that exist. The 0.2% level is a FEMA quantity, not a tide-gauge one, and
reaching for it would mean mixing two methods in one slider.

**The published values are still-water levels from a tide gauge.** They are the
GEV fit to annual maxima at one gauge, with the mean sea level trend removed.
They are not FEMA base flood elevations, which add wave effects and come out
higher, and they are not what a storm does to a shoreline. 2.40 m NAVD88 for the
1% is roughly 7.9 feet; Sandy peaked near 11.3 feet NAVD88 at this gauge. **That
gap is the sandbox's teaching object and it should be on the face of the
control**, not buried.

**The site retires on 30 September 2026.** Every page carries a banner: this
product moves to the new integrated *Sea Level Trends and Extremes* site, with a
new URL and new APIs. Cite the values with their read date, and re-point the
citation before December.

The stick diagram also publishes a projected column - the same four levels for a
chosen year, 1992 to 2030, on the linear sea level trend, or for a future decade
on one of the five 2022 Interagency Sea Level Report scenarios. Read for **2026**:
1.36 / 1.60 / 1.94 / 2.56 m above the 1983-2001 MSL, i.e. every level 0.10 m
higher. **That is the second axis the build doc asked for, already published by
the same source.** Probability and horizon, from one table.

---

## 2. NYC Comptroller office rent - RESOLVED, but thin and old

*Spotlight: New York City's Office Market*,
`comptroller.nyc.gov/reports/spotlight-new-york-citys-office-market/`.
**Published 14 May 2024, figures current as of 30 April 2024, source CoStar.**

It publishes exactly two Manhattan average asking rents:

- **5-star (trophy): roughly $100/sf**
- **Class B and C combined: $54/sf**

That is the whole class breakdown. There is no separate B, no separate C, no
4-star or 3-star figure. The report has not been reissued; the newer Comptroller
office piece, *NYC's Office Market: Doom Loop or Boom Loop?* (13 November 2025),
drops rent-by-class entirely and gives only a change - Manhattan CBD average
gross asking rents down 16% from year-end 2019, about 35% in real terms.

### What to do with it

Take **$54/sf asking, Class B and C, Manhattan, April 2024, CoStar**. It is the
right half of the market, which is what item 3 of the build doc asked for, and it
replaces the invented 38.

Three caveats belong in the manifest and the card:

- **It is asking, not effective.** No published effective-rent series was found.
  Expose the discount as a control with a stated default, as the doc requires. Do
  not apply a silent haircut.
- **It is 28 months stale** as of course start, and the November 2025 report says
  the market moved. The card should say which edition it quotes and when.
- **B and C are combined.** The sandbox cannot separate them and should not
  pretend to.

---

## 3. Departure times - RESOLVED, with a warning

Two published tables exist. Neither is the one the sandbox wants.

### NHTS 2022, Table 8-1

*Summary of Travel Trends: 2022 National Household Travel Survey*, page 53,
`nhts.ornl.gov/assets/2022/pub/2022_NHTS_Summary_Travel_Trends.pdf`.
"Distribution of Person Trips by Trip Start Time", per cent, by trip purpose:

| Start time | To/from work | Shopping | School/church | Social & rec | Other | All |
| --- | --- | --- | --- | --- | --- | --- |
| 12:00-5:59 AM | 1 | 1 | 1 | 1 | 3 | 1 |
| 6:00-8:59 AM | 37 | 5 | 30 | 3 | 4 | 13 |
| 9:00-11:59 AM | 8 | 28 | 19 | 8 | 12 | 15 |
| 12:00-2:59 PM | 17 | 33 | 17 | 15 | 23 | 23 |
| 3:00-5:59 PM | 21 | 21 | 23 | 18 | 20 | 20 |
| 6:00-11:59 PM | 16 | 12 | 10 | 55 | 38 | 28 |

**This is a table in hand, so the build doc's gate is met.** But look at what it
can carry. It is national, not New York. It is six bands, and the last one is six
hours wide. **The sandbox's headline claim is about nine o'clock at night, and
this table's finest statement about the evening is that 28% of all trips begin
somewhere between six and midnight.** An animation clocked off this table is
inventing every minute of its resolution.

### ACS B08302, "Time of Departure to Go to Work"

Verified 2026-09-01 from `api.census.gov/data/2023/acs/acs5/groups/B08302.json`.
Universe: workers 16+ who did not work from home. **Half-hour bands** from
5:00 a.m., available **at tract level**, through the same Census API the pipeline
already caches from for `acs_queens_tracts_2023.json`.

Far better resolution, and local. But the universe is departure *to* work, so it
describes the morning only. It says nothing about when anyone leaves.

### The honest reading

There is no published table of when people leave Manhattan offices in the
evening. B08302 gives a sourced morning, at half-hour resolution, for these
tracts. NHTS 8-1 gives a national evening at six-hour resolution. **Anything
between those two and the animation is ours.**

That does not kill the layer - the build doc already requires the admission to be
on the face of the sandbox, and this is what that admission has to say. But it
does argue for the ordering the doc chose: **build the presence curve first.** A
counted number from LODES and B08302 is defensible on its own. The trips are the
part that needs the disclaimer.

---

## 4. LEHD LODES - CONFIRMED, needs downloading

Directory listing read 2026-09-01 from
`lehd.ces.census.gov/data/lodes/LODES8/ny/wac/`.

```
ny_wac_S000_JT00_2023.csv.gz    2.6M    posted 2025-12-03
```

Exists, is current, is small. **LODES8 is on 2020 census blocks**, which matches
the 2020 tracts already in `data/original/`. Download URL:

```
https://lehd.ces.census.gov/data/lodes/LODES8/ny/wac/ny_wac_S000_JT00_2023.csv.gz
```

`S000` is all jobs, `JT00` all job types. The years run 2002-2023, so a
time series is available at the same 2.6MB per year if the sandbox ever wants one.

---

## 5. The flood exclusion - the build doc has the wrong rule

This is the largest correction in this document.

### "Expanded flood area" is not a term in the Zoning Resolution

The build doc lists it as "a defined term" whose adopted definition needs finding.
It was searched for on 2026-09-01 and **it is not in ZR 12-10 and not in ZR 64-11**.
Nothing in the Resolution is called that. The project memory note carried the same
phrase from an earlier session; both should be corrected.

### What the rule actually says

**ZR 12-10, definition of *ancillary dwelling unit*** - verified 2026-09-01 from
`zoningresolution.planning.nyc.gov/article-i/chapter-2/12-10`. An additional
dwelling unit on the same zoning lot as a single- or two-family residence, not
exceeding 800 square feet of floor area, one per residence. Then the limitations,
and **there are three separate flood restrictions, not one**:

1. **In the *high-risk flood zone*** (ZR 64-11): no ADU below the
   *flood-resistant construction elevation*. **This is not a ban on the lot.** It
   is an elevation requirement, and the build doc's `in_1pct_*` flag as an
   eligibility exclusion misreads it.
2. **In the DEP-designated *10-year rainfall flood risk area* and *coastal flood
   risk area*: no basement or cellar unit, and no backyard unit.** This is the
   ban, and it is the one that matters for Pencil, because Pencil models backyard
   ADUs and nothing else.
3. Plus, unrelated to flooding: no backyard unit in R1-2A, R2A or R3A outside the
   Greater Transit Zone, and none in an LPC historic district. Backyard units need
   direct access through a side yard or open area at least five feet wide. At
   first occupancy the lot must be the owner's primary residence.

**ZR 64-11 definitions** - verified 2026-09-01:

> *high-risk flood zone*: "the area, as indicated on the flood maps, that has a
> one percent chance of flooding in a given year."
>
> *moderate-risk flood zone*: the area on the flood maps, outside the high-risk
> flood zone, "that has a 0.2 percent chance of flooding in a given year."
>
> *flood maps*: "the most recent map or map data used as the basis for
> flood-resistant construction standards."

Note that the Resolution never names a dataset. It points at whatever the Building
Code is currently using, which is a moving target by design.

### The layer Pencil needs

Traced 2026-09-01 through the DOB proposed ADU rule
(`nyc.gov/assets/buildings/rules/ancillary_dwelling.pdf`), which defines both
DEP terms as "set out in the map established by the Department of Environmental
Protection in accordance with section 24-809 of the Administrative Code and
section 66-01 of Title 15 of the Rules of the City of New York", to the DEP
proposed rule creating 15 RCNY Chapter 66 (City Record, June 2025):

> *10-year rainfall flood risk area*: "an area designated on a map promulgated by
> the department of environmental protection that represents locations in the city
> where there is a 10 percent chance or greater of rainfall-induced flooding in
> any year" - built on NPCC 2050 sea level rise, with a 50-foot perimeter buffer
> for uncertainty.
>
> *coastal flood risk area*: "an area designated on a map promulgated by the
> department of environmental protection that represents locations in the city
> where there is a 1 percent chance or greater of flooding in any year" - built
> on FEMA's 100-year coastal floodplain and NPCC 2080 sea level rise, 90th
> percentile.

The adopted map is the **DEP Interim Flood Risk Area Map**, published at
`nyc.gov/dep/floodriskmap`. **That is the layer.** Not the NPCC layers already on
disk, and not FEMA's FIRM on its own - the adopted map is a derived product with a
buffer and a percentile choice baked in, and the two areas do different things.

### What this means for the pipeline

- The two files in `data/original/` - `future_floodplain_2050s_20260831.geojson`
  and `sea_level_rise_2080s_100yr_20260831.geojson` - are the *ingredients* of the
  coastal flood risk area, not the area itself. They are a defensible
  approximation and a bad citation. Keep them, relabel them.
- **`in_1pct_current` / `in_1pct_2050s` / `in_1pct_2080s` are the wrong three
  flags.** The rule needs two: `in_10yr_rainfall_frra` and `in_coastal_frra`, both
  from the DEP map, both barring a backyard ADU outright. The high-risk flood zone
  is a third and separate thing that changes construction cost, not eligibility.
- The build doc's remark that the exclusion "is currently dropped" stands, but the
  fix is a different download, not the two it names.
- **Still open:** whether 15 RCNY 66-01 has been adopted in final form, and in what
  file format the interim map is published. The rule was proposed June 2025 and
  the CHPC comment is dated 30 July 2025; adoption was not confirmed. Check
  `nyc.gov/dep/floodriskmap` for a download before assuming a shapefile exists.

### Adjacent, and useful

**NYC Stormwater Flood Maps**, NYC Open Data `9i7c-xyvv`, DEP, last updated
17 October 2024, one download `NYCFloodStormwaterFloodMaps.zip`. Four citywide
layers:

```
Extreme  (3.66 in/hr) with 2080 sea level rise
Moderate (2.13 in/hr) with 2050 sea level rise
Moderate (2.13 in/hr) with current sea levels
Limited  (1.77 in/hr) with current sea levels
```

These are the stormwater modelling behind the rainfall half of the DEP map. They
are not the adopted map and should not be substituted for it, but they are the
only citywide rainfall-flood layer that is straightforwardly downloadable, and the
Moderate-with-2050 scenario is the closest published analogue to the 10-year
rainfall flood risk area. **Whether "moderate, 2.13 in/hr" is the 10-year storm is
not verified here** - do not assert it without checking the Stormwater Resiliency
Plan.

---

## 6. HPD Pre-Approved Plan Library - re-verified

The library index at `housing.hpd.nyc.gov/adu/library` was read again on
2026-09-01. **Eleven plans, and every square footage, cost range, type and
designer in the build doc's table matches the page.** The detail page for plan
1007 was opened as a spot check: Grand ADU, ANE Design LLC, 785 sq ft, 20 ft wide,
25 ft long, 25 ft high, $160,000-$230,000 - exactly as the doc records it.

The index adds bedroom and bathroom counts, which the doc's table omits:

```
Xanadu          studio, 1 bath      Still Point     1 bed,  1 bath
SITU ADU        studio, 1 bath      CDA One Bed     1 bed,  1 bath
SMART LOFT      studio, 1 bath      Far Nordic ADU  1 bed,  1 bath
CDA Studio      studio, 1 bath      Grand ADU       2 bed,  1 bath
Maisel House    studio/1 bed, 1 bath
Roof for Two    1 bed, 1 bath
Studio ADU NYC  studio, 1 bath
```

The prose-versus-field disagreements the doc flags are confirmed on the live
pages: Grand ADU's description says "1,000 SF" against 785 in the field, and
Studio ADU NYC's says 444 against 439. The doc's rule - take the structured field,
say so - holds.

The full-name field for two designers differs slightly from the doc: **ANE Design
LLC** (not "ANE Design"), and **Anna Morrison Architect + Leonardo Leiva Rivera**
for Roof for Two. Far Nordic's type field reads **"Detached Above New Garage"**.

Nothing here needs fetching. The table can be written straight to
`plans.json` from the build doc, with the bed/bath counts added.

---

## What Adam has to download

Neither shell in this session has network access. These four are files, and the
exact URLs are verified:

| File | Source | Size | For |
| --- | --- | --- | --- |
| `ny_wac_S000_JT00_2023.csv.gz` | `lehd.ces.census.gov/data/lodes/LODES8/ny/wac/` | 2.6 MB | After Five, jobs by block |
| DEP Interim Flood Risk Area Map | `nyc.gov/dep/floodriskmap` | unknown | Pencil, the actual ADU flood ban |
| `NYCFloodStormwaterFloodMaps.zip` | NYC Open Data `9i7c-xyvv` | unknown | context for the above |
| ACS B08302, Queens + Manhattan tracts | `api.census.gov`, ACS 5-year 2023 | small | After Five, departure times |

B08302 is an API call the pipeline can make itself, on the pattern already in
`pencil.py` for `acs_queens_tracts_2023.json` - it needs no manual download once
the machine running the pipeline has network.

## Status table, revised

| Source | Status after 2026-09-01 |
| --- | --- |
| NOAA extreme water levels, 8518750 | **Values in hand.** Four AEP levels, in NAVD88. Site retires 30 Sept 2026. |
| NYC Comptroller office rent | **Figure in hand.** $54/sf B&C asking, April 2024. Thin and stale; no effective-rent series found. |
| NHTS 2022 Table 8-1 | **Table in hand.** National, six bands, evening is one six-hour bin. |
| ACS B08302 | **Verified.** Half-hour bands, tract level, Census API. Morning only. |
| LEHD LODES 2023 | **Confirmed and located.** 2.6 MB, needs downloading. |
| ZR "expanded flood area" | **Does not exist.** Corrected above; the terms are *high-risk flood zone*, *10-year rainfall flood risk area*, *coastal flood risk area*. |
| DEP Interim Flood Risk Area Map | **Identified as the correct layer.** Adoption status and file format unconfirmed. |
| HPD Pre-Approved Plan Library | **Re-verified.** No fetch needed. |
| HPD budgeting tool | Unchanged from the build doc. |
| Gensler 25% | Unchanged from the build doc. |
