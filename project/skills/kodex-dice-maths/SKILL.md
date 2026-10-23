---
name: kodex-dice-maths
description: Works out Warhammer 40,000 (11th edition) attack maths exactly as the Kunnin' Kodex app's Damage tab does - expected hits, wounds, damage, models destroyed, the chance to destroy a unit or at least N models - and other dice odds (charge rolls, saves, Feel No Pain). Use when the player asks how much damage something does, how likely a kill, charge or save is, or which weapon/target/stratagem is better.
---

# Kodex dice maths

The Damage tab's engine is in `scripts/calc.js` (it plays the 11th edition attack sequence out with dice, following Core Rules section 05: hit rolls, wound rolls against each model's Toughness, saves resolved per allocation group, damage one model per attack with excess lost, Feel No Pain per wound, [DEVASTATING WOUNDS] mortal wounds). It is tested against 268 hand-worked cases in the app. `scripts/attack.js` runs it from the command line.

## Steps
1. Work out the inputs from the files: the attacking unit's weapons from kodex-lists.md (values marked "already includes" are final: don't add that bonus again), the target's profile from the player or the files, and which rules apply (ask the player for anything that depends on the table: range, half range, charged, cover, which stratagems).
2. Write the input JSON (format at the top of `scripts/calc.js`; `scripts/attack.js` shows an example) and run `node scripts/attack.js input.json`. One `groups` entry per weapon profile, `n` = models firing it. Keywords go in `kw` as printed ("SUSTAINED HITS 1", "LETHAL HITS", "ANTI-INFANTRY 4+", "TWIN-LINKED", "BLAST", "MELTA 2", "TORRENT", "DEVASTATING WOUNDS", "LANCE", "HEAVY", "RAPID FIRE 1"...). Rules that modify the attack go in `mods` with a `from` naming the rule. Situation in `ctx` (ranged, cover, halfRange, charged, heavy...).
3. If `node` is not available, work it out by hand with the same steps the engine's "Working" prints: attacks × P(hit) (critical hits and their extra hits/auto-wounds separately) × P(wound) × P(fail save) × damage, capped per model; say that model-by-model allocation is approximated.
4. Answer the way the Project's instructions say: the number first ("≈5.6 wounds lost, 5–6 Boyz; 85% to kill at least 4"), then what was counted (each rule, with where it comes from) and what was not. Round to one decimal; give a chance as a percentage.

## Notes
- Check that the first lines and the Working name every rule you meant to count: a keyword the engine did not count is listed as "Keywords not counted" (misspelt, a missing number, or one that changes no numbers).
- The game results (killed, damage) can be a little lower than the Working's exact averages: once the target is destroyed, the remaining attacks count for nothing, and damage beyond a model's wounds is lost. Both are right; report the game results as the outcome.
- The engine applies only what you give it: whether a rule applies is a rules question. Say which rules you counted.
- Compare options by running each and giving both numbers side by side.
- Other odds (charge distance 2D6 ≥ X, a single save) can be computed directly; show the fraction and the percentage.
