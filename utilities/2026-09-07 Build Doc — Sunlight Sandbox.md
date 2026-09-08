---
title: Build Doc — the sunlight sandbox
date: 2026-09-07
type: content
---

# Build doc: the sunlight sandbox

For Claude Code. Written 2026-09-07 in Cowork after Adam's brief of 2026-09-06. It replaces the sunlight section of `2026-08-30 Sandboxes.md` and the note `2026-09-06 Notes — Sunlight Sandbox Feasibility.md`; where they disagree, this document is later.

**Every asset this build needs is already in the repo.** Nothing is downloaded, nothing is fetched at build time, and no dataset is invented. The one dataset is the city's 3D survey, already on disk for the conversion sandbox; the pipeline that turns it into the example model has been run and its outputs are committed under `data/processed/sunlight/`. Claude Code writes the site code, the schema, the card, the dev notes, the tutorial draft and the assignment page. It makes no design decisions: every control, default, name, camera rule and metric is fixed below. Where something is left to Adam it is marked **ADAM**, and none of those items blocks the build.

Read first: `CLAUDE.md`, `src/lib/sandboxes/bathtub/` (the contract), `src/lib/sandboxes/after-five/AfterFive.svelte` (dynamic import of a heavy library, the clock rules), `src/lib/components/SandboxFrame.svelte`, `transport.svelte.js`, `ParamPanel.svelte`, `src/routes/gallery/[student]/[sandbox]/+page.svelte`, `src/lib/server/validate.js`, `src/lib/components/AssignmentSubmit.svelte`, and `data/processed/sunlight/manifest.json`.

Prose rule, unchanged: every prose file is a draft for accuracy, first line `<!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->`, in the register set 2026-09-05 (explanatory, no clever lines, footnoted citations, experiments not policy tests). Flat prose is not permission to write less of it.

---

## 0. What the sandbox is

A direct-sunlight simulation of a space inside a city. A 3D model is split into two parts: the **context** (everything that casts shadows and is not studied) and the **space** (the geometry the study is about). The sandbox shows where the sun falls right now, as light and shadow you can scrub through a day and through the year; and it shows, as a grid of coloured squares on the space's surfaces, how much direct sun each spot receives over a period. The light-and-air rules of New York's Multiple Dwelling Law appear as a table and a flag per room, not as a colour on the model.

The class example is one floor of 25 Water Street, Lower Manhattan, as the 2014 survey recorded it, before its conversion to apartments. Any model prepared to the same convention runs in the same sandbox, and students hand one in through an assignment. The example model is downloadable, in glTF and in Rhino form, and a tutorial describes how to prepare one.

Working title, in `meta.js` only: **Direct Sunlight in a Space**. **ADAM** picks the final title; nothing else depends on it.

The register for the assistant and the card: this is an experiment in seeing where sunlight goes. It computes direct sun hours, not daylight. It has no sky, no reflection, no glass transmission, no lux. The card says so in the first section.

---

## 1. Assets on disk (verified 2026-09-06 / 07)

`data/processed/sunlight/`, written by `data/scripts/sunlight.py` (run time 7 s on the DA12 CityGML), mirrored to `static/data/sunlight/` by `npm run sync`, which already lists `sunlight`:

| File | What |
| --- | --- |
| `example-f03.glb`, `example-f08.glb`, `example-f15.glb` | The example model, one file per analysed floor (3rd, 8th, 15th of 22). Same context in each. 3.26 MB each. glTF 2.0 binary, validated with the Khronos validator: 0 errors, 0 warnings. 665 nodes, 663 meshes, 86,582 triangles, no normals (flat shading), no textures. |
| `example-f08.3dm` | The 8th-floor file as a Rhino 8 model, written with rhino3dm: 663 meshes, layers `context`, `space`, `space::rooms`, `space::glazing`, `space::walls`, `space::surfaces`, object names equal to the glTF node names, metres, Z up, a text dot at the origin with the site's latitude and longitude. 2.2 MB. For the tutorial download and for Adam's exporter test (§8). |
| `manifest.json` | Site, origin, axes, floor heights, every geometric assumption with who made it, the 34-room table with floor and glazing areas, the tag convention, the MDL numbers with sources, provenance. Read it; the browser's room areas are checked against it in §7. |

