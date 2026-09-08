## What this is

A map of the 246,921 one-to-two-family lots in Queens.[^pluto] For each lot the sandbox works out whether a small second home could be built in the back garden under one city program, and whether the rent would cover the loan. Lots where the arithmetic works are colored one way, lots where it doesn't another, and a year slider steps through a rough forecast of how many get built and where.

The program is Plus One ADU (HPD and HCR). An ADU is an accessory dwelling unit, a small self-contained home on a lot that already has a house. The program lends up to $220,000 and grants up to $175,000 per homeowner, on the condition that the unit rents at or below a cap tied to area incomes.[^termsheet]

This is an experiment with the city's published numbers, not a prediction of what homeowners will do.

[^pluto]: MapPLUTO 26v2, filtered to Queens and to building classes A and B. Only the attribute table is read. A second filter, `LandUse` = 01, disagrees with the building-class filter on 129 lots out of about 247,000.
[^termsheet]: HPD and HCR, Plus One ADU term sheet. Quoted as published: maximum loan "$220,000 per borrower", maximum grant "$175,000 per grantee", interest "5%. Rate may be reduced.", term "180 months (15 years.)", rent "at or below 100% of the Area Median Income", and payments set so the household keeps "at least $200 monthly cash flow available".

## What it's trying to show

- The difference between where a unit is allowed (the eligibility map the city publishes, which you can draw with `Color by`) and where the loan and rent would work.
- How much a program's reach depends on a few numbers on a term sheet: the grant, the loan ceiling, the rate, the rent cap and the cushion are each a slider.
- A point about scale: whatever the arithmetic produces is a few thousand units a year at most, which is worth holding next to the attention ADUs get compared with making ordinary housing easier to permit.

## How it works

For every lot, in order:

1. Size the unit: a third of the required rear yard, whose depth depends on building type, capped at 800 sf and zeroed below 300 sf.[^zr] On the median Queens lot that third is 229 sf, under the floor, which is why only 22,333 lots can take a unit at all.
2. Cost it: floor area times cost per square foot,[^plans] plus a soft cost of $50,000 and 48% of the hard cost.[^budget]
3. Take off the grant, then the owner's own share.
4. Borrow the rest; if it exceeds the $220,000 ceiling the deal fails there, reported separately.
5. Turn the loan into a monthly payment at the rate and term.
6. Take the rent,[^rent] less vacancy, operating cost and the payment.
7. If what's left clears the cushion, the lot passes.

Passing lots are ranked by return on the owner's money and released a set number per year from 2027. The panel reports the median income of the tracts units land in.[^acs] Nothing is precomputed: the browser redoes all 246,921 lots on every slider move, in about 140 ms.

Units are drawn in the open ground behind the house, measured from the lot outline and the building footprint, at the plan library's median proportions (0.70) and the rule's 15 ft height. The street edge is the lot edge no other lot in the tax block shares; checked on 500 blocks, that is right 96.5% of the time.

[^zr]: Zoning Resolution 23-341(b)(4) ("an area not exceeding one-third of the rear yard or rear yard equivalent", "one story, not to exceed 15 feet"); 23-342 (required rear yard depths by building type, reduced on interior lots under 95 ft deep that existed on 15 December 1961); 12-10 (the 800 sf definition).
[^plans]: HPD Pre-Approved Plan Library, eleven designs with published cost ranges. Midpoints run from $248 to $1,500 per sf; $603 is the median and the default.
[^budget]: HPD ADU Budgeting Tool. Its formula was recovered by moving one input at a time. The inputs it shows add to 28% of hard cost plus $50,000; its output is 48% plus $50,000; the undisplayed 20% is probably contractor overhead and profit.
[^rent]: Market rent: HUD Small Area Fair Market Rent FY2026, one-bedroom, by ZIP ($2,260 to $3,570 a month across Queens). Rent cap: 100% AMI from HUD FY2026 Income Limits for the New York, NY HUD Metro FMR Area, eight counties, so one figure (about $3,181) for the whole borough. The cap is above market rent in most of Queens.
[^acs]: Census ACS 5-year 2023, median household income by tract, joined through MapPLUTO's tract field; all lots matched.

## What it assumes

- The $200 cushion is a household test in the program (it sizes the loan) and a per-lot build-or-don't-build test here, because there is no household data.
- The required rear yard is a rectangle the full width of the lot, since the table has no lot shape.
- Building type (detached, semi-attached, attached) is the assessor's `ProxCode`; a second method from lot and building widths agrees on only 77% of lots.
- All 34,455 shallow lots get the shallow-lot reduction, because no field records whether a lot existed in 1961.
- A corner lot's front is its longest street edge, which is our rule.
- Only about a third of lots that pass the area test have room for a real unit after 5 ft setbacks; they still pass, and the panel counts them.
- Property tax on the added unit is ignored, because no dataset carries it.
- Rent is uniform within a ZIP and the rent cap is uniform across eight counties.
- The flood bans are approximated: DEP's rainfall and coastal flood risk areas couldn't be obtained, so the NPCC 2050s and 2080s layers they're built from stand in.[^flood]
- The eligibility flags are ours, derived from DCP's published rules; no city eligibility layer exists.
- Everyone builds when the deal works, and the only queue is permits.

[^flood]: NYC Open Data `27ya-gqtm` and `ek8y-fsqz`, plus MapPLUTO's FEMA flags. "Expanded flood area", used in an earlier version, does not appear in the Zoning Resolution; ZR 64-11 defines flood maps as "the most recent map or map data used as the basis for flood-resistant construction standards".

## What it can't see

- Whether a homeowner can raise the money, wants a tenant, or trusts the city; lots that pass are not lots that build.
- Who lives in the house, so the program's 270-day owner-occupancy requirement is absent rather than modeled.
- Any contractor, financing rejection, family, or existing basement tenant.
- What a few hundred backyard units do to a block.
