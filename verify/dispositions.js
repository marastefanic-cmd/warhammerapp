#!/usr/bin/env node
/* verify/dispositions.js: the Force Dispositions each detachment allows, as GW prints them on the detachment (Wahapedia's faction
   page: the Force Disposition icons in the detachment's heading, "<h2 …>Invasion Fleet … title="Force Disposition: Priority Assets" …
   3DP"), against data.js. Every faction of verify/sources/factions.json is read from its cached page (verify/.cache/waha/<faction>.html);
   detachments are matched by name. BSData is not used (the owner's decision, 22 Nov 2026).
   Checks: every detachment in data.js has `dispositions` exactly as its heading gives them (in the fixed order below), and every list's
   disposition (New Recruit's "Force Disposition") is one its detachments allow.
     node verify/dispositions.js           check
     node verify/dispositions.js --write   write each detachment's dispositions into data.js
   Also used by verify/from-json.js and verify/from-waha.js (byDetachment). */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
// GW's five Force Dispositions, in the order data.js lists a detachment's
const ORDER = ['Disruption', 'Priority Assets', 'Purge the Foe', 'Take and Hold', 'Reconnaissance'];
// a detachment's name as a key: lower case, curly apostrophes straight (data.js "Emperor’s Chosen")
const key = s => String(s || '').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
const txt = s => String(s).replace(/<[^>]+>/g, '').replace(/&rsquo;|&#8217;|&apos;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
// { 'detachment name (lower case)': [dispositions] }, and byFaction { faction: { detachment name: [...] } }; a name two factions' pages
// give different dispositions is in `clash` (the check fails on one data.js has)
function byDetachment(){
  const out = {}, byFaction = {}, byName = {}, clash = new Set(), dir = path.join(ROOT, 'verify/.cache/waha');
  const FJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/sources/factions.json'), 'utf8'));
  for(const fac of Object.keys(FJ).filter(k => k[0] !== '_')){
    let html; try { html = fs.readFileSync(path.join(dir, fac + '.html'), 'utf8'); } catch(e){ continue; }
    for(const m of html.matchAll(/<h2 id="[^"]*" class="outline_header">((?:<img[^>]*>)*[^<]*)<span class="dpPts">([\s\S]*?)<\/span><\/h2>/g)){
      const name = txt(m[1]), d = new Set([...m[2].matchAll(/<img title="Force Disposition: ([^"]+)"/g)].map(x => txt(x[1])));
      if(!name) continue;
      const list = ORDER.filter(x => d.has(x)), odd = [...d].filter(x => !ORDER.includes(x));
      if(odd.length) throw new Error('verify/.cache/waha/' + fac + '.html: ' + name + ' has a Force Disposition this file does not know (' + odd.join(', ') + ')');
      (byFaction[fac] = byFaction[fac] || {})[key(name)] = list;
      (byName[fac] = byName[fac] || {})[name.replace(/'/g, '’')] = list;   // (as the page prints the name: project/make.js)
      if(out[key(name)] && out[key(name)].join('|') !== list.join('|')) clash.add(key(name));
      out[key(name)] = list;
    }
  }
  return { out, byFaction, byName, clash };
}
module.exports = { byDetachment, ORDER };
if(require.main !== module) return;

const write = process.argv.includes('--write');
const BD = byDetachment();
const file = path.join(ROOT, 'data.js');
let src = fs.readFileSync(file, 'utf8');
global.window = {}; require(file); const D = window.WH_DATA;
const fails = [];
let n = 0;
// a detachment's dispositions: its own faction's page's (by GW's name, else New Recruit's spelling of it, nr)
const pageOf = (fid, d) => { const F = BD.byFaction[fid] || {}; return F[key(d.name)] || (d.nr ? F[key(d.nr)] : undefined); };
for(const [fid, f] of Object.entries(D.factions)) for(const [did, d] of Object.entries(f.detachments || {})){
  n++;
  const want = pageOf(fid, d);
  if(!want){ fails.push(fid + ' · ' + d.name + ': no heading of this name on verify/.cache/waha/' + fid + '.html'); continue; }
  if(!want.length){ fails.push(fid + ' · ' + d.name + ': its heading on verify/.cache/waha/' + fid + '.html has no Force Disposition'); continue; }
  const have = d.dispositions || [];
  if(have.join('|') === want.join('|')) continue;
  if(!write){ fails.push(fid + ' · ' + d.name + ': app ' + JSON.stringify(have) + ', Wahapedia ' + JSON.stringify(want)); continue; }
  // write: the detachment's entry is `'<id>': {` … its first `name:'…'`; set or replace `dispositions:[…]` right after the name
  const fat = src.indexOf("\n  '" + fid + "': {"), at = src.indexOf("'" + did + "': {", fat < 0 ? 0 : fat), nm = at < 0 ? -1 : src.indexOf("name:'", at);
  if(nm < 0){ fails.push(fid + ' · ' + d.name + ': entry not found in data.js'); continue; }
  const end = src.indexOf("',", nm) + 2, lit = ' dispositions:' + JSON.stringify(want).replace(/"/g, "'") + ',';
  const next = src.slice(end, end + 200).match(/^\s*dispositions:\[[^\]]*\],/);
  src = src.slice(0, end) + lit + src.slice(end + (next ? next[0].length : 0));
}
for(const a of D.armies){
  const can = new Set((a.detachments || []).flatMap(id => { const d = D.factions[a.faction].detachments[id] || {}; return d.dispositions || pageOf(a.faction, d) || []; }));
  if(a.disposition && !can.has(a.disposition)) fails.push(a.id + ': its disposition ' + a.disposition + ' is not one its detachments allow (' + [...can].join(', ') + ')');
}
if(write){ fs.writeFileSync(file, src); console.log('dispositions: written for ' + n + ' detachments'); }
if(fails.length){ console.log('FAIL dispositions: ' + fails.length + ' problem(s)\n' + fails.map(x => ' - ' + x).join('\n')); process.exit(1); }
console.log('dispositions: ' + n + ' detachments have the Force Dispositions GW prints in their headings (Wahapedia’s faction pages); every list’s disposition is one its detachments allow');
