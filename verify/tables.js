#!/usr/bin/env node
/* verify/tables.js: data.js as tables (docs/tables.md).
   A list's unit entry names its datasheet (DATASHEETS, one per faction + datasheet name) and holds only what the list
   chose: models, wargear, points, enhancement, warlord, attachment, copies, its notes and footnotes. The datasheet holds
   the datasheet's facts: stats, weapon profiles, abilities and their texts, keywords, core-rule line. data.js resolves the
   entries at load (resolveArmies, written into data.js from RESOLVER below), so the app sees each unit as it always did.

     node verify/tables.js               the gate: data.js is in table form exactly as --write would write it (a list
                                         added in the old form, a stale RULE_OPTIONS / GRANTS, fail), every column is in
                                         verify/columns.json; writes verify/out/tables.md (the datasheet conflicts)
     node verify/tables.js --fingerprints   the gate: every AI-written column (gist, def) and every reading (mods, aura,
                                         guard; a rule's, stratagem's or ability's reading columns, READ_COLS) carries the
                                         fingerprint of the text it was written or read from, and that text has not changed
     node verify/tables.js --write       converts data.js: every unit entry written in full (the old form, as
                                         import-nr.js writes a list) becomes a reference to its datasheet; DATASHEETS,
                                         RULE_OPTIONS, GRANTS and the resolver are written again, and every reading goes
                                         to the row of the rule it reads (DATASHEETS, the FACTIONS row of an army or
                                         detachment rule or an enhancement; the list's own, and a reading two lists have
                                         otherwise, on the entry). Re-runnable: the same data.js gives the same file.
     node verify/tables.js --expand      writes data.js back in the old form (every unit in full, no DATASHEETS), the form
                                         the text-editing tools (write-grants.js, army-blocks.js) work on; --write after
     node verify/tables.js --stamp       writes the fingerprint of every gist / def / reading that has none (after
                                         checking it against its text); --restamp also replaces the stale ones (after
                                         a person has read it again from the new text)
   Where two lists' copies of one datasheet differ in a datasheet fact, the datasheet leaves that fact out and each list
   keeps its own value in `over` on its entry or row, until the owner decides (verify/out/tables.md lists them). The same
   for a reading: two lists reading one ability otherwise keep theirs on their entries (verify/out/tables.md, Reading
   conflicts). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const { parse, lit, key, q } = require('./literal');
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data.js');

const ROWS = ['stats', 'ranged', 'melee', 'abilities'];
// a datasheet's facts on the unit itself (with the rows above); everything else on a unit entry is the list's
const DS_UNIT = ['name', 'role', 'rules', 'kw', 'kwOnly', 'partialRules', 'srcNote'];
const STAT_FIELDS = ['M', 'T', 'Sv', 'W', 'Ld', 'OC', 'InSv', 'base'];
const WEAPON_FIELDS = ['range', 'A', 'BS', 'WS', 'S', 'AP', 'D'];
// AI-written columns and the column holding the fingerprint of the text each was written from
const FINGERPRINT = { gist:'gistOf', def:'defOf' };
// the readings: the app's interpretations of rule text into numbers and lines. A unit's footnotes (mods), what it gives other
// units (aura) and their "When targeted" help (guard) are rows of readings, each on the row of the rule it reads (DATASHEETS for a
// datasheet's ability, FACTIONS for an army or detachment rule or an enhancement, the list's entry for what is the list's own);
// each reading carries readOf, the fingerprint of the exact text it was read from, and readBy:'derive' when verify/derive.js's
// fixed rules give it from that text (then --write writes it again from the text). READ_COLS: the reading columns a row of
// FACTIONS, CORE_STRATAGEMS or an ability row holds itself (the app reads them there); the row's readOf fingerprints them all.
const READ = ['mods', 'aura', 'guard'];
const READ_FP = 'readOf', READ_BY = 'readBy', READ_WHY = 'listWhy';   // (listWhy: a reading the list's own, and why: it stays on the entry)
const READ_COLS = {
  rule:['mod', 'calcMods', 'calcDefs', 'calcNc', 'parts', 'both', 'limit'],
  strat:['mod', 'help', 'shield', 'defCalc', 'defPick'],
  ability:['riled', 'damaged', 'defAlways', 'defCalc', 'calcDef', 'embarked', 'fightOnDeath', 'comeback'],
};
const FP_KEYS = Object.values(FINGERPRINT).concat(READ_FP, READ_BY, READ_WHY);   // hidden from the app, and from the helpers' keys
const fp = s => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 8);

const MARK = {
  sheets:['// ---- DATASHEETS: written by verify/tables.js --write (edit a datasheet here; --write keeps the table in shape) ----', '// ---- end of DATASHEETS ----'],
  rules:['// ---- RULE_OPTIONS, GRANTS: written by verify/tables.js --write from verify/derive.js (do not edit) ----', '// ---- end of RULE_OPTIONS, GRANTS ----'],
  resolver:['// ---- resolveArmies: written by verify/tables.js --write (do not edit) ----', '// ---- end of resolveArmies ----'],
};

// ------------------------------------------------------------------------------------------------------------------
// the resolver: the same code runs in data.js (written from this text) and here
// ------------------------------------------------------------------------------------------------------------------
const RESOLVER = `// Each unit entry of ARMIES names its datasheet (ds: an id of DATASHEETS; a list of them for an attached unit: the leader,
// the other characters, the bodyguard) and holds only what the list chose. The app gets each unit as one object: the
// datasheet's columns, then the entry's own (an entry's value replaces the datasheet's; null: the list has none). Rows
// (stats, ranged, melee, abilities) name a row of the datasheet (a stats row by its model's name, without "×N"): the
// datasheet's row, then the entry row's own fields. An entry without its rows takes all of the datasheet's; a row the
// datasheet does not have (an enhancement's ability) is the list's own. over: a datasheet fact this list has otherwise
// than another list (verify/out/tables.md), kept per list until it is decided. why: the reason a value of the entry (or
// its row) is not the datasheet's: the rule, Warlord, enhancement or wargear that gives it (the value is the list's). of: which datasheet of an attached unit a
// row is from, when its who does not say. Hidden from the app: ds, over, of, a datasheet's faction and bsId, and the
// fingerprints (gistOf, defOf) of AI-written columns.
// The readings (mods: footnotes; aura: what the unit gives other units; guard: their "When targeted" help) are each on the row of
// the rule they read, in this order: the army rules on the unit's Rules line, each datasheet of the unit, its enhancement (or
// upgrade), the detachment rules of the list whose needs it meets; then the entry's own. An entry's list of them with names in it is
// the whole list, in its order: a name stands for the readings of that name the rows give. null: none. Hidden: readOf (the
// fingerprint of the text a reading was read from), readBy and listWhy.
function resolveArmies(armies, sheets, order, factions, opts){
  opts = opts || {}; factions = factions || {};
  var ROWS = ['stats', 'ranged', 'melee', 'abilities'], READ = ['mods', 'aura', 'guard'];
  var FPK = ${JSON.stringify(FP_KEYS)}, RHIDE = ['${READ_FP}', '${READ_BY}', '${READ_WHY}'].filter(function(k){ return (opts.keep || []).indexOf(k) < 0; });
  var HIDE = ['ds', 'over', 'of', 'why', 'own', 'faction', 'bsId'].concat(FPK).filter(function(k){ return (opts.keep || []).indexOf(k) < 0; });
  function put(o, x){ for(var k in x) if(HIDE.indexOf(k) < 0){ if(x[k] === null) delete o[k]; else o[k] = x[k]; } return o; }
  function copy(x){ return JSON.parse(JSON.stringify(x)); }   // each unit its own copy of a datasheet's values
  function sorted(o, keys){ var out = {}, i, k; for(i = 0; i < keys.length; i++) if(keys[i] in o) out[keys[i]] = o[keys[i]]; for(k in o) if(!(k in out)) out[k] = o[k]; return out; }
  function rowOf(part, kind, name){ var rows = (part && part[kind]) || [], j; for(j = 0; j < rows.length; j++) if(rows[j].name === name) return j; return -1; }
  function find(parts, kind, r){
    var name = kind === 'stats' ? String(r.name).replace(/ ×\\d+$/, '') : r.name, i, j;
    if(r.of !== undefined) return { p:r.of, j:rowOf(parts[r.of], kind, name) };
    for(i = 0; i < parts.length; i++) if(parts[i].name === r.who && (j = rowOf(parts[i], kind, name)) >= 0) return { p:i, j:j };
    for(i = 0; i < parts.length; i++) if((j = rowOf(parts[i], kind, name)) >= 0) return { p:i, j:j };
    return { p:-1, j:-1 };
  }
  // names alike in case and apostrophe (New Recruit's "Martial Ka'tah", Wahapedia's "Martial Ka’tah")
  function nm(s){ return String(s).toLowerCase().replace(/[’‘]/g, "'"); }
  function has(list, x){ for(var i = 0; i < (list || []).length; i++) if(nm(list[i]) === nm(x)) return true; return false; }
  function meets(n, u){ return !n || (!n.all || n.all.every(function(k){ return has(u.kw, k); })) && (!n.any || n.any.some(function(k){ return has(u.kw, k); }))
    && !(n.none || []).some(function(k){ return has(u.kw, k); }) && (!n.rule || n.rule.some(function(r){ return has(u.rules, r); })); }
  // the readings of one kind a unit has: the rows' (each with where it is from, for the trace), then the entry's
  function readings(a, u, out, ids, parts, kind){
    var F = factions[a.faction] || {}, dets = (a.detachments || []).map(function(d){ return (F.detachments || {})[d]; }).filter(Boolean), t = [], enh = null;
    function take(x, at){ ((x && x[kind]) || []).forEach(function(m, j){ t.push({ m:m, at:at, j:j }); }); }
    (F.armyRules || []).forEach(function(r){ if(has(out.rules, r.name)) take(r, null); });
    parts.forEach(function(p, i){ take(p, ids[i]); });
    dets.forEach(function(d){ (d.enhancements || []).forEach(function(e){ if(!enh && (e.name === out.enhancement || e.name === out.upgrade)) take(enh = e, null); }); });
    dets.forEach(function(d){ [d.rule].concat(d.moreRules || []).forEach(function(r){ if(r && meets(r.needs, out)) take(r, null); }); });
    var own = u[kind], list = [];
    if(own === null) list = [];
    else if(!own) list = t;
    else if(own.some(function(x){ return typeof x === 'string'; })) own.forEach(function(x, e){ if(typeof x !== 'string') list.push({ m:x, at:null, e:e }); else t.forEach(function(y, i){ if(y.m.from === x) list.push(i === t.findIndex(function(z){ return z.m.from === x; }) ? Object.assign({ e:e }, y) : y); }); });
    else list = t.concat(own.map(function(x, e){ return { m:x, at:null, e:e }; }));
    return list.map(function(y, n){ var m = copy(y.m); RHIDE.forEach(function(k){ delete m[k]; }); if(opts.trace) opts.trace(a, u, kind, n, y.at, y.at ? y.j : -1, y.e); return m; });
  }
  return armies.map(function(a){
    return Object.assign({}, a, { units:a.units.map(function(u){
      if(!u.ds) return u;
      var ids = [].concat(u.ds), parts = ids.map(function(id){ if(!sheets[id]) throw new Error('data.js: ' + a.id + '/' + u.id + ' names no datasheet ' + id); return sheets[id]; });
      var out = {}, k, rest = {};
      for(k in parts[0]) if(ROWS.indexOf(k) < 0 && READ.indexOf(k) < 0 && HIDE.indexOf(k) < 0) out[k] = copy(parts[0][k]);
      for(k in u) if(ROWS.indexOf(k) < 0 && READ.indexOf(k) < 0) rest[k] = u[k];
      put(out, rest); if(u.over) put(out, u.over);
      ROWS.forEach(function(kind){
        var list;
        if(kind in u){ if(u[kind] === null){ delete out[kind]; return; } list = u[kind]; }
        else if(parts.length === 1 && parts[0][kind]) list = parts[0][kind].map(function(r){ return { name:r.name }; });
        else return;
        out[kind] = list.map(function(r, n){
          var at = find(parts, kind, r);
          if(at.j < 0){ if(opts.trace) opts.trace(a, u, kind, n, null, -1); return put({}, r); }
          if(opts.trace) opts.trace(a, u, kind, n, ids[at.p], at.j);
          var ds = parts[at.p][kind][at.j], row = put({}, copy(ds)); put(row, r); if(r.over) put(row, r.over);
          // (for --expand: the datasheet's own value of a stat a rule of the list changed, own, so --write gives it back)
          if((kind === 'stats' || kind === 'ranged' || kind === 'melee') && r.from && (opts.keep || []).indexOf('own') >= 0){ var own = {}, f; for(f in r.from) if(f in ds && ds[f] !== r[f]) own[f] = ds[f]; for(f in own){ row.own = own; break; } }
          return sorted(row, order[kind] || []);
        });
      });
      READ.forEach(function(kind){ var l = readings(a, u, out, ids, parts, kind); if(l.length) out[kind] = l; });
      return sorted(out, order.unit || []);
    }) });
  });
}`;
const resolveArmies = new Function(RESOLVER + '\nreturn resolveArmies;')();

// ------------------------------------------------------------------------------------------------------------------
// reading data.js
// ------------------------------------------------------------------------------------------------------------------
const stable = v => JSON.stringify(v, (k, x) => x instanceof RegExp ? String(x) : x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(y => [y, x[y]])) : x);
const eq = (a, b) => stable(a) === stable(b);
// the lists as the app sees them are the same: equal, but for the fingerprints of AI-written columns, which the table form hides
// and the old form (every unit in full, --expand) keeps on its rows
const noFp = v => JSON.parse(JSON.stringify(v, (k, x) => FP_KEYS.includes(k) || k === 'own' ? undefined : x));
const sameLists = (a, b) => eq(noFp(a), noFp(b));
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const baseName = n => String(n).replace(/ ×\d+$/, '');
const rowKey = (kind, n) => kind === 'stats' ? baseName(n) : n;

// a `const NAME = <literal>;` of data.js: where it is, its value and its comments
function constant(src, name){
  const head = 'const ' + name + ' = ';
  const at = src.indexOf('\n' + head);
  if(at < 0) return null;
  const r = parse(src, at + 1 + head.length);
  if(src[r.end] !== ';') throw new Error('data.js: ' + name + ' does not end with ";"');
  return Object.assign(r, { start:at + 1, stop:r.end + 1 });
}
// the text between two markers (the markers included, with the line break after), or null
function marked(src, m){ const i = src.indexOf(m[0]), j = src.indexOf(m[1]); return i >= 0 && j > i ? { start:i, stop:j + m[1].length + 1 } : null; }

// data.js as it is: the lists in their old form (each unit in full), the comments of each place in them, and the rest
function read(src){
  const A = constant(src, 'ARMIES');
  if(!A) throw new Error('data.js: no ARMIES');
  const S = constant(src, 'DATASHEETS'), O = constant(src, 'TABLE_ORDER'), B = constant(src, 'BS_IDS');
  const sheets = S ? S.value : {}, order = O ? O.value : {};
  // resolve, and trace where each row came from (to put each comment of the datasheet table on every place it shows)
  const tr = new Map();   // "ai/ui/kind" -> [{ sid, j }] per row (per reading: { sid, j } of a datasheet's, { e } of the entry's own)
  const aIndex = new Map(A.value.map((a, i) => [a, i]));
  const D = evaluate(src);
  const armies = resolveArmies(A.value, sheets, order, D.factions, { keep:FP_KEYS.concat('own'), trace:(a, u, kind, n, sid, j, e) => {
    const k = aIndex.get(a) + '/' + a.units.indexOf(u) + '/' + kind;
    if(!tr.has(k)) tr.set(k, []);
    tr.get(k)[n] = { sid, j, e };
  } });
  // comments: the lists' own as they are; a datasheet's on every place that shows it
  const C = {};
  const add = (p, c) => { const k = JSON.stringify(p); const x = C[k] = C[k] || { above:[], inline:[] }; x.above.push(...c.above); x.inline.push(...c.inline); };
  for(const [pk, c] of Object.entries(A.comments)){
    const p = JSON.parse(pk);
    if(p[1] === 'units' && p.length >= 4){
      const u = A.value[p[0]].units[p[2]];
      if(u.ds){
        if(p[3] === 'ds'){ add(p.slice(0, 3).concat('name'), c); continue; }
        if(p[3] === 'over'){ add(p.length > 4 ? p.slice(0, 3).concat(p[4]) : p.slice(0, 3), c); continue; }
        if(ROWS.includes(p[3]) && p.length > 5){ add(p.slice(0, 5), c); continue; }
        // a comment on one of the entry's own readings (or on a name in its list): on that reading of the unit
        if(READ.includes(p[3]) && p.length > 4){
          const n = (tr.get(p[0] + '/' + p[2] + '/' + p[3]) || []).findIndex(t => t && t.e === p[4]);
          add(n >= 0 ? p.slice(0, 4).concat(n) : p.slice(0, 4), c); continue;
        }
      }
    }
    add(p, c);
  }
  if(S) for(const [pk, c] of Object.entries(S.comments)){
    const p = JSON.parse(pk);
    if(!p.length) continue;
    const sid = p[0];
    A.value.forEach((a, ai) => a.units.forEach((u, ui) => {
      if(!u.ds) return;
      const ids = [].concat(u.ds);
      if(p.length >= 3 && (ROWS.includes(p[1]) || READ.includes(p[1]))){
        (tr.get(ai + '/' + ui + '/' + p[1]) || []).forEach((t, n) => { if(t && t.sid === sid && t.j === p[2]) add([ai, 'units', ui, p[1], n], c); });
      } else if(ids[0] === sid){
        if(p.length === 1) add([ai, 'units', ui, 'name'], c);
        else if(!(p[1] in u)) add([ai, 'units', ui, p[1]], c);
      }
    }));
  }
  // the rules in force and what they give units (GRANTS, as verify/derive.js reads them from the words): the reasons a list's unit
  // has a keyword its datasheet does not
  let G = null;
  return { src, A, S, O, armies, comments:C, order, bsIds:B ? B.value : {}, factions:D.factions, D, get grants(){ return G || (G = require('./derive').ruleTables(D).grants); } };
}

// ------------------------------------------------------------------------------------------------------------------
// the tables: datasheets from the lists' units, and each list's entries
// ------------------------------------------------------------------------------------------------------------------
// the order keys are listed in: the one data.js has, if every object fits it; else by majority, as the objects have them
// (the fingerprints, gistOf, defOf, readOf, readBy, last, in that order: they are no part of the order of what they fingerprint)
function keyOrder(seqs0, prev0){
  const fpl = FP_KEYS.filter(k => seqs0.some(s => s.includes(k)) || (prev0 || []).includes(k));
  if(fpl.length) return keyOrder(seqs0.map(s => s.filter(k => !FP_KEYS.includes(k))), prev0 && prev0.filter(k => !FP_KEYS.includes(k))).concat(fpl);
  const seqs = seqs0, prev = prev0;
  const fits = o => seqs.every(s => { const t = s.filter(k => o.includes(k)); return t.every((k, i) => !i || o.indexOf(t[i - 1]) < o.indexOf(k)); });
  if(prev && fits(prev)) return prev.concat([...new Set(seqs.flat())].filter(k => !prev.includes(k)));
  const keys = [...new Set(seqs.flat())], cnt = new Map();
  for(const s of seqs) for(let i = 0; i < s.length; i++) for(let j = i + 1; j < s.length; j++){ const k = s[i] + '\0' + s[j]; cnt.set(k, (cnt.get(k) || 0) + 1); }
  const before = (a, b) => (cnt.get(a + '\0' + b) || 0) > (cnt.get(b + '\0' + a) || 0);
  const pos = {}; for(const k of keys){ let t = 0, n = 0; for(const s of seqs){ const i = s.indexOf(k); if(i >= 0){ t += i / s.length; n++; } } pos[k] = t / n; }
  const out = [], left = new Set(keys);
  while(left.size){
    const free = [...left].filter(k => ![...left].some(o => o !== k && before(o, k)));
    const pick = (free.length ? free : [...left]).sort((a, b) => pos[a] - pos[b] || (a < b ? -1 : 1))[0];
    out.push(pick); left.delete(pick);
  }
  return out;
}

function build(R){
  const armies = R.armies, bsIds = R.bsIds || {}, C = R.comments;
  const order = { unit:keyOrder(armies.flatMap(a => a.units.map(u => Object.keys(u).filter(k => k !== 'ds'))), R.order.unit) };
  for(const kind of ROWS) order[kind] = keyOrder(armies.flatMap(a => a.units.flatMap(u => (u[kind] || []).map(r => Object.keys(r)))), R.order[kind]);
  const sheets = new Map(), units = [], notes = [];
  // a stats row that names no part of an attached unit: the bodyguard's, unless its models carry only weapons of one other part
  // (the six models of the Wardens of Ultramar Marneus Calgar's unit is supported by: their models lines' gear is the Wardens')
  // (models lines are in the parts' order: a line whose weapons more than one part has, Veteran Sergeant Metaurus's heavy bolt pistol and
  // master-crafted power weapon, is the part of the line before it when that part has them)
  const partByGear = (u, names, rowName) => {
    const key = n => String(n).toLowerCase().replace(/\s*\(.*\)$/, '').replace(/s$/, '');
    const weapons = [...(u.ranged || []), ...(u.melee || [])];
    let cur = 0, hit = -1;
    (u.models || []).forEach((m, i) => {
      // the parts that have every weapon of the line
      let whos = null;
      for(const g of (u.gear || [])[i] || []){ const ws = new Set(weapons.filter(w => (w.group || w.name) === g && w.who).map(w => names.indexOf(w.who)).filter(p => p >= 0)); if(ws.size) whos = whos ? new Set([...whos].filter(p => ws.has(p))) : ws; }
      const ps = [...(whos || [])].sort((x, y) => x - y);
      if(ps.length === 1) cur = ps[0]; else if(ps.length && !whos.has(cur)) cur = ps.find(p => p > cur) ?? ps[0];
      if(hit < 0 && key(String(m).replace(/^\d+×\s*/, '')) === key(rowName) && ps.length) hit = cur;
    });
    return hit > 0 && hit < names.length - 1 ? hit : names.length - 1;
  };
  armies.forEach((a, ai) => a.units.forEach((u, ui) => {
    if(u.ds) throw new Error(a.id + '/' + u.id + ': not resolved');
    const names = u.leads ? [u.name].concat((u.also || []).map(x => x.name), [u.leads]) : [u.name];
    const ids = names.map(n => a.faction + '/' + slug(n));
    const sig = (bsIds.units || {})[a.id + '/' + u.id];
    const roots = Array.isArray(sig) && sig.length === names.length ? sig.map(s => s.split('|')[0]) : null;
    names.forEach((n, i) => {
      if(!sheets.has(ids[i])) sheets.set(ids[i], { id:ids[i], name:n, faction:a.faction, bs:new Map(), rows:Object.fromEntries(ROWS.map(k => [k, new Map()])), unitObs:[], all:[] });
      const s = sheets.get(ids[i]);
      if(s.name !== n) throw new Error('two datasheets have the id ' + ids[i] + ': ' + s.name + ', ' + n);
      if(roots){ if(!s.bs.has(roots[i])) s.bs.set(roots[i], []); s.bs.get(roots[i]).push(a.id + '/' + u.id); }
    });
    const U = { ai, ui, a, u, ids, names, multi:names.length > 1, rows:{}, forced:new Set() };
    units.push(U);
    sheets.get(ids[0]).all.push(U);
    if(!U.multi) sheets.get(ids[0]).unitObs.push(U);
    for(const kind of ROWS){
      if(!Array.isArray(u[kind])) continue;
      U.rows[kind] = u[kind].map((r, k) => {
        let part = 0;
        if(kind === 'abilities' && /\b(Enhancement|Upgrade)\b/.test(r.tag || '')) part = -1;   // the list's choice, not the datasheet's
        else if(U.multi){
          if(kind === 'stats'){ const i = names.indexOf(baseName(r.name)); part = i >= 0 ? i : partByGear(u, names, baseName(r.name)); }
          else { part = names.indexOf(r.who); if(part < 0){ part = -1; notes.push(a.id + '/' + u.id + ' ' + kind + ' ' + r.name + ': its who (' + r.who + ') names no part of the unit; kept as the list\'s own row'); } }
        }
        const o = { U, kind, k, r, part };
        if(part >= 0){
          const s = sheets.get(ids[part]), rk = rowKey(kind, r.name);
          if(!s.rows[kind].has(rk)) s.rows[kind].set(rk, { key:rk, obs:[] });
          o.R = s.rows[kind].get(rk); o.R.obs.push(o); o.sheet = s;
        }
        return o;
      });
    }
  }));
  // which fields of a row are the list's (for this place): the key, a part's who, counts, the values a rule of the list changed
  const listLevel = (o, k) => {
    const r = o.r, from = r.from || {};
    if(k === 'name' || (o.why && k in o.why)) return true;
    if(k === 'who') return o.kind !== 'abilities' || o.U.multi;
    if(k === 'na') return true;   // why it does nothing in this list
    if(o.kind === 'stats') return k === 'from' || k === 'printed' || k === 'own' || k in from;
    if(o.kind === 'ranged' || o.kind === 'melee') return ['n', 'from', 'enh', 'own'].includes(k) || k in from || (k === 'kw' && Object.keys(from).some(x => !WEAPON_FIELDS.includes(x)));
    return false;
  };
  const conflicts = [];
  // a datasheet's value of a fact: what every place that has it as a datasheet fact agrees on; else a conflict
  const decide = (obs, val, has, voting, where, field, quiet) => {
    const votes = obs.filter(o => voting(o) && !(FP_KEYS.includes(field) && !has(o)));
    if(!votes.length) return { none:true };
    const vs = votes.map(o => has(o) ? stable(val(o)) : '\0absent');
    if(vs.every(v => v === vs[0])) return vs[0] === '\0absent' ? { none:true } : { value:val(votes[0]) };
    if(quiet) return { conflict:true };
    const by = new Map(); votes.forEach((o, i) => { if(!by.has(vs[i])) by.set(vs[i], []); by.get(vs[i]).push(o); });
    conflicts.push({ where, field, values:[...by.values()].map(os => ({ value:has(os[0]) ? val(os[0]) : null, lists:os.map(o => (o.U || o).a.id + '/' + (o.U || o).u.id) })) });
    return { conflict:true };
  };
  // ---- why a list's value is not its datasheet's (the list's fact, with its reason) ----
  const lc = x => String(x).toLowerCase();
  const matchNeeds = (to, u) => { const has = k => (u.kw || []).some(x => lc(x) === lc(k));
    if(!to || typeof to !== 'object' || Object.keys(to).some(k => !['all', 'any', 'none'].includes(k))) return !to;
    return (to.all || []).every(has) && (!to.any || to.any.some(has)) && !(to.none || []).some(has); };
  // each BSData entry's own categories (verify/sources/bsdata-extract.json, by id), before any modifier of a rule
  let BSC = null; const BSR = new Map();   // (and its own rules: core abilities BSData links to it, "Deep Strike")
  const bsCats = () => { if(BSC) return BSC; BSC = new Map();
    try { const x = JSON.parse(fs.readFileSync(path.join(__dirname, 'sources/bsdata-extract.json'), 'utf8'));
      const walk = o => { if(Array.isArray(o)){ o.forEach(walk); return; } if(!o || typeof o !== 'object') return; if(o.id && Array.isArray(o.categoryLinks)) BSC.set(o.id, o.categoryLinks.map(c => c.name)); if(o.id && (o.infoLinks || o.rules)) BSR.set(o.id, [].concat(o.infoLinks || [], o.rules || []).map(c => c.name)); for(const k in o) if(o[k] && typeof o[k] === 'object') walk(o[k]); };
      walk(x.files); } catch(e) {}
    return BSC; };
  const ownAbilities = u => (u.abilities || []).filter(x => /\b(Enhancement|Upgrade)\b/.test(x.tag || ''));
  // always the list's: the Warlord keyword, a keyword a rule in force gives (GRANTS), a rule an enhancement or upgrade gives
  const unitWhy = U => {
    const u = U.u, a = U.a, F = (R.factions || {})[a.faction] || {}, why = {};
    const put = (f, k, r) => { (why[f] = why[f] || {})[k] = r; };
    const kwOf = k => (u.kw || []).find(x => lc(x) === lc(k));
    if(u.warlord && kwOf('Warlord')) put('kw', kwOf('Warlord'), 'Warlord');
    // (a keyword a rule gives that a datasheet of the unit already has, its own BSData category: no reason, it is the datasheet's;
    // the Forgefiend's DAEMON, which Soul Forge Boons also gives HERETIC ASTARTES VEHICLE units)
    const nativeRule = r => U.ids.some(id => { const s = sheets.get(id); bsCats(); return s && [...s.bs.keys()].some(b => (BSR.get(b) || []).some(x => lc(x) === lc(r))); });
    const native = k => U.ids.some(id => { const s = sheets.get(id); return s && [...s.bs.keys()].some(b => (bsCats().get(b) || []).some(x => lc(x) === lc(k))); });
    const inForce = [F.name + ' army rule · '].concat(a.detachments.map(d => F.name + ' · ' + ((F.detachments || {})[d] || {}).name + ' rule · '));
    for(const g of R.grants || []){
      if(!/keyword/.test(g.type) || g.to === 'this unit / model' || !inForce.some(p => g.rule.startsWith(p)) || !matchNeeds(g.to, u)) continue;
      const k = kwOf(g.grants); if(k && !(why.kw && why.kw[k]) && !native(k)) put('kw', k, g.option || g.rule.split(' · ').pop());
    }
    // a keyword the unit's enhancement or upgrade gives by name ("Models in the bearer's unit have the **SOUL FORGE** keyword")
    for(const ab of ownAbilities(u)){
      for(const m of String(ab.text || '').matchAll(/\b(?:have|has|gains?) the \*\*([^*]+)\*\* keyword/gi)){ const k = kwOf(m[1]); if(k && !(why.kw && why.kw[k]) && !native(k)) put('kw', k, ab.name); }
    }
    // a keyword the list selected for the unit, as its models line names it ("1× Daemon Prince of Chaos (Khorne)"): the ability of the
    // datasheet that names the keyword (Daemonic Allegiance), with the selection
    for(const m of u.models || []) for(const x of (/\(([^()]*)\)$/.exec(m) || [, ''])[1].split(/,\s*/)){
      const k = kwOf(x); if(!k || (why.kw && why.kw[k])) continue;
      const ab = (u.abilities || []).find(y => (y.text || '').includes('**' + k.toUpperCase() + '**'));
      put('kw', k, (ab ? ab.name + ': ' : 'its selection ') + x);
    }
    // (and the one BSData's entry for one choice of a Daemonic Allegiance datasheet names, "Tzeentch Soul Grinder": that ability, with it)
    { const g = /^(Khorne|Tzeentch|Nurgle|Slaanesh) /.exec(u.name || ''), k = g && kwOf(g[1]);
      const ab = k && !(why.kw && why.kw[k]) && (u.abilities || []).find(y => y.name === 'Daemonic Allegiance' && (y.text || '').includes('**' + k.toUpperCase() + '**'));
      if(ab) put('kw', k, ab.name + ': ' + g[1]); }
    if(why.kw && why.kw.Battleline && u.role === 'Battleline') put('role', 'Battleline', why.kw.Battleline);
    // (a reference sheet's role, Reference, is the list's: the datasheet is a buyable one, Blue Horrors' Battleline)
    if(u.ref && u.role === 'Reference') put('role', 'Reference', 'a reference sheet (ref)');
    const own = ownAbilities(u);
    for(const r of u.rules || []){
      if(nativeRule(r)) continue;   // (a rule the datasheet itself has: the Sorcerer in Terminator Armour's Deep Strike, not Umbralefic Crystal's)
      const esc = lc(r).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const ab = own.find(x => new RegExp('\\*\\*' + esc + '\\*\\*|\\[' + esc + '[\\]\\s-]').test(lc(x.text)));   // it gives the rule by name
      if(ab){ put('rules', r, ab.name); continue; }
      for(const w of [].concat(u.ranged || [], u.melee || [])) for(const k of w.kw || []){
        const by = w.from && w.from[k] && [].concat(w.from[k]).find(n => own.some(x => x.name === n));
        if(by && lc(k).startsWith(lc(r)) && !(why.rules && why.rules[r])) put('rules', r, by);
      }
    }
    return why;
  };
  for(const U of units) U.why = unitWhy(U);
  // the readings, each to the row it reads (readingTables); the list's own keep their reason
  const RT = readingTables(R, units, conflicts);
  for(const U of units){
    for(const [k, w] of Object.entries(U.readWhy)) U.why[k] = w;
    // the list's own notes: which unit it leads (kwNote), the points of its parts (ptsNote)
    const u = U.u;
    if(u.kwNote){ const m = / comes? from (?:the )?(.+?)(?:\.$| \(|;)/.exec(u.kwNote); U.why.kwNote = u.leads ? (u.support ? 'supports ' : 'leads ') + u.leads + (u.also && u.also.length ? ' (with ' + u.also.map(x => x.name).join(', ') + ')' : '') : m ? m[1] : 'the list'; }
    if(u.ptsNote) U.why.ptsNote = 'the points of its parts as the list has them' + (u.leads ? ' (' + u.name + (u.also || []).map(x => ' + ' + x.name).join('') + ' + ' + u.leads + ')' : '');
  }
  // the list's only where lists differ: a value an ability of the unit gives (Kustom Force Field: 4+* InSv), a weapon ability
  // on the Rules line from the wargear taken
  const rowWhy = (o, f) => {
    // (an ability's note that names a detachment rule of the list, Singular Purpose's "With Enraged Behemoths’ …" in Crusher Stampede:
    // the list's, not the datasheet's)
    if(o.kind === 'abilities' && f === 'note'){
      const F = (R.factions || {})[o.U.a.faction] || {}, note = String(o.r.note || '');
      const names = o.U.a.detachments.flatMap(d => { const x = (F.detachments || {})[d] || {}; return [x.rule].concat(x.moreRules || []).filter(Boolean).map(r => r.name); });
      return names.find(n => n && note.includes(n)) || null;
    }
    if(o.kind !== 'stats' || f !== 'InSv') return null;
    const v = String(o.r[f] || '').replace('*', '');
    if(!/^\d\+$/.test(v)) return null;
    const re = new RegExp('(^|\\W)' + v.replace('+', '\\+') + ' \\*\\*InSv\\*\\*');
    const ab = (o.U.u.abilities || []).find(x => re.test(x.text));
    return ab ? ab.name : null;
  };
  const wargearWhy = U => {
    const out = {}, kws = [].concat(U.u.ranged || [], U.u.melee || []).flatMap(w => (w.kw || []).map(k => [k, w.name]));
    for(const r of U.u.rules || []){ if(U.why.rules && U.why.rules[r]) continue; const hit = kws.find(([k]) => lc(k).startsWith(lc(r))); if(hit) out[r] = 'its wargear (' + hit[1] + ')'; }
    return out;
  };
  const strip = (U, f) => { const w = (U.why || {})[f]; return w && Array.isArray(U.u[f]) ? U.u[f].filter(x => !(x in w)) : U.u[f]; };
  for(const s of sheets.values()){
    for(const kind of ROWS) for(const R of s.rows[kind].values()){
      R.ds = { name:R.key }; R.conflict = new Set();
      const fields = []; for(const o of R.obs) for(const k of Object.keys(o.r)) if(!listLevel(o, k) && !fields.includes(k)) fields.push(k);
      for(const f of keyOrder([fields], order[kind]).filter(f => fields.includes(f))){
        const args = [R.obs, o => o.r[f], o => f in o.r, o => !listLevel(o, f), s.id + ' · ' + kind + ' · ' + R.key, f];
        if(decide(...args, true).conflict){
          const ex = R.obs.map(o => !listLevel(o, f) && rowWhy(o, f));
          if(ex.some(Boolean)){
            R.obs.forEach((o, i) => { if(ex[i]) (o.why = o.why || {})[f] = ex[i]; });
            if(decide(...args, true).conflict) R.obs.forEach((o, i) => { if(ex[i]) delete o.why[f]; });
          }
        }
        const d = decide(...args);
        if(d.conflict) R.conflict.add(f); else if(!d.none) R.ds[f] = d.value;
      }
      // a stat every list has changed by a rule (the Deathwatch Terminator Sergeant's W 4 from its Storm Shield): the datasheet's own
      // value, from the lists' `own` (from-json.js: GW's datasheet), when they agree
      if(['stats', 'ranged', 'melee'].includes(kind)) for(const f of [...new Set(R.obs.flatMap(o => Object.keys(o.r.own || {})))]){
        if(f in R.ds || R.conflict.has(f)) continue;
        const vs = [...new Set(R.obs.filter(o => o.r.own && f in o.r.own).map(o => o.r.own[f]))];
        if(vs.length === 1) R.ds[f] = vs[0]; else conflicts.push({ where:s.id + ' · ' + kind + ' · ' + R.key, field:'own.' + f, values:vs.map(v => ({ value:v })) });
      }
    }
    s.ds = { name:s.name, faction:s.faction };
    if(s.bs.size === 1) s.ds.bsId = [...s.bs.keys()][0];
    else if(s.bs.size > 1) conflicts.push({ where:s.id, field:'bsId', values:[...s.bs.entries()].map(([v, l]) => ({ value:v, lists:l })) });
    s.uconf = new Set();
    for(const f of DS_UNIT.slice(1)){
      const args = [s.unitObs, U => strip(U, f), U => f in U.u, U => !(f === 'role' && U.why.role), s.id, f];
      if(f === 'rules' && decide(...args, true).conflict){
        const add = s.unitObs.map(wargearWhy);
        const keep = s.unitObs.map(U => U.why.rules);
        s.unitObs.forEach((U, i) => { if(Object.keys(add[i]).length) U.why.rules = Object.assign({}, U.why.rules, add[i]); });
        if(decide(...args, true).conflict) s.unitObs.forEach((U, i) => { if(keep[i]) U.why.rules = keep[i]; else delete U.why.rules; });
      }
      const d = decide(...args);
      if(d.conflict) s.uconf.add(f); else if(!d.none) s.ds[f] = d.value;
    }
  }
  // comments on rows: on the datasheet's row when every place that shows it has the same; else on the lists' rows
  const SC = {}, AC = {};
  const addC = (M, p, c) => { const k = JSON.stringify(p); const x = M[k] = M[k] || { above:[], inline:[] }; x.above.push(...c.above); x.inline.push(...c.inline); };
  const rowC = new Map(), fieldC = [], readC = [];
  for(const [pk, c] of Object.entries(C)){
    const p = JSON.parse(pk);
    if(p[1] !== 'units' || p.length < 4){ addC(AC, p, c); continue; }
    const U = units.find(x => x.ai === p[0] && x.ui === p[2]), f = p[3];
    if(ROWS.includes(f) && p.length >= 5){
      const o = U.rows[f][p[4]];
      if(o.part < 0){ U.forced.add(f); addC(AC, p.slice(0, 5), c); continue; }
      if(!rowC.has(o)) rowC.set(o, { above:[], inline:[] });
      rowC.get(o).above.push(...c.above); rowC.get(o).inline.push(...c.inline);
    } else if(ROWS.includes(f) || DS_UNIT.includes(f)) fieldC.push({ U, f, c, p });
    else if(READ.includes(f)) readC.push({ U, f, n:p.length >= 5 ? p[4] : null, c });
    else addC(AC, p, c);
  }
  for(const s of sheets.values()) for(const kind of ROWS) for(const R of s.rows[kind].values()){
    const cs = R.obs.map(o => rowC.get(o));
    if(!cs.some(Boolean)) continue;
    if(cs.every(c => c && stable(c) === stable(cs[0]))){ R.comment = cs[0]; continue; }
    R.obs.forEach((o, i) => { if(cs[i]){ o.U.forced.add(o.kind); addC(AC, [o.U.ai, 'units', o.U.ui, o.kind, o.k], cs[i]); } });
  }
  // each list's entry
  const sheetOf = id => sheets.get(id);
  const findPart = (U, kind, e) => {   // as the resolver finds a row
    const rk = rowKey(kind, e.name), has = i => sheetOf(U.ids[i]).rows[kind].has(rk);
    for(let i = 0; i < U.ids.length; i++) if(U.names[i] === e.who && has(i)) return i;
    for(let i = 0; i < U.ids.length; i++) if(has(i)) return i;
    return -1;
  };
  const rowEntry = o => {
    if(o.part < 0){
      if(findPart(o.U, o.kind, o.r) >= 0) throw new Error(o.U.a.id + '/' + o.U.u.id + ': its own row ' + o.r.name + ' has the name of a datasheet row');
      return { e:o.r, plain:false };
    }
    const R = o.R, e = { name:o.r.name }, over = {};
    for(const k of Object.keys(o.r)){
      if(k === 'name' || k === 'own') continue;   // own: the datasheet's (below)
      if(listLevel(o, k)) e[k] = o.r[k];
      else if(R.conflict.has(k)) over[k] = o.r[k];
    }
    for(const k of Object.keys(R.ds)) if(k !== 'name' && !(k in o.r) && !FP_KEYS.includes(k)) e[k] = null;
    for(const k of R.conflict) if(!(k in o.r) && !listLevel(o, k) && !FP_KEYS.includes(k)) over[k] = null;
    if(findPart(o.U, o.kind, e) !== o.part) e.of = o.part;
    if(o.why) e.why = o.why;
    if(Object.keys(over).length) e.over = over;
    return { e, plain:Object.keys(e).length === 1 && e.name === R.key };
  };
  const entries = units.map(U => {
    const u = U.u, s0 = sheetOf(U.ids[0]), e = { id:u.id, ds:U.multi ? U.ids : U.ids[0] }, over = {};
    for(const k of order.unit){
      if(!(k in u) || k === 'id' || k === 'name') continue;
      if(ROWS.includes(k) || READ.includes(k)) continue;
      if(DS_UNIT.includes(k)){
        if(!U.multi){ if(s0.uconf.has(k)) over[k] = u[k]; else if(U.why[k] && !eq(u[k], s0.ds[k])) e[k] = u[k]; }
        else if(!eq(u[k], s0.ds[k])) e[k] = u[k];
      } else e[k] = u[k];
    }
    for(const k of Object.keys(u)) if(!(k in e) && !order.unit.includes(k) && !READ.includes(k)) e[k] = u[k];
    for(const k of READ) if(k in U.readEntry) e[k] = U.readEntry[k];
    for(const k of DS_UNIT.slice(1)){
      if(k in u) continue;
      if(U.multi){ if(k in s0.ds) e[k] = null; }
      else if(s0.uconf.has(k)) over[k] = null;
    }
    for(const kind of ROWS){
      const def = !U.multi && s0.rows[kind].size;
      if(!Array.isArray(u[kind])){ if(def) e[kind] = null; continue; }
      const rs = U.rows[kind].map(rowEntry);
      const same = !U.multi && !U.forced.has(kind) && rs.length === s0.rows[kind].size && rs.every(x => x.plain) && [...s0.rows[kind].keys()].every((k, i) => rs[i].e.name === k);
      if(!same) e[kind] = rs.map(x => x.e);
    }
    const why = Object.fromEntries(Object.entries(U.why).filter(([k]) => k in e));
    if(Object.keys(why).length) e.why = why;
    if(Object.keys(over).length) e.over = over;
    // the entry's keys: id, ds, then as resolved units list them, over last
    const out = { id:e.id, ds:e.ds };
    for(const k of order.unit.concat(ROWS)) if(k in e && !(k in out)) out[k] = e[k];
    for(const k of Object.keys(e)) if(!(k in out) && k !== 'over' && k !== 'why') out[k] = e[k];
    if(e.why) out.why = e.why;
    if(e.over) out.over = e.over;
    U.entry = out;
    return out;
  });
  // comments on readings: on the entry's own (its key, its own reading, the name standing for a row's); on the datasheet's reading (or
  // its key) when every unit that shows it has the same; else on the entry's first line
  const tableLater = [], keyC = [], elC = new Map();
  const toName = (U, c) => addC(AC, [U.ai, 'units', U.ui, 'id'], c);   // (its first line: a datasheet's name comment would not come back from --expand)
  for(const x of readC){
    const U = x.U, e = U.entry, kind = x.f;
    if(x.n === null){ if(e[kind]) addC(AC, [U.ai, 'units', U.ui, kind], x.c); else if(kind in e) toName(U, x.c); else keyC.push(x); continue; }
    const r = U.read[kind][x.n];
    if(!r){ toName(U, x.c); continue; }
    if(!(r.g && r.g.agreed)){ const i = (e[kind] || []).indexOf(r.m); if(i >= 0) addC(AC, [U.ai, 'units', U.ui, kind, i], x.c); else toName(U, x.c); continue; }
    const j = r.g.obs.get(U).indexOf(r), k = r.g.key + '\0' + j;
    if(!elC.has(k)) elC.set(k, { g:r.g, j, kind, by:new Map() });
    const m = elC.get(k).by.get(U) || { above:[], inline:[] }; m.above.push(...x.c.above); m.inline.push(...x.c.inline); elC.get(k).by.set(U, m);
  }
  for(const { g, j, kind, by } of elC.values()){
    const cs = [...g.obs.keys()].map(U => by.get(U));
    if(g.cls === 'ds' && cs.every(c => c && stable(c) === stable(cs[0]))){ const J = RT.rowRead('ds\0' + g.sid, kind).findIndex(y => y.g === g) + j; tableLater.push([[g.sid, kind, J], cs[0]]); continue; }
    for(const [U, c] of by){ const i = (U.entry[kind] || []).indexOf(g.from); if(i >= 0) addC(AC, [U.ai, 'units', U.ui, kind, i], c); else toName(U, c); }
  }
  { const bySid = new Map(); for(const x of keyC){ const k = x.U.ids[0] + '\0' + x.f; if(!bySid.has(k)) bySid.set(k, new Map()); const m = bySid.get(k).get(x.U) || { above:[], inline:[] }; m.above.push(...x.c.above); m.inline.push(...x.c.inline); bySid.get(k).set(x.U, m); }
    for(const [k, by] of bySid){ const [sid, kind] = k.split('\0'); const all = units.filter(U => U.ids[0] === sid && !(kind in U.entry)), cs = all.map(U => by.get(U));
      if(RT.rowRead('ds\0' + sid, kind).length && cs.every(c => c && stable(c) === stable(cs[0]))) tableLater.push([[sid, kind], cs[0]]);
      else for(const [U, c] of by) toName(U, c); } }
  // comments on a unit's datasheet facts: on its entry when it lists them, on the datasheet when every unit of it has the same
  const fc = new Map();
  for(const x of fieldC){
    if(x.f in x.U.entry){ addC(AC, x.p.slice(0, 4), x.c); continue; }
    if(x.U.entry.over && x.f in x.U.entry.over){ addC(AC, x.p.slice(0, 3).concat('over'), x.c); continue; }
    const k = x.U.ids[0] + '\0' + x.f;
    if(!fc.has(k)) fc.set(k, []);
    fc.get(k).push(x);
  }
  for(const [k, xs] of fc){
    const [sid, f] = k.split('\0'), s = sheetOf(sid);
    const all = s.all.filter(U => !(f in U.entry) && !(U.entry.over && f in U.entry.over));
    const merged = new Map(); for(const x of xs){ const m = merged.get(x.U) || { above:[], inline:[] }; m.above.push(...x.c.above); m.inline.push(...x.c.inline); merged.set(x.U, m); }
    // (a unit a new list just added in full, with no comment on the field: the others' one comment stays on the datasheet)
    const cs = all.map(U => merged.get(U)), said = cs.filter(Boolean);
    if(said.length && said.every(c => stable(c) === stable(said[0]))){ (s.fieldComments = s.fieldComments || {})[f] = said[0]; continue; }
    for(const [U, c] of merged) addC(AC, [U.ai, 'units', U.ui, 'ds'], c);
  }
  // the datasheets: by faction (FACTIONS' order), then as the lists first show them
  const factionOrder = [...new Set(armies.map(a => a.faction))];
  const list = [...sheets.values()].sort((x, y) => factionOrder.indexOf(x.faction) - factionOrder.indexOf(y.faction));
  const table = {}, tableC = {};
  for(const s of list){
    const d = Object.assign({}, s.ds);
    for(const kind of READ){ const rr = RT.rowRead('ds\0' + s.id, kind); if(rr.length) d[kind] = rr.map(y => y.o); }
    for(const kind of ROWS) if(s.rows[kind].size) d[kind] = [...s.rows[kind].values()].map(R => R.ds);
    const o = { name:d.name, faction:d.faction }; if(d.bsId) o.bsId = d.bsId;
    for(const k of order.unit.concat(ROWS)) if(k in d && !(k in o)) o[k] = d[k];
    for(const k of Object.keys(d)) if(!(k in o)) o[k] = d[k];
    table[s.id] = o;
    for(const kind of ROWS) [...s.rows[kind].values()].forEach((R, j) => { if(R.comment) addC(tableC, [s.id, kind, j], R.comment); });
    for(const [f, c] of Object.entries(s.fieldComments || {})) addC(tableC, [s.id, f], c);
  }
  for(const [p, c] of tableLater) addC(tableC, p, c);
  const armiesNew = armies.map((a, ai) => Object.assign({}, a, { units:units.filter(U => U.ai === ai).map(U => U.entry) }));
  return { armies:armiesNew, sheets:table, order, armyComments:AC, sheetComments:tableC, conflicts, notes, RT, shared:list.filter(s => s.all.length + 0 > 1 || s.rows.stats.size && [...s.rows.stats.values()].some(R => new Set(R.obs.map(o => o.U)).size > 1)).length };
}

