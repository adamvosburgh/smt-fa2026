---
title: "Tutorial 4 — Anthromes"
date: "2026-09-04"
author: Adam Vosburgh
sequence: 4
cat: tutorial
published: true
---

<!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->

This module is about exposing the assumptions that make a dataset. Not a model
that predicts anything — a *classification*, which is the quieter kind of
model: it draws lines through continuous measurements and gives the regions
names, and then the names get cited as facts. We take the Anthromes dataset —
every piece of land on Earth, classified from 10000BC to the present as urban,
village, cropland, rangeland, seminatural or wild — and rebuild it so that
every threshold in its decision cascade is a slider.

The finding you should leave with: one of the most widely reproduced pictures
of the human transformation of the planet rests on about a dozen round
numbers, and the headline — the date at which used land first exceeded wild —
moves by millennia when you drag one of them.

<div class="gap">

**What the tutorial version won't have.** The sandbox ships six input
variables over 75 time steps in packed, partly sparse binary planes, runs its
all-years ledger in a Web Worker, and carries two reference layers to compare
against. The tutorial version classifies one year, from dense arrays, on the
main thread — which is entirely enough to move the thresholds and watch the
map change, and is honest about what the rest is: transport engineering, not
method.

The one thing the tutorial version must carry at any size is the check. The
paper's replication archive contains the authors' own classifier and one year
of test data; if your port of the cascade does not agree with their code cell
for cell, your sliders are moving a cascade of your own invention.

</div>

## Producing the data

The inputs are HYDE 3.2's six grids — cropland, grazing, irrigated rice, total
irrigation, built-up area, population — at 5 arc-minutes for 75 time steps,
distributed as one multi-band GeoTIFF per variable. Three things about
producing the planes are worth your attention.

**First, the dataset you planned to use may be missing the part you need, and
the archive's name will not tell you.** The plan was HYDE 3.5, the newest
release. Its baseline archive contains a zip named `1970ce-2023ce`; stream its
file headers and it holds sixty members — thirty years, 1970 to 1999. The
folders that should hold 2000–2023 are present and empty, in three separately
obtained copies. The gap is upstream, invisible to anyone who only reads
directory names, and it is why this sandbox classifies 3.2 and why its
timeline ends at 2017. The card names it as a gap in the published data, which
it is.

**Second, a file you cannot afford to extract can still be read.** The six
TIFFs are 2.8GB each uncompressed — 17GB expanded, which has already filled a
scratch disk once. But they are uncompressed, one strip per row, with the 75
time steps interleaved per pixel: so a single 1,296,000-byte read is one image
row carrying every year at once, and the whole aggregation runs in one
streaming pass per file with nothing extracted. The layout that looks like an
inconvenience — you cannot pull out a single year without striding the whole
file — is actually the only efficient access pattern, if you aggregate all 75
years together.

**Third, the check. The replication archive is the most valuable file in this
module.** It contains the classifier the authors actually ran — including
three rules that are in the code but not in the paper — and one complete year
of input data. The pipeline runs their script on their data, runs its own
vectorised port on the same numbers, and refuses to ship unless the two maps
agree cell for cell. They do: 2,215,829 cells, zero disagreements, recorded in
the manifest. Without that gate, every slider in the sandbox would be moving
an approximation of a method rather than the method.

## Setting up the web environment

Every sandbox here is one Svelte component taking `params`, `assets` and a
`mode`. It reports its numbers upward and says when it has settled; the frame
publishes them, runs the clock, and draws the controls from the schema.

This one is the cheapest renderer in the set: plain canvas, no basemap,
because the data *is* the map. The classified grid is written into a 1200×600
`ImageData` and scaled up with `imageSmoothingEnabled = false` — the chunky
cells are the resolution the classification actually has, drawn honestly.
Hover inverts the pixel back to a cell index arithmetically and reads the
tooltip out of the same typed arrays: the inputs, the potential vegetation,
your class, and both reference classes.

The one piece of real machinery is the ledger. The crossover year needs all
75 years reclassified under your thresholds — 13.7 million cell-years — and
that runs in a Web Worker, debounced, with the stale value greyed while a new
one is in flight. The animation never waits for it.

## The parameters

Here is the world in 2000AD, at the published thresholds:

<div data-sandbox="anthromes" data-mode="view" data-params='{"year":"2000AD"}'></div>

Every control is a number from the published cascade. The bands come from
population density — urban above 2,500 people per km², dense settlements above
100, residential above 10, populated above 1 — and the classes within a band
come from land-use fractions, almost all of them 20%.

**Start with the used-land threshold, because it is the headline.** The
crossover metric is the first time step at which used land exceeds wild.
At the default 20% it lands where the published dataset put it. Drag the
threshold down to 5% — so that a cell counts as used when a twentieth of it
is farmed — and the crossover moves back by millennia; drag it to 40% and
parts of the twentieth century return to wild. Nothing about the world
changed. A judgement did.

Then colour by **vs published**. At the default thresholds, every red cell is
classified differently by *the same cascade with the same numbers* run at
native resolution before aggregation instead of after. That difference is
purely what aggregating a threshold rule does to it — a picture of a
methodological choice that is usually invisible, and the reason the map here
does not exactly reproduce the published one even at the defaults. The card
says this plainly, because an honest disagreement read as a bug is worse than
either.

## The assumptions

**The thresholds are judgements, and the sandbox's premise is that they are
arguable.** The paper presents them without derivation. The defaults here are
exactly the published values, and the gate proves the default cascade is the
published method — so whatever you find by moving them, you found it in the
real method's real inputs.

**Three rules are in the code and not in the paper.** The wild cutoff is one
ten-thousandth of a person per square kilometre, not zero; under-ice cells
with any use at all become wild drylands rather than ice; and the used-lands
branches test the per-variable thresholds before comparing crops against
grazing. The reference implementation is the method of record, so the sandbox
keeps all three — and the kind of constant that lives only in code is exactly
what this course means by a buried assumption.

**The allocation underneath has no slider.** HYDE distributes national and
regional estimates across cells with a model of its own; that allocation is a
larger source of uncertainty than any threshold here, and the sandbox cannot
touch it. Neither can it touch the potential vegetation map that decides
woodland against dryland — a static input from an entirely different model.
Both are named on the card as the uncertainty you are not being allowed to
play with, which is itself a thing to notice about any interactive dataset.

**The projection flatters no one.** Equirectangular, because the grid is; it
exaggerates exactly the boreal and polar latitudes where most of the wild
classes live. Every statistic is computed with true cell areas instead. When
the picture and the numbers must disagree, keep the numbers honest and say
what the picture is doing.

## Challenge

Two, at different difficulties.

**Find the threshold that matters second.** The used-land slider is the
headline, but one of the other eleven moves the map more than the rest. Make
a claim about which, show the before and after at a named year, and explain
*why* it has the leverage it has in terms of the cascade's order — first
match wins, so a threshold's power depends on what gets tested before it.

**Or put a range on the map.** HYDE publishes lower and upper population
scenarios alongside the baseline this sandbox uses. Fetch one of them, run it
through the same pipeline, and show where the classification is robust to the
population uncertainty and where it flips. The deliverable is the pair of
maps and a paragraph on which published claims survive the range.

---

Module by Adam Vosburgh, Fall 2026.
