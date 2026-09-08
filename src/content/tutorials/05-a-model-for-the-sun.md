---
title: "Preparing a model for the sunlight sandbox"
date: "2026-09-07"
author: Adam Vosburgh
sequence: 5
cat: tutorial
published: true
publish: "2026-10-08"
---

<!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->

This module covers preparing a 3D model so that the [sunlight sandbox](/sandboxes/sunlight/) can run a sun study on it. We will not write any code. We will build geometry in Rhino, name the objects, export one file, load it into the sandbox, and read what the sandbox says it found. After this you will be able to take any space you can model and find out where the sun actually reaches inside it.

The sandbox is one of the seven on this site, and it is the only one where the thing you hand in is a model rather than a set of parameters. That is the reason for this tutorial: the sandbox will read almost anything, but it can only tell you something useful if it can tell your floors from your walls and your walls from the buildings next door.

<div class="gap">

**What the class version has that yours won't.** The example that ships with the sandbox has 552 surveyed neighboring buildings around it, pulled out of the city's 3-D building model. You are going to draw a handful of neighbors by hand. That is enough - the buildings that shade a space are almost always the ones you can see out of its windows - and the method is identical either way.

</div>

## What the sandbox reads

The sandbox splits your model in two.

The **context** is everything that casts a shadow and that you are not studying: the buildings around your site, the ground, and the rest of your own building above and below the floor you care about. It is drawn in gray and it gets no numbers.

The **space** is the room or the floor the study is about. Its floors, walls and ceiling get a grid of sample points, and each point is asked, for every sun position in the period, whether the sun reached it.

It tells the two apart by **name**. Here is the whole convention.

| Name starts with | What it is | Casts a shadow | Analyzed |
| --- | --- | --- | --- |
| `context` | the neighbors, the ground, anything else outside the study | yes | no |
| `context_above` | your own building above the floor you are studying | yes | hidden by the cut-away |
| `space` | a group holding the parts below | — | — |
| `room_01`, `room_02`, … | one floor patch per room; each becomes a row in the room table | no | yes |
| `floor` | floor that belongs to no room - a lobby, a corridor | no | yes |
| `ceiling` | the underside of the slab above | no | yes |
| `wall`, `core`, `partition` | anything opaque inside the space | yes | yes |
| `slab` | the slabs themselves | yes | no |
| `glazing_01`, `glazing_02`, … | the glass; `01` ties it to `room_01` | **no** | no |
| anything else | treated as context, and counted as untagged in the report | yes | no |

Four things about that table are worth saying out loud.

**Glazing does not cast a shadow.** The sandbox has no glass in it; a window is a hole. This is a simplification and it is the largest one in the model: real glass transmits about nine tenths of a direct beam that hits it square on, and much less at a shallow angle.

**Slabs cast, and the surfaces 1 cm off them are what gets analyzed.** That is why there are separate `slab` and `floor` tags. If you model your floor as a single flat surface with nothing above it, tag it `room_01` or `floor` and it will be analyzed but will cast nothing, which is what you want for a single-story study.

**Matching is on the start of the name, case-insensitive.** `Room_01`, `room_01_living`, and `ROOM_01` all work. `living_room_01` does not, because the name does not start with `room`.

**It checks three names, in order: the object's name, then the mesh's name, then the material's name.** The first one that matches wins. Exporters disagree about which of the three a Rhino object name ends up in, so the sandbox checks all three rather than making you find out which.

## Units and axes

**Meters.** Set your Rhino model units to meters before you draw anything. If you have already drawn in feet, use `Scale` rather than changing the unit setting, or check the result against the bounding box the sandbox reports.

**Build with +Y pointing north**, which is the default in a Rhino top view. Rhino's glTF exporter, with `Map Rhino Z to glTF Y` switched on, turns Rhino's `(x, y, z)` into glTF's `(x, z, -y)`, and the sandbox reads that as +X east, +Y up, −Z north. If you build north-up you can leave the `North offset` control at zero.

If your model is not north-up - because you built it along a street grid, say - do **not** rotate the geometry. Put the angle in the `North offset` control instead and it rotates the sun rather than the model. That way the model you hand in is the model you drew.

**The origin can be anywhere.** The sandbox does not use it. Where on earth your model sits comes from the `Latitude` and `Longitude` controls, which you set when you hand the file in.

## The two parts

### The context

Draw the neighbors as **closed massing**, low detail. A box per building is fine. If a building has a setback, draw it as two or three stacked boxes rather than as one; the shadow of a setback tower is noticeably different from the shadow of a flat extrusion of its footprint, and stacking is the cheapest way to get that.

Include everything that could shade your space. In a dense block that is everything you can see out of the windows and then some. On a low floor that is the buildings across the street; on a high floor it is the towers three blocks away. If you are not sure, put it in: an extra box costs nothing and a missing one silently makes your space brighter than it is.

Draw a **ground plane** under all of it, tagged `context`, a few hundred meters across. Without one, the shadows fall into nothing and the picture is hard to read.

If you are studying one floor of a taller building, model **your own building above and below that floor too**. Below the floor, tag it `context`. Above the floor, tag it `context_above` - that is the tag whose only difference is that the cut-away view hides it from the camera while still letting it cast. Without it you get a floating slab in a city, which looks fine and is wrong.

