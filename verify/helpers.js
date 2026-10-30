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
const detRules_ = d => d && d.rule ? [d.rule].concat(d.moreRules || []) : [];   // a detachment's rules: rule, then moreRules (Blood Legion's Blood Tainted)
// (the fingerprints of AI-written columns and readings, and readBy: not part of a judgement; a reading's key is the same on whichever
// row of data.js it is kept, as the app gets it: verify/tables.js hides them)
const FP_KEYS = require('./tables').FP_KEYS;
// a stratagem's judgements: every column of CORE_STRATAGEMS and FACTIONS.detachments.stratagems written for the app (verify/columns.json:
// hand, ai-summary, ai-reading), its id aside; the same list for the core and the detachments' stratagems
// an army or detachment rule's judgements, the same way: its columns written for the app (coreTwin aside, it has an item of its own;
// mods, aura and guard aside, signed as the unit footnote, aura and guard items of the units they reach)
const RULE_KEYS = (T => [...new Set(['FACTIONS.armyRules', 'FACTIONS.detachments.rule', 'FACTIONS.detachments.moreRules'].flatMap(t => Object.entries(T[t].columns)
  .filter(([c, x]) => !['coreTwin', 'mods', 'aura', 'guard'].includes(c) && ['hand', 'ai-summary', 'ai-reading'].includes(x.source)).map(([c]) => c)))].concat('tag'))(readJSON(path.join(ROOT, 'verify/columns.json'), {}).tables);
// (tag too: New Recruit's for most rules, but the app's own where it says more, Relentless Rage's "Already in A")
const STRAT_KEYS = (T => [...new Set(['CORE_STRATAGEMS', 'FACTIONS.detachments.stratagems'].flatMap(t => Object.entries(T[t].columns)
  .filter(([c, x]) => c !== 'id' && ['hand', 'ai-summary', 'ai-reading'].includes(x.source)).map(([c]) => c)))])(readJSON(path.join(ROOT, 'verify/columns.json'), {}).tables);

