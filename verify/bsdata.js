#!/usr/bin/env node
/* =====================================================================
   verify/bsdata.js: every unit fact in data.js against BSData (wh40k-11e),
   the data files New Recruit builds its list PDFs from.

   For each unit of each army it rebuilds the list the way New Recruit holds it
   (roster > force > detachments, battle size, every unit with its models, wargear,
   enhancement and warlord), evaluates BSData's conditions and modifiers on that roster
   (detachment and enhancement effects, escalating points, attached-unit effects) and
   compares the result with data.js, both ways:
     stats     M T Sv W Ld OC InSv base, and the "×N" model count of each row
     weapons   range A BS/WS S AP D, keywords (order-insensitive), Hunter profile, n, enh
     abilities name, tags in BSData's name "(Aura)", text; enhancements included
     keywords  kw against the categories of every selection of the (attached) unit;
               role against the primary category of the (leader's) datasheet
     rules     each rule must be a BSData rule of the unit, a keyword of its weapons, or named
               in an ability it uses itself (not one marked na, not one the app only gives to
               other units through an `aura` whose keywords leave the unit out, e.g. a Knight's Bondsman ability); and every
               BSData rule of the unit must be listed
     grants    every weapon/stat value BSData's modifiers change, with the rule that changes it,
               against the app's `from` marks (both ways; see "Granted values" below)
     points    pts per copy (leader + bodyguard + wargear + enhancements, an UPGRADE on the
               bodyguard), with the escalation
               for the k-th unit of a datasheet; ptsNote "leader + Bodyguard N"
     gear      every models/gear line resolves to BSData entries; required wargear present;
               no selection BSData hides for this list (enhancement of another detachment)
   Intentional differences live only in verify/deviations-bsdata.json.

   Usage: node verify/bsdata.js [--extract] [--write-extract] [--explain <unitId>]
                                [--bsdata <dir>] [--data <data.js>] [--out <file>]
     default     the BSData clone in verify/.cache/bsdata (verify/fetch.sh); without it,
                 the pinned extract verify/sources/bsdata-extract.json
     --extract   always use the pinned extract (offline)
     --write-extract  rewrite the extract from the clone (only what the armies use)
   Exit 0 only when there are no failures. Output: verify/out/bsdata.json.
===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const REPO = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const P = {
  data: path.resolve(opt('--data', path.join(REPO, 'data.js'))),
  bsdata: path.resolve(opt('--bsdata', path.join(HERE, '.cache', 'bsdata'))),
  extract: path.join(HERE, 'sources', 'bsdata-extract.json'),
  map: path.join(HERE, 'map-bsdata.json'),
  dev: path.join(HERE, 'deviations-bsdata.json'),
  out: path.resolve(opt('--out', path.join(HERE, 'out', 'bsdata.json'))),
  fetch: path.join(HERE, 'fetch.sh'),
};
const PTS = '51b2-306e-1021-d207';             // BSData cost type "pts"
const WEAPON_TYPES = ['Ranged Weapons', 'Melee Weapons'];
// (a profile of another type with a weapon's characteristics is a weapon: the Tesseract Vault's "C'tan Powers", GW's RANGED WEAPONS
// [C'TAN POWER]; verify/from-json.js reads them so)
const weaponShaped = (p) => p.typeName !== 'Unit' && ['Range', 'A', 'S', 'AP', 'D'].every((k) => (p.chars || p.characteristics || []).some((c) => c.name === k)) && (p.chars || p.characteristics || []).some((c) => c.name === 'BS' || c.name === 'WS');
const isWeaponProf = (p) => WEAPON_TYPES.includes(p.typeName) || weaponShaped(p);
const weaponKind = (p, ch) => p.typeName === 'Ranged Weapons' || (!WEAPON_TYPES.includes(p.typeName) && !/^melee$/i.test(ch.Range || '')) ? 'ranged' : 'melee';

/* ---------------------------------------------------------------------
   Normalisation (the whole list; the report quotes it)
   nn  names:    Unicode NFC; ’ ‘ ʼ ′ → ' ; “ ” ″ → " ; ‐ ‑ ‒ – — − → - ; … → ... ;
                 whitespace runs → one space; trimmed. Case-sensitive.
   nv  values:   nn, then "", "-", "N/A" → "-" (no value). Base sizes: x → ×.
   nk  keywords: nn, upper case.  Lists compared as sorted sets.
   nt  texts:    nn, markup removed (** * ^^ and BSData's <ins></ins> errata tags), line breaks →
                 space, lower case.
   Ability names: BSData puts tags in brackets after the name ("Keep Huntin'! (Once per
   battle round, per army)"); the app keeps them in `tag`. A BSData name matches when it
   equals the app name, or its name without the trailing brackets equals the app name and
   every bracketed tag is one of the app's tag parts (split on "·" and ",").
   Weapon names: BSData "➤ Group - profile" (any spacing around the dash) or "➤ profile"
   (group = the wargear entry), with a trailing "(Hunter: MONSTER/VEHICLE)", = the app's
   group, name and hunter:true.
   Stats row names: app "Name ×N" = BSData profile "Name" carried by N models.
--------------------------------------------------------------------- */
const nn = (s) => String(s == null ? '' : s).normalize('NFC')
  .replace(/[’‘ʼ′]/g, "'").replace(/[“”″]/g, '"').replace(/[‐‑‒–—−]/g, '-').replace(/…/g, '...')
  .replace(/\s+/g, ' ').trim();
const nv = (s, base) => { let v = nn(s); if (v === '' || v === '-' || v === 'N/A') v = '-'; if (base) v = v.replace(/x/g, '×'); return v; };
const nk = (s) => nn(s).toUpperCase();
const nt = (s) => nn(String(s == null ? '' : s).replace(/<\/?[a-z]+>/g, '').replace(/\*\*|\^\^|\*/g, '').replace(/\n/g, ' ')).toLowerCase();
// (each keyword once, as GW's datasheet prints it: a modifier that appends one the weapon has already, Hunter's Eye's "Ignores Cover" on a
// heavy flamer that has it, changes nothing and is no grant)
const kwList = (s) => nn(s) && nn(s) !== '-' ? [...new Set(nn(s).split(/\s*,\s*/).filter(Boolean).map(nk))] : [];
const sameSet = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const str = (v) => (v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v));

/* ---------------------------------------------------------------------
   BSData source: the git clone (all files) or the pinned extract (only what is used).
   Every lookup by id goes through get(), which records the top-level shared entry it
   belongs to, so --write-extract can keep exactly what this check reads.
--------------------------------------------------------------------- */
const TOP_ARRAYS = ['entryLinks', 'selectionEntries', 'rules', 'sharedSelectionEntries', 'sharedSelectionEntryGroups',
  'sharedProfiles', 'sharedRules', 'sharedInfoGroups', 'categoryEntries', 'forceEntries'];
const ALWAYS = ['profileTypes', 'costTypes'];

class Source {
  constructor() { this.files = {}; this.byId = new Map(); this.topOf = new Map(); this.used = new Set(); this.charName = new Map(); this.commit = null; this.mode = null; }
  addFile(fname, top, kind) {
    const f = { fname, kind, obj: top };
    this.files[fname] = f;
    for (const arr of TOP_ARRAYS) for (const o of top[arr] || []) {
      const key = `${fname}\u0000${arr}\u0000${o.id}`;
      this._index(o, key);
    }
    for (const pt of top.profileTypes || []) for (const c of pt.characteristicTypes || []) this.charName.set(c.id, c.name);
  }
  _index(o, key) {
    if (Array.isArray(o)) { for (const x of o) this._index(x, key); return; }
    if (!o || typeof o !== 'object') return;
    if (o.id && !this.byId.has(o.id)) { this.byId.set(o.id, o); this.topOf.set(o.id, key); }
    for (const k in o) if (o[k] && typeof o[k] === 'object') this._index(o[k], key);
  }
  get(id) { const o = this.byId.get(id); if (o) this.used.add(this.topOf.get(id)); return o; }
  touch(fname, arr, id) { this.used.add(`${fname}\u0000${arr}\u0000${id}`); }
  catalogueByName(name) { return Object.values(this.files).find((f) => f.obj.name === name); }
  fileById(id) { return Object.values(this.files).find((f) => f.obj.id === id); }
  gameSystem() { return Object.values(this.files).find((f) => f.kind === 'gameSystem'); }
}

function pinnedCommit() {
  const m = fs.existsSync(P.fetch) && fs.readFileSync(P.fetch, 'utf8').match(/BSDATA_COMMIT=([0-9a-f]+)/);
  return m ? m[1] : null;
}
function gitHead(dir) {
  try {
    const gitDir = path.join(dir, '.git');
    let head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    if (!head.startsWith('ref:')) return head;
    const ref = head.slice(4).trim();
    if (fs.existsSync(path.join(gitDir, ref))) return fs.readFileSync(path.join(gitDir, ref), 'utf8').trim();
    const packed = fs.readFileSync(path.join(gitDir, 'packed-refs'), 'utf8').split('\n').find((l) => l.endsWith(' ' + ref));
    return packed ? packed.split(' ')[0] : null;
  } catch (e) { return null; }
}
function loadFull(dir, catalogueNames) {
  const src = new Source(); src.mode = 'clone'; src.dir = dir; src.commit = gitHead(dir);
  const all = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const head = {};
  for (const f of all) {          // find catalogues by the name and id at the top of each file; parse only those needed
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = t.slice(0, 4000).match(/"(catalogue|gameSystem)":\s*\{\s*"name":\s*"([^"]*)",\s*"id":\s*"([^"]*)"/);
    if (m) head[f] = { kind: m[1], name: m[2], id: m[3], text: t };
  }
  const want = new Set(); const queue = [];
  for (const n of catalogueNames) { const f = Object.keys(head).find((k) => head[k].name === n); if (!f) throw new Error(`BSData catalogue "${n}" not found in ${dir}`); queue.push(f); }
  const gs = Object.keys(head).find((k) => head[k].kind === 'gameSystem'); if (gs) queue.push(gs);
  while (queue.length) {
    const f = queue.shift(); if (want.has(f)) continue; want.add(f);
    const d = JSON.parse(head[f].text); const top = d.catalogue || d.gameSystem; head[f].obj = top;
    for (const cl of top.catalogueLinks || []) { const g = Object.keys(head).find((k) => head[k].id === cl.targetId); if (g) queue.push(g); }
  }
  // the army catalogues first, so their own entries win any id clash
  for (const f of [...want]) src.addFile(f, head[f].obj, head[f].kind);
  return src;
}
function loadExtract(file) {
  const x = JSON.parse(fs.readFileSync(file, 'utf8'));
  const src = new Source(); src.mode = 'extract'; src.commit = x.commit;
  for (const [fname, top] of Object.entries(x.files)) src.addFile(fname, top, top.kind);
  return src;
}
function buildExtract(src) {
  const files = {};
  for (const [fname, f] of Object.entries(src.files)) {
    const t = f.obj; const o = { kind: f.kind };
    for (const k of ['name', 'id', 'revision', 'library', 'gameSystemId', 'gameSystemRevision', 'catalogueLinks']) if (t[k] != null) o[k] = t[k];
    for (const k of ALWAYS) if (t[k]) o[k] = t[k];
    for (const arr of TOP_ARRAYS) {
      const keep = (t[arr] || []).filter((e) => src.used.has(`${fname}\u0000${arr}\u0000${e.id}`));
      if (keep.length) o[arr] = keep;
    }
    files[fname] = o;
  }
  return {
    about: 'BSData wh40k-11e, only the entries verify/bsdata.js reads for the five armies in data.js. Regenerate: node verify/bsdata.js --write-extract',
    repo: 'https://github.com/BSData/wh40k-11e', commit: src.commit, files,
  };
}

/* ---------------------------------------------------------------------
   Entries: an entry reached directly or through an entryLink, merged with the link.
--------------------------------------------------------------------- */
let SRC = null;
const SKIP_LINK = /^(Crusade|Weapon Modifications|Crusade Relic Upgrades|Battle Scars|Battle Honours)/;
function node(obj, link) {
  const a = (k) => [...(obj[k] || []), ...((link && link[k]) || [])];
  const costs = {}; for (const c of obj.costs || []) costs[c.typeId] = c.value; for (const c of (link && link.costs) || []) costs[c.typeId] = c.value;
  return {
    obj, link, id: obj.id, linkId: link ? link.id : null, name: obj.name, type: obj.type || 'group',
    hidden: !!(obj.hidden || (link && link.hidden)), costs,
    constraints: a('constraints'), modifiers: a('modifiers'), modifierGroups: a('modifierGroups'),
    profiles: a('profiles'), infoLinks: a('infoLinks'), infoGroups: a('infoGroups'), rules: a('rules'), categoryLinks: a('categoryLinks'),
  };
}
function kids(n) {
  const out = [];
  // the entry's children, and those a link adds inside itself (the Chaos Knights catalogue's "Show Nurgle Daemons" in its
  // Show/Hide Options link, the War Dog Executioner's Snarling Rivalry in its Enhancements link)
  const own = (k) => [...(n.obj[k] || []), ...((n.link && n.link[k]) || [])];
  for (const e of own('selectionEntries')) out.push(node(e));
  for (const g of own('selectionEntryGroups')) out.push(node(g));
  for (const l of own('entryLinks')) {
    if (SKIP_LINK.test(l.name || '')) continue;
    const t = SRC.get(l.targetId); if (!t || SKIP_LINK.test(t.name || '')) continue;
    out.push(node(t, l));
  }
  return out;
}
const isModelNode = (n) => n.type === 'model';
function profilesOf(n) {              // own + linked profiles (static), for name searches
  const out = [...n.profiles];
  for (const il of n.infoLinks) if (il.type === 'profile') { const t = SRC.get(il.targetId); if (t) out.push(t); }
  return out;
}
// BSData weapon profile name → { group, pname, hunter }
function parseWeaponName(raw, upgradeName) {
  let s = nn(raw); let hunter = null;
  const h = s.match(/\s*\((Hunter:[^)]*)\)$/); if (h) { hunter = h[1]; s = s.slice(0, h.index).trim(); }
  s = s.replace(/\s*\((ranged|melee)\)$/i, '');   // one weapon with a ranged and a melee profile ("Stikka (ranged)"): its type says which
  const arrow = s.startsWith('➤'); s = s.replace(/^➤\s*/, '');
  const up = nn(upgradeName); const d = arrow && s.startsWith(up) && s.slice(up.length).match(/^\s*-\s*(.+)$/);
  if (d) return { group: up, pname: d[1], hunter, full: `${up} - ${d[1]}` };   // "➤ Rokkit Launcha- Busta"
  const i = s.lastIndexOf(' - ');
  if (i > 0) return { group: s.slice(0, i), pname: s.slice(i + 3), hunter, full: s };
  if (arrow) return { group: nn(upgradeName), pname: s, hunter, full: `${nn(upgradeName)} - ${s}` };
  return { group: null, pname: s, hunter, full: s };
}
// breadth-first search below a node; returns paths [n1..match] (groups included)
function searchBelow(start, pred, { intoModels = false, max = 50 } = {}) {
  const out = []; const q = [[start, []]]; const seen = new Set();
  while (q.length && out.length < max) {
    const [n, p] = q.shift();
    for (const k of kids(n)) {
      const key = k.id + '|' + k.linkId; if (seen.has(key)) continue; seen.add(key);
      const kp = [...p, k];
      if (pred(k)) out.push(kp);
      if (isModelNode(k) && !intoModels) continue;
      q.push([k, kp]);
    }
  }
  return out;
}
function fixedCount(n) {               // min = max in parent → that many per parent selection
  const min = n.constraints.find((c) => c.type === 'min' && c.scope === 'parent' && c.field === 'selections');
  const max = n.constraints.find((c) => c.type === 'max' && c.scope === 'parent' && c.field === 'selections');
  return min && max && min.value === max.value && min.value > 1 ? min.value : 1;
}

