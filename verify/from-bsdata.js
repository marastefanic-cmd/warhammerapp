#!/usr/bin/env node
/* verify/from-bsdata.js: a faction's whole catalogue from BSData into the tables (docs/catalog.md), mechanically.

     node verify/from-bsdata.js <faction>            read it; write verify/out/catalog/<faction>.json and .md (what it would write)
     node verify/from-bsdata.js <faction> --compare  and list every difference from the DATASHEETS rows data.js has (the rows the
                                                     lists use, signed off): each must be reproduced or explained
     node verify/from-bsdata.js <faction> --write    write verify/sources/catalog/<faction>.json (the catalogue rows), the
                                                     detachments data.js lacks into FACTIONS (with derive.js's labels), the
                                                     GW-over-BSData deviations into verify/deviations-bsdata.json, then
                                                     verify/tables.js --write (DATASHEETS: the lists' rows, and every catalogue row)

   How (the same code as every list, verify/from-json.js):
     1. verify/bs-catalog.js reads the catalogue (and its libraries, the game system) at the pin and sorts its root entries by the
        explicit filter (no Legends, no Crusade, no Crucible: bs-catalog.js FILTER); the detachments of its Detachment entry the same
     2. it writes a New Recruit-style export of the whole catalogue (verify/out/catalog/<faction>.roster.json): every current
        datasheet once, each with every option taken (every model entry, every weapon and wargear choice), and every detachment
     3. verify/from-json.js reads that export as it reads a list (--emit): every profile by its BSData id, then GW's datasheet
        (Wahapedia, the codex) over BSData for every stat, weapon, keyword, base size (GW's base size guide), ability (GW's words
        and name) and the Rules line, each difference listed as a deviation; the detachments data.js lacks from the Wahapedia
        faction page (rule, enhancements with pts, stratagems), their Force Dispositions from BSData
     4. this file turns each unit into its DATASHEETS row (the datasheet's facts only: no models line, no counts), adds what only
        BSData gives (points per model count, composition, wargear choices) and the Leader list GW's datasheet prints, and marks
        the AI layers not read yet (aiStatus: 'not-read': no readings, no When targeted lines, no gists)
   Rerunning it gives the same files. */
'use strict';
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const BC = require('./bs-catalog');
const { lit } = require('./waha-words').writer;

const argv = process.argv.slice(2), flag = f => argv.includes(f);
let faction = require.main === module ? argv.find(a => !a.startsWith('--')) : null;
if (require.main === module && !faction) { console.error('usage: node verify/from-bsdata.js <faction> [--write] [--compare]'); process.exit(2); }
const FJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/sources/factions.json'), 'utf8'));
const OUT = path.join(ROOT, 'verify/out/catalog');
let SRC = null;
function forFaction(f) {
  faction = f;
  if (!FJ[faction] || !FJ[faction].bsdata) throw new Error('verify/sources/factions.json has no BSData catalogue for ' + faction);
  SRC = path.join(ROOT, 'verify/sources/catalog', faction + '.json');
  fs.mkdirSync(OUT, { recursive: true });
}
const DATA = path.join(ROOT, 'data.js');
const loadD = () => { global.window = {}; delete require.cache[DATA]; require(DATA); return window.WH_DATA; };
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const typo = s => String(s).replace(/'/g, '’');
const lc = s => String(s).toLowerCase().replace(/[’‘]/g, "'");
const pin = (fs.readFileSync(path.join(ROOT, 'verify/fetch.sh'), 'utf8').match(/BSDATA_COMMIT=([0-9a-f]+)/) || [, null])[1];

// ---------------------------------------------------------------- 1, 2: the catalogue, and the export of all of it
function readCatalogue() {
  const C = BC.load(ROOT, FJ[faction].bsdata, { factions: FJ[faction].catalogFactions });
  const roots = C.roots(), dets = C.detachments();
  const datasheets = roots.filter(r => r.kind === 'datasheet'), detachments = dets.filter(d => d.kind === 'detachment');
  const excluded = roots.filter(r => r.kind !== 'datasheet').map(r => ({ name: r.name, kind: r.kind, why: r.why, id: r.entry ? r.entry.id : null }))
    .concat(dets.filter(d => d.kind !== 'detachment').map(d => ({ name: d.name, kind: 'detachment: ' + d.kind, why: d.why, id: d.entry.id })));
  const roster = { roster: { name: 'Catalogue: ' + C.cat.name, costs: [], forces: [{ id: 'catalogue', name: 'Catalogue', entryId: 'catalogue', catalogueId: C.cat.id, catalogueName: C.cat.name, catalogueRevision: C.cat.revision,
    selections: [{ id: 'cat-detachment', name: 'Detachment', type: 'upgrade', number: 1, selections: detachments.map((d, i) => ({ id: 'cat-det-' + i, name: d.name, entryId: d.entry.id, type: 'upgrade', number: 1 })) }]
      .concat(datasheets.map(r => C.selection(r))) }] } };
  return { C, datasheets, detachments, excluded, roster };
}

// ---------------------------------------------------------------- 3: verify/from-json.js reads it
function emit(roster) {
  const rf = path.join(OUT, faction + '.roster.json'), ef = path.join(OUT, faction + '.emit.json');
  fs.writeFileSync(rf, JSON.stringify(roster, null, 1) + '\n');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'verify/from-json.js'), rf, 'catalog-' + faction, '--emit', ef], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stdout + r.stderr); process.exit(1); }
  return JSON.parse(fs.readFileSync(ef, 'utf8'));
}

