#!/usr/bin/env node
/* verify/readings.js: the gate step "readings": every ability whose text states a conditional bonus has a reading (docs/tables.md,
   "Readings").

   The readings are the app's interpretations of rule text into numbers and lines (a unit's footnotes, mods; what it gives other
   units, aura; their "When targeted" help, guard; an ability row's own: def, riled, damaged, defCalc, calcDef). An ability whose
   words give a bonus is only played by the Damage tab, and only shown, through a reading of it. This step reads every ability of
   every list by fixed rules, sentence by sentence (a list line with the line that leads it; a condition said earlier in the same
   paragraph counts for the sentences after it), and each bonus a sentence states must be said by a reading of that ability
   (Warden's Duty's [SUSTAINED HITS 1] and [IGNORES COVER] are two):

     riled        the owner's check: a sentence "if / while this unit is riled up, … <bonus>" needs a riled-up reading of that
                  ability saying that bonus (cond:'riled', or "Riled up" in its when)
     conditional  an attack bonus under a condition: a weapon ability granted (in brackets or not, in any case: "the Lethal Hits
                  ability"), +1 to hit / wound (with or without "rolls"), a re-roll, a Critical Hit on N+, +N A / S / D / AP, "gains
                  +N Strength", "has a Strength characteristic of N" (ATTACK); the condition: if, while, each time, until, after,
                  when, once it has, in / at the start of a phase, that targets, against X units, within N", on a turn, for every,
                  during the battle round in which, select one. Said by a footnote, aura, guard or row reading of the ability (or
                  of an option it names in bold), or a value it gives marked on a weapon (from)
     defence      what protects the unit, or the unit it is given to: Feel No Pain, an invulnerable save, -1 Damage to an attack
                  allocated to it, Damage 0, -1 to hit / wound or worse AP against attacks that target it (DEFENCE). Said by its
                  "When targeted" readings: def, calcDef, defCalc, a guard line, the Feel No Pain on its Rules line, a marked InSv.
                  "An attack that targets this unit's …", "the bearer's …", "allocated to an enemy model" are not defences.
   Also read: a qualified bracket ("[LETHAL HITS: non-MONSTER/VEHICLE]") or a bare one after have / has ("have Sustained Hits 1"),
   "improve the Strength / AP / Damage", "+1 Damage", a re-roll of the Damage roll; defences "-1 D", "-1 AP" or "worsen the AP" on
   attacks that target it, "has 4+ InSv", "subtract 1 from the Damage" (of an attack allocated to or made against it), "subtract 1
   from that attack's Hit roll", Stealth granted, "+1 to save rolls", and an enemy unit's -1 to hit. A bonus to a roll (hit, wound,
   re-roll, Critical Hit) needs a reading with no condition too: no weapon value shows it. An earlier sentence's condition counts
   only for a sentence that refers back to it ("If it does", "that unit", "those weapons", "Until …"); an enemy's re-roll, or one
   the rule forbids ("cannot re-roll"), is no bonus of the unit.
   An ability the list cannot use (na), or an option for a keyword the unit does not have ("If this model has the TZEENTCH
   keyword" on a Daemon Prince of Khorne), is not checked.

   Nothing is filled in: a gap is listed, for the owner to read against GW's text. The gaps known today are in
   verify/readings-gaps.json (each with the ability's words); the step fails on a gap not there, and lists the ones there that a
   reading now covers (remove them). One that is no numeric bonus after all is kept there as status:'not-applicable' with its why
   (verify/helpers.js lists it for sign-off, reading-not-applicable): it passes, and --record keeps it.

     node verify/readings.js           the gate step; writes verify/out/readings.md (every gap)
     node verify/readings.js --record  records today's gaps in verify/readings-gaps.json */
'use strict';
const fs = require('fs'), path = require('path');
const { ROOT, loadData, readJSON, writeJSON } = require('./lib');
const { fp } = require('./tables');

