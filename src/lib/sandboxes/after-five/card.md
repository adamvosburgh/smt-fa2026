<!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->

## What this is

A piece of downtown Manhattan in three dimensions, with a clock on it.

Every building in Community District 1 — the Financial District, Battery Park
City, Tribeca, and Governors Island — as the city's own 2014 survey recorded it,
carrying its real building identification number. Office buildings turn red as
they convert to housing, and the year scrubber moves them through six dates.

Two gates decide whether any given building converts. The first asks whether it
is the right *shape* — deep floors and low ceilings are hard to make into
apartments. The second asks whether the *deal* works: whether the housing is
worth more than the office income the owner gives up, after paying to convert.

**One of those gates is a number we invented, and the other is a state tax law
whose terms are only half published.** Between them they decide the whole map.

## Why we're looking at this one

Office-to-residential conversion is argued in units and dollars: how many
apartments, at what cost, with what subsidy. That argument is conducted almost
entirely in aggregate, and the aggregate hides two things this sandbox puts on
screen.

The first is that the "convertibility" everyone cites is a proprietary
judgement. Consultancies publish the *criteria* — floorplate depth, floor-to-
floor height, structural bay, facade type — and do not publish the scoring. So
every public conversation about how many buildings are convertible is repeating
a number nobody outside the firm can reproduce. The score in this sandbox is
ours, built from proxies for their criteria, with two of the criteria dropped
because nothing available measures them. It is not better than theirs. It is
just visible.

The second is that **the only thing making time pass in this model is the office
rent trend**. Set it to zero and the map stops changing entirely. A story that
sounds like it is about housing policy turns out to be a story about the office
market, and the sandbox makes you watch that happen.

## The data

- **The buildings.** DCP's 3-D Building Model as CityGML (NYC Open Data
  `tnru-abg2`), delivery areas 12 and 19. 1,159 buildings in the district, each
  with its BIN, its ground outline and every roof surface at its own height —
  which is why the towers here have podiums and setbacks rather than being flat
  extrusions.
- **The lots.** MapPLUTO 26v2, joined on BBL: floor areas, office area, number
  of floors, year built, building depth. Where several buildings stand on one
  tax lot, the lot's floor areas are divided across them — without that, the
  district's office stock came out at 112 million square feet instead of 78.
- **The conversions that actually happened.** Two sources, because one is not
  enough. DOB job filings back to 2000, and DOB certificates of occupancy for
  the recent period.
- **The criteria.** Gensler's published convertibility criteria, as criteria.
- **467-m.** The state tax exemption, as published by HPD.

### A note on how the buildings got their names

The same survey is also published as Rhino `.3dm` files, one per community
district, and this sandbox was built on those first. **They carry no identifiers
at all** — no BIN, no BBL, not a single attribute on any of 132,223 objects — so
every building's identity had to be inferred by matching it to the nearest
building-footprint record.

That looked excellent: 99.5% matched, median distance two feet. Then it was
checked against the CityGML, which carries real BINs, and **it was wrong for one
building in five.**

The reason is worth keeping. In a district of party-wall buildings, "nearest
centroid" is not "same building" — the nearest one is frequently next door. The
two-foot median measured how close the nearest centroid was, not whether it was
the right one. A confident statistic about the wrong quantity.

Nothing in this sandbox is now joined by position.

## How the map gets made

**Gate one, convertibility.** Four proxies, each scored 0 to 1, weighted and
summed:

| Criterion | What stands in for it | What that misses |
| --- | --- | --- |
| Floorplate depth | Building depth, halved | Assumes a centred core and a rectangular plate |
| Floor-to-floor | Modelled height ÷ floors | Averages over lobbies and mechanical floors |
| Floorplate area | Floor area ÷ floors | Fine |
| Age | Year built | Standing in for facade type *and* structural bay, which it does not measure |

Two of the published criteria — window operability and elevator count — are
**dropped outright**, because nothing available measures them and inventing a
number from floor area would be exactly the failure this course is about.

The weights are ours: 0.35, 0.25, 0.20, 0.20. They are in the manifest so they
can be argued with.

