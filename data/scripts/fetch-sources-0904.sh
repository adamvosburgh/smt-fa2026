#!/usr/bin/env bash
# Fetch the sources identified on 2026-09-04 for the agent layer and Anthromes.
#
# Every URL here was confirmed on 2026-09-04 by reading the publisher's page or
# its Socrata metadata; none of these files was downloaded at the time, so the
# first run of this script is also the first real test of it.
#
# Run from the repo root:   bash data/scripts/fetch-sources-0904.sh
# Nothing overwrites an existing file. Delete a file to refetch it.
#
# NOT HERE, ON PURPOSE:
#   Anthromes inputs - see data/scripts/fetch-anthromes-inputs.sh.
#
# Socrata throttles unauthenticated requests hard. Get an app token at
# https://data.ny.gov/profile/edit/developer_settings and export it:
#   export SOCRATA_APP_TOKEN=xxxxxxxx
# Without one the two aggregate queries below will probably time out.

set -u
cd "$(dirname "$0")/../.." || exit 1
DEST="data/original"
mkdir -p "$DEST"

TOKEN_Q=""
if [ -n "${SOCRATA_APP_TOKEN:-}" ]; then
  TOKEN_Q="&\$\$app_token=${SOCRATA_APP_TOKEN}"
else
  printf '  STOP    no SOCRATA_APP_TOKEN set.\n'
  printf '          Unauthenticated Socrata throttles hard and the 82 queries below\n'
  printf '          will be slow and may 408. Get one in two minutes at\n'
  printf '          https://data.ny.gov/profile/edit/developer_settings then:\n'
  printf '            export SOCRATA_APP_TOKEN=xxxxxxxx\n'
fi

ok()   { printf '  ok      %-46s %s\n' "$1" "$(du -h "$DEST/$1" 2>/dev/null | cut -f1)"; }
skip() { printf '  skip    %-46s (already here and valid)\n' "$1"; }
fail() { printf '  FAILED  %s\n' "$1"; }

# A Socrata error is HTTP 200 with a JSON body. A BLS block is an HTML page.
# Both sail past a size check, and on 2026-09-04 all three origin-destination
# files landed as {"code":"permission_denied"} and were skipped as "already
# here" on the next run. Validate CONTENT, and treat an invalid file as absent.
valid() {  # valid <path> <kind: csv|geojson|zip> [required header fragment]
  local f="$1" kind="$2" want="${3:-}"
  [ -s "$f" ] || return 1
  case "$kind" in
    csv)
      head -c 1 "$f" | grep -qE '[{<]' && return 1          # JSON or HTML body
      grep -qi '"error"' "$f" && return 1
      [ -n "$want" ] && ! head -1 "$f" | grep -q "$want" && return 1
      [ "$(wc -l < "$f")" -ge 2 ] || return 1 ;;
    geojson)
      head -c 200 "$f" | grep -q '"FeatureCollection"' || return 1 ;;
    zip)
      unzip -tqq "$f" >/dev/null 2>&1 || return 1 ;;
  esac
  return 0
}

get() {  # get <url> <filename> <min-bytes> <kind> [header fragment]
  local url="$1" out="$DEST/$2" min="$3" kind="${4:-csv}" want="${5:-}"
  if valid "$out" "$kind" "$want"; then skip "$2"; return 0; fi
  [ -e "$out" ] && { mv -f "$out" "$out.bad" 2>/dev/null; printf '  note    %s was invalid, refetching (old copy -> %s.bad)\n' "$2" "$2"; }
  # BLS returns 403 to curl's default agent. Identify the requester, which is
  # what bls.gov asks for anyway.
  if ! curl -sSL --max-time 900 --retry 3 --retry-delay 5 --retry-all-errors \
       -A "smt-fa2026/1.0 (Columbia GSAPP course site; adamvosburgh@gmail.com)" \
       -o "$out.part" "$url"; then
    rm -f "$out.part"; fail "$2  <- $url"; return 1
  fi
  local n; n=$(wc -c < "$out.part")
  if [ "$n" -lt "$min" ] || ! valid "$out.part" "$kind" "$want"; then
    printf '  FAILED  %s  (%s bytes, failed the %s check)\n' "$2" "$n" "$kind"
    head -c 300 "$out.part" | sed 's/^/            /'; echo
    mv -f "$out.part" "$out.bad"; return 1
  fi
  mv "$out.part" "$out"; ok "$2"
}

echo
echo "After Five - the agent layer"
echo "----------------------------"

# 1. Subway entrances. 2,120 rows. Field names verified 2026-09-04:
#    division line borough stop_name complex_id constituent_station_name
#    station_id gtfs_stop_id daytime_routes entrance_type entry_allowed
#    exit_allowed entrance_latitude entrance_longitude entrance_georeference
#    NOTE borough here is a single letter (M); in the ridership datasets it is
#    the full word (Manhattan). This has caught people out.
get "https://data.ny.gov/resource/i9wp-a4ja.csv?\$limit=5000${TOKEN_Q}" \
    "mta_subway_entrances_2024.csv" 50000 csv "complex_id"

