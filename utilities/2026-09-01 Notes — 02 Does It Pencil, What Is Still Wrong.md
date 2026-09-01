---
title: Notes — 02 Does It Pencil, what is still wrong
date: 2026-09-01
type: content
---

# Does It Pencil — what is still wrong

Written after the sizing-and-siting rebuild of 2026-09-01, from two things Adam
saw on the map that the build doc did not anticipate:

1. lots that plainly look viable have no unit on them when volumes are turned on;
2. units standing in front gardens.

Both are real. Neither is a drawing bug in the sense of a wrong line of code —
they are two different gaps between what the model knows and what the picture
implies it knows. This records what each one actually is, measured, and what it
would take to close it.

Every figure below was produced by reading `data/processed/pencil/lots.bin`
directly, at the schema defaults, on 2026-09-01. The scripts are throwaway; the
numbers are reproducible from the shipped payload.

---

## 1. The flat view and the volume view are answering different questions

**This is the larger of the two problems and it is a legibility failure, not a
geometry one.**

At the defaults, at year 2035, the two views draw these populations:

| | drawn | what it means |
| --- | --- | --- |
| flat marks, visible | 22,333 | every lot that clears the zoning test *and* the 300sf floor |
| …of those, tinted as passing | 14,883 | the deal clears the $200 cushion |
| volumes | 2,905 | built by 2035 **and** with room behind the house |

The other 224,588 lots are drawn at alpha 40 — technically present, effectively
invisible. So the eye reads "the dots" as the eligible lots, and reasonably
expects the volumes to be the same set.

They are not, and **two independent filters sit between them**:

- **The permitting queue.** `permits_per_year` is 1,000 and the clock starts in
  2027, so by 2035 exactly 9,000 of the 14,883 passing lots have been released.
  That alone is a 60% cut, and it is the sandbox's central claim — throughput,
  not demand, is the binding constraint. It is *supposed* to remove most of them.
- **Placement.** Of those 9,000, 2,905 have room behind the house. 6,095 do not.

Net: a visible mark has about a **13% chance** of becoming a volume, and nothing
on the face of the sandbox says why. The legend counts the second filter and
says nothing about the first, so a reader who notices the discrepancy attributes
all of it to placement, which is wrong by a factor of two.

**Fixed in the same pass as the layout work**, and cheaply: the flat marks now
stay on the map underneath the volumes rather than being replaced by them, so
the two populations are visible at once — every lot that pencils as a mark, the
ones actually standing as a solid. The legend names all three populations
separately. That does not change a single number; it stops the map from implying
a claim the model never made.

**Still open:** the queue is a ranking by return on equity, and that ranking is
a stand-in for a decision nobody has modelled. A homeowner in a high-return lot
does not thereby apply. The card says this; the map still draws it as though the
order were known.

---

## 2. Which end of the lot is the back is inferred, and the inference is bad

The pipeline takes "the back of the lot" to be the direction from the lot
centroid pointing away from the buildings already on it. Neither MapPLUTO nor
the building footprint layer records where the street is, so there is nothing
better on disk. This was documented as a limitation at the time. **It is a worse
limitation than it was labelled**, and it is now measured.

Group the sited lots into 120ft cells — roughly one block face's worth — and ask
how well neighbouring lots agree about which way "back" points. On a real Queens
block every house on a side of the street faces the same way, so agreement
should be near-total.

| | median | cells above 0.9 |
| --- | --- | --- |
| **axial** agreement (the line, ignoring sign) | **1.00** | 74% |
| **directional** agreement (which end is the back) | 0.60 | 36% |

Read that carefully, because it splits the problem in two:

- **The axis is right.** The pipeline finds the front-to-back line through the
  lot essentially perfectly, and that line comes from real geometry — the lot
  polygon and the recorded footprint. The *deep* dimension of the rear-yard box
  is trustworthy.
- **The sign is a coin flip too often.** Only about a third of block faces agree
  unanimously on which end is the back. The rest contain lots pointing the wrong
  way, and those are the units Adam saw in front gardens.

Where the sign flips: a house sited toward the rear of its own parcel, a corner
lot with two frontages, a deep lot with a detached garage at the back pulling
the footprint hull rearward, and any lot whose centroid falls inside the
building.

**The fix is not more geometry from the lot alone.** No amount of work on the
polygon recovers a fact that is not in it. It needs a street reference:

- **LION** or **CSCL** street centrelines — pick the lot edge nearest a
  centreline as the frontage, and "back" is the opposite end. This is the real
  fix and it is a day of work, including getting a centreline file into the
  pipeline without adding a geo stack.
- **Cheaper, and worth doing first as a check:** enforce agreement within a
  block face. Group by MapPLUTO `Block`, take the axial direction — which is
  already near-perfect — and resolve the sign by majority vote across the block.
  That does not tell you which way the street is, but it makes neighbouring lots
  consistent, which removes the specific visual absurdity of one house in a row
  with its cottage out front. It would be wrong for a whole block at a time
  rather than one lot at a time, which is more honest and much more visible.

Neither is in this pass. Until one is, the card, the legend and the manifest all
name the inference.

---

