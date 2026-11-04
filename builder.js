/* builder.js: a list, built from New Recruit's export and data.js alone. The app (app.html, through import.js) and the gate
   (verify/build-parity.js) run this same file; it reads no file and asks no network (browser and Node alike).

   WH_BUILDER.build(exportJson, WH_DATA, { id, date }) → { ok:true, army, notes } | { ok:false, errors:[...] }
     army: the list as data.js stores it (ARMIES: each unit entry names its datasheet and holds only what the list chose); the app
     joins it with DATASHEETS as for its own lists (WH_DATA.resolve). Built only for a faction with a full catalogue in data.js (every
     datasheet and detachment: DATASHEETS rows with points); a list of another faction is refused here (import.js copies it).
   (The input formats, .ros, .rosz and New Recruit's text formats, are read into the export's shape by import.js.)

   Deterministic (the date is an input). Nothing shown is the export's: names, values and counts are GW's tables' and the rules', the
   export says only what was selected, and a value it shows is compared with the one worked out (a difference refuses it). */
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
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const and = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const ROLES = ['Epic Hero', 'Character', 'Battleline', 'Dedicated Transport', 'Infantry', 'Mounted', 'Beast', 'Swarm', 'Vehicle', 'Monster', 'Fortification'];
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
// a weapon profile of the export: its datasheet row (by name and group, exact but for case and apostrophes), or null
function rowOfProf(S, prof, sel){
  const kind = weaponKind(prof), w = weaponName(prof, sel);
  let hit = rowBy(S[kind], w.name, w.group);
  if(hit.length !== 1 && !w.group) hit = rowBy(S[kind], w.name, nn(sel.name));
  return hit.length === 1 ? { kind, row:hit[0] } : null;
}
const choiceOf = (S, name) => (S.options || []).flatMap(o => o.choices).find(c => lc(c.name) === lc(name)) || null;
// one model line's weapons (each as often as one model carries it) and its other wargear, named as GW's datasheet names them
function gearOf(m, per, S){
  const weapons = [], wargear = [], bundles = [];
  const walk = s => {
    for(const c of kids(s)){
      if(c.type === 'model' || isWarlord(c) || (isEnh(c) && !isWeaponSel(c))) continue;
      const n = Number(c.number) || 0;
      if(isWeaponSel(c)){ const names = uniq(weaponProfiles(c).map(p => { const r = rowOfProf(S, p, c); return r ? r.row.group || r.row.name : null; }).filter(Boolean)); for(const w of names) for(let k = 0; k < Math.round(n / per); k++) weapons.push(typo(w)); }
      else if(kids(c).some(isWeaponSel)) bundles.push(c);
      else { const ch = choiceOf(S, c.name); if(ch) wargear.push(tn(ch.name)); }
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
  const named = parts.length > 1, where = parts.map(p => nn(p.name)).join(' + ');
  const keys = parts.map(p => B.dsOf(p));
  keys.forEach((k, i) => { if(!k) err('unit ' + nn(parts[i].name) + ' not recognized (no datasheet of the ' + B.F.name + ' catalogue has its BSData id)'); });
  if(keys.some(k => !k)) return null;
  // (every name the list shows is GW's datasheet's: a part by its datasheet, a model by the datasheet's composition)
  const pName = p => B.S[keys[parts.indexOf(p)]].name;
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
    if(isWarlord(c)){ u.warlord = true; u._wl = i; if(i > 0 && i < parts.length - 1) u.warlordOn = pName(p); }
    dfs(c); } }; dfs(p); });
  u._support = g.chars.map(c => !!c.support);
  if(named){ u.leads = pName(g.body); if(g.chars[0].support) u.support = true; if(g.chars.length > 1) u.also = g.chars.slice(1).map(c => Object.assign({ name:pName(c.s) }, c.support ? { support:true } : {})); }
  // models lines and their gear; wargear on the unit itself (no model's) is unplaced, or a model's the export associates it with
  const models = [], gear = [], unplaced = [];
  for(const p of parts){
    const lines = [];
    // (a datasheet with no composition, a reference sheet's: its model by its profile's name)
    const S = B.S[keys[parts.indexOf(p)]], comp = S.composition || (S.stats || []).map(r => ({ model:r.name }));
    for(const m of modelsOf(p)){ const n = m === p ? 1 : Number(m.number) || 1; const g2 = gearOf(m, n, S);
      const c = comp.find(x => lc(x.model) === lc(m.name)) || (m === p && comp.length === 1 ? comp[0] : null);
      if(!c){ err('model ' + nn(m.name) + ' on unit ' + where + ' not recognized (GW’s datasheet ' + S.name + ' has ' + (comp.length ? and(comp.map(x => x.model)) : 'no composition') + ')'); continue; }
      lines.push({ n, name:tn(c.model), wargear:g2.wargear, weapons:g2.weapons, sel:m, comp:c }); }
    if(p.type !== 'model') for(const c of kids(p)) if(c.type !== 'model' && !isEnh(c) && !isWarlord(c) && !kids(c).some(x => x.type === 'model')){
      const k = Number(c.number) || 1, to = (c.associations || []).filter(a => a.type === 'outgoing').map(a => lines.find(l => l.sel && l.sel.id === a.to)).find(Boolean);
      if(isWeaponSel(c)){
        const ws = uniq(weaponProfiles(c).map(x => { const r = rowOfProf(S, x, c); return r ? r.row.group || r.row.name : null; }).filter(Boolean)).map(typo);
        if(to && k === to.n){ to.weapons.push(...ws); continue; }
        unplaced.push(...ws); continue;
      }
      const ch = choiceOf(S, c.name); if(!ch) continue;   // (refused below: not an option of the datasheet)
      if(to){
        if(to.n > k){ to.n -= k; to.splits = (to.splits || 0) + 1; lines.splice(lines.indexOf(to) + to.splits, 0, { n:k, name:to.name, wargear:to.wargear.concat(tn(ch.name)), weapons:to.weapons.slice() }); }
        else to.wargear.push(tn(ch.name));
        continue;
      }
      unplaced.push(tn(ch.name));
    }
    for(const l of lines){ models.push(l.n + '× ' + l.name + (l.wargear.length ? ' (' + l.wargear.join(', ') + ')' : '')); gear.push(l.weapons); }
  }
  u.models = models; if(unplaced.length) u.unplaced = unplaced; u.gear = gear;
  // every other choice is one of its datasheet's options (BSData's, DATASHEETS options)
  parts.forEach((p, i) => { const S = B.S[keys[i]], opts = new Set((S.options || []).flatMap(o => o.choices.map(c => lc(c.name))));
    const d = s => { for(const c of kids(s)){ if(c.type !== 'model' && !isEnh(c) && !isWarlord(c) && !isWeaponSel(c) && !opts.has(lc(c.name)) && S.options) err('option ' + nn(c.name) + ' on unit ' + where + ' not recognized (not an option of GW’s datasheet ' + S.name + ')'); d(c); } }; d(p); });
  legalWargear(B, parts, keys, where, err);
  u._parts = parts; u._keys = keys; u._at = g.at;
  return u;
}

