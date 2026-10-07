### Overview

I am making a sandbox in the style of the course simmodeltwin.net. There should be more information in the agents.md about what this specifically means, but in short it is a web-based simulation that contains some data, some rule for how to apply that data, a clock for running the rule forward in time, and some sliders that will let us change the variables and assumptions in the dataset. If an agents.md with more context is missing from this session, please do not complete this prompt, and direct the person running this to tutorial 4.

### data

In data/Original, you can find:
- `usgs_land_change_1932_2016` — a raster of persistent land change for coastal Louisiana, measuring land and water changes from 1932 to 2016 using satellite imagery and surveys, recording where land was converted to water. The raster's own metadata cites this as Couvillion et al. 2017 (USGS SIM 3381): https://www.sciencebase.gov/catalog/item/5a67a8cde4b06e28e9c57150
- `census_tracts_orleans_plaquemines` — 2020 census tract boundaries for Orleans and Plaquemines parishes, from the US Census Bureau: https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_22_tract_500k.zip

No FEMA file is included — pull this live from the API, for both years the model needs:

- FEMA's OpenFEMA API, NFIP Redacted Policies v3, entity `NfipPolicies`: https://www.fema.gov/api/open/v3/NfipPolicies
- Before building anything with it, make one unfiltered request and print the full field list from a live response. v3 changed several field names from the v2 dataset used in Assignment 2 (the "Fima" prefix was dropped from multiple fields), so confirm the actual names for census tract, policy count, and effective date before writing the query or the join — don't assume `censusTract` and `policyCount` are still spelled that way.
- Pull active policy counts by census tract for Orleans and Plaquemines parishes (county codes 22071 and 22075) for two separate windows: calendar year 2020, and calendar year 2025. Group and sum by census tract for each year separately. These become `policies_2020` and `policies_2025` in the processed table below.
- If 2020 records return sparse or empty for some tracts, note this in the limitations section rather than silently treating missing data as zero — a missing 2020 count is different from an observed zero.

Process all of this into one table per census tract with: `GEOID`, `parish`, `policies_2020`, `policies_2025`, `observed_rate`, `share_loss`, and `area_km2`, saved as the first file in data/Processed, and used as the base for everything described below.

Any new processed datasets should go in data/Processed.

### objectives

This model simulates how flood insurance **coverage could decline** — not grow — as coastal New Orleans continues to lose land between 2025 and 2045 (or later). My Assignment 2 map compared land that became water (1932–2015) with 2025 FEMA flood insurance premium data. This model starts from a different idea: rising climate risk doesn't necessarily correspond with more insurance coverage. Afer some research, in other high-risk areas, insurers have raised premiums, issued non-renewals, or left the market entirely because an area has become too risky to insure profitably. In Orleans Parish specifically, approximately 1 in 26 NFIP policies were non-renewed in 2023 — a 766.5% increase from 2018 (The New York Times, "What's Going On in This Graph? Homeowners Insurance," 22 Jan. 2026).

The simulation does not claim NFIP itself behaves this way — NFIP is a federal program with different rules from private insurers — but uses insurance withdrawal as a **scenario**: if access to coverage declined in places where exposure increases, where would the largest gaps between environmental exposure and insurance occur? It does not predict individual household behavior, flood damage, or actual future enrollment. It is a scenario model: fixed, visible assumptions, testing what patterns those assumptions produce.