Scripts: `data/scripts/sunlight.py` (standard library + numpy; its docstring is the pipeline's record), `data/scripts/sunlight_3dm.py` (GLB → 3dm; needs `pip install rhino3dm`). Neither needs to be run again.

Libraries to add, exact pins: **`three@0.185.1`** (MIT) and **`suncalc@1.9.0`** (BSD-2-Clause). Not 2.x of suncalc: 2.0.2, published September 2026, returns degrees where 1.9.0 returns radians and its npm metadata lacks a licence field. Load three with a dynamic `import()` inside the component, the way After Five loads deck.gl, so SSR never sees it. `three-mesh-bvh` is not used; the earlier note proposed it and this document drops it.

### The subject

25 Water Street (formerly 4 New York Plaza), Carson Lundin & Shaw, 1969, 22 storeys, about 1.1 M sf; from 2023 converted by CetraRuddy to about 1,300 apartments with ten storeys added and two courtyards cut into the plate. BIN 1000007, BBL 1000050010, PLUTO address 115 Broad Street (Block 5 Lot 10, 32 floors and 1,320 units in the 26v2 row, which describes the building after conversion). Identity verified three ways; see the pipeline docstring. Site: 40.702615 N, 74.010687 W. Footprint 3,775 m² in the survey; PLUTO 148 ft × 276 ft. Main roof 86.0 m.

### The example model's geometry

Local metres. In the file, +X is east, +Y is up, **−Z is north** (the Y-up transform Rhino's exporter applies with *Map Rhino Z to glTF Y*: Rhino (x, y, z) → glTF (x, z, −y)). Origin: the centre of the subject's ground ring at ground level.

Context: 552 neighbouring buildings within a 6,000 ft box, one prism per surveyed roof polygon from that building's ground elevation to the roof's, so setback towers shadow as stacked masses rather than flat extrusions; a 1,800 m ground plane at −0.05 m; and the subject's own storeys below the analysed floor (`context_subject_below`, the surveyed outline extruded from 0 to the floor's slab) and above it (`context_above_subject`, every roof polygon extruded up from the ceiling).

Space: the plate reduced to a rectangle through the surveyed outline's four sides (3,624 m²; the survey's 3,775 m² includes jogs of up to 3.6 m at the two short ends, which the rectangle passes through the middle of, never outside). Floor n occupies [(n−1)·3.908 m, n·3.908 m]; slabs 0.30 m; room height 3.31 m. A continuous glazing band on all four sides, sill 0.90 m and head 2.40 m above the finished floor. 34 bays 9.14 m deep and about 7.5 m wide (11 on each long side, 6 on each short side; corner bays are trapezoids with the mitre as their inner corner), each a closed room: a floor patch `room_NN`, a glazing pane `glazing_NN`, a corridor wall and one side partition `wall_room_NN`. A 30 m × 12 m core `core` centred on the plate. The floor between bays and core is `floor_interior` (1,283 m²). A `ceiling` surface across the whole plate. Analysed surfaces float 1 cm off the slabs. Everything in this paragraph is an assumption and is listed as ours in `manifest.json` → `assumptions`; the room table gives floor 61.33 m², glazing 11.31 m², ratio 0.184 for the 22 bays on the long sides (rooms 01–11 north, 18–28 south) and floor 52.68 m², glazing 10.93 m², ratio 0.207 for the 12 on the short sides (12–17 west, 29–34 east). Bays run counter-clockwise from the north-east corner.

---

## 2. The model contract (what any uploaded file must follow)

This is the input contract for students. It is deliberately tolerant so it survives exporters that rename things.

**File:** one `.glb` (glTF 2.0 binary, everything embedded), metres, at most the 15 MB submission cap. Y-up as glTF requires; **−Z is north** unless the `north_deg` control says otherwise.

**Tags** are matched by **prefix, case-insensitive**, on the node name first, then the mesh name, then the material name. The first match wins. A mesh is *in the space* if it or any ancestor node is tagged `space`, or if its own tag is one of the space tags.

