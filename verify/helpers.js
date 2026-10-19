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
        if(ab.na) add(a.id, 'ability-na', w + ' · ' + ab.name, { na:ab.na, armyUnits:a.units.map(x => x.name + ' [' + x.kw.join(', ') + ']') }, src);
        if(ab.damaged) add(a.id, 'ability-damaged', w + ' · ' + ab.name, { damaged:ab.damaged, W:u.stats[0].W }, src);
      }
      for(const m of u.mods || []) add(a.id, 'unit-footnote', w, m, cited(a.id, u, m));
      for(const m of u.aura || []) add(a.id, 'unit-aura', w, m, cited(a.id, u, m));
      for(const k of ['kwNote', 'ptsNote', 'note']) if(u[k]) add(a.id, 'unit-' + k, w, { [k]:u[k] }, unitFacts);
      // weapons: which model has which, how many, and the multi-profile groups
      add(a.id, 'unit-weapons', w, { gear:u.gear, weapons:[...(u.ranged || []), ...(u.melee || [])].map(x => [x.who, x.n && '×' + x.n, x.group, x.name].filter(Boolean).join(' · ')) }, { models:u.models, leads:u.leads || null });
    }
    // the faction's and detachments' rules and stratagems the army uses
    const f = fr(a.faction);
    const rulesMeta = (where, r, srcText) => {
      const src = { rule:r.name, text:srcText };
      for(const k of ['ph', 'turn', 'turns', 'needs', 'def', 'mod', 'note', 'tag', 'statNote', 'missing', 'ask']) if(r[k] !== undefined) add(a.id, 'rule-' + k, where + ' · ' + r.name, { [k]:r[k] }, src);
      for(const x of r.remind || []) add(a.id, 'rule-remind', where + ' · ' + r.name, x, src);
    };
    for(const r of f.armyRules) rulesMeta(a.faction + ' army rule', r, r.text + (r.table ? '\n' + r.table.map(t => t.join(': ')).join('\n') : ''));
    for(const id of a.detachments){
      const d = f.detachments[id];
      if(d.rule) rulesMeta(d.name + ' rule', d.rule, d.rule.text + (d.rule.table ? '\n' + d.rule.table.map(t => t.join(': ')).join('\n') : ''));
      for(const s of d.stratagems || []) for(const k of ['phases', 'turn', 'turns', 'needs', 'mod', 'def', 'gist', 'note', 'cpNote', 'ask'])
        if(s[k] !== undefined) add(a.id, 'strat-' + k, d.name + ' · ' + s.name, { [k]:s[k] }, { stratagem:s.name, text:stratText(s) });
    }
  }
  for(const s of D.coreStratagems) for(const k of ['phases', 'turn', 'turns', 'needs', 'mod', 'def', 'gist', 'note'])
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
  defenceItems:'what protects a unit when targeted: Feel No Pain, defensive abilities, detachment rules, stratagems usable in that phase, the Orks riled-up 5+ invulnerable save',
  onceTag:'"Once per …" limits shown on the ability row',
  matches:'stratagem/rule eligibility by keywords (all / any / none)',
  inertRule:'rules that do nothing in this list (e.g. Bondsman without ARMIGER models)',
  auraMods:'auras from other units in the list',
  proxyLines:'Bases & proxies: bases per models line and what to mark',
  quickRef:'Core Rules 07 (battle round), 07.02 (turn), 08 (Command phase), 05.01 hit roll, 05.02 wound roll table, 05.03-05.04 save roll and allocation order (dice values are pictures in the PDF: page 18)',
  perBattle:'tick boxes: how many uses a rule allows per battle ("once"/"twice"/"three times per battle") and whether they are counted per army or for each unit',
  abilityTicks:'tick boxes on an ability row: one set per army, or one per unit copy',
  grantSource:'"Granted by": which ability, detachment rule or army rule a marked value names',
  showGrant:'"Granted by": a value or keyword that a rule of the list already changed (from BSData\'s modifiers, checked against New Recruit\'s "(…)" marks): the rule\'s text, and that the value shown includes it',
  screenPregame:'Before the battle: Warlord, enhancements, attached units, strategic reserves (20.01: at most half the points limit; 20.03: from battle round 2, destroyed at the end of round 3), Deep Strike, transports, Scouts, start of round 1 / every round, once-per-battle items',
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
