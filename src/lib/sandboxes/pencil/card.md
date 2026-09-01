<!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->

## What this is

Everyone has seen a map of where something is allowed. This is a map of where it
would pay.

One real programme — HPD and HCR's Plus One ADU, which lends and grants money to
homeowners to build a small second unit on their lot — and the same arithmetic a
homeowner's contractor would do, run on all 246,921 one-to-two-family lots in
Queens at once. Every lot is coloured by the monthly cash flow the unit would
produce after the loan is paid.

The numbers driving it are not invented. They are nine figures off a government
term sheet: a $220,000 loan ceiling, a $175,000 grant, 5% interest, fifteen
years, a rent cap, and a $200 monthly cushion the deal has to clear. Move any of
them and the map of who gets a unit moves with it.

The first thing to notice is how few lots are left. Of 246,921 one-to-two-family
lots in Queens, 22,333 can take a backyard unit at all — about one in eleven.
The Zoning Resolution does most of that filtering before any money is
considered: the unit may cover only a third of the *required rear yard*, which
on the median Queens lot is 229 square feet, and below about 300 square feet
nothing habitable can be built.

The second thing is that the 800 square foot cap everyone quotes is almost never
the rule that binds. It is reached on about 1% of the lots that fit a unit at
all. The one-third rule and the five-foot setbacks decide this map.

## Why we're looking at this one

A housing programme is a handful of constants in a term sheet.

They are chosen by people, they are published, and almost nobody affected by
them has read them. When they move, the map of who gets a unit moves — and it
moves toward or away from particular neighbourhoods. That is a distributional
outcome produced by a spreadsheet, and the spreadsheet is short enough to fit on
one screen.

There is a second reason. The obvious map to make here is an eligibility map:
where is an ADU legal. That map is a zoning map, it is the one that gets
published, and it tells you almost nothing about whether anything will be built.
You can draw it here — set the eligibility control to compare — and the
difference between the two is the thing worth arguing about.

## The data

- **The lots.** MapPLUTO 26v2, filtered to Queens and to `BldgClass` A\* or B\*.
  That is 246,925 lots, and `LandUse` 01 independently gives 247,054 — two
  separate tests of the same thing, disagreeing on 129 lots out of a quarter of
  a million. Taken per lot: lot area, building footprint, zoning district,
  transit zone, historic district, ZIP code and census tract.
- **The programme.** HPD's Plus One ADU term sheet, quoted directly: maximum
  loan "$220,000 per borrower", maximum grant "$175,000 per grantee", interest
  "5%. Rate may be reduced.", amortisation "180 months (15 years.)", rent "at or
  below 100% of the Area Median Income", and the test — payments set "so that
  the household has at least $200 monthly cash flow available".
- **Market rent.** HUD Small Area Fair Market Rents for FY2026, one-bedroom, by
  ZIP code. Small Area rather than the county figure on purpose: the county FMR
  is a single number for the entire New York–Newark–Jersey City metro and would
  tint every lot in Queens identically.
- **The AMI rent cap.** HUD FY2026 Income Limits. **These are not Queens.** HUD
  publishes income limits only for the New York, NY HUD Metro FMR Area, which is
  eight counties: Bronx, Kings, New York, Putnam, Queens, Richmond, Rockland and
  Westchester. So the rent ceiling on a house in Ozone Park is set partly by
  household incomes in Scarsdale, and it is *identical everywhere in the
  borough*. Market rent varies by ZIP. That asymmetry is the point of the rent
  control.
- **Tract income.** Census ACS 5-year 2023, median household income, joined to
  every lot through MapPLUTO's own tract field. All 246,921 lots matched.
- **The construction cost.** HPD's Pre-Approved Plan Library: eleven ADU
  designs, each with published dimensions and a published cost range. The
  default here is the median of their eleven midpoints, $603 a square foot.
- **The soft cost, and the operating figures.** HPD's own ADU budgeting tool,
  with its behaviour recovered by moving one slider at a time — see below.
- **The flood rule.** Three separate restrictions in ZR 12-10 and ZR 64-11, and
  a DEP map we could not obtain — see the assumptions below.

**The eligibility flags are ours, not the city's.** NYC Open Data publishes no
City of Yes ADU eligibility layer; the catalogue was searched and there is none.
So the flags here are our reading of the published rules in DCP's ADU guide,
applied to MapPLUTO by us. A reader should not mistake that for a city
determination.

## How the map gets made

For every lot, in order:

