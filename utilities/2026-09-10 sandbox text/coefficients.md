# A City Simulator, Opened Up — sandbox text

Every string a reader sees in the sandbox's menus, in reading order, for the 09-08 rebuild. This is the prose the build doc points Claude Code at; copy from here, do not rewrite. Register: flat, explanatory, model card. No control is added or removed; the engine clock and the layer chooser are in the representation panel, and every coefficient and the run settings are in the assumptions panel under its sub-group heading.

## Title block

**Title.** A City Simulator, Opened Up

**Subtitle.** The original SimCity engine, as open-sourced, with every internal layer drawn as it updates and the constants behind its rules turned into sliders.

## Description panel (card.md)

## Description

A city simulator from 1989 running in the browser with its internal layers showing. On one side the city plays as a game: houses appear, shops follow, traffic thickens, a population number climbs. Beside it, each layer the simulation keeps about the city (land value, crime, pollution, population density, traffic, police coverage, distance from the center) is drawn as it updates, and about twenty constants that the rules are built from are sliders.

The engine is micropolisJS, a JavaScript port of Micropolis, the name given to the original SimCity source code when it was released as open source in 2008.[^engine] There is no dataset; the source code is the material. The simulation runs sixteen phases in a fixed order[^cycle]: the map is scanned in eighths, a census is taken and tax collected, traffic and growth decay, power is worked out, pollution and land value are written, then police coverage and crime, then population density and the city center. Two of the constants are claims about cities written in one line each: `crime = 128 - land value + population density - police`, and `land value = 34 - distance from the city center / 2`. The first ties crime to land value in both directions; the second makes a city with two centers impossible.

The starting city is ours. A generated map is bare terrain and nothing grows on it, so the sandbox lays out zones, roads, wires, six power plants and three stations on blank ground, identical on every run. A divergence chart runs several copies of the same city with different seeds; the spread between them is what the rules leave to chance.

