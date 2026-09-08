# A City Simulator, Opened Up — sandbox text

Every string a reader sees in the sandbox's menus, in reading order. Reorganized only. No control is added or removed; the text is the current text, with American spelling. The engine clock (run, pause, step) and the layer chooser move to the representation panel; every coefficient and the run settings move to the assumptions panel, keeping its sub-group heading.

## Title block

**Title.** A City Simulator, Opened Up

**Subtitle.** The original SimCity engine, as open-sourced, running with every internal layer drawn as it updates and the constants behind its rules turned into sliders.

## Description panel (card.md)

## What this is

A city simulator from 1989 running in the browser with its internal layers showing. On one side the city plays as a game: houses appear, shops follow, traffic thickens, a population number climbs. Beside it, each layer the simulation keeps about the city (land value, crime, pollution, population density, traffic, police coverage, distance from the center) is drawn as it updates. Below the controls, about twenty constants that the rules are built from are sliders.

The engine is micropolisJS, a JavaScript port of Micropolis, the name given to the original SimCity source code when it was released as open source in 2008.[^engine] The part that simulates the city is about 2,400 lines. There is no dataset; the source code is the material.

[^engine]: micropolisJS by Graeme McCutcheon, commit `f13a1624`, GPLv3 with additional terms plus the Micropolis Public Name License. Vendored whole under `src/lib/sandboxes/coefficients/vendor/`; `NOTICE.md` records every change. The simulation core is about 2,400 lines across ten files; the whole project, including the game interface this sandbox doesn't use, is about 13,500.

## What it's trying to show

- What is behind a city simulator: a set of grids written and blurred into each other in a fixed order, sixteen steps to a turn, under rules that are a handful of typed-in constants.
- Two of those constants as claims about cities written in one line each: `crime = 128 - land value + population density - police`, and `land value = 34 - distance from the city center / 2`. The first ties crime to land value in both directions; the second makes a city with two centers impossible.

## How it works

- **The cycle.** Sixteen phases in a fixed order: 0 advances the clock and clears the census; 1-8 scan the map in eighths; 9 takes the census and collects tax; 10 decays traffic and growth; 11 works out power; 12 writes pollution and land value; 13 writes police coverage then crime; 14 writes population density then moves the city center; 15 does fire coverage and disasters.
- **Order matters.** Land value (phase 12) is measured from a center not recomputed until phase 14; the engine's own comment says this feels wrong and it was never changed.
- **The layers.** Fifteen flat arrays at 2, 4 or 8 tiles per block, drawn at that resolution because it is the resolution the simulation works at. The panel reads the same arrays the simulation does.
- **Influence is a blur.** Police coverage is the map of stations smoothed three times.
- **The starting city is ours.** A generated map is bare terrain and nothing grows on it, so the sandbox lays out zones, roads, wires, six power plants and three stations on blank ground, identical on every run.
- **The tile atlas** is one 512×512 image of 1,024 tiles, loaded by URL so it can be swapped without changing the rules.
- **The divergence chart** runs several copies of the same city with different seeds; the spread between them is what the rules leave to chance.

## What it assumes

- Every rule is a constant; there is no place for data, so no city it produces can differ in kind from another.
- Crime is low land value plus density minus policing, one to one, and feeds back into land value.
- Value falls with distance from a single center.
- Access is a random walk of up to thirty steps along roads, with no routes or journey times.
- Policing has no limit: police cover runs 0-1000 and crime 0-250, so a full-strength station removes crime entirely.
- Tax response is a table of twenty-one numbers; outside demand is one of three constants set by difficulty.
- Demography is a flat birth rate on the residential population.
- The ground is flat and empty, so every difference in land value comes from the gradient or the plan.

## What it can't see

