#!/usr/bin/env node
/* verify/lines.js: the gate step "lines": the lines the app writes itself on a unit or stratagem screen stand on GW's words by fixed
   rules, as the Damage tab's boxes do (verify/evidence.js G1-G9).

     L0  columns a fixed rule derives from GW's words, stored = derived:
         damaged  an ability's Damaged range ("Damaged 1-6 W") is its words' "has 1-N wounds remaining" (or its name's "Damaged: 1-N
                  wounds remaining"), for every row that has one, and every list unit's ability with such words has it
         limit    a stratagem's "Once per battle" chip is exactly where its RESTRICTIONS say it can be used once per battle ("cannot use
                  this Stratagem more than once per battle", "can only use this Stratagem once per battle"; not "per battle round", not
                  "on the same … model")
     the footnotes under a unit's weapons (its weapon rows' "(+N)" values, its Damaged band, riled-up and own-aura lines among them) are
     its boxes, data.js BOXES (made by script from GW's words, held to them by verify/evidence.js G1-G9), each said with the labels of
     its effects and conditions (effects.js), as G1-G8 hold the Damage tab's boxes:
     L1  schema: no reading column the footnotes once had (mods, aura, mod, help, riled, …) is left in data.js (statNote: not yet; the
         When targeted columns, def and guard: verify/defence.js D1)
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

     node verify/lines.js      the gate step; writes verify/out/lines.json */
'use strict';
const fs = require('fs'), path = require('path');
const { ROOT } = require('./lib');
const E = require('../effects.js');
const X = require('./effects-extract');
const T = require('./tables');
const M = require('./effects-migrate');

const dm = require('./damage-node')(['unitMods', 'shownMods', 'fnLine', 'dmgBand', 'modLines', 'rowMod']);
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
const ONCE = /\b(?:cannot use this stratagem more than once per battle|can only use this stratagem once per battle)\b(?! round)/i;
{ let n = 0;
  const all = D.coreStratagems.map(s => ['Core · ' + s.name, s]).concat(Object.values(D.factions).flatMap(f => Object.values(f.detachments || {}).flatMap(d => (d.stratagems || []).map(s => [f.name + ' · ' + d.name + ' · ' + s.name, s]))));
  for(const [where, s] of all){
    const want = ONCE.test(X.plainCase(s.restrictions || '')) ? 'Once per battle' : undefined;
    if(s.limit !== want) fail('L0', where, 'limit ' + JSON.stringify(s.limit) + ', its RESTRICTIONS give ' + JSON.stringify(want || null) + ': “' + X.plainCase(s.restrictions || '') + '”');
    if(want) n++;
  }
  stats.limits = n; }

// ---- L1-L8: the footnotes under a unit's weapons are its boxes (data.js BOXES), said with the catalogue's labels ----
// L1  schema: no reading column the footnotes once had (mods, aura, mod, help, riled, …) is left in data.js
const RETIRED = new Set(['mods', 'aura', 'mod', 'help', 'riled', 'calcNote', 'fightOnDeath', 'comeback', 'calcDefs', 'react', 'weaponKw', 'defAlways', 'calcDef', 'defCalc', 'listWhy', 'lasts', 'single']);
// (statNote, the stat notes: not from boxes yet)
{ const RAW = T.read(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'));
  const walk = (x, where) => { if(Array.isArray(x)) return x.forEach((y, i) => walk(y, where + '[' + i + ']')); if(!x || typeof x !== 'object') return;
    for(const [k, v] of Object.entries(x)){ if(k === 'statNote') continue; if(RETIRED.has(k)) fail('L1', where, 'keeps the retired column ' + k); walk(v, where + '.' + k); } };
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
    && (!sc.wkw || it.ps.some(p => (p.kw || []).some(k => String(k).toUpperCase() === sc.wkw || String(k).toUpperCase().startsWith(sc.wkw + ' ')))) && (!sc.part || lc(it.who).startsWith(lc(sc.part).replace(/s$/, ''))));
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
        const sc = b.scope || {}, ws = sc.weapon || sc.wkw || sc.part ? weaponsOf(u, kind, sc) : null;
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
  const CV = { aura:[[3, '3"'], [6, '6"'], [9, '9"']], maxT:[[6, 'T 7+'], [3, 'T 4+']], targetKw:[[{ any:['Monster', 'Vehicle'] }, 'MONSTER or VEHICLE'], [{ none:['Monster', 'Vehicle'] }, 'not MONSTER/VEHICLE'], [{ all:['Psyker', 'Character'] }, 'PSYKER CHARACTER']],
    selfKw:[['Khorne', 'KHORNE']], selfGear:[[['gun', 'axe'], 'gun and axe']], opt:[['Option', 'Option']], q:[['If words', '“If words”']], anyOf:[[['A', 'B'], '“A” or “B”']] };
  for(const [id, c] of Object.entries(E.COND)){
    for(const [p, want] of CV[id] || [[true, null]]){ const l = c.label(p); if(want && !l.includes(want)) fail('L8', 'effects.js ' + id, 'its label for ' + JSON.stringify(p) + ' is “' + l + '”, not with “' + want + '”'); else n++; }
    if(id === 'selfKw' || id === 'selfGear') continue;   // (a keyword or wargear the unit lacks: no footnote at all)
    const p = (CV[id] || [[true]])[0][0], m = A.fnLine({ grp:'army', name:'R', key:'r|x' }, { quote:'', fx:[['hit', 1]], on:[[id, p]], kind:'all' }, u0, 'ranged', null);
    const exp = c.quoted ? 'If (see the rule)' : c.label(p);
    if(!m || m.when !== exp) fail('L8', 'effects.js ' + id, 'a box of it alone says “' + (m && m.when) + '”, not “' + exp + '”'); }
  stats.labels = n; }
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
console.log('lines: ' + (fails.length ? fails.length + ' failure(s); ' : '') + stats.damaged + ' Damaged ranges and ' + stats.limits + ' once-per-battle chips as their words give them; ' + stats.footnotes + ' footnotes (' + stats.rowValues + ' in a weapon row) under the weapons of every list unit, each a box of BOXES said in its effects\' and conditions\' labels, ' + stats.ncLines + ' "see the rule" lines; ' + stats.labels + ' catalogue labels with their values; ' + stats.bands + ' Damaged bands as their boxes; ' + stats.grouped + ' drawn lines, one source each');
for(const f of fails.slice(0, 60)) console.log('  FAIL ' + f);
process.exit(fails.length ? 1 : 0);
