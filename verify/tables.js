#!/usr/bin/env node
/* verify/tables.js: data.js as tables (docs/tables.md).
   A list's unit entry names its datasheet (DATASHEETS, one per faction + datasheet name) and holds only what the list
   chose: models, wargear, points, enhancement, warlord, attachment, copies, its notes and footnotes. The datasheet holds
   the datasheet's facts: stats, weapon profiles, abilities and their texts, keywords, core-rule line. data.js resolves the
   entries at load (resolveArmies, written into data.js from RESOLVER below), so the app sees each unit as it always did.

     node verify/tables.js               the gate: data.js is in table form exactly as --write would write it (a list
                                         added in the old form, a stale RULE_OPTIONS / GRANTS, fail), every column is in
                                         verify/columns.json; writes verify/out/tables.md (the datasheet conflicts)
     node verify/tables.js --fingerprints   the gate: every AI-written column (gist, def) carries the fingerprint of the
                                         text it was written from, and that text has not changed since
     node verify/tables.js --write       converts data.js: every unit entry written in full (the old form, as
                                         import-nr.js writes a list) becomes a reference to its datasheet; DATASHEETS,
                                         RULE_OPTIONS, GRANTS and the resolver are written again. Re-runnable: the same
                                         data.js gives the same file.
     node verify/tables.js --expand      writes data.js back in the old form (every unit in full, no DATASHEETS), the form
                                         the text-editing tools (write-grants.js, army-blocks.js) work on; --write after
     node verify/tables.js --stamp       writes the fingerprint of every gist / def that has none (after checking it
                                         against its text); --restamp also replaces the stale ones
   Where two lists' copies of one datasheet differ in a datasheet fact, the datasheet leaves that fact out and each list
   keeps its own value in `over` on its entry or row, until the owner decides (verify/out/tables.md lists them). */
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
const FP_KEYS = Object.values(FINGERPRINT);
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
// than another list (verify/out/tables.md), kept per list until it is decided. of: which datasheet of an attached unit a
// row is from, when its who does not say. Hidden from the app: ds, over, of, a datasheet's faction and bsId, and the
// fingerprints (gistOf, defOf) of AI-written columns.
function resolveArmies(armies, sheets, order, opts){
  opts = opts || {};
  var ROWS = ['stats', 'ranged', 'melee', 'abilities'];
  var HIDE = ['ds', 'over', 'of', 'faction', 'bsId'].concat(${JSON.stringify(Object.values(FINGERPRINT))}).filter(function(k){ return (opts.keep || []).indexOf(k) < 0; });
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
  return armies.map(function(a){
    return Object.assign({}, a, { units:a.units.map(function(u){
      if(!u.ds) return u;
      var ids = [].concat(u.ds), parts = ids.map(function(id){ if(!sheets[id]) throw new Error('data.js: ' + a.id + '/' + u.id + ' names no datasheet ' + id); return sheets[id]; });
      var out = {}, k, rest = {};
      for(k in parts[0]) if(ROWS.indexOf(k) < 0 && HIDE.indexOf(k) < 0) out[k] = copy(parts[0][k]);
      for(k in u) if(ROWS.indexOf(k) < 0) rest[k] = u[k];
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
          var row = put({}, copy(parts[at.p][kind][at.j])); put(row, r); if(r.over) put(row, r.over);
          return sorted(row, order[kind] || []);
        });
      });
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
  const tr = new Map();   // "ai/ui/kind" -> [{ sid, j }] per row
  const aIndex = new Map(A.value.map((a, i) => [a, i]));
  const armies = resolveArmies(A.value, sheets, order, { keep:FP_KEYS, trace:(a, u, kind, n, sid, j) => {
    const k = aIndex.get(a) + '/' + a.units.indexOf(u) + '/' + kind;
    if(!tr.has(k)) tr.set(k, []);
    tr.get(k)[n] = { sid, j };
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
      if(p.length >= 3 && ROWS.includes(p[1])){
        (tr.get(ai + '/' + ui + '/' + p[1]) || []).forEach((t, n) => { if(t && t.sid === sid && t.j === p[2]) add([ai, 'units', ui, p[1], n], c); });
      } else if(ids[0] === sid){
        if(p.length === 1) add([ai, 'units', ui, 'name'], c);
        else if(!(p[1] in u)) add([ai, 'units', ui, p[1]], c);
      }
    }));
  }
  return { src, A, S, O, armies, comments:C, order, bsIds:B ? B.value : {} };
}

// ------------------------------------------------------------------------------------------------------------------
// the tables: datasheets from the lists' units, and each list's entries
// ------------------------------------------------------------------------------------------------------------------
// the order keys are listed in: the one data.js has, if every object fits it; else by majority, as the objects have them
function keyOrder(seqs, prev){
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
          if(kind === 'stats'){ const i = names.indexOf(baseName(r.name)); part = i >= 0 ? i : names.length - 1; }
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
    if(k === 'name') return true;
    if(k === 'who') return o.kind !== 'abilities' || o.U.multi;
    if(k === 'na') return true;   // why it does nothing in this list
    if(o.kind === 'stats') return k === 'from' || k === 'printed' || k in from;
    if(o.kind === 'ranged' || o.kind === 'melee') return ['n', 'from', 'enh'].includes(k) || k in from || (k === 'kw' && Object.keys(from).some(x => !WEAPON_FIELDS.includes(x)));
    return false;
  };
  const conflicts = [];
  // a datasheet's value of a fact: what every place that has it as a datasheet fact agrees on; else a conflict
  const decide = (obs, val, has, voting, where, field) => {
    const votes = obs.filter(o => voting(o) && !(FP_KEYS.includes(field) && !has(o)));
    if(!votes.length) return { none:true };
    const vs = votes.map(o => has(o) ? stable(val(o)) : '\0absent');
    if(vs.every(v => v === vs[0])) return vs[0] === '\0absent' ? { none:true } : { value:val(votes[0]) };
    const by = new Map(); votes.forEach((o, i) => { if(!by.has(vs[i])) by.set(vs[i], []); by.get(vs[i]).push(o); });
    conflicts.push({ where, field, values:[...by.values()].map(os => ({ value:has(os[0]) ? val(os[0]) : null, lists:os.map(o => (o.U || o).a.id + '/' + (o.U || o).u.id) })) });
    return { conflict:true };
  };
  for(const s of sheets.values()){
    for(const kind of ROWS) for(const R of s.rows[kind].values()){
      R.ds = { name:R.key }; R.conflict = new Set();
      const fields = []; for(const o of R.obs) for(const k of Object.keys(o.r)) if(!listLevel(o, k) && !fields.includes(k)) fields.push(k);
      for(const f of keyOrder([fields], order[kind]).filter(f => fields.includes(f))){
        const d = decide(R.obs, o => o.r[f], o => f in o.r, o => !listLevel(o, f), s.id + ' · ' + kind + ' · ' + R.key, f);
        if(d.conflict) R.conflict.add(f); else if(!d.none) R.ds[f] = d.value;
      }
    }
    s.ds = { name:s.name, faction:s.faction };
    if(s.bs.size === 1) s.ds.bsId = [...s.bs.keys()][0];
    else if(s.bs.size > 1) conflicts.push({ where:s.id, field:'bsId', values:[...s.bs.entries()].map(([v, l]) => ({ value:v, lists:l })) });
    s.uconf = new Set();
    for(const f of DS_UNIT.slice(1)){
      const d = decide(s.unitObs, U => U.u[f], U => f in U.u, () => true, s.id, f);
      if(d.conflict) s.uconf.add(f); else if(!d.none) s.ds[f] = d.value;
    }
  }
  // comments on rows: on the datasheet's row when every place that shows it has the same; else on the lists' rows
  const SC = {}, AC = {};
  const addC = (M, p, c) => { const k = JSON.stringify(p); const x = M[k] = M[k] || { above:[], inline:[] }; x.above.push(...c.above); x.inline.push(...c.inline); };
  const rowC = new Map(), fieldC = [];
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
      if(k === 'name') continue;
      if(listLevel(o, k)) e[k] = o.r[k];
      else if(R.conflict.has(k)) over[k] = o.r[k];
    }
    for(const k of Object.keys(R.ds)) if(k !== 'name' && !(k in o.r) && !FP_KEYS.includes(k)) e[k] = null;
    for(const k of R.conflict) if(!(k in o.r) && !listLevel(o, k) && !FP_KEYS.includes(k)) over[k] = null;
    if(findPart(o.U, o.kind, e) !== o.part) e.of = o.part;
    if(Object.keys(over).length) e.over = over;
    return { e, plain:Object.keys(e).length === 1 && e.name === R.key };
  };
  const entries = units.map(U => {
    const u = U.u, s0 = sheetOf(U.ids[0]), e = { id:u.id, ds:U.multi ? U.ids : U.ids[0] }, over = {};
    for(const k of order.unit){
      if(!(k in u) || k === 'id' || k === 'name') continue;
      if(ROWS.includes(k)) continue;
      if(DS_UNIT.includes(k)){
        if(!U.multi){ if(s0.uconf.has(k)) over[k] = u[k]; }
        else if(!eq(u[k], s0.ds[k])) e[k] = u[k];
      } else e[k] = u[k];
    }
    for(const k of Object.keys(u)) if(!(k in e) && !order.unit.includes(k)) e[k] = u[k];
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
    if(Object.keys(over).length) e.over = over;
    // the entry's keys: id, ds, then as resolved units list them, over last
    const out = { id:e.id, ds:e.ds };
    for(const k of order.unit.concat(ROWS)) if(k in e && !(k in out)) out[k] = e[k];
    for(const k of Object.keys(e)) if(!(k in out) && k !== 'over') out[k] = e[k];
    if(e.over) out.over = e.over;
    U.entry = out;
    return out;
  });
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
    const cs = all.map(U => merged.get(U));
    if(cs.every(c => c && stable(c) === stable(cs[0]))){ (s.fieldComments = s.fieldComments || {})[f] = cs[0]; continue; }
    for(const [U, c] of merged) addC(AC, [U.ai, 'units', U.ui, 'ds'], c);
  }
  // the datasheets: by faction (FACTIONS' order), then as the lists first show them
  const factionOrder = [...new Set(armies.map(a => a.faction))];
  const list = [...sheets.values()].sort((x, y) => factionOrder.indexOf(x.faction) - factionOrder.indexOf(y.faction));
  const table = {}, tableC = {};
  for(const s of list){
    const d = Object.assign({}, s.ds);
    for(const kind of ROWS) if(s.rows[kind].size) d[kind] = [...s.rows[kind].values()].map(R => R.ds);
    const o = { name:d.name, faction:d.faction }; if(d.bsId) o.bsId = d.bsId;
    for(const k of order.unit.concat(ROWS)) if(k in d && !(k in o)) o[k] = d[k];
    for(const k of Object.keys(d)) if(!(k in o)) o[k] = d[k];
    table[s.id] = o;
    for(const kind of ROWS) [...s.rows[kind].values()].forEach((R, j) => { if(R.comment) addC(tableC, [s.id, kind, j], R.comment); });
    for(const [f, c] of Object.entries(s.fieldComments || {})) addC(tableC, [s.id, f], c);
  }
  const armiesNew = armies.map((a, ai) => Object.assign({}, a, { units:units.filter(U => U.ai === ai).map(U => U.entry) }));
  return { armies:armiesNew, sheets:table, order, armyComments:AC, sheetComments:tableC, conflicts, notes, shared:list.filter(s => s.all.length + 0 > 1 || s.rows.stats.size && [...s.rows.stats.values()].some(R => new Set(R.obs.map(o => o.U)).size > 1)).length };
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

