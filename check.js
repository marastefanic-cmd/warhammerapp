#!/usr/bin/env node
// Consistency checks on data.js, run by build.js before it builds (or on its own: node check.js).
// It catches the mistakes that are easy to make when adding an army: a keyword or rule that
// opens nothing, a stratagem id used twice, points that don't add up, a weapon group split in two.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function check(file){
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
  const D = ctx.window.WH_DATA;
  const out = [];
  const P = (...a) => out.push(a.join(' '));
  const PHASES = ['command','movement','shooting','charge','fight'], TURNS = ['your','opp','either'];

  const factionOf = a => D.factions[a.faction];
  const detachmentsOf = a => a.detachments.map(id => Object.assign({ id }, (factionOf(a).detachments || {})[id])).filter(d => d.name);
  // the same lookup the app does when a keyword or rule is tapped
  function ruleFor(a, label){
    const f = factionOf(a);
    let clean = String(label).replace(/^\[|\]$/g, '').replace(/\*$/, '').trim();
    for(const [re, key] of f.aliases || []) if(re.test(clean)){ clean = key; break; }
    const lc = clean.toLowerCase();
    if(f.armyRules.some(r => r.name.toLowerCase() === lc)) return true;
    if(detachmentsOf(a).some(d => d.rule && d.rule.name.toLowerCase() === lc)) return true;
    return D.ruleAliases.some(([re]) => re.test(clean)) || !!D.rules[clean];
  }
  const timing = (x, where) => {
    for(const p of x.phases || x.ph || []) if(!PHASES.includes(p)) P(where, 'bad phase', p);
    if(x.turn && !TURNS.includes(x.turn)) P(where, 'bad turn', x.turn);
    for(const [p, t] of Object.entries(x.turns || {})) if(!PHASES.includes(p) || !TURNS.includes(t)) P(where, 'bad turns entry', p + ':' + t);
  };

  // the owner's rule: the app quotes rules, it never decides how one reads. No "ask" fields, and none of
  // the wording that marks an interpretation of the app's own (a quoted FAQ or errata line is fine)
  const READING = /\bthe app (assumes|reads|takes|treats)\b|\bevident intent\b|\bby the letter\b|\breads as\b|\bagree (it )?with your opponent\b/i;
  (function walk(x, where){
    if(Array.isArray(x)) return x.forEach((v, i) => walk(v, where + '[' + i + ']'));
    if(x && typeof x === 'object') return Object.entries(x).forEach(([k, v]) => { if(k === 'ask') P(where + '.ask', 'an interpretation field (the app quotes rules, it does not read them)'); walk(v, where + '.' + k); });
    if(typeof x === 'string') for(const line of x.split('\n'))   // official FAQ, errata and designer's notes are quotes
      if(READING.test(line) && !/^\*?(Wahapedia (FAQ|errata)|Designer’s Note)/.test(line)) P(where, 'reads like an interpretation:', line.match(READING)[0]);
  })(D, 'data');
  for(const [re, key] of D.ruleAliases) if(!(key in D.rules)) P('rule alias', re, 'points at missing rule', key);
  const stratIds = new Map();
  const strat = (s, where) => {
    if(stratIds.has(s.id)) P('stratagem id', s.id, 'used in', where, 'and', stratIds.get(s.id));
    stratIds.set(s.id, where);
    for(const k of ['id','name','cp','phases','turn','when','target','effect']) if(s[k] == null || s[k] === '' || (Array.isArray(s[k]) && !s[k].length)) P('stratagem', s.id, 'missing', k);
    timing(s, 'stratagem ' + s.id);
  };
  D.coreStratagems.forEach(s => strat(s, 'core'));
  for(const [fk, f] of Object.entries(D.factions)){
    if(!Array.isArray(f.armyRules)) P('faction', fk, 'has no armyRules');
    for(const r of f.armyRules || []){ timing(r, 'army rule ' + r.name); for(const x of r.remind || []) timing(x, 'reminder of ' + r.name); }
    for(const [dk, d] of Object.entries(f.detachments || {})){
      for(const k of ['name','enhancements','stratagems']) if(!d[k]) P('detachment', dk, 'missing', k);
      if(d.rule) timing(d.rule, 'detachment rule ' + d.rule.name);
      (d.stratagems || []).forEach(s => strat(s, dk));
    }
  }

  for(const a of D.armies){
    const f = factionOf(a);
    if(!f){ P('army', a.id, 'unknown faction', a.faction); continue; }
    for(const did of a.detachments) if(!(f.detachments || {})[did]) P('army', a.id, 'unknown detachment', did);
    let pts = 0;
    const ids = new Set();
    for(const u of a.units){
      const where = a.id + '/' + u.id;
      if(ids.has(u.id)) P('unit id used twice:', where);
      ids.add(u.id);
      for(const k of ['id','name','role','pts','models','stats','abilities','rules','kw']) if(u[k] == null) P(where, 'missing', k);
      pts += (u.pts || 0) * (u.copies || 1);
      for(const s of u.stats || []) for(const k of ['M','T','Sv','W','Ld','OC','InSv','base']) if(s[k] == null) P(where, 'stat row', s.name, 'missing', k);
      for(const r of u.rules || []) if(!ruleFor(a, r)) P(where, 'rule opens nothing:', r);
      const weapons = [...(u.ranged || []), ...(u.melee || [])];
      for(const w of weapons){
        if(!Array.isArray(w.kw)) P(where, w.name, 'kw is not a list');
        for(const k of w.kw || []) if(!ruleFor(a, k)) P(where, w.name, 'keyword opens nothing:', k);
        for(const k of (u.ranged || []).includes(w) ? ['range','A','BS','S','AP','D'] : ['A','WS','S','AP','D']) if(w[k] == null) P(where, w.name, 'missing', k);
      }
      // from: each mark is one of the row's keywords or fields, and names something the app can open
      for(const x of [...weapons, ...(u.stats || [])]) for(const [k, v] of Object.entries(x.from || {})){
        const fields = (u.stats || []).includes(x) ? ['M','T','Sv','W','Ld','OC','InSv','base'] : ['range','A','BS','WS','S','AP','D'];
        if(!(x.kw || []).includes(k) && !fields.includes(k)) P(where, x.name, 'from names neither a keyword nor a field of it:', k);
        for(const n of [].concat(v)) if(!u.abilities.some(ab => ab.name === n) && !ruleFor(a, n)) P(where, x.name, 'from names nothing the app can open:', n);
      }
      // a weapon's profiles must sit next to each other (the app joins neighbours only)
      for(const kind of ['ranged','melee']){
        const seen = new Set(); let last = null;
        for(const w of u[kind] || []){ const g = w.group ? w.group + '|' + (w.who || '') : null; if(g && g !== last && seen.has(g)) P(where, kind, 'weapon group split in two:', w.group); if(g) seen.add(g); last = g; }
      }
      for(const m of [...(u.mods || []), ...(u.aura || [])]){
        if(!['ranged','melee','all'].includes(m.kind)) P(where, 'mod has bad kind', m.kind);
        for(const k of ['when','from']) if(!m[k]) P(where, 'mod missing', k);
        if(!m.note && !m.set) P(where, 'mod missing note');
        if(m.weapon){
          const w = (m.kind === 'all' ? weapons : u[m.kind] || []).find(x => x.name === m.weapon);
          if(!w) P(where, 'mod names a weapon it does not have:', m.weapon);
          else if(w.group) P(where, 'mod weapon', m.weapon, 'has several profiles; set is ignored');
        }
      }
      // kwOnly: keywords of only some models; each one is a keyword of the unit
      for(const k of Object.keys(u.kwOnly || {})) if(!u.kw.includes(k)) P(where, 'kwOnly names a keyword the unit does not have:', k);
      // gear: one list per models line; names must be the unit's weapons, and every weapon carried
      if(u.gear){
        if(u.gear.length !== u.models.length) P(where, 'gear has', u.gear.length, 'lines but models has', u.models.length);
        const names = new Set(weapons.map(w => w.group || w.name));
        for(const g of u.gear) for(const n of g) if(!names.has(n)) P(where, 'gear names a weapon it does not have:', n);
        // unplaced: wargear New Recruit lists for the unit but on no models line
        for(const n of u.unplaced || []) if(!names.has(n) && !(u.abilities || []).some(ab => ab.name === n)) P(where, 'unplaced names neither a weapon nor an ability of it:', n);
        // ... and the app labels it by name, so the name is on no models line, and names one thing only
        for(const n of u.unplaced || []){
          if(u.gear.some(g => g.includes(n))) P(where, 'unplaced is also on a models line:', n);
          const things = new Set([...weapons.filter(w => (w.group || w.name) === n).map(w => w.group ? 'group' : 'weapon:' + w.name), ...(u.abilities || []).filter(ab => ab.name === n).map(() => 'ability')]);
          if(things.size > 1) P(where, 'unplaced name matches more than one weapon or ability:', n);
          if((u.unplaced || []).filter(x => x === n).length > 1) P(where, 'unplaced lists a name twice:', n);
        }
        const carried = new Set([...u.gear.flat(), ...(u.unplaced || [])]);
        for(const n of names) if(!carried.has(n)) P(where, 'weapon not in any gear line:', n);
      }
      if(u.enhancement && !detachmentsOf(a).some(d => d.enhancements.some(e => e.name === u.enhancement))) P(where, 'enhancement not in its detachments:', u.enhancement);
      for(const ab of u.abilities || []) timing(ab, where + ' ability ' + ab.name);
      const names = (u.abilities || []).map(ab => ab.name);
      names.forEach((n, i) => { if(names.indexOf(n) !== i) P(where, 'ability listed twice:', n); });
    }
    if(pts !== a.pointsUsed) P('army', a.id, 'points add up to', pts, 'but pointsUsed is', a.pointsUsed);
  }
  return out;
}

module.exports = check;
if(require.main === module){
  const problems = check(process.argv[2] || path.join(__dirname, 'data.js'));
  problems.forEach(p => console.log(' -', p));
  console.log(problems.length ? problems.length + ' problem(s)' : 'data.js: all checks pass');
  process.exit(problems.length ? 1 : 0);
}
