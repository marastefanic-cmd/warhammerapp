# data.js as tables

Every unit, stratagem and rule is a row of a table in `data.js`; the app is a template over them. The AI
part is transcribing the sources, plus a few AI-written columns (`gist`, `def`), each carrying a fingerprint
of the text it was written from. `verify/columns.json` says, for every column, where its values come from;
the gate fails on a column that is not there.

## The tables

| Table | Row | Key |
|---|---|---|
| `RULES`, `RULE_SRC`, `RULE_ALIASES`, `CONCEPTS` | a core rule / weapon ability, where it comes from, which chip opens it | rule name |
| `CORE_STRATAGEMS` | a core stratagem | `id` |
| `FACTIONS` | a faction: `armyRules`, `detachments` (each: `rule`, `stratagems`, `enhancements`), `aliases` | faction key |
| `ARMIES` | a list, and its unit entries (`units`): only what the list chose | `id`, unit `id` |
| `DATASHEETS` | a datasheet's facts, shared by every list that has it | `faction/datasheet-name` (+ `bsId` from BS_IDS) |
| `RULE_OPTIONS` | an option inside a rule or ability, with the phases its words give | `rule` + `option` |
| `GRANTS` | a rule (or option) giving units an ability or keyword, to whom, while what | `rule` + `option` + `grants` |
| `BS_IDS` | the BSData ids the in-app import resolves an export by | — |