[^engine]: [micropolisJS](https://github.com/graememcc/micropolisJS) by Graeme McCutcheon, commit `f13a1624`, GPLv3 with additional terms plus the Micropolis Public Name License; a port of [Micropolis](https://github.com/SimHacker/micropolis). Vendored whole under `src/lib/sandboxes/coefficients/vendor/`; `NOTICE.md` records every change. The simulation core is about 2,400 lines across ten files; the whole project, including the game interface this sandbox does not use, is about 13,500.
[^cycle]: Phase 0 advances the clock and clears the census; 1-8 scan the map in eighths; 9 takes the census and collects tax; 10 decays traffic and growth; 11 works out power; 12 writes pollution and land value; 13 writes police coverage then crime; 14 writes population density then moves the city center; 15 does fire coverage and disasters. Land value (phase 12) is measured from a center not recomputed until phase 14; the engine's own comment says this feels wrong and it was never changed.

## Assumptions + Limitations

- Every rule is a constant; there is no place for data, so no city it produces can differ in kind from another.
- Crime is low land value plus density minus policing, one to one, and feeds back into land value.
- Value falls with distance from a single center, so no city the engine produces has a second center.
- Access is a random walk of up to thirty steps along roads, with no routes or journey times.
- Policing has no limit: police cover runs 0-1000 and crime 0-250, so a full-strength station removes crime entirely. Police coverage is the map of stations blurred three times.
- Tax response is a table of twenty-one numbers; outside demand is one of three constants set by difficulty.
- Demography is a flat birth rate on the residential population. There are no people, only densities, rates and a growth valve.
- The ground is flat and empty, so every difference in land value comes from the gradient or the plan.
- The fifteen layers are flat arrays at 2, 4 or 8 tiles per block, drawn at that resolution because it is the resolution the simulation works at. The tile atlas is one 512×512 image of 1,024 tiles.
- The crime scan never ran in the original port (its loop was bounded by two properties that do not exist), so crime was zero in every city. Fixed here and recorded in `NOTICE.md`.

## Representation panel

Panel heading: **representation**

**The clock** (engine transport). Label: the clock. Run, pause, step; speeds 0.5×, 1×, 2×, 4×. Sits at the top of the representation panel.

**Layer over the city** (`layer`)
Options: none, land value, crime, pollution, density, traffic, growth, unspoilt, center, police, fire. Default: none.
More: Which internal layer to draw over the city, tile for tile. "None" follows the rotation, so the overlay shows whichever layer the cycle most recently wrote. All fifteen are drawn small in the rail regardless; click one there to pin it.

## Assumptions panel

Panel heading: **assumptions**

### the crime rule

**Crime base** (`crime_base`)
Range 0 to 255. Default 128.
More: The 128 in crime = 128 - land value + population density - police: how much crime a place has before anything about the place is taken into account. No data was fitted to produce it. Moving it changes the whole crime map at once, and population falls with it, because the engine links crime and land value in both directions.

**Weight on land value** (`crime_land_value_weight`)
Range 0 to 2. Default 1.
More: How strongly low land value is taken to produce crime. The engine's value is 1, so one point of land value cancels one point of crime. At 0 the model stops connecting land value to crime.

**Weight on police** (`crime_police_weight`)
Range 0 to 4. Default 1.
More: How strongly police presence reduces crime. The engine's value is 1. Police cover is on a 0 to 1000 scale and crime on 0 to 250, so a station at full strength removes crime entirely.

### the land value rule

**Land value at the center** (`land_value_centre_base`)
Range 0 to 100. Default 34.
More: The value of land at the city center, before distance is subtracted. The engine's 34 is shifted left twice (multiplied by four) in the code, so the real ceiling is 136. Raising this raises the whole land value surface without changing its shape.

**Distance divisor** (`land_value_distance_divisor`)
Range 0.5 to 8. Default 2.
More: The 2 in land value = 34 - distance from the city center / 2: how fast value falls with distance from the middle. Raising the divisor flattens the gradient, so the city gets richer and less centralized, but it still has one center.

### the other rules

**How far traffic looks** (`max_traffic_distance`)
Range 5 to 120. Default 30.
More: A zone counts as having access to jobs if a random walk along the roads finds a destination within this many steps. There is no route planning, no journey time and no congestion feeding back. On a compact grid like the starting city most destinations are close, so this control does less here than it would on a sprawling map.

**Police smoothing passes** (`smooth_passes`)
Range 0 to 8. Default 3.
More: The map of station positions is blurred this many times and the result is called coverage. At 0, cover collapses to the stations themselves and crime rises everywhere else.

**Birth rate** (`birth_rate`)
Range 0 to 0.1. Default 0.02.
More: Population growth per turn, as a flat share of the residential population. There are no ages, no households and no migration.

**Outside demand** (`ext_market_index`)
Options: 1.2, 1.1, 0.98. Default: 1.1.
More: Demand for what the city's industry produces, from everywhere that is not the city. In the game it is one of three numbers set by the difficulty level.

### the run

**Seed** (`seed`)
Range 0 to 99999. Default 1.
More: The starting number for every random choice the simulation makes. The rules and the starting city are the same for every seed, so this is the only thing that differs between the runs on the divergence chart.

**Runs to compare** (`run_count`)
Range 1 to 12. Default 5.
More: How many seeds the divergence chart runs in the background. The spread between them at the end is how much the rules leave to chance.

**Steps per run** (`ticks`)
Range 100 to 5000. Default 1000.
More: How many steps each comparison run takes. One step is one phase of the sixteen-phase cycle, so a full turn of the city's clock is sixteen steps.

Button at the foot of the panel: **Submit this state**

## Metrics strip

- population
- the residential, commercial and industrial demand valves
- mean land value
- mean crime
- the spread across repeated runs at the final step
- steps run

## What it can't see (assistant prompt, meta.js `cannotSee`)

Anyone. The model has densities, rates and a growth valve, but no people, no households and no migration. It cannot see a city whose most valuable place is not its center, because land value is written as a distance from one center. There is no data anywhere in it: every rule is a typed-in constant, and no city it produces can differ in kind from another. Access is a random walk with no routes or journey times, policing has no limit, and the ground is flat and empty.
