<!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->

## What this is

A model of what office-to-residential conversion would do to the street life of a business district. Every building in Manhattan Community Districts 1 and 5 is drawn from the city's own 3D survey.[^model] An office building converts to housing when two tests pass: its floor plate and age make it convertible, and the finished apartments would be worth more than the offices given up, after paying for the work. The sandbox then estimates how many people each building sends onto the sidewalk at each hour of the day, offices on a commuter's schedule and homes on a resident's, and draws that as a heat map over the streets.

The date is 2040. The state's tax incentive for conversions, RPTL 467-m, requires projects to start by mid-2031 and finish by the end of 2039,[^467m] so 2040 is the district after the incentive window has closed. Everything that converts in the model has converted by then. The financial test can be set to one of four published scenarios, or to numbers of your own.

The map shows the two districts in full and fades the rest of the city.

[^model]: DCP 3-D Building Model as CityGML (NYC Open Data `tnru-abg2`), delivery areas 12 and 19: 1,159 buildings in CD1, each with its BIN, ground outline and every roof surface at its own height. Joined to MapPLUTO 26v2 on BBL for floor area, office area, floors, year built and depth; lot-level areas are divided across the buildings on a lot in proportion to each building's footprint area times its height, so a tower and the entrance canopy beside it are not given the same share, and no building is given more floor area than its own outline could hold at its lot's floor count.
[^467m]: RPTL 467-m, as published by HPD: at least 25% of units affordable at a weighted average of 80% AMI, with at least 5% at 40% AMI; construction started after 31 December 2022 and by 30 June 2031; completed by 31 December 2039; a 100% exemption for up to three years during construction, then 90% for 30 years south of 96th Street for projects started by 30 June 2026, with shorter terms for later starts.

## What it's trying to show

- That a change of use is seen on the street before it is seen anywhere else. The same block at five in the afternoon is empty if it is all offices and busy if it is all homes, and the heat map is the difference.
- Which buildings a conversion program would reach, and how many homes it would add, under published financial assumptions rather than invented ones.
- How much the answer depends on one side of the deal. At the published asking rent, office buildings are valued far above what they have sold for since 2020, and nothing converts; at the prices they actually trade at, most of what is convertible does.

## How it works

- **Convertibility.** Each office building gets a score from four criteria (floor plate depth, floor-to-floor height, floor plate area, age), weighted and summed to a number between 0 and 1. A building is convertible if the score clears the threshold.[^gensler] Buildings that fail this test are never tested financially.
- **The deal.** A convertible building converts if the value of the apartments, less the cost of the conversion, exceeds the value of the offices. Each value is the rent, less the operating cost share, divided by a capitalization rate. The four scenarios in the assumptions panel set all six numbers from published sources; the sliders under them can be moved freely.
- **Apartments.** Converted floor area becomes apartments at the floor area per apartment measured from completed Manhattan conversions,[^filings] and residents at the district's persons per household.[^census]
- **The day.** Office workers arrive and leave on the hourly curve counted at the district's subway complexes;[^mta] residents leave and return on the hourly share of people at home from the national time-use survey.[^atus] For an office building, the number it sends onto the sidewalk in an hour is its workers times the arrivals and departures counted in that hour, which is already a flow. For a home it is its residents times the change in the at-home share from one hour to the next, which is an occupancy turned into a flow. Both curves are scaled so a person makes two trips a day.
- **The heat map.** The district is divided into 10 m cells. Each building's sidewalk traffic for the hour is spread over the cells within 50 m of its footprint that are also within 15 m of a walkable street centerline,[^streets] falling off with distance and never inside a building. The activity view sums it; the population view keeps office and residential traffic in two colors.
- **The date.** The model has no clock but the hour. Every building that passes both tests is converted, and the map is the district as it would stand in 2040.

