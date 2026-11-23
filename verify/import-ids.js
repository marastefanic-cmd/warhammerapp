#!/usr/bin/env node
/* verify/import-ids.js: the ids the in-app list import (import.js, builder.js) looks an export's selections up by, learned from the
   owner's New Recruit exports (verify/sources/nr-json/<list>.json) and nothing else.
   New Recruit's JSON export is a BattleScribe roster: every selection carries an id of New Recruit's data ("entryId", the last id of
   which is the entry itself). The app's own keys are its own (a faction key, "faction/datasheet-name", a list's unit id); an export's
   ids are only a lookup, and only the ids a committed export has shown are in this table. A selection whose id no export has shown is
   looked up by its exact New Recruit name instead (import.js, builder.js), and refused, named, when no one thing or more than one has
   that name. Nothing here comes from BSData (the owner's decision, 22 Nov 2026).
   It writes, into data.js between the NR_IDS markers:
     factions      catalogue id → faction (the export's force; its list's faction in data.js)
     roots         top-level entry id → battleSize | disposition | detachment (the selection that holds each choice, by its name:
                   "Battle Size", "Force Disposition", "Detachment")
     battleSizes   entry id → battle size (data.js name: the list's battleSize); limits: battle size → its points limit (New Recruit's
                   name, "Strike Force (2000 Point limit)", which must be GW's Core Rules' number for that battle size, 25.03)
     dispositions  entry id → Force Disposition (the list's)
     detachments   entry id → faction/detachment (the list's detachment of that name: GW's, or New Recruit's spelling nr)
     config        top-level entry id → army config key (Code Chivalric: a key of the list's config); configKids: its choices
     info          the other top-level entry ids (Show/Hide Options, rules references: no list content); infoKids: their choices
     units         list/unit → one signature per part of the unit (leader, other characters, bodyguard), in the unit's order: import.js's
                   signature of the export's selections for that unit
     datasheets    entry id → faction/datasheet-name (DATASHEETS key): the root entry of a part, for builder.js
     names         entry id → New Recruit's name (an export's selection must carry the same name)
     maxPerList    entry id → how many a list may take, by GW's rules: an enhancement once (Core Rules 25.04, Select Enhancements: no two
                   of one), or its own limit (Wahapedia's "one per army"), an Upgrade three times (its Faction Pack: BUILD_INDEX.upgrades /
                   the enhancement's upgrade), an EPIC HERO once (Core Rules 25.04: each EPIC HERO only once), and a selection a detachment's
                   rule limits (GW_LIMITS below, each with the rule's words, which must be in data.js's text of it)
   Usage: node verify/import-ids.js           check that data.js holds exactly this table (exit 1 if not)
          node verify/import-ids.js --write   write it */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'data.js');
const START = '// ---- NR_IDS: written by verify/import-ids.js from the New Recruit exports in verify/sources/nr-json (do not edit) ----';
const END = '// ---- end of NR_IDS ----';
const EXP = path.join(ROOT, 'verify/sources/nr-json');

// a part's signature: import.js's own, so the app compares exactly what this writes
const IMP = require('../import.js');
const { signature, nn } = IMP;
const lastId = e => String(e || '').split('::').pop();
const lc = s => nn(s).toLowerCase();
const pts = costs => (costs || []).filter(c => c.name === 'pts').reduce((t, c) => t + (Number(c.value) || 0), 0);
const costOf = s => pts(s.costs) + (s.selections || []).reduce((t, c) => t + costOf(c), 0);
const conv = s => ({ id:lastId(s.entryId), n:Number(s.number) || 0, model:s.type === 'model', kids:(s.selections || []).map(conv) });
const sigOf = s => signature(lastId(s.entryId), (s.selections || []).map(conv));

