# Office to Residential Conversion — sandbox text

Every string a reader sees in the sandbox's menus, in reading order, for the 09-08 rebuild. This is the prose the build doc points Claude Code at; copy from here, do not rewrite. Register: flat, explanatory, model card. Figures in brackets are to be re-read from the rebuilt pipeline before they ship.

## Title block

**Title.** Office to Residential Conversion

**Subtitle.** Lower Manhattan in 2040, after the state's conversion incentive has closed. Office buildings become housing when a conversion would be worth more than the office, and the sidewalks show how the district's day changes when they do.

## Description panel (card.md)

## What this is

A model of what office-to-residential conversion would do to the street life of a business district. Every building in Manhattan Community Districts 1 and 5 is drawn from the city's own 3D survey.[^model] An office building converts to housing when two tests pass: its floor plate and age make it convertible, and the finished apartments would be worth more than the offices given up, after paying for the work. The sandbox then estimates how many people each building sends onto the sidewalk at each hour of the day, offices on a commuter's schedule and homes on a resident's, and draws that as a heat map over the streets.

The date is 2040. The state's tax incentive for conversions, RPTL 467-m, requires projects to start by mid-2031 and finish by the end of 2039,[^467m] so 2040 is the district after the incentive window has closed. Everything that converts in the model has converted by then. The financial test can be set to one of four published scenarios, or to numbers of your own.

The map shows the two districts in full and fades the rest of the city.

[^model]: DCP 3-D Building Model as CityGML (NYC Open Data `tnru-abg2`), delivery areas 12 and 19: 1,159 buildings in CD1, each with its BIN, ground outline and every roof surface at its own height. Joined to MapPLUTO 26v2 on BBL for floor area, office area, floors, year built and depth; lot-level areas are divided across the buildings on a lot.
[^467m]: RPTL 467-m, as published by HPD: at least 25% of units affordable at a weighted average of 80% AMI, with at least 5% at 40% AMI; construction started after 31 December 2022 and by 30 June 2031; completed by 31 December 2039; a 100% exemption for up to three years during construction, then 90% for 30 years south of 96th Street for projects started by 30 June 2026, with shorter terms for later starts.

## What it's trying to show

- That a change of use is seen on the street before it is seen anywhere else. The same block at five in the afternoon is empty if it is all offices and busy if it is all homes, and the heat map is the difference.
- Which buildings a conversion program would reach, and how many homes it would add, under published financial assumptions rather than invented ones.
- How much the answer depends on one side of the deal. At the published asking rent, office buildings are valued far above what they have sold for since 2020, and nothing converts; at the prices they actually trade at, most of what is convertible does.

## How it works

- **Convertibility.** Each office building gets a score from four criteria (floor plate depth, floor-to-floor height, floor plate area, age), weighted and summed to a number between 0 and 1. A building is convertible if the score clears the threshold.[^gensler] Buildings that fail this test are never tested financially.
- **The deal.** A convertible building converts if the value of the apartments, less the cost of the conversion, exceeds the value of the offices. Each value is the rent, less the operating cost share, divided by a capitalization rate. The four scenarios in the assumptions panel set all six numbers from published sources; the sliders under them can be moved freely.
- **Apartments.** Converted floor area becomes apartments at the floor area per apartment measured from completed Manhattan conversions,[^filings] and residents at the district's persons per household.[^census]
- **The day.** Office workers arrive and leave on the hourly curve counted at the district's subway complexes;[^mta] residents leave and return on the hourly share of people at home from the national time-use survey.[^atus] Each building's people, multiplied by the change in its curve from one hour to the next, is the number it sends onto the sidewalk that hour.
- **The heat map.** The district is divided into 10 m cells. Each building's sidewalk traffic for the hour is spread over the cells within 50 m of its footprint, falling off with distance and never inside a building. The activity view sums it; the population view keeps office and residential traffic in two colors.
- **The date.** The model has no clock but the hour. Every building that passes both tests is converted, and the map is the district as it would stand in 2040.