| Tag | Role in the shadow pass | Analysed (gets sample points) | Drawn |
| --- | --- | --- | --- |
| `context*` | casts and receives | no | opaque grey |
| `context_above*` | casts and receives | no | hidden from the camera when the cut-away is on |
| `space` | group | — | — |
| `room_<id>` | does not cast | yes, one row in the room table | pale, coloured by the overlay |
| `floor*` | does not cast | yes | pale, coloured by the overlay |
| `ceiling*` | does not cast | yes | pale, coloured by the overlay |
| `wall*`, `core*`, `partition*` | casts and receives | yes | off-white |
| `slab*` | casts and receives | no | off-white |
| `glazing_<id>`, `glazing*` | **does not cast** (the sun passes through) | no | translucent blue, 30 % opacity |
| anything else | as `context` | no | grey, counted as untagged in the input report |

A glazing pane belongs to the room whose `<id>` it shares; a pane with no matching room belongs to the room whose floor patch is nearest to it in plan, within 1 m, else to none. Rooms with no glazing get a ratio of 0.

**The input report.** After loading, the sandbox writes a short report into the panel, above the controls, and into `onmetrics`: meshes tagged context, rooms, floor, ceiling, walls, glazing, untagged; the space's bounding box in metres (three figures); total analysed area in m²; and one line per problem: no `space` found, no analysed surfaces, glazing with no room, untagged meshes, a bounding box under 1 m or over 500 m (probably the wrong units). For `example-f08.glb` the report reads: **context 555, rooms 34, floor 1, ceiling 1, walls/core/partitions 38, glazing 34, untagged 0; space 90.5 × 3.9 × 60.8 m** (the 555 is 552 buildings + below + above + ground). This report is the student's check that their model was read as they meant it, so it is not optional and it is not hidden.

---

## 3. The scene

One three.js scene, one `WebGLRenderer` with shadow maps on, mounted in the frame's viewport, resized with it. Colour management default. Background a flat light grey. A `HemisphereLight` for fill and one `DirectionalLight` for the sun.

**Loading.** `GLTFLoader` from `three/addons`. The file comes from `assets.model` when the frame passes one (a student's upload), otherwise from `${dataBase('sunlight')}/example-f${floor}.glb` where `floor` is the `example_floor` control. After load: tag every mesh per §2; set `material.side = DoubleSide` and `material.shadowSide = DoubleSide` on every space material (the walls have no thickness; single-sided depth would let the sun through them); merge all `context*` meshes into one `BufferGeometry` for drawing and shadow casting (663 draw calls × 700 accumulation passes is too many; one merged context mesh and one merged opaque-space mesh are fine), keeping the `context_above*` set as its own merged mesh so it can be hidden. Keep every analysed surface as its own mesh, because rooms are picked and coloured individually. Report `onready(false)` while loading and while the accumulation runs; `onready(true)` when the first accumulation has finished and been drawn. The frame's clock does not advance while not ready; that is the existing rule.

**The sun.** Position from `suncalc@1.9.0` `getPosition(date, latitude, longitude)`, which returns radians: `altitude`, and `azimuth` measured from south, positive towards west. Azimuth from north clockwise is `azimuth + π`. Direction *towards* the sun, in the file's axes:

- east component = sin(azN) · cos(alt)
- north component = cos(azN) · cos(alt)
- up component = sin(alt)
- glTF vector = (east, up, −north), then rotated about +Y by `north_deg`.

The light sits at the space's centre plus 600 m along that vector, targeting the centre. Below the horizon: no direct light, the hemisphere light dims to a night level, the accumulation skips the step.

**Time.** The `hour` control is local civil time in the `timezone` control's zone; `day_of_year` is a day in 2026. Build the UTC instant with `Intl.DateTimeFormat` in that zone (find the UTC time whose wall-clock reading in the zone equals the requested one; two iterations converge, and daylight-saving changes are handled by the zone data). Do not hard-code an offset.

**Shadow camera.** Orthographic, fitted each frame to the space's bounding box seen from the light plus a 60 m margin on each side so the neighbours' shadows fall on the ground around it; 4096 × 4096 map; `bias −0.0005`, `normalBias 0.05` (these numbers were used in the check renders and gave clean interiors). For the accumulation pass fit the frustum to the space's box with a 2 m margin: the metric needs precision on the analysed surfaces only.

**Cut-away.** When `cutaway` is on, set `renderer.clippingPlanes` to one plane at the space's ceiling height + 0.2 m facing down, hide `ceiling*` and `slab_ceiling*` (and `context_above*`) from the camera, and leave `material.clipShadows` false everywhere. Verified 2026-09-06 in a headless render: everything above the plate disappears from the camera, including the neighbours, while their shadows still fall across the model. This is the view that shows the plate inside its block. **Never** hide a shadow caster with `visible = false`; that removes it from the shadow pass too. If something must be invisible but still cast (the ceiling when the cut-away is off but the user wants to look in from above), give it `colorWrite = false` and `depthWrite = false` instead.

**Materials.** Context grey (0.72, 0.71, 0.68); space opaque off-white (0.93, 0.92, 0.89); analysed surfaces near white, replaced by the overlay colour when an overlay is on; glazing (0.55, 0.75, 0.90) at 0.30 alpha, `transparent`, not casting. Flat shading is the default because the files carry no normals and `GLTFLoader` sets `flatShading` when they are absent.

---

## 4. The accumulation (the pixel map)

The cumulative view is computed on the GPU with the same shadow map, not with ray casting.

**Sample points.** For every analysed surface, tile each triangle with points on a grid of spacing `grid_m` in the triangle's plane (project to the plane's two axes, step a grid over the triangle's bounding box, keep points inside the triangle, place each at the triangle's plane plus 1 cm along its normal). Store per point: position, normal, surface id, room id (or −1). For the example at 0.5 m this is about 35,000 points; at 0.25 m about 140,000. Pack positions and normals into `DataTexture`s so a full-screen fragment pass can visit every point once.

