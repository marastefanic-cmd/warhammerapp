// verify/calc-test.js: the damage calculator's engine (calc.js) against values worked out by hand from the
// Core Rules (11th edition). The engine plays the dice out, so each average must land within a small margin.
//   node verify/calc-test.js
const C = require('../calc.js');
const big = (n, W, Sv, extra) => Object.assign({ name:'m', count:n, W, Sv:Sv || 7 }, extra || {});
const run = (groups, target, ctx) => C.run({ groups, target, ctx:ctx || {}, sims:20000, seed:11 });
const g = (o) => Object.assign({ name:'w', n:1, A:'1', skill:'4+', S:4, AP:0, D:1, kw:[] }, o);
const cases = [
  // 20 bolter shots, BS 3+, S4 vs T4 (4+), Sv 3+ vs AP 0 (1-2 fail): 20 × 2/3 × 1/2 × 1/3
  ['bolters: unsaved', () => run([g({ n:10, A:'2', skill:'3+' })], { T:4, models:[big(10, 2, 3)] }).groups[0].unsaved, 20 * 2 / 3 / 2 / 3],
  // [LETHAL HITS]: 20 attacks at 4+ vs T8 (6+): 10/3 critical hits wound automatically, the other 20/3 hits wound on a 6
  ['lethal hits: wounds', () => run([g({ n:20, kw:['LETHAL HITS'] })], { T:8, models:[big(20, 10)] }).groups[0].wounds, 20 / 6 + 20 / 3 / 6],
  // [SUSTAINED HITS 1]: 30 attacks at 4+: 15 hits + 5 extra
  ['sustained hits 1: hits', () => run([g({ n:30, kw:['SUSTAINED HITS 1'] })], { T:4, models:[big(50, 10)] }).groups[0].hits, 20],
  // [TORRENT] + [DEVASTATING WOUNDS], S4 vs T4: 36 hits, 6 critical wounds become mortal wounds, 12 normal wounds vs Sv 2+ (1/6 fail)
  ['devastating wounds: mortals', () => run([g({ n:36, D:2, kw:['TORRENT', 'DEVASTATING WOUNDS'] })], { T:4, models:[big(200, 10, 2)] }).groups[0].mortals, 6],
  ['devastating wounds: unsaved', () => run([g({ n:36, D:2, kw:['TORRENT', 'DEVASTATING WOUNDS'] })], { T:4, models:[big(200, 10, 2)] }).groups[0].unsaved, 2],
  // [TWIN-LINKED]: re-roll the wound roll: 1/2 + 1/2 × 1/2 of 60 torrent hits
  ['twin-linked: wounds', () => run([g({ n:60, kw:['TORRENT', 'TWIN-LINKED'] })], { T:4, models:[big(100, 10)] }).groups[0].wounds, 45],
  // [ANTI-VEHICLE 4+] + [DEVASTATING WOUNDS] vs a VEHICLE, S4 vs T8: 4+ is critical (30 mortals), 1-3 fail
  ['anti + devastating: mortals', () => run([g({ n:60, kw:['TORRENT', 'ANTI-VEHICLE 4+', 'DEVASTATING WOUNDS'] })], { T:8, kw:['Vehicle'], models:[big(100, 10)] }).groups[0].mortals, 30],
  // a target-limited keyword ("LETHAL HITS: non-MONSTER/VEHICLE") does nothing against a VEHICLE
  ['limited keyword: wounds', () => run([g({ n:20, kw:['LETHAL HITS: non-MONSTER/VEHICLE'] })], { T:8, kw:['Vehicle'], models:[big(20, 10)] }).groups[0].wounds, 10 / 6],
  // Feel No Pain 5+: 60 torrent hits at S8 vs T4 (2+), no save: 50 wounds, 2/3 of them lost
  ['feel no pain 5+: lost', () => run([g({ n:60, S:8 })].map(x => Object.assign(x, { kw:['TORRENT'] })), { T:4, models:[big(1, 1000, 7, { fnp:5 })] }).dmg, 50 * 2 / 3],
  // -1 D cannot take D 1 below 1 (D cannot be less than 1)
  ['-1 D on D1: lost', () => run([g({ n:60, S:8, kw:['TORRENT'] })], { T:4, models:[big(1, 1000)], mod:{ dMinus:1 } }).dmg, 50],
  // [MELTA 2] within half range: D D6+2 (5.5 on average) per unsaved attack; 60 torrent hits, S8 vs T4: 50 wounds
  ['melta 2 at half range: lost', () => run([g({ n:60, S:8, D:'D6', kw:['TORRENT', 'MELTA 2'] })], { T:4, models:[big(1, 100000)] }, { halfRange:true }).dmg, 50 * 5.5],
  // [RAPID FIRE 1] within half range: one more attack per weapon
  ['rapid fire 1 at half range: attacks', () => run([g({ n:10, kw:['RAPID FIRE 1'] })], { T:4, models:[big(100, 10)] }, { halfRange:true }).groups[0].attacks, 20],
  // [BLAST 2], A3, 12 models in the target: 3 + 2 × 2 attack dice (the Core Rules' example)
  ['blast 2 vs 12 models: attacks', () => run([g({ A:'3', kw:['BLAST 2'] })], { T:4, models:[big(12, 10)] }).groups[0].attacks, 7],
  // [CLEAVE 1], A3, 16 models in the one target: 3 + 3 (the Core Rules' example)
  ['cleave 1 vs 16 models: attacks', () => run([g({ A:'3', kw:['CLEAVE 1'] })], { T:4, models:[big(16, 10)] }).groups[0].attacks, 6],
  // the benefit of cover worsens BS by 1: 60 attacks at 4+ hit on 5+
  ['cover: hits', () => run([g({ n:60 })], { T:4, models:[big(100, 10)] }, { ranged:true, cover:true }).groups[0].hits, 20],
  // ... but BS cannot be 7+ or worse: a 6+ weapon in cover still hits on 6s
  ['cover on a 6+ weapon: hits', () => run([g({ n:60, skill:'6+' })], { T:4, models:[big(100, 10)] }, { ranged:true, cover:true }).groups[0].hits, 10],
  // [IGNORES COVER] and [PSYCHIC] attacks keep their BS in cover
  ['ignores cover: hits', () => run([g({ n:60, kw:['IGNORES COVER'] })], { T:4, models:[big(100, 10)] }, { ranged:true, cover:true }).groups[0].hits, 30],
  ['psychic in cover: hits', () => run([g({ n:60, kw:['PSYCHIC'] })], { T:4, models:[big(100, 10)] }, { ranged:true, cover:true }).groups[0].hits, 30],
  // +1 to hit on 4+: 3+; an unmodified 1 still fails at +2
  ['+1 to hit: hits', () => run([g({ n:60, mod:{ hit:1 } })], { T:4, models:[big(100, 10)] }).groups[0].hits, 40],
  ['+2 to hit on 3+: hits', () => run([g({ n:60, skill:'3+', mod:{ hit:2 } })], { T:4, models:[big(100, 10)] }).groups[0].hits, 50],
  // re-roll hit rolls of 1 at 4+: 1/2 + 1/6 × 1/2
  ['re-roll 1s to hit: hits', () => run([g({ n:60, mod:{ rrHit:'1s' } })], { T:4, models:[big(100, 10)] }).groups[0].hits, 60 * (0.5 + 1 / 12)],
  // [LANCE] after a charge: +1 to the wound roll (S4 vs T4: 3+)
  ['lance after a charge: wounds', () => run([g({ n:60, kw:['TORRENT', 'LANCE'] })], { T:4, models:[big(100, 10)] }, { charged:true }).groups[0].wounds, 40],
  // AP cannot be worse than 0: an AP 0 attack against a unit that worsens AP saves as AP 0 (Sv 4+: half fail)
  ['AP worse than 0: unsaved', () => run([g({ n:60, S:8, kw:['TORRENT'] })], { T:4, models:[big(100, 10, 4)], mod:{ apWorse:1 } }).groups[0].unsaved, 25],
  // InSv is checked first: Sv 3+ vs AP -4 fails, InSv 4+ saves half
  ['invulnerable save: unsaved', () => run([g({ n:60, S:8, AP:-4, kw:['TORRENT'] })], { T:4, models:[big(100, 10, 3, { InSv:4 })] }).groups[0].unsaved, 25],
  // excess damage is lost: 12 D3 hits that always get through on W1 models destroy 12 of 20
  ['excess damage lost: destroyed', () => run([g({ n:12, S:8, D:'3', kw:['TORRENT'] })], { T:1, models:[big(20, 1)] }).killed, 12 * (5 / 6)],

  // ---- a rule counts only for the weapons and models it names (04.01.04, 19.04) ----
  // Paired Krumpas: 2 of 10 Nobz' Kustom Krumpas re-roll hit and wound rolls. 8 × A3 at 3+: 24 × 2/3 = 16 hits;
  // the 2 with the rule: 6 × (2/3 + 1/3 × 2/3) = 6 × 8/9 = 5.33 hits
  ['rule on 2 of 10 models: their hits', () => run([g({ name:'Krumpa ×2', n:2, A:'3', skill:'3+', S:10, mods:[{ from:'Paired Krumpas', rrHit:'all', rrWound:'all' }] }), g({ name:'Krumpa ×8', n:8, A:'3', skill:'3+', S:10 })], { T:5, models:[big(100, 10)] }).groups[0].hits, 6 * 8 / 9],
  ['rule on 2 of 10 models: the others\' hits', () => run([g({ name:'Krumpa ×2', n:2, A:'3', skill:'3+', S:10, mods:[{ from:'Paired Krumpas', rrHit:'all', rrWound:'all' }] }), g({ name:'Krumpa ×8', n:8, A:'3', skill:'3+', S:10 })], { T:5, models:[big(100, 10)] }).groups[1].hits, 16],

  // ---- a value the printed weapon already includes is never added again (New Recruit's pre-applied bonuses) ----
  // A 4 that already includes Relentless Rage's +1 A: a "+1 A" from Relentless Rage adds nothing (10 weapons: 40 dice);
  // the same +1 A from another rule does add (50)
  ['pre-applied +1 A: not added twice', () => run([g({ n:10, A:'4', from:{ A:'Relentless Rage' }, mods:[{ from:'Relentless Rage', a:1 }] })], { T:4, models:[big(200, 10)] }).groups[0].attacks, 40],
  ['another rule\'s +1 A: added', () => run([g({ n:10, A:'4', from:{ A:'Relentless Rage' }, mods:[{ from:'Focused Ferocity', a:1 }] })], { T:4, models:[big(200, 10)] }).groups[0].attacks, 50],

  // ---- [PRECISION] (24.28, 24.28.01) ----
  // 2 torrent attacks, S8 vs T4 (2+: 5/6), D3, no save, at 10 W1 models and a W3 CHARACTER. Allocated to the CHARACTER:
  // one wound destroys it (3 wounds lost), a second goes to a W1 model (1): 3 × 2 × 5/6 × 1/6 + 4 × (5/6)² = 3.61
  ['precision: allocated to the character', () => run([g({ n:2, S:8, D:'3', kw:['TORRENT', 'PRECISION'] })], { T:4, models:[big(10, 1), big(1, 3, 7, { name:'Boss', char:true })] }, { precision:'Boss' }).dmg, 3 * 10 / 36 + 4 * 25 / 36],
  // ... and not picked: the W1 models first, 1 wound each (excess lost): 2 × 5/6
  ['precision: not picked', () => run([g({ n:2, S:8, D:'3', kw:['TORRENT', 'PRECISION'] })], { T:4, models:[big(10, 1), big(1, 3, 7, { name:'Boss', char:true })] }).dmg, 2 * 5 / 6],
  // [PRECISION] + [DEVASTATING WOUNDS]: the mortal wounds go to the picked CHARACTER first; [ANTI-INFANTRY 2+] makes every
  // wound (2+ at S4 vs T4 with Anti) critical: the same 3.61 as above, as mortal wounds
  ['precision + devastating wounds: mortals to the character', () => run([g({ n:2, S:4, D:'3', kw:['TORRENT', 'PRECISION', 'DEVASTATING WOUNDS', 'ANTI-INFANTRY 2+'] })], { T:4, kw:['Infantry'], models:[big(10, 1), big(1, 3, 7, { name:'Boss', char:true })] }, { precision:'Boss' }).dmg, 3 * 10 / 36 + 4 * 25 / 36],

  // ---- Toughness of an attached unit (19.02, 05.02.01) ----
  // the highest T among the bodyguard models (T6), even with a T7 leader: 60 torrent S6 hits wound on 4+: 30
  ['attached unit: bodyguard T, not the leader\'s', () => run([g({ n:60, S:6, kw:['TORRENT'] })], { T:6, models:[big(1, 1000, 2, { T:7, char:true }), big(5, 3, 7, { T:6, bodyguard:true })] }).groups[0].wounds, 30],
  // once the bodyguard is destroyed (50 S12 D3 torrent hits do it), the leader's T7: the next 60 S6 hits wound on 5+: 20
  ['attached unit: leader\'s T once the bodyguard is gone', () => run([g({ n:50, S:12, D:'3', kw:['TORRENT'] }), g({ n:60, S:6, AP:-1, kw:['TORRENT'] })], { T:6, models:[big(1, 1000, 2, { T:7, char:true }), big(5, 3, 7, { T:6, bodyguard:true })] }).groups[1].wounds, 20],

  // ---- situations ----
  // [HEAVY] conditions met (24.16): +1 to the hit roll, 4+ becomes 3+: 40 of 60
  ['heavy: hits', () => run([g({ n:60, kw:['HEAVY'] })], { T:4, models:[big(100, 10)] }, { ranged:true, heavy:true }).groups[0].hits, 40],
  // indirect shooting (10.07): an unmodified 1-5 fails: 10 of 60 hit, even at BS 2+ and with re-rolls (none allowed)
  ['indirect fire 1-5 fails: hits', () => run([g({ n:60, skill:'2+', kw:['INDIRECT FIRE'], mod:{ rrHit:'all' } })], { T:4, models:[big(100, 10)] }, { ranged:true, indirect:'1-5' }).groups[0].hits, 10],
  // stationary and the target visible to a friendly unit: 1-3 fail; cover (BS 3+ becomes 4+): 4, 5 and 6 hit: 30
  ['indirect fire 1-3 fails: hits', () => run([g({ n:60, skill:'3+', kw:['INDIRECT FIRE'] })], { T:4, models:[big(100, 10)] }, { ranged:true, indirect:'1-3' }).groups[0].hits, 30],
  // snap shooting (15.09): only an unmodified 6 hits, whatever the BS and modifiers, and it is not critical (no Sustained Hits): 10
  ['snap shooting: hits', () => run([g({ n:60, skill:'2+', kw:['SUSTAINED HITS 2'], mod:{ hit:1 } })], { T:4, models:[big(100, 10)] }, { ranged:true, snap:true }).groups[0].hits, 10],
  // a MONSTER/VEHICLE in close-quarters shooting (10.06): -1 to hit unless a [CLOSE-QUARTERS] weapon: 4+ becomes 5+: 20 of 60 ...
  ['close-quarters shooting, vehicle: other weapon hits', () => run([g({ n:60 })], { T:4, models:[big(100, 10)] }, { ranged:true, cq:true, big:true }).groups[0].hits, 20],
  // ... and a [PISTOL] weapon has no penalty: 30
  ['close-quarters shooting, vehicle: pistol hits', () => run([g({ n:60, kw:['PISTOL'] })], { T:4, models:[big(100, 10)] }, { ranged:true, cq:true, big:true }).groups[0].hits, 30],
  // other models in close-quarters shooting can only select [CLOSE-QUARTERS] weapons: the other gun makes no attacks
  ['close-quarters shooting, infantry: other weapon attacks', () => run([g({ n:10 })], { T:4, models:[big(100, 10)] }, { ranged:true, cq:true }).groups[0].attacks, 0],
  // an engaged MONSTER/VEHICLE target (17.03): -1 to hit (20 of 60), and [BLAST] cannot target it
  ['engaged vehicle target: hits', () => run([g({ n:60 })], { T:4, kw:['Vehicle'], models:[big(100, 10)] }, { ranged:true, engaged:true }).groups[0].hits, 20],
  ['engaged vehicle target: blast attacks', () => run([g({ n:10, kw:['BLAST'] })], { T:4, kw:['Vehicle'], models:[big(100, 10)] }, { ranged:true, engaged:true }).groups[0].attacks, 0],
  // Plunging Fire (22.05): BS improved by 1, 4+ becomes 3+: 40; with cover as well, back to 4+: 30
  ['plunging fire: hits', () => run([g({ n:60 })], { T:4, models:[big(100, 10)] }, { ranged:true, plunging:true }).groups[0].hits, 40],
  ['plunging fire in cover: hits', () => run([g({ n:60 })], { T:4, models:[big(100, 10)] }, { ranged:true, plunging:true, cover:true }).groups[0].hits, 30],
  // ... and BS cannot be 1+: a 2+ weapon still hits on 2+: 50
  ['plunging fire on a 2+ weapon: hits', () => run([g({ n:60, skill:'2+' })], { T:4, models:[big(100, 10)] }, { ranged:true, plunging:true }).groups[0].hits, 50],
  // Damaged (24.39): -1 to hit rolls, 4+ becomes 5+: 20 of 60
  ['damaged: hits', () => run([g({ n:60, mods:[{ from:'Damaged: 1-4 wounds remaining', hit:-1 }] })], { T:4, models:[big(100, 10)] }).groups[0].hits, 20],

  // ---- [BLAST]/[CLEAVE] count the models at Select Targets (24.05) ----
  // 10 models: a [BLAST] A1 weapon gathers 1 + 2 dice even after an earlier weapon destroyed some of them
  ['blast after casualties: attacks', () => run([g({ n:6, S:8, kw:['TORRENT'] }), g({ kw:['BLAST'] })], { T:1, models:[big(10, 1)] }).groups[1].attacks, 3],

  // ---- allocation groups (05.03) ----
  // two groups (W1 Sv6+ listed first, W1 Sv2+): the defender puts the 2+ group first, so the low save rolls meet it:
  // 6 torrent S8 hits wound on 2+, each fails a 2+ save on a 1: 6 × 5/6 × 1/6 models destroyed
  ['allocation: the defender\'s better order', () => run([g({ n:6, S:8, kw:['TORRENT'] })], { T:4, models:[big(5, 1, 6, { name:'light' }), big(5, 1, 2, { name:'heavy' })] }).killed, 6 * 5 / 6 / 6],
  // CHARACTER groups last: D3 hits that get through go to the W1 models (1 wound lost each), not the W3 CHARACTER: 3 × 5/6
  ['allocation: character last', () => run([g({ n:3, S:8, D:'3', kw:['TORRENT'] })], { T:4, models:[big(1, 3, 7, { char:true }), big(5, 1)] }).dmg, 3 * 5 / 6],

  // ---- duplicated abilities (24.02): one instance, the better one ----
  // [SUSTAINED HITS 2] and a rule's [SUSTAINED HITS 1]: 2 is used: 60 at 4+: 30 hits + 10 × 2 = 50
  ['duplicate sustained hits: the better one', () => run([g({ n:60, kw:['SUSTAINED HITS 2'], mods:[{ from:'Never Enough Dakka', sus:'1' }] })], { T:4, models:[big(100, 10)] }).groups[0].hits, 50],
  // [BLAST] and [BLAST 2]: one applies (2): A3 vs 12 models: 3 + 4
  ['duplicate blast: the better one', () => run([g({ A:'3', kw:['BLAST', 'BLAST 2'] })], { T:4, models:[big(12, 10)] }).groups[0].attacks, 7],
  // [BLAST] and [CLEAVE 1] are different abilities: both add: A3 vs 12 models: 3 + 2 + 2
  ['blast and cleave: both', () => run([g({ A:'3', kw:['BLAST', 'CLEAVE 1'] })], { T:4, models:[big(12, 10)] }).groups[0].attacks, 7],
  // [ANTI-VEHICLE 4+] and [ANTI-INFANTRY 2+] against INFANTRY: the 2+ one: 60 torrent S4 vs T8 with Devastating Wounds: 50 mortals
  ['duplicate anti: the one that applies', () => run([g({ n:60, kw:['TORRENT', 'ANTI-VEHICLE 4+', 'ANTI-INFANTRY 2+', 'DEVASTATING WOUNDS'] })], { T:8, kw:['Infantry'], models:[big(1000, 10)] }).groups[0].mortals, 50],

  // ---- [PSYCHIC] (24.29) ignores only the modifiers that make it worse ----
  // +1 to hit and -1 to hit: it keeps the +1: 4+ becomes 3+: 40 of 60
  ['psychic: keeps +1, ignores -1', () => run([g({ n:60, kw:['PSYCHIC'], mod:{ hit:1 } })], { T:4, models:[big(100, 10)], mod:{ hitMinus:1 } }).groups[0].hits, 40],

  // ---- ANTI-NON-X (24.01 FAQ): triggers against a unit without X ----
  // [ANTI-NON-MONSTER/VEHICLE 4+] + [DEVASTATING WOUNDS], 60 torrent S4 vs T8: vs INFANTRY 4+ is critical (30 mortals) ...
  ['anti-non: against infantry', () => run([g({ n:60, kw:['TORRENT', 'ANTI-NON-MONSTER/VEHICLE 4+', 'DEVASTATING WOUNDS'] })], { T:8, kw:['Infantry'], models:[big(1000, 10)] }).groups[0].mortals, 30],
  // ... vs a VEHICLE only 6s (10)
  ['anti-non: against a vehicle', () => run([g({ n:60, kw:['TORRENT', 'ANTI-NON-MONSTER/VEHICLE 4+', 'DEVASTATING WOUNDS'] })], { T:8, kw:['Vehicle'], models:[big(1000, 10)] }).groups[0].mortals, 10],

  // ---- half range and range, per weapon, from the distance ----
  // 10" away: a 12" [MELTA 2] weapon is not within half range (6"): D6 (3.5 per wound): 50 wounds (S8 vs T4) → 175
  ['distance: melta beyond half range', () => run([g({ n:60, S:8, D:'D6', range:'12"', kw:['TORRENT', 'MELTA 2'] })], { T:4, models:[big(1, 100000)] }, { ranged:true, dist:10 }).dmg, 50 * 3.5],
  // ... a 24" [RAPID FIRE 1] weapon is (12"): 2 attacks each
  ['distance: rapid fire within half range', () => run([g({ n:10, range:'24"', kw:['RAPID FIRE 1'] })], { T:4, models:[big(100, 10)] }, { ranged:true, dist:10 }).groups[0].attacks, 20],
  // ... and a 9" weapon is out of range: no attacks
  ['distance: out of range', () => run([g({ n:10, range:'9"' })], { T:4, models:[big(100, 10)] }, { ranged:true, dist:10 }).groups[0].attacks, 0],

  // ---- [LANCE] given by a rule (24.21): +1 to wound after a charge: S4 vs T4 3+: 40 of 60 ----
  ['lance from a rule: wounds', () => run([g({ n:60, kw:['TORRENT'], mods:[{ from:'Servo-driven Charge', lance:true }] })], { T:4, models:[big(100, 10)] }, { charged:true }).groups[0].wounds, 40],

  // ---- minimums ("When Modifying Characteristics") ----
  // A cannot be less than 1: D3 attacks -5 is still 1 each: 10 weapons, 10 dice
  ['A at least 1: attacks', () => run([g({ n:10, A:'D3', mod:{ a:-5 } })], { T:4, models:[big(100, 10)] }).groups[0].attacks, 10],
  // S cannot be less than 1: S2 -3 is S1, vs T2 a 6+ wound roll: 10 of 60 torrent hits
  ['S at least 1: wounds', () => run([g({ n:60, S:2, kw:['TORRENT'], mod:{ s:-3 } })], { T:2, models:[big(100, 10)] }).groups[0].wounds, 10],
  // a weapon with no S has S 1 (02.04.01), and '-' is never modified: +5 S does nothing, vs T2: 6+
  ['no S is S 1: wounds', () => run([g({ n:60, S:'–', kw:['TORRENT'], mod:{ s:5 } })], { T:2, models:[big(100, 10)] }).groups[0].wounds, 10],
  // [DEVASTATING WOUNDS] mortal wounds: D cannot be less than 1: D1 -2 is still 1. 36 torrent S4 vs T4, no save: 6 critical
  // wounds (6 mortal wounds of 1) and 12 normal wounds of D 1: 18 lost (12 if the mortal wounds fell to 0)
  ['devastating wounds D at least 1: lost', () => run([g({ n:36, kw:['TORRENT', 'DEVASTATING WOUNDS'], mod:{ d:-2 } })], { T:4, models:[big(1, 100000)] }).dmg, 18],

  // ---- Feel No Pain and InSv per model (24.12, 19.04 FAQ) ----
  // a leader's own Feel No Pain 4+ does not protect its bodyguard: 60 torrent S8 vs T4 D1 (50 wounds) at a W1000 bodyguard: 50 lost
  ['feel no pain of one model only: lost', () => run([g({ n:60, S:8, kw:['TORRENT'] })], { T:4, models:[big(1, 1000, 7, { char:true, fnp:4 }), big(1, 1000, 7, { bodyguard:true })] }).dmg, 50],

  // ---- the attacker's choices (stated in the app): [LETHAL HITS] with [DEVASTATING WOUNDS], re-rolls ----
  // [LETHAL HITS] + [DEVASTATING WOUNDS] + [ANTI-INFANTRY 2+] vs a 2+ save, 60 attacks at 4+, S4 vs T4: a critical hit rolls to
  // wound instead (a critical wound on 2+ is worth more than an automatic wound that a 2+ save stops 5 times in 6):
  // 30 hits × 5/6 critical wounds = 25 mortals (always taking Lethal Hits would give 20 × 5/6 = 16.7)
  ['lethal hits + devastating wounds: rolls to wound', () => run([g({ n:60, kw:['LETHAL HITS', 'DEVASTATING WOUNDS', 'ANTI-INFANTRY 2+'] })], { T:4, kw:['Infantry'], models:[big(1000, 10, 2)] }).groups[0].mortals, 25],
  // [TWIN-LINKED] + [DEVASTATING WOUNDS], S4 vs T4 vs a 2+ save: a 4 or 5 (wound, saved 5 times in 6) is re-rolled for a 6:
  // P(critical) = 1/6 + 5/6 × 1/6 = 11/36 of 60 torrent hits = 18.3 (re-rolling only fails: 15)
  ['twin-linked + devastating wounds: re-rolls for a 6', () => run([g({ n:60, kw:['TORRENT', 'TWIN-LINKED', 'DEVASTATING WOUNDS'] })], { T:4, models:[big(1000, 10, 2)] }).groups[0].mortals, 60 * 11 / 36],
];

