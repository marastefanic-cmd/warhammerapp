#!/usr/bin/env node
/* verify/import-test.js: the in-app list import (import.js, the same file the app runs) against the lists in data.js.
   1. data.js's BS_IDS table is exactly what verify/import-ids.js writes from BSData now.
   2. Every New Recruit JSON export in verify/sources/nr-json/ whose list name is a list in data.js imports to exactly
      that list, field for field (units, points, models, weapons, abilities, keywords, leads, warlord,
      enhancements, detachments, disposition), except the differences listed in INTENDED; the export kept on the
      phone (import.js slim) imports to the same. An export that differs from the New Recruit PDF the app's list
      was made from is listed in EXPORT_DIFFERS with the exact messages the import gives (and fails if it ever
      imports, or says anything else). An export that matches no list must fail (Adeptus Custodes: no such faction).
   3. Changed exports fail with the right messages: a unit renamed, a detachment changed, an unknown enhancement,
      an extra weapon, and more (NEGATIVE).
   4. A list made of units of two lists with the same faction, detachments and config imports from both.
   Exit 0 only when everything holds. */
'use strict';
const fs = require('fs'), path = require('path');
const { ROOT, loadData } = require('./lib');
const I = require(path.join(ROOT, 'import.js'));
const D = loadData();
const DIR = path.join(ROOT, 'verify/sources/nr-json');
const fails = []; let checks = 0;
const ok = (cond, msg) => { checks++; if(!cond) fails.push(msg); };
const clone = o => JSON.parse(JSON.stringify(o));
const DATE = '23 Oct 2026';

// the only differences between an imported list and the built-in list it equals
const INTENDED = {
  id: (a, b, A) => b === 'import-' + A.name.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),   // its own id: import- and the list's name (the built-in one keeps its id)
  source: (a, b) => /^New Recruit, exported /.test(a) && b === 'New Recruit, imported ' + DATE,   // the JSON export carries no export date
  imported: (a, b) => a === undefined && b === true        // marks a list kept on the phone (it can be removed)
};
// exports that differ from the PDF the app's list was made from (verify/sources/nr/<id>.txt): what the import says
const EXPORT_DIFFERS = {
  // none: the owner confirmed the exports of shooty, princes, standard and big-demons-baby as the current lists (23 Oct 2026),
  // and data.js has them; their older PDFs' differences are declared in verify/deviations-nr.json ("superseded")
};
// exports of lists the app does not have: the import must fail, saying this first
const NO_LIST = { 'lite-knights.json':'faction Adeptus Custodes not recognized' };

function diff(a, b, p, out){
  if(JSON.stringify(a) === JSON.stringify(b)) return out;
  if(a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)){
    for(const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], p ? p + '.' + k : k, out);
  } else out.push({ p, a, b });
  return out;
}
const run = (j, o) => I.resolve(j, D, Object.assign({ date:DATE }, o || {}));
const report = [];

/* 1. the table */
{
  const r = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'import-ids.js')], { encoding:'utf8' });
  ok(r.status === 0, 'BS_IDS: ' + (r.stdout + r.stderr).trim());
}

