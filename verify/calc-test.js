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
  // ([TORRENT] weapons cannot have [PRECISION], 24.37: these attacks hit on 2+, 5/6, so each gets through 5/6 × 5/6 = 25/36)
  ['precision: allocated to the character', () => run([g({ n:2, skill:'2+', S:8, D:'3', kw:['PRECISION'] })], { T:4, models:[big(10, 1), big(1, 3, 7, { name:'Boss', char:true })] }, { precision:'Boss' }).dmg, 3 * (1 - (11 / 36) ** 2) + (25 / 36) ** 2],
  // ... and not picked: the W1 models first, 1 wound each (excess lost): 2 × 5/6
  ['precision: not picked', () => run([g({ n:2, skill:'2+', S:8, D:'3', kw:['PRECISION'] })], { T:4, models:[big(10, 1), big(1, 3, 7, { name:'Boss', char:true })] }).dmg, 2 * 25 / 36],
  // [TORRENT] weapons cannot have [PRECISION] (24.37): a [TORRENT] weapon given it is not precise, the attacks go to the bodyguard
  ['precision: never on a [TORRENT] weapon (24.37)', () => run([g({ n:2, S:8, D:'3', kw:['TORRENT', 'PRECISION'] })], { T:4, models:[big(10, 1), big(1, 3, 7, { name:'Boss', char:true })] }, { precision:'Boss' }).dmg, 2 * 5 / 6],
  ['precision: never on a [TORRENT] weapon, from a rule either', () => +!C.resolve({ groups:[g({ kw:['TORRENT'], mods:[{ from:'Precision (ticked with the target)', precision:true }] })], target:{ T:4, models:[big(10, 1)] }, ctx:{} }).groups[0].precision, 1],
  // [PRECISION] + [DEVASTATING WOUNDS]: the mortal wounds go to the picked CHARACTER first; [ANTI-INFANTRY 2+] makes every
  // wound (2+ at S4 vs T4 with Anti) critical: the same as above, as mortal wounds
  ['precision + devastating wounds: mortals to the character', () => run([g({ n:2, skill:'2+', S:4, D:'3', kw:['PRECISION', 'DEVASTATING WOUNDS', 'ANTI-INFANTRY 2+'] })], { T:4, kw:['Infantry'], models:[big(10, 1), big(1, 3, 7, { name:'Boss', char:true })] }, { precision:'Boss' }).dmg, 3 * (1 - (11 / 36) ** 2) + (25 / 36) ** 2],

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

  // ---- what is left after each game (run with track), a CHARACTER's fate (fate), the return blow (play) ----
  // one torrent attack, S8 vs T4 (2+), no save, at 2 W1 models: 1 is left in 5/6 of the games, 2 in 1/6
  ['what is left: 1 of 2 models in 5/6 of the games', () => (C.run({ groups:[g({ S:8, kw:['TORRENT'] })], target:{ T:4, models:[big(2, 1)] }, ctx:{}, sims:20000, seed:11, track:true }).left.find(x => x.n[0] === 1) || { p:0 }).p, 5 / 6, 0.015],
  // a bodyguard model (W1) and a CHARACTER (W1, its group last): two torrent attacks, S8 vs T4, no save: the CHARACTER is destroyed
  // only when both wound: (5/6)² = 25/36
  ['a CHARACTER’s fate: destroyed in 25/36', () => C.run({ groups:[g({ n:2, S:8, kw:['TORRENT'] })], target:{ T:4, models:[big(1, 1, 7, { bodyguard:true }), big(1, 1, 7, { name:'Boss', char:true })] }, ctx:{}, sims:20000, seed:11, track:true }).fate[1], 25 / 36, 0.015],
  // the return blow: what is left of those 2 models (each with one torrent attack, S8 vs T4: 5/6) attacks 3 W1 models back:
  // (5/6 × 1 + 1/6 × 2) × 5/6 = 35/36 destroyed
  ['return blow: what is left strikes back, 35/36', () => C.play({ beats:[{ side:1, input:{ groups:[g({ S:8, kw:['TORRENT'] })], target:{ T:4, models:[big(2, 1, 7, { lines:[{ id:0, n:2 }] })] }, ctx:{} } },
    { side:0, input:{ groups:[g({ name:'back', n:2, S:8, kw:['TORRENT'], carry:[[0, 1]] })], target:{ T:4, models:[big(3, 1)] }, ctx:{} } }], sims:20000, seed:11 }).beats[1].killed, 35 / 36],
  // ... and a unit wiped out strikes back with nothing: one torrent attack S4 vs T4 (4+) at 1 W1 model leaves it in half of the
  // games; it has 2 torrent attacks, S8 vs T4, at 5 W1 models: 1/2 × 2 × 5/6
  ['return blow: a destroyed unit attacks with nothing', () => C.play({ beats:[{ side:1, input:{ groups:[g({ kw:['TORRENT'] })], target:{ T:4, models:[big(1, 1, 7, { lines:[{ id:0, n:1 }] })] }, ctx:{} } },
    { side:0, input:{ groups:[g({ name:'back', A:'2', S:8, kw:['TORRENT'], carry:[[0, 1]] })], target:{ T:4, models:[big(5, 1)] }, ctx:{} } }], sims:20000, seed:11 }).beats[1].killed, 1 / 2 * 2 * 5 / 6],
  ['return blow: every game is played (the chances add up to 1)', () => C.play({ beats:[{ side:1, input:{ groups:[g({ kw:['TORRENT'] })], target:{ T:4, models:[big(1, 1, 7, { lines:[{ id:0, n:1 }] })] }, ctx:{} } },
    { side:0, input:{ groups:[g({ name:'back', A:'2', S:8, kw:['TORRENT'], carry:[[0, 1]] })], target:{ T:4, models:[big(5, 1)] }, ctx:{} } }], sims:2000, seed:11 }).beats[1].dist.reduce((t, p) => t + p, 0), 1, 1e-9],
  // a CHARACTER's own rules stop when it is destroyed (alt): the bodyguard's weapon (4+ to hit, re-roll hit rolls with the
  // CHARACTER alive) fights back; the first beat (1 [PRECISION] attack at 2+, S8, D1, no save, allocated to the CHARACTER) destroys it
  // in 25/36 of the games: 11/36 × (3/6 + 3/6 × 3/6) + 25/36 × 3/6 = 0.576 hits back
  ['return blow: a destroyed CHARACTER’s rule stops counting', () => C.play({ beats:[{ side:1, input:{ groups:[g({ skill:'2+', S:8, kw:['PRECISION'] })], target:{ T:4, models:[big(1, 1, 7, { name:'Boss', char:true, lines:[{ id:0, n:1 }] }), big(1, 9, 7, { name:'guard', lines:[{ id:1, n:1 }] })] }, ctx:{ precision:'Boss' } } },
    { side:0, input:{ groups:[g({ name:'back', carry:[[1, 1]], mods:[{ from:'Boss’s rule', rrHit:'all' }] })], target:{ T:4, models:[big(100, 10)] }, ctx:{} },
      alt:{ lines:[0], input:{ groups:[g({ name:'back', carry:[[1, 1]], mods:[] })], target:{ T:4, models:[big(100, 10)] }, ctx:{} } } }], sims:20000, seed:11 }).beats[1].groups[0].hits, 11 / 36 * (3 / 6 + 3 / 6 * 3 / 6) + 25 / 36 * 3 / 6],
];

// ---- one beat after another in the same games (play): shoot, then fight, then what is left fights back ----
// binomial chances, for the cases below
const choose = (n, k) => { let c = 1; for(let i = 1; i <= k; i++) c = c * (n - k + i) / i; return c; };
const binom = (n, p, k) => choose(n, k) * p ** k * (1 - p) ** (n - k);
const E = (n, p, f) => { let t = 0; for(let k = 0; k <= n; k++) t += binom(n, p, k) * f(k); return t; };
// 6 torrent S8 attacks against T4 wound on 2+ (5/6); no save; W1 models: each wound destroys one
const shot6 = () => g({ name:'shot', n:6, S:8, kw:['TORRENT'] });
const tenW1 = (lines) => ({ T:4, models:[Object.assign(big(10, 1), lines ? { lines } : {})] });
const pl = (beats, sims) => C.play({ beats, sims:sims || 20000, seed:11 });
// the same target twice: 12 attacks in all, at most 10 destroyed: E[min(K, 10)], K ~ Binomial(12, 5/6) = 9.51 (not 10)
cases.push(['play: shoot then fight the same unit: destroyed by the end', () => pl([{ side:1, input:{ groups:[shot6()], target:tenW1() } }, { side:1, input:{ groups:[shot6()], target:tenW1() } }]).sides[1].killed, E(12, 5 / 6, k => Math.min(k, 10))]);
// ... the second beat destroys what the first left over: 9.51 - 5
cases.push(['play: the second beat counts only its own', () => pl([{ side:1, input:{ groups:[shot6()], target:tenW1() } }, { side:1, input:{ groups:[shot6()], target:tenW1() } }]).beats[1].killed, E(12, 5 / 6, k => Math.min(k, 10)) - 5]);
// what is left hits back: 10 models with one A1 torrent S8 attack each, after the 6 attacks destroyed K ~ Binomial(6, 5/6) of
// them: (10 - 5) × 5/6 = 4.17 of side 0's W1 models destroyed (side 0: 100 models, T4, no save)
cases.push(['play: the return blow from what is left', () => pl([{ side:1, input:{ groups:[shot6()], target:tenW1([{ id:0, n:10 }]) } },
  { side:0, input:{ groups:[g({ name:'back', n:10, S:8, kw:['TORRENT'], carry:[[0, 1]] })], target:{ T:4, models:[big(100, 1)] } } }]).beats[1].killed, 25 / 6]);
// ... and only the models left hit back, none once all are destroyed: 6 attacks against 5 models, each 1 attack back:
// E[max(0, 5 - K)] × 5/6 = 0.28 (at full strength it would be 4.17)
cases.push(['play: the return blow after most are destroyed', () => pl([{ side:1, input:{ groups:[shot6()], target:{ T:4, models:[big(5, 1, 7, { lines:[{ id:0, n:5 }] })] } } },
  { side:0, input:{ groups:[g({ name:'back', n:5, S:8, kw:['TORRENT'], carry:[[0, 1]] })], target:{ T:4, models:[big(100, 1)] } } }]).beats[1].killed, E(6, 5 / 6, k => Math.max(0, 5 - k)) * 5 / 6]);
// the defender removes the first models line first (05.04 Select Model; the app lists the rank and file first): 8 plain models,
// then 2 with a special weapon. 6 attacks destroy at most 6, so both specials always hit back (2) and 8 - 5 = 3 plain ones
cases.push(['play: models lines, the first removed first: plain weapons left', () => pl([{ side:1, input:{ groups:[shot6()], target:tenW1([{ id:0, n:8 }, { id:1, n:2 }]) } },
  { side:0, input:{ groups:[g({ name:'plain', n:8, S:8, kw:['TORRENT'], carry:[[0, 1]] }), g({ name:'special', n:2, S:8, kw:['TORRENT'], carry:[[1, 1]] })], target:{ T:4, models:[big(100, 1)] } } }]).beats[1].groups[0].n, 3]);
cases.push(['play: models lines, the first removed first: special weapons left', () => pl([{ side:1, input:{ groups:[shot6()], target:tenW1([{ id:0, n:8 }, { id:1, n:2 }]) } },
  { side:0, input:{ groups:[g({ name:'plain', n:8, S:8, kw:['TORRENT'], carry:[[0, 1]] }), g({ name:'special', n:2, S:8, kw:['TORRENT'], carry:[[1, 1]] })], target:{ T:4, models:[big(100, 1)] } } }]).beats[1].groups[1].n, 2]);
// a rule that reaches 2 of a weapon's 10 models (slice [0, 2]) keeps them longest: 2 left; the other 8 (slice [2, 10]): 8 - 5 = 3
cases.push(['play: a weapon split by a rule: the part it reaches', () => pl([{ side:1, input:{ groups:[shot6()], target:tenW1([{ id:0, n:10 }]) } },
  { side:0, input:{ groups:[g({ name:'with', n:2, S:8, kw:['TORRENT'], carry:[[0, 1]], slice:[0, 2] }), g({ name:'without', n:8, S:8, kw:['TORRENT'], carry:[[0, 1]], slice:[2, 10] })], target:{ T:4, models:[big(100, 1)] } } }]).beats[1].groups[0].n, 2]);
cases.push(['play: a weapon split by a rule: the rest', () => pl([{ side:1, input:{ groups:[shot6()], target:tenW1([{ id:0, n:10 }]) } },
  { side:0, input:{ groups:[g({ name:'with', n:2, S:8, kw:['TORRENT'], carry:[[0, 1]], slice:[0, 2] }), g({ name:'without', n:8, S:8, kw:['TORRENT'], carry:[[0, 1]], slice:[2, 10] })], target:{ T:4, models:[big(100, 1)] } } }]).beats[1].groups[1].n, 3]);
// a CHARACTER's own fate (05.03: its group last): 1 W1 CHARACTER behind 5 W1 bodyguard models is destroyed only when all 6
// attacks wound: (5/6)^6 = 0.335
cases.push(['play: the character destroyed', () => pl([{ side:1, input:{ groups:[shot6()], target:{ T:4, models:[big(5, 1, 7, { name:'guard', bodyguard:true }), big(1, 1, 7, { name:'Boss', char:true })] } } }]).sides[1].rows[1].gone, (5 / 6) ** 6]);
// [BLAST] counts the models left at the start of the second beat (24.05): 1 + 2 dice with 10 left (K = 0), 1 + 1 with 5-9
// (K 1-5), 1 with 4 (K = 6)
cases.push(['play: [BLAST] counts the models left', () => pl([{ side:1, input:{ groups:[shot6()], target:tenW1() } }, { side:1, input:{ groups:[g({ name:'blast', kw:['BLAST'] })], target:tenW1() } }]).beats[1].groups[0].attacks,
  binom(6, 5 / 6, 0) * 3 + (1 - binom(6, 5 / 6, 0) - binom(6, 5 / 6, 6)) * 2 + binom(6, 5 / 6, 6) * 1]);
// a beat's numbers do not move when a later beat is added (each beat has its own dice)
cases.push(['play: a later beat leaves the earlier ones as they were', () => (b0 => +(JSON.stringify(pl([b0], 3000).beats[0]) === JSON.stringify(pl([b0, { side:0, input:{ groups:[g({ name:'back', n:10, S:8, kw:['TORRENT'], carry:[[0, 1]] })], target:{ T:4, models:[big(100, 1)] } } }], 3000).beats[0])))({ side:1, input:{ groups:[shot6()], target:tenW1([{ id:0, n:10 }]) } }), 1]);
// one beat alone is run itself (the same dice)
cases.push(['play: one beat = run', () => (inp => +(C.play({ beats:[{ side:1, input:inp }], sims:3000, seed:3 }).beats[0].killed === C.run(Object.assign({ sims:3000, seed:3 }, inp)).killed))({ groups:[g({ n:5, A:'D6', S:5, AP:-1, D:'2' })], target:{ T:4, models:[big(10, 2, 4)] } }), 1]);
// One Last Kill (onDeath { lines, need }): 60 [TORRENT] S8 attacks (5/6 each) destroy all 10 W1 models of side 1 in a Fight-phase
// beat (fewer than 10 of 60 wounding: about 1e-27); each destroyed model still fights on a 2+, rolled for each: 10 × 5/6 = 8.33
// models fight back with one [TORRENT] S8 attack each, 8.33 × 5/6 = 6.94 of side 0's W1 models destroyed; they are then removed
const olk = (od, fight) => pl([{ side:1, fight, input:{ groups:[g({ name:'kill', n:60, S:8, kw:['TORRENT'] })], target:tenW1([{ id:0, n:10 }]) } },
  Object.assign({ side:0, fight:true, input:{ groups:[g({ name:'back', n:10, S:8, kw:['TORRENT'], carry:[[0, 1]] })], target:{ T:4, models:[big(100, 1)] } } }, od ? { onDeath:od } : {})]);
cases.push(['One Last Kill: destroyed models fight on a 2+, rolled for each', () => olk({ lines:[0], need:2 }, true).beats[1].groups[0].n, 10 * 5 / 6]);
cases.push(['One Last Kill: what they destroy', () => olk({ lines:[0], need:2 }, true).beats[1].killed, 10 * 5 / 6 * 5 / 6]);
cases.push(['One Last Kill: they are removed all the same', () => olk({ lines:[0], need:2 }, true).sides[1].killed, 10, 0]);
cases.push(['One Last Kill: without it, none fight back', () => olk(null, true).beats[1].groups[0].n, 0, 0]);
cases.push(['One Last Kill: destroyed by shooting, none fight back', () => olk({ lines:[0], need:2 }, false).beats[1].groups[0].n, 0, 0]);
cases.push(['One Last Kill: only the models lines it names', () => olk({ lines:[1], need:2 }, true).beats[1].groups[0].n, 0, 0]);
// hazard rolls after a beat (24.15, 06.03): 6 [HAZARDOUS] weapons, one roll each, each 1-2 one mortal wound on the attacking unit
// (self: side 0, 6 models of W2, no save), allocated per 06.02: a model that has lost a wound first, so of K failed rolls
// (K ~ Binomial(6, 1/3)) floor(K/2) models are destroyed; with Feel No Pain 5+ each mortal wound is ignored on a 5+ (4/6 lost)
const six = (W, mod) => ({ T:4, models:[big(6, W, 7, { lines:[{ id:0, n:6 }] })], mod:mod || {} });
const hzIn = { groups:[g({ name:'plasma', n:6, S:8, kw:['TORRENT', 'HAZARDOUS'] })], target:tenW1() };
const hz = (self, mw, more) => pl([{ side:1, hazard:{ mw:mw || 1 }, self, input:hzIn }].concat(more || []));
cases.push(['hazard: one roll for each [HAZARDOUS] weapon', () => hz(six(2)).beats[0].hazard.rolls, 6, 0]);
cases.push(['hazard: mortal wounds, 6 × 2/6', () => hz(six(2)).beats[0].hazard.mw, 2, 0.05]);
cases.push(['hazard: the model that lost a wound first (06.02): models destroyed', () => hz(six(2)).beats[0].hazard.dead, E(6, 1 / 3, k => Math.floor(k / 2)), 0.03]);
cases.push(['hazard: Feel No Pain 5+ against them', () => hz(six(2, { fnp:5 })).beats[0].hazard.lost, 2 * 4 / 6, 0.05]);
cases.push(['hazard: 3 mortal wounds a failed roll (MONSTER/VEHICLE)', () => hz(six(2), 3).beats[0].hazard.mw, 6, 0.15]);
cases.push(['hazard: the beat’s own damage is run’s (the same dice)', () => +(hz(six(2)).beats[0].killed === C.run(Object.assign({ sims:20000, seed:11 }, hzIn)).killed), 1]);
// ... and the models it destroys do not attack in a later beat: 6 - E[floor(K/2)] attack again
cases.push(['hazard: its losses carry into the next beat', () => hz(six(2), 1, [{ side:1, input:{ groups:[g({ name:'again', n:6, S:8, kw:['TORRENT'], carry:[[0, 1]] })], target:tenW1() } }]).beats[1].groups[0].n,
  6 - E(6, 1 / 3, k => Math.floor(k / 2)), 0.03]);
