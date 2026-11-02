/* builder.js: a list, built from New Recruit's export and data.js alone. The app (app.html, through import.js) and the gate
   (verify/build-parity.js) run this same file; it reads no file and asks no network (browser and Node alike).

   WH_BUILDER.build(exportJson, WH_DATA, { id, date }) → { ok:true, army, notes } | { ok:false, errors:[...] }
     army: the list as data.js stores it (ARMIES: each unit entry names its datasheet and holds only what the list chose); the app
     joins it with DATASHEETS as for its own lists (WH_DATA.resolve). Built only for a faction with a full catalogue in data.js (every
     datasheet and detachment: DATASHEETS rows with points); a list of another faction is refused here (import.js copies it).
   WH_BUILDER.parse(input, WH_DATA) → Promise of { ok:true, format, json } | { ok:false, errors } : a .json, .ros or .rosz export (text or
     bytes), or New Recruit's text formats B ("+++ …") and C ("## Category …"), each read into the export's shape. Text formats name no
     BSData ids: each name is looked up exactly (case, apostrophes and spaces aside) and any name that is not exactly one thing refuses the
     whole import, naming its line. Format A is refused ("format not supported"). No fuzzy matching, no guessing.
   WH_BUILDER.canonical(json): the export as kept on the phone (what build reads), as stable text (the local id is its sha256).

   Deterministic: the same export and data.js give the same entry (the date is an input; no clock, locale or random). */
