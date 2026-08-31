export default {
  slug: 'after-five',
  number: 3,
  title: 'After Five',
  subtitle: 'Two clocks over Lower Manhattan: years of conversion, and one looping day.',
  status: 'planned',
  kind: 'simulation',
  blurb:
    'The slow clock is years - buildings recolor office to residential and grow added floors. The fast clock is one looping day, ~2,000 agents on the street network. Scrub the year while the day loops and watch the district stop flatlining at night.',
  controls: ['year', 'conversion cost/sf', 'residential rent', 'office rent trajectory', '467-m on/off', 'convertibility threshold'],
  metrics: ['units created', 'office sf removed', 'buildings converted', 'people on the street at 9pm', 'weekend activity index'],
  data: ['DCP 3D Building Model', 'DOB Job Application Filings (job_type A1)', 'MapPLUTO', 'osmnx street graph', 'published occupancy schedules'],
  cannotSee: 'The schedules are averages. Nobody in this model has a reason to be anywhere.',
  tutorial: null,
  live: false
};
