# Faction catalogues: BSData straight into the tables

A list (`ARMIES`) names datasheets; a **faction catalogue** puts every current datasheet and detachment of a faction into the
tables, whether a list uses it or not, so the app (and the in-app import) can build any list of that faction from the data. It is
mechanical end to end: the same sources, the same code and the same GW-over-BSData rules as every list, and rerunning it gives the
same files. Pilot: Adeptus Custodes (`node verify/from-bsdata.js adeptus-custodes --write`).

## How the sources flow

```
BSData catalogue (+ libraries, game system) at the pin       verify/.cache/bsdata
  │  verify/bs-catalog.js: root entries, sorted by the explicit filter (below); the Detachment entry's detachments
  │  C.selection(): each datasheet as a New Recruit export holds a unit, every option taken (every model entry, every weapon and
  │  wargear choice); points per model count, composition and wargear choices as BSData gives them
  ▼
verify/out/catalog/<faction>.roster.json   one "export" of the whole catalogue (every datasheet once, every detachment)
  │  verify/from-json.js --emit: read exactly as a list's export is read: every profile by its BSData id, then GW over BSData
  │  (Wahapedia's datasheet, the codex: stats, weapons, keywords, the Rules line, ability names, tags and words; GW's base size
  │  guide for bases; the Wahapedia faction page for every detachment data.js lacks: rule, enhancements with pts, stratagems;
  │  Force Dispositions from BSData); every difference listed with its evidence
  ▼
verify/from-bsdata.js: one DATASHEETS row per datasheet (the datasheet's facts only), plus GW's LEADER / SUPPORT list as the
  │  Leader / Support ability, and the BSData-only columns (points, composition, options)
  ▼ --write (verify/catalog-write.js)
verify/sources/catalog/<faction>.json   the catalogue rows (committed; the gate re-derives it and must get the same file)
data.js FACTIONS                         each detachment data.js lacks, with verify/derive.js's labels (phases, turn, needs)
verify/deviations-bsdata.json            army "catalog": each catalogue value that is GW's, not BSData's, with GW's evidence
  ▼ verify/tables.js --write
data.js DATASHEETS                       every catalogue row (merged with the lists' rows, below)
```

**Merging with the lists.** `verify/tables.js --write` builds DATASHEETS from the lists, as before, then adds every catalogue
row (`catalogRows()`):
- a row no list has is the catalogue's, marked `aiStatus:'not-read'`;
- a row a list has keeps every fact its lists decide (signed off), and gets from the catalogue only what it lacks: a fact no list
  shows as the datasheet's (the OC every list changes with Vexilla, the Rules line of a datasheet only attached units show), the
  weapons and abilities no list took (after its own rows), and the catalogue's columns. An entry that took "all" of a row's
  weapons then names its own (the three Caladius entries: their weapons, as before); what a list shows does not change, and
  `verify/tables.js` proves it (the lists resolve to the same units).
