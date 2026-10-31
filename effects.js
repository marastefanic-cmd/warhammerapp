/* effects.js: the Damage tab's catalogue of effects and conditions, shared by app.html and verify/.

   Every rule box on the Damage tab reads one verbatim sentence of GW's text (its quote). What the box does in the numbers is
   fixed here, by code: each effect has an id, a label (what the player reads), the calc.js mod it becomes, the values it can take,
   and the words of GW's text that state it (pats: verify/effects-extract.js finds them in the quote, verify/evidence.js checks them).
   Nothing here reads prose at run time: the app takes a box's effects (fx: [[id, value]]) and conditions (on: [[id, value]]) as data
   (data.js BOXES, written by verify/effects-migrate.js --write) and turns them into numbers and labels with the tables below.

     WH_EFFECTS.FX        effect id → { label(p), mod(p) (calc.js mod; null: no effect in these numbers), dom (values), custom (the
                          values the Custom modifiers group offers), pats (regular expressions over the normalised quote; a capture
                          is the value) }
     WH_EFFECTS.COND      condition id → { label(p), fact (the Damage tab's fact of the table it is, when it is one), pats }
     WH_EFFECTS.toMod(fx) the calc.js mod of a list of effects
     WH_EFFECTS.fxLabel(fx), condLabel(on)   the words the box shows
     WH_EFFECTS.CUSTOM    the Custom modifiers group: [[id, value]], in the order shown
     WH_EFFECTS.NC        the rare mechanics shown quoted, "not counted in the Damage tab": id → { why, pats }
     WH_EFFECTS.norm(t)   GW's text as the patterns read it: lower case, no bold, plain quotes and dashes */
