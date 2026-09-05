---
title: "Tutorial 3 — The Coefficients"
date: "2026-08-31"
author: Adam Vosburgh
sequence: 3
cat: tutorial
published: true
---

<!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->

This module is about reading a simulation instead of watching one. We take a
city simulator that has been running since 1989, open it up, find the twenty or
so numbers that are actually driving it, and turn them into controls. By the end
you'll have the engine running on your own machine with its internal layers on
screen, and you'll have changed a constant and argued about what happened.

There is no data in this module. There is no download, no pipeline, and no
Python. The data is the source code, which is a point worth making rather than
working around.

<div class="gap">

**What the tutorial version won't have.** The sandbox runs several seeded copies
of the city headlessly in a background worker to draw the divergence chart, and
renders all fifteen internal layers at once. The tutorial version runs one seed
and renders one layer. It is the same engine, the same constants and the same
sixteen phases — there is just less on screen.

</div>

## Reading a simulation as a text

Two thousand four hundred lines.

That is the size of the part of micropolisJS that actually simulates a city —
the map scan, the census, the block maps, the growth rules, the valves. The
whole project including its interface is about thirteen thousand, but the model
is two and a half.

You can read that. Not skim it: read it, all of it, in an afternoon, and come
out knowing every rule the thing has. That is unusual, and the reason it is
unusual is worth being annoyed about. Most models that get used to make
decisions about cities cannot be read at all — either because they are
proprietary, or because they are a fitted object with no rules in them to read.

So treat this one as a text. It is a rare chance to hold an entire urban
simulation in your head at once, and the experience of doing it should be your
baseline expectation of what a model owes you, not a treat.

While you're in there, notice how little of it is about cities and how much of
it is about arrays.

## Producing the data

There is no data. Here is what there is instead.

**Where the engine came from.** micropolisJS is Graeme McCutcheon's JavaScript
port of Micropolis, which is the open-source release of the original SimCity
engine. It is GPLv3 with additional terms, plus a separate licence covering the
name. We vendor the complete source into the repository at a recorded commit,
with its licences intact, and `NOTICE.md` records every change made to it.

Read that file before you change anything. It is also the model for what you
should write when you take someone else's code into your own project.

**What a `blockMap` is.** The simulation keeps fifteen of them. Each is a flat
array of numbers covering the map at a coarser resolution than the tiles — a
block is two, four or eight tiles across, depending on which map. Land value and
crime are on two-tile blocks; police and fire coverage are on eight.

**The sixteen phases.** The simulation does the same sixteen steps in the same
order, forever. This is the whole control flow of the model:

<svg viewBox="0 0 552 272" width="100%" role="img" aria-label="The sixteen phases of the simulation cycle, in order, showing what each one writes." style="max-width:600px;height:auto;display:block;margin:1.5rem 0;">
  <g transform="translate(0,0)">
    <rect width="132" height="62" fill="#f5f5f2" stroke="#000" stroke-width="1"/>
    <text x="7" y="15" font-size="10" font-family="ui-monospace,monospace" fill="#999">0</text>
    <text x="7" y="31" font-size="10.5" font-family="ui-monospace,monospace" fill="#000">tick over</text>
    <text x="7" y="47" font-size="9" font-family="ui-monospace,monospace" fill="#666">clock, valves</text>
  </g>
  <g transform="translate(140,0)">
    <rect width="132" height="62" fill="#f5f5f2" stroke="#ccc" stroke-width="1"/>
    <text x="7" y="15" font-size="10" font-family="ui-monospace,monospace" fill="#999">1</text>
    <text x="7" y="31" font-size="10.5" font-family="ui-monospace,monospace" fill="#000">scan 1/8</text>
    <text x="7" y="47" font-size="9" font-family="ui-monospace,monospace" fill="#666">zones, census</text>
  </g>
  <g transform="translate(280,0)">
    <rect width="132" height="62" fill="#f5f5f2" stroke="#ccc" stroke-width="1"/>
    <text x="7" y="15" font-size="10" font-family="ui-monospace,monospace" fill="#999">2</text>
    <text x="7" y="31" font-size="10.5" font-family="ui-monospace,monospace" fill="#000">scan 2/8</text>
    <text x="7" y="47" font-size="9" font-family="ui-monospace,monospace" fill="#666">zones, census</text>
  </g>
  <g transform="translate(420,0)">
    <rect width="132" height="62" fill="#f5f5f2" stroke="#ccc" stroke-width="1"/>
    <text x="7" y="15" font-size="10" font-family="ui-monospace,monospace" fill="#999">3</text>
    <text x="7" y="31" font-size="10.5" font-family="ui-monospace,monospace" fill="#000">scan 3/8</text>
    <text x="7" y="47" font-size="9" font-family="ui-monospace,monospace" fill="#666">zones, census</text>
  </g>
  <g transform="translate(0,70)">
    <rect width="132" height="62" fill="#f5f5f2" stroke="#ccc" stroke-width="1"/>
    <text x="7" y="15" font-size="10" font-family="ui-monospace,monospace" fill="#999">4</text>
    <text x="7" y="31" font-size="10.5" font-family="ui-monospace,monospace" fill="#000">scan 4/8</text>
    <text x="7" y="47" font-size="9" font-family="ui-monospace,monospace" fill="#666">zones, census</text>
  </g>
  <g transform="translate(140,70)">
    <rect width="132" height="62" fill="#f5f5f2" stroke="#ccc" stroke-width="1"/>
    <text x="7" y="15" font-size="10" font-family="ui-monospace,monospace" fill="#999">5</text>
    <text x="7" y="31" font-size="10.5" font-family="ui-monospace,monospace" fill="#000">scan 5/8</text>
    <text x="7" y="47" font-size="9" font-family="ui-monospace,monospace" fill="#666">zones, census</text>
  </g>
  <g transform="translate(280,70)">
    <rect width="132" height="62" fill="#f5f5f2" stroke="#ccc" stroke-width="1"/>
    <text x="7" y="15" font-size="10" font-family="ui-monospace,monospace" fill="#999">6</text>
    <text x="7" y="31" font-size="10.5" font-family="ui-monospace,monospace" fill="#000">scan 6/8</text>
    <text x="7" y="47" font-size="9" font-family="ui-monospace,monospace" fill="#666">zones, census</text>
  </g>
  <g transform="translate(420,70)">
    <rect width="132" height="62" fill="#f5f5f2" stroke="#ccc" stroke-width="1"/>
    <text x="7" y="15" font-size="10" font-family="ui-monospace,monospace" fill="#999">7</text>
    <text x="7" y="31" font-size="10.5" font-family="ui-monospace,monospace" fill="#000">scan 7/8</text>
    <text x="7" y="47" font-size="9" font-family="ui-monospace,monospace" fill="#666">zones, census</text>
  </g>
  <g transform="translate(0,140)">
    <rect width="132" height="62" fill="#f5f5f2" stroke="#ccc" stroke-width="1"/>
    <text x="7" y="15" font-size="10" font-family="ui-monospace,monospace" fill="#999">8</text>
    <text x="7" y="31" font-size="10.5" font-family="ui-monospace,monospace" fill="#000">scan 8/8</text>
    <text x="7" y="47" font-size="9" font-family="ui-monospace,monospace" fill="#666">zones, census</text>
  </g>
  <g transform="translate(140,140)">
    <rect width="132" height="62" fill="#f5f5f2" stroke="#ccc" stroke-width="1"/>
    <text x="7" y="15" font-size="10" font-family="ui-monospace,monospace" fill="#999">9</text>
    <text x="7" y="31" font-size="10.5" font-family="ui-monospace,monospace" fill="#000">census</text>
    <text x="7" y="47" font-size="9" font-family="ui-monospace,monospace" fill="#666">population, tax</text>
  </g>
  <g transform="translate(280,140)">
    <rect width="132" height="62" fill="#f5f5f2" stroke="#ccc" stroke-width="1"/>
    <text x="7" y="15" font-size="10" font-family="ui-monospace,monospace" fill="#999">10</text>
    <text x="7" y="31" font-size="10.5" font-family="ui-monospace,monospace" fill="#000">decay</text>
    <text x="7" y="47" font-size="9" font-family="ui-monospace,monospace" fill="#666">traffic, growth</text>
  </g>
  <g transform="translate(420,140)">
    <rect width="132" height="62" fill="#f5f5f2" stroke="#ccc" stroke-width="1"/>
    <text x="7" y="15" font-size="10" font-family="ui-monospace,monospace" fill="#999">11</text>
    <text x="7" y="31" font-size="10.5" font-family="ui-monospace,monospace" fill="#000">power</text>
    <text x="7" y="47" font-size="9" font-family="ui-monospace,monospace" fill="#666">which tiles are lit</text>
  </g>
  <g transform="translate(0,210)">
    <rect width="132" height="62" fill="#ececff" stroke="#000" stroke-width="1"/>
    <text x="7" y="15" font-size="10" font-family="ui-monospace,monospace" fill="#999">12</text>
    <text x="7" y="31" font-size="10.5" font-family="ui-monospace,monospace" fill="#000">land value</text>
    <text x="7" y="47" font-size="9" font-family="ui-monospace,monospace" fill="#666">pollution, terrain too</text>
  </g>
  <g transform="translate(140,210)">
    <rect width="132" height="62" fill="#ececff" stroke="#000" stroke-width="1"/>
    <text x="7" y="15" font-size="10" font-family="ui-monospace,monospace" fill="#999">13</text>
    <text x="7" y="31" font-size="10.5" font-family="ui-monospace,monospace" fill="#000">crime</text>
    <text x="7" y="47" font-size="9" font-family="ui-monospace,monospace" fill="#666">police cover, CRIME</text>
  </g>
  <g transform="translate(280,210)">
    <rect width="132" height="62" fill="#ececff" stroke="#000" stroke-width="1"/>
    <text x="7" y="15" font-size="10" font-family="ui-monospace,monospace" fill="#999">14</text>
    <text x="7" y="31" font-size="10.5" font-family="ui-monospace,monospace" fill="#000">density</text>
    <text x="7" y="47" font-size="9" font-family="ui-monospace,monospace" fill="#666">density, MOVES CENTRE</text>
  </g>
  <g transform="translate(420,210)">
    <rect width="132" height="62" fill="#f5f5f2" stroke="#ccc" stroke-width="1"/>
    <text x="7" y="15" font-size="10" font-family="ui-monospace,monospace" fill="#999">15</text>
    <text x="7" y="31" font-size="10.5" font-family="ui-monospace,monospace" fill="#000">fire</text>
    <text x="7" y="47" font-size="9" font-family="ui-monospace,monospace" fill="#666">fire cover, disasters</text>
  </g>