**One pass per sun position.** Render the shadow map with the tight frustum. Then run a fragment shader over an N-point render target (one texel per point; a 512 × 512 target holds 262,144 points): for each point, transform position by the light's view-projection, compare depth against the shadow map with the same bias, and add 1 to the point's count if unoccluded and `dot(normal, sunDir) > 0`. Accumulate by ping-pong between two RGBA8 targets, reading the previous count and writing the new one, with the count encoded across the R and G channels (count = R·256 + G, exact to 65,535). No float targets, no blending extensions, so it runs on every WebGL2 device the same way. One `readRenderTargetPixels` per period into a `Uint8Array`, decoded to counts, times the step length, gives hours.

**Time steps.** 10 minutes, from the first step after sunrise to the last before sunset (suncalc `getTimes`). Per day that is about 90 steps in June and 55 in December.

**Periods** (`period` control):

- `year`: twelve representative days, the 15th of each month, each weighted by its month's length. About 700 passes. The result is reported **per day**: hours of direct sun on an average day of the year.
- `month`: the 15th of the month the clock's day falls in. Reported per day.
- `day`: the day on the clock. Recomputed when the day changes, debounced 250 ms; while the day timeline plays the clock holds until each recompute finishes, which is the frame's rule and is slow on purpose rather than wrong.

The year figure is an estimate from twelve days; the card says so. Budget: under 3 s for the year at 0.5 m on an integrated GPU; report the elapsed time in the input report line so a slow machine explains itself.

