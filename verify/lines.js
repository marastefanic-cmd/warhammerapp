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
     LB  a Damaged band (under the profile, and its footnote under the weapons) is GW's words as written
     LS  the lines under a unit's profile (app.html statLines, "Not Battle-shocked: OC 7 (Enraged Behemoths)"): for every list × unit
         exactly the stat boxes (BOXES st, effects.js ST) of the list's army and detachment rules that reach it, each said with its
         conditions' labels and its effect (the unit's characteristic with it, else its label), none the list printed into the value; and
         the words to them: every sentence of an army or detachment rule that adds to or subtracts from a characteristic of models is a stat
         box, every "if / while / unless / (excluding …)" in it one of its conditions; then, under the profile, each BOXES snc (a
         characteristic no stat box counts) of its abilities, another unit's aura reaching it, its rules and its stratagems, "not counted"
     LF  fixed cases: the wound-roll ignore-modifiers readings, the enemy-unit mark of a characteristic not counted, and whom one is for
         (its reach, an opening keyword, leading), an option's own list (its option and its rule's "While … it can use one of …"), and
         a stratagem's reach to the friendly models its words name as attackers
     LN  a summary never contradicts a counted number: a unit's line drawn as its source's summary (the AI-written short column, or a
         stratagem's gist: app.html srcShort) for a box that is counted (a footnote, a When targeted line, a line under the profile) has
         every number of that box's effects' labels (all of a pick's options), each "+1 AP" pair's characteristic (or its name: Move,
         Damage, Toughness, Leadership, Wounds), every [WEAPON ABILITY], and "hit" / "wound" where the label is about that roll
     LM  complete, mechanically: every line the program places on a list unit's screens (under its weapons, When targeted, under its profile,
         its enemy line, the Overview), one per source and named option (app.html sumLinesOf: a box's option, RULE_OPTIONS where the rule
         has them), finds its summary in its row's column for that placement (sumAtk, sumDef, sumSt, sumFoe, sumOv; a stratagem's gist): a
         missing one fails, naming the source, the placement, the option and the list; and every entry of those columns (its text, each
         "<option> ⇒" line) is a line some list shows: a stale one fails. A summary holds only its effect: no "Granted by", no "(<its
         name>)", no CP cost, no stratagem phase (the program writes them), and lines only for options
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

