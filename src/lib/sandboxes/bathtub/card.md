## What this is

A flood map of New York that you build yourself, one setting at a time.

You have seen a lot of flood maps. Blue over the Rockaways, blue along the
Gowanus, a caption about 2050. They are one of the few kinds of model that
regularly make it out of a research group and onto a news site, a rezoning
document, or an insurance quote for a building someone is about to buy. They
usually arrive as a finished picture, with the arguments already settled and
the settings already chosen.

This is the same map with the lid off. You pick how far into the future to
look, and which of the published projections to believe. The sandbox turns
that into a single number - one water height for the whole harbour - and then
colours in every piece of ground that sits below it. That is the entire model.
It's called a bathtub model because that is more or less what it does: it fills
the city like a tub, up to a line.

## Why we're looking at this one

Because the method is simple enough to hold in your head, and the stakes
attached to it are not.

Nearly everything that is interesting about a flood map happens before the
blue goes on. Which projection out of four. Which point in the tide cycle.
Whether water is required to have a route to a place before that place is
allowed to flood. None of those choices are visible in the finished map, and
all of them move the coastline. Turn them into controls and they stop being
invisible.

It is also a good first model to argue with, because you can check it. The
numbers in the panel come from the same grid the picture is drawn from, so if
you think a reading is wrong you can go and look at the place on the map.

## The data

Four things, all published, all downloadable.

- **The ground.** USGS 3DEP elevation, 1/3 arc-second - about one height
  measurement every 10 metres - clipped to New York. Heights are metres above
  NAVD88, a national vertical reference surface. We ship it at roughly 20m per
  cell to keep the download reasonable.
- **How much the sea rises.** The NPCC4 projections (Braneon et al. 2024, on
  NYC Open Data as `38ps-fnsg`). Four percentiles for each of five dates.
- **Where the tide is.** Three tidal datums from NOAA's gauge at the Battery,
  station 8518750, on the 1983-2001 epoch, given relative to NAVD88 so they can
  be added to the ground heights directly.
- **What is standing on the ground.** NYC Building Footprints for the buildings
  themselves, MapPLUTO for how many homes are in them, and 2020 Census tract
  population for how many people live in the area.

## How the map gets made

Everything is measured against the same vertical reference, NAVD88, which is
what makes the comparison legal in the first place. Sea level rise, storm surge
and the tide offset are added together into one waterline. A cell of ground is
flooded if its height is below that line.

The connectivity switch changes the test. With it on, a cell floods only if
there is a path of low ground joining it to open water. Working that out for
every position of the slider would mean re-running a flood fill sixty times a
second, so we run it once, when the data is built, and store the answer per
cell: the lowest waterline at which this cell connects to the sea. Then both
versions of the model are a single comparison, which is why the slider is
instant.

The blue is drawn on your graphics card, from two images. Ground height and
that connection height are packed into the red and green channels of ordinary
PNGs, and a small shader decodes them and compares each against the waterline.
The flood line is found in the same pass, by looking for wet cells that sit
next to dry ones. It is not a boundary someone drew and published. Zoom in far
enough and you can watch it become a staircase of grid cells, which is what
every smooth blue polygon is hiding.

The numbers in the panel are computed separately, on the CPU, from the same two
images with the same formula. That is deliberate: the picture and the numbers
cannot quietly disagree.

## What it assumes

- **The sea is flat.** One rise value and one tide value for the whole city.
  NOAA uses a tidal surface that varies from place to place, because the real
  one does.
- **A storm is just a higher number.** Surge is added everywhere at once. There
  is no arrival, no peak, no drain, and no wind.
- **Connectivity is a property of the terrain.** Precomputing that connection
  height asserts that "can water get here" has one answer, decided once. On a
  real coastline it doesn't: culverts, tide gates, pumps and surge barriers
  change it on a timescale of hours. The file format can't express that, so the
  sandbox can't either.
- **Grid cells are bigger than lots.** A cell is about 20m across, wider than
  many row houses. So a building is judged by its own recorded ground height
  rather than by the cell it sits in, and buildings recorded above 12m are
  dropped entirely, since the highest water the model can produce is about 9.7m.
- **Population stays at tract resolution.** A partly flooded tract contributes
  its population in proportion to the share of its area under water. We never
  push people down onto individual buildings. That would look more precise and
  be less true.
- **A lot's homes are split across its buildings.** MapPLUTO counts homes per
  lot, and several footprints can share a lot. Counting the lot total once per
  building gave 11.3 million homes in a city with about 3.6 million, so each
  lot's count is divided across the buildings on it.

## What it can't see

Water moving.

There's no time in this model, so there's no rain, no drainage, no waves, no
storm that arrives and then leaves, no pump switching on, no sea wall someone
builds in 2043. Nobody in it evacuates, and no basement fills from below. It is
a line drawn where the ground meets a number.

That's worth saying plainly, and it's also worth saying that this is roughly
the model most cities publish. NOAA's own Sea Level Rise Viewer is a bathtub
model with connectivity and a varying tidal surface. The gap between this
sandbox and the official map is much smaller than the gap between either of
them and a flood.