// ---------------------------------------------------------------- 4: the rows
const STAT = ['M', 'T', 'Sv', 'W', 'Ld', 'OC', 'InSv', 'base'], WPN = ['range', 'A', 'BS', 'WS', 'S', 'AP', 'D', 'kw'];
const HAND = () => { const f = path.join(ROOT, 'verify/sources/hand', 'catalog-' + faction + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}; };
function rowOf(u, root, C, E) {
  const row = { name: u.name, faction, bsId: u.parts[0].entryId };
  if (u.role) row.role = u.role;
  // (a model BSData misprints, the hand file's modelNames kind typo: GW's name, declared; kind kept: BSData's, listed)
  const MN = HAND().modelNames || {}, mname = n => MN[n] && MN[n].kind === 'typo' ? MN[n].gw : n;
  row.stats = u.stats.map(s => { const o = { name: mname(s.base0 || s.name.replace(/ ×\d+$/, '')) }; for (const k of STAT) if (s[k] !== undefined && s[k] !== '') o[k] = s[k]; return o; });
  const weapon = w => { const o = {}; for (const k of ['name', 'group', 'fireAll', 'hunter']) if (w[k] !== undefined) o[k] = w[k]; for (const k of WPN) if (w[k] !== undefined) o[k] = w[k]; return o; };
  // (one row per profile: the same weapon on two models of the datasheet is one row)
  const uniqRows = rs => { const seen = new Set(); return rs.filter(r => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; }); };
  row.ranged = uniqRows(u.ranged.map(weapon)); row.melee = uniqRows(u.melee.map(weapon));
  // (no reading column: damaged, the Damage tab's band, is a reading, written with the AI layers; the ability's name says the band)
  const ab = a => { const o = { name: a.name }; if (a.who) o.who = a.who; if (a.tag) o.tag = a.tag; o.text = a.text; return o; };
  row.abilities = u.abilities.map(ab);
  // Leader / Support: the units GW's datasheet (its LEADER or SUPPORT section) lets this model be attached to, as the lists' rows print
  // it, in the place of BSData's ability of that name (whose list is the previous codex's: GW wins)
  const G = (E.gwRules || {})[u.id] || {};
  const abs = ((C.selection(root).profiles) || []).filter(p => p.typeName === 'Abilities').map(p => p.name);
  for (const [nm, list] of [['Leader', G.leader], ['Support', G.support]]) {
    if (!(list || []).length) continue;
    const o = { name: nm, text: 'This model can be attached to the following units: ' + list.map(x => x.toUpperCase()).join(', ') };
    // (where BSData has it among the abilities: before the first ability BSData lists after it)
    const at = abs.indexOf(nm), after = at < 0 ? [] : abs.slice(at + 1).map(lc);
    const i = row.abilities.findIndex(a => after.some(n => n === lc(a.name) || n.replace(/\bthe /g, '') === lc(a.name)));
    row.abilities.splice(at < 0 || i < 0 ? row.abilities.length : i, 0, o);
  }
  for (const k of ['ranged', 'melee']) if (!row[k].length) delete row[k];
  if (!row.abilities.length) delete row.abilities;
  // (an army rule GW prints for one model of the unit, "Shadow In The Warp (Ravener Prime only)": the faction's army rule, and the
  // model that has it, partialRules, as the lists write a rule only one model has)
  const AR = ((loadD().factions || {})[faction] || {}).armyRules || [];
  row.rules = u.rules.map(r => { const m = /^(.+?) \((.+) only\)$/.exec(r); if (!m) return r; const ar = AR.find(x => lc(x.name) === lc(m[1]));
    (row.partialRules = row.partialRules || {})[ar ? ar.name : m[1]] = m[2]; return ar ? ar.name : m[1]; });
  row.kw = u.kw;
  if (u.kwOnly) row.kwOnly = u.kwOnly;
  // what only BSData gives: points per model count (and what else changes them), the models, the wargear choices
  // points: GW's costs as its datasheet prints them (Wahapedia), else BSData's in the same shape; a difference is declared (catalog.js)
  const CAT = require('./catalog'), WW = require('./waha-words')(ROOT, faction), pg = WW.wahaPage(u.name, faction);
  const gw = pg ? CAT.gwCosts(WW.markup(pg.tokens, pg.P, 0, pg.P.s.length - 1).split('\n')) : null;
  row.points = gw || CAT.bsCosts(C.points(root), C.options(root)); row.composition = C.composition(root).map(c => Object.assign({}, c, { model: mname(c.model) })); row.options = C.options(root).map(o => Object.assign({}, o, { on: mname(o.on) }));
  return row;
}