// the readings data.js keeps on a list's entry for a reason of the list (listWhy), by "<army>/<unit>"
let OWN_ = null;
const OWN = () => OWN_ || (OWN_ = (() => { const T = require('./tables'), R = T.read(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8')), m = new Map();
  for(const a of R.armies) for(const u of a.units) for(const k of T.READ) for(const x of u[k] || []) if(x && x.listWhy){ const id = a.id + '/' + u.id; if(!m.has(id)) m.set(id, []); m.get(id).push(x); }
  return m; })());
function items(D, appSource){
  const out = [];
  // (a fingerprint next to an AI-written column, gistOf / defOf, is not a judgement: verify/tables.js --fingerprints checks it)
  const add = (army, kind, where, judgement, source) => out.push({ army, kind, where, judgement, source,
    key:key(kind + '\n' + JSON.stringify(judgement, (k, v) => FP_KEYS.includes(k) ? undefined : v) + '\n' + JSON.stringify(source)) });
  const fr = f => D.factions[f];
  const ruleText = (army, name) => {
    const a = D.armies.find(x => x.id === army), f = fr(a.faction);
    const ar = f.armyRules.find(r => r.name === name);
    if(ar) return ar.text + (ar.table ? '\n' + ar.table.map(r => r.join(': ')).join('\n') : '');
    for(const d of a.detachments.map(id => f.detachments[id])) for(const r of detRules_(d)) if(r.name === name) return r.text;
    if(D.rules[name]) return D.rules[name];
    // a core rule with its value in its name ("Damaged 5"): the glossary entry its alias names, with the name (the X of "Damaged X")
    const k = (D.ruleAliases.find(([re]) => re.test(name)) || [])[1];
    return k && D.rules[k] && /\d/.test(name) ? name + ': ' + D.rules[k] : null;
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
        if(ab.tag) add(a.id, 'ability-tag', w + ' · ' + ab.name, { tag:ab.tag }, src);
        if(ab.who) add(a.id, 'ability-who', w + ' · ' + ab.name, { who:ab.who, models:u.models }, src);
        if(ab.def) add(a.id, 'ability-def', w + ' · ' + ab.name, { def:ab.def, defPh:ab.defPh }, src);
        // a note under the ability (an FAQ, a core rule it meets, a question the rules leave open): its own words are the app's
        // (the quotes in it are checked by verify/texts.js); the source is the unit's abilities and the list's rules it may quote
        if(ab.note) add(a.id, 'ability-note', w + ' · ' + ab.name, { note:ab.note }, { ability:ab.name, text:ab.text,
          others:u.abilities.filter(x => x !== ab).map(x => x.name + ': ' + x.text), listRules:fr(a.faction).armyRules.map(r => r.name).concat(a.detachments.flatMap(id => detRules_(fr(a.faction).detachments[id]).map(r => r.name))) });
        if(ab.na) add(a.id, 'ability-na', w + ' · ' + ab.name, { na:ab.na, armyUnits:a.units.map(x => x.name + ' [' + x.kw.join(', ') + ']') }, src);
        if(ab.damaged) add(a.id, 'ability-damaged', w + ' · ' + ab.name, { damaged:ab.damaged, W:u.stats[0].W }, src);
        // the Damage tab's reading of it: always protects the unit (defAlways), its numbers (defCalc), always riled up (riled)
        // (calcDef: a "when targeted" line the Damage tab alone shows, lasts: how long it carries)
        if(ab.defAlways || ab.defCalc || ab.riled || ab.calcDef) add(a.id, 'ability-calc', w + ' · ' + ab.name, { def:ab.def, calcDef:ab.calcDef, defAlways:ab.defAlways, defCalc:ab.defCalc, lasts:ab.lasts, riled:ab.riled, models:u.models }, src);
        // and what it plays in the turn (fightOnDeath: One Last Kill; comeback: Berserker Frenzy), what is approximate about it (calcNote)
        if(ab.fightOnDeath || ab.comeback || ab.calcNote) add(a.id, 'ability-turn', w + ' · ' + ab.name, { fightOnDeath:ab.fightOnDeath, comeback:ab.comeback, calcNote:ab.calcNote, who:ab.who, models:u.models }, src);
      }
      for(const m of u.mods || []) add(a.id, 'unit-footnote', w, m, cited(a.id, u, m));
      for(const m of u.aura || []) add(a.id, 'unit-aura', w, m, cited(a.id, u, m));
      for(const m of u.guard || []) add(a.id, 'unit-guard', w, m, cited(a.id, u, m));
      // a reading kept on the list, not on the row it reads, for a reason of the list (data.js listWhy, hidden from the app: the
      // bodyguard's weapons More Dakka reaches, an enhancement's +1 A in a Possessed Lord's Attacks): that reason, against the unit
      const own = (OWN().get(a.id + '/' + u.id) || []);
      for(const m of own) add(a.id, 'unit-reading-why', w, { listWhy:m.listWhy, reading:JSON.parse(JSON.stringify(m, (k, v) => FP_KEYS.includes(k) ? undefined : v)) },
        Object.assign(cited(a.id, u, m), { weapons:[...(u.ranged || []), ...(u.melee || [])].map(x => [x.who, x.name, 'A' + x.A, (x.kw || []).join(', '), JSON.stringify(x.from || {})].filter(Boolean).join(' · ')), enhancement:u.enhancement || null }));
      for(const k of ['kwNote', 'ptsNote', 'note']) if(u[k]) add(a.id, 'unit-' + k, w, { [k]:u[k] }, unitFacts);
      // a rule only one model of the unit has (Canis Rex's Lone Operative is Sir Hekhtur's): the unit can't use a rule every model
      // must have, and the app names that model
      if(u.partialRules) add(a.id, 'unit-partialRules', w, { partialRules:u.partialRules }, { models:u.models, rules:u.rules, abilities:u.abilities.map(x => (x.who ? x.who + ' · ' : '') + x.name + ': ' + x.text) });
      // keywords only some models of the unit have (Rubric Marines: "ASPIRING SORCERER ONLY: PSYKER"): listed apart on the datasheet
      if(u.kwOnly) add(a.id, 'unit-kwOnly', w, { kwOnly:u.kwOnly }, { models:u.models, kw:u.kw, kwNote:u.kwNote || null });
      // where the sources disagree about the unit (Wahapedia's Tyrannofex FRAME, Sir Hekhtur's own datasheet), marked on its datasheet
      if(u.srcNote) add(a.id, 'unit-srcNote', w, { srcNote:u.srcNote }, { models:u.models, kw:u.kw });
      // a reference sheet (not in the army until a rule or stratagem adds it): the rule it cites and its quote
      if(u.ref) add(a.id, 'unit-ref', w, { ref:u.ref }, cited(a.id, a.units.find(x => x.id === u.ref.by) || u, { from:u.ref.rule || u.ref.strat }));
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
      for(const k of RULE_KEYS) if(r[k] !== undefined) add(a.id, 'rule-' + k, where + ' · ' + r.name, { [k]:r[k] }, src);
      // an army rule shown with the core ability of the same name (Super-heavy Walker): the pairing, against both texts
      if(r.coreTwin !== undefined) add(a.id, 'rule-coreTwin', where + ' · ' + r.name, { coreTwin:r.coreTwin }, { rule:r.name, text:srcText, core:D.rules[r.coreTwin] || null });
    };
    for(const r of f.armyRules) rulesMeta(a.faction + ' army rule', r, r.text + (r.table ? '\n' + r.table.map(t => t.join(': ')).join('\n') : ''));
    for(const id of a.detachments){
      const d = f.detachments[id];
      for(const r of detRules_(d)) rulesMeta(d.name + ' rule', r, r.text + (r.table ? '\n' + r.table.map(t => t.join(': ')).join('\n') : ''));
      for(const s of d.stratagems || []) for(const k of STRAT_KEYS)
        if(s[k] !== undefined) add(a.id, 'strat-' + k, d.name + ' · ' + s.name, { [k]:s[k] }, { stratagem:s.name, text:stratText(s) });
    }
  }
  for(const s of D.coreStratagems) for(const k of STRAT_KEYS)
    if(s[k] !== undefined) add('core', 'strat-' + k, 'Core · ' + s.name, { [k]:s[k] }, { stratagem:s.name, text:stratText(s) });
  // app notes inside core rules text, and which rule each keyword spelling opens
  for(const [name, text] of Object.entries(D.rules)) for(const line of text.split('\n')) if(/^\*App note/.test(line))
    add('core', 'rule-appnote', name, { note:line }, { rule:name, text:text.split('\n').filter(l => l !== line).join('\n') });
  for(const [re, k] of D.ruleAliases) add('core', 'rule-alias', String(re), { opens:k }, { rule:k, text:(D.rules[k] || '').slice(0, 300) });
  for(const f of Object.values(D.factions)) for(const [re, k] of f.aliases || []) add(f.name, 'rule-alias', String(re), { opens:k }, { rule:k });
  // the allies a faction may take (FACTIONS.allies: the role New Recruit prints → the rule that brings them in), against those rules
  for(const f of Object.values(D.factions)) if(f.allies) add(f.name, 'faction-allies', f.name, { allies:f.allies }, { rules:Object.values(f.allies).map(n => n + ': ' + (D.rules[n] || f.armyRules.concat(Object.values(f.detachments).flatMap(detRules_)).filter(r => r.name === n).map(r => r.text).join('\n'))) });
  // a sentence verify/readings.js reads as a bonus with no reading, declared no numeric bonus after all (readings-gaps.json
  // status:'not-applicable', with its why): that declaration, against the ability's words
  for(const [k, g] of Object.entries(readJSON(path.join(ROOT, 'verify/readings-gaps.json'), {}))) if(g && g.status === 'not-applicable')
    add('core', 'reading-not-applicable', g.ability + ' · ' + k.split('|')[0], { status:g.status, why:g.why, bonus:g.bonus }, { ability:g.ability, sentence:g.sentence, units:g.units });
  // the code that applies the core rules: reviewed as code, against the rules it implements
  for(const [name, src] of Object.entries(appSource)) add('code', 'code', name, { code:src }, { implements:CODE_RULES[name] || '' });
  return out;
}

