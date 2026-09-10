---
title: Build Doc — After Five Corrections, Amendment
date: 2026-09-10
type: build-doc
---

# Build Doc — After Five Corrections, Amendment

For Claude Code, on Opus. Repo `smt-fa2026`, sandbox `after-five`. Written 2026-09-10 after
the first build doc was run, from what Adam found in the result and what checking it turned
up. Amends `2026-09-10 Build Doc — After Five Corrections.md`; where they disagree, this one
wins. Everything already built stands — nothing here is a revert.

Read `2026-09-10 Build Notes — After Five Corrections, What Changed.md` first. Its three
corrections are all confirmed and §D below folds them into the record.

Same rules as the first doc: never commit or push, never invent data, American English, flat
register, static data only, PROSE DRAFT on every prose file, `preflight.py` is the gate, kill
any dev server.

## 0. What this amendment is not

Adam's framing, 09-10: the changes here are small tweaks, and the limitations underneath them
are not defects to be engineered away. A simple simulation is inconvenient in specific places,
and the work is to name where, not to keep chasing it. So:

- The cap in §2.1 is a ceiling on an error, not a correction of it. Do not follow it with a
  scheme to redistribute the removed floor area, estimate the missing buildings, or reconcile
  1 WTC to a published headcount.
- Do not complete the massing from BUILDING, or from any other source. Adam declined it.
- Do not add plazas, parks or any second class of walkable ground. The model's ground is
  streets; the memorial plaza is outside it and stays outside it.
- Do not tune `percentile98`, the 50 m reach or the 25 m sigma to make a particular place look
  right.

Where one of these bites, the deliverable is a flat sentence in `card.md`, `meta.js` or the dev
note saying what the model cannot place and where. If you find yourself designing a mechanism
to make a limitation invisible, stop and write it down instead.

## 1. What Adam saw, and what it actually was

The complaint was that the WTC complex gets nothing. Measured against the rebuilt data:

- **1 WTC is the hottest thing in the district.** 7.06M sf office, 17,951 jobs, 51 cells,
  weights summing to 1.0000, hottest cell 592 against an office-channel p98 of 121 — 488%.
  The red band on West Street and Vesey in the screenshot is 1 WTC. Its cells sit 66-114 m
  from the tower's centroid, because the footprint is about 70 m across and the 50 m reach
  measures from the edge, so its crowd lands on the bounding streets and none of it on the
  plaza side. This is working.
- **What reads as empty is the superblock interior**, for two reasons that are both the spec
  behaving as written. The plaza is not a street: CSCL has 19 walkable lines inside the block
  but the pool centers are 47-99 m from the nearest vertex, so nothing falls in the band. And
  the buildings standing on the plaza — the Oculus, the museum — now correctly carry no
  office area, where under the equal split they each carried a fifth of an office lot.

So the render is not broken. What is broken is upstream, in §2.

## 2. The volume split concentrates onto an incomplete massing

**The fault.** The first doc had the lot's floor area divided by volume across the buildings
the CityGML contains. It never checked whether those are all the buildings on the lot.

PLUTO gives BBL 1000580001 (185 Greenwich) `NumBldgs = 9`, and the city's own
`data/original/BUILDING_20260830.geojson` lists all nine:

| bin | height_roof | |
|---|---|---|
| 1088469 | 1,408 ft | 1 WTC |
| 1088797 | 1,064 ft | 3 WTC |
| 1088795 | 978 ft | 4 WTC |
| 1090954 | 140 ft | 2023, the Perelman Center |
| 1089309 | 108 ft | the Oculus |
| 1088798 / 1089308 / 1088802 / 1088803 | 26-78 ft | |

The CityGML — a 2014-vintage survey — supplies five: the tower and four small structures. So
1 WTC absorbs the floor area of 3 WTC, 4 WTC and the Oculus, and comes out at 98.5% of the
lot: 7.06M sf of office and 17,951 jobs, against a real headcount nearer 8,000-10,000. The
equal split hid this by dilution. The volume split concentrates it.

Compounding it: the CityGML gives 1 WTC a height of 1,761.6 ft, which is the spire.
`height_roof` in BUILDING is 1,408. The volume weight is inflated a further 25% by a mast.

