#!/usr/bin/env node
/* verify/import-test.js: the in-app list import (import.js, the same file the app runs) against the lists in data.js.
   1. data.js's NR_IDS table is exactly what verify/import-ids.js writes from the New Recruit exports now.
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
  ok(r.status === 0, 'NR_IDS: ' + (r.stdout + r.stderr).trim());
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
  neg('a faction the app does not have', 'lite-knights', j => { const F = j.roster.forces[0]; F.catalogueId = '0000-aaaa-bbbb-cccc'; F.catalogueName = 'Imperium - Astra Militarum'; },
    ['faction Astra Militarum not recognized', "detachment Emperor's Chosen not recognized", 'detachment Grav-Assault Force not recognized', 'detachment Might of the Moritoi not recognized',
     'unit Trajann Valoris not recognized', 'unit Allarus Custodians not recognized', 'unit Prosecutor Squad not recognized', 'unit Witchseeker Squad not recognized',
     'unit Caladius Annihilator Grav-tank not recognized', 'unit Contemptor-Achillus Dreadnought not recognized', 'unit Contemptor-Galatus Dreadnought not recognized', 'unit Telemon Heavy Dreadnought not recognized']);
if(L('6-bigs')){
  neg('a unit renamed', '6-bigs', j => { byName(j, 'Knight Errant').name = 'Knight Errant Mk II'; }, ['unit Knight Errant Mk II not recognized']);
  neg('a unit of another datasheet id', '6-bigs', j => { const s = byName(j, 'Knight Errant'); s.entryId = s.entryId.replace(/[^:]+$/, '0000-0000-0000-0000'); }, ['unit Knight Errant not recognized']);
  neg('a detachment changed', '6-bigs', j => { const d = tops(j).find(s => s.name === 'Detachment').selections[0]; d.name = 'Questor Forgepact'; d.entryId = d.entryId.replace(/[^:]+$/, '1111-2222-3333-4444'); }, ['detachment Questor Forgepact not recognized']);
  neg('a detachment of another faction', '6-bigs', j => { const d = tops(j).find(s => s.name === 'Detachment').selections[0]; const id = Object.keys(D.nrIds.detachments).find(k => D.nrIds.detachments[k] === 'orks/war-horde'); d.name = 'War Horde'; d.entryId = d.entryId.replace(/[^:]+$/, id); }, ['detachment War Horde not recognized']);
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
  neg('two battle sizes', '6-bigs', j => { const b = tops(j).find(s => s.name === 'Battle Size'); b.selections.push(clone(b.selections[0])); },
    ['battle size Strike Force (2000 Point limit) not recognized (a list has one battle size)']);
  neg('an unknown battle size', '6-bigs', j => { const b = tops(j).find(s => s.name === 'Battle Size').selections[0]; b.name = 'Apocalypse'; b.entryId = b.entryId.replace(/[^:]+$/, 'aaaa-0000-0000-0000'); },
    ['battle size Apocalypse not recognized']);
  neg('a disposition the detachment does not allow', '6-bigs', j => { const d = tops(j).find(s => s.name === 'Force Disposition').selections[0]; const fc = D.factions['imperial-knights'].detachments['freeblade-company'].dispositions;
    // (Disruption: a disposition no known export has shown, found by its name)
    const other = ['dddd-0000-0000-0001', 'Disruption']; if(fc.includes(other[1])) throw new Error('Freeblade Company allows Disruption: the test tests nothing'); d.name = other[1]; d.entryId = d.entryId.replace(/[^:]+$/, other[0]); },
    ['disposition Disruption not recognized for Freeblade Company']);
  neg('two dispositions (one not allowed)', '6-bigs', j => { const d = tops(j).find(s => s.name === 'Force Disposition'); const dis = Object.entries(D.nrIds.dispositions).find(([, n]) => n === 'Disruption') || ['dddd-0000-0000-0001'];
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
  const cat = Object.keys(D.nrIds.factions)[0];
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
    ['enhancement Berzerker Glaive ×2 not recognized (GW’s rules allow 1 per list)']);
  neg('a second Warlord from another list', 'standard', j => { drop(j, 'Forgefiend'); drop(j, 'Forgefiend'); add(j, byName(L('princes'), 'Daemon Prince of Khorne', 0), 'w3'); },
    ['warlord not recognized: 2 units are the Warlord (Angron and Daemon Prince of Khorne)']);
}
if(L('purge-goes-the-foe'))
  neg('an Epic Hero twice', 'purge-goes-the-foe', j => { drop(j, 'Skorpius Disintegrator'); drop(j, 'Skorpius Disintegrator'); add(j, byName(L('purge-goes-the-foe'), 'Thulia Ghuld'), 't2'); },
    ['unit Thulia Ghuld ×2 not recognized (GW’s rules allow 1 per list)']);

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

/* 5. ids and names: a selection whose id no known export has shown is found by its exact New Recruit name, or refused, named */
if(L('6-bigs')){
  const UNK = k => 'ffff-0000-0000-' + String(k).padStart(4, '0');
  const reId = (s, k) => { s.entryId = s.entryId.replace(/[^:]+$/, UNK(k)); };
  // every top-level selection and its choice under ids the app has never seen, their names kept: the same list
  const j = clone(L('6-bigs')); let k = 0;
  for(const t of tops(j)){ reId(t, ++k); for(const c of t.selections || []) reId(c, ++k); }
  j.roster.forces[0].catalogueId = UNK(999);
  const r = run(j), base = run(clone(L('6-bigs')));
  ok(r.ok && base.ok && JSON.stringify(r.army) === JSON.stringify(base.army), 'unknown ids, exact names: the faction, battle size, detachment, disposition and options by name give the same list: ' + JSON.stringify(r.ok ? 'imported' : r.errors));
  report.push('accepted: 6 bigs with every top-level id unknown, by exact name → ' + (r.ok ? 'the same list' : r.errors.join('; ')));
  // an unknown id and a name that is nothing of the app's: refused, named
  const j2 = clone(L('6-bigs')), d2 = tops(j2).find(s => s.name === 'Detachment').selections[0]; reId(d2, 1); d2.name = 'Freeblade Compani';
  const r2 = run(j2);
  ok(!r2.ok && JSON.stringify(r2.errors) === JSON.stringify(['detachment Freeblade Compani not recognized']), 'unknown id, a name that is no detachment: ' + JSON.stringify(r2.ok ? 'imported' : r2.errors));
  report.push('negative: an unknown id with a name that is no detachment → ' + (r2.ok ? 'IMPORTED' : r2.errors.join('; ')));
  // a known id under another name is not that thing (an id never stands in for a name)
  const j3 = clone(L('6-bigs')), d3 = tops(j3).find(s => s.name === 'Force Disposition').selections[0]; d3.name = 'Take and Hold';
  const r3 = run(j3);
  ok(!r3.ok, 'a known id under another name: ' + JSON.stringify(r3.ok ? 'imported' : r3.errors));
  report.push('negative: a known disposition id under another name → ' + (r3.ok ? 'IMPORTED' : r3.errors.join('; ')));
  // a known id under another name, for every top-level thing (the reviewer's cases): a battle size, the faction, a config and an info parent
  const ren = (what, f, want) => { const j5 = clone(L('6-bigs')); f(j5); const r5 = run(j5);
    ok(!r5.ok && (!want || JSON.stringify(r5.errors) === JSON.stringify(want)), 'a known id under another name (' + what + '): ' + JSON.stringify(r5.ok ? 'imported' : r5.errors) + (want ? ', want ' + JSON.stringify(want) : ''));
    report.push('negative: a known id under another name (' + what + ') → ' + (r5.ok ? 'IMPORTED' : r5.errors.join('; '))); };
  ren('the Strike Force id named Incursion (1000 Point limit)', j5 => { tops(j5).find(s => s.name === 'Battle Size').selections[0].name = 'Incursion (1000 Point limit)'; }, ['battle size Incursion (1000 Point limit) not recognized']);
  ren('the catalogue id with the name Xenos - Necrons', j5 => { j5.roster.forces[0].catalogueName = 'Xenos - Necrons'; }, null);
  ren('Code Chivalric X', j5 => { tops(j5).find(s => s.name === 'Code Chivalric').name = 'Code Chivalric X'; }, null);
  ren('Show/Hide Options X', j5 => { tops(j5).find(s => s.name === 'Show/Hide Options').name = 'Show/Hide Options X'; }, null);
  // a unit under an id no export has shown (a faction with no catalogue: its units are copied by their ids' signature): refused, named
  const j4 = clone(L('6-bigs')); reId(byName(j4, 'Knight Errant'), 7);
  const r4 = run(j4);
  ok(!r4.ok && r4.errors.includes('unit Knight Errant not recognized'), 'a unit under an unknown id: ' + JSON.stringify(r4.ok ? 'imported' : r4.errors));
}

