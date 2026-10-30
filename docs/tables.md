# data.js as tables

Every unit, stratagem and rule is a row of a table in `data.js`; the app is a template over them. The AI
part is transcribing the sources, plus a few AI-written columns (`gist`, `def`), each carrying a fingerprint
of the text it was written from, and the readings (footnotes, auras, "When targeted" help: the app's reading of a rule's
text into numbers and lines), each on the row of the rule it reads and fingerprinted the same way. `verify/columns.json` says, for every column, where its values come from;
the gate fails on a column that is not there.

## The tables

| Table | Row | Key |
|---|---|---|
| `RULES`, `RULE_SRC`, `RULE_ALIASES`, `CONCEPTS` | a core rule / weapon ability, where it comes from, which chip opens it | rule name |
| `CORE_STRATAGEMS` | a core stratagem | `id` |
| `FACTIONS` | a faction: `armyRules`, `detachments` (each: `rule`, `stratagems`, `enhancements`), `aliases`; the readings of its rules and enhancements | faction key |
| `ARMIES` | a list, and its unit entries (`units`): only what the list chose | `id`, unit `id` |
| `DATASHEETS` | a datasheet's facts and the readings of its abilities, shared by every list that has it | `faction/datasheet-name` (+ `bsId` from BS_IDS) |
| `RULE_OPTIONS` | an option inside a rule or ability, with the phases its words give | `rule` + `option` |
| `GRANTS` | a rule (or option) giving units an ability or keyword, to whom, while what | `rule` + `option` + `grants` |
| `BS_IDS` | the BSData ids the in-app import resolves an export by | — |
| `BOXES` | the Damage tab's boxes of each rule, ability and stratagem, made by script from GW's words (`verify/effects-migrate.js --write`) | `a\|` / `r\|` / `s\|` / `c\|` + the hash of its name and text |

A unit entry: `{ id, ds:'orks/warboss', pts, models, gear, enhancement, warlord, copies, leads, also, kwNote, ptsNote, why, … }`
(and `mods` / `aura` / `guard` only for what is the list's own: see Readings).
An attached unit names each part: `ds:['orks/zodgrod-wortsnagga','orks/runtherd','orks/gretchin']` (leader, other characters,
bodyguard). Its rows (`stats`, `ranged`, `melee`, `abilities`) name a datasheet row and add the list's own fields:
`{ name:'Twin Killsaw', who:'Meganobz', n:6, kw:[…], from:{ 'SUSTAINED HITS 1':'Displays of Savagery' } }` (a stats row by its
model's name, `'Meganob ×6'`). An entry without one kind of rows has all of its datasheet's. A row the datasheet does
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
Anti); and, only where lists differ, a value an ability of the unit's wargear gives (the retired Melee's Kustom Force Field 4+* InSv) or a
weapon ability of the weapons it took. A difference with no reason is a conflict: the datasheet leaves the fact out, each
list keeps its value in `over`, and `verify/out/tables.md` lists it, until it is fixed at the source (GW's wording,
Wahapedia's bold). There are none today.

**GW's order.** A datasheet's rows are in GW's order, by position on its Wahapedia datasheet page (`verify/gw-order.js`;
`--write` sorts them): weapon rows (a multi-profile weapon's profiles together, in the page's order), a weapon's keywords (one a rule
of the list adds, its `from`, last), abilities (datasheet abilities, wargear abilities, rows the page has none of, then the list's
own: an enhancement's), the Rules line (CORE ABILITIES, then ARMY RULES), keywords (the KEYWORDS line, FACTION KEYWORDS, then the
list's own: Warlord, a keyword a rule gives, `why.kw`). An attached unit keeps its parts in their order, each by its own page; an item
the page does not name stays after the item before it; a datasheet with no page keeps its order. No hand ordering.

## Readings

A reading is the app's interpretation of a rule's text into numbers and lines: a footnote under a unit's weapons (`mods`:
Blitz Dem Gitz! → Blitzkannon +6 A vs non-MONSTER/VEHICLE in your Shooting phase), what a unit gives other units (`aura`), the
help it gives them when they are attacked (`guard`), and a rule's or ability's own reading columns (`mod`, `parts`,
`riled`, `damaged`, `defCalc`, …). Each is on the row of the rule it reads, once:

| It reads | It is on | The unit gets it |
|---|---|---|
| a datasheet's ability (or an option it names, a core rule on its Rules line: Damaged 5, a weapon ability it defines: Conversion) | `DATASHEETS[…].mods` / `aura` / `guard` | every unit with that datasheet |
| an army rule | that rule's row in `FACTIONS` (`mods`, …) | every unit with the rule on its Rules line (Synapse) |
| a detachment rule (`rule`, `moreRules`) | that rule's row | every unit of a list with the detachment whose needs it meets (Pledges to the Dark Prince) |
| an enhancement | the enhancement's row | its bearer (Dreadherder, Bringer of Justice) |
| a stratagem | the stratagem (`mod`, `shield`, as before) | the units its TARGET names (`needs`, by verify/derive.js) |
| nothing but the list | the list's entry, its reason in `why` (`why:{ mods:{ <from>:… } }`) | that unit |

`data.js` resolves them in that order (`resolveArmies`): the army rules on the unit's Rules line, each datasheet of the unit,
its enhancement or upgrade, the detachment rules whose needs it meets, then the entry's own. Where a list shows them in another
order (the Atrapos's Bringer of Justice before its Damaged line), its entry holds its whole list, a name standing for the rows'
readings of that name: `mods:['Macro-extinction Protocols','Bringer of Justice','Damaged: 1-10 Wounds Remaining']`; `null`: none.
What is the list's own stays on its entry with its reason: which unit it leads (`why.kwNote`), the points of its parts
(`why.ptsNote`), a reading of a row only the list has, and a reading the list has otherwise for a reason of the list: its
`listWhy` (hidden, signed off as `unit-reading-why`) names it, and it does not count against the row's reading (the retired Ooga booga's
More Dakka [IGNORES COVER] for the Meganobz' Kombi-weapons). A reading changes a weapon's values by what its rule adds (`set:{A:'+3'}`,
Possessed Lord), not by a total that bakes in the list's other grants; a one-off the player uses (once per battle) is not shown in
the weapon's numbers, only in the footnotes under the weapons (the app's `oneOffMod`).

**One rule, one reading.** Where two lists hold different readings of one ability (or rule, or enhancement), neither is picked:
the row has none of them, each list keeps its own on its entry, and `verify/out/tables.md` lists the conflict (Reading
conflicts) until it is decided against GW's text.