### The space

Model the space as **surfaces, not solids**:

- One **floor patch per room**, named `room_01`, `room_02` and so on. If you have one big open floor with no rooms in it, one `floor` surface is enough - you just will not get a room table.
- The **walls with openings where the glass goes**. In Rhino, draw the wall as a surface and `Trim` the window openings out of it. A wall with the openings still in it stops the sun from reaching anything.
- The **glass as its own surfaces**, one per opening, named `glazing_01` to match `room_01`. If a room has three windows, name all three `glazing_01`; they will be added together. A glazing surface whose number matches no room gets attached to the nearest room's floor patch if it is within a meter, and otherwise reported as unmatched.
- A **ceiling** surface across the space.
- Anything else opaque inside the space - a core, a partition, a column - named `core`, `partition` or `wall`.

Zero-thickness surfaces are fine and are what the example uses. The sandbox draws them from both sides and casts shadows from both sides.

## Naming

Do the naming with the Rhino `Properties` panel, in the `Name` field, one object at a time. It is tedious and it is the part that decides whether any of this works.

A worked set of names, for one floor of a building with six rooms:

```
context_neighbour_01 ... context_neighbour_09
context_ground
context_below
context_above
room_01 ... room_06
glazing_01 ... glazing_06
wall_corridor
core
ceiling
floor_lobby
slab_floor
slab_ceiling
```

You do not need layers for the sandbox to work, but organising by layer makes selecting things for export much easier, and Rhino's exporter can write layer names out too.

## Meshing and export

In Rhino 8: `File` > `Export Selected`, choose `glTF Binary (*.glb)`, and in the options dialog:

- **`Map Rhino Z to glTF Y`** — on. This is the one that makes the axes come out right.
- **`Export materials`** — on.
- **`Export Layers`** — on.
- **`Export open meshes`** — on. Your walls and floors are open surfaces and without this they do not come out.
- **`Use Draco compression`** — off. It makes a smaller file and the sandbox does not read it.

Two things to check before you export.

**NURBS surfaces become meshes on the way out.** Rhino meshes them with whatever your document's render mesh settings are, and the default settings on a large flat surface can give you a mesh with an unhelpful number of triangles. `Mesh` your geometry yourself first if you want to know what you are getting.

**The file has to be under 15MB**, which is the submission cap. If you are over it, the context is almost always the reason. Cut the number of neighbors, or simplify them to boxes, before you touch the space.

> **For Adam to confirm before this is final:** this section tells students to name the objects. If the Rhino exporter turns out to drop object names into the mesh or material slot instead, the instruction changes to "name the materials" and nothing else in the tutorial or the sandbox changes, because the classifier accepts all three. Load `example-f08.3dm`, export it with the options above, and read the input report.

## Checking

Open the [sunlight sandbox](/sandboxes/sunlight/). Under the camera buttons there is a **`load a .glb from your machine`** input. It reads your file straight into the page and uploads nothing, so use it as many times as you like.

Load your file and read the panel in the top right, which says what the sandbox found:

```
context 555, rooms 34, floor 1, ceiling 1, walls/core/partitions 38,
glazing 34, untagged 0; space 90.5 × 3.9 × 60.8 m
```

That is the example's report, and it is what to compare yours against. Go through it in order:

- **`untagged` should be 0.** Anything untagged is being treated as context: it casts shadows and gets no numbers. If the count is not zero, a name is wrong.
- **`rooms` should be the number of rooms you drew,** and `glazing` should usually match it. If the report says a pane could not be matched to a room, its number is wrong.
- **The bounding box should be the size of your space in meters.** If it says 297 × 13 × 199 you exported in feet. If it says 3,000 × 200 × 2,000 you have tagged a neighboring building as part of the space.

Then look at the room table, at the bottom left. The floor and glass areas there are measured off the triangles in your file, so if a room's floor area is not the area you drew, the sandbox and Rhino are looking at different geometry.

Two downloads to compare against: [`example-f08.glb`](/data/sunlight/example-f08.glb) is the file the sandbox loads by default, and [`example-f08.3dm`](/data/sunlight/example-f08.3dm) is the same model as a Rhino file, with the layers and object names in it. Open the Rhino one and look at how it is put together.

## Blender instead

Blender's glTF exporter writes an object's name into the glTF node's name, which is the first thing the sandbox checks. So the same names work: name your objects `room_01`, `glazing_01`, `context_tower`, and export with `File` > `Export` > `glTF 2.0`, format `glTF Binary (.glb)`, with `+Y Up` on and Draco off. Under `Include`, tick `Selected Objects` if you only want part of the scene, and under `Data`, leave `Custom Properties` alone.

The one thing to watch is that Blender's `Apply Modifiers` is on by default. If your neighbors are boxes with a Solidify or Array modifier, that is what you want. If your walls are single-sided planes, check that nothing has thickened them.

## Handing it in

[Assignment 5](/assignments/assignment-05/) takes the `.glb` and runs it. Along with the file you give it four numbers about where your model is: latitude, longitude, time zone and north offset. The sandbox works out everything else from the geometry, but it has no way of knowing where on earth you drew it.

Latitude and longitude to four decimal places is about ten meters, which is far more precision than a sun study needs. Read them off any map.

---

Module by Adam Vosburgh, Fall 2026.
