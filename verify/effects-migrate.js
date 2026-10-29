#!/usr/bin/env node
// verify/effects-migrate.js: the Damage tab's boxes, made by script from GW's words (verify/effects-extract.js), as data.js BOXES.
//
//   node verify/effects-migrate.js            writes verify/out/boxes.json (every source and its boxes) and says whether data.js
//                                             BOXES is what the words give (exit 1 when not)
//   node verify/effects-migrate.js --write    writes data.js BOXES from the words
//
// The sources are the database's rows only: every ability of every unit of the lists (a datasheet's, an enhancement's), every army
// and detachment rule, every stratagem (detachment and core), and the core weapon abilities the lists' weapons have that calc.js does
// not play itself (Conversion). Each is keyed as the app finds it: a|, r|, s|, c| + the hash of its name and text (verify/derive.js
// ckHash, the app's too). Nothing is read from a reading (mods, aura, calcMods, mod, help, parts): which boxes exist and what they do
// is the words' alone.
'use strict';
const fs = require('fs'), path = require('path');
const { ROOT, loadData } = require('./lib');
const Dv = require('./derive');
const X = require('./effects-extract');
const ckHash = Dv.ckHash;
const stratText = s => ['WHEN: ' + s.when, 'TARGET: ' + s.target, 'EFFECT: ' + s.effect, s.restrictions ? 'RESTRICTIONS: ' + s.restrictions : ''].filter(Boolean).join('\n');
const ruleText = r => r.text + (r.table ? '\n' + r.table.map(t => t.join(': ')).join('\n') : '');
const detRules = d => d && d.rule ? [d.rule].concat(d.moreRules || []) : [];
// the keys the app looks a source up by
const KEY = {
  ability:ab => 'a|' + ckHash(ab.name + '\n' + ab.text),
  rule:r => 'r|' + ckHash(r.name + '\n' + ruleText(r)),
  strat:s => 's|' + ckHash(s.name + '\n' + stratText(s)),
  core:(name, text) => 'c|' + ckHash(name + '\n' + text)
};
// a weapon keyword calc.js plays itself (verify/calc-test.js): not a core source of its own
const CALC_KW = /^(?:rapid fire|melta|sustained hits|anti-|blast|cleave|lethal hits|devastating wounds|twin-linked|torrent|lance|ignores cover|precision|psychic|heavy|indirect fire|close-quarters|pistol|hazardous|supa-hazardous|assault|extra attacks|hunter)/i;
const weaponNames = u => [...new Set([].concat(u.ranged || [], u.melee || []).flatMap(w => [w.name, w.group, String(w.name).split(/\s+[–-]\s+/)[0]]).filter(Boolean))];
function coreText(D, name){
  if(D.rules[name]) return D.rules[name];
  const k = ((D.ruleAliases || []).find(([re]) => re.test(name)) || [])[1];
  return k && D.rules[k] && /\d/.test(name) ? name + ': ' + D.rules[k] : null;
}
function sources(D){
  const out = new Map();
  const put = (key, s) => { const o = out.get(key); if(o){ o.weapons = [...new Set(o.weapons.concat(s.weapons || []))]; return; } out.set(key, Object.assign({ key, weapons:[] }, s)); };
  for(const a of D.armies) for(const u of a.units.concat(a.refs || [])){
    const ws = weaponNames(u);
    // (an ability whose tag names an army rule of its faction, Bondsman: that rule's words say whom it reaches)
    const F = D.factions[a.faction] || {};
    for(const ab of u.abilities || []){ const tr = (F.armyRules || []).find(r => String(ab.tag || '').split(/ · |, /).includes(r.name));
      put(KEY.ability(ab), Object.assign({ type:'ability', name:ab.name, text:ab.text, tag:ab.tag || '', weapons:ws }, tr ? { tagText:tr.text } : {})); }
    // the core weapon abilities of its weapons that calc.js does not play (Conversion), each for the weapons with it
    for(const w of [].concat(u.ranged || [], u.melee || [])) for(const k of w.kw || []){
      if(CALC_KW.test(k)) continue;
      const name = Object.keys(D.rules).find(r => r.toLowerCase() === String(k).toLowerCase()); if(!name) continue;
      put(KEY.core(name, D.rules[name]), { type:'core', name, text:D.rules[name], weapons:[w.name], wkw:String(k).toUpperCase() });
    }
    // a core rule on its Rules line with its value in its name (Damaged 5)
    for(const r of u.rules || []){ if(!/\d/.test(r) || D.rules[r]) continue; const t = coreText(D, r); if(t) put(KEY.core(r, t), { type:'core', name:r, text:t, weapons:ws }); }
  }
  for(const f of Object.values(D.factions)){
    for(const r of f.armyRules || []) put(KEY.rule(r), { type:'rule', name:r.name, text:r.text, table:r.table, army:true });
    for(const d of Object.values(f.detachments || {})){
      for(const r of detRules(d)) put(KEY.rule(r), { type:'rule', name:r.name, text:r.text, table:r.table });
      for(const s of d.stratagems || []) put(KEY.strat(s), { type:'strat', name:s.name, when:s.when, target:s.target, effect:s.effect, text:stratText(s) });
    }
  }
  for(const s of D.coreStratagems) put(KEY.strat(s), { type:'strat', name:s.name, when:s.when, target:s.target, effect:s.effect, text:stratText(s) });
  return out;
}
// every source's boxes: { b (the boxes), nc (sentences of rare mechanics, not counted), reach (an aura's units) }, only where there is one
function build(D){
  const V = Dv.vocab(D), T = {};
  for(const [key, s] of sources(D)){
    const r = X.extract(s, { V, weapons:s.type === 'strat' ? null : s.weapons });
    // a core weapon ability is for the weapons with it ("this weapon")
    if(s.type === 'core' && s.wkw) for(const b of r.boxes) b.scope = Object.assign({}, b.scope, { wkw:s.wkw });
    const o = {};
    if(r.boxes.length) o.b = r.boxes;
    if(r.nc.length) o.nc = r.nc;
    if(r.reach && /\baura\b/i.test(s.tag || '')) o.reach = r.reach;
    if(Object.keys(o).length){ o.n = s.name; T[key] = o; }
  }
  return T;
}
const START = '// ---- BOXES: written by verify/effects-migrate.js --write from the rules text (do not edit) ----';
const END = '// ---- end of BOXES ----';
const block = T => START + '\n' +
  '// The Damage tab\'s boxes of each rule, ability and stratagem (a|, r|, s|, c| + the hash of its name and text), read from GW\'s words by\n' +
  '// fixed code (verify/effects-extract.js, effects.js): b the boxes (quote: the sentence, fx its effects, on its conditions, kind, scope,\n' +
  '// reach, mark, lasts, opt, pick, part, limit), nc the sentences of rare mechanics shown as not counted, reach an aura\'s units; n its name\n' +
  'const BOXES = {\n' + Object.keys(T).sort().map(k => '  ' + JSON.stringify(k) + ':' + JSON.stringify(T[k])).join(',\n') + '\n};\n' + END;
