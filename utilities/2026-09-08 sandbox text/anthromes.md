# Anthromes — sandbox text

Every string a reader sees in the sandbox's menus, in reading order. Reorganized only. No control is added or removed; the text is the current text, with American spelling. The year timeline and the color-by menu move to the representation panel; every threshold moves to the assumptions panel, keeping its sub-group heading.

## Title block

**Title.** Anthromes

**Subtitle.** Twelve thousand years of land use, classified live in the browser from the published input grids, with every threshold in the classification as a slider.

## Description panel (card.md)

## What this is

A map of the world's land from 10,000 BC to 2017, colored by how people were using it. The colors are the Anthromes classification (anthropogenic biomes): urban, village, cropland, rangeland, seminatural, wild, and their subclasses.[^anthromes] The classification is about a dozen thresholds applied to six input grids from HYDE, a historical land-use database.[^hyde] Here every threshold is a slider, the classification runs in the browser, and the map is the result of your thresholds on the published inputs. At the defaults it is the published method exactly.

[^anthromes]: Ellis, Beusen and Klein Goldewijk, "Anthropogenic Biomes: 10,000 BCE to 2015 CE", *Land* 9(5):129, 2020 (Anthromes 2.1). The cascade used here is the reference implementation from the paper's replication archive (doi:10.7910/DVN/IB4VCI). Three of its rules are in the code and not the paper's figures; the sandbox keeps them.
[^hyde]: HYDE 3.2 (doi:10.7910/DVN/E3H3AK, `raw-data.zip`): cropland, grazing, irrigated rice, total irrigation, built-up area and population at 5 arc-minutes for 75 time steps, plus land area and potential vegetation grids. HYDE is itself a model that spreads national and regional estimates across cells; none of the inputs are direct observations.

## What it's trying to show

- What it means to understand the Earth through a hindcast: a model run backward in time, cited as if it were a record.
- How much the dataset's best-known result rests on round numbers. The crossover (the first time step at which used land exceeds wild) is computed live; moving the used-land threshold from 20% to 5% shifts it back by millennia, and to 40% returns parts of the twentieth century to wild.
- What resolution and dataset version do, with two comparison layers: the same method at native resolution, and HYDE 3.5's newer published classification.

## How it works

- Every input is divided by the cell's land area, so population becomes people per km² and land uses become fractions.
- The cascade runs first-match-wins in the reference code's order: population density sets the band (urban, dense, residential, populated, remote, wild), land use picks the class within the band, and the potential vegetation map[^potveg] splits the remainder into woodland and dryland.
- Inputs are aggregated from 5 arc-minutes to a 33 km grid before classification, by land-area-weighted mean. Classifying first and aggregating after gives a different map; the native-resolution comparison layer is that map, and "vs published" colors the difference.
- The crossover needs all 75 steps reclassified (13.7 million cell-years), which runs in a background worker; the stale value is grayed until the new one arrives.
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

## Assumptions panel

### the land-use thresholds

**Used-land threshold** (`used_threshold`)
Range 0.02 to 0.6. Default 0.2.
Why these numbers: The share of a cell's land that must be cropped, grazed or built before the cell counts as used at all. The published value is 20%. This is the threshold that decides the crossover year, the first time step at which used land exceeds wild, and moving it shifts that year by millennia.

**Cropland threshold** (`crops_threshold`)
Range 0.02 to 0.6. Default 0.2.
Why these numbers: How much of a cell must be cropland before the cell is a cropland anthrome. Published value 20%.

**Grazing threshold** (`grazing_threshold`)
Range 0.02 to 0.6. Default 0.2.
Why these numbers: How much of a cell must be pasture or rangeland before the cell is a grazing anthrome. Published value 20%. The reference code keeps this separate from the crops threshold, so the sandbox does too.

**Rice threshold** (`rice_threshold`)
Range 0.02 to 0.6. Default 0.2.
Why these numbers: In cells above the dense-settlement population density, the share of irrigated rice that makes the cell a rice village. Published value 20%.

**Irrigation threshold** (`irrigation_threshold`)
Range 0.02 to 0.6. Default 0.2.
Why these numbers: The irrigated share that distinguishes irrigated villages and residential irrigated croplands from their unirrigated counterparts. Published value 20%.

**Urban area threshold** (`urban_fraction_threshold`)
Range 0.02 to 0.6. Default 0.2.
Why these numbers: The built-up share that makes a cell urban outright, whatever its population. Published value 20%.

### the population densities

**Urban density** (`urban_density`)
Range 500 to 10000 /km². Default 2500.
Why these numbers: People per square kilometer of land above which a cell is urban regardless of built-up area. Published value 2,500.

**Dense settlement density** (`dense_settlement_density`)
Range 10 to 500 /km². Default 100.
Why these numbers: The lower edge of the dense-settlement and village band. Below it a cell can't be a village however much rice it grows. Published value 100 per square kilometer.

**Residential density** (`residential_density`)
Range 1 to 50 /km². Default 10.
Why these numbers: The lower edge of the residential band: residential croplands, rangelands and woodlands. Published value 10 per square kilometer.

**Populated density** (`populated_density`)
Range 0.1 to 5 /km². Default 1.
Why these numbers: The line between populated and remote. Below it a cropland is remote cropland however it's farmed. Published value 1 per square kilometer.

### the vegetation

**Forested biomes** (`tree_biomes`)
Range 4 to 12. Default 8.
Why these numbers: How many of the fifteen potential-vegetation classes count as potentially forested. The classes are ordered from tropical evergreen forest down to polar ice, and the published cascade draws the line after class 8. Moving it redraws the woodland-dryland boundary of every seminatural and wild cell.

## Representation panel

**Year** (`year`)
Options: 10000BC, 9000BC, 8000BC, 7000BC, 6000BC, 5000BC, 4000BC, 3000BC, 2000BC, 1000BC, 0AD, 100AD, 200AD, 300AD, 400AD, 500AD, 600AD, 700AD, 800AD, 900AD, 1000AD, 1100AD, 1200AD, 1300AD, 1400AD, 1500AD, 1600AD, 1700AD, 1710AD, 1720AD, 1730AD, 1740AD, 1750AD, 1760AD, 1770AD, 1780AD, 1790AD, 1800AD, 1810AD, 1820AD, 1830AD, 1840AD, 1850AD, 1860AD, 1870AD, 1880AD, 1890AD, 1900AD, 1910AD, 1920AD, 1930AD, 1940AD, 1950AD, 1960AD, 1970AD, 1980AD, 1990AD, 2000AD, 2001AD, 2002AD, 2003AD, 2004AD, 2005AD, 2006AD, 2007AD, 2008AD, 2009AD, 2010AD, 2011AD, 2012AD, 2013AD, 2014AD, 2015AD, 2016AD, 2017AD. Default: 2000AD.
Why these numbers: The 75 HYDE 3.2 time steps: every thousand years, then every century, then every decade, then every year. The timeline ends at 2017 because no HYDE release we could obtain carries input grids for 2018 to 2025.

**Color by** (`colour_by`)
Options: anthrome, used land, population, vs published. Default: anthrome.
Why these numbers: What the color means: the anthrome class; the used fraction of each cell; population density; or where your classification disagrees with the published method run at native resolution before aggregating. At the default thresholds that last difference is purely what aggregating a threshold rule does.

## Metrics strip

- the crossover: the first time step at which used land exceeds wild, recomputed in a worker as the sliders move
- used and wild land shares at the current year
- agreement with the published method run at native resolution
- land cells classified

## What it can't see (assistant prompt)

