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

At the settings this opens with, **nothing converts.** That is not a bug and it
is the most useful thing here — see *What happened when the office rent got a
source*, below.

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
ours, built from proxies for their criteria, with three of the criteria dropped
because nothing available measures them, and with the weights left where you can
move them. It is not better than theirs. It is just visible.

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
- **The office rent.** $54 a square foot a year, asking, Manhattan class B and C
  combined, CoStar data as of 30 April 2024, published in the New York City
  Comptroller's *Spotlight* on the office market on 14 May 2024. B and C is the
  stock anybody would convert — the 5-star figure in the same report is roughly
  twice this and describes buildings nobody converts. **The two classes are
  combined in the source and this model does not pretend to separate them.** The
  citation is pinned to that edition on purpose: the figure is 28 months old
  when the course starts, and the November 2025 successor report drops
  rent-by-class entirely, so it cannot be refreshed from this source at all.
- **Who works here.** LEHD LODES 8, Workplace Area Characteristics, New York
  State, 2023 — primary jobs by workplace census block. Joined to the district
  on MapPLUTO's `BCTCB2020`, the lot's 2020 census block, so it is an ID join
  like everything else here and nothing is matched by position. 198,677
  office-using jobs in Lower Manhattan, 667,498 in Midtown South.
- **Who lives here.** The 2020 decennial census, total population by tract,
  summed over the tracts the district's lots stand in: 85,841 people in Lower
  Manhattan, 92,438 in Midtown South. Manhattan's tracts total 1,694,251, which
  is the published county figure exactly — that is the check that made the join
  believable, and it is the same check sandbox 07 applies.
- **Floor area per apartment**, measured rather than assumed. 1,152 square feet,
  from 149 DOB filings between 2001 and 2025 where a Manhattan building with no
  apartments in it became a residential building with ten or more — 15.6 million
  square feet over 13,506 units.

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
| Age | Year built | Standing in for facade type. It does not measure that either, only correlate with it |

**Three** of the published criteria are **dropped outright**: window
operability, elevator count, and structural bay. Nothing available measures any
of them, and inventing a number from floor area would be exactly the failure
this course is about. Structural bay is the newest of the three, and it was
found rather than decided: year built was standing in for facade type *and*
structural bay, which is one proxy asked to do two jobs it cannot do. A 1920s
building may have been re-clad and a 1960s one may have a thirty-foot bay. Age
correlates with facade, so age keeps that job and the bay is now named as
missing. **Three named absences, four sourced criteria.**

The weights are ours — 0.35, 0.25, 0.20, 0.20 — and **they are controls.** They
used to be baked into the binary file as a single number per building, which
meant the reader could move the threshold but never the judgement behind it. The
four sub-scores now ship as four columns and the browser does the sum, which is
the only reason each building carries eighteen numbers instead of fifteen.

**The one place our score can be checked.** Gensler published that about a
quarter of the 1,300-plus buildings they scored came out suitable. Their
algorithm is closed and their weights are proprietary, so that share is the only
thing anybody outside the firm can hold their own score up against. The legend
marks where the threshold would have to sit for our score to call a quarter of
the district convertible — 0.77 in Lower Manhattan, 0.72 in Midtown South, at
the default weights — and that mark moves when you move a weight. It is a
comparison, not a validation.

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

## What happened when the office rent got a source

This is the most useful thing in the sandbox and it was an accident.

The office rent was the number the whole second gate turns on, and it was in the
model twice with two different values. The code said 38 dollars a square foot
and called it *effective* rent, in a comment. The manifest said 62 and called it
*asking*. Neither was sourced. Between them, in a comment nobody would ever
read, the front end was applying a **39% haircut** to a figure that had not been
published in the first place. The map it drew converted 29% of the district and
looked entirely normal.

Replacing both with the Comptroller's published $54 does this: **nothing
converts.** Not less — nothing, in every year up to 2045, and three buildings in
2050. The default map is solid blue.

You can get conversions back, and the list of ways is the honest content of this
model. Any one of these will do it, in Lower Manhattan at the 2035 default:

| Change | Buildings converting |
| --- | --- |
| nothing — the published figures | 0 of 381 |
| decide landlords collect 25% less than they ask | 67 |
| decide landlords collect 40% less than they ask | 142 |
| conversion cost $200/sf instead of $350 | 142 |
| residential rent $110/sf instead of $75 | 142 |
| office rents fall 3% a year instead of 1% | 18 |

Every row of that table is a number nobody published. Of the three figures in
the deal — office rent, residential rent, conversion cost — exactly one now has
a source, and the model's answer at that one source is *don't*. **The conversion
argument is a debate about the ratio between two rents and one construction
cost, and two of those three are chosen by whoever is making the argument.**

