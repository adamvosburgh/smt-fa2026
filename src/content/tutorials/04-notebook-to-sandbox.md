---
title: "From a Notebook to a Sandbox"
date: "2026-09-06"
author: Adam Vosburgh
sequence: 4
cat: tutorial
published: true
publish: "2026-10-01"
---

This module covers building software by describing it in writing. We will take the last two tutorials, which together are a small model of the street trees of upper Manhattan, and turn them into a sandbox like the [five on this site](/sandboxes/): a page with a map, a clock, and a panel of controls, that anyone can use in a browser. We will not write the code ourselves. We will write three documents, and read two of them carefully.

This is how the five course sandboxes were made. Each one took longer than I expected, and most of that time was spent finding a number the model had made up, or a rule it had implemented differently from what I wrote. Working this way moves the effort from typing code to specifying what the code should do and checking that it does it.

<div class="gap">

**What the class version has that yours won't.** The sandbox sketched here reads the same 12,715 trees your notebook did. A fuller version would take the whole 2015 census (about 666,000 trees) and match species to i-Tree's own equations. Neither change affects the method.

</div>

## What we're building

Before writing anything, let's decide what the thing is. Here is my first sketch of a street tree sandbox. Yours, for the assignment, will be for your own forecast, but the parts are the same.

![wireframe of the street tree sandbox][WIRE]

There are three columns, the same layout as every sandbox on this site. On the left is the card: what this is, what it is trying to show, how it works, what it assumes, what it can't see, and a list of metrics that update as you move the controls. In the middle is the map: census blocks tinted by a chosen metric, trees drawn as circles sized by trunk diameter, and a year slider along the bottom. On the right are the controls, in a specific order:

1. **The clock.** Year, 2015 to 2045, with play and pause.
2. **How it's drawn.** Which metric tints the blocks; whether to draw trees, blocks or both.
3. **The main levers.** Trees planted per year and where they go (blocks with the fewest trees first, blocks with the lowest per-tree benefit first, or evenly); the size of a newly planted tree; the growth rate; and mortality, which defaults to zero because I do not have a number I am confident in.
4. **The finer assumptions.** Everything else that was a constant in the notebook: the crown coefficients `a` and `b`, the three LAI values, the interception fraction, annual precipitation, and the social cost of carbon. Each is labelled with where its default comes from.

The order matters. Someone who has not seen the sandbox before should find the clock first, then the controls for reading the picture, then the controls worth changing, and last the assumptions. The levers are the assumptions from Tutorial 3, made visible. Where I could not find a source for a number, I made it a control and labelled it as mine rather than leaving it as a constant in the code.

The sketch deliberately leaves two things out: anything specific to species, and any information about budgets, sidewalks, or utility lines. Those go in the card, under what it can't see.

## The three documents

![the three documents][DOCS]

- **The brief** is yours. It says what the sandbox shows, where the data comes from, what the rule is (with every number and where it came from), what the controls are, and what the clock does. It is written for a reader who has not seen your notebook. The brief is the document that carries your authorship, and it is uploaded with your work.
- **The build doc** is the plan. You give the brief to an LLM and ask it to turn the brief into instructions for a coding agent: a file layout, the shape of the data, a table of controls with defaults, the rule in pseudocode, and a list of checks that the finished thing has to pass. You read it before any code exists, because reading a plan is faster than reading code.
- **The code** is what a coding agent produces from the build doc. It is one HTML file, with the data inside it, that runs with no internet connection. You check it against your notebook.

The reason for the middle document is that invented numbers and added features are easier to catch in a plan than in code, and that writing the acceptance checks first means you know what "done" means before something that looks finished is in front of you.

## Step 1: Export the data from the notebook

The sandbox needs the trees and the blocks, in the smallest form that still works. Back in your Tutorial 3 notebook, after Step 7, run this. It writes one JSON file with the block outlines (simplified, since we do not need survey precision) and the per-tree columns the rule uses.

```python
import json

# Blocks: simplified outlines plus an id. ~5 m tolerance is plenty at this scale.
blocks_out = gdf_blocks[['BCTCB2010', 'geometry']].copy()
blocks_out['geometry'] = blocks_out['geometry'].to_crs(epsg=2263).simplify(15).to_crs(epsg=4326)
blocks_geojson = json.loads(blocks_out.to_json())

# Trees: only what the rule needs. Health as a small integer to keep the file small.
health_code = {'Good': 2, 'Fair': 1, 'Poor': 0}
trees_out = gdf_joined[['longitude', 'latitude', 'tree_dbh', 'health', 'BCTCB2010']].copy()
trees_out['h'] = trees_out['health'].map(health_code).fillna(-1).astype(int)

data = {
    'source': '2015 Street Tree Census (subset, upper Manhattan); 2010 Census Blocks (subset)',
    'blocks': blocks_geojson,
    'trees': {
        'lon': trees_out['longitude'].round(6).tolist(),
        'lat': trees_out['latitude'].round(6).tolist(),
        'dbh_in': trees_out['tree_dbh'].fillna(0).round(1).tolist(),
        'health': trees_out['h'].tolist(),
        # A few hundred trees at the edge of the subset fall outside every block; they get ''
        'block': trees_out['BCTCB2010'].fillna('').tolist()
    }
}

with open('street-trees.json', 'w') as f:
    json.dump(data, f, separators=(',', ':'))

files.download('street-trees.json')
```

