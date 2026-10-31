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
     L1  schema: no reading column the footnotes once had (mods, aura, mod, help, riled, …) is left in data.js (guard, statNote: not yet)
     L2  every footnote of every list × unit × kind is a box the database gives that unit
     L3  its effects' words are its box's effects' labels (a pick's options, a part), or its one weapon's row value
     L4  completeness: every box the database gives the unit for this kind of attack is one footnote, once
     L5  its conditions' words are its box's conditions' labels, with the fixed forms of app.html fnCond
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

const dm = require('./damage-node')(['unitMods', 'shownMods', 'fnLine']);
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
// L1  schema: no reading column the footnotes once had (mods, aura, mod, help, riled, …) is left in data.js, but guard's (When targeted,
//     not yet from boxes)
const RETIRED = new Set(['mods', 'aura', 'mod', 'help', 'riled', 'calcNote', 'fightOnDeath', 'comeback', 'calcDefs', 'react', 'weaponKw', 'defAlways', 'calcDef', 'defCalc', 'listWhy', 'lasts', 'single']);
// (guard, the When targeted help, and statNote, the stat notes: not from boxes yet)
{ const RAW = T.read(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'));
  const walk = (x, where) => { if(Array.isArray(x)) return x.forEach((y, i) => walk(y, where + '[' + i + ']')); if(!x || typeof x !== 'object') return;
    for(const [k, v] of Object.entries(x)){ if(k === 'guard' || k === 'statNote') continue; if(RETIRED.has(k)) fail('L1', where, 'keeps the retired column ' + k); walk(v, where + '.' + k); } };
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
const hasK = (u, k) => (u.kw || []).some(x => x.toLowerCase() === String(k).toLowerCase());
const mc = u => u.models.reduce((t, m) => t + (parseInt(m, 10) || 1), 0);
const condWords = (id, p, u, giver, own) => { const C = E.COND[id];
  if(id === 'aura') return own ? 'Own aura' : giver ? 'Within ' + p + '" of ' + giver : C.label(p);
  if(id === 'selected' && giver) return 'Selected by ' + giver;
  if(id === 'belowStarting' && mc(u) === 1) return 'Lost any wounds (' + C.label(p) + ')';
  if(id === 'belowHalf' && mc(u) === 1) return (Math.ceil((parseInt(u.stats[0].W, 10) || 0) / 2) - 1) + ' or fewer wounds left (' + C.label(p) + ')';
  return C.label(p); };
let nLines = 0, nRows = 0;
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
        const keep = fx => (fx || []).filter(([id, p]) => !baked(bk, id, p) && !hasAll(E.fxLabel([[id, p]])));
        if((b.on || []).some(([id, p]) => (id === 'selfKw' && !hasK(u, p)) || (id === 'selfGear' && !p.every(g => wn.some(n => n.startsWith(String(g).toLowerCase())))))) continue;
        if(b.pick ? !b.pick.some(p => keep(p.fx).length) : !keep(b.fx).length) continue;
        want.push({ S, b, ws, keep });
      } }
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
      const part = x => x && x.fx && x.fx.length ? ' (' + cw(x.on) + ': ' + E.fxLabel(x.fx) + ')' : '';
      if(m.set){ nRows++;
        if(!fx || !w.ws || w.ws.length !== 1 || w.S.damaged || w.S.strat || !fx.every(([id]) => ROW[id] || SET[id])) fail('L3', where, 'a row value of ' + w.S.name + ' that is no one weapon\'s characteristic');
        else { const exp = Object.fromEntries(fx.map(([id, p]) => ROW[id] ? [ROW[id], '+' + String(p).toUpperCase()] : [SET[id], String(p)]));
          if(JSON.stringify(exp) !== JSON.stringify(m.set) || m.weapon !== w.ws[0].ps[0].name) fail('L3', where, w.S.name + ' row ' + m.weapon + ' ' + JSON.stringify(m.set) + ', its box gives ' + w.ws[0].ps[0].name + ' ' + JSON.stringify(exp)); } }
      else { const bOn = new Set((w.b.on || []).map(x => JSON.stringify(x)));
        const exp = fx ? E.fxLabel(fx) + part(w.b.part) : 'one of: ' + w.b.pick.map(p => Object.assign({}, p, { fx:w.keep(p.fx) })).filter(p => p.fx.length).map(p => { const pon = (p.on || []).filter(x => !bOn.has(JSON.stringify(x)));
          return (p.name !== E.fxLabel(p.fx) ? p.name + ': ' : '') + E.fxLabel(p.fx) + (pon.length ? ' (' + cw(pon) + ')' : '') + part(p.part); }).join(' · ');
        if(m.note !== exp) fail('L3', where, w.S.name + ' says “' + m.note + '”, its box “' + exp + '”');
        if(fx && w.ws && w.ws.length === 1 && !w.ws[0].group && !w.S.damaged && !w.S.strat && fx.every(([id]) => ROW[id] || SET[id])) fail('L3', where, w.S.name + ': one weapon\'s characteristic, not in its row'); }
      // L5 its conditions' words
      const sPh = w.S.s && (w.S.s.phases || []).length === 1 ? ((w.S.s.turns && w.S.s.turns[w.S.s.phases[0]]) || w.S.s.turn) : null;
      const cond = cw(w.b.on);
      const expW = sPh ? [(sPh === 'your' ? 'Your ' : sPh === 'opp' ? 'Your opponent’s ' : '') + w.S.s.phases[0].replace(/^./, c => c.toUpperCase()) + ' phase', cond].filter(Boolean).join(', ') : cond || (w.S.strat ? '' : w.b.kind === 'ranged' ? 'Every ranged attack' : w.b.kind === 'melee' ? 'Every melee attack' : 'Every attack');
      if(m.when !== expW) fail('L5', where, w.S.name + ' when “' + m.when + '”, its box “' + expW + '”');
    }
    // L2 nothing else: every footnote is one of these boxes
    for(const m of got) if(!want.some(w => w.b === m.box && w.S.key === m.key)) fail('L2', where, 'the footnote of ' + m.from + ' “' + m.note + '” is no box the database gives this unit');
  } }
