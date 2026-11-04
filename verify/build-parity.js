#!/usr/bin/env node
/* verify/build-parity.js: the gate step "build-parity": an imported list is the list the app would have built in (builder.js, import.js).

   P1  every New Recruit export (verify/sources/nr-json): of a catalogued faction, WH_BUILDER.build(export) is its ARMIES entry in data.js
       byte for byte (the list's source line aside: an import's says when it was imported); of another faction, the strict copy
       (import.js) is its list as the app resolves it
   P2  each of them, imported on the phone (kept in localStorage, made again at start), shows every screen and every unit as the built-in
       list does, at 390 and 320px, but its kind pill, its source line and its "On this phone" footer (needs a built index.html)
   P3  the build is deterministic: twice, and from the export with every object's keys in another order, the same entry
   F   the test list in every format (scratchpad import-design formats, copied to verify/sources/import-formats): .json, .ros, .rosz,
       text B and text C give the same list (text B names no list: given its name in the import box, the same byte for byte); text A is refused as not supported
   N   changed exports are refused with exactly these messages (or, for points, built with GW's and the note)
   I   data.js BUILD_INDEX is what verify/build-index.js writes

     node verify/build-parity.js            all of it (P2 with Playwright: NODE_PATH=$(npm root -g))
     node verify/build-parity.js --no-render  without P2 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if(!c) fails.push(m); };
const src = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
const load = () => { const w = {}; new Function('window', src.replace(/\nreturn \{ version:VERSION,/, '\nreturn { RAW:{ ARMIES }, version:VERSION,'))(w); return w.WH_DATA; };
const D = load();
globalThis.WH_EFFECTS = require(path.join(ROOT, 'effects.js'));
const B = require(path.join(ROOT, 'builder.js'));
globalThis.WH_BUILDER = B;
const I = require(path.join(ROOT, 'import.js'));
const EXP = path.join(ROOT, 'verify/sources/nr-json');
const lists = fs.readdirSync(EXP).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')).sort();
const exp = id => JSON.parse(fs.readFileSync(path.join(EXP, id + '.json'), 'utf8'));
const report = [];

// ---- P1 and P3
const norm = a => JSON.stringify(Object.assign({}, a, { source:'*' }));
// (a list as the app has it: its own marks of an import, its source line and its reference sheets apart; the copy's keys in any order)
const stable = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(y => [y, x[y]])) : x);
const asApp = a => { const o = Object.assign({}, a); for(const k of ['source', 'imported', 'built', 'copied', 'refs']) delete o[k]; return stable(o); };
const shuffle = v => Array.isArray(v) ? v.map(shuffle) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).reverse().map(k => [k, shuffle(v[k])])) : v;
const p1 = { built:[], copied:[], differ:[] };
for(const id of lists){
  const want = D.RAW.ARMIES.find(a => a.id === id), j = exp(id);
  if(!want){ ok(false, 'P1 ' + id + ': no list of this id in data.js'); continue; }
  if(B.catalogued(D, want.faction)){
    const r = B.build(j, D, { id, date:'2 Nov 2026' });
    ok(r.ok, 'P1 ' + id + ': refused: ' + (r.errors || []).join('; '));
    if(!r.ok) continue;
    const same = norm(r.army) === norm(want);
    ok(same, 'P1 ' + id + ': the built entry is not data.js’s' + firstDiff(norm(want), norm(r.army)));
    (same ? p1.built : p1.differ).push(id);
    // P3: again, and from the export with its keys in another order
    ok(JSON.stringify(B.build(j, D, { id, date:'2 Nov 2026' }).army) === JSON.stringify(r.army), 'P3 ' + id + ': a second build differs');
    const s = B.build(shuffle(j), D, { id, date:'2 Nov 2026' });
    ok(s.ok && JSON.stringify(s.army) === JSON.stringify(r.army), 'P3 ' + id + ': built from the export with its keys reordered, it differs');
    // and through the phone's path: the kept export, built and resolved, is the app's list
    const m = I.make(I.slim(j), D, { id, date:'2 Nov 2026' });
    ok(m.ok && m.army.built && asApp(m.army) === asApp(D.armies.find(a => a.id === id)),
      'P1 ' + id + ': the kept export, made on the phone, is not the app’s list');
  } else {
    const m = I.make(I.slim(j), D, { id, date:'2 Nov 2026' });
    const same = m.ok && m.army.copied && asApp(m.army) === asApp(D.armies.find(a => a.id === id));
    ok(same, 'P1 ' + id + ' (copied, ' + want.faction + ' has no catalogue): ' + (m.ok ? 'not the app’s list' : m.errors.join('; ')));
    if(same) p1.copied.push(id); else p1.differ.push(id);
    ok(JSON.stringify(I.make(I.slim(j), D, { id, date:'x' })) === JSON.stringify(I.make(I.slim(shuffle(j)), D, { id, date:'x' })), 'P3 ' + id + ': the copy depends on the export’s key order');
  }
}
report.push('P1: ' + p1.built.length + ' built byte for byte (' + p1.built.join(', ') + '), ' + p1.copied.length + ' copied (no catalogue), ' + p1.differ.length + ' differ');
function firstDiff(a, b){ let i = 0; while(i < a.length && a[i] === b[i]) i++; return i >= a.length && i >= b.length ? '' : ' (at ' + JSON.stringify(a.slice(Math.max(0, i - 60), i + 60)) + ' / ' + JSON.stringify(b.slice(Math.max(0, i - 60), i + 60)) + ')'; }

(async () => {
  // ---- F: the formats
  const FD = path.join(ROOT, 'verify/sources/import-formats');
  const out = {};
  for(const f of ['list.json', 'list.ros', 'list.rosz', 'text-b.txt', 'text-c.txt']){
    const buf = fs.readFileSync(path.join(FD, f)), r = await I.read(f.endsWith('.rosz') ? new Uint8Array(buf) : buf.toString('utf8'), D);
    ok(r.ok, 'F ' + f + ': ' + (r.errors || []).join('; '));
    if(!r.ok) continue;
    const m = I.make(r.kept, D, { id:'f', date:'2 Nov 2026' });
    ok(m.ok, 'F ' + f + ': ' + (m.errors || []).join('; '));
    if(m.ok) out[f] = JSON.stringify(Object.assign({}, m.army, f === 'text-b.txt' ? { name:'*' } : {}));
  }
  const base = out['list.json'];
  for(const f of Object.keys(out)) ok(JSON.stringify(Object.assign(JSON.parse(out[f]), { name:'*' })) === JSON.stringify(Object.assign(JSON.parse(base), { name:'*' })) && (f === 'text-b.txt' || out[f] === base), 'F ' + f + ': not the list .json gives' + firstDiff(base, out[f]));
  ok(JSON.parse(base).units.length === 10, 'F: the test list is not its 10 units');
  // text B names no list: with the name given in the import box (WH_IMPORT.make's name) it is the .json's list byte for byte; without it,
  // "Imported list"; a name given over a format that has one is the name given
  { const kb = (await I.read(fs.readFileSync(path.join(FD, 'text-b.txt'), 'utf8'), D)).kept;
    const named = I.make(kb, D, { id:'f', date:'2 Nov 2026', name:"Me shooty yer' booty" });
    ok(named.ok && JSON.stringify(named.army) === base, 'F text-b with its name given: not the list .json gives' + (named.ok ? firstDiff(base, JSON.stringify(named.army)) : ': ' + named.errors.join('; ')));
    const bare = I.make(kb, D, { id:'f', date:'2 Nov 2026' });
    ok(bare.ok && bare.army.name === 'Imported list' && I.nameOf(kb, D) === '', 'F text-b without a name: ' + (bare.ok ? bare.army.name : bare.errors.join('; ')));
    const kj = (await I.read(fs.readFileSync(path.join(FD, 'list.json'), 'utf8'), D)).kept;
    ok(I.nameOf(kj, D) === 'Me shooty yer’ booty' && I.make(kj, D, { id:'f', date:'x', name:'Waaagh' }).army.name === 'Waaagh', 'F: the name a .json carries, or the one given, is not the list’s');
    const kc = (await I.read(fs.readFileSync(path.join(FD, 'text-c.txt'), 'utf8'), D)).kept;
    ok(I.nameOf(kc, D) === 'Me shooty yer’ booty', 'F text-c: its name is not prefilled: ' + I.nameOf(kc, D));
    // (and a catalogued list built under a given name: the entry with that name, the rest byte for byte)
    const hb = I.make(I.slim(exp('healybois')), D, { id:'healybois', date:'2 Nov 2026', name:'Heals' });
    ok(hb.ok && hb.entry.name === 'Heals' && norm(Object.assign({}, hb.entry, { name:'Healybois' })) === norm(D.RAW.ARMIES.find(a => a.id === 'healybois')), 'F: a built list under a given name differs beyond its name');
  }
  const ra = await I.read(fs.readFileSync(path.join(FD, 'text-a.txt'), 'utf8'), D);
  ok(!ra.ok && /^format not supported/.test(ra.errors[0]), 'F text-a: not refused as not supported: ' + JSON.stringify(ra.errors || ra.format));
  const ids = await Promise.all(['list.json', 'list.ros', 'list.rosz'].map(async f => { const buf = fs.readFileSync(path.join(FD, f)); return I.localId((await I.read(f.endsWith('.rosz') ? new Uint8Array(buf) : buf.toString('utf8'), D)).kept); }));
  ok(ids.every(x => x === ids[0]) && /^local-[0-9a-f]{12}$/.test(ids[0]), 'F: .json, .ros and .rosz of one list are not one local id: ' + ids.join(', '));
  report.push('F: .json, .ros, .rosz, text B, text C: ' + Object.keys(out).length + ' of 5 build the same list (text B with its name given in the import box byte for byte, without it "Imported list"); text A refused; local id ' + ids[0]);

  // ---- N: changed exports, each refused with exactly these messages
  const clone = o => JSON.parse(JSON.stringify(o));
  const sels = j => j.roster.forces[0].selections;
  const unit = (j, n, k) => sels(j).filter(s => s.name === n)[k || 0];
  const neg = (name, from, change, want, also) => {
    const j = clone(exp(from)); const j2 = change(j) || j;
    const r = typeof j2 === 'string' ? (() => { try { return B.build(JSON.parse(j2), D, { id:'n', date:'x' }); } catch(e){ return B.build(j2, D, { id:'n', date:'x' }); } })() : B.build(j2, D, { id:'n', date:'x' });
    if(also) return ok(also(r), 'N "' + name + '": ' + JSON.stringify(r.ok ? r.army.gwPoints || 'built' : r.errors));
    ok(!r.ok && JSON.stringify(r.errors) === JSON.stringify(want), 'N "' + name + '": want ' + JSON.stringify(want) + ', got ' + JSON.stringify(r.ok ? 'built' : r.errors));
    report.push('N ' + name + ' → ' + (r.ok ? 'BUILT' : r.errors.join('; ')));
  };
  neg('unknown unit', 'nidzillas', j => { unit(j, 'Tyrannofex').entryId = unit(j, 'Tyrannofex').entryId.replace(/[^:]+$/, '0000-0000-0000-0000'); }, ['unit Tyrannofex not recognized (no datasheet of the Tyranids catalogue has its BSData id)']);
  neg('faction not catalogued', 'nidzillas', j => { const F = j.roster.forces[0], o = clone(exp('shooty')).roster.forces[0]; F.catalogueId = o.catalogueId; F.catalogueName = o.catalogueName; },
    null, r => !r.ok && r.errors.some(e => /^faction Orks not catalogued/.test(e)));
  neg('faction not catalogued (an Orks export)', 'shooty', j => j, ['faction Orks not catalogued: imports are built from a full faction catalogue, and Orks has none yet (catalogued: Adeptus Custodes, Chaos Daemons and Tyranids)']);
  neg('unknown option', 'healybois', j => { unit(j, 'Pyrovores').selections[0].selections.push({ id:'x1', name:'Bio-plasma', entryId:'aaaa-bbbb-cccc-dddd', number:1, type:'upgrade' }); },
    ['option Bio-plasma on unit Pyrovores not recognized (not an option of GW’s datasheet Pyrovores)']);
  neg('unknown weapon', 'healybois', j => { const w = unit(j, 'Pyrovores').selections[0].selections.find(s => (s.profiles || []).length); w.profiles[0].name = w.profiles[0].name + ' Mk II'; },
    ['weapon Chitin-barbed limbs Mk II on unit Pyrovores not recognized (no melee weapon of the datasheet Pyrovores has this name)']);
  neg('unknown enhancement', 'nidzillas', j => { unit(j, 'Norn Emissary').selections.unshift({ id:'x2', name:'Mythic Hero', entryId:'e9f3-6605-87c9-89c6', number:1, type:'upgrade', group:'Enhancements' }); },
    ['enhancement Mythic Hero on unit Norn Emissary not recognized (not an enhancement of the list’s detachments)']);
  neg('points other than GW’s: built with GW’s, both named', 'nidzillas', j => { unit(j, 'Tyrannofex').costs[0].value -= 5; j.roster.costs[0].value -= 5; }, null,
    r => r.ok && JSON.stringify(r.army.gwPoints) === JSON.stringify([{ unit:'Tyrannofex', export:175, gw:180 }]) && r.army.pointsUsed === 2000);
  neg('Legends', 'nidzillas', j => { unit(j, 'Tyrannofex').name = 'Tyrannofex [Legends]'; }, ['unit Tyrannofex [Legends] not imported: Legends, not matched play']);
  neg('Crucible', 'lite-knights', j => { (unit(j, 'Witchseeker Squad').categories = unit(j, 'Witchseeker Squad').categories || []).push({ name:'Crucible', entryId:'x' }); }, ['unit Witchseeker Squad not imported: Crucible, not matched play']);
  neg('malformed', 'nidzillas', j => { sels(j)[5].number = 'one'; }, ['not a New Recruit export (a selection is malformed)']);
  neg('not JSON', 'nidzillas', () => '{ nope', ['not a New Recruit export (the text is not JSON)']);
  neg('two forces', 'nidzillas', j => { j.roster.forces.push(clone(j.roster.forces[0])); }, ['a list with 2 forces not recognized (the app takes one Army Roster)']);
  neg('over the limit', 'basic-bitch', j => { const t = unit(j, 'Tyrannofex'); sels(j).push(Object.assign(clone(t), { id:'x3' })); },
    ['points total 2180 not recognized: over the Strike Force limit of 2000 pts']);
  neg('illegal attachment', 'healybois', j => { const g = unit(j, 'The Swarmlord'); g.associations[0].to = unit(j, 'Pyrovores').id; },
    ['leader attachment The Swarmlord + Pyrovores not imported: The Swarmlord can be attached to TYRANT GUARD (Core Rules 19.01)']);
  neg('two Warlords', 'healybois', j => { const w = unit(j, 'The Swarmlord').selections.find(s => s.name === 'Warlord'); unit(j, 'Hive Tyrant').selections.push(clone(w)); },
    ['warlord not recognized: 2 units are the Warlord (The Swarmlord and Hive Tyrant) (Core Rules 25.04, Select Units: select one CHARACTER unit to be your Warlord’s unit)']);

  // (each of GW's restrictions the build holds an export to, refused with the rule it breaks)
  {
    const wsel = (k, nm, kind, n) => { const r = D.datasheets['tyranids/' + k][kind].find(x => x.name === nm);
      return { id:'w' + nm, name:nm, entryId:'x::aaaa', number:n || 1, type:'upgrade', group:'Wargear::Fleshborer Hive', profiles:[{ name:nm, typeName:kind === 'ranged' ? 'Ranged Weapons' : 'Melee Weapons',
        characteristics:[['Range', r.range], ['A', r.A], [kind === 'ranged' ? 'BS' : 'WS', kind === 'ranged' ? r.BS : r.WS], ['S', r.S], ['AP', r.AP], ['D', r.D], ['Keywords', (r.kw || []).join(', ')]].map(([n2, v]) => ({ name:n2, $text:v })) }] }; };
    const prof = (s, f) => s.profiles[0].characteristics.find(c => c.name === f);
    const takeEnh = (j, from) => { const h = unit(j, from), e = h.selections.find(s => s.group && /^Enhancements/.test(s.group)); h.selections = h.selections.filter(s => s !== e); return e; };
    const resetS = j => { const ht = unit(j, 'Hive Tyrant'); for(const w of ht.selections.filter(s => /Monstrous/.test(s.name))){ const r = D.datasheets['tyranids/hive-tyrant'].melee.find(x => lc(x.name) === lc(w.name)); prof(w, 'S').$text = r.S; }
      for(const tg of sels(j).filter(s => s.name === 'Tyrant Guard')) for(const w of tg.selections[0].selections) prof(w, 'S').$text = '5'; };
    const lc = x => String(x).toLowerCase();
    neg('wargear: two of a one-of group', 'healybois', j => { unit(j, 'Tyrannofex').selections.push(wsel('tyrannofex', 'Rupture cannon', 'ranged')); },
      ['unit Tyrannofex not imported: Tyrannofex has 2 of Rupture cannon, Fleshborer hive and Acid spray each (GW’s datasheet Tyrannofex, Fleshborer Hive: 1)']);
    neg('wargear: a required choice missing', 'healybois', j => { const t = unit(j, 'Tyrannofex'); t.selections = t.selections.filter(s => s.name !== 'Acid spray'); },
      ['unit Tyrannofex not imported: Tyrannofex has 0 of Rupture cannon, Fleshborer hive and Acid spray each (GW’s datasheet Tyrannofex, Fleshborer Hive: 1)']);
    neg('wargear: a choice over its limit', 'healybois', j => { unit(j, 'Tyrannofex').selections.find(s => s.name === 'Stinger salvoes').number = 2; },
      ['unit Tyrannofex not imported: Tyrannofex has 2 Stinger salvoes each (GW’s datasheet Tyrannofex: 1)']);
    neg('wargear: models of one line equipped otherwise', 'healybois', j => { unit(j, 'Pyrovores').selections[0].selections.find(s => s.name === 'Flamespurt').number = 1; },
      ['option 1× Flamespurt on 3× Pyrovore not imported: 3 models, each equipped alike (GW’s datasheet Pyrovores)', 'unit Pyrovores not imported: 3× Pyrovore has 0 Flamespurt each (GW’s datasheet Pyrovores: 1)']);
    neg('models: over the datasheet’s', 'healybois', j => { const m = unit(j, 'Pyrovores').selections[0]; m.number = 4; m.selections.forEach(s => { s.number = 4; }); },
      ['unit Pyrovores not imported: 4 Pyrovore models (GW’s datasheet Pyrovores: 1–3)']);
    neg('models: a name the datasheet has not', 'healybois', j => { unit(j, 'Pyrovores').selections[0].name = 'Pyrovore <b>'; },
      ['model Pyrovore <b> on unit Pyrovores not recognized (GW’s datasheet Pyrovores has Pyrovore)', 'unit Pyrovores not imported: 0 Pyrovore models (GW’s datasheet Pyrovores: 1–3)']);
    neg('a rule’s value: more than it gives', 'healybois', j => { prof(unit(j, 'Hive Tyrant').selections.find(s => /bonesword/.test(s.name)), 'S').$text = '20'; },
      ['unit Hive Tyrant + Tyrant Guard: Monstrous bonesword and lash whip S is 20 in the export; GW’s 9 with Parasitic Biomorphology is 10: not imported']);
    neg('a rule’s value: less than it gives', 'healybois', j => { prof(unit(j, 'Hive Tyrant').selections.find(s => /bonesword/.test(s.name)), 'S').$text = '3'; },
      ['unit Hive Tyrant + Tyrant Guard: Monstrous bonesword and lash whip S is 3 in the export; GW’s 9 with Parasitic Biomorphology is 10: not imported']);
    neg('a rule’s invulnerable save: better than it gives', 'healybois', j => { unit(j, 'Norn Assimilator').profiles.find(p => p.typeName === 'Unit').characteristics.find(c => c.name === 'InSv').$text = '2+'; },
      ['unit Norn Assimilator: Norn Assimilator InSv is 2+ in the export; GW’s – with Synaptoprescience is 4+: not imported']);
    neg('a value no rule of the list changes', 'healybois', j => { unit(j, 'Tyrannofex').profiles.find(p => p.typeName === 'Unit').characteristics.find(c => c.name === 'T').$text = '14'; },
      ['unit Tyrannofex: Tyrannofex T is changed by a rule the app cannot name: not imported']);
    neg('enhancement on a non-CHARACTER', 'healybois', j => { const e = takeEnh(j, 'Hive Tyrant'); resetS(j); unit(j, 'Pyrovores').selections.unshift(e); },
      ['enhancement Parasitic Biomorphology on Pyrovores not imported: only CHARACTER units can be given enhancements (Core Rules 25.04, Select Enhancements)']);
    neg('enhancement on an EPIC HERO', 'healybois', j => { const e = takeEnh(j, 'Hive Tyrant'); resetS(j); unit(j, 'The Swarmlord').selections.unshift(e); },
      ['enhancement Parasitic Biomorphology on The Swarmlord not imported: EPIC HERO models cannot be given enhancements (Core Rules 25.04, Select Enhancements)']);
    neg('enhancement its words do not allow', 'healybois', j => { const a = unit(j, 'Norn Assimilator'), e = takeEnh(j, 'Norn Assimilator');
      a.profiles.find(p => p.typeName === 'Unit').characteristics.find(c => c.name === 'InSv').$text = '-'; unit(j, 'Norn Emissary').selections.unshift(e);
      unit(j, 'Norn Emissary').profiles.find(p => p.typeName === 'Unit').characteristics.find(c => c.name === 'InSv').$text = '4+'; },
      ['enhancement Synaptoprescience on Norn Emissary not imported: GW’s enhancement says “NORN ASSIMILATOR unit only.”']);
    neg('the same enhancement twice', 'basic-bitch', j => { for(const p of sels(j).filter(s => s.name === 'Tyranid Prime with Lash Whip')) p.selections.unshift({ id:'e' + p.id, name:'Adaptive Biology', entryId:'x::e', number:1, type:'upgrade', group:'Enhancements' }); },
      null, r => !r.ok && r.errors.includes('enhancement Adaptive Biology ×2 not imported: your army cannot include more than one of the same enhancement (Core Rules 25.04, Select Enhancements)'));
    neg('two enhancements on one unit', 'healybois', j => { unit(j, 'Hive Tyrant').selections.unshift({ id:'e2', name:'Instinctive Defence', entryId:'x::e', number:1, type:'upgrade', group:'Enhancements' }); },
      null, r => !r.ok && r.errors.includes('unit Hive Tyrant + Tyrant Guard not imported: Instinctive Defence and Parasitic Biomorphology: no unit (including attached units) can have more than one enhancement (Core Rules 25.04)'));
    neg('enhancement excluded by its words', 'healybois', j => { const e = takeEnh(j, 'Hive Tyrant'); resetS(j); unit(j, 'Hive Tyrant').selections.unshift({ id:'e3', name:'Regenerating Monstrosity', entryId:'x::e', number:1, type:'upgrade', group:'Enhancements' }); },
      null, r => !r.ok && r.errors.includes('enhancement Regenerating Monstrosity on Hive Tyrant not imported: GW’s enhancement says “TYRANIDS model only (excluding MONSTERS models).”'));
    // (nidzillas: Monstrous Nemesis, Synaptoprescience twice and Destabilising Predation count 3, each Upgrade once; two Neurotyrants with an
    // enhancement each make 5, over Strike Force's 4)
    neg('over the enhancement limit (an Upgrade counts once)', 'nidzillas', j => {
      const S = D.datasheets['tyranids/neurotyrant'], ch = o => Object.entries(o).map(([n2, v]) => ({ name:n2, $text:v }));
      const wp = (r, kind) => ({ name:r.name, typeName:kind === 'ranged' ? 'Ranged Weapons' : 'Melee Weapons', characteristics:ch({ Range:r.range, A:r.A, [kind === 'ranged' ? 'BS' : 'WS']:kind === 'ranged' ? r.BS : r.WS, S:r.S, AP:r.AP, D:r.D, Keywords:(r.kw || []).join(', ') }) });
      const nt = (k, e) => ({ id:'nt' + k, name:S.name, entryId:'x::' + S.bsId, number:1, type:'model', costs:[{ name:'pts', value:S.points.costs[0].models[0].pts }],
        profiles:[{ name:S.stats[0].name, typeName:'Unit', characteristics:ch({ M:S.stats[0].M, T:S.stats[0].T, Sv:S.stats[0].Sv, W:S.stats[0].W, LD:S.stats[0].Ld, OC:S.stats[0].OC, InSv:S.stats[0].InSv }) }],
        selections:[{ id:'e' + k, name:e, entryId:'x::e', number:1, type:'upgrade', group:'Enhancements::Crusher Stampede Enhancements' }]
          .concat((S.ranged || []).map(r => [r, 'ranged']).concat((S.melee || []).map(r => [r, 'melee'])).map(([r, kind], i) => ({ id:'w' + k + i, name:r.name, entryId:'x::w', number:1, type:'upgrade', group:'Wargear', profiles:[wp(r, kind)] }))) });
      const s = sels(j); s.splice(s.findIndex(x => x.name === 'Tyrannofex'), 1); s.push(nt(1, 'Null Nodules'), nt(2, 'Enraged Reserves')); },
      null, r => !r.ok && r.errors.includes('5 enhancements not imported: Strike Force’s enhancement limit is 4 (Core Rules 25.03; 25.04: the second and third instances of the same Upgrade do not count towards it)'));
    neg('Warlord not a CHARACTER', 'healybois', j => { const s0 = unit(j, 'The Swarmlord'), w = s0.selections.find(s => s.name === 'Warlord'); s0.selections = s0.selections.filter(s => s !== w); unit(j, 'Pyrovores').selections.unshift(w); },
      ['warlord Pyrovores not imported: the Warlord must be a CHARACTER model (Core Rules 25.04, Select Units)']);
    neg('an EPIC HERO twice', 'healybois', j => { const s = sels(j), sw = clone(unit(j, 'The Swarmlord')); sw.id = 'sw2'; sw.selections = sw.selections.filter(x => x.name !== 'Warlord'); sw.associations = []; s.splice(s.findIndex(x => x.name === 'Norn Emissary'), 1); s.push(sw); j.roster.costs[0].value += 210 - 250; },
      ['2× The Swarmlord not imported: every EPIC HERO has a unit limit of 1 (Core Rules 25.03)']);
    neg('a datasheet over the unit limit', 'healybois', j => { const s = sels(j), p = unit(j, 'Pyrovores'); s.splice(s.findIndex(x => x.name === 'Norn Emissary'), 1); for(let k = 0; k < 2; k++){ const c = clone(p); c.id = 'pp' + k; s.push(c); } j.roster.costs[0].value += 200 - 250; },
      ['4× Pyrovores not imported: Strike Force’s unit limit for Pyrovores is 3 (Core Rules 25.03)']);
    neg('Detachment Points over the battle size’s', 'healybois', j => { const nd = clone(exp('nidzillas')).roster.forces[0].selections.find(s => s.name === 'Detachment').selections.find(s => /Crusher/.test(s.name)); sels(j).find(s => s.name === 'Detachment').selections.push(nd); },
      ['detachments Assimilation Swarm, Talons of the Norn Queen and Crusher Stampede (5 DP) not imported: Strike Force has 3 DP (Core Rules 25.03, 25.04)']);
    neg('two leaders on one bodyguard', 'healybois', j => { unit(j, 'Hive Tyrant').associations[0].to = unit(j, 'The Swarmlord').associations[0].to; },
      null, r => !r.ok && r.errors.includes('leader attachment The Swarmlord + Hive Tyrant + Tyrant Guard not imported: each bodyguard unit can only have one leader unit attached to it (Core Rules 19.01)'));
    neg('a leader attached as support', 'healybois', j => { unit(j, 'The Swarmlord').associations[0].name = 'Supporting'; },
      ['leader attachment The Swarmlord + Tyrant Guard not imported: GW’s datasheet of The Swarmlord has no Support ability, so it cannot support a unit (Core Rules 19.01)']);
    // an ability a detachment gives is the list's, never its datasheet's: a Norn Emissary in a list without Talons of the Norn Queen has no
    // Protean Purpose (even with the export still showing it), with the detachment it has it, and no DATASHEETS row has a rule's ability
    const noTalons = j => { const F = j.roster.forces[0], det = sels(j).find(s => s.name === 'Detachment');
      det.selections = det.selections.filter(s => !/Talons/.test(s.name));
      const enh = s => (s.selections || []).some(c => /^Enhancements/.test(c.group || '') || enh(c));
      F.selections = F.selections.filter(s => !(s.type !== 'upgrade' && /Norn/.test(s.name) && enh(s)));
      sels(j).find(s => s.name === 'Force Disposition').selections[0] = { id:'x4', name:'Priority Assets', entryId:'081d-bc07-5d4e-ab22', number:1, type:'upgrade' }; };
    const pp = r => r.ok ? D.resolve(r.army).units.filter(u => /^Norn /.test(u.name)).map(u => u.name + ':' + u.abilities.some(a => a.name === 'Protean Purpose')) : r.errors;
    neg('a Norn without Talons of the Norn Queen: no Protean Purpose', 'healybois', noTalons, null, r => JSON.stringify(pp(r)) === JSON.stringify(['Norn Emissary:false']));
    report.push('N a Norn without Talons of the Norn Queen → ' + JSON.stringify(pp(B.build(((j => (noTalons(j), j))(clone(exp('healybois')))), D, { id:'n', date:'x' }))));
    ok(JSON.stringify(pp(B.build(exp('healybois'), D, { id:'n', date:'x' })).slice().sort()) === JSON.stringify(['Norn Assimilator:true', 'Norn Emissary:true']), 'N with Talons of the Norn Queen: its Norns have no Protean Purpose');
    const onRow = Object.entries(D.datasheets).filter(([, S]) => (S.abilities || []).some(a => (D.grants || []).some(g => g.type === 'ability' && g.grants === a.name && / rule · /.test(g.rule) && !g.option && (D.ruleOptions || []).some(o => o.rule === g.rule && o.option === g.grants)))).map(([k]) => k);
    ok(!onRow.length, 'N: a DATASHEETS row has an ability an army or detachment rule gives (the list’s, not the datasheet’s): ' + onRow.join(', '));
    // (the owner's rule: the row comes from the rule and the unit's keywords, never from what the export prints) an export without the
    // ability's profile still gets the row; a unit without the keyword gets none, even with the profile in its export; the row is marked
    // with the rule (its tag)
    const walkP = (s, f) => { f(s); for(const c of s.selections || []) walkP(c, f); for(const c of s.forces || []) walkP(c, f); };
    const PP = 'Higher Imperatives · Once per battle, per unit';
    const ppTag = r => r.ok ? D.resolve(r.army).units.filter(u => u.abilities.some(a => a.name === 'Protean Purpose')).map(u => u.name + ':' + u.abilities.find(a => a.name === 'Protean Purpose').tag).sort() : r.errors;
    neg('an export without the Protean Purpose profile: both Norns still have it', 'healybois', j => { walkP(j.roster, x => { if(x.profiles) x.profiles = x.profiles.filter(p => p.name !== 'Protean Purpose'); }); },
      null, r => JSON.stringify(ppTag(r)) === JSON.stringify(['Norn Assimilator:' + PP, 'Norn Emissary:' + PP]));
    neg('the Protean Purpose profile on a unit without the keyword (The Swarmlord): no row', 'healybois', j => { let pr; walkP(j.roster, x => { for(const p of x.profiles || []) if(p.name === 'Protean Purpose' && !pr) pr = p; });
        const sl = unit(j, 'The Swarmlord'); sl.profiles = (sl.profiles || []).concat([pr]); },
      null, r => JSON.stringify(ppTag(r)) === JSON.stringify(['Norn Assimilator:' + PP, 'Norn Emissary:' + PP]));
    // Daughters of the Abyss: Psychic Null (Aura) on Lite Knights' ANATHEMA PSYKANA units only, whatever the export prints
    const pn = r => r.ok ? D.resolve(r.army).units.filter(u => u.abilities.some(a => a.name === 'Psychic Null (Aura)' && a.tag === 'Daughters of the Abyss · Aura')).map(u => u.name).sort() : r.errors;
    const PN = ['Prosecutor Squad', 'Witchseeker Squad', 'Witchseeker Squad'];
    neg('Lite Knights: Psychic Null (Aura) on its ANATHEMA PSYKANA units only', 'lite-knights', j => j, null, r => JSON.stringify(pn(r)) === JSON.stringify(PN));
    neg('Lite Knights with no Psychic Null profile in the export: the same rows', 'lite-knights', j => { walkP(j.roster, x => { if(x.profiles) x.profiles = x.profiles.filter(p => !/Psychic Null/.test(p.name)); }); }, null, r => JSON.stringify(pn(r)) === JSON.stringify(PN));
    // (and its words never guessed: a rule whose words for the ability cannot be found refuses the list, naming it)
    { const D2 = Object.assign({}, D, { ruleOptions:(D.ruleOptions || []).filter(o => o.option !== 'Psychic Null (Aura)') }), r = B.build(exp('lite-knights'), D2, { id:'n', date:'x' });
      ok(!r.ok && r.errors.some(e => /Psychic Null \(Aura\) that Daughters of the Abyss gives .*never guessed/.test(e)), 'N an ability whose words cannot be found is refused: ' + JSON.stringify(r.ok ? 'built' : r.errors));
      report.push('N an ability whose words cannot be found → ' + (r.ok ? 'BUILT' : r.errors[0])); }
  }

  // ---- I: the index
  const ix = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'build-index.js')], { encoding:'utf8' });
  ok(ix.status === 0, 'I: ' + (ix.stdout + ix.stderr).trim());

  // ---- P2: on the phone
  if(!process.argv.includes('--no-render')) await p2();
  console.log((fails.length ? 'FAIL build-parity: ' + fails.length + ' of ' + checks + ' checks\n' + fails.map(f => ' - ' + f).join('\n') : 'build-parity: ' + report[0] + '; ' + checks + ' checks, 0 failures') + '\n' + report.map(r => '  ' + r).join('\n'));
  fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive:true });
  fs.writeFileSync(path.join(ROOT, 'verify/out/build-parity.json'), JSON.stringify({ checks, fails, report }, null, 1) + '\n');
  process.exit(fails.length ? 1 : 0);
})();

async function p2(){
  const { serve } = require('./lib');
  const { chromium } = require('playwright');
  const kept = await Promise.all(lists.map(async id => { const k = I.slim(exp(id)); return { orig:id, id:await I.localId(k), json:k, built:B.catalogued(D, D.RAW.ARMIES.find(a => a.id === id).faction) }; }));
  // (the page is this app.html, data.js and scripts built: index.html's build stamp is build.js's for them now; a stale page fails)
  const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const stamp = crypto.createHash('sha256').update(rd('app.html')).update(rd('data.js')).update(['calc.js', 'effects.js', 'ask.js', 'builder.js', 'import.js'].map(rd).join('')).digest('hex').slice(0, 10);
  const have = (/window\.WH_BUILD = '([0-9a-f]+)'/.exec(fs.existsSync(path.join(ROOT, 'index.html')) ? rd('index.html') : '') || [])[1];
  ok(have === stamp, 'P2: index.html is not the build of this app.html, data.js and scripts (its stamp ' + have + ', build.js now gives ' + stamp + '): VERIFY_BUILDING=1 node build.js');
  if(have !== stamp) return;
  const site = await serve(ROOT);
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const shown = { same:0 };
  for(const W of [390, 320]){
    const page = await (await browser.newContext({ viewport:{ width:W, height:844 }, serviceWorkers:'block' })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    await page.route(/\/verified\.js(\?|$)/, r => r.fulfill({ contentType:'application/javascript', body:'window.WH_VERIFIED = null;' }));
    await page.goto(site.url + 'index.html');
    await page.evaluate(k => { localStorage.clear(); localStorage.setItem('wh-imported', JSON.stringify(k.map(x => ({ id:x.id, name:x.orig, date:'2 Nov 2026', json:x.json })))); }, kept);
    await page.reload(); await page.evaluate(() => document.fonts.ready);
    for(const k of kept){
      const res = await page.evaluate(([id, orig]) => {
        const out = [], A = armyById(id); if(!A) return ['not made at start: ' + JSON.stringify((importStale.find(x => x.id === id) || {}).errors)];
        const txt = (s, a, x) => { hideSheet(); go(Object.assign({ s, army:a }, x || {})); document.querySelectorAll('#view details').forEach(d => d.open = true); return $('#view').innerText; };
        const drop = (t, imp) => imp ? t.replace(/New Recruit, imported [^\n]*/, '').replace(/\nON THIS PHONE[\s\S]*$/i, '') : t.replace(/New Recruit, exported [^\n]*/, '');
        let n = 0;
        for(const s of ['army', 'pregame', 'checklist', 'units', 'strats', 'ranged', 'melee', 'abilities', 'rules', 'bases', 'damage']){ n++; if(drop(txt(s, orig), false).trim() !== drop(txt(s, id), true).trim()) out.push(s + ' differs'); }
        for(const u of armyById(orig).units.concat(armyById(orig).refs || [])){ n++; if(txt('unit', orig, { unit:u.id }) !== txt('unit', id, { unit:u.id })) out.push('unit ' + u.id + ' differs'); }
        return { out, n, built:!!A.built, copied:!!A.copied };
      }, [k.id, k.orig]);
      const out = Array.isArray(res) ? res : res.out;
      ok(!out.length, 'P2 ' + k.orig + ' at ' + W + 'px: ' + out.join(', '));
      // (a catalogued faction's list was built from the tables, every other one copied: never the copy for a list the builder must build)
      if(!Array.isArray(res)) ok(res.built === k.built && res.copied === !k.built, 'P2 ' + k.orig + ' at ' + W + 'px: ' + (k.built ? 'not built from the tables (built ' + res.built + ', copied ' + res.copied + ')' : 'not copied'));
      if(!out.length) shown.same++;
    }
    ok(!errs.length, 'P2 at ' + W + 'px: page errors: ' + errs.join(' | '));
    await page.close();
  }
  await browser.close(); site.close();
  report.push('P2: ' + shown.same + ' of ' + (kept.length * 2) + ' list renders (390 and 320px) are the built-in list’s, every screen and unit');
}
