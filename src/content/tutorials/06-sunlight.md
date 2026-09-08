---
title: "Direct Sunlight in a Space dev notes"
date: "2026-09-07"
author: Adam Vosburgh
sequence: 6
cat: tutorial
devnotes: true
published: true
---

<!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->

Notes from building the [Direct Sunlight in a Space](/sandboxes/sunlight/) sandbox, the sixth one, and the only one whose input is a file you hand it. Pipeline: `data/scripts/sunlight.py` and `data/scripts/sunlight_3dm.py`. Component: `src/lib/sandboxes/sunlight/`. The convention a model has to follow, and how to prepare one, is [the tutorial](/tutorials/05-a-model-for-the-sun/).

![the eighth floor of 25 Water Street inside its block, cut away above the plate](/tutorials/images/06/plate-in-its-block.png#img-full)

<div class="gap">

**What a rebuild won't have.** The example model was cut out of the city's whole 3-D survey: 552 neighboring buildings inside a 3,000 ft box, each extruded as one prism per surveyed roof polygon. A rebuild should take a much smaller box, or a handful of buildings drawn by hand. Nothing else about the sandbox changes; it reads whatever geometry it is given.

</div>

## The ambition

Every architect knows that a deep floor plate in a dense block is dark, and everyone who has drawn a sun-path diagram knows roughly why. What is harder to see is how much of the darkness is the building's own shape and how much is the buildings around it, and whether the rule that is supposed to protect light and air has anything to say about either. The idea was to build one simulation that answers both at once: a picture of where the sun falls, hour by hour, and a table of the same rooms tested against the New York light-and-air rule. It also had to run any model a student hands it, because the interesting version of this question is about a building they know rather than one I picked.

## The parts

- **The city's 3-D building model**, CityGML from the 2014 aerial survey, NYC Open Data `tnru-abg2`, delivery area DA12. Gives the subject building and the 552 buildings within 3,000 ft. Each becomes one prism per surveyed roof polygon, from that building's lowest surveyed ground to the roof polygon's mean elevation, so a setback tower shadows as stacked masses rather than as a single flat extrusion.
- **NYC Building Footprints and MapPLUTO 26v2.** Used only to be sure which building is which: BIN 1000007, BBL 1000050010, 115 Broad Street, which the PLUTO row describes after the conversion at 32 floors and 1,320 units.
- **The floor plate, which is ours.** The survey knows the outline and the roof height and nothing about the inside. The 22 stories divide the surveyed 86.0 m roof evenly at 3.908 m; slabs are 0.30 m; the plate is a rectangle through the surveyed outline at 3,624 m² against the survey's 3,775 m²; the glazing is a continuous band with a sill at 0.90 m and a head at 2.40 m; the plate is cut into 34 bays 30 ft deep and about 25 ft wide; the core is one 30 m by 12 m rectangle. Every one of these is listed as ours in `data/processed/sunlight/manifest.json`.
- **suncalc 1.9.0** for the sun's position, pinned at 1.9.0 because it returns radians. Checked at the site against three positions: 21 June 13:00 EDT gives an altitude of 72.7° and an azimuth of 181.5° from north; 21 December 12:00 EST gives 25.8° and 181.4°; 21 June 08:00 EDT gives 26.4° and 80.9°.
- **New York Multiple Dwelling Law §30 and §277**, read from law.justia.com on 2026-09-06, for the room table.
- **The shadow map**, which is the whole method. For each of the 880 sun positions a year is made of, the sandbox renders a depth image of everything that casts, seen from the sun, and asks of each of the 38,326 sample points whether anything stands between it and the sun in that image. The same depth image draws the shadow you see at 14:00 and decides whether a point was lit at 14:00.

![the same floor with the neighboring buildings switched off](/tutorials/images/06/neighbors-off.png#img-full)

## Roadblocks

- Setting `visible = false` on a building takes it out of the shadow pass as well, so the first cut-away removed the towers and their shadows together. The cut-away is a clipping plane instead, with shadow clipping left off, and the one caster that straddles the plane is hidden by writing neither color nor depth.
- The partitions have no thickness, so with single-sided shadows the sun came through them from one side. They need `shadowSide` set to both faces.
- From the south-east at 45°, which is the obvious place to put a camera, 125 Broad Street fills the frame and the subject is behind it. The exterior camera now tests eight compass directions with a ray and takes the one with the longest clear line to the space.
- The obvious place for the interior camera, the center of the space, is inside the core. It stands in the largest room instead, at eye height, looking at that room's window.
- The room table read its own output. Writing the table and then counting the rows that pass, inside one reactive block, made the page rebuild the table until the framework gave up. The count is taken from a local array and the table assigned once.
- MDL §30(3) limits a room to 30 ft from its window. The example's bays are exactly 30 ft deep, but they are trapezoids that narrow towards the core, so measuring to the nearest end of the window put 28 of the 34 rooms over the limit for being exactly on it. The rule measures how far the room extends from its window wall, which is a perpendicular distance, and that is what the sandbox measures.
- The year is 880 sun positions rather than the 700 the plan estimated, because sunrise-to-sunset at ten-minute steps gives 91 steps in June and 56 in December. Each of the twelve representative days is weighted by the length of its month, and the weight is added to an integer counter rather than the count being scaled afterwards, so the arithmetic stays exact.
- The counter lives in two bytes of a color channel, read as `red × 256 + green`. The largest value a year can reach is 26,783, which fits in the 65,535 that holds. This avoids float render targets and blending extensions, so the same code runs on any WebGL2 device.
- A year is 880 shadow renders, which is well under a second on a machine with a working GPU and about thirty seconds on one that falls back to software rasterisation. The cover screenshot waits on the sandbox saying it has settled, and its old thirty-second limit sat exactly on that; it is sixty now.

## What came out

A floor plate that is, by this measure, almost entirely without direct sun, and 34 rooms that all pass the light-and-air rule anyway.

![standing in a south room on 21 December, looking out](/tutorials/images/06/interior-21-december.png#img-full)

### What you should see

<div data-sandbox="sunlight" data-mode="view" data-params='{"period":"day","day_of_year":355,"hour":12,"overlay":"hours","cutaway":true}'></div>

- At the defaults - the 8th floor, a year, the neighbors on - the mean direct sun over the whole analyzed floor is **0.08 hours a day**, no part of the floor reaches two hours a day, and the light reaches **3.0 m** from a window at the deepest.
- Switching the neighbors off raises the mean to **0.42 hours a day**, takes 6% of the floor over two hours, and pushes the deepest lit point to **5.7 m**. The difference between those two pairs of figures is what the block costs this floor.
- All 34 rooms pass §30 and all 34 pass §277, and all 34 are under the two-hour threshold. That is the figure the sandbox was built to produce: legal, and dark.
- On 21 December the sun is low enough to rake in, and the deepest lit point moves out to **8.8 m** even with the neighbors in place, though only 1% of the floor gets two hours.
- The north rooms are effectively without direct sun all year. The east and west rooms get more than the south ones at some settings, because the south is where the tall neighbors are.
- Turning the cut-away off shows why the plate cannot be seen from outside: fourteen more stories of the same building sit on top of it, and their shadows were falling on the model the whole time.

### Limitations

- Direct sun only. No sky, no reflected light, no glass. Most of the light in most rooms is not in this model, so a north room reads as dark here and may be perfectly well lit in the world. A clear-sky beam model would be the smallest next step, and it needs a cited coefficient set that this build does not have.
- The floor plate is an assumption from end to end: the floor heights, the window band, the bays, the core, the rectangle. Only the outline and the roof height are surveyed.
- A year is twelve days, one per month. It is an estimate of the year, not the year.
- Sun positions are ten minutes apart, so a sliver of sun that arrives and goes inside ten minutes is not counted.
- The color scale runs from zero to the longest day the period contains, which keeps a December figure and a June figure comparable and makes almost every interior sit at the dark end of the ramp. Hover a point to read its value, or use the two-color overlay.
- The two-hour threshold is ours. New York has no residential direct-sun standard.
- The context is the city as it was surveyed in 2014, including this building at 22 stories. The ten stories added in the conversion, and the two courtyards cut into this plate, are not in it.

---

Notes by Adam Vosburgh, Fall 2026.
