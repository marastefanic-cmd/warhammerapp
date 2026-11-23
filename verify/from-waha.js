#!/usr/bin/env node
/* verify/from-waha.js: a faction's whole catalogue from GW's datasheets, as Wahapedia transcribes them, into the tables (docs/catalog.md),
   mechanically. BSData is not used (the owner's decision, 22 Nov 2026).

     node verify/from-waha.js <faction>            read it; write verify/out/catalog/<faction>.json and .md (what it would write)
     node verify/from-waha.js <faction> --compare  and list every difference from the DATASHEETS rows data.js has (the rows the lists
                                                   use, signed off; and, for a faction catalogued before, its committed catalogue rows)
     node verify/from-waha.js <faction> --write    write verify/sources/catalog/<faction>.json (the catalogue rows), the detachments
                                                   data.js lacks into FACTIONS (with derive.js's labels), then verify/tables.js --write

   How (the same code as every list, verify/from-json.js):
     1. which datasheets: the faction page's datasheet index (verify/waha-catalog.js index), without those Wahapedia marks Warhammer
        Legends or with another faction's book, or on another faction's pages (an ally); the detachments: the page's headings
     2. it writes a New Recruit-shaped export of the whole catalogue (verify/out/catalog/<faction>.roster.json) from the datasheet pages
        (verify/gw-order.js pageFor / sectionsOf): every datasheet once, its models (UNIT COMPOSITION), its profiles, every weapon
        ("➤" on a profile Wahapedia marks pick-one, and on every melee weapon of several profiles), its abilities (a wargear ability on
        a selection of its wargear), CORE ABILITIES and ARMY RULES, KEYWORDS and FACTION KEYWORDS, its cost; and every detachment
     3. verify/from-json.js reads that export as it reads a list (--emit): GW's datasheet over it, GW's base size guide, the words with
        their markup, the Rules line, the detachments data.js lacks (rule, enhancements, stratagems) from the faction page
     4. this file turns each unit into its DATASHEETS row, adds GW's costs (verify/catalog.js gwCosts), the models and wargear
        (verify/waha-loadout.js: composition, options, loadout), GW's LEADER / SUPPORT list, GW's Faction Pack updates, and marks the
        AI layers not read yet (aiStatus 'not-read')
   Names: New Recruit's where a list of the faction already has the datasheet (its DATASHEETS row's unit, model and weapon names, the
   model names its committed export shows), else GW's as the page prints them; an import finds a datasheet by an id a known export
   has shown, else by its exact name, and refuses one it cannot find, naming it.
   Rerunning it gives the same files. */
'use strict';
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const LOAD = require('./waha-loadout');

