// PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide.
//
// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'after-five',
  title: 'Office to Residential Conversion',
  subtitle:
    'Visualization of street-level activity under different scenarios of office to residential conversions.',
  status: 'built',
  statusNote:
    'The massing, the two gates, the clock, the crowd and the street layer are built. The default is the Comptroller pro forma, at which 137 of the 381 office buildings in CD1 convert; at the published asking rent nothing does, and the four scenarios are that difference written out. Workers run on counted subway ridership by hour and residents on a national time-use survey.',
  kind: 'simulation',
  blurb:
    'A visualization of street-level activity in two central business districts under different scenarios of office to residential conversion. A commercial building converts when two tests pass: its floor plate and age make it convertible, and the finished apartments would be worth more than the offices given up after paying for the work. The sidewalks are then colored by how many people each building sends onto them at each hour of the day, offices on a commuter\'s schedule and homes on a resident\'s. Everything is set in 2040, the year after the deadline in the state\'s conversion incentive.',
  controls: [
    'District: CD 1 Lower Manhattan, CD 5 Midtown, or both',
    'Show: sidewalk activity, who is on the street, or which buildings could convert',
    'Hour of day, which plays',
    'Scenario: which of four sets the seven deal numbers and the convertibility threshold, or custom; three are published and the fourth is not',
    'Office rent, its operating cost share and its capitalization rate',
    'Residential rent, its operating cost share and its capitalization rate',
    'Conversion cost per square foot',
    'Convertibility threshold',
    'The weight on each of the four convertibility criteria: floor plate depth, floor-to-floor, floor plate area, age',
    'Whether the 467-m eligibility rules apply'
  ],
  metrics: [
    'people on the sidewalks at this hour, from offices / from homes',
    'homes created',
    'office floor area removed',
    'buildings converted, of the office buildings there are',
    'share of office buildings that converted'
  ],
  data: [
    'DCP 3-D Building Model as CityGML (NYC Open Data tnru-abg2), delivery areas 12 and 19: 1,159 buildings in CD1, each with its BIN, its ground outline and every roof surface at its own height.',
    'The same survey as Rhino .3dm per district carries no identifiers; inferring them by position was wrong for one building in five, which is why the CityGML is used.',
    'MapPLUTO 26v2, joined on BBL: floor areas, office area, floors, year built, depth. Lot-level areas are divided across the buildings on each lot in proportion to each building\'s footprint area times its height, and no building is given more than its own outline could hold at its lot\'s floor count. That cap removed 8.9M sf across the district, 2.3% of the total, and none of it is put anywhere else.',
    'DOB Job Application Filings (ic3t-wcy2), change-of-use filings 2000-2025.',
    'DOB NOW Certificate of Occupancy (pkdm-hqz6), completed conversions, renewals excluded.',
    'Gensler\'s published convertibility criteria, as criteria; the scoring is proprietary, so the score here is ours and its weights are controls. Their one public figure is that about a quarter of the 1,300+ buildings they scored came out suitable.',
    'Office rent: $54/sf/yr asking, Manhattan class B and C combined, CoStar as of 30 April 2024, in the NYC Comptroller\'s Spotlight of 14 May 2024.',
    'Floor area per apartment: 1,152 sf, measured from 149 DOB filings 2001-2025 where a Manhattan building with no apartments became a residential one of ten units or more.',
    'LEHD LODES 8 Workplace Area Characteristics, New York State, 2023: 198,677 office-using jobs in CD1 and 667,498 in CD5.',
    '2020 decennial census, total population by tract: 85,841 residents in CD1 and 92,438 in CD5.',
    'RPTL 467-m as published by HPD: the eligibility tests are in the FAQ, the benefit schedule is not, so the incentive is a gate rather than money.',
    'MTA Subway Origin-Destination Ridership Estimate 2024 (jsu2-fbtj), as server-side totals: arrivals at and departures from each complex by hour, October 2024 weekdays.',
    'MTA Subway Entrances and Exits 2024 (i9wp-a4ja): where each complex\'s stairs are.',
    'NYC Street Centerline (inkn-q76z), clipped to the districts and filtered to walkable segments: 7,413 lines, and the sidewalk is the 15 m band around them that is not inside a building.',
    'ATUS 2003-2025 (BLS): the share of office-type workers at their workplace through the day, drawn as a check on the animation.'
  ],
  cannotSee:
    "Who any person is. Station flows are counted by hour but not split by who is riding, so treating morning arrivals as workers is the model's assumption, and residents' hours come from a national survey, not a New York count. Anyone who is not a subway rider or a resident of the district is not counted: ferry, bus, bike, car and foot commuters, visitors, and people who work in the district's shops, hotels and restaurants. The sidewalk numbers are people a building sends out and takes in each hour, spread over the street within 50 m of it, not people observed on a street. There is no sidewalk dataset; the 15 m band around each street centerline is our choice, and ground away from a street, such as the World Trade Center memorial plaza, is not in the model. Where the 2014 survey is missing a building on a lot, the lot's floor area goes to the buildings it has, so 1 WTC carries more floor area than it has; the cap that holds each building to its own outline bounds that error without removing it. Conversion is instant, every apartment is occupied, rents are uniform, no height is added, and the incentive is a gate and a tax figure with no time value of money. It cannot see who moves in, who is displaced, or where a displaced job goes. The date is 2040 because the incentive requires completion by the end of 2039; the model has no other clock.",
  tutorial: null,
  live: false
};
