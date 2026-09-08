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
