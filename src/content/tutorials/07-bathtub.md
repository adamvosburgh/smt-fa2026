---
title: "Tutorial 7 — Bathtub"
date: "2026-08-30"
author: Adam Vosburgh
sequence: 7
cat: tutorial
published: true
---

This module is about how a flood map gets made. We'll build the sea level
sandbox: where the ground heights come from, how a projection about the future
turns into a blue shape on a map, and why one switch in the corner of the panel
changes the answer more than any of the sliders do. By the end you'll have a
version running on your own machine that you can point at a different coastline.

You have almost certainly seen a map like the one this produces. They show up in
news articles, rezoning documents, and the flyer that came with somebody's flood
insurance. They arrive finished. Somebody already chose the date, already chose
which projection to believe, already decided whether water needs a route to a
place before that place is allowed to flood - and then handed you the picture
with none of that written on it. We're going to make the same picture with all
of those choices left as controls.

**This tutorial is still a skeleton.** The four sections below are the four
things every tutorial in this course covers, and there's real explanation in
them, but the step-by-step build isn't written yet. The finished sandbox and the
pipeline that feeds it are both in the repo already, so you can read ahead if you
want: the processing script is `data/scripts/bathtub.py` and the sandbox is
`src/lib/sandboxes/bathtub/`. The headings here are load-bearing - the submission
checker links people to them by name, so don't rename one without updating
`FAILURE_MAP` in `src/lib/server/validate.js`.

<div class="gap">

**What the tutorial version won't have.** The sandbox ships a terrain grid for
all five boroughs, plus about 470,000 building footprints and every census
tract. The version you build here runs on a much smaller window - the processing
is identical, there's just less of it. Nothing else differs. This is the one
sandbox where the tutorial gets you essentially the whole thing.

</div>

## On simplification

A bathtub model is a threshold. A place is flooded if the water is higher than
the ground. That's it - that's the model, and it's worth saying out loud how
little there is to it before we spend three sections building one.

It's easy to read that as an insult to the method. It isn't. NOAA's Sea Level
Rise Viewer, which is the map most Americans are actually looking at when they
look at a flood map, is a bathtub model. It adds a connectivity step and a tidal
surface that varies from place to place, and those are real improvements, but the
core of it is still: is the ground below the line. The distance between what
you're about to build and what a federal agency publishes is much smaller than
you'd expect, and much smaller than the distance between either of them and an
actual flood.

That's the reason this is the first sandbox. Not because it's a bad model - it's
a defensible one, given what it's for - but because the gap between how simple it
is and how much weight it carries is enormous, and you can see the whole thing
at once.

## Producing the data

Four inputs, all public. Three of them are ordinary downloads and one of them is
the expensive part.

**The ground.** A digital elevation model, or DEM: a grid where every cell holds
one number, the height of the ground at that spot. We use USGS 3DEP at 1/3
arc-second, which works out to roughly one measurement every 10 metres, clipped
to a box around New York. Heights are metres above NAVD88, which is a national
reference surface - roughly, but not exactly, sea level. The datum matters more
than it sounds like it should, and we'll come back to it.

New York publishes its own lidar surface at one-foot resolution, which is far
more detailed. I chose the USGS one anyway, for two reasons. It's *published* at
10m, so nobody is downsampling anything and pretending they didn't. And it covers
the whole country, so when you point this at Providence or Mobile in your final
project, the same code runs.

**How much the sea rises.** The New York City Panel on Climate Change publishes
projections for five dates. Notice what shape they come in: four percentiles -
10th, 25th, 75th and 90th - and deliberately no median. There is no "the"
projection. Any single flood map you have ever seen picked one of those four on
your behalf, and most of them didn't tell you which.

**Where the tide is.** Sea level rise gets added to a sea that is already moving.
At the Battery the water swings about a metre and a half between low and high
tide, which is more than the entire projected rise for the 2080s at the 75th
percentile. NOAA publishes tidal datums for the gauge there, relative to NAVD88 -
the same reference as the DEM, which is the only reason we're allowed to add
them together. **Check your datums before you add two elevations. This is the
single most common way a flood map is silently wrong.**

**What's standing on the ground.** Building footprints from NYC Open Data, home
counts from MapPLUTO, and 2020 census population by tract. These are what turn
"3.4 square kilometres" into a number anybody cares about.

### The join is where the bugs are

Two things went wrong here that are worth walking into on purpose.

`UnitsRes` in MapPLUTO is the number of homes on a *lot*, and several building
footprints can sit on the same lot. Joining it straight onto each footprint gave
me 11.3 million homes in a city with about 3.6 million. So: always total your
join against a published figure before you believe it. When the tract populations
summed to exactly 8,804,190 - the official 2020 count for New York - that's when
I trusted the population join, and not before.

The second one is subtler and it broke the map rather than a number. Open water
is below the waterline, obviously. So a naive threshold floods the harbour, and
"area flooded" comes out larger than the land area of New York City. Everything
has to be measured against a *baseline* waterline - today's tide, no rise, no
surge - so that "newly flooded" means newly. The sandbox draws only new
inundation and leaves the existing sea to the basemap.

## Setting up the web environment

