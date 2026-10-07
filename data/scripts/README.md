# Data processing scripts

One script per sandbox. Each reads from `data/original/` and writes to
`data/processed/<sandbox>/`. Nothing here runs at build time or at request time -
these are run by hand when a source dataset changes, and their outputs are what
the site actually ships.

    data/
      original/    source datasets, as downloaded. Shared across sandboxes,
                   so no per-project subfolders. Never edited in place.
      processed/   derived datasets, one subfolder per sandbox. These are what
                   the sandbox loads.
      scripts/     the scripts that turn one into the other.

The point of the split is not only that the processed files are smaller. They
are *reshaped*, so that the browser does a comparison instead of a computation.
See the header of each script for what that means in its case.

| Script | Sandbox | Reads | Writes |
| --- | --- | --- | --- |
| `pencil.py` | 01 ADU Forecast for Queens | MapPLUTO, HUD Small Area FMR + Income Limits, ACS tract income, NYC floodplain layers | `processed/pencil/` |
| `after-five.py` | 02 Office to Residential Conversion | DCP 3-D Building Model (CityGML), NYC Building Footprints, MapPLUTO, DOB filings + certificates of occupancy | `processed/after-five/` |
| `after-five-agents.py` | 02 Office to Residential Conversion | MTA O-D ridership aggregates + entrances, NYC Street Centerline, ATUS 2003-2025 | `processed/after-five/` (the agent layer's five files + `agents.json`) |
| `anthromes.py` | 04 Anthromes | HYDE 3.2 raw-data.zip (streamed, never extracted), the Anthromes 12K replication archive (the gate), the 3.5 classified series at 33km | `processed/anthromes/` |
| `bathtub.py` | 05 Sea Level Flood Map | USGS 3DEP DEM, Building Footprints, MapPLUTO, ACS tracts, NOAA datums | `processed/bathtub/` |

Sandbox 03, A City Simulator, Opened Up, has **no pipeline and no processed data**. Its data
is source code - a vendored simulation engine under
`src/lib/sandboxes/coefficients/vendor/` - so there is nothing here for it and
nothing in `processed/`.

`checks/` holds preflight.py - run it before running the pipelines -
and the measurement scripts behind the pencil frontage method.

Two shared modules sit beside the pipelines:

| Module | What it is |
| --- | --- |
| `_common.py` | Locating `data/original`, reading named columns out of a DBF without a geo stack, and one value out of `.env`. |
| `afterfive_massing.py` | Streaming CityGML into footprint-plus-height records. Its header explains why the CityGML is used rather than the Rhino files DCP also publishes. |

Run them from the repo root, not from this folder.