- `points`, `composition`, `options` and `aiStatus` stay on DATASHEETS (the resolver does not copy them onto a list's units).

## What is left out: the explicit filter

`verify/bs-catalog.js` `FILTER` (the owner's rule: no Legends, no Crusade, ever), tested on fixed cases by the gate:

| kind | detected by | Adeptus Custodes |
|---|---|---|
| legends | the name ends in `[Legends]`, or a category `Legends` (entry or link) | Aleya, Valerian, Venerable Contemptor Dreadnought, Venerable Land Raider, Custodian Guard Sodality with Adrasite / Pyrithite Spears, Sagittarum Custodians Sodality |
| crusade | a Crusade name or category (`CRUSADE`: Crusade…, Order of Battle, Codex Crusade Relics, Battle Scars/Honours/Traits, Weapon Modifications, Crusade Relic Upgrades, Agendas, Requisitions, …), or only Crusade costs; inside a datasheet a group or entry so named is no option | Order of Battle; on every unit the Crusade group, Weapon Modifications, Crusade Relic Upgrades |
| crucible | the name ends in `[Crucible]`, or a category `Crucible` (characters made with GW's Crucible rules, hidden in BSData until "Show Crucible Characters"; no Wahapedia datasheet to check against) | Guardian of the Throne, Null Maiden, Kataphraktoi Exemplar |
| config | not a unit or model entry, or its primary category is Configuration | Detachment, Show/Hide Options, Martial Ka'tah Reference |

Inside a datasheet an option BSData hides statically (`hidden: true`) and the Enhancements group (a list's choice by detachment)
are no options. The same filter sorts the detachments. Every left-out entry is listed with its rule in the catalogue file
(`excluded`), and the gate's "complete" count is against the filtered set.

## Which columns are mechanical, AI, hand

| Column | Source | How |
|---|---|---|
| `name`, `bsId`, `role`, `stats`, `ranged`, `melee` (values, groups, pick-one/fire-all), `kw`, `rules` | BSData, GW over it | from-json's reading; GW's value where Wahapedia's datasheet differs (declared, army "catalog") |
| `abilities` (`name`, `tag`, `text`) | GW (Wahapedia) | GW's name, tag and words with their markup, found by BSData's words or name; BSData's where GW has none is listed to do |
| `base` | GW's base size guide | else Wahapedia's datasheet, declared in `verify/deviations-bases.json` |
| Leader / Support ability | GW (Wahapedia LEADER / SUPPORT) | "This model can be attached to the following units: …" |
| `points`, `composition`, `options` | BSData | `verify/bs-catalog.js` |
| detachments: `name`, `dp`, `rule`, `enhancements` (pts), `stratagems` (cp, WHEN/TARGET/EFFECT/RESTRICTIONS) | GW (Wahapedia faction page; GW's Printed Product Updates / Faction Pack checked by verify/texts.js) | from-json's detachment reader |
| detachments: `dispositions`, `nr` | BSData | |
| detachments: `phases`, `turn`, `turns`, `needs`, rule `at`/`ph`/`turn`/`needs` | derived | `verify/derive.js`'s fixed rules on the words |
| `aiStatus` | derived | `'not-read'`: the AI layers are not written yet |
| `gist`, `def`, `mods` / `aura` / `guard`, `calcMods` and the other reading columns | **AI** (fingerprinted, reviewer-signed) | none on a catalogue row or new detachment yet (below) |
| `weaponNames` (hand file `verify/sources/hand/catalog-<faction>.json`) | hand | a weapon BSData names otherwise than GW (Tarsis buckler / Tarsus Buckler), so GW's profile is found and checked |

## The AI layers: "not read yet"

Two AI layers sit on top of the mechanical rows: the **custom summaries** (a stratagem's `gist`, a "When targeted" `def`) and
the **Damage tab readings** (`mods`, `aura`, `guard`, a rule's `calcMods`, …: the app's reading of a rule into numbers). Both stay
fingerprinted (`readOf`, `gistOf`, `defOf`) and reviewer-signed as today. A catalogue row no list has, and a detachment the
catalogue added, carry `aiStatus:'not-read'`: the Damage tab does not count their rules yet, and the gate knows it (verify/catalog.js
fails a mark on a row that has readings, and a catalogue row without the mark that no list has). Adding them, per datasheet or
detachment: write the readings (verify/derive.js gives the derivable ones: Damaged, riled-up, charge bonuses), `node
verify/tables.js --stamp` for the fingerprints, the reviewer's sign-off (`verify/review/`), then drop the mark.

## The gate

`verify/catalog.js` (step `catalog` of `node verify/run.js`): filter (fixed cases, and the catalogue's left-out entries), complete
(every filtered BSData datasheet and detachment is in the tables, none extra), fresh (the catalogue file is what the sources give
now), tables (every row in DATASHEETS; a list's row differs only by fill / markup / tag-in-text / its Rules line, else declared in
`verify/deviations-catalog.json`), nr (every list unit's rows are the catalogue's, but for what a rule of the list gives), bsdata
(every value BSData's or a declared GW value), texts (every ability's words on its Wahapedia datasheet or GW's update document);
bases by `verify/bases.js`, detachment words by `verify/texts.js`, dispositions by `verify/dispositions.js`, as for every list.

Every check that used to reach datasheets only through a list's units also walks the DATASHEETS rows no list has, and the
catalogue's detachments, directly:

| check | catalogue-only datasheet rows | catalogue detachments |
|---|---|---|
| fingerprints (`verify/tables.js --fingerprints`) | every `def` and reading column on the row, and its `mods` / `aura` / `guard` | every gist, def and reading (all of FACTIONS, as before) |
| helpers (`verify/helpers.js`) | every judgement column (timing, def, note, na, damaged, the Damage tab's columns, readings, kwOnly, srcNote) | rule and stratagem labels (phases, turn, needs, …), gist, def, mod |
| readings (`verify/readings.js`) | their bonus sentences, listed "not read yet" (not failing) | the same, for rules, enhancements and stratagems |
| bsdata, texts, nr (`verify/catalog.js`) | every value against BSData (or a declared GW value), every ability's words on GW's datasheet; every list unit against its catalogue row | words by `verify/texts.js`, and in data.js as the catalogue has them |
| bases (`verify/bases.js`) | every model row | – |
| dispositions (`verify/dispositions.js`) | – | every detachment |
| screens / snapshots | not shown by the app until a list has the datasheet (the in-app import will build one) | the same |

A value broken in a catalogue-only row (a def or reading without its sign-off, a stat, a base, an ability's words) or in a catalogue
detachment (a stratagem's words, its dispositions) fails the gate.

## The next factions

`verify/sources/factions.json` names the catalogue; the Wahapedia datasheet pages of every catalogue datasheet go into
`verify/sources/waha-datasheets.txt` (the `--emit` run lists the ones it lacks: "no cached Wahapedia datasheet"). A library file
(Tyranids: "Library - Tyranids", Chaos Daemons: "Chaos Daemons Library") is read through the catalogue's links.
