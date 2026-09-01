---
title: "Tutorial 2 — Does It Pencil"
date: "2026-08-31"
author: Adam Vosburgh
sequence: 2
cat: tutorial
published: true
---

<!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->

This module is about the difference between a map of where something is allowed
and a map of where it would pay. We take one real housing programme, find the
nine numbers it actually consists of, and run them as a pro-forma on every
one-to-two-family lot in Queens at once. By the end you'll have it running on
your own machine, and you'll be able to point it at a different borough or a
different subsidy.

There is real data preparation here — more than in any other module — and most
of it is one file with 101 columns, of which you need about a dozen.

<div class="gap">

**What the tutorial version won't have.** The sandbox runs the whole borough:
246,921 lots, recomputed on every slider move. The tutorial version runs one
community district, which is about eight thousand. The arithmetic is identical
and the code is identical — there is just less of it, and it fits in memory
while you are still learning what the columns mean. The model *is* the
arithmetic, so you are not building a reduced version of it.

</div>

## The map that gets published

If you ask a planning department where accessory dwelling units are allowed, you
will get a map. It will be a good map. It will show the districts where the use
is permitted, shaded, with the exclusions cut out of it — the historic
districts, the flood area, the low-density districts outside the transit zone.

That map is a zoning map. It is accurate, it is useful, and it tells you almost
nothing about whether a single unit will be built.

The reason is that legality is a gate, not a reason. A homeowner does not build
a unit because it is permitted; they build it because someone will lend them the
money and the rent will cover the payments. Those are different questions with
different geographies, and only one of the two gets published — because the
zoning map is the one the agency has the authority to draw, and the other one
depends on assumptions the agency would have to defend.

So this module builds the other one. You should expect it to be wrong in
interesting ways, and the sandbox will let you compare it against the boring map
whenever you like.

## Producing the data

**One file, 101 columns, twelve that matter.**

MapPLUTO is the city's tax-lot file: every lot in New York, with about a hundred
attributes each. The shapefile release is around 400MB and the geometry alone is
141MB of it. You never open the geometry. Everything this model needs is in the
`.dbf` beside it, which is a fixed-width table you can read by seeking to byte
offsets — no geopandas, no GDAL, no install that takes an afternoon.

That is worth internalising as a habit. **Before you download a geo stack, ask
what you actually need out of the file.** Here it is: lot area, building
footprint dimensions, zoning district, transit zone, historic district, ZIP,
census tract, units, and a centroid. Twelve columns out of 101, and the reader
is about forty lines.

**Read `BBL` as an integer.** It is stored as a DBF float field, and a float64
BBL silently rounds away the lot digits. This is the kind of bug that produces a
join which looks like it worked.

### Totalling the join

Queens has 324,150 tax lots. Filtering on `BldgClass` starting with A or B gives
246,925 one-to-two-family lots. Filtering instead on `LandUse` equal to 01 gives
247,054.

Those are two independent tests of the same thing and they disagree on 129 lots
— five hundredths of one percent. That agreement is what lets you believe the
filter. Had they differed by ten percent you would need to find out why before
going any further, and the answer would have been interesting.

**Total every join against something published before you believe it.** In the
bathtub module this is how a bug got caught: `UnitsRes` is a count of homes on a
*lot*, several buildings can share a lot, and joining it onto each building gave
11.3 million homes in a city with 3.6 million. The same shape of bug is waiting
here — 114,057 of these lots have more than one building on them.

### Two things about the rent data that are the point, not a detail

The programme caps rent at 100% of Area Median Income. To turn that into a
number you need HUD's income limits. HUD publishes them for the **New York, NY
HUD Metro FMR Area**, which is eight counties: Bronx, Kings, New York, Putnam,
Queens, Richmond, Rockland and Westchester. There is no smaller geography.

So the affordable rent ceiling on a house in Ozone Park is computed partly from
household incomes in Westchester, and it is the same number in every part of
Queens. Market rent is not: HUD's Small Area Fair Market Rents are published by
ZIP code and in Queens they run from about $2,260 to $3,570.

Work out what that means before you read on. **The AMI cap comes out at roughly
$3,181 a month — which is above market rent in most of the borough.** The
affordability requirement, in Queens, is barely a constraint at all. It is a
real constraint in Manhattan, where the same single number meets much higher
market rents. One figure, one geography, two completely different policies
depending on where you stand.

### The step that is a guess

Sizing the unit is the weakest thing in this pipeline, and the way it was wrong
is more instructive than the way it is now right.

The first version read the rule as "a third of the rear yard" and applied the
third to *the whole open area of the lot* — lot area minus the building's
footprint. That is not what the rule says. ZR 23-341(b)(4) applies the third to
the **required rear yard**, which is a much smaller thing, and ZR 23-342 makes
its depth depend on building type and lot width: twenty feet for a detached
house, thirty for a semi-detached one on a lot under forty feet wide, with a
reduction on shallow lots.

