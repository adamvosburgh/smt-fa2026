---
title: "Tutorial 3 — After Five"
date: "2026-08-31"
author: Adam Vosburgh
sequence: 3
cat: tutorial
published: true
---

<!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->

This module is about building a model out of other people's judgements when
those judgements are not published. We take a district of Lower Manhattan in 3D,
score every office building for how convertible it is, run a deal against it,
and watch downtown turn residential over twenty-five years.

It is also the module where the most things went wrong, and where the going
wrong is the lesson. Two of the datasets the plan named turned out not to be
what they said. One join looked perfect and was wrong one time in five. Read the
sections on those before you read the ones on the model.

<div class="gap">

**What the tutorial version won't have.** Neither will the sandbox, and that is
the honest gap here.

The sandbox is named for the street at nine in the evening, and **there is no
crowd in it.** The plan was two thousand agents walking a street network on a
looping day, so you could scrub the year and watch the district stop going dark
at night. Building that needs a published account of who is on the street when,
and none was found that could be cited. So what ships is a *count* of the
residents who would live there and no animation at all.

That is not a corner cut for time. Animating a schedule nobody published would
produce a picture that looks like evidence and is a guess with a frame rate,
which is the exact failure this whole course exists to name. The absence is the
point, and it is on the face of the sandbox rather than in a footnote.

</div>

## Playing back a schedule is not simulating behaviour

Before anything else, the distinction this module was going to be built on.

There are two ways to put people on a street in a model. You can simulate them:
give each one goals, a way of choosing routes, and let the behaviour come out of
the interaction. Or you can play back a schedule: take a published account of
what proportion of people are where at each hour, and move dots accordingly.

The second is almost always the honest choice for work like this, and it is
worth being clear about why. An agent-based model of pedestrians looks like it
knows why people are where they are. It does not — it knows what its author
assumed about why, and those assumptions are usually buried in a parameter file.
A schedule playback claims much less: it says "this many people, at this hour,
because a survey counted them", and every one of its claims can be checked
against the survey.

So the plan here was playback, not simulation, precisely because playback is
falsifiable.

**And then the schedule could not be found.** Not a schedule — plenty of those
exist — but one that could be cited, that covered both office and residential
use, and that someone could check. Without it, playback loses the only advantage
it had over simulation: the checkability. It becomes an animation of a number
somebody made up.

At that point the choice is to ship it labelled as illustrative, or not to ship
it. This sandbox does not ship it. You may disagree, and if you do, the argument
you have to win is why a picture of people moving is worth having when nobody
can check it.

## Producing the data

Three things went wrong here. Each is a shape of failure you will meet again.

### The file that had no names in it

DCP publishes its 3D building survey twice: as Rhino `.3dm` files, one per
community district, and as CityGML, one per "delivery area". The obvious choice
is the `.3dm` — it is organised the way you want, one file per district, with
clean layers for footprints and roof outlines.

It carries **no attributes at all.** Not a name, not a user string, not a BIN or
a BBL, on any of its 132,223 objects. It is pure geometry. Which means that
every join to anything else — to a filing, to a tax lot, to employment — has to
be made by position.

So that is what was built: match each modelled footprint to the nearest building
footprint record, take that record's BIN. It worked. **1,744 of 1,752 buildings
matched, median distance two feet.** Those are the numbers you would put in a
methods note and move on.

Then the CityGML turned up, which carries a real BIN on every surface, and the
inferred identities could be checked against it. **They were wrong for one
building in five.**

Sit with why. "Nearest centroid" is not "same building". In a district of
party-wall buildings the centroids of neighbours are a few tens of feet apart,
so the nearest one is frequently the one next door. And the two-foot median —
the statistic that made the join look excellent — measured *how close the
nearest centroid was*, not *whether it was the right building*. It was a
confident, precise, well-calculated measurement of the wrong quantity.

**That is the most useful thing in this module.** A validation statistic can be
correct and still tell you nothing, if it measures something other than the
thing you need to be true. Ask of every join metric you compute: what would this
number look like if the join were wrong?

The sandbox now uses the CityGML and nothing in it is joined by position.

### The dataset that was one borough

The plan named two DOB datasets: the legacy job filings, and "DOB NOW: Build –
Job Application Filings" for the modern era. The second is necessary because the
first falls off a cliff — Manhattan change-of-use filings drop from 1,109 in
2020 to 237, 77 and 56 in the years after. That looks exactly like a policy
effect and is not one; it is the migration between two systems.

**The modern dataset contains only Brooklyn.** 86,130 rows, every job filing
number prefixed with a B, no Manhattan at all.

Nothing in the dataset's title or description says so. You find it by grouping
on borough, which takes about ten seconds and which almost nobody does.

The replacement is certificates of occupancy, which are citywide and are
arguably better evidence anyway: a filing is an application, a certificate is a
completion. **Check the borough coverage of every dataset you rely on**, and
check it before you build on it rather than after.

### The certificates that were not conversions

And immediately, the next layer of the same trap. Of 81,139 certificates of
occupancy in that dataset, **46,772 are "Renewal Without Change"** and another
6,595 are "Renewal With Change". A renewal is re-issued paperwork for a building
that converted years ago, or never converted at all.

