#!/usr/bin/env node
/* verify/import-ids.js: the BSData ids the in-app list import (import.js) resolves a New Recruit export by.
   New Recruit's JSON export is a BattleScribe roster: every selection names its BSData entry ("entryId", the last id
   of which is the entry itself). This writes, into data.js between the BS_IDS markers, the ids of what data.js
   already has, taken from BSData as verify/bsdata.js builds each list's roster:
     factions      catalogue id → faction            battleSizes   entry id → battle size (data.js name)
     detachments   entry id → faction/detachment     dispositions  entry id → Force Disposition
     roots         root entry id → battleSize | disposition | detachment (the selection that holds each choice)
     limits        battle size → its points limit (BSData's name: "Strike Force (2000 Point limit)")
     config        root entry id → army config key (Code Chivalric), whose choices become the list's `config`; configKids: its choices
     info          root entry ids that hold no list content (Show/Hide Options, rules references); infoKids: their choices
     units         army/unit → one signature per part of the unit (leader, other characters, bodyguard), in the
                   unit's order: "rootId|n×path,…" with every selection below the part as a path of entry ids from
                   the part (a models line's and a wargear item's count; a group-like option's count is 1)
     names         entry id → BSData name (an export's selection must carry the same name)
     maxPerList    entry id → how many a list may take (BSData's max per roster/force: enhancements, Epic Heroes)
   Usage: node verify/import-ids.js           check that data.js holds exactly this table (exit 1 if not)
          node verify/import-ids.js --write   write it
   Needs the BSData clone (sh verify/fetch.sh). */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'data.js');
const START = '// ---- BS_IDS: written by verify/import-ids.js from BSData (do not edit) ----';
const END = '// ---- end of BS_IDS ----';

// a part's signature: import.js's own, so the app compares exactly what this writes
const { signature } = require('../import.js');