// ---------------------------------------------------------------- GW's Faction Pack over the codex: its datasheet Rules Updates
// (Wahapedia's datasheet pages carry most of them, not all: the Swarmlord's Malign Presence). Each update verify/texts.js reads from the
// pack (--updates) whose title names datasheets and what it changes is applied where the row's words are not yet the pack's: an
// ability's new text ("<datasheets>, <ability> Ability" / "Change to:"), a value in it ("Change 9\" to 8\"."), a keyword added
// ("<datasheets> – Keywords Section" / "Add 'X'."), a weapon value ("<datasheet>, Ranged Weapons, <weapon>" / "Change S to '9'."). Each is
// recorded (packApplied) and declared as GW's over BSData; verify/texts.js checks every row against the pack as for a list.
const squashW = t => lc(String(t || '').replace(/\*\*/g, '')).replace(/[^a-z0-9]/g, '');
// (the pack's text as the app writes it: its lines joined, bullets as "- ", its capitals bold as GW prints keywords)
const packText = t => String(t).split('\n').map(l => l.trim()).reduce((o, l) => /^[▪■]/.test(l) ? o.concat('- ' + l.replace(/^[▪■]\s*/, '')) : o.length ? (o[o.length - 1] += ' ' + l, o) : [l], [])
  .join('\n').replace(/\b([A-Z][A-Z’'-]+(?:[ /][A-Z][A-Z’'-]+)*)\b/g, (m0, w) => w.length > 1 && /[A-Z]{2}/.test(w) ? '**' + w + '**' : w).replace(/\s+([.,;:])/g, '$1');
