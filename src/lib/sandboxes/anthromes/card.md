<!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->

## Description

A map of the world's land from 10,000 BC to 2017, colored by how people were using it. The colors are the Anthromes classification (anthropogenic biomes): urban, village, cropland, rangeland, seminatural, wild, and their subclasses.[^anthromes] The classification is about a dozen thresholds applied to six input grids from HYDE, a historical land-use database.[^hyde] None of the inputs are observations. HYDE is itself a model that spreads national and regional estimates across cells, and the further back the timeline runs, the more of the map is reconstruction, though it looks equally confident at every date.

Here every threshold is a slider and the classification runs in the browser. Every input is divided by the cell's land area, so population becomes people per km² and land uses become fractions. The cascade runs first-match-wins in the reference code's order: population density sets the band (urban, dense, residential, populated, remote, wild), land use picks the class within the band, and the potential vegetation map[^potveg] splits the remainder into woodland and dryland. Inputs are aggregated from 5 arc-minutes to a 33 km grid before classification, which is what makes the map computable in a browser. At the default thresholds the method is the published one.

The crossover, the first time step at which used land exceeds wild, is recomputed from all 75 time steps as the sliders move. Two comparison layers show the same method run at native resolution before aggregating, and HYDE 3.5's newer published classification.[^hyde35]

[^anthromes]: Ellis, Beusen and Klein Goldewijk, ["Anthropogenic Biomes: 10,000 BCE to 2015 CE"](https://doi.org/10.3390/land9050129), *Land* 9(5):129, 2020 (Anthromes 2.1). The cascade used here is the reference implementation from the paper's [replication archive](https://doi.org/10.7910/DVN/IB4VCI). Three of its rules are in the code and not the paper's figures; the sandbox keeps them.
[^hyde]: [HYDE 3.2](https://doi.org/10.7910/DVN/E3H3AK) (`raw-data.zip`): cropland, grazing, irrigated rice, total irrigation, built-up area and population at 5 arc-minutes for 75 time steps, plus land area and potential vegetation grids.
[^potveg]: HYDE's `potveg15` grid, fifteen classes from tropical evergreen forest to polar ice, from a separate vegetation model. The published cascade treats classes 1-8 as forested; that line is a slider here.
[^hyde35]: [HYDE 3.5](https://landuse.sites.uu.nl/hyde-project/) (Utrecht University, 2025) publishes a classified series to 2025; aggregated to 33 km by majority it is the third layer. Its 2000-2023 input folders are present and empty in three separately obtained copies, which is why the sandbox classifies 3.2 and the timeline ends at 2017.

## Assumptions + Limitations

- The thresholds are worth arguing with; the paper presents them without derivation.
- The wild cutoff is 0.0001 persons/km², not zero, a rule from the code rather than the paper; two other code-only rules are also kept.
- Aggregating before classifying gives a different map from classifying first, so the default map will not match the published one everywhere. The "vs published" layer colors the difference.
- The picture is distorted: equirectangular projection exaggerates the high latitudes where most wild land is. Every area statistic uses true cell areas instead.
- The pipeline runs the authors' classifier on their test year and its own port on the same numbers, and ships only if they agree cell for cell (2,215,829 cells, zero disagreements).
- HYDE's allocation of estimates across cells is the larger uncertainty and has no slider; HYDE's lower and upper population scenarios are not wired in.
- The potential vegetation model underneath has no controls.
- Every input is a model's output; there is no observation anywhere in the map.
