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
   with its reason and evidence. Fails on any difference, an undeclared missing row, or a declaration nothing uses.
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
T.resolveArmies(R.A.value, S, R.order, { trace: (a, u, kind, n, sid, j) => { if (kind === 'stats') from.set(a.id + '/' + u.id + '/' + n, sid); } });

const fails = [], rows = [], used = new Set();
const fail = (where, msg) => fails.push(where + ': ' + msg);
const wahaBase = f => { try { const m = /\(&#8960;([^)]*)\)|\(⌀([^)]*)\)/.exec(fs.readFileSync(path.join(ROOT, f), 'utf8')); return m ? (m[1] || m[2]).replace(/\s*x\s*/gi, '×').trim() : null; } catch (e) { return null; } };
for (const a of D.armies) for (const u of a.units) (u.stats || []).forEach((row, n) => {
  const sid = from.get(a.id + '/' + u.id + '/' + n), ds = S[sid];
  const model = baseName(row.name), unit = ds ? ds.name : u.name, fac = ds ? ds.faction : a.faction;
  const where = a.id + ' · ' + u.name + (model !== unit ? ' · ' + model : '');
  const sections = (FJ[fac] || {}).baseGuide || (D.factions[fac] || {}).name || fac;
  const app = row.base;
  const rec = { army: a.id, unit: u.id, datasheet: sid || null, model, app };
  rows.push(rec);
  const dev = DEVS.find(x => x.datasheet === sid && x.row === model);
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
for (const d of DEVS) if (!used.has(d)) fail(DEVF, 'nothing in the lists matches the declaration for ' + d.datasheet + ' · ' + d.row);

fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'verify/out/bases.json'), JSON.stringify({ guide: guide.file, checked: rows.length, failures: fails, rows }, null, 1) + '\n');
if (fails.length) { console.log('FAIL bases: ' + fails.length + ' of ' + rows.length + ' model rows\n' + fails.map(x => ' - ' + x).join('\n')); process.exit(1); }
const nDecl = rows.filter(r => /^declared/.test(r.how)).length;
console.log('bases: ' + rows.length + ' model rows in ' + D.armies.length + ' lists have GW’s base as its guide prints it (' + guide.file.replace(/^.*\//, '') + '; ' + nDecl + ' by a declaration in ' + DEVF + ', ' + rows.filter(r => r.how === 'declared: not in the guide').length + ' of them Wahapedia’s where the guide has none, ' + rows.filter(r => r.how === 'declared: GW error').length + ' where the guide’s row is taken to be GW’s error)');
