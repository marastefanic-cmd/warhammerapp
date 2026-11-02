#!/usr/bin/env node
/* verify/lines.js: the gate step "lines": the lines the app writes itself on a unit or stratagem screen stand on GW's words by fixed
   rules, as the Damage tab's boxes do (verify/evidence.js G1-G9).

     L0  columns a fixed rule derives from GW's words, stored = derived:
         damaged  an ability's Damaged range ("Damaged 1-6 W") is its words' "has 1-N wounds remaining" (or its name's "Damaged: 1-N
                  wounds remaining"), for every row that has one, and every list unit's ability with such words has it
         limit    a stratagem's "Once per battle" chip is exactly where its RESTRICTIONS say it can be used once per battle ("cannot use
                  this Stratagem more than once per battle", "can only use this Stratagem once per battle"; not "per battle round", not
                  "on the same … model")
         na       an ability's "does nothing here" chip ("Not leading a unit in this list", "Needs … : not this loadout", "No WAR DOG in
                  this list") is exactly what verify/derive.js naOf's three closed patterns give from its words, the unit and the list, on
                  every list unit's ability (none where they give none), and on no datasheet row (a list's own)
         cpNote   a stratagem's extra-CP chip ("Or: +1CP", "Into the Fray +1CP") is exactly the parts of its EFFECT GW prints with an extra
                  cost: a line "**+1CP** Or: …", an option "**Into the Fray (+1CP):** …"; an EFFECT that names "+NCP" any other way fails
     the footnotes under a unit's weapons (its weapon rows' "(+N)" values, its Damaged band, riled-up and own-aura lines among them) are
     its boxes, data.js BOXES (made by script from GW's words, held to them by verify/evidence.js G1-G9), each said with the labels of
     its effects and conditions (effects.js), as G1-G8 hold the Damage tab's boxes:
     L1  schema: no reading column the footnotes once had (mods, aura, mod, help, riled, …), nor a rule's stat notes and parts (statNote,
         parts: its stat boxes, below), is left in data.js (the When targeted columns, def and guard: verify/defence.js D1)
     L2  every footnote of every list × unit × kind is a box the database gives that unit
     L3  its effects' words are its box's effects' labels (a pick's options, a part), or its one weapon's row value (A, S, AP, D of one
         weapon, never a Damaged band's, a stratagem's or an ability's the unit uses)
     L4  completeness: every box the database gives the unit for this kind of attack is one footnote, once
     L5  its conditions' words are its box's conditions' labels, with the fixed forms of app.html fnCond; a condition that is only GW's
         words, quoted (q, anyOf), is not said (its rule's name opens them)
     L6  the code: unitMods, fnLine, the weapon tables and the Damaged band read no reading's words or retired column, and write no rule's
         number or weapon ability (Lance, Plunging Fire, Waaagh! are boxes of their rules)
     L7  (L2-L5 together: what the screen shows is what BOXES gives, worked out here again from data.js)
     L8  every catalogue effect and condition renders its label
     LC  every condition GW's words put on a box is on it (verify/coverage.js: option, once per, if / while / unless, within N", kind)
     LA  the "Already in X" chips of ability rows and of the Rules screen's rule rows are what the from marks give
     LS  the lines under a unit's profile (app.html statLines, "Not Battle-shocked: OC 7 (Enraged Behemoths)"): for every list × unit
         exactly the stat boxes (BOXES st, effects.js ST) of the list's army and detachment rules that reach it, each said with its
         conditions' labels and its effect (the unit's characteristic with it, else its label), none the list printed into the value; and
         the words to them: every sentence of an army or detachment rule that adds to or subtracts from a characteristic of models is a stat
         box, every "if / while / unless / (excluding …)" in it one of its conditions; then, under the profile, each BOXES snc (a
         characteristic no stat box counts) of its abilities, another unit's aura reaching it, its rules and its stratagems, "not counted"
     LW  never silent: every sentence of a source the lists use with words of the numbers (hit, wound, AP, damage, save, Feel No Pain, OC,
         Move, a weapon ability) is a counted box or listed not counted in BOXES (verify/coverage.js silent)

     node verify/lines.js      the gate step; writes verify/out/lines.json */
'use strict';
const fs = require('fs'), path = require('path');
const { ROOT } = require('./lib');
const E = require('../effects.js');
const X = require('./effects-extract');
const T = require('./tables');
const M = require('./effects-migrate');

const dm = require('./damage-node')(['unitMods', 'shownMods', 'fnLine', 'dmgBand', 'modLines', 'rowMod', 'statLines', 'alreadyIn', 'alreadyInRule', 'allStratagems', 'canTarget']);
const D = dm.D, A = dm.app, fails = [], stats = {};
const fail = (g, where, what) => fails.push(g + ' ' + where + ': ' + what);

