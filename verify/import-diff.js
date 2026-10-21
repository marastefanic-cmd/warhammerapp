#!/usr/bin/env node
/* verify/import-diff.js: what an import (verify/import-nr.js --fresh) and data.js disagree on, fact by
   fact. The proof that the importer writes the list as it was made by hand.
   Usage: node verify/import-diff.js <imported army .js> <armyId> [--data data.js]
   Left out: unit ids, `from` marks (written from BSData by write-grants.js), and what is written by
   hand (short, ph/turn/turns, def, mods, aura). Text markup differences are listed apart from words. */
'use strict';
const path = require('path'), fs = require('fs');
const { appText } = require('./nr');
const [file, armyId] = process.argv.slice(2);
const di = process.argv.indexOf('--data');
global.window = {}; require(path.resolve(di > 0 ? process.argv[di + 1] : path.join(__dirname, '../data.js')));
const A = window.WH_DATA.armies.find(a => a.id === armyId);
const I = (0, eval)('(' + fs.readFileSync(file, 'utf8').replace(/,\s*$/, '') + ')');
const HAND = ['id', 'short', 'mods', 'aura'], HANDAB = ['damaged', 'ph', 'turn', 'turns', 'def', 'na'];
// field order is not a fact: objects compare with their keys sorted
const sorted = v => Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v;
const strip = (o, drop) => sorted(JSON.parse(JSON.stringify(o, (k, v) => drop.includes(k) ? undefined : v)));
const diffs = [], markup = [];
for (const k of ['name', 'faction', 'points', 'pointsUsed', 'battleSize', 'disposition', 'detachments', 'config', 'source'])
  if (JSON.stringify(A[k]) !== JSON.stringify(I[k])) diffs.push('army.' + k + ': data ' + JSON.stringify(A[k]) + ' / import ' + JSON.stringify(I[k]));
const pool = [...A.units];
for (const u of I.units) {
  const c = pool.filter(x => x.name === u.name && (x.leads || null) === (u.leads || null) && x.pts === u.pts && (x.enhancement || null) === (u.enhancement || null));
  if (!c.length) { diffs.push('unit ' + u.id + ': not in data.js'); continue; }
  const au = c[0]; pool.splice(pool.indexOf(au), 1);
  const where = au.id;
  const keys = new Set([...Object.keys(au), ...Object.keys(u)].filter(k => !HAND.includes(k)));
  for (const k of keys) {
    if (k === 'abilities') {
      const n = Math.max(au.abilities.length, u.abilities.length);
      for (let i = 0; i < n; i++) {
        const a = au.abilities[i] && strip(au.abilities[i], HANDAB), b = u.abilities[i];
        if (!a || !b) { diffs.push(where + '.abilities[' + i + ']: data ' + (a && a.name) + ' / import ' + (b && b.name)); continue; }
        for (const f of new Set([...Object.keys(a), ...Object.keys(b)])) {
          if (f === 'text') { if (a.text !== b.text) (appText(a.text).s === appText(b.text).s ? markup : diffs).push(where + '.' + a.name + '.text' + (appText(a.text).s === appText(b.text).s ? ' (markup only)' : '') + ':\n    data   ' + JSON.stringify(a.text) + '\n    import ' + JSON.stringify(b.text)); }
          else if (JSON.stringify(a[f]) !== JSON.stringify(b[f])) diffs.push(where + '.' + a.name + '.' + f + ': data ' + JSON.stringify(a[f]) + ' / import ' + JSON.stringify(b[f]));
        }
      }
      continue;
    }
    const a = strip(au[k], ['from']), b = strip(u[k], ['from']);
    if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(where + '.' + k + ':\n    data   ' + JSON.stringify(a) + '\n    import ' + JSON.stringify(b));
  }
}
for (const u of pool) diffs.push('unit ' + u.id + ': not in the import');
console.log(diffs.length + ' differences in facts or words, ' + markup.length + ' in markup only');
diffs.forEach(d => console.log('  ' + d));
if (process.argv.includes('--markup')) markup.forEach(d => console.log('  ' + d));
process.exit(diffs.length ? 1 : 0);
