# ADU Forecast for Queens — sandbox text

Every string a reader sees in the sandbox's menus, in reading order, for the 09-08 rebuild. This is the prose the build doc points Claude Code at; copy from here, do not rewrite. Register: flat, explanatory, model card. Numbers in brackets like [22,333] are the sandbox's current figures and must be re-read from the rebuilt pipeline before they ship.

## Title block

**Title.** ADU Forecast for Queens

**Subtitle.** Every one-to-two-family lot in Queens, tested against the city's own rules and numbers for a backyard home. The map shows how many homes the program could add, and where, if every lot that passes were built on.

## Description panel (card.md)

## What this is

A forecast of how many homes could be added to Queens by one city program for backyard units. The sandbox runs the 246,921 one-to-two-family lots in the borough[^pluto] through three tests taken from the program's published rules and numbers: whether a unit is allowed on the lot, whether there is room for one, and whether the loan and the rent would work for the lot owner. A lot that passes all three is counted as one added home. The map shows those homes by census tract, the tests lot by lot, or the units themselves drawn in three dimensions behind the houses.

The program is Plus One ADU, run by HPD and HCR. An ADU is an accessory dwelling unit, a small self-contained home on a lot that already has a house. The program lends up to $220,000 and grants up to $175,000 per homeowner, on the condition that the unit rents at or below a cap tied to area incomes.[^termsheet]

The sandbox covers detached backyard units only. The city's ADU for You program also covers basement units and conversions of existing space such as attics and garages; the sandbox has no data about basements or attics, and its size rule, its cost figures and its flood rule are all specific to backyard units, so it does not count them. The count is an upper bound: it assumes every lot that passes is built on.

[^pluto]: MapPLUTO 26v2, filtered to Queens and to building classes A and B. Only the attribute table is read. A second filter, `LandUse` = 01, disagrees with the building-class filter on 129 lots out of about 247,000.
[^termsheet]: HPD and HCR, Plus One ADU term sheet. Quoted as published: maximum loan "$220,000 per borrower", maximum grant "$175,000 per grantee", interest "5%. Rate may be reduced.", term "180 months (15 years.)", rent "at or below 100% of the Area Median Income", and payments set so the household keeps "at least $200 monthly cash flow available".

## What it's trying to show

- How many homes a program like this could add to the housing stock, and in which neighborhoods, if its published rules and numbers were applied to every lot at once.
- Where the number comes from: each of the three tests removes lots, and the lot view shows which test removes which.
- How much the total depends on a few numbers on a term sheet. The grant, the loan ceiling, the rate, the rent cap and the cushion are each a slider in the assumptions panel.

## How it works

Every lot goes through three tests in order. A lot that fails one is not tested further.

1. **Allowed under the rules.** The lot holds a one- or two-family house; it is not in a historic district; it is not in a DEP flood risk area; and if it is in an R1-2A, R2A or R3A district it is inside the Greater Transit Zone.[^rules] The program's owner-occupancy requirement cannot be tested, because no dataset says who lives in the house.
2. **Room for a unit.** The unit may occupy one-third of the required rear yard, whose depth depends on the building type, capped at 800 sf.[^zr] The sandbox requires at least 300 sf, and requires that a unit of that size fits behind the house after the side and rear setbacks. On the median Queens lot the third is 229 sf, which is why most lots stop here [22,333 lots pass].
3. **Works for the owner.** The unit is costed at the plan library's median cost per square foot[^plans] plus soft costs by HPD's own formula;[^budget] the grant and the owner's share come off; the rest is borrowed, and fails if it exceeds the $220,000 ceiling; the loan becomes a monthly payment at the rate and term; rent[^rent] less vacancy, operating cost and the payment must clear the cushion.

The tract view counts the lots that pass all three, by census tract, either as a number of homes or as a share of the homes the tract already has.[^units] The lot view draws one dot per lot for whichever test is selected: the test's color where the lot passes, red where it fails. The 3D view draws a unit on every lot that has room for one, colored by the outcome of the other two tests. The browser redoes all 246,921 lots on every slider move, in about 140 ms.

Units are drawn in the open ground behind the house, measured from the lot outline and the building footprint, at the plan library's median proportions (0.70) and the rule's 15 ft height. The street edge is the lot edge no other lot in the tax block shares; checked on 500 blocks, that is right 96.5% of the time.

