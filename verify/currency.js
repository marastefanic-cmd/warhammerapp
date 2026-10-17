// The weekly check: are the sources this app was verified against still the newest?
//
//   node verify/currency.js            check (needs the network); writes verify/out/currency.md and .json
//                                      exit 0: everything current · 1: something changed · 2: a source could not be read
//   node verify/currency.js --accept   once the app is updated and verified again: today's sources become the baseline
//
// What it compares with what the last verification used:
//   1. GW's downloads (Warhammer 40,000, English) against verify/sources/gw-downloads.json: new, replaced
//      and removed documents. The ones that can touch these armies (their factions' packs, core rules, rules
//      updates, event companion, balance and points documents; never Legends) are downloaded to
//      verify/.cache-latest/gw as PDF and text, to read.
//   2. BSData (what New Recruit is built from): the newest commit against the one fetch.sh pins. If newer,
//      verify/bsdata.js runs against it: every failure is a fact of these lists (points, stats, weapons,
//      abilities, keywords) that the newest BSData has differently.
//   3. Wahapedia: the faction pages, the core rules page and the units' datasheet pages, fetched again.
//      Their text against verify/sources/waha-baseline/ (so new errata and FAQ boxes show as a diff), then
//      verify/texts.js and verify/choice.js against the new pages.
// The baseline (GW list, Wahapedia text) is the state of the sources at the last verification; BSData's is
// the commit pinned in fetch.sh. Updating the app to new sources means: change data.js, fetch.sh and
// texts.js's GW file list, run verify/run.js until it passes, then --accept.
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');
const { ROOT, sha, loadData, readJSON, writeJSON } = require('./lib');

const V = path.join(ROOT, 'verify'), LATEST = path.join(V, '.cache-latest'), OUT = path.join(V, 'out');
const BASE_GW = path.join(V, 'sources/gw-downloads.json'), BASE_WAHA = path.join(V, 'sources/waha-baseline');
const accept = process.argv.includes('--accept');
const run = (cmd, args, opts) => spawnSync(cmd, args, Object.assign({ encoding:'utf8', maxBuffer:1 << 28 }, opts || {}));
const curl = (url, out, post) => run('curl', ['-sSfL', '--retry', '3', '-A', 'Mozilla/5.0', ...(post ? ['-X', 'POST', '-H', 'content-type: application/json', '-d', post] : []), url, '-o', out]);
const D = loadData();
const FACTIONS = [...new Set(D.armies.map(a => D.factions[a.faction].name))];   // e.g. Orks, Imperial Knights
const slug = s => s.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
const problems = [], changes = [], md = [];
fs.mkdirSync(LATEST, { recursive:true });

// the pinned sources (GW documents, BSData commit) are what texts.js and bsdata.js compare against;
// fetch.sh only downloads what verify/.cache is missing
{
  const r = run('sh', [path.join(V, 'fetch.sh')]);
  if(r.status !== 0) problems.push('fetch.sh failed: ' + (r.stderr || r.stdout).trim().split('\n').slice(-3).join(' '));
}

/* ---------- 1. GW downloads ---------- */
function gwList(){
  const f = path.join(LATEST, 'gw-downloads-raw.json');
  const r = curl('https://www.warhammer-community.com/api/search/downloads/', f, JSON.stringify({ index:'downloads_v2', searchTerm:'', gameSystem:'warhammer-40000', language:'english' }));
  if(r.status !== 0) return null;
  const d = readJSON(f, null);
  if(!d || !Array.isArray(d.hits) || d.totalPages > 1) return null;
  return d.hits.map(h => ({ file:h.id.file, title:h.title, updated:h.id.last_updated, categories:h.download_categories || [] })).sort((a, b) => a.file.localeCompare(b.file));
}
const relevant = doc => !doc.categories.includes('legends') && !/terrain/.test(doc.categories.join(' ')) &&
  (FACTIONS.some(n => (doc.title + ' ' + doc.file).toLowerCase().replace(/_/g, ' ').includes(n.toLowerCase())) ||
   /core|universal|rules.?update|event.?companion|balance|dataslate|munitorum|field.?manual|commentary|errata|faq|points/i.test(doc.title + ' ' + doc.file));