Check the size of the file it downloads. It should be under one megabyte. That, plus the HTML around it, has to stay under the site's 15MB cap. If it is bigger, round the coordinates to fewer decimals or simplify the outlines more.

While you are in the notebook, write down three numbers: the total gallons per year at 2015 from Step 10's baseline run, the same figure at 2045, and the 2045 figure from the slow run. These are the acceptance checks. If the sandbox does not reproduce them at its defaults, it is not implementing the model you built.

## Step 2: Write the brief

Make a folder on your computer called `street-trees` and put `street-trees.json` in it. Then make a file called `brief.md` and write it. Here is mine for the tree sandbox. The headings are the template for yours.

```markdown
# Street Trees, Run Forward

## What it shows
The 12,715 street trees of a piece of upper Manhattan (roughly 105th to 141st
Street), each run through one set of equations for the rain it intercepts and
the CO2 it takes in, summed by census block, and grown forward one year at a
time from 2015 to 2045. A planting lever adds trees each year and a slider says
where they go. It is meant to show the pattern of estimated benefit across
blocks, and how much that pattern changes when the assumptions change.

## The data
`street-trees.json`, exported from a notebook.
- `blocks`: GeoJSON FeatureCollection, property `BCTCB2010`. 2010 Census Blocks
  (NYC Open Data v2h8-6mxf), subset and simplified.
- `trees`: parallel arrays `lon`, `lat`, `dbh_in` (trunk diameter, inches; 0
  means unknown, treat as missing), `health` (2 good, 1 fair, 0 poor, -1
  unrated), `block` (the tree's BCTCB2010, or '' for the few hundred at the edge
  that fall outside every block; they count in totals but in no block). 2015
  Street Tree Census (NYC Open Data pi5s-9p35), subset. Trees with dbh_in 0 are
  excluded from everything.
Nothing else is fetched. The file is embedded in the page.

## The rule (per tree, per year)
Units in brackets. Sources after each number; "ours" means I chose it.
1. dbh_cm = dbh_in * 2.54
2. crown_width_m = a * dbh_cm ^ b          a = 1.22, b = 0.65 (ours, generalized
   deciduous urban tree)
3. crown_area_m2 = pi * (crown_width_m / 2)^2
4. lai = 4.0 good / 2.5 fair / 1.0 poor / 0 unrated (Nowak 1996)
5. leaf_area_m2 = crown_area_m2 * lai
6. stormwater_gal_yr = leaf_area_m2 * 1.181 * 0.15 * 264.17
   (1.181 m/yr NOAA normal 1991-2020; 0.15 interception fraction, conservative,
   from the i-Tree Eco validation range)
7. biomass_kg = exp(-2.4800 + 2.4835 * ln(dbh_cm))   (Jenkins et al. 2003,
   mixed hardwood)
8. co2_kg_yr = biomass_kg * 0.5 * growth * 3.667   (Nowak & Crane 2002;
   growth default 0.04)
9. co2_value_usd = co2_kg_yr / 1000 * scc          (scc 51 or 190, EPA)
Each year: dbh_in *= growth_factor where growth_factor = (1 + growth)^(1/2.4835)
(derived from 8, so that growth is one assumption rather than two). Then remove a `mortality` share of
trees at random (default 0, ours). Then plant `planted_per_year` new trees at
`planting_dbh_in`, placed per `planting_rule`, at a random location inside the
chosen block.

## Controls, in this order, with defaults
Clock:            year [2015..2045], default 2015, plays at 2 years/second, loops
Drawing:          tint = stormwater | co2 | count | per_tree (default stormwater);
                  draw = trees | blocks | both (default both)
Main levers:      planted_per_year [0..500] default 0 (ours)
                  planting_rule = fewest_trees | lowest_per_tree | even (default fewest_trees)
                  planting_dbh_in [2..4] default 3 (ours)
                  growth [0..0.08] default 0.04 (Nowak & Crane 2002)
                  mortality [0..0.06] default 0 (ours, unsourced)
Finer:            a [0.8..1.6] default 1.22; b [0.5..0.8] default 0.65 (ours)
                  lai_good [2..6] 4.0; lai_fair [1..4] 2.5; lai_poor [0..2] 1.0 (Nowak 1996)
                  interception [0.05..0.4] default 0.15 (i-Tree Eco range)
                  precip_m [0.8..1.6] default 1.181 (NOAA)
                  scc = 51 | 190 (EPA, two administrations' figures)

## Metrics, recomputed on every change
trees alive; total stormwater gal/yr; total co2 kg/yr; value $/yr; median per-tree
stormwater; blocks with zero trees; share of total stormwater in the top 10% of
blocks.

## What you should see
At the defaults in 2015: about 150 million gal/yr from 12,479 trees (the
notebook's figure; put your exact one here). At 2045: about 277 million. With
growth at 0.02, 2045: about 204 million. Planting 200 a
year, fewest-trees-first, should visibly fill the empty blocks by the 2030s and
lower the top-10% share.

## What it can't see
Species. Sidewalk width, utilities, budgets, who plants. Park trees and yard
trees. Storms, drought, disease. Real mortality. Anything after 2015 that
actually happened.

## Constraints
One self-contained `index.html`: styles, script and data inline, no network
requests, no build step, under 15MB. Plain JavaScript and SVG or canvas; a
mapping library is fine only if it is inlined. Runs when opened from disk.
```

