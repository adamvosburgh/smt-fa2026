# Anthromes — sandbox text

Every string a reader sees in the sandbox's menus, in reading order, for the 09-08 rebuild. This is the prose the build doc points Claude Code at; copy from here, do not rewrite. Register: flat, explanatory, model card. No control is added or removed; the year timeline and the color-by menu are in the representation panel, and every threshold is in the assumptions panel under its sub-group heading.

## Title block

**Title.** Anthromes

**Subtitle.** Twelve thousand years of land use, classified live in the browser with every threshold in the classification as a slider.

## Description panel (card.md)

## Description

A map of the world's land from 10,000 BC to 2017, colored by how people were using it. The colors are the Anthromes classification (anthropogenic biomes): urban, village, cropland, rangeland, seminatural, wild, and their subclasses.[^anthromes] The classification is about a dozen thresholds applied to six input grids from HYDE, a historical land-use database.[^hyde] None of the inputs are observations. HYDE is itself a model that spreads national and regional estimates across cells, and the further back the timeline runs, the more of the map is reconstruction.

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

## Representation panel

Panel heading: **representation**

**Year** (`year`)
Options: 10000BC, 9000BC, 8000BC, 7000BC, 6000BC, 5000BC, 4000BC, 3000BC, 2000BC, 1000BC, 0AD, 100AD, 200AD, 300AD, 400AD, 500AD, 600AD, 700AD, 800AD, 900AD, 1000AD, 1100AD, 1200AD, 1300AD, 1400AD, 1500AD, 1600AD, 1700AD, 1710AD, 1720AD, 1730AD, 1740AD, 1750AD, 1760AD, 1770AD, 1780AD, 1790AD, 1800AD, 1810AD, 1820AD, 1830AD, 1840AD, 1850AD, 1860AD, 1870AD, 1880AD, 1890AD, 1900AD, 1910AD, 1920AD, 1930AD, 1940AD, 1950AD, 1960AD, 1970AD, 1980AD, 1990AD, 2000AD, 2001AD, 2002AD, 2003AD, 2004AD, 2005AD, 2006AD, 2007AD, 2008AD, 2009AD, 2010AD, 2011AD, 2012AD, 2013AD, 2014AD, 2015AD, 2016AD, 2017AD. Default: 2000AD.
More: The 75 HYDE 3.2 time steps: every thousand years, then every century, then every decade, then every year. The timeline ends at 2017 because no HYDE release we could obtain carries input grids for 2018 to 2025.

**Color by** (`colour_by`)
Options: anthrome, used land, population, vs published. Default: anthrome.
More: The anthrome class; the used fraction of each cell; population density; or where your classification disagrees with the published method run at native resolution before aggregating.

## Assumptions panel

Panel heading: **assumptions**

### the land-use thresholds

**Used-land threshold** (`used_threshold`)
Range 0.02 to 0.6. Default 0.2.
More: The share of a cell's land that must be cropped, grazed or built before the cell counts as used at all. Published value 20%. This threshold decides the crossover year, and moving it shifts that year by millennia.

**Cropland threshold** (`crops_threshold`)
Range 0.02 to 0.6. Default 0.2.
More: How much of a cell must be cropland before the cell is a cropland anthrome. Published value 20%.

**Grazing threshold** (`grazing_threshold`)
Range 0.02 to 0.6. Default 0.2.
More: How much of a cell must be pasture or rangeland before the cell is a grazing anthrome. Published value 20%. The reference code keeps this separate from the crops threshold, so the sandbox does too.

**Rice threshold** (`rice_threshold`)
Range 0.02 to 0.6. Default 0.2.
More: In cells above the dense-settlement population density, the share of irrigated rice that makes the cell a rice village. Published value 20%.

**Irrigation threshold** (`irrigation_threshold`)
Range 0.02 to 0.6. Default 0.2.
More: The irrigated share that distinguishes irrigated villages and residential irrigated croplands from their unirrigated counterparts. Published value 20%.

**Urban area threshold** (`urban_fraction_threshold`)
Range 0.02 to 0.6. Default 0.2.
More: The built-up share that makes a cell urban outright, whatever its population. Published value 20%.

### the population densities

**Urban density** (`urban_density`)
Range 500 to 10000 /km². Default 2500.
More: People per square kilometer of land above which a cell is urban regardless of built-up area. Published value 2,500.

**Dense settlement density** (`dense_settlement_density`)
Range 10 to 500 /km². Default 100.
More: The lower edge of the dense-settlement and village band. Below it a cell cannot be a village however much rice it grows. Published value 100.

**Residential density** (`residential_density`)
Range 1 to 50 /km². Default 10.
More: The lower edge of the residential band: residential croplands, rangelands and woodlands. Published value 10.

**Populated density** (`populated_density`)
Range 0.1 to 5 /km². Default 1.
More: The line between populated and remote. Below it a cropland is remote cropland however it is farmed. Published value 1.

### the vegetation

**Forested biomes** (`tree_biomes`)
Range 4 to 12. Default 8.
More: How many of the fifteen potential-vegetation classes count as potentially forested. The classes are ordered from tropical evergreen forest down to polar ice, and the published cascade draws the line after class 8. Moving it redraws the woodland-dryland boundary of every seminatural and wild cell.

Button at the foot of the panel: **Submit this state**

## Metrics strip

- the crossover: the first time step at which used land exceeds wild, recomputed in a worker as the sliders move
- used and wild land shares at the current year
- agreement with the published method run at native resolution
- land cells classified

## Warnings and status lines

- while the crossover recomputes: the stale value is grayed until the new one arrives

## What it can't see (assistant prompt, meta.js `cannotSee`)

Any observation. Every input is a model's output: HYDE spreads national and regional estimates across cells, and that allocation is the larger uncertainty and has no slider. The potential vegetation model underneath has no controls either. The further back the timeline runs, the more of the map is reconstruction. The inputs are HYDE 3.2, because 3.5's distribution is missing its 2000-2023 input grids, so the timeline ends at 2017. The thresholds are the published ones at the defaults, but the paper presents them without derivation, and aggregating to 33 km before classifying means the default map will not match the published one everywhere.
