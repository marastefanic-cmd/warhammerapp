# data.js as tables

Every unit, stratagem and rule is a row of a table in `data.js`; the app is a template over them. The AI
part is transcribing the sources, plus one AI-written column (`gist`, the stratagems' one-line summaries: labelled "AI", the
rules as written a tap away, carrying a fingerprint of the text it was written from; the owner keeps it). No reading is left: the
footnotes under a unit's weapons, its "When targeted" lines and the lines under its profile are `BOXES`, made by script from GW's
words, and every other line a unit or stratagem screen writes is GW's words quoted or a fixed template over derived fields (The
screens' lines, below). `verify/columns.json` says, for every column, where its values come from;
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
| `BUILD_INDEX` | what the in-app build (`builder.js`) needs beyond the other tables: enhancement labels, the values a marked rule changes, GW's values over BSData's (`verify/build-index.js --write`) | enhancement / rule / datasheet name |

A unit entry: `{ id, ds:'orks/warboss', pts, models, gear, enhancement, warlord, copies, leads, also, kwNote, ptsNote, why, … }`
(the readings, once `mods` / `aura` / `guard`, are retired: see Readings).
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

**GW's keywords.** A unit's keywords are its datasheets' (`gwKeywords`, written by `--write`, checked by the gate step `keywords`,
`verify/keywords.js`): every part's KEYWORDS and FACTION KEYWORDS, in GW's spelling where the unit has none; of the unit's own only its
datasheet's name keyword (GW prints one on every datasheet; Wahapedia's new-codex pages leave it out, so its spelling is BSData's: the
page's keyword or BSData's category that is the name, else the one the name's head ends or starts with; `--write` supplies it, and the
`keywords` step fails on a datasheet without one), a keyword a named rule of the list gives (`why.kw`, a
`kwNote`'s "comes from <rule>"), a model's or a detachment's keyword the list takes (`kwOnly`), an Allies marker. A difference from
BSData or New Recruit is declared in `verify/deviations-bsdata.json` / `verify/deviations-nr.json`; one from GW in
`verify/deviations-keywords.json`.

**GW's words.** A datasheet ability's text (its wargear abilities, Damaged bands and boxes too) is its Wahapedia datasheet page's, read
by the one page reader every script shares (`verify/gw-order.js`: `wahaSectionsOf` on the datasheet cut out of its page, `pageAbility`),
and its name is GW's spelling where the page spells New Recruit's otherwise (Berzerker Frenzy, Bomb Squigs, Emanatus Force Field; a
reading's `from` follows). `--write` writes them (`gwWords`), the importers take them too (`verify/import-nr.js`, `verify/from-json.js`,
which end with `--write`), and the gate step `words` (`verify/words.js`) checks every DATASHEETS row's and every list unit's ability:
equal to the page's after markup normalisation (bold, `**`, quotes, a typographic hyphen, whitespace), a Leader line's units as a list. A
text equal to the page's after normalisation stays as it is. GW's own document over the page (a Faction Pack's rewrite or FAQ: Malign
Presence, Infected Outbreak) is declared in `verify/deviations-words.json` (`{ page, ability, app, waha, reason, evidence, gw:{ file,
quote } }`, the quote found in `verify/.cache/gw`), as is an ability no page prints (`waha:'(none)'`); `--write` keeps a declared text, and
a hand file's `texts` (`from` / `to`). A declaration nothing matches fails as stale. Where `words` passes, GW's page wins over New Recruit's
and BSData's printing of the words and the name (`verify/nr.js`, `verify/bsdata.js`: a mechanical rule, listed in their reports as
`gwWords`, no per-item deviation).

A faction catalogue's rows (`verify/sources/catalog`) go through the same rules: `--write` sorts their rows, keywords and Rules line in
GW's order after the catalogue is merged in (a catalogue row with a list row's name after it, so the resolver keeps finding the list's
by name), writes their keywords by `gwKeywords` (their BSData keywords for the name keyword; a Daemonic Allegiance entry's god), and the
gate steps `keywords` and `numbers` check every catalogue row as a unit of its own. Where a GW Faction Pack prints a datasheet's KEYWORDS
line, it is GW's over Wahapedia's page (Tormentbringer).

## Readings

**The footnotes are boxes.** The footnotes under a unit's weapons (a weapon row's "(+6)", its Damaged band, riled-up and own-aura
lines among them) are no reading any more: they are the unit's boxes in `BOXES` (below), the sources the Damage tab gives it, its
Damaged bands, and the core rules the Damage tab plays itself (`played`: Lance for its [LANCE] weapons, Plunging Fire for a TOWERING
unit), each said in app.html (`unitMods`, `fnLine`) with the labels of its effects and conditions (`effects.js`). A source with no
effect a rule reads has no footnote; its row opens GW's words. The gate step `lines` (`verify/lines.js`, L1–L8) holds the screen to
`BOXES` as G1–G8 hold the Damage tab. The columns `mods`, `aura`, a rule's or stratagem's `mod`, `parts[].mod`, `help`, an ability's
`riled` (now `BOXES` `riled`, from "This unit is riled up.") and the Damage tab's retired `calcDefs`, `defCalc`, `calcDef`, `defAlways`,
`react`, `weaponKw`, `lasts`, `calcNote`, `fightOnDeath`, `comeback`, `listWhy` are gone.