const gw = gwList();
if(!gw) problems.push('GW’s downloads list could not be read (www.warhammer-community.com/api/search/downloads)');
else {
  const base = readJSON(BASE_GW, []);
  const was = new Map(base.map(d => [d.file, d])), now = new Map(gw.map(d => [d.file, d]));
  const added = gw.filter(d => !was.has(d.file)), removed = base.filter(d => !now.has(d.file));
  md.push('## GW downloads', '');
  if(!added.length && !removed.length) md.push('No change: the same ' + gw.length + ' documents as at the last verification.', '');
  for(const d of added){
    const rel = relevant(d);
    let note = '';
    if(rel){
      const pdf = path.join(LATEST, 'gw', d.file);
      fs.mkdirSync(path.dirname(pdf), { recursive:true });
      if(curl('https://assets.warhammer-community.com/' + encodeURIComponent(d.file).replace(/%2F/g, '/'), pdf).status === 0){
        run('pdftotext', ['-layout', pdf, pdf.replace(/\.pdf$/, '.txt')]);
        note = ' → downloaded: verify/.cache-latest/gw/' + d.file + ' (sha256 ' + sha(fs.readFileSync(pdf)).slice(0, 12) + ', text next to it)';
      } else { note = ' → could not download it'; problems.push('could not download ' + d.file); }
      changes.push({ source:'gw', kind:'added', relevant:true, doc:d });
    }
    md.push('- ' + (rel ? '**NEW, CONCERNS THESE ARMIES:** ' : 'new, other factions or formats: ') + d.title + ' (' + d.updated + ', ' + d.categories.join(', ') + ') `' + d.file + '`' + note);
  }
  for(const d of removed){
    const rel = relevant(d);
    if(rel) changes.push({ source:'gw', kind:'removed', relevant:true, doc:d });
    md.push('- ' + (rel ? '**REMOVED OR REPLACED, CONCERNS THESE ARMIES:** ' : 'removed: ') + d.title + ' (' + d.updated + ') `' + d.file + '`');
  }
  // the documents the app's texts were checked against must still be the current ones
  const used = (fs.readFileSync(path.join(V, 'fetch.sh'), 'utf8').match(/eng_[\w%.-]+\.pdf/g) || []).map(f => f.replace('%26', '&'));
  for(const f of used) if(!now.has(f)) md.push('- **The app’s source `' + f + '` is no longer in GW’s list** (replaced by a newer version, or withdrawn).');
  md.push('');
  if(accept) writeJSON(BASE_GW, gw);
}

/* ---------- 2. BSData ---------- */
md.push('## BSData', '');
const PIN = (fs.readFileSync(path.join(V, 'fetch.sh'), 'utf8').match(/BSDATA_COMMIT=([0-9a-f]+)/) || [])[1];
const head = (run('git', ['ls-remote', 'https://github.com/BSData/wh40k-11e', 'HEAD']).stdout || '').split(/\s/)[0];
if(!head) problems.push('BSData’s newest commit could not be read (github.com/BSData/wh40k-11e)');
else if(head.startsWith(PIN)) md.push('No change: the newest commit is the pinned one (' + PIN + ').', '');
else {
  const dir = path.join(LATEST, 'bsdata');
  if(!fs.existsSync(dir)) run('git', ['clone', '-q', 'https://github.com/BSData/wh40k-11e', dir]);
  run('git', ['-C', dir, 'fetch', '-q', 'origin']);
  run('git', ['-C', dir, 'checkout', '-q', head]);
  const log = run('git', ['-C', dir, 'log', '--format=%h %ad %s', '--date=short', PIN + '..' + head]).stdout.trim();
  const stat = run('git', ['-C', dir, 'diff', '--stat=120', PIN, head]).stdout.trim();
  const r = run(process.execPath, [path.join(V, 'bsdata.js'), '--bsdata', dir, '--out', path.join(LATEST, 'out/bsdata.json')], { cwd:ROOT });
  const res = readJSON(path.join(LATEST, 'out/bsdata.json'), null);
  const fails = res ? (res.failures || []).filter(f => !['bsdata.commit', 'bsdata.extract'].includes(f.field)) : null;   // the pin itself differs, by definition
  md.push('Newer than the pinned ' + PIN + ': ' + head.slice(0, 7) + '.', '', '```', log, '', stat, '```', '');
  if(!fails){ problems.push('verify/bsdata.js could not run against BSData ' + head.slice(0, 7) + ': ' + (r.stderr || r.stdout).trim().split('\n').slice(-3).join(' ')); }
  else if(!fails.length) md.push('verify/bsdata.js against ' + head.slice(0, 7) + ': **no differences for these lists** (the changes are to other factions or files the lists don’t use). Re-pinning fetch.sh to ' + head.slice(0, 7) + ' is safe.', '');
  else {
    md.push('verify/bsdata.js against ' + head.slice(0, 7) + ': **' + fails.length + ' facts of these lists differ:**', '');
    for(const f of fails.slice(0, 80)) md.push('- ' + [f.army, f.unit, f.field].filter(Boolean).join(' · ') + ': app `' + JSON.stringify(f.app) + '`, BSData `' + JSON.stringify(f.source) + '`' + (f.where ? ' (' + f.where + ')' : ''));
    if(fails.length > 80) md.push('- … ' + (fails.length - 80) + ' more in verify/.cache-latest/out/bsdata.json');
    md.push('');
    changes.push({ source:'bsdata', kind:'facts', relevant:true, count:fails.length });
  }
  if(!fails || fails.length) changes.push({ source:'bsdata', kind:'commit', relevant:false, head });
}