/* ---------------------------------------------------------------------
   Selections: the roster New Recruit would hold for this list.
--------------------------------------------------------------------- */
let ORDER = 0;
class Sel {
  constructor(n, count, parent, kind) {
    this.node = n; this.count = count; this.parent = parent; this.children = []; this.kind = kind || (n ? n.type : 'roster');
    this.order = ORDER++; this.cats = new Set(); this.hidden = false; this.profiles = []; this.rules = [];
    if (parent) parent.children.push(this);
    if (n) for (const c of n.categoryLinks) { this.cats.add(c.targetId); if (c.primary) this.primary = c.targetId; }
  }
  get root() { let s = this; while (s.parent && s.parent.kind !== 'force') s = s.parent; return s; }
  desc(includeSelf) { const out = includeSelf ? [this] : []; const st = [...this.children]; while (st.length) { const s = st.shift(); out.push(s); st.unshift(...s.children); } return out; }
  ancestors() { const out = []; let s = this.parent; while (s) { out.push(s); s = s.parent; } return out; }
  where() { const p = []; let s = this; while (s && s.node) { p.unshift(s.node.name); s = s.parent; } return p.join(' › '); }
}
// select every non-group entry along a path below parentSel; the last one is new unless reuse
function addChain(parentSel, pathNodes, count, { fresh = false } = {}) {
  let cur = parentSel; let c = count;
  const real = pathNodes.filter((n) => n.type === 'upgrade' || n.type === 'model' || n.type === 'unit');
  real.forEach((n, i) => {
    if (n.type === 'upgrade') c = c * fixedCount(n);
    const last = i === real.length - 1;
    let s = (fresh && last) ? null : cur.children.find((x) => x.node && x.node.id === n.id && x.node.linkId === n.linkId);
    if (!s) s = new Sel(n, c, cur); else if (last) s.count += c;
    cur = s;
  });
  return cur;
}
// selections below s that belong to s itself (not to one of its models)
function ownDesc(s) { const out = []; const st = [...s.children]; while (st.length) { const x = st.shift(); out.push(x); if (x.kind !== 'model') st.push(...x.children); } return out; }

/* ---------------------------------------------------------------------
   Conditions
--------------------------------------------------------------------- */
const CTX = { roster: null, force: null, primary: null, beforeK: new Map(), warnings: new Set() };
function isInstance(s, id) {
  if (id === 'any') return true;
  if (s.kind === 'force') return s.entryId === id;
  if (!s.node) return false;
  if (id === 'model' || id === 'unit' || id === 'upgrade') return s.node.type === id;
  return s.node.id === id || s.node.linkId === id || s.cats.has(id);
}
function nearest(sel, pred) { let s = sel; while (s && s.node) { if (pred(s)) return s; s = s.parent; } return null; }
function scopeSels(scope, sel) {
  switch (scope) {
    case undefined: case 'self': return [sel];
    case 'parent': return sel.parent ? [sel.parent] : [];
    case 'root-entry': return sel.node ? [sel.root] : [sel];
    case 'ancestor': return sel.ancestors().filter((s) => s.node);
    case 'model': case 'model-self': { const s = nearest(sel, (x) => x.node.type === 'model'); return s ? [s] : []; }
    case 'unit': case 'unit-self': { const s = nearest(sel, (x) => x.node.type === 'unit'); return s ? [s] : []; }
    case 'upgrade': { const s = nearest(sel, (x) => x.node.type === 'upgrade'); return s ? [s] : []; }
    case 'model-or-unit': case 'model-or-unit-self': { const s = nearest(sel, (x) => x.node.type === 'model' || x.node.type === 'unit'); return s ? [s] : []; }
    case 'force': return [CTX.force];
    case 'roster': case 'primary-catalogue': return [CTX.roster];
    default: { const s = nearest(sel, (x) => x.node.id === scope || x.node.linkId === scope); return s ? [s] : []; }
  }
}
function countIn(base, childId, field, recursive) {
  if (field === 'forces') return childId === CTX.force.entryId || childId === 'any' ? 1 : 0;
  // attached units: a leader's association is the unit it leads (and the other way round)
  if (field === 'associations') return base.node ? groupOf(base.root).filter((r) => r !== base.root && isInstance(r, childId)).length : 0;
  if (field !== 'selections') { CTX.warnings.add(`condition on field ${field} counted as 0`); return 0; }
  const list = recursive ? base.desc(false) : base.children;
  let n = 0; for (const s of list) if (isInstance(s, childId)) n += s.count;
  return n;
}
function cmp(type, n, v) {
  switch (type) {
    case 'atLeast': return n >= v; case 'atMost': return n <= v; case 'greaterThan': return n > v;
    case 'lessThan': return n < v; case 'equalTo': return n === v; case 'notEqualTo': return n !== v;
    default: CTX.warnings.add(`unknown comparison ${type}`); return false;
  }
}
function condTrue(c, sel) {
  if (c.type === 'instanceOf' || c.type === 'notInstanceOf') {
    let r;
    if (c.scope === 'primary-catalogue') r = c.childId === CTX.primary;
    else r = scopeSels(c.scope, sel).some((s) => isInstance(s, c.childId));
    return c.type === 'instanceOf' ? r : !r;
  }
  let n = 0; for (const b of scopeSels(c.scope, sel)) n += countIn(b, c.childId, c.field, c.includeChildSelections);
  return cmp(c.type, n, c.value);
}
function localGroupTrue(g, sel) {
  // New Recruit: count the selections in scope that meet every local condition ("before" = earlier in the roster)
  const conds = g.conditions || [];
  const inst = conds.find((c) => c.type === 'instanceOf' && c.scope === 'self');
  if (conds.some((c) => c.type === 'before') && inst && CTX.beforeK.has(sel)) return cmp(g.type, CTX.beforeK.get(sel), g.value);
  let n = 0;
  for (const b of scopeSels(g.scope, sel)) for (const s of (g.includeChildSelections ? b.desc(false) : b.children)) {
    const ok = conds.every((c) => c.type === 'before' ? (s.order < sel.order && s !== sel && isInstance(s, c.childId === 'any' ? 'any' : c.childId))
      : condTrue(c, s));
    if (ok) n += s.count;
  }
  return cmp(g.type, n, g.value);
}
function groupTrue(g, sel) {
  const r = [...(g.conditions || []).map((c) => condTrue(c, sel)), ...(g.conditionGroups || []).map((x) => groupTrue(x, sel)),
    ...(g.localConditionGroups || []).map((x) => localGroupTrue(x, sel))];
  if (!r.length) return true;
  return g.type === 'or' ? r.some(Boolean) : r.every(Boolean);
}
// how many times a modifier applies (0 = not active)
function timesActive(m, outer, sel) {
  for (const g of outer) if (!groupTrue(g, sel)) return 0;
  if (!groupTrue({ type: 'and', conditions: m.conditions, conditionGroups: m.conditionGroups, localConditionGroups: m.localConditionGroups }, sel)) return 0;
  if (!Array.isArray(m.repeats) || !m.repeats.length) return 1;
  let t = 0;
  for (const r of m.repeats) {
    let n = 0; for (const b of scopeSels(r.scope, sel)) n += countIn(b, r.childId, r.field, r.includeChildSelections);
    t += (r.roundUp ? Math.ceil(n / r.value) : Math.floor(n / r.value)) * (r.repeats || 1);
  }
  return t;
}
// modifiers of an object in document order, each with the condition groups around it
function flatMods(o, outer = []) {
  const out = [];
  for (const m of o.modifiers || []) out.push({ m, outer });
  for (const g of o.modifierGroups || []) out.push(...flatMods(g, [...outer, { type: g.type || 'and', conditions: g.conditions, conditionGroups: g.conditionGroups, localConditionGroups: g.localConditionGroups }]));
  return out;
}

