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
at night.

What ships instead is the panel over the map: the two populations, both counted.
198,677 office-using jobs in Lower Manhattan, from the Census Bureau's LODES
workplace file, joined to the district on the census block each lot sits in.
85,841 residents, from the 2020 census. And what the conversions do to each —
which, at a 25% concession discount, is about 5,450 office jobs out and 4,600
residents in. Roughly one for one.

**Between those two counts there is no curve, and that is where the crowd went.**
To animate people leaving at nine you need a published account of when people
leave. The National Household Travel Survey is national and six bands wide; the
finest thing it says about the evening is that 28% of trips begin somewhere
between six and midnight. ACS table B08302 has half-hour bands at tract level,
which is exactly the resolution you want — but its universe is departures *to*
work, so it describes the morning. Nothing published says when a Manhattan
office empties.

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
use, and that someone could check. Two came close and it is worth knowing
exactly how each one falls short, because "no data" is almost never the real
situation; "data at the wrong resolution, or about the wrong thing" almost
always is.

- **NHTS table 8-1** gives trip start times by purpose. It is *national*, and
  its bands are six hours wide. Its entire statement about the evening is that
  28% of trips begin between 6pm and midnight. You cannot get an hour out of
  that, and you certainly cannot get Manhattan out of it.
- **ACS table B08302** is the right shape — half-hour bands, tract level, and
  the tracts are the ones this sandbox already uses. But read the universe line:
  it is *time leaving home to go to work*. It is a morning table. There is no
  evening counterpart, because the census never asks the question.

Without one, playback loses the only advantage it had over simulation: the
checkability. It becomes an animation of a number somebody made up. And the
schedule is not even the whole of it — **which building a trip starts at is an
assumption doing as much work as the schedule is**, and the animation would put
both on screen at sixty frames a second, looking far more specific than either.

At that point the choice is to ship it labelled as illustrative, or not to ship
it. This sandbox does not ship it. You may disagree, and if you do, the argument
you have to win is why a picture of people moving is worth having when nobody
can check it.

What *can* be checked is the count on either side, so that is what ships. When
you hit this in your own work, the move is the same: find the largest true claim
inside the one you wanted to make, and make that one instead.

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

### And one that went right, which is worth reading too

Three failures in a row makes it sound as though nothing joins. The last one in
this pipeline is the counterexample, and it is worth looking at because of *why*
it worked.

The presence panel needs two numbers this pipeline did not have: how many people
work in the district, and how many live there. Jobs come from LODES, the Census
Bureau's workplace file, which is keyed by the census block a job is *in*.
Population comes from the 2020 census, keyed by tract. Neither one knows what a
community district is.

The temptation is to draw the district boundary and ask which blocks fall inside
it. Don't. **MapPLUTO already carries the answer**: every lot has `BCTCB2020`,
its 2020 census block, and `BCT2020`, its tract. So the district's lots name
their own blocks and tracts, and the join is ID to ID — the same discipline as
the rest of this pipeline, and no geometry at all.

Then total it against something published, the way you always should. Manhattan's
tracts come to **1,694,251 people, which is the published 2020 count for New
York County exactly.** That is when the join became believable, and not before.

It caught a mistake on the way, too. The first version estimated residents as
MapPLUTO's `UnitsRes` times the borough's average household size, which makes
Lower Manhattan about 98,000 people. The census counted 85,841. The multiplier
is wrong in a knowable direction — downtown households are smaller than the
borough's and not every unit is occupied — and the point is that **nothing on
screen would have looked wrong at 98,000.** A count beat a multiplier, and the
only reason anyone found out was that both were computed and compared.

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

Here is the district at the defaults, in 2035:

<div data-sandbox="after-five" data-mode="view" data-params='{"district":"mn01","year":2035,"conversion_cost_sf":350,"residential_rent":75,"office_rent_trend":-0.01,"office_rent_discount":0,"cap_rate":0.055,"opex_share":0.35,"w_depth":0.35,"w_f2f":0.25,"w_area":0.2,"w_age":0.2,"incentive_467m":true,"convertibility_threshold":0.5,"colour_by":"use","added_floors":true}'></div>

