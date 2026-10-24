#!/usr/bin/env node
/* verify/dispositions.js: the Force Dispositions each detachment allows, from BSData, against data.js.
   BSData's game system has a Force Disposition group: each disposition is hidden unless the roster has its marker, and a
   detachment's entry carries category links to the markers of the dispositions it allows. Every catalogue in
   verify/.cache/bsdata is read (a faction's detachments can sit in its library file); detachments are matched by name.
   Checks: every detachment in data.js has `dispositions` exactly as BSData gives them (same order), and every list's
   disposition (New Recruit's "Force Disposition") is one its detachments allow.
     node verify/dispositions.js           check
     node verify/dispositions.js --write   write each detachment's dispositions into data.js
   Also used by project/make.js (byDetachment). */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const MARKER = { 'ecf8-cf72-7d5b-1b5b':'Disruption', '0936-9767-1cc7-52ae':'Priority Assets', '6fe0-3dbe-f7e0-10bb':'Purge the Foe', '1cc1-f11a-4e8f-1bcc':'Take and Hold', 'b4a7-5083-fe94-4d24':'Reconnaissance' };
const ORDER = Object.values(MARKER);
// a detachment's name as a key: lower case, curly apostrophes straight (data.js "Emperor’s Chosen", BSData "Emperor's Chosen")
const key = s => String(s || '').toLowerCase().replace(/[’‘]/g, "'");
// { 'detachment name (lower case)': [dispositions] }, and byFaction { catalogue name: { detachment name: [...] } }
function byDetachment(){
  const out = {}, byFaction = {}, dir = path.join(ROOT, 'verify/.cache/bsdata');
  const links = (o, acc) => { if(Array.isArray(o)) o.forEach(x => links(x, acc)); else if(o && typeof o === 'object'){ if(MARKER[o.targetId]) acc.add(MARKER[o.targetId]); Object.values(o).forEach(x => links(x, acc)); } return acc; };
  for(const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))){
    let cat; try { cat = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); } catch(e){ continue; }
    const cname = ((cat.catalogue || cat.gameSystem || {}).name || file.replace(/\.json$/, '')), fac = cname.replace(/\s*-?\s*Library$/i, '').replace(/^Library - /, '').trim();
    const walk = o => { if(Array.isArray(o)) o.forEach(walk); else if(o && typeof o === 'object'){
      if(o.name && o.categoryLinks){ const d = links(o.categoryLinks, new Set()); if(d.size){ const k = key(o.name);
        out[k] = ORDER.filter(x => d.has(x) || (out[k] || []).includes(x)); (byFaction[fac] = byFaction[fac] || {})[o.name] = out[k]; } }
      Object.values(o).forEach(walk); } };
    walk(cat);
  }
  return { out, byFaction };
}
module.exports = { byDetachment, ORDER };
if(require.main !== module) return;

const write = process.argv.includes('--write');
const B = byDetachment().out;
const file = path.join(ROOT, 'data.js');
let src = fs.readFileSync(file, 'utf8');
global.window = {}; require(file); const D = window.WH_DATA;
const fails = [];
let n = 0;
// declared deviations (verify/deviations-bsdata.json, field "dispositions"): a detachment whose BSData entry at the pin has none (the
// unfinished "Deathwatch Support (ITS NOT READY)"), the app's from GW's documents
const DEVS = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/deviations-bsdata.json'), 'utf8')).filter(x => x.field === 'dispositions');
const devUsed = new Set();
for(const [fid, f] of Object.entries(D.factions)) for(const [did, d] of Object.entries(f.detachments || {})){
  n++;
  const want = B[key(d.name)];
  const dev = DEVS.find(x => x.faction === fid && key(x.detachment) === key(d.name));
  if(dev && JSON.stringify(dev.app) === JSON.stringify(d.dispositions || []) && JSON.stringify(dev.source || null) === JSON.stringify(want || null)){ devUsed.add(dev); continue; }
  if(!want){ fails.push(fid + ' · ' + d.name + ': not found in BSData'); continue; }
  const have = d.dispositions || [];
  if(have.join('|') === want.join('|')) continue;
  if(!write){ fails.push(fid + ' · ' + d.name + ': app ' + JSON.stringify(have) + ', BSData ' + JSON.stringify(want)); continue; }
  // write: the detachment's entry is `'<id>': {` … its first `name:'…'`; set or replace `dispositions:[…]` right after the name
  const at = src.indexOf("'" + did + "': {"), nm = at < 0 ? -1 : src.indexOf("name:'", at);
  if(nm < 0){ fails.push(fid + ' · ' + d.name + ': entry not found in data.js'); continue; }
  const end = src.indexOf("',", nm) + 2, lit = ' dispositions:' + JSON.stringify(want).replace(/"/g, "'") + ',';
  const next = src.slice(end, end + 200).match(/^\s*dispositions:\[[^\]]*\],/);
  src = src.slice(0, end) + lit + src.slice(end + (next ? next[0].length : 0));
}
for(const a of D.armies){
  const can = new Set((a.detachments || []).flatMap(id => (D.factions[a.faction].detachments[id] || {}).dispositions || B[key((D.factions[a.faction].detachments[id] || {}).name)] || []));
  if(a.disposition && !can.has(a.disposition)) fails.push(a.id + ': its disposition ' + a.disposition + ' is not one its detachments allow (' + [...can].join(', ') + ')');
}
for(const x of DEVS) if(!devUsed.has(x)) fails.push('verify/deviations-bsdata.json: nothing matches the dispositions deviation of ' + x.faction + ' · ' + x.detachment);
if(write){ fs.writeFileSync(file, src); console.log('dispositions: written for ' + n + ' detachments'); }
if(fails.length){ console.log('FAIL dispositions: ' + fails.length + ' problem(s)\n' + fails.map(x => ' - ' + x).join('\n')); process.exit(1); }
console.log('dispositions: ' + n + ' detachments match BSData' + (devUsed.size ? ' (' + devUsed.size + ' declared deviation' + (devUsed.size > 1 ? 's' : '') + ' used)' : '') + '; every list’s disposition is one its detachments allow');