/* ---------------------------------------------------------------------
   Modifier arithmetic on characteristic strings (New Recruit is dice-aware:
   D6 +1 → D6+1, D3+3 +1 → D3+4, 10" +2 → 12", -2 -1 → -3)
--------------------------------------------------------------------- */
function arith(cur, delta) {
  const v = String(cur);
  if (/^-?\d+$/.test(v)) return String(Number(v) + delta);
  let m = v.match(/^(\d*D\d+)$/i); if (m) return delta === 0 ? v : `${m[1]}${delta > 0 ? '+' : ''}${delta}`;
  m = v.match(/^(\d*D\d+)([+-]\d+)$/i); if (m) { const b = Number(m[2]) + delta; return b === 0 ? m[1] : `${m[1]}${b > 0 ? '+' : ''}${b}`; }
  m = v.match(/^(\d+)(\D+)$/); if (m) return `${Number(m[1]) + delta}${m[2]}`;
  CTX.warnings.add(`cannot add ${delta} to "${v}"`); return v;
}
function applyValue(cur, m, times) {
  cur = cur == null ? '' : String(cur);
  switch (m.type) {
    case 'set': return m.value == null ? '' : String(m.value);
    case 'increment': return arith(cur, Number(m.value) * times);
    case 'decrement': return arith(cur, -Number(m.value) * times);
    case 'append': { if (m.skipIfPresent && cur.includes(m.skipIfPresent)) return cur; const j = m.join != null ? m.join : ' '; return cur ? cur + j + m.value : String(m.value); }
    case 'replace': return m.arg == null ? cur : cur.split(String(m.arg)).join(m.value == null ? '' : String(m.value));
    case 'multiply': return String(Number(cur) * Number(m.value));
    case 'divide': return String(Number(cur) / Number(m.value));
    // a lower limit on the number ("2+" stays 2+: Gore-stained Veterans' +1 WS, then floor 2)
    case 'floor': { const n = /^(-?\d+)(.*)$/.exec(cur); if (!n) break; return Number(n[1]) < Number(m.value) ? `${Number(m.value)}${n[2]}` : cur; }
  }
  CTX.warnings.add(`modifier type ${m.type} on a value`); return cur;
}
// a profile or rule instance: a copy whose fields modifiers can change
function profInst(p, sel, extra) {
  return { id: p.id, name: p.name, typeName: p.typeName, typeId: p.typeId, hidden: !!p.hidden, sel,
    chars: (p.characteristics || []).map((c) => ({ name: c.name, typeId: c.typeId, value: c.$text == null ? '' : c.$text })), ...extra };
}
function applyToInst(inst, m, times) {
  if (m.field === 'annotation') return;
  if (m.field === 'hidden') { inst.hidden = m.value === true || m.value === 'true'; return; }
  if (m.field === 'name') { inst.name = applyValue(inst.name, m, times); return; }
  const ch = inst.chars && inst.chars.find((c) => c.typeId === m.field || c.name === SRC.charName.get(m.field));
  if (ch) ch.value = applyValue(ch.value, m, times);
}
// which selection a change comes from: the one whose modifier reaches across (an enhancement's
// "affects"), or, for a modifier written on the profile itself, the entries its conditions name
function condNames(m, outer) {
  const out = []; const walk = (c) => { for (const x of c.conditions || []) if (x.childId && SRC.get(x.childId)) out.push(nn(SRC.get(x.childId).name)); for (const g of [...(c.conditionGroups || []), ...(c.localConditionGroups || [])]) walk(g); };
  walk(m); for (const o of outer) walk(o); return [...new Set(out)];
}
function applyTracked(inst, m, times, by) {
  const before = inst.chars ? inst.chars.map((c) => c.value) : null;
  applyToInst(inst, m, times);
  if (before) inst.chars.forEach((c, i) => { if (c.value !== before[i]) (inst.changes || (inst.changes = [])).push({ char: c.name, by, comment: m.comment ? nn(m.comment) : null, type: m.type, value: String(m.value), before: before[i], after: c.value }); });
}
function localMods(obj, inst, sel) {   // modifiers written on the profile / rule / link itself
  for (const { m, outer } of flatMods(obj)) { if (m.affects) continue; const t = timesActive(m, outer, sel); if (t) applyTracked(inst, m, t, condNames(m, outer)); }
}

/* collect each selection's profiles and rules (before the modifiers that reach across selections) */
function collectInfo(sel) {
  const n = sel.node;
  const take = (p, extra) => { const i = profInst(p, sel, extra); localMods(p, i, sel); return i; };
  const takeLink = (il, extra) => {
    const t = SRC.get(il.targetId); if (!t) return null;
    if (il.type === 'profile') { const i = take(t, extra); i.hidden = i.hidden || !!il.hidden; localMods(il, i, sel); return { kind: 'p', i }; }
    if (il.type === 'rule') { const i = { id: t.id, name: t.name, text: t.description || '', hidden: !!(t.hidden || il.hidden), sel, ...extra }; localMods(t, i, sel); localMods(il, i, sel); return { kind: 'r', i }; }
    return null;
  };
  for (const p of n.profiles) sel.profiles.push(take(p, {}));
  for (const r of n.rules) { const i = { id: r.id, name: r.name, text: r.description || '', hidden: !!r.hidden, sel }; localMods(r, i, sel); sel.rules.push(i); }
  for (const il of n.infoLinks) { const x = takeLink(il, {}); if (x) (x.kind === 'p' ? sel.profiles : sel.rules).push(x.i); }
  const groups = [...n.infoGroups];
  while (groups.length) {
    const g = groups.shift(); const extra = { infoGroup: g.name };
    for (const p of g.profiles || []) sel.profiles.push(take(p, extra));
    for (const r of g.rules || []) { const i = { id: r.id, name: r.name, text: r.description || '', hidden: !!r.hidden, sel, ...extra }; localMods(r, i, sel); sel.rules.push(i); }
    for (const il of g.infoLinks || []) { const x = takeLink(il, extra); if (x) (x.kind === 'p' ? sel.profiles : sel.rules).push(x.i); }
    groups.push(...(g.infoGroups || []));
  }
}
function groupOf(sel) { return sel.root.group || [sel.root]; }
// "affects" paths of New Recruit, e.g. self.entries.group.recursive.<id>.profiles.Ranged Weapons
function resolveAffects(affects, base) {
  const toks = affects.split('.'); let S = new Set([base]); let profType = null; let i = 0;
  while (i < toks.length) {
    const t = toks[i];
    if (t === 'self') { /* the base */ }
    else if (t === 'entries') { for (const s of [...S]) for (const c of s.children) S.add(c); }
    else if (t === 'recursive') { for (const s of [...S]) for (const d of s.desc(false)) S.add(d); }
    else if (t === 'group') { for (const s of [...S]) if (s.node) for (const r of groupOf(s)) S.add(r); }
    else if (t === 'associations') { const roots = new Set([...S].filter((s) => s.node).map((s) => s.root)); const T = new Set(); for (const r of roots) for (const o of groupOf(r)) if (!roots.has(o)) for (const d of o.desc(true)) T.add(d); S = T; }
    else if (t === 'forces') { S = new Set(CTX.force.desc(false)); }
    else if (t === 'profiles') { profType = toks.slice(i + 1).join('.'); break; }
    else if (/^[0-9a-f]{1,4}(-[0-9a-f]{1,4}){3}$/.test(t)) { S = new Set([...S].filter((s) => isInstance(s, t))); }
    else { CTX.warnings.add(`affects token "${t}" in "${affects}" not understood`); return { sels: [], profType: null }; }
    i++;
  }
  return { sels: [...S].filter((s) => s.node), profType };
}
function applyAcross(sel) {            // modifiers with "affects", and category / add-info changes
  for (const { m, outer } of flatMods(sel.node)) {
    const isCat = m.field === 'category'; const isInfo = m.field === 'add-info';
    if (!m.affects && !isCat && !isInfo) continue;
    if (!m.affects && isCat) { const t = timesActive(m, outer, sel); if (t) for (const s of scopeSels(m.scope || 'self', sel)) applyCat(s, m); continue; }
    const t = timesActive(m, outer, sel); if (!t) continue;
    const base = scopeSels(m.scope || 'self', sel)[0]; if (!base) continue;
    const { sels, profType } = m.affects ? resolveAffects(m.affects, base) : { sels: [sel], profType: null };
    if (isCat) { for (const s of sels) applyCat(s, m); continue; }
    if (isInfo) { const tg = m.affects === 'group' ? groupOf(base) : sels; for (const s of tg) addInfo(s, m.value, sel); continue; }
    if (profType) for (const s of sels) for (const p of s.profiles) if (p.typeName === profType) applyTracked(p, m, t, [nn(sel.node.name), ...condNames(m, outer)]);
  }
}
// a selection's own category changes, on the selection its scope names (Houndpack Lance Character adds CHARACTER to its parent,
// the War Dog): made before the hidden flags, which can depend on them (Final Howl and Warlord need a CHARACTER War Dog)
function applyOwnCats(sel) {
  for (const { m, outer } of flatMods(sel.node)) if (m.field === 'category' && !m.affects && timesActive(m, outer, sel)) for (const s of scopeSels(m.scope || 'self', sel)) applyCat(s, m);
}
function applyCat(s, m) {
  if (m.type === 'set-primary') s.primary = m.value;
  if (m.type === 'add' || m.type === 'set-primary') s.cats.add(m.value);
  else if (m.type === 'remove') s.cats.delete(m.value);
}
function addInfo(s, id, from) {
  const t = SRC.get(id); if (!t) return;
  if (t.description != null || (t.characteristics == null && t.typeName == null)) s.rules.push({ id: t.id, name: t.name, text: t.description || '', hidden: !!t.hidden, sel: s, addedBy: from.node.name });
  else s.profiles.push({ ...profInst(t, s, {}), addedBy: from.node.name });
}
function selHidden(sel) {
  let h = sel.node.hidden;
  for (const { m, outer } of flatMods(sel.node)) if (!m.affects && m.field === 'hidden' && timesActive(m, outer, sel)) h = m.value === true || m.value === 'true';
  return h;
}
// a category entry hidden by its own modifiers is not a keyword of the unit (Recon Augury: hidden unless the
// army has the Cohort Acquisitus detachment)
function catHidden(ce, sel) {
  let h = !!ce.hidden;
  for (const { m, outer } of flatMods(ce)) if (!m.affects && m.field === 'hidden' && timesActive(m, outer, sel)) h = m.value === true || m.value === 'true';
  return h;
}
function costOf(sel) {                 // pts of this selection (entry cost × count, modifiers applied)
  let v = sel.node.costs[PTS] || 0;
  for (const { m, outer } of flatMods(sel.node)) {
    if (m.affects || m.field !== PTS) continue;
    const t = timesActive(m, outer, sel); if (!t) continue;
    if (m.type === 'set') v = Number(m.value); else if (m.type === 'increment') v += Number(m.value) * t;
    else if (m.type === 'decrement') v -= Number(m.value) * t; else if (m.type === 'multiply') v *= Number(m.value);
    else if (m.type === 'divide') v /= Number(m.value);
  }
  return v * sel.count;
}
function minRequired(sel, kn) {        // a "min N in parent" constraint, with its modifiers
  let need = 0;
  for (const c of kn.constraints) {
    if (c.type !== 'min' || c.scope !== 'parent' || c.field !== 'selections') continue;
    let v = c.value;
    for (const { m, outer } of flatMods(kn)) if (m.field === c.id && timesActive(m, outer, sel)) v = Number(applyValue(String(v), m, 1));
    need = Math.max(need, v);
  }
  return need;
}

