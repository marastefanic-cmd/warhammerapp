/* calc.js: the damage calculator's engine (Warhammer 40,000 11th edition attack sequence, section 05).

   It plays the attacks out many times with seeded dice, following the sequence as written:
     hit rolls (05.01) → wound rolls (05.02) → save rolls, all rolled together and resolved from the lowest
     result to the highest against the current allocation group (05.03, 05.04) → damage to one model per
     attack, excess lost; Feel No Pain per wound; [DEVASTATING WOUNDS] mortal wounds after the normal damage,
     one model each (24.10).
   It knows only numbers and keywords: which rules apply is decided by the caller (the app's toggles).
   verify/calc-test.js checks it against hand-worked cases; the gate runs that test.

   run(input) → result
     input.groups  [{ name, n (models with the weapon), A, skill ('4+'), S, AP, D, kw:[weapon keywords],
                      mod:{ hit, wound, a, s, ap, d, rrHit, rrWound ('1s'|'all'), critHit, critWound,
                            sus, lethal, dev, ignoresCover, lance, twin } }]   one group per identical attacks
     input.target  { T, kw:[keywords], models:[{ name, count, W, Sv, InSv, fnp, fnpMortal, char }],
                     mod:{ dMinus, dHalf, apWorse, hitMinus, woundMinus, fnp, insv } }
     input.ctx     { ranged, cover, halfRange, stationary, charged }
     input.sims (default 10000), input.seed (default 1)
   result: { sims, dmg (mean wounds lost), killed (mean models destroyed), models, wipe (P all destroyed),
             dist [P(exactly k destroyed)], groups:[{ attacks, hits, wounds, unsaved, mortals, dmg }] (means) } */