**The "When targeted" lines are boxes.** What protects a unit when it is attacked (its datasheet's "When targeted" fold) is its defence
boxes in `BOXES` (`d`: each a sentence of GW's words about attacks against the unit, or an enemy unit's attacks, and the defences the
`effects.js` DF patterns find in it, with its conditions, COND and DCOND; `dnc`: its words of that side no defence reads, with the DNC
reason; `dreach`: the units a stratagem protects that are not its TARGET, Grot Shields' ORKS INFANTRY unit), made by
`verify/effects-extract.js` (`defenceOf`), said in app.html (`defenceItems`, `defLineOf`) with the labels of their defences and conditions:
"{name}: {phases, the attacks it is against, its conditions}: {defences}" (a box whose only conditions are GW's quoted words: "If (see the
rule)"; words not counted: one "not counted here: see the rule" line, never left out). Which boxes: a core rule with its value on its
Rules line (Feel No Pain 5+), the army rules on its Rules line (or one of the list's that reaches it), the detachment rules whose needs it
meets, its own abilities, other units' abilities whose boxes reach it (an aura, a unit another selects, an enemy unit's attacks made worse:
`foe`), the detachments' stratagems it can be the TARGET of; the Waaagh! army rule's riled-up 5+ InSv is its box. The gate step `defence`
(`verify/defence.js`, D1–D8 and DL) holds them to the words as G1–G8 hold the Damage tab; its DC (and `verify/lines.js` LC for the
attack side) holds the words to them: every condition GW's words put on a box (`verify/coverage.js`: its option, once per battle / turn,
each "if / while / unless" clause, each "within N"", the kind of attack) is said, quoted, or its sentence is listed not counted. The columns `def` (and `defOf`, `defPh`),
`guard`, a stratagem's `shield` and `defPick`, `parts[].def` are gone.

**The lines under a unit's profile are boxes.** A characteristic of its models a rule of the list changes ("Not Battle-shocked: OC 7
(Enraged Behemoths)") is the rule's stat boxes in `BOXES` (`st`: each a sentence of GW's words, the stat effects `effects.js` ST finds in it,
its conditions, COND and STCOND, the friendly units it names), made by `verify/effects-extract.js` (`statOf`), said in app.html (`statLines`):
"{conditions}: {the characteristic with the effect, or the effect}" (a one-model unit's Starting Strength in its wounds; GW's quoted words
alone: "If (see the rule)"; not one the list printed into the value, its `from` mark). The gate step `lines` (LS) holds them to the words and
the words to them. A rule's `statNote` and `parts` are gone.

## The screens' lines

No line the app writes on a unit or stratagem screen stands on a judgement (the owner's rule). Each is GW's words quoted, or a fixed template
filled from fields a script derives from GW's words or checks mechanically; the one AI layer is `gist`. The gate step `tables` fails when a
column those screens read (every property the code of app.html's `screenUnit`, `stratItem` and `showStrat` reads, with every function they
call) is `hand` or AI, but `gist` and a column `verify/columns.json` declares with its reason (an id; the short name a list gives a unit; a
fact no list has today; a rule's `needs` its words do not give, Kindred Sorcery's, with its why and evidence). The reads count a
property, a literal key (`u['short']`) and a destructured name; a `derived` column names the script the gate runs that derives or holds it
(`by`, or its note).

| Line | From | Held by |
|---|---|---|
| a note under an ability, rule or stratagem | GW's words, each quoted under a fixed source label ("Wahapedia FAQ: “…” “…”", "FAQ (Faction Pack 1.3): …") | `verify/texts.js` noteForm (the form, NOTE_LABELS), noteQuote (each quote in its label's documents), noteLabel (the label's version, datasheet, FAQ / errata / Designer's Note held to where its first quote is) |
| "Once per battle", "Or: +1CP" | a stratagem's RESTRICTIONS, its EFFECT, by closed patterns (`limitOf`, `cpNoteOf`) | `verify/lines.js` L0 |
| "Not leading a unit in this list", "Needs … : not this loadout", "No WAR DOG in this list" (`na`) | three closed patterns over the ability's words, the unit and the list (`verify/derive.js` naOf), written by the importer | L0 |
| the keywords note (`kwNote`) | fixed templates over GW's pages (the parts' keywords), GRANTS and the list's reasons, GW's words quoted (`verify/gw-order.js` kwNoteOf) | `tables` (`--write` writes it) |
| where the sources disagree (`srcNote`) | one template: each model Wahapedia prints on a datasheet of its own (`srcNoteOf`; a list where there are two) | `tables` |
| keywords or rules only some models have (`kwOnly`, `partialRules`) | GW's pages (a part's KEYWORDS line or CORE ABILITIES, "MODEL: KW", "(Model only)", a model's own page, an ability that gives it) | `verify/keywords.js` KO, PR |
| a reference sheet's quote (`ref`) | GW's words of the rule it names | `verify/texts.js` refQuote |
| "Already in A" | the `from` marks (`alreadyIn`, `alreadyInRule`) | `verify/lines.js` LA |
| a rule sheet's source label (`RULE_SRC`) | fixed templates over the entry's place: an ally's army rule, a heading of a faction page's Army Rules, an enhancement's from mark, a weapon keyword, a term in bold (`verify/derive.js` ruleSrcOf) | texts ruleSrc |
| an alias, an ally's rule, a core twin, a table's place | mechanical checks (`verify/texts.js` alias, allies, coreTwin, tableAt); a player's word for a rule stays a reviewed alias, no line | texts |

