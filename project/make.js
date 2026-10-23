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
// the Force Dispositions each detachment allows, from BSData (verify/dispositions.js, which also checks data.js against them)
const dispositionsByDetachment = () => { const r = require(path.join(ROOT, 'verify/dispositions.js')).byDetachment(); return Object.assign(r.out, { _byFaction:r.byFaction }); };
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
  // fixed file times, so a zip changes only when its files do
  const pin = d => { for(const f of fs.readdirSync(d)){ const p = path.join(d, f); if(fs.statSync(p).isDirectory()) pin(p); fs.utimesSync(p, 1767225600, 1767225600); } }; pin(path.join(__dirname, 'skills', sk));
  execFileSync('zip', ['-qrX', zip, sk], { cwd:path.join(__dirname, 'skills') });
}
console.log('project/: core-rules.md, detachment-dispositions.md (' + Object.values(bf).reduce((n, x) => n + Object.keys(x).length, 0) + ' detachments), ' +
  fs.readdirSync(path.join(__dirname, 'skills')).filter(f => f.endsWith('.zip')).join(', '));
