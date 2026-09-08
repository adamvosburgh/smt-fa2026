---
title: "ADU Forecast for Queens dev notes"
date: "2026-08-31"
author: Adam Vosburgh
sequence: 1
cat: tutorial
devnotes: true
published: true
---

Notes from building the [ADU Forecast for Queens](/sandboxes/pencil/) sandbox. Pipeline: `data/scripts/pencil.py`. Component: `src/lib/sandboxes/pencil/`.

![the sandbox at its defaults](/covers/pencil.png#img-full)

<div class="gap">

**What a rebuild won't have.** The sandbox runs all 246,921 lots and recomputes them on every slider move. A rebuild should start with one community district (about 8,000 lots); the code is the same.

</div>

## The ambition

The city publishes a lot of material on accessory dwelling units: a plan library, a budgeting tool, a loan-and-grant term sheet, a guide to where they're allowed. Nothing public says what it adds up to. The idea was to take the assumptions in those materials and turn them into a forecast: apply the published numbers to every one-to-two-family lot in a borough, count where the arithmetic works, and put a rate on how fast units get built. It's an experiment with the city's own figures, not a prediction of what homeowners will do.

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

![the rear yard rule](/tutorials/images/01/rear-yard-rule.svg#img-full)

## Roadblocks

- The first version applied the one-third rule to the whole open lot instead of the required rear yard; correcting it moved the median unit from 707 sf to 333 and the lots pinned at the 800 sf cap from 109,032 to 384.
- The `.dbf` has no shape, so the first map drew every unit at the lot centroid, on top of the house; placing it needed the shapefile and the building footprints.
- Which side of a lot faces the street isn't recorded; assuming the back was away from the house was right 55.5% of the time, and taking the unshared lot edge as the street is right 96.5% of the time (500 sampled blocks).
- Only about a third of lots that pass the area test have room behind the house for a rectangle at the plan library's proportions with 5 ft setbacks; they still count as passing and the panel counts them separately.
- HPD's budgeting tool shows cost inputs totalling 28% of hard cost plus $50,000 but computes 48% plus $50,000; the 20% it never displays is probably contractor overhead and profit.
- "Expanded flood area" is not a term in the Zoning Resolution; the real bans are DEP's rainfall and coastal flood risk areas, whose map we couldn't download, so the NPCC layers it's built from stand in.
- No City of Yes ADU eligibility layer exists on NYC Open Data; the flags are derived from DCP's published rules.
- Every control changes the arithmetic rather than the data, so nothing can be precomputed; the browser ships seven numbers per lot (about 7 MB) and redoes all 246,921 in about 140 ms.

## What came out

A borough-wide map of where the program's arithmetic works, and a queue that releases passing lots a set number per year from 2027.

### What you should see

At the published terms, 2035:

<div data-sandbox="pencil" data-mode="view" data-params='{"grant_max":175000,"equity_share":0,"interest_rate":0.05,"term_months":180,"cost_per_sf":500,"rent_basis":"ami_cap","rent_flat":2000,"vacancy":0.05,"eligibility":"coy","cushion":200,"permits_per_year":1000,"year":2035,"tint":"margin","volumes":false}'></div>

With the grant at zero:

<div data-sandbox="pencil" data-mode="view" data-params='{"grant_max":0,"equity_share":0,"interest_rate":0.05,"term_months":180,"cost_per_sf":500,"rent_basis":"ami_cap","rent_flat":2000,"vacancy":0.05,"eligibility":"coy","cushion":200,"permits_per_year":1000,"year":2035,"tint":"margin","volumes":false}'></div>

- About 62% of eligible lots pass at the published terms; 12% with no grant.
- The northwest of the borough passes and the east mostly doesn't, because a large lot fits a large unit whose cost exceeds the $220,000 loan ceiling after the grant.
- Switching the rent basis from the AMI cap to market rent changes little, because the cap is above market rent in most of Queens.
- Ignoring eligibility grows the eligible set from 165,956 to 244,301 lots, mostly low-density districts outside the transit zone.
- Interest rate and term change the margin but not the count at the defaults, because the loan ceiling is what binds.
- Permits per year changes when units appear, not whether.

### Limitations

- The $200 cushion is a household test in the program and a per-lot test here, because there's no household data.
- Units are built in order of return on the owner's money; nobody in the model decides anything.
- Rent is uniform within a ZIP, the rent cap is uniform across eight counties, and property tax is ignored.
- The required rear yard is a rectangle the full width of the lot, because the table has no shape.
- Who hears about the program, who has a contractor, and who trusts the city are not in any dataset, so they aren't in the map.

---

Notes by Adam Vosburgh, Fall 2026.
