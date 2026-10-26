#!/usr/bin/env node
/* verify/bases.js: every base size in the app is GW's, as GW's base size guide prints it.
   For every stats row (a model of a unit) of every list, the row's base is looked up in GW's base size guide (the Event
   Companion, verify/base-guide.js: lookup) under the faction's sections (verify/sources/factions.json `baseGuide`, else the
   datasheet's faction name) by its datasheet's name and the model's, and must equal it as the app writes it: GW's wording
   ("Oval", "Hull"), × for GW's x, the mm as GW prints it, without the word "Base" ("170×109mm Oval").
   A row the guide has under another name or section, or not at all, is declared in verify/deviations-bases.json:
     guide: { section, entry }   the guide's row for it (compared as any other; another row than the lookup's when the
                                 model is a variant: "Warboss (Armageddon)")
     + gwError: { printed }      that row is taken to be GW's error: the app has `app`, and the row must still print `printed`
     guide: null                 the guide has none: the app's base (app) is Wahapedia's datasheet's (waha: the cached page,
                                 compared), and the guide must still have no row for it
     absent: { section, entry }  GW's row for some models of the unit ("Gretchin: Runtherd") names a model the unit does not have
   with its reason and evidence. GW's rows for some models of a unit ("Tankbustas: Boss Nob", "Skitarii Rangers/Skitarii
   Vanguard: Transuranic Arquebus") must each be met in every unit of that datasheet: by a stats row, by a models line (a model
   of that name or with that wargear, on the base Bases & proxies counts for it: the stats row's baseWith for the wargear, else
   the stats row of its name), or by an `absent` declaration; every baseWith must be such a row of GW's, with its base.
   Fails on any difference, an undeclared missing row, a GW model row nothing meets, or a declaration nothing uses.
     node verify/bases.js         check (verify/out/bases.json: every row, its guide line or declaration) */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const T = require('./tables'), G = require('./base-guide');
const FJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/sources/factions.json'), 'utf8'));
const DEVF = 'verify/deviations-bases.json';
const DEVS = JSON.parse(fs.readFileSync(path.join(ROOT, DEVF), 'utf8'));
// the forms GW's guide prints, as the app writes them
const FORM = /^(\d+(\.\d+)?mm|\d+(\.\d+)?×\d+(\.\d+)?mm Oval|Hull|(Large|Small) Flying)$/;
const baseName = n => String(n).replace(/ ×\d+$/, '');

const guide = G.guide();
if (!guide.file) { console.log('FAIL bases: GW’s base size guide is not cached (verify/.cache/gw/*event_companion*.txt)'); process.exit(1); }

const src = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
const D = T.evaluate(src), R = T.read(src), S = R.S ? R.S.value : {};
// which datasheet (and row of it) each stats row of each unit comes from
const from = new Map();
T.resolveArmies(R.A.value, S, R.order, R.factions, { trace: (a, u, kind, n, sid, j) => { if (kind === 'stats') from.set(a.id + '/' + u.id + '/' + n, sid); } });

