#!/usr/bin/env node
// verify/derived-proof.js: a "derived" column of verify/columns.json is held by the script that derives it, not only named by it.
// For each derived column, the scripts it names (its by, and every verify/… .js its note names) that the gate runs are its derivers;
// the column holds when one of them
//   - references the column's key in its code (x.key, 'key', key:, { key }; a table read by position: the table's D key or name), and
//   - fails its gate step when the column's value is changed: in a copy of this folder, one value of the column in data.js is changed
//     in place (its first scalar: a string gets " (changed)", a number +1, a boolean flipped, a regular expression one more character,
//     a map's name " (changed)"; only that token: the file keeps its form) and the deriver's step of verify/run.js is run (the step that
//     is the deriver; for a deriver that is no step of its own, each step that requires it, the quicker first); it must fail (a crash
//     too: the step cannot run with that value; said "crashed"). The first, middle and last row holding a value are tried, in that
//     order, until one fails.
// A column without such a deriver fails; a step that fails on the unchanged data.js proves nothing (it is run so, once, before a proof
// stands on it). A proof is kept in verify/out/derived-proof.json and stands, without running again, while the code it ran is the same
// (every file of its step, the column's entry, the change); --fresh runs every one again.
//
//   node verify/derived-proof.js                 every derived column (the gate's "derived" step); verify/out/derived-proof.json
//   node verify/derived-proof.js --only T.c,…    those columns only
//   node verify/derived-proof.js --jobs N        N copies at a time (default: the CPUs, at most 6)
//   node verify/derived-proof.js --fresh         no proof kept from an earlier run
//   node verify/derived-proof.js --plan          what it would change and run, without running it
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const { ROOT, writeJSON, sha } = require('./lib');
const { parse, lit } = require('./literal');
const { dataTables, columnsInData, derivers, keysOf:keysIn, references, codeRefs } = require('./tables');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/columns.json'), 'utf8')).tables;
const SRC = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
const TABLES = dataTables(SRC);

