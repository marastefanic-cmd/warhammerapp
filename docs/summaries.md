# AI summaries: what the program writes, what the AI writes

The owner's guidelines (rounds 1–13, 4 Nov 2026) are below as given. They split in two, and only one side is AI.

## Program-written (app.html, from the tables; never in an AI column)

- **Which lines exist and on which units**: the program places every line from `BOXES` (their reach), `GRANTS`, the options of a
  rule's boxes (`RULE_OPTIONS` where the rule has them) and the placement of each box. A summary column never decides whether a line
  exists or where it goes. Rules 13 (one line per placement), 14 (the Abilities section is GW's text, no line), 21 (each source its own
  line), 22 (one line per named option: the options are the boxes', not the AI's), 31 (no top block: every line on every sheet it applies
  to), 32 (Deadly Demise and core rules with no weapon or defence effect: their chip, no line), 33 (Shadow in the Warp: the Overview's
  lists only).
- **The placement**: under the weapons (`sumAtk`), When targeted (`sumDef`), under the profile (`sumSt`), the enemy line under the profile
  (`sumFoe`, rules 25 and 34: what a rule does to enemy units near this unit or picked by it), the Overview (`sumOv`, rule 17), and a
  stratagem's line (its `gist`).
- **The line's frame**: "Granted by: <giver>" and its link (rules 10, 24: a leader on the unit it leads; 37: "(enhancement)" after an
  enhancement's giver), "(<ability name>)" and its link, the AI label, "<cp>CP <name>:", a stratagem's phase words (rule 28: built from its
  `phases`, `turn` and `turns`: "in the Fight phase", "in your opponent’s Shooting phase or the Fight phase"), a weapon's name before a
  rule for that one weapon (36), and the order of the lines (40: army-wide rules, the unit's own (its abilities, enhancement, wargear,
  Damaged bands, core abilities), other units' auras and grants, stratagems; GW's order within each).
- **GW's words**: a Damaged band is GW's text as written; the Abilities section is GW's full text; the Damage tab and its Overwatch label
  (41) are the Damage tab's.

## AI-written: the summary columns only

`sumAtk`, `sumDef`, `sumSt`, `sumFoe`, `sumOv` on the row of an ability, enhancement, army or detachment rule, and a stratagem's `gist`:
the effect sentence only, keyed by placement, and, for a source with named options, one "<option> ⇒ <text>" line per option the program
places. Wording rules 1–12, 15, 16, 18–20, 22 (the text of each option line), 23, 27, 29, 30, 35, 38, 39. A summary never repeats what the
program writes: no "Granted by", no "(<its name>)", no CP cost, no stratagem phase, no weapon name where the program prefixes it.

## The gate

`verify/lines.js` LM: every line the program places on a list unit's screens finds its summary for that placement and option (a missing
one fails, naming source, placement, option and list), every summary entry is a line some list shows (a stale one fails), and no summary
holds the program's parts. LN: a summary of a counted box has that box's numbers. `verify/tables.js --fingerprints`: every summary carries
the current fingerprint of the GW text it was written from. `verify/render.js` lines-placed: every placed line is drawn on its sheet;
ai-summary: every AI-labelled text on a sheet is its source's column for that placement, word for word.

---

# AI summary guidelines (owner calibration, 4 Nov 2026)

The summary column is the only AI-written content in the app. Everything around it is placed by the program: which units, where, "Granted by:", the ability name and the links.

## Line layout (program-made)
- Another unit's source: `Granted by: <giver> - <summary> [AI] (<ability name>)`
  - <giver> opens the giver's datasheet.
  - The summary and (<ability name>) open the rule.
- The unit's own source, or an army/detachment rule: `<summary> [AI] (<ability name>)`
- A stratagem on a unit's sheet: `<cp>CP <name>: <summary> [AI]`
- Damaged bands: GW's text as written, no AI (short enough).
- Every rule gets a summary, army rules included (Synapse, Hyper-adaptations, Waaagh!, Martial Mastery). There is no "name only".

