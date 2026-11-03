> **Isolation.** This copy in `verify/reader2/` is release tooling of the two-reader rule (`verify/agree.js`, gate step `agree`). It must
> never import the app's reading code (`verify/effects-extract.js`, `effects-migrate.js`, `coverage.js`, `evidence.js`, `lines.js`,
> `defence.js`, `derive.js`) nor read `data.js` BOXES: the gate fails if it does (check R1). The code is kept as written; run it with
> `KODEX_APP=<repo> KODEX_CACHE=<repo>/verify/.cache` (the gate does). `vocab.js` and `show.js` (dev tools) are not copied.

# reader2: an independent second reader of the rules text

`reader2.js` reads every rule sentence the app uses and writes a structured reading of each one. A misreading in the
app would then need two independent implementations to make the same mistake.

## Isolation

The reader was written using only these:

- **GW's text:** the Wahapedia caches (`verify/.cache/waha/*.txt`, `ds/*.html`), the GW Faction Packs and the Core
  Rules in `verify/.cache/gw/`. The Core Rules supplied the definitions: critical hits and wounds as unmodified rolls,
  Feel No Pain, InSv, auras, snap shooting, attached units and Leader, and "+1 BS" meaning an improved BS.
- **`data.js`, loaded in node:** only names, keywords and the text fields (`text`, `when`, `target`, `effect`,
  `restrictions`, `tag`, `who`). It never reads `BOXES`, `GRANTS`, `CHECKLIST`, `gist*`, `readOf` or any derived column.
- **The effect vocabulary of `effects.js`:** the ids, labels and value shapes of `FX`, `COND`, `DF`, `DCOND`, `ST`,
  `STCOND` and `NC`. `vocab.js` dumped them; it prints labels and never the `pats`. No matching code was read.

The app's readings, and anything in `scratchpad/reader-cmp/`, were never looked at.

## Files

| file | what |
|---|---|
| `reader2.js` | the reader (plain node, no network, deterministic) |
| `sources.js` | lists the rule sources from `data.js`, plus the keywords printed on the datasheets |
| `test.js` | 97 checks: 11 factions, the tricky forms, and every error the GW reviews found |
| `readings2.json` | the readings, keyed `owner|source name|sentence index` |
| `vocab.js` | prints the vocabulary's ids and labels, without patterns |

```
node reader2.js            # write readings2.json and print coverage
node reader2.js --test     # unit tests
node reader2.js --check    # release check: exit 1 if readings2.json no longer matches the sources + reader
node reader2.js --say "…"  # read one sentence
```

## Sources

There are 1,261 sources and 2,478 sentences:

| source kind | count | key |
|---|---|---|
| datasheet abilities | 631 | `ds:<faction>/<sheet>` |
| list-unit abilities whose words are on no datasheet (enhancements and upgrades) | 61 | `army:<list>/<unit>` |
| army rules | 29 | `faction:<id>` |
| detachment rules | 63 | `det:<faction>/<detachment>` |
| enhancements | 173 | `det:<faction>/<detachment>` |
| stratagems | 263 | `det:<faction>/<detachment>`; core stratagems use `core` |
| rows of rule tables (a source of their own) | 41 | the rule's owner; name `Rule › row label` |

A stratagem's EFFECT is split into sentences. Its WHEN and TARGET are read as context:

- the phase and turn become a `phase` condition;
- the full WHEN is kept as a `when` condition;
- "selected to shoot" / "selected to fight" makes the attacks ranged or melee;
- TARGET restricts what "your unit" means. It is parsed into `targetKw`, `targetExcluding` and `targetQualifier`, or
  kept as `targetText` when it can't be parsed.

**Is the app's text GW's text?** Each sentence was looked up in the cached GW/Wahapedia text, ignoring bold, punctuation
and case:

| result | sentences |
|---|---|
| found | 2,342 |
| not found | 48 |
| too short to check | 88 |

Most of the not-found are formatting differences, such as Leader tables and how the Knight datasheet pages print their
invulnerable saves.

## Method

### 1. Normalise
- Struck-through words (`~~MONSTER~~`) are errata deletions, so they are removed.
- `[ABILITY]` becomes an ability token.
- Runs of capitalised words become keyword tokens. A run is split into keywords using the datasheets' own keyword lines,
  so `WORLD EATERS` stays one keyword and `TYRANIDS MONSTER` becomes two.
- A known keyword written in Title Case before "unit" or "model" is treated as that keyword ("War Dog model").

