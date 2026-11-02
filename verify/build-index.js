#!/usr/bin/env node
/* verify/build-index.js: data.js's BUILD_INDEX, what builder.js needs on the phone beyond the other tables, written from them and from
   the gate's own files, never by hand. Each part is mechanical:

     labels  an enhancement's phase labels (ph, turn, turns, at), as verify/derive.js reads its words (timing, asLabel): the labels a list's
             enhancement row gets, for every enhancement of a catalogued faction
     marks   for each rule, ability or enhancement that a list's "+" mark names (from), the values it marks (a characteristic, a weapon
             keyword): which rule of the list changed a value the export shows (BSData's modifiers; verify/bsdata.js checks every mark)
     battleSizes  GW's battle sizes (Core Rules 25.03, as rules/core-rules.md has them): points, Detachment Points, enhancement and unit limits
     upgrades     an enhancement GW's Faction Pack heads "<NAME> UPGRADE" (verify/.cache/gw) that its row (BSData's upgrade) does not mark
     gw      a catalogued datasheet's value where GW's datasheet is not BSData's (verify/deviations-bsdata.json, army "catalog"):
             { "<datasheet>": { "<kind>|<row>|<field>": "<BSData's value>" } }, so the export's BSData value is no rule at work

     node verify/build-index.js           check: data.js holds exactly what this writes (the gate's build-parity step runs it)
     node verify/build-index.js --write   write it into data.js */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data.js');

