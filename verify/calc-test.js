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

  // ---- half range as a band: the target within X inches; a weapon gets its bonus when its half range reaches X ----
  // within 9": a 12" [MELTA 2] weapon's half range is 6": D6 (3.5 per wound): 50 wounds (S8 vs T4) → 175
  ['half range band: melta not reached', () => run([g({ n:60, S:8, D:'D6', range:'12"', kw:['TORRENT', 'MELTA 2'] })], { T:4, models:[big(1, 100000)] }, { ranged:true, halfWithin:9 }).dmg, 50 * 3.5],
  // within 12": a 24" [RAPID FIRE 1] weapon's half range is 12": 2 attacks each
  ['half range band: rapid fire reached', () => run([g({ n:10, range:'24"', kw:['RAPID FIRE 1'] })], { T:4, models:[big(100, 10)] }, { ranged:true, halfWithin:12 }).groups[0].attacks, 20],
  // within 18": of two [RAPID FIRE 1] weapons, the 36" one (half range 18") gets +1 (20 dice), the 24" one does not (10)
  ['half range band: the 36" weapon within 18"', () => run([g({ n:10, range:'36"', kw:['RAPID FIRE 1'] }), g({ n:10, range:'24"', kw:['RAPID FIRE 1'] })], { T:4, models:[big(100, 10)] }, { ranged:true, halfWithin:18 }).groups[0].attacks, 20],
  ['half range band: the 24" weapon not within 18"', () => run([g({ n:10, range:'36"', kw:['RAPID FIRE 1'] }), g({ n:10, range:'24"', kw:['RAPID FIRE 1'] })], { T:4, models:[big(100, 10)] }, { ranged:true, halfWithin:18 }).groups[1].attacks, 10],

  // ---- the one number format: rounded to one decimal first, the decimal dropped at 10 or more ----
  ['number format: 9.96 is 10', () => +(C.fmt(9.96) === '10'), 1],
  ['number format: 9.94 is 9.9', () => +(C.fmt(9.94) === '9.9'), 1],
  ['number format: 10 is 10', () => +(C.fmt(10) === '10'), 1],

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

  // ---- what is left after each game (run with alive), a CHARACTER's fate (rowsDead), the return blow (mix) ----
  // one torrent attack, S8 vs T4 (2+), no save, at 2 W1 models: 1 is left in 5/6 of the games, 2 in 1/6
  ['what is left: 1 of 2 models in 5/6 of the games', () => (r => r.alive.find(x => x.rows[0] === 1).n / r.sims)(C.run({ groups:[g({ S:8, kw:['TORRENT'] })], target:{ T:4, models:[big(2, 1)] }, ctx:{}, sims:20000, seed:11, alive:true })), 5 / 6],
  // a bodyguard model (W1) and a CHARACTER (W1, its group last): two torrent attacks, S8 vs T4, no save: the CHARACTER is destroyed
  // only when both wound: (5/6)² = 25/36
  ['a CHARACTER’s fate: destroyed in 25/36', () => C.run({ groups:[g({ n:2, S:8, kw:['TORRENT'] })], target:{ T:4, models:[big(1, 1, 7, { bodyguard:true }), big(1, 1, 7, { name:'Boss', char:true })] }, ctx:{}, sims:20000, seed:11 }).rowsDead[1], 25 / 36],
  // the return blow: what is left of those 2 models (each with one torrent attack, S8 vs T4: 5/6) attacks 3 W1 models back:
  // (5/6 × 1 + 1/6 × 2) × 5/6 = 35/36 destroyed
  ['return blow: what is left strikes back, 35/36', () => { const r = C.run({ groups:[g({ S:8, kw:['TORRENT'] })], target:{ T:4, models:[big(2, 1)] }, ctx:{}, sims:20000, seed:11, alive:true });
    return C.mix(r.alive.map(x => ({ n:x.n, input:{ groups:[g({ n:x.rows[0], S:8, kw:['TORRENT'] })], target:{ T:4, models:[big(3, 1)] }, ctx:{} } })), { seed:5 }).killed; }, 35 / 36],
  // ... and a unit wiped out strikes back with nothing: one torrent attack S4 vs T4 (4+) at 1 W1 model leaves it in half of the
  // games; it has 2 torrent attacks, S8 vs T4, at 5 W1 models: 1/2 × 2 × 5/6
  ['return blow: a destroyed unit attacks with nothing', () => { const r = C.run({ groups:[g({ kw:['TORRENT'] })], target:{ T:4, models:[big(1, 1)] }, ctx:{}, sims:20000, seed:11, alive:true });
    return C.mix(r.alive.map(x => ({ n:x.n, input:x.rows[0] ? { groups:[g({ n:2, S:8, kw:['TORRENT'] })], target:{ T:4, models:[big(5, 1)] }, ctx:{} } : null })), { seed:5 }).killed; }, 1 / 2 * 2 * 5 / 6],
  ['return blow: the games add up', () => (r => C.mix(r.alive.map(x => ({ n:x.n, input:null }))).sims)(C.run({ groups:[g({ kw:['TORRENT'] })], target:{ T:4, models:[big(1, 1)] }, ctx:{}, sims:20000, seed:11, alive:true })), 20000],
];

