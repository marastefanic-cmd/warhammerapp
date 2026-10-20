#!/usr/bin/env node
/* verify/army-blocks.js: work on one list in a separate git worktree, then bring it back.

   node verify/army-blocks.js list                          the lists in data.js, with their line ranges
   node verify/army-blocks.js keep <id>[,<id>...]           data.js keeps only these lists (in a worktree:
                                                            the gate then checks just them)
   node verify/army-blocks.js merge <worktree> <id>         from <worktree>: that list's block of data.js, and
                                                            its entries in the deviations files, map-bsdata.json
                                                            and waha-datasheets.txt; prints what else differs
                                                            there (code, glossary, factions) to bring by hand

   A list's block is its { … } in ARMIES, from the line "{" to its closing "}," (data.js is in the
   importer's layout, one list after another). */
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const [cmd, a1, a2] = process.argv.slice(2);

// the blocks of ARMIES: [{ id, start, end }] as line indexes (end inclusive)
function blocks(text) {
  const L = text.split('\n'), out = [];
  const s0 = L.findIndex(l => /^const ARMIES = \[/.test(l));
  if (s0 < 0) throw new Error('no "const ARMIES = [" in data.js');
  let depth = 0, cur = null;
  for (let i = s0 + 1; i < L.length; i++) {
    const l = L[i];
    if (depth === 0 && /^\];/.test(l)) return { L, s0, end: i, out };
    // count braces outside strings (data.js strings use ' and never contain an unescaped ')
    let inS = false, q = '';
    for (let k = 0; k < l.length; k++) {
      const c = l[k];
      if (inS) { if (c === '\\') k++; else if (c === q) inS = false; continue; }
      if (c === "'" || c === '"' || c === '`') { inS = true; q = c; continue; }
      if (c === '/' && l[k + 1] === '/') break;
      if (c === '{' || c === '[') { if (depth === 0 && c === '{') cur = { start: i }; depth++; }
      else if (c === '}' || c === ']') { depth--; if (depth === 0 && cur) { cur.end = i; out.push(cur); cur = null; } }
    }
    if (cur && cur.id == null) { const m = /^\s*id:'([^']+)'/.exec(l); if (m) cur.id = m[1]; }
  }
  throw new Error('ARMIES does not close');
}
const dataFile = p => path.join(p, 'data.js');
const read = f => fs.readFileSync(f, 'utf8');

