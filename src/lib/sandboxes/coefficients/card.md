## Description

A city simulator from 1989 running in the browser with its internal layers showing. On one side the city plays as a game: houses appear, shops follow, traffic thickens, a population number climbs. Beside it, each layer the simulation keeps about the city (land value, crime, pollution, population density, traffic, police coverage, distance from the center) is drawn as it updates, and about twenty constants that the rules are built from are sliders.

The engine is micropolisJS, a JavaScript port of Micropolis, the name given to the original SimCity source code when it was released as open source in 2008.[^engine] There is no dataset; the source code is the material. The simulation runs sixteen phases in a fixed order[^cycle]: the map is scanned in eighths, a census is taken and tax collected, traffic and growth decay, power is worked out, pollution and land value are written, then police coverage and crime, then population density and the city center. Two of the constants are claims about cities written in one line each: `crime = 128 - land value + population density - police`, and `land value = 34 - distance from the city center / 2`. The first ties crime to land value in both directions; the second makes a city with two centers impossible.

The starting city is ours. A generated map is bare terrain and nothing grows on it, so the sandbox lays out zones, roads, wires, six power plants and three stations on blank ground, identical on every run. A divergence chart runs several copies of the same city with different seeds; the spread between them is what the rules leave to chance.

[^engine]: [micropolisJS](https://github.com/graememcc/micropolisJS) by Graeme McCutcheon, commit `f13a1624`, GPLv3 with additional terms plus the Micropolis Public Name License; a port of [Micropolis](https://github.com/SimHacker/micropolis). Micropolis is a registered trademark of [Micropolis Corporation (Micropolis GmbH)](https://www.micropolis.com) and is licensed here as a courtesy of the owner under the Micropolis Public Name License. Vendored whole under `src/lib/sandboxes/coefficients/vendor/`; `NOTICE.md` records every change. The simulation core is about 2,400 lines across ten files; the whole project, including the game interface this sandbox does not use, is about 13,500.
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
- The crime scan never ran in the original port (its loop was bounded by two properties that do not exist), so crime was zero in every city and the game still looked like a working simulation. Fixed here and recorded in `NOTICE.md`.
