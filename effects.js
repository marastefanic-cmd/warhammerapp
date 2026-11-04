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
     WH_EFFECTS.norm(t)   GW's text as the patterns read it: lower case, no bold, plain quotes and dashes
     WH_EFFECTS.DF        the defence side (the datasheet's "When targeted" lines, not the Damage tab's numbers): defence effect id →
                          { label(p), dom, pats, only }; DCOND its own conditions; DNC its words no effect reads (shown as "not counted
                          here: see the rule"); dfLabel(df) the words a defence box shows
     WH_EFFECTS.ST        a unit's own characteristic a rule changes, not its attacks (the unit screen's line under its profile, "OC 7"):
                          stat effect id → { label(p), stat (the characteristic), add(p) (what it adds), dom, pats }; STCOND its own
                          conditions; stLabel(st) the words a stat box shows */
(function(root){
'use strict';
const sg = p => (+p > 0 ? '+' : '−') + Math.abs(+p);
const up = p => String(p).toUpperCase();
const N = '(\\d+|d3|d6)';   // a value: a number or a dice roll
// a keyword as GW prints it: in capitals, a Faction keyword by its name ("Faction: Orks" is ORKS)
const KW = k => String(k).replace(/^Faction: /, '').toUpperCase();
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
  // (and an enemy unit that "cannot have the Benefit of Cover" (Burning Spray): every attack against it as if [IGNORES COVER], 13.08; GW's
  // "[IGNORE COVER]" (Parasitic Payload) is that ability)
  ignoresCover:Object.assign(kwFx('ignores cover', 'ignoresCover'), { custom:[true], pats:[/\[ignores? cover(?::[^\]]*)?\]/, /\bthat enemy unit cannot have the benefit of cover\b/] }),
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
    pats:[/\bimprove the (?:ballistic|weapon) skill characteristic of [^.;]*? by (\d)\b/, /\bimprove the (?:bs|ws) characteristic of [^.;]*? by (\d)\b/, /\b(?:bs|ws) improved by (\d)\b/] },
  range:{ label:p => '+' + p + '" range', mod:p => ({ range:+p }), dom:[3, 6, 9, 12, 18], pats:[/\+(\d+)" r\b/, /\badd (\d+)" to the range characteristic\b/] },
  // ("ignore modifiers to …: the Hit roll; the Wound roll", "ignore modifiers to your unit's: Hit rolls and wound rolls": the wound roll named after
  // the words "ignore … modifiers to" in the same sentence; read before ignoreHitMods, whose words run to the sentence's end)
  ignoreWoundMods:{ label:() => 'Ignore modifiers to the Wound roll', mod:() => ({ ignoreWoundMods:true }), dom:[true],
    pats:[/(?<=\bignore (?:any or all )?modifiers to [^.]*?)\bwound rolls?\b/] },
  ignoreHitMods:{ label:() => 'Ignore modifiers to BS/WS and the Hit roll', mod:() => ({ ignoreHitMods:true }), dom:[true],
    pats:[/\bignore any or all modifiers to (?:the following: )?(?:that (?:model's|attack's) )?(?:ballistic skill|bs|weapon skill|the hit roll)\b[^.]*/, /\bignore modifiers to your unit's: bs\b[^.]*/] },
  // (the Hit roll alone, "can ignore modifiers to hit rolls and wound rolls": not BS/WS, so not the benefit of cover; read after ignoreHitMods)
  ignoreHitRollMods:{ label:() => 'Ignore modifiers to the Hit roll', mod:() => ({ ignoreHitRollMods:true }), dom:[true],
    pats:[/\bignore (?:any or all )?modifiers to (?:the )?hit rolls?\b/] },
  // a weapon ability that changes nothing in these numbers (shown with the box, said as such)
  assault:{ label:() => '[ASSAULT]', mod:() => null, dom:[true], pats:[/\[assault\]/] },
  // its own Objective Control (a Damaged band: "subtract 4 from this model's Objective Control characteristic"), no effect on attacks
  oc:{ label:p => sg(p) + ' OC', mod:() => null, dom:[-1, -2, -3, -4, -5, -6], pats:[/\bsubtract (\d) from (?:this model's|its) objective control characteristic\b/], neg:[0] },
  pistol:{ label:() => '[PISTOL]', mod:() => null, dom:[true], pats:[/\[pistol\]/] }
};
// "add D3 to the Attacks and Strength characteristics of …", "improve the Armour Penetration characteristic of that attack by 1",
// "improve the Strength, Armour Penetration and Damage characteristics of that attack by 1": one effect per characteristic named
const CL = '((?:attacks|strength|armour penetration|damage)(?:(?:, | and )(?:attacks|strength|armour penetration|damage))*)';
const CHAR_RE = new RegExp('\\b(?:add (\\d|d3) to the ' + CL + ' characteristics?|improve the ' + CL + ' characteristics?(?:(?!characteristic)[^.;])*? by (\\d|d3)\\b)', 'g');
// the rare mechanics the Damage tab does not play: the box shows GW's words, "not counted in the Damage tab"
const NC = {
  halveA:{ atk:true, why:'it halves the Attacks characteristic', pats:[/\bhalve the attacks characteristic\b/] },
  everyCrit:{ atk:true, why:'every successful Hit roll scoring a Critical Hit is not played', pats:[/\ba successful hit roll scores a critical hit\b/] },
  noPenalty:{ atk:true, why:'it removes a penalty the Damage tab does not apply', pats:[/\bdoes not suffer the penalty\b/] },
  ignoreAll:{ atk:true, why:'ignoring modifiers to every roll and characteristic is wider than the Damage tab plays', pats:[/\bignore any or all modifiers to its characteristics\b/] },
  // (atk: about the unit's own attacks, so its datasheet's footnotes say it is there, "see the rule")
  selectOne:{ atk:true, why:'it limits which of its weapons the model can select', pats:[/\byou can only select one of the [^.]*? weapons\b/] },
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
    pats:[/\btarget(?:s|ing)? (?:a |an enemy |enemy )?units? (?:that (?:is|are) )?(?:with)?in range of (?:one or more )?objective markers?\b/, /\b(?:that enemy unit|target of that attack is an enemy unit) (?:is )?within range of an objective marker\b/, /\btarget of (?:that attack|those attacks) is within range of an objective\b/] },
  closest18:{ fact:'closest18', label:() => 'The target is the closest eligible target within 18"', pats:[/\bclosest eligible target within 18"/] },
  closest:{ fact:'closest', label:() => 'The target is the closest eligible target', pats:[/\bclosest eligible target\b(?! within)/] },
  belowHalf:{ label:() => 'Below Half-strength', pats:[/\b(?:this model|this unit|that model's unit|your unit|that unit|it|this model) is (?:also )?below half-strength\b/, /\bbelow half-strength, (?:that unit's|you can)/] },
  belowStarting:{ label:() => 'Below its Starting Strength', pats:[/\b(?:this model|this unit|that model's unit|your unit|that unit|it) is below (?:its )?starting strength\b/, /\bunit that is below (?:its )?starting strength is selected\b/, /\bfrom your army that is below its starting strength\b/] },
  targetNotBelowHalf:{ label:() => 'The target not Below Half-strength', pats:[/\btargets? an enemy unit that is not below half-strength\b/] },
  targetBelowHalf:{ label:() => 'The target Below Half-strength', pats:[/\btargets? (?:a |an enemy )?unit (?:\([^)]*\) )?(?:that is )?below half-strength\b/, /\bthat (?:enemy )?unit is below half-strength\b/, /\btarget of that attack is below half-strength\b/, /\bif that unit is below half-strength\b/] },
  targetBelowStarting:{ label:() => 'The target below its Starting Strength', pats:[/\btargets? (?:a |an enemy )?unit that is below (?:its )?starting strength\b/] },
  targetSelected:{ label:() => 'The target is the enemy unit selected', pats:[/\bthat enemy unit cannot have the benefit of cover\b/, /\btargets? (?:that|its|your) (?:enemy unit|unit|victim|prey|machine vengeance target)\b/, /\bthat target (?:that )?enemy unit\b/, /\branged attacks that target that enemy unit\b/] },
  oncePerBattle:{ label:() => 'Once per battle', pats:[/\bonce per battle\b/] },
  oncePerTurn:{ label:() => 'Once per turn', pats:[/\bonce per turn\b/] },
  used:{ label:() => 'If it uses this ability', pats:[/\b(?:you|it|this model) can use this ability\b/, /\bcan call upon\b/, /\bif (?:it|you) do(?:es)?\b/] },
  // (matched by keyword, said in GW's words where they are not the keyword's, p.said: "INFANTRY, MOUNTED or BEASTS", "excluding MONSTERS and VEHICLES")
  targetKw:{ label:p => 'The target: ' + (p.said ? (p.none ? 'excluding ' : '') + p.said.toUpperCase().replace(/ (OR|AND) /g, (m, w) => ' ' + w.toLowerCase() + ' ')
    : p.none ? 'not ' + p.none.map(KW).join('/') : p.all ? p.all.map(KW).join(' ') : p.any.map(KW).join(' or ')), pats:[] },
  maxT:{ label:p => 'The target has no model with T ' + (p + 1) + '+', pats:[/\bno models with a t of (\d)\+/] },
  // a keyword of the unit the rule names ("If this model has the KHORNE keyword"): the unit's own keywords say it (the database)
  selfKw:{ label:p => 'It has the ' + KW(p) + ' keyword', pats:[/\bif this (?:model|unit) has the ([a-z' -]+?) keyword\b/, /\bif your unit is an? ([a-z' -]+?) unit\b/] },
  // the wargear the rule names ("If this model is equipped with a thundershock spear and a bellatus reaper chainsword"): the unit's weapons say it
  selfGear:{ label:p => 'It is equipped with ' + p.join(' and '), pats:[/\bif this model is equipped with (.+?)(?:,|$)/] },
  // the option of its rule the box is (a table's row, a named option: "Rendax", "Daemonic Rage [3BTP]"): its name
  // "if one or more of the following conditions apply" and the lines under it (Plunging Fire): any one of them, each in GW's words
  anyOf:{ quoted:true, label:p => p.map(x => '“' + x + '”').join(' or '), pats:[/\bif one or more of the following conditions apply\b/] },
  opt:{ label:p => p, pats:[] },
  q:{ quoted:true, label:p => '“' + p + '”', pats:[] }
};
// ---- the defence side: what protects a unit when it is attacked (the datasheet's "When targeted" lines; not played in the Damage tab) ----
// DF: defence effect id → { label(p), dom, pats (over the normalised sentence; a capture is the value), only (true: a defence wherever its
// words are, Feel No Pain or an invulnerable save; else only in a sentence about attacks against the unit or an enemy's, DEFENCE) }. The
// patterns are tried in this order, each span read once: a qualified one ("Feel No Pain 4+ against mortal wounds") before the plain one, and
// the plain one never reads a qualifier it does not say ("against …": not counted without it)
const DF = {
  fnpPsyMortal:{ only:true, label:p => 'Feel No Pain ' + p + '+ against Psychic Attacks and mortal wounds', dom:[2, 3, 4, 5, 6], pats:[/\bfeel no pain (\d)\+ (?:ability )?against (?:psychic attacks and mortal wounds|mortal wounds and psychic attacks)\b/] },
  fnpMortal:{ only:true, label:p => 'Feel No Pain ' + p + '+ against mortal wounds', dom:[2, 3, 4, 5, 6], pats:[/\bfeel no pain (\d)\+ (?:ability )?against mortal wounds\b(?! and\b)/] },
  fnpPsychic:{ only:true, label:p => 'Feel No Pain ' + p + '+ against Psychic Attacks', dom:[2, 3, 4, 5, 6], pats:[/\bfeel no pain (\d)\+ (?:ability )?against psychic attacks\b(?! and\b)/] },
  fnp:{ only:true, label:p => 'Feel No Pain ' + p + '+', dom:[2, 3, 4, 5, 6], pats:[/\bfeel no pain (\d)\+(?!\*| (?:ability )?against\b)/] },   // (nor New Recruit's star, X+*: a condition it does not say, DNC starred)
  invRanged:{ only:true, label:p => p + '+ invulnerable save against ranged attacks', dom:[2, 3, 4, 5, 6], pats:[/\b(\d)\+\*? ?(?:invulnerable save|insv) against ranged attacks\b/] },
  // ("… and a 4+ invulnerable save against that attack": the attack the sentence is about, its kind the box's)
  inv:{ only:true, label:p => p + '+ invulnerable save', dom:[2, 3, 4, 5, 6], pats:[/\b(\d)\+\*? ?(?:invulnerable save|insv)\b(?! against (?!that attack\b))/] },
  svSet:{ only:true, label:p => 'Save characteristic of ' + p + '+', dom:[2, 3, 4, 5, 6], pats:[/\b(?:has|have) an? save characteristic of (\d)\+/] },
  svPlus:{ only:true, label:p => '+' + p + ' to save rolls', dom:[1], pats:[/\b(?:has|have) \+(\d) to save rolls\b/] },
  armourPlus:{ only:true, label:p => '+' + p + ' to armour saving throws', dom:[1], pats:[/\badd (\d) to any armou?r saving throws?\b/] },
  t:{ only:true, label:p => '+' + p + ' T', dom:[1, 2], pats:[/\badd (\d) to (?:the |its |this model's |the bearer's )?toughness characteristic\b/] },
  stealth:{ only:true, label:() => 'Stealth', dom:[true], pats:[/\b(?<!cannot |can't )(?:has|have|gains?) (?:the )?stealth\b/] },
  cover:{ only:true, label:() => 'the Benefit of Cover', dom:[true], pats:[/\b(?<!cannot |can't )(?:has|have) the benefit of cover\b/] },
  loneOp:{ only:true, label:() => 'Lone Operative', dom:[true], pats:[/\b(?:has|have) (?:the )?lone operative\b/] },
  // (in a sentence about attacks against the unit, or an enemy unit's attacks: the attacker's rolls and characteristics)
  hitMinus:{ label:p => '−' + p + ' to Hit rolls', dom:[1], pats:[/\bsubtract (\d) from (?:the|that attack's) hit roll\b/, /(?:^|\s)-(\d) to (?:the )?hit rolls?\b/] },
  woundMinus:{ label:p => '−' + p + ' to Wound rolls', dom:[1], pats:[/\bsubtract (\d) from (?:the|that attack's) wound roll\b/, /(?:^|\s)-(\d) to (?:the )?wound rolls?\b/] },
  apWorse:{ label:p => 'AP worsened by ' + p, dom:[1], pats:[/\bworsen the armou?r penetration characteristic of (?:that|each) attack by (\d)\b/, /(?:^|\s)-(\d) ap\b/] },
  dmgMinus:{ label:p => '−' + p + ' Damage', dom:[1], pats:[/\bsubtract (\d) from the damage characteristic of (?:that|the) attack\b/, /(?:^|\s)-(\d) d\b/] },
  dmgHalf:{ label:() => 'Damage halved', dom:[true], pats:[/\bhalve the damage characteristic of (?:that|the) attack\b/] },
  dmg0:{ label:() => 'Damage 0', dom:[true], pats:[/\bchange the damage characteristic of that attack to 0\b/] },
  hazardous:{ label:() => 'the attacking weapons have [HAZARDOUS]', dom:[true], pats:[/\bha(?:s|ve) (?:the )?\[hazardous\](?: ability)?/] }
};
// the conditions only the defence side reads (with COND's): their label, their patterns
const DCOND = {
  nearFriendly:{ label:p => 'Within ' + p.d + '" of ' + (p.other ? 'another' : 'a') + ' friendly ' + KW(p.kw) + ' unit' + (p.not ? ' (not ' + KW(p.not) + ')' : ''),
    pats:[/\bwhile this (?:model|unit) is within (\d+)" of (?:one or more |a |an )?(other |another )?friendly ([a-z' -]+?) units?\b(?: \(excluding ([a-z' /-]+?) units?\))?/] },
  sOverT:{ label:() => 'The attack’s S greater than its T', pats:[/\bif the strength characteristic of that attack is greater than the toughness characteristic of (?:your|this) unit\b/, /\bwith a s greater than (?:your|this|that) unit's t\b/] },
  ledBy:{ label:p => 'While a ' + KW(p) + ' model is leading it', pats:[/\bwhile an? ([a-z][a-z ]*?) model is leading this unit\b/] },
  bearerLeading:{ label:() => 'While leading a unit', pats:[/\bwhile the bearer is leading a unit\b/] },
  controlling:{ label:() => 'While it controls an objective', pats:[/\bwhile this unit is controlling an objective\b/] },
  notPsychic:{ label:() => 'Not Psychic Attacks', pats:[/\(excluding psychic attacks\)/] },
  failedSave:{ label:() => 'After a failed saving throw', pats:[/\bwhen a saving throw (?:made )?for [^.]*? is failed\b/, /\bjust after a saving throw is failed\b/] },
  bearerUses:{ label:() => 'If the bearer uses it', pats:[/\bthe bearer can use this enhancement\b/] },
  // (the attacking unit's state, in a sentence about an enemy unit's attacks: "if that enemy unit is Below Half-strength", Encephalic
  // Diffusion; the attacker is "that enemy unit" there, not the target. Said in GW's words; the Damage tab does not play the defence side)
  attackerBelowHalf:{ label:() => 'That enemy unit is Below Half-strength', pats:[/\bif that enemy unit is (?:also )?below half-strength\b/] },
  // (a keyword of the model it is given to: "if it is a VEHICLE model"; the unit's keywords say it, as selfKw)
  itIs:{ label:p => 'It is a ' + KW(p) + ' model', pats:[/\bif it is an? ([a-z][a-z ]*?) model\b/] }
};
// the defence-side words no catalogue effect reads: shown as "not counted here: see the rule", never dropped (the first that matches is its
// reason; any other sentence about attacks against the unit with no effect read: 'unread')
const DNC = {
  onDeath:{ why:'what happens when one of its models is destroyed', pats:[/\bdo not remove (?:that|this|the destroyed) model\b/, /\bset this model back up on the battlefield\b/] },
  targeting:{ why:'which units can select it as a target', pats:[/\bcan only be selected as the target of\b/, /\bwishes to select this model as the target\b/, /\bcannot target (?:your|this) (?:unit|model)\b/] },
  detection:{ why:'its detection range', pats:[/\bthis unit has -\d+" detection range\b/] },
  sequence:{ why:'an attack sequence that ends before it is resolved', pats:[/\bthe attack sequence ends\b/, /\bend the attack sequence\b/] },
  eligibility:{ why:'whether the enemy unit is eligible to attack', pats:[/\benemy unit is not eligible to (?:shoot|fight)\b/] },
  starred:{ why:'New Recruit’s Feel No Pain X+*: the rule that gives it has a condition (against Psychic Attacks, or mortal wounds) this name does not say', pats:[/\bfeel no pain \d\+\*/] },
  unread:{ why:'about attacks against it, in words no catalogue effect reads', pats:[] }
};
const dfLabel = df => (df || []).map(([id, p]) => DF[id] ? DF[id].label(p) : id).join(', ');
// ---- a unit's own characteristics a rule changes (not its attacks, not the Damage tab's): the line under its profile on the unit screen
// ("OC 7"). ST: stat effect id → { label(p), stat (the characteristic), add(p), dom, pats (over the normalised sentence; the capture is the
// value), name (GW's name of it) }: the characteristic of the models of a unit ("of models in that unit", "of TZAANGOR models in that unit",
// "that unit has +2 OC" after "While a friendly … unit", "Friendly … units have +6" M"), never one model's own
// (a Damaged band's "subtract 4 from this model's Objective Control characteristic" is FX oc, on its band)
const ST = {
  ocAdd:{ label:p => '+' + p + ' OC', stat:'OC', name:'objective control', add:p => +p, dom:[1, 2, 3], pats:[/\badd (\d) to the objective control characteristic of (?:[a-z' -]+ )?models in (?:that|this|your|each) unit\b/, /\bthat unit has \+(\d) oc\b/] },
  ocMinus:{ label:p => '−' + p + ' OC', stat:'OC', name:'objective control', add:p => -p, dom:[1, 2, 3, 4], pats:[/\bsubtract (\d) from the objective control characteristic of (?:[a-z' -]+ )?models in (?:that|this|your|each) unit\b/] },
  mAdd:{ label:p => '+' + p + '" M', stat:'M', name:'move', add:p => +p, inch:true, dom:[1, 2, 3, 6], pats:[/\badd (\d)" to the move characteristic of models in (?:[a-z' -]+ )?units?\b/, /\bfriendly [a-z' -]+ units (?:from your army )?have \+(\d)" m\b/, /\bthat unit has \+(\d)" m\b/] }
};
// the conditions only a stat box reads (with COND's): "is at its Starting Strength", "(excluding Battle-shocked units)", "unless that unit is
// Battle-shocked", "while such a unit is not Battle-shocked"
const STCOND = {
  atStarting:{ label:() => 'At its Starting Strength', pats:[/\bis at (?:its )?starting strength\b/] },
  notShocked:{ label:() => 'Not Battle-shocked', pats:[/\(excluding battle-shocked units\)/, /\bunless (?:that|this|your|the) unit is battle-shocked\b/, /\bwhile (?:such a|that|this|your) unit is not battle-shocked\b/] }
};
const stLabel = st => (st || []).map(([id, p]) => ST[id] ? ST[id].label(p) : id).join(', ');
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
// (a condition that is only GW's words, quoted (q, anyOf: quoted), is said here, on the Damage tab's boxes, where it tells two boxes of
// one rule apart and is what the player ticks; the datasheet's footnotes leave it out, their rule's name opening the words: app.html fnLine)
const condLabel = on => (on || []).map(([id, p]) => COND[id] ? COND[id].label(p) : id).join(' · ');
// ---- the two-reader rule (the owner's decision, 3 Nov 2026): the boxes as the app counts and shows them. A box of data.js BOXES (b, d, st)
// with an effect counts only where data.js AGREE (verify/agree.js) marks it confirmed: "A" (reader2, an independent second reading of GW's
// words, agrees), "V" (a reviewed verdict with GW's quote shows the app right), "core" (a Core Rules box, outside the comparison). Any other
// box is not counted, shown as GW's words with "see the rule": its effects are taken off (it stays in its place, so the other boxes of its
// source keep their index, marked unconfirmed: what it read, never counted) and its sentence goes first among its source's not-counted words: a box about its attacks
// to nc (atk), a defence box to dnc, a stat box to snc (with its characteristic), each with its reach and conditions. With no AGREE, every
// box falls back. The same for app.html (every screen), builder.js and the gate's scripts that draw the screens in node.
const AGREE_WHY = 'not confirmed by a second reading of GW’s words';
const AGREE_FX = { b:'fx', d:'df', st:'st' }, AGREE_NC = { b:'nc', d:'dnc', st:'snc' };
function agreed(boxes, agree){
  const ok = (agree && agree.boxes) || {}, out = {};
  for(const [k, o] of Object.entries(boxes || {})){
    const row = ok[k] || {}, words = { nc:[], dnc:[], snc:[] }; let x = o;
    for(const f of ['b', 'd', 'st']) (o[f] || []).forEach((e, i) => {
      if(!((e[AGREE_FX[f]] || []).length || (e.pick || []).length) || (row[f] && row[f][i])) return;
      if(x === o) x = Object.assign({}, o);
      if(x[f] === o[f]) x[f] = o[f].slice();
      const off = Object.assign({}, e, { [AGREE_FX[f]]:[], unconfirmed:Object.assign({ [AGREE_FX[f]]:e[AGREE_FX[f]] || [] }, e.pick ? { pick:e.pick } : {}) }); delete off.pick; delete off.part; x[f][i] = off;
      const w = { quote:e.quote, why:AGREE_WHY, unconfirmed:true };
      if(e.reach) w.reach = e.reach; if((e.on || []).length) w.on = e.on;
      if(f === 'b') words.nc.push(Object.assign(w, { atk:true }));
      else if(f === 'd') words.dnc.push(w);
      else { const st = (e.st || []).concat((e.pick || []).flatMap(p => p.st || [])), stats = [...new Set(st.map(([id]) => ST[id] ? ST[id].stat : id))];
        (stats.length ? stats : ['?']).forEach(s => words.snc.push(Object.assign({}, w, { stat:s }))); }
    });
    for(const f of ['nc', 'dnc', 'snc']) if(words[f].length) x[f] = words[f].concat(o[f] || []);
    out[k] = x;
  }
  return out;
}
const api = { FX, COND, NC, CUSTOM, FACT_OF, CHAR_RE, CH, KW, toMod, fxLabel, condLabel, norm, DF, DCOND, DNC, dfLabel, ST, STCOND, stLabel, agreed, AGREE_WHY };
if(typeof module !== 'undefined' && module.exports) module.exports = api;
root.WH_EFFECTS = api;
})(typeof self !== 'undefined' ? self : this);
