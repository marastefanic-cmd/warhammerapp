#!/usr/bin/env node
/* verify/readings.js: the gate step "readings": every ability whose text states a conditional bonus has a reading (docs/tables.md,
   "Readings").

   The readings are the app's interpretations of rule text into numbers and lines (a unit's footnotes, mods; what it gives other
   units, aura; their "When targeted" help, guard; an ability row's own: riled, damaged, defCalc, calcDef). An ability that says
   its unit's attacks get a bonus under a condition ("If this unit is riled up, this unit's ranged attacks have [SUSTAINED HITS 1]")
   is only played by the Damage tab, and only shown under the weapons, through a reading of it. This step reads every ability of
   every list by fixed rules and lists the ones without one:

     riled        the owner's check: a sentence "if / while this unit is riled up, … <bonus>" needs a riled-up reading of that
                  ability on its unit (cond:'riled', or "Riled up" in its when)
     conditional  a sentence that grants a weapon ability ("… have the [LETHAL HITS] ability", "… have [ASSAULT]") or a change to a
                  roll or characteristic of attacks (+1 to hit / wound, re-roll, +N A / S / D / AP: verify/derive.js BONUS_RULES)
                  under a condition (if, while, each time, until, in a phase, after a charge, vs a kind of target) needs a reading
                  of that ability: a footnote, aura or guard line whose from is the ability (or an option it names in bold), a row
                  reading (def, riled, damaged, defCalc, calcDef), or a value it gives marked on a weapon (from)
   A sentence about attacks that target the unit is a defence (its "When targeted" line, def): not checked here. An ability the
   list cannot use (na) is not checked.

   Nothing is filled in: a gap is listed, for the owner to read against GW's text. The gaps known today are in
   verify/readings-gaps.json (each with the ability's words); the step fails on a gap not there, and lists the ones there that a
   reading now covers (remove them).

     node verify/readings.js           the gate step; writes verify/out/readings.md (every gap)
     node verify/readings.js --record  records today's gaps in verify/readings-gaps.json */
'use strict';
const fs = require('fs'), path = require('path');
const { ROOT, loadData, readJSON, writeJSON } = require('./lib');
const { BONUS_RULES } = require('./derive');
const { fp } = require('./tables');

