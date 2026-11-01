#!/usr/bin/env node
/* verify/reimport.js: the gate step "reimport": every list with a New Recruit JSON export (verify/sources/nr-json/<list>.json) is
   imported again, from nothing but its export, its hand file (verify/sources/hand/<list>.json) and the cached sources, and the result
   must be data.js exactly, byte for byte: an imported list gets the very same outcome as the list the app has.

   Each list is re-imported alone (node verify/from-json.js <export> <list> --write) in a copy of this folder (its files as git lists
   them, tracked and new, the source cache linked), so one list's run never sees another's. The files a --write writes must come out as
   they are: data.js, verify/deviations-bsdata.json, verify/deviations-nr.json, verify/sources/waha-datasheets.txt and
   verify/sources/bsdata-extract.json. A list without an export (Dread Host, Emperor's Chosen) keeps its stored rows; it is not re-imported.

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
    results[a] = { exit: code, differ, log: log.trim().split('\n').slice(-3).join('\n') };
    console.error((code === 0 && !differ.length ? 'same ' : 'DIFF ') + a + (differ.length ? ': ' + differ.map(d => d.file + ' line ' + d.line).join(', ') : code ? ': exit ' + code : ''));
    fs.rmSync(dir, { recursive: true, force: true });
    done();
  });
});
(async () => {
  const queue = lists.slice();
  await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => { while (queue.length) await runOne(queue.shift()); }));
  fs.rmSync(base, { recursive: true, force: true });
  const bad = lists.filter(a => results[a].exit !== 0 || results[a].differ.length);
  fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'verify/out/reimport.json'), JSON.stringify({ lists, results }, null, 1) + '\n');
  if (bad.length) {
    console.log('FAIL reimport: ' + bad.length + ' of ' + lists.length + ' exports do not re-import to data.js exactly\n' + bad.map(a => ' - ' + a + ': ' + (results[a].exit ? 'exit ' + results[a].exit + ' (' + results[a].log + ')' : results[a].differ.map(d => d.file + ' line ' + d.line + ': data.js ' + JSON.stringify(d.data) + ', re-import ' + JSON.stringify(d.reimport)).join('; '))).join('\n'));
    process.exit(1);
  }
  console.log('reimport: all ' + lists.length + ' New Recruit exports re-import to data.js byte for byte (' + OUTPUTS.length + ' files each: ' + OUTPUTS.join(', ') + ')');
})();
