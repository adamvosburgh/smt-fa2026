#!/usr/bin/env bash
# Fetch the Anthromes sandbox's input grids: HYDE 3.2 plus the supporting grids,
# from Harvard Dataverse.
#
# WHY 3.2 AND NOT 3.5. HYDE 3.5's own distribution is missing the 2000-2023
# input grids. Verified 2026-09-04 by stream-reading the local file headers out
# of baseline/3zip/1970ce-2023ce.zip inside Adam's 18.1GB archive: 60 members,
# 30 years, 1970AD-1999AD. The archive is named for a period it does not hold,
# the empty zip/ and NetCDF/ folders offer no alternative, and the Utrecht vault
# is unreachable (bot wall, from both a script and a browser). So 3.5's sliders
# would die at 1999.
#
# HYDE 3.2 is what the published Anthromes 2.1 classification was actually
# computed on. One download carries all six input grids for all 75 time steps
# AND the five supporting grids the classifier cannot run without. Sliders reach
# 2017AD: 68 of the 76 display years against 3.5's 62. And because it is the
# documented method of record, our cascade at default thresholds should
# reproduce the published map - which is a check 3.5 cannot offer, its
# classification paper still being in preparation.
#
# Adam's HYDE 3.5 archive stays in the repo and stays useful: its published
# classification is complete, 128 steps to 2025AD, and is the "the 2025 dataset
# says this instead" comparison layer.
#
#   bash data/scripts/fetch-anthromes-inputs.sh
#
# Resumable. Re-running skips what is already present and verified.
#
# Dataverse is not behind a bot wall and answers plain curl. The filename to
# fileId mapping is resolved from the API at runtime rather than hardcoded,
# because the two candidate zips in this dataset could not be told apart from
# outside.

set -u
cd "$(dirname "$0")/../.." || exit 1

DOI="doi:10.7910/DVN/E3H3AK"
DV="https://dataverse.harvard.edu"
DEST="data/original/anthromes-inputs"
mkdir -p "$DEST"

echo
echo "resolving $DOI"
echo "-----------------------------------------"
LIST="$DEST/.dataverse-files.json"

# Two endpoints. The first is the modern files listing; the second returns the
# whole dataset record with latestVersion.files inside it and is supported on
# every Dataverse version. Try both, with a timeout - an unbounded curl here
# just hangs and tells you nothing, which is what happened on the first run.
try_api() {
  local url="$1" label="$2" code
  printf '  %-22s ' "$label"
  code=$(curl -sSL --max-time 120 --retry 2 --retry-delay 3 \
              -w '%{http_code}' -o "$LIST.part" "$url" 2>"$DEST/.curl-err")
  if [ "$code" = "200" ] && [ -s "$LIST.part" ]; then
    mv "$LIST.part" "$LIST"; echo "HTTP 200, $(wc -c < "$LIST") bytes"; return 0
  fi
  echo "HTTP ${code:-none}"
  [ -s "$DEST/.curl-err" ] && sed 's/^/      /' "$DEST/.curl-err"
  if [ -s "$LIST.part" ]; then echo "      body starts:"; head -c 200 "$LIST.part" | sed 's/^/      /'; echo; fi
  rm -f "$LIST.part"; return 1
}

if ! try_api "$DV/api/datasets/:persistentId/versions/:latest/files?persistentId=$DOI" "files endpoint" \
   && ! try_api "$DV/api/datasets/:persistentId/?persistentId=$DOI" "dataset endpoint"; then
  echo
  echo "  Could not reach Dataverse. Check plain connectivity with:"
  echo "      curl -sS -o /dev/null -w '%{http_code}\\n' --max-time 30 $DV/api/info/version"
  echo "  If that also fails it is the network, not this script."
  exit 1
fi

python3 - "$LIST" <<'PY' > "$DEST/.manifest.tsv"
import json, sys
d = json.load(open(sys.argv[1]))
data = d.get("data", {})
# files endpoint -> data is a list; dataset endpoint -> data.latestVersion.files
files = data if isinstance(data, list) else data.get("latestVersion", {}).get("files", [])
for f in files:
    df = f.get("dataFile", {})
    print(f"{df.get('id','')}\t{df.get('filesize',0)}\t{df.get('filename','?')}")