if (cmd === 'list') {
  const { out } = blocks(read(dataFile(ROOT)));
  for (const b of out) console.log(b.id.padEnd(28) + ' lines ' + (b.start + 1) + '-' + (b.end + 1));
} else if (cmd === 'keep') {
  const keep = new Set((a1 || '').split(',').filter(Boolean));
  const t = read(dataFile(ROOT)), { L, out } = blocks(t);
  const drop = out.filter(b => !keep.has(b.id));
  for (const b of drop.reverse()) L.splice(b.start, b.end - b.start + 1);
  fs.writeFileSync(dataFile(ROOT), L.join('\n'));
  console.log('data.js keeps ' + [...keep].join(', ') + '; dropped ' + drop.map(b => b.id).join(', '));
} else if (cmd === 'merge') {
  const wt = path.resolve(a1), id = a2;
  if (!wt || !id) { console.error('usage: node verify/army-blocks.js merge <worktree> <armyId>'); process.exit(2); }
  // 1. the list's block
  const theirs = blocks(read(dataFile(wt))), mine = blocks(read(dataFile(ROOT)));
  const tb = theirs.out.find(b => b.id === id), mb = mine.out.find(b => b.id === id);
  if (!tb) { console.error('no list ' + id + ' in ' + dataFile(wt)); process.exit(1); }
  let block = theirs.L.slice(tb.start, tb.end + 1);
  if (!/,\s*$/.test(block[block.length - 1])) block[block.length - 1] += ',';
  if (mb) mine.L.splice(mb.start, mb.end - mb.start + 1, ...block);
  else mine.L.splice(mine.end, 0, ...block);
  fs.writeFileSync(dataFile(ROOT), mine.L.join('\n'));
  console.log('data.js: ' + id + ' from ' + wt + ' (' + block.length + ' lines)');
  // 2. its deviations (army = the list; for the text check also its faction, reported under the faction)
  for (const f of ['deviations-nr.json', 'deviations-bsdata.json', 'deviations-texts.json']) {
    const A = path.join(ROOT, 'verify', f), B = path.join(wt, 'verify', f);
    if (!fs.existsSync(B)) continue;
    const a = JSON.parse(read(A)), b = JSON.parse(read(B));
    const has = new Set(a.map(x => JSON.stringify(x)));
    const add = b.filter(x => x.army === id && !has.has(JSON.stringify(x)));
    const gone = a.filter(x => x.army === id && !b.some(y => JSON.stringify(y) === JSON.stringify(x)));
    const keep = a.filter(x => !gone.includes(x)).concat(add);
    if (add.length || gone.length) { fs.writeFileSync(A, JSON.stringify(keep, null, 1) + '\n'); console.log(f + ': +' + add.length + ' -' + gone.length + ' entries of ' + id); }
    const other = b.filter(x => x.army !== id && !has.has(JSON.stringify(x)));
    if (other.length) console.log(f + ': ' + other.length + ' new entries for other lists or factions (bring by hand): ' + other.map(x => x.army + '/' + x.unit).join(', '));
  }
  // 3. map-bsdata units of the list
  { const A = path.join(ROOT, 'verify/map-bsdata.json'), B = path.join(wt, 'verify/map-bsdata.json');
    const a = JSON.parse(read(A)), b = JSON.parse(read(B)); let n = 0;
    for (const [k, v] of Object.entries(b.units || {})) if (k.startsWith(id + '/') && JSON.stringify(a.units[k]) !== JSON.stringify(v)) { a.units[k] = v; n++; }
    for (const k of Object.keys(a.units || {})) if (k.startsWith(id + '/') && !(b.units || {})[k]) { delete a.units[k]; n++; }
    if (n) { fs.writeFileSync(A, JSON.stringify(a, null, 1) + '\n'); console.log('map-bsdata.json: ' + n + ' unit entries of ' + id); } }
  // 4. Wahapedia datasheet pages
  { const A = path.join(ROOT, 'verify/sources/waha-datasheets.txt'), B = path.join(wt, 'verify/sources/waha-datasheets.txt');
    const a = read(A).split('\n').filter(Boolean), add = read(B).split('\n').filter(l => l && !a.includes(l));
    if (add.length) { fs.writeFileSync(A, a.concat(add).join('\n') + '\n'); console.log('waha-datasheets.txt: +' + add.join(', ')); } }
  // 5. everything else that differs: brought by hand
  let base = '';
  try { base = execFileSync('git', ['-C', wt, 'merge-base', 'HEAD', execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()], { encoding: 'utf8' }).trim(); } catch (e) {}
  if (base) {
    const changed = execFileSync('git', ['-C', wt, 'diff', '--name-only', base], { encoding: 'utf8' }).split('\n').filter(Boolean)
      .filter(f => !/^verify\/(out|review)\/|^verify\/(deviations-(nr|bsdata|texts)|map-bsdata|approvals|provenance|report)\.json$|^verify\/snapshots\/|^verify\/sources\/(bsdata-extract\.json|waha-datasheets\.txt)$|^(index\.html|sw\.js|verified\.js|version\.json)$/.test(f));
    const dj = changed.includes('data.js') ? execFileSync('git', ['-C', wt, 'diff', base, '--', 'data.js'], { encoding: 'utf8' }) : '';
    const outside = dj && (() => { const L = read(dataFile(wt)).split('\n'), t = blocks(read(dataFile(wt))); const own = new Set(); t.out.forEach(b => { for (let i = b.start; i <= b.end; i++) own.add(i + 1); });
      return [...dj.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)].some(m => { const s = +m[1], n = +(m[2] || 1); for (let i = s; i < s + n; i++) if (i < t.s0 + 1 || i > t.end + 1) return true; return false; }); })();
    const rest = changed.filter(f => f !== 'data.js').concat(outside ? ['data.js (outside ARMIES: glossary or factions)'] : []);
    if (rest.length) console.log('also changed in the worktree (bring by hand, see git -C ' + wt + ' diff ' + base.slice(0, 8) + '): ' + rest.join(', '));
  }
} else {
  console.error('usage: node verify/army-blocks.js list | keep <ids> | merge <worktree> <id>');
  process.exit(2);
}