/* ---------------------------------------------------------------------
   Build the roster from data.js
--------------------------------------------------------------------- */
function rootLinksOf(catFile, seen = new Set()) {
  if (!catFile || seen.has(catFile.fname)) return []; seen.add(catFile.fname);
  const t = catFile.obj; let out = [];
  for (const l of t.entryLinks || []) out.push({ fname: catFile.fname, arr: 'entryLinks', link: l });
  for (const e of t.selectionEntries || []) out.push({ fname: catFile.fname, arr: 'selectionEntries', entry: e });
  for (const cl of t.catalogueLinks || []) if (cl.importRootEntries) out = out.concat(rootLinksOf(SRC.fileById(cl.targetId), seen));
  return out;
}
function rootNode(catFile, name) {
  const hits = [];
  for (const r of rootLinksOf(catFile)) {
    if (r.link) {
      if (nn(r.link.name) !== nn(name)) continue;
      const t = SRC.get(r.link.targetId); if (!t) continue;
      SRC.touch(r.fname, r.arr, r.link.id); hits.push({ n: node(t, r.link), fname: r.fname });
    } else if (nn(r.entry.name) === nn(name)) { SRC.touch(r.fname, r.arr, r.entry.id); hits.push({ n: node(r.entry), fname: r.fname }); }
  }
  const uniq = [...new Map(hits.map((h) => [h.n.id, h])).values()];
  return uniq;
}
function parseLine(line) {
  const m = nn(line).match(/^(\d+)\s*[×x]\s*(.+)$/); if (!m) return null;
  const name = m[2]; const b = name.match(/^(.*\S)\s+\(([^()]+)\)$/);
  return { count: Number(m[1]), name, base: b ? b[1] : null, extra: b ? b[2] : null };
}
function gearMatch(name) {
  const want = nn(name);
  return (k) => (k.type === 'upgrade') && (nn(k.name) === want || profilesOf(k).some((p) => {
    if (!WEAPON_TYPES.includes(p.typeName) && p.typeName !== 'Abilities') return nn(p.name) === want;
    const w = parseWeaponName(p.name, k.name); return w.full === want || w.group === want || w.pname === want && !w.group;
  }));
}
// the places BSData offers one wargear item below a node (exact entry name first, else by profile name)
function gearCandidates(startNode, name) {
  const exact = searchBelow(startNode, (k) => k.type === 'upgrade' && nn(k.name) === nn(name));
  return exact.length ? exact : searchBelow(startNode, gearMatch(name));
}
const groupMax = (g) => { const c = g.constraints.find((x) => x.type === 'max' && x.scope === 'parent' && x.field === 'selections'); return c ? c.value : Infinity; };
const pathKey = (p) => p.map((x) => x.id + '|' + x.linkId).join('/');
// choose a place for every wargear item of one models line at once: no option group above its
// maximum, and where an item is offered alone and inside a bundle ("Ectoplasma cannon and claws"),
// prefer the bundle that explains most of the line's gear
function assignGear(items) {            // items: [{ name, cands: [path] }]
  const gearSet = new Set(items.map((x) => nn(x.name)));
  const score = (p) => {
    let sc = 0;
    for (const b of p.slice(0, -1).filter((x) => x.type === 'upgrade')) {
      const inner = kids(b).filter((k) => k.type === 'upgrade').map((k) => nn(k.name));
      sc += inner.every((x) => gearSet.has(x)) ? inner.length : -10;
    }
    return sc;
  };
  // a group holds selections of distinct entries directly below it (two items inside one bundle are one selection)
  // a place can be taken as often as its entry's maximum per parent allows (the Contemptor-Achillus's Lastrum storm bolter: one
  // entry, max 2): the second take is the same selection with count 2
  const cap = (p) => { const n = p[p.length - 1]; const c = n.constraints.find((x) => x.type === 'max' && x.scope === 'parent' && x.field === 'selections');
    return c ? Math.max(1, Math.floor(c.value / fixedCount(n))) : 1; };
  let best = null; const used = new Map(); const taken = new Map(); const pick = [];
  const below = (p) => p.map((g, j) => g.type === 'group' ? [g.id + '|' + g.linkId, groupMax(g), pathKey([p[j + 1]])] : null).filter(Boolean);
  const go = (i, total) => {
    if (i === items.length) { if (!best || total > best.total) best = { total, pick: pick.slice() }; return; }
    const cands = items[i].cands;
    if (!cands.length) { pick.push(null); go(i + 1, total - 100); pick.pop(); return; }
    let any = false;
    for (const p of cands) {
      const k = pathKey(p); if ((taken.get(k) || 0) >= cap(p)) continue;
      const gs = below(p);
      if (gs.some(([g, max, child]) => { const set = used.get(g) || new Map(); return !set.has(child) && set.size >= max; })) continue;
      any = true;
      taken.set(k, (taken.get(k) || 0) + 1); for (const [g, , child] of gs) { const set = used.get(g) || new Map(); set.set(child, (set.get(child) || 0) + 1); used.set(g, set); }
      pick.push(p); go(i + 1, total + score(p)); pick.pop();
      for (const [g, , child] of gs) { const set = used.get(g); const n = set.get(child) - 1; if (n) set.set(child, n); else set.delete(child); }
      if (taken.get(k) > 1) taken.set(k, taken.get(k) - 1); else taken.delete(k);
    }
    if (!any) { pick.push(null); go(i + 1, total - 100); pick.pop(); }
  };
  go(0, 0);
  return best ? best.pick : items.map(() => null);
}

// the list's New Recruit Show/Hide Options, "X are visible" -> X (verify/sources/nr/<army>.txt)
function showOptions(armyId) {
  const f = path.join(HERE, 'sources', 'nr', armyId + '.txt');
  // (a list from a New Recruit JSON export: its top-level "Show/Hide Options" selection, "Khorne Daemons are visible")
  const j = path.join(HERE, 'sources', 'nr-json', armyId + '.json');
  if (!fs.existsSync(f) && fs.existsSync(j)) {
    const sh = ((JSON.parse(fs.readFileSync(j, 'utf8')).roster.forces || [])[0] || { selections: [] }).selections.find((s) => nn(s.name) === 'Show/Hide Options');
    return sh ? (sh.selections || []).map((s) => nn(s.name).replace(/\s+are visible$/, '').trim()).filter(Boolean) : [];
  }
  if (!fs.existsSync(f)) return [];
  const v = require('./nr').parseNR(f, []).bullets['Show/Hide Options'];
  return typeof v === 'string' ? v.split(/,\s*/).map((x) => x.replace(/\s+are visible$/, '').trim()).filter(Boolean) : [];
}
function buildRoster(army, MAP, issues) {
  ORDER = 0;
  const catName = MAP.catalogues[army.faction];
  const cat = SRC.catalogueByName(catName);
  if (!cat) { issues.push({ unit: '(army)', field: 'catalogue', app: army.faction, source: '', where: `no catalogue "${catName}"` }); return null; }
  const gs = SRC.gameSystem();
  const roster = new Sel(null, 1, null, 'roster');
  const force = new Sel(null, 1, roster, 'force');
  const fe = (gs.obj.forceEntries || []).find((f) => f.name === 'Army Roster');
  if (fe) { force.entryId = fe.id; SRC.touch(gs.fname, 'forceEntries', fe.id); }
  CTX.roster = roster; CTX.force = force; CTX.primary = cat.obj.id; CTX.beforeK = new Map();
  // battle size and detachments
  const bsName = (MAP.battleSize || {})[army.battleSize] || army.battleSize;
  const bsRoot = rootNode(gs, 'Battle Size')[0];
  if (bsRoot) {
    const p = searchBelow(bsRoot.n, (k) => k.type === 'upgrade' && (nn(k.name) === nn(bsName) || new RegExp(`\\b${bsName}\\b`).test(k.name)))[0];
    const top = new Sel(bsRoot.n, 1, force); if (p) addChain(top, p, 1);
    else issues.push({ unit: '(army)', field: 'battleSize', app: army.battleSize, source: '', where: 'Battle Size options' });
  }
  // (the Adeptus Custodes catalogue holds its detachments under a root entry "Detachments", the others under "Detachment")
  const detRoots = rootNode(cat, 'Detachment').concat(rootNode(cat, 'Detachments'));
  const detTops = new Map();
  for (const d of army.detachments) {
    const name = (MAP.detachments || {})[d] || (DATA.factions[army.faction].detachments[d] || {}).name || d;
    let p = null, detRoot = null;
    for (const r of detRoots) { p = searchBelow(r.n, (k) => k.type === 'upgrade' && nn(k.name) === nn(name))[0]; if (p) { detRoot = r; break; } }
    if (p && !detTops.has(detRoot)) detTops.set(detRoot, new Sel(detRoot.n, 1, force));
    if (p) addChain(detTops.get(detRoot), p, 1);
    else issues.push({ unit: '(army)', field: 'detachment', app: name, source: '', where: `${cat.fname} › Detachment` });
  }
  // the Show/Hide Options the PDF prints ("Nurgle Daemons are visible"): BSData hides an allied unit (Nurglings) unless the
  // roster has its "Show Nurgle Daemons" selection
  const shown = showOptions(army.id);
  const shRoot = shown.length ? rootNode(cat, 'Show/Hide Options')[0] : null;
  if (shRoot) {
    const top = new Sel(shRoot.n, 1, force);
    // (every catalogue the faction's imports links the same Show/Hide Options entry, each link adding its own options inside itself:
    // the Imperial Knights catalogue's "Show Imperial Agents", which the Agents of the Imperium catalogue's link does not have)
    const links = rootLinksOf(cat).filter((r) => r.link && nn(r.link.name) === nn('Show/Hide Options') && r.link.targetId === (shRoot.n.link || {}).targetId);
    const opts = kids(shRoot.n).concat(links.flatMap((r) => (r.link.entryLinks || []).map((l) => { const t = SRC.get(l.targetId); return t ? node(t, l) : null; }).filter(Boolean)));
    for (const o of shown) { const k = opts.find((x) => x.type === 'upgrade' && nn(x.name) === nn('Show ' + o)); if (k) addChain(top, [k], 1); }
  }
  // units, every copy
  const built = [];
  for (const u of army.units) {
    // (a reference sheet of models GW prints on another sheet's datasheet, ref.of: the Brimstone Horrors on the Blue Horrors': no BSData
    // entry of its own; that sheet's entry is checked as that sheet)
    if (u.ref && u.ref.of) continue;
    const um = (MAP.units || {})[`${army.id}/${u.id}`] || {};
    const copies = [];
    for (let c = 0; c < (u.copies || 1); c++) copies.push(buildUnit(army, u, um, cat, force, c === 0 ? issues : []));
    built.push({ u, copies });
  }
  return { roster, force, cat, built };
}