// ------------------------------------------------------------------------------------------------------------------
// the readings: each on the row of the rule it reads (docs/tables.md, "Readings")
// ------------------------------------------------------------------------------------------------------------------
const nmR = s => String(s).toLowerCase().replace(/[’‘]/g, "'");
const hasN = (list, x) => (list || []).some(y => nmR(y) === nmR(x));
const NEEDS_KEYS = ['all', 'any', 'none', 'rule'];   // the needs the resolver reads (a detachment rule's, for its readings)
const meetsN = (n, u) => !n || (!n.all || n.all.every(k => hasN(u.kw, k))) && (!n.any || n.any.some(k => hasN(u.kw, k))) && !(n.none || []).some(k => hasN(u.kw, k)) && (!n.rule || n.rule.some(r => hasN(u.rules, r)));
const detRulesOf = d => d && d.rule ? [d.rule].concat(d.moreRules || []) : [];
const unFp = v => JSON.parse(JSON.stringify(v, (k, x) => FP_KEYS.includes(k) ? undefined : x));
const isOwnRow = ab => /\b(Enhancement|Upgrade)\b/.test(ab.tag || '');
// a core rule a unit's Rules line or one of its weapons names ("Damaged 5", Conversion): the glossary entry, with the name for one
// with its value in its name (as verify/helpers.js cites it)
function coreText(D, name){
  if(D.rules[name]) return D.rules[name];
  const k = ((D.ruleAliases || []).find(([re]) => re.test(name)) || [])[1];
  return k && D.rules[k] && /\d/.test(name) ? name + ': ' + D.rules[k] : null;
}
// the exact text a reading of a unit was read from: the unit's ability of that name (or the ability with an option of that name,
// "**Shroudpsalm (Aura):**"), the army or detachment rule it names, the enhancement, a core rule, a stratagem
function readSource(D, a, u, m){
  const F = D.factions[a.faction] || {}, dets = (a.detachments || []).map(d => (F.detachments || {})[d]).filter(Boolean);
  const rn = m.rule || m.from;
  const rule = (F.armyRules || []).find(r => r.name === rn) || dets.flatMap(detRulesOf).find(r => r.name === rn);
  if(m.rule && rule) return ruleText(rule);
  const ab = (u.abilities || []).find(x => x.name === m.from) || (u.abilities || []).find(x => String(x.text || '').includes('**' + m.from));
  if(ab) return ab.text;
  if(rule) return ruleText(rule);
  const e = dets.flatMap(d => d.enhancements || []).find(x => x.name === m.from); if(e) return e.text;
  const c = coreText(D, m.from); if(c) return c;
  const st = dets.flatMap(d => d.stratagems || []).concat(D.coreStratagems).find(x => x.name === m.from || x.id === m.from);
  return st ? stratText(st) : null;
}
// every text a reading of a unit uses, the one it reads first (readSource), then: the rule an ability's tag names that says how it is
// used (a Bondsman Duty: the Bondsman army rule's pick, 12", until your next Command phase); for a value it sets outright on a weapon
// (Possessed Lord's A 10, not Battle Protocols' +2), what gave that weapon its value in the list (its from: Relentless Rage, an
// enhancement). Its readOf is their fingerprints in that order, joined with "+".
function readSources(D, a, u, m){
  const main = readSource(D, a, u, m);
  if(main == null) return null;
  const F = D.factions[a.faction] || {}, dets = (a.detachments || []).map(d => (F.detachments || {})[d]).filter(Boolean);
  const rules = (F.armyRules || []).concat(dets.flatMap(detRulesOf)), out = [{ name:m.rule || m.from, text:main }];
  const put = (name, text) => { if(text != null && !out.some(x => x.name === name)) out.push({ name, text }); };
  const named = n => { const r = rules.find(x => x.name === n); if(r) return ruleText(r); const e = dets.flatMap(d => d.enhancements || []).find(x => x.name === n); if(e) return e.text;
    const ab = (u.abilities || []).find(x => x.name === n); return ab ? ab.text : null; };
  const ab = (u.abilities || []).find(x => x.name === m.from) || (u.abilities || []).find(x => String(x.text || '').includes('**' + m.from));
  if(ab) for(const t of String(ab.tag || '').split(' · ')){ const r = rules.find(x => x.name === t); if(r) put(r.name, ruleText(r)); }
  if(m.weapon && m.set){ const w = [].concat(u.ranged || [], u.melee || []).find(x => x.name === m.weapon || x.group === m.weapon);
    for(const [k, v] of Object.entries(m.set)) if(!/^[+-]/.test(String(v)) && w && w.from && w.from[k]) for(const n of [].concat(w.from[k])) put(n, named(n)); }
  return out;
}
const readFp = srcs => srcs.map(x => fp(x.text)).join('+');
// verify/derive.js's fixed rules for readings, loaded on first use (derive.js loads this file)
let deriveReadings_ = null;
const deriveReadings = (text, name) => (deriveReadings_ || (deriveReadings_ = require('./derive').readingsOf))(text, name);

