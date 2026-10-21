/* calc.js: the damage calculator's engine (Warhammer 40,000 11th edition attack sequence, section 05).

   It plays the attacks out many times with seeded dice, following the sequence as written:
     the attacking unit's weapons one at a time, identical attacks gathered together (04.03) → hit rolls (05.01)
     → wound rolls (05.02) against the Toughness of the models still in the unit (05.02.01, 19.02) → save rolls,
     all rolled together and resolved from the lowest result to the highest against the current allocation group
     (05.03, 05.04) → damage to one model per attack, excess lost; Feel No Pain per wound (24.12);
     [DEVASTATING WOUNDS] mortal wounds after the normal damage, one model each (24.10).
   It knows only numbers and keywords: which rules apply is decided by the caller (the app's tick boxes). Where the
   rules leave a choice to a player, it takes the one described where it is made (and the app says so).
   verify/calc-test.js checks it against hand-worked cases; the gate runs that test.

   run(input) → result
     input.groups  [{ name, n (models with the weapon), A, skill ('4+'), S, AP, D, range ('24"' | 'Melee'), kw:[weapon keywords],
                      from:{ field or keyword: rule name(s) }   values the printed weapon already includes (never added twice),
                      mods:[{ from (rule name), hit, wound, a, s, ap, d, range (inches), rrHit, rrWound ('1s'|'all'),
                              critHit, critWound, sus ('1'), lethal, dev, ignoresCover, lance, twin, precision,
                              ignoreHitMods, set:{ A|S|AP|D|BS: '10' or '+6' } }] }]   one entry per weapon
                    (mod: one more entry of mods, for a rule with no name)
     input.target  { T, kw:[keywords], models:[{ name, count, W, T, Sv, InSv, fnp, fnpMortal, char, bodyguard }],
                     mod:{ dMinus, apWorse, hitMinus, woundMinus, fnp, fnpMortal, insv } }
     input.ctx     { ranged, cover, halfRange, dist (inches to the target, or null), charged, heavy, indirect ('1-5'|'1-3'),
                     snap, cq (close-quarters shooting at a unit the attacker is engaged with), big (the attacker is
                     a MONSTER/VEHICLE), engaged (the target is engaged: 17.03), plunging, precision (the CHARACTER
                     model's name the [PRECISION] attacks are allocated to) }
     input.sims (default 10000), input.seed (default 1)
   result: { sims, dmg (mean wounds lost), killed (mean models destroyed), models, wipe (P all destroyed),
             dist [P(exactly k destroyed)], groups:[{ attacks, hits, wounds, unsaved, mortals, dmg, out, notes }] (means),
             alloc:[allocation groups], order:[the order used], orders (how many orders were compared) }
   resolve(input) → the same groups' out, notes and the rules applied or skipped, without playing any dice. */
