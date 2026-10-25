#!/usr/bin/env node
/* verify/base-guide.js: GW's base size guide (the Event Companion, verify/.cache/gw/*event_companion*.txt, `pdftotext -layout`),
   read as { faction (as GW prints it, upper case): [{ name, base, line }] }, and the base size of a unit by its names.

     const G = require('./base-guide');
     G.guide()                               every faction's rows, and the file they come from
     G.lookup('Adeptus Custodes', ['Caladius Annihilator Grav-tank'])
        -> { base:'170×109mm Oval', printed:'170x109mm Oval Base', entry:'Caladius Grav-tank', line:2625, file, how } | null

   A unit is found by the first of its names (datasheet name, then model names) that matches an entry, in this order:
     model          a row for some models of the unit ("Neurogaunts: Nodebeasts"): the unit's name as for plural/squad, and
                    a model name the same, the same as for plural/squad, or all of its words in the row's name
                    ("Jakhals: Dishonoured" for "Dishonoured w/ paired manglers", "Nodebeasts" for "Neurogaunt Nodebeast")
                    a model name of which the model's name is part ("Nob" of "Tankbustas: Boss Nob"), when only one
                    row has it and it names no variant ("(Armageddon)"); a model's name sharing a word with a model row of
                    its unit and matching none gives no answer (null: declare it), never the unit's own row
     exact          the same name (quotes, dashes and case alike), a model's own name first ("Sir Hekhtur" before
                    "Canis Rex", the datasheet he is on)
     model of       a model's own name, in the one row of another unit that names it ("Dark Apostle: Dark Disciple" for the
                    Dark Disciples of an attached unit, "Gretchin: Runtherd" for the Runtherd)
     plural/squad   the same once a trailing "s" and the word "Squad" are dropped ("Prosecutor Squad" = "Prosecutors")
     words          every word of the entry is a word of the name, and no other entry of the faction does that with
                    more words ("Caladius Grav-tank" in "Caladius Annihilator Grav-tank")
   The app writes the base as GW prints it, with × for x and without the word "Base" ("170×109mm Oval").
   node verify/base-guide.js "<faction>" "<unit name>" [...]   prints the lookup */
'use strict';
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '.cache/gw');
let CACHE = null;