**Overlays** (`overlay` control), drawn as one flat square per sample point, `grid_m` wide, lying in its surface (an instanced plane, oriented by the point's normal; `frustumCulled = false`):

- `none`: surfaces plain; the live shadow is the whole picture.
- `hours`: direct sun hours per day for the period. Sequential scale, dark blue at 0 through yellow to white at the period's maximum possible (the longest day length in the period, so December's 9 h and June's 15 h are not squeezed to the same colour). Legend with the scale's ends and the value under the cursor.
- `share`: the same, as a share of the period's daylight hours, 0–100 %.
- `threshold`: two colours — meets `threshold_hours` per day, or not. This is the daylit-band view.

The overlay is drawn on top of the live shading, so scrubbing the hour still moves the shadows under the squares. Hovering a point shows its value and its room. Clicking a room highlights its row in the table.

**Why this way, for the dev notes.** Every sun-hours study is a count of unoccluded sun positions per point. Doing the occlusion test with a shadow map means the sandbox has one mechanism for the picture and the number; the same depth image that draws the shadow at 14:00 decides whether a point was lit at 14:00. What it cannot do: reflected light, sky light, glass transmission. Those need a sky model and a radiance solver, which is a different simulation, and the sandbox names them as the next thing rather than pretending to include them.

---

## 5. Cameras

Two buttons in the viewport, top left, plus `OrbitControls` (`three/addons`) so the user can orbit, drag and zoom from either. Damping on, no auto-rotate. The buttons re-place the camera; they do not lock it.

**Exterior.** Target: the space's bounding-box centre. Elevation 40°. Distance 2.5 × the box's diagonal. Azimuth: test the eight compass directions with a `Raycaster` from the candidate camera position towards the target against the merged context (with the cut-away's hidden set excluded when the cut-away is on); choose the direction whose first hit is farthest, ties broken towards south-east. This exists because from the south-east at 45° the 40-storey 125 Broad Street fills the frame; verified in the check renders. Perspective, 45° field of view.

**Interior.** Eye 1.6 m above the floor of the room with the largest floor area; ties broken by the room whose glazing centroid is southernmost (largest +Z), then by name order; if there are no rooms, above the centroid of the largest `floor*` surface. Look horizontally towards that room's glazing centroid (or, with no glazing, towards the space's centre). Field of view 70°. In the example this lands in `room_18` on the south side looking at the harbour; the check render shows the strip window and the sun on the floor.

The default view on load is Exterior with the cut-away on. The cover is taken there (§7).

---

## 6. The panel: `schema.json`

Property order is the panel's reading order (the 2026-09-05 rule: clock, then how it's drawn, then the main levers, then finer assumptions). `x-emphasis` on `hour`, `period`, `show_context`. Descriptions are plain sentences saying what the control does and whose number the default is. Slider granularity via `x-step`, never `multipleOf`.

| Group | Key | Type | Range / enum | Default | Notes |
| --- | --- | --- | --- | --- | --- |
| the clock | `hour` | number | 0–24, `x-step` 0.05 | 12 | `x-timeline: primary`, `x-play-rate` 10 (steps per second, so half an hour of sun per second), `x-play-loop` true, `x-play-auto` true, `x-format: clock`. Local time in `timezone`. |
| the clock | `day_of_year` | integer | 1–365 | 172 (21 June) | `x-timeline: secondary`, `x-play-rate` 6, `x-play-loop` true. Label shows the date. One clock plays at a time (existing transport rule). |
| the clock | `timezone` | string enum | `America/New_York`, `UTC`, `America/Chicago`, `America/Denver`, `America/Los_Angeles`, `Europe/London`, `Europe/Berlin`, `Asia/Tokyo`, `Asia/Shanghai`, `Asia/Kolkata`, `Australia/Sydney` | `America/New_York` | Students elsewhere pick the nearest or UTC. |
| how it's drawn | `overlay` | string enum | `none`, `hours`, `share`, `threshold` | `hours` | §4. |
| how it's drawn | `period` | string enum | `year`, `month`, `day` | `year` | §4. `x-emphasis`. |
| how it's drawn | `cutaway` | boolean | | true | §3. |
| how it's drawn | `show_context` | boolean | | true | Off removes every `context*` mesh from drawing and from the shadow pass, and recomputes. This is the control that shows what the neighbours cost. `x-emphasis`. |
| how it's drawn | `grid_m` | number enum | 0.25, 0.5, 1.0 | 0.5 | `x-enum-labels` "25 cm", "50 cm", "1 m". Recomputes. |
| how it's drawn | `threshold_hours` | number | 0–8, `x-step` 0.25 | 2 | Hours per day. Ours; there is no New York residential direct-sun standard. |
| the site | `latitude` | number | −90–90, `x-step` 0.0001 | 40.7026 | From the manifest. A student sets their own. |
| the site | `longitude` | number | −180–180, `x-step` 0.0001 | −74.0107 | |
| the site | `north_deg` | number | −180–180, `x-step` 1 | 0 | Rotation of the model about the vertical so that −Z points north; 0 for a model built with +Y north in Rhino. |
| the site | `example_floor` | integer enum | 3, 8, 15 | 8 | `x-enum-labels` "3rd floor", "8th floor", "15th floor". Only meaningful without an uploaded model; when `assets.model` is set, ParamPanel skips the control (add an `x-hidden-when-asset: "model"` key and honour it in ParamPanel; this is the one panel addition). |
| light and air | `window_rule` | string enum | `mdl30`, `mdl277` | `mdl30` | `x-enum-notes`: §30(8)(a): window area at least one tenth of the room's floor area, every window at least 12 sf. §277: ten percent under 500 sf of floor area, one percent less per additional 100 sf, floor five percent, for conversions of non-residential buildings. Both read from the statute 2026-09-06; sources in `manifest.json`. |
| light and air | `depth_rule` | boolean | | false | Applies §30(3): a room may not extend more than 30 ft from its window. The statute limits this to apartments of three rooms or fewer, which is why it is off by default and its own control. Measured as the farthest floor point of the room from the room's glazing, in plan. |