## 3. Setbacks and local rules, which Adam asked about directly

**Setbacks are in the model, and they are a control.** Five feet off the rear
lot line and five off each side, from ZR 23-341(b)(4), exposed as
`side_setback_ft`. What is *not* in the model:

- **No front setback, because the model has no front.** See §2. The unit is
  never placed against a street line because the street line is not known.
- **No separation between the ADU and the existing house.** The Zoning
  Resolution sets none for this case and the model does not invent one, so the
  unit may sit with its front wall against the back of the house. That is
  probably legal and certainly not buildable. It is not modelled either way.
- **No lot coverage or FAR test.** This is the open question the build doc
  flagged and it is still open. ZR 23-341 permits the ADU *in the required rear
  yard*; on a deep lot the ground between the house and that required yard is
  governed by coverage and FAR instead, and if a unit may go there the
  one-third rule is not the binding cap and the Queens result is materially less
  harsh. HPD's guidebook and eligibility tool both present the one-third rule as
  *the* cap, so modelling it that way is defensible — but it has never been
  checked against coverage.
- **No historic district design review, no BSA, no community board.** The
  historic-district flag exists and bars a lot outright, which is a
  simplification: LPC review is a process with an outcome, not a wall.
- **Nothing neighbourhood-specific below the zoning district.** Special purpose
  districts, R1-2A/R2A/R3A exclusions aside, are not read. Lower Density Growth
  Management Areas are not read.

Adam's framing was right — these are limitations to document, not to layer in.
The one that would change the answer is lot coverage, and it is already named in
the manifest as the open question that would move the number most.

---

## 4. The placement threshold is a knife edge, and that is a finding

Worth recording because it is not obvious and it makes the sandbox better rather
than worse.

The smallest unit the model will build is 300sf. At the plan library's median
proportion that is **14.5ft deep by 20.7ft wide**. With a 5ft setback it needs a
back garden **20.3ft deep**. The median Queens back garden, measured from the
real lot outline and the real footprint, is **20.2ft deep**.

The median lot misses by a foot. That is why the placeable share sits near a
half and moves so violently:

| side setback | lots with a lawful area | of those, a unit fits |
| --- | --- | --- |
| 0 ft | 38,887 | 22,359 (57.5%) |
| 3 ft | 38,887 | 18,647 (48.0%) |
| **5 ft** | **38,887** | **15,526 (39.9%)** |
| 8 ft | 38,887 | 10,997 (28.3%) |
| 10 ft | 32,485 | 9,063 (27.9%) |

And the binding dimension is depth, overwhelmingly:

- fails on depth alone — **42.1%**
- fails on width alone — 4.3%
- fails on both — 13.7%
- no rear box on record at all — 6.8%

So `side_setback_ft` swings the buildable stock by thirty points across its
range, almost entirely through the rear setback, and a reader who moves it is
watching the single most consequential number in the sandbox. That deserves
saying on the control, and currently is not said.

**Done in this pass.** The `side_setback_ft` description in `schema.json` now
carries the mechanism, the two median figures and the whole of that table, and
the `volumes` description says up front to expect far fewer solids than marks.

---

## 5. Smaller things carried forward

- **`lots.bin` is 12.8MB**, up from 8.9MB, for four floats per lot of rear-yard
  box. Three of the four could be a Uint16 in feet without losing anything —
  nothing here is precise to better than a foot. Worth doing if the payload ever
  becomes the reason someone does not wait for the page.
- **The 44,188 lots with no rear box** (17.9%) are a mix of no footprint on
  record, a centroid outside its own polygon, and a building already reaching
  the rear lot line. They are not separated. They should be, because the first
  is a data absence and the third is a finding.
- **Grid convergence.** The siting direction is measured against true north and
  the polygon against State Plane grid north; about a third of a degree over New
  York, three inches across a fifty-foot lot. Recorded in the manifest, below
  the noise floor of everything else here, and mentioned only so nobody
  rediscovers it as a bug.
- **The unit is drawn as a plain rectangle on purpose.** It is at a real floor
  area, a real proportion and the rule's real 15ft height, but it is not a
  design and it is not oriented by anything but §2's inference. Giving it a roof
  would be claiming more than the model has.

---

## What would actually be worth doing next, in order

Two of these were done in the same pass as the layout work and are struck
through; the rest are open.

- ~~**Draw both populations at once** (§1). The flat marks stay under the
  volumes and the legend counts lots that pencil, lots released and lots
  standing separately.~~
- ~~**Rewrite the `side_setback_ft` description** (§4). It turns a slider
  nobody reads into the one that carries the finding.~~
1. **Block-majority sign correction** (§2). Half a day, no new data, removes the
   most visually damaging error on the map.
2. **Split the 44,188 unsited lots by cause** (§5). An hour in the pipeline, and
   it converts an undifferentiated absence into one number that is a data gap
   and one that is a result.
3. **Lot coverage against the one-third rule** (§3). The open question that
   would move the headline number, and the only item here that could change what
   the sandbox concludes.
4. **LION frontage** (§2). The real fix for the front-garden problem, and the
   only one that makes the siting genuinely defensible rather than merely
   consistent.