// ---- the gate's steps, and the files each runs (its own, and every file of this folder it requires or runs, by name: tables.js codeRefs)
const RUN = fs.readFileSync(path.join(ROOT, 'verify/run.js'), 'utf8');
const ALL_STEPS = [...RUN.matchAll(/\bstep\('([^']+)', \[([^\]]*)\](, \{[^}]*\})?\)/g)]
  .map(m => ({ name:m[1], args:[...m[2].matchAll(/'([^']*)'/g)].map(x => x[1]), env:!!m[3] }))
  .filter(s => s.args[0] !== path.relative(ROOT, __filename));   // (not this step)
// (code only: data.js and what the gate writes, verified.js and sw.js, are what a step reads, not what it is)
const NOT_CODE = new Set(['data.js', 'verified.js', 'sw.js']);
function closure(f){
  const out = new Set(), todo = [f];
  while(todo.length){ const g = todo.pop(); if(out.has(g) || NOT_CODE.has(g) || !fs.existsSync(path.join(ROOT, g)) || !g.endsWith('.js')) continue; out.add(g);
    const r = codeRefs(g); todo.push(...r.requires, ...r.spawns.map(x => x.file)); }
  return out;
}
// the steps a proof can run: each step not run in a browser (the screens, build-parity: env), and each script a step's own file runs
// alone (build-parity's verify/build-index.js), as "step › script": the part of that step that fails when the script does
const STEPS = ALL_STEPS.filter(s => !s.env).concat(ALL_STEPS.flatMap(s => codeRefs(s.args[0]).spawns.filter(x => x.alone && !ALL_STEPS.some(t => t.args[0] === x.file))
  .map(x => ({ name:s.name + ' › ' + path.basename(x.file), args:[x.file], part:true }))));
for(const s of STEPS) s.files = closure(s.args[0]);

// ---- a column's derivers and the names they read it by, as tables.js has them
const keysOf = (t, c) => keysIn(t, c, TABLES);

// ---- where a column's values are in data.js: the value nodes of its constant (literal.js), by table and column
const CONSTS = {};
const constOf = name => { if(CONSTS[name] !== undefined) return CONSTS[name];
  const head = '\nconst ' + name + ' = ', at = SRC.indexOf(head); if(at < 0) return (CONSTS[name] = null);
  return (CONSTS[name] = parse(SRC, at + head.length)); };
// the column a value node is (null: a row, a map, part of a value)
function columnOf(name, p, root){
  const top = TABLES[name];
  if(top && top.positional){
    const cols = Object.keys((REG[name] || {}).columns || {});
    if(Array.isArray(root)) return p.length === 2 && typeof p[1] === 'number' ? { t:name, c:cols[p[1]] } : p.length === 1 && cols.length === 1 ? { t:name, c:cols[0] } : null;
    return p.length === 1 ? { t:name, c:cols[cols.length - 1] } : null;   // (a map: its value; its key is its name)
  }
  let t = name, v = root;
  for(let i = 0; i < p.length; i++){
    const e = p[i];
    if(typeof e === 'number'){ v = v && v[e]; continue; }
    const cols = (REG[t] || {}).columns || {};
    if(v && typeof v === 'object' && !Array.isArray(v) && cols[e]){
      if(i === p.length - 1) return { t, c:e };
      if(REG[t + '.' + e]){ t = t + '.' + e; v = v[e]; continue; }
      return null;
    }
    v = v && v[e];
  }
  return null;
}
const VALUES = {};   // 'T.c' → [value node]
for(const name of Object.keys(TABLES)){
  const C = constOf(name); if(!C) continue;
  const top = TABLES[name], cols = Object.keys((REG[name] || {}).columns || {});
  for(const n of C.nodes){
    // (a map read by position, RULES or RULE_SRC: its key is its first column, a name)
    if(n.prop){ if(top.positional && !Array.isArray(C.value) && n.path.length === 1 && cols.length > 1) (VALUES[name + '.' + cols[0]] = VALUES[name + '.' + cols[0]] || []).push({ C, n, key:true }); continue; }
    const col = columnOf(name, n.path, C.value); if(col && col.c) (VALUES[col.t + '.' + col.c] = VALUES[col.t + '.' + col.c] || []).push({ C, n }); }
}
// the columns data.js stores a value of, as the gate's tables step sees them (a column stored but not found above: this script's fault)
const STORED = (() => { const c = columnsInData(SRC), out = new Set();
  for(const [t, cs] of Object.entries(c)) for(const k of cs) out.add(t + '.' + k);
  for(const [name, x] of Object.entries(TABLES)) if(x.positional && (constOf(name) || {}).nodes) for(const k of Object.keys((REG[name] || {}).columns || {})) out.add(name + '.' + k);
  return out; })();
// one change of a value in place: its first scalar token (a string, number, boolean, regular expression) → [pos, end, text]
function change({ C, n, key }){
  if(key){ const m = /^'(?:[^'\\]|\\.)*'|^"(?:[^"\\]|\\.)*"|^[A-Za-z_$][\w$]*/.exec(SRC.slice(n.pos, n.pos + 300)); if(!m) return null;
    const k = /^['"]/.test(m[0]) ? parse(m[0], 0).value : m[0];
    return { pos:n.pos, end:n.pos + m[0].length, from:m[0].slice(0, 60), to:lit(k + ' (changed)').slice(0, 60), text:lit(k + ' (changed)'), at:'key ' + k }; }
  const leaf = C.nodes.filter(x => !x.prop && x.pos >= n.pos && x.end <= n.end && x.path.length >= n.path.length)
    .find(x => { const ch = SRC[x.pos]; return ch !== '{' && ch !== '['; });
  if(!leaf) return null;
  const tok = SRC.slice(leaf.pos, leaf.end);
  let to;
  if(/^['"]/.test(tok)){ const v = parse(tok, 0).value; to = tok[0] === '"' ? JSON.stringify(v + ' (changed)') : lit(v + ' (changed)'); }   // (in its own quotes)
  else if(tok[0] === '/'){ const v = parse(tok, 0).value; to = String(new RegExp(v.source + 'q', v.flags)); }
  else if(tok === 'true' || tok === 'false') to = tok === 'true' ? 'false' : 'true';
  else if(/^-?\d/.test(tok)) to = String(Number(tok) + 1);
  else return null;
  return { pos:leaf.pos, end:leaf.end, from:tok.slice(0, 60), to:to.slice(0, 60), text:to, at:n.path.join('.') };
}

// ---- the copies of this folder the steps run in (the sources' cache linked, not copied)
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'derived-proof-'));
process.on('exit', () => { try { fs.rmSync(TMP, { recursive:true, force:true }); } catch(e){} });
const SKIP = new Set(['.git', 'verify/out', 'verify/.cache', 'verify/.cache-latest', 'node_modules']);
function copy(k){
  const dir = path.join(TMP, 'w' + k);
  fs.cpSync(ROOT, dir, { recursive:true, filter:s => { const r = path.relative(ROOT, s); return !SKIP.has(r); } });
  const cache = path.join(ROOT, 'verify/.cache');
  if(fs.existsSync(cache)) fs.symlinkSync(fs.realpathSync(cache), path.join(dir, 'verify/.cache'));
  return dir;
}
// (the copy has no .git of its own: git, which some steps ask (reimport lists the folder's files; from-json.js an export's date), is
// this folder's, over the copy)
const GIT_DIR = (() => { const r = require('child_process').spawnSync('git', ['rev-parse', '--absolute-git-dir'], { cwd:ROOT, encoding:'utf8' }); return r.status === 0 ? r.stdout.trim() : null; })();
const runStep = (dir, s) => new Promise(ok => {
  const env = Object.assign({}, process.env, { VERIFY_LISTS:'' }, GIT_DIR ? { GIT_DIR, GIT_WORK_TREE:dir } : {});
  const p = spawn(process.execPath, s.args, { cwd:dir, env });
  let out = ''; p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; });
  const t0 = Date.now(); p.on('close', code => ok({ code, out, ms:Date.now() - t0 }));
});
const crashed = out => /^\s+at .+:\d+:\d+\)?$/m.test(out) && !/^\s*FAIL\b|\bfailure/m.test(out);
const firstFail = out => (out.split('\n').find(l => /FAIL|Error|fail|differ|not /.test(l)) || out.split('\n').find(Boolean) || '').trim().slice(0, 300);
// a proof stands while the code it ran is the same: the files of its step, the column's entry in verify/columns.json and the change made
const fileSha = {}, codeOf = s => sha([...s.files].sort().map(f => fileSha[f] || (fileSha[f] = sha(fs.readFileSync(path.join(ROOT, f), 'utf8')))).join(' '));
const OUT = path.join(ROOT, 'verify/out/derived-proof.json');
const CACHE = (() => { try { return JSON.parse(fs.readFileSync(OUT, 'utf8')).columns || {}; } catch(e){ return {}; } })();