**Gate two, the deal.** The residential rent is turned into a value with a fixed
capitalisation rate; so is the office rent the owner gives up. If the
residential value minus the cost of converting beats the office value, the deal
clears.

Conversion cost per square foot is **not the same for every building** — it
scales with how badly the building scores, so an awkward one costs up to twice
the slider figure. That is the honest relationship, and it has a consequence
worth naming: it makes the two gates correlated by construction. A building that
fails on shape usually also fails on money, because we made its shape drive its
cost.

**Then the clock.** The deal is tested at each of six dates, and a building
converts at the first one where it clears. Office rent drifts by the trend
control between those dates; residential rent does not move at all.

## What it assumes

- **Conversion is instant** at the moment the deal clears. No construction
  period, no financing, no tenants to relocate, no phasing.
- **Rents are uniform across the district.** A basement studio on Water Street
  and a corner unit forty floors up earn the same per square foot, and every
  office building lets at the same rate.
- **Residential rent never moves** while office rent drifts. There is no reason
  for that except that it makes the model legible.
- **The convertibility score is ours**, built on proxies, missing two of the
  criteria it claims to represent — and it drives the conversion cost, so it is
  doing more work than a score usually does.
- **467-m is a gate, not money.** Its eligibility tests are published and are
  applied here. Its benefit schedule — the exemption percentage and duration —
  is not in the published FAQ, so the incentive cannot be valued and is modelled
  as permission instead. The test that at least half the existing building must
  be preserved is not checkable from any dataset here and is treated as
  satisfied.
- **Added floors have no form.** Where a filing recorded storeys being added,
  the roof is pushed up by that many. A building that grew four floors grows a
  four-floor block, with no setback and no new envelope. It is the quantity of
  the change, not its shape.
- **Added floors are also only half-recorded.** The older filing system carries
  heights and storeys; the certificate-of-occupancy record does not carry them
  at all. So buildings that converted after about 2021 convert *without
  growing*, which is a limit of the paperwork rather than of the buildings.
- **Units come from floor area**, at 900 square feet apiece, and residents come
  from units at the borough's average household size — which is a figure for
  the whole of Manhattan applied to new conversion units that skew smaller.

## What it can't see

**Anyone on the street.** This sandbox is named for nine in the evening and
there is no crowd in it.

That is a deliberate absence rather than an oversight. Drawing a moving crowd
needs a published account of who is where and when — an occupancy schedule, a
travel survey, something citable — and none was settled. What is reported
instead is a *count* of the residents who would live there, computed from unit
counts and a published household size. Nobody moves, because animating a
schedule nobody published would be the exact failure this course exists to name:
a picture that looks like evidence and is a guess with a frame rate.

Beyond that: it cannot see who moves in, or who is displaced, or whether the
ground floor becomes a shop or a lobby. It has nothing to say about the office
workers being replaced, or about whether a neighbourhood of converted towers is
a neighbourhood. And a filing is not a building — some of the conversions in the
historical record were applications that never happened.

## Where the record stops

The build for this sandbox assumed two DOB datasets covering two eras. The
modern one it named, "DOB NOW: Build – Job Application Filings", turns out to
contain **only Brooklyn** — 86,130 rows, every filing number prefixed B, no
Manhattan at all.

So the historical record here comes from the legacy filing system, which for
Manhattan thins out sharply after 2020 as work moved to the new system, plus
certificates of occupancy for the recent years. Certificates are arguably the
better evidence — a certificate is a completion where a filing is only an
application — but they carry no heights, and 53,000 of the 81,000 in the dataset
are *renewals*, re-issued paperwork for buildings that converted years ago or
never converted at all. Counting those would have invented a wave of activity
out of an administrative process.

**The back-test was cut.** The plan was to seed 1995 in the Financial District
and run forward against what the 421-g tax break actually produced. The legacy
dataset's earliest filing is 1 January 2000. It does not reach, and a validation
that silently starts three years late is worse than none. So this model is not
validated against history — which is true of most models anyone will meet, and
is usually not said.
