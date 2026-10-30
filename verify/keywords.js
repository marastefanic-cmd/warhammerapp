// The gate step keywords: every unit's keywords are GW's, as its datasheet page(s) print them (verify/gw-order.js gwKeywords): KEYWORDS
// and FACTION KEYWORDS of every part; of the unit's own only its datasheet's name keyword (GW prints it; Wahapedia's new-codex pages
// leave it out; every datasheet must have one, BSData's spelling where the page has none), a keyword a named rule of the list gives (why.kw, a kwNote's "comes from <rule>"), a model's or a detachment's keyword
// the list takes, an Allies marker. verify/tables.js --write writes them so; this step fails on any difference that is not declared in
// verify/deviations-keywords.json ({ army, unit, kw, reason, evidence }), and on a unit with no page that is not declared there (kw:'page').
//   node verify/keywords.js      writes verify/out/keywords.json
'use strict';
const fs = require('fs'), path = require('path');
const { ROOT, readJSON, writeJSON } = require('./lib');
const T = require('./tables');
const O = require('./gw-order')(ROOT);
const R = T.read(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'));
const DEVS = readJSON(path.join(ROOT, 'verify/deviations-keywords.json'), []);
const used = new Set(), fails = [];
let units = 0, kws = 0;
const dev = (a, u, k) => { const i = DEVS.findIndex(d => d.army === a && d.unit === u && d.kw === k); if(i >= 0) used.add(i); return i >= 0; };
R.armies.forEach((a, ai) => a.units.forEach((u, ui) => {
  const e = R.A.value[ai].units[ui], own = Object.keys(((e.why || {}).kw) || {});
  const parts = O.partsOf(u, a.faction), g = O.gwKeywords(u, parts, own, O.partCats(R.bsIds, a.id + '/' + u.id, parts));
  if(!g){ if(!dev(a.id, u.id, 'page')) fails.push(a.id + '/' + u.id + ': no Wahapedia datasheet page for every part; declare it (kw "page")'); return; }
  units++; kws += u.kw.length;
  // (every datasheet has its name keyword: GW prints one on each; gw-order.js nameKeyword finds it on the page or in BSData)
  for(const p of g.missing) if(!dev(a.id, u.id, 'name: ' + p)) fails.push(a.id + '/' + u.id + ': no name keyword for ' + p + ' (neither its page nor BSData gives one)');
  for(const k of u.kw) if(!g.includes(k) && !dev(a.id, u.id, k)) fails.push(a.id + '/' + u.id + ': ' + k + ' is not GW\'s (its datasheet does not print it, and no rule of the list gives it)');
  for(const k of g) if(!u.kw.includes(k) && !dev(a.id, u.id, k)) fails.push(a.id + '/' + u.id + ': lacks ' + k + ((g.names || []).includes(k) ? ', its datasheet\'s name keyword' : ', which GW\'s datasheet prints'));
}));
DEVS.forEach((d, i) => { if(!used.has(i)) fails.push('verify/deviations-keywords.json #' + i + ' (' + d.army + '/' + d.unit + ' ' + d.kw + '): nothing matches it'); else if(!d.reason || !d.evidence) fails.push('verify/deviations-keywords.json #' + i + ': no reason or evidence'); });
writeJSON(path.join(ROOT, 'verify/out/keywords.json'), { units, keywords:kws, declared:used.size, fails });
console.log('keywords: ' + (fails.length ? fails.length + ' failure(s); ' : '') + kws + ' keywords of ' + units + ' units are GW\'s datasheets\' (and the list\'s own by its rules); ' + used.size + ' declared');
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
