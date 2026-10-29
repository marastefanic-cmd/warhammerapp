/* verify/bs-catalog.js: a faction's catalogue as BSData holds it at the pin (verify/.cache/bsdata), read statically: before any
   modifier of a list (a detachment, an enhancement, a battle size) changes it. What verify/from-bsdata.js (the faction catalogue
   import) and verify/catalog.js (its gate step) share:

     const C = require('./bs-catalog').load(ROOT, '<catalogue name>', { factions })   the catalogue, its libraries and the game
                        system, by id; factions: the Faction keywords that make a datasheet the faction's (factions.json catalogFactions)
     C.roots()          every root entry of the catalogue (and of the libraries it imports root entries from), each { link, entry,
                        name, kind, why, from }: kind 'datasheet' (a current datasheet), 'legends', 'crusade', 'crucible', 'ally'
                        (a library's datasheet of another faction) or 'config' (no datasheet: Detachment, Show/Hide Options, …),
                        why the rule that put it there (the explicit filter below)
     C.detachments()    every detachment of the catalogue's Detachment entry, each { entry, name, group, kind, why }, by the
                        same filter
     C.selection(root)  the root as a New Recruit export holds a unit, with every option taken (each model entry once, every
                        weapon and wargear choice of every group): what verify/from-json.js reads, so the datasheet is read with
                        the same code as every list
     C.points(entry), C.composition(entry), C.options(entry)   the datasheet's points (per model count; a later copy's
                        increment), its models (min/max per model entry) and wargear choices (groups with min/max), as BSData
                        gives them

   The filter (the owner's rule: no Legends, no Crusade, ever) is explicit, by these marks, in this order (FILTER, tested by
   verify/catalog.js):
     legends    the name ends in "[Legends]", or the entry (or its link) has a category named "Legends"
     crusade    the name or a category names Crusade ("Crusade", "Order of Battle", "Codex Crusade Relics", …: CRUSADE), or
                every cost of the entry is a Crusade cost type; inside a datasheet, a group or entry so named is not an option
                (BSData's "Crusade" group on every unit, "Weapon Modifications", "Crusade Relic Upgrades", Battle Honours/Scars)
     crucible   the name ends in "[Crucible]" or a category is "Crucible" (GW's Crucible characters, hidden in BSData until
                "Show Crucible Characters" is picked: built by Crucible rules, not a datasheet GW prints; no Wahapedia page)
     config     not a unit or model entry, or its primary category is Configuration
     reference  primary category Reference: New Recruit's reference copy of a datasheet another rule adds ("Spore Mines (Biovore)"), the
                datasheet being a root entry of its own
     boarding-actions  a detachment whose rules muster a Boarding Patrol (Mustering A Boarding Patrol, Forming Boarding Squads): a
                Boarding Actions detachment, another game mode (Wahapedia lists them under Boarding Actions)
     ally       a datasheet with none of the faction's Faction keywords (factions.json catalogFactions): another faction's, which the
                catalogue (or a library it imports root entries from) offers as an ally */
'use strict';
const fs = require('fs'), path = require('path');