- Anyone: densities, rates and a growth valve, but no people.
- A city whose most valuable place isn't its center.
- Its own failures: the crime scan never ran (its loop was bounded by two properties that don't exist), so crime was zero in every city and the game still looked like a working simulation. Fixed here and recorded in `NOTICE.md`.

## Assumptions panel

### the crime rule

**Crime base** (`crime_base`)
Range 0 to 255. Default 128.
Why these numbers: The crime rule is: crime = 128 - land value + population density - police. This is the 128. It's how much crime a place has before anything about the place is taken into account; the other terms adjust it. Nothing in the engine derived it and no data was fitted to produce it. Moving it changes the whole crime map at once, and population falls with it, because low land value raises crime and high crime lowers land value, and the engine links the two on purpose.

**Weight on land value** (`crime_land_value_weight`)
Range 0 to 2. Default 1.
Why these numbers: How strongly low land value is taken to produce crime. The engine's value is 1, so one point of land value cancels one point of crime. At 0 the model stops connecting land value to crime at all, and the rest of the simulation carries on unchanged.

**Weight on police** (`crime_police_weight`)
Range 0 to 4. Default 1.
Why these numbers: How strongly police presence reduces crime. The engine's value is 1. Police cover is on a 0 to 1000 scale and crime on 0 to 250, so a station at full strength doesn't reduce crime, it removes it. Policing here has no diminishing return, no displacement and no upper limit.

### the land value rule

**Land value at the center** (`land_value_centre_base`)
Range 0 to 100. Default 34.
Why these numbers: The value of land at the city center, before distance is subtracted. The engine's 34 is shifted left twice (multiplied by four) in the code, so the real ceiling is 136. Raising this raises the whole land value surface without changing its shape.

**Distance divisor** (`land_value_distance_divisor`)
Range 0.5 to 8. Default 2.
Why these numbers: The land value rule is: land value = 34 - distance from the city center / 2. This is the 2: how fast value falls as you move away from the middle. Because the rule is written this way, no city the engine produces has two centers, and no place far from the middle can be expensive. Raising the divisor flattens the gradient, so the city gets richer and less centralised, but it still has one center.

### the other rules

**How far traffic looks** (`max_traffic_distance`)
Range 5 to 120. Default 30.
Why these numbers: A zone counts as having access to jobs if a random walk along the roads finds a destination within this many steps. There's no route planning, no journey time and no congestion feeding back; the walk is random and the only question is whether it arrives. On a compact grid like the starting city most destinations are close, so this control does less here than it would on a sprawling map.

**Police smoothing passes** (`smooth_passes`)
Range 0 to 8. Default 3.
Why these numbers: How a police station's influence spreads: the map of station positions is blurred this many times and the result is called coverage. That is the whole account of how a service reaches a neighborhood. At 0, cover collapses to the stations themselves and crime rises everywhere else.

**Birth rate** (`birth_rate`)
Range 0 to 0.1. Default 0.02.
Why these numbers: Population growth per turn, as a flat share of the residential population. There are no ages, no households and no migration; demography in this model is one multiplication.

**Outside demand** (`ext_market_index`)
Options: 1.2, 1.1, 0.98. Default: 1.1.
Why these numbers: Demand for what the city's industry produces, from everywhere that isn't the city. In the game it's one of three numbers set by the difficulty level, and it never changes for any other reason.

### the run

**Seed** (`seed`)
Range 0 to 99999. Default 1.
Why these numbers: The starting number for every random choice the simulation makes. The rules and the starting city are the same for every seed, so this is the only thing that differs between the runs on the divergence chart. A different seed gives a different city out of the same model.

**Runs to compare** (`run_count`)
Range 1 to 12. Default 5.
Why these numbers: How many seeds the divergence chart runs in the background. Each starts from the same city under the same rules. The spread between them at the end is how much the rules leave to chance.

**Steps per run** (`ticks`)
Range 100 to 5000. Default 1000.
Why these numbers: How many steps each comparison run takes. One step is one phase of the sixteen-phase cycle, so a full turn of the city's clock is sixteen steps.

## Representation panel

**Layer over the city** (`layer`)
Options: none, land value, crime, pollution, density, traffic, growth, unspoilt, center, police, fire. Default: none.
Why these numbers: Which internal layer to draw over the city, tile for tile. 'none' follows the rotation, so the overlay shows whichever layer the cycle most recently wrote. All fifteen are drawn small in the rail regardless; click one there to pin it.

**The clock** (engine transport). Label: the clock. Run, pause, step; speeds 0.5×, 1×, 2×, 4×. Sits at the top of the representation panel.

## Metrics strip

- population
- the residential, commercial and industrial demand valves
- mean land value
- mean crime
- the spread across repeated runs at the final step
- steps run

## What it can't see (assistant prompt)