function buildUnit(army, u, um, cat, force, issues) {
  const fail = (field, app, source, where) => issues.push({ unit: u.id, field, app: str(app), source: str(source), where });
  const lines = (u.models || []).map(parseLine);
  const gear = u.gear || [];
  const roots = [];
  // the characters (the unit's own name, then `also`: a Warboss leading the Breaka Boyz a Bigboss supports), then the bodyguard
  const names = [um.entry || u.name].concat((u.also || []).map((c) => ((um.alsoEntry || {})[c.name]) || c.name)); if (u.leads) names.push(um.leadsEntry || u.leads);
  for (const nm of names) {
    // (map-bsdata.json: a part from another faction's catalogue, catalogue: { name: catalogue } (the Deathwatch Terminator Squad an
    // Ultramarines list takes through Deathwatch Support); one of two root entries of the same name, entryId: { name: root id })
    const pcat = (um.catalogue || {})[nm] ? SRC.catalogueByName(um.catalogue[nm]) || cat : cat;
    let hits = rootNode(pcat, nm);
    if (hits.length > 1 && (um.entryId || {})[nm]) hits = hits.filter((h) => h.n.id === um.entryId[nm] || (h.n.linkId || '') === um.entryId[nm]);
    if (hits.length !== 1) { fail('entry', nm, hits.map((h) => h.n.name).join(' | '), `${pcat.fname}: ${hits.length} root entries named "${nm}"`); continue; }
    roots.push(new Sel(hits[0].n, 1, force));
  }
  if (!roots.length) return { roots };
  for (const r of roots) r.group = roots;
  // models lines: a model-type root takes the line with its own name; the others are models of a unit-type root
  lines.forEach((ln, i) => {
    if (!ln) { fail('models', u.models[i], '', 'models line not "N× name"'); return; }
    const want = (um.models || {})[ln.name] || ln.name;
    let unitRoot = null; let msel = roots.find((r) => r.node.type === 'model' && nn(r.node.name) === nn(want)) || null;
    let extra = null;
    if (!msel && ln.base && !(um.models || {})[ln.name]) { msel = roots.find((r) => r.node.type === 'model' && nn(r.node.name) === nn(ln.base)) || null; if (msel) extra = ln.extra; }
    if (msel) { if (ln.count !== 1) fail('models', u.models[i], `1× ${msel.node.name}`, 'a single-model datasheet'); }
    else {
      for (const r of roots) {
        if (r.node.type !== 'unit') continue;
        const find = (nm) => searchBelow(r.node, (k) => k.type === 'model' && nn(k.name) === nn(nm))[0];
        let p = find(want);
        if (!p && ln.base && !(um.models || {})[ln.name]) { p = find(ln.base); if (p) extra = ln.extra; }
        if (p) { unitRoot = r; msel = addChain(r, p, ln.count, { fresh: true }); break; }
      }
    }
    if (!msel) { fail('models', u.models[i], '', `no BSData model entry "${want}" in ${roots.map((r) => r.node.name).join(' / ')}`); return; }
    const items = [...(gear[i] || [])]; const nGear = items.length;
    // the models line's wargear ("Praesidium Shield, Vexilla"): one item, or, when BSData offers no item of that whole name, each
    // item of the list
    if (extra) items.push(...(extra.includes(',') && !gearCandidates(msel.node, extra).length && !(unitRoot && gearCandidates(unitRoot.node, extra).length) ? extra.split(/\s*,\s*/) : [extra]));
    // wargear of the model first; what is not there may be a unit-level option (hellfyre missile rack, icon)
    const own = items.map((g, k) => ({ g, name: ((um.gear || {})[g]) || g, line: k >= nGear }));
    for (const it of own) { it.cands = gearCandidates(msel.node, it.name); it.parent = msel; it.cnt = msel.count; }
    if (unitRoot) for (const it of own) if (!it.cands.length) { it.cands = gearCandidates(unitRoot.node, it.name); it.parent = unitRoot; it.cnt = ln.count; }
    // BSData gives the Two-Busta model its launcha as one selection of 2 (min = max = 2);
    // the app's gear names it once per weapon: the repeats are that one selection
    const perPath = (q) => q.filter((n) => n.type === 'upgrade').reduce((c, n) => c * fixedCount(n), 1);
    // (where only some places give it as a fixed 2, the Telemon's "Dual Fists and 2 Projectors" bundle among bundles of 1: the
    // repeats are that place's one selection, and only those places are left for it)
    for (let j = 0; j < own.length; j++) {
      const it = own[j]; const f = it.cands.length ? Math.max(...it.cands.map(perPath)) : 1;
      if (f < 2) continue;
      const rep = own.map((x, k) => k).filter((k) => k > j && own[k].name === it.name).slice(0, f - 1);
      if (rep.length !== f - 1) continue;
      if (!it.cands.every((q) => perPath(q) === f)) it.cands = it.cands.filter((q) => perPath(q) === f);
      for (const k of rep.reverse()) own.splice(k, 1);
    }
    const picks = assignGear(own);
    // an item named twice whose second place is taken: the same option taken twice (one selection of 2: a Nob's two Rokkit
    // Pistols), when the entry allows that many per model
    const maxPer = (n) => { const c = n.constraints.find((x) => x.type === 'max' && x.scope === 'parent' && x.field === 'selections'); return c ? c.value : Infinity; };
    const times = new Map();
    own.forEach((it, j) => {
      if (picks[j] || !it.cands.length) return;
      // the models line names the bundle whose weapon the gear names (the Shield-Captain's "Paragon Blade & Praesidium Shield",
      // which holds its Eternity-pattern Paragon Blade): the place the weapon took is that bundle's one selection
      if (it.line && own.some((x, i) => i !== j && picks[i] && picks[i] !== 'same' && x.parent === it.parent && it.cands.some((q) => pathKey(q) === pathKey(picks[i])))) { picks[j] = 'same'; return; }
      // (one selection whose profiles are separate weapons of another type, the Tesseract Vault's "C'tan Powers": each weapon the gear
      // names is that selection's)
      const leafOf = (q) => q[q.length - 1], shaped = (q) => { const n = leafOf(q); const ps = n ? profilesOf(n) : []; return ps.length > 1 && ps.every((p) => weaponShaped(p) && !WEAPON_TYPES.includes(p.typeName)); };
      if (own.some((x, i) => i !== j && picks[i] && picks[i] !== 'same' && x.parent === it.parent && it.cands.some((q) => pathKey(q) === pathKey(picks[i]) && shaped(q)))) { picks[j] = 'same'; return; }
      const k = own.findIndex((x, i) => i < j && picks[i] && x.name === it.name && x.parent === it.parent);
      if (k < 0) return;
      const n = (times.get(k) || 1) + 1, leaf = picks[k][picks[k].length - 1];
      if (n <= maxPer(leaf)) { times.set(k, n); picks[j] = 'same'; }
    });
    own.forEach((it, j) => {
      if (picks[j] === 'same') return;
      if (!picks[j]) { fail('gear', it.g, '', `no BSData wargear "${it.name}" for ${msel.node.name}${it.cands.length ? ' (every place it is offered is taken)' : ''}`); return; }
      if (times.has(j)) { addChain(it.parent, picks[j], it.cnt * times.get(j)); return; }
      // below a model selection counts are per models line (the model selection holds ln.count models)
      addChain(it.parent, picks[j], it.cnt);
    });
  });
  // `unplaced`: wargear New Recruit lists for the unit but on no models line (a unit-level option of the
  // part its `who` names, else the last part): as many as the app's weapon count, or one
  for (const name of u.unplaced || []) {
    const x = [...(u.ranged || []), ...(u.melee || []), ...(u.abilities || [])].find((y) => (y.group || y.name) === name) || {};
    const host = (x.who && roots.find((r) => nn(r.node.name) === nn(x.who))) || roots[roots.length - 1];
    const p = gearCandidates(host.node, ((um.gear || {})[name]) || name)[0];
    // (a weapon profile of the unit's own entry, which no model carries: BSData's "Coruscating Blue flames (ref. only)" on Pink Horrors,
    // counted with the unit's weapons above)
    const ownW = (host.node.profiles || []).some((pr) => /Weapons$/.test(pr.typeName || '') && (({ group, pname }) => nn(group || pname) === nn(name))(parseWeaponName(pr.name, host.node.name)));
    if (!p && ownW) { checked('gear'); continue; }
    if (!p) { fail('unplaced', name, '', `no BSData wargear "${name}" for ${host.node.name}`); continue; }
    addChain(host, p, Number(x.n) || 1);
  }
  // enhancement and warlord, on the leader (first root), or the character named in `enhOn`
  const lead = roots[0];
  if (u.enhancement) {
    const host = (u.enhOn && roots.find((r) => nn(r.node.name) === nn(u.enhOn))) || lead;
    if (u.enhOn && host === lead && nn(lead.node.name) !== nn(u.enhOn)) fail('enhOn', u.enhOn, roots.map((r) => r.node.name).join(' / '), 'no part of the unit is named as enhOn');
    const spelt = enhSpelling(army, u.enhancement);
    // (on the unit's character model when BSData offers it there: the Dark Apostle's, not the unit's with its Dark Disciples)
    const isIt = (k) => k.type === 'upgrade' && (nn(k.name) === nn(u.enhancement) || (spelt && nn(k.name) === nn(spelt)));
    const p = searchBelow(host.node, isIt)[0] || searchBelow(host.node, isIt, { intoModels: true })[0];
    if (!p) fail('enhancement', u.enhancement, '', `no enhancement "${u.enhancement}" for ${host.node.name}`);
    else {
      const last = p[p.length - 1];
      const already = host.desc(false).find((d) => d.node.id === last.id);
      (already || addChain(host, p, 1)).isEnhancement = true;
    }
  }
  // an UPGRADE enhancement goes on the unit it upgrades: the bodyguard (last root)
  if (u.upgrade) {
    const host = roots[roots.length - 1];
    // (BSData can name it with its kind: "Furious Assault (Upgrade)")
    const spelt = enhSpelling(army, u.upgrade);
    const p = searchBelow(host.node, (k) => k.type === 'upgrade' && (nn(k.name) === nn(u.upgrade) || nn(k.name) === nn(u.upgrade + ' (Upgrade)') || (spelt && nn(k.name) === nn(spelt))))[0];
    if (!p) fail('upgrade', u.upgrade, '', `no upgrade "${u.upgrade}" for ${host.node.name}`);
    else {
      const last = p[p.length - 1];
      const already = host.desc(false).find((d) => d.node.id === last.id);
      (already || addChain(host, p, 1)).isEnhancement = true;
    }
  }
  if (u.warlord) {
    const wh = (u.warlordOn && roots.find((r) => nn(r.node.name) === nn(u.warlordOn))) || lead;   // the character named in `warlordOn`, else the first
    const k = kids(wh.node).find((x) => x.type === 'upgrade' && x.name === 'Warlord');
    if (!k) fail('warlord', true, '', `no Warlord entry for ${wh.node.name}`); else new Sel(k, 1, wh).isWarlord = true;
  }
  return { roots };
}

// after the whole roster exists: required wargear the app's gear did not name
function requiredCheck(unitRoots, fail) {
  for (const r of unitRoots) for (const s of r.desc(true)) {
    if (s.kind !== 'model' && s !== r) continue;
    const mine = ownDesc(s);
    const walk = (n) => {
      for (const k of kids(n)) {
        if (k.type === 'model' || k.type === 'unit') continue;
        const need = minRequired(s, k);
        if (need && k.name === 'Warlord') { if (!mine.some((d) => d.isWarlord)) fail('warlord', false, true, `${s.where()}: BSData makes this model the Warlord (min ${need})`); continue; }
        if (need && !hiddenStatic(s, k)) {
          const has = mine.some((d) => (d.node.id === k.id && d.node.linkId === k.linkId) || (k.type === 'group' && isUnder(d, k)));
          const modelsInside = k.type === 'group' && searchBelow(k, (x) => x.type === 'model', { max: 1 }).length;
          if (!has && !modelsInside) fail('gear', '', k.name, `${s.where()}: BSData requires "${k.name}" (min ${need}); the app's gear does not name it`);
        }
        if (k.type === 'group') walk(k);
      }
    };
    walk(s.node);
  }
}
function isUnder(sel, groupNode) { return searchBelow(groupNode, (k) => k.id === sel.node.id && k.linkId === sel.node.linkId, { intoModels: false, max: 1 }).length > 0; }
function hiddenStatic(sel, n) { let h = n.hidden; for (const { m, outer } of flatMods(n)) if (!m.affects && m.field === 'hidden' && timesActive(m, outer, sel)) h = m.value === true || m.value === 'true'; return h; }

/* ---------------------------------------------------------------------
   Facts of one built unit (first copy)
--------------------------------------------------------------------- */
const keyChar = (k) => ({ ld: 'LD', sv: 'Sv', insv: 'InSv', base: 'Base' })[k.toLowerCase()] || k;
function unitFacts(roots) {
  const F = { roots, stats: [], weapons: [], abilities: [], rules: [], cats: new Set(), catWhere: {} };
  const all = []; for (const r of roots) for (const s of r.desc(true)) all.push(s);
  for (const s of all) {
    if (s.hidden) continue;
    for (const c of s.cats) { const ce = SRC.get(c); if (ce && !catHidden(ce, s)) { F.cats.add(nn(ce.name)); F.catWhere[nn(ce.name)] = s.where(); } }
    const isWeapon = s.profiles.some(isWeaponProf);
    for (const p of s.profiles) {
      if (p.hidden) continue;
      const ch = Object.fromEntries(p.chars.map((c) => [c.name, c.value]));
      if (p.typeName === 'Unit') {
        let count = s.count;
        if (s.kind === 'unit') count = s.desc(false).filter((d) => d.kind === 'model' && !d.profiles.some((q) => q.typeName === 'Unit' && !q.hidden)).reduce((a, d) => a + d.count, 0) || 1;
        F.stats.push({ root: s.root, name: nn(p.name), ch, count, changes: p.changes || [], where: s.where() });
      } else if (isWeaponProf(p)) {
        const w = parseWeaponName(p.name, s.node.name);
        F.weapons.push({ root: s.root, kind: weaponKind(p, ch), ...w, ch, kw: kwList(ch.Keywords), count: s.count, enh: !!s.isEnhancement, changes: p.changes || [], where: `${s.where()} › ${p.name}` });
      } else {
        const text = p.chars.map((c) => c.value).join('\n');
        F.abilities.push({ root: s.root, name: nn(p.name), typeName: p.typeName, text, sel: s, infoGroup: p.infoGroup || null, enh: !!s.isEnhancement, where: `${s.where()} › ${p.name}` });
      }
    }
    for (const r of s.rules) if (!r.hidden) F.rules.push({ name: nn(r.name), text: r.text, infoGroup: r.infoGroup || null, weapon: isWeapon, where: `${s.where()} › rule ${r.name}` });
  }
  // merge stats rows: same root, name and values
  const sm = new Map();
  for (const r of F.stats) { const k = [r.root.order, r.name, JSON.stringify(r.ch)].join('|'); if (sm.has(k)) sm.get(k).count += r.count; else sm.set(k, { ...r }); }
  F.stats = [...sm.values()];
  const wm = new Map();
  for (const w of F.weapons) { const k = [w.root.order, w.kind, w.full, JSON.stringify(w.ch)].join('|'); if (wm.has(k)) wm.get(k).count += w.count; else wm.set(k, { ...w }); }
  F.weapons = [...wm.values()];
  const am = new Map();
  for (const a of F.abilities) { const k = [a.root.order, a.name, a.text].join('|'); if (!am.has(k)) am.set(k, a); }
  F.abilities = [...am.values()];
  return F;
}
// every ability profile anywhere in a datasheet (selected or not), for app abilities marked na
const DS_CACHE = new Map();
function datasheetAbilities(root) {
  if (DS_CACHE.has(root)) return DS_CACHE.get(root);
  const out = []; const q = [[root.node, root.node.name]]; const seen = new Set();
  while (q.length) {
    const [n, w] = q.shift();
    for (const p of profilesOf(n)) if (p.typeName && p.typeName !== 'Unit' && !isWeaponProf(p)) {
      out.push({ root, name: nn(p.name), typeName: p.typeName, text: (p.characteristics || []).map((c) => c.$text || '').join('\n'), where: `${w} › ${p.name} (not selected in this list)` });
    }
    for (const k of kids(n)) { const key = k.id + '|' + k.linkId; if (seen.has(key) || /Enhancements/.test(k.name)) continue; seen.add(key); q.push([k, `${w} › ${k.name}`]); }
  }
  DS_CACHE.set(root, out); return out;
}
function splitAbilityName(raw) {       // "Name (Tag) (Tag2)" → { base, tags[] }
  let s = nn(raw); const tags = [];
  for (;;) { const m = s.match(/^(.*\S)\s*\(([^()]*)\)$/); if (!m) break; tags.unshift(...m[2].split(/\s*,\s*/)); s = m[1]; }
  return { base: s, tags };
}
const kwBase = (k) => nk(k).replace(/:.*$/, '').replace(/^ANTI-.*$/, 'ANTI').replace(/\s+(D?\d+\+?|D\d+[+-]\d+|\d*D\d+)$/, '').trim();

