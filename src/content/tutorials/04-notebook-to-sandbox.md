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

**What the class version has that yours won't.** The sandbox sketched here reads the same 12,715 trees your notebook did. A fuller version would take the whole 2015 census (about 666,000 trees). That change doesn't affect the method.

</div>

## What we're building

Before writing anything, let's decide what the thing is. Here is my first sketch of a street tree sandbox. Yours, for the assignment, will be for your own forecast, but the parts are the same.

![wireframe of the street tree sandbox][WIRE]

There are three columns, the same layout as every sandbox on this site. On the left is the card: what this is, what it is trying to show, how it works, what it assumes, what it can't see, and a list of metrics that update as you move the controls. In the middle is the map: census blocks tinted by a chosen metric, trees drawn as circles sized by trunk diameter, and a year slider along the bottom. On the right are the controls, in a specific order:

1. **The clock.** Year, 2015 to 2045, with play and pause.
2. **How it's drawn.** Which metric tints the blocks; whether to draw trees, blocks or both.
3. **The main levers.** Trees planted per year and where they go (always on a sidewalk; blocks with the fewest trees first, blocks with the lowest per-tree benefit first, or evenly); the size and species of a newly planted tree; and how trees die at the Northeast guide's rates: not at all, as an average, or at random.
4. **The finer assumptions.** The constants from the notebook that are not species equations: the rainfall, the interception fraction, and the price of carbon. Each is labeled with where its default comes from.

The order matters. Someone who has not seen the sandbox before should find the clock first, then the controls for reading the picture, then the controls worth changing, and last the assumptions. The levers are the assumptions from Tutorial 3, made visible. Where a number is my choice rather than i-Tree's, the control says so.

The sketch deliberately leaves out any information about budgets, sidewalks, or utility lines. Those go in the card, under what it can't see.

## The three documents

![the three documents][DOCS]

- **The brief** is yours. It says what the sandbox shows, where the data comes from, what the rule is (with every number and where it came from), what the controls are, and what the clock does. It is written for a reader who has not seen your notebook. The brief is the document that carries your authorship, and it is uploaded with your work.
- **The build doc** is the plan. You give the brief to an LLM and ask it to turn the brief into instructions for a coding agent: a file layout, the shape of the data, a table of controls with defaults, the rule in pseudocode, and a list of checks that the finished thing has to pass. You read it before any code exists, because reading a plan is faster than reading code.
- **The code** is what a coding agent produces from the build doc. It is one HTML file, with the data inside it, that runs with no internet connection. You check it against your notebook.

The reason for the middle document is that invented numbers and added features are easier to catch in a plan than in code, and that writing the acceptance checks first means you know what "done" means before something that looks finished is in front of you.

## Step 1: Export the data from the notebook

The sandbox needs the trees and the blocks, in the smallest form that still works. It also needs to know where a new tree could go. These are street trees, so a planted tree has to go on a sidewalk, not in a park, a highway median or the edge of the river. None of our datasets has sidewalks in it, so we will make a list of possible planting sites from a third dataset: the city's street centerline, which has a line down the middle of every street, a code for what kind of road it is, and the street's width from curb to curb.