The difference is not a rounding detail. The median unit went from 707 square
feet to 333, and the number of lots pinned to the 800 foot statutory cap went
from 109,032 to 384.

**That is the tell you should learn to recognise.** A step that looks precise
and resolves to a constant for half your data is not doing any work. When
109,032 lots all came out at exactly 800, the estimate had stopped estimating
and the cap was answering every question. Watch for a distribution that piles up
on a boundary.

Two things are still estimated, and your card has to say so. MapPLUTO has no lot
geometry, so the required rear yard is taken as a rectangle the full width of
the lot, and an L-shaped lot, a corner lot and a flag lot are treated
identically. And the shallow-lot reduction is supposed to apply only to lots
that existed on 15 December 1961, which no field records, so it is applied to
all of them.

One more thing, and it is the reason two of the sliders exist. The one-third and
the five feet are the numbers the rule turns on, so they are controls rather
than constants — which means the unit's floor area cannot be baked into the data
file. It is recomputed in the browser on every move. **Precompute the inputs to
an answer, never the answer**, and which is which depends on what you made
adjustable.

### An area is not a plan

Here is a mistake worth making once, deliberately.

The pipeline computes how many square feet the rule allows. The map then drew
each unit at the lot's centre point, because that is the one coordinate
MapPLUTO gives you. Zoom in and every proposed backyard cottage is sitting on
the roof of the house it is supposed to stand behind. Nothing was wrong with the
arithmetic. The drawing was making a claim the data had never supported.

Fixing it means answering a question the DBF cannot: **where on the lot?** That
needs the lot's actual outline, which is in the shapefile next to the DBF, and
the house's actual footprint, which is in the city's building layer. Both are
recorded. With those you can measure the open ground behind the house — how deep
it runs and how wide it is — and put a rectangle in it.

But one thing stays inferred, and no amount of geometry fixes it: **which end of
the lot is the back.** Neither dataset says where the street is. The sandbox
assumes the back is the direction away from the house, which is right for an
ordinary lot and wrong for a corner lot. That assumption is named on the card,
and the unit is drawn as a plain rectangle rather than as a building because
that is exactly how much the model knows.

Then the payoff, which is the thing to take away. Once you can measure the back
garden, you find that **only about a third of the lots that pass the area test
have room for a real unit** — a rectangle at the proportions of the published
designs, with the five-foot setbacks taken off. The rest satisfy the zoning
calculation and have nowhere to put the building.

That gap is not a bug and the sandbox does not close it. Those lots still count
as eligible, because the rule the programme applies really is an area test. The
sandbox counts them separately and says so. **When your drawing and your model
disagree, do not quietly change one to match the other — find out which one is
telling you something.**

## Setting up the web environment

Every sandbox here is one Svelte component taking `params`, `assets` and a
`mode`. It reports its numbers upward and says when it has settled; the frame
publishes them. Read `src/lib/sandboxes/bathtub/` first.

The interesting decision in this one is **what to ship**.

You could precompute the answer. Run the pro-forma at build time, store whether
each lot pencils, and let the browser colour it in. That would be a small file
and it would be fast.

It is also impossible here, and working out why is the lesson. Every control in
this sandbox changes the *arithmetic*, not the data. Grant, equity, rate, term,
cost, rent basis, vacancy, cushion — eight continuous dimensions. There is no
finite set of answers to precompute, because there is no finite set of questions.

So the pipeline ships the **inputs**: seven numbers per lot, in a flat
`Float32Array`, plus a byte of eligibility flags. About 7MB. The browser recomputes
all 246,921 lots on every slider move, in roughly 140 milliseconds, in one pass
that produces the colours and the panel figures together.

Compare that with the bathtub module, which reached the *opposite* conclusion for
the same reason. There, connectivity was precomputed into the file, because it
is a property of the terrain that no parameter changes. Here nothing can be,
because every parameter changes the sum.

**The question is always the same one: what does a parameter actually move?** If
it moves the data, precompute. If it moves the arithmetic, ship the inputs. Get
that backwards and you will either ship a gigabyte or build a sandbox where the
sliders lag.

## The parameters

Here is the model at the published terms of the programme:

<div data-sandbox="pencil" data-mode="view" data-params='{"grant_max":175000,"equity_share":0,"interest_rate":0.05,"term_months":180,"cost_per_sf":500,"rent_basis":"ami_cap","rent_flat":2000,"vacancy":0.05,"eligibility":"coy","cushion":200,"permits_per_year":1000,"year":2035,"tint":"margin","volumes":false}'></div>

About 62% of eligible lots clear the cushion. Look at where they are. The
northwest of the borough passes and the east largely does not, which is the
reverse of what a story about backyard space would predict.