Every sandbox on this site is one Svelte component that takes `params`, `assets`
and a `mode` of either `edit` or `view`. Edit mode is what you see on the sandbox
page, with the control panel. View mode is the small version on a gallery card
and in the frozen archive. Same code both times, which is what makes freezing the
site in December a mechanical step rather than a rewrite during finals week.

The component never touches `window.__metrics` or `data-cover-ready` itself. It
reports its numbers upward and says when it has settled, and the frame around it
publishes those. That way the screenshot robot that makes the cover images has
exactly one thing to wait for, the same across all seven sandboxes.

Read `src/lib/sandboxes/bathtub/` before you write your own. It's the reference
implementation and it's commented for that purpose.

## The parameters

Three of these carry the sandbox and the rest are furniture.

**Hydraulic connectivity.** This is the one. A naive bathtub floods every low
spot below the waterline, whether or not water can physically get there - the
sunken tennis court in the middle of a park, the basin behind an embankment, a
depression three streets inland with high ground all the way around it. The fix
is one step: instead of asking "is this cell below the line", ask "is this cell
below the line *and* joined to open water by a path of ground that is also below
the line". Flood fill from the shoreline rather than thresholding the whole grid.

Turn it off and watch the map. The red patches are the difference. Then notice
that most published flood maps *do* apply connectivity, and are still bathtub
models - the connectivity step fixes an obvious embarrassment, not the underlying
claim that a coastline is a contour.

Here it is with connectivity off, at a metre and a half:

<div data-sandbox="bathtub" data-mode="view" data-params='{"slr_m":1.5,"link_year":false,"connectivity":false,"aep":"none","surge_m":0,"tide":"mhhw","percentile":75,"year":2080,"basemap":"elevation","flood_line":true}'></div>

**Which projection.** The percentile control. Since there are four published
values and no median, choosing one is unavoidable, and the choice is an editorial
one made on the reader's behalf. Set the date to 2150 and click through the four:
the 10th percentile is 1.0 metres and the 90th is 4.5. The spread is not
symmetric, and the interesting disagreement lives in the tail.

**The storm, by how often.** Storm surge started out as a slider in metres, which
is an honest control and a useless one - nobody knows what 1.75 metres means.
It is now a choice between the four levels NOAA publishes for this gauge, named
by how often the water gets that high: 99%, 50%, 10% and 1% in any given year.
The metre slider is still there as an override, so you can set a height by hand
and read off roughly how often it happens.

Two things fell out of doing that, and both are the kind of thing that only
shows up when you go to the source. The first is that the four levels are the
four levels: there is no 2% and no 0.2% in this product, and the "500-year
flood" people talk about is a FEMA quantity computed a different way. If your
control offers a value the source doesn't publish, you invented it.

The second is arithmetic. These levels are fitted to the highest water level of
each year, and the highest water level of a year happens at high tide - so the
tide is already inside the number. NOAA states the 1% level twice, as 2.40m
above NAVD88 and as 1.70m above mean higher high water, and those are the same
sentence. Which means the tide control cannot be added to it, and picking a
probability greys the tide out instead. Getting that wrong would have added
about 70cm of water to every 100-year map the sandbox draws, and nothing on the
screen would have looked broken.

Worth knowing what these levels leave out, too: they are still water, no waves.
The 1% is about 7.9 feet above NAVD88 and Sandy reached about 11.3 feet at this
gauge. That gap is not an error in either number.

The rest - tide state, depth shading, the flood line toggle - are there so you
can see what each one contributes.

## The assumptions

The biggest assumption in this sandbox is hiding in the file format, which is
where they usually hide.

We don't ship a flood mask for each step of the slider. We ship two numbers per
cell: the ground height, and the *spill elevation* - the lowest waterline at
which that cell becomes connected to open water. With both stored, each version
of the model is a single comparison:

```
naive bathtub       flooded = ground <= waterline
with connectivity   flooded = spill  <= waterline
```

Both are one threshold test, so the slider is instant and there's no payload per
step at all. It also means the set of cells where `ground <= waterline < spill`
is *exactly* the inland depressions water can't reach - the argument the sandbox
exists to make falls out of the storage format for free.

That's a nice optimisation, and it's also a claim. Precomputing the spill
elevation asserts that connectivity is a static property of terrain: that "can
water get here" has one answer, decided once, at build time. On a real coastline
it doesn't. Culverts, tide gates, pumps and surge barriers all change the answer,
and they change it on a timescale of hours. The file format can't express that,
so the sandbox can't either.

There's a smaller one worth noticing too. A grid cell here is about 20 metres
across, which is wider than a lot of row houses. So the model can't decide
whether an individual building is wet from the grid - it uses the building's own
recorded ground height instead. And population stays at tract resolution and is
never pushed down onto individual buildings, because doing that would look far
more precise than it is. Inventing precision is the failure this whole course is
about.

## Challenge

Point the pipeline at a different coastline and argue with what comes out. Or
keep New York and change something you think is wrong: use the city's one-foot
lidar instead of the 10m grid and see whether the flood line actually moves,
or find a place where the connectivity model calls open water dry land and work
out why.

---

Module by Adam Vosburgh, Fall 2026.
