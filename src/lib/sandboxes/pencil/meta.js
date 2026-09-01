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
    'The financial model is published, not invented: every term comes from HPD and HCR\'s Plus One ADU term sheet. The eligibility flags are ours, derived from the published City of Yes rules, because the city publishes no ADU eligibility layer.',
  kind: 'model',
  blurb:
    "Not a map of where an accessory dwelling unit is allowed - that map is a zoning map and it is boring, and you can draw it here for comparison. A map of where one would pay. Nine numbers off a government term sheet, run as a pro-forma on 246,921 lots at once, recomputed on every slider move. The pattern that comes out is the opposite of the obvious one: the big lots in eastern Queens mostly fail, because a bigger unit costs more than the loan will cover.",
  controls: [
    'the grant ceiling and how much of the cost the owner puts in',
    'the interest rate and the length of the loan',
    'construction cost per square foot',
    'whether rent is the programme\'s AMI cap, market rent, or a flat figure',
    'whether the City of Yes eligibility rules apply at all',
    'the monthly cushion the deal has to clear',
    'how many permits a year, and which year you are looking at'
  ],
  metrics: [
    'lots that pencil, and their share of the eligible set',
    'units built by the selected year, cumulatively',
    'units built in that year alone',
    'the monthly margin at the median passing lot',
    'the median tract income where units land',
    'the share of units falling in the top tenth of tracts'
  ],
  data: [
    'MapPLUTO 26v2: 246,921 Queens one-to-two-family lots, with lot area, building footprint, zoning district, transit zone, historic district, ZIP and census tract. Only the .dbf is read.',
    'HPD and HCR Plus One ADU term sheet: the loan and grant ceilings, the rate, the term, the rent cap and the $200 cushion. Every figure quoted.',
    'HUD Small Area Fair Market Rents FY2026, by ZIP - market rent, which varies across Queens.',
    'HUD FY2026 Income Limits for the New York, NY HUD Metro FMR Area - eight counties including Westchester and Rockland, so the AMI rent cap does not vary across Queens at all.',
    'Census ACS 5-year 2023: median household income by tract.',
    'NYC Open Data 27ya-gqtm and ek8y-fsqz: the 2050s and 2080s floodplains, as the closest published stand-in for the zoning rule\'s "expanded flood area".'
  ],
  cannotSee:
    "Whether a homeowner can raise the equity, wants a tenant, or trusts the city. Lots that pass are not lots that build. It also cannot see who owns the house they live in: the programme requires the owner to reside there 270 days a year, and there is no dataset of who lives where, so that requirement is simply absent from the model rather than modelled badly. There is no contractor, no financing rejection, no family, and nobody who just doesn't want to.",
  tutorial: '/tutorials/02-pencil/',
  live: false
};
