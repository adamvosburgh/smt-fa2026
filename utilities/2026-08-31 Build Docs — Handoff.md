---
title: Build Docs — Handoff to Claude Code
date: 2026-08-31
type: content
---

> **These are now BUILT. Read
> `2026-08-31 Build Notes — What The Build Changed.md` first.**
> Several factual claims below were checked during the build and turned out to
> be wrong — datasets that are not what they say, an engine bug that had
> disabled a whole subsystem, and a join that validated cleanly while being
> wrong one time in five. Where that document and this one disagree, that one is
> later and was checked against the data.
> All three are built. 02 and 04 are complete; 03 ships without its agent layer.
> The `numpy` npm dependency flagged at the end of this doc has been removed.


# Handoff

Three build docs sit beside this one: sandboxes **02 Does It Pencil**, **03 After Five**, **04 The Coefficients**. They are specifications, not code. Claude Code builds from them inside `smt-fa2026`.

Spec source for all three: `2026-08-28_Content/2026-08-30 Sandboxes.md`. Where a build doc and the spec disagree, the build doc is newer and wins — the disagreements are noted in place.

---

## Read before starting

In this order.

| | |
| --- | --- |
| `CLAUDE.md` | Repo rules, platform traps, terminology, the sandbox contract. |
| `src/lib/sandboxes/bathtub/` | The reference implementation. All five files. |
| `data/scripts/bathtub.py` | Docstring especially — it is the template for a pipeline header. |
| `src/content/tutorials/07-bathtub.md` | Tutorial shape and the four required anchors. |
| `src/lib/components/SandboxFrame.svelte`, `ParamPanel.svelte` | What the schema can ask the panel to draw. |

Bathtub is the only finished sandbox. It is finished on purpose, as a reference. Copy its structure before inventing one.

---

## Prose

**Every word of prose in these builds is a draft.** Write it terse and explanatory: say what the thing is, what it does, what it assumes, in plain declarative sentences. Do not attempt the course voice — the style guide that defines it is not in this repo, and a wrong-voice draft is harder to fix than a flat one.

So: no contractions-as-a-goal, no first person, no rhetorical questions, no jokes. Short sentences. Correct facts. A later pass rewrites all of it against `utilities/writing-style-guide.md`.

Mark every prose file you write with this as its first line, so the rewrite pass can find them:

    <!-- PROSE DRAFT: written for accuracy, not voice. Rewrite against the style guide. -->

In a `.md` file put it under the frontmatter. In `meta.js` put the same sentence as a comment at the top.

Writing flat prose is not permission to write less of it. The `blurb`, the schema `description` fields, `card.md` and the tutorial all carry the actual teaching content, and they need the substance in them. A placeholder is a failure; a plain sentence is not.

**One rule of content, not style, that survives the rewrite: explain first, critique second.** Say how the model works before saying what it can't do. This ordering is why the card sections are in the order they are.

---

## What each sandbox is made of

Bathtub's file list, which is the checklist.

| Path | What it is |
| --- | --- |
| `src/lib/sandboxes/<slug>/meta.js` | Registry entry. Title, subtitle, blurb, controls, metrics, data, cannotSee, tutorial path, status. `src/lib/server/assistant-prompt.js` reads `subtitle`, `controls` and `cannotSee` verbatim into the course assistant's prompt, so those three must agree with `card.md`. |
| `src/lib/sandboxes/<slug>/schema.json` | JSON Schema. Draws the control panel *and* validates submitted params server-side. One file, two jobs. |
| `src/lib/sandboxes/<slug>/<Name>.svelte` | The component. Replaces the `NotBuilt` stub already there. |
| `src/lib/sandboxes/<slug>/*.js` | Supporting modules. Bathtub splits `FloodLayer.js` (what is drawn) from `metrics.js` (what the panel says). |
| `src/lib/sandboxes/<slug>/card.md` | The panel card. Six fixed sections, below. |
| `data/scripts/<slug>.py` | The pipeline. Reads `data/original/`, writes `data/processed/<slug>/`. Docstring is the authoritative record of inputs and fields taken. |
| `data/processed/<slug>/` | What ships. Committed. Mirrored into `static/` by `npm run sync`. |
| `src/content/tutorials/<nn>-<slug>.md` | The tutorial. |
| `src/submissions/_example/<slug>/` | One worked example submission, so the gallery and the doctor have something to run against. |

Plus four edits outside the sandbox folder, all easy to forget:

- `src/lib/sandboxes/index.js` — add the schema import and its entry in the `schemas` map. The meta import and the lazy loader are already there.
- `meta.js` — set `tutorial` to the tutorial path and `status` off `'planned'`.
- `data/scripts/README.md` and `data/original/README.md` — add the rows. `original/` is gitignored, so its README is the only record that a source was ever downloaded.
- `npm run covers` — regenerate covers once the sandbox renders.

---

## The contract

Restated from `CLAUDE.md` because every one of these three breaks it if you are not watching.

- Props in: `params`, `assets`, `mode` (`'edit' | 'view'`), `dataBase`, and the callbacks `onmetrics(obj)` and `onready(bool)`.
- **The component never sets `window.__metrics` or `data-cover-ready`.** It reports; `SandboxFrame` publishes. A sandbox that recomputes asynchronously calls `onready(false)` when it starts and `onready(true)` when it has settled.
- **Every sandbox renders from static data**, read from `dataBase`, which points at either an API route or static files. Nothing in the component knows which. None of these three has a live source.
- Add a control in `schema.json`, never in the panel component.
- **Property order in `schema.json` is the panel's reading order.** Order it as a narrative.
- The picture and the numbers must come from the same data by the same formula. Bathtub decodes the same PNGs twice, once on the GPU and once on the CPU, rather than keeping a second copy of the truth. Hold to that.
- A control that changes nothing is a bug. Check every control against what the component actually reads.