function index(D, RAW){
  const cat = [...new Set(Object.values(D.datasheets).filter(r => r.points).map(r => r.faction))].sort();
  const derive = require('./derive');
  const PH = ['command', 'movement', 'shooting', 'charge', 'fight'];
  const asLabel = (map, at) => {   // verify/derive.js asLabel
    const ph = PH.filter(p => map[p]);
    if(!ph.length) return at ? { at } : {};
    const count = {}; for(const p of ph) count[map[p]] = (count[map[p]] || 0) + 1;
    const turn = Object.keys(count).sort((a, b) => count[b] - count[a] || (a === 'either' ? -1 : b === 'either' ? 1 : 0))[0];
    const turns = Object.fromEntries(ph.filter(p => map[p] !== turn).map(p => [p, map[p]]));
    return Object.assign(at ? { at } : {}, { ph, turn }, Object.keys(turns).length ? { turns } : {});
  };
  const labels = {};
  // (a reading of the words that is not the signed-off label, verify/derive-unread.json: no label, as for a list's row)
  const crypto = require('crypto'), sha8 = t => crypto.createHash('sha256').update(String(t)).digest('hex').slice(0, 8);
  const unread = Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/derive-unread.json'), 'utf8')).items || {})
    .filter(([k]) => k.startsWith('ability-timing | ')).map(([k, v]) => k.split(' · ').pop().replace(/ #\d+$/, '') + '\n' + v.of);
  for(const f of cat) for(const d of Object.values(D.factions[f].detachments)) for(const e of d.enhancements || []){
    const t = derive.timing(e.text, { core:D.coreStratagems, self:e.name, label:true, abilities:[], option:() => null, armyAbility:() => null });
    const l = t.how === 'none' || unread.includes(e.name + '\n' + sha8(e.text)) ? {} : asLabel(t.ph, t.at);
    if(Object.keys(l).length) labels[e.name] = l;
  }
  // (each mark's effect, as the lists' rows show it over their datasheet rows: a number added ({ add }), a value set ({ set }), a weapon
  // keyword given ('kw'); a source whose rows disagree has none: the build refuses what it alone would explain)
  const marks = {}, num = v => { const m = /^(-?\d+)("?)$/.exec(String(v)); return m ? { n:+m[1], u:m[2] } : null; };
  const rowOf = (u, kind, r) => { for(const k of [].concat(u.ds)){ const S = D.datasheets[k]; if(!S) continue; const name = kind === 'stats' ? String(r.name).replace(/ ×\d+$/, '') : r.name;
    const hit = (S[kind] || []).find(x => x.name === name && (r.group === undefined || (x.group || null) === r.group) && (!r.who || S.name === r.who || [].concat(u.ds).length === 1)); if(hit) return hit; } return null; };
  for(const a of RAW.ARMIES) for(const u of a.units) for(const k of ['stats', 'ranged', 'melee']) for(const r of u[k] || []) for(const [f, by] of Object.entries(r.from || {})){
    const isKw = !/^(M|T|Sv|W|Ld|OC|InSv|range|A|BS|WS|S|AP|D)$/.test(f), base = rowOf(u, k, r);
    let op = 'kw';
    if(!isKw){ if(!base || !(f in r)) op = null; else { const x = num(base[f]), y = num(r[f]); op = x && y && x.u === y.u ? { add:y.n - x.n } : { set:r[f] }; } }
    for(const s0 of [].concat(by)){ const m = marks[s0] = marks[s0] || {}, key = isKw ? f.toUpperCase() : f;
      m[key] = !(key in m) || JSON.stringify(m[key]) === JSON.stringify(op) ? op : null; }
  }
  for(const s0 of Object.keys(marks)) marks[s0] = Object.fromEntries(Object.keys(marks[s0]).sort().map(k => [k, marks[s0][k]]));
  // GW's battle sizes (Core Rules 25.03, rules/core-rules.md: points, Detachment Points, enhancement limit, unit limit)
  const core = fs.readFileSync(path.join(ROOT, 'rules/core-rules.md'), 'utf8'), bsz = {};
  const t = core.slice(core.indexOf('#### Select Battle Size 25.03'), core.indexOf('#### Fill Your Army Roster 25.04'));
  for(const m of t.matchAll(/^\*\*([A-Z ]+)\*\* \| (\d+) \| (\d+) \| (\d+) \| (\d+)\s*$/gm)) bsz[m[1].toLowerCase().replace(/\b\w/g, c => c.toUpperCase())] = { points:+m[2], dp:+m[3], enhancements:+m[4], units:+m[5] };
  if(!Object.keys(bsz).length) throw new Error('rules/core-rules.md: the 25.03 battle size table was not found');
  // an enhancement GW's Faction Pack marks UPGRADE that the row (BSData's upgrade) does not
  const gwTxt = fs.readdirSync(path.join(ROOT, 'verify/.cache/gw')).filter(f => f.endsWith('.txt')).sort().map(f => fs.readFileSync(path.join(ROOT, 'verify/.cache/gw', f), 'utf8')).join('\n');
  const upgrades = [];
  for(const f of cat) for(const d of Object.values(D.factions[f].detachments)) for(const e of d.enhancements || []){
    const U = e.name.toUpperCase().replace(/[’'()]/g, '.');
    if(!e.upgrade && new RegExp('^\\s*' + U + '\\s+UPGRADE\\b', 'm').test(gwTxt) && !upgrades.includes(e.name)) upgrades.push(e.name);
  }
  upgrades.sort();
  const gw = {};
  const dev = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/deviations-bsdata.json'), 'utf8'));
  for(const x of dev){
    const m = /^(stats|ranged|melee)\[(.+)\]\.(\w+)$/.exec(x.field || '');
    if(x.army !== 'catalog' || !m || m[3] === 'base' || x.source == null || !D.datasheets[x.unit]) continue;
    (gw[x.unit] = gw[x.unit] || {})[m[1] + '|' + m[2] + '|' + m[3]] = String(x.source);
  }
  const sortObj = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
  for(const k of Object.keys(gw)) gw[k] = sortObj(gw[k]);
  return { labels:sortObj(labels), marks:sortObj(marks), gw:sortObj(gw), battleSizes:bsz, upgrades:Object.fromEntries(upgrades.map(n => [n, 'GW’s Faction Pack: “' + n.toUpperCase() + ' UPGRADE”'])) };
}
const text = I => 'const BUILD_INDEX = {\n' + Object.entries(I).map(([k, v]) => '  ' + k + ':{\n' + Object.entries(v).map(([n, x]) => '    ' + JSON.stringify(n) + ':' + JSON.stringify(x)).join(',\n') + '\n  }').join(',\n') + '\n};\n';
const MARK = ['// ---- BUILD_INDEX: written by verify/build-index.js --write from the other tables and the gate\'s files (do not edit) ----', '// ---- end of BUILD_INDEX ----'];

function load(src){
  const s = src.replace(/\nreturn \{ version:VERSION,/, '\nreturn { RAW:{ ARMIES }, version:VERSION,');
  const w = {}; new Function('window', s)(w); return w.WH_DATA;
}
if(require.main === module){
  let src = fs.readFileSync(DATA, 'utf8');
  const D = load(src), I = index(D, D.RAW);
  const want = MARK[0] + '\n' + text(I) + MARK[1] + '\n';
  const i = src.indexOf(MARK[0]), j = src.indexOf(MARK[1]);
  const have = i >= 0 && j > i ? src.slice(i, j + MARK[1].length + 1) : null;
  if(process.argv.includes('--write')){
    if(have !== null) src = src.slice(0, i) + want + src.slice(j + MARK[1].length + 1);
    else { const k = src.indexOf('// ---- end of BOXES ----\n'); if(k < 0) throw new Error('data.js: no end of BOXES'); const at = k + '// ---- end of BOXES ----\n'.length; src = src.slice(0, at) + want + src.slice(at); }
    // (and in WH_DATA: the index, and the resolver for one list, before the tables verify/tables.js --write puts last)
    if(!/buildIndex:BUILD_INDEX/.test(src)) src = src.replace(/(\nreturn \{ version:VERSION,[^\n]*?)(, datasheets:DATASHEETS| \};\n)/, '$1, buildIndex:BUILD_INDEX, resolve:function(a){ return resolveArmies([a], DATASHEETS, TABLE_ORDER, FACTIONS)[0]; }$2');
    fs.writeFileSync(DATA, src);
    console.log('build-index: wrote BUILD_INDEX (' + Object.keys(I.labels).length + ' labels, ' + Object.keys(I.marks).length + ' marks, ' + Object.keys(I.gw).length + ' datasheets with GW values)');
  } else {
    if(have !== want){ console.log('FAIL build-index: data.js BUILD_INDEX is not what verify/build-index.js writes (node verify/build-index.js --write)'); process.exit(1); }
    console.log('build-index: BUILD_INDEX is what verify/build-index.js writes');
  }
}
module.exports = { index };
