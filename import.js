/* import.js: a list from New Recruit's JSON export (a BattleScribe roster), made only of what data.js already has.
   The app (app.html) and the gate (verify/import-test.js) run this same file.

   Every selection of the export names its BSData entry (the last id of its entryId). data.js's BS_IDS table
   (written from BSData by verify/import-ids.js, checked by the gate) holds the ids of everything the app's lists
   have: factions, detachments, Force Dispositions, battle sizes, and each unit of each list as a signature of
   its parts (leader, other characters, bodyguard) with every models line, wargear option, enhancement and the
   Warlord. The export resolves only when
     - its faction, battle size, detachments and disposition are ones data.js has (the disposition one its
       detachments allow), and every other top-level selection is a known one (Show/Hide Options, references);
     - every unit, with the characters attached to it (New Recruit's Leading/Supporting), has exactly the
       signature of a unit of a list in data.js with the same faction, detachments and config (a rule of the
       list can change a unit's values, so a unit is only taken from a list with the same ones), with the same
       BSData names and the same points;
   and then the list is those units, copied as data.js has them. Otherwise nothing is imported and every item
   that does not resolve is listed. No partial import, no guessing, no fuzzy matching.

   WH_IMPORT.resolve(json or text, WH_DATA, { id, date }) → { ok:true, army } | { ok:false, errors:[...] }
   WH_IMPORT.slim(json): only what resolve reads (to keep on the phone)
   WH_IMPORT.signature(rootId, kids): one part's signature (verify/import-ids.js writes the table with it) */