- **NYC Street Centerline** (`nyc_street_centerline_um.geojson`). In the course folder, under the name of this tutorial. It is a subset of the full citywide file for the same area, with the four columns we use. The full file is [Centerline](https://data.cityofnewyork.us/City-Government/Centerline/inkn-q76z) on NYC Open Data.

Back in your Tutorial 3 notebook, after Step 10, upload it:

```python
uploaded = files.upload()
```

The site rule is: take ordinary streets only (`rw_type` 1, which leaves out highways, ramps, bridges and park paths), and not the ones flagged as closed to pedestrians. Find the curb on each side, which is half the street's width from the centerline, and step 3 feet back from it onto the sidewalk. Put a site every 25 feet along that line, starting 40 feet from each end of the segment so that corners stay clear. Then drop any site that is not inside a block, that falls in the roadway of another street, or that is within 15 feet of a tree that is already there. Those four distances are mine, not a planting standard, and the brief says so.

```python
# Planting sites along sidewalks. All four distances are ours, in feet.
curb_setback_ft = 3     # behind the curb
site_spacing_ft = 25    # between sites
corner_clear_ft = 40    # from each end of a segment
tree_clear_ft = 15      # from an existing tree

gdf_Streets = gpd.read_file('/content/nyc_street_centerline_um.geojson').to_crs(epsg=2263)
gdf_Streets = gdf_Streets[(gdf_Streets['rw_type'] == '1')
                          & gdf_Streets['nonped'].isna()
                          & gdf_Streets['streetwidth'].notna()]
gdf_Streets['streetwidth'] = gdf_Streets['streetwidth'].astype(float)

# Walk along a line set back from each curb, dropping a point every 25 ft
points = []
for geom, width in zip(gdf_Streets.geometry, gdf_Streets['streetwidth']):
    for line in getattr(geom, 'geoms', [geom]):
        for side in (1, -1):
            sidewalk = line.offset_curve(side * (width / 2 + curb_setback_ft))
            for part in getattr(sidewalk, 'geoms', [sidewalk]):
                for d in np.arange(corner_clear_ft, part.length - corner_clear_ft, site_spacing_ft):
                    points.append(part.interpolate(d))
gdf_Sites = gpd.GeoDataFrame(geometry=points, crs='EPSG:2263')

# Keep sites inside a block, and take that block's id
blocks_ft = gdf_Blocks[['BCTCB2010', 'geometry']].to_crs(epsg=2263)
gdf_Sites = gpd.sjoin(gdf_Sites, blocks_ft, how='inner', predicate='within').drop(columns='index_right')

# Drop sites in the roadway of another street (this happens near intersections)
roadways = gpd.GeoDataFrame(geometry=gdf_Streets.geometry.buffer(gdf_Streets['streetwidth'] / 2), crs='EPSG:2263')
in_road = gpd.sjoin(gdf_Sites, roadways, how='inner', predicate='within').index.unique()
gdf_Sites = gdf_Sites.drop(in_road)

# Drop sites next to a tree that is already there
trees_ft = gdf_StreetTree[['geometry']].to_crs(epsg=2263)
near_tree = gpd.sjoin_nearest(gdf_Sites, trees_ft, max_distance=tree_clear_ft, how='inner').index.unique()
gdf_Sites = gdf_Sites.drop(near_tree)

# Avenues with a median have a centerline for each side, so some sites land on top of each other. Keep one.
halos = gdf_Sites.set_geometry(gdf_Sites.buffer(site_spacing_ft / 2))[['geometry']]
pairs = gpd.sjoin(gdf_Sites[['geometry']], halos, predicate='within')
gdf_Sites = gdf_Sites.drop(pairs[pairs.index > pairs['index_right']].index.unique())

print(f"{len(gdf_Sites):,} planting sites in {gdf_Sites['BCTCB2010'].nunique()} of {len(gdf_Blocks)} blocks")
gdf_Sites = gdf_Sites.to_crs(epsg=4326)
```

Draw them over the trees before going on, and zoom in on a few streets. The sites should sit in the gaps between existing trees, on both sides of every ordinary street, and nowhere else.

```python
chart_Sites = alt.Chart(pd.DataFrame({'lon': gdf_Sites.geometry.x, 'lat': gdf_Sites.geometry.y})).mark_circle(
    size=4, color='red'
).encode(
    longitude='lon:Q',
    latitude='lat:Q'
)

chart_Trees = alt.Chart(df_StreetTree).mark_circle(size=4, color='darkgreen').encode(
    longitude='longitude:Q',
    latitude='latitude:Q'
)

(chart_Trees + chart_Sites).project(type='mercator').properties(width=700, height=700)
```

![planting sites][SITES]

Now write one JSON file with the block outlines (simplified, since we do not need survey precision), the per-tree columns the rule uses, the species equations, and the sites.

```python
import json

# Blocks: simplified outlines plus an id. ~5 m tolerance is plenty at this scale.
blocks_out = gdf_Blocks[['BCTCB2010', 'geometry']].copy()
blocks_out['geometry'] = blocks_out['geometry'].to_crs(epsg=2263).simplify(15).to_crs(epsg=4326)
blocks_geojson = json.loads(blocks_out.to_json())

# Trees: only what the rule needs
trees_out = gdf_joined[['longitude', 'latitude', 'tree_dbh', 'SpCode', 'BCTCB2010']].copy()

data = {
    'source': '2015 Street Tree Census (subset, upper Manhattan); 2010 Census Blocks (subset); NYC Street Centerline (subset); Urban Tree Database (Queens equations)',
    'blocks': blocks_geojson,
    'trees': {
        'lon': trees_out['longitude'].round(6).tolist(),
        'lat': trees_out['latitude'].round(6).tolist(),
        'dbh_in': trees_out['tree_dbh'].fillna(0).round(1).tolist(),
        'sp': trees_out['SpCode'].tolist(),
        # A few hundred trees at the edge of the subset fall outside every block; they get ''
        'block': trees_out['BCTCB2010'].fillna('').tolist()
    },
    # The species equations from queens_tree_equations.csv, one entry per row
    'equations': utd[['SpCode', 'common_name', 'predicts', 'form', 'a', 'b', 'c', 'd', 'x_max']]
                 .astype(object).where(utd.notna(), None).to_dict(orient='records'),
    'sites': {
        'lon': gdf_Sites.geometry.x.round(6).tolist(),
        'lat': gdf_Sites.geometry.y.round(6).tolist(),
        'block': gdf_Sites['BCTCB2010'].tolist()
    }
}

with open('street-trees.json', 'w') as f:
    json.dump(data, f, separators=(',', ':'))

files.download('street-trees.json')
```

Check the size of the file it downloads. It should be about 1.3 megabytes, most of it the planting sites. That, plus the HTML around it, has to stay under the site's 15MB cap. If it is bigger, round the coordinates to fewer decimals or simplify the outlines more.

While you are in the notebook, write down three numbers: the total gallons per year at 2015 from Step 10's baseline run, the same figure at 2045, and the 2045 figure from the run where no trees die. These are the acceptance checks. If the sandbox does not reproduce them at its defaults, it is not implementing the model you built.

## Step 2: Write the brief

Make a folder on your computer called `street-trees` and put `street-trees.json` in it. Then make a file called `brief.md` and write it. Here is mine for the tree sandbox. The headings are the template for yours.

```markdown
# Street Trees, Run Forward

## What it shows
The 12,479 street trees of a piece of upper Manhattan (roughly 105th to 141st
Street) that have a recorded trunk diameter, out of 12,715 in the census
subset, each run through its species' equations for the rain it intercepts and
the CO2 it takes in, summed by census block, and grown forward one year at a
time from 2015 to 2045. A planting lever adds trees each year, on sidewalk
planting sites only, and a choice says which blocks get them first. It is
meant to show the pattern of estimated benefit across blocks, and how much
that pattern changes when the assumptions change. The method follows i-Tree
Streets as documented in the Northeast Community Tree Guide (McPherson et al.
2007) and the Urban Tree Database (McPherson, van Doorn and Peper 2016).

## The data
`street-trees.json`, exported from a notebook.
- `blocks`: GeoJSON FeatureCollection, property `BCTCB2010`. 2010 Census Blocks
  (NYC Open Data y9w2-ph8n), subset and simplified.
- `trees`: parallel arrays `lon`, `lat`, `dbh_in` (trunk diameter, inches; 0
  means unknown, treat as missing), `sp` (the species code whose equations the
  tree uses), `block` (the tree's BCTCB2010, or '' for the few hundred at the
  edge that fall outside every block; they count in totals but in no block).
  2015 Street Tree Census (NYC Open Data uvpi-gqnh), subset. Trees with dbh_in
  0 are excluded from everything.
- `equations`: one entry per species and equation: `SpCode`, `common_name`,
  `predicts`, `form`, `a`, `b`, `c`, `d`, `x_max`. 21 species measured in
  Queens in 2005, from the Urban Tree Database (RDS-2016-0005, Table S6 and
  Tables 9-11).
- `sites`: parallel arrays `lon`, `lat`, `block` (BCTCB2010). 15,787 possible
  planting spots on sidewalks, made in the notebook from NYC Street Centerline
  (NYC Open Data inkn-q76z): ordinary streets only (rw_type 1, not flagged
  non-pedestrian), 3 ft behind the curb (curb = half the street width), every
  25 ft, 40 ft clear of each segment end, 15 ft clear of an existing tree. All
  four distances ours. 529 of the 580 blocks have at least one site.
Nothing else is fetched. The file is embedded in the page.

## The equations
Each entry in `equations` is evaluated on x (trunk diameter in cm, or age in
years). If `x_max` is set, use min(x, x_max). ln is the natural log.
- lin:      a + b*x
- quad:     a + b*x + c*x^2
- cub:      a + b*x + c*x^2 + d*x^3
- loglogw1: exp(a + b*ln(ln(x + 1) + c/2))
- loglogw2: exp(a + b*ln(ln(x + 1)) + sqrt(x)*c/2)
- expow1:   exp(a + b*x + c/2)
- power:    a * dbh_cm^b * height_m^c * d   (dry_weight_from_dbh_height only)
predicts is one of age_from_dbh, dbh_from_age, crown_diameter_from_dbh [m],
height_from_dbh [m], dry_weight_from_dbh_height [kg].

## The rule (per tree, per year)
Units in brackets. Sources after each number; "ours" means I chose it.
Defaults for the named values are under Controls. All equations use the
tree's own `sp`.
1. dbh_cm = dbh_in * 2.54                                        [cm]
2. crown_m = max(0, crown_diameter_from_dbh(dbh_cm))             [m]
3. crown_area_m2 = pi * (crown_m / 2)^2                          [m2]
4. stormwater_gal_yr = crown_area_m2 * rain_m * interception * 264.17   [gal/yr]
   (rain_m = rain_in * 0.0254; 264.17 gal per m3)
5. co2_stored_kg(dbh) = dry_weight_from_dbh_height(dbh, height_from_dbh(dbh))
   * 1.28 * 0.5 * 3.67   [kg]  (roots, carbon share, CO2 per C; Urban Tree
   Database, Appendix 5)
6. age: at the start, age = max(0, age_from_dbh(dbh_cm)) [years]
7. grow one year: dbh_cm += max(0, dbh_from_age(age + 1) - dbh_from_age(age)); age += 1
8. co2_kg_yr = co2_stored_kg(dbh after growing one year) - co2_stored_kg(dbh now)   [kg/yr]
9. co2_value_usd = co2_kg_yr * 2.2046 * carbon_price_per_lb     [$/yr]
Each tree has a `standing` share, 1 at the start. Every total (trees, gallons,
kg, $) is the sum over trees of standing * value. Stepping from one year to
the next, in this order: apply deaths per `mortality` (below); grow every tree
one year (7); then plant
`planted_per_year` new trees of species `planted_species` at
`planting_dbh_in`, standing 1, age from step 6 (both ours). A new tree only
ever goes on a free site: pick a block per `planting_rule` from the blocks
that still have a free site, then take one of that block's free sites at
random. Pick the block again for every tree. A site holds one planted tree and
is not freed later (ours). When no free sites are left, planting stops.
- fewest_trees: the block with the smallest sum of standing
- lowest_per_tree: the block with the lowest stormwater per standing tree (a
  block with no trees counts as 0)
- even: go through the blocks in BCTCB2010 order, one tree each, and carry on
  from the same place next year
Deaths use 2.8% a year for a tree whose age is under 5 and 0.57% otherwise
(Northeast Community Tree Guide p. 94):
- off: nothing dies
- average: multiply standing by 0.972 or 0.9943 (the expected value; the same
  numbers every time)
- random: each tree with standing 1 dies (standing becomes 0) with that
  probability, drawn from the seeded random numbers
Ties go to the lower BCTCB2010. Random choices use a fixed seed, so the same
controls always give the same run.

## Controls, in this order, with defaults
Clock:            year [2015..2045], default 2015, plays at 2 years/second, loops
Drawing:          tint = stormwater | co2 | count | per_tree (default stormwater);
                  draw = trees | blocks | both (default both); a tree is drawn
                  with opacity equal to its standing share
Map:              fits the height of the window. Zoom in and out with the
                  scroll wheel and + / - buttons (out to a quarter of the
                  starting view, in to 20x; ours), drag to pan, and a button
                  to reset the view. Zooming changes
                  only the view, never the run.
Main levers:      planted_per_year [0..500] default 0 (ours)
                  planting_rule = fewest_trees | lowest_per_tree | even (default fewest_trees)
                  planting_dbh_in [2..4] default 3 (ours)
                  planted_species = any of the 21 (default GLTR, honeylocust, the most
                    common tree in the subset; ours)
                  mortality = off | average | random (default average; Northeast
                    Community Tree Guide p. 94)
Finer:            rain_in [30..60] default 41.0 (JFK airport, 2000; Northeast
                    Community Tree Guide p. 100)
                  interception = 0.15 | 0.27 (default 0.15; Xiao et al. 2000,
                    a Callery pear and a cork oak in Davis, CA)
                  carbon_price_per_lb = 0.00334 | 0.0231 | 0.0862 (default 0.00334,
                    Northeast Community Tree Guide Table 18; the others are $51
                    and $190 per metric ton, the 2021 federal and 2023 EPA figures)

## Metrics, recomputed on every change
trees standing (sum of standing); total stormwater gal/yr; total co2 kg/yr;
value $/yr; median per-tree stormwater (over trees, not weighted); blocks with
zero trees; free planting sites left; share of total stormwater in the top 10%
of blocks (58 of 580).

## What you should see
At the defaults in 2015: about 25.3 million gal/yr from 12,479 trees (the
notebook's figure; put your exact one here). At 2045: about 64.6 million from
about 10,456 trees standing. With mortality off, 2045: about 77.0 million.
With mortality random, 2045 is within about 1% of the average figure for the
whole map, but a block of a dozen trees can land 20% or more below its average.
99 blocks have no trees in 2015. The top-10% share is 34.8% in 2015 and 29.1%
in 2045.
Planting 200 a year, fewest-trees-first, honeylocusts at 3 inches: every new
tree lands on a sidewalk, never in a park, on a highway or at the river's
edge. By 2016, 50 of the empty blocks have trees; the other 49 have no sites
and stay empty in every year. In 2045: about 15,753 trees standing, about 81.6
million gal/yr, 9,787 sites left, and the top-10% share down to about 23.0%.

## What it can't see
Species beyond the 21 measured in Queens (the rest borrow a related species'
equations). Rain hour by hour, which is how i-Tree calculates interception.
Sidewalk width, and whether a site really has room (driveways, hydrants, bus
stops, cellar doors). Utilities, budgets, who plants. Park trees and yard
trees. Storms, drought, disease. Anything after 2015 that actually happened.

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

Tell the agent what is wrong in plain language. "The total in 2015 is 40% higher than my notebook's; check the crown step" is more useful than "it's broken". Two or three rounds is typical. If it starts adding things you did not ask for, say so. If it cannot fix something after a couple of tries, ask it to explain how it implemented that step and compare the explanation with the brief yourself. The error is usually a unit conversion or an off-by-one in the year loop.

## Step 5: Check it

Before you upload, go through this list. None of it requires reading the code.

- At the defaults, in 2015, the total stormwater matches your notebook's Step 10 baseline, and at 2045 as well. Turn mortality off and check 2045 against the run where no trees die. Set it to random and check that 2045 lands close to the average figure.
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
[SITES]: /tutorials/images/w4/01-planting-sites.png