**Scope.** 52 office buildings are assigned more floors than their lot's PLUTO `NumFloors`,
carrying 11.78M sf, 4.5% of district office area. 1 WTC is 1.61 times over; every other one
is at most 1.12. This is one lot, not a systemic failure of the volume split.

**Adam's decision, 09-10: cap, do not rebuild the massing.** Completing the massing from
BUILDING was the other option and he declined it — LOD-1 boxes beside LOD-2 CityGML meshes,
and it moves the district's massing under every sandbox view.

### 2.1 The cap

In `data/scripts/after-five.py` §4, after `share` is computed by volume and the area columns
are assigned:

- `cap = footprint_area * NumFloors`. `NumFloors` is already read as `num("NumFloors")` and
  is a lot-level value, so the cap is the floor area the building's own ground outline could
  hold at the lot's stated floor count. It is a ceiling, not an estimate, and it is generous
  for a short building on a lot with a tower.
- If the assigned `BldgArea` exceeds `cap` and `cap > 0`, take `k = cap / assigned_BldgArea`
  and multiply **all four** area columns — `BldgArea`, `OfficeArea`, `ResArea`, `ComArea` —
  by `k`. A uniform `k` leaves the ratios between them unchanged, which matters because the
  467-m test in `gates.js` reads a ratio of them.
- **The removed area is not redistributed.** There is nowhere honest to put it: the other
  buildings on the WTC lot are canopies with tiny caps of their own. It is floor area the
  massing cannot place, and the model should say so rather than move it somewhere convenient.
- Skip lots with a single building; `share` is 1.0 there and the cap would only fire on a
  PLUTO inconsistency, which is not this fix's job.

Record what the cap removed, per district, in `manifest.json` under a new `massing_cap` key:
buildings capped, `BldgArea` removed, `OfficeArea` removed, and a note saying this is floor
area PLUTO puts on a lot whose massing does not contain every building the lot has. Print the
ten largest to the console with their implied floors and their lot's `NumFloors`.

Update `footprints.json`'s `s` so the tooltip's lot share is the share after the cap, not
before. Where a building was capped, add `"c": true` so the tooltip can say the share is a
ceiling.

**Expected, exactly:**

- 117 buildings capped of 3,728.
- `BldgArea` removed 8.90M sf of 393.11M (2.3%). `OfficeArea` removed 3.16M sf of 263.43M
  (1.2%).
- CD1 office 78.1M → 75.4M sf (96.5% kept). CD5 185.3M → 184.9M (99.8% kept).
- 1 WTC: office 7.06M → 4.38M sf, `BldgArea` 8.83M → 5.48M, `k = 0.621`, jobs about 17,951 →
  11,300. Its lot share goes from 98.5% to 61%.

**The cap bounds the error, it does not remove it,** and the prose must not pretend otherwise.
1 WTC's real gross floor area is nearer 3.5M sf; the remaining 39% of the lot belongs to
3 WTC, 4 WTC and the Oculus, which the 2014 CityGML does not contain. Say this in `card.md`
under "What it can't see", in one flat sentence naming the WTC lot as the case where it bites.

### 2.2 A preflight check

Add to `data/scripts/checks/preflight.py`: no building's `BldgArea` may exceed its footprint
times its lot's `NumFloors` by more than 5%. It should pass at 0 after §2.1 and fail loudly if
a future pipeline change reintroduces the concentration.

## 3. The street buffer goes to 15 m

Adam's call, 09-10. `STREET_BUFFER_M = 12.0` becomes `15.0` in `afterfive_day.py`.

Expected: the mask goes from 139,269 cells to about 164,000, up 18%. Keep the index-space disc
you built and the docstring that says the band is nominal — do not switch to the geometric
reading now, the two differ and the shipped number should stay one thing.

**It does not reach the memorial plaza,** and the prose must not imply it does: the pools are
47-99 m from the nearest walkable centerline, far outside any buffer worth having. What 15 m
does is widen ordinary streets, which spreads each building's people over more pavement and
takes some heat out of the peaks — including 1 WTC's, which together with the cap is the
point. The plaza stays outside the model's ground, and `card.md` says so in the sentence it
already has about the 12 m band; change the number and leave the honesty.