// ---- the screen's own choices, through the app's dmCalc (verify/damage-node.js): what starts ticked, greyed or offered ----
const dm = require('./damage-node')();
const LK = 'm:Legendary Killer|While Khârn leads this unit|re-roll hit rolls of 1 and wound rolls of 1';
const exact = (s, k) => { const c = dm.calc(s); return C.explain(c.input).total[k || 'dmg']; };
const played = (s, k) => { const c = dm.calc(s); return C.run(Object.assign({}, c.input, { sims:20000, seed:7 }))[k]; };
const box = (s, from) => { const c = dm.calc(s); return c.rules.concat(c.defs).find(x => (x.m && x.m.from === from) || x.src === from) || {}; };
const boxN = (s, from, note) => dm.calc(s).rules.find(x => x.m.from === from && x.m.note === note) || {};   // one part of a rule split in two
const DAKKA = 'm:Dakka! Dakka! Dakka!|Riled up|+3" range';
const app = [
  // Arrogant Invulnerability ("Attacks that target this unit have -1 AP") always applies: ticked from the start.
  // Khârn + Berzerkers fight Nazdreg + Meganobz (Legendary Killer unticked), before allocation, against the Meganobz (Sv 2+):
  // Gorechild 9 × 5/6 = 7.5 hits × 4/6 (S7 vs T6) = 5 wounds, AP-2 worsened to -1: 2/6 fail = 1.67 × D3 = 5.0;
  // Chainblades 40 × 4/6 = 26.7 × 2/6 (S5 vs T6) = 8.9, AP-1 to 0: 1/6 = 1.48; eviscerators 8 × 4/6 × 4/6 = 3.56 × 2/6 = 1.19 × D2 = 2.37
  ['always on: Arrogant Invulnerability (before allocation)', () => exact({ army:'princes', opp:'melee', ph:'fight', atk:'kh-rn-the-betrayer-khorne-berzerkers', tgt:'nazdreg-meganobz', on:{ [LK]:false } }), 5 + 40 * 4 / 6 * 2 / 6 / 6 + 8 * 4 / 6 * 4 / 6 * 2 / 6 * 2],
  // Super Runts: Zodgrod's unit is always riled up, so the Waaagh! 5+ InSv is ticked. Forgefiend at 20 Gretchin (W1, the first
  // group): Hades 12 × 3/6 × 5/6 = 5 wounds, Ectoplasma (D3 + [BLAST] 22 models: +4) 6 × 3/6 × 5/6 = 2.5; 5+ InSv: 4/6 fail → 5.0 models
  ['always riled up: Super Runts, models destroyed', () => played({ army:'princes', opp:'ooga-booga', ph:'shooting', atk:'forgefiend', tgt:'zodgrod-wortsnagga-runtherd-gretchin' }, 'killed'), (5 + 2.5) * 4 / 6],
  // Helm of Brazen Ire (-1 Damage to attacks allocated to the bearer) always applies: Forgefiend at the Daemon Prince (T10, Sv 2+,
  // InSv 4+): Hades 12 × 3/6 × 2/6 = 2 wounds × 2/6 (3+ with AP-1) × D(2-1) = 0.67; Ectoplasma 2 × 3/6 × 3/6 = 0.5 × 3/6 (InSv 4+) × D(3-1) = 0.5
  ['always on: Helm of Brazen Ire', () => exact({ army:'princes', opp:'princes', ph:'shooting', atk:'forgefiend', tgt:'daemon-prince-of-khorne-helm-of-brazen-ire' }), 2 / 3 + 0.5],
  // Prophet of Da Great Waaagh!: Ghazghkull is always within his own aura (22.01): +1 to hit and wound, ticked; at Mozrog
  // (W10, Feel No Pain 5+), played out: 8.5 wounds lost (the reviewer's own simulator: 8.5, 59%)
  ['own aura: Prophet of Da Great Waaagh!, wounds lost', () => played({ army:'melee', opp:'melee', ph:'fight', atk:'ghazghkull-thraka', tgt:'mozrog-skragbad' }, 'dmg'), 8.5],
  // Bringer of Justice (+1 to the bearer's melee hit rolls) always, and Macro-extinction Protocols' two parts against the Knight
  // Paladin (a VEHICLE: +1 to hit; TITANIC: +1 to wound): Atrapos lascutter WS 3+ +2 → 2+: 8 × 5/6 = 6.67 hits + 8/6 [SUSTAINED HITS 1]
  // = 8 × 5/6 (S14 vs T11: 3+, +1 → 2+) = 6.67 × 5/6 (AP-3 vs Sv 3+: 6+) = 5.56 × D4 × 5/6 (Knights of Legend, Feel No Pain 6+) = 18.5
  ['always on: Bringer of Justice + Macro-extinction Protocols', () => exact({ army:'4-megas-and-a-destrier', opp:'6-bigs', ph:'fight', atk:'cerastus-knight-atrapos', tgt:'knight-paladin' }), 8 * 5 / 6 * 5 / 6 * 4 * 5 / 6],
  // Unnatural Resistance (Feel No Pain 4+ against mortal wounds) always: counted for the Norn Emissary
  ['always on: Unnatural Resistance', () => dm.calc({ army:'princes', opp:'nidzillas', ph:'shooting', atk:'forgefiend', tgt:'norn-emissary' }).tmod.fnpMortal, 4],
  // Bringers of Change (always: re-roll wound rolls of 1, its data mark calc): Warpflamers 3 × D6 = 10.5 torrent hits × (2/6 + 1/6 × 2/6)
  // (S4 vs T5) = 4.08 wounds × 3/6 (AP-1 vs Sv 3+) = 2.04; the four weapons together: 8.0 (the reviewer: 8.0)
  ['always on: Bringers of Change', () => exact({ army:'pubstomper', opp:'princes', ph:'shooting', atk:'sorcerer-rubric-marines', tgt:'lord-on-juggernaut-khorne-berzerkers' }), 8.0],
  // Aegis Protocol: the Kastelans are T9 +1 = T10 from the start of the battle: Chaos Terminators: combi-bolters 12 × 3/6 × 1/6 (S5 vs
  // T10: 6+) × 2/6 = 0.33; reapers 8 × 3/6 + 8/6 sustained = 5.33 hits: critical 5.33/6 = 0.89 mortal, 5s 5.33/6 = 0.89 × 2/6 = 0.30
  // Battle Protocols: Aegis is the protocol the unit starts in, then the player picks one: unticked; ticked, the Kastelans are T10
  ['Aegis Protocol starts unticked', () => +(box({ army:'super-terminators', opp:'purge-goes-the-foe', ph:'shooting', atk:'chaos-terminators', tgt:'cybernetica-datasmith-kastelan-robots' }, 'Battle Protocols').state === 'choice'), 1],
  ['Aegis Protocol ticked: +1 T', () => { const k = box({ army:'super-terminators', opp:'purge-goes-the-foe', ph:'shooting', atk:'chaos-terminators', tgt:'cybernetica-datasmith-kastelan-robots' }, 'Battle Protocols').k;
    return exact({ army:'super-terminators', opp:'purge-goes-the-foe', ph:'shooting', atk:'chaos-terminators', tgt:'cybernetica-datasmith-kastelan-robots', on:{ [k]:true } }); }, 1 / 3 + 16 / 3 / 6 + 16 / 3 / 6 * 2 / 6],
  // the Datasmith's own Feel No Pain 4+ (Robotic Bodyguard): on that model only, not the robots
  ['one model only: the Datasmith’s Feel No Pain', () => dm.calc({ army:'super-terminators', opp:'purge-goes-the-foe', ph:'shooting', atk:'chaos-terminators', tgt:'cybernetica-datasmith-kastelan-robots' }).models.map(m => m.name + m.fnp).join() === 'Cybernetica Datasmith4,Kastelan Robot7' ? 1 : 0, 1],
  // pistols per model (24.07): the Mek's Kustom Mega-slugga and the Nob's Rokkit pistol are those models' only guns, so they shoot;
  // Kustom Dakka (not against MONSTER/VEHICLE) stays out against a Knight even if ticked. At the Knight Paladin (T11, Sv 3+, InSv 5+*,
  // Feel No Pain 6+): slugga 3 × 3/6 × 2/6 × 4/6 × D3 × 5/6 = 0.83; pistol 1 × … = 0.28; launchas (Hunter) 18 × 3/6 × 4/6 × 4/6 × 3 × 5/6 = 10
  ['pistols per model, Kustom Dakka greyed vs a Knight', () => { const k = box({ army:'shooty', opp:'6-bigs', ph:'shooting', atk:'mek-tankbustas', tgt:'knight-paladin' }, 'Kustom Dakka').k;
    return exact({ army:'shooty', opp:'6-bigs', ph:'shooting', atk:'mek-tankbustas', tgt:'knight-paladin', on:{ [k]:true } }); }, 3 * 3 / 6 * 2 / 6 * 4 / 6 * 3 * 5 / 6 + 1 * 3 / 6 * 2 / 6 * 4 / 6 * 3 * 5 / 6 + 10],
  ['greyed with the reason: Kustom Dakka vs a Knight', () => +(box({ army:'shooty', opp:'6-bigs', ph:'shooting', atk:'mek-tankbustas', tgt:'knight-paladin' }, 'Kustom Dakka').why === 'not against MONSTER/VEHICLE'), 1],
  // Blitz Dem Gitz! (+6 A to the Blitzkannon against a target that is not MONSTER/VEHICLE): pre-ticked against Gretchin, greyed against a Knight
  ['pre-ticked from the target: Blitz Dem Gitz! vs Gretchin', () => { const b = box({ army:'shooty', opp:'ooga-booga', ph:'shooting', atk:'dakkarig-herder', tgt:'gretchin' }, 'Blitz Dem Gitz!'); return +(b.state === 'on' && b.on && b.why === 'the target is not MONSTER/VEHICLE'); }, 1],
  ['greyed from the target: Blitz Dem Gitz! vs a Knight', () => +(box({ army:'shooty', opp:'6-bigs', ph:'shooting', atk:'dakkarig-herder', tgt:'knight-paladin' }, 'Blitz Dem Gitz!').state === 'out'), 1],
  // a stratagem is never ticked for the player
  ['a stratagem starts unticked', () => +!box({ army:'shooty', opp:'ooga-booga', ph:'shooting', atk:'mek-tankbustas', tgt:'gretchin' }, 'Kustom Dakka').on, 1],
  // help from other units of the target's list: Emanatus Forcefield (4+ InSv against ranged attacks, BATTLELINE) is offered for
  // Skitarii Rangers and counts when ticked
  ['help from other units: Emanatus Forcefield', () => { const k = box({ army:'shooty', opp:'purge-goes-the-foe', ph:'shooting', atk:'mek-tankbustas', tgt:'skitarii-rangers' }, 'Emanatus Forcefield').k;
    return dm.calc({ army:'shooty', opp:'purge-goes-the-foe', ph:'shooting', atk:'mek-tankbustas', tgt:'skitarii-rangers', on:{ [k]:true } }).tmod.insv; }, 4],
  // the defender's allocation order, compared over the same 10,000 games (05.03): Khârn + Berzerkers (Legendary Killer unticked,
  // Epic Challenge on Gorechild, [PRECISION] on the Sorcerer) fight Sorcerer + Rubric Marines: Rubric Marine first loses fewer
  // models (5.62, 74% destroyed; the order the 2,000-game trial picked lost 5.67, 81%: the reviewer's 200,000 games)
  ['allocation order: Rubric Marine first', () => +(dm.calc({ army:'princes', opp:'pubstomper', ph:'fight', atk:'kh-rn-the-betrayer-khorne-berzerkers', tgt:'sorcerer-rubric-marines', on:{ 'm:Epic Challenge':true, 'c:prec':true, [LK]:false }, val:{ prec:'Sorcerer' } }) && (c => C.run(c.input).order[0])(dm.calc({ army:'princes', opp:'pubstomper', ph:'fight', atk:'kh-rn-the-betrayer-khorne-berzerkers', tgt:'sorcerer-rubric-marines', on:{ 'm:Epic Challenge':true, 'c:prec':true, [LK]:false }, val:{ prec:'Sorcerer' } })) === 'Rubric Marine'), 1],
  ['allocation order: models destroyed', () => (c => C.run(c.input).killed)(dm.calc({ army:'princes', opp:'pubstomper', ph:'fight', atk:'kh-rn-the-betrayer-khorne-berzerkers', tgt:'sorcerer-rubric-marines', on:{ 'm:Epic Challenge':true, 'c:prec':true, [LK]:false }, val:{ prec:'Sorcerer' } })), 5.62],
  ['allocation order: unit destroyed', () => (c => C.run(c.input).wipe)(dm.calc({ army:'princes', opp:'pubstomper', ph:'fight', atk:'kh-rn-the-betrayer-khorne-berzerkers', tgt:'sorcerer-rubric-marines', on:{ 'm:Epic Challenge':true, 'c:prec':true, [LK]:false }, val:{ prec:'Sorcerer' } })), 0.74],
  // after the unit is destroyed, a later weapon's attacks are lost: Khârn + Berzerkers fight 10 Gretchin: the eviscerators (last)
  // find the unit already gone in nearly every game, and their row says so
  ['the unit gone before a weapon: shown', () => (c => C.run(c.input).groups.slice(-1)[0].gone)(dm.calc({ army:'princes', opp:'shooty', ph:'fight', atk:'kh-rn-the-betrayer-khorne-berzerkers', tgt:'gretchin' })), 1],
  // half range as a band: the Knight Paladin's rapid-fire battle cannon and its stubbers have different half ranges; within 18"
  // only the weapons whose half range is 18" or more get [RAPID FIRE]
  ['half range band from the screen', () => dm.calc({ army:'6-bigs', opp:'shooty', ph:'shooting', atk:'knight-paladin', tgt:'gretchin', val:{ half:18 } }).ctx.halfWithin, 18],
  // ---- no opponent needed: a typed target, or any unit of any list ----
  // a typed target with no opponent set: 10 Grot Blastas (A1, BS 4+, S3, AP0, D1) at 10 models T3 W1 Sv 5+, Feel No Pain 6+:
  // 10 × 3/6 hit × 3/6 wound (S3 vs T3) × 4/6 fail × 5/6 not ignored = 1.39
  ['typed target, no opponent: Grot Blastas', () => exact({ army:'shooty', ph:'shooting', atk:'gretchin', typed:{ n:10, T:3, W:1, Sv:5, fnp:6 } }), 10 * 3 / 6 * 3 / 6 * 4 / 6 * 5 / 6],
  // the working shows the typed numbers
  ['typed target: its numbers in the working', () => { const w = C.explain(dm.calc({ army:'shooty', ph:'shooting', atk:'gretchin', typed:{ n:10, T:3, W:1, Sv:5, fnp:6 } }).input).groups[0].steps.map(x => x.t).join('\n');
    return +(/vs T3\b/.test(w) && /Sv 5\+/.test(w) && /Feel No Pain 6\+/.test(w)); }, 1],
  // its keyword toggles drive the boxes: Blitz Dem Gitz! is pre-ticked against a typed INFANTRY target, greyed against a typed VEHICLE
  ['typed target: keywords pre-tick a rule', () => +(box({ army:'shooty', ph:'shooting', atk:'dakkarig-herder', typed:{} }, 'Blitz Dem Gitz!').state === 'on'), 1],
  ['typed target: keywords grey a rule', () => +(box({ army:'shooty', ph:'shooting', atk:'dakkarig-herder', typed:{ kw:{ INFANTRY:false, VEHICLE:true } } }, 'Blitz Dem Gitz!').why === 'not against MONSTER/VEHICLE'), 1],
  // a target picked from a list that is not the opponent's (and with no opponent at all); the opponent's list leads the picker
  ['any list: a target from another list', () => +(dm.calc({ army:'shooty', opp:'ooga-booga', ph:'shooting', atk:'gretchin', tArmy:'6-bigs', tgt:'knight-paladin' }).tu.id === 'knight-paladin'), 1],
  ['any list: a target with no opponent', () => +(dm.calc({ army:'shooty', ph:'shooting', atk:'gretchin', tArmy:'6-bigs', tgt:'knight-paladin' }).tu.id === 'knight-paladin'), 1],
  // they attack: the attacker from any list, no opponent needed
  ['any list: their attacker with no opponent', () => { const c = dm.calc({ army:'shooty', dir:'them', ph:'shooting', aArmy:'princes', atk:'forgefiend', tgt:'gretchin' }); return +(c.au.id === 'forgefiend' && c.tu.id === 'gretchin'); }, 1],

  // ---- rules split by the sign-off: each part its own box, counted ----
  // Beacons of Rage, the Eightbound's own aura: +1 to hit always (against a target that is not MONSTER/VEHICLE), +1 to wound when
  // the target is Below Half-strength (unticked). 3 Chainblades, A6 WS 3+ → 2+: 18 × 5/6 = 15 hits; S8 vs a typed T9: 5+ (2/6) → 5,
  // or 4+ (3/6) → 7.5 when Below Half-strength; Sv 3+ AP-2: 5+, 4/6 fail; D2
  ['Beacons of Rage: +1 to hit, always', () => exact({ army:'princes', ph:'fight', atk:'eightbound', typed:{ n:10, T:9, W:1, Sv:3 } }), 18 * 5 / 6 * 2 / 6 * 4 / 6 * 2],
  ['Beacons of Rage: Below Half-strength box starts unticked', () => +(boxN({ army:'princes', ph:'fight', atk:'eightbound', typed:{ n:10, T:9, W:1, Sv:3 } }, 'Beacons of Rage', '+1 to wound rolls').state === 'choice'), 1],
  ['Beacons of Rage: Below Half-strength ticked, +1 to wound', () => exact({ army:'princes', ph:'fight', atk:'eightbound', typed:{ n:10, T:9, W:1, Sv:3 }, on:{ [boxN({ army:'princes', ph:'fight', atk:'eightbound', typed:{ n:10, T:9, W:1, Sv:3 } }, 'Beacons of Rage', '+1 to wound rolls').k]:true } }), 18 * 5 / 6 * 3 / 6 * 4 / 6 * 2],
  // Hunter of Souls: re-roll 1s against a CHARACTER unit, the whole hit and wound roll against a PSYKER CHARACTER unit (both
  // keywords: vs all). Hellforged weapons A6 WS 2+ S9 D4 at a typed T5 target with no save: hits 6 × (5/6 + 1/6 × 5/6) = 6 × 35/36
  // either way (only a 1 fails); wounds 3+: (4/6 + 1/6 × 4/6 = 28/36) against a CHARACTER, (4/6 + 2/6 × 4/6 = 32/36) against a PSYKER CHARACTER
  ['Hunter of Souls: a CHARACTER, re-roll 1s', () => exact({ army:'pubstomper', ph:'fight', atk:'daemon-prince-of-tzeentch-with-wings', typed:{ n:1, T:5, W:30, Sv:0, kw:{ CHARACTER:true } } }), 6 * 35 / 36 * 28 / 36 * 4],
  ['Hunter of Souls: a PSYKER CHARACTER, re-roll the rolls', () => exact({ army:'pubstomper', ph:'fight', atk:'daemon-prince-of-tzeentch-with-wings', typed:{ n:1, T:5, W:30, Sv:0, kw:{ CHARACTER:true, PSYKER:true } } }), 6 * 35 / 36 * 32 / 36 * 4],
  // vs all: the Norn Emissary is PSYKER but not CHARACTER: neither part applies
  ['vs all: PSYKER without CHARACTER is greyed', () => +(boxN({ army:'pubstomper', ph:'fight', atk:'daemon-prince-of-tzeentch-with-wings', tArmy:'nidzillas', tgt:'norn-emissary' }, 'Hunter of Souls', 're-roll the hit roll and the wound roll').why === 'only against PSYKER CHARACTER units'), 1],
  // Bringers of Change: re-roll wound rolls of 1 always; the whole wound roll when the target is near an objective marker you do not
  // control (unticked). 3 Warpflamers, D6 torrent attacks each: 10.5 hits; S4 vs a typed T4: 4+; no save, D1
  ['Bringers of Change: re-roll 1s, always', () => (c => C.explain(c.input).groups.find(g => g.steps[0].t.includes('× 3 = 10.5')).dmg)(dm.calc({ army:'pubstomper', ph:'shooting', atk:'sorcerer-rubric-marines', typed:{ n:10, T:4, W:1, Sv:0 } })), 10.5 * 21 / 36],
  ['Bringers of Change: objective box, re-roll the wound roll', () => { const s = { army:'pubstomper', ph:'shooting', atk:'sorcerer-rubric-marines', typed:{ n:10, T:4, W:1, Sv:0 } }; s.on = { [boxN(s, 'Bringers of Change', 're-roll the wound roll').k]:true };
    return (c => C.explain(c.input).groups.find(g => g.steps[0].t.includes('× 3 = 10.5')).dmg)(dm.calc(s)); }, 10.5 * 27 / 36],
  // Macro-extinction Protocols, both parts against the Knight Paladin: Atrapos lascutter D6 shots, BS 3+ +1 → 2+: 3.5 × 5/6 + 3.5/6
  // sustained = 3.5 hits; S14 vs T11 3+ +1 → 2+: × 5/6; the InSv 5+ against ranged attacks: × 4/6; D4 × 5/6 (Feel No Pain 6+)
  ['Macro-extinction Protocols: +1 to hit and +1 to wound', () => (c => C.explain(c.input).groups[0].dmg)(dm.calc({ army:'4-megas-and-a-destrier', ph:'shooting', atk:'cerastus-knight-atrapos', tArmy:'6-bigs', tgt:'knight-paladin' })), 3.5 * 5 / 6 * 4 / 6 * 4 * 5 / 6],

  // Kindred Sorcery: one of three abilities, picked: Psychic Maelstrom (+1 to wound with Psychic weapons) ticked: the Daemon Prince's
  // Hellforged weapons (A6 WS 2+ S9 D4, [PSYCHIC]) at a typed T5 target, no save: 6 × 5/6 = 5 hits × 5/6 (3+ → 2+) × 4
  ['Kindred Sorcery: the picked ability counts', () => { const s = { army:'pubstomper', ph:'fight', atk:'daemon-prince-of-tzeentch-with-wings', typed:{ n:1, T:5, W:30, Sv:0 }, val:{ 'pick:Kindred Sorcery':'Psychic Maelstrom' } };
    s.on = { [box(s, 'Kindred Sorcery').k]:true }; return exact(s); }, 5 * 5 / 6 * 4],
  ['Kindred Sorcery: a pick, not greyed as range-only', () => +(box({ army:'pubstomper', ph:'fight', atk:'daemon-prince-of-tzeentch-with-wings', typed:{} }, 'Kindred Sorcery').state === 'choice'), 1],

  // ---- a rule that changes range moves half range (24.25, 24.30) ----
  // Dakka! Dakka! Dakka! (+3" while riled up) ticked: the Flash Gitz' Cutta (12", [MELTA 2], [RAPID FIRE 1]) has half range 7.5", so
  // within 7.5" both apply: 10 × 2 attacks × 3/6 × 5/6 (S9 vs T4: 2+) × 5/6 (Sv 3+ AP-3: 6+) × (D3+2 + 2 = 6) = 41.7
  // the bands are the half ranges with and without every range rule here, so ticking one moves no band: "within 7.5", not 6""
  // keeps its meaning (v1 renamed the bands: same taps, a different answer)
  ['range rule ticked or not: the same bands', () => +(dm.calc({ army:'shooty', ph:'shooting', atk:'mek-flashgitz', typed:{ n:10, T:4, W:1, Sv:3 }, on:{ [DAKKA]:true } }).ctx.halves.join() === '7.5,6' &&
    dm.calc({ army:'shooty', ph:'shooting', atk:'mek-flashgitz', typed:{ n:10, T:4, W:1, Sv:3 } }).ctx.halves.join() === '7.5,6'), 1],
  ['range rule ticked: within 7.5", the Cutta gets both', () => (c => C.explain(c.input).groups[1].dmg)(dm.calc({ army:'shooty', ph:'shooting', atk:'mek-flashgitz', typed:{ n:10, T:4, W:1, Sv:3 }, on:{ [DAKKA]:true }, val:{ half:7.5 } })), 10 * 2 * 3 / 6 * 5 / 6 * 5 / 6 * 6],
  // ... and unticked, its half range is 6": "within 7.5"" is the 12" band, and neither applies: 10 × 3/6 × 5/6 × 5/6 × 4
  ['range rule unticked: the Cutta at 7.5" gets neither', () => (c => C.explain(c.input).groups[1].dmg)(dm.calc({ army:'shooty', ph:'shooting', atk:'mek-flashgitz', typed:{ n:10, T:4, W:1, Sv:3 }, val:{ half:7.5 } })), 10 * 3 / 6 * 5 / 6 * 5 / 6 * 4],
  // the working says where the half range comes from
  ['range rule: named in the working', () => +C.explain(dm.calc({ army:'shooty', ph:'shooting', atk:'mek-flashgitz', typed:{ n:10, T:4, W:1, Sv:3 }, on:{ [DAKKA]:true }, val:{ half:7.5 } }).input).groups[1].steps[0].t.includes('within half range (7.5" (range 12" +3" Dakka! Dakka! Dakka! = 15")'), 1],

  // ---- the working's steps multiply out as shown (the reviewer's Warpflamers: 10.5, not 11) ----
  ['steps: 3.5 × 3 = 10.5, then 10.5 × 14/36 = 4.08', () => +(w => w.includes('× 3 = 10.5') && w.includes('10.5 × (2/6 + 1/6 × 2/6 = 14/36) = 4.08'))(C.explain(dm.calc({ army:'pubstomper', opp:'princes', ph:'shooting', atk:'sorcerer-rubric-marines', tgt:'lord-on-juggernaut-khorne-berzerkers' }).input).groups.flatMap(g => g.steps.map(x => x.t)).join('\n')), 1],
  // ---- W1 models: destroyed and wounds lost are the same number (Khârn + Berzerkers shoot 10 Tzaangors: 3.1 and 3.1) ----
  ['W1 target: destroyed = wounds lost', () => (c => { const r = C.run(c.input), x = C.explain(c.input, r.orderIdx), v = dm.app.dmShown(c, r, x); return +(C.fmt(v.killed) === C.fmt(v.lost)); })(dm.calc({ army:'princes', opp:'pubstomper', ph:'shooting', atk:'kh-rn-the-betrayer-khorne-berzerkers', tgt:'tzaangors' })), 1],
  // ---- the working names a bonus the printed value already includes (New Recruit): Gorechild's A includes Relentless Rage ----
  ['the working names included bonuses', () => +/^Attacks: \d+ \(includes Relentless Rage\)/.test(C.explain(dm.calc({ army:'princes', opp:'pubstomper', ph:'fight', atk:'kh-rn-the-betrayer-khorne-berzerkers', tgt:'tzaangors' }).input).groups.flatMap(g => g.steps.map(x => x.t)).find(t => /includes Relentless Rage/.test(t)) || ''), 1],
  ['the working names included keywords', () => +C.explain(dm.calc({ army:'pubstomper', ph:'shooting', atk:'sorcerer-rubric-marines', typed:{ n:10, T:4, W:1, Sv:3 } }).input).groups.flatMap(g => g.steps.map(x => x.t)).some(t => t.includes('[LETHAL HITS] (24.23, from Empyric Guidance)')), 1],
  // ---- v2: the situation reaches every rule with that condition; "they attack" is a real swap; picks; the return blow ----
  // "This unit or the target within range of an objective" ticks Finderz Keeperz (+1 AP) and Wreckin' and Lootin' (re-roll hit rolls
  // of 1) at once. Flash Gitz at 10 typed T4 W1 Sv 3+ models, before allocation: Cutta 10 × (3/6 + 1/6 × 3/6) = 5.83 hits × 5/6
  // (S9 vs T4: 2+) = 4.86, AP-3 +1 → -4 vs 3+: no save, × D3+2 (4) = 19.44; Mega-slugga 3 × 21/36 = 1.75 × 5/6 = 1.46, AP-3 vs 3+:
  // 6+ (5/6 fail) = 1.22 × 3 = 3.65
  ['a situation ticks its rules: objective', () => exact({ army:'shooty', ph:'shooting', atk:'mek-flashgitz', typed:{ n:10, T:4, W:1, Sv:3 }, on:{ 'c:obj':true } }), 10 * 21 / 36 * 5 / 6 * 4 + 3 * 21 / 36 * 5 / 6 * 5 / 6 * 3],
  ['a situation ticks its rules: both say why', () => +['Finderz Keeperz', 'Wreckin’ and Lootin’'].every(n => (b => b.on && /^ticked with/.test(b.why))(box({ army:'shooty', ph:'shooting', atk:'mek-flashgitz', typed:{ n:10, T:4, W:1, Sv:3 }, on:{ 'c:obj':true } }, n))), 1],
  // "They attack": the same two units the other way round; a charge ticked for your fight is not in theirs, and is back when you swap back
  ['they attack: the same two units, the charge not carried', () => { dm.calc({ army:'melee', opp:'princes', ph:'fight', atk:'nazdreg-meganobz', tgt:'kh-rn-the-betrayer-khorne-berzerkers', on:{ 'c:charged':true } });
    const st = dm.app.dmState(); dm.app.dmSwap(st, dm.app.dmPair(st)); const P = dm.app.dmPair(st);
    const ok1 = P.au.id === 'kh-rn-the-betrayer-khorne-berzerkers' && P.tu.id === 'nazdreg-meganobz' && st.on['c:charged'] == null;
    dm.app.dmSwap(st, P); return +(ok1 && st.dir === 'me' && st.on['c:charged'] === true && dm.app.dmPair(st).tu.id === 'kh-rn-the-betrayer-khorne-berzerkers'); }, 1],
  // ... and its numbers are the review's for Khârn + Berzerkers fighting Nazdreg + Meganobz (3.39 models, independently worked out)
  ['they attack: Khârn + Berzerkers fight Nazdreg + Meganobz', () => { dm.calc({ army:'melee', opp:'princes', ph:'fight', atk:'nazdreg-meganobz', tgt:'kh-rn-the-betrayer-khorne-berzerkers' });
    const st = dm.app.dmState(); dm.app.dmSwap(st, dm.app.dmPair(st)); const P = dm.app.dmPair(st);
    return C.run(Object.assign({}, dm.app.dmCalc(st, P.A, P.B, P.au, P.tu, P.kind).input, { sims:20000 })).killed; }, 3.39],
  // Murderous Imperative, a pick of two: Conqueror (re-roll wound rolls of 1). 7 galvanic rifles × 2 at a typed T4 Sv 4+: 14 × 3/6 = 7 hits
  // × (3/6 + 1/6 × 3/6) × 3/6 fail = 2.04
  ['a pick: Murderous Imperative, Conqueror', () => { const s = { army:'purge-goes-the-foe', ph:'shooting', atk:'skitarii-rangers', typed:{ n:10, T:4, W:1, Sv:4 }, val:{ 'pick:Murderous Imperative':'Conqueror' } };
    s.on = { [box(s, 'Murderous Imperative').k]:true }; return C.explain(dm.calc(s).input).groups[0].dmg; }, 14 * 3 / 6 * 21 / 36 * 3 / 6],
  ['a pick: Unshackled Wrath is a choice now', () => +(box({ army:'purge-goes-the-foe', ph:'shooting', atk:'skitarii-rangers', typed:{} }, 'Unshackled Wrath').state === 'choice'), 1],
  // Wrath Beyond Reason (-1 D to ranged attacks that target it), counted: Flash Gitz at Chaos Terminators (T6, Sv 2+, InSv 4+): Cutta
  // 10 × 3/6 × 4/6 × 3/6 × (4 - 1) = 5.0; Mega-slugga 3 × 3/6 × 4/6 × 3/6 × (3 - 1) = 1.0 (unticked: 8.17)
  ['Wrath Beyond Reason: -1 D counted', () => { const s = { army:'shooty', opp:'super-terminators', ph:'shooting', atk:'mek-flashgitz', tgt:'chaos-terminators' }; s.on = { [box(s, 'Wrath Beyond Reason').k]:true }; return exact(s); }, 6.0],
  // the return blow keeps the rarer loadouts to the last: 3 Berzerkers left of Khârn's 10 are the Champion and the two with eviscerators
  ['what is left strikes back: the rarer weapons kept', () => { const c = dm.calc({ army:'melee', opp:'princes', ph:'fight', atk:'nazdreg-meganobz', tgt:'kh-rn-the-betrayer-khorne-berzerkers' });
    return +(dm.app.dmAliveLines(c.tu, c.models, [0, 3]).join() === '0,1,0,2' && dm.app.dmAliveLines(c.tu, c.models, c.models.map(m => m.count)).join() === '1,1,7,2'); }, 1],
];
for(const x of app) cases.push(x);

