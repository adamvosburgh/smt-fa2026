"""Shared helpers for the sandbox pipelines.

Small on purpose. Anything that only one pipeline needs stays in that pipeline,
where its assumptions are next to the code that makes them.
"""

import struct
from pathlib import Path


def original_dir(given=None):
    """Locate data/original, from the repo root or from anywhere under it."""
    if given is not None:
        p = Path(given)
        if p.exists():
            return p
        raise SystemExit(f"{p} not found")
    here = Path.cwd()
    for base in [here, *here.parents]:
        p = base / "data" / "original"
        if p.exists():
            return p
    raise SystemExit("data/original not found - run from the repo root")


def read_dbf(path, columns):
    """Read named columns out of a DBF without a geo stack.

    A DBF is fixed-width records after a fixed-length header, so any subset of
    columns can be sliced by byte offset. This is lifted from bathtub.py, which
    uses it to read two columns out of MapPLUTO's 856,687 records without
    geopandas and without ever opening the 141MB .shp beside it.

    Yields one dict per record, values as stripped latin-1 strings. Converting
    them is the caller's business, because the right conversion differs by
    column - BBL in particular is stored as a DBF FLOAT and must never be read
    through float64, which silently rounds away the lot digits.
    """
    wanted = {c.lower() for c in columns}
    with open(path, "rb") as f:
        header = f.read(32)
        n_records, header_len, record_len = struct.unpack("<IHH", header[4:12])
        offset, cols = 1, {}
        for _ in range((header_len - 33) // 32):
            fd = f.read(32)
            if fd[:1] == b"\x0d":
                break
            name = fd[:11].split(b"\x00")[0].decode("latin-1")
            length = fd[16]
            cols[name.lower()] = (offset, length)
            offset += length

        missing = wanted - set(cols)
        if missing:
            raise SystemExit(f"{path.name} has no column(s): {', '.join(sorted(missing))}")

        picks = [(c, *cols[c]) for c in sorted(wanted)]
        f.seek(header_len)
        for _ in range(n_records):
            rec = f.read(record_len)
            if len(rec) < record_len:
                break
            yield {name: rec[off:off + ln].decode("latin-1").strip()
                   for name, off, ln in picks}


def env(name, default=None):
    """One value out of the repo's .env, without adding a dependency.

    The pipelines are run by hand and only need this for the Census API key.
    """
    for base in [Path.cwd(), *Path.cwd().parents]:
        p = base / ".env"
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            line = line.strip()
            if line.startswith(f"{name}=") and not line.startswith("#"):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
        break
    return default
