# Office to Residential Conversion — sandbox text

Every string a reader sees in the sandbox's menus, in reading order, for the 09-08 rebuild. This is the prose the build doc points Claude Code at; copy from here, do not rewrite. Register: flat, explanatory, model card. Figures in brackets are to be re-read from the rebuilt pipeline before they ship.

Controls removed 09-10, to be taken out of schema.json, the component and meta.js: `added_floors` (the drawn boxes were floors from past DOB filings, not a model result; nothing is drawn now) and `min_units_for_conversion_sample` (fixed at 10+; the footnote states it).

## Title block

**Title.** Office to Residential Conversion

**Subtitle.** Visualization of street-level activity under different scenarios of office to residential conversions.

## Description panel (card.md)

## Description

Discussions around converting a glut of commercial real estate space to housing usually focus on what makes those conversions difficult - deep floor plates, construction and labor costs, projections of a commercial rent renaissance, etc. Left out of these discussions is how the urban fabric of central business districts (CBDs) would change if many of these conversions went through. This sandbox is an attempt to visualize street-level activity under different scenarios of conversion.

The model looks at two CBDs[^model], and converts a commercial building to residential when two tests pass: its floor plate and age make it convertible[^gensler], and the finished apartments[^filings] would be worth more than the offices given up, after paying for the work. The sandbox then estimates how many people each building sends onto the sidewalk at each hour of the day[^census], offices on a commuter's schedule[^mta] and homes on a resident's[^atus], and draws that as a heat map over the streets.

Four default scenarios have been chosen - the first three apply purely financial tests, and the final one also lowers the threshold for convertibility. All scenarios are set in 2040, the year after the deadline by which HPD requires conversions to be completed in order to take advantage of the tax incentive described in RPTL 467-m[^467m].