[^gensler]: Gensler publishes the criteria and the finding that about a quarter of the 1,300 buildings it scored were suitable, but not the scoring; the weights here are ours, and the threshold is set so that about a quarter of the district's office buildings pass.
[^filings]: 1,152 sf per apartment, measured from 149 DOB filings 2001-2025 in which a Manhattan building with no apartments became a residential one of ten units or more (DOB Job Application Filings `ic3t-wcy2`, DOB NOW Certificate of Occupancy `pkdm-hqz6`). The unit floor the sample is cut at is a control.
[^census]: 2020 decennial census, total population by tract: 85,841 residents in CD1 and 92,438 in CD5. Office jobs: LEHD LODES 8 Workplace Area Characteristics, New York State, 2023: 198,677 office-using jobs in CD1 and 667,498 in CD5, allocated to buildings by office floor area.
[^mta]: MTA Subway Origin-Destination Ridership Estimate 2024 (`jsu2-fbtj`), as server-side totals: arrivals at and departures from each complex in the district by hour, October 2024 weekdays. MTA Subway Entrances and Exits 2024 (`i9wp-a4ja`) places the complexes. Only the subway is counted; anyone arriving by ferry, bus, bike, car or on foot is invisible.
[^atus]: American Time Use Survey 2003-2025 (BLS), activity file, `TEWHERE` = 1 (respondent's home), weighted with `TUFNWGTP`: the share of all respondents at home in each hour of a weekday. The diary day runs 4 am to 4 am.
[^streets]: NYC Street Centerline (NYC Open Data `inkn-q76z`), the segments coded street, bridge, boardwalk, path, step street or alley, dropping those flagged non-pedestrian: 7,413 lines across the two districts. It is a centerline file and carries no sidewalk, no width and no curb, so the 15 m band around it is ours. 164,427 of the grid's 635,175 cells are sidewalk under it, against 609,412 under the mask it replaced.

## What it assumes

- A building converts the moment the deal works, all at once, with no lender, no tenant in place and no construction period.
- Every apartment is occupied, at one household size for the whole district.
- Office workers keep a subway commuter's hours, and residents keep the national average day; nobody works from home, and nobody in a converted building works in the district.
- The traffic a building sends onto the sidewalk is proportional to its people and to the hourly change in their presence, and spreads 50 m from the building and no further.
- The model has no sidewalk dataset. A cell counts as sidewalk when it is within 15 m of a walkable street centerline and not inside a building, which is roughly a curb-to-building depth plus a lane on a side street and still too narrow for a wide avenue. The 15 m is ours and nothing measures it. Ground that is not near a street is not in the model at all: the World Trade Center memorial plaza is 47 to 99 m from the nearest walkable centerline, so nobody stands on it here.
- A building's people are spread evenly around its own perimeter, so a building with more frontage puts fewer people on each stretch of it. The map is people per 10 m of street, not people in a building; the readout on a building is where its own headcount is.
- Rents are uniform across the district, and the operating cost shares and capitalization rates are market conventions rather than measurements.
- Ground floors stay commercial. Neither 467-m nor the zoning conversion rules require it, but the Special Lower Manhattan District designates retail streets where ground-floor frontage must stay active (ZR 91-41, Map 4), and converted buildings elsewhere have generally kept their retail. The model does not draw ground floors either way.
- The state incentive is a gate (a building must meet its eligibility rules) and a tax figure in the operating cost, not a dollar benefit schedule.

## What it can't see

- Who any person is. Station counts are not split by who is riding, so treating morning arrivals as workers is the model's assumption, and residents' hours come from a national survey, not a New York count.
- Anyone who is not a subway rider or a resident of the district: ferry, bus, bike, car and foot commuters, visitors, and people who work in the district's shops, hotels and restaurants.
- Who moves in, who is displaced, or where a displaced job goes.
- Buildings the 2014 survey does not contain. Floor area is divided across the buildings on a lot, so where the survey is missing one, its area goes to the others. The World Trade Center is the case where this bites: the tax lot holds nine buildings and the survey has five, so 1 WTC is handed the floor area of 3 WTC, 4 WTC and the Oculus as well as its own. No building is allowed more than its own outline could hold at its lot's floor count, which brings 1 WTC from 98.5% of the lot to 61%, but that is a ceiling on the error rather than a correction of it: it still carries about a quarter more floor area than it has, and the 8.9 million square feet the cap removed across the district is not put anywhere else, because there is nowhere honest to put it.
- What a converted building looks like. Added floors are boxes and rents are one number.