1. Size the unit from the *required rear yard* — the lot's width times the
   depth ZR 23-342 requires for that building type, a third of that by
   ZR 23-341(b)(4), capped at the 800 square feet ZR 12-10 allows, and zeroed
   below 300 square feet.
2. Cost it: floor area times cost per square foot for the hard cost, then
   $50,000 plus 48% of the hard cost for the soft cost, which is HPD's own
   formula.
3. Take the grant off, then the homeowner's own equity.
4. What is left is borrowed — **unless it exceeds the $220,000 loan ceiling, in
   which case the deal fails there**, and the panel reports that separately from
   failing on cash flow, because they are different failures.
5. Turn the loan into a monthly payment.
6. Take the rent, less vacancy, less operating cost, less the payment. What
   remains is the margin.
7. It pencils if the margin clears the cushion.

Then time. The passing lots are ranked by return on the owner's own money, and
the top few thousand are released each year from 2027. **That ranking is
standing in for a decision that thousands of separate people would actually
make**, and the claim it encodes is explicit: that the binding constraint is
permitting throughput rather than demand.

**Nothing is precomputed except the inputs.** Every control changes the
arithmetic rather than the data, and the parameter space is continuous, so there
is no set of answers to ship. The browser holds nine numbers per lot and
recomputes all 246,921 of them on every slider move, in about 140 milliseconds.
The unit's own floor area is one of the things recomputed, not one of the things
shipped — two of the controls are the numbers in the zoning rule that sizes it,
so the size has to move when they do.
The colours and the figures in the panel come out of that same pass, so they
cannot disagree.

The concentration figure has a definition: tracts are ranked by how many units
they receive, and it is the share of all units landing in the top **tenth** of
those tracts.

## What it assumes

- **The $200 test has been changed.** In the programme, the cushion is a test on
  the *household* and it sizes the loan: HPD lends whatever leaves the borrower
  with $200 a month. Here it is recast as a per-lot *build or don't build* test
  on the unit's own cash flow, because the sandbox has no household data and
  cannot have any. This is the most important sentence on this page.
- **The unit size is now the rule, but the yard is still a rectangle.** An
  earlier version of this sandbox applied the one-third fraction to the whole
  open area of the lot. The rule applies it to the *required rear yard*, which
  is much smaller and depends on building type and lot width. That correction
  moved the median unit from 707 square feet to 333, and took the number of lots
  pinned to the 800 foot cap from 109,032 to 384. What is still estimated:
  MapPLUTO has no lot geometry, so the rear yard is taken as a rectangle the
  full width of the lot, and an L-shaped lot, a corner lot and a flag lot are
  treated identically.
- **Building type is DOF's, not ours.** Whether a house is detached,
  semi-attached or attached decides whether it may have a backyard unit at all —
  attached houses may not. That comes from MapPLUTO's `ProxCode`, which the
  assessor recorded, on 99.9% of these lots. We also compute it a second way,
  from the gap between lot width and building width, and the two agree on only
  77% of lots. We ship the recorded one and report the disagreement.
- **The shallow-lot reduction is applied to every shallow lot.** ZR 23-342
  reduces the required rear yard on interior lots under 95 feet deep that
  existed on 15 December 1961. MapPLUTO cannot say whether a lot line existed on
  that date, so all 34,455 shallow lots get the reduction. The model is slightly
  generous there.
- **Lots are drawn as marks, not as lots.** Each lot is one mark at its
  centroid — never its real shape, because 246,921 lot polygons is not a 7MB
  download. Two things follow from the size of the borough on screen. At the
  zoom the sandbox opens at, a lot is about a fifth of a pixel, so the flat map
  draws every lot at a minimum of just over one pixel; without that floor a
  quarter of a million sub-pixel marks render as diagonal moiré that looks like
  a finding and is an artefact of the rasteriser. And the mark's size is scaled
  to the *spacing* between lots rather than to their area, and clamped — 0.6% of
  these lots are over 10,000 square feet and the largest is a genuine
  single-family house on a 1,106,431-square-foot city-owned parcel off Church
  Road, which at true area is a 208-metre square and painted over whole
  neighbourhoods. The lot areas themselves are untouched; it is only the drawing
  that is bounded.
- **Where the unit stands is inferred, and the inference is the weak part.**
  The volumes used to be drawn at the lot centroid, which is where the house is,
  so every proposed cottage sat on an existing roof. They are now placed in the
  open ground behind the house: the lot outline comes from MapPLUTO's shapefile
  and the house from the city's building footprints, both recorded, and the
  sandbox measures how deep and how wide the back garden is. **What is inferred
  is which end of the lot is the back.** Nothing in either dataset says where
  the street is, so the back is taken to be the direction away from the existing
  house. That is right for an ordinary house set toward the street, and wrong
  for a corner lot, a through lot, and a house built at the back of its own
  parcel. The unit is drawn as a plain rectangle rather than as a building
  because the position is that good and no better.
