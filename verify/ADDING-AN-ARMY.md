# Adding a list

The app states facts only from sources, and every judgement it adds (a phase tag, a footnote under the
weapons, which units a stratagem is for) is signed off by a reviewer who did not write it. Adding a list
keeps both promises. Nothing reaches the app until `node verify/run.js` passes; `build.js` refuses
otherwise.

## 1. One command

```
node verify/add-army.js "<list> - New Recruit.pdf"          # --dry to see what it would do
```

It makes `verify/sources/nr/<id>.txt` (the PDF's text) and its sha256 row in `verify/sources/README.md`,
adds the faction to `verify/sources/factions.json` if it is new, downloads what is missing
(`verify/fetch.sh`), and imports the list into `data.js` with `verify/import-nr.js`: every fact from the
PDF, ability wording from the Wahapedia datasheets (fetched for new units), and the signed-off
hand-written parts of the same datasheet in any other list, current or earlier
(`verify/sources/donors.txt`). It stops when `data.js` lacks the faction or a detachment (section 2).

It leaves two lists:
- `verify/out/import-<id>.md`: what the import cannot know (section 3)
- `verify/review/todo-<id>.json`: the list's judgements nobody has signed off yet (section 5)

Running it again with a newer export of the same list rebuilds it and keeps everything unchanged.

## 1b. From a New Recruit JSON export instead

```
node verify/from-json.js verify/sources/nr-json/<id>.json <id> --write     # without --write: verify/out/from-json-<id>.js
node verify/from-json.js verify/sources/nr-json/<id>.json <id> --compare   # a list data.js has: what the reading differs in
```

Every unit from the export's selections (found by BSData id, each profile looked up in BSData at the pin, a unit from another
faction's catalogue too: the Deathwatch's), checked against Wahapedia's datasheet (the codex; for a Space Marines Chapter, the
Chapter's view of the page, `wahaChapter` in `verify/sources/factions.json`): where BSData differs, GW's value is written and declared
in `verify/deviations-*.json` with the datasheet as evidence; base sizes come from GW's base size guide (`verify/base-guide.js`,
the Event Companion; the sections `baseGuide` names, a row for some models of a unit too), Wahapedia's only where the guide has
none (the gate's `bases` step, `verify/bases.js`, checks every base against the guide; a unit the guide names
otherwise or lacks is declared in `verify/deviations-bases.json`). A missing faction or detachment comes from the Wahapedia faction page (a detachment's Force Dispositions from BSData, else
from the page, declared), a missing core ability from Wahapedia's core rules, labels from `verify/derive.js`; then the "+" marks,
`BS_IDS`, the BSData extract and `verify/tables.js --write` (the list as references to its datasheets). What it cannot fill (a
stratagem's gist) is read from `verify/sources/hand/<id>.json`, marked by whom; everything else it lists in
`verify/out/from-json-<id>.md`. A list without a PDF is checked by `verify/nr.js` against its export (base sizes).

The hand pass (section 3) goes into the same file, so a re-run gives the same data.js: `gists` (a stratagem's `gist`, `def` with
their fingerprints `gistOf` / `defOf`, and `mod`), `rules` (a detachment rule's `calcMods`), `readings` (the readings by the row they
read: `datasheets` by name, `rules`, `enhancements`, each `{ mods, aura, guard }` in its order, each reading with its `readOf`;
a datasheet not there gets data.js's row, else what verify/derive.js derives from its words) and `units` (per unit entry: `defs`
for its abilities, its own `mods` / `aura` / `guard` (or, where it shows its rows' readings in another order, its whole list with
their names), and `stats` values a rule of the list gives that the export does not show). A new AI-written line or reading gets
its fingerprint from `node verify/tables.js --stamp` (after checking it against its text), copied into the file.
The run ends with `verify/tables.js --write`, `--expand` and `--write` again.

## 2. A new faction or detachment

Transcribe from the GW Faction Pack when the faction has one (its Rules Updates win over the codex text),
else from the Wahapedia faction page (`verify/.cache/waha/<faction>.html`, text in `<faction>.txt`). Follow an
existing faction in `data.js` (e.g. `tyranids`):

- `armyRules`: `{ name, text, tag?, ph?, turn?, at?, remind? }`
- a detachment `'<id>': { name, dp, rule:{ name, text, needs? }, enhancements:[{ name, pts, text, upgrade? }], stratagems:[…] }`
  (`nr`: an enhancement's name as New Recruit and BSData spell it, where it differs from GW's: "Incandeum" for "Incandaeum")
- a stratagem `{ id, gist, name, cp, phases, turn, needs, when, target, effect, mod?, def?, note? }`
  - `when` / `target` / `effect`: the printed words, with the markup the app uses (`**bold**` for keywords
    and rules terms as Wahapedia bolds them, `- ` bullets)
  - `phases` / `turn`: the phases and turn its WHEN names ("Any phase" = all five, either turn)
  - `needs`: its TARGET as keywords, `{ all:[…], any:[…], none:[…], attached? }` (keywords as the units'
    `kw` spell them, e.g. 'Faction: World Eaters', 'Infantry'); the app shows the stratagem on every unit
    whose keywords match, so this is the one judgement that decides who can use it
  - `gist`: one line, the effect in its own words shortened, nothing added
  - `mod` / `def`: a footnote under the weapons / a "When targeted" line, on every unit that can use it

Then `node verify/texts.js`: every word must match the source (or be a declared deviation, section 4).
Add the faction's catalogue and pack to `verify/sources/factions.json` if `add-army.js` has not.

## 3. What the import cannot know

Each line of `import-<id>.md`, written in `data.js` (field reference above `ARMIES`; `docs/tables.md`): an ability's
`ph` / `turn` / `turns` / `def` / `tag` / `who` on its datasheet's row in `DATASHEETS` (every list with that datasheet
shows them), `na`, `kwNote`, `ptsNote` on the list's entry in `ARMIES`; `mods`, `aura`, `guard` on the row of the rule
they read (`docs/tables.md`, Readings: write them on the unit in the old form and `--write` moves them). Or write them in
the list's block in the old form (`node verify/tables.js --expand`, edit, `node verify/tables.js --write`). A new `gist`,
`def` or reading: `node verify/tables.js --stamp` after checking it against its text (its fingerprint). (The gate step
`readings` lists an ability whose words give a bonus under a condition and that has no reading.) The fields:

- `ph` / `turn` / `turns`: the phase(s) and turn an ability's words name ("In your Shooting phase" →
  `ph:['shooting'], turn:'your'`). No phase words and no moment: leave it untagged.
- `mods`: an ability that changes this unit's attacks becomes a footnote under its weapons,
  `{ kind:'ranged'|'melee'|'all', when, note, from }`: `when` the condition and `note` the effect, both in
  the rule's own words shortened ("+1 to hit rolls"); `weapon` when it is about one weapon only.
- `aura`: what this unit gives other units, `{ kind, needs, when, note, from, notSelf?, selfWhen? }`.
- `def`: a "When targeted" line, for an ability that protects the unit ("4+ InSv against ranged attacks").
- `na`: why a rule does nothing in this list ("No VEHICLE in this list"), only when that is certain.
- a `tag` the PDF prints ("Once per battle, per unit"), a `who` for which model has it, `kwNote` /
  `ptsNote` for keywords and points that come from an attached unit.

Quote, don't interpret: a footnote says what the rule says, shorter, and nothing the rule does not.
When a rule could be read two ways, show it as printed and mark it; never pick one.

## 4. When a check fails

`node verify/run.js` runs every check. A failure is either a mistake to fix (in `data.js`, or in a
parser in `verify/` when the PDF or BSData is read wrongly) or a real difference between sources, which
is declared in `verify/deviations-<check>.json` with the exact failure fields plus `reason` and `evidence`
(file, line, the words). A declared deviation nothing matches any more fails too.

## 5. Sign-off

`todo-<id>.json` goes to a reviewer who did not write the judgements. They check each item against its
source and write `verify/review/result-<name>.json`: `[{ key, where, verdict:'ok'|'needs-change'|'unclear', why }]`.
`node verify/approve.js verify/review/result-<name>.json` records the ok ones in `verify/approvals.json`.
An approval is keyed on the judgement and its source text together, so it carries over to any list that
makes the same judgement on the same words, and changing either voids it.
`node verify/helpers.js --prune` drops approvals nothing uses.

## 6. Screens and shipping

`node verify/run.js` renders every screen at 390 and 320 px. Read the snapshot diff
(`git diff --no-index verify/snapshots verify/out/snapshots`), then `node verify/run.js --accept`.
Bump `VERSION` in `data.js`, `node build.js`, commit, push; republish the artifact.

## Working on several lists at once

One gate run per folder (`run.js` takes a lock). For parallel work, give each list its own git worktree
(`git worktree add ../wt-<id>`, link `verify/.cache` from the main folder), keep only that list there
(`node verify/army-blocks.js keep shooty,melee,<id>`), and bring it back with
`node verify/army-blocks.js merge ../wt-<id> <id>`, which copies the list's block and its deviations and
names anything else that changed (parser code, glossary, factions) to bring over by hand.
