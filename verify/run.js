// The gate. Runs every check, then writes verify/report.json; build.js refuses to build unless
// that report is clean and was made from exactly the current app.html and data.js.
//
//   node verify/run.js            run everything (fetch sources first: sh verify/fetch.sh)
//   node verify/run.js --accept   also accept the current screen snapshots (after reading the diff)
//
// Steps (each must pass):
//   data        check.js: the data is complete and consistent
//   tables      verify/tables.js: data.js is in table form (every unit entry a reference to its datasheet, as --write writes it),
//               every column has a source (verify/columns.json); datasheet facts two lists have differently: verify/out/tables.md
//   fingerprints  verify/tables.js --fingerprints: every AI-written column (gist, def) matches the text it was written from
//   invariants  verify/invariants.js: mechanical rules (phases, eligibility, cited numbers, counts)
//   derive      verify/derive.js: phases, turn, needs and tags derived from the rules text by fixed rules; every label
//               that agrees with data.js today must keep agreeing (verify/derive-agreed.json); differences are listed, not failed
//   choice      verify/choice.js: every weapon with several profiles is "pick one" or "all fire" as BSData and Wahapedia mark it
//   bsdata      verify/bsdata.js: every unit fact equals BSData, the data New Recruit is built from
//   nr          verify/nr.js: everything the owner's New Recruit PDFs print is in the app, identically
//   texts       verify/texts.js: every rules text equals GW's official documents (or Wahapedia)
//   calc        verify/calc-test.js: the damage calculator (calc.js) gives the averages worked out by hand from the Core Rules
//   import      verify/import-test.js: the list import (import.js) turns each New Recruit JSON export into exactly its list in data.js
//   screens     verify/render.js: every screen and popup renders; screen-level checks; no sideways scroll
//   small phone the same at 320px wide
//   snapshots   the text of every screen equals the accepted snapshot (verify/snapshots/)
//   helpers     verify/helpers.js: every judgement the app adds is signed off (verify/approvals.json)
// Not part of the gate: verify/currency.js checks that the sources are still the newest (run by hand).
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const { ROOT, sha, writeJSON } = require('./lib');

const accept = process.argv.includes('--accept');
// one run at a time in this folder: two would overwrite each other's verify/out (use a separate worktree instead)
const LOCK = path.join(ROOT, 'verify/out/.run.lock');
fs.mkdirSync(path.dirname(LOCK), { recursive:true });
try { fs.writeFileSync(LOCK, String(process.pid), { flag:'wx' }); }
catch(e){
  const pid = +fs.readFileSync(LOCK, 'utf8');
  let alive = false; try { process.kill(pid, 0); alive = true; } catch(_){}
  if(alive){ console.error('another verify/run.js (pid ' + pid + ') is running in ' + ROOT + '; wait for it, or run in a separate git worktree'); process.exit(2); }
  fs.writeFileSync(LOCK, String(process.pid));   // left over from a run that was killed
}
process.on('exit', () => { try { if(fs.readFileSync(LOCK, 'utf8') === String(process.pid)) fs.unlinkSync(LOCK); } catch(e){} });
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