- **The unit is drawn at the plan library's proportions**, not as a square.
  Every published design is a rectangle, and the ratio of short side to long
  runs from 0.48 to 0.80 with a median of 0.70; the drawn unit takes that median
  and stands with its long side along the rear fence, which is how a backyard
  cottage actually goes in. It matters more than it sounds: depth is the scarce
  dimension in a rear yard, and a square of the same floor area needs more of
  it.
- **The height is the rule's, and it is the only height here.** ZR 23-341(b)(4)
  limits the unit to "one story, not to exceed 15 feet", and that is what the
  volumes are drawn at. Nothing in the model computes a height.
- **An area is not a plan, and the gap is large.** The programme's rule tests
  the *area* of the required rear yard. Only about a third of the lots that pass
  that test have room behind the house for a rectangle the shape of a real
  published design, once the five-foot setbacks are taken off. Those lots still
  count as eligible and still pencil, because the published rule is the
  published rule — but no volume is drawn for them, and the panel counts them.
  A lot can satisfy a zoning calculation and have nowhere to put the building.
- **Property tax is ignored entirely.** MapPLUTO has the existing assessment,
  but the marginal assessment of an added unit is in no dataset we found, and
  deriving one would produce a figure that looks sourced and is not. So every
  margin here is optimistic by whatever the tax would have been.
- **The soft cost, the operating cost and the construction cost all have
  sources now, and one of the sources has a hole in it.** HPD publishes an ADU
  budgeting tool. Driving its sliders one at a time recovers its arithmetic
  exactly: soft cost is $50,000 plus 48% of the hard cost. But the four cost
  inputs the tool *shows* you account for 20% plus 8% of hard cost, plus
  $50,000. **There is a 20%-of-hard-cost term the tool never displays**, equal
  in size to the largest one it does. It is probably contractor overhead and
  profit. It is not labelled anywhere in the interface, and it was found by
  moving one slider at a time. This sandbox uses the measured total, because
  that is what the tool actually does.
- **Construction cost is a median of a six-fold spread.** HPD's plan library
  publishes eleven designs, all reviewed by the same agency for the same
  purpose. Their cost midpoints run from $248 to $1,500 a square foot. Cost per
  square foot is not a property of ADUs. $603 is the median of eleven; it is not
  a typical figure, because there is no typical figure.
- **Rent is uniform within a ZIP**, and the AMI cap is uniform across eight
  counties.
- **The flood rule was being read wrongly, and the right layer does not exist
  as a download.** Earlier versions of this sandbox said the Zoning Resolution
  names an "expanded flood area". **It does not — the phrase is not in the
  Zoning Resolution at all.** What ZR 12-10 actually carries is three separate
  restrictions. In the *high-risk flood zone* — FEMA's 1%-annual-chance area — a
  unit may be built, but not below the flood-resistant construction elevation:
  that is a cost, not a ban, and this model flags it and does not exclude on it.
  In DEP's *10-year rainfall flood risk area* and *coastal flood risk area*, a
  backyard unit is banned outright. Those two areas are designated on DEP's
  Interim Flood Risk Area Map, and **we could not obtain that map** — the rule
  adopting it was proposed in June 2025 and its adoption was not confirmed. So
  those two flags are approximated from the NPCC 2050s and 2080s layers, which
  are the *ingredients* DEP builds its map from and not the map itself. That is
  a defensible approximation and a bad citation, and this is it being labelled.
  Note also what ZR 64-11 does with "flood maps": it defines them as "the most
  recent map or map data used as the basis for flood-resistant construction
  standards". The Resolution never names a dataset. The rule is written to
  move.
- **Everybody builds the moment the deal clears**, and the only queue is
  permits.

## What it can't see

Whether a homeowner can raise the equity, wants a tenant, or trusts the city.

Lots that pass are not lots that build. There is no contractor in this model, no
financing rejection, no family, no inheritance, no one who is renting out the
basement already, and nobody who simply does not want a stranger in the garden.

It also cannot see who lives in the house. The programme requires the owner to
reside there at least 270 days a year, and there is no dataset of who lives
where — so that requirement is *absent* from the model rather than modelled
badly. There was briefly a switch for it, which turned out to change nothing at
all, and a control that changes nothing is worse than a missing one because it
implies the model knows something it does not.
