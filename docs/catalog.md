# Faction catalogues: GW's datasheets straight into the tables

A list (`ARMIES`) names datasheets; a **faction catalogue** puts every current datasheet and detachment of a faction into the
tables, whether a list uses it or not, so the app (and the in-app import) can build any list of that faction from the data.

The sources are Games Workshop's documents and Wahapedia's pages (which count as GW), with New Recruit's names where an export of the
owner's has shown them. BSData is not a source (the owner's decision, 22 Nov 2026): nothing is fetched from it or from a copy of it.

## The files

```
verify/sources/catalog/<faction>.json   the catalogue rows (committed): one DATASHEETS row per current datasheet, the detachments
  ▼ verify/tables.js --write
data.js DATASHEETS                       every catalogue row (merged with the lists' rows, below); FACTIONS: its detachments
```

**World Eaters** (23 Nov 2026) is the first catalogue written by `verify/from-waha.js`: 30 datasheets (the six the faction page marks
Warhammer Legends left out: Chaos Thunderhawk, Hell Blade, Hell Talon, Greater Brass Scorpion, Kytan Ravager, Blood Slaughterer; and the
other factions' pages its index links, Karanak among them), the BLOOD LEGIONS units among them (`catalogFactions`: World Eaters, Blood
Legions; Pact of Blood makes them part of a World Eaters army), and 8 detachments (Boarding Actions has none of its own).

**Three catalogues were built before 22 Nov 2026** (Adeptus Custodes, Tyranids, Chaos Daemons), by the retired
`verify/from-bsdata.js`, from New Recruit's data with GW over it. Their committed rows are now the source of record: the file's
`origin` says so, they are not rebuilt, and the gate step `catalog` holds every row to GW's pages (below).

**A new faction's catalogue** is written by `verify/from-waha.js <faction> --write` from Wahapedia's pages alone:
- which datasheets: the faction page's datasheet index (`verify/waha-catalog.js` `index`), without those Wahapedia marks Warhammer
  Legends or with another faction's book;
- each row: the datasheet page's profiles, weapons, abilities, CORE ABILITIES and ARMY RULES, KEYWORDS (`verify/gw-order.js`), its
  costs (`verify/catalog.js` `gwCosts`), its models (UNIT COMPOSITION) and wargear choices (WARGEAR OPTIONS), read as a list's export
  is read (`verify/from-json.js --emit`), GW's Faction Pack updates over it;
- names: New Recruit's where a list of the faction already has the datasheet (its DATASHEETS row's unit, model and weapon names), else
  GW's as the page prints them. An import then finds a datasheet by an id a known export has shown, else by its exact name;
