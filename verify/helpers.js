// The app's own judgements, each next to the rules text it rests on, and their sign-off.
//
// The paper packet has rules text; the app adds judgements on top: footnotes under weapons,
// "When targeted" entries, the phase and turn a rule is listed in, which units a stratagem is
// for, reminders, notes, and the code that turns weapons into "Pick one / Shoots with both".
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
      // (calcMods, calcDefs, calcNc, both, limit: the Damage tab's own reading of an army rule)
      for(const k of ['ph', 'turn', 'turns', 'needs', 'def', 'mod', 'note', 'tag', 'statNote', 'missing', 'ask', 'calcMods', 'calcDefs', 'calcNc', 'both', 'limit']) if(r[k] !== undefined) add(a.id, 'rule-' + k, where + ' · ' + r.name, { [k]:r[k] }, src);
      // an army rule shown with the core ability of the same name (Super-heavy Walker): the pairing, against both texts
      if(r.coreTwin !== undefined) add(a.id, 'rule-coreTwin', where + ' · ' + r.name, { coreTwin:r.coreTwin }, { rule:r.name, text:srcText, core:D.rules[r.coreTwin] || null });
      for(const x of r.remind || []) add(a.id, 'rule-remind', where + ' · ' + r.name, x, src);
    };
    for(const r of f.armyRules) rulesMeta(a.faction + ' army rule', r, r.text + (r.table ? '\n' + r.table.map(t => t.join(': ')).join('\n') : ''));
    for(const id of a.detachments){
      const d = f.detachments[id];
      if(d.rule) rulesMeta(d.name + ' rule', d.rule, d.rule.text + (d.rule.table ? '\n' + d.rule.table.map(t => t.join(': ')).join('\n') : ''));
      for(const s of d.stratagems || []) for(const k of ['phases', 'turn', 'turns', 'needs', 'mod', 'def', 'defCalc', 'defPick', 'calcNote', 'lasts', 'gist', 'note', 'cpNote', 'ask', 'shield', 'react', 'weaponKw'])
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
  unitMods:'which footnotes a unit gets: its own, detachment rules matching its keywords, auras, stratagems it is eligible for; Lance (+1 to wound after a charge); Plunging Fire for TOWERING (22.05)',
  singleMod:'Starting Strength for a one-model unit (Core Rules p86)',
  halfBelow:'Below half-strength for a one-model unit: remaining wounds less than half its W',
  defenceItems:'what protects a unit when targeted: Feel No Pain, defensive abilities, detachment rules, stratagems usable in that phase, the Orks riled-up 5+ invulnerable save; on the datasheet (opts.shields) also a stratagem another unit of the list takes the hits with (Grot Shields: a GRETCHIN unit for an ORKS INFANTRY unit, excluding GRETCHIN)',
  onceTag:'"Once per …" limits shown on the ability row',
  matches:'stratagem/rule eligibility by keywords (all / any / none)',
  inertRule:'rules that do nothing in this list (e.g. Bondsman without ARMIGER models)',
  auraMods:'auras from other units in the list',
  proxyLines:'Bases & proxies: bases per models line and what to mark',
  unplacedOf:'wargear New Recruit lists for the unit but on no models line (data.js unplaced): shown with its count, and that New Recruit does not say which models carry it (Models, weapon row, Bases & proxies)',
  perBattle:'tick boxes: how many uses a rule allows per battle ("once"/"twice"/"three times per battle") and whether they are counted per army or for each unit',
  abilityTicks:'tick boxes on an ability row: one set per army, or one per unit copy',
  grantSource:'"Granted by": which ability, detachment rule or army rule a marked value names',
  showGrant:'"Granted by": a value or keyword that a rule of the list already changed (from BSData\'s modifiers, checked against New Recruit\'s "(…)" marks): the rule\'s text, and that the value shown includes it',
  screenPregame:'Overview (before the battle): Warlord, enhancements, attached units, detachments (each opens its detachment rule), the army rules (folded), units with Deep Strike (24.09: every model must have it), transports, Scouts and Infiltrators (24.31, 24.20: every model must have it), start of the battle / round 1 / every round, once-per-battle items',
  shortWhen:'the timing tag on an ability or rule row: a moment before any phase (at: "Start of the battle round", 07.01), the phases and whose turn (07.02.02), "Any phase" only when every phase has the same turn',
  ruleParts:'a New Recruit selection under the army name that only names an army rule\'s parts ("Code Chivalric: Deed, Quality": BSData\'s Deed and Quality are fixed sub-entries holding every option), not a pick: left out of the Overview\'s list',
  pickOptions:'the options a "select one of the abilities in the X section" / "select one X ability" asks for: the unit\'s abilities printed under that section, or the ability named X that lists them',
  // the Game tab (the game tracker)
  gameOf:'Game tab state: battle round 1–5 (Event Companion 13: five battle rounds), the first or second turn of the round (07.02: both players take one turn each, the same player first every round), who takes the first turn (Event Companion 10), the phase, both players\' CP and VP, the picks; a stored value out of range reads as a new game',
  newGame:'the Game tracker\'s New game: clears this game (round, turn, CP, VP, choices) and the uses per battle of both lists of the game (the Overview\'s tick boxes, the same storage), with Undo; the Overview\'s own New game is as before (its list\'s uses per battle only)',
  GC_SEL:'a rule that has the player pick one of its options: "select one" / "activate up to two" (Blessings of Khorne)',
  gcLasts:'how long a pick lasts, from the rule\'s words: the battle ("until the end of the battle", "for the coming battle"), the battle round ("until the end of the battle round", "until the start of the next battle round"), until this side\'s next Command phase ("until the start of your next Command phase"), or until another is picked ("remains in that protocol until it enters a different one")',
  gcParts:'the options a section ability lists as bold-named parts ("**Mantra of Discipline:** …", its "- " lines with it)',
  gcBullets:'the options a rule lists as its own bullets ("- **Protector Protocol:** …", "- Select one enemy unit. …")',
  gcTable:'the options in a rule\'s table: "Deed 1–2 · …" is option 1–2 of the Deeds (Code Chivalric: a Deed and a Quality, each by D6 result), otherwise each row is one option ("Unbridled Bloodlust · double 1+")',
  gcOptions:'where a choice\'s options are: its table when its words point at it ("below", or a group of its rows: "select one Deed"); the abilities of the section it names ("the abilities in the Crimson King section", "one Wrathful Presence ability": abilities whose who is that name), or the bold-named parts of the ability of that name (Icon of War, Canticles of the Omnissiah); its own bullets ("of the following", "listed below")',
  gcWhen:'when a pick is made, quoted from the rule: the start of the sentence that has the player select (found in the text without its ** marks), else the first "at the start/end of …" or "in your … phase" it names, else its at tag',
  gameChoices:'the choices a list\'s rules ask for this game: army rules (not inert), detachment rules (a unit it applies to), unit abilities (one per unit copy); kept only when the rule says how long the pick lasts and its options are found; an option of another choice of the same unit is not a choice itself; chosen or rolled ("randomly select"), the state the rule names ("your army becomes Honoured"), each option once per battle ("select each of these abilities once per battle"), up to two',
  gcPick:'which pick is shown: the battle\'s; this battle round\'s; for one until the start of your next Command phase, the one made in this side\'s last Command phase (in the first turn of a round, for the side that goes second, the round before, shown as picked then); for one kept until changed the last one made in this or an earlier battle round, and before any the option its words start the battle in ("At the start of the battle … that unit enters Aegis Protocols")',
  gcTargets:'a picked option that has the player select a unit of the opponent\'s army ("select one CHARACTER model in your opponent\'s army", "select one enemy unit", "select one unit from your opponent\'s army"): their units (with that keyword) to pick from, when their list is picked',
  G_STEP:'the step of a phase a rule\'s own first words name: "(Once per battle,) at the start/end of (your / your opponent\'s / the / any) <phase> phase", or of the battle round, the first battle round, the battle, a turn (Core 07–12: start of the phase, the phase\'s own steps, end of the phase)',
  gStep:'a rule\'s step in a phase: an at of "Start of the battle round" → Start of Battle Round (07.01); an at of "End of … turn" → the end of that turn; otherwise G_STEP on its words (a phase it does not name: during the phase)',
  gUntagged:'a rule with no phase tags: the phase and turn its first words name ("At the end of your opponent\'s turn": their turn, at the end of it)',
  gamePhase:'what a list can do in a phase of a turn: its army rules (not inert) and detachment rules (a unit they apply to) by their phase tags and their reminders\' tags, its units\' abilities (not the ones that cannot be used in the list, not Damaged profiles) and its stratagems, read from ph/phases, turn/turns and at; what is triggered at the start of the battle round (and, in the first, of the first battle round and of the battle) is shown in the round\'s first Command phase for both lists whatever their turn tags (07.01: start-of-round rules are resolved before the player turns); in a later Command phase such a rule is shown only when its words after the first sentence name the Command phase; a rule for all five phases is "Any phase"',
  gPhaseHtml:'how a phase is laid out: Start of the battle (round 1) and Start of Battle Round (07.01) in the round\'s first Command phase, then the phase\'s start step, Gain Core CP (08.02) after the Command phase\'s start (08.01), Battle-shock (08.03: the rules whose words name the Battle-shock step, which 08.04 leaves out), the phase\'s other steps (during: Command Abilities 08.04; Pile In 12.02 · Fight 12.04 · Consolidate 12.07), its end step; the end of the turn after the Fight phase\'s end, End of Battle Round (07.03) after the round\'s last Fight phase; stratagems after rules and abilities in each step, the ones no unit can use last',
  gRows:'a phase\'s rows: each opens its full text (the other list\'s from that list); a stratagem\'s gist, and which units can use it only when none can; uses per battle as the Overview\'s ticks, the same keys and boxes (a rule that lets each of its abilities be selected once per battle: one box per ability; a per-unit rule: none); an option of a choice marked picked / not picked this round, a choice\'s current pick',
  G_CP:'a sentence that gives CP: "gain(s) … CP / Command Point(s)"',
  gameCpRules:'the rules of a list that give CP, quoted by that sentence (not their FAQ or errata lines): army rules (not inert), detachment rules, unit abilities (usable in the list), each once with its units',
  gEvery:'units with Deep Strike, Scouts or Infiltrators: only when every model of the unit has it (24.09, 24.31; Infiltrators: "if every model in a unit has this ability"), as the Overview counts them',
  gPregameHtml:'the Event Companion\'s mission sequence with both lists\' numbers: step 7 the strategic reserves limit (20.01: 50% of the points limit for the battle size, worked out from each list\'s points limit, marked as an app note) and the units with Deep Strike; step 8 the TITANIC units (its TITANIC sentence set apart when a list has one) and the Infiltrators; step 10 who takes the first turn; step 11 the units with Scouts',
  gChoiceHtml:'a choice: its rule, when the pick is made and how long it lasts in the rule\'s words (For the battle, Battle round N, Until the start of your next Command phase, Until another is picked; a pick from an earlier round or from the start of the battle says so), its options (an option picked in another battle round of a once-per-battle choice marked used), Rolled, the state (Honoured), the quoted text of each pick, their unit, earlier rounds\' picks; an app note when its timing names a step the Event Companion\'s mission sequence does not have ("the Read Mission Objectives step")',
  gamePick:'a pick: one option (tapped again: none), with up to two a third replaces the first; Rolled, the state and their unit on and off; picking an option of a once-per-battle choice (Kindred Sorcery) ticks the Overview\'s box for it, unpicking it unticks it unless another battle round picked it',
};
function appFunctions(html){
  const out = {};
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