const GAPS = path.join(ROOT, 'verify/readings-gaps.json');
const D = loadData();
const norm = s => String(s == null ? '' : s).replace(/~~/g, '').replace(/[’‘´`]/g, '\'').replace(/[“”]/g, '"').replace(/[‐‑‒–—]/g, '-').replace(/ /g, ' ');
// the words: GW's bold left out, italic notes (an FAQ, a token reminder) left out, one sentence (or list line) at a time; a line
// ending in ":" is read with each of its list lines ("this unit's ranged attacks have:\n- If this unit is riled up, [SUSTAINED HITS 1].")
function sentences(text){
  const lines = norm(text).split('\n').filter(l => !/^\*(?!\*)[^\n]*\*$/.test(l.trim())).map(l => l.replace(/\*\*/g, '').replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
  const out = [];
  for(let i = 0; i < lines.length; i++){
    const parts = lines[i].replace(/^- /, '').split(/(?<=[.!?])\s+(?=[A-Z(])/);
    const lead = /:$/.test(lines[i]) ? lines[i] : null;
    if(lead){ let j = i + 1; for(; j < lines.length && /^- /.test(lines[j]); j++) out.push(lead + ' ' + lines[j].replace(/^- /, '')); if(j > i + 1){ i = j - 1; continue; } }
    out.push(...parts);
  }
  return out;
}
const RILED = /\b(?:if|while) (?:this|that|the) (?:unit|model) is riled up\b|\briled up\b/i;
const CONDITION = /\b(?:if|while|whilst|each time|every time|until|unless|after|when)\b|\b(?:in|during) (?:your|the|your opponent's) (?:command|movement|shooting|charge|fight) phase\b|\bthat targets?\b|\bmade a charge move\b|\bwithin \d+"/i;
const GRANT_KW = /\b(?:ha(?:s|ve)|gains?)\b(?: the)?(?:[^.]*?)\[[A-Z][A-Z0-9 +\-"]*\]/;
const DEFENCE = /\b(?:an attack|attacks|a ranged attack|a melee attack)\b[^.]*?\btargets? (?:this|the bearer|it|that unit|your unit)\b|\btargeted\b|\bfeel no pain\b|\binvulnerable save\b|\ballocated\b/i;
function bonusOf(s){
  const out = BONUS_RULES.filter(b => b.re.test(s) && !/^hit-1$/.test(b.id)).map(b => b.id);
  if(GRANT_KW.test(s)) out.push('weapon-ability');
  return [...new Set(out)];
}
// what of the unit reads this ability: its readings (from the ability or an option it names in bold), its row's own, a marked value
function readingsOf(u, ab){
  const named = m => m.from === ab.name || String(ab.text || '').includes('**' + m.from);
  const rs = ['mods', 'aura', 'guard'].flatMap(k => (u[k] || []).filter(named));
  const row = ['def', 'riled', 'damaged', 'defCalc', 'calcDef', 'defAlways'].filter(k => ab[k] !== undefined);
  const marked = [...(u.stats || []), ...(u.ranged || []), ...(u.melee || [])].some(x => Object.values(x.from || {}).some(v => [].concat(v).includes(ab.name)));
  return { rs, row, marked };
}
function gapsOf(){
  const out = new Map();   // key -> gap
  for(const a of D.armies) for(const u of a.units) for(const ab of u.abilities || []){
    if(ab.na) continue;
    const r = readingsOf(u, ab), any = r.rs.length || r.row.length || r.marked;
    for(const s of sentences(ab.text)){
      if(DEFENCE.test(s)) continue;
      const bonus = bonusOf(s);
      if(!bonus.length) continue;
      let check = null;
      if(RILED.test(s)){ if(!r.rs.some(m => m.cond === 'riled' || /riled/i.test((m.when || '') + ' ' + (m.selfWhen || '')))) check = 'riled'; }
      else if(CONDITION.test(s) && !any) check = 'conditional';
      if(!check) continue;
      const key = check + '|' + ab.name + '|' + fp(ab.text) + '|' + fp(s);
      if(!out.has(key)) out.set(key, { check, ability:ab.name, sentence:s, bonus, text:ab.text, units:[] });
      out.get(key).units.push(a.id + '/' + u.id);
    }
  }
  return out;
}

if(require.main === module){
  const gaps = gapsOf(), known = readJSON(GAPS, {});
  if(process.argv.includes('--record')){
    writeJSON(GAPS, { _about:'Abilities whose text states a conditional bonus with no reading on their units (verify/readings.js): known gaps, for the owner to read against GW\'s text and give a reading or declare none needed. Not filled in by the tools. Keyed by check, ability, and the fingerprints of its text and of the sentence.',
      ...Object.fromEntries([...gaps.entries()].map(([k, g]) => [k, { check:g.check, ability:g.ability, sentence:g.sentence, bonus:g.bonus, units:g.units }])) });
    console.log('readings: ' + gaps.size + ' gaps recorded in verify/readings-gaps.json');
    process.exit(0);
  }
  const fresh = [...gaps.keys()].filter(k => !known[k]), gone = Object.keys(known).filter(k => k !== '_about' && !gaps.has(k));
  const by = c => [...gaps.values()].filter(g => g.check === c);
  const md = ['# Readings: abilities with a conditional bonus and no reading', '', 'verify/readings.js. Nothing is filled in: each is for the owner to read against GW\'s text (and give a reading, or declare none is needed).', ''];
  for(const c of ['riled', 'conditional']){
    md.push('## ' + (c === 'riled' ? 'Riled up, with no riled-up reading' : 'A bonus under a condition, with no reading of the ability') + ' (' + by(c).length + ')', '');
    for(const g of by(c)) md.push('- **' + g.ability + '** (' + g.bonus.join(', ') + '): “' + g.sentence + '” · ' + [...new Set(g.units)].join(', '));
    md.push('');
  }
  fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive:true }); fs.writeFileSync(path.join(ROOT, 'verify/out/readings.md'), md.join('\n'));
  console.log('readings: ' + (fresh.length ? fresh.length + ' new gap(s); ' : '') + gaps.size + ' abilities with a conditional bonus and no reading (' + by('riled').length + ' riled up, ' + by('conditional').length + ' other; listed in verify/out/readings.md, known in verify/readings-gaps.json)' + (gone.length ? '; ' + gone.length + ' known gap(s) now read (remove them from verify/readings-gaps.json)' : ''));
  for(const k of fresh){ const g = gaps.get(k); console.log('  NEW GAP ' + g.check + ' · ' + g.ability + ' (' + g.units.join(', ') + '): “' + g.sentence + '”: give it a reading, or record it (node verify/readings.js --record) for the owner'); }
  process.exit(fresh.length ? 1 : 0);
}
module.exports = { gapsOf, sentences };
