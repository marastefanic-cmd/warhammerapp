#!/usr/bin/env node
/* verify/import-test.js: the in-app list import (import.js, the same file the app runs) against the lists in data.js.
   1. data.js's BS_IDS table is exactly what verify/import-ids.js writes from BSData now.
   2. Every New Recruit JSON export in verify/sources/nr-json/ whose list name is a list in data.js imports to exactly
      that list, field for field (units, points, models, weapons, abilities, keywords, leads, warlord,
      enhancements, detachments, disposition), except the differences listed in INTENDED; the export kept on the
      phone (import.js slim) imports to the same. An export that differs from the New Recruit PDF the app's list
      was made from is listed in EXPORT_DIFFERS with the exact messages the import gives (and fails if it ever
      imports, or says anything else). An export that matches no list must fail with NO_LIST's message.
   3. Changed exports fail with the right messages: a faction the app does not have, a unit renamed, a detachment changed, an unknown enhancement,
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
const NO_LIST = {};

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
const NEGATIVE = [];
// neg(name, list the change starts from, change, the messages wanted)
const neg = (name, from, change, want) => NEGATIVE.push({ name, from, change, want });
const units = j => j.roster.forces[0].selections.filter(s => s.type !== 'upgrade');
const tops = j => j.roster.forces[0].selections.filter(s => s.type === 'upgrade');
const byName = (j, n, k) => units(j).filter(s => s.name === n)[k || 0];
const cost = s => (s.costs || []).reduce((t, c) => t + (c.name === 'pts' ? c.value : 0), 0) + (s.selections || []).reduce((t, c) => t + cost(c), 0);
const sels = j => j.roster.forces[0].selections;
// take a unit out (and what it costs), put one in (from another export, a fresh id, unattached unless kept)
const drop = (j, n, k) => { const s = byName(j, n, k); sels(j).splice(sels(j).indexOf(s), 1); j.roster.costs[0].value -= cost(s); return s; };
const add = (j, s, id) => { const c = Object.assign(clone(s), { id }); if(!c.keepAssoc) delete c.associations; sels(j).push(c); j.roster.costs[0].value += cost(c); return c; };
const L = id => byArmy[id];
const PL = 'points total 2375 not recognized: over the Strike Force limit of 2000 pts';
if(L('lite-knights'))
  neg('a faction the app does not have', 'lite-knights', j => { const F = j.roster.forces[0]; F.catalogueId = '0000-aaaa-bbbb-cccc'; F.catalogueName = 'Imperium - Adeptus Astartes - Ultramarines'; },
    ['faction Ultramarines not recognized', "detachment Emperor's Chosen not recognized", 'detachment Grav-Assault Force not recognized', 'detachment Might of the Moritoi not recognized',
     'unit Trajann Valoris not recognized', 'unit Allarus Custodians not recognized', 'unit Prosecutor Squad not recognized', 'unit Witchseeker Squad not recognized',
     'unit Caladius Annihilator Grav-tank not recognized', 'unit Contemptor-Achillus Dreadnought not recognized', 'unit Contemptor-Galatus Dreadnought not recognized', 'unit Telemon Heavy Dreadnought not recognized']);
if(L('6-bigs')){
  neg('a unit renamed', '6-bigs', j => { byName(j, 'Knight Errant').name = 'Knight Errant Mk II'; }, ['unit Knight Errant Mk II not recognized']);
  neg('a unit of another datasheet id', '6-bigs', j => { const s = byName(j, 'Knight Errant'); s.entryId = s.entryId.replace(/[^:]+$/, '0000-0000-0000-0000'); }, ['unit Knight Errant not recognized']);
  neg('a detachment changed', '6-bigs', j => { const d = tops(j).find(s => s.name === 'Detachment').selections[0]; d.name = 'Questor Forgepact'; d.entryId = d.entryId.replace(/[^:]+$/, '1111-2222-3333-4444'); }, ['detachment Questor Forgepact not recognized']);
  neg('a detachment of another faction', '6-bigs', j => { const d = tops(j).find(s => s.name === 'Detachment').selections[0]; const id = Object.keys(D.bsIds.detachments).find(k => D.bsIds.detachments[k] === 'orks/war-horde'); d.name = 'War Horde'; d.entryId = d.entryId.replace(/[^:]+$/, id); }, ['detachment War Horde not recognized']);
  neg('a detachment listed twice', '6-bigs', j => { const d = tops(j).find(s => s.name === 'Detachment'); d.selections.push(clone(d.selections[0])); }, ['detachment Freeblade Company twice not recognized']);
  neg('two Detachment selections', '6-bigs', j => { sels(j).unshift(clone(tops(j).find(s => s.name === 'Detachment'))); }, ['detachment selection Detachment twice not recognized']);
  neg('an unknown enhancement', '6-bigs', j => { byName(j, 'Knight Warden').selections.push({ id:'x1', name:'Mythic Hero', entryId:'e9f3-6605-87c9-89c6::9999-aaaa-bbbb-cccc', number:1, type:'upgrade', group:'Enhancements::Freeblade Company Enhancements', costs:[{ name:'pts', value:0 }] }); },
    ['enhancement Mythic Hero not recognized (on Knight Warden)']);
  neg('an extra weapon', '6-bigs', j => { const d = byName(j, 'Knight Destrier'); const m = byName(j, 'Knight Errant').selections.find(s => s.name === 'Meltagun'); d.selections.push(Object.assign(clone(m), { id:'x2' })); },
    ['option Meltagun on unit Knight Destrier not recognized']);
  neg('a weapon taken three times', '6-bigs', j => { byName(j, 'Knight Errant').selections.find(c => c.name === 'Meltagun').number = 3; }, ['option 3× Meltagun on unit Knight Errant not recognized']);
  neg('a weapon swapped for an unknown one', '6-bigs', j => { const s = byName(j, 'Knight Paladin').selections.find(x => x.name === 'Rapid-fire battle cannon'); s.name = 'Conflagration cannon'; s.entryId = s.entryId.replace(/[^:]+$/, '5555-6666-7777-8888'); },
    ['option Conflagration cannon on unit Knight Paladin not recognized', 'unit Knight Paladin without Rapid-fire battle cannon not recognized']);
  neg('a weapon renamed', '6-bigs', j => { byName(j, 'Knight Paladin').selections.find(x => x.name === 'Meltagun').name = 'Melta gun'; }, ['option Melta gun on unit Knight Paladin not recognized']);
  neg('the Warlord moved to a unit the app has no Warlord of', '6-bigs', j => { const w = byName(j, 'Knight Warden').selections; const k = w.findIndex(x => x.name === 'Warlord'); byName(j, 'Knight Errant').selections.push(w.splice(k, 1)[0]); },
    ['warlord Knight Errant not recognized (the app has no such unit as Warlord in this faction)', 'unit Knight Warden without Warlord not recognized']);
  neg('the Warlord selection ×2', '6-bigs', j => { byName(j, 'Knight Warden').selections.find(c => c.name === 'Warlord').number = 2; }, ['warlord ×2 on unit Knight Warden not recognized']);
  neg('the Warlord unit taken twice', '6-bigs', j => { drop(j, 'Knight Paladin'); add(j, byName(L('6-bigs'), 'Knight Warden'), 'w2'); }, ['warlord not recognized: 2 units are the Warlord (Knight Warden and Knight Warden)']);
  neg('no Warlord', '6-bigs', j => { const w = byName(j, 'Knight Warden').selections; w.splice(w.findIndex(x => x.name === 'Warlord'), 1); },
    ['unit Knight Warden without Warlord not recognized']);
  neg('points changed', '6-bigs', j => { byName(j, 'Knight Errant').costs[0].value = 350; j.roster.costs[0].value = 1995; }, ['points of unit Knight Errant not recognized: 350 pts in the export, 355 in the app']);
  neg('the points limit changed', '6-bigs', j => { j.roster.costLimits[0].value = 123456; }, ['points limit 123456 not recognized: Strike Force is 2000 pts']);
  neg('over the points limit', '6-bigs', j => { add(j, byName(L('6-bigs'), 'Knight Paladin'), 'p3'); }, [PL]);
  // an export that names no points limit (no costLimits, as fellhammer-siege-task-force's): the battle size's limit still holds
  neg('over the points limit, no costLimits in the export', '6-bigs', j => { delete j.roster.costLimits; add(j, byName(L('6-bigs'), 'Knight Paladin'), 'p3'); }, [PL]);
  neg('two battle sizes', '6-bigs', j => { const b = tops(j).find(s => s.name === 'Battle Size'); b.selections.push(Object.assign(clone(b.selections[0]), { name:'Incursion (1000 Point limit)' })); },
    ['battle size Incursion (1000 Point limit) not recognized (a list has one battle size)']);
  neg('an unknown battle size', '6-bigs', j => { const b = tops(j).find(s => s.name === 'Battle Size').selections[0]; b.name = 'Apocalypse'; b.entryId = b.entryId.replace(/[^:]+$/, 'aaaa-0000-0000-0000'); },
    ['battle size Apocalypse not recognized']);
  neg('a disposition the detachment does not allow', '6-bigs', j => { const d = tops(j).find(s => s.name === 'Force Disposition').selections[0]; const fc = D.factions['imperial-knights'].detachments['freeblade-company'].dispositions;
    const other = Object.entries(D.bsIds.dispositions).find(([, n]) => !fc.includes(n)); d.name = other[1]; d.entryId = d.entryId.replace(/[^:]+$/, other[0]); },
    ['disposition Disruption not recognized for Freeblade Company']);
  neg('two dispositions (one not allowed)', '6-bigs', j => { const d = tops(j).find(s => s.name === 'Force Disposition'); const dis = Object.entries(D.bsIds.dispositions).find(([, n]) => n === 'Disruption');
    d.selections.unshift({ id:'x5', name:'Disruption', entryId:dis[0], type:'upgrade', number:1, group:'Force Disposition' }); },
    ['disposition Purge the Foe not recognized (a list has one Force Disposition)', 'disposition Disruption not recognized for Freeblade Company']);
  neg('Code Chivalric left out', '6-bigs', j => { const r = j.roster.forces[0]; r.selections = r.selections.filter(s => s.name !== 'Code Chivalric'); },
    ['detachment Freeblade Company not recognized: the app’s Imperial Knights lists have Freeblade Company (Code Chivalric Deed, Quality)']);
  neg('an unknown Code Chivalric choice', '6-bigs', j => { tops(j).find(s => s.name === 'Code Chivalric').selections[0].name = 'Oath'; }, ['selection Oath in Code Chivalric not recognized']);
  neg('a unit hidden under Show/Hide Options', '6-bigs', j => { tops(j).find(s => s.name === 'Show/Hide Options').selections.push({ id:'x6', name:'Knight Castellan', entryId:'zzz', type:'model', number:1, costs:[{ name:'pts', value:0 }] }); },
    ['selection Knight Castellan in Show/Hide Options not recognized']);
  neg('an unknown top-level selection', '6-bigs', j => { sels(j).unshift({ id:'x3', name:'Crusade Force', entryId:'abcd-abcd-abcd-abcd', number:1, type:'upgrade', selections:[{ id:'x4', name:'Yes', entryId:'abcd-abcd-abcd-abce', number:1, type:'upgrade' }] }); }, ['selection Crusade Force not recognized']);
  neg('two forces', '6-bigs', j => { j.roster.forces.push(clone(j.roster.forces[0])); }, ['a list with 2 forces not recognized (the app takes one Army Roster)']);
  neg('not JSON', '6-bigs', () => '{ this is not json', ['not a New Recruit JSON export (the text is not JSON)']);
  const cat = Object.keys(D.bsIds.factions)[0];
  neg('a null selection', '6-bigs', () => ({ roster:{ forces:[{ catalogueId:cat, selections:[null] }] } }), ['not a New Recruit JSON export (a selection is malformed)']);
  neg('selections a string', '6-bigs', () => ({ roster:{ forces:[{ catalogueId:cat, selections:'abc' }] } }), ['not a New Recruit JSON export (the force has no selections)']);
  neg('a name that is no text', '6-bigs', () => ({ roster:{ forces:[{ catalogueId:'x', selections:[{ type:'model', name:{}, entryId:'a', number:1 }] }] } }), ['not a New Recruit JSON export (a selection is malformed)']);
  neg('a count that is no number', '6-bigs', j => { byName(j, 'Knight Errant').number = '1'; }, ['not a New Recruit JSON export (a selection is malformed)']);
  neg('no roster', '6-bigs', () => ({ list:[] }), ['not a New Recruit JSON export (no roster)']);
}
if(L('4-megas-and-a-destrier'))
  neg('a bundle of weapons taken twice', '4-megas-and-a-destrier', j => { byName(j, 'Knight Crusader').selections.find(c => c.name === 'Rapid-fire battlecannon and Questoris heavy stubber').number = 2; },
    ['option 2× Rapid-fire battlecannon and Questoris heavy stubber on unit Knight Crusader not recognized']);
if(L('defilers-and-friends')){
  neg('two excruciator cannons ×2', 'defilers-and-friends', j => { for(const d of units(j).filter(s => s.name === 'Defiler')) for(const c of d.selections) if(c.name === 'Two excruciator cannons'){ c.number = 2; return; } },
    ['option 2× Two excruciator cannons on unit Defiler not recognized']);
  neg('a leader detached from its bodyguard', 'defilers-and-friends', j => { delete byName(j, 'Lucius the Eternal').associations; },
    ['unit Lucius the Eternal on its own not recognized (the app has it only in an attached unit)', 'unit Flawless Blades on its own not recognized (the app has it only in an attached unit)']);
  neg('several things at once (all listed)', 'defilers-and-friends', j => { byName(j, 'Defiler').name = 'Defiler Mk II'; byName(j, 'Maulerfiend').selections[0].name = 'Big fists'; },
    ['unit Defiler Mk II not recognized', 'option Big fists on unit Maulerfiend not recognized']);
  neg('a leader attached to a unit inside another', 'defilers-and-friends', j => { const l = byName(j, 'Lucius the Eternal'); l.associations[0].to = byName(j, 'Defiler').selections[0].id; },
    ['leader attachment of Lucius the Eternal not recognized (what it leads is not a unit of the list)', 'unit Lucius the Eternal on its own not recognized (the app has it only in an attached unit)', 'unit Flawless Blades on its own not recognized (the app has it only in an attached unit)']);
}
if(L('princes') && L('standard')){
  neg('two leaders swapped between their bodyguards', 'princes', j => { const k = byName(j, 'Khârn the Betrayer'), l = byName(j, 'Lord on Juggernaut'); const t = k.associations[0].to; k.associations[0].to = l.associations[0].to; l.associations[0].to = t; },
    null);
  neg('two leaders on one bodyguard', 'princes', j => { byName(j, 'Lord on Juggernaut').associations[0].to = byName(j, 'Khârn the Betrayer').associations[0].to; },
    null);
  neg('no Warlord (the Daemon Prince that is taken out)', 'princes', j => { drop(j, 'Daemon Prince of Khorne'); }, ['warlord not recognized: no unit is the Warlord']);
  neg('an enhancement on two characters', 'standard', j => { drop(j, 'Forgefiend'); drop(j, 'Forgefiend'); add(j, byName(L('princes'), 'Daemon Prince of Khorne', 1), 'g2'); },
    ['enhancement Berzerker Glaive ×2 not recognized (BSData allows 1 per list)']);
  neg('a second Warlord from another list', 'standard', j => { drop(j, 'Forgefiend'); drop(j, 'Forgefiend'); add(j, byName(L('princes'), 'Daemon Prince of Khorne', 0), 'w3'); },
    ['warlord not recognized: 2 units are the Warlord (Angron and Daemon Prince of Khorne)']);
}
if(L('purge-goes-the-foe'))
  neg('an Epic Hero twice', 'purge-goes-the-foe', j => { drop(j, 'Skorpius Disintegrator'); drop(j, 'Skorpius Disintegrator'); add(j, byName(L('purge-goes-the-foe'), 'Thulia Ghuld'), 't2'); },
    ['unit Thulia Ghuld ×2 not recognized (BSData allows 1 per list)']);

for(const n of NEGATIVE){
  const j = clone(byArmy[n.from]);
  const out = n.change(j);
  const r = run(out === undefined ? j : out);
  if(n.want === null){ ok(!r.ok, 'negative "' + n.name + '": imported'); }   // the messages depend on which unit is closest: any refusal
  else ok(!r.ok && JSON.stringify(r.errors) === JSON.stringify(n.want), 'negative "' + n.name + '": want ' + JSON.stringify(n.want) + ', got ' + JSON.stringify(r.ok ? 'imported' : r.errors));
  report.push('negative: ' + n.name + ' → ' + (r.ok ? 'IMPORTED' : r.errors.join('; ')));
}

/* 4. lists the app has no copy of, made of its units: accepted */
if(L('6-bigs') && L('4-megas-and-a-destrier')){
  // 6 bigs with its two Knight Destriers (2 × 265) swapped for the Knight Crusader of 4 megas and a destrier (435): 1905 pts
  const j = clone(L('6-bigs')); drop(j, 'Knight Destrier'); drop(j, 'Knight Destrier'); add(j, byName(L('4-megas-and-a-destrier'), 'Knight Crusader'), 'c1'); j.roster.name = 'Five bigs';
  const r = run(j);
  const want = D.armies.find(a => a.id === '4-megas-and-a-destrier').units.find(u => u.id === 'knight-crusader');
  ok(r.ok && JSON.stringify(r.army.units.find(u => u.name === 'Knight Crusader')) === JSON.stringify(want) && r.army.units.length === 4 && r.army.pointsUsed === 1905,
    'mixed list: 6 bigs, its Destriers swapped for 4 megas’ Knight Crusader: ' + JSON.stringify(r.ok ? r.army.units.map(u => u.id) : r.errors));
  report.push('accepted: 6 bigs, its Destriers swapped for 4 megas’ Knight Crusader → ' + (r.ok ? r.army.units.map(u => u.id + (u.copies ? ' ×' + u.copies : '')).join(', ') : r.errors.join('; ')));
  // a third Knight Destrier for the Knight Errant (BSData allows 3): the unit as a copy more than 6 bigs has
  const k = clone(L('6-bigs')); drop(k, 'Knight Errant'); add(k, byName(L('6-bigs'), 'Knight Destrier'), 'd3');
  const r2 = run(k), d = r2.ok && r2.army.units.find(u => u.id === 'knight-destrier');
  ok(r2.ok && d && d.copies === 3, 'three Knight Destriers: ' + JSON.stringify(r2.ok ? r2.army.units.map(u => u.id + ' ×' + (u.copies || 1)) : r2.errors));
  report.push('accepted: 6 bigs with a third Knight Destrier for its Knight Errant → ' + (r2.ok ? r2.army.units.map(u => u.id + (u.copies ? ' ×' + u.copies : '')).join(', ') : r2.errors.join('; ')));
  // a name that is markup stays text (the app escapes it)
  const h = clone(L('6-bigs')); h.roster.name = '<img src=x onerror=alert(1)>';
  const r3 = run(h);
  ok(r3.ok && r3.army.name === '<img src=x onerror=alert(1)>' && r3.army.id === 'import-img-src-x-onerror-alert-1', 'a name that is markup: ' + JSON.stringify(r3.ok ? [r3.army.name, r3.army.id] : r3.errors));
}

const outF = path.join(ROOT, 'verify/out/import.json');
fs.mkdirSync(path.dirname(outF), { recursive:true });
fs.writeFileSync(outF, JSON.stringify({ check:'import', checks, fails, report }, null, 1) + '\n');
console.log('import: ' + same + ' of ' + (same + differs) + ' exported lists import identically (' + differs + ' exports differ from the app’s list' + (differs ? ': ' + Object.keys(EXPORT_DIFFERS).join(', ') : '') + '), ' +
  none + ' without a list refused, ' + NEGATIVE.length + ' changed exports refused; ' + checks + ' checks, ' + fails.length + ' failures');
for(const r of report) console.log('  ' + r);
for(const f of fails) console.log('  FAIL ' + f);
process.exit(fails.length ? 1 : 0);
