# Verification sources

Everything the app states as a fact is checked against these, mechanically, before a build.

## Committed here (the owner's packet)
| file | from | sha256 of the original PDF |
|---|---|---|
| nr/shooty.txt | Me shooty yer booty - New Recruit.pdf | 4c0e5befd172eeb489137b8e7efa4e4d3f5041a0111eacec7e7a5e0ed10e4781 |
| nr/melee.txt | Melee - New Recruit.pdf (exported 20 Oct 2026) | 689e9cdeb600f2dfa65c3d7bc2384868023ff433a76bc80fddb09bec2b322e2b |
| nr/princes.txt | Princes - New Recruit.pdf (exported 10/20/26) | 4eba3b82e8394b6399aab4f52181adea6f7ee65dd65822760337e09e8a82da01 |
| nr/standard.txt | Standard - New Recruit.pdf (exported 10/20/26) | 2d8e076d90a5b88ef273f8c3aa2f193558c06e6389c9543d675d68de177db682 |
| nr/pubstomper.txt | Pubstomper - New Recruit.pdf (exported 10/23/26) | bec846a15746097c173c294eecbbbd4ad98e0c4c2871b1b2b0aec3c3d1985894 |
| nr/nidzillas.txt | Nidzillas - New Recruit.pdf (exported 10/20/26) | ad75f4a9330b068a61ffbf91be435a4dfb147407644d4905a78d662f21096a90 |
| nr/6-bigs.txt | 6 bigs - New Recruit.pdf (exported 10/20/26) | f96e523666f068900c1f8325e1aabf6e98a4c16c0da338345f997e368566b77b |
| nr/4-megas-and-a-destrier.txt | 4 megas and a destrier - New Recruit.pdf (exported 10/20/26) | 1a924485e7e0448c6d299eb983a9d6ed0dfbbebdee695a119e374ca57b7a3cf3 |
| nr/ooga-booga.txt | Ooga booga - New Recruit.pdf (exported 10/20/26) | a2b11ffbb14e2e0aaaea7b4ea69dcae654486992c0f34240dcc1893b4d698c4d |
| nr/super-terminators.txt | Super Terminators - New Recruit.pdf (exported 10/20/26) | 00f2317c6bef15df77ae952c90414ce0da1294a42efb347c89e6fff733666069 |
| nr/purge-goes-the-foe.txt | Purge goes the Foe - New Recruit.pdf (exported 10/20/26) | cdcdfe52576d558f460e7d9b6afe4076e0aa4f12e6dd6d84b53646217ff5f392 |
| nr/infernal-lance.txt | Infernal Lance - New Recruit.pdf (exported 10/22/26) | 1674d10be857de4ad27ca37f7a706182ac5da166681c4b308f83974391dc094b |
| nr/woof-woof.txt | Woof Woof - New Recruit.pdf (exported 10/22/26) | d424cd61be2205fb71c81cc635af499cc852f8dd99cb80f601967855b9761523 |
| nr/big-demons-baby.txt | Big demons baby - New Recruit.pdf (exported 10/23/26) | a0dffd221bf54165594c5642dd342da8031644838cbbedf143a32c57e5011ef2 |
| nr/mucho-mutantes.txt | Mucho Mutantes - New Recruit.pdf (exported 10/23/26) | d24a29b27d240ef8a7e9f9d03399289bae7b37d1df92a94f2ca8f9abb2247902 |
| nr/lite-knights.txt | Lite Knights - New Recruit.pdf (exported 10/23/26) | cc48888a846167645e774b925ad1133de5b3c10772c8d6e060db47952a3ac158 |
| nr/emperors-chosen.txt | Emperors Chosen - New Recruit.pdf (exported 10/24/26) | 1484cd1d0102c8ec965d7f96b2c872148727e8af8bfd1f1a8772e1e02e36ffd3 |
| nr/dread-host.txt | Dread Host - New Recruit.pdf (exported 10/24/26) | ba77ba13d81a3381a51c5bc59c821adf272d74bb95d424f04abb839c350ea08b |
| packet/core-stratagems.txt | Core_stratagemy.pdf | d62979edcfd0323c1d3382a6d238f0f87b312fb07f103125ecbccdb6bd96e5a8 |

Text made with `pdftotext -layout <pdf> <txt>` (poppler).

A list rebuilt from the owner’s newer New Recruit JSON export (`verify/from-json.js`) no longer has its PDF text here: `verify/nr.js` then
checks it against the export (`nr-json/<id>.json`), and git history keeps the old text. Defilers and friends: nr/defilers-and-friends.txt
(Defilers and friends - New Recruit.pdf, exported 10/22/26, sha256 fb7b785ca640f46895d0564984d92f0e2cad94d17d4461baea038e9ceb09106f) was
superseded by its JSON export of 25 Oct 2026 (Fulgrim in place of Lucius the Eternal) and removed.

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