const argv = process.argv.slice(2), flag = f => argv.includes(f);
let faction = require.main === module ? argv.find(a => !a.startsWith('--')) : null;
if (require.main === module && !faction) { console.error('usage: node verify/from-waha.js <faction> [--write] [--compare]'); process.exit(2); }
const FJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/sources/factions.json'), 'utf8'));
const OUT = path.join(ROOT, 'verify/out/catalog');
let SRC = null;
function forFaction(f) {
  faction = f;
  if (!FJ[faction] || !FJ[faction].bsdata) throw new Error('verify/sources/factions.json has no New Recruit catalogue name (bsdata) for ' + faction);
  SRC = path.join(ROOT, 'verify/sources/catalog', faction + '.json');
  fs.mkdirSync(OUT, { recursive: true });
}
const DATA = path.join(ROOT, 'data.js');
const loadD = () => { global.window = {}; delete require.cache[DATA]; require(DATA); return window.WH_DATA; };
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const typo = s => String(s).replace(/'/g, '’');
const lc = s => String(s).toLowerCase().replace(/[’‘]/g, "'");
const sing = LOAD.sing;
// GW's capitals in New Recruit's title case ("DAEMON PRINCE" → "Daemon Prince", "TERMINATOR SQUAD"), small words lower case
const TC = s => String(s).toLowerCase().replace(/(^|[\s(/-])([a-z’'])/g, (m, a, c) => a + c.toUpperCase()).replace(/(?<=\s)(Of|The|And|In|On|To|For|A|An|With)(?=\s)/g, w => w.toLowerCase());
const HAND = () => { const f = path.join(ROOT, 'verify/sources/hand', 'catalog-' + faction + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}; };
const ROLES = ['Epic Hero', 'Character', 'Battleline', 'Dedicated Transport', 'Fortification', 'Infantry', 'Mounted', 'Beast', 'Swarm', 'Vehicle', 'Monster'];

// ---------------------------------------------------------------- the names a committed export of the faction has shown
// (verify/sources/nr-json/<list>.json of each list of the faction): per datasheet page, its unit name and the model names of its parts
function shown(D, WW) {
  const out = new Map();
  for (const a of D.armies.filter(x => x.faction === faction)) {
    const f = path.join(ROOT, 'verify/sources/nr-json', a.id + '.json'); if (!fs.existsSync(f)) continue;
    const F = JSON.parse(fs.readFileSync(f, 'utf8')).roster.forces[0];
    for (const s of (F.selections || []).filter(x => x.type !== 'upgrade')) {
      const page = WW.wahaAddress(String(s.name)), o = out.get(page) || { name: s.name, models: [] }; out.set(page, o);
      const walk = (x, holder) => { for (const c of x.selections || []) { if (c.type === 'model') { if (!o.models.some(m => m.name === c.name)) o.models.push({ name: c.name, group: String(c.group || '').split('::')[0], holder }); } else walk(c, c.name); } };
      if (s.type === 'model') { if (!o.models.some(m => m.name === s.name)) o.models.push({ name: s.name, group: '', self: true }); } else walk(s, null);
    }
  }
  return out;
}
// a model name an export shows → GW's model line it is: the same name; a group "9 - 19 Khorne Berzerkers" of GW's numbers; a name
// starting with the line's ("Khorne Berzerker w/ …"); a group or holder of the line's name ("Dishonoured", "Jakhals")
function lineOfShown(m, lines) {
  const s = sing(m.name);
  return lines.find(l => sing(l.model) === s)
    || lines.find(l => { const g = /^(\d+)(?:\s*-\s*(\d+))?\s+(.+)$/.exec(m.group || ''); return g && l.min === +g[1] && l.max === +(g[2] || g[1]); })
    || lines.find(l => s.startsWith(sing(l.model) + ' '))
    || lines.find(l => [m.group, m.holder].some(g => g && (sing(g) === sing(l.model) || sing(g).endsWith(' ' + sing(l.model)))));
}

// ---------------------------------------------------------------- 1, 2: the catalogue, and the export of all of it
function readCatalogue() {
  const D = loadD(), WC = require('./waha-catalog')(ROOT), O = require('./gw-order')(ROOT), WW = require('./waha-words')(ROOT, faction), CAT = require('./catalog');
  const F = D.factions[faction] || { name: faction };
  const own = FJ[faction].wahaDs || FJ[faction].waha || faction, I = WC.index(faction);
  const ours = x => x.pageFaction === own && !x.legends && (!x.source || lc(x.source).includes(lc(F.name)));
  const want = I.filter(ours);
  const excluded = I.filter(x => !ours(x)).map(x => ({ name: x.name, kind: x.legends ? 'legends' : x.pageFaction !== own ? 'ally' : 'other-book', why: x.legends ? 'Wahapedia marks it Warhammer Legends (' + x.source + ')' : x.pageFaction !== own ? 'a datasheet of another faction’s pages (' + x.pageFaction + ')' : 'another faction’s book (' + x.source + ')', page: x.pageFaction + '/' + x.page }));
  const leftDets = (HAND().detachmentsLeftOut || []);
  const dets = WC.detachments(faction).filter(d => !leftDets.some(x => lc(x.name) === lc(d.name)));
  for (const x of leftDets) excluded.push({ name: x.name, kind: 'detachment: ' + x.kind, why: x.why });
  // the rows data.js has (the lists' names: New Recruit's) by page
  const rows = new Map(Object.entries(D.datasheets || {}).filter(([, r]) => r.faction === faction).map(([k, r]) => [WW.wahaAddress(r.name), Object.assign({ key: k }, r)]));
  const SHOWN = shown(D, WW);
  const sels = [], meta = [];
  let n = 0;
  const id = () => 'w' + (++n);
  for (const x of want) {
    const P = O.pageFor(faction, x.name) || O.pageFor(faction, x.page.replace(/-/g, ' ')); if (!P) throw new Error('no cached Wahapedia datasheet ' + own + '/' + x.page + ' (add it to verify/sources/waha-datasheets.txt, sh verify/fetch.sh)');
    const row0 = rows.get(x.page), seen = SHOWN.get(x.page);
    const name = row0 ? row0.name : seen ? typo(seen.name) : typo(x.name);
    const secs = O.sectionsOf(P, WW), sheet = WC.sheet(WW, name, faction) || WC.sheet(WW, x.name, faction);
    // keywords: KEYWORDS (and a model's own), FACTION KEYWORDS
    const kwU = (P.unitKeywords || []).concat(...Object.values(P.modelKeywords || {})).map(TC).filter((k, i, a) => a.indexOf(k) === i);
    const kw = kwU.concat((P.factionKeywords || []).map(k => 'Faction: ' + TC(k)));
    const role = ROLES.find(r => kwU.some(k => lc(k) === lc(r))) || null;
    const cats = kw.map(k => ({ name: k, primary: role === k }));
    // the models (UNIT COMPOSITION), one entry each; a datasheet of one model is that model
    const L0 = LOAD(sheet, { ranged: [], melee: [] });
    const lines = L0.loadout.lines.map(l => ({ model: l.model, min: (L0.composition.find(c => c.model === l.model) || {}).min, max: (L0.composition.find(c => c.model === l.model) || {}).max }));
    const single = lines.length === 1 && lines[0].max === 1;
    // stats: one profile per model profile Wahapedia prints (its name, else the datasheet's; New Recruit's from the row a list has)
    // (GW prints one profile for several model lines where the row a list has holds one per line, as New Recruit does: one each)
    const gwProfs = (P.profiles || []).length === 1 && row0 && (row0.stats || []).length > 1 && row0.stats.length === lines.length ? lines.map(() => P.profiles[0]) : (P.profiles || []);
    const statName = (p, i) => { if (!row0 || !(row0.stats || []).length) return null; if (p.name) { const h = row0.stats.find(r => sing(r.name) === sing(p.name)); if (h) return h.name; }
      if (gwProfs.length === row0.stats.length) return row0.stats[i].name; const main = lines.find(l => l.max > 1) || lines[0]; const h = row0.stats.find(r => sing(r.name) === sing(main.model)) || row0.stats.find(r => sing(r.name) === sing(name)); return h ? h.name : row0.stats[i] ? row0.stats[i].name : null; };
    const profs = gwProfs.map((p, i) => {
      const nm0 = statName(p, i) || (p.name ? TC(p.name) : name);
      return { id: id(), name: nm0, typeName: 'Unit', characteristics: [['M', p.M], ['T', p.T], ['Sv', p.SV], ['W', p.W], ['LD', p.LD], ['OC', p.OC], ['InSv', p.INSV || ''], ['Base', p.base || '']].map(([k, v]) => ({ name: k, $text: v == null ? '' : String(v) })) };
    });
    // weapons: each of the page's weapons (a weapon of several profiles one selection), New Recruit's names from the row a list has
    const pointy = new Set([...P.html.matchAll(/<tr class="dsWeaponRow">([\s\S]*?)<\/tr>/g)].filter(m => /dsPointy|tooltipPointy/.test(m[1])).map(m => { const b = /<b class="dsWeaponName">([\s\S]*?)<\/b>/.exec(m[1]); return b ? lc(b[1].replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, c => c === '&ndash;' ? '–' : c === '&rsquo;' ? '’' : ' ').replace(/\s+/g, ' ').trim()) : null; }).filter(Boolean));
    const wsel = [];
    for (const kind of ['ranged', 'melee']) for (const w of P.weapons[kind]) {
      const gw = w.group || w.name;
      const r0 = row0 ? (row0[kind] || []).find(r => lc(r.group || r.name) === lc(gw)) || (row0[kind] || []).find(r => sing(r.group || r.name) === sing(gw)) || (row0[kind] || []).find(r => near(r.group || r.name, gw)) : null;
      const g = r0 ? (r0.group || r0.name) : typo(gw.replace(/^./, c => c.toUpperCase()));
      const pr0 = w.group && r0 && r0.group ? (row0[kind] || []).find(r => r.group === r0.group && lc(r.name) === lc(w.profile)) : null;
      const pick = w.group && (kind === 'melee' || pointy.has(lc(w.name)));
      const pname = w.group ? (pick ? '➤ ' : '') + g + ' - ' + (pr0 ? pr0.name : w.profile) : g;
      let s = wsel.find(x => x.name === g && x._kind === kind);
      if (!s) { s = { id: id(), name: g, type: 'upgrade', number: 1, profiles: [], rules: [], _kind: kind }; wsel.push(s); }
      s.profiles.push({ id: id(), name: pname, typeName: kind === 'ranged' ? 'Ranged Weapons' : 'Melee Weapons', characteristics: [['Range', w.range], ['A', w.A], [kind === 'ranged' ? 'BS' : 'WS', /^[-–]$/.test(w.skill) ? 'N/A' : w.skill], ['S', w.S], ['AP', w.AP], ['D', w.D], ['Keywords', w.kw.map(k => String(k).replace(/\bnon-\s+/i, 'non-')).join(', ')]].map(([k, v]) => ({ name: k, $text: v == null ? '' : String(v) })) });
      for (const k of w.kw) { const b = ruleName(D, k); if (b && !s.rules.some(r => r.name === b)) s.rules.push({ id: id(), name: b }); }
    }
    for (const s of wsel) { delete s._kind; if (!s.rules.length) delete s.rules; }
    // abilities: the datasheet's on the unit; a wargear ability on a selection of its wargear; Transport as New Recruit holds it
    const wgNames = new Set((P.abilities || []).filter(a => a.wargear).map(a => lc(a.name)));
    const abil = [], wgSels = [];
    for (const a of secs.abilities) {
      if (/^Designer[’']s Note$/i.test(a.name)) continue;
      const text = String(a.text || '').replace(/\*\*/g, '');
      if (a.name === 'Transport') { abil.push({ id: id(), name: name, typeName: 'Transport', characteristics: [{ name: 'Capacity', $text: text }] }); continue; }
      // (the name the row a list has gives it, where it differs only in case: one row, not two)
      const an = row0 ? ((row0.abilities || []).find(x => lc(x.name) === lc(a.name)) || { name: a.name }).name : a.name;
      const prof = { id: id(), name: an + (a.tag ? ' (' + a.tag + ')' : ''), typeName: 'Abilities', characteristics: [{ name: 'Description', $text: text }] };
      if (wgNames.has(lc(a.name))) wgSels.push({ id: id(), name: a.name, type: 'upgrade', number: 1, profiles: [prof] }); else abil.push(prof);
    }
    const rules = [].concat((P.labels || {})['CORE ABILITIES'] || [], (P.labels || {})['ARMY RULES'] || []).map(r => ({ id: id(), name: r }));
    const costs = sheet ? CAT.gwCosts(WW.markup(WW.wahaPage(name, faction).tokens, WW.wahaPage(name, faction).P, 0, WW.wahaPage(name, faction).P.s.length - 1).split('\n')) : null;
    const pts = costs ? Math.min(...costs.costs[0].models.map(m => m.pts)) : 0;
    const entryId = 'waha:' + own + '/' + x.page;
    let sel;
    if (single) sel = { id: id(), name, entryId, type: 'model', number: 1, categories: cats, rules, profiles: profs.concat(abil), costs: [{ name: 'pts', value: pts }], selections: wsel.concat(wgSels) };
    else {
      const models = lines.map((l, i) => {
        const pr = profs.length > 1 ? profs.filter(p => sing(p.name) === sing(l.model) || sing(l.model).startsWith(sing(p.name)) || sing(p.name).startsWith(sing(l.model))) : [];
        return { id: id(), name: typo(l.model), entryId: entryId + '/' + slug(l.model), type: 'model', number: 1, profiles: pr.length ? pr : undefined, selections: i === 0 ? wsel : [] };
      });
      // (a profile no model line took: the first model's)
      const taken = new Set(models.flatMap(m => (m.profiles || []).map(p => p.id)));
      const rest = profs.length > 1 ? profs.filter(p => !taken.has(p.id)) : [];
      if (rest.length) models[0].profiles = (models[0].profiles || []).concat(rest);
      for (const m of models) if (!m.profiles) delete m.profiles;
      sel = { id: id(), name, entryId, type: 'unit', number: 1, categories: cats, rules, profiles: (profs.length === 1 ? profs : []).concat(abil), costs: [{ name: 'pts', value: pts }], selections: models.concat(wgSels) };
    }
    sels.push(sel);
    meta.push({ x, P, sheet, row0, seen, name, costs, entryId });
  }
  const roster = { roster: { name: 'Catalogue: ' + FJ[faction].bsdata, costs: [], forces: [{ id: 'catalogue', name: 'Catalogue', entryId: 'catalogue', catalogueId: 'waha:' + faction, catalogueName: FJ[faction].bsdata,
    selections: [{ id: 'cat-detachment', name: 'Detachment', entryId: 'waha:detachment', type: 'upgrade', number: 1, selections: dets.map((d, i) => ({ id: 'cat-det-' + i, name: typo(d.name), entryId: 'waha:detachment/' + slug(d.name), type: 'upgrade', number: 1 })) }].concat(sels) }] } };
  return { D, WC, O, WW, want, dets, excluded, roster, meta, SHOWN };
}
// one model of GW's plural ("Flesh Hounds" Flesh Hound, "Nurgling Swarms" Nurgling Swarm); a name GW does not inflect ("Chaos Spawn",
// "Eightbound", "Venatari", "Hive Guard", "Tyrant Guard") as it is
const one1 = s => String(s).replace(/(\w)(ies)$/, '$1y').replace(/([^s])s$/, '$1');
// two spellings of one name: the same in the singular, or one letter apart in a long word (New Recruit's "toxinjecter harpoon" for GW's
// "toxinjector harpoon", "distendible jaw" for "distensible jaw")
function near(a, b) {
  const x = sing(a), y = sing(b); if (x === y || x.replace(/^twin /, '') === y) return true;
  if (x.length < 8 || Math.abs(x.length - y.length) > 1) return false;
  const d = Array.from({ length: x.length + 1 }, (_, i) => [i].concat(Array(y.length).fill(0)));
  for (let j = 1; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
  return d[x.length][y.length] <= 1 && x.split(' ').length === y.split(' ').length;
}
// a weapon ability's rule as the Rules line names it: the core rule of its name less its value ("rapid fire 2" Rapid Fire,
// "anti-infantry 4+" Anti, "twin-linked" Twin-linked), else the name in title case ("pistol" Pistol)
function ruleName(D, k) {
  const b = String(k).replace(/:.*$/, '').replace(/\s+(D?\d+\+?|D\d+[+-]\d+|\d*D\d+)$/i, '').trim();
  const keys = Object.keys(D.rules || {});
  const hit = keys.find(r => lc(r) === lc(b)) || (/^anti-/i.test(b) ? 'Anti' : null);
  return hit || TC(b);
}

// ---------------------------------------------------------------- 3: verify/from-json.js reads it
function emit(roster) {
  const rf = path.join(OUT, faction + '.roster.json'), ef = path.join(OUT, faction + '.emit.json');
  fs.writeFileSync(rf, JSON.stringify(roster, null, 1) + '\n');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'verify/from-json.js'), rf, 'catalog-' + faction, '--emit', ef], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) { console.error(r.stdout + r.stderr); process.exit(1); }
  return JSON.parse(fs.readFileSync(ef, 'utf8'));
}

// ---------------------------------------------------------------- 4: the rows
const STAT = ['M', 'T', 'Sv', 'W', 'Ld', 'OC', 'InSv', 'base'], WPN = ['range', 'A', 'BS', 'WS', 'S', 'AP', 'D', 'kw'];
function rowOf(u, m, E, D) {
  const row = { name: u.name, faction };
  if (u.role) row.role = u.role;
  const MN = HAND().modelNames || {}, mname = n => MN[n] && MN[n].kind === 'typo' ? MN[n].gw : n;
  row.stats = u.stats.map(s => { const o = { name: mname(s.base0 || s.name.replace(/ ×\d+$/, '')) }; for (const k of STAT) if (s[k] !== undefined && s[k] !== '') o[k] = s[k]; return o; });
  const weapon = w => { const o = {}; for (const k of ['name', 'group', 'fireAll', 'hunter']) if (w[k] !== undefined) o[k] = w[k]; for (const k of WPN) if (w[k] !== undefined) o[k] = w[k]; return o; };
  const uniqRows = rs => { const seen = new Set(); return rs.filter(r => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; }); };
  row.ranged = uniqRows(u.ranged.map(weapon)); row.melee = uniqRows(u.melee.map(weapon));
  const ab = a => { const o = { name: a.name }; if (a.who) o.who = a.who; if (a.tag) o.tag = a.tag; o.text = a.text; return o; };
  row.abilities = u.abilities.map(ab);
  // Leader / Support: the units GW's datasheet (its LEADER or SUPPORT section) lets this model be attached to, last
  const G = (E.gwRules || {})[u.id] || {};
  for (const [nm, list] of [['Leader', G.leader], ['Support', G.support]]) if ((list || []).length) row.abilities.push({ name: nm, text: 'This model can be attached to the following units: ' + list.map(x => x.toUpperCase()).join(', ') });
  for (const k of ['ranged', 'melee']) if (!row[k].length) delete row[k];
  if (!row.abilities.length) delete row.abilities;
  const AR = ((D.factions || {})[faction] || {}).armyRules || [];
  row.rules = u.rules.map(r => { const x = /^(.+?) \((.+) only\)$/.exec(r); if (!x) return r; const ar = AR.find(y => lc(y.name) === lc(x[1]));
    (row.partialRules = row.partialRules || {})[ar ? ar.name : x[1]] = x[2]; return ar ? ar.name : x[1]; });
  // (an army rule factions.json leaves out, one that does nothing in play: Pact of Blood, a mustering restriction)
  const LEFT = Object.keys(FJ[faction].leftOutRules || {});
  row.rules = row.rules.filter(r => !LEFT.includes(r));
  row.kw = u.kw;
  if (u.kwOnly) row.kwOnly = u.kwOnly;
  // GW's costs; GW's models and wargear (verify/waha-loadout.js), the model names New Recruit's exports have shown for each line
  row.points = m.costs;
  const L0 = LOAD(m.sheet, row), nrModels = {}, rename = {};
  const oneModel = L0.loadout.lines.length === 1 && L0.composition.length === 1 && L0.composition[0].max === 1;
  // (a one-model datasheet's model by the name New Recruit's export shows for it, where one does: "Lord on Juggernaut" for GW's "World
  // Eaters Lord on Juggernaut"; else GW's)
  const seenOne = oneModel && m.seen && m.seen.models.length === 1 ? m.seen.models[0].name : null;
  if (seenOne && sing(seenOne) !== sing(L0.loadout.lines[0].model)) rename[L0.loadout.lines[0].model] = typo(seenOne);
  // (the row's profile of the line's name in the singular: New Recruit's model name, "Genestealer" for GW's "Genestealers")
  for (const l of L0.loadout.lines) { const st = (row.stats || []).find(r => sing(r.name) === sing(l.model)); if (st && st.name !== l.model && !rename[l.model] && !oneModel) rename[l.model] = st.name; }
  // (else one model of a line of several is named in the singular, as GW names one: "Bloodletter" of GW's "9 Bloodletters")
  for (const l of L0.loadout.lines) { const c = L0.composition.find(x => x.model === l.model) || {}; if (!rename[l.model] && c.max > 1 && one1(l.model) !== l.model) rename[l.model] = one1(l.model); }
  for (const sm of (m.seen ? m.seen.models : [])) { const l = lineOfShown(sm, L0.loadout.lines.map(x => Object.assign({}, x, L0.composition.find(c => c.model === x.model) || {}))); if (l && !(oneModel && rename[l.model]) && sing(l.model) !== sing(sm.name) && sing(rename[l.model] || '') !== sing(sm.name)) (nrModels[l.model] = nrModels[l.model] || []).push(typo(sm.name)); }
  // (a line of one model whose name New Recruit's export shows otherwise: that name)
  for (const [gw, ns] of Object.entries(nrModels)) { const c = L0.composition.find(x => x.model === gw); if (c && c.max === 1 && ns.length === 1) { rename[gw] = ns[0]; delete nrModels[gw]; } }
  const L = LOAD(m.sheet, row, { nrModels, rename });
  row.composition = L.composition; row.options = L.options; row.loadout = L.loadout;
  return row;
}

// ---------------------------------------------------------------- GW's Faction Pack over the codex (as verify/from-bsdata.js did)
const squashW = t => lc(String(t || '').replace(/\*\*/g, '')).replace(/[^a-z0-9]/g, '');
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
          let nt = packText(e.newText);
          // (a new text opening with the ability's tag, "(Once per turn, per unit) In the Fight phase, …": its tag, the rest its words)
          { const tg = /^\(([^)]*)\)\s+([\s\S]*)$/.exec(nt); if (tg && /^Once per\b/i.test(tg[1])) { ab.tag = tg[1]; nt = tg[2]; } }
          const head = /^([^:(]+?)(?:\s*\(([^)]*)\))?:\s*([\s\S]*)$/.exec(nt.replace(/\*\*/g, ''));
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
  const C = readCatalogue();
  const E = emit(C.roster);
  const byEntry = new Map(C.meta.map(m => [m.entryId, m]));
  const rows = {};
  for (const u of E.units) {
    const m = byEntry.get(u.parts[0].entryId);
    const id = faction + '/' + slug(u.name);
    if (rows[id]) throw new Error('two catalogue datasheets have the id ' + id);
    rows[id] = rowOf(u, m, E, C.D);
  }
  const packApplied = applyPack(rows);
  // GW's words where Wahapedia's transcription differs, and GW's datasheet as its Faction Pack prints it (the hand file, as for the
  // catalogues before: texts, rows)
  const handApplied = [];
  for (const [id, by] of Object.entries(HAND().texts || {})) for (const [an, fx] of Object.entries(by)) {
    if (!rows[id]) continue;   // (a row of New Recruit's data the pages do not have: none to correct)
    const ab = ((rows[id] || {}).abilities || []).find(a => a.name === an);
    if (ab && String(ab.text).split(fx.to).length === 2 && String(ab.text).split(fx.from).length !== 2) continue;
    if (!ab || String(ab.text).split(fx.from).length !== 2) throw new Error('verify/sources/hand/catalog-' + faction + '.json texts ' + id + ' · ' + an + ': its words "' + fx.from + '" are not there exactly once');
    const was = ab.text; ab.text = ab.text.replace(fx.from, fx.to); handApplied.push({ id, field: 'ability[' + an + '].text', app: ab.text, was, why: fx.why });
  }
  for (const [id, h] of Object.entries(HAND().rows || {})) {
    const row = rows[id], bad = w => { throw new Error('verify/sources/hand/catalog-' + faction + '.json rows ' + id + ': ' + w); };
    if (!row) continue;
    // (a fix of New Recruit's data the page's words already have: nothing to do)
    for (const k of h.kwRemove || []) { if (!(row.kw || []).includes(k)) continue; row.kw = row.kw.filter(x => x !== k); handApplied.push({ id, field: 'kw', app: null, was: k, why: h.why }); }
    for (const r of h.rulesAdd || []) { if ((row.rules || []).includes(r.name)) continue; const i = r.after ? row.rules.indexOf(r.after) : -1; if (r.after && i < 0) bad('no rule ' + r.after); row.rules.splice(i + 1, 0, r.name); handApplied.push({ id, field: 'rules', app: r.name, was: null, why: h.why }); }
    for (const [an, fx] of Object.entries(h.abilities || {})) {
      const ab = (row.abilities || []).find(a => a.name === an); if (!ab) continue;
      if ('tag' in fx) { const was = ab.tag; if (fx.tag == null) delete ab.tag; else ab.tag = fx.tag; handApplied.push({ id, field: 'ability[' + an + '].tag', app: fx.tag, was, why: h.why }); }
      if ('name' in fx) { ab.name = fx.name; handApplied.push({ id, field: 'ability[' + fx.name + '].name', app: fx.name, was: an, why: h.why }); }
    }
    for (const a of h.abilityAdd || []) { if ((row.abilities || []).some(x => x.name === a.name)) continue; const i = a.after ? row.abilities.findIndex(x => x.name === a.after) : -1; if (a.after && i < 0) bad('no ability ' + a.after);
      const o = Object.assign({ name: a.name }, a.tag ? { tag: a.tag } : {}, { text: a.text }); row.abilities.splice(i + 1, 0, o); handApplied.push({ id, field: 'ability[' + a.name + '].text', app: a.text, was: null, why: h.why }); }
  }
  // the detachments the catalogue adds (data.js lacks them): as data.js gets them, but for verify/derive.js's labels; a detachment's GW
  // name over Wahapedia's (the hand file's detachmentNames: { "<Wahapedia's>": { gw, why } }); a stratagem id another detachment has
  // gets its detachment's id after it
  const D0 = C.D, taken = new Set(D0.coreStratagems.map(s => s.id).concat(...Object.values(D0.factions).flatMap(f => Object.entries(f.detachments).filter(([, d]) => d.aiStatus !== 'not-read').map(([, d]) => (d.stratagems || []).map(s => s.id)))));
  const DN = HAND().detachmentNames || {};
  const detachmentRows = {};
  for (const [id1, d0] of Object.entries(E.detachments || {})) {
    const d = JSON.parse(JSON.stringify(d0)), gn = DN[d.name] || DN[d.nr];
    // (GW's name over Wahapedia's heading: the detachment's name and id GW's, Wahapedia's kept as waha)
    let id0 = id1;
    if (gn) { const w = d.nr || d.name; delete d.nr; const o = { name: typo(gn.gw), waha: typo(w) }; for (const [k, v] of Object.entries(d)) if (!(k in o)) o[k] = v; Object.keys(d).forEach(k => delete d[k]); Object.assign(d, o); id0 = slug(gn.gw); }
    for (const s of d.stratagems || []) { if (s.gist === null) delete s.gist; if (taken.has(s.id)) s.id = s.id + '-' + id0; taken.add(s.id); }
    detachmentRows[id0] = d;
  }
  // GW's Faction Pack Rules Updates over Wahapedia's words for the detachments the catalogue adds (as applyPack for the datasheets): an
  // enhancement's or a detachment rule's new text ("Change to:"; a rule that gives an ability of its own name, that ability's words), a
  // stratagem's sections ("Change to:" with its labels, or the one its title names), a value ("Change 3" to 6".")
  const detApplied = [];
  { const r = spawnSync(process.execPath, [path.join(ROOT, 'verify/texts.js'), '--updates', faction], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    let ups = []; try { ups = JSON.parse(r.stdout || '[]'); } catch (e) {}
    const lab = t => { const o = {}; let cur = null; for (const l of String(t).split('\n')) { const m = /^(WHEN|TARGET|EFFECT|RESTRICTIONS?):\s*(.*)$/.exec(l.trim()); if (m) { cur = m[1].toLowerCase().replace(/^restriction$/, 'restrictions'); o[cur] = [m[2]]; } else if (cur) o[cur].push(l.trim()); } return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, packText(v.join('\n'))])); };
    for (const [id, d] of Object.entries(detachmentRows)) for (const e of ups.filter(x => [d.name, d.waha].filter(Boolean).some(n => lc(n + ' detachment') === lc(x.section || '')))) {
      const t = String(e.title).trim(), instr = String(e.instr).trim(); let m;
      const set = (o, f, nt, what) => { if (squashW(nt) === squashW(o[f])) return; const was = o[f]; o[f] = nt; detApplied.push({ id: 'detachment:' + id, field: what + '.' + f, app: nt, was, title: t, instr, where: e.where }); };
      if ((m = /^(.+?) Enhancement$/i.exec(t)) && /^Change to:/.test(instr)) { const en = (d.enhancements || []).find(x => lc(x.name) === lc(m[1])); if (en) set(en, 'text', packText(e.newText), 'enhancement[' + en.name + ']'); continue; }
      if ((m = /^(.+?) Stratagem(?:, (.+?) [Ss]ections?)?$/.exec(t))) { const st = (d.stratagems || []).find(x => lc(x.name) === lc(m[1])); if (!st) continue;
        if (/^Change to:/.test(instr)) { const L = lab(e.newText); if (Object.keys(L).length) for (const [f, v] of Object.entries(L)) set(st, f, v, 'stratagem[' + st.name + ']'); else if (m[2] && /^(when|target|effect|restrictions?)$/i.test(m[2])) set(st, m[2].toLowerCase().replace(/^restriction$/, 'restrictions'), packText(e.newText), 'stratagem[' + st.name + ']'); continue; }
        const ch = /^Change (\S+) to (\S+?)\.?$/.exec(instr); if (ch) for (const f of ['when', 'target', 'effect', 'restrictions']) if (st[f] && st[f].split(ch[1]).length === 2) set(st, f, st[f].replace(ch[1], ch[2]), 'stratagem[' + st.name + ']');
        continue; }
      if ((m = /^(.+?) Detachment Rule$/i.exec(t)) && /^Change to:/.test(instr)) { const rr = [d.rule].concat(d.moreRules || []).find(x => x && lc(x.name) === lc(m[1])); if (!rr) continue;
        const L = String(rr.text).split('\n'), k = L.findIndex(l => new RegExp('^\\*\\*' + rr.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\*\\*\\s*').test(l));
        if (k >= 0) { const head = /^\*\*[^*]+:\*\*\s*/.exec(L[k])[0], nt = packText(e.newText); if (squashW(nt) !== squashW(L[k].slice(head.length))) { L[k] = head + nt; set(rr, 'text', L.join('\n'), 'rule[' + rr.name + ']'); } }
        else set(rr, 'text', packText(e.newText), 'rule[' + rr.name + ']'); }
    }
    // (the hand file's detachmentTexts: GW's words where its Faction Pack prints the detachment otherwise than Wahapedia, { "<detachment
    // id>": [{ item:"enhancement:<name>" | "stratagem:<name>", field, from, to, why }] })
    for (const [id, fixes] of Object.entries(HAND().detachmentTexts || {})) for (const fx of fixes) {
      const d = detachmentRows[id], [kind, nm1] = fx.item.split(/:(.*)/), o = d && (kind === 'enhancement' ? d.enhancements : kind === 'stratagem' ? d.stratagems : []).find(x => x.name === nm1);
      if (!o || String(o[fx.field]).split(fx.from).length !== 2) { if (o && String(o[fx.field]).split(fx.to).length === 2) continue; throw new Error('verify/sources/hand/catalog-' + faction + '.json detachmentTexts ' + id + ' · ' + fx.item + ': its words "' + fx.from + '" are not there exactly once'); }
      const was = o[fx.field]; o[fx.field] = o[fx.field].replace(fx.from, fx.to); detApplied.push({ id: 'detachment:' + id, field: fx.item + '.' + fx.field, app: o[fx.field], was, why: fx.why }); } }
  const cat = { _about: 'A faction catalogue: every current datasheet (and detachment) of the faction as rows for data.js (docs/catalog.md). The rows are the committed source; verify/tables.js --write merges them into DATASHEETS and the gate step catalog (verify/catalog.js) holds every row to GW’s datasheets and faction page (Wahapedia). A new faction’s catalogue is written by verify/from-waha.js.',
    faction, origin: { built: 'by verify/from-waha.js from Wahapedia’s faction page and datasheet pages (GW’s codex and Faction Pack as Wahapedia transcribes them), GW’s Faction Pack updates over them; New Recruit’s names where an export of the owner’s has shown them', heldTo: 'GW’s datasheets and faction page (Wahapedia), by the gate step catalog (verify/catalog.js)' },
    counts: { datasheets: Object.keys(rows).length, detachments: C.dets.length, excluded: C.excluded.length },
    datasheets: rows, detachments: C.dets.map(d => Object.assign({ name: typo((DN[d.name] || {}).gw || d.name) }, DN[d.name] ? { waha: typo(d.name) } : {}, { dp: d.dp, dispositions: d.dispositions })), detachmentRows, excluded: C.excluded, weaponNames: E.gwNames, packApplied: packApplied.concat(detApplied.filter(x => x.title)), handApplied: handApplied.concat(detApplied.filter(x => !x.title)),
    modelNames: Object.entries(HAND().modelNames || {}).map(([nr, x]) => ({ nr, gw: x.gw, kind: x.kind })),
    unread: Object.entries(rows).filter(([, r]) => (r.loadout.unread || []).length).map(([id, r]) => ({ id, sentences: r.loadout.unread })) };
  return { C, E, cat, dets: C.dets, excluded: C.excluded };
}

// ---------------------------------------------------------------- --compare: the rows data.js has, and a committed catalogue
const stable = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(y => [y, x[y]])) : x);
function compare(cat, D) {
  const out = [];
  const have = Object.entries(D.datasheets || {}).filter(([, S]) => S.faction === faction);
  const lcv = v => JSON.parse(JSON.stringify(v, (k, x) => typeof x === 'string' && (k === 'name' || k === 'group' || k === 'model' || k === '') ? x.toLowerCase() : x));
  for (const [id, S] of have) {
    const R = cat.datasheets[id];
    if (!R) { out.push({ id, what: 'not in the catalogue', ds: S.name }); continue; }
    for (const f of ['name', 'role', 'rules', 'kw', 'kwOnly', 'points', 'composition']) if (f in S && stable(lcv(S[f])) !== stable(lcv(R[f]))) out.push({ id, what: f, data: S[f], cat: R[f] });
    for (const kind of ['stats', 'ranged', 'melee', 'abilities']) {
      const key = r => lc(r.name + (r.group ? ' (' + r.group + ')' : ''));
      const a = new Map((S[kind] || []).map(r => [key(r), r])), b = new Map((R[kind] || []).map(r => [key(r), r]));
      for (const [k, r] of a) {
        const c = b.get(k);
        if (!c) { out.push({ id, what: kind + ' ' + k + ': on the row, not in the catalogue', data: r }); continue; }
        const fields = kind === 'stats' ? STAT : kind === 'abilities' ? ['who', 'tag', 'text'] : WPN.concat(['fireAll', 'hunter']);
        for (const f of fields) if (stable(r[f]) !== stable(c[f]) && !(r[f] === undefined && kind === 'abilities' && f === 'who')) out.push({ id, what: kind + ' ' + k + ' ' + f, data: r[f], cat: c[f] });
      }
      for (const [k, c] of b) if (!a.has(k)) out.push({ id, what: kind + ' ' + k + ': in the catalogue, not on the row', cat: c, fill: true });
    }
  }
  for (const id of Object.keys(cat.datasheets)) if (!have.some(([k]) => k === id)) out.push({ id, what: 'new datasheet (no list has it)', fill: true });
  return out;
}

