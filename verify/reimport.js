#!/usr/bin/env node
/* verify/reimport.js: the gate step "reimport". What it guarantees:

   1. Each list with a New Recruit JSON export (verify/sources/nr-json/<list>.json), imported again by verify/from-json.js --write
      alone, in a copy of this folder (its files as git lists them, tracked and new, the source cache linked), gives data.js,
      verify/deviations-bsdata.json, verify/deviations-nr.json, verify/sources/waha-datasheets.txt and verify/sources/bsdata-extract.json
      byte for byte: a re-import changes nothing, so nothing in a list's data.js is a value only data.js holds, beyond what the import
      itself keeps from it (below).
   2. Every entry of every hand file (verify/sources/hand/*.json) carries its reason: a unit entry its why (or each of its columns its
      own: texts.<ability>.why, kw.why), the source line, a stratagem gist its by, a rule's and a fix's why, an id its why.
   3. An id that is not the one the unit's names give is kept only where the hand file names it (ids): an id renamed in data.js by hand
      fails here.
   4. One builder: a list of a catalogued faction (data.js has its whole catalogue, builder.js catalogued) is the list builder.js builds
      from its export, as the phone does: verify/from-json.js says so (verify/out/from-json-<list>.json list: from builder.js, the same as
      its own reading's entry); a list of another faction is from-json.js's own until its catalogue lands. A from-json.js that writes a
      catalogued list otherwise, or whose reading parts from builder.js's, fails here.

   What it does not guarantee: the import starts from data.js as it is, and keeps from it what a re-import is meant to keep (one
   datasheet, one truth: a DATASHEETS row another list has; the units' ids as above; the old form of a label derive.js reads the same
   way; words that equal GW's after markup normalisation). So it is not a proof that an import into a data.js without the list would
   give the same; verify/import-test.js checks the in-app import of each export against its list. A list without an export (Dread
   Host, Emperor's Chosen) keeps its stored rows; it is not re-imported.

     node verify/reimport.js              every export (in parallel, VERIFY_JOBS at a time, default 4)
     node verify/reimport.js <list> ...   only these
   writes verify/out/reimport.json (each list: the files that differ and their first differing lines) */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn, spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const OUTPUTS = ['data.js', 'verify/deviations-bsdata.json', 'verify/deviations-nr.json', 'verify/sources/waha-datasheets.txt', 'verify/sources/bsdata-extract.json'];
const EXP = path.join(ROOT, 'verify/sources/nr-json');
const want = process.argv.slice(2).filter(a => !a.startsWith('--'));
const lists = fs.readdirSync(EXP).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')).filter(a => !want.length || want.includes(a)).sort();
const JOBS = Math.max(1, +process.env.VERIFY_JOBS || 4);
// 4: which lists are of a catalogued faction (builder.js on data.js, as the phone decides)
const CATALOGUED = (() => {
  const w = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'))(w);
  const W = require(path.join(ROOT, 'builder.js')), D = w.WH_DATA;
  return new Set(D.armies.filter(a => W.catalogued(D, a.faction)).map(a => a.id));
})();

// the folder's files as git lists them (tracked and new, not ignored), without the source cache and the step outputs
const files = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: ROOT, encoding: 'utf8' }).stdout.split('\0')
  .filter(f => f && !/^verify\/\.cache(\/|$)/.test(f) && !/^verify\/out\//.test(f) && fs.existsSync(path.join(ROOT, f)));
const copyInto = dir => {
  for (const f of files) { const to = path.join(dir, f); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), to); }
  fs.symlinkSync(fs.realpathSync(path.join(ROOT, 'verify/.cache')), path.join(dir, 'verify/.cache'));
};
// the first lines where two texts part
const firstDiff = (a, b) => {
  const x = a.split('\n'), y = b.split('\n'); let i = 0; while (i < x.length && i < y.length && x[i] === y[i]) i++;
  const clip = s => s === undefined ? '(none)' : s.length > 240 ? s.slice(0, 240) + '…' : s;
  return { line: i + 1, data: clip(x[i]), reimport: clip(y[i]), lines: [x.length, y.length] };
};

