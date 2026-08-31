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
| `bathtub.py` | 07 Bathtub | USGS 3DEP DEM, Building Footprints, MapPLUTO, ACS tracts | `processed/bathtub/` |

Run them from the repo root, not from this folder.