Count them and you invent a wave of conversion activity out of an administrative
process. Only the first certificate after the work counts.

"A filing is not a building" was the warning. It turns out a certificate is not
a conversion either. There is usually one more layer.

### And one ordinary join bug, for completeness

MapPLUTO's floor areas are per **tax lot**, and several buildings can stand on
one lot. Attributing the lot's whole office area to each building gave the
district 112 million square feet of office space; dividing it across the
buildings gives 78 million, against a published figure for Lower Manhattan of
roughly 90 million.

Same bug, same shape, as the one in the bathtub module. It will happen to you
too. Total your joins.

## Setting up the web environment

The sandbox is one Svelte component taking `params`, `assets` and a `mode`, as
all of them are. Two things are specific here.

**The massing is footprint-plus-height, not meshes.** The CityGML gives a ground
surface and a set of roof surfaces per building. Shipping those as geometry
would be tens of megabytes; shipping an outline and a list of heights is half a
megabyte, extrudes in the browser for free, recolours per building for nothing,
and — the reason that matters most — lets the added-floors step be a *number*
rather than a geometry edit. The whole district is about 600KB.

**There is no time-of-day parameter, deliberately.** A sandbox with a looping
day has two clocks: the year, which is a choice someone is making, and the hour,
which is animation state. Only the first belongs in `schema.json`, because
everything in there gets serialised into every submission and validated on the
server. An hour-of-day slider would put a number nobody chose into every
student's manifest forever.

Since the agent layer is not built, this is currently a distinction without a
difference — but the schema is written as though it were, so that adding the
crowd later does not require migrating every submission.

## The parameters

Here is the district at the published defaults, in 2035:

<div data-sandbox="after-five" data-mode="view" data-params='{"year":2035,"conversion_cost_sf":350,"residential_rent":75,"office_rent_trend":-0.01,"incentive_467m":true,"convertibility_threshold":0.5,"colour_by":"use","added_floors":true}'></div>

Blue is still office, red has become housing. About 29% of the office buildings
have converted.

**Start with the office rent trend, because it is the surprise.** Set it to zero
and scrub the year: nothing happens. Not "less happens" — *nothing*. The map is
identical in 2025 and 2050.

That is because a building converts at the first date the residential deal beats
the office income it gives up, and if office rent never moves, whatever was true
in 2025 stays true. **The only thing that makes time pass in this model is the
office market falling.** A sandbox that looks like it is about housing policy is
structurally a sandbox about office rents, and you can only see that by breaking
it.

Then the two gates:

- **The convertibility threshold.** The score behind it is ours — four proxies,
  our weights, two of the published criteria dropped because nothing measures
  them. Push it to 0.9 and almost nothing converts. The number that decides how
  much of downtown is convertible is a number somebody chose, and in the public
  conversation it is a number a consultancy chose and did not show you.
- **467-m.** Turn it off and conversions roughly double. That is not the tax
  break being worth money — the exemption schedule is not published, so it
  cannot be valued here at all. It is the *eligibility rules* excluding
  buildings: the 90%-non-residential test and the six-unit minimum. Switching it
  off measures what the rules keep out, not what the money is worth, and those
  are very different quantities that get discussed as though they were one.

And notice what the conversion cost slider does to the threshold slider. Cost
scales with how badly a building scores, so an awkward building is both hard to
convert *and* expensive to convert. The two gates are correlated because we
built them that way. That is defensible — it is true of real buildings — but it
means the two controls are not independent, and a student comparing them should
know that the correlation was authored.

## The assumptions

**The score is ours and it does double duty.** It gates conversion and it drives
cost. A score usually does one job; this one does two, so an error in it
propagates twice.

**Conversion is instant.** The deal clears and the building is residential in
the same tick. No construction period, no financing, no tenants to move out.

**Rents are uniform and residential rent never moves.** Every office building in
the district lets at the same rate, every apartment rents at the same rate per
square foot, and only one of the two drifts over time. There is no reason for
that asymmetry except that it makes the model legible, which is the kind of
reason worth flagging out loud.

**Six years, and nothing between them.** The scrubber snaps rather than slides
because the model has six opinions about the future and no way to interpolate
between them. A continuous slider would imply a continuity the model does not
have.

**And the file format again.** Added floors are a number of storeys, so they can
only ever be drawn as a block on the roof — no setback, no courtyard, no new
envelope. The model cannot express a building that grew *differently*, only one
that grew *more*, because what got stored was a count.

That is the same lesson as bathtub's spill elevation and the coefficients'
constants: **what a model can believe is decided by what its file format can
hold**, and that decision is usually made early, quietly, by whoever wrote the
pipeline.

## Challenge

Two, at different difficulties.

**Pick a district that isn't downtown Manhattan.** The pipeline takes a
community district as an argument. Midtown South is the obvious comparison and
the model is calibrated for a district like it; somewhere with almost no office
stock will break it in an instructive way. Say what broke.

**Or build the crowd, properly.** Find a citable published account of who is on
a street and when — a travel survey's departure-time distribution, a time-use
survey, an occupancy schedule with a real source — and add the layer this
sandbox does not have. The hard part is not the animation. The hard part is
defending the source, and the deliverable is the defence as much as the picture.

---

Module by Adam Vosburgh, Fall 2026.