So the empty map is the finding. A model that says nothing happens is not
broken, and it is a great deal more honest than the same model tuned until the
picture moved.

## What it assumes

- **Conversion is instant** at the moment the deal clears. No construction
  period, no financing, no tenants to relocate, no phasing.
- **Rents are uniform across the district.** A basement studio on Water Street
  and a corner unit forty floors up earn the same per square foot, and every
  office building lets at the same rate.
- **Residential rent never moves** while office rent drifts. There is no reason
  for that except that it makes the model legible.
- **The convertibility score is ours**, built on proxies, missing three of the
  criteria it claims to represent — and it drives the conversion cost, so it is
  doing more work than a score usually does. Its weights are yours to move,
  which does not make them right, only visible.
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
- **Units come from floor area**, at 1,152 square feet apiece, and residents
  come from units at the borough's average household size — which is a figure
  for the whole of Manhattan applied to new conversion units that skew smaller.
  The 1,152 is measured, and one of its filters is doing a lot of work. The
  filing records the floor area of the *whole building*, not of the part being
  converted, so a job that adds two apartments to a twenty-storey tower reports
  the whole tower against two units. Counting only conversions of ten units or
  more is what keeps that out, and moving that cut moves the answer by 40%:
  1,366 square feet per unit with no cut at all, 907 if only conversions of
  fifty units and up count. That cut is a control now - six measured stops off
  the ladder, defaulting to ten - so the judgement is the reader's to move
  rather than ours to bury. The ladder is in the manifest. The old figure was
  900, which came from nowhere and happens to sit at the far end of it.
- **The office rent is a control of four named stops, and one of them has a
  source.** $54 is the published asking rent — Manhattan Class B and C
  combined, from the Comptroller's May 2024 spotlight — and it is the default,
  at which nothing converts. The other three stops are ours: $41 for what a
  landlord collects after free months and fit-out money (a flat 25% discount,
  since no effective-rent series is published for this stock), $32 for a
  building in trouble, $70 for a repositioned one. Each stop carries its
  justification on the control, and the legend names which one is selected and
  whose number it is.
- **A displaced office job is a job in a district, not a person on a street.**
  The jobs removed are the office-using jobs recorded on that floor area — about
  one per 490 square feet in Lower Manhattan, per 324 in Midtown South, both
  well above the 150 to 250 quoted for a fitted-out floor because the floor area
  is gross and some of it is empty. Whether those jobs vanish, move to a
  different building in the same district, or move to New Jersey, the model has
  nothing to say. It is a subtraction, not a relocation.
- **The capitalisation rate is two controls now, office and residential,
  defaulting equal.** One rate used to be applied to both uses, which divided
  both sides of the comparison at once and made the control nearly inert -
  office and residential do not trade at the same yield, and the gap between
  them is a real part of why anyone converts anything. Equal defaults reproduce
  the old behaviour exactly, so the reader discovers the effect by pulling them
  apart. Both are market convention, not measurement: no published NYC series
  was verified for either.

## Two counts, and now the curve between them

The panel over the map holds the sandbox's actual argument, and it is worth
reading before the buildings.

Two populations, both counted. **198,677 office-using jobs** in Lower Manhattan,
from LODES, at work in the daytime. **85,841 residents**, from the 2020 census.
And then what the conversions do to each: at the $41 rent stop, the model
converts 59 buildings, removes about **4,700 office jobs** and adds about
**3,900 residents**. Roughly one for one.

That ratio is the thing to argue with. A conversion programme that reads as
enormous in units is small against the number of people already in the district
during the day, and it does not obviously make the street busier at nine; it
trades a large daytime population for a smaller resident one.

**An earlier version of this card said there was no curve between those two
counts, and that nothing published describes a Manhattan evening. The second
claim was wrong.** It was true of the two *trip* tables that had been checked —
NHTS 8-1 is six national bands, ACS B08302 describes the morning — and false
of the MTA's origin-destination ridership estimate, which counts arrivals at
and departures from every subway complex by hour and day of week. On an
October 2024 weekday the district's stations record 2.5 times as many exits at
five in the afternoon as entries at eight in the morning, which is what a jobs
district must show, and that asymmetry is the check that the fields mean what
their dictionary says.

So the crowd is now drawn, and its register is printed on the canvas: the
gateway shares are **measured** (counted taps), while the building each trip
starts at (proportional to jobs) and the route (shortest path, which nobody
walks) are **assumed**, and the morning's arrivals are attributed to workers
and the evening's to residents because the taps are not split by who is
riding. Underneath the counts, the ATUS at-workplace curve — a survey, counted
independently of the subway — is the number the animation is checked against.

## What else it can't see

It cannot see who moves in, or who is displaced, or whether the
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
