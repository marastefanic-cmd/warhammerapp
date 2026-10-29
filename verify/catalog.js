#!/usr/bin/env node
/* verify/catalog.js: the gate step catalog. Every faction catalogue (verify/sources/catalog/<faction>.json, written by
   verify/from-bsdata.js) is checked as a list is (docs/catalog.md):
     filter     the explicit Legends / Crusade / Crucible filter of verify/bs-catalog.js, on fixed cases (a test of the filter)
                and on the catalogue (what it leaves out, each with its rule)
     complete   every current datasheet of the BSData catalogue at the pin (after the filter) is a catalogue row, none extra; every
                detachment of its Detachment entry is a detachment of the faction in data.js (by GW's name or BSData's, nr), none
                extra
     fresh      the catalogue file is what verify/from-bsdata.js reads from the sources now (deterministic: the same file)
     tables     every catalogue row is in DATASHEETS: a row no list has, exactly (aiStatus 'not-read'); a row a list has keeps the
                lists' signed-off facts, and every difference from the catalogue row is one of the kinds below (else declared in
                verify/deviations-catalog.json with its reason and evidence):
                  fill     the row lacks it (a fact no list shows as the datasheet's, a weapon no list took): DATASHEETS has the
                           catalogue's
                  markup   the same words, bold or capitals placed otherwise (verify/texts.js compares words)
                  tag      the row's text starts with its tag in brackets, "(Once per battle, per unit) …" (New Recruit's PDF),
                           the catalogue's has the tag on its own (as Wahapedia and most rows of data.js do)
                  rules    the Rules line: the row's is its lists' (the weapons they took, New Recruit's spelling), every rule of
                           it in the catalogue's
     nr         the same, for every unit of every list of the faction (each part's rows, as nr.js checked them against the PDF):
                each of its rows is a row of the catalogue with the same values, but for what a rule of the list changes (from)
     bsdata     every value of every catalogue row equals BSData's own (the entry before any modifier), or the difference is
                declared in verify/deviations-bsdata.json (army "catalog": GW's value over BSData's, with the datasheet as
                evidence, as for a list); a declaration nothing matches fails
     texts      every ability's words are on the datasheet's Wahapedia page (GW's codex) or GW's Printed Product Updates / Faction
                Pack for it; every detachment's rule, enhancement and stratagem words are checked by verify/texts.js as every
                detachment of data.js is
     bases      by verify/bases.js (every DATASHEETS row's models, the catalogue's too)
   node verify/catalog.js            the gate (verify/out/catalog.json)
   node verify/catalog.js --fast     without fresh (which reads the whole catalogue again, about a minute) */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BC = require('./bs-catalog');
const NR = require('./nr');
const { nm, cellV, textEq, splitItems } = NR;

