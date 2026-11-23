#!/usr/bin/env node
/* verify/marks.js: the gate step marks. A "+" mark (a row's `from`) says a rule of the list changed a value New Recruit's export shows
   otherwise than GW's datasheet. It replaces what verify/bsdata.js held through BSData's modifiers (BSData is not used: the owner's
   decision, 22 Nov 2026), from GW's words and the owner's exports alone. Every mark of every list:
     M1  names a rule the unit has: an ability of the unit (its enhancement's and its attached parts' too), an army rule of its faction, a
         rule of one of the list's detachments, an enhancement the unit took;
     M2  GW's words of that rule (data.js's text of it, which verify/texts.js and verify/words.js hold to GW's documents and pages) name
         what it marks: a weapon keyword in brackets ("[SUSTAINED HITS 1]"), a characteristic by GW's abbreviation or its name ("+1 A",
         "4+ InSv", "Attacks"); a number it adds is in the words (verify/numbers.js holds a keyword's number, verify/invariants.js a
         footnote's);
     M3  stands on a value that differs from the datasheet's own: the DATASHEETS row of the entry's datasheet with that name (which
         verify/numbers.js holds to GW's datasheet page; the value shown, to New Recruit's export, verify/nr.js) has another value, and
         does not have a marked keyword: a mark on an unchanged value fails;
     M4  and the other way round: a value or weapon keyword of a list's row that is not its datasheet row's has a mark.
   Also the namer verify/from-json.js uses for a list of a faction with no catalogue (namesFor): which rules of the list explain a value
   the export shows otherwise than GW's datasheet, by data.js BUILD_INDEX marks (what each rule changes, learned from the lists' marks and
   held by M1-M3) and, where a hand file names it, its `marks`.
     node verify/marks.js     writes verify/out/marks.json */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
// a characteristic in GW's words: its abbreviation as GW prints it, or its name
// (an abbreviation only where GW's words give it a value: after a number, "+1 A, S and D", "+2\" M", "4+ InSv", or before one, "A 6")
const AB = { M:'M', T:'T', Sv:'Sv', W:'W', Ld:'Ld', OC:'OC', InSv:'InSv', A:'A', S:'S', AP:'AP', D:'D', WS:'WS', BS:'BS', range:'Range' };
const FULL = { M:/\bMove\b/, T:/\bToughness\b/, Sv:/\bSave\b/, W:/\bWounds\b/, Ld:/\bLeadership\b/, OC:/\bObjective Control\b/, InSv:/invulnerable save/i, A:/\bAttacks\b/,
  S:/\bStrength\b/, AP:/\bArmour Penetration\b/, D:/\bDamage\b/, WS:/\bWeapon Skill\b/, BS:/\bBallistic Skill\b/, range:/\brange\b/i };
const CH = Object.fromEntries(Object.keys(AB).map(f => [f, { test:t => FULL[f].test(t) || new RegExp('\\d["+]?\\s+(?:[A-Za-z]+,\\s+)*(?:[A-Za-z]+\\s+and\\s+)?' + AB[f] + '\\b|\\b' + AB[f] + '\\s+[+-]?\\d').test(t) }]));
const isChar = f => Object.prototype.hasOwnProperty.call(CH, f);
const ruleText = r => [r.text, r.effect].filter(Boolean).join('\n') + (r.table ? '\n' + r.table.map(t => [].concat(t).join(': ')).join('\n') : '');
// the rules a unit of a list has, by name: { name: { text, kind, part } } (part: the part of an attached unit an ability is on, its `who`)
function sourcesOf(D, a, u){
  const F = D.factions[a.faction] || {}, m = new Map();
  const add = (name, text, kind, who) => { if(!name) return; const x = m.get(name) || { text:'', kind, who:new Set() }; x.text += '\n' + text; if(who) x.who.add(who); m.set(name, x); };
  for(const x of u.abilities || []) add(x.name, x.text || '', 'ability', x.who || null);
  for(const r of F.armyRules || []) add(r.name, ruleText(r), 'army rule');
  for(const k of a.detachments || []){ const d = (F.detachments || {})[k]; if(!d) continue;
    for(const r of [d.rule].concat(d.moreRules || []).filter(Boolean)) add(r.name, ruleText(r), 'detachment rule');
    for(const e of d.enhancements || []) if([u.enhancement, u.upgrade].includes(e.name)) add(e.name, e.text || '', 'enhancement'); }
  return m;
}
const says = (text, f) => { const plain = String(text).replace(/\*\*/g, '');
  return isChar(f) ? CH[f].test(plain) : plain.toUpperCase().includes('[' + f.toUpperCase().replace(/\s*:.*$/, '').replace(/\s+(D?\d+\+?)$/, '')); };

