#!/usr/bin/env bash
# Fetch the sources identified on 2026-09-01 that were not already in data/original/.
#
# Written by a session with no network access, from URLs verified by reading the
# pages through a browser on the same day. Every URL here was seen to resolve;
# none of these files were downloaded, so the first run is also the first check.
#
# Run from the repo root:   bash data/scripts/fetch-sources.sh
# Nothing here overwrites an existing file. Delete a file to refetch it.
#
# See utilities/2026-09-01 Sources — The Unfetched Datasets.md for what each one
# is for and what is known about it.

set -u
cd "$(dirname "$0")/../.." || exit 1
DEST="data/original"
mkdir -p "$DEST"
STAMP="$(date +%Y%m%d)"

ok()   { printf '  ok      %s\n' "$1"; }
skip() { printf '  skip    %s (already here)\n' "$1"; }
fail() { printf '  FAILED  %s\n' "$1"; }

get() {  # get <url> <destination filename> [expected type: json|any]
  local url="$1" out="$DEST/$2" want="${3:-any}"
  if [ -f "$out" ]; then skip "$2"; return 0; fi
  if ! curl -fsSL --retry 2 -o "$out.part" "$url"; then
    rm -f "$out.part"; fail "$2  <- $url"; return 1
  fi
  # CURL'S EXIT CODE IS NOT ENOUGH. The Census API answers a keyless request
  # with 200 and an HTML page titled "Missing Key", which lands on disk looking
  # exactly like a successful download and is only found much later, by a
  # pipeline that reads it. Both B08302 files were fetched that way on
  # 2026-09-01 and both were 8,531 bytes of HTML. So: check what came back.
  if [ "$want" = "json" ] && ! python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$out.part" 2>/dev/null; then
    printf '  FAILED  %s  <- 200 OK but the body is not JSON. First line:\n' "$2"
    head -c 200 "$out.part" | sed 's/^/            /'
    printf '\n'
    rm -f "$out.part"; return 1
  fi
  mv "$out.part" "$out"; ok "$2  ($(du -h "$out" | cut -f1))"
}

# The Census API needs a key for anything but a handful of calls a day, and the
# repo already has one - pencil.py reads the same variable out of .env.
if [ -z "${CENSUS_API_KEY:-}" ] && [ -f .env ]; then
  CENSUS_API_KEY=$(sed -n 's/^CENSUS_API_KEY=//p' .env | head -1 | tr -d "\"' ")
fi

echo
echo "1. LEHD LODES, jobs by census block  (After Five)"
# Verified 2026-09-01 from the directory listing: 2.6M, posted 2025-12-03.
# LODES8 is on 2020 census blocks, which matches the 2020 tracts already on disk.
# S000 = all jobs, JT00 = all job types. Years 2002-2023 are available at the
# same size if a time series is ever wanted.
get "https://lehd.ces.census.gov/data/lodes/LODES8/ny/wac/ny_wac_S000_JT00_2023.csv.gz" \
    "ny_wac_S000_JT00_2023.csv.gz"

echo
echo "2. ACS B08302, time of departure to go to work  (After Five)"
# Verified 2026-09-01 from the API's group metadata. Half-hour bands from 5am.
# Universe is workers 16+ who did not work from home, so this is the morning
# only - it says nothing about when anyone leaves. Manhattan is county 061.
#
# THIS NEEDS A KEY. An earlier version of this script said it did not, and both
# files came back as an HTML page titled "Missing Key" with a 200 status. They
# are requested as JSON now so the sniff in get() catches it if it happens again.
if [ -z "${CENSUS_API_KEY:-}" ]; then
  fail "acs_b08302_*.json  <- no CENSUS_API_KEY in the environment or in .env"
else
  ACS="https://api.census.gov/data/2023/acs/acs5?get=group(B08302)&for=tract:*&in=state:36"
  get "${ACS}%20county:061&key=${CENSUS_API_KEY}" "acs_b08302_manhattan_tracts_2023.json" json
  get "${ACS}%20county:081&key=${CENSUS_API_KEY}" "acs_b08302_queens_tracts_2023.json" json
fi

echo
echo "3. NYC Stormwater Flood Maps  (Pencil, context only)"
# NYC Open Data 9i7c-xyvv, DEP, updated 2024-10-17. One zip, four citywide
# layers. This is a Socrata "file" dataset, so the download URL carries a file
# id that has to be read out of the metadata first.
if [ -f "$DEST/NYCFloodStormwaterFloodMaps.zip" ]; then
  skip "NYCFloodStormwaterFloodMaps.zip"
else
  BLOB=$(curl -fsSL "https://data.cityofnewyork.us/api/views/9i7c-xyvv.json" \
         | python3 -c 'import sys,json; m=json.load(sys.stdin); print(m.get("blobId") or (m.get("metadata",{}).get("attachments") or [{}])[0].get("assetId",""))' 2>/dev/null)
  if [ -n "${BLOB:-}" ]; then
    get "https://data.cityofnewyork.us/api/views/9i7c-xyvv/files/${BLOB}?download=true&filename=NYCFloodStormwaterFloodMaps.zip" \
        "NYCFloodStormwaterFloodMaps.zip"
  else
    fail "NYCFloodStormwaterFloodMaps.zip  <- could not read the file id from the metadata"
    echo "          get it by hand: https://data.cityofnewyork.us/Environment/NYC-Stormwater-Flood-Maps/9i7c-xyvv/about_data"
  fi
fi

echo
echo "4. DEP Interim Flood Risk Area Map  (Pencil, the actual rule)"
echo "   NOT SCRIPTED. This is the layer ZR 12-10 points at through 15 RCNY 66-01,"
echo "   and it is what bars a backyard ADU. As of 2026-09-01 the rule that adopts"
echo "   it was proposed (June 2025) but adoption was not confirmed, and no"
echo "   download format is known. Look for a downloadable layer here first:"
echo "       https://nyc.gov/dep/floodriskmap"
echo "   If there is no download, say so in the card and fall back to the two NPCC"
echo "   layers already on disk, named as the approximation they are."

echo
echo "Done. Files land in $DEST/ and are gitignored. Stamp for new names: $STAMP"
echo
