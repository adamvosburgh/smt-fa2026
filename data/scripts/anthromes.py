"""Anthromes - HYDE 3.2 inputs, the published cascade, every threshold movable.

The sandbox classifies anthromes IN THE BROWSER from six continuous input
grids, so every threshold in the published decision cascade can be a slider.
This pipeline produces what the browser needs: the six inputs aggregated to
the 33km grid the course's other global work uses, two reference
classifications to compare against, and a manifest that records every check.

THE METHOD OF RECORD. The cascade here is a numpy port of the reference
implementation published with the paper - anthromes.py in the Anthromes 12K
replication archive (doi:10.7910/DVN/IB4VCI), by Ellis, Beusen and Klein
Goldewijk, the same code the published maps were computed with. Three of its
rules are present in the code but not in the paper's figures, and they are
marked below, because they are the seam between the published method and the
executed one. THE GATE: gate() runs both the reference script and this port
on the replication archive's own 2000AD test data and requires cell-for-cell
agreement before anything ships. Run it with --gate.

WHY THE INPUTS ARE HYDE 3.2 AND NOT 3.5. 3.5's own distribution is missing
the 2000-2023 input grids (verified 2026-09-04 by reading the archive's file
headers - the folder that should hold them is present and empty), and its
classification paper is in preparation. 3.2 is what the published Anthromes
2.1 classification was computed on, reaches 2017AD, and bundles the five
supporting grids. The 3.5 CLASSIFIED series survives at 33km as a comparison
layer (data/original/anthromes-hyde35-33km, copied from the twosides repo).

INPUTS (data/original/)
-----------------------
  anthromes-inputs/raw-data.zip      HYDE 3.2: six input variables, one
                                     uncompressed multi-band GeoTIFF each,
                                     75 time steps 10000BC-2017AD, plus five
                                     supporting grids. 848,188,820 bytes.
  anthromes-inputs/anthromes12k_replication_IB4VCI.zip
                                     the reference classifier + 2000AD test
                                     data, for the gate.
  anthromes-hyde35-33km/             HYDE 3.5's classified series, already
                                     majority-aggregated to this very grid.

OUTPUTS (data/processed/anthromes/)
-----------------------------------
  manifest.json    grid, years, encodings, sources, and the measured checks
  mask.bin         the 33km land mask (720,000 cells, 1 byte each)
  popd.bin         Uint8 log-quantised population density, land cells only,
                   75 years
  cropland.bin     Uint8 fraction of land area, 0-255 = 0-1, 75 years
  grazing.bin      same
  rice.bin         sparse: per year, Uint32 count then Uint32 indices then
  irrigation.bin   Uint8 values - all three are zero over most of the world
  urban.bin        for most of the timeline, and dense planes would be 41MB
                   of nearly nothing
  method32.bin     the 3.2 cascade run at NATIVE 5 arc-minutes with default
                   thresholds, majority-aggregated: the resolution effect
  hyde35.bin       the 3.5 published classification (copied): the version
                   effect
  statics.bin      potveg15, potvill, land-area fraction per cell (Uint8 x3)

NEVER EXTRACT THE TIFFS. Six variables at 2.8GB each is 17GB expanded and a
session already filled a scratch disk doing exactly that. HYDE.zip and the
six inner .tif.zip files do touch disk (858MB, deleted after); the .tifs
themselves are read as streams, row by row - they are uncompressed and
CONTIG, so one 1,296,000-byte read is one image row with all 75 time steps
interleaved, which is the only efficient access pattern the layout allows.

USAGE
-----
    .venv/bin/python data/scripts/anthromes.py --gate    # the check, first
    .venv/bin/python data/scripts/anthromes.py           # the build
"""
import argparse
import json
import math
import shutil
import struct
import sys
import zipfile
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import original_dir  # noqa: E402

OUT = Path("data/processed/anthromes")

# The 33km grid, matching twosides/temp/grid/33km exactly - the HYDE tiepoint
# (-180, 89.999928) is the same origin, so the two align cell-for-cell and
# the 3.5 comparison layer carries over without resampling either side.
G_COLS, G_ROWS = 1200, 600
N_COLS, N_ROWS = 4320, 2160  # HYDE native 5 arc-minutes
FACTOR = N_COLS / G_COLS     # 3.6 native cells per 33km cell, NOT an integer:
                             # each native cell is binned to floor(i/3.6)

# The 75 HYDE 3.2 time steps, in band order: ten millennia, then 0AD, then
# centuries to 1600, DECADES 1700 THROUGH 2000, then every year 2001-2017.
# Read off the data, not off documentation: summing the popc bands gives
# 6.110B at band 57 and 7.407B at band 74, which are the year-2000 and
# year-2017 world populations - so the decades run to 2000 inclusive and the
# annual steps start at 2001. ("Every year 2000-2017" would mislabel the
# modern bands by one slot.)
YEARS = ([f"{y}BC" for y in range(10000, 0, -1000)]
         + ["0AD"] + [f"{y}AD" for y in range(100, 1700, 100)]
         + [f"{y}AD" for y in range(1700, 2001, 10)]
         + [f"{y}AD" for y in range(2001, 2018)])
assert len(YEARS) == 75, len(YEARS)

VARS = ["cropland", "grazing", "ir_rice", "tot_irri", "uopp", "popc"]

