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
| `pencil.py` | 02 Does It Pencil | MapPLUTO, HUD Small Area FMR + Income Limits, ACS tract income, NYC floodplain layers | `processed/pencil/` |
| `after-five.py` | 03 After Five | DCP 3-D Building Model (CityGML), NYC Building Footprints, MapPLUTO, DOB filings + certificates of occupancy | `processed/after-five/` |
| `bathtub.py` | 07 Bathtub | USGS 3DEP DEM, Building Footprints, MapPLUTO, ACS tracts | `processed/bathtub/` |

Sandbox 04, The Coefficients, has **no pipeline and no processed data**. Its data
is source code - a vendored simulation engine under
`src/lib/sandboxes/coefficients/vendor/` - so there is nothing here for it and
nothing in `processed/`.

Two shared modules sit beside the pipelines:

| Module | What it is |
| --- | --- |
| `_common.py` | Locating `data/original`, reading named columns out of a DBF without a geo stack, and one value out of `.env`. |
| `afterfive_massing.py` | Streaming CityGML into footprint-plus-height records. Its header explains why the CityGML is used rather than the Rhino files DCP also publishes. |

Run them from the repo root, not from this folder.