const typo = s => String(s).replace(/'/g, '’');
const lc = s => String(s).toLowerCase().replace(/[’‘]/g, "'");
const gwN = v => nm(String(v == null ? '' : v)).replace(/\s*x\s*/gi, '×').replace(/^(?:-|–|N\/A)?$/, '–').toLowerCase();
const plainBS = t => String(t || '').replace(/\^\^/g, '').replace(/\*\*/g, '').replace(/(^|\s)\*(?=\S)|(?<=\S)\*(?=\s|$|[.,;:])/g, '$1').replace(/ /g, ' ');
const words = t => lc(String(t || '').replace(/\*\*|~~|\*/g, '')).replace(/[^a-z0-9+"]+/g, ' ').trim();
const stable = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(y => [y, x[y]])) : x);
const WEAPON = ['Ranged Weapons', 'Melee Weapons'];
const weaponShaped = p => p.typeName !== 'Unit' && ['Range', 'A', 'S', 'AP', 'D'].every(k => (p.characteristics || []).some(c => c.name === k)) && (p.characteristics || []).some(c => c.name === 'BS' || c.name === 'WS');
const isWeaponProf = p => WEAPON.includes(p.typeName) || weaponShaped(p);
const weaponKind = p => p.typeName === 'Ranged Weapons' || (!WEAPON.includes(p.typeName) && !/^melee$/i.test(((p.characteristics || []).find(c => c.name === 'Range') || {}).$text || '')) ? 'ranged' : 'melee';

// ---------------------------------------------------------------- the filter, on fixed cases
function filterTest() {
  const fails = [];
  const fake = (name, cats, extra) => Object.assign({ name, type: 'unit', categoryLinks: (cats || []).map((c, i) => ({ name: c, targetId: 'x' + i })), costs: [{ name: 'pts', typeId: '51b2-306e-1021-d207', value: 100 }] }, extra || {});
  const C = { classify: null };
  const cls = (e, l) => { for (const F of BC.FILTER) if (F.test(e, l, (e.categoryLinks || []).map(c => c.name).concat(((l || {}).categoryLinks || []).map(c => c.name)))) return F.kind; return 'datasheet'; };
  const cases = [
    [fake('Aleya [Legends]'), 'legends'], [fake('Old Thing', ['Legends']), 'legends'], [fake('Thing'), 'legends', { name: 'Thing [Legends]' }],
    [fake('Order of Battle', [], { type: 'upgrade' }), 'crusade'], [fake('Crusade Relics'), 'crusade'], [fake('Hero', ['Crusade']), 'crusade'],
    [fake('Hero', [], { costs: [{ name: 'Crusade Points', value: 1 }] }), 'crusade'], [fake('Weapon Modifications'), 'crusade'], [fake('Battle Honours'), 'crusade'],
    [fake('Null Maiden [Crucible]'), 'crucible'], [fake('Exemplar', ['Crucible']), 'crucible'],
    [fake('Custodian Guard Sodality', ['Infantry', 'Battleline']), 'datasheet'], [fake('Legendary Hero'), 'datasheet'], [fake('Crucible of Fire Squad'), 'datasheet']];
  for (const [e, want, l] of cases) { const got = cls(e, l || null); if (got !== want) fails.push('filter: ' + e.name + (l ? ' (link ' + l.name + ')' : '') + ' is ' + got + ', want ' + want); }
  // inside a datasheet: BSData's Crusade group, Weapon Modifications, Crusade Relic Upgrades are no options
  for (const n of ['Crusade', 'Weapon Modifications', 'Crusade Relic Upgrades', 'Battle Scars', 'Codex Crusade Relics']) if (!BC.CRUSADE.test(n)) fails.push('filter: the group ' + n + ' is not read as Crusade');
  return { cases: cases.length, fails };
}

// ---------------------------------------------------------------- BSData's own reading of a datasheet (the entry, before any modifier)
function bsReading(sel, C) {
  const out = { stats: {}, ranged: {}, melee: {}, abilities: {}, kw: new Set(), rules: new Set() };
  const walk = s => {
    for (const p of s.profiles || []) {
      if (p.typeName === 'Unit') {
        const ch = Object.fromEntries(p.characteristics.map(c => [c.name, c.$text || ''])), n = typo(NR.nrStatName(p.name, []).name);
        out.stats[n] = { M: cellV(ch.M), T: cellV(ch.T), Sv: cellV(ch.Sv), W: cellV(ch.W), Ld: cellV(ch.LD), OC: cellV(ch.OC), InSv: cellV(ch.InSv), base: cellV(ch.Base).replace(/(\d)x(\d)/g, '$1×$2') };
      } else if (isWeaponProf(p)) {
        const w = NR.nrWeapon({ name: p.name }, []), kind = weaponKind(p);
        if (!w.group && /^\s*➤/.test(p.name) && (s.profiles || []).filter(isWeaponProf).length > 1) w.group = nm(s.name);
        const ch = Object.fromEntries(p.characteristics.map(c => [c.name, c.$text || '']));
        const key = typo(w.name) + (w.group ? ' (' + typo(w.group) + ')' : '');
        out[kind][key] = { range: cellV(ch.Range), A: cellV(ch.A), [kind === 'ranged' ? 'BS' : 'WS']: cellV(ch.BS || ch.WS), S: cellV(ch.S), AP: cellV(ch.AP), D: cellV(ch.D), kw: splitItems(ch.Keywords || '').map(nm).filter(Boolean).map(x => x.replace(/^[^:]+/, y => y.toUpperCase())) };
      } else if (p.typeName === 'Transport') {
        // (BSData's Transport profile, named after the unit: the ability Transport, its characteristic's name the tag, as verify/from-json.js reads it)
        out.abilities.Transport = { text: plainBS(p.characteristics.map(c => c.$text || '').join('\n')), tag: typo(nm(p.characteristics[0].name)), type: p.typeName };
      } else {
        const a = NR.nrAbility(p.name, []), n = typo(a.paren !== null && /\d\+\*?$/.test(a.paren) ? a.full : a.base);
        let text = plainBS(p.characteristics.map(c => c.$text || '').join('\n')), tag = a.paren !== null && n === typo(a.base) ? a.paren : null;
        // (a tag BSData prints at the start of the words, "(Once per battle, per unit) In your …": the ability's tag, as GW names it)
        const t0 = /^\(([^)]+)\):?\s+([\s\S]*)$/.exec(text);
        if (t0 && !tag) { tag = t0[1]; text = t0[2]; }
        out.abilities[n] = { text, tag, type: p.typeName };
      }
    }
    for (const r of s.rules || []) out.rules.add(typo(nm(r.name)));
    if (!(s.profiles || []).some(isWeaponProf)) for (const c of s.categories || []) { const ce = C.get(c.entryId); if (!(ce && ce.hidden)) out.kw.add(nm(c.name)); }
    for (const k of s.selections || []) walk(k);
  };
  walk(sel);
  return out;
}
// every difference of a catalogue row from BSData's reading: { field, app, source }, as verify/bsdata.js names a list's
function bsDiffs(row, bs) {
  const out = [], put = (field, app, source) => out.push({ field, app: app === undefined ? null : app, source: source === undefined ? null : source });
  for (const r of row.stats || []) {
    const b = bs.stats[r.name];
    if (!b) { put('stats[' + r.name + ']', r.name, null); continue; }
    for (const k of ['M', 'T', 'Sv', 'W', 'Ld', 'OC', 'InSv', 'base']) if (gwN(r[k]) !== gwN(b[k])) put('stats[' + r.name + '].' + k, r[k], b[k]);
  }
  for (const n of Object.keys(bs.stats)) if (!(row.stats || []).some(r => r.name === n)) put('stats[' + n + ']', null, n);
  for (const kind of ['ranged', 'melee']) {
    for (const r of row[kind] || []) {
      const key = r.name + (r.group ? ' (' + r.group + ')' : ''), b = bs[kind][key];
      if (!b) { put(kind + '[' + key + ']', key, null); continue; }
      for (const k of ['range', 'A', 'BS', 'WS', 'S', 'AP', 'D']) if ((r[k] !== undefined || b[k] !== undefined) && gwN(r[k]) !== gwN(b[k])) put(kind + '[' + key + '].' + k, r[k], b[k]);
      const ka = (r.kw || []).map(x => x.toUpperCase()).sort(), kb = (b.kw || []).map(x => x.toUpperCase()).sort();
      if (stable(ka) !== stable(kb)) put(kind + '[' + key + '].kw', (r.kw || []).join(', '), (b.kw || []).join(', '));
    }
    for (const k of Object.keys(bs[kind])) if (!(row[kind] || []).some(r => r.name + (r.group ? ' (' + r.group + ')' : '') === k)) put(kind + '[' + k + ']', null, k);
  }
  const used = new Set();
  for (const a of row.abilities || []) {
    const n = Object.keys(bs.abilities).find(x => !used.has(x) && lc(x) === lc(a.name)) || Object.keys(bs.abilities).find(x => !used.has(x) && textEq(a.text || '', bs.abilities[x].text));
    if (!n) { put('ability[' + a.name + ']', a.name, null); continue; }
    used.add(n);
    if (lc(n) !== lc(a.name)) put('ability[' + a.name + '].name', a.name, n);
    if (!textEq(a.text || '', bs.abilities[n].text) && words(a.text) !== words(bs.abilities[n].text)) put('ability[' + a.name + '].text', a.text, bs.abilities[n].text);
    const bt = bs.abilities[n].tag;
    if ((a.tag || null) !== (bt || null) && !(a.tag && bt && a.tag.split(' · ').some(t => lc(t) === lc(bt)))) put('ability[' + a.name + '].tag', a.tag || null, bt || null);
  }
  for (const n of Object.keys(bs.abilities)) if (!used.has(n)) put('ability[' + n + ']', null, n);
  const kw = new Set(row.kw || []);
  for (const k of kw) if (![...bs.kw].some(x => lc(x) === lc(k))) put('kw', k, null);
  for (const k of bs.kw) if (![...kw].some(x => lc(x) === lc(k))) put('kw', null, k);
  const ru = row.rules || [];
  for (const r of ru) if (![...bs.rules].some(x => lc(x) === lc(r))) put('rules', r, null);
  for (const r of bs.rules) if (!ru.some(x => lc(x) === lc(r))) put('rules', null, r);
  return out;
}