/* ---------------------------------------------------------------------
   Granted values: a weapon or stat value that BSData changes, and the rule that changes it.
   The source of a change is the modifier's comment ("Relentless Rage"), the selection whose
   modifier it is (an enhancement: "Supa-snazz Dakka") or an entry its conditions name (a
   detachment: "Shoota Boyz"). A name that is one of the unit's abilities, a detachment rule or
   army rule of the list, or a detachment of the list (standing for its rule) is the source.
   A change written on the unit's own datasheet entry is granted by the unit's ability whose text
   names the keyword ("[IGNORES COVER]") or the characteristic and the new value ('Move
   characteristic of 10"'); a change no ability names is the datasheet's own profile, not marked.
   The app marks a granted value `from: { <keyword or field>: name | [names] }`.
--------------------------------------------------------------------- */
const CHAR_KEY = { Range: 'range', LD: 'Ld', Base: 'base' };
const CHAR_WORDS = { M: /\bMove\b|\bM\b/, T: /\bToughness\b|\bT\b/, Sv: /\bSave\b|\bSv\b/, W: /\bWounds characteristic\b|\bW\b/, Ld: /\bLeadership\b|\bLd\b/,
  OC: /\bObjective Control\b|\bOC\b/, InSv: /\bInSv\b|\binvulnerable save\b/i, A: /\bAttacks\b|\bA\b/, S: /\bStrength\b|\bS\b/, D: /\bDamage\b|\bD\b/,
  AP: /\bAP\b/, BS: /\bBS\b|\bBallistic Skill\b/, WS: /\bWS\b|\bWeapon Skill\b/, range: /\bRange\b|\bR\b/ };
