## Description

A map of the world's land from 10,000 BC to 2017, colored by how people used it. The colors are the Anthromes (anthropogenic biomes) classification: urban, village, cropland, rangeland, seminatural, wild, and their subclasses.[^anthromes] The classification applies a set of thresholds to six input grids from HYDE, a historical land-use database.[^hyde] HYDE is itself a model. It distributes national and regional estimates across grid cells, and its estimates are less certain further back in time.

Each threshold is a slider here, and the classification runs in the browser. Population is converted to people per km² of land, and each land use to a fraction of the cell's land. The cascade follows the reference code's order and takes the first rule that matches: population density sets the band (urban, dense, residential, populated, remote, wild), land use sets the class within the band, and a potential vegetation map[^potveg] splits the rest into woodland and dryland. The inputs are aggregated from 5 arc-minutes to a 33 km grid before classification so that the data can load in a browser. The default thresholds are the published ones.

The crossover is the first time step at which used land covers more area than wild land. It is recomputed across all 75 time steps when a slider moves. The inhabited land view shows every cell with people at or above the wild cutoff. The vs published view compares the map with the same method run at native resolution before aggregation, and the hover shows HYDE 3.5's published class for each cell.[^hyde35]

[^anthromes]: Ellis, Beusen and Klein Goldewijk, ["Anthropogenic Biomes: 10,000 BCE to 2015 CE"](https://doi.org/10.3390/land9050129), *Land* 9(5):129, 2020 (Anthromes 2.1). The cascade here follows the reference implementation in the paper's [replication archive](https://doi.org/10.7910/DVN/IB4VCI), which includes three rules that are not in the paper's figures.
[^hyde]: [HYDE 3.2](https://doi.org/10.7910/DVN/E3H3AK) (`raw-data.zip`): cropland, grazing, irrigated rice, total irrigation, built-up area and population at 5 arc-minutes for 75 time steps, plus land area and potential vegetation grids.
[^potveg]: HYDE's `potveg15` grid, fifteen classes from tropical evergreen forest to polar ice, from a separate vegetation model. The published cascade treats classes 1-8 as forested.
[^hyde35]: [HYDE 3.5](https://landuse.sites.uu.nl/hyde-project/) (Utrecht University, 2025) publishes a classified series to 2025, shown here aggregated to 33 km by majority. Its 2000-2023 input grids were missing from the downloaded archive, so the sandbox classifies HYDE 3.2.

## Assumptions + Limitations

- The paper does not explain how the thresholds were chosen.
- The wild cutoff defaults to 0.0001 people per km², a rule from the reference code rather than the paper. Two other rules from the code are also kept.
- Classifying after aggregation gives a different map from classifying first, so the default map does not match the published one everywhere. The vs published view shows where they differ.
- The map is drawn in an equirectangular projection, which enlarges high latitudes. Area figures use each cell's true land area.
- The pipeline's port of the classifier matched the reference code on all 2,215,829 cells of the archive's 2000 AD test data.
- HYDE's distribution of estimates across cells has no slider, and HYDE's lower and upper population scenarios are not included.
- The potential vegetation model has no controls.
- None of the inputs are observations. Each is the output of a model.
- The inhabited land view shows where HYDE places people, not how those people changed the land.
