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
];
let fail = 0;
for(const [name, fn, want] of cases){
  const got = fn(), tol = Math.max(0.15, Math.abs(want) * 0.03);
  const ok = Math.abs(got - want) <= tol;
  if(!ok) fail++;
  if(!ok || process.argv.includes('-v')) console.log((ok ? 'ok   ' : 'FAIL ') + name + ': ' + got.toFixed(3) + ' (worked out: ' + (+want).toFixed(3) + ')');
}
console.log('calc: ' + (cases.length - fail) + ' of ' + cases.length + ' hand-worked cases within margin' + (fail ? '; ' + fail + ' failures' : ''));
process.exit(fail ? 1 : 0);