// an enhancement's name as New Recruit and BSData spell it, where it differs from GW's (data.js enhancement `nr`)
function enhSpelling(army, name) {
  const e = Object.values(DATA.factions[army.faction].detachments).flatMap((d) => d.enhancements || []).find((x) => x.name === name);
  return e && e.nr ? e.nr : null;
}
function grantNames(army) {
  const f = DATA.factions[army.faction];
  const dets = army.detachments.map((d) => f.detachments[d]).filter(Boolean);
  const m = new Map();
  for (const d of dets) if (d.rule) { m.set(nn(d.rule.name), d.rule.name); m.set(nn(d.name), d.rule.name); for (const r of d.moreRules || []) m.set(nn(r.name), r.name); }
  for (const r of f.armyRules || []) m.set(nn(r.name), r.name);
  return m;
}
// the granted values of one BSData profile, as the app should mark them: Map key → sorted names
function grantsOf(army, u, prof, appKw) {
  const out = new Map();
  const named = grantNames(army);
  const abil = new Map((u.abilities || []).map((a) => [nn(a.name), a]));
  const flat = (t) => nn(String(t || '').replace(/\*\*/g, ''));
  for (const c of prof.changes || []) {
    const isKw = c.char === 'Keywords';
    let keys;
    // the keywords the change adds (one the weapon already has is not added: kwList)
    if (isKw) { const left = kwList(c.before); keys = kwList(c.after).filter((k) => { const i = left.indexOf(k); if (i < 0) return true; left.splice(i, 1); return false; }).map((k) => (appKw || []).find((x) => nk(x) === k) || k); }
    else { if (nn(c.after).replace(/\+0$/, '') === nn(c.before)) continue; keys = [CHAR_KEY[c.char] || c.char]; }
    for (const key of keys) {
      const names = new Set();
      for (const x of [c.comment, ...c.by].filter(Boolean)) {
        if (abil.has(nn(x))) names.add(abil.get(nn(x)).name);
        else if (named.has(nn(x))) names.add(named.get(nn(x)));
      }
      if (!names.size) {
        const says = (a) => isKw ? flat(a.text).toUpperCase().includes(`[${nk(key)}]`)
          : (CHAR_WORDS[key] || /^$/).test(flat(a.text)) && (c.type !== 'set' || flat(a.text).includes(nn(c.after)) || byWord(a));
        // (a value BSData sets from an option the ability names: the Daemon Prince of Chaos's "Khorne" selection, and Daemonic
        // Allegiance's "If this model has the KHORNE keyword, add 2 to the Strength characteristic")
        const byWord = (a) => c.by.some((b) => b && new RegExp('\\b' + nn(b).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(flat(a.text)));
        let hits = (u.abilities || []).filter(says);
        // (two that say it: the one that names the weapon, Daemonic Allegiance's "add 3 to the Attacks characteristic of this model’s
        // infernal cannon" before Neverblade's "melee weapons")
        const wpn = String(prof.group || prof.pname || '').toLowerCase();
        if (hits.length > 1 && wpn) { const named = hits.filter((a) => flat(a.text).toLowerCase().includes(wpn)); if (named.length === 1) hits = named; }
        if (hits.length === 1) names.add(hits[0].name);
        else if (hits.length > 1) names.add(`(ambiguous: ${hits.map((a) => a.name).join(' / ')})`);
      }
      if (names.size) out.set(key, [...new Set([...(out.get(key) || []), ...names])].sort());
    }
  }
  return out;
}
const fromMap = (from) => new Map(Object.entries(from || {}).map(([k, v]) => [k, [].concat(v).slice().sort()]));
const GRANTS = [];
function compareGrants(army, u, kind, label, app, prof, appKw, fail, where) {
  const want = grantsOf(army, u, prof, appKw);
  const have = fromMap(app.from);
  const idx = (u[kind] || []).indexOf(app);
  for (const [k, v] of want) GRANTS.push({ army: army.id, unit: u.id, kind, idx, row: label, key: k, names: v });
  for (const k of new Set([...want.keys(), ...have.keys()])) {
    checked('grants');
    const a = (have.get(k) || []).join(' + '), b = (want.get(k) || []).join(' + ');
    if (a !== b) fail(`${kind}.from`, `${label}: ${k} ← ${a || '(not marked)'}`, b || '(not changed by a rule)', where);
  }
}

/* ---------------------------------------------------------------------
   Compare one unit
--------------------------------------------------------------------- */
const COUNT = {};
const checked = (k, n = 1) => { COUNT[k] = (COUNT[k] || 0) + n; };
function compareUnit(army, u, F, fail) {
  const rootName = (r) => nn(r.node.name);
  const rootFor = (who) => (who ? F.roots.find((r) => rootName(r) === nn(who)) : null);
  const scoped = (list, who) => { const r = rootFor(who); return r ? list.filter((x) => x.root === r) : list; };

  /* stats */
  const usedStats = new Set();
  for (const row of u.stats || []) {
    const m = nn(row.name).match(/^(.*?)(?:\s+×(\d+))?$/); const name = m[1]; const n = Number(m[2] || 1);
    const cands = F.stats.filter((s) => s.name === name);
    if (!cands.length) { fail('stats', row.name, F.stats.map((s) => s.name).join(' | '), 'no BSData Unit profile with this name'); continue; }
    const diffs = (s) => ['M', 'T', 'Sv', 'W', 'Ld', 'OC', 'InSv', 'base'].filter((k) => row[k] !== undefined || s.ch[keyChar(k)] !== undefined)
      .filter((k) => !(k === 'base' && s.ch.Base === undefined))
      .filter((k) => nv(row[k], k === 'base') !== nv(s.ch[keyChar(k)], k === 'base'));
    const best = cands.slice().sort((a, b) => diffs(a).length - diffs(b).length)[0];
    usedStats.add(best);
    for (const k of ['M', 'T', 'Sv', 'W', 'Ld', 'OC', 'InSv', 'base']) {
      if (k === 'base' && best.ch.Base === undefined) continue;
      checked('stats');
      if (nv(row[k], k === 'base') !== nv(best.ch[keyChar(k)], k === 'base')) fail(`stats.${k}`, `${row.name}: ${row[k]}`, `${best.name}: ${best.ch[keyChar(k)]}`, best.where);
    }
    // a row's "×N" (New Recruit's "(xN)") must be BSData's number of models with the profile. New Recruit leaves the
    // count off some rows ("Jakhal", "Rubric Marine", "Flash Gitz") but not others alike ("Khorne Berzerker (x10)");
    // a row without one states no count, and the models lines (checked against New Recruit) give the numbers
    checked('stats'); if (m[2] !== undefined && n !== best.count) fail('stats.count', row.name, `${best.name} ×${best.count}`, best.where);
    compareGrants(army, u, 'stats', row.name, row, best, null, fail, best.where);
  }
  for (const s of F.stats) if (!usedStats.has(s)) { checked('stats'); fail('stats', '', `${s.name} (${['M', 'T', 'Sv', 'W', 'LD', 'OC', 'InSv'].map((k) => s.ch[k]).join(' ')})`, `${s.where}: Unit profile missing in the app`); }

  /* weapons */
  const usedW = new Set();
  for (const kind of ['ranged', 'melee']) for (const w of u[kind] || []) {
    const appFull = w.group ? `${nn(w.group)} - ${nn(w.name)}` : nn(w.name);
    const label = `${appFull}${w.who ? ' (' + w.who + ')' : ''}`;
    const cands = scoped(F.weapons, w.who).filter((b) => b.kind === kind && b.full === appFull);
    if (w.who && !rootFor(w.who)) fail('weapon.who', label, F.roots.map(rootName).join(' | '), 'who names no unit of this attached unit');
    if (!cands.length) { fail(`${kind}`, label, '', `no BSData ${kind} profile "${appFull}" in ${F.roots.map(rootName).join(' / ')}`); continue; }
    const fields = ['range', 'A', kind === 'ranged' ? 'BS' : 'WS', 'S', 'AP', 'D'];
    const bchar = (b, f) => b.ch[f === 'range' ? 'Range' : f];
    const diff = (b) => fields.filter((f) => nv(w[f]) !== nv(bchar(b, f))).length + (sameSet((w.kw || []).map(nk), b.kw) ? 0 : 1) + (!!w.hunter !== !!b.hunter ? 1 : 0);
    const best = cands.slice().sort((a, b) => diff(a) - diff(b))[0];
    usedW.add(best);
    for (const f of fields) { checked('weapons'); if (nv(w[f]) !== nv(bchar(best, f))) fail(`${kind}.${f}`, `${label}: ${w[f]}`, `${bchar(best, f)}`, best.where); }
    checked('weapons'); if (!sameSet((w.kw || []).map(nk), best.kw)) fail(`${kind}.kw`, `${label}: ${(w.kw || []).map(nk).sort().join(', ')}`, best.kw.slice().sort().join(', '), best.where);
    checked('weapons'); if (!!w.hunter !== !!best.hunter) fail(`${kind}.hunter`, `${label}: ${!!w.hunter}`, best.hunter || 'no Hunter profile', best.where);
    checked('weapons'); if ((w.n || 1) !== best.count) fail(`${kind}.n`, `${label}: ${w.n || 1}`, String(best.count), best.where);
    checked('weapons'); if (!!w.enh !== best.enh) fail(`${kind}.enh`, `${label}: ${!!w.enh}`, best.enh ? 'the enhancement\'s weapon' : 'not from an enhancement', best.where);
    compareGrants(army, u, kind, label, w, best, w.kw, fail, best.where);
  }
  for (const b of F.weapons) if (!usedW.has(b)) { checked('weapons'); fail(b.kind, '', `${b.full} (${rootName(b.root)})`, `${b.where}: carried per BSData, missing in the app`); }

  /* abilities
     - a profile of another type than Abilities (Transport, Crimson King, ...) may carry the
       type's name in the app: the Chaos Rhino's "Transport" profile is app ability "Transport";
     - BSData's "Leader" or "Support" ability (the units it can be attached to) is the app's
       rule of that name;
       the unit named in `leads` must be one of the units that text names;
     - an app ability marked `na` (not usable with this loadout) is looked up in the whole
       datasheet, including wargear this list did not take. */
  const usedA = new Set();
  const names = (b) => [b.name, ...(b.typeName !== 'Abilities' ? [nn(b.typeName)] : [])];
  for (const a of u.abilities || []) {
    const appTags = (a.tag ? nn(a.tag).split(/\s*[·,]\s*/) : []).map((t) => t.toLowerCase());
    const whoRoot = rootFor(a.who);
    let pool = whoRoot ? F.abilities.filter((b) => b.root === whoRoot) : F.abilities;
    // (a who that names a group of abilities to pick one from: BSData's profile type of that name, "Wrathful Presence", else, where BSData
    // gives the group no type of its own, the unit's abilities: Fulgrim's "Daemon Primarch of Slaanesh: pick one")
    if (a.who && !whoRoot) { const typed = pool.filter((b) => nn(a.who).startsWith(nn(b.typeName))); pool = typed.length || !/: pick one$/.test(a.who) ? typed : pool; }
    const isEnh = /(^|, | · )Enhancement(, | · |$)/.test(a.tag || '');
    if (isEnh) pool = pool.filter((b) => b.enh);
    const spelt = isEnh || /(^|, | · )Upgrade(, | · |$)/.test(a.tag || '') ? enhSpelling(army, a.name) : null;
    const nameOk = (b) => names(b).some((x) => x === nn(a.name) || splitAbilityName(x).base === nn(a.name) || (spelt && (x === nn(spelt) || splitAbilityName(x).base === nn(spelt))));
    let cands = pool.filter(nameOk);
    if (!cands.length && a.na) cands = F.roots.flatMap((r) => datasheetAbilities(r)).filter(nameOk);
    // (a name that is only BSData's profile type of several abilities, "Triarch Abilities", is none of them: the app's ability of that
    // name is the one BSData words alike under another name, Voice of the Triarch, its name reported as BSData's other ability)
    let renamed = null;
    if (cands.length > 1 && cands.every((b) => b.name !== nn(a.name) && splitAbilityName(b.name).base !== nn(a.name))) {
      const words = (t) => new Set(nt(t).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean));
      const alike = (x, y) => { const A = words(x), B = words(y); let k = 0; for (const w of A) if (B.has(w)) k++; return k / Math.max(1, new Set([...A, ...B]).size); };
      const w = pool.filter((b) => !cands.includes(b) && b.typeName === 'Abilities' && alike(b.text, a.text) >= 0.8)[0];
      if (w) { cands = [w]; renamed = w; }
    }
    checked('abilities');
    // (an enhancement BSData gives only as the weapon it gives, Da Gobshot Thunderbuss: no ability profile; its weapon is checked with
    // the weapons, its words against the detachment by verify/texts.js)
    if (!cands.length && isEnh && F.weapons.some((w) => w.enh && (!whoRoot || w.root === whoRoot) && nn(w.where).includes(nn(spelt || a.name)))) continue;
    if (!cands.length) { fail('ability', a.name, '', `no BSData ability "${a.name}"${a.who ? ' for ' + a.who : ''}${isEnh ? ' (enhancement)' : ''}${a.na ? ' (looked in the whole datasheet)' : ''}`); continue; }
    const best = cands.find((b) => nt(b.text) === nt(a.text)) || cands[0];
    usedA.add(best);
    if (renamed) { checked('abilities'); fail('ability', '', renamed.name, `${renamed.where}: BSData's name of the app's ${a.name}`); }
    const bname = names(best).find((x) => x === nn(a.name)) || best.name;
    if (bname !== nn(a.name)) {
      checked('abilities');
      const missing = splitAbilityName(bname).tags.filter((t) => !appTags.includes(t.toLowerCase()));
      if (missing.length) fail('ability.tag', `${a.name}: ${a.tag || ''}`, best.name, best.where);
    }
    checked('abilities');
    if (nt(best.text) !== nt(a.text)) fail('ability.text', `${a.name}: ${a.text}`, best.text, best.where);
  }
  for (const b of F.abilities) {
    if (usedA.has(b)) continue;
    checked('abilities');
    if ((b.name === 'Leader' || b.name === 'Support') && b.typeName === 'Abilities') {
      if (!(u.rules || []).map(nn).includes(b.name)) fail('rules', '', b.name, `${b.where}: the ${b.name} ability, app rule "${b.name}" missing`);
      // each character's Leader/Support ability names the bodyguard
      if (u.leads && F.roots.indexOf(b.root) >= 0 && F.roots.indexOf(b.root) < F.roots.length - 1 && !nt(b.text).includes(nt(u.leads))) fail('leads', u.leads, b.text, b.where);
      continue;
    }
    fail('ability', '', b.name, `${b.where}: missing in the app`);
  }
  /* role: the primary category of the (leader's) datasheet */
  checked('keywords');
  const prim = F.roots[0].primary && SRC.get(F.roots[0].primary);
  // (a reference sheet is listed under Reference, as New Recruit lists its reference entries)
  if (nn(u.role) !== nn(prim && prim.name) && !(u.ref && u.role === 'Reference')) fail('role', u.role, prim ? prim.name : '', `${F.roots[0].where()}: primary category`);
  /* keywords */
  const appKw = new Set((u.kw || []).map(nn));
  for (const k of appKw) { checked('keywords'); if (!F.cats.has(k)) fail('kw', k, '', `not a category of ${F.roots.map(rootName).join(' / ')}`); }
  for (const k of F.cats) if (!appKw.has(k)) { checked('keywords'); fail('kw', '', k, `${F.catWhere[k]}: category missing in the app`); }

  /* rules */
  const selfApplying = (a) => {
    if (a.na) return false;
    const fromMods = (u.mods || []).some((m) => nn(m.from) === nn(a.name));
    const aur = (u.aura || []).filter((m) => nn(m.from) === nn(a.name));
    if (fromMods) return true;
    // an ability GW tags (Bondsman): it affects another model, the ARMIGER the Bondsman rule selects, never its own (Bondsman: "select
    // one friendly ARMIGER model … that ARMIGER model is affected by that Bondsman ability"); not an aura, GW tags it no (Aura)
    if ((a.tag || '').split(' · ').includes('Bondsman')) return false;
    // an aura whose keywords leave out the unit itself
    const hasK = (k) => (u.kw || []).some((x) => nn(x).toLowerCase() === nn(k).toLowerCase());
    const fits = (n) => !n || ((!n.all || n.all.every(hasK)) && (!n.any || n.any.some(hasK)) && (!n.none || !n.none.some(hasK)));
    if (aur.length && aur.every((m) => m.notSelf || !fits(m.needs))) return false;
    return true;
  };
  const appAbilityByName = (name) => (u.abilities || []).find((a) => nn(a.name) === splitAbilityName(name).base || nn(a.name) === nn(name));
  const unitRules = new Map(); const weaponRules = new Set(); const groupRules = new Map();
  for (const r of F.rules) {
    if (r.infoGroup) { const g = groupRules.get(r.infoGroup) || []; g.push(r); groupRules.set(r.infoGroup, g); }
    else if (r.weapon) weaponRules.add(r.name);
    else if (!unitRules.has(r.name)) unitRules.set(r.name, r);
  }
  const weaponKw = new Set(F.weapons.flatMap((w) => w.kw.map(kwBase)));
  const usableAbilities = F.abilities.filter((b) => { const a = appAbilityByName(b.name); return !a || selfApplying(a); });
  const allowed = (rn) => {
    const n = nn(rn);
    if (unitRules.has(n)) return 'a rule of the unit';
    if (weaponKw.has(kwBase(n)) || weaponKw.has(nk(n)) || weaponRules.has(n)) return 'a keyword of its weapons';
    for (const [g, list] of groupRules) {
      if (!list.some((r) => r.name === n)) continue;
      const a = appAbilityByName(g); const gb = splitAbilityName(g);
      if (gb.tags.some((t) => nn(t) === n) || gb.base === n) return 'named by its ability ' + g;
      if (a && selfApplying(a)) return 'linked by its ability ' + g;
    }
    const re = new RegExp(`(^|[^a-z])${nt(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`);
    for (const b of usableAbilities) if (re.test(nt(b.text)) || splitAbilityName(b.name).tags.some((t) => nn(t) === n)) return 'named in its ability ' + b.name;
    return null;
  };
  const appRules = (u.rules || []).map(nn);
  for (const r of appRules) { checked('rules'); if (!allowed(r)) fail('rules', r, [...unitRules.keys()].join(', '), 'neither a BSData rule of the unit, nor a keyword of its weapons, nor named in an ability it uses'); }
  const required = [...unitRules.keys()];
  for (const [g, list] of groupRules) { const a = appAbilityByName(g); const gb = splitAbilityName(g); for (const r of list) if ((a && selfApplying(a)) || gb.tags.some((t) => nn(t) === r.name)) required.push(r.name); }
  for (const r of new Set(required)) if (!appRules.includes(r)) { checked('rules'); fail('rules', '', r, `${(unitRules.get(r) || (F.rules.find((x) => x.name === r)) || {}).where}: rule missing in the app`); }
}