function write(src, T){
  const i = src.indexOf(START), j = src.indexOf(END);
  let out;
  if(i >= 0 && j > i) out = src.slice(0, i) + block(T) + src.slice(j + END.length);
  else { const k = src.indexOf('// ---- end of CHECKLIST ----'); if(k < 0) throw new Error('data.js: the CHECKLIST block not found'); const e = k + '// ---- end of CHECKLIST ----'.length; out = src.slice(0, e) + '\n' + block(T) + src.slice(e); }
  if(!/boxes:BOXES/.test(out)) out = out.replace(/checklist:CHECKLIST/, 'checklist:CHECKLIST, boxes:BOXES');
  return out;
}
// the Damage tab's own reading fields, retired (the boxes are the words' now): on the attack readings (mods, aura, a rule's or
// stratagem's mod, a stratagem's help, a detachment rule's parts) calc, always, oneModel, dice, follow, onDeath; on an army rule
// calcMods, calcNc, both, limit; on a core stratagem calcMods. (note, when, set, vs, cond, weapon, who, pick stay: the datasheets'
// footnotes show them, not the Damage tab)
const RETIRE_READING = ['calc', 'always', 'oneModel', 'dice', 'follow', 'onDeath'];
const RETIRE_RULE = ['calcMods', 'calcNc', 'both', 'limit'];
function retire(src){
  const { parse } = require('./literal');
  const cut = [];
  for(const name of ['CORE_STRATAGEMS', 'FACTIONS', 'ARMIES', 'DATASHEETS']){
    const m = new RegExp('\nconst ' + name + ' = ').exec(src); if(!m) continue;
    const at = m.index + m[0].length, P = parse(src, at);
    for(const n of P.nodes){ if(!n.prop) continue;
      const k = n.path[n.path.length - 1], up = n.path.slice(0, -1).map(String);
      const inReading = up.some(x => ['mods', 'aura', 'mod', 'help', 'parts'].includes(x)) && !up.includes('guard');
      const isArmyRule = name === 'FACTIONS' && ((up.length === 3 && up[1] === 'armyRules') || (up[1] === 'detachments' && (up[3] === 'rule' && up.length === 4 || up[3] === 'moreRules' && up.length === 5)));
      const isCore = name === 'CORE_STRATAGEMS' && up.length === 1;
      if((inReading && RETIRE_READING.includes(k)) || (isArmyRule && RETIRE_RULE.includes(k)) || (isCore && k === 'calcMods')) cut.push([n.pos, n.end]);
    }
  }
  // (each property with the comma after it, or before it when it is the last)
  cut.sort((a, b) => b[0] - a[0]);
  let out = src, n = 0;
  for(let [a, b] of cut){
    // (with the comment lines right above it, which are about it)
    for(;;){ const ls = out.lastIndexOf('\n', a - 1), l0 = out.lastIndexOf('\n', ls - 1), line = out.slice(l0 + 1, ls);
      if(/^\s*$/.test(out.slice(ls + 1, a)) && /^\s*\/\//.test(line)) a = l0 + 1 + (/^\s*/.exec(line)[0].length); else break; }
    const after = /^\s*,\s*/.exec(out.slice(b)), before = /,\s*$/.exec(out.slice(Math.max(0, a - 40), a));
    if(after) out = out.slice(0, a) + out.slice(b + after[0].length);
    else if(before) out = out.slice(0, a - before[0].length) + out.slice(b);
    else out = out.slice(0, a) + out.slice(b);
    n++;
  }
  return { src:out, n };
}
module.exports = { sources, build, KEY, block, write, retire, START, END, stratText, ruleText, coreText };

if(require.main === module){
  const D = loadData(), T = build(D);
  fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive:true });
  fs.writeFileSync(path.join(ROOT, 'verify/out/boxes.json'), JSON.stringify(T, null, 1));
  const n = Object.values(T).reduce((t, o) => t + (o.b || []).length, 0);
  if(process.argv.includes('--retire')){
    const file = path.join(ROOT, 'data.js'), r = retire(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, r.src); console.log('effects-migrate: retired ' + r.n + ' Damage-tab reading fields from data.js (node verify/tables.js --write next)'); process.exit(0);
  }
  if(process.argv.includes('--write')){
    const file = path.join(ROOT, 'data.js'), src = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, write(src, T));
    console.log('effects-migrate: wrote data.js BOXES (' + Object.keys(T).length + ' sources, ' + n + ' boxes)');
  } else {
    const sorted = o => o && Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
    const same = JSON.stringify(sorted(D.boxes || null)) === JSON.stringify(sorted(JSON.parse(JSON.stringify(T))));
    console.log('effects-migrate: ' + Object.keys(T).length + ' sources, ' + n + ' boxes; data.js BOXES ' + (same ? 'is' : 'is NOT') + ' what the words give' + (same ? '' : ' (node verify/effects-migrate.js --write)'));
    process.exit(same ? 0 : 1);
  }
}
