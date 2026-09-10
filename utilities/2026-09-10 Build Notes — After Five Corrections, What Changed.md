---
title: "Build Notes — After Five Corrections, What Changed"
date: 2026-09-10
type: build-notes
---

# Build Notes — After Five Corrections, What Changed

What came out of `2026-09-10 Build Doc — After Five Corrections.md`. Everything in
§2, §3 and §4 of that document is built. The tree is dirty and nothing is committed.

**Amended 2026-09-10, later the same day.** `2026-09-10 Build Doc — After Five
Corrections, Amendment.md` has since been run too. **§10 below is the current state of
every number in this file** — the massing cap, the 15 m buffer and the `ComArea` fix all
moved figures quoted in §2 through §6. Read §10 before quoting anything above it.

Three things in the doc did not survive contact with the data, and they are §5, §6
and §7 below. Read those before believing a number in the build doc.

## 1. Files changed

```
data/scripts/after-five.py                  §3.1 volume split, §3.3 lot share on
                                            footprints.json, write_grid call, manifest note
data/scripts/afterfive_day.py               §3.2 street mask, widening and fallback
src/lib/sandboxes/after-five/schema.json     §2 the scenario gate
src/lib/sandboxes/after-five/AfterFive.svelte §3.3 the per-building readout
src/lib/sandboxes/after-five/card.md          §4  PROSE DRAFT
src/lib/sandboxes/after-five/meta.js          §4  PROSE DRAFT
src/content/tutorials/02-after-five.md        §4  PROSE DRAFT
data/processed/after-five/*                  rebuilt
static/covers/after-five.png                 regenerated
```

The three prose files carry the PROSE DRAFT marker on their first line. `card.md`'s is
stripped by `cards.js` before rendering, which was already true; `meta.js` carries it as
a JS comment because an HTML comment would not parse.

## 2. What passed

- `python3 data/scripts/checks/preflight.py` — 0 blocking, 0 advisory.
- `npm run build` — clean.
- `npm run audit:freeze` — clean.
- `npm run covers` — regenerated; the after-five cover still shows the district and the
  heat now reads as streets rather than a wash over the whole district.
- The page loads and hydrates with **no console errors**, `data-cover-ready` fires, and
  the metrics strip reports 142 of 381 converted at the default.
- `assessor_distressed` survives nowhere under `src/`, `data/` or `static/`. It is left
  in the two build docs in `utilities/`, which are the record of the decision.

Checked in a real browser, not by HTTP status:

- Selecting "a program that reaches everything" moves the threshold slider to 0.30 and
  the metrics to 204 of 381.
- Moving the threshold slider by hand writes `scenario` to `custom`.
- Selecting the Comptroller stop puts the threshold back to 0.50 and the metrics to 142.
- The building readout works, including the shared-lot line. Hovering 1 WTC gives
  7,057,834 sf of office, convertibility 0.25, 17,951 office jobs, and "shares a lot with
  4 other buildings; it carries 98.5% of the lot's floor area".

## 3. The numbers that matched the doc exactly

- 381 office buildings in CD1; score quantiles 0.26 / 0.33 / 0.49 / 0.65 / 0.77 / 0.83.
- 609,412 cells not inside a footprint, under the old mask.
- The tower on BBL 1000580001: 220 cells and 3,646 jobs before, 17,951 jobs after.
- The WTC lot's volume shares: **98.5% / 1.2% / 0.2% / 0.1% / 0.0%**.
- **7,413** walkable CSCL lines inside the grid.
- **18** buildings with no street cell within 50 m (15 found one on a widened reach, 3
  fell back to the not-a-building mask, 0 were left empty).

## 4. Conservation — the test that catches a broken normalization

Run before and after, at the default scenario, CD1. The 24 hourly totals summed over the
day against twice the district's people, per channel:

| | day sum | 2 x people | ratio |
|---|---|---|---|
| office, before | 337,513 | 337,513 | 1.0000 |
| residential, before | 129,629 | 129,629 | 1.0000 |
| office, after | 341,323 | 341,323 | 1.0000 |
| residential, after | 127,020 | 127,020 | 1.0000 |

Exact in both channels, before and after. The per-building normalization to 1 was not
touched, and no building was left with an empty CSR row.

## 5. The ramp has NOT been swallowed — but check the peaks yourself