// ---- L0 damaged ----
const DAMAGED_NAME = /^Damaged: (\d+)-(\d+) wounds remaining$/i, DAMAGED_WORDS = /\bhas (\d+)-(\d+) wounds remaining\b/i;
const damagedOf = ab => { const m = DAMAGED_NAME.exec(ab.name || '') || DAMAGED_WORDS.exec(ab.text || ''); return m ? m[1] + '-' + m[2] : null; };
{ let n = 0;
  const RAW = T.read(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'));
  const rows = [];
  for(const a of D.armies) for(const u of a.units) for(const ab of u.abilities || []) rows.push([a.id + '/' + u.id, ab, true]);
  for(const [sid, S] of Object.entries(RAW.S ? RAW.S.value : {})) for(const ab of S.abilities || []) rows.push(['DATASHEETS ' + sid, ab, false]);
  for(const [where, ab, listed] of rows){
    const d = damagedOf(ab);
    if(ab.damaged != null){ n++; if(ab.damaged !== d) fail('L0', where + ' · ' + ab.name, 'damaged ' + JSON.stringify(ab.damaged) + ', its words give ' + (d || 'no range')); }
    else if(listed && d) fail('L0', where + ' · ' + ab.name, 'its words give Damaged ' + d + ', the row has none');
  }
  stats.damaged = n; }

// ---- L0 limit ----
{ let n = 0;
  const all = D.coreStratagems.map(s => ['Core · ' + s.name, s]).concat(Object.values(D.factions).flatMap(f => Object.values(f.detachments || {}).flatMap(d => (d.stratagems || []).map(s => [f.name + ' · ' + d.name + ' · ' + s.name, s]))));
  for(const [where, s] of all){
    const want = X.limitOf(s.restrictions);
    if(s.limit !== want) fail('L0', where, 'limit ' + JSON.stringify(s.limit) + ', its RESTRICTIONS give ' + JSON.stringify(want || null) + ': “' + X.plainCase(s.restrictions || '') + '”');
    if(want) n++;
  }
  stats.limits = n; }

// ---- L0 na ----
{ let n = 0; const Dv = require('./derive');
  for(const a of D.armies) for(const u of a.units.concat(a.refs || [])) for(const ab of u.abilities || []){
    const want = Dv.naOf(ab, u, a.units);
    if(ab.na !== want) fail('L0', a.id + '/' + u.id + ' · ' + ab.name, 'na ' + JSON.stringify(ab.na || null) + ', its words give ' + JSON.stringify(want || null));
    else if(want) n++; }
  const RAW = T.read(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'));
  for(const [sid, S] of Object.entries(RAW.S ? RAW.S.value : {})) for(const ab of S.abilities || []) if(ab.na !== undefined) fail('L0', 'DATASHEETS ' + sid + ' · ' + ab.name, 'na on a datasheet row: it is the list\'s, its units\'');
  stats.na = n; }

// ---- L0 cpNote ----
{ let n = 0;
  const all = D.coreStratagems.map(s => ['Core · ' + s.name, s]).concat(Object.values(D.factions).flatMap(f => Object.values(f.detachments || {}).flatMap(d => (d.stratagems || []).map(s => [f.name + ' · ' + d.name + ' · ' + s.name, s]))));
  for(const [where, s] of all){
    const want = X.cpNoteOf(s.effect);
    if(s.cpNote !== want) fail('L0', where, 'cpNote ' + JSON.stringify(s.cpNote) + ', its EFFECT gives ' + JSON.stringify(want || null));
    // (an extra cost the two patterns do not read: never left without its chip)
    const more = (String(s.effect || '').match(/\+\s?\d\s?CP\b/gi) || []).length, read = want ? want.split(' · ').length : 0;
    if(more !== read) fail('L0', where, 'its EFFECT names ' + more + ' extra CP cost(s), the cpNote patterns read ' + read);
    if(want) n++;
  }
  stats.cpNotes = n; }

// ---- L1-L8: the footnotes under a unit's weapons are its boxes (data.js BOXES), said with the catalogue's labels ----
// L1  schema: no reading column the footnotes once had (mods, aura, mod, help, riled, …) is left in data.js
const RETIRED = new Set(['mods', 'aura', 'mod', 'help', 'riled', 'calcNote', 'fightOnDeath', 'comeback', 'calcDefs', 'react', 'weaponKw', 'defAlways', 'calcDef', 'defCalc', 'listWhy', 'lasts', 'single', 'statNote', 'parts']);
{ const RAW = T.read(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'));
  const walk = (x, where) => { if(Array.isArray(x)) return x.forEach((y, i) => walk(y, where + '[' + i + ']')); if(!x || typeof x !== 'object') return;
    for(const [k, v] of Object.entries(x)){ if(RETIRED.has(k)) fail('L1', where, 'keeps the retired column ' + k); walk(v, where + '.' + k); } };
  for(const [name, key] of [['ARMIES', 'A'], ['DATASHEETS', 'S']]) walk(RAW[key] ? RAW[key].value : null, name);
  walk(D.factions, 'FACTIONS'); walk(D.coreStratagems, 'CORE_STRATAGEMS'); }
// L2-L5, L7: for every list × unit × kind of attack, the footnotes (app.html unitMods) are exactly the boxes the database gives it, each a
// box of data.js BOXES (G1-G9 hold every box to GW's words, G7 BOXES to what the words give), its words the labels of its effects and
// conditions (effects.js), worked out here again from data.js alone:
//   which boxes: the sources the Damage tab gives the unit (dmSources, held to the database by verify/evidence.js "sources") but the core
//   stratagems; its Damaged bands; Lance (a [LANCE] weapon) and Plunging Fire (TOWERING, not AIRCRAFT), BOXES played; a box reaching other
//   units only where it reaches this one (and not its own "other" friendly units), of this kind, with a weapon of this kind where it
//   names weapons, a keyword or wargear it needs the unit has, an effect the list did not print into the weapons
//   its words: note the effects' labels (a pick's options "one of: …", a part "(…: …)"), or the row of its one weapon (A, S, AP, D: "+N";
//   A set: "N"); when the conditions' labels, " · " between, with the fixed forms of app.html fnCond, or "Every [ranged / melee] attack"
const lc = x => String(x || '').toLowerCase().replace(/[’']/g, "'");
const ROW = { a:'A', s:'S', ap:'AP', d:'D' }, SET = { aSet:'A' };
const used = b => (b.on || []).some(x => x[0] === 'used');
const RANGED_FX = new Set(['range', 'bsSet', 'assault', 'heavy', 'indirect', 'pistol']);   // (effects only ranged attacks have)   // (an ability the unit uses: the player's, never in the weapon's row)
const hasK = (u, k) => (u.kw || []).some(x => x.toLowerCase() === String(k).toLowerCase());
const mc = u => u.models.reduce((t, m) => t + (parseInt(m, 10) || 1), 0);
const condWords = (id, p, u, giver, own) => { const C = E.COND[id];
  if(id === 'aura') return own ? 'Own aura' : giver ? 'Within ' + p + '" of ' + giver : C.label(p);
  if(id === 'selected' && giver) return 'Selected by ' + giver;
  if(id === 'belowStarting' && mc(u) === 1) return 'Lost any wounds (' + C.label(p) + ')';
  if(id === 'belowHalf' && mc(u) === 1) return (Math.ceil((parseInt(u.stats[0].W, 10) || 0) / 2) - 1) + ' or fewer wounds left (' + C.label(p) + ')';
  return C.label(p); };
let nLines = 0, nRows = 0, nNc = 0;
{ const STAT = { a:['A'], s:['S'], d:['D'], ap:['AP'], skill:['WS', 'BS'] };
  const baked = (keys, id, p) => { if(!keys || !keys.length) return false; if(STAT[id]) return STAT[id].some(k => keys.includes(k));
    const l = String(E.fxLabel([[id, p]])).replace(/^\[|\]$/g, '').toUpperCase(), kws = keys.filter(k => !/^(?:A|S|D|AP|WS|BS)$/.test(k)); return !!l && kws.some(k => k.startsWith(l) || l.startsWith(k)); };
  const bakedOf = (u, name) => [...new Set([].concat(u.ranged || [], u.melee || []).flatMap(w => Object.entries(w.from || {}).filter(([, v]) => String(v).split(/\s*,\s*/).includes(name)).map(([k]) => String(k).toUpperCase())))];
  const items = (u, kind) => { const out = []; for(const w of (kind === 'ranged' ? u.ranged : u.melee) || []){ const l = out[out.length - 1]; if(w.group && l && l.group === w.group && l.who === w.who) l.ps.push(w); else out.push({ group:w.group, who:w.who, ps:[w] }); } return out; };
  const weaponsOf = (u, kind, sc) => items(u, kind).filter(it => (!sc.weapon || it.ps.some(p => [p.name, it.group, it.group || it.ps[0].name].some(x => lc(x) === sc.weapon || lc(x).startsWith(sc.weapon))))
    && (!sc.wkw || it.ps.some(p => (p.kw || []).some(k => String(k).toUpperCase() === sc.wkw || String(k).toUpperCase().startsWith(sc.wkw + ' ')))) && (!sc.part || lc(it.who).startsWith(lc(sc.part).replace(/s$/, '')))
    && (!sc.wkwNot || !it.ps.some(p => (p.kw || []).some(k => String(k).toUpperCase() === sc.wkwNot || String(k).toUpperCase().startsWith(sc.wkwNot + ' ')))));
  const meets = (n, u) => !n || ((!n.all || n.all.every(k => hasK(u, k))) && (!n.any || !n.any.length || n.any.some(k => hasK(u, k))) && (!n.none || !n.none.some(k => hasK(u, k))) && (!n.unless || !meets(n.unless, u)));
  for(const a of D.armies) for(const u of a.units) for(const kind of ['ranged', 'melee']){ if(!((kind === 'ranged' ? u.ranged : u.melee) || []).length) continue;
    const where = a.id + '/' + u.id + ' ' + kind, got = A.inArmy(a, () => A.unitMods(u, kind)), want = [];
    const srcs = A.inArmy(a, () => A.dmSources(a, u)).filter(S => !S.strat || (S.s && S.s.src !== 'Core'));
    for(const ab of u.abilities || []) if(/^Damaged: /i.test(ab.name)) srcs.push({ grp:'unit', name:ab.name, key:M.KEY.ability(ab), damaged:true });
    if([].concat(u.ranged || [], u.melee || []).some(w => (w.kw || []).some(k => /^lance$/i.test(k)))) srcs.push({ grp:'unit', name:'Lance', key:M.KEY.core('Lance', D.rules.Lance), played:true });
    if(hasK(u, 'Towering') && !hasK(u, 'Aircraft')) srcs.push({ grp:'unit', name:'Plunging Fire', key:M.KEY.core('Plunging Fire', D.rules['Plunging Fire']), played:true });
    const wn = [].concat(u.ranged || [], u.melee || []).flatMap(w => [w.name, w.group]).filter(Boolean).map(x => String(x).toLowerCase());
    for(const S of srcs){ const o = (D.boxes || {})[S.key]; if(!o) continue;
      if(S.played && !o.played) fail('L4', where, S.name + ' is not a played source in BOXES');
      const bk = bakedOf(u, S.name);
      for(const b of o.b || []){
        if(S.reachOnly ? !(b.reach && meets(b.reach, u)) : b.reach ? !meets(b.reach, u) || (S.grp === 'unit' && b.notSelf) : S.grp === 'other') continue;
        if(b.kind !== 'all' && b.kind !== kind) continue;
        // (a weapon keyword it excludes, wkwNot, names its weapons only where one of the unit's has it)
        const sc = b.scope || {}, ws0 = sc.weapon || sc.wkw || sc.part || sc.wkwNot ? weaponsOf(u, kind, sc) : null;
        const ws = ws0 && !sc.weapon && !sc.wkw && !sc.part && ws0.length === items(u, kind).length ? null : ws0;
        if(ws && !ws.length) continue;
        // (a weapon ability every weapon it reaches has already says nothing)
        const its = ws || items(u, kind), hasAll = l => /^\[.+\]$/.test(l) && its.length && its.every(it => it.ps.every(w => (w.kw || []).some(k => '[' + String(k).toUpperCase() + ']' === l)));
        const keep = fx => (fx || []).filter(([id, p]) => !baked(bk, id, p) && !hasAll(E.fxLabel([[id, p]])) && !(kind === 'melee' && RANGED_FX.has(id)));
        if((b.on || []).some(([id, p]) => (id === 'selfKw' && !hasK(u, p)) || (id === 'selfGear' && !p.every(g => wn.some(n => n.startsWith(String(g).toLowerCase())))))) continue;
        if(b.pick ? !b.pick.some(p => keep(p.fx).length) : !keep(b.fx).length) continue;
        want.push({ S, b, ws, keep });
      }
      // (its words about its attacks no catalogue effect reads: one "not counted here: see the rule" line; not another unit's, not a band's)
      if(!S.damaged && S.grp !== 'other' && (o.nc || []).some(x => x.atk)){ const ms = got.filter(m => m.ncLine && m.key === S.key);
        if(ms.length !== 1) fail('L4', where, S.name + ': its words not counted, ' + ms.length + ' "see the rule" lines');
        else if(ms[0].note !== 'not counted here: see the rule' || ms[0].when) fail('L3', where, S.name + ' not-counted line “' + ms[0].note + '”'); else nNc++; } }
    // exactly these, once each
    for(const w of want){ const ms = got.filter(m => m.box === w.b && m.key === w.S.key);
      if(ms.length !== 1){ fail('L4', where, (ms.length ? ms.length + ' footnotes' : 'no footnote') + ' for the box of ' + w.S.name + ' “' + X.plainCase(w.b.quote).slice(0, 70) + '”'); continue; }
      const m = ms[0]; nLines++;
      // L3 its effects' words
      const fx = w.b.pick ? null : w.keep(w.b.fx);
      const giver = w.S.src && w.S.src !== u ? (g => g && g.who && w.S.src.leads ? g.who : w.S.src.short || w.S.src.name)((w.S.src.abilities || []).find(x => x.name === w.S.name)) : '';
      const gv = giver && w.S.src.leads && ![w.S.src.name].concat((w.S.src.also || []).map(c => c.name)).includes(giver) ? w.S.src.short || w.S.src.name : giver;
      const own = w.S.grp === 'unit' && w.b.mark === 'aura';
      const cw = on => (on || []).map(([id, p]) => condWords(id, p, u, gv, own)).join(' · ');
      const part = x => x && x.fx && x.fx.length ? ' (' + (cw(x.on) ? cw(x.on) + ': ' : '') + E.fxLabel(x.fx) + ')' : '';
      if(m.set){ nRows++;
        if(!fx || !w.ws || w.ws.length !== 1 || w.S.damaged || w.S.strat || used(w.b) || !fx.every(([id]) => ROW[id] || SET[id])) fail('L3', where, 'a row value of ' + w.S.name + ' that is no one weapon\'s characteristic');
        else { const exp = Object.fromEntries(fx.map(([id, p]) => ROW[id] ? [ROW[id], '+' + String(p).toUpperCase()] : [SET[id], String(p)]));
          if(JSON.stringify(exp) !== JSON.stringify(m.set) || m.weapon !== w.ws[0].ps[0].name) fail('L3', where, w.S.name + ' row ' + m.weapon + ' ' + JSON.stringify(m.set) + ', its box gives ' + w.ws[0].ps[0].name + ' ' + JSON.stringify(exp)); } }
      else { const bOn = new Set((w.b.on || []).map(x => JSON.stringify(x)));
        const exp = fx ? E.fxLabel(fx) + part(w.b.part) : 'one of: ' + w.b.pick.map(p => Object.assign({}, p, { fx:w.keep(p.fx) })).filter(p => p.fx.length).map(p => { const pon = (p.on || []).filter(x => !bOn.has(JSON.stringify(x)));
          return (p.name !== E.fxLabel(p.fx) ? p.name + ': ' : '') + E.fxLabel(p.fx) + (cw(pon) ? ' (' + cw(pon) + ')' : '') + part(p.part); }).join(' · ');
        if(m.note !== exp) fail('L3', where, w.S.name + ' says “' + m.note + '”, its box “' + exp + '”');
        if(fx && w.ws && w.ws.length === 1 && !w.ws[0].group && !w.S.damaged && !w.S.strat && !used(w.b) && fx.every(([id]) => ROW[id] || SET[id])) fail('L3', where, w.S.name + ': one weapon\'s characteristic, not in its row'); }
      // L5 its conditions' words
      const sPh = w.S.s && (w.S.s.phases || []).length === 1 ? ((w.S.s.turns && w.S.s.turns[w.S.s.phases[0]]) || w.S.s.turn) : null;
      const on = w.b.on || [], cond = on.length && on.every(([id]) => E.COND[id].quoted) ? 'If (see the rule)' : cw(on);
      const pickOn = (w.b.pick || []).some(p => (p.on || []).length || p.part);
      const expW = sPh ? [(sPh === 'your' ? 'Your ' : sPh === 'opp' ? 'Your opponent’s ' : '') + w.S.s.phases[0].replace(/^./, c => c.toUpperCase()) + ' phase', cond].filter(Boolean).join(', ') : cond || (w.S.strat || pickOn ? '' : w.b.kind === 'ranged' ? 'Every ranged attack' : w.b.kind === 'melee' ? 'Every melee attack' : 'Every attack');
      // (never wider than GW's rule: every condition of the box is said, or the line says "If (see the rule)")
      if(on.some(([id]) => !E.COND[id].quoted) && on.some(([id, p]) => E.COND[id].quoted && !m.when.includes(E.COND[id].label(p)))) fail('L5', where, w.S.name + ': a quoted condition left out beside a said one');
      if(m.when !== expW) fail('L5', where, w.S.name + ' when “' + m.when + '”, its box “' + expW + '”');
    }
    // L2 nothing else: every footnote is one of these boxes
    for(const m of got) if(!m.ncLine && !want.some(w => w.b === m.box && w.S.key === m.key)) fail('L2', where, 'the footnote of ' + m.from + ' “' + m.note + '” is no box the database gives this unit');
  } }
stats.footnotes = nLines; stats.rowValues = nRows; stats.ncLines = nNc;
// L6 the code: the footnotes, the weapon rows and the Damaged band read no reading's words (note, when, selfWhen), no retired column and
// no rule's number written in the code
{ const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  const fnSrc = name => { const m = new RegExp('\\n(?:function ' + name + '\\(|const ' + name + ' = )').exec(html); if(!m) return ''; const rest = html.slice(m.index + 1), e = rest.slice(1).search(/\n(?:function |const |let |\/\/ |\/\*)/); return rest.slice(0, e < 0 ? undefined : e + 1); };
  for(const name of ['unitMods', 'shownMods', 'fnLine', 'fnCond', 'fnWeapons', 'weaponTable', 'unitWeapons', 'weaponBlock', 'modLines', 'modGroupLines', 'stratModLines', 'rowMod', 'footMod', 'oneOffMod']){
    const c = fnSrc(name).replace(/\/\/[^\n]*/g, '');
    if(!c){ fail('L6', 'app.html', name + ' not found'); continue; }
    if(/\.(?:mods|aura|mod|help|selfWhen|selfAlways|single|riled|calc)\b(?!\s*\()/.test(c.replace(/\bm\.box\b/g, ''))) fail('L6', 'app.html ' + name, 'reads a retired reading column: ' + /\.(?:mods|aura|mod|help|selfWhen|selfAlways|single|riled|calc)\b/.exec(c)[0]);
    if(/\b(?:ab|r|s|S\.s|S\.ab)\.(?:text|effect|target|when)\b/.test(c)) fail('L6', 'app.html ' + name, 'reads a rule\'s words');
    const NUM = /'[^'\n]*(?:\+\d|\bwithin \d+"|BS improved|to wound|to hit|\[[A-Z][A-Z ]+\])[^'\n]*'/;
    if(NUM.test(c)) fail('L6', 'app.html ' + name, 'a rule\'s number or weapon ability written in the code: ' + NUM.exec(c)[0]);
  }
  if(!/const says = dmgBand\(ab\);/.test(html)) fail('L6', 'app.html screenUnit', 'the Damaged band is not dmgBand');
  if(/Riled up: 5\+ INV|'\[ASSAULT\]'|Made a charge move this turn|BS improved by 1/.test(fnSrc('unitMods') + fnSrc('shownMods'))) fail('L6', 'app.html', 'a rule written in the footnotes\' code'); }
// L8 every catalogue effect and condition says its own value: each label of each value of its domain carries that value, its sign and
// its keywords (a wrong number in effects.js fails here, not only in the snapshots), and a box of it alone renders that label
{ let n = 0; const u0 = { id:'x', name:'X', kw:[], models:['2× X'], stats:[{ W:'4' }], abilities:[], rules:[], ranged:[{ name:'Gun', kw:[] }], melee:[] };
  const dash = t => String(t).replace(/[−–]/g, '-');
  for(const [id, f] of Object.entries(E.FX)){
    for(const p of f.dom === 'anti' ? ['INFANTRY 4+', 'NON-VEHICLE 2+'] : f.dom){ const l = dash(f.label(p));
      if(typeof p === 'number' && !new RegExp('(?:^|[^\\d])' + (p < 0 ? '-' : '\\+?') + Math.abs(p) + '(?![\\d])').test(l)) fail('L8', 'effects.js ' + id, 'its label for ' + p + ' is “' + l + '”');
      else if(typeof p === 'number' && p > 0 && /(?:^|\s)-\d/.test(l)) fail('L8', 'effects.js ' + id, 'its label for ' + p + ' is negative: “' + l + '”');
      else if(typeof p === 'string' && !l.toUpperCase().includes(p.toUpperCase())) fail('L8', 'effects.js ' + id, 'its label for ' + p + ' is “' + l + '”');
      else n++; }
    // (read back: a label whose words a pattern reads gives the same value; the bracketed weapon abilities and the characteristics)
    const p = f.dom === 'anti' ? 'INFANTRY 4+' : f.dom[0], back = X.findFx(E.norm(f.label(p))).fx.find(x => x[0] === id);
    if(back && String(back[1]).toUpperCase() !== String(p).toUpperCase()) fail('L8', 'effects.js ' + id, 'its label “' + f.label(p) + '” reads back as ' + back[1]);
    const m = A.fnLine({ grp:'army', name:'R', key:'r|x' }, { quote:'', fx:[[id, p]], on:[], kind:'all' }, u0, 'ranged', null);
    if(!m || m.note !== f.label(p)) fail('L8', 'effects.js ' + id, 'a box of it alone says “' + (m && m.note) + '”, not “' + f.label(p) + '”'); }
  const CV = { aura:[[3, '3"'], [6, '6"'], [9, '9"']], maxT:[[6, 'T 7+'], [3, 'T 4+']], targetKw:[[{ any:['Monster', 'Vehicle'] }, 'MONSTER or VEHICLE'], [{ none:['Monster', 'Vehicle'] }, 'not MONSTER/VEHICLE'], [{ any:['Infantry', 'Beast'], said:'INFANTRY or BEASTS' }, 'INFANTRY or BEASTS'], [{ none:['Monster', 'Vehicle'], said:'MONSTERS and VEHICLES' }, 'excluding MONSTERS and VEHICLES'], [{ all:['Psyker', 'Character'] }, 'PSYKER CHARACTER']],
    selfKw:[['Khorne', 'KHORNE']], selfGear:[[['gun', 'axe'], 'gun and axe']], opt:[['Option', 'Option']], q:[['If words', '“If words”']], anyOf:[[['A', 'B'], '“A” or “B”']] };
  for(const [id, c] of Object.entries(E.COND)){
    for(const [p, want] of CV[id] || [[true, null]]){ const l = c.label(p); if(want && !l.includes(want)) fail('L8', 'effects.js ' + id, 'its label for ' + JSON.stringify(p) + ' is “' + l + '”, not with “' + want + '”'); else n++; }
    if(id === 'selfKw' || id === 'selfGear') continue;   // (a keyword or wargear the unit lacks: no footnote at all)
    const p = (CV[id] || [[true]])[0][0], m = A.fnLine({ grp:'army', name:'R', key:'r|x' }, { quote:'', fx:[['hit', 1]], on:[[id, p]], kind:'all' }, u0, 'ranged', null);
    const exp = c.quoted ? 'If (see the rule)' : c.label(p);
    if(!m || m.when !== exp) fail('L8', 'effects.js ' + id, 'a box of it alone says “' + (m && m.when) + '”, not “' + exp + '”'); }
  stats.labels = n; }
// LC every condition GW's words put on an attack box is on it (verify/coverage.js, as verify/defence.js DC): its option, once per, each
// "if / while / unless" clause, each "within N"", the kind of attack; said, quoted ("If (see the rule)"), or listed not counted
{ const Cv = require('./coverage'), Tw = M.build(D), Sw = M.sources(D), CTX = { V:require('./derive').vocab(D), kws:D.armies.flatMap(a => a.units.map(u => u.kw || [])).concat(Object.values(D.datasheets || {}).map(x => x.kw || [])) }; let n = 0;
  for(const [key, o] of Object.entries(Tw)){ const src = Sw.get(key); if(!src || o.played) continue;
    for(const b of o.b || []){ n++; for(const g of Cv.gaps(b, src, 'attack', src.others, CTX)) fail('LC', key + ' ' + o.n, g + ': “' + X.plainCase(b.quote).slice(0, 70) + '”'); } }
  stats.covered = n; stats.reachChecked = Cv.counts.checked; stats.reachUnchecked = Cv.counts.unchecked; }
// LW never silent: every sentence of a source a list uses (its units' abilities and core weapon rules, its faction's army rules, its
// detachments' rules and stratagems, the core stratagems) with words of the numbers (hit, wound, AP, damage, save, Feel No Pain, OC, Move,
// a weapon ability) is a counted box or listed not counted in data.js BOXES (verify/coverage.js silent, its own words)
{ const Cv = require('./coverage'), Sw = M.sources(D), used = new Set(); let n = 0, k = 0;
  for(const a of D.armies){ const F = D.factions[a.faction] || {};
    for(const r of F.armyRules || []) used.add(M.KEY.rule(r));
    for(const id of a.detachments || []){ const d = (F.detachments || {})[id]; if(!d) continue;
      for(const r of d.rule ? [d.rule].concat(d.moreRules || []) : []) used.add(M.KEY.rule(r)); for(const st of d.stratagems || []) used.add(M.KEY.strat(st)); } }
  for(const st of D.coreStratagems || []) used.add(M.KEY.strat(st));
  for(const [key, src] of Sw){ if((src.type === 'rule' || src.type === 'strat') && !used.has(key)) continue; n++;
    for(const s of Cv.silent(src, (D.boxes || {})[key])){ k++; fail('LW', key + ' ' + src.name, 'words of the numbers no box counts and none lists not counted: “' + X.plainCase(s).slice(0, 90) + '”'); } }
  stats.silentSources = n; stats.silent = k; }
// LS the lines under a unit's profile: the stat boxes of the list's army and detachment rules that reach it, worked out here again from
// data.js alone (which rules, which boxes, the words: its conditions' labels, " · " between, a one-model unit's Starting Strength in its
// wounds, "If (see the rule)" for GW's quoted words alone; its value the unit's characteristic with the effect where every profile has one value
// and the box is for all its models, and no ability of the unit can set it to a value (Singular Purpose), else the effect's label, a keyword's
// models before it), never one the list printed into the value (from);
// and the words to them (every sentence of a rule that changes a characteristic of models a stat box, its conditions read)
{ let n = 0;
  const meetsN = (x, u) => !x || ((!x.all || x.all.every(k => hasK(u, k))) && (!x.any || !x.any.length || x.any.some(k => hasK(u, k))) && (!x.none || !x.none.some(k => hasK(u, k))) && (!x.unless || !meetsN(x.unless, u)));
  const sw = (id, p, u) => id === 'atStarting' && mc(u) === 1 ? 'Lost no wounds (' + E.STCOND[id].label(p) + ')' : E.STCOND[id] ? E.STCOND[id].label(p) : condWords(id, p, u, '', false);
  for(const a of D.armies){ const F = D.factions[a.faction] || {}, rules = (F.armyRules || []).concat((a.detachments || []).flatMap(id => { const d = (F.detachments || {})[id]; return d && d.rule ? [d.rule].concat(d.moreRules || []) : []; }));
    for(const u of a.units){ const want = [];
      for(const r of rules) for(const b of ((D.boxes || {})[M.KEY.rule(r)] || {}).st || []){
        if(!(b.reach ? meetsN(b.reach, u) : r.needs && meetsN(r.needs, u))) continue;
        const on = b.on || [], when = on.length && on.every(([id]) => E.COND[id] && E.COND[id].quoted) ? 'If (see the rule)' : on.map(([id, p]) => sw(id, p, u)).join(' · ');
        for(const [id, p] of b.st){ const f = E.ST[id];
          if(!f){ fail('LS', a.id + '/' + u.id, r.name + ': the stat effect ' + id + ' is not in effects.js ST'); continue; }
          if(u.stats.every(s => String([].concat((s.from || {})[f.stat] || []).join(', ')).split(/\s*,\s*/).includes(r.name))) continue;
          const sets = (u.abilities || []).some(ab => new RegExp('\\ban? ' + f.name + ' characteristic of \\d', 'i').test(String(ab.text || '').replace(/\*\*/g, '')));
          const vs = [...new Set(u.stats.map(s => String(s[f.stat])))], whole = !sets && !(b.scope || {}).models && vs.length === 1 && (f.inch ? /^\d+"$/ : /^\d+$/).test(vs[0]);
          const val = whole ? f.stat + ' ' + (parseInt(vs[0], 10) + f.add(p)) + (f.inch ? '"' : '') : ((b.scope || {}).models ? b.scope.models + ' models ' : '') + f.label(p);
          want.push(r.name + ' | ' + (when ? when + ': ' : '') + val); } }
      // (and every snc of its sources, BOXES: its abilities, another unit's aura that reaches it, its army and detachment rules, the
      // stratagems it can be the target of: "<stat>: not counted here: see the rule", once per source and characteristic, not one printed in)
      const said = new Set(), snc = (key, name) => { for(const x of ((D.boxes || {})[key] || {}).snc || []){
        if(said.has(name + '|' + x.stat) || (u.stats.length && u.stats.every(s => String([].concat((s.from || {})[x.stat] || []).join(', ')).split(/\s*,\s*/).includes(name)))) continue;
        said.add(name + '|' + x.stat); want.push(name + ' | ' + (x.foe ? 'Enemy units’ ' : '') + x.stat + ': not counted here: see the rule'); } };
      for(const ab of u.abilities || []) snc(M.KEY.ability(ab), ab.name);
      for(const x of a.units) if(x !== u) for(const ab of x.abilities || []){ const o = (D.boxes || {})[M.KEY.ability(ab)] || {};
        if(/\baura\b/i.test(ab.tag || '') && o.reach && meetsN(o.reach, u)) snc(M.KEY.ability(ab), ab.name); }
      for(const r of rules) if(!r.needs || meetsN(r.needs, u)) snc(M.KEY.rule(r), r.name);
      for(const st of A.inArmy(a, () => A.allStratagems().filter(x => A.canTarget(x, u)))) snc(M.KEY.strat(st), st.name);
      const got = A.inArmy(a, () => A.statLines(u)).map(x => x.rule + ' | ' + x.text);
      if(JSON.stringify(got) !== JSON.stringify(want)) fail('LS', a.id + '/' + u.id, 'the lines under its profile are ' + JSON.stringify(got) + ', its rules\' stat boxes give ' + JSON.stringify(want));
      else n += got.length; } }
  // (its schema: a stat box carries the fields statOf writes and no other, each effect and condition in the catalogue with its value in
  // its domain, its quote GW's words of its rule)
  const ST_KEYS = new Set(['quote', 'st', 'on', 'reach', 'scope']), ruleByKey = new Map();
  for(const f of Object.values(D.factions)) for(const r of (f.armyRules || []).concat(Object.values(f.detachments || {}).flatMap(d => d && d.rule ? [d.rule].concat(d.moreRules || []) : []))) ruleByKey.set(M.KEY.rule(r), r);
  for(const [key, o] of Object.entries(D.boxes || {})) for(const b of o.st || []){ const where = key + ' ' + o.n, r = ruleByKey.get(key);
    const bad = Object.keys(b).filter(k => !ST_KEYS.has(k)).concat(Object.keys(b.scope || {}).filter(k => k !== 'models'));
    if(bad.length) fail('LS', where, 'stat box fields no script writes: ' + bad.join(', '));
    if(!r) fail('LS', where, 'a stat box of no army or detachment rule');
    else if(!X.sentencesOf(r.text).some(x => x.s === b.quote)) fail('LS', where, 'its quote is not a sentence of its rule: “' + String(b.quote).slice(0, 70) + '”');
    for(const [id, p] of b.st || []){ const f = E.ST[id]; if(!f || !f.dom.includes(p)) fail('LS', where, 'stat effect ' + id + ' ' + JSON.stringify(p) + ' not in effects.js ST or its domain');
      else if(!f.pats.some(re => { const m = re.exec(E.norm(b.quote)); return m && +m[1] === p; })) fail('LS', where, 'stat effect ' + id + ' ' + p + ' is not in its quote'); }
    for(const [id] of b.on || []) if(!E.STCOND[id] && !E.COND[id]) fail('LS', where, 'condition ' + id + ' not in effects.js COND or STCOND'); }
  // (and each stat effect and condition reads the ways GW words it, the catalogue's fixtures, as L8 holds the attack side's labels)
  const ST_FIX = { ocAdd:['add 2 to the objective control characteristic of models in that unit', 'that unit has +2 oc'], mAdd:['add 2" to the move characteristic of models in legio cybernetica units', 'friendly necrons titanic fly units have +6" m'],
    atStarting:['is at its starting strength', 'unit is at starting strength'], notShocked:['(excluding battle-shocked units)', 'unless that unit is battle-shocked', 'while such a unit is not battle-shocked'] };
  for(const [id, xs] of Object.entries(ST_FIX)){ const C = E.ST[id] || E.STCOND[id]; for(const x of xs) if(!C || !C.pats.some(re => re.test(x))) fail('LS', 'effects.js ' + id, 'does not read GW\'s “' + x + '”'); }
  // the words to them: every rule of the database
  const CH_RE = /\b(?:add|subtract) (?:\d+|d3)"? (?:to|from) the ([a-z ]+?) characteristic of (?:[a-z' -]+ )?models in\b|\bthat unit has [+-]\d+"? (?:oc|m|t|sv|w|ld)\b|\bfriendly [a-z' -]+ units (?:from your army )?have [+-]\d+"? (?:oc|m|t|sv|w|ld)\b/;
  const CL_RE = /\b(?:if|while|unless)\b[^,.;:]+|\(excluding [^)]+\)/gi;
  for(const f of Object.values(D.factions)) for(const r of (f.armyRules || []).concat(Object.values(f.detachments || {}).flatMap(d => d && d.rule ? [d.rule].concat(d.moreRules || []) : []))){
    const st = ((D.boxes || {})[M.KEY.rule(r)] || {}).st || [];
    for(const x of X.sentencesOf(r.text)){ const nn = E.norm(x.s); if(!CH_RE.test(nn)) continue;
      const b = st.find(y => y.quote === x.s);
      if(!b){ fail('LS', f.name + ' · ' + r.name, 'its words change a characteristic of models and are no stat box: “' + X.plainCase(x.s).slice(0, 90) + '”'); continue; }
      for(const m of X.plainCase(x.s).matchAll(CL_RE)){ const cn = E.norm(m[0]);
        const read = (b.on || []).some(([id, p]) => { const C = E.STCOND[id] || E.COND[id]; return (id === 'q' && E.norm(p).includes(cn.replace(/^\(|\)$/g, ''))) || (C && C.pats.some(re => re.test(cn) || re.test(E.norm(x.s)) && E.norm(x.s).match(re).index >= nn.indexOf(cn) && E.norm(x.s).match(re).index < nn.indexOf(cn) + cn.length)); });
        if(!read) fail('LS', f.name + ' · ' + r.name, 'its condition “' + m[0] + '” is not on its stat box'); } } }
  stats.statLines = n; }
// LA the "Already in X" chips (an ability row's, alreadyIn; an army or detachment rule's on the Rules screen, alreadyInRule): exactly the
// characteristics of the unit's (the list's units') rows whose from marks name it, worked out here again from data.js
{ let n = 0; const KEYS = ['M', 'T', 'Sv', 'W', 'Ld', 'OC', 'InSv', 'range', 'A', 'BS', 'WS', 'S', 'AP', 'D'];
  const marks = (u, name) => [...new Set([].concat(u.stats || [], u.ranged || [], u.melee || []).flatMap(x => Object.entries(x.from || {}).filter(([k, v]) => KEYS.includes(k) && [].concat(v).includes(name)).map(([k]) => k === 'range' ? 'Range' : k)))];
  for(const a of D.armies){ const F = D.factions[a.faction] || {};
    for(const u of a.units) for(const ab of u.abilities || []){ const want = marks(u, ab.name).join(', '), got = A.inArmy(a, () => A.alreadyIn(ab, u)); if(got !== want) fail('LA', a.id + '/' + u.id + ' · ' + ab.name, '"Already in ' + got + '", its from marks give "' + want + '"'); else if(want) n++; }
    for(const r of (F.armyRules || []).concat((a.detachments || []).flatMap(id => { const d = (F.detachments || {})[id]; return d && d.rule ? [d.rule].concat(d.moreRules || []) : []; }))){
      const want = [...new Set(a.units.flatMap(u => marks(u, r.name)))].join(', '), got = A.inArmy(a, () => A.alreadyInRule(r.name));
      if(got !== want) fail('LA', a.id + ' · ' + r.name, '"Already in ' + got + '", its from marks give "' + want + '"'); else if(want) n++; } }
  stats.alreadyIn = n; }
// LB the Damaged band: its words are its boxes' effect labels, and "see the rule" where its words have a part not counted or no box
{ let n = 0;
  for(const a of D.armies) for(const u of a.units) for(const ab of u.abilities || []) if(ab.damaged){ const o = (D.boxes || {})[M.KEY.ability(ab)] || {};
    const exp = [E.fxLabel((o.b || []).flatMap(b => b.fx || [])), (o.nc || []).length || !(o.b || []).length ? 'see the rule' : ''].filter(Boolean).join('; ');
    const got = A.inArmy(a, () => A.dmgBand(ab)); if(got !== exp) fail('LB', a.id + '/' + u.id + ' · ' + ab.name, 'the band says “' + got + '”, its boxes “' + exp + '”'); else n++; }
  stats.bands = n; }
// LG the lines as drawn (modLines): one line for each condition and source, its source's name in it, no two sources on one line
{ let n = 0;
  for(const a of D.armies) for(const u of a.units) for(const kind of ['ranged', 'melee']){ if(!((kind === 'ranged' ? u.ranged : u.melee) || []).length) continue;
    const ms = A.inArmy(a, () => A.unitMods(u, kind)).filter(m => !A.rowMod(m, u) && !m.strat), html = A.inArmy(a, () => A.modLines(ms, u, false));
    const lines = html.split('<div class="mod">').slice(1).map(l => l.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'));
    const groups = new Set(ms.map(m => m.when ? m.when + '\0' + m.from : Math.random()));
    if(lines.length !== groups.size) fail('LG', a.id + '/' + u.id + ' ' + kind, lines.length + ' lines for ' + groups.size + ' conditions and sources');
    for(const l of lines){ const froms = [...new Set(ms.map(m => m.from))].filter(f => l.includes(f) && !ms.some(x => x.from !== f && x.from.includes(f) && l.includes(x.from)));
      if(froms.length !== 1 && !(froms.length > 1 && froms.every(f => l.includes(f)) && ms.filter(m => froms.includes(m.from)).some(m => froms.some(f => f !== m.from && m.when.includes(f))))) fail('LG', a.id + '/' + u.id + ' ' + kind, 'a line names ' + froms.length + ' sources: “' + l.slice(0, 90) + '”'); else n++; } }
  stats.grouped = n; }

fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive:true });
fs.writeFileSync(path.join(ROOT, 'verify/out/lines.json'), JSON.stringify({ stats, fails }, null, 1));
console.log('lines: ' + (fails.length ? fails.length + ' failure(s); ' : '') + stats.damaged + ' Damaged ranges, ' + stats.limits + ' once-per-battle chips, ' + stats.cpNotes + ' extra-CP chips and ' + stats.na + ' "does nothing here" chips as their words give them; ' + stats.statLines + ' lines under a profile from stat boxes; ' + stats.footnotes + ' footnotes (' + stats.rowValues + ' in a weapon row) under the weapons of every list unit, each a box of BOXES said in its effects\' and conditions\' labels, ' + stats.ncLines + ' "see the rule" lines; ' + stats.labels + ' catalogue labels with their values; ' + stats.covered + ' boxes with every condition of their words (' + stats.reachChecked + ' reach boxes and models scopes checked against GW’s phrase, ' + stats.reachUnchecked + ' unchecked, said “If (see the rule)”); ' + stats.bands + ' Damaged bands as their boxes; ' + stats.grouped + ' drawn lines, one source each; ' + stats.silentSources + ' sources the lists use, every sentence of the numbers counted or listed not counted');
for(const f of fails.slice(0, 60)) console.log('  FAIL ' + f);
process.exit(fails.length ? 1 : 0);