function readingTables(R, units, conflicts){
  const D = R.D, prevSheets = R.S ? R.S.value : {}, F = fk => D.factions[fk] || {};
  // where a reading of a unit is from: { cls:'ds', p (the part) } | { cls:'rule', path } | { cls:'enh', path } | { cls:'own', why }
  const enhPath = U => { const u = U.u, a = U.a, f = F(a.faction);
    for(const dk of a.detachments) for(const [i, e] of (((f.detachments || {})[dk] || {}).enhancements || []).entries()) if(e.name === u.enhancement || e.name === u.upgrade) return { path:[a.faction, 'detachments', dk, 'enhancements', i], e };
    return null; };
  const ruleOf = (U, rn) => { const a = U.a, f = F(a.faction);
    const i = (f.armyRules || []).findIndex(r => r.name === rn);
    if(i >= 0) return { path:[a.faction, 'armyRules', i], r:f.armyRules[i], army:true };
    for(const dk of a.detachments){ const d = (f.detachments || {})[dk]; if(!d) continue;
      if(d.rule && d.rule.name === rn) return { path:[a.faction, 'detachments', dk, 'rule'], r:d.rule };
      const j = (d.moreRules || []).findIndex(r => r.name === rn); if(j >= 0) return { path:[a.faction, 'detachments', dk, 'moreRules', j], r:d.moreRules[j] }; }
    return null; };
  const ruleApplies = (U, x) => x.army ? hasN(U.u.rules, x.r.name) : (!x.r.needs || Object.keys(x.r.needs).every(k => NEEDS_KEYS.includes(k))) && meetsN(x.r.needs, U.u);
  const partOfAbility = (U, name) => {
    const rs = U.rows.abilities || [], hit = rs.find(o => o.r.name === name) || rs.find(o => String(o.r.text || '').includes('**' + name));
    return hit ? { part:hit.part, row:hit.r } : null; };
  const coreOf = (U, name) => !U.multi && (hasN(U.u.rules, name) || [].concat(U.u.ranged || [], U.u.melee || []).some(w => (w.kw || []).some(k => nmR(k).startsWith(nmR(name))))) && coreText(D, name);
  function classify(U, m){
    if(m[READ_WHY]) return { cls:'own', why:m[READ_WHY] };   // the list's own, with its reason (a bodyguard's weapons, an enhancement)
    const rn = m.rule || m.from, rule = ruleOf(U, rn);
    if(m.rule && rule){ if(ruleApplies(U, rule)) return { cls:'rule', path:rule.path, rule:rule.r }; return { cls:'own', why:null, cant:'the rule it names (' + rn + ') does not reach this unit as the resolver places a rule\'s readings' }; }
    const ab = partOfAbility(U, m.from);
    if(ab && ab.part >= 0) return { cls:'ds', p:ab.part };
    if(ab){
      const e = enhPath(U);
      if(e && e.e.name === m.from && isOwnRow(ab.row)) return { cls:'enh', path:e.path, enh:e.e };
      return { cls:'own', why:'its ' + (ab.row.tag || 'own ability') + ' ' + ab.row.name + ' (a row of this list only)' };
    }
    if(rule){ if(ruleApplies(U, rule)) return { cls:'rule', path:rule.path, rule:rule.r }; return { cls:'own', why:null, cant:'the rule ' + rn + ' does not reach this unit as the resolver places a rule\'s readings' }; }
    const e = enhPath(U); if(e && e.e.name === m.from) return { cls:'enh', path:e.path, enh:e.e };
    if(coreOf(U, m.from)) return { cls:'ds', p:0, core:true };
    return { cls:'own', why:null, cant:'nothing of the unit or the list it is from is named ' + m.from };
  }
  const gkey = (U, kind, c, from) => kind + '\0' + (c.cls === 'ds' ? 'ds\0' + U.ids[c.p] : c.cls + '\0' + JSON.stringify(c.path)) + '\0' + from;
  const groups = new Map(), owns = [];
  for(const U of units){
    U.read = {};
    for(const kind of READ){
      U.read[kind] = (U.u[kind] || []).map((m, n) => {
        const c = classify(U, m), x = { U, kind, n, m, c };
        if(c.cls === 'own'){ owns.push(x); return x; }
        const k = gkey(U, kind, c, m.from);
        if(!groups.has(k)) groups.set(k, { key:k, kind, from:m.from, cls:c.cls, sid:c.cls === 'ds' ? U.ids[c.p] : null, path:c.path || null, src:c, obs:new Map() });
        x.g = groups.get(k);
        return x;
      });
    }
  }
  // who each group is for, as the resolver places it: every unit with that datasheet whose part has the ability (or core rule);
  // every unit the rule reaches; the bearer of the enhancement
  for(const g of groups.values()){
    for(const U of units){
      let on = false;
      if(g.cls === 'ds'){ const p = U.ids.indexOf(g.sid); if(p >= 0){ const ab = partOfAbility(U, g.from); on = ab ? ab.part === p : (p === 0 && !!coreOf(U, g.from)); } }
      else if(g.cls === 'rule'){ if(U.a.faction === g.path[0]){ const x = ruleOf(U, g.src.rule.name); on = !!x && JSON.stringify(x.path) === JSON.stringify(g.path) && ruleApplies(U, x); } }
      else { const e = enhPath(U); on = !!e && JSON.stringify(e.path) === JSON.stringify(g.path); }
      if(on) g.obs.set(U, U.read[g.kind].filter(x => x.g === g));
    }
  }
  // a group every unit it is for has alike goes on its row; else it is a conflict: each list keeps its own
  const readConflicts = [], derived = [];
  const whereOf = g => g.cls === 'ds' ? g.sid : g.path[0] + ' · ' + g.path.slice(1).join(' · ');
  for(const g of groups.values()){
    // (a unit with its own reading of this, for a reason of the list (listWhy), does not vote: it shows its own)
    const voters = [...g.obs.entries()].filter(([U]) => !U.read[g.kind].some(x => x.c.cls === 'own' && x.m[READ_WHY] && x.m.from === g.from));
    const vals = voters.map(([U, xs]) => ({ U, v:stable(unFp(xs.map(x => x.m))) }));
    if(vals.length && vals.every(v => v.v === vals[0].v)){
      g.agreed = true;
      const first = voters.map(([, xs]) => xs).find(xs => xs.length);
      if(!first){ g.agreed = false; continue; }
      g.list = first.map((x, j) => { const o = JSON.parse(JSON.stringify(x.m)); for(const k of [READ_FP, READ_BY]){ const w = voters.map(([, xs]) => xs[j] && xs[j].m[k]).find(v => v !== undefined); if(w !== undefined) o[k] = w; else delete o[k]; } return o; });
      // readings verify/derive.js's fixed rules give from the text: written from it (readBy:'derive'); one whose text changed is
      // written again from the new text
      if(g.cls === 'ds' || g.cls === 'enh'){
        const [U0, xs0] = [...g.obs.entries()].find(([, xs]) => xs.length);
        const text = readSource(D, U0.a, U0.u, xs0[0].m), d = text != null ? deriveReadings(text, g.from) : null, want = d && d[g.kind] ? d[g.kind] : null;
        const was = g.list.some(o => o[READ_BY] === 'derive');
        const dfp = o => readFp(readSources(D, U0.a, U0.u, o) || [{ text }]);
        if(want && stable(want) === stable(unFp(g.list))){ g.list = g.list.map(o => Object.assign(unFp(o), { [READ_FP]:dfp(o), [READ_BY]:'derive' })); derived.push(g); }
        else if(was){ g.list = (want || []).map(o => Object.assign({}, o, { [READ_FP]:dfp(o), [READ_BY]:'derive' })); g.rederived = true; if(want) derived.push(g); }
      }
    } else {
      g.agreed = false;
      const by = new Map(); for(const v of vals){ if(!by.has(v.v)) by.set(v.v, []); by.get(v.v).push(v.U); }
      readConflicts.push({ where:whereOf(g), field:g.kind + ' · ' + g.from, values:[...by.entries()].map(([v, us]) => ({ value:JSON.parse(v), lists:us.map(U => U.a.id + '/' + U.u.id) })) });
    }
  }
  // each row's readings, in the order the lists show them (the one data.js has, where it fits)
  const rowLists = new Map();   // "ds\0sid" | JSON path -> { kind: [group] }
  const rowKeyOf = g => g.cls === 'ds' ? 'ds\0' + g.sid : JSON.stringify(g.path);
  for(const g of groups.values()) if(g.agreed && g.list.length){ const k = rowKeyOf(g); if(!rowLists.has(k)) rowLists.set(k, {}); (rowLists.get(k)[g.kind] = rowLists.get(k)[g.kind] || []).push(g); }
  const prevFroms = (k, kind) => { const row = k.startsWith('ds\0') ? prevSheets[k.slice(3)] : JSON.parse(k).reduce((o, x) => o && o[x], D.factions);
    return row && Array.isArray(row[kind]) ? [...new Set(row[kind].map(m => m.from))] : null; };
  for(const [k, m] of rowLists) for(const kind of Object.keys(m)){
    const seqs = units.map(U => [...new Set(U.read[kind].filter(x => x.g && rowKeyOf(x.g) === k && x.g.agreed).map(x => x.g.from))]).filter(s => s.length);
    const ord = keyOrder(seqs, prevFroms(k, kind));
    m[kind].sort((x, y) => ord.indexOf(x.from) - ord.indexOf(y.from));
  }
  const rowRead = (k, kind) => ((rowLists.get(k) || {})[kind] || []).flatMap(g => g.list.map(o => ({ o, g })));
  // each unit: the readings the rows give it (as the resolver orders them), its own after; where that is not the list's order, the
  // whole list with names for the rows' readings
  for(const U of units){
    const a = U.a, u = U.u, f = F(a.faction), e = enhPath(U);
    U.readEntry = {}; U.readWhy = {};
    for(const kind of READ){
      const t = [];
      (f.armyRules || []).forEach((r, i) => { if(hasN(u.rules, r.name)) t.push(...rowRead(JSON.stringify([a.faction, 'armyRules', i]), kind)); });
      U.ids.forEach(id => t.push(...rowRead('ds\0' + id, kind)));
      if(e) t.push(...rowRead(JSON.stringify(e.path), kind));
      for(const dk of a.detachments){ const d = (f.detachments || {})[dk]; if(!d) continue;
        if(d.rule && meetsN(d.rule.needs, u)) t.push(...rowRead(JSON.stringify([a.faction, 'detachments', dk, 'rule']), kind));
        (d.moreRules || []).forEach((r, j) => { if(meetsN(r.needs, u)) t.push(...rowRead(JSON.stringify([a.faction, 'detachments', dk, 'moreRules', j]), kind)); }); }
      const actual = U.read[kind], own = actual.filter(x => !(x.g && x.g.agreed));
      for(const x of own) if(x.c.cls === 'own' && x.c.why) (U.readWhy[kind] = U.readWhy[kind] || {})[x.m.from] = x.c.why;
      const shown = xs => stable(unFp(xs));
      // (a group written again from its new text: the unit shows what its row now gives)
      const act = actual.flatMap(x => x.g && x.g.rederived ? (x === actual.find(y => y.g === x.g) ? x.g.list : []) : [x.g && x.g.agreed ? x.g.list[x.g.obs.get(U).indexOf(x)] : x.m]);
      const ownM = own.map(x => x.m);
      if(!act.length && !t.length) continue;
      if(!act.length){ U.readEntry[kind] = null; continue; }
      if(shown(t.map(y => y.o).concat(ownM)) === shown(act)){ if(ownM.length) U.readEntry[kind] = ownM; continue; }
      // the whole list: a name for each group of the rows' readings, the list's own in full
      const full = [], done = new Set();
      for(const x of actual){
        if(x.g && x.g.agreed){ if(!done.has(x.g.from)){ done.add(x.g.from); full.push(x.g.from); } }
        else full.push(x.m);
      }
      const exp = full.flatMap(y => typeof y === 'string' ? t.filter(z => z.o.from === y).map(z => z.o) : [y]);
      if(!full.some(y => typeof y === 'string') || shown(exp) !== shown(act)) throw new Error(U.a.id + '/' + U.u.id + ' ' + kind + ': its readings cannot be written as the rows\' readings and its own');
      U.readEntry[kind] = full;
    }
  }
  const cant = owns.filter(x => x.c.cant).map(x => ({ where:x.U.a.id + '/' + x.U.u.id + ' · ' + x.kind + ' · ' + x.m.from, why:x.c.cant }));
  return { groups, rowLists, rowRead, readConflicts, derived, cant, owns };
}