### 2. Find the structure
- **Headings:** an ALL-CAPS line ("DEVASTATOR DOCTRINE") or a bold-only line ("Boon of Blood [4BTP]") names a section.
- **Sub-abilities:** `**Name:** text` or `Name (Aura): text` names a sub-ability.
- **Lead-ins:** a line ending ":" leads the bullets after it, and so does a bullet ending ":" (a nested list).
- **Alternatives:** the bullets of a group that contains an "Or:" bullet are alternatives. So are an "Or:" or "+1CP Or:"
  line and the sentence before it.
- **How each lead-in is used:**
  - joined to each bullet ("X's attacks can:" or a condition);
  - an option list ("select one of the following");
  - a selection ("select one enemy unit:"), which is read first;
  - "If you do:", which adds `used`;
  - a dice table ("roll one D6:"): bullets that start "On a N+" get a `roll` condition;
  - anything else ("if any of the following apply"): its bullets stay unread.
- **Inline dice tables** ("… roll one D6: on a 2-5, …; on a 6, …") give one `outcomes` entry per result. Every result
  must read, or the whole sentence is unread.

### 3. Read each sentence, left to right
1. **Conditions and durations at the front:** while / if clauses, phases, timings, triggers, "the first time …",
   once-per limits, "if it does / you do", auras (with or, "/" and "(excluding …)"), "while … is within range of an
   objective", "while this model is leading a X unit", "while this unit's Szarekh model has 1-6 wounds remaining".
