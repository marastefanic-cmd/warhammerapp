// The gate. Runs every check, then writes verify/report.json; build.js refuses to build unless
// that report is clean and was made from exactly the current app.html and data.js.
//
//   node verify/run.js            run everything (fetch sources first: sh verify/fetch.sh)
//   node verify/run.js --accept   also accept the current screen snapshots (after reading the diff)
//
// Steps (each must pass):
//   data        check.js: the data is complete and consistent
//   invariants  verify/invariants.js: mechanical rules (phases, eligibility, cited numbers, counts)
//   bsdata      verify/bsdata.js: every unit fact equals BSData, the data New Recruit is built from
//   nr          verify/nr.js: everything the owner's New Recruit PDFs print is in the app, identically
//   texts       verify/texts.js: every rules text equals GW's official documents (or Wahapedia)
//   screens     verify/render.js: every screen and popup renders; screen-level checks
//   snapshots   the text of every screen equals the accepted snapshot (verify/snapshots/)
//   helpers     verify/helpers.js: every judgement the app adds is signed off (verify/approvals.json)
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const { ROOT, sha, writeJSON } = require('./lib');

const accept = process.argv.includes('--accept');
const node = (args, env) => spawnSync(process.execPath, args, { cwd:ROOT, encoding:'utf8', env:Object.assign({}, process.env, env || {}) });
const steps = {};
const step = (name, args, env) => {
  const file = args[0];
  if(!fs.existsSync(path.join(ROOT, file))){ steps[name] = { ok:false, out:'missing ' + file }; return; }
  const r = node(args, env);
  const out = (r.stdout + r.stderr).trim();
  steps[name] = { ok:r.status === 0, out:out.split('\n').slice(0, 40).join('\n') };
  console.log((r.status === 0 ? 'PASS ' : 'FAIL ') + name + '  ' + out.split('\n')[0]);
};

const hash = sha(fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8') + fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'));
step('data', ['check.js']);
step('invariants', ['verify/invariants.js']);
step('bsdata', ['verify/bsdata.js']);
step('nr', ['verify/nr.js']);
step('texts', ['verify/texts.js']);
// the screens need the built page: build it without the gate, check it, and the real build follows
const b = node(['build.js'], { VERIFY_BUILDING:'1' });
if(b.status !== 0){ console.log(b.stdout + b.stderr); process.exit(1); }
step('screens', ['verify/render.js'], { NODE_PATH:process.env.NODE_PATH || spawnSync('npm', ['root', '-g'], { encoding:'utf8' }).stdout.trim() });

// snapshots: any change to any screen is shown, and must be accepted on purpose
const snapDir = path.join(ROOT, 'verify/snapshots'), outDir = path.join(ROOT, 'verify/out/snapshots');
const changed = [];
if(fs.existsSync(outDir)) for(const f of fs.readdirSync(outDir)){
  const now = fs.readFileSync(path.join(outDir, f), 'utf8'), old = fs.existsSync(path.join(snapDir, f)) ? fs.readFileSync(path.join(snapDir, f), 'utf8') : '';
  if(now !== old){
    if(accept){ fs.mkdirSync(snapDir, { recursive:true }); fs.writeFileSync(path.join(snapDir, f), now); }
    else changed.push(f);
  }
}
steps.snapshots = { ok:!changed.length, out:changed.length ? 'changed: ' + changed.join(', ') + ' (git diff --no-index verify/snapshots verify/out/snapshots; then --accept)' : 'unchanged' };
console.log((changed.length ? 'FAIL ' : 'PASS ') + 'snapshots  ' + steps.snapshots.out);
step('helpers', ['verify/helpers.js']);

const ok = Object.values(steps).every(s => s.ok);
writeJSON(path.join(ROOT, 'verify/report.json'), { hash, at:new Date().toISOString(), ok, steps:Object.fromEntries(Object.entries(steps).map(([k, v]) => [k, { ok:v.ok, summary:v.out.split('\n')[0] }])) });
console.log(ok ? '\nVERIFIED: every check passes for this app.html + data.js' : '\nNOT VERIFIED: build.js will refuse to build');
process.exit(ok ? 0 : 1);
