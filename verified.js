// written by verify/run.js: the last verification of this app.html + data.js
window.WH_VERIFIED = {
 "ok": true,
 "build": "e70048b789",
 "data": "2026-10-30.2",
 "date": "30 Oct 2026",
 "checks": [
  {
   "label": "Your New Recruit lists:",
   "detail": "every unit, model count, wargear, enhancement, stat line, weapon profile and ability matches the PDF (11234 facts)."
  },
  {
   "label": "BSData,",
   "detail": "the data New Recruit is built from: every stat, weapon, keyword, ability and points value (16366 facts)."
  },
  {
   "label": "Granted values:",
   "detail": "every keyword or value marked + is one a rule of your list changes in BSData, named as that rule, and matches the rules New Recruit prints beside the weapon (248 values)."
  },
  {
   "label": "Games Workshop’s rules text:",
   "detail": "every rule, enhancement and stratagem is the wording of GW’s newest official document, or Wahapedia where GW has none (5712 texts)."
  },
  {
   "label": "Rules logic:",
   "detail": "each stratagem is offered in the phases its WHEN names and to the units its TARGET names; every number in a footnote is in the rule it cites."
  },
  {
   "label": "The app’s own notes:",
   "detail": "1618 footnotes, phase tags and summaries, each read against its rule and signed off; a changed rule voids its sign-off."
  },
  {
   "label": "Every screen:",
   "detail": "3171 screens and popups render on a 390 and a 320px-wide phone; they list every ability, open every link and find every name in search."
  }
 ],
 "sources": [
  {
   "label": "New Recruit:",
   "detail": "Me shooty yer’ booty, Princes, Standard, Pubstomper, Nidzillas, 6 bigs, 4 megas and a destrier, Super Terminators, Purge goes the Foe, Defilers and friends, Infernal Lance, Woof Woof, Big demons baby, Mucho Mutantes, Lite Knights, Nerf when, The Exiled Legion, Fellhammer Siege Task Force, Emperor’s Chosen, Dread Host, Navigator sounds op ngl, Tzeeeeentch, Healybois, U w0t m8?, Simple but effective (your PDFs)."
  },
  {
   "label": "BSData:",
   "detail": "wh40k-11e, commit b4dc3f4."
  },
  {
   "label": "Games Workshop:",
   "detail": "warhammer40k new40k core rules; wh40k -faction pack adeptus-mechanicus; wh40k event companion; wh40k faction pack tyranids; wh40k printed product updates adeptus custodes updates; wh40k printed product updates space marines updates; wh40k faction pack chaos daemons; wh40k faction pack chaos space marines; wh40k faction pack emperors children; wh40k faction pack necrons; wh40k faction pack thousand sons; wh40k faction pack world eaters; wh40k coreandkey universal rules updates; wh40k faction pack chaos knights; wh40k faction pack imperial knights."
  },
  {
   "label": "Wahapedia:",
   "detail": "faction pages for Orks, Imperial Knights, World Eaters, Thousand Sons, Tyranids, Adeptus Mechanicus, Emperor’s Children, Chaos Knights, Adeptus Custodes, Ultramarines, Chaos Daemons, Chaos Space Marines, Necrons and the errata and FAQs they list (the only source for Orks: no GW Faction Pack yet)."
  }
 ],
 "tables": {
  "RULES": {
   "what": "core rules and weapon abilities: name → text (glossary)",
   "cols": "name:gw text:gw"
  },
  "RULE_SRC": {
   "what": "where a RULES entry comes from when it is not a core rule",
   "cols": "name:hand source:hand"
  },
  "RULE_ALIASES": {
   "what": "which RULES entry a keyword or rule chip opens: [pattern, rule]",
   "cols": "pattern:hand rule:hand"
  },
  "CONCEPTS": {
   "what": "core terms kept out of a unit's rule list",
   "cols": "term:gw"
  },
  "CORE_STRATAGEMS": {
   "what": "the core stratagems",
   "cols": "id:hand gist:ai-summary gistOf:derived name:gw cp:gw phases:derived turn:derived turns:derived when:gw target:gw effect:gw restrictions:gw needs:hand note:hand limit:ai-reading defCalc:ai-reading cpNote:hand def:ai-reading defOf:derived mod:ai-reading shield:ai-reading help:ai-reading defPick:ai-reading react:ai-reading weaponKw:ai-reading lasts:ai-reading calcNote:ai-reading readOf:derived"
  },
  "FACTIONS": {
   "what": "one row per faction: its army rules, detachments and aliases",
   "cols": "name:gw aliases:hand armyRules:gw detachments:gw allies:hand"
  },
  "FACTIONS.armyRules": {
   "what": "a faction's army rules",
   "cols": "name:gw text:gw table:gw tag:newrecruit ph:derived turn:derived turns:derived at:derived needs:hand coreTwin:hand note:hand calcDefs:ai-reading mod:ai-reading def:ai-reading defOf:derived parts:ai-reading statNote:ai-reading tableAt:hand missing:hand defPh:derived mods:ai-reading aura:ai-reading guard:ai-reading readOf:derived"
  },
  "FACTIONS.detachments": {
   "what": "a faction's detachments",
   "cols": "name:gw dispositions:bsdata dp:gw rule:gw moreRules:gw enhancements:gw stratagems:gw nr:bsdata aiStatus:derived"
  },
  "FACTIONS.detachments.rule": {
   "what": "a detachment's rule",
   "cols": "name:gw text:gw table:gw tag:newrecruit ph:derived turn:derived turns:derived at:derived needs:hand coreTwin:hand note:hand calcDefs:ai-reading mod:ai-reading def:ai-reading defOf:derived parts:ai-reading statNote:ai-reading tableAt:hand missing:hand defPh:derived mods:ai-reading aura:ai-reading guard:ai-reading readOf:derived"
  },
  "FACTIONS.detachments.moreRules": {
   "what": "a detachment's further rule (moreRules), with the columns of its first",
   "cols": "name:gw text:gw table:gw tag:newrecruit ph:derived turn:derived turns:derived at:derived needs:hand coreTwin:hand note:hand calcDefs:ai-reading mod:ai-reading def:ai-reading defOf:derived parts:ai-reading statNote:ai-reading tableAt:hand missing:hand defPh:derived mods:ai-reading aura:ai-reading guard:ai-reading readOf:derived"
  },
  "FACTIONS.detachments.stratagems": {
   "what": "a detachment's stratagems",
   "cols": "id:derived gist:ai-summary gistOf:derived name:gw cp:gw phases:derived turn:derived turns:derived when:gw target:gw effect:gw restrictions:gw needs:hand note:hand limit:ai-reading defCalc:ai-reading cpNote:hand def:ai-reading defOf:derived mod:ai-reading shield:ai-reading help:ai-reading defPick:ai-reading react:ai-reading weaponKw:ai-reading lasts:ai-reading calcNote:ai-reading readOf:derived"
  },
  "FACTIONS.detachments.enhancements": {
   "what": "a detachment's enhancements",
   "cols": "name:gw pts:newrecruit text:gw upgrade:bsdata nr:newrecruit limit:wahapedia mods:ai-reading aura:ai-reading guard:ai-reading"
  },
  "ARMIES": {
   "what": "one row per list",
   "cols": "id:hand name:newrecruit faction:newrecruit points:newrecruit pointsUsed:newrecruit battleSize:newrecruit disposition:newrecruit detachments:newrecruit source:newrecruit config:newrecruit units:newrecruit"
  },
  "ARMIES.units": {
   "what": "a list's unit entries: what the list chose; the datasheet's facts are in DATASHEETS",
   "cols": "id:derived ds:derived pts:newrecruit ptsNote:newrecruit copies:newrecruit models:newrecruit gear:newrecruit unplaced:newrecruit enhancement:newrecruit warlord:newrecruit enhOn:newrecruit warlordOn:newrecruit ref:hand upgrade:newrecruit leads:newrecruit support:newrecruit also:newrecruit short:hand role:newrecruit name:newrecruit rules:newrecruit kw:newrecruit kwNote:hand kwOnly:hand partialRules:hand srcNote:hand stats:newrecruit ranged:newrecruit melee:newrecruit abilities:newrecruit mods:ai-reading aura:ai-reading guard:ai-reading over:hand note:hand why:derived"
  },
  "ARMIES.units.stats": {
   "what": "a row naming its datasheet row by name (a stats row by its model's name, \"×N\" its count in the attached unit), with only the list's own fields",
   "cols": "name:newrecruit from:bsdata printed:newrecruit own:gw M:bsdata T:bsdata Sv:bsdata W:bsdata Ld:bsdata OC:bsdata InSv:bsdata base:bsdata over:hand of:derived why:derived"
  },
  "ARMIES.units.ranged": {
   "what": "a row naming its datasheet row by name (a stats row by its model's name, \"×N\" its count in the attached unit), with only the list's own fields",
   "cols": "name:newrecruit who:newrecruit n:newrecruit from:bsdata enh:newrecruit range:bsdata A:bsdata BS:bsdata WS:bsdata S:bsdata AP:bsdata D:bsdata kw:bsdata over:hand of:derived why:derived"
  },
  "ARMIES.units.melee": {
   "what": "a row naming its datasheet row by name (a stats row by its model's name, \"×N\" its count in the attached unit), with only the list's own fields",
   "cols": "name:newrecruit who:newrecruit n:newrecruit from:bsdata enh:newrecruit range:bsdata A:bsdata BS:bsdata WS:bsdata S:bsdata AP:bsdata D:bsdata kw:bsdata over:hand of:derived why:derived"
  },
  "ARMIES.units.abilities": {
   "what": "a row naming its datasheet row by name (a stats row by its model's name, \"×N\" its count in the attached unit), with only the list's own fields",
   "cols": "name:newrecruit who:newrecruit over:hand of:derived text:wahapedia tag:newrecruit ph:derived turn:derived turns:derived at:derived def:ai-reading defOf:derived note:hand na:hand damaged:ai-reading riled:ai-reading defAlways:ai-reading defCalc:ai-reading calcDef:ai-reading lasts:ai-reading fightOnDeath:ai-reading comeback:ai-reading calcNote:ai-reading defPh:derived why:derived readOf:derived"
  },
  "ARMIES.units.mods": {
   "what": "footnotes under a unit's weapon tables: the list's own (why names the reason), or a reading two lists have otherwise (verify/out/tables.md); a name in the list stands for the readings of that name the rows give (the list's order)",
   "cols": "kind:ai-reading weapon:ai-reading who:ai-reading set:ai-reading when:ai-reading cond:ai-reading note:ai-reading from:ai-reading pick:ai-reading rule:ai-reading lasts:ai-reading vs:ai-reading needs:ai-reading selfWhen:ai-reading selfAlways:ai-reading notSelf:ai-reading one:ai-reading readOf:derived readBy:derived listWhy:hand"
  },
  "ARMIES.units.aura": {
   "what": "what a unit gives other units of its list: the list's own (why names the reason), or a reading two lists have otherwise (verify/out/tables.md); a name in the list stands for the readings of that name the rows give (the list's order)",
   "cols": "kind:ai-reading weapon:ai-reading who:ai-reading set:ai-reading when:ai-reading cond:ai-reading note:ai-reading from:ai-reading pick:ai-reading rule:ai-reading lasts:ai-reading vs:ai-reading needs:ai-reading selfWhen:ai-reading selfAlways:ai-reading notSelf:ai-reading one:ai-reading readOf:derived readBy:derived listWhy:hand"
  },
  "ARMIES.units.guard": {
   "what": "help a unit gives other units of its list when they are attacked: the list's own (why names the reason), or a reading two lists have otherwise (verify/out/tables.md); a name in the list stands for the readings of that name the rows give (the list's order)",
   "cols": "kind:ai-reading weapon:ai-reading who:ai-reading set:ai-reading when:ai-reading cond:ai-reading note:ai-reading from:ai-reading always:ai-reading calc:ai-reading pick:ai-reading rule:ai-reading lasts:ai-reading vs:ai-reading needs:ai-reading selfWhen:ai-reading selfAlways:ai-reading oneModel:ai-reading notSelf:ai-reading one:ai-reading readOf:derived readBy:derived listWhy:hand"
  },
  "DATASHEETS": {
   "what": "one row per datasheet (faction + datasheet name): its facts, shared by every list that has it",
   "cols": "name:newrecruit faction:derived bsId:bsdata role:newrecruit rules:newrecruit kw:newrecruit kwOnly:hand partialRules:hand srcNote:hand leaders:bsdata stats:newrecruit ranged:newrecruit melee:newrecruit abilities:wahapedia mods:ai-reading aura:ai-reading guard:ai-reading points:gw composition:bsdata options:bsdata aiStatus:derived"
  },
  "DATASHEETS.stats": {
   "what": "a datasheet's model profiles",
   "cols": "name:newrecruit M:newrecruit T:newrecruit Sv:newrecruit W:newrecruit Ld:newrecruit OC:newrecruit InSv:newrecruit base:newrecruit baseWith:gw"
  },
  "DATASHEETS.ranged": {
   "what": "a datasheet's ranged weapon profiles",
   "cols": "name:newrecruit range:newrecruit A:newrecruit BS:newrecruit WS:newrecruit S:newrecruit AP:newrecruit D:newrecruit kw:newrecruit group:bsdata fireAll:bsdata hunter:newrecruit carrier:gw"
  },
  "DATASHEETS.melee": {
   "what": "a datasheet's melee weapon profiles",
   "cols": "name:newrecruit range:newrecruit A:newrecruit BS:newrecruit WS:newrecruit S:newrecruit AP:newrecruit D:newrecruit kw:newrecruit group:bsdata fireAll:bsdata hunter:newrecruit carrier:gw"
  },
  "DATASHEETS.abilities": {
   "what": "a datasheet's abilities",
   "cols": "name:newrecruit who:newrecruit text:wahapedia tag:newrecruit ph:derived turn:derived turns:derived at:derived def:ai-reading defOf:derived note:hand na:hand damaged:ai-reading riled:ai-reading defAlways:ai-reading defCalc:ai-reading calcDef:ai-reading lasts:ai-reading fightOnDeath:ai-reading comeback:ai-reading calcNote:ai-reading defPh:derived readOf:derived"
  },
  "RULE_OPTIONS": {
   "what": "the options inside a rule or ability, each with the phases its words give",
   "cols": "rule:derived option:derived text:derived found:derived explicit:derived trigger:derived used:derived phases:derived"
  },
  "GRANTS": {
   "what": "a rule or option giving units an ability or keyword",
   "cols": "rule:derived option:derived grants:derived type:derived to:derived while:derived text:derived"
  },
  "BS_IDS": {
   "what": "the BSData ids the list import resolves an export by (verify/import-ids.js --write)",
   "cols": "factions:bsdata roots:bsdata battleSizes:bsdata limits:bsdata dispositions:bsdata detachments:bsdata config:bsdata configKids:bsdata info:bsdata infoKids:bsdata units:bsdata names:bsdata maxPerList:bsdata"
  },
  "DATASHEETS.mods": {
   "what": "the readings of the datasheet's abilities (and of a core rule on its Rules line, or a weapon ability it defines) as footnotes under its weapon tables: every list with the datasheet has them",
   "cols": "kind:ai-reading weapon:ai-reading who:ai-reading set:ai-reading when:ai-reading cond:ai-reading note:ai-reading from:ai-reading pick:ai-reading rule:ai-reading lasts:ai-reading vs:ai-reading needs:ai-reading selfWhen:ai-reading selfAlways:ai-reading notSelf:ai-reading one:ai-reading readOf:derived readBy:derived listWhy:hand"
  },
  "DATASHEETS.aura": {
   "what": "the readings of the datasheet's abilities as what it gives other units of its list",
   "cols": "kind:ai-reading weapon:ai-reading who:ai-reading set:ai-reading when:ai-reading cond:ai-reading note:ai-reading from:ai-reading pick:ai-reading rule:ai-reading lasts:ai-reading vs:ai-reading needs:ai-reading selfWhen:ai-reading selfAlways:ai-reading notSelf:ai-reading one:ai-reading readOf:derived readBy:derived listWhy:hand"
  },
  "DATASHEETS.guard": {
   "what": "the readings of the datasheet's abilities as help it gives other units of its list when they are attacked",
   "cols": "kind:ai-reading weapon:ai-reading who:ai-reading set:ai-reading when:ai-reading cond:ai-reading note:ai-reading from:ai-reading always:ai-reading calc:ai-reading pick:ai-reading rule:ai-reading lasts:ai-reading vs:ai-reading needs:ai-reading selfWhen:ai-reading selfAlways:ai-reading oneModel:ai-reading notSelf:ai-reading one:ai-reading readOf:derived readBy:derived listWhy:hand"
  },
  "FACTIONS.readings": {
   "what": "the readings (mods, aura, guard) of an army rule, detachment rule or enhancement, on its row: every unit the rule reaches (an army rule on its Rules line, a detachment rule whose needs it meets) or the enhancement's bearer has them",
   "cols": "kind:ai-reading weapon:ai-reading who:ai-reading set:ai-reading when:ai-reading cond:ai-reading note:ai-reading from:ai-reading pick:ai-reading rule:ai-reading lasts:ai-reading vs:ai-reading needs:ai-reading selfWhen:ai-reading selfAlways:ai-reading notSelf:ai-reading one:ai-reading readOf:derived readBy:derived listWhy:hand"
  },
  "BOXES": {
   "what": "the Damage tab's boxes of each rule, ability and stratagem of the lists (a|, r|, s|, c| + the hash of its name and text, as the app finds it): made by script from GW's words (verify/effects-migrate.js --write, verify/effects-extract.js, effects.js); the gate step evidence (verify/evidence.js) checks each against the words and that this table is exactly what they give",
   "cols": "n:derived b:derived nc:derived reach:derived both:derived embarked:derived"
  },
  "BOXES.b": {
   "what": "one box of the Damage tab: what GW's sentence does, as the catalogue (effects.js) reads it",
   "cols": "quote:gw lead:gw fx:derived on:derived kind:derived scope:derived reach:derived mark:derived notSelf:derived lasts:derived opt:derived pick:derived part:derived limit:derived tableRows:derived pool:derived excl:derived"
  }
 }
};
