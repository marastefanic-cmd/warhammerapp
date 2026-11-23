#!/bin/sh
# Download the verification sources into verify/.cache (not committed).
# Usage: sh verify/fetch.sh     (needs assets.warhammer-community.com, wahapedia.ru)
# The sources are GW's documents (the source of truth) and Wahapedia (which transcribes them). BSData is not used (the owner's
# decision, 22 Nov 2026: BSData's repositories are gone); unit and weapon names follow New Recruit's exports (verify/sources/nr-json).
set -e
cd "$(dirname "$0")"; mkdir -p .cache/gw .cache/waha
# the Wahapedia text extraction (waha-extract.py) needs BeautifulSoup
python3 -I -c 'import bs4' 2>/dev/null || python3 -m pip install -q beautifulsoup4 2>/dev/null || python3 -m pip install -q --break-system-packages beautifulsoup4
# the factions of the lists (sources/factions.json): "<faction> <wahapedia page> <faction pack file or ->"
# (a fourth column: the Wahapedia faction of its datasheet pages, when it is not the faction page: the Ultramarines' are space-marines)
FACTIONS=$(node -e 'const f = require("./sources/factions.json"); for(const [k, v] of Object.entries(f)) if(k[0] !== "_") console.log(k, v.waha, v.pack ? v.pack.file : "-", v.wahaDs || v.waha)')
# Games Workshop's official documents: core rules, updates, each faction's Faction Pack, the Event Companion (GW's base size guide,
# verify/base-guide.js) and the previous Adeptus Custodes Faction Pack (quoted by verify/deviations-numbers.json and -keywords.json)
PACKS=$(echo "$FACTIONS" | awk '$3 != "-" { print $3 }')
for f in eng_01-06_warhammer40k_new40k_core_rules-was6fbu1ix-hfewhmxyiy.pdf \
         eng_wh40k_core%26key_universal_rules_updates-lu3grocned-rphh78bl6k.pdf \
         eng_14-10_wh40k_event_companion-rdwnqprl4c-nj8oqogadv.pdf \
         eng_30-09_wh40k_faction_pack_adeptus_custodes-xlscee8b1b-b1evo9u920.pdf $PACKS; do
  out=$(echo "$f" | sed 's/%26/and/')   # GW's file name has an "&"; the cache keeps the old name
  [ -f .cache/gw/$out ] || curl -sSf -A "Mozilla/5.0" "https://assets.warhammer-community.com/$f" -o .cache/gw/$out
  [ -s .cache/gw/${out%.pdf}.txt ] || pdftotext -layout .cache/gw/$out .cache/gw/${out%.pdf}.txt
done
# Wahapedia (changes over time: verify/run.js records the sha256 it checked against)
echo "$FACTIONS" | while read -r fac page pack dspage; do
  [ -f .cache/waha/$fac.html ] || curl -sSf --retry 4 --retry-all-errors --retry-delay 5 -A "Mozilla/5.0" "https://wahapedia.ru/wh40k11ed/factions/$page/" -o .cache/waha/$fac.html
done
# the allied factions' pages (sources/factions.json "allies": Imperial Agents of the Imperial Knights)
for page in $(node -e 'const f = require("./sources/factions.json"); const s = new Set(Object.keys(f)); for(const [k, v] of Object.entries(f)) if(k[0] !== "_") for(const a of Object.values(v.allies || {})) if(!s.has(a)) { s.add(a); console.log(a); }'); do
  [ -f .cache/waha/$page.html ] || curl -sSf --retry 4 --retry-all-errors --retry-delay 5 -A "Mozilla/5.0" "https://wahapedia.ru/wh40k11ed/factions/$page/" -o .cache/waha/$page.html
  [ -s .cache/waha/$page.txt ] || python3 -I waha-extract.py .cache/waha/$page.html .cache/waha/$page.txt
done
[ -f .cache/waha/core.html ] || curl -sSf --retry 4 --retry-all-errors --retry-delay 5 -A "Mozilla/5.0" "https://wahapedia.ru/wh40k11ed/the-rules/core-rules/" -o .cache/waha/core.html
# Wahapedia datasheet pages of the units in the lists (verify/choice.js reads their pick-one markers)
mkdir -p .cache/waha/ds
while read -r fac unit; do
  # the faction's Wahapedia page name (sources/factions.json: emperors-children is "emperor-s-children"), else the faction itself
  page=$(echo "$FACTIONS" | awk -v f="$fac" '$1 == f { print $4 }'); page=${page:-$fac}
  # a page that cannot be fetched (a misspelt name: Wahapedia's addresses are case-sensitive) is reported, not fatal
  [ -f ".cache/waha/ds/${fac}_${unit}.html" ] || curl -sSf --retry 4 --retry-all-errors --retry-delay 5 -A "Mozilla/5.0" "https://wahapedia.ru/wh40k11ed/factions/$page/$unit" -o ".cache/waha/ds/${fac}_${unit}.html" || echo "could not fetch the Wahapedia datasheet $page/$unit: check its name in sources/waha-datasheets.txt" >&2
done < sources/waha-datasheets.txt
# Wahapedia text extraction the rules-text check reads
for p in $(echo "$FACTIONS" | awk '{ print $1 }') core; do
  [ -s .cache/waha/$p.txt ] || python3 -I waha-extract.py .cache/waha/$p.html .cache/waha/$p.txt
done
echo "sources in $(pwd)/.cache"
