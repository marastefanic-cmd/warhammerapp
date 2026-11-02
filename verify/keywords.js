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
const used = new Set(), fails = [], seenName = new Set();
let units = 0, kws = 0;
const dev = (a, u, k) => { const i = DEVS.findIndex(d => d.army === a && d.unit === u && d.kw === k); if(i >= 0) used.add(i); return i >= 0; };
R.armies.forEach((a, ai) => a.units.forEach((u, ui) => {
  const e = R.A.value[ai].units[ui], own = Object.keys(((e.why || {}).kw) || {});
  const parts = O.partsOf(u, a.faction), g = O.gwKeywords(u, parts, own, O.partCats(R.bsIds, a.id + '/' + u.id, parts));
  if(!g){ if(!dev(a.id, u.id, 'page')) fails.push(a.id + '/' + u.id + ': no Wahapedia datasheet page for every part; declare it (kw "page")'); return; }
  units++; kws += u.kw.length;
  // (every datasheet has its name keyword: GW prints one on each; gw-order.js nameKeyword finds it on the page or in BSData)
  g.picks.forEach((x, i) => { if(x && x.how === 'declared'){ const j = DEVS.findIndex(d => d.nameKeyword && d.datasheet === a.faction + '/' + parts[i].name); if(j >= 0) used.add(j); } });
  for(const p of g.missing){ const x = g.picks[parts.findIndex(q => q.name === p)], P = parts.find(q => q.name === p).page;
    const k = a.faction + '/' + p; if(seenName.has(k)) continue; seenName.add(k);
    fails.push(a.id + '/' + u.id + ': ' + (x && x.bad ? p + ': ' + x.bad : x ? 'the name keyword of ' + p + ' is only a head match (' + x.kw + ', ' + x.from + '), not declared; the page prints ' + P.unitKeywords.join('; ') : 'no name keyword for ' + p + ' (neither its page nor BSData gives one)')); }
  for(const k of u.kw) if(!g.includes(k) && !dev(a.id, u.id, k)) fails.push(a.id + '/' + u.id + ': ' + k + ' is not GW\'s (its datasheet does not print it, and no rule of the list gives it)');
  for(const k of g) if(!u.kw.includes(k) && !dev(a.id, u.id, k)) fails.push(a.id + '/' + u.id + ': lacks ' + k + ((g.names || []).includes(k) ? ', its datasheet\'s name keyword' : ', which GW\'s datasheet prints'));
}));
// the DATASHEETS rows no list has (a faction catalogue's): GW's keywords the same way, the row as a unit of its own
const listedIds = new Set(R.A.value.flatMap(a => a.units.flatMap(u => [].concat(u.ds || []))));
let catalog = 0;
for(const [id, s] of Object.entries(R.D.datasheets || {})){
  if(listedIds.has(id) || !Array.isArray(s.kw)) continue;
  const parts = [{ name:s.name, page:O.pageFor(s.faction, s.name) }]; parts.faction = s.faction;
  const g = O.gwKeywords(s, parts, O.catalogOwn(s), [O.catalogCats(id, s.bsId)]);
  if(!g){ if(!dev('catalog', id, 'page')) fails.push('catalog ' + id + ': no Wahapedia datasheet page; declare it (army "catalog", kw "page")'); continue; }
  catalog++; units++; kws += s.kw.length;
  g.picks.forEach(x => { if(x && x.how === 'declared'){ const j = DEVS.findIndex(d => d.nameKeyword && d.datasheet === s.faction + '/' + s.name); if(j >= 0) used.add(j); } });
  for(const p of g.missing){ const x = g.picks[0]; if(!x && dev('catalog', id, 'name')) continue; fails.push('catalog ' + id + ': ' + (x && x.bad ? x.bad : x ? 'the name keyword is only a head match (' + x.kw + ', ' + x.from + '), not declared; the page prints ' + parts[0].page.unitKeywords.join('; ') : 'no name keyword (neither its page nor BSData gives one)')); }
  for(const k of s.kw) if(!g.includes(k) && !dev('catalog', id, k)) fails.push('catalog ' + id + ': ' + k + ' is not GW\'s');
  for(const k of g) if(!s.kw.includes(k) && !dev('catalog', id, k)) fails.push('catalog ' + id + ': lacks ' + k);
}
// a declared pack section exclusion (packExclude): its pack is cached and its CONTENTS name the section
for(const x of O.packExclusionsOk()){ const i = DEVS.findIndex(d => JSON.stringify(d) === JSON.stringify(x.d)); if(x.ok) used.add(i); else fails.push('verify/deviations-keywords.json #' + i + ': the pack ' + x.d.pack + ' has no section ' + x.d.section + ' (it has: ' + x.sections.join(', ') + ')'); }
DEVS.forEach((d, i) => { if(!used.has(i)) fails.push('verify/deviations-keywords.json #' + i + ' (' + d.army + '/' + d.unit + ' ' + d.kw + '): nothing matches it'); else if(!d.reason || !d.evidence) fails.push('verify/deviations-keywords.json #' + i + ': no reason or evidence'); });
writeJSON(path.join(ROOT, 'verify/out/keywords.json'), { units, keywords:kws, declared:used.size, fails });
// KO, PR: the keywords and the rules only some models of a unit have (kwOnly: { keyword: "Model and Model" }, partialRules: { rule: "Model" }),
// each entry standing on GW's pages (or BSData): every model it names has it, and some model of the unit does not. A model has a keyword
// where its part's page prints it on the KEYWORDS line, a page of the unit prints it for that model ("ASPIRING SORCERER: PSYKER", the model's
// name as the stats row spells it, Wahapedia's "Komelius" for "Kornelius", GW's plural for one model), or the model has a page of its own that
// prints it (Sir Hekhtur); a model has a rule where its part's page lists it (CORE ABILITIES, ARMY RULES), a page of the unit lists it "(Model
// only)", its own page lists it, or an ability of the unit for that model gives it by name (an enhancement: "has the **Feel No Pain 4+**
// ability", or an ability of its own: "this model has the **Deep Strike** and **Scouts 6"** abilities"). A model lacks it where its part's page
// does not print it for all models, or a page names other models for it ("(… only)"); the unit's models are its stats rows' and the models a
// page names apart (the Brimstone Horrors a Blue Horrors unit's Split adds)
let nKO = 0, nPR = 0;
{ const lcm = x => String(x || '').toLowerCase().replace(/[’']/g, "'").replace(/\s+model$/, '').replace(/rn/g, 'm').trim();
  const sameM = (a, b) => { const x = lcm(a), y = lcm(b); return x === y || x + 's' === y || x === y + 's'; };
  const KWn = k => O.n(String(k).replace(/^Faction: /, ''));
  const check = (u, faction, where) => { if(!u.kwOnly && !u.partialRules) return;
    const parts = O.partsOf(u, faction), own = O.modelPages(faction, u);
    if(parts.some(p => !p.page)){ fails.push(where + ': kwOnly / partialRules with no page for every part: nothing to hold them to'); return; }
    // (its models: its stats rows', and the models a page of it names apart, "BRIMSTONE HORRORS: BRIMSTONE", which a rule adds to it)
    const models = [...new Set((u.stats || []).map(r => String(r.name).replace(/ ×\d+$/, '')).concat(parts.flatMap(p => Object.keys(p.page.modelKeywords || {}).map(mn => mn.replace(/\s+model$/i, '')))))]
      .filter((m, i, l) => l.findIndex(x => sameM(x, m)) === i);
    // (a model's part: the part of its name, else the part whose page prints a profile of that name, else the last part (the bodyguard's))
    const partOf = m => parts.find(p => sameM(p.name, m)) || parts.find(p => (p.page.profiles || []).some(x => x.name && sameM(x.name, m))) || parts[parts.length - 1];
    const ownPage = m => own.find(P => (P.profiles || []).some(x => x.name && sameM(x.name, m)) || sameM(String(P.file).replace(/^[^_]*_/, '').replace(/\.html$/, '').replace(/-/g, ' '), m));
    const kwHas = (m, k) => { const p = partOf(m), P = ownPage(m);
      if(P) return (P.unitKeywords || []).some(x => KWn(x) === KWn(k)) || (P.factionKeywords || []).some(x => KWn(x) === KWn(k));
      if(sameM(p.name, m) || p === parts[parts.length - 1] && !parts.some(q => q !== p && sameM(q.name, m))) if(p.page.unitKeywords.some(x => KWn(x) === KWn(k))) return true;
      return parts.some(q => Object.entries(q.page.modelKeywords || {}).some(([mn, ks]) => sameM(mn, m) && ks.some(x => KWn(x.replace(/\s*:\s*$/, '')) === KWn(k)))); };
    const rn = r => O.n(String(r).replace(/\s*\([^()]* only\)$/i, ''));
    const labels = P => Object.values(P.labels || {}).flat();
    const ruleHas = (m, r) => { const p = partOf(m), P = ownPage(m);
      if(P && labels(P).some(x => rn(x) === rn(r))) return true;
      if(sameM(p.name, m) && labels(p.page).some(x => rn(x) === rn(r) && !/ only\)$/i.test(x))) return true;
      if(parts.some(q => labels(q.page).some(x => { const o = /\(([^()]*) only\)$/i.exec(x); return o && rn(x) === rn(r) && sameM(o[1], m); }))) return true;
      return (u.abilities || []).some(ab => (sameM(ab.who || '', m) || (!ab.who && parts.length === 1)) && new RegExp('\\b(?:has|have|gains?) the [^.]*?(?<![\\w])' + String(r).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w])[^.]*?\\babilit(?:y|ies)\\b', 'i').test(String(ab.text || '').replace(/\*\*/g, '').replace(/[’]/g, "'"))); };
    for(const [k, who] of Object.entries(u.kwOnly || {})){ nKO++;
      if(!u.kw.some(x => KWn(x) === KWn(k))) fails.push('KO ' + where + ': kwOnly ' + k + ' is not a keyword of the unit');
      const ms = String(who).split(/ and /);
      for(const m of ms){ if(!models.some(x => sameM(x, m)) && !parts.some(p => Object.keys(p.page.modelKeywords || {}).some(mn => sameM(mn, m)))) fails.push('KO ' + where + ': kwOnly ' + k + ' names ' + m + ', no model of the unit');
        else if(!kwHas(m, k)) fails.push('KO ' + where + ': kwOnly ' + k + ' for ' + m + ': no page of the unit prints it for that model'); }
      if(models.every(m => ms.some(x => sameM(x, m)) || kwHas(m, k))) fails.push('KO ' + where + ': kwOnly ' + k + ': every model of the unit has it'); }
    for(const [r, who] of Object.entries(u.partialRules || {})){ nPR++;
      if(!(u.rules || []).some(x => O.n(x) === O.n(r))) fails.push('PR ' + where + ': partialRules ' + r + ' is not on its Rules line');
      const ms = String(who).split(/ and /);
      for(const m of ms) if(!ruleHas(m, r)) fails.push('PR ' + where + ': partialRules ' + r + ' for ' + m + ': no page of the unit lists it for that model, nor an ability of it gives it');
      if(models.every(m => ms.some(x => sameM(x, m)) || ruleHas(m, r))) fails.push('PR ' + where + ': partialRules ' + r + ': every model of the unit has it'); }
  };
  R.armies.forEach(a => a.units.forEach(u => check(u, a.faction, a.id + '/' + u.id)));
  // (and a DATASHEETS row no list has, a catalogue's, as a unit of its own)
  for(const [id, S] of Object.entries(R.D.datasheets || {})) if(!listedIds.has(id)) check(S, S.faction, 'catalog ' + id); }
console.log('keywords: ' + (fails.length ? fails.length + ' failure(s); ' : '') + kws + ' keywords of ' + units + ' units (' + catalog + ' of them catalogue rows) are GW\'s datasheets\' (and the list\'s own by its rules); ' + nKO + ' keywords and ' + nPR + ' rules only some models have, each on GW\'s pages (KO, PR); ' + used.size + ' declared');
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
