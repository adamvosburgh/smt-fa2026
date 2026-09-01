<!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->

## What this is

A city simulation from 1989, opened up.

It plays like the game it is. Houses appear, shops follow, traffic thickens on
the roads, and the population number goes up. Next to it, every internal layer
the simulation keeps is drawn as it updates: land value, crime, pollution,
population density, traffic, police coverage, and how far each place is from the
centre of the city.

Watching those being written is the point. The city stops looking like a world
and starts looking like what it is - a stack of grids, being blurred into each
other, in a fixed order, sixteen steps to a turn.

The engine is micropolisJS, a JavaScript port of Micropolis, which is the
open-source release of the original SimCity. The part that runs the simulation
is about 2,400 lines. You could read all of it in an afternoon, and that is
unusual enough to be worth saying out loud.

## Why we're looking at this one

Because it is the ancestor of a great deal of urban simulation, and because it
is small enough to read.

Its rules are roughly twenty named constants. Not a trained model, not a fitted
curve, not a parameter someone estimated from data - twenty numbers, typed into
a file, and copied forward for thirty-six years. Some of them encode claims
about cities that people still argue about, written as one line of arithmetic
with no argument attached and no citation.

The clearest is the crime function:

```
crime = 128 - land value + population density - police
```

That is the whole of it. It says crime is poverty plus crowding minus policing,
in those proportions, everywhere, always. Then the land value function subtracts
20 wherever crime is over 190 - so cheap land produces crime, and crime makes
land cheaper, and the model closes the loop on itself by construction. Nobody
tested that. It is a line of code.

The second one is quieter and does more:

```
land value = 34 - distance from the city centre / 2
```

A bid-rent gradient, in one statement. Because it is written this way, no city
this engine can produce is polycentric, and nowhere far from the middle can be
expensive. Not because that was investigated and found to be true - because
there is nowhere in the code to say otherwise.

## The data

There isn't any, and that is the point worth making rather than working around.

- **The engine.** micropolisJS by Graeme McCutcheon, at commit `f13a1624`, GPLv3
  with additional terms plus the Micropolis Public Name License. The complete
  source is vendored in this repository. `NOTICE.md` beside it records what was
  taken and every change made to it.
- **What a layer is.** Each of the fifteen is a `BlockMap`: a flat array of
  numbers over a coarse grid, two, four or eight tiles to a block depending on
  the map. They are shown at their real resolution here, which is why they look
  chunky. That is the resolution the simulation thinks at.
- **The tile atlas.** One 512×512 image holding 1,024 tiles of 16 pixels. It is
  loaded by URL rather than compiled in, so replacing it needs no code at all.
- **The starting city is ours, not the engine's.** A generated Micropolis map is
  bare terrain and nothing grows on it, because in the real game a player builds
  the first city by hand. So this one is laid out by a loop on blank ground:
  bands of zones with a wire above and a road below, six power plants, three
  stations. It is identical on every run, which is what makes comparing runs
  mean anything.

**The data in this sandbox is the source code.** There is no dataset, no
pipeline, and nothing downloaded.

## How the map gets made

The simulation runs a **sixteen-phase cycle**, and the same sixteen steps happen
in the same order forever.

Phase 0 advances the clock, sets the demand valves, and **clears the census**.
Phases 1 to 8 scan the map in eighths, developing and decaying zones and
counting what they find. Phase 9 takes the census and, every forty-eight turns,
collects tax. Phase 10 lets traffic and growth decay. Phase 11 works out which
tiles have electricity. Phase 12 writes pollution, unspoilt land, and **land
value**. Phase 13 writes police coverage and then **crime**. Phase 14 writes
population density and then **moves the city centre**. Phase 15 does fire
coverage and rolls for disasters.

The order is doing real work, and one consequence is visible in that list: land
value is computed in phase 12 from a city centre that is not recalculated until
phase 14. Every land value in the model is measured from where the centre was
last turn.

**Influence spreads by blurring.** Police coverage is the map of station
positions, smoothed three times. That is the entire theory of how a public
service reaches a neighbourhood: a convolution, with its radius set by a repeat
count rather than by a distance, a response time, or a road.

**The picture and the numbers come from the same place.** The layers in the
panel are drawn from the same arrays the simulation reads; nothing is recomputed
for display.

## What it assumes

- **The constants are constants.** Every rule above is a fixed number. Nothing
  in the engine can be fitted to a real city, because there is no place to put
  data. That is the structural assumption underneath all the others, and it is
  the reason no city this model produces can be different in kind from any
  other.
- **Crime is poverty plus density minus policing**, at a one-to-one exchange
  rate, and it feeds back into land value so that poor places get poorer.
- **Value falls with distance from a single centre**, and the model has no way
  to express a city where it doesn't.
- **Access is a random walk.** A zone has jobs if a walk of up to thirty steps
  along the roads happens to find a destination. There is no route, no journey
  time, and nobody choosing anything.
- **Tax response is a lookup table** of twenty-one numbers, and demand from
  outside the city is one of three constants picked by the difficulty setting.
- **Demography is one multiplication**: a flat birth rate on the residential
  population. No ages, no households, no migration.
- **The ground is flat and empty.** The starting city is built on a blank map,
  so there is no terrain here at all - deliberately, so that every difference on
  the land value layer is the gradient or the plan rather than a river.

## What it can't see

Anyone.

There are no people in it. There are densities, and rates, and a growth valve.
Nobody in this model lives anywhere, wants anything, moves house, or is affected
by any of it. When the crime layer goes dark over a neighbourhood, nothing has
happened to anybody - a number in an array exceeded another number.

And it cannot represent a city whose most valuable place is not its centre,
because the land value function makes that geometrically impossible.

## One more thing, found while building this

The crime function did not run.

The scan loop was bounded by two properties that do not exist on the object it
read them from. Both came back undefined, the loop condition was false, and the
body never executed. So `crimeRateMap` stayed zero for the life of every city,
average crime was always exactly 0, and the land value penalty that fires above
crime 190 could never fire either - the famous feedback loop was switched off.

Nothing announced it. Cities grew, graphs moved, and the crime overlay was
simply always empty. It is fixed here, and the fix is recorded in `NOTICE.md`.

A whole subsystem of a widely-read simulation was disabled by a renamed
property, and the simulation went on looking exactly like a working simulation.
That is worth more than any of the sliders.