function applyPack(rows) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'verify/texts.js'), '--updates', faction], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  let ups = []; try { ups = JSON.parse(r.stdout || '[]'); } catch (e) { return []; }
  const applied = [], named = (row, list) => list.some(n => lc(n) === lc(row.name) || lc(n) === lc(row.name) + 's' || lc(n) + 's' === lc(row.name));
  for (const e of ups.filter(x => x.section === 'DATASHEETS')) {
    const t = String(e.title).trim(), instr = String(e.instr).trim();
    let m;
    if ((m = /^(.+?)(?:,| –| -) Keywords(?: Section)?$/i.exec(t)) && (m = Object.assign(m, { add: /^Add ['‘]([^'’]+)['’]\.?$/i.exec(instr) })).add) {
      const list = m[1].split(/,\s*/), k = m.add[1].toLowerCase().replace(/(^|[\s-])([a-z])/g, (x, a, b) => a + b.toUpperCase());
      for (const [id, row] of Object.entries(rows)) if (named(row, list) && !row.kw.some(x => lc(x) === lc(k))) { row.kw = row.kw.concat(k).sort(); applied.push({ id, field: 'kw', app: k, title: t, instr, where: e.where }); }
      continue;
    }
    if ((m = /^(.+?)(?:,| –| -) Ranged Weapons, (.+)$|^(.+?)(?:,| –| -) Melee Weapons, (.+)$/i.exec(t))) {
      const ds = (m[1] || m[3]).split(/,\s*/), wn = m[2] || m[4], kind = m[1] ? 'ranged' : 'melee', ch = /^Change (\w+) to ['‘]?([^'’]+?)['’]?\.?$/.exec(instr);
      if (!ch) continue;
      for (const [id, row] of Object.entries(rows)) if (named(row, ds)) for (const w of row[kind] || []) if (lc(w.name) === lc(wn) && ch[1] in w && w[ch[1]] !== ch[2]) { const was = w[ch[1]]; w[ch[1]] = ch[2]; applied.push({ id, field: kind + '[' + w.name + (w.group ? ' (' + w.group + ')' : '') + '].' + ch[1], app: ch[2], was, title: t, instr, where: e.where }); }
      continue;
    }
    if ((m = /^(.+?)(?:,| –| -) ([^,–]+?) [Aa]bility$/.exec(t))) {
      const ds = m[1].split(/,\s*/), an = m[2].trim();
      for (const [id, row] of Object.entries(rows)) if (named(row, ds)) for (const ab of row.abilities || []) {
        if (lc(ab.name) !== lc(an) && lc(ab.name) !== lc(an) + 's' && lc(ab.name) + 's' !== lc(an)) continue;
        if (/^Change to:/.test(instr) && e.newText) {
          let nt = packText(e.newText); const head = /^([^:(]+?)(?:\s*\(([^)]*)\))?:\s*([\s\S]*)$/.exec(nt.replace(/\*\*/g, ''));
          if (head && lc(head[1]) === lc(ab.name)) nt = nt.replace(/^[^:]*:\s*/, '');
          if (squashW(nt) !== squashW(ab.text)) { const was = ab.text; ab.text = nt; applied.push({ id, field: 'ability[' + ab.name + '].text', app: nt, was, title: t, instr, where: e.where }); }
        } else if ((m = /^Change (.+?) to (.+?)\.$/.exec(instr))) {
          if (ab.text.split(m[1]).length === 2) { const was = ab.text; ab.text = ab.text.replace(m[1], m[2]); applied.push({ id, field: 'ability[' + ab.name + '].text', app: ab.text, was, title: t, instr, where: e.where }); }
        }
      }
    }
  }
  return applied;
}

function build() {
  const { C, datasheets, detachments, excluded, roster } = readCatalogue();
  const E = emit(roster);
  const byEntry = new Map(datasheets.map(r => [r.entry.id, r]));
  const rows = {};
  for (const u of E.units) {
    const root = byEntry.get(u.parts[0].entryId);
    const id = faction + '/' + slug(u.name);
    if (rows[id]) throw new Error('two catalogue datasheets have the id ' + id);
    rows[id] = rowOf(u, root, C, E);
  }
  const packApplied = applyPack(rows);
  // GW's words where Wahapedia's transcription differs (the hand file's texts: { "<datasheet id>": { "<ability>": { from, to, why } } },
  // exactly once, as a list's hand file has them): the Faction Pack prints the datasheet in full (verify/texts.js packDatasheet)
  const handApplied = [];
  for (const [id, by] of Object.entries(HAND().texts || {})) for (const [an, fx] of Object.entries(by)) {
    const ab = ((rows[id] || {}).abilities || []).find(a => a.name === an);
    if (!ab || String(ab.text).split(fx.from).length !== 2) throw new Error('verify/sources/hand/catalog-' + faction + '.json texts ' + id + ' · ' + an + ': its words "' + fx.from + '" are not there exactly once');
    const was = ab.text; ab.text = ab.text.replace(fx.from, fx.to); handApplied.push({ id, field: 'ability[' + an + '].text', app: ab.text, was, why: fx.why });
  }
  // GW's datasheet as its Faction Pack prints it, where Wahapedia's page (which the import reads as GW's) differs from it (the hand
  // file's rows: { "<datasheet id>": { kwRemove:[…], rulesAdd:[{ name, after }], abilities:{ "<name>": { name?, tag? } },
  // abilityAdd:[{ name, text, after }], why }); each recorded (handApplied) and declared where it differs from BSData
  for (const [id, h] of Object.entries(HAND().rows || {})) {
    const row = rows[id], bad = w => { throw new Error('verify/sources/hand/catalog-' + faction + '.json rows ' + id + ': ' + w); };
    if (!row) bad('no such row');
    for (const k of h.kwRemove || []) { if (!(row.kw || []).includes(k)) bad('no keyword ' + k); row.kw = row.kw.filter(x => x !== k); handApplied.push({ id, field: 'kw', app: null, was: k, why: h.why }); }
    for (const r of h.rulesAdd || []) { if ((row.rules || []).includes(r.name)) bad('already has ' + r.name); const i = r.after ? row.rules.indexOf(r.after) : -1; if (r.after && i < 0) bad('no rule ' + r.after); row.rules.splice(i + 1, 0, r.name); handApplied.push({ id, field: 'rules', app: r.name, was: null, why: h.why }); }
    for (const [an, fx] of Object.entries(h.abilities || {})) {
      const ab = (row.abilities || []).find(a => a.name === an); if (!ab) bad('no ability ' + an);
      if ('tag' in fx) { const was = ab.tag; if (fx.tag == null) delete ab.tag; else ab.tag = fx.tag; handApplied.push({ id, field: 'ability[' + an + '].tag', app: fx.tag, was, why: h.why }); }
      if ('name' in fx) { ab.name = fx.name; handApplied.push({ id, field: 'ability[' + fx.name + '].name', app: fx.name, was: an, why: h.why }); }
    }
    for (const a of h.abilityAdd || []) { if ((row.abilities || []).some(x => x.name === a.name)) bad('already has ' + a.name); const i = a.after ? row.abilities.findIndex(x => x.name === a.after) : -1; if (a.after && i < 0) bad('no ability ' + a.after);
      const o = Object.assign({ name: a.name }, a.tag ? { tag: a.tag } : {}, { text: a.text }); row.abilities.splice(i + 1, 0, o); handApplied.push({ id, field: 'ability[' + a.name + '].text', app: a.text, was: null, why: h.why }); }
  }
  // the GW-over-BSData differences, with their evidence: the deviations to declare (as verify/from-json.js declares a list's)
  const devs = [];
  for (const d of E.gwDevs) devs.push({ unit: d.unit, kind: d.kind, row: d.row || null, field: d.field, gw: d.app, bsdata: d.bsdata === 'undefined' ? null : d.bsdata, file: d.file, det: d.det || null });
  for (const d of E.devs) devs.push({ unit: d.unit, kind: d.kind, field: d.field, name: d.name, gw: d.app, bsdata: d.bsdata, why: d.why, file: d.file });
  // the detachments the catalogue adds (data.js lacks them, or added them from the catalogue: aiStatus 'not-read'), as data.js gets
  // them but for verify/derive.js's labels: no gist (an AI layer, not read yet); a stratagem id another detachment has (Superhuman Focus
  // in Guardians of the Throne and Emperor's Chosen) gets its detachment's id after it, the app linking a stratagem by its id
  const D0 = loadD(), taken = new Set(D0.coreStratagems.map(s => s.id).concat(...Object.values(D0.factions).flatMap(f => Object.entries(f.detachments).filter(([, d]) => d.aiStatus !== 'not-read').map(([, d]) => (d.stratagems || []).map(s => s.id)))));
  const detachmentRows = {};
  for (const [id, d0] of Object.entries(E.detachments || {})) {
    const d = JSON.parse(JSON.stringify(d0));
    for (const s of d.stratagems || []) { if (s.gist === null) delete s.gist; if (taken.has(s.id)) s.id = s.id + '-' + id; taken.add(s.id); }
    detachmentRows[id] = d;
  }
  const cat = { _about: 'The ' + C.cat.name + ' catalogue as verify/from-bsdata.js reads it from BSData (wh40k-11e at the pin) with GW’s datasheets over it (verify/from-json.js): every current datasheet (no Legends, no Crusade, no Crucible: verify/bs-catalog.js FILTER), one DATASHEETS row each. Written by `node verify/from-bsdata.js ' + faction + ' --write`; verify/tables.js --write puts every row into DATASHEETS (a row a list has keeps the list’s signed-off facts, and gets the catalogue’s rows it lacks); the gate step catalog (verify/catalog.js) checks it is what the sources give. Do not edit.',
    faction, bsdata: { catalogue: C.cat.name, revision: C.cat.revision, pin },
    counts: { datasheets: Object.keys(rows).length, detachments: detachments.length, excluded: excluded.length },
    datasheets: rows, detachments: detachments.map(d => ({ name: typo(d.name), bsId: d.entry.id, rules: d.rules.map(typo) })), detachmentRows, excluded, weaponNames: E.gwNames, packApplied, handApplied, modelNames: Object.entries(HAND().modelNames || {}).map(([bs, x]) => ({ bsdata: bs, gw: x.gw, kind: x.kind })) };
  return { C, E, cat, devs, datasheets, detachments, excluded };
}

// ---------------------------------------------------------------- --compare: the rows data.js has
const stable = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(y => [y, x[y]])) : x);
const HIDDEN = ['readOf', 'readBy', 'defOf', 'gistOf'];
function compare(cat, D) {
  const out = [];
  const have = Object.entries(D.datasheets || {}).filter(([, S]) => S.faction === faction);
  for (const [id, S] of have) {
    const R = cat.datasheets[id];
    if (!R) { out.push({ id, what: 'not in the catalogue', ds: S.name }); continue; }
    if (S.bsId && S.bsId !== R.bsId) out.push({ id, what: 'bsId', data: S.bsId, cat: R.bsId });
    for (const f of ['name', 'role', 'rules', 'kw', 'kwOnly']) if (f in S && stable(S[f]) !== stable(R[f])) out.push({ id, what: f, data: S[f], cat: R[f] });
    for (const f of ['role', 'rules', 'kw']) if (!(f in S) && R[f] !== undefined) out.push({ id, what: f + ' (the row has none: its lists differ, or only attached units have it)', data: null, cat: R[f], fill: true });
    for (const kind of ['stats', 'ranged', 'melee', 'abilities']) {
      const key = r => r.name + (r.group ? ' (' + r.group + ')' : '');
      const a = new Map((S[kind] || []).map(r => [key(r), r])), b = new Map((R[kind] || []).map(r => [key(r), r]));
      for (const [k, r] of a) {
        const c = b.get(k);
        if (!c) { out.push({ id, what: kind + ' ' + k + ': on the row, not in the catalogue', data: r }); continue; }
        const fields = kind === 'stats' ? STAT : kind === 'abilities' ? ['who', 'tag', 'damaged', 'text'] : WPN.concat(['group', 'fireAll', 'hunter']);
        for (const f of fields) if (stable(r[f]) !== stable(c[f]) && !(r[f] === undefined && kind === 'abilities' && f === 'who')) out.push({ id, what: kind + ' ' + k + ' ' + f, data: r[f], cat: c[f] });
      }
      for (const [k, c] of b) if (!a.has(k)) out.push({ id, what: kind + ' ' + k + ': in the catalogue, not on the row (no list took it)', cat: c, fill: true });
    }
  }
  for (const id of Object.keys(cat.datasheets)) if (!have.some(([k]) => k === id)) out.push({ id, what: 'new datasheet (no list has it)', fill: true });
  return out;
}