// the verified files: the app, its data, the calculator's engine and the list import
const hash = sha(['app.html', 'data.js', 'calc.js', 'ask.js', 'import.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join(''));
step('data', ['check.js']);
step('tables', ['verify/tables.js']);
step('fingerprints', ['verify/tables.js', '--fingerprints']);
step('invariants', ['verify/invariants.js']);
step('derive', ['verify/derive.js']);
step('choice', ['verify/choice.js']);
step('bsdata', ['verify/bsdata.js']);
step('dispositions', ['verify/dispositions.js']);   // each detachment's Force Dispositions against BSData
step('nr', ['verify/nr.js']);
step('texts', ['verify/texts.js']);
step('calc', ['verify/calc-test.js']);   // the damage calculator against hand-worked cases
step('import', ['verify/import-test.js']);   // the list import against every New Recruit JSON export
// the screens need the built page: build it without the gate, check it, and the real build follows
const b = node(['build.js'], { VERIFY_BUILDING:'1' });
if(b.status !== 0){ console.log(b.stdout + b.stderr); process.exit(1); }
const NODE_PATH = process.env.NODE_PATH || spawnSync('npm', ['root', '-g'], { encoding:'utf8' }).stdout.trim();
step('screens', ['verify/render.js'], { NODE_PATH });
step('small phone', ['verify/render.js'], { NODE_PATH, VERIFY_WIDTH:'320' });   // the same checks at 320px, where layouts break first

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
writeVerified(ok);

// verified.js: what the app shows under "Checked <date>" (the sources and what was compared)
function writeVerified(ok){
  const { readJSON, loadData } = require('./lib');
  const D = loadData(), out = n => readJSON(path.join(ROOT, 'verify/out', n + '.json'), {});
  const total = c => typeof c === 'number' ? c : Object.values(c || {}).reduce((t, v) => t + total(v), 0);
  const help = readJSON(path.join(ROOT, 'verify/out/helpers.json.summary'), {});
  const render = out('render');
  const screens = Object.values(render.checked || {}).reduce((t, c) => t + (c.screens || 0), 0);   // per layout
  const checks = [
    { label:'Your New Recruit lists:', detail:'every unit, model count, wargear, enhancement, stat line, weapon profile and ability matches the PDF (' + total(out('nr').checked) + ' facts).' },
    { label:'BSData,', detail:'the data New Recruit is built from: every stat, weapon, keyword, ability and points value (' + total(out('bsdata').checked) + ' facts).' },
    { label:'Granted values:', detail:'every keyword or value marked + is one a rule of your list changes in BSData, named as that rule, and matches the rules New Recruit prints beside the weapon (' + ((out('bsdata').checked || {}).grants || 0) + ' values).' },
    { label:'Games Workshop’s rules text:', detail:'every rule, enhancement and stratagem is the wording of GW’s newest official document, or Wahapedia where GW has none (' + total(out('texts').checked) + ' texts).' },
    { label:'Rules logic:', detail:'each stratagem is offered in the phases its WHEN names and to the units its TARGET names; every number in a footnote is in the rule it cites.' },
    { label:'The app’s own notes:', detail:(help.approved || 0) + ' footnotes, phase tags and summaries, each read against its rule and signed off; a changed rule voids its sign-off.' },
    { label:'Every screen:', detail:screens + ' screens and popups render on a 390 and a 320px-wide phone; they list every ability, open every link and find every name in search.' }
  ];
  const FJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/sources/factions.json'), 'utf8'));
  const noPack = Object.keys(D.factions).filter(k => !(FJ[k] && FJ[k].pack)).map(k => D.factions[k].name);
  const packs = new Set(Object.keys(D.factions).map(k => FJ[k] && FJ[k].pack && FJ[k].pack.file).filter(Boolean));
  const gw = fs.existsSync(path.join(ROOT, 'verify/.cache/gw')) ? fs.readdirSync(path.join(ROOT, 'verify/.cache/gw')).filter(f => f.endsWith('.pdf') && (!/faction_pack/.test(f) || packs.has(f))).map(f => f.replace(/^eng_(\d\d-\d\d_)?|-[a-z0-9]{10}-[a-z0-9]{10}\.pdf$/g, '').replace(/_/g, ' ')) : [];
  const sources = [
    { label:'New Recruit:', detail:D.armies.map(a => a.name).join(', ') + ' (your PDF' + (D.armies.length > 1 ? 's' : '') + ').' },
    { label:'BSData:', detail:'wh40k-11e, commit ' + (fs.readFileSync(path.join(ROOT, 'verify/fetch.sh'), 'utf8').match(/BSDATA_COMMIT=([0-9a-f]+)/) || [, '?'])[1] + '.' },
    { label:'Games Workshop:', detail:gw.join('; ') + '.' },
    { label:'Wahapedia:', detail:'faction pages for ' + Object.values(D.factions).map(f => f.name).join(', ') + ' and the errata and FAQs they list' +
      (noPack.length ? ' (the only source for ' + noPack.join(', ') + ': no GW Faction Pack yet)' : '') + '.' }
  ];
  const v = { ok, build:hash.slice(0, 10), data:D.version, date:new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }), checks, sources };
  fs.writeFileSync(path.join(ROOT, 'verified.js'), '// written by verify/run.js: the last verification of this app.html + data.js\nwindow.WH_VERIFIED = ' + JSON.stringify(v, null, 1) + ';\n');
}
console.log(ok ? '\nVERIFIED: every check passes for this app.html + data.js' : '\nNOT VERIFIED: build.js will refuse to build');
process.exit(ok ? 0 : 1);