</svg>

Shaded above: phase 0 clears the census, and phases 12, 13 and 14 write the
three layers this sandbox is mostly about. Read them in order and one thing
jumps out — **land value is written in phase 12 from a city centre that is not
recomputed until phase 14.** Every land value in the model is measured from
where the centre was last turn. The engine's own source carries a comment saying
this feels wrong and that the two should probably be swapped. They never were.

That coarseness is not a display choice. It is the resolution the simulation
thinks at, and it is why the layers look chunky in the panel. We draw them at
their real block size rather than smoothing them, because smoothing them would
be inventing a precision the model does not have.

**The tile atlas.** One 512×512 image, holding 1,024 tiles of 16 pixels each, 32
to a row. A tile's numeric value is its index into that grid. The atlas is
loaded by URL rather than compiled into the bundle, which means you can replace
it with your own and change nothing else. Same rules, different world.

**The starting city.** This one surprised us. A freshly generated Micropolis map
is bare terrain — rivers and forest, no roads, no zones, no power — and nothing
ever grows on it, because in the real game the first city is built by a player
with a mouse. So a simulation left to run on a generated map produces a
permanent wilderness and every number stays at zero.

The sandbox therefore lays out its own starting city, by a loop, on blank
ground: horizontal bands with a wire above and a road below, zones between them,
six power plants, three stations. Identical on every run.

Two things went wrong there that are worth walking into on purpose.

The first is power. Electricity spreads only through *conductive* tiles — wires
and zones, not roads — so a zone with no conductive path back to a plant stays
dark and never develops. A single wire trunk severed by a river left half the
city unpowered, which from the panel looks exactly like a model whose parameters
do nothing.

The second is capacity. A coal plant in this engine supplies 700 tiles, and
power is consumed by every conductive tile the scan reaches, not by every zone.
Two plants lit 77 zones out of 198 and the city sat still. Nothing warned us.
The city just stopped growing, and every slider still moved.

**Always total your build against what you asked for.** The sandbox reports how
many zones, stations and plants were actually placed, because a city that is
quietly half-built is indistinguishable from a model that is quietly broken.

## Setting up the web environment

Every sandbox on this site is one Svelte component taking `params`, `assets` and
a `mode` of either `edit` or `view`. It reports its numbers upward and says when
it has settled; the frame around it publishes those. Read
`src/lib/sandboxes/bathtub/` first — it is the reference implementation.

Two things are specific to this module.

**Vendoring third-party source under `src/`.** The engine has to live under
`src/` because that is the only place `import.meta.glob` and the bundler can
reach. We take the whole tree rather than the files we use, so the licence
question is "the whole thing at this commit" rather than a judgement call about
what counts as a derived selection — and so that you can check the claim that
it's small enough to read.

We do **not** adopt the engine's own build setup. Vite bundles it as part of the
site. The engine's own interface — its windows, its toolbar, its canvas — is
never imported, which is also how jQuery stays out of the bundle entirely.

