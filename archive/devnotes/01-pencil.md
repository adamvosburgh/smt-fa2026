---
title: "ADU Forecast for Queens dev notes"
date: "2026-08-31"
author: Adam Vosburgh
sequence: 1
cat: tutorial
devnotes: true
published: false
---

<!-- THIS IS A DRAFT FROM AN EARLIER ITERATION. NOT VERIFIED TO BE DESCRIPTIVE OF THE CURRENT STATE OF ANY SANDBOX -->

Notes from building the [ADU Forecast for Queens](/sandboxes/pencil/) sandbox. Pipeline: `data/scripts/pencil.py`. Component: `src/lib/sandboxes/pencil/`.

![the sandbox at its defaults](/covers/pencil.png#img-full)

<div class="gap">

**What a rebuild won't have.** The sandbox runs all 246,921 lots and recomputes them on every slider move. A rebuild should start with one community district (about 8,000 lots); the code is the same.

</div>

## The ambition

The city publishes a lot of material on accessory dwelling units: a plan library, a budgeting tool, a loan-and-grant term sheet, a guide to where they're allowed. Nothing public says what it adds up to. The idea was to take the assumptions in those materials and turn them into a forecast: apply the published numbers to every one-to-two-family lot in a borough and count where the arithmetic works. It's an experiment with the city's own figures, not a prediction of what homeowners will do.

The 09-08 rebuild dropped the permitting queue and the year slider. What was left is a question with a shape: how many homes could the program add, and where? Three tests answer it - allowed under the rules, room for a unit, works for the owner - and each one removes lots the next never sees. The count that comes out is an upper bound and says so.

## The parts

- **MapPLUTO 26v2** (tax lots; only the `.dbf` table is read). Gives the 246,921 one-to-two-family lots, lot width and depth, the assessor's building type, zoning district, transit zone, historic district, ZIP and tract.
- **Zoning Resolution 23-341(b)(4), 23-342, 12-10.** Gives the unit's size: a third of the required rear yard, whose depth depends on building type, capped at 800 sf, one story, 15 ft.
- **HPD/HCR Plus One ADU term sheet.** Gives the loan ceiling ($220,000), grant ($175,000), rate (5%), term (180 months), rent cap (100% AMI) and the $200 monthly cushion. Each is a slider.
- **HPD Pre-Approved Plan Library.** Gives construction cost: the median of eleven designs' cost midpoints, $603/sf.

![HPD plan library cost ranges](/tutorials/images/01/plan-library-cost.png#img-full)

- **HPD ADU Budgeting Tool.** Gives soft cost, $50,000 + 48% of hard cost, recovered by moving one input at a time.
- **HUD Small Area FMR FY2026** by ZIP. Gives market rent, $2,260 to $3,570 a month across Queens.
- **HUD FY2026 Income Limits**, New York, NY HUD Metro FMR Area. Gives the rent cap, $3,181 a month, one figure for eight counties.

![rent cap against market rent](/tutorials/images/01/rent-cap-vs-market.png#img-full)

- **Census ACS 5-year 2023.** Gives median household income by tract, for reporting where units land.
- **NPCC 2050s and 2080s floodplains** (NYC Open Data `27ya-gqtm`, `ek8y-fsqz`). Stand in for DEP's flood risk areas, which we couldn't obtain.
- **MapPLUTO geometry and NYC Building Footprints.** Used only for drawing: where on the lot the unit stands.
- **MapPLUTO `UnitsRes`, summed per tract over every lot, all building classes.** Gives the denominator of the tract view's share of existing homes.
- **NYC 2020 census tract boundaries**, filtered out of the flood map sandbox's own output rather than refetched. Gives the tract choropleth its outlines.
- **NYC Borough Boundaries** (NYC Open Data `gthc-hcne`), simplified to 1,104 vertices from 36,089. Gives the mask that fades everything outside Queens to a quarter.

![the rear yard rule](/tutorials/images/01/rear-yard-rule.svg#img-full)

## Roadblocks

- The first version applied the one-third rule to the whole open lot instead of the required rear yard; correcting it moved the median unit from 707 sf to 333 and the lots pinned at the 800 sf cap from 109,032 to 384.
- The `.dbf` has no shape, so the first map drew every unit at the lot centroid, on top of the house; placing it needed the shapefile and the building footprints.
- Which side of a lot faces the street isn't recorded; assuming the back was away from the house was right 55.5% of the time, and taking the unshared lot edge as the street is right 96.5% of the time (500 sampled blocks).
- Only about a third of lots that pass the area test have room behind the house for a rectangle at the plan library's proportions with 5 ft setbacks; they still count as passing and the panel counts them separately.
- HPD's budgeting tool shows cost inputs totalling 28% of hard cost plus $50,000 but computes 48% plus $50,000; the 20% it never displays is probably contractor overhead and profit.
- "Expanded flood area" is not a term in the Zoning Resolution; the real bans are DEP's rainfall and coastal flood risk areas, whose map we couldn't download, so the NPCC layers it's built from stand in.
- No City of Yes ADU eligibility layer exists on NYC Open Data; the flags are derived from DCP's published rules.
- Every control changes the arithmetic rather than the data, so nothing can be precomputed; the browser ships nine numbers per lot (about 9 MB) and redoes all 246,921 in about 140 ms.
- The build doc named `tqmj-j8zm` for the borough boundaries. That dataset does not exist on NYC Open Data - the resource and the geospatial export endpoints both answer `dataset.missing`. The catalog gives `gthc-hcne` for a layer called Borough Boundaries, five features with `borocode` and `boroname`, and that is what `data/scripts/fetch-sources-0908.sh` fetches; the script says so at the top.
- The textbook Visvalingam simplifier removes one vertex at a time and recomputes its neighbors, which is quadratic without a heap. On a 36,089-vertex borough outline that does not finish; the version here bisects for a threshold area and sweeps once, which lands within a few vertices of the target in 0.3 seconds.
- **The setback fit is now part of test 2.** It used to be reported beside the count - "only about a third still pass" - which meant the headline number counted lots with nowhere to put the building. At the published terms **22,333** allowed lots clear the one-third area rule - the figure the sandbox reported before - and **6,675** of them also fit a unit at the plan library's proportions behind the house after the setbacks. That second number is what the sandbox now calls "room for a unit", and both are printed on the map.

## What came out

A borough-wide count of homes the program could add, in three views: by tract, lot by lot for one test at a time, and the units themselves standing behind the houses.

### What you should see

The lot view at the third test, at the published terms:

<div data-sandbox="pencil" data-mode="view" data-params='{"view":"lots","tract_measure":"count","test":"financial","grant_max":175000,"equity_share":0,"interest_rate":0.05,"term_months":180,"cushion":200,"cost_per_sf":603,"rent_basis":"ami_cap","rent_flat":2000,"vacancy":0.15,"rear_yard_denominator":3,"side_setback_ft":5}'></div>

With the grant at zero:

<div data-sandbox="pencil" data-mode="view" data-params='{"view":"lots","tract_measure":"count","test":"financial","grant_max":0,"equity_share":0,"interest_rate":0.05,"term_months":180,"cushion":200,"cost_per_sf":603,"rent_basis":"ami_cap","rent_flat":2000,"vacancy":0.15,"rear_yard_denominator":3,"side_setback_ft":5}'></div>

- At the published terms, 167,742 lots are allowed under the rules, 6,675 of those have room for a unit, and 4,462 of those work for the owner. The three tests nest, so the third view shows fewer dots than the first.
- The first figure in the metrics strip is the number of blue dots in the lot view at the third test. They are the same set counted twice.
- The tract view's default is a count; switching it to a share divides by the homes the tract already has, and a tract of large lots and few homes shows a high share off a small number.
- The 3D view draws a unit on every lot with room for one, including the red ones the rules exclude - which is what that view is for. No red unit stands on a lot that passes the first test.
- Queens reads at full strength and the rest of the metro at a quarter; the mask is a mask, not a crop, so where the borough sits is still visible.
- The word "pencil" is the slug and appears nowhere a reader can see it.

### Limitations

- Every lot that passes is assumed to be built on. The real number would be lower and nothing in the data says by how much, which is why the metric is labeled as an upper bound.
- The $200 cushion is a household test in the program and a per-lot test here, because there's no household data.
- Rent is uniform within a ZIP, the rent cap is uniform across eight counties, and property tax is ignored.
- The required rear yard is a rectangle the full width of the lot, because the table has no shape.
- Who hears about the program, who has a contractor, and who trusts the city are not in any dataset, so they aren't in the map.

---

Notes by Adam Vosburgh, Fall 2026.
