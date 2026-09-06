// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/server/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'pencil',
  title: 'ADU Forecast for Queens',
  subtitle:
    'Every one-to-two-family lot in Queens, run through one city programme for backyard homes. The map shows where the loan and the rent work out, and a year slider steps through a rough forecast of how many get built and where.',
  status: 'built',
  statusNote:
    'The programme terms come from HPD and HCR\'s Plus One ADU term sheet, the construction cost from HPD\'s Pre-Approved Plan Library, and the soft and operating costs from HPD\'s own ADU budgeting tool. The unit size comes from the Zoning Resolution directly. The eligibility flags are ours, derived from the published rules, because the city publishes no ADU eligibility layer, and one of them approximates a DEP map we could not obtain.',
  kind: 'model',
  blurb:
    'An experiment in applying one housing programme\'s published numbers to a whole borough at once. For each of 246,921 lots the sandbox sizes a backyard unit from the zoning rule, costs it from HPD\'s figures, takes off the grant, borrows the rest and checks whether the rent covers the payment. Every number on the term sheet is a slider, and the arithmetic is redone for every lot on every move.',
  controls: [
    'the grant ceiling, and how much of the cost the owner puts in',
    'the interest rate and the length of the loan',
    'construction cost per square foot',
    'whether rent is the programme\'s income-based cap, market rent by ZIP code, or a flat figure',
    'whether the City of Yes eligibility rules apply',
    'the monthly cushion the deal has to clear',
    'the two numbers in the zoning rule that size the unit: the share of the rear yard, and the side setback',
    'how many permits a year, and which year you are looking at',
    'what the colour means, and whether built units are drawn as volumes'
  ],
  metrics: [
    'lots where the numbers work, and their share of the eligible set',
    'units built by the selected year, cumulatively',
    'units built in that year alone',
    'the monthly margin at the median passing lot',
    'the unit size at the median passing lot',
    'how many of the built units have room behind the house for a real unit',
    'the median tract income where units land',
    'the share of units falling in the top tenth of tracts'
  ],
  data: [
    'MapPLUTO 26v2: 246,921 Queens one-to-two-family lots, with lot width and depth, building footprint, the assessor\'s building-type code, zoning district, transit zone, historic district, FEMA flood flags, ZIP and census tract. Only the attribute table is read.',
    'Zoning Resolution 12-10, 23-341(b)(4), 23-342 and 64-11: what an ancillary dwelling unit is, how big it may be, how deep a rear yard the lot must keep, and what the flood restrictions say.',
    'HPD Pre-Approved Plan Library: eleven published designs with dimensions and cost ranges, whose midpoints run from $248 to $1,500 a square foot.',
    'HPD ADU Budgeting Tool: the soft cost formula and the operating defaults, recovered by moving its inputs one at a time.',
    'HPD and HCR Plus One ADU term sheet: the loan and grant ceilings, the rate, the term, the rent cap and the $200 cushion.',
    'HUD Small Area Fair Market Rents FY2026, by ZIP: market rent, which varies across Queens.',
    'HUD FY2026 Income Limits for the New York, NY HUD Metro FMR Area: eight counties, so the income-based rent cap is one figure for the whole borough.',
    'Census ACS 5-year 2023: median household income by tract.',
    'NYC Open Data 27ya-gqtm and ek8y-fsqz: the NPCC 2050s and 2080s floodplains, standing in for DEP\'s 10-year rainfall and coastal flood risk areas, which we could not obtain.'
  ],
  cannotSee:
    'Whether a homeowner can raise the money, wants a tenant, or trusts the city. Lots that pass are not lots that build. The required rear yard is sized as a rectangle the full width of the lot, because MapPLUTO\'s table has no lot shape; the drawing uses the real outline and footprint to place the unit, and a corner lot\'s front is taken as its longest street edge, which is our rule. It cannot see who lives in the house, so the programme\'s owner-occupancy requirement is absent rather than modelled. There is no contractor, no financing rejection, no family, and nothing about what the units do to the block.',
  tutorial: '/tutorials/01-pencil/',
  live: false
};