/* 6. made-up exports of a catalogued faction (verify/sources/import-madeup: units and detachments no list of the owner's has, their ids
   made up, found by exact name), built as the phone builds them (import.js make, builder.js) */
{ // (the boxes as the phone counts them: effects.js where builder.js reads it, the page's window here, verify/lib loadData's)
  const EF = require(path.join(ROOT, 'effects.js')); globalThis.WH_EFFECTS = EF; if(global.window) global.window.WH_EFFECTS = EF;
  const MD = path.join(ROOT, 'verify/sources/import-madeup'), mk = j => I.make(I.slim(j), D, { id:'local-test', date:DATE });
  const M = f => JSON.parse(fs.readFileSync(path.join(MD, f), 'utf8'));
  if(fs.existsSync(path.join(MD, 'brazen-engines.json'))){
    // Brazen Engines: a Chaos Land Raider with Murder-Forged Entity ("This unit has DAEMON."): the keyword and its note, so Rampaging Terrors'
    // Terror of Khorne and the DAEMON VEHICLE stratagems are its; a Defiler with both excruciator cannons replaced with 2 magma cutters
    // (GW: "This model’s excruciator cannons can be replaced with 2 magma cutters.", every one the default has)
    const r = mk(M('brazen-engines.json')), lr = r.ok && r.army.units.find(u => u.id === 'chaos-land-raider'), df = r.ok && r.army.units.find(u => u.id === 'defiler');
    ok(r.ok && lr && lr.kw.includes('Daemon') && /^Daemon comes from Murder-Forged Entity /.test(lr.kwNote || '') && lr.abilities.some(a => a.name === 'Terror of Khorne'),
      'made up: Murder-Forged Entity gives DAEMON (and Terror of Khorne): ' + JSON.stringify(r.ok ? lr && [lr.kw, lr.kwNote, lr.abilities.map(a => a.name)] : r.errors));
    ok(r.ok && df && JSON.stringify(df.gear) === JSON.stringify([['Hades battle cannon', 'Magma cutters', 'Magma cutters', 'Heavy missile launcher', 'Heavy baleflamer', 'Shearing claws']]),
      'made up: a Defiler with both excruciator cannons replaced: ' + JSON.stringify(r.ok ? df && df.gear : r.errors));
    report.push('accepted (made up): Brazen Engines, Land Raider with Murder-Forged Entity, Defiler with 2 magma cutters → ' + (r.ok ? r.army.units.map(u => u.id).join(', ') : r.errors.join('; ')));
    // the same export naming the detachment Possessed Slaughterband (Wahapedia's heading, New Recruit's data's name; GW's Possessed
    // Slaughterbound), without the Brazen Engines upgrade
    const j2 = clone(M('brazen-engines.json')), top = n => j2.roster.forces[0].selections.find(x => x.name === n);
    top('Detachment').selections[0].name = 'Possessed Slaughterband'; top('Force Disposition').selections[0].name = 'Purge the Foe';
    const lr2 = j2.roster.forces[0].selections.find(x => x.name === 'Chaos Land Raider'); lr2.selections = lr2.selections.filter(c => c.name !== 'Murder-Forged Entity');
    const r2 = mk(j2);
    ok(r2.ok && JSON.stringify(r2.army.detachments) === JSON.stringify(['possessed-slaughterbound']), 'made up: Possessed Slaughterband is Possessed Slaughterbound: ' + JSON.stringify(r2.ok ? r2.army.detachments : r2.errors));
    report.push('accepted (made up): the detachment named Possessed Slaughterband → ' + (r2.ok ? r2.army.detachments.join(', ') : r2.errors.join('; ')));
  }
  if(fs.existsSync(path.join(MD, 'vessels-gateways.json'))){
    // Vessels of Wrath: a Daemon Prince of Khorne with Gateways to Glory ("This model has: - MOBILE. - +1 to charge rolls."): MOBILE and its note
    const r = mk(M('vessels-gateways.json')), dp = r.ok && r.army.units.find(u => u.id === 'daemon-prince-of-khorne');
    ok(r.ok && dp && dp.kw.includes('Mobile') && /^Mobile comes from Gateways to Glory /.test(dp.kwNote || ''), 'made up: Gateways to Glory gives MOBILE: ' + JSON.stringify(r.ok ? dp && [dp.kw, dp.kwNote] : r.errors));
    report.push('accepted (made up): Vessels of Wrath, Daemon Prince of Khorne with Gateways to Glory → ' + (r.ok ? dp.kw.join(', ') : r.errors.join('; ')));
  }
  if(fs.existsSync(path.join(MD, 'brazen-engines-half-swap.json'))){
    // one excruciator cannon kept and 2 magma cutters taken: not what GW's datasheet allows
    const r = mk(M('brazen-engines-half-swap.json'));
    const want = ['unit Defiler not imported: Defiler with Hades battle cannon, Excruciator cannon, Magma cutters, Magma cutters, Heavy missile launcher, Heavy baleflamer and Shearing claws is not what GW’s datasheet Defiler allows (its UNIT COMPOSITION and WARGEAR OPTIONS: no mix of its WARGEAR OPTIONS gives all of it at once)'];
    ok(!r.ok && JSON.stringify(r.errors) === JSON.stringify(want), 'made up: a Defiler with one excruciator cannon and 2 magma cutters refused: ' + JSON.stringify(r.ok ? 'imported' : r.errors));
    report.push('negative (made up): a Defiler with one excruciator cannon and 2 magma cutters → ' + (r.ok ? 'IMPORTED' : r.errors.join('; ')));
  }
  // the Helbrute's WARGEAR OPTIONS (GW): "This model’s multi-melta can be replaced with one of the following: 1 plasma cannon; 1 twin
  // autocannon; 1 twin heavy bolter; 1 twin lascannon; 1 Helbrute fist", "This model’s missile launcher can be replaced with one of the
  // following: 1 Helbrute fist; 1 Helbrute hammer; 1 power scourge", "For each Helbrute fist this model is equipped with, it can be equipped
  // with one of the following: 1 combi-bolter; 1 heavy flamer". Each loadout is the armoury export's Helbrute with those weapons only (each
  // weapon's selection as New Recruit holds it); every option and their mixes build at GW's 120 pts, the others are refused, named
  if(fs.existsSync(path.join(MD, 'helbrute-armoury.json'))){
    const A = M('helbrute-armoury.json'), lib = A.roster.forces[0].selections.find(x => x.name === 'Helbrute').selections;
    const helb = gear => { const j = clone(A), h = j.roster.forces[0].selections.find(x => x.name === 'Helbrute'), c = {}; for(const g of gear) c[g] = (c[g] || 0) + 1;
      h.selections = Object.entries(c).map(([g, n]) => Object.assign(clone(lib.find(x => x.name === g)), { number:n })); return mk(j); };
    const ML = 'Missile launcher', MM = 'Multi-melta', CCW = 'Close combat weapon', F = 'Helbrute fist', CB = 'Combi-bolter', HF = 'Heavy flamer';
    const legal = [[ML, MM, CCW], [ML, 'Plasma cannon', CCW], [ML, 'Twin autocannon', CCW], [ML, 'Twin heavy bolter', CCW], [ML, 'Twin lascannon', CCW], [ML, F, CCW],
      [F, MM, CCW], ['Helbrute hammer', MM, CCW], ['Power scourge', MM, CCW], [ML, F, CCW, CB], [F, MM, CCW, HF], [F, F, CCW, CB, HF], [F, F, CCW, CB, CB], [F, F, CCW, HF], [F, F, CCW],
      ['Helbrute hammer', 'Twin lascannon', CCW], ['Power scourge', F, CCW, HF]];
    for(const g of legal){ const r = helb(g), h = r.ok && r.army.units.find(u => u.id === 'helbrute');
      ok(r.ok && h && h.pts === 120 && JSON.stringify(h.gear) === JSON.stringify([g]), 'made up: a Helbrute with ' + g.join(', ') + ' builds at 120 pts: ' + JSON.stringify(r.ok ? h && [h.pts, h.gear] : r.errors)); }
    report.push('accepted (made up): ' + legal.length + ' Helbrute loadouts, every option and their mixes, each at 120 pts');
    const PER = ' (“For each Helbrute fist this model is equipped with, it can be equipped with one of the following”)', MIX = 'no mix of its WARGEAR OPTIONS gives all of it at once';
    const illegal = [[[ML, MM, CCW, CB], '1 of combi-bolter or heavy flamer for 0 Helbrute fists' + PER], [[ML, F, CCW, CB, HF], '2 of combi-bolter or heavy flamer for 1 Helbrute fist' + PER],
      [[F, F, CCW, CB, CB, HF], '3 of combi-bolter or heavy flamer for 2 Helbrute fists' + PER], [[ML, 'Helbrute hammer', CCW], MIX], [['Twin lascannon', MM, CCW], MIX],
      [[ML, MM, 'Twin lascannon', CCW], MIX], [[ML, MM], MIX], [['Twin lascannon', 'Twin lascannon', CCW], MIX]];
    for(const [g, why] of illegal){ const r = helb(g), want = ['unit Helbrute not imported: Helbrute with ' + (g.length < 2 ? g.join('') : g.slice(0, -1).join(', ') + ' and ' + g[g.length - 1]) + ' is not what GW’s datasheet Helbrute allows (its UNIT COMPOSITION and WARGEAR OPTIONS: ' + why + ')'];
      ok(!r.ok && JSON.stringify(r.errors) === JSON.stringify(want), 'made up: a Helbrute with ' + g.join(', ') + ' refused: ' + JSON.stringify(r.ok ? 'imported' : r.errors) + ', want ' + JSON.stringify(want));
      report.push('negative (made up): a Helbrute with ' + g.join(', ') + ' → ' + (r.ok ? 'IMPORTED' : r.errors.join('; '))); }
  }
  // a value of the export's other than GW's that no rule of the list could change: every rule reaching the unit read through (each sentence
  // a box, words not counted or a reading that it changes no value: BOXES ox; no box falling back unless both readers say it changes no
  // value of the profile, AGREE nv), none of its readings, conditions or not, changing that field, no index entry, no words naming it
  // (builder.js couldTouch): the export's own data (New Recruit's), GW's value built, marked on the row (gwx, "‡") and said in the list's
  // note. Lord Invocatus's Bolt pistol at BS 2+ (GW: 4+), the friend's report
  { const prof = (sel, n, v) => { (function f(x){ for(const p0 of x.profiles || []) for(const c of p0.characteristics || []) if(c.name === n) c.$text = v; for(const y of x.selections || []) f(y); })(sel); };
    const top = (j, n) => j.roster.forces[0].selections.find(x => x.name === n), sub = (sel, re) => { let w = null; (function f(xs){ for(const x of xs || []){ if(!w && re.test(x.name)) w = x; f(x.selections); } })([sel]); return w; };
    if(fs.existsSync(path.join(MD, 'cult-of-blood-helbrute.json'))){
      // (in a Cult of Blood list the same value is refused: Idols of Khorne, its detachment rule, has a stat box that falls back (Idol of
      // Burning Wrath: Move, Advance and Charge; reader2 does not read it), so it could change a value; the Murderband below builds)
      const j = M('cult-of-blood-helbrute.json'); prof(sub(top(j, 'Lord Invocatus'), /^Bolt pistol$/), 'BS', '2+');
      const r = mk(j);
      ok(!r.ok && JSON.stringify(r.errors) === JSON.stringify(['unit Lord Invocatus: Bolt pistol BS is changed by a rule the app cannot name: not imported']),
        'made up: Lord Invocatus’s Bolt pistol at BS 2+ in Cult of Blood (Idols of Khorne falls back) refused: ' + JSON.stringify(r.ok ? r.army.gwValues || 'imported' : r.errors));
      report.push('negative (made up): Lord Invocatus’s Bolt pistol at BS 2+ in Cult of Blood (Idols of Khorne has a box that falls back) → ' + (r.ok ? 'IMPORTED' : r.errors.join('; ')));
      // a rule of the unit that sets the value (Daemonic Icon: "a Leadership characteristic of 6+") and a value it does not give: refused
      const j2 = M('cult-of-blood-helbrute.json'), bl = top(j2, 'Bloodletters');
      bl.selections.push({ id:'icon1', name:'Daemonic Icon', entryId:'madeup::Daemonic Icon', type:'upgrade', number:1, from:'entry', profiles:[{ name:'Daemonic Icon', typeName:'Abilities', characteristics:[{ name:'Description', $text:'Models in the bearer’s unit have a Leadership characteristic of 6+.' }] }] });
      prof(bl, 'LD', '5+');
      const r2 = mk(j2), want2 = ['unit Bloodletters: Bloodletters Ld is 5+ in the export; GW’s 7+ with Daemonic Icon is 6+: not imported'];
      ok(!r2.ok && JSON.stringify(r2.errors) === JSON.stringify(want2), 'made up: Bloodletters with a Daemonic Icon at Ld 5+ refused: ' + JSON.stringify(r2.ok ? 'imported' : r2.errors));
      report.push('negative (made up): Bloodletters with a Daemonic Icon at Ld 5+ → ' + (r2.ok ? 'IMPORTED' : r2.errors.join('; ')));
    }
    // a rule of the unit no reader has read (a Keeper of Secrets of the Chaos Daemons catalogue, not read: Daemon Lord of Slaanesh (Aura),
    // "improve the Armour Penetration of melee weapons in that unit by 1", reaches its own unit, Core Rules 22.01) and the export's melee AP
    // one better than GW's: refused, never GW's in its place (the reviewer's case, rev-tests kos.js, in tzeentch-keeper-of-secrets.json)
    if(fs.existsSync(path.join(MD, 'tzeentch-keeper-of-secrets.json'))){
      const r = mk(M('tzeentch-keeper-of-secrets.json')), want = ['Ritual knife', 'Snapping claws', 'Witstealer sword'].map(w => 'unit Keeper of Secrets: ' + w + ' AP is changed by a rule the app cannot name: not imported');
      ok(!r.ok && JSON.stringify(r.errors) === JSON.stringify(want), 'made up: a Keeper of Secrets with its melee AP one better (an unread aura of its own) refused: ' + JSON.stringify(r.ok ? r.army.gwValues || 'imported' : r.errors));
      report.push('negative (made up): a Keeper of Secrets, melee AP one better than GW’s → ' + (r.ok ? 'IMPORTED' : r.errors.join('; ')));
    }
    // an aura that reaches its own unit, read (Daemon Lord of Tzeentch: "each time a model in that unit makes a ranged attack, add 1 to the
    // Strength characteristic of that attack", aura 6"): a Lord of Change's ranged S one more in the export: refused, as its box changes S
    if(L('tzeeeeentch')){
      const j = clone(L('tzeeeeentch')); (function f(x){ for(const p0 of x.profiles || []) if(p0.typeName === 'Ranged Weapons') for(const c of p0.characteristics || []) if(c.name === 'S' && /^\d+$/.test(c.$text)) c.$text = String(+c.$text + 1); for(const y of x.selections || []) f(y); })(top(j, 'Lord of Change'));
      const r = mk(j);
      ok(!r.ok && r.errors.length && r.errors.every(e => /^unit Lord of Change: .+ S is changed by a rule the app cannot name: not imported$/.test(e)), 'a Lord of Change with its ranged S one more (its own aura) refused: ' + JSON.stringify(r.ok ? r.army.gwValues || 'imported' : r.errors));
      report.push('negative: a Lord of Change, ranged S one more (Daemon Lord of Tzeentch reaches its own unit) → ' + (r.ok ? 'IMPORTED' : r.errors.join('; ')));
    }
    // an upgrade on the unit that changes the field (Gore-stained Veterans: "This unit’s melee attacks have +1 WS") and a value it does not
    // give: refused, never GW's value in its place
    if(L('super-terminators')){
      const j = clone(L('super-terminators')); prof(sub(top(j, 'Chaos Terminators'), /Chainfist/), 'WS', '1+');
      const r = mk(j), want = ['unit Chaos Terminators: Chainfist WS is 1+ in the export; GW’s 4+ with Gore-stained Veterans is 3+: not imported'];
      ok(!r.ok && JSON.stringify(r.errors) === JSON.stringify(want), 'Chaos Terminators with Gore-stained Veterans, a Chainfist at WS 1+, refused: ' + JSON.stringify(r.ok ? 'imported' : r.errors));
      report.push('negative: super terminators’ Chainfist at WS 1+ (Gore-stained Veterans gives 3+) → ' + (r.ok ? 'IMPORTED' : r.errors.join('; ')));
    }
  }
  // the friend's export (verify/sources/import-friend/murderband.json, New Recruit's, not a list of the owner's): built as the phone builds
  // it, every value GW's with the list's rules (Relentless Rage's +1 A on the melee weapons, Gore-stained Veterans' +1 WS on the Chaos
  // Terminators), and the one value New Recruit prints otherwise than GW and no rule of the list could give, Lord Invocatus's Bolt pistol
  // at BS 2+ (GW's 4+), in the note
  { const FD = path.join(ROOT, 'verify/sources/import-friend', 'murderband.json');
    if(fs.existsSync(FD)){
      const r = mk(JSON.parse(fs.readFileSync(FD, 'utf8'))), U = id => r.ok && r.army.units.find(u => u.id === id), W = (id, n) => { const u = U(id); return u && (u.ranged || []).concat(u.melee || []).find(w => w.name === n); };
      const inv = U('lord-invocatus'), cb = W('lord-invocatus', 'Coward’s Bane'), bh = W('lord-invocatus', 'Bladed horn'), cf = W('chaos-terminators', 'Chainfist'), jc = W('jakhals', 'Chainblades'), ec = W('slaughterbound-exalted-eightbound', 'Chainblades');
      ok(r.ok && r.army.built && r.army.pointsUsed === 2000 && JSON.stringify(r.army.gwValues) === JSON.stringify([{ unit:'Lord Invocatus', row:'Bolt pistol', field:'BS', export:'2+', gw:'4+' }])
        && W('lord-invocatus', 'Bolt pistol').BS === '4+' && JSON.stringify(W('lord-invocatus', 'Bolt pistol').gwx) === JSON.stringify({ BS:'2+' }) && cb.A === '8' && cb.from.A === 'Relentless Rage' && bh.A === '5' && bh.from.A === 'Relentless Rage' && cf.WS === '3+' && cf.from.WS === 'Gore-stained Veterans'
        && jc.A === '4' && jc.S === '3' && ec.A === '5' && ec.S === '8',
        'the friend’s Murderband: built at 2000 pts, GW’s values with its rules, Bolt pistol BS noted: ' + JSON.stringify(r.ok ? [r.army.pointsUsed, r.army.gwValues, inv && inv.ranged, cb, bh] : r.errors));
      report.push('accepted (the friend’s export): Murderband → ' + (r.ok ? r.army.units.length + ' units, ' + r.army.pointsUsed + ' pts, noted: ' + (r.army.gwValues || []).map(g => g.unit + ' ' + g.row + ' ' + g.field + ' ' + g.export + ' (GW ' + g.gw + ')').join('; ') : r.errors.join('; ')));
    }
  }
  // the earlier made-up Cult of Blood list whose Helbrute swaps its multi-melta for a twin lascannon: refused while the Helbrute's options
  // were not read, built now; the same list with a Helbrute hammer for its multi-melta (the missile launcher's choice): refused, named
  if(fs.existsSync(path.join(MD, 'cult-of-blood-helbrute.json'))){
    const r = mk(M('cult-of-blood-helbrute.json')), h = r.ok && r.army.units.find(u => u.id === 'helbrute');
    ok(r.ok && h && JSON.stringify(h.gear) === JSON.stringify([['Missile launcher', 'Twin lascannon', 'Close combat weapon']]), 'made up: Cult of Blood with a twin lascannon Helbrute builds: ' + JSON.stringify(r.ok ? h && h.gear : r.errors));
    report.push('accepted (made up): Cult of Blood, a Helbrute with its multi-melta swapped for a twin lascannon → ' + (r.ok ? r.army.units.length + ' units, ' + r.army.pointsUsed + ' pts' : r.errors.join('; ')));
    if(fs.existsSync(path.join(MD, 'helbrute-armoury.json'))){
      const j = M('cult-of-blood-helbrute.json'), h2 = j.roster.forces[0].selections.find(x => x.name === 'Helbrute'), lib = M('helbrute-armoury.json').roster.forces[0].selections.find(x => x.name === 'Helbrute').selections;
      h2.selections = h2.selections.map(c => c.name === 'Twin lascannon' ? Object.assign(clone(lib.find(x => x.name === 'Helbrute hammer')), { number:1 }) : c);
      const r2 = mk(j), want = ['unit Helbrute not imported: Helbrute with Missile launcher, Helbrute hammer and Close combat weapon is not what GW’s datasheet Helbrute allows (its UNIT COMPOSITION and WARGEAR OPTIONS: no mix of its WARGEAR OPTIONS gives all of it at once)'];
      ok(!r2.ok && JSON.stringify(r2.errors) === JSON.stringify(want), 'made up: Cult of Blood with a Helbrute hammer for the multi-melta refused: ' + JSON.stringify(r2.ok ? 'imported' : r2.errors));
      report.push('negative (made up): Cult of Blood, a Helbrute hammer for the Helbrute’s multi-melta → ' + (r2.ok ? 'IMPORTED' : r2.errors.join('; ')));
    }
  }
}

const outF = path.join(ROOT, 'verify/out/import.json');
fs.mkdirSync(path.dirname(outF), { recursive:true });
fs.writeFileSync(outF, JSON.stringify({ check:'import', checks, fails, report }, null, 1) + '\n');
console.log('import: ' + same + ' of ' + (same + differs) + ' exported lists import identically (' + differs + ' exports differ from the app’s list' + (differs ? ': ' + Object.keys(EXPORT_DIFFERS).join(', ') : '') + '), ' +
  none + ' without a list refused, ' + NEGATIVE.length + ' changed exports refused; ' + checks + ' checks, ' + fails.length + ' failures');
for(const r of report) console.log('  ' + r);
for(const f of fails) console.log('  FAIL ' + f);
process.exit(fails.length ? 1 : 0);