The doc asks for the decile distribution of positive cell values before and after, and
says to stop rather than adjust the ramp if the top end has eaten the map. It has not.

Deciles of positive cell values, activity, all 24 hours, CD1 at the default:

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| before | 0.01 | 0.05 | 0.11 | 0.21 | 0.37 | 0.60 | 0.98 | 1.65 | 3.03 | 30.00 |
| after | 0.02 | 0.07 | 0.17 | 0.33 | 0.57 | 0.92 | 1.48 | 2.44 | 4.38 | 129.79 |

The whole distribution moved up by about half again, which is what a mask a quarter the
size does. The p98 the ramp normalizes against moved with it, 6.80 to 10.43. **The share
of cell-hours clipping at the top of the ramp went DOWN, 2.12% to 1.79%.** So the map has
more contrast than it had, not less, and `percentile98` is left alone as the doc asks.

The one genuinely extreme value is 1 WTC, and the cover confirms by eye that it is a
bright block on a legible map rather than a blob that has eaten the district.

## 6. §3.4's peak table could not be reproduced, and the doc's §2.4 counts were measured with 467-m OFF

Two separate measurement disagreements. Neither is a fault in the change; both mean a
number in the build doc should not be quoted as-is.

**The 467-m eligibility gate.** §2.4 gives the acceptance as 0 / 2 / 274 / 348 and §2.2
gives a threshold ladder of 374 / 348 / 323 / 274 / 228. Those are exactly right with
`incentive_467m` **false**. The schema's default for that control is **true**, and at the
actual defaults the four scenarios give:

| scenario | doc (467-m off) | actual default (467-m on) | homes |
|---|---|---|---|
| `asking_2024` | 0 | **0** | 0 |
| `downtown_b_2026` | 2 | **1** | 26 |
| `comptroller_2025` | 274 | **142** | 9,492 |
| `maximum_incentive` | 348 | **204** | 35,960 |

The doc's ladder is really a count of buildings clearing the *convertibility threshold*,
before the eligibility gate. Every structural claim in §1.1 holds either way: the old
third and fourth scenarios produced byte-identical conversion sets with the gate on and
with it off. The prose in `meta.js` and the dev note quotes the 467-m-on numbers, since
those are what a reader sees.

**The peak ratios.** §3.4 predicts 1 WTC at 505% of p98 and the Oculus at 31. I measure
1 WTC at 1071% and the Oculus at 4.1, at hour 8 with the default scenario. The direction
and the mechanism match the doc exactly — 1 WTC rises hard, the Oculus falls by about
70%, and the tower's jobs land on the doc's 17,951 to the digit — but the absolute
ratios do not, so the peak-finding or the hour behind that table is not the one I used.
Do not treat 505% as a target.

## 7. The 12 m stamp is a disc in CELL INDICES, and that is what the doc's counts encode

The doc gives the rasterization two ways: "within 12 m of a walkable street centerline",
and "stamp a disc of radius 1.2 cells". Those are not the same rule, and they give
different masks. Both were built and measured against the doc's own two figures:

| reading | cells at 12 m | cells at 15 m |
|---|---|---|
| geometric — cell center within 12 m of the line | 118,611 | 141,190 |
| index — disc of radius `buffer / cell` in cell indices | **139,284** | **164,446** |
| the doc's figures | 137,940 | 163,324 |

The index reading is the one the doc's numbers came from, so it is the one in the file.
The remaining 1% closed when the street reader was clipped to the grid's own box rather
than a padded one, which also brought the line count to the doc's 7,413 exactly. The
shipped mask is **139,269** cells, 21.9% of the grid, against 609,412 before. Cells per
building: median **51**, against 74 before.

What this means for the prose: the band is 12 m *nominal*. A street running down the
middle of a cell reaches 12 m either side; one running near a cell edge reaches most of a
cell further. `stamp_streets` says so in its docstring. The card and the dev note both
say 12 m flat, which is the right altitude for them, but it is worth knowing that the
real figure is 12 m and a bit.

## 8. One thing built that the doc did not specify