The reason is the **loan ceiling**. A big eastern lot fits the full 800 square
foot unit, which at $500 a foot costs $430,000 all in; the grant takes $175,000
off, and the remaining $255,000 is more than the $220,000 the programme will
lend. The deal dies on the borrowing limit before rent is even considered. A
smaller lot fits a smaller unit, which fits inside the loan.

**So the programme's own ceiling is inverting its geography.** Nothing in the
term sheet says "this is for dense neighbourhoods with small yards", and it does
not say the opposite either. It falls out of the arithmetic.

Now take the grant to zero:

<div data-sandbox="pencil" data-mode="view" data-params='{"grant_max":0,"equity_share":0,"interest_rate":0.05,"term_months":180,"cost_per_sf":500,"rent_basis":"ami_cap","rent_flat":2000,"vacancy":0.05,"eligibility":"coy","cushion":200,"permits_per_year":1000,"year":2035,"tint":"margin","volumes":false}'></div>

12%. One number, chosen by an agency, and five sixths of the programme
disappears.

Then work through these yourself, and in this order:

- **The rent basis.** Switch from the AMI cap to market rent. Almost nothing
  happens, for the reason worked out above — and that is the finding. Then ask
  what the same switch would do in a borough where market rent is $6,000.
- **Eligibility.** Set it to "ignore eligibility" and the eligible set grows
  from 165,956 to 244,301 lots. The difference is exactly what the zoning rules
  cost, in lots, and most of it is the low-density districts outside the transit
  zone rather than the flood area.
- **The interest rate and the term.** Both change the margin and neither changes
  how many lots pencil at the default. Work out why before reading the answer:
  it is because the binding constraint at these settings is the loan *ceiling*,
  not the payment, and no rate makes a $255,000 need fit into a $220,000 loan.
- **Permits per year**, with the year scrubber. This one changes *when* rather
  than *whether*, and it is the only control that does.

## The assumptions

**The cushion is not the programme's cushion.** In the term sheet, the $200 is a
test on the household, and it *sizes the loan*: HPD lends whatever amount leaves
that borrower with $200 a month after their existing debts. It is a rule about a
person.

Here it is a per-lot build-or-don't-build test on the unit's own cash flow. That
is a different thing, applied to a different object, producing a different
number — and it was done because there is no household data and there cannot be,
since the model does not know who lives anywhere.

That substitution is the whole subject of this course in one move. It is not
cheating and it is not wrong; it is the only thing available, and the entire
obligation is to say so out loud where anyone reading the map will see it. It is
in the model card, it is in the schema, and it is here.

**A published tool can hide an assumption in plain sight, and you can find it
by moving one slider at a time.** HPD publishes an ADU budgeting tool. It exposes
eleven inputs: design fees at 20% of hard cost, contingency at 8%, site prep at
$20,000, utility hookup at $30,000, and seven more for financing and operations.
Vary them one at a time against a fixed hard cost and the tool's arithmetic comes
out exactly: soft cost is $50,000 plus **48%** of hard cost.

Add up the four cost inputs it shows you. Twenty per cent plus eight per cent is
twenty-eight, and the two flat sums are the $50,000. **There is a
20%-of-hard-cost term the tool never displays** — the same size as the largest
one it does. It is almost certainly general contractor overhead and profit, and
it is not labelled anywhere in the interface.

That is worth more than the number. A public tool that exposes eleven
assumptions and conceals a twelfth as large as any of them is exactly what this
course is about, and finding it took nothing but a browser and the discipline of
changing one thing at a time. **Do that to every calculator you are asked to
trust.** Vary one input, hold the rest, write down what came out. The gap between
what a tool shows and what a tool does is where the argument lives.

**Ranking is standing in for deciding.** The order in which units get built is
return on equity, descending. Nobody in the model chooses anything. Thousands of
separate households, each with their own reasons, are replaced by a sort.

**A tract-uniform rent, and an eight-county rent cap.** Every lot in a ZIP gets
the same market rent, and every lot in the city gets the same AMI ceiling.

**And the largest one, which is structural:** the model asserts that a subsidy
programme's reach is a function of its terms. It is at least as much a function
of who hears about it, who has a contractor they trust, who can survive a
building site in their garden for eight months, and who believes a city agency
will do what it said. None of that is in any dataset, so none of it is in the
map, and the map looks complete anyway. That is the danger.

## Challenge

Point it at another borough — Staten Island is the obvious comparison, and
Brooklyn is the hard one — and argue about what moves and why.

Or keep Queens and change the instrument rather than its settings. Make the loan
forgivable. Replace the grant with a tax abatement over ten years. Remove the
loan ceiling and cap the grant instead. Each of those is a real proposal someone
has made, each is a small change to the pro-forma, and each produces a
recognisably different city. Show which neighbourhoods change hands between two
of them, and say who won.

---

Module by Adam Vosburgh, Fall 2026.
