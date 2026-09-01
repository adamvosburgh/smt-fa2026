---
title: Build Doc — Sandbox 03b, After Five: the agent layer
date: 2026-08-31
type: content
---

# 03b — After Five, the agent layer

**Status: not built. This document is the decision, not the plan.**

Everything else in After Five ships: 3,728 buildings of CityGML massing across
Manhattan CD1 and CD5, the convertibility score, the pro-forma, 467-m as a gate,
the six-date clock, added floors. What is missing is the thing the sandbox is
named for — the crowd on the street at nine in the evening.

This doc sets out what was learned, what is already on disk that a crowd would
need, and five ways to finish it, with what each costs and what each gives up.

---

## Why it stopped

The spec called for roughly two thousand agents moving on a street network, with
each building emitting trips according to **a published occupancy schedule for
its use**. The whole design rests on that schedule being real and citable — that
is what separates "playing back a survey" from "animating a guess", and the
original build doc says so plainly:

> Without it the agent layer is an animation of a number someone made up, which
> is the failure this course exists to name.

No such schedule was settled. `energycodes.gov`'s prototype-building page 404s at
the obvious URL, ASHRAE 90.1's Appendix G schedule sets are not freely
redistributable in a form that can be cited from a public site, and the
alternative agreed in session — travel-survey departure times — was not run down
to a specific published table before the time went.

**So the layer was not shipped, and the absence is stated on the face of the
sandbox** rather than hidden: the card, the tutorial and `meta.js` all say there
is no crowd and why. What ships instead is a *count* of residents, from unit
counts times a published household size.

That is a defensible place to stop. It is not a good place to stay, because the
sandbox's name is a promise.

---

## What is already on disk

Anything below is available now and needs no new decision.

| Thing | Where | Status |
| --- | --- | --- |
| Residential unit counts per building | `buildings.bin`, column `units_created` | Built |
| Average household size | `manifest.household_size` = 2.01 | Built, ACS 5-year 2023 B25010 |
| Workplace job counts by census block | LEHD LODES `ny_wac_S000_JT00_2023.csv.gz` | **Confirmed downloadable**, not yet fetched |
| Office floor area per building | `buildings.bin`, column `office_area` | Built — apportions block jobs to buildings |
| Street geometry | `data/original/3D/*.3dm`, `Roadbed` layer, 744 polylines | On disk, EPSG:2263, **not routable as-is** |
| Building footprints for entrances | `footprints.json` | Built |

The important one is LODES. It gives **jobs by census block**, published, citable,
and citywide — which means the office side of the district's population can be a
counted number rather than a square-feet-per-worker constant somebody invented.
That was the single biggest hole in the original plan and it is closed.

What is still missing is only the **time** dimension: how those residents and
workers distribute across the hours of a day.

---

## The five options

### A. Trips on a street network, from a travel survey

The original vision, done properly. Agents move; `TripsLayer` animates them.

- **Time source:** NHTS 2022 (National Household Travel Survey) departure-time
  distributions, or the Census Transportation Planning Products. Both are
  published and citable.
- **Population source:** LODES for jobs, DOB units × household size for
  residents. Both already available.
- **Network:** `osmnx` for a routable graph, or NYC LION / CSCL street
  centrelines. The `.3dm` `Roadbed` layer is polygons of paved area, not a
  centreline graph, so it is **not** a shortcut — it would have to be
  skeletonised, which is more work than downloading LION.
- **Cost:** a heavy Python dependency chain (osmnx pulls networkx, shapely,
  geopandas, rtree). Shortest paths for a few thousand origin–destination pairs.
  Six baked snapshots at an estimated 2–4MB each, so **12–24MB of site assets** —
  by far the largest payload on the site, against bathtub's 18MB and this
  sandbox's current 1.8MB.
- **What it buys:** the sandbox as designed.
- **What it still assumes, and this is the catch:** NHTS gives departure times
  for a *metro population*, not for *this building*. You still have to assume
  which building each trip starts at, and that assumption is doing as much work
  as the schedule is. The animation will look far more specific than its inputs.
- **Estimated effort:** one to two focused sessions.

### B. A presence curve, and no movement at all

Compute how many people are *in* the district at each hour, and draw it as a
24-hour curve beside the map, with buildings coloured by their contribution at
the selected hour.

- **Time source:** ATUS (American Time Use Survey), which publishes the share of
  the population engaged in activities by time of day — including "at home".
  Published, citable, free.
- **Population source:** as above, already available.
- **Network:** none needed.
- **Cost:** low. One extra download, one extra column, a small chart component.
  **No change to the payload.**
- **What it buys:** the headline claim — that the district stops going dark
  after work — as a *number and a curve*, at the selected year, with every
  input checkable. Scrub the year and watch the 9pm figure rise.
- **What it gives up:** the picture. There is no crowd, no movement, no street.
- **Estimated effort:** half a session.

**This is the recommendation if the sandbox has to be finished cheaply.** It
delivers the argument without any unsourced step, and it is honest about being a
count rather than a scene.

### C. Calibrate against real pedestrian counts

NYC DOT publishes a Bi-Annual Pedestrian Index with counted volumes at fixed
locations. Use the counts as ground truth and model the *change* in street
population as proportional to the change in residential/office mix.

- **What it buys:** the only option where "people on the street" is anchored to
  people who were actually counted.
- **What it costs:** the count locations are sparse — a few dozen citywide, and
  only a handful in CD1. Interpolating between them across a district is its own
  invented precision, so this probably becomes a *validation* of option B rather
  than a layer in its own right.
- **Verdict:** worth doing as a check on B. Not viable alone.

### D. Ship it explicitly unsourced

Build the layer on schedules stated plainly as made up, labelled as such in the
card, `meta.js`, the tutorial and on the canvas.

The original build doc allows this and then argues against it. I agree with the
argument: a moving crowd is the most persuasive thing on the whole site, and
attaching it to numbers with no source teaches the opposite of the course.

**But there is a version of this worth considering.** Build it, label it, and
make the *comparison* the teaching object: show the unsourced animation beside
the sourced curve from option B, and let students see how much more convincing
the unsourced one looks. That is a genuinely good lesson and it is the only
argument for D.

### E. Cut it, and rename the sandbox

If there is no crowd, "After Five" promises something it does not deliver. The
conversion model underneath is complete and interesting on its own — two gates,
a clock, and a district that visibly changes hands.

Renaming costs nothing technical and removes the gap entirely. It also loses the
best framing on the site: that the interesting output of a conversion policy is
not the unit count but what the street is like at nine.

---

## Recommendation

**B now, A later, C as the check on both.**

Option B closes the honest gap in half a session and makes the sandbox deliver
its argument. It needs one new source (ATUS) and one new source already
confirmed (LODES), and it changes no payload.

Option A remains the right long-term answer *if* the payload is acceptable and
*if* someone is willing to state clearly, on the face of the sandbox, that the
origin of every trip is an assumption rather than an observation. That sentence
is the price of the animation and it should be written before the code is.

Do not do D on its own.

---

## Open questions for Adam

1. **Is 12–24MB of baked trips acceptable** as site assets? It would roughly
   double the site's data footprint. If not, A is out regardless of the sourcing.
2. **Is a curve enough?** Option B answers the sandbox's question and shows no
   people. Does "After Five" survive that, or does it need the picture?
3. **Should the unsourced version be built as a teaching object** — shown beside
   the sourced one, precisely to demonstrate how much more convincing it looks?
4. **If none of the above lands, does the sandbox get renamed?**
