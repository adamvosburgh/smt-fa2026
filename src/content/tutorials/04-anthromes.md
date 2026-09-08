---
title: "Anthromes dev notes"
date: "2026-09-04"
author: Adam Vosburgh
sequence: 4
cat: tutorial
devnotes: true
published: true
---

Notes from building the [Anthromes](/sandboxes/anthromes/) sandbox. Pipeline: `data/scripts/anthromes.py`. Component: `src/lib/sandboxes/anthromes/`.

![the sandbox at 2000 AD](/covers/anthromes.png#img-full)

<div class="gap">

**What a rebuild won't have.** The sandbox ships six variables over 75 time steps as packed binary planes, recomputes the crossover for all years in a Web Worker, and carries two reference layers. A rebuild should classify one year from dense arrays on the main thread. Keep the check against the authors' own classifier.

</div>

## The ambition

What does it mean to understand the Earth through a predictive model, or here a hindcast? The Anthromes maps show the world's land colored by human use from 10,000 BC to now, and get cited as a record. They are a classification laid over HYDE, itself a model that spreads historical estimates across a grid. The idea was to rebuild the classification with every threshold as a slider and run it live on the published inputs, so the map on screen is your classification and the crossover year (used land first exceeding wild) moves as you move the lines.

## The parts

- **HYDE 3.2** (doi:10.7910/DVN/E3H3AK): cropland, grazing, irrigated rice, total irrigation, built-up area and population at 5 arc-minutes for 75 time steps, plus land area and potential vegetation grids. Gives the fractions and densities the cascade tests.

![the 75 time steps](/tutorials/images/04/time-steps.png#img-full)

- **Anthromes 2.1** (Ellis, Beusen & Klein Goldewijk 2020), from the replication archive's reference code (doi:10.7910/DVN/IB4VCI). Gives the cascade, including three rules in the code but not the paper, and one year of test data.

![the cascade](/tutorials/images/04/cascade.svg#img-full)

- **A 33 km equirectangular grid** (1200×600, 182,503 land cells), shared with the course's other global work. Inputs are aggregated to it by land-area-weighted mean before classification.
- **Two comparison layers**: the same method at native resolution then majority-aggregated (isolates resolution), and HYDE 3.5's published classification aggregated the same way (isolates dataset version).
- **A crossover ledger**: used and wild shares for all 75 steps under the current thresholds.

## Roadblocks

- HYDE 3.5's `1970ce-2023ce` archive holds only 1970-1999; the 2000-2023 folders are present and empty in three separately obtained copies, so the sandbox classifies 3.2 and ends at 2017.
- The six input TIFFs are 2.8 GB each uncompressed and once filled a scratch disk; they're read as a stream, one row (all 75 years) at a time, with nothing extracted.
- The pipeline runs the authors' classifier on their test year and refuses to ship unless its own port agrees cell for cell (2,215,829 cells, zero disagreements).
- Aggregating before thresholding gives a different map from thresholding before aggregating, so the default map doesn't match the published one everywhere; the "vs published" coloring shows where.
- The grid is equirectangular, which exaggerates the high latitudes where most wild land is; area statistics use true cell areas instead of reprojecting.

## What came out

A world map that reclassifies itself as a dozen thresholds move, with the crossover year recomputed live and two published layers to compare against.

### What you should see

The world in 2000 AD at the published thresholds:

<div data-sandbox="anthromes" data-mode="view" data-params='{"year":"2000AD"}'></div>

- At the default 20% used-land threshold the crossover lands where the published dataset puts it; at 5% it moves back by millennia, and at 40% parts of the twentieth century return to wild.
- "vs published" highlights cells the same cascade classifies differently at native resolution.
- Hovering a cell shows the inputs and all three classifications.

### Limitations

- HYDE's allocation of national estimates across cells is the larger uncertainty and has no slider; its lower and upper population scenarios aren't wired in.
- The potential vegetation map deciding woodland against dryland is a static input from another model.
- Three rules come from the code and not the paper: the wild cutoff of 0.0001 persons/km², under-ice cells with any use becoming wild drylands, and the order of the used-land tests.
- Nothing in the inputs is an observation, and the map looks equally confident at every date.

---

Notes by Adam Vosburgh, Fall 2026.
