// PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide.
//
// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'pencil',
  title: 'ADU Forecast for Queens',
  subtitle:
    'Forecast of how many backyard homes one city program could add to Queens, and where.',
  status: 'built',
  statusNote:
    "The program terms come from HPD and HCR's Plus One ADU term sheet, the construction cost from HPD's Pre-Approved Plan Library, and the soft and operating costs from HPD's own ADU budgeting tool. The unit size comes from the Zoning Resolution. The eligibility flags are ours, derived from the published rules, because the city publishes no ADU eligibility layer, and one of them stands in for a DEP map we could not obtain.",
  kind: 'model',
  blurb:
    'A forecast of how many homes one city program for backyard units could add to Queens. Each of 246,921 one-to-two-family lots goes through three tests taken from the published rules and numbers - allowed under the rules, room for a unit, works for the owner - and a lot that passes all three counts as one added home. The count is an upper bound: it assumes every lot that passes is built on.',
  controls: [
    'Show: homes added by tract, each lot by test, or the units drawn on their lots',
    'Count as, in the tract view: a number of homes or a share of the homes the tract already has',
    'Test, in the lot view: allowed under the rules, room for a unit, or works for the owner',
    'Maximum grant',
    "Homeowner's own money, as a share of the cost paid in cash",
    'Interest rate',
    'Loan term: 15 or 30 years',
    'Required monthly cushion',
    'Construction cost per square foot',
    "What rent it gets: the program's rent cap, market rent by ZIP, or a flat figure",
    'Flat rent, when the rent basis is a flat figure',
    'Vacancy',
    'One part in N of the rear yard',
    'Side setback'
  ],
  metrics: [
    'homes added (lots passing all three tests)',
    'lots allowed under the rules',
    'lots with room for a unit',
    'share of allowed lots that work for the owner',
    'unit size at the median passing lot',
    'monthly margin at the median passing lot',
    'median tract income where homes land',
    'share of homes in the top tenth of tracts'
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
    "Basement units and conversions of existing space, which the city's program also covers. Whether a homeowner can raise the money, wants a tenant, or trusts the city; lots that pass are not lots that build, and the count is an upper bound. The required rear yard is sized as a rectangle the full width of the lot, because MapPLUTO's table has no lot shape; the drawing uses the real outline and footprint to place the unit, and a corner lot's front is taken as its longest street edge, which is our rule. It cannot see who lives in the house, so the program's owner-occupancy requirement is not tested. There is no contractor, no financing rejection, no family, and nothing about what the units do to the block.",
  tutorial: null,
  live: false
};
