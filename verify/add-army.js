#!/usr/bin/env node
/* verify/add-army.js: add (or rebuild) a list from its New Recruit PDF in one command.

   node verify/add-army.js <list.pdf> [--id <armyId>] [--reuse <file.js>[,<file.js>]] [--dry]

   1. the PDF's text (pdftotext -layout) -> verify/sources/nr/<armyId>.txt, its sha256 -> verify/sources/README.md
      (armyId: --id, or the list's name in the PDF, "Simple but effective" -> simple-but-effective)
   2. its faction -> verify/sources/factions.json (Wahapedia page, BSData catalogue, GW Faction Pack from
      verify/sources/gw-downloads.json), then sh verify/fetch.sh for whatever is missing
   3. stops here if data.js lacks the faction or one of its detachments: those are transcribed first
      (verify/ADDING-AN-ARMY.md, "A new faction or detachment")
   4. verify/import-nr.js --write: every fact from the PDF, the wording from Wahapedia's datasheets
      (their pages are fetched and the import runs again when the list has units not seen before), and the
      signed-off hand-written parts of the same datasheets in other lists: this data.js, and the lists that
      left the app (verify/sources/donors.txt: git revisions whose data.js to search)
   5. BSData: the extract is refreshed (bsdata.js --write-extract) so the check also runs without the clone
   6. what is left: verify/out/import-<armyId>.md (what to write by hand) and verify/review/todo-<armyId>.json
      (the judgements of this list nobody has signed off yet), then node verify/run.js

   --dry   show what it would do (steps 1-3), change nothing */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');
const NR = require('./nr');
const ROOT = path.resolve(__dirname, '..'), V = __dirname;
const rel = f => path.relative(process.cwd(), f) || '.';

