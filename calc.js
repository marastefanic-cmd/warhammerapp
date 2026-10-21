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
                              ignoreHitMods, set:{ A|S|AP|D|BS: '10' or '+6' }, strat (a stratagem's id) }] }]   one entry per weapon
                    (every weapon is taken to be in range)
                    (mod: one more entry of mods, for a rule with no name)
     input.target  { T, kw:[keywords], models:[{ name, count, W, T, Sv, InSv, fnp, fnpMortal, char, bodyguard }],
                     mod:{ dMinus, apWorse, hitMinus, woundMinus, fnp, fnpMortal, insv, src:{ the same keys: rule names },
                          woundMinusSgt (-1 to wound when the attack's S is greater than the T it meets), dMinusChar (the part of
                          dMinus that changes the D characteristic, so [DEVASTATING WOUNDS] mortal wounds too) } }
     input.ctx     { ranged, cover, coverSrc, halfRange (every weapon) or halfWithin (inches: the weapons whose half range
                     reaches it), charged, heavy, indirect ('1-5'|'1-3'),
                     snap, cq (close-quarters shooting at a unit the attacker is engaged with), big (the attacker is
                     a MONSTER/VEHICLE), engaged (the target is engaged: 17.03), plunging, precision (the CHARACTER
                     model's name the [PRECISION] attacks are allocated to) }
     input.sims (default 10000), input.seed (default 1)
   result: { sims, dmg (mean wounds lost), killed (mean models destroyed), models, wipe (P all destroyed),
             dist [P(exactly k destroyed)], groups:[{ attacks, hits, wounds, unsaved, mortals, dmg, gone (P destroyed before
             its attacks), out, notes }] (means), alloc:[allocation groups], order:[the order used], orders (how many compared) }
     input.track: also result.left [{ n:[models left in each row of input.target.models], p }] (most likely first) and
             result.fate [the chance each row has no model left: a CHARACTER's own fate], from the same games (the dice are
             the same with or without it)
   play(input) → several beats one after another in the same games (shoot, fight, what is left fights back: see there).
   resolve(input) → the same groups' out, notes and the rules applied or skipped, without playing any dice.
   explain(input, order) → the working: each weapon's exact averages before allocation, step by step (see there).
   As a Web Worker (new Worker('calc.js')): { id, input } → { id, r:run(input) }; { id, play } → { id, r:play(play) }. */
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
// a dice expression as players write it: "2", "D3", "2D6", "D6+1"
const diceText = d => !d.n ? String(d.k) : (d.n > 1 ? d.n : '') + 'D' + d.f + (d.k ? (d.k > 0 ? '+' : '') + d.k : '');
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
  PRECISION:'precision', PSYCHIC:'psychic', HEAVY:'heavy', 'INDIRECT FIRE':'indirect', 'CLOSE-QUARTERS':'cq', PISTOL:'cq', HAZARDOUS:'hazardous', 'SUPA-HAZARDOUS':'supaHaz' };   // [PISTOL] is [CLOSE-QUARTERS] (24.27)
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
// here the better one (the most dice; the [ANTI] that triggers on the lowest roll against this target).
// k.src[key]: where the instance used comes from ('' the weapon's own, else the rule's name); k.text[key]: its keyword
function keywords(kw, tkw){
  const k = { anti:[], dup:[], src:{}, text:{} }, by = {};
  const label = i => typeof i.x === 'string' ? up(i.x) : up(i.x.t), srcOf = i => typeof i.x === 'string' ? '' : i.x.src || '';
  for(const x of kw || []){ const p = kwOne(typeof x === 'string' ? x : x.t, tkw); if(p && p.k) (by[p.k] = by[p.k] || []).push({ x, p }); }
  for(const [key, list] of Object.entries(by)){
    if(key === 'anti'){ k.anti = list.map(i => i.p.v); continue; }
    if(list[0].p.v === true){ const own = list.find(i => !srcOf(i)) || list[0]; k[key] = true; k.src[key] = srcOf(own); k.text[key] = label(own); continue; }
    const val = i => typeof i.p.v === 'number' ? i.p.v : diceMean(i.p.v);
    const best = list.reduce((b, i) => val(i) > val(b) ? i : b, list[0]);
    k[key] = best.p.v; k.src[key] = srcOf(best); k.text[key] = label(best);
    const others = list.filter(i => label(i) !== label(best));
    if(others.length) k.dup.push({ key, used:best.x, not:others.map(i => i.x) });
  }
  if(tkw && by.anti){
    const ok = by.anti.filter(i => antiHits(i.p.v, tkw));
    if(ok.length){
      const best = ok.reduce((b, i) => i.p.v.v < b.p.v.v ? i : b, ok[0]);
      k.antiV = best.p.v.v; k.src.anti = srcOf(best); k.text.anti = label(best);
      const others = ok.filter(i => i !== best && i.p.v.v !== best.p.v.v);
      if(others.length) k.dup.push({ key:'anti', used:best.x, not:others.map(i => i.x) });
    }
  }
  return k;
}
// the wound roll needed (05.02): S twice T or more 2+, greater 3+, equal 4+, less 5+, half or less 6+
const woundNeed = (S, T) => S >= 2 * T ? 2 : S > T ? 3 : S === T ? 4 : 2 * S <= T ? 6 : 5;
const WOUND_WHY = { 2:'S at least twice T', 3:'S greater than T', 4:'S equal to T', 5:'S less than T', 6:'S half of T or less' };

// a rule's keyword (on a mod) as the keyword it gives
const MOD_KW = { sus:v => 'SUSTAINED HITS ' + up(v), lethal:() => 'LETHAL HITS', dev:() => 'DEVASTATING WOUNDS', ignoresCover:() => 'IGNORES COVER',
  twin:() => 'TWIN-LINKED', lance:() => 'LANCE', precision:() => 'PRECISION', cleave:v => 'CLEAVE ' + (+v || 1), hazardous:() => 'HAZARDOUS', heavy:() => 'HEAVY' };
const NUM = { a:'A', s:'S', ap:'AP', d:'D' };

// one weapon with the rules that apply to it → the numbers of its attacks against this target, and where each
// change comes from (G.why, for the working).
// X: { ctx, tm, tkw (the target's keywords now), total (models in the target at Select Targets), bigTarget }
function prep(g, X){
  const ctx = X.ctx, tm = X.tm, tsrc = tm.src || {}, ranged = !!ctx.ranged;
  const mods = [].concat(g.mods || [], g.mod ? [g.mod] : []).filter(Boolean);
  const from = g.from || {}, skillKey = ranged ? 'BS' : 'WS';
  const srcName = m => m.from || 'set by hand';
  // a value the printed weapon already includes from a rule (New Recruit adds some, never a stratagem's): that rule never
  // adds it again
  const credited = (field, m) => !!m.from && !m.strat && [].concat(from[field] || []).some(r => up(r) === up(m.from) || up(m.from).startsWith(up(r) + ': '));
  const applied = [], skipped = [];
  const why = { a:[], s:[], ap:[], d:[], hit:[], wound:[], bs:[], range:[], set:{} };
  const inst = (g.kw || []).map(t => ({ t:up(t), src:'' }));
  for(const m of mods){
    for(const [key, f] of Object.entries(MOD_KW)) if(m[key]){
      const t = f(m[key]);
      if(credited(t, m)){ skipped.push({ from:m.from, key:t }); continue; }
      inst.push({ t, src:srcName(m) }); applied.push({ from:m.from || '', key:t });
    }
  }
  const k = keywords(inst, X.tkw);
  // where a keyword comes from: the rule that gives it here, or the rule the printed weapon already has it from (from)
  k.from = key => k.src[key] || [].concat(from[k.text[key]] || []).join(' and ');
  const sum = (key, field) => { let t = 0; for(const m of mods){ if(!m[key]) continue;
    if(credited(field, m)){ skipped.push({ from:m.from, key:field }); continue; }
    t += +m[key]; applied.push({ from:m.from || '', key:field }); why[key].push({ v:+m[key], src:srcName(m) }); } return t; };
  const best = key => { let v = '', src = ''; for(const m of mods) if(m[key] && (v !== 'all')){ if(m[key] === 'all' || !v){ v = m[key]; src = srcName(m); } } return { v, src }; };
  const low = (key, d) => { let v = d, src = ''; for(const m of mods) if(m[key] && +m[key] < v){ v = +m[key]; src = srcName(m); } return { v, src }; };
  // a value a rule sets for this weapon ("10"), or adds to it ("+6")
  const setOf = f => { let base = null, plus = 0; for(const m of mods){ const v = m.set && m.set[f]; if(v == null) continue;
    if(/^[+-]/.test(String(v))){ plus += num(v) || 0; (why[f.toLowerCase()] || why.bs).push({ v:num(v) || 0, src:srcName(m) }); } else { base = String(v); why.set[f] = srcName(m); }
    applied.push({ from:m.from || '', key:f }); } return { base, plus }; };
  const sA = setOf('A'), sS = setOf('S'), sAP = setOf('AP'), sD = setOf('D'), sBS = setOf(skillKey);
  const aPlus = sum('a', 'A') + sA.plus, sPlus = sum('s', 'S') + sS.plus, apImp = sum('ap', 'AP') - sAP.plus, dPlus = sum('d', 'D') + sD.plus;
  const notes = k.dup.map(d => ({ dup:d.key, used:d.used, not:d.not }));

  // every weapon is taken to be in range. Half range ([RAPID FIRE], [MELTA]): ctx.halfWithin = the target is within that
  // many inches, so each weapon whose half range reaches it gets its bonus; else ctx.halfRange (true: every weapon).
  // A rule that changes range (mod.range, inches) changes half range with it (24.25, 24.30)
  const r0 = num(g.range), rPlus = sum('range', 'Range'), rangeIn = r0 == null || /melee/i.test(g.range || '') ? null : r0 + rPlus;
  const half = ctx.halfWithin != null ? rangeIn != null && rangeIn / 2 >= ctx.halfWithin : !!ctx.halfRange;
  let out = '';
  if(ranged){
    if(ctx.cq && !ctx.big && !k.cq) out = out || 'close-quarters shooting: [CLOSE-QUARTERS] weapons only (10.06)';
    if(ctx.cq && ctx.big && k.blast) out = out || '[BLAST] cannot target a unit its unit is engaged with (10.06)';
    if(ctx.engaged && X.bigTarget && k.blast) out = out || '[BLAST] cannot target an engaged MONSTER/VEHICLE (17.03)';
  }
  const indirect = ranged && !!ctx.indirect && !!k.indirect;   // indirect shooting changes only [INDIRECT FIRE] weapons' attacks (10.07)
  const ignore = !!k.psychic || mods.some(m => m.ignoreHitMods);   // [PSYCHIC] (24.29): it ignores the modifiers that make it worse
  const ignoreSrc = k.psychic ? '[PSYCHIC] (24.29)' : srcName(mods.find(m => m.ignoreHitMods) || {});

  // the hit roll: modifiers (no limit in the Core Rules), BS/WS after its own modifiers (2+ to 6+)
  for(const m of mods) if(+m.hit) why.hit.push({ v:+m.hit, src:srcName(m) });
  if(ranged && ctx.heavy && k.heavy) why.hit.push({ v:1, src:'[HEAVY] (24.16)' });
  if(ranged && ctx.cq && ctx.big && !k.cq) why.hit.push({ v:-1, src:'close-quarters shooting by a MONSTER/VEHICLE (10.06)' });
  if(ranged && ctx.engaged && X.bigTarget && !(k.cq && ctx.cq)) why.hit.push({ v:-1, src:'an engaged MONSTER/VEHICLE target (17.03)' });
  if(tm.hitMinus) why.hit.push({ v:-tm.hitMinus, src:tsrc.hitMinus || 'the target' });
  const pos = why.hit.filter(x => x.v > 0).reduce((t, x) => t + x.v, 0), neg = why.hit.filter(x => x.v < 0).reduce((t, x) => t + x.v, 0);
  if(ignore) for(const x of why.hit) if(x.v < 0) x.ignored = true;
  const skill0 = sBS.base != null ? skillOf(sBS.base) : skillOf(g.skill);
  if(ranged && (ctx.cover || indirect) && !k.ignoresCover) why.bs.push({ v:1, src:indirect && !ctx.cover ? 'indirect shooting: the benefit of cover (10.07, 13.08)' : ctx.coverSrc || 'the benefit of cover (13.08)', ignored:ignore });
  else if(ranged && (ctx.cover || indirect)) why.bs.push({ v:0, src:'the benefit of cover (13.08): not against [IGNORES COVER] (24.18)' + (k.from('ignoresCover') ? ', from ' + k.from('ignoresCover') : '') });
  if(ranged && ctx.plunging) why.bs.push({ v:-1, src:'Plunging Fire (22.05)' });
  // a rule that improves the BS/WS characteristic (mod.skill: by 1 each): after a value a rule sets ("BS 3+" first, then improved:
  // the Faction Pack's FAQ on Auto-divinatory Targeting and the Protector Imperative)
  for(const m of mods) if(+m.skill){ if(credited(skillKey, m)){ skipped.push({ from:m.from, key:skillKey }); continue; }
    applied.push({ from:m.from || '', key:skillKey }); for(let i = 0; i < +m.skill; i++) why.bs.push({ v:-1, src:srcName(m) }); }
  const worse = why.bs.filter(x => x.v > 0 && !x.ignored).length, better = why.bs.filter(x => x.v < 0).length;
  const bs = skill0 >= 7 ? 7 : Math.max(RULE.bestSkill, Math.min(RULE.worstSkill, skill0 + worse - better - sBS.plus));
  let rrHit = best('rrHit'), rrWound = k.twin ? { v:'all', src:k.src.twin ? k.src.twin : '[TWIN-LINKED] (24.38' + (k.from('twin') ? ', from ' + k.from('twin') : '') + ')' } : best('rrWound');
  const noRr = indirect ? 'indirect shooting (10.07)' : ranged && ctx.snap ? 'snap shooting (15.09)' : '';
  if(noRr) rrHit = { v:'', src:'' };                                          // you cannot re-roll hit rolls (10.07, 15.09)

  if(k.lance && ctx.charged) why.wound.push({ v:1, src:'[LANCE] after a charge move (24.21)' + (k.from('lance') ? ', from ' + k.from('lance') : '') });
  for(const m of mods) if(+m.wound) why.wound.push({ v:+m.wound, src:srcName(m) });
  if(tm.woundMinus) why.wound.push({ v:-tm.woundMinus, src:tsrc.woundMinus || 'the target' });
  if(tm.apWorse) why.ap.push({ v:-tm.apWorse, src:tsrc.apWorse || 'the target' });
  if(tm.dMinus) why.d.push({ v:-tm.dMinus, src:tsrc.dMinus || 'the target', target:true });

  const s0 = sS.base != null ? num(sS.base) : num(g.S);
  const ap0 = sAP.base != null ? num(sAP.base) : num(g.AP);
  const D = dice(sD.base != null ? sD.base : g.D);
  const cH = low('critHit', RULE.critHit), cW = low('critWound', RULE.critWound);
  const G = {
    name:g.name, n:Math.max(0, +g.n || (g.n === 0 ? 0 : 1)), out, notes, applied, skipped, k, why, half, rangeIn, r0, from, indirect, noRr, ignoreSrc,
    A0:sA.base != null ? sA.base : g.A, skill0, S0:s0, AP0:ap0 || 0, D0:sD.base != null ? sD.base : g.D, blastN:X.total,
    A:dice(sA.base != null ? sA.base : g.A), aPlus,
    rapid:k.rapid && half ? k.rapid : null, melta:k.melta && half ? k.melta : null,
    // [BLAST]/[CLEAVE]: the models that were in the target unit at Select Targets, before any of these attacks
    extra:((k.blast || 0) + (k.cleave || 0)) * Math.floor(X.total / 5), extraPer:(k.blast || 0) + (k.cleave || 0),
    // [TORRENT] in snap shooting: the rules don't settle it (24.37 "automatically hits", 15.09 "only hits on an unmodified hit roll of 6");
    // ctx.snapSix: the 15.09 reading (no automatic hits), else 24.37's
    torrent:!!k.torrent && !(ranged && ctx.snap && ctx.snapSix), torrentSnap:!!k.torrent && ranged && !!ctx.snap, snap:ranged && !!ctx.snap, fail:indirect ? (ctx.indirect === '1-3' ? 4 : 6) : 0,
    bs, hitMod:pos + (ignore ? 0 : neg), critHit:Math.min(RULE.critHit, cH.v), critHitSrc:cH.src, rrHit:rrHit.v, rrHitSrc:rrHit.src,
    S:s0 == null ? RULE.minS : Math.max(RULE.minS, s0 + sPlus),   // no S: S 1 for this (02.04.01), and '-' is never modified
    woundMod:why.wound.reduce((t, x) => t + x.v, 0),
    critWound:Math.min(cW.v, k.antiV || 7), critWoundSrc:k.antiV && k.antiV <= cW.v ? '[' + k.text.anti + '] (24.03)' + (k.from('anti') ? ', from ' + k.from('anti') : '') : cW.src, rrWound:rrWound.v, rrWoundSrc:rrWound.src,
    AP:Math.min(0, (ap0 || 0) - apImp + (tm.apWorse || 0)),   // improvements and worsenings added up, then not worse than 0
    D, dPlus, sus:k.sus || null, lethal:!!k.lethal, dev:!!k.dev, precision:!!k.precision, psychic:ignore,
    // hazard rolls after the unit's attacks: one for [HAZARDOUS] (24.15), two for [SUPA-HAZARDOUS] when it shoots (its own words);
    // a weapon with both makes all three: neither replaces the other
    hazRolls:(k.hazardous ? 1 : 0) + (k.supaHaz && ranged ? 2 : 0)
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
  const row = M.row, need = woundNeed(G.S, T), sgt = tm.woundMinusSgt && G.S > T ? +tm.woundMinusSgt : 0, wMod = G.woundMod - sgt;
  let pc = 0, pn = 0;
  for(let u = 2; u <= 6; u++){ if(u >= G.critWound) pc++; else if(u + wMod >= need) pn++; }
  pc /= 6; pn /= 6;
  const insv = Math.max(RULE.bestSave, Math.min(row.InSv || 7, tm.insv || 7)), sv = Math.max(RULE.bestSave, row.Sv || 7);
  let sf = 0;
  for(let u = 1; u <= 6; u++) if(!(u !== 1 && ((insv <= 6 && u >= insv) || u + G.AP >= sv))) sf++;
  sf /= 6;
  const fnp = Math.min(row.fnp || 7, tm.fnp || 7), fnpM = Math.min(fnp, row.fnpMortal || 7, tm.fnpMortal || 7);
  const keep = x => x <= 6 ? (x - 1) / 6 : 1;
  const Dn = Math.max(RULE.minDamage, G.Dmean + G.dPlus + G.meltaMean - (tm.dMinus || 0)), Dm = Math.max(RULE.minDamage, G.Dmean + G.dPlus + G.meltaMean - (tm.dMinusChar || 0));
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
  return { need, sgt, wMod, lethal, fishW, fishH };
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
  // target.shield { name, models:[{ name, count, W, fnp, fnpMortal }] } (Grot Shields): while a model of that other unit is on the
  // battlefield, each hit roll of these attacks that results in a hit ends that attack, and that unit suffers 1 mortal wound (its
  // Feel No Pain against it); [TORRENT] attacks make no hit roll (the FAQ: not "hit rolls that result in a hit")
  const shield = tg.shield && (tg.shield.models || []).some(r => +r.count > 0) ? { name:tg.shield.name || '',
    rows:tg.shield.models.filter(r => +r.count > 0).map(r => ({ count:+r.count, W:Math.max(1, +r.W || 1), fnp:Math.min(+r.fnp || 7, +r.fnpMortal || 7) })) } : null;
  return { ctx, tm, tkw, rows, groups, total, G, G2, batches, precOn, shield };
}

// the target's models for one input: each with its wounds left, row, allocation group, and where it sits in its unit
// (ri: its stats row, k: which of that row's models; line: the models line it belongs to, when the rows say: the first line's
// models are the first removed, 05.04 "Select Model")
function worldOf(S){
  const { rows, groups } = S, models = [], byGroup = groups.map(() => []), seen = rows.map(() => 0);
  const lineAt = (r, k) => { if(!r.lines) return -1; let t = 0; for(const l of r.lines){ t += l.n; if(k < t) return l.id; } return -1; };
  groups.forEach((grp, gi) => { for(const ri of grp.rows){ const n = grp.char ? 1 : rows[ri].count; for(let i = 0; i < n; i++){ const k = seen[ri]++;
    const M = { row:rows[ri], gi, w:0, ri, k, line:lineAt(rows[ri], k) }; models.push(M); byGroup[gi].push(M); } } });
  // the shielding unit's models (S.shield), one after another: the one taking mortal wounds is the first left, so a model that has
  // lost wounds takes the next one (06.02)
  const sh = S.shield ? (() => { const W0 = [], fnp = []; for(const r of S.shield.rows) for(let i = 0; i < r.count; i++){ W0.push(r.W); fnp.push(r.fnp); }
    return { n:W0.length, W0:Int32Array.from(W0), w:new Int32Array(W0.length), fnp:Int32Array.from(fnp), p:0 }; })() : null;
  return { models, byGroup, attached:rows.some(r => r.bodyguard), sh, shS:{ hits:0, lost:0, dead:0, wipe:0 } };
}
const KEYS = ['attacks', 'hits', 'wounds', 'unsaved', 'mortals', 'dmg'];
const sumsOf = G => G.map(() => ({ attacks:0, hits:0, wounds:0, unsaved:0, mortals:0, dmg:0, gone:0, n:0, sq:{ attacks:0, hits:0, wounds:0, unsaved:0, mortals:0, dmg:0 } }));
const bufsOf = () => { const buf = () => ({ a:new Int32Array(64), n:0 }); return { atk:buf(), hits:buf(), auto:buf(), dev:buf(), saveBy:[buf(), buf(), buf(), buf(), buf(), buf()] }; };
const put = (b, v) => { if(b.n === b.a.length){ const x = new Int32Array(b.a.length * 2); x.set(b.a); b.a = x; } b.a[b.n++] = v; };

// one weapon after another, once: S's attacks against the models of W as they are now (wounds already lost stay lost), in
// the allocation order given. nOf[i]: the models making weapon i's attacks (default: as given); extraOf[i]: its [BLAST]/[CLEAVE]
// dice (default: from the models at the start). Returns the models destroyed in the unit by the end (dead) and the wounds
// these attacks took (lost).
function attackOnce(S, W, order, R, sum, B, nOf, extraOf){
  const { rows, groups, total, G, G2, batches, tm, ctx, precOn } = S, { models, byGroup, attached } = W;
  const ncOrder = order.filter(gi => !groups[gi].char), chOrder = order.filter(gi => groups[gi].char);
  const { atk, hits, auto, dev, saveBy } = B;
  let dead = 0, lost = 0;
  // the shield (Grot Shields) is whole at the start of these attacks; a hit that it stops is 1 mortal wound on it
  const sh = W.sh, shS = W.shS;
  if(sh){ sh.w.set(sh.W0); sh.p = 0; }
  const shHit = () => { shS.hits++; const i = sh.p;
    if(sh.fnp[i] <= 6 && d6(R) >= sh.fnp[i]) return;
    sh.w[i]--; shS.lost++;
    if(sh.w[i] <= 0){ shS.dead++; sh.p++; } };
  for(const M of models) if(M.w <= 0) dead++;
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
    for(const mi of b.members) sum[mi].n += nOf ? nOf[mi] : G[mi].n;   // the models making these attacks (what is left of them)
    if(dead >= total){ for(const mi of b.members) sum[mi].gone++; continue; }   // destroyed before these attacks: they are lost (05.04)
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
    for(const mi of b.members){ const x = P[mi], n = nOf ? nOf[mi] : x.n, extra = extraOf ? extraOf[mi] : x.extra;
      for(let i = 0; i < n; i++){ const a = Math.max(RULE.minA, roll(x.A, R) + x.aPlus) + (x.rapid ? roll(x.rapid, R) : 0) + extra; for(let j = 0; j < a; j++) put(atk, mi); sum[mi].attacks += a; } }
    // hit rolls (05.01)
    const hr = u => g.snap ? (u === RULE.snapHit ? 1 : 0) : (u === 1 || u < g.fail) ? 0 : u >= g.critHit ? 2 : u + g.hitMod >= g.bs ? 1 : 0;
    hits.n = 0; auto.n = 0;
    for(let i = 0; i < atk.n; i++){
      const mi = atk.a[i];
      if(g.torrent){ put(hits, mi); continue; }   // automatically hits: no hit roll, never a critical hit (01.05.01)
      let u = d6(R), r = hr(u);
      if((r === 0 && (g.rrHit === 'all' || (g.rrHit === '1s' && u === 1))) || (r === 1 && pl.fishH)){ u = d6(R); r = hr(u); }
      if(!r) continue;
      // stopped by the shield while a model of it is on the battlefield: the attack ends (no [LETHAL HITS], no [SUSTAINED HITS] extra hits)
      if(sh && sh.p < sh.n){ shHit(); continue; }
      if(r === 2 && pl.lethal) put(auto, mi); else put(hits, mi);
      if(r === 2 && g.sus){ const x = roll(g.sus, R); for(let j = 0; j < x; j++) put(hits, mi); }
    }
    for(let i = 0; i < hits.n; i++) sum[hits.a[i]].hits++;
    for(let i = 0; i < auto.n; i++) sum[auto.a[i]].hits++;
    // wound rolls (05.02); save rolls (05.03): one for each wound, all rolled together, kept by result to be
    // resolved from the lowest (05.04)
    const wr = u => u === 1 ? 0 : u >= g.critWound ? 2 : u + pl.wMod >= pl.need ? 1 : 0;
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
      sum[mi].dmg += hurt(M, Math.max(RULE.minDamage, roll(g.D, R) + g.dPlus + (g.melta ? roll(g.melta, R) : 0) - (tm.dMinusChar || 0)), true);
    }
  }
  if(sh && sh.p >= sh.n) shS.wipe++;
  return { dead, lost };
}

// play the attacks out sims times with one allocation order
function simulate(S, order, sims, seed){
  const left = S.track ? new Map() : null, nLeft = S.track ? new Array(S.rows.length) : null;
  const R = rng(seed), { total, G } = S, W = worldOf(S), B = bufsOf();
  const sum = sumsOf(G);
  const dist = new Array(total + 1).fill(0);
  let dmgTotal = 0, killedTotal = 0;
  for(let s = 0; s < sims; s++){
    for(const M of W.models) M.w = M.row.W;
    const before = S.moments ? sum.map(x => Object.assign({}, x)) : null;
    const { dead, lost } = attackOnce(S, W, order, R, sum, B);
    if(before) sum.forEach((x, i) => { for(const k of KEYS){ const d = x[k] - before[i][k]; x.sq[k] += d * d; } });
    dmgTotal += lost; killedTotal += dead; dist[dead]++;
    // S.track: the models left in each stats row at the end of the game (counting only: no dice)
    if(left){ nLeft.fill(0); for(const M of W.models) if(M.w > 0) nLeft[M.ri]++; const k = nLeft.join(','); left.set(k, (left.get(k) || 0) + 1); }
  }
  return { sum, dist, dmgTotal, killedTotal, left, shS:W.shS };
}

// the defender declares the allocation order (05.03): the order that loses the fewest models on average, then the
// fewest wounds. Every order is played with the same dice and as many games as the result shown (a short trial first
// only when there are more than six orders); the result shown is that order's own games
function pickOrder(S, orders, sims, seed){
  let cands = orders;
  if(orders.length > 6 && S.batches.length){
    const pilot = orders.map(o => ({ o, t:simulate(S, o, Math.min(sims, RULE.pilot), seed) }));
    pilot.sort((x, y) => x.t.killedTotal - y.t.killedTotal || x.t.dmgTotal - y.t.dmgTotal);
    cands = pilot.slice(0, 3).map(x => x.o);
  }
  let order = cands[0], t = simulate(S, order, sims, seed);
  for(const o of cands.slice(1)){
    const u = simulate(S, o, sims, seed);
    if(u.killedTotal < t.killedTotal - 1e-9 || (Math.abs(u.killedTotal - t.killedTotal) < 1e-9 && u.dmgTotal < t.dmgTotal)){ t = u; order = o; }
  }
  return { order, t };
}

function run(input){
  const sims = input.sims || 10000, seed = input.seed || 1;
  const S = setup(input);
  S.Tdefault = parseInt(input.target.T, 10) || 1;
  S.moments = !!input.moments;
  S.track = !!input.track;
  const orders = ordersOf(S.groups);
  const { order, t } = pickOrder(S, orders, sims, seed);
  const mean = x => x / sims, sd = (s1, s2) => Math.sqrt(Math.max(0, s2 / sims - (s1 / sims) ** 2));
  // input.track: the models left in each row after these attacks, from the same games: left [{ n, p }] and fate (the chance a row has none left)
  const track = t.left ? (() => { const left = [...t.left].map(([k, c]) => ({ n:k.split(',').map(Number), p:c / sims })).sort((x, y) => y.p - x.p || (x.n.join() < y.n.join() ? -1 : 1));
    return { left, fate:S.rows.map((r, i) => left.reduce((s, x) => s + (x.n[i] === 0 ? x.p : 0), 0)) }; })() : {};
  return Object.assign({ sims, models:S.total, dmg:mean(t.dmgTotal), killed:mean(t.killedTotal), wipe:mean(t.dist[S.total]), dist:t.dist.map(mean),
    groups:t.sum.map((x, i) => Object.assign({ attacks:mean(x.attacks), hits:mean(x.hits), wounds:mean(x.wounds), unsaved:mean(x.unsaved), mortals:mean(x.mortals), dmg:mean(x.dmg),
      gone:mean(x.gone), out:S.G[i].out, notes:S.G[i].notes }, S.moments ? { sd:Object.fromEntries(KEYS.map(k => [k, sd(x[k], x.sq[k])])) } : {})),
    shield:S.shield ? { name:S.shield.name, hits:mean(t.shS.hits), lost:mean(t.shS.lost), dead:mean(t.shS.dead), wipe:mean(t.shS.wipe), models:S.shield.rows.reduce((a, r) => a + r.count, 0) } : null,
    alloc:S.groups.map(x => ({ name:x.name, n:x.n, char:x.char })), order:order.map(i => S.groups[i].name), orderIdx:order, orders:orders.length, capped:!!orders.capped }, track);
}

/* play(input): a few attacks one after another in the same games, as the turn goes at the table: shoot, then charge and
   fight, then what is left of the target fights back. Each beat is one unit's attacks against the other: the two units (sides
   0 and 1) keep, from one beat to the next of a game, the wounds they lost and the models destroyed; a beat's attacks are made
   by the models of the other side still alive.
     input.beats  [{ side (the side the attacks target: 0 or 1), input (as run: groups, target, ctx), order (an allocation
                    order; default: the one run picks for this beat on its own), fight (a Fight-phase beat), onDeath { lines,
                    need } (the attacking side's models on those lines destroyed in an earlier fight beat still attack on a
                    need+, rolled for each in each game: One Last Kill), ph (its phase: a comeback is rolled when the phase
                    ends, after its last beat), hazard { mw, rolls } (after its attacks, when it attacked, the attacking side
                    makes a hazard roll for each [HAZARDOUS] weapon, two for each [SUPA-HAZARDOUS] one it shot with, and rolls
                    more for the unit itself: each 1-2 is mw mortal wounds on it, 06.02/06.03/24.15),
                    self (the attacking side's own target: T, kw, models, mod, for its hazard rolls when no beat targets it) }]
                  target.revive { row name: { roll, wounds } }: that CHARACTER, the first time it is destroyed, is set back
                  up at the end of that phase on a roll+ with those wounds (Berserker Frenzy)
                  A side's target.models rows are the same in every beat that targets it (the rules that apply can change:
                  InSv, Feel No Pain); a row can list its models lines (lines:[{ id, n }], the first removed first).
                  A beat's weapon can name the models that make its attacks: carry [[line id, weapons per model]] of the side
                  attacking, and slice [lo, hi] (of those weapons, the ones from lo to hi: a rule that reaches only some of
                  them reaches the ones kept longest); without carry its models are as given (that side has lost none).
     input.sims (default 10000), input.seed (default 1)
   result: { sims, beats:[{ killed (mean destroyed in this beat), dmg (wounds lost in it; dmgVar: their spread over the games), wipe (P the side is destroyed by its end),
             wipeDown (P it is still destroyed once its phase is over: a comeback counted as above),
             dist [P(exactly k destroyed by its end)], before (mean destroyed before it), rows:[{ name, count, char, gone (P all of
             the row destroyed by its end), down (P still destroyed once its phase is over: a comeback's roll counted as the chance
             it fails) }], groups:[{ n (mean models attacking with it), attacks, hits, wounds, unsaved, mortals, dmg, gone }], hazard { rolls, mw, lost, dead } (means,
             on the attacking side; null without hazard), order }],
             sides:[{ models, killed (mean destroyed by the end), wipe, rows:[{ name, count, char, left (mean), gone (P all of
             the row destroyed) }] }] (a comeback rolled at the end of the last phase counted as the chance its roll fails) }
   One beat played alone gives what run gives (the same dice); its hazard rolls and a comeback have dice of their own. */
function play(input){
  const sims = input.sims || 10000, seed = input.seed || 1;
  const B = bufsOf();
  const beats = input.beats.map(b => {
    const S = setup(b.input); S.Tdefault = parseInt(b.input.target.T, 10) || 1;
    const orders = ordersOf(S.groups), order = b.order || (orders.length > 1 ? pickOrder(S, orders, sims, seed).order : orders[0]);
    // b.alt: { lines (models lines of the attacking side), input }: the attacks when every model on those lines is destroyed (the
    // same weapons, without that CHARACTER's own rules); its target is the same
    const alt = b.alt && b.alt.lines && b.alt.lines.length ? (() => { const S2 = setup(b.alt.input); S2.Tdefault = S.Tdefault; return { lines:b.alt.lines, S:S2, W:worldOf(S2) }; })() : null;
    // b.self: the attacking side's own models as this beat gives them (its hazard rolls: rows, Feel No Pain)
    const own = b.self ? (() => { const S2 = setup({ groups:[], target:b.self, ctx:{} }); S2.Tdefault = parseInt(b.self.T, 10) || 1; return { S:S2, W:worldOf(S2), order:ordersOf(S2.groups)[0] }; })() : null;
    return { b, S, W:worldOf(S), alt, own, order, sum:sumsOf(S.G), dist:new Array(S.total + 1).fill(0), killed:0, dmg:0, before:0, rowGone:S.rows.map(() => 0), rowDown:S.rows.map(() => 0), wipeDown:0, altN:0, dmg2:0,
      hz:{ rolls:0, mw:0, lost:0, dead:0 } };
  });
  // each side's models, by stats row and place in the row (ri, k), with the line each belongs to: from the first beat that
  // describes it, one that targets it or one it attacks in with its own models (self: its hazard rolls), so a later beat never
  // changes what an earlier one finds. A side no beat describes loses no models: all of its lines attack in every game
  const sides = [0, 1].map(si => {
    const x0 = beats.find(x => x.b.side === si || (x.b.side === 1 - si && x.own)); if(!x0) return null;
    const first = x0.b.side === si ? x0 : x0.own;
    const rows = first.S.rows, at = []; let t = 0; for(const r of rows){ at.push(t); t += r.count; }
    const line = new Int32Array(t).fill(-1); for(const M of first.W.models) line[at[M.ri] + M.k] = M.line;
    // a CHARACTER set back up at the end of the phase it is first destroyed in (target.revive { row name: { roll, wounds } }:
    // Berserker Frenzy), from any beat that targets the side
    const rv = []; for(const x of beats) if(x.b.side === si && x.b.input.target.revive) for(const [name, v] of Object.entries(x.b.input.target.revive)){
      const ri = rows.findIndex(r => r.name === name); if(ri >= 0) for(let k = 0; k < rows[ri].count; k++) if(!rv.some(q => q.i === at[ri] + k)) rv.push({ i:at[ri] + k, ri, roll:+v.roll || 2, wounds:+v.wounds || 1 }); }
    return { rows, at, n:t, w:new Float64Array(t), died:new Int32Array(t), used:new Uint8Array(t), el:new Float64Array(t), line, S:first.S, W:first.W, order:first.order, rv,
      killed:0, wipe:0, rowLeft:rows.map(() => 0), rowGone:rows.map(() => 0) }; });
  // each beat its own dice (beat 0's are run's): a beat's numbers are the same whether or not more beats follow it, and a
  // change in one beat leaves the dice of the others as they were. Hazard rolls and a comeback have dice of their own
  beats.forEach((x, j) => { x.R = rng(seed + j * 1000003); x.RH = rng(seed + j * 1000003 + 7777); x.RV = rng(seed + j * 1000003 + 15551); });
  // mortal wounds on a side, one at a time, each to the model the allocation picks (06.02: one that has lost wounds first, the
  // CHARACTER groups last), with Feel No Pain against mortal wounds for each (24.12)
  // (the models and Feel No Pain of that beat's self, else as the side was first described)
  const mortalsOn = (sd, n, R, j, own) => {
    const o = own && own.S.rows.length === sd.rows.length && own.S.rows.every((r, i) => r.count === sd.rows[i].count) ? own : sd, { groups, tm } = o.S, { byGroup } = o.W;
    for(const M of o.W.models) M.w = sd.w[sd.at[M.ri] + M.k];
    const nc = o.order.filter(gi => !groups[gi].char), ch = o.order.filter(gi => groups[gi].char);
    const pickIn = gi => { let first = null; for(const M of byGroup[gi]){ if(M.w <= 0) continue; if(M.w < M.row.W) return M; if(!first) first = M; } return first; };
    const current = () => { for(const list of [nc, ch]){ let first = null; for(const gi of list){ const M = pickIn(gi); if(!M) continue; if(M.w < M.row.W) return M; if(!first) first = M; } if(first) return first; } return null; };
    let lost = 0, dead = 0;
    for(let i = 0; i < n; i++){ const M = current(); if(!M) break;
      const fnp = Math.min(M.row.fnp || 7, tm.fnp || 7, M.row.fnpMortal || 7, tm.fnpMortal || 7);
      if(fnp <= 6 && d6(R) >= fnp) continue;
      M.w -= 1; lost++; if(M.w <= 0) dead++; }
    for(const M of o.W.models){ const i = sd.at[M.ri] + M.k; if(M.w <= 0 && sd.w[i] > 0) sd.died[i] = j; sd.w[i] = M.w; }
    return { lost, dead };
  };
  for(let s = 0; s < sims; s++){
    for(const sd of sides) if(sd){ let i = 0; for(const r of sd.rows) for(let k = 0; k < r.count; k++) sd.w[i++] = r.W; sd.died.fill(-1); sd.used.fill(0); sd.el.fill(0); }
    for(let j = 0; j < beats.length; j++){ const x = beats[j], R = x.R;
      const tg = sides[x.b.side], by = sides[1 - x.b.side];
      // the attacking side's models still alive, by models line
      let nOf = null, extraOf = null;
      const alive = {};
      // b.onDeath { lines, need }: models on those lines destroyed in an earlier Fight-phase beat (fight) of this unit's turn of
      // attacks fight anyway on a need+, rolled for each such model in each game (One Last Kill); they stay destroyed
      const od = x.b.onDeath;
      if(by){ for(let i = 0; i < by.n; i++){
        if(by.w[i] > 0) alive[by.line[i]] = (alive[by.line[i]] || 0) + 1;
        else if(od && by.died[i] >= 0 && beats[by.died[i]].b.fight && od.lines.includes(by.line[i]) && d6(R) >= od.need) alive[by.line[i]] = (alive[by.line[i]] || 0) + 1; } }
      const useAlt = !!x.alt && !!by && x.alt.lines.every(id => !alive[id]);
      if(useAlt) x.altN++;
      const { S, W } = useAlt ? x.alt : x;
      for(const M of W.models) M.w = tg.w[tg.at[M.ri] + M.k];
      const groups = x.b.input.groups;
      if(by && groups.some(g => g.carry)) nOf = S.G.map((G, i) => { const g = groups[i]; if(!g.carry) return G.n;
        const c = g.carry.reduce((t, [id, per]) => t + (alive[id] || 0) * per, 0);
        return g.slice ? Math.max(0, Math.min(c - g.slice[0], g.slice[1] - g.slice[0])) : c; });
      // [BLAST]/[CLEAVE]: the models in the target at the start of these attacks (24.05, 24.06)
      let left = 0; for(const M of W.models) if(M.w > 0) left++;
      if(left < S.total) extraOf = S.G.map(G => G.extraPer * Math.floor(left / 5));
      const d0 = S.total - left;
      const { dead, lost } = attackOnce(S, W, x.order, R, useAlt ? x.altSum || (x.altSum = sumsOf(S.G)) : x.sum, B, nOf, extraOf);
      for(const M of W.models){ const i = tg.at[M.ri] + M.k; if(M.w <= 0 && tg.w[i] > 0) tg.died[i] = j; tg.w[i] = M.w; }
      x.before += d0; x.killed += dead - d0; x.dmg += lost; x.dmg2 += lost * lost; x.dist[dead]++;
      // each stats row of the target destroyed by the end of this beat (a CHARACTER's fate)
      for(let ri = 0; ri < tg.rows.length; ri++){ let a = 0; for(let k = 0; k < tg.rows[ri].count; k++) if(tg.w[tg.at[ri] + k] > 0) a++; if(!a) x.rowGone[ri]++; }
      // b.hazard { mw }: after its attacks, the attacking unit makes one hazard roll for each [HAZARDOUS] weapon it attacked with,
      // two for each [SUPA-HAZARDOUS] one, all at once: each 1-2 is mw mortal wounds on it (06.03, 24.15)
      // (and b.hazard.rolls more for the unit itself, from a rule's own words: Try Dat Button! with two D6), when it has attacked
      const att = S.G.reduce((t, G, gi) => t + (G.out ? 0 : nOf ? nOf[gi] : G.n), 0);
      if(x.b.hazard && by && left > 0 && att > 0){ let rolls = +x.b.hazard.rolls || 0; S.G.forEach((G, gi) => { if(!G.hazRolls || G.out) return; rolls += G.hazRolls * (nOf ? nOf[gi] : G.n); });
        let mw = 0; for(let r = 0; r < rolls; r++) if(d6(x.RH) <= 2) mw += x.b.hazard.mw || 1;
        x.hz.rolls += rolls; x.hz.mw += mw;
        if(mw){ const h = mortalsOn(by, mw, x.RH, j, x.own); x.hz.lost += h.lost; x.hz.dead += h.dead; } }
      // the end of a phase (the next beat is in another phase, or none follows): a CHARACTER first destroyed in this phase is set back
      // up on a roll+ (rv: Berserker Frenzy), with its wounds, not within Engagement Range: after the beats of this phase
      const last = j === beats.length - 1 || (beats[j + 1].b.ph || '') !== (x.b.ph || '');
      if(last){
        for(const sd of sides) if(sd && sd.rv.length){ sd.el.fill(0); for(const q of sd.rv){
          if(sd.w[q.i] > 0 || sd.used[q.i] || sd.died[q.i] < 0 || (beats[sd.died[q.i]].b.ph || '') !== (x.b.ph || '')) continue;
          sd.used[q.i] = 1; sd.el[q.i] = (q.roll - 1) / 6; if(d6(x.RV) >= q.roll){ sd.w[q.i] = Math.min(q.wounds, sd.rows[q.ri].W); sd.died[q.i] = -1; } } }
        // each beat of this phase: its target's rows still destroyed once the phase is over; a model that rolled for its comeback
        // counts with the chance its roll fails (the same mean as its die, without the die's noise: destroyed X, down X × 1/6)
        for(let jj = j; jj >= 0 && (beats[jj].b.ph || '') === (x.b.ph || ''); jj--){ const y = beats[jj], t2 = sides[y.b.side];
          let all = true, fw = 1;
          for(let ri = 0; ri < t2.rows.length; ri++){ let a = 0, f = 1; for(let k = 0; k < t2.rows[ri].count; k++){ const i = t2.at[ri] + k; if(t2.el[i]) f *= t2.el[i]; else if(t2.w[i] > 0) a++; } if(!a){ y.rowDown[ri] += f; fw *= f; } else all = false; }
          if(all) y.wipeDown += fw; } }
    }
    // the end of the turn (the end of its last phase): a comeback rolled then counted as the chance its roll fails, as above
    for(const sd of sides) if(sd){ let dead = 0, i = 0, fw = 1, all = true;
      sd.rows.forEach((r, ri) => { let a = 0, f = 1, e = 0; for(let k = 0; k < r.count; k++, i++){ if(sd.el[i]){ f *= sd.el[i]; e += 1 - sd.el[i]; } else if(sd.w[i] > 0) a++; }
        sd.rowLeft[ri] += a + e; if(!a) sd.rowGone[ri] += f; dead += r.count - a - e; if(a) all = false; else fw *= f; });
      sd.killed += dead; if(all) sd.wipe += fw; }
  }
  const mean = v => v / sims;
  return { sims,
    beats:beats.map(x => ({ side:x.b.side, killed:mean(x.killed), dmg:mean(x.dmg), dmgVar:Math.max(0, mean(x.dmg2) - mean(x.dmg) ** 2), before:mean(x.before), models:x.S.total, wipe:mean(x.dist[x.S.total]), wipeDown:mean(x.wipeDown), dist:x.dist.map(mean),
      // a beat with an alternative (alt): its games added up with the alternative's (the same weapons, in the same order)
      groups:x.sum.map((g0, i) => { const a = x.altSum && x.altSum[i], g = k => g0[k] + (a ? a[k] : 0);
        return { n:mean(g('n')), attacks:mean(g('attacks')), hits:mean(g('hits')), wounds:mean(g('wounds')), unsaved:mean(g('unsaved')), mortals:mean(g('mortals')), dmg:mean(g('dmg')), gone:mean(g('gone')), out:x.S.G[i].out, notes:x.S.G[i].notes }; }),
      alt:x.alt ? mean(x.altN) : 0,
      // gone: destroyed by the end of this beat; down: still destroyed after the end of its phase (a comeback: rv)
      rows:x.S.rows.map((r, ri) => ({ name:r.name, count:r.count, char:!!r.char, gone:mean(x.rowGone[ri]), down:mean(x.rowDown[ri]) })),
      // the shield's part (Grot Shields): hits it stopped, wounds and models it lost, the chance it is destroyed (means)
      shield:x.S.shield ? (() => { const a = x.W.shS, b = x.alt ? x.alt.W.shS : { hits:0, lost:0, dead:0, wipe:0 };
        return { name:x.S.shield.name, hits:mean(a.hits + b.hits), lost:mean(a.lost + b.lost), dead:mean(a.dead + b.dead), wipe:mean(a.wipe + b.wipe), models:x.S.shield.rows.reduce((t, r) => t + r.count, 0) }; })() : null,
      // the attacking unit's hazard rolls after this beat: rolls, mortal wounds, wounds lost and models destroyed (means)
      hazard:x.b.hazard ? { rolls:mean(x.hz.rolls), mw:mean(x.hz.mw), lost:mean(x.hz.lost), dead:mean(x.hz.dead), played:!!sides[1 - x.b.side] } : null,
      order:x.order.map(i => x.S.groups[i].name), orderIdx:x.order })),
    sides:sides.map(sd => sd && { models:sd.n, killed:mean(sd.killed), wipe:mean(sd.wipe), rows:sd.rows.map((r, ri) => ({ name:r.name, count:r.count, char:!!r.char, left:mean(sd.rowLeft[ri]), gone:mean(sd.rowGone[ri]) })) })
  };
}
// what applies to each weapon, without playing the dice (for the app's notes)
function resolve(input){
  const S = setup(input);
  return { groups:S.G.map(x => ({ out:x.out, notes:x.notes, applied:x.applied, skipped:x.skipped, bs:x.bs, hitMod:x.hitMod, woundMod:x.woundMod, S:x.S, AP:x.AP, rrHit:x.rrHit, rrWound:x.rrWound, psychic:x.psychic, psychicKw:!!x.k.psychic, dev:x.dev, rangeIn:x.rangeIn, lethal:x.lethal, precision:x.precision,
      critHit:x.critHit, critWound:x.critWound, sus:x.sus, torrent:x.torrent, D:x.D, dPlus:x.dPlus, A:x.A, aPlus:x.aPlus, rapid:x.rapid, melta:x.melta, extra:x.extra, half:x.half, n:x.n })),
    alloc:S.groups.map(x => ({ name:x.name, n:x.n, char:x.char })), orders:ordersOf(S.groups).length, capped:!!ordersOf(S.groups).capped, batches:S.batches.map(b => b.members) };
}

// ---- the working: exact averages, step by step (closed form) ----
// The averages of one weapon's attacks before allocation: attacks, hits, wounds, the attacks that get through and the
// damage they do, against the models the attacks meet first, as if the target had models enough for all of them.
// Damage beyond a model's wounds is lost and attacks after the unit is destroyed are lost (05.04): that needs the dice
// played out (run). The two agree when nothing is lost (verify/calc-test.js checks it over real matchups).
// a dice expression's distribution: value → probability (D3 is a D6 halved, rounding up: 1, 2, 3 alike)
function pmf(d){
  let p = new Map([[d.k, 1]]);
  for(let i = 0; i < d.n; i++){ const f = d.f, q = new Map(); for(const [v, w] of p) for(let x = 1; x <= f; x++) q.set(v + x, (q.get(v + x) || 0) + w / f); p = q; }
  return p;
}
function conv(p, q){ const r = new Map(); for(const [a, x] of p) for(const [b, y] of q) r.set(a + b, (r.get(a + b) || 0) + x * y); return r; }
const ex = (p, f) => { let t = 0; for(const [v, w] of p) t += w * f(v); return t; };
// one D6 roll with a re-roll: cls(u) → 0 fails, 1 succeeds, 2 critical. p[c]: the chance of each after the re-roll;
// n36: in 36ths; first: the counts of one roll (of 6); keep, re: the results kept and re-rolled
function oneRoll(cls, rr, fish){
  const first = [0, 0, 0], keep = [0, 0, 0], n36 = [0, 0, 0];
  for(let u = 1; u <= 6; u++) first[cls(u)]++;
  let re = 0;
  for(let u = 1; u <= 6; u++){ const c = cls(u);
    if((c === 0 && (rr === 'all' || (rr === '1s' && u === 1))) || (c === 1 && fish)){ re++; for(let x = 0; x < 3; x++) n36[x] += first[x]; }
    else { keep[c]++; n36[c] += 6; } }
  return { p:n36.map(x => x / 36), n36, first, keep, re };
}
// the one number format of the Damage screen and its working: whole numbers as they are; others rounded to one decimal
// first, and the decimal dropped when that is 10 or more (9.96 → "10", 9.94 → "9.9", 10 → "10", 5.333 → "5.3")
const fmt = x => { if(Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x)); const r = Math.round(x * 10) / 10; return Math.abs(r) >= 10 ? String(Math.round(x)) : r.toFixed(1); };
// the working's steps: enough digits that the numbers shown multiply out as shown: two decimals (one from 100, three
// significant digits below 1), rounded first; whole numbers as they are (10.5, 4.08, 0.833, 0.0133, 136.1, 12)
// (a number that is not whole never reads as one: 3.995 is "3.995", not "4", so a product shown with it still multiplies out)
const fmtStep = x => { if(Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
  const a = Math.abs(x), d = a >= 100 ? 1 : a >= 1 ? 2 : Math.min(6, 2 - Math.floor(Math.log10(a)));
  const r = +x.toFixed(d); return Math.abs(r - Math.round(r)) < 1e-12 ? String(+x.toFixed(d + 1)) : String(r); };
const fx = fmtStep;
const sgn = v => (v > 0 ? '+' : '-') + Math.abs(v);
// the chance in words: "4/6", or with a re-roll "(4/6 + 2/6 × 4/6 = 32/36)"
const frac = (r, ok) => { const succ = ok === 2 ? r.keep[2] : r.keep[1] + r.keep[2], f1 = ok === 2 ? r.first[2] : r.first[1] + r.first[2], n = ok === 2 ? r.n36[2] : r.n36[1] + r.n36[2];
  return r.re ? '(' + succ + '/6 + ' + r.re + '/6 × ' + f1 + '/6 = ' + n + '/36)' : f1 + '/6'; };
const pOf = (r, ok) => ok === 2 ? r.p[2] : r.p[1] + r.p[2];

function explain(input, orderIdx){
  const S = setup(input), ctx = S.ctx, tm = S.tm, tsrc = tm.src || {};
  const orders = ordersOf(S.groups), order = orderIdx || orders[0];
  const attached = S.rows.some(r => r.bodyguard);
  const T0 = Math.max(...S.rows.filter(r => !attached || r.bodyguard).map(r => r.T || parseInt(input.target.T, 10) || 1));
  const firstRow = S.rows[S.groups[order[0]].rows[0]];
  const precRow = S.precOn ? S.rows.find(r => r.char && r.name === ctx.precision) : null;
  const skillKey = ctx.ranged ? 'BS' : 'WS';
  const out = S.G.map((G, i) => {
    if(G.out || !G.n) return { attacks:0, hits:0, wounds:0, unsaved:0, mortals:0, dmg:0, out:G.out, steps:[] };
    const row = G.precision && precRow ? precRow : firstRow, M = { row, w:row.W };
    const T = T0, pl = plan(G, T, M, tm), st = [], k = G.k, why = G.why;
    // a value the printed weapon already includes from a rule (its from mark): named, so the datasheet's number is explained
    const inc = f => { if(why.set[f]) return ''; const r = [].concat((G.from || {})[f] || []); return r.length ? ' (includes ' + r.join(' and ') + ')' : ''; };
    const kf = key => k.from(key) ? ', from ' + k.from(key) : '';
    // half range, from the range after the rules that change it
    const halfTxt = G.rangeIn == null ? '' : G.rangeIn / 2 + '"' + (why.range.length ? ' (range ' + G.r0 + '"' + why.range.map(x => ' ' + sgn(x.v) + '" ' + x.src).join('') + ' = ' + G.rangeIn + '")' : '');
    // attacks (04.03): A per weapon (at least 1), + [RAPID FIRE] within half range, + [BLAST]/[CLEAVE]
    const pa = pmf(G.A), aEach = ex(pa, v => Math.max(RULE.minA, v + G.aPlus)), rapid = G.rapid ? diceMean(G.rapid) : 0;
    const attacks = G.n * (aEach + rapid + G.extra);
    // a die reads as a die: "A3" is 3 attacks, "A D6+2" a roll; "Damage: 3" is 3, "Damage: D3+2" a roll (never "DD3")
    let t = String(G.A0) + (why.set.A ? ' (' + why.set.A + ')' : inc('A')) + why.a.map(x => ' ' + sgn(x.v) + ' (' + x.src + ')').join('');
    if(G.A.n || why.a.length) t += ' = ' + fx(aEach) + (G.A.n ? ' on average' : '') + (G.aPlus < 0 ? ' (at least 1)' : '');
    t += ' × ' + fx(G.n) + ' = ' + fx(G.n * aEach);
    if(rapid) t += '; [' + k.text.rapid + '] within half range (' + halfTxt + ', 24.30' + kf('rapid') + '): +' + fx(rapid) + ' × ' + fx(G.n) + ' → ' + fx(G.n * (aEach + rapid));
    if(G.extra){ const kw = [k.blast ? '[' + k.text.blast + '] (24.05)' : '', k.cleave ? '[' + k.text.cleave + '] (24.06, all its attacks at this one unit)' : ''].filter(Boolean).join(' and ');
      t += '; ' + kw + ': ' + G.blastN + ' models in the target → +' + G.extra + ' × ' + fx(G.n) + ' → ' + fx(attacks); }
    st.push({ k:'attacks', t:'Attacks: ' + t });
    // hit roll (05.01)
    let pN, pC, hr = null;
    if(G.torrent){ pN = 1; pC = 0; st.push({ k:'hits', t:'Hit roll: [TORRENT] (24.37): every attack hits automatically, never a critical hit → ' + fx(attacks) + ' hits' }); }
    else {
      const cls = u => G.snap ? (u === RULE.snapHit ? 1 : 0) : (u === 1 || u < G.fail) ? 0 : u >= G.critHit ? 2 : u + G.hitMod >= G.bs ? 1 : 0;
      hr = oneRoll(cls, G.rrHit, pl.fishH); pN = hr.p[1]; pC = hr.p[2];
      const parts = [skillKey + ' ' + (G.skill0 >= 7 ? '–' : G.skill0 + '+') + (why.set[skillKey] ? ' (' + why.set[skillKey] + ')' : inc(skillKey))];
      for(const x of why.bs) parts.push(x.src + (x.v > 0 ? ': worse by 1' + (x.ignored ? ', ignored (' + G.ignoreSrc + ')' : '') : x.v < 0 ? ': better by 1' : ''));
      if(why.bs.some(x => x.v && !x.ignored) && G.skill0 < 7) parts.push('→ ' + G.bs + '+' + (G.bs === RULE.bestSkill || G.bs === RULE.worstSkill ? ' (BS/WS stay between 2+ and 6+)' : ''));
      for(const x of why.hit) parts.push(sgn(x.v) + ' to hit (' + x.src + ')' + (x.ignored ? ': ignored (' + G.ignoreSrc + ')' : ''));
      if(G.snap) parts.push('snap shooting (15.09): only an unmodified 6 hits, and it is not a critical hit');
      else {
        const need = Math.max(2, G.bs - G.hitMod);
        parts.push(need > 6 || G.skill0 >= 7 ? 'only a critical hit (an unmodified ' + G.critHit + (G.critHit < 6 ? '+' : '') + ') hits' : 'hits on an unmodified ' + need + '+ (an unmodified 1 always fails' + (need > G.critHit ? ', a critical hit always hits' : '') + ')');
        if(G.fail) parts.push('indirect shooting (10.07): an unmodified ' + (G.fail === 4 ? '1-3' : '1-5') + ' fails');
        if(G.critHit < 6) parts.push('critical hits on ' + G.critHit + '+ (' + G.critHitSrc + ')');
      }
      if(G.rrHit === 'all') parts.push('re-roll failed hit rolls (' + G.rrHitSrc + ')' + (pl.fishH ? ', and hits that are not critical, looking for a critical hit (worth more here)' : ''));
      else if(G.rrHit === '1s') parts.push('re-roll hit rolls of 1 (' + G.rrHitSrc + ')');
      if(G.noRr) parts.push('no hit re-rolls (' + G.noRr + ')');
      let h = 'Hit roll: ' + parts.join('; ') + ' · ' + fx(attacks) + ' × ' + frac(hr, 1) + ' = ' + fx(attacks * (pN + pC)) + ' hits';
      if(pC && (G.lethal || G.sus)) h += '; critical: ' + fx(attacks) + ' × ' + frac(hr, 2) + ' = ' + fx(attacks * pC);
      if(pC && G.lethal) h += pl.lethal ? '; [LETHAL HITS] (24.23' + (k.from('lethal') ? ', from ' + k.from('lethal') : '') + '): these wound automatically' : '; [LETHAL HITS]' + (k.from('lethal') ? ' (from ' + k.from('lethal') + ')' : '') + ' not taken: rolling to wound is worth more here (a critical wound with [DEVASTATING WOUNDS])';
      if(pC && G.sus){ const sm = diceMean(G.sus); h += '; [' + k.text.sus + '] (24.36' + (k.from('sus') ? ', from ' + k.from('sus') : '') + '): each critical hit adds ' + fx(sm) + (G.sus.n ? ' on average' : '') + ' → +' + fx(attacks * pC * sm) + ' → ' + fx(attacks * (pN + pC + pC * sm)); }
      st.push({ k:'hits', t:h });
    }
    const crit = attacks * pC, auto = pl.lethal ? crit : 0, toWound = attacks * pN + (pl.lethal ? 0 : crit) + crit * (G.sus ? diceMean(G.sus) : 0);
    // wound roll (05.02)
    const need = pl.need, wMod = pl.wMod, wcls = u => u === 1 ? 0 : u >= G.critWound ? 2 : u + wMod >= need ? 1 : 0;
    const wr = oneRoll(wcls, G.rrWound, pl.fishW);
    const devC = G.dev ? toWound * wr.p[2] : 0, normal = toWound * (wr.p[1] + (G.dev ? 0 : wr.p[2])) + auto;
    {
      const parts = [], sMods = why.s.map(x => ' ' + sgn(x.v) + ' (' + x.src + ')').join('');
      parts.push(G.S0 == null ? 'no S: S1 (02.04.01)' : 'S' + G.S0 + (why.set.S ? ' (' + why.set.S + ')' : inc('S')) + sMods + (sMods ? ' = ' + G.S : '') + (G.S0 + why.s.reduce((t, x) => t + x.v, 0) < 1 ? ' (at least 1)' : ''));
      const tNote = attached ? (S.rows.some(r => r.bodyguard && r.T) ? ' (the bodyguard models’ highest, 19.02)' : '') : S.rows.length > 1 && new Set(S.rows.map(r => r.T)).size > 1 ? ' (the highest in the unit, 05.02.01)' : '';
      const tRow = S.rows.find(r => (!attached || r.bodyguard) && r.T === T);
      parts[0] += ' vs T' + T + (tRow && tRow.tSrc ? ' (' + tRow.tSrc + ')' : '') + tNote + ' → ' + need + '+ (' + WOUND_WHY[need] + ')';
      for(const x of why.wound) parts.push(sgn(x.v) + ' to wound (' + x.src + ')');
      if(pl.sgt) parts.push(sgn(-pl.sgt) + ' to wound (' + (tsrc.woundMinusSgt || 'the target') + ': S' + G.S + ' greater than T' + T + ')');
      if(wMod){ const n2 = Math.max(2, need - wMod); parts.push(n2 > 6 ? 'only a critical wound wounds' : 'wounds on an unmodified ' + n2 + '+ (an unmodified 1 always fails)'); }
      if(G.critWound < 6) parts.push('critical wounds on ' + G.critWound + '+ (' + G.critWoundSrc + ')');
      if(G.rrWound === 'all') parts.push('re-roll failed wound rolls (' + G.rrWoundSrc + ')' + (pl.fishW ? ', and wounds that are not critical, looking for a critical wound (worth more here)' : ''));
      else if(G.rrWound === '1s') parts.push('re-roll wound rolls of 1 (' + G.rrWoundSrc + ')');
      let w = 'Wound roll: ' + parts.join('; ') + ' · ' + fx(toWound) + (auto ? ' rolled' : '') + ' × ' + frac(wr, 1) + ' = ' + fx(toWound * (wr.p[1] + wr.p[2]));
      if(auto) w += ' + ' + fx(auto) + ' automatic = ' + fx(normal + devC);
      w += Math.abs(normal + devC - 1) < 1e-9 && !auto ? ' wound' : ' wounds';
      if(G.dev) w += '; [DEVASTATING WOUNDS] (24.10' + (k.from('dev') ? ', from ' + k.from('dev') : '') + '): the critical ones, ' + fx(toWound) + ' × ' + frac(wr, 2) + ' = ' + fx(devC) + ', become mortal wounds (no save)';
      st.push({ k:'wounds', t:w });
    }
    // save roll (05.03, 05.04): the InSv when it is better, else Sv with AP; an unmodified 1 always fails
    const insv = Math.max(RULE.bestSave, Math.min(row.InSv || 7, tm.insv || 7)), sv = Math.max(RULE.bestSave, row.Sv || 7);
    const armour = sv - G.AP;   // needed on the dice
    const save = Math.max(2, Math.min(insv, armour));
    const sf = save > 6 ? 1 : (save - 1) / 6, unsaved = normal * sf;
    {
      const parts = [];
      const many = S.groups.length > 1;
      parts.push((G.precision && precRow ? row.name + ' ([PRECISION], 24.28)' : row.name + (many ? ' (the group the attacks meet first; when it is destroyed, the next group’s save is used)' : '')) + ': Sv ' + sv + '+');
      const apMods = why.ap.length ? why.ap.map(x => (x.v > 0 ? 'improved by ' + x.v : 'worsened by ' + -x.v) + ' (' + x.src + ')').join(', ') : '';
      parts.push('AP' + G.AP0 + (why.set.AP ? ' (' + why.set.AP + ')' : inc('AP')) + (apMods ? ' ' + apMods + ' → AP' + G.AP : '') + ' → ' + (armour > 6 ? 'no armour save' : 'saves on ' + armour + '+'));
      if(insv <= 6) parts.push('InSv ' + insv + '+' + (tm.insv && tm.insv <= (row.InSv || 7) ? ' (' + (tsrc.insv || 'the target') + ')' : '') + (insv < armour ? ' is better, so it is used' : ' is not better, so not used'));
      let sv2 = 'Save: ' + parts.join('; ') + ' · ' + fx(normal) + ' × ' + (save > 6 ? '6/6' : (save - 1) + '/6') + ' fail (an unmodified 1 always fails) = ' + fx(unsaved) + ' get through';
      if(devC) sv2 += '; with the ' + fx(devC) + ' mortal wounds: ' + fx(unsaved + devC);
      st.push({ k:'unsaved', t:sv2 });
    }
    // damage (05.04): D after its modifiers (at least 1); Feel No Pain for each wound (24.12)
    const pd = conv(pmf(G.D), G.melta ? pmf(G.melta) : new Map([[0, 1]]));
    const dN = ex(pd, v => Math.max(RULE.minDamage, v + G.dPlus - (tm.dMinus || 0))), dM = ex(pd, v => Math.max(RULE.minDamage, v + G.dPlus - (tm.dMinusChar || 0)));
    const fnp = Math.min(row.fnp || 7, tm.fnp || 7), fnpM = Math.min(fnp, row.fnpMortal || 7, tm.fnpMortal || 7);
    const keep = x => x <= 6 ? (x - 1) / 6 : 1;
    const dmgN = unsaved * dN * keep(fnp), dmgM = devC * dM * keep(fnpM);
    {
      const parts = [String(G.D0) + (why.set.D ? ' (' + why.set.D + ')' : inc('D')) + why.d.filter(x => !x.target).map(x => ' ' + sgn(x.v) + ' (' + x.src + ')').join('') + (G.melta ? ', and +' + diceText(G.melta) + ' with [' + k.text.melta + '] (within half range, ' + halfTxt + ', 24.25' + kf('melta') + ')' : '')];
      for(const x of why.d.filter(x => x.target)) parts.push(sgn(x.v) + ' Damage (' + x.src + ')');
      if(pd.size > 1 || G.dPlus || tm.dMinus) parts.push((pd.size > 1 ? fx(dN) + ' on average' : fx(dN) + ' each') + (ex(pd, v => v + G.dPlus - (tm.dMinus || 0)) < dN - 1e-9 ? ' (Damage at least 1)' : ''));
      const fsrc = fnp < 7 ? (row.fnp === fnp && row.fnpSrc ? row.fnpSrc : tsrc.fnp || 'the target') : '';
      if(fnp < 7) parts.push('Feel No Pain ' + fnp + '+ (' + fsrc + ', 24.12): ' + (7 - fnp) + '/6 of the wounds ignored');
      let d = 'Damage: ' + parts.join('; ') + ' · ' + fx(unsaved) + ' × ' + fx(dN) + (fnp < 7 ? ' × ' + (fnp - 1) + '/6' : '') + ' = ' + fx(dmgN);
      if(devC){ const msrc = fnpM < fnp ? (row.fnpMortal === fnpM && row.fnpMortalSrc ? row.fnpMortalSrc : tsrc.fnpMortal || 'the target') : '';
        const dmc = tm.dMinusChar || 0;
        d += '; mortal wounds: ' + fx(devC) + ' × ' + fx(dM) + (dM !== dN || dmc ? ' (D' + (dmc ? ' ' + sgn(-dmc) + ' (' + (tsrc.dMinusChar || 'the target') + ': its D characteristic)' : '') + ((tm.dMinus || 0) > dmc ? ', the target’s ' + sgn(dmc - tm.dMinus) + ' Damage not applied (24.10, 04.02.02)' : '') + ')' : '') + (fnpM < 7 ? ' × ' + (fnpM - 1) + '/6' + (msrc ? ' (Feel No Pain ' + fnpM + '+ against mortal wounds, ' + msrc + ')' : '') : '') + ' = ' + fx(dmgM); }
      d += (devC ? ' → ' + fx(dmgN + dmgM) : '') + ' damage before allocation' + (devC ? ' (played out, each critical wound’s mortal wounds damage one model at most, and the rest is lost: 24.10)' : '');
      st.push({ k:'dmg', t:d });
    }
    return { attacks, hits:toWound + auto, wounds:normal + devC, unsaved, mortals:devC, dmg:dmgN + dmgM, out:'', steps:st };
  });
  const sum = key => out.reduce((t, x) => t + x[key], 0);
  return { groups:out, total:{ attacks:sum('attacks'), hits:sum('hits'), wounds:sum('wounds'), through:sum('unsaved') + sum('mortals'), dmg:sum('dmg') },
    target:{ models:S.total, wounds:S.rows.reduce((t, r) => t + r.count * r.W, 0) }, T:T0, meets:firstRow.name };
}

const API = { run, play, resolve, explain, fmt, fmtStep, dice, diceMean, diceText, pmf, keywords, woundNeed, RULE };
root.WH_CALC = API;
if(typeof module !== 'undefined' && module.exports) module.exports = API;
// as a Web Worker (the app plays the effect of each choice there, off the page): { id, input } → run; { id, play } → play
else if(typeof window === 'undefined' && typeof importScripts === 'function') root.onmessage = e => { const m = e.data || {};
  try { root.postMessage({ id:m.id, r:m.ping ? 1 : m.play ? play(m.play) : run(m.input) }); } catch(err){ root.postMessage({ id:m.id, err:String(err) }); } };
})(typeof window !== 'undefined' ? window : globalThis);
