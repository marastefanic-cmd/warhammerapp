#!/usr/bin/env node
// project/make.js: the files of the owner's Claude Project (a general 11th edition rules judge; see project/README.md):
//  - core-rules.md: the app's Core Rules text, with the date it was taken
//  - detachment-dispositions.md: every detachment in BSData with the Force Dispositions it allows
//  - skills/*.zip: each skill as a zip to upload, with the dice-maths skill's copy of the app's damage engine (calc.js)
// The player's lists are not in the Project: the app sends the current list with each question.
// Run after `node build.js`: node project/make.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const { execFileSync } = require('child_process');
// the Force Dispositions each detachment allows, from BSData (the game system's Force Disposition group: each disposition is
// hidden unless the roster has its marker, and a detachment's category links name the markers it allows)
const MARKER = { 'ecf8-cf72-7d5b-1b5b':'Disruption', '0936-9767-1cc7-52ae':'Priority Assets', '6fe0-3dbe-f7e0-10bb':'Purge the Foe', '1cc1-f11a-4e8f-1bcc':'Take and Hold', 'b4a7-5083-fe94-4d24':'Reconnaissance' };
const DISP_ORDER = Object.values(MARKER);
function dispositionsByDetachment(){
  // every BSData catalogue (a faction's detachments can sit in its library file), detachments by name; byFaction: the
  // detachments of every faction in BSData (by catalogue name, library files with their faction), for detachment-dispositions.md
  const out = {}, byFaction = {}, dir = path.join(ROOT, 'verify/.cache/bsdata');
  const F = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/sources/factions.json'), 'utf8'));
  const mine = Object.entries(F).filter(([k, f]) => k[0] !== '_' && f.bsdata).map(([k, f]) => [k, f.bsdata.split(' - ').pop()]);
  const links = (o, acc) => { if(Array.isArray(o)) o.forEach(x => links(x, acc)); else if(o && typeof o === 'object'){ if(MARKER[o.targetId]) acc.add(MARKER[o.targetId]); Object.values(o).forEach(x => links(x, acc)); } return acc; };
  for(const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))){
    let cat; try { cat = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); } catch(e){ continue; }
    const cname = ((cat.catalogue || cat.gameSystem || {}).name || file.replace(/\.json$/, '')), fac = cname.replace(/\s*-?\s*Library$/i, '').replace(/^Library - /, '').trim();   // every faction in BSData
    const walk = o => { if(Array.isArray(o)) o.forEach(walk); else if(o && typeof o === 'object'){ if(o.name && o.categoryLinks){ const d = links(o.categoryLinks, new Set()); if(d.size){ const k = o.name.toLowerCase(); out[k] = DISP_ORDER.filter(x => d.has(x) || (out[k] || []).includes(x));
        if(fac){ (byFaction[fac] = byFaction[fac] || {})[o.name] = out[k]; } } } Object.values(o).forEach(walk); } };
    walk(cat);
  }
  out._byFaction = byFaction; out._names = Object.fromEntries(Object.entries(F).filter(([k]) => k[0] !== '_').map(([k, f]) => [k, f.name || ({ 'emperors-children':'Emperor’s Children' }[k]) || k.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')]));
  return out;
}
const DISP = dispositionsByDetachment(), today = new Date().toISOString().slice(0, 10);
const gitDate = f => { try { return execFileSync('git', ['log', '-1', '--format=%cs', '--', f], { cwd:ROOT, encoding:'utf8' }).trim() || today; } catch(e){ return today; } };

// the Core Rules as the app has them, dated (the Project checks GW's newer updates against this date)
const core = fs.readFileSync(path.join(ROOT, 'rules/core-rules.md'), 'utf8').replace(/^# (.*)\n/, (m, t) => '# ' + t + ' (copy of ' + gitDate('rules/core-rules.md') + ')\n');
fs.writeFileSync(path.join(__dirname, 'core-rules.md'), core);

// every detachment in BSData with the Force Dispositions it allows
const bf = DISP._byFaction;
const dd = '# Force Dispositions by detachment (from BSData, ' + today + ')\n\n' +
  'Which Force Dispositions each detachment allows, from BSData (the data New Recruit uses). A list can lock any disposition one of its detachments allows. ' +
  'A detachment missing here is newer than this file: look it up and say so.\n\n' +
  Object.keys(bf).sort().map(f => '## ' + f + '\n' + Object.entries(bf[f]).sort(([x], [y]) => x.localeCompare(y)).map(([d, ds]) => '- ' + d + ': ' + ds.join(', ')).join('\n')).join('\n\n') + '\n';
fs.writeFileSync(path.join(__dirname, 'detachment-dispositions.md'), dd);

// the dice-maths skill runs the app's own damage engine: keep its copy the same file; then each skill as a zip to upload
// (Settings → Capabilities → Skills), the skill's folder at the zip's root
fs.copyFileSync(path.join(ROOT, 'calc.js'), path.join(__dirname, 'skills/kodex-dice-maths/scripts/calc.js'));
for(const sk of fs.readdirSync(path.join(__dirname, 'skills')).filter(f => fs.statSync(path.join(__dirname, 'skills', f)).isDirectory())){
  const zip = path.join(__dirname, 'skills', sk + '.zip'); try { fs.unlinkSync(zip); } catch(e){}
  execFileSync('zip', ['-qrX', zip, sk], { cwd:path.join(__dirname, 'skills') });
}
console.log('project/: core-rules.md, detachment-dispositions.md (' + Object.values(bf).reduce((n, x) => n + Object.keys(x).length, 0) + ' detachments), ' +
  fs.readdirSync(path.join(__dirname, 'skills')).filter(f => f.endsWith('.zip')).join(', '));
