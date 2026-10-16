#!/bin/sh
# Download the verification sources into verify/.cache (not committed).
# Usage: sh verify/fetch.sh     (needs github.com, assets.warhammer-community.com, wahapedia.ru)
set -e
cd "$(dirname "$0")"; mkdir -p .cache/gw .cache/waha
# BSData: the data New Recruit is built from, pinned
BSDATA_COMMIT=9b8207c
[ -d .cache/bsdata ] || git clone -q https://github.com/BSData/wh40k-11e .cache/bsdata
git -C .cache/bsdata checkout -q $BSDATA_COMMIT
# Games Workshop's official documents
for f in eng_01-06_warhammer40k_new40k_core_rules-was6fbu1ix-hfewhmxyiy.pdf \
         eng_wh40k_core%26key_universal_rules_updates-lu3grocned-rphh78bl6k.pdf \
         eng_14-10_wh40k_event_companion-rdwnqprl4c-nj8oqogadv.pdf \
         eng_wh40k_faction_pack_imperial_knights-n1irjnjygs-w8jfnk8kdn.pdf \
         eng_30-09_wh40k_faction_pack_world_eaters-rxxj1fzeoh-kfx1cectxb.pdf \
         eng_30-09_wh40k_faction_pack_thousand_sons-4lioijwxdj-otjrinzt8c.pdf \
         eng_14-10_wh40k_faction_pack_tyranids-an12izciwp-np2hnkcsje.pdf; do
  out=$(echo "$f" | sed 's/%26/and/')   # GW's file name has an "&"; the cache keeps the old name
  [ -f .cache/gw/$out ] || curl -sSf -A "Mozilla/5.0" "https://assets.warhammer-community.com/$f" -o .cache/gw/$out
  [ -f .cache/gw/${out%.pdf}.txt ] || pdftotext -layout .cache/gw/$out .cache/gw/${out%.pdf}.txt
done
# Wahapedia (changes over time: verify/run.js records the sha256 it checked against)
for p in orks imperial-knights world-eaters thousand-sons tyranids; do
  [ -f .cache/waha/$p.html ] || curl -sSf -A "Mozilla/5.0" "https://wahapedia.ru/wh40k11ed/factions/$p/" -o .cache/waha/$p.html
done
[ -f .cache/waha/core.html ] || curl -sSf -A "Mozilla/5.0" "https://wahapedia.ru/wh40k11ed/the-rules/core-rules/" -o .cache/waha/core.html
# Wahapedia text extraction the rules-text check reads
for p in orks imperial-knights world-eaters thousand-sons tyranids core; do
  [ -f .cache/waha/$p.txt ] || python3 -I waha-extract.py .cache/waha/$p.html > .cache/waha/$p.txt
done
echo "sources in $(pwd)/.cache"
