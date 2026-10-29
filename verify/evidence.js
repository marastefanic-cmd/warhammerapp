#!/usr/bin/env node
/* verify/evidence.js: the gate step "evidence": every box of the Damage tab is made by script from GW's words, and stands on them.

   The Damage tab's rule boxes are data.js BOXES (verify/effects-migrate.js --write: verify/effects-extract.js over every rule,
   ability and stratagem of the lists; effects.js the catalogue). No AI and no hand-written reading decides a box: which boxes a unit
   has comes from the database (its rules, its abilities, the other units of the list, the stratagems whose TARGET it meets), what a
   box does from the words. This step checks:

     G1  every effect and condition of every box is in the catalogue (effects.js FX, COND), its value in the effect's domain
     G2  every quote (and the line it continues) is a verbatim sentence of its source's GW text
     G3  every effect's own words are in its quote (or the line the quote completes): the catalogue's patterns find it there
     G4  completeness: every effect the patterns find in a source's sentences (not about attacks against the unit, not an enemy's) is
         in one of its boxes, or listed as not counted (a rare mechanic, effects.js NC, or a fixed reason)
     G5  every condition stands on its words: a catalogue condition's pattern in the quote or its line; the target's keywords and a
         reach's keywords are literal keywords of the lists in the source's text; a weapon a box names is a weapon of a unit with the
         source; "while this model is leading a unit" in a quote means its box says it
     G6  no Damage-tab reading field is left in data.js (calc, always, oneModel, dice, follow, onDeath on attack readings; calcMods,
         calcNc, both, limit on rules) and app.html's Damage tab reads no rule's words at run time (no dmEffects, no extractor, no
         note / when / calc of a reading)
     G7  data.js BOXES is exactly what the words give (node verify/effects-migrate.js --write)
     G8  every catalogue effect has a calc-test case (verify/calc-test.js: a case named 'fx:<id>'), and every custom modifier
     groups     every box of every list × unit × step is in exactly one of the five groups (DM_GROUPS)
     targets    every stratagem of the lists has a TARGET the closed patterns read (verify/derive.js stratNeeds, with this file's
                closed additions), its needs (what the app's canTarget reads) are what that TARGET says, and for every list × unit the
                stratagems shown are exactly those whose needs its keywords meet; one tag broken on purpose must make it fail (bite)

     node verify/evidence.js     the gate step; writes verify/out/evidence.json */
'use strict';
const fs = require('fs'), path = require('path');
const { ROOT, loadData } = require('./lib');
const E = require('../effects.js');
const X = require('./effects-extract');
const M = require('./effects-migrate');
const Dv = require('./derive');

// (the lists as the app's own code has them: verify/damage-node.js, so a unit is one the app's canTarget knows)
const dm = require('./damage-node')();
const D = dm.D, V = Dv.vocab(D), fails = [], stats = {};
const fail = (g, where, what) => fails.push(g + ' ' + where + ': ' + what);
const flat = s => X.plainCase(s).toLowerCase();
const T = M.build(D), S = M.sources(D);

