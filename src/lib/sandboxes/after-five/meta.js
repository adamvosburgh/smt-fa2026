// PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide.
//
// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/server/assistant-prompt.js, so they must agree
// with card.md.
export default {
  slug: 'after-five',
  number: 3,
  title: 'After Five',
  subtitle:
    'Lower Manhattan as massing, with office buildings turning into housing as two gates open. The gates are a score we invented and a tax rule we could only half read - and at the one rent in the model that has a source, nothing converts at all.',
  status: 'partial',
  statusNote:
    'The massing, the two gates, the year scrubber and the presence panel are built. AT THE DEFAULTS NOTHING CONVERTS, which is the model\'s answer and not a failure - the office rent it competes against is now the published asking rent rather than the unsourced figure that used to be in the code. The moving crowd the sandbox is named for is NOT built and will not be. The two populations are counted - office-using jobs from LODES, residents from the 2020 census - but NOTHING PUBLISHED SAYS WHEN EITHER OF THEM IS ON THE STREET. The national travel survey is six bands wide and national; the census asks when people leave FOR work, so it describes the morning. There is no evening table. A curve through those two counts, or a trip animation over them, would be invented at both ends: the schedule and the building each trip starts at.',
  kind: 'simulation',
  blurb:
    'Every building in Manhattan Community District 1, from the city\'s own 3D survey, with its real identity attached. Office buildings convert to housing when a convertibility score clears a threshold and the residential deal beats the office income given up - and the only thing that makes time pass is the office rent trend. The office rent was in the model twice, at two different values, neither sourced; replacing both with the Comptroller\'s published $54 makes the map go blank. Of the three figures in the deal, one has a source, and at that source the answer is don\'t.',
  controls: [
    'the year, snapped to the six the model actually has opinions about',
    'conversion cost per square foot',
    'residential rent per square foot per year',
    'how office rent drifts - the only thing that makes time pass',
    'the discount between asking rent and what a landlord actually collects, which nobody publishes and which the sandbox therefore refuses to guess for you',
    'the capitalisation rate and the operating-cost share, both market conventions rather than measurements',
    'the four weights behind the convertibility score, one per criterion',
    'the convertibility threshold, against a score that is ours',
    'whether 467-m\'s eligibility rules apply',
    'whether added floors are drawn'
  ],
  metrics: [
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
    'RPTL 467-m as published by HPD. The eligibility tests are in the FAQ; the benefit schedule is not, so the incentive is modelled as a gate and not as money.'
  ],
  cannotSee:
    'When anybody is on the street. The two populations are counted - 198,677 office-using jobs and 85,841 residents in Lower Manhattan - and the conversions move both, trading roughly one office job for one resident. What is missing is the hours between them: the national travel survey says only that 28% of trips begin between six and midnight, and the census asks when people leave FOR work, so nothing published says when a Manhattan office empties. There is therefore no crowd, no curve and no trip animation, because the schedule and the building each trip would start at would both be invented. It also cannot see who moves in, who is displaced, whether a displaced job vanishes or moves down the block, or whether the ground floor becomes a shop or a lobby. Conversion is instant at the moment the deal clears, added floors have no form, and rents are uniform across the whole district.',
  tutorial: '/tutorials/03-after-five/',
  live: false
};
