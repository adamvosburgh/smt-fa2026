## Description

SimCity (1989) came out of a longer history of computers applied to cities. Will Wright drew its rules partly from Jay Forrester's *Urban Dynamics* (1969), which brought methods from Cold War computing into urban policy and modeled a city in about 150 equations. Forrester concluded that housing and anti-poverty programs made urban decline worse, and that intuitive answers to a city's problems were usually wrong. The model lent that argument the authority of computation, and the game passed its assumptions on to players.[^baker]

This sandbox runs SimCity's engine, released as open source in 2008 as Micropolis[^engine], with its workings shown. The simulation keeps fifteen maps of the city, such as land value, crime and traffic, and updates them in sixteen steps[^cycle]. The maps are drawn as they update, and about twenty numbers in the rules are sliders.

Each rule is a short formula with typed-in numbers. Crime is `crime = 128 - land value + population density - police`: a place starts at 128, and gets more crime as land value falls and density rises. No data was used to set the 128 or the equal weights. Land value is `34 - distance from the city center / 2`, so every city has one center.

A new map in the game is empty land. To simplify the exercise, I laid out the starting city in code on flat, empty ground, the same on every run, so that two runs differ only by their seed. The default, blocks, follows how players tend to build: rings of road around eight lots, dense downtown and thinner toward the edge, with industry to one side. The grid, for comparison, is uniform bands of housing, shops and industry.

[^baker]: Kevin T. Baker, ["Model Metropolis"](https://logicmag.io/play/model-metropolis/), *Logic* 6, "Play," January 2019.
[^engine]: [micropolisJS](https://github.com/graememcc/micropolisJS) by Graeme McCutcheon, commit `f13a1624`, GPLv3 with additional terms plus the Micropolis Public Name License; a port of [Micropolis](https://github.com/SimHacker/micropolis). Micropolis is a registered trademark of [Micropolis Corporation (Micropolis GmbH)](https://www.micropolis.com) and is licensed here as a courtesy of the owner under the Micropolis Public Name License. Vendored whole under `src/lib/sandboxes/coefficients/vendor/`; `NOTICE.md` records every change. The simulation core is about 2,400 lines across ten files; the whole project, including the game interface this sandbox does not use, is about 13,500.
[^cycle]: Step 1 advances the clock and clears the census; 2-9 scan the map in eighths and let each zone grow or decline; 10 takes the census and collects tax; 11 fades traffic and growth; 12 works out power; 13 writes pollution and land value; 14 writes police coverage then crime; 15 writes population density then moves the city center; 16 does fire coverage. At the engine's fastest setting, which this sandbox uses, steps 12 to 16 run only every 5th to 20th cycle. Land value (step 13) is measured from a center not recomputed until step 15; the engine's own comment says this feels wrong and it was never changed.

## Assumptions + Limitations

- Every rule is a constant typed into the code. No data goes in, so no city it produces can differ in kind from another.
- Crime is low land value plus density minus policing, one to one, and crime feeds back into land value.
- Land value falls with distance from a single center, so no city the engine produces has a second center.
- Access is a random walk of up to thirty road tiles, with no routes or journey times.
- Policing has no limit: a station at full strength removes crime entirely. Police coverage is the map of stations blurred three times.
- Taxes are a table of twenty-one numbers; outside demand is one of three constants set by the difficulty level.
- There are no people, only densities, rates and a flat birth rate.
- The ground is flat. I left out terrain so that differences in land value come only from the rules and the plan. The only trees are the parks and wooded lots in the blocks plan, and they raise land value around them.
- I designed both starting plans. Their land uses, densities and parks are my choices, and switching plans changes the numbers.
- The maps are 2, 4 or 8 tiles to a cell, and are drawn at that resolution because it is the resolution the simulation works at.
- The crime calculation never ran in the original port (its loop was bounded by two properties that do not exist), so crime was zero in every city and the game still looked like it worked. Fixed here and recorded in `NOTICE.md`.
