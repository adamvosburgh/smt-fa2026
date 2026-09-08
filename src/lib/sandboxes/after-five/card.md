## What this is

A three-dimensional map of Lower Manhattan (Community District 1) with every building drawn from the city's survey at its real height.[^citygml] Office buildings are blue; when the model decides one would convert to housing it turns red. A year control steps through six dates from 2025 to 2050. An hour control runs a day: figures walk between the subway stations and the buildings on a schedule taken from counted ridership,[^mta] and the streets are colored by how many of them are on each block. Midtown South (CD5) is included for comparison.

The subject is what conversion would do to a district, not whether it pays. The deal is in the model because nothing converts without one.

[^citygml]: DCP 3-D Building Model as CityGML (NYC Open Data `tnru-abg2`), delivery areas 12 and 19: 1,159 buildings in CD1 with BINs, ground outlines and every roof surface at its own height, surveyed in 2014. The Rhino version of the same survey carries no identifiers, which is why the CityGML is used.
[^mta]: MTA Subway Origin-Destination Ridership Estimate 2024 (data.ny.gov `jsu2-fbtj`), aggregated server-side to arrivals at and departures from the district's complexes by hour, October 2024 weekdays. A check against the MTA's hourly ridership file (entries only): Lower Manhattan complexes record about 2.5 times as many entries at 17:00 as at 08:00, as a jobs district should.

## What it's trying to show

- Two counts and what conversion does to them: people working in the district by day and people living there.[^counts] At the settings where anything converts, the model trades a few thousand office jobs for a few thousand residents, roughly one for one.
- How few of the numbers in the conversion argument are published. The deal turns on office rent, residential rent and conversion cost; only the first has a source, and at that figure nothing converts before 2050.
- What conversion does to a street rather than to district totals: each segment is colored by how many walkers cross it in the selected hour, and two hours can be compared side by side.
- That the effect depends on the district. At the $41 rent stop in 2035 the model converts 59 of Lower Manhattan's 381 office buildings and 201 of Midtown South's 1,437; by 2050, a third against more than half. Midtown South holds a job in 324 sf where Lower Manhattan uses 490, so its conversions remove nearly two office jobs per resident housed. Model figures at our rent stop, not measurements.

[^counts]: Jobs: LEHD LODES 8 Workplace Area Characteristics, New York, 2023, by census block, joined through MapPLUTO's `BCTCB2020`: 198,677 office-using jobs in CD1, 667,498 in CD5. Residents: 2020 decennial census by tract: 85,841 in CD1, 92,438 in CD5. Manhattan's tracts sum to 1,694,251, the published county count.

## How it works

- **Buildings.** Floor area, office area, floors, year built and depth from MapPLUTO, joined by BBL; lot areas are split across the buildings on a lot.[^pluto]
- **Gate one, shape.** A score from four proxies (depth halved, height per floor, area per floor, year built), weighted 0.35/0.25/0.20/0.20 and tested against a threshold. Three published criteria (window operability, elevator count, structural bay) are left out because nothing measures them.[^gensler] The legend marks where the threshold would sit to call a quarter of the district convertible, the one figure the consultancy published.
- **Gate two, the deal.** Residential rent and office rent are each turned into a value with a capitalization rate; if the residential value less conversion cost beats the office value, the deal clears. Office rent defaults to $54/sf asking.[^rent] Conversion cost scales with how badly the building scores. The state tax exemption's eligibility tests apply if switched on.[^467m]
- **The clock.** The deal is tested at six dates; office rent drifts by the trend control between them and residential rent doesn't; a building converts at the first date it clears. With the trend at zero nothing changes over time.
- **Units and people.** Floor area becomes apartments at 1,152 sf each,[^dob] residents follow at the borough's average household size, and the office jobs on that floor area are subtracted.
- **The crowd.** Walkers move on the street network[^cscl] between subway complexes[^entrances] and buildings. Station flows per hour are measured; the building each trip goes to (proportional to jobs) and the route (shortest path) are assumed, and the canvas labels which is which. Morning arrivals and evening departures are treated as workers, the reverse flows as residents. An independent survey of where office workers are by hour is drawn as a check.[^atus]
- **The residents' day.** By default residents leave and return on curves from the same survey's weekday diaries of people not employed,[^atusres] which puts them on the street through the day; a control switches them to a mirror of the workers' commute, which is all the subway counts alone can say.
- **The street.** Each routed trip is counted onto the segments it walks, per hour, and streets are colored and widened by that count. A toggle compares two hours and colors streets by the difference. Clicking a segment puts the camera on it at eye height. The counts are routed trips, not people observed.
- **Ground floors.** A converted building's ground floor is drawn active or dark by a probability set on a slider. The probability is ours; no dataset here records ground-floor use at building resolution.

