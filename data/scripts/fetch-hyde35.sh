#!/usr/bin/env bash
# SUPERSEDED 2026-09-04. DO NOT RUN. Kept only as the record of what was tried.
#
# This fetched HYDE 3.5's input grids. It is moot for two reasons:
#   1. The Utrecht vault is behind a bot wall that refused both this script and
#      a browser, so it never ran successfully.
#   2. It would not have helped. HYDE 3.5's own distribution is missing the
#      2000-2023 input grids - baseline/3zip/1970ce-2023ce.zip contains 60
#      members covering 1970AD-1999AD only, verified by reading its local file
#      headers on 2026-09-04. Three independent transfers reproduced it.
#
# The inputs now come from HYDE 3.2 instead:
#   bash data/scripts/fetch-anthromes-inputs.sh
#
# Adam's HYDE 3.5 archive stays at data/original/hyde35/HYDE-3.5.zip. Its
# CLASSIFIED series is complete (128 steps to 2025AD) and is a comparison layer.
#
# Fetch HYDE 3.5 baseline inputs for the Anthromes sandbox, into a clean tree.
#
# WHY THIS EXISTS: the Google Drive restore of 2026-09-04 came back garbled -
# duplicated folders ("HYDE-3.5 2", "HYDE-3.5 3"), scenario-mixed loose
# directories, and the modern period truncated at 1999AD. Rather than untangle
# it, this re-fetches the baseline scenario from the source into one canonical
# layout. Nothing here touches the old folders; delete them yourself once this
# has run and verified.
#
#   bash data/scripts/fetch-hyde35.sh
#
# Resumable. Re-running skips any file already present and verified, so a
# failed or interrupted run is fixed by running it again.
#
# WHAT IS VERIFIED AND WHAT IS NOT.
#   Verified, because files fetched with these exact paths are already on disk:
#     $BASELINE_URL/3zip/10kbce_1000ce.zip
#     $BASELINE_URL/anthromes/<YEAR>_anthromes.zip
#   NOT verified - probed at runtime, with a fallback:
#     $BASELINE_URL/zip/<YEAR>_lu.zip  and  <YEAR>_pop.zip
#   If the per-year path answers 200 the script takes it and downloads only the
#   76 display years (roughly 5 GB). If it 404s the script falls back to the
#   three period archives (8.3 GB) and unpacks the per-year members out of them.
#   Either way you end up with the same tree.
#
# The vault sits behind a bot wall (Anubis). If curl starts returning HTML
# instead of zips, the size check below will catch it - open the URL in a
# browser once to clear the challenge, then re-run.

echo "SUPERSEDED - see the header. Run fetch-anthromes-inputs.sh instead." >&2
exit 1

set -u
cd "$(dirname "$0")/../.." || exit 1

BASE_URL="https://geo.public.data.uu.nl/vault-hyde/hyde35_c9_apr2025%5B1749214444%5D/original"
BASELINE_URL="$BASE_URL/gbc2025_7apr_base"

DEST="data/original/hyde35"
LU="$DEST/baseline/lu"
POP="$DEST/baseline/pop"
ANT="$DEST/baseline/anthromes"
ARC="$DEST/baseline/3zip"
mkdir -p "$LU" "$POP" "$ANT" "$ARC"

# The 76 display years. Same list the twosides grid profiles were built on, so
# the 33km land mask and cell indices line up with work already done.
YEARS=()
for y in 10000 9000 8000 7000 6000 5000 4000 3000 2000 1000; do YEARS+=("${y}BC"); done
YEARS+=("0AD")
for y in 100 200 300 400 500 600 700 800 900 1000 1100 1200 1300 1400 1500 1600 1700; do YEARS+=("${y}AD"); done
for y in 1710 1720 1730 1740 1750 1760 1770 1780 1790; do YEARS+=("${y}AD"); done
for y in 1800 1810 1820 1830 1840 1850 1860 1870 1880 1890; do YEARS+=("${y}AD"); done
for y in 1900 1910 1920 1930 1940; do YEARS+=("${y}AD"); done
for y in 1950 1955 1960 1965 1970 1975 1980 1985 1990 1995 2000; do YEARS+=("${y}AD"); done
for y in 2005 2010 2015 2016 2017 2018 2019 2020 2021 2022 2023 2024 2025; do YEARS+=("${y}AD"); done
echo "display years: ${#YEARS[@]}"

MISSING=()

