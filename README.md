# Kunnin’ Kodex

A phone-first Warhammer 40,000 (11th edition, matched play) reference for the owner's army lists:
**Me shooty yer’ booty** (Orks: Dread Mob, Shoota Boyz, Wreckas) and **Melee** (Orks: War Horde),
2000 pts each. It shows each list's datasheets, stratagems and rules in their official wording, made
searchable, and adds no rule interpretations of its own. The app opens on a picker of the lists
(with more than two lists: filters by faction, detachment and disposition, kept on the phone; Random
rolls one of the lists shown). The gear opens Settings: colour schemes, Keep screen on, install help.
Each list opens on Find, and each tab remembers where it was, per list.

Tabs: **Find** (search; Overview: warlord, enhancements, detachments, the army rules, units that can
Deep Strike, uses per battle, Bases & proxies; Phase checklist: the list's triggered rules, their options and abilities phase by phase (each folded),
your turn and your opponent's, to do, active and once per battle, as `verify/derive.js` reads them from the rules text, with tick boxes
and Reset; the Ranged, Melee and Abilities overviews) · **Units** (the
roster, stats on each unit's line; one datasheet per unit, laid out like New Recruit's: models, stats with
bases, weapons, abilities, rules, stratagems, keywords) · **Stratagems** (every stratagem of the list's
detachments and the core ones, each with a one-line gist, its timing and which of your units can use it) ·
**Rules** (army and detachment rules, and which unit has which core rule, such as Lone Operative, quoting
the ability when it is conditional; general rules are left out) · **Damage** (a damage calculator: one of
your units against one of the opponent's list, picked per list; weapons, the situation and both units'
rules as tick boxes, a rule counting only when every word of its footnote is understood; `calc.js` plays
the 11th edition attack sequence out 10,000 times with seeded dice).

**Rules questions** (the ? in the top bar, once an Anthropic API key is saved in Settings): a chat with
Claude that is sent the Core Rules with their errata and FAQs (`rules/core-rules.md`), the rules this app
holds, your list, the screen it was opened on and the question.
The rules part is cached for an hour. The key stays in that browser on that phone and goes only to
api.anthropic.com; the page holds no key, so the public site cannot use anyone's. `ask-style.md` says how
answers should look (edit it to change them). `ask.js` makes the calls with the official SDK, bundled in
`vendor/` (@anthropic-ai/sdk 0.131.0, MIT), so no third-party script loads at run time.

Older lists (Cooking, Hurrdurr, oioioi, Nidzillas, Purge Freeblade) left the app on 17 Oct 2026; they
are in the git history, and `import-nr.js --reuse` can take their signed-off notes for the same datasheets.

