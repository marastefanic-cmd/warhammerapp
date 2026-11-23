// written by verify/run.js: the last verification of this app.html + data.js
window.WH_VERIFIED = {
 "ok": true,
 "build": "a85fc35839",
 "data": "2026-11-23.4",
 "date": "23 Nov 2026",
 "checks": [
  {
   "label": "Your New Recruit lists:",
   "detail": "every unit, model count, wargear, enhancement, stat line, weapon profile and ability matches the PDF (11284 facts)."
  },
  {
   "label": "Games Workshop’s datasheets,",
   "detail": "as Wahapedia transcribes them: every stat and weapon number (9900 numbers), every keyword and every ability text."
  },
  {
   "label": "Granted values:",
   "detail": "every keyword or value marked + is one New Recruit shows otherwise than GW’s datasheet, named as a rule your unit has whose GW wording names it (258 values)."
  },
  {
   "label": "Games Workshop’s rules text:",
   "detail": "every rule, enhancement and stratagem is the wording of GW’s newest official document, or Wahapedia where GW has none (6296 texts)."
  },
  {
   "label": "Rules logic:",
   "detail": "each stratagem is offered in the phases its WHEN names and to the units its TARGET names; every number in a footnote is in the rule it cites."
  },
  {
   "label": "The app’s own notes:",
   "detail": "800 footnotes, phase tags and summaries, each read against its rule and signed off; a changed rule voids its sign-off."
  },
  {
   "label": "Every screen:",
   "detail": "3383 screens and popups render on a 390 and a 320px-wide phone; they list every ability, open every link and find every name in search."
  }
 ],
 "sources": [
  {
   "label": "New Recruit:",
   "detail": "Me shooty yer’ booty, Princes, Standard, Pubstomper, Nidzillas, 6 bigs, 4 megas and a destrier, Super Terminators, Purge goes the Foe, Defilers and friends, Infernal Lance, Woof Woof, Big demons baby, Mucho Mutantes, Lite Knights, Nerf when, The Exiled Legion, Fellhammer Siege Task Force, Emperor’s Chosen, Dread Host, Navigator sounds op ngl, Tzeeeeentch, Healybois, U w0t m8?, Simple but effective, Basic Bitch (your exports and PDFs)."
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
   "cols": "name:derived source:derived"
  },
  "RULE_ALIASES": {
   "what": "which RULES entry a keyword or rule chip opens: [pattern, rule]",
   "cols": "pattern:hand rule:derived"
  },
  "CONCEPTS": {
   "what": "core terms kept out of a unit's rule list",
   "cols": "term:gw"
  },
  "CORE_STRATAGEMS": {
   "what": "the core stratagems",
   "cols": "id:hand gist:ai-summary gistOf:derived name:gw cp:gw phases:derived turn:derived turns:derived when:gw target:gw effect:gw restrictions:gw needs:derived note:gw limit:derived cpNote:derived readOf:derived"
  },
  "FACTIONS": {
   "what": "one row per faction: its army rules, detachments and aliases",
   "cols": "name:gw aliases:hand armyRules:gw detachments:gw allies:gw"
  },
  "FACTIONS.armyRules": {
   "what": "a faction's army rules",
   "cols": "name:gw text:gw table:gw tag:newrecruit ph:derived turn:derived turns:derived at:derived needs:derived coreTwin:derived note:gw tableAt:wahapedia missing:hand readOf:derived sumAtk:ai-summary sumAtkOf:derived sumDef:ai-summary sumDefOf:derived sumSt:ai-summary sumStOf:derived sumOv:ai-summary sumOvOf:derived sumFoe:ai-summary sumFoeOf:derived"
  },
  "FACTIONS.detachments": {
   "what": "a faction's detachments",
   "cols": "name:gw dispositions:wahapedia dp:gw rule:gw moreRules:gw enhancements:gw stratagems:gw nr:newrecruit waha:wahapedia aiStatus:derived"
  },
  "FACTIONS.detachments.rule": {
   "what": "a detachment's rule",
   "cols": "name:gw text:gw table:gw tag:newrecruit ph:derived turn:derived turns:derived at:derived needs:derived coreTwin:derived note:gw tableAt:wahapedia missing:hand readOf:derived sumAtk:ai-summary sumAtkOf:derived sumDef:ai-summary sumDefOf:derived sumSt:ai-summary sumStOf:derived sumOv:ai-summary sumOvOf:derived"
  },
  "FACTIONS.detachments.moreRules": {
   "what": "a detachment's further rule (moreRules), with the columns of its first",
   "cols": "name:gw text:gw table:gw tag:newrecruit ph:derived turn:derived turns:derived at:derived needs:derived coreTwin:derived note:gw tableAt:wahapedia missing:hand readOf:derived"
  },
  "FACTIONS.detachments.stratagems": {
   "what": "a detachment's stratagems",
   "cols": "id:derived gist:ai-summary gistOf:derived name:gw cp:gw phases:derived turn:derived turns:derived when:gw target:gw effect:gw restrictions:gw needs:derived note:gw limit:derived cpNote:derived readOf:derived"
  },
  "FACTIONS.detachments.enhancements": {
   "what": "a detachment's enhancements",
   "cols": "name:gw pts:newrecruit text:gw upgrade:wahapedia nr:newrecruit limit:wahapedia sumAtk:ai-summary sumAtkOf:derived sumDef:ai-summary sumDefOf:derived sumSt:ai-summary sumStOf:derived sumOv:ai-summary sumOvOf:derived"
  },
  "ARMIES": {
   "what": "one row per list",
   "cols": "id:hand name:newrecruit faction:newrecruit points:newrecruit pointsUsed:newrecruit battleSize:newrecruit disposition:newrecruit detachments:newrecruit source:newrecruit config:newrecruit units:newrecruit"
  },
  "ARMIES.units": {
   "what": "a list's unit entries: what the list chose; the datasheet's facts are in DATASHEETS",
   "cols": "id:derived ds:derived pts:newrecruit ptsNote:newrecruit copies:newrecruit models:newrecruit gear:newrecruit unplaced:newrecruit enhancement:newrecruit warlord:newrecruit enhOn:newrecruit warlordOn:newrecruit ref:gw upgrade:newrecruit leads:newrecruit support:newrecruit also:newrecruit short:hand role:newrecruit name:newrecruit rules:newrecruit kw:newrecruit kwNote:derived kwOnly:wahapedia partialRules:wahapedia srcNote:derived stats:newrecruit ranged:newrecruit melee:newrecruit abilities:newrecruit over:hand note:gw why:derived"
  },
  "ARMIES.units.stats": {
   "what": "a row naming its datasheet row by name (a stats row by its model's name, \"×N\" its count in the attached unit), with only the list's own fields",
   "cols": "name:newrecruit from:derived printed:newrecruit own:gw M:newrecruit T:newrecruit Sv:newrecruit W:newrecruit Ld:newrecruit OC:newrecruit InSv:newrecruit base:newrecruit over:hand of:derived why:derived"
  },
  "ARMIES.units.ranged": {
   "what": "a row naming its datasheet row by name (a stats row by its model's name, \"×N\" its count in the attached unit), with only the list's own fields",
   "cols": "name:newrecruit who:newrecruit n:newrecruit from:derived enh:newrecruit range:newrecruit A:newrecruit BS:newrecruit WS:newrecruit S:newrecruit AP:newrecruit D:newrecruit kw:newrecruit over:hand of:derived why:derived group:derived"
  },
  "ARMIES.units.melee": {
   "what": "a row naming its datasheet row by name (a stats row by its model's name, \"×N\" its count in the attached unit), with only the list's own fields",
   "cols": "name:newrecruit who:newrecruit n:newrecruit from:derived enh:newrecruit range:newrecruit A:newrecruit BS:newrecruit WS:newrecruit S:newrecruit AP:newrecruit D:newrecruit kw:newrecruit over:hand of:derived why:derived group:derived"
  },
  "ARMIES.units.abilities": {
   "what": "a row naming its datasheet row by name (a stats row by its model's name, \"×N\" its count in the attached unit), with only the list's own fields",
   "cols": "name:newrecruit who:newrecruit over:hand of:derived text:wahapedia tag:newrecruit ph:derived turn:derived turns:derived at:derived note:gw na:derived damaged:derived why:derived readOf:derived"
  },
  "DATASHEETS": {
   "what": "one row per datasheet (faction + datasheet name): its facts, shared by every list that has it",
   "cols": "name:newrecruit faction:derived role:newrecruit rules:newrecruit kw:newrecruit kwOnly:wahapedia partialRules:wahapedia srcNote:derived leaders:wahapedia stats:newrecruit ranged:newrecruit melee:newrecruit abilities:wahapedia points:gw composition:wahapedia options:wahapedia loadout:wahapedia aiStatus:derived"
  },
  "DATASHEETS.stats": {
   "what": "a datasheet's model profiles",
   "cols": "name:newrecruit M:newrecruit T:newrecruit Sv:newrecruit W:newrecruit Ld:newrecruit OC:newrecruit InSv:newrecruit base:newrecruit baseWith:gw"
  },
  "DATASHEETS.ranged": {
   "what": "a datasheet's ranged weapon profiles",
   "cols": "name:newrecruit range:newrecruit A:newrecruit BS:newrecruit WS:newrecruit S:newrecruit AP:newrecruit D:newrecruit kw:newrecruit group:wahapedia fireAll:wahapedia hunter:newrecruit carrier:gw"
  },
  "DATASHEETS.melee": {
   "what": "a datasheet's melee weapon profiles",
   "cols": "name:newrecruit range:newrecruit A:newrecruit BS:newrecruit WS:newrecruit S:newrecruit AP:newrecruit D:newrecruit kw:newrecruit group:wahapedia fireAll:wahapedia hunter:newrecruit carrier:gw"
  },
  "DATASHEETS.abilities": {
   "what": "a datasheet's abilities",
   "cols": "name:newrecruit who:newrecruit text:wahapedia tag:newrecruit ph:derived turn:derived turns:derived at:derived note:gw na:derived damaged:derived readOf:derived sumAtk:ai-summary sumAtkOf:derived sumDef:ai-summary sumDefOf:derived sumSt:ai-summary sumStOf:derived sumOv:ai-summary sumOvOf:derived sumFoe:ai-summary sumFoeOf:derived"
  },
  "RULE_OPTIONS": {
   "what": "the options inside a rule or ability, each with the phases its words give",
   "cols": "rule:derived option:derived text:derived found:derived explicit:derived trigger:derived used:derived phases:derived"
  },
  "GRANTS": {
   "what": "a rule or option giving units an ability or keyword",
   "cols": "rule:derived option:derived grants:derived type:derived to:derived pick:derived while:derived text:derived"
  },
  "NR_IDS": {
   "what": "the ids of New Recruit's data that the owner's committed exports (verify/sources/nr-json) have shown, by which the list import looks a selection up first; one no export has shown is looked up by its exact New Recruit name (verify/import-ids.js --write)",
   "cols": "factions:newrecruit roots:newrecruit battleSizes:newrecruit limits:newrecruit dispositions:newrecruit detachments:newrecruit config:newrecruit configKids:newrecruit info:newrecruit infoKids:newrecruit units:newrecruit datasheets:newrecruit names:newrecruit maxPerList:derived"
  },
  "BOXES": {
   "what": "the Damage tab's boxes of each rule, ability and stratagem of the lists (a|, r|, s|, c| + the hash of its name and text, as the app finds it): made by script from GW's words (verify/effects-migrate.js --write, verify/effects-extract.js, effects.js); the gate step evidence (verify/evidence.js) checks each against the words and that this table is exactly what they give",
   "cols": "n:derived b:derived nc:derived reach:derived both:derived embarked:derived played:derived riled:derived d:derived dnc:derived dreach:derived st:derived snc:derived"
  },
  "BOXES.b": {
   "what": "one box of the Damage tab: what GW's sentence does, as the catalogue (effects.js) reads it",
   "cols": "quote:gw lead:gw fx:derived on:derived kind:derived scope:derived reach:derived mark:derived notSelf:derived lasts:derived opt:derived pick:derived part:derived limit:derived tableRows:derived pool:derived excl:derived"
  },
  "BOXES.d": {
   "what": "one defence box: what GW's sentence does for a unit when it is attacked, as the catalogue (effects.js DF) reads it; the datasheet's \"When targeted\" line",
   "cols": "quote:gw lead:gw df:derived on:derived kind:derived scope:derived reach:derived mark:derived notSelf:derived foe:derived opt:derived pick:derived term:derived until:gw"
  },
  "BOXES.st": {
   "what": "one stat box: a characteristic of a unit’s models GW’s sentence changes, as the catalogue (effects.js ST) reads it; the line under the unit’s profile (“Not Battle-shocked: OC 7”)",
   "cols": "quote:gw st:derived on:derived reach:derived scope:derived"
  },
  "BUILD_INDEX": {
   "what": "what the in-app import builds a list with beyond the other tables (enhancement labels, the values a marked rule changes, GW’s values where New Recruit prints another): written by verify/build-index.js",
   "cols": "labels:derived marks:derived gw:derived battleSizes:derived upgrades:derived"
  },
  "AGREE": {
   "what": "which boxes of BOXES (b, d, st) two independent readings of GW's words confirm, the two-reader rule (the owner's decision, 3 Nov 2026): written by verify/agree.js --write from BOXES, reader2's readings (verify/reader2/) and the reviewed verdicts (verify/sources/agree-verdicts.json); a box not confirmed is shown as GW's words, \"see the rule\", and never counted (effects.js agreed)",
   "cols": "boxes:derived"
  }
 },
 "steps": [
  {
   "name": "data",
   "ok": true
  },
  {
   "name": "tables",
   "ok": true
  },
  {
   "name": "fingerprints",
   "ok": true
  },
  {
   "name": "readings",
   "ok": true
  },
  {
   "name": "evidence",
   "ok": true
  },
  {
   "name": "lines",
   "ok": true
  },
  {
   "name": "defence",
   "ok": true
  },
  {
   "name": "agree",
   "ok": true
  },
  {
   "name": "invariants",
   "ok": true
  },
  {
   "name": "derive",
   "ok": true
  },
  {
   "name": "choice",
   "ok": true
  },
  {
   "name": "marks",
   "ok": true
  },
  {
   "name": "dispositions",
   "ok": true
  },
  {
   "name": "points",
   "ok": true
  },
  {
   "name": "bases",
   "ok": true
  },
  {
   "name": "catalog",
   "ok": true
  },
  {
   "name": "nr",
   "ok": true
  },
  {
   "name": "texts",
   "ok": true
  },
  {
   "name": "numbers",
   "ok": true
  },
  {
   "name": "keywords",
   "ok": true
  },
  {
   "name": "words",
   "ok": true
  },
  {
   "name": "calc",
   "ok": true
  },
  {
   "name": "import",
   "ok": true
  },
  {
   "name": "reimport",
   "ok": true
  },
  {
   "name": "derived",
   "ok": true
  },
  {
   "name": "screens",
   "ok": true
  },
  {
   "name": "small phone",
   "ok": true
  },
  {
   "name": "build-parity",
   "ok": true
  },
  {
   "name": "snapshots",
   "ok": true
  },
  {
   "name": "helpers",
   "ok": true
  }
 ]
};
