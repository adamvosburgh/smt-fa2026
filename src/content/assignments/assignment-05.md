---
title: "A Space in Sunlight"
date: "2026-09-07"
author: Adam Vosburgh
sequence: 5
cat: assignment
published: true
publish: "2026-10-08"
submit: true
accepts: [model]
sandbox_ref: sunlight
---

<!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->

### What

Model a space you know, and the buildings around it, to the convention in [Tutorial 5](/tutorials/05-a-model-for-the-sun/). Hand in the `.glb`. The gallery runs it in the [sunlight sandbox](/sandboxes/sunlight/), so what you hand in is a working simulation of your space rather than a picture of one.

Write two sentences of gallery text about what the simulation showed you that you did not already know.

### Requirements

- A space you have spent enough time in to have an opinion about its light. A room, an apartment, a floor of an office, a classroom, a shop (it does not have to be somewhere you live, and it does not have to be in New York...).
- The space modeled as surfaces, named the way the tutorial describes: one `room_` patch per room, `glazing_` to match, walls with the openings cut out, a `ceiling`.
- Enough context to cast the shadows that actually fall on it. Everything you can see out of the windows, at minimum, plus a ground plane. Massing only - a box per building is fine, and a setback is two stacked boxes.
- If your space is one floor of a taller building, the rest of that building above and below it, tagged `context_above` and `context`.
- Meters, one `.glb`, under 15MB.
- Load it into the sandbox yourself before you hand it in, using the `load a .glb from your machine` input, and check the report the sandbox prints. `untagged` should be zero and the room count should be the number of rooms you drew. If it is not, the sandbox has read your model differently from how you meant it.
- In the description: where the space is and what it is, where your context geometry came from (measured, traced off a map, guessed from photographs, all three), which parts of the model are surveyed and which are yours, and one thing the simulation gets wrong that you know from having been there.

### Either way, submit:

- the `.glb`, plus latitude, longitude, time zone and north offset in the four fields on the upload form
- a two-sentence gallery text
- in the description: the items above

If the model does not come together, upload what you have with a PDF of screenshots showing how far you got and what the sandbox reported. That counts as a complete submission.

### Submission

`Submit your work` below. It appears under [Student Work](/gallery/#assignment-05), running live. Graded on completion.

Note what the sandbox cannot see before you read too much into it: there is no sky light, no reflected light and no glass in this model, so it tells you about the direct beam and nothing else. A north room that reads as black here can be a pleasant room. The interesting question is usually not "is it dark" but "how much of this is the building's own shape and how much is the buildings next door" - which is the switch that turns the neighbors off.

### Starting points

- [Tutorial 5](/tutorials/05-a-model-for-the-sun/) has the naming convention, the Rhino export settings, and a Blender equivalent.
- The [example model](/data/sunlight/example-f08.3dm), as a Rhino file, with the layers and object names in it.
- [NYC 3-D Building Model](https://www.nyc.gov/site/planning/data-maps/open-data/dwn-nyc-3d-model-download.page), if your space is in New York and you would rather cut your context out of the survey than draw it.
- The [data sources](/resources/data-sources/) page.
