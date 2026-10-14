// subtitle, controls and cannotSee are read verbatim into the course
// assistant's prompt by src/lib/assistant-prompt.js, so they must agree
// with card.md.
export default {
  published: true,
  slug: 'street-trees',
  title: 'Street Tree Stormwater',
  subtitle:
    'A demo of the Tutorial 4 sandbox: how much rain the street trees of upper Manhattan catch each year from 2015 to 2045.',
  status: 'built',
  statusNote:
    'The worked example for Tutorial 4, built from the prompt in that tutorial. It uses the same three files the tutorial hands out: the 2015 street tree census for upper Manhattan, the 2010 census blocks for the same area, and the Urban Tree Database equations for 21 species measured in Queens.',
  kind: 'simulation',
  blurb:
    "An estimate of how much rain the street trees of upper Manhattan catch each year from 2015 to 2045. It is a demo, built in Tutorial 4, and it uses a simplified version of the method the city uses to make the same estimate. Each tree's crown size comes from an equation for its species. The crown catches a share of the rain that falls on it. Each year the trees grow, some die, and new trees can be planted on empty sites. The run goes from 2015 to 2045.",
  controls: [
    'Year: 2015 to 2045, playing by default',
    'Show: each tree, or totals by census block',
    'Planting sites and losses: on or off',
    'Rainfall, in inches a year',
    'Interception: the share of the rain over a crown that the crown catches',
    'Deaths a year for trees under 5 years old',
    'Deaths a year for trees 5 years and older',
    'New plantings a year, on the sites recorded as dead trees or stumps',
    'Random draw: which trees die and which sites are planted first'
  ],
  metrics: [
    'trees standing in the year shown',
    'of those, trees planted during the run',
    'stormwater caught in the year shown, in gallons',
    'change since 2015',
    'census trees lost since 2015',
    'planting sites left'
  ],
  data: [
    '2015 Street Tree Census, NYC Parks, NYC Open Data uvpi-gqnh, clipped to upper Manhattan. 12,093 living trees with a usable trunk diameter, and 621 dead trees and stumps used as planting sites.',
    '2010 Census Blocks, NYC Department of City Planning, clipped to the same area. Each tree is placed in a block by its location.',
    'Urban Tree Database (McPherson, van Doorn and Peper 2016), Table S6, Northeast region, measured in Queens in 2005: crown diameter from trunk diameter, age from trunk diameter, and trunk diameter from age, for 21 species.',
    'Rainfall of 41.0 inches (JFK, 2000) and death rates of 2.8% and 0.57% a year, from the Northeast Community Tree Guide (McPherson et al. 2007).',
    'Interception of 15%, from one Callery pear measured in Davis, California (Xiao et al. 2000).'
  ],
  cannotSee:
    "Rain as it actually falls. Every tree catches the same share of the same yearly total, so there are no storms, no difference between a light rain and a heavy one, and no difference between species. The model does not know about drainage, slopes, soil or sewers, so it cannot say where the caught water would have gone. Deaths and plantings are random, and plantings only use the sites the census recorded as dead trees or stumps. Nothing about who plants, waters or removes trees is in the model.",
  tutorial: null,
  // Hides the frame's "under construction" note for this sandbox.
  underConstruction: false,
  live: false
};