// ---------------------------------------------------------------- the report
function report(r, cmp) {
  const { cat, E, devs, excluded } = r;
  const L = ['# ' + cat.bsdata.catalogue + ' catalogue (' + faction + ')', '',
    'From BSData at the pin (' + (pin || '?') + ', catalogue revision ' + cat.bsdata.revision + ') by `verify/from-bsdata.js`, read by `verify/from-json.js` as every list is. ' + cat.counts.datasheets + ' datasheets, ' + cat.counts.detachments + ' detachments (' + Object.keys(E.detachments).length + ' new to data.js); ' + excluded.length + ' root entries and detachments left out by the filter.', '',
    '## Left out (verify/bs-catalog.js FILTER)', '', ...excluded.map(x => '- ' + x.kind + ': ' + x.name + ' (' + x.why + ')'), '',
    '## GW over BSData (' + devs.length + ')', '', ...devs.map(d => '- ' + d.unit + ' ' + (d.row ? d.row + ' ' : d.name ? d.name + ' ' : '') + d.field + ': GW ' + JSON.stringify(d.gw) + ', BSData ' + JSON.stringify(d.bsdata) + ' (' + d.file + ')'), '',
    '## Weapons BSData names otherwise than GW (the app keeps BSData’s, New Recruit’s name)', '', ...(cat.weaponNames || []).map(w => '- ' + w.unit + ': ' + w.app + ' (GW: ' + w.gw + ', ' + w.file + ')'), '',
    '## Models BSData names otherwise than GW (hand file modelNames: typo, GW’s name; kept, BSData’s)', '', ...(cat.modelNames || []).map(m => '- ' + m.bsdata + ' (GW: ' + m.gw + '): ' + m.kind), '',
    '## Not filled mechanically (' + E.todo.length + ')', '', ...E.todo.map(t => '- ' + t.where + ': ' + t.what + ' (' + t.why + ')'), ''];
  if (cmp) L.push('## Against the rows data.js has (' + cmp.filter(x => !x.fill).length + ' differences, ' + cmp.filter(x => x.fill).length + ' additions)', '',
    ...cmp.map(x => '- ' + x.id + ' · ' + x.what + (x.data !== undefined ? '\n    data.js   ' + JSON.stringify(x.data) : '') + (x.cat !== undefined ? '\n    catalogue ' + JSON.stringify(x.cat) : '')), '');
  return L.join('\n');
}

if (require.main === module) {
  forFaction(faction);
  const r = build();
  const D = loadD();
  const cmp = compare(r.cat, D);
  fs.writeFileSync(path.join(OUT, faction + '.json'), JSON.stringify(r.cat, null, 1) + '\n');
  fs.writeFileSync(path.join(OUT, faction + '.md'), report(r, cmp) + '\n');
  if (flag('--compare')) console.log(report(r, cmp).split('## Against')[1] ? '## Against' + report(r, cmp).split('## Against')[1] : '');
  if (flag('--write')) require('./catalog-write')(ROOT, faction, r, SRC);
  console.log('catalogue ' + faction + ': ' + r.cat.counts.datasheets + ' datasheets, ' + r.cat.counts.detachments + ' detachments (' + Object.keys(r.cat.detachmentRows).length + ' from the catalogue), ' + r.excluded.length + ' left out; ' + r.devs.length + ' GW-over-BSData differences; ' + cmp.filter(x => !x.fill).length + ' differences from data.js’s rows (verify/out/catalog/' + faction + '.md)');
}
module.exports = { forFaction, build, compare, readCatalogue, rowOf };
