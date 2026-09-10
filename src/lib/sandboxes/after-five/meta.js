// PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide.
//
// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/server/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'after-five',
  title: 'Office to Residential Conversion',
  subtitle: 
    "Lower Manhattan in 2040, after the state's conversion incentive has closed. Office buildings become housing when a conversion would be worth more than the office, and the sidewalks show how the district's day changes when they do.",
  status: 'built',
  statusNote:
    'The massing, the two gates, the clock, the crowd and the street layer are built. The default is the Comptroller pro forma, at which 137 of the 381 office buildings in CD1 convert; at the published asking rent nothing does, and the four scenarios are that difference written out. Workers run on counted subway ridership by hour and residents on a national time-use survey; the building each trip goes to and the route are assumed, and the canvas labels which is which.',
  kind: 'simulation',
  blurb: 
    "Two tests decide whether an office building becomes housing: whether its floor plate and age make it convertible at all, and whether the finished apartments would be worth more than the offices given up after paying for the work. The financial test can be set to one of four scenarios - the 2024 asking rent, a 2026 effective rent, the Comptroller's 2025 pro forma, or a program generous enough to reach everything - or to numbers of your own. The first three are published; the fourth is not, and its note says so. The sidewalks are then colored by how many people each building puts onto them at each hour of the day, offices on a commuter's schedule and homes on a resident's.",
  controls: [
    'which district: Lower Manhattan, Midtown, or both',
    'whether the map shows sidewalk activity, who is on the street, or which buildings could convert',
    'the hour of the day, which plays',
    'whether a converted building is drawn with the floors it could add',
    'which of four scenarios sets the seven numbers in the deal and the convertibility threshold, or your own; three are published and the fourth is not',
    'the office and residential rents, their operating cost shares and their capitalization rates',
    'the cost of the conversion work per square foot',
    'the convertibility threshold, and the weight on each of its four criteria',
    "whether the 467-m eligibility rules apply, and which conversion filings the floor area per apartment is measured from"
  ],
  metrics: [
    'people on the sidewalks at this hour, from offices and from homes',
    'homes created',
    'office floor area removed',
    'buildings converted, of the office buildings there are',
    'residents living there afterwards',
    'office jobs displaced',
    'the share of office buildings that converted'
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
    "Who any person is. Station flows by hour are counted, but not split by who is riding, so treating morning arrivals as workers is the model's assumption; residents' hours come from a national survey, not a New York count. Anyone arriving by ferry, bus, bike, car or on foot is invisible, because only the subway was counted, and so is anyone who works in the district's shops, hotels and restaurants. The sidewalk numbers are people a building sends out and takes in each hour, spread over the sidewalk near it, not people observed on a street. There is no sidewalk dataset: a cell counts as sidewalk when it is within 15 m of a walkable street centerline and not inside a building, which is roughly a curb-to-building depth plus a lane on a side street and still too narrow for a wide avenue, and the 15 m is ours. Ground away from a street is not in the model at all, which is why nobody stands on the World Trade Center memorial plaza. A building's people are spread evenly around its perimeter, so the map is people per 10 m of street rather than people in a building. It cannot see buildings the 2014 survey is missing: floor area is divided across the buildings on a lot, so a lot whose survey is incomplete hands the missing buildings' area to the ones it has, which is why 1 WTC carries the floor area of 3 WTC, 4 WTC and the Oculus as well as its own. A cap holds every building to what its own outline could contain, but that bounds the error rather than removing it. It cannot see who moves in, who is displaced, or where a displaced job goes. Conversion is instant, added floors have no form, and rents are uniform. The date is 2040 because the incentive closes in 2039; the model has no other clock.",
  tutorial: '/tutorials/02-after-five/',
  live: false
};
