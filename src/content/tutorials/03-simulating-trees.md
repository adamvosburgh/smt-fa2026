---
title: "Simulating Trees"
date: "2026-09-06"
author: Adam Vosburgh
sequence: 3
cat: tutorial
published: true
publish: "2026-09-24"
---

This tutorial builds directly on [Tutorial 2](/tutorials/02-mapping-where/). We'll use the same two datasets, the 2015 NYC Street Tree Census and the census block geopackage, and repeat the same spatial join. The difference is what we do before the join. Instead of just counting trees, we'll estimate two ecological services each tree provides: stormwater interception and CO₂ sequestration. Then we'll aggregate those benefit estimates spatially to see which neighborhoods are getting the most (and least) out of the city's urban forest. At the end, we will run the estimate forward in time.

In the vocabulary of this class, last week's map was a record. This week we apply a rule to the record, which is a model. Then we give the rule time, which is a simulation.

The calculations follow the methodology of [i-Tree Eco](https://www.itreetools.org/) (Nowak et al. 2008), a widely-used urban forestry model from the USDA Forest Service, using published allometric equations from the peer-reviewed literature. One thing to be clear about upfront: the individual numbers are **model estimates, not direct measurements**. Each tree's benefit is inferred from its trunk diameter and health condition rather than measured in the field. What matters for this tutorial isn't the precision of any individual estimate, it's the *pattern* across the city, and what that pattern might tell us about where ecological infrastructure is concentrated and where it isn't.

<div class="gap">

**What this version leaves out.** i-Tree matches each of hundreds of species to its own crown and growth equations. This tutorial uses one equation for every tree. The [street tree sandbox](/tutorials/04-notebook-to-sandbox/) built from this notebook next week has the same limitation.

</div>

Both files you need are the same ones from Tutorial 2:

- `2015_Street_Tree_Census_subset_um.csv`
- `nycb2010_um.gpkg`

## Setup

We will use Google Colab again this week. If you would rather run this on your own computer, the setup is in [Running Python on Your Own Computer](/resources/local-python/); the code is the same apart from the upload step.

Same imports as Tutorial 2, with `numpy` added. We need it for the logarithm in the CO₂ calculation.

```python
from google.colab import files

import numpy as np
import pandas as pd
import geopandas as gpd
import altair as alt

# Altair defaults to a 5,000-row limit; disable it since our dataset is larger
alt.data_transformers.disable_max_rows()
```

Upload the two files:

```python
uploaded = files.upload()
```

## Step 1: Load the data

Load the street tree CSV exactly as in Tutorial 2. The columns we'll use most are `tree_dbh` (diameter at breast height, in inches), `spc_common` (species name), `health` (Good / Fair / Poor), and the lat/lon coordinates.

DBH is the single most important variable here. Nearly every ecological benefit estimate we calculate traces back to it.

```python
df_StreetTree = pd.read_csv('/content/2015_Street_Tree_Census_subset_um.csv')

# Preview the data
df_StreetTree.head()
```

Before calculating anything, let's check for trees with DBH = 0. These are stump records or missing data. We don't want them skewing the allometric equations, so we'll replace them with `NaN`:

```python
# Check how many trees have DBH = 0. These are stump or missing records
zero_dbh_count = (df_StreetTree['tree_dbh'] == 0).sum()
print(f"Trees with DBH = 0: {zero_dbh_count} ({zero_dbh_count / len(df_StreetTree) * 100:.1f}% of records)")

# Replace 0 with NaN so downstream equations return NaN instead of incorrect values
df_StreetTree['tree_dbh'] = df_StreetTree['tree_dbh'].replace(0, np.nan)
```

We should also check the other end of the range. Run `df_StreetTree['tree_dbh'].describe()`. The maximum in this subset is 228 inches, which is a trunk nineteen feet across, and is a data entry error. Because every estimate below is a power of diameter, one wrong value like this can outweigh a large number of correct ones, so we will treat anything above 60 inches as missing as well. The 60 inch cutoff is my choice.

```python
# One record claims a 228-inch trunk. Treat anything over 60 inches as a data entry error.
df_StreetTree.loc[df_StreetTree['tree_dbh'] > 60, 'tree_dbh'] = np.nan
```

## Step 2: Crown projection area from DBH

Before we can estimate any ecological benefit, we need to know how large each tree's canopy is. The goal here is **crown projection area** (CPA), the footprint of the canopy as seen from above, modeled as a circle. CPA is the foundation for everything that follows: leaf area, stormwater interception, and CO₂ sequestration all trace back to it.

i-Tree estimates crown area using species-specific lookup tables matched to climate zones. For each of hundreds of species, it has empirically fitted equations relating trunk diameter to crown width. Replicating that in this notebook would require mapping every `spc_common` value in the census to an i-Tree species code, then pulling the right equation for each one. That's a significant undertaking and not the point of this tutorial.

Instead, we use a single generalized **power-law equation** applied to all trees:

`crown_width (m) = a × DBH_cm ^ b`

The coefficients (a = 1.22, b = 0.65) are approximate values for deciduous urban trees, chosen to produce reasonable estimates across the DBH range in this dataset. A 10 cm DBH tree gets a crown width of about 5.5 m, a 30 cm tree about 9.5 m, which is in the right range for open-grown urban trees. These aren't from a single citable source; they're a generalized estimate.

This is an approximation and should be understood as one. It will over- or under-estimate individual trees. But because the same equation applies to every tree in the dataset, the *relative differences* across the city (which blocks have more canopy, which have less) are still meaningful. The spatial pattern holds even when the absolute numbers are approximate.

```python
# Convert DBH from inches to cm
df_StreetTree['dbh_cm'] = df_StreetTree['tree_dbh'] * 2.54

# Estimate crown width (m) from DBH using a generalized power-law equation
# crown_width = a * dbh_cm^b
# Coefficients (a=1.22, b=0.65) are approximate values for deciduous urban trees.
# i-Tree does this with species-specific lookup tables; this is a simplified stand-in
a = 1.22
b = 0.65
df_StreetTree['crown_width_m'] = a * (df_StreetTree['dbh_cm'] ** b)

# Crown projection area (m²), the footprint of the canopy, modeled as a circle
df_StreetTree['crown_area_m2'] = 3.14159 * (df_StreetTree['crown_width_m'] / 2) ** 2

# Quick sanity check: median crown area
print(f"Median crown projection area: {df_StreetTree['crown_area_m2'].median():.1f} m²")
print(f"Max crown projection area: {df_StreetTree['crown_area_m2'].max():.1f} m²")
```

## Step 3: Leaf area from crown projection area

Crown projection area tells us the footprint of the canopy, but what matters ecologically is the total surface area of leaves, because leaves are where photosynthesis, transpiration, and rainfall interception actually happen.

Leaf area is estimated from crown projection area using a **Leaf Area Index (LAI)** multiplier. LAI is the ratio of total leaf area to the ground area covered by the crown (m² of leaf per m² of crown footprint). An LAI of 4.0 means there are effectively 4 m² of leaf surface stacked above every 1 m² of crown footprint.

Following Nowak (1996), LAI varies with tree condition. A tree in poor health has fewer, less functional leaves than a healthy one. So rather than applying a single constant, we use condition-adjusted values.

```python
# LAI multiplier by health condition (from Nowak 1996 methodology)
# Good condition: LAI ≈ 4.0  |  Fair: ≈ 2.5  |  Poor: ≈ 1.0
# Trees with no health record (NaN) get 0.0. They contribute no leaf area
lai_map = {'Good': 4.0, 'Fair': 2.5, 'Poor': 1.0}
df_StreetTree['lai'] = df_StreetTree['health'].map(lai_map).fillna(0.0)

# Total leaf area (m²) = crown footprint × LAI
df_StreetTree['leaf_area_m2'] = df_StreetTree['crown_area_m2'] * df_StreetTree['lai']

# Verify condition breakdown
print(df_StreetTree['health'].value_counts(dropna=False))
```

## Step 4: Stormwater interception

One of the most economically significant services street trees provide is **intercepting rainfall** before it reaches the ground. In a dense urban environment like New York, stormwater that hits impervious surfaces flows directly into the combined sewer system, which can overflow during heavy rain, releasing untreated sewage into waterways. Trees reduce that volume.

For this tutorial, we apply an annual interception fraction (15% of precipitation) to leaf area, a conservative estimate based on i-Tree Eco validation data, where modeled interception averaged 61% across sites. The full model uses hourly rainfall data, evaporation rates, and canopy storage capacity; our version captures the order of magnitude while staying interpretable.

NYC gets about 1,181 mm of rain per year (NOAA 30-year normal). We'll calculate intercepted volume in gallons per year, a useful and concrete unit. For context, NYC Parks and the USDA Forest Service estimated from the 2015 street tree census that NYC's roughly 666,000 street trees together intercept about 916 million gallons per year, with a stormwater benefit of approximately $35 million annually (calculated using i-Tree Streets). That is about 1,400 gallons per tree.

```python
# NYC annual precipitation: 1,181 mm (NOAA, 30-year normal 1991–2020)
# Interception fraction: ~15% of annual precipitation for deciduous trees
nyc_annual_precip_m = 1.181   # meters
interception_fraction = 0.15  # conservative midpoint from i-Tree validation range

df_StreetTree['stormwater_m3_yr'] = (
    df_StreetTree['leaf_area_m2'] * nyc_annual_precip_m * interception_fraction
)

# Convert m³ to gallons (1 m³ = 264.17 gallons)
df_StreetTree['stormwater_gal_yr'] = df_StreetTree['stormwater_m3_yr'] * 264.17

# Summary statistics
print(f"Total stormwater intercepted per year: {df_StreetTree['stormwater_gal_yr'].sum():,.0f} gallons")
print(f"Median per-tree interception: {df_StreetTree['stormwater_gal_yr'].median():,.0f} gal/yr")
print(f"(NYC Parks / i-Tree Streets 2015 estimate for all ~666k trees: 916 million gal/yr, about 1,400 per tree)")
```

The median tree in our subset comes out at about 9,000 gallons per year, which is several times the city's average of about 1,400. I don't know for certain which of our assumptions is responsible for the difference. My guess is Step 3: we multiply the crown footprint by the leaf area index and then apply the interception fraction to the whole of that leaf area, whereas i-Tree treats interception as a property of the canopy footprint. The generalized crown equation may also produce crowns that are too large. The pattern across blocks is still worth looking at, and this gap is the first thing to fix if you take this further.

## Step 5: CO₂ sequestration

Trees sequester carbon as they grow, converting atmospheric CO₂ into woody biomass. We estimate annual CO₂ sequestration in three steps, following Nowak & Crane (2002):

1. Estimate **aboveground dry weight biomass** from DBH using an allometric equation (Jenkins et al. 2003, mixed hardwood equation)
2. **Carbon storage** = 0.5 × dry biomass (approximately half of wood dry weight is carbon)
3. **Annual sequestration** = carbon storage × annual growth rate, then converted from C to CO₂

We apply a fixed 4% annual growth rate, a conservative estimate for open-grown urban trees. The full i-Tree method uses species-specific growth rates by climate zone, which would be more precise. For the dollar value we use the **EPA Social Cost of Carbon** at $51/metric ton (Obama-era baseline; the Biden-era figure was ~$190/metric ton). Unlike the stormwater case, this is a verifiable published figure, though it represents a policy estimate, not a market price, and the number has shifted significantly across administrations.

```python
# Aboveground dry weight biomass (kg), Jenkins et al. 2003, mixed hardwood equation
# biomass = exp(β₀ + β₁ * ln(dbh_cm))
# Mixed hardwood coefficients (β₀ = -2.4800, β₁ = 2.4835), appropriate for NYC's
# predominantly hardwood street tree population (London plane, Norway maple, Callery pear, etc.)
df_StreetTree['biomass_kg'] = np.exp(
    -2.4800 + 2.4835 * np.log(df_StreetTree['dbh_cm'])
)

# Carbon storage (kg C) = 0.5 × biomass (Nowak & Crane 2002)
df_StreetTree['carbon_kg'] = df_StreetTree['biomass_kg'] * 0.5

# Annual sequestration: 4% annual growth rate, converted kg C → kg CO₂
# Multiply by 3.667 (molecular weight ratio of CO₂/C = 44/12)
growth_rate = 0.04
df_StreetTree['co2_seq_kg_yr'] = df_StreetTree['carbon_kg'] * growth_rate * 3.667

# Dollar value: EPA social cost of carbon at $51/metric ton (conservative baseline)
df_StreetTree['co2_value_usd'] = (df_StreetTree['co2_seq_kg_yr'] / 1000) * 51

# Summary statistics
print(f"Total CO₂ sequestered per year: {df_StreetTree['co2_seq_kg_yr'].sum():,.0f} kg")
print(f"Total CO₂ value per year: ${df_StreetTree['co2_value_usd'].sum():,.0f}")
print(f"Median per-tree sequestration: {df_StreetTree['co2_seq_kg_yr'].median():.1f} kg CO₂/yr")
```

## Step 6: Map individual trees colored by stormwater benefit

Before we aggregate to blocks, let's look at the per-tree data. The color encodes annual stormwater interception (gallons/year); point size encodes DBH, the same as Tutorial 2.

```python
chart_StreetTree_Storm = alt.Chart(df_StreetTree).mark_circle().encode(
    longitude='longitude:Q',
    latitude='latitude:Q',
    color=alt.Color(
        'stormwater_gal_yr:Q',
        scale=alt.Scale(scheme='blues'),
        legend=alt.Legend(title='Stormwater (gal/yr)')
    ),
    size=alt.Size(
        'tree_dbh:Q',
        scale=alt.Scale(range=[0, 228]),
        legend=alt.Legend(title='DBH (inches)')
    ),
    tooltip=[
        alt.Tooltip('spc_common:N', title='Species'),
        alt.Tooltip('tree_dbh:Q', title='DBH (in)', format='.1f'),
        alt.Tooltip('health:N', title='Health'),
        alt.Tooltip('stormwater_gal_yr:Q', title='Stormwater (gal/yr)', format=',.0f'),
        alt.Tooltip('co2_seq_kg_yr:Q', title='CO₂ sequestered (kg/yr)', format='.1f')
    ]
).project(
    type='mercator'
).properties(
    width=700,
    height=700,
    title='Individual Trees: Annual Stormwater Interception'
)

chart_StreetTree_Storm
```

Hover over a few trees. Notice how much the stormwater value varies. A large healthy tree can intercept many times more rainfall than a small or poor-condition one.

![trees by stormwater][STORM]

## Step 7: Spatial join to blocks and aggregate

Now we follow the exact same spatial join pattern as Tutorial 2. The only difference is that instead of just counting trees, we're also summing up benefit estimates. Here's the sequence:

1. Convert the street tree dataframe to a GeoDataFrame using lat/lon
2. Load the block GeoPackage
3. `sjoin` the two (keeping the structure of the street trees)
4. `groupby` block to count trees and sum benefits
5. Merge back to the block GeoDataFrame for polygon geometry

```python
# Load blocks. Same file and reprojection as Tutorial 2
gdf_Blocks = gpd.read_file('/content/nycb2010_um.gpkg').to_crs(epsg=4326)

gdf_Blocks.head()
```

```python
# Convert df_StreetTree to a GeoDataFrame. Same pattern as Tutorial 2
gdf_StreetTree = gpd.GeoDataFrame(
    df_StreetTree,
    geometry=gpd.points_from_xy(df_StreetTree['longitude'], df_StreetTree['latitude']),
    crs='EPSG:4326'
)

# Spatial join: attach block ID to each tree row
gdf_joined = gpd.sjoin(gdf_Blocks, gdf_StreetTree, how='right', predicate='contains')

# Aggregate per block: count trees, sum benefits
gdf_agg = gdf_joined.groupby('BCTCB2010').agg(
    tree_count=('tree_id', 'count'),
    total_stormwater_gal=('stormwater_gal_yr', 'sum'),
    total_co2_kg=('co2_seq_kg_yr', 'sum')
).reset_index()

# Average stormwater per tree. Shows where individual trees are working hardest,
# independent of how many trees a block has
gdf_agg['stormwater_per_tree'] = gdf_agg['total_stormwater_gal'] / gdf_agg['tree_count']

# Merge aggregated values back to the block GeoDataFrame
gdf_BenefitBlocks = gdf_Blocks.merge(gdf_agg, on='BCTCB2010', how='left')

# Fill blocks with no trees with 0 rather than NaN
gdf_BenefitBlocks[['tree_count', 'total_stormwater_gal', 'total_co2_kg', 'stormwater_per_tree']] = (
    gdf_BenefitBlocks[['tree_count', 'total_stormwater_gal', 'total_co2_kg', 'stormwater_per_tree']]
    .fillna(0)
)

print(f"Blocks with at least one tree: {(gdf_BenefitBlocks['tree_count'] > 0).sum()}")
print(f"Total blocks: {len(gdf_BenefitBlocks)}")
gdf_BenefitBlocks[['BCTCB2010', 'tree_count', 'total_stormwater_gal', 'total_co2_kg', 'stormwater_per_tree']].head(10)
```

## Step 8: Three choropleths

Now let's map the three aggregated metrics. The first two (total stormwater, total CO₂) show where the city gets the most ecological work done. The third, stormwater per tree, is the interesting one: it removes the effect of tree count and shows where individual trees are working hardest, regardless of how many there are.

```python
# Shared base chart properties
base = alt.Chart(gdf_BenefitBlocks).mark_geoshape(
    stroke='black',
    strokeWidth=0.3
).project(
    type='mercator'
).properties(
    width=450,
    height=550
)

# Chart 1: Total stormwater benefit per block (blue)
chart_Stormwater = base.encode(
    color=alt.Color(
        'total_stormwater_gal:Q',
        scale=alt.Scale(scheme='blues'),
        legend=alt.Legend(title='Total Stormwater (gal/yr)')
    ),
    tooltip=[
        alt.Tooltip('BCTCB2010:N', title='Block'),
        alt.Tooltip('tree_count:Q', title='Tree Count'),
        alt.Tooltip('total_stormwater_gal:Q', title='Stormwater (gal/yr)', format=',.0f')
    ]
).properties(
    title='Total Stormwater Benefit'
)

# Chart 2: Total CO₂ sequestered per block (green)
chart_CO2 = base.encode(
    color=alt.Color(
        'total_co2_kg:Q',
        scale=alt.Scale(scheme='greens'),
        legend=alt.Legend(title='Total CO₂ (kg/yr)')
    ),
    tooltip=[
        alt.Tooltip('BCTCB2010:N', title='Block'),
        alt.Tooltip('tree_count:Q', title='Tree Count'),
        alt.Tooltip('total_co2_kg:Q', title='CO₂ (kg/yr)', format=',.0f')
    ]
).properties(
    title='Total CO₂ Sequestered'
)

# Chart 3: Stormwater per tree. Where individual trees are working hardest
chart_StormPerTree = base.encode(
    color=alt.Color(
        'stormwater_per_tree:Q',
        scale=alt.Scale(scheme='teals'),
        legend=alt.Legend(title='Stormwater per Tree (gal/yr)')
    ),
    tooltip=[
        alt.Tooltip('BCTCB2010:N', title='Block'),
        alt.Tooltip('tree_count:Q', title='Tree Count'),
        alt.Tooltip('stormwater_per_tree:Q', title='Stormwater per Tree (gal/yr)', format=',.0f')
    ]
).properties(
    title='Stormwater per Tree'
)

chart_Stormwater | chart_CO2 | chart_StormPerTree
```

![three choropleths, one shared scale][SHARED]

And... it didn't work! The second and third maps are almost blank. What is going on here? Look at the legend. There is only one, and it is labelled with all three fields. When you put charts side by side, Altair assumes they share a color scale, so the CO₂ map (thousands of kilograms) and the per-tree map (tens of thousands of gallons) are being drawn on the stormwater scale (millions of gallons). Tell it to keep the three scales separate:

```python
(chart_Stormwater | chart_CO2 | chart_StormPerTree).resolve_scale(color='independent')
```

![three choropleths][CHORO]

## Step 9: Reflection

Look at the three maps and think through what each one is actually showing.

The first two maps (total stormwater, total CO₂) will tend to track the *number* of trees. Blocks with more trees simply generate more total benefit. The more interesting question is whether the distribution of trees matches the distribution of need. Which neighborhoods have the most trees, and which have the fewest? Does that pattern correspond to differences in income, race, or historical investment? (If you've looked at the redlining maps of Manhattan, you already have some hypotheses.)

The stormwater-per-tree map removes the effect of count. A block with a high per-tree value has large, healthy trees that are individually providing significant benefit. A block with a low per-tree value may have many small or poor-condition trees. Where are the high-performing individual trees located relative to the areas that need the most infrastructure relief?

There's a broader methodological point here. When researchers or city agencies report that NYC's street trees provide $151M/year in ecological benefits, that number is technically accurate, but it's an average distributed across the whole city. These maps show that the distribution is far from even. A single aggregate figure can be used to justify *any* planting strategy, including ones that concentrate resources where they're already concentrated.

If you wanted to shift the benefit map toward underserved areas, you have two levers: number of trees (planting more) and quality of trees (prioritizing larger species, better stewardship, fewer removals). Which is more tractable in a dense urban environment? What constraints (sidewalk width, underground utilities, maintenance budgets) would shape where new trees can actually go?

## Step 10: Run it forward

So far we have applied a rule to a record. In this last step we give the rule time.

The simplest change a tree undergoes over time is growth. We already assumed a growth rate in Step 5: 4% more biomass a year. Biomass is `exp(b0 + b1 × ln(dbh))`, so 4% more biomass corresponds to the diameter growing by `1.04 ^ (1 / 2.4835)`, which is about 1.6% a year. I am deriving the diameter growth from the assumption we already made rather than adding a new one. Trees also die, and a real forecast would include a mortality rate. I do not have a figure for street tree mortality that I am confident in, so it is a variable set to zero below. If you want to use a number, do, and note that it is yours.

The code below recomputes the chain from Steps 2 to 4 (crown, leaf area, stormwater) for each year from 2015 to 2045. **Let's go line by line here, don't copy this code just yet:**

A function that takes a diameter and returns gallons per year. This is Steps 2 to 4 in one place:

```python
def stormwater_from_dbh(dbh_in, lai):
    dbh_cm = dbh_in * 2.54
    crown_w = a * dbh_cm ** b
    crown_area = 3.14159 * (crown_w / 2) ** 2
    leaf_area = crown_area * lai
    return leaf_area * nyc_annual_precip_m * interception_fraction * 264.17
```

The yearly step. Each year the diameter of every surviving tree is multiplied by the growth factor, a share of trees is removed at random if `mortality` is above zero, and the total is recorded:

```python
dbh_growth = 1.04 ** (1 / 2.4835)   # ~1.6%/yr, derived from the 4% biomass growth in Step 5
mortality = 0.0                     # annual share of trees lost. Assumed; no source. Change it and note that you did.

def run(df, years=range(2015, 2046), growth=dbh_growth, mortality=mortality, seed=0):
    rng = np.random.default_rng(seed)
    dbh = df['tree_dbh'].to_numpy(dtype=float)
    lai = df['lai'].to_numpy()
    alive = ~np.isnan(dbh)
    rows = []
    for year in years:
        gal = stormwater_from_dbh(dbh, lai)
        rows.append({'year': year, 'trees': int(alive.sum()), 'stormwater_gal': float(np.nansum(gal[alive]))})
        dbh = dbh * growth
        if mortality > 0:
            alive &= rng.random(len(dbh)) > mortality
    return pd.DataFrame(rows)
```

**Go ahead and copy both cells into your notebook**, then run the baseline:

```python
baseline = run(df_StreetTree)
baseline.tail()
```

With this subset and these defaults, 2015 comes out at about 150 million gallons a year for 12,479 trees with a usable diameter, and 2045 at about 277 million. Write your two numbers down. You will need them next week.

Now a second run that differs from the first by exactly one value. This is the shape every comparison in this class takes: change one thing, name it, and look at the difference. Here I will change the growth rate to 2% biomass a year.

```python
slow = run(df_StreetTree, growth=1.02 ** (1 / 2.4835))

baseline['scenario'] = '4% biomass growth'
slow['scenario'] = '2% biomass growth'
runs = pd.concat([baseline, slow])

alt.Chart(runs).mark_line().encode(
    x='year:O',
    y=alt.Y('stormwater_gal:Q', title='Stormwater intercepted (gal/yr)'),
    color='scenario:N'
).properties(width=600, height=300, title='Two runs, one changed value')
```

![two runs][RUNS]

Both lines rise smoothly for thirty years because growth is the only process in the rule. There are no storms, no construction, no removals, no disease, and no planting. Everything the chart shows was put there by the assumptions in Steps 2 to 5 and the two values in the cell above. Next week you will write those assumptions down as a specification and hand them to a machine.

## Assignment 3

Think of a forecast (or a hindcast, or a run) that could come out of the dataset you used for Assignment 2, and sketch what its interface would look like. No code. Details on the [assignment page](/assignments/assignment-03/). Due 10/1.

---
Module by Adam Vosburgh, Spring 2026. Updated for Colab, with Step 10 added, Fall 2026.

[STORM]: /tutorials/images/w3/01-trees-stormwater.png
[SHARED]: /tutorials/images/w3/02a-three-shared.png
[CHORO]: /tutorials/images/w3/02-three-choropleths.png
[RUNS]: /tutorials/images/w3/03-two-runs.png
