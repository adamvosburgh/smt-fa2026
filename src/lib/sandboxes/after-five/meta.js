// PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide.
//
// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/server/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'after-five',
  title: 'After Five',
  subtitle:
    'Lower Manhattan as massing, with office buildings turning into housing as two gates open. The gates are a score we invented and a tax rule we could only half read - and at the one rent in the model that has a source, nothing converts at all.',
  status: 'built',
  statusNote:
    'The massing, the two gates, the transports and the agent layer are built. AT THE DEFAULTS NOTHING CONVERTS, which is the model\'s answer and not a failure - the office rent it competes against is the published asking rent rather than the unsourced figure that used to be in the code. An earlier version of this note said nothing published describes when this district\'s day empties. That was true of the two trip tables it had evaluated and FALSE IN GENERAL: the MTA\'s origin-destination ridership estimate counts arrivals and departures at every subway complex by hour and day of week, and those counted taps are what the crowd now runs on. What stays assumed - the building each trip starts at, the shortest-path route - is printed on the canvas next to the one line that is measured.',
  kind: 'simulation',
  blurb:
    'Every building in Manhattan Community District 1, from the city\'s own 3D survey, with its real identity attached. Office buildings convert to housing when a convertibility score clears a threshold and the residential deal beats the office income given up - and the only thing that makes time pass is the office rent trend. The office rent was in the model twice, at two different values, neither sourced; replacing both with the Comptroller\'s published $54 makes the map go blank. Of the three figures in the deal, one has a source, and at that source the answer is don\'t.',
  controls: [
    'the hour of day - the primary clock, playing by default; playing the year holds it and playing it holds the year',
    'the crowd: how many agents stand in for the day, and whether their schedule is the measured MTA curve or four bell curves whose defaults are read off it',
    'the year, snapped to the six the model actually has opinions about',
    'conversion cost per square foot',
    'residential rent per square foot per year',
    'how office rent drifts - the only thing that makes time pass',
    'the office rent, four named scenario stops - the published $54 asking figure and three of ours, each with its justification on the control',
    'two capitalisation rates now, office and residential, defaulting equal - equal is what the model used to do silently - plus the operating-cost share, all market conventions rather than measurements',
    'the unit floor in the conversion sample the floor-area-per-apartment figure is measured from - six measured cuts, and the choice moves the answer by 40%',
    'the four weights behind the convertibility score, one per criterion',
    'the convertibility threshold, against a score that is ours',
    'whether 467-m\'s eligibility rules apply',
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
    'The same survey is also published as Rhino .3dm per district. It carries no identifiers at all, and inferring them by position was wrong for one building in five - which is why the CityGML is used instead.',
    'MapPLUTO 26v2, joined on BBL: floor areas, office area, floors, year built, depth. Lot-level areas are divided across the buildings standing on each lot.',
    'DOB Job Application Filings (ic3t-wcy2), change-of-use filings 2000-2025.',
    'DOB NOW Certificate of Occupancy (pkdm-hqz6), completed conversions - renewals excluded, because a re-issued certificate is not a conversion.',
    'Gensler\'s published convertibility criteria, as criteria. The scoring and weights behind them are not published, so the score here is ours and its weights are controls. The one number of theirs anyone can check against is the share they published: about a quarter of the 1,300+ buildings they scored came out suitable, and the legend marks where our threshold would have to sit to agree.',
    'Office rent: $54/sf/yr asking, Manhattan class B and C combined, CoStar as of 30 April 2024, in the NYC Comptroller\'s Spotlight of 14 May 2024. Pinned to that edition - the November 2025 successor drops rent by class, so it cannot be refreshed from this source.',
    'Floor area per apartment: 1,152 sf, measured from 149 DOB filings 2001-2025 where a Manhattan building with no apartments became a residential one of ten units or more. It replaces an unsourced 900.',
    'LEHD LODES 8 Workplace Area Characteristics, New York State, 2023: primary jobs by workplace census block, joined on MapPLUTO BCTCB2020. 198,677 office-using jobs in CD1 and 667,498 in CD5.',
    '2020 decennial census, total population by tract: 85,841 residents in CD1 and 92,438 in CD5. Manhattan\'s tracts total 1,694,251, which is the published county count exactly - that is what made the join believable.',
    'RPTL 467-m as published by HPD. The eligibility tests are in the FAQ; the benefit schedule is not, so the incentive is modelled as a gate and not as money.',
    'MTA Subway Origin-Destination Ridership Estimate 2024 (data.ny.gov jsu2-fbtj), fetched as server-side aggregates: arrivals at and departures from each study complex by hour, October 2024 weekdays. 116 million rows at source; a few hundred after grouping, which is all the crowd ever needs.',
    'MTA Subway Entrances and Exits 2024 (i9wp-a4ja): where each complex\'s stairs actually are. A complex\'s flow splits evenly across them, which is an assumption.',
    'NYC Street Centerline (inkn-q76z), clipped to the districts and filtered to walkable segments: the graph the trips are routed on.',
    'ATUS 2003-2025 (BLS): the share of management, business, financial and professional workers at their workplace through the day - the counted curve the animation is checked against, not the thing that drives it.'
  ],
  cannotSee:
    'Who any walker is. The crowd runs on counted taps - the MTA\'s origin-destination estimate says how many people pass each subway complex each hour of a 2024 weekday - but the taps are not split by who is riding, so attributing the morning\'s arrivals to workers and the evening\'s to residents is the model\'s assumption, printed on the canvas. So is the building each trip starts at (proportional to jobs - nothing says the people leaving 195 Broadway at 5:40 work there) and the route (the shortest path, which nobody actually walks). Anyone who arrives by ferry, bus, bike, car or foot from outside the district is invisible: the gateways are subway stations because the subway is what got counted. It also cannot see who moves in, who is displaced, whether a displaced job vanishes or moves down the block, or whether the ground floor becomes a shop or a lobby. Conversion is instant at the moment the deal clears, added floors have no form, and rents are uniform across the whole district.',
  tutorial: '/tutorials/02-after-five/',
  live: false
};
