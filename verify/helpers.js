// The app's own judgements, each next to the rules text it rests on, and their sign-off.
//
// The paper packet has rules text; the app adds judgements on top: footnotes under weapons,
// "When targeted" entries, the phase and turn a rule is listed in, which units a stratagem is
// for, notes, and the code that turns weapons into "Pick one / Shoots with both".
// Every one of them is an item here. Its key is a hash of the judgement AND of the source text it
// summarises, so changing either one voids its approval: it must be checked again.
//
// node verify/helpers.js            list items without an approval (verify/out/helpers-todo.json)
// node verify/helpers.js --prune    also drop approvals of judgements that no longer exist
// approvals live in verify/approvals.json: { key: { verdict:'ok', by, at, why } }
const fs = require('fs'), path = require('path');
const { ROOT, key, loadData, readJSON, writeJSON } = require('./lib');

function items(D, appSource){
  const out = [];
  const add = (army, kind, where, judgement, source) => out.push({ army, kind, where, judgement, source,
    key:key(kind + '\n' + JSON.stringify(judgement) + '\n' + JSON.stringify(source)) });
  const fr = f => D.factions[f];
  const ruleText = (army, name) => {
    const a = D.armies.find(x => x.id === army), f = fr(a.faction);
    const ar = f.armyRules.find(r => r.name === name);
    if(ar) return ar.text + (ar.table ? '\n' + ar.table.map(r => r.join(': ')).join('\n') : '');
    for(const d of a.detachments.map(id => f.detachments[id])) if(d && d.rule && d.rule.name === name) return d.rule.text;
    return D.rules[name] || null;
  };
  const strat = (army, nameOrId) => {
    const a = D.armies.find(x => x.id === army), f = fr(a.faction);
    const all = a.detachments.flatMap(id => (f.detachments[id] || {}).stratagems || []).concat(D.coreStratagems);
    return all.find(s => s.id === nameOrId || s.name === nameOrId);
  };
  const stratText = s => s && ['WHEN: ' + s.when, 'TARGET: ' + s.target, 'EFFECT: ' + s.effect, s.restrictions ? 'RESTRICTIONS: ' + s.restrictions : ''].filter(Boolean).join('\n');
  // the text a footnote or aura cites: the unit's ability, a rule, or a stratagem
  const cited = (army, u, m) => {
    const ab = (u.abilities || []).find(x => x.name === m.from);
    if(ab) return { ability:ab.name, text:ab.text };
    const r = ruleText(army, m.rule || m.from);
    if(r) return { rule:m.rule || m.from, text:r };
    const s = strat(army, m.from);
    if(s) return { stratagem:s.name, text:stratText(s) };
    return { missing:'nothing in the data is named ' + m.from };
  };

  for(const a of D.armies){
    for(const u of a.units){
      const w = a.id + ' · ' + u.name;
      const unitFacts = { models:u.models, stats:u.stats.map(s => s.name + ' W' + s.W + ' OC' + s.OC), weapons:[...(u.ranged || []), ...(u.melee || [])].map(x => [x.group, x.name, x.A, x.AP, x.D, (x.kw || []).join(', ')].filter(Boolean).join(' ')) };
      for(const ab of u.abilities){
        const src = { ability:ab.name, text:ab.text };
        if(ab.ask) add(a.id, 'ability-ask', w + ' · ' + ab.name, { ask:ab.ask }, src);
        if(ab.ph || ab.turn) add(a.id, 'ability-timing', w + ' · ' + ab.name, { ph:ab.ph, turn:ab.turn, turns:ab.turns }, src);
        if(ab.tag) add(a.id, 'ability-tag', w + ' · ' + ab.name, { tag:ab.tag }, src);
        if(ab.who) add(a.id, 'ability-who', w + ' · ' + ab.name, { who:ab.who, models:u.models }, src);
        if(ab.def) add(a.id, 'ability-def', w + ' · ' + ab.name, { def:ab.def, defPh:ab.defPh }, src);
        // a note under the ability (an FAQ, a core rule it meets, a question the rules leave open): its own words are the app's
        // (the quotes in it are checked by verify/texts.js); the source is the unit's abilities and the list's rules it may quote
        if(ab.note) add(a.id, 'ability-note', w + ' · ' + ab.name, { note:ab.note }, { ability:ab.name, text:ab.text,
          others:u.abilities.filter(x => x !== ab).map(x => x.name + ': ' + x.text), listRules:fr(a.faction).armyRules.map(r => r.name).concat(a.detachments.map(id => (fr(a.faction).detachments[id].rule || {}).name).filter(Boolean)) });
        if(ab.na) add(a.id, 'ability-na', w + ' · ' + ab.name, { na:ab.na, armyUnits:a.units.map(x => x.name + ' [' + x.kw.join(', ') + ']') }, src);
        if(ab.damaged) add(a.id, 'ability-damaged', w + ' · ' + ab.name, { damaged:ab.damaged, W:u.stats[0].W }, src);
        // the Damage tab's reading of it: always protects the unit (defAlways), its numbers (defCalc), always riled up (riled)
        // (calcDef: a "when targeted" line the Damage tab alone shows, lasts: how long it carries; embarked: a model not on the battlefield yet)
        if(ab.defAlways || ab.defCalc || ab.riled || ab.calcDef || ab.embarked) add(a.id, 'ability-calc', w + ' · ' + ab.name, { def:ab.def, calcDef:ab.calcDef, defAlways:ab.defAlways, defCalc:ab.defCalc, lasts:ab.lasts, riled:ab.riled, embarked:ab.embarked, models:u.models }, src);
        // and what it plays in the turn (fightOnDeath: One Last Kill; comeback: Berserker Frenzy), what is approximate about it (calcNote)
        if(ab.fightOnDeath || ab.comeback || ab.calcNote) add(a.id, 'ability-turn', w + ' · ' + ab.name, { fightOnDeath:ab.fightOnDeath, comeback:ab.comeback, calcNote:ab.calcNote, who:ab.who, models:u.models }, src);
      }
      for(const m of u.mods || []) add(a.id, 'unit-footnote', w, m, cited(a.id, u, m));
      for(const m of u.aura || []) add(a.id, 'unit-aura', w, m, cited(a.id, u, m));
      for(const m of u.guard || []) add(a.id, 'unit-guard', w, m, cited(a.id, u, m));
      for(const k of ['kwNote', 'ptsNote', 'note']) if(u[k]) add(a.id, 'unit-' + k, w, { [k]:u[k] }, unitFacts);
      // a rule only one model of the unit has (Canis Rex's Lone Operative is Sir Hekhtur's): the unit can't use a rule every model
      // must have, and the app names that model
      if(u.partialRules) add(a.id, 'unit-partialRules', w, { partialRules:u.partialRules }, { models:u.models, rules:u.rules, abilities:u.abilities.map(x => (x.who ? x.who + ' · ' : '') + x.name + ': ' + x.text) });
      // keywords only some models of the unit have (Rubric Marines: "ASPIRING SORCERER ONLY: PSYKER"): listed apart on the datasheet
      if(u.kwOnly) add(a.id, 'unit-kwOnly', w, { kwOnly:u.kwOnly }, { models:u.models, kw:u.kw, kwNote:u.kwNote || null });
      // where the sources disagree about the unit (Wahapedia's Tyrannofex FRAME, Sir Hekhtur's own datasheet), marked on its datasheet
      if(u.srcNote) add(a.id, 'unit-srcNote', w, { srcNote:u.srcNote }, { models:u.models, kw:u.kw });
      // weapons: which model has which, how many, and the multi-profile groups
      // unplaced: wargear on no models line (undefined, so left out of the key, for every other unit)
      add(a.id, 'unit-weapons', w, { gear:u.gear, unplaced:u.unplaced, weapons:[...(u.ranged || []), ...(u.melee || [])].map(x => [x.who, x.n && '×' + x.n, x.group, x.name].filter(Boolean).join(' · ')) }, { models:u.models, leads:u.leads || null });
    }
    // the faction's and detachments' rules and stratagems the army uses
    const f = fr(a.faction);
    const rulesMeta = (where, r, srcText) => {
      const src = { rule:r.name, text:srcText };
      // (calcMods, calcDefs, calcNc, both, limit: the Damage tab's own reading of an army rule; parts: the parts of a detachment rule
      // for some of its units only, each with its needs and its footnote, "When targeted" line or the army rule it gives)
      for(const k of ['ph', 'turn', 'turns', 'needs', 'def', 'mod', 'note', 'tag', 'statNote', 'missing', 'ask', 'calcMods', 'calcDefs', 'calcNc', 'both', 'limit', 'parts']) if(r[k] !== undefined) add(a.id, 'rule-' + k, where + ' · ' + r.name, { [k]:r[k] }, src);
      // an army rule shown with the core ability of the same name (Super-heavy Walker): the pairing, against both texts
      if(r.coreTwin !== undefined) add(a.id, 'rule-coreTwin', where + ' · ' + r.name, { coreTwin:r.coreTwin }, { rule:r.name, text:srcText, core:D.rules[r.coreTwin] || null });
    };
    for(const r of f.armyRules) rulesMeta(a.faction + ' army rule', r, r.text + (r.table ? '\n' + r.table.map(t => t.join(': ')).join('\n') : ''));
    for(const id of a.detachments){
      const d = f.detachments[id];
      if(d.rule) rulesMeta(d.name + ' rule', d.rule, d.rule.text + (d.rule.table ? '\n' + d.rule.table.map(t => t.join(': ')).join('\n') : ''));
      for(const s of d.stratagems || []) for(const k of ['phases', 'turn', 'turns', 'needs', 'mod', 'def', 'defCalc', 'defPick', 'calcNote', 'lasts', 'gist', 'note', 'cpNote', 'ask', 'shield', 'help', 'react', 'weaponKw'])
        if(s[k] !== undefined) add(a.id, 'strat-' + k, d.name + ' · ' + s.name, { [k]:s[k] }, { stratagem:s.name, text:stratText(s) });
    }
  }
  for(const s of D.coreStratagems) for(const k of ['phases', 'turn', 'turns', 'needs', 'mod', 'def', 'defCalc', 'defPick', 'calcNote', 'lasts', 'gist', 'note'])
    if(s[k] !== undefined) add('core', 'strat-' + k, 'Core · ' + s.name, { [k]:s[k] }, { stratagem:s.name, text:stratText(s) });
  // app notes inside core rules text, and which rule each keyword spelling opens
  for(const [name, text] of Object.entries(D.rules)) for(const line of text.split('\n')) if(/^\*App note/.test(line))
    add('core', 'rule-appnote', name, { note:line }, { rule:name, text:text.split('\n').filter(l => l !== line).join('\n') });
  for(const [re, k] of D.ruleAliases) add('core', 'rule-alias', String(re), { opens:k }, { rule:k, text:(D.rules[k] || '').slice(0, 300) });
  for(const f of Object.values(D.factions)) for(const [re, k] of f.aliases || []) add(f.name, 'rule-alias', String(re), { opens:k }, { rule:k });
  // the code that applies the core rules: reviewed as code, against the rules it implements
  for(const [name, src] of Object.entries(appSource)) add('code', 'code', name, { code:src }, { implements:CODE_RULES[name] || '' });
  return out;
}

