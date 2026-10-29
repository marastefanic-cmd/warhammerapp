// verify/effects-extract.js: GW's text of a rule → the Damage tab's boxes, by fixed code only (no AI, no hand-written reading).
//
//   extract(src, ctx) → { boxes:[box], nc:[{ quote, why }], reach }   src: { name, text, table, type ('ability' | 'rule' | 'strat' |
//   'core'), tag }; ctx: { V (verify/derive.js vocab), weapons:[weapon names of the datasheet(s) with the ability] }
//
// A box: { quote (the verbatim sentence of GW's text it reads), lead (the verbatim line it continues, when it has one), fx:[[id, value]]
// (effects.js FX), on:[[id, value]] (effects.js COND), kind ('ranged' | 'melee' | 'all'), scope: { weapon (a weapon's name or the head
// word of its name), wkw (a weapon keyword), models ('model' | 'one' | 'char' | 'nonchar'), part (the models of an attached unit it
// names) }, reach (the friendly units it reaches: { all, any, none }, a rule or another unit's ability), mark ('aura' | 'selected' |
// 'friendly': how it reaches them), notSelf, lasts ('turn' | 'round' | 'battle'), opt (the option of its rule it is), pick:[pill]
// (one of several: each { name, quote, fx, on }), part:{ on, fx } (a part counted only while a fact holds), limit (how many of its
// rule's boxes can be active at once, its words: "up to two") }.
//
// The text is read structurally: its lines, bullets ("- "), the line a bullet list hangs from (ending ":"), options (a table's rows,
// "**Name:**", a line in bold only), "select one of the following" / "Or:" / "select either the X or Y ability" / ", or … instead"
// (a pick), sentences, and a sentence that continues the one before it ("If that attack …, … as well", "… instead"). A sentence is a
// box when the effects.js patterns find an effect in it, unless it is about attacks against the unit (DEFENCE) or an exclusion.
'use strict';
const E = require('../effects.js');
const Dv = require('./derive');
const { FX, COND, NC, CHAR_RE, CH, norm } = E;