// ---------------------------------------------------------------- what GW's datasheet allows: its models and its wargear options
// (DATASHEETS composition and options, BSData's as the faction catalogue has them; Core Rules 25.04: "Your army roster must follow all
// restrictions placed on it by the rules and units being included in it")
function legalWargear(B, parts, keys, where, err){
  const R = 'GW’s datasheet ';
  parts.forEach((p, i) => {
    const S = B.S[keys[i]], comp = S.composition || (S.stats || []).map(r => ({ model:r.name, min:0, max:null })), opts = S.options || [];
    const ms = modelsOf(p), cnt = {};
    for(const m of ms){ const c = comp.find(x => lc(x.model) === lc(m.name)) || (m === p && comp.length === 1 ? comp[0] : null); if(c) cnt[c.model] = (cnt[c.model] || 0) + (m === p ? 1 : Number(m.number) || 0); }
    // models: each kind between its min and max, each group's together between theirs
    for(const c of comp){ const n = cnt[c.model] || 0;
      let max = c.max; if(c.maxIf && (c.maxIf.atLeast || []).every(a => (cnt[a.model] || 0) >= a.n)) max = c.maxIf.max;
      if(n < c.min || (max != null && n > max)) err('unit ' + where + ' not imported: ' + n + ' ' + c.model + (n === 1 ? '' : ' models') + ' (' + R + S.name + ': ' + c.min + (max !== c.min ? '–' + max : '') + ')'); }
    for(const gname of uniq(comp.filter(c => c.groupMin != null).map(c => c.group))){ const g = comp.filter(c => c.group === gname), n = g.reduce((t, c) => t + (cnt[c.model] || 0), 0), c0 = g[0];
      if(n < c0.groupMin || n > c0.groupMax) err('unit ' + where + ' not imported: ' + n + ' models of ' + gname + ' (' + R + S.name + ': ' + c0.groupMin + '–' + c0.groupMax + ')'); }
    // wargear: on each model (per model, the same for every model of a line) and on the unit, each choice and each group within its limits
    const lastSeg = g => String(g || '').split('::').pop();
    const optFor = (on, sel) => { const c = opts.filter(o => (lc(o.on) === lc(on)) && o.choices.some(x => lc(x.name) === lc(sel.name)));
      return c.find(o => lc(o.group || '') === lc(lastSeg(sel.group))) || (c.length === 1 ? c[0] : c.find(o => !o.group) || c[0]) || null; };
    const check = (on, holder, n, label) => {
      const taken = new Map();
      for(const c of kids(holder)){
        if(c.type === 'model' || isEnh(c) || isWarlord(c) || kids(c).some(x => x.type === 'model')) continue;
        const o = optFor(on, c);
        if(!o){ if(isWeaponSel(c) || choiceOf(S, c.name)) err('option ' + nn(c.name) + ' on ' + label + ' not imported (' + R + S.name + ' does not give it to ' + (on === 'unit' ? 'the unit' : on) + ')'); continue; }
        const k = Number(c.number) || 0;
        if(on !== 'unit' && k % n){ err('option ' + k + '× ' + nn(c.name) + ' on ' + label + ' not imported: ' + n + ' models, each equipped alike (' + R + S.name + ')'); continue; }
        const ch = o.choices.find(x => lc(x.name) === lc(c.name)), per = on === 'unit' ? k : k / n;
        taken.set(o, (taken.get(o) || new Map()).set(ch, ((taken.get(o) || new Map()).get(ch) || 0) + per));
      }
      for(const o of opts.filter(o => lc(o.on) === lc(on))){
        const t = taken.get(o) || new Map(), sum = [...t.values()].reduce((a, b) => a + b, 0), each = on === 'unit' ? '' : ' each';
        for(const ch of o.choices){ const k = t.get(ch) || 0;
          if((ch.min != null && k < ch.min) || (ch.max != null && k > ch.max)) err('unit ' + where + ' not imported: ' + label + ' has ' + k + ' ' + ch.name + each + ' (' + R + S.name + ': ' + (ch.min || 0) + (ch.max != null && ch.max !== ch.min ? '–' + ch.max : ch.max == null ? ' or more' : '') + ')'); }
        if((o.min != null && sum < o.min) || (o.max != null && sum > o.max)) err('unit ' + where + ' not imported: ' + label + ' has ' + sum + ' of ' + and(o.choices.map(c => c.name)) + each + ' (' + R + S.name + (o.group ? ', ' + o.group : '') + ': ' + (o.min || 0) + (o.max !== o.min ? '–' + o.max : '') + ')'); }
    };
    for(const m of ms){ const c = comp.find(x => lc(x.model) === lc(m.name)) || (m === p && comp.length === 1 ? comp[0] : null); if(c) check(c.model, m, m === p ? 1 : Number(m.number) || 1, (m === p ? '' : (Number(m.number) || 1) + '× ') + c.model); }
    if(p.type !== 'model') check('unit', p, 1, S.name);
  });
}