`required`: every key. `additionalProperties: false`. `$id` `https://simmodeltwin.net/schemas/sandbox/sunlight.json`.

---

## 7. Metrics, the room table, and acceptance

**`onmetrics`** (the strip under the viewport), in this order:

- `sun now`: altitude and azimuth in degrees, or "below the horizon".
- `analysed floor area`: m² of `room_*` + `floor*` surfaces.
- `mean direct sun, floors`: hours per day for the period, area-weighted over floor points.
- `floor area at or above threshold`: percent.
- `deepest lit point`: metres from the nearest glazing pane, in plan, of the farthest floor point with at least 1 hour per day in the period; "none" if no floor point reaches 1 hour.
- `rooms`: count.
- `rooms passing <rule>`: count, under the selected `window_rule` (and `depth_rule` if on).
- `rooms passing but under threshold`: count of rooms that pass the rule and whose mean floor sun is below `threshold_hours`. This is the legal-but-dark figure, one number, not a colour.
- `input`: the report line from §2.

**The room table**, beside or under the panel in the full layout, one row per room: id, floor m², glazing m², ratio, required ratio under the rule, pass/fail, mean hours per day, share of the room's floor at or above threshold, deepest lit point in that room. Sortable by clicking a header. Hover highlights the room in the model.

**Checks Claude Code runs before saying it is done.**

1. `example-f08.glb` loads with the input report of §2, exactly.
2. Room areas from the browser's own triangles match `manifest.json` → `rooms` within 0.1 m²: room_01 floor 61.33, glazing 11.31, ratio 0.184; room_12 floor 52.68, glazing 10.93, ratio 0.207. Bays total 1,981.4 m², `floor_interior` 1,283.0 m², so the analysed floor area is 3,264.4 m². Every room passes `mdl30` and `mdl277` (660 sf → required 9 %; 567 sf → required 10 %).
3. Sun positions, site defaults, from suncalc 1.9.0: 21 June 13:00 EDT altitude 72.7°, azimuth 181.5° from north; 21 December 12:00 EST altitude 25.8°, azimuth 181.4°; 21 June 08:00 EDT altitude 26.4°, azimuth 80.9°; sunrise 21 June 05:25 EDT, sunset 20:30 EDT. Azimuth 90° with altitude 0 gives the direction (1, 0, 0); azimuth 0 gives (0, 0, −1).
4. No point's `hours` value exceeds the period's longest day; every point's `share` is within 0–100.
5. `cutaway` on: the plate is visible from the exterior camera and shadows of hidden towers still fall on the ground plane (screenshot at 21 June 15:00 and compare with the cut-away off).
6. `show_context` off: the mean floor sun rises; report both figures in the dev notes.
7. Hydration: open `/sandboxes/sunlight/`, a tutorial page that embeds it, and a gallery page with a model upload, and check the browser console, not the HTTP status (the CLAUDE.md trap).
8. `npm run build` and `npm run audit:freeze` pass. The archive build serves the GLB from `/data/sunlight/`.
9. `npm run covers` produces the cover with the default state (8th floor, exterior camera, cut-away on, `hours` overlay, year). The frame publishes `data-cover-ready` only after the accumulation.

---

## 8. Site plumbing

**Registry.** Move `sunlight` to the end of `allSandboxes` in `src/lib/sandboxes/index.js`, after `bathtub`, so that when it is published it becomes 6 and nothing renumbers. Add its schema to `schemas`. Leave `published: false`; **ADAM** flips it after review. The page must work at `/sandboxes/sunlight/` while hidden, as the hidden slugs already do.