**Isolating the engine from the page.** The simulation core touches no DOM at
all. That is what lets the identical code run on the page and inside a Web
Worker, which is how the divergence chart runs thousands of steps without
freezing the interface.

One thing you will hit if you try to run it headlessly yourself: the engine's
step function is throttled against the *wall clock*. It returns early unless ten
to a hundred real milliseconds have passed, depending on the speed setting. So
"speed" is a real-time rate limiter, and calling it in a tight loop simulates
almost nothing. We added a second entry point that takes one step per call with
no clock in it, and left the original alone. Reproducibility needs that: one
call, one step.

## The parameters

Three surfaces, at three different floors of difficulty. You can make an
arguable submission at any of them.

**The easiest one: replace the tile atlas.** Swap the image and change nothing
else. Same rules, same constants, same city — different world. A student who
will not touch JavaScript has still made an argument, and it is a real one,
because it separates what the model *is* from what it *looks like*. Those are
confused constantly, in both directions.

**The middle one: change a constant.** This is the main event.

Start with the crime function, which is one line:

```
crime = 128 - land value + population density - police
```

Here it is at the engine's own value:

<div data-sandbox="coefficients" data-mode="view" data-params='{"crime_base":128,"land_value_distance_divisor":2,"seed":1,"ticks":1000,"run_count":5,"layer":"crimeRateMap"}'></div>

And here it is at 220, with nothing else altered:

<div data-sandbox="coefficients" data-mode="view" data-params='{"crime_base":220,"land_value_distance_divisor":2,"seed":1,"ticks":1000,"run_count":5,"layer":"crimeRateMap"}'></div>

Average crime goes from about 92 to about 171 — and the population falls, which
is the part to sit with. It falls because low land value raises crime and high
crime lowers land value, and the engine wires that loop deliberately. One
constant, and the model's account of poverty and disorder changes with it.

Then set **weight on land value** to 0. The model stops claiming that cheap land
produces crime. Everything else carries on working, uncomplaining, which tells
you something about how load-bearing that claim was supposed to be.

The other constant worth your time is the distance divisor. Land value is:

```
land value = 34 - distance from the city centre / 2
```

Turn the divisor up and the gradient flattens: the city gets richer and less
centralised. What you cannot do, at any setting, is make somewhere far from the
centre the most valuable place, because the line does not permit it.

**The hardest one: replace a rule.** The engine's rules are reachable through a
function table, so one of them could be swapped for your own implementation
without touching anything else. **This is not switched on.** Running submitted
JavaScript on a public site is arbitrary code execution in every visitor's
browser, and how to contain it safely is an open question. The table is built
and the engine calls through it, so wiring it later is a switch rather than a
rewrite — but for now the third surface is closed.

## The assumptions

**The constants are constants.** That is the assumption underneath every other
one, and it is a property of the file format as much as of the code. There is
nowhere in this engine to put data. No rule can be fitted to a real city, no
coefficient can be estimated, nothing can be calibrated against anything. So no
city the model produces can be different *in kind* from any other city it
produces — only bigger, poorer, or dirtier.

This is the thread that runs through the whole course. A model's file format
decides what it is capable of believing. Bathtub can't express a tide gate
because there is nowhere in the raster to put one. This engine can't express a
second downtown because land value is a function of distance from *the* centre,
singular.

**The order of operations is an assumption too.** Land value is written in phase
12 from a city centre that is not recomputed until phase 14, so every land value
in the model is measured from where the centre was last turn. The engine's own
source has a comment noting this and saying it feels wrong. It was left as it
was, and it has been shipped that way for decades.

**And a model can be broken for years without looking broken.** While building
this we found that the crime scan never ran at all: its loop was bounded by two
properties that do not exist, both read as undefined, and the body never
executed. Crime was zero in every city, and the crime-to-land-value feedback
could not fire. The game still played. The graphs still moved. The overlay was
just always empty.

Nobody noticed because the output still looked like a city. That is the failure
mode to be afraid of — not the model that crashes, but the model that keeps
producing plausible pictures with a piece of itself switched off.

## Challenge

Surface one assumption, show the layer it writes, change it, and show what
diverged.

That is also the assignment. Pick a constant, find the line it lives on, say in
plain language what claim about cities that line is making, then move it and
show the consequence on the layer and in the numbers. The strongest submissions
will be the ones where the constant seemed boring until you read it.

If you want a harder one: the city centre is recomputed as the mean position of
populated zones, *after* the land value that depends on it has been written.
Swap the two phases and argue about whether the city that comes out is more or
less right.

---

Module by Adam Vosburgh, Fall 2026.