// a selection of New Recruit's that stands for a choice a detachment's rule limits: { name, faction, detachment, max, quote } (the quote:
// GW's words in data.js's text of the detachment rule, which verify/texts.js checks against GW's documents)
const GW_LIMITS = [
  { name:'Houndpack Lance Character', faction:'chaos-knights', detachment:'houndpack-lance', max:3, quote:'When mustering your army, select three **WAR DOG** units from your army. Until the end of the battle, those units have the **CHARACTER** keyword.' }
];
function table(D){
  if(!D) D = require('./lib').loadData();
  // (each list unit's datasheet key or keys, ds, as data.js's ARMIES table holds it before the app joins it with DATASHEETS)
  const RAW = (() => { const w = {}; new Function('window', fs.readFileSync(FILE, 'utf8').replace(/\nreturn \{ version:VERSION,/, '\nreturn { RAW:{ ARMIES }, version:VERSION,'))(w); return w.WH_DATA.RAW.ARMIES; })();
  const dsOf = (listId, unitId) => { const a = RAW.find(x => x.id === listId), u = a && a.units.concat(a.refs || []).find(x => x.id === unitId); return u && u.ds ? [].concat(u.ds) : null; };
  const T = { factions:{}, roots:{}, battleSizes:{}, limits:{}, dispositions:{}, detachments:{}, config:{}, configKids:{}, info:{}, infoKids:{}, units:{}, datasheets:{}, names:{}, maxPerList:{} };
  const problems = [];
  const put = (tab, id, v, where) => { if(T[tab][id] !== undefined && JSON.stringify(T[tab][id]) !== JSON.stringify(v)) problems.push(where + ': ' + tab + ' ' + id + ' is ' + JSON.stringify(T[tab][id]) + ' in another export, ' + JSON.stringify(v) + ' here'); else T[tab][id] = v; };
  // (GW's battle sizes, Core Rules 25.03: data.js BUILD_INDEX battleSizes, which verify/build-index.js reads from rules/core-rules.md)
  const GWBS = (D.buildIndex || {}).battleSizes || {};
  const files = fs.readdirSync(EXP).filter(f => f.endsWith('.json')).sort(), epic = new Set();
  for(const f of files){
    const listId = f.replace(/\.json$/, ''), a = D.armies.find(x => x.id === listId);
    if(!a){ problems.push(f + ': no list ' + listId + ' in data.js'); continue; }
    const j = JSON.parse(fs.readFileSync(path.join(EXP, f), 'utf8')), F = j.roster.forces[0], FAC = D.factions[a.faction];
    put('factions', F.catalogueId, a.faction, f);
    const names = s => { put('names', lastId(s.entryId), nn(s.name), f); (s.selections || []).forEach(names); };
    F.selections.forEach(names);
    for(const t of F.selections.filter(s => s.type === 'upgrade')){
      const id = lastId(t.entryId), tn = nn(t.name), ks = t.selections || [];
      if(tn === 'Battle Size'){
        put('roots', id, 'battleSize', f);
        for(const c of ks){ put('battleSizes', lastId(c.entryId), a.battleSize, f);
          const m = /\((\d+) Point limit\)$/.exec(nn(c.name)); if(!m){ problems.push(f + ': no points limit in ' + c.name); continue; }
          put('limits', a.battleSize, Number(m[1]), f);
          // (GW's Core Rules give the battle size that limit)
          if(!GWBS[a.battleSize] || GWBS[a.battleSize].points !== Number(m[1])) problems.push(f + ': GW’s Core Rules (25.03) do not give ' + a.battleSize + ' ' + m[1] + ' points');
        }
      } else if(tn === 'Force Disposition'){
        put('roots', id, 'disposition', f);
        for(const c of ks){ if(nn(c.name) !== nn(a.disposition)) problems.push(f + ': Force Disposition ' + c.name + ', the list has ' + a.disposition); put('dispositions', lastId(c.entryId), nn(c.name), f); }
      } else if(tn === 'Detachment' || tn === 'Detachments'){
        put('roots', id, 'detachment', f);
        for(const c of ks){
          const k = a.detachments.filter(d => [FAC.detachments[d].name, FAC.detachments[d].nr].filter(Boolean).some(x => lc(x) === lc(c.name)));
          if(k.length !== 1){ problems.push(f + ': detachment ' + c.name + ' is ' + (k.length ? 'more than one' : 'none') + ' of the list’s'); continue; }
          put('detachments', lastId(c.entryId), a.faction + '/' + k[0], f);
        }
      } else if(a.config && tn in a.config){
        put('config', id, tn, f);
        for(const c of ks) put('configKids', lastId(c.entryId), nn(c.name), f);
      } else {
        put('info', id, tn, f);
        for(const c of ks) put('infoKids', lastId(c.entryId), nn(c.name), f);
      }
    }
    // units: each bodyguard with the characters attached to it (New Recruit's Leading / Supporting), as import.js groups them
    const roots = F.selections.filter(s => s.type !== 'upgrade'), byId = new Map(roots.map(s => [s.id, s])), leadsTo = new Map();
    for(const s of roots) for(const x of s.associations || []) if(x.type === 'outgoing' && x.action === 'group' && byId.has(x.to)) leadsTo.set(s, byId.get(x.to));
    const groups = roots.filter(s => !leadsTo.has(s)).map(b => ({ parts:roots.filter(s => leadsTo.get(s) === b).concat([b]) }));
    // each group is the list's unit of the same parts (New Recruit's names, as data.js has them) and points; where two of the list's
    // units have those, the one whose models and wargear the group's are
    const unitNames = u => [u.name].concat((u.also || []).map(c => c.name), u.leads ? [u.leads] : []).map(lc);
    // (a reference sheet the export has an entry of its own for, Spore Mines (Biovore), is one of its units too)
    const pool = a.units.concat(a.refs || []);
    const taken = new Map();
    for(const g of groups){
      const gn = g.parts.map(p => lc(p.name)), gp = g.parts.reduce((t, p) => t + costOf(p), 0), sigs = g.parts.map(sigOf).sort();
      let c = pool.filter(u => JSON.stringify(unitNames(u)) === JSON.stringify(gn) && u.pts === gp);
      if(c.length > 1){ const free = c.filter(u => (taken.get(u) || []).length < (u.copies || 1)); if(free.length) c = free; }
      if(c.length > 1){ const same = c.filter(u => (taken.get(u) || []).some(s => JSON.stringify(s) === JSON.stringify(sigs))); if(same.length) c = same; }
      if(!c.length){ problems.push(f + ': ' + gn.join(' + ') + ' (' + gp + ' pts) is no unit of ' + listId); continue; }
      const u = c[0];
      taken.set(u, (taken.get(u) || []).concat([sigs]));
      const key = listId + '/' + u.id;
      if(T.units[key] && JSON.stringify(T.units[key].slice().sort()) !== JSON.stringify(sigs)) { if(c.length === 1) problems.push(f + ': ' + key + ' is two different units in the export'); continue; }
      if(!T.units[key]) T.units[key] = g.parts.map(sigOf);
      // the datasheet each part is (a list unit's ds: one key, or one per part)
      const ds = dsOf(listId, u.id);
      if(ds && ds.length === g.parts.length) g.parts.forEach((p, i) => put('datasheets', lastId(p.entryId), ds[i], f));
      // (an EPIC HERO part: its datasheet's keywords, else the export's own categories for it)
      g.parts.forEach((p, i) => { const r = ds && D.datasheets[ds[i]], kw = r && r.kw ? r.kw : (p.categories || []).map(c => c.name);
        if(kw.some(k => /^epic hero$/i.test(nn(k)))) epic.add(lastId(p.entryId)); });
    }
    for(const u of pool) if(!taken.has(u) && !u.ref) problems.push(f + ': ' + listId + '/' + u.id + ' (' + u.name + ') has no unit in the export');
  }
  // how many of an entry a list may take, by GW's rules, for every entry the exports have shown
  const enh = new Map();
  for(const F of Object.values(D.factions)) for(const d of Object.values(F.detachments || {})) for(const e of d.enhancements || []) for(const n of [e.name, e.nr].filter(Boolean)) enh.set(lc(n), e);
  const UPG = ((D.buildIndex || {}).upgrades) || {};
  for(const [id, n] of Object.entries(T.names)){
    const e = enh.get(lc(n.replace(/\s*\((?:Upgrade|Enhancement)\)$/i, '')));
    // (an enhancement's own limit where GW gives one, Wahapedia's "one per army" on the Might of the Moritoi Upgrades)
    if(e) T.maxPerList[id] = /^one per army$/i.test(e.limit || '') ? 1 : e.upgrade || UPG[e.name] ? 3 : 1;
    else if(epic.has(id)) T.maxPerList[id] = 1;
  }
  for(const L of GW_LIMITS){
    const d = ((D.factions[L.faction] || {}).detachments || {})[L.detachment], text = d && [d.rule].concat(d.moreRules || []).map(r => r && r.text).join('\n');
    if(!text || !text.includes(L.quote)) { problems.push('GW_LIMITS ' + L.name + ': data.js’s ' + L.faction + '/' + L.detachment + ' rule does not say “' + L.quote + '”'); continue; }
    for(const [id, n] of Object.entries(T.names)) if(n === L.name) T.maxPerList[id] = L.max;
  }
  return { T, problems };
}

const lit = (T) => 'const NR_IDS = {\n' + Object.entries(T).map(([k, v]) => '  ' + k + ':{\n' +
  Object.keys(v).sort().map((x) => '    ' + JSON.stringify(x) + ':' + JSON.stringify(v[x])).join(',\n') + '\n  }').join(',\n') + '\n};';
function block(T) { return START + '\n' + lit(T) + '\n' + END; }

module.exports = { table, signature, block, START, END };
if (require.main !== module) return;

const src = fs.readFileSync(FILE, 'utf8');
const { T, problems } = table();
if (problems.length) { console.log('import-ids: ' + problems.length + ' problem(s) in the exports:\n  ' + problems.join('\n  ')); process.exit(1); }
const want = block(T);
const i = src.indexOf(START), j = src.indexOf(END);
const have = i >= 0 && j > i ? src.slice(i, j + END.length) : null;
if (process.argv.includes('--write')) {
  let out;
  // (in the place of the retired BS_IDS table, the ids once read from BSData)
  const OLD = ['// ---- BS_IDS: written by verify/import-ids.js from BSData (do not edit) ----', '// ---- end of BS_IDS ----'], oi = src.indexOf(OLD[0]), oj = src.indexOf(OLD[1]);
  if (have) out = src.slice(0, i) + want + src.slice(j + END.length);
  else if (oi >= 0 && oj > oi) out = (src.slice(0, oi) + want + src.slice(oj + OLD[1].length)).replace(/bsIds:BS_IDS/, 'nrIds:NR_IDS');
  else {
    const at = src.indexOf('\nreturn { version:VERSION');
    if (at < 0) throw new Error('data.js: return line not found');
    out = src.slice(0, at) + '\n' + want + '\n' + src.slice(at);
  }
  if (!/nrIds:NR_IDS/.test(out)) out = out.replace(/armies:resolveArmies\(ARMIES, DATASHEETS, TABLE_ORDER, FACTIONS\), /, '$&nrIds:NR_IDS, ');
  fs.writeFileSync(FILE, out);
  console.log('import-ids: wrote NR_IDS into data.js (' + (want.length / 1024).toFixed(0) + ' KB)');
} else if (have !== want) {
  console.log('import-ids: data.js NR_IDS ' + (have ? 'differs from' : 'is missing;') + ' what the New Recruit exports give. Run: node verify/import-ids.js --write');
  process.exit(1);
} else console.log('import-ids: NR_IDS matches the ' + fs.readdirSync(EXP).filter(f => f.endsWith('.json')).length + ' New Recruit exports (' + Object.keys(T.units).length + ' units, ' + Object.keys(T.names).length + ' ids)');