The brief has units, ranges, defaults and sources, and it says which numbers are mine. Anything the brief leaves open will be decided by the model in the next two steps, and the model will not tell you that it decided.

## Step 3: From the brief to a build doc

Open whatever LLM you use (the course assistant is not built for this; use Claude, ChatGPT, Gemini or a local model) and give it the brief with this prompt, or something like it:

> Read the attached brief for a small browser-based simulation. Write a build document for a coding agent that will implement it as one self-contained HTML file. The build document should contain: the file layout; a description of the data file's structure as the code will read it; a table of every control with its type, range, default and label; the rule as pseudocode, with every constant taken from the brief and none added; how the year loop and the planting rule work; how the map is drawn; and a list of acceptance checks the finished page must pass, including the numbers under "What you should see." Before you write, ask me about anything in the brief that is ambiguous. Do not add features the brief doesn't ask for. Do not invent any number that isn't in the brief; where the brief leaves something open, say so and propose a default marked as yours.

Then read what comes back with the brief next to it. Check the following:

- Every number in the build doc appears in the brief. If one does not, find out where it came from.
- The units are the same as in the brief. Inches stay inches until the rule converts them.
- The acceptance checks are specific. "The page should render correctly" is not a check.
- Nothing has been added. A build doc that includes a species dropdown you did not ask for will produce a sandbox that shows data you do not have.
- Where the model made a choice (a map library, how to lay out the panel), it says so.

Save it as `build.md` in the same folder. If reading it changed your mind about something, change the brief as well as the build doc, so that the brief stays the record of what you asked for.

## Step 4: Hand it to a coding agent

A coding agent is an LLM that can read and write files on your computer and run commands. We will use Claude Code, which runs in the terminal. The install instructions are in [its documentation](https://docs.claude.com/en/docs/claude-code). Codex, Gemini CLI, Cursor and others do the same job and you are welcome to use any of them. The steps below are the same in each apart from the command names.

Open a terminal in your `street-trees` folder (on a Mac, right-click the folder in Finder > `New Terminal at Folder`; on Windows, `shift` + right-click > `Open PowerShell window here`). Start the agent, and give it this:

> Read brief.md and build.md in this folder. Build exactly what build.md describes, as a single file index.html with street-trees.json embedded in it. Before you write any code, tell me your plan in a few sentences and ask me anything you need to. When you're done, tell me how to run the acceptance checks in build.md.

It will ask questions. Answer them from the brief. It will then work for a few minutes and produce `index.html`. Open the file in a browser (double-click it). Something will probably be wrong, and you are in a position to see what, because you built the same model by hand last week.

Tell the agent what is wrong in plain language. "The total in 2015 is 40% higher than my notebook's; check the interception step" is more useful than "it's broken". Two or three rounds is typical. If it starts adding things you did not ask for, say so. If it cannot fix something after a couple of tries, ask it to explain how it implemented that step and compare the explanation with the brief yourself. The error is usually a unit conversion or an off-by-one in the year loop.

## Step 5: Check it

Before you upload, go through this list. None of it requires reading the code.

- At the defaults, in 2015, the total stormwater matches your notebook's Step 10 baseline, and at 2045 as well. Set growth to 0.02 and check 2045 against the slow run.
- Every control's default is the brief's default, and every label says whose number it is.
- Turn off your wifi and reload the page. It should still work. If it does not, the page is fetching something, and it will not work on the course site.
- The file is under 15MB.
- The card says what the sandbox can't see, in your own words.

If the totals do not match, the error could be in the sandbox or in the notebook. Find out which.

## Step 6: Upload it

Go to [Assignment 4](/assignments/assignment-04/), click `Submit your work`, and attach `index.html` as the work and `brief.md` and `build.md` as the extra files. The gallery runs your page in a frame that cannot reach the network, which is why the file has to be self-contained. Write the gallery text and the description yourself.

## What you did

You wrote a rule down precisely enough that a machine could build it, and then you checked that it did. You did not write the code yourself. The risk of working this way is that the model will make a decision wherever the brief did not, and it will not tell you it has done so. The brief is where you prevent that, and the notebook is how you check whether it happened.

## Assignment 4

Do the same for the forecast you sketched in Assignment 3. Details on the [assignment page](/assignments/assignment-04/). Due 10/8, for the pin-up.

---
Module by Adam Vosburgh, Fall 2026.

[WIRE]: /tutorials/images/w4/street-trees-wireframe.svg#img-full
[DOCS]: /tutorials/images/w4/three-documents.svg#img-full