const dm = require('./damage-node')(['unitMods', 'shownMods', 'fnLine', 'dmgBand', 'modLines', 'rowMod', 'statLines', 'statShown', 'defenceItems', 'defLines', 'sumMode', 'sumLinesOf', 'srcShort', 'enhRowOf', 'lineKey', 'PREGAME_RE', 'naReason', 'inertRule', 'faction', 'detachments', 'detRules', 'alreadyIn', 'alreadyInRule', 'allStratagems', 'canTarget', 'hasRule', 'unitDetRules', 'ruleRowOf']);
const D = dm.D, A = dm.app, fails = [], stats = {};
// the boxes as the screens count them (the two-reader rule: data.js AGREE, effects.js agreed): the footnotes, the lines under a profile and
// the Damaged bands are these; the boxes' own checks (their schema, their words) are of data.js BOXES itself
const BX = E.agreed(D.boxes, D.agree);
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
// (the enemy unit another unit's rule selects, on a unit other than that one: "Target selected by the Psychophage", no article before an EPIC
// HERO's name or one with its own; how long only where its box's lasts says: "this turn", "until the end of the battle")
const condWords = (id, p, u, giver, own, b, gu) => { const C = E.COND[id];
  if(id === 'aura') return own ? 'Own aura' : giver ? 'Within ' + p + '" of ' + giver : C.label(p);
  if(id === 'selected' && giver) return 'Selected by ' + giver;
  if(id === 'targetSelected' && giver) return 'Target selected by ' + (/^the /i.test(giver) || (gu && (gu.kw || []).some(k => /^epic hero$/i.test(k))) ? '' : 'the ') + giver + ({ turn:' this turn', battle:' until the end of the battle' }[(b || {}).lasts] || '');
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
    for(const S of srcs){ const o = BX[S.key]; if(!o) continue;
      if(S.played && !o.played) fail('L4', where, S.name + ' is not a played source in BOXES');
      const bk = bakedOf(u, S.name); let fell = false;
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
        // (a box the two-reader rule does not confirm, where it would have been a footnote: its rule's words, not counted, below)
        if(b.unconfirmed){ fell = true; continue; }
        if(b.pick ? !b.pick.some(p => keep(p.fx).length) : !keep(b.fx).length) continue;
        want.push({ S, b, ws, keep });
      }
      // (its words about its attacks no catalogue effect reads: one "not counted here: see the rule" line; not another unit's, not a band's)
      // (and a box of it the two-reader rule does not confirm, where it reaches: another unit's too, the unit it is from in its line)
      const ncWant = !S.damaged && (fell || (S.grp !== 'other' && (o.nc || []).some(x => x.atk && !x.unconfirmed))), msN = got.filter(m => m.ncLine && m.key === S.key);
      if(ncWant){ const gv = S.grp === 'other' && S.src && S.src !== u ? (g => g && g.who && S.src.leads && (S.src.also || []).some(c => c.name === g.who) ? g.who : S.src.short || S.src.name)((S.src.abilities || []).find(x => x.name === S.name)) : '';
        const exp = 'not counted here: see the rule' + (gv ? ' (' + gv + ')' : '');
        if(msN.length !== 1) fail('L4', where, S.name + ': its words not counted, ' + msN.length + ' "see the rule" lines');
        else if(msN[0].note !== exp || msN[0].when) fail('L3', where, S.name + ' not-counted line “' + msN[0].note + '”, want “' + exp + '”'); else nNc++; }
      else if(msN.length) fail('L4', where, S.name + ': a "see the rule" line where nothing of it is left out here'); }
    // exactly these, once each
    for(const w of want){ const ms = got.filter(m => m.box === w.b && m.key === w.S.key);
      if(ms.length !== 1){ fail('L4', where, (ms.length ? ms.length + ' footnotes' : 'no footnote') + ' for the box of ' + w.S.name + ' “' + X.plainCase(w.b.quote).slice(0, 70) + '”'); continue; }
      const m = ms[0]; nLines++;
      // L3 its effects' words
      const fx = w.b.pick ? null : w.keep(w.b.fx);
      const giver = w.S.src && w.S.src !== u ? (g => g && g.who && w.S.src.leads ? g.who : w.S.src.short || w.S.src.name)((w.S.src.abilities || []).find(x => x.name === w.S.name)) : '';
      const gv = giver && w.S.src.leads && ![w.S.src.name].concat((w.S.src.also || []).map(c => c.name)).includes(giver) ? w.S.src.short || w.S.src.name : giver;
      const own = w.S.grp === 'unit' && w.b.mark === 'aura';
      const cw = on => (on || []).map(([id, p]) => condWords(id, p, u, gv, own, w.b, w.S.src)).join(' · ');
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
// LF fixed cases of readings once wrong (each GW's words, verbatim): ignoring modifiers to the wound roll is read where GW says it, and only
// there (Martial Ka'tah, Unshakeable Opponents, Bearers of His Light; Inevitable Annihilation's hit rolls alone and Stabilisation Talons not);
// an enemy unit's characteristic is said as the enemy's (BOXES snc foe), a friendly one never is
{ let n = 0;
  const FX_FIX = [["Your unit can ignore modifiers to your unit’s: Hit rolls and wound rolls.", ['ignoreWoundMods']],
    ["Until the end of the turn, each time a model in your unit makes an attack, you can ignore any or all modifiers to the following: that attack’s Ballistic Skill or Weapon Skill characteristic; the **Hit roll**; the **Wound roll**.", ['ignoreHitMods', 'ignoreWoundMods']],
    ["Your unit’s melee attacks can ignore modifiers to **hit rolls** and **wound rolls**.", ['ignoreHitRollMods', 'ignoreWoundMods']],
    ["Your unit can ignore modifiers to your unit’s: **Hit rolls**.", []],
    ["Each time a model in this unit makes an attack with a ranged weapon, you can ignore any or all modifiers to the **Hit roll** and any or all modifiers to the Ballistic Skill characteristic of that weapon.", ['ignoreHitMods']]];
  for(const [t, want] of FX_FIX){ const got = X.findFx(E.norm(t)).fx.map(([id]) => id).filter(id => /^ignore/.test(id)).sort().join(',');
    if(got !== want.slice().sort().join(',')) fail('LF', 'effects.js ignore modifiers', '“' + t.slice(0, 70) + '” reads ' + (got || 'nothing') + ', GW: ' + (want.join(',') || 'none of the wound roll')); else n++; }
  const FOE_FIX = [['While an enemy model is within 3" of this unit, that enemy model has -1 **OC**.', true], ['While a unit is wracked with agonies, subtract 2" from its Move characteristic and subtract 2 from **Charge rolls** made for that unit.', true],
    ['While an enemy unit is within **Engagement Range** of this unit, halve the Objective Control characteristic of models in that enemy unit.', true],
    ['While a friendly **THOUSAND SONS** unit is within 6" of this **PSYKER**, add 2" to the Move characteristic of models in that unit.', false], ['Add 2 to the bearer’s Wounds characteristic.', false]];
  for(const [t, foe] of FOE_FIX){ const x = X.statNc({ type:'ability', text:t }, [], [], [], null)[0];
    if(!x || !!x.foe !== foe) fail('LF', 'effects-extract.js statNc', '“' + t.slice(0, 70) + '” ' + (x ? (x.foe ? 'said' : 'not said') + ' as an enemy unit’s' : 'not read') + ', GW: ' + (foe ? 'an enemy unit’s' : 'its own or a friendly unit’s')); else n++; }
  // (and whom a not-counted characteristic is for, as GW's words say: the friendly units it names, an opening keyword condition, leading;
  // never a keyword of a clause inside the sentence)
  const Vf = require('./derive').vocab(D), J = x => JSON.stringify(x === undefined ? null : x);
  const WHO_FIX = [['While a friendly **WAR DOG** model is within 9" of this model, improve that **WAR DOG** model’s Leadership and Objective Control characteristics by 1.', { all:['War Dog'] }, null],
    ['Friendly **LEGIONES DAEMONICA CHARACTER** models (excluding **MONSTER** models) have +1 **Ld** and **OC**.', { all:['Faction: Legiones Daemonica', 'Character'], none:['Monster'] }, null],
    ['**Daemon Prince of Slaanesh:** If this model has the **SLAANESH** keyword, add 2" to this model’s Move characteristic.', null, [['selfKw', 'Slaanesh']]],
    ['Instead, until the end of the phase, add 6" to the Move characteristic of models in your unit, or 9" instead if your unit is an **ARMIGER** or **DESTRIER** unit.', null, null],
    ['While this model is leading a unit, models in that unit have a Move characteristic of 10" and each time a model in that unit makes a Normal, Advance, Fall Back or Charge move, it can move horizontally through terrain features.', null, [['leading', true]]]];
  for(const [t, reach, on] of WHO_FIX){ const xs = X.statNc({ type:'ability', text:t }, [], [], [], Vf);
    if(!xs.length || xs.some(x => J(x.reach) !== J(reach) || J(x.on) !== J(on))) fail('LF', 'effects-extract.js statNc', '“' + t.replace(/\*\*/g, '').slice(0, 70) + '” is for ' + (xs.length ? J(xs[0].reach) + ' ' + J(xs[0].on) : 'nothing') + ', GW: ' + J(reach) + ' ' + J(on)); else n++; }
  // (an option's own list keeps the option and its rule's words of when an option can be used: Malefic Surge's Unnatural Fortitude, its
  // "- " lines under "- **Unnatural Fortitude:** …:", is Empowered as Diabolic Power is; GW's words, verbatim)
  const MS = 'Then, until the start of your next Command phase, that unit is Empowered. While a unit is Empowered it can use one of the Malefic Surge abilities below.\n- **Unholy Hunger:** When a model in this unit makes a **Normal**, **Advance** or **Fall Back move**, until the end of the phase, add 3" to its Move characteristic.\n- **Unnatural Fortitude:** When this unit is selected as the target of an attack, select one of the following to apply until the end of the phase:\n- Models in this unit have a 5+ invulnerable save.\n- Models in this unit have the **Feel No Pain 6+** ability.';
  const OPT_FIX = [[MS, 'Unnatural Fortitude', 'While a unit is Empowered it can use one of the Malefic Surge abilities below']];
  for(const [t, opt, q] of OPT_FIX){ const r = X.extract({ type:'rule', name:'fixed', text:t }, { V:Vf, weapons:[] }), d = (r.d || [])[0];
    if(!d || J(d.on.filter(x => x[0] === 'opt' || x[0] === 'q' && x[1] === q)) !== J([['opt', opt], ['q', q]]) || (d.pick || []).length !== 2) fail('LF', 'effects-extract.js option list', '“' + t.slice(0, 70) + '” reads ' + (d ? J(d.on) : 'no defence box') + ', GW: the option ' + opt + ', “' + q + '”'); else n++; }
  // (a stratagem's box for the friendly models its words name as attackers reaches them; one for its own unit's attacks does not)
  const IW = { type:'strat', name:'fixed', when:'Your Shooting phase or the Fight phase.', target:'One **SYNAPSE** unit from your army that has not been selected to shoot or fight this phase, and one enemy unit within 24" of and visible to the **SYNAPSE** unit.' };
  const REACH_FIX = [[Object.assign({}, IW, { effect:'Until the end of the phase, each time a friendly **TYRANIDS** model makes an attack that targets that enemy unit, if the attacking model’s unit is within 6" of your **SYNAPSE** unit, re-roll a **Hit roll** of 1 and re-roll a **Wound roll** of 1.' }), { all:['Faction: Tyranids'] }, 'friendly'],
    [{ type:'strat', name:'fixed', when:'Your Shooting phase or the Fight phase.', target:'One **TYRANIDS** unit from your army that has not been selected to shoot or fight this phase.', effect:'Until the end of the phase, each time a model in your unit makes an attack, re-roll a **Hit roll** of 1.' }, null, null]];
  for(const [s, reach, mark] of REACH_FIX){ const b = (X.extract(s, { V:Vf, weapons:[] }).boxes || [])[0];
    if(!b || J(b.reach) !== J(reach) || J(b.mark) !== J(mark)) fail('LF', 'effects-extract.js stratagem reach', '“' + X.plainCase(s.effect).slice(0, 70) + '” reaches ' + (b ? J(b.reach) + ' ' + J(b.mark) : 'no box') + ', GW: ' + J(reach) + ' ' + J(mark)); else n++; }
  stats.fixed = n; }
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
      for(const r of rules) for(const b of (BX[M.KEY.rule(r)] || {}).st || []){
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
      // (where its words reach: its reach, else a rule's needs; a keyword of the unit it needs, on selfKw)
      const said = new Set(), snc = (key, name, needs) => { for(const x of (BX[key] || {}).snc || []){
        if(x.reach ? !meetsN(x.reach, u) : needs !== undefined && !(needs && meetsN(needs, u))) continue;
        if((x.on || []).some(([id, p]) => (id === 'selfKw' && !hasK(u, p)) || (id === 'leading' && !u.leads))) continue;
        if(said.has(name + '|' + x.stat + (x.foe ? '|foe' : '')) || (u.stats.length && u.stats.every(s => String([].concat((s.from || {})[x.stat] || []).join(', ')).split(/\s*,\s*/).includes(name)))) continue;
        said.add(name + '|' + x.stat + (x.foe ? '|foe' : '')); want.push(name + ' | ' + (x.foe ? 'Enemy units’ ' : '') + x.stat + ': not counted here: see the rule'); } };
      // (in the order of docs/summaries.md 40: army-wide rules, then the unit's own, then other units', then stratagems)
      // (a rule's: the units that have it, an army rule on its Rules line or its needs met, a detachment rule's needs met)
      const own = new Set(A.inArmy(a, () => A.unitDetRules(u)).map(r => r.name));
      for(const r of rules){ const army = (F.armyRules || []).includes(r);
        if(army ? A.inArmy(a, () => A.hasRule(u, r.name)) || (r.needs && meetsN(r.needs, u)) : own.has(r.name)) snc(M.KEY.rule(r), r.name); }
      for(const ab of u.abilities || []) snc(M.KEY.ability(ab), ab.name);
      for(const x of a.units) if(x !== u) for(const ab of x.abilities || []){ const o = BX[M.KEY.ability(ab)] || {};
        if(/\baura\b/i.test(ab.tag || '') && o.reach && meetsN(o.reach, u)) snc(M.KEY.ability(ab), ab.name); }
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
// LB the Damaged band: its words are GW's, as written (no AI, no label)
{ let n = 0;
  for(const a of D.armies) for(const u of a.units) for(const ab of u.abilities || []) if(ab.damaged){ const o = BX[M.KEY.ability(ab)] || {};
    // (GW's words, as written, their markup aside: the owner's decision, 4 Nov 2026)
    const exp = String(ab.text || '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim(); void o;
    const got = A.inArmy(a, () => A.dmgBand(ab)); if(got !== exp) fail('LB', a.id + '/' + u.id + ' · ' + ab.name, 'the band says “' + got + '”, its boxes “' + exp + '”'); else n++; }
  stats.bands = n; }
// LN a summary has its counted box's numbers
const STAT_NAME = { M:'Move', D:'Damage', T:'Toughness', Ld:'Leadership', W:'Wounds', A:'Attacks', S:'Strength', OC:'Objective Control', BS:'Ballistic Skill', WS:'Weapon Skill', AP:'Armour Penetration' };
const sumMisses = (label, sum) => { const out = [], l = String(label), t = String(sum), lc = t.toLowerCase();
  for(const m of l.matchAll(/(?<![\w-])(D?\d+(?:[-–]\d+)?\+?)/g)){ const n = m[1].replace('–', '-'); if(!new RegExp('(?<![\\d])' + n.replace(/[+]/g, '\\+') + (/\+$/.test(n) ? '' : '(?![\\d])')).test(t.replace('–', '-'))) out.push(n); }
  for(const m of l.matchAll(/\d+"? ?(A|S|AP|D|BS|WS|OC|M|T|W|Ld)\b/g)){ const k = m[1]; if(!new RegExp('(?<![\\w-])' + k + '(?![\\w])').test(t) && !lc.includes(STAT_NAME[k].toLowerCase())) out.push(k); }
  for(const m of l.matchAll(/\[([^\]:]+)/g)) if(!lc.includes('[' + m[1].toLowerCase())) out.push('[' + m[1] + ']');
  if(/\bhit\b/i.test(l) && !/\bhit/i.test(t)) out.push('hit'); if(/\bwound roll/i.test(l) && !/\bwound/i.test(t)) out.push('wound');
  return out; };
{ let n = 0;
  const boxLabels = (b, f) => b.pick ? b.pick.map(p => f(p[b.df ? 'df' : 'fx'] || p.fx || p.df || [])) : [f(b.fx || b.df || [])];
  for(const a of D.armies) for(const u of a.units) A.inArmy(a, () => {
    const where = a.id + '/' + u.id;
    for(const kind of ['ranged', 'melee']) for(const m of A.unitMods(u, kind)){ if(m.ncLine || !m.box || !A.sumMode(m) || !m.short) continue; n++;
      for(const l of (m.box.pick ? m.box.pick.map(p => E.fxLabel(p.fx || [])) : [E.fxLabel(m.box.fx || [])]).concat(m.box.part && m.box.part.fx ? [E.fxLabel(m.box.part.fx)] : []))
        for(const x of sumMisses(l, m.short)) fail('LN', where + ' ' + kind, m.from + ': its summary “' + m.short + '” lacks “' + x + '” of its counted “' + l + '”'); }
    for(const x of A.defenceItems(u)){ if(x.ncLine || !x.box || !x.sum) continue; n++; const sumAll = x.short;
      for(const l of x.box.pick ? x.box.pick.map(p => E.dfLabel(p.df || [])) : [E.dfLabel(x.box.df || [])])
        for(const y of sumMisses(l, sumAll)) fail('LN', where + ' When targeted', x.name + ': its summary “' + sumAll + '” lacks “' + y + '” of its counted “' + l + '”'); }
    for(const x of A.statShown(u)){ if(!x.short) continue; const r = A.ruleRowOf(x.rule); if(!r) continue;
      for(const b of (BX[M.KEY.rule(r)] || {}).st || []) for(const [id, p] of b.st || []){ const f = E.ST[id]; if(!f) continue; n++;
        for(const y of sumMisses(f.label(p), x.short)) fail('LN', where + ' profile', x.rule + ': its summary “' + x.short + '” lacks “' + y + '” of its counted “' + f.label(p) + '”'); } }
  });
  stats.summaries = n; }
// LM every placed line finds its summary; every summary entry is used; a summary holds only its effect
{ const used = new Set(), C = { atk:'sumAtk', def:'sumDef', st:'sumSt', foe:'sumFoe', ov:'sumOv' };
  let n = 0;
  // (the row a summary is read from, as app.html srcShort reads it)
  const rowOf = (ab, name, ruleName, col) => ab && ab[col] !== undefined ? 'ab|' + ab.name + '|' + ab.text : ab && A.enhRowOf(ab.name) ? 'enh|' + ab.name : ruleName ? 'rule|' + ruleName : ab ? 'ab|' + ab.name + '|' + ab.text : 'rule|' + name;
  const need = (where, src, place, opt, ok, row) => { n++; if(row) used.add(row + '|' + C[place] + '|' + (opt || '')); if(!ok) fail('LM', where, src + ': no summary for its line ' + ({ atk:'under the weapons', def:'When targeted', st:'under the profile', foe:'on enemy units', ov:'on the Overview' })[place] + (opt ? ', option ' + opt : '') + ' (' + C[place] + ')'); };
  for(const a of D.armies) A.inArmy(a, () => { for(const u of a.units){ const where = a.id + '/' + u.id;
    // under the weapons: each source's line (a stratagem: its gist), per named option
    const g = new Map();
    for(const kind of ['ranged', 'melee']) if(((kind === 'ranged' ? u.ranged : u.melee) || []).length) for(const m of A.unitMods(u, kind)){ if(m.core || m.damaged) continue; const k = A.lineKey(m); if(!g.has(k)) g.set(k, []); g.get(k).push(m); }
    for(const items of g.values()){ const m = items[0];
      if(m.strat){ need(where, m.from, 'atk', '', !!m.short); continue; }
      const ab = m.rule ? null : ((m.src || u).abilities || []).find(x => x.name === m.from), row = rowOf(ab, m.from, m.rule, 'sumAtk');
      if(!m.short){ need(where, m.from, 'atk', '', false); continue; }
      for(const l of A.sumLinesOf(items)) need(where, m.from, 'atk', l.opt, !!l.text, row); }
    // When targeted, and this unit's own effects on enemies (its enemy line)
    for(const x of A.defenceItems(u)){ if(x.rl || x.dup) continue; const S = x.S || {};
      if(x.foeOwn){ const t = A.srcShort(S, 'foe'); need(where, x.name, 'foe', '', !!t, rowOf(S.ab, x.name, null, 'sumFoe')); continue; }
      if(x.a === 'strat'){ need(where, x.name, 'def', '', !!x.short); continue; }
      const row = rowOf(S.ab, x.name, x.a === 'rule' ? x.name : null, 'sumDef');
      if(!x.short){ need(where, x.name, 'def', '', false); continue; }
      for(const l of A.defLines([x])) need(where, x.name, 'def', l.opt, !l.gap, row); }
    // under the profile (and enemy lines there)
    for(const x of A.statShown(u)){ const pl = x.foe ? 'foe' : 'st'; if(x.a === 'strat'){ need(where, x.rule, pl, '', !!x.short); continue; }
      const ab = x.a === 'ability' ? (u.abilities.concat(...a.units.map(y => y.abilities)).find(y => require('./tables') && y.name === x.rule)) : null;
      need(where, x.rule, pl, '', !!x.short, ab ? rowOf(ab, x.rule, null, C[pl]) : 'rule|' + x.rule); } }
    // the Overview's lines (app.html screenPregame: the rules and abilities it lists with their summaries)
    const f = A.faction(), dets = A.detachments(), RE = A.PREGAME_RE, tests = t => /read mission objectives/i.test(t) || RE.test(t) || /\bstart of the battle\b(?! round)/i.test(t) || /start of the first battle round/i.test(t) || /start of (the|each|every) battle round/i.test(t);
    for(const r of f.armyRules.filter(r => !A.inertRule(r.name)).concat(dets.flatMap(A.detRules))) if(tests(r.text)) need(a.id + ' Overview', r.name, 'ov', '', !!r.sumOv, 'rule|' + r.name);
    const seenAb = new Set(); for(const u of a.units) for(const ab of u.abilities.filter(ab => !A.naReason(ab))) if(tests(ab.text) && !seenAb.has(ab.name + '|' + ab.text)){ seenAb.add(ab.name + '|' + ab.text); need(a.id + ' Overview', ab.name, 'ov', '', !!ab.sumOv, rowOf(ab, ab.name, null, 'sumOv')); }
  });
  // (every entry of a summary column is used; none holds what the program writes)
  const RAW = T.read(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8')), rows = [];
  for(const S of Object.values(RAW.S ? RAW.S.value : {})) for(const ab of S.abilities || []) rows.push(['ab|' + ab.name + '|' + ab.text, ab, ab.name]);
  for(const fk of Object.keys(D.factions)){ const F = D.factions[fk];
    for(const r of F.armyRules || []) rows.push(['rule|' + r.name, r, r.name]);
    for(const d of Object.values(F.detachments || {})){ for(const r of d.rule ? [d.rule].concat(d.moreRules || []) : []) rows.push(['rule|' + r.name, r, r.name]); for(const e of d.enhancements || []) rows.push(['enh|' + e.name, e, e.name]); } }
  const P = t => { const plain = [], opts = []; for(const l of String(t).split('\n').filter(Boolean)){ const i = l.indexOf(' ⇒ '); if(i > 0) opts.push([l.slice(0, i), l.slice(i + 3)]); else plain.push(l); } return { plain, opts }; };
  const own = t => /granted by/i.test(t) ? 'a "Granted by"' : /^\d+CP\b/.test(t) ? 'a CP cost' : '';
  const seenRow = new Set();
  for(const [id, o, name] of rows){ if(seenRow.has(id + '|' + JSON.stringify(Object.keys(C).map(k => o[C[k]])))) continue; seenRow.add(id + '|' + JSON.stringify(Object.keys(C).map(k => o[C[k]])));
    for(const c of Object.values(C)) if(typeof o[c] === 'string'){ const p = P(o[c]);
      for(const t of p.plain.concat(p.opts.map(x => x[1]))){ const w = own(t) || (t.includes('(' + name + ')') ? 'its name in brackets' : ''); if(w) fail('LM', id.split('|').slice(0, 2).join(' · '), c + ' holds ' + w + ', which the program writes: “' + t.slice(0, 60) + '”'); }
      if(p.plain.length > 1) fail('LM', id.split('|').slice(0, 2).join(' · '), c + ' has ' + p.plain.length + ' lines with no option: one line, or one per option (“<option> ⇒ …”)');
      if(p.plain.length && !used.has(id + '|' + c + '|')) fail('LM', id.split('|').slice(0, 2).join(' · '), c + ' is stale: no list shows its line there');
      for(const [opt] of p.opts) if(!used.has(id + '|' + c + '|' + opt)) fail('LM', id.split('|').slice(0, 2).join(' · '), c + ' option ' + opt + ' is stale: no list shows that option there'); } }
  const PHASE_LEAD = /^(in|at) (the (start|end) of )?(the |your |your opponent’s |your opponent's )?(any|command|movement|shooting|charge|fight) phase\b/i;
  for(const s of D.coreStratagems.concat(...Object.values(D.factions).flatMap(F => Object.values(F.detachments || {}).map(d => d.stratagems || []))))
    if(s.gist && (PHASE_LEAD.test(s.gist) || own(s.gist) || s.gist.includes('(' + s.name + ')'))) fail('LM', 'stratagem ' + s.name, 'its gist holds what the program writes (the phase, a CP cost, "Granted by" or its name): “' + s.gist.slice(0, 60) + '”');
  stats.placed = n; }
// LG the lines as drawn (modLines): one line for each condition and source (a source drawn as its summary: one line), its source's name in it, no two sources on one line
{ let n = 0;
  for(const a of D.armies) for(const u of a.units) for(const kind of ['ranged', 'melee']){ if(!((kind === 'ranged' ? u.ranged : u.melee) || []).length) continue;
    const ms = A.inArmy(a, () => A.unitMods(u, kind)).filter(m => !A.rowMod(m, u) && !m.strat), html = A.inArmy(a, () => A.modLines(ms, u, false));
    const lines = html.split('<div class="mod">').slice(1).map(l => l.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'));
    // (a source drawn as its summary is one line, whatever its conditions: app.html lineKey)
    const gm = new Map(); for(const m of ms){ const k = A.sumMode(m) || m.damaged ? A.lineKey(m) : m.when ? m.when + '\0' + m.from : Math.random(); if(!gm.has(k)) gm.set(k, []); gm.get(k).push(m); }
    // (a source drawn as its summary: a line per named option, app.html sumLinesOf)
    const groups = { size:[...gm.values()].reduce((t, it) => t + (A.sumMode(it[0]) ? A.sumLinesOf(it).length : 1), 0) };
    if(lines.length !== groups.size) fail('LG', a.id + '/' + u.id + ' ' + kind, lines.length + ' lines for ' + groups.size + ' conditions and sources');
    // (the rule that makes a unit always riled up, named in its "Riled up (…: always riled up)" condition, is no source of the line: Super
    // Runts, whose own box is a not-counted line of its own where the two-reader rule does not confirm it)
    // (a summary's own words may name another rule, Blood Tithe's "Blessings of Khorne": the source a line names is its "(name)", the summary aside)
    const sums = [...new Set(ms.filter(m => A.sumMode(m)).flatMap(m => String(m.short).split('\n').map(l => l.includes(' ⇒ ') ? l.slice(l.indexOf(' ⇒ ') + 3) : l)))].filter(Boolean).sort((x, y) => y.length - x.length);
    for(const l1 of lines){ const l0 = sums.reduce((t, x) => t.split(x).join(' '), l1), l = l0.replace(/\(([^()]*): always riled up\)/g, '(always riled up)'), froms = [...new Set(ms.map(m => m.from))].filter(f => l.includes(f) && !ms.some(x => x.from !== f && x.from.includes(f) && l.includes(x.from)));
      if(froms.length !== 1 && !(froms.length > 1 && froms.every(f => l.includes(f)) && ms.filter(m => froms.includes(m.from)).some(m => froms.some(f => f !== m.from && m.when.includes(f))))) fail('LG', a.id + '/' + u.id + ' ' + kind, 'a line names ' + froms.length + ' sources: “' + l.slice(0, 90) + '”'); else n++; } }
  stats.grouped = n; }

fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive:true });
fs.writeFileSync(path.join(ROOT, 'verify/out/lines.json'), JSON.stringify({ stats, fails }, null, 1));
console.log('lines: ' + (fails.length ? fails.length + ' failure(s); ' : '') + stats.damaged + ' Damaged ranges, ' + stats.limits + ' once-per-battle chips, ' + stats.cpNotes + ' extra-CP chips and ' + stats.na + ' "does nothing here" chips as their words give them; ' + stats.statLines + ' lines under a profile from stat boxes; ' + stats.footnotes + ' footnotes (' + stats.rowValues + ' in a weapon row) under the weapons of every list unit, each a box of BOXES said in its effects\' and conditions\' labels, ' + stats.ncLines + ' "see the rule" lines; ' + stats.labels + ' catalogue labels with their values; ' + stats.covered + ' boxes with every condition of their words (' + stats.reachChecked + ' reach boxes and models scopes checked against GW’s phrase, ' + stats.reachUnchecked + ' unchecked, said “If (see the rule)”); ' + stats.bands + ' Damaged bands as their boxes; ' + stats.grouped + ' drawn lines, one source each; ' + stats.silentSources + ' sources the lists use, every sentence of the numbers counted or listed not counted; ' + stats.fixed + ' fixed cases; ' + stats.summaries + ' counted boxes drawn as a summary, each summary with their numbers (LN); ' + stats.placed + ' placed lines, each with its summary, every summary used (LM)');
for(const f of fails.slice(0, 60)) console.log('  FAIL ' + f);
process.exit(fails.length ? 1 : 0);
