// Pick one, or fire them all? For every weapon the app shows as a group of profiles, the answer
// must match the sources:
// - BSData (what New Recruit prints): a profile you pick is named "➤ Weapon - profile"; separate
//   guns under one name have no ➤ (Nazdreg's "Kustom Blasta X - Skorcha", "- Gatler", "- Shoota")
// - Wahapedia's datasheet marks pick-one profiles with its "select one of its profiles" arrow
// The app says "all N fire" (fireAll on every profile) or "pick one profile". A melee group is always
// a pick (a model fights with one melee weapon: 04.01), whatever the sources' markers.
// Exceptions: verify/deviations-choice.json { unit, group, reason, evidence }.
const fs = require('fs'), path = require('path');
const { ROOT, loadData, readJSON, writeJSON } = require('./lib');

const D = loadData();
const extract = fs.readFileSync(path.join(ROOT, 'verify/sources/bsdata-extract.json'), 'utf8');
const bsNames = new Set([...extract.matchAll(/"name":\s*"([^"]+)"/g)].map(m => m[1]));
const dsDir = path.join(process.env.VERIFY_CACHE ? path.resolve(process.env.VERIFY_CACHE) : path.join(ROOT, 'verify/.cache'), 'waha/ds');   // verify/currency.js: the newest pages
const rows = [];   // [text, pointy]
if(fs.existsSync(dsDir)) for(const f of fs.readdirSync(dsDir).filter(f => f.endsWith('.html'))){
  const s = fs.readFileSync(path.join(dsDir, f), 'utf8');
  for(const m of s.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) rows.push([m[1].replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim(), /dsPointy/.test(m[1])]);
}
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const deviations = readJSON(path.join(ROOT, 'verify/deviations-choice.json'), []);
const failures = [], used = new Set(), seen = new Set();
let checked = 0;
for(const a of D.armies) for(const u of a.units) for(const kind of ['ranged', 'melee']) for(const w of u[kind] || []){
  if(!w.group || seen.has(u.id + kind + w.group + w.who)) continue;
  seen.add(u.id + kind + w.group + w.who); checked++;
  const profiles = u[kind].filter(x => x.group === w.group && x.who === w.who);
  const app = profiles.every(p => p.fireAll) ? 'fire-all' : profiles.some(p => p.fireAll) ? 'mixed' : 'pick';
  const re = new RegExp('^(➤ )?' + esc(w.group) + ' [-–] ');
  const bsP = [...bsNames].filter(n => re.test(n));
  const bs = !bsP.length ? null : bsP.some(n => n.startsWith('➤')) ? 'pick' : 'fire-all';
  const wpR = rows.filter(([t]) => new RegExp('^' + esc(w.group) + ' [-–] ', 'i').test(t));
  const wp = !wpR.length ? null : wpR.some(([, p]) => p) ? 'pick' : 'fire-all';
  const want = kind === 'melee' ? 'pick' : bs || wp;
  const where = a.id + ' · ' + u.name + ' · ' + w.group;
  const dev = deviations.findIndex(d => d.unit === u.id && d.group === w.group);
  const problem = app === 'mixed' ? 'some profiles say fireAll, some not'
    : want && app !== want ? 'app says ' + app + ', sources say ' + want + ' (BSData ' + (bs || '?') + ', Wahapedia ' + (wp || '?') + ')'
    : kind === 'ranged' && bs && wp && bs !== wp ? 'BSData says ' + bs + ', Wahapedia says ' + wp
    : !bs && !wp ? 'no source names this weapon\'s profiles' : '';
  if(problem){ if(dev >= 0) used.add(dev); else failures.push({ check:'weapon-choice', where, detail:problem }); }
}
deviations.forEach((d, i) => { if(!used.has(i)) failures.push({ check:'stale-deviation', where:d.unit + ' · ' + d.group, detail:'no longer needed' }); });
writeJSON(process.env.VERIFY_OUT ? path.resolve(process.env.VERIFY_OUT, 'choice.json') : path.join(ROOT, 'verify/out/choice.json'), { checked, wahapediaPages:fs.existsSync(dsDir) ? fs.readdirSync(dsDir).length : 0, failures });
console.log('choice: ' + checked + ' weapons with several profiles checked against BSData and Wahapedia, ' + failures.length + ' failures');
failures.forEach(f => console.log('  ' + f.check + ' · ' + f.where + ' · ' + f.detail));
process.exit(failures.length ? 1 : 0);