const GAPS = path.join(ROOT, 'verify/readings-gaps.json');
const D = loadData();
const norm = s => String(s == null ? '' : s).replace(/~~/g, '').replace(/[’‘´`]/g, '\'').replace(/[“”]/g, '"').replace(/[‐‑‒–—]/g, '-').replace(/ /g, ' ');
// the words: GW's bold left out, italic notes (an FAQ, a token reminder) left out, one sentence (or list line) at a time; a line
// ending in ":" is read with each of its list lines ("this unit's ranged attacks have:\n- If this unit is riled up, [SUSTAINED HITS 1].")
function sentences(text){ return sentenceCtx(text).map(x => x.s); }
// each sentence with what comes before it in its paragraph (a condition said once for the sentences after it: "At the start of the
// Fight phase, select one enemy unit. Melee weapons … have [PRECISION].")
function sentenceCtx(text){
  const lines = norm(text).split('\n').filter(l => !/^\*(?!\*)[^\n]*\*$/.test(l.trim())).map(l => l.replace(/\*\*/g, '').replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
  const out = [];
  let para = '';   // the paragraph a list line comes under (Battle Protocols: "In your Command phase, … select one protocol …", then "- Protector Protocol: … in that unit.")
  for(let i = 0; i < lines.length; i++){
    const lead = /:$/.test(lines[i]) ? lines[i] : null;
    if(lead){ let j = i + 1; for(; j < lines.length && /^- /.test(lines[j]); j++) out.push({ s:lead + ' ' + lines[j].replace(/^- /, ''), pre:lead }); if(j > i + 1){ i = j - 1; continue; } }
    const item = /^- /.test(lines[i]), base = item ? para : '';
    const parts = lines[i].replace(/^- /, '').split(/(?<=[.!?])\s+(?=[A-Z(])/);
    parts.forEach((p, k) => out.push({ s:p, pre:[base, ...parts.slice(0, k)].filter(Boolean).join(' ') }));
    if(!item) para = lines[i];
  }
  return out;
}
const RILED = /\b(?:if|while) (?:this|that|the) (?:unit|model) is riled up\b|\briled up\b/i;
// a condition: if, while, each time, until, after, when, in / at the start of a phase, vs a kind of target, once it has destroyed, on a
// turn …, for every …, during the battle round in which …, within a range, after a charge
const CONDITION = new RegExp([
  '\\b(?:if|while|whilst|each time|every time|until|unless|after|when|whenever|once it has|once this (?:unit|model) has|once per (?:battle|turn|phase))\\b',
  '\\b(?:in|during|at the start of|at the end of) (?:your |the |your opponent\'s |each |either player\'s )?(?:command|movement|shooting|charge|fight) phase\\b',
  '\\bthat targets?\\b', '\\bagainst [A-Z]', '\\bagainst (?:an? |the )?[a-z]+ (?:units?|models?)\\b', '\\bmade a charge move\\b', '\\bwithin \\d+"', '\\b(?:on a|this|that) (?:turn|phase)\\b',
  '\\bfor (?:every|each) \\b', '\\bduring the battle round in which\\b', '\\bselect(?:s|ed)? (?:one|a)\\b'].join('|'), 'i');
const WA = 'lethal hits|sustained hits (?:\\d+|d3|d6)|devastating wounds|ignores cover|lance|assault|precision|twin-linked|heavy|blast|torrent|melta (?:\\d+|d3|d6)|rapid fire (?:\\d+|d3|d6)|anti-[a-z -]+ \\d\\+|(?<!-)hazardous|indirect fire|pistol|extra attacks|cleave \\d+';
// in brackets (a qualified one too: "[LETHAL HITS: non-MONSTER/VEHICLE]"), named as an ability ("the Lethal Hits ability"), or bare
// after have / has / gain ("have Sustained Hits 1")
const WA_RE = new RegExp('\\[(' + WA + ')(?::[^\\]]*)?\\]|\\b(?:the )?(' + WA + ')(?:\\]| abilit(?:y|ies)\\b| and (?:the )?\\[?(?:' + WA + ')\\]? abilities\\b)|\\b(?:ha(?:s|ve)|gains?) (?:the )?(' + WA + ')\\b', 'gi');
// a sentence that refers back to the one before it ("If it does, …", "That unit …", "those weapons"): that one's condition is its
// condition; an unrelated earlier sentence is not
const BACK = /^(?:if (?:it|you|they) do(?:es)?\b|that\b|those\b|its?\b|they\b|their\b|the selected\b|until\b)|\bthat (?:enemy )?(?:unit|model|weapon)s?\b|\bthose (?:weapons|attacks|models|units)\b|\bthe selected\b|\b(?:this|that) (?:phase|turn)\b/i;
const GRANT = /\b(?:ha(?:s|ve)|gains?|gets?)\b/i;
// an attack bonus in the words → how a reading of it says it (its note, when, set, calc)
const ATTACK = [
  { id:'hit+1',      re:/\+1 to (?:the |its )?hit\b|add (?:1|one) to the hit\b|\+1 (?:ws|bs)\b|improve the (?:ballistic|weapon) skill characteristic[^.]*? by (?:1|one)\b/i, said:/\+1 to hit|BS improved|WS improved|"hit":1/i },
  { id:'wound+1',    re:/\+1 to (?:the |its )?(?:hit (?:and|or) )?wound\b|add (?:1|one) to the (?:hit (?:and|or) )?wound\b/i, said:/\+1 to (?:hit (?:and|or) )?wound|"wound":1/i },
  { id:'rr-hit',     re:/re-roll (?:a |the |one )?hit rolls?\b|re-roll the hit roll/i, said:/re-roll[^|]*?hit|rrHit/i },
  { id:'rr-wound',   re:/re-roll (?:a |the |one )?(?:hit rolls? (?:and|or) (?:the |a |one )?)?wound rolls?\b/i, said:/re-roll[^|]*?wound|rrWound/i },
  { id:'crit',       re:/critical hit (?:is scored )?on (?:an unmodified )?(?:hit roll of )?\d\+|unmodified (?:successful )?hit roll of \d\+[^.]*?critical hit|scores? a critical hit/i, said:/critical hit|critHit/i },
  { id:'a+',         re:/\+\d+ (?:a|attacks)\b|add (?:\d+|d3|one|two) to the attacks|improve the attacks characteristic|attacks characteristic of \d+/i, said:/\+(?:\d+|D3) A\b|"A":"?[+\d]|\battacks? \+\d|\+\d+ attacks\b/i },
  { id:'s+',         re:/\+\d+ (?:(?:a|attacks|ws|bs),? (?:and )?)*(?:s|strength)\b|add (?:\d+|d3|one|two) to the (?:attacks,? )?(?:and )?strength|strength characteristic of \d+|gains? \+\d+ strength|improve the strength/i, said:/\+(?:\d+|D3) S\b|"S":"?[+\d]|strength (?:\+|of )?\d|improve (?:[A-Z]+,? (?:and )?)*S\b[^|]*? by \d/i },
  { id:'ap',         re:/\+\d+ (?:(?:a|s|ws|bs|attacks|strength),? (?:and )?)*ap\b|improve the (?:[a-z]+,? )*(?:and )?armou?r penetration|improve the ap\b|an armou?r penetration (?:characteristic )?of -\d/i, said:/\bAP\b/i },
  { id:'rr-dmg',     re:/re-roll (?:the |a |one )?damage rolls?/i, said:/re-roll[^|]*?damage|rrDmg|rrDamage/i },
  { id:'d+',         re:/\+\d+ (?:(?:a|s|ap|ws|bs|attacks|strength),? (?:and )?)*(?:d|damage)\b|improve the damage characteristic|improve the (?:[a-z]+,? )*(?:and )?damage characteristics?|add (?:\d+|one) to the (?:[a-z]+,? )*(?:and )?damage characteristics?|ha(?:s|ve) a damage characteristic of \d/i, said:/\+(?:\d+|D3) D\b|"D":"?[+\d]|damage \+\d|\+\d damage\b|improve (?:[A-Z]+,? (?:and )?)*D\b[^|]*? by \d/i },
  { id:'hit-1',      re:/this model makes an attack, subtract 1 from the hit roll/i, said:/-1 to hit/i },
];
// a defence: what protects the unit (or the unit it is given to) when it is attacked → its "When targeted" line (def, guard)
const SELF = '(?:this (?:unit|model)|the bearer|that (?:unit|model|armiger model)|it|a model in (?:this|that) unit|your unit)(?![\'’]s)\\b';
const DEFENCE = [
  { id:'fnp',      re:/feel no pain \d\+/i, said:/feel no pain|FNP|"fnp"/i },
  { id:'invuln',   re:/\d\+\*? ?(?:invulnerable save|insv)\b/i, said:/invulnerable|InSv|\bINV\b/i },
  { id:'sv-set',   re:/\b(?:has|have) an? save characteristic of \d\+/i, said:/\b\d\+ (?:save|Sv)\b|\bSv\b|save characteristic|"sv"/i },
  { id:'s-vs',     re:new RegExp('(?:targets? ' + SELF + '|allocated to ' + SELF + ')[^.]*?(?:-1 strength\\b|subtract 1 from the strength characteristic)', 'i'), said:/-1 S\b|-1 Strength/i },
  { id:'save+1',   re:/\+1 to (?:armou?r )?sav(?:e|ing) (?:rolls?|throws?)|add (?:1|one) to (?:the |its |any |an )?(?:armou?r )?sav(?:e|ing) (?:rolls?|throws?)/i, said:/\+1 to (?:armou?r )?sav|\bsave\b|"sv"/i },
  { id:'stealth',  re:/\b(?:has|have|gains?) (?:the )?(?:stealth|benefit of cover)\b/i, said:/stealth|"stealth"|benefit of cover/i },
  { id:'dmg-1',    re:new RegExp('(?:allocated to ' + SELF + '|made against (?:' + SELF + '|this [A-Z]+\\b)|attacks? (?:that )?targets? ' + SELF + '|attacks? allocated to ' + SELF + '|targets? a friendly [^.,]*?(?:unit|model)\\b)[^.]*?(?:subtract 1 from the damage|reduce the damage characteristic[^.]*? by 1\\b|-1 d\\b|-1 damage\\b)', 'i'), said:/-1 D\b|-1 Damage|damage/i },
  { id:'dmg-half', re:new RegExp('(?:allocated to ' + SELF + '|made against ' + SELF + '|targets? ' + SELF + ')[^.]*?halve the damage', 'i'), said:/halve|half/i },
  { id:'dmg-0',    re:/change the damage characteristic of that attack to 0/i, said:/damage[^|]* to 0|"dmg":0/i },
  { id:'hit-vs',   re:new RegExp('(?:an attack|attacks|a ranged attack|a melee attack|ranged attacks|melee attacks)(?: that)? (?:targets? |(?:is|are) made against )' + SELF + '[^.]*?(?:subtract 1 from (?:the|that attack[\\u2019\\x27]s) hit roll|-1 to hit)', 'i'), said:/-1 to (?:the )?hit/i },
  // an enemy unit's attacks made worse (Reorder Reality, Mischief Makers): a defence of the units it attacks
  { id:'enemy-hit-1', re:/\benemy (?:unit|model)s?\b[^.]*?(?:subtract 1 from (?:the|that attack[’']s) hit roll|-1 to hit)|(?:subtract 1 from (?:the|that attack[’']s) hit roll|-1 to hit)[^.]*?\benemy (?:unit|model)/i, said:/-1 to (?:the )?hit/i },
  { id:'wound-vs', re:new RegExp('(?:an attack|attacks|a ranged attack|a melee attack|ranged attacks|melee attacks)(?: that)? (?:targets? |(?:is|are) made against )' + SELF + '[^.]*?(?:subtract 1 from the wound roll|-1 to wound)', 'i'), said:/-1 to (?:the )?wound/i },
  { id:'ap-worse', re:new RegExp('targets? ' + SELF + '[^.]*?(?:worsen the (?:armou?r penetration|ap)\\b|-1 ap\\b)', 'i'), said:/-1 AP|worsen the AP|\bAP\b/i },
  { id:'t+',       re:/\b(?:add (?:1|one) to (?:the |its |this model[’']s |the bearer[’']s )?toughness characteristic|\+1 (?:t|toughness)\b)/i, said:/toughness|\+1 T\b|\| T\b/i },
];
// the bonuses to a roll (no weapon value shows them): hit and wound modifiers, re-rolls, Critical Hits
const ROLLS = ['hit+1', 'wound+1', 'rr-hit', 'rr-wound', 'rr-dmg', 'crit'];
function bonusOf(s){
  const def = DEFENCE.filter(b => b.re.test(s)).map(b => b.id);
  // (a re-roll that is the enemy's, or one forbidden, is no bonus of the unit: "your opponent can re-roll", "cannot re-roll"; clause by
  // clause, so the unit's own re-roll in the same sentence still counts: "You can re-roll Hit rolls for this unit, and enemy units cannot …")
  const ownRr = s.split(/[,;]/).filter(c => !/\b(?:cannot|can't|can ?not) re-roll\b/i.test(c) && !(/\b(?:enemy (?:unit|model|player)s?|your opponent)\b[^.]*?\bcan re-roll\b/i.test(c) && !/\b(?:you|this (?:unit|model)) can re-roll\b/i.test(c))).join(',');
  let att = ATTACK.filter(b => b.re.test(/^rr-/.test(b.id) ? ownRr : s)).map(b => b.id);
  // (the enemy's -1 to hit is the defence above, not this unit's own -1: Damaged)
  if(def.includes('enemy-hit-1')) att = att.filter(id => id !== 'hit-1');
  // (the enemy's +1 to its attacks on this unit is a drawback, not this unit's bonus: "Each time an attack targets this unit, add 1 to
  // the Hit roll"; not when a model of this unit or a friendly one makes the attack, at "that unit")
  if(/\b(?:an attack|attacks|an? (?:ranged|melee) attack|(?:ranged|melee) attacks)(?: that)? targets? (?:this (?:unit|model)|the bearer)(?![’']s)\b/i.test(s) && !/\b(?<!enemy )(?:unit|model)s? (?:[^.,;]*? )?makes? an? (?:ranged |melee )?attack\b/i.test(s)) att = att.filter(id => id !== 'hit+1' && id !== 'wound+1');
  // (an ability a unit loses or that does not apply is no grant: "if it has the Lethal Hits ability, that ability does not apply"; clause by
  // clause, so the unit's own grant in the same sentence still counts: "… cannot use the Feel No Pain ability, and this unit's weapons have …")
  const NOAPPLY = /\b(?:that|those|the) abilit(?:y|ies) (?:does|do) not apply\b/i, LOST = /\b(?:loses?|lost|cannot use|can't use) (?:the |this |that |its |all |any )?[^.,;]{0,30}?\babilit/i;
  const cl = s.split(/[,;](?![^\[\]]*\])/);   // (not a comma inside a bracket: "[LETHAL HITS: non-MONSTER, non-VEHICLE]")
  if(GRANT.test(s)) cl.forEach((c, i) => { if(LOST.test(c) || NOAPPLY.test(c) || NOAPPLY.test(cl[i + 1] || '')) return;
    for(const m of c.matchAll(WA_RE)){ const n = (m[1] || m[2] || m[3] || '').toLowerCase().replace(/ (?:\d+|d3|d6|\d\+)$/, ''); if(n) att.push('wa:' + n); } });
  return { def:[...new Set(def)], att:[...new Set(att)] };
}
// what of the unit reads this ability: its readings (from the ability or an option it names in bold), its row's own, a marked value
function readingsOfUnit(u, ab){
  const named = m => m.from === ab.name || String(ab.text || '').includes('**' + m.from);
  const attack = ['mods', 'aura'].flatMap(k => (u[k] || []).filter(named)), guard = (u.guard || []).filter(named);
  const words = ms => ms.map(m => [m.note, m.when, m.selfWhen, JSON.stringify(m.set || {}), JSON.stringify(m.calc || {})].join(' ')).join(' | ');
  const marks = [...(u.stats || []), ...(u.ranged || []), ...(u.melee || [])].flatMap(x => Object.entries(x.from || {}).filter(([, v]) => [].concat(v).includes(ab.name)).map(([k]) => k));
  const fnpLine = (u.rules || []).filter(r => /^feel no pain \d\+/i.test(r) && String(ab.text || '').toLowerCase().includes(r.toLowerCase().replace(/\*$/, '')));
  return { attack, guard, marks,
    attackSaid:words(attack) + ' | ' + marks.map(k => /^(A|S|D)$/.test(k) ? '"' + k + '":"+' : k === 'AP' ? '+1 AP' : k === 'WS' || k === 'BS' ? k + ' improved' : k).join(' | ') + ' | ' + JSON.stringify(ab.defCalc || {}),
    defSaid:[ab.def, ab.calcDef, JSON.stringify(ab.defCalc || {}), words(guard), fnpLine.join(' '), marks.includes('InSv') ? 'InSv' : ''].filter(Boolean).join(' | ') };
}
// a gap: a sentence stating a bonus (an attack's under a condition, or a defence) that no reading of the ability says; per sentence and
// per bonus (Warden's Duty's [SUSTAINED HITS 1] and [IGNORES COVER] are two)
function gapsOf(){
  const out = new Map();   // key -> gap
  for(const a of D.armies) for(const u of a.units) for(const ab of u.abilities || []) for(const g of abilityGaps(u, ab)){
    const key = g.check + '|' + ab.name + '|' + fp(ab.text) + '|' + fp(g.sentence);
    if(!out.has(key)) out.set(key, Object.assign(g, { ability:ab.name, text:ab.text, units:[] }));
    out.get(key).units.push(a.id + '/' + u.id);
  }
  return out;
}
// one ability of one unit: each sentence stating a bonus that no reading of the ability says
function abilityGaps(u, ab){
  const found = [];
  if(ab.na) return found;
  const r = readingsOfUnit(u, ab), all = r.attackSaid + ' | ' + r.defSaid;
  const hasKw = k => (u.kw || []).some(x => x.toLowerCase() === k.toLowerCase() || x.toLowerCase() === 'faction: ' + k.toLowerCase());
  for(const { s, pre } of sentenceCtx(ab.text)){
    // (an option for a keyword the unit does not have: "If this model has the TZEENTCH keyword" on a Daemon Prince of Khorne)
    const kwIf = /\b[Ii]f this (?:model|unit) has the ([A-Z][A-Z’' -]+?) keyword/.exec(s);
    if(kwIf && !hasKw(kwIf[1].trim())) continue;
    const b = bonusOf(s), miss = [];
    let check = null;
    if(b.att.length && RILED.test(s)){
      const rl = r.attack.filter(m => m.cond === 'riled' || /riled/i.test((m.when || '') + ' ' + (m.selfWhen || '')));
      const said = rl.map(m => [m.note, JSON.stringify(m.set || {}), JSON.stringify(m.calc || {})].join(' ')).join(' | ');
      for(const id of b.att) if(!rl.length || !covers(id, said, ATTACK)) miss.push(id);
      if(miss.length) check = 'riled';
    } else if(b.att.length && (CONDITION.test(s) || ((BACK.test(s) || /\b(?:can|may) use this ability\b|\bselect(?:s|ed)? one\b/i.test(pre)) && CONDITION.test(pre)))){
      for(const id of b.att) if(!covers(id, all, ATTACK)) miss.push(id);
      if(miss.length) check = 'conditional';
    } else if(b.att.some(id => ROLLS.includes(id))){
      // (with no condition: a weapon ability or a characteristic is marked on the weapons; a roll's bonus cannot be, it needs a reading)
      for(const id of b.att.filter(id => ROLLS.includes(id))) if(!covers(id, all, ATTACK)) miss.push(id);
      if(miss.length) check = 'conditional';
    }
    // (a defence is said by a "When targeted" reading, not by an attack footnote that happens to say "damage" or "AP")
    const dmiss = b.def.filter(id => !covers(id, r.defSaid + ' | ' + r.marks.join(' | '), DEFENCE));
    if(dmiss.length){ check = check || 'defence'; miss.push(...dmiss); }
    if(check) found.push({ check, sentence:s, bonus:[...new Set(miss)] });
  }
  return found;
}
function covers(id, said, table){
  if(id.startsWith('wa:')) return new RegExp(id.slice(3).replace(/[-]/g, '[- ]'), 'i').test(said);
  const b = table.find(x => x.id === id); return !!b && b.said.test(said);
}

// the gate step (and --record)
if(require.main === module){
  const gaps = gapsOf(), known = readJSON(GAPS, {});
  if(process.argv.includes('--record')){
    writeJSON(GAPS, { _about:'Abilities whose text states a conditional bonus with no reading on their units (verify/readings.js): known gaps, for the owner to read against GW\'s text and give a reading or declare none needed. Not filled in by the tools. Keyed by check, ability, and the fingerprints of its text and of the sentence.',
      ...Object.fromEntries([...gaps.entries()].map(([k, g]) => [k, known[k] && known[k].status === 'not-applicable' ? known[k] : { check:g.check, ability:g.ability, sentence:g.sentence, bonus:g.bonus, units:g.units }])) });
    console.log('readings: ' + gaps.size + ' gaps recorded in verify/readings-gaps.json');
    process.exit(0);
  }
  const fresh = [...gaps.keys()].filter(k => !known[k]), gone = Object.keys(known).filter(k => k !== '_about' && !gaps.has(k));
  const na = [...gaps.keys()].filter(k => known[k] && known[k].status === 'not-applicable');
  for(const k of na) gaps.delete(k);
  const by = c => [...gaps.values()].filter(g => g.check === c);
  const md = ['# Readings: abilities with a conditional bonus and no reading', '', 'verify/readings.js. Nothing is filled in: each is for the owner to read against GW\'s text (and give a reading, or declare none is needed).', ''];
  const TITLE = { riled:'Riled up, with no riled-up reading', conditional:'A bonus under a condition, with no reading of it', defence:'A defence, with no "When targeted" reading of it' };
  for(const c of Object.keys(TITLE)){
    md.push('## ' + TITLE[c] + ' (' + by(c).length + ')', '');
    for(const g of by(c)) md.push('- **' + g.ability + '** (' + g.bonus.join(', ') + '): “' + g.sentence + '” · ' + [...new Set(g.units)].join(', '));
    md.push('');
  }
  fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive:true }); fs.writeFileSync(path.join(ROOT, 'verify/out/readings.md'), md.join('\n'));
  console.log('readings: ' + (na.length ? na.length + ' declared not applicable (readings-gaps.json); ' : '') + (fresh.length ? fresh.length + ' new gap(s); ' : '') + gaps.size + ' sentences stating a bonus with no reading (' + by('riled').length + ' riled up, ' + by('conditional').length + ' other, ' + by('defence').length + ' defences; listed in verify/out/readings.md, known in verify/readings-gaps.json)' + (gone.length ? '; ' + gone.length + ' known gap(s) now read (remove them from verify/readings-gaps.json)' : ''));
  for(const k of fresh){ const g = gaps.get(k); console.log('  NEW GAP ' + g.check + ' · ' + g.ability + ' (' + g.units.join(', ') + '): “' + g.sentence + '”: give it a reading, or record it (node verify/readings.js --record) for the owner'); }
  process.exit(fresh.length ? 1 : 0);
}
module.exports = { gapsOf, abilityGaps, bonusOf, sentences };