const CRUSADE = /^(Crusade\b|Order of Battle$|Codex Crusade Relics$|Codex Battle (Scars|Traits)$|Crusade Relic|Weapon Modifications$|Battle (Scars|Honours|Traits)\b|Magisterium Lex Ultima$|Endeavour Imperatives$|Specialisms$|Agendas?$|Requisitions?$)/i;
const nameOf = x => String((x && x.name) || '').trim();
const FILTER = [
  { kind:'legends', test:(e, l, cats) => /\[Legends\]\s*$/i.test(nameOf(e)) || /\[Legends\]\s*$/i.test(nameOf(l)) || cats.some(c => /^Legends$/i.test(c)), why:'the name ends in [Legends], or a category Legends' },
  { kind:'crusade', test:(e, l, cats) => CRUSADE.test(nameOf(e)) || CRUSADE.test(nameOf(l)) || /\bCrusade\b/i.test(nameOf(e)) || cats.some(c => /\bCrusade\b/i.test(c)) || crusadeCostOnly(e), why:'a Crusade name or category, or only Crusade costs' },
  { kind:'crucible', test:(e, l, cats) => /\[Crucible\]\s*$/i.test(nameOf(e)) || /\[Crucible\]\s*$/i.test(nameOf(l)) || cats.some(c => /^Crucible$/i.test(c)), why:'the name ends in [Crucible], or a category Crucible' },
];
function crusadeCostOnly(e){
  const cs = ((e && e.costs) || []).filter(c => Number(c.value));
  return cs.length > 0 && cs.every(c => /crusade|battle honours|experience|weapon modifications/i.test(c.name || ''));
}
const PTS = '51b2-306e-1021-d207';
// hidden as a datasheet option: an entry's (or link's) hidden, then its "hidden" modifiers: one with no condition sets it; one that
// shows it (hidden = false) under conditions of the unit itself (scope self / parent / the entry, its models' counts) shows it, as the
// datasheet's own option; one whose conditions are of the force or roster (a detachment, an enhancement, a battle size) is a list's
// choice, and the option stays as the entry says
const condList = m => [].concat(m.conditions || [], ...((m.conditionGroups || []).map(function g(x){ return [].concat(x.conditions || [], ...((x.conditionGroups || []).map(g)), ...((x.localConditionGroups || []).flatMap(y => y.conditions || []))); })));
function staticHidden(x, listChoice){
  if(!x) return false;
  let h = !!x.hidden;
  const mods = [].concat(x.modifiers || [], ...((x.modifierGroups || []).filter(g => !/crusade/i.test(g.comment || '')).map(g => [].concat(g.modifiers || []).map(m => Object.assign({}, m, { conditions:[].concat(g.conditions || [], m.conditions || []), conditionGroups:[].concat(g.conditionGroups || [], m.conditionGroups || []) }))))).filter(m => m.field === 'hidden' && m.type === 'set');
  for(const m of mods){
    const v = m.value === true || m.value === 'true', cs = condList(m);
    if(!cs.length) h = v;
    // (a condition on a list's choice, an enhancement or the Warlord taken on the unit, a detachment, is the list's, whatever its scope)
    else if(!v && h && cs.every(c => !['force', 'roster', 'primary-catalogue', 'primary-category'].includes(c.scope) && !(listChoice && listChoice(c.childId)))) h = false;
    // hidden unless the list took something (a detachment's ability on the unit, Shadow Legion's, Legion of Excess's): no datasheet's own
    else if(v && !h && !(m.conditionGroups || []).length && cs.every(c => (['force', 'roster'].includes(c.scope) || (listChoice && listChoice(c.childId))) && ((c.type === 'lessThan' && +c.value === 1) || (c.type === 'equalTo' && +c.value === 0)))) h = true;
  }
  return h;
}