/* ---------- 3. Wahapedia ---------- */
md.push('## Wahapedia', '');
// waha-extract.py needs BeautifulSoup (a fresh container may not have it)
if(run('python3', ['-I', '-c', 'import bs4']).status !== 0){
  run('python3', ['-m', 'pip', 'install', '-q', 'beautifulsoup4']);
  if(run('python3', ['-I', '-c', 'import bs4']).status !== 0) run('python3', ['-m', 'pip', 'install', '-q', '--break-system-packages', 'beautifulsoup4']);
  if(run('python3', ['-I', '-c', 'import bs4']).status !== 0) problems.push('Python’s BeautifulSoup (bs4) is missing and could not be installed: the Wahapedia pages can’t be read');
}
const wdir = path.join(LATEST, 'waha');
fs.mkdirSync(path.join(wdir, 'ds'), { recursive:true });
let wahaOk = true;
const pages = FACTIONS.map(slug).map(p => [p, 'https://wahapedia.ru/wh40k11ed/factions/' + p + '/']).concat([['core', 'https://wahapedia.ru/wh40k11ed/the-rules/core-rules/']]);
for(const [p, url] of pages){
  if(curl(url, path.join(wdir, p + '.html')).status !== 0){ wahaOk = false; problems.push('Wahapedia page could not be read: ' + url); continue; }
  run('python3', ['-I', path.join(V, 'waha-extract.py'), path.join(wdir, p + '.html'), path.join(wdir, p + '.txt')]);
}
for(const line of fs.readFileSync(path.join(V, 'sources/waha-datasheets.txt'), 'utf8').split('\n').filter(Boolean)){
  const [fac, unit] = line.trim().split(/\s+/);
  if(curl('https://wahapedia.ru/wh40k11ed/factions/' + fac + '/' + unit, path.join(wdir, 'ds', fac + '_' + unit + '.html')).status !== 0){ wahaOk = false; problems.push('Wahapedia datasheet could not be read: ' + fac + '/' + unit); }
}
// the GW documents stay the pinned ones: texts.js reads GW from the same cache
if(!fs.existsSync(path.join(LATEST, 'gw'))) fs.mkdirSync(path.join(LATEST, 'gw'));
for(const f of fs.existsSync(path.join(V, '.cache/gw')) ? fs.readdirSync(path.join(V, '.cache/gw')) : []){
  const to = path.join(LATEST, 'gw', f);
  if(!fs.existsSync(to)) fs.symlinkSync(fs.realpathSync(path.join(V, '.cache/gw', f)), to);
}
// the text of each page against the baseline
let wahaChanged = 0;
for(const [p] of pages){
  const now = path.join(wdir, p + '.txt'), was = path.join(BASE_WAHA, p + '.txt');
  if(!fs.existsSync(now)) continue;
  if(!fs.existsSync(was)){ md.push('- ' + p + ': no baseline yet'); continue; }
  const diff = run('git', ['diff', '--no-index', '--no-color', '-U2', was, now]).stdout;
  if(!diff.trim()){ md.push('- ' + p + ': no change'); continue; }
  wahaChanged++;
  fs.writeFileSync(path.join(wdir, p + '.diff'), diff);
  const lines = diff.split('\n').filter(l => /^[-+][^-+]/.test(l));
  md.push('- **' + p + ': ' + lines.length + ' lines changed** (verify/.cache-latest/waha/' + p + '.diff). Errata/FAQ lines: ' +
    (lines.filter(l => /errata|faq|change to|add:|delete/i.test(l)).length || 'none'), '', '```diff', ...diff.split('\n').filter(l => !/^(diff|index|---|\+\+\+)/.test(l)).slice(0, 60), '```');
  changes.push({ source:'wahapedia', kind:'text', relevant:true, page:p, lines:lines.length });
}
md.push('');
if(accept && wahaOk){ fs.mkdirSync(BASE_WAHA, { recursive:true }); for(const [p] of pages) if(fs.existsSync(path.join(wdir, p + '.txt'))) fs.copyFileSync(path.join(wdir, p + '.txt'), path.join(BASE_WAHA, p + '.txt')); }
// the app's rules texts and weapon choices against the new pages
const env = Object.assign({}, process.env, { VERIFY_CACHE:LATEST, VERIFY_OUT:path.join(LATEST, 'out') });
fs.mkdirSync(path.join(LATEST, 'out'), { recursive:true });
const t = run(process.execPath, [path.join(V, 'texts.js'), '--quiet', '--out', path.join(LATEST, 'out/texts.json'), '--provenance', path.join(LATEST, 'out/provenance.json')], { cwd:ROOT, env });
const tr = readJSON(path.join(LATEST, 'out/texts.json'), null), tf = tr && (tr.failures || []);
if(!tf) problems.push('verify/texts.js could not run against the new pages: ' + (t.stderr || t.stdout).trim().split('\n').slice(-3).join(' '));
else if(tf.length){
  md.push('verify/texts.js against the new pages: **' + tf.length + ' rules texts of the app no longer match:**', '');
  const cut = x => { x = typeof x === 'string' ? x : JSON.stringify(x); return x && x.length > 300 ? x.slice(0, 300) + '…' : x; };
  for(const f of tf.slice(0, 40)) md.push('- ' + [f.army, f.unit, f.field].filter(Boolean).join(' · ') + ': app “' + cut(f.app) + '”, source “' + cut(f.source) + '”' + (f.where ? ' (' + f.where + ')' : ''));
  md.push('');
  changes.push({ source:'wahapedia', kind:'texts', relevant:true, count:tf.length });
} else md.push('verify/texts.js against the new pages: every rules text still matches.', '');
const c = run(process.execPath, [path.join(V, 'choice.js')], { cwd:ROOT, env });
const cr = readJSON(path.join(LATEST, 'out/choice.json'), null);
if(!cr) problems.push('verify/choice.js could not run: ' + (c.stderr || c.stdout).trim().split('\n').slice(-2).join(' '));
else if(cr.failures.length){
  md.push('verify/choice.js against the new datasheet pages: **' + cr.failures.length + ' weapons changed between pick-one and fire-all:**', '', ...cr.failures.map(f => '- ' + f.where + ': ' + f.detail), '');
  changes.push({ source:'wahapedia', kind:'choice', relevant:true, count:cr.failures.length });
} else md.push('verify/choice.js against the new datasheet pages: every pick-one / fire-all still matches.', '');

