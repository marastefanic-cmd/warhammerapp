#!/usr/bin/env node
// project/make.js: writes project/kodex-lists.md, every list in the app as text for the owner's Claude Project
// (the rules chat). It opens the built app in a browser and uses the app's own text of each list (armyText:
// army rules, detachments, enhancements, stratagems, every datasheet, with "already includes" marks), so the
// Project reads exactly what the app shows. Run after `node build.js`: node project/make.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const { serve } = require(path.join(ROOT, 'verify/lib.js'));
const { chromium } = require('playwright');
// the Force Dispositions each detachment allows, from BSData (the game system's Force Disposition group: each disposition is
// hidden unless the roster has its marker, and a detachment's category links name the markers it allows)
const MARKER = { 'ecf8-cf72-7d5b-1b5b':'Disruption', '0936-9767-1cc7-52ae':'Priority Assets', '6fe0-3dbe-f7e0-10bb':'Purge the Foe', '1cc1-f11a-4e8f-1bcc':'Take and Hold', 'b4a7-5083-fe94-4d24':'Reconnaissance' };
const DISP_ORDER = Object.values(MARKER);
function dispositionsByDetachment(){
  // every BSData catalogue (a faction's detachments can sit in its library file), detachments by name
  const out = {}, dir = path.join(ROOT, 'verify/.cache/bsdata');
  const links = (o, acc) => { if(Array.isArray(o)) o.forEach(x => links(x, acc)); else if(o && typeof o === 'object'){ if(MARKER[o.targetId]) acc.add(MARKER[o.targetId]); Object.values(o).forEach(x => links(x, acc)); } return acc; };
  for(const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))){
    let cat; try { cat = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); } catch(e){ continue; }
    const walk = o => { if(Array.isArray(o)) o.forEach(walk); else if(o && typeof o === 'object'){ if(o.name && o.categoryLinks){ const d = links(o.categoryLinks, new Set()); if(d.size){ const k = o.name.toLowerCase(); out[k] = DISP_ORDER.filter(x => d.has(x) || (out[k] || []).includes(x)); } } Object.values(o).forEach(walk); } };
    walk(cat);
  }
  return out;
}
(async () => {
  const DISP = dispositionsByDetachment();
  const site = await serve(ROOT);
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  try {
    const page = await browser.newPage();
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    await page.goto(site.url + 'index.html');
    await page.waitForFunction(() => typeof armyText === 'function' && window.WH_DATA);
    const out = await page.evaluate(DISP => {
      const L = D.armies.map(a => { const f = factionOf(a), dets = detachmentsOf(a), seen = new Set();
        const rows = dets.map(d => { const ds = DISP[d.name.toLowerCase()]; (ds || []).forEach(x => seen.add(x)); return '- ' + d.name + ': ' + (ds ? ds.join(', ') : 'not found in BSData'); });
        const disp = '## Force Dispositions this list can lock (BSData: each detachment allows these)\n' + rows.join('\n') + '\nThis list: ' + ([...seen].join(', ') || 'unknown') + ' (locked for this list: ' + (a.disposition || 'not given') + ')';
        return armyText(a, 'List').replace(/\n\n## Army rules/, '\n\n' + disp + '\n\n## Army rules'); });
      const core = '# Core stratagems\n' + D.coreStratagems.map(s => '- ' + s.name + ' (' + s.cp + 'CP). WHEN: ' + s.when + ' TARGET: ' + s.target + ' EFFECT: ' + s.effect.replace(/\n/g, ' ')).join('\n');
      return { version:D.version, names:D.armies.map(a => a.name + ' (' + factionOf(a).name + ')'), body:L.join('\n\n---\n\n'), core };
    }, DISP);
    const head = '# Kunnin’ Kodex lists (data ' + out.version + ')\n\n' +
      'Every army list in the owner’s Kunnin’ Kodex app, as the app shows it: army rules, detachment rules, enhancements, stratagems and every datasheet. ' +
      'The values are checked against New Recruit, BSData and GW’s rules. A value marked “already includes <rule>” already contains that rule’s bonus: never add it again.\n\n' +
      'Lists: ' + out.names.join(' · ') + '\n\n' + out.core + '\n\n---\n\n';
    fs.writeFileSync(path.join(__dirname, 'kodex-lists.md'), head + out.body + '\n');
    // the dice-maths skill runs the app's own damage engine: keep its copy the same file
    fs.copyFileSync(path.join(ROOT, 'calc.js'), path.join(__dirname, 'skills/kodex-dice-maths/scripts/calc.js'));
    console.log('project/kodex-lists.md: ' + out.names.length + ' lists, data ' + out.version + ', ' + Math.round((head + out.body).length / 1024) + ' KB');
  } finally { await browser.close(); site.close && site.close(); }
})().catch(e => { console.error(e); process.exit(1); });
