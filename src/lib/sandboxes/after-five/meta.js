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
    'Lower Manhattan as massing, with office buildings turning into housing as two gates open. The gates are a score we invented and a tax rule we could only half read.',
  status: 'partial',
  statusNote:
    'The massing, the two gates and the year scrubber are built. The moving crowd the sandbox is named for is NOT built: it needs a citable published account of who is on the street when, and none was settled. The number of residents present is computed from published data; nothing is animated, because animating a schedule nobody published is the failure this course exists to name.',
  kind: 'simulation',
  blurb:
    'Every building in Manhattan Community District 1, from the city\'s own 3D survey, with its real identity attached. Office buildings convert to housing when a convertibility score clears a threshold and the residential deal beats the office income given up - and the only thing that makes time pass is the office rent trend. The interesting part is how much of downtown is decided by two numbers, one of which we made up and the other of which the state has not published in full.',
  controls: [
    'the year, snapped to the six the model actually has opinions about',
    'conversion cost per square foot',
    'residential rent per square foot per year',
    'how office rent drifts - the only thing that makes time pass',
    'the convertibility threshold, against a score that is ours',
    'whether 467-m\'s eligibility rules apply',
    'whether added floors are drawn'
  ],
  metrics: [
    'units created',
    'office floor area removed',
    'buildings converted, of the office buildings there are',
    'residents living there afterwards',
    'the share of office buildings that converted'
  ],
  data: [
    'DCP 3-D Building Model as CityGML (NYC Open Data tnru-abg2), delivery areas 12 and 19: 1,159 buildings in CD1, each with its BIN, its ground outline and every roof surface at its own height.',
    'The same survey is also published as Rhino .3dm per district. It carries no identifiers at all, and inferring them by position was wrong for one building in five - which is why the CityGML is used instead.',
    'MapPLUTO 26v2, joined on BBL: floor areas, office area, floors, year built, depth. Lot-level areas are divided across the buildings standing on each lot.',
    'DOB Job Application Filings (ic3t-wcy2), change-of-use filings 2000-2025.',
    'DOB NOW Certificate of Occupancy (pkdm-hqz6), completed conversions - renewals excluded, because a re-issued certificate is not a conversion.',
    'Gensler\'s published convertibility criteria, as criteria. The scoring and weights behind them are not published, so the score here is ours.',
    'RPTL 467-m as published by HPD. The eligibility tests are in the FAQ; the benefit schedule is not, so the incentive is modelled as a gate and not as money.'
  ],
  cannotSee:
    'Anyone on the street. The sandbox is named for nine in the evening and there is no crowd in it, because building one honestly needs a published account of who is where and when, and that was not settled - so what is reported is a count of residents rather than a picture of movement. It also cannot see who moves in, whether the ground floor becomes a shop or a lobby, or anything about the office workers being replaced. Conversion is instant at the moment the deal clears, added floors have no form, and rents are uniform across the whole district.',
  tutorial: '/tutorials/03-after-five/',
  live: false
};