A unit entry: `{ id, ds:'orks/warboss', pts, models, gear, enhancement, warlord, copies, leads, also, mods, aura, why, … }`.
An attached unit names each part: `ds:['orks/big-mek','orks/painboy','orks/nobz']` (leader, other characters,
bodyguard). Its rows (`stats`, `ranged`, `melee`, `abilities`) name a datasheet row and add the list's own fields:
`{ name:'Kustom Shoota', who:'Nobz', n:8, kw:[…], from:{ 'IGNORES COVER':'More Dakka' } }` (a stats row by its
model's name, `'Nob ×10'`). An entry without one kind of rows has all of its datasheet's. A row the datasheet does
not have (an enhancement's ability) is the list's own, in full. `null`: the list has none of it. `of`: which part of
an attached unit a row is from, when its `who` does not say.

`data.js` joins the two when it loads (`resolveArmies`, at its end): the app, `import.js` and every `verify/` step get
each unit exactly as before (the gate's `tables` step checks that `--write` gives the same lists). `WH_DATA.datasheets`,
`.ruleOptions` and `.grants` are there for templates too.

**One datasheet, one truth.** A datasheet fact has one value, on `DATASHEETS`. Where a list has another value because of
the list, the entry (or its row) holds the list's value and `why` names the reason, as `from` does for a value a rule
changed: `why:{ kw:{ Warlord:'Warlord', Battleline:'Marked Prey' }, role:{ Battleline:'Marked Prey' } }`. `--write` derives
the reasons: the Warlord keyword; a keyword a rule in force gives (`GRANTS`: Sneaky Little Gitz, Warpmeld Sacrifice, Marked
Prey); a rule an enhancement or upgrade names (Augury Uplink's Feel No Pain 5+, Destabilising Predation's [ANTI-…] as
Anti); and, only where lists differ, a value an ability of the unit's wargear gives (Kustom Force Field's 4+* InSv) or a
weapon ability of the weapons it took. A difference with no reason is a conflict: the datasheet leaves the fact out, each
list keeps its value in `over`, and `verify/out/tables.md` lists it, until it is fixed at the source (GW's wording,
Wahapedia's bold). There are none today.

## Columns and their sources

Sources: **newrecruit** (the owner's New Recruit PDFs), **bsdata** (BSData wh40k-11e), **wahapedia**, **gw**
(Games Workshop's documents), **derived** (computed by a `verify/` script), **hand** (written by hand; the note in
`verify/columns.json` says how it is checked), **ai** (AI-written, fingerprinted). Each column's note is in
`verify/columns.json`.

| Table | What | Columns by source |
|---|---|---|
| `RULES` | core rules and weapon abilities: name → text (glossary) | **gw**: `name`, `text` |
| `RULE_SRC` | where a RULES entry comes from when it is not a core rule | **hand**: `name`, `source` |
| `RULE_ALIASES` | which RULES entry a keyword or rule chip opens: [pattern, rule] | **hand**: `pattern`, `rule` |
| `CONCEPTS` | core terms kept out of a unit's rule list | **gw**: `term` |
| `CORE_STRATAGEMS` | the core stratagems | **gw**: `name`, `cp`, `when`, `target`, `effect`, `restrictions` · **derived**: `gistOf`, `phases`, `turn`, `turns`, `needs`, `defOf` · **hand**: `id`, `note`, `limit`, `defCalc`, `cpNote`, `mod`, `shield`, `help`, `defPick`, `react`, `weaponKw`, `lasts`, `calcNote` · **ai**: `gist`, `def` |
| `FACTIONS` | one row per faction: its army rules, detachments and aliases | **gw**: `name`, `armyRules`, `detachments` · **hand**: `aliases` |
| `FACTIONS.armyRules` | a faction's army rules | **newrecruit**: `tag` · **gw**: `name`, `text`, `table` · **derived**: `ph`, `turn`, `turns`, `at`, `needs`, `defOf` · **hand**: `coreTwin`, `note`, `calcNc`, `calcMods`, `calcDefs`, `limit`, `both`, `mod`, `parts`, `statNote`, `tableAt`, `missing` · **ai**: `def` |
| `FACTIONS.detachments` | a faction's detachments | **bsdata**: `dispositions` · **gw**: `name`, `dp`, `rule`, `enhancements`, `stratagems` |
| `FACTIONS.detachments.rule` | a detachment's rule | **newrecruit**: `tag` · **gw**: `name`, `text`, `table` · **derived**: `ph`, `turn`, `turns`, `at`, `needs`, `defOf` · **hand**: `coreTwin`, `note`, `calcNc`, `calcMods`, `calcDefs`, `limit`, `both`, `mod`, `parts`, `statNote`, `tableAt`, `missing` · **ai**: `def` |
| `FACTIONS.detachments.stratagems` | a detachment's stratagems | **gw**: `name`, `cp`, `when`, `target`, `effect`, `restrictions` · **derived**: `gistOf`, `phases`, `turn`, `turns`, `needs`, `defOf` · **hand**: `id`, `note`, `limit`, `defCalc`, `cpNote`, `mod`, `shield`, `help`, `defPick`, `react`, `weaponKw`, `lasts`, `calcNote` · **ai**: `gist`, `def` |
| `FACTIONS.detachments.enhancements` | a detachment's enhancements | **newrecruit**: `pts`, `nr` · **bsdata**: `upgrade` · **gw**: `name`, `text` |
| `ARMIES` | one row per list | **newrecruit**: `name`, `faction`, `points`, `pointsUsed`, `battleSize`, `disposition`, `detachments`, `source`, `config` · **hand**: `id`, `units` |
| `ARMIES.units` | a list's unit entries: what the list chose; the datasheet's facts are in DATASHEETS | **newrecruit**: `pts`, `ptsNote`, `copies`, `models`, `gear`, `unplaced`, `enhancement`, `warlord`, `enhOn`, `warlordOn`, `upgrade`, `leads`, `support`, `also`, `role`, `name`, `rules`, `kw`, `stats`, `ranged`, `melee`, `abilities` · **derived**: `ds` · **hand**: `id`, `short`, `kwNote`, `kwOnly`, `partialRules`, `srcNote`, `mods`, `aura`, `guard`, `over`, `note` |
| `ARMIES.units.stats` | a row naming its datasheet row by name (a stats row by its model's name, "×N" its count in the attached unit), with only the list's own fields | **newrecruit**: `name`, `printed` · **bsdata**: `from`, `M`, `T`, `Sv`, `W`, `Ld`, `OC`, `InSv`, `base` · **derived**: `of` · **hand**: `over` |
| `ARMIES.units.ranged` | a row naming its datasheet row by name (a stats row by its model's name, "×N" its count in the attached unit), with only the list's own fields | **newrecruit**: `name`, `who`, `n`, `enh` · **bsdata**: `from`, `range`, `A`, `BS`, `WS`, `S`, `AP`, `D`, `kw` · **derived**: `of` · **hand**: `over` |
| `ARMIES.units.melee` | a row naming its datasheet row by name (a stats row by its model's name, "×N" its count in the attached unit), with only the list's own fields | **newrecruit**: `name`, `who`, `n`, `enh` · **bsdata**: `from`, `range`, `A`, `BS`, `WS`, `S`, `AP`, `D`, `kw` · **derived**: `of` · **hand**: `over` |
| `ARMIES.units.abilities` | a row naming its datasheet row by name (a stats row by its model's name, "×N" its count in the attached unit), with only the list's own fields | **newrecruit**: `name`, `who`, `tag` · **wahapedia**: `text` · **derived**: `of`, `ph`, `turn`, `turns`, `at`, `defOf` · **hand**: `over`, `note`, `na`, `damaged`, `riled`, `embarked`, `defAlways`, `defCalc`, `calcDef`, `lasts`, `fightOnDeath`, `comeback`, `calcNote` · **ai**: `def` |
| `ARMIES.units.mods` | footnotes under a unit's weapon tables | **hand**: `kind`, `weapon`, `who`, `set`, `when`, `cond`, `note`, `from`, `always`, `calc`, `pick`, `rule`, `lasts`, `vs`, `needs`, `selfWhen`, `selfAlways`, `oneModel`, `notSelf`, `one` |
| `ARMIES.units.aura` | what a unit gives other units of its list | **hand**: `kind`, `weapon`, `who`, `set`, `when`, `cond`, `note`, `from`, `always`, `calc`, `pick`, `rule`, `lasts`, `vs`, `needs`, `selfWhen`, `selfAlways`, `oneModel`, `notSelf`, `one` |
| `ARMIES.units.guard` | help a unit gives other units of its list when they are attacked | **hand**: `kind`, `weapon`, `who`, `set`, `when`, `cond`, `note`, `from`, `always`, `calc`, `pick`, `rule`, `lasts`, `vs`, `needs`, `selfWhen`, `selfAlways`, `oneModel`, `notSelf`, `one` |
| `DATASHEETS` | one row per datasheet (faction + datasheet name): its facts, shared by every list that has it | **newrecruit**: `name`, `role`, `rules`, `kw`, `stats`, `ranged`, `melee` · **bsdata**: `bsId`, `leaders` · **wahapedia**: `abilities` · **derived**: `faction` · **hand**: `kwOnly`, `partialRules`, `srcNote` |
| `DATASHEETS.stats` | a datasheet's model profiles | **newrecruit**: `name`, `M`, `T`, `Sv`, `W`, `Ld`, `OC`, `InSv`, `base` |
| `DATASHEETS.ranged` | a datasheet's ranged weapon profiles | **newrecruit**: `name`, `range`, `A`, `BS`, `WS`, `S`, `AP`, `D`, `kw`, `hunter` · **bsdata**: `group`, `fireAll` |
| `DATASHEETS.melee` | a datasheet's melee weapon profiles | **newrecruit**: `name`, `range`, `A`, `BS`, `WS`, `S`, `AP`, `D`, `kw`, `hunter` · **bsdata**: `group`, `fireAll` |
| `DATASHEETS.abilities` | a datasheet's abilities | **newrecruit**: `name`, `who`, `tag` · **wahapedia**: `text` · **derived**: `ph`, `turn`, `turns`, `at`, `defOf` · **hand**: `note`, `na`, `damaged`, `riled`, `embarked`, `defAlways`, `defCalc`, `calcDef`, `lasts`, `fightOnDeath`, `comeback`, `calcNote` · **ai**: `def` |
| `RULE_OPTIONS` | the options inside a rule or ability, each with the phases its words give | **derived**: `rule`, `option`, `text`, `found`, `explicit`, `trigger`, `used`, `phases` |
| `GRANTS` | a rule or option giving units an ability or keyword | **derived**: `rule`, `option`, `grants`, `type`, `to`, `while`, `text` |
| `BS_IDS` | the BSData ids the list import resolves an export by (verify/import-ids.js --write) | **bsdata**: `factions`, `roots`, `battleSizes`, `limits`, `dispositions`, `detachments`, `config`, `configKids`, `info`, `infoKids`, `units`, `names`, `maxPerList` |

## AI-written columns

`gist` (stratagems) and `def` (the "When targeted" line of stratagems, rules, rule parts and abilities) are
AI-written. Next to each is its fingerprint, `gistOf` / `defOf`: the first 8 hex of the sha256 of the exact text it
was written from (a stratagem's `WHEN: … TARGET: … EFFECT: … RESTRICTIONS: …`, a rule's text and table, an ability's
text). The gate step `fingerprints` fails when that text no longer matches: the summary is stale. Rewrite it from the
new text, then `node verify/tables.js --restamp`. A new one without a fingerprint fails too: check it against its
text, then `node verify/tables.js --stamp`. (Its sign-off in `verify/approvals.json` is keyed on the summary and its
text as before.)

## The migration: `verify/tables.js`

- `node verify/tables.js --write`: converts `data.js` from any mix of forms: every unit entry written in full (the old
  form, as `verify/import-nr.js` writes a list, or a list merged from a branch that still writes it) becomes a
  reference to its datasheet; `DATASHEETS`, `RULE_OPTIONS`, `GRANTS`, `TABLE_ORDER` (the key order the lists' objects
  have) and the resolver are written again. Deterministic: run it twice, same file. Comments stay with what they are on
  (on the datasheet row when every list has the same comment there, else on the list's).
- `node verify/tables.js --expand`: the old form (every unit in full, no tables), for tools that edit text by lines;
  `--write` after. `write-grants.js` and `army-blocks.js` do this themselves.
- `node verify/tables.js`: the gate step `tables`: data.js is what `--write` writes, every column is in
  `verify/columns.json`; writes `verify/out/tables.md`.

## Adding a list

As before (`README.md`, `verify/ADDING-AN-ARMY.md`): `node verify/add-army.js <list.pdf>`, or
`node verify/import-nr.js <txt> <id> --write`. The import writes the list in full and runs `verify/tables.js --write`:
datasheets another list has are shared, new ones are added. Write the hand-written parts on the datasheet in
`DATASHEETS` (phase tags, `def`, `tag` of an ability: they are the datasheet's) or on the list's entry (`mods`,
`aura`, `na`, notes), or in the old form (`--expand`, edit, `--write`). Then the gate (`node verify/run.js`).

## A new column plus a template variable

1. Put the values in the table: e.g. a datasheet column `leaders` (the units its Leader ability can lead) on the
   `DATASHEETS` rows, or an ability column on `DATASHEETS[…].abilities` rows.
2. Say where they come from: an entry in `verify/columns.json` (the `tables` step fails until there is one).
3. Use it in `app.html`: the resolver copies every datasheet column onto the unit (`u.leaders`) and every row column
   onto the row (`ab.summary`); a list's own column is on its entry. Nothing else to change.
4. AI-written? Add it to `FINGERPRINT` in `verify/tables.js` (`summary:'summaryOf'`), `node verify/tables.js --stamp`.
5. `node verify/tables.js --write`, then the gate; accept the snapshots it changes on purpose (`--accept`).