/* ---------------------------------------------------------------------
   Points: each copy's pts = leader + bodyguard + upgrades + enhancements, with the
   escalation for the k-th unit of a datasheet; copies of one datasheet may come in any
   order, so the check looks for an order that makes every copy match.
--------------------------------------------------------------------- */
function unitCost(roots) { let t = 0; for (const r of roots) for (const s of r.desc(true)) t += costOf(s); return t; }
function comparePoints(army, built0, failArmy) {
  // (a reference sheet, ref: a unit a rule of the list adds later, not in the army: no points, and no place in the datasheet's escalation)
  for (const b of built0.filter((x) => x.u.ref)) { checked('points'); if (b.u.pts !== 0) failArmy(b.u.id, 'pts', String(b.u.pts), '0', 'a reference sheet has no points'); }
  const built = built0.filter((x) => !x.u.ref);
  const pools = new Map();               // datasheet entry id → roots in roster order
  for (const b of built) for (const c of b.copies) for (const r of c.roots) { const k = r.node.id; if (!pools.has(k)) pools.set(k, []); pools.get(k).push(r); }
  const slots = []; for (const b of built) b.copies.forEach((c, i) => slots.push({ b, c, i }));
  const costWith = (slot, ks) => { slot.c.roots.forEach((r, j) => CTX.beforeK.set(r, ks[j])); const v = unitCost(slot.c.roots); slot.c.roots.forEach((r) => CTX.beforeK.delete(r)); return v; };
  const used = new Map([...pools.keys()].map((k) => [k, new Set()]));
  let best = null;
  const choose = (i, acc) => {
    if (best && best.ok === slots.length) return;
    if (i === slots.length) { const ok = acc.filter((a) => a.ok).length; if (!best || ok > best.ok) best = { ok, acc: acc.slice() }; return; }
    const s = slots[i]; const keys = s.c.roots.map((r) => r.node.id);
    const opts = (j) => (j === keys.length ? [[]] : [...Array(pools.get(keys[j]).length).keys()].filter((k) => !used.get(keys[j]).has(k)).flatMap((k) => opts(j + 1).map((rest) => [k, ...rest])));
    const all = opts(0);
    const scored = all.map((ks) => ({ ks, v: costWith(s, ks) })).sort((a, b) => (b.v === s.b.u.pts) - (a.v === s.b.u.pts));
    for (const { ks, v } of scored.slice(0, 6)) {
      ks.forEach((k, j) => used.get(keys[j]).add(k));
      acc.push({ s, v, ok: v === s.b.u.pts, ks }); choose(i + 1, acc); acc.pop();
      ks.forEach((k, j) => used.get(keys[j]).delete(k));
      if (best && best.ok === slots.length) return;
    }
  };
  choose(0, []);
  for (const a of best ? best.acc : []) {
    const u = a.s.b.u;
    const part = a.s.c.roots.map((r, j) => { CTX.beforeK.set(r, a.ks[j]); const v = r.desc(true).reduce((t, s) => t + costOf(s), 0); CTX.beforeK.delete(r); return { r, v, k: a.ks[j] }; });
    const parts = part.map((p) => `${p.r.node.name} ${p.v}${p.k ? ` (as unit ${p.k + 1} of the datasheet)` : ''}`).join(' + ');
    checked('points');
    if (!a.ok) failArmy(u.id, 'pts', `${u.pts}${(u.copies || 1) > 1 ? ` (copy ${a.s.i + 1} of ${u.copies})` : ''}`, String(a.v), parts);
    // ptsNote "165 + Meganobz 190": the leader (with its enhancement), any other character, and the unit it leads
    if (u.ptsNote && a.s.i === 0) {
      checked('points');
      const want = part.length >= 2 ? `${part[0].v}` + part.slice(1).map((p) => ` + ${nn(p.r.node.name)} ${p.v}`).join('') : null;
      if (!want || nn(u.ptsNote) !== want) failArmy(u.id, 'ptsNote', u.ptsNote, want || `${part.map((p) => p.v).join(' + ')}`, parts);
    }
  }
}

/* ---------------------------------------------------------------------
   Main
--------------------------------------------------------------------- */
let DATA = null;
// declared deviations of the kind "relink" (verify/deviations-bsdata.json): an entry link whose target BSData at the pin is not GW's,
// where the newer catalogue New Recruit's export was made from links it to GW's (the Heavy Intercessor w/Heavy Bolter's melee weapon:
// the pin links "Close combat weapon", the export and GW's datasheet have Ceramite Fists). The rosters are built with the declared
// target; the extract keeps the pin's (restoreRelinks)
const RELINKS = [];
function applyRelinks() {
  const devs = fs.existsSync(P.dev) ? JSON.parse(fs.readFileSync(P.dev, 'utf8')) : [];
  for (const d of (Array.isArray(devs) ? devs : devs.deviations || []).filter((x) => x.field === 'relink')) {
    const o = SRC.byId.get(d.link), ok = !!(o && o.targetId === d.from && SRC.byId.get(d.to));
    RELINKS.push({ d, o, ok });
    if (ok) o.targetId = d.to;
  }
}
function restoreRelinks() { for (const r of RELINKS) if (r.ok) r.o.targetId = r.d.from; }
// data.js, the name mapping and the BSData source (the clone, else the pinned extract)
function setup() {
  global.window = {}; require(P.data); DATA = global.window.WH_DATA;
  const MAP = JSON.parse(fs.readFileSync(P.map, 'utf8'));
  // the catalogue of each faction: sources/factions.json (map-bsdata.json may still name one)
  for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(path.join(HERE, 'sources', 'factions.json'), 'utf8')))) if (k[0] !== '_' && v.bsdata) MAP.catalogues[k] = MAP.catalogues[k] || v.bsdata;
  // (and the catalogues map-bsdata.json takes a unit's part from: the Deathwatch's)
  const catalogueNames = [...new Set(DATA.armies.map((a) => MAP.catalogues[a.faction]).concat(Object.values(MAP.units || {}).flatMap((u) => Object.values(u.catalogue || {}))))];
  const haveClone = fs.existsSync(path.join(P.bsdata, 'Warhammer 40,000.json'));
  const useExtract = flag('--extract') || !haveClone;
  if (flag('--write-extract') && useExtract) { console.error('--write-extract needs the BSData clone (sh verify/fetch.sh)'); process.exit(2); }
  SRC = useExtract ? loadExtract(P.extract) : loadFull(P.bsdata, catalogueNames);
  applyRelinks();
  return MAP;
}
// every army's roster as this check builds it (for verify/import-ids.js): the selections of each unit, evaluated
function rosters() {
  const MAP = setup(); const out = [];
  for (const army of DATA.armies) {
    const issues = []; const R = buildRoster(army, MAP, issues);
    if (R) { const all = R.roster.desc(false).filter((s) => s.node); for (const s of all) applyOwnCats(s); for (const s of all) s.hidden = selHidden(s); }
    out.push({ army, R, issues });
  }
  return { DATA, SRC, MAP, out, kids, costOf, rootNode, rootLinksOf, searchBelow, node };
}
function main() {
  const MAP = setup();
  const failures = []; const pin = pinnedCommit();
  const push = (army, f) => failures.push({ army, unit: f.unit, field: f.field, app: str(f.app), source: str(f.source), where: f.where });
  if (pin && !(SRC.commit || '').startsWith(pin)) push('(all)', { unit: '(source)', field: 'bsdata.commit', app: pin, source: SRC.commit || 'unknown', where: `${SRC.mode}: BSData commit differs from the pin in verify/fetch.sh` });

  const explain = opt('--explain', null);
  for (const army of DATA.armies) {
    const issues = [];
    const R = buildRoster(army, MAP, issues);
    for (const f of issues) push(army.id, f);
    if (!R) continue;
    // evaluate the roster: hidden flags, profiles/rules, cross-selection modifiers
    const allSels = R.roster.desc(false).filter((s) => s.node);
    for (const s of allSels) applyOwnCats(s);
    for (const s of allSels) s.hidden = selHidden(s);
    for (const s of allSels) collectInfo(s);
    for (const s of allSels) applyAcross(s);
    for (const { u, copies } of R.built) {
      const c0 = copies[0]; if (!c0.roots.length) continue;
      const fail = (field, app, source, where) => push(army.id, { unit: u.id, field, app, source, where });
      for (const r of c0.roots) for (const s of r.desc(true)) if (s.hidden) { checked('gear'); fail('hidden', s.node.name, 'hidden', `${s.where()}: BSData hides this selection for this list (detachment or unit not eligible)`); }
      checked('gear', (u.models || []).length + (u.gear || []).flat().length);
      requiredCheck(c0.roots, fail);
      const F = unitFacts(c0.roots);
      if (explain === u.id) explainUnit(u, F);
      compareUnit(army, u, F, fail);
    }
    comparePoints(army, R.built, (unit, field, app, source, where) => push(army.id, { unit, field, app, source, where }));
  }
  for (const w of CTX.warnings) failures.push({ army: '(all)', unit: '(engine)', field: 'engine', app: '', source: w, where: 'a BSData construct this check does not evaluate' });

  // deviations: the only accepted differences
  const devs = fs.existsSync(P.dev) ? JSON.parse(fs.readFileSync(P.dev, 'utf8')) : [];
  // (a detachment's Force Dispositions are verify/dispositions.js's: its deviations are checked there)
  const devList = (Array.isArray(devs) ? devs : devs.deviations || []).filter((d) => d.field !== 'dispositions' && d.field !== 'relink');
  for (const r of RELINKS) if (!r.ok) failures.push({ army: r.d.army, unit: r.d.unit, field: 'deviation.stale', app: r.d.to, source: r.d.from, where: `verify/deviations-bsdata.json: the relink of ${r.d.link} does not match BSData (its target is not ${r.d.from}, or ${r.d.to} is not there)` });
  const keyOf = (x) => JSON.stringify([x.army, x.unit, x.field, str(x.app), str(x.source)]);
  const devKeys = new Map(devList.map((d) => [keyOf(d), d]));
  const usedDev = new Set(); const remaining = [];
  for (const f of failures) { const k = keyOf(f); if (devKeys.has(k)) usedDev.add(k); else remaining.push(f); }
  for (const d of devList) if (!usedDev.has(keyOf(d))) remaining.push({ army: d.army, unit: d.unit, field: 'deviation.stale', app: str(d.app), source: str(d.source), where: `verify/deviations-bsdata.json: nothing matches this deviation (${d.field})` });

  restoreRelinks();
  if (flag('--write-extract')) {
    const x = buildExtract(SRC); fs.mkdirSync(path.dirname(P.extract), { recursive: true });
    fs.writeFileSync(P.extract, JSON.stringify(x, null, 1) + '\n');
    console.log(`wrote ${path.relative(REPO, P.extract)} (${Object.values(x.files).reduce((a, f) => a + TOP_ARRAYS.reduce((b, k) => b + (f[k] || []).length, 0), 0)} entries, commit ${x.commit})`);
  } else if (SRC.mode === 'clone' && fs.existsSync(P.extract)) {
    const now = JSON.stringify(buildExtract(SRC)); const was = JSON.stringify(JSON.parse(fs.readFileSync(P.extract, 'utf8')));
    checked('extract');
    if (now !== was) remaining.push({ army: '(all)', unit: '(source)', field: 'bsdata.extract', app: 'verify/sources/bsdata-extract.json', source: 'differs from what this check reads in the clone', where: 'run: node verify/bsdata.js --write-extract' });
  }

  const out = { check: 'bsdata', source: { mode: SRC.mode, commit: SRC.commit, pin }, checked: COUNT, failures: remaining, deviations: usedDev.size, grants: GRANTS };
  fs.mkdirSync(path.dirname(P.out), { recursive: true });
  fs.writeFileSync(P.out, JSON.stringify(out, null, 1) + '\n');
  const total = Object.values(COUNT).reduce((a, b) => a + b, 0);
  console.log(`bsdata: ${total} facts checked against BSData ${String(SRC.commit).slice(0, 7)} (${SRC.mode}) ${JSON.stringify(COUNT)}; ${usedDev.size} deviations used; ${remaining.length} failures`);
  for (const f of remaining) console.log(`  FAIL ${f.army} / ${f.unit} / ${f.field}: app ${JSON.stringify(f.app)} vs BSData ${JSON.stringify(f.source)}  [${f.where}]`);
  process.exit(remaining.length ? 1 : 0);
}
function explainUnit(u, F) {
  console.log(`--- ${u.id}: BSData as evaluated for this list`);
  for (const r of F.roots) for (const s of r.desc(true)) console.log(`  ${'  '.repeat(s.ancestors().length - 2)}${s.count}× ${s.node.name} [${s.node.type}]${s.hidden ? ' HIDDEN' : ''}${s.isEnhancement ? ' (enhancement)' : ''} pts ${costOf(s)}`);
  for (const s of F.stats) console.log(`  stats ${s.name} ×${s.count}: ${JSON.stringify(s.ch)}`);
  for (const w of F.weapons) console.log(`  ${w.kind} ${w.full}${w.hunter ? ' [' + w.hunter + ']' : ''} ×${w.count} (${w.root.node.name}): ${['Range', 'A', 'BS', 'WS', 'S', 'AP', 'D'].map((k) => w.ch[k]).filter((x) => x != null).join(' ')} | ${w.kw.join(', ')}`);
  for (const a of F.abilities) console.log(`  ability ${a.name} [${a.typeName}${a.infoGroup ? ', group ' + a.infoGroup : ''}] (${a.root.node.name})`);
  console.log(`  rules ${F.rules.map((r) => r.name + (r.weapon ? '(w)' : '') + (r.infoGroup ? '(g)' : '')).join(', ')}`);
  console.log(`  categories ${[...F.cats].join(', ')}`);
}
if (require.main === module) main();
module.exports = { rosters, nn };