stats.footnotes = nLines; stats.rowValues = nRows;
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
  const band = (html.split('// (a Damaged band: its range')[1] || '').split('\n').slice(0, 6).join('\n');
  if(!band || /\.mods\b|m\.note\b/.test(band)) fail('L6', 'app.html screenUnit', 'the Damaged band reads no box: ' + (band ? 'a reading’s note' : 'not found'));
  if(/Riled up: 5\+ INV|'\[ASSAULT\]'|Made a charge move this turn|BS improved by 1/.test(fnSrc('unitMods') + fnSrc('shownMods'))) fail('L6', 'app.html', 'a rule written in the footnotes\' code'); }
// L8 every catalogue effect and condition has its words: a box of it alone renders its label (app.html fnLine, fnCond)
{ let n = 0; const u0 = { id:'x', name:'X', kw:[], models:['2× X'], stats:[{ W:'4' }], abilities:[], rules:[], ranged:[{ name:'Gun', kw:[] }], melee:[] };
  for(const [id, f] of Object.entries(E.FX)){ const p = f.dom === 'anti' ? 'INFANTRY 4+' : f.dom[0], m = A.fnLine({ grp:'army', name:'R', key:'r|x' }, { quote:'', fx:[[id, p]], on:[], kind:'all' }, u0, 'ranged', null);
    if(!m || m.note !== f.label(p)) fail('L8', 'effects.js ' + id, 'a box of it alone says “' + (m && m.note) + '”, not “' + f.label(p) + '”'); else n++; }
  for(const [id, c] of Object.entries(E.COND)){ const p = { aura:6, maxT:3, targetKw:{ any:['Infantry'] }, selfKw:'X', selfGear:['gun'], opt:'Option', q:'If words', anyOf:['A', 'B'] }[id] || true;
    const m = A.fnLine({ grp:'army', name:'R', key:'r|x' }, { quote:'', fx:[['hit', 1]], on:[[id, p]], kind:'all' }, u0, 'ranged', null);
    if(id === 'selfKw' || id === 'selfGear'){ n++; continue; }   // (a keyword or wargear the unit lacks: no footnote at all)
    if(!m || m.when !== c.label(p)) fail('L8', 'effects.js ' + id, 'a box of it alone says “' + (m && m.when) + '”, not “' + c.label(p) + '”'); else n++; }
  stats.labels = n; }

fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive:true });
fs.writeFileSync(path.join(ROOT, 'verify/out/lines.json'), JSON.stringify({ stats, fails }, null, 1));
console.log('lines: ' + (fails.length ? fails.length + ' failure(s); ' : '') + stats.damaged + ' Damaged ranges and ' + stats.limits + ' once-per-battle chips as their words give them' +
  '; ' + stats.footnotes + ' footnotes (' + stats.rowValues + ' in a weapon row) under the weapons of every list unit, each a box of BOXES said in its effects\' and conditions\' labels; ' + stats.labels + ' catalogue labels rendered');
for(const f of fails.slice(0, 60)) console.log('  FAIL ' + f);
process.exit(fails.length ? 1 : 0);