// ------------------------------------------------------------------------------------------------------------------
// writing
// ------------------------------------------------------------------------------------------------------------------
const HEAD = ['id', 'ds', 'name', 'short', 'role', 'pts', 'copies', 'ptsNote', 'enhancement', 'enhOn', 'upgrade', 'warlord', 'warlordOn'];
const ATTACH = ['leads', 'support', 'also'];
const ARMY_HEAD = [['id', 'name', 'faction', 'points', 'pointsUsed'], ['battleSize', 'disposition']];
function writer(C){
  const lines = [];
  const cm = p => C[JSON.stringify(p)];
  // one line: its text, the paths of what starts on it (their comments: above it, and at its end)
  const line = (indent, text, paths) => {
    const above = [], inline = [];
    for(const p of paths){ const c = cm(p); if(c){ above.push(...c.above); inline.push(...c.inline); } }
    for(const a of above) lines.push(indent + '//' + a);
    lines.push(indent + text + (inline.length ? ' //' + inline.join(' //') : ''));
  };
  const isBlock = v => Array.isArray(v) && v.length > 0 && v.every(x => x && typeof x === 'object' && !Array.isArray(x) && !(x instanceof RegExp));
  // an object's keys, a few to a line (head groups), arrays of objects one row to a line
  function fields(o, p, indent, groups){
    const keys = Object.keys(o), done = new Set(), out = [];
    for(const k of keys){
      if(done.has(k)) continue;
      const g = groups.find(g => g.includes(k));
      if(g && !isBlock(o[k])){
        const ks = keys.filter(x => g.includes(x) && !done.has(x) && !isBlock(o[x]));
        ks.forEach(x => done.add(x));
        out.push({ text:ks.map(x => key(x) + ':' + lit(o[x])).join(', '), paths:ks.map(x => p.concat(x)) });
      } else {
        done.add(k);
        if(isBlock(o[k])) out.push({ block:k, rows:o[k], path:p.concat(k) });
        else out.push({ text:key(k) + ':' + lit(o[k]), paths:[p.concat(k)] });
      }
    }
    out.forEach((x, i) => {
      const comma = i < out.length - 1 ? ',' : '';
      if(x.text !== undefined) return line(indent, x.text + comma, x.paths);
      line(indent, key(x.block) + ':[', [x.path]);
      x.rows.forEach((r, j) => line(indent + '  ', lit(r) + (j < x.rows.length - 1 ? ',' : ''), [x.path.concat(j)].concat(deeper(x.path.concat(j)))));
      lines.push(indent + ']' + comma);
    });
  }
  // comments deeper inside a row written on one line: on that line
  const deeper = p => { const s = JSON.stringify(p).slice(0, -1) + ','; return Object.keys(C).filter(k => k.startsWith(s)).map(k => JSON.parse(k)); };
  return { lines, line, fields };
}
function armiesText(armies, C){
  const W = writer(C);
  W.lines.push('const ARMIES = [');
  armies.forEach((a, ai) => {
    W.line('', '{', [[ai]]);
    const head = Object.assign({}, a); delete head.units;
    W.fields(head, [ai], '  ', ARMY_HEAD);
    W.lines[W.lines.length - 1] += ',';
    W.line('  ', 'units:[', [[ai, 'units']]);
    a.units.forEach((u, ui) => {
      W.line('    ', '{', [[ai, 'units', ui]]);
      W.fields(u, [ai, 'units', ui], '      ', [HEAD, ATTACH]);
      W.lines.push('    }' + (ui < a.units.length - 1 ? ',' : ''));
    });
    W.lines.push('  ]');
    W.lines.push('},');
  });
  W.lines.push('];');
  return W.lines.join('\n');
}
function sheetsText(sheets, C){
  const W = writer(C);
  W.lines.push('const DATASHEETS = {');
  const ids = Object.keys(sheets);
  ids.forEach((id, i) => {
    W.line('', q(id) + ':{', [[id]]);
    W.fields(sheets[id], [id], '  ', [['name', 'faction', 'bsId', 'role']]);
    W.lines.push('}' + (i < ids.length - 1 ? ',' : ''));
  });
  W.lines.push('};');
  return W.lines.join('\n');
}
function orderText(order){
  return 'const TABLE_ORDER = {\n' + Object.entries(order).map(([k, v]) => '  ' + k + ':' + lit(v)).join(',\n') + '\n};';
}
function ruleTablesText(T){
  const rows = (name, rs) => 'const ' + name + ' = [\n' + rs.map(r => '  ' + lit(r)).join(',\n') + '\n];';
  return [MARK.rules[0], '// RULE_OPTIONS: the options inside a rule or ability (Blessings of Khorne\'s, Try Dat Button!\'s), each with the phases its',
    '// text gives: trigger (when it is used) and used (where its effect is used); phases = both. GRANTS: a rule or option giving',
    '// units an ability or keyword ("BLOOD LEGIONS units from your army gain the Blessings of Khorne ability"), to whom (needs) and',
    '// while what. Derived from the words by verify/derive.js\'s rule tables; derive.js checks them against the words every run.',
    rows('RULE_OPTIONS', T.options), rows('GRANTS', T.grants), MARK.rules[1]].join('\n');
}