// the app functions that decide what a player is told, and the rules each one implements
const CODE_RULES = {
  useSentence:'04.01 Select Weapons; Close-quarters (non-MONSTER/VEHICLE: pistols or other ranged weapons); Extra Attacks (24.11); a multi-profile weapon uses one profile (04.01.03)',
  useLine:'which models carry which weapons (gear per models line); attached units (19.04)',
  weaponJoins:'the dividers between weapon rows: 04.01 Select Weapons (ranged: every weapon the model has; melee: one, [EXTRA ATTACKS] on top); Close-quarters (a non-MONSTER/VEHICLE model: its [CLOSE-QUARTERS] weapons or the others); per models line (gear); attached units by part',
  unitMods:'which footnotes a unit gets: its own, detachment rules matching its keywords (and the parts of a detachment rule whose needs it meets), auras, stratagems it is eligible for, and those another unit of the list is the target of whose effect changes its attacks (helpedBy); Lance (+1 to wound after a charge); Plunging Fire for TOWERING (22.05)',
  helpedBy:'a stratagem whose TARGET is another unit of the list (help.by) and whose effect changes this unit\'s attacks (help.to: Daemonic Fury, a BLOOD LEGIONS target selecting a friendly WORLD EATERS unit within 6"): listed on this unit\'s datasheet with who is its target, its footnote on this unit',
  unitDetParts:'the parts of a detachment rule that apply to a unit: those of the rules that apply to it (by keyword) whose own needs it meets (Blood Tithe: Daemonic Rage and Boon of Blood for BLOOD LEGIONS units, Might of Khorne giving them the Blessings of Khorne ability)',
  singleMod:'Starting Strength for a one-model unit (Core Rules p86)',
  halfBelow:'Below half-strength for a one-model unit: remaining wounds less than half its W',
  defenceItems:'what protects a unit when targeted: Feel No Pain, defensive abilities, detachment rules (and the parts of one whose needs it meets), stratagems usable in that phase, the Orks riled-up 5+ invulnerable save; on the datasheet (opts.shields) also a stratagem another unit of the list takes the hits with (Grot Shields: a GRETCHIN unit for an ORKS INFANTRY unit, excluding GRETCHIN), and what another unit of the list gives this one when it is attacked (its guard entries whose needs it meets: Emanatus Forcefield, Shroudpsalm, Omnissiah\'s Blessing, Necromechanic)',
  onceTag:'"Once per …" limits shown on the ability row',
  isEnhancement:'the Enhancement chip on an ability row: its tag is "Enhancement" or has it as one part ("Enhancement · Aura": Final Howl, Necromechanic)',
  matches:'stratagem/rule eligibility by keywords (all / any / none)',
  inertRule:'rules that do nothing in this list (e.g. Bondsman without ARMIGER models)',
  auraMods:'auras from other units in the list',
  proxyLines:'Bases & proxies: bases per models line and what to mark',
  unplacedOf:'wargear New Recruit lists for the unit but on no models line (data.js unplaced): shown with its count, and that New Recruit does not say which models carry it (Models, weapon row, Bases & proxies)',
  perBattle:'tick boxes: how many uses a rule allows per battle ("once"/"twice"/"three times per battle") and whether they are counted per army or for each unit',
  abilityTicks:'tick boxes on an ability row: one set per army, or one per unit copy',
  grantSource:'"Granted by": which ability, detachment rule or army rule a marked value names',
  showGrant:'"Granted by": a value or keyword that a rule of the list already changed (from BSData\'s modifiers, checked against New Recruit\'s "(…)" marks): the rule\'s text, and that the value shown includes it',
  screenPregame:'Overview (before the battle): Warlord, enhancements, attached units, detachments (each opens its detachment rule), the army rules (folded), units with Deep Strike (24.09: every model must have it), transports, Scouts and Infiltrators (24.31, 24.20: every model must have it), start of the battle / round 1 / every round, once-per-battle items; the army rules block also holds the detachment rules (as on the Rules tab); an enhancement\'s holder by its full name when another unit of the list has the same short name',
  shortWhen:'the timing tag on an ability or rule row: a moment before any phase (at: "Start of the battle round", 07.01), the phases and whose turn (07.02.02), "Any phase" only when every phase has the same turn',
  ruleParts:'a New Recruit selection under the army name that only names an army rule\'s parts ("Code Chivalric: Deed, Quality": BSData\'s Deed and Quality are fixed sub-entries holding every option), not a pick: left out of the Overview\'s list',
  pickOptions:'the options a "select one of the abilities in the X section" / "select one X ability" asks for: the unit\'s abilities printed under that section, or the ability named X that lists them',
  // the list import (import.js, and its sheet in app.html)
  resolve:'the list import\'s entry (import.js): text or JSON in, never an exception out: a malformed export (malformed) or one that cannot be read is refused with a message',
  malformed:'the shape an export must have before it is read: a roster with one force whose selections (at every depth) are objects with a text entryId, name and type, a whole-number count, and lists of selections, costs and associations',
  resolveRoster:'the list import (import.js): a New Recruit JSON export becomes a list only when its faction, its one battle size (its points limit BSData\'s for it, and the total within it), its one detachment selection (each detachment once), its one Force Disposition (one its detachments allow), its config (Code Chivalric, known choices) and every other top-level selection (Show/Hide Options, rules references, with known choices only) are what data.js has, and every unit, with the characters attached to it (New Recruit\'s Leading/Supporting), has the BSData signature (signature) of a unit of a data.js list with the same faction, detachments, config and battle size, the same BSData names and the same points (BS_IDS, written by verify/import-ids.js); an option holding models is taken once; then the list as a whole: at most one Warlord (none only as a list of the app has none), each entry no more often than BSData\'s max per list that no modifier changes (an enhancement once, an Epic Hero once), the units adding up to the total; then the units are copied as data.js has them (a unit taken again as its copies; import-nr.js\'s order: role, units without a leader, the roster\'s order); otherwise nothing is imported and every item not recognized is listed (and a group the closest unit explains no difference of is still refused)',
  signature:'a unit part\'s identity for the import: every selection below it as a path of BSData entry ids with its count (every option, a bundle of weapons too; the same path twice adds up; an option holding models counts once, its models carry the count), the same for the export and for BS_IDS',
  runImport:'Import (the sheet): a refused export (or one resolve cannot read) lists every message, one per line, and nothing is kept; an imported one is kept on the phone as the export (resolved again at every start, each in a try: one that cannot be read is listed as out of date), gets an id no list has, and opens; if the phone cannot keep it, the toast says so',
  importedFoot:'an imported list\'s Overview ends with where it came from, whether this phone keeps it, and Remove this list (a confirm on the page: Remove / Keep it)',
  removeImported:'Remove: the list leaves the phone (the kept export, the list, its per-battle ticks and its Phase checklist boxes), the app goes to the home screen',
  // the Phase checklist screen
  screenChecklist:'Phase checklist: the triggered (ckTriggered) army and detachment rules, the options of a triggered rule (and an option with a trigger of its own; unless a unit of the list has it as an ability: listed as theirs) and the triggered abilities of the list (the same one on several units one line), by data.js CHECKLIST (verify/derive.js): To do now in each phase and turn its text says it is triggered (07.02: the phases; either turn: both), or under the moment it opens with (Start of the (first) battle round, End of your opponent\'s turn); Active now where its effect is used and it is not triggered; once-per-battle ones (perBattle; Kindred Sorcery\'s options each) under Once per battle, from where they are triggered, with the Overview\'s boxes; each line names its unit or source and opens the full text; a rule another rule of the list gives to units by keyword (g) says which and to whom; inert rules and abilities the list cannot use are listed, marked; triggered ones the table cannot place under When unclear, those with no phase under No phase; no stratagems; each section a fold (closed until opened, kept for the session), its line counting each part; a box per line per section, kept per list; Reset clears them (with Undo), not the once-per-battle ones',
  ckTriggered:'which rules and abilities the Phase checklist lists ("triggered"; always-on ones are on the datasheets): the CHECKLIST entry names when (t or at, from verify/derive.js), or the words or tag limit its uses (once/twice/three times per battle, battle round, turn or phase), have the player act (you can use this ability / can use it / this part / this Enhancement, you can select or choose, select or choose one…, when …, you can … other than a re-roll, can make a named move or action: "can make a Warpmeld Sacrifice"), or roll dice or take a test when something happens (roll one/two/a/an/N/up to…, not a re-roll; take a … test)',
  ckOption:'an option of a rule or ability on the Phase checklist: its own trigger (and where it is used); with none, where its effect is used (chosen when its rule is triggered: a once-per-battle one is listed there); with neither, its rule\'s trigger; not derivable: When unclear',
  ckEntry:'data.js CHECKLIST (verify/derive.js --write), the Phase checklist table: per rule and ability, from its text without its options (withoutOptions): t the phases its text names (table 1\'s trigger) less those only the moment it opens with gives (Start of the battle round: not also the Command phase), at that moment, u where its effect is used (table 1\'s used-in); none: positively no phase (pre-battle); x: not derivable (nothing guessed); per option (optionsOf) its own trigger only when it names one, where it is used, x when it has neither and no trigger of its rule; g: an ability it gives units by keyword (grantsIn: to, the option, while); the same words on several units must give one entry, else x',
  withoutOptions:'a rule\'s or ability\'s own words for the Phase checklist table: its text without its italic notes and without the text of each of its options (each option has its own entry)',
  ckStored:'a rule or ability the derived table cannot place (x) but data.js has a phase tag for (ph, turn, at): listed where the tag says it triggers (the row\'s own timing), as To do now',
};
function appFunctions(html){
  const out = {};
  html += '\n' + fs.readFileSync(path.join(ROOT, 'import.js'), 'utf8');   // the list import's own file, reviewed as code like the app's
  html += '\n' + fs.readFileSync(path.join(ROOT, 'verify/derive.js'), 'utf8');   // and how verify/derive.js writes data.js CHECKLIST (the Phase checklist table)
  for(const name of Object.keys(CODE_RULES)){
    const m = new RegExp('\\n(function ' + name + '\\(|const ' + name + ' = )').exec(html);
    if(!m){ out[name] = 'MISSING'; continue; }
    // up to the next top-level declaration
    const rest = html.slice(m.index + 1), end = rest.slice(1).search(/\n(function |const |let |\/\/ |\/\*)/);
    out[name] = rest.slice(0, end < 0 ? undefined : end + 1).trim();
  }
  return out;
}