PY

if [ ! -s "$DEST/.manifest.tsv" ]; then
  echo "  The API answered but no files parsed out of it. Response starts:"
  head -c 400 "$LIST" | sed 's/^/    /'; echo
  exit 1
fi

echo "  files in this dataset:"
awk -F'\t' '{printf "    %-12s %14s  %s\n", $1, $2, $3}' "$DEST/.manifest.tsv"

FID=$(awk -F'\t' '$3=="raw-data.zip"{print $1}' "$DEST/.manifest.tsv")
if [ -z "$FID" ]; then
  echo
  echo "  raw-data.zip is not in this dataset under that name."
  echo "  Look at the list above and pick the zip that holds the HYDE grids,"
  echo "  then fetch it by hand:  curl -L -o $DEST/raw-data.zip $DV/api/access/datafile/<id>"
  exit 1
fi
echo
echo "  raw-data.zip -> fileId $FID"

OUT="$DEST/raw-data.zip"
if [ -f "$OUT" ] && unzip -tqq "$OUT" >/dev/null 2>&1; then
  echo "  have    raw-data.zip ($(du -h "$OUT" | cut -f1))"
else
  echo
  echo "downloading (expect roughly 850MB to 1GB)"
  echo "-----------------------------------------"
  rm -f "$OUT"
  if ! curl -L -C - --retry 3 --progress-bar -o "$OUT.part" "$DV/api/access/datafile/$FID"; then
    rm -f "$OUT.part"; echo "  FAILED"; exit 1
  fi
  if ! unzip -tqq "$OUT.part" >/dev/null 2>&1; then
    echo "  BAD: not a valid zip. First bytes:"; head -c 200 "$OUT.part"; echo
    rm -f "$OUT.part"; exit 1
  fi
  mv "$OUT.part" "$OUT"
  echo "  ok      raw-data.zip ($(du -h "$OUT" | cut -f1))"
fi

# The reference Python implementation of the classification, and its test data.
# Optional but cheap, and it is the thing our cascade gets checked against.
REPL="$DEST/anthromes12k_replication_IB4VCI.zip"
if [ -f "$REPL" ] && unzip -tqq "$REPL" >/dev/null 2>&1; then
  echo "  have    anthromes12k_replication_IB4VCI.zip"
else
  echo
  echo "the reference Python classifier (doi:10.7910/DVN/IB4VCI, ~40MB)"
  echo "-----------------------------------------"
  if curl -fsSL --retry 3 -o "$REPL.part" "$DV/api/access/datafile/3754831" \
     && unzip -tqq "$REPL.part" >/dev/null 2>&1; then
    mv "$REPL.part" "$REPL"; echo "  ok      $(basename "$REPL") ($(du -h "$REPL" | cut -f1))"
  else
    rm -f "$REPL.part"; echo "  MISS    optional, carry on without it"
  fi
fi

echo
echo "what is actually inside"
echo "-----------------------------------------"
echo "The internal layout below is expected from the anthromes R package's"
echo "/vsizip/ paths, NOT from having opened this file. Send this output back"
echo "before the pipeline is written - it settles whether the grids are"
echo "multi-band GeoTIFFs or per-year files, which changes the reader."
echo
echo "expected:"
echo "  raw-data/HYDE.zip/HYDE/<var>.tif.zip/<var>.tif   for cropland grazing"
echo "                                                    ir_rice popc tot_irri uopp"
echo "  raw-data/supporting_5m_grids.zip/supporting_5m_grids/"
echo "                        maxln_cr.tif potveg15.tif potvill20.tif"
echo "                        simple_regions.tif iso_cr.tif"
echo
echo "actual, top two levels:"
unzip -l "$OUT" | awk 'NF>=4 && $4!="Name"{print $1"\t"$4}' | head -40
echo
echo "nested archives:"
for n in $(unzip -Z1 "$OUT" | grep -E '\.zip$'); do
  printf '  %s\n' "$n"
done

echo
echo "next: report the two listings above, then the pipeline gets written"
echo "against what is really there."