// FACTIONS with each rule's and enhancement's readings (mods, aura, guard: the rows readingTables gives), as it is otherwise
function factionsText(src, RT){
  const c = constant(src, 'FACTIONS'), edits = [], same = (p, q) => p.length === q.length && p.every((x, i) => x === q[i]);
  const props = p => c.nodes.filter(n => n.prop && n.path.length === p.length + 1 && same(n.path.slice(0, -1), p));
  const rows = [];
  for(const [fk, f] of Object.entries(c.value)){
    (f.armyRules || []).forEach((r, i) => rows.push([fk, 'armyRules', i]));
    for(const [dk, d] of Object.entries(f.detachments || {})){
      if(d.rule) rows.push([fk, 'detachments', dk, 'rule']);
      (d.moreRules || []).forEach((r, i) => rows.push([fk, 'detachments', dk, 'moreRules', i]));
      (d.enhancements || []).forEach((r, i) => rows.push([fk, 'detachments', dk, 'enhancements', i]));
    }
  }
  for(const p of rows){
    const row = p.reduce((o, x) => o[x], c.value), ps = props(p);
    for(const kind of READ){
      const want = RT.rowRead(JSON.stringify(p), kind).map(y => y.o), at = ps.findIndex(n => n.path[n.path.length - 1] === kind);
      if(at >= 0 && !want.length){ const n = ps[at]; edits.push(at > 0 ? { at:ps[at - 1].end, del:n.end - ps[at - 1].end, text:'' } : { at:n.pos, del:(ps[1] ? ps[1].pos : n.end) - n.pos, text:'' }); }
      else if(at >= 0 && stable(row[kind]) !== stable(want)){ const v = c.nodes.find(n => !n.prop && same(n.path, p.concat(kind))); edits.push({ at:v.pos, del:v.end - v.pos, text:lit(want) }); }
      else if(at < 0 && want.length){ const last = ps.reduce((x, n) => !x || n.end > x.end ? n : x, null); edits.push({ at:last.end, del:0, text:', ' + kind + ':' + lit(want) }); }
    }
  }
  edits.sort((a, b) => b.at - a.at);
  for(const e of edits) src = src.slice(0, e.at) + e.text + src.slice(e.at + e.del);
  return src;
}