// which rules of the list explain a value: the unit's sources that BUILD_INDEX marks (idx) records as changing that field, each only on
// the part it is on (an enhancement or ability of one part of an attached unit does not change another part's row, unless its words
// reach the unit: "this unit", "bearer's unit"); for a number, the ones whose effects give the value shown from GW's
//   → { names:[…] } | { none:true } | { unsure:[…candidates] }
const num0 = v => { const m = /^(-?\d+)("?)$/.exec(String(v).replace(/[−–]/g, '-')); return m ? { n:+m[1], u:m[2] } : null; };
function namesFor(S, idx, o){   // o: { field, gw, shown, part (the row's part name), parts (the unit's part names), printed }
  // (a skill, WS or BS, "+1 WS" makes 4+ a 3+: its number counts down, as verify/build-index.js records it)
  const sk = (o.field === 'WS' || o.field === 'BS') && /^\d\+$/.test(String(o.gw)) && /^\d\+$/.test(String(o.shown));
  const num = v => { const x = num0(String(v).replace(/\+$/, sk ? '' : '+')); return x && sk ? { n:-x.n, u:'' } : num0(v); };
  const key = isChar(o.field) ? o.field : o.field.toUpperCase();
  // (an ability reaches a row of its own part; a leader's or other character's ability also the rows of the unit it leads, the
  // bodyguard's, as GW words them: "while this model is leading a unit, models in that unit …"; a bodyguard's a character's row only
  // where its words reach the unit)
  const body = o.parts[o.parts.length - 1];
  const reach = x => x.kind !== 'ability' || !x.who.size || o.parts.length < 2 || x.who.has(o.part) || (o.part === body && ![...x.who].includes(body)) || /\b(this unit|bearer[’']s unit|that unit|led by|leading)\b/i.test(x.text);
  const c = [...S].filter(([n, x]) => idx[n] && key in idx[n] && reach(x)).map(([n]) => n);
  if(!c.length) return { none:true };
  // (the rules New Recruit prints beside the profile, o.printed: each of them the index records for this value)
  if(o.printed) return { names:c };
  if(!isChar(o.field) || c.length === 1) {
    // (one candidate whose effect is known must give the value shown)
    const op = idx[c[0]][key];
    if(c.length === 1 && isChar(o.field) && op && op !== 'kw'){ const g = num(o.gw), s = num(o.shown);
      if(op.set !== undefined ? String(op.set) !== String(o.shown) : !(g && s && g.n + op.add === s.n)) return { unsure:c }; }
    return c.length === 1 ? { names:c } : { unsure:c };
  }
  // several: the subset whose known effects add up to the value shown (an effect the index does not know, null, takes the rest)
  const g = num(o.gw), s = num(o.shown), fits = [];
  for(let mask = 1; mask < (1 << c.length); mask++){
    const sub = c.filter((_, i) => mask & (1 << i)), ops = sub.map(n => idx[n][key]);
    if(ops.some(x => x && x.set !== undefined)){ if(sub.length === 1 && String(ops[0].set) === String(o.shown)) fits.push(sub); continue; }
    if(!g || !s) continue;
    const known = ops.filter(Boolean).reduce((t, x) => t + x.add, 0), free = ops.filter(x => !x).length;
    if(free ? (s.n - g.n - known) * Math.sign(s.n - g.n || 1) > 0 : g.n + known === s.n) fits.push(sub);
  }
  // (the fewest rules that explain it; of those with an unknown effect, only where none without does)
  const exact = fits.filter(sub => sub.every(n => idx[n][key])), pool = exact.length ? exact : fits, min = Math.min(...pool.map(x => x.length));
  const best = pool.filter(x => x.length === min);
  return best.length === 1 ? { names:best[0] } : { unsure:c };
}
module.exports = { sourcesOf, says, namesFor, CH, isChar };
if(require.main !== module) return;

const { loadData, writeJSON } = require('./lib');
const D = loadData(), fails = [], counts = { marks:0, rows:0, own:0, m3:0 };
const kwU = k => String(k).toUpperCase();
// (the lists as data.js stores them, ARMIES: a unit entry's row holds only what is the list's own, beside its datasheet row)
const RAW = (() => { const w = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8').replace(/\nreturn \{ version:VERSION,/, '\nreturn { RAW:{ ARMIES }, version:VERSION,'))(w); return w.WH_DATA.RAW.ARMIES; })();
for(const a of D.armies) for(const u of a.units){
  const S = sourcesOf(D, a, u), where = a.id + '/' + u.id;
  for(const kind of ['stats', 'ranged', 'melee']) for(const r of u[kind] || []){
    counts.rows++;
    const row = where + ' · ' + kind + ' · ' + (r.group ? r.group + ' - ' : '') + r.name;
    for(const [f, by] of Object.entries(r.from || {})) for(const n of [].concat(by)){
      counts.marks++;
      const src = S.get(n);
      if(!src){ fails.push('M1 ' + row + ' ' + f + ': marked ' + n + ', which is no ability of the unit, army rule, detachment rule or enhancement of the list'); continue; }
      if(!says(src.text, f)) fails.push('M2 ' + row + ' ' + f + ': GW’s words of ' + n + ' do not name ' + (isChar(f) ? 'the characteristic ' + f : 'the weapon keyword [' + f + ']'));
    }
  }
  // M4: what the list's entry holds of its own on a row that names a datasheet row (a value, its keywords) is marked, or has its reason
  // (why, over: verify/tables.js)
  const ru = (RAW.find(x => x.id === a.id) || { units:[] }).units.find(x => x.id === u.id);
  if(ru && ru.ds) for(const kind of ['stats', 'ranged', 'melee']) for(const r of ru[kind] || []){
    if(typeof r !== 'object' || !r) continue;
    const full = kind === 'stats' ? ['M', 'T', 'Sv', 'W', 'Ld', 'OC'].every(f => f in r) : ['range', 'A', 'S', 'AP', 'D'].every(f => f in r);
    if(full) continue;   // (a row in full: the list's own row, the datasheet has none of it)
    const row = where + ' · ' + kind + ' · ' + (r.group ? r.group + ' - ' : '') + r.name, why = Object.assign({}, r.why, r.over), from = r.from || {};
    // M3: a marked value is not the datasheet's own: the DATASHEETS row of the entry's datasheet (its part's, by the row's who) with
    // that name and group has another value, and does not have a marked keyword
    { const nm = kind === 'stats' ? String(r.name).replace(/ ×\d+$/, '') : r.name, keys = [].concat(ru.ds), sheets = keys.map(k => D.datasheets[k]).filter(Boolean);
      const mine = sheets.filter(s0 => keys.length === 1 || !r.who || s0.name === r.who || kind === 'stats');
      const base = mine.flatMap(s0 => (s0[kind] || []).filter(x => x.name === nm && (r.group === undefined || (x.group || null) === (r.group || null))));
      for(const f of Object.keys(from)){ counts.m3++;
        if(isChar(f)){ if(f in r && base.length && base.every(b => f in b && String(b[f]) === String(r[f]))) fails.push('M3 ' + row + ' ' + f + ': marked ' + [].concat(from[f]).join(', ') + ', but ' + r[f] + ' is the datasheet’s own value'); }
        else if(base.length && base.every(b => (b.kw || []).some(k => kwU(k) === kwU(f)))) fails.push('M3 ' + row + ' [' + f + ']: marked ' + [].concat(from[f]).join(', ') + ', but the datasheet’s row has the keyword'); } }
    for(const f of Object.keys(CH)) if(f in r){ counts.own++; if(!(f in from) && !(f in why)) fails.push('M4 ' + row + ' ' + f + ': ' + r[f] + ' is the list’s own value, and no rule is marked'); }
    if('kw' in r){ counts.own++; if(!Object.keys(from).some(f => !isChar(f)) && !('kw' in why)) fails.push('M4 ' + row + ' keywords: the list’s own, and no rule is marked'); }
  }
}
writeJSON(path.join(ROOT, 'verify/out/marks.json'), { checked:counts, failures:fails });
if(fails.length){ console.log('FAIL marks: ' + fails.length + ' problem(s)\n' + fails.map(x => ' - ' + x).join('\n')); process.exit(1); }
console.log('marks: ' + counts.marks + ' "+" marks on ' + counts.rows + ' rows of the lists each name a rule the unit has (M1) whose GW words name what it marks (M2), on a value that is not its DATASHEETS row’s own (M3, ' + counts.m3 + ' compared); the ' + counts.own + ' values and keyword lists a list’s row holds of its own are each marked or have their reason (M4)');