const RETURN_RE = /\nreturn \{ version:VERSION[^\n]*\};\n/;
// data.js in table form, from data.js in any form
function tableForm(src, opts){
  opts = opts || {};
  const R = read(src);
  if(opts.stampRows) opts.stampRows(R.armies);
  const B = build(R);
  // the parts of data.js outside the tables, as they are
  let out = src;
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
  l = l.replace(/armies:(?:ARMIES|resolveArmies\(ARMIES, DATASHEETS, TABLE_ORDER\))/, tables ? 'armies:resolveArmies(ARMIES, DATASHEETS, TABLE_ORDER)' : 'armies:ARMIES')
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
      (d.stratagems || []).forEach((x, i) => each('FACTIONS', [fk, 'detachments', dk, 'stratagems', i], f.name + ' · ' + d.name + ' · ' + x.name, x, stratText(x)));
    }
  }
  const seen = new Set();
  armies.forEach(a => a.units.forEach(u => (u.abilities || []).forEach(ab => {
    const k = ab.name + '\n' + ab.text + '\n' + ab.def; if(seen.has(k)) return; seen.add(k);
    each('ARMIES', null, a.id + ' · ' + u.name + ' · ' + ab.name, ab, ab.text);
  })));
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
      else if(restamp && x.has !== want){ const n = node(x.path.concat(x.fpKey), false); edits.push({ at:n.pos, del:n.end - n.pos, text:q(want) }); }
    }
  }
  edits.sort((a, b) => b.at - a.at);
  for(const e of edits) src = src.slice(0, e.at) + e.text + src.slice(e.at + e.del);
  return { src, n:edits.length };
}
const stampRows = restamp => armies => { let n = 0; for(const a of armies) for(const u of a.units) for(const ab of u.abilities || []) if(typeof ab.def === 'string' && (ab.defOf === undefined || (restamp && ab.defOf !== fp(ab.text)))){ ab.defOf = fp(ab.text); n++; } return n; };

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
      add('FACTIONS.detachments', d); if(d.rule) add('FACTIONS.detachments.rule', d.rule);
      (d.stratagems || []).forEach(x => add('FACTIONS.detachments.stratagems', x)); (d.enhancements || []).forEach(x => add('FACTIONS.detachments.enhancements', x));
    }
  }
  for(const a of A){
    add('ARMIES', a);
    for(const u of a.units){
      add('ARMIES.units', u);
      for(const k of ROWS) (u[k] || []).forEach(r => add('ARMIES.units.' + k, r));
      for(const k of ['mods', 'aura', 'guard']) (u[k] || []).forEach(r => add('ARMIES.units.' + k, r));
    }
  }
  for(const s of Object.values(S)){ add('DATASHEETS', s); for(const k of ROWS) (s[k] || []).forEach(r => add('DATASHEETS.' + k, r)); }
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
  if(B.notes.length) lines.push('', '## Notes', '', ...B.notes.map(n => '- ' + n));
  return lines.join('\n') + '\n';
}