/* 2. every export */
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const listName = j => I.nn(String((j.roster || {}).name || '').replace(/'/g, '’'));
let same = 0, differs = 0, none = 0;
const byArmy = {};
for(const f of files){
  const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const a = D.armies.find(x => I.nn(x.name) === listName(j));
  const r = run(j), rs = run(JSON.parse(JSON.stringify(I.slim(j))));
  ok(JSON.stringify(r) === JSON.stringify(rs), f + ': the slim copy kept on the phone imports differently');
  if(!a){
    none++;
    ok(!r.ok, f + ': matches no list in data.js but imported');
    if(NO_LIST[f]) ok(!r.ok && r.errors[0] === NO_LIST[f], f + ': first message ' + JSON.stringify(r.errors && r.errors[0]) + ', want ' + JSON.stringify(NO_LIST[f]));
    report.push(f + ': no list of this name in the app; not imported: ' + (r.errors || []).join('; '));
    continue;
  }
  byArmy[a.id] = j;
  const known = EXPORT_DIFFERS[a.id];
  if(known){
    differs++;
    ok(!r.ok && JSON.stringify(r.errors) === JSON.stringify(known.errors), f + ': want the messages ' + JSON.stringify(known.errors) + ', got ' + JSON.stringify(r.ok ? 'imported' : r.errors));
    report.push(a.id + ': export differs from the app’s list (' + known.why + '): ' + (r.errors || []).join('; '));
    continue;
  }
  ok(r.ok, f + ': does not import: ' + (r.errors || []).join('; '));
  if(!r.ok) continue;
  const d = diff(clone(a), r.army, '', []);
  const bad = d.filter(x => !(INTENDED[x.p] && INTENDED[x.p](x.a, x.b, a)));
  for(const x of bad) ok(false, a.id + ': ' + x.p + ' is ' + JSON.stringify(x.b) + ' in the import, ' + JSON.stringify(x.a) + ' in data.js');
  for(const k of Object.keys(INTENDED)) ok(d.some(x => x.p === k), a.id + ': expected difference ' + k + ' missing');
  if(!bad.length){ same++; report.push(a.id + ': identical to data.js (' + r.army.units.length + ' units) except ' + d.map(x => x.p).join(', ')); }
}
const missing = D.armies.filter(a => !byArmy[a.id]).map(a => a.id);
report.push('lists without an export: ' + (missing.length ? missing.join(', ') : 'none'));

/* 3. changed exports */
const base = byArmy['6-bigs'];
const NEGATIVE = [];
const neg = (name, change, want) => NEGATIVE.push({ name, change, want });
const units = j => j.roster.forces[0].selections.filter(s => s.type !== 'upgrade');
const tops = j => j.roster.forces[0].selections.filter(s => s.type === 'upgrade');
const byName = (j, n, k) => units(j).filter(s => s.name === n)[k || 0];
if(base){
  neg('a unit renamed', j => { byName(j, 'Knight Errant').name = 'Knight Errant Mk II'; }, ['unit Knight Errant Mk II not recognized']);
  neg('a unit of another datasheet id', j => { const s = byName(j, 'Knight Errant'); s.entryId = s.entryId.replace(/[^:]+$/, '0000-0000-0000-0000'); }, ['unit Knight Errant not recognized']);
  neg('a detachment changed', j => { const d = tops(j).find(s => s.name === 'Detachment').selections[0]; d.name = 'Questor Forgepact'; d.entryId = d.entryId.replace(/[^:]+$/, '1111-2222-3333-4444'); }, ['detachment Questor Forgepact not recognized']);
  neg('a detachment of another faction', j => { const d = tops(j).find(s => s.name === 'Detachment').selections[0]; const id = Object.keys(D.bsIds.detachments).find(k => D.bsIds.detachments[k] === 'orks/war-horde'); d.name = 'War Horde'; d.entryId = d.entryId.replace(/[^:]+$/, id); }, ['detachment War Horde not recognized']);
  neg('an unknown enhancement', j => { byName(j, 'Knight Warden').selections.push({ id:'x1', name:'Mythic Hero', entryId:'e9f3-6605-87c9-89c6::9999-aaaa-bbbb-cccc', number:1, type:'upgrade', group:'Enhancements::Freeblade Company Enhancements', costs:[{ name:'pts', value:0 }] }); },
    ['enhancement Mythic Hero not recognized (on Knight Warden)']);
  neg('an extra weapon', j => { const d = byName(j, 'Knight Destrier'); const m = byName(j, 'Knight Errant').selections.find(s => s.name === 'Meltagun'); d.selections.push(Object.assign(clone(m), { id:'x2' })); },
    ['option Meltagun on unit Knight Destrier not recognized']);
  neg('a weapon swapped for an unknown one', j => { const s = byName(j, 'Knight Paladin').selections.find(x => x.name === 'Rapid-fire battle cannon'); s.name = 'Conflagration cannon'; s.entryId = s.entryId.replace(/[^:]+$/, '5555-6666-7777-8888'); },
    ['option Conflagration cannon on unit Knight Paladin not recognized', 'unit Knight Paladin without Rapid-fire battle cannon not recognized']);
  neg('a weapon renamed', j => { byName(j, 'Knight Paladin').selections.find(x => x.name === 'Meltagun').name = 'Melta gun'; }, ['option Melta gun on unit Knight Paladin not recognized']);
  neg('the Warlord moved to a unit the app has no Warlord of', j => { const w = byName(j, 'Knight Warden').selections; const k = w.findIndex(x => x.name === 'Warlord'); byName(j, 'Knight Errant').selections.push(w.splice(k, 1)[0]); },
    ['warlord Knight Errant not recognized (the app has no such unit as Warlord in this faction)', 'unit Knight Warden without Warlord not recognized']);
  neg('points changed', j => { byName(j, 'Knight Errant').costs[0].value = 360; j.roster.costs[0].value = 2005; }, ['points of unit Knight Errant not recognized: 360 pts in the export, 355 in the app']);
  neg('a disposition the detachment does not allow', j => { const d = tops(j).find(s => s.name === 'Force Disposition').selections[0]; const fc = D.factions['imperial-knights'].detachments['freeblade-company'].dispositions;
    const other = Object.entries(D.bsIds.dispositions).find(([, n]) => !fc.includes(n)); d.name = other[1]; d.entryId = d.entryId.replace(/[^:]+$/, other[0]); },
    null);   // filled below (depends on data.js's dispositions)
  neg('Code Chivalric left out', j => { const r = j.roster.forces[0]; r.selections = r.selections.filter(s => s.name !== 'Code Chivalric'); },
    ['detachment Freeblade Company not recognized: the app’s Imperial Knights lists have Freeblade Company (Code Chivalric Deed, Quality)']);
  neg('an unknown top-level selection', j => { j.roster.forces[0].selections.unshift({ id:'x3', name:'Crusade Force', entryId:'abcd-abcd-abcd-abcd', number:1, type:'upgrade', selections:[{ id:'x4', name:'Yes', entryId:'abcd-abcd-abcd-abce', number:1, type:'upgrade' }] }); }, ['selection Crusade Force not recognized']);
  neg('two forces', j => { j.roster.forces.push(clone(j.roster.forces[0])); }, ['a list with 2 forces not recognized (the app takes one Army Roster)']);
  neg('not JSON', () => '{ this is not json', ['not a New Recruit JSON export (the text is not JSON)']);
}
const db = byArmy['defilers-and-friends'];
if(db){
  neg('a leader detached from its bodyguard', j => { const l = byName(j, 'Lucius the Eternal'); delete l.associations; },
    ['unit Lucius the Eternal on its own not recognized (the app has it only in an attached unit)', 'unit Flawless Blades on its own not recognized (the app has it only in an attached unit)']);
  neg('several things at once (all listed)', j => { byName(j, 'Defiler').name = 'Defiler Mk II'; byName(j, 'Maulerfiend').selections[0].name = 'Big fists'; },
    ['unit Defiler Mk II not recognized', 'option Big fists on unit Maulerfiend not recognized']);
}
for(const n of NEGATIVE){
  const j = base && n.name !== 'a leader detached from its bodyguard' && !/several things/.test(n.name) ? clone(base) : clone(db);
  const out = n.change(j);
  const r = run(out === undefined ? j : out);
  if(n.want === null){ const d = j.roster.forces[0].selections.find(s => s.name === 'Force Disposition').selections[0].name; n.want = ['disposition ' + d + ' not recognized for Freeblade Company']; }
  ok(!r.ok && JSON.stringify(r.errors) === JSON.stringify(n.want), 'negative "' + n.name + '": want ' + JSON.stringify(n.want) + ', got ' + JSON.stringify(r.ok ? 'imported' : r.errors));
  report.push('negative: ' + n.name + ' → ' + (r.ok ? 'IMPORTED' : r.errors.join('; ')));
}

/* 4. a list of units from two lists of the same faction, detachments and config */
if(base && byArmy['4-megas-and-a-destrier']){
  const j = clone(base), other = byArmy['4-megas-and-a-destrier'];
  const crus = units(other).find(s => s.name === 'Knight Crusader');
  j.roster.forces[0].selections.push(clone(crus)); const cost = s => (s.costs || []).reduce((t, c) => t + (c.name === 'pts' ? c.value : 0), 0) + (s.selections || []).reduce((t, c) => t + cost(c), 0);
  j.roster.costs[0].value += cost(crus); j.roster.name = 'Seven bigs';
  const r = run(j);
  const want = D.armies.find(a => a.id === '4-megas-and-a-destrier').units.find(u => u.id === 'knight-crusader');
  ok(r.ok && JSON.stringify(r.army.units.find(u => u.name === 'Knight Crusader')) === JSON.stringify(want) && r.army.units.length === 5 && r.army.pointsUsed === 2000 + want.pts,
    'mixed list: 6 bigs + a Knight Crusader of 4 megas and a destrier: ' + JSON.stringify(r.ok ? r.army.units.map(u => u.id) : r.errors));
  report.push('mixed: 6 bigs + 4 megas’ Knight Crusader → ' + (r.ok ? r.army.units.map(u => u.id + (u.copies ? ' ×' + u.copies : '')).join(', ') : r.errors.join('; ')));
}

const outF = path.join(ROOT, 'verify/out/import.json');
fs.mkdirSync(path.dirname(outF), { recursive:true });
fs.writeFileSync(outF, JSON.stringify({ check:'import', checks, fails, report }, null, 1) + '\n');
console.log('import: ' + same + ' of ' + (same + differs) + ' exported lists import identically (' + differs + ' exports differ from the app’s list' + (differs ? ': ' + Object.keys(EXPORT_DIFFERS).join(', ') : '') + '), ' +
  none + ' without a list refused, ' + NEGATIVE.length + ' changed exports refused; ' + checks + ' checks, ' + fails.length + ' failures');
for(const r of report) console.log('  ' + r);
for(const f of fails) console.log('  FAIL ' + f);
process.exit(fails.length ? 1 : 0);
