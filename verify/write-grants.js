#!/usr/bin/env node
/* verify/write-grants.js: write the `from` marks that verify/bsdata.js derived from BSData's
   modifiers (verify/out/bsdata.json "grants") into data.js, on weapon and stats rows that have
   none yet. For a new list: node verify/bsdata.js; node verify/write-grants.js; then
   node verify/bsdata.js and node verify/nr.js must pass (both check the marks).
   Usage: node verify/write-grants.js [repo dir]
   data.js in table form (DATASHEETS) is written in the old form first (every unit in full, verify/tables.js), the marks
   go on its rows there, and verify/tables.js puts it back in table form (a mark is the list's own: on the list's row). */
const fs = require('fs'), path = require('path');
const T = require('./tables');
const dir = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const file = path.join(dir, 'data.js');
const src0 = fs.readFileSync(file, 'utf8'), tabled = /\nconst DATASHEETS = /.test(src0);
const lines = (tabled ? T.oldForm(src0) : src0).split('\n');
const grants = require(path.join(dir, 'verify/out/bsdata.json')).grants;
global.window = {}; require(file); const D = window.WH_DATA;
const q = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
// group by row
const rows = new Map();
for (const g of grants) { const k = [g.army, g.unit, g.kind, g.idx].join('|'); if (!rows.has(k)) rows.set(k, []); rows.get(k).push(g); }
const armyLine = id => lines.findIndex(l => l.startsWith("  id:'" + id + "',"));
let done = 0, kept = 0;
for (const [k, gs] of rows) {
  const [aid, uid, kind, idx] = k.split('|');
  const a0 = armyLine(aid); if (a0 < 0) throw new Error('army ' + aid);
  const u0 = lines.findIndex((l, i) => i > a0 && l.startsWith("      id:'" + uid + "',"));
  const nextUnit = lines.findIndex((l, i) => i > u0 && /^      id:'/.test(l));
  const one = lines.findIndex((l, i) => i > u0 && (nextUnit < 0 || i < nextUnit) && l.trim().startsWith(kind + ':[{'));
  const k0 = lines.findIndex((l, i) => i > u0 && l.trim() === kind + ':[');
  let li;
  if (one >= 0 && Number(idx) === 0 && /\}\],?$/.test(lines[one].trim())) li = one;   // stats:[{ … }], on one line
  else {
    if (u0 < 0 || k0 < 0 || (nextUnit > 0 && k0 > nextUnit)) throw new Error('no ' + kind + ' block for ' + aid + '/' + uid);
    li = k0; let seen = -1;   // the idx-th object line of the block (comment lines skipped)
    while (seen < Number(idx)) { li++; if (lines[li].trim().startsWith('{')) seen++; else if (/^\s*\]/.test(lines[li])) throw new Error('block ended: ' + k); }
  }
  const line = lines[li];
  const u = D.armies.find(x => x.id === aid).units.find(x => x.id === uid);
  const obj = u[kind][Number(idx)];
  if (!line.includes("name:" + q(obj.name).replace(/\\'/g, "\\'"))) throw new Error('line ' + (li + 1) + ' is not ' + obj.name + ': ' + line);
  if (/\bfrom:\{/.test(line)) { kept++; continue; }   // bsdata.js compares existing marks
  const order = kind === 'stats' ? ['M','T','Sv','W','Ld','OC','InSv','base'] : [...(obj.kw || []), 'range','A','BS','WS','S','AP','D'];
  gs.sort((x, y) => order.indexOf(x.key) - order.indexOf(y.key));
  const lit = 'from:{ ' + gs.map(g => q(g.key) + ':' + (g.names.length === 1 ? q(g.names[0]) : '[' + g.names.map(q).join(',') + ']')).join(', ') + ' }';
  const m = /\s\}(\]?,?)\s*$/.exec(line); if (!m) throw new Error('no closing brace: ' + line);
  lines[li] = line.slice(0, m.index) + ', ' + lit + ' }' + m[1];
  done++;
}
fs.writeFileSync(file, tabled ? T.tableForm(lines.join('\n')).text : lines.join('\n'));
console.log('marked ' + done + ' rows (' + kept + ' already marked); BSData changes ' + grants.length + ' values');