function table() {
  const B = require('./bsdata.js');
  const X = B.rosters();
  if (X.SRC.mode !== 'clone') throw new Error('needs the BSData clone (sh verify/fetch.sh)');
  const T = { factions:{}, roots:{}, battleSizes:{}, limits:{}, dispositions:{}, detachments:{}, config:{}, configKids:{}, info:{}, infoKids:{}, units:{}, names:{}, maxPerList:{} };
  const name = (id, n) => { T.names[id] = B.nn(n); };
  const gs = X.SRC.gameSystem();
  // battle sizes: the game system's options, named as data.js names them (map-bsdata.json battleSize)
  const bsRoot = X.rootNode(gs, 'Battle Size')[0];
  for (const [app, bs] of Object.entries(X.MAP.battleSize || {})) {
    const p = X.searchBelow(bsRoot.n, (k) => k.type === 'upgrade' && B.nn(k.name) === B.nn(bs))[0];
    if (!p) throw new Error('no battle size ' + bs);
    T.battleSizes[p[p.length - 1].id] = app;
    const lim = /\((\d+) Point limit\)/.exec(bs); if (!lim) throw new Error('no points limit in ' + bs);
    T.limits[app] = Number(lim[1]);
  }
  T.roots[bsRoot.n.id] = 'battleSize';
  // Force Dispositions: the game system's options (verify/dispositions.js checks which each detachment allows)
  const fdRoot = X.rootNode(gs, 'Force Disposition')[0];
  T.roots[fdRoot.n.id] = 'disposition';
  for (const p of X.searchBelow(fdRoot.n, (k) => k.type === 'upgrade')) { const n = p[p.length - 1]; T.dispositions[n.id] = B.nn(n.name); }
  for (const [fac, f] of Object.entries(X.DATA.factions)) {
    const cat = X.SRC.catalogueByName(X.MAP.catalogues[fac]);
    if (!cat) throw new Error('no catalogue for ' + fac);
    T.factions[cat.obj.id] = fac;
    // detachments: every one data.js has for the faction, below any of the catalogue's Detachment entries
    // (the Adeptus Custodes catalogue holds them under a root entry "Detachments", the others under "Detachment")
    const roots = X.rootNode(cat, 'Detachment').concat(X.rootNode(cat, 'Detachments'));
    for (const r of roots) T.roots[r.n.id] = 'detachment';
    for (const [k, d] of Object.entries(f.detachments)) {
      // (BSData's name where map-bsdata.json gives one: "Deathwatch Support (ITS NOT READY)" at the pin)
      const bsName = (X.MAP.detachments || {})[k] || d.name;
      const p = roots.map((r) => X.searchBelow(r.n, (x) => x.type === 'upgrade' && B.nn(x.name) === B.nn(bsName))[0]).find(Boolean);
      if (!p) throw new Error('no BSData detachment ' + d.name + ' (' + fac + ')');
      T.detachments[p[p.length - 1].id] = fac + '/' + k;
    }
    // the catalogue's own "Show …" entries (Show Imperial Agents), which New Recruit lists under Show/Hide Options
    for (const r of X.rootLinksOf(cat)) { const o = r.link ? X.SRC.get(r.link.targetId) : r.entry; if (o && /^Show /.test(o.name || '')) T.infoKids[o.id] = B.nn(o.name); }
    // (every link to them: the catalogue's own Show/Hide Options link holds its own options, Show Imperial Agents)
    for (const r of X.rootLinksOf(cat)) {
      const o = r.link ? X.SRC.get(r.link.targetId) : r.entry;
      if (!o || !['Show/Hide Options', 'Rituals reference', 'Blessings of Khorne Reference', "Martial Ka'tah Reference"].includes(B.nn(o.name))) continue;
      const h = X.node(o, r.link || null);
      T.info[h.id] = B.nn(h.name);
      for (const p of X.searchBelow(h, (k) => k.type === 'upgrade')) { const k = p[p.length - 1]; T.infoKids[k.id] = B.nn(k.name); }
    }
  }
  // config: the keys the lists have (New Recruit's "Code Chivalric: Deed, Quality")
  for (const a of X.DATA.armies) for (const k of Object.keys(a.config || {})) {
    const cat = X.SRC.catalogueByName(X.MAP.catalogues[a.faction]);
    const h = X.rootNode(cat, k); if (h.length !== 1) throw new Error('config ' + k + ': ' + h.length + ' root entries');
    T.config[h[0].n.id] = k;
    for (const p of X.searchBelow(h[0].n, (x) => x.type === 'upgrade')) { const x = p[p.length - 1]; T.configKids[x.id] = B.nn(x.name); }
  }
  // units: each part of each unit as bsdata.js selects it
  for (const { army, R, issues } of X.out) {
    if (!R || issues.length) throw new Error(army.id + ': verify/bsdata.js cannot build this list (' + issues.map((i) => i.field + ' ' + i.app).join('; ') + ')');
    for (const { u, copies } of R.built) {
      const conv = (s) => { name(s.node.id, s.node.name); return { id:s.node.id, n:s.count, model:s.node.type === 'model', kids:s.children.filter((c) => !c.hidden).map(conv) }; };
      T.units[army.id + '/' + u.id] = copies[0].roots.map((r) => { name(r.node.id, r.node.name); return signature(r.node.id, r.children.filter((c) => !c.hidden).map(conv)); });
    }
  }
  // how many of an entry a list may take (BSData's max per roster or force: an enhancement once, an Epic Hero once, Synaptoprescience
  // three times), for every entry the units have
  T.maxPerList = {};
  const linksTo = new Map();   // the entry links to each entry (their modifiers count too)
  const lw = (x) => { if (Array.isArray(x)) x.forEach(lw); else if (x && typeof x === 'object') { if (x.targetId && x.type !== 'profile' && x.type !== 'rule') { if (!linksTo.has(x.targetId)) linksTo.set(x.targetId, []); linksTo.get(x.targetId).push(x); } Object.values(x).forEach(lw); } };
  for (const f of Object.values(X.SRC.files)) lw(f.obj);
  for (const id of Object.keys(T.names)) {
    const o = X.SRC.get(id); if (!o) continue;
    // (only a max no modifier changes: Battleline units and detachments raise some, Runt Swarm's Gretchin; those are not checked)
    const changed = new Set(); const walk = (x) => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.field) changed.add(x.field); Object.values(x).forEach(walk); } };
    walk(o.modifiers); walk(o.modifierGroups);
    for (const l of linksTo.get(id) || []) { walk(l.modifiers); walk(l.modifierGroups); }
    const m = (o.constraints || []).filter((c) => c.type === 'max' && c.field === 'selections' && (c.scope === 'roster' || c.scope === 'force') && !changed.has(c.id)).map((c) => c.value);
    if (m.length) T.maxPerList[id] = Math.min(...m);
  }
  return T;
}

const lit = (T) => 'const BS_IDS = {\n' + Object.entries(T).map(([k, v]) => '  ' + k + ':{\n' +
  Object.keys(v).sort().map((x) => '    ' + JSON.stringify(x) + ':' + JSON.stringify(v[x])).join(',\n') + '\n  }').join(',\n') + '\n};';
function block(T) { return START + '\n' + lit(T) + '\n' + END; }

module.exports = { table, signature, block, START, END };
if (require.main !== module) return;

const src = fs.readFileSync(FILE, 'utf8');
const want = block(table());
const i = src.indexOf(START), j = src.indexOf(END);
const have = i >= 0 && j > i ? src.slice(i, j + END.length) : null;
if (process.argv.includes('--write')) {
  let out;
  if (have) out = src.slice(0, i) + want + src.slice(j + END.length);
  else {
    const at = src.indexOf('\nreturn { version:VERSION');
    if (at < 0) throw new Error('data.js: return line not found');
    out = src.slice(0, at) + '\n' + want + '\n' + src.slice(at);
  }
  if (!/bsIds:BS_IDS/.test(out)) out = out.replace(/armies:ARMIES \};/, 'armies:ARMIES, bsIds:BS_IDS };');
  fs.writeFileSync(FILE, out);
  console.log('import-ids: wrote BS_IDS into data.js (' + (want.length / 1024).toFixed(0) + ' KB)');
} else if (have !== want) {
  console.log('import-ids: data.js BS_IDS ' + (have ? 'differs from' : 'is missing;') + ' what BSData gives for its lists. Run: node verify/import-ids.js --write');
  process.exit(1);
} else console.log('import-ids: BS_IDS matches BSData for every list (' + Object.keys(require('./lib').loadData().bsIds.units).length + ' units)');