A rules text holds no app note ("*App note, not rules text: …*"): `verify/texts.js` appNote fails on one.

A reading is the app's interpretation of a rule's text into numbers and lines: a footnote under a unit's weapons (`mods`:
Blitz Dem Gitz! → Blitzkannon +6 A vs non-MONSTER/VEHICLE in your Shooting phase), what a unit gives other units (`aura`), the
help it gives them when they are attacked (once `guard`), and a rule's or ability's own reading columns (once `mod`, `parts`,
`riled`, `defCalc`, …; `damaged` and a stratagem's `limit` are derived now, verify/lines.js L0). Each is on the row of the rule it reads, once:

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
or row reading (or a marked value); a defence (Feel No Pain, invulnerable save, -1 Damage, -1 to hit or wound against it) its defence
boxes (BOXES d, or its words listed as not counted, dnc), its Rules line's Feel No Pain or a marked InSv. Nothing is filled in: a gap is listed in
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
| `RULE_ALIASES` | which RULES entry a keyword or rule chip opens: [pattern, rule] | **derived**: `rule` · **hand**: `pattern` |
| `CONCEPTS` | core terms kept out of a unit's rule list | **gw**: `term` |
| `CORE_STRATAGEMS` | the core stratagems | **gw**: `name`, `cp`, `when`, `target`, `effect`, `restrictions`, `note` · **derived**: `gistOf`, `phases`, `turn`, `turns`, `needs`, `limit`, `cpNote`, `readOf` · **hand**: `id` · **ai**: `gist` |
| `FACTIONS` | one row per faction: its army rules, detachments and aliases | **gw**: `name`, `armyRules`, `detachments`, `allies` · **hand**: `aliases` |
| `FACTIONS.armyRules` | a faction's army rules | **newrecruit**: `tag` · **gw**: `name`, `text`, `table`, `note` · **wahapedia**: `tableAt` · **derived**: `ph`, `turn`, `turns`, `at`, `needs`, `coreTwin`, `readOf` · **hand**: `missing` |
| `FACTIONS.detachments` | a faction's detachments | **bsdata**: `dispositions`, `nr` · **gw**: `name`, `dp`, `rule`, `moreRules`, `enhancements`, `stratagems` · **derived**: `aiStatus` |
| `FACTIONS.detachments.rule` | a detachment's rule | **newrecruit**: `tag` · **gw**: `name`, `text`, `table`, `note` · **wahapedia**: `tableAt` · **derived**: `ph`, `turn`, `turns`, `at`, `needs`, `coreTwin`, `readOf` · **hand**: `missing` |
| `FACTIONS.detachments.moreRules` | a detachment's further rule (moreRules), with the columns of its first | **newrecruit**: `tag` · **gw**: `name`, `text`, `table`, `note` · **wahapedia**: `tableAt` · **derived**: `ph`, `turn`, `turns`, `at`, `needs`, `coreTwin`, `readOf` · **hand**: `missing` |
| `FACTIONS.detachments.stratagems` | a detachment's stratagems | **gw**: `name`, `cp`, `when`, `target`, `effect`, `restrictions`, `note` · **derived**: `id`, `gistOf`, `phases`, `turn`, `turns`, `needs`, `limit`, `cpNote`, `readOf` · **ai**: `gist` |
| `FACTIONS.detachments.enhancements` | a detachment's enhancements | **newrecruit**: `pts`, `nr` · **bsdata**: `upgrade` · **gw**: `name`, `text` · **wahapedia**: `limit` |
| `ARMIES` | one row per list | **newrecruit**: `name`, `faction`, `points`, `pointsUsed`, `battleSize`, `disposition`, `detachments`, `source`, `config`, `units` · **hand**: `id` |
| `ARMIES.units` | a list's unit entries: what the list chose; the datasheet's facts are in DATASHEETS | **newrecruit**: `pts`, `ptsNote`, `copies`, `models`, `gear`, `unplaced`, `enhancement`, `warlord`, `enhOn`, `warlordOn`, `upgrade`, `leads`, `support`, `also`, `role`, `name`, `rules`, `kw`, `stats`, `ranged`, `melee`, `abilities` · **gw**: `ref`, `note` · **wahapedia**: `kwOnly`, `partialRules` · **derived**: `id`, `ds`, `kwNote`, `srcNote`, `why` · **hand**: `short`, `over` |
| `ARMIES.units.stats` | a row naming its datasheet row by name (a stats row by its model's name, "×N" its count in the attached unit), with only the list's own fields | **newrecruit**: `name`, `printed` · **bsdata**: `from`, `M`, `T`, `Sv`, `W`, `Ld`, `OC`, `InSv`, `base` · **gw**: `own` · **derived**: `of`, `why` · **hand**: `over` |
| `ARMIES.units.ranged` | a row naming its datasheet row by name (a stats row by its model's name, "×N" its count in the attached unit), with only the list's own fields | **newrecruit**: `name`, `who`, `n`, `enh` · **bsdata**: `from`, `range`, `A`, `BS`, `WS`, `S`, `AP`, `D`, `kw` · **derived**: `of`, `why`, `group` · **hand**: `over` |
| `ARMIES.units.melee` | a row naming its datasheet row by name (a stats row by its model's name, "×N" its count in the attached unit), with only the list's own fields | **newrecruit**: `name`, `who`, `n`, `enh` · **bsdata**: `from`, `range`, `A`, `BS`, `WS`, `S`, `AP`, `D`, `kw` · **derived**: `of`, `why`, `group` · **hand**: `over` |
| `ARMIES.units.abilities` | a row naming its datasheet row by name (a stats row by its model's name, "×N" its count in the attached unit), with only the list's own fields | **newrecruit**: `name`, `who`, `tag` · **gw**: `note` · **wahapedia**: `text` · **derived**: `of`, `ph`, `turn`, `turns`, `at`, `na`, `damaged`, `why`, `readOf` · **hand**: `over` |
| `DATASHEETS` | one row per datasheet (faction + datasheet name): its facts, shared by every list that has it, and every row of a faction catalogue (docs/catalog.md) | **newrecruit**: `name`, `role`, `rules`, `kw`, `stats`, `ranged`, `melee` · **bsdata**: `bsId`, `leaders`, `composition`, `options` · **gw**: `points` · **wahapedia**: `kwOnly`, `partialRules`, `abilities` · **derived**: `faction`, `srcNote`, `aiStatus` |
| `DATASHEETS.stats` | a datasheet's model profiles | **newrecruit**: `name`, `M`, `T`, `Sv`, `W`, `Ld`, `OC`, `InSv`, `base` · **gw**: `baseWith` |
| `DATASHEETS.ranged` | a datasheet's ranged weapon profiles | **newrecruit**: `name`, `range`, `A`, `BS`, `WS`, `S`, `AP`, `D`, `kw`, `hunter` · **bsdata**: `group`, `fireAll` · **gw**: `carrier` |
| `DATASHEETS.melee` | a datasheet's melee weapon profiles | **newrecruit**: `name`, `range`, `A`, `BS`, `WS`, `S`, `AP`, `D`, `kw`, `hunter` · **bsdata**: `group`, `fireAll` · **gw**: `carrier` |
| `DATASHEETS.abilities` | a datasheet's abilities | **newrecruit**: `name`, `who`, `tag` · **gw**: `note` · **wahapedia**: `text` · **derived**: `ph`, `turn`, `turns`, `at`, `na`, `damaged`, `readOf` |
| `RULE_OPTIONS` | the options inside a rule or ability, each with the phases its words give | **derived**: `rule`, `option`, `text`, `found`, `explicit`, `trigger`, `used`, `phases` |
| `GRANTS` | a rule or option giving units an ability or keyword | **derived**: `rule`, `option`, `grants`, `type`, `to`, `while`, `text` |
| `BS_IDS` | the BSData ids the list import resolves an export by (verify/import-ids.js --write) | **bsdata**: `factions`, `roots`, `battleSizes`, `limits`, `dispositions`, `detachments`, `config`, `configKids`, `info`, `infoKids`, `units`, `names`, `maxPerList` |
| `BOXES` | the Damage tab's boxes of a rule, ability or stratagem, and the datasheet's footnotes (verify/effects-migrate.js --write) | **derived**: `n`, `b`, `nc`, `reach`, `both`, `embarked`, `played`, `riled`, `d`, `dnc`, `dreach`, `st` |
| `BOXES.b` | one box: what GW's sentence does, as effects.js reads it | **gw**: `quote`, `lead` · **derived**: `fx`, `on`, `kind`, `scope`, `reach`, `mark`, `notSelf`, `lasts`, `opt`, `pick`, `part`, `limit`, `tableRows`, `pool`, `excl` |
| `BOXES.d` | one defence box: what GW's sentence does for a unit when it is attacked, as effects.js DF reads it (a "When targeted" line) | **gw**: `quote`, `lead`, `until` · **derived**: `df`, `on`, `kind`, `scope`, `reach`, `mark`, `notSelf`, `foe`, `opt`, `pick`, `term` |

## Faction catalogues

`node verify/from-bsdata.js <faction> --write` puts every current datasheet and detachment of a faction into the tables, from
BSData with GW over it, by the same code as a list (docs/catalog.md). `--write` here merges the catalogue rows
(`verify/sources/catalog/<faction>.json`) into DATASHEETS: a row a list has keeps its lists' facts and gets only what it lacks; a row
no list has is the catalogue's, `aiStatus:'not-read'` (no readings or AI-written lines yet). `points`, `composition`, `options` and
`aiStatus` are not copied onto a list's units.

## AI-written columns

`gist` (stratagems) is AI-written, the one AI layer the owner keeps (`def`, the "When targeted" line, is
retired: BOXES d). Next to it is its fingerprint, `gistOf`: the first 8 hex of the sha256 of the exact text it
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
`DATASHEETS` (phase tags, `tag` of an ability: they are the datasheet's), the readings on the row they read (or on the
unit in the old form: `--write` moves them), the list's own on its entry (notes: GW's words under a source label; `na`, `kwNote`, `srcNote` are derived), or in the old form (`--expand`, edit,
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

## The in-app build: `builder.js`

An export imported on the phone gets the outcome the same export would get here: `builder.js` (browser and Node, no `fs`, no `require`)
turns a New Recruit export into the list's `ARMIES` entry from the export and `data.js` alone, `WH_BUILDER.build(export, WH_DATA, { id, date })`,
and the app joins it with `DATASHEETS` as it joins its own lists (`WH_DATA.resolve`). It builds only a faction with a full catalogue
(Custodes, Tyranids, Chaos Daemons today: `DATASHEETS` rows with GW's `points`); a list of another faction is copied from the app's own
lists' units by `import.js` as before, and the list says so. What it reads:

| From | What |
|---|---|
| the export | the units and who leads whom, models lines and their gear, the weapons and models (each to its `DATASHEETS` row by name), the enhancement, the Warlord, the points, the values its profiles show |
| `DATASHEETS` | the rows, a wargear ability only with its wargear (`options`), a Leader / Support ability (whom it may join; not a row of the unit), GW's `points` |
| `FACTIONS` | detachments, enhancements (name, text, pts, `limit`, `upgrade`), army and detachment rules |
| `BOXES`, `BUILD_INDEX` | a "+" mark: a value the export shows otherwise than the row is a rule of the list at work; its source is the one rule reaching the unit whose boxes give that effect, else the one `BUILD_INDEX.marks` names for it; a value `BUILD_INDEX.gw` says is BSData's where GW's datasheet differs is no rule at work. A change no rule explains, or two explain, refuses the import |
| `BS_IDS` | the faction, battle size, detachments and disposition (as `import.js` reads them) |

Nothing the list shows is the export's: a part's name is its datasheet's, a model's its datasheet's composition's, a weapon's its row's, a
wargear its option's; a value is GW's row's, or GW's row's with the one rule's effect (its boxes' `fx`, else `BUILD_INDEX.marks`' `add` /
`set`), and the export's value is only compared with it (a difference refuses the import, naming both). The export says what was selected,
and that is held to GW's rules, each refusal citing the rule: the datasheet's models (`composition`) and wargear (`options`: each choice and
group per model, every model of a line alike); enhancements (a CHARACTER's, not an EPIC HERO's, as the enhancement's own first sentence
allows, one per unit, no two of one, an Upgrade (BSData's or GW's Faction Pack's, `BUILD_INDEX.upgrades`) up to three, the battle size's
limit); one CHARACTER Warlord; the unit limit (EPIC HERO 1, BATTLELINE and DEDICATED TRANSPORT double); Detachment Points; one leader and one
support per bodyguard, each by its own Leader / Support ability (Core Rules 19.01, 25.03, 25.04; the battle sizes' numbers are
`BUILD_INDEX.battleSizes`, from rules/core-rules.md 25.03).

The gate step `build-parity` (`verify/build-parity.js`) holds it: every export of a catalogued faction builds its entry byte for byte (P1),
every list imported on the phone shows every screen as the built-in one at 390 and 320px (P2), the build is deterministic (P3), the test
list in .json, .ros, .rosz, text B and text C gives one list, and changed exports are refused with exact messages. What the hand files hold
has no effect on a build; a list whose built-in entry needs a hand file (an id, a `short`, a note) would differ, and P1 says so.

**One builder.** A built-in list of a catalogued faction that has a New Recruit JSON export (6 lists today: Basic Bitch, Healybois, Lite
Knights, Nidzillas, The Exiled Legion, Tzeeeeentch) is made by the same code as a phone import; the two catalogued lists made from New
Recruit PDFs alone, with no export (Emperor's Chosen and Dread Host, Adeptus Custodes), are not (see the known limits). `verify/from-json.js --write` ends
by calling `WH_BUILDER.build` on the export with the `data.js` it has just written (after `verify/build-index.js --write`, so its "+" marks
are in `BUILD_INDEX`), and the list's `ARMIES` entry is builder.js's, with from-json's source line (the day the export was committed, or the
hand file's `source`). What stays from-json's is the Node-only part: BSData at the pin (every id, the extract), Wahapedia's pages and GW's
documents (the datasheet facts `verify/tables.js --write` puts on `DATASHEETS`, the faction rows, the deviation files), and the hand file.
Its own reading of the list's entry is kept as a check: where it is not builder.js's, the entry is builder.js's, the difference is listed
and the run fails; `verify/reimport.js` (4) fails a catalogued list not built so, or built otherwise than from-json reads it. A list of a
faction with no catalogue (18 of the 24 exports today) keeps from-json's reading until the faction's catalogue lands; the phone copies it.

What from-json does that builder.js does not, and where each goes:

| from-json | for builder.js |
|---|---|
| hand `source` (the PDF's export day) | a fact of this list (where it came from): a phone import says when it was imported (P1, P2 leave the source line aside) |
| hand `units.<id>.why`, `gists.<id>.by`, `refs[].why`, `ids.<id>` | reasons, recorded for the reviewer: nothing shown (an id is the list's; a catalogued list's ids are builder.js's, none is in a hand file) |
| hand `units.<id>.texts`, `units.<id>.notes`, `refs` (a reference sheet with no export entry, and one of models on another's datasheet) | datasheet facts, on the `DATASHEETS` rows builder.js reads (texts also in `verify/deviations-words.json`, Chaos Daemons' in the catalogue hand file): a phone import of any list with the datasheet has them; builder.js finds the reference sheets by GW's words (`sheetRefs`) |
| hand `gists` (`gist`, `gistOf`, `note`), `armyRules` FAQs, `fixes` | `FACTIONS` rows, shared by every list of the faction (app and phone alike) |
| a models line split by GW's WARGEAR OPTIONS ("1 model can be equipped with 1 …", Wahapedia's page), a stats row without its ×N where the list has a New Recruit PDF (`verify/sources/nr`) | none in a catalogued list's entry today; builder.js does neither (the export's association, else unplaced; always ×N), so a catalogued list needing one fails from-json's check |
| "+" marks from BSData's modifiers (`verify/bsdata.js`, `write-grants.js`) | builder.js names a mark's rule from `BOXES` (agreed), else `BUILD_INDEX.marks`, which `verify/build-index.js` learns from the built-in lists' marks |

**An ability a rule gives is the list's, never the datasheet's.** The owner's rule (4 Nov 2026): every ability a rule gives a unit is a
row of its own on the unit's datasheet screen, marked with the rule that gives it, wherever that rule is in force for the list, derived
from GW's rule text and the unit's keywords and never from what an export prints. Which: an army rule of the list's faction, or a rule of
one of its detachments, that gives units an ability with no condition (`GRANTS`, type ability, no option, `while` null), or whose only
condition is the Army Faction ("If your Army Faction is **CHAOS KNIGHTS**": a fact of the list, met where the list's faction is that
one, and no grant otherwise): one whose words it prints ("the following ability", a heading's lines, a row of its table), or a core
ability it names ("have the **Feel No Pain 6+** ability"). Who: units of some keywords (counting the keywords a rule in force gives by
keyword, Thralls of the First Prince's SHADOW LEGION), or "each unit from your army with this ability" (the units whose Rules line names
the rule: GW's datasheet's Rules line, the `DATASHEETS` row's in builder.js and the gate, the Wahapedia datasheet page's CORE and army
rules in from-json, never the export's; `verify/reimport.js` (5) re-imports Woof Woof with the rule stripped from its Karnivores in the
export and still gets their rows). Today: Higher Imperatives (Talons of the Norn Queen) gives Protean Purpose to NORN EMISSARY/NORN ASSIMILATOR
units (Nidzillas, Healybois); Daughters of the Abyss (the Adeptus Custodes army rule) gives Psychic Null (Aura) to ANATHEMA PSYKANA units
(the Prosecutor and Witchseeker Squads of Lite Knights, Emperor's Chosen and Dread Host); Mission Tactics (Deathwatch Support) gives
Furor, Malleus and Purgatus Tactics to KILL TEAM units (Nerf when's Deathwatch Terminator Squad); Silent Sisterhood (Null Maiden Vigil)
gives Creeping Dread (Aura) to ANATHEMA PSYKANA units, and Seductive Gambit (Legion of Excess) Seductive Gambit to LEGIONES DAEMONICA
SLAANESH units (no list takes these two detachments); Harbingers of Dread (the Chaos Knights army rule) gives Deathly Terror (Aura), the
row of its table "active for your army from the start of the battle", to each unit with the rule where the Army Faction is CHAOS KNIGHTS
(all 11 units of Infernal Lance and Woof Woof; tag "Harbingers of Dread · Aura"); First Prince of Chaos (Shadow Legion) gives "the
relevant abilities presented below" by their headings' keywords, Murderer's Cowl to SHADOW LEGION KHORNE, Penumbral Puppetry to
SHADOW LEGION TZEENTCH, Gloam Rot to SHADOW LEGION NURGLE, Shadow's Caress to SHADOW LEGION SLAANESH and Disciples of Be'lakor to
SHADOW LEGION UNDIVIDED units (GW's capitals in the case of other names), and what a heading's own words give "this unit" by the same
keywords is a row of its own right after it, as every ability a rule gives (Penumbral Puppetry's "This unit has **Stealth**": a Stealth
row, the core rule's words; Disciples of Be’lakor's bullet "SHADOW LEGION HERETIC ASTARTES models in this unit have the **Deep Strike**
ability": a Deep Strike row, to those units); no list takes the detachment. Disciples of Be’lakor's "This unit has the **Dark Pacts**
army rule" is not a row: GW gives an army rule (of Codex: Chaos Space Marines), not an ability; an army rule is shown on a unit's Rules
line, and one of another faction is not one the app's rule popup finds (it reads the list's faction's army rules), so it stays in
Disciples of Be’lakor's words. Mission Tactics reads "Friendly
KILL TEAM units with this ability": GW's Deathwatch Terminator Squad page lists only Combat Doctrines as its army rule, so "this
ability" is read as the detachment rule itself, and every KILL TEAM unit of a list that takes it has the rows. Core abilities: Knights of Legend (Freeblade
Company) gives Feel No Pain 6+ to IMPERIAL KNIGHTS models (every Knight of 6 bigs, 4 megas and a destrier, Navigator sounds op ngl);
Heralds of the Throne (Emissaries Imperatus) Fights First to ADEPTUS CUSTODES units, Mindhunger (Ambush Predators) Deep Strike to
DEATHLEAPER/LICTOR/NEUROLICTOR units, First Prince of Chaos (Shadow Legion) Deep Strike to SHADOW LEGION HERETIC ASTARTES units (no list
takes these three detachments). One function reads them, `builder.js`
`ruleAbilities`, and builder.js, `verify/from-json.js`, `verify/tables.js` and `verify/catalog.js` all call it, so both paths give the
same row:
- its words: GW's, quoted from the rule's own text, the words `RULE_OPTIONS` reads for the option of that name ("(Aura)", case and
  apostrophes aside), found exactly once right after the ability's bold name ("**Protean Purpose:** …", "**Furor Tactics**" and its
  line), under its heading in capitals with its lines up to the next heading ("MURDERER’S COWL"; Disciples of Be’lakor's bullets), or
  as a row of the rule's table (Deathly Terror (Aura): its name, " · N/A" aside, and its words); the rule's own characters are kept. A
  heading's keywords (`verify/derive.js`: "**SHADOW LEGION UNDIVIDED** units only.") are each one the program knows, a datasheet's or
  one a rule gives, split longest first; a run it cannot read so is `{ unread }` in `GRANTS` and fails the gate. Where they cannot be found so, or `RULE_OPTIONS` has no such option, nothing is guessed: builder.js refuses a
  list with a unit that meets the rule, from-json lists it as not filled, and the gate fails (`verify/tables.js`, for every detachment of
  every faction, whether a list takes it or not).
- a core ability's row: GW's name for it ("Feel No Pain 6+") and the core rule's words, the ones its popup shows (the app's `ruleFor`:
  the faction's aliases, `RULE_ALIASES`, `RULES`; `builder.js` `coreText`); no phases; tag the rule's name. A name no core rule has is
  an error, as above.
- its tag, the mark: the rule's name, then the limit GW prints before the words, then Aura where GW's name says "(Aura)", as an
  enhancement's tag names it: "Higher Imperatives · Once per battle, per unit", "Daughters of the Abyss · Aura", "Mission Tactics". The
  screen shows it as every tag (under the name when the row is opened, and in search); a once-per-battle limit is the row's chip, as
  for any ability.
- its phases: those `RULE_OPTIONS` gives the option (the program's reading of the rule's words); `verify/derive.js` holds them so. A
  core ability the words say a unit has ("This unit has **Stealth**") is read with that core ability's own words (derive.js has-core:
  Stealth's "each time a ranged attack targets that unit", the attacker's Shooting phase; Deep Strike's ingress move, your Movement
  phase), not for a label (an ability row shows a protection by its When targeted line) nor where this table already reads it (Lone
  Operative).
- its place: after the part's datasheet abilities, in the order GW's rule prints them, before an enhancement's (in an attached unit, on
  the part that has the keywords). A datasheet that itself has an ability of that name keeps its own.
- it is the list's own row (in full on the list's entry, as an enhancement's), never one on `DATASHEETS` (`verify/tables.js` keeps it
  off, and `verify/build-parity.js` N fails a `DATASHEETS` row that has one).
- its words are the rule's, so they are read as the rule's: `verify/effects-migrate.js` and `verify/derive.js` make no boxes, options or
  grants of their own from it (the rule's are already there: the Damage tab and "When targeted" count Psychic Null and the Tactics
  once, from the rule, and the Damage tab, `app.html` `dmSources`, does not list the row as a source of its own, not even under "not
  counted": verify/evidence.js holds it so), `verify/readings.js` and derive's defence coverage read the rule's boxes of that option (of no option for a core ability's row,
  by what the row is) (`builder.js`
  `ruleOfRow`: a row whose tag names a rule in force and whose words are in it). It has a Phase checklist entry, as Protean Purpose had.
  Not being the datasheet's, it is not asked of the datasheet's sources: `verify/words.js` does not look for it on the Wahapedia
  datasheet page (the two declared Protean Purpose entries of `verify/deviations-words.json` are gone with that), `verify/bsdata.js`
  does not ask BSData's entry for it, and `verify/nr.js` lets New Recruit's PDF leave it out and leave the rule's name out of its tag;
  `verify/texts.js` checks the rule's words against GW's, and the row quotes them (it does not look for the row on a Faction Pack
  datasheet page either). A faction catalogue's reading (`verify/from-bsdata.js`,
  from-json `--emit`) has no such row: the datasheets alone.
- left as today, with a condition or not by keyword (`GRANTS` rows of type ability skipped): an option's grant while it is active
  (Psychic Null's Feel No Pain 5+ against psychic attacks, Daughters of the Abyss; Blood Tithe's Enraged Abjuration and Might of Khorne,
  bought with Blood Tithe points; Harbingers of Dread's other Dread abilities, Darkness's Stealth among them, selected or rolled during
  the battle), one to "this unit / model" a rule selects rather than by keyword (Malefic Surge's Feel No Pain 6+, Infernal Lance,
  "Empowered"), Disciples of Be'lakor's Dark Pacts army rule (above), and the grants a unit's own ability or an
  enhancement makes (on that unit's own row already). Daughters of the Abyss' "Feel No Pain 3+ against psychic attacks" and Aegis of the
  Emperor's Feel No Pain against mortal wounds are no `GRANTS` rows (GW does not word them as an ability given): the rule's own effect
  on the units that have it, on their Rules line, as their datasheets print it.

The gate holds it: `verify/tables.js` fails any list unit whose rule-given rows are not exactly those the rules in force give it (so the
two PDF-only lists too) and any unresolved words; build-parity N builds exports with the ability's profile removed (the row is still
there), with Talons of the Norn Queen removed (no Protean Purpose, even with the export still showing it), with the profile on a unit
without the keyword (no row), Lite Knights (Psychic Null (Aura) on its three ANATHEMA PSYKANA units only), Mindhunger's Deep Strike
(the core rule's words, for its keywords only) a core ability no core rule names (an error), Seductive Gambit (DAEMONETTES, not BLOODLETTERS), First Prince of Chaos (Murderer's Cowl
on BLOODLETTERS and Shadow's Caress on DAEMONETTES, through SHADOW LEGION; none without the detachment; an unread heading an error) and
Deathly Terror (Aura) (on a War Dog Brigand where the Army Faction is CHAOS KNIGHTS, none under another).

Known limits (accepted: each refuses rather than shows anything wrong, or no current list meets it):
- `BUILD_INDEX.marks` is learned from the built-in lists' marks: a phone export showing a change no agreed box explains and no built-in
  list has marked is refused.
- A few datasheet facts have a list's hand file as their source: the hand texts and notes on `DATASHEETS` rows, and the Brimstone Horrors
  row (no BSData entry), made from Tzeeeeentch's hand `refs`. The phone has them while those rows are in `DATASHEETS`. Moving them into
  the catalogue hand files needs `notes` and `refs` in `verify/from-bsdata.js`.
- from-json splits a models line by GW's WARGEAR OPTIONS and names a stats row without its ×N where the list has a New Recruit PDF;
  builder.js does neither. No catalogued list needs either today; one that does fails from-json's check.
- The 18 lists of factions with no catalogue keep from-json's reading (and the phone's strict copy) until their catalogue lands.
- Emperor's Chosen and Dread Host (Adeptus Custodes, a catalogued faction) were written from their New Recruit PDFs
  (`verify/sources/nr/*.txt`) and have no export: builder.js never builds them, and neither `verify/reimport.js` nor build-parity P1
  holds them to what builder.js would give an export of the same list. The owner keeps them and has no export for them. What holds them
  is the rest of the gate (nr, bsdata, words and the others, as for every list), and `verify/tables.js` for the abilities their rules
  give (above).

The input formats (`import.js` `parse`): .json; .ros (BattleScribe XML, the same roster); .rosz (it zipped, inflated by the platform);
New Recruit's text format B ("+++ FACTION KEYWORD …") and C ("## Category …"), each name looked up exactly (case, apostrophes and spaces
aside) and any line that is not exactly one thing refusing the import with its line; format A is refused as not supported. A text names no
values, so a text export of a catalogued faction is refused (import its .json, .ros or .rosz).
