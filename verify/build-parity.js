#!/usr/bin/env node
/* verify/build-parity.js: the gate step "build-parity": an imported list is the list the app would have built in (builder.js, import.js).

   P1  every New Recruit export (verify/sources/nr-json): of a catalogued faction, WH_BUILDER.build(export) is its ARMIES entry in data.js
       byte for byte (the list's source line aside: an import's says when it was imported); of another faction, the strict copy
       (import.js) is its list as the app resolves it
   P2  each of them, imported on the phone (kept in localStorage, made again at start), shows every screen and every unit as the built-in
       list does, at 390 and 320px, but its kind pill, its source line and its "On this phone" footer (needs a built index.html)
   P3  the build is deterministic: twice, and from the export with every object's keys in another order, the same entry
   F   the test list in every format (scratchpad import-design formats, copied to verify/sources/import-formats): .json, .ros, .rosz,
       text B and text C give the same list (text B names no list: its name aside); text A is refused as not supported
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
  const ra = await I.read(fs.readFileSync(path.join(FD, 'text-a.txt'), 'utf8'), D);
  ok(!ra.ok && /^format not supported/.test(ra.errors[0]), 'F text-a: not refused as not supported: ' + JSON.stringify(ra.errors || ra.format));
  const ids = await Promise.all(['list.json', 'list.ros', 'list.rosz'].map(async f => { const buf = fs.readFileSync(path.join(FD, f)); return I.localId((await I.read(f.endsWith('.rosz') ? new Uint8Array(buf) : buf.toString('utf8'), D)).kept); }));
  ok(ids.every(x => x === ids[0]) && /^local-[0-9a-f]{12}$/.test(ids[0]), 'F: .json, .ros and .rosz of one list are not one local id: ' + ids.join(', '));
  report.push('F: .json, .ros, .rosz, text B, text C: ' + Object.keys(out).length + ' of 5 build the same list (text B names no list); text A refused; local id ' + ids[0]);

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
    ['leader attachment The Swarmlord + Pyrovores not imported: The Swarmlord can be attached to TYRANT GUARD']);
  neg('two Warlords', 'healybois', j => { const w = unit(j, 'The Swarmlord').selections.find(s => s.name === 'Warlord'); unit(j, 'Hive Tyrant').selections.push(clone(w)); },
    ['warlord not recognized: 2 units are the Warlord (The Swarmlord and Hive Tyrant)']);

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
  const kept = await Promise.all(lists.map(async id => { const k = I.slim(exp(id)); return { orig:id, id:await I.localId(k), json:k }; }));
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
      if(!out.length) shown.same++;
    }
    ok(!errs.length, 'P2 at ' + W + 'px: page errors: ' + errs.join(' | '));
    await page.close();
  }
  await browser.close(); site.close();
  report.push('P2: ' + shown.same + ' of ' + (kept.length * 2) + ' list renders (390 and 320px) are the built-in list’s, every screen and unit');
}