// ---- two methods agree: the working's exact averages (explain) and the dice played out (run), over real matchups ----
// Every list against every other, the first two units each side, shooting and fight, three tick-box states (as the screen
// starts; every choice ticked; every box unticked), sampled. The target is made one group of models enough for every attack
// (nothing lost to allocation), so the two must agree within dice noise: 5 standard errors of the games' averages.
const sweep = { matchups:0, compared:0, bad:[], chains:0, chainBad:[], w1:0, w1Bad:[] };
// every "a × b × c/d = r" in the working, with the numbers as shown: the product must come out as r, within the rounding of
// what is shown (half a unit of r's last digit, and 0.5% for each operand rounded to its shown digits)
const NUMR = '\\d+(?:\\.\\d+)?', OP = '(?:' + NUMR + '/' + NUMR + '|' + NUMR + '|\\([^()]*= ' + NUMR + '/' + NUMR + '\\))';
const CHAIN = new RegExp('(' + OP + '(?: × ' + OP + ')+) = (' + NUMR + ')(?![\\d/])', 'g');
const chainsOf = text => [...text.matchAll(CHAIN)].map(m => {
  let rounded = 0;
  const val = o => { const f = /(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\)?$/.exec(o); if(f) return +f[1] / +f[2]; if(/\./.test(o)) rounded++; return +o; };
  const prod = [...m[1].matchAll(new RegExp(OP, 'g'))].reduce((t, o) => t * val(o[0]), 1), r = +m[2], dec = (m[2].split('.')[1] || '').length;
  return { text:m[0], ok:Math.abs(prod - r) <= 0.5 * Math.pow(10, -dec) + 0.005 * rounded * Math.abs(prod) + 1e-9, prod };
});
{
  const A = dm.D.armies, pick = (l, n) => l.slice(0, n);
  let i = 0;
  for(const a of A) for(const b of A) if(a !== b) for(const ph of ['shooting', 'fight']) for(const au of pick(a.units.filter(u => (ph === 'fight' ? u.melee : u.ranged || []).length), 2)) for(const tu of pick(b.units, 2)) for(const state of ['start', 'all', 'none']){
    if((i++ % 11) !== 0) continue;   // a fixed sample, the same every run
    const s = { army:a.id, opp:b.id, ph, atk:au.id, tgt:tu.id, on:{} };
    const c0 = dm.calc(s);
    if(state !== 'start') for(const x of c0.rules.concat(c0.defs)) if(x.state === 'choice' || x.state === 'on') s.on[x.k] = state === 'all';
    if(state === 'all') for(const k of ['cover', 'plunging', 'charged', 'heavy', 'prec']) s.on['c:' + k] = true;
    const c = dm.calc(s);
    if(!c || !c.input.groups.length) continue;
    // the working as shown: its steps multiply out
    for(const g of C.explain(c.input).groups) for(const st of g.steps) for(const ch of chainsOf(st.t)){ sweep.chains++; if(!ch.ok) sweep.chainBad.push(a.id + '/' + au.id + ' → ' + b.id + '/' + tu.id + ': ' + ch.text + ' (the shown numbers give ' + ch.prod.toFixed(4) + ')'); }
    const first = C.explain(c.input), row = c.models.find(m => m.name === first.meets) || c.models[0];
    const one = Object.assign({}, row, { count:1, W:1e9, char:!!row.char, bodyguard:false, T:first.T });
    const input = Object.assign({}, c.input, { target:Object.assign({}, c.input.target, { models:[one], kw:row.char ? c.input.target.kw : c.input.target.kw.filter(k => !/^character$/i.test(k)) }), ctx:Object.assign({}, c.input.ctx, { precision:null }), sims:3000, seed:5, moments:true });
    const x = C.explain(input), r = C.run(input);
    sweep.matchups++;
    x.groups.forEach((e, gi) => { if(e.out) return; for(const k of ['attacks', 'hits', 'wounds', 'unsaved', 'mortals', 'dmg']){
      sweep.compared++;
      const tol = 5 * r.groups[gi].sd[k] / Math.sqrt(input.sims) + 1e-6 * Math.max(1, Math.abs(e[k]));
      if(Math.abs(e[k] - r.groups[gi][k]) > tol) sweep.bad.push(a.id + '/' + au.id + ' → ' + b.id + '/' + tu.id + ' ' + ph + ' ' + state + ' · ' + c.input.groups[gi].name + ' ' + k + ': exact ' + e[k].toFixed(3) + ', played ' + r.groups[gi][k].toFixed(3) + ' (±' + tol.toFixed(3) + ')'); } });
  }
}
// one stats row of W1 models: models destroyed and wounds lost are shown as the same number (every list's first two attackers
// against every such unit of the other lists, shooting and fight, every 3rd)
{
  const A = dm.D.armies;
  let i = 0;
  for(const a of A) for(const b of A) if(a !== b) for(const tu of b.units) for(const ph of ['shooting', 'fight']) for(const au of a.units.filter(u => (ph === 'fight' ? u.melee : u.ranged || []).length).slice(0, 2)){
    const c = dm.calc({ army:a.id, opp:b.id, ph, atk:au.id, tgt:tu.id });
    if(!c || c.models.length !== 1 || c.models[0].W !== 1 || !c.input.groups.length || (i++ % 3) !== 0) continue;
    const r = C.run(Object.assign({}, c.input, { sims:2000 }));
    if(r.groups.every(g => g.out)) continue;
    const v = dm.app.dmShown(c, r, C.explain(c.input, r.orderIdx)); sweep.w1++;
    if(C.fmt(v.killed) !== C.fmt(v.lost)) sweep.w1Bad.push(a.id + '/' + au.id + ' → ' + b.id + '/' + tu.id + ' ' + ph + ': ' + C.fmt(v.killed) + ' destroyed, ' + C.fmt(v.lost) + ' wounds lost');
  }
}
cases.push(['two methods agree: ' + sweep.matchups + ' matchups, ' + sweep.compared + ' averages', () => sweep.bad.length, 0]);
for(const t of sweep.bad.slice(0, 20)) console.log('  ' + t);
cases.push(['the working multiplies out as shown: ' + sweep.chains + ' products', () => sweep.chainBad.length, 0]);
for(const t of sweep.chainBad.slice(0, 20)) console.log('  ' + t);
cases.push(['W1 targets: destroyed = wounds lost in ' + sweep.w1 + ' matchups', () => sweep.w1Bad.length, 0]);
for(const t of sweep.w1Bad.slice(0, 20)) console.log('  ' + t);

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
