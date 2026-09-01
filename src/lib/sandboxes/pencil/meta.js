// PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide.
//
// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/server/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'pencil',
  number: 2,
  title: 'Does It Pencil',
  subtitle:
    'Every one-to-two-family lot in Queens, priced against one real subsidy programme and tinted by the monthly cash flow a backyard unit on it would produce.',
  status: 'built',
  statusNote:
    'The financial model is published, not invented: the programme terms come from HPD and HCR\'s Plus One ADU term sheet, the construction cost from HPD\'s Pre-Approved Plan Library, and the soft and operating costs from HPD\'s own ADU budgeting tool. The unit size comes from ZR 23-341(b)(4) and ZR 23-342 directly. The eligibility flags are ours, derived from those rules, because the city publishes no ADU eligibility layer - and one of them approximates a DEP map we could not obtain.',
  kind: 'model',
  blurb:
    "Not a map of where an accessory dwelling unit is allowed - that map is a zoning map and it is boring, and you can draw it here for comparison. A map of where one would pay. Numbers off a government term sheet, a government plan library and a government budgeting tool, run as a pro-forma on 246,921 lots at once and recomputed on every slider move. Two findings fall straight out of it: the 800 square foot cap everyone quotes almost never binds, because the one-third-of-the-rear-yard rule bites first; and with the grant switched off, not one eligible lot in Queens can be built for what the programme will lend.",
  controls: [
    'the grant ceiling and how much of the cost the owner puts in',
    'the interest rate and the length of the loan',
    'construction cost per square foot',
    'whether rent is the programme\'s AMI cap, market rent, or a flat figure',
    'whether the City of Yes eligibility rules apply at all',
    'the monthly cushion the deal has to clear',
    'the two numbers in the zoning rule that size the unit - the share of the rear yard, and the side setback',
    'how many permits a year, and which year you are looking at'
  ],
  metrics: [
    'lots that pencil, and their share of the eligible set',
    'units built by the selected year, cumulatively',
    'units built in that year alone',
    'the monthly margin at the median passing lot',
    'the unit size at the median passing lot',
    'how many of the built units have room behind the house at all',
    'the median tract income where units land',
    'the share of units falling in the top tenth of tracts'
  ],
  data: [
    'MapPLUTO 26v2: 246,921 Queens one-to-two-family lots, with lot width and depth, building footprint, DOF\'s proximity code, zoning district, transit zone, historic district, FEMA flood flags, ZIP and census tract. Only the .dbf is read.',
    'ZR 12-10, 23-341(b)(4), 23-342 and 64-11, read from the Zoning Resolution itself: what an ancillary dwelling unit is, how big it may be, how deep a rear yard the lot must keep, and what the flood restrictions actually say.',
    'HPD Pre-Approved Plan Library: eleven published designs with dimensions and cost ranges, whose midpoints run from $248 to $1,500 a square foot.',
    'HPD ADU Budgeting Tool: the soft cost formula and the operating defaults, recovered by driving its sliders one at a time.',
    'HPD and HCR Plus One ADU term sheet: the loan and grant ceilings, the rate, the term, the rent cap and the $200 cushion. Every figure quoted.',
    'HUD Small Area Fair Market Rents FY2026, by ZIP - market rent, which varies across Queens.',
    'HUD FY2026 Income Limits for the New York, NY HUD Metro FMR Area - eight counties including Westchester and Rockland, so the AMI rent cap does not vary across Queens at all.',
    'Census ACS 5-year 2023: median household income by tract.',
    'NYC Open Data 27ya-gqtm and ek8y-fsqz: the NPCC 2050s and 2080s floodplains, standing in for DEP\'s 10-year rainfall and coastal flood risk areas. They are the ingredients DEP builds those areas from, not the areas themselves - the adopted map was not obtainable, and the card says so.'
  ],
  cannotSee:
    "Whether a homeowner can raise the equity, wants a tenant, or trusts the city. Lots that pass are not lots that build. It cannot see which way a lot faces: nothing in the data says where the street is, so the back garden is taken to be the side away from the house, which is wrong for a corner lot and for a house built at the back of its own parcel. And the required rear yard it sizes the unit from is a rectangle the full width of the lot, because MapPLUTO records no shape - though the drawing does use the real lot outline and the real building footprints to decide where the unit stands. It also cannot see who owns the house they live in: the programme requires the owner to reside there 270 days a year, and there is no dataset of who lives where, so that requirement is simply absent from the model rather than modelled badly. There is no contractor, no financing rejection, no family, and nobody who just doesn't want to.",
  tutorial: '/tutorials/02-pencil/',
  live: false
};