2. **Then one or more clauses**, in the shapes GW uses:
   - "each time … makes an attack …, <effects>";
   - "X's attacks have / can …";
   - defence: "attacks that target X have -1 …", "each time an attack targets / is allocated to X";
   - weapon abilities, including "[X: non-MONSTER/VEHICLE]", which is kept as an effect's `only`;
   - characteristic changes, including "halve the Attacks" (NC `halveA`) and set values ("an Objective Control
     characteristic of 15" → `SET OC 15`; a BS or A value → FX `bsSet` / `aSet`);
   - "a successful Hit roll scores a Critical Hit" (NC `everyCrit`);
   - "has" (InSv, every FNP variant, Stealth, Lone Operative, cover, OC, M, T).
3. **Then a duration or condition at the end.**

Anything left over makes the sentence unread. A partly read sentence is also unread; what was read is kept under
`partial`.

### 4. Referents carry what they came with
- "that unit", "that enemy unit", "that model", "it" and "its" resolve only from an earlier sentence of the same source:
  a selection, an aura, a leading clause, or the last subject.
- When a later sentence uses such a referent, it takes on the conditions that held when the referent was set (`leading`,
  `aura`, the selection's timing).
- Attacks against a selected unit add a `selected` condition that describes the selection: its keywords and qualifiers
  such as "visible" or "hit by those attacks".
- "your X unit" in a stratagem resolves to the unit selected earlier when its keywords match that selection and not the
  TARGET. If it could be either, the sentence is unread.
- A continuation sentence ("… as well", "… instead") keeps all of the previous attack's conditions, its attack kind and
  its duration.

### 5. Choices and restrictions travel through the whole source
- **Choices.** A sentence that opens a choice among effects ("select one of the following", "… listed below",
  "abilities in the X section", "activate one of", "select one X ability") makes every later effect in the source name
  its option. The option comes from the section heading, the sub-ability, the bullet or the Or-group.
  - An effect whose option can't be told is unread.
  - The options are read only if the choice's own sentence reads. Its timing, cost and duration then pass to each
    option.
  - Unread sentences between the choice and its first option are kept verbatim as `choiceTerms`.
- **Choices made by another ability.** When another ability of the same datasheet picks among abilities ("select one
  Wrathful Presence ability", with sub-abilities listed under "Wrathful Presence: pick one"), the picked abilities get
  `opt` plus the picking ability's text.
- **Restrictions.** "X units only." / "X model only (excluding Y)." becomes an `onlyFor` condition on every later effect
  in the same section.

### 6. Rule tables, core stratagems and the remaining shapes (round 3)
- **Rule tables** (the `table` of an army or detachment rule: Try Dat Button!, Code Chivalric, Blessings of Khorne,
  Cabal of Sorcerers, Kindred Sorcery, Doctrina Imperatives, Pledges to the Dark Prince, Harbingers of Dread, Martial
  Ka'tah). Each row is a source of its own, and its label becomes the row's condition:
  - "1–2" → a `roll` result;
  - "5+" → a `tableThreshold` (Pact points);
  - "Name · double 4+ or triple 1+" → `opt` and `cost`;
  - "Name · Warp Charge 7" → `opt` and a passed Psychic `test` of 7+;
  - "Deed/Quality 1–2" → `opt` and `roll`.

  Every row also carries `table` (rule and row) and `tableTerms` (the rule's own words, verbatim). The rule's stated
  duration becomes the row's when the rule states exactly one; otherwise all of them are kept in `tableDurations`. A
  row that finishes a lead-in of the rule ("This unit's attacks have the relevant rule(s):" + "+1 A") is joined to it.
  Ka'tah rows are read as stratagems (WHEN / TARGET / EFFECT).
- **Core stratagems.**
  - Command Re-roll is read as `oneAny`, limited to the hit, wound and damage rolls its WHEN lists; the other rolls
    (advance, charge, hazard, save, number of attacks) are listed in `alsoOutsideVocabulary`.
  - Epic Challenge: the selected CHARACTER model's melee weapons get [PRECISION].
  - Smokescreen: the Benefit of Cover for the SMOKE unit and the units it makes not fully visible.
  - Fire Overwatch (snap shooting), Grenade, Crushing Impact, Counteroffensive (Fights First), Heroic Intervention,
    Insane Bravery and Rapid Ingress are outside the vocabulary, each with its own reason.
- **Shapes.**
  - **"if any of the following apply":** each bullet becomes one alternative of a COND `anyOf`.
  - **"(if …, … instead)":** read as `alternatives`, with the main sentence's conditions plus its own.
  - **"if that test is passed/failed"** and **"if the Psychic test result … was 10+":** a `test` condition.
  - **Long triggers** ("each time an enemy unit (excluding …) within Engagement Range of … is selected to fight", "each
    time an enemy unit within 18" of this model targets this model", "when a friendly X/Y/Z unit is selected to shoot"):
    a structured `trigger`, and the triggering unit becomes the referent.
  - **"if the X ability / doctrine / imperative is active":** an `abilityActive` condition.
- **Referents.**
  - Selections keep every qualifier: visible, battle-shocked, within N", within Engagement Range, hit by those attacks
    or that weapon, (excluding …), equal to or less than the battle round number.
  - In a stratagem with no selection, "that unit" is its TARGET and "that enemy unit" is the one its WHEN names.
  - A selection the reader can't read clears every older referent, so no later "that unit" can point at the wrong
    unit.
- **Durations.** Every duration GW states is kept: at the front, at the end, "until that enemy unit has attacked",
  durations from option lead-ins, and the stated durations of rule tables.
- **One sentence, two reaches.** In the Silent King's Damaged profile, the halved Attacks belong to the Szarekh model
  and the -1 to Hit to the whole unit. When a sentence's effects go to different units, each effect has its own
  `reach`.
- **Slash keywords.** "INFANTRY/MOUNTED THOUSAND SONS PSYKER" is read as (INFANTRY or MOUNTED) and THOUSAND SONS and
  PSYKER.

### 7. Round 4
- **The Silent King.** When one sentence's effects go to different units, each effect has its own `reach` and
  `reachPerEffect: true` is set. The sentence's top-level `reach` is the reach of its counted effects (FX/DF/ST) when
  they share one. In the Silent King's Damaged profile that is the unit (the -1 to Hit); only `halveA` is on the
  Szarekh model.
- **"unless X"** is read as X, negated: `negated: true` on the condition, or the vocabulary's opposite where one exists
  (Battle-shocked → `notShocked`, below Half-strength → `targetNotBelowHalf`). It can stand at the front, mid-sentence
  or at the end. The self-check accepts "unless" only when a negated condition is in the reading.
- **Re-roll lists** ("re-roll one Hit roll, one Wound roll, … or one saving throw made for the bearer"): the hit, wound
  and damage rolls become `oneAny` / `oneEither` / `oneHit` / …; the other rolls are listed in `alsoOutsideVocabulary`.
- **"If they do, change the Damage characteristic of that attack to 0"** after "when a saving throw made for a friendly
  X model within 12" of the bearer is failed": DF `dmg0` for those models, with `failedSave`, the aura and the
  activation's own limits (once per battle round).
- **Faction mechanics as named conditions**, keeping GW's words:
  - `factionState` ("within your army's Shadow of Chaos", readied, Empowered, aflame, disrupted, …);
  - `targetState` ("a dreadful foe unit", "a prosecuted unit");
  - `grantsState` ("that unit is within your army's Shadow of Chaos");
  - `grantsAbility` (Bondsman: "that ARMIGER model is affected by that Bondsman ability").
- **Choices with unusual terms.**
  - "While a unit is Empowered it can use one of the … abilities below" opens a choice that has a `factionState`.
  - "select either the [A] or [B] ability" followed by "… have the selected ability" gives `options` [A, B].
  - Every option of a choice now carries all of the source's unread terms in `choiceTerms`, whether they come before or
    after the options.
- **Ignoring modifiers** uses ids of this reader's own wherever the vocabulary's `ignoreHitMods` ("BS/WS and the Hit
  roll") would say more than GW: `ignoreSkillMods` (BS/WS only), `ignoreHitRollMods` (hit rolls only) and
  `ignoreWoundMods` (wound rolls), all under `table: "own"`. `ignoreHitMods` is used only when GW names both the skill
  and the hit roll.
- **Referents.**
  - A stratagem TARGET of "…, and one enemy unit within 24" …" gives "that enemy unit".
  - "LEGIO CYBERNETICA units from your army … unless that unit …" is read distributively.
  - Bondsman's "for each one that does, select …" (its parenthetical is kept as a qualifier).
  - Warpmeld Sacrifice's trigger names the units "it" means.
  - "while a friendly X unit is below its Starting Strength, that unit's …".
- **Bug found and fixed:** "Once per battle round" had been read as "once per battle" (in the text, and in tags such as
  "Once per battle round, per army"). It is now `oncePer: "battle round"`.

### 8. Self-check: never looser than the sentence
Every effect reading must carry the sentence's:

- keywords;
- numbers;
- negations ("not", "cannot", "no");
- condition openers (`while` / `if` / `the first time` / `once per`, counted against the conditions).

It is also refused when:

- the sentence has "unless" or "only" inside an effect;
- the sentence has "either", or "or" between two effects, and there is no option.

A reading that fails any of these is turned into `unread`, with the reason.

## A reading

```json
{ "status":"read", "kind":"effect",
  "effects":[{ "table":"FX", "id":"rrWound1", "v":true, "attack":"any" }],
  "attack":"any", "side":"attack",
  "reach":{ "type":"friendly", "kw":{ "any":["HERETIC ASTARTES"] }, "unitsOrModels":"models" },
  "conditions":[{ "id":"targetSelected", "table":"COND" },
                { "id":"timing", "v":"start of your shooting phase", "table":"own" },
                { "id":"selected", "v":{ "type":"selectedEnemy", "kw":{ "any":["VEHICLE"] }, "qualifiers":["visible"] }, "table":"own" }],
  "duration":"end of the phase", "gw":"found" }
```

**`effects[]`**
- `table` is FX (attack), DF (defence), ST (characteristic), NC (not counted: `halveA`, `everyCrit`) or SET
  (a characteristic set to a value; the vocabulary has no id for these).
- Each effect has `id` and `v`, plus `attack` when it applies to attacks, and `only` when the effect itself is
  restricted.
- A pick among weapon abilities goes under `options`; a dice table under `outcomes`.

**`attack`:** ranged, melee, psychic or any. **`side`:** attack, defence, stat or mixed. **`debuff: true`** when the
reach is an enemy unit.

**`reach.type`** is one of:
- `self`, `unit`, `bearer`, `bearerUnit`;
- `ledUnit`, `leaderModel`, `models`;
- `aura` (with `range`, `of`, `kw`, `excluding`, `other`);
- `friendly`, `army`;
- `selected`, `selectedEnemy`, `enemyAura`, `anyAttacker`;
- `affectedModel`, `riledUnit`, `objective`.

Keyword expressions are `{any:[…]}` or `{all:[…]}`. For a stratagem, `reach.target*` is the TARGET line.

**`conditions[]`:** `table` says whose id it is.
- COND, DCOND and STCOND ids are the vocabulary's own.
- `own` ids are this reader's, for conditions the vocabulary has no id for. These include: phase, timing, trigger,
  firstTime, when, roll, selected, onlyFor, choice, choiceTerms, cost, leadingKw, woundsRemaining, weapon,
  weaponExcluding, targetTGreater, targetWithin, onSelectedObjective, usingAbility, affectedByThisAbility and synapse.

**`kind`** for read sentences with no effect of their own: restriction, heading, leadIn, select, optionPick,
grantsSelected, activation, leader, listBuilding, note.

## Coverage

| | round 1 | round 2 | round 3 | now |
|---|---|---|---|---|
| sentences | 2,413 | 2,415 | 2,478 | 2,478 |
| read, with effects | 520 | 538 | 604 | **633** |
| read, no effect of their own | 498 | 581 | 620 | 641 |
| unread: outside the vocabulary | 1,001 | 939 | 945 | 934 |
| unread: not parsed | 394 | 357 | 309 | **270** |

The 270 unparsed break down as follows:

| reason | sentences |
|---|---|
| the grammar can't read it | 260 |
| refused by the self-check | 5 |
| an option of a choice whose terms can't be read | 5 |
| "that unit" with nothing it can refer to | 0 |

By source kind:

| source kind | read with effects | all read | outside | unparsed |
|---|---|---|---|---|
| abilities | 316 | 506 | 396 | 86 |
| list-unit abilities | 45 | 115 | 29 | 5 |
| army rules | 6 | 51 | 82 | 20 |
| detachment rules | 42 | 113 | 92 | 54 |
| enhancements | 87 | 297 | 126 | 30 |
| stratagems | 106 | 154 | 189 | 70 |
| rule-table rows | 31 | 38 | 20 | 5 |

Of the 698 sentences that use the vocabulary's words, 575 are read, 111 are not parsed and 12 are outside the
vocabulary.

## Errors found by the GW review, and their fixes

| case | was | now |
|---|---|---|
| Blood Tithe, Synaptic Imperatives, Combat Doctrines | options read as always on | each effect carries `opt` (its heading or sub-ability), `choice`, and the choice's cost, timing and duration |
| Angron's Wrathful Presence | picked abilities read as always on | `opt` and the picking ability's text, found from the datasheet's "pick one" group |
| Malefic Surge | 5+ InSv and FNP 6+ always on | unread: the choice's terms ("Empowered") can't be read |
| Anathema Blademastery | always on | option 1 of 2 / option 2 of 2 |
| Gilded Guardians | always on | the "Additional Effect" (favoured ka'tah) is unread; the struck-out MONSTER is no longer excluded |
| Daemonic Fury | [LANCE] went to the stratagem's target | [LANCE] goes to the selected WORLD EATERS unit |
| Spirit Thief | lost VEHICLE | `selected` carries VEHICLE, visible and the timing |
| Warp-sighted Butcher, Macro-extinction Protocols | lost "while leading", the target keywords and melee | the second sentence keeps the first one's conditions and attack kind |
| First Prince of Chaos | lost "SHADOW LEGION TZEENTCH units only" | `onlyFor` on every effect in the section |
| The Silent King, Damaged (rounds 3–4; narrower than GW) | the -1 to Hit was put on the Szarekh model | each effect has its own reach, and the sentence's `reach` is the unit (the counted -1 to Hit); only `halveA` is on the Szarekh model |
| "Once per battle round" (found in round 4) | read as once per battle | `oncePer: "battle round"` |

## Known limits (where to expect weakness)

- **Recall.** 111 of the 698 sentences that use effect words are still not parsed. Most are:
  - weapon profiles printed inside rules;
  - sentences about the enemy's targeting ("can only be selected as the target … if", "does not suffer the penalty …");
  - Leadership and OC changes mixed with vocabulary effects in one sentence;
  - test tables where a row is outside the vocabulary;
  - "cannot have the Benefit of Cover" without a referent;
  - Flux-token and Hyper-adaptation rules;
  - bullets of a lead-in that is itself unread.
- **Strict choices.** Terms of a choice are attached verbatim (`choiceTerms`), not structured.
- **Distributive referents.** "that unit" after a plural subject ("X units from your army") is read as each of those
  units. This is the only case where "that unit" resolves without a selection, aura, leading clause or TARGET.
- **Own ids.** `ignoreSkillMods`, `ignoreHitRollMods` and `ignoreWoundMods` have no vocabulary id. Where the app uses
  `ignoreHitMods` for "ignore modifiers to hit rolls", the two readers will differ, on purpose: GW's words do not
  include BS there.
- **The self-check is a heuristic.** It catches dropped keywords, numbers, negations, condition openers, "unless" and
  "or"/"either", but not a wrong scope that uses the same words.
- **Free-text conditions.** `firstTime`, `timing`, `when`, `tableTerms`, `choiceTerms`, `factionState` and
  `targetState` keep GW's words.
- **Attack kind from the Fight phase.** The Fight phase alone does not make attacks melee.
- **GW match.** The Faction Pack PDF text is in columns, so a sentence found only in a PDF can show as not found.