const RETURN_RE = /\nreturn \{ version:VERSION[^\n]*\};\n/;
// data.js in table form, from data.js in any form
function tableForm(src, opts){
  opts = opts || {};
  const R = read(src);
  if(opts.stampRows) opts.stampRows(R.armies, R.D);
  const B = build(R);
  // the parts of data.js outside the tables, as they are (FACTIONS with its rows' readings)
  let out = factionsText(src, B.RT);
  for(const m of [MARK.sheets, MARK.rules, MARK.resolver]){ const r = marked(out, m); if(r) out = out.slice(0, r.start) + out.slice(r.stop); }
  const A = constant(out, 'ARMIES');
  const sheetsBlock = MARK.sheets[0] + '\n' + sheetsText(B.sheets, B.sheetComments) + '\n' + MARK.sheets[1];
  out = out.slice(0, A.start) + armiesText(B.armies, B.armyComments) + '\n\n' + sheetsBlock + '\n' + out.slice(A.stop).replace(/^\n+/, '\n');
  const ret = RETURN_RE.exec(out);
  if(!ret) throw new Error('data.js: the return line not found');
  const before = out.slice(0, ret.index).replace(/\n+$/, '\n'), after = out.slice(ret.index + ret[0].length);
  const compose = T => before + (T ? '\n' + ruleTablesText(T) + '\n' : '') + '\n' + MARK.resolver[0] + '\n' + orderText(B.order) + '\n' + RESOLVER + '\n' + MARK.resolver[1] + '\n' + returnLine(ret[0], true, !!T) + after;
  // RULE_OPTIONS and GRANTS: what verify/derive.js reads from the words of the rules and abilities of these lists
  const { ruleTables } = require('./derive');
  const T = ruleTables(evaluate(compose(null)));
  return { text:compose({ options:T.options, grants:T.grants }), B, R };
}
function returnLine(l, tables, rules){
  l = l.replace(/armies:(?:ARMIES|resolveArmies\(ARMIES, DATASHEETS, TABLE_ORDER(?:, FACTIONS)?\))/, tables ? 'armies:resolveArmies(ARMIES, DATASHEETS, TABLE_ORDER, FACTIONS)' : 'armies:ARMIES')
    .replace(/, datasheets:DATASHEETS|, ruleOptions:RULE_OPTIONS|, grants:GRANTS/g, '');
  return l.replace(/ \};\n$/, (tables ? ', datasheets:DATASHEETS' : '') + (rules ? ', ruleOptions:RULE_OPTIONS, grants:GRANTS' : '') + ' };\n');
}
// data.js in the old form: every unit in full, no tables (the comments of the datasheets on every unit that shows them)
function oldForm(src){
  const R = read(src);
  let out = src;
  for(const m of [MARK.sheets, MARK.rules, MARK.resolver]){ const r = marked(out, m); if(r) out = out.slice(0, r.start) + out.slice(r.stop); }
  const A = constant(out, 'ARMIES');
  out = out.slice(0, A.start) + armiesText(R.armies, R.comments) + out.slice(A.stop);
  const ret = RETURN_RE.exec(out);
  return out.slice(0, ret.index) + returnLine(ret[0], false, false) + out.slice(ret.index + ret[0].length);
}

