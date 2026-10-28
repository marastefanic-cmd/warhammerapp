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

// what resolve reads, so a kept list is small
function slim(j){
  const sel = s => {
    const o = { id:s.id, name:s.name, entryId:s.entryId, number:s.number, type:s.type };
    if(s.group) o.group = s.group;
    const c = (s.costs || []).filter(x => x.name === 'pts'); if(c.length) o.costs = c.map(x => ({ name:'pts', value:x.value }));
    const a = (s.associations || []).filter(x => x.action === 'group').map(x => ({ type:x.type, to:x.to, name:x.name, action:x.action })); if(a.length) o.associations = a;
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

const API = { resolve, slim, signature, nn };
if(typeof module !== 'undefined' && module.exports) module.exports = API; else root.WH_IMPORT = API;
})(this);