## Wording
1. Short gamer shorthand: "vs", "crit on 5+", "+1 to Hit", "+1 AP", "Feel No Pain 6+".
2. Keywords in capitals, as GW prints them: INFANTRY, MOUNTED, BEASTS, TYRANIDS. Weapon abilities in brackets and capitals: [ASSAULT], [LETHAL HITS], [SUSTAINED HITS 1].
3. Keep the conditions that decide whether it applies: ranges ("within 12\" of the Neurolictor"), states (Battle-shocked, Below Half-strength), target keywords, "if it charged this turn".
4. Keep the trigger or the choice the player makes: "Pick a visible enemy at start of Shooting: +1 to Hit vs it"; "Pick one when it fights: [SUSTAINED HITS 1] or [LETHAL HITS]".
5. Keep usage limits: "Once per battle: …", "once per round".
6. Drop when the effect ends ("until the end of the turn/phase") and other fine print: the full rule is one tap away.
7. Give every part of the ability that changes play, joined with ";": "vs INFANTRY/MOUNTED/BEASTS: wounds are crits; heals D3+2 per model killed".
8. Alternative values in brackets: "Feel No Pain 6+ (5+ in Synapse Range)".
9. Stratagems: give the number of units affected when it's more than one: "2 targets, hits crit on 5+".
10. Naming the giver again inside the summary is fine ("within 12\" of Hive Tyrant").
11. Name the state, not one way of reaching it: "if this unit is riled up: [ASSAULT]", not "during a Waaagh!". There are other ways to be riled up. Keep a unit's own extra effects of a state on its own line.
12. Every number and keyword must come from GW's text; no advice, no interpretation. For a box the Damage tab counts, the summary must contain the same numbers.

## Approved examples
- Granted by: Neurolictor - +1 to Wound vs Battle-shocked enemies within 12" of the Neurolictor (Psychological Saboteur)
- Granted by: Psychophage - +1 AP vs one of Psychophage's shooting targets (Bio-stimulus)
- 2CP Adrenal Surge: 2 targets, hits crit on 5+
- When targeted: Enemies within 6": −1 to Hit; also −1 to Wound if they're Below Half-strength (Encephalic Diffusion)
- vs INFANTRY/MOUNTED/BEASTS: wounds are crits; heals D3+2 per model killed (Swallow Whole)
- Once per battle: one attack's Damage becomes 0 (Resilient Organism)
- Granted by: Hive Tyrant - −1CP on a stratagem used on a unit within 12" of Hive Tyrant, once per round (Will of the Hive Mind)
- Granted by: Bloodthirster - +1 to Hit in melee within 6" of Bloodthirster (Daemon Lord of Khorne)
- If it charged this turn: +3 A and +2 S (Might is Right)
- Pick a visible enemy at start of Shooting: +1 to Hit vs it (Marked by Fate)
- Pick one when it fights: [SUSTAINED HITS 1] or [LETHAL HITS] (Martial Mastery)
- Granted by: The Swarmlord - ranged weapons gain [ASSAULT] and [LETHAL HITS] within 6" of The Swarmlord (Onslaught)
- 1CP Rapid Regeneration: Feel No Pain 6+ (5+ in Synapse Range)

## Rounds 5–6 (owner, 4 Nov 2026)
13. One summary per place the rule is shown. Each says only the part that matters there: under melee weapons Synapse is just "In Synapse Range: +1 S"; its Battle-shock part goes where Battle-shock is shown. So a source can have several summaries, one per placement (attack, defence/when targeted, stat, stratagem, overview). Key them by placement.
14. The Abilities section shows GW's full text as it does today, with no summary.
15. Where the app doesn't know a pre-game pick, list every option: "Picked at battle start: vs INFANTRY/SWARM [SUSTAINED HITS 1]; vs MONSTER/VEHICLE [LETHAL HITS]; vs CHARACTER crits get [PRECISION]".
16. Prefer the precise effect to a loose one ("each hit … becomes 1 mortal wound", not "take the hits").
17. Overview lines (deployment, pre-battle) get summaries too.