(function(root){
'use strict';
const sg = p => (+p > 0 ? '+' : '−') + Math.abs(+p);
const up = p => String(p).toUpperCase();
const N = '(\\d+|d3|d6)';   // a value: a number or a dice roll
const v = s => /^d\d$/i.test(s) ? up(s) : +s;
const kwFx = (word, key) => ({ label:() => '[' + word.toUpperCase() + ']', mod:() => ({ [key]:true }), dom:[true], pats:[new RegExp('\\[' + word + '(?::[^\\]]*)?\\]')] });
// the characteristics a sentence adds to or improves ("add 1 to the Attacks and Strength characteristics", "improve the Strength,
// Armour Penetration and Damage characteristics of that attack by 1", "+2 S")
const CH = { attacks:'a', strength:'s', 'armour penetration':'ap', damage:'d' };
const FX = {
  hit:{ label:p => sg(p) + ' to Hit rolls', mod:p => ({ hit:+p }), dom:[-2, -1, 1, 2], custom:[1, -1],
    pats:[/\badd (\d) to (?:the |that attack's |its )?hit rolls?\b/, /\+(\d) to hit rolls?\b/, /\bsubtract (\d) from (?:the |that attack's )?hit rolls?\b/, /(?:^|\s)-(\d) to hit rolls?\b/], neg:[2, 3] },
  wound:{ label:p => sg(p) + ' to Wound rolls', mod:p => ({ wound:+p }), dom:[-2, -1, 1, 2], custom:[1, -1],
    pats:[/\badd (\d) to (?:the |that attack's |its )?wound rolls?\b/, /\+(\d) to wound rolls?\b/, /\bsubtract (\d) from (?:the |that attack's )?wound rolls?\b/, /(?:^|\s)-(\d) to wound rolls?\b/], neg:[2, 3] },
  oneAny:{ label:() => 'Re-roll one Hit, Wound or Damage roll', mod:() => ({ oneAny:1 }), dom:[true],
    pats:[/\bre-?roll one hit roll,? (?:re-?roll )?one wound roll,? or (?:re-?roll )?one damage roll\b/] },
  oneEither:{ label:() => 'Re-roll one Hit or Wound roll', mod:() => ({ oneEither:1 }), dom:[true],
    pats:[/\bre-?roll one hit roll or (?:you can )?re-?roll one wound roll\b/] },
  oneHit:{ label:() => 'Re-roll one Hit roll', mod:() => ({ oneHit:1 }), dom:[true], custom:[true], pats:[/\bre-?roll one hit roll\b/] },
  oneWound:{ label:() => 'Re-roll one Wound roll', mod:() => ({ oneWound:1 }), dom:[true], custom:[true], pats:[/\bre-?roll one wound roll\b/] },
  oneDmg:{ label:() => 'Re-roll one Damage roll', mod:() => ({ oneDmg:1 }), dom:[true], custom:[true], pats:[/\bre-?roll one damage roll\b/] },
  // Command Re-roll: "You re-roll that roll" after a Hit, Wound or Damage roll (its WHEN), once in the phase (15.01)
  oneAnyPhase:{ label:() => 'Re-roll one Hit, Wound or Damage roll (once in the phase)', mod:() => ({ oneAny:1, phase:true }), dom:[true],
    pats:[/\byou re-roll that roll\b/] },
  rrHit1:{ label:() => 'Re-roll Hit rolls of 1', mod:() => ({ rrHit:'1s' }), dom:[true], custom:[true], pats:[/\bre-?roll (?:a |the )?hit rolls? of 1\b/] },
  rrWound1:{ label:() => 'Re-roll Wound rolls of 1', mod:() => ({ rrWound:'1s' }), dom:[true], custom:[true], pats:[/\bre-?roll (?:a |the )?wound rolls? of 1\b/] },
  rrHit:{ label:() => 'Re-roll Hit rolls', mod:() => ({ rrHit:'all' }), dom:[true], custom:[true], pats:[/\bre-?roll (?:the |a |that |their )?hit rolls?\b(?! of 1)/] },
  rrWound:{ label:() => 'Re-roll Wound rolls', mod:() => ({ rrWound:'all' }), dom:[true], custom:[true], pats:[/\bre-?roll (?:the |a |that |their )?wound rolls?\b(?! of 1)/] },
  rrDmg:{ label:() => 'Re-roll Damage rolls', mod:() => ({ rrDmg:'all' }), dom:[true], custom:[true], pats:[/\bre-?roll (?:the |a |that |their )?damage rolls?\b/] },
  critHit:{ label:p => 'Critical Hit on ' + p + '+', mod:p => ({ critHit:+p }), dom:[2, 3, 4, 5], custom:[5],
    pats:[/\bunmodified (?:successful )?hit roll of (\d)\+ scores a critical hit\b/] },
  critWound:{ label:p => 'Critical Wound on ' + p + '+', mod:p => ({ critWound:+p }), dom:[2, 3, 4, 5], custom:[5],
    // (either order: "an unmodified successful Wound roll of 5+", "a successful unmodified Wound roll of 5+" (Prince of Slaanesh))
    pats:[/\b(?:successful )?unmodified (?:successful )?wound roll of (\d)\+ scores a critical wound\b/] },
  // "each successful unmodified Wound roll is a Critical Wound" (Swallow Whole): critical when the unmodified roll is equal to or greater
  // than the required result, modifiers aside (05.02; in effect a Critical Wound at the wound need)
  critWoundAll:{ label:() => 'Each successful unmodified Wound roll is a Critical Wound', mod:() => ({ critWoundAll:true }), dom:[true],
    pats:[/\b(?:each|every|any) successful unmodified wound roll is a critical wound\b/] },
  lethal:Object.assign(kwFx('lethal hits', 'lethal'), { custom:[true] }),
  dev:Object.assign(kwFx('devastating wounds', 'dev'), { custom:[true] }),
  twin:Object.assign(kwFx('twin-linked', 'twin'), { custom:[true] }),
  lance:Object.assign(kwFx('lance', 'lance'), { custom:[true] }),
  precision:Object.assign(kwFx('precision', 'precision'), { custom:[true] }),
  ignoresCover:Object.assign(kwFx('ignores cover', 'ignoresCover'), { custom:[true] }),
  heavy:kwFx('heavy', 'heavy'),
  hazardous:kwFx('hazardous', 'hazardous'),
  indirect:kwFx('indirect fire', 'indirect'),
  sus:{ label:p => '[SUSTAINED HITS ' + up(p) + ']', mod:p => ({ sus:up(p) }), dom:['1', '2', 'D3'], custom:['1'], pats:[/\[sustained hits (1|2|d3)(?::[^\]]*)?\]/], str:true },
  cleave:{ label:p => '[CLEAVE ' + p + ']', mod:p => ({ cleave:+p }), dom:[1, 2, 3], pats:[/\[cleave (\d)\]/] },
  anti:{ label:p => '[ANTI-' + p + ']', mod:p => { const m = /^(NON-)?(.+?) (\d)\+$/.exec(up(p)); return { anti:{ non:!!m[1], kw:m[2].split('/').map(x => x.trim()), v:+m[3] } }; },
    dom:'anti', pats:[/\[anti-((?:non-)?[a-z][a-z /-]*? \d\+)\]/], str:true },
  // a characteristic added to or improved (one effect for each characteristic a sentence names)
  a:{ label:p => '+' + up(p) + ' A', mod:p => ({ a:v(p) }), dom:[1, 2, 3, 4, 5, 6, 'D3'], custom:[1], pats:[/\+(\d|d3) a\b/], ch:'attacks' },
  s:{ label:p => '+' + up(p) + ' S', mod:p => ({ s:v(p) }), dom:[1, 2, 3, 'D3'], custom:[1], pats:[/\+(\d|d3) s\b/], ch:'strength' },
  ap:{ label:p => '+' + up(p) + ' AP', mod:p => ({ ap:+p }), dom:[1, 2], custom:[1], pats:[/\+(\d) ap\b/], ch:'armour penetration' },
  d:{ label:p => '+' + up(p) + ' D', mod:p => ({ d:+p }), dom:[1, 2, 3], custom:[1], pats:[/\+(\d) d\b/], ch:'damage' },
  aSet:{ label:p => 'A ' + p, mod:p => ({ set:{ A:String(p) } }), dom:[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12], pats:[/\bhas an attacks characteristic of (\d+)\b/] },
  bsSet:{ label:p => 'BS ' + p + '+', mod:p => ({ set:{ BS:p + '+' } }), dom:[2, 3, 4, 5], pats:[/\bhave a ballistic skill characteristic of (\d)\+/] },
  skill:{ label:p => 'BS/WS improved by ' + p, mod:p => ({ skill:+p }), dom:[1, 2],
    pats:[/\bimprove the (?:ballistic|weapon) skill characteristic of [^.;]*? by (\d)\b/, /\b(?:bs|ws) improved by (\d)\b/] },
  range:{ label:p => '+' + p + '" range', mod:p => ({ range:+p }), dom:[3, 6, 9, 12, 18], pats:[/\+(\d+)" r\b/, /\badd (\d+)" to the range characteristic\b/] },
  ignoreHitMods:{ label:() => 'Ignore modifiers to BS/WS and the Hit roll', mod:() => ({ ignoreHitMods:true }), dom:[true],
    pats:[/\bignore any or all modifiers to (?:the following: )?(?:that (?:model's|attack's) )?(?:ballistic skill|bs|weapon skill|the hit roll)\b[^.]*/, /\bignore modifiers to your unit's: bs\b[^.]*/] },
  // a weapon ability that changes nothing in these numbers (shown with the box, said as such)
  assault:{ label:() => '[ASSAULT]', mod:() => null, dom:[true], pats:[/\[assault\]/] },
  pistol:{ label:() => '[PISTOL]', mod:() => null, dom:[true], pats:[/\[pistol\]/] }
};
// "add D3 to the Attacks and Strength characteristics of …", "improve the Armour Penetration characteristic of that attack by 1",
// "improve the Strength, Armour Penetration and Damage characteristics of that attack by 1": one effect per characteristic named
const CL = '((?:attacks|strength|armour penetration|damage)(?:(?:, | and )(?:attacks|strength|armour penetration|damage))*)';
const CHAR_RE = new RegExp('\\b(?:add (\\d|d3) to the ' + CL + ' characteristics?|improve the ' + CL + ' characteristics?(?:(?!characteristic)[^.;])*? by (\\d|d3)\\b)', 'g');
// the rare mechanics the Damage tab does not play: the box shows GW's words, "not counted in the Damage tab"
const NC = {
  halveA:{ why:'it halves the Attacks characteristic', pats:[/\bhalve the attacks characteristic\b/] },
  everyCrit:{ why:'every successful Hit roll scoring a Critical Hit is not played', pats:[/\ba successful hit roll scores a critical hit\b/] },
  noPenalty:{ why:'it removes a penalty the Damage tab does not apply', pats:[/\bdoes not suffer the penalty\b/] },
  ignoreAll:{ why:'ignoring modifiers to every roll and characteristic is wider than the Damage tab plays', pats:[/\bignore any or all modifiers to its characteristics\b/] },
  synapse:{ why:'it changes what another rule needs, not these numbers', pats:[/\bis within your army's synapse range\b/] }
};
// the conditions a box states (its label; all start unticked). fact: the Damage tab's fact of the table it is (ticking the fact
// ticks the box); the others are said on the box. targetKw / maxT: about the target (its keywords are the player's to say)
const COND = {
  leading:{ label:() => 'While leading a unit', pats:[/\bwhile this (?:model|unit) is leading a unit\b/, /\bif this model is leading\b/] },
  aura:{ label:p => 'Within ' + p + '" of it', pats:[/(?<!\bno (?:other )?)\bfriendly [^.]*?\b(?:is|are|units?|models?|unit \([^)]*\)|units \([^)]*\)) within (\d+)" of (?:this|the bearer|the selected|your unit\b)/, /\bfriendly [^.]*?within (\d+)" of this unit's [a-z]+ model\b/] },
  selected:{ label:() => 'Selected by it', pats:[/\bselect one (?:other )?friendly\b/] },
  battleline6:{ fact:'battleline6', label:() => 'BATTLELINE, or within 6" of a friendly ADEPTUS MECHANICUS BATTLELINE unit', pats:[/\bif this unit has the battleline keyword and\/or it is within 6" of one or more friendly adeptus mechanicus battleline units\b/] },
  charged:{ fact:'charged', label:() => 'Charged this turn', pats:[/\b(?:made|makes|ends) a charge move\b/] },
  riled:{ fact:'riled', label:() => 'Riled up', pats:[/\briled up\b/] },
  stationary:{ fact:'stationary', label:() => 'Remained Stationary', pats:[/\bremain(?:s|ed)? stationary\b/] },
  objective:{ fact:'objective', label:() => 'This unit or the target within range of an objective', pats:[/^(?=.*\bany of the following apply\b)(?=.*\b(?:this|that) unit is within range of an objective\b)/] },
  onObjective:{ label:() => 'Within range of an objective', pats:[/\b(?:this|that|a friendly [a-z ]+) unit is within range of an objective\b/] },
  targetObjectiveNotYours:{ fact:'targetObjectiveNotYours', label:() => 'The target on an objective marker you do not control', pats:[/\bobjective marker you do not control\b/] },
  targetObjective:{ fact:'targetObjective', label:() => 'The target within range of an objective marker',
    pats:[/\btarget(?:s|ing)? (?:a |an enemy |enemy )?units? (?:with)?in range of (?:one or more )?objective markers?\b/, /\b(?:that enemy unit|target of that attack is an enemy unit) (?:is )?within range of an objective marker\b/, /\btarget of (?:that attack|those attacks) is within range of an objective\b/] },
  closest18:{ fact:'closest18', label:() => 'The target is the closest eligible target within 18"', pats:[/\bclosest eligible target within 18"/] },
  closest:{ fact:'closest', label:() => 'The target is the closest eligible target', pats:[/\bclosest eligible target\b(?! within)/] },
  belowHalf:{ label:() => 'Below Half-strength', pats:[/\b(?:this model|this unit|that model's unit|your unit|that unit|it|this model) is (?:also )?below half-strength\b/, /\bbelow half-strength, (?:that unit's|you can)/] },
  belowStarting:{ label:() => 'Below its Starting Strength', pats:[/\b(?:this model|this unit|that model's unit|your unit|that unit|it) is below (?:its )?starting strength\b/, /\bunit that is below (?:its )?starting strength is selected\b/, /\bfrom your army that is below its starting strength\b/] },
  targetNotBelowHalf:{ label:() => 'The target not Below Half-strength', pats:[/\btargets? an enemy unit that is not below half-strength\b/] },
  targetBelowHalf:{ label:() => 'The target Below Half-strength', pats:[/\btargets? (?:a |an enemy )?unit (?:that is )?below half-strength\b/, /\bthat (?:enemy )?unit is below half-strength\b/, /\btarget of that attack is below half-strength\b/, /\bif that unit is below half-strength\b/] },
  targetBelowStarting:{ label:() => 'The target below its Starting Strength', pats:[/\btargets? (?:a |an enemy )?unit that is below (?:its )?starting strength\b/] },
  targetSelected:{ label:() => 'The target is the enemy unit selected', pats:[/\btargets? (?:that|its|your) (?:enemy unit|unit|victim|prey|machine vengeance target)\b/, /\bthat target (?:that )?enemy unit\b/, /\branged attacks that target that enemy unit\b/] },
  oncePerBattle:{ label:() => 'Once per battle', pats:[/\bonce per battle\b/] },
  oncePerTurn:{ label:() => 'Once per turn', pats:[/\bonce per turn\b/] },
  used:{ label:() => 'If it uses this ability', pats:[/\b(?:you|it|this model) can use this ability\b/, /\bcan call upon\b/, /\bif (?:it|you) do(?:es)?\b/] },
  targetKw:{ label:p => 'The target: ' + (p.none ? 'not ' + p.none.join('/') : p.all ? p.all.join(' ') : p.any.join(' or ')), pats:[] },
  maxT:{ label:p => 'The target has no model with T ' + (p + 1) + '+', pats:[/\bno models with a t of (\d)\+/] },
  // a keyword of the unit the rule names ("If this model has the KHORNE keyword"): the unit's own keywords say it (the database)
  selfKw:{ label:p => 'It has the ' + p + ' keyword', pats:[/\bif this (?:model|unit) has the ([a-z' -]+?) keyword\b/, /\bif your unit is an? ([a-z' -]+?) unit\b/] },
  // the wargear the rule names ("If this model is equipped with a thundershock spear and a bellatus reaper chainsword"): the unit's weapons say it
  selfGear:{ label:p => 'It is equipped with ' + p.join(' and '), pats:[/\bif this model is equipped with (.+?)(?:,|$)/] },
  // the option of its rule the box is (a table's row, a named option: "Rendax", "Daemonic Rage [3BTP]"): its name
  opt:{ label:p => p, pats:[] },
  q:{ label:p => '“' + p + '”', pats:[] }
};
const FACT_OF = Object.fromEntries(Object.entries(COND).filter(([, c]) => c.fact).map(([k, c]) => [k, c.fact]));
// the Custom modifiers group: every catalogue effect a player can set by hand, in this order (no rule, no AI: plain toggles)
const CUSTOM = [];
for(const [id, x] of Object.entries(FX)) for(const p of x.custom || []) CUSTOM.push([id, p]);
const norm = t => String(t == null ? '' : t).replace(/\*\*|~~|__/g, '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—−]/g, '-').replace(/\s+/g, ' ').toLowerCase();
function toMod(fx){
  const out = {};
  for(const [id, p] of fx || []){ const f = FX[id]; if(!f) continue; const m = f.mod(p); if(!m) continue;
    for(const [k, x] of Object.entries(m)){
      if(k === 'set') out.set = Object.assign({}, out.set || {}, x);
      else if((k === 'critHit' || k === 'critWound') && typeof out[k] === 'number') out[k] = Math.min(out[k], x);   // (the lowest: critical on 5+ beats 6+)
      else if(typeof x === 'number' && typeof out[k] === 'number' && !['critHit', 'critWound'].includes(k)) out[k] += x;
      else out[k] = x; } }
  return out;
}
const fxLabel = fx => (fx || []).map(([id, p]) => FX[id] ? FX[id].label(p) : id).join(', ');
const condLabel = on => (on || []).map(([id, p]) => COND[id] ? COND[id].label(p) : id).join(' · ');
const api = { FX, COND, NC, CUSTOM, FACT_OF, CHAR_RE, CH, toMod, fxLabel, condLabel, norm };
if(typeof module !== 'undefined' && module.exports) module.exports = api;
root.WH_EFFECTS = api;
})(typeof self !== 'undefined' ? self : this);