// ---------------------------------------------------------------- the declarations verify/from-bsdata.js --write writes
// (each difference of a row from BSData, with GW's evidence from the reading: verify/from-json.js's comparisons with the datasheet)
function declarations(root, faction, r) {
  const { C, E } = r, out = [];
  const pinS = 'BSData at the pin (' + C.cat.name + ' catalogue revision ' + C.cat.revision + ')';
  const roots = new Map(C.roots().filter(x => x.kind === 'datasheet').map(x => [x.entry.id, x]));
  for (const [id, row] of Object.entries(r.cat.datasheets)) {
    const sel = C.selection(roots.get(row.bsId)), bs = bsReading(sel, C), uid = id.split('/')[1];
    const G = (E.gwRules || {})[uid] || { files: [] };
    for (const d of bsDiffs(row, bs)) {
      let reason = null, evidence = null, m;
      const gd = E.gwDevs.filter(x => x.unit === uid), jd = E.devs.filter(x => x.unit === uid);
      if ((m = /^(stats|ranged|melee)\[(.*?)(?: \((.*)\))?\]\.(\w+)$/.exec(d.field))) {
        const kind = m[1] === 'stats' ? (m[4] === 'base' ? 'base' : 'stats') : m[1];
        const g = gd.find(x => x.kind === kind && (x.row === m[2] || x.row === m[3] || x.row === (m[3] ? m[3] + ' - ' + m[2] : m[2])) && x.field === m[4]);
        if (g) { reason = pinS + ' has ' + (d.source || 'none') + '; ' + (kind === 'base' ? 'GW’s base size guide (Event Companion), or Wahapedia’s datasheet where the guide has none,' : 'GW’s datasheet (the codex, as Wahapedia transcribes it)') + ' has ' + g.app + '. GW wins.'; evidence = g.file; }
      } else if (d.field === 'kw') {
        const g = gd.find(x => x.kind === 'kw' && ((d.app && x.app === d.app) || (!d.app && x.bsdata === d.source)));
        if (g) { reason = d.app ? 'GW’s datasheet has the keyword ' + d.app.toUpperCase() + '; ' + pinS + ' does not. GW wins.' : pinS + ' gives the category ' + d.source + (g.det ? ', the ' + g.det + ' detachment’s keyword' : '') + '; GW’s datasheet does not print it. GW wins.'; evidence = 'verify/.cache/waha/ds/' + String(g.file).replace(/^verify\/\.cache\/waha\/ds\//, '') + ': KEYWORDS.'; }
      } else if (d.field === 'rules') {
        const j = jd.find(x => x.field === 'rules' && (x.name === d.app || x.bsdata === d.source || x.app === d.app));
        if (j) { reason = j.why + '. GW wins.'; evidence = j.file + ': CORE ABILITIES / ARMY RULES.'; }
      } else if ((m = /^ability\[(.*)\](?:\.(\w+))?$/.exec(d.field))) {
        const an = m[1], f = m[2];
        for (const [sec, list] of [['Leader', G.leader], ['Support', G.support]]) if (an === sec && (list || []).length && (f === 'text' || (!f && d.app))) { reason = 'GW’s datasheet (its ' + sec.toUpperCase() + ' section) lets this model be attached to ' + list.join(', ') + '; ' + pinS + '’s ' + sec + ' ability ' + (d.source ? 'names them otherwise (the previous codex’s list, or its own names)' : 'is not a profile of the entry') + '. GW wins.'; evidence = (G.files || [])[0] + ': ' + sec.toUpperCase() + ' "This model can be attached to the following units: ' + list.join(', ') + '".'; }
        const j = jd.find(x => (f === 'text' && x.field === 'ability.text' && lc(x.name) === lc(an)) || (f === 'tag' && x.field === 'ability.tag' && lc(x.name) === lc(an))
          || (f === 'name' && x.field === 'ability' && lc(x.app || '') === lc(an)) || (!f && x.field === 'ability' && ((d.app && lc(x.app || '') === lc(d.app)) || (d.source && lc(x.bsdata || '') === lc(d.source)))));
        if (!reason && j) { reason = (j.why || 'GW’s datasheet (Wahapedia, the codex) words it otherwise than BSData') + '. GW wins.'; evidence = j.file + (j.app && f === 'text' ? ': "' + nm(String(j.app).replace(/\*\*/g, '')).slice(0, 240) + '"' : '') + '.'; }
        // (GW's tag where BSData prints another one at the start of the words: the datasheet's, its ability's name)
        if (!reason && f === 'tag' && d.app) { reason = 'GW’s datasheet (Wahapedia, the codex) tags the ability (' + d.app + '); ' + pinS + ' has ' + (d.source ? '(' + d.source + ')' : 'none') + '. GW wins.'; evidence = (G.files || []).join(', ') + ': ABILITIES "' + an + ' (' + d.app + ')".'; }
        // (GW's name for an ability BSData names otherwise: the name, found by the words)
        if (!reason && f === 'name') { reason = 'GW’s name for the ability (Wahapedia’s datasheet); ' + pinS + ' names it ' + d.source + '. GW wins.'; evidence = (G.files || []).join(', ') + ': ABILITIES "' + an + '".'; }
      }
      if (reason) out.push({ army: 'catalog', unit: id, field: d.field, app: d.app, source: d.source, reason, evidence, by: 'verify/from-bsdata.js' });
    }
  }
  return out;
}

// ---------------------------------------------------------------- a row against the catalogue's (tables, nr)
const KINDS = ['stats', 'ranged', 'melee', 'abilities'];
function rowDiffs(S, R, opts) {
  opts = opts || {};
  const out = [], put = (kind, what, data, cat) => out.push({ kind, what, data, cat });
  for (const f of ['name', 'role', 'kw', 'kwOnly', 'bsId']) {
    if (!(f in S)) { if (R[f] !== undefined && !opts.listUnit) put('fill', f, null, R[f]); continue; }
    if (stable(S[f]) !== stable(R[f])) put(opts.listUnit && f !== 'name' ? 'list' : 'other', f, S[f], R[f]);
  }
  if ('rules' in S) {
    const miss = S.rules.filter(r => !(R.rules || []).some(x => lc(x) === lc(r)));
    put(miss.length ? 'other' : stable(S.rules) === stable(R.rules) ? 'same' : 'rules', 'rules', S.rules, R.rules);
  } else if (!opts.listUnit && R.rules) put('fill', 'rules', null, R.rules);
  for (const kind of KINDS) {
    const key = r => kind === 'stats' ? String(r.name).replace(/ ×\d+$/, '') : r.name;
    const b = new Map((R[kind] || []).map(r => [key(r), r]));
    for (const r of S[kind] || []) {
      const c = b.get(key(r));
      if (!c) { put(opts.listUnit && kind === 'abilities' && /\b(Enhancement|Upgrade)\b/.test(r.tag || '') ? 'list' : 'other', kind + ' ' + key(r) + ': not in the catalogue', r, null); continue; }
      const fields = kind === 'stats' ? ['M', 'T', 'Sv', 'W', 'Ld', 'OC', 'InSv', 'base'] : kind === 'abilities' ? ['tag', 'damaged', 'text'] : ['range', 'A', 'BS', 'WS', 'S', 'AP', 'D', 'kw', 'group', 'fireAll', 'hunter'];
      for (const f of fields) {
        if (stable(r[f]) === stable(c[f])) continue;
        if (r[f] === undefined) { if (!opts.listUnit) put('fill', kind + ' ' + key(r) + ' ' + f, null, c[f]); continue; }
        if (opts.listUnit && r.from && f in r.from) continue;   // a value a rule of the list gives
        if (opts.listUnit && f === 'kw' && r.from) { const own = (r.kw || []).filter(k => !Object.keys(r.from).includes(k)); if (stable(own.map(x => x.toUpperCase()).sort()) === stable((c.kw || []).map(x => x.toUpperCase()).sort())) continue; }
        if (f === 'text' && words(r.text) === words(c.text)) { put('markup', kind + ' ' + key(r) + ' text', r.text, c.text); continue; }
        if (f === 'text' && r.tag && words(r.text) === words('(' + r.tag + ') ' + c.text)) { put('tag', kind + ' ' + key(r) + ' text', r.text, c.text); continue; }
        if (kind !== 'abilities' && f === 'kw' && stable((r.kw || []).map(x => x.toUpperCase()).sort()) === stable((c.kw || []).map(x => x.toUpperCase()).sort())) continue;
        put('other', kind + ' ' + key(r) + ' ' + f, r[f], c[f]);
      }
    }
    if (!opts.listUnit) for (const [k, c] of b) if (!(S[kind] || []).some(r => key(r) === k)) put('fill', kind + ' ' + k + ': no list took it', null, c);
  }
  return out.filter(x => x.kind !== 'same');
}

// ---------------------------------------------------------------- the gate
function main() {
  const fast = process.argv.includes('--fast');
  const fails = [], notes = [], checked = { filter: 0, complete: 0, fresh: 0, tables: 0, nr: 0, bsdata: 0, texts: 0 };
  const fail = (step, msg) => fails.push(step + ': ' + msg);
  const ft = filterTest(); checked.filter = ft.cases; ft.fails.forEach(x => fail('filter', x));
  const dir = path.join(ROOT, 'verify/sources/catalog');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort() : [];
  global.window = {}; delete require.cache[path.join(ROOT, 'data.js')]; require(path.join(ROOT, 'data.js')); const D = window.WH_DATA;
  // (the datasheets the lists name: ARMIES as data.js writes it, each unit entry's ds)
  const T = require('./tables'), RAW = T.read(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8')).A.value;
  const listed = new Set(RAW.flatMap(a => a.units.flatMap(u => [].concat(u.ds || []))));
  const DEVB = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/deviations-bsdata.json'), 'utf8')).filter(x => x.army === 'catalog');
  const DEVCF = path.join(ROOT, 'verify/deviations-catalog.json'), DEVC = fs.existsSync(DEVCF) ? JSON.parse(fs.readFileSync(DEVCF, 'utf8')) : [];
  const usedB = new Set(), usedC = new Set();
  const report = { factions: {} };
  const haveCache = fs.existsSync(path.join(ROOT, 'verify/.cache/bsdata'));
  for (const f of files) {
    const cat = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), faction = cat.faction, rep = report.factions[faction] = { datasheets: Object.keys(cat.datasheets).length, detachments: (cat.detachments || []).length, excluded: (cat.excluded || []).length, differences: [] };
    if (!haveCache) { notes.push(faction + ': no BSData clone (verify/.cache/bsdata): complete, fresh and bsdata not checked'); }
    let C = null;
    if (haveCache) {
      C = BC.load(ROOT, cat.bsdata.catalogue);
      if (C.cat.revision !== cat.bsdata.revision) fail('fresh', faction + ': the catalogue file is of revision ' + cat.bsdata.revision + ', BSData at the pin has ' + C.cat.revision + ': node verify/from-bsdata.js ' + faction + ' --write');
      // complete: datasheets
      const roots = C.roots(), want = roots.filter(r => r.kind === 'datasheet');
      for (const r of want) { checked.complete++; if (!Object.values(cat.datasheets).some(x => x.bsId === r.entry.id)) fail('complete', faction + ': BSData’s datasheet ' + r.name + ' (' + r.entry.id + ') is not in the catalogue'); }
      for (const [id, x] of Object.entries(cat.datasheets)) { const r = roots.find(y => y.entry && y.entry.id === x.bsId); if (!r) fail('complete', faction + ': ' + id + ' is no root entry of the BSData catalogue'); else if (r.kind !== 'datasheet') fail('complete', faction + ': ' + id + ' is ' + r.kind + ' (' + r.why + '): left out by the filter'); }
      // the filter, on the catalogue: what it leaves out is in the file, each with its rule
      for (const r of roots.filter(r => r.kind !== 'datasheet')) if (!(cat.excluded || []).some(x => x.name === r.name && x.kind === r.kind)) fail('filter', faction + ': ' + r.name + ' is ' + r.kind + ' in BSData, not listed as left out in the catalogue file');
      // complete: detachments (each a detachment of the faction in data.js, by GW's name or BSData's)
      const F = D.factions[faction] || { detachments: {} }, dets = C.detachments().filter(d => d.kind === 'detachment');
      const sq = s => lc(s).replace(/[^a-z0-9]/g, '');
      for (const d of dets) { checked.complete++; if (!Object.values(F.detachments).some(x => lc(x.name) === lc(typo(d.name)) || (x.nr && lc(x.nr) === lc(typo(d.name))))) fail('complete', faction + ': BSData’s detachment ' + d.name + ' is not a detachment of ' + faction + ' in data.js'); }
      for (const [k, x] of Object.entries(F.detachments)) if (!dets.some(d => lc(typo(d.name)) === lc(x.name) || (x.nr && lc(typo(d.name)) === lc(x.nr)))) fail('complete', faction + ': data.js’s detachment ' + x.name + ' (' + k + ') is no current detachment of the BSData catalogue');
      for (const [k, x] of Object.entries(F.detachments)) if (x.aiStatus === 'not-read' && (x.stratagems || []).some(s => s.gist || s.def || s.mod)) fail('tables', faction + ': detachment ' + k + ' is marked aiStatus not-read but has AI-written columns: drop the mark once they are read');
      // bsdata
      const byId = new Map(want.map(r => [r.entry.id, r]));
      for (const [id, row] of Object.entries(cat.datasheets)) {
        const root = byId.get(row.bsId); if (!root) continue;
        for (const d of bsDiffs(row, bsReading(C.selection(root), C))) {
          checked.bsdata++;
          const dev = DEVB.find(x => x.unit === id && x.field === d.field && stable(x.app) === stable(d.app) && stable(x.source) === stable(d.source));
          if (dev) { usedB.add(dev); if (!dev.reason || !dev.evidence) fail('bsdata', id + ' ' + d.field + ': its declaration has no reason or evidence'); }
          else fail('bsdata', id + ' ' + d.field + ': the catalogue ' + JSON.stringify(d.app) + ', BSData ' + JSON.stringify(d.source) + ' (declare GW’s value in verify/deviations-bsdata.json, army "catalog", with its evidence)');
        }
      }
      // fresh: the file is what the sources give now
      if (!fast) {
        const B = require('./from-bsdata'); B.forFaction(faction);
        const now = B.build().cat; checked.fresh++;
        if (stable(now) !== stable(cat)) {
          const diff = Object.keys(Object.assign({}, now.datasheets, cat.datasheets)).filter(k => stable(now.datasheets[k]) !== stable(cat.datasheets[k]));
          fail('fresh', faction + ': verify/sources/catalog/' + f + ' is not what verify/from-bsdata.js reads now' + (diff.length ? ' (' + diff.slice(0, 6).join(', ') + (diff.length > 6 ? ', …' : '') + ')' : ' (outside the rows)') + ': node verify/from-bsdata.js ' + faction + ' --write');
        }
      }
    }
    // tables: every row in DATASHEETS
    for (const [id, R] of Object.entries(cat.datasheets)) {
      checked.tables++;
      const S = (D.datasheets || {})[id];
      if (!S) { fail('tables', id + ': the catalogue row is not in DATASHEETS (node verify/tables.js --write)'); continue; }
      const inList = listed.has(id);
      for (const d of rowDiffs(S, R)) {
        if (d.kind === 'fill' && !inList) { fail('tables', id + ' · ' + d.what + ': DATASHEETS lacks the catalogue’s value'); continue; }
        rep.differences.push({ id, kind: d.kind, what: d.what });
        if (['fill', 'markup', 'tag', 'rules'].includes(d.kind)) continue;
        const dev = DEVC.find(x => x.datasheet === id && x.what === d.what);
        if (dev) { usedC.add(dev); if (!dev.reason || !dev.evidence) fail('tables', id + ' · ' + d.what + ': its declaration has no reason or evidence'); continue; }
        fail('tables', id + ' · ' + d.what + ': DATASHEETS ' + JSON.stringify(d.data) + ', the catalogue ' + JSON.stringify(d.cat) + ' (settle it at the source, or declare it in verify/deviations-catalog.json)');
      }
      if (!inList && S.aiStatus !== 'not-read') fail('tables', id + ': no list has it and it has no aiStatus "not-read"');
      if (!inList && (S.mods || S.aura || S.guard || (S.abilities || []).some(a => a.def))) fail('tables', id + ': marked not-read but has readings or When targeted lines');
    }
    // the detachments the catalogue adds: in FACTIONS as the catalogue has them, but for verify/derive.js's labels
    { const F = D.factions[faction] || { detachments: {} }, LAB = ['phases', 'turn', 'turns', 'needs', 'at', 'ph'];
      const unlab = x => JSON.parse(JSON.stringify(x, (k, v) => LAB.includes(k) ? undefined : v));
      for (const [id, d] of Object.entries(cat.detachmentRows || {})) {
        checked.tables++;
        const have = F.detachments[id];
        if (!have) { fail('tables', faction + ': the catalogue’s detachment ' + id + ' is not in data.js (node verify/from-bsdata.js ' + faction + ' --write)'); continue; }
        const h = Object.assign({}, have); delete h.aiStatus;
        if (have.aiStatus !== 'not-read') fail('tables', faction + ': detachment ' + id + ' is the catalogue’s but has no aiStatus "not-read"');
        if (stable(unlab(h)) !== stable(unlab(d))) fail('tables', faction + ': detachment ' + id + ' in data.js is not the catalogue’s (node verify/from-bsdata.js ' + faction + ' --write)');
      }
      for (const [id, d] of Object.entries(F.detachments)) if (d.aiStatus === 'not-read' && !(cat.detachmentRows || {})[id]) fail('tables', faction + ': detachment ' + id + ' is marked aiStatus not-read but is not the catalogue’s'); }
    for (const id of Object.keys(D.datasheets || {})) if (id.startsWith(faction + '/') && !cat.datasheets[id] && !listed.has(id)) fail('complete', id + ': a DATASHEETS row of ' + faction + ' that is neither a catalogue row nor any list’s');
    // nr: every list unit's rows against the catalogue
    for (const a of D.armies) for (const u of a.units) {
      // (a unit entry of the resolved lists: its parts by name; its rows by who)
      const names = [u.name].concat((u.also || []).map(x => x.name), u.leads ? [u.leads] : []);
      for (const n of names) {
        const id = faction + '/' + n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const R = cat.datasheets[id]; if (!R) continue;
        const multi = names.length > 1, mine = k => (u[k] || []).filter(r => !multi || r.who === n || (k === 'stats' && String(r.name).replace(/ ×\d+$/, '') in Object.fromEntries((R.stats || []).map(x => [x.name, 1]))));
        const S = { name: n, stats: mine('stats'), ranged: mine('ranged'), melee: mine('melee'), abilities: mine('abilities') };
        checked.nr += ['stats', 'ranged', 'melee', 'abilities'].reduce((t, k) => t + S[k].length, 0);   // (rows compared)
        for (const d of rowDiffs(S, R, { listUnit: true })) {
          if (['markup', 'tag', 'list'].includes(d.kind)) continue;
          const dev = DEVC.find(x => x.datasheet === id && x.what === d.what && (!x.lists || x.lists.includes(a.id)));
          if (dev) { usedC.add(dev); continue; }
          fail('nr', a.id + ' · ' + u.id + ' · ' + id + ' · ' + d.what + ': the list ' + JSON.stringify(d.data) + ', the catalogue ' + JSON.stringify(d.cat));
        }
      }
    }
    // texts: each ability's words on the datasheet's Wahapedia page, or in GW's update document for the faction
    const WW = require('./waha-words')(ROOT, faction), FJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/sources/factions.json'), 'utf8'));
    const pack = (FJ[faction] || {}).pack, packTxt = pack ? (p => fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '')(path.join(ROOT, 'verify/.cache/gw', pack.file.replace(/\.pdf$/, '.txt'))) : '';
    for (const [id, R] of Object.entries(cat.datasheets)) {
      const pg = WW.wahaPage(R.name, faction);
      if (!pg) { fail('texts', id + ': no cached Wahapedia datasheet (verify/sources/waha-datasheets.txt)'); continue; }
      const hay = words(pg.P.s) + ' ' + words(packTxt);
      for (const a of R.abilities || []) {
        checked.texts++;
        const w = a.name === 'Leader' ? words(a.text).replace(/^this model can be attached to the following units /, '') : words(a.text);
        if (!hay.includes(w)) fail('texts', id + ' · ' + a.name + ': its words are not on ' + pg.file + (pack ? ' nor in ' + pack.file : ''));
      }
    }
  }
  for (const d of DEVB) if (!usedB.has(d)) fail('bsdata', 'verify/deviations-bsdata.json: nothing in the catalogues matches the declaration for ' + d.unit + ' ' + d.field);
  for (const d of DEVC) if (!usedC.has(d)) fail('tables', 'verify/deviations-catalog.json: nothing matches the declaration for ' + d.datasheet + ' · ' + d.what);
  fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'verify/out/catalog.json'), JSON.stringify({ checked, failures: fails, notes, report }, null, 1) + '\n');
  const sum = Object.entries(report.factions).map(([k, v]) => k + ' ' + v.datasheets + ' datasheets, ' + v.detachments + ' detachments, ' + v.excluded + ' left out').join('; ');
  if (fails.length) { console.log('FAIL catalog: ' + fails.length + ' failure(s) (' + sum + ')\n' + fails.slice(0, 60).map(x => ' - ' + x).join('\n')); process.exit(1); }
  console.log('catalog: ' + (sum || 'no catalogues') + '; checked ' + JSON.stringify(checked) + '; ' + usedB.size + ' BSData deviations used' + (notes.length ? '; ' + notes.join('; ') : ''));
}
if (require.main === module) main();
module.exports = { bsReading, bsDiffs, declarations, rowDiffs, filterTest };