**Fingerprinted.** Each reading carries `readOf`, the first 8 hex of the sha256 of each exact text it was read from, joined with
`+` (`readSources` in `verify/tables.js`): first the ability, rule, enhancement, core rule or stratagem its `from` / `rule` names;
then the rule an ability's tag names that says how it is used (a Bondsman Duty: the Bondsman army rule's pick, 12", duration);
then, for a value it sets outright on a weapon (Vengeance for the Omnissiah's A 6), what gave that weapon its value in the list
(its `from`). A row's own reading columns share one `readOf` on the row (`READ_COLS`). The gate step
`fingerprints` checks each text: one that changed is stale (read the reading again from the new text, then `node
verify/tables.js --restamp`), one with no fingerprint yet is missing (check it against that text, then `--stamp`, which adds it). A reading the rule tables of `verify/derive.js` give from the words (`readingsOf`, READING_RULES: a Damaged ability,
the core ability Damaged X, a riled-up weapon ability, a characteristic bonus after a charge) is derived: `readBy:'derive'`, and
`--write` writes it again from the words when they change. `readOf` and `readBy` are hidden from the app, and from the helpers'
keys: a reading's sign-off (`verify/approvals.json`, keyed on the reading as the app gets it and its source text) is the same
on whichever row it is kept.

**Complete.** The gate step `readings` (`verify/readings.js`) reads every ability of every list by fixed rules, sentence by
sentence, and each bonus a sentence states needs a reading of that ability saying it: "if this unit is riled up, … [X]" a
riled-up reading; a weapon ability or a change to its attacks' rolls or characteristics under a condition a footnote, aura, guard
or row reading (or a marked value); a defence (Feel No Pain, invulnerable save, -1 Damage, -1 to hit or wound against it) a "When
targeted" reading (def, guard, calcDef, defCalc, its Rules line's Feel No Pain). Nothing is filled in: a gap is listed in
`verify/out/readings.md` and `verify/readings-gaps.json` for the owner (a new one fails); one that is no numeric bonus after all
stays there as `status:'not-applicable'` with its `why`, signed off like a reading (`reading-not-applicable`). There are none today.

## The Damage tab's boxes: `BOXES` (no AI)

The Damage tab reads no reading. Which boxes a unit has comes from the database alone: the army rules on its Rules line (or a detachment
rule of the list gives it: `GRANTS`; or an army rule of the list whose box reaches it, a Ritual), the detachment rules whose `needs` it
meets; its own abilities (its enhancement's, its attached parts'), the core weapon abilities of its weapons (Conversion); the abilities of
the other units of the list whose boxes reach it (an aura GW tags (Aura), a unit another unit selects, "each time a friendly X model makes
an attack": "From other units in your list"); the stratagems whose TARGET it meets (`needs`, from TARGET by fixed rules). What a box does
comes from GW's words: `verify/effects-extract.js` splits each source into sentences, list lines and options (a table's rows, "**Name:**",
"Or:", "select one of the following") and finds each effect with the patterns of `effects.js` (the catalogue: each effect's id, label, the
calc.js mod it becomes, its values, its patterns), each condition likewise (a condition no catalogue entry reads is the box's label in
GW's words), the weapons and models it names, and the friendly units it reaches (literal keywords). A source with nothing the script
counts is listed in its group with GW's words, "not counted in the Damage tab". `node verify/effects-migrate.js --write` writes
`BOXES`; the gate step `evidence` (`verify/evidence.js`, G1–G8) checks every box against the words, that `BOXES` is exactly what they
give, and that every list's units are shown exactly the stratagems their keywords meet. The datasheets' footnotes (`mods`, `aura`) are
not the Damage tab's: their `calc`, `always`, `oneModel`, `dice`, `follow`, `onDeath`, and an army rule's `calcMods`, `calcNc`, `both`,
`limit`, are retired.

**Timing labels.** A row's phase tags (`ph`, `turn`, `turns`, `at`; a stratagem's `phases`) come from `verify/derive.js` only:
the gate step `derive` fails on a stored label its rule tables do not give. Where their reading is not the label the lists were
signed off with, the row has no label and `verify/derive-unread.json` records it (`node verify/derive.js --unread`; listed with
GW's words in `verify/out/derive.md`, "Not read by the program").

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
| `CORE_STRATAGEMS` | the core stratagems | **gw**: `name`, `cp`, `when`, `target`, `effect`, `restrictions` · **derived**: `gistOf`, `phases`, `turn`, `turns`, `needs`, `defOf`, `readOf` · **hand**: `id`, `note`, `limit`, `defCalc`, `cpNote`, `mod`, `shield`, `defPick`, `react`, `weaponKw`, `lasts`, `calcNote` · **ai**: `gist`, `def` |
| `FACTIONS` | one row per faction: its army rules, detachments and aliases | **gw**: `name`, `armyRules`, `detachments` · **hand**: `aliases`, `allies` |
| `FACTIONS.armyRules` | a faction's army rules | **newrecruit**: `tag` · **gw**: `name`, `text`, `table` · **derived**: `ph`, `turn`, `turns`, `at`, `needs`, `defOf`, `defPh`, `readOf` · **hand**: `coreTwin`, `note`, `calcDefs`, `mod`, `parts`, `statNote`, `tableAt`, `missing`, `mods`, `aura`, `guard` · **ai**: `def` |
| `FACTIONS.detachments` | a faction's detachments | **bsdata**: `dispositions` · **gw**: `name`, `dp`, `rule`, `moreRules`, `enhancements`, `stratagems` |
| `FACTIONS.detachments.rule` | a detachment's rule | **newrecruit**: `tag` · **gw**: `name`, `text`, `table` · **derived**: `ph`, `turn`, `turns`, `at`, `needs`, `defOf`, `defPh`, `readOf` · **hand**: `coreTwin`, `note`, `calcDefs`, `mod`, `parts`, `statNote`, `tableAt`, `missing`, `mods`, `aura`, `guard` · **ai**: `def` |
| `FACTIONS.detachments.moreRules` | a detachment's further rule (moreRules), with the columns of its first | **newrecruit**: `tag` · **gw**: `name`, `text`, `table` · **derived**: `ph`, `turn`, `turns`, `at`, `needs`, `defOf`, `defPh`, `readOf` · **hand**: `coreTwin`, `note`, `calcDefs`, `mod`, `parts`, `statNote`, `tableAt`, `missing`, `mods`, `aura`, `guard` · **ai**: `def` |
| `FACTIONS.detachments.stratagems` | a detachment's stratagems | **gw**: `name`, `cp`, `when`, `target`, `effect`, `restrictions` · **derived**: `gistOf`, `phases`, `turn`, `turns`, `needs`, `defOf`, `readOf` · **hand**: `id`, `note`, `limit`, `defCalc`, `cpNote`, `mod`, `shield`, `defPick`, `react`, `weaponKw`, `lasts`, `calcNote` · **ai**: `gist`, `def` |
| `FACTIONS.detachments.enhancements` | a detachment's enhancements | **newrecruit**: `pts`, `nr` · **bsdata**: `upgrade` · **gw**: `name`, `text` · **wahapedia**: `limit` · **hand**: `mods`, `aura`, `guard` |
| `ARMIES` | one row per list | **newrecruit**: `name`, `faction`, `points`, `pointsUsed`, `battleSize`, `disposition`, `detachments`, `source`, `config` · **hand**: `id`, `units` |
| `ARMIES.units` | a list's unit entries: what the list chose; the datasheet's facts are in DATASHEETS | **newrecruit**: `pts`, `ptsNote`, `copies`, `models`, `gear`, `unplaced`, `enhancement`, `warlord`, `enhOn`, `warlordOn`, `upgrade`, `leads`, `support`, `also`, `role`, `name`, `rules`, `kw`, `stats`, `ranged`, `melee`, `abilities` · **derived**: `ds`, `why` · **hand**: `id`, `short`, `kwNote`, `kwOnly`, `partialRules`, `srcNote`, `mods`, `aura`, `guard`, `over`, `note` |
| `ARMIES.units.stats` | a row naming its datasheet row by name (a stats row by its model's name, "×N" its count in the attached unit), with only the list's own fields | **newrecruit**: `name`, `printed` · **bsdata**: `from`, `M`, `T`, `Sv`, `W`, `Ld`, `OC`, `InSv`, `base` · **gw**: `own` · **derived**: `of`, `why` · **hand**: `over` |
| `ARMIES.units.ranged` | a row naming its datasheet row by name (a stats row by its model's name, "×N" its count in the attached unit), with only the list's own fields | **newrecruit**: `name`, `who`, `n`, `enh` · **bsdata**: `from`, `range`, `A`, `BS`, `WS`, `S`, `AP`, `D`, `kw` · **derived**: `of`, `why` · **hand**: `over` |
| `ARMIES.units.melee` | a row naming its datasheet row by name (a stats row by its model's name, "×N" its count in the attached unit), with only the list's own fields | **newrecruit**: `name`, `who`, `n`, `enh` · **bsdata**: `from`, `range`, `A`, `BS`, `WS`, `S`, `AP`, `D`, `kw` · **derived**: `of`, `why` · **hand**: `over` |
| `ARMIES.units.abilities` | a row naming its datasheet row by name (a stats row by its model's name, "×N" its count in the attached unit), with only the list's own fields | **newrecruit**: `name`, `who`, `tag` · **wahapedia**: `text` · **derived**: `of`, `ph`, `turn`, `turns`, `at`, `defOf`, `defPh`, `why`, `readOf` · **hand**: `over`, `note`, `na`, `damaged`, `riled`, `defAlways`, `defCalc`, `calcDef`, `lasts`, `fightOnDeath`, `comeback`, `calcNote` · **ai**: `def` |
| `ARMIES.units.mods` | footnotes under a unit's weapon tables: the list's own (why names the reason), or a reading two lists have otherwise (verify/out/tables.md); a name in the list stands for the readings of that name the rows give (the list's order) | **derived**: `readOf`, `readBy` · **hand**: `kind`, `weapon`, `who`, `set`, `when`, `cond`, `note`, `from`, `pick`, `rule`, `lasts`, `vs`, `needs`, `selfWhen`, `selfAlways`, `notSelf`, `one` (guard also `calc`, `always`, `oneModel`) |
| `ARMIES.units.aura` | what a unit gives other units of its list: the list's own (why names the reason), or a reading two lists have otherwise (verify/out/tables.md); a name in the list stands for the readings of that name the rows give (the list's order) | **derived**: `readOf`, `readBy` · **hand**: `kind`, `weapon`, `who`, `set`, `when`, `cond`, `note`, `from`, `pick`, `rule`, `lasts`, `vs`, `needs`, `selfWhen`, `selfAlways`, `notSelf`, `one` (guard also `calc`, `always`, `oneModel`) |
| `ARMIES.units.guard` | help a unit gives other units of its list when they are attacked: the list's own (why names the reason), or a reading two lists have otherwise (verify/out/tables.md); a name in the list stands for the readings of that name the rows give (the list's order) | **derived**: `readOf`, `readBy` · **hand**: `kind`, `weapon`, `who`, `set`, `when`, `cond`, `note`, `from`, `pick`, `rule`, `lasts`, `vs`, `needs`, `selfWhen`, `selfAlways`, `notSelf`, `one` (guard also `calc`, `always`, `oneModel`) |
| `DATASHEETS` | one row per datasheet (faction + datasheet name): its facts, shared by every list that has it | **newrecruit**: `name`, `role`, `rules`, `kw`, `stats`, `ranged`, `melee` · **bsdata**: `bsId`, `leaders` · **wahapedia**: `abilities` · **derived**: `faction` · **hand**: `kwOnly`, `partialRules`, `srcNote`, `mods`, `aura`, `guard` |
| `DATASHEETS.stats` | a datasheet's model profiles | **newrecruit**: `name`, `M`, `T`, `Sv`, `W`, `Ld`, `OC`, `InSv`, `base` · **gw**: `baseWith` |
| `DATASHEETS.ranged` | a datasheet's ranged weapon profiles | **newrecruit**: `name`, `range`, `A`, `BS`, `WS`, `S`, `AP`, `D`, `kw`, `hunter` · **bsdata**: `group`, `fireAll` |
| `DATASHEETS.melee` | a datasheet's melee weapon profiles | **newrecruit**: `name`, `range`, `A`, `BS`, `WS`, `S`, `AP`, `D`, `kw`, `hunter` · **bsdata**: `group`, `fireAll` |
| `DATASHEETS.abilities` | a datasheet's abilities | **newrecruit**: `name`, `who`, `tag` · **wahapedia**: `text` · **derived**: `ph`, `turn`, `turns`, `at`, `defOf`, `defPh`, `readOf` · **hand**: `note`, `na`, `damaged`, `riled`, `defAlways`, `defCalc`, `calcDef`, `lasts`, `fightOnDeath`, `comeback`, `calcNote` · **ai**: `def` |
| `RULE_OPTIONS` | the options inside a rule or ability, each with the phases its words give | **derived**: `rule`, `option`, `text`, `found`, `explicit`, `trigger`, `used`, `phases` |
| `GRANTS` | a rule or option giving units an ability or keyword | **derived**: `rule`, `option`, `grants`, `type`, `to`, `while`, `text` |
| `BS_IDS` | the BSData ids the list import resolves an export by (verify/import-ids.js --write) | **bsdata**: `factions`, `roots`, `battleSizes`, `limits`, `dispositions`, `detachments`, `config`, `configKids`, `info`, `infoKids`, `units`, `names`, `maxPerList` |
| `BOXES` | the Damage tab's boxes of a rule, ability or stratagem (verify/effects-migrate.js --write) | **derived**: `n`, `b`, `nc`, `reach`, `both`, `embarked` |
| `BOXES.b` | one box: what GW's sentence does, as effects.js reads it | **gw**: `quote`, `lead` · **derived**: `fx`, `on`, `kind`, `scope`, `reach`, `mark`, `notSelf`, `lasts`, `opt`, `pick`, `part`, `limit`, `tableRows`, `pool`, `excl` |
| `DATASHEETS.mods` | the readings of the datasheet's abilities (and of a core rule on its Rules line, or a weapon ability it defines) as footnotes under its weapon tables: every list with the datasheet has them | **derived**: `readOf`, `readBy` · **hand**: `kind`, `weapon`, `who`, `set`, `when`, `cond`, `note`, `from`, `pick`, `rule`, `lasts`, `vs`, `needs`, `selfWhen`, `selfAlways`, `notSelf`, `one` (guard also `calc`, `always`, `oneModel`) |
| `DATASHEETS.aura` | the readings of the datasheet's abilities as what it gives other units of its list | **derived**: `readOf`, `readBy` · **hand**: `kind`, `weapon`, `who`, `set`, `when`, `cond`, `note`, `from`, `pick`, `rule`, `lasts`, `vs`, `needs`, `selfWhen`, `selfAlways`, `notSelf`, `one` (guard also `calc`, `always`, `oneModel`) |
| `DATASHEETS.guard` | the readings of the datasheet's abilities as help it gives other units of its list when they are attacked | **derived**: `readOf`, `readBy` · **hand**: `kind`, `weapon`, `who`, `set`, `when`, `cond`, `note`, `from`, `pick`, `rule`, `lasts`, `vs`, `needs`, `selfWhen`, `selfAlways`, `notSelf`, `one` (guard also `calc`, `always`, `oneModel`) |
| `FACTIONS.readings` | the readings (mods, aura, guard) of an army rule, detachment rule or enhancement, on its row: every unit the rule reaches (an army rule on its Rules line, a detachment rule whose needs it meets) or the enhancement's bearer has them | **derived**: `readOf`, `readBy` · **hand**: `kind`, `weapon`, `who`, `set`, `when`, `cond`, `note`, `from`, `pick`, `rule`, `lasts`, `vs`, `needs`, `selfWhen`, `selfAlways`, `notSelf`, `one` (guard also `calc`, `always`, `oneModel`) |

## AI-written columns

(The readings are fingerprinted the same way: see Readings.) `gist` (stratagems) and `def` (the "When targeted" line of
stratagems, rules, rule parts and abilities) are AI-written. Next to each is its fingerprint, `gistOf` / `defOf`: the first 8 hex of the sha256 of the exact text it
was written from (a stratagem's `WHEN: … TARGET: … EFFECT: … RESTRICTIONS: …`, a rule's text and table, an ability's
text). The gate step `fingerprints` fails when that text no longer matches: the summary is stale. Rewrite it from the
new text, then `node verify/tables.js --restamp`. A new one without a fingerprint fails too: check it against its
text, then `node verify/tables.js --stamp`. (Its sign-off in `verify/approvals.json` is keyed on the summary and its
text as before.)

## The migration: `verify/tables.js`

- `node verify/tables.js --write`: converts `data.js` from any mix of forms: every unit entry written in full (the old
  form, as `verify/import-nr.js` writes a list, or a list merged from a branch that still writes it) becomes a
  reference to its datasheet; `DATASHEETS`, `RULE_OPTIONS`, `GRANTS`, `TABLE_ORDER` (the key order the lists' objects
  have; fingerprints last) and the resolver are written again, and every reading goes to the row it reads (`DATASHEETS`, the
  rules' and enhancements' rows in `FACTIONS`; the list's own, conflicts and an order of its own on the entry: Readings).
  Deterministic: run it twice, same file. Comments stay with what they are on (on the datasheet row when every list has the
  same comment there, else on the list's; a reading's on its datasheet's reading, else on the entry's first line).
- `node verify/tables.js --stamp` / `--restamp`: writes the missing (and with `--restamp` the stale) fingerprints of the
  AI-written columns and the readings, then `--write`.
- `node verify/tables.js --expand`: the old form (every unit in full, no tables), for tools that edit text by lines;
  `--write` after. `write-grants.js` and `army-blocks.js` do this themselves.
- `node verify/tables.js`: the gate step `tables`: data.js is what `--write` writes, every column is in
  `verify/columns.json`; writes `verify/out/tables.md` (the datasheet conflicts, the reading conflicts, what stays on the lists, the derived readings).

## Adding a list

As before (`README.md`, `verify/ADDING-AN-ARMY.md`): `node verify/add-army.js <list.pdf>`, or
`node verify/import-nr.js <txt> <id> --write`. The import writes the list in full and runs `verify/tables.js --write`:
datasheets another list has are shared, new ones are added. Write the hand-written parts on the datasheet in
`DATASHEETS` (phase tags, `def`, `tag` of an ability: they are the datasheet's), the readings on the row they read (or on the
unit in the old form: `--write` moves them), the list's own on its entry (`na`, notes), or in the old form (`--expand`, edit,
`--write`). Then `--stamp` for the new fingerprints (after checking each against its text), and the gate (`node verify/run.js`).

From a New Recruit JSON export: `node verify/from-json.js <export.json> <id> --write` (`verify/ADDING-AN-ARMY.md`, 1b) writes
the list in the old form, with any faction rows data.js lacks, and ends with `verify/tables.js --write`. Its readings: the hand
file's `readings` (by row: `datasheets`, `rules`, `enhancements`), else the rows data.js has, else (a datasheet's abilities)
what `verify/derive.js` derives from the words; each unit gets them in the resolver's order, then its own (`units.<id>.mods`).

## A new column plus a template variable

1. Put the values in the table: e.g. a datasheet column `leaders` (the units its Leader ability can lead) on the
   `DATASHEETS` rows, or an ability column on `DATASHEETS[…].abilities` rows.
2. Say where they come from: an entry in `verify/columns.json` (the `tables` step fails until there is one).
3. Use it in `app.html`: the resolver copies every datasheet column onto the unit (`u.leaders`) and every row column
   onto the row (`ab.summary`); a list's own column is on its entry. Nothing else to change.
4. AI-written? Add it to `FINGERPRINT` in `verify/tables.js` (`summary:'summaryOf'`), `node verify/tables.js --stamp`. A reading
   column of a rule, stratagem or ability row? Add it to `READ_COLS` (the row's `readOf` covers it), `--stamp`.
5. `node verify/tables.js --write`, then the gate; accept the snapshots it changes on purpose (`--accept`).