// a comeback at the end of the phase it is first destroyed in (target.revive: Berserker Frenzy): a W3 CHARACTER destroyed by 20
// [TORRENT] S8 attacks (3 of 20 wounding at 5/6: certain) is set back up on a 2+: destroyed by the end of the beat 1, still down
// after the phase 1/6 (each game adds the chance its roll fails, 1/6, not the die itself: exact); once only: destroyed again in a later phase, it stays down; a beat later in the same phase still finds it gone
const boss = () => ({ T:4, models:[big(1, 3, 7, { name:'Boss', char:true })], revive:{ Boss:{ roll:2, wounds:3 } } });
const rvb = ph => ({ side:1, fight:true, ph, input:{ groups:[g({ name:'kill', n:20, S:8, kw:['TORRENT'] })], target:boss() } });
cases.push(['comeback: destroyed by the end of the beat', () => pl([rvb('fight')]).beats[0].rows[0].gone, 1, 0.001]);
cases.push(['comeback: still down after the phase, 1/6 (counted as its roll’s chance)', () => pl([rvb('fight')]).beats[0].rows[0].down, 1 / 6, 1e-9]);
cases.push(['comeback: the side at the end', () => pl([rvb('fight')]).sides[1].rows[0].gone, 1 / 6, 1e-9]);
cases.push(['comeback: models left at the end, 5/6', () => pl([rvb('fight')]).sides[1].rows[0].left, 5 / 6, 1e-9]);
cases.push(['comeback: the first time only', () => pl([rvb('shooting'), rvb('fight')]).sides[1].rows[0].gone, 1, 0.001]);
cases.push(['comeback: later in the same phase it is still gone', () => pl([rvb('fight'), rvb('fight')]).beats[1].dmg, 0, 0]);
cases.push(['comeback: ... and back after it', () => pl([rvb('fight'), rvb('fight')]).beats[1].rows[0].down, 1 / 6, 1e-9]);
cases.push(['comeback: wiped once the phase is over, 1/6', () => pl([rvb('fight')]).beats[0].wipeDown, 1 / 6, 1e-9]);
// a side no beat describes loses no models: its alternative (the attacks once its CHARACTER is dead) is never used; with its own
// models given (self) and nothing that destroys them, the same
const altB = self => ({ side:1, self, input:{ groups:[g({ name:'with', n:1, A:'2', S:8, kw:['TORRENT'] })], target:tenW1() },
  alt:{ lines:[0], input:{ groups:[g({ name:'with', n:1, S:8, kw:['TORRENT'] })], target:tenW1() } } });
cases.push(['play: an attacking side nothing describes keeps its models (no alternative)', () => pl([altB()]).beats[0].alt, 0, 0]);
cases.push(['play: ... its attacks as given (2 attacks × 5/6)', () => pl([altB()]).beats[0].killed, 2 * 5 / 6]);
cases.push(['play: ... and with its own models given, the same', () => pl([altB({ T:4, models:[big(1, 3, 7, { name:'Boss', char:true, lines:[{ id:0, n:1 }] })] })]).beats[0].alt, 0, 0]);
// hazard rolls from a rule's own words (hazard.rolls: Try Dat Button! with two D6, one roll for the unit), with the weapons' own:
// one roll for the unit, 3 mortal wounds on a 1-2: 1 on average; [SUPA-HAZARDOUS] makes two more for a weapon it shoots with (a
// weapon with both: three), none in a fight
const one10 = { T:9, models:[big(1, 10, 7, { lines:[{ id:0, n:1 }] })] };
cases.push(['hazard: a rule’s own roll for the unit', () => pl([{ side:1, hazard:{ mw:3, rolls:1 }, self:one10, input:{ groups:[g({ name:'gun', n:1, S:8, kw:['TORRENT'] })], target:tenW1() } }]).beats[0].hazard.mw, 1, 0.05]);
cases.push(['hazard: [HAZARDOUS] and [SUPA-HAZARDOUS] on one weapon: three rolls', () => pl([{ side:1, hazard:{ mw:1 }, self:one10, input:{ groups:[g({ name:'blasta', n:1, S:8, kw:['TORRENT', 'HAZARDOUS', 'SUPA-HAZARDOUS'] })], target:tenW1(), ctx:{ ranged:true } } }]).beats[0].hazard.rolls, 3, 0]);
cases.push(['hazard: [SUPA-HAZARDOUS] only when it shoots', () => pl([{ side:1, hazard:{ mw:1 }, self:one10, input:{ groups:[g({ name:'blasta', n:1, S:8, kw:['TORRENT', 'HAZARDOUS', 'SUPA-HAZARDOUS'] })], target:tenW1(), ctx:{} } }]).beats[0].hazard.rolls, 1, 0]);
cases.push(['hazard: no roll when the unit did not attack', () => pl([{ side:1, hazard:{ mw:3, rolls:1 }, self:one10, input:{ groups:[g({ name:'gun', n:1, S:8, kw:['TORRENT'], carry:[[5, 1]] })], target:tenW1() } }]).beats[0].hazard.rolls, 0, 0]);

// ---- the effects catalogue (effects.js): every effect a box or a custom modifier can have, as its mod, against values worked out by
// hand (verify/evidence.js G8: a case named 'fx:<id>' for each). The exact averages (explain) unless the dice are the point ----
const FXC = require('../effects.js');
const fxm = (id, p) => FXC.toMod([[id, p]]);
const ex1 = (gr, target, ctx) => C.explain({ groups:gr, target, ctx:ctx || {} }).groups[0];
const T4 = { T:4, models:[big(100, 10)] }, BIGW = { T:4, models:[big(1, 100000)] };
const fxCases = [
  // +1 to hit at 4+: 60 attacks, 40 hits; -1: 20
  ['fx:hit +1: hits', () => ex1([g({ n:60, mods:[fxm('hit', 1)] })], T4).hits, 40],
  ['fx:hit -1: hits', () => ex1([g({ n:60, mods:[fxm('hit', -1)] })], T4).hits, 20],
  // +1 to wound, S4 vs T4 (4+ → 3+), 60 [TORRENT] hits: 40
  ['fx:wound +1: wounds', () => ex1([g({ n:60, kw:['TORRENT'], mods:[fxm('wound', 1)] })], T4).wounds, 40],
  // re-roll one: one attack at 4+ re-rolling its failed hit roll: 1/2 + 1/2 × 1/2
  ['fx:oneHit: hits', () => ex1([g({ mods:[fxm('oneHit', true)] })], T4).hits, 0.75],
  ['fx:oneWound: wounds', () => ex1([g({ kw:['TORRENT'], mods:[fxm('oneWound', true)] })], T4).wounds, 0.75],
  // one Damage roll of D6 below 3.5 re-rolled: (1/2 × 3.5 + 1/2 × 5) × 5/6 (S8 vs T4: 2+), no save
  ['fx:oneDmg: damage', () => ex1([g({ S:8, D:'D6', kw:['TORRENT'], mods:[fxm('oneDmg', true)] })], BIGW).dmg, (0.5 * 3.5 + 0.5 * 5) * 5 / 6],
  // a hit or a wound roll, a hit, wound or Damage roll, and Command Re-roll's (once in the phase): one [TORRENT] attack, its wound roll
  ['fx:oneEither: wounds', () => ex1([g({ kw:['TORRENT'], mods:[fxm('oneEither', true)] })], T4).wounds, 0.75],
  ['fx:oneAny: wounds', () => ex1([g({ kw:['TORRENT'], mods:[fxm('oneAny', true)] })], T4).wounds, 0.75],
  ['fx:oneAnyPhase: wounds, once in the phase', () => +(ex1([g({ kw:['TORRENT'], mods:[fxm('oneAnyPhase', true)] })], T4).wounds === 0.75 && fxm('oneAnyPhase', true).phase === true), 1, 0],
  // re-rolls of the whole roll and of 1s: 60 at 4+
  ['fx:rrHit1: hits', () => ex1([g({ n:60, mods:[fxm('rrHit1', true)] })], T4).hits, 60 * (0.5 + 1 / 12)],
  ['fx:rrHit: hits', () => ex1([g({ n:60, mods:[fxm('rrHit', true)] })], T4).hits, 45],
  ['fx:rrWound1: wounds', () => ex1([g({ n:60, kw:['TORRENT'], mods:[fxm('rrWound1', true)] })], T4).wounds, 60 * (0.5 + 1 / 12)],
  ['fx:rrWound: wounds', () => ex1([g({ n:60, kw:['TORRENT'], mods:[fxm('rrWound', true)] })], T4).wounds, 45],
  // re-roll Damage rolls (new): every D6 below 3.5 re-rolled: 60 × 5/6 wounds × (1/2 × 3.5 + 1/2 × 5)
  ['fx:rrDmg: damage', () => ex1([g({ n:60, S:8, D:'D6', kw:['TORRENT'], mods:[fxm('rrDmg', true)] })], BIGW).dmg, 50 * 4.25],
  ['fx:rrDmg: played out', () => run([g({ n:60, S:8, D:'D6', kw:['TORRENT'], mods:[fxm('rrDmg', true)] })], BIGW).dmg, 50 * 4.25],
  // a D3 Damage the same: 1 (below 2) re-rolled: 1/3 × 2 + 2/3 × 2.5 = 2.33
  ['fx:rrDmg: D3', () => ex1([g({ n:60, S:8, D:'D3', kw:['TORRENT'], mods:[fxm('rrDmg', true)] })], BIGW).dmg, 50 * (1 / 3 * 2 + 1 / 3 * 2 + 1 / 3 * 3)],
  // a Critical Hit on 5+ with [SUSTAINED HITS 1]: 30 hits + 20 extra
  ['fx:critHit 5: hits', () => ex1([g({ n:60, kw:['SUSTAINED HITS 1'], mods:[fxm('critHit', 5)] })], T4).hits, 50],
  // a Critical Wound on 5+ with [DEVASTATING WOUNDS]: 20 of 60 [TORRENT] hits are mortals
  ['fx:critWound 5: mortals', () => ex1([g({ n:60, kw:['TORRENT', 'DEVASTATING WOUNDS'], mods:[fxm('critWound', 5)] })], T4).mortals, 20],
  // the weapon abilities a rule gives
  ['fx:lethal: wounds', () => ex1([g({ n:20, mods:[fxm('lethal', true)] })], { T:8, models:[big(20, 10)] }).wounds, 20 / 6 + 20 / 3 / 6],
  ['fx:dev: mortals', () => ex1([g({ n:36, D:2, kw:['TORRENT'], mods:[fxm('dev', true)] })], { T:4, models:[big(200, 10, 2)] }).mortals, 6],
  ['fx:twin: wounds', () => ex1([g({ n:60, kw:['TORRENT'], mods:[fxm('twin', true)] })], T4).wounds, 45],
  ['fx:lance: wounds after a charge', () => ex1([g({ n:60, kw:['TORRENT'], mods:[fxm('lance', true)] })], T4, { charged:true }).wounds, 40],
  ['fx:precision: the attacks are [PRECISION]', () => +C.resolve({ groups:[g({ mods:[fxm('precision', true)] })], target:T4, ctx:{} }).groups[0].precision, 1, 0],
  ['fx:ignoresCover: hits in cover', () => ex1([g({ n:60, mods:[fxm('ignoresCover', true)] })], T4, { ranged:true, cover:true }).hits, 30],
  ['fx:heavy: hits, remained stationary', () => ex1([g({ n:60, mods:[fxm('heavy', true)] })], T4, { ranged:true, heavy:true }).hits, 40],
  ['fx:hazardous: one hazard roll', () => C.resolve({ groups:[g({ mods:[fxm('hazardous', true)] })], target:T4, ctx:{} }).groups[0].hazRolls, 1, 0],
  // [INDIRECT FIRE] a rule gives (new): indirect shooting, an unmodified 1-5 fails: 10 of 60 hit
  ['fx:indirect: hits, indirect shooting', () => ex1([g({ n:60, mods:[fxm('indirect', true)] })], T4, { ranged:true, indirect:'1-5' }).hits, 10],
  ['fx:sus 1: hits', () => ex1([g({ n:30, mods:[fxm('sus', '1')] })], T4).hits, 20],
  ['fx:sus D3: hits', () => ex1([g({ n:30, mods:[fxm('sus', 'D3')] })], T4).hits, 15 + 5 * 2],
  ['fx:cleave 1: attacks', () => ex1([g({ A:'3', mods:[fxm('cleave', 1)] })], { T:4, models:[big(16, 10)] }).attacks, 6],
  // [ANTI-X 4+] a rule gives (new), the target taken to have X (its box): with [DEVASTATING WOUNDS], S4 vs T8: 4+ critical, 30 mortals
  ['fx:anti VEHICLE 4+: mortals', () => ex1([g({ n:60, kw:['TORRENT', 'DEVASTATING WOUNDS'], mods:[Object.assign({}, fxm('anti', 'VEHICLE 4+'), { anti:Object.assign({}, fxm('anti', 'VEHICLE 4+').anti, { assume:true }) })] })], { T:8, models:[big(100, 10)] }).mortals, 30],
  ['fx:anti: unticked target, no critical wound on 4+', () => C.resolve({ groups:[g({ mods:[fxm('anti', 'VEHICLE 4+')] })], target:{ T:8, models:[big(100, 10)] }, ctx:{} }).groups[0].critWound, 6, 0],
  // characteristics: +1 A (10 × A2 → 30), +D3 A (new: 10 × (1 + 2) on average), +1 S (S5 vs T5: 4+), +D3 S (new: S3 + D3 vs T4, each roll a third:
  // 4+, 3+, 3+), +1 AP (Sv 4+ → 5+: 4/6 of 50 fail), +1 D (D2, 50 wounds: 100)
  ['fx:a +1: attacks', () => ex1([g({ n:10, A:'2', mods:[fxm('a', 1)] })], T4).attacks, 30],
  ['fx:a D3: attacks', () => ex1([g({ n:10, mods:[fxm('a', 'D3')] })], T4).attacks, 30],
  ['fx:a D3: played out', () => run([g({ n:10, mods:[fxm('a', 'D3')] })], T4).groups[0].attacks, 30],
  ['fx:s +1: wounds', () => ex1([g({ n:60, kw:['TORRENT'], mods:[fxm('s', 1)] })], { T:5, models:[big(100, 10)] }).wounds, 30],
  ['fx:s D3: wounds', () => ex1([g({ n:60, S:3, kw:['TORRENT'], mods:[fxm('s', 'D3')] })], T4).wounds, 60 * (1 / 2 + 2 / 3 + 2 / 3) / 3],
  ['fx:s D3: played out', () => run([g({ n:60, S:3, kw:['TORRENT'], mods:[fxm('s', 'D3')] })], T4).groups[0].wounds, 60 * (1 / 2 + 2 / 3 + 2 / 3) / 3],
  // 02.02.03: A rolled for each weapon (10 models, +D3: per game the attacks' sd is √(10 × 2/3) = 2.58, not 10 × 0.82 = 8.2 as one
  // roll for all), S each time it is required (60 wound rolls at S3+D3 vs T4: a binomial's sd √(60 × .611 × .389) = 3.78)
  ['fx:a D3: rolled for each weapon (sd of the attacks)', () => C.run({ groups:[g({ n:10, mods:[fxm('a', 'D3')] })], target:T4, ctx:{}, sims:20000, seed:11, moments:true }).groups[0].sd.attacks, Math.sqrt(10 * 2 / 3), 0.15],
  ['fx:s D3: rolled for each wound roll (sd of the wounds)', () => C.run({ groups:[g({ n:60, S:3, kw:['TORRENT'], mods:[fxm('s', 'D3')] })], target:T4, ctx:{}, sims:20000, seed:11, moments:true }).groups[0].sd.wounds, Math.sqrt(60 * (11 / 18) * (7 / 18)), 0.2],
  // a re-roll of one Hit roll for the unit (Code Chivalric, Magna Imperator: one each time the unit is selected), two weapons of one
  // attack each at 4+: it goes to the more valuable weapon first (04.03), so that one's miss takes it (1/2), the other's only when the
  // first hit (1/2 × 1/2)
  ['pool: two weapons, the most valuable first (its share)', () => C.explain({ groups:[g({ name:'pistol', S:3 }), g({ name:'cannon', S:8, AP:-2, D:3 })].map(x => Object.assign(x, { mods:[fxm('oneHit', true)] })), target:T4, ctx:{} }).groups[1].one.hit, 1 / 2],
  ['pool: two weapons, the other one second', () => C.explain({ groups:[g({ name:'pistol', S:3 }), g({ name:'cannon', S:8, AP:-2, D:3 })].map(x => Object.assign(x, { mods:[fxm('oneHit', true)] })), target:T4, ctx:{} }).groups[0].one.hit, 1 / 4],
  // one for the unit, not one for each model: 3 models of one attack at 4+, a re-roll of one Hit roll is used when any misses (7/8), not
  // 3 × 1/2
  ['pool: for the unit, not for each model', () => C.explain({ groups:[g({ n:3, mods:[fxm('oneHit', true)] })], target:T4, ctx:{} }).groups[0].one.hit, 7 / 8],
  // two critical-hit values together: the lowest counts (a critical on 5+ beats 6+)
  ['fx:critHit: two values, the lowest', () => FXC.toMod([['critHit', 6], ['critHit', 5], ['critHit', 6]]).critHit, 5, 0],
  ['fx:ap +1: unsaved', () => ex1([g({ n:60, S:8, kw:['TORRENT'], mods:[fxm('ap', 1)] })], { T:4, models:[big(100, 10, 4)] }).unsaved, 50 * 4 / 6],
  ['fx:d +1: damage', () => ex1([g({ n:60, S:8, kw:['TORRENT'], mods:[fxm('d', 1)] })], BIGW).dmg, 100],
  // "improve the Strength, Armour Penetration and Damage characteristics of that attack by 1" (Blood Throne): three effects at once
  ['fx:s, ap, d +1 at once: damage', () => ex1([g({ n:60, S:3, kw:['TORRENT'], mods:[FXC.toMod([['s', 1], ['ap', 1], ['d', 1]])] })], { T:4, models:[big(1, 100000, 4)] }).dmg, 60 / 2 * 4 / 6 * 2],
  ['fx:aSet 6: attacks', () => ex1([g({ mods:[fxm('aSet', 6)] })], T4).attacks, 6],
  ['fx:bsSet 3: hits', () => ex1([g({ n:60, skill:'5+', mods:[fxm('bsSet', 3)] })], T4, { ranged:true }).hits, 40],
  ['fx:skill 1: hits', () => ex1([g({ n:60, mods:[fxm('skill', 1)] })], T4, { ranged:true }).hits, 40],
  ['fx:range +6: range', () => C.resolve({ groups:[g({ range:'24"', mods:[fxm('range', 6)] })], target:T4, ctx:{ ranged:true } }).groups[0].rangeIn, 30, 0],
  ['fx:ignoreHitMods: hits, its -1 ignored', () => ex1([g({ n:60, mods:[fxm('hit', -1), fxm('ignoreHitMods', true)] })], T4).hits, 30],
  // a weapon ability that changes no numbers: no mod at all (the box says "no effect in these numbers")
  ['fx:assault: no mod', () => Object.keys(fxm('assault', true)).length, 0, 0],
  ['fx:pistol: no mod', () => Object.keys(fxm('pistol', true)).length, 0, 0],
];
for(const x of fxCases) cases.push(x);

