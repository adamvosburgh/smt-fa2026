<!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->

## What this is

A map of when the world stopped being wild, with the judgement calls exposed.

The Anthromes dataset classifies every piece of land on Earth, at every time
step from 10000BC to the present, into "anthropogenic biomes" — urban, village,
cropland, rangeland, seminatural, wild. It is one of the most widely reproduced
pictures of the human transformation of the planet, and underneath it is
something surprisingly small: a decision cascade of about a dozen hard
thresholds applied to six continuous input grids. A cell is a cropland anthrome
if crops cover at least 20% of its land. A cell is used at all if crops,
grazing and built area together reach 20%. A cell is urban above 2,500 people
per square kilometre. Each of those numbers was somebody's judgement.

Here the cascade runs in your browser, and every threshold is a slider. The
map you are looking at is the result of *your* cascade, recomputed live over
ten thousand years of the published input data. At the default settings it is
the published method exactly; the pipeline proved its port of the cascade
agrees cell-for-cell with the authors' own reference code on their own test
data, and that check is recorded in the manifest.

## Why we're looking at this one

Because the objective here is to expose the assumptions that make a dataset.

The other sandboxes in this course put controls on models — a pro-forma, a
flood level, a 1989 city engine. This one puts controls on a *classification*,
which is the quieter kind of model: it does not predict anything, it just
draws lines through continuous measurements and gives the regions names. The
20% threshold is not a fact about the world. Drag `used land` down to 5% and
the crossover — the first time step at which used land exceeds wild — moves
by millennia. Drag it up to 40% and parts of the twentieth century go back to
being wild. The headline finding of a famous dataset turns out to sit on a
handful of round numbers, and the sandbox lets you find out how hard it leans
on each one.

## The data

- **The six inputs are HYDE 3.2's**: cropland, grazing, irrigated rice, total
  irrigation, built-up area and population, at 5 arc-minutes for 75 time
  steps, aggregated here to the same 33km grid as the course's other global
  work by land-area-weighted mean — the aggregation happens *before* the
  cascade, which matters, and the next section says why.
- **Why 3.2 and not 3.5**: HYDE 3.5's own distribution is missing the
  2000–2023 input grids — verified by reading the archive's file headers, the
  folder that should hold them is present and empty — and its classification
  paper is still in preparation. 3.2 is the documented method of record. This
  is why the timeline ends at 2017: a gap in the published data, not a choice.
- **The method is the reference implementation's**, from the paper's
  replication archive — the actual code the published maps were computed
  with. Three of its rules are in the code but not in the paper's figures,
  and this sandbox keeps them, because the executed method is the method of
  record.
- **The potential vegetation map** decides which unfarmed cells count as
  woodland and which as dryland. It is a static input from an entirely
  different model, and it has one slider here (how many classes count as
  forested) where the real uncertainty is the map itself.

## How the map gets made

Every input is divided by the cell's land area before anything is classified —
population becomes persons per square kilometre of land, land uses become
fractions — and then the cascade runs, first match wins, in the reference
implementation's exact order. Population sets the band (urban, dense,
residential, populated, remote, wild); land use picks the class within the
band; potential vegetation splits the leftover into woodland and dryland.

Three layers are shipped, and the disagreement between them is the exhibit:

- **Yours**, classified in the browser at 33km, under your thresholds.
- **The same method at native resolution**, classified at 5 arc-minutes with
  the default thresholds and *then* aggregated by majority. At the defaults,
  the difference between this layer and yours is purely what aggregating a
  threshold rule does to it — nothing else in this course shows that as
  directly. Colour by "vs published" to see it.
- **HYDE 3.5's published series**, different data, eight years longer. The
  difference between it and the native-resolution layer is the
  dataset-version effect. The hover tooltip shows all three for any cell.

A reader who expects the default map to reproduce the published one at a
glance will read an honest disagreement as a bug, so it is said here plainly:
your 33km map and the published 5-arc-minute map will not agree everywhere,
and that disagreement is a picture of resolution, not an error.

## What it assumes

- **That the thresholds are worth arguing with.** The defaults are the
  published values, and the sliders' whole premise is that they are
  judgements. They are: the paper's figures present them without derivation.
- **The wild cutoff is one ten-thousandth of a person per square kilometre**,
  not zero — a rule in the reference code, not in the paper. It is kept, and
  it is the kind of buried constant this sandbox exists to surface.
- **The drawing is equirectangular.** The grid is equirectangular, so any
  other projection would cost an inverse projection per hover. It badly
  exaggerates the high latitudes — which matters here, because so much of
  what the classification calls wild is boreal and tundra. Every area
  statistic is therefore computed with each cell's true land area. The
  picture is distorted; the numbers are not.

## What it can't see

The sliders move the classification, but **HYDE's allocation — how a national
population estimate gets distributed across cells — has no slider at all and
is the larger uncertainty.** HYDE publishes lower and upper population
scenarios alongside the baseline that would put a range on every number here;
wiring them in would roughly triple the download and is not in this pass, so
the uncertainty the sandbox does not let you touch is named instead. The
potential vegetation map is a second model underneath the model, also without
controls. And nothing here is observation: every input is itself a model's
output, interpolated from censuses and reconstructions, and the further back
the timeline runs the more of it is reconstruction.
