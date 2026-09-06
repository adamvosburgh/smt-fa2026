// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/server/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'after-five',
  title: 'Office to Residential Conversion',
  subtitle:
    'Lower Manhattan in three dimensions, with office buildings turning into housing as a deal clears, and a crowd walking between the subway stations and the buildings over the course of a day. An experiment in what conversion would do to a district, rather than in whether it pays.',
  status: 'built',
  statusNote:
    'The massing, the two gates, the clock, the crowd and the street layer are built. At the default settings nothing converts: the office rent the deal competes against is the published asking rent, and at that figure the residential deal never beats it before 2050. The workers run on counted subway ridership by hour and the residents on the American Time Use Survey\'s not-employed weekday curves; the building each trip starts at and the route it takes are assumed, and the canvas labels which is which.',
  kind: 'simulation',
  blurb:
    'Every building in Manhattan Community District 1 from the city\'s own 3D survey. An office building converts to housing when a convertibility score clears a threshold and the residential deal beats the office income given up. Six dates, an hour-of-day clock, and a crowd drawn from MTA ridership counts. Of the three figures in the deal, one has a source, and at that source nothing converts.',
  controls: [
    'the hour of day, which plays by default and moves the crowd; playing the year holds it and playing it holds the year',
    'whether the streets are coloured by how many walkers cross each segment during the selected hour; clicking a segment stands the camera on it at eye height',
    'the chance that a converted building\'s ground floor becomes an active frontage, drawn as a warm or dark line at its base; the probability is ours',
    'a two-hour comparison that draws the crowd at a second hour in a second colour and colours the streets by the difference in walkers between the hours',
    'the crowd: how many walkers stand in for the day, and whether their schedule is the measured MTA curve or four bell curves whose defaults are read off it',
    'where the residents\' times come from: their own day, from the American Time Use Survey\'s not-employed weekday diaries, or a mirror of the workers\' commute',
    'the year, one of six dates from 2025 to 2050',
    'conversion cost per square foot',
    'residential rent per square foot per year',
    'how office rent drifts each year, which is what moves the model through time',
    'the office rent, at four named stops: the published $54 asking figure and three of ours, each with its justification on the control',
    'two capitalisation rates, office and residential, defaulting equal, plus the operating-cost share; all market convention rather than measurement',
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
    'Who any walker is. The crowd runs on counted subway taps by hour, but the taps are not split by who is riding, so treating the morning\'s arrivals as workers and the evening\'s as residents is the model\'s assumption, labelled on the canvas; giving residents the ATUS not-employed day instead swaps that assumption for a national survey\'s, not for a New York count. So is the building each trip starts at (in proportion to jobs) and the route (the shortest path) - which means the street counts are counts of routed trips, not of anyone observed on that street. Anyone who arrives by ferry, bus, bike, car or on foot from outside the district is invisible, because the subway is what got counted. It cannot see who moves in, who is displaced, whether a displaced job vanishes or moves down the block, or what a ground floor is actually used for - the lit-or-dark frontage on converted buildings is a probability slider of ours, not a record. Conversion is instant, added floors have no form, and rents are uniform across the district. Standing on a street is a camera move over the same assumed routes, not a different model.',
  tutorial: '/tutorials/02-after-five/',
  live: false
};