[^rules]: Zoning Resolution 12-10 (the definition of an ancillary dwelling unit), the DCP City of Yes for Housing Opportunity ADU guide, and MapPLUTO's `HistDist` and `ZoneDist1` fields with DCP's Greater Transit Zone. The flood test uses the NPCC 2050s and 2080s floodplains (NYC Open Data `27ya-gqtm` and `ek8y-fsqz`) in place of DEP's 10-year rainfall and coastal flood risk areas, which could not be obtained.
[^zr]: Zoning Resolution 23-341(b)(4) ("an area not exceeding one-third of the rear yard or rear yard equivalent", "one story, not to exceed 15 feet"); 23-342 (required rear yard depths by building type, reduced on interior lots under 95 ft deep that existed on 15 December 1961); 12-10 (the 800 sf definition).
[^plans]: HPD Pre-Approved Plan Library, eleven designs with published cost ranges. Midpoints run from $248 to $1,500 per sf; $603 is the median and the default. The smallest published design is 280 sf.
[^budget]: HPD ADU Budgeting Tool. Its formula was recovered by moving one input at a time. The inputs it shows add to 28% of hard cost plus $50,000; its output is 48% plus $50,000; the undisplayed 20% is probably contractor overhead and profit.
[^rent]: Market rent: HUD Small Area Fair Market Rent FY2026, one-bedroom, by ZIP ($2,260 to $3,570 a month across Queens). Rent cap: 100% AMI from HUD FY2026 Income Limits for the New York, NY HUD Metro FMR Area, eight counties, so one figure (about $3,181) for the whole borough. The cap is above market rent in most of Queens.
[^units]: Existing homes per tract are the sum of MapPLUTO `UnitsRes` over the lots in the tract, all building classes, from the same 26v2 table.

## What it assumes

- Every lot that passes is built on. The real number would be lower, and nothing in the data says by how much.
- The $200 cushion is a household test in the program (it sizes the loan) and a per-lot build-or-don't-build test here, because there is no household data.
- The required rear yard is a rectangle the full width of the lot, since the table has no lot shape.
- Building type (detached, semi-attached, attached) is the assessor's `ProxCode`; a second method from lot and building widths agrees on only 77% of lots.
- All 34,455 shallow lots get the shallow-lot reduction, because no field records whether a lot existed in 1961.
- A corner lot's front is its longest street edge, which is our rule.
- Property tax on the added unit is ignored, because no dataset carries it.
- Rent is uniform within a ZIP and the rent cap is uniform across eight counties.
- The flood test is an approximation: DEP's rainfall and coastal flood risk areas could not be obtained, so the NPCC layers they are built from stand in.
- The eligibility flags are ours, derived from DCP's published rules; no city eligibility layer exists.

## What it can't see

- Basement units and conversions of existing space, which the city's program also covers.
- Whether a homeowner can raise the money, wants a tenant, or trusts the city.
- Who lives in the house, so the program's owner-occupancy requirement is absent rather than modeled.
- Any contractor, financing rejection, family, or existing basement tenant.
- What a few hundred backyard units do to a block.

## Representation panel

Panel heading: **representation**

**Show** (`view`)
Options: homes added, by tract · each lot, by test · units on their lots. Default: homes added, by tract.
Why these numbers: Three views of the same result. The tract view counts homes that pass all three tests. The lot view shows one test at a time, lot by lot. The 3D view draws a unit on every lot that has room for one and colors it by the other two tests.

**Count as** (`tract_measure`, shown in the tract view)
Options: number of homes · share of existing homes. Default: number of homes.
Why these numbers: A share divides the homes added by the homes the tract already has, from the same lot table. A tract of large lots and few homes can show a high share from a small number.

**Test** (`test`, shown in the lot view)
Options: allowed under the rules · room for a unit · works for the owner. Default: works for the owner.
Why these numbers: Each test is run only on the lots that passed the one before it, so the third view shows fewer colored dots than the first. Red always means the lot fails the selected test.

Legend, tract view: a single-hue ramp from 0 to the highest tract value, with the unit (homes, or percent of existing homes) printed at each end.

Legend, lot view: `fails this test` (red) and one of `allowed under the rules` (yellow), `room for a unit` (green), `works for the owner` (blue).