# 2. Origin-destination ridership by hour and day of week, 2024.
#    Field names verified 2026-09-04 against a live sample: year, month,
#    day_of_week, hour_of_day, origin_station_complex_id, origin_latitude,
#    origin_longitude, destination_station_complex_id, destination_latitude,
#    destination_longitude, estimated_average_ridership.
#
#    THE FIRST VERSION OF THIS TIMED OUT (HTTP 408) AND HERE IS WHY. Filtering
#    116,279,069 rows on a latitude/longitude RANGE makes Socrata scan the whole
#    table - float ranges are not selective for it. Filtering on
#    destination_station_complex_id = '<id>' is an equality on a low-cardinality
#    column and returns in a second or two.
#
#    So: read the district's complex ids out of the entrances file already
#    downloaded above, then ask one small question per complex per direction.
#    41 complexes x 2 directions = 82 queries returning at most 24 rows each,
#    instead of one query that scans everything. A timeout on one complex costs
#    that complex, not the run.
#
#    Also restricted to a single representative month. estimated_average_ridership
#    is already an average per (year, month, day_of_week, hour), so summing twelve
#    months would just be twelve averages added together - it does not make the
#    curve more robust, it only makes the query twelve times as expensive.
OD_MONTH="${OD_MONTH:-10}"
WEEKDAYS="day_of_week%20in(%27Monday%27,%27Tuesday%27,%27Wednesday%27,%27Thursday%27,%27Friday%27)"

# The two study districts, as bounding boxes over the entrance points. Change
# them here and everything downstream follows.
COMPLEXES=$(python3 - "$DEST/mta_subway_entrances_2024.csv" <<'PYIN'
import csv, sys
BOXES=[(40.700,40.7215,-74.020,-73.995),   # MN01 Lower Manhattan
       (40.7375,40.762,-74.010,-73.975)]   # MN05 Midtown South
ids=set()
for r in csv.DictReader(open(sys.argv[1])):
    try: la=float(r["entrance_latitude"]); lo=float(r["entrance_longitude"])
    except (ValueError, KeyError, TypeError): continue
    if any(s<=la<=n and w<=lo<=e for s,n,w,e in BOXES): ids.add(r["complex_id"])
print(" ".join(sorted(ids, key=int)))
PYIN
)
NCX=$(echo "$COMPLEXES" | wc -w | tr -d ' ')
echo "  district complexes, from the entrances file: $NCX"

od_pull() {  # od_pull <origin|destination> <outfile>
  local dir="$1" out="$DEST/$2" tmp="$DEST/.od.$$" n=0 fail=0
  if valid "$out" csv "hour_of_day"; then skip "$2"; return 0; fi
  [ -e "$out" ] && { mv -f "$out" "$out.bad" 2>/dev/null; printf '  note    %s was invalid, refetching\n' "$2"; }
  : > "$tmp"
  for cx in $COMPLEXES; do
    local url="https://data.ny.gov/resource/jsu2-fbtj.csv?\$select=${dir}_station_complex_id,${dir}_station_complex_name,${dir}_latitude,${dir}_longitude,hour_of_day,sum(estimated_average_ridership)%20as%20riders&\$where=${dir}_station_complex_id=%27${cx}%27%20and%20month=${OD_MONTH}%20and%20${WEEKDAYS}&\$group=${dir}_station_complex_id,${dir}_station_complex_name,${dir}_latitude,${dir}_longitude,hour_of_day&\$order=hour_of_day&\$limit=200${TOKEN_Q}"
    if body=$(curl -sS --max-time 180 --retry 3 --retry-delay 5 --retry-all-errors "$url" 2>/dev/null) \
       && [ -n "$body" ] && [ "$(printf '%s' "$body" | wc -l)" -gt 1 ] \
       && ! printf '%s' "$body" | head -c 1 | grep -qE '[{<]' \
       && printf '%s' "$body" | head -1 | grep -q hour_of_day; then
      if [ "$n" -eq 0 ]; then printf '%s\n' "$body" >> "$tmp"; else printf '%s\n' "$body" | tail -n +2 >> "$tmp"; fi
      n=$((n+1)); printf '.'
    else
      fail=$((fail+1)); printf 'x'
    fi
  done
  echo
  if [ "$n" -eq 0 ]; then rm -f "$tmp"; fail "$2 (every complex failed)"; return 1; fi
  mv "$tmp" "$out"
  printf '  ok      %-46s %s rows from %s complexes' "$2" "$(($(wc -l < "$out")-1))" "$n"
  [ "$fail" -gt 0 ] && printf '  (%s failed - rerun to fill them in)' "$fail"
  echo
}

echo "  arrivals (people whose destination is in the district)"
od_pull destination "mta_od_arrivals_study_districts_2024.csv"
echo "  departures (people whose origin is in the district)"
od_pull origin      "mta_od_departures_study_districts_2024.csv"