[^model]: [DCP 3-D Building Model](https://data.cityofnewyork.us/d/tnru-abg2) as CityGML (NYC Open Data `tnru-abg2`), delivery areas 12 and 19: 1,159 buildings in CD1, each with its BIN, ground outline and every roof surface at its own height. Joined to [MapPLUTO 26v2](https://www.nyc.gov/site/planning/data-maps/open-data/dwn-pluto-mappluto.page) on BBL for floor area, office area, floors, year built and depth; lot-level areas are divided across the buildings on a lot in proportion to footprint area times height, and no building is given more floor area than its own outline could hold at its lot's floor count.
[^467m]: [RPTL 467-m](https://www.nyc.gov/site/hpd/services-and-information/tax-incentives-467-m.page), as published by HPD: at least 25% of units affordable at a weighted average of 80% AMI, with at least 5% at 40% AMI; construction started after 31 December 2022 and by 30 June 2031; completed by 31 December 2039; a 100% exemption for up to three years during construction, then 90% for 30 years south of 96th Street for projects started by 30 June 2026, with shorter terms for later starts.
[^gensler]: Gensler, ["What We've Learned by Assessing More Than 1,300 Potential Office-to-Residential Conversions"](https://www.gensler.com/blog/what-we-learned-assessing-office-to-residential-conversions). Gensler publishes its criteria and the finding that about a quarter of the buildings it scored were suitable, but not the scoring; the four criteria here are drawn from its list, and the default weights are educated guesses.
[^filings]: Converted floor area becomes apartments at 1,152 sf each, measured from 149 filings, 2001-2025, in which a Manhattan building with no apartments became a residential one of ten units or more ([DOB Job Application Filings](https://data.cityofnewyork.us/d/ic3t-wcy2), [DOB NOW Certificate of Occupancy](https://data.cityofnewyork.us/d/pkdm-hqz6)). The apartment count is the building's existing office floor area divided by this figure, and it sets how many residents a converted building has. Cutting the sample at one unit instead of ten raises the figure to 1,366 sf, because small filings report a whole building's area against a few apartments.
[^census]: [2020 decennial census](https://data.census.gov/), total population by tract: 85,841 residents in CD1 and 92,438 in CD5. Office jobs: [LEHD LODES 8](https://lehd.ces.census.gov/data/) Workplace Area Characteristics, New York State, 2023: 198,677 office-using jobs in CD1 and 667,498 in CD5, allocated to buildings by office floor area.
[^mta]: [MTA Subway Origin-Destination Ridership Estimate 2024](https://data.ny.gov/d/jsu2-fbtj) (`jsu2-fbtj`), as server-side totals: arrivals at and departures from each complex in the district by hour, October 2024 weekdays. [MTA Subway Entrances and Exits 2024](https://data.ny.gov/d/i9wp-a4ja) (`i9wp-a4ja`) places the complexes. Only the subway is counted; anyone arriving by ferry, bus, bike, car or on foot is invisible.
[^atus]: [American Time Use Survey](https://www.bls.gov/tus/data.htm) 2003-2025 (BLS), activity file, `TEWHERE` = 1 (respondent's home), weighted with `TUFNWGTP`: the share of all respondents at home in each hour of a weekday. The diary day runs 4 am to 4 am.

## Assumptions + Limitations

- A building converts the moment the deal works, all at once, with no lender, no tenant in place and no construction period.
- Every apartment is occupied, at one household size for the whole district.
- Office workers keep a subway commuter's hours, and residents keep the national average day; *nobody works from home,* and nobody in a converted building works in the district.
- The traffic a building sends onto the sidewalk is proportional to its people and to the hourly change in their presence, and spreads 50 m from the building's edge and no further.
- There is no sidewalk dataset. A cell counts as sidewalk when it is within 15 m of a walkable street centerline[^streets] and not inside a building; the 15 m is our choice. Ground away from a street, such as the World Trade Center memorial plaza, is not in the model.
- Where the 2014 survey is missing a building on a lot, the lot's floor area goes to the buildings it has. The World Trade Center lot holds nine buildings and the survey has five, so 1 WTC carries more floor area than it has; a cap holds every building to what its own outline could hold, which bounds the error without removing it.
- Rents are uniform across the district, and the operating cost shares and capitalization rates are assumed from published market conventions.
- Ground floors stay commercial. Neither 467-m nor the zoning conversion rules require it, but the Special Lower Manhattan District designates retail streets where ground-floor frontage must stay active ([ZR 91-41](https://zr.planning.nyc.gov/article-ix/chapter-1/91-41), Map 4), and converted buildings elsewhere have generally kept their retail.
- The state incentive is a gate (a building must meet its eligibility rules) and a tax figure in the operating cost; it does not consider the time value of money as a typical investment would.
- Station counts are not split by who is riding, so treating morning arrivals as workers is the model's assumption, and residents' hours come from a national survey, not a New York count.
- Anyone who is not a subway rider or a resident of the district is not counted.
- Who moves in, who is displaced, or where a displaced job goes is not considered.
- What a converted building looks like is not considered. No height is added; apartments come from the existing office floor area only.

[^streets]: [NYC Street Centerline](https://data.cityofnewyork.us/d/inkn-q76z) (NYC Open Data `inkn-q76z`), the segments coded street, bridge, boardwalk, path, step street or alley, dropping those flagged non-pedestrian: 7,413 lines across the two districts. It carries no sidewalk, width or curb.

## Representation panel

Panel heading: **representation**

**District** (`district`)
Options: CD 1, Lower Manhattan · CD 5, Midtown · both. Default: CD 1.

**Show** (`view`)
Options: sidewalk activity · who is on the street · which buildings could convert. Default: sidewalk activity.
More: Sidewalk activity is the total traffic each patch of sidewalk carries in the chosen hour, from gray (little) through yellow to red (the busiest cell in the district's day). Who is on the street splits the same traffic into people from office buildings (blue) and people from homes (dark green). Which buildings could convert colors every office building by its convertibility score and marks the threshold.

**Hour of day** (`hour`, timeline, plays by default in the two heat map views)
Range 00:00 to 24:00. Default 08:00. Speeds 0.5×, 1×, 2×, 4×.
More: From the MTA's October 2024 weekday counts and the time-use survey's weekday diaries. These sources publish hourly figures; the model interpolates between them.
Disabled note, in the convertibility view: `no clock in this view`.

Legend, activity view: a three-stop ramp labeled `none` (gray), `some` (yellow), `busiest` (red), with the number of people per hour per cell printed under each stop.

Legend, population view: two ramps, `from office buildings` (blue) and `from homes` (dark green), each from transparent to full, with the same per-cell numbers.

Legend, building colors (all views): `office` (light blue-gray) · `converted to homes` (dark green) · `existing homes` (tan) · `other` (gray).

Legend, convertibility view: a ramp from 0 to 1 with the threshold marked, and `passes` / `does not pass` swatches.

## Assumptions panel

Panel heading: **assumptions**

### the deal

**Scenario** (`scenario`)
Options: published asking rent, 2024 · Downtown Class B, effective rent, 2026 · Comptroller pro forma, 2025 · maximum housing · custom. Default: Comptroller pro forma, 2025.
More: Each scenario sets the seven deal numbers below and the convertibility threshold. Moving any slider afterwards switches the scenario to custom. The note under each scenario cites its source and lists what is assumed.

Scenario notes (`x-enum-notes`, one per stop):

- **Published asking rent, 2024.** Source: [NYC Comptroller, Spotlight: New York City's Office Market, 14 May 2024](https://comptroller.nyc.gov/wp-content/uploads/documents/May-Spotlight-OFFICE-MARKET.pdf). Office rent $54, the average asking rent for Manhattan Class B and C space (CoStar). Assumed, with no source: residential rent $75, conversion cost $350, both capitalization rates 5.5%, both operating cost shares 35%; the Comptroller puts conversion cost above $400. At these numbers an office is valued at about $640 per square foot, and nothing converts.
- **Downtown Class B, effective rent, 2026.** Sources: [Cushman & Wakefield, Downtown Manhattan, April 2026](https://www.cushmanwakefield.com/en/united-states/news/2026/04/divide-in-the-downtown-manhattan-office-sharpens-as-class-a-pulls-further-ahead-on-rents); [Commercial Observer, December 2024 (JLL)](https://commercialobserver.com/2024/12/asking-vs-taking-rents-manhattan-office-2024/); [Elliman Report, January 2026](https://millersamuel.com/reports/elliman-report-manhattan-brooklyn-queens-rentals-1-2026/); [CBRE cap rate survey, H1 2026](https://www.cbre.com/insights/reports/us-cap-rate-survey-h1-2026). Office rent $39: Downtown Class A asking rent $61.77, less the 25.5% Class A premium, times 0.80, JLL's ratio of effective to asking rent; no source gives a Class B effective rent directly. Residential rent $72: $96.35 per square foot per year times the Comptroller's 0.75 rentable-to-gross ratio. Residential capitalization rate 5.25%, the midpoint of CBRE's range for stabilized New York multifamily. Conversion cost $400, the Comptroller's 2024 figure. Assumed, with no source: office capitalization rate 5.5% and both operating cost shares 35%. Almost nothing converts.
- **Comptroller pro forma, 2025.** Source: [NYC Comptroller, Fiscal Note 6-2025, "Office-to-Residential Conversions in NYC", July 2025](https://comptroller.nyc.gov/wp-content/uploads/documents/fn_economics_conversions_july.pdf). Conversion cost $500 per gross square foot including financing and excluding acquisition; residential rent $79 per gross square foot; residential operating costs 20% of rent with the 467-m exemption (44% without); residential capitalization rate 5.0%; Lower Manhattan office buildings bought for conversion at $218 per gross square foot. Assumed: office rent $54, carried over from 2024, and an office capitalization rate of 16%, set so that $54 less 35% costs values an office at the Comptroller's $218; it is a rate implied by sale prices, not a market rate. At these numbers every building past the convertibility threshold also clears the deal, so shape alone decides what converts.
- **Maximum housing.** Not a published scenario. Deal numbers from the [NYC Department of Finance FY2025 income-approach guidelines](https://www.nyc.gov/assets/finance/downloads/pdf/24pdf/fy25-assessment-roll-guidelines.pdf) for Downtown Class B office: income $46.84 per square foot, expense ratio 49%, capitalization rate 9.49%, which value an office at $252 per square foot. Conversion cost $374, the construction loan on 222 Broadway divided by its area. Residential rent $79, operating cost share 20% and capitalization rate 5.0% are carried from the Comptroller pro forma. The convertibility threshold is lowered from 0.5 to 0.3, and that number is invented. Almost everything convertible converts.
- **Custom.** The sliders as you have set them.

**Office rent** (`office_rent`)
Range $20 to $120 per square foot per year. Default by scenario.
More: What the office earns per square foot of floor area each year.

**Office operating cost share** (`opex_office`)
Range 15% to 60% of rent. Default by scenario.

**Office capitalization rate** (`cap_rate_office`)
Range 3% to 20%. Default by scenario.
More: The value of a building is its net income divided by this rate. The third scenario derives the rate from observed sale prices and the fourth uses the assessor's.

**Residential rent** (`residential_rent`)
Range $30 to $150 per square foot of floor area per year. Default by scenario.

**Residential operating cost share** (`opex_residential`)
Range 15% to 60% of rent. Default by scenario.
More: The Comptroller's pro forma puts operating costs at $14 per gross square foot plus property tax, and property tax at $2 with the 467-m exemption or $21 without. With the exemption that is 20% of a $79 rent; without it, 44%.

**Residential capitalization rate** (`cap_rate_residential`)
Range 3% to 10%. Default by scenario.

**Conversion cost** (`conversion_cost_sf`)
Range $100 to $800 per square foot. Default by scenario.
More: The cost of the work per square foot of floor area, including soft costs and financing but not the purchase of the building. The Comptroller's 2025 pro forma uses $500; its two case studies came out at $525 to $765. Buildings shaped in a way that makes conversion difficult are assumed to cost more: the figure is scaled up by how far the building's convertibility score falls short of 1.

### the convertibility score

**Convertibility threshold** (`convertibility_threshold`)
Range 0 to 1. Default 0.5.
More: The score a building must reach to be treated as convertible. The default is set so that about a quarter of the district's office buildings pass, the share Gensler reports across the 1,300 buildings it scored.

**Weight: floor plate depth** (`w_depth`) · **Weight: floor-to-floor** (`w_f2f`) · **Weight: floor plate area** (`w_area`) · **Weight: age** (`w_age`)
Each 0 to 1. Defaults 0.35, 0.25, 0.20, 0.20.
More: Four criteria drawn from Gensler's convertibility report, which does not publish its weights. These weights are educated guesses.

### the rules

**467-m eligibility rules** (`incentive_467m`)
On or off. Default on.
More: With the switch on, only buildings that meet the exemption's eligibility rules can convert. The tax effect of the exemption is in the residential operating cost share, not here.

Button at the foot of the panel: **Submit this state**

## Metrics strip

Labels, in order:
- people on the sidewalks at this hour, from offices / from homes
- homes created
- office floor area removed
- buildings converted, of the office buildings there are
- share of office buildings that converted

## Warnings and status lines

- `loading the buildings…`
- `no basemap - the model still works`
- `{n} basemap tiles blocked - the model still works`
- in the population and activity views, small print: `subway riders and residents only; see what it can't see`

## What it can't see (assistant prompt, meta.js `cannotSee`)

Who any person is. Station flows are counted by hour but not split by who is riding, so treating morning arrivals as workers is the model's assumption, and residents' hours come from a national survey, not a New York count. Anyone who is not a subway rider or a resident of the district is not counted: ferry, bus, bike, car and foot commuters, visitors, and people who work in the district's shops, hotels and restaurants. The sidewalk numbers are people a building sends out and takes in each hour, spread over the street within 50 m of it, not people observed on a street. There is no sidewalk dataset; the 15 m band around each street centerline is our choice, and ground away from a street, such as the World Trade Center memorial plaza, is not in the model. Where the 2014 survey is missing a building on a lot, the lot's floor area goes to the buildings it has, so 1 WTC carries more floor area than it has; the cap that holds each building to its own outline bounds that error without removing it. Conversion is instant, every apartment is occupied, rents are uniform, no height is added, and the incentive is a gate and a tax figure with no time value of money. It cannot see who moves in, who is displaced, or where a displaced job goes. The date is 2040 because the incentive requires completion by the end of 2039; the model has no other clock.