const argv = process.argv.slice(2);
const flag = f => argv.includes(f);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const pdf = argv.find((a, i) => !a.startsWith('--') && !['--id', '--reuse'].includes(argv[i - 1]));
if (!pdf || !fs.existsSync(pdf)) { console.error('usage: node verify/add-army.js <list.pdf> [--id <armyId>] [--reuse <file.js>] [--dry]'); process.exit(2); }
const dry = flag('--dry');
const step = (n, s) => console.log('\n' + n + '. ' + s);
const run = (cmd, args, o = {}) => { const r = spawnSync(cmd, args, Object.assign({ cwd: ROOT, encoding: 'utf8' }, o)); return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') }; };
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJSON = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n');
const loadData = () => { global.window = {}; const f = path.join(ROOT, 'data.js'); delete require.cache[f]; require(f); return window.WH_DATA; };

// ---------------------------------------------------------------- 1. the PDF's text
step(1, 'New Recruit text');
const tmp = path.join(V, 'out', 'add-army.txt');
fs.mkdirSync(path.dirname(tmp), { recursive: true });
execFileSync('pdftotext', ['-layout', pdf, tmp]);
const nr = NR.parseNR(tmp, []);
if (!nr.name || !nr.faction) { console.error('not a New Recruit list export: no list name or faction in ' + pdf); process.exit(2); }
const id = opt('--id', slug(nr.name));
const txt = path.join(V, 'sources', 'nr', id + '.txt');
const sha = crypto.createHash('sha256').update(fs.readFileSync(pdf)).digest('hex');
const exported = nr.date ? ' (exported ' + nr.date + ')' : '';
console.log('   ' + nr.name + ' · ' + nr.faction + ' · ' + nr.pts + ' pts · ' + nr.units.length + ' units -> ' + rel(txt) + (fs.existsSync(txt) ? ' (replaces the earlier export)' : ''));
if (!dry) {
  fs.copyFileSync(tmp, txt);
  const readme = path.join(V, 'sources', 'README.md');
  const row = '| nr/' + id + '.txt | ' + path.basename(pdf).replace(/^[0-9a-f]{8}-/, '').replace(/_/g, ' ') + exported + ' | ' + sha + ' |';   // without the upload's id prefix
  let r = fs.readFileSync(readme, 'utf8');
  const re = new RegExp('^\\| nr/' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.txt \\|.*$', 'm');
  r = re.test(r) ? r.replace(re, row) : r.replace(/(\n\| packet\/)/, '\n' + row + '$1');
  fs.writeFileSync(readme, r);
}

// ---------------------------------------------------------------- 2. the faction's sources
step(2, 'faction sources');
const FJ = path.join(V, 'sources', 'factions.json');
const factions = readJSON(FJ);
const short = nr.faction.replace(/^.* - /, '');            // "Chaos - World Eaters" -> "World Eaters"
let fid = Object.keys(factions).find(k => k[0] !== '_' && factions[k].bsdata === nr.faction);
if (!fid) {
  fid = slug(short);
  const gw = fs.existsSync(path.join(V, 'sources', 'gw-downloads.json')) ? readJSON(path.join(V, 'sources', 'gw-downloads.json')) : [];
  // (GW files a faction's printed product updates under faction-packs too, with the faction's bare name as
  // title: the one titled "Faction Pack: …" is the pack)
  const packs = gw.filter(d => (d.categories || []).includes('faction-packs') && slug(d.title.replace(/^Faction Pack:\s*/, '')) === fid);
  const pack = packs.find(d => /^Faction Pack:/.test(d.title)) || packs[0];
  factions[fid] = { waha: fid, bsdata: nr.faction, pack: pack ? { file: pack.file, label: 'GW Faction Pack ' + short } : null };
  console.log('   new faction ' + fid + ': Wahapedia ' + fid + ', BSData "' + nr.faction + '", ' + (pack ? 'Faction Pack ' + pack.file : 'no GW Faction Pack (Wahapedia is the source)'));
  if (!dry) writeJSON(FJ, factions);
} else console.log('   ' + fid + ' (in sources/factions.json)');
if (!dry) {
  const f = run('sh', [path.join(V, 'fetch.sh')]);
  if (!f.ok) { console.error(f.out); console.error('fetch.sh failed: the sources above are needed'); process.exit(1); }
}

// ---------------------------------------------------------------- 3. faction and detachments in data.js
step(3, 'faction rules in data.js');
let D = loadData();
const F = D.factions[fid];
const dets = NR.nrDetachments(nr.bullets['Detachment']);
const missing = [];
if (!F) missing.push('the faction ' + short + ' (army rules, and the detachments below)');
for (const n of dets) if (!F || !Object.values(F.detachments).some(d => NR.nm(d.name) === n)) missing.push('the detachment ' + n);
if (missing.length) {
  console.log('   data.js still needs ' + missing.join('; ') + '.\n   Transcribe them (verify/ADDING-AN-ARMY.md, "A new faction or detachment"), check them with node verify/texts.js, then run this again.');
  process.exit(dry ? 0 : 3);
}
console.log('   ' + F.name + ': ' + dets.join(', ') + ' (all in data.js)');
if (dry) process.exit(0);

// ---------------------------------------------------------------- 4. import
step(4, 'import');
// donors: this data.js (other lists with the same datasheets) and the data.js of git revisions that had lists since removed
const donorDir = path.join(V, '.cache', 'donors');
fs.mkdirSync(donorDir, { recursive: true });
const donors = [path.join(ROOT, 'data.js')];
const revs = fs.existsSync(path.join(V, 'sources', 'donors.txt')) ? fs.readFileSync(path.join(V, 'sources', 'donors.txt'), 'utf8').split('\n').map(l => l.replace(/#.*/, '').trim()).filter(Boolean) : [];
for (const rev of revs) {
  const f = path.join(donorDir, rev.replace(/[^\w.-]/g, '_') + '.js');
  if (!fs.existsSync(f)) { const g = run('git', ['show', rev + ':data.js']); if (!g.ok) { console.log('   (no data.js at ' + rev + ': skipped)'); continue; } fs.writeFileSync(f, g.out); }
  donors.push(f);
}
const extra = (opt('--reuse', '') || '').split(',').filter(Boolean).map(f => path.resolve(f));
const snapshot = path.join(donorDir, 'current.js');
fs.copyFileSync(path.join(ROOT, 'data.js'), snapshot);   // a donor must not be the file being written
donors[0] = snapshot;
const importArgs = [path.join(V, 'import-nr.js'), txt, id, '--write', '--reuse', donors.concat(extra).join(',')];
let imp = run(process.execPath, importArgs);
console.log(imp.out.trim().split('\n').map(l => '   ' + l).join('\n'));
if (!imp.ok) process.exit(1);
// units not seen before: their Wahapedia pages were added to waha-datasheets.txt; fetch them and import again
if (/Wahapedia datasheets to download/.test(fs.readFileSync(path.join(V, 'out', 'import-' + id + '.md'), 'utf8'))) {
  console.log('   fetching the new Wahapedia datasheet pages, then importing again');
  const f = run('sh', [path.join(V, 'fetch.sh')]);
  if (/could not fetch/.test(f.out)) console.log(f.out.split('\n').filter(l => /could not fetch/.test(l)).map(l => '   ' + l).join('\n'));
  imp = run(process.execPath, importArgs);
  console.log(imp.out.trim().split('\n').map(l => '   ' + l).join('\n'));
  if (!imp.ok) process.exit(1);
}

// ---------------------------------------------------------------- 5. BSData extract
step(5, 'BSData');
const b = run(process.execPath, [path.join(V, 'bsdata.js'), '--write-extract']);
console.log('   ' + (b.out.trim().split('\n').find(l => /^(PASS|FAIL|bsdata)/.test(l)) || b.out.trim().split('\n').pop()));

// ---------------------------------------------------------------- 6. what is left
step(6, 'left to do');
const md = fs.readFileSync(path.join(V, 'out', 'import-' + id + '.md'), 'utf8');
const todoLines = md.split('\n').filter(l => /^- /.test(l));
const h = run(process.execPath, [path.join(V, 'helpers.js')]);
const all = fs.existsSync(path.join(V, 'out', 'helpers-todo.json')) ? readJSON(path.join(V, 'out', 'helpers-todo.json')) : [];
const mine = all.filter(x => x.army === id || (x.where || '').startsWith(id + ' ·'));
const todoFile = path.join(V, 'review', 'todo-' + id + '.json');
writeJSON(todoFile, mine);
console.log('   ' + rel(path.join(V, 'out', 'import-' + id + '.md')) + ': what the import could not know (' + todoLines.length + ' lines)');
console.log('   ' + rel(todoFile) + ': ' + mine.length + ' judgements of this list to sign off' + (all.length > mine.length ? ' (' + (all.length - mine.length) + ' more elsewhere)' : ''));
console.log('   then: node verify/run.js');