| File | What it is |
|---|---|
| `data.js` | the armies, plus the faction and core rules they use, as tables (`docs/tables.md`): each list's unit entries hold what the list chose and name their datasheet in `DATASHEETS`; `verify/columns.json` says where every column comes from |
| `ask.js`, `ask-style.md`, `vendor/` | the rules-question chat, how its answers should look, and the Anthropic SDK it uses |
| `rules/core-rules.md` | a text copy of the Core Rules with errata and FAQs as Wahapedia publishes them, for the chat (`python3 -I verify/rules-text.py verify/.cache/waha/core.html rules/core-rules.md` refreshes it) |
| `calc.js` | the damage calculator's engine (the attack sequence, section 05 of the Core Rules), checked by the gate like the app |
| `import.js` | the list import: a New Recruit JSON export becomes a list only when every unit, option, enhancement and detachment in it is one data.js already has (by BSData id, from the `BS_IDS` table `verify/import-ids.js` writes into `data.js`); checked by the gate (`verify/import-test.js`) against every export in `verify/sources/nr-json/` |
| `app.html` | the app (published as the Claude artifact as-is, with `data.js`, `calc.js`, `import.js`, `verified.js`, `fonts/`) |
| `build.js` | builds `index.html`, `version.json` and the `sw.js` stamp; refuses unless the gate passed |
| `verify/` | the gate: every fact checked against its source before a build (see below) |
| `verify/tables.js` | the tables: `--write` converts lists written in full (the import's form, or from another branch) into references to `DATASHEETS` and writes `RULE_OPTIONS` / `GRANTS`; the gate checks data.js is in that form, every column has a source, and every AI-written gist / def matches the text it was written from (`docs/tables.md`) |
| `index.html` | generated: `app.html` wrapped as a full page with the home-screen tags |
| `sw.js`, `manifest.webmanifest`, `icon-*.png`, `fonts/` | home-screen install and offline support (Atkinson Hyperlegible Next for text and Barlow Condensed for headings and numbers, both OFL) |
| logo | the riveted KK plate: `icon-*.png` for the home screen, and drawn in `app.html` for the home header (in the picked colour scheme) |
| icons | in `app.html`: the tabs and rows (clipboard-list, list-checks, users, zap, scroll, telescope, swords, hourglass), the settings gear and the dice from [Lucide](https://lucide.dev) (ISC License, notice next to them) |
| `verified.js` | generated by the gate: what was checked, shown in the app under "Checked" |

## Adding or updating a list

The facts come from New Recruit, never typed by hand:

1. In New Recruit, export the list as PDF. Then
   `pdftotext -layout list.pdf verify/sources/nr/<id>.txt` and note the PDF's sha256 in
   `verify/sources/README.md`.
2. `sh verify/fetch.sh` (BSData, GW's documents, Wahapedia pages; cached in `verify/.cache`).
3. `node verify/import-nr.js verify/sources/nr/<id>.txt <id> --write` puts the army into `data.js`:
   every unit, model, wargear line, stat, weapon profile, ability, keyword, rule and points value
   from the PDF, with the rules wording (bold keywords, bullets) taken from Wahapedia's datasheet
   and matched word for word to New Recruit's. Updating a list that is already in `data.js` keeps
   the unit ids and every hand-written part (phase tags, weapon footnotes) of what hasn't changed.
   A datasheet that another list (or an older data.js, `--reuse <file>`) already has lends its signed-off
   phase tags and footnotes where the words are the same. Units with two characters attached (a
   Warboss leading and a Bigboss supporting the same Breaka Boyz) are one unit. With `--write` it also
   writes the "+" marks from BSData, and makes the list's units references to their datasheets (`verify/tables.js
   --write`: a datasheet another list has is shared). It lists what it cannot know in `verify/out/import-<id>.md`.
4. Write those parts: phase tags, weapon footnotes (`mods`) and auras, a missing detachment or
   rule (from Wahapedia/GW), stratagem gists. That is the only part that needs judgement. An ability's tags and
   "When targeted" line go on its datasheet's row in `DATASHEETS`; footnotes and auras on the row of the rule they read
   (`docs/tables.md`, Readings: write them on the unit in the old form, `node verify/tables.js --expand`, then `--write`
   moves each to its row). A new gist, def or reading: `node verify/tables.js --stamp` (after checking it against its
   text) records the fingerprint of the text it was written or read from.
5. `node verify/run.js` until it passes. It checks the list against the PDF, BSData and GW's texts;
   renders every screen at 390 and 320px; shows any screen change (accept with `--accept` after
   reading the diff); and lists every judgement the app adds that has no sign-off yet. Those are
   reviewed (`verify/review/`, then `node verify/approve.js verify/review/result-<name>.json`).
6. `node verify/import-ids.js --write` (the BSData ids the in-app import resolves exports by) and `node verify/derive.js --write` (the Phase checklist table, CHECKLIST: the gate fails while it is out of date). Bump `VERSION` in `data.js`, `node build.js`, commit and push; republish the artifact.

The New Recruit PDF (not the copy-paste text export) is the input on purpose: it names every models line
with its wargear, and it is New Recruit's own calculation from BSData, which the gate compares with its
own (verify/bsdata.js), so a mistake in either shows.

`node verify/import-nr.js <txt> <id> --fresh` followed by `node verify/import-diff.js
verify/out/import-<id>.js <id>` shows what a clean import and `data.js` disagree on (for both lists:
nothing but bold/italic placement and two New Recruit typos recorded in verify/deviations-nr.json).

## Home-screen install

GitHub Pages serves this repo at `https://marastefanic-cmd.github.io/warhammerapp/`
(Settings → Pages → Deploy from a branch → `main`, `/ (root)`). Open that URL in Safari →
Share → Add to Home Screen. The installed app fetches the newest version every time it opens
(network-first service worker, plus a `version.json` check when it comes back to the
foreground), so it never needs reinstalling.

## Where the text comes from

- Units, weapons, abilities, points: the New Recruit PDF, checked against BSData (wh40k-11e),
  the community data New Recruit is built from.
- Base sizes: as the New Recruit PDF prints them (the owner's rule, 18 Oct 2026), also where GW's
  base size guide lists another size for a model.
- Rules wording: Games Workshop's newest official documents (Core Rules, Universal Rules
  Updates), or Wahapedia where GW has published none yet (the Orks pages).
- The app's own aids (gists, footnotes, phase tags, which units a stratagem fits) are each read
  against the rule they rest on and signed off; a changed rule voids its sign-off.