Blue is still office, red has become housing, and **there is no red.** Nothing
converts, in any year up to 2045, and three buildings in 2050.

Do not skip past that. An earlier version of this sandbox converted 29% of the
district at its defaults, and the difference between the two is one number
getting a source.

The office rent — what an owner gives up by converting — was in the model twice.
The code said 38 dollars a square foot and called it *effective* rent, in a
comment. The manifest said 62 and called it *asking*. Neither came from
anywhere. So the front end was applying a 39% haircut to an unpublished figure,
in a comment, and the resulting map looked completely normal. **A constant that
lives in two places has two values, and the version the model actually uses is
whichever one the code reached for.**

Both are now one number in one place: $54 a square foot a year, asking rent for
Manhattan class B and C offices, CoStar as of 30 April 2024, published in the
Comptroller's *Spotlight* on the office market on 14 May 2024. And at $54, the
deal never clears.

Here is the same district with one control moved — the discount between what a
landlord asks and what a landlord collects, set to 25%:

<div data-sandbox="after-five" data-mode="view" data-params='{"district":"mn01","year":2035,"conversion_cost_sf":350,"residential_rent":75,"office_rent_trend":-0.01,"office_rent_discount":0.25,"cap_rate":0.055,"opex_share":0.35,"w_depth":0.35,"w_f2f":0.25,"w_area":0.2,"w_age":0.2,"incentive_467m":true,"convertibility_threshold":0.5,"colour_by":"use","added_floors":true}'></div>

Sixty-seven buildings. Nothing about the buildings changed.

That control exists, and defaults to subtracting nothing, because **asking rent
is not effective rent** — free months and fit-out money sit between them, and in
this market the gap is large — and because no published effective-rent series
for this stock was found. The sandbox will not choose the number for you. It is
the single most consequential value in the model and it is not in any table.

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

- **The convertibility threshold, and the four weights under it.** The score is
  ours — four proxies, our weights, three of the published criteria dropped
  because nothing measures them. The weights used to be baked into the data
  file, which meant you could argue with the threshold but not with the
  judgement it was testing. They are controls now. Put all the weight on
  floorplate depth and watch which buildings change colour.

  The legend carries the one check available. Gensler published that about a
  quarter of the 1,300-plus buildings they scored came out suitable, and did not
  publish the scoring. So the legend marks where *our* threshold would have to
  sit to call a quarter of this district convertible — 0.77 at the default
  weights — and that mark moves when you move a weight. It is not a validation.
  It is the only place two judgements about the same buildings can be put beside
  each other, and it is worth sitting with how little that is.
- **467-m.** With the discount at 25% so there is something to count, turn it
  off and conversions go from 67 buildings to 156 — better than double. That is not the tax
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

**Three of the criteria are missing, and one of them was hiding.** Window
operability and elevator count were dropped openly — nothing available measures
them. The third was found later: year built was standing in for facade type
*and* structural bay, which is one proxy asked to do two jobs. A 1920s building
may have been re-clad; a 1960s one may have a thirty-foot bay. Age at least
correlates with facade, so it keeps that job and the bay is now named as
missing. Look for this in your own work. A proxy quietly covering for a second
thing is much harder to spot than a criterion you left out on purpose, because
the table still has four rows in it.

**Floor area per apartment is measured now, and the measurement has a choice in
it.** It used to be 900 square feet, from nowhere. It is 1,152, from 149 DOB
filings where a Manhattan building with no apartments became a residential one.
But the filing records the floor area of the *whole building*, not of the part
converted — so a job adding two apartments to a twenty-storey tower reports the
whole tower against two units. Requiring ten units or more is what keeps that
out, and that cut moves the answer by 40%: 1,366 with no cut, 907 at fifty units
and up. The ladder is published in the manifest rather than just the rung we
picked. The old 900 sits at the far end of it, which is a coincidence and not a
vindication.

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
