#!/usr/bin/env bash
# Fetch the two boundary layers the 09-08 sandbox reframe needs.
#
# Both are used the same way: the whole city is drawn, and everything outside
# the study area is covered by a white mask at 75% opacity, so the study area
# reads at full strength and its surroundings at a quarter. That is a
# representation decision, so the geometry is shipped in the sandbox's data and
# not baked into the basemap style.
#
# THE DATASET IDS IN THE BUILD DOC DO NOT EXIST.
# "2026-09-08 Build Doc — Sandbox Reframe.md" §8 names `tqmj-j8zm` for the
# borough boundaries and `yfnk-k7r4` for the community districts. Both return
# `{"code":"dataset.missing"}` from data.cityofnewyork.us, on the resource
# endpoint and on the geospatial export endpoint alike - checked 2026-09-08.
# The ids below were found in the Socrata catalog by NAME and each was verified
# by reading what came back:
#
#   gthc-hcne  Borough Boundaries   5 features, borocode 1-5, boroname
#                                   ("Queens" is borocode 4)
#   5crt-au7u  Community Districts  71 features, boro_cd as a string
#                                   ("101" and "105" are both present)
#
# Per utilities/memory/fetch_traps.md: Socrata answers `permission_denied` with
# HTTP 200, so this script checks that a JSON body with features came back
# rather than checking the size or the status code.
#
# Run from the repo root:   bash data/scripts/fetch-sources-0908.sh
# Nothing overwrites an existing file. Delete a file to refetch it.
#
# Socrata throttles unauthenticated requests. Export a token first:
#   export SOCRATA_APP_TOKEN=xxxxxxxx

set -u
cd "$(dirname "$0")/../.." || exit 1
DEST="data/original"
mkdir -p "$DEST"

TOKEN_HEADER=()
if [ -n "${SOCRATA_APP_TOKEN:-}" ]; then
  TOKEN_HEADER=(-H "X-App-Token: ${SOCRATA_APP_TOKEN}")
fi

fetch_geojson() {
  local url="$1" out="$2" expect="$3"
  if [ -f "$out" ]; then
    echo "have    $out"
    return 0
  fi
  echo "fetch   $out"
  curl -sS --max-time 300 "${TOKEN_HEADER[@]}" -o "$out.part" "$url" || {
    echo "FAILED  $out (curl)"; rm -f "$out.part"; return 1;
  }
  # Content, not size: a permission_denied comes back as a 200 with a small
  # JSON body, and so does an empty query result.
  local n
  n=$(python3 - "$out.part" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception as e:
    print(-1); sys.exit(0)
print(len(d.get('features', [])) if isinstance(d, dict) else -1)
PY
)
  if [ "$n" -lt "$expect" ]; then
    echo "FAILED  $out - expected at least $expect features, got $n"
    head -c 300 "$out.part"; echo
    rm -f "$out.part"
    return 1
  fi
  mv "$out.part" "$out"
  echo "ok      $out ($n features)"
}

# NYC Borough Boundaries. Queens is borocode 4; the pencil sandbox cuts it out
# of a white mask over the rest of the metro.
fetch_geojson \
  "https://data.cityofnewyork.us/resource/gthc-hcne.geojson?\$limit=10" \
  "$DEST/borough_boundaries.geojson" 5

# NYC Community Districts. Manhattan CD1 and CD5 are boro_cd "101" and "105";
# the conversion sandbox cuts one or both out of the same kind of mask.
fetch_geojson \
  "https://data.cityofnewyork.us/resource/5crt-au7u.geojson?\$limit=200" \
  "$DEST/community_districts.geojson" 71

echo "done"
