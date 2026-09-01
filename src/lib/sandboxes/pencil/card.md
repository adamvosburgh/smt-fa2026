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

The first thing to notice is that the pattern is backwards from the obvious one.
The large lots in eastern Queens mostly *fail*. They have room for a full 800
square foot unit, which costs more to build than the loan will cover, so the
deal collapses on the borrowing limit. The smaller lots in the northwest fit a
smaller unit, which fits inside the loan, and they pass.

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
- **The floodplains.** NYC Open Data's 2050s and 2080s layers, used as the
  closest available stand-in — see the assumptions below.

**The eligibility flags are ours, not the city's.** NYC Open Data publishes no
City of Yes ADU eligibility layer; the catalogue was searched and there is none.
So the flags here are our reading of the published rules in DCP's ADU guide,
applied to MapPLUTO by us. A reader should not mistake that for a city
determination.

## How the map gets made

For every lot, in order:

1. Size the unit from the rear yard, capped at the 800 square feet the rule
   allows.
2. Cost it: floor area times cost per square foot, plus a flat soft cost.
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
is no set of answers to ship. The browser holds seven numbers per lot and
recomputes all 246,921 of them on every slider move, in about 140 milliseconds.
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
- **The unit size is a guess.** There is no lot geometry in the data — no shape,
  no orientation, no setbacks, no existing yard. The unit is sized as a third of
  the lot area left over after the building's own footprint, capped at 800
  square feet. An L-shaped lot, a corner lot and a flag lot are treated
  identically, and 109,032 lots hit the cap, so for nearly half the borough this
  step is doing no work at all.
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
- **In the extruded view every lot has the same footprint.** deck.gl's column
  layer takes one radius for all columns rather than one per lot, so the
  per-lot sizing that the flat map does is not available there.
- **The unit volumes are drawn about twice life size**, and off by default. An
  800 square foot single-storey unit is roughly 3.5 metres tall, which is
  invisible at borough zoom, so it is drawn at about seven. Nothing in the model
  depends on the height — it is there to be seen, and it is worth seeing only
  when you have zoomed into a few blocks.
- **Property tax is ignored entirely.** MapPLUTO has the existing assessment,
  but the marginal assessment of an added unit is in no dataset we found, and
  deriving one would produce a figure that looks sourced and is not. So every
  margin here is optimistic by whatever the tax would have been.
- **Operating cost is a quarter of rent**, and the soft cost is a flat $30,000.
  Both are conventional rules of thumb, not measured figures. The construction
  cost default is also an assumption — HPD's own cost guidance could not be
  verified to exist — and it is the number to distrust first.
- **Rent is uniform within a ZIP**, and the AMI cap is uniform across eight
  counties.
- **The floodplain is an approximation.** The zoning rule names an "expanded
  flood area" defined in the Zoning Resolution. What is used here is the
  published 2050s and 2080s floodplain layers, which are close but not the same
  thing.
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
