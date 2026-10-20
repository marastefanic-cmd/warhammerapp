# Verification sources

Everything the app states as a fact is checked against these, mechanically, before a build.

## Committed here (the owner's packet)
| file | from | sha256 of the original PDF |
|---|---|---|
| nr/shooty.txt | Me shooty yer booty - New Recruit.pdf | 4c0e5befd172eeb489137b8e7efa4e4d3f5041a0111eacec7e7a5e0ed10e4781 |
| nr/melee.txt | Melee - New Recruit.pdf (exported 20 Oct 2026) | 689e9cdeb600f2dfa65c3d7bc2384868023ff433a76bc80fddb09bec2b322e2b |
| packet/core-stratagems.txt | Core_stratagemy.pdf | d62979edcfd0323c1d3382a6d238f0f87b312fb07f103125ecbccdb6bd96e5a8 |

Text made with `pdftotext -layout <pdf> <txt>` (poppler).

## Downloaded into verify/.cache (not committed), see verify/fetch.sh
- BSData wh40k-11e at a pinned commit (the data New Recruit is built from)
- Games Workshop's official PDFs: Core Rules, Universal Rules Updates, Faction Packs
- Wahapedia faction pages (their sha256 is recorded; a change means a rules update to review)

## Are these still the newest? verify/currency.js (run by hand)
It compares today's sources with what the last verification used and writes verify/out/currency.md;
it never changes the app.
- gw-downloads.json: GW's Warhammer 40,000 downloads list (English) at the last verification
- waha-baseline/: the text of the Wahapedia faction and core rules pages at the last verification
  (made by waha-extract.py), so new errata and FAQ boxes show as a diff
- BSData: the commit pinned in fetch.sh

After the app is updated to new sources and `node verify/run.js` passes, `node verify/currency.js
--accept` makes today's sources the baseline.

## waha-datasheets.txt
The Wahapedia datasheet pages fetch.sh downloads (`<faction> <Page-Name>`): verify/choice.js reads
their pick-one markers and verify/import-nr.js their wording. The importer adds the units of a new
list to it.