// ---- the screen's own choices, through the app's dmCalc (verify/damage-node.js): your unit at the target set by hand ----
const dm = require('./damage-node')();
// (a box by its rule and what it does: the boxes are keyed by their source and place in it, data.js BOXES)
const exact = (s, k) => { const c = dm.calc(s); return C.explain(c.input).total[k || 'dmg']; };
const box = (s, from, pred) => dm.calc(s).rules.find(x => x.m.from === from && (!pred || pred(x))) || {};
const boxE = (s, from, e) => box(s, from, x => JSON.stringify(x.e) === JSON.stringify(e));
const strat = (s, from) => box(s, from, x => !!x.m.strat);
const LKs = { army:'princes', ph:'fight', atk:'kh-rn-the-betrayer-khorne-berzerkers', typed:{} }, LK = box(LKs, 'Legendary Killer').k;
const DAKKA = box({ army:'shooty', ph:'shooting', atk:'mek-flashgitz', typed:{} }, 'Dakka! Dakka! Dakka!', x => !!x.e.range).k;
const cp = x => JSON.parse(JSON.stringify(x));   // (the state is the one passed: each case its own copy)
// targets set by hand as the old matchups' units were: a Knight Paladin (T11, Sv 3+, 5+ InSv against ranged attacks, Feel No Pain 6+,
// W26), Mozrog Skragbad (T9, Sv 3+, InSv 4+, Feel No Pain 5+, W10), Khorne Berzerkers (T5, Sv 3+, W2)
const KNIGHT = { n:1, T:11, Sv:3, W:26, InSv:5, fnp:6 }, KNIGHT_M = { n:1, T:11, Sv:3, W:26, InSv:0, fnp:6 }, MOZROG = { n:1, T:9, Sv:3, W:10, InSv:4, fnp:5 }, BERZ = { n:20, T:5, Sv:3, W:2 };
const app = [
  // ---- the target, as set on the wheels ----
  // 10 Grot Blastas (A1, BS 4+, S3, AP0, D1) at 10 models T3 W1 Sv 5+, Feel No Pain 6+: 10 × 3/6 hit × 3/6 wound (S3 vs T3) × 4/6 fail
  // × 5/6 not ignored = 1.39
  ['the target as set: Grot Blastas', () => exact({ army:'shooty', ph:'shooting', atk:'gretchin', typed:{ n:10, T:3, W:1, Sv:5, fnp:6 } }), 10 * 3 / 6 * 3 / 6 * 4 / 6 * 5 / 6],
  ['the target as set: its numbers in the working', () => { const w = C.explain(dm.calc({ army:'shooty', ph:'shooting', atk:'gretchin', typed:{ n:10, T:3, W:1, Sv:5, fnp:6 } }).input).groups[0].steps.map(x => x.t).join('\n');
    return +(/vs T3\b/.test(w) && /Sv 5\+/.test(w) && /Feel No Pain 6\+/.test(w)); }, 1],
  // the benefit of cover (13.08), set with the target: BS 4+ worsened to 5+: 10 × 2/6 × 3/6 × 4/6 × 5/6
  ['the target as set: the benefit of cover', () => exact({ army:'shooty', ph:'shooting', atk:'gretchin', typed:{ n:10, T:3, W:1, Sv:5, fnp:6, cover:true } }), 10 * 2 / 6 * 3 / 6 * 4 / 6 * 5 / 6],
  // -1 Damage, set with the target: on the attacks allocated to it (the calculator's dMinus), never below 1: the Snazzguns' Cutta (D3+2)
  // at W30: 10 × 3/6 × 5/6 (S9 vs T4) × 5/6 (AP-3 vs Sv 3+: 6+) × (4 - 1)
  ['the target as set: -1 Damage', () => (c => +(c.input.target.mod.dMinus === 1) * C.explain(c.input).groups[1].dmg)(dm.calc({ army:'shooty', ph:'shooting', atk:'mek-flashgitz', typed:{ n:1, T:4, W:30, Sv:3, dm1:true } })), 10 * 3 / 6 * 5 / 6 * 5 / 6 * 3],
  // a fresh target, and values the wheels do not have (an earlier screen's) read as the wheels can show them
  ['the target as set: a fresh one is 5 × T4 Sv 3+ W2', () => +(t => [t.n, t.T, t.Sv, t.W, t.InSv, t.fnp, +t.cover, +t.dm1].join() === '5,4,3,2,0,0,0,0')(dm.app.dmTypedVals({ typed:{} })), 1],
  ['the target as set: no Sv 1+, InSv 7+ or Models 0', () => +(t => [t.n, t.Sv, t.InSv, t.fnp].join() === '5,0,0,0')(dm.app.dmTypedVals({ typed:{ n:0, Sv:1, InSv:7, fnp:9 } })), 1],
  ['the target as set: no keywords', () => dm.calc({ army:'shooty', ph:'shooting', atk:'gretchin', typed:{} }).input.target.kw.length, 0, 0],
  // an army rule reaches the units whose Rules line names it, with either apostrophe (New Recruit prints "Martial Ka'tah", the army rule
  // is "Martial Ka’tah"): a Telemon's fight has Dacatarai and Rendax (one box, a pick: "select one of the ka’tah abilities presented
  // below"), its shooting Salvus
  ['Martial Ka’tah: a Telemon’s fight has Dacatarai and Rendax', () => +((b => !!b.pills && b.pills.map(p => p[0]).join() === 'Dacatarai,Rendax')(box({ army:'lite-knights', ph:'fight', atk:'telemon-heavy-dreadnought', typed:{} }, 'Martial Ka’tah'))), 1],
  ['Martial Ka’tah: a Telemon’s shooting has Salvus', () => +((b => !!b.pills && b.pills.map(p => p[0]).join() === 'Salvus')(box({ army:'lite-knights', ph:'shooting', atk:'telemon-heavy-dreadnought', typed:{} }, 'Martial Ka’tah'))), 1],
  // ---- a rule about the target's keywords is a box you tick; one about its T is read from the T set ----
  // Blitz Dem Gitz! (+6 A to the Blitzkannon "excluding MONSTER/VEHICLE units", always): unticked to start with; ticked at a Knight
  // Paladin set by hand: 8 + 6 = 14 attacks × 3/6 (BS 4+) × 2/6 (S7 vs T11: 5+) × 4/6 (AP -2: Sv 5+, as its InSv) × D2 × 5/6 = 2.59 (not
  // ticked: 8 attacks, 1.48). Its [LETHAL HITS: non-MONSTER/VEHICLE] is a box of its own, unticked: no [LETHAL HITS]
  ['the target’s keywords: Blitz Dem Gitz! is a box, unticked', () => (b => +(b.state === 'choice' && !b.on && !b.why))(box({ army:'shooty', ph:'shooting', atk:'dakkarig-boosta', typed:cp(KNIGHT) }, 'Blitz Dem Gitz!')), 1],
  ['the target’s keywords: Blitz Dem Gitz! ticked', () => { const s = { army:'shooty', ph:'shooting', atk:'dakkarig-boosta', typed:cp(KNIGHT) }; s.on = { [box(s, 'Blitz Dem Gitz!').k]:true };
    const c = dm.calc(s); return +!c.rules.find(r => r.m.from === 'Blitz Dem Gitz!').over * C.explain(c.input).groups[0].dmg; }, 14 * 3 / 6 * 2 / 6 * 4 / 6 * 2 * 5 / 6],
  ['the target’s keywords: Blitz Dem Gitz! not ticked', () => C.explain(dm.calc({ army:'shooty', ph:'shooting', atk:'dakkarig-boosta', typed:cp(KNIGHT) }).input).groups[0].dmg, 8 * 3 / 6 * 2 / 6 * 4 / 6 * 2 * 5 / 6],
  // a stratagem is never ticked for the player (Kustom Dakka, vs non-MONSTER/VEHICLE targets)
  ['a stratagem starts unticked', () => +(b => !b.on && b.state === 'choice')(strat({ army:'shooty', ph:'shooting', atk:'mek-tankbustas', typed:{} }, 'Kustom Dakka')), 1],
  // Spiteful Power Trip (+1 to hit vs units with no T 7+ models): unticked at T4 like every box (the owner's decision), ruled out at T7
  // (yours to count anyway)
  ['the target’s T: Spiteful Power Trip unticked at T4, a box', () => (b => +(b.state === 'choice' && !b.on))(box({ army:'shooty', ph:'shooting', atk:'killa-kans', typed:{ T:4 } }, 'Spiteful Power Trip')), 1],
  ['the target’s T: Spiteful Power Trip ruled out at T7', () => (b => +(b.state === 'out' && !b.on && /no T 7\+ model/.test(b.why)))(box({ army:'shooty', ph:'shooting', atk:'killa-kans', typed:{ T:7 } }, 'Spiteful Power Trip')), 1],
  // Hunter of Souls: re-roll 1s against a CHARACTER unit, the whole hit and wound roll against a PSYKER CHARACTER unit: two boxes.
  // Hellforged weapons A6 WS 2+ S9 D4 at a T5 target with no save: hits 6 × (5/6 + 1/6 × 5/6) = 6 × 35/36 either way (only a 1 fails);
  // wounds 3+: (4/6 + 1/6 × 4/6 = 28/36) with the first, (4/6 + 2/6 × 4/6 = 32/36) with the second
  ['the target’s keywords: Hunter of Souls (CHARACTER) ticked', () => { const s = { army:'pubstomper', ph:'fight', atk:'daemon-prince-of-tzeentch-with-wings', typed:{ n:1, T:5, W:30, Sv:0 } };
    s.on = { [boxE(s, 'Hunter of Souls', { rrHit:'1s', rrWound:'1s' }).k]:true }; return exact(s); }, 6 * 35 / 36 * 28 / 36 * 4],
  ['the target’s keywords: Hunter of Souls (PSYKER CHARACTER) ticked', () => { const s = { army:'pubstomper', ph:'fight', atk:'daemon-prince-of-tzeentch-with-wings', typed:{ n:1, T:5, W:30, Sv:0 } };
    s.on = { [boxE(s, 'Hunter of Souls', { rrHit:'all', rrWound:'all' }).k]:true }; return exact(s); }, 6 * 35 / 36 * 32 / 36 * 4],
  ['the target’s keywords: Hunter of Souls, both unticked to start with', () => +dm.calc({ army:'pubstomper', ph:'fight', atk:'daemon-prince-of-tzeentch-with-wings', typed:{} }).rules.filter(r => r.m.from === 'Hunter of Souls').every(r => r.state === 'choice' && !r.on), 1],
  // Bringer of Justice (+1 to the bearer's melee hit rolls, always) and Macro-extinction Protocols' two parts ticked, at a Knight
  // Paladin set by hand (melee: no InSv): Atrapos lascutter WS 3+ +2 → 2+: 8 × 5/6 + 8/6 [SUSTAINED HITS 1] = 8 hits × 5/6 (S14 vs T11:
  // 3+, +1 → 2+) × 5/6 (AP-3 vs Sv 3+: 6+) × D4 × 5/6 (Feel No Pain 6+) = 18.5
  ['the target’s keywords: Macro-extinction Protocols ticked, with Bringer of Justice', () => { const s = { army:'4-megas-and-a-destrier', ph:'fight', atk:'cerastus-knight-atrapos', typed:cp(KNIGHT_M) };
    s.on = Object.fromEntries(dm.calc(s).rules.filter(r => r.m.from === 'Macro-extinction Protocols').map(r => [r.k, true])); return exact(s); }, 8 * 5 / 6 * 5 / 6 * 4 * 5 / 6],
  // Beacons of Rage, the Eightbound's own aura: +1 to hit (vs non-MONSTER/VEHICLE targets) and +1 to wound (target Below Half-strength),
  // two boxes, unticked. 3 Chainblades, A6 WS 3+: 18 × 4/6, or 5/6 with the first; S8 vs T9: 5+ (2/6), or 4+ (3/6) with the second;
  // Sv 3+ AP-2: 5+, 4/6 fail; D2
  ['Beacons of Rage: unticked', () => exact({ army:'princes', ph:'fight', atk:'eightbound', typed:{ n:10, T:9, W:1, Sv:3 } }), 18 * 4 / 6 * 2 / 6 * 4 / 6 * 2],
  ['Beacons of Rage: +1 to hit ticked', () => { const s = { army:'princes', ph:'fight', atk:'eightbound', typed:{ n:10, T:9, W:1, Sv:3 } }; s.on = { [boxE(s, 'Beacons of Rage', { hit:1 }).k]:true }; return exact(s); }, 18 * 5 / 6 * 2 / 6 * 4 / 6 * 2],
  ['Beacons of Rage: both ticked', () => { const s = { army:'princes', ph:'fight', atk:'eightbound', typed:{ n:10, T:9, W:1, Sv:3 } };
    s.on = { [boxE(s, 'Beacons of Rage', { hit:1 }).k]:true, [boxE(s, 'Beacons of Rage', { wound:1 }).k]:true }; return exact(s); }, 18 * 5 / 6 * 3 / 6 * 4 / 6 * 2],
  // ---- a weapon's ability limited to some targets: a box under the weapon, unticked ----
  ['limited ability: [LETHAL HITS: non-MONSTER/VEHICLE] unticked, no [LETHAL HITS]', () => +!dm.calc({ army:'shooty', ph:'shooting', atk:'wazdakka', typed:{} }).input.groups.some(g => g.kw.includes('LETHAL HITS')), 1],
  ['limited ability: ... ticked, [LETHAL HITS]', () => { const s = { army:'shooty', ph:'shooting', atk:'wazdakka', typed:{} }, x = dm.calc(s).weapons.find(c => c.lim.length).lim[0]; s.on = { [x.k]:true };
    return +(x.t === 'LETHAL HITS: NON-MONSTER/VEHICLE' && dm.calc(s).input.groups.some(g => g.kw.includes('LETHAL HITS'))); }, 1],
  // [ANTI-VEHICLE 4+] (the arc rifle) ticked: critical wounds on 4+ (24.03), said in the working
  ['limited ability: [ANTI-VEHICLE 4+] ticked, critical wounds on 4+', () => { const s = { army:'purge-goes-the-foe', ph:'shooting', atk:'skitarii-rangers', typed:{} }, c0 = dm.calc(s), w = c0.weapons.find(c => c.lim.some(x => /^ANTI-VEHICLE/.test(x.t)));
    const i0 = c0.input.groups.findIndex(g => /^Arc rifle/.test(g.name)), a = C.resolve(c0.input).groups[i0].critWound; s.on = { [w.lim[0].k]:true }; const c = dm.calc(s), i = c.input.groups.findIndex(g => /^Arc rifle/.test(g.name));
    return +(a === 6 && C.resolve(c.input).groups[i].critWound === 4 && C.explain(c.input).groups[i].steps.some(t => /critical wounds on 4\+ \(\[ANTI-VEHICLE 4\+\], 24\.03\)/.test(t.t))); }, 1],
  // a HUNTER profile (04.01.03) is the player's box too: unticked, the Standard profile is the one picked (never the Hunter one) and the
  // Hunter one is ruled out; ticked, it can be picked. Tankbustas at a Knight Paladin set by hand, the Hunter profile picked: slugga
  // 3 × 3/6 × 2/6 × 4/6 × D3 × 5/6 = 0.83; pistol 1 × … = 0.28; launchas 18 × 3/6 × 4/6 (S12 vs T11) × 4/6 × 3 × 5/6 = 10
  ['HUNTER: unticked, the other profile, the Hunter one ruled out', () => (c => +(!!c && !c.w.hunter && c.can.some(x => !x)))(dm.plan({ army:'shooty', atk:'mek-tankbustas', typed:cp(KNIGHT), turn:{ me:dm.app.dmModeTurn('shoot') } }).beats[0].M.weapons.find(c => c.ps.length > 1)), 1],
  ['HUNTER: ticked, the Hunter profile picked as the best', () => { const k = 'x:ranged:Busta Rokkit Launcha|Tankbustas|HUNTER: MONSTER/VEHICLE', p = dm.plan({ army:'shooty', atk:'mek-tankbustas', typed:cp(KNIGHT), turn:{ me:dm.app.dmModeTurn('shoot') }, ch:{ 'me:shoot':{ on:{ [k]:true } } } });
    return +p.beats[0].M.weapons.find(c => c.ps.length > 1).w.hunter * C.explain(p.beats[0].M.input).total.dmg; }, 3 * 3 / 6 * 2 / 6 * 4 / 6 * 3 * 5 / 6 + 1 * 3 / 6 * 2 / 6 * 4 / 6 * 3 * 5 / 6 + 10],
  // ---- the best profile: the screen opens on the one that does the most (worked out exactly); the player's own pick stays ----
  ['BEST: the profile picked for you does the most', () => { const p = dm.plan({ army:'shooty', atk:'mek-flashgitz', typed:{ n:10, T:4, W:1, Sv:3 }, turn:{ me:dm.app.dmModeTurn('shoot') } }), c = p.beats[0].M.weapons.find(x => x.ps.length > 1);
    const v = i => dm.app.dmWorth(dm.calc({ army:'shooty', ph:'shooting', atk:'mek-flashgitz', typed:{ n:10, T:4, W:1, Sv:3 }, pick:{ [c.k]:i } }));
    return +(c.ps.every((x, i) => v(i) <= v(c.pi) + 1e-9) && !c.own); }, 1],
  ['BEST: the player’s own pick stays', () => (c => c.pi * 10 + +c.own)(dm.plan({ army:'shooty', atk:'mek-flashgitz', typed:{ n:10, T:4, W:1, Sv:3 }, turn:{ me:dm.app.dmModeTurn('shoot') }, ch:{ 'me:shoot':{ pick:{ 'ranged:Snazzgun|Flash Gitz':2 } } } }).beats[0].M.weapons.find(x => x.ps.length > 1)), 21, 0],
  // (what is compared: each attack's damage at most the wounds of the model it meets: D3 at W2 models is 2 for each attack through)
  ['BEST: an attack’s damage at most a model’s wounds (dmgCap)', () => (x => x.dmgCap / x.unsaved)(C.explain({ groups:[g({ n:60, S:8, D:'3', kw:['TORRENT'] })], target:{ T:4, models:[big(100, 2)] }, ctx:{} }).groups[0]), 2, 1e-9],
  // ---- the Kustom Blasta X: its three profiles all fire (fireAll), each its own weapon ----
  ['Kustom Blasta X: every profile fires', () => (W => +(W.length === 3 && W.every(c => c.on && c.ps.length === 1)))(dm.calc({ army:'simple-but-effective', ph:'shooting', atk:'nazdreg-meganobz', typed:{} }).weapons.filter(c => /^Kustom Blasta X – /.test(c.label))), 1],
  // ---- one stratagem on a unit in a phase (15.01): a second one ticked is counted by you ----
  ['two stratagems in one phase: the second counted by you', () => { const s = { army:'shooty', ph:'shooting', atk:'mek-tankbustas', typed:{} }, c0 = dm.calc(s), a = c0.rules.find(r => r.m.from === 'Kustom Dakka' && r.m.strat).k, b = c0.rules.find(r => r.m.from === 'Glowin’ Dakka').k;
    s.on = { [a]:true, [b]:true }; const c = dm.calc(s), A = c.rules.find(r => r.k === a), B = c.rules.find(r => r.k === b);
    return +(A.on && !A.over && B.on && B.over && /15\.01/.test(B.extra) && C.explain(c.input).groups.some(x => x.steps.some(t => /Glowin’ Dakka \(counted by you\)/.test(t.t)))); }, 1],
  // ---- close-quarters shooting (10.06) and an engaged MONSTER/VEHICLE target (17.03) ----
  // a MONSTER/VEHICLE unit shooting a unit it is not engaged with: -1 to hit, [CLOSE-QUARTERS] attacks too; [BLAST] can target it
  ['10.06: at another unit, -1 to hit, [CLOSE-QUARTERS] too', () => run([g({ n:60, kw:['CLOSE-QUARTERS'] })], { T:4, models:[big(100, 10)] }, { ranged:true, cqo:true, big:true }).groups[0].hits, 20],
  ['10.06: at another unit, [BLAST] can target it', () => +!C.resolve({ groups:[g({ n:6, kw:['BLAST'] })], target:{ T:4, models:[big(10, 1)] }, ctx:{ ranged:true, cqo:true, big:true } }).groups[0].out, 1],
  ['10.06: the box for a MONSTER/VEHICLE unit only', () => +(dm.calc({ army:'shooty', ph:'shooting', atk:'killa-kans', typed:{} }).sit.some(x => x.k === 'c:cqo') && !dm.calc({ army:'shooty', ph:'shooting', atk:'gretchin', typed:{} }).sit.some(x => x.k === 'c:cqo')), 1],
  // an engaged MONSTER/VEHICLE target, as the player says: -1 to hit (not for [CLOSE-QUARTERS] attacks of a unit engaged with it); no [BLAST]
  ['17.03: an engaged MONSTER/VEHICLE target, as said: -1 to hit', () => run([g({ n:60 })], { T:4, models:[big(100, 10)] }, { ranged:true, engaged:true, bigTarget:true }).groups[0].hits, 20],
  ['17.03: ... no [BLAST]', () => +!!C.resolve({ groups:[g({ n:6, kw:['BLAST'] })], target:{ T:4, models:[big(10, 1)] }, ctx:{ ranged:true, engaged:true, bigTarget:true } }).groups[0].out, 1],
  ['17.03: ... from the box', () => { const s = { army:'shooty', ph:'shooting', atk:'gretchin', typed:{}, on:{ 'c:engaged':true } }, c = dm.calc(s); return +(c.ctx.engaged && c.ctx.bigTarget); }, 1],
  // ---- the working's words where the rules leave a choice or a minimum ----
  // [LETHAL HITS]: you can choose (24.23), taken (S4 vs T8) and not taken (with [DEVASTATING WOUNDS] at Sv 2+: rolling to wound is worth more)
  ['the working: [LETHAL HITS] taken, you can choose (24.23)', () => +C.explain({ groups:[g({ n:20, kw:['LETHAL HITS'] })], target:{ T:8, models:[big(20, 10)] }, ctx:{} }).groups[0].steps.some(t => /\[LETHAL HITS\]: these wound automatically \(you can choose, 24\.23\)/.test(t.t)), 1],
  ['the working: [LETHAL HITS] not taken, you can choose (24.23)', () => +C.explain({ groups:[g({ n:60, D:2, kw:['LETHAL HITS', 'DEVASTATING WOUNDS'] })], target:{ T:4, models:[big(100, 10, 2)] }, ctx:{} }).groups[0].steps.some(t => /rolled to wound instead \(you can choose, 24\.23\)/.test(t.t)), 1],
  ['the working: D cannot be less than 1 (02.02.01)', () => +C.explain({ groups:[g({ n:6, S:8, kw:['TORRENT'] })], target:{ T:4, models:[big(20, 10)], mod:{ dMinus:1 } }, ctx:{} }).groups[0].steps.some(t => /D cannot be less than 1, 02\.02\.01/.test(t.t)), 1],
  // ---- the models left of your unit ----
  // Mek + Flash Gitz with 5 of the 9 Flash Gitz left: the Snazzguns are the Kaptin's and theirs, 6; the Mek's slugga stays; the Mek
  // gone too: no slugga
  ['models left: the weapons of the models set', () => dm.calc({ army:'shooty', ph:'shooting', atk:'mek-flashgitz', typed:{}, left:{ 2:5 } }).weapons.find(c => /Snazzgun/.test(c.k)).n, 6, 0],
  ['models left: none of a line, none of its weapons', () => (c => +(!c.ticked.some(x => /Kustom Mega-slugga/.test(x.k)) && c.weapons.find(x => /Kustom Mega-slugga/.test(x.k)).n === 0))(dm.calc({ army:'shooty', ph:'shooting', atk:'mek-flashgitz', typed:{}, left:{ 0:0 } })), 1],
  // ---- the attacker's own rules, as before ----
  // Prophet of da Great Waaagh!: Ghazghkull is always within his own aura (22.01): +1 to hit and wound, a box (ticked here); at Mozrog as set (W10,
  // Feel No Pain 5+), played out: 7.84 wounds lost (Simple but effective: no detachment rule adds to his attacks; an independent
  // simulation, 400,000 battles: 7.84. Melee's War Horde gave [SUSTAINED HITS 1] too: 8.5, the reviewer's then)
  ['own aura: Prophet of da Great Waaagh!, wounds lost', () => { const s = { army:'simple-but-effective', ph:'fight', atk:'ghazghkull-thraka', typed:cp(MOZROG) }; s.on = { [box(s, 'Prophet of da Great Waaagh!').k]:true };
    return C.run(Object.assign({}, dm.calc(s).input, { sims:20000, seed:7 })).dmg; }, 7.84],
  // Bringers of Change (re-roll wound rolls of 1, a box ticked here): the Exalted Sorcerer's Rubric Marines' Warpflamers 3 × D6 = 10.5 torrent hits × (2/6 + 1/6 × 2/6) (S4 vs T5) = 4.08
  // wounds; the working multiplies out as shown (the reviewer's Warpflamers: 10.5, not 11)
  ['steps: 3.5 × 3 = 10.5, then 10.5 × 14/36 = 4.08', () => { const s = { army:'pubstomper', ph:'shooting', atk:'exalted-sorcerer-rubric-marines', typed:cp(BERZ) }; s.on = { [boxE(s, 'Bringers of Change', { rrWound:'1s' }).k]:true };
    return +(w => w.includes('× 3 = 10.5') && w.includes('10.5 × (2/6 + 1/6 × 2/6 = 14/36) = 4.08'))(C.explain(dm.calc(s).input).groups.flatMap(g => g.steps.map(x => x.t)).join('\n')); }, 1],
  ['Bringers of Change: re-roll 1s', () => { const s = { army:'pubstomper', ph:'shooting', atk:'exalted-sorcerer-rubric-marines', typed:{ n:10, T:4, W:1, Sv:0 } }; s.on = { [boxE(s, 'Bringers of Change', { rrWound:'1s' }).k]:true };
    return (c => C.explain(c.input).groups.find(g => g.steps[0].t.includes('× 3 = 10.5')).dmg)(dm.calc(s)); }, 10.5 * 21 / 36],
  ['Bringers of Change: objective box, re-roll the wound roll', () => { const s = { army:'pubstomper', ph:'shooting', atk:'exalted-sorcerer-rubric-marines', typed:{ n:10, T:4, W:1, Sv:0 } }; s.on = { [boxE(s, 'Bringers of Change', { rrWound:'all' }).k]:true };
    return (c => C.explain(c.input).groups.find(g => g.steps[0].t.includes('× 3 = 10.5')).dmg)(dm.calc(s)); }, 10.5 * 27 / 36],
  // Kindred Sorcery: one of three abilities, picked: Psychic Maelstrom (+1 to wound with Psychic weapons) ticked: the Daemon Prince's
  // Hellforged weapons (A6 WS 2+ S9 D4, [PSYCHIC]) at a T5 target, no save: 6 × 5/6 = 5 hits × 5/6 (3+ → 2+) × 4
  ['Kindred Sorcery: the picked ability counts', () => { const s = { army:'pubstomper', ph:'fight', atk:'daemon-prince-of-tzeentch-with-wings', typed:{ n:1, T:5, W:30, Sv:0 } }, b = box(s, 'Kindred Sorcery');
    s.on = { [b.k]:true }; s.val = { [b.pillKey]:'Psychic Maelstrom' }; return exact(s); }, 5 * 5 / 6 * 4],
  ['Kindred Sorcery: a pick, not greyed as range-only', () => +(box({ army:'pubstomper', ph:'fight', atk:'daemon-prince-of-tzeentch-with-wings', typed:{} }, 'Kindred Sorcery').state === 'choice'), 1],
  // after the unit is destroyed, a later weapon's attacks are lost: Khârn + Berzerkers fight 10 models set as Gretchin (T2, Sv 6+, W1):
  // the eviscerators (last) find the unit already gone in nearly every game, and their row says so
  ['the unit gone before a weapon: shown', () => (c => C.run(c.input).groups.slice(-1)[0].gone)(dm.calc({ army:'princes', ph:'fight', atk:'kh-rn-the-betrayer-khorne-berzerkers', typed:{ n:10, T:2, W:1, Sv:6 } })), 1],
  // half range as a band: the Knight Paladin's rapid-fire battle cannon and its stubbers have different half ranges; within 18"
  // only the weapons whose half range is 18" or more get [RAPID FIRE]
  ['half range band from the screen', () => dm.calc({ army:'6-bigs', ph:'shooting', atk:'knight-paladin', typed:{}, val:{ half:18 } }).ctx.halfWithin, 18],
  // ---- a rule that changes range moves half range (24.25, 24.30) ----
  // Dakka! Dakka! Dakka! (+3" while riled up) ticked: the Flash Gitz' Cutta (12", [MELTA 2], [RAPID FIRE 1]) has half range 7.5", so
  // within 7.5" both apply: 10 × 2 attacks × 3/6 × 5/6 (S9 vs T4: 2+) × 5/6 (Sv 3+ AP-3: 6+) × (D3+2 + 2 = 6) = 41.7
  // the bands come from the range rules ticked: unticked, Dakka! Dakka! Dakka! makes no band of its own
  ['range rule ticked: its band; unticked: none', () => +(dm.calc({ army:'shooty', ph:'shooting', atk:'mek-flashgitz', typed:{ n:10, T:4, W:1, Sv:3 }, on:{ [DAKKA]:true } }).ctx.halves.join() === '7.5,6' &&
    dm.calc({ army:'shooty', ph:'shooting', atk:'mek-flashgitz', typed:{ n:10, T:4, W:1, Sv:3 } }).ctx.halves.join() === '6'), 1],
  ['range rule ticked: within 7.5", the Cutta gets both', () => (c => C.explain(c.input).groups[1].dmg)(dm.calc({ army:'shooty', ph:'shooting', atk:'mek-flashgitz', typed:{ n:10, T:4, W:1, Sv:3 }, on:{ [DAKKA]:true }, val:{ half:7.5 } })), 10 * 2 * 3 / 6 * 5 / 6 * 5 / 6 * 6],
  // ... and unticked, its half range is 6": "within 7.5"" is the 12" band, and neither applies: 10 × 3/6 × 5/6 × 5/6 × 4
  ['range rule unticked: the Cutta at 7.5" gets neither', () => (c => C.explain(c.input).groups[1].dmg)(dm.calc({ army:'shooty', ph:'shooting', atk:'mek-flashgitz', typed:{ n:10, T:4, W:1, Sv:3 }, val:{ half:7.5 } })), 10 * 3 / 6 * 5 / 6 * 5 / 6 * 4],
  ['range rule: named in the working', () => +C.explain(dm.calc({ army:'shooty', ph:'shooting', atk:'mek-flashgitz', typed:{ n:10, T:4, W:1, Sv:3 }, on:{ [DAKKA]:true }, val:{ half:7.5 } }).input).groups[1].steps[0].t.includes('within half range (7.5" (range 12" +3" Dakka! Dakka! Dakka! = 15")'), 1],
  // ---- W1 models: destroyed and wounds lost are the same number (Khârn + Berzerkers shoot 10 models set as Tzaangors) ----
  ['W1 target: destroyed = wounds lost', () => (c => { const r = C.run(c.input), x = C.explain(c.input, r.orderIdx), v = dm.app.dmShown(c, r, x); return +(C.fmt(v.killed) === C.fmt(v.lost)); })(dm.calc({ army:'princes', ph:'shooting', atk:'kh-rn-the-betrayer-khorne-berzerkers', typed:{ n:10, T:4, W:1, Sv:6, InSv:6 } })), 1],
  // ---- the working names a bonus the printed value already includes (New Recruit): Gorechild's A includes Relentless Rage ----
  ['the working names included bonuses', () => +/^Attacks: \d+ \(includes Relentless Rage\)/.test(C.explain(dm.calc({ army:'princes', ph:'fight', atk:'kh-rn-the-betrayer-khorne-berzerkers', typed:{ n:10, T:4, W:1, Sv:6, InSv:6 } }).input).groups.flatMap(g => g.steps.map(x => x.t)).find(t => /includes Relentless Rage/.test(t)) || ''), 1],
  ['the working names included keywords', () => +C.explain(dm.calc({ army:'pubstomper', ph:'shooting', atk:'sorcerer-in-terminator-armour-scarab-occult-terminators', typed:{ n:10, T:4, W:1, Sv:3 } }).input).groups.flatMap(g => g.steps.map(x => x.t)).some(t => t.includes('[LETHAL HITS]: these wound automatically (you can choose, 24.23; from Empyric Guidance)')), 1],
  // ---- the situation reaches every rule with that condition ----
  // "This unit or the target within range of an objective" ticks Finderz Keeperz (+1 AP) and Wreckin' and Lootin' (re-roll hit rolls
  // of 1) at once. Flash Gitz at 10 T4 W1 Sv 3+ models, before allocation: Cutta 10 × (3/6 + 1/6 × 3/6) = 5.83 hits × 5/6 (S9 vs T4:
  // 2+) = 4.86, AP-3 +1 → -4 vs 3+: no save, × D3+2 (4) = 19.44; Mega-slugga 3 × 21/36 = 1.75 × 5/6 = 1.46, AP-3 vs 3+: 6+ (5/6 fail)
  // = 1.22 × 3 = 3.65
  ['a fact of the table ticks its rules: objective', () => exact({ army:'shooty', ph:'shooting', atk:'mek-flashgitz', typed:{ n:10, T:4, W:1, Sv:3 }, fx:{ objective:true } }), 10 * 21 / 36 * 5 / 6 * 4 + 3 * 21 / 36 * 5 / 6 * 5 / 6 * 3],
  ['a fact of the table ticks its rules: both say why', () => +['Finderz Keeperz', 'Wreckin’ and Lootin’'].every(n => (b => b.on && /^ticked with/.test(b.why))(box({ army:'shooty', ph:'shooting', atk:'mek-flashgitz', typed:{ n:10, T:4, W:1, Sv:3 }, fx:{ objective:true } }, n))), 1],
  ['a fact implies another: the target on an objective', () => +(p => { const b = p.beats[0]; return ['Finderz Keeperz', 'Wreckin’ and Lootin’'].every(n => b.M.rules.find(r => r.m.from === n).on); })(dm.plan({ army:'shooty', atk:'mek-flashgitz', typed:{ n:10, T:4, W:1, Sv:3 }, facts:{ me:{ theirs:{ objective:true } } } })), 1],
  // the same fight as the turn's one step (play) gives what run gives
  ['the turn: one step is run', () => { const p1 = dm.plan({ army:'simple-but-effective', atk:'nazdreg-meganobz', typed:cp(BERZ), turn:{ me:{ charge:true, fight:true } } }), r1 = C.play(dm.app.dmIn(p1, 4000)), r0 = C.run(Object.assign({}, p1.beats[0].M.input, { sims:4000, seed:7 }));
    return +(p1.beats.length === 1 && r1.beats[0].killed === r0.killed); }, 1],
  // nothing is disabled: a rule the rules rule out here (a Shooting phase stratagem in a fight) is the player's to count, named so
  ['counted by you: Kustom Dakka in a fight', () => { const s = { army:'shooty', ph:'fight', atk:'mek-tankbustas', typed:{} }, r = box(s, 'Kustom Dakka'); s.on = { [r.k]:true }; const c = dm.calc(s), x = c.rules.find(y => y.k === r.k);
    return +(r.state === 'out' && !r.on && /Shooting phase only/.test(r.why) && x.on && x.over && C.explain(c.input).groups.some(g => g.steps.some(t => /Kustom Dakka \(counted by you\)/.test(t.t)))); }, 1],
  // Murderous Imperative, a pick of two: Conqueror (re-roll wound rolls of 1). 7 galvanic rifles × 2 at T4 Sv 4+: 14 × 3/6 = 7 hits
  // × (3/6 + 1/6 × 3/6) × 3/6 fail = 2.04
  // (two boxes, as GW's two lines: "If the Protector Imperative is active …", "If the Conqueror Imperative is active …")
  ['Murderous Imperative, Conqueror', () => { const s = { army:'purge-goes-the-foe', ph:'shooting', atk:'skitarii-rangers', typed:{ n:10, T:4, W:1, Sv:4 } };
    s.on = { [boxE(s, 'Murderous Imperative', { rrWound:'1s' }).k]:true }; return C.explain(dm.calc(s).input).groups[0].dmg; }, 14 * 3 / 6 * 21 / 36 * 3 / 6],
  ['a pick: Unshackled Wrath is a choice now', () => +(box({ army:'purge-goes-the-foe', ph:'shooting', atk:'skitarii-rangers', typed:{} }, 'Unshackled Wrath').state === 'choice'), 1],
  // help from another unit of the list: Clever Know-wotz (the Mek's), offered to the Big Mek Dakkarig unticked, named with its giver;
  // ticked, +1 to hit: the Blitzkannon at a Knight Paladin set by hand 8 × 4/6 (BS 4+ → 3+) × 2/6 × 4/6 × 2 × 5/6 = 1.98
  ['help from your list: Clever Know-wotz (Mek), unticked', () => +(b => b.state === 'choice' && !b.on && b.help === 'Mek')(box({ army:'shooty', ph:'shooting', atk:'dakkarig-boosta', typed:cp(KNIGHT) }, 'Clever Know-wotz')), 1],
  ['help from your list: Clever Know-wotz counted', () => { const s = { army:'shooty', ph:'shooting', atk:'dakkarig-boosta', typed:cp(KNIGHT) }; s.on = { [box(s, 'Clever Know-wotz').k]:true };
    return C.explain(dm.calc(s).input).groups[0].dmg; }, 8 * 4 / 6 * 2 / 6 * 4 / 6 * 2 * 5 / 6],
  ['lasting stratagem: Auto-divinatory Targeting sets BS 3+', () => { const s = { army:'purge-goes-the-foe', ph:'shooting', atk:'onager-dunecrawler', typed:{ n:10, T:4, W:1, Sv:4 } }, b = box(s, 'Auto-divinatory Targeting'); s.on = { [b.k]:true };
    return +(b.state === 'choice' && C.explain(dm.calc(s).input).groups.some(x => x.steps.some(t => /BS 3\+ \(1CP Auto-divinatory Targeting|BS 3\+ \(Auto-divinatory Targeting/.test(t.t)))); }, 1],
  // ---- the engine: modifiers to Damage and to wound ----
  // a -1 Damage to the D characteristic (dMinusChar) lowers [DEVASTATING WOUNDS] mortal wounds too (24.10: they equal the attack's D):
  // 6 attacks × 3/6 = 3 hits; S4 vs T4: 3 × 2/6 = 1 normal wound, 3 × 1/6 = 0.5 critical; no save; D2 - 1 = 1: 1 + 0.5 × 1 = 1.5 (a -1
  // Damage to allocated attacks only: 1 + 0.5 × 2 = 2)
  ['-1 to the D characteristic: mortal wounds too', () => run([g({ n:6, D:2, kw:['DEVASTATING WOUNDS'] })], { T:4, models:[big(20, 10)], mod:{ dMinus:1, dMinusChar:1 } }).dmg, 1.5],
  ['-1 Damage to allocated attacks: not mortal wounds', () => run([g({ n:6, D:2, kw:['DEVASTATING WOUNDS'] })], { T:4, models:[big(20, 10)], mod:{ dMinus:1 } }).dmg, 2],
  ['-1 to the D characteristic: the working', () => C.explain({ groups:[g({ n:6, D:2, kw:['DEVASTATING WOUNDS'] })], target:{ T:4, models:[big(20, 10)], mod:{ dMinus:1, dMinusChar:1 } }, ctx:{} }).total.dmg, 1.5],
  // -1 to wound when the attack's S is greater than the target's T: 12 attacks × 3/6 = 6 hits; S5 vs T4: 3+ → 4+: 6 × 3/6 = 3; S3 vs
  // T4: 5+, no change: 6 × 2/6 = 2
  ['-1 to wound when S is greater than T: S5 vs T4', () => run([g({ n:12, S:5 })], { T:4, models:[big(20, 10)], mod:{ woundMinusSgt:1 } }).groups[0].wounds, 3],
  ['-1 to wound when S is greater than T: S3 vs T4 unchanged', () => run([g({ n:12, S:3 })], { T:4, models:[big(20, 10)], mod:{ woundMinusSgt:1 } }).groups[0].wounds, 2],
  // the custom modifiers (effects.js CUSTOM): plain boxes, no rule's; +1 to Hit and +1 AP for the Grot Blastas at 10 T3 W1 Sv 5+ models:
  // 10 × 4/6 × 3/6 × 5/6 (AP-1: Sv 6+); every one of them a box once, unticked, in its group; each ticked alone changes the result as
  // its catalogue mod says (the engine with that mod by hand)
  ['custom modifiers: +1 to Hit, +1 AP', () => exact({ army:'shooty', ph:'shooting', atk:'gretchin', typed:{ n:10, T:3, W:1, Sv:5 }, on:{ 'u:hit:1':true, 'u:ap:1':true } }), 10 * 4 / 6 * 3 / 6 * 5 / 6],
  ['custom modifiers: every one once, unticked, in its group', () => (c => +(FXC.CUSTOM.every(([id, p]) => c.rules.filter(r => r.k === 'u:' + id + ':' + p && r.grp === 'custom' && !r.on && r.state === 'choice').length === 1) && c.rules.filter(r => r.grp === 'custom').length === FXC.CUSTOM.length))(dm.calc({ army:'shooty', ph:'shooting', atk:'gretchin', typed:{} })), 1],
  ['custom modifiers: each changes the result as the engine says', () => { const s0 = { army:'shooty', ph:'shooting', atk:'mek-flashgitz', typed:{ n:10, T:4, W:2, Sv:3 } }, c0 = dm.calc(s0), bad = [];
    for(const [id, p] of FXC.CUSTOM){ const c = dm.calc(Object.assign({}, s0, { on:{ ['u:' + id + ':' + p]:true } }));
      const want = C.explain(Object.assign({}, c0.input, { groups:c0.input.groups.map(g => Object.assign({}, g, { mods:g.mods.concat([Object.assign({ from:'by hand' }, FXC.toMod([[id, p]]))]) })) })).total.dmg;
      if(Math.abs(C.explain(c.input).total.dmg - want) > 1e-9) bad.push(id); }
    return bad.length; }, 0, 0],
];
for(const x of app) cases.push(x);

// ---- two methods agree: the working's exact averages (explain) and the dice played out (run), over real attacks ----
// Every list's first two units, shooting and fight, at targets set as each other list's first two units would be (their first stats
// row), three tick-box states (as the screen starts; every choice ticked; every box unticked), sampled. The target is made one model
// with wounds enough for every attack (nothing lost to allocation), so the two must agree within dice noise: 5 standard errors.
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
// a unit as a target set by hand: its first stats row (models, T, Sv, W, InSv)
const asSet = u => { const s = u.stats[0], n = / ×(\d+)$/.exec(s.name); return { n:n ? +n[1] : 1, T:parseInt(s.T, 10) || 4, Sv:parseInt(s.Sv, 10) || 0, W:parseInt(s.W, 10) || 1, InSv:parseInt(s.InSv, 10) || 0 }; };
{
  const A = dm.D.armies, pick = (l, n) => l.slice(0, n);
  let i = 0;
  for(const a of A) for(const b of A) if(a !== b) for(const ph of ['shooting', 'fight']) for(const au of pick(a.units.filter(u => ((ph === 'fight' ? u.melee : u.ranged) || []).length), 2)) for(const tu of pick(b.units, 2)) for(const state of ['start', 'all', 'none']){
    if((i++ % 11) !== 0) continue;   // a fixed sample, the same every run
    const s = { army:a.id, ph, atk:au.id, typed:asSet(tu), on:{} };
    const c0 = dm.calc(s);
    if(state !== 'start'){ for(const x of c0.rules) if(x.state === 'choice' || x.state === 'on') s.on[x.k] = state === 'all'; for(const w of c0.weapons) for(const l of w.lim) s.on[l.k] = state === 'all'; }
    if(state === 'all'){ for(const k of ['plunging', 'heavy']) s.on['c:' + k] = true; s.typed.cover = true; }
    const c = dm.calc(s);
    if(!c || !c.input.groups.length) continue;
    // the working as shown: its steps multiply out
    for(const g of C.explain(c.input).groups) for(const st of g.steps) for(const ch of chainsOf(st.t)){ sweep.chains++; if(!ch.ok) sweep.chainBad.push(a.id + '/' + au.id + ' → ' + b.id + '/' + tu.id + ': ' + ch.text + ' (the shown numbers give ' + ch.prod.toFixed(4) + ')'); }
    const first = C.explain(c.input), row = c.models[0];
    const one = Object.assign({}, row, { count:1, W:1e9, T:first.T });
    const input = Object.assign({}, c.input, { target:Object.assign({}, c.input.target, { models:[one] }), sims:3000, seed:5, moments:true });
    const x = C.explain(input), r = C.run(input);
    sweep.matchups++;
    x.groups.forEach((e, gi) => { if(e.out) return; for(const k of ['attacks', 'hits', 'wounds', 'unsaved', 'mortals', 'dmg']){
      sweep.compared++;
      const tol = 5 * r.groups[gi].sd[k] / Math.sqrt(input.sims) + 1e-6 * Math.max(1, Math.abs(e[k]));
      if(Math.abs(e[k] - r.groups[gi][k]) > tol) sweep.bad.push(a.id + '/' + au.id + ' → ' + b.id + '/' + tu.id + ' ' + ph + ' ' + state + ' · ' + c.input.groups[gi].name + ' ' + k + ': exact ' + e[k].toFixed(3) + ', played ' + r.groups[gi][k].toFixed(3) + ' (±' + tol.toFixed(3) + ')'); } });
  }
}
// W1 models: models destroyed and wounds lost are shown as the same number (every list's first two attackers at every W1 unit of the
// other lists, set by hand, shooting and fight, every 3rd)
{
  const A = dm.D.armies;
  let i = 0;
  for(const a of A) for(const b of A) if(a !== b) for(const tu of b.units) for(const ph of ['shooting', 'fight']) for(const au of a.units.filter(u => ((ph === 'fight' ? u.melee : u.ranged) || []).length).slice(0, 2)){
    const t = asSet(tu); if(t.W !== 1) continue;
    const c = dm.calc({ army:a.id, ph, atk:au.id, typed:t });
    if(!c || !c.input.groups.length || (i++ % 3) !== 0) continue;
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
// ---- what is left, and the return blow (run with track; returnBlow) ----
// 2 [TORRENT] attacks, S4 vs T4 (4+: 1/2 each), no save, D1, at 2 models of W1: none destroyed 1/4, one 1/2, both 1/4
const two = () => ({ groups:[g({ n:2, kw:['TORRENT'] })], target:{ T:4, models:[big(2, 1)] }, ctx:{}, sims:20000, seed:11 });
const leftP = (r, n) => (r.left.find(x => x.n.join() === n.join()) || { p:0 }).p;
cases.push(['track: the dice are the same with it (models destroyed, difference)', () => Math.abs(C.run(two()).killed - C.run(Object.assign(two(), { track:true })).killed), 0, 0]);
cases.push(['track: both models left, chance', () => leftP(C.run(Object.assign(two(), { track:true })), [2]), 1 / 4, 0.015]);
cases.push(['track: one model left, chance', () => leftP(C.run(Object.assign(two(), { track:true })), [1]), 1 / 2, 0.015]);
cases.push(['track: the row has none left (fate), chance', () => C.run(Object.assign(two(), { track:true })).fate[0], 1 / 4, 0.015]);
// a CHARACTER is allocated to last (05.03): one bodyguard model and the CHARACTER, W1 each, the same 2 attacks: the CHARACTER
// is destroyed only when both wound (1/4), the bodyguard model when at least one does (3/4)
const led = () => ({ groups:[g({ n:2, kw:['TORRENT'] })], target:{ T:4, models:[big(1, 1, 7, { name:'b', bodyguard:true }), big(1, 1, 7, { name:'c', char:true })] }, ctx:{}, sims:20000, seed:11, track:true });
cases.push(['track: the CHARACTER’s fate', () => C.run(led()).fate[1], 1 / 4, 0.015]);
cases.push(['track: the bodyguard model’s fate', () => C.run(led()).fate[0], 3 / 4, 0.015]);
// the return blow (B's cases, through play): each model left of the 2 has one [TORRENT] attack back (1/2 to destroy a W1 model
// of 3): models left on average 2 × 1/4 + 1 × 1/2 = 1, so 1/2 destroyed; nothing left to attack back 1/4;
// none destroyed: 1/4 (nothing left) + 1/4 × 1/4 (both left, both fail) + 1/2 × 1/2 (one left, it fails) = 9/16
const back1 = () => C.play({ beats:[{ side:1, input:{ groups:[g({ n:2, kw:['TORRENT'] })], target:{ T:4, models:[big(2, 1, 7, { lines:[{ id:0, n:2 }] })] }, ctx:{} } },
  { side:0, input:{ groups:[g({ name:'back', n:2, kw:['TORRENT'], carry:[[0, 1]] })], target:{ T:4, models:[big(3, 1)] }, ctx:{} } }], sims:20000, seed:5 });
cases.push(['return blow: models destroyed', () => back1().beats[1].killed, 1 / 2, 0.02]);
cases.push(['return blow: nothing left to attack back, chance', () => back1().beats[0].wipe, 1 / 4, 0.015]);
cases.push(['return blow: none destroyed, chance', () => back1().beats[1].dist[0], 9 / 16, 0.015]);
cases.push(['return blow: models left to attack back, on average', () => (r => r.sides[1].models - r.sides[1].killed)(back1()), 1, 0.03]);
// which models are left decides the weapons: the CHARACTER (2 [TORRENT] attacks, S8 vs T4: 2+, 5/6 each) and the bodyguard
// model (1 attack, 1/2). Both left 1/4, only the CHARACTER 1/2, none 1/4:
// 1/4 × (5/3 + 1/2) + 1/2 × 5/3 = 13/24 + 20/24 = 1.375 destroyed of 10 W1 models
cases.push(['return blow: the weapons of the models left', () => C.play({ beats:[{ side:1, input:{ groups:[g({ n:2, kw:['TORRENT'] })], target:{ T:4, models:[big(1, 1, 7, { name:'b', bodyguard:true, lines:[{ id:0, n:1 }] }), big(1, 1, 7, { name:'c', char:true, lines:[{ id:1, n:1 }] })] }, ctx:{} } },
  { side:0, input:{ groups:[g({ name:'c', n:1, A:'2', S:8, kw:['TORRENT'], carry:[[1, 1]] }), g({ name:'b', n:1, kw:['TORRENT'], carry:[[0, 1]] })], target:{ T:4, models:[big(10, 1)] }, ctx:{} } }], sims:20000, seed:5 }).beats[1].killed, 33 / 24, 0.03]);
// ---- the turn as the screen plans it: Both, no hazard rolls, a tick that lasts ----
const turnOf = (s, sims) => { const p = dm.plan(s); return { p, r:C.play(dm.app.dmIn(p, sims || 20000)) }; };
const memo = f => { let v; return () => v || (v = f()); };
const MT = m => dm.app.dmModeTurn(m);
// Both: Mek + Flash Gitz shoot, charge and fight 20 models set as Khorne Berzerkers. Its total is the play of the Shoot step and the
// charged Fight step, one after the other in the same games (the fight meets what the shooting left); no hazard rolls on the screen (the
// calculator shows damage dealt: said under Not counted, with the weapons), so all 10 Gitz fight
const FGS = { army:'shooty', atk:'mek-flashgitz', typed:cp(BERZ) };
const FG = memo(() => turnOf(Object.assign({ turn:{ me:MT('both') } }, FGS)));
const FGX = memo(() => { const p0 = dm.plan(Object.assign({ turn:{ me:MT('both') } }, FGS)), s = p0.beats[0], f = p0.beats[1];
  return C.play({ beats:[s, f].map(b => ({ side:1, ph:b.ph, fight:b.ph === 'fight', input:Object.assign({}, b.M.input, { sims:undefined, seed:undefined }) })), sims:20000, seed:7 }); });
cases.push(['Both: the shooting, then the charged fight (two steps, the fight charged)', () => +(FG().p.both && FG().p.beats.map(b => b.id).join() === 'shoot,fight' && FG().p.beats[1].M.ctx.charged === true), 1]);
cases.push(['Both: the total is the Shoot → Charge → Fight play of the same choices', () => dm.app.dmTotalAns(FG().p, FG().r).killed - FGX().sides[1].killed, 0, 0.05]);
cases.push(['Both: the total is the two parts added up', () => (A => A.killed - A.parts.reduce((t, x) => t + x.killed, 0))(dm.app.dmTotalAns(FG().p, FG().r)), 0, 1e-9]);
cases.push(['Both: no hazard rolls, on the screen or under Not counted', () => +(!FG().r.beats[0].hazard && !FG().p.beats[0].M.nc.some(x => /^Hazard rolls/.test(x.name))), 1]);
cases.push(['Both: all 10 Gitz fight', () => FG().r.beats[1].groups.find(x => x.n > 1).n, 10, 0]);
// Both with no ranged weapons is the fight alone (said); Fight's "Charged this turn" is the player's (unticked to start with)
cases.push(['Both, no ranged weapons: the fight alone, said', () => (p => +(!p.both && p.beats.map(b => b.id).join() === 'fight' && /no ranged weapons, so this is the fight alone/.test(p.note)))(dm.plan({ army:'princes', atk:'eightbound', turn:{ me:MT('both') } })), 1]);
cases.push(['Shoot, no ranged weapons: said, nothing played', () => (p => +(!p.beats.length && /(has|have) no ranged weapons: Fight shows its melee attacks/.test(p.msg)))(dm.plan({ army:'princes', atk:'eightbound', turn:{ me:MT('shoot') } })), 1]);
cases.push(['Fight: “Charged this turn” unticked to start with, the player’s', () => (p => +(!p.beats[0].M.ctx.charged && !dm.app.dmCharged(dm.app.dmState(), p.turn)))(dm.plan({ army:'simple-but-effective', atk:'nazdreg-meganobz', turn:{ me:MT('fight') } })), 1]);
// the earlier screen's stored turns, read as modes: Shoot and Fight together are Both; "they attack" is gone
cases.push(['a stored turn of steps, read as a mode', () => { const st = { turn:{ me:{ shoot:true, charge:true, fight:true, back:true }, them:{ charge:true, fight:true } }, step:{ me:'fight', them:'fight' } }; dm.app.dmModeOld(st);
  return +(st.turn.me.mode === 'both' && !st.turn.me.back && !st.turn.them && !st.step.them && st.step.me === ''); }, 1]);
// a state saved by the earlier screen with "they attack" (their unit attacking yours): yours attacks the target set by hand
cases.push(['a stored "they attack": your unit attacks', () => { const p = dm.plan({ army:'shooty', dir:'them', atk:'forgefiend', tgt:'mek-flashgitz', aArmy:'princes', tArmy:'' }); const st = dm.app.dmState();
  return +(p.P.au.id === 'mek-flashgitz' && st.dir === 'me' && !('aArmy' in st) && !('tgt' in st)); }, 1]);
cases.push(['a new turn in the mode shown, when the unit can play it', () => { const P = n => ({ au:{ ranged:n.r ? [1] : [], melee:n.m ? [1] : [] } });
  return +(dm.app.dmStart(P({ r:1, m:1 }), 'fight').mode === 'fight' && dm.app.dmStart(P({ m:1 }), 'shoot').mode === 'fight' && dm.app.dmStart(P({ m:1 }), 'both').mode === 'both' && dm.app.dmStart(P({ r:1 }), '').mode === 'shoot'); }, 1]);
// a tick that lasts: an army rule's round-long pick carries by its name and pick: the Conqueror Imperative ticked for the Kastelans'
// shooting (within 6" said) is ticked in their fight (+1 AP there), and the fight can untick it for itself
const KAS = { army:'purge-goes-the-foe', atk:'cybernetica-datasmith-kastelan-robots', typed:cp(BERZ), facts:{ me:{ mine:{ battleline6:true } } } };
const DOCK = memo(() => dm.plan(Object.assign({ turn:{ me:MT('both') } }, cp(KAS))).beats[0].M.rules.find(r => r.m.from === 'Doctrina Imperatives'));
const kas = more => dm.plan(Object.assign({ turn:{ me:MT('both') }, ch:Object.assign({ 'me:shoot':{ on:{ [DOCK().k]:true }, val:{ [DOCK().pillKey]:'Conqueror Imperative' } } }, more || {}) }, cp(KAS)));
cases.push(['a tick that lasts: carried into the fight', () => (x => +(!!x && x.on && x.pick === 'Conqueror Imperative' && !!x.carried && x.carried.from === 'Shoot'))(kas().beats[1].M.rules.find(r => r.m.from === 'Doctrina Imperatives')), 1]);
cases.push(['a tick that lasts: the fight’s +1 AP', () => (p => p.beats[1].M.R.groups[0].AP - kas({ 'me:fight':{ on:{ [DOCK().k]:false } } }).beats[1].M.R.groups[0].AP)(kas()), -1, 0]);
cases.push(['a tick that lasts: unticked in the fight alone', () => (p => +(!p.beats[1].M.rules.find(r => r.k === DOCK().k).on && p.beats[0].M.rules.find(r => r.k === DOCK().k).on))(kas({ 'me:fight':{ on:{ [DOCK().k]:false } } })), 1]);
// Clever Know-wotz (oneModel) on a unit of 6 Killa Kans: +1 to hit for one model's weapons: of 12 Kill Shot attacks the 2 of one Kan
// hit on a roll one better: + 2 × 1/6 hits
cases.push(['Clever Know-wotz: one model’s weapons', () => { const s = { army:'shooty', ph:'shooting', atk:'killa-kans', typed:{ n:20, T:4, W:1, Sv:7 } };
  const h0 = C.explain(dm.calc(s).input).total.hits; s.on = { [box(s, 'Clever Know-wotz').k]:true }; const c = dm.calc(s);
  return (c.input.groups.filter(x => x.mods.some(m => /Clever Know-wotz/.test(m.from))).reduce((t, x) => t + x.n, 0) === 1) * (C.explain(c.input).total.hits - h0); }, 2 / 6, 1e-9]);
// "this unit or the target within range of an objective": one fact for the pair, said once, ticks the rules of either
cases.push(['the pair on an objective: one fact for both units', () => { const s = { army:'shooty', atk:'mek-flashgitz', typed:{ n:10, T:4, W:1, Sv:3 }, facts:{ me:{ pair:{ objective:true } } } };
  const p = dm.plan(s), st = dm.app.dmState(), f = dm.app.dmLevers(st, dm.app.dmPlan(st)).filter(l => l.fact === 'objective');
  return +(f.length === 1 && f[0].unitWho === 'pair' && f[0].on && ['Finderz Keeperz', 'Wreckin’ and Lootin’'].every(n => p.beats[0].M.rules.find(r => r.m.from === n).on)); }, 1]);
// Khârn's Legendary Killer (while he leads the unit): a box, unticked like every box (the owner's decision, 29 Oct 2026), its condition said
cases.push(['Legendary Killer: a box, unticked, “While leading a unit”', () => (r => +(!!r && !r.on && r.state === 'choice' && /While leading a unit/.test(r.label)))(dm.calc({ army:'princes', ph:'fight', atk:'kh-rn-the-betrayer-khorne-berzerkers', typed:{} }).rules.find(r => r.k === LK)), 1]);
// a step added after it moves nothing: Khârn's Shoot is the same with the fight after it
const same = (x, y) => +(JSON.stringify(x) === JSON.stringify(y));
const KHF = turn => turnOf({ army:'princes', atk:'kh-rn-the-betrayer-khorne-berzerkers', typed:{ n:5, T:6, W:3, Sv:2 }, turn:{ me:turn } });
cases.push(['the turn: Khârn’s Shoot, the fight added after it', () => same(KHF({ shoot:true }).r.beats[0], KHF({ shoot:true, charge:true, fight:true }).r.beats[0]), 1]);
// every unit of every list at a target set as one unit of each other list: the shooting alone and with the fight after it give the same
// numbers for the shooting (node verify/calc-test.js --later-all: every unit of every other list)
const later = (() => { const all = process.argv.includes('--later-all'), r9 = v => typeof v === 'number' ? Math.round(v * 1e9) / 1e9 : v;
  const sig = b => JSON.stringify({ k:b.killed, d:b.dmg, w:b.wipe, bf:b.before, dist:b.dist, rows:b.rows.map(r => r.gone), g:b.groups.map(g => [g.n, g.attacks, g.hits, g.wounds, g.dmg]) }, (k, v) => r9(v));
  const fam = [{ shoot:true }, { shoot:true, charge:true, fight:true }];
  const out = { pairs:0, turns:0, compared:0, bad:[] };
  for(const A of dm.D.armies) for(const [ui, au] of A.units.entries()){ const others = dm.D.armies.filter(B => B !== A);
    for(const tu of all ? others.flatMap(B => B.units) : others.map((B, i) => B.units[(ui + i) % B.units.length])){ out.pairs++;
      let prev = null;
      for(const tr of fam){ const p = dm.plan({ army:A.id, atk:au.id, typed:asSet(tu), turn:{ me:tr } }); if(!p.beats.length) continue; out.turns++;
        const r = C.play(dm.app.dmIn(p, 40)), now = p.beats.map((b, i) => ({ id:b.id, i, s:sig(r.beats[i]) }));
        if(prev) for(const x of prev){ const y = now.find(z => z.id === x.id); out.compared++; if(!y || y.i !== x.i || y.s !== x.s) out.bad.push(A.id + '/' + au.id + ' → ' + tu.id + ' ' + Object.keys(tr).join('+') + ': ' + x.id); }
        prev = now; } } }
  if(all || out.bad.length || process.argv.includes('-v')) console.log('  later steps: ' + out.pairs + ' pairs, ' + out.turns + ' turns, ' + out.compared + ' steps compared, ' + out.bad.length + ' moved' + (out.bad.length ? ': ' + out.bad.slice(0, 5).join(' · ') : ''));
  return out; })();
cases.push(['the turn: a later step never moves an earlier one (' + later.pairs + ' pairs, ' + later.compared + ' steps compared; moved)', () => later.bad.length, 0, 0]);
// Try Dat Button!: one D6, one result; two D6, two different results (the owner's reading of "keep re-rolling duplicate results"): the
// picks are the three results and the three pairs, no choice of the dice, no hazard roll counted (the calculator shows damage dealt)
const TDBr = box({ army:'shooty', ph:'shooting', atk:'dakkarig-boosta', typed:{} }, 'Try Dat Button!'), TDB = TDBr.k;
const dak = pick => dm.plan({ army:'shooty', atk:'dakkarig-boosta', typed:cp(BERZ), turn:{ me:MT('shoot') },
  ch:pick ? { 'me:shoot':{ on:{ [TDB]:true }, val:{ [TDBr.pillKey]:pick } } } : {} });
cases.push(['Try Dat Button!: the three results and the three pairs, nothing else to pick', () => (r => +(r.pills.map(p => p[0]).join('|') === '1–2|3–4|5–6|1–2 and 3–4|1–2 and 5–6|3–4 and 5–6' && !r.dice))(dak('1–2').beats[0].M.rules.find(r => r.k === TDB)), 1]);
cases.push(['Try Dat Button!: the picks are its table’s rows (GW’s), their effects from the rows’ words', () => +(['1–2', '3–4', '5–6', '1–2 and 3–4', '1–2 and 5–6', '3–4 and 5–6'].map(k => (r => FXC.fxLabel(r.m.box.pick.find(p => p.name === r.pick).fx))(dak(k).beats[0].M.rules.find(r => r.k === TDB))).join('|') === '+1 A|+2 S|+1 AP|+1 A, +2 S|+1 A, +1 AP|+2 S, +1 AP'), 1]);
cases.push(['Try Dat Button!, two results: both counted (+1 A and +1 AP)', () => (a => (b => +(b.R.groups.every((g, i) => g.out || Math.abs(g.AP) === Math.abs(a.R.groups[i].AP) + 1) && C.explain(b.input).total.attacks > C.explain(a.input).total.attacks))(dak('1–2 and 5–6').beats[0].M))(dak('').beats[0].M), 1]);
cases.push(['Try Dat Button!, two D6: no hazard roll named', () => (M => +(!M.sit.some(x => x.k === 'c:hazard') && !M.nc.some(x => /^Hazard rolls/.test(x.name))))(dak('1–2 and 5–6').beats[0].M), 1]);
cases.push(['Try Dat Button!, one D6: no hazard roll to name', () => +!dak('5–6').beats[0].M.nc.some(x => /^Hazard rolls/.test(x.name)), 1]);
// the Kustom Mega-blasta, [HAZARDOUS] and [SUPA-HAZARDOUS]: hazard rolls are not counted and not named (the engine still plays them when
// asked: the cases above)
cases.push(['hazard: Big Mek in Mega Armour shooting: no hazard line (the owner: irrelevant for the damage)', () => (p => +!p.beats[0].M.nc.some(x => /^Hazard rolls/.test(x.name)))(dm.plan({ army:'shooty', atk:'bigmek-mega', typed:{}, turn:{ me:MT('shoot') } })), 1]);
// a choice's effect is the damage dealt over the whole turn: nothing of what the attacking unit loses
const effOf = (s, id) => { const p0 = dm.plan(s), st = dm.app.dmState(), lv = dm.app.dmLevers(st, p0).find(l => l.id === id), s2 = JSON.parse(JSON.stringify(st)); lv.apply(s2);
  const p2 = dm.app.dmPlan(s2), a = dm.app.dmNums(p0, p0.k, C.play(dm.app.dmIn(p0, 10000))), b = dm.app.dmNums(p2, p2.beats.findIndex(x => x.id === p0.beats[p0.k].id), C.play(dm.app.dmIn(p2, 10000)));
  return { a, b, d:dm.app.dmDelta(a, b) }; };
cases.push(['the measures: damage dealt only', () => (x => +(!('own' in x.a) && !('chars' in x.a) && !('vo' in x.d) && !('trade' in x.d)))(effOf(Object.assign({ turn:{ me:MT('both') } }, FGS), 'shoot/w:ranged:Snazzgun|Flash Gitz')), 1]);
// Both: a shooting choice measured on the total (the Snazzguns unticked: the shooting's models and what the fight then meets)
cases.push(['Both: a shooting choice, measured on the total', () => (x => +(x.d.v < -1 && x.d.good === false))(effOf(Object.assign({ turn:{ me:MT('both') } }, FGS), 'shoot/w:ranged:Snazzgun|Flash Gitz')), 1]);
// Unshackled Wrath's "All three": more destroyed; its [HAZARDOUS] is not counted (damage dealt only): good news
const UWr = strat({ army:'purge-goes-the-foe', ph:'shooting', atk:'skitarii-rangers', typed:{} }, 'Unshackled Wrath');
cases.push(['Unshackled Wrath, all three: more destroyed, its hazard not counted', () => (d => +(d.v > 0 && d.good === true && !('trade' in d)))(effOf({ army:'purge-goes-the-foe', atk:'skitarii-rangers', typed:{ n:10, T:4, W:1, Sv:4, InSv:0, fnp:0 } }, 'k:' + UWr.k + '|' + UWr.pills[2][0]).d), 1]);
// a stratagem used on another unit of the list whose words reach yours: from other units in your list, marked as its words say (Daemonic
// Fury on a BLOOD LEGIONS unit selects a WORLD EATERS unit: Angron's [LANCE]; Honoured Interred's aura on a DREADNOUGHT: Trajann's re-roll)
cases.push(['from other units: Daemonic Fury for Angron, selected, [LANCE]', () => (r => +(r.m.grp === 'other' && r.m.mark === 'selected' && r.e.lance === true))(box({ army:'big-demons-baby', ph:'fight', atk:'angron', typed:{} }, 'Daemonic Fury', x => !!x.e.lance)), 1]);
cases.push(['from other units: Honoured Interred for Trajann, an aura, re-roll hit rolls of 1', () => (r => +(r.m.grp === 'other' && r.m.mark === 'aura' && r.e.rrHit === '1s'))(box({ army:'lite-knights', ph:'fight', atk:'trajann-valoris-allarus-custodians', typed:{} }, 'Honoured Interred')), 1]);
cases.push(['a rule the list printed into the weapons is not counted again (Relentless Rage, +1 A on the profile)', () => +dm.calc({ army:'princes', ph:'fight', atk:'kh-rn-the-betrayer-khorne-berzerkers', typed:{} }).nc.some(x => x.name === 'Relentless Rage' && /already in its weapons/.test(x.why)), 1]);
// Doctrina Imperatives' both at once, GW's words (Thulia Ghuld's Icon of War, The Fires of Mars: "the Conqueror Imperative and Protector
// Imperative are both active for that unit"): a pill for the SKITARII or THULIA GHULD units it selects, both rows' effects together
const DOCB = memo(() => box({ army:'purge-goes-the-foe', ph:'shooting', atk:'skitarii-rangers', typed:{} }, 'Doctrina Imperatives'));
cases.push(['Doctrina: the both pill, from Icon of War', () => +((DOCB().pills || []).some(p => /^Conqueror Imperative and Protector Imperative \(Icon of War: The Fires of Mars\)$/.test(p[0]))), 1]);
cases.push(['Doctrina: the both pill counts both rows', () => (r => { const p = r.pills.find(x => /^Conqueror Imperative and Protector Imperative/.test(x[0]))[0]; const c = dm.calc({ army:'purge-goes-the-foe', ph:'shooting', atk:'skitarii-rangers', typed:{}, on:{ [r.k]:true }, val:{ [r.pillKey]:p } }).rules.find(x => x.k === r.k);
  return +(!!c.e.heavy && c.e.skill === 1 && c.e.ap === 1); })(DOCB()), 1]);   // ([ASSAULT]: no effect in these numbers; +1 AP: the Conqueror's part, a BATTLELINE unit)
cases.push(['Doctrina: no both pill for a unit the Icon of War cannot select (Belisarius Cawl: no SKITARII or THULIA GHULD)', () => +!dm.calc({ army:'purge-goes-the-foe', ph:'shooting', atk:'belisarius-cawl', typed:{} }).rules.some(r => r.m.from === 'Doctrina Imperatives' && (r.pills || []).some(p => / and /.test(p[0]))), 1]);
// your unit changed: a tick whose rule still applies is kept (Kustom Dakka, Tankbustas → Flash Gitz: the same turn as picked so); one
// with no rule for the new unit is dropped and said (Try Dat Button!, the Big Mek Dakkarig's), in a step out of the turn too
const KD = strat({ army:'shooty', ph:'shooting', atk:'mek-tankbustas', typed:{} }, 'Kustom Dakka').k;
const order = (s0, id, s1) => { dm.plan(cp(s0)); const st = dm.app.dmState(), r = dm.app.dmSetUnit(st, id); const a = dm.app.dmIn(dm.app.dmPlan(st), 300), b = dm.app.dmIn(dm.plan(cp(s1)), 300); return { same:JSON.stringify(a) === JSON.stringify(b), r }; };
const FGL = { army:'shooty', atk:'mek-flashgitz', typed:cp(BERZ), turn:{ me:{ shoot:true } }, ch:{ 'me:shoot':{ on:{ [KD]:true } } } };
cases.push(['your unit changed: a tick whose rule still applies is kept', () => +order(Object.assign({}, FGL, { atk:'mek-tankbustas' }), 'mek-flashgitz', FGL).same, 1]);
const toGitz = memo(() => order({ army:'shooty', atk:'dakkarig-boosta', typed:cp(BERZ), turn:{ me:{ shoot:true } }, ch:{ 'me:shoot':{ on:{ [TDB]:true } } } }, 'mek-flashgitz', { army:'shooty', atk:'mek-flashgitz', typed:cp(BERZ), turn:{ me:{ shoot:true } } }));
cases.push(['your unit changed: a tick with no rule for it is dropped (the same turn as picked so)', () => +toGitz().same, 1]);
cases.push(['your unit changed: ... and said', () => +/^Try Dat Button! unticked: not for Mek \+ Flash Gitz$/.test(toGitz().r.words), 1]);
cases.push(['your unit changed: a step out of the turn is cleaned too', () => { dm.plan({ army:'shooty', atk:'dakkarig-boosta', typed:cp(BERZ), turn:{ me:{ shoot:true } }, ch:{ 'me:shoot':{ on:{ [TDB]:true } } } }); const st = dm.app.dmState();
  st.turn.me = { shoot:false, charge:true, fight:true }; const r = dm.app.dmSetUnit(st, 'mek-flashgitz'); st.turn.me.shoot = true;
  const a = dm.app.dmIn(dm.app.dmPlan(st), 300).beats[0], b = dm.app.dmIn(dm.plan({ army:'shooty', atk:'mek-flashgitz', typed:cp(BERZ), turn:{ me:{ shoot:true, charge:true, fight:true } } }), 300).beats[0];
  return +(JSON.stringify(a) === JSON.stringify(b) && /Try Dat Button! unticked/.test(r.words)); }, 1]);
// your unit changed: the facts about the attack reset (the half-range band, the closest target, an objective of either, the unit's own),
// said; the target's own facts kept
cases.push(['your unit changed: the facts about the attack reset, and said', () => { dm.plan({ army:'shooty', atk:'mek-flashgitz', typed:{}, turn:{ me:{ shoot:true } },
    ch:{ 'me:shoot':{ on:{ 'c:plunging':true }, val:{ half:7.5 } } }, facts:{ me:{ theirs:{ closest18:true, objective:true }, mine:{ stationary:true }, pair:{ objective:true } } } });
  const st = dm.app.dmState(), r = dm.app.dmSetUnit(st, 'mek-tankbustas');
  return +(/reset: .*closest within 18"/.test(r.words) && /half range/.test(r.words) && /Plunging Fire/.test(r.words) && !st.facts.me.theirs.closest18 && st.facts.me.theirs.objective === true && !st.ch['me:shoot'].val.half && !st.facts.me.mine.stationary && r.dropped.some(d => d.fact && d.k === 'closest18')); }, 1]);
// ---- the engine: improvements after a value set, [HEAVY] from a rule, [TORRENT] in snap shooting, a shield ----
cases.push(['BS improved by 1: 4+ hits on 3+', () => run([g({ n:600, mods:[{ from:'x', skill:1 }] })], { T:4, models:[big(1, 1e9)] }, { ranged:true }).groups[0].hits / 600, 4 / 6, 0.02]);
cases.push(['BS 3+ set, then improved by 1 (the FAQ order): 2+', () => run([g({ n:600, skill:'5+', mods:[{ from:'ADT', set:{ BS:'3+' } }, { from:'Protector', skill:1 }] })], { T:4, models:[big(1, 1e9)] }, { ranged:true }).groups[0].hits / 600, 5 / 6, 0.02]);
cases.push(['[HEAVY] from a rule: +1 to hit when stationary', () => run([g({ n:600, mods:[{ from:'Protector', heavy:true }] })], { T:4, models:[big(1, 1e9)] }, { ranged:true, heavy:true }).groups[0].hits / 600, 4 / 6, 0.02]);
cases.push(['[TORRENT] in snap shooting: hits automatically (24.37)', () => run([g({ n:600, kw:['TORRENT'] })], { T:4, models:[big(1, 1e9)] }, { ranged:true, snap:true }).groups[0].hits / 600, 1, 0]);
cases.push(['[TORRENT] in snap shooting: only on a 6, as 15.09 reads', () => run([g({ n:600, kw:['TORRENT'] })], { T:4, models:[big(1, 1e9)] }, { ranged:true, snap:true, snapSix:true }).groups[0].hits / 600, 1 / 6, 0.02]);
const SH = (kw, n) => run([g({ n:60, S:8, kw:kw || [], skill:'3+' })], { T:4, models:[big(10, 1)], shield:{ name:'Gretchin', models:[{ name:'Gretchin', count:n || 100, W:1 }] } }, { ranged:true });
cases.push(['Grot Shields: every hit stopped while a Gretchin is left', () => SH().killed, 0, 0]);
cases.push(['Grot Shields: each hit stopped is a mortal wound on the Gretchin', () => SH().shield.lost, 40, 1.2]);
cases.push(['Grot Shields: [TORRENT] hits go through', () => SH(['TORRENT']).killed, 10 - 0, 0.05]);
cases.push(['Grot Shields: 5 Gretchin stop the first 5 hits only', () => SH([], 5).shield.hits, 5, 0]);
// ---- the army rules' reading: Doctrina Imperatives, the Blessings of Khorne, the Rituals; Code Chivalric; Fire Overwatch ----
const SR = { army:'purge-goes-the-foe', atk:'skitarii-rangers', typed:{ n:5, T:5, W:2, Sv:4 }, ph:'shooting' };
const DOC = s => dm.calc(s).rules.find(r => r.m.from === 'Doctrina Imperatives') || {};
const docOn = (s, pick, more) => { const d = DOC(cp(s)); return dm.calc(Object.assign(cp(s), { on:Object.assign({ [d.k]:true }, more || {}), val:{ [d.pillKey]:pick + ' Imperative' } })); };
cases.push(['Doctrina Imperatives: offered, never ticked for you', () => +(DOC(cp(SR)).state === 'choice' && !DOC(cp(SR)).on), 1]);
cases.push(['Doctrina Imperatives: Protector improves BS by 1 and gives [HEAVY] (its box shown)', () => { const c = docOn(SR, 'Protector'), w = c.R.groups[0];
  return +(w.bs === (parseInt(c.groups[0].skill, 10) - 1) && c.sit.some(x => x.k === 'c:heavy')); }, 1]);
cases.push(['Doctrina Imperatives: Conqueror +1 AP for a BATTLELINE unit by itself', () => { const a = dm.calc(cp(SR)).R.groups[0].AP, b = docOn(SR, 'Conqueror').R.groups[0].AP; return a - b; }, 1, 0]);
const IS = { army:'purge-goes-the-foe', atk:'ironstrider-ballistarii', typed:{ n:5, T:5, W:2, Sv:4 }, ph:'shooting' };
cases.push(['Doctrina Imperatives: Conqueror +1 AP only with the BATTLELINE fact (an Ironstrider)', () => { const a = docOn(IS, 'Conqueror').R.groups[0].AP, b = docOn(Object.assign(cp(IS), { fx:{ battleline6:true } }), 'Conqueror').R.groups[0].AP; return a - b; }, 1, 0]);
// (its picks are its table's rows, GW's words: no "Both", which only other rules give; the player counts the other one with Custom modifiers)
cases.push(['Doctrina Imperatives: its picks are its two Imperatives, and both at once where Icon of War selects the unit', () => +(DOC(cp(SR)).pills.map(p => p[0]).join() === 'Protector Imperative,Conqueror Imperative,Conqueror Imperative and Protector Imperative (Icon of War: The Fires of Mars)'), 1]);
cases.push(['Doctrina Imperatives: Auto-divinatory Targeting and Protector: BS 2+ (the FAQ)', () => { const d = DOC(cp(IS)), adt = dm.calc(cp(IS)).rules.find(r => r.m.from === 'Auto-divinatory Targeting').k;
  return dm.calc(Object.assign(cp(IS), { on:{ [d.k]:true, [adt]:true }, val:{ [d.pillKey]:'Protector Imperative' } })).R.groups[0].bs; }, 2, 0]);
cases.push(['Murderous Imperative: two boxes, as its two lines, each saying its Imperative', () => { const ms = dm.calc(cp(SR)).rules.filter(r => r.m.from === 'Murderous Imperative');
  return +(ms.length === 2 && ms.some(m => m.e.rrHit === '1s' && /Protector Imperative is active/.test(m.label)) && ms.some(m => m.e.rrWound === '1s' && /Conqueror Imperative is active/.test(m.label)) && ms.every(m => !m.on)); }, 1]);
// the Blessings of Khorne: each its own tick; two at once, a third counted by you; Decapitating Strikes (vs INFANTRY) a box like any other
const KB = { army:'princes', atk:'kh-rn-the-betrayer-khorne-berzerkers', typed:{}, ph:'fight' };
const bless = s => dm.calc(cp(s)).rules.filter(r => r.m.limit);   // (each a row of the Blessings of Khorne, "activate up to two")
cases.push(['Blessings of Khorne: three ticked, the third counted by you', () => { const on = {}; for(const r of bless(KB)) on[r.k] = true; const c = dm.calc(Object.assign(cp(KB), { on }));
  return c.rules.filter(r => r.m.limit && r.over).length * 10 + c.rules.filter(r => r.m.limit && r.on && !r.over).length; }, 12, 0]);
cases.push(['Blessings of Khorne: Decapitating Strikes is a box (the target’s keywords)', () => +(dm.calc(cp(KB)).rules.find(r => /^Decapitating Strikes/.test(r.label)).state === 'choice'), 1]);
// Total Carnage (its models destroyed before they fought, fighting back) is not played: not offered in a fight
cases.push(['Total Carnage: not offered in a fight', () => +!dm.plan({ army:'princes', atk:'kh-rn-the-betrayer-khorne-berzerkers', typed:{}, turn:{ me:MT('fight') } }).beats[0].M.rules.some(r => r.m.onDeath), 1]);
// Fire Overwatch for a TITANIC unit: ruled out (15.08), the player's to count anyway; [TORRENT] in snap shooting: no reading to pick
cases.push(['Fire Overwatch: ruled out for a TITANIC unit (15.08)', () => +/15\.08/.test((dm.calc({ army:'4-megas-and-a-destrier', atk:'canis-rex', typed:{}, ph:'shooting', on:{ 'c:snap':true } }).sit.find(x => x.k === 'c:snap') || {}).ruled || ''), 1]);
const NZ = { army:'simple-but-effective', atk:'nazdreg-meganobz', typed:{}, ph:'shooting', on:{ 'c:snap':true } };
cases.push(['[TORRENT] in snap shooting: it hits automatically (24.37), no reading to pick', () => +(!dm.calc(cp(NZ)).sit.find(x => x.k === 'c:snap').torrent && dm.calc(Object.assign(cp(NZ), { val:{ snapTorrent:'six' } })).ctx.snapSix === false), 1]);
// Canis Rex: Sir Hekhtur is not on the battlefield while Canis Rex lives: his weapons unticked (counted by you)
cases.push(['Canis Rex: Hekhtur’s pistol unticked, with the reason quoted', () => (w => +(!!w && !w.on && /Using Sir Hekhtur/.test(w.emb)))(dm.calc({ army:'4-megas-and-a-destrier', atk:'canis-rex', typed:{}, ph:'shooting' }).weapons.find(c => /Hekhtur/.test(c.k))), 1]);
// Code Chivalric's Quality 1–2 ("you can re-roll one Hit roll and you can re-roll one Wound roll"): a box (the Quality is the player's
// pick for the battle), no longer in Not counted; ticked, one hit and one wound re-roll for the unit's attacks
const KP = { army:'6-bigs', atk:'knight-paladin', typed:{}, ph:'shooting' };
cases.push(['Code Chivalric (Quality 1–2): a box for a Knight, not in Not counted', () => { const c = dm.calc(cp(KP)), r = c.rules.find(x => x.m.from === 'Code Chivalric');
  return +(!!r && r.state === 'choice' && !r.on && !c.nc.some(x => /^Code Chivalric/.test(x.name))); }, 1]);
cases.push(['Code Chivalric (Quality 1–2): ticked, one hit roll and one wound roll re-rolled', () => { const k = dm.calc(cp(KP)).rules.find(x => x.m.from === 'Code Chivalric').k, c = dm.calc(Object.assign(cp(KP), { on:{ [k]:true } }));
  return +(c.R.pool.length === 2 && c.R.pool.every(e => e.n === 1 && !e.phase && /^Code Chivalric/.test(e.src)) && c.R.pool.map(e => e.kind).sort().join() === 'h,w'); }, 1]);
// (a Ritual of the Cabal of Sorcerers reaches every THOUSAND SONS model of the army, its words: "each time a THOUSAND SONS or SCINTILLATING
// LEGIONS model from your army makes an attack that targets that unit"; its 10+ result a box of its own, as its sentence)
cases.push(['Destiny’s Ruin: for a THOUSAND SONS unit, 10+ re-rolls every hit roll', () => { const s = { army:'pubstomper', atk:'tzaangors', typed:{}, ph:'shooting' }, r = dm.calc(cp(s)).rules.find(x => x.m.from === 'Cabal of Sorcerers' && /Destiny’s Ruin/.test(x.label) && /10\+/.test(x.label));
  return +(!!r && dm.calc(Object.assign(cp(s), { on:{ [r.k]:true } })).R.groups.every(g => g.out || g.rrHit === 'all')); }, 1]);
// Both: the charge taken as made ("Charged this turn" ticked for the fight, said why); unticked, the fight with no charge move; with
// close-quarters shooting no charge (it is engaged: 10.06)
const KT = (turn, ch) => dm.plan({ army:'princes', atk:'kh-rn-the-betrayer-khorne-berzerkers', typed:{ n:5, T:6, W:3, Sv:2 }, turn:{ me:turn }, ch:ch || {} });
const MC = p => p.beats[p.beats.length - 1].M.rules.find(r => r.m.from === 'Murderous Charge').on;
cases.push(['Both: the fight charged (Murderous Charge ticked for you), said why', () => { const p = KT(MT('both')), L = dm.app.dmLevers(dm.app.dmState(), p).find(l => l.id === 'f:mine:charged');
  return +(MC(p) && !!L && L.on && /Both takes the charge as made/.test(L.why) && L.bi === 1); }, 1]);
cases.push(['Both: the charge unticked: the fight with no charge move; ticked again: charged', () => { const p0 = KT(MT('both')), st = dm.app.dmState(), tr = st.turn.me; dm.app.dmSetCharge(st, tr, false);
  const p1 = dm.app.dmPlan(st), off = !MC(p1) && !dm.app.dmCharged(st, tr) && tr.bc === false; dm.app.dmSetCharge(st, tr, true); return +(off && MC(dm.app.dmPlan(st)) && p0.both); }, 1]);
cases.push(['Both: close-quarters shooting, then the fight: no charge', () => +!MC(KT(MT('both'), { 'me:shoot':{ on:{ 'c:cq':true } } })), 1]);
cases.push(['Fight: “Charged this turn” ticked by the player: charged; the mode kept it', () => { const p = KT(dm.app.dmModeTurn('fight', { fc:true })), st = dm.app.dmState(), t2 = dm.app.dmModeTurn('both', st.turn.me), t3 = dm.app.dmModeTurn('fight', t2);
  return +(MC(p) && t3.charge === true && t2.mode === 'both'); }, 1]);
// Both's levers: the shooting's and the fight's, each with its step; a fact once for the whole turn
cases.push(['Both: the levers of both steps, the facts once', () => { const p = KT(MT('both')), L = dm.app.dmLevers(dm.app.dmState(), p), ids = L.map(l => l.id);
  return +(L.some(l => l.id.startsWith('shoot/w:')) && L.some(l => l.id.startsWith('fight/w:')) && new Set(ids).size === ids.length && L.filter(l => l.fact && l.store === 'riled' && l.unitWho === 'mine').length <= 1); }, 1]);

// ---- a re-roll of one die (01.05.02): the first failed roll it can go to; a pool shared by the weapons, and by the phase ----
// one attack at 4+ with one hit re-roll: 1/2 + 1/2 × 1/2 = 0.75 hits (played; the working's exact average the same)
const one = (mods, o) => g(Object.assign({ mods }, o || {}));
cases.push(['one hit re-roll: 1 attack at 4+ hits', () => run([one([{ from:'R', oneHit:1 }])], { T:4, models:[big(10, 1)] }).groups[0].hits, 0.75, 0.015]);
cases.push(['one hit re-roll: the working, exact', () => C.explain({ groups:[one([{ from:'R', oneHit:1 }])], target:{ T:4, models:[big(10, 1)] }, ctx:{} }).groups[0].hits, 0.75, 1e-9]);
// one wound re-roll: 1 [TORRENT] hit, S4 vs T4 (4+): 0.75 wounds
cases.push(['one wound re-roll: 1 torrent hit S4 vs T4 wounds', () => run([one([{ from:'R', oneWound:1 }], { kw:['TORRENT'] })], { T:4, models:[big(10, 1)] }).groups[0].wounds, 0.75, 0.015]);
// one hit and one wound re-roll (Magna Imperator), 3 attacks at 4+: 3/2 + (1 - (1/2)^3) × 1/2 = 1.9375 hits
cases.push(['one hit and one wound re-roll: 3 attacks at 4+ hits', () => run([one([{ from:'M', oneHit:1, oneWound:1 }], { A:'3' })], { T:4, models:[big(10, 1)] }).groups[0].hits, 1.9375, 0.02]);
// one hit or one wound roll (Seething Hatred), 1 attack at 4+, S4 vs T4: a miss takes it (1/2 × 1/2 × 1/2), else the wound (1/2 × 3/4): 0.5
cases.push(['one hit or wound re-roll: 1 attack 4+/4+ wounds', () => run([one([{ from:'S', oneEither:1 }])], { T:4, models:[big(10, 1)] }).groups[0].wounds, 0.5, 0.012]);
cases.push(['one hit or wound re-roll: the working, exact', () => C.explain({ groups:[one([{ from:'S', oneEither:1 }])], target:{ T:4, models:[big(10, 1)] }, ctx:{} }).groups[0].wounds, 0.5, 1e-9]);
// never a die re-rolled already: with "re-roll failed hit rolls" the one re-roll adds nothing: 0.75
cases.push(['one hit re-roll: not on a die re-rolled already', () => run([one([{ from:'A', rrHit:'all' }, { from:'R', oneHit:1 }])], { T:4, models:[big(10, 1)] }).groups[0].hits, 0.75, 0.015]);
// [TORRENT] makes no hit roll: a hit-or-wound re-roll goes to the wound roll: 1 hit, S4 vs T4: 0.75
cases.push(['one hit or wound re-roll: [TORRENT] (no hit roll), the wound roll', () => run([one([{ from:'S', oneEither:1 }], { kw:['TORRENT'] })], { T:4, models:[big(10, 1)] }).groups[0].wounds, 0.75, 0.015]);
// one Damage re-roll: 1 torrent S8 hit (5/6 wound), D6, no save, at one W3 model: a 1 or 2 is re-rolled (below 3.5 and leaving it wounds),
// a 3 not: wounds lost 5/6 × (2/6 × E[min(D6, 3)] + 4/6 × 3) = 5/6 × (2/6 × 2.5 + 2) = 2.361
cases.push(['one Damage re-roll: D6 at a W3 model, lost', () => run([one([{ from:'AF', oneDmg:1 }], { S:8, D:'D6', kw:['TORRENT'] })], { T:4, models:[big(1, 3)] }).dmg, 5 / 6 * (2 / 6 * 2.5 + 2), 0.02]);
// ... the working (every attack as if its model had wounds enough): a roll of 1-3 re-rolled: 5/6 × (3.5 + 1/2 × (3.5 - 2)) = 3.542
cases.push(['one Damage re-roll: the working, exact', () => C.explain({ groups:[one([{ from:'AF', oneDmg:1 }], { S:8, D:'D6', kw:['TORRENT'] })], target:{ T:4, models:[big(1, 1000)] }, ctx:{} }).groups[0].dmg, 5 / 6 * 4.25, 1e-9]);
// shared by two weapons, the most valuable first (04.03): 1 attack at 4+ each, D1 listed first, D3 second, one hit re-roll for the unit:
// the D3 weapon is resolved first and has it (0.75 hits); the D1 weapon has it only when the D3 one hit first (1/2): 1/2 + 1/2 × 1/4 = 0.625
const twoW = () => run([one([{ from:'M', oneHit:1 }], { name:'light' }), one([{ from:'M', oneHit:1 }], { name:'heavy', D:'3' })], { T:4, models:[big(10, 10)] });
cases.push(['one re-roll for two weapons: the most valuable (listed second) first', () => twoW().groups[1].hits, 0.75, 0.015]);
cases.push(['one re-roll for two weapons: the other only when it is left', () => twoW().groups[0].hits, 0.625, 0.015]);
cases.push(['one re-roll for two weapons: the working agrees', () => { const x = C.explain({ groups:[one([{ from:'M', oneHit:1 }], { name:'light' }), one([{ from:'M', oneHit:1 }], { name:'heavy', D:'3' })], target:{ T:4, models:[big(10, 10)] }, ctx:{} });
  return x.groups[0].hits * 10 + x.groups[1].hits; }, 6.25 + 0.75, 1e-9]);
// once in the phase (Command Re-roll, 15.01): two beats of the shooting share it: the first 0.75, the second only when the first did not
// need it (it hit first time, 1/2): 1/2 + 1/2 × 1/4 = 0.625; one of each attack sequence (Magna Imperator) is there again: 0.75; the
// fight is another phase: 0.75
const pb = (ph, mods) => ({ side:1, ph, input:{ groups:[one(mods)], target:tenW1() } });
const PH = [{ from:'Command Re-roll', oneHit:1, phase:true }];
cases.push(['once in the phase: the second beat of the shooting', () => pl([pb('shooting', PH), pb('shooting', PH)]).beats[1].groups[0].hits, 0.625, 0.015]);
cases.push(['once in the phase: the fight has it again', () => pl([pb('shooting', PH), pb('fight', PH)]).beats[1].groups[0].hits, 0.75, 0.015]);
cases.push(['each attack sequence: the second beat has its own', () => pl([pb('shooting', [{ from:'M', oneHit:1 }]), pb('shooting', [{ from:'M', oneHit:1 }])]).beats[1].groups[0].hits, 0.75, 0.015]);
cases.push(['a re-roll of one die: which weapon used it (played)', () => twoW().groups[1].one.hit, 0.5, 0.015]);
// the rules that now count, as the screen reads them: Magna Imperator (a box: every box starts unticked), Advanced Firepower (vs MONSTER/VEHICLE:
// a box), Seething Hatred (a hit or a wound roll), Command Re-roll (a stratagem, once in the phase: never ticked for you)
const LK2 = { army:'lite-knights', atk:'trajann-valoris-allarus-custodians', typed:{}, ph:'shooting' }, CAL = { army:'lite-knights', atk:'caladius-annihilator-grav-tank', typed:{}, ph:'shooting' };
cases.push(['Magna Imperator: a box, unticked (the owner: every box starts unticked), one hit and one wound roll', () => { const r = box(cp(LK2), 'Magna Imperator'); return +(r.state === 'choice' && !r.on && r.e.oneHit === 1 && r.e.oneWound === 1); }, 1]);
cases.push(['Advanced Firepower: a box (the target’s keywords), one hit, wound and Damage roll', () => { const r = box(cp(CAL), 'Advanced Firepower'); return +(r.state === 'choice' && !r.on && r.e.oneHit && r.e.oneWound && r.e.oneDmg); }, 1]);
cases.push(['Seething Hatred: a box, unticked, one hit or wound roll', () => { const r = box({ army:'infernal-lance', atk:'knight-despoiler', typed:{}, ph:'shooting' }, 'Seething Hatred'); return +(r.state === 'choice' && !r.on && r.e.oneEither === 1); }, 1]);
cases.push(['Command Re-roll: a stratagem box, not ticked for you; ticked: one of any roll, once in the phase', () => { const r = box(cp(CAL), 'Command Re-roll'), c = dm.calc(Object.assign(cp(CAL), { on:{ [r.k]:true } }));
  return +(r.state === 'choice' && !r.on && !!r.m.strat && c.R.pool.some(e => e.kind === 'hwd' && e.phase)); }, 1]);
cases.push(['the Caladius with Advanced Firepower: the working and the dice agree', () => { const r = box(cp(CAL), 'Advanced Firepower'), c = dm.calc(Object.assign(cp(CAL), { on:{ [r.k]:true }, typed:{ n:1, T:10, W:1e6, Sv:3 } }));
  const x = C.explain(c.input), p = C.run(Object.assign({}, c.input, { sims:20000, seed:3 })); return Math.abs(x.total.dmg - p.dmg) / x.total.dmg; }, 0, 0.02]);

// Command Re-roll ticked: one die of the step's rolls (GW's Core Rules: a Hit, Wound or Damage roll among the rolls it lists, "select one
// of those dice to re-roll"), however many weapons and models: the re-rolls used, all together, at most one
cases.push(['Command Re-roll: one die for the step', () => { const r = box(cp(CAL), 'Command Re-roll'), c = dm.calc(Object.assign(cp(CAL), { on:{ [r.k]:true } })), x = C.explain(c.input);
  const used = x.groups.reduce((t, gr) => t + (gr.one ? gr.one.hit + gr.one.wound + gr.one.dmg : 0), 0); return +(used > 0 && used <= 1 + 1e-9); }, 1]);
// the box says how often, in GW's words: Code Chivalric's Quality, one for the unit each time it is selected
cases.push(['Code Chivalric: one for the unit each time it is selected (BOXES pool)', () => +Object.values(dm.D.boxes).some(o => o.n === 'Code Chivalric' && o.b.some(b => b.pool === 'selected' && b.fx.some(f => f[0] === 'oneHit'))), 1]);
// the working spends a re-roll of one die as the dice do (the review's cases): a Damage re-roll only on a roll that leaves the model
// alive (none against W1 models), so it stays for nothing else; hits, wounds, what gets through and each re-roll's use agree within
// the dice's noise (5 standard errors of 40,000 games; the re-rolls' use within 0.01)
const agree = (input, tag) => { const x = C.explain(input), r = C.run(Object.assign({}, input, { sims:40000, seed:5, moments:true })), bad = [];
  x.groups.forEach((e, i) => { const q = r.groups[i]; for(const k of ['hits', 'wounds', 'unsaved', 'mortals']) if(Math.abs(e[k] - q[k]) > 5 * q.sd[k] / 200 + 1e-6) bad.push(tag + ' ' + i + ' ' + k + ' ' + e[k].toFixed(3) + '/' + q[k].toFixed(3));
    const eo = e.one || { hit:0, wound:0, dmg:0 }; for(const k of ['hit', 'wound', 'dmg']) if(Math.abs(eo[k] - q.one[k]) > 0.01) bad.push(tag + ' ' + i + ' one.' + k + ' ' + eo[k].toFixed(3) + '/' + q.one[k].toFixed(3)); });
  for(const b of bad) console.log('  ' + b); return bad.length; };
cases.push(['the working spends a Damage re-roll as the dice do: 6 [TORRENT] D3 attacks at 10 W1 models', () => agree({ groups:[g({ n:6, S:4, D:'D3', kw:['TORRENT'], mods:[{ from:'AF', oneHit:1, oneWound:1, oneDmg:1 }] })], target:{ T:4, models:[big(10, 1)] }, ctx:{} }, 'torrent'), 0, 0]);
cases.push(['the working spends a shared re-roll as the dice do: two weapons, one re-roll of any roll, 20 W1 models', () => agree({ groups:[g({ name:'a', n:5, A:'2', D:'D3', mods:[{ from:'CR', oneAny:1, phase:true }] }), g({ name:'b', n:3, A:'D6', S:6, AP:-1, D:'D6', mods:[{ from:'CR', oneAny:1, phase:true }] })], target:{ T:4, models:[big(20, 1, 4)] }, ctx:{} }, 'shared'), 0, 0]);
// a re-roll of one die that only one weapon can use: the weapons keep the order listed (the first listed is resolved first)
cases.push(['a re-roll for one weapon only: the order listed', () => C.run({ groups:[one([], { name:'light' }), one([{ from:'M', oneHit:1 }], { name:'heavy', D:'3' })], target:{ T:4, models:[big(10, 10)] }, ctx:{}, sims:100, seed:1 }).poolOrder.join() === '0,1' ? 1 : 0, 1]);

// ---- the target's groups: a Leader attached to the bodyguard (19.02, 05.03, 19.04) and [PRECISION] (24.28) ----
// 1 S8 attack at 2+ (5/6 hit, 5/6 wound), no save, at a W1 bodyguard model and a W1 Leader: with [PRECISION] the Leader is destroyed 25/36 of
// the time; without, the attack goes to the bodyguard (the CHARACTER group last, 05.03): never
const duo = kw => C.run({ groups:[g({ skill:'2+', S:8, kw })], target:{ T:4, models:[big(1, 1, 7, { name:'Bodyguard', bodyguard:true }), big(1, 1, 7, { name:'Leader', char:true })] }, ctx:{ precision:'Leader' }, sims:20000, seed:11, track:true });
cases.push(['a 2-model target with a Leader: [PRECISION], the Leader destroyed', () => duo(['PRECISION']).fate[1], 25 / 36, 0.012]);
// "Precision" ticked with the target does not make a [TORRENT] weapon precise (24.37): the Knight Despoiler's Heavy darkflamer
cases.push(['Precision ticked: not a [TORRENT] weapon (24.37)', () => { const c = dm.calc({ army:'infernal-lance', atk:'knight-despoiler', ph:'shooting', typed:{ n:5, T:4, W:2, Sv:3, prec:true, more:[{ n:1, T:4, W:4, Sv:2, char:true }] } });
  const i = c.input.groups.findIndex(x => /darkflamer/i.test(x.name)); return +(i >= 0 && c.input.groups[i].mods.some(m => m.precision) && !c.R.groups[i].precision && c.R.groups.some((x, j) => j !== i && !x.out && x.precision)); }, 1]);
cases.push(['a 2-model target with a Leader: no [PRECISION], the Leader untouched', () => duo([]).fate[1], 0, 0]);
// the screen: a group added and ticked CHARACTER is a Leader row (char), the first the bodyguard (19.02), each with its own Feel No Pain
// (19.04 FAQ), the unit-wide one not used; the Leader's higher T does not change the wound roll while a bodyguard model is left:
// 10 Grot Blastas at 10 × T3 W1 Sv 5+ FNP 6+ with a T6 Leader: 10 × 3/6 × 3/6 × 4/6 × 5/6 = 1.39, as without it
const GB = more => ({ army:'shooty', ph:'shooting', atk:'gretchin', typed:{ n:10, T:3, W:1, Sv:5, fnp:6, more } });
cases.push(['target groups: a Leader row and the bodyguard row, each its own Feel No Pain', () => { const c = dm.calc(GB([{ n:1, T:6, W:4, Sv:2, fnp:5, char:true }])), [b, l] = c.models;
  return +(c.models.length === 2 && b.name === 'Bodyguard' && b.bodyguard && !b.char && b.fnp === 6 && l.name === 'Leader' && l.char && l.fnp === 5 && !c.tmod.fnp && c.ctx.precision === 'Leader'); }, 1]);
cases.push(['target groups: the bodyguard’s T while it lasts (19.02)', () => exact(GB([{ n:1, T:6, W:4, Sv:2, char:true }])), 10 * 3 / 6 * 3 / 6 * 4 / 6 * 5 / 6]);
// two groups, none a CHARACTER: the highest T in the unit (05.02.01): S3 vs T6 wounds on 6+: 10 × 3/6 × 1/6 × 4/6 × 5/6
cases.push(['target groups: no CHARACTER, the highest T in the unit', () => exact(GB([{ n:2, T:6, W:1, Sv:5 }])), 10 * 3 / 6 * 1 / 6 * 4 / 6 * 5 / 6]);
// "Precision" ticked with the target: every weapon [PRECISION]; the Leader (T3 W1, no save, with one W1 bodyguard model) is destroyed when
// one of the 10 Grot Blastas' shots (1/2 to hit × 1/2 to wound each) gets through: 1 - (3/4)^10 = 0.944
const GBP = prec => { const c = dm.calc(Object.assign(GB([{ n:1, T:3, W:1, Sv:0, char:true }]), { typed:{ n:1, T:3, W:1, Sv:0, prec, more:[{ n:1, T:3, W:1, Sv:0, char:true }] } }));
  return { c, r:C.run(Object.assign({}, c.input, { sims:20000, seed:11, track:true })) }; };
cases.push(['Precision ticked: every weapon has [PRECISION]', () => +GBP(true).c.R.groups.every(g => g.out || g.precision), 1]);
cases.push(['Precision ticked: the Leader destroyed', () => GBP(true).r.fate[1], 1 - Math.pow(3 / 4, 10), 0.01]);
// without it the bodyguard model first: the Leader only when two of the 10 get through: 1 - (3/4)^10 - 10 × 1/4 × (3/4)^9 = 0.756
cases.push(['Precision not ticked: the Leader after the bodyguard', () => GBP(false).r.fate[1], 1 - Math.pow(3 / 4, 10) - 10 / 4 * Math.pow(3 / 4, 9), 0.012]);
cases.push(['target groups: none added, the target as before (one row, the unit-wide Feel No Pain)', () => { const c = dm.calc(GB(undefined)); return +(c.models.length === 1 && c.models[0].name === 'Target' && c.tmod.fnp === 6 && c.ctx.precision == null); }, 1]);

for(const t of twice) console.log('  ' + t);

let fail = 0;
for(const [name, fn, want, tol0] of cases){
  const got = fn(), tol = tol0 != null ? tol0 : Math.max(0.15, Math.abs(want) * 0.03);   // a chance: its own, smaller margin
  const ok = Math.abs(got - want) <= tol;
  if(!ok) fail++;
  if(!ok || process.argv.includes('-v')) console.log((ok ? 'ok   ' : 'FAIL ') + name + ': ' + got.toFixed(3) + ' (worked out: ' + (+want).toFixed(3) + ')');
}
console.log('calc: ' + (cases.length - fail) + ' of ' + cases.length + ' hand-worked cases within margin' + (fail ? '; ' + fail + ' failures' : ''));
process.exit(fail ? 1 : 0);