## 4. A separate bug: `ComArea` already contains `OfficeArea`

Found while checking the cap. Not part of anything above, and it predates both docs.

`qualifies467m` in `src/lib/sandboxes/after-five/gates.js` computes the non-residential share
as `(OFFICE_AREA + COM_AREA) / BLDG_AREA`. In MapPLUTO, `ComArea` is total commercial floor
area and **includes** `OfficeArea`, so that sum double-counts every office building.

Evidence in the shipped data: `ComArea >= OfficeArea` on all 1,818 office buildings, and
1,620 of them come out with a non-residential share above 1.0, which is impossible.

The effect is that the 467-m eligibility gate is too easy: 1,641 office buildings pass as
coded, against 1,578 using `1 - ResArea / BldgArea`. Sixty-three buildings qualify that
should not.

Fix it as `1 - ResArea / BldgArea`, which is what the rule means — the share of the building
that is not residential — and does not depend on how PLUTO nests its commercial categories.
Put a comment above it recording that `ComArea` includes `OfficeArea` and that adding them was
the bug, so it does not come back. Check `pencil` and any other sandbox for the same sum
before finishing.

## 5. Correcting the first doc's numbers

The Build Notes are right on all three counts and these supersede §2.4 and §3.4 of the first
doc.

**467-m.** `incentive_467m` defaults to true and the first doc's counts were measured with it
off. What the ladder in §2.2 of the first doc actually counts is buildings clearing the
convertibility threshold, before eligibility. Confirmed here against the rebuilt data:

| stop | threshold | 467-m off | **467-m on (the default)** |
|---|---|---|---|
| `asking_2024` | 0.50 | 0 | **0** |
| `downtown_b_2026` | 0.50 | 2 | **1** |
| `comptroller_2025` | 0.50 | 276 | **142** |
| `maximum_incentive` | 0.30 | 347 | **204** |

Use the 467-m-on column as the acceptance target from now on. These will move again after §2.1
and §4 — recompute and record them, do not hold them fixed.

The identical-map diagnosis in §1.1 of the first doc is unaffected. The old third and fourth
stops produced byte-identical conversion sets with the gate both on and off, which the Build
Notes confirmed independently.

**The peak ratios.** §3.4's 505% and the Build Notes' 1071% are both right and measure
different things: 505% is the office channel before the hourly curve, 1071% is after it, and
the p98 is taken over a different population in each. Neither is a target. Report the ratio
after §2.1 and §3 with the denominator named.

**The 12 m stamp.** Two readings, geometric and index-space, differing by about 17%. The
index version is the one built and the one the doc's cell counts encode. Keep it.

## 6. Acceptance

- 117 buildings capped; the removal figures in §2.1 to the digit.
- 1 WTC at 61% of its lot, office 4.38M sf, about 11,300 jobs.
- Preflight's new check passes at 0.
- Street mask about 164,000 cells; no CSR row empty; the widen-then-fall-back counts printed.
- 467-m non-residential test passes 1,578 office buildings, not 1,641.
- Conservation still exact: the 24-hour channel totals still equal people times two, both
  channels, as they did before.
- The ramp still has not been swallowed: print the deciles and the clipping share again and
  compare to the Build Notes' figures (deciles 0.02 … 4.38, p98 10.43, clipping 1.79%). The
  cap should pull the top down and the wider buffer should pull it down further. If clipping
  rises instead, stop and say so.
- `npm run covers` regenerates after-five only. Revert any other cover it touches, as you did.

## 7. Order

1. §4, the `ComArea` fix. Independent of everything else and one line.
2. §2.1, the cap, then §2.2, the preflight check.
3. §3, the buffer.
4. Recompute §5's table and §6's numbers and write them into the Build Notes.
5. Prose: `card.md` (the cap's limit, the WTC lot named, the 15 m band), `meta.js`
   (`data[]` on the lot split, `cannotSee` on the unplaced floor area), the dev note's
   Roadblocks and Limitations. All PROSE DRAFT.

Report what changed and leave the tree dirty.
