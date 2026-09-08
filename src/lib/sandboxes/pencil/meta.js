// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/server/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'pencil',
  title: 'ADU Forecast for Queens',
  subtitle:
    "Every one-to-two-family lot in Queens, tested against the city's own rules and numbers for a backyard home. The map shows how many homes the program could add, and where, if every lot that passes were built on.",
  status: 'built',
  statusNote:
    'The program terms come from HPD and HCR\'s Plus One ADU term sheet, the construction cost from HPD\'s Pre-Approved Plan Library, and the soft and operating costs from HPD\'s own ADU budgeting tool. The unit size comes from the Zoning Resolution directly. The eligibility flags are ours, derived from the published rules, because the city publishes no ADU eligibility layer, and one of them approximates a DEP map we could not obtain.',
  kind: 'model',
  blurb:
    "An experiment in applying one housing program's published numbers to a whole borough at once. Each of 246,921 lots goes through three tests in order - allowed under the rules, room for a unit, works for the owner - and a lot that passes all three counts as one added home. Every number on the term sheet is a slider, and the arithmetic is redone for every lot on every move. The count is an upper bound: it assumes every lot that passes is built on.",
  controls: [
    'which of three views: homes added by tract, each lot by test, or the units drawn on their lots',
    'in the tract view, whether the number is homes added or a share of the homes the tract already has',
    'in the lot view, which of the three tests is drawn',
    'the grant ceiling, and how much of the cost the owner puts in',
    'the interest rate and the length of the loan',
    'the monthly cushion the deal has to clear',
    'construction cost per square foot',
    "whether rent is the program's income-based cap, market rent by ZIP code, or a flat figure",
    'the two numbers in the zoning rule that size the unit: the share of the rear yard, and the side setback'
  ],
  metrics: [
    'homes added: the lots that pass all three tests, which is an upper bound',
    'lots allowed under the rules',
    'lots with room for a unit',
    'the share of allowed lots that also work for the owner',
    'the unit size at the median passing lot',
    'the monthly margin at the median passing lot',
    'the median tract income where the homes land',
    'the share of homes falling in the top tenth of tracts'
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
    'MapPLUTO 26v2 again, for the denominator of the tract view: UnitsRes summed over every lot in a tract, all building classes, which is the homes the tract already has.',
    'NYC 2020 census tract boundaries, reused from the flood map sandbox rather than refetched, for the tract outlines.',
    'NYC Borough Boundaries (NYC Open Data gthc-hcne): the Queens outline, simplified to about a thousand vertices, for the mask that fades the rest of the city.',
    'NYC Open Data 27ya-gqtm and ek8y-fsqz: the NPCC 2050s and 2080s floodplains, standing in for DEP\'s 10-year rainfall and coastal flood risk areas, which we could not obtain.'
  ],
  cannotSee:
    'Basement units and conversions of existing space, which the city\'s program also covers. Whether a homeowner can raise the money, wants a tenant, or trusts the city; lots that pass are not lots that build, and the count is an upper bound. The required rear yard is sized as a rectangle the full width of the lot, because MapPLUTO\'s table has no lot shape; the drawing uses the real outline and footprint to place the unit, and a corner lot\'s front is taken as its longest street edge, which is our rule. It cannot see who lives in the house, so the program\'s owner-occupancy requirement is absent rather than modeled. There is no contractor, no financing rejection, no family, and nothing about what the units do to the block.',
  tutorial: '/tutorials/01-pencil/',
  live: false
};
