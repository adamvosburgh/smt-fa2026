---
title: "Office to Residential Conversion dev notes"
date: "2026-08-31"
author: Adam Vosburgh
sequence: 2
cat: tutorial
devnotes: true
published: true
---

Notes from building the [Office to Residential Conversion](/sandboxes/after-five/) sandbox. Pipeline: `data/scripts/after-five.py` and `after-five-agents.py`. Component: `src/lib/sandboxes/after-five/`.

![the sandbox at its defaults](/covers/after-five.png#img-full)

<div class="gap">

**What a rebuild won't have.** The sandbox routes its crowd on a precomputed street graph with shortest paths shipped as predecessor arrays, and checks it against a curve cut from a half-gigabyte federal survey. A rebuild should stop at the counted arrivals and departures per station per hour, and a crowd that walks straight lines. Keep the labels that say which parts are measured and which are assumed.

</div>

## The ambition

Office-to-residential conversion is usually discussed in units, dollars and whether it pays the developer. The idea here was to look at what conversion would do to a district instead: who is on the street over the course of a day, and how the counts of workers and residents shift as buildings change use. The deal is in the model because nothing converts without one, but the map is about the place. Lower Manhattan was the site because it has the office stock, a history of conversions, and a city 3D survey of every building.

## The parts

- **DCP 3-D Building Model, CityGML** (NYC Open Data `tnru-abg2`), 1,159 buildings in CD1 with BINs. Gives the massing and the ID everything else joins on.
- **MapPLUTO 26v2**, joined on BBL. Gives floor area, office area, floors, year built and depth; lot areas are split across the buildings on a lot.
- **DOB job filings** (`ic3t-wcy2`) and **certificates of occupancy** (`pkdm-hqz6`). Give the conversions that actually happened, stories added, and a measured 1,152 sf per apartment from 149 filings.
- **Gensler's published convertibility criteria.** Give the shape of the score; the scoring is proprietary, so the four proxies and their weights are ours.
- **NYC Comptroller, Spotlight on the office market, 14 May 2024.** Gives the office rent, $54/sf asking, Class B and C, the one sourced figure in the deal.
- **RPTL 467-m as published by HPD.** Gives the tax exemption's eligibility tests; its benefit schedule isn't published, so it's a gate rather than money.

![the two gates](/tutorials/images/02/two-gates.svg#img-full)

- **LEHD LODES 8 (2023)** and the **2020 census**, joined through MapPLUTO's block and tract fields. Give 198,677 office jobs and 85,841 residents in CD1.
- **MTA Subway Origin-Destination Ridership Estimate 2024** (`jsu2-fbtj`), aggregated server-side to arrivals and departures per complex per hour on October 2024 weekdays. Gives the crowd's schedule.
- **MTA Subway Entrances and Exits 2024** (`i9wp-a4ja`) and **NYC Street Centerline** (`inkn-q76z`). Give the gateways and the graph trips are routed on.
- **ATUS 2003-2025.** Gives the share of office-type workers at their workplace by hour (drawn as an independent check) and the weekday hours of people not employed (which time the residents' trips).

![the MTA day and the ATUS check](/tutorials/images/02/mta-day-atus.png#img-full)

## Roadblocks

- The Rhino `.3dm` version of the 3D survey carries no attributes at all, so buildings were first identified by nearest footprint; checked against the CityGML BINs, that was wrong for one building in five.
- "DOB NOW: Build – Job Application Filings" contains only Brooklyn (86,130 rows, every filing prefixed B), so certificates of occupancy replaced it for recent years.
- 53,000 of the 81,000 certificates are renewals, which would have counted as conversions if not excluded.
- Giving each building its lot's whole office area put 112 million sf of offices in the district; dividing across buildings gives 78 million, against a published figure of about 90 million.
- The office rent was in the model twice, at $38 and $62, neither sourced; at the Comptroller's $54 nothing converts before 2050, where the old figures converted 29% of the district.
- An earlier version said no dataset describes when a Manhattan office district empties; the MTA origin-destination estimate does, by hour, and it was one catalog away.
- The MTA hourly ridership file (entries only) shows 2.5 times as many station entries at 17:00 as at 08:00 for Lower Manhattan complexes, which is the check that the fields mean what the dictionary says.
- The 116-million-row ridership table has to be fetched as a server-side aggregate, since a row pull with a limit truncates silently.
- The planned 1995 back-test against the 421-g conversions couldn't run, because the filing data starts on 1 January 2000.
- The first build was a map seen from above and said nothing about the street, which was the point; a second pass added per-segment walker counts, a two-hour comparison, an eye-height view, a ground-floor rule and the residents' own survey day.
- Nothing on disk records what a ground floor is used for at building resolution, so the active-frontage share is a probability slider rather than data.

## What came out

A district in 3D, a deal tested at six dates, a crowd running a counted day, streets colored by how many walkers cross them in the selected hour, and two counts in the panel: workers by day, residents, and what conversions do to each.

### What you should see

At the defaults, 2035:

<div data-sandbox="after-five" data-mode="view" data-params='{"district":"mn01","year":2035,"conversion_cost_sf":350,"residential_rent":75,"office_rent_trend":-0.01,"office_rent":54,"cap_rate_office":0.055,"cap_rate_residential":0.055,"opex_share":0.35,"w_depth":0.35,"w_f2f":0.25,"w_area":0.2,"w_age":0.2,"incentive_467m":true,"convertibility_threshold":0.5,"colour_by":"use","added_floors":true}'></div>

With the office rent at the $41 stop (a 25% discount to asking, ours):

<div data-sandbox="after-five" data-mode="view" data-params='{"district":"mn01","year":2035,"conversion_cost_sf":350,"residential_rent":75,"office_rent_trend":-0.01,"office_rent":41,"cap_rate_office":0.055,"cap_rate_residential":0.055,"opex_share":0.35,"w_depth":0.35,"w_f2f":0.25,"w_area":0.2,"w_age":0.2,"incentive_467m":true,"convertibility_threshold":0.5,"colour_by":"use","added_floors":true}'></div>

- Blue is office, red is converted; at $54 there is no red.
- At $41, 59 buildings convert, removing about 4,700 office jobs and adding about 3,900 residents.
- With the office rent trend at zero nothing changes between 2025 and 2050, because the office market moving is what moves the model through time.
- With the rent at $41, turning the 467-m rules off takes conversions from 59 to 142; that is the eligibility rules excluding buildings, not the tax break being worth money.
- Playing the hour runs the crowd on the measured curves; the canvas labels the measured part (station flows) and the assumed parts (which building, which route, residents' hours).
- Streets darken and widen where the hour's walkers are; clicking one puts the camera at eye height, and the button (or `esc`) returns to the district view.
- With the two-hour comparison on, the second hour's crowd is drawn in amber over the first's gray, and streets take the color of the hour with more walkers.
- Residents follow their own survey day by default, so a converted block has people on the street at 14:00; the mirror option empties the early afternoon.
- Where anything converts, each red building's base is edged warm or dark by the ground-floor probability.
- Midtown South has a newer, deeper stock: at the $41 stop the 2035 shares are similar (59 of 381 against 201 of 1,437), but by 2050 it is a third of Lower Manhattan against more than half of Midtown South, at nearly two jobs removed per resident housed.

### Limitations

- Conversion is instant; rents are uniform across the district and only office rent moves over time.
- The convertibility score is ours, misses three of the criteria it stands in for, and also drives conversion cost.
- Floor area per apartment depends on which filings count, and the choice moves it by 40%; the cut is a control with six measured stops.
- Added floors are a story count, so they can only be drawn as a block on the roof.
- The crowd's roles are attributed (morning arrivals are workers), and anyone not arriving by subway is invisible.
- Street counts are routed trips, not people observed; residents' hours are a national survey applied to Manhattan; the ground-floor rule is a probability we chose.
- The model isn't validated against history.

---

Notes by Adam Vosburgh, Fall 2026.