§3.3 asks the readout to say "if it stands on a lot with other buildings, that its floor
area is a share of the lot's, and what share". Nothing shipped carried that, and widening
`buildings.bin` from 18 columns to 19 would have touched `STRIDE` and every consumer of
it. Instead `footprints.json` gained two optional keys, `n` and `s`, on the 558 buildings
of 3,728 that sit on a shared lot — the arrays are already parallel by index, so this
costs no extra fetch and no stride change. Buildings on their own lot carry neither key.

## 9. Left alone, as the doc asks

`percentile98`. The Gaussian sigma of 25 m. The 50 m reach. The per-building
normalization to 1. `STREET_BUFFER_M` stays at 12.0 — the 15 m sensitivity is in §7 above
and in the docstring, and changing the default is Adam's call.

---

# 10. The amendment run, 2026-09-10

What came out of `2026-09-10 Build Doc — After Five Corrections, Amendment.md`. Every
number in §2 through §7 above is superseded by this section. Nothing above was reverted.

## 10.1 Files the amendment touched

```
src/lib/sandboxes/after-five/gates.js       §4  the ComArea double-count
data/scripts/after-five.py                  §2.1 the massing cap, CAP_TOLERANCE,
                                            massing_cap in the manifest, `c` on footprints
data/scripts/checks/preflight.py            §2.2 the new cap check
data/scripts/afterfive_day.py               §3  STREET_BUFFER_M 12.0 -> 15.0
src/lib/sandboxes/after-five/AfterFive.svelte  the readout says when a share is a ceiling
card.md / meta.js / 02-after-five.md        §7.5 prose, all PROSE DRAFT
```

## 10.2 §4, the `ComArea` double-count — confirmed to the digit

`ComArea >= OfficeArea` on **all 1,818** office buildings, and **1,620** came out with a
non-residential share above 1.0. The 467-m gate passed **1,641** office buildings as
coded and passes **1,578** with `1 - ResArea / BldgArea`. Sixty-three, exactly as the
amendment says. No other sandbox does the same sum — `after-five` is the only place
`ComArea` is read at all.

## 10.3 §2.1, the cap — every expected figure matched

| | expected | measured |
|---|---|---|
| buildings capped | 117 of 3,728 | **117 of 3,728** |
| `BldgArea` removed | 8.90M of 393.11M (2.3%) | **8.90M of 393.11M (2.3%)** |
| `OfficeArea` removed | 3.16M of 263.43M (1.2%) | **3.16M of 263.43M (1.2%)** |
| CD1 office | 78.1M → 75.4M (96.5% kept) | **78.1M → 75.4M (96.5%)** |
| CD5 office | 185.3M → 184.9M (99.8% kept) | **185.3M → 184.9M (99.8%)** |
| 1 WTC `BldgArea` | 8.83M → 5.48M, k = 0.621 | **8.83M → 5.48M, k = 0.621** |
| 1 WTC office | 7.06M → 4.38M | **7.06M → 4.38M** |
| 1 WTC lot share | 98.5% → 61% | **98.5% → 61.1%** |
| 1 WTC jobs | ~11,300 | **11,541** |

**One thing the amendment did not spell out: the cap needs the 5% tolerance to give 117.**
Firing it on *any* overshoot caps **147** buildings and removes 8.95M / 3.18M sf. Firing
it only past 5% caps exactly **117** and removes exactly 8.90M / 3.16M. So the cap uses
the same 5% margin §2.2 gives the preflight check, which is also what makes the two agree
by construction. It is `CAP_TOLERANCE` in `after-five.py`. Thirty buildings sit between
0 and 5% over their ceiling and are left alone; `NumFloors` is a lot-level integer and
the footprint is a 2014 survey polygon, so that margin is inside the noise of the rule.

1 WTC's console line, for the record: implied **168 floors** against the lot's **104**.

## 10.4 §2.2, the preflight check

**Scoped to shared lots**, which is where the cap applies. Run unscoped it fails at 30
buildings, all on *single*-building lots, worst at 30.5x its ceiling — those are buildings
assigned their lot's whole area by definition, where PLUTO's `NumFloors` disagrees with a
2014 survey footprint. That is a disagreement between two datasets, not the concentration
this check exists to catch, and the amendment's own §2.1 says single-building lots are out
of scope. Scoped: `0 of 558 shared-lot buildings over footprint x NumFloors + 5%`.

## 10.5 §3, the 15 m buffer