fetch() {  # fetch <url> <path> <min-bytes>
  local url="$1" out="$2" min="$3" code
  if [ -f "$out" ] && unzip -tqq "$out" >/dev/null 2>&1; then
    printf '  have    %s\n' "$(basename "$out")"; return 0
  fi
  rm -f "$out"
  code=$(curl -sSL -C - --retry 3 --retry-delay 2 -w '%{http_code}' -o "$out.part" "$url" 2>/dev/null)
  if [ "$code" != "200" ] && [ "$code" != "206" ]; then
    rm -f "$out.part"; printf '  MISS    %s  (HTTP %s)\n' "$(basename "$out")" "$code"; return 1
  fi
  local n; n=$(wc -c < "$out.part" 2>/dev/null || echo 0)
  if [ "$n" -lt "$min" ] || ! unzip -tqq "$out.part" >/dev/null 2>&1; then
    printf '  BAD     %s  (%s bytes, not a valid zip - probably the bot wall)\n' "$(basename "$out")" "$n"
    head -c 200 "$out.part"; echo; rm -f "$out.part"; return 1
  fi
  mv "$out.part" "$out"
  printf '  ok      %-28s %s\n' "$(basename "$out")" "$(du -h "$out" | cut -f1)"
}

echo
echo "probing the per-year path"
echo "-------------------------"
PROBE=$(curl -sIL -o /dev/null -w '%{http_code}' "$BASELINE_URL/zip/1000AD_lu.zip")
echo "  GET $BASELINE_URL/zip/1000AD_lu.zip -> HTTP $PROBE"

if [ "$PROBE" = "200" ]; then
  echo "  per-year path works. Fetching only the 76 display years (~5 GB)."
  MODE=peryear
else
  echo "  per-year path unavailable. Falling back to the three period archives (8.3 GB)."
  MODE=archives
fi

echo
if [ "$MODE" = "peryear" ]; then
  echo "land use and population, per year"
  echo "---------------------------------"
  for y in "${YEARS[@]}"; do
    fetch "$BASELINE_URL/zip/${y}_lu.zip"  "$LU/${y}_lu.zip"  1000000 || MISSING+=("${y}_lu")
    fetch "$BASELINE_URL/zip/${y}_pop.zip" "$POP/${y}_pop.zip" 500000  || MISSING+=("${y}_pop")
  done
else
  echo "period archives"
  echo "---------------"
  fetch "$BASELINE_URL/3zip/10kbce_1000ce.zip"  "$ARC/10kbce_1000ce.zip"  1000000000 || MISSING+=("10kbce_1000ce")
  fetch "$BASELINE_URL/3zip/1100ce-1969ce.zip"  "$ARC/1100ce-1969ce.zip"  4000000000 || MISSING+=("1100ce-1969ce")
  fetch "$BASELINE_URL/3zip/1970ce-2023ce.zip"  "$ARC/1970ce-2023ce.zip"  2000000000 || MISSING+=("1970ce-2023ce")

  echo
  echo "unpacking the per-year members (the .asc stay inside their zips)"
  echo "---------------------------------------------------------------"
  for a in "$ARC"/*.zip; do
    [ -f "$a" ] || continue
    echo "  from $(basename "$a")"
    unzip -o -q -j "$a" '*_lu.zip'  -d "$LU"  2>/dev/null
    unzip -o -q -j "$a" '*_pop.zip' -d "$POP" 2>/dev/null
  done
fi

echo
echo "the published classification, for the comparison layer"
echo "-----------------------------------------------------"
for y in "${YEARS[@]}"; do
  fetch "$BASELINE_URL/anthromes/${y}_anthromes.zip" "$ANT/${y}_anthromes.zip" 100000 || MISSING+=("${y}_anthromes")
done

echo
echo "result"
echo "------"
printf '  %s   lu\n'        "$(ls "$LU"  2>/dev/null | wc -l | tr -d ' ')"
printf '  %s   pop\n'       "$(ls "$POP" 2>/dev/null | wc -l | tr -d ' ')"
printf '  %s   anthromes\n' "$(ls "$ANT" 2>/dev/null | wc -l | tr -d ' ')"
printf '  %s total\n'       "$(du -sh "$DEST/baseline" | cut -f1)"
if [ ${#MISSING[@]} -gt 0 ]; then
  echo
  echo "  ${#MISSING[@]} not retrieved:"
  printf '    %s\n' "${MISSING[@]}"
  echo "  HYDE 3.5's inputs may simply stop before 2024 - the classified"
  echo "  anthromes series runs to 2025AD but the input grids may not."
  echo "  Re-run to retry; anything still missing is a real gap and belongs"
  echo "  in the Anthromes card as one."
fi
echo
echo "The old restore is untouched. Once this looks right, remove:"
echo "  data/original/hyde35/1100ce-1969ce-00{3,4}"
echo "  data/original/hyde35/1970ce-2023ce-00{2,5}"
echo "  'data/original/hyde35/HYDE-3.5' 'data/original/hyde35/HYDE-3.5 2' 'data/original/hyde35/HYDE-3.5 3'"
