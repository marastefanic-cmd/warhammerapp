# Verification sources

Everything the app states as a fact is checked against these, mechanically, before a build.

## Committed here (the owner's packet)
| file | from | sha256 of the original PDF |
|---|---|---|
| nr/cooking.txt | Cooking - New Recruit.pdf | 8cc198350c7eff3a5bb5b032b6f83b6c6a1da721fc0e72dbc5aad9db5c60ff90 |
| nr/purge-freeblade.txt | Freeblade_Knights.pdf | d26ff4c8ba8a90fe2a81a7cde40c8a725deb90fdcd9e55d9e1d20b5da0bbb6dc |
| nr/hurrdurr.txt | Hurrdurr - New Recruit.pdf | 2084accb422309e31300ec8a59df97fb4add44b15570c1641b754dcf2adb0ca9 |
| nr/oioioi.txt | oioioi - New Recruit.pdf | 3e1c5064d56657fccd3f66799912a91b31439fdc910f2ed421305248a668ba84 |
| nr/nidzillas.txt | Nidzillas - New Recruit.pdf | 513ddc007dd3ed6b0a9b87ceed676f617c0c3fd2a9569de64f009260e4b72613 |
| nr/shooty.txt | Me shooty yer booty - New Recruit.pdf | 4c0e5befd172eeb489137b8e7efa4e4d3f5041a0111eacec7e7a5e0ed10e4781 |
| packet/core-stratagems.txt | Core_stratagemy.pdf | d62979edcfd0323c1d3382a6d238f0f87b312fb07f103125ecbccdb6bd96e5a8 |

Text made with `pdftotext -layout <pdf> <txt>` (poppler).

## Downloaded into verify/.cache (not committed), see verify/fetch.sh
- BSData wh40k-11e at a pinned commit (the data New Recruit is built from)
- Games Workshop's official PDFs: Core Rules, Universal Rules Updates, Faction Packs
- Wahapedia faction pages (their sha256 is recorded; a change means a rules update to review)

## The weekly check: verify/currency.js
Are these still the newest sources? It compares today's with what the last verification used and
writes verify/out/currency.md. A scheduled session runs it every week and reports what changed for
these armies; it never changes the app.
- gw-downloads.json: GW's Warhammer 40,000 downloads list (English) at the last verification
- waha-baseline/: the text of the Wahapedia faction and core rules pages at the last verification
  (made by waha-extract.py), so new errata and FAQ boxes show as a diff
- BSData: the commit pinned in fetch.sh

After the app is updated to new sources and `node verify/run.js` passes, `node verify/currency.js
--accept` makes today's sources the baseline.