Mask **139,269 → 164,427** cells, 21.9% → 25.9% of the grid; the amendment said "about
164,000". Building-cell pairs 205,943 → **227,437**; cells per building median 51 → **56**.
Index-space disc kept, as instructed. No CSR row empty: **3,711** buildings found street
cells at 50 m, **14** needed a widened reach, **3** fell back, **0** empty.

## 10.6 §5, the scenario table, recomputed

After the cap and the `ComArea` fix. CD1, default weights.

| stop | threshold | 467-m off | **467-m on (the default)** | homes |
|---|---|---|---|---|
| `asking_2024` | 0.50 | 0 | **0** | 0 |
| `downtown_b_2026` | 0.50 | 2 | **1** | 26 |
| `comptroller_2025` | 0.50 | 276 | **137** | 9,439 |
| `maximum_incentive` | 0.30 | 347 | **199** | 35,907 |

The 467-m-off column reproduces the amendment's table exactly. The on column moved from
0 / 1 / 142 / 204 because the cap took floor area off and the `ComArea` fix tightened the
gate. `meta.js` and the dev note quote the on column.

## 10.7 §6, conservation — still exact

| | day sum | 2 x people | ratio |
|---|---|---|---|
| office | 339,645 | 339,645 | 1.0000 |
| residential | 118,467 | 118,467 | 1.0000 |

## 10.8 The ramp — and why the clipping test cannot answer the question

The amendment says to stop and say so if the clipping share rises. **It rose, 1.79% →
1.83%.** Saying so, with the reason it means nothing:

**The clipping share is defined against p98, so it is pinned near 2% whatever the
distribution does.** `percentile98` returns the 98th percentile of the positive values,
and the test then counts positive values at or above it. That is 2% by construction; the
three readings 2.12%, 1.79% and 1.83% are sampling noise in `percentile98`'s stride, not
signal. It cannot fall, and it could not have detected the top end swallowing the map
either.

The measures that do answer it, none of them defined against p98:

| | before the first doc | after the first doc | **after the amendment** |
|---|---|---|---|
| deciles 1-9 | 0.01 … 3.03 | 0.02 … 4.38 | **0.02 … 3.88** |
| max | 30.00 | 129.79 | **72.07** |
| p98 | 6.80 | 10.43 | **9.48** |
| **max / p98** | 4.4 | 12.4 | **7.6** |
| 1 WTC peak / p98 | 104% | 1071% | **632%** |

**The amendment did what it predicted: concentration fell 39% from the first doc's state**
(max/p98 12.4 → 7.6), and 1 WTC's peak fell from 1071% to 632% of p98. The cap and the
wider buffer both pulled the top down. `percentile98` untouched.

For completeness, the two measures that are not scale-invariant: the top 1% of cell-hours
holds 12.9% of all activity now against 10.9% at the original baseline, and the top 0.1%
holds 2.9% against 1.7%. Both are *up* on the original — which is correct and is the
point of the whole exercise. The original spread every tower's crowd over the plaza and
the river; concentrating it onto streets is the change.

## 10.9 The peak ratio, with its denominator named

**632%** is: the largest single cell value within 70 m of (-74.01337, 40.71272) at 08:00
in the activity view, over the 98th percentile of `office + residential` across every
positive cell and all 24 hours, at `comptroller_2025` with `incentive_467m` on. That is
the same denominator as the Build Notes' 1071% and not the same as the amendment's 505%,
which §5 of the amendment says is the office channel before the hourly curve. Neither is
a target.

## 10.10 Verified in a browser again

No console errors. `data-cover-ready` fires. Metrics read **137 of 381**, 9,439 homes.
The readout on a capped shared-lot building reads "shares a lot with 4 other buildings; it
carries 9.5% of the lot's floor area" then "that share is a ceiling - the survey is
missing buildings on this lot". `npm run covers` regenerated four covers; the three that
are not after-five were reverted.

## 10.11 What was NOT done, per §0 of the amendment

No redistribution of the capped floor area. No completion of the massing from BUILDING or
anything else. No second class of walkable ground, no plazas, no parks — the memorial
plaza is 47-99 m from the nearest walkable centerline and stays outside the model's
ground, and `card.md`, `meta.js` and the dev note each say so in a flat sentence. No
tuning of `percentile98`, the 50 m reach or the 25 m sigma.