Legend, 3D view: `allowed, and works for the owner` (blue) · `allowed, but does not work for the owner` (yellow) · `not allowed under the rules` (red). Note under the legend: only lots with room for a unit are drawn.

Basemap note (small, under the legend): Queens is drawn in full; the rest of the city is faded to 25%.

## Assumptions panel

Panel heading: **assumptions**

### the program

**Maximum grant** (`grant_max`)
Range $0 to $250,000. Default $175,000.
Why these numbers: The term sheet's "$175,000 per grantee." At zero, no lot in Queens clears the loan ceiling, because the unit costs more to build than the program will lend.

**Homeowner's own money** (`equity_share`)
Range 0% to 50% of the cost. Default 0%.
Why these numbers: The program does not require a contribution. This is the share of the cost the owner pays in cash, which reduces the loan.

**Interest rate** (`interest_rate`)
Range 0% to 10%. Default 5%.
Why these numbers: The term sheet's "5%. Rate may be reduced." The sheet allows a reduction to 0% for lower-income borrowers.

**Loan term** (`term_months`)
Options: 15 years · 30 years. Default: 15 years.
Why these numbers: The term sheet's "180 months (15 years)", extendable to 360.

**Required monthly cushion** (`cushion`)
Range $0 to $1,000 a month. Default $200.
Why these numbers: The term sheet sizes the loan so the household keeps "at least $200 monthly cash flow available." Here it is the amount the rent must clear after the payment and costs for the lot to pass.

### the market

**Construction cost** (`cost_per_sf`)
Range $200 to $1,600 per square foot. Default $603.
Why these numbers: The median of the eleven published cost midpoints in HPD's Pre-Approved Plan Library, which run from $248 to $1,500 per square foot for designs reviewed by one agency for one purpose.

**What rent it gets** (`rent_basis`)
Options: the program's rent cap · market rent by ZIP · a flat figure. Default: the program's rent cap.
Why these numbers: The program caps rent at 100% of area median income, one figure for the whole borough. Market rent is HUD's FY2026 Small Area Fair Market Rent for a one-bedroom, which varies by ZIP. The cap is above market in most of Queens, so the cap is usually the lower of the two.

**Flat rent** (`rent_flat`, shown when the rent basis is a flat figure)
Range $500 to $5,000 a month. Default $2,000.

**Vacancy** (`vacancy`)
Range 0% to 25%. Default 15%.
Why these numbers: HPD's budgeting tool assumes 15% turnover. Rent is reduced by this share before costs.

### the rules

**One part in N of the rear yard** (`rear_yard_denominator`)
Range 2 to 12. Default 3.
Why these numbers: The Zoning Resolution allows a unit on "an area not exceeding one-third of the rear yard." This is the three. Changing it is changing the statute; it is here because it is the number that decides how many lots have room at all.

**Side setback** (`side_setback_ft`)
Range 0 to 15 feet. Default 5.
Why these numbers: The Zoning Resolution requires 5 feet from the rear and side lot lines. The setback is what decides whether a unit that passes the area test also fits on the ground.

Button at the foot of the panel: **Submit this state**

## Metrics strip

Labels, in order:
- homes added (lots passing all three tests)
- lots allowed under the rules
- lots with room for a unit
- share of allowed lots that work for the owner
- unit size at the median passing lot
- monthly margin at the median passing lot
- median tract income where homes land
- share of homes in the top tenth of tracts

## Warnings and status lines

- `no basemap - the model still works`
- `{n} basemap tiles blocked - the model still works`
- while recomputing: `rerunning 246,921 lots…`

## What it can't see (assistant prompt, meta.js `cannotSee`)

Basement units and conversions of existing space, which the city's program also covers. Whether a homeowner can raise the money, wants a tenant, or trusts the city; lots that pass are not lots that build, and the count is an upper bound. The required rear yard is sized as a rectangle the full width of the lot, because MapPLUTO's table has no lot shape; the drawing uses the real outline and footprint to place the unit, and a corner lot's front is taken as its longest street edge, which is our rule. It cannot see who lives in the house, so the program's owner-occupancy requirement is absent rather than modeled. There is no contractor, no financing rejection, no family, and nothing about what the units do to the block.