(function(root){
'use strict';

// ---------------------------------------------------------------- names
const nn = s => String(s == null ? '' : s).normalize('NFC')
  .replace(/[’‘ʼ′]/g, "'").replace(/[“”″]/g, '"').replace(/[‐‑‒–—−]/g, '-').replace(/…/g, '...').replace(/ /g, ' ')
  .replace(/\s+/g, ' ').trim();
const lc = s => nn(s).toLowerCase();
const typo = s => String(s).replace(/'/g, '’');                 // the app's apostrophes
const tn = s => typo(nn(s));
const lastId = e => String(e || '').split('::').pop();
const ptsOf = s => ((s && s.costs) || []).filter(c => c.name === 'pts').reduce((t, c) => t + (Number(c.value) || 0), 0);
const kids = s => (s && s.selections) || [];
const costOf = s => ptsOf(s) + kids(s).reduce((t, c) => t + costOf(c), 0);
const uniq = a => a.filter((x, i) => a.indexOf(x) === i);
const clone = o => JSON.parse(JSON.stringify(o));
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const and = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const ROLES = ['Epic Hero', 'Character', 'Battleline', 'Dedicated Transport', 'Infantry', 'Mounted', 'Beast', 'Swarm', 'Vehicle', 'Monster', 'Fortification'];
const KINDS = ['stats', 'ranged', 'melee', 'abilities'];
// the key order data.js writes (verify/tables.js TABLE_ORDER, with ds after id and why last)
const ORDER = {
  unit:['id','ds','name','short','role','pts','copies','ptsNote','enhancement','enhOn','upgrade','warlord','warlordOn','ref','leads','also','support','models','unplaced','gear','stats','ranged','melee','abilities','rules','kw','kwNote','kwOnly','partialRules','srcNote','why'],
  stats:['name','M','T','Sv','W','Ld','OC','InSv','base','printed','from','baseWith','own'],
  ranged:['group','fireAll','name','who','n','carrier','enh','hunter','range','A','BS','S','AP','D','kw','own','from'],
  melee:['group','name','who','n','carrier','hunter','range','A','WS','S','AP','D','kw','from','own'],
  abilities:['name','who','tag','at','damaged','na','ph','turn','turns','note','text','readOf']
};
const sorted = (o, keys) => { const out = {}; for(const k of keys) if(k in o) out[k] = o[k]; for(const k of Object.keys(o)) if(!(k in out)) out[k] = o[k]; return out; };

// ---------------------------------------------------------------- the export's shape (a malformed export is refused, never half read)
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const optArr = v => v === undefined || Array.isArray(v);
function malformed(j){
  if(!isObj(j) || !isObj(j.roster) || !Array.isArray(j.roster.forces)) return 'no roster';
  const R = j.roster;
  if(!optArr(R.costs) || !optArr(R.costLimits) || ![...(R.costs || []), ...(R.costLimits || [])].every(isObj)) return 'its points are malformed';
  if(R.forces.length !== 1 || !isObj(R.forces[0])) return null;
  const F = R.forces[0];
  if(!Array.isArray(F.selections)) return 'the force has no selections';
  let bad = null;
  const sel = (s, d) => {
    if(bad) return;
    if(!isObj(s) || typeof s.entryId !== 'string' || typeof s.name !== 'string' || typeof s.type !== 'string' || !Number.isInteger(s.number) || s.number < 0 ||
      !optArr(s.selections) || !optArr(s.costs) || !optArr(s.associations) || !optArr(s.profiles) || !optArr(s.categories) || !(s.costs || []).every(isObj) ||
      !(s.associations || []).every(isObj) || !(s.profiles || []).every(p => isObj(p) && typeof p.name === 'string' && optArr(p.characteristics)) || d > 12){ bad = 'a selection is malformed'; return; }
    for(const c of s.selections || []) sel(c, d + 1);
  };
  for(const s of F.selections) sel(s, 0);
  return bad;
}

// ---------------------------------------------------------------- the faction's catalogue in data.js
// (a faction is catalogued when data.js has its whole catalogue: DATASHEETS rows with GW's points, verify/from-bsdata.js --write)
const catalogued = (D, fac) => Object.values(D.datasheets || {}).some(r => r.faction === fac && r.points);
const catalogues = D => uniq(Object.values(D.datasheets || {}).filter(r => r.points).map(r => r.faction)).sort();
const factionName = (D, fac) => ((D.factions || {})[fac] || {}).name || fac;

// ---------------------------------------------------------------- the list's top-level selections (as import.js reads them)
function topLevel(j, D, err){
  const B = D.bsIds || {}, T = {};
  for(const k of Object.keys(B)) T[k] = Object.assign(Object.create(null), B[k]);
  const F = j.roster.forces[0], sels = F.selections || [];
  const fac = T.factions[F.catalogueId] || null;
  const top = sels.filter(s => s.type === 'upgrade');
  let battleSize = null, disposition = null; const dets = [], config = {}, seen = {};
  const KIND = { battleSize:'battle size', disposition:'disposition', detachment:'detachment' };
  const FAC = fac && D.factions[fac];
  for(const t of top){
    const id = lastId(t.entryId), ks = kids(t);
    if(Number(t.number) !== 1){ err('selection ' + t.number + '× ' + nn(t.name) + ' not recognized'); continue; }
    if(T.info[id]){
      for(const c of ks) if(!T.infoKids[lastId(c.entryId)] || kids(c).length || Number(c.number) !== 1) err('selection ' + nn(c.name) + ' in ' + nn(t.name) + ' not recognized');
      continue;
    }
    if(T.config[id]){
      const key = T.config[id];
      if(key in config){ err('selection ' + nn(t.name) + ' twice not recognized'); continue; }
      const odd = ks.filter(c => T.configKids[lastId(c.entryId)] !== nn(c.name) || kids(c).length || Number(c.number) !== 1);
      for(const c of odd) err('selection ' + nn(c.name) + ' in ' + nn(t.name) + ' not recognized');
      if(!odd.length && ks.length) config[key] = ks.map(c => tn(c.name)).join(', ');
      continue;
    }
    const kind = T.roots[id];
    if(!kind){ err('selection ' + nn(t.name) + ' not recognized'); continue; }
    if(seen[kind]){ err(KIND[kind] + ' selection ' + nn(t.name) + ' twice not recognized'); continue; }
    seen[kind] = true;
    for(const c of ks){
      const cid = lastId(c.entryId), nm = nn(c.name), once = Number(c.number) === 1 && !kids(c).length;
      if(kind === 'battleSize' && T.battleSizes[cid] && once){ if(battleSize) err('battle size ' + nm + ' not recognized (a list has one battle size)'); else battleSize = T.battleSizes[cid]; continue; }
      if(kind === 'disposition' && T.dispositions[cid] === nm && once){ if(disposition) err('disposition ' + nm + ' not recognized (a list has one Force Disposition)'); else disposition = nm; continue; }
      const d = kind === 'detachment' && T.detachments[cid], dk = d && d.split('/');
      if(d && once && FAC && dk[0] === fac && FAC.detachments[dk[1]] && nn(FAC.detachments[dk[1]].name) === nm){ if(dets.includes(dk[1])) err('detachment ' + nm + ' twice not recognized'); else dets.push(dk[1]); continue; }
      err(KIND[kind] + ' ' + (Number(c.number) !== 1 ? c.number + '× ' : '') + nm + ' not recognized');
    }
  }
  if(!battleSize && !seen.battleSize) err('battle size not recognized (the export names none)');
  if(!dets.length && !seen.detachment) err('detachment not recognized (the export names none)');
  if(fac && !disposition && !seen.disposition) err('disposition not recognized (the export names none)');
  if(fac && disposition && dets.length && !dets.some(d => ((FAC.detachments[d] || {}).dispositions || []).includes(disposition)))
    err('disposition ' + disposition + ' not recognized: ' + and(dets.map(d => FAC.detachments[d].name)) + ' allow' + (dets.length > 1 ? '' : 's') + ' ' + and(uniq(dets.flatMap(d => FAC.detachments[d].dispositions || []))));
  return { fac, battleSize, disposition, dets, config, limit:battleSize ? (T.limits[battleSize] || null) : null };
}

// ---------------------------------------------------------------- the export's profiles, as verify/from-json.js reads them
const WEAPON = ['Ranged Weapons', 'Melee Weapons'];
const chars = p => Object.fromEntries((p.characteristics || []).map(c => [c.name, c.$text == null ? '' : String(c.$text)]));
const weaponShaped = p => p.typeName !== 'Unit' && ['Range', 'A', 'S', 'AP', 'D'].every(k => (p.characteristics || []).some(c => c.name === k)) && (p.characteristics || []).some(c => c.name === 'BS' || c.name === 'WS');
const isWeaponProf = p => WEAPON.includes(p.typeName) || weaponShaped(p);
const weaponKind = p => p.typeName === 'Ranged Weapons' || (!WEAPON.includes(p.typeName) && !/^melee$/i.test(chars(p).Range || '')) ? 'ranged' : 'melee';
const weaponProfiles = s => (s.profiles || []).filter(isWeaponProf);
const isWeaponSel = s => weaponProfiles(s).length > 0;
const isEnh = s => /^Enhancements/.test(s.group || '');
const isWarlord = s => nn(s.name) === 'Warlord' && s.type === 'upgrade';
// "➤ Psychic tendril - neuroparasite (Destabilising Predation)": its group, name, the rules New Recruit names in brackets
function weaponName(prof, sel){
  let t = nn(prof.name).replace(/^➤\s*/, ''), m; const parens = [];
  while((m = /\s*\(([^()]*)\)$/.exec(t))){ if(!/^(x\d+|ranged|melee|Hunter: .*)$/i.test(m[1])) parens.unshift(m[1]); t = t.slice(0, m.index); }
  t = t.replace(/\[\d+\]/g, '').trim();
  const g = /^(.*?\S)\s*-\s+(\S.*)$/.exec(t);
  const w = { group:g ? g[1] : null, name:g ? g[2] : t, parens, hunter:/\bHUNTER:\s*\S/i.test(t) };
  if(!w.group && /^\s*➤/.test(prof.name) && sel && weaponProfiles(sel).length > 1) w.group = nn(sel.name);
  return w;
}
const statName = name => { let t = nn(name), m; const parens = []; while((m = /\s*\(([^()]*)\)$/.exec(t))){ parens.unshift(m[1]); t = t.slice(0, m.index); } return { name:t, parens }; };

// ---------------------------------------------------------------- one unit (a bodyguard and the characters attached to it)
function modelsOf(part){
  if(part.type === 'model') return [part];
  const out = [], walk = s => { for(const c of kids(s)){ if(c.type === 'model') out.push(c); else walk(c); } }; walk(part); return out;
}
// one model line's weapons (each as often as one model carries it) and its other wargear
function gearOf(m, per){
  const weapons = [], wargear = [], bundles = [];
  const walk = s => {
    for(const c of kids(s)){
      if(c.type === 'model' || isWarlord(c) || (isEnh(c) && !isWeaponSel(c))) continue;
      const n = Number(c.number) || 0;
      if(isWeaponSel(c)){ const names = uniq(weaponProfiles(c).map(p => { const w = weaponName(p, c); return w.group || w.name; })); for(const w of names) for(let k = 0; k < Math.round(n / per); k++) weapons.push(typo(w)); }
      else if(kids(c).some(isWeaponSel)) bundles.push(c);
      else wargear.push(tn(c.name));
    }
  };
  walk(m);
  const own = weapons.splice(0);
  for(const b of bundles) walk(b);
  const grouped = xs => uniq(xs).flatMap(w => xs.filter(x => x === w));
  return { weapons:grouped(own).concat(grouped(weapons)), wargear };
}

// the row of a datasheet a name means (exact, case and apostrophes aside)
const rowBy = (rows, name, group) => (rows || []).filter(r => lc(r.name) === lc(name) && lc(r.group || '') === lc(group || ''));

function Builder(D, fac, top, err){
  const S = D.datasheets, F = D.factions[fac];
  const dets = top.dets.map(d => F.detachments[d]);
  const enhRows = dets.flatMap(d => d.enhancements || []);
  const enhOf = n => { const b = nn(n).replace(/\s*\((?:Upgrade|Enhancement)\)$/i, ''); const hit = enhRows.filter(e => [e.name, e.nr].filter(Boolean).some(x => lc(x) === lc(n) || lc(x) === lc(b))); return hit.length === 1 ? hit[0] : null; };
  const dsOf = s => { const id = lastId(s.entryId), hit = Object.keys(S).filter(k => S[k].faction === fac && S[k].bsId === id); return hit.length === 1 ? hit[0] : null; };
  return { S, F, dets, enhOf, dsOf };
}

function buildUnit(B, g, err){
  const parts = g.chars.map(c => c.s).concat([g.body]);
  const named = parts.length > 1, pName = p => tn(p.name);
  const where = parts.map(pName).join(' + ');
  const keys = parts.map(p => B.dsOf(p));
  keys.forEach((k, i) => { if(!k) err('unit ' + nn(parts[i].name) + ' not recognized (no datasheet of the ' + B.F.name + ' catalogue has its BSData id)'); });
  if(keys.some(k => !k)) return null;
  const rowsOf = (i, kind) => B.S[keys[i]][kind] || [];
  const u = { ds:named ? keys : keys[0] };
  const role0 = (B.S[keys[0]] || {}).role;
  u.name = B.S[keys[0]].name;
  u.pts = parts.reduce((t, p) => t + costOf(p), 0);
  if(named) u.ptsNote = costOf(parts[0]) + g.chars.slice(1).map(c => ' + ' + pName(c.s) + ' ' + costOf(c.s)).join('') + ' + ' + pName(g.body) + ' ' + costOf(g.body);
  // enhancement (an UPGRADE is the bodyguard's), Warlord
  parts.forEach((p, i) => { const dfs = s => { for(const c of kids(s)){
    if(isEnh(c)){ const e = B.enhOf(c.name); if(!e){ err('enhancement ' + nn(c.name) + ' on unit ' + where + ' not recognized (not an enhancement of the list’s detachments)'); continue; }
      if(e.upgrade) u.upgrade = e.name; else { u.enhancement = e.name; if(i > 0 && i < parts.length - 1) u.enhOn = pName(p); } u._enh = (u._enh || []).concat({ e, i }); }
    if(isWarlord(c)){ u.warlord = true; if(i > 0 && i < parts.length - 1) u.warlordOn = pName(p); }
    dfs(c); } }; dfs(p); });
  if(named){ u.leads = pName(g.body); if(g.chars[0].support) u.support = true; if(g.chars.length > 1) u.also = g.chars.slice(1).map(c => Object.assign({ name:pName(c.s) }, c.support ? { support:true } : {})); }
  // models lines and their gear; wargear on the unit itself (no model's) is unplaced, or a model's the export associates it with
  const models = [], gear = [], unplaced = [];
  for(const p of parts){
    const lines = [];
    for(const m of modelsOf(p)){ const n = m === p ? 1 : Number(m.number) || 1; const g2 = gearOf(m, n); lines.push({ n, name:tn(m.name), wargear:g2.wargear, weapons:g2.weapons, sel:m }); }
    if(p.type !== 'model') for(const c of kids(p)) if(c.type !== 'model' && !isEnh(c) && !isWarlord(c) && !kids(c).some(x => x.type === 'model')){
      const k = Number(c.number) || 1, to = (c.associations || []).filter(a => a.type === 'outgoing').map(a => lines.find(l => l.sel && l.sel.id === a.to)).find(Boolean);
      if(isWeaponSel(c)){
        const ws = uniq(weaponProfiles(c).map(x => { const w = weaponName(x, c); return w.group || w.name; })).map(typo);
        if(to && k === to.n){ to.weapons.push(...ws); continue; }
        unplaced.push(...ws); continue;
      }
      if(to){
        if(to.n > k){ to.n -= k; to.splits = (to.splits || 0) + 1; lines.splice(lines.indexOf(to) + to.splits, 0, { n:k, name:to.name, wargear:to.wargear.concat(tn(c.name)), weapons:to.weapons.slice() }); }
        else to.wargear.push(tn(c.name));
        continue;
      }
      unplaced.push(tn(c.name));
    }
    for(const l of lines){ models.push(l.n + '× ' + l.name + (l.wargear.length ? ' (' + l.wargear.join(', ') + ')' : '')); gear.push(l.weapons); }
  }
  u.models = models; if(unplaced.length) u.unplaced = unplaced; u.gear = gear;
  // every other choice is one of its datasheet's options (BSData's, DATASHEETS options)
  parts.forEach((p, i) => { const S = B.S[keys[i]], opts = new Set((S.options || []).flatMap(o => o.choices.map(c => lc(c.name))));
    const d = s => { for(const c of kids(s)){ if(c.type !== 'model' && !isEnh(c) && !isWarlord(c) && !isWeaponSel(c) && !opts.has(lc(c.name)) && S.options) err('option ' + nn(c.name) + ' on unit ' + where + ' not recognized (not an option of GW’s datasheet ' + S.name + ')'); d(c); } }; d(p); });
  u._parts = parts; u._keys = keys; u._at = g.at;
  return u;
}

// ---------------------------------------------------------------- the list
function build(j, D, opt){
  opt = opt || {};
  const errors = [], err = m => { if(!errors.includes(m)) errors.push(m); };
  const fail = () => ({ ok:false, errors });
  if(typeof j === 'string'){ try { j = JSON.parse(j); } catch(e){ return { ok:false, errors:['not a New Recruit export (the text is not JSON)'] }; } }
  const bad = malformed(j);
  if(bad) return { ok:false, errors:['not a New Recruit export (' + bad + ')'] };
  const R = j.roster;
  if(R.forces.length !== 1 || (R.forces[0].forces || []).length){ err('a list with ' + (R.forces.length + (R.forces[0] && (R.forces[0].forces || []).length || 0)) + ' forces not recognized (the app takes one Army Roster)'); return fail(); }
  const top = topLevel(j, D, err);
  const F0 = R.forces[0];
  if(!top.fac){ err('faction ' + String(F0.catalogueName || F0.catalogueId || '?').split(' - ').pop() + ' not recognized'); return fail(); }
  if(!catalogued(D, top.fac)){ err('faction ' + factionName(D, top.fac) + ' not catalogued: imports are built from a full faction catalogue, and ' + factionName(D, top.fac) + ' has none yet (catalogued: ' + and(catalogues(D).map(f => factionName(D, f))) + ')'); return fail(); }
  if(errors.length) return fail();
  const B = Builder(D, top.fac, top, err); B.F_key = top.fac;
  const roots = F0.selections.filter(s => s.type !== 'upgrade');
  // the characters attached to a unit (New Recruit's Leading / Supporting)
  const byId = new Map(roots.map(s => [s.id, s])), leadsTo = new Map();
  for(const s of roots) for(const a of s.associations || []) if(a.type === 'outgoing' && a.action === 'group'){ if(byId.has(a.to)) leadsTo.set(s, { body:byId.get(a.to), support:a.name === 'Supporting' }); else err('unit ' + nn(s.name) + ' is attached to a unit that is not in the list'); }
  const groups = [];
  for(const s of roots) if(!leadsTo.has(s)) groups.push({ chars:[], body:s, at:roots.indexOf(s) });
  for(const [s, l] of leadsTo){ const g = groups.find(x => x.body === l.body); if(g) g.chars.push({ s, support:l.support }); else err('unit ' + nn(s.name) + ' is attached to a unit that is itself attached'); }
  for(const g of groups){ g.chars.sort((a, b) => roots.indexOf(a.s) - roots.indexOf(b.s)); g.at = Math.min(g.at, ...g.chars.map(c => roots.indexOf(c.s))); }
  // matched play only: no Legends, no Crucible characters (the owner's standing rule, docs/catalog.md)
  for(const s of roots){ const c = (s.categories || []).map(x => nn(x.name)); const m = /\[(Legends|Crucible)\]$/.exec(nn(s.name)) || (c.includes('Legends') ? [0, 'Legends'] : c.includes('Crucible') ? [0, 'Crucible'] : null);
    if(m) err('unit ' + nn(s.name) + ' not imported: ' + m[1] + ', not matched play'); }
  if(errors.length) return fail();
  let units = groups.map(g => buildUnit(B, g, err)).filter(Boolean);
  if(errors.length) return fail();
  // GW's points (DATASHEETS points: by the models of each part and how many of that datasheet the list has; wargear; the enhancement's)
  const seenDs = {}, gwNotes = [];
  for(const u of units.slice().sort((a, b) => a._at - b._at)){
    let gw = 0, ok = true;
    const per = u._parts.map((p, i) => {
      const S = B.S[u._keys[i]], P = S.points; if(!P){ ok = false; return costOf(p); }
      const k = seenDs[u._keys[i]] = (seenDs[u._keys[i]] || 0) + 1, n = p.type === 'model' ? 1 : modelsOf(p).reduce((t, m) => t + (Number(m.number) || 1), 0);
      const band = (P.costs || []).find(c => k >= c.from && (c.to == null || k <= c.to)), m = band && band.models.find(x => x.models === n);
      if(!m){ err('unit ' + nn(p.name) + ' not imported: ' + n + ' models is no size GW’s points give (' + and(uniq((P.costs || []).flatMap(c => c.models.map(x => x.models)))) + ')'); ok = false; return 0; }
      let t = m.pts; const d = s => { for(const c of kids(s)){ const w = (P.wargear || []).find(x => lc(x.name) === lc(c.name)); if(w) t += w.pts * (Number(c.number) || 1); if(isEnh(c)){ const e = B.enhOf(c.name); if(e) t += Number(e.pts) || 0; } d(c); } }; d(p);
      return t;
    });
    gw = per.reduce((t, x) => t + x, 0);
    if(ok && gw !== u.pts){ gwNotes.push({ unit:u.name + (u.leads ? ' + ' + u.leads : ''), export:u.pts, gw }); u.pts = gw; if(u.ptsNote) u.ptsNote = per[0] + u._parts.slice(1).map((p, i) => ' + ' + tn(p.name) + ' ' + per[i + 1]).join(''); }
  }
  // attached as GW's datasheets allow (the leader's Leader or Support ability: "This model can be attached to the following units: …")
  for(const u of units) if(u._parts.length > 1) u._parts.slice(0, -1).forEach((p, i) => {
    const S = B.S[u._keys[i]], body = B.S[u._keys[u._keys.length - 1]], ab = (S.abilities || []).find(a => /^(Leader|Support)$/.test(a.name));
    const may = ab ? splitList(String(ab.text).replace(/^[^:]*:/, '').replace(/\*\*/g, '')).map(lc) : [];
    if(!may.includes(lc(body.name))) err('leader attachment ' + S.name + ' + ' + body.name + ' not imported: ' + (ab ? S.name + ' can be attached to ' + and(splitList(ab.text.replace(/^[^:]*:/, '').replace(/\*\*/g, ''))) : 'GW’s datasheet of ' + S.name + ' has no Leader ability'));
  });
  const wl = units.filter(u => u.warlord);
  if(wl.length !== 1) err('warlord not recognized: ' + (wl.length ? wl.length + ' units are the Warlord (' + and(wl.map(u => u.name)) + ')' : 'no unit is the Warlord'));
  // (an enhancement GW limits to one per army, its row's limit)
  const enhs = units.flatMap(u => (u._enh || []).map(x => x.e)); for(const e of uniq(enhs)) if(/one per army/i.test(e.limit || '') && enhs.filter(x => x === e).length > 1) err('enhancement ' + e.name + ' ×' + enhs.filter(x => x === e).length + ' not recognized (one per army)');
  const total = units.reduce((t, u) => t + u.pts, 0);
  if(top.limit && total > top.limit) err('points total ' + total + ' not recognized: over the ' + top.battleSize + ' limit of ' + top.limit + ' pts');
  if(top.limit && (R.costLimits || []).some(c => c.name === 'pts' && Number(c.value) !== top.limit)) err('points limit ' + R.costLimits.find(c => c.name === 'pts').value + ' not recognized: ' + top.battleSize + ' is ' + top.limit + ' pts');
  if(errors.length) return fail();
  const army = { id:opt.id || 'local', name:tn(R.name), faction:top.fac, points:top.limit, pointsUsed:gwNotes.length ? total : ptsOf(R), battleSize:top.battleSize, disposition:top.disposition, detachments:top.dets };
  // (the export's points where they are not GW's: the list has GW's, and says so, naming both)
  if(gwNotes.length) army.gwPoints = gwNotes;
  if(Object.keys(top.config).length) army.config = top.config;
  army.source = 'New Recruit, imported ' + (opt.date || '');
  B.err = err; B.D = D;
  for(const u of units) finish(B, army, u, units);
  if(errors.length) return fail();
  // identical units are one, with copies
  const sig = u => JSON.stringify(u);
  const out = [];
  for(const u of units){ const twin = out.find(x => sig(x.e) === sig(u.e)); if(twin) twin.copies = (twin.copies || 1) + 1; else out.push(u); }
  units = out;
  units.sort((a, b) => (a.ref ? 1 : 0) - (b.ref ? 1 : 0) || (ROLES.indexOf(a.role) + 1 || 99) - (ROLES.indexOf(b.role) + 1 || 99) || ((a.e.leads ? 1 : 0) - (b.e.leads ? 1 : 0)) || (a._at - b._at));
  for(const u of units) if(u.ref) refOf(B, u, units);
  units = units.concat(sheetRefs(B, units));
  for(const u of units){
    let id = [u.e.name0].concat((u.e.also || []).map(c => c.name), u.e.leads ? [u.e.leads] : []).map(slug).join('-');
    if(units.some(x => x !== u && slug(x.e.name0) === slug(u.e.name0) && (x.e.leads || null) === (u.e.leads || null))) id += u.e.enhancement ? '-' + slug(u.e.enhancement) : '';
    let k = 2; const base = id; while(units.some(x => x.id === id)) id = base + '-' + k++;
    u.id = id;
  }
  for(const u of units) if(u.ref && u.e.ref) u.e.ref.by = u.e.ref.by.id;
  army.units = units.map(u => { const e = Object.assign({ id:u.id }, u.e); delete e.name0; if(u.copies) e.copies = u.copies; return sorted(e, ORDER.unit); });
  return { ok:true, army, notes:[] };
}

// the stored entry of one unit: what the list chose, and what differs from its datasheets
const WKIND = { ranged:'BS', melee:'WS' };
function finish(B, army, u, units, out){
  const parts = u._parts, keys = u._keys, multi = parts.length > 1, P = keys.map(k => B.S[k]);
  const e = { ds:u.ds, name0:u.name }, why = {};
  for(const k of ['pts', 'ptsNote', 'enhancement', 'enhOn', 'upgrade', 'warlord', 'warlordOn', 'leads', 'also', 'support', 'models', 'unplaced', 'gear']) if(u[k] !== undefined) e[k] = u[k];
  u.e = e; u.role = P[0].role;
  // (a reference entry of the export, New Recruit's category Reference: the datasheet of a unit a rule of the list adds later)
  if(((parts[0].categories || []).find(c => c.primary) || {}).name === 'Reference'){ u.ref = true; u.role = 'Reference'; e.role = 'Reference'; why.role = { Reference:'a reference sheet (ref)' }; }
  // the selections of each part (depth first) and what they name
  const dfs = (s, f) => { f(s); for(const c of kids(s)) dfs(c, f); };
  const taken = parts.map(p => { const n = new Set(); dfs(p, s => { if(s !== p) n.add(lc(s.name)); }); return n; });
  // weapons: every weapon profile, with the number of models carrying it, as its datasheet row
  const rows = { stats:[], ranged:[], melee:[] };
  parts.forEach((p, i) => {
    const seen = new Map();
    const walk = s => { for(const c of kids(s)){
      const n = Number(c.number) || 0;
      if(c.type === 'model'){ walk(c); continue; }
      for(const prof of weaponProfiles(c)){
        const kind = weaponKind(prof), w = weaponName(prof, c);
        let hit = rowBy(P[i][kind], w.name, w.group);
        if(hit.length !== 1 && !w.group) hit = rowBy(P[i][kind], w.name, nn(c.name));
        if(hit.length !== 1){ B.err('weapon ' + nn(prof.name) + ' on unit ' + parts.map(x => nn(x.name)).join(' + ') + ' not recognized (' + (hit.length ? 'more than one' : 'no') + ' ' + kind + ' weapon of the datasheet ' + P[i].name + ' has this name)'); continue; }
        const j = P[i][kind].indexOf(hit[0]), key = kind + '|' + j;
        if(seen.has(key)) seen.get(key).n += n; else seen.set(key, { kind, j, row:hit[0], n, part:i, enh:isEnh(c), prof });
      }
      walk(c);
    } };
    // (the weapon profiles of the unit itself, "(ref. only)": the weapons models a rule adds later carry, carried by none yet)
    if(p.type === 'unit') for(const prof of weaponProfiles(p).filter(x => /\(ref\. only\)/i.test(x.name))){
      const kind = weaponKind(prof), hit = rowBy(P[i][kind], nn(prof.name), null);
      if(hit.length === 1){ const j = P[i][kind].indexOf(hit[0]); seen.set(kind + '|' + j, { kind, j, row:hit[0], n:0, part:i, ref:true }); }
    }
    walk(p);
    for(const kind of ['ranged', 'melee']) [...seen.values()].filter(x => x.kind === kind).sort((a, b) => a.j - b.j).forEach(x => rows[kind].push(x));
  });
  // stat rows: one per profile of the datasheet the models are, with how many models it is
  parts.forEach((p, i) => {
    const got = new Map();
    const own = s => (s.profiles || []).some(x => x.typeName === 'Unit');
    const add = (prof, n, onUnit) => {
      const nm = statName(prof.name).name.replace(/\s*\(ref\. only\)$/i, '');
      const hit = (P[i].stats || []).filter(r => /\(ref\. only\)/i.test(prof.name) ? lc(r.name) === lc(nm + ' (ref. only)') : lc(r.name) === lc(nm));
      if(hit.length !== 1){ B.err('model ' + nn(prof.name) + ' on unit ' + parts.map(x => nn(x.name)).join(' + ') + ' not recognized (no profile of the datasheet ' + P[i].name + ' has this name)'); return; }
      const j = P[i].stats.indexOf(hit[0]);
      if(got.has(j)){ got.get(j).n += n; got.get(j).sel++; } else got.set(j, { kind:'stats', j, row:hit[0], n, part:i, sel:1, onUnit, prof });
    };
    dfs(p, s => { for(const prof of s.profiles || []) if(prof.typeName === 'Unit') add(prof, s.type === 'unit' ? modelsOf(s).filter(m => !own(m)).reduce((t, m) => t + (Number(m.number) || 1), 0) || 1 : s.type === 'model' && s !== p ? Number(s.number) || 1 : 1, s.type === 'unit'); });
    [...got.values()].forEach(x => rows.stats.push(x));
  });
  // abilities: the datasheet's (not its Leader / Support list, which is the rule of that name; a wargear ability only with its wargear),
  // the enhancement's or upgrade's after its part's
  const abil = [];
  parts.forEach((p, i) => {
    const opts = new Set((P[i].options || []).flatMap(o => o.choices.map(c => lc(c.name))));
    for(const a of P[i].abilities || []){
      if(/^(Leader|Support)$/.test(a.name)) continue;
      if(opts.has(lc(a.name)) && !taken[i].has(lc(a.name))) continue;
      abil.push({ row:a, part:i });
    }
    for(const x of u._enh || []) if((x.e.upgrade ? parts.length - 1 : x.i) === i) abil.push({ enh:x.e, part:i });
  });
  // the "+" marks: values a rule of the list changes
  const marks = marksOf(B, army, u, parts, P, rows, abil, units);
  // write the rows: a part's row by its name, the list's fields; a datasheet's whole set of plain rows is no rows
  const who = i => multi ? P[i].name : undefined;
  const ent = {};
  for(const kind of ['stats', 'ranged', 'melee']){
    const list = rows[kind].map(x => {
      const o = { name:kind === 'stats' ? x.row.name + (x.n > 1 ? ' ×' + x.n : '') : x.row.name };
      if(kind !== 'stats'){ if(multi) o.who = who(x.part); if(x.n > 1) o.n = x.n; }
      const m = marks.get(x); if(m){ Object.assign(o, m.set); o.from = m.from; }
      const r = sorted(o, ORDER[kind]);
      if(kind !== 'stats' && x.row.group && P[x.part][kind].some(y => y !== x.row && y.name === x.row.name)) r.group = x.row.group;
      return r;
    });
    const plain = !multi && list.length === (P[0][kind] || []).length && list.every((o, i) => Object.keys(o).length === 1 && o.name === P[0][kind][i].name);
    if(!list.length){ if(!multi && (P[0][kind] || []).length) ent[kind] = null; }
    else if(!plain) ent[kind] = list;
  }
  {
    const list = abil.map(x => {
      if(x.row){ const o = { name:x.row.name }; if(multi) o.who = who(x.part); return o; }
      const o = { name:x.enh.name }; if(multi) o.who = who(x.part);
      o.tag = (x.enh.upgrade ? 'Upgrade' : 'Enhancement') + (/\(Aura\)$/.test(x.enh.name) ? ' · Aura' : '');
      const lab = ((B.D.buildIndex || {}).labels || {})[x.enh.name]; if(lab) Object.assign(o, lab);
      o.text = x.enh.text;
      return sorted(o, ORDER.abilities);
    });
    const plain = !multi && list.length === (P[0].abilities || []).length && list.every((o, i) => Object.keys(o).length === 1 && o.name === P[0].abilities[i].name);
    if(!list.length){ if(!multi && (P[0].abilities || []).length) ent.abilities = null; }
    else if(!plain) ent.abilities = list;
  }
  Object.assign(e, ent);
  // the Rules line: the datasheet's, then the rules the list's own choices bring (its enhancement's, its wargear's)
  const exRules = [], exWhy = {}, enhWhy = {};
  parts.forEach((p, i) => dfs(p, s => { for(const r of s.rules || []){ const n0 = tn(r.name); exRules.push(n0);
    if(s !== p && s.type !== 'model' && !exWhy[n0]){ const en = isEnh(s) ? B.enhOf(s.name) : null; exWhy[n0] = en ? en.name : isWeaponSel(s) ? 'its wargear (' + tn(s.name) + ')' : null; if(en) enhWhy[n0] = en.name; } } }));
  const ruleList0 = uniq(exRules), ruleList = ruleList0;
  // (a weapon ability a mark adds, SUSTAINED HITS 1: its rule, Sustained Hits)
  const markRules = [...marks.values()].flatMap(m => Object.keys(m.from)).filter(k => /^[A-Z][A-Z -]+/.test(k) && k === k.toUpperCase()).map(k => ruleOfKw(B.D, k)).filter(Boolean);
  let rules;
  if(!multi){
    const ds = P[0].rules || [], spelt = r => ds.find(x => typo(x) === typo(r)) || r;
    const extra = uniq(ruleList.map(spelt)).filter(r => !ds.includes(r));
    rules = ds.concat(extra);
    const wrows = rows.ranged.concat(rows.melee).map(x => { const m = marks.get(x); return { name:x.row.name, kw:(m && m.set.kw) || x.row.kw || [] }; });
    const w = {}; for(const r of extra){ const en = enhWhy[r] || enhWhy[typo(r)]; if(en){ w[r] = en; continue; } const hit = wrows.find(x => x.kw.some(k => lc(k).startsWith(lc(r)))); if(hit) w[r] = 'its wargear (' + hit.name + ')'; }
    if(Object.keys(w).length){ why.rules = w; e.rules = rules; }
  } else {
    // (an attached unit: its parts' rules as the export lists them, its leader's datasheet rules in GW's order)
    const order0 = P[0].rules || [], own0 = new Set(); dfs(parts[0], s => { if(s.type === 'unit' || s.type === 'model') for(const r of s.rules || []) own0.add(tn(r.name)); });
    const gwHas = r => P.some(p => (p.rules || []).some(x => typo(x) === typo(r))) || markRules.some(x => typo(x) === typo(r)) || exWhy[r];
    const ruleList = ruleList0.filter(gwHas);
    const page = r => own0.has(r) && order0.some(x => typo(x) === r);
    rules = ruleList.filter(page).sort((a, b) => order0.findIndex(x => typo(x) === a) - order0.findIndex(x => typo(x) === b)).concat(ruleList.filter(r => !page(r)));
    rules = rules.map(r => order0.find(x => typo(x) === r) || r);
    for(const p of P) for(const r of p.rules || []) if(!rules.some(x => typo(x) === typo(r))) rules.push(r);
    if(JSON.stringify(rules) !== JSON.stringify(P[0].rules || null) || catFilled(B, keys[0], 'rules')) e.rules = rules;
  }
  // keywords: the datasheets' (an attached unit's: the leader's, then what its other parts add, its Faction keywords last), the Warlord,
  // and a keyword an option of the unit names (Daemonic Allegiance: Khorne)
  const isFac = k => /^Faction: /.test(k);
  let kw = (P[0].kw || []).slice(), added = [];
  if(multi){
    const base = kw.filter(k => !isFac(k)), fac = kw.filter(isFac);
    for(const p of P.slice(1)) for(const k of p.kw || []) if(!base.includes(k) && !fac.includes(k)){ if(isFac(k)) fac.push(k); else { base.push(k); added.push(k); } }
    kw = base.concat(fac);
  }
  const kwWhy = {};
  // (an Allegiance ability names its gods in bold, "If this model has the **KHORNE** keyword": the one the export's unit has, BSData's
  // category or the option taken, that the datasheet does not print)
  parts.forEach((p, i) => { const ab = (P[i].abilities || []).find(a => /Allegiance$/.test(a.name)); if(!ab) return;
    const gods = uniq((ab.text.match(/\*\*[A-Z][A-Z ]+\*\*(?= keyword| –)/g) || []).map(m => m.replace(/\*\*/g, '')));
    const has = []; dfs(p, s => { for(const c of s.categories || []) has.push(lc(c.name)); if(s !== p && /Allegiance/.test(s.group || '')) has.push(lc(s.name)); });
    for(const g of gods){ const k = (P[i].kw || []).concat(kw).find(x => lc(x) === lc(g)) ? null : g.charAt(0) + g.slice(1).toLowerCase(); if(k && has.includes(lc(k)) && !kw.includes(k)){ kw.push(k); kwWhy[k] = ab.name + ': ' + k; } } });
  if(u.warlord){ kw.push('Warlord'); kwWhy.Warlord = 'Warlord'; }
  if(multi){ if(JSON.stringify(kw) !== JSON.stringify(P[0].kw || null) || catFilled(B, keys[0], 'kw')) e.kw = kw; if(Object.keys(kwWhy).length) why.kw = kwWhy; }
  else if(Object.keys(kwWhy).length){ e.kw = kw; why.kw = kwWhy; }
  if(multi){
    const ko = {}; P.forEach(p => Object.assign(ko, p.kwOnly || {}));
    const extra = added.filter(k => !(k in ko)).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    const body = P[P.length - 1].name;
    if(extra.length){ e.kwNote = extra.join(', ') + (extra.length > 1 ? ' come' : ' comes') + ' from the ' + (parts.length > 2 ? 'combined unit' : (u.support ? 'supported ' : 'led ') + body) + '.'; why.kwNote = (u.support ? 'supports ' : 'leads ') + body; }
    if(Object.keys(ko).length && JSON.stringify(ko) !== JSON.stringify(P[0].kwOnly || null)) e.kwOnly = ko;
    // rules only some of its models have: a datasheet ability (not a weapon's, nor an army rule, nor Leader / Support) one part has
    const armyRules = new Set(((B.F.armyRules) || []).map(r => lc(r.name)));
    const wkw = i => (P[i].ranged || []).concat(P[i].melee || []).flatMap(r => r.kw || []).map(k => k.toUpperCase());
    const pr = {};
    for(const r of uniq(P.flatMap(p => p.rules || []))){
      if(/^(Leader|Support)$/.test(r) || armyRules.has(lc(r))) continue;
      const has = P.map((p, i) => (p.rules || []).includes(r) && !wkw(i).some(k => k.startsWith(r.toUpperCase())));
      if(has.some(Boolean) && !has.every(Boolean) && !P.some((p, i) => !has[i] && (p.rules || []).some(x => typo(x) === typo(r)))) pr[r] = P.filter((p, i) => has[i]).map(p => p.name).join(' and ');
    }
    if(Object.keys(pr).length) e.partialRules = pr;
    why.ptsNote = 'the points of its parts as the list has them (' + P.map(p => p.name).join(' + ') + ')';
    if(catFilled(B, keys[0], 'role')) e.role = P[0].role;
  }
  if(Object.keys(why).length) e.why = why;
}

// a reference sheet's reason: the ability of a unit of the list whose words add a unit of its keywords ("you can add one new SPORE MINES
// unit to your army"), the sentence quoted as GW prints it
function refOf(B, u, units){
  const P = B.S[u._keys[0]], kws = (P.kw || []).filter(k => !/^Faction: /.test(k)).map(k => k.toUpperCase());
  const phrases = kws.concat(kws.flatMap(a => kws.filter(b => b !== a).map(b => a + ' ' + b)));
  const plain = t => String(t).replace(/\*\*/g, '').replace(/\^\^/g, '');
  for(const x of units){ if(x === u || x.ref) continue;
    for(const k of x._keys) for(const a of B.S[k].abilities || []){
      const sent = plain(a.text).split(/(?<=\.)\s+/).find(t => phrases.some(ph => t.includes('add one new ' + ph + ' unit')));
      if(sent){ u.e.ref = { by:x, rule:a.name, quote:sent }; return; }
    } }
}
// the datasheets a unit's own words send the player to, with no entry in the export: "use the BLUE HORRORS datasheet for this unit" (a
// reference sheet of that datasheet), and a model they add that only such a datasheet has ("add one BRIMSTONE HORROR model to this unit":
// its sheet, of the sheet whose model it replaces); each with its one model and the weapons GW gives it
function sheetRefs(B, units){
  const out = [], plain = t => String(t).replace(/\*\*/g, '').replace(/\^\^/g, '');
  const facDs = Object.keys(B.S).filter(k => B.S[k].faction === B.F_key);
  const byName = n => facDs.filter(k => lc(B.S[k].name) === lc(n));
  const byModel = n => facDs.filter(k => (B.S[k].stats || []).length === 1 && lc(B.S[k].stats[0].name) === lc(n));
  const have = k => units.concat(out).some(x => x._keys.includes(k));
  const sheet = (k, by, rule, quote, of) => {
    const S = B.S[k], gear = (S.ranged || []).concat(S.melee || []).filter(r => !r.carrier).map(r => r.group || r.name);
    const e = { ds:k, name0:S.name, role:'Reference', pts:0, ref:Object.assign({ by, rule, quote }, of ? { of } : {}), models:['1× ' + S.stats[0].name], gear:[uniq(gear)], why:{ role:{ Reference:'a reference sheet (ref)' } } };
    out.push({ e, ref:true, role:'Reference', _keys:[k], _at:1e6 + out.length });
  };
  for(const u of units.slice()) if(!u.ref) for(const k of u._keys) for(const a of B.S[k].abilities || []){
    for(const t of plain(a.text).split(/(?<=\.)\s+/)){
      const m = /use the (.+?) datasheet for this unit/.exec(t), hit = m ? byName(m[1]) : [];
      if(hit.length === 1 && !have(hit[0])) sheet(hit[0], u, a.name, t, null);
    }
  }
  for(const u of units.slice()) if(!u.ref) for(const k of u._keys) for(const a of B.S[k].abilities || []){
    for(const t of plain(a.text).split(/(?<=\.)\s+/)) for(const m of t.matchAll(/if it was an? ([A-Z][A-Z ]+?), add one ([A-Z][A-Z ]+?) model to this unit/g)){
      const hit = byModel(m[2]), from = out.find(x => lc(B.S[x._keys[0]].stats[0].name) === lc(m[1]));
      if(hit.length === 1 && from && !have(hit[0])) sheet(hit[0], u, a.name, t, B.S[from._keys[0]].name);
    }
  }
  return out;
}
// (how data.js writes an attached unit's entry, verify/tables.js: a fact of its leader's datasheet row the faction catalogue filled, because
// no list has that datasheet as a unit of its own, is written on the entry; the app gets the same unit either way)
function catFilled(B, key, f){
  const S = B.S[key]; if(!S || !S.points || S[f] === undefined) return false;
  return !(B.D.armies || []).some(a => !a.imported && a.faction === S.faction && a.units.some(x => x.name === S.name && !x.leads && !x.ref));
}
// the rule a weapon keyword is ("SUSTAINED HITS 1": Sustained Hits), as the glossary names it
function ruleOfKw(D, k){
  const names = Object.keys(D.rules || {}), u = k.toUpperCase();
  const hit = names.filter(n => u === n.toUpperCase() || u.startsWith(n.toUpperCase() + ' ') || u.startsWith(n.toUpperCase() + '-')).sort((a, b) => b.length - a.length);
  return hit[0] || null;
}

// ---------------------------------------------------------------- "+" marks: what a rule of the list does to a unit's values
// The export's profiles carry the values New Recruit shows, BSData's modifiers applied: a value (or a weapon keyword) other than the
// datasheet row's is a rule of the list at work. Its source is the one rule that reaches the unit (its enhancement or upgrade, an ability
// of its parts, a detachment or army rule) whose boxes (data.js BOXES, GW's words) give that effect, else the one the app's lists name
// for that value (BUILD_INDEX marks: the sources each value is marked with). A change no rule explains, or two explain, is refused.
const cellV = v => { const t = nn(v); return (t === '' || t === '-' || t === '–' || t === 'N/A' || t === 'undefined') ? '–' : t; };
const STAT = { M:'M', T:'T', SV:'Sv', W:'W', LD:'Ld', OC:'OC', INSV:'InSv' };
function splitList(s){ const out = []; let d = 0, cur = ''; for(const ch of String(s || '')){ if(ch === '(') d++; if(ch === ')') d--; if(ch === ',' && !d){ out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(nn).filter(x => x && x !== 'undefined'); }
const splitKw = s => splitList(s).map(x => x.replace(/^[^:]+/, y => y.toUpperCase()));
const ckHash = s => { let h = 0x811c9dc5; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
const ruleText = r => r.text + (r.table ? '\n' + r.table.map(t => t.join(': ')).join('\n') : '');
const FXF = { s:'S', a:'A', d:'D', ap:'AP' };
function marksOf(B, army, u, parts, P, rows, abil){
  const out = new Map(), boxes = B.D.boxes || {}, idx = ((B.D.buildIndex || {}).marks) || {}, E = root.WH_EFFECTS;
  // the rules that reach the unit, with their boxes
  const src = [];
  for(const x of abil){ const a = x.enh || x.row; src.push({ name:a.name, part:x.enh && x.enh.upgrade ? undefined : x.part, box:boxes['a|' + ckHash(a.name + '\n' + a.text)] }); }
  for(const d of B.dets) for(const r of [d.rule].concat(d.moreRules || [])) if(r) src.push({ name:r.name, box:boxes['r|' + ckHash(r.name + '\n' + ruleText(r))] });
  for(const r of B.F.armyRules || []) src.push({ name:r.name, box:boxes['r|' + ckHash(r.name + '\n' + ruleText(r))] });
  const fxKw = (id, p) => { const f = E && E.FX[id]; if(!f) return null; const l = f.label(p); return /^\[.*\]$/.test(l) ? l.slice(1, -1).toUpperCase() : null; };
  // a box at work on the row: no condition but what the list itself settles (its keywords, an attached leader), its weapon, its model
  const kwOf = i => (P[i].kw || []).concat(parts.length > 1 ? P.flatMap(p => p.kw || []) : []).concat(kidsKw);
  const kidsKw = []; parts.forEach(p => { const d = s => { if(/Allegiance/.test(s.group || '')) kidsKw.push(nn(s.name)); kids(s).forEach(d); }; d(p); });
  const onOk = (on, s, x) => (on || []).every(([c, v]) => c === 'selfKw' ? kwOf(x.part).some(k => lc(k) === lc(v)) : c === 'opt' ? true : c === 'leading' ? parts.length > 1 && s.part === 0 : false);
  const scoped = (bx, s, x) => { const sc = bx.scope || {}; if(sc.weapon && lc(sc.weapon) !== lc(x.row.group || x.row.name)) return false; if(sc.models === 'model' && s.part !== undefined && s.part !== x.part) return false; return true; };
  const explains = (s, kind, field, x) => {
    const b = s.box || {};
    if(kind === 'stats'){
      if(field === 'InSv') return (b.d || []).some(y => onOk(y.on, s, x) && (y.df || []).some(f => /^inv/.test(f[0])));
      return (b.st || []).some(y => onOk(y.on, s, x) && (y.st || []).some(f => f[0].toLowerCase().startsWith(field.toLowerCase())));
    }
    return (b.b || []).some(y => (y.kind === 'all' || y.kind === kind) && onOk(y.on, s, x) && scoped(y, s, x) && (y.fx || []).some(f => FXF[f[0]] === field || fxKw(f[0], f[1]) === field));
  };
  for(const kind of ['stats', 'ranged', 'melee']) for(const x of rows[kind]){
    if(!x.prof) continue;
    const c = chars(x.prof), changed = {};
    if(kind === 'stats'){ for(const k of Object.keys(c)){ const f = STAT[k.toUpperCase()]; if(f && f in x.row && cellV(c[k]) !== x.row[f]) changed[f] = cellV(c[k]); } }
    else {
      for(const [k, f] of [['Range', 'range'], ['A', 'A'], [kind === 'ranged' ? 'BS' : 'WS', kind === 'ranged' ? 'BS' : 'WS'], ['S', 'S'], ['AP', 'AP'], ['D', 'D']]) if(k in c && f in x.row && cellV(c[k]) !== x.row[f]) changed[f] = cellV(c[k]);
      const add = splitKw(c.Keywords).map(k => k.toUpperCase()).filter(k => !(x.row.kw || []).some(y => y.toUpperCase() === k));
      if(add.length) changed.kw = add;
    }
    // (GW's value where BSData's differs, declared: the export's is BSData's own, no rule at work)
    const gw = (((B.D.buildIndex || {}).gw || {})[u._keys[x.part]]) || {};
    for(const f of Object.keys(changed)) if(f !== 'kw' && gw[kind + '|' + x.row.name + '|' + f] === changed[f]) delete changed[f];
    if(!Object.keys(changed).length) continue;
    const set = {}, from = {};
    const fields = Object.keys(changed).filter(f => f !== 'kw').map(f => [f, f]).concat((changed.kw || []).map(k => [k, 'kw']));
    for(const [f, how] of fields){
      let by = uniq(src.filter(s => explains(s, kind, f, x)).map(s => s.name));
      if(by.length !== 1) by = uniq(src.filter(s => (idx[s.name] || []).includes(f)).map(s => s.name));
      if(by.length !== 1){ B.err(where(parts) + ': ' + (kind === 'stats' ? x.row.name + ' ' + f : x.row.name + ' ' + (how === 'kw' ? '[' + f + ']' : f)) + ' is changed by ' + (by.length ? 'more than one rule of the list (' + and(by) + ')' : 'a rule the app cannot name') + ': not imported'); continue; }
      if(how === 'kw'){ set.kw = (set.kw || (x.row.kw || []).slice()); set.kw.push(splitKw(c.Keywords).find(k => k.toUpperCase() === f) || f); }
      else set[f] = changed[f];
      from[how === 'kw' ? (splitKw(c.Keywords).find(k => k.toUpperCase() === f) || f) : f] = by[0];
    }
    const fk = Object.keys(from), from2 = {};
    fk.filter(k => !ORDER[kind].includes(k)).concat(ORDER[kind].filter(k => fk.includes(k))).forEach(k => { from2[k] = from[k]; });
    if(fk.length) out.set(x, { set, from:from2 });
  }
  return out;
}
const where = parts => 'unit ' + parts.map(p => nn(p.name)).join(' + ');

// ================================================================ the input formats
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
// ("ATTACHED UNITS / CHARACTERS / OTHER DATASHEETS") is not taken.
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
// own lists' units (a faction without a catalogue: import.js copies it) whose datasheets, points, enhancement, Warlord and every model's
// weapons and wargear are the text's, written back as the selections BSData's ids give it (data.js BS_IDS). Any line that is not exactly
// one thing refuses the whole import, naming the line.
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
  if(catalogued(D, fac)){ err('faction ' + F.name + ': a text export names no values, and ' + F.name + ' lists are built from its catalogue with the values their rules change: import its .json, .ros or .rosz export'); return null; }
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

const api = { build, parse, parseSync, detect, catalogued, catalogues, malformed, nn, typo, slug };
root.WH_BUILDER = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