#    Where the evening crowd goes. Same per-complex shape, origins in the
#    district, grouped by destination, evening hours only. Labels the animation;
#    does not drive it. Skipped without complaint if it times out.
if ! valid "$DEST/mta_od_evening_destinations_2024.csv" csv "destination_station_complex_id"; then
  [ -e "$DEST/mta_od_evening_destinations_2024.csv" ] && mv -f "$DEST/mta_od_evening_destinations_2024.csv" "$DEST/mta_od_evening_destinations_2024.csv.bad"
  tmp="$DEST/.evening.$$"; : > "$tmp"; n=0
  for cx in $COMPLEXES; do
    url="https://data.ny.gov/resource/jsu2-fbtj.csv?\$select=destination_station_complex_id,destination_station_complex_name,destination_latitude,destination_longitude,sum(estimated_average_ridership)%20as%20riders&\$where=origin_station_complex_id=%27${cx}%27%20and%20month=${OD_MONTH}%20and%20${WEEKDAYS}%20and%20hour_of_day%20between%2016%20and%2021&\$group=destination_station_complex_id,destination_station_complex_name,destination_latitude,destination_longitude&\$order=riders%20desc&\$limit=1000${TOKEN_Q}"
    if body=$(curl -sS --max-time 180 --retry 2 --retry-delay 5 --retry-all-errors "$url" 2>/dev/null) \
       && [ "$(printf '%s' "$body" | wc -l)" -gt 1 ] \
       && ! printf '%s' "$body" | head -c 1 | grep -qE '[{<]' \
       && printf '%s' "$body" | head -1 | grep -q destination_station_complex_id; then
      if [ "$n" -eq 0 ]; then printf '%s\n' "$body" >> "$tmp"; else printf '%s\n' "$body" | tail -n +2 >> "$tmp"; fi
      n=$((n+1)); printf '.'
    else printf 'x'; fi
  done
  echo
  if [ "$n" -gt 0 ]; then mv "$tmp" "$DEST/mta_od_evening_destinations_2024.csv"
    ok "mta_od_evening_destinations_2024.csv"
  else rm -f "$tmp"; printf '  skip    evening destinations (optional, all timed out)\n'; fi
else
  skip "mta_od_evening_destinations_2024.csv"
fi

# 3. Hourly entries, 2025 onward. Cross-check only, not the primary source.
#    Reproduce the verification figure before building on it: Manhattan
#    complexes south of 40.716, October 2025, all days, hour 17 should come out
#    at 1,059,909 entries and hour 08 at 419,833.
get "https://data.ny.gov/resource/5wq4-mkjj.csv?\$select=date_extract_hh(transit_timestamp)%20as%20hour,sum(ridership)%20as%20entries,sum(transfers)%20as%20transfers&\$where=borough=%27Manhattan%27%20and%20latitude%3C40.716%20and%20transit_timestamp%3E=%272025-10-01T00:00:00%27%20and%20transit_timestamp%3C%272025-11-01T00:00:00%27&\$group=hour&\$order=hour${TOKEN_Q}" \
    "mta_hourly_entries_lowermanhattan_oct2025.csv" 200 csv "hour"

# 4. Street centrelines. 122,263 rows citywide; the pipeline clips.
#    Use this rather than DCP LION - LION is a file geodatabase inside a zip
#    and the pipeline has no geo stack.
get "https://data.cityofnewyork.us/resource/inkn-q76z.geojson?\$limit=200000" \
    "nyc_street_centerline_cscl.geojson" 10000000 geojson

# 5. ATUS 2003-2025. The Activity file carries TEWHERE (2 = respondent's
#    workplace), TUSTARTTIM and TUSTOPTIME. The Respondent file carries TELFS,
#    TUDIARYDAY, TEIO1OCD, TEIO1ICD, TRDPFTPT and the multi-year weight
#    TUFNWGTP. The 101 MB ATUS-CPS file is NOT needed.
get "https://www.bls.gov/tus/datafiles/atusact-0325.zip"  "atusact-0325.zip"  50000000 zip
get "https://www.bls.gov/tus/datafiles/atusresp-0325.zip" "atusresp-0325.zip" 10000000 zip

echo
echo "Anthromes"
echo "---------"
echo "  Moved. The inputs are HYDE 3.2 from Harvard Dataverse, not HYDE 3.5:"
echo "      bash data/scripts/fetch-anthromes-inputs.sh"
echo "  HYDE 3.5's own distribution is missing the 2000-2023 input grids."

echo
echo "Not fetched here"
echo "----------------"
if [ -f "$DEST/hyde35/HYDE-3.5.zip" ]; then
  printf '  ok      hyde35/HYDE-3.5.zip in place: %s (comparison layer)\n' "$(du -h "$DEST/hyde35/HYDE-3.5.zip" | cut -f1)"
else
  printf '  note    data/original/hyde35/HYDE-3.5.zip absent - only the Anthromes\n'
  printf '          comparison layer needs it; the inputs come from 3.2.\n'
fi
if [ -f "$DEST/anthromes-inputs/raw-data.zip" ]; then
  printf '  ok      anthromes-inputs/raw-data.zip in place\n'
else
  printf '  MISSING anthromes-inputs/raw-data.zip - run fetch-anthromes-inputs.sh\n'
fi
echo
echo "Done. Anything marked FAILED needs a look before the pipelines run."