(function(root){
'use strict';

const nn = s => String(s == null ? '' : s).normalize('NFC')
  .replace(/[’‘ʼ′]/g, "'").replace(/[“”″]/g, '"').replace(/[‐‑‒–—−]/g, '-').replace(/…/g, '...')
  .replace(/\s+/g, ' ').trim();
const typo = s => String(s).replace(/'/g, '’');   // the app's apostrophes, as verify/import-nr.js writes them
const lastId = e => String(e || '').split('::').pop();
const pts = costs => (costs || []).filter(c => c.name === 'pts').reduce((t, c) => t + (Number(c.value) || 0), 0);
const clone = o => JSON.parse(JSON.stringify(o));
const and = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

// one part's signature: every selection below it as a path of entry ids from the part, with its count (every models line,
// wargear item and option, a bundle of weapons too; the same path twice adds up). An option that holds models ("8 chainblades":
// New Recruit counts it once, BSData's roster once per model) counts once per selection: its models carry the count, and resolve
// refuses such an option taken more than once
function signature(rootId, kids){
  const m = new Map();
  const walk = (s, p) => {
    const k = (p ? p + '/' : '') + s.id;
    m.set(k, (m.get(k) || 0) + (!s.model && s.kids.some(c => c.model) ? 1 : s.n));
    for(const c of s.kids) walk(c, k);
  };
  for(const c of kids) walk(c, '');
  return rootId + '|' + [...m].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0).map(([k, v]) => v + '×' + k).join(',');
}
const conv = s => ({ id:lastId(s.entryId), n:Number(s.number) || 0, model:s.type === 'model', kids:(s.selections || []).map(conv) });
const sigOf = s => signature(lastId(s.entryId), (s.selections || []).map(conv));
const entries = sig => sig.slice(sig.indexOf('|') + 1).split(',').filter(Boolean);

// what resolve and builder.js read, so a kept list is small (its profiles' values, categories and rule names: builder.js's)
function slim(j){
  const sel = s => {
    const o = { id:s.id, name:s.name, entryId:s.entryId, number:s.number, type:s.type };
    if(s.group) o.group = s.group;
    if((s.categories || []).length) o.categories = s.categories.map(x => Object.assign({ name:x.name }, x.primary ? { primary:true } : {}));
    if((s.profiles || []).length) o.profiles = s.profiles.map(x => ({ name:x.name, typeName:x.typeName, characteristics:(x.characteristics || []).map(c => c.$text == null || !String(c.$text).trim() ? { name:c.name } : { name:c.name, $text:String(c.$text) }) }));
    if((s.rules || []).length) o.rules = s.rules.map(x => ({ name:x.name }));
    const c = (s.costs || []).filter(x => x.name === 'pts'); if(c.length) o.costs = c.map(x => ({ name:'pts', value:x.value }));
    const a = (s.associations || []).filter(x => x.type === 'outgoing').map(x => Object.assign({ type:x.type, to:x.to, name:x.name }, x.action ? { action:x.action } : {})); if(a.length) o.associations = a;
    if((s.selections || []).length) o.selections = s.selections.map(sel);
    return o;
  };
  const r = (j && j.roster) || {};
  return { roster:{ name:r.name, generatedBy:r.generatedBy, costs:(r.costs || []).filter(x => x.name === 'pts'), costLimits:(r.costLimits || []).filter(x => x.name === 'pts'),
    forces:(r.forces || []).map(f => ({ name:f.name, catalogueId:f.catalogueId, catalogueName:f.catalogueName, selections:(f.selections || []).map(sel), forces:f.forces })) } };
}

// the shape resolve reads, checked first: a malformed export is refused, never half read
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const optArr = v => v === undefined || Array.isArray(v);
function malformed(j){
  if(!isObj(j) || !isObj(j.roster) || !Array.isArray(j.roster.forces)) return 'no roster';
  const R = j.roster;
  if(!optArr(R.costs) || !optArr(R.costLimits) || ![...(R.costs || []), ...(R.costLimits || [])].every(isObj)) return 'its points are malformed';
  if(R.forces.length !== 1 || !isObj(R.forces[0])) return null;   // (refused with its own message)
  const F = R.forces[0];
  if(!Array.isArray(F.selections)) return 'the force has no selections';
  let bad = null;
  const sel = (s, d) => {
    if(bad) return;
    if(!isObj(s) || typeof s.entryId !== 'string' || typeof s.name !== 'string' || typeof s.type !== 'string' || !Number.isInteger(s.number) || s.number < 0 ||
      !optArr(s.selections) || !optArr(s.costs) || !optArr(s.associations) || !(s.costs || []).every(isObj) || !(s.associations || []).every(isObj) || d > 12){ bad = 'a selection is malformed'; return; }
    for(const c of s.selections || []) sel(c, d + 1);
  };
  for(const s of F.selections) sel(s, 0);
  return bad;
}
function resolve(input, D, opt){
  let j = input;
  if(typeof j === 'string'){ try { j = JSON.parse(j); } catch(e){ return { ok:false, errors:['not a New Recruit JSON export (the text is not JSON)'] }; } }
  const bad = malformed(j);
  if(bad) return { ok:false, errors:['not a New Recruit JSON export (' + bad + ')'] };
  try { return resolveRoster(j, D, opt || {}); }
  catch(e){ return { ok:false, errors:['not a New Recruit JSON export (it could not be read)'] }; }
}
function resolveRoster(j, D, opt){
  const errors = [], err = m => { if(!errors.includes(m)) errors.push(m); };
  const fail = () => ({ ok:false, errors });
  if(!D.bsIds){ err('this version of the app cannot import lists'); return fail(); }
  // the tables without a prototype: an export's id such as "constructor" or "toString" is no key of them
  const T = {}; for(const k of Object.keys(D.bsIds)) T[k] = Object.assign(Object.create(null), D.bsIds[k]);
  const R = j.roster;
  if(R.forces.length !== 1 || (R.forces[0].forces || []).length){ err('a list with ' + R.forces.length + ' forces not recognized (the app takes one Army Roster)'); return fail(); }
  const F = R.forces[0];
  const sels = F.selections || [];
  const fac = T.factions[F.catalogueId];
  const top = sels.filter(s => s.type === 'upgrade'), roots = sels.filter(s => s.type !== 'upgrade');
  if(!fac){
    // nothing of an unknown faction can resolve: name it, and what adding it would take
    err('faction ' + String(F.catalogueName || F.catalogueId || '?').split(' - ').pop() + ' not recognized');
    for(const t of top) for(const c of t.selections || []) if(t.name === 'Detachment' || c.group === 'Detachment') err('detachment ' + nn(c.name) + ' not recognized');
    for(const s of roots) err('unit ' + nn(s.name) + ' not recognized');
    return fail();
  }
  const FAC = D.factions[fac];

  /* the list: one battle size, one detachment selection, one Force Disposition, config; every top-level selection is one of
     these or holds no list content (Show/Hide Options and rules references, whose own choices must be known ones too) */
  let battleSize = null, disposition = null; const dets = [], config = {}, seen = {};
  const KIND = { battleSize:'battle size', disposition:'disposition', detachment:'detachment' };
  for(const t of top){
    const id = lastId(t.entryId), kids = t.selections || [];
    if(Number(t.number) !== 1){ err('selection ' + t.number + '× ' + nn(t.name) + ' not recognized'); continue; }
    if(T.info[id]){
      for(const c of kids) if(!T.infoKids[lastId(c.entryId)] || (c.selections || []).length || Number(c.number) !== 1) err('selection ' + nn(c.name) + ' in ' + nn(t.name) + ' not recognized');
      continue;
    }
    if(T.config[id]){
      const key = T.config[id];
      if(key in config){ err('selection ' + nn(t.name) + ' twice not recognized'); continue; }
      const odd = kids.filter(c => T.configKids[lastId(c.entryId)] !== nn(c.name) || (c.selections || []).length || Number(c.number) !== 1);
      for(const c of odd) err('selection ' + nn(c.name) + ' in ' + nn(t.name) + ' not recognized');
      if(!odd.length && kids.length) config[key] = kids.map(c => typo(nn(c.name))).join(', ');
      continue;
    }
    const kind = T.roots[id];
    if(!kind){ err('selection ' + nn(t.name) + ' not recognized'); continue; }
    if(seen[kind]){ err(KIND[kind] + ' selection ' + nn(t.name) + ' twice not recognized'); continue; }
    seen[kind] = true;
    for(const c of kids){
      const cid = lastId(c.entryId), nm = nn(c.name);
      const once = Number(c.number) === 1 && !(c.selections || []).length;
      if(kind === 'battleSize' && T.battleSizes[cid] && once){ if(battleSize) err('battle size ' + nm + ' not recognized (a list has one battle size)'); else battleSize = T.battleSizes[cid]; continue; }
      if(kind === 'disposition' && T.dispositions[cid] === nm && once){ if(disposition) err('disposition ' + nm + ' not recognized (a list has one Force Disposition)'); else disposition = nm; continue; }
      const d = kind === 'detachment' && T.detachments[cid], dk = d && d.split('/');
      if(d && once && dk[0] === fac && FAC.detachments[dk[1]] && nn(FAC.detachments[dk[1]].name) === nm){ if(dets.includes(dk[1])) err('detachment ' + nm + ' twice not recognized'); else dets.push(dk[1]); continue; }
      err(KIND[kind] + ' ' + (Number(c.number) !== 1 ? c.number + '× ' : '') + nm + ' not recognized');
    }
  }
  if(!battleSize && !errors.some(e => /^battle size/.test(e))) err('battle size not recognized (the export names none)');
  if(!dets.length && !errors.some(e => /^detachment/.test(e))) err('detachment not recognized (the export names none)');
  // the points limit is the battle size's (BSData), not the export's word for it (an export can name none: no costLimits)
  const limit = pts(R.costLimits), total = pts(R.costs);
  if(battleSize && (R.costLimits || []).length && limit !== T.limits[battleSize]) err('points limit ' + limit + ' not recognized: ' + battleSize + ' is ' + T.limits[battleSize] + ' pts');
  if(battleSize && total > T.limits[battleSize]) err('points total ' + total + ' not recognized: over the ' + battleSize + ' limit of ' + T.limits[battleSize] + ' pts');
  if(disposition && dets.length){
    const allowed = new Set(dets.flatMap(k => FAC.detachments[k].dispositions || []));
    if(!allowed.has(disposition)) err('disposition ' + disposition + ' not recognized for ' + and(dets.map(k => FAC.detachments[k].name)));
  }
  if(!disposition && !errors.some(e => /^disposition/.test(e))) err('disposition not recognized (the export names none)');

  /* units: each bodyguard with the characters attached to it (New Recruit's Leading / Supporting) */
  const byId = new Map(roots.map(s => [s.id, s]));
  const leadsTo = new Map();
  for(const s of roots) for(const a of s.associations || []) if(a.type === 'outgoing' && a.action === 'group'){
    if(!byId.has(a.to)){ err('leader attachment of ' + nn(s.name) + ' not recognized (what it ' + (a.name === 'Supporting' ? 'supports' : 'leads') + ' is not a unit of the list)'); continue; }
    if(leadsTo.has(s)){ err('leader attachment of ' + nn(s.name) + ' to two units not recognized'); continue; }
    leadsTo.set(s, byId.get(a.to));
  }
  const groups = [], groupOf = new Map();
  for(const s of roots){
    if(leadsTo.has(s)) continue;
    const g = { parts:[s], body:s }; groups.push(g); groupOf.set(s, g);
  }
  for(const [s, b] of leadsTo){ const g = groupOf.get(b); if(!g || leadsTo.has(b)){ err('leader attachment of ' + nn(s.name) + ' to ' + nn(b.name) + ' not recognized'); continue; } g.parts.unshift(s); }
  for(const g of groups) g.at = Math.min(...g.parts.map(p => roots.indexOf(p)));
  groups.sort((a, b) => a.at - b.at);

  // the lists of this faction; a unit is taken only from one with the same detachments, config and battle size
  const ctxKey = (d, c, b) => d.slice().sort().join('+') + '|' + JSON.stringify(Object.keys(c).sort().map(k => [k, c[k]])) + '|' + b;
  const mine = ctxKey(dets, config, battleSize);
  const facArmies = D.armies.filter(a => a.faction === fac && !a.imported && T.units[a.id + '/' + (a.units[0] || {}).id]);
  const pool = facArmies.filter(a => ctxKey(a.detachments, a.config || {}, a.battleSize) === mine);
  // (a list's units and its reference sheets: the app moves these to a.refs at start, verify/ and an export's entry see both)
  const allOf = a => a.units.concat(a.refs || []);
  const instances = facArmies.flatMap(a => allOf(a).map(u => ({ a, u, sigs:(T.units[a.id + '/' + u.id] || []).slice().sort() })));
  const partSigs = instances.flatMap(x => x.sigs);
  if(!errors.length && !pool.length) err('detachment' + (dets.length > 1 ? 's ' : ' ') + and(dets.map(k => FAC.detachments[k].name)) + (Object.keys(config).length ? ' with ' + Object.entries(config).map(([k, v]) => k + ' ' + v).join(', ') : '') +
    ' not recognized: the app’s ' + FAC.name + ' lists have ' + and([...new Set(facArmies.map(a => a.detachments.map(k => FAC.detachments[k].name).join(' + ') + (a.config ? ' (' + Object.entries(a.config).map(([k, v]) => k + ' ' + v).join(', ') + ')' : '')))]));

  const label = g => g.parts.map(p => nn(p.name)).join(' + ');
  const costOf = s => pts(s.costs) + (s.selections || []).reduce((t, c) => t + costOf(c), 0);
  // the names an export's selections carry must be BSData's (an entry renamed in the export is not that entry)
  const namesOk = (s, unit) => {
    let ok = true;
    const walk = (x, isRoot) => {
      const id = lastId(x.entryId);
      if(T.names[id] !== undefined && T.names[id] !== nn(x.name)){ ok = false; err(isRoot ? 'unit ' + nn(x.name) + ' not recognized' : (/^Enhancements/.test(x.group || '') ? 'enhancement ' : 'option ') + nn(x.name) + (isRoot ? '' : ' on unit ' + unit) + ' not recognized'); }
      for(const c of x.selections || []) walk(c, false);
    };
    walk(s, true); return ok;
  };
  // why one part matches nothing: what it has that the closest part of the same datasheet the app has does not
  const explainPart = (p, unit, pool) => {
    const rid = lastId(p.entryId), sig = sigOf(p);
    const same = [...new Set((pool || partSigs).filter(s => s.startsWith(rid + '|')))];
    if(!same.length || T.names[rid] !== nn(p.name)){ err('unit ' + nn(p.name) + ' not recognized'); return; }
    const mineE = entries(sig);
    const best = same.map(s => { const e = entries(s); return { e, d:mineE.filter(x => !e.includes(x)).length + e.filter(x => !mineE.includes(x)).length }; }).sort((a, b) => a.d - b.d)[0];
    const byPath = new Map(); const walk = (x, path) => { for(const c of x.selections || []){ const k = (path ? path + '/' : '') + lastId(c.entryId); byPath.set(k, c); walk(c, k); } }; walk(p, '');
    const extra = mineE.filter(x => !best.e.includes(x));
    for(const x of extra){
      const n = x.slice(0, x.indexOf('×')), path = x.slice(x.indexOf('×') + 1), c = byPath.get(path) || {};
      const nm = nn(c.name || T.names[path.split('/').pop()] || path);
      if(nm === 'Warlord') err(n !== '1' ? 'warlord ×' + n + ' on unit ' + unit + ' not recognized' : 'warlord ' + unit + ' not recognized (the app has no such unit as Warlord in this faction)');
      else if(/^Enhancements/.test(c.group || '')) err('enhancement ' + nm + ' not recognized (on ' + unit + ')');
      else err('option ' + (n !== '1' || c.type === 'model' ? n + '× ' : '') + nm + ' on unit ' + unit + ' not recognized');
    }
    // what the app's has that the export does not (an item whose count differs is named above)
    const pathOf = x => x.slice(x.indexOf('×') + 1), extraPaths = new Set(extra.map(pathOf));
    const miss = best.e.filter(x => !mineE.includes(x) && !extraPaths.has(pathOf(x))).map(x => T.names[pathOf(x).split('/').pop()] || pathOf(x));
    if(miss.length) err('unit ' + unit + ' without ' + and([...new Set(miss)]) + ' not recognized');
  };

  // match every group; the list most of them come from is preferred, then data.js order
  const want = groups.map(g => g.parts.map(sigOf).sort());
  const sameSigs = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const cands = want.map(w => instances.filter(x => sameSigs(x.sigs, w)));
  const score = new Map(pool.map(a => [a, cands.filter(c => c.some(x => x.a === a)).length]));
  const order = pool.slice().sort((a, b) => score.get(b) - score.get(a) || D.armies.indexOf(a) - D.armies.indexOf(b));
  const used = new Map(), picks = [];
  groups.forEach((g, i) => {
    const unit = label(g);
    if(!g.parts.every(p => namesOk(p, nn(p.name)))) return;
    for(const p of g.parts) if(Number(p.number) !== 1) err('unit ' + nn(p.name) + ' ×' + p.number + ' not recognized');
    // an option holding models ("8 chainblades") is taken once: its models carry the count
    const holders = x => { for(const c of x.selections || []){ if(c.type !== 'model' && (c.selections || []).some(y => y.type === 'model') && Number(c.number) !== 1) err('option ' + c.number + '× ' + nn(c.name) + ' on unit ' + unit + ' not recognized'); holders(c); } };
    g.parts.forEach(holders);
    const before = errors.length;
    const c = cands[i];
    if(!c.length){
      // the closest unit of the same datasheets (the same leader on the same bodyguard): what differs from it
      const rids = g.parts.map(p => lastId(p.entryId)).sort().join(' ');
      const like = instances.filter(x => x.sigs.map(s => s.slice(0, s.indexOf('|'))).sort().join(' ') === rids);
      if(like.length){
        const mineS = want[i], diff = x => mineS.filter(s => !x.sigs.includes(s)).length;
        const best = like.slice().sort((x, y) => (pool.includes(y.a) - pool.includes(x.a)) || diff(x) - diff(y))[0];   // a usable list's first
        g.parts.forEach(p => { if(!best.sigs.includes(sigOf(p))) explainPart(p, nn(p.name), best.sigs); });
        if(errors.length === before) err('leader attachment ' + unit + ' not recognized (the app has these parts, but not together like this)');
        return;
      }
      const known = g.parts.map(p => partSigs.includes(sigOf(p)));
      if(known.every(Boolean)) err(g.parts.length > 1 ? 'leader attachment ' + unit + ' not recognized (the app has them, but not attached like this)' : 'unit ' + unit + ' on its own not recognized (the app has it only in an attached unit)');
      else g.parts.forEach((p, k) => { if(!known[k]) explainPart(p, nn(p.name)); });
      return;
    }
    const inPool = c.filter(x => pool.includes(x.a)).sort((x, y) => order.indexOf(x.a) - order.indexOf(y.a) || allOf(x.a).indexOf(x.u) - allOf(y.a).indexOf(y.u));
    if(!inPool.length){
      if(pool.length) err('unit ' + unit + ' not recognized with ' + and(dets.map(k => FAC.detachments[k].name)) + ': the app has it only in ' + and([...new Set(c.map(x => x.a.name))]) + ' (' + and([...new Set(c.map(x => x.a.detachments.map(k => FAC.detachments[k].name).join(' + ')))]) + ')');
      return;
    }
    const cost = g.parts.reduce((t, p) => t + costOf(p), 0);
    const priced = inPool.filter(x => x.u.pts === cost);
    if(!priced.length){ err('points of unit ' + unit + ' not recognized: ' + cost + ' pts in the export, ' + inPool[0].u.pts + ' in the app'); return; }
    const pick = priced.find(x => (used.get(x.u) || 0) < (x.u.copies || 1)) || priced[0];
    used.set(pick.u, (used.get(pick.u) || 0) + 1);
    picks.push(Object.assign({}, pick));
  });
  // the list as a whole: at most one Warlord, and each entry no more often than BSData allows per list (an enhancement once, an
  // Epic Hero once); a unit the app has may be taken more often than a list of the app takes it, as long as these hold
  if(!errors.length){
    const wl = picks.filter(x => x.u.warlord);
    // (none only as a list of the app has none: the owner's 4 megas and a destrier, as New Recruit printed it)
    if(wl.length > 1 || (!wl.length && !pool.some(a => !a.units.some(u => u.warlord)))) err('warlord not recognized: ' + (wl.length ? wl.length + ' units are the Warlord (' + and(wl.map(x => x.u.name)) + ')' : 'no unit is the Warlord'));
    // how many of each entry the list takes, against BSData's max per list (an enhancement once, an Epic Hero once)
    const n = new Map(), walk = (x, isRoot) => { const id = lastId(x.entryId); n.set(id, { x, n:((n.get(id) || {}).n || 0) + Number(x.number), isRoot }); for(const c of x.selections || []) walk(c, false); };
    roots.forEach(r => walk(r, true));
    for(const [id, { x, n:k, isRoot }] of n) if(T.maxPerList[id] !== undefined && k > T.maxPerList[id])
      err((isRoot ? 'unit ' : /^Enhancements/.test(x.group || '') ? 'enhancement ' : 'option ') + nn(x.name) + ' ×' + k + ' not recognized (BSData allows ' + T.maxPerList[id] + ' per list)');
  }
  if(!errors.length){
    const sum = picks.reduce((t, x) => t + x.u.pts, 0);
    if(sum !== total) err('points total ' + total + ' not recognized: the units add up to ' + sum);
  }
  if(errors.length) return fail();

  /* the list: each unit as data.js has it, a unit taken more than once as its copies */
  // in the order verify/import-nr.js gives a list: role, then units without a leader, then the roster's order
  const ROLES = ['Epic Hero', 'Character', 'Battleline', 'Dedicated Transport', 'Infantry', 'Mounted', 'Beast', 'Swarm', 'Vehicle', 'Monster', 'Fortification'];
  const roleAt = r => ROLES.includes(r) ? ROLES.indexOf(r) : ROLES.length;
  picks.forEach((x, k) => { x.k = k; });
  picks.sort((a, b) => (roleAt(a.u.role) - roleAt(b.u.role)) || ((a.u.leads ? 1 : 0) - (b.u.leads ? 1 : 0)) || (a.k - b.k));
  // (the same unit of two of the app's lists, field for field, is one unit with its copies)
  const units = [], seenIds = new Set(), made = new Map(), same = u => JSON.stringify(Object.assign({}, u, { copies:undefined }));
  for(const x of picks){
    const key = same(x.u);
    if(made.has(key)){ const u = made.get(key); u.copies = (u.copies || 1) + 1; continue; }
    const u = clone(x.u); delete u.copies;
    let id = u.id, k = 2; while(seenIds.has(id)) id = u.id + '-' + k++;
    u.id = id; seenIds.add(id); made.set(key, u); units.push(u);
  }
  // reference sheets (ref): a unit of the app's list that a rule of an imported unit adds later (the Pink Horrors' Blue Horrors) comes
  // with that unit, last, when the export has no entry of its own for it
  for(const x of picks) for(const r of (x.a ? allOf(x.a) : []).filter(r => r.ref && r.ref.by === x.u.id)){
    if(units.some(u => u.ref && u.name === r.name && u.ref.by === r.ref.by)) continue;
    const u = clone(r); let id = u.id, k = 2; while(seenIds.has(id)) id = u.id + '-' + k++; u.id = id; seenIds.add(id); units.push(u);
  }
  // (and one a stratagem of the imported detachments adds, ref.strat: Gift of Change's Chaos Spawn, from an app list of those detachments)
  // (and only when an imported unit is one it can target: Gift of Change's THOUSAND SONS CHARACTER excluding MONSTERS)
  const has = (x, k) => (x.kw || []).some(y => y.toLowerCase() === k.toLowerCase()), can = (nd, x) => !nd || ((nd.all || []).every(k => has(x, k)) && (!nd.any || nd.any.some(k => has(x, k))) && !(nd.none || []).some(k => has(x, k)));
  const stOf = id => dets.map(k => ((FAC.detachments[k] || {}).stratagems || []).find(s => s.id === id)).find(Boolean);
  for(const a of pool) for(const r of allOf(a).filter(r => r.ref && r.ref.strat && stOf(r.ref.strat) && units.some(x => !x.ref && can(stOf(r.ref.strat).needs, x)))){
    if(units.some(u => u.ref && u.name === r.name && u.ref.strat === r.ref.strat)) continue;
    const u = clone(r); let id = u.id, k = 2; while(seenIds.has(id)) id = u.id + '-' + k++; u.id = id; seenIds.add(id); units.push(u);
  }
  const name = typo(nn(R.name)) || 'Imported list';
  const army = { id:opt.id || 'import-' + (name.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'list'), name, faction:fac,
    points:limit || (battleSize && T.limits[battleSize]) || null, pointsUsed:total, battleSize, disposition, detachments:dets };
  if(Object.keys(config).length) army.config = config;
  army.source = 'New Recruit, imported ' + (opt.date || new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }));
  army.units = units;
  army.imported = true;
  return { ok:true, army };
}