// ---- G1, G2, G3, G5 over every box ----
const boxesOf = o => (o.b || []).flatMap(b => b.pick ? b.pick.map(p => Object.assign({ pill:true, parent:b }, p, { kind:b.kind, scope:b.scope, reach:b.reach, on:(b.on || []).concat(p.on || []), lead:p.lead || b.lead })) : [b]);
const domOk = (id, p) => { const f = E.FX[id]; if(!f) return false; if(f.dom === 'anti') return /^(?:NON-)?[A-Z][A-Z /-]* \d\+$/.test(String(p)); return f.dom.some(x => String(x) === String(p)); };
let nBox = 0, nPill = 0;
for(const [key, o] of Object.entries(T)){
  const src = S.get(key), text = flat((src.table ? M.ruleText(src) : src.text || '') + (src.tagText ? '\n' + src.tagText : '')), where = key + ' ' + o.n;
  for(const b of boxesOf(o)){
    if(b.pill) nPill++; else nBox++;
    // G1
    for(const [id, p] of b.fx || []) if(!domOk(id, p)) fail('G1', where, 'effect ' + id + ' ' + JSON.stringify(p) + ' not in the catalogue or its domain');
    for(const [id] of b.on || []) if(!E.COND[id]) fail('G1', where, 'condition ' + id + ' not in the catalogue');
    // G2: verbatim (the lines of a bullet list, each)
    for(const q of String(b.quote || '').split('\n').concat(b.lead ? b.lead.split('\n') : [])) if(!text.includes(flat(q).replace(/\s*\.\s*$/, ''))) fail('G2', where, 'not GW’s words: “' + q.slice(0, 80) + '”');
    // G3: the effects are the quote's (or the line's it completes)
    const qn = E.norm(b.quote), found = String(b.quote).split('\n').map(q => q.replace(/^-\s+/, '')).flatMap(q => X.findFx(E.norm(q)).fx.concat(b.lead ? X.findFx(E.norm(b.lead + ' ' + q)).fx : []));
    for(const [id, p] of b.fx || []) if(!found.some(([i2, p2]) => i2 === id && String(p2) === String(p))) fail('G3', where, id + ' ' + p + ' is not in its quote “' + String(b.quote).slice(0, 80) + '”');
    // G5: conditions on their words
    const ctxT = E.norm([b.quote, b.lead || '', src.when || '', src.target || '', src.table ? M.ruleText(src) : src.text || '', src.tagText || '', src.tag || '', src.pickOf ? src.pickOf.text : ''].join(' '));
    for(const [id, p] of b.on || []){
      const c = E.COND[id]; if(!c) continue;
      if(c.pats.length && !c.pats.some(re => re.test(ctxT))) fail('G5', where, 'condition ' + id + ' has no words in its source');
      if(id === 'targetKw') for(const k of [].concat(p.any || [], p.all || [], p.none || [])) if(!text.includes(String(k).replace(/^Faction: /, '').toLowerCase().replace(/s$/, ''))) fail('G5', where, 'the target keyword ' + k + ' is not in its words');
      if(id === 'q' && !text.includes(flat(p).toLowerCase())) fail('G5', where, 'quoted condition not verbatim: ' + p);
    }
    if(/\[[A-Za-z0-9 -]+:\s*(?:non-)?[A-Za-z][^\]]*\]/.test(String(b.quote)) && (b.fx || []).length && !(b.on || []).some(x => x[0] === 'targetKw')) fail('G5', where, 'a weapon ability for some targets only (“[X: KEYWORD]”) and no target keyword condition');
    if(/\bwhile this (?:model|unit) is leading a unit\b/.test(E.norm(b.quote)) && !(b.on || []).some(x => x[0] === 'leading')) fail('G5', where, '"while this model is leading a unit" and no leading condition');
    for(const k of [].concat(((b.reach || {}).all) || [], ((b.reach || {}).any) || [], ((b.reach || {}).none) || [])) if(!text.includes(String(k).replace(/^Faction: /, '').toLowerCase().replace(/s$/, ''))) fail('G5', where, 'reach keyword ' + k + ' is not a literal keyword of its words');
    const sc = b.scope || {};
    if(sc.weapon && src.type !== 'strat' && !E.norm(b.quote).includes('attack with a ' + sc.weapon) && !E.norm(b.quote).includes('attack with an ' + sc.weapon) && !src.weapons.some(w => String(w).toLowerCase().replace(/[’']/g, "'").startsWith(sc.weapon) || String(w).toLowerCase().split(/\s+/)[0] === sc.weapon.split(/\s+/)[0])) fail('G5', where, 'weapon ' + sc.weapon + ' is no weapon of a unit with it');
  }
  for(const x of o.nc || []) if(!text.includes(flat(x.quote).replace(/\s*\.\s*$/, ''))) fail('G2', where, 'not counted, not GW’s words: “' + x.quote.slice(0, 80) + '”');
}
stats.boxes = nBox; stats.picks = nPill; stats.sources = Object.keys(T).length;
// G1 (the schema): a box, a pick, a scope, a limit, a part, a source carry the fields the script writes and no other (a hand note on a box
// fails), in what the words give (T) and in data.js BOXES alike
{ const SRC_KEYS = new Set(['b', 'n', 'reach', 'nc', 'both', 'embarked']), BOX_KEYS = new Set(['quote', 'fx', 'on', 'kind', 'lead', 'scope', 'reach', 'mark', 'lasts', 'opt', 'pick', 'tableRows', 'limit', 'part', 'notSelf', 'pool', 'excl']),
    PICK_KEYS = new Set(['name', 'fx', 'quote', 'on', 'lead', 'part']), SCOPE_KEYS = new Set(['models', 'weapon', 'part', 'wkw']), LIMIT_KEYS = new Set(['n', 'what']),
    PART_KEYS = new Set(['on', 'fx', 'quote']), NC_KEYS = new Set(['quote', 'why']), BOTH_KEYS = new Set(['names', 'quote', 'reach', 'mark', 'opt', 'lasts']);
  const extra = (o, keys) => Object.keys(o || {}).filter(k => !keys.has(k));
  for(const [name, TT] of [['the words', T], ['data.js BOXES', D.boxes || {}]]) for(const [key, o] of Object.entries(TT)){ const where = key + ' ' + (o.n || '') + ' (' + name + ')';
    const bad = [];
    bad.push(...extra(o, SRC_KEYS));
    for(const b of o.b || []){ bad.push(...extra(b, BOX_KEYS), ...extra(b.scope, SCOPE_KEYS), ...extra(b.limit, LIMIT_KEYS), ...extra(b.part, PART_KEYS));
      for(const p of b.pick || []) bad.push(...extra(p, PICK_KEYS), ...extra(p.part, PART_KEYS)); }
    for(const x of o.nc || []) bad.push(...extra(x, NC_KEYS));
    for(const x of o.both || []){ bad.push(...extra(x, BOTH_KEYS)); if(!flat(S.get(key) ? S.get(key).text || '' : '').includes(flat(x.quote).replace(/\s*\.\s*$/, ''))) bad.push('both: not GW’s words'); }
    if(bad.length) fail('G1', where, 'fields no script writes: ' + [...new Set(bad)].join(', ')); } }

// ---- G4: every effect the sentences state is in a box (or not counted) ----
for(const [key, src] of S){
  const o = T[key] || {}, have = boxesOf(o).flatMap(b => (b.fx || []).concat(b.part ? b.part.fx : [])).map(([i, p]) => i + ':' + p).concat((o.b || []).flatMap(b => b.pick ? b.pick.flatMap(p => (p.part ? p.part.fx : [])) : []).map(([i, p]) => i + ':' + p));
  const ncQ = (o.nc || []).map(x => E.norm(x.quote));
  let defPrev = false;
  for(const u of X.unitsOf(src)){
    const n = E.norm(u.s);
    // (about attacks against the unit, or an enemy's, and a sentence continuing one: "If that Battle-shock test was failed, … as well")
    if(X.DEFENCE.some(re => re.test(n)) || (defPrev && (/^if\b/.test(n) || /\bas well\.?$/.test(n)))){ defPrev = true; continue; }
    defPrev = false;
    if(/\b\d+" a[\dd]+ (?:bs|ws)\d\+|\bmelee a[\dd]+ ws\d\+/.test(n)) continue;    // a weapon's profile line
    if(src.type === 'strat' && /\bthat was just destroyed\b/.test(E.norm(src.target))) continue;
    if(ncQ.some(q => q.includes(n.slice(0, 40)))) continue;
    if(/\bselect one (?:visible )?enemy unit\b/.test(E.norm(u.prevS || '')) && /\b(?:models in that unit|that unit's)\b/.test(n) && !/\btargets? that (?:enemy )?unit\b/.test(n)) continue;
    for(const [id, p] of X.findFx(n).fx) if(!have.includes(id + ':' + p) && !have.some(h => h.startsWith(id + ':'))) fail('G4', key + ' ' + src.name, id + ' ' + p + ' in “' + u.s.slice(0, 90) + '” is in no box');
  }
}

// ---- G6: no Damage-tab reading field left; the Damage tab reads no words ----
const RETIRED_R = ['calc', 'always', 'oneModel', 'dice', 'follow', 'onDeath'], RETIRED_RULE = ['calcMods', 'calcNc', 'both', 'limit'];
const readingsOf = x => ['mods', 'aura'].flatMap(k => x[k] || []).concat(x.mod ? [x.mod] : [], x.help && x.help.mod ? [x.help.mod] : [], (x.parts || []).filter(p => p.mod).map(p => p.mod));
for(const a of D.armies) for(const u of a.units) for(const m of readingsOf(u)) for(const k of RETIRED_R) if(m[k] !== undefined) fail('G6', a.id + '/' + u.id, 'reading of ' + m.from + ' keeps ' + k);
for(const f of Object.values(D.factions)){
  for(const r of (f.armyRules || []).concat(Object.values(f.detachments || {}).flatMap(d => (d.rule ? [d.rule] : []).concat(d.moreRules || [])))){
    for(const k of RETIRED_RULE) if(r[k] !== undefined && !(k === 'limit' && typeof r[k] === 'string')) fail('G6', f.name + ' · ' + r.name, 'keeps ' + k);
    for(const m of readingsOf(r)) for(const k of RETIRED_R) if(m[k] !== undefined) fail('G6', f.name + ' · ' + r.name, 'reading keeps ' + k); }
  for(const d of Object.values(f.detachments || {})) for(const s of d.stratagems || []) for(const m of readingsOf(s)) for(const k of RETIRED_R) if(m[k] !== undefined) fail('G6', f.name + ' · ' + s.name, 'reading keeps ' + k);
}
for(const s of D.coreStratagems) if(s.calcMods) fail('G6', 'Core · ' + s.name, 'keeps calcMods');
{ const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  // (the whole Damage tab: its boxes, its screen and its drawing, up to the rules questions)
  const dm = (html.split('/* ---------- screen: damage ----------')[1] || '').split('/* ---------- rules questions (Claude)')[0];
  // (but the code that only shows GW's words, a quote: dmQuoteOf, and a quote: '“' + … built for display)
  const dmNoQuote = dm.split('\n').filter(l => !/^const dmQuoteOf\b/.test(l) && !/\bquote:'“' \+/.test(l) && !/text:'“' \+ dmQuoteOf\(/.test(l)).join('\n');
  if(/\bdmEffects\b|\bdmScope\b|\bdmByHand\b|WH_EFFECTS\.norm\b|\.extract\(/.test(dm)) fail('G6', 'app.html', 'the Damage tab reads a rule’s words at run time (dmEffects, dmScope, dmByHand, the extractor)');
  for(const [re, what] of [[/\bm\.note\b/, 'a reading’s note'], [/\bm\.when\b/, 'a reading’s when'], [/\bm\.calc\b/, 'a reading’s calc'], [/\.calcMods\b/, 'calcMods'], [/\b(?:au|u|x|src)\.(?:mods|aura|help|shield|readOf|calcDef|defCalc)\b/, 'a unit’s readings (mods, aura, help, shield, calcDef, defCalc)'], [/\.damaged\b|\bab\.embarked\b/, 'an ability’s damaged or embarked reading'], [/\.(?:test|exec|match|matchAll|search|replace|split)\(\s*(?:String\()?[\w.]*\b(?:ab|r|s|S\.ab|S\.s|x|y|m)\.(?:text|effect|target|when)\b|\b(?:ab|r|s|x|y)\.(?:text|effect|target|when)\b[^;\n]*\.(?:match|search|test|exec)\(/, 'a regex over a rule’s words at run time']]) if(re.test(dmNoQuote)) fail('G6', 'app.html', 'the Damage tab reads ' + what);
  if(!/<script src="effects\.js"><\/script>/.test(html)) fail('G6', 'app.html', 'effects.js is not loaded'); }

// ---- G7: BOXES is what the words give ----
{ const sorted = o => o && Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
  if(JSON.stringify(sorted(D.boxes || null)) !== JSON.stringify(sorted(JSON.parse(JSON.stringify(T))))) fail('G7', 'data.js', 'BOXES is not what the words give: node verify/effects-migrate.js --write'); }

// ---- G8: a calc-test case for every catalogue effect ----
{ const ct = fs.readFileSync(path.join(ROOT, 'verify/calc-test.js'), 'utf8');
  for(const id of Object.keys(E.FX)) if(!ct.includes("'fx:" + id + "'") && !ct.includes("'fx:" + id + ' ') && !ct.includes("'fx:" + id + ':')) fail('G8', 'effects.js', id + ' has no calc-test case (a case named fx:' + id + ')');
  if(!ct.includes("'custom modifiers:")) fail('G8', 'effects.js', 'no calc-test case for the custom modifiers'); }

// ---- the five groups, and the stratagems by TARGET ----
const GROUPS = new Set(dm.app.DM_GROUPS.map(g => g[0]));
// the closed TARGET patterns: verify/derive.js stratNeeds, with struck-out words dropped (errata), "Unit" in any case, "Your **X**."
// as one X unit from your army, "One **A** or **B C** unit" with each bold run one keyword, "(excluding **A B** units)" a bold run one
// keyword when its words are not each one
const titleCase = s => s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
const spanKw = span => { const w = span.trim(), all = Dv.tokens(V, w); return all.length && all.every(k => V.get(String(k).replace(/^Faction: /, '').toLowerCase())) ? all : [titleCase(w)]; };   // (a keyword no unit of the faction has, Wahapedia's struck MONSTER: its own word)
function targetNeeds(s){
  let t = String(s.target).replace(/~~([^~*]+)~~/g, '**$1**').replace(/~~/g, '').replace(/\bUnit\b/g, 'unit').replace(/^Your (\*\*[^*]+\*\*)\.?$/, 'One $1 unit from your army.');
  const s2 = Object.assign({}, s, { target:t });
  let r = Dv.stratNeeds(V, s2);
  const first = t.split(/(?<=\.)\s+/)[0];
  let m;
  if(r.how === 'none' && (m = /^One ((?:\*\*[^*]+\*\*)(?:\s+or\s+\*\*[^*]+\*\*)+) units? from your army\b/.exec(first))){
    const spans = [...m[1].matchAll(/\*\*([^*]+)\*\*/g)].map(x => x[1]);
    r = { how:'explicit', needs:{ all:[], any:spans.map(x => spanKw(x)).map(ks => ks.length === 1 ? ks[0] : null), none:[] }, reasons:[{ rule:'closed: one bold run each', match:m[0] }] };
    if(r.needs.any.some(x => !x)) r = { how:'none', reasons:[{ rule:'unparsed', match:first }] };
  }
  // "(excluding **PINK HORRORS** units)": each bold run one keyword; a run whose words the lists keep as keywords of their own (a
  // unit with Pink and Horrors) is a unit with all of them (unless)
  if(r.how !== 'none' && (m = /\(excluding ([^)]*)\)/.exec(first))){
    const runs = [...m[1].matchAll(/\*\*([^*]+)\*\*/g)].flatMap(x => x[1].split(/\s*\/\s*/)), none = [], unless = [];
    for(const w of runs){ const ks = spanKw(w); if(ks.length > 1 && !/^Faction: /.test(ks[0])) unless.push(ks); else none.push(...ks); }
    if(runs.length){ r.needs.none = none; if(unless.length === 1) r.needs.unless = { all:unless[0] }; else if(unless.length) r = { how:'none', reasons:[{ rule:'unparsed', match:m[0] }] }; } }
  return r;
}
const allStrats = [];
for(const [fk, f] of Object.entries(D.factions)) for(const d of Object.values(f.detachments || {})) for(const s of d.stratagems || []) allStrats.push({ s, fk, where:f.name + ' · ' + d.name + ' · ' + s.name });
for(const s of D.coreStratagems) allStrats.push({ s, fk:null, where:'Core · ' + s.name });
// (a keyword every unit of the faction's lists has, its Faction keyword, says nothing about which of them: compared without it, as
// verify/derive.js compares)
const everyKw = fk => { if(!fk) return null; const us = D.armies.filter(a => a.faction === fk).flatMap(a => a.units); if(!us.length) return null;
  return new Set(us[0].kw.map(k => k.toLowerCase()).filter(k => us.every(u => u.kw.some(x => x.toLowerCase() === k)))); };
const parsed = new Map();
let unparsed = 0, differ = 0;
for(const { s, fk, where } of allStrats){
  const r = targetNeeds(s);
  if(r.how === 'none'){ unparsed++; fail('targets', where, 'its TARGET is not read by the closed patterns: “' + X.plainCase(s.target) + '”'); continue; }
  parsed.set(s, r.needs);
  const ev = everyKw(fk), a = JSON.stringify(Dv.canonNeeds(s.needs, ev)), b = JSON.stringify(Dv.canonNeeds(Dv.tidyNeeds(r.needs), ev));
  if(a !== b){ differ++; fail('targets', where, 'needs ' + a + ' but its TARGET says ' + b + ': “' + X.plainCase(s.target) + '”'); }
}
// for every list × unit: the stratagems shown are those its keywords meet (the needs parsed from TARGET); a tag broken on purpose bites
const meets = (n, u) => dm.app.matches(n, u);
let unitsChecked = 0, groupBad = 0;
const shownOf = (a, u) => new Set(dm.app.inArmy(a, () => dm.app.dmSources(a, u)).filter(x => x.grp === 'strat').map(x => x.s.id));
const wantOf = (a, u) => new Set(dm.app.inArmy(a, () => dm.app.allStratagems()).filter(s => parsed.has(D.coreStratagems.find(c => c.id === s.id) || s) || true).filter(s => { const src = allStrats.find(x => x.s.id === s.id && x.s.name === s.name); const n = src && parsed.get(src.s); return n ? meets(Dv.tidyNeeds(n), u) : false; }).map(s => s.id));
for(const a of D.armies) for(const u of a.units){
  unitsChecked++;
  const sh = shownOf(a, u), want = wantOf(a, u);
  const miss = [...want].filter(x => !sh.has(x)), extra = [...sh].filter(x => !want.has(x));
  if(miss.length || extra.length) fail('targets', a.id + '/' + u.id, 'stratagems shown ≠ by TARGET: missing ' + miss.join(', ') + '; extra ' + extra.join(', '));
  for(const ph of ['shooting', 'fight']){ const c = dm.calc({ army:a.id, ph, atk:u.id }); if(!c || c.au.id !== u.id) continue;
    for(const r of c.rules){ const g = dm.app.dmGroupOf(r); if(!GROUPS.has(g)){ groupBad++; fail('groups', a.id + '/' + u.id + '/' + ph, r.m.from + ' is in no group (' + g + ')'); } }
    // (and its not-counted list: each in one group)
    for(const x of c.nc) if(x.grp && !GROUPS.has(x.grp)){ groupBad++; fail('groups', a.id + '/' + u.id + '/' + ph, x.name + ': not counted, in no group'); } }
}
// sources: for every list × unit, the army, unit and other-units groups have exactly the sources the database gives, worked out here
// from data.js alone: the unit's own abilities (not its Damaged bands) and the core rules of its weapons and Rules line that have boxes;
// the army rules on its Rules line (or a detachment rule of the list gives it: GRANTS; or an army rule of the list whose box reaches it)
// and the detachment rules whose needs it meets; the other units' abilities whose boxes reach it (or GW tags (Aura) and their reach meets)
const hasK = (u, k) => u.kw.some(x => x.toLowerCase() === String(k).toLowerCase());
const meetsN = (n, u) => !n || ((!n.all || n.all.every(k => hasK(u, k))) && (!n.any || !n.any.length || n.any.some(k => hasK(u, k))) && (!n.none || !n.none.some(k => hasK(u, k))) && (!n.unless || !meetsN(n.unless, u)));
const rn = x => String(x).toLowerCase().replace(/[’']/g, "'");
const boxOf = k => (D.boxes || {})[k];
function wantSources(a, u){
  const F = D.factions[a.faction], dets = a.detachments.map(id => F.detachments[id]).filter(Boolean), detR = dets.flatMap(d => (d.rule ? [d.rule] : []).concat(d.moreRules || []));
  const own = r => (u.rules || []).some(x => rn(x) === rn(r.name)), granted = r => (D.grants || []).some(g => g.type === 'ability' && g.grants === r.name && g.to && meetsN(g.to, u) && detR.some(d => String(g.rule).endsWith('· ' + d.name)));
  const reachB = (o, x) => ((o || {}).b || []).some(b => b.reach && meetsN(b.reach, x));
  const army = new Set(), unit = new Set(), other = new Set();
  for(const r of F.armyRules || []) if(own(r) || granted(r) || (a.units.some(x => (x.rules || []).some(y => rn(y) === rn(r.name))) && reachB(boxOf(M.KEY.rule(r)), u))) army.add(r.name);
  for(const r of detR) if(r.needs && meetsN(r.needs, u)) army.add(r.name);
  for(const ab of u.abilities || []) if(!/^Damaged: /i.test(ab.name)) unit.add(ab.name);
  for(const w of [].concat(u.ranged || [], u.melee || [])) for(const k of w.kw || []){ const n = Object.keys(D.rules).find(r => r.toLowerCase() === String(k).toLowerCase()); if(n && boxOf(M.KEY.core(n, D.rules[n]))) unit.add(n); }
  for(const r of u.rules || []){ if(!/\d/.test(r) || D.rules[r]) continue; const t = M.coreText(D, r); if(t && boxOf(M.KEY.core(r, t))) unit.add(r); }
  const ownKeys = new Set((u.abilities || []).map(ab => M.KEY.ability(ab)));
  for(const x of a.units) if(x !== u) for(const ab of x.abilities || []){ const k = M.KEY.ability(ab), o = boxOf(k); if(!o || ownKeys.has(k)) continue;
    if(reachB(o, u) || (/\baura\b/i.test(ab.tag || '') && o.reach && meetsN(o.reach, u))) other.add(ab.name); }
  // (and a stratagem of the list this unit is not the TARGET of but another unit is, its words reaching this unit: Daemonic Fury)
  const strats = allStrats.filter(x => !x.fk || a.faction === x.fk && a.detachments.some(id => (F.detachments[id].stratagems || []).includes(x.s))).map(x => x.s);
  for(const s of strats){ const n = parsed.get(s); if(!n || meetsN(n, u) || !a.units.some(x => x !== u && meetsN(n, x))) continue;
    if(reachB(boxOf(M.KEY.strat(s)), u)) other.add(s.name); }
  return { army, unit, other };
}
let srcBad = 0;
for(const a of D.armies) for(const u of a.units){
  const want = wantSources(a, u), got = { army:new Set(), unit:new Set(), other:new Set() };
  for(const x of dm.app.inArmy(a, () => dm.app.dmSources(a, u))) if(got[x.grp]) got[x.grp].add(x.name);
  for(const g of ['army', 'unit', 'other']){ const miss = [...want[g]].filter(n => !got[g].has(n)), extra = [...got[g]].filter(n => !want[g].has(n));
    if(miss.length || extra.length){ srcBad++; fail('sources', a.id + '/' + u.id + ' ' + g, 'missing ' + miss.join(', ') + '; extra ' + extra.join(', ')); } }
}
stats.sourcesChecked = D.armies.reduce((t, a) => t + a.units.length, 0);
// bite: one stratagem's needs changed on purpose must make the check above fail
{ const a = D.armies[0], u = a.units[0], s = dm.app.inArmy(a, () => dm.app.allStratagems()).find(x => x.needs && Object.keys(x.needs).length && x.src !== 'Core');
  const real = D.factions[a.faction].detachments[a.detachments.find(id => (D.factions[a.faction].detachments[id].stratagems || []).some(y => y.id === s.id))].stratagems.find(y => y.id === s.id);
  const keep = real.needs; real.needs = matches0(keep, u) ? { all:['No Such Keyword'] } : {};
  const bit = [...shownOf(a, u)].includes(s.id) !== [...wantOf(a, u)].includes(s.id);
  real.needs = keep;
  if(!bit) fail('targets', 'bite', 'a stratagem tag broken on purpose (' + s.name + ') went unnoticed');
  stats.bite = bit ? 'a broken tag on ' + s.name + ' is caught' : 'NOT caught'; }
function matches0(n, u){ return dm.app.matches(n, u); }
stats.strats = allStrats.length; stats.unparsed = unparsed; stats.needsDiffer = differ; stats.units = unitsChecked;

fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive:true });
fs.writeFileSync(path.join(ROOT, 'verify/out/evidence.json'), JSON.stringify({ stats, fails }, null, 1));
console.log('evidence: ' + (fails.length ? fails.length + ' failure(s); ' : '') + stats.sources + ' sources, ' + stats.boxes + ' boxes and ' + stats.picks + ' picks made by script from GW’s words (G1-G8); the army, unit and other-units groups of ' + stats.sourcesChecked + ' units as the database gives them; ' +
  stats.strats + ' stratagems read from their TARGET, shown for ' + stats.units + ' units exactly as their keywords meet it (' + stats.bite + ')');
for(const f of fails.slice(0, 60)) console.log('  FAIL ' + f);
process.exit(fails.length ? 1 : 0);