# TIFF geometry, verified 2026-09-04 by reading the tags: 4320x2160, 75
# samples per pixel interleaved (CONTIG), float32, uncompressed, one strip
# per row, image data contiguous from byte 23,530.
TIF_HEADER = 23530
ROW_BYTES = N_COLS * 75 * 4

DEFAULTS = {
    "urban_fraction_threshold": 0.20,
    "urban_density": 2500.0,
    "dense_settlement_density": 100.0,
    "residential_density": 10.0,
    "populated_density": 1.0,
    "wild_density": 0.0001,
    "crops_threshold": 0.20,
    "grazing_threshold": 0.20,
    "rice_threshold": 0.20,
    "irrigation_threshold": 0.20,
    "used_threshold": 0.20,
    "tree_biomes": 8,
}

CLASS_NAMES = {
    11: "Urban", 12: "Mixed settlements", 21: "Rice villages",
    22: "Irrigated villages", 23: "Rainfed villages", 24: "Pastoral villages",
    31: "Residential irrigated croplands", 32: "Residential rainfed croplands",
    33: "Populated croplands", 34: "Remote croplands",
    41: "Residential rangelands", 42: "Populated rangelands",
    43: "Remote rangelands", 51: "Residential woodlands",
    52: "Populated woodlands", 53: "Remote woodlands",
    54: "Inhabited drylands", 61: "Wild woodlands", 62: "Wild drylands",
    63: "Ice, uninhabited", 70: "No land area",
}


def classify(popd, p_cult, p_graz, p_irrig, p_rice, p_urb, biome, pot_vill,
             has_land, p=DEFAULTS):
    """The Anthromes 2.1 cascade, vectorised, thresholds movable.

    A numpy port of the reference implementation's cell loop, in ITS order -
    the cascade is first-match and the order is load-bearing. Inputs are
    already divided by cell land area (fractions 0-1; popd in persons per km2
    of land); `has_land` is maxland > 0.

    Three rules are in the reference code but not in the paper's figures,
    marked [python only] below, kept because the executed method is the
    method of record:
      - under-ice cells with any use at all become 62, not 63
      - in the used-lands branches, the per-variable threshold tests run
        BEFORE the crops-versus-grazing comparison
      - the wild cutoff is popd < 0.0001, not popd == 0
    And one quirk preserved deliberately: a cell with NO biome value counts
    as woody, because the reference defaults missing biome to -1 and tests
    biome > 8 for treelessness.
    """
    out = np.full(popd.shape, 70, dtype=np.uint8)  # no land area
    woody = ~(biome > p["tree_biomes"])            # missing biome -> woody
    ice = biome == 15
    used = p_cult + p_graz + p_urb
    unassigned = has_land.copy()

    def take(mask, code):
        nonlocal unassigned
        m = unassigned & mask
        out[m] = code
        unassigned = unassigned & ~m

    # URBAN
    take((p_urb >= p["urban_fraction_threshold"]) | (popd >= p["urban_density"]), 11)

    # WILD (popd below the 0.0001 cutoff)  [python only: the cutoff]
    wild = unassigned & (popd < p["wild_density"])
    wild_used = wild & (used >= p["used_threshold"])
    take(wild_used & (p_cult >= p["crops_threshold"]), 34)   # [python only]
    take(wild_used & (p_graz >= p["grazing_threshold"]), 43)  # [python only]
    take(wild_used & (p_cult >= p_graz), 34)
    take(wild_used, 43)
    wild_unused = unassigned & (popd < p["wild_density"])
    take(wild_unused & ice & (used > 0), 62)                  # [python only]
    take(wild_unused & ice, 63)
    take(wild_unused & woody, 61)
    take(wild_unused, 62)

    # REMOTE (popd < 1)
    remote = unassigned & (popd < p["populated_density"])
    take(remote & (p_cult >= p["crops_threshold"]), 34)
    take(remote & (p_graz >= p["grazing_threshold"]), 43)
    remote_used = unassigned & (popd < p["populated_density"]) & (used >= p["used_threshold"])
    take(remote_used & (p_cult >= p_graz), 34)
    take(remote_used, 43)
    remote_rest = unassigned & (popd < p["populated_density"])
    take(remote_rest & ~woody, 54)
    take(remote_rest, 53)

    # POPULATED (popd < 10)
    pop = unassigned & (popd < p["residential_density"])
    take(pop & (p_cult >= p["crops_threshold"]), 33)
    take(pop & (p_graz >= p["grazing_threshold"]), 42)
    pop_rest = unassigned & (popd < p["residential_density"])
    take(pop_rest & ~woody, 54)
    take(pop_rest, 52)

    # RESIDENTIAL (popd < 100)
    res = unassigned & (popd < p["dense_settlement_density"])
    take(res & (p_irrig >= p["irrigation_threshold"]) & (p_cult >= p["crops_threshold"]), 31)
    take(res & (p_cult >= p["crops_threshold"]), 32)
    take(res & (p_graz >= p["grazing_threshold"]), 41)
    res_rest = unassigned & (popd < p["dense_settlement_density"])
    take(res_rest & ~woody, 54)
    take(res_rest, 51)

    # VILLAGES AND DENSE (popd >= 100)
    take(unassigned & (pot_vill == 0), 12)
    take(unassigned & (p_rice >= p["rice_threshold"]), 21)
    take(unassigned & (p_irrig >= p["irrigation_threshold"]), 22)
    take(unassigned & (p_cult >= p["crops_threshold"]), 23)
    take(unassigned & (p_graz >= p["grazing_threshold"]), 24)
    take(unassigned, 12)
    return out


