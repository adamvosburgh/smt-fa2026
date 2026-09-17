---
title: "A City Simulator, Opened Up dev notes"
date: "2026-08-31"
author: Adam Vosburgh
sequence: 3
cat: tutorial
devnotes: true
published: false
---

Notes from building [A City Simulator, Opened Up](/sandboxes/coefficients/). No data pipeline. Component and vendored engine: `src/lib/sandboxes/coefficients/`; `NOTICE.md` there records every change to the engine.

![the sandbox](/covers/coefficients.png#img-full)

<div class="gap">

**What a rebuild won't have.** The sandbox runs several seeded copies of the city in a background worker for the divergence chart and draws all fifteen internal layers at once. A rebuild should run one seed and draw one layer.

</div>

## The ambition

What is behind a city simulator? The idea was to take one apart and describe its parts: what it keeps track of, in what order it updates them, and what rules connect them, then put those parts on screen next to the running city. The simulator is Micropolis, the open-source release (2008) of the original SimCity (Maxis, 1989), via micropolisJS, Graeme McCutcheon's JavaScript port. The part that simulates the city is about 2,400 lines, short enough to read in full, which is rare for a model people have used to think about cities.

## The parts

- **micropolisJS at commit `f13a1624`**, GPLv3 plus the Micropolis Public Name License, vendored whole. The source code is the material; there is no dataset.
- **Fifteen block maps.** Flat arrays over the map at 2, 4 or 8 tiles per block (land value and crime at 2, police and fire at 8); the sandbox draws them at that resolution.
- **Sixteen phases**, run in the same order forever:

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
    <text x="7" y="47" font-size="9" font-family="ui-monospace,monospace" fill="#666">density, MOVES CENTER</text>
  </g>
  <g transform="translate(420,210)">
    <rect width="132" height="62" fill="#f5f5f2" stroke="#ccc" stroke-width="1"/>
    <text x="7" y="15" font-size="10" font-family="ui-monospace,monospace" fill="#999">15</text>
    <text x="7" y="31" font-size="10.5" font-family="ui-monospace,monospace" fill="#000">fire</text>
    <text x="7" y="47" font-size="9" font-family="ui-monospace,monospace" fill="#666">fire cover, disasters</text>
  </g>
</svg>

- **About twenty constants.** Each becomes a slider defaulting to the engine's own value; the two the sandbox leads with are `crime = 128 - land value + population density - police` and `land value = 34 - distance from center / 2`.

![the two rules](/tutorials/images/03/two-rules.png#img-full)

- **The tile atlas**, one 512×512 image of 1,024 16-pixel tiles, loaded by URL so it can be swapped.
- **A starting city of our own**, laid out by a loop on blank ground (zones, roads, wires, six power plants, three stations), identical on every run.
- **A seeded random number generator** replacing `Math.random`, so runs are reproducible.

## Roadblocks

- A freshly generated map is bare terrain and nothing grows on it, because the game expects a player to build the first city; hence the starting city.
- Power spreads only through wires and zones, so a trunk cut by a river left half the city dark and looking like a model whose parameters do nothing.
- A coal plant supplies 700 tiles and every conductive tile draws power, so two plants lit 77 of 198 zones and the city sat still; the sandbox now reports what was actually placed.
- The engine's step function is throttled against the wall clock, so a tight loop simulates almost nothing; a second entry point takes one step per call.
- Land value is written in phase 12 from a city center not recomputed until phase 14; the engine's own comment says this feels wrong, and it was never changed.
- The crime scan never ran: its loop was bounded by two properties that don't exist, so crime was zero in every city and the crime-to-land-value feedback never fired; fixed here and recorded in `NOTICE.md`.
- Swapping a rule for a student's own JavaScript would mean running submitted code in every visitor's browser, so that edit surface is built but switched off.
- The first build's window was too small to follow; the current one has zoom and pan, room for the layers, and marks which layer is being written.

## What came out

A running city, its internal layers updating in step, and about twenty sliders whose defaults are the engine's numbers.

### What you should see

The crime rule at the engine's value, then at 220:

<div data-sandbox="coefficients" data-mode="view" data-params='{"crime_base":128,"land_value_distance_divisor":2,"seed":1,"ticks":1000,"run_count":5,"layer":"crimeRateMap"}'></div>

<div data-sandbox="coefficients" data-mode="view" data-params='{"crime_base":220,"land_value_distance_divisor":2,"seed":1,"ticks":1000,"run_count":5,"layer":"crimeRateMap"}'></div>

- Average crime goes from about 92 to about 171, and population falls, because the engine links low land value to crime and crime back to land value.
- With the weight on land value at 0 the model stops connecting the two and everything else carries on.
- Raising the distance divisor flattens the land value gradient, but no setting makes a place far from the center the most valuable.
- With the layer set to `none` the overlay follows whichever map the cycle most recently wrote.
- Swapping the tile atlas changes the picture and nothing else.

### Limitations

- Every rule is a constant and there is no place for data, so no city it produces can differ in kind from another.
- There are no people, only densities, rates and a growth valve.
- The order of operations is itself an assumption and has shipped that way for decades.

---

Notes by Adam Vosburgh, Fall 2026.