[^pluto]: MapPLUTO 26v2. Giving each building its lot's whole office area produced 112 million sf; dividing gives 78 million, against a published figure of roughly 90 million for Lower Manhattan.
[^gensler]: Gensler's published office-to-residential convertibility criteria. The scoring is proprietary; the public figure is that about a quarter of the 1,300-plus buildings they scored came out suitable.
[^rent]: NYC Comptroller, *Spotlight: NYC's Office Market*, 14 May 2024, CoStar data as of 30 April 2024: $54/sf/yr asking, Manhattan Class B and C combined. Pinned to that edition because the November 2025 report stopped publishing rent by class. The other three stops on the control ($41, $32, $70) are ours and say so.
[^467m]: RPTL 467-m as published by HPD. Eligibility tests are in the FAQ (90% non-residential before, six or more units, a quarter affordable, commenced 2023-2031); the benefit schedule is not, so the exemption is a gate rather than money.
[^dob]: DOB Job Application Filings (`ic3t-wcy2`), 2001-2025: 149 filings where a Manhattan building with no apartments became one of ten or more units, 15.6 million sf over 13,506 units. The filing records the whole building's area, so the unit floor is a control with six measured stops (1,366 sf with no floor, 907 at fifty units and up). DOB NOW certificates of occupancy (`pkdm-hqz6`) supply recent conversions, with renewals excluded.
[^cscl]: NYC Street Centerline (`inkn-q76z`), clipped and filtered to walkable segments.
[^entrances]: MTA Subway Entrances and Exits 2024 (`i9wp-a4ja`). A complex's flow is split evenly across its stairs.
[^atus]: American Time Use Survey 2003-2025 (BLS): share of management, business, financial and professional workers at their workplace by hour.
[^atusres]: The same ATUS files: weekday diaries of respondents who are not employed, weighted with `TUFNWGTP`, giving when they leave home and return by hour. A national survey, not a New York count.

## What it assumes

- Conversion is instant, with no construction period or tenants to move.
- Rents are uniform across the district, and only office rent moves over time.
- The convertibility score is ours, misses three criteria, and also drives conversion cost.
- The office rent control has one sourced stop ($54) and three of ours.
- The two capitalization rates default equal and are market convention, as is the operating-cost share; no published series was verified for any of them.
- The tax exemption is permission, not money.
- Added floors are a story count drawn as a block on the roof, and only for buildings from the older filing system, which recorded heights.
- Residents come from units times Manhattan's average household size.
- A displaced office job is a subtraction (about one per 490 sf in CD1), not a person who goes somewhere.
- The crowd's roles are attributed, not counted, and only the subway is a gateway because only the subway was counted.
- Residents' default hours come from a national survey of people not employed, applied to a Manhattan district.
- A converted ground floor is active at a probability we chose; nothing measured stands behind it.
- The model isn't validated against history: the planned 1995 back-test couldn't run because filing data starts in 2000.

## What it can't see

- Who any walker is; the crowd is a sample drawn from turnstile counts.
- Who moves into a converted building, who is displaced, or what a ground floor is used for; the active-or-dark edge is a slider, not a record.
- Anyone arriving by ferry, bus, bike or car.
- Anyone actually on a street: the segment counts are routed trips, and the eye-height view is a camera move over the same assumptions.
- Whether a filing became a building; some recorded conversions never happened.