**Files under `src/lib/sandboxes/sunlight/`:** `meta.js` (rewrite entirely; the current stub's `controls`, `metrics`, `data`, `cannotSee` and blurb are superseded by this document), `schema.json`, `Sunlight.svelte`, `sun.js` (sun vector, time-zone instant, period schedule), `tags.js` (the §2 classifier and the input report), `accumulate.js` (sample points, the passes, the readback), `cameras.js` (§5), `card.md` (five sections, footnotes per section). `meta.tutorial` → `/tutorials/06-sunlight/`.

**Dev notes:** `src/content/tutorials/06-sunlight.md`, `devnotes: true`, `sequence: 6`, the four H2s and two H3s of the other dev notes. Anchors `#the-parts` and `#what-came-out` must exist; `FAILURE_MAP` points there.

**Tutorial (weekly shape, Methods voice per the style guide, still a PROSE DRAFT):** `src/content/tutorials/05-a-model-for-the-sun.md`, `sequence` **ADAM** (it follows `04-notebook-to-sandbox`; 5 is the placeholder and the file is renamed if Adam slots it elsewhere). Title "Preparing a model for the sunlight sandbox". Sections: what the sandbox reads (the §2 table, in prose and as the table); units and axes (metres; +Y north in Rhino; the origin anywhere, the site controls carry latitude and longitude; `north_deg` if the model is not built north-up); the two parts (context: the neighbours as closed massing, low detail, everything within a few hundred metres that could shade the space; the space: floors as one patch per room, walls with openings where the glass goes, glass as its own surfaces, a ceiling); naming (object names, the `room_01` / `glazing_01` pairing, `wall_*`, `ceiling`, `floor_*`, `context_*`, `context_above_*` for one's own upper storeys); meshing and export (Rhino 8 *File > Export Selected > glTF*, options *Map Rhino Z to glTF Y* on, *Export materials* on, *Export Layers* on, *Export open meshes* on, Draco off; NURBS become meshes on export, so check the mesh settings; the 15 MB cap; context first if the file is too big); checking (open the sandbox, load your file, read the input report, look at the room table; the two example downloads to compare against: `/data/sunlight/example-f08.glb` and `/data/sunlight/example-f08.3dm`); handing in (the assignment page). Include a "Blender instead" paragraph: object names become node names in Blender's glTF exporter, so the same names work there.

**ADAM's exporter test, before the tutorial is final:** open `example-f08.3dm` in Rhino, export it as glTF with the options above, load the export into the sandbox (a "load a file" input in edit mode, below the panel, exists for exactly this: it reads a local `.glb` into `assets.model` without uploading), and read the input report. If it reports 34 rooms and 34 glazing panes, object names survive the exporter and the tutorial says "name the objects". If it reports untagged meshes, try the same file with materials named `room_01`, `glazing_01` and so on, and the tutorial says "name the materials". The classifier accepts both, so the sandbox does not change either way; only the tutorial's wording does. Claude Code writes the tutorial with the object-name method and a marked sentence for Adam to confirm or swap.

**Assignment:** `src/content/assignments/assignment-04.md`, `sequence: 4`, `submit: true`, `accepts: [model]`, `published: false`, no `due` (**ADAM** sets `due`, `sequence` and `published`; the file is renamed if the number changes). Title "A Space in Sunlight". Body: model a space you know and its neighbours to the tutorial's convention, hand in the `.glb`, and write the two-sentence gallery text about what the simulation showed you that you did not know; the gallery runs your model in the sandbox. `#submission` anchor for the failure pointers.

**`validate.js`.** `ACCEPTS.model = ['.glb']`. For a `model` primary: check the first four bytes are `glTF` and the declared total length in the header equals the file length; on failure `assets/bad-model` → `#the-parts` of the sunlight dev notes (a `model` assignment carries `sandbox_ref: sunlight` in its frontmatter so the pointer can find the dev notes). Validate `manifest.params` for a model assignment against the sunlight schema restricted to `latitude`, `longitude`, `timezone`, `north_deg`; anything else is `params/unknown-key`.

**`AssignmentSubmit.svelte`.** When `accepts` includes `model`: `EXT.model = '.glb'`; show four small inputs, latitude, longitude, time zone (the same enum) and north offset, defaulting to the sunlight schema defaults, sent as `manifest.params`. The cover for a model upload is not drawn in the browser; `npm run covers -- --submissions` takes it from the gallery page like a PDF's.

**Gallery page** (`/gallery/[student]/[sandbox]/+page.svelte`). Add `primaryKind === 'model'` for `.glb`. For it, do not render the file block; mount the sunlight component through `SandboxFrame` with `mode="edit"`, `layout="contained"`, `params = { ...defaults('sunlight'), ...sub.params }`, `assets = { model: primaryUrl }`, and a new frame prop `submittable={false}` that hides the Submit button (default true elsewhere). The frame's cover contract then works unchanged. The "Parameters as submitted" details block shows the four site values.

**`SandboxMounts.svelte`.** Pass `data-assets` (JSON) through to the frame as `assets`, so a tutorial can embed the sandbox with a specific model: `<div data-sandbox="sunlight" data-mode="view" data-assets='{"model":"/data/sunlight/example-f03.glb"}'>`.

**Load-a-file input.** In edit mode on the sandbox route only, under the panel: an `<input type="file" accept=".glb">` that reads the file into an object URL and sets it as the model. Nothing is uploaded. This is the student's test bench and Adam's exporter test.

**Assistant prompt.** `assistant-prompt.js` reads `subtitle`, `controls` and `cannotSee` from `meta.js`; write them to agree with `card.md`.

---

## 9. `card.md` outline (five H2s, footnotes inside the section that cites)

**What this is.** A direct-sunlight simulation of one floor of 25 Water Street as the 2014 survey recorded it, with the surrounding blocks as context; and a tool that runs any model prepared the same way. Direct sun only: no sky, no reflection, no glass. Footnotes: the survey dataset; the building (Wikipedia; YIMBY on the courtyards).

**What it's trying to show.** Where the sun reaches inside a deep plate in a dense block, hour by hour and over a year; how much of that is the neighbours' doing (`show_context`); and that a room can meet the letter of the light-and-air rule and receive little direct sun. The conversion cut two courtyards into this plate; the sandbox shows the plate before that.

**How it works.** Sun position from date, time and coordinates (suncalc). One shadow map per sun position; the same depth image draws the shadow and tests each sample point. Twelve days stand for the year. The grid, the periods, the overlays, the two rules. Footnotes: MDL §30, §277 with the unverified 2024 eligibility note.

**What it assumes.** The manifest's assumption list in prose: floor heights, the glazing band, the bays, the core, the rectangle, prisms per roof polygon, the 15th as each month's representative day, ten-minute steps, the 2-hour threshold as ours.

**What it can't see.** Sky light and reflected light, so a north room reads as dark though it may be well lit; glass, curtains, trees, the ground's reflectance; anything built since 2014; the real floor heights and the real core; who lives in which room; and the two courtyards that were cut, which is where a student might start.

---

## 10. Traps found while preparing this (each cost time once)

- `visible = false` removes a mesh from the shadow pass. Use a clipping plane or `colorWrite = false` for cut-aways (§3).
- Zero-thickness walls need `shadowSide = DoubleSide` or the sun passes through them from one side.
- The exterior camera from the south-east at 45° is inside 125 Broad Street's silhouette; hence the eight-direction ray test (§5).
- The interior camera at the space's centre is inside the core; hence the largest-room rule (§5).
- `suncalc@2.0.2` returns degrees and changed its module shape; pin 1.9.0 (radians, `azimuth + π` from north).
- `GLTFLoader` gives a Mesh the node's name, not the mesh's, when both exist; the classifier checks node, then mesh, then material.
- The GLBs carry no normals on purpose (smaller, and flat shading is right for massing); do not "fix" this by computing smooth normals, which rounds every building's edges.
- The frame holds the clock while `onready(false)`; a day-timeline play with `period: day` is therefore slow by design. Do not buffer ticks.
- `npm run sync` deletes and recopies `static/data/sunlight`; the Cowork VM cannot delete, so run sync locally.
- In the check renders the cut-away exposed the insides of the stacked prisms (dark interiors). Cosmetic; a stencil cap is not part of this build.

---

## 11. Not in this build

Sky light, daylight factor, sDA, lux, irradiance (a clear-sky beam model is the smallest next step and needs a cited coefficient set); glass transmission; the `submit this state` flow for this sandbox (Adam is redesigning that modal); a per-building context picker; a "move the floor" control (the floor is baked into the model file; the three example files stand in for it).