More approved examples:
- In Synapse Range: +1 S (Synapse), under melee weapons
- Picked at battle start: vs INFANTRY/SWARM [SUSTAINED HITS 1]; vs MONSTER/VEHICLE [LETHAL HITS]; vs CHARACTER crits get [PRECISION] (Hyper-adaptations)
- Granted by: Knight Paladin - if picked in your Command phase: +1 to Hit (Bondsman)
- 1CP Grot Shields: each hit on ORKS INFANTRY within 3" becomes 1 mortal wound on the Gretchin
- Feel No Pain 5+; 4+ for the rest of the battle if damaged at the start of any turn (Adaptive Biology)
- Redeploy up to 3 TYRANIDS units after deployment, Strategic Reserves allowed (Alien Cunning), on the deployment overview
- Re-roll one Hit and one Wound each time it shoots or fights (knight's own re-roll ability)

## Rounds 7–9 (owner, 4 Nov 2026)
18. A bonus switched on during the game is named by its switch, not how you reach it: "If Warp Blades is active: [LETHAL HITS]" (no dice).
19. A pre-game pick the app doesn't know is labelled by its number and name: "If your Quality is 1–2 (martial valour): …".
20. Show every part, even one the profile already marks with +: "+1 OC; ignores Ld modifiers" (Vexilla).
21. Each source gets its own line, even when two lines share a condition: "If this unit is riled up: [ASSAULT] (Waaagh!)" and "If this unit is riled up: [SUSTAINED HITS 1] (Even More Dakka)".
22. Options with names (ka'tahs, Hyper-adaptations, Blessings) get one line each: "If readied, Dacatarai: …", "If Swarming Instincts: …". Unnamed alternatives stay on one line: "Pick one when it fights: [SUSTAINED HITS 1] or [LETHAL HITS]". This supersedes the one-line Hyper-adaptations example.
23. Always write "Hit roll(s)" and "Wound roll(s)", never bare "Hit"/"Wound" ("Wound" also means a hitpoint): "+1 to Wound rolls", "−1 to Hit rolls", "re-roll Hit rolls of 1". This supersedes the bare forms in the earlier examples. These are fine: "vs", slash lists (INFANTRY/MOUNTED/BEASTS), stat letters (+1 S, +3 A, +1 AP, OC, Ld). Write saves in full: "5+ invulnerable save", not "5++".
24. A leader's ability on the unit it leads takes "Granted by: <leader>": "Granted by: Trajann Valoris - re-roll Hit rolls of 1 and Wound rolls of 1 (Captain-General)".
25. A rule that affects enemy units gets an aura line under the profile: "Enemies within 9\": −1 Ld (Deathly Terror)". This is a new placement.
26. A line that would be identical on every unit of a list (same placement, same summary, no giver; e.g. Synapse "+1 S in melee") is shown once in an "ALL <FACTION> UNITS" block at the top of the units screen, not on each sheet. Lines that differ per unit, or that name a giver, stay on the sheets. The Damage tab is unchanged.

More approved examples:
- If Warp Blades is active: [LETHAL HITS] (Blessings of Khorne)
- If your Quality is 1–2 (martial valour): re-roll one Hit roll and one Wound roll each time it shoots or fights (Code Chivalric)
- +1 OC; ignores Ld modifiers (Vexilla), under the profile
- If readied, Dacatarai: re-roll Hit rolls of 1, not vs MONSTER/VEHICLE (Martial Ka'tah)
- If readied, Rendax: [LETHAL HITS] vs MONSTER/VEHICLE (Martial Ka'tah)
- If this unit is riled up: 5+ invulnerable save (Waaagh!), when targeted
- On an objective (it or the target), vs non-MONSTER/VEHICLE: [LETHAL HITS] (Stand Vigil)
- ALL TYRANIDS UNITS: In Synapse Range: +1 S in melee (Synapse)

## Rounds 10–12 (owner, 4 Nov 2026)
27. Your own unit is "this unit" ("this model" where GW says model), never "it". Fix earlier examples: "If this unit charged this turn: +3 A and +2 S"; "re-roll one Hit roll and one Wound roll each time this model shoots or fights". "vs it" for a picked enemy stays.
28. Stratagem lines always name the phase, with whose turn as GW states it: "in the Fight phase", "in your opponent's Shooting phase", "in your opponent's Shooting phase or the Fight phase". The phase matters: it tells you whether you can use it.
29. Conditions come first, then the effect: "Within 6": Feel No Pain 5+ vs mortal wounds and Psychic Attacks".
30. "attacks against this unit get −1 AP" (not "worsen…").
31. **Rule 26 is withdrawn: there is no top block.** Every line is on every sheet it applies to, Synapse too.
32. Core rules with no weapon or defence effect (Deadly Demise) stay as their core-rule chip, with no summary line.
33. Army-wide actions that affect the enemy army, not one unit (Shadow in the Warp), stay only in the overview's lists, with no summary line.
34. Rule 25 (enemy aura line under the profile) covers effects on enemy units near this unit or picked by it: Deathly Terror; Treason of Tzeentch, "If Treason of Tzeentch is picked: one enemy unit within 24" gets [HAZARDOUS] on its ranged weapons in their Shooting phase (Unearthly Power)".

More approved examples:
- 2CP Frenzied Resilience: in the Fight phase, −1 Damage to attacks on this unit
- 1CP Survivor of Strife: in your opponent's Shooting phase, −1 to Wound rolls if the attack's S > this unit's T
- 1CP Armour of Contempt: in your opponent's Shooting phase or the Fight phase, attacks against this unit get −1 AP
- Granted by: Canoptek Spyders - within 6": Feel No Pain 5+ vs mortal wounds and Psychic Attacks (Gloom Prism)
- Feel No Pain 5+ vs mortal wounds (Aegis of the Emperor), when targeted, on every sheet
- Skitarii ranged: If Protector Imperative is active: [HEAVY] and +1 BS (Doctrina Imperatives)
- Skitarii when targeted: If Protector Imperative is active, BATTLELINE or within 6" of one: −1 to Hit rolls vs melee (Doctrina Imperatives)

## Rounds 13–14 (owner, 4 Nov 2026)
35. A switchable ability keeps its cost: "If Daemonic Rage is active (3 BTP): [LANCE] (Blood Tithe)".
36. [program] A rule for one weapon gets the weapon name as a program-made prefix: "Gaping maw: vs INFANTRY/MOUNTED/BEASTS: wounds are crits; heals D3+2 per model killed (Swallow Whole)". The AI text doesn't name the weapon.
37. [program] An enhancement's giver is marked: "Granted by: Daemon Prince of Chaos (enhancement) - within 6": [LANCE] (Slaughterthirst)".
38. A once-per-battle pick reads "once per battle, if used:": "Watcher's Axe: once per battle, if used: +3 A (Moment Shackle)".
39. A plain core-ability grant still gets an AI summary like everything else: "Feel No Pain 6+ (Knights of Legend)".
40. [program] Line order under each placement: army-wide (army and detachment rules) → the unit's own (datasheet abilities, its enhancement, wargear) → auras and grants from other units → stratagems last. Within a group, GW order. This replaces the old footnote order for these lines. Damaged bands go with the unit's own.
41. The Overwatch label stays in the Damage tab's snap-shooting box. It is not part of the summaries (Fire Overwatch: hits only on an unmodified 6, never critical).

More approved examples:
- vs CHARACTER/MONSTER/VEHICLE: +1 to Wound rolls (Slayer of Tyrants)