(function(root){
'use strict';

// rules constants the attack sequence uses (Core Rules 11th edition; see the comments where they are used)
const RULE = {
  hitCap: 1,        // a hit roll is modified by at most +1 / -1 in total
  woundCap: 1,      // likewise a wound roll
  critHit: 6,       // an unmodified 6 is a critical hit
  critWound: 6,     // an unmodified 6 is a critical wound
  minDamage: 1      // damage reductions cannot take an attack below 1
};

// dice expressions: "3", "D3", "D6+1", "2D6"
function dice(s){
  const t = String(s == null ? '' : s).trim().toUpperCase().replace(/\s+/g, '');
  const m = /^(\d*)D(\d+)(?:\+(\d+))?$/.exec(t);
  if(m) return { n:+(m[1] || 1), f:+m[2], k:+(m[3] || 0) };
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
const clamp = (v, c) => Math.max(-c, Math.min(c, v));
const skillOf = s => parseInt(String(s).replace(/[^\d]/g, ''), 10) || 7;   // "4+" → 4; "N/A" can't hit

// weapon keywords → numbers ("RAPID FIRE 2", "SUSTAINED HITS D3", "ANTI-MONSTER/VEHICLE 4+", "MELTA 2");
// a keyword the datasheet limits to some targets ("LETHAL HITS: non-MONSTER/VEHICLE", "DEVASTATING WOUNDS: INFANTRY")
// counts only against a target it names (tkw: the target's keywords, upper case)
function keywords(kw, tkw){
  const k = { anti:[] };
  for(const x0 of kw || []){
    let x = String(x0).toUpperCase().trim(), m;
    if((m = /^(.+?):\s*(NON-)?(.+)$/.exec(x))){
      const names = m[3].split('/').map(t => t.trim()), has = names.some(t => tkw && tkw.has(t));
      if(!tkw || (m[2] ? has : !has)) continue;
      x = m[1].trim();
    }
    if((m = /^RAPID FIRE (\S+)$/.exec(x))) k.rapid = dice(m[1]);
    else if((m = /^MELTA (\S+)$/.exec(x))) k.melta = dice(m[1]);
    else if((m = /^SUSTAINED HITS (\S+)$/.exec(x))) k.sus = dice(m[1]);
    else if((m = /^ANTI-(.+?) (\d)\+$/.exec(x))) k.anti.push({ kw:m[1].split('/'), v:+m[2] });
    else if(x === 'LETHAL HITS') k.lethal = true;
    else if(x === 'DEVASTATING WOUNDS') k.dev = true;
    else if(x === 'TWIN-LINKED') k.twin = true;
    else if(x === 'TORRENT') k.torrent = true;
    else if(x === 'BLAST') k.blast = true;
    else if(x === 'HEAVY') k.heavy = true;
    else if(x === 'LANCE') k.lance = true;
    else if(x === 'IGNORES COVER') k.ignoresCover = true;
    else if(x === 'PRECISION') k.precision = true;
    else if(x === 'PSYCHIC') k.psychic = true;
  }
  return k;
}
// the wound roll needed (05.02): S twice T or more 2+, greater 3+, equal 4+, less 5+, half or less 6+
const woundNeed = (S, T) => S >= 2 * T ? 2 : S > T ? 3 : S === T ? 4 : 2 * S <= T ? 6 : 5;

function run(input){
  const sims = input.sims || 10000, R = rng(input.seed || 1);
  const ctx = input.ctx || {}, tg = input.target, tm = tg.mod || {};
  const tkw = new Set((tg.kw || []).map(x => String(x).toUpperCase()));
  // allocation order (05.03): non-CHARACTER groups first, CHARACTER groups last
  const order = tg.models.filter(m => !m.char).concat(tg.models.filter(m => m.char));
  const total = order.reduce((t, m) => t + m.count, 0);
  const G = input.groups.map(g => {
    const k = keywords(g.kw, tkw), m = g.mod || {};
    const anti = k.anti.filter(a => a.kw.some(x => tkw.has(x))).reduce((v, a) => Math.min(v, a.v), 7);
    return {
      name:g.name, n:g.n || 1, A:dice(g.A), skill:skillOf(g.skill), S:(parseInt(g.S, 10) || 0) + (m.s || 0),
      AP:(parseInt(g.AP, 10) || 0) - (m.ap || 0) + (tm.apWorse || 0), D:dice(g.D), dPlus:m.d || 0, aPlus:m.a || 0, k, m,
      torrent:!!k.torrent, sus:m.sus ? dice(m.sus) : k.sus || null, lethal:!!(k.lethal || m.lethal), dev:!!(k.dev || m.dev),
      rrHit:m.rrHit || '', rrWound:(k.twin || m.twin) ? 'all' : (m.rrWound || ''),
      critHit:m.critHit || RULE.critHit, critWound:Math.min(m.critWound || RULE.critWound, anti),
      // hit roll modifiers: the rules' total, capped (01.05.03)
      hitMod:clamp((m.hit || 0) - (tm.hitMinus || 0) + (k.heavy && ctx.stationary ? 1 : 0), RULE.hitCap),
      // the benefit of cover worsens the attack's BS by 1 (13.08), unless [IGNORES COVER]
      bs:skillOf(g.skill) + (ctx.ranged && ctx.cover && !(k.ignoresCover || m.ignoresCover) ? 1 : 0),
      woundMod:clamp((m.wound || 0) - (tm.woundMinus || 0) + (k.lance && ctx.charged ? 1 : 0), RULE.woundCap),
      melta:k.melta && ctx.halfRange ? k.melta : null, rapid:k.rapid && ctx.halfRange ? k.rapid : null, blast:!!k.blast
    };
  });
  const T = parseInt(tg.T, 10) || 1;
  const sum = G.map(() => ({ attacks:0, hits:0, wounds:0, unsaved:0, mortals:0, dmg:0 }));
  const dist = new Array(total + 1).fill(0);
  let dmgTotal = 0, killedTotal = 0;
  // the target's models, in allocation order: wounds left, and the group each belongs to
  const fresh = () => { const out = []; for(const g of order) for(let i = 0; i < g.count; i++) out.push({ w:g.W, g }); return out; };
  for(let s = 0; s < sims; s++){
    const models = fresh();
    let cur = 0;            // the first model still alive (a wounded model is always the current one: excess damage is lost)
    let lost = 0;
    // one unsaved attack or one mortal-wound packet: damage to the current model, Feel No Pain per wound, excess lost
    const hurt = (dmg, mortal) => {
      if(cur >= models.length) return 0;
      const M = models[cur];
      // the best Feel No Pain that applies (one against mortal wounds only counts for them)
      let fnp = Math.min(M.g.fnp || 7, tm.fnp || 7);
      if(mortal) fnp = Math.min(fnp, M.g.fnpMortal || 7, tm.fnpMortal || 7);
      let w = 0;
      for(let i = 0; i < dmg; i++) if(!(fnp <= 6 && d6(R) >= fnp)) w++;
      const took = Math.min(w, M.w);
      M.w -= took; lost += took;
      if(M.w <= 0) cur++;
      return took;
    };
    G.forEach((g, gi) => {
      const S = sum[gi];
      if(cur >= models.length) return;
      // attack dice (04.03): A per weapon, + Rapid Fire at half range, + Blast per five models in the target
      let attacks = 0;
      const alive = models.length - cur;
      for(let i = 0; i < g.n; i++) attacks += roll(g.A, R) + g.aPlus + (g.rapid ? roll(g.rapid, R) : 0) + (g.blast ? Math.floor(alive / 5) : 0);
      S.attacks += attacks;
      // hit rolls (05.01)
      let hits = 0, autoWounds = 0;
      for(let i = 0; i < attacks; i++){
        if(g.torrent){ hits++; continue; }
        let r = d6(R);
        const hitOk = x => x !== 1 && (x >= g.critHit || x + g.hitMod >= g.bs);
        if(!hitOk(r) && (g.rrHit === 'all' || (g.rrHit === '1s' && r === 1))) r = d6(R);
        if(!hitOk(r)) continue;
        if(r >= g.critHit){
          if(g.lethal) autoWounds++; else hits++;
          if(g.sus) hits += roll(g.sus, R);
        } else hits++;
      }
      S.hits += hits + autoWounds;
      // wound rolls (05.02)
      const need = woundNeed(g.S, T);
      let wounds = autoWounds;
      const dev = [];
      for(let i = 0; i < hits; i++){
        let r = d6(R);
        const ok = x => x !== 1 && (x >= g.critWound || x + g.woundMod >= need);
        if(!ok(r) && (g.rrWound === 'all' || (g.rrWound === '1s' && r === 1))) r = d6(R);
        if(!ok(r)) continue;
        if(r >= g.critWound && g.dev) dev.push(1); else wounds++;
      }
      S.wounds += wounds + dev.length;
      // save rolls (05.03): all rolled together, then resolved from the lowest result (05.04)
      const saves = [];
      for(let i = 0; i < wounds; i++) saves.push(d6(R));
      saves.sort((a, b) => a - b);
      for(const r of saves){
        if(cur >= models.length) break;    // every model destroyed: excess attacks are lost
        const M = models[cur].g, insv = Math.min(M.InSv || 7, tm.insv || 7);
        const saved = r !== 1 && ((insv <= 6 && r >= insv) || (r + g.AP >= M.Sv));
        if(saved) continue;
        S.unsaved++;
        let dmg = roll(g.D, R) + g.dPlus + (g.melta ? roll(g.melta, R) : 0);
        if(tm.dHalf) dmg = Math.ceil(dmg / 2);
        if(tm.dMinus) dmg = Math.max(RULE.minDamage, dmg - tm.dMinus);
        S.dmg += hurt(dmg, false);
      }
      // [DEVASTATING WOUNDS]: mortal wounds equal to D after the normal damage, at most one model each
      for(let i = 0; i < dev.length; i++){
        if(cur >= models.length) break;
        S.mortals++;
        S.dmg += hurt(roll(g.D, R) + g.dPlus + (g.melta ? roll(g.melta, R) : 0), true);
      }
    });
    dmgTotal += lost; killedTotal += cur; dist[cur]++;
  }
  const mean = x => x / sims;
  return { sims, models:total, dmg:mean(dmgTotal), killed:mean(killedTotal), wipe:mean(dist[total]), dist:dist.map(mean),
    groups:sum.map(S => ({ attacks:mean(S.attacks), hits:mean(S.hits), wounds:mean(S.wounds), unsaved:mean(S.unsaved), mortals:mean(S.mortals), dmg:mean(S.dmg) })) };
}

const API = { run, dice, diceMean, keywords, woundNeed, RULE };
root.WH_CALC = API;
if(typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
