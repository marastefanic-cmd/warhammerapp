#!/bin/sh
# Download the verification sources into verify/.cache (not committed).
# Usage: sh verify/fetch.sh     (needs github.com, assets.warhammer-community.com, wahapedia.ru)
set -e
cd "$(dirname "$0")"; mkdir -p .cache/gw .cache/waha
# the Wahapedia text extraction (waha-extract.py) needs BeautifulSoup
python3 -I -c 'import bs4' 2>/dev/null || python3 -m pip install -q beautifulsoup4 2>/dev/null || python3 -m pip install -q --break-system-packages beautifulsoup4
# BSData: the data New Recruit is built from, pinned
BSDATA_COMMIT=173d0ef
[ -d .cache/bsdata ] || git clone -q https://github.com/BSData/wh40k-11e .cache/bsdata
git -C .cache/bsdata checkout -q $BSDATA_COMMIT
# the factions of the lists (sources/factions.json): "<faction> <wahapedia page> <faction pack file or ->"
FACTIONS=$(node -e 'const f = require("./sources/factions.json"); for(const [k, v] of Object.entries(f)) if(k[0] !== "_") console.log(k, v.waha, v.pack ? v.pack.file : "-")')
# Games Workshop's official documents: core rules, updates, event companion, and each faction's Faction Pack
PACKS=$(echo "$FACTIONS" | awk '$3 != "-" { print $3 }')
for f in eng_01-06_warhammer40k_new40k_core_rules-was6fbu1ix-hfewhmxyiy.pdf \
         eng_wh40k_core%26key_universal_rules_updates-lu3grocned-rphh78bl6k.pdf \
         eng_14-10_wh40k_event_companion-rdwnqprl4c-nj8oqogadv.pdf $PACKS; do
  out=$(echo "$f" | sed 's/%26/and/')   # GW's file name has an "&"; the cache keeps the old name
  [ -f .cache/gw/$out ] || curl -sSf -A "Mozilla/5.0" "https://assets.warhammer-community.com/$f" -o .cache/gw/$out
  [ -s .cache/gw/${out%.pdf}.txt ] || pdftotext -layout .cache/gw/$out .cache/gw/${out%.pdf}.txt
done
# Wahapedia (changes over time: verify/run.js records the sha256 it checked against)
echo "$FACTIONS" | while read -r fac page pack; do
  [ -f .cache/waha/$fac.html ] || curl -sSf -A "Mozilla/5.0" "https://wahapedia.ru/wh40k11ed/factions/$page/" -o .cache/waha/$fac.html
done
[ -f .cache/waha/core.html ] || curl -sSf -A "Mozilla/5.0" "https://wahapedia.ru/wh40k11ed/the-rules/core-rules/" -o .cache/waha/core.html
# Wahapedia datasheet pages of the units in the lists (verify/choice.js reads their pick-one markers)
mkdir -p .cache/waha/ds
while read -r fac unit; do
  # a page that cannot be fetched (a misspelt name: Wahapedia's addresses are case-sensitive) is reported, not fatal
  [ -f ".cache/waha/ds/${fac}_${unit}.html" ] || curl -sSf -A "Mozilla/5.0" "https://wahapedia.ru/wh40k11ed/factions/$fac/$unit" -o ".cache/waha/ds/${fac}_${unit}.html" || echo "could not fetch the Wahapedia datasheet $fac/$unit: check its name in sources/waha-datasheets.txt" >&2
done < sources/waha-datasheets.txt
# Wahapedia text extraction the rules-text check reads
for p in $(echo "$FACTIONS" | awk '{ print $1 }') core; do
  [ -s .cache/waha/$p.txt ] || python3 -I waha-extract.py .cache/waha/$p.html .cache/waha/$p.txt
done
echo "sources in $(pwd)/.cache"