// ---------------------------------------------------------------- the roster as GW's rules allow it (Core Rules 19.01, 25.03, 25.04)
// an enhancement's own restriction, its first sentence ("**NORN ASSIMILATOR** unit only.", "**TYRANIDS** model only (excluding **MONSTERS**
// models).", "**A**/**B** unit only.", "… model with the **Deep Strike** ability only."): the keywords it names, against the unit's
function enhAllows(e, kws, rules){
  const lead = (/^(.*?\bonly\b[^.]*)\./.exec(String(e.text)) || [])[1]; if(!lead) return true;
  const K = kws.map(k => nn(k).replace(/^Faction: /i, '').toUpperCase());
  const has = (phrase, plural) => { const W = nn(phrase).toUpperCase().split(' ').filter(Boolean);
    const can = i => i === W.length || K.some(k => { const kw = k.split(' '); return kw.every((x, j) => W[i + j] === x || (plural && j === kw.length - 1 && W[i + j] === x + 'S')) && can(i + kw.length); });
    return can(0); };
  const main = lead.replace(/\(excluding[^)]*\)/g, '').replace(/ with the \*\*[^*]+\*\* ability/g, '');
  const alts = (main.match(/\*\*[^*]+\*\*/g) || [main.replace(/\s*(model|unit)s?\b.*$/, '')]).map(x => x.replace(/\*\*/g, ''));
  if(!alts.some(x => has(x))) return false;
  for(const m of lead.matchAll(/\(excluding ([^)]*)\)/g)) for(const x of (m[1].match(/\*\*[^*]+\*\*/g) || []).map(y => y.replace(/\*\*/g, ''))) if(has(x, true)) return false;
  for(const m of lead.matchAll(/ with the \*\*([^*]+)\*\* ability/g)) if(!rules.some(r => lc(r).startsWith(lc(m[1])))) return false;
  return true;
}
function rosterLegal(B, D, top, units, groups, err){
  const BS = (((D.buildIndex || {}).battleSizes) || {})[top.battleSize], UPG = ((D.buildIndex || {}).upgrades) || {};
  const kwOf = (u, i) => { const k = (B.S[u._keys[i]].kw || []).slice(); const d = s => { for(const c of kids(s)){ if(/Allegiance/.test(c.group || '')) k.push(nn(c.name)); d(c); } }; d(u._parts[i]); return k; };
  const hasKw = (ks, k) => ks.some(x => lc(x) === lc(k));
  // attached as GW's datasheets allow: a Leader joins by its Leader ability, a Support unit by its Support ability; one of each (19.01)
  for(const u of units) if(u._parts.length > 1){
    const body = B.S[u._keys[u._keys.length - 1]];
    u._parts.slice(0, -1).forEach((p, i) => {
      const S = B.S[u._keys[i]], kind = u._support[i] ? 'Support' : 'Leader', ab = (S.abilities || []).find(a => a.name === kind);
      const may = ab ? splitList(String(ab.text).replace(/^[^:]*:/, '').replace(/\*\*/g, '')) : [];
      if(!may.map(lc).includes(lc(body.name))) err('leader attachment ' + S.name + ' + ' + body.name + ' not imported: ' + (ab ? S.name + ' can be attached to ' + and(may) : 'GW’s datasheet of ' + S.name + ' has no ' + kind + ' ability, so it cannot ' + (kind === 'Leader' ? 'lead' : 'support') + ' a unit') + ' (Core Rules 19.01)');
    });
    for(const kind of [false, true]){ const n = u._support.slice(0, -0 || undefined).filter((x, i) => i < u._parts.length - 1 && x === kind).length;
      if(n > 1) err('leader attachment ' + u._keys.map(k => B.S[k].name).join(' + ') + ' not imported: each bodyguard unit can only have one ' + (kind ? 'support' : 'leader') + ' unit attached to it (Core Rules 19.01)'); }
  }
  for(const u of units) if(u._parts.length === 1){ const S = B.S[u._keys[0]];
    if((S.abilities || []).some(a => a.name === 'Support') && !(S.abilities || []).some(a => a.name === 'Leader')) err('unit ' + S.name + ' not imported: each support unit in your roster must be attached to a bodyguard unit (Core Rules 25.04)'); }
  // the Warlord: one CHARACTER model
  const wl = units.filter(u => u.warlord);
  if(wl.length !== 1) err('warlord not recognized: ' + (wl.length ? wl.length + ' units are the Warlord (' + and(wl.map(u => u.name)) + ')' : 'no unit is the Warlord') + ' (Core Rules 25.04, Select Units: select one CHARACTER unit to be your Warlord’s unit)');
  for(const u of wl){ const S = B.S[u._keys[u._wl || 0]]; if(!hasKw(kwOf(u, u._wl || 0), 'Character')) err('warlord ' + S.name + ' not imported: the Warlord must be a CHARACTER model (Core Rules 25.04, Select Units)'); }
  // enhancements: a CHARACTER's, not an EPIC HERO's (an Upgrade: any unit's), each as its words allow; one per unit; no two of one (an
  // Upgrade: up to three); no more than the battle size allows
  const isUpg = e => !!e.upgrade || !!UPG[e.name];
  const all = [];
  for(const u of units){
    if((u._enh || []).length > 1) err('unit ' + u._keys.map(k => B.S[k].name).join(' + ') + ' not imported: ' + and(u._enh.map(x => x.e.name)) + ': no unit (including attached units) can have more than one enhancement (Core Rules 25.04)');
    for(const x of u._enh || []){
      const upg = isUpg(x.e), i = upg ? u._parts.length - 1 : x.i, S = B.S[u._keys[i]], ks = upg ? u._keys.flatMap((k, j) => kwOf(u, j)) : kwOf(u, i);
      all.push(x.e);
      if(!upg && !hasKw(ks, 'Character')) err('enhancement ' + x.e.name + ' on ' + S.name + ' not imported: only CHARACTER units can be given enhancements (Core Rules 25.04, Select Enhancements)');
      else if(!upg && hasKw(ks, 'Epic Hero')) err('enhancement ' + x.e.name + ' on ' + S.name + ' not imported: EPIC HERO models cannot be given enhancements (Core Rules 25.04, Select Enhancements)');
      else if(!enhAllows(x.e, ks, u._keys.flatMap(k => B.S[k].rules || []))) err('enhancement ' + x.e.name + ' on ' + S.name + ' not imported: GW’s enhancement says “' + String(x.e.text).replace(/\*\*/g, '').split(/(?<=only[^.]*\.)/)[0] + '”');
    }
  }
  for(const e of uniq(all)){ const n = all.filter(x => x === e).length, max = isUpg(e) ? 3 : 1;
    if(n > max) err('enhancement ' + e.name + ' ×' + n + ' not imported: ' + (max === 1 ? 'your army cannot include more than one of the same enhancement' : 'you can include up to three of the same Upgrade') + ' (Core Rules 25.04, Select Enhancements)'); }
  if(BS){
    // (an Upgrade counts once: only its second and third instances are not counted, Core Rules 25.04)
    const enh = all.filter(e => !isUpg(e)).length + uniq(all.filter(isUpg)).length;
    if(enh > BS.enhancements) err(enh + ' enhancements not imported: ' + top.battleSize + '’s enhancement limit is ' + BS.enhancements + ' (Core Rules 25.03; 25.04: the second and third instances of the same Upgrade do not count towards it)');
    // detachments: their Detachment Points within the battle size's
    const dp = top.dets.reduce((t, d) => t + (Number(B.F.detachments[d].dp) || 0), 0);
    if(dp > BS.dp) err('detachments ' + and(top.dets.map(d => B.F.detachments[d].name)) + ' (' + dp + ' DP) not imported: ' + top.battleSize + ' has ' + BS.dp + ' DP (Core Rules 25.03, 25.04)');
    // units with the same datasheet name: the unit limit (BATTLELINE and DEDICATED TRANSPORT double; every EPIC HERO 1)
    const n = {}; for(const u of units.filter(x => !((x._parts[0].categories || []).some(c => c.primary && c.name === 'Reference')))) u._keys.forEach(k => { n[k] = (n[k] || 0) + 1; });
    for(const k of Object.keys(n)){ const S = B.S[k], ks = S.kw || [];
      const max = hasKw(ks, 'Epic Hero') ? 1 : hasKw(ks, 'Battleline') || hasKw(ks, 'Dedicated Transport') ? 2 * BS.units : BS.units;
      if(n[k] > max) err(n[k] + '× ' + S.name + ' not imported: ' + (hasKw(ks, 'Epic Hero') ? 'every EPIC HERO has a unit limit of 1' : top.battleSize + '’s unit limit for ' + S.name + ' is ' + max) + ' (Core Rules 25.03)'); }
  }
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
  rosterLegal(B, D, top, units, groups, err);
  const total = units.reduce((t, u) => t + u.pts, 0);
  if(top.limit && total > top.limit) err('points total ' + total + ' not recognized: over the ' + top.battleSize + ' limit of ' + top.limit + ' pts');
  if(top.limit && (R.costLimits || []).some(c => c.name === 'pts' && Number(c.value) !== top.limit)) err('points limit ' + R.costLimits.find(c => c.name === 'pts').value + ' not recognized: ' + top.battleSize + ' is ' + top.limit + ' pts');
  if(errors.length) return fail();
  const army = { id:opt.id || 'local', name:tn(R.name), faction:top.fac, points:top.limit, pointsUsed:gwNotes.length ? total : ptsOf(R), battleSize:top.battleSize, disposition:top.disposition, detachments:top.dets };
  // (the export's points where they are not GW's: the list has GW's, and says so, naming both)
  if(gwNotes.length) army.gwPoints = gwNotes;
  if(Object.keys(top.config).length) army.config = top.config;
  army.source = 'New Recruit, imported ' + (opt.date || '');
  B.err = err; B.D = D; B.RA = ruleAbilities(D.grants, D.ruleOptions, B.F, B.dets);
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
  const abil = [];
  parts.forEach((p, i) => {
    const opts = new Set((P[i].options || []).flatMap(o => o.choices.map(c => lc(c.name))));
    for(const a of P[i].abilities || []){
      if(/^(Leader|Support)$/.test(a.name)) continue;
      if(opts.has(lc(a.name)) && !taken[i].has(lc(a.name))) continue;
      abil.push({ row:a, part:i });
    }
    // (an ability a rule of the list gives it: its own row, marked with the rule, wherever the rule is in force and the part has its
    // keywords, whatever the export prints; ruleAbilities)
    for(const g of ruleAbilitiesOf(B.RA, P[i].kw, P[i].abilities)) abil.push({ granted:g, part:i });
    for(const f of B.RA.errors) if(meetsTo(f.to, P[i].kw)) B.err('unit ' + parts.map(x => nn(x.name)).join(' + ') + ' not imported: ' + f.error);
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
      if(x.granted){ const o = Object.assign({}, x.granted.row); if(multi) o.who = who(x.part); return sorted(o, ORDER.abilities); }
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
  // (a rule the export names is shown only if the tables name it: a datasheet's Rules line, the glossary, an army rule)
  const known = B.known || (B.known = (() => { const m = new Map(); for(const S of Object.values(B.D.datasheets)) for(const r of S.rules || []) if(!m.has(typo(r))) m.set(typo(r), r);
    for(const r of Object.keys(B.D.rules || {}).concat((B.F.armyRules || []).map(x => x.name))) if(!m.has(typo(r))) m.set(typo(r), r); return m; })());
  // (one no table names, a BSData rule GW's datasheet does not print: not shown)
  const ruleList0 = uniq(exRules).filter(r => known.has(typo(r))).map(r => known.get(typo(r)) === r || typo(known.get(typo(r))) === r ? r : known.get(typo(r))), ruleList = ruleList0;
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
  const isFac = k => /^Faction: /.test(k);
  let kw = (P[0].kw || []).slice(), added = [];
  if(multi){
    const base = kw.filter(k => !isFac(k)), fac = kw.filter(isFac);
    for(const p of P.slice(1)) for(const k of p.kw || []) if(!base.includes(k) && !fac.includes(k)){ if(isFac(k)) fac.push(k); else { base.push(k); added.push(k); } }
    kw = base.concat(fac);
  }
  const kwWhy = {};
  // (an Allegiance ability names its gods in bold, "If this model has the **KHORNE** keyword": the one the export's unit has, BSData's
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
function catFilled(B, key, f){
  const S = B.S[key]; if(!S || !S.points || S[f] === undefined) return false;
  return !(B.D.armies || []).some(a => !a.imported && a.faction === S.faction && a.units.some(x => x.name === S.name && !x.leads && !x.ref));
}
// the abilities the rules a list has in force give its units by keyword, each its own row, marked with the rule that gives it (the
// owner's rule, 4 Nov 2026: derived from GW's rule text and the unit's keywords wherever that rule is in force, never from what an export
// prints): an army rule of the faction or a rule of one of the list's detachments that gives units of these keywords "the following
// ability" (or abilities), with no condition (GRANTS, type ability: Higher Imperatives' Protean Purpose to NORN EMISSARY/NORN ASSIMILATOR
// units, Daughters of the Abyss' Psychic Null (Aura) to ANATHEMA PSYKANA units, Mission Tactics' Furor, Malleus and Purgatus Tactics to
// KILL TEAM units). Its words are GW's in the rule itself: the words RULE_OPTIONS reads for the option of that name, found in the rule's
// text right after the ability's bold name, exactly once (apostrophes aside; the rule's own characters are quoted). One that cannot be
// found so is an error, never a guess. (A core ability a rule gives, "have the Feel No Pain 6+ ability", prints no words of its own: not
// one of these.) verify/tables.js, verify/from-json.js and verify/catalog.js read them with this same function.
//   { rows:[{ name, rule (GRANTS' key), to, row:{ name, tag, ph, turn, turns, text } }], errors:[{ to, error }] }
// tag: the rule's name, then the limit GW prints before the words ("(Once per battle, per unit) …"), then Aura where GW's name says
// "(Aura)", as an enhancement's tag names it: "Higher Imperatives · Once per battle, per unit", "Daughters of the Abyss · Aura"
const RULE_AB = /\bthe following abilit(?:y|ies)\b/i;
function ruleAbilities(grants, options, F, dets){
  const out = { rows:[], errors:[] }; if(!F) return out;
  const inForce = new Map();
  for(const r of F.armyRules || []) inForce.set(F.name + ' army rule · ' + r.name, r);
  for(const d of dets || []) if(d) for(const r of [d.rule].concat(d.moreRules || []).filter(Boolean)) inForce.set(F.name + ' · ' + d.name + ' rule · ' + r.name, r);
  const ap = s => String(s).replace(/[’‘]/g, "'");
  for(const g of grants || []){
    if(g.type !== 'ability' || g.option || g.while != null || !g.to || typeof g.to !== 'object' || !RULE_AB.test(g.text || '') || !inForce.has(g.rule)) continue;
    const r = inForce.get(g.rule), opts = (options || []).filter(o => o.rule === g.rule && o.option === g.grants);
    const no = why => out.errors.push({ to:g.to, error:'the ability ' + g.grants + ' that ' + r.name + ' gives ' + kwWords(g.to) + ' units: ' + why + ' (never guessed): not built' });
    if(opts.length !== 1){ no(opts.length ? 'more than one set of words for it in the rule' : 'its words are not read from the rule (RULE_OPTIONS has no option of that name)'); continue; }
    const t = ruleText(r), T = ap(t), w = ap(opts[0].text), esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const head = new RegExp('\\*\\*' + esc(ap(g.grants)) + '(?::\\*\\*|\\*\\*:?)\\s*$');
    const at = []; for(let i = T.indexOf(w); i >= 0 && w; i = T.indexOf(w, i + 1)) if(head.test(T.slice(0, i))) at.push(i);
    if(at.length !== 1){ no(at.length ? 'its words are in the rule more than once' : 'its words are not in the rule’s text after its name'); continue; }
    const text = t.slice(at[0], at[0] + w.length), lim = /^\(([^()]+)\)\s/.exec(text);
    const row = { name:g.grants, tag:[r.name, lim ? lim[1] : '', /\(Aura\)$/.test(g.grants) ? 'Aura' : ''].filter(Boolean).join(' · ') };
    const ph = opts[0].phases || {}; if(ph.ph && ph.ph.length){ row.ph = ph.ph; row.turn = ph.turn; if(ph.turns) row.turns = ph.turns; }
    row.text = text;
    out.rows.push({ name:g.grants, rule:g.rule, to:g.to, row:sorted(row, ORDER.abilities) });
  }
  return out;
}
const kwWords = to => [to.all && to.all.join(' '), to.any && to.any.join('/')].filter(Boolean).join(' ').replace(/^Faction: /, '').toUpperCase() + (to.none && to.none.length ? ' (excluding ' + to.none.join('/').toUpperCase() + ')' : '');
const meetsTo = (to, kw) => { const has = k => (kw || []).some(x => lc(x) === lc(k));
  return (to.all || []).every(has) && (!to.any || to.any.some(has)) && !(to.none || []).some(has); };
// the rule in force that gives a list's row (one of ruleAbilities' rows): its tag names the rule first and its words are in the rule's
// text (apostrophes aside). Such a row's words are the rule's: verify/derive.js and verify/effects-migrate.js read them as the rule's
// (its options, grants and boxes), never as a source of their own, so nothing is counted twice
function ruleOfRow(F, dets, ab){
  if(!F || !ab || !ab.tag || typeof ab.text !== 'string') return null;
  const n = String(ab.tag).split(' · ')[0], ap = s => String(s).replace(/[’‘]/g, "'");
  const rs = (F.armyRules || []).concat(...(dets || []).filter(Boolean).map(d => [d.rule].concat(d.moreRules || []).filter(Boolean)));
  return rs.find(r => r.name === n && ap(ruleText(r)).includes(ap(ab.text))) || null;
}
// a unit part's rows of them: those whose keywords it has and its datasheet does not already have
const ruleAbilitiesOf = (RA, kw, own) => RA.rows.filter(x => meetsTo(x.to, kw) && !(own || []).some(a => a.name === x.name));
// the rule a weapon keyword is ("SUSTAINED HITS 1": Sustained Hits), as the glossary names it
function ruleOfKw(D, k){
  const names = Object.keys(D.rules || {}), u = k.toUpperCase();
  const hit = names.filter(n => u === n.toUpperCase() || u.startsWith(n.toUpperCase() + ' ') || u.startsWith(n.toUpperCase() + '-')).sort((a, b) => b.length - a.length);
  return hit[0] || null;
}

// ---------------------------------------------------------------- "+" marks: what a rule of the list does to a unit's values
// The export's profiles carry the values New Recruit shows, BSData's modifiers applied: a value (or a weapon keyword) other than the
const cellV = v => { const t = nn(v); return (t === '' || t === '-' || t === '–' || t === 'N/A' || t === 'undefined') ? '–' : t; };
const STAT = { M:'M', T:'T', SV:'Sv', W:'W', LD:'Ld', OC:'OC', INSV:'InSv' };
function splitList(s){ const out = []; let d = 0, cur = ''; for(const ch of String(s || '')){ if(ch === '(') d++; if(ch === ')') d--; if(ch === ',' && !d){ out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(nn).filter(x => x && x !== 'undefined'); }
const splitKw = s => splitList(s).map(x => x.replace(/^[^:]+/, y => y.toUpperCase()));
const ckHash = s => { let h = 0x811c9dc5; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
const ruleText = r => r.text + (r.table ? '\n' + r.table.map(t => t.join(': ')).join('\n') : '');
const FXF = { s:'S', a:'A', d:'D', ap:'AP' };
function marksOf(B, army, u, parts, P, rows, abil){
  // (the boxes as the app counts them, the two-reader rule: a box data.js AGREE does not confirm names no value, effects.js agreed)
  const E = root.WH_EFFECTS, out = new Map(), boxes = E && E.agreed ? E.agreed(B.D.boxes || {}, B.D.agree) : {}, idx = ((B.D.buildIndex || {}).marks) || {};
  // the rules that reach the unit, with their boxes
  const src = [];
  for(const x of abil){ const a = x.enh || x.row || x.granted.row; src.push({ name:a.name, part:x.enh && x.enh.upgrade ? undefined : x.part, box:boxes['a|' + ckHash(a.name + '\n' + a.text)] }); }
  for(const d of B.dets) for(const r of [d.rule].concat(d.moreRules || [])) if(r) src.push({ name:r.name, box:boxes['r|' + ckHash(r.name + '\n' + ruleText(r))] });
  for(const r of B.F.armyRules || []) src.push({ name:r.name, box:boxes['r|' + ckHash(r.name + '\n' + ruleText(r))] });
  const fxKw = (id, p) => { const f = E && E.FX[id]; if(!f) return null; const l = f.label(p); return /^\[.*\]$/.test(l) ? l.slice(1, -1).toUpperCase() : null; };
  // a box at work on the row: no condition but what the list itself settles (its keywords, an attached leader), its weapon, its model
  const kwOf = i => (P[i].kw || []).concat(parts.length > 1 ? P.flatMap(p => p.kw || []) : []).concat(kidsKw);
  const kidsKw = []; parts.forEach(p => { const d = s => { if(/Allegiance/.test(s.group || '')) kidsKw.push(nn(s.name)); kids(s).forEach(d); }; d(p); });
  const onOk = (on, s, x) => (on || []).every(([c, v]) => c === 'selfKw' ? kwOf(x.part).some(k => lc(k) === lc(v)) : c === 'opt' ? true : c === 'leading' ? parts.length > 1 && s.part === 0 : false);
  const scoped = (bx, s, x) => { const sc = bx.scope || {}; if(sc.weapon && lc(sc.weapon) !== lc(x.row.group || x.row.name)) return false; if(sc.models === 'model' && s.part !== undefined && s.part !== x.part) return false; return true; };
  // what a source does to a row's field: its boxes' effect ({ add }, { set }, 'kw'), else the effect BUILD_INDEX.marks records for it
  const ST = { mAdd:['M', 1], ocAdd:['OC', 1], ldAdd:['Ld', 1], tAdd:['T', 1], wAdd:['W', 1] };
  const opOf = (s, kind, field, x) => {
    const b = s.box || {}, ops = [];
    if(kind === 'stats'){
      for(const y of b.d || []) if(onOk(y.on, s, x)) for(const f of y.df || []) if(field === 'InSv' && f[0] === 'inv') ops.push({ set:f[1] + '+' }); else if(field === 'InSv' && f[0] === 'invRanged') ops.push({ ranged:f[1] });
      for(const y of b.st || []) if(onOk(y.on, s, x)) for(const f of y.st || []) if(ST[f[0]] && ST[f[0]][0] === field) ops.push({ add:+f[1] });
    } else for(const y of b.b || []) if((y.kind === 'all' || y.kind === kind) && onOk(y.on, s, x) && scoped(y, s, x)) for(const f of y.fx || []){
      if(FXF[f[0]] === field) ops.push({ add:f[0] === 'ap' ? -f[1] : +f[1] }); else if(fxKw(f[0], f[1]) === field) ops.push('kw'); }
    return ops.length ? ops : null;
  };
  const apply = (base, op) => {
    if(op === 'kw') return true;
    if(op.set !== undefined) return op.set;
    if(op.ranged !== undefined) return (base === '–' ? '' : base + ', ') + op.ranged + '+*';
    const m = /^(-?\d+)("?)$/.exec(String(base)); return m ? (+m[1] + op.add) + m[2] : null;
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
    const set = {}, from = {}, label = (f, how) => where(parts) + ': ' + x.row.name + ' ' + (how === 'kw' ? '[' + f + ']' : f);
    const fields = Object.keys(changed).filter(f => f !== 'kw').map(f => [f, f]).concat((changed.kw || []).map(k => [k, 'kw']));
    for(const [f, how] of fields){
      // the one rule of the list that changes it (its boxes; else the index), and the value it gives: GW's value with that change
      let by = src.map(s => ({ s, ops:opOf(s, kind, f, x) })).filter(y => y.ops);
      if(!by.length) by = src.filter(s => idx[s.name] && f in idx[s.name]).map(s => ({ s, ops:[idx[s.name][f]] }));
      const names = uniq(by.map(y => y.s.name));
      if(names.length !== 1){ B.err(label(f, how) + ' is changed by ' + (names.length ? 'more than one rule of the list (' + and(names) + ')' : 'a rule the app cannot name') + ': not imported'); continue; }
      const ops = by.filter(y => y.s.name === names[0]).flatMap(y => y.ops);
      let want = null;
      if(ops.every(o => o === 'kw')) want = true;
      else if(ops.length === 1 && ops[0]) want = apply(x.row[f], ops[0]);
      else if(ops.every(o => o && o.add !== undefined)) want = apply(x.row[f], { add:ops.reduce((t, o) => t + o.add, 0) });
      if(want === null){ B.err(label(f, how) + ': the app cannot work out what ' + names[0] + ' makes it: not imported'); continue; }
      if(how !== 'kw' && want !== changed[f]){ B.err(label(f, how) + ' is ' + changed[f] + ' in the export; GW’s ' + x.row[f] + ' with ' + names[0] + ' is ' + want + ': not imported'); continue; }
      if(how === 'kw'){ set.kw = (set.kw || (x.row.kw || []).slice()); set.kw.push(f); }
      else set[f] = want;
      from[f] = names[0];
    }
    const fk = Object.keys(from), from2 = {};
    fk.filter(k => !ORDER[kind].includes(k)).concat(ORDER[kind].filter(k => fk.includes(k))).forEach(k => { from2[k] = from[k]; });
    if(fk.length) out.set(x, { set, from:from2 });
  }
  return out;
}
const where = parts => 'unit ' + parts.map(p => nn(p.name)).join(' + ');

const api = { build, ruleAbilities, ruleAbilitiesOf, ruleOfRow, meetsTo, catalogued, catalogues, malformed, nn, lc, typo, slug, uniq, and, splitList, lastId };
root.WH_BUILDER = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
