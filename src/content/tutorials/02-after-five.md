---
title: "Office to Residential Conversion dev notes"
date: "2026-08-31"
author: Adam Vosburgh
sequence: 2
cat: tutorial
devnotes: true
published: false
---

Notes from building the [Office to Residential Conversion](/sandboxes/after-five/) sandbox. Pipeline: `data/scripts/after-five.py`, with `afterfive_massing.py` for the CityGML and `afterfive_day.py` for the day and the sidewalk grid. Component: `src/lib/sandboxes/after-five/`.

![the sandbox at its defaults](/covers/after-five.png#img-full)

<div class="gap">

**What a rebuild won't have.** The sandbox precomputes, for every one of 3,728 buildings, the sidewalk cells within 50 m of its footprint edge with a distance weight on each - 298,563 pairs, shipped as a CSR array - and cuts an at-home curve from a half-gigabyte federal survey. A rebuild should take one district, a coarser grid, and a hand-drawn day curve. Keep the labels that say which parts are measured and which are assumed.

</div>

## The ambition

Office-to-residential conversion is usually discussed in units, dollars and whether it pays the developer. The idea here was to look at what conversion would do to a district instead: who is on the street over the course of a day, and how the counts of workers and residents shift as buildings change use. The deal is in the model because nothing converts without one, but the map is about the place. Lower Manhattan was the site because it has the office stock, a history of conversions, and a city 3D survey of every building.

The 09-08 rebuild removed the agents and the year. The agents asked the reader to believe a route, a walking speed and a choice of door, none of which is in any dataset; what replaced them asks a question the data can answer - how many people does a building put onto the pavement near it in each hour - and draws that as a heat map. The year went because the state's incentive requires a conversion to finish by the end of 2039, so the date is 2040 and everything that converts has converted.

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
- **MTA Subway Entrances and Exits 2024** (`i9wp-a4ja`). Places the complexes.
- **ATUS 2003-2025.** Gives the residents' day: the weighted share of all respondents at home in each hour of a weekday, from 124,923 diaries after dropping 2020, which has no multi-year weight.
- **NYC Community Districts** (NYC Open Data `5crt-au7u`), BoroCD 101 and 105. Gives the outlines that are cut out of the mask fading the rest of the city.
- **A 10 m sidewalk grid**, derived: 675 x 941 cells over the two districts, 609,412 of them not inside any building footprint, with each building's list of cells within 50 m of its edge and a Gaussian weight on that distance.

![the MTA day and the ATUS check](/tutorials/images/02/mta-day-atus.png#img-full)

## Roadblocks

- The Rhino `.3dm` version of the 3D survey carries no attributes at all, so buildings were first identified by nearest footprint; checked against the CityGML BINs, that was wrong for one building in five.
- "DOB NOW: Build – Job Application Filings" contains only Brooklyn (86,130 rows, every filing prefixed B), so certificates of occupancy replaced it for recent years.
- 53,000 of the 81,000 certificates are renewals, which would have counted as conversions if not excluded.
- Giving each building its lot's whole office area put 112 million sf of offices in the district; dividing across buildings gives 78 million, against a published figure of about 90 million.
- The office rent was in the model twice, at $38 and $62, neither sourced. Replacing them with the Comptroller's published $54 asking rent emptied the map, and the 09-08 rebuild found out why: at an asking rent and a 5.5% cap rate an office is valued at about $640 a square foot, which is three times what Lower Manhattan office buildings have actually sold for since 2020. The four scenarios are that argument written out, with the capitalization rate rather than the rent doing most of the work.
- An earlier version said no dataset describes when a Manhattan office district empties; the MTA origin-destination estimate does, by hour, and it was one catalog away.
- The MTA hourly ridership file (entries only) shows 2.5 times as many station entries at 17:00 as at 08:00 for Lower Manhattan complexes, which is the check that the fields mean what the dictionary says.
- The 116-million-row ridership table has to be fetched as a server-side aggregate, since a row pull with a limit truncates silently.
- The planned 1995 back-test against the 421-g conversions couldn't run, because the filing data starts on 1 January 2000.
- The first build was a map seen from above and said nothing about the street, which was the point; a second pass added per-segment walker counts, a two-hour comparison, an eye-height view, a ground-floor rule and the residents' own survey day.
- Nothing on disk records what a ground floor is used for at building resolution, so the active-frontage share was a probability slider rather than data. The 09-08 rebuild dropped it along with the streets and the eye-height view.
- The build doc named `yfnk-k7r4` for the community districts. That dataset does not exist on NYC Open Data; the catalog gives `5crt-au7u`, 71 features with `boro_cd` as a string, and the fetch script says so at the top.
- `buildings.bin` was widened from 15 columns to 18 in an earlier pass without re-running the CityGML read, on the argument that the four sub-scores are an exact rearrangement of the composite already stored. Re-running the whole pipeline on 09-08 checked it: `footprints.json` came out byte-identical and `buildings.bin` differed only in those four columns, by at most 3e-7, which is one float32 ulp.
- There is no sidewalk dataset, so a cell counts as sidewalk when its center is not inside a building footprint. That also counts streets, plazas, parks and the water - 95.9% of the grid - and the card says so rather than calling it a sidewalk map.
- deck.gl's `BitmapLayer` does not take an `ImageData` and re-uploads a texture only when the image identity changes. The heat map writes into one buffer and hands the layer one of two alternating canvases, so the pixels reach the GPU every frame without allocating a texture every frame.
- The grid's row 0 is its south edge and an image's row 0 is its top, so the write is flipped. Getting that wrong mirrors the heat map about the district's waist, which reads as a plausible map of somewhere else.
- The 24-hour, two-channel pass over 298,563 building-cell pairs takes about 50 ms, so it runs on the main thread when an assumption moves and never when the clock does. The clock only interpolates between two hour bins.
- The activity ramp is normalized once, at the default scenario, and held. Rescaling it per scenario made the map show the shape of the color scale rather than the shape of the day.

## What came out

A district in 3D in 2040, with the buildings the deal converts drawn in green, and the sidewalks colored by how many people the buildings around them send out in the chosen hour.

### What you should see

The Comptroller's 2025 pro forma, the population view at five o'clock:

<div data-sandbox="after-five" data-mode="view" data-params='{"district":"mn01","view":"population","hour":17,"added_floors":true,"scenario":"comptroller_2025","office_rent":54,"opex_office":0.35,"cap_rate_office":0.16,"residential_rent":79,"opex_residential":0.2,"cap_rate_residential":0.05,"conversion_cost_sf":500,"convertibility_threshold":0.5,"w_depth":0.35,"w_f2f":0.25,"w_area":0.2,"w_age":0.2,"incentive_467m":true,"min_units_for_conversion_sample":10}'></div>

The 2024 asking rent, where nothing converts:

<div data-sandbox="after-five" data-mode="view" data-params='{"district":"mn01","view":"population","hour":17,"added_floors":true,"scenario":"asking_2024","office_rent":54,"opex_office":0.35,"cap_rate_office":0.055,"residential_rent":75,"opex_residential":0.35,"cap_rate_residential":0.055,"conversion_cost_sf":350,"convertibility_threshold":0.5,"w_depth":0.35,"w_f2f":0.25,"w_area":0.2,"w_age":0.2,"incentive_467m":true,"min_units_for_conversion_sample":10}'></div>

- The four scenarios in CD1: published asking rent 2024 converts **0 of 381** office buildings and creates no homes; Downtown Class B effective rent 2026 converts **1**, 26 homes; the Comptroller's 2025 pro forma converts **142**, 10,141 homes; the assessor's distressed view converts **142**, 10,141 homes. At the last two the office is valued at $219 and $252 per square foot and the apartments at $764 and $890.
- Moving any of the seven deal sliders switches the scenario button to `custom`, and nothing else changes with it.
- Green buildings are the ones that converted; blue-gray are still offices; tan are homes that were already there.
- At `asking_2024`, the population view at 17:00 has no green anywhere except the buildings that were already residential, because nothing converted.
- **There are no gateways.** Nothing concentrates at a station exit except insofar as buildings stand near one, which is a real difference from the version this replaced.
- The residents' curve has its own shape: the at-home share bottoms out at 0.39 from 11:00 to 14:00 and the flow it implies peaks at 06:00, spreading its return across 15:00 to 20:00. The office curve peaks at 08:00 and 17:00. They are not the same day, which is the thing the two-color view is for.
- The clock is disabled in the convertibility view, and the map says so rather than leaving a control that does nothing.

### Limitations

- Conversion is instant, and rents are uniform across the district. There is no time in the model but the hour.
- The convertibility score is ours, misses three of the criteria it stands in for, and also drives conversion cost.
- Floor area per apartment depends on which filings count, and the choice moves it by 40%; the cut is a control with six measured stops.
- Added floors are a story count, so they can only be drawn as a block on the roof.
- The sidewalk numbers are people a building sends out and takes in, spread over the ground near it - not people observed on a street. The spread is a Gaussian on the distance from the footprint, which is a choice.
- A cell counts as sidewalk when it is not inside a building, so streets, plazas, parks and the water are all in the map.
- Anyone not arriving by subway is invisible, and residents' hours are a national survey applied to Manhattan.
- The model isn't validated against history.

---

Notes by Adam Vosburgh, Fall 2026.
