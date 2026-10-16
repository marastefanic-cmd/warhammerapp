// Records reviewers' verdicts in verify/approvals.json.
//   node verify/approve.js verify/review/result-<name>.json [...]
// - verdict 'ok' on an item that still exists: approved as is
// - verdict 'fix': approved only once the data holds exactly the reviewer's fix (same kind and place)
// - verdict 'unclear': approved only with a note (verify/review/unclear.json: { key: how the app handles it })
// Anything else stays to be checked: verify/helpers.js lists it.
const fs = require('fs'), path = require('path');
const { ROOT, loadData, readJSON, writeJSON } = require('./lib');
const { items, appFunctions } = require('./helpers');

const D = loadData();
const now = items(D, appFunctions(fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8')));
const byKey = new Map(now.map(x => [x.key, x]));
const old = new Map();
for(const f of fs.readdirSync(path.join(ROOT, 'verify/review')).filter(f => f.startsWith('todo-'))) for(const x of readJSON(path.join(ROOT, 'verify/review', f), [])) old.set(x.key, x);
const approvals = readJSON(path.join(ROOT, 'verify/approvals.json'), {});
const unclear = readJSON(path.join(ROOT, 'verify/review/unclear.json'), {});
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const at = new Date().toISOString().slice(0, 10);
let ok = 0, fixed = 0, waiting = [];
for(const file of process.argv.slice(2)){
  const by = 'review:' + path.basename(file).replace(/^result-|\.json$/g, '');
  for(const r of readJSON(path.resolve(file), [])){
    if(r.verdict === 'ok' && byKey.has(r.key)){ approvals[r.key] = { verdict:'ok', by, at, why:r.why || '' }; ok++; continue; }
    const was = old.get(r.key);
    if(r.verdict === 'fix' && was){
      const hit = now.find(x => x.kind === was.kind && x.where === was.where && same(x.judgement, r.fix));
      if(hit){ approvals[hit.key] = { verdict:'ok', by:by + ' (its fix)', at, why:r.why || '' }; fixed++; }
      else waiting.push('fix not applied: ' + was.kind + ' · ' + was.where);
      continue;
    }
    if(r.verdict === 'unclear' && byKey.has(r.key)){
      if(unclear[r.key]){ approvals[r.key] = { verdict:'ok', by:by + ' (ambiguous rule)', at, why:unclear[r.key] }; ok++; }
      else waiting.push('unclear, needs a decision: ' + (was ? was.kind + ' · ' + was.where : r.key));
    }
  }
}
writeJSON(path.join(ROOT, 'verify/approvals.json'), Object.fromEntries(Object.entries(approvals).sort()));
console.log('approved ' + ok + ' as reviewed, ' + fixed + ' fixes as applied; ' + waiting.length + ' waiting');
waiting.forEach(w => console.log('  ' + w));