# --------------------------------------------------------------------------
# ASCII grids (the replication test data) and raw TIFF streams (the inputs)
# --------------------------------------------------------------------------

def read_asc(path):
    """A HYDE ASCII grid as (array, nodata). Header is 6 lines."""
    with open(path) as f:
        head = {}
        for _ in range(6):
            k, v = f.readline().split()
            head[k.lower()] = float(v)
        data = np.loadtxt(f, dtype=np.float64)
    return data, head.get("nodata_value", -9999.0)


def tif_stream(zf, member):
    """A member .tif.zip's inner .tif, as a positioned raw stream.

    The tif is stored inside its own zip inside HYDE.zip; only HYDE.zip and
    the per-variable zips are on disk. The inner tif is read sequentially -
    skip the 23,530-byte header, then every read of ROW_BYTES is one image
    row, all 75 bands interleaved.
    """
    inner = zipfile.ZipFile(member)
    names = [n for n in inner.namelist() if n.endswith(".tif")]
    assert len(names) == 1, names
    fh = inner.open(names[0])
    skipped = fh.read(TIF_HEADER)
    assert len(skipped) == TIF_HEADER
    return fh


def read_supporting(raw_zip):
    """The five supporting grids, small enough to read whole.

    Single-band uncompressed TIFFs in supporting_5m_grids.zip; float32 except
    where noted. Only the header offset differs per file, so it is read from
    the IFD properly here rather than assumed.
    """
    out = {}
    with zipfile.ZipFile(raw_zip) as raw:
        with raw.open("raw-data/supporting_5m_grids.zip") as sup_f:
            import io
            sup = zipfile.ZipFile(io.BytesIO(sup_f.read()))
        for name, dtype in (("maxln_cr.tif", "<f4"), ("potveg15.tif", "<f4"),
                            ("potvill20.tif", "<f4")):
            buf = sup.read(f"supporting_5m_grids/{name}")
            arr = _parse_single_band_tif(buf, dtype)
            out[name.split(".")[0]] = arr
        xlsx = sup.read("supporting_5m_grids/potential_vegetation_classes.xlsx")
    return out, xlsx