/* ---------------- the input formats ----------------
   WH_IMPORT.parse(input, WH_DATA) → Promise of { ok:true, format, json } | { ok:false, errors }: a .json, .ros or .rosz export (text or
   bytes), or New Recruit's text formats B ("+++ …") and C ("## Category …"), each read into the export's shape. A text names no BSData ids:
   each name is looked up exactly (case, apostrophes and spaces aside) and a line that is not exactly one thing refuses the whole import,
   naming the line. Format A is refused ("format not supported"). No fuzzy matching, no guessing. */
// (names as builder.js compares them)
const lc = s => nn(s).toLowerCase();
const uniq = a => a.filter((x, i) => a.indexOf(x) === i);
function splitList(s){ const out = []; let d = 0, cur = ''; for(const ch of String(s || '')){ if(ch === '(') d++; if(ch === ')') d--; if(ch === ',' && !d){ out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(nn).filter(x => x && x !== 'undefined'); }

// .ros: BattleScribe's XML (the same roster as the JSON export); .rosz: it zipped (one file). Read into the JSON export's shape.
function xmlTree(text){
  const ent = t => t.replace(/&(lt|gt|quot|apos|amp|#(\d+)|#x([0-9a-f]+));/gi, (m, n, d, h) => d ? String.fromCodePoint(+d) : h ? String.fromCodePoint(parseInt(h, 16)) : { lt:'<', gt:'>', quot:'"', apos:"'", amp:'&' }[n.toLowerCase()]);
  const rootEl = { tag:'#', attrs:{}, kids:[], text:'' }, stack = [rootEl];
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while((m = re.exec(text))){
    const top = stack[stack.length - 1];
    if(m[1] !== undefined){ top.text += m[1]; continue; }
    if(m[6] !== undefined){ top.text += ent(m[6]); continue; }
    if(!m[3]) continue;
    if(m[2]){ if(stack.length < 2 || top.tag !== m[3]) throw new Error('xml'); stack.pop(); continue; }
    const el = { tag:m[3], attrs:{}, kids:[], text:'' };
    for(const a of m[4].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) el.attrs[a[1]] = ent(a[2] !== undefined ? a[2] : a[3]);
    top.kids.push(el);
    if(!m[5]) stack.push(el);
  }
  if(stack.length !== 1) throw new Error('xml');
  return rootEl.kids[0];
}
// an element as the JSON export holds it: its attributes, its lists (costs, selections, …) as arrays, a characteristic's text as $text
const NUM = { number:1, value:1 };
function fromXml(el){
  const o = {};
  for(const [k, v] of Object.entries(el.attrs)) o[k] = NUM[k] && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v === 'true' ? true : v === 'false' ? false : v;
  if(el.tag === 'characteristic'){ o.$text = el.text; return o; }
  for(const k of el.kids){ if(k.tag === 'description') o.description = k.text; else if(k.kids.length || /s$/.test(k.tag)) o[k.tag] = k.kids.map(fromXml); }
  return o;
}
const readRos = text => { const r = xmlTree(text); if(!r || r.tag !== 'roster') throw new Error('not a roster'); return { roster:fromXml(r) }; };
// the one file of a .rosz (a zip): its local header, then the deflated bytes, inflated by the platform (DecompressionStream)
async function unzip(bytes){
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if(dv.getUint32(0, true) !== 0x04034b50) throw new Error('not a zip');
  const method = dv.getUint16(8, true), flags = dv.getUint16(6, true), nameLen = dv.getUint16(26, true), extra = dv.getUint16(28, true);
  let size = dv.getUint32(18, true);
  if(flags & 8){   // sizes after the data: the central directory has them
    let e = b.length - 22; while(e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if(e < 0) throw new Error('zip');
    size = dv.getUint32(dv.getUint32(e + 16, true) + 20, true);
  }
  const start = 30 + nameLen + extra, data = b.subarray(start, start + size);
  if(method === 0) return new TextDecoder().decode(data);
  if(method !== 8 || typeof DecompressionStream === 'undefined') throw new Error('zip method');
  const out = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
  return new TextDecoder().decode(out);
}

// New Recruit's text formats: B ("+++ FACTION KEYWORD: …", WTC style) and C ("# ++ Army Roster ++", "## <Category> […]"). Format A
function detect(text){
  const t = String(text || '').replace(/^﻿/, '').trim();
  if(/^[{[]/.test(t)) return 'json';
  if(/^<(\?xml|roster)/.test(t)) return 'ros';
  if(/^\++\s*$/m.test(t.split('\n')[0]) || /^\+ FACTION KEYWORD:/m.test(t)) return 'text-b';
  if(/^# \+\+ .* \+\+/m.test(t)) return 'text-c';
  if(/^(ATTACHED UNITS|CHARACTERS|OTHER DATASHEETS)\s*$/m.test(t)) return 'text-a';
  return null;
}
// a text's units, read line by line: { line, name, pts, items, models:[{ n, name, per:[[gear]] }], enh, warlord, attach:{ to, k, support } }
const LINE_ERR = (n, l, why) => 'line ' + n + ': ' + why + ' (“' + nn(l).slice(0, 80) + '”)';
function itemsOf(s){ return splitList(s).map(x => { const m = /^(\d+)x\s+(.*)$/.exec(x); return m ? { n:+m[1], name:m[2] } : { n:1, name:x }; }); }
function readTextB(t, err){
  const L = t.split('\n'), H = {}, units = []; let u = null, model = null, i = 0;
  const head = (k, v) => { H[k] = v; };
  for(i = 0; i < L.length; i++){
    const l = L[i].replace(/\s+$/, ''), n = i + 1;
    if(!l.trim() || /^\++$/.test(l.trim()) || /^Created with /.test(l.trim())) continue;
    let m;
    if((m = /^\+ ([A-Z ]+): (.*)$/.exec(l))){ head(m[1], m[2]); continue; }
    if(/^(\+|&)/.test(l)) continue;
    if((m = /^(?:(\w+?\d+): )?(\d+)x (.+?) \((\d+) pts\)(?:: (.*))?$/.exec(l))){
      u = { line:n, tag:m[1] || null, name:m[3], n:+m[2], pts:+m[4], models:[], items:[], enh:null, warlord:false }; units.push(u); model = null;
      if(m[5] !== undefined){ const w = /^(\d+) with (.*)$/.exec(m[5]); if(w) u.models.push({ n:+w[1], name:null, per:[{ n:+w[1], gear:itemsOf(w[2]) }] }); else u.items = itemsOf(m[5]); }
      continue;
    }
    if(!u){ err(LINE_ERR(n, l, 'not read')); continue; }
    if((m = /^\s*Enhancement: (.+?) \(\+(\d+) pts\)$/.exec(l))){ u.enh = m[1]; continue; }
    if((m = /^\s*(Supporting|Leading|Attached to) (.+?)(?:\[(\d+)\])?$/.exec(l))){ u.attach = { kind:m[1], to:m[2], k:+(m[3] || 1), line:n }; continue; }
    if((m = /^\s*• (\d+)x ([^:]+?)(?:: (.*))?$/.exec(l))){
      model = { n:+m[1], name:m[2], per:[] }; u.models.push(model);
      if(m[3] !== undefined){ const w = /^(\d+) with (.*)$/.exec(m[3]); model.per.push(w ? { n:+w[1], gear:itemsOf(w[2]) } : { n:model.n, gear:itemsOf(m[3]) }); }
      continue;
    }
    if(model && (m = /^\s+(\d+) with (.*)$/.exec(l))){ model.per.push({ n:+m[1], gear:itemsOf(m[2]) }); continue; }
    err(LINE_ERR(n, l, 'not read'));
  }
  const dets = (H.DETACHMENT || '').replace(/\s*\([^()]*\)\s*$/, '');
  return { format:'text-b', name:null, faction:H['FACTION KEYWORD'] || '', detachments:dets ? dets.split(/,\s*/) : [], disposition:H['FORCE DISPOSITION'] || null, total:parseInt(H['TOTAL ARMY POINTS'], 10) || null, units };
}
function readTextC(t, err){
  const L = t.split('\n'), units = [], H = { detachments:[] }; let u = null, sec = null;
  for(let i = 0; i < L.length; i++){
    const l = L[i].replace(/\s+$/, ''), n = i + 1; let m;
    if(!l.trim() || /^Created with /.test(l.trim()) || l.trim() === 'Show/Hide Options') continue;
    if(i === 0 || (!H.title && !/^#/.test(l))){ H.title = l; continue; }
    if((m = /^# \+\+ .* \+\+ \[(\d+) pts/.exec(l))){ H.total = +m[1]; continue; }
    if((m = /^## (.+?)(?: \[.*\])?$/.exec(l))){ sec = m[1]; u = null; continue; }
    if(sec === 'Configuration'){
      if((m = /^Battle Size: (.*?) \((\d+) Point limit\)$/.exec(l))){ H.battleSize = m[1]; H.limit = +m[2]; continue; }
      if((m = /^Detachment(?: \[[^\]]*\])?: (.*)$/.exec(l))){ H.detachments = m[1].split(/,\s*/).map(x => x.replace(/\s*\[[^\]]*\]$/, '')); continue; }
      if((m = /^Force Disposition: (.*)$/.exec(l))){ H.disposition = m[1]; continue; }
      err(LINE_ERR(n, l, 'not read')); continue;
    }
    if((m = /^([^•\s].*?) \[(\d+) pts\]:?(?: (.*))?$/.exec(l))){
      u = { line:n, name:m[1], pts:+m[2], models:[], items:[], enh:null, warlord:false }; units.push(u);
      if(m[3]) u.items = itemsOf(m[3].replace(/\s*\[\d+ pts\]/g, ''));
      u.priced = (m[3] || '').split(/,\s*/).filter(x => /\[\d+ pts\]$/.test(x)).map(x => x.replace(/\s*\[\d+ pts\]$/, ''));
      continue;
    }
    if(!u){ err(LINE_ERR(n, l, 'not read')); continue; }
    if((m = /^\s*• (Supporting|Leading|Supported by|Led by): (.+?)(?:\[(\d+)\])?$/.exec(l))){ u.attach = { kind:m[1], to:m[2], k:+(m[3] || 1), line:n }; continue; }
    if((m = /^\s*• (\d+)x ([^:]+?)(?:: (.*))?$/.exec(l))){ u.models.push({ n:+m[1], name:m[2], per:[{ n:+m[1], gear:itemsOf(m[3] || '') }] }); continue; }
    err(LINE_ERR(n, l, 'not read'));
  }
  const tm = /^(.*) - (.*) - \[(\d+) pts\]$/.exec(nn(H.title || ''));
  return { format:'text-c', name:tm ? tm[2] : null, faction:tm ? tm[1] : '', detachments:H.detachments, disposition:H.disposition || null, battleSize:H.battleSize || null, limit:H.limit || null, total:H.total || null, units };
}

// a text's list as the export: each name looked up exactly (case, apostrophes and spaces aside) in data.js; a unit is one of the app's
function textToExport(T0, D, err){
  const B = D.bsIds || {}, own = o => Object.assign(Object.create(null), o || {});
  const T = {}; for(const k of Object.keys(B)) T[k] = own(B[k]);
  const ids = (tab, f) => Object.keys(T[tab]).filter(k => f(T[tab][k], k)).sort();
  // the faction: the last part of New Recruit's catalogue name ("Xenos - Orks"), the name of exactly one faction of data.js
  const fname = nn(T0.faction).split(' - ').pop();
  const facs = Object.keys(D.factions).filter(k => lc(D.factions[k].name) === lc(fname));
  if(facs.length !== 1){ err('faction ' + (fname || '(none)') + ' not recognized'); return null; }
  const fac = facs[0], F = D.factions[fac], cat = ids('factions', v => v === fac)[0];
  if(!cat){ err('faction ' + F.name + ' not recognized'); return null; }
  if(WB().catalogued(D, fac)){ err('faction ' + F.name + ': a text export names no values, and ' + F.name + ' lists are built from its catalogue with the values their rules change: import its .json, .ros or .rosz export'); return null; }
  const one = (what, list, name) => { if(list.length === 1) return list[0]; err(what + ' ' + name + ' not recognized' + (list.length ? ' (more than one)' : '')); return null; };
  const dets = T0.detachments.map(n => { const k = one('detachment', Object.keys(F.detachments).filter(d => lc(F.detachments[d].name) === lc(n)), n); return k && ids('detachments', v => v === fac + '/' + k)[0]; });
  const disp = T0.disposition ? one('disposition', ids('dispositions', v => lc(v) === lc(T0.disposition)), T0.disposition) : null;
  if(!T0.disposition) err('disposition not recognized (the text names none)');
  const sizes = Object.keys(T.battleSizes).sort(), bsName = T0.battleSize || (sizes.length === 1 ? T.battleSizes[sizes[0]] : null);
  const bs = bsName ? one('battle size', sizes.filter(k => lc(T.battleSizes[k]) === lc(bsName)), bsName) : null;
  if(!bsName) err('battle size not recognized (the text names none)');
  const rootOf = kind => ids('roots', v => v === kind)[0];
  if(dets.some(x => !x) || !disp || !bs) return null;
  // the units: a leader's text unit and the unit it is attached to are one unit (New Recruit's numbering: "Tankbustas[2]", the second)
  const U = T0.units, nth = (name, k) => U.filter(x => lc(x.name) === lc(name))[k - 1];
  const leadOf = new Map();
  for(const x of U) if(x.attach){
    const y = nth(x.attach.to, x.attach.k);
    if(!y){ err(LINE_ERR(x.attach.line, x.attach.to, 'attached to a unit that is not in the list')); continue; }
    const lead = /^(Supporting|Leading)$/.test(x.attach.kind), [ch, body] = lead ? [x, y] : [y, x];
    const support = /^Support/.test(x.attach.kind);
    if(leadOf.has(ch) && leadOf.get(ch).body !== body){ err(LINE_ERR(ch.line, ch.name, 'attached to two units')); continue; }
    leadOf.set(ch, { body, support:support || (leadOf.has(ch) && leadOf.get(ch).support) });
  }
  // (in the order of their first line, as the export lists a unit where its first part is)
  const groups = U.filter(x => !leadOf.has(x)).map(b => ({ body:b, chars:U.filter(c => leadOf.has(c) && leadOf.get(c).body === b) })).sort((a, b) => Math.min(...a.chars.concat([a.body]).map(x => x.line)) - Math.min(...b.chars.concat([b.body]).map(x => x.line)));
  const enhNames = Object.values(F.detachments).flatMap(d => d.enhancements || []).flatMap(e => [e.name, e.nr].filter(Boolean));
  const isEnhName = n => enhNames.some(e => lc(e) === lc(n.replace(/\s*\((?:Upgrade|Enhancement)\)$/i, '')));
  // a text unit's models: [{ n, name, key }] (key: one model's weapons and wargear, with counts)
  const keyOf = items => items.map(x => x.n + '×' + lc(x.name)).sort().join(',');
  const textModels = x => {
    const items = x.items.filter(i => lc(i.name) !== 'warlord' && !isEnhName(i.name));
    const out = x.models.flatMap(m => m.per.map(p => ({ n:p.n, name:m.name, key:keyOf(p.gear) })));
    if(items.length || !out.length) out.unshift({ n:1, name:x.name, key:keyOf(items) });
    return out;
  };
  const enhOfText = x => x.enh || (x.items.find(i => isEnhName(i.name)) || {}).name || null;
  const pool = (D.armies || []).filter(a => a.faction === fac && !a.imported && !a.config && a.battleSize === T.battleSizes[bs] && a.detachments.slice().sort().join('+') === dets.map(id => T.detachments[id].split('/')[1]).sort().join('+'));
  if(!pool.length){ err('detachments ' + and(T0.detachments) + ' not recognized: no list of the app has them'); return null; }
  const storedModels = u => u.models.map((l, i) => { const m = /^(\d+)× (.*?)(?: \((.*)\))?$/.exec(l) || []; const gear = (u.gear[i] || []).concat(m[3] ? splitList(m[3]) : []);
    const c = {}; for(const g of gear) c[lc(g)] = (c[lc(g)] || 0) + 1; return { n:+m[1], name:m[2], key:Object.keys(c).sort().map(k => c[k] + '×' + k).join(',').split(',').map(x => x).sort().join(',') }; });
  const nameOk = (t, s) => t === null || lc(t) === lc(s) || (T0.format === 'text-b' && lc(t) === lc(s.replace(/ w\/ .*$/, '')));
  // (the same models, line for line: each line's count and name, or, where the text names no model, the count of models so armed)
  const sameModels = (tm, sm) => {
    const keys = uniq(tm.concat(sm).map(x => x.key));
    return keys.every(k => { const a = tm.filter(x => x.key === k), b = sm.filter(x => x.key === k);
      if(a.some(x => x.name === null)) return a.reduce((t, x) => t + x.n, 0) === b.reduce((t, x) => t + x.n, 0);
      const left = b.slice(); return a.length === b.length && a.every(x => { const i = left.findIndex(y => y.n === x.n && nameOk(x.name, y.name)); if(i < 0) return false; left.splice(i, 1); return true; }); });
  };
  const sel = [], out = { roster:{ name:T0.name || '', costs:[{ name:'pts', value:T0.total || 0 }], costLimits:T.limits[T.battleSizes[bs]] ? [{ name:'pts', value:T.limits[T.battleSizes[bs]] }] : [], forces:[{ catalogueId:cat, catalogueName:T0.faction, selections:sel }] } };
  let uid = 0;
  sel.push({ id:'b', name:'Battle Size', entryId:rootOf('battleSize'), number:1, type:'upgrade', selections:[{ id:'b1', name:T.battleSizes[bs], entryId:bs, number:1, type:'upgrade' }] });
  sel.push({ id:'d', name:'Detachment', entryId:rootOf('detachment'), number:1, type:'upgrade', selections:dets.map((id, i) => ({ id:'d' + i, name:F.detachments[T.detachments[id].split('/')[1]].name, entryId:id, number:1, type:'upgrade' })) });
  sel.push({ id:'f', name:'Force Disposition', entryId:rootOf('disposition'), number:1, type:'upgrade', selections:[{ id:'f1', name:T.dispositions[disp], entryId:disp, number:1, type:'upgrade' }] });
  for(const g of groups){
    const parts = g.chars.concat([g.body]), multi = parts.length > 1, line = parts[0].line;
    const tm = parts.flatMap(textModels), pts = parts.reduce((t, x) => t + x.pts, 0), enh = parts.map(enhOfText).filter(Boolean);
    const warlord = parts.some(x => x.items.some(i => lc(i.name) === 'warlord'));
    const names = parts.map(x => lc(x.name));
    const cands = pool.flatMap(a => a.units.concat(a.refs || []).filter(u => !u.ref).map(u => ({ a, u })))
      .filter(({ u }) => JSON.stringify([u.name].concat((u.also || []).map(c => c.name), u.leads ? [u.leads] : []).map(lc)) === JSON.stringify(names)
        && u.pts === pts && !!u.warlord === warlord && JSON.stringify([u.enhancement, u.upgrade].filter(Boolean).map(lc).sort()) === JSON.stringify(enh.map(e => lc(e.replace(/\s*\((?:Upgrade|Enhancement)\)$/i, ''))).sort())
        && sameModels(tm, storedModels(u)));
    const sigs = uniq(cands.map(({ a, u }) => JSON.stringify((T.units[a.id + '/' + u.id] || []).slice().sort())));
    if(sigs.length !== 1){ err(LINE_ERR(line, parts.map(x => x.name).join(' + '), sigs.length ? 'more than one unit of the app’s lists is this' : 'no unit of the app’s ' + F.name + ' lists is exactly this (its datasheets, points, enhancement, Warlord and every model’s weapons)')); continue; }
    const c = cands[0], sigList = T.units[c.a.id + '/' + c.u.id];
    // each part: the signature whose root is its datasheet, as a selection tree (a model's count on its model entry)
    const modelNames = new Set(storedModels(c.u).map(m => lc(m.name)));
    const rootsOut = parts.map(x => {
      const sig = sigList.find(q => lc(T.names[q.slice(0, q.indexOf('|'))] || '') === lc(x.name));
      if(!sig) return null;
      const rid = sig.slice(0, sig.indexOf('|')), r = { id:'u' + (++uid), name:T.names[rid], entryId:rid, number:1, type:modelNames.has(lc(T.names[rid])) ? 'model' : 'unit', costs:[{ name:'pts', value:x.pts }], selections:[] };
      for(const e of sig.slice(sig.indexOf('|') + 1).split(',').filter(Boolean)){
        const n = +e.slice(0, e.indexOf('×')), path = e.slice(e.indexOf('×') + 1).split('/');
        let at = r; for(const id of path){ let k = at.selections.find(z => lastId(z.entryId) === id); if(!k){ k = { id:'s' + (++uid), name:T.names[id] || id, entryId:id, number:0, type:modelNames.has(lc(T.names[id] || '')) ? 'model' : 'upgrade', selections:[] }; at.selections.push(k); } at = k; }
        at.number = n;
      }
      return r;
    });
    if(rootsOut.some(x => !x)){ err(LINE_ERR(line, parts.map(x => x.name).join(' + '), 'not recognized')); continue; }
    const body = rootsOut[rootsOut.length - 1];
    rootsOut.slice(0, -1).forEach((r, i) => { r.associations = [{ type:'outgoing', to:body.id, name:leadOf.get(g.chars[i]).support ? 'Supporting' : 'Leading', action:'group' }]; });
    sel.push(...rootsOut);
  }
  return out;
}

// any input: the export as JSON ({ roster }), from a .json, .ros or .rosz file (text or bytes) or a text format B or C
async function parse(input, D){
  let text = input, format = null;
  try {
    if(input && typeof input === 'object' && !(input instanceof Uint8Array) && !(input instanceof ArrayBuffer)) return { ok:true, format:'json', json:input };
    if(input instanceof Uint8Array || input instanceof ArrayBuffer){
      const b = input instanceof Uint8Array ? input : new Uint8Array(input);
      if(b[0] === 0x50 && b[1] === 0x4b){ text = await unzip(b); format = 'rosz'; }
      else text = new TextDecoder().decode(b);
    }
  } catch(e){ return { ok:false, errors:['not a New Recruit export (the .rosz file could not be opened)'] }; }
  return parseSync(text, D, format);
}
// (the same for text, at once: a kept export is JSON or text)
function parseSync(text, D, format){
  const errors = [], err = m => { if(!errors.includes(m)) errors.push(m); };
  const kind = detect(text);
  if(!format) format = kind;
  if(kind === 'json'){ try { return { ok:true, format, json:JSON.parse(text) }; } catch(e){ return { ok:false, errors:['not a New Recruit export (the text is not JSON)'] }; } }
  if(kind === 'ros'){ try { return { ok:true, format, json:readRos(text) }; } catch(e){ return { ok:false, errors:['not a New Recruit export (the roster XML could not be read)'] }; } }
  if(kind === 'text-a') return { ok:false, errors:['format not supported: New Recruit’s text format with ATTACHED UNITS / CHARACTERS / OTHER DATASHEETS sections. Export the list as JSON (or .ros / .rosz), or as text in the “+++” or “## Category” format'] };
  if(kind === 'text-b' || kind === 'text-c'){
    const T0 = (kind === 'text-b' ? readTextB : readTextC)(String(text).replace(/^﻿/, '').replace(/\r/g, ''), err);
    const json = errors.length ? null : textToExport(T0, D, err);
    return errors.length || !json ? { ok:false, errors } : { ok:true, format, json, text:true };
  }
  return { ok:false, errors:['format not supported: not a New Recruit export (.json, .ros, .rosz, or text in the “+++” or “## Category” format)'] };
}

/* the app's import: any New Recruit export (WH_BUILDER.parse reads its format), made into a list.
   A faction with a full catalogue in data.js: built by builder.js from the export and the tables (WH_BUILDER.build), then joined with
   DATASHEETS as the app's own lists are (WH_DATA.resolve): the same list the app would have built in. A faction without one: today's
   strict copy (resolve, above), marked copied. Kept on the phone as { id, json, date } (json: the export as slim keeps it, or a text
   export's text) and made again from this data.js at every start; the id is "local-" and the first 12 hex of the sha256 of the kept export.
   WH_IMPORT.make(kept, WH_DATA, { id, date, name }) (name: the list's name given in the import box, over the export's) → { ok, army } | { ok:false, errors } (synchronous: a kept export is JSON or text)
   WH_IMPORT.read(input, WH_DATA) → Promise of { ok, kept } | { ok:false, errors } (a file's text or bytes, or pasted text)
   WH_IMPORT.localId(kept) → Promise of the id */
const WB = () => root.WH_BUILDER || (typeof require === 'function' ? require('./builder.js') : null);
const keptOf = (p, input) => p.text ? { text:String(input).replace(/^\uFEFF/, '').replace(/\r/g, '').trim() } : slim(p.json);
async function read(input, D){
  const p = await parse(input, D);
  return p.ok ? { ok:true, format:p.format, kept:keptOf(p, input) } : p;
}
function make(kept, D, opt){
  let j = kept;
  if(kept && typeof kept.text === 'string'){ const p = parseSync(kept.text, D); if(!p.ok) return p; j = p.json; }
  const bad = WB().malformed(j);
  if(bad) return { ok:false, errors:['not a New Recruit export (' + bad + ')'] };
  // (the list's name the player gave in the import box, opt.name: a text in format B names none)
  if(opt && typeof opt.name === 'string' && opt.name.trim()) j = Object.assign({}, j, { roster:Object.assign({}, j.roster, { name:opt.name.trim() }) });
  const fac = ((D.bsIds || {}).factions || {})[(j.roster.forces[0] || {}).catalogueId];
  if(fac && WB().catalogued(D, fac)){
    // (a list kept by an earlier version, whose kept export has no profiles: not built from half of it)
    const prof = s => (s.profiles || []).length || (s.selections || []).some(prof);
    if(!j.roster.forces[0].selections.some(prof)) return { ok:false, errors:['kept by an earlier version of the app without the values the build reads: import its export again'] };
    const r = WB().build(j, D, opt);
    if(!r.ok) return r;
    const army = D.resolve(r.army); army.imported = true; army.built = true;
    return { ok:true, army, entry:r.army };
  }
  const r = resolve(j, D, opt);
  if(r.ok) r.army.copied = true;
  return r;
}
// the list's name the kept export carries ('' where it names none: text format B), to prefill the import box's name
function nameOf(kept, D){ try { const j = kept && typeof kept.text === 'string' ? parseSync(kept.text, D).json : kept; return typo(nn(((j || {}).roster || {}).name || '')); } catch(e){ return ''; } }
const canonical = kept => JSON.stringify(kept);
async function localId(kept){
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(kept)));
  return 'local-' + [...new Uint8Array(d)].slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join('');
}

const API = { resolve, slim, signature, nn, read, make, localId, canonical, parse, parseSync, detect, nameOf };
if(typeof module !== 'undefined' && module.exports) module.exports = API; else root.WH_IMPORT = API;
})(this);