### Schema vocabulary the panel understands

`x-group` (starts a labelled section, lowercase), `x-step` (slider granularity — **use this, never `multipleOf`**; the comment in bathtub's schema explains why), `x-unit`, `x-enum-labels`, `x-emphasis` (visually marks the one or two controls that carry the sandbox), `x-disabled-when` + `x-disabled-note` (greys a control while another decides its value — and the panel never writes the derived value back; the component derives it).

Ajv runs with `strict: false`, so `x-` keywords are safe.

### `description` fields are teaching text

They are the notes printed under each control in the panel. They carry the explanation: what the control means, what it does to the model, what the real world does differently. Bathtub's `percentile` and `connectivity` descriptions are the length and register to match.

---

## card.md

Six `##` headings, identical across every sandbox so the shape is learnable:

**What this is** · **Why we're looking at this one** · **The data** · **How the map gets made** · **What it assumes** · **What it can't see**

First section is plain language for someone who has never seen the work. The rest are concise and technical. "How the map gets made" keeps that wording even where the output is not a map — the phrasing is the convention.

Keep `card.md` and `meta.js` in agreement. `subtitle`, `controls` and `cannotSee` live in `meta.js` because `assistant-prompt.js` feeds them to the course assistant.

---

## Tutorials

**The headings are an API.** `FAILURE_MAP` in `src/lib/server/validate.js` points students at them by name. These four `##` headings must appear, spelled exactly, in this order:

```
## Producing the data
## Setting up the web environment
## The parameters
## The assumptions
```

An optional framing section may come before them (bathtub's is `## On simplification`) and `## Challenge` closes. Nothing else.

Every tutorial also carries a `<div class="gap">` block stating what the sandbox can do that the tutorial version won't. Don't hide it, and don't make it up — if the tutorial version really is the whole thing, say that.

Frontmatter matches bathtub's: `title`, `date`, `author`, `sequence`, `cat: tutorial`, `published`.

A tutorial embeds a live sandbox with a mount div, never a component tag:

```html
<div data-sandbox="pencil" data-mode="view" data-params='{...}'></div>
```

---

## Data

`CLAUDE.md` says never invent data. In practice, for these three:

1. **Every field name, dataset ID and figure gets checked against the actual file or the actual publisher before it goes in a script.** Each build doc marks which of its facts were verified on 2026-08-31 and which were not. Re-verify anything not marked verified. Do not carry an unverified figure into code without a note.
2. **If a dataset named in a build doc turns out not to exist**, stop and say so in the doc's open questions rather than substituting something similar and quietly moving on. Two of the sources named in these docs may not exist as published layers; both are flagged.
3. **Total every join against a published figure before believing it.** This is how the two bathtub join bugs were found. `data/scripts/bathtub.py` and the bathtub tutorial both describe them.
4. **Never edit anything in `data/original/` in place.** Fix it in the script.
5. The pipeline's job is not compression, it is **reshaping** — ship the file that turns the browser's computation into a comparison. Each doc says what that file is for its sandbox. This is the single most important design decision in each pipeline and it is where the assumption hides.
6. `data/original/nyc_mappluto_26v2_shp/MapPLUTO.dbf` and `2020_Census_Tracts_20260830.geojson` are **already downloaded** for bathtub. Sandboxes 02 and 03 both read MapPLUTO. Reuse the file and reuse `bathtub.py`'s DBF reader — it seeks fixed-width records with no geo stack, which is why it can read 856,687 records without geopandas.

---

## Order

Build **04 first, 02 second, 03 last**, which is the order in the spec and the order of increasing risk.

- **04** has no data pipeline at all. The engine exists. The work is exposure, a refactor, and two decisions (below). Fastest to something finished.
- **02** is the heaviest data preparation of the three but has no novel rendering.
- **03** has the most moving parts and two unresolved sources. Do not start it until 02 ships.

### Two things get built once and shared

- **MapLibre + deck.gl bootstrap.** Sandboxes 02 and 03 both need it, and bathtub already contains the two fixes that make it work: handing MapLibre a Vite-emitted worker (`maplibre-gl-worker.mjs?worker&url`), and never awaiting the `load` event before drawing. Extract to `src/lib/sandboxes/_shared/maplibre.js` **when 02 needs it**, not before — one consumer is not a shared module. Do not re-derive the fixes; read the comments in `Bathtub.svelte`.
- **Extruded massing from the DCP 3D Building Model.** 02 (optionally) and 03 (necessarily). Whoever builds it first writes the loader; the second uses it.

### Two decisions belong to Adam, not to you

Both are in the 04 doc and both change what gets built. Surface them before writing the code they affect, and build the safe path in the meantime.

---

## Repo hygiene

- **Never `git commit` or `git push`.** Leave the working tree dirty and say what you changed.
- Kill any dev server you start.
- Checking an HTTP status is not verification. Check the browser console — the failure mode in this repo is a clean 200 and a dead page.
- Run `npm run audit:freeze` before believing the freeze still works. Anything that can't render from static data does not ship.
- Aside: `package.json` lists `"numpy": "^0.0.1"` as an npm dependency. That is not a real package for this project — nothing imports it, and the name is squatted on npm. Flag it to Adam and don't install it.
