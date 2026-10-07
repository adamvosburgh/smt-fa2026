# What this is

A simulation of where direct sunlight falls inside one floor of a building in a city. The example is the eighth floor of 25 Water Street in Lower Manhattan, as the city's 2014 aerial survey recorded the building, with the 552 surveyed buildings within 3,000 feet standing around it.[^survey] The building was a 22-story office block then; from 2023 it was converted to about 1,300 apartments, with ten stories added and two courtyards cut into the floor plate.[^building] The sandbox shows the plate before that.

It computes direct sun and nothing else. There is no sky, no light reflected off the buildings opposite or off the floor, and no glass: a window is treated as a hole. The number it reports is hours of direct sun per day, not a daylight measure.

The floor plate itself is not survey data. The survey knows the outline of the building and the height of its roof, and nothing about what is inside it. Everything from the floor heights to the position of the core is ours, and the section on what it assumes lists it.

The same page runs any model prepared to the naming convention in the tutorial, so a student's own building goes in the same machinery.

[^survey]: NYC Department of City Planning 3-D Building Model, CityGML 2.0, NYC Open Data `tnru-abg2`, from a 2014 aerial survey. Delivery area DA12. Each building is extruded as one prism per surveyed roof polygon, from that building's lowest surveyed ground elevation to the roof polygon's mean elevation, so a setback tower shadows as stacked masses rather than as one flat extrusion. The survey has no windows, no floors and no interiors in it.
[^building]: 25 Water Street, formerly 4 New York Plaza. Carson Lundin & Shaw, 1969, 22 stories, about 1.1 million square feet (Wikipedia, read 2026-09-06). CetraRuddy's conversion and the two courtyards: New York YIMBY, July 2023, read 2026-09-06. The building is BIN 1000007, BBL 1000050010; the MapPLUTO 26v2 row for that lot describes the converted building, at 32 floors and 1,320 units.

## What it's trying to show

- Where the sun reaches inside a deep floor plate in a dense block, hour by hour and across a year, rather than as one annual figure.
- How much of that is the neighbors' doing. Turning the surrounding buildings off recomputes the whole thing without them, and the difference between the two figures is what the block costs this floor.
- That a room can meet the letter of New York's light-and-air rule and still receive very little direct sun. The rule is a ratio of window area to floor area. It is calculated in the room table beside the sun figures, and it never looks out of the window.

## How it works

- The sun's position comes from the date, the time and the coordinates.[^suncalc] Local civil time is converted to an instant using the browser's own time-zone data, so daylight saving is handled and no offset is written down anywhere.
- For each sun position, the sandbox renders a depth image of everything that casts a shadow, seen from the sun. A point on a floor, wall or ceiling is lit at that moment if nothing stands between it and the sun in that image, and if the surface faces the sun at all. The same depth image draws the shadow you see and decides the number.
- Sun positions are taken every ten minutes from sunrise to sunset. A year is estimated from twelve days, the 15th of each month, each weighted by the length of its month: 880 sun positions in all. A month is its 15th; a day is the day on the clock.
- Whatever the period, the figure is reported per day, so a December figure and a June figure can be compared.
- The colored squares are one per sample point, lying in the surface, spaced at the sample spacing on the panel. They can show hours per day, the same figure as a share of the period's daylight, or simply whether a point is above or below a threshold.
- Each room is tested against one of the two New York rules.[^mdl] Section 30 asks for window area of at least one tenth of the room's floor area, with every window at least 12 square feet. Section 277, the section for converting a building that was not residential, asks for ten per cent under 500 square feet of floor area, one percentage point less for each additional 100 square feet, and never less than five per cent. The 30-foot depth limit in section 30(3) is a separate switch, because the statute applies it only to apartments of three rooms or fewer and the sandbox does not know how the rooms are grouped.

[^suncalc]: suncalc 1.9.0, which implements the low-precision solar position formulae in Jean Meeus, *Astronomical Algorithms*. Checked against three positions at the site: 21 June 13:00 EDT, altitude 72.7° and azimuth 181.5° from north; 21 December 12:00 EST, 25.8° and 181.4°; 21 June 08:00 EDT, 26.4° and 80.9°. Version 1.9.0 returns radians. Version 2.0.2, published in September 2026, returns degrees and is not interchangeable.
[^mdl]: New York Multiple Dwelling Law §30(8)(a), §30(3) and §277, read from law.justia.com and newyork.public.law on 2026-09-06. One caveat travels with §277: the text read gives an eligibility date of 1 January 1977 for buildings occupied non-residentially, and the widely reported 2024 change to 31 December 1990 was not visible in either mirror. That change is unverified here. The sandbox applies no eligibility test at all, only the ratio.

## What it assumes

Everything in this list is ours, not surveyed, and all of it is recorded in `data/processed/sunlight/manifest.json`.

- The 22 stories divide the surveyed 86.0 m roof evenly, giving a floor-to-floor height of 3.908 m. Slabs are 0.30 m, so a room is 3.31 m tall.
- The floor plate is a rectangle drawn through the surveyed outline, 3,624 m² against the survey's 3,775 m². The outline has jogs of up to 3.6 m at the two short ends, and the rectangle passes through the middle of them rather than outside.
- Glazing is a continuous band on all four sides, with a sill 0.90 m and a head 2.40 m above the finished floor. The real 1969 facade is strip windows with spandrels and has not been measured.
- The plate is divided into 34 bays 30 feet deep and about 25 feet wide, each treated as one room, with a corridor wall and a side partition. The four corner bays are trapezoids.
- The core is a single 30 m by 12 m rectangle in the middle of the plate. The real core is not in any public dataset.
- A year is twelve days, one per month. That is an estimate, not the year.
- Sun positions are ten minutes apart. A shorter step would find slivers of sun that this one steps over.
- The two-hour threshold is ours. New York has no residential direct-sun standard to take a number from.
- Every surface is opaque and every window is an opening. Glass transmits about nine tenths of the direct beam at normal incidence and much less at a low angle, and none of that is modeled.

## What it can't see

- Sky light and reflected light, which is most of the light in most rooms. A north-facing room reads as dark here and may be perfectly comfortable in the world.
- Glass, curtains, blinds, mullions, trees, awnings, and the reflectance of the ground and of the buildings opposite.
- Anything built, demolished or altered since the 2014 survey, including the ten stories added to this building.
- The real floor heights, the real core, the real facade and the real partitions, none of which are public.
- Who lives in which room, what any of it costs, and which rooms face the harbour.
- The two courtyards cut into this plate during the conversion, which is where the light in the converted building now comes from, and which would be a reasonable place for a student to start.
