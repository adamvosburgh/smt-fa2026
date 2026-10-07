# What was taken, and what was changed

## The work

**micropolisJS**, by Graeme McCutcheon — a JavaScript port of **Micropolis**,
which is the open-source release of the original SimCity engine.

| | |
| --- | --- |
| Source | `https://github.com/graememcc/micropolisJS` |
| Commit | `f13a1624d111d235e804bd80f48ba7c9f66a8e0f` |
| Retrieved | 2026-08-31 |
| License | GNU GPL v3, with additional terms. See `vendor/LICENSE` and `vendor/COPYING`. |
| Name license | Micropolis Public Name License. See `vendor/MicropolisPublicNameLicense.md`. |

Micropolis is a registered trademark of [Micropolis Corporation (Micropolis GmbH)](https://www.micropolis.com) and is licensed here as a courtesy of the owner under the Micropolis Public Name License.

## What was taken

The complete `src/` tree of the upstream repository — 90 files, about 13,500
lines — copied to `vendor/src/` with every copyright and license header intact,
together with `LICENSE`, `COPYING`, `MicropolisPublicNameLicense.md` and
`README.md`.

All of it was taken rather than only the parts used, for two reasons. The
license bookkeeping is then simply "the whole tree at this commit", with no
judgment calls about what counts as a derived selection. And the sandbox is
partly an argument that a simulation of this consequence is small enough for one
person to read in an afternoon, which is a claim a student should be able to
check against the whole thing rather than an edited extract.

Only the headless simulation core is actually imported by the sandbox. The
engine's own user interface — its windows, its canvas, its toolbar — is not
used, and neither is jQuery, which only those files depend on.

The default tile atlas, `images/tiles.png` (512x512, 16px tiles, 32 per row,
1024 tiles), was copied to `static/coefficients/tiles.png`. It is loaded by URL
rather than imported, so that a submitted `tiles.png` replaces it with no code
change at all.

## What was NOT adopted

The upstream build setup — webpack, ts-loader, jest and their configuration.
Vite bundles the vendored source as part of this site instead. No source file
required any change to make that work.

## Naming

This sandbox is called **A City Simulator, Opened Up**. It is not called
Micropolis and it is not called SimCity. It is a modified version of micropolisJS and it does not
imply endorsement by Micropolis GmbH, by Graeme McCutcheon, or by anyone
associated with the original Micropolis or SimCity.

## Redistribution

`smt-fa2026` is licensed AGPL-3.0 and its repository is public. GPLv3 section 13
expressly permits combining GPLv3 code with an AGPLv3 work, so vendoring the
engine here is permitted and the source-availability obligation is met by the
public repository.

Student submissions to this sandbox are modified GPL code redistributed by this
site. They land in the same public repository, which satisfies availability. The
tutorial says so plainly: what you submit here is published under the same
license.

---

# Every change made to the vendored source

Each edit is marked in place with a comment beginning `SMT EDIT`. Searching the
tree for that string finds all of them.

## 1. Bug fixes

These are defects in the upstream source, not adaptations. Both were found by
running the engine, not by reading it.

### `src/blockMapUtils.js` — `crimeScan()` never ran

The scan loop was bounded by `crimeRateMap.mapWidth` and
`crimeRateMap.mapHeight`. `BlockMap` has no such properties — it exposes
`gameMapWidth` / `gameMapHeight` for the world size and `width` / `height` for
the block count. Both reads returned `undefined`, `0 < undefined` is false, and
the loop body never executed. These two lines were the only uses of those names
anywhere in the codebase.

So crime was dead code. `crimeRateMap` stayed zero everywhere for the life of
every city, `census.crimeAverage` was always exactly 0, and the land-value
penalty in `pollutionTerrainLandValueScan()` — which only fires when crime
exceeds 190 — could therefore never fire. The feedback loop between crime and
land value, which is the most-cited thing about this engine, was not running.

Nothing announced it. Cities still grew, the graphs still moved, and the crime
overlay was simply always empty.

**Changed to `gameMapWidth` / `gameMapHeight`.** With the fix, crime responds to
its constants: at the engine's own default base of 128 the average settles
around 92, at 40 it is 23, and at 220 it is 171 — and the population falls with
it, because the loop through land value is now closed.

### `src/simulation.js` — phase 9 threw on the first census

`take10Census(budget)` and `take120Census(budget)` referenced a bare `budget`
identifier that does not exist in that scope; the simulation's budget is
`this.budget`, as the tax branch three lines below uses correctly. Under ES
modules, which are always strict, this is a `ReferenceError`, so the census
threw the first time it ran.

**Changed to `this.budget`**, and `take120Census()` now takes no argument,
matching its own signature in `census.js`.

### `src/boatSprite.js` — dead import

`import { SpriteConstants } from './spriteConstants.ts'` imports a binding that
module does not export, and which the file never uses; the line above it already
imports `SPRITE_SHIP` correctly. Upstream's webpack tolerated it. A stricter ESM
bundler treats it as a missing export and fails the build. **Line removed.**

## 2. One addition

### `src/simulation.js` — `simTickImmediate()`

`_simFrame()` is throttled against the wall clock: it returns early unless at
least 10 to 100 real milliseconds have passed, depending on the speed setting.
So "speed" is a real-time rate limiter, and how far a city has advanced depends
on how long it sat on screen and how fast the machine is. Calling `simTick()` in
a loop simulates almost nothing.

That is right for a game and wrong for three things this sandbox needs: the
divergence chart runs thousands of steps headlessly in a worker, the cover
screenshot must be reproducible at a fixed tick count, and a submitted city has
to replay to the state its author is arguing about. All three need one call to
mean one step, with no clock in it.

`simTickImmediate()` is **added alongside** `simTick()`. Nothing existing was
changed, and the original timing behavior is untouched.

## 3. Constants lifted out

The engine's tunables were function-local literals. Each now reads a named value
from `coefficients.json` through `../../tunables.js`, at call time, so a changed
constant affects a city that is already running. **No default was altered**:
every value in `coefficients.json` was read from this commit and matches it.

| File | What was lifted |
| --- | --- |
| `src/blockMapUtils.js` | The crime function (base `128`, the land-value, density and police terms, the intermediate clamp at `300`, the output range `0`–`250`). The land-value gradient (`34`, the distance divisor `2`, the `<< 2` shift, the crime threshold `190` and its `-20` penalty, the output range `1`–`250`). The per-tile pollution values (`75`, `50`, `90`, `255`, `50`, `100`) and their clamp at `255`. The smoothing pass counts for police, pollution and population density. |
| `src/traffic.js` | `MAX_TRAFFIC_DISTANCE = 30`. |
| `src/valves.js` | `birthRate 0.02`, `labourBaseMax 1.3`, `internalMarketDenom 3.7`, `taxTableScale 600`, `extMarketParamTable [1.2, 1.1, 0.98]`, and the 21-value `taxTable` running from `200` to `-600`. |

Where a count of unrolled calls became a loop — the smoothing passes — the
alternation between source and destination map is preserved exactly, including
the consequence that an odd number of passes leaves the last write in the other
map. That is the engine's own behavior at its defaults and it is kept.

## 4. Randomness

`src/random.ts` is the engine's only source of randomness: all 112 `Random.*`
call sites across 24 files go through it, and there is no bare `Math.random`
anywhere in the tree. Its `getRandom()` already accepted an injectable object
shaped like `Math`.

**One default parameter changed**, from `Math` to the seeded generator in
`../../tunables.js`. That is the whole of the change required to make every run
reproducible.

## 5. What is deliberately NOT wired

A submitted `rules.js` replacing one of the engine's rules is designed for and
prepared — `tunables.js` carries the function table, and the engine calls
through it — but **nothing loads submitted code**. Running a student's
JavaScript on a public site is arbitrary code execution in every visitor's
browser, and how to contain it is an open decision. Until it is made, the
function table only ever holds the defaults.