// Every value New Recruit already includes (a `from` mark in data.js, every list): the same rule, given to the calculator
// as a tick box, must not add it again. A mark on a field or keyword a rule could add (A, S, AP, D, [LETHAL HITS],
// [SUSTAINED HITS X], …) is checked by giving the weapon that rule; the others (M, InSv, [ASSAULT], …) no rule adds here.
const { loadData } = require('./lib');
const ADD = { A:{ a:1 }, S:{ s:1 }, AP:{ ap:1 }, D:{ d:1 }, 'LETHAL HITS':{ lethal:true }, 'DEVASTATING WOUNDS':{ dev:true }, 'IGNORES COVER':{ ignoresCover:true },
  'TWIN-LINKED':{ twin:true }, LANCE:{ lance:true }, PRECISION:{ precision:true } };
const addOf = key => ADD[key] || ((/^SUSTAINED HITS (\S+)$/.exec(key) || [])[1] ? { sus:/^SUSTAINED HITS (\S+)$/.exec(key)[1] } : null);
const twice = [];
let marks = 0;
for(const a of loadData().armies) for(const u of a.units) for(const [kind, list] of [['ranged', u.ranged], ['melee', u.melee]]) for(const w of list || []){
  for(const [key, rules] of Object.entries(w.from || {})) for(const rule of [].concat(rules)){
    const add = addOf(key);
    if(!add) continue;
    marks++;
    const r = C.resolve({ groups:[{ name:w.name, n:1, A:w.A, skill:w.BS || w.WS, S:w.S, AP:w.AP, D:w.D, range:w.range, kw:w.kw, from:w.from, mods:[Object.assign({ from:rule }, add)] }],
      target:{ T:4, models:[{ name:'m', count:1, W:10, Sv:4 }] }, ctx:{ ranged:kind === 'ranged' } }).groups[0];
    if(r.applied.some(x => x.from === rule && x.key.toUpperCase() === key.toUpperCase()) || !r.skipped.some(x => x.from === rule))
      twice.push(a.id + ' · ' + u.id + ' · ' + w.name + ': ' + key + ' (' + rule + ') would be added again');
  }
}
cases.push(['every pre-applied value, every list: never added twice (' + marks + ' values)', () => twice.length, 0]);
for(const t of twice) console.log('  ' + t);

let fail = 0;
for(const [name, fn, want] of cases){
  const got = fn(), tol = Math.max(0.15, Math.abs(want) * 0.03);
  const ok = Math.abs(got - want) <= tol;
  if(!ok) fail++;
  if(!ok || process.argv.includes('-v')) console.log((ok ? 'ok   ' : 'FAIL ') + name + ': ' + got.toFixed(3) + ' (worked out: ' + (+want).toFixed(3) + ')');
}
console.log('calc: ' + (cases.length - fail) + ' of ' + cases.length + ' hand-worked cases within margin' + (fail ? '; ' + fail + ' failures' : ''));
process.exit(fail ? 1 : 0);