// the app functions that decide what a player is told, and the rules each one implements
const CODE_RULES = {
  useSentence:'04.01 Select Weapons; Close-quarters (non-MONSTER/VEHICLE: pistols or other ranged weapons); Extra Attacks (24.11); a multi-profile weapon uses one profile (04.01.03)',
  useLine:'which models carry which weapons (gear per models line); attached units (19.04)',
  weaponChoice:'whether a model of these weapon rows has a choice between them, said in words (useLine) under the rows, which keep GW\'s datasheet order: 04.01 Select Weapons (melee: a model with two or more melee weapons fights with one, [EXTRA ATTACKS] on top); Close-quarters (a non-MONSTER/VEHICLE model with [CLOSE-QUARTERS] weapons and other ones: those or the others); per models line (gear); attached units by part; without a choice, a weapon only one 1× models line has names that model on its row',
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
  oneOffMod:'a footnote that is a one-off use the player makes (its when, its ability\'s tag or words say once per battle: Possessed Lord): not in the weapon\'s numbers (the owner\'s decision, 2026-10-26)',
  rowMod:'which footnote a weapon row shows in its numbers ("8 (+6)", "7/10"): one that changes that weapon\'s values (weapon, set), unless a one-off (oneOffMod)',
  footMod:'a one-off\'s footnote under the weapons: its numbers first, with the weapon ("Lacerator and daemonic claw +3 A and [DEVASTATING WOUNDS] until the end of the phase"), as the row no longer shows them',
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
  screenChecklist:'Phase checklist: the army and detachment rules, options and abilities of the list ckListed / ckOptListed lists (unless a unit of the list has the option as an ability: listed as theirs; the same ability on several units one line, a copy the list cannot use apart, marked); a rule or ability listed only through options with moments of their own is listed once, as itself, without them, at each end moment they name (Code Chivalric: End of your turn, of your opponent\'s, of the battle round); by data.js CHECKLIST (verify/derive.js): To do now in each phase and turn its text says it is triggered (07.02: the phases; either turn: both), or under the moment it opens with (Start of the (first) battle round) or a sentence at the end of the battle round (ae), sections in the order of the game (End of your turn, End of your opponent\'s turn, then End of the battle round, after Fight · Their turn); Active now where its effect is used and it is not triggered; once-per-battle uses (perBattle; Kindred Sorcery\'s options each) under Once per battle, from where they are triggered (an option from where its rule is), with the Overview\'s boxes, and nothing of what they put in force; for the others, what they put in force from a rule of the list (f: "Riled up (X) · Waaagh!") and the ability they select (pickOptions: Active now where it is used, its own use or, made only of options, theirs when every one is read, within pk; not read: pk\'s whole duration; pk not read: When unclear; an ability a listed one selects names its selector on every line of it, "The Blood God\'s Favour (Wrathful Presence)"; not one listed itself, rolled, or whose own trigger is a unit activation, a); each line names its unit or source and opens the full text; a rule another rule of the list gives to units by keyword (g) says which and to whom; the battle rounds a rule\'s words name, quoted on its line ("(first, third and fifth battle rounds)", Harbingers of Dread); entries made of a named roll placed where the list makes it (ckRolled); inert rules and abilities the list cannot use are listed, marked; listed ones the table cannot place under When unclear, those with no phase under No phase; no stratagems; each section a fold (closed until opened, kept for the session), its line counting each part; a box per line per section, kept per list; Reset clears them (with Undo), not the once-per-battle ones',
  ckOptListed:'an option of a rule or ability on the Phase checklist: listed when its own words are a fixed moment (s), or when its rule is listed and its own WHEN line, if it has one, is not a unit activation (a: Calistus, Salvus, Rendax; a Blessing of Khorne\'s effect, "each time a model … makes a melee attack", is what its rule puts in force: listed)',
  ckListed:'which rules, abilities and options the Phase checklist lists (ckListed, ckOptListed): an entry derive marks s (seqTrigger), one data.js gives a moment that derive cannot place (ckStored), or a once-per-battle use (perBattle); an option when its own words are s, or its rule is listed and its own WHEN line is not a unit activation (a)',
  ckOption:'an option of a rule or ability on the Phase checklist: its own trigger (and where it is used); with none, where its effect is used (via: its rule\'s trigger, where a once-per-battle one is chosen); with neither (or nothing read of it at all: a Dread ability), Active now for the whole duration its rule\'s own words give its options (oc, or pk for an ability\'s section: Might of Khorne "until the end of the battle", Shroudpsalm "until the start of your next Command phase", Aegis Protocol "until it enters a different one"); no duration read: When unclear (x, with via), not guessed',
  ckEntry:'data.js CHECKLIST (verify/derive.js --write), the Phase checklist table: per rule and ability, from its own words (withoutOptions): s listed (seqTrigger: a sentence naming the start or end of a battle round, turn or phase, a Command phase, or another phase with a choice, with no unit activation: selected to…, each time / when this or a unit or model…, this unit\'s move or attacks, makes an attack / charge / move, is targeted, targets this, destroys, is destroyed, the first time); t the phases its text names (table 1\'s trigger) less those only its opening moment gives and those named only as "your / the next X phase" beside another trigger (Umbralefic Crystal\'s ingress move), at that moment, ae a sentence at the end of the battle round (Pledges to the Dark Prince), a its own trigger a unit activation (actOf), pk where the ability it selects is in force (pickCover), u where its effect is used (table 1\'s used-in), limited to the trigger\'s phases and turn when the text names them and states no duration (no until, this turn, next, for the rest of); none: positively no phase; x: not derivable; per option (optionsOf) s, a (its own WHEN line a unit activation), its own trigger only when it names one, where it is used, x when it has neither and no trigger of its rule; g: an ability it gives units by keyword; f: what it puts in force (inForce); the same words on several units must give one entry, else x',
  seqTrigger:'the Phase checklist\'s scope (CHECKLIST s): paragraph by paragraph, a sentence of the own words (durations, once-per-phase limits and a moment named only as a past reference, "was within … at the start of the turn", left out) naming the start or end of a battle round, turn or phase, a Command phase, or another phase with a choice (you can / select / choose), with no unit activation in it (selected to…, each time / when this or a unit or model…, this unit\'s move or attacks, makes an attack / charge / move, is targeted, targets this, after this unit has shot / fought / moved / charged, destroys, the first time; "if this model is destroyed" is a state); in a paragraph opening with a unit activation, a later moment counts only with a choice of its own (Warpmeld Sacrifice\'s "At the end of the phase" does not; Blood Tithe\'s "At the start of the Command phase, you can spend" does): what a unit\'s activation triggers is remembered from its datasheet',
  actOf:'an item\'s own trigger is a unit activation (a: left out as an option, or as the ability a listed one selects): its WHEN line is one; or its first sentence opens with "When" and has one (Diabolic Power), or has a "when / whenever / each time / after … selected to …" clause (Pulse Jet, Overwhelming Wrath); an effect\'s "Each time a model in this unit makes …" (a Blessing of Khorne) is not its trigger',
  pickCover:'where the ability a listed ability selects ("select one of the abilities in the X section", "select one X ability") is in force (pk): coverOf on the first duration its words give from where it is triggered ("until the start of the next battle round" from the start of the battle round: every phase), or x',
  optCover:'the duration a rule\'s or ability\'s own words give its options (oc): coverOf on the first duration in its own words ("until it enters a different one" / "until changed": the rest of the battle), from where it is triggered (a stored moment when derive cannot place it: Harbingers of Dread), when it has options; none read: null',
  endsOf:'the end moments an option\'s words name as when something is checked or done (ends): "at the end of a / the turn" both End of your turn and End of your opponent\'s turn, "of your turn", "of your opponent\'s turn", "of the battle round" (durations, "until the end of …", left out); a rule listed only through such options (Code Chivalric\'s Deeds) is listed once at each',
  MORTAL_GUARD:'a protection against mortal wounds (a Feel No Pain or a save "against … mortal wounds": Enraged Abjuration) is used whenever mortal wounds are suffered: every phase of its duration (mortalUse), as u of the entry or option',
  mortalUse:'where a protection against mortal wounds is used (MORTAL_GUARD): within the first "until …" duration its words give, from where it is triggered (coverOf); none: every phase of both turns; one read that covers no phase: as table 1 reads it',
  ckCtx:'the checklist reads where an effect is used without the stratagems (it lists none): table 1 with no core stratagems and no "targeted with a Stratagem" or other stratagem rule, so no phase is reached through Fire Overwatch (Doom loses Movement · Their turn) or another stratagem',
  inForce:'what a listed rule or ability puts in force from a rule defined elsewhere (CHECKLIST f, shown "Riled up (War Cry) · Waaagh!" under Active now): a bold term that is an army or detachment rule of its faction by name or alias, made a state of units by "is/are/be/become(s)" in a clause with no if/while/unless/when before it; its phases from coverOf on the duration in the same sentence',
  coverOf:'the phases a duration covers from where the text is triggered, in the order of a turn and the next (Core Rules 07): end of the phase: that phase (not from the start of the battle round: no phase is in progress, x); of the turn / this turn: the rest of that turn; of the next turn: the rest of that turn and the whole next one; until the start of your next turn or Command phase: the rest of that turn, and the opponent\'s turn after one of yours; end of the battle: every phase (also from the end of your opponent\'s turn); end of the battle round: every phase only from the start of the battle round; a trigger at the start of the battle round counts as each player\'s Command phase, at the end of your opponent\'s turn as before your turn; anything else x (When unclear)',
  withoutOptions:'a rule\'s or ability\'s own words for the Phase checklist table: its text without its italic notes, without the text of each of its options (each option has its own entry; one ending in a list, "select one of the following …:", with the "- " lines under it) and without worked "**Example:**" lines',
  ckWithin:'the phases of both (phase:your|opp|either): where a selected ability is used, within its selector\'s duration; none: x',
  ckRollMoments:'the moments the list\'s listed rules and abilities make a named roll ("at the start of the battle round, you can make a Blessings of Khorne roll": Blessings of Khorne; "At the start of the Fight phase, … make a Blessings of Khorne roll": Adamantine Avalanche), their at and t; a sentence "each time / when you make" is not one',
  ckRolled:'an entry whose words say "Each time you make a X roll" (The Blood God\'s Favour, Icon of Khorne) and is not listed by its own moment: listed (rolled) at the moments the list makes that roll (ckRollMoments), To do now there; none: as it was',
  ckAt:'a moment that is the start or end of a phase ("Start of your Command phase", Combat Doctrines, from main\'s rules-only moment) is filed in that phase\'s section (your, your opponent\'s, or both for "the"); other moments (Start of the battle round, End of your opponent\'s turn) are sections of their own; each section once',
  CK_EACH_ONCE:'"You can only select each combat doctrine once per battle": a limit on a rule\'s options, so the rule itself is not a once-per-battle use on the Phase checklist (Combat Doctrines: To do now at the start of your Command phase, its options Active now); the Overview\'s own boxes are unchanged',
  ckStored:'a rule or ability derive cannot place (x) that data.js gives a moment (at): listed at that moment only (Harbingers of Dread, Icon of Khorne: Start of the battle round), not at its display phase tags; with no moment it stays not derivable',
  armyRuleOption:'the datasheet (unit screen) does not spell out an army rule\'s options: a "When targeted" line of an army rule that starts with the name of one of its options (RULE_OPTIONS: Martial Ka\'tah\'s Kaptaris) is left out there, the Rules line opens the whole rule; the Damage tab and the Overview keep it',
  // verify/readings.js: which sentences of an ability state a bonus that needs a reading, and what says it
  CONDITION:'verify/readings.js: the words that make a bonus conditional (if, while, each time, until, after, when, once it has, in / at the start or end of a phase, that targets, against X units, within N", on a turn, for every / each, during the battle round in which, select one)',
  WA:'verify/readings.js: the weapon abilities a grant can name (Melta / Rapid Fire with a number or D3 / D6; [HAZARDOUS], not [SUPA-HAZARDOUS], a drawback)',
  WA_RE:'verify/readings.js: a weapon ability granted: in brackets (qualified ones too, "[LETHAL HITS: non-MONSTER/VEHICLE]"), "the X ability" in any case, or bare after have / has / gain ("have Sustained Hits 1")',
  BACK:'verify/readings.js: a sentence referring back to the one before it ("If it does", "that unit", "those weapons", "Until …"), the only kind an earlier sentence\'s condition counts for',
  ATTACK:'verify/readings.js: the attack bonuses read from the words (+1 to hit / wound, re-rolls of hit, wound and Damage rolls, Critical Hits, +N or improved A / S / AP / D, "a Strength characteristic of N") and how a reading says each',
  DEFENCE:'verify/readings.js: the defences read from the words (Feel No Pain, invulnerable save or InSv, +1 to save rolls, Stealth granted, -1 Damage / -1 D of an attack allocated to or made against the unit, Damage 0, -1 to hit / wound or -1 AP / worse AP against attacks that target it, an enemy unit\'s -1 to hit; not "this unit\'s …", "the bearer\'s …", "an enemy model") and how its "When targeted" reading says each',
  ROLLS:'verify/readings.js: the bonuses to a roll, which need a reading even with no condition (a weapon value cannot show them)',
  bonusOf:'verify/readings.js: a sentence\'s attack bonuses and defences (ATTACK, DEFENCE, WA_RE after a grant verb); an enemy\'s or a forbidden re-roll is none; the enemy\'s -1 to hit is not the unit\'s own',
  readingsOfUnit:'verify/readings.js: what of a unit reads an ability: its footnotes, auras and guards from it or an option it names in bold, its row\'s def / calcDef / defCalc, its Rules line\'s Feel No Pain, a value it gives marked on a weapon or stat',
  abilityGaps:'verify/readings.js: per sentence and per bonus, a gap when no reading of the ability says it: riled up needs a riled-up reading; an attack bonus with a condition (its own, or an earlier sentence\'s it refers back to), or a roll bonus with none, needs one; a defence needs a When targeted reading; na and options for keywords the unit lacks are skipped',
  covers:'verify/readings.js: a bonus said by a reading (its said pattern; a weapon ability by its name)',
  sentenceCtx:'verify/readings.js: the sentences of an ability (italic notes left out; a list line with the line that leads it), each with the earlier sentences of its paragraph',
  // data.js's own code (written by verify/tables.js)
  resolveArmies:'the lists as the app shows them (data.js, at load): each unit entry of ARMIES joined with its datasheet (DATASHEETS) into the unit the app has always had: the datasheet\'s columns, then the entry\'s own (null: none); each row the datasheet\'s row of that name (a stats row without its "×N"; for an attached unit the part its who or of names, else the first part that has it) with the entry row\'s fields on top, a row the datasheet does not have as the list\'s own; an entry without a kind of rows takes all of its datasheet\'s; over (a fact two lists have differently) on top of all; the readings (mods, aura, guard) from the rows of the rules they read, in this order: the army rules on the unit\'s Rules line (FACTIONS), each datasheet of the unit, its enhancement or upgrade (the first of the list\'s detachments that has it), the detachment rules (rule, moreRules) of the list whose needs (all, any, none, rule) the unit meets, then the entry\'s own; an entry\'s list with names in it is the whole list in its order, a name standing for the rows\' readings of that name; null: none; ds, over, of, faction, bsId, fingerprints (readOf too) and readBy hidden; keys in TABLE_ORDER; each unit its own copy of the datasheet\'s values. No rule is applied: verify/tables.js checks every list resolves to exactly what it was',
};
function appFunctions(html){
  const out = {};
  html += '\n' + fs.readFileSync(path.join(ROOT, 'import.js'), 'utf8');   // the list import's own file, reviewed as code like the app's
  html += '\n' + fs.readFileSync(path.join(ROOT, 'verify/derive.js'), 'utf8');   // and how verify/derive.js writes data.js CHECKLIST (the Phase checklist table)
  html += '\n' + fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');     // data.js's resolver (resolveArmies)
  html += '\n' + fs.readFileSync(path.join(ROOT, 'verify/readings.js'), 'utf8');   // the gate step readings: which words need a reading
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
