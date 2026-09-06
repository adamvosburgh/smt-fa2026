## What this is

A map of the world's land from 10,000 BC to 2017, coloured by how people were using it. The colours are the Anthromes classification (anthropogenic biomes): urban, village, cropland, rangeland, seminatural, wild, and their subclasses.[^anthromes] The classification is about a dozen thresholds applied to six input grids from HYDE, a historical land-use database.[^hyde] Here every threshold is a slider, the classification runs in the browser, and the map is the result of your thresholds on the published inputs. At the defaults it is the published method exactly.

[^anthromes]: Ellis, Beusen and Klein Goldewijk, "Anthropogenic Biomes: 10,000 BCE to 2015 CE", *Land* 9(5):129, 2020 (Anthromes 2.1). The cascade used here is the reference implementation from the paper's replication archive (doi:10.7910/DVN/IB4VCI). Three of its rules are in the code and not the paper's figures; the sandbox keeps them.
[^hyde]: HYDE 3.2 (doi:10.7910/DVN/E3H3AK, `raw-data.zip`): cropland, grazing, irrigated rice, total irrigation, built-up area and population at 5 arc-minutes for 75 time steps, plus land area and potential vegetation grids. HYDE is itself a model that spreads national and regional estimates across cells; none of the inputs are direct observations.

## What it's trying to show

- What it means to understand the Earth through a hindcast: a model run backward in time, cited as if it were a record.
- How much the dataset's best-known result rests on round numbers. The crossover (the first time step at which used land exceeds wild) is computed live; moving the used-land threshold from 20% to 5% shifts it back by millennia, and to 40% returns parts of the twentieth century to wild.
- What resolution and dataset version do, with two comparison layers: the same method at native resolution, and HYDE 3.5's newer published classification.

## How it works

- Every input is divided by the cell's land area, so population becomes people per km² and land uses become fractions.
- The cascade runs first-match-wins in the reference code's order: population density sets the band (urban, dense, residential, populated, remote, wild), land use picks the class within the band, and the potential vegetation map[^potveg] splits the remainder into woodland and dryland.
- Inputs are aggregated from 5 arc-minutes to a 33 km grid before classification, by land-area-weighted mean. Classifying first and aggregating after gives a different map; the native-resolution comparison layer is that map, and "vs published" colours the difference.
- The crossover needs all 75 steps reclassified (13.7 million cell-years), which runs in a background worker; the stale value is greyed until the new one arrives.
- The map is drawn equirectangular straight from the grid; hovering reads the inputs and all three classifications for a cell.
- The pipeline runs the authors' classifier on their test year and its own port on the same numbers, and ships only if they agree cell for cell (2,215,829 cells, zero disagreements).

[^potveg]: HYDE's `potveg15` grid, fifteen classes from tropical evergreen forest to polar ice, from a separate vegetation model. The published cascade treats classes 1-8 as forested; that line is a slider here.

## What it assumes

- The thresholds are worth arguing with; the paper presents them without derivation.
- The wild cutoff is 0.0001 persons/km², not zero, a rule from the code rather than the paper; two other code-only rules are also kept.
- The inputs are HYDE 3.2, because 3.5's distribution is missing its 2000-2023 input grids and its classification paper is in preparation; this is why the timeline ends at 2017.[^hyde35]
- The picture is distorted (equirectangular exaggerates the high latitudes where most wild land is) and every area statistic uses true cell areas instead.
- Aggregation before classification is what makes the map computable in a browser, and why the default map won't match the published one everywhere.

[^hyde35]: HYDE 3.5 (Utrecht University, 2025) publishes a classified series to 2025; aggregated to 33 km by majority it is the third layer. Its 2000-2023 input folders are present and empty in three separately obtained copies.

## What it can't see

- HYDE's allocation of estimates across cells, which is the larger uncertainty and has no slider; HYDE's lower and upper population scenarios aren't wired in.
- The potential vegetation model underneath, also without controls.
- Any observation: every input is a model's output, and the further back the timeline runs, the more of it is reconstruction, though the map looks equally confident at every date.
