// ISOLATION (verify/reader2/, release tooling of the two-reader rule, verify/agree.js): this reader must never import the app's reading
// code (verify/effects-extract.js, effects-migrate.js, coverage.js, evidence.js, lines.js, defence.js, derive.js) nor read data.js BOXES.
// The gate step agree fails if it does (check R1). Its code is kept as it was written (scratchpad reader2, round 4); run it with
// KODEX_APP=<this repo> KODEX_CACHE=<this repo>/verify/.cache, as the gate does.
// sources.js: lists the rule sources the app uses (text fields, names and keywords only).
// Reads data.js in node; touches only: datasheets[].{name,kw,abilities[].{name,tag,who,text}},
// armies[].units[].{id,ds,name,abilities[].{name,tag,who,text}}, factions[].{armyRules,detachments[].{rule,moreRules,enhancements,stratagems}}
// (name/tag/text/when/target/effect/restrictions), coreStratagems. Never BOXES, GRANTS, CHECKLIST, gist*, readOf, or derived columns.
'use strict';
const fs = require('fs'), path = require('path');
const APP = process.env.KODEX_APP || '/home/user/warhammerapp';

function loadData(){
  const src = fs.readFileSync(path.join(APP, 'data.js'), 'utf8');
  const sandbox = {};
  const fn = new Function('window', 'self', src + '\n;return window.WH_DATA;');
  return fn(sandbox, sandbox);
}

const squash = t => String(t || '').replace(/\*\*|~~/g, '').replace(/[^A-Za-z0-9+"]+/g, ' ').trim().toLowerCase();
const same = (a, b) => a != null && squash(a) === squash(b);
const strip = t => String(t == null ? '' : t);

function listSources(){
  const D = loadData();
  const out = [];
  const push = s => { if(s.text && s.text.trim()) out.push(s); };
  // datasheets
  for(const [key, d] of Object.entries(D.datasheets)){
    for(const a of d.abilities || []) push({ kind:'ability', owner:'ds:' + key, ownerName:d.name, faction:d.faction, kw:d.kw || [], name:a.name, tag:a.tag || '', who:a.who || '', text:strip(a.text) });
  }
  // army list units: only abilities whose text is not the datasheet's own ability of that name
  // (resolved list units carry no datasheet id: an ability is the datasheet's own when some datasheet has it, same name and words)
  const onSheet = new Set();
  for(const d of Object.values(D.datasheets)) for(const x of d.abilities || []) onSheet.add(x.name + '|' + squash(x.text));
  const seen = new Set();
  for(const a of D.armies){
    for(const u of a.units){
      for(const x of u.abilities || []){
        if(!x.text || onSheet.has(x.name + '|' + squash(x.text))) continue;
        const k = a.id + '|' + u.id + '|' + x.name; if(seen.has(k)) continue; seen.add(k);
        push({ kind:'unitAbility', owner:'army:' + a.id + '/' + u.id, ownerName:u.name, faction:a.faction, kw:u.kw || [], name:x.name, tag:x.tag || '', who:x.who || '', text:strip(x.text) });
      }
    }
  }
  for(const [fid, f] of Object.entries(D.factions)){
    for(const r of f.armyRules || []) push({ kind:'armyRule', owner:'faction:' + fid, ownerName:f.name, faction:fid, name:r.name, tag:r.tag || '', text:strip(r.text) });
    for(const [did, det] of Object.entries(f.detachments || {})){
      const o = 'det:' + fid + '/' + did;
      if(det.rule) push({ kind:'detachmentRule', owner:o, ownerName:det.name, faction:fid, name:det.rule.name, tag:det.rule.tag || '', text:strip(det.rule.text) });
      for(const r of det.moreRules || []) push({ kind:'detachmentRule', owner:o, ownerName:det.name, faction:fid, name:r.name, tag:r.tag || '', text:strip(r.text) });
      for(const e of det.enhancements || []) push({ kind:'enhancement', owner:o, ownerName:det.name, faction:fid, name:e.name, text:strip(e.text) });
      for(const s of det.stratagems || []) push({ kind:'stratagem', owner:o, ownerName:det.name, faction:fid, name:s.name, when:strip(s.when), target:strip(s.target), restrictions:strip(s.restrictions), text:strip(s.effect) });
    }
  }
  // rule tables: each row of an army / detachment rule's table is a source of its own, with the rule's words as context
  const rows = (owner, ownerName, fid, r) => (r.table || []).forEach(([label, cell], n) => {
    const row = { kind:'tableRow', owner, ownerName, faction:fid, name:r.name + ' › ' + strip(label), parent:r.name, parentText:strip(r.text), rowLabel:strip(label), rowIndex:n, tableAt:r.tableAt == null ? null : r.tableAt, text:strip(cell) };
    // a row written as a stratagem-style ability (Martial Ka'tah): WHEN / TARGET / EFFECT
    const m = /\*\*WHEN:\*\*\s*([^\n]*)\n\*\*TARGET:\*\*\s*([^\n]*)\n\*\*EFFECT:\*\*\s*([\s\S]*)$/.exec(row.text);
    if(m){ row.when = m[1]; row.target = m[2]; row.text = m[3]; }
    push(row);
  });
  for(const [fid, f] of Object.entries(D.factions)){
    for(const r of f.armyRules || []) rows('faction:' + fid, f.name, fid, r);
    for(const [did, det] of Object.entries(f.detachments || {})) for(const r of [det.rule].concat(det.moreRules || [])) if(r) rows('det:' + fid + '/' + did, det.name, fid, r);
  }
  for(const s of D.coreStratagems || []) push({ kind:'stratagem', owner:'core', ownerName:'Core Stratagems', faction:'core', name:s.name, when:strip(s.when), target:strip(s.target), restrictions:strip(s.restrictions), text:strip(s.effect) });
  return out;
}

// every keyword printed on a datasheet (names and keywords only), upper case: lets the reader tell
// "WORLD EATERS" (one keyword) from "TYRANIDS MONSTER" (two)
function listKeywords(){
  const D = loadData(), set = new Set();
  for(const d of Object.values(D.datasheets)) for(const k of d.kw || []) set.add(String(k).replace(/^Faction: /, '').toUpperCase());
  for(const a of D.armies) for(const u of a.units) for(const k of u.kw || []) set.add(String(k).replace(/^Faction: /, '').toUpperCase());
  return [...set].sort();
}
module.exports = { listSources, listKeywords };
if(require.main === module){
  const s = listSources();
  const by = {}; s.forEach(x => { by[x.kind] = (by[x.kind] || 0) + 1; });
  console.log(s.length, by);
}