function evaluate(text){
  const ctx = { window:{} }; vm.createContext(ctx); vm.runInContext(text, ctx);
  return ctx.window.WH_DATA;
}

// ------------------------------------------------------------------------------------------------------------------
// AI-written columns: each gist and def carries the fingerprint (gistOf, defOf: 8 hex of its sha256) of the text it summarises
// ------------------------------------------------------------------------------------------------------------------
const stratText = s => ['WHEN: ' + s.when, 'TARGET: ' + s.target, 'EFFECT: ' + s.effect, s.restrictions ? 'RESTRICTIONS: ' + s.restrictions : ''].filter(Boolean).join('\n');
const ruleText = r => r.text + (r.table ? '\n' + r.table.map(t => t.join(': ')).join('\n') : '');
// every AI-written value: { table, path (in that constant), where, col, has (its fingerprint), source (the text it summarises) }
function sites(D, armies){
  const out = [];
  const each = (table, path, where, o, source) => { for(const [col, f] of Object.entries(FINGERPRINT)) if(typeof o[col] === 'string') out.push({ table, path, where, col, fpKey:f, has:o[f], source }); };
  D.coreStratagems.forEach((x, i) => each('CORE_STRATAGEMS', [i], 'Core · ' + x.name, x, stratText(x)));
  for(const [fk, f] of Object.entries(D.factions)){
    const rule = (path, where, r) => { each('FACTIONS', path, where, r, ruleText(r)); (r.parts || []).forEach((p, i) => each('FACTIONS', path.concat('parts', i), where + ' · ' + p.name, p, ruleText(r))); };
    (f.armyRules || []).forEach((r, i) => rule([fk, 'armyRules', i], f.name + ' army rule · ' + r.name, r));
    for(const [dk, d] of Object.entries(f.detachments || {})){
      if(d.rule) rule([fk, 'detachments', dk, 'rule'], f.name + ' · ' + d.name + ' rule · ' + d.rule.name, d.rule);
      (d.moreRules || []).forEach((r, i) => rule([fk, 'detachments', dk, 'moreRules', i], f.name + ' · ' + d.name + ' rule · ' + r.name, r));
      (d.stratagems || []).forEach((x, i) => each('FACTIONS', [fk, 'detachments', dk, 'stratagems', i], f.name + ' · ' + d.name + ' · ' + x.name, x, stratText(x)));
    }
  }
  const seen = new Set();
  armies.forEach(a => a.units.forEach(u => (u.abilities || []).forEach(ab => {
    const k = ab.name + '\n' + ab.text + '\n' + ab.def; if(seen.has(k)) return; seen.add(k);
    each('ARMIES', null, a.id + ' · ' + u.name + ' · ' + ab.name, ab, ab.text);
  })));
  // the readings: a row's own reading columns (READ_COLS) under one readOf, the text of the row; every reading of a unit (mods, aura,
  // guard: on DATASHEETS, FACTIONS or the entry) its own readOf, the text it was read from (readSource)
  const rowSite = (table, path, where, o, source, cols) => { const c = Object.keys(o).filter(k => cols.includes(k) && o[k] !== undefined).pop();
    if(c) out.push({ table, path, where, col:c, fpKey:READ_FP, has:o[READ_FP], source, reading:true }); };
  D.coreStratagems.forEach((x, i) => rowSite('CORE_STRATAGEMS', [i], 'Core · ' + x.name, x, stratText(x), READ_COLS.strat));
  for(const [fk, f] of Object.entries(D.factions)){
    (f.armyRules || []).forEach((r, i) => rowSite('FACTIONS', [fk, 'armyRules', i], f.name + ' army rule · ' + r.name, r, ruleText(r), READ_COLS.rule));
    for(const [dk, d] of Object.entries(f.detachments || {})){
      if(d.rule) rowSite('FACTIONS', [fk, 'detachments', dk, 'rule'], f.name + ' · ' + d.name + ' rule · ' + d.rule.name, d.rule, ruleText(d.rule), READ_COLS.rule);
      (d.moreRules || []).forEach((r, i) => rowSite('FACTIONS', [fk, 'detachments', dk, 'moreRules', i], f.name + ' · ' + d.name + ' rule · ' + r.name, r, ruleText(r), READ_COLS.rule));
      (d.stratagems || []).forEach((x, i) => rowSite('FACTIONS', [fk, 'detachments', dk, 'stratagems', i], f.name + ' · ' + d.name + ' · ' + x.name, x, stratText(x), READ_COLS.strat));
    }
  }
  const seenR = new Set();
  armies.forEach(a => a.units.forEach(u => {
    for(const ab of u.abilities || []){ const k = ab.name + '\n' + ab.text + '\n' + stable(READ_COLS.ability.map(c => ab[c])) + '\n' + ab[READ_FP]; if(seenR.has(k)) continue; seenR.add(k);
      rowSite('ARMIES', null, a.id + ' · ' + u.name + ' · ' + ab.name, ab, ab.text, READ_COLS.ability); }
    for(const kind of READ) for(const m of u[kind] || []){
      const srcs = readSources(D, a, u, m), k = stable(unFp(m)) + '\n' + stable(srcs) + '\n' + m[READ_FP]; if(seenR.has(k)) continue; seenR.add(k);
      out.push({ table:'ARMIES', path:null, where:a.id + ' · ' + u.name + ' · ' + kind + ' · ' + m.from + (m.when ? ' (' + m.when + ')' : ''), col:kind, fpKey:READ_FP, has:m[READ_FP], source:srcs && srcs[0].text, sources:srcs, want:srcs && readFp(srcs), reading:true, derived:m[READ_BY] === 'derive' });
    }
  }));
  return out;
}
// write the missing fingerprints (and with restamp the stale ones) into CORE_STRATAGEMS and FACTIONS (the units' through stampRows)
function stampConstants(src, D, restamp){
  const edits = [];
  for(const name of ['CORE_STRATAGEMS', 'FACTIONS']){
    const c = constant(src, name);
    const node = (p, prop) => c.nodes.find(n => !!n.prop === prop && JSON.stringify(n.path) === JSON.stringify(p));
    for(const x of sites(D, []).filter(x => x.table === name)){
      const want = fp(x.source);
      if(x.has === undefined){ const n = node(x.path.concat(x.col), true); edits.push({ at:n.end, del:0, text:', ' + x.fpKey + ':' + q(want) }); }
      else if(x.source == null) continue;
      else if(restamp && x.has !== want){ const n = node(x.path.concat(x.fpKey), false); edits.push({ at:n.pos, del:n.end - n.pos, text:q(want) }); }
    }
  }
  edits.sort((a, b) => b.at - a.at);
  for(const e of edits) src = src.slice(0, e.at) + e.text + src.slice(e.at + e.del);
  return { src, n:edits.length };
}
const stampRows = restamp => (armies, D) => {
  let n = 0;
  const need = (o, k, src) => src != null && (o[k] === undefined || (restamp && o[k] !== fp(src)));
  for(const a of armies) for(const u of a.units){
    for(const ab of u.abilities || []){
      if(typeof ab.def === 'string' && need(ab, 'defOf', ab.text)){ ab.defOf = fp(ab.text); n++; }
      if(READ_COLS.ability.some(c => ab[c] !== undefined) && need(ab, READ_FP, ab.text)){ ab[READ_FP] = fp(ab.text); n++; }
    }
    // (a reading's readOf covers every text it uses: one with fewer fingerprints than texts gets the rest; --restamp: all again)
    for(const kind of READ) for(const m of u[kind] || []){ const srcs = readSources(D, a, u, m); if(!srcs) continue; const want = readFp(srcs), has = m[READ_FP];
      const fewer = has !== undefined && has.split('+').length < srcs.length && want.startsWith(has + '+');
      if(has === undefined || fewer || (restamp && has !== want)){ m[READ_FP] = want; n++; } }
  }
  return n;
};

// ------------------------------------------------------------------------------------------------------------------
// the column registry (verify/columns.json): where every column's values come from
// ------------------------------------------------------------------------------------------------------------------
const COLUMNS = path.join(ROOT, 'verify/columns.json');
// every table of data.js and the columns its rows have, from data.js as written (the lists' entries as entries)
function columnsInData(src){
  const D = evaluate(src), A = constant(src, 'ARMIES').value, S = (constant(src, 'DATASHEETS') || { value:{} }).value;
  const T = {}, add = (t, o) => { if(!o || typeof o !== 'object' || Array.isArray(o)) return; const m = T[t] = T[t] || new Set(); for(const k of Object.keys(o)) m.add(k); };
  D.coreStratagems.forEach(x => add('CORE_STRATAGEMS', x));
  for(const f of Object.values(D.factions)){
    add('FACTIONS', f);
    (f.armyRules || []).forEach(r => add('FACTIONS.armyRules', r));
    for(const d of Object.values(f.detachments || {})){
      add('FACTIONS.detachments', d); if(d.rule) add('FACTIONS.detachments.rule', d.rule); (d.moreRules || []).forEach(r => add('FACTIONS.detachments.moreRules', r));
      (d.stratagems || []).forEach(x => add('FACTIONS.detachments.stratagems', x)); (d.enhancements || []).forEach(x => add('FACTIONS.detachments.enhancements', x));
    }
    // the readings on its rule and enhancement rows (one table: they are the lists' readings, on the row they read)
    for(const r of (f.armyRules || []).concat(Object.values(f.detachments || {}).flatMap(d => detRulesOf(d).concat(d.enhancements || []))))
      for(const k of READ) (r[k] || []).forEach(m => add('FACTIONS.readings', m));
  }
  for(const a of A){
    add('ARMIES', a);
    for(const u of a.units){
      add('ARMIES.units', u);
      for(const k of ROWS) (u[k] || []).forEach(r => add('ARMIES.units.' + k, r));
      for(const k of READ) (u[k] || []).forEach(r => { if(typeof r !== 'string') add('ARMIES.units.' + k, r); });
    }
  }
  for(const s of Object.values(S)){ add('DATASHEETS', s); for(const k of ROWS.concat(READ)) (s[k] || []).forEach(r => add('DATASHEETS.' + k, r)); }
  (D.ruleOptions || []).forEach(r => add('RULE_OPTIONS', r)); (D.grants || []).forEach(r => add('GRANTS', r));
  add('BS_IDS', D.bsIds);
  return Object.fromEntries(Object.entries(T).map(([k, v]) => [k, [...v]]));
}
function unregistered(src){
  const reg = JSON.parse(fs.readFileSync(COLUMNS, 'utf8')).tables, out = [];
  for(const [t, cols] of Object.entries(columnsInData(src))){
    if(!reg[t]){ out.push(t + ' (the table)'); continue; }
    for(const c of cols) if(!reg[t].columns[c]) out.push(t + '.' + c);
  }
  for(const [t, x] of Object.entries(reg)) for(const [c, v] of Object.entries(x.columns || {})) if(!SOURCES.includes(v.source)) out.push(t + '.' + c + ': source "' + v.source + '" is none of ' + SOURCES.join(', '));
  return out;
}
const SOURCES = ['bsdata', 'wahapedia', 'gw', 'newrecruit', 'derived', 'hand', 'ai'];