// GW's words as said on a box: no bold, plain quotes, case kept
const plainCase = t => String(t == null ? '' : t).replace(/\*\*|~~|__/g, '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—−]/g, '-').replace(/\s+/g, ' ').trim();
// attacks against the unit, or an enemy's: not this unit's attacks (the defence side is not in the Damage tab)
const DEFENCE = [/\beach time an? (?:enemy )?(?:ranged |melee |psychic )?attack (?:is made against|targets) (?:this|that|your|the bearer)\b/,
  /\b(?:ranged |melee |psychic )?attacks (?:that )?targets? (?:this|your|that) (?:unit|model)\b/, /\ban? (?:enemy )?model makes an attack that targets (?:this|your|that) unit\b/,
  /\bin that enemy unit makes an? (?:\w+ )?attack\b/, /\bis allocated to (?:this|a model in this|the bearer)\b/, /\bselected as the target of an attack\b/, /\bwhen an enemy unit targets this unit\b/,
  /\bwhile an enemy unit\b/, /\benemy unit\b[^.]*?\btargets this (?:model|unit)\b/, /\battacks made against your unit\b/, /\benemy unit's (?:ranged |melee )?weapons have\b/];
// a sentence that picks one of several ("select one of the following", "select either the X or Y ability")
const PICK_LEAD = /\b(?:select|choose) one of the (?:following|abilities listed below|doctrina imperatives below)\b|\bcan have:$|\bselect one of the following\b/;
// how long it lasts (the Damage tab carries a tick from the shooting into the fight)
const lastsOf = n => /\buntil the end of the battle\b(?! round)/.test(n) ? 'battle' : /\buntil the (?:start of your next (?:command|movement) phase|end of the battle round)\b/.test(n) ? 'round' : /\buntil the end of the turn\b|\bthis turn\b/.test(n) && !/\buntil the end of the phase\b/.test(n) ? 'turn' : '';
const kindOf = n => { const r = /\branged (?:attacks?|weapons?)\b|\bshooting phase\b|\bselected to shoot\b|\bshoot\b/.test(n), m = /\bmelee (?:attacks?|weapons?)\b|\bfight phase\b|\bselected to fight\b|\bfight\b/.test(n);
  return r && !m ? 'ranged' : m && !r ? 'melee' : r && m ? 'all' : ''; };

// the effects a normalised sentence states: [[id, value]], in its order (each span read once)
function findFx(n){
  let t = ' ' + n.replace(/\(excluding [^)]*\)/g, ' ') + ' ';
  const out = [], at = [];
  const take = (re, f) => { const g = new RegExp(re.source, 'g'); t = t.replace(g, (...m) => { const i = m[m.length - 2]; const r = f(m); if(r) for(const x of [].concat(r)){ out.push(x); at.push(i); } return ' '.repeat(m[0].length); }); };
  // the one-die re-rolls first (their words contain the others'), then the rest by the catalogue
  for(const id of ['oneAny', 'oneEither']) for(const re of FX[id].pats) take(re, () => [[id, true]]);
  take(CHAR_RE, m => { const v = m[1] || m[4], l = m[2] || m[3]; if(!v || !l) return null; return l.split(/, | and /).map(c => [CH[c], /^d/.test(v) ? v.toUpperCase() : +v]); });
  // "+1 A, WS and S", "+1 A, S and D": one effect for each characteristic (WS / BS: the skill improved)
  take(/\+(\d|d3) ((?:a|s|ap|d|ws|bs)(?:, (?:a|s|ap|d|ws|bs))*(?:,? and (?:a|s|ap|d|ws|bs)))\b/, m => m[2].split(/,? and |, /).map(c => [/^(?:ws|bs)$/.test(c) ? 'skill' : c, /^d/.test(m[1]) ? m[1].toUpperCase() : +m[1]]));
  // "a Critical Hit is scored on an unmodified Hit roll of 5+" (Pledges to the Dark Prince's words)
  take(/\ba critical hit is scored on an unmodified hit roll of (\d)\+/, m => [['critHit', +m[1]]]);
  for(const [id, f] of Object.entries(FX)){
    if(id === 'oneAny' || id === 'oneEither') continue;
    f.pats.forEach((re, i) => { const ng = new RegExp(re.source + '|').exec('').length - 1; take(re, m => { const raw = ng ? m[1] : undefined; let p = raw === undefined ? true : f.str ? (/^d/.test(raw) ? raw.toUpperCase() : raw.replace(/\+$/, '+').toUpperCase()) : /^d/.test(raw) ? raw.toUpperCase() : +raw;
      if(f.neg && f.neg.includes(i)) p = -p;
      if(id === 'sus') p = String(p).toUpperCase();
      return [[id, p]]; }); });
  }
  const order = out.map((x, i) => [x, at[i]]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
  return { fx:order, rest:t };
}
// the rare mechanics shown as not counted
const ncOf = n => { for(const [id, x] of Object.entries(NC)) if(x.pats.some(re => re.test(n))) return { id, why:x.why }; return null; };

// the target's keywords a sentence names (its box's condition): "that targets a **MONSTER** or **VEHICLE** unit", "(excluding
// **MONSTERS** and **VEHICLES**)", "[LETHAL HITS: non-MONSTER/VEHICLE]", "allocated to a **MONSTER** or **VEHICLE** model",
// "if that target is **TITANIC** or **TOWERING**": literal keywords only (verify/derive.js's vocabulary)
function targetKw(V, s){
  const p = Dv.prepBold(s.replace(/~~/g, ''));
  const known = w => { const k = w.trim().toLowerCase().replace(/\*\*/g, ''); return V.get(k) || (/s$/.test(k) && V.get(k.slice(0, -1))) || null; };
  const list = run => { const parts = run.replace(/\*\*/g, '').split(/\s*,\s*(?:or\s+|and\s+)?|\s+or\s+|\s+and\s+|\s*\/\s*/).filter(Boolean); const ks = parts.map(known); return ks.every(Boolean) && ks.length ? ks : null; };
  let m;
  // "[LETHAL HITS: non-MONSTER/VEHICLE]", "[Lethal Hits: Monster/Vehicle]"
  if((m = /\[[A-Za-z0-9 -]+:\s*(non-)?([^\]]+)\]/i.exec(p))){ const ks = list(m[2]); if(ks) return m[1] ? { none:ks } : { any:ks }; }
  // "targets a unit (excluding **MONSTER/VEHICLE** units)", "targets an enemy unit (excluding **MONSTERS** and **VEHICLES**)"
  if((m = /\btargets? (?:a|an|an enemy) unit \(excluding ([^)]*)\)/i.exec(p))){ const ks = list(m[1].replace(/\s+units?$/i, '')); if(ks) return { none:ks }; }
  // "if that attack targets a **PSYKER CHARACTER** unit": every keyword of one run; "a CHARACTER, MONSTER or WALKER unit": any
  if((m = /\b(?:targets?|allocated to|if that target is) (?:a|an|an enemy) ((?:\*\*)?[A-Za-z][A-Za-z' -]*?(?:\*\*)?(?:(?:\s*,\s*|\s+or\s+|\s+and\s+|\s*\/\s*)(?:\*\*)?[A-Za-z][A-Za-z' -]*?(?:\*\*)?)*) (?:unit|model)s?\b/i.exec(p))){
    const run = m[1].replace(/\*\*/g, '');
    if(/,| or |\//.test(run)){ const ks = list(run); if(ks) return { any:ks }; }
    const ks = Dv.tokens(V, run); if(ks.length && ks.every(k => known(k.replace(/^Faction: /, '')))) return ks.length === 1 ? { any:ks } : { all:ks };
  }
  if((m = /\bif that target is ((?:\*\*)?[A-Z][A-Za-z]*(?:\*\*)?(?:\s+or\s+(?:\*\*)?[A-Z][A-Za-z]*(?:\*\*)?)+)/.exec(p))){ const ks = list(m[1]); if(ks) return { any:ks }; }
  return null;
}
// the conditions a sentence (with the line it continues) states, and the GW words of any other "if / while / unless" it has
function condsOf(V, sOrig, leadOrig, opts){
  const n = norm(sOrig), ln = norm(leadOrig || ''), both = (ln ? ln + ' ' : '') + n, on = [];
  const has = id => on.some(x => x[0] === id);
  for(const [id, c] of Object.entries(COND)){
    if(['targetKw', 'q', 'opt'].includes(id)) continue;
    for(const re of c.pats){ const m = re.exec(both); if(!m) continue;
      if(id === 'closest' && has('closest18')) break;
      if(id === 'onObjective' && (has('objective') || /\bthe target of (?:that attack|those attacks) is within range\b/.test(both))) break;
      if((id === 'targetObjective' || id === 'targetObjectiveNotYours') && has('objective')) break;
      if(id === 'targetBelowHalf' && has('targetNotBelowHalf')) break;
      if(id === 'aura' && opts && opts.self) break;
      on.push([id, id === 'aura' ? +m[1] : id === 'maxT' ? +m[1] - 1 : id === 'selfKw' ? m[1].replace(/(^|\s)([a-z])/g, (x, a, b) => a + b.toUpperCase()) : id === 'selfGear' ? m[1].split(/,? and |, /).map(x => x.replace(/^an? /, '').trim()) : true]); break; }
  }
  const tk = targetKw(V, sOrig) || (opts && opts.inherit ? null : targetKw(V, leadOrig || ''));
  if(tk) on.push(['targetKw', tk]);
  // any other condition, in GW's words: an "if / while / unless" clause no condition above reads
  const pc = plainCase((leadOrig ? leadOrig + ' ' : '') + sOrig);
  for(const m of pc.matchAll(/\b(?:[Ii]f|[Ww]hile|[Uu]nless) ([^,.:;()]+)/g)){
    const cl = m[0], cn = norm(cl);
    if(/^if (?:you|it|they) do(?:es)?\b|^if any of the following apply\b/.test(cn)) continue;
    // (an "if" whose consequence is a cost, not this effect: "if that test is failed, that unit suffers D3 mortal wounds")
    if(/^,?\s*(?:that unit|this unit|your unit|it|that model|this model) suffers\b/i.test(pc.slice(m.index + cl.length))) continue;
    // (a clause that defines a term: "while a TYRANIDS unit … is within 6" of … SYNAPSE models, that TYRANIDS unit is said to be within
    // Synapse Range": the next clause names it)
    if(/^,?\s*that [^.]*? is said to be\b/i.test(pc.slice(m.index + cl.length))) continue;
    // (a word the sentence defines first: "that model is damaged: while damaged, …")
    { const w = /^while (\w+)$/.exec(cn); if(w && new RegExp('\\bis ' + w[1] + '\\b').test(norm(pc))) continue; }
    if(Object.entries(COND).some(([id, c]) => !['q', 'targetKw', 'opt'].includes(id) && c.pats.some(re => re.test(cn) || re.test(norm(cl + ' ' + pc.slice(m.index + cl.length, m.index + cl.length + 60)))))) continue;
    if(/\b(?:targets?|allocated to|that target is)\b/.test(cn) && tk) continue;
    if(!on.some(x => x[0] === 'q' && x[1] === cl)) on.push(['q', cl]);
  }
  // a restriction no condition above reads, in GW's words: the target ("that target a unit within 9"", "that target a unit with a T
  // greater than this unit's T", "that targets the closest enemy unit"), what it can target ("they can only target units within range
  // of the selected objective marker"), the weapons ("with weapons selected for the Firing Deck ability")
  const QP = [/\bthat targets? (?:a|an|an enemy) unit (?:with|within) [^,.;:]+?(?= (?:have|has|can|gains?)\b|[,.;:]|$)/g, /\bthat targets? the closest enemy unit\b/g,
    /(?<=\bbut )(?:they|it) can only target [^,.;:]+/g, /\bcontains (?:a|one or more) [A-Z][A-Za-z' ]+? models?\b/g, /\bmodels in (?:those|that|your|this) [A-Za-z ]+? units? can only target [^,.;:]+/g, /\bwith weapons selected for the [^,.;:]+? ability\b/g];
  for(const re of QP) for(const m of pc.matchAll(re)){ const cl = m[0].trim(), cn = norm(cl);
    // (a restriction on what it can target is its own words, even where a condition reads the target: "can only target that enemy unit")
    if(!/\bcan only target\b/.test(cn) && Object.entries(COND).some(([id, c]) => !['q', 'targetKw', 'opt'].includes(id) && c.pats.some(r => r.test(cn)))) continue;
    if(!on.some(x => x[0] === 'q' && x[1] === cl)) on.push(['q', cl]); }
  // (the target, not this unit: "targets a unit that is below its Starting Strength … If that unit is Below Half-strength")
  if(on.some(x => x[0] === 'targetBelowHalf')) { const i = on.findIndex(x => x[0] === 'belowHalf'); if(i >= 0 && /\bthat unit is (?:also )?below half-strength\b/.test(both) && !/\b(?:this|your) unit is (?:also )?below half-strength\b/.test(both)) on.splice(i, 1); }
  return on;
}
// the weapons and models a sentence names: a weapon of the datasheet by its name ("its hellforged weapons", "this model's Omnissian
// axe"), [PSYCHIC] ("Psychic weapons"), one model ("this model's", "the bearer"), CHARACTER models, a part of an attached unit
function scopeOf(V, n, weapons, nOrig){
  const sc = {};
  const ws = [...new Set((weapons || []).map(w => w.toLowerCase().replace(/[’']/g, "'")))].sort((a, b) => b.length - a.length);
  for(const w of ws){ if(n.includes(w) && !/^(?:ranged|melee)\b/.test(w)){ sc.weapon = w; break; } }
  let m;
  // "<words> weapons": the last one or two words before it, unless a word of the sentence's grammar ("of weapons", "ranged weapons")
  const STOP = /^(?:of|the|its|their|his|her|ranged|melee|all|those|these|that|your|other|equipped|by|have|has|with|and|or|in|on|to|for|unit's|model's|bearer's|this|a|an|characteristic)$/;
  if(!sc.weapon) for(const mm of n.matchAll(/(?:^|\s)([a-z][a-z'-]+) ([a-z][a-z'-]+) weapons?\b|(?:^|\s)([a-z][a-z'-]+) weapons?\b/g)){
    const w2 = mm[1] && !STOP.test(mm[1]) ? mm[1] + ' ' + mm[2] : null, w1 = mm[2] || mm[3];
    if(!w1 || STOP.test(w1)) continue;
    if(w1 === 'psychic'){ sc.wkw = 'PSYCHIC'; break; }
    const h = w2 || w1;
    const hits = ws.filter(w => w.startsWith(h) || w.split(/\s+/)[0] === h.split(/\s+/)[0]);
    if(!weapons || hits.length){ sc.weapon = weapons ? (ws.some(w => w.startsWith(h)) ? h : h.split(/\s+/)[0]) : h; break; }
  }
  // "makes an attack with a belleros energy cannon that targets": a weapon by its name, equipped or not (one not equipped: no box)
  if(!sc.weapon && (m = /\bmakes an attack with an? ([a-z][a-z' -]+?) (?:that|against|which)\b/.exec(n)) && !/^(?:ranged|melee|psychic) (?:weapon|attack)$|^(?:weapon|attack)$/.test(m[1])) sc.weapon = m[1];
  if(/\bthis model(?:'s)? (?:makes|melee|ranged|attacks|weapons|hellforged|omnissian|watcher's)\b|\bequipped by (?:this model|the bearer)\b|\bthe bearer(?:'s)? (?:makes|melee|ranged)\b|\bthis model's\b|\bthe bearer's\b|\bbearer makes\b/.test(n) && !/\bmodels? in (?:this|that|your|the bearer's) unit\b/.test(n)) sc.models = 'model';
  if(/\bselect one (?:other )?friendly [^.]*? model\b/.test(n) && /\bthat [a-z ]*model's attacks\b|\bthat [a-z]+ makes an attack\b|\beach time that [a-z ]+ makes an attack\b/.test(n)) sc.models = 'one';
  if(/\bcharacter models'? (?:melee |ranged )?attacks\b|\bequipped by character models\b/.test(n)) sc.models = 'char';
  if(/\bexcluding those made by character models\b|\bmodels in the bearer's unit \(excluding characters?\)/.test(n)) sc.models = 'nonchar';
  if(nOrig && (m = /\bequipped by \*\*([A-Z][A-Z' -]+)\*\* models in that unit\b/.exec(nOrig))) sc.part = m[1].trim();
  return sc;
}
// the friendly units a sentence reaches (an aura, a unit another unit selects, a rule's units): the first friendly unit phrase
function reachOf(V, s){
  // (the first friendly unit phrase with keywords: "models from your army with a Bondsman ability … select one friendly ARMIGER model")
  let t = s, u = null;
  for(let k = 0; k < 6; k++){ const x = Dv.friendlyUnit(V, t); if(!x) break; if(x.run){ u = x; break; } t = Dv.prepBold(t).slice(x.at + x.matched.length); }
  const p = Dv.prepBold(t);
  if(u && u.run){
    const before = p.slice(Math.max(0, u.at - 60), u.at).toLowerCase(), after = u.after.toLowerCase();
    if(/\b(?:if|when) (?:a|an|one or more)\s+(?:friendly\s+)?$|\bwithin \d+" of (?:a|an|one or more)\s+(?:friendly\s+)?$/.test(before) || /^[^.]*?\bis destroyed\b/.test(after)) return null;
    const n = Dv.needsOf(V, u, []);
    if(n.bad) return null;
    const o = {}; for(const k of ['all', 'any', 'none']) if(n[k] && n[k].length) o[k] = n[k];
    return Object.keys(o).length ? o : null;
  }
  // a keyword GW did not set in bold ("a friendly War Dog model"): its words, when every one is a keyword of the lists
  const m = /\b(?:[Ww]hile|[Ss]elect one) (?:other )?(?:a )?friendly ((?:[A-Z][\w'’-]*\s)+?)(?:unit|model)s?\b/.exec(plainCase(s)) || /\b[Ww]hile a friendly ((?:[A-Z][\w'’-]*\s)+?)(?:unit|model)s? is within\b/.exec(plainCase(s));
  if(m){ const ks = Dv.tokens(V, m[1].trim()); if(ks.length && ks.every(k => V.get(String(k).replace(/^Faction: /, '').toLowerCase()))) return { all:ks }; }
  // attacks of any unit ("Ranged attacks that target that enemy unit have [IGNORES COVER]"): every friendly unit
  if(/^(?:ranged |melee )?attacks that target that enemy unit\b/.test(norm(s))) return {};
  return null;
}
// the text as units: { s (a sentence, GW's words), lead (the line its bullet hangs from), sec (its option: a table row's name,
// "**Name:**", a bold line), grp (its bullet list), or:true (an "Or:" bullet), pickLead (its list picks one) }
function unitsOf(src){
  const out = [];
  const lines = [];
  const push = (text, sec) => { for(const l of String(text || '').split('\n')) lines.push({ l, sec }); };
  if(src.type === 'strat'){
    // a stratagem: its EFFECT (the WHEN and TARGET as the line it continues, for its conditions)
    const ctx = 'WHEN: ' + src.when + ' TARGET: ' + src.target;
    for(const l of String(src.effect || '').split('\n')) lines.push({ l, sec:'', ctx });
  } else {
    push(src.text, '');
    for(const row of src.table || []) push(row.slice(1).join('\n'), row[0]);
  }
  let lead = '', sub = '', grp = 0, secT = null, head = '', stop = false, pickLead = false, rowCtx = '', ctxAny = '';
  for(const { l, sec, ctx:ctx0 } of lines){
    if(sec !== secT){ secT = sec; head = ''; stop = false; lead = ''; sub = ''; grp++; rowCtx = ''; }
    const raw = l.trim();
    if(!raw || /^\*[^*].*\*$/.test(raw) || /^\*\*\*/.test(raw)) continue;                       // italics: an example, a FAQ, a designer's note
    // KEYWORDS, RESTRICTIONS: not the rule's effects (in a table's row, "KA'TAH ABILITY": its heading)
    if(/^[A-Z][A-Z ’'-]{3,}$/.test(raw.replace(/\*\*/g, ''))){ if(!sec) stop = true; continue; }
    if(stop) continue;
    // a row laid out as a stratagem ("**WHEN:** … **TARGET:** … **EFFECT:** …"): its WHEN and TARGET are the context of its EFFECT
    const wt = /^\*\*(WHEN|TARGET):\*\*\s*(.*)$/.exec(raw);
    if(wt){ rowCtx += (rowCtx ? ' ' : '') + wt[1] + ': ' + wt[2]; continue; }
    const ctx = [ctx0, rowCtx].filter(Boolean).join(' ');
    const ef = /^\*\*EFFECT:\*\*\s*(.*)$/.exec(raw);
    const rawB = ef ? ef[1] : raw;
    const bullet = /^-\s+/.test(rawB);
    let body = rawB.replace(/^-\s+/, '');
    // an option: "**Name:** text", or a bold line of its own ("**Furor Tactics**", "- **Daemonic Rage [3BTP]**")
    let osec = sec;
    const named = /^\*\*([^*]+?):\*\*\s*(.*)$/.exec(body) || /^\*\*([^*]+?)\*\*:\s*(.*)$/.exec(body);
    if(/^\*\*[^*.]+\*\*$/.test(body) && !/^\*\*\[/.test(body)){ head = (sec ? sec + ' · ' : '') + body.replace(/\*\*/g, '').trim(); lead = ''; sub = ''; grp++; continue; }
    if(head) osec = head;
    if(named && !/^\[/.test(named[1])){ osec = (sec ? sec + ' · ' : '') + named[1].trim(); body = named[2]; }
    if(!bullet){ lead = /:\s*$/.test(body) ? body : ''; sub = ''; grp++; pickLead = !!lead && PICK_LEAD.test(norm(lead)); }
    else if(/:\s*$/.test(body)) sub = body;
    const or = bullet && /^or:\s*/i.test(body);
    if(or) body = body.replace(/^or:\s*/i, '');
    const ld = bullet ? [lead, sub !== body ? sub : ''].filter(Boolean).join(' ') : '';
    // its sentences; a parenthesis that is a sentence of its own ("(if that attack targets a PSYKER CHARACTER unit, … instead)"), right
    // after the sentence it is in
    let ss = [];
    const paren = new Set(), split = new Set();
    for(const x0 of body.split(/(?<=[.!?])\s+(?=[A-Z(*\[])/).map(x => x.trim()).filter(Boolean)){
      const ps = []; const x = x0.replace(/\s*\((if [^()]*?)\)/gi, (m, y) => { ps.push(y); return ''; });
      // a sentence of two effects whose second has a condition of its own ("add 1 to the Hit roll if …, and add 1 to the Wound roll as
      // well if …"): two parts, the second continuing the first
      const k = x.search(/, and (?=(?:add|improve|subtract|re-roll)\b)/i);
      const a1 = k >= 0 ? x.slice(0, k) : x, b1 = k >= 0 ? x.slice(k + 6) : '';
      if(k >= 0 && findFx(norm(a1)).fx.length && findFx(norm(b1)).fx.length && /\b(?:if|while|unless)\b/i.test(b1)){ ss.push(a1, b1); split.add(b1); }
      else ss.push(x);
      for(const y of ps){ ss.push(y); paren.add(y); }
    }
    if(!bullet && /\bany of the following apply\b/i.test(body)){ const k = lines.indexOf(lines.find(x => x.l === l)); const more = [];
      for(let j = k + 1; j < lines.length && /^\s*-\s+/.test(lines[j].l); j++) more.push(lines[j].l.trim().replace(/^-\s+/, ''));
      ctxAny = more.join(' '); } else if(!bullet) ctxAny = '';
    ss.forEach((s, i) => out.push({ s, lead:ld || (i > 0 ? ss[i - 1] : '') , ctx:[ctx, /\bany of the following apply\b/i.test(s) ? ctxAny : ''].filter(Boolean).join(' '), sec:osec, grp, bullet, or, pickLead:bullet && pickLead, first:i === 0, paren:paren.has(s), split:split.has(s), lineBody:body, prevS:i > 0 ? ss[i - 1] : '' }));
  }
  return out;
}

const BOTH_RE = /\bthe ([A-Z][\w'’]*(?: [A-Z][\w'’]*)*) and (?:the )?([A-Z][\w'’]*(?: [A-Z][\w'’]*)*) are both active for that unit\b/;
function extract(src, ctx){
  const V = ctx.V, boxes = [], nc = [];
  if(src.type === 'strat' && /\bthat was just destroyed\b/.test(norm(src.target))) return { boxes:[], nc:[{ quote:plainCase(src.effect), why:'its target was just destroyed: its effect is for other units, which cannot be its target' }], reach:null };
  const us = unitsOf(src);
  let prev = null;   // the last sentence with an effect, for a sentence that continues it
  for(let i = 0; i < us.length; i++){
    const u = us[i], n = norm(u.s);
    if(!u.bullet && u.first) prev = null;
    if(/\b\d+" a[\dd]+ (?:bs|ws)\d\+|\bmelee a[\dd]+ ws\d\+/.test(n)) continue;
    const nx = ncOf(n);
    let { fx } = findFx(n);
    // a bullet with no effect of its own may complete its line ("can ignore modifiers to your unit's: - BS.")
    // (then its quote is the whole list: "Your unit can ignore modifiers to your unit's:\n- BS.\n- Hit rolls and wound rolls.")
    let listQ = '';
    if(!fx.length && u.bullet && u.lead){ const a = findFx(norm(u.lead)).fx.length, b = findFx(norm(u.lead + ' ' + u.s)).fx; if(b.length > a){ fx = b.slice(a);
      listQ = [u.lead].concat(us.filter(x => x.grp === u.grp && x.bullet && x.first).map(x => '- ' + x.lineBody)).join('\n'); } }
    if(nx){ nc.push({ quote:u.s, why:nx.why }); prev = null; continue; }
    const leadN = norm(u.lead + ' ' + u.ctx);
    if(!fx.length){
      // a sentence with no effect that sets the context of the next ones ("select one friendly ORKS WALKER unit within 3" of this model.")
      if(/\bselect one\b|\bwhile\b/.test(n)) prev = { u, n, fx:[], sc:scopeOf(V, n, ctx.weapons, u.s), kind:kindOf(n), reach:reachOf(V, u.s), on:condsOf(V, u.s, u.lead + (u.ctx ? ' ' + u.ctx : '')) };
      continue;
    }
    const enemyThat = /\bselect one (?:visible )?enemy unit\b/.test(norm(u.prevS || '')) && /\b(?:models in that unit|that unit's)\b/.test(n) && !/\btargets? that (?:enemy )?unit\b/.test(n);
    if(DEFENCE.some(re => re.test(n)) || enemyThat || (prev && prev.defence && (/^if\b/.test(n) || /\bas well\.?$/.test(n)))){ prev = { defence:true }; continue; }
    // continues the sentence before it ("If that attack targets …, add 1 to the Wound roll as well.", "… instead"): its context
    const cont = !!prev && !prev.defence && (/^(?:if|in addition)\b/.test(n) || /\b(?:as well|instead)\.?$/.test(n) || /\bas well if\b/.test(n) || u.paren || u.split || /^(?:that|those) /.test(n)) && (!u.bullet || !!u.prevS);
    const base = cont ? prev : null;
    const leadAll = [u.lead, u.ctx].filter(Boolean).join(' ');
    let on = condsOf(V, u.s, cont ? '' : leadAll, { inherit:cont });
    // (a part of a split sentence takes who and what it is about from the first part, not its condition)
    const WHO = ['aura', 'leading', 'targetKw', 'selected', 'targetSelected', 'oncePerBattle', 'oncePerTurn', 'used'];
    if(base){ const own = new Set(on.map(x => x[0])); on = base.on.filter(x => !own.has(x[0]) && !(x[0] === 'targetKw' && own.has('targetKw')) && x[0] !== 'q' && (!u.split || WHO.includes(x[0]))).concat(on); }
    // an option of a rule whose words say when one of its options can be used ("While a unit is Empowered it can use one of the Malefic
    // Surge abilities below"), or how often each ("You can only select each of these abilities once per battle")
    if(u.sec && src.type !== 'strat'){ const rt = plainCase(String(src.text || '').split('\n')[0]);
      const w = /\b(While [^,.]+? it can use one of the [^.]+? below)/.exec(rt); if(w && !on.some(x => x[0] === 'q' && x[1] === w[1])) on.push(['q', w[1]]);
      if(/\bonly select each of these abilities once per battle\b/i.test(rt) && !on.some(x => x[0] === 'oncePerBattle')) on.push(['oncePerBattle', true]); }
    // one of a unit's abilities to pick from ("At the start of the battle round, select one Wrathful Presence ability", its options the
    // abilities New Recruit lists under it): the one selected, its moment in GW's words; one of them at a time (excl)
    if(src.pickOf){ const at = /^(At the start of [^,]+|In your [^,]+ phase)/i.exec(plainCase(src.pickOf.text));
      if(!on.some(x => x[0] === 'opt')) on.unshift(['opt', src.pickOf.name + ': the one selected' + (at ? ' (' + at[1].replace(/^./, c => c.toLowerCase()) + ')' : '')]); }
    // "If it does, …" / a line "… If it does:": what it does is the player's (used), in GW's words ("that unit can make a Warpmeld
    // Sacrifice", "when this model is set up on the battlefield using the Deep Strike ability, it can perform an aetherstride")
    if(/^if (?:it|you) do(?:es)?\b/.test(n) || /\bif (?:it|you) do(?:es)?:\s*$/.test(norm(u.lead || ''))){
      const t = plainCase((/^if (?:it|you) do/.test(n) ? u.prevS || u.lead : u.lead) || ''), m = /((?:\bwhen [^,.]+?, )?(?:that unit|this unit|this model|it|you) can (?:make|perform) (?:a |an |the )?[^.,;:]+)/i.exec(t);   // ("can use this ability": the used condition's own words)
      if(!on.some(x => x[0] === 'used')) on.push(['used', true]);
      if(m && !on.some(x => x[0] === 'q' && x[1] === m[1])) on.push(['q', m[1]]); }
    // a line that opens with its own "When …," before the list it leads ("When your unit uses the Dark Pacts ability, your unit's ranged
    // attacks have:"): its condition, in GW's words
    { const w = /^(When [^,.:;()]+),[^:]*:\s*$/.exec(plainCase(u.lead || '').split(/(?<=[.!?])\s+/).pop() || '');
      if(w && !/\bselected to (?:shoot|fight|attack)\b|\bmakes an attack\b/i.test(w[1]) && !on.some(x => x[0] === 'q' && x[1] === w[1])) on.push(['q', w[1]]); }
    const sc = Object.assign({}, base ? base.sc : {}, u.lead ? scopeOf(V, norm(u.lead), ctx.weapons, u.lead) : {}, scopeOf(V, n, ctx.weapons, u.s));
    if(/\bselect one character model in your unit\b/.test(norm(u.prevS || '')) && /^(?:until [^,]*, )?that model's\b/.test(n)) sc.models = 'char';
    // (one model another unit selects: "select one friendly ORKS VEHICLE model …:" then "That VEHICLE model's attacks have …")
    if(/\bselect one (?:other )?friendly [^.]*? model\b/.test(norm(u.lead + ' ' + (u.prevS || ''))) && /^that [a-z ]*model's attacks\b|\beach time that [a-z ]+ makes an attack\b/.test(n)) sc.models = 'one';
    const ruleKind = u.sec && (src.table || []).some(r => u.sec === r[0] || String(u.sec).startsWith(r[0] + ' · ')) ? kindOf(norm(String(src.text || '').split('\n')[0])) : '';
    let kind = kindOf(n) || (/\battacks\b/.test(n) && lastsOf(n) ? 'all' : '') || (base && base.kind) || kindOf(leadN) || kindOf(norm(u.prevS || '')) || ruleKind || 'all';
    let reach = reachOf(V, u.s) || (base && base.reach) || (u.lead ? reachOf(V, u.lead) : null) || (u.prevS ? reachOf(V, u.prevS) : null);
    // an ability another rule says how it is used (its tag: Bondsman, "select one friendly ARMIGER model within 12" of that model"): the
    // models that rule selects ("While a model is affected by this ability")
    let byTag = false;
    if(!reach && src.tagText && /\ba model is affected by this ability\b|\bthat model\b/.test(n)){ reach = reachOf(V, src.tagText); byTag = !!reach; if(byTag) on.push(['selected', true]); }
    // (the next sentence names the weapons that gain what this one selects: "select one of the following abilities: … Until the end of
    // the phase, this model's Bolt of Change has that ability.")
    const nx1 = us[i + 1];
    if(nx1 && nx1.lineBody === u.lineBody && /\b(?:has|have) (?:that|the selected) abilit/.test(norm(nx1.s))){ const n1 = norm(nx1.s);
      Object.assign(sc, scopeOf(V, n1, ctx.weapons, nx1.s)); if(kindOf(n1)) kind = kindOf(n1); }
    const box = { quote:listQ || u.s, fx, on, kind };
    if(u.lead) box.lead = u.lead; else if(cont) box.lead = prev.u.s;
    if(Object.keys(sc).length) box.scope = sc;
    // (a stratagem's box for a unit it selects, not its own: "Select one friendly WORLD EATERS unit within 6" of your unit. … melee
    // weapons equipped by models in your WORLD EATERS unit have [LANCE]")
    if(reach && src.type === 'strat' && (/\bselect one (?:other )?friendly\b/.test(norm(u.prevS || u.lead || '')) || (base && base.stratReach))){ box.reach = reach; box.mark = 'selected'; }
    // (an aura a stratagem gives its unit: "Your unit has the following ability: Honoured Interred (Aura): Friendly ADEPTUS CUSTODES units
    // within 6" of this unit can re-roll hit rolls of 1")
    else if(reach && src.type === 'strat' && on.some(x => x[0] === 'aura') && /^friendly\b/.test(n)){ box.reach = reach; box.mark = 'aura'; }
    if(reach && src.type !== 'strat'){ box.reach = reach; const t = norm(u.s + ' ' + (box.lead || '') + ' ' + (u.prevS || '') + (byTag ? ' select one ' : ''));
      box.mark = /\(aura\)|\baura\b/i.test(src.tag || '') || /\bwithin \d+" of (?:this|the bearer)\b/.test(t) && !/\bselect one\b/.test(t) ? 'aura' : /\bselect one\b/.test(t) ? 'selected' : 'friendly';
      if(/\bselect one other friendly\b|\bother friendly\b/.test(t)) box.notSelf = true; }
    const ls = lastsOf(norm(u.s + ' ' + (u.lead || '') + ' ' + u.ctx + (nx1 && nx1.lineBody === u.lineBody && /\b(?:has|have) (?:that|the selected) abilit/.test(norm(nx1.s)) ? ' ' + nx1.s : ''))); if(ls) box.lasts = ls;
    if(u.sec) box.opt = u.sec;
    // (a table of thresholds: "1+" of "how many Pact points you have gained" is "1+ Pact points")
    { const hm = /^\d+\+$/.test(u.sec || '') && /\bhow many ([A-Za-z' ]+?) you have\b/.exec(plainCase(src.text || '')); if(hm) box.opt = u.sec + ' ' + hm[1]; }
    if(u.or) box.or = true;
    if(u.pickLead) box.pickLead = true;
    // a re-roll of one die: how often, in GW's words (closed patterns): each time the unit is selected to shoot or fight ("Each time this
    // model is selected to shoot or fight", "When a friendly ADEPTUS CUSTODES unit is selected to attack"): one for the unit's attacks,
    // shared by its weapons; once per turn, once per battle round, once in the phase (Command Re-roll, 15.01)
    if(src.pickOf) box.excl = src.pickOf.name;
    if(fx.some(([id]) => /^one/.test(id))){ const t = norm([u.s, u.lead || '', u.prevS || '', u.ctx || ''].join(' '));
      const pool = fx.some(([id]) => id === 'oneAnyPhase') ? 'phase' : /\bonce per turn\b/.test(t) ? 'turn' : /\bonce per battle round\b/.test(t) ? 'round'
        : /\beach time (?:this|that) (?:model|unit) is selected to (?:shoot|fight|shoot or fight)\b|\bis selected to (?:attack|shoot|fight|shoot or fight)\b|\bwhen resolving those attacks\b/.test(t) ? 'selected' : '';
      if(pool) box.pool = pool; }
    // (its tag, the database's: "Once per battle")
    if(/\bonce per battle\b/i.test(src.tag || '') && !on.some(x => x[0] === 'oncePerBattle')) on.unshift(['oncePerBattle', true]);
    if(/\bonce per turn\b/i.test(src.tag || '') && !on.some(x => x[0] === 'oncePerTurn')) on.unshift(['oncePerTurn', true]);
    // (the enemy unit it selects, by its keyword: "select one visible enemy VEHICLE unit … attacks that target that unit")
    if(on.some(x => x[0] === 'targetSelected') && !on.some(x => x[0] === 'targetKw')){ const t = /\bselect one (?:\*\*visible\*\* |visible )?enemy \*\*([A-Z][A-Z ]+?)\*\* unit\b/.exec([u.prevS || '', u.lead || '', u.s].join(' '));
      if(t){ const ks = Dv.tokens(V, t[1]); if(ks.length) on.push(['targetKw', ks.length === 1 ? { any:ks } : { all:ks }]); } }
    box.grp = u.grp; box.bullet = u.bullet;
    // (one sentence for two kinds of attack: "weapons equipped by that model have [LETHAL HITS], and melee weapons equipped by that model
    // have [LANCE]": a box for each)
    const two = /, and (melee|ranged) weapons equipped by\b/.exec(n);
    if(two){ const fa = findFx(n.slice(0, two.index)).fx, fb = findFx(n.slice(two.index)).fx;
      if(fa.length && fb.length){ boxes.push(Object.assign({}, box, { fx:fa, kind:kindOf(n.slice(0, two.index)) || 'all' }), Object.assign({}, box, { fx:fb, kind:two[1] }));
        prev = { u, n, fx, sc, kind, reach, on, stratReach:src.type === 'strat' && !!box.reach }; continue; } }
    boxes.push(box);
    prev = { u, n, fx, sc, kind, reach, on, stratReach:src.type === 'strat' && !!box.reach };
  }
  // another rule's two options at once for the unit it selects ("the Conqueror Imperative and Protector Imperative are both active for that
  // unit", Icon of War's The Fires of Mars; verify/derive.js label-named-option): its picks together, where its words reach
  const both = [];
  for(const u of us){ const m = BOTH_RE.exec(plainCase(u.s)); if(!m || !m[2]) continue;
    const r = reachOf(V, u.s); if(!r) continue;
    both.push(Object.assign({ names:[m[1], m[2]], quote:u.s, reach:r, mark:/\bselect one\b/.test(norm(u.s)) ? 'selected' : 'friendly' }, u.sec ? { opt:u.sec } : {}, lastsOf(norm(u.s)) ? { lasts:lastsOf(norm(u.s)) } : {})); }
  // a model of the unit not on the battlefield yet, by one fixed pattern of GW's words ("If your Canis Rex model is destroyed, this model is
  // treated as a model disembarking from a destroyed Transport", Using Sir Hekhtur): until that model is destroyed
  const em = src.type === 'ability' ? /\bIf your ([A-Z][\w'’ -]*?) model is destroyed, this model is treated as a model disembarking from a destroyed Transport\b/.exec(plainCase(src.text || '')) : null;
  return Object.assign({ boxes:shape(boxes, src), nc, reach:reachOf(V, src.type === 'strat' ? '' : src.text || ''), both }, em ? { embarked:{ until:em[1] } } : {});
}

// the boxes of one rule: bullets of one list with no conditions of their own are one box; a list that picks one ("Or:", "select
// one of the following") or a table that does is one box with its picks; "select either the X or Y ability" and ", or … instead"
// are picks too; a part of an option with a fact of its own is that option's part
function shape(list, src){
  const out = [];
  const condKey = b => JSON.stringify(b.on.filter(x => x[0] !== 'targetKw'));
  // "select either the [LETHAL HITS] or [SUSTAINED HITS 1] ability" / "Select the X or Y ability … You can instead select the X, Y and Z abilities"
  for(const b of list){
    const n = norm(b.quote);
    if(/\byou can instead select the\b/.test(n) && b.fx.length){ const prevB = out[out.length - 1]; if(prevB && prevB.pick){ prevB.pick.push({ name:E.fxLabel(b.fx), fx:b.fx, quote:b.quote }); b.merged = true; } }
    else if((/\bselect (?:either )?the \[[^\]]+\](?: or|,) /.test(n) || /\bselect one of the following abilities: \[/.test(n)) && b.fx.length > 1){ b.pick = b.fx.map(f => ({ name:FX[f[0]].label(f[1]), fx:[f], quote:b.quote })); b.fx = []; }
    else if(/, or [^.]*\binstead\b/.test(n)){ const [x, y] = b.quote.split(/, or /); const fa = findFx(norm(x)).fx, fb = findFx(norm(y)).fx;
      // (its own first step, when it has no effect: "spend one Flux token and add 3 to …")
      const pre = /^(.+?) and (?=(?:add|improve|subtract|re-roll)\b)/i.exec(y), pon = pre && !findFx(norm(pre[1])).fx.length ? [['q', plainCase(pre[1])]] : [];
      if(fa.length && fb.length){ b.pick = [{ name:E.fxLabel(fa), fx:fa, quote:x }, Object.assign({ name:E.fxLabel(fb), fx:fb, quote:y }, pon.length ? { on:pon } : {})]; b.fx = []; } }
    if(!b.merged) out.push(b);
  }
  // bullets of one list ("this model's melee attacks have: - +3 A. - +2 S.") with no conditions of their own: one box
  const merged = [];
  for(const b of out){
    const last = merged[merged.length - 1];
    if(last && b.bullet && last.bullet && b.grp === last.grp && !b.or && !b.pickLead && !last.pickLead && !last.pick && !b.pick && condKey(b) === condKey(last) && b.kind === last.kind && b.opt === last.opt){
      // (a list quoted whole by each of its lines: one quote, each effect once)
      const fk = new Set(last.fx.map(f => JSON.stringify(f)));
      last.fx = last.fx.concat(b.fx.filter(f => !fk.has(JSON.stringify(f)))); if(!(last.quotes || [last.quote]).includes(b.quote)) last.quotes = (last.quotes || [last.quote]).concat(b.quote); continue; }
    merged.push(b);
  }
  // a list that picks one: one box, each bullet a pick ("Or:" bullets, "select one of the following:")
  const res = [];
  for(const b of merged){
    const last = res[res.length - 1];
    if(last && b.bullet && b.grp === last.grp && (b.or || (b.pickLead && last.pickLead))){
      if(!last.pick){ last.pick = [{ name:E.fxLabel(last.fx), fx:last.fx, quote:last.quote, on:last.on }]; last.fx = []; }
      last.pick.push({ name:E.fxLabel(b.fx), fx:b.fx, quote:b.quote, on:b.on }); continue; }
    res.push(b);
  }
  // a table whose rule picks one of its rows ("select one of the abilities listed below", "select one of the Doctrina Imperatives
  // below"): one box, a pick for each row; a fact part of a row (the Conqueror Imperative's +1 AP "if this unit has the BATTLELINE
  // keyword and/or …") is that pick's part
  const ruleN = norm(src.text || '');
  const tablePick = src.table && /\bselect one of the [a-z' ]+? (?:listed |presented |shown )?below\b/.test(ruleN);
  // a roll of one D6 or two D6 on a table (Try Dat Button!): each row, and each two rows
  const twoDice = src.table && /\broll either one d6 or two d6\b/.test(ruleN);
  let final = res;
  if(tablePick || twoDice){
    const rows = [], other = [];
    for(const b of res){ if(b.opt && (src.table || []).some(r => r[0] === b.opt)) rows.push(b); else other.push(b); }
    if(rows.length > 1){
      // (a row's line for every attack goes with its ranged and its melee lines: one pick for each kind of attack)
      const byKind = {}, kinds = [...new Set(rows.map(b => b.kind).filter(k => k !== 'all'))];
      for(const b of rows) for(const k of b.kind === 'all' ? (kinds.length ? kinds : ['all']) : [b.kind]) (byKind[k] = byKind[k] || []).push(b);
      final = other;
      for(const [kind, bs] of Object.entries(byKind)){
        const opts = new Map();
        for(const b of bs){ const bq = (b.quotes || [b.quote]).join('\n'), o = opts.get(b.opt) || Object.assign({ name:b.opt, fx:[], quote:bq, on:[] }, b.lead ? { lead:b.lead } : {});
          const facts = b.on.filter(x => x[0] === 'battleline6');
          if(facts.length) o.part = { on:facts, fx:b.fx, quote:bq }; else { if(o.fx.length) o.quote += '\n' + bq; o.fx = o.fx.concat(b.fx); o.on = o.on.concat(b.on); }
          opts.set(b.opt, o); }
        let pick = [...opts.values()];
        if(twoDice){ const one = pick.slice(); for(let i = 0; i < one.length; i++) for(let j = i + 1; j < one.length; j++) pick.push({ name:one[i].name + ' and ' + one[j].name, fx:one[i].fx.concat(one[j].fx), quote:one[i].quote + '\n' + one[j].quote, on:[] }); }
        final.push({ quote:(bs[0].quotes || [bs[0].quote]).join('\n'), fx:[], on:[], kind, pick, scope:bs[0].scope, lasts:bs[0].lasts || lastsOf(norm(src.text || '')) || undefined, reach:bs[0].reach, tableRows:true });
      }
    }
  }
  // (a pick of one is a box: its option's name its label)
  // (a table's pick stays one, its key the rule's: a tick carries from the shooting into the fight by its pick)
  final = final.map(b => b.pick && b.pick.length === 1 && !b.tableRows ? Object.assign({}, b, { fx:b.pick[0].fx, on:(b.on || []).concat(b.pick[0].on || []), opt:b.pick[0].name, quote:b.pick[0].quote, part:b.pick[0].part, pick:undefined, tableRows:undefined }) : b);
  for(const b of final){ if(b.pick === undefined) delete b.pick; if(b.tableRows === undefined) delete b.tableRows; if(b.part === undefined) delete b.part;
    // a box that is one option of its rule says which (its label)
    if(b.opt && !b.tableRows && !(b.on || []).some(x => x[0] === 'opt')) b.on = [['opt', b.opt + (/\(these are all cumulative\)/.test(ruleN) ? ' (cumulative)' : '')]].concat(b.on || []); }
  // how many of the rule's boxes can be active at once, in its words ("activate up to two Blessings of Khorne")
  const lm = /\bactivate up to (one|two|three) ([a-z' ]+?) \(/.exec(ruleN);
  for(const b of final){
    if(lm && b.opt) b.limit = { n:['one', 'two', 'three'].indexOf(lm[1]) + 1, what:plainCase(lm[2]).replace(/^./, c => c.toUpperCase()) };
    if(b.on.length && b.on.every(x => x[0] === 'q' && /^If (?:you|it) do(?:es)?/.test(x[1]))) b.on = [];
    // (one option left of a list that picks one, the other about attacks against the unit: its lead says it is a choice)
    if(b.pickLead && !b.pick && b.lead && !b.on.some(x => x[0] === 'q')) b.on.push(['q', plainCase(b.lead).replace(/:\s*$/, '')]);
    for(const k of ['grp', 'bullet', 'or', 'pickLead', 'merged']) delete b[k];
    if(b.quotes){ b.quote = b.quotes.join('\n'); delete b.quotes; }
  }
  return final;
}

module.exports = { extract, findFx, condsOf, targetKw, scopeOf, reachOf, unitsOf, plainCase, DEFENCE, lastsOf, kindOf };