/* ---------- report ---------- */
const relevantChanges = changes.filter(x => x.relevant);
const verdict = problems.length ? 'COULD NOT CHECK EVERYTHING' : relevantChanges.length ? 'CHANGES THAT CONCERN THESE ARMIES' : 'ALL CURRENT';
const head1 = ['# Sources check, ' + new Date().toISOString().slice(0, 10) + ': ' + verdict, '',
  'Armies: ' + D.armies.map(a => a.name + ' (' + D.factions[a.faction].name + ')').join(', ') + '. App data ' + D.version + '.', ''];
if(problems.length) head1.push('**Could not check:**', ...problems.map(p => '- ' + p), '');
if(!relevantChanges.length && !problems.length) head1.push('Nothing that these lists use has changed since the last verification.', '');
fs.mkdirSync(OUT, { recursive:true });
fs.writeFileSync(path.join(OUT, 'currency.md'), head1.concat(md).join('\n') + '\n');
writeJSON(path.join(OUT, 'currency.json'), { at:new Date().toISOString(), verdict, problems, changes });
console.log(head1.concat(md).join('\n'));
if(accept) console.log('\nBaseline updated: verify/sources/gw-downloads.json' + (wahaOk ? ', verify/sources/waha-baseline/' : ' (Wahapedia not, a page failed)'));
process.exit(problems.length ? 2 : relevantChanges.length ? 1 : 0);