module.exports = { RESOLVER, resolveArmies, read, build, tableForm, oldForm, evaluate, stable, eq, fp, sites, columnsInData, FINGERPRINT, ROWS, DS_UNIT, MARK };

if(require.main === module){
  let src = fs.readFileSync(DATA, 'utf8');
  const arg = process.argv.slice(2), has = a => arg.includes(a);
  if(has('--expand')){ fs.writeFileSync(DATA, oldForm(src)); console.log('tables: data.js written in the old form (every unit in full); node verify/tables.js --write puts it back'); process.exit(0); }
  if(has('--fingerprints')){
    const D = evaluate(src), R = read(src), bad = [];
    for(const x of sites(D, R.armies)){
      if(x.has === undefined) bad.push('NO FINGERPRINT ' + x.where + ' · ' + x.col + ': written from which text? check it against its text, then node verify/tables.js --stamp');
      else if(x.has !== fp(x.source)) bad.push('STALE ' + x.where + ' · ' + x.col + ' (' + x.fpKey + ' ' + x.has + ', its text now ' + fp(x.source) + '): the text it summarises changed; rewrite it from the new text, then node verify/tables.js --restamp');
    }
    const n = sites(D, R.armies).length;
    console.log('fingerprints: ' + (n - bad.length) + ' of ' + n + ' AI-written values (gist, def) match the text they were written from' + (bad.length ? '; ' + bad.length + ' do not' : ''));
    bad.forEach(b => console.log('  ' + b));
    process.exit(bad.length ? 1 : 0);
  }
  if(has('--write') || has('--stamp') || has('--restamp')){
    const restamp = has('--restamp'), stamp = restamp || has('--stamp');
    let n = 0;
    if(stamp){ const s1 = stampConstants(src, evaluate(src), restamp); src = s1.src; n += s1.n; }
    const t = tableForm(src, stamp ? { stampRows:A => { n += stampRows(restamp)(A); } } : {});
    const before = evaluate(src), after = evaluate(t.text);
    if(!eq(before.armies, after.armies)){ console.log('tables: NOT written: the lists would resolve otherwise than they are (a bug in verify/tables.js)'); process.exit(1); }
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
  if(!eq(D0.armies, evaluate(t.text).armies)) fails.push('the lists resolve otherwise than --write would write them');
  for(const u of unregistered(src)) fails.push('not in verify/columns.json: ' + u + ' (say where its values come from)');
  fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive:true }); fs.writeFileSync(path.join(ROOT, 'verify/out/tables.md'), report(t));
  const B = t.B, units = B.armies.reduce((n, a) => n + a.units.length, 0);
  console.log('tables: ' + (fails.length ? fails.length + ' failure(s); ' : '') + units + ' unit entries in ' + B.armies.length + ' lists over ' + Object.keys(B.sheets).length + ' datasheets, ' + (D0.ruleOptions || []).length + ' rule options, ' + (D0.grants || []).length + ' grants; ' + B.conflicts.length + ' datasheet facts kept per list (verify/out/tables.md); every column has a source (verify/columns.json)');
  fails.forEach(f => console.log('  FAIL ' + f));
  process.exit(fails.length ? 1 : 0);
}