// ------------------------------------------------------------------------------------------------------------------
// the report: the datasheets and every fact two lists have differently
// ------------------------------------------------------------------------------------------------------------------
// the readings by where they are: rows (datasheets, army rules, detachment rules, enhancements), the lists' entries; derived ones
function readingStats(t){
  const RT = t.B.RT, by = { ds:'datasheets', army:'army rules', det:'detachment rules', enh:'enhancements' }, rows = {};
  const kindOf = g => g.cls === 'ds' ? 'ds' : g.cls === 'enh' ? 'enh' : g.path[1] === 'armyRules' ? 'army' : 'det';
  for(const g of RT.groups.values()) if(g.agreed && g.list.length){ const k = kindOf(g), r = rows[k] = rows[k] || { what:by[k], n:0, copies:0 }; r.n += g.list.length; r.copies += [...g.obs.values()].reduce((n, xs) => n + xs.length, 0); }
  const conflictObs = [...RT.groups.values()].filter(g => !g.agreed).reduce((n, g) => n + [...g.obs.values()].reduce((m, xs) => m + xs.length, 0), 0);
  const derived = RT.derived.reduce((n, g) => n + g.list.length, 0), rules = {};
  const derivedList = RT.derived.map(g => { const r = (g.list[0] && require('./derive').readingsOf(readSource(t.R.D, [...g.obs.keys()][0].a, [...g.obs.keys()][0].u, g.list[0]) || '', g.from)) || {}; rules[r.rule] = (rules[r.rule] || 0) + g.list.length;
    return (g.cls === 'ds' ? g.sid : g.path.join(' · ')) + ' · ' + g.kind + ' · ' + g.from + ' (' + r.rule + '): ' + g.list.map(o => o.when + ': ' + o.note).join('; '); });
  return { rows:['ds', 'army', 'det', 'enh'].filter(k => rows[k]).map(k => rows[k]), own:RT.owns.length + conflictObs, ownWhy:RT.owns.filter(x => x.c.why).length, ownConflict:conflictObs + RT.owns.filter(x => !x.c.why).length,
    derived, derivedRules:Object.entries(rules).map(([k, n]) => k + ' ' + n).join(', ') || 'none', derivedList };
}
function report(t){
  const B = t.B, sheets = Object.keys(B.sheets), units = B.armies.reduce((n, a) => n + a.units.length, 0);
  const users = {}; for(const a of B.armies) for(const u of a.units) for(const id of [].concat(u.ds)) (users[id] = users[id] || new Set()).add(a.id);
  const shared = sheets.filter(id => users[id] && users[id].size > 1);
  const show = v => v === null ? '(none)' : '`' + (typeof v === 'string' ? v : JSON.stringify(v)).replace(/`/g, '\'').replace(/\n/g, '\\n') + '`';
  const lines = ['# Datasheets and their conflicts', '', B.armies.length + ' lists, ' + units + ' unit entries, ' + sheets.length + ' datasheets (' + shared.length + ' used by more than one list: ' + shared.join(', ') + ').', '',
    '## Conflicts (' + B.conflicts.length + ')', '',
    'Facts of one datasheet that two lists have differently. Neither is picked: the datasheet leaves the fact out and each list keeps its own',
    'value in `over` (on its entry, or on its row), as before. To decide one: put the value on the datasheet in DATASHEETS, delete the `over`s, run',
    '`node verify/tables.js --write` and the gate.', ''];
  for(const c of B.conflicts){
    lines.push('- **' + c.where + '** · `' + c.field + '`');
    for(const v of c.values) lines.push('  - ' + show(v.value) + ': ' + v.lists.join(', '));
  }
  const whys = [];
  for(const a of B.armies) for(const u of a.units){
    for(const [f, m] of Object.entries(u.why || {})) if(typeof m === 'string') whys.push('- ' + a.id + '/' + u.id + ' · `' + f + '`: ' + m); else for(const [v, r] of Object.entries(m)) whys.push('- ' + a.id + '/' + u.id + ' · `' + f + '` ' + show(v) + ': ' + r);
    for(const k of ROWS) for(const r of Array.isArray(u[k]) ? u[k] : []) for(const [f, why] of Object.entries(r.why || {})) whys.push('- ' + a.id + '/' + u.id + ' · ' + k + ' · ' + r.name + ' · `' + f + '` ' + show(r[f]) + ': ' + why);
  }
  lines.push('', '## The lists\' own values, with their reason (' + whys.length + ')', '', 'Values a list has that its datasheet does not, because of the list: the Warlord, a rule in force (GRANTS), an enhancement or',
    'upgrade, an ability its wargear gives, the weapons it took. On the entry as the list\'s value; `why` names the reason (written by --write).', '', ...whys);
  // the readings: on which rows, derived, conflicts, what stays on the lists
  const RS = readingStats(t);
  lines.push('', '## Readings', '', 'Each reading (a footnote `mods`, an `aura`, a `guard` line) is on the row of the rule it reads: ' + RS.rows.map(r => r.n + ' on ' + r.what + ' (' + r.copies + ' unit copies)').join(', ') +
    '; ' + RS.own + ' on the lists\' entries (' + RS.ownWhy + ' the list\'s own, with `why`; ' + RS.ownConflict + ' kept per list, conflicts below). ' + RS.derived + ' of them are derived from their text by verify/derive.js (`readBy`): ' + RS.derivedRules + '.', '');
  lines.push('### Reading conflicts (' + B.RT.readConflicts.length + ')', '', 'Readings of one ability (or rule, or enhancement) that two lists have otherwise. Neither is picked: the row has none of them and each list',
    'keeps its own on its entry. To decide one: read the rule against GW\'s text, make the lists\' readings alike (in the old form, `--expand`), `--write`, the gate.', '');
  for(const c of B.RT.readConflicts){ lines.push('- **' + c.where + '** · `' + c.field + '`'); for(const v of c.values) lines.push('  - ' + show(v.value) + ': ' + v.lists.join(', ')); }
  lines.push('', '### Readings that stay on the lists (' + B.RT.owns.length + ')', '', ...B.RT.owns.map(x => '- ' + x.U.a.id + '/' + x.U.u.id + ' · ' + x.kind + ' · ' + x.m.from + ': ' + (x.c.why || 'cannot be moved: ' + x.c.cant)));
  lines.push('', '### Derived readings (' + RS.derived + ')', '', ...RS.derivedList.map(x => '- ' + x));
  if(B.notes.length) lines.push('', '## Notes', '', ...B.notes.map(n => '- ' + n));
  return lines.join('\n') + '\n';
}

module.exports = { readSources, readFp, readingStats, RESOLVER, resolveArmies, read, build, tableForm, oldForm, evaluate, stable, eq, fp, sites, columnsInData, FINGERPRINT, FP_KEYS, READ, READ_FP, READ_BY, READ_COLS, readSource, ROWS, DS_UNIT, MARK };

if(require.main === module){
  let src = fs.readFileSync(DATA, 'utf8');
  const arg = process.argv.slice(2), has = a => arg.includes(a);
  if(has('--expand')){ fs.writeFileSync(DATA, oldForm(src)); console.log('tables: data.js written in the old form (every unit in full); node verify/tables.js --write puts it back'); process.exit(0); }
  if(has('--fingerprints')){
    const D = evaluate(src), R = read(src), bad = [], all = sites(D, R.armies);
    for(const x of all){
      const what = x.reading ? 'reading' : 'summary';
      if(x.reading && x.source == null && !x.want) bad.push('NO TEXT ' + x.where + ': nothing of its unit or list is the text it reads (' + x.col + '); name the rule it reads (from / rule)');
      else if(x.has === undefined) bad.push('NO FINGERPRINT ' + x.where + ' · ' + x.col + ': ' + (x.reading ? 'read from which text? check the reading against its text' : 'written from which text? check it against its text') + ', then node verify/tables.js --stamp');
      else if(x.sources){
        // a reading: each text it uses against its part of readOf
        const hs = x.has.split('+'), cs = x.sources.map((s, i) => ({ s, now:fp(s.text), was:hs[i] }));
        const missing = cs.filter(c => c.was === undefined), changed = cs.filter(c => c.was !== undefined && c.was !== c.now);
        if(changed.length) bad.push('STALE ' + x.where + ' (readOf ' + x.has + '): ' + changed.map(c => 'the text of ' + c.s.name + ' changed (' + c.was + ' → ' + c.now + ')').join('; ') + '; read it again from the new text, then node verify/tables.js --restamp');
        if(missing.length) bad.push('NO FINGERPRINT ' + x.where + ' for ' + missing.map(c => c.s.name).join(', ') + ' (a text it also uses): check the reading against it, then node verify/tables.js --stamp');
        if(!changed.length && !missing.length && hs.length > cs.length) bad.push('STALE ' + x.where + ' (readOf ' + x.has + '): it fingerprints ' + hs.length + ' texts, it uses ' + cs.length + ' (' + cs.map(c => c.s.name).join(', ') + '); node verify/tables.js --restamp after checking it');
      }
      else if(x.has !== fp(x.source)) bad.push('STALE ' + x.where + ' · ' + x.col + ' (' + x.fpKey + ' ' + x.has + ', its text now ' + fp(x.source) + '): the text the ' + what + ' ' + (x.reading ? 'reads' : 'summarises') + ' changed; ' + (x.reading ? 'read it again from the new text' : 'rewrite it from the new text') + ', then node verify/tables.js --restamp');
    }
    const ai = all.filter(x => !x.reading), rd = all.filter(x => x.reading), ok = xs => xs.filter(x => x.source != null && x.has === (x.want || fp(x.source))).length;
    console.log('fingerprints: ' + ok(ai) + ' of ' + ai.length + ' AI-written values (gist, def) and ' + ok(rd) + ' of ' + rd.length + ' readings (' + rd.filter(x => x.derived).length + ' derived) match the text they were written or read from' + (bad.length ? '; ' + bad.length + ' do not' : ''));
    bad.forEach(b => console.log('  ' + b));
    process.exit(bad.length ? 1 : 0);
  }
  if(has('--write') || has('--stamp') || has('--restamp')){
    const restamp = has('--restamp'), stamp = restamp || has('--stamp');
    let n = 0;
    if(stamp){ const s1 = stampConstants(src, evaluate(src), restamp); src = s1.src; n += s1.n; }
    let t = tableForm(src, stamp ? { stampRows:(A, D) => { n += stampRows(restamp)(A, D); } } : {});
    // (a rule's or enhancement's readings moved onto its row by this run: their fingerprints are written there too)
    if(stamp){ const s2 = stampConstants(t.text, evaluate(t.text), restamp); if(s2.n){ n += s2.n; t = tableForm(s2.src); } }
    const before = evaluate(src), after = evaluate(t.text);
    // (a derived reading whose words changed is written again from them: the one difference allowed)
    const re = [...t.B.RT.groups.values()].filter(g => g.rederived), skip = new Map();
    for(const g of re) for(const U of g.obs.keys()) skip.set(U.a.id + '/' + U.u.id, (skip.get(U.a.id + '/' + U.u.id) || new Set()).add(g.kind + '\0' + g.from));
    const drop = A => A.map(a => Object.assign({}, a, { units:a.units.map(u => { const sk = skip.get(a.id + '/' + u.id); if(!sk) return u; const v = Object.assign({}, u); for(const k of READ) if(v[k]) v[k] = v[k].filter(m => !sk.has(k + '\0' + m.from)); return v; }) }));
    if(!sameLists(drop(before.armies), drop(after.armies))){ console.log('tables: NOT written: the lists would resolve otherwise than they are (a bug in verify/tables.js)'); process.exit(1); }
    if(re.length) console.log('tables: written again from their changed words (derived readings, verify/derive.js): ' + re.map(g => (g.sid || g.path.join(' · ')) + ' · ' + g.from + (g.list.length ? '' : ' (no longer derivable: none now)')).join('; '));
    fs.writeFileSync(DATA, t.text);
    fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive:true }); fs.writeFileSync(path.join(ROOT, 'verify/out/tables.md'), report(t));
    console.log('tables: data.js written: ' + Object.keys(t.B.sheets).length + ' datasheets, ' + t.B.conflicts.length + ' conflicts kept per list (verify/out/tables.md)' + (stamp ? '; ' + n + ' fingerprints written' : '') + '; ' + Buffer.byteLength(src) + ' → ' + Buffer.byteLength(t.text) + ' bytes');
    process.exit(0);
  }
  // the gate
  const fails = [];
  const t = tableForm(src);
  if(t.text !== src){
    const a = src.split('\n'), b = t.text.split('\n'); let i = 0; while(i < a.length && a[i] === b[i]) i++;
    fails.push('data.js is not in table form as node verify/tables.js --write writes it (first difference at line ' + (i + 1) + ': ' + JSON.stringify((a[i] || '').slice(0, 100)) + ' → ' + JSON.stringify((b[i] || '').slice(0, 100)) + '): a list added in the old form, a datasheet edited, or RULE_OPTIONS / GRANTS out of date; run node verify/tables.js --write and read the diff');
  }
  const D0 = evaluate(src);
  if(!sameLists(D0.armies, evaluate(t.text).armies)) fails.push('the lists resolve otherwise than --write would write them');
  // the old form round-trips: --expand then --write gives this data.js again, and the same lists
  { const old = oldForm(src), back = tableForm(old).text;
    if(back !== src) fails.push('node verify/tables.js --expand then --write does not give this data.js back');
    if(!sameLists(evaluate(old).armies, D0.armies)) fails.push('data.js in the old form (--expand) resolves to other lists'); }
  for(const u of unregistered(src)) fails.push('not in verify/columns.json: ' + u + ' (say where its values come from)');
  fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive:true }); fs.writeFileSync(path.join(ROOT, 'verify/out/tables.md'), report(t));
  const B = t.B, units = B.armies.reduce((n, a) => n + a.units.length, 0);
  console.log('tables: ' + (fails.length ? fails.length + ' failure(s); ' : '') + units + ' unit entries in ' + B.armies.length + ' lists over ' + Object.keys(B.sheets).length + ' datasheets, ' + (D0.ruleOptions || []).length + ' rule options, ' + (D0.grants || []).length + ' grants; ' + B.conflicts.length + ' datasheet facts kept per list (verify/out/tables.md); every column has a source (verify/columns.json)');
  fails.forEach(f => console.log('  FAIL ' + f));
  process.exit(fails.length ? 1 : 0);
}
