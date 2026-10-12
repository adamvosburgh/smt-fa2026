## Description

This sandbox estimates how much rain the street trees of upper Manhattan catch each year from 2015 to 2045. It is a demo, built in [Tutorial 4](/tutorials/04-notebook-to-sandbox/) from the notebook in [Tutorial 3](/tutorials/03-simulating-trees/), and it uses a simplified version of the method the city uses to make the same estimate. The NYC Parks Department estimates the benefits of street trees with i-Tree, software from the USDA Forest Service.[^parks] This sandbox does the stormwater part only, and in a much simpler way.

The trees are the living street trees of upper Manhattan in the 2015 census.[^census] Each tree is matched to one of 21 species measured in Queens, and the Urban Tree Database gives an equation for each species that estimates the crown's diameter from the trunk's diameter.[^utd] The crown is treated as a circle. The rain that falls on that circle in a year, times the share the crown catches, is the stormwater the tree catches:

crown area (m²) × rainfall (in) × 0.0254 × interception × 264.17 = gallons a year

0.0254 converts inches to meters and 264.17 converts cubic meters to gallons. The default rainfall is 41.0 inches, the year i-Tree uses for the Northeast.[^guide] The default interception is 15%, from a field study of one tree.[^xiao]

The run goes from 2015 to 2045. Each year, every tree grows by its species' growth curve, some trees die, and new trees can be planted on the sites the census recorded as dead trees or stumps. The block view adds up the trees in each 2010 census block.[^blocks]

[^parks]: NYC Parks, [Tree Map: Learn about the benefits](https://www.nycgovparks.org/tree-map/learn/benefits). The Parks average for the 2015 census is 1,376 gallons a year per street tree, citywide ([TreesCount! 2015](https://www.nycgovparks.org/trees/treescount/report)). The median tree here in 2015 is 1,455 gallons.
[^census]: [2015 Street Tree Census](https://data.cityofnewyork.us/d/uvpi-gqnh), NYC Parks, NYC Open Data, clipped to upper Manhattan for the tutorials. 12,094 living trees, of which one is dropped for a recorded trunk of 228 inches. 388 dead trees and 233 stumps are used as planting sites.
[^utd]: McPherson, van Doorn and Peper, [Urban Tree Database](https://doi.org/10.2737/RDS-2016-0005), 2016, Table S6, Northeast region (Queens, 2005). The equation forms are in Table 3 of the [report](https://research.fs.usda.gov/treesearch/52933).
[^guide]: McPherson et al., [Northeast Community Tree Guide](https://research.fs.usda.gov/treesearch/28759), USDA Forest Service, 2007. Rainfall at JFK in 2000, p. 100. Death rates, p. 94.
[^xiao]: Xiao et al., [Winter rainfall interception by two mature open-grown trees in Davis, California](https://research.fs.usda.gov/treesearch/61750), *Hydrological Processes* 14, 2000. A Callery pear caught 15% of the rain over its crown and a cork oak caught 27%.
[^blocks]: [2010 Census Blocks](https://www.nyc.gov/site/planning/data-maps/open-data/census-download-metadata.page), NYC Department of City Planning, clipped to the same area. Each tree is placed in the block it stands in. 267 trees and sites that fall outside every block are placed in the nearest one.

## Assumptions + Limitations

- Every tree catches the same share of the rain, whatever its species, size or leaves.
- Every year gets the same rainfall. There are no storms, and no difference between a light rain and a heavy one.
- The crown is a circle, and its size comes only from the trunk diameter.
- Trees of a species that is not one of the 21 are modelled as a species of the same genus, and if there is none, as a honeylocust, the most common tree in the census here.
- Growth comes from the species' age curve. A tree whose age is past the end of the curve stops growing.
- Deaths are random. Trees under 5 years old die at 2.8% a year and older trees at 0.57%, by default. A tree's age is estimated from its trunk diameter.
- New trees are all honeylocusts with a 3-inch trunk, planted on sites chosen at random from the 621 dead trees and stumps. A site stays taken once planted, and a tree that dies during the run does not open a new site.
- The model does not know about drainage, slopes, soil, pavement or sewers, so it cannot say where the water would have gone or whether catching it mattered there.
- The model does not include the people and policies that plant, water, prune and remove street trees.
- The equations were measured in Queens in 2005. They are used here for Manhattan for thirty years.
- This leaves out the other benefits Parks estimates, such as carbon, air quality and energy.
