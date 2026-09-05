---
title: Build Doc — finishing the sandboxes
date: 2026-09-04
type: content
---

# Finishing the sandboxes

**Read `2026-09-01 Notes — What Is Not Built.md` first.** This document closes its
open register. Where the two disagree, this one is later.

Everything marked **verified 2026-09-04** was read from the source on that date,
by fetching the page, listing the archive, or running the numbers. Everything
else is marked unverified and must be checked before code depends on it.

The standing rule holds and two items below exist because it was broken once
already: **a sandbox that cannot complete a step is not thereby making a point
about the limits of models.** The 09-01 pass shipped a paragraph about an absent
evening schedule without having looked for one. There is one. It is in §3.

Two things are different about this pass. Adam has ruled that **the prose voice
is deferred** - every `PROSE DRAFT` header stays where it is and gets fixed in a
single later pass, so do not spend effort on voice. And Adam has ruled that
**assumptions get exposed as controls rather than resolved**. Where a number
cannot be sourced, the fix is a slider with the assumption written on it, not a
paragraph explaining the absence. These are sandboxes. They are for playing
with, not for predicting.

---

## The decisions

| # | Was | Now |
| --- | --- | --- |
| 1 | Studio Twin and Sunlight are stubs in the list | `published: false` in `meta.js`. Hidden everywhere, and the remaining five renumber **1-5**. |
| 2 | Time is a slider you drag | Every sandbox with a time axis gets a **transport control - play, pause, scrub, speed**. Anthromes and After Five animate by default. |
| 3 | After Five has no agent layer, and the evening was said to be unsourced | **It is sourced.** MTA's origin-destination estimate gives arrivals and departures at Lower Manhattan stations by hour and day of week. Full 24-hour cycle, trips routed on the street network, gateways weighted by real counts. |
| 4 | Office rent and cap rate are single unsourced numbers | **Rent becomes four named scenario stops**, one sourced and three ours, each carrying its own justification. **Cap rate splits in two** - office and residential - which fixes a real arithmetic defect. |
| 5 | Which end of a Queens lot is the back is a coin flip | **The unshared lot edge is the street frontage.** Measured 2026-09-04: it points into the block 96.5% of the time against the current method's 55.5%. |
| 6 | Anthromes is a stub | Built. **HYDE 3.2** inputs (3.5's are missing 2000-2023 at source), the published Anthromes 2.1 decision tree in the browser, every threshold a slider, 33km grid, 75 time steps to 2017AD. |
| 7 | Bathtub cites a product that retires 30 Sept 2026 | Re-point the citation. This is 26 days away and it is the only hard deadline in the document. |

---

## 0. Downloads - do these first

**The gate: `python3 data/scripts/checks/preflight.py` must exit 0 before Claude
Code starts.** It resolves every path the pipelines actually construct - copied
out of the source, not out of this document - and reports each one PRESENT or
MISSING with the line that needs it. A handoff to Claude Code with a missing
dataset is the failure mode this project has hit before; this is the check that
makes it impossible to miss. It also mirrors `pencil.py`'s deliberate fallback
for the two HUD files (`fmr+incomelimit/` then loose in `data/original/`), so it
does not invent requirements the pipelines do not have.


**Nothing in the Cowork session can download files.** Both shells - the cloud
container and the one on Adam's machine - are behind an egress proxy that refuses
every host. Verified 2026-09-04 against `bls.gov`, `api.census.gov` and a control
host; all three returned `403 CONNECT tunnel failed`. So every dataset below is
fetched by Adam in his own terminal or browser, before Claude Code starts.

Add these to `data/scripts/fetch-sources.sh`. Sizes and URLs verified 2026-09-04
except where marked.

### After Five

| What | Where | Size | Status |
| --- | --- | --- | --- |
| MTA Subway Origin-Destination Ridership Estimate: 2024 | `data.ny.gov` `jsu2-fbtj` | aggregate query, KB | **Verified.** 116,279,069 rows. Do **not** bulk download - use the SoQL query in §3. |
| MTA Subway Hourly Ridership, beginning 2025 | `data.ny.gov` `5wq4-mkjj` | aggregate query, KB | **Verified.** 42,213,076 rows, through 2026-07-22. Cross-check only. |
| MTA Subway Entrances and Exits: 2024 | `data.ny.gov` `i9wp-a4ja` | 2,120 rows | **Verified.** Full download is fine. |
| NYC Street Centerline (CSCL) | `data.cityofnewyork.us` `inkn-q76z` | 122,263 rows | **Verified.** GeoJSON export works. |
| DCP LION file geodatabase (alternative to CSCL) | `data.cityofnewyork.us/download/2v4z-66xt/application/zip` | 45,981,902 bytes | **Verified as a URL that streams.** Release 26b per data.gov as of 2026-05-26; 26c may now be current, unconfirmed. |
| ATUS 2003-2025 Activity file | `bls.gov/tus/datafiles/atusact-0325.zip` | 81.5 MB | **Verified.** |
| ATUS 2003-2025 Respondent file | `bls.gov/tus/datafiles/atusresp-0325.zip` | 16.3 MB | **Verified.** |
| LEHD LODES 8 WAC 2023, NY | already on disk | 2.6 MB | `data/original/ny_wac_S000_JT00_2023.csv.gz` |

Use **CSCL, not LION**, unless something forces the change. CSCL is a Socrata
GeoJSON export with a documented field list and no geodatabase driver needed;
LION is a `.gdb` inside a zip and the pipeline has no geo stack.

### Anthromes

| What | Where | Size | Status |
| --- | --- | --- | --- |
| HYDE **3.2** inputs + supporting grids | `dataverse.harvard.edu`, doi:10.7910/DVN/E3H3AK, `raw-data.zip` | ~850 MB - 1 GB | **This is the input source.** One download, all six input grids for all 75 time steps, plus the five supporting grids. Fetched by `data/scripts/fetch-anthromes-inputs.sh`. |
| Anthromes 12K reference Python classifier | `dataverse.harvard.edu/api/access/datafile/3754831` | 40,554,135 bytes | **fileId verified.** doi:10.7910/DVN/IB4VCI. Optional but cheap - it is what our cascade gets checked against. |
| HYDE **3.5** classified anthromes | already on disk, `data/original/hyde35/HYDE-3.5.zip` | 18.1 GB | **Comparison layer only, not the input source.** Complete: 128 steps, 10000BC to 2025AD. |

### Why the inputs are HYDE 3.2 and not 3.5 - verified 2026-09-04

Adam's 3.5 archive is clean and complete as distributed. **HYDE 3.5's own
distribution is missing the 2000-2023 input grids.** Stream-read the local file
headers out of `HYDE-3.5/baseline/3zip/1970ce-2023ce.zip` inside the 18.1 GB
archive and you get **60 members, 30 years, 1970AD to 1999AD**. The archive is
named for a period it does not contain. The `zip/` and `NetCDF/` folders that
might hold the rest are present and empty, and the Utrecht vault is unreachable
behind a bot wall from a script and from a browser alike. Three separate
transfers - two Google Drive downloads and an rsync from another machine -
reproduced the same 30 years, so this is upstream, not a transfer fault.

Input years actually available in 3.5: 102, from 10000BC to 1999AD. That is
**62 of the 76 display years**, and the 14 it loses are 2000, 2005, 2010, 2015
and 2016 through 2025 - the stretch a reader cares most about.

**This gap is invisible in `twosides` because that project never opens an input
grid.** `processing/2b_generate_grid.py` reads
`data/HYDE-3.5/baseline/anthromes_geotiff/anthromes<YEAR>.tif` and nothing else -
the *classified* output, which is complete to 2025AD. Anthromes here is the first
thing either project has built that re-derives the classification, so it is the
first thing that needs the inputs at all.

HYDE 3.2 is what the published Anthromes 2.1 classification was actually computed
on. It reaches 2017AD: **68 of 76 display years**. It also bundles the five
supporting grids, so it replaces two downloads with one. And because it is the
documented method of record, our cascade at default thresholds should reproduce
the published map - a check 3.5 cannot offer at all, its classification paper
still being in preparation.

The 3.5 archive stays in the repo. Its classified series is the newest published
answer and it runs to 2025AD, which makes it the third comparison layer below.

### What the 3.5 archive holds - verified 2026-09-04



Listed from `twosides/data/HYDE-3.5/lower/3zip/10kbce_1000ce.zip`, which is
already on disk, so this is read from a real archive rather than from
documentation. The baseline archives Adam is restoring use the same layout. Each period archive holds two zips per year:

```
{YEAR}_lu.zip   -> cropland{YEAR}.asc  grazing{YEAR}.asc  pasture{YEAR}.asc
                   rangeland{YEAR}.asc  conv_rangeland{YEAR}.asc
                   rf_rice{YEAR}.asc  ir_rice{YEAR}.asc
                   rf_norice{YEAR}.asc  ir_norice{YEAR}.asc
                   tot_rice{YEAR}.asc  tot_rainfed{YEAR}.asc
                   tot_irri{YEAR}.asc  shifting{YEAR}.asc

{YEAR}_pop.zip  -> popc_{YEAR}.asc  popd_{YEAR}.asc  urbc_{YEAR}.asc
                   rurc_{YEAR}.asc  uopp_{YEAR}.asc
```

Note the inconsistent underscore: population variables carry one before the
year, land-use variables do not. Each `.asc` is 4320 x 2160 at 0.0833333 degrees,
`NODATA_value -1`, and roughly 50-85 MB uncompressed. The pipeline reads them
streaming; do not load a whole period into memory.

Six are needed: `cropland`, `grazing`, `ir_rice`, `tot_irri`, `uopp`, `popc`.

---

## 1. Publication flags and renumbering

**`published: false` in `meta.js`** for `studio-twin` and `sunlight`. Everything
else keys off it.

- `src/lib/sandboxes/index.js` exports `sandboxes` filtered to
  `published !== false`, in the existing array order, and assigns `number` from
  that order rather than reading it from `meta.js`. Delete the hardcoded `number`
  fields. Unhiding a sandbox later renumbers the rest automatically, which is the
  whole point of doing it this way.
- Export the unfiltered list separately as `allSandboxes` for the submission
  validator and `scripts/cover.js`, so a hidden sandbox does not 404 if someone
  has its URL.
- `/sandboxes/<slug>` for a hidden sandbox should still render, with the
  `NotBuilt` component. Do not 404 - the slugs are in old build docs.

Resulting order: **1 Does It Pencil, 2 After Five, 3 The Coefficients,
4 Anthromes, 5 Bathtub.**

Renames, all of which change URLs:

```
src/content/tutorials/02-pencil.md        -> 01-pencil.md        sequence: 1
src/content/tutorials/03-after-five.md    -> 02-after-five.md    sequence: 2
src/content/tutorials/04-coefficients.md  -> 03-coefficients.md  sequence: 3
                                          (new) 04-anthromes.md  sequence: 4
src/content/tutorials/07-bathtub.md       -> 05-bathtub.md       sequence: 5
src/content/tutorials/00-site-setup.md    unchanged              sequence: 0
```

Update the `tutorial:` field in each `meta.js` to match. Slugs do not change, so
`src/submissions/_example/<slug>/` and `static/covers/<slug>.png` are untouched.
`FAILURE_MAP` in `src/lib/server/validate.js` points at headings, not files, so
it is unaffected - but re-read it once after the renames to be sure.

Regenerate covers after the layout work in §2, not before.

---

## 2. The play pass

Adam's direction: *"these are sandboxes, the UI should be oriented towards play
and tweaking."* Time is currently a slider you drag and let go of. It should
run.

### The schema extension

One new property key. A control that is the sandbox's time axis declares:

```json
"x-timeline": "primary",
"x-play-rate": 4,
"x-play-loop": true
```

`x-timeline` is `"primary"` or `"secondary"`. `x-play-rate` is steps per second.
`x-play-loop` says whether reaching the end restarts or stops.

Which control in each sandbox:

| Sandbox | primary | secondary |
| --- | --- | --- |
| Does It Pencil | `year` (2027-2050, step 1, rate 3, loop) | - |
| After Five | `hour` (new, 0-24, step 0.05, rate 2, loop) | `year` (six stops, rate 1, no loop) |
| The Coefficients | the simulation tick, not a schema property - see below | - |
| Anthromes | `year` (76 stops, rate 5, loop) | - |
| Bathtub | `year` (five stops, rate 1, no loop) | - |

### The transport control

`ParamPanel` renders, for any `x-timeline` property, a transport row **above**
the slider rather than replacing it: `⏮ ⏯ ⏭`, the current value as a large
readout, and a speed control at 0.5x / 1x / 2x / 4x. The slider stays and stays
draggable; grabbing it pauses playback.

**`SandboxFrame` owns the clock, not the sandbox.** One `requestAnimationFrame`
loop, one place to fix. This matters for the same reason the frame already
publishes `window.__metrics` on the sandbox's behalf: the cover pipeline needs
one thing to wait on across all five. Two rules:

- **The frame does not advance the clock while the sandbox has reported
  `onready(false)`.** Pencil recomputes 246,921 lots on a year change. Without
  this the frame queues frames faster than the sandbox can answer and the whole
  page locks. Skip the tick, do not buffer it.
- **Only one timeline plays at a time.** Pressing play on a secondary timeline
  pauses the primary and holds it at its current value. In After Five that means
  scrubbing the year holds the hour clock at 17:00, which is the peak and the
  interesting moment; playing the hour clock holds the year. This is the
  interaction Adam flagged and it needs stating on screen, not just in code: the
  transport row for the paused timeline shows `held at 17:00` where its play
  button was.

The Coefficients already runs a clock. Give it the same transport widget, bound
to run/pause/step of the engine rather than to a schema property, so the control
looks identical across all five even though only this one is a live simulation.
Its existing `speed` enum becomes the transport's speed control; delete the
separate slider.

### The Coefficients needs a play pass of its own

It works, and that is the most that can be said for it. Adam's read: it is hard
to understand and it is not visually interesting. **The window is too small to
follow what is happening** - the city and fifteen rasters are competing for a
viewport that was sized before the three-column frame existed, and at that size
neither the simulation nor the layers being written are legible.

Treat this as a design problem, not a layout tweak. Some directions, none of them
prescriptive:

- **Make the map big enough to read, and let the reader move around it.** Zoom
  and pan, or a larger tile size, or a detail view alongside the whole city.
  Whatever it takes to see individual tiles change.
- **The fifteen rasters are the point of this sandbox and they are currently a
  thumbnail strip.** Watching a layer being written - blurred outward, decayed,
  recomputed on its fixed rotation - is the thing that turns the city from a
  world into a stack of grids. Give that its own space.
- **Show which layer is updating on this tick.** The rotation is the mechanism,
  and it is invisible.
- Consider whether the game view and the layer view want to be side by side, or
  overlaid, or switchable.

### Latitude

**This applies to every sandbox in this document, not only The Coefficients.**

The sandboxes exist to be visually interesting, to invite play, and to expose the
datasets and the assumptions underneath each simulation. Where a change serves
those three, make it - including changes this document does not specify, and
including ones that go further than it does. **Adam would rather see an attempt
that overshoots in service of those objectives than a literal reading that lands
short.** The controls, the layout, the rendering and the interaction are all fair
game.

Two things that are not latitude. The numbers and their provenance are fixed:
nothing here licenses inventing data, loosening a source, or quietly changing a
default that carries a position. And **keep the prose plain and descriptive** -
write for accuracy, leave the `PROSE DRAFT` headers in place, and let the
separate voice pass do that work.

**Covers.** `scripts/cover.js` screenshots the sandbox route. A playing timeline
means the cover is nondeterministic. Before capture, the cover script must set
every timeline to its schema default and pause. Add `data-timeline-paused` to the
frame and have the cover script wait on it alongside `data-cover-ready`.

---

## 3. After Five - the agent layer

This is the most important item in the document.

### The 09-01 paragraph was wrong and has to come off the sandbox

The card, `meta.js`, the tutorial and the legend all currently say that nothing
published describes a Manhattan evening. That claim was made after evaluating two
*trip* tables - NHTS Table 8-1 and ACS B08302 - and it is not true.

**MTA Subway Origin-Destination Ridership Estimate: 2024**, `jsu2-fbtj` on
`data.ny.gov`, 116,279,069 rows, gives estimated ridership for every
origin-complex to destination-complex pair broken down by **year, month, day of
week and hour of day**. Aggregating destinations inside the district gives the
morning arrival curve. Aggregating origins gives the evening departure curve, and
tells you where people go. Verified 2026-09-04 from the dataset's own column
metadata.

The cross-check, **MTA Subway Hourly Ridership** `5wq4-mkjj`, is entries only -
its own data dictionary says *"Total number of riders that entered a subway
complex"*, and `transfers` is a subset of `ridership`, not an addition. A run
against it on 2026-09-04, Manhattan complexes south of latitude 40.716, October
2025, all days:

| hour | entries | hour | entries |
| ---: | ---: | ---: | ---: |
| 06 | 109,862 | 15 | 624,197 |
| 07 | 270,421 | 16 | 823,267 |
| 08 | 419,833 | **17** | **1,059,909** |
| 09 | 326,999 | 18 | 713,888 |
| 10 | 260,903 | 19 | 419,453 |

The 5pm peak is **2.5 times** the 8am peak. That asymmetry is itself the check
that the field means what the dictionary says: Lower Manhattan is a jobs
destination, so people enter its stations to leave it. Reproduce this number
before building on it.

Weekday filtering with `date_extract_dow` returned unfiltered totals in testing
and could not be diagnosed - it may be the fetch proxy rather than Socrata. Use
`jsu2-fbtj`, which carries a literal `day_of_week` column and needs no date
function. Sanity-check any weekday figure against the all-days table above:
weekday totals must be lower and the 17:00/08:00 asymmetry must narrow.

Register a Socrata app token and send `$$app_token=`. Unauthenticated aggregates
without a time filter time out.

### Pipeline - new, `data/scripts/after-five-agents.py`

1. **Gateways.** `i9wp-a4ja`, 2,120 rows, fields `complex_id`,
   `entrance_latitude`, `entrance_longitude`, `entrance_type`, `entry_allowed`,
   `exit_allowed`. Keep entrances inside the district bounds. A complex's flow
   splits evenly across its entrances - that is an assumption and it goes on the
   card. Note `borough` here is a single letter (`M`), while the ridership
   datasets spell it out (`Manhattan`); this has already caught people out.
2. **Flow by hour.** From `jsu2-fbtj`, weekdays, 2024: for each complex in the
   district, arrivals by hour (as destination) and departures by hour (as
   origin). 24 x nComplex x 2, a few KB.

   **This is fetched as a server-side aggregate and must stay one.** The table
   is 116,279,069 rows; even restricted to destinations inside the two districts
   it is roughly 40 complexes x 400+ origins x 12 months x 7 days x 24 hours.
   A row pull with a `$limit` would silently truncate and the curve would be
   wrong in a way nothing downstream could catch. The agent layer never needs
   the pairs - only how many people arrive and depart per complex per hour, which
   is a few hundred rows after `$group`.

   Field names verified 2026-09-04 against a live sample: `day_of_week` is a
   literal string column, so weekday filtering needs no date function - which
   matters, because `date_extract_dow` misbehaved on the hourly dataset and was
   never diagnosed.

   A third aggregate, `mta_od_evening_destinations_2024.csv`, records where the
   district's evening crowd goes. It labels the animation; it does not drive it.
3. **Street graph.** CSCL `inkn-q76z` GeoJSON, clipped to the district. Nodes at
   shared endpoints, edges with length in feet. Lower Manhattan is on the order
   of 2,000 edges. Emit `graph.bin`: node coordinates as Float32, edges as
   Uint16 pairs.
4. **Routes, precomputed.** Run Dijkstra once from each gateway node over the
   whole graph and ship the predecessor array. At roughly 80 gateways and 4,000
   nodes that is 80 x 4,000 x Uint16 = 640 KB. This replaces the 12-24 MB of
   baked trip snapshots the 09-01 doc accepted. **Do not bake snapshots.** The
   browser walks the predecessor array to build a path in microseconds.
5. **The occupancy curve.** ATUS, `atusact-0325.zip` joined to
   `atusresp-0325.zip` on `TUCASEID`. Filter `TELFS` in (1,2), `TUDIARYDAY` in
   2-6, and an occupation subset from `TEIO1OCD` (2018 Census Occupation
   Classification) for management, business, financial and professional
   occupations. Compute the weighted share of respondents with `TEWHERE = 2`
   (Respondent's workplace) in each 15-minute bin from `TUSTARTTIM` and
   `TUSTOPTIME`, both `HH:MM:SS` with a valid upper bound of `24:00:00`.

   **The multi-year weight is `TUFNWGTP`, not `TUFINLWGT`.** `TUFINLWGT` is the
   single-year weight and is absent from the multi-year files. Cases with
   `TUYEAR = 2020` have a missing `TUFNWGTP` and must be dropped.

   `TEWHERE` codes 12-21 and 99 are *modes of travel*, not places. Do not treat
   them as "not at work" without saying so - a person commuting is neither at
   home nor at the workplace.

   All of `TELFS`, `TUDIARYDAY`, `TEIO1OCD`, `TEIO1ICD`, `TRDPFTPT` are on the
   respondent file. The 101 MB ATUS-CPS file is **not needed**.

Outputs into `data/processed/after-five/`: `gateways.json`, `flow.json`,
`graph.bin`, `routes.bin`, `occupancy.json`. Under 1 MB together.

### The component

Full 24-hour cycle, both directions, as Adam chose.

- New `hour` control, 0 to 24, continuous, the primary timeline, looping.
- Sample `agent_count` agents (default 4,000, control range 500-15,000). Each is
  assigned an origin or destination building weighted by that building's jobs
  (LODES, already in `buildings.bin`) for workers, or by `units_created` x
  `household_size` for residents; a gateway weighted by that gateway's share of
  the district's flow in that hour; and a time drawn from the schedule.
- Render with `TripsLayer` from `@deck.gl/geo-layers`. **deck.gl 9.3.11 is
  already a dependency and After Five already imports `PolygonLayer` through
  `@deck.gl/mapbox`** - no new package. Keep the same lazy-import pattern.
- Two agent colours, workers and residents, and they run in opposite directions
  over the day. Converting an office to housing has to visibly move mass from one
  to the other. **That is the point of the layer.** If a build produces a pretty
  animation that does not respond to the conversion sliders, it has failed.

### The schedule as a control

Adam: *"it is ok to make up some assumptions of typical behavior. once again,
this is for visualization, not prediction."* So the schedule is a control with a
measured default, not a hidden constant.

| control | default | what it is |
| --- | --- | --- |
| `schedule_source` | `measured` | `measured` uses the MTA hourly curve directly. `parametric` hands the four sliders below to the reader. |
| `arrival_median` | from the data | when half the day's arrivals have happened |
| `arrival_spread` | from the data | hours, the width of the morning peak |
| `departure_median` | from the data | 17:00 in the measured curve |
| `departure_spread` | from the data | hours |

Three things get named on the canvas, not buried in the card:

- **Which building a trip starts at is assumed proportional to jobs.** Nothing
  says the people leaving 195 Broadway at 5:40 work there.
- **The route is the shortest path, not the chosen path.** Nobody walks the
  shortest path to the subway.
- **The gateway share is real.** It comes from counted taps. This is the one of
  the three that is measured, and it should be labelled as such so the other two
  read as what they are.

---

## 4. After Five - the assumption sliders

Adam's ruling: *"just put in a slider that allows a user to change the
assumptions... it is more important to just put in assumptions and make those
assumptions clear."*

### Office rent

Replace `office_rent_discount` with `office_rent`, an enum of four stops. Add a
new schema key `x-enum-notes`, an array parallel to `x-enum-labels`, which
`ParamPanel` renders under the control for the selected stop only.

| $/sf/yr | label | note rendered under the control |
| --- | --- | --- |
| **54** | *the published asking rent* | Manhattan Class B and C combined, asking. NYC Comptroller *Spotlight: NYC's Office Market*, 14 May 2024, CoStar as of 30 April 2024. **The only stop with a source.** B and C are combined at source; the sandbox must not pretend to separate them. At this stop nothing converts. |
| 41 | *what a landlord collects* | Asking rent is a list price. Free months and fit-out allowances are not published, so this stop applies a flat 25% discount. Ours, not anyone's. |
| 32 | *a building in trouble* | A 40% discount, standing for a half-empty Class C building signing short leases. Ours. |
| 70 | *not really Class B* | The Comptroller's 5-star figure is roughly $100. This stop stands for a repositioned building at the top of the B/C band. Ours. |

Default stays **54**. The empty map at the default is the sandbox's finding and
it stays the finding; the other three stops let a reader find out what it costs
to disagree. The legend already says so in words - keep that and add a line
naming which stop is selected and whether it has a source.

### Cap rate

This is a real arithmetic defect, not just an unsourced input. The same 0.055 is
applied to office income and residential income, so it scales both sides and very
nearly cancels - and the gap between office and residential yields is a large part
of why anyone converts anything.

Split into two controls, `cap_rate_office` and `cap_rate_residential`, both
0.03 to 0.10, both defaulting to **0.055**.

Do **not** invent a default spread. Equal defaults reproduce today's behaviour
exactly, so the change is provably neutral on the first render, and the reader
discovers the effect by pulling them apart. The note under both controls says:
market convention, not a measurement; no published NYC series was verified for
either; and that setting them equal is what the model used to do silently.

`opex_share` (0.35) keeps its single control and gains the same note.

### While you are in there

`floor_area_per_apartment` is 1,152 sf, from 149 DOB filings, and the ten-unit
floor moves it by 40% - 1,366 sf at a one-unit floor, 907 at fifty. The whole
ladder is already in the manifest. Expose the floor as a control
(`min_units_for_conversion_sample`, 1 to 50, default 10) and recompute the
implied floor area from the shipped `filings.json`. It is the cheapest way to
turn a buried judgement into a visible one.

---

## 5. Does It Pencil - frontage from the unshared lot edge

Adam's proposal: *"for queens in almost all cases the front of the lot is going
to be the only lot edge that is not shared with another... I feel like looking at
the unshared edge on the block level should give a pretty good idea the lot
direction."*

**It works, and it is much better than the block-majority vote that was queued
instead.** Measured 2026-09-04 against MapPLUTO 26v2, 500 randomly sampled Queens
tax blocks holding at least eight one-to-two-family lots, 13,670 such lots.

### Why it is cheap

A NYC tax block is bounded by streets. **Every shared lot line therefore lies
inside a block**, so sharing can be computed block by block and never needs a
citywide spatial index. The whole 500-block test ran in **7.8 seconds** in pure
Python and numpy, with no geo stack, reusing `read_shape_index` and
`read_outer_ring` exactly as they are.

### The method, as tested

For every lot in a block, walk the outer ring. Sample each edge at 3 ft spacing
and snap each sample to a 3 ft grid as an int64 key. Collect
`(key, lot)` pairs for the whole block, deduplicate, and mark every key touched
by two or more distinct lots. An edge is **shared** if at least half its samples
land on a marked key. The frontage direction is the length-weighted mean of the
outward normals of the unshared edges; the back of the lot is the opposite.
Orient each normal by requiring a positive dot product with (edge midpoint minus
lot centroid).

### What it measured

| | |
| --- | --- |
| lots with no unshared edge at all | 65 of 13,735, **0.5%** |
| exactly one unshared edge | 11,614, **85.0%** |
| two unshared edges (corner and through lots) | 1,461, 10.7% |
| three or more | 595, 4.4% |
| median unshared share of the perimeter | **11.8%** |
| frontage normal points out of the block | **97.4%** |

11.8% is the right order for a rectangular lot whose short end faces the street -
a 40 x 100 lot's frontage is 14% of its perimeter.

### Against the shipped inference

11,176 lots matched to a shipped rear-yard box in `lots.bin`:

| | new, unshared edge | current, away from the house |
| --- | --- | --- |
| back direction points **into the block** | **96.5%** | **55.5%** |
| directional agreement within a 120 ft cell, median | **0.999** | **0.608** |

The 0.608 reproduces the 0.60 in `2026-09-01 Notes — 02 Does It Pencil`, which is
what validates the metric. The current method is a coin flip; this one is not.

**The two methods disagree by more than 90 degrees on 43.0% of lots, and are
near-exact reversals on 33.5%.** So roughly a third of the drawn cottages are
currently at the wrong end of the lot, which is exactly the front-garden problem
Adam saw. This is not a tuning change. Expect the map to look different.

### Build it

Rewrite the siting step in `data/scripts/pencil.py`:

1. Group Queens lots by MapPLUTO `Block`. **Use every lot in the block, not only
   the one-to-two-family ones** - a shared line needs both sides, and the
   neighbour may be a corner store.
2. Run the sharing test above. Keep the frontage direction and the number of
   unshared edge groups per lot.
3. `back = -frontage`. The rear-yard box is then measured from the back lot line
   inward, as now, but along a direction that is known rather than inferred.
4. **Corner and through lots (15.1% of the sample) need a rule and it is a real
   decision.** A corner lot has two street frontages and, in zoning terms, two
   front yards. Recommendation: take the **longest** unshared run as the front,
   and treat any *other* unshared run as a street line the unit must also set
   back from. Record `frontage_count` per lot so the legend can say how many lots
   were resolved this way, and so the card can say the rule is ours.
5. The 65 lots with no unshared edge are landlocked. Do not site them; count
   them.
6. Keep the building footprint hull. It is still needed for "how far does the
   house already reach toward the back", which is a different question from
   "which way is back". **Do not delete the hull code** - only the direction
   inference it was carrying.

### Two carried-forward items that get cheaper

- **Split the 44,188 unsited lots by cause.** Now that frontage is known
  independently of the footprint, the three causes separate cleanly: no footprint
  on record (a data absence), a building already at the rear lot line (a
  finding), and a centroid outside its own polygon. An hour in the pipeline.
- **Lot coverage against the one-third rule.** Still open, still the item that
  would move the headline number most, still not in this pass. It is in §"What is
  still open".

`lots.bin` gains `frontage_count` as a fourteenth column. While you are changing
the format, do the Uint16 conversion the 09-01 note suggested for the three
rear-box dimensions - nothing here is precise to better than a foot, and the file
is 12.8 MB.

---

## 6. Anthromes

Adam: *"the objective here is to expose the assumptions that make the dataset."*
That is exactly what the classification is - a cascade of about a dozen hard
thresholds applied to six continuous grids. Every threshold becomes a slider, and
the map is the result of the reader's own cascade rather than the published one.

### The classification, verified 2026-09-04

Anthromes 2.1, Ellis, Beusen & Klein Goldewijk 2020, *Land* 9(5):129. The class
codes come from Table 1 of the paper. **The paper does not print the numeric
thresholds** - they are in Figures A1 and A2, which are raster images. The
thresholds below are from the reference R implementation,
`nick-gauthier/anthromes`, branch `master`, `R/anthromes_classify.R`, which is
co-authored by Ellis, Klein Goldewijk and Beusen and is a port of the Python
script the paper cites. Three of its rules are annotated by its own authors as
present in the Python but not in the paper; those annotations must survive into
our code as comments, because they are the seam between the published method and
the executed one.

Every input is divided by land area **before** the cascade. So `pop` is
persons/km² and the five land-use variables are fractions of cell land area, 0 to
1. The 0.2 is 20%.

```
used  = crops + grazing + urban
trees = pot_veg in classes 1..8      (the forest and woodland biomes)
ice   = pot_veg == 15                (Polar Desert, Rock, and Ice)

urban >= 0.2 or pop >= 2500                              -> 11  Urban
pop >= 100 and not pot_vill                              -> 12  Mixed settlements
pop >= 100 and rice >= 0.2                               -> 21  Rice villages
pop >= 100 and irrigation >= 0.2                         -> 22  Irrigated villages
pop >= 100 and crops >= 0.2                              -> 23  Rainfed villages
pop >= 100 and grazing >= 0.2                            -> 24  Pastoral villages
pop >= 100                                               -> 12
crops >= 0.2 and 10 <= pop < 100 and irrigation >= 0.2   -> 31  Residential irrigated croplands
crops >= 0.2 and 10 <= pop < 100                         -> 32  Residential rainfed croplands
crops >= 0.2 and  1 <= pop <  10                         -> 33  Populated croplands
crops >= 0.2 and  0 <  pop <   1                         -> 34  Remote croplands
grazing >= 0.2 and 10 <= pop < 100                       -> 41  Residential rangelands
grazing >= 0.2 and  1 <= pop <  10                       -> 42  Populated rangelands
grazing >= 0.2 and  0 <  pop <   1                       -> 43  Remote rangelands
trees and 10 <= pop < 100                                -> 51  Residential woodlands
trees and  1 <= pop <  10                                -> 52  Populated woodlands
trees and  0 <  pop < 1 and used <  0.2                  -> 53  Remote woodlands
trees and  0 <  pop < 1 and used >= 0.2 and crops>=grazing -> 34
trees and  0 <  pop < 1 and used >= 0.2 and crops< grazing -> 43
pop > 0 and not trees and used <  0.2                    -> 54  Inhabited drylands
pop > 0 and not trees and used >= 0.2 and crops>=grazing -> 34
pop > 0 and not trees and used >= 0.2 and crops< grazing -> 43
used >= 0.2 and crops   >= 0.2                           -> 34   [python only, not in paper]
used >= 0.2 and grazing >= 0.2                           -> 43   [python only, not in paper]
used >= 0.2 and crops >= grazing                         -> 34
used >= 0.2 and crops <  grazing                         -> 43
not ice and trees                                        -> 61  Wild woodlands
not ice and not trees                                    -> 62  Wild drylands
ice and used > 0                                         -> 62   [python only, not in paper]
ice                                                      -> 63  Ice, uninhabited
otherwise                                                -> NA
```

It is a first-match cascade. **Order is load-bearing** - implement it as an
ordered list of predicates, not as a set of independent tests.

### The controls

| control | default | range |
| --- | --- | --- |
| `urban_fraction_threshold` | 0.20 | 0.02 - 0.60 |
| `urban_density` | 2500 | 500 - 10000 |
| `dense_settlement_density` | 100 | 10 - 500 |
| `residential_density` | 10 | 1 - 50 |
| `populated_density` | 1 | 0.1 - 5 |
| `crops_threshold` | 0.20 | 0.02 - 0.60 |
| `grazing_threshold` | 0.20 | 0.02 - 0.60 |
| `rice_threshold` | 0.20 | 0.02 - 0.60 |
| `irrigation_threshold` | 0.20 | 0.02 - 0.60 |
| `used_threshold` | 0.20 | 0.02 - 0.60 |
| `tree_biomes` | 8 | 4 - 12, how many of the 15 PNV classes count as "potentially forested" |
| `year` | 2000AD | the 75 time steps, 10000BC to 2017AD, primary timeline, looping |
| `colour_by` | anthrome | anthrome class / used fraction / population density / disagreement with the published map |

`used_threshold` gets `x-emphasis`. It is the one that moves the crossover year
by millennia and it is the sandbox's headline.

### The data

**33km profile - Adam's choice.** Verified against
`twosides/temp/grid/33km/manifest.json`: `res 0.30`, `ncols 1200`, `nrows 600`,
**`nLand 182503`**.

**75 time steps, 10000BC to 2017AD**, which is what HYDE 3.2 carries: ten
millennia, then 0AD, then centuries to 1600AD, then decades 1700-1990, then every
year 2000-2017. That covers **68 of the 76 display years** the `twosides` grid
profiles were built on. The eight it does not reach - 2018 through 2025 - have no
input grids in any HYDE release we can obtain, and the timeline must say so
rather than ending silently.

Reuse the transport `twosides/processing/2b_generate_grid.py` established: a
manifest, a land bitmask, and one plane per variable per year over land cells
only. That work is done and measured; do not reinvent it. **But note it reads
single-band classified GeoTIFFs, and 3.2's inputs are shaped differently** - see
the reader note below.

Aggregation from native 5 arc-minute to 0.30 degrees is a **land-area-weighted
mean** of each input, computed before classification. Weight by `maxln_cr`, not
by cell count.

| plane | encoding | bytes |
| --- | --- | --- |
| `popc` -> density | Uint8, log-quantised, 75 years | 13.7 MB |
| `cropland` fraction | Uint8, 75 years | 13.7 MB |
| `grazing` fraction | Uint8, 75 years | 13.7 MB |
| `ir_rice`, `tot_irri`, `uopp` fractions | **sparse** - Uint32 index + Uint8 value, nonzero cells only | ~3 MB |
| the 3.2 method at native 5', majority-aggregated | Uint8, 75 years | 13.7 MB |
| the 3.5 published classification, majority-aggregated | Uint8, 76 years | 13.9 MB |
| static: land mask, `potveg15`, `potvill20`, land-area fraction | Uint8 | ~0.8 MB |
| | **total raw** | **~72 MB** |

Serve compressed. These planes are spatially smooth and the three sparse ones are
mostly empty, so expect roughly 22-26 MB over the wire, inside Adam's 50 MB
budget. **Measure it and put the measured number in the manifest** - do not ship
on the estimate. If it comes in over 30 MB served, drop the 3.5 comparison plane
first; it is the least load-bearing of the three.

Sparse encoding for rice, irrigation and urban is not premature optimisation. All
three are zero over most of the world for most of the timeline, and dense planes
for them would add 41 MB of nearly nothing.

### The input format - verified 2026-09-04, read from the file

`raw-data.zip` is **fileId 4570054, 848,188,820 bytes**. Resolve it by *name*
through the Dataverse API, never by size: the sibling `derived-data.zip` is
1,033,494,178 bytes and is the wrong file. `fetch-anthromes-inputs.sh` does this.

```
raw-data.zip
  raw-data/HYDE.zip                    837,671,682
      HYDE/cropland.tif.zip            218,360,490
      HYDE/grazing.tif.zip             261,768,677
      HYDE/popc.tif.zip                337,474,653
      HYDE/uopp.tif.zip                 19,003,891
      HYDE/tot_irri.tif.zip             15,266,095
      HYDE/ir_rice.tif.zip               6,124,193
  raw-data/supporting_5m_grids.zip       2,194,100
      maxln_cr.tif  potveg15.tif  potvill20.tif  iso_cr.tif  simple_regions.tif
      woody20.tif                        (bonus, not used by the cascade)
      potential_vegetation_classes.xlsx  (the 15 PNV class names - use it
                                          rather than hardcoding from the R source)
  raw-data/dgg_ids.csv                  21,563,120   (not needed)
```

**Every one of the six variables is one file holding all 75 time steps**, read
out of the TIFF tags rather than assumed:

| | |
| --- | --- |
| grid | 4320 x 2160, matching HYDE's native 5 arc-minute |
| `SamplesPerPixel` | **75** - one per time step |
| `BitsPerSample` / `SampleFormat` | 32 / 3, so **IEEE float32** |
| `Compression` | **1, none.** The data is raw. |
| `PlanarConfig` | **1, CONTIG** - the 75 samples are interleaved per pixel |
| `RowsPerStrip` | 1, so 2160 strips of 1,296,000 bytes = 4320 x 75 x 4 |
| `StripOffsets` | start at 23,530 and step by exactly 1,296,000 - the image data is contiguous |
| `ModelPixelScale` | 0.0833333 |
| `ModelTiepoint` | -180.0, 89.99992800000001 |

Uncompressed size is 2,799,383,530 bytes per variable, which is 75 x 37,324,800
plus a 23,530-byte header. The five supporting grids are the same 4320 x 2160,
single band, also uncompressed - float32 for `maxln_cr`, `potveg15`, `potvill20`,
int32 for `iso_cr`, 4-bit for `simple_regions`.

That tiepoint is worth a second look: **89.99992800000001 is exactly the
`originY` in `twosides/temp/grid/33km/manifest.json`.** The two grids align
cell-for-cell, so the existing 33km land mask and cell indices carry over without
resampling either side.

### The reader - about forty lines, no dependencies

The earlier draft of this section weighed `tifffile` against `rasterio` against a
hand-rolled reader. **That question is closed: hand-roll it.** These are
uncompressed, contiguous, single-strip-per-row TIFFs, so a reader is a seek to
byte 23,530 and a `numpy` view. No `tifffile`, no `rasterio`, no GDAL, and
nothing new in the repo's dependencies - which keeps `CLAUDE.md`'s no-geo-stack
rule intact for the same reason the shapefile and DBF readers are hand-rolled.

**Never extract these files.** Six variables at 2.8 GB each is 17 GB expanded.
A session on 2026-09-04 filled a 9.8 GB scratch disk doing exactly that and had
to be restarted; do not repeat it. Stream instead:

- Open `raw-data.zip`, then `raw-data/HYDE.zip`, then `HYDE/<var>.tif.zip`, and
  read the inner `.tif` as a **stream**. Only `HYDE.zip` needs to touch disk
  (837 MB), and it can be deleted after the six variables are read.
- Skip the 23,530-byte header, then read **1,296,000 bytes at a time**. That is
  one image row: `np.frombuffer(row, '<f4').reshape(4320, 75)`, giving every time
  step for that row at once.
- Accumulate straight into the 33km grid as you go. All 75 steps are aggregated
  in **one pass per variable**, holding 75 accumulators of 1200 x 600 float32 -
  about 216 MB, plus a matching weight array. Nothing else stays resident.

Because `PlanarConfig` is CONTIG, this row-at-a-time shape is not merely
convenient, it is the only efficient one: a band is not a contiguous block, so
pulling out a single time step alone would mean striding the whole 2.8 GB.
Aggregating all 75 together costs one pass instead of seventy-five.

Weight the aggregation by `maxln_cr` per source cell, and divide by `maxln_cr`
to get densities and fractions **before** the cascade - that is what the
reference implementation does, and it is why `popc` (a count) is the population
input rather than `popd`.

### Three comparison layers, and the gap between them is the point

Our classification runs at 33km. HYDE's runs at 5 arc-minutes. **They will not
agree, and the disagreement is not an error.** Shipping the reference maps
alongside makes it visible, and separates two different causes:

- **ours at 33km** - what the sliders start from and move.
- **the 3.2 method at native 5', majority-aggregated to 33km.** Same data, same
  thresholds, classified before aggregation instead of after. The difference
  between this and ours at default settings is *purely* the resolution effect -
  a picture of what aggregating a threshold rule does to it, and nothing else in
  the course shows that as directly.
- **HYDE 3.5's published classification, majority-aggregated.** Different data,
  eight years longer. The difference between this and the 3.2 reference is the
  *dataset-version* effect.

  **This layer is already built and costs nothing.** Adam cleared the 18.1 GB
  HYDE 3.5 archive once 3.2 was chosen, which was right - it is not needed. The
  aggregated product survives in the sibling repo:

  ```
  twosides/temp/grid/33km/codes.bin        13,870,228 bytes
  twosides/temp/grid/33km/mask.bin             90,000
  twosides/temp/grid/33km/manifest.json         2,225
  ```

  13,870,228 is exactly 182,503 land cells x 76 years, one byte each - the 3.5
  classified series already majority-aggregated to the very grid this sandbox
  uses. Copy those three files into `data/original/anthromes-hyde35-33km/` and
  the version-comparison plane is done. Nothing to re-download and nothing to
  re-aggregate.

  If it ever needs regenerating, `twosides/data/HYDE-3.5/baseline/anthromes_geotiff/`
  still holds all 128 classified GeoTIFFs, 10000BC to 2025AD, in 107 MB - which
  is the whole of what the third layer ever depended on. The 18 GB was inputs,
  and inputs are what 3.5 turned out not to have.

Keeping the two references separate is what makes either legible. Comparing ours
straight against 3.5 would confound resolution with version and the reader would
have no way to tell which they were looking at.

**The required check before any of this ships:** run the cascade at native 5'
with default thresholds on 3.2 inputs and compare the resulting class areas
against the totals published in Ellis et al. 2020. They should match. If they do
not, the cascade is wrong and every slider built on it is wrong. Put the measured
comparison in the manifest.

The card has to say all of this plainly, because a reader who assumes the
defaults reproduce the published map at a glance will read an honest
disagreement as a bug.

### Rendering

Plain canvas, no basemap. The data is the map. Draw the classified grid into an
`ImageData` at 1200 x 600 and scale it onto the display canvas with
`imageSmoothingEnabled = false`. Hover inverts the pixel to a cell index and
reads a tooltip out of the same typed arrays: the six inputs, the potential
vegetation class, our class, the published class, and the first year the cell
changed class. This is the `tractid.png` picking trick from Bathtub, one
dimension simpler because the grid is regular.

Equirectangular, because the grid is already equirectangular and any other
projection costs an inverse per hover. **It badly exaggerates high latitudes,
which matters here because so much of what the classification calls wild is
boreal and tundra.** So: draw equirectangular, but compute every area statistic
with the real per-cell land area from `maxln_cr`. The picture is distorted; the
numbers are not. Say both on the card.

### Metrics

Land area per class; share used against share wild; **the crossover year**, the
first time step at which used land exceeds wild; area reclassified against the
published version; first appearance year per class.

The crossover year needs all 75 years classified, which is 13.7 million
cell-years. Run it in a Web Worker, debounced, and show the previous value greyed
while it recomputes. Do not block the animation on it.

### What it cannot see

Already written in `meta.js` and still right: the sliders move the
classification, but HYDE's **allocation** - how it distributes a national
population estimate across cells - has no slider at all and is the larger
uncertainty. And `potveg15` is a static input from an entirely different model.
There is a model underneath the model with no controls on it.

Two additions. The sandbox classifies **HYDE 3.2**, because 3.5's own
distribution is missing the 2000-2023 input grids - so the timeline stops at
2017AD and the card must say why, naming it as a gap in the published data rather
than a choice. HYDE 3.5 has **no published paper** either, its classification
paper being in preparation, which is the second reason 3.2 is the base. And HYDE publishes **lower and upper population
scenarios** alongside the baseline; Adam already has the classified output for
both in `twosides`. Wiring them in as a fourth control would need the lower and
upper input archives too, roughly tripling the download. **Not in this pass.**
Name it on the card as the uncertainty the sandbox does not let you touch.

---

## 7. Bathtub - the NOAA re-point

**Deadline: 30 September 2026.** The NOAA station 8518750 annual-exceedance-
probability product retires that day, replaced by the integrated *Sea Level
Trends and Extremes* site. The `aep` control and the `exceedanceM` /
`exceedance2026M` values in the manifest are built on it.

Verified 2026-09-04 on the station page itself: *"This site will no longer be
available after September 30, 2026"*, and the product publishes **1%, 10%, 50%
and 99% annual exceedance probability levels** relative to MHHW, MLLW or MSL.

**The datum half of this problem is now solved permanently, and better than a
citation swap.** CO-OPS has a stable machine-readable metadata endpoint that has
nothing to do with the retiring page:

```
https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/8518750/datums.json?units=metric
```

Read 2026-09-04, it returns every datum for The Battery on the 1983-2001 epoch,
accepted 19 Nov 2012, **including NAVD88 = 1.848 m above station datum**:

| datum | m above STND | m above NAVD88 | manifest `tideOffsetsM` |
| --- | ---: | ---: | ---: |
| MHHW | 2.543 | **+0.695** | 0.695 - exact match |
| MSL | 1.785 | -0.063 | -0.061 |
| MLLW | 1.002 | -0.846 | -0.844 |

MHHW matches to the millimetre, which independently confirms the conversion in
`bathtub.py` was done correctly. MSL and MLLW sit 2 mm off, consistently in one
direction - the signature of the figures having been taken in feet and rounded
before conversion (-0.20 ft is -0.061 m; -0.063 m is -0.207 ft). **Two
millimetres is far below the noise floor** of a 10 m DEM with decimetre-scale
vertical error, so nothing in the map moves. Regenerate the three offsets from
the metric endpoint anyway, because a number that can be derived exactly should
not be carried approximately, and record the epoch and acceptance date beside
them.

**The successor was checked on 2026-09-04 and it publishes the same four
levels.** Station 8518750, *Extreme High Water Levels*, read for **October
2025**, in feet above MHHW, converted with the verified +0.695 m offset:

| AEP | ft above MHHW | m above MHHW | **m NAVD88** | shipped `exceedance2026M` | difference |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1% | 5.96 | 1.817 | **2.512** | 2.50 | +12 mm |
| 10% | 3.93 | 1.198 | **1.893** | 1.88 | +13 mm |
| 50% | 2.82 | 0.860 | **1.555** | 1.54 | +15 mm |
| 99% | 2.02 | 0.616 | **1.311** | 1.30 | +11 mm |

**The shipped values imply an MHHW offset of 0.683 m** - spread 3.8 mm across the
four - against the 0.695 m the manifest records for the same datum three keys
away. So the exceedance conversion and `tideOffsetsM` disagree with each other by
about 12 mm. That is an internal inconsistency, not a data problem. Regenerate
the four from the table above. Nothing on the map moves at that scale;
consistency is the whole of the point.

**Two things the successor page makes explicit that the sandbox must now say.**
*"The AEP lines change over time in accordance with the average linear change of
mean sea level"* - so **an AEP level is a function of date**, not a constant. The
manifest's `exceedanceM` and `exceedance2026M` differ by exactly 0.100 m, which
is a round number and reads as applied rather than read off the product. Replace
both with values read for a stated month, and put that month in the manifest.
And the product publishes a **low**-water AEP series too; Bathtub is about
flooding and should ignore it, but the card should say so rather than leave a
reader wondering which half was used.

Citation moves to *NOAA Sea Level Trends and Extremes*,
`tidesandcurrents.noaa.gov/trends-and-extremes/`, station 8518750.

Nothing else in Bathtub changes. It is the reference implementation and it stays
that way.

---

## Build order

Stop after each and check in the browser, not by HTTP status. Every one of the
platform traps in `CLAUDE.md` fails as a clean 200 with a dead page.

1. **Publication flags and renumbering** (§1). No data, no new rendering, and
   everything downstream is easier to evaluate once the list is the real list.
2. **The play pass** (§2). Frame-level, touches all five, and both §3 and §6
   depend on the transport existing. Regenerate covers at the end of this step,
   not before.
3. **Pencil frontage** (§5). Pipeline only, no new download, and the numbers to
   check against are in this document. Largest correction for the least work.
4. **After Five assumption sliders** (§4). Schema and arithmetic, no new data.
   Ship it before the agent layer so the agent layer lands on a model that is
   already right.
5. **After Five agent layer** (§3). The big one. Build the flow curves and the
   occupancy readout first, so there is a counted number to check the animation
   against, then the routing, then the trips.
6. **Anthromes** (§6). Independent of everything else; can run in parallel with
   4 and 5 if there are two hands.
7. **Bathtub re-point** (§7). Ten minutes, but it has a date on it. If 30
   September is close, do it first.

---

## What is still open

1. **Does the ADU have to sit inside the required rear yard?** Unchanged and
   still the item that would move Pencil's headline number most. ZR 23-341
   permits the ADU in the required rear yard as an obstruction; on a deep lot the
   ground between the house and that yard is governed by lot coverage and FAR
   instead. HPD's guidebook and eligibility tool both present the one-third rule
   as *the* cap, so modelling it that way is defensible - but the harsh Queens
   result is still being published on an unchecked reading.
2. **The DEP Interim Flood Risk Area Map.** Still not on disk, adoption of 15
   RCNY 66-01 still unconfirmed, still approximated by the NPCC layers and still
   labelled as an approximation.
3. **Whether DEP's "moderate" 2.13 in/hr is the 10-year storm.** Unverified. Do
   not assert it without the Stormwater Resiliency Plan.
4. **`buildings.bin` was migrated, not regenerated.** The CityGML source is back
   on disk. Re-run `after-five.py` end to end and diff against the shipped
   payload. This closes the item outright and should happen before the December
   freeze.
5. **Which zip in E3H3AK is `raw-data.zip`** - only needed if IB4VCI turns out
   not to carry the supporting grids.
6. **The current LION quarter.** 26b is confirmed as of 2026-05-26; 26c may be
   out. Only matters if CSCL is rejected for some reason.
7. **The prose voice pass.** Deferred by Adam, deliberately. Every file written
   in this pass keeps its `PROSE DRAFT` header. `utilities/writing-style-guide.md`
   now exists in the vault, so the pass is unblocked whenever it is wanted.
8. **HYDE lower and upper scenarios** as an Anthromes control (§6).