// 2: every hand-file entry carries its reason
const HDIR = path.join(ROOT, 'verify/sources/hand'), noWhy = [], said = x => typeof x === 'string' && x.trim().length > 0;
for (const f of fs.readdirSync(HDIR).filter(f => f.endsWith('.json')).sort()) {
  const h = JSON.parse(fs.readFileSync(path.join(HDIR, f), 'utf8'));
  for (const [id, u] of Object.entries(h.units || {})) if (!said(u.why) && !Object.entries(u).filter(([k]) => k !== 'why').every(([k, v]) => k === 'texts' ? Object.values(v).every(x => said(x.why)) : k === 'kw' ? said(v.why) : false)) noWhy.push(f + ' units.' + id);
  if (h.source && !said(h.source.why)) noWhy.push(f + ' source');
  for (const [id, g] of Object.entries(h.gists || {})) if (!said(g.by) && !said(g.why)) noWhy.push(f + ' gists.' + id);
  for (const k of ['rules', 'armyRules']) for (const [id, x] of Object.entries(h[k] || {})) if (!said(x.why) && !(x.texts && said(x.texts.why)) && !(x.faq || []).length) noWhy.push(f + ' ' + k + '.' + id);
  for (const x of h.fixes || []) if (!said(x.why)) noWhy.push(f + ' fixes ' + x.at);
  for (const [id, w] of Object.entries(h.ids || {})) if (!said(w)) noWhy.push(f + ' ids.' + id);
}
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'kodex-reimport-'));
const results = {};
const runOne = a => new Promise(done => {
  const dir = path.join(base, a); fs.mkdirSync(dir); copyInto(dir);
  // (the export's date is the day git committed it: from-json.js asks the folder's own git, KODEX_GIT_ROOT)
  const p = spawn(process.execPath, [path.join(dir, 'verify/from-json.js'), path.join(dir, 'verify/sources/nr-json', a + '.json'), a, '--write'],
    { cwd: dir, env: Object.assign({}, process.env, { KODEX_GIT_ROOT: ROOT }) });
  let log = ''; p.stdout.on('data', d => log += d); p.stderr.on('data', d => log += d);
  p.on('close', code => {
    const differ = [];
    for (const f of OUTPUTS) {
      const A = fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8') : '', B = fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8') : '';
      if (A !== B) differ.push(Object.assign({ file: f }, firstDiff(A, B)));
    }
    // 3: an id kept from data.js that the hand file does not name (verify/from-json.js lists it as not filled)
    let ids = [], list = null; try { const o = JSON.parse(fs.readFileSync(path.join(dir, 'verify/out/from-json-' + a + '.json'), 'utf8')); ids = (o.todo || []).filter(t => t.what === 'id').map(t => t.why); list = o.list || null; } catch (e) {}
    // 4: the list's entry is builder.js's where the faction is catalogued (and this reading's the same), else from-json.js's own
    const one = CATALOGUED.has(a) ? (list && list.from === 'builder.js' && list.same === true ? null : 'a catalogued faction’s list not built by builder.js as the phone builds it (' + (!list ? 'verify/from-json.js names no builder' : list.refused ? 'builder.js refuses it: ' + list.refused.join('; ') : list.from !== 'builder.js' ? 'from ' + list.from : 'from-json.js’s reading is not builder.js’s entry, at ' + JSON.stringify((list.diff || {}).reading) + ' / ' + JSON.stringify((list.diff || {}).builder)) + ')')
      : (list && list.from === 'verify/from-json.js' ? null : 'a list of a faction with no catalogue not from verify/from-json.js’s own reading (' + JSON.stringify(list) + ')');
    results[a] = { exit: code, differ, ids, list, builder: one, log: log.trim().split('\n').slice(-3).join('\n') };
    console.error((code === 0 && !differ.length && !ids.length && !one ? 'same ' : 'DIFF ') + a + (differ.length ? ': ' + differ.map(d => d.file + ' line ' + d.line).join(', ') : code ? ': exit ' + code : one ? ': ' + one : ''));
    fs.rmSync(dir, { recursive: true, force: true });
    done();
  });
});
(async () => {
  const queue = lists.slice();
  await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => { while (queue.length) await runOne(queue.shift()); }));
  fs.rmSync(base, { recursive: true, force: true });
  const bad = lists.filter(a => results[a].exit !== 0 || results[a].differ.length || results[a].ids.length || results[a].builder);
  fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'verify/out/reimport.json'), JSON.stringify({ lists, results }, null, 1) + '\n');
  if (noWhy.length) { console.log('FAIL reimport: ' + noWhy.length + ' hand-file entries without a reason\n' + noWhy.map(x => ' - ' + x).join('\n')); process.exit(1); }
  if (bad.length) {
    console.log('FAIL reimport: ' + bad.length + ' of ' + lists.length + ' exports do not re-import to data.js exactly\n' + bad.map(a => ' - ' + a + ': ' + (results[a].exit ? 'exit ' + results[a].exit + ' (' + results[a].log + ')' : results[a].ids.concat(results[a].builder ? [results[a].builder] : [], results[a].differ.map(d => d.file + ' line ' + d.line + ': data.js ' + JSON.stringify(d.data) + ', re-import ' + JSON.stringify(d.reimport))).join('; '))).join('\n'));
    process.exit(1);
  }
  console.log('reimport: all ' + lists.length + ' New Recruit exports re-import to data.js byte for byte (' + OUTPUTS.length + ' files each: ' + OUTPUTS.join(', ') + '); every hand-file entry has its reason; every id kept from data.js is named in its hand file; ' + lists.filter(a => CATALOGUED.has(a)).length + ' of a catalogued faction built by builder.js as on the phone (' + lists.filter(a => CATALOGUED.has(a)).join(', ') + '), ' + lists.filter(a => !CATALOGUED.has(a)).length + ' by from-json.js until their faction’s catalogue lands');
})();