[^gensler]: Gensler publishes the criteria and the finding that about a quarter of the 1,300 buildings it scored were suitable, but not the scoring; the weights here are ours, and the threshold is set so that about a quarter of the district's office buildings pass.
[^filings]: 1,152 sf per apartment, measured from 149 DOB filings 2001-2025 in which a Manhattan building with no apartments became a residential one of ten units or more (DOB Job Application Filings `ic3t-wcy2`, DOB NOW Certificate of Occupancy `pkdm-hqz6`). The unit floor the sample is cut at is a control.
[^census]: 2020 decennial census, total population by tract: 85,841 residents in CD1 and 92,438 in CD5. Office jobs: LEHD LODES 8 Workplace Area Characteristics, New York State, 2023: 198,677 office-using jobs in CD1 and 667,498 in CD5, allocated to buildings by office floor area.
[^mta]: MTA Subway Origin-Destination Ridership Estimate 2024 (`jsu2-fbtj`), as server-side totals: arrivals at and departures from each complex in the district by hour, October 2024 weekdays. MTA Subway Entrances and Exits 2024 (`i9wp-a4ja`) places the complexes. Only the subway is counted; anyone arriving by ferry, bus, bike, car or on foot is invisible.
[^atus]: American Time Use Survey 2003-2025 (BLS), activity file, `TEWHERE` = 1 (respondent's home), weighted with `TUFNWGTP`: the share of all respondents at home in each hour of a weekday. The diary day runs 4 am to 4 am.

## What it assumes

- A building converts the moment the deal works, all at once, with no lender, no tenant in place and no construction period.
- Every apartment is occupied, at one household size for the whole district.
- Office workers keep a subway commuter's hours, and residents keep the national average day; nobody works from home, and nobody in a converted building works in the district.
- The traffic a building sends onto the sidewalk is proportional to its people and to the hourly change in their presence, and spreads 50 m from the building and no further.
- Rents are uniform across the district, and the operating cost shares and capitalization rates are market conventions rather than measurements.
- Ground floors stay commercial. Neither 467-m nor the zoning conversion rules require it, but the Special Lower Manhattan District designates retail streets where ground-floor frontage must stay active (ZR 91-41, Map 4), and converted buildings elsewhere have generally kept their retail. The model does not draw ground floors either way.
- The state incentive is a gate (a building must meet its eligibility rules) and a tax figure in the operating cost, not a dollar benefit schedule.

## What it can't see

- Who any person is. Station counts are not split by who is riding, so treating morning arrivals as workers is the model's assumption, and residents' hours come from a national survey, not a New York count.
- Anyone who is not a subway rider or a resident of the district: ferry, bus, bike, car and foot commuters, visitors, and people who work in the district's shops, hotels and restaurants.
- Who moves in, who is displaced, or where a displaced job goes.
- What a converted building looks like. Added floors are boxes and rents are one number.

## Representation panel

Panel heading: **representation**

**District** (`district`)
Options: CD 1, Lower Manhattan · CD 5, Midtown · both. Default: CD 1.
Why these numbers: The two community districts covered by the survey. The chosen district is drawn in full and everything else on the map is faded to 25%.

**Show** (`view`)
Options: sidewalk activity · who is on the street · which buildings could convert. Default: sidewalk activity.
Why these numbers: Sidewalk activity is the total traffic each patch of sidewalk carries in the chosen hour, from gray (none) through yellow to red (the busiest cell in the district's day). Who is on the street splits the same traffic into people from office buildings (blue) and people from homes (dark green). Which buildings could convert colors every office building by its convertibility score and marks the threshold.

**Hour of day** (`hour`, timeline, plays by default in the two heat map views)
Range 00:00 to 24:00. Default 08:00. Speeds 0.5×, 1×, 2×, 4×.
Why these numbers: One weekday, from the MTA's October 2024 weekday counts and the time-use survey's weekday diaries. The map interpolates between the hourly counts.
Disabled note, in the convertibility view: `no clock in this view`.

**Show added floors** (`added_floors`)
On or off. Default on.
Why these numbers: A converted building is drawn with the floors it could add under the conversion rules, as plain boxes.

Legend, activity view: a three-stop ramp labeled `none` (gray), `some` (yellow), `busiest` (red), with the number of people per hour per cell printed under each stop.

Legend, population view: two ramps, `from office buildings` (blue) and `from homes` (dark green), each from transparent to full, with the same per-cell numbers.

Legend, building colors (all views): `office` (light blue-gray) · `converted to homes` (dark green) · `existing homes` (tan) · `other` (gray).

Legend, convertibility view: a ramp from 0 to 1 with the threshold marked, and `passes` / `does not pass` swatches.

## Assumptions panel

Panel heading: **assumptions**

### the deal

**Scenario** (`scenario`)
Options: published asking rent, 2024 · Downtown Class B, effective rent, 2026 · Comptroller pro forma, 2025 · assessor's view, distressed sale · custom. Default: Comptroller pro forma, 2025.
Why these numbers: Each scenario sets the seven numbers below from one set of published sources. Moving any slider afterwards switches the scenario to custom. The notes under each scenario say where every number comes from and which are carried over because no source gives them.

Scenario notes (`x-enum-notes`, one per stop):

- **Published asking rent, 2024.** Office rent $54 per square foot, the average asking rent for Manhattan Class B and C space in the NYC Comptroller's Spotlight of 14 May 2024 (CoStar). Residential rent $75, conversion cost $350, both capitalization rates 5.5% and both operating cost shares 35% are the sandbox's original defaults and have no source; the Comptroller's May 2024 report puts conversion cost "in excess of $400 per square foot." At these numbers an office is valued at about $640 per square foot, and nothing converts.
- **Downtown Class B, effective rent, 2026.** Office rent $39: Cushman & Wakefield's Q1 2026 Downtown Class A asking rent of $61.77 divided by its reported 25.5% Class A premium gives $49 for Class B, times 0.80, the ratio of net effective to asking rent JLL reported for Manhattan Class A in 2024 (Commercial Observer, December 2024); no source gives a Class B effective rent directly. Residential rent $72: the Elliman Report's January 2026 Manhattan rental price of $96.35 per square foot per year, times the 0.75 ratio of rentable to gross area in the Comptroller's July 2025 fiscal note. Residential capitalization rate 5.25%, the midpoint of CBRE's H1 2026 range for stabilized New York multifamily. Conversion cost $400, the Comptroller's May 2024 figure. Office capitalization rate 5.5% and both operating cost shares 35% are carried over. Almost nothing converts.
- **Comptroller pro forma, 2025.** From the NYC Comptroller's Fiscal Note 6-2025, "Office-to-Residential Conversions in NYC" (July 2025): conversion cost $500 per gross square foot including financing and excluding acquisition; residential rent $79 per gross square foot ($105 per rentable); residential operating costs $14 per gross square foot plus property tax of $2 with the 467-m exemption or $21 without, so 20% of rent with the exemption and 44% without; a 5.0% capitalization rate at stabilization; and Lower Manhattan office buildings bought for conversion at $218 per gross square foot. Office rent $54 is carried over from 2024, and the office capitalization rate is set at 16% so that $54 less 35% costs values an office at the $218 the Comptroller observed; it is a rate implied by sale prices, not a market rate. Most convertible buildings convert.
- **Assessor's view, distressed sale.** From the NYC Department of Finance FY2025 income-approach guidelines for Downtown Financial District Class B office: median income $46.84 per square foot, expense ratio 49%, capitalization rate 9.49% (the assessor's rates are believed to include the effective tax rate, which is why they run above market). Those three value an office at $252 per square foot, in line with the 2024 sale of 222 Broadway at $147.5 million for 770,416 square feet, or $191 per square foot, ahead of its conversion to 798 apartments. Conversion cost $374, the building's $288 million construction loan divided by its area, which is a floor on the cost rather than the cost. Residential rent $79, operating cost share 20% and capitalization rate 5.0% are carried from the Comptroller pro forma. Most convertible buildings convert.
- **Custom.** The sliders as you have set them.

**Office rent** (`office_rent`)
Range $20 to $120 per square foot per year. Default by scenario.
Why these numbers: What the office earns per square foot of floor area each year. Asking rents overstate what tenants pay; the second scenario makes an estimate of the difference.

**Office operating cost share** (`opex_office`)
Range 15% to 60% of rent. Default by scenario.

**Office capitalization rate** (`cap_rate_office`)
Range 3% to 20%. Default by scenario.
Why these numbers: The value of a building is its net income divided by this rate. No broker publishes a Manhattan office capitalization rate; the third scenario derives one from observed sale prices and the fourth uses the assessor's.

**Residential rent** (`residential_rent`)
Range $30 to $150 per square foot of floor area per year. Default by scenario.

**Residential operating cost share** (`opex_residential`)
Range 15% to 60% of rent. Default by scenario.
Why these numbers: The Comptroller's pro forma puts operating costs at $14 per gross square foot plus property tax, and property tax at $2 with the 467-m exemption or $21 without. With the exemption that is 20% of an $79 rent; without it, 44%.

**Residential capitalization rate** (`cap_rate_residential`)
Range 3% to 10%. Default by scenario.

**Conversion cost** (`conversion_cost_sf`)
Range $100 to $800 per square foot. Default by scenario.
Why these numbers: The cost of the work per square foot of floor area, including soft costs and financing but not the purchase of the building. The Comptroller's 2025 pro forma uses $500; its two case studies came out at $525 to $765.

### the convertibility score

**Convertibility threshold** (`convertibility_threshold`)
Range 0 to 1. Default 0.5.
Why these numbers: The score a building must reach to be treated as convertible. The default is set so that about a quarter of the district's office buildings pass, which is Gensler's published share across the 1,300 buildings it scored.

**Weight: floor plate depth** (`w_depth`) · **Weight: floor-to-floor** (`w_f2f`) · **Weight: floor plate area** (`w_area`) · **Weight: age** (`w_age`)
Each 0 to 1. Defaults 0.35, 0.25, 0.20, 0.20.
Why these numbers: The four criteria Gensler names. The weights are ours; Gensler's are proprietary. Depth is weighted highest because a deep floor plate leaves interior rooms without windows.

### the rules

**467-m eligibility rules** (`incentive_467m`)
On or off. Default on.
Why these numbers: With the switch on, only buildings that meet the exemption's eligibility rules can convert. The tax effect of the exemption is in the residential operating cost share, not here.

**Unit floor in the conversion sample** (`min_units_for_conversion_sample`)
Options: 1 · 2 · 5 · 10 · 20 · 50. Default 10.
Why these numbers: The floor area per apartment is measured from completed Manhattan conversions with at least this many units. The choice moves the figure by about 40%.

Button at the foot of the panel: **Submit this state**

## Metrics strip

Labels, in order:
- people on the sidewalks at this hour, from offices / from homes
- homes created
- office floor area removed
- buildings converted, of the office buildings there are
- residents living there afterwards
- office jobs displaced
- share of office buildings that converted

## Warnings and status lines

- `loading the buildings…`
- `no basemap - the model still works`
- `{n} basemap tiles blocked - the model still works`
- in the population and activity views, small print: `subway riders and residents only; see what it can't see`

## What it can't see (assistant prompt, meta.js `cannotSee`)

Who any person is. Station flows by hour are counted, but not split by who is riding, so treating morning arrivals as workers is the model's assumption; residents' hours come from a national survey, not a New York count. Anyone arriving by ferry, bus, bike, car or on foot is invisible, because only the subway was counted, and so is anyone who works in the district's shops, hotels and restaurants. The sidewalk numbers are people a building sends out and takes in each hour, spread over the sidewalk near it, not people observed on a street. It cannot see who moves in, who is displaced, or where a displaced job goes. Conversion is instant, added floors have no form, and rents are uniform. The date is 2040 because the incentive closes in 2039; the model has no other clock.