function load(ROOT, catalogueName, opts){
  opts = opts || {}; const dir = opts.dir;
  const BSDIR = dir || path.join(ROOT, 'verify/.cache/bsdata');
  const files = new Map();   // id -> { f, raw, top }
  for(const f of fs.readdirSync(BSDIR).filter(f => f.endsWith('.json'))){
    const raw = fs.readFileSync(path.join(BSDIR, f), 'utf8'), m = /"id"\s*:\s*"([^"]+)"/.exec(raw.slice(0, 2000));
    if(m) files.set(m[1], { f, raw });
  }
  const BS = new Map(), done = new Set();
  const index = id => {
    const x = files.get(id); if(!x || done.has(id)) return x && x.top;
    done.add(id); const top = JSON.parse(x.raw); x.top = top.catalogue || top.gameSystem || top;
    const walk = o => { if(Array.isArray(o)){ o.forEach(walk); return; } if(!o || typeof o !== 'object') return; if(o.id && !BS.has(o.id)) BS.set(o.id, o); for(const k in o) if(o[k] && typeof o[k] === 'object') walk(o[k]); };
    walk(x.top);
    return x.top;
  };
  // (the file's own name: its first "name" field)
  const catId = [...files.entries()].find(([, x]) => ((/"name"\s*:\s*"([^"]*)"/.exec(x.raw.slice(0, 4000)) || [])[1] || '') === catalogueName);
  if(!catId) throw new Error('no BSData catalogue "' + catalogueName + '" in ' + BSDIR);
  const cat = index(catId[0]);
  for(const l of cat.catalogueLinks || []) index(l.targetId);
  index(cat.gameSystemId);
  const get = id => BS.get(id);
  const catName = id => { const c = get(id); return c ? nameOf(c) : null; };
  const catsOf = (...xs) => xs.flatMap(x => ((x && x.categoryLinks) || []).map(c => catName(c.targetId) || nameOf(c)));
  const classify = (e, l) => {
    const cats = catsOf(l, e);
    for(const F of FILTER) if(F.test(e, l, cats)) return { kind:F.kind, why:F.why };
    if(!e || !['unit', 'model'].includes(e.type)) return { kind:'config', why:'not a unit or model entry' };
    // (New Recruit's reference copy of a datasheet another rule adds, "Spore Mines (Biovore)": primary category Reference; the datasheet
    // is its own root entry)
    { const pr = [].concat((l && l.categoryLinks) || [], e.categoryLinks || []).find(c => c.primary); if(pr && /^Reference$/i.test(catName(pr.targetId) || nameOf(pr))) return { kind:'reference', why:'primary category Reference: New Recruit’s reference copy of a datasheet that is a root entry of its own' }; }
    const prim = [].concat((l && l.categoryLinks) || [], e.categoryLinks || []).find(c => c.primary);
    if(prim && /^Configuration$/i.test(catName(prim.targetId) || nameOf(prim))) return { kind:'config', why:'its primary category is Configuration' };
    return { kind:'datasheet', why:'a unit or model entry, not Legends, Crusade or Crucible' };
  };
  // the root entries: the catalogue's own, then those of each library it imports them from (importRootEntries: the Chaos Daemons'
  // units are in "Chaos - Daemons Library"). A library's datasheet is the faction's only with one of the Faction keywords of the
  // catalogue's own datasheets (or, with none of its own, the catalogue's name): else it is another faction's, an ally (the Imperial
  // Knights' Armigers and the Imperial Agents the Adeptus Custodes catalogue imports)
  let roots_ = null;
  const roots = () => {
    if(roots_) return roots_;
    const of = (c, lib) => [].concat(c.entryLinks || [], c.selectionEntries || []).map(l => {
      const entry = l.targetId ? get(l.targetId) : l;
      return Object.assign({ link:l.targetId ? l : null, entry, name:nameOf(entry || l), from:lib ? nameOf(c) : null }, classify(entry, l.targetId ? l : null));
    });
    const own = of(cat, false);
    // (the faction's Faction keywords: verify/sources/factions.json catalogFactions, else those of the catalogue's own datasheets)
    const facKw = new Set(opts.factions ? opts.factions.map(k => 'Faction: ' + k) : own.filter(r => r.kind === 'datasheet').flatMap(r => catsOf(r.link, r.entry)).filter(c => /^Faction: /.test(c)));
    if(!facKw.size) facKw.add('Faction: ' + nameOf(cat).replace(/^.* - /, ''));
    const ally = r => r.kind === 'datasheet' && !catsOf(r.link, r.entry).some(c => facKw.has(c)) ? Object.assign(r, { kind:'ally', why:'a root entry ' + (r.from ? 'of the imported ' + r.from + ' ' : '') + 'with none of the faction’s Faction keywords (' + [...facKw].join(', ') + '): another faction’s datasheet' }) : r;
    own.forEach(ally);
    const libs = (cat.catalogueLinks || []).filter(l => l.importRootEntries).map(l => index(l.targetId)).filter(Boolean);
    const lib = libs.flatMap(c => of(c, true)).map(ally);
    // (each entry once: a library root the catalogue links itself is the catalogue's)
    const seen = new Set(own.map(r => r.entry && r.entry.id));
    return roots_ = own.concat(lib.filter(r => !(r.entry && seen.has(r.entry.id)) && (seen.add(r.entry && r.entry.id), true)));
  };
  // ---- the children of an entry, as options: entries, links and groups (a group's children carry its name)
  const resolve = l => l.targetId ? get(l.targetId) : l;
  // statically hidden: hidden itself, and no modifier that shows it (a "hidden = false" modifier under a condition: shown only then)
  // the list's choices: every entry of an Enhancements group, of the Detachment entry, the Warlord (an option shown by one is no datasheet option)
  let LC = null;
  const listChoice = id => { if(!LC){ LC = new Set(); const take = o => { if(Array.isArray(o)){ o.forEach(take); return; } if(!o || typeof o !== 'object') return; if(o.id) LC.add(o.id); if(o.targetId) LC.add(o.targetId); for(const k in o) if(o[k] && typeof o[k] === 'object') take(o[k]); };
    for(const o of BS.values()) if((/^Enhancements\b/i.test(nameOf(o)) && (o.selectionEntries || o.entryLinks || o.selectionEntryGroups)) || ((nameOf(o) === 'Detachment' || nameOf(o) === 'Warlord') && o.type === 'upgrade')) take(o); }
    return LC.has(id); };
  const hiddenStatic = x => staticHidden(x, listChoice);
  const skipped = (x, l) => { const e = resolve(x); return !e || hiddenStatic(x) || hiddenStatic(e) || CRUSADE.test(nameOf(x)) || CRUSADE.test(nameOf(e)) || FILTER.some(F => F.kind !== 'crusade' && F.test(e, x.targetId ? x : null, catsOf(x, e))); };
  function children(node){
    const out = [];
    for(const x of [].concat(node.selectionEntries || [], node.entryLinks || [], node.selectionEntryGroups || [])){
      if(skipped(x)) continue;
      const e = resolve(x);
      const isGroup = x.type === 'selectionEntryGroup' || (node.selectionEntryGroups || []).includes(x);
      if(isGroup){
        // (the enhancements group: a list's choice by detachment, not the datasheet's wargear)
        if(/^Enhancements\b/i.test(nameOf(x)) || /^Enhancements\b/i.test(nameOf(e))) continue;
        for(const c of children(e)) out.push(Object.assign({}, c, { group:c.group || nameOf(e), groupNode:c.groupNode || { link:x, node:e } }));
        continue;
      }
      if(nameOf(e) === 'Warlord' && e.type === 'upgrade') continue;
      out.push({ link:x.targetId ? x : null, entry:e });
    }
    return out;
  }
  // ---- profiles and rules of an entry (its own, its links', an info group's)
  // (a profile's or rule's "hidden" modifiers too: shown only under a list's choice, it is none of the datasheet's)
  const shown = x => x && !hiddenStatic(x);
  function info(node){
    const profiles = [], rules = [];
    const take = n => {
      for(const p of n.profiles || []) if(shown(p)) profiles.push(p);
      for(const r of n.rules || []) if(shown(r)) rules.push({ r, name:nameOf(r) });
      for(const l of n.infoLinks || []){
        if(!shown(l)) continue;
        const t = get(l.targetId); if(!t || !shown(t)) continue;
        if(l.type === 'profile') profiles.push(Object.assign({}, t, { name:nameOf(l) || nameOf(t) }));
        else if(l.type === 'rule') rules.push({ r:t, name:nameOf(l) || nameOf(t) });
        else if(l.type === 'infoGroup') take(t);
      }
      for(const g of n.infoGroups || []) if(shown(g)) take(g);
    };
    take(node);
    return { profiles, rules };
  }
  const prof = p => ({ id:p.id, name:p.name, typeName:p.typeName, typeId:p.typeId, characteristics:(p.characteristics || []).map(c => ({ name:c.name, typeId:c.typeId, $text:c.$text == null ? '' : String(c.$text) })) });
  // ---- the root as a New Recruit export holds it: every option taken
  function selection(root){
    let n = 0;
    const sel = (e, l, ids, group) => {
      const { profiles, rules } = info(e);
      const lcats = ((l && l.categoryLinks) || []).concat(e.categoryLinks || []);
      const o = { id:'cat-' + (++n) + '-' + e.id, name:nameOf(e), entryId:ids.concat(e.id).join('::'), type:e.type, number:1 };
      if(group) o.group = group;
      if(lcats.length) o.categories = lcats.map(c => ({ name:catName(c.targetId) || nameOf(c), primary:!!c.primary, entryId:c.targetId }));
      if(profiles.length) o.profiles = profiles.map(prof);
      if(rules.length) o.rules = rules.map(x => ({ id:x.r.id, name:x.name }));
      const pts = (e.costs || []).find(c => c.typeId === PTS);
      if(pts && Number(pts.value)) o.costs = [{ name:'pts', typeId:PTS, value:Number(pts.value) }];
      const kids = children(e).map(c => sel(c.entry, c.link, ids.concat(c.link ? [c.link.id] : []), c.group));
      if(kids.length) o.selections = kids;
      return o;
    };
    return sel(root.entry, root.link, root.link ? [root.link.id] : [], null);
  }
  // ---- the detachments: the children of the catalogue's Detachment entry (its groups flattened)
  function detachments(){
    const d = roots().find(r => r.name === 'Detachment' && r.entry && r.entry.type === 'upgrade');
    if(!d) return [];
    const out = [];
    const walk = (node, group) => {
      for(const x of [].concat(node.selectionEntries || [], node.entryLinks || [], node.selectionEntryGroups || [])){
        const e = resolve(x); if(!e) continue;
        if(x.type === 'selectionEntryGroup' || (node.selectionEntryGroups || []).includes(x)){ walk(e, nameOf(e)); continue; }
        const c0 = classify(Object.assign({}, e, { type:'unit' }), x.targetId ? x : null), rn = info(e).rules.map(r => r.name);
        // (a Boarding Actions detachment, another game than Warhammer 40,000 matched play: its rules muster a Boarding Patrol)
        const c = c0.kind === 'datasheet' && rn.some(n => /^(Mustering A Boarding Patrol|Forming Boarding Squads)$/i.test(n)) ? { kind:'boarding-actions', why:'a Boarding Actions detachment (its rules: Mustering A Boarding Patrol / Forming Boarding Squads): another game mode, not matched play' } : c0;
        out.push({ entry:e, link:x.targetId ? x : null, name:nameOf(e), group, kind:c.kind === 'datasheet' ? (hiddenStatic(x) || hiddenStatic(e) ? 'hidden' : 'detachment') : c.kind, why:c.kind === 'datasheet' ? (hiddenStatic(x) || hiddenStatic(e) ? 'hidden in BSData' : 'a detachment of the catalogue') : c.why,
          rules:info(e).rules.map(r => r.name) });
      }
    };
    walk(d.entry, null);
    return out;
  }
  // ---- points: per model count (the "pts" modifiers whose only conditions count the unit's models), and what else changes them
  const minMax = (x, e) => { const cs = [].concat((x && x.constraints) || [], (e && e.constraints) || []).filter(c => c.field === 'selections' && c.scope === 'parent');
    const mn = cs.find(c => c.type === 'min'), mx = cs.find(c => c.type === 'max'); return { min:mn ? Number(mn.value) : 0, max:mx ? Number(mx.value) : null }; };
  function composition(root){
    const e = root.entry;
    if(e.type === 'model') return [{ model:nameOf(e), min:1, max:1 }];
    const out = [];
    const walk = (node, inGroup) => { for(const c of children(node)){ if(c.entry.type === 'model'){ const mm = minMax(c.link || c.entry, c.entry), g = c.groupNode ? minMax(c.groupNode.link, c.groupNode.node) : null;
      const o = { model:nameOf(c.entry), min:mm.min, max:mm.max }; if(c.group) o.group = c.group; if(g && (g.min || g.max != null)) o.groupMin = g.min, o.groupMax = g.max; out.push(o); } } };
    walk(e);
    return out;
  }
  function options(root){
    const out = [];
    const walk = (node, on) => {
      const kids = children(node), groups = new Map();
      for(const c of kids){
        if(c.entry.type === 'model'){ walk(c.entry, nameOf(c.entry)); continue; }
        const key = c.group || '';
        if(!groups.has(key)) groups.set(key, { on, group:c.group || null, node:c.groupNode, choices:[] });
        const mm = minMax(c.link || c.entry, c.entry);
        const pts = Number(((c.entry.costs || []).find(x => x.typeId === PTS) || {}).value) || 0;
        groups.get(key).choices.push(Object.assign({ name:nameOf(c.entry) }, mm.min ? { min:mm.min } : {}, mm.max != null ? { max:mm.max } : {}, pts ? { pts } : {}));
      }
      for(const g of groups.values()){ const o = { on:g.on, choices:g.choices }; if(g.group){ o.group = g.group; const mm = minMax(g.node.link, g.node.node); if(mm.min) o.min = mm.min; if(mm.max != null) o.max = mm.max; } out.push(o); }
    };
    walk(root.entry, root.entry.type === 'model' ? nameOf(root.entry) : 'unit');
    return out;
  }
  const condsOf = m => [].concat(m.conditions || [], ...((m.conditionGroups || []).map(g => [].concat(g.conditions || [], ...((g.conditionGroups || []).map(h => h.conditions || [])))))).concat(...((m.conditionGroups || []).map(g => (g.localConditionGroups || []).flatMap(x => x.conditions || []))));
  function points(root){
    const e = root.entry, base = Number(((e.costs || []).find(c => c.typeId === PTS) || {}).value) || 0;
    const mods = [].concat(e.modifiers || [], (root.link && root.link.modifiers) || [], ...((e.modifierGroups || []).filter(g => !/crusade/i.test(g.comment || '')).map(g => g.modifiers || []))).filter(m => m.field === PTS);
    const byModels = [], other = [];
    for(const m of mods){
      const cs = condsOf(m);
      const models = cs.length && cs.every(c => c.childId === 'model' && c.field === 'selections' && (c.scope === e.id || c.scope === 'self' || c.scope === 'parent'));
      if(models && m.type === 'set') byModels.push({ cond:cs.map(c => c.type + ' ' + c.value), pts:Number(m.value) });
      else {
        // (a later copy's increment: its local condition group counts the earlier copies, "atLeast 2": GW's "your 1st to 2nd units cost …,
        // your 3rd+ …")
        const g = (m.conditionGroups || []).flatMap(x => x.localConditionGroups || []).find(x => (x.conditions || []).some(c => c.type === 'instanceOf'));
        const copies = cs.some(c => c.type === 'instanceOf') && cs.some(c => c.type === 'before');
        other.push({ type:m.type, value:Number(m.value), when:copies ? (g && g.type === 'atLeast' && Number(g.value) > 1 ? 'each copy after the first ' + Number(g.value) + ' of this datasheet in the army' : 'each earlier copy of this datasheet in the army') : cs.map(c => (c.childName || c.childId) + ' ' + c.type + ' ' + c.value + ' (' + c.scope + ')').join(' and ') });
      }
    }
    // (the fewest models: each model entry's min, but a group's min for the entries of a group: Vertus Praetors' "2-3 Vertus Praetors")
    const comp = composition(root), grp = new Map(comp.filter(c => c.group && c.groupMin != null).map(c => [c.group, c.groupMin])), lo = (comp.filter(c => !grp.has(c.group)).reduce((t, c) => t + (c.min || 0), 0) + [...grp.values()].reduce((t, v) => t + v, 0)) || 1, hi = comp.every(c => c.max != null) ? comp.reduce((t, c) => t + c.max, 0) : lo;
    const ok = (cond, n) => cond.every(c => { const [t, v] = c.split(' '); return t === 'atLeast' ? n >= +v : t === 'greaterThan' ? n > +v : t === 'atMost' ? n <= +v : t === 'lessThan' ? n < +v : t === 'equalTo' ? n === +v : false; });
    const tiers = [];
    for(let k = lo; k <= Math.max(lo, hi); k++){ let p = base; for(const b of byModels) if(ok(b.cond, k)) p = b.pts; if(!tiers.length || tiers[tiers.length - 1].pts !== p) tiers.push({ models:k, pts:p }); }
    const out = { tiers, sizes:[lo, Math.max(lo, hi)] };
    if(other.length) out.other = other;
    return out;
  }
  return { cat, get, index, roots, detachments, selection, points, composition, options, classify, catsOf, files };
}
module.exports = { load, FILTER, CRUSADE, crusadeCostOnly, staticHidden };