- its models and wargear (`verify/waha-loadout.js`): `composition` (GW's lines; a line New Recruit's exports hold as several model
  entries, "Khorne Berzerker w/ eviscerator and plasma pistol", a group of them with GW's numbers), `options` (every item GW names, the
  names builder.js recognises) and `loadout` (each line's default weapons, and the swaps and additions of WARGEAR OPTIONS with their limits:
  each model, n per unit, n for every N models; a footnote's caps and exclusions), which builder.js holds an export to (legalLoadout);
- a WARGEAR OPTIONS sentence the reader cannot express is recorded as unread, and builder.js refuses a loadout that needs it, with
  the unit named (World Eaters: the Helbrute's "For each Helbrute fist …" sentence);
- GW's Faction Pack over Wahapedia: its Rules Updates on the datasheets and on the detachments the catalogue adds; a detachment GW's
  documents name otherwise than Wahapedia's heading takes GW's name, Wahapedia's kept as its `waha` (Possessed Slaughterbound, World
  Eaters Faction Pack 1.3, for Wahapedia's Possessed Slaughterband); the hand file `verify/sources/hand/catalog-<faction>.json` for what
  the pack prints otherwise than Wahapedia (detachmentNames, detachmentTexts, texts, rows), each with its reason;
- detachments: the faction page's headings, each with its Detachment Points, Force Dispositions, rule, enhancements and stratagems.

**Merging with the lists.** `verify/tables.js --write` builds DATASHEETS from the lists, as before, then adds every catalogue
row (`catalogRows()`):
- a row no list has is the catalogue's, marked `aiStatus:'not-read'`;
- a row a list has keeps every fact its lists decide (signed off), and gets from the catalogue only what it lacks: a fact no list
  shows as the datasheet's, the weapons and abilities no list took (after its own rows), and the catalogue's columns;
- `points`, `composition`, `options` and `aiStatus` stay on DATASHEETS (the resolver does not copy them onto a list's units).

## What is left out

**The standing rule (the owner's, for every faction):** "I only care about units that are playable in official 2000 point
competitive Warhammer 40k." No Legends, no Crusade-only content, no Crucible characters, nothing only another game mode has
(Boarding Actions). None is ever offered, as a datasheet, an option inside one or a detachment.

| kind | detected by |
|---|---|
| legends | Wahapedia's index marks the datasheet "(Warhammer Legends)" |
| another faction's | the index marks it with another faction's book (the Heretic Astartes of the Chaos Daemons page), or it is on another faction's pages (an ally) |
| crusade, crucible | not on Wahapedia's faction pages at all; the gate scans every catalogue row for the words |
| boarding actions | a detachment the catalogue file lists as left out (`excluded`, kind `detachment: …`), with its rule |

The three older files also list (`excluded`) what the retired BSData filter left out, each with its rule; that list is kept as a
record and is no input any more, but for its detachment entries.

## Which columns come from where

| Column | Source | Held by |
|---|---|---|
| `name`, `role`, `stats`, `ranged`, `melee`, `kw`, `rules` | GW's datasheet (Wahapedia), New Recruit's names | `numbers`, `keywords`, `choice`, `catalog` (nr: every list unit against its row) |
| `abilities` (`name`, `tag`, `text`) | GW (Wahapedia) | `words`, `catalog` texts |
| `base` | GW's base size guide | `bases` |
| `points` | GW (Wahapedia: YOUR … COSTS per copy, the unit sizes priced, "per <wargear> N") | `catalog` texts: the row's points are the page's |
| `composition` | GW's UNIT COMPOSITION | `catalog` composition |
| `options` | GW's "equipped with" and WARGEAR OPTIONS; on the three older catalogues the limits of a choice are New Recruit's as recorded | `catalog` options (every choice named by GW or a row of the datasheet; everything GW equips a choice or a row) |
| detachments: `name`, `dp`, `rule`, `enhancements`, `stratagems` | GW (Wahapedia faction page; Faction Pack) | `texts` |
| detachments: `dispositions` | the icons in the detachment's heading on Wahapedia's faction page | `dispositions` |
| detachments: `phases`, `turn`, `needs`, … | derived | `derive` |
| `aiStatus` | derived | `catalog` |

## The AI layers: "not read yet"

Two AI layers sit on top of the mechanical rows: the **custom summaries** (a stratagem's `gist`, a "When targeted" `def`) and
the **Damage tab readings** (`mods`, `aura`, `guard`, a rule's `calcMods`, …: the app's reading of a rule into numbers). Both stay
fingerprinted (`readOf`, `gistOf`, `defOf`) and reviewer-signed as today. A catalogue row no list has, and a detachment the
catalogue added, carry `aiStatus:'not-read'`: the Damage tab does not count their rules yet, and the gate knows it (verify/catalog.js
fails a mark on a row that has readings, and a catalogue row without the mark that no list has). Adding them, per datasheet or
detachment: write the readings (verify/derive.js gives the derivable ones: Damaged, riled-up, charge bonuses), `node
verify/tables.js --stamp` for the fingerprints, the reviewer's sign-off (`verify/review/`), then drop the mark.

## The gate

`verify/catalog.js` (step `catalog` of `node verify/run.js`), every check against Wahapedia's cached pages and the lists:
- **filter**: nothing of Legends, Crusade or the Crucible in any row or detachment;
- **complete**: the rows are exactly the faction page's current datasheets of the faction's own book; the faction's detachments in
  data.js are exactly the page's headings (less the ones the file leaves out);
- **tables**, **nr**: every row is in DATASHEETS, and every list unit's rows are its catalogue row's, but for what a rule changes;
- **composition**, **options**: against UNIT COMPOSITION and WARGEAR OPTIONS, as above. New Recruit's way of holding GW's datasheet
  (its model name, a loadout it names as a bundle) is declared in `verify/deviations-catalog.json` with GW's lines as evidence;
- **texts**: every ability's words on the datasheet page or in GW's update document; the points GW's.

What it does not do: read the limits of a wargear choice out of GW's sentences. On the three older catalogues those limits are
New Recruit's as recorded before 22 Nov 2026.

Every other gate step that reaches datasheets through a list's units also walks the DATASHEETS rows no list has (`numbers`,
`keywords`, `words`, `bases`, `fingerprints`, `helpers`, `readings`), and `texts` and `dispositions` every catalogue detachment.