const fails = [], rows = [], used = new Set();
const fail = (where, msg) => fails.push(where + ': ' + msg);
const wahaBase = f => { try { const m = /\(&#8960;([^)]*)\)|\(⌀([^)]*)\)/.exec(fs.readFileSync(path.join(ROOT, f), 'utf8')); return m ? (m[1] || m[2]).replace(/\s*x\s*/gi, '×').trim() : null; } catch (e) { return null; } };
for (const a of D.armies) for (const u of a.units) (u.stats || []).forEach((row, n) => {
  const sid = from.get(a.id + '/' + u.id + '/' + n), ds = S[sid];
  const model = baseName(row.name), unit = ds ? ds.name : u.name, fac = ds ? ds.faction : a.faction;
  const where = a.id + ' · ' + u.name + (model !== unit ? ' · ' + model : '');
  const sections = (FJ[fac] || {}).baseGuide || (D.factions[fac] || {}).name || fac;
  const app = row.base;
  const rec = { army: a.id, unit: u.id, datasheet: sid || null, model, app, sections };
  rows.push(rec);
  const dev = DEVS.find(x => x.row && x.datasheet === sid && x.row === model);
  const L = G.lookup(sections, [unit, model], unit);
  if (dev) {
    used.add(dev);
    if (!dev.reason || !dev.evidence) fail(where, DEVF + ': its declaration has no reason or evidence');
    if (dev.guide) {
      const e = (guide.factions[dev.guide.section] || []).find(r => r.name === dev.guide.entry);
      if (!e) { fail(where, DEVF + ' names the guide’s row "' + dev.guide.entry + '" (' + dev.guide.section + '), which the guide does not have'); return; }
      // a declaration the lookup makes unneeded: it names the row the lookup finds, and takes that row's base
      if (L && L.entry === e.name && L.line === e.line && !dev.gwError) fail(where, DEVF + ' names the guide’s row "' + e.name + '", which the guide’s lookup finds by itself (line ' + L.line + '): drop the declaration');
      if (dev.gwError) {
        // the guide's row taken to be a GW error: it must still print what the declaration quotes (else GW changed it: look again),
        // and the app has the declared base, written as the guide writes its bases
        Object.assign(rec, { gw: e.base, line: e.line, entry: e.name, how: 'declared: GW error' });
        if (e.printed !== dev.gwError.printed) fail(where, DEVF + ' declares GW’s "' + dev.gwError.printed + '" an error, but line ' + e.line + ' now prints "' + e.printed + '": look again');
        if (app !== dev.app) fail(where, 'app ' + app + ', declared (' + DEVF + ') ' + dev.app);
        if (!FORM.test(String(app || ''))) fail(where, 'base "' + app + '" is not in a form GW’s guide prints (e.g. "40mm", "170×109mm Oval", "Hull")');
        return;
      }
      Object.assign(rec, { gw: e.base, line: e.line, entry: e.name, how: 'declared' });
      if (app !== e.base) fail(where, 'app ' + app + ', GW ' + e.base + ' (' + guide.file + ' line ' + e.line + ': "' + e.name + '  ' + e.printed + '", declared in ' + DEVF + ')');
    } else {
      if (L) fail(where, DEVF + ' says GW’s guide has no row, but it has "' + L.entry + '  ' + L.printed + '" (line ' + L.line + '): drop the declaration');
      const w = dev.waha ? wahaBase(dev.waha) : null;
      Object.assign(rec, { gw: null, waha: w, how: 'declared: not in the guide' });
      if (app !== dev.app) fail(where, 'app ' + app + ', declared (' + DEVF + ') ' + dev.app);
      // (no guide row to compare with: the app's base must still be written as the guide writes its bases)
      if (!FORM.test(String(app || ''))) fail(where, 'base "' + app + '" is not in a form GW’s guide prints (e.g. "40mm", "170×109mm Oval", "Hull")');
      if (!dev.waha || w !== dev.app) fail(where, DEVF + ': Wahapedia’s datasheet (' + (dev.waha || 'none named') + ') has ' + w + ', the declaration ' + dev.app);
    }
    return;
  }
  if (!L) { fail(where, 'GW’s base size guide has no row for it (sections ' + [].concat(sections).join(', ') + '; app ' + app + '): declare it in ' + DEVF + ' with its evidence'); return; }
  Object.assign(rec, { gw: L.base, line: L.line, entry: L.entry, how: L.how });
  if (app !== L.base) fail(where, 'app ' + app + ', GW ' + L.base + ' (' + L.file + ' line ' + L.line + ': "' + L.entry + '  ' + L.printed + '")');
});
// GW's rows for some models of a unit ("Tankbustas: Boss Nob", "Skitarii Rangers/Skitarii Vanguard: Transuranic Arquebus"):
// each must be met in every unit of that datasheet by a stats row (above), by a models line (a model of that name, or carrying
// that wargear: its base is the stats row's baseWith for the wargear, as Bases & proxies counts it), or by a declaration
// (absent: the unit has no such model, with its evidence)
const lines = [];
const { norm, words, loose } = G;
const wl = s => new Set(words(s).map(w => w.replace(/s$/, '')));
const sectionRows = sections => [].concat(sections).flatMap(f => { const k = Object.keys(guide.factions).find(x => norm(x) === norm(f)); return k ? guide.factions[k] : []; });
for (const A of R.A.value) { const a = D.armies.find(x => x.id === A.id); for (const U of A.units) {
  const u = a.units.find(x => x.id === U.id), ids = [].concat(U.ds || []);
  const mine = rows.filter(r => r.army === a.id && r.unit === u.id);
  // wargear → base, from the unit's stats rows (baseWith)
  const withs = [];
  for (const st of u.stats || []) for (const [g, b] of Object.entries(st.baseWith || {})) withs.push({ gear: g, base: b, row: baseName(st.name) });
  for (const sid of ids) {
    const ds = S[sid]; if (!ds) continue;
    const sections = (FJ[ds.faction] || {}).baseGuide || (D.factions[ds.faction] || {}).name || ds.faction;
    const own = sectionRows(sections).filter(r => r.models && r.models.units.some(x => loose(x) === loose(ds.name)));
    for (const g of own) {
      const where = a.id + ' · ' + u.name + ' · GW’s "' + g.name + '" (line ' + g.line + ')';
      if (mine.some(r => r.line === (g.first || g.line))) continue;   // a stats row of the unit has it
      // a models line with a model of that name, or with that wargear
      const hits = (u.models || []).map((m, i) => ({ m, i, name: (/^\d+× (.+?)(?: \([^)]*\))?$/.exec(m) || [, m])[1], gear: (u.gear || [])[i] || [], n: parseInt(m, 10) || 1 }))
        .filter(l => g.models.models.some(x => l.gear.some(y => loose(y) === loose(x)) || [...wl(x)].every(w => wl(l.name).has(w))));
      if (hits.length) {
        for (const l of hits) {
          const w = withs.find(x => l.gear.some(y => norm(y) === norm(x.gear)));
          // (the line's base as Bases & proxies counts it: its wargear's baseWith, else the stats row of its model's name)
          const st = (u.stats || []).find(x => loose(baseName(x.name)) === loose(l.name.replace(/ w\/.*$/, '')));
          const app = w ? w.base : st ? st.base : null;
          lines.push({ army: a.id, unit: u.id, datasheet: sid, line: l.m, app, gw: g.base, guideLine: g.line, entry: g.name });
          if (app !== g.base) fail(where, 'models line "' + l.m + '" is on ' + (app || 'no base of its own (no baseWith for its wargear, no stats row of its name)') + ', GW gives ' + g.base + ' ("' + g.name + '  ' + g.printed + '"): give the stats row baseWith { wargear: base }, or a stats row of its own');
        }
        continue;
      }
      const dev = DEVS.find(x => x.absent && x.datasheet === sid && x.absent.entry === g.name);
      if (dev) { used.add(dev); if (!dev.reason || !dev.evidence) fail(where, DEVF + ': its declaration has no reason or evidence'); continue; }
      fail(where, 'no stats row, models line or declaration of this unit matches GW’s row for some of its models ("' + g.name + '  ' + g.printed + '"): give the model its base, or declare it absent in ' + DEVF);
    }
  }
  // every baseWith is a wargear row of GW's guide for the unit, with its base
  for (const w of withs) {
    const ok = ids.map(id => S[id]).filter(Boolean).some(ds => sectionRows((FJ[ds.faction] || {}).baseGuide || (D.factions[ds.faction] || {}).name).some(r => r.models && r.models.units.some(x => loose(x) === loose(ds.name)) && r.models.models.some(x => loose(x) === loose(w.gear)) && r.base === w.base));
    if (!ok) fail(a.id + ' · ' + u.name + ' · ' + w.row, 'baseWith ' + w.gear + ': ' + w.base + ' is no row of GW’s guide for the unit with that base');
  }
} }
for (const d of DEVS) if (!used.has(d)) fail(DEVF, 'nothing in the lists matches the declaration for ' + d.datasheet + ' · ' + (d.row || 'absent: ' + (d.absent || {}).entry));

fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'verify/out/bases.json'), JSON.stringify({ guide: guide.file, checked: rows.length, failures: fails, rows, lines }, null, 1) + '\n');
if (fails.length) { console.log('FAIL bases: ' + fails.length + ' of ' + rows.length + ' model rows\n' + fails.map(x => ' - ' + x).join('\n')); process.exit(1); }
const nDecl = rows.filter(r => /^declared/.test(r.how)).length;
console.log('bases: ' + rows.length + ' model rows in ' + D.armies.length + ' lists have GW’s base as its guide prints it (' + guide.file.replace(/^.*\//, '') + '; ' + nDecl + ' by a declaration in ' + DEVF + ', ' + rows.filter(r => r.how === 'declared: not in the guide').length + ' of them Wahapedia’s where the guide has none, ' + rows.filter(r => r.how === 'declared: GW error').length + ' where the guide’s row is taken to be GW’s error); GW’s rows for some models of a unit: ' + lines.length + ' models lines on their base (wargear: baseWith), ' + [...used].filter(d => d.absent).length + ' declared absent');
