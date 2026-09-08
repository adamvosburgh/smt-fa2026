// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/server/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'after-five',
  title: 'Office to Residential Conversion',
  subtitle:
    'Lower Manhattan in three dimensions. Office buildings turn into housing when a deal clears, a crowd walks between the subway stations and the buildings over a day, and the streets are colored by how many people are on them. An experiment in what conversion would do to a district, not in whether it pays.',
  status: 'built',
  statusNote:
    'The massing, the two gates, the clock, the crowd and the street layer are built. At the default settings nothing converts, because the office rent is the published asking rent and the residential deal never beats it before 2050. Workers run on counted subway ridership by hour and residents on a national time-use survey; the building each trip goes to and the route are assumed, and the canvas labels which is which.',
  kind: 'simulation',
  blurb:
    'Every building in Manhattan Community District 1 from the city\'s own 3D survey. An office building converts to housing when a convertibility score clears a threshold and the residential deal beats the office income given up. Six dates, an hour-of-day clock, and a crowd drawn from MTA ridership counts. Of the three figures in the deal, one has a source, and at that source nothing converts.',
  controls: [
    'the hour of day, which plays by default and moves the crowd; playing the year holds it and playing it holds the year',
    'whether streets are colored by how many walkers cross them in the selected hour; clicking a street puts the camera on it at eye height',
    'the chance that a converted building\'s ground floor is active, drawn as a warm or dark edge at its base; the probability is ours',
    'a two-hour comparison: the crowd at a second hour in a second color, and streets colored by the difference between the hours',
    'the crowd: how many walkers stand in for the day, and whether their schedule is the measured MTA curve or four bell curves whose defaults are read off it',
    'where residents\' times come from: the American Time Use Survey\'s diaries of people not employed, or a mirror of the workers\' commute',
    'the year, one of six dates from 2025 to 2050',
    'conversion cost per square foot',
    'residential rent per square foot per year',
    'how office rent drifts each year, which is what moves the model through time',
    'the office rent, at four named stops: the published $54 asking figure and three of ours, each with its justification on the control',
    'two capitalization rates, office and residential, defaulting equal, plus the operating-cost share; all market convention rather than measurement',
    'which conversion filings the floor-area-per-apartment figure is measured from; six measured cuts, and the choice moves the figure by 40%',
    'the four weights behind the convertibility score, one per criterion',
    'the convertibility threshold',
    'whether the state tax exemption\'s eligibility rules apply',
    'whether added floors are drawn'
  ],
  metrics: [
    'who is mid-walk at this hour, workers against residents',
    'units created',
    'office floor area removed',
    'buildings converted, of the office buildings there are',
    'residents living there afterwards',
    'office jobs displaced',
    'the share of office buildings that converted'
  ],
  data: [
    'DCP 3-D Building Model as CityGML (NYC Open Data tnru-abg2), delivery areas 12 and 19: 1,159 buildings in CD1, each with its BIN, its ground outline and every roof surface at its own height.',
    'The same survey as Rhino .3dm per district carries no identifiers; inferring them by position was wrong for one building in five, which is why the CityGML is used.',
    'MapPLUTO 26v2, joined on BBL: floor areas, office area, floors, year built, depth. Lot-level areas are divided across the buildings on each lot.',
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
    'NYC Street Centerline (inkn-q76z), clipped to the districts and filtered to walkable segments: the graph the trips are routed on.',
    'ATUS 2003-2025 (BLS): the share of office-type workers at their workplace through the day, drawn as a check on the animation.'
  ],
  cannotSee:
    'Who any walker is. Station flows by hour are counted, but not split by who is riding, so treating morning arrivals as workers is the model\'s assumption; residents\' hours come from a national survey, not a New York count. The building each trip goes to (by jobs) and the route (shortest path) are assumed, so the street counts are counts of routed trips, not of people observed. Anyone arriving by ferry, bus, bike, car or on foot is invisible, because only the subway was counted. It cannot see who moves in, who is displaced, where a displaced job goes, or what a ground floor is used for; the active-or-dark frontage is a probability we chose. Conversion is instant, added floors have no form, and rents are uniform. Standing on a street is a camera move over the same assumptions.',
  tutorial: '/tutorials/02-after-five/',
  live: false
};