const norm = s => String(s || '').normalize('NFC').replace(/[’‘ʼ′`]/g, "'").replace(/[‐‑‒–—−]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
const words = s => norm(s).split(/[\s-]+/).filter(Boolean);
const loose = s => words(s).filter(w => w !== 'squad').map(w => w.replace(/s$/, '')).join(' ');
const appBase = s => String(s).replace(/\s+Base$/i, '').replace(/(\d)\s*x\s*(\d)/gi, '$1×$2').trim();

// "Wardens of Ultramar: Ancient Gadriel, Veteran Sergeant Metaurus": the unit, and the models of it this row is for
function modelsOf(name) {
  const m = /^([^:]+):\s*(.*)$/.exec(name); if (!m) return null;
  // (a row for two units: "Skitarii Rangers/Skitarii Vanguard: Transuranic Arquebus"; models apart: "Servitor Underseer / Gun Servitors")
  return { unit: m[1].trim(), units: m[1].split('/').map(x => x.trim()).filter(Boolean), models: m[2].split(/\s*,\s*|\s+\/\s+/).map(x => x.trim()).filter(Boolean) };
}
function guide() {
  if (CACHE) return CACHE;
  const f = fs.existsSync(DIR) && fs.readdirSync(DIR).filter(x => /event_companion.*\.txt$/.test(x)).sort().pop();
  if (!f) return (CACHE = { file: null, factions: {} });
  const lines = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n');
  const start = lines.findIndex(l => /^\s*BASE SIZE GUIDE\s*$/.test(l));
  const factions = {};
  let cur = null;
  for (let i = Math.max(0, start); i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^UNIT\s{2,}BASE SIZE$/.test(t)) {
      // the faction's name is the line before the header (a page number there: the same faction goes on)
      const prev = (lines[i - 1] || '').trim();
      if (prev && !/^\d+$/.test(prev)) { cur = prev.toUpperCase(); factions[cur] = factions[cur] || []; }
      continue;
    }
    if (!cur || !t) continue;
    const m = /^(.+?)\s{2,}(\S.*)$/.exec(t);
    // a line that goes on from the one before ("Wardens of Ultramar: Gaius Silva, …, Dainal Kornelius," / "Lucia Vestha")
    const prevRow = factions[cur][factions[cur].length - 1];
    if (!m && prevRow && prevRow.line === i && /,$/.test(prevRow.name)) { prevRow.name += ' ' + t; prevRow.models = modelsOf(prevRow.name); prevRow.line = i + 1; prevRow.lines = [prevRow.first, i + 1]; continue; }
    if (!m || !/\d+mm|Hull|Base|Flying/i.test(m[2])) continue;
    factions[cur].push({ name: m[1].trim(), printed: m[2].trim(), base: appBase(m[2].trim()), line: i + 1, first: i + 1, models: modelsOf(m[1].trim()) });
  }
  return (CACHE = { file: 'verify/.cache/gw/' + f, factions });
}

// faction: GW's section name, or a list of them (an Ultramarines list: SPACE MARINES, DEATHWATCH); unit: the datasheet's name, when
// names[1] is one model of it (a row for some models of a unit: "Wardens of Ultramar: Gaius Silva, Aemelia Minervas, …")
function lookup(faction, names, unit) {
  const G = guide(), facs = [].concat(faction), rows = [];
  for (const f of facs) { const key = Object.keys(G.factions).find(k => norm(k) === norm(f)); if (key) rows.push(...G.factions[key]); }
  if (!rows.length) return null;
  const hit = (e, how, n) => Object.assign({}, e, { entry: e.name, file: G.file, how, for: n, line: e.first || e.line });
  const all = names.filter(Boolean), own = unit ? all.filter(n => norm(n) !== norm(unit)) : all;
  // a model of a row for some models: the same, the same as for plural/squad, or all of its words in the name
  const wset = n => new Set(words(n).map(w => w.replace(/s$/, '')));
  const modelIs = [(x, n) => norm(x) === norm(n), (x, n) => loose(x) === loose(n), (x, n) => { const nw = wset(n); return words(x).every(w => nw.has(w.replace(/s$/, ''))); }];
  const ofUnit = r => r.models && r.models.units.some(x => loose(x) === loose(unit));
  if (unit) for (const is of modelIs) for (const n of all) {
    const e = rows.find(r => ofUnit(r) && r.models.models.some(x => is(x, n)));
    if (e) return hit(e, 'model', n);
  }
  // a model's name that is part of a model row's ("Nob" of "Tankbustas: Boss Nob"): that row, when it is the only one and names
  // no variant the name does not ("Boyz: Boss Nob (Armageddon)"); a model's name that shares a word with a model row of its unit
  // and matches none: no answer (the gate asks for a declaration), never the unit's own row
  if (unit) for (const n of all.filter(n => loose(n) !== loose(unit))) {
    const nw = wset(n);
    const part = rows.filter(r => ofUnit(r) && r.models.models.some(x => { const xw = wset(x); return [...nw].every(w => xw.has(w)); }));
    if (part.length === 1) {
      const x = part[0].models.models.find(x => { const xw = wset(x); return [...nw].every(w => xw.has(w)); });
      if (!/\(/.test(x) || /\(/.test(n)) return hit(part[0], 'model (part of its name)', n);
    }
    if (part.length || rows.some(r => ofUnit(r) && r.models.models.some(x => words(x).some(w => nw.has(w.replace(/s$/, '')))))) return null;
  }
  for (const n of own) {
    const e = rows.find(r => norm(r.name) === norm(n)); if (e) return hit(e, 'exact', n);
  }
  const modelOf = n => { const ok = rows.filter(r => r.models && r.models.models.some(x => norm(x) === norm(n))); return ok.length === 1 ? hit(ok[0], 'model of ' + ok[0].models.unit, n) : null; };
  for (const n of own) { const e = modelOf(n); if (e) return e; }
  for (const n of all) {
    const e = rows.find(r => norm(r.name) === norm(n)); if (e) return hit(e, 'exact', n);
  }
  for (const n of all) {
    const e = rows.find(r => loose(r.name) === loose(n)); if (e) return hit(e, 'plural/squad', n);
  }
  for (const n of names.filter(Boolean)) {
    const nw = new Set(words(n).map(w => w.replace(/s$/, '')));
    const ok = rows.filter(r => !r.models && words(r.name).every(w => nw.has(w.replace(/s$/, '')))).sort((a, b) => words(b.name).length - words(a.name).length);
    if (ok.length && (ok.length === 1 || words(ok[0].name).length > words(ok[1].name).length) && words(ok[0].name).length >= 2) return hit(ok[0], 'words', n);
  }
  for (const n of all) { const e = modelOf(n); if (e) return e; }
  return null;
}

// a model's base as verify/deviations-bases.json declares it (the gate's `bases` step checks the declarations), by its
// datasheet's id in DATASHEETS ("orks/warboss") and the model's name: the guide's row it names (Warboss (Armageddon)), or the
// declared base where the guide has none or its row is taken to be GW's error (Wazdakka Gutsmek); null when none is declared
function declared(sid, model) {
  let D; try { D = JSON.parse(fs.readFileSync(path.join(__dirname, 'deviations-bases.json'), 'utf8')); } catch (e) { return null; }
  const d = D.find(x => x.datasheet === sid && norm(x.row) === norm(model)); if (!d) return null;
  const G = guide(), e = d.guide ? (G.factions[d.guide.section] || []).find(r => r.name === d.guide.entry) : null;
  const where = 'verify/deviations-bases.json (' + sid + ' · ' + d.row + ')';
  if (d.guide && !e) throw new Error(where + ' names the guide’s row "' + d.guide.entry + '" (' + d.guide.section + '), which ' + (G.file || 'the guide (not cached)') + ' does not have');
  if (e && !d.gwError) return Object.assign({}, e, { entry: e.name, file: G.file, how: 'declared', line: e.first || e.line, declaredIn: where });
  return { base: d.app, printed: d.app, entry: e ? e.name : null, file: G.file, how: e ? 'declared: GW error' : 'declared: not in the guide', line: e ? e.first || e.line : null, declaredIn: where, waha: d.waha || null };
}

module.exports = { guide, lookup, appBase, declared, norm, words, loose };
if (require.main === module) {
  const [fac, ...names] = process.argv.slice(2);
  console.log(JSON.stringify(lookup(fac.split(','), names, names[0]), null, 1));
}