if(require.main === module){
  const D = loadData();
  const list = items(D, appFunctions(fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8')));
  const approvals = readJSON(path.join(ROOT, 'verify/approvals.json'), {});
  const uniq = new Map(list.map(x => [x.key, x]));
  const todo = [...uniq.values()].filter(x => !approvals[x.key] || approvals[x.key].verdict !== 'ok');
  const stale = Object.keys(approvals).filter(k => !uniq.has(k));
  // --prune: drop approvals of judgements that no longer exist (a removed list, a rewritten text); git keeps them
  if(process.argv.includes('--prune') && stale.length){ for(const k of stale) delete approvals[k]; writeJSON(path.join(ROOT, 'verify/approvals.json'), approvals); console.log('pruned ' + stale.length + ' stale approvals'); stale.length = 0; }
  writeJSON(path.join(ROOT, 'verify/out/helpers-todo.json'), todo);
  writeJSON(path.join(ROOT, 'verify/out/helpers-all.json'), [...uniq.values()]);
  writeJSON(path.join(ROOT, 'verify/out/helpers.json.summary'), { items:uniq.size, approved:uniq.size - todo.length, todo:todo.length, stale:stale.length });
  const byKind = {}; for(const x of todo) byKind[x.kind] = (byKind[x.kind] || 0) + 1;
  console.log('helpers: ' + uniq.size + ' judgements, ' + (uniq.size - todo.length) + ' approved, ' + todo.length + ' to check' + (stale.length ? ', ' + stale.length + ' stale approvals' : ''));
  console.log('  ' + Object.entries(byKind).map(([k, n]) => k + ' ' + n).join(' · '));
  process.exit(todo.length ? 1 : 0);
}
module.exports = { items, appFunctions };