(async () => {
  const only = arg('--only') ? new Set(arg('--only').split(',')) : null;
  const jobs = Math.max(1, +(arg('--jobs') || Math.min(6, os.cpus().length)));
  const fresh = process.argv.includes('--fresh');
  const cols = [];
  for(const [t, x] of Object.entries(REG)) for(const [c, v] of Object.entries(x.columns || {})) if(v.source === 'derived' && (!only || only.has(t + '.' + c))) cols.push({ t, c, v });
  const res = {}, fails = [], log = m => process.stderr.write(m + '\n');
  // the work: per column, its derivers' steps (a step that is the deriver first) and the values to change
  const work = cols.map(({ t, c, v }) => {
    const id = t + '.' + c, names = derivers(v), keys = keysOf(t, c), vals = VALUES[id] || [];
    const ds = names.filter(f => STEPS.some(s => s.files.has(f)) && references(f, keys));
    // (a deriver's step: the step that is the deriver; one that is no step of its own, the steps that require it)
    const steps = [];
    for(const f of ds) for(const s of STEPS.filter(s => s.args[0] === f)) steps.push({ s, f, own:true });
    for(const f of ds) if(!STEPS.some(s => s.args[0] === f)) for(const s of STEPS.filter(s => s.files.has(f))) if(!steps.some(x => x.s === s)) steps.push({ s, f });
    const tries = [...new Set([0, vals.length >> 1, vals.length - 1])].filter(i => i >= 0 && i < vals.length).map(i => change(vals[i])).filter(Boolean);
    return { id, v, names, keys, ds, steps, tries };
  });
  for(const w of work){
    if(!w.ds.length) { fails.push(w.id + ': no script it names (' + (w.names.join(', ') || 'none') + ') is run by the gate and reads ' + w.keys.join(' or ')); res[w.id] = { proof:null, why:'no deriver' }; }
    else if(!w.tries.length){
      // (none stored: a column the lists' rows get when data.js loads, or that no row has today; one stored but not found fails)
      if(STORED.has(w.id)) fails.push(w.id + ': data.js stores it, but no value of it was found to change');
      res[w.id] = { proof:null, why:'no value stored in data.js' }; }
  }
  if(process.argv.includes('--plan')){ for(const w of work) console.log(w.id + ' | ' + w.ds.join(',') + ' | ' + w.steps.map(x => x.s.name).join(',') + ' | ' + w.tries.map(c => c.at + ' ' + c.from + '→' + c.to).join(' ; ')); process.exit(0); }
  const keyOf = (w, x, ch) => sha(JSON.stringify(w.v) + '\n' + x.s.name + '\n' + codeOf(x.s) + '\n' + ch.at + '\n' + ch.text);
  // a proof kept from an earlier run whose code is the same (verify/out/derived-proof.json; --fresh: none)
  let kept = 0;
  const queue = work.filter(w => {
    if(!w.ds.length || !w.tries.length) return false;
    const c = !fresh && CACHE[w.id], p = c && c.proof;
    if(p && w.steps.some(x => x.s.name === p.step && x.f === p.deriver && w.tries.some(ch => ch.at === p.at && keyOf(w, x, ch) === p.key))){ res[w.id] = c; kept++; return false; }
    return true; });
  // (the quicker steps first: when the gate runs this one, VERIFY_PASSED gives the steps that passed before it, on this data.js, and their
  // times: those need no run on the unchanged data.js)
  const ms = (() => { try { return JSON.parse(process.env.VERIFY_PASSED || '{}'); } catch(e){ return {}; } })();
  for(const w of queue) w.steps.sort((a, b) => (b.own ? 1 : 0) - (a.own ? 1 : 0) || (ms[a.s.name] || 0) - (ms[b.s.name] || 0));
  // a step's run on the unchanged data.js, once, when a proof would stand on it (a step failing there proves nothing)
  const base = Object.fromEntries(Object.keys(ms).map(k => [k, Promise.resolve(true)])), baseline = (dir, s) => base[s.name] || (base[s.name] = runStep(dir, s).then(r => { log('unchanged: ' + s.name + ' ' + (r.code === 0 ? 'passes' : 'FAILS') + ' (' + Math.round(r.ms / 1000) + 's)'); return r.code === 0; }));
  const dirs = queue.length ? await Promise.all([...Array(Math.min(jobs, queue.length))].map((_, k) => copy(k))) : [];
  let done = 0, next = 0;
  await Promise.all(dirs.map(async dir => {
    const df = path.join(dir, 'data.js');
    while(next < queue.length){
      const w = queue[next++];
      let proof = null; const tried = [];
      for(const x of w.steps){ if(proof) break;
        for(const ch of w.tries){
          fs.writeFileSync(df, SRC.slice(0, ch.pos) + ch.text + SRC.slice(ch.end));
          const r = await runStep(dir, x.s);
          fs.writeFileSync(df, SRC);
          if(r.code === 0){ tried.push(x.s.name + ' @ ' + ch.at + ' passed'); continue; }
          if(!await baseline(dir, x.s)){ tried.push(x.s.name + ' fails on the unchanged data.js'); break; }
          // (a crash is the step failing too: the changed value is what it cannot run with; said as such)
          proof = { deriver:x.f, step:x.s.name, at:ch.at, from:ch.from, to:ch.to, failed:(crashed(r.out) ? 'crashed: ' : '') + firstFail(r.out), key:keyOf(w, x, ch) };
          break;
        } }
      res[w.id] = proof ? { proof } : { proof:null, tried };
      log('[' + (++done) + '/' + queue.length + '] ' + w.id + ': ' + (proof ? proof.step + ' fails @ ' + proof.at : 'NO PROOF (' + tried.join('; ') + ')'));
      if(!proof) fails.push(w.id + ': a change of its value makes no step of ' + w.ds.join(', ') + ' fail (' + tried.join('; ') + ')');
    }
  }));
  // (--only: the other columns' proofs kept as they were)
  writeJSON(OUT, { columns:Object.assign(only ? Object.fromEntries(Object.entries(CACHE).filter(([k]) => !only.has(k))) : {}, res), fails });
  const n = Object.values(res).filter(r => r.proof).length, none = Object.values(res).filter(r => r.why === 'no value stored in data.js').length, by = {};
  for(const r of Object.values(res)) if(r.proof) by[r.proof.step] = (by[r.proof.step] || 0) + 1;
  console.log('derived: ' + (fails.length ? fails.length + ' failure(s); ' : '') + n + ' of ' + cols.length + ' derived columns held by the script they name: a change of one value fails its step (' +
    Object.entries(by).map(([k, v]) => k + ' ' + v).join(', ') + '; ' + kept + ' kept from a run of the same code); ' + none + ' with no value stored in data.js; verify/out/derived-proof.json');
  for(const f of fails) console.log('  FAIL ' + f);
  process.exit(fails.length ? 1 : 0);
})();