(function(root){
'use strict';

// rules constants the attack sequence uses (Core Rules 11th edition; see the comments where they are used)
// The Core Rules state no limit on hit or wound roll modifiers (unlike 10th edition's +1/-1); they do limit
// characteristics after modifiers ("When Modifying Characteristics"): A, S and D not less than 1, BS/WS between
// 2+ and 6+, AP not worse than 0, Sv and InSv not 1+ or better. An unmodified 1 always fails a hit or wound roll
// and an unmodified 6 is critical (05.01, 05.02).
const RULE = {
  critHit: 6,       // an unmodified 6 is a critical hit
  critWound: 6,     // an unmodified 6 is a critical wound
  minA: 1,          // A cannot be less than 1
  minS: 1,          // S cannot be less than 1; a weapon with no S has S 1 (02.04.01)
  minDamage: 1,     // D cannot be less than 1
  bestSkill: 2,     // BS/WS cannot be 1+ or better
  worstSkill: 6,    // ... or 7+ or worse
  bestSave: 2,      // Sv and InSv cannot be 1+ or better
  snapHit: 6,       // snap shooting: hits only on an unmodified 6, not critical (15.09)
  pilot: 2000       // games per allocation order when the defender's order is compared
};

// dice expressions: "3", "D3", "D6+1", "2D6", "D6-1"
function dice(s){
  const t = String(s == null ? '' : s).trim().toUpperCase().replace(/\s+/g, '');
  const m = /^(\d*)D(\d+)(?:([+-])(\d+))?$/.exec(t);
  if(m) return { n:+(m[1] || 1), f:+m[2], k:(m[3] === '-' ? -1 : 1) * +(m[4] || 0) };
  const v = parseInt(t, 10);
  return { n:0, f:0, k:isNaN(v) ? 0 : v };
}
const diceMean = d => d.k + d.n * (d.f + 1) / 2;
// a seeded generator (mulberry32), so the same inputs always give the same numbers
function rng(seed){
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const d6 = R => 1 + Math.floor(R() * 6);
// D3 is one D6 halved, rounding up: 1, 2 or 3 alike
const roll = (d, R) => { let t = d.k; for(let i = 0; i < d.n; i++) t += d.f === 3 ? Math.ceil(d6(R) / 2) : 1 + Math.floor(R() * d.f); return t; };
const skillOf = s => parseInt(String(s).replace(/[^\d]/g, ''), 10) || 7;   // "4+" → 4; "–" or "N/A": no skill (7, can't hit)
const num = s => { const v = parseInt(String(s == null ? '' : s).replace(/[−–]/g, '-').replace(/[^\d-]/g, ''), 10); return isNaN(v) ? null : v; };
const up = x => String(x).toUpperCase().trim();

// one weapon keyword → { k, v } ("RAPID FIRE 2", "SUSTAINED HITS D3", "ANTI-MONSTER/VEHICLE 4+", "MELTA 2"); null when the
// datasheet limits it to targets this one is not ("LETHAL HITS: non-MONSTER/VEHICLE", "DEVASTATING WOUNDS: INFANTRY", 24.01)
const FLAG = { 'LETHAL HITS':'lethal', 'DEVASTATING WOUNDS':'dev', 'TWIN-LINKED':'twin', TORRENT:'torrent', LANCE:'lance', 'IGNORES COVER':'ignoresCover',
  PRECISION:'precision', PSYCHIC:'psychic', HEAVY:'heavy', 'INDIRECT FIRE':'indirect', 'CLOSE-QUARTERS':'cq', PISTOL:'cq' };   // [PISTOL] is [CLOSE-QUARTERS] (24.27)
function kwOne(x0, tkw){
  let x = up(x0), m;
  if((m = /^(.+?):\s*(NON-)?(.+)$/.exec(x))){
    const names = m[3].split('/').map(t => t.trim()), has = names.some(t => tkw && tkw.has(t));
    if(!tkw || (m[2] ? has : !has)) return null;
    x = m[1].trim();
  }
  if((m = /^RAPID FIRE (\S+)$/.exec(x))) return { k:'rapid', v:dice(m[1]) };
  if((m = /^MELTA (\S+)$/.exec(x))) return { k:'melta', v:dice(m[1]) };
  if((m = /^SUSTAINED HITS (\S+)$/.exec(x))) return { k:'sus', v:dice(m[1]) };
  // [ANTI-X Y+]; ANTI-NON-X triggers against a unit that does not have X (24.01 FAQ)
  if((m = /^ANTI-(NON-)?(.+?) (\d)\+$/.exec(x))) return { k:'anti', v:{ non:!!m[1], kw:m[2].split('/').map(t => t.trim()), v:+m[3] } };
  // [BLAST] / [BLAST X] and [CLEAVE X]: X more attack dice per five models in the target unit (24.05, 24.06)
  if((m = /^BLAST(?: (\d+))?$/.exec(x))) return { k:'blast', v:+(m[1] || 1) };
  if((m = /^CLEAVE (\d+)$/.exec(x))) return { k:'cleave', v:+m[1] };
  return FLAG[x] ? { k:FLAG[x], v:true } : { k:'', v:null };   // other abilities change no numbers here
}
const antiHits = (a, tkw) => a.non ? !a.kw.some(x => tkw.has(x)) : a.kw.some(x => tkw.has(x));
// a weapon's keywords → numbers. The same ability twice is not cumulative (24.02): the attacker selects one instance,
// here the better one (the most dice; the [ANTI] that triggers on the lowest roll against this target)
function keywords(kw, tkw){
  const k = { anti:[], dup:[] }, by = {};
  for(const x of kw || []){ const p = kwOne(typeof x === 'string' ? x : x.t, tkw); if(p && p.k) (by[p.k] = by[p.k] || []).push({ x, p }); }
  for(const [key, list] of Object.entries(by)){
    if(key === 'anti'){ k.anti = list.map(i => i.p.v); continue; }
    if(list[0].p.v === true){ k[key] = true; continue; }
    const val = i => typeof i.p.v === 'number' ? i.p.v : diceMean(i.p.v);
    const best = list.reduce((b, i) => val(i) > val(b) ? i : b, list[0]);
    k[key] = best.p.v;
    const label = i => typeof i.x === 'string' ? up(i.x) : up(i.x.t);
    const others = list.filter(i => label(i) !== label(best));
    if(others.length) k.dup.push({ key, used:best.x, not:others.map(i => i.x) });
  }
  if(tkw && by.anti){
    const ok = by.anti.filter(i => antiHits(i.p.v, tkw));
    if(ok.length){
      const best = ok.reduce((b, i) => i.p.v.v < b.p.v.v ? i : b, ok[0]);
      k.antiV = best.p.v.v;
      const others = by.anti.filter(i => i !== best && up(typeof i.x === 'string' ? i.x : i.x.t) !== up(typeof best.x === 'string' ? best.x : best.x.t));
      if(others.length) k.dup.push({ key:'anti', used:best.x, not:others.map(i => i.x) });
    }
  }
  return k;
}
// the wound roll needed (05.02): S twice T or more 2+, greater 3+, equal 4+, less 5+, half or less 6+
const woundNeed = (S, T) => S >= 2 * T ? 2 : S > T ? 3 : S === T ? 4 : 2 * S <= T ? 6 : 5;

// a rule's keyword (on a mod) as the keyword it gives
const MOD_KW = { sus:v => 'SUSTAINED HITS ' + up(v), lethal:() => 'LETHAL HITS', dev:() => 'DEVASTATING WOUNDS', ignoresCover:() => 'IGNORES COVER',
  twin:() => 'TWIN-LINKED', lance:() => 'LANCE', precision:() => 'PRECISION' };
const NUM = { a:'A', s:'S', ap:'AP', d:'D' };

// one weapon with the rules that apply to it → the numbers of its attacks against this target.
// X: { ctx, tm, tkw (the target's keywords now), total (models in the target at Select Targets), bigTarget }
function prep(g, X){
  const ctx = X.ctx, tm = X.tm, ranged = !!ctx.ranged;
  const mods = [].concat(g.mods || [], g.mod ? [g.mod] : []).filter(Boolean);
  const from = g.from || {}, skillKey = ranged ? 'BS' : 'WS';
  // a value the printed weapon already includes from a rule (New Recruit adds some): that rule never adds it again
  const credited = (field, rule) => !!rule && [].concat(from[field] || []).some(r => up(r) === up(rule));
  const applied = [], skipped = [];
  const inst = (g.kw || []).map(t => ({ t:up(t), src:'' }));
  for(const m of mods){
    for(const [key, f] of Object.entries(MOD_KW)) if(m[key]){
      const t = f(m[key]);
      if(credited(t, m.from)){ skipped.push({ from:m.from, key:t }); continue; }
      inst.push({ t, src:m.from || '' }); applied.push({ from:m.from || '', key:t });
    }
  }
  const k = keywords(inst, X.tkw);
  const sum = (key, field) => { let t = 0; for(const m of mods){ if(!m[key]) continue;
    if(credited(field, m.from)){ skipped.push({ from:m.from, key:field }); continue; }
    t += +m[key]; applied.push({ from:m.from || '', key:field }); } return t; };
  const sumBy = (key, f) => mods.reduce((t, m) => t + (m[key] && f(+m[key]) ? +m[key] : 0), 0);
  const best = key => mods.reduce((v, m) => v === 'all' || m[key] === 'all' ? 'all' : m[key] || v, '');
  const low = (key, d) => mods.reduce((v, m) => m[key] ? Math.min(v, +m[key]) : v, d);
  // a value a rule sets for this weapon ("10"), or adds to it ("+6")
  const setOf = f => { let base = null, plus = 0; for(const m of mods){ const v = m.set && m.set[f]; if(v == null) continue;
    if(/^[+-]/.test(String(v))) plus += num(v) || 0; else base = String(v); applied.push({ from:m.from || '', key:f }); } return { base, plus }; };
  const sA = setOf('A'), sS = setOf('S'), sAP = setOf('AP'), sD = setOf('D'), sBS = setOf(skillKey);
  const aPlus = sum('a', 'A') + sA.plus, sPlus = sum('s', 'S') + sS.plus, apImp = sum('ap', 'AP') - sAP.plus, dPlus = sum('d', 'D') + sD.plus;
  const notes = k.dup.map(d => ({ dup:d.key, used:d.used, not:d.not }));

  // range and half range: from the distance when one is given, else the "within half range" box
  const r0 = num(g.range), rangeIn = r0 == null || /melee/i.test(g.range || '') ? null : r0 + mods.reduce((t, m) => t + (+m.range || 0), 0);
  let half = !!ctx.halfRange, out = '';
  if(ranged && ctx.dist != null && rangeIn != null){ if(ctx.dist > rangeIn) out = 'out of range (' + rangeIn + '")'; half = ctx.dist <= rangeIn / 2; }
  if(ranged){
    if(ctx.snap && ctx.dist != null && ctx.dist > 24) out = out || 'snap shooting: targets within 24" only (15.09)';
    if(ctx.cq && !ctx.big && !k.cq) out = out || 'close-quarters shooting: [CLOSE-QUARTERS] weapons only (10.06)';
    if(ctx.cq && ctx.big && k.blast) out = out || '[BLAST] cannot target a unit its unit is engaged with (10.06)';
    if(ctx.engaged && X.bigTarget && k.blast) out = out || '[BLAST] cannot target an engaged MONSTER/VEHICLE (17.03)';
  }
  const indirect = ranged && !!ctx.indirect && !!k.indirect;   // indirect shooting changes only [INDIRECT FIRE] weapons' attacks (10.07)
  const ignore = !!k.psychic || mods.some(m => m.ignoreHitMods);   // [PSYCHIC] (24.29): it ignores the modifiers that make it worse

  // the hit roll: modifiers (no limit in the Core Rules), BS/WS after its own modifiers (2+ to 6+)
  let pos = sumBy('hit', v => v > 0), neg = sumBy('hit', v => v < 0) - (tm.hitMinus || 0);
  if(ranged && ctx.heavy && k.heavy) pos += 1;                                 // [HEAVY] (24.16)
  if(ranged && ctx.cq && ctx.big && !k.cq) neg -= 1;                           // MONSTER/VEHICLE in close-quarters shooting (10.06)
  if(ranged && ctx.engaged && X.bigTarget && !(k.cq && ctx.cq)) neg -= 1;      // an engaged MONSTER/VEHICLE target (17.03)
  const skill0 = sBS.base != null ? skillOf(sBS.base) : skillOf(g.skill);
  let worse = ranged && (ctx.cover || indirect) && !k.ignoresCover ? 1 : 0;    // the benefit of cover: BS worse by 1 (13.08)
  const better = ranged && ctx.plunging ? 1 : 0;                                // Plunging Fire: BS better by 1 (22.05)
  if(ignore) worse = 0;
  const bs = skill0 >= 7 ? 7 : Math.max(RULE.bestSkill, Math.min(RULE.worstSkill, skill0 + worse - better - sBS.plus));
  let rrHit = best('rrHit'), rrWound = k.twin ? 'all' : best('rrWound');
  if(indirect || (ranged && ctx.snap)) rrHit = '';                             // you cannot re-roll hit rolls (10.07, 15.09)

  const s0 = sS.base != null ? num(sS.base) : num(g.S);
  const ap0 = sAP.base != null ? num(sAP.base) : num(g.AP);
  const D = dice(sD.base != null ? sD.base : g.D);
  const G = {
    name:g.name, n:Math.max(0, +g.n || (g.n === 0 ? 0 : 1)), out, notes, applied, skipped, k,
    A:dice(sA.base != null ? sA.base : g.A), aPlus,
    rapid:k.rapid && half ? k.rapid : null, melta:k.melta && half ? k.melta : null,
    // [BLAST]/[CLEAVE]: the models that were in the target unit at Select Targets, before any of these attacks
    extra:((k.blast || 0) + (k.cleave || 0)) * Math.floor(X.total / 5),
    torrent:!!k.torrent, snap:ranged && !!ctx.snap, fail:indirect ? (ctx.indirect === '1-3' ? 4 : 6) : 0,
    bs, hitMod:pos + (ignore ? 0 : neg), critHit:Math.min(RULE.critHit, low('critHit', RULE.critHit)), rrHit,
    S:s0 == null ? RULE.minS : Math.max(RULE.minS, s0 + sPlus),   // no S: S 1 for this (02.04.01), and '-' is never modified
    woundMod:sumBy('wound', () => true) + (k.lance && ctx.charged ? 1 : 0) - (tm.woundMinus || 0),   // [LANCE] (24.21)
    critWound:Math.min(low('critWound', RULE.critWound), k.antiV || 7), rrWound,
    AP:Math.min(0, (ap0 || 0) - apImp + (tm.apWorse || 0)),   // improvements and worsenings added up, then not worse than 0
    D, dPlus, sus:k.sus || null, lethal:!!k.lethal, dev:!!k.dev, precision:!!k.precision, psychic:ignore
  };
  G.Dmean = diceMean(D); G.meltaMean = G.melta ? diceMean(G.melta) : 0;
  return G;
}
// attacks that resolve alike are gathered together (identical attacks, 04.03)
const sigOf = (G, prec) => JSON.stringify([G.bs, G.hitMod, G.critHit, G.rrHit, G.torrent, G.snap, G.fail, G.S, G.woundMod, G.critWound, G.rrWound,
  G.AP, G.D, G.dPlus, G.melta, G.sus, G.lethal, G.dev, prec && G.precision]);

// the attacker's choices the rules leave open (re-rolls, [LETHAL HITS]): the one worth more on average against the
// model the attacks meet first. A failed roll is always re-rolled when a rule allows it; a successful one only to look
// for a critical result that is worth more ([SUSTAINED HITS], [LETHAL HITS], [DEVASTATING WOUNDS]); [LETHAL HITS] is
// taken unless rolling to wound is worth more (a critical wound with [DEVASTATING WOUNDS])
function plan(G, T, M, tm){
  const row = M.row, need = woundNeed(G.S, T);
  let pc = 0, pn = 0;
  for(let u = 2; u <= 6; u++){ if(u >= G.critWound) pc++; else if(u + G.woundMod >= need) pn++; }
  pc /= 6; pn /= 6;
  const insv = Math.max(RULE.bestSave, Math.min(row.InSv || 7, tm.insv || 7)), sv = Math.max(RULE.bestSave, row.Sv || 7);
  let sf = 0;
  for(let u = 1; u <= 6; u++) if(!(u !== 1 && ((insv <= 6 && u >= insv) || u + G.AP >= sv))) sf++;
  sf /= 6;
  const fnp = Math.min(row.fnp || 7, tm.fnp || 7), fnpM = Math.min(fnp, row.fnpMortal || 7, tm.fnpMortal || 7);
  const keep = x => x <= 6 ? (x - 1) / 6 : 1;
  const Dn = Math.max(RULE.minDamage, G.Dmean + G.dPlus + G.meltaMean - (tm.dMinus || 0)), Dm = Math.max(RULE.minDamage, G.Dmean + G.dPlus + G.meltaMean);
  const Vn = sf * Math.min(Dn, M.w) * keep(fnp), Vc = G.dev ? Math.min(Dm, M.w) * keep(fnpM) : Vn;
  const fresh = pc * Vc + pn * Vn;
  const fishW = G.rrWound === 'all' && fresh > Vn + 1e-9;
  const reFail = G.rrWound === 'all' ? 1 - pc - pn : G.rrWound === '1s' ? 1 / 6 : 0;
  const E = pc * Vc + pn * (fishW ? fresh : Vn) + reFail * fresh;
  const lethal = G.lethal && Vn >= E - 1e-9;
  let hc = 0, hn = 0;
  if(!G.torrent && !G.snap) for(let u = 2; u <= 6; u++){ if(u < G.fail) continue; if(u >= G.critHit) hc++; else if(u + G.hitMod >= G.bs) hn++; }
  hc /= 6; hn /= 6;
  const Vch = (G.lethal ? Math.max(Vn, E) : E) + (G.sus ? diceMean(G.sus) * E : 0);
  const fishH = G.rrHit === 'all' && hc * Vch + hn * E > E + 1e-9;
  return { need, lethal, fishW, fishH };
}

// the target: allocation groups (05.03): one for each CHARACTER model, one for all other models with the same W, Sv
// and InSv; CHARACTER groups last
function allocGroups(tg){
  const rows = tg.models.map(r => Object.assign({}, r, { InSv:r.InSv || 7, Sv:r.Sv || 7, T:r.T != null ? +r.T : null }));
  const groups = [];
  rows.forEach((r, ri) => {
    if(r.char){ for(let i = 0; i < r.count; i++) groups.push({ char:true, name:r.name, rows:[ri], n:1 }); return; }
    const key = [r.W, r.Sv, r.InSv].join('|');
    let G = groups.find(x => !x.char && x.key === key);
    if(!G) groups.push(G = { char:false, key, name:r.name, rows:[], n:0 });
    G.rows.push(ri); G.n += r.count;
  });
  return { rows, groups };
}
// every order the defender can declare (05.03): non-CHARACTER groups in any order, then CHARACTER groups in any order
function perms(a){ if(a.length < 2) return [a.slice()]; const out = []; a.forEach((x, i) => { for(const p of perms(a.slice(0, i).concat(a.slice(i + 1)))) out.push([x].concat(p)); }); return out; }
function ordersOf(groups){
  const nc = groups.map((g, i) => i).filter(i => !groups[i].char), ch = groups.map((g, i) => i).filter(i => groups[i].char);
  // character groups of the same model are alike: only their order among different models matters
  const chUniq = ch.filter((i, j) => ch.findIndex(x => groups[x].name === groups[i].name) === j);
  const P = perms(nc), Q = chUniq.length > 1 && chUniq.length < 5 ? perms(chUniq) : [chUniq];
  const expand = q => q.flatMap(i => ch.filter(x => groups[x].name === groups[i].name));
  if(P.length * Q.length > 24) return Object.assign([nc.concat(ch)], { capped:true });   // too many to compare: the order given
  return P.flatMap(p => Q.map(q => p.concat(expand(q))));
}

function setup(input){
  const ctx = input.ctx || {}, tg = input.target, tm = tg.mod || {};
  const tkw = new Set((tg.kw || []).map(up));
  const { rows, groups } = allocGroups(tg);
  const total = rows.reduce((t, r) => t + r.count, 0);
  const bigTarget = tkw.has('MONSTER') || tkw.has('VEHICLE');
  const X = { ctx, tm, tkw, total, bigTarget };
  const G = input.groups.map(g => prep(g, X));
  // [PRECISION] (24.28): the CHARACTER the attacks are allocated to, when the caller picked one
  const precOn = ctx.precision != null && groups.some(x => x.char && x.name === ctx.precision);
  // batches: identical attacks gathered together, in the order the weapons are listed
  const batches = [];
  G.forEach((x, i) => { if(x.out || !x.n) return; const s = sigOf(x, precOn); const b = batches.find(y => y.sig === s); if(b) b.members.push(i); else batches.push({ sig:s, members:[i] }); });
  // without the CHARACTER models (once destroyed, their keywords no longer count: 19.03 FAQ)
  const noChar = new Set([...tkw].filter(x => x !== 'CHARACTER'));
  const G2 = tkw.has('CHARACTER') ? input.groups.map(g => prep(g, Object.assign({}, X, { tkw:noChar }))) : G;
  return { ctx, tm, tkw, rows, groups, total, G, G2, batches, precOn };
}

// play the attacks out sims times with one allocation order
function simulate(S, order, sims, seed){
  const R = rng(seed), { rows, groups, total, G, G2, batches, tm, ctx, precOn } = S;
  const attached = rows.some(r => r.bodyguard);
  const sum = G.map(() => ({ attacks:0, hits:0, wounds:0, unsaved:0, mortals:0, dmg:0 }));
  const dist = new Array(total + 1).fill(0);
  let dmgTotal = 0, killedTotal = 0;
  // the models: wounds left, row, allocation group
  const models = [], byGroup = groups.map(() => []);
  groups.forEach((grp, gi) => { for(const ri of grp.rows){ const n = grp.char ? 1 : rows[ri].count; for(let i = 0; i < n; i++){ const M = { row:rows[ri], gi, w:0 }; models.push(M); byGroup[gi].push(M); } } });
  const ncOrder = order.filter(gi => !groups[gi].char), chOrder = order.filter(gi => groups[gi].char);
  // dice kept between games (no garbage): attack dice, hits, automatic wounds, [DEVASTATING WOUNDS], save rolls by result
  const buf = () => ({ a:new Int32Array(64), n:0 });
  const put = (b, v) => { if(b.n === b.a.length){ const x = new Int32Array(b.a.length * 2); x.set(b.a); b.a = x; } b.a[b.n++] = v; };
  const atk = buf(), hits = buf(), auto = buf(), dev = buf(), saveBy = [buf(), buf(), buf(), buf(), buf(), buf()];
  for(let s = 0; s < sims; s++){
    for(const M of models) M.w = M.row.W;
    let dead = 0, lost = 0;
    // a model in a group: one that has lost wounds first (05.04)
    const pickIn = gi => { let first = null; for(const M of byGroup[gi]){ if(M.w <= 0) continue; if(M.w < M.row.W) return M; if(!first) first = M; } return first; };
    // the current allocation group: a non-CHARACTER group with a wounded model first, then the declared order;
    // CHARACTER groups last, wounded ones first (05.03); mortal wounds select models the same way (06.02)
    const current = () => {
      for(const list of [ncOrder, chOrder]){
        let first = null;
        for(const gi of list){ const M = pickIn(gi); if(!M) continue; if(M.w < M.row.W) return M; if(!first) first = M; }
        if(first) return first;
      }
      return null;
    };
    // damage to one model: Feel No Pain for each wound (24.12), excess lost
    const hurt = (M, dmg, mortal) => {
      let fnp = Math.min(M.row.fnp || 7, tm.fnp || 7);
      if(mortal) fnp = Math.min(fnp, M.row.fnpMortal || 7, tm.fnpMortal || 7);
      let w = 0;
      for(let i = 0; i < dmg; i++) if(!(fnp <= 6 && d6(R) >= fnp)) w++;
      const took = Math.min(w, M.w);
      M.w -= took; lost += took;
      if(M.w <= 0) dead++;
      return took;
    };
    for(const b of batches){
      if(dead >= total) break;
      // Toughness: the highest among the bodyguard models still alive, else among the models still alive (05.02.01, 19.02)
      let T = 0, charAlive = false, bgAlive = false;
      for(const M of models) if(M.w > 0){ if(M.row.char) charAlive = true; if(M.row.bodyguard) bgAlive = true; }
      for(const M of models) if(M.w > 0 && (!attached || !bgAlive || M.row.bodyguard)) T = Math.max(T, M.row.T || +S.Tdefault || 1);
      const P = charAlive ? G : G2, g = P[b.members[0]];
      // [PRECISION]: the picked CHARACTER's group is the current one until these attacks end or it is destroyed (24.28)
      const precG = precOn && g.precision ? () => { for(const gi of chOrder) if(groups[gi].name === ctx.precision){ const M = pickIn(gi); if(M) return M; } return null; } : null;
      const now = () => (precG && precG()) || current();
      const pl = plan(g, T, now(), tm);
      // gather the attack dice: A per weapon (at least 1), + [RAPID FIRE] at half range, + [BLAST]/[CLEAVE]
      atk.n = 0;
      for(const mi of b.members){ const x = P[mi]; for(let i = 0; i < x.n; i++){ const a = Math.max(RULE.minA, roll(x.A, R) + x.aPlus) + (x.rapid ? roll(x.rapid, R) : 0) + x.extra; for(let j = 0; j < a; j++) put(atk, mi); sum[mi].attacks += a; } }
      // hit rolls (05.01)
      const hr = u => g.snap ? (u === RULE.snapHit ? 1 : 0) : (u === 1 || u < g.fail) ? 0 : u >= g.critHit ? 2 : u + g.hitMod >= g.bs ? 1 : 0;
      hits.n = 0; auto.n = 0;
      for(let i = 0; i < atk.n; i++){
        const mi = atk.a[i];
        if(g.torrent){ put(hits, mi); continue; }   // automatically hits: no hit roll, never a critical hit (01.05.01)
        let u = d6(R), r = hr(u);
        if((r === 0 && (g.rrHit === 'all' || (g.rrHit === '1s' && u === 1))) || (r === 1 && pl.fishH)){ u = d6(R); r = hr(u); }
        if(!r) continue;
        if(r === 2 && pl.lethal) put(auto, mi); else put(hits, mi);
        if(r === 2 && g.sus){ const x = roll(g.sus, R); for(let j = 0; j < x; j++) put(hits, mi); }
      }
      for(let i = 0; i < hits.n; i++) sum[hits.a[i]].hits++;
      for(let i = 0; i < auto.n; i++) sum[auto.a[i]].hits++;
      // wound rolls (05.02); save rolls (05.03): one for each wound, all rolled together, kept by result to be
      // resolved from the lowest (05.04)
      const wr = u => u === 1 ? 0 : u >= g.critWound ? 2 : u + g.woundMod >= pl.need ? 1 : 0;
      dev.n = 0;
      for(const sb of saveBy) sb.n = 0;
      for(let i = 0; i < auto.n; i++){ sum[auto.a[i]].wounds++; put(saveBy[d6(R) - 1], auto.a[i]); }
      for(let i = 0; i < hits.n; i++){
        const mi = hits.a[i];
        let u = d6(R), r = wr(u);
        if((r === 0 && (g.rrWound === 'all' || (g.rrWound === '1s' && u === 1))) || (r === 1 && pl.fishW)){ u = d6(R); r = wr(u); }
        if(!r) continue;
        sum[mi].wounds++;
        if(r === 2 && g.dev) put(dev, mi); else put(saveBy[d6(R) - 1], mi);
      }
      for(let r = 1, done = false; r <= 6 && !done; r++){
        const sb = saveBy[r - 1];
        for(let i = 0; i < sb.n; i++){
          const mi = sb.a[i], M = now();
          if(!M){ done = true; break; }    // every model destroyed: excess attacks are lost
          const insv = Math.max(RULE.bestSave, Math.min(M.row.InSv || 7, tm.insv || 7)), sv = Math.max(RULE.bestSave, M.row.Sv || 7);
          if(r !== 1 && ((insv <= 6 && r >= insv) || r + g.AP >= sv)) continue;
          sum[mi].unsaved++;
          const dmg = Math.max(RULE.minDamage, roll(g.D, R) + g.dPlus + (g.melta ? roll(g.melta, R) : 0) - (tm.dMinus || 0));   // D cannot be less than 1
          sum[mi].dmg += hurt(M, dmg, false);
        }
      }
      // [DEVASTATING WOUNDS]: mortal wounds equal to D, after the normal damage, at most one model each (24.10, 24.28.01)
      for(let i = 0; i < dev.n; i++){
        const mi = dev.a[i], M = now();
        if(!M) break;
        sum[mi].mortals++;
        sum[mi].dmg += hurt(M, Math.max(RULE.minDamage, roll(g.D, R) + g.dPlus + (g.melta ? roll(g.melta, R) : 0)), true);
      }
    }
    dmgTotal += lost; killedTotal += dead; dist[dead]++;
  }
  return { sum, dist, dmgTotal, killedTotal };
}

function run(input){
  const sims = input.sims || 10000, seed = input.seed || 1;
  const S = setup(input);
  S.Tdefault = parseInt(input.target.T, 10) || 1;
  // the defender declares the allocation order (05.03): the order that loses the fewest models, then the fewest wounds
  const orders = ordersOf(S.groups);
  let order = orders[0];
  if(orders.length > 1 && S.batches.length){
    let bestScore = null;
    for(const o of orders){
      const t = simulate(S, o, Math.min(sims, RULE.pilot), seed), score = [t.killedTotal, t.dmgTotal];
      if(!bestScore || score[0] < bestScore[0] || (score[0] === bestScore[0] && score[1] < bestScore[1])){ bestScore = score; order = o; }
    }
  }
  const t = simulate(S, order, sims, seed), mean = x => x / sims;
  return { sims, models:S.total, dmg:mean(t.dmgTotal), killed:mean(t.killedTotal), wipe:mean(t.dist[S.total]), dist:t.dist.map(mean),
    groups:t.sum.map((x, i) => ({ attacks:mean(x.attacks), hits:mean(x.hits), wounds:mean(x.wounds), unsaved:mean(x.unsaved), mortals:mean(x.mortals), dmg:mean(x.dmg),
      out:S.G[i].out, notes:S.G[i].notes })),
    alloc:S.groups.map(x => ({ name:x.name, n:x.n, char:x.char })), order:order.map(i => S.groups[i].name), orders:orders.length, capped:!!orders.capped };
}
// what applies to each weapon, without playing the dice (for the app's notes)
function resolve(input){
  const S = setup(input);
  return { groups:S.G.map(x => ({ out:x.out, notes:x.notes, applied:x.applied, skipped:x.skipped, bs:x.bs, hitMod:x.hitMod, woundMod:x.woundMod, S:x.S, AP:x.AP, rrHit:x.rrHit, rrWound:x.rrWound, psychic:x.psychic, psychicKw:!!x.k.psychic, dev:x.dev, lethal:x.lethal, precision:x.precision })),
    alloc:S.groups.map(x => ({ name:x.name, n:x.n, char:x.char })), orders:ordersOf(S.groups).length, batches:S.batches.map(b => b.members) };
}

const API = { run, resolve, dice, diceMean, keywords, woundNeed, RULE };
root.WH_CALC = API;
if(typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
