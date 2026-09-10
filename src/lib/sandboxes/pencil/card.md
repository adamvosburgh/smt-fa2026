<!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->

## Description

A forecast of how many homes could be added to Queens by one city program for backyard units, Plus One ADU, run by HPD and HCR. An ADU is an accessory dwelling unit, a small self-contained home on a lot that already has a house. The program lends up to $220,000 and grants up to $175,000 per homeowner, on the condition that the unit rents at or below a cap tied to area incomes.[^termsheet]

The sandbox runs the 246,921 one-to-two-family lots in the borough[^pluto] through three tests taken from the program's published rules and numbers: whether a unit is allowed on the lot[^rules], whether there is room for one[^zr], and whether the loan and the rent would work for the lot owner[^plans][^budget][^rent]. A lot that fails one test is not tested further, and a lot that passes all three is counted as one added home. The map shows those homes by census tract[^units], the tests lot by lot, or the units themselves drawn in three dimensions behind the houses. The browser redoes all 246,921 lots on every slider move.

The sandbox covers detached backyard units only. The city's program also covers basement units and conversions of attics and garages, for which there is no data. The count is an upper bound: it assumes every lot that passes is built on.

[^termsheet]: HPD and HCR, [Plus One ADU term sheet](https://www.nyc.gov/assets/hpd/downloads/pdfs/services/adu-term-sheet.pdf). Quoted as published: maximum loan "$220,000 per borrower", maximum grant "$175,000 per grantee", interest "5%. Rate may be reduced.", term "180 months (15 years.)", rent "at or below 100% of the Area Median Income", and payments set so the household keeps "at least $200 monthly cash flow available".
[^pluto]: [MapPLUTO 26v2](https://www.nyc.gov/site/planning/data-maps/open-data/dwn-pluto-mappluto.page), filtered to Queens and to building classes A and B. Only the attribute table is read. A second filter, `LandUse` = 01, disagrees with the building-class filter on 129 lots out of about 247,000.
[^rules]: [Zoning Resolution 12-10](https://zr.planning.nyc.gov/article-i/chapter-2/12-10) (the definition of an ancillary dwelling unit), the DCP City of Yes for Housing Opportunity ADU guide, and MapPLUTO's `HistDist` and `ZoneDist1` fields with DCP's Greater Transit Zone. The flood test uses the NPCC 2050s and 2080s floodplains (NYC Open Data [`27ya-gqtm`](https://data.cityofnewyork.us/d/27ya-gqtm) and [`ek8y-fsqz`](https://data.cityofnewyork.us/d/ek8y-fsqz)) in place of DEP's 10-year rainfall and coastal flood risk areas, which could not be obtained.
[^zr]: [Zoning Resolution 23-341(b)(4)](https://zr.planning.nyc.gov/article-ii/chapter-3/23-341) ("an area not exceeding one-third of the rear yard or rear yard equivalent", "one story, not to exceed 15 feet"); 23-342 (required rear yard depths by building type, reduced on interior lots under 95 ft deep that existed on 15 December 1961); 12-10 (the 800 sf definition).
[^plans]: HPD [Pre-Approved Plan Library](https://housing.hpd.nyc.gov/adu/library), eleven designs with published cost ranges. Midpoints run from $248 to $1,500 per sf; $603 is the median and the default. The smallest published design is 280 sf.
[^budget]: HPD [ADU Budgeting Tool](https://housing.hpd.nyc.gov/adu). Its formula was recovered by moving one input at a time: the inputs it shows add to 28% of hard cost plus $50,000, its output is 48% plus $50,000, and the undisplayed 20% is probably contractor overhead and profit.
[^rent]: Market rent: [HUD Small Area Fair Market Rent FY2026](https://www.huduser.gov/portal/datasets/fmr/smallarea/index.html), one-bedroom, by ZIP ($2,260 to $3,570 a month across Queens). Rent cap: 100% AMI from [HUD FY2026 Income Limits](https://www.huduser.gov/portal/datasets/il.html) for the New York, NY HUD Metro FMR Area, eight counties, so one figure (about $3,181) for the whole borough. The cap is above market rent in most of Queens.
[^units]: Existing homes per tract are the sum of MapPLUTO `UnitsRes` over the lots in the tract, all building classes, from the same 26v2 table.

## Assumptions + Limitations

- Every lot that passes is built on. The real number would be lower, and nothing in the data says by how much.
- The $200 cushion is a household test in the program (it sizes the loan) and a per-lot build-or-don't-build test here, because there is no household data.
- The required rear yard is a rectangle the full width of the lot, since the table has no lot shape. Units are drawn in the open ground behind the house, measured from the lot outline and the building footprint, at the plan library's median proportions and the rule's 15 ft height.
- The street edge is the lot edge no other lot in the tax block shares; checked on 500 blocks, that is right 96.5% of the time. A corner lot's front is its longest street edge, which is our rule.
- Building type (detached, semi-attached, attached) is the assessor's `ProxCode`; a second method from lot and building widths agrees on only 77% of lots.
- All 34,455 shallow lots get the shallow-lot reduction, because no field records whether a lot existed in 1961.
- Property tax on the added unit is ignored, because no dataset carries it.
- Rent is uniform within a ZIP and the rent cap is uniform across eight counties.
- The flood test is an approximation: DEP's rainfall and coastal flood risk areas could not be obtained, so the NPCC layers they are built from stand in.
- The eligibility flags are ours, derived from DCP's published rules; no city eligibility layer exists.
- Who lives in the house is not known, so the program's owner-occupancy requirement is not tested.
- Basement units and conversions of existing space, which the city's program also covers, are not counted.
- Whether a homeowner can raise the money, wants a tenant, or trusts the city is not considered; neither is any contractor, financing rejection, family, or existing basement tenant.
- What a few hundred backyard units do to a block is not considered.