// ---------------------------------------------------------------- the report
function report(r, cmp) {
  const { cat, E, excluded } = r;
  const L = ['# ' + FJ[faction].bsdata + ' catalogue (' + faction + ')', '',
    'From Wahapedia’s pages by `verify/from-waha.js`, read by `verify/from-json.js` as every list is. ' + cat.counts.datasheets + ' datasheets, ' + cat.counts.detachments + ' detachments (' + Object.keys(cat.detachmentRows).length + ' new to data.js); ' + excluded.length + ' left out.', '',
    '## Left out', '', ...excluded.map(x => '- ' + x.kind + ': ' + x.name + ' (' + x.why + ')'), '',
    '## WARGEAR OPTIONS not read (builder.js refuses a loadout other than GW’s default on these datasheets)', '', ...cat.unread.flatMap(x => x.sentences.map(s => '- ' + x.id + ': ' + s)), '',
    '## Faction Pack updates applied', '', ...cat.packApplied.map(p => '- ' + p.id + ' ' + p.field + ': ' + JSON.stringify(p.app)), '',
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
  if (flag('--write')) require('./catalog-write')(ROOT, faction, Object.assign(r, { devs: [] }), SRC);
  console.log('catalogue ' + faction + ': ' + r.cat.counts.datasheets + ' datasheets, ' + r.cat.counts.detachments + ' detachments (' + Object.keys(r.cat.detachmentRows).length + ' new to data.js), ' + r.excluded.length + ' left out; ' + r.cat.unread.length + ' datasheets with WARGEAR OPTIONS not read; ' + cmp.filter(x => !x.fill).length + ' differences from data.js’s rows (verify/out/catalog/' + faction + '.md)');
}
module.exports = { forFaction, build, compare, readCatalogue, rowOf };