def _parse_single_band_tif(buf, dtype):
    """Minimal TIFF IFD walk, uncompressed only, stripped OR tiled.

    The six input variables are stripped; the five supporting grids turn out
    to be TILED at 128x128 - same data, different furniture.
    """
    assert buf[:2] in (b"II",), "expected little-endian TIFF"
    magic, ifd_off = struct.unpack_from("<HI", buf, 2)
    assert magic == 42
    n = struct.unpack_from("<H", buf, ifd_off)[0]
    tags = {}
    for i in range(n):
        tag, typ, count, val = struct.unpack_from("<HHII", buf, ifd_off + 2 + i * 12)
        tags[tag] = (typ, count, val)
    width = tags[256][2]
    height = tags[257][2]
    assert (width, height) == (N_COLS, N_ROWS), (width, height)
    assert tags.get(259, (0, 0, 1))[2] == 1, "compressed supporting tif"

    def offsets_of(tag):
        typ, count, val = tags[tag]
        if count == 1:
            return [val]
        return list(struct.unpack_from(f"<{count}I", buf, val))

    if 273 in tags:  # stripped
        offsets = offsets_of(273)
        rows_per_strip = tags.get(278, (0, 0, height))[2]
        rows = []
        for si, off in enumerate(offsets):
            nrows = min(rows_per_strip, height - si * rows_per_strip)
            rows.append(np.frombuffer(buf, dtype, count=nrows * width, offset=off)
                        .reshape(nrows, width))
        return np.vstack(rows)

    # tiled (tags 322/323/324)
    tw = tags[322][2]
    th = tags[323][2]
    offsets = offsets_of(324)
    tiles_across = (width + tw - 1) // tw
    out = np.zeros((height, width), dtype=dtype)
    for ti, off in enumerate(offsets):
        ty = (ti // tiles_across) * th
        tx = (ti % tiles_across) * tw
        tile = np.frombuffer(buf, dtype, count=tw * th, offset=off).reshape(th, tw)
        out[ty:min(ty + th, height), tx:min(tx + tw, width)] = \
            tile[:min(th, height - ty), :min(tw, width - tx)]
    return out


# --------------------------------------------------------------------------
# The gate - run before anything ships
# --------------------------------------------------------------------------

def gate(original, scratch):
    """Cell-for-cell agreement with the reference implementation.

    Extracts the replication archive, runs the AUTHORS' OWN anthromes.py on
    their own 2000AD test data, runs classify() above on the same numbers,
    and requires the two maps to be identical. A cascade that cannot pass
    this has no business under thirteen sliders.
    """
    import subprocess
    work = scratch / "anthromes-gate"
    scripts = work / "anthromes_scripts"
    if not scripts.exists():
        work.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(original / "anthromes-inputs"
                             / "anthromes12k_replication_IB4VCI.zip") as z:
            z.extractall(work)
    ref_out = scripts / "output" / "anthromes2000AD.asc"
    if not ref_out.exists():
        driver = work / "run_reference.py"
        driver.write_text(
            "import os, sys\n"
            f"os.chdir({str(scripts)!r})\n"
            "sys.path.insert(0, '.')\n"
            "from anthromes import calculate\n"
            "class Empty: pass\n"
            "p = Empty()\n"
            "p.my_sys_ldebug = 0; p.anth_past = 0\n"
            "p.anthromes_min_frac = 0.2; p.pasture_min_frac = 0.2\n"
            "p.nameyear = '2000AD'\n"
            "p.regionmap_image = 'fixed_input/greg28_cr.asc'\n"
            "p.countrymap = 'fixed_input/iso_cr.asc'\n"
            "p.biome_class = 'fixed_input/biome_cr.asc'\n"
            "p.maxland = 'fixed_input/maxln_cr.asc'\n"
            "p.pot_vill = 'fixed_input/pot_vill_cr.asc'\n"
            "p.mask = None\n"
            "p.sum_dir = 'output/sum'\n"
            "import os as o; o.makedirs(p.sum_dir, exist_ok=True)\n"
            "calculate('2000', p, datadir='hyde_output')\n")
        print("gate: running the reference classifier (pure python, slow)…")
        subprocess.run([sys.executable, str(driver)], check=True)

    print("gate: reading the reference output and re-deriving with classify()")
    ref, ref_nd = read_asc(ref_out)

    hyde = scripts / "hyde_output"
    fixed = scripts / "fixed_input"
    popd, popd_nd = read_asc(hyde / "popd_2000AD.asc")
    crops, _ = read_asc(hyde / "cropland2000AD.asc")
    pasture, _ = read_asc(hyde / "pasture2000AD.asc")
    rangeland, _ = read_asc(hyde / "rangeland2000AD.asc")
    conv, _ = read_asc(hyde / "conv_rangeland2000AD.asc")
    irri, _ = read_asc(hyde / "tot_irri2000AD.asc")
    rice, _ = read_asc(hyde / "ir_rice2000AD.asc")
    urb, _ = read_asc(hyde / "uopp_2000AD.asc")
    biome, _ = read_asc(fixed / "biome_cr.asc")
    maxln, _ = read_asc(fixed / "maxln_cr.asc")
    potvill, _ = read_asc(fixed / "pot_vill_cr.asc")

    valid = popd != popd_nd            # the reference keys land on popd
    has_land = maxln > 0
    with np.errstate(divide="ignore", invalid="ignore"):
        f = lambda a: np.where(has_land, np.where(a < 0, 0, a) / np.where(has_land, maxln, 1), 0)  # noqa: E731
        ours = classify(
            np.where(popd == popd_nd, 0, popd),
            f(crops),
            f(pasture) + f(rangeland) + f(conv),
            f(irri), f(rice), f(urb),
            np.where(biome < 0, -1, biome).astype(np.int32),
            np.where(potvill < 0, 0, potvill).astype(np.int32),
            has_land)
    ref_i = np.where(ref == ref_nd, -1, ref).astype(np.int32)
    ours_i = np.where(valid, ours.astype(np.int32), -1)
    both = valid
    agree = (ref_i[both] == ours_i[both])
    n_disagree = int((~agree).sum())
    total = int(both.sum())
    print(f"gate: {total:,} classified cells, {n_disagree:,} disagree "
          f"({100 * n_disagree / total:.4f}%)")
    if n_disagree:
        bad = np.argwhere(both & (ref_i != ours_i))[:10]
        for r, c in bad:
            print(f"  cell ({r},{c}): reference {ref_i[r, c]} ours {ours_i[r, c]} "
                  f"popd={popd[r, c]:.4f} maxln={maxln[r, c]:.4f}")
        raise SystemExit("gate FAILED - the cascade is wrong; nothing ships on it")
    print("gate: PASSED - cell-for-cell agreement with the reference implementation")
    return {"cells": total, "disagreements": n_disagree,
            "against": "anthromes.py from doi:10.7910/DVN/IB4VCI run on its own "
                       "2000AD test data, cell for cell"}


# --------------------------------------------------------------------------
# The build - six synchronized streams, one pass
# --------------------------------------------------------------------------

def build(original, scratch, gate_result):
    OUT.mkdir(parents=True, exist_ok=True)
    raw_zip = original / "anthromes-inputs" / "raw-data.zip"

    # -- supporting grids ---------------------------------------------------
    print("read: supporting grids")
    sup, potveg_xlsx = read_supporting(raw_zip)
    maxln = sup["maxln_cr"]          # km2 of land per native cell
    maxln = np.where(np.isfinite(maxln) & (maxln > 0), maxln, 0.0)
    global _MAXLN_FOR_STATICS
    _MAXLN_FOR_STATICS = maxln
    biome = sup["potveg15"]
    biome = np.where(np.isfinite(biome), biome, -1).astype(np.int32)
    potvill = sup["potvill20"]
    potvill = np.where(np.isfinite(potvill) & (potvill > 0), 1, 0).astype(np.int32)
    pnv_names = read_pnv_names(potveg_xlsx)
    print(f"read: potveg 1..15 = {', '.join(pnv_names[k] for k in sorted(pnv_names))}")

    # -- HYDE.zip and the six per-variable zips to disk (858MB, temporary) --
    hyde_dir = scratch / "hyde32"
    hyde_dir.mkdir(parents=True, exist_ok=True)
    var_zips = {}
    hyde_zip_path = hyde_dir / "HYDE.zip"
    if not hyde_zip_path.exists():
        print("extract: HYDE.zip (837MB) to scratch - the .tifs themselves stay zipped")
        with zipfile.ZipFile(raw_zip) as raw, raw.open("raw-data/HYDE.zip") as src, \
                open(hyde_zip_path, "wb") as dst:
            shutil.copyfileobj(src, dst, 1 << 20)
    with zipfile.ZipFile(hyde_zip_path) as hz:
        for v in VARS:
            p = hyde_dir / f"{v}.tif.zip"
            if not p.exists():
                with hz.open(f"HYDE/{v}.tif.zip") as src, open(p, "wb") as dst:
                    shutil.copyfileobj(src, dst, 1 << 20)
            var_zips[v] = p

    # -- the 33km targets ---------------------------------------------------
    col_bin = (np.arange(N_COLS) / FACTOR).astype(np.int64)     # native col -> 33km col
    # accumulators: land-area-weighted sums per variable per year, plus weight
    acc = {v: np.zeros((75, G_ROWS, G_COLS), dtype=np.float32) for v in VARS}
    wsum = np.zeros((G_ROWS, G_COLS), dtype=np.float64)
    code_lut = np.zeros(256, dtype=np.int64)
    # majority votes for the native-classified plane, flushed per 33km row
    classes = sorted(CLASS_NAMES)
    class_pos = {c: i for i, c in enumerate(classes)}
    votes = np.zeros((75, G_COLS, len(classes)), dtype=np.float32)
    for c, i in class_pos.items():
        code_lut[c] = i
    method32 = np.zeros((75, G_ROWS, G_COLS), dtype=np.uint8)

    streams = {v: tif_stream(None, var_zips[v]) for v in VARS}
    print("stream: 6 x 2.8GB, one synchronized pass, 2,160 rows")
    cur_g_row = 0
    for r in range(N_ROWS):
        row = {}
        for v in VARS:
            buf = streams[v].read(ROW_BYTES)
            assert len(buf) == ROW_BYTES, f"{v} truncated at row {r}"
            row[v] = np.frombuffer(buf, "<f4").reshape(N_COLS, 75)
        g_row = int(r / FACTOR)
        if g_row != cur_g_row:
            flush_votes(votes, method32, classes, cur_g_row)
            cur_g_row = g_row

        w = maxln[r]                                   # (4320,)
        land = w > 0
        # nodata in these TIFFs is NaN (verified by summing bands: ocean is
        # NaN, not -1), and NaN sails straight through a `< 0` clamp - one
        # NaN native cell then poisons its whole 33km bin. Zero both.
        vals = {v: np.clip(np.nan_to_num(row[v], nan=0.0), 0.0, None)
                for v in VARS}
        # aggregate: the TIFF values are already TOTALS per native cell - km2
        # of cropland, persons of population - so the aggregation is a plain
        # sum, and dividing the summed totals by the summed land area IS the
        # land-area-weighted mean of the per-cell fractions. Multiplying by w
        # here would weight a total by an area and inflate everything by a
        # cell's land area - a bug that announced itself as a world of 368
        # billion people, which is why write_manifest checks the totals.
        np.add.at(wsum[g_row], col_bin, w)
        for v in VARS:
            np.add.at(acc[v][:, g_row, :].T, col_bin, vals[v].astype(np.float32))

        # native classification for this row, all 75 years at once
        with np.errstate(divide="ignore", invalid="ignore"):
            wl = np.where(land, w, 1.0)[:, None]
            codes = classify(
                vals["popc"] / wl,
                vals["cropland"] / wl,
                vals["grazing"] / wl,
                vals["tot_irri"] / wl,
                vals["ir_rice"] / wl,
                vals["uopp"] / wl,
                np.broadcast_to(biome[r][:, None], (N_COLS, 75)),
                np.broadcast_to(potvill[r][:, None], (N_COLS, 75)),
                np.broadcast_to(land[:, None], (N_COLS, 75)))
        # weighted votes into the 33km cell, land cells only
        li = np.nonzero(land)[0]
        if len(li):
            ci = col_bin[li]
            pos = code_lut[codes[li]]                      # (nl, 75)
            for y in range(75):
                np.add.at(votes[y], (ci, pos[:, y]), w[li])
        if r % 216 == 0:
            print(f"stream: row {r}/{N_ROWS}")
    flush_votes(votes, method32, classes, cur_g_row)
    for v in VARS:
        streams[v].close()

    # -- form the 33km inputs ----------------------------------------------
    # THE MASK IS THE 3.5 LAYER'S MASK, not ours: hyde35.bin is indexed by
    # the twosides land mask (182,503 cells), and adopting it is what keeps
    # the comparison plane aligned cell-for-cell. Cells in that mask where
    # HYDE 3.2 carries no land area get zero inputs and zero land area, and
    # the browser draws them as class 70 rather than classifying nothing.
    mask_src = Path("data/original/anthromes-hyde35-33km")
    # twosides packs its mask 1 bit per cell, row-major, MSB-first; ours
    # ships unpacked (a byte per cell) because 720KB is nothing beside the
    # planes and the browser wants a plain index.
    landmask = np.unpackbits(
        np.frombuffer((mask_src / "mask.bin").read_bytes(), np.uint8),
        bitorder="big").reshape(G_ROWS, G_COLS) > 0
    n_land = int(landmask.sum())
    ours_only = int(((wsum > 0) & ~landmask).sum())
    theirs_only = int((landmask & ~(wsum > 0)).sum())
    print(f"grid: {n_land:,} land cells (the 3.5 layer's mask); "
          f"{theirs_only:,} of them have no HYDE 3.2 land, "
          f"{ours_only:,} HYDE land cells fall outside it and are dropped")
    with np.errstate(divide="ignore", invalid="ignore"):
        dens = {v: np.nan_to_num(
                    np.where(landmask & (wsum > 0),
                             acc[v] / np.where(wsum > 0, wsum, 1), 0))
                for v in VARS}
    # popc aggregated by weight-sum then divided by land = persons per km2 of
    # land, which is exactly the popd the reference cascade thresholds on.

    # The totals check: a world of six billion people and fifteen million km2
    # of cropland in 2000AD, or the aggregation arithmetic is wrong. This is
    # the check that caught the weighting bug above.
    yi = YEARS.index("2000AD")
    pop2000 = float((dens["popc"][yi] * wsum).sum())
    crop2000 = float((dens["cropland"][yi] * wsum).sum())
    print(f"check: world 2000AD - population {pop2000 / 1e9:.2f}B, "
          f"cropland {crop2000 / 1e6:.1f}M km2")
    assert 5.0e9 < pop2000 < 7.5e9, f"world population {pop2000:.3g} is not a world"
    assert 10e6 < crop2000 < 20e6, f"cropland {crop2000:.3g} km2 is not a world"
    world_totals = {"population_2000AD": round(pop2000 / 1e9, 2),
                    "cropland_2000AD_km2": round(crop2000 / 1e6, 1),
                    "expected": "about 6.1B and about 15M km2; HYDE's own totals"}

    hyde35_years = write_planes(dens, wsum, landmask, method32, biome, potvill)
    layer_checks = compare_layers(dens, landmask, method32, biome, potvill,
                                  hyde35_years)
    layer_checks["world_totals"] = world_totals
    checks = write_manifest(gate_result, n_land, landmask, wsum, pnv_names,
                            hyde35_years, layer_checks)

    # scratch cleanup: 858MB of zips served their purpose
    shutil.rmtree(hyde_dir, ignore_errors=True)
    return checks


def flush_votes(votes, method32, classes, g_row):
    if votes.any():
        winner = np.argmax(votes, axis=2)              # (75, G_COLS)
        any_votes = votes.sum(axis=2) > 0
        arr = np.array(classes, dtype=np.uint8)[winner]
        method32[:, g_row, :] = np.where(any_votes, arr, 0)
    votes[:] = 0


def read_pnv_names(xlsx_bytes):
    """Class names from potential_vegetation_classes.xlsx - the shipped
    record, not a hardcoded copy of the R source."""
    import io
    import re
    import xml.etree.ElementTree as ET
    z = zipfile.ZipFile(io.BytesIO(xlsx_bytes))
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in root.findall("m:si", ns):
            shared.append("".join(t.text or "" for t in si.iter(
                "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")))
    sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    # The 15-class table lives in columns I (class) and J (description),
    # under the "potveg_15.tif" heading; column A holds the OLD 12-class
    # table. Cells are picked by their reference, not their order.
    names = {}
    for row in sheet.findall(".//m:row", ns):
        by_col = {}
        for c in row.findall("m:c", ns):
            v = c.find("m:v", ns)
            if v is None:
                continue
            val = shared[int(v.text)] if c.get("t") == "s" else v.text
            col = re.match(r"([A-Z]+)", c.get("r", "")).group(1)
            by_col[col] = val
        i, j = by_col.get("I", ""), by_col.get("J", "")
        if re.fullmatch(r"\d+(\.0)?", i or "") and j and not j[0].isdigit():
            k = int(float(i))
            if 1 <= k <= 15 and k not in names:
                names[k] = j
    return names


# Population density is shipped log-quantised in a byte: 0 means exactly
# zero, 1..255 span 1e-5..1e6 persons/km2 geometrically (about 11% per step).
# The wild cutoff at 0.0001 stays representable because zero stays zero.
D_MIN, D_MAX = 1e-5, 1e6
D_K = 254.0 / math.log(D_MAX / D_MIN)


def quant_density(d):
    q = np.zeros(d.shape, dtype=np.uint8)
    nz = d > 0
    q[nz] = np.clip(np.round(1 + D_K * np.log(np.clip(d[nz], D_MIN, D_MAX) / D_MIN)),
                    1, 255).astype(np.uint8)
    return q


def write_planes(dens, wsum, landmask, method32, biome, potvill):
    flat = landmask.ravel()
    idx = np.nonzero(flat)[0]

    def land_only(plane):                       # (75, rows, cols) -> (75, nLand)
        return plane.reshape(75, -1)[:, idx]

    (OUT / "mask.bin").write_bytes(landmask.astype(np.uint8).tobytes())
    (OUT / "popd.bin").write_bytes(quant_density(land_only(dens["popc"])).tobytes())
    for v, name in (("cropland", "cropland"), ("grazing", "grazing")):
        frac = np.clip(land_only(dens[v]), 0, 1)
        (OUT / f"{name}.bin").write_bytes(
            np.round(frac * 255).astype(np.uint8).tobytes())

    # sparse planes: rice, irrigation, urban are zero over most of the world
    # for most of the timeline. Per year: Uint32 count, Uint32 indices into
    # the land-cell array, Uint8 values.
    for v, name in (("ir_rice", "rice"), ("tot_irri", "irrigation"),
                    ("uopp", "urban")):
        frac = np.clip(land_only(dens[v]), 0, 1)
        q = np.round(frac * 255).astype(np.uint8)
        parts = []
        for y in range(75):
            nz = np.nonzero(q[y])[0].astype("<u4")
            parts.append(struct.pack("<I", len(nz)))
            parts.append(nz.tobytes())
            parts.append(q[y][nz].tobytes())
        (OUT / f"{name}.bin").write_bytes(b"".join(parts))

    (OUT / "method32.bin").write_bytes(method32.reshape(75, -1)[:, idx].tobytes())

    # statics: potveg15 and potvill majority-binned, land-area fraction
    col_bin = (np.arange(N_COLS) / FACTOR).astype(np.int64)
    row_bin = (np.arange(N_ROWS) / FACTOR).astype(np.int64)
    pv = np.zeros((G_ROWS, G_COLS, 16), dtype=np.float64)
    vl = np.zeros((G_ROWS, G_COLS), dtype=np.float64)
    vtot = np.zeros((G_ROWS, G_COLS), dtype=np.float64)
    sup_maxln = np.asarray(_MAXLN_FOR_STATICS)
    for r in range(N_ROWS):
        g = row_bin[r]
        w = sup_maxln[r]
        b = np.clip(biome[r], 0, 15)
        np.add.at(pv[g], (col_bin, b), w)
        np.add.at(vl[g], col_bin, np.where(potvill[r] > 0, w, 0))
        np.add.at(vtot[g], col_bin, w)
    pv_maj = np.argmax(pv, axis=2).astype(np.uint8)
    vill = np.where(vtot > 0, vl / np.where(vtot > 0, vtot, 1) >= 0.5, 0).astype(np.uint8)
    global _pv_major, _vill_major
    _pv_major = pv_maj.astype(np.int32)
    _vill_major = vill.astype(np.int32)
    # land-area fraction of each 33km cell, 0-255 = 0-100%
    cell_area = cell_areas()
    frac_land = np.clip(wsum / cell_area, 0, 1)
    statics = np.stack([pv_maj, vill,
                        np.round(frac_land * 255).astype(np.uint8)])
    (OUT / "statics.bin").write_bytes(
        np.ascontiguousarray(statics.reshape(3, -1)[:, np.nonzero(landmask.ravel())[0]]).tobytes())

    # the 3.5 published classification, already on this grid - copied through
    src = Path("data/original/anthromes-hyde35-33km")
    shutil.copyfile(src / "codes.bin", OUT / "hyde35.bin")
    print("write: planes done")
    return json.loads((src / "manifest.json").read_text())["years"]


_MAXLN_FOR_STATICS = None


def cell_areas():
    """True km2 per 33km cell, from the spherical geometry - the drawing is
    equirectangular and badly exaggerates high latitudes; the numbers are
    computed with the real areas and are not."""
    R = 6371.0088
    res = math.radians(0.30)
    lat_n = np.radians(89.999928 - 0.30 * np.arange(G_ROWS))
    lat_s = lat_n - res
    band = R * R * res * (np.sin(lat_n) - np.sin(lat_s))
    return np.tile(band[:, None], (1, G_COLS))


def compare_layers(dens, landmask, method32, biome, potvill, hyde35_years):
    """The measured three-layer comparison, at 2017AD, for the manifest.

    Ours-at-33km against the native-classified majority is the RESOLUTION
    effect, and it is large: a land-area-weighted MEAN pushed through a
    threshold cascade reads systematically denser than the majority of the
    native cells underneath, because population is concentrated and a mean is
    dominated by the town. That is not an error - it is the thing this layer
    exists to show - but the number belongs in the manifest so nobody has to
    take that on faith. method32 against HYDE 3.5's published series is the
    version effect, and doubles as the sanity check on method32 itself: the
    two are built by entirely separate code paths.
    """
    yi = YEARS.index("2017AD")
    ours = classify(dens["popc"][yi], dens["cropland"][yi], dens["grazing"][yi],
                    dens["tot_irri"][yi], dens["ir_rice"][yi], dens["uopp"][yi],
                    _pv_major, _vill_major, landmask)
    m32 = method32[yi]
    h35_all = np.frombuffer(
        (Path("data/original/anthromes-hyde35-33km") / "codes.bin").read_bytes(),
        np.uint8).reshape(len(hyde35_years), -1)
    idx = np.nonzero(landmask.ravel())[0]
    h35 = np.zeros(landmask.shape, np.uint8)
    h35.ravel()[idx] = h35_all[hyde35_years.index("2017AD")]
    lm = landmask & (m32 > 0) & (h35 > 0)
    ours_v_m32 = float((ours[lm] == m32[lm]).mean())
    m32_v_h35 = float((m32[lm] == h35[lm]).mean())
    return {
        "at": "2017AD, unweighted cell share",
        "ours33km_vs_method_native": round(ours_v_m32, 3),
        "resolution_note": "Same data, same thresholds; classified after "
                           "aggregation (ours) against before (method32). The "
                           "disagreement IS the resolution effect and it is "
                           "the exhibit, not a bug.",
        "method_native_vs_hyde35": round(m32_v_h35, 3),
        "version_note": "Different input data, separately built aggregation "
                        "paths; this doubles as the sanity check on method32."
    }


_pv_major = None
_vill_major = None


def write_manifest(gate_result, n_land, landmask, wsum, pnv_names, hyde35_years,
                   layer_checks=None):
    idx = np.nonzero(landmask.ravel())[0]
    files = ["mask.bin", "popd.bin", "cropland.bin", "grazing.bin", "rice.bin",
             "irrigation.bin", "urban.bin", "method32.bin", "hyde35.bin",
             "statics.bin"]
    sizes = {f: (OUT / f).stat().st_size for f in files}
    import gzip
    gz = {f: len(gzip.compress((OUT / f).read_bytes(), 6)) for f in files}
    manifest = {
        "sandbox": "anthromes",
        "generated": "2026-09-04",
        "grid": {"res": 0.30, "cols": G_COLS, "rows": G_ROWS,
                 "originX": -180.0, "originY": 89.999928,
                 "nLand": n_land,
                 "note": "The same 33km grid as the course's other global "
                         "work; HYDE's native tiepoint is the same origin, "
                         "so the 3.5 comparison layer aligns cell-for-cell "
                         "with no resampling."},
        "years": YEARS,
        "hyde35_years": hyde35_years,
        "years_note": "75 HYDE 3.2 time steps, 10000BC to 2017AD. 2018-2025 "
                      "have no input grids in any HYDE release we could "
                      "obtain - 3.5's own archive is missing them - and the "
                      "timeline says so rather than ending silently.",
        "defaults": DEFAULTS,
        "classes": {str(k): v for k, v in CLASS_NAMES.items()},
        "potential_vegetation": {str(k): v for k, v in sorted(pnv_names.items())},
        "encodings": {
            "popd.bin": "Uint8 per land cell per year, 75 years. 0 = exactly "
                        "zero; 1..255 log-quantised over 1e-5..1e6 persons "
                        "per km2 of land (~11% per step). density = "
                        f"1e-5 * exp((q-1)/{D_K:.6f})",
            "cropland.bin": "Uint8, fraction of cell land area, 0-255 = 0-1",
            "grazing.bin": "same",
            "rice.bin": "sparse per year: Uint32 count, Uint32 land-cell "
                        "indices, Uint8 fractions - zero cells omitted",
            "irrigation.bin": "same", "urban.bin": "same",
            "method32.bin": "Uint8 class code per land cell per year: the "
                            "cascade run at native 5 arc-minutes with the "
                            "default thresholds, land-area-weighted majority "
                            "to 33km. Same data, same thresholds, classified "
                            "before aggregation instead of after - the "
                            "difference from the browser's own map is purely "
                            "the resolution effect.",
            "hyde35.bin": "Uint8 class code per land cell, 76 years "
                          "(10000BC-2025AD, one more step than the inputs): "
                          "HYDE 3.5's published classification, majority-"
                          "aggregated - different data, eight years longer. "
                          "The difference from method32 is the dataset-"
                          "version effect.",
            "statics.bin": "3 x Uint8 per land cell: potential vegetation "
                           "class (majority), potential-villages flag, land "
                           "fraction of the cell (0-255 = 0-100%)."
        },
        "checks": {
            "gate": gate_result,
            "layers": layer_checks,
            "payload_bytes": sizes,
            "payload_gzip_bytes": gz,
            "payload_gzip_total": sum(gz.values()),
        },
        "sources": {
            "inputs": "HYDE 3.2 raw-data.zip, doi:10.7910/DVN/E3H3AK "
                      "(fileId 4570054, 848,188,820 bytes): cropland, "
                      "grazing, ir_rice, tot_irri, uopp, popc at 5 "
                      "arc-minutes, 75 time steps, plus the five supporting "
                      "grids.",
            "method": "Anthromes 2.1 (Ellis, Beusen & Klein Goldewijk 2020, "
                      "Land 9(5):129). Thresholds and order from the "
                      "reference implementation in the replication archive "
                      "doi:10.7910/DVN/IB4VCI, which is the executed method "
                      "of record; three of its rules are in the code but "
                      "not the paper, and the pipeline keeps them.",
            "comparison": "HYDE 3.5 classified series (baseline), "
                          "majority-aggregated to this grid in the twosides "
                          "repo and copied from "
                          "data/original/anthromes-hyde35-33km.",
        },
        "why_32_not_35": "HYDE 3.5's own distribution is missing the "
                         "2000-2023 input grids (verified 2026-09-04 from "
                         "the archive's file headers) and its classification "
                         "paper is in preparation. 3.2 is the documented "
                         "method of record and reaches 2017AD.",
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))
    total = sum(sizes.values())
    print(f"write: manifest; raw {total / 1e6:.1f}MB, gzip "
          f"{sum(gz.values()) / 1e6:.1f}MB")
    return manifest["checks"]


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--original", type=Path, default=None)
    ap.add_argument("--scratch", type=Path,
                    default=Path("/tmp/smt-anthromes"))
    ap.add_argument("--gate", action="store_true",
                    help="run only the reference-agreement gate")
    args = ap.parse_args()
    original = original_dir(args.original)
    args.scratch.mkdir(parents=True, exist_ok=True)

    gate_result = gate(original, args.scratch)
    if args.gate:
        return
    build(original, args.scratch, gate_result)


if __name__ == "__main__":
    main()