Research basis: CARTO has mapped how insurers combine asset locations with flood zones, weather data, and future flood projections to assess exposure and make coverage decisions (Puente, Estefania, "Grow Your Insurance Data Analytics with 12 Interactive Maps," CARTO, 2024, https://carto.com/blog/grow-your-insurance-data-analytics-with-12-interactive-maps/). The New York Times has reported that climate-related disasters have contributed to insurer losses, premium increases, and reduced coverage or withdrawal in high-risk areas nationally ("The Home Insurance Crunch: See What's Happening in Your State," 2024, https://www.nytimes.com/interactive/2024/05/13/climate/home-insurance-profit-us-states-weather.html; "What's Going On in This Graph? Homeowners Insurance," 22 Jan. 2026, https://www.nytimes.com/2026/01/22/learning/whats-going-on-in-this-graph-feb-4-2026.html).

### data prep - the rule

Below is a chart sketch of what the final processed data should look like. The simulation begins in 2025. One row represents one census tract. The starting record combines each tract's active NFIP policy count with its nearby historic land-loss conditions.

| tract_id | parish | policies_2020 | policies_2025 | observed_rate | dist_to_projected_water_km | land_loss_category | protected | simulated_policies |
|---|---|---|---|---|---|---|---|---|
| 22071000100 | Orleans | 195 | 185 | -5% | 0.8 | High | No | 185 |
| 22071000200 | Orleans | 75 | 72 | -4% | 2.4 | Moderate | No | 72 |
| 22075050800 | Plaquemines | 48 | 46 | -4% | 0.1 | High | No | 46 |

- **tract_id, parish**: from the census tract file.
- **policies_2020, policies_2025**: active policy counts aggregated from the FEMA file by census tract, for both years, as described above.
- **observed_rate**: `(policies_2025 − policies_2020) / policies_2020`, the local 2020–2025 policy-change rate (this is `B` in Rule 3 below). If `policies_2020` is 0 or missing for a tract, leave `observed_rate` blank for that tract rather than dividing by zero, and flag it in the output.
- **dist_to_projected_water_km**: distance from the tract to the nearest projected lost-land polygon at the current step, recalculated as the run progresses (see Rule 2).
- **land_loss_category**: bucketed from each tract's own projected `share_loss` (fraction of its area lost) — `[suggested cutoffs are High = share_loss > 0.3, Moderate = 0.05–0.3, None = below 0.05]`.
- **protected**: whether the tract has levee or coastal protection/restoration in place — `[make "protected" a manual toggle per tract/parish in the interactive rather than a calculated field]`.
- **simulated_policies**: starts equal to `policies_2025`, then is recalculated every 5-year step using the formula below.

### the run

The interactive variables should work like this:

- **Rule 1 — baseline trend**: use each tract's `observed_rate`, calculated above from 2020–2025 FEMA records. This asks what would happen if each tract kept changing at that same rate, with no adjustment yet for projected land loss:

  `Policies(t+5) = Policies(t) × (1 + observed_rate)`

- **Rule 2 — project future land loss**: for each tract, using the USGS historic annual land-loss rate:

  `Projected land area(t+5) = Land area(t) − (historic annual land-loss rate × 5)`

  From this, recalculate at each step: distance to the newly projected water, the area/percentage lost, and whether the tract is protected.

- **Rule 3 — adjust for coastal exposure**: combine the baseline trend with penalties/credits for exposure:

  `Policies(t+5) = Policies(t) × (1 − B − W − L + P)`

  where:
  - `B` = observed policy-change rate (from Rule 1, per tract — not a slider, it's calculated)
  - `W` = water penalty, applied if the tract is within the distance threshold of newly projected water (slider, default −2%, suggested range 0% to −10%)
  - `L` = land-loss penalty, by category: High (slider, default −5%, range 0% to −15%) or Moderate (slider, default −2%, range 0% to −10%); 0 if land_loss_category is "None"
  - `P` = protection credit, applied if the tract is marked protected (slider, default +1%, range 0% to +5%)
  - distance threshold for "new water" (slider, default 1 km, range 0.25 km to 5 km)

  These four values — the distance threshold, the water penalty, the two land-loss penalties, and the protection credit — are the model's least certain, deliberately visible assumptions, meant for testing possible outcomes, not forecasts.

- **scenarios**: the first run uses these fixed default values. Later runs should let the person switch between named scenarios that change the slider values together — e.g. "Severe retreat" (steeper penalties), "Stable coverage" (penalties near zero), "Medium retreat" (the defaults above) — rather than requiring every slider to be set one at a time.

- **run length**: 5-year steps, 2025 to 2045 (or further, if extended).

### the interactive

- In the center, a map with the simulation results. On the left is an info panel with a title and description. On the right is another panel with controls and the clock.
- Two views: one showing simulated policy counts per tract (shaded or graduated), and one showing projected land loss / distance to new water.
- Clock: a playhead from 2025 to 2045 in 5-year steps, with pause, fast-forward and rewind.
- Controls: sliders for the water penalty, the two land-loss penalties (High/Moderate), the protection credit, and the distance threshold, as described above — plus a scenario selector (Severe retreat / Medium retreat / Stable coverage) that sets all four together, with manual slider adjustment still available after picking one.
- Title: Simulating Future Flood Insurance — Coastal Land Loss and Insurance Withdrawal in New Orleans
- Description: a scenario model exploring how flood insurance coverage might decline, rather than grow, as coastal land loss continues. It is testing where the largest gaps between environmental exposure and insurance access might occur, informed by reported insurer withdrawal patterns nationally and in Orleans specifically.
- Limitations: the model cannot predict real NFIP policy cancellations, renewals, premiums, coverage amounts, or insurer decisions; NFIP and private flood insurance operate under different rules; a simulated drop in policies could reflect migration, property loss, abandonment, unaffordability, private insurance substitution, non-renewal, or changes in data reporting, and the model cannot distinguish between these causes; policy count does not capture uninsured households, renters, businesses, or people who cannot afford insurance; the model does not represent income, race, age, disability, tenure, mortgage status, property value, or other factors shaping insurance access and vulnerability; it does not calculate flood depth, storm surge, rain-driven flooding, hurricane damage, levee performance, or drainage; it simplifies future land loss by extending historic patterns forward unchanged; and any tract with missing or zero 2020 policy data has an undefined baseline rate and should be marked as such, not silently assigned a default.
- Citations: USGS land change data (Couvillion et al. 2017), FEMA OpenFEMA NFIP policies, CARTO (Puente, Estefania. "Grow Your Insurance Data Analytics with 12 Interactive Maps." CARTO, 2024, https://carto.com/blog/grow-your-insurance-data-analytics-with-12-interactive-maps/), and The New York Times ("The Home Insurance Crunch: See What's Happening in Your State." 2024, https://www.nytimes.com/interactive/2024/05/13/climate/home-insurance-profit-us-states-weather.html; "What's Going On in This Graph? Homeowners Insurance." 22 Jan. 2026, https://www.nytimes.com/2026/01/22/learning/whats-going-on-in-this-graph-feb-4-2026.html), all linked.

Okay, that is all, please let me know if you have any questions or if anything is not clear.