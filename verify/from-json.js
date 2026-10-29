#!/usr/bin/env node
/* verify/from-json.js: a New Recruit JSON export (a BattleScribe roster whose entryIds are BSData ids) -> the list in data.js,
   with no transcription by hand. What it writes, and where each part comes from:

     the list        name, points, battle size, Force Disposition, detachments: the export's top-level selections
     each unit       found by its BSData id (the last id of each entryId; every profile and rule it carries is looked up by
                     its own id in the BSData clone at the repo's pin, verify/.cache/bsdata, and must be there under the same
                     name): name, role (the datasheet's primary category), points, copies, leader / support and the points of
                     each part, enhancement / upgrade / Warlord, models lines with their wargear, the weapons each line
                     carries, stat rows, weapon rows (group, profile, who carries it, ×N), abilities (name, tag, who),
                     Rules line, keywords: the export's selections and profiles, which are BSData's (verify/bsdata.js then
                     rebuilds every unit from BSData itself, modifiers included, and compares)
     wording         each ability's text with its markup from the cached Wahapedia datasheet (verify/waha-words.js), found
                     by BSData's words; where BSData's words differ from Wahapedia's (which transcribes GW's codex), the
                     datasheet's text by the ability's name, GW's words winning: listed as a deviation to declare
     faction rows    a faction or detachment data.js lacks: army rules (the ones the units name), detachment rule,
                     enhancements and stratagems from the Wahapedia faction page (verify/.cache/waha/<faction>.txt, the
                     codex as Wahapedia transcribes it); Force Dispositions from BSData (verify/dispositions.js)
     labels          phases, turn, needs, tags: verify/derive.js's fixed rules, on the words just written (never by hand);
                     where derive.js cannot derive one, or its reading is not the signed-off one (verify/derive-unread.json), the label is left out and listed
     "+" marks       verify/bsdata.js + verify/write-grants.js (BSData's modifiers), as for every list
   and lists everything it could not fill mechanically (verify/out/from-json-<army>.md), each marked as what a person (or
   an AI, marked as such) still writes. A stratagem's gist is such a column: it is written AI-assisted and marked
   (data.js comment "gist: AI-written").

   Usage: node verify/from-json.js <export.json> <armyId> [--write] [--compare]
     (default)  print what it would write to verify/out/from-json-<armyId>.js and the report
     --write    put the army (and any missing faction rows) into data.js, then the "+" marks and labels
     --compare  build the units of a list data.js already has from its export, and list every difference from data.js
     --emit <f> write the reading (units, new detachments, deviations, what is left to do) as JSON to <f> and stop: nothing is
                written into data.js (verify/from-bsdata.js reads a faction's whole catalogue so)
     --refs     with --write: only the list's reference sheets (hand refs, New Recruit's reference entries) go into data.js, the
                list's other units stay as data.js has them (a list not written by this file: Mucho Mutantes' Chaos Spawn)
                (the proof that the reading of an export is the reading of the PDF the list was made from) */
'use strict';
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const NR = require('./nr');
const { nm, lc, cellV, appText, textEq, splitItems } = NR;
const { lit, block, unitSrc } = require('./waha-words').writer;
const baseGuide = require('./base-guide');

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2);
const flag = f => argv.includes(f);
const pos = argv.filter(a => !a.startsWith('--'));
if (pos.length < 2) { console.error('usage: node verify/from-json.js <export.json> <armyId> [--write] [--compare]'); process.exit(2); }
const [srcFile, armyId] = pos;
const DATA = path.join(ROOT, 'data.js');
const loadD = () => { global.window = {}; delete require.cache[DATA]; require(DATA); return window.WH_DATA; };
let D = loadD();
const J = JSON.parse(fs.readFileSync(path.resolve(srcFile), 'utf8'));
const R = J.roster, FORCE = R.forces[0];

// ---------------------------------------------------------------- small helpers
const typo = s => String(s).replace(/'/g, '’');
// a detachment's rules: `rule`, then any further ones (`moreRules`)
const detRulesOf = d => d && d.rule ? [d.rule].concat(d.moreRules || []) : [];
const slug = s => nm(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const uniq = a => [...new Set(a)];
const lastId = e => String(e || '').split('::').pop();
const ptsOf = s => (s.costs || []).filter(c => c.name === 'pts').reduce((t, c) => t + (Number(c.value) || 0), 0);
const costOf = s => ptsOf(s) + (s.selections || []).reduce((t, c) => t + costOf(c), 0);
const WEAPON = ['Ranged Weapons', 'Melee Weapons'];
// (a profile of another type with a weapon's characteristics is a weapon: BSData's "C'tan Powers" profiles of the Tesseract Vault,
// which GW's datasheet prints as RANGED WEAPONS [C'TAN POWER])
const weaponShaped = p => p.typeName !== 'Unit' && ['Range', 'A', 'S', 'AP', 'D'].every(k => (p.characteristics || []).some(c => c.name === k)) && (p.characteristics || []).some(c => c.name === 'BS' || c.name === 'WS');
const isWeaponProf = p => WEAPON.includes(p.typeName) || weaponShaped(p);
const weaponKind = p => p.typeName === 'Ranged Weapons' || (!WEAPON.includes(p.typeName) && !/^melee$/i.test(((p.characteristics || []).find(c => c.name === 'Range') || {}).$text || '')) ? 'ranged' : 'melee';
const isWeaponSel = s => (s.profiles || []).some(isWeaponProf);
const isEnh = s => /^Enhancements/.test(s.group || '');
const kidsOf = s => s.selections || [];
// BSData's text markup (^^**KEYWORD**^^, **bold**) and its stray asterisks: the plain words New Recruit prints
const plainBS = t => String(t || '').replace(/\^\^/g, '').replace(/\*\*/g, '').replace(/(^|\s)\*(?=\S)|(?<=\S)\*(?=\s|$|[.,;:])/g, '$1').replace(/\u00a0/g, ' ');
const todo = [];      // what the pipeline could not fill: [{ what, where, why, filled }]
const filled = [];    // what it filled mechanically: [{ what, from }]
const devs = [];      // deviations to declare (GW over BSData / New Recruit)
const want = (where, what, why) => todo.push({ where, what, why });
// what a person (or an AI, marked as such) wrote because it cannot be filled mechanically: verify/sources/hand/<army>.json
const HANDF = path.join(ROOT, 'verify/sources/hand', armyId + '.json');
const HAND = fs.existsSync(HANDF) ? JSON.parse(fs.readFileSync(HANDF, 'utf8')) : {};
const handDone = [];
// bookkeeping on a row that data.js does not get (not enumerable: the writer never sees it)
const hide = (o, extra) => { for (const [k, v] of Object.entries(extra)) Object.defineProperty(o, k, { value: v, enumerable: false, writable: true }); return o; };

// ---------------------------------------------------------------- BSData at the pin: every id of the faction's files
const FJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/sources/factions.json'), 'utf8'));
const BSDIR = path.join(ROOT, 'verify/.cache/bsdata');
const BS = new Map();   // id -> object
let PIN_REV = null;   // the catalogue's revision at the pin (the export names the one New Recruit used)
// (the catalogue the export names, the libraries it links, and the game system)
const bsFiles = new Map();   // catalogue id -> parsed file
for (const f of fs.readdirSync(BSDIR).filter(f => f.endsWith('.json'))) {
  const raw = fs.readFileSync(path.join(BSDIR, f), 'utf8'), m = /"id"\s*:\s*"([^"]+)"/.exec(raw.slice(0, 2000));
  if (m) bsFiles.set(m[1], { f, raw });
}
const bsIndex = id => {
  const x = bsFiles.get(id); if (!x || x.done) return null;
  x.done = true; const top = JSON.parse(x.raw);
  const walk = o => { if (Array.isArray(o)) { o.forEach(walk); return; } if (!o || typeof o !== 'object') return; if (o.id && !BS.has(o.id)) BS.set(o.id, o); for (const k in o) if (o[k] && typeof o[k] === 'object') walk(o[k]); };
  walk(top);
  return top.catalogue || top.gameSystem || top;
};
{
  const cat = bsIndex(FORCE.catalogueId); PIN_REV = cat && cat.revision;
  if (!cat) { console.error('no BSData catalogue with the id ' + FORCE.catalogueId + ' (' + FORCE.catalogueName + ') in verify/.cache/bsdata: sh verify/fetch.sh'); process.exit(2); }
  for (const l of cat.catalogueLinks || []) bsIndex(l.targetId);
  bsIndex(cat.gameSystemId);
}
// an id none of those files has: the catalogue of another faction whose units the list may take (the Ultramarines'
// Deathwatch Terminator Squad, from "Imperium - Adeptus Astartes - Deathwatch", by the Deathwatch Support detachment)
const extraCats = [];
const bsGet = id => {
  if (BS.has(id)) return BS.get(id);
  for (const [cid, x] of bsFiles) if (!x.done && x.raw.includes('"' + id + '"')) { const c = bsIndex(cid); if (c) { extraCats.push(c.name); for (const l of c.catalogueLinks || []) bsIndex(l.targetId); } }
  return BS.get(id);
};
const bsChecked = { selections: 0, profiles: 0, rules: 0, modified: [] };
// every selection, profile and rule of the export by its BSData id; a profile whose values New Recruit changed (a rule of the
// list applied: "(Flare Shields)") is recorded, the gate's verify/bsdata.js re-derives the change from BSData's modifiers
function bsCheck(s, where) {
  const e = bsGet(lastId(s.entryId));
  if (!e) want(where, 'selection ' + s.name, 'its BSData id ' + lastId(s.entryId) + ' is not in BSData at the pin');
  else bsChecked.selections++;
  for (const p of s.profiles || []) {
    const b = bsGet(p.id);
    if (!b) { want(where, 'profile ' + p.name, 'its BSData id ' + p.id + ' is not in BSData at the pin'); continue; }
    bsChecked.profiles++;
    const bc = Object.fromEntries((b.characteristics || []).map(c => [c.name, nm(c.$text || '')]));
    const diff = (p.characteristics || []).filter(c => c.typeId !== 'nr-base-size' && nm(c.$text || '') !== (bc[c.name] ?? ''));
    if (nm(p.name) !== nm(b.name) || diff.length) bsChecked.modified.push(where + ' · ' + p.name + (nm(p.name) !== nm(b.name) ? ' (BSData: ' + b.name + ')' : '') + (diff.length ? ': ' + diff.map(c => c.name + ' ' + (bc[c.name] || '–') + ' → ' + nm(c.$text || '')).join(', ') : ''));
  }
  for (const r of s.rules || []) { if (bsGet(r.id)) bsChecked.rules++; else want(where, 'rule ' + r.name, 'its BSData id ' + r.id + ' is not in BSData at the pin'); }
  for (const c of kidsOf(s)) bsCheck(c, where);
}

// ---------------------------------------------------------------- the faction
const catName = nm(FORCE.catalogueName), facName = catName.replace(/^.* - /, '');
let factionId = Object.keys(FJ).find(k => k[0] !== '_' && FJ[k].bsdata && nm(FJ[k].bsdata) === catName);
const newFactionEntry = !factionId;
if (!factionId) factionId = slug(catName.replace(/^.* - /, ''));
const WAHA = (FJ[factionId] || {}).waha || factionId;
const WW = require('./waha-words')(ROOT, factionId);
// a reference entry of the export (New Recruit's "Spore Mines (Biovore)", category Reference: the profile of a unit a rule of the list
// adds to the army, 0 pts): its datasheet page is the one of its name less the bracket (Spore-Mines)
// the ability names the hand file has GW's (Wahapedia's) capitalisation for (caseNames), where it differs only in case
const caseGW = new Set((HAND.caseNames || []).map(nm));
const isRefSel = s => (s.categories || []).some(c => c.name === 'Reference');
const REF_NAMES = new Set((FORCE.selections || []).filter(isRefSel).map(s => nm(s.name)));
const refBase = n => REF_NAMES.has(nm(n)) ? nm(n).replace(/\s*\([^()]*\)$/, '') : n;
{ const a0 = WW.wahaAddress, p0 = WW.wahaPage; WW.wahaAddress = n => a0(refBase(n)); WW.wahaPage = (n, f) => p0(refBase(n), f); }
// an allied unit (its primary category New Recruit's "Allies: Imperial Agents") has its datasheet under its own faction's Wahapedia
// pages and its base size in that faction's section of GW's base size guide: sources/factions.json names the faction (the list's
// faction's "allies", as verify/import-nr.js reads them). It does not have its own faction's army rules (the owner's ruling: a unit
// taken as an ally or agent is not of the army's faction; the Nurglings in a Chaos Knights army have no Shadow of Chaos)
const ALLIES = (FJ[factionId] || {}).allies || {};
const allyOf = s => { const c = (s.categories || []).find(x => x.primary && /^Allies: /.test(nm(x.name))); return c ? nm(c.name).replace(/^Allies: /, '') : null; };
const allyByName = new Map();   // a top-level selection's name -> its ally faction's name
for (const s of FORCE.selections || []) { const a = allyOf(s); if (a) allyByName.set(nm(s.name), a); }
const pageFac = name => { const a = allyByName.get(nm(name)); return a ? ALLIES[a] || null : factionId; };
for (const a of new Set(allyByName.values())) if (!ALLIES[a]) want('faction', 'allied faction ' + a, 'name its Wahapedia faction in verify/sources/factions.json (' + factionId + '.allies), then run again');
const wahaTxtFile = path.join(ROOT, 'verify/.cache/waha', factionId + '.txt');
const wahaTxt = fs.existsSync(wahaTxtFile) ? fs.readFileSync(wahaTxtFile, 'utf8') : null;
if (!wahaTxt) want('faction', 'Wahapedia faction page', 'verify/.cache/waha/' + factionId + '.txt is missing: add the faction to verify/sources/factions.json and run sh verify/fetch.sh');

// the Wahapedia faction page in sections ("######## Name 1DP"), lines kept with their markup
const wahaSections = () => {
  const out = []; let cur = null;
  for (const line of (wahaTxt || '').split('\n')) {
    const m = /^######## (.*)$/.exec(line);
    if (m) { cur = { title: m[1].trim(), lines: [] }; out.push(cur); continue; }
    if (cur && line.trim()) cur.lines.push(line.trim());
  }
  return out;
};
const bare = t => t.replace(/\*\*/g, '').replace(/~~/g, '').trim();
// Wahapedia's bold can run over a line break ("**KA’TAH ABILITY" / "WHEN:** Your Command phase."); the app marks up each line on
// its own, so a bold run is closed at the end of its line and opened again on the next
function balanced(lines) {
  let open = false;
  return lines.map(l => { let x = (open ? '**' : '') + l; const n = (x.match(/\*\*/g) || []).length; open = n % 2 === 1; if (open) x += '**'; return x.replace(/\*\*\*\*/g, ''); });
}
// a sub-heading inside a rule, as Wahapedia draws it (<span class="hi_custom">Furor Tactics</span>): bold in the app's text, as
// Martial Ka’tah's "**Favoured Ka’tah**" (verify/derive.js reads such headings as the rule's options)
const SUBHEADS = (() => { const f = path.join(ROOT, 'verify/.cache/waha', factionId + '.html'); if (!fs.existsSync(f)) return new Set();
  return new Set([...fs.readFileSync(f, 'utf8').matchAll(/<span class="hi_custom">([^<]+)<\/span>/g)].map(m => m[1].replace(/&rsquo;|&#8217;/g, '’').trim()).filter(x => /[a-z]/.test(x))); })();   // (one in capitals stays as printed)
const ruleLines = lines => balanced(lines).map(l => !/\*\*/.test(l) && SUBHEADS.has(l.trim()) ? '**' + l.trim() + '**' : l);
const SEGHEAD = /^(Detachment Rules?|Enhancements|Stratagems)$/, NOTEHEAD = /^(FAQ|Errata|FAQ \/ Errata)$/;
// the names of the detachments' rules, as the page's contents list them under "Detachment Rule" (Blood Legion: Murdercall, Blood
// Tainted): a detachment can have more than one, and a rule's heading ends an Errata or FAQ spoiler before it
const DETRULEHEADS = (() => { const f = path.join(ROOT, 'verify/.cache/waha', factionId + '.html'); if (!fs.existsSync(f)) return new Set();
  const h = fs.readFileSync(f, 'utf8'), out = new Set();
  for (const m of h.matchAll(/class="cnClrInv">Detachment Rules?<\/a><\/div>((?:<div class="[^"]*\bi50\b[^"]*"[^>]*><a href="[^"]*" class="cnClrInv">[^<]+<\/a><\/div>)+)/g))
    for (const x of m[1].matchAll(/class="cnClrInv">([^<]+)</g)) out.add(x[1].replace(/&rsquo;|&#8217;/g, '’').trim());
  return out; })();
const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with']);
// GW prints stratagem names in capitals; data.js in title case (texts.js compares them case-insensitively)
const titleCase = s => typo(s).toLowerCase().split(' ').map((w, i) => i > 0 && SMALL.has(w) ? w : w.replace(/(^|[-’'])([a-z])/g, (m, a, b) => a + b.toUpperCase())).join(' ').replace(/’S\b/g, '’s');
// a detachment on the Wahapedia page: rule, enhancements, stratagems (as verify/texts.js reads them, markup kept)
function wahaDetachment(name) {
  // (by its name; else by its letters alone, GW's spelling then the detachment's name: BSData's "Shadow Keepers" is GW's Shadowkeepers)
  const squash = x => lc(x).replace(/[^a-z0-9]/g, '');
  const sec = wahaSections().find(s => lc(s.title.replace(/ \d+DP$/, '')) === lc(name)) || wahaSections().find(s => squash(s.title.replace(/ \d+DP$/, '')) === squash(name));
  if (!sec) return null;
  const dp = /(\d+)DP$/.exec(sec.title);
  const res = { dp: dp ? +dp[1] : null, rule: null, rules: [], enh: [], strats: [] };
  if (lc(sec.title.replace(/ \d+DP$/, '')) !== lc(name)) res.gwName = sec.title.replace(/ \d+DP$/, '');
  let seg = null, cur = null, note = false, field = null;
  const L = sec.lines;
  for (let i = 0; i < L.length; i++) {
    const t = L[i], b = bare(t);
    if (SEGHEAD.test(b)) { seg = /^Detachment/.test(b) ? 'rule' : b === 'Enhancements' ? 'enh' : 'strat'; cur = null; note = false; if (seg === 'rule') { res.rule = { name: null, lines: [] }; res.rules = [res.rule]; } continue; }
    // the detachment's next rule (its heading in the page's contents): it ends the spoiler before it
    if (seg === 'rule' && res.rule.name && [...DETRULEHEADS].some(x => lc(x) === lc(b)) && !res.rules.some(r => lc(r.name) === lc(b))) { res.rule = { name: b, lines: [] }; res.rules.push(res.rule); note = false; continue; }
    if (NOTEHEAD.test(b)) { note = true; continue; }
    // (the codex's preamble, "If your Army Faction is LEGIONES DAEMONICA, you can use this Daemonic Incursion Detachment rule.",
    // before the first rule or, on Wahapedia's Shadow Legion, after the mustering rule: no rule's name or words)
    if (seg === 'rule' && /^If your Army Faction is .+, you can use this .+ Detachment rules?\.$/.test(b.replace(/\*\*/g, ''))) continue;
    if (seg === 'rule') { if (note) continue; if (!res.rule.name) res.rule.name = b; else res.rule.lines.push(t); }
    else if (seg === 'enh') {
      const m = /^- (.+?)\s*(UPGRADE)?\s*(\d+) pts$/.exec(b);
      if (m) { cur = { name: m[1].trim(), upgrade: !!m[2], pts: +m[3], lines: [] }; res.enh.push(cur); note = false; continue; }
      if (cur && !note) cur.lines.push(t);
    } else if (seg === 'strat') {
      if (L[i + 1] && /^\dCP$/.test(bare(L[i + 1])) && L[i + 2] && /Stratagem$/.test(bare(L[i + 2])) && !/[a-z]/.test(b)) {
        cur = { name: b, cp: +bare(L[i + 1])[0], fields: {} }; res.strats.push(cur); field = null; i += 2; note = false; continue;
      }
      if (!cur || note) continue;
      // "**WHEN:** Your Shooting phase." / "**EFFECT:**" (its bullets on the next lines)
      const m = /^\*\*(WHEN|TARGET|EFFECT|RESTRICTIONS):\*\*\s*(.*)$/.exec(t);
      if (m) { field = m[1].toLowerCase(); cur.fields[field] = m[2] ? [m[2]] : []; continue; }
      // (Wahapedia's bold running on from the heading into the words, "**EFFECT: Declare a charge** with your unit.": the heading, then
      // the words with their bold, "**Declare a charge** with your unit.")
      const m2 = /^\*\*(WHEN|TARGET|EFFECT|RESTRICTIONS):\s+(?!\*\*)(\S.*)$/.exec(t);
      if (m2) { field = m2[1].toLowerCase(); cur.fields[field] = ['**' + m2[2]]; continue; }
      if (field) cur.fields[field].push(t);
    }
  }
  res.rule = res.rules[0] || null;   // (its first rule)
  return res;
}
// the army rules section: rule name lines, each followed by its text (as verify/texts.js reads them)
function wahaArmyRules() {
  const sec = wahaSections().find(s => s.title === 'Army Rules');
  if (!sec) return [];
  const L = sec.lines, out = []; let cur = null;
  // (as verify/texts.js reads it: the page's contents name its army rules; a heading inside one, "Favoured Ka’tah", is not one)
  const htmlF = path.join(ROOT, 'verify/.cache/waha', factionId + '.html');
  const toc = fs.existsSync(htmlF) ? require('./waha-words').wahaArmyRuleNames(fs.readFileSync(htmlF, 'utf8')) : null;
  const isName = toc ? (i => toc.some(n => lc(n) === lc(bare(L[i])))) : i => { const t = bare(L[i]), n = L[i + 1] && bare(L[i + 1]); return t.length < 50 && /^[A-Z]/.test(t) && /[a-z]/.test(t) && !/[.:,;]/.test(t) && !/ Army Rule$/.test(t) && !/^(Errata|FAQ|Show|FAQ \/ Errata)$/.test(t) && !!n && n.length >= 35 && (!/^- /.test(n) || ruleNames.some(r => lc(r) === lc(t))); };
  for (let i = 0; i < L.length; i++) { if (isName(i)) { cur = { name: bare(L[i]), lines: [] }; out.push(cur); continue; } if (cur) cur.lines.push(L[i]); }
  // a rule's FAQ spoiler ("FAQ" / "Show" / "Q:…" / "A:" / "No."): one line "*Wahapedia FAQ: <question> <answer>*", as data.js writes
  // Wahapedia's FAQs (verify/texts.js checks it there)
  for (const r of out) {
    const k = r.lines.findIndex(l => NOTEHEAD.test(bare(l))); if (k < 0) continue;
    const faq = r.lines.splice(k).slice(1).filter(l => bare(l) !== 'Show'), qa = [];
    for (const l of faq) { const q = /^Q:\s*(.*)$/.exec(l), a = /^A:\s*(.*)$/.exec(l); if (q) qa.push({ q: q[1], a: [] }); else if (a) { if (qa.length && a[1]) qa[qa.length - 1].a.push(a[1]); } else if (qa.length) qa[qa.length - 1].a.push(l); }
    for (const x of qa) r.lines.push('*Wahapedia FAQ: ' + bare(x.q) + ' ' + x.a.map(bare).join(' ') + '*');
  }
  return out;
}

// ---------------------------------------------------------------- the list's top-level selections
const tops = FORCE.selections.filter(s => s.type === 'upgrade');
const rootsAll = FORCE.selections.filter(s => s.type !== 'upgrade');
const topNamed = n => tops.find(s => nm(s.name) === n);
const bsz = topNamed('Battle Size'), detSel = topNamed('Detachment'), dispSel = topNamed('Force Disposition');
const bsm = /^(.*?) \((\d+) Point limit\)$/.exec(nm(((bsz || {}).selections || [{}])[0].name || '')) || [];
const detNames = ((detSel || {}).selections || []).map(c => nm(c.name));
const disposition = dispSel ? nm(((dispSel.selections || [])[0] || {}).name || '') : null;
// the other top-level selections with a value ("Code Chivalric: Deed, Quality"): the list's config, as New Recruit prints it
const config = {};
for (const t of tops) {
  if (['Battle Size', 'Detachment', 'Force Disposition', 'Show/Hide Options'].includes(nm(t.name))) continue;
  if ((t.selections || []).length) config[typo(nm(t.name))] = typo(t.selections.map(c => nm(c.name)).join(', '));
}

// ---------------------------------------------------------------- faction rows data.js lacks (from Wahapedia, BSData)
let F = D.factions[factionId];
const facSrc = { armyRules: [], detachments: {} };   // what this run adds (written into data.js FACTIONS)
const DISP = require('./dispositions').byDetachment().out;
const dispOf = n => { const k = Object.keys(DISP).find(x => lc(x) === lc(n)); return k ? DISP[k] : null; };
const stripLabel = s => s;
// an enhancement's text; a weapon it gives, printed as a table ("MELEE WEAPONS / RANGE / A / WS / … / **Imperium’s Sword** / … / 3"), is
// one line "Imperium’s Sword: Melee A6 WS2+ S7 AP-3 D3 []" (as verify/texts.js reads an enhancement's weapon)
function enhText(lines) {
  const k = lines.findIndex(l => /^(MELEE|RANGED) WEAPONS$/.test(bare(l)));
  if (k < 0) return balanced(lines).join('\n');
  const heads = []; let j = k + 1;
  while (j < lines.length && /^(RANGE|A|BS|WS|S|AP|D)$/.test(bare(lines[j]))) heads.push(bare(lines[j++]));
  const name = bare(lines[j] || ''); j++;
  if (bare(lines[j] || '') === name) j++;
  // (Wahapedia prints the name and the weapon's keywords on one line, "Da Gobshot Thunderbuss LETHAL HITS: non-MONSTER/VEHICLE RAPID
  // FIRE 6": the keywords from the first weapon ability the app's weapons have, each up to the next, "[LETHAL HITS: non-MONSTER/VEHICLE,
  // RAPID FIRE 6]")
  const kwBase = new Set(); for (const S of Object.values(D.datasheets || {})) for (const r of (S.ranged || []).concat(S.melee || [])) for (const k of r.kw || []) kwBase.add(k.replace(/^ANTI-.*$/, 'ANTI-').replace(/(?::.*|\s+[\dD+-][^\s]*)$/, '').trim());
  // (and a weapon ability the enhancement defines below the weapon, "**[BLINDING LIGHT]**: In your Shooting phase, …")
  for (const l of lines) for (const m of bare(l).matchAll(/^\[([A-Z][A-Z0-9 -]+)\]:/g)) kwBase.add(m[1].trim());
  const toks = name.split(/\s+/), baseAt = i => { if (/^ANTI-/.test(toks[i])) return 1; for (let n = 3; n >= 1; n--) if (i + n <= toks.length && kwBase.has(toks.slice(i, i + n).join(' ').replace(/:$/, ''))) return n; return 0; };
  const at = toks.findIndex((t, i) => i > 0 && baseAt(i)), kws = [];
  for (let i = at; at > 0 && i < toks.length;) { const n = baseAt(i) || 1, w = toks.slice(i, i + n); i += n; while (i < toks.length && !baseAt(i)) w.push(toks[i++]); kws.push(w.join(' ')); }
  const nameKw = at > 0 ? toks.slice(0, at).join(' ') : name;
  const vals = lines.slice(j, j + heads.length).map(bare);
  if (heads.length !== 6 || vals.length !== 6) return balanced(lines).join('\n');
  const v = Object.fromEntries(heads.map((h, i) => [h, vals[i]])), sk = v.BS !== undefined ? 'BS' : 'WS';
  const line = typo(nameKw) + ': ' + v.RANGE + ' A' + v.A + ' ' + sk + v[sk] + ' S' + v.S + ' AP' + v.AP + ' D' + v.D + ' [' + kws.join(', ') + ']';
  return balanced(lines.slice(0, k)).concat([line], balanced(lines.slice(j + heads.length))).join('\n');
}
const dispDevs = [];   // detachments whose Force Dispositions come from Wahapedia (none in BSData at the pin)
function wahaDispositions(name) {
  const f = path.join(ROOT, 'verify/.cache/waha', factionId + '.html'); if (!fs.existsSync(f)) return [];
  const h = fs.readFileSync(f, 'utf8'), anchor = nm(name).replace(/['’]/g, '-').replace(/\s+/g, '-');
  const i = h.indexOf('id="' + anchor + '"'); if (i < 0) return [];
  const j = h.indexOf('class="outline_header"', h.indexOf('>', i) + 1), seg = h.slice(i, j > 0 ? j : i + 20000);
  return uniq([...seg.matchAll(/title="Force Disposition: ([^"]+)"/g)].map(m => m[1].trim()));
}
const detIds = detNames.map(n => {
  // (by GW's name, or the name BSData and New Recruit spell, nr)
  // (in --emit, a detachment a faction catalogue added, aiStatus 'not-read', is read again from its sources: verify/from-bsdata.js writes it)
  const have = F && Object.keys(F.detachments).find(k => (lc(F.detachments[k].name) === lc(n) || (F.detachments[k].nr && lc(F.detachments[k].nr) === lc(n))) && !(argv.includes('--emit') && F.detachments[k].aiStatus === 'not-read'));
  if (have) return have;
  const W = wahaDetachment(n), id = slug(W && W.gwName || n);
  if (!W) { want('detachment ' + n, 'rule, enhancements, stratagems', 'not on the Wahapedia faction page'); return id; }
  const det = { name: typo(W.gwName || n) };
  // (GW's name where BSData and New Recruit spell it otherwise, by more than case: theirs as nr, as for an enhancement)
  if (W.gwName) { det.nr = typo(n); filled.push({ what: 'detachment ' + n + ': GW’s name ' + W.gwName, from: 'the Wahapedia faction page’s heading (BSData and New Recruit: ' + n + ')' }); }
  const dsp = dispOf(n);
  if (dsp) det.dispositions = dsp;
  else {
    // none in BSData at the pin (Deathwatch Support is an unfinished entry there): the ones the Wahapedia faction page shows for the
    // detachment ("Force Disposition: Disruption"), GW's, declared as a deviation
    const wd = wahaDispositions(n);
    if (wd.length) { det.dispositions = wd; dispDevs.push({ detachment: typo(n), app: wd }); filled.push({ what: 'dispositions of ' + n + ': ' + wd.join(', '), from: 'Wahapedia ' + factionId + '.html (the detachment’s "Force Disposition" marks); BSData at the pin has none' }); }
    else want('detachment ' + n, 'dispositions', 'not found in BSData or on the Wahapedia page');
  }
  det.dp = W.dp;
  // its rules: the first is `rule`, any further ones `moreRules` (Blood Legion's Blood Tainted after Murdercall)
  const ruleOf = (WR, i) => {
    const r = { name: typo(WR.name) };
    // a Damage-tab reading written by hand (verify/sources/hand/<army>.json rules: the detachment's id for its first rule, "<id>/<rule
    // name>" for a further one)
    const hr = (HAND.rules || {})[i ? id + '/' + r.name : id];
    if (hr && hr.calcMods) { r.calcMods = hr.calcMods; handDone.push({ what: 'calcMods of ' + WR.name + ' (' + n + ')', by: hr.by, text: hr.calcMods.map(m => m.from + ': ' + m.note).join('; ') }); }
    r.text = ruleLines(WR.lines).join('\n');
    return r;
  };
  det.rule = ruleOf(W.rules[0], 0);
  if (W.rules.length > 1) det.moreRules = W.rules.slice(1).map((r, i) => ruleOf(r, i + 1));
  det.enhancements = W.enh.map(e => {
    // "Memento Moritoi (one per army)": GW's name with its limit; BSData and New Recruit name it without (nr: their spelling)
    const lim = /^(.*?) \((one per army)\)$/i.exec(e.name);
    const o = { name: typo(lim ? lim[1] : e.name) };
    if (lim) o.limit = lim[2][0].toUpperCase() + lim[2].slice(1);
    o.pts = e.pts; if (e.upgrade) o.upgrade = true;
    o.text = enhText(e.lines);
    return o;
  });
  det.stratagems = W.strats.map(s => {
    const o = { id: slug(s.name) };
    // the hand file's columns for it (verify/sources/hand/<army>.json gists): its footnote (mod, hand) and When targeted line (def,
    // AI-written, with the fingerprint of the text it was written from), then its gist
    const h0 = (HAND.gists || {})[id + '/' + o.id] || {};
    if (h0.mod) { const m = Object.assign({}, h0.mod); delete m.by; o.mod = m; handDone.push({ what: 'footnote of ' + titleCase(s.name) + ' (' + n + ')', by: h0.mod.by, text: m.note }); }
    if (h0.def) { o.def = h0.def; if (h0.defOf) o.defOf = h0.defOf; handDone.push({ what: 'When targeted line of ' + titleCase(s.name) + ' (' + n + ')', by: h0.by, text: h0.def }); }
    Object.assign(o, { gist: null, name: titleCase(s.name), cp: s.cp });
    for (const f of ['when', 'target', 'effect', 'restrictions']) if (s.fields[f]) o[f] = balanced(s.fields[f]).join('\n');
    // the gist is the app's own words: from verify/sources/hand/<army>.json, written by hand (AI-assisted, marked there)
    const h = (HAND.gists || {})[id + '/' + o.id];
    if (h) { o.gist = h.gist; if (h.gistOf) { const rest = Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'id' && k !== 'gist')); Object.keys(rest).forEach(k => delete o[k]); o.gistOf = h.gistOf; Object.assign(o, rest); } handDone.push({ what: 'gist of ' + o.name + ' (' + n + ')', by: h.by, text: h.gist }); }
    else want('stratagem ' + o.name + ' (' + n + ')', 'gist', 'a one-line summary is the app’s own words: write it in verify/sources/hand/' + armyId + '.json (gists), marked by whom');
    // (GW's FAQ on it from the Faction Pack, labelled as the pack's: the hand file's note, after the gist as data.js has notes)
    if (h0.note) { const ks = Object.keys(o), at = ks.indexOf(o.gistOf ? 'gistOf' : 'gist') + 1, rest = Object.fromEntries(ks.slice(at).map(k => [k, o[k]])); ks.slice(at).forEach(k => delete o[k]); o.note = h0.note; Object.assign(o, rest); handDone.push({ what: 'note of ' + o.name + ' (' + n + ')', by: 'hand (Claude)', text: h0.note }); }
    return o;
  });
  // GW's words where Wahapedia's transcription differs (verify/sources/hand/<army>.json fixes: { at: '<detachment>/<rule|enhancement|stratagem>/<name>',
  // field, from, to, why }): each must match exactly once
  for (const fx of (HAND.fixes || []).filter(x => x.at.split('/')[0] === id)) {
    const [, kind, nm0] = fx.at.split('/'), row = kind === 'rule' ? det.rule : (kind === 'enhancement' ? det.enhancements : det.stratagems).find(x => lc(x.name) === lc(nm0));
    const v = row && row[fx.field];
    if (!v || v.split(fx.from).length !== 2) { want('detachment ' + n, 'hand file fix ' + fx.at + ' ' + fx.field, 'its words "' + fx.from + '" are not there exactly once'); continue; }
    row[fx.field] = v.replace(fx.from, fx.to); handDone.push({ what: 'GW’s words in ' + fx.at + ' ' + fx.field + ': "' + fx.to + '"', by: 'hand (Claude)', text: fx.why });
  }
  filled.push({ what: 'detachment ' + n + ': rule' + (det.moreRules ? 's ' : ' ') + [det.rule].concat(det.moreRules || []).map(r => r.name).join(', ') + ', ' + det.enhancements.length + ' enhancements, ' + det.stratagems.length + ' stratagems, ' + W.dp + 'DP', from: 'Wahapedia ' + factionId + '.txt (' + n + ' ' + W.dp + 'DP); dispositions from BSData' });
  facSrc.detachments[id] = det;
  return id;
});

// (a detachment data.js already has, from an earlier run: its dispositions from Wahapedia are declared again)
for (const id of detIds) {
  const det = F && F.detachments[id];
  if (!det || dispOf(det.name) || !(det.dispositions || []).length || dispDevs.some(x => x.detachment === det.name)) continue;
  const wd = wahaDispositions(det.name);
  if (JSON.stringify(wd) === JSON.stringify(det.dispositions)) dispDevs.push({ detachment: det.name, app: wd });
}
// ---------------------------------------------------------------- units
const enhAll = () => Object.values(Object.assign({}, F ? F.detachments : {}, facSrc.detachments)).flatMap(d => d.enhancements || []);
// (BSData names an UPGRADE enhancement with its kind: "Furious Assault (Upgrade)")
// (an enhancement New Recruit and BSData spell otherwise than GW, not by case alone: the hand file's spellings, { "<their name>":
// { gw: "<GW's name>", why } }: "Instinctive Defense" for GW's "Instinctive Defence")
const enhSpelt = n => { const h = (HAND.spellings || {})[nm(n).replace(/\s*\((?:Upgrade|Enhancement)\)$/i, '')]; return h ? h.gw : null; };
const enhOfName = n => { const b = nm(n).replace(/\s*\((?:Upgrade|Enhancement)\)$/i, ''), g = enhSpelt(n); return enhAll().find(e => [e.name, e.nr].filter(Boolean).some(x => lc(x) === lc(n) || lc(x) === lc(b) || (g && lc(x) === lc(g)))); };
const ROLES = ['Epic Hero', 'Character', 'Battleline', 'Dedicated Transport', 'Infantry', 'Mounted', 'Beast', 'Swarm', 'Vehicle', 'Monster', 'Fortification'];
const byId = new Map(rootsAll.map(s => [s.id, s]));
const leadsTo = new Map();
for (const s of rootsAll) for (const a of s.associations || []) if (a.type === 'outgoing' && a.action === 'group' && byId.has(a.to)) leadsTo.set(s, { body: byId.get(a.to), support: a.name === 'Supporting' });
const groups = [];
for (const s of rootsAll) if (!leadsTo.has(s)) groups.push({ chars: [], body: s, at: rootsAll.indexOf(s) });
for (const [s, l] of leadsTo) { const g = groups.find(x => x.body === l.body); if (g) g.chars.push({ s, support: l.support }); else want(nm(s.name), 'leader attachment', 'what it leads is not a unit of the list'); }
for (const g of groups) { g.chars.sort((a, b) => rootsAll.indexOf(a.s) - rootsAll.indexOf(b.s)); g.at = Math.min(g.at, ...g.chars.map(c => rootsAll.indexOf(c.s))); }
// a reference sheet the export has no entry for (verify/sources/hand/<army>.json refs: { entry, ref }): GW's datasheet of models a rule
// of the list adds (the Pink Horrors' Blue Horrors datasheet, "use the BLUE HORRORS datasheet for this unit"), built from the BSData root
// entry of that name as the export would carry it: one model of each model entry with its weapons, its profiles and rules (what
// GW's datasheet does not print is left out below, as for every unit)
const refSel = (e, n) => {
  // (what BSData hides unless a modifier shows it, a detachment's Penumbral Puppetry: left out, as New Recruit's export leaves it)
  // (and what a modifier hides or shows by a condition, the Shadow Legion's Penumbral Puppetry and Stealth: not the datasheet's own)
  const shown = l => !l.hidden && !(l.modifiers || []).concat(...(l.modifierGroups || []).map(g => g.modifiers || [])).some(m => m.field === 'hidden');
  const prof = x => (x.profiles || []).filter(shown).concat((x.infoLinks || []).filter(l => l.type === 'profile' && shown(l)).map(l => bsGet(l.targetId)).filter(p => p && shown(p)))
    .map(p => ({ id: p.id, name: p.name, typeName: p.typeName, typeId: p.typeId, characteristics: (p.characteristics || []).map(c => ({ name: c.name, typeId: c.typeId, $text: c.$text })) }));
  const rul = x => (x.rules || []).filter(shown).concat((x.infoLinks || []).filter(l => l.type === 'rule' && shown(l)).map(l => bsGet(l.targetId)).filter(r => r && shown(r))).map(r => ({ id: r.id, name: r.name, description: r.description }));
  const o = { id: 'ref:' + e.id, name: e.name, entryId: e.id, type: e.type, number: n, categories: (e.categoryLinks || []).map(c => ({ name: (bsGet(c.targetId) || {}).name || c.name, primary: !!c.primary, entryId: c.targetId })), profiles: prof(e), rules: rul(e), selections: [] };
  for (const m of (e.selectionEntries || []).filter(x => x.type === 'model')) { const ms = refSel(m, 1); ms.selections = (m.selectionEntries || []).filter(x => x.type === 'upgrade').map(x => refSel(x, 1)); o.selections.push(ms); }
  return o;
};
const refHands = (HAND.refs || []).filter(h => h.entry);
for (const h of refHands) {
  const e = [...BS.values()].find(o => (o.type === 'unit' || o.type === 'model') && o.name === h.entry && o.categoryLinks);
  if (!e) { want(h.entry, 'reference sheet', 'no BSData root entry of this name'); continue; }
  const sel = refSel(e, 1); hide(sel, { _refHand: h });
  groups.push({ chars: [], body: sel, at: 1e6 + refHands.indexOf(h) });
}

// the selections of a part, depth first: model selections, wargear, weapons, enhancement, Warlord
const dfs = (s, f, d = 0) => { f(s, d); for (const c of kidsOf(s)) dfs(c, f, d + 1); };
// the models of a part: a model-type root is its own model; else every model selection below it (not inside a model)
function modelsOf(part) {
  if (part.type === 'model') return [part];
  const out = []; const walk = s => { for (const c of kidsOf(s)) { if (c.type === 'model') out.push(c); else walk(c); } }; walk(part); return out;
}
const weaponProfiles = s => (s.profiles || []).filter(isWeaponProf);
// a weapon profile as New Recruit names it (NR.nrWeapon), read the way verify/bsdata.js reads BSData's: a "➤" profile with no
// "Group - profile" of its own is a profile of its selection ("Melta rifle": "➤ Melta Rifle", "➤ Melta Rifle HUNTER:Monster/Vehicle";
// "Gauntlets of Ultramar": "➤ Gauntlets of Ultramar (Overhead Smash)", whose bracket is part of its name); a profile named
// "… HUNTER:Monster/Vehicle" is the one used against MONSTER/VEHICLE units (hunter)
function weaponOf(prof, sel) {
  const w = NR.nrWeapon({ name: prof.name }, []);
  const own0 = bsGet(prof.id);
  if (own0 && w.parens.length) { const keep = w.parens.filter(x => nm(own0.name).includes('(' + x + ')')); if (keep.length) { w.name += keep.map(x => ' (' + x + ')').join(''); w.parens = w.parens.filter(x => !keep.includes(x)); } }
  if (!w.group && /^\s*➤/.test(prof.name) && sel && weaponProfiles(sel).length > 1) w.group = nm(sel.name);
  if (/\bHUNTER:\s*\S/i.test(w.name)) w.hunter = true;
  return w;
}
// one model's (or a model-type root's) gear: weapons (with how many each model carries) and other wargear (named on its line)
function gearOf(m, perModel) {
  const weapons = [], wargear = [];
  // (a selection's number is the total below its parent: four Prosecutors carry "4" Boltguns)
  const walk = s => {
    for (const c of kidsOf(s)) {
      if (c.type === 'model') continue;
      const n = Number(c.number) || 0;
      // (an enhancement that gives a weapon, Da Gobshot Thunderbuss, is the model's weapon: on its gear line)
      if (nm(c.name) === 'Warlord' || (isEnh(c) && !isWeaponSel(c))) continue;
      if (isWeaponSel(c)) {
        // a weapon with a ranged and a melee profile is one weapon; a "➤ Group - profile" set is its group
        const names = uniq(weaponProfiles(c).map(p => { const w = weaponOf(p, c); return w.group || w.name; }));
        for (const w of names) for (let k = 0; k < Math.round(n / perModel); k++) weapons.push(typo(w));
      } else if (kidsOf(c).some(isWeaponSel)) bundles.push(c);   // a bundle of weapons: its weapons, after the others
      else wargear.push(typo(nm(c.name)));
    }
  };
  const bundles = [];
  walk(m);
  const own = weapons.splice(0);
  for (const b of bundles) walk(b);
  // New Recruit names a weapon once with its count ("2x Combi-bolter"): the same weapon together, in first-seen order
  const grouped = xs => uniq(xs).flatMap(w => xs.filter(x => x === w));
  return { weapons: grouped(own).concat(grouped(weapons)), wargear };
}
// the datasheet's WARGEAR OPTIONS: "1 model can be equipped with 1 Vexilla" / "1 Tzaangor not equipped with a herd banner can be
// equipped with 1 brayhorn": who ('model' or the model's name) can take one of that wargear, else null
function oneModelCan(part, item) {
  const pg = WW.wahaPage(nm(part.name), pageFac(part.name)); if (!pg) return null;
  const t = nm(pg.P.s);
  const m = new RegExp('\\b1 ([A-Z][\\w’\' -]*?|model)(?: not equipped with [^.]*?)? can be equipped with 1 ' + nm(item).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').exec(t);
  return m ? (lc(m[1]) === 'model' ? 'model' : m[1]) : null;
}
// the models GW's UNIT COMPOSITION says carry a weapon no model of the list has yet ("Every Blue Horror added to this unit using the
// Split ability is equipped with: Coruscating Blue Flames; blue claws."): "Blue Horrors added by Split"
function carrierOf(part, weapon) {
  const pg = WW.wahaPage(nm(part.name), pageFac(part.name)); if (!pg) return null;
  const w = lc(nm(weapon).replace(/\s*\(ref\. only\)$/i, ''));
  for (const m of nm(pg.P.s).matchAll(/\bEvery ([A-Z][\w’' ]*?) added to this unit using the ([\w’' ]+?) ability is equipped with:\s*([^.]+)\./g))
    if (m[3].split(/\s*;\s*/).some(x => lc(x.trim()) === w)) return m[1].trim() + 's added by ' + m[2].trim();
  return null;
}
function buildGroup(g, k) {
  const parts = g.chars.map(c => c.s).concat([g.body]);
  const named = parts.length > 1;
  const partName = p => typo(nm(p.name));
  const where = parts.map(partName).join(' + ');
  parts.forEach(p => bsCheck(p, where));
  const first = parts[0];
  const u = { id: null, name: partName(first), role: ((first.categories || []).find(c => c.primary) || {}).name || null };
  const pts = parts.reduce((t, p) => t + costOf(p), 0);
  u.pts = pts;
  if (named) u.ptsNote = costOf(first) + g.chars.slice(1).map(c => ' + ' + partName(c.s) + ' ' + costOf(c.s)).join('') + ' + ' + partName(g.body) + ' ' + costOf(g.body);
  // enhancement (an UPGRADE is the bodyguard's), Warlord
  let enhancement = null, upgrade = null, warlord = false, enhOn = null, warlordOn = null;
  parts.forEach((p, i) => dfs(p, s => {
    if (isEnh(s)) { const e = enhOfName(nm(s.name)); const n = typo(e ? e.name : nm(s.name));
      // (New Recruit's and BSData's spelling where it differs from GW's: "Bane-forged weapons" for "Bane-Forged Weapons", nr)
      const spelt = typo(nm(s.name).replace(/\s*\((?:Upgrade|Enhancement)\)$/i, ''));
      if (e && spelt !== e.name && !e.nr && Object.values(facSrc.detachments).some(d => d.enhancements.includes(e))) { const o = Object.assign({ name: e.name, nr: spelt }, e); Object.keys(e).forEach(k => delete e[k]); Object.assign(e, o); filled.push({ what: 'nr ' + e.name + ': ' + spelt, from: 'the export’s selection name (New Recruit’s and BSData’s spelling)' }); } if (e && e.upgrade) upgrade = n; else { enhancement = n; if (i > 0 && i < parts.length - 1) enhOn = partName(p); } if (!e) want(where, 'enhancement ' + s.name, 'not an enhancement of the list’s detachments'); }
    if (nm(s.name) === 'Warlord' && s.type === 'upgrade') { warlord = true; if (i > 0 && i < parts.length - 1) warlordOn = partName(p); }
  }));
  if (enhancement) u.enhancement = enhancement;
  if (enhOn) u.enhOn = enhOn;
  if (upgrade) u.upgrade = upgrade;
  if (warlord) u.warlord = true;
  if (warlordOn) u.warlordOn = warlordOn;
  if (named) { u.leads = partName(g.body); if (g.chars[0].support) u.support = true; if (g.chars.length > 1) u.also = g.chars.slice(1).map(c => Object.assign({ name: partName(c.s) }, c.support ? { support: true } : {})); }
  // models lines and their gear; wargear on the unit itself (no model's) is `unplaced`
  const models = [], gear = [], unplaced = [];
  for (const p of parts) {
    const lines = [];   // this part's models lines: { n, name, wargear, weapons }
    for (const m of modelsOf(p)) {
      const n = m === p ? 1 : Number(m.number) || 1;
      const { weapons, wargear } = gearOf(m, n);
      lines.push({ n, name: typo(nm(m.name)), wargear, weapons });
    }
    if (p.type !== 'model') for (const c of kidsOf(p)) if (c.type !== 'model' && !isEnh(c) && nm(c.name) !== 'Warlord' && !kidsOf(c).some(x => x.type === 'model')) {
      if (isWeaponSel(c)) { for (const w of uniq(weaponProfiles(c).map(p2 => { const w = weaponOf(p2, c); return w.group || w.name; }))) unplaced.push(typo(w)); continue; }
      // wargear the datasheet gives one model ("1 model can be equipped with 1 Vexilla", WARGEAR OPTIONS): when exactly one
      // models line of such models has more of them, that one model is a line of its own with it, as New Recruit's PDF prints
      // it ("1× Allarus Custodian (Vexilla)"); else no models line can be said to carry it (unplaced)
      const k = Number(c.number) || 1, who = oneModelCan(p, nm(c.name));
      const can = who ? lines.filter(l => l.n > k && (who === 'model' || lc(l.name).startsWith(lc(who)))) : [];
      if (can.length === 1) { const l = can[0]; l.n -= k; l.splits = (l.splits || 0) + 1; lines.splice(lines.indexOf(l) + l.splits, 0, { n: k, name: l.name, wargear: l.wargear.concat(typo(nm(c.name))), weapons: l.weapons.slice() }); }
      else unplaced.push(typo(nm(c.name)));
    }
    for (const l of lines) { models.push(l.n + '× ' + l.name + (l.wargear.length ? ' (' + l.wargear.join(', ') + ')' : '')); gear.push(l.weapons); }
  }
  // stat rows: one per profile, with how many models carry it
  const stats = [];
  for (const p of parts) {
    const rows = [];
    const add = (prof, n) => {
      const s = NR.nrStatName(prof.name, []), ch = Object.fromEntries(prof.characteristics.map(c => [c.name, c.$text || '']));
      // (BSData's "Blue/Brimstone Horror (ref. only)": a profile GW's datasheet prints for models a rule adds later (the Pink Horrors'
      // Split), named as New Recruit names it)
      if (s.parens.includes('ref. only')) s.name += ' (ref. only)';
      const row = { name: typo(s.name), M: cellV(ch.M), T: cellV(ch.T), Sv: cellV(ch.Sv), W: cellV(ch.W), Ld: cellV(ch.LD), OC: cellV(ch.OC), InSv: cellV(ch.InSv), base: cellV(ch.Base).replace(/(\d)x(\d)/g, '$1×$2') };
      const same = rows.find(r => JSON.stringify(Object.assign({}, r.row, { name: 0 })) === JSON.stringify(Object.assign({}, row, { name: 0 })) && r.row.name === row.name);
      if (same) same.n += n; else rows.push({ row, n, pid: prof.id });
    };
    // (a profile on the unit itself is every model's that has none of its own, as verify/bsdata.js counts)
    const own = s => (s.profiles || []).some(x => x.typeName === 'Unit');
    dfs(p, s => { for (const prof of s.profiles || []) if (prof.typeName === 'Unit') add(prof, s.type === 'unit' ? modelsOf(s).filter(m => !own(m)).reduce((t, m) => t + (Number(m.number) || 1), 0) || 1 : s.type === 'model' && s !== p ? Number(s.number) || 1 : 1); });
    for (const r of rows) stats.push(hide(Object.assign({}, r.row, { name: r.row.name + (r.n > 1 ? ' ×' + r.n : '') }), { _pid: r.pid, _part: p, _base: r.row.name }));
  }
  // weapon rows: every profile, depth first, with the number of models carrying it
  const kinds = { ranged: [], melee: [] };
  for (const p of parts) {
    const seen = new Map();
    const walk = s => {
      for (const c of kidsOf(s)) {
        const n = Number(c.number) || 0;
        if (c.type === 'model') { walk(c); continue; }
        for (const prof of weaponProfiles(c)) {
          const kind = weaponKind(prof);
          const w = weaponOf(prof, c), ch = Object.fromEntries(prof.characteristics.map(x => [x.name, x.$text || '']));
          const o = {};
          if (w.group) o.group = typo(w.group); else o.name = typo(w.name);
          // New Recruit marks the profiles you pick one of with "➤"; a ranged group without it fires every profile (verify/choice.js)
          if (kind === 'ranged' && w.group && !/^\s*➤/.test(prof.name)) o.fireAll = true;
          if (named) o.who = partName(p);
          if (w.group) o.name = typo(w.name);
          if (w.hunter) o.hunter = true;
          o.range = cellV(ch.Range); o.A = cellV(ch.A); o[kind === 'ranged' ? 'BS' : 'WS'] = cellV(ch.BS || ch.WS); o.S = cellV(ch.S); o.AP = cellV(ch.AP); o.D = cellV(ch.D);
          // (each weapon ability once, as GW's datasheet prints it: New Recruit repeats one a rule of the list gives a weapon that has it
          // already, Hunter’s Eye's IGNORES COVER on the heavy flamer: "Ignores Cover, Torrent, Ignores Cover")
          o.kw = uniq(splitItems(ch.Keywords || '').map(nm).filter(Boolean).map(x => x.replace(/^[^:]+/, y => y.toUpperCase())));
          if (isEnh(c)) o.enh = true;
          const key = kind + '|' + JSON.stringify(o);
          if (seen.has(key)) seen.get(key).n += n; else { const r = { kind, o, n, pid: prof.id }; seen.set(key, r); }
        }
        walk(c);
      }
    };
    // (the weapon profiles of the unit itself, carried by no model yet: BSData's "Coruscating Blue flames (ref. only)", the weapons GW's
    // Pink Horrors datasheet gives the Blue and Brimstone Horrors its Split adds; as New Recruit names them, one each)
    // (only those: no model carries them, and GW's UNIT COMPOSITION names the models that will, "Every Blue Horror added to this unit
    // using the Split ability is equipped with: Coruscating Blue Flames; blue claws." (carrier), so they are on no models line)
    const refOnly = p.type === 'unit' ? weaponProfiles(p).filter(x => /\(ref\. only\)/i.test(x.name)) : [];
    if (refOnly.length) walk({ selections: [Object.assign({}, p, { selections: [], number: 1, profiles: refOnly })] });
    walk(p);
    for (const r of seen.values()) {
      const o = Object.assign({}, r.o);
      // data.js order: group, who, n, name, hunter, values (a profile); name, who, n, values (a weapon)
      if (/\(ref\. only\)/i.test(o.name || o.group || '')) { const c = carrierOf(p, o.group || o.name); if (c) o.carrier = c; else want(nm(p.name) + ' · ' + (o.group || o.name), 'carrier', 'a "(ref. only)" weapon no UNIT COMPOSITION sentence of GW’s datasheet gives to models'); }
      const ord = o.group ? ['group', 'fireAll', 'who', 'carrier', 'n', 'name', 'hunter', 'enh'] : ['name', 'who', 'carrier', 'n', 'hunter', 'enh'];
      const row = {}; if (r.n > 1) o.n = r.n;
      for (const k of ord) if (o[k] !== undefined) row[k] = o[k];
      for (const k of ['range', 'A', 'BS', 'WS', 'S', 'AP', 'D', 'kw']) if (o[k] !== undefined) row[k] = o[k];
      kinds[r.kind].push(hide(row, { _pid: r.pid, _part: p })); }
  }
  // abilities: every Abilities profile (and other ability tables, by their type), depth first; the enhancement's from data.js
  const abilities = [];
  for (const p of parts) {
    const tables = new Map();
    dfs(p, s => { for (const prof of s.profiles || []) if (prof.typeName !== 'Unit' && !isWeaponProf(prof)) { if (!tables.has(prof.typeName)) tables.set(prof.typeName, []); tables.get(prof.typeName).push({ prof, sel: s }); } });
    const ordered = [...(tables.get('Abilities') || []).map(x => ['Abilities', x]), ...[...tables].filter(([t]) => t !== 'Abilities').flatMap(([t, xs]) => xs.map(x => [t, x]))];
    const seenAb = new Set();
    for (const [table, { prof, sel }] of ordered) {
      // BSData's Leader / Support ability (which units it attaches to) is the app's rule of that name, as on New Recruit's sheet
      if (table === 'Abilities' && /^(Leader|Support)$/.test(nm(prof.name))) continue;
      const k0 = prof.name + '\n' + prof.characteristics.map(c => c.$text || '').join('\n');
      if (seenAb.has(k0)) continue; seenAb.add(k0);
      const a = NR.nrAbility(prof.name, []), o = {};
      const e = isEnh(sel) ? enhOfName(nm(sel.name)) : null;
      o.name = typo(e ? e.name : (a.paren !== null && /\d\+\*?$/.test(a.paren) ? a.full : a.base));
      if (table !== 'Abilities') o.who = typo(table);
      else if (named) o.who = partName(p);
      if (e) o.tag = (e.upgrade ? 'Upgrade' : 'Enhancement') + (/\(Aura\)$/.test(e.name) ? ' · Aura' : '');   // GW's "(Aura)" in its name
      else if (a.paren !== null && o.name === typo(a.base)) o.tag = a.paren;
      // (BSData's Transport profile, named after the unit, is GW's TRANSPORT box: the ability Transport, its characteristic's name
      // the tag, as New Recruit prints "Transport Capacity" and the World Eaters' Chaos Rhino has it)
      if (table === 'Transport') { o.name = 'Transport'; delete o.who; o.tag = typo(nm(prof.characteristics[0].name)); }
      o._bs = prof.characteristics.map(c => c.$text || '').join('\n');
      o._e = e; o._part = p; hide(o, { _sel: sel });
      abilities.push(o);
    }
    // an enhancement BSData gives no ability profile, only the weapon it gives (Da Gobshot Thunderbuss: “This model has the following
    // weapon”): its ability all the same, the detachment's words (shown as every enhancement is; its weapon is on the weapon rows)
    dfs(p, s => { const e = isEnh(s) ? enhOfName(nm(s.name)) : null;
      if (e && !abilities.some(a => a._e === e)) { const o = { name: typo(e.name) }; if (named) o.who = partName(p); o.tag = (e.upgrade ? 'Upgrade' : 'Enhancement') + (/\(Aura\)$/.test(e.name) ? ' · Aura' : ''); o._bs = null; o._e = e; o._part = p; hide(o, { _sel: s }); abilities.push(o); } });
  }
  // the Rules line and the keywords
  const rules = [];
  // (in the app's apostrophes, as the army rules are named: Martial Ka’tah)
  parts.forEach(p => dfs(p, s => { for (const r of s.rules || []) rules.push(typo(nm(r.name))); }));
  // (a category BSData hides, such as Leader, is no keyword: New Recruit does not print it)
  const catsOf = p => { const c = []; dfs(p, s => { if (!isWeaponSel(s)) for (const x of s.categories || []) { const ce = BS.get(x.entryId); if (!(ce && ce.hidden)) c.push(nm(x.name)); } }); return uniq(c).sort(); };
  const own = catsOf(first), extra = [];
  for (const p of parts.slice(1)) for (const c of catsOf(p)) if (!own.includes(c) && !extra.includes(c)) extra.push(c);
  Object.assign(u, { models, gear });
  if (unplaced.length) u.unplaced = unplaced;
  Object.assign(u, { stats, ranged: kinds.ranged, melee: kinds.melee, abilities, rules: uniq(rules), kw: own.concat(extra) });
  if (extra.length) u.kwNote = extra.join(', ') + (extra.length > 1 ? ' come' : ' comes') + ' from the ' + (g.chars.length > 1 ? 'combined unit' : (g.chars[0].support ? 'supported ' : 'led ') + partName(g.body)) + '.';
  u._at = g.at; u._parts = parts; hide(u, { _partNames: parts.map(p => nm(p.name)), _exportKw: u.kw.slice() });
  // the rules of the datasheet itself (the unit and its models), not those its wargear, weapons or enhancement bring
  const dsRules = []; parts.forEach(p => dfs(p, s => { if (s.type === 'unit' || s.type === 'model') for (const r of s.rules || []) dsRules.push(typo(nm(r.name))); }));
  u._dsRules = uniq(dsRules);
  u._exportRules = uniq(rules);   // (as the export has them, before the comparison with GW's datasheet)
  return u;
}
let units = groups.map(buildGroup);
// identical units are one, with copies
{
  const sig = u => JSON.stringify(Object.assign({}, u, { _at: 0, _parts: 0, _dsRules: 0, _exportRules: 0, copies: 0, abilities: u.abilities.map(a => Object.assign({}, a, { _e: 0, _part: 0 })) }));
  const out = [];
  for (const u of units) { const twin = out.find(x => sig(x) === sig(u)); if (twin) twin.copies = (twin.copies || 1) + 1; else out.push(u); }
  units = out;
  for (const u of units) if (u.copies) { const c = u.copies; delete u.copies; const o = {}; for (const [k, v] of Object.entries(u)) { o[k] = v; if (k === 'pts') o.copies = c; } Object.keys(u).forEach(k => delete u[k]); Object.assign(u, o); }
}
// a reference entry (category Reference) and a reference sheet of the hand file: the role New Recruit lists it under, Reference;
// New Recruit's "Reference" category is no keyword of GW's (declared); listed last, as New Recruit lists it
for (const u of units) if (isRefSel(u._parts[0]) || u._parts[0]._refHand) {
  hide(u, { _ref: true }); if (u._parts[0]._refHand) hide(u, { _refHand: u._parts[0]._refHand });
  u.role = 'Reference';
  u.kw = u.kw.filter(k => k !== 'Reference');
}
units.sort((a, b) => (a._ref ? 1 : 0) - (b._ref ? 1 : 0) || (ROLES.indexOf(a.role) + 1 || 99) - (ROLES.indexOf(b.role) + 1 || 99) || ((a.leads ? 1 : 0) - (b.leads ? 1 : 0)) || (a._at - b._at));
for (const u of units) {
  let id = [u.name].concat((u.also || []).map(c => c.name), u.leads ? [u.leads] : []).map(slug).join('-');
  if (units.some(x => x !== u && slug(x.name) === slug(u.name) && (x.leads || null) === (u.leads || null))) id += u.enhancement ? '-' + slug(u.enhancement) : '';
  let k = 2; const base = id; while (units.some(x => x.id === id)) id = base + '-' + k++;
  u.id = id;
}

// (the export's reading, before GW's documents change anything: --compare tells the two apart)
const readOf = new Map(units.map(u => [u, JSON.parse(JSON.stringify(u, (k, v) => k === '_parts' ? undefined : v))]));
// ---------------------------------------------------------------- GW over BSData: the datasheet's facts against Wahapedia's
// (which transcribes the codex). Every stat, weapon value and keyword of BSData's entry (its own values, before a rule of the
// list changes them) is compared with the datasheet; where they differ GW's value is the app's, when New Recruit shows
// BSData's own value (else it is listed to do by hand), and the difference is a deviation to declare.
const wahaHtml = new Map();
const wahaDs = name => {
  const dir = path.join(ROOT, 'verify/.cache/waha/ds'), f = pageFac(name) + '_' + WW.wahaAddress(name) + '.html';
  if (!wahaHtml.has(f)) { const hit = fs.existsSync(dir) && fs.readdirSync(dir).find(x => x.toLowerCase() === f.toLowerCase()); wahaHtml.set(f, hit ? { file: hit, ds: require('./waha-words').wahaDatasheet(fs.readFileSync(path.join(dir, hit), 'utf8'), WW.chapter) } : null); }
  return wahaHtml.get(f);
};
const gwN = v => nm(String(v == null ? '' : v)).replace(/\s*x\s*/gi, '×').replace(/^(?:-|–|N\/A)?$/, '–').replace(/- (?=[A-Z])/g, '-').toLowerCase();
const gwKw = k => nm(k).toUpperCase().replace(/- (?=[A-Z])/g, '-');
const gwDevs = [];    // { unit, kind, row, field, app, bsdata, gw, file }
const gwFixed = [];
const gwNames = [];   // a weapon BSData names otherwise than GW's datasheet (the app keeps BSData's name: New Recruit's)   // BSData's entry differs from GW, but New Recruit's export already has GW's value
const gwFacts = new Map();   // unit|kind|row|field -> { gw, pin, nr, file }: every value where BSData's entry and GW's datasheet differ
const bsChars = pid => { const b = BS.get(pid); return b ? Object.fromEntries((b.characteristics || []).map(c => [c.name, c.$text || ''])) : null; };
for (const u of units) {
  for (const p of u._parts) {
    const W = wahaDs(nm(p.name));
    if (!W || !W.ds) { want(u.name, 'GW check of ' + nm(p.name), 'no cached Wahapedia datasheet'); continue; }
    const ds = W.ds, where = 'verify/.cache/waha/ds/' + W.file;
    // stat rows
    for (const row of u.stats.filter(r => r._part === p)) {
      // by its name; else, when every profile of the datasheet has the same values, any (BSData's "Heavy intercessor Squad" for
      // GW's Heavy Intercessor Sergeant and Heavy Intercessor); Wahapedia's "rn" read as "m" ("Dainal Komelius") is the same name
      const pn = x => lc(x).replace(/rn/g, 'm');
      const STATK = ['M', 'T', 'SV', 'W', 'LD', 'OC', 'INSV'], same = ds.profiles.every(x => STATK.every(k => x[k] === ds.profiles[0][k]));
      // (and BSData's "Blue/Brimstone Horror (ref. only)" for GW's "BLUE HORROR/BRIMSTONE HORROR")
      const pair = x => lc(x).replace(/\s*\(ref\. only\)$/, '').replace(/^([a-z]+)\/([a-z]+) ([a-z]+)$/, '$1 $3/$2 $3');
      // (a profile BSData names otherwise than GW, the hand file's profileNames: { "<BSData's>": "<GW's>" }, "Ravener" for GW's "Raveners")
      const gwP = (HAND.profileNames || {})[row._base];
      const wp = (gwP && ds.profiles.find(x => x.name && lc(x.name) === lc(gwP))) || ds.profiles.find(x => x.name && lc(x.name) === lc(row._base)) || ds.profiles.find(x => x.name && pn(x.name) === pn(row._base)) || ds.profiles.find(x => x.name && pair(x.name) === pair(row._base)) || (ds.profiles.length === 1 || (ds.profiles.length && same) ? ds.profiles[0] : null);
      const bc = bsChars(row._pid);
      if (!wp || !bc) { want(u.name + ' · ' + row.name, 'GW check of the stat row', wp ? 'no BSData profile' : 'no Wahapedia profile of this name'); continue; }
      const MAP = { M: ['M', 'M'], T: ['T', 'T'], Sv: ['SV', 'Sv'], W: ['W', 'W'], Ld: ['LD', 'LD'], OC: ['OC', 'OC'], InSv: ['INSV', 'InSv'] };
      for (const [k, [wk, bk]] of Object.entries(MAP)) {
        const gw = wp[wk] === undefined ? '–' : wp[wk], bs = bc[bk];
        // a value a rule of the list changed (New Recruit's 4 W from the Storm Shield): the datasheet's own value goes with it (own),
        // for the DATASHEETS row when no list shows it unchanged (verify/tables.js)
        if (gwN(gw) === gwN(bs)) { if (gwN(row[k]) !== gwN(gw)) row.own = Object.assign(row.own || {}, { [k]: cellV(gw) }); continue; }
        gwFacts.set(u.id + '|stats|' + nm(row._base) + '|' + k, { gw: cellV(gw), pin: cellV(bs), nr: row[k], file: where });
        if (gwN(row[k]) === gwN(gw)) { gwFixed.push(u.name + ' · ' + row.name + ' ' + k + ': BSData’s entry at the pin has ' + bs + ', the export (a newer catalogue, or a modifier) GW’s ' + gw); continue; }
        if (gwN(row[k]) === gwN(bs)) { gwDevs.push({ unit: u.id, kind: 'stats', row: row.name, field: k, app: cellV(gw), bsdata: cellV(bs), file: where }); row[k] = cellV(gw); }
        else want(u.name + ' · ' + row.name + ' ' + k, 'GW value ' + gw, 'BSData’s own value is ' + bs + ', New Recruit shows ' + row[k] + ' (a rule of the list changed it): set by hand');
      }
      // the base size: New Recruit's (BSData has none) against the datasheet's
      // the base size: GW's base size guide (verify/base-guide.js, the Event Companion), else the Wahapedia datasheet's
      // (a model verify/deviations-bases.json declares: its declared row or base, as the gate's bases step checks it; an allied unit: its
      // own faction's section of the guide)
      const ally = allyByName.get(nm(p.name));
      const BG = baseGuide.declared(factionId + '/' + slug(nm(p.name)), nm(row._base)) || baseGuide.lookup(ally ? (FJ[ALLIES[ally]] || {}).baseGuide || ally : (FJ[factionId] || {}).baseGuide || facName, [nm(p.name), row._base], nm(p.name));
      const wb = wp.base || ds.base;
      // (Wahapedia's "⌀75 x 42mm" is an oval base: "75×42mm Oval", as GW's guide writes one)
      const gb = BG ? BG.base : wb ? wb.replace(/\s*x\s*/g, '×').replace(/^(\d+(?:\.\d+)?×\d+(?:\.\d+)?mm)$/, '$1 Oval') : null;
      const bWhere = BG && BG.declaredIn ? BG.declaredIn + (BG.line ? '; ' + BG.file + ' line ' + BG.line + ': "' + BG.entry + '  ' + (BG.how === 'declared' ? BG.printed : '…') + '"' : '') : BG ? BG.file + ' line ' + BG.line + ': "' + BG.entry + '  ' + BG.printed + '"' : where + ': "(⌀' + wb + ')"';
      if (!BG) want(u.name + ' · ' + row.name, 'base size', 'not in GW’s base size guide' + (wb ? ': Wahapedia’s datasheet used' : ''));
      if (gb && gwN(gb) !== gwN(row.base)) {
        gwFacts.set(u.id + '|stats|' + nm(row._base) + '|base', { gw: gb, pin: null, nr: row.base, file: bWhere, src: BG && BG.declaredIn ? 'verify/deviations-bases.json (' + BG.how + ')' : BG ? 'GW’s base size guide (Event Companion)' : 'Wahapedia’s datasheet' });
        gwDevs.push({ unit: u.id, kind: 'base', row: row.name, field: 'base', app: gb, bsdata: row.base, file: bWhere });
        row.base = gb;
      }
    }
    // weapon rows
    for (const kind of ['ranged', 'melee']) for (const row of u[kind].filter(r => r._part === p)) {
      // (Wahapedia's "Slaughter and Carnage – strike": its en dash is the " - " of a profile's name)
      const nameOf = x => lc(x).replace(/’/g, "'").replace(/\s[–—]\s/g, ' - ');
      const wn = row.group ? [row.group + ' - ' + row.name, row.name, row.group] : [row.name];
      // (a weapon BSData names otherwise than GW's datasheet by more than spelling rules can tell, the hand file's weaponNames:
      // { "<BSData's name>": "<GW's name>" }, BSData's "Tarsis buckler" for GW's "Tarsus Buckler": found by GW's name, listed below as
      // named otherwise; the app keeps BSData's name, New Recruit's)
      const wn0 = wn.slice(); for (const n of wn0) if ((HAND.weaponNames || {})[n]) wn.push(HAND.weaponNames[n]);
      // (BSData's spellings of GW's names: "The Emperor's Sword", "Force weapon [Psychic]", "Melta Rifle HUNTER:Monster/Vehicle" for
      // "Melta Rifle - Hunter", "Chainfist - Hunter: Monster/Vehicle" for "Chainfist - Hunter")
      const gwName = x => nameOf(x).replace(/\s*\(ref\. only\)$/, '').replace(/^the /, '').replace(/\s*\[[^\]]*\]$/, '').replace(/ - hunter: .*$/, ' - hunter').replace(/\s+hunter:\s*\S.*$/, ' - hunter').replace(/\s+\(([^()]+)\)$/, ' - $1');
      const sameKind = x => (x.range === 'Melee') === (kind === 'melee');
      let ww = null;
      // (and a name whose apostrophe GW puts elsewhere: New Recruit's "Attendant's hellblades", GW's "Attendants’ hellblades")
      const noApos = x => gwName(x).replace(/'/g, '');
      // (and GW's plural name for a pair, the Maulerfiend's "Magma cutters" for New Recruit's "Magma cutter" ×2: listed below as named
      // otherwise)
      for (const n of wn) { ww = ds.weapons.find(x => sameKind(x) && nameOf(n) === nameOf(x.name)) || ds.weapons.find(x => sameKind(x) && gwName(n) === gwName(x.name)) || ds.weapons.find(x => sameKind(x) && noApos(n) === noApos(x.name)); if (ww) break; }
      // (GW's one profile for the pair is one weapon row: its A is the pair's, so the app counts it once, n 1, declared; the gear keeps
      // New Recruit's two)
      // (only when one model carries both: two models with one each, 2 Meganobz with twin killsaws, are two weapons)
      const gl = u.gear.map((g, i) => i).filter(i => u.gear[i].includes(row.name));
      const onOne = gl.length === 1 && u.gear[gl[0]].filter(x => x === row.name).length === 2 && /^1× /.test(u.models[gl[0]]);
      if (!ww && row.n === 2 && !row.group && onOne) {
        ww = ds.weapons.find(x => sameKind(x) && gwName(x.name) === gwName(wn[0]) + 's') || null;
        if (ww) { gwFacts.set(u.id + '|' + kind + '|' + nm(row.name) + '|n', { gw: '1', pin: '2', nr: '2', file: where, src: 'GW’s datasheet (one profile, ' + ww.name + ', for the pair)' }); gwDevs.push({ unit: u.id, kind, row: row.name, field: 'n', app: '1', bsdata: '2', file: where }); delete row.n; }
      }
      // (GW's plural name for N of one weapon that GW's composition counts on the model, the Tesseract Vault's "4 tesla spheres" with
      // the profile "Tesla spheres": N weapons, as New Recruit has them; only the name is GW's, listed below as named otherwise)
      if (!ww && row.n > 2 && !row.group && gl.length === 1 && u.gear[gl[0]].filter(x => x === row.name).length === row.n && /^1× /.test(u.models[gl[0]])) {
        const pg = WW.wahaPage(nm(p.name), pageFac(p.name)), pl = ds.weapons.find(x => sameKind(x) && gwName(x.name) === gwName(wn[0]) + 's');
        if (pg && pl && new RegExp('\\bequipped with:[^.]*\\b' + row.n + ' ' + lc(pl.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(nm(pg.P.s))) ww = pl;
      }
      // (GW's plural name for one weapon each model carries, the Meganobz' "Twin Killsaws" ("replaced with 1 Twin Killsaws") for New
      // Recruit's "Twin Killsaw", one on each model: the same weapon, New Recruit's name kept, listed below as named otherwise)
      if (!ww && !row.group && gl.length && gl.every(i => u.gear[i].filter(x => x === row.name).length === 1)) {
        const pg = WW.wahaPage(nm(p.name), pageFac(p.name)), pl = ds.weapons.find(x => sameKind(x) && gwName(x.name) === gwName(wn[0]) + 's');
        if (pg && pl && new RegExp('\\b1 ' + lc(pl.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(nm(pg.P.s))) ww = pl;
      }
      // (a weapon an enhancement gives, Da Gobshot Thunderbuss: GW's profile is the enhancement's, its weapon line as the detachment
      // prints it (Wahapedia's faction page), "Da Gobshot Thunderbuss: 24" A6 BS4+ S7 AP-2 D2 [LETHAL HITS: …, RAPID FIRE 6]")
      if (!ww && row.enh) for (const id of detIds) for (const e of (((F && F.detachments[id]) || facSrc.detachments[id] || {}).enhancements || [])) {
        const m = String(e.text || '').split('\n').map(l => /^(.+?): (\S+) A(\S+) (BS|WS)(\S+) S(\S+) AP(\S+) D(\S+) \[(.*)\]$/.exec(bare(l))).find(x => x && nameOf(x[1]) === nameOf(row.name));
        if (m && !ww) ww = { name: m[1], range: m[2], A: m[3], BS: m[5], WS: m[5], S: m[6], AP: m[7], D: m[8], kw: m[9] ? m[9].split(/,\s*/) : [] };
      }
      if (ww && row.hunter && / - hunter$/i.test(ww.name)) gwFacts.set(u.id + '|' + kind + '|' + nm(row.name) + '|hunter', { gw: 'true', pin: 'no Hunter profile', nr: row.name, file: where, src: 'GW’s datasheet names it ' + ww.name + ' (its Hunter profile, used against MONSTER/VEHICLE units)' });
      if (ww && nameOf(ww.name) !== nameOf(wn0[0]) && !wn0.slice(1).some(n => nameOf(n) === nameOf(ww.name))) gwNames.push({ unit: u.id, kind, app: row.group ? row.group + ' - ' + row.name : row.name, gw: ww.name, file: where });
      const bc = bsChars(row._pid);
      if (!ww || !bc) { want(u.name + ' · ' + (row.group || row.name), 'GW check of the weapon', ww ? 'no BSData profile' : 'not on the Wahapedia datasheet under this name'); continue; }
      const F2 = { range: ['range', 'Range'], A: ['A', 'A'], [kind === 'ranged' ? 'BS' : 'WS']: ['BS', kind === 'ranged' ? 'BS' : 'WS'], S: ['S', 'S'], AP: ['AP', 'AP'], D: ['D', 'D'] };
      for (const [k, [wk, bk]] of Object.entries(F2)) {
        // (a value a rule of the list changed, the Daemon Prince of Chaos's S 10 from Daemonic Allegiance: the datasheet's own value goes
        // with it, as for a stat)
        if (gwN(ww[wk]) === gwN(bc[bk])) { if (gwN(row[k]) !== gwN(ww[wk])) row.own = Object.assign(row.own || {}, { [k]: cellV(ww[wk]) }); continue; }
        gwFacts.set(u.id + '|' + kind + '|' + nm(row.group || row.name) + '|' + k, { gw: cellV(ww[wk]), pin: cellV(bc[bk]), nr: row[k], file: where });
        if (gwN(row[k]) === gwN(ww[wk])) { gwFixed.push(u.name + ' · ' + (row.group || row.name) + ' ' + k + ': BSData’s entry at the pin has ' + bc[bk] + ', the export (a newer catalogue, or a modifier) GW’s ' + ww[wk]); continue; }
        if (gwN(row[k]) === gwN(bc[bk])) { gwDevs.push({ unit: u.id, kind, row: row.group || row.name, field: k, app: cellV(ww[wk]), bsdata: cellV(bc[bk]), file: where }); row[k] = cellV(ww[wk]); }
        else want(u.name + ' · ' + (row.group || row.name) + ' ' + k, 'GW value ' + ww[wk], 'BSData’s own value is ' + bc[bk] + ', New Recruit shows ' + row[k] + ': set by hand');
      }
      const gk = ww.kw.map(gwKw).sort(), bk2 = splitItems(bc.Keywords || '').map(gwKw).filter(Boolean).sort();
      // GW's weapon keywords where New Recruit shows BSData's own (and those a rule of the list adds, kept: Furious Assault's
      // [SUSTAINED HITS 1: …]): the Wardens' Master-crafted Power Weapon is [PRECISION]
      const appKw = (row.kw || []).map(gwKw), added = appKw.filter(k => !bk2.includes(k));
      if (JSON.stringify(gk) !== JSON.stringify(bk2) && JSON.stringify(appKw.filter(k => !added.includes(k)).sort()) === JSON.stringify(bk2) && !added.some(k => gk.includes(k))) {
        const kwApp = k => k.replace(/^[^:]+/, y => y.toUpperCase());
        const nk = ww.kw.map(nm).map(kwApp).concat((row.kw || []).filter(k => added.includes(gwKw(k))));
        gwFacts.set(u.id + '|' + kind + '|' + nm(row.group || row.name) + '|kw', { gw: ww.kw.map(kwApp).join(', ') || '–', app: nk.join(', '), pin: bc.Keywords || '–', nr: (row.kw || []).join(', '), file: where });
        gwDevs.push({ unit: u.id, kind, row: row.group || row.name, field: 'kw', app: nk.join(', '), bsdata: (row.kw || []).join(', ') || '–', file: where });
        row.kw = nk;
      } else if (JSON.stringify(gk) !== JSON.stringify(bk2)) want(u.name + ' · ' + (row.group || row.name), 'weapon keywords', 'Wahapedia ' + JSON.stringify(gk) + ', BSData ' + JSON.stringify(bk2) + ': compare by hand');
    }
  }
  // keywords: every keyword the datasheets print (KEYWORDS and FACTION KEYWORDS) is the unit's
  const printed = uniq(u._parts.flatMap(p => { const W = wahaDs(nm(p.name)); return W && W.ds ? W.ds.keywords.concat(W.ds.factionKeywords.map(k => 'Faction: ' + k)) : []; }));
  // a keyword only some models of the unit have (Wahapedia "Dainal Komelius: PSYKER"): kwOnly names the model (BSData's spelling,
  // the stats row of that name), and the kwNote leaves it out
  for (const p of u._parts) {
    const W = wahaDs(nm(p.name)); if (!W || !W.ds) continue;
    for (const [mn0, ks] of Object.entries(W.ds.modelKeywords || {})) for (const k0 of ks) {
      // (GW's "SZAREKH MODEL: CHARACTER": the model Szarekh)
      let mn = mn0.replace(/\s+model$/i, '');
      // (Wahapedia's last one can run into the detachment keyword after it: "BRIMSTONE HORRORS: BRIMSTONE: SHADOW LEGION")
      const k = k0.replace(/\s*:\s*$/, '').trim(); if (!k) continue;
      if (W.ds.keywords.some(x => gwKw(x) === gwKw(k))) continue;
      let have = u.kw.find(x => gwKw(x) === gwKw(k));
      // a keyword GW prints for some models that the export lacks (the Pink Horrors' BRIMSTONE, for the Brimstone Horrors Split adds):
      // GW's, added and declared, as for a keyword of all models
      if (!have) { have = k.toLowerCase().replace(/(^|[\s-])([a-z])/g, (m0, a, b) => a + b.toUpperCase()); u.kw.push(have); u.kw.sort();
        gwDevs.push({ unit: u.id, kind: 'kw', field: 'kw', app: have, bsdata: null, file: W.file }); }
      // (GW's plural, "PINK HORRORS: PINK", is the row of one such model, "Pink Horror"; no row: GW's name of the models, in title case)
      const pn = x => lc(x).replace(/rn/g, 'm'), row = u.stats.find(r => pn(r.name.replace(/ ×\d+$/, '')) === pn(mn)) || u.stats.find(r => pn(r.name.replace(/ ×\d+$/, '')) + 's' === pn(mn));
      if (!row) mn = mn.toLowerCase().replace(/(^|[\s/-])([a-z])/g, (m0, a, b) => a + b.toUpperCase());
      // (and every other part of the attached unit whose datasheet gives all its models the keyword: the Master of Executions'
      // CHARACTER next to the Dark Apostle's, "Dark Apostle and Master of Executions", as Wahapedia names each model that has it)
      const also = u._parts.filter(p2 => p2 !== p).filter(p2 => { const W2 = wahaDs(nm(p2.name)); return W2 && W2.ds && W2.ds.keywords.some(x => gwKw(x) === gwKw(k)); }).map(p2 => typo(nm(p2.name)));
      u.kwOnly = Object.assign(u.kwOnly || {}, { [have]: [row ? row.name.replace(/ ×\d+$/, '') : mn].concat(also).join(' and ') });
      if (u.kwNote) { const ex = u.kwNote.replace(/ comes? from .*$/, '').split(', ').filter(x => x !== have), tail = (/ from .*$/.exec(u.kwNote) || [' from the led ' + u.leads + '.'])[0]; u.kwNote = ex.length ? ex.join(', ') + (ex.length > 1 ? ' come' : ' comes') + tail : undefined; if (!u.kwNote) delete u.kwNote; }
      filled.push({ what: 'kwOnly ' + u.name + ': ' + have + ' (' + u.kwOnly[have] + ')', from: 'verify/.cache/waha/ds/' + W.file + ' ("' + mn + ': ' + k + '")' });
    }
  }
  // a keyword the export has that GW's datasheet gives only in a detachment the list does not take (BSData's SHADOW LEGION on
  // Chaos Daemons units, which the Shadow Legion detachment gives; Wahapedia shows it only with that detachment picked): GW wins
  for (const p of u._parts) {
    const W = wahaDs(nm(p.name)); if (!W || !W.ds) continue;
    for (const [k, det] of Object.entries(W.ds.detachmentKeywords || {})) {
      // (in --emit, a faction catalogue's reading of the datasheet alone: a detachment's keyword is never the datasheet's, though the
      // catalogue's export takes every detachment)
      if (printed.some(x => gwKw(x) === gwKw(k)) || (detNames.some(n => lc(n) === lc(det)) && !argv.includes('--emit'))) continue;
      const have = u.kw.find(x => gwKw(x) === gwKw(k)); if (!have) continue;
      u.kw.splice(u.kw.indexOf(have), 1);
      gwDevs.push({ unit: u.id, kind: 'kw', field: 'kw', app: null, bsdata: have, file: W.file, det });
      if (u.kwNote) { const ex = u.kwNote.replace(/ comes? from .*$/, '').split(', ').filter(x => x !== have), tail = / from .*$/.exec(u.kwNote)[0]; u.kwNote = ex.length ? ex.join(', ') + (ex.length > 1 ? ' come' : ' comes') + tail : undefined; if (!u.kwNote) delete u.kwNote; }
    }
  }
  for (const k of printed) {
    if (u.kw.some(x => gwKw(x) === gwKw(k))) continue;
    const tc = k.replace(/^Faction: /, '').toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
    const kk = (/^Faction: /.test(k) ? 'Faction: ' : '') + tc;
    // (the export's keyword in the singular where GW prints the plural, BSData's "Biovore" for GW's BIOVORES: GW's in its place)
    const sing = u.kw.find(x => gwKw(x) + 'S' === gwKw(k) && !printed.some(y => gwKw(y) === gwKw(x)));
    if (sing) u.kw.splice(u.kw.indexOf(sing), 1);
    gwDevs.push({ unit: u.id, kind: 'kw', field: 'kw', app: kk, bsdata: sing || null, file: u._parts.map(p => (wahaDs(nm(p.name)) || {}).file).filter(Boolean).join(', ') });
    u.kw.push(kk); u.kw.sort();
    // (a keyword only the datasheet of a part after the first prints, the led Pink Horrors' INFANTRY: from that unit, as the kwNote says
    // of the export's own)
    const firstDs = wahaDs(nm(u._parts[0].name)), fromFirst = firstDs && firstDs.ds && firstDs.ds.keywords.concat(firstDs.ds.factionKeywords.map(x => 'Faction: ' + x)).some(x => gwKw(x) === gwKw(k));
    if (u._parts.length > 1 && !fromFirst) {
      const ex = u.kwNote ? u.kwNote.replace(/ comes? from .*$/, '').split(', ') : [], tail = u.kwNote ? (/ from .*$/.exec(u.kwNote) || [' from the led ' + u.leads + '.'])[0] : ' from the ' + (u.also ? 'combined unit' : (u.support ? 'supported ' : 'led ') + u.leads) + '.';
      ex.push(kk); u.kwNote = ex.join(', ') + (ex.length > 1 ? ' come' : ' comes') + tail;
    }
  }
}
for (const d of gwDevs) filled.push({ what: 'GW over BSData: ' + d.unit + ' ' + (d.row ? d.row + ' ' : '') + d.field + ' = ' + (d.app === null ? 'without ' + d.bsdata + ' (the ' + d.det + ' detachment’s keyword; BSData/New Recruit give it always)' : d.app + (d.bsdata ? ' (BSData/New Recruit: ' + d.bsdata + ')' : ' (not in BSData)')), from: 'Wahapedia datasheet ' + d.file });

// ---------------------------------------------------------------- wording: Wahapedia's datasheet (GW's codex), found by BSData's words
const wahaPagesOf = u => uniq(u._parts.map(p => nm(p.name))).map(n => pageFac(n) && WW.wahaPage(n, pageFac(n))).filter(Boolean);
// a Wahapedia datasheet page in its sections: CORE ABILITIES / ARMY RULES (names), ABILITIES ("**Name (tag):** text" and
// the lines after it), LEADER (the units it can lead)
function wahaSectionsOf(page) {
  const lines = WW.markup(page.tokens, page.P, 0, page.P.s.length - 1).split('\n');
  const head = l => /^[A-Z][A-Z’' ]{3,}$/.test(l.replace(/\*/g, '').trim());
  const out = { core: [], army: [], abilities: [], leader: [], support: [] };
  const names = l => l.split(/,\s*(?=\*\*)|\*\*,\*\*\s*/).map(x => x.replace(/\*\*/g, '').replace(/,$/, '').trim()).filter(Boolean);
  let seenWeapons = false, seenAbilities = false, seenComp = false, seenKw = false;   // (a header box is between the weapons and the first abilities section)
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^(RANGED|MELEE) WEAPONS$/.test(t)) seenWeapons = true;
    if (/^(CORE ABILITIES|ARMY RULES|ABILITIES|UNIT COMPOSITION|WARGEAR OPTIONS)$/.test(t) && seenWeapons) seenAbilities = seenAbilities || t !== 'WARGEAR OPTIONS';
    if (t === 'CORE ABILITIES' && lines[i + 1]) out.core = names(lines[i + 1]);
    if (t === 'ARMY RULES' && lines[i + 1] && !out.army.length) out.army = names(lines[i + 1]);
    if (t === 'LEADER') for (let j = i + 2; j < lines.length && /^- /.test(lines[j]); j++) out.leader.push(lines[j].replace(/^- |\*\*/g, '').trim());
    // (SUPPORT: the units a Support character can be attached to, as LEADER names a leader's)
    if (t === 'SUPPORT') for (let j = i + 2; j < lines.length && /^- /.test(lines[j]); j++) out.support.push(lines[j].replace(/^- |\*\*/g, '').trim());
    // ABILITIES, and PSYCHIC ABILITIES ("**Shrouding (psychic level 1):** …"): "**Name (tag):** text"
    if (t === 'ABILITIES' || t === 'PSYCHIC ABILITIES') {
      let cur = null;
      for (let j = i + 1; j < lines.length && !head(lines[j]); j++) {
        const m = /^\*\*([^*:]+?)(?: \(([^)]*)\))?:\*\*\s*(.*)$/.exec(lines[j]);
        // (a tag Wahapedia prints at the start of the text, "**Warp Rift Firepower:** (Once per battle, per unit) In your …": the
        // ability's tag, as GW names it "Warp Rift Firepower (Once per battle, per unit): In your …")
        const t0 = m && !m[2] ? /^\(([^)]+)\):?\s+(.*)$/.exec(m[3] || '') : null;
        if (m) { cur = { name: m[1].trim(), tag: m[2] || (t0 ? t0[1] : null), lines: m[3] ? [t0 ? t0[2] : m[3]] : [] }; out.abilities.push(cur); continue; }
        if (cur) cur.lines.push(lines[j]);
      }
    }
    // a rule GW prints in a header box of its own, before CORE ABILITIES ("SUPREME COMMANDER" / "If this model is in your army, it must
    // be your **WARLORD**."): an ability of that name (the box's heading, in title case), as Ghazghkull Thraka's Supreme Commander
    const KNOWN = /^(RANGED WEAPONS|MELEE WEAPONS|WARGEAR OPTIONS|CORE ABILITIES|ARMY RULES|ABILITIES|PSYCHIC ABILITIES|TRANSPORT|UNIT COMPOSITION|LEADER|SUPPORT|STRATAGEMS|DETACHMENT ABILITY|WARGEAR ABILITIES|DAMAGED.*|KEYWORDS.*|FACTION KEYWORDS.*|RANGE)$/;
    // (and a box after the unit composition, "SUPREME COMMANDER", "TRIARCHAL MENHIRS": The Silent King's; not YOUR UNIT COSTS)
    // (up to the datasheet's keywords: the page's glossary after them is no box)
    if (/^UNIT COMPOSITION$/.test(t)) seenComp = true;
    if (/^(\*\*)?(FACTION )?KEYWORDS/.test(t)) seenKw = true;
    if (head(lines[i]) && !KNOWN.test(t) && !/^YOUR /.test(t) && t.split(/\s+/).length >= 2 && seenWeapons && (!seenAbilities || (seenComp && !seenKw)) && lines[i + 1] && !head(lines[i + 1]) && /[a-z]/.test(lines[i + 1])) {
      const tl = []; for (let j = i + 1; j < lines.length && !head(lines[j]) && !/^(\*\*)?(FACTION )?KEYWORDS/.test(lines[j].trim()); j++) tl.push(lines[j]);
      // (title case, its small words lower case: "Daemon Primarch of Slaanesh")
      const nmTc = t.toLowerCase().replace(/(^|\s)([a-z]+)/g, (m, a, w) => a + (a && /^(of|the|and|in|on|to|for|a|an)$/.test(w) ? w : w[0].toUpperCase() + w.slice(1)));
      // (a box of named abilities, each "**Name (tag):** text": its parts, for an ability of the datasheet that selects one of them, below)
      const NAMED = /^\*\*([^*:]+?)(?: \(([^)]*)\))?:\*\*\s*(.*)$/;
      const subs = tl.length && tl.every(l => NAMED.test(l)) ? tl.map(l => { const m = NAMED.exec(l); return { name: m[1].trim(), tag: m[2] || null, lines: [m[3]], box: true, group: nmTc }; }) : null;
      out.abilities.push({ name: nmTc, tag: null, lines: tl, box: true, subs });
    }
    // DAMAGED: the box "DAMAGED: 1-7 WOUNDS REMAINING" and its text: the ability BSData names "Damaged: 1-7 wounds remaining"
    const dmg = /^DAMAGED: (\S+) WOUNDS REMAINING$/.exec(t);
    if (dmg) { const tl = []; for (let j = i + 1; j < lines.length && !head(lines[j]) && !/^KEYWORDS/.test(lines[j]); j++) tl.push(lines[j]); out.abilities.push({ name: 'Damaged: ' + dmg[1] + ' wounds remaining', tag: null, lines: tl, damaged: dmg[1] }); }
    // TRANSPORT: its text is the Transport ability BSData gives the unit
    // ATTACHED UNIT (Nemesis Claw: "If a CHARACTER unit … can be attached to a LEGIONARIES unit, …"): the ability BSData names "Attached Unit"
    if (t === 'ATTACHED UNIT') { const tl = []; for (let j = i + 1; j < lines.length && !head(lines[j]) && !/^(\*\*)?KEYWORDS/.test(lines[j]); j++) tl.push(lines[j]); out.abilities.push({ name: 'Attached Unit', tag: null, lines: tl }); }
    if (t === 'TRANSPORT') { const tl = []; for (let j = i + 1; j < lines.length && !head(lines[j]); j++) tl.push(lines[j]); out.abilities.push({ name: 'Transport', tag: null, lines: tl }); }
    for (const a of out.abilities) a.text = a.lines.join('\n').trim();
  }
  // a box of named abilities that another ability of the datasheet selects from ("select one of the abilities in the Daemon Primarch of
  // Slaanesh section": Fulgrim's DAEMON PRIMARCH OF SLAANESH): each is an ability of its own, the box's name its group (a box no ability
  // selects from stays one ability: the Daemon Prince of Chaos's Daemonic Allegiance)
  // (or "select one Triarch ability": The Silent King's TRIARCH ABILITIES)
  out.abilities = out.abilities.flatMap(a => a.subs && out.abilities.some(x => !x.box && selectsFrom(x.text, a.name)) ? a.subs.map(x => Object.assign(x, { text: x.lines.join('\n').trim() })) : [a]);
  for (const a of out.abilities) delete a.subs;
  return out;
}
// an ability's words that select one of the abilities of a box: "select one of the abilities in the <box> section", or "select one
// <box less "Abilities"> ability" (The Silent King: "select one Triarch ability (see left)" of the TRIARCH ABILITIES box)
const selectsFrom = (text, box) => { const t = String(text).replace(/\*\*/g, ''), b = box.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('select one of the abilities in the ' + b + ' section', 'i').test(t) || (/ abilities$/i.test(box) && new RegExp('select one ' + b.replace(/ abilities$/i, '') + ' ability\\b', 'i').test(t)); };
// the box GW prints after a unit's composition whose heading is an ability's name ("HORRORS ARE PINK. HORRORS ARE BLUE. …", Wahapedia
// after YOUR UNIT COSTS): its lines up to the keywords, a Designer’s Note as an italic line (as data.js writes GW's Designer’s Notes)
function boxAfterComposition(name, pages) {
  const sq = t => bare(String(t)).toLowerCase().replace(/[^a-z]/g, '');
  for (const pg of pages) {
    const L = WW.markup(pg.tokens, pg.P, 0, pg.P.s.length - 1).split('\n'), i = L.findIndex(l => sq(l) === sq(name));
    if (i < 0 || !L.slice(0, i).some(l => /^UNIT COMPOSITION$/.test(l.trim()))) continue;
    const out = [];
    for (let j = i + 1; j < L.length && !/^(\*\*)?(FACTION )?KEYWORDS/.test(L[j].trim()); j++) out.push(/^\*\*Designer’s Note:\*\*/.test(L[j]) ? '*' + L[j].replace(/\*/g, '').trim() + '*' : L[j].trim());
    if (out.length) return { text: out.join('\n'), file: wahaFile(pg) };
  }
  return null;
}
const partName0 = p => typo(nm(p.name));
const wahaFile = page => 'verify/.cache/waha/ds/' + page.file;
const dsWant = new Set();
const gwRules = new Map();   // unit id -> { core, army, leader, files }
for (const u of units) {
  for (const p of u._parts) if (pageFac(p.name)) dsWant.add(pageFac(p.name) + ' ' + WW.wahaAddress(nm(p.name)));
  const pages = wahaPagesOf(u);
  if (!pages.length) want(u.name, 'ability wording', 'no cached Wahapedia datasheet (add it to verify/sources/waha-datasheets.txt, sh verify/fetch.sh)');
  const secs = pages.map(pg => Object.assign(wahaSectionsOf(pg), { file: wahaFile(pg) }));
  const gwAbs = secs.flatMap(x => x.abilities.map(a => Object.assign({ file: x.file }, a)));
  // (an allied unit: its own faction's army rules are not the unit's, see ALLIES)
  const isAlly = u._parts.some(p => allyByName.has(nm(p.name)));
  gwRules.set(u.id, { core: uniq(secs.flatMap(x => x.core)), army: isAlly ? [] : uniq(secs.flatMap(x => x.army)), allyArmy: isAlly ? uniq(secs.flatMap(x => x.army)).map(typo) : [], ally: isAlly ? allyByName.get(nm(u._parts[0].name)) : null, leader: uniq(secs.flatMap(x => x.leader)), support: uniq(secs.flatMap(x => x.support)), files: secs.map(x => x.file),
    byPart: u._parts.map(p => { const pg = pageFac(p.name) && WW.wahaPage(nm(p.name), pageFac(p.name)); return pg ? { name: partName0(p), core: wahaSectionsOf(pg).core.map(typo) } : null; }) });
  const used = new Set();
  // an ability of a box of named abilities that another ability selects from ("select one of the abilities in the Daemon Primarch of
  // Slaanesh section"): who '<box>: pick one', as Angron's Wrathful Presence abilities (one model: who names no part)
  const pickOf = g => g.group && u._parts.length === 1 && gwAbs.some(x => !x.box && selectsFrom(bare(x.text), g.group)) ? g.group + ': pick one' : null;
  for (const ab of u.abilities) {
    const plain = plainBS(ab._bs);
    // an enhancement: its text from the detachment (data.js or this run's rows)
    if (ab._e) {
      ab.text = ab._e.text;
      if (ab._bs !== null && !textEq(ab._e.text, plain)) devs.push({ kind: 'bsdata', unit: u.id, field: 'ability.text', name: ab.name, app: ab.text, bsdata: plain, why: 'the enhancement as the detachment prints it (Wahapedia, the codex): BSData leaves out its first sentence or words it otherwise', file: 'verify/.cache/waha/' + factionId + '.txt' });
      continue;
    }
    // a detachment rule BSData shows on the unit ("Flare Shields"): the rule's words, as the detachment prints them
    const dr = detIds.flatMap(id => detRulesOf((F && F.detachments[id]) || facSrc.detachments[id])).find(r => r && lc(r.name) === lc(ab.name));
    if (dr) {
      ab.text = dr.text;
      if (!textEq(dr.text, plain)) devs.push({ kind: 'bsdata', unit: u.id, field: 'ability.text', name: ab.name, app: ab.text, bsdata: plain, why: 'the detachment rule as Wahapedia (the codex) prints it; BSData restates it for the unit', file: 'verify/.cache/waha/' + factionId + '.txt' });
      continue;
    }
    // the datasheet's ability: the one with BSData's words, else the one of BSData's name (GW's name, tag and words win)
    // (BSData's "[Psychic Abilities] - Shrouding" is GW's Shrouding)
    // (and without its articles: BSData's "Master of the Ka'tahs" is GW's Master of Ka’tahs)
    const loose = n => lc(n).replace(/^\[[^\]]*\]\s*-\s*/, '').replace(/[^a-z ]/g, '').split(' ').filter(w => !['the', 'a', 'an'].includes(w)).map(w => w.replace(/s$/, '')).join(' ');
    // (and, last, the one whose words are BSData's but for one or two words in place, the name among them: BSData's "Daemon Prince of
    // Slaanesh", "… select one of the abilities in the Daemon Prince of Slaanesh section …", is GW's Daemon Primarch of Slaanesh)
    const wordsOf = t => lc(appText(t).s).replace(/[^a-z0-9+" ]/g, ' ').split(/\s+/).filter(Boolean);
    const nearly = (a, b) => { const x = wordsOf(a), y = wordsOf(b); return x.length > 8 && x.length === y.length && x.filter((w, k) => w !== y[k]).length <= 2; };
    // (GW's words but for a layout cross-reference, "select one Triarch ability (see left)": BSData leaves it out)
    const seeL = t => String(t).replace(/ \(see (?:left|right|next page|overleaf)\)/gi, '');
    const g = gwAbs.find(x => !used.has(x) && textEq(x.text, plain)) || gwAbs.find(x => !used.has(x) && !x.box && /\(see (?:left|right|next page|overleaf)\)/i.test(x.text) && textEq(seeL(x.text), plain)) || gwAbs.find(x => !used.has(x) && lc(x.name) === lc(ab.name)) || gwAbs.find(x => !used.has(x) && loose(x.name) === loose(ab.name))
      || gwAbs.find(x => !used.has(x) && !x.box && nearly(x.text, plain) && lc(ab.name).split(' ').filter(w => !lc(x.name).split(' ').includes(w)).length <= 1);
    // an ability of the unit itself (not of its wargear) that GW's datasheet does not print (Roboute Guilliman's "Supreme
    // Commander"): GW wins, the app leaves it out
    // (BSData's "Invulnerable Save (4+*)" is GW's INSV* box with its footnote, "* against ranged attacks only": a header box GW prints,
    // kept with BSData's words, as the approved Knights lists have it; verify/texts.js reads it as the box)
    const box = /^invulnerable save\b/i.test(ab.name) && u._parts.some(p => { const W = wahaDs(nm(p.name)); return W && W.ds && W.ds.profiles.some(x => x.INSV && /\*$/.test(x.INSV) && ab.name.includes('(' + x.INSV + ')')); });
    if (box) { ab.text = typo(nm(plain)); filled.push({ what: 'ability ' + u.name + ' · ' + ab.name, from: 'the INSV* box of GW’s datasheet (Wahapedia: "* against ranged attacks only"), BSData’s words' }); continue; }
    // a box GW prints after the unit's composition, its heading the ability's name (the Pink Horrors' "HORRORS ARE PINK. HORRORS ARE
    // BLUE. …": use the Blue Horrors datasheet once no Pink Horror is left): GW's words, its Designer’s Note an italic line
    const bx = !g && boxAfterComposition(ab.name, pages);
    if (bx) {
      ab.text = bx.text;
      if (!textEq(bx.text, plain)) devs.push({ kind: 'bsdata', unit: u.id, field: 'ability.text', name: ab.name, app: ab.text, bsdata: plain, why: 'GW’s datasheet (Wahapedia) prints the box ' + ab.name + ' otherwise than BSData', file: bx.file });
      filled.push({ what: 'ability ' + u.name + ' · ' + ab.name, from: bx.file + ' (the box after the unit composition, its heading the ability’s name)' });
      continue;
    }
    if (!g && ab._sel && (ab._sel.type === 'model' || ab._sel.type === 'unit') && pages.length === u._parts.length) {
      devs.push({ kind: 'bsdata', unit: u.id, field: 'ability', name: ab.name, app: null, bsdata: ab.name, why: 'GW’s datasheet does not print the ability ' + ab.name, file: pages.map(wahaFile).join(', ') });
      ab._drop = true; continue;
    }
    if (!g) {
      const w = WW.wording(plain, pages);
      ab.text = w ? w.text : typo(nm(plain));
      want(u.name + ' · ' + ab.name, 'ability', 'not among the Wahapedia datasheet’s abilities (by its words or its name): ' + (w ? 'BSData’s words, marked up from the page' : 'BSData’s plain words kept'));
      continue;
    }
    used.add(g); hide(ab, { _gw: g.file });
    ab.text = g.text;
    if (g.damaged) ab.damaged = g.damaged;
    // (Aura) is only what GW tags so (Core Rules 22.01): BSData's "One Head Looks Back (Aura)" is GW's One Head Looks Back, untagged
    if (!g.tag && ab.tag === 'Aura' && lc(typo(g.name)) === lc(ab.name)) { delete ab.tag; devs.push({ kind: 'bsdata', unit: u.id, field: 'ability.tag', name: ab.name, app: null, bsdata: 'Aura', why: 'GW’s datasheet does not tag ' + ab.name + ' (Aura); BSData names it "' + ab.name + ' (Aura)"', file: g.file }); }
    if (pickOf(g)) { ab.who = pickOf(g); filled.push({ what: 'who ' + u.name + ' · ' + g.name + ': ' + ab.who, from: g.file + ' (an ability of the box ' + g.group + ', which "select one of the abilities in the ' + g.group + ' section" picks from)' }); }
    // (GW's spelling of a tag BSData has too: "psychic level 1" for "Psychic Level 1")
    if (g.tag && ab.tag) ab.tag = ab.tag.split(' · ').map(x => lc(x) === lc(g.tag) ? g.tag : x).join(' · ');
    if (g.tag && !(ab.tag || '').split(' · ').includes(g.tag)) { ab.tag = ab.tag ? ab.tag + ' · ' + g.tag : g.tag; filled.push({ what: 'tag ' + u.name + ' · ' + g.name + ': ' + g.tag, from: g.file + ' (the ability’s name)' }); }
    if (!textEq(g.text, plain)) devs.push({ kind: 'bsdata', unit: u.id, field: 'ability.text', name: typo(g.name), app: g.text, bsdata: plain, why: 'Wahapedia’s datasheet (the codex) words it otherwise than BSData', file: g.file });
    // (GW's capitalisation too, only for a name the hand file lists, caseNames: "Chittering swarm" for New Recruit's "Chittering
    // Swarm", as Wahapedia prints it; Wahapedia's casing goes both ways, so every other name and a Damaged band keep New Recruit's)
    if (g.damaged || !caseGW.has(nm(ab.name)) ? lc(typo(g.name)) !== lc(ab.name) : typo(g.name) !== ab.name) { devs.push({ kind: 'bsdata', unit: u.id, field: 'ability', name: typo(g.name), app: typo(g.name), bsdata: ab.name, why: 'GW’s name for the ability (Wahapedia’s datasheet); BSData names it ' + ab.name, file: g.file }); ab.name = typo(g.name); }
  }
  u.abilities = u.abilities.filter(a => !a._drop);
  // a rule GW prints in a header box of its own that BSData's entry does not have (the Daemon Prince of Chaos's Daemonic Allegiance):
  // GW wins, the app adds it with GW's words (an ability BSData has that GW does not print is left out, above)
  for (const g of gwAbs) if (g.box && !used.has(g) && !u.abilities.some(a => lc(a.name) === lc(g.name))) {
    used.add(g);
    const p = u._parts.find(x => wahaFile((pageFac(x.name) && WW.wahaPage(nm(x.name), pageFac(x.name))) || { file: '' }) === g.file) || u._parts[0];
    const o = { name: typo(g.name) }; if (u._parts.length > 1) o.who = partName0(p); else if (pickOf(g)) o.who = pickOf(g); if (g.tag) o.tag = g.tag; o.text = g.text;
    u.abilities.push(o);
    devs.push({ kind: 'bsdata', unit: u.id, field: 'ability', name: o.name, app: o.name, bsdata: null, why: 'GW’s datasheet prints the ability ' + o.name + ' (a box of its own); BSData’s entry does not have it', file: g.file });
    filled.push({ what: 'ability ' + u.name + ' · ' + o.name, from: g.file + ' (a header box of GW’s datasheet; not in BSData)' });
  }
  for (const g of gwAbs) if (!used.has(g) && !u.abilities.some(a => lc(a.name) === lc(g.name))) want(u.name + ' · ' + g.name, 'ability', 'on the Wahapedia datasheet (' + g.file + ') but not in BSData / the export: add by hand if the unit has it');
}

// the Rules line against the datasheet's CORE ABILITIES and ARMY RULES (GW's wins): a rule GW prints that the unit lacks is
// added (in place of BSData's of the same kind: "Deadly Demise 1" for GW's "Deadly Demise D3"); a datasheet rule GW does not
// print is dropped, except BSData's starred Feel No Pain ("Feel No Pain 5+*", from an army rule: GW prints the army rule)
for (const u of units) {
  const G = gwRules.get(u.id); if (!G || !G.files.length) continue;
  const gw = G.core.concat(G.army).map(typo), kind = n => lc(n).replace(/\s+(?:\d+\+?\*?|d\d+(?:[+-]\d+)?|\d+")$/, '');
  for (const r of gw) {
    if (u.rules.some(x => lc(x) === lc(r))) continue;
    const same = u._dsRules.find(x => kind(x) === kind(r) && !/\*$/.test(x));
    if (same) { u.rules[u.rules.indexOf(same)] = r; u._dsRules[u._dsRules.indexOf(same)] = r; devs.push({ kind: 'bsdata', unit: u.id, field: 'rules', name: r, app: r, bsdata: same, why: 'GW’s datasheet prints ' + r + ' (BSData: ' + same + ')', file: G.files.join(', ') }); }
    else { u.rules.splice(u._dsRules.length ? u.rules.indexOf(u._dsRules[u._dsRules.length - 1]) + 1 : 0, 0, r); u._dsRules.push(r); devs.push({ kind: 'bsdata', unit: u.id, field: 'rules', name: r, app: r, bsdata: null, why: 'GW’s datasheet prints ' + r + '; BSData’s entry does not', file: G.files.join(', ') }); }
  }
  for (const r of u._dsRules.slice()) {
    if (gw.some(x => lc(x) === lc(r)) || /\*$/.test(r)) continue;
    // a weapon ability of a weapon of the unit ("Devastating Wounds" for the Vigilators' [DEVASTATING WOUNDS: PSYKER]): GW prints it on
    // the weapon, not under CORE ABILITIES; the Rules line names the weapons' abilities, so it stays
    { const k = lc(r); if (u.ranged.concat(u.melee).some(w => (w.kw || []).some(x => lc(x) === k || lc(x).startsWith(k + ' ') || lc(x).startsWith(k + ':')))) { filled.push({ what: 'Rules line of ' + u.name + ' keeps ' + r, from: 'a weapon ability of its weapons' }); continue; } }
    // an army rule of the faction that GW's datasheet names as the tag of one of its abilities ("Defender’s Duty (Bondsman)"): the
    // datasheet names it, so it stays on the Rules line, as on every approved Imperial Knights list
    if (F && (F.armyRules || []).some(x => lc(x.name) === lc(r)) && u.abilities.some(a => (a.tag || '').split(' · ').some(t => lc(t) === lc(r)))) { filled.push({ what: 'Rules line of ' + u.name + ' keeps ' + r, from: 'the army rule its ability’s tag names (' + u.abilities.filter(a => (a.tag || '').split(' · ').some(t => lc(t) === lc(r))).map(a => a.name + ' (' + r + ')').join(', ') + ', ' + G.files.join(', ') + ')' }); continue; }
    u.rules.splice(u.rules.indexOf(r), 1); u._dsRules.splice(u._dsRules.indexOf(r), 1);
    if (G.allyArmy.some(x => lc(x) === lc(r))) { devs.push({ kind: 'ally', unit: u.id, field: 'rules', name: r, app: null, bsdata: r, why: r + ' is an army rule of the unit’s own faction (' + G.ally + '): an allied unit does not have it', file: G.files.join(', ') }); continue; }
    devs.push({ kind: 'bsdata', unit: u.id, field: 'rules', name: r, app: null, bsdata: r, why: 'GW’s datasheet does not print ' + r, file: G.files.join(', ') });
  }
  // a Feel No Pain its wargear gives only "against …" (Karanak's Brass Collar of Bloody Vengeance: "against Psychic Attacks and mortal
  // wounds"): not on the Rules line, where it would read as unconditional (GW's CORE ABILITIES do not print it); its When targeted line
  // keeps the condition
  for (const r of u.rules.slice()) {
    if (!/^Feel No Pain(?: \d\+)?$/i.test(r) || u._dsRules.some(x => lc(x) === lc(r)) || gw.some(x => lc(x) === lc(r))) continue;
    const by = u.abilities.find(a => new RegExp('\\bFeel No Pain' + (/\d\+$/.test(r) ? ' ' + r.slice(-2).replace('+', '\\+') : '') + '(?![\\d+])[^.]*?\\bagainst\\b', 'i').test(bare(a.text || '')));
    if (!by) continue;
    u.rules.splice(u.rules.indexOf(r), 1);
    devs.push({ kind: 'nr', unit: u.id, field: 'rules', name: r, app: null, bsdata: r, why: by.name + ' gives Feel No Pain only against what it names', file: G.files.join(', ') });
    filled.push({ what: 'Rules line of ' + u.name + ' without ' + r, from: by.name + ': “' + bare(by.text) + '” (its When targeted line keeps the condition)' });
  }
  // a core ability only some parts of an attached unit have (Trajann's Feel No Pain 5+, not the Allarus Custodians'): the model
  // that has it (partialRules), from each datasheet's CORE ABILITIES (Leader / Support: a character's own, never marked)
  if (u._parts.length > 1 && G.byPart.every(Boolean)) {
    const pr = {};
    for (const r of u.rules) {
      if (/^(Leader|Support)$/.test(r)) continue;
      const has = G.byPart.filter(x => x.core.some(c => lc(c) === lc(r)));
      // (not when an ability of each part without it gives it that rule: the Lord Exultant's Lord of the Host, "If this model is
      // attached to an EMPEROR’S CHILDREN BATTLELINE unit …, this model has the Infiltrators and Scouts 6" abilities", attached to
      // Infractors, a BATTLELINE unit: every model then has Scouts 6")
      const re = new RegExp('\\bthis model has the\\b[^.]*\\b' + r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[\\s.,]|$)', 'i');
      const gives = p => u.abilities.find(a => a.who === p.name && re.test(bare(a.text || '')) && (m => !m || u.kw.some(k => lc(k) === lc(m[1].split(/\s+/).pop())))(/\battached to an? ([^.,]*?) unit\b/i.exec(bare(a.text || ''))));
      const lack = G.byPart.filter(x => !has.includes(x));
      // (nor when the part that has it gives it to the whole unit, "This unit has Deep Strike": Nazdreg’s Know-wotz; a leader’s “this
      // unit” is the attached unit, Core Rules 19.04)
      const reU = new RegExp('\\bthis unit has\\b[^.]*\\b' + r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[\\s.,*]|$)', 'i');
      const toUnit = has.length === 1 && u.abilities.find(a => a.who === has[0].name && reU.test(bare(a.text || '')));
      if (toUnit) { filled.push({ what: 'no partialRules ' + u.name + ' for ' + r, from: toUnit.name + ' (' + has[0].name + ') gives the unit ' + r + ' (“This unit has”: the attached unit)' }); continue; }
      if (has.length === 1 && lack.length && lack.every(gives)) { filled.push({ what: 'no partialRules ' + u.name + ' for ' + r, from: lack.map(p => p.name + '’s ' + gives(p).name).join(', ') + ' gives it ' + r + ' (the unit has the keyword its condition names)' }); continue; }
      if (has.length === 1) pr[r] = has[0].name;
    }
    if (Object.keys(pr).length) { u.partialRules = pr; filled.push({ what: 'partialRules ' + u.name + ': ' + JSON.stringify(pr), from: 'the datasheets’ CORE ABILITIES (' + G.files.join(', ') + ')' }); }
  }
  // a leader: the unit it leads must be one GW's LEADER section names
  if (u.leads && G.leader.length && !G.leader.some(x => lc(x) === lc(u.leads))) want(u.name, 'leads ' + u.leads, 'GW’s LEADER section (' + G.files[0] + ') does not name it');
}

// ---------------------------------------------------------------- army rules data.js lacks: the ones the units name
const ruleNames = uniq(units.flatMap(u => u.rules));
if (!F) {
  const W = wahaArmyRules();
  // the army rules the units name, and those the list's detachment rules name ("Favoured ka’tah: RENDAX")
  const detText = detIds.flatMap(id => detRulesOf((F && F.detachments[id]) || facSrc.detachments[id])).map(r => bare(r.text)).join('\n');
  // and the ones named as a keyword of the list's units ("Anathema Psykana": the rule that lets the list take those units)
  const kws = new Set(units.flatMap(u => u.kw.map(k => lc(k.replace(/^Faction: /, '')))));
  // and the ones whose sub-headings a unit's ability names (Special Move Types: the Impulsor's Rapid Disembarkation names the
  // "shock disembark move")
  const abText = lc(units.flatMap(u => u.abilities.map(a => bare(a.text || ''))).join('\n'));
  const heads = r => r.lines.map(l => bare(l).replace(/\d+\.\d+$/, '').trim()).filter(t => /^[A-Z][A-Z -]{5,}$/.test(t));
  for (const r of W) {
    if (!ruleNames.some(n => lc(n) === lc(r.name)) && !lc(detText).includes(lc(r.name)) && !kws.has(lc(r.name)) && !heads(r).some(t => abText.includes(lc(t)))) continue;
    const ar = { name: typo(r.name) };
    // the Feel No Pain it gives the units that have it, with its condition, as the "When targeted" line says it (def)
    const fnp = /\bwith this ability have \**Feel No Pain (\d\+)\** against \**([^.*]+?)\**\./i.exec(r.lines.join(' '));
    if (fnp) { ar.def = 'Feel No Pain ' + fnp[1] + ' against ' + fnp[2]; filled.push({ what: 'army rule ' + r.name + ' def: ' + ar.def, from: 'its words ("units with this ability have Feel No Pain … against …")' }); }
    ar.text = ruleLines(r.lines).join('\n');
    // a FAQ GW's Faction Pack prints about it (its Rules Updates), quoted: verify/sources/hand/<army>.json armyRules.<name>.faq, each
    // "*FAQ (Faction Pack 1.2): <question> <answer>*" (verify/texts.js checks it in the pack)
    // GW's Faction Pack words where Wahapedia's differ (armyRules.<name>.texts: { from, to, why }, exactly once): Reanimation Protocols,
    // whose Rules Update "Change to" has no Example paragraph
    { const fx = ((HAND.armyRules || {})[ar.name] || {}).texts;
      if (fx) { if (ar.text.split(fx.from).length !== 2) want('army rule ' + ar.name, 'hand file text', 'its words are not there exactly once'); else { ar.text = ar.text.replace(fx.from, fx.to); handDone.push({ what: 'GW’s words in ' + ar.name, by: 'hand (Claude)', text: fx.why }); } } }
    for (const q of ((HAND.armyRules || {})[ar.name] || {}).faq || []) { ar.text += '\n' + q; handDone.push({ what: 'FAQ on ' + ar.name, by: 'hand (Claude), quoted', text: q }); }
    // the Damage tab's reading of the rule, written by hand (verify/sources/hand/<army>.json armyRules: calcMods, both, limit)
    const ha = (HAND.armyRules || {})[ar.name];
    if (ha && (ha.calcMods || ha.both || ha.limit)) { for (const k of ['calcMods', 'both', 'limit']) if (ha[k]) ar[k] = ha[k]; handDone.push({ what: 'Damage-tab reading of ' + ar.name, by: ha.by, text: (ha.calcMods || []).map(m => m.from + ': ' + m.note).join('; ') + (ha.both ? '; both with ' + ha.both.map(b => b.strat || b.enhancement || b.ability).join(', ') : '') }); }
    facSrc.armyRules.push(ar);
    filled.push({ what: 'army rule ' + r.name, from: 'Wahapedia ' + factionId + '.txt (Army Rules)' });
  }
}
// rules no glossary entry opens
const known = n => (F ? F.armyRules : facSrc.armyRules).some(r => lc(r.name) === lc(n)) || D.ruleAliases.some(([re]) => re.test(n)) || Object.keys(D.rules).some(k => lc(k) === lc(n)) ||
  detIds.some(id => detRulesOf((F && F.detachments[id]) || facSrc.detachments[id]).some(r => lc(r.name) === lc(n)));
// a core ability data.js lacks ("Damaged 5"): its section in Wahapedia's core rules ("DAMAGED24.39"); a line GW's Core Rules PDF
// does not print is marked as Wahapedia's (verify/texts.js checks it there)
const newRules = {}, newAliases = [];
const coreTxt = fs.readFileSync(path.join(ROOT, 'verify/.cache/waha/core.txt'), 'utf8').split('\n');
const gwCore = fs.readdirSync(path.join(ROOT, 'verify/.cache/gw')).filter(f => /core_rules.*\.txt$|universal_rules.*\.txt$/.test(f)).map(f => fs.readFileSync(path.join(ROOT, 'verify/.cache/gw', f), 'utf8')).join('\n');
const squashT = t => nm(t.replace(/\*\*/g, '')).toLowerCase().replace(/[^a-z0-9]/g, '');
for (const n of ruleNames) {
  if (known(n)) continue;
  const base = nm(n).replace(/\s+(?:\d+\+?\*?|D\d+(?:[+-]\d+)?|\d+")$/, '');
  const k = coreTxt.findIndex(l => new RegExp('^\\[?' + base.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\]?\\d\\d\\.\\d\\d$').test(l.trim()));
  if (k < 0 || newRules[base]) { if (k < 0) want('rules', 'rule ' + n, 'no entry in data.js RULES or the faction’s army rules, and no core rules section of that name: add GW’s wording'); continue; }
  const body = [];
  for (let j = k + 1; j < coreTxt.length && !/^\[?[A-Z][A-Z \-’']+\]?\d\d\.\d\d$/.test(coreTxt[j].trim()) && !/^#/.test(coreTxt[j]); j++) if (coreTxt[j].trim()) body.push(coreTxt[j].trim());
  const inGW = l => squashT(gwCore).includes(squashT(l));
  newRules[base] = body.map(l => inGW(l) ? l : '*Wahapedia core rules (not in GW’s Core Rules PDF, 01-06): ' + l + '*').join('\n');
  newAliases.push(base);
  filled.push({ what: 'glossary rule ' + base + ' (for ' + n + ')', from: 'Wahapedia core rules ' + coreTxt[k].trim() + (body.every(inGW) ? ', every line also in GW’s Core Rules' : ', marked as Wahapedia’s: GW’s Core Rules PDF (01-06) does not print it') });
}

// ---------------------------------------------------------------- --emit <file>: the reading as data (verify/from-bsdata.js)
// The units as read from BSData and checked against GW's datasheets (stats, weapons, keywords, base sizes, ability words, the Rules
// line: every GW-over-BSData step above), the detachments data.js lacks (from Wahapedia), and everything listed on the way, before
// anything of data.js's own lists is taken over (a datasheet row another list has) and before anything is written: the faction
// catalogue import builds its DATASHEETS rows and FACTIONS detachments from this, with the same code as every list.
if (argv.includes('--emit')) {
  const outF = path.resolve(argv[argv.indexOf('--emit') + 1]);
  const clean = v => JSON.parse(JSON.stringify(v, (k, x) => k.startsWith('_') ? undefined : x));
  const parts = u => u._parts.map(p => ({ name: typo(nm(p.name)), entryId: lastId(p.entryId) }));
  const raw = new Map([...readOf.entries()].map(([u, r]) => [u, clean(r)]));
  fs.mkdirSync(path.dirname(outF), { recursive: true });
  fs.writeFileSync(outF, JSON.stringify({
    units: units.map(u => Object.assign(clean(u), { parts: parts(u), dsRules: u._dsRules, raw: raw.get(u) || null, stats: u.stats.map(r => Object.assign(clean(r), { base0: r._base })) })),
    detachments: clean(facSrc.detachments), detachmentIds: detIds, newRules, devs: clean(devs), gwDevs: clean(gwDevs), gwFixed, gwNames: clean(gwNames),
    gwFacts: Object.fromEntries(gwFacts), gwRules: Object.fromEntries([...gwRules].map(([k, v]) => [k, clean(v)])), dispDevs: clean(dispDevs), todo, filled, datasheets: [...dsWant], bsChecked
  }, null, 1) + '\n');
  console.log('emitted ' + units.length + ' units, ' + Object.keys(facSrc.detachments).length + ' new detachments to ' + path.relative(ROOT, outF) + '; ' + todo.length + ' not filled mechanically');
  process.exit(0);
}

// ---------------------------------------------------------------- the army
const army = { id: armyId, name: typo(nm(R.name)), faction: factionId, points: +bsm[2] || null, pointsUsed: ptsOf(R), battleSize: bsm[1] || null, disposition, detachments: detIds };
if (Object.keys(config).length) army.config = config;
// the export carries no date: the day it was committed (git), else the file's
const gitDate = spawnSync('git', ['log', '-1', '--format=%cs', '--', path.relative(ROOT, path.resolve(srcFile))], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
const dt = gitDate ? new Date(gitDate + 'T12:00:00Z') : fs.statSync(srcFile).mtime;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
army.source = 'New Recruit, exported ' + dt.getUTCDate() + ' ' + MON[dt.getUTCMonth()] + ' ' + dt.getUTCFullYear() + ' (JSON)';
filled.push({ what: 'source date ' + army.source, from: gitDate ? 'the commit that added ' + path.basename(srcFile) + ' (the export has no date)' : 'the file date (the export has no date)' });

// ---------------------------------------------------------------- --compare: the reading against a list data.js already has
if (flag('--compare')) {
  const A = D.armies.find(a => a.id === armyId);
  if (!A) { console.error('no army ' + armyId + ' in data.js'); process.exit(2); }
  const out = [], gwOut = [];
  const clean = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o, (k, v) => ['from', 'printed'].includes(k) ? undefined : v));
  const F2 = ['role', 'pts', 'copies', 'ptsNote', 'enhancement', 'enhOn', 'upgrade', 'warlord', 'warlordOn', 'leads', 'support', 'also', 'models', 'unplaced', 'gear', 'stats', 'ranged', 'melee', 'rules', 'kw', 'kwNote'];
  for (const k of ['name', 'faction', 'points', 'pointsUsed', 'battleSize', 'disposition', 'detachments', 'config']) if (JSON.stringify(A[k]) !== JSON.stringify(army[k])) out.push('army.' + k + ': data.js ' + JSON.stringify(A[k]) + ', export ' + JSON.stringify(army[k]));
  const pool = A.units.slice();
  for (const u of units) {
    const m = pool.find(x => x.name === u.name && (x.leads || null) === (u.leads || null) && x.pts === u.pts && (x.enhancement || null) === (u.enhancement || null)) || pool.find(x => x.name === u.name && (x.leads || null) === (u.leads || null));
    if (!m) { out.push(u.id + ': not in data.js'); continue; }
    pool.splice(pool.indexOf(m), 1);
    // a difference the export's reading already has, or one GW's documents made (base guide, datasheet): listed apart
    const raw = readOf.get(u) || {}, eq = (x, y) => JSON.stringify(clean(x) || null) === JSON.stringify(clean(y) || null);
    for (const k of F2) { const hk = k === 'kwNote' ? ((HAND.units || {})[m.id] || {}).kwNote : undefined, a = clean(m[k]), b = clean(hk !== undefined ? hk : u[k]); if (!eq(a, b)) (eq(a, raw[k]) ? gwOut : out).push(m.id + '.' + k + ':\n    data.js ' + JSON.stringify(a) + '\n    export  ' + JSON.stringify(b)); }
    const an = m.abilities.map(a => [a.who || '', a.name, a.tag || ''].join('|')), bn = u.abilities.map(a => [a.who || '', a.name, a.tag || ''].join('|'));
    if (JSON.stringify(an) !== JSON.stringify(bn)) out.push(m.id + '.abilities (who|name|tag):\n    data.js ' + JSON.stringify(an) + '\n    export  ' + JSON.stringify(bn));
    for (const ab of u.abilities) { const x = m.abilities.find(y => y.name === ab.name && (y.who || '') === (ab.who || '')); if (x && x.text !== ab.text) out.push(m.id + '.abilities[' + ab.name + '].text:\n    data.js ' + JSON.stringify(x.text) + '\n    export  ' + JSON.stringify(ab.text)); }
  }
  // (a reference sheet of models on another sheet's datasheet, ref.of: built after this comparison, from that sheet)
  for (const x of pool) if (!(x.ref && x.ref.of)) out.push(x.id + ': in data.js, not in the export');
  console.log('# ' + armyId + ': ' + units.length + ' units from the export; ' + out.length + ' difference(s) in the reading; ' + gwOut.length + ' more from GW’s documents\n' + out.map(x => '- ' + x).join('\n') +
    (gwOut.length ? '\n## from GW’s documents (base size guide, datasheet), where data.js has the export’s value\n' + gwOut.map(x => '- ' + x).join('\n') : ''));
  process.exit(0);
}

// ---------------------------------------------------------------- labels: verify/derive.js on the words written
// (done after the rows are in data.js, so derive.js reads them as the app will; see writeLabels below)

// ---------------------------------------------------------------- a datasheet another list has: its row's facts are the app's
// One datasheet, one truth (docs/tables.md): a unit whose datasheet DATASHEETS already has (the same faction and BSData id; that row
// passed the gate and was signed off) takes the row's facts, not this run's reading of the same sources: stats, weapon values and
// keywords, abilities (words, tags, labels, When targeted lines), the Rules line. What the list itself changes stays the list's: a value
// a rule of the list gives (the row's `own` value is then the datasheet's), an enhancement's ability, a rule only the list's wargear or
// enhancement brings (Hunter’s Eye's Ignores Cover). Where the two readings differ, the row's value is kept and the difference is
// listed in the report ("Kept from the datasheet row"): a fact to settle on the datasheet, for every list that has it.
// GW's words where Wahapedia's transcription of an ability differs (the hand file's units.<id>.texts: { <ability>: { from, to, why } }),
// exactly once: before a datasheet row another list has is compared with this reading (the Faction Pack's words on both)
for (const [uid, h] of Object.entries(HAND.units || {})) {
  const u = units.find(x => x.id === uid); if (!u) continue;
  for (const [an, fx] of Object.entries(h.texts || {})) {
    const ab = u.abilities.find(a => a.name === an);
    if (!ab || String(ab.text).split(fx.from).length !== 2) { want(uid + ' · ' + an, 'hand file text', 'its words "' + fx.from + '" are not there exactly once'); continue; }
    ab.text = ab.text.replace(fx.from, fx.to); handDone.push({ what: 'GW’s words in ' + u.name + ' · ' + an + ': "' + fx.to + '"', by: 'hand (Claude)', text: fx.why });
  }
}
const reusedRows = [];        // { unit, what, row, reading }
const gwRows = [];            // { unit, key, what, row, gw }: GW's value where the row has another (the row is to be settled on it)
const reusedAbs = new Set();  // "<unit name> · <ability>": the row's labels, which the labels step below leaves as they are
{
  const S0 = (D.datasheets || {});
  const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
  // (a unit of several parts, a leader and the unit it leads: each part whose datasheet another list has, its own rows: its stats
  // row, the weapons and abilities that part carries (who), its Rules line kept in the unit's)
  for (const u of units) for (const p of u._parts) {
    const multi = u._parts.length > 1, pn = partName0(p);
    const hit = Object.entries(S0).find(([, S]) => S.faction === factionId && S.bsId === lastId(p.entryId));
    // (another list's: a row only this list has, from an earlier run of this file, is this run's to write again)
    // (and a row this list took over from a list the owner retired, the hand file's keptRows: its signed-off facts stay the app's, as
    // when another list has it; Simple but effective's from Melee and Ooga booga)
    const other = hit && (D.armies.some(a => a.id !== armyId && a.faction === factionId && a.units.some(x => x.name === hit[1].name || x.leads === hit[1].name || (x.also || []).some(c => c.name === hit[1].name))) || (HAND.keptRows || []).includes(hit[0]));
    if (!other) continue;
    const [key, S] = hit, note = (what, row, reading) => reusedRows.push({ unit: u.id, key, what, row, reading });
    const mineW = r => !multi || r.who === pn;
    for (const r of u.stats) {
      const sr = (S.stats || []).find(x => x.name === r._base || x.name === r.name); if (!sr) continue;
      for (const k of ['M', 'T', 'Sv', 'W', 'Ld', 'OC', 'InSv', 'base']) {
        if (!(k in sr)) continue;
        const mine = r.own && k in r.own ? r.own[k] : r[k];
        if (same(mine, sr[k])) continue;
        note('stats ' + r.name + ' ' + k, sr[k], mine);
        if (r.own && k in r.own) r.own[k] = sr[k]; else r[k] = sr[k];
      }
      // (a datasheet value the row has no column for, the Norn Assimilator's InSv – under Synaptoprescience's 4+: the row's, none)
      if (r.own) { for (const k of Object.keys(r.own)) if (!(k in sr)) delete r.own[k]; if (!Object.keys(r.own).length) delete r.own; }
    }
    for (const kind of ['ranged', 'melee']) for (const r of u[kind]) {
      if (!mineW(r)) continue;
      const sr = (S[kind] || []).find(x => x.name === r.name && (x.group || null) === (r.group || null)); if (!sr) continue;
      for (const k of ['range', 'A', 'BS', 'WS', 'S', 'AP', 'D']) {
        if (!(k in sr)) continue;
        const mine = r.own && k in r.own ? r.own[k] : r[k];
        if (same(mine, sr[k])) continue;
        note(kind + ' ' + (r.group ? r.group + ' - ' : '') + r.name + ' ' + k, sr[k], mine);
        if (r.own && k in r.own) r.own[k] = sr[k]; else r[k] = sr[k];
      }
      if ('kw' in sr && !same([...(r.kw || [])].sort(), [...sr.kw].sort())) note(kind + ' ' + (r.group ? r.group + ' - ' : '') + r.name + ' keywords (not changed: a rule of the list may add one)', sr.kw.join(', ') || '–', (r.kw || []).join(', ') || '–');
    }
    // abilities: the row's, in its order, then the list's own (an enhancement's); a part's in the place its abilities had
    const mineAbs = u.abilities.filter(a => !multi || a.who === pn), out = [];
    for (const sa of S.abilities || []) {
      let i = mineAbs.findIndex(a => a.name === sa.name && (multi || (a.who || null) === (sa.who || null)));
      // (the row's ability under another name, word for word the same: Wahapedia's "Unnatural Resilience" for the row's (BSData's)
      // "Unnatural Resistance"; GW's name, below, else the row's is kept and the difference listed)
      const bareT = t => lc(plainBS(t)).replace(/[^a-z0-9]+/g, ' ').trim();
      if (i < 0 && sa.text) { i = mineAbs.findIndex(a => !a._e && a.text && !(S.abilities || []).some(x => x.name === a.name) && bareT(a.text) === bareT(sa.text)); if (i >= 0 && !mineAbs[i]._gw) note('ability ' + sa.name + ' name', sa.name, mineAbs[i].name); }
      const a = i >= 0 ? mineAbs.splice(i, 1)[0] : null;
      // (GW's name and words, where this reading has them from GW's datasheet and the row has others, BSData's: GW's, for the row too;
      // markup alone, ** **, keeps the row's)
      const gwName = a && a._gw && a.name !== sa.name, gwText = a && a._gw && a.text !== undefined && String(a.text).replace(/\*\*/g, '') !== String(sa.text || '').replace(/\*\*/g, '');
      for (const k of new Set(Object.keys(sa).concat(a ? Object.keys(a) : []))) {
        if (k === 'name' || k === 'who' || k.startsWith('_') || (k === 'text' && gwText)) continue;
        // (labels and When targeted lines come later in this run, from derive.js and the hand file: only a value it has is compared)
        if (!a || (a[k] === undefined && !['text', 'tag', 'damaged'].includes(k))) continue;
        if (!same(a[k], sa[k])) note('ability ' + sa.name + ' ' + k, sa[k], a[k]);
      }
      if (!a) note('ability ' + sa.name, 'on the row', 'not in this reading');
      const o = Object.assign({}, sa); if (multi) o.who = pn;
      if (gwName) { o.name = a.name; gwRows.push({ unit: u.id, key, what: 'ability ' + sa.name + ' name', row: sa.name, gw: a.name }); }
      if (gwText) { o.text = a.text; gwRows.push({ unit: u.id, key, what: 'ability ' + a.name + ' text', row: sa.text, gw: a.text }); }
      // (a note that names another list's detachment rule, Singular Purpose's "With Enraged Behemoths’ …": that list's, not carried)
      if (o.note) { const F1 = (D.factions || {})[factionId] || {}, mine = new Set(army.detachments);
        const theirs = Object.entries(F1.detachments || {}).filter(([id]) => !mine.has(id)).flatMap(([, x]) => [x.rule].concat(x.moreRules || []).filter(Boolean).map(r => r.name));
        const by = theirs.find(n => n && o.note.includes(n)); if (by) { note('ability ' + sa.name + ' note (' + by + ', another list’s detachment rule: not carried)', o.note, a ? a.note : undefined); delete o.note; } }
      if (a) for (const k of Object.keys(a)) if (k.startsWith('_')) Object.defineProperty(o, k, { value: a[k], enumerable: false, writable: true, configurable: true });
      out.push(o); reusedAbs.add(u.name + ' · ' + (multi ? pn + ' · ' : '') + o.name);
    }
    for (const a of mineAbs) { if (!a._e) note('ability ' + a.name, 'not on the row', 'in this reading'); out.push(a); }
    if (!multi) u.abilities = out;
    else { const at = u.abilities.findIndex(a => a.who === pn), rest = u.abilities.filter(a => a.who !== pn); rest.splice(at < 0 ? rest.length : u.abilities.slice(0, at).filter(a => a.who !== pn).length, 0, ...out); u.abilities = rest; }
    // the Rules line: the row's, then a rule only this list's units bring (its wargear's or enhancement's); a part's row: its rules
    // stay in the unit's line (the other part's too)
    if (S.rules) {
      const extra = u.rules.filter(r => !S.rules.includes(r)), lost = S.rules.filter(r => !u.rules.includes(r));
      if (lost.length) note('rules', S.rules.join(', '), u.rules.join(', '));
      if (!multi) {
        u.rules = S.rules.concat(extra);
        if (extra.length) filled.push({ what: 'Rules line of ' + u.name + ': the datasheet row’s, and ' + extra.join(', ') + ' (not on the row: this list’s own)', from: 'DATASHEETS ' + key });
      } else if (lost.length) u.rules = uniq(u.rules.concat(lost));
    }
    // keywords: a keyword GW's datasheet prints that the export lacks, which the row was settled without (the Tyrannofex's FRAME,
    // from Wahapedia's errata line GW's Faction Pack does not print: the row's srcNote says so): the row's, as for every list
    if (!multi && S.kw) for (const d of gwDevs.filter(x => x.unit === u.id && x.kind === 'kw' && x.app && !x.bsdata && !S.kw.includes(x.app) && u.kw.includes(x.app))) {
      note('keyword ' + d.app, 'not on the row', 'GW’s datasheet (' + d.file + ')'); u.kw.splice(u.kw.indexOf(d.app), 1); d.kept = true;
    }
    // (and the row's note on its sources, srcNote: the Tyrannofex's FRAME)
    if (!multi && S.srcNote !== undefined && u.srcNote === undefined) u.srcNote = S.srcNote;
    filled.push({ what: (multi ? u.name + ' (' + pn + ')' : u.name) + ': the facts of the datasheet row ' + key + ' (another list has it)', from: 'data.js DATASHEETS' });
  }
}

// ---------------------------------------------------------------- source for data.js
// ---------------------------------------------------------------- the hand file's unit columns (verify/sources/hand/<army>.json units)
// an ability's When targeted line (def, AI-written, with its fingerprint), the unit's weapon footnotes (mods) and auras, and a stats
// value a rule of the list gives that the export does not show (the Impulsor's Shield Dome 5+ InSv)
const handKw = [], handStats = [];
for (const [uid, h] of Object.entries(HAND.units || {})) {
  const u = units.find(x => x.id === uid);
  if (!u) { want(uid, 'hand file', 'verify/sources/hand/' + armyId + '.json names a unit the list does not have'); continue; }
  for (const [an, d] of Object.entries(h.defs || {})) {
    const ab = u.abilities.find(a => a.name === an);
    if (!ab) { want(uid + ' · ' + an, 'hand file def', 'no ability of this name'); continue; }
    const t = ab.text; delete ab.text; ab.def = d.def; ab.text = t; if (d.defOf) ab.defOf = d.defOf;
    handDone.push({ what: 'When targeted line of ' + u.name + ' · ' + an, by: d.by, text: d.def });
  }
  // (GW's words where Wahapedia's transcription differs, texts: applied before the datasheet rows are compared, above)
  // why an ability does nothing in this list, when that is certain (na: { <ability>: why }: the Destrier's Thundercharge without its weapons)
  for (const [an, why] of Object.entries(h.na || {})) {
    const ab = u.abilities.find(a => a.name === an);
    if (!ab) { want(uid + ' · ' + an, 'hand file na', 'no ability of this name'); continue; }
    const t = ab.text; delete ab.text; ab.na = why; ab.text = t;
    handDone.push({ what: 'na on ' + u.name + ' · ' + an, by: 'hand (Claude)', text: why });
  }
  for (const [an, note] of Object.entries(h.notes || {})) {
    const ab = u.abilities.find(a => a.name === an);
    if (!ab) { want(uid + ' · ' + an, 'hand file note', 'no ability of this name'); continue; }
    const t = ab.text; delete ab.text; ab.note = note; ab.text = t;
    handDone.push({ what: 'note on ' + u.name + ' · ' + an, by: 'hand (Claude)', text: note });
  }
  // the keywords note where its reasons are more than the parts' (kwNote: a keyword a rule of the list gives, Sneaky Little Gitz' BATTLELINE)
  if (h.kwNote) { u.kwNote = h.kwNote; handDone.push({ what: 'kwNote of ' + u.name + ': ' + h.kwNote, by: 'hand (Claude)', text: h.why || '' }); }
  for (const [rn, vals0] of Object.entries(h.stats || {})) {
    const r = u.stats.find(x => x.name.replace(/ ×\d+$/, '') === rn);
    if (!r) { want(uid + ' · ' + rn, 'hand file stats', 'no stats row of this name'); continue; }
    // (its reason, `from`: the rule that gives the value, shown on the screen as for a "+" mark; { InSv: 'Soul Forge Boons' })
    const vals = Object.assign({}, vals0); delete vals.from;
    if (vals0.from) r.from = Object.assign(r.from || {}, vals0.from);
    for (const k of Object.keys(vals)) if (r[k] !== undefined && r[k] !== vals[k] && !(r.own && k in r.own)) r.own = Object.assign(r.own || {}, { [k]: r[k] });
    Object.assign(r, vals); handDone.push({ what: 'stats ' + u.name + ' · ' + rn + ': ' + JSON.stringify(vals), by: 'hand (Claude)', text: h.why || '' });
    // (a value BSData's modifiers do not give either: declared with the hand file's evidence, statsEvidence)
    if (h.statsEvidence) for (const [k, v] of Object.entries(vals)) handStats.push({ unit: uid, row: rn, field: k, value: v, from: (vals0.from || {})[k], why: h.why, evidence: h.statsEvidence });
  }
  // keywords a rule of the list gives that BSData's entry and the export lack (the Forgefiend's SOUL FORGE: Soul Forge Boons)
  // (and a category of BSData's GW's datasheet does not print, kw.drop: the Chaos Spawn's SPAWN; verify/bsdata.js's difference is declared below)
  for (const k of (h.kw || {}).drop || []) { const i = u.kw.indexOf(k); if (i < 0) { want(uid + ' · ' + k, 'hand file kw.drop', 'no keyword of this name'); continue; } u.kw.splice(i, 1); handDone.push({ what: 'keyword ' + k + ' of ' + u.name + ' left out', by: 'hand (Claude)', text: h.kw.why }); }
  for (const k of (h.kw || {}).add || []) { if (!u.kw.includes(k)) { u.kw.push(k); u.kw.sort(); } handKw.push({ unit: uid, kw: k, why: h.kw.why, evidence: h.kw.evidence }); handDone.push({ what: 'keyword ' + k + ' of ' + u.name, by: 'hand (Claude)', text: h.kw.why }); }
}
// ---------------------------------------------------------------- the readings (docs/tables.md, Readings)
// A reading (a footnote, mods; an aura; a guard line) is on the row of the rule it reads: a datasheet's ability's on its DATASHEETS
// row, an army or detachment rule's on its row, an enhancement's on the enhancement. A row's readings: the hand file's (readings:
// { datasheets, rules, enhancements } by name, each { mods, aura, guard } in its order), else the ones data.js has on that row
// (another list's, or this list's from an earlier run); a datasheet's abilities none of those read that verify/derive.js's fixed
// rules read (readingsOf: a Damaged ability, a riled-up weapon ability, a charge bonus) get the derived reading (readBy). Each unit
// gets its rows' readings in the order data.js resolves them (verify/tables.js: the army rules on its Rules line, each datasheet of
// the unit, its enhancement, the detachment rules whose needs it meets), then its own (the hand file's units.<id>.mods / aura / guard;
// a name in that list stands for the rows' readings of that name, the list being the unit's whole list in its order). The list is
// written in the old form; verify/tables.js --write then keeps each reading on its row (two lists reading one rule otherwise: listed).
{
  const HR = HAND.readings || {}, READ = ['mods', 'aura', 'guard'], F0 = (D.factions || {})[factionId] || facSrc || {};
  const { readingsOf, vocab, ruleNeeds, tidyNeeds } = require('./derive'), T = require('./tables');
  // (a detachment rule this run adds has no needs yet: the labels step below writes the ones verify/derive.js reads from its words, on
  // data.js as written; the same reading here, on data.js's other lists and this one, so a first --write gives the final readings)
  const fresh = r => Object.values(facSrc.detachments || {}).some(d => d.rule === r || (d.moreRules || []).includes(r));
  const V0 = vocab({ armies: D.armies.filter(a => a.id !== armyId).concat([{ units }]), factions: Object.assign({}, D.factions, { [factionId]: { name: ((D.factions || {})[factionId] || {}).name || typo(catName.replace(/^.* - /, '')) } }) });
  const needsNow = r => { if (!fresh(r) || r.needs !== undefined) return r.needs; const dn = ruleNeeds(V0, r); return dn.needs ? tidyNeeds(dn.needs) : undefined; };
  const nmR = s => String(s).toLowerCase().replace(/[’‘]/g, "'"), hasN = (l, x) => (l || []).some(y => nmR(y) === nmR(x));
  const meets = (n, u) => !n || (!n.all || n.all.every(k => hasN(u.kw, k))) && (!n.any || n.any.some(k => hasN(u.kw, k))) && !(n.none || []).some(k => hasN(u.kw, k)) && (!n.rule || n.rule.some(r => hasN(u.rules, r)));
  const dsRow = name => Object.values(D.datasheets || {}).find(S => S.faction === factionId && S.name === nm(name));
  const pick = (hand, row, kind) => hand && hand[kind] ? hand[kind] : row && row[kind] ? row[kind] : [];
  const coreText = name => { if (D.rules[name]) return D.rules[name]; const k = ((D.ruleAliases || []).find(([re]) => re.test(name)) || [])[1]; return k && D.rules[k] && /\d/.test(name) ? name + ': ' + D.rules[k] : null; };
  for (const u of units) {
    // (a detachment this run adds to a faction data.js has: its row from this run)
    const h = (HAND.units || {})[u.id] || {}, dets = army.detachments.map(id => (F0.detachments || {})[id] || facSrc.detachments[id]).filter(Boolean);
    const parts = [u.name].concat((u.also || []).map(x => x.name), u.leads ? [u.leads] : []);
    // an ability row's own readings (riled, damaged, defCalc, …): the fingerprint data.js's row has for the same words
    for (const ab of u.abilities) for (const pn of parts) { const row = dsRow(pn), sa = row && (row.abilities || []).find(x => x.name === ab.name && x.text === ab.text && x.readOf); if (sa && ab.readOf === undefined) { ab.readOf = sa.readOf; break; } }
    const enh = dets.flatMap(d => d.enhancements || []).find(e => e.name === u.enhancement || e.name === u.upgrade);
    for (const kind of READ) {
      const t = [];
      for (const r of F0.armyRules || []) if (hasN(u.rules, r.name)) t.push(...pick((HR.rules || {})[r.name], r, kind));
      parts.forEach((pn, i) => {
        const hand = (HR.datasheets || {})[pn], row = dsRow(pn), have = pick(hand, row, kind);
        t.push(...have);
        // (derived: only a single datasheet's own abilities, the ones with no reading of their own here)
        if (kind !== 'mods' || hand && !hand.derive) return;
        if (row && row.mods) return;
        const own = u.abilities.filter(a => !/\b(Enhancement|Upgrade)\b/.test(a.tag || '') && (parts.length === 1 || a.who === pn));
        const texts = own.map(a => [a.text, a.name]).concat(i === 0 ? u.rules.map(r => [coreText(r), r]).filter(x => x[0]) : []);
        for (const [text, name] of texts) { if (have.some(m => m.from === name)) continue; const d = readingsOf(text, name); if (d) t.push(...d.mods.map(m => Object.assign({}, m, { readOf: T.fp(text), readBy: 'derive' }))); }
      });
      if (enh) t.push(...pick((HR.enhancements || {})[enh.name], enh, kind));
      for (const d of dets) for (const r of [d.rule].concat(d.moreRules || [])) if (r && meets(needsNow(r), u)) t.push(...pick((HR.rules || {})[r.name], r, kind));
      const mine = h[kind];
      const list = mine === null ? [] : !mine ? t : mine.some(x => typeof x === 'string') ? mine.flatMap(x => typeof x === 'string' ? t.filter(m => m.from === x) : [x]) : t.concat(mine);
      if (list.length) u[kind] = JSON.parse(JSON.stringify(list)); else delete u[kind];
      if (mine && mine.some(x => typeof x !== 'string')) handDone.push({ what: kind + ' of ' + u.name + ' (its own)', by: 'hand (Claude)', text: mine.filter(x => typeof x !== 'string').map(m => m.from + ': ' + m.note).join('; ') });
    }
  }
  for (const [k, by] of Object.entries(HR)) if (k !== '_about') for (const [n, r] of Object.entries(by)) handDone.push({ what: 'readings of ' + n + ' (' + k + ')', by: 'hand (Claude)', text: READ.flatMap(kd => (r[kd] || []).map(m => m.from + ': ' + m.note)).join('; ') });
}
// a reference sheet's reason (ref: { by, rule, quote }): the ability of a unit of the list whose words add a unit of its keyword to the
// army ("you can add one new SPORE MINES unit to your army", Seed Spore Mines), quoted as GW prints it
// (or a stratagem of the list's detachments, "add one TZEENTCH CHAOS SPAWN unit containing one model to your army", Gift of Change: no
// unit adds it, strat names the stratagem; a keyword phrase is the unit's keywords one after another, TZEENTCH + CHAOS SPAWN)
const addsRe = /\badd (?:one|a|an|\d+|D\d) (?:new )?([A-Z][A-Z’' -]+?) units?(?: containing [^.]*?)? to your army\b/;
const kwPhrase = (p, kws) => { const K = [...new Set(kws.map(gwKw))].sort((a, b) => b.length - a.length);
  const go = r => !r || K.some(k => (r === k || r.startsWith(k + ' ')) && go(r.slice(k.length).trim())); return go(gwKw(p).trim()); };
const listStrats = () => army.detachments.flatMap(id => ((((D.factions || {})[factionId] || {}).detachments || {})[id] || (facSrc.detachments || {})[id] || {}).stratagems || []);
for (const u of units) if (u._ref) {
  const hit = units.filter(x => !x._ref).flatMap(x => x.abilities.map(a => ({ x, a }))).map(({ x, a }) => {
    const sent = bare(a.text || '').split(/(?<=\.)\s+/).find(t => { const m = addsRe.exec(t); return m && kwPhrase(m[1], u.kw); });
    return sent ? { by: x.id, rule: a.name, quote: sent } : null; }).find(Boolean)
    || listStrats().map(st => { const sent = bare(st.effect || '').split(/(?<=\.)\s+/).find(t => { const m = addsRe.exec(t); return m && kwPhrase(m[1], u.kw); });
      return sent ? { rule: st.name, quote: sent, strat: st.id } : null; }).find(Boolean);
  const hr = u._refHand ? u._refHand.ref : ((HAND.units || {})[u.id] || {}).ref;
  if (hr) { u.ref = hr; handDone.push({ what: 'reference sheet ' + u.name, by: 'hand (Claude)', text: JSON.stringify(hr) }); }
  else if (hit) { u.ref = hit; filled.push({ what: 'reference sheet ' + u.name + ': added by ' + hit.rule + ' (' + (hit.by || 'stratagem ' + hit.strat) + ')', from: (hit.strat ? 'the stratagem’s EFFECT: "' : 'the ability’s words: "') + hit.quote + '"' }); }
  else want(u.name, 'reference sheet', 'no ability of the list’s units adds a unit of its keywords: write units.' + u.id + '.ref in the hand file');
}
// a reference sheet of models GW prints on another reference sheet's datasheet, with no datasheet (nor BSData entry) of their own
// (the hand file's refs: { of, name, model, carrier, dropKw, abilities, notes, ref }): the Brimstone Horrors, on GW's Blue Horrors
// datasheet ("Every Brimstone Horror added to this unit using the Split ability is equipped with: …"): that datasheet's profile and
// rules, the abilities about these models (abilities: their names; GW's Split and Sullen Malevolence are about BLUE HORROR models),
// a note on one (notes: { ability: note }, GW's Designer's Note), the weapons of its carrier line, its keywords but the other models'
// (BLUE); listed after the sheet it is from
for (const h of (HAND.refs || []).filter(x => x.of)) {
  const src = units.find(x => x._ref && x.name === h.of);
  if (!src) { want(h.name, 'reference sheet', 'no reference sheet ' + h.of + ' in this list to build it from'); continue; }
  const rows = k => (src[k] || []).filter(w => w.carrier === h.carrier).map(w => { const o = JSON.parse(JSON.stringify(w)); delete o.carrier; o.name = o.name.replace(/ \(ref\. only\)$/, ''); return o; });
  const ranged = rows('ranged'), melee = rows('melee');
  if (!ranged.length && !melee.length) { want(h.name, 'reference sheet', 'no weapon of ' + h.of + ' has the carrier "' + h.carrier + '"'); continue; }
  const u = { id: slug(h.name), name: h.name, role: 'Reference', pts: 0, ref: h.ref, models: ['1× ' + h.model], gear: [ranged.concat(melee).map(w => w.name)],
    stats: [Object.assign(JSON.parse(JSON.stringify(src.stats[0])), { name: h.model })], ranged, melee, abilities: JSON.parse(JSON.stringify(src.abilities.filter(a => !h.abilities || h.abilities.includes(a.name)))),
    rules: src.rules.slice(), kw: src.kw.filter(k => !(h.dropKw || []).includes(k)) };
  for (const [an, note] of Object.entries(h.notes || {})) { const ab = u.abilities.find(a => a.name === an); if (!ab) { want(h.name + ' · ' + an, 'hand file note', 'no ability of this name'); continue; } const t = ab.text; delete ab.text; ab.note = note; ab.text = t; }
  hide(u, { _ref: true, _at: src._at }); u._parts = [];
  units.splice(units.indexOf(src) + 1, 0, u);
  handDone.push({ what: 'reference sheet ' + h.name + ' (from ' + h.of + ')', by: 'hand (Claude)', text: JSON.stringify(h.ref) });
}
const abOrder = ['name', 'who', 'tag', 'damaged', 'at', 'ph', 'turn', 'turns', 'def', 'na', 'text'];
for (const u of units) { for (const ab of u.abilities) { delete ab._bs; delete ab._e; delete ab._part; } delete u._parts; }
const armySrc = () => '{\n' + ['id', 'name', 'faction', 'points', 'pointsUsed'].map(k => k + ':' + lit(army[k])).join(', ').replace(/^/, '  ') + ',\n' +
  '  battleSize:' + lit(army.battleSize) + ', disposition:' + lit(army.disposition) + ',\n' +
  '  detachments:' + lit(army.detachments) + ',\n' + (army.config ? '  config:' + lit(army.config) + ',\n' : '') + '  source:' + lit(army.source) + ',\n  units:[\n' + units.map(u => { const v = Object.assign({}, u); delete v._at; return unitSrc(v); }).join(',\n') + '\n  ]\n},\n';
function factionSrc() {
  const I = '    ';
  const det = (id, d) => {
    let s = I + '  // ' + d.name + ': Wahapedia (the codex), written by verify/from-json.js; gists AI-written (see the report)\n';
    s += I + "  '" + id + "': {\n" + I + '    name:' + lit(d.name) + ', dispositions:' + lit(d.dispositions || []) + ', dp:' + d.dp + ',\n';
    s += I + '    rule:' + lit(d.rule) + ',\n';
    if (d.moreRules) s += I + '    moreRules:[\n' + d.moreRules.map(r => I + '      ' + lit(r)).join(',\n') + '\n' + I + '    ],\n';
    s += I + '    enhancements:[\n' + d.enhancements.map(e => I + '      ' + lit(e)).join(',\n') + '\n' + I + '    ],\n';
    s += I + '    stratagems:[\n' + d.stratagems.map(x => I + '      ' + lit(x)).join(',\n') + '\n' + I + '    ]\n' + I + '  }';
    return s;
  };
  return { armyRules: facSrc.armyRules.map(r => I + '  ' + lit(r)).join(',\n'), dets: Object.entries(facSrc.detachments).map(([id, d]) => det(id, d)).join(',\n') };
}

// ---------------------------------------------------------------- the report
const report = () => ['# ' + army.name + ' (' + armyId + ') from its New Recruit JSON export', '',
  'From `' + path.relative(ROOT, path.resolve(srcFile)) + '` by `verify/from-json.js`. ' + units.length + ' units (' + units.reduce((t, u) => t + (u.copies || 1), 0) + ' with copies), ' + units.reduce((t, u) => t + u.pts * (u.copies || 1), 0) + ' pts.', '',
  '## Filled mechanically', '',
  '- every unit fact from the export’s selections, found by BSData id: ' + bsChecked.selections + ' selections, ' + bsChecked.profiles + ' profiles and ' + bsChecked.rules + ' rules looked up in BSData at the pin',
  ...filled.map(f => '- ' + f.what + ' (' + f.from + ')'),
  '', '## Profiles New Recruit shows changed from BSData’s entry (' + bsChecked.modified.length + ')', '', 'A rule of the list applied by New Recruit; verify/bsdata.js re-derives each from BSData’s modifiers.', '',
  ...bsChecked.modified.map(x => '- ' + x),
  '', '## BSData entries at the pin that differ from GW, where the export already has GW’s value (' + gwFixed.length + ')', '', ...gwFixed.map(x => '- ' + x),
  '', '## Weapons BSData (and New Recruit) name otherwise than GW’s datasheet (' + gwNames.length + ')', '', 'The app keeps New Recruit’s name (the name the export carries); the values are checked against GW’s profile of this name.', '', ...gwNames.map(x => '- ' + x.unit + ' ' + x.kind + ': ' + x.app + ' (GW: ' + x.gw + ', ' + x.file + ')'),
  '', '## Written by hand (' + handDone.length + ', from verify/sources/hand/' + armyId + '.json)', '', ...handDone.map(h => '- ' + h.what + ' — ' + h.by + ': ' + h.text),
  '', '## GW’s words where the datasheet row had others (' + gwRows.length + ')', '', 'A datasheet another list has, whose row had BSData’s name or words: GW’s (Wahapedia’s datasheet), written for this list; the row is to be settled on them (every list that has it), and BSData’s and New Recruit’s declared.', '',
  ...gwRows.map(x => '- ' + x.unit + ' (' + x.key + ') · ' + x.what + ': row ' + JSON.stringify(x.row) + ', GW ' + JSON.stringify(x.gw)),
  '', '## Kept from the datasheet row (' + reusedRows.length + ')', '', 'A datasheet another list has: the row’s value is the app’s (docs/tables.md, one datasheet, one truth); this run read the sources otherwise. Settle each on the datasheet, for every list that has it.', '',
  ...reusedRows.map(x => '- ' + x.unit + ' · ' + x.what + ': row ' + JSON.stringify(x.row) + ', this reading ' + JSON.stringify(x.reading)),
  '', '## Not filled mechanically (' + todo.length + ')', '',
  ...todo.map(t => '- **' + t.where + '**: ' + t.what + ' — ' + t.why),
  '', '## Deviations to declare (' + devs.length + ')', '',
  ...devs.map(d => '- ' + d.unit + ' ' + d.field + ' (' + d.why + ')\n  - app: ' + JSON.stringify(d.app) + '\n  - BSData: ' + JSON.stringify(d.bsdata)),
  '', '## Wahapedia datasheets used', '', ...[...dsWant].map(x => '- ' + x), ''].join('\n');

// ---------------------------------------------------------------- write
fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive: true });
const outJs = path.join(ROOT, 'verify/out/from-json-' + armyId + '.js');
fs.writeFileSync(outJs, armySrc());
fs.writeFileSync(path.join(ROOT, 'verify/out/from-json-' + armyId + '.json'), JSON.stringify({ todo, filled, devs, modified: bsChecked.modified, datasheets: [...dsWant], faction: facSrc }, null, 1) + '\n');
if (!flag('--write')) { fs.writeFileSync(path.join(ROOT, 'verify/out/from-json-' + armyId + '.md'), report()); console.log('wrote verify/out/from-json-' + armyId + '.js and .md: ' + units.length + ' units, ' + todo.length + ' not filled'); process.exit(0); }

let d = fs.readFileSync(DATA, 'utf8');
const REFS = flag('--refs'), refUnits = units.filter(u => u._ref), refIds = new Set(refUnits.map(u => u.id)), refNames = new Set(refUnits.map(u => u.name));
if (REFS && !D.armies.some(a => a.id === armyId)) { console.error('--refs: data.js has no list ' + armyId); process.exit(2); }
if (REFS) for (const k of Object.keys(newRules)) delete newRules[k];
// core abilities data.js lacked (glossary entries and the alias that opens them: "Damaged 5" -> Damaged)
for (const [k, v] of Object.entries(newRules)) {
  const at = d.indexOf('\n};\n', d.indexOf('const RULES = {'));
  d = d.slice(0, at) + ',\n  // ' + k + ': Wahapedia core rules, written by verify/from-json.js\n  ' + lit(k) + ': ' + lit(v) + d.slice(at);
  const al = d.indexOf('\n];\n', d.indexOf('const RULE_ALIASES = ['));
  d = d.slice(0, al) + ',\n  [/^' + k.toLowerCase().replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '\\b/i, ' + lit(k) + ']' + d.slice(al);
}
// the faction (new) or its new detachments
if (REFS) { /* (the faction and its detachments: data.js's) */ }
else if (!F) {
  const fs2 = factionSrc();
  const entry = "  '" + factionId + "': {\n    name: " + lit(typo(catName.replace(/^.* - /, ''))) + ',\n    // army rules: Wahapedia, ' + catName.replace(/^.* - /, '') + ', Army Rules (the ones the list’s units name), written by verify/from-json.js\n    armyRules: [\n' + fs2.armyRules + '\n    ],\n    detachments: {\n' + fs2.dets + '\n    }\n  },\n';
  const at = d.indexOf('\n};\n', d.indexOf('const FACTIONS = {'));
  d = d.slice(0, at + 1) + entry + d.slice(at + 1);
} else if (Object.keys(facSrc.detachments).length) {
  const fs2 = factionSrc();
  const fAt = d.indexOf("  '" + factionId + "': {"), dAt = d.indexOf('    detachments: {\n', fAt);
  d = d.slice(0, dAt + 19) + fs2.dets + ',\n' + d.slice(dAt + 19);
}
// the army: replacing the one with this id, else last
const start = d.indexOf("{\n  id:'" + armyId + "',");
if (start >= 0 && REFS) {
  // (only its reference sheets: an earlier run's taken out, this run's last in its units)
  const end = d.indexOf('\n},\n', start); let blk = d.slice(start, end);
  for (const id of refIds) { const i = blk.indexOf("\n    {\n      id:'" + id + "',"); if (i < 0) continue; const j = blk.indexOf('\n    }', i + 1); blk = blk.slice(0, i) + blk.slice(j + 6).replace(/^,/, ''); blk = blk.replace(/,(\n  \])$/, '$1'); }
  const ue = blk.lastIndexOf('\n  ]');
  blk = blk.slice(0, ue).replace(/\s*$/, '') + ',\n' + refUnits.map(u => { const v = Object.assign({}, u); delete v._at; return unitSrc(v); }).join(',\n') + blk.slice(ue);
  d = d.slice(0, start) + blk + d.slice(end);
}
else if (start >= 0) { const end = d.indexOf('\n},\n', start); d = d.slice(0, start) + armySrc() + d.slice(end + 4); }
else { const at = d.indexOf('const ARMIES = [\n'), end = d.indexOf('\n];', at); d = d.slice(0, end + 1) + armySrc() + d.slice(end + 1); }
fs.writeFileSync(DATA, d);
// verify/sources/factions.json and the Wahapedia datasheets list
if (newFactionEntry) want('faction', 'verify/sources/factions.json entry', 'add ' + factionId + ' (waha, bsdata ' + catName + ', pack) by hand: which GW document is the faction’s is a judgement');
const dsList = path.join(ROOT, 'verify/sources/waha-datasheets.txt');
const listed = new Set(fs.readFileSync(dsList, 'utf8').split('\n').map(l => l.trim().toLowerCase()).filter(Boolean));
const newDs = [...dsWant].filter(l => !listed.has(l.toLowerCase()));
if (newDs.length) { fs.appendFileSync(dsList, newDs.join('\n') + '\n'); filled.push({ what: 'verify/sources/waha-datasheets.txt: ' + newDs.join(', '), from: 'the units’ names (Wahapedia addresses as the faction page links them)' }); }

// labels: derive.js on what is now in data.js; written where it derives one, listed where it cannot
D = loadD();
const derive = require('./derive');
const items = derive.derive(D);
const mineWhere = it => it.where.startsWith(armyId + ' · ') || (Object.keys(facSrc.detachments).some(id => it.where.startsWith(D.factions[factionId].name + ' · ' + facSrc.detachments[id].name + ' ')) ) || (!F && it.where.startsWith(D.factions[factionId].name + ' '));
const labels = items.filter(it => !it.coverage && mineWhere(it) && (!REFS || refNames.has(String(it.where.split(' · ')[1] || '').replace(/ \[.*\]$/, ''))));
d = fs.readFileSync(DATA, 'utf8');
const setIn = (needle, from, ins) => { const i = d.indexOf(needle, from); if (i < 0) return -1; d = d.slice(0, i + needle.length) + ins + d.slice(i + needle.length); return i; };
const lab = x => { const o = {}; if (x.at) o.at = x.at; if (x.ph && x.ph.length) { o.ph = x.ph; o.turn = x.turn; } if (x.turns) o.turns = x.turns; return o; };
const litKV = o => Object.entries(o).map(([k, v]) => k + ':' + lit(v)).join(', ');
const aStart = () => d.indexOf("{\n  id:'" + armyId + "',");
// an ability of the list: its unit entry and where its row starts in data.js
const abAt = it => {
  const [, uName, ...rest] = it.where.split(' · '); const abName = rest[rest.length - 1].replace(/ #\d+$/, '');
  const u = D.armies.find(a => a.id === armyId).units.find(x => x.name === uName.replace(/ \[.*\]$/, '') && (!/\[/.test(uName) || x.id === /\[(.*)\]/.exec(uName)[1]));
  if (!u) return null;
  const us = d.indexOf("      id:'" + u.id + "',", aStart());
  // (in its abilities: a model row of the same name, the Technomancer's "Technomancer" ability, comes first in its stats)
  return { u, abName, ai: d.indexOf("{ name:" + lit(abName), d.indexOf('      abilities:[', us)) };
};
for (const it of labels) {
  // (an ability of a datasheet row another list has: its labels are the row's, kept as they are)
  if ((it.kind === 'ability-timing' || it.kind === 'ability-tag') && reusedAbs.has(it.where.split(' · ').slice(1).join(' · ').replace(/ #\d+$/, ''))) continue;
  // a timing label comes from verify/derive.js only: where its reading is not the signed-off one (verify/derive-unread.json), no label
  if (it.status === 'unread') { filled.push({ what: 'no timing label ' + it.where, from: 'not read by the program (verify/derive-unread.json): it reads ' + JSON.stringify(it.derived) }); continue; }
  // a stratagem's needs written by hand (verify/sources/hand/<army>.json gists.<id>.needs) where derive.js reads none from its TARGET
  // ("Your NECRONS WARLORD"; "TRIARCH PRAETORIANS", a keyword no unit of the lists has)
  if (it.kind === 'strat-needs' && (it.status === 'not-derivable' || it.derived == null)) {
    const sName = it.where.split(' · ').pop(), hg = Object.entries(HAND.gists || {}).find(([k, v]) => v.needs && k.split('/').pop() === slug(sName));
    const si = hg ? d.indexOf("name:" + lit(sName) + ", cp:") : -1;
    if (si >= 0) { const ci = d.indexOf(" when:'", si); d = d.slice(0, ci) + ' needs:' + lit(hg[1].needs) + ',' + d.slice(ci); handDone.push({ what: 'needs of ' + sName + ': ' + JSON.stringify(hg[1].needs), by: 'hand (Claude)', text: hg[1].needsWhy || '' }); continue; }
  }
  if (it.status === 'not-derivable' || it.derived == null) {
    if (it.kind === 'ability-tag') continue;   // the tag the source names ("(Aura)" in BSData's name, Wahapedia's "(Once per battle, per army)") is kept
    want(it.where, it.kind.replace('-', ' '), 'derive.js has no rule that gives it from the words: left out (no label)'); continue;
  }
  if (it.kind === 'ability-timing') {
    // (a Damaged band, an always-on protection, a text opening "Each time an enemy unit … targets this model": verify/derive.js reads
    // no label for them, label-damaged and label-no-defence)
    const o = lab(it.derived); if (!Object.keys(o).length) continue;
    const [, uName, ...rest] = it.where.split(' · '); const abName = rest[rest.length - 1].replace(/ #\d+$/, '');
    const u = D.armies.find(a => a.id === armyId).units.find(x => x.name === uName.replace(/ \[.*\]$/, '') && (!/\[/.test(uName) || x.id === /\[(.*)\]/.exec(uName)[1]));
    const us = d.indexOf("      id:'" + u.id + "',", aStart());
    const ai = d.indexOf("{ name:" + lit(abName), d.indexOf('      abilities:[', us));
    const after = d.indexOf(', ', ai + 8 + lit(abName).length) ;
    // after name (and who, tag): insert the labels before text
    // (before its When targeted line when it has one: data.js's order is ph, turn, turns, def, text)
    const ti0 = d.indexOf(" text:'", ai), cand = [" note:'", " def:'"].map(x => d.indexOf(x, ai)).filter(x => x >= 0 && x < ti0), ti = cand.length ? Math.min(...cand) : ti0;
    d = d.slice(0, ti) + ' ' + litKV(o) + ',' + d.slice(ti);
    filled.push({ what: 'label ' + it.where + ': ' + JSON.stringify(o), from: 'verify/derive.js ' + (it.reasons || []).map(r => r.rule).join(', ') });
  } else if (it.kind === 'ability-tag') {
    if (it.status === 'identical') continue;
    // a tag the words give ("Once per battle, at the start of any phase, …") where the source prints none: the derived tag, as the
    // approved lists store an untagged once-per-battle ability
    if (it.stored == null && it.derived) {
      const at = abAt(it); if (!at || at.ai < 0) continue;
      const end = d.indexOf(' }', at.ai), row = d.slice(at.ai, end), wm = /^\{ name:'(?:[^'\\]|\\.)*',(?: who:'(?:[^'\\]|\\.)*',)?/.exec(row);
      if (!wm || /\btag:'/.test(row)) continue;
      d = d.slice(0, at.ai + wm[0].length) + ' tag:' + lit(it.derived) + ',' + d.slice(at.ai + wm[0].length);
      filled.push({ what: 'tag ' + it.where + ': ' + it.derived, from: 'verify/derive.js ' + (it.reasons || []).map(r => r.rule).join(', ') + ' (the source prints no tag)' });
      continue;
    }
    // an enhancement whose words add a limit after its "… model only." restriction ("Once per turn, just after making a Hit roll …",
    // Pledge of Unholy Fortune): the export's "Enhancement" and the limit, as the approved lists store Necromechanic's
    // "Enhancement · Once per battle round" (review result-derive.json 209e61b314704242)
    { const parts = String(it.derived || '').split(/\s*[,·]\s*/), lim = parts.filter(x => /^Once per /i.test(x));
      if (it.stored === 'Enhancement' && parts[0] === 'Enhancement' && lim.length === 1 && parts.length === 2) {
        const at = abAt(it), row = at && at.ai >= 0 ? d.slice(at.ai, d.indexOf(' }', at.ai)) : '';
        if (row.includes("tag:'Enhancement',")) { const k = at.ai + row.indexOf("tag:'Enhancement',"); d = d.slice(0, k) + "tag:" + lit('Enhancement · ' + lim[0]) + ',' + d.slice(k + "tag:'Enhancement',".length);
          filled.push({ what: 'tag ' + it.where + ': Enhancement · ' + lim[0], from: 'verify/derive.js ' + (it.reasons || []).map(r => r.rule).join(', ') + ' (the limit after its “model only.”, as Necromechanic’s)' }); continue; }
      } }
    want(it.where, 'ability tag', 'derive.js gives ' + it.derived + ', the export ' + JSON.stringify(it.stored) + ': kept as the export has it');
  } else if (it.kind === 'strat-timing' || it.kind === 'strat-needs') {
    const sName = it.where.split(' · ').pop();
    const si = d.indexOf("name:" + lit(sName) + ", cp:");
    if (si < 0) continue;
    if (it.kind === 'strat-timing') { const o = it.derived; const ins = ' phases:' + lit(o.ph) + ', turn:' + lit(o.turn) + (o.turns ? ', turns:' + lit(o.turns) : '') + ','; const ci = d.indexOf(',', d.indexOf('cp:', si)); d = d.slice(0, ci + 1) + ins + d.slice(ci + 1); }
    else { const ci = d.indexOf(" when:'", si); d = d.slice(0, ci) + ' needs:' + lit(it.derived) + ',' + d.slice(ci); }
    filled.push({ what: 'label ' + it.where + ' ' + it.kind + ': ' + JSON.stringify(it.derived), from: 'verify/derive.js ' + (it.reasons || []).map(r => r.rule).join(', ') });
  } else if (it.kind === 'rule-timing' || it.kind === 'rule-needs') {
    const rName = it.where.split(' · ').pop().replace(/^.* rule · /, '');
    const ri = d.indexOf("{ name:" + lit(rName) + ",", d.indexOf("const FACTIONS = {"));
    if (ri < 0) continue;
    const ins = it.kind === 'rule-timing' ? litKV(lab(it.derived)) : 'needs:' + lit(it.derived);
    if (!ins) continue;
    const after = ri + 7 + lit(rName).length;   // just after "{ name:'…'"
    d = d.slice(0, after) + ', ' + ins + d.slice(after);
    filled.push({ what: 'label ' + it.where + ' ' + it.kind + ': ' + JSON.stringify(it.derived), from: 'verify/derive.js ' + (it.reasons || []).map(r => r.rule).join(', ') });
  }
}
fs.writeFileSync(DATA, d);
// the "+" marks from BSData's modifiers, as verify/import-nr.js does
spawnSync(process.execPath, [path.join(ROOT, 'verify/bsdata.js')], { cwd: ROOT, encoding: 'utf8' });
const g = spawnSync(process.execPath, [path.join(ROOT, 'verify/write-grants.js')], { cwd: ROOT, encoding: 'utf8' });
filled.push({ what: '"+" marks: ' + (g.stdout || g.stderr).trim(), from: 'verify/bsdata.js grants (BSData modifiers), verify/write-grants.js' });
// ---------------------------------------------------------------- deviations: GW's value where BSData at the pin differs
// verify/bsdata.js rebuilds the list from BSData at the pin; each difference it finds where the app has GW's value (the
// comparisons above) is declared in verify/deviations-bsdata.json with the datasheet's words as evidence; any other
// difference stays a failure for a person to look at
// (this run's deviations replace the ones an earlier run wrote: those are taken out first, so verify/bsdata.js reports every difference)
const DEVF = path.join(ROOT, 'verify/deviations-bsdata.json');
const ours = x => x.army === armyId && x.by === 'verify/from-json.js' && (!REFS || refIds.has(x.unit));
const devList = JSON.parse(fs.readFileSync(DEVF, 'utf8')).filter(x => !ours(x));
fs.writeFileSync(DEVF, JSON.stringify(devList, null, 1) + '\n');
{ const NRDEVF0 = path.join(ROOT, 'verify/deviations-nr.json'); fs.writeFileSync(NRDEVF0, JSON.stringify(JSON.parse(fs.readFileSync(NRDEVF0, 'utf8')).filter(x => !ours(x)), null, 1) + '\n'); }
const B = spawnSync(process.execPath, [path.join(ROOT, 'verify/bsdata.js')], { cwd: ROOT, encoding: 'utf8' });
if (!/^bsdata: /.test(B.stdout || '')) { console.error('verify/bsdata.js did not run:\n' + (B.stderr || B.stdout)); process.exit(1); }
const fails = (JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/out/bsdata.json'), 'utf8')).failures || []).filter(f => f.army === armyId && (!REFS || refIds.has(f.unit)));
const EXP = 'verify/sources/nr-json/' + path.basename(srcFile), expRev = FORCE.catalogueRevision;
const pinS = 'BSData at the pin (' + catName + ' catalogue revision ' + PIN_REV + ')', expS = 'New Recruit’s export (catalogue revision ' + expRev + ')';
const clip = (t, n) => { t = nm(String(t || '').replace(/\*\*/g, '')); return t.length > (n || 160) ? t.slice(0, n || 160) + '…' : t; };
const stillFailing = [];
for (const f of fails) {
  let reason = null, evidence = null, m;
  const u = units.find(x => x.id === f.unit) || {}, G = gwRules.get(f.unit) || { core: [], army: [], leader: [], files: [] };
  if ((m = /^(ranged|melee|stats)\.(\w+)$/.exec(f.field))) {
    // "Name (who): value", the value can hold ": " itself ("SUSTAINED HITS 1: NON-MONSTER/VEHICLE"); a stats row's "×N" is its count
    const cut = m[2] === 'kw' ? (/^(.*?\)|[^:(]*?)(?:: )(.*)$/.exec(f.app) || [null, f.app, '']) : [null, f.app.slice(0, f.app.lastIndexOf(': ')), f.app.slice(f.app.lastIndexOf(': ') + 2)];
    const name = cut[1].replace(/ \([^)]*\)$/, '').replace(/ ×\d+$/, ''), val = cut[2];
    // (a row whose name ends in a bracket of its own, "Blue/Brimstone Horror (ref. only)", by its whole name first)
    const name0 = cut[1].replace(/ ×\d+$/, '');
    const fact = gwFacts.get(f.unit + '|' + m[1] + '|' + nm(name0) + '|' + m[2]) || gwFacts.get(f.unit + '|' + m[1] + '|' + nm(name) + '|' + m[2]) || (m[2] === 'hunter' ? gwFacts.get(f.unit + '|' + m[1] + '|' + nm(name.replace(/^.* - /, '')) + '|hunter') : null);
    // (keywords in any order: verify/bsdata.js lists them sorted, GW's datasheet in its own order)
    const kwSet = x => m[2] === 'kw' ? gwN(x).split(/\s*,\s*/).sort().join(', ') : gwN(x);
    if (fact && (kwSet(val) === kwSet(fact.gw) || (fact.app && kwSet(val) === kwSet(fact.app)))) {
      reason = m[2] === 'hunter' ? 'The app marks ' + name + ' as a Hunter profile: ' + fact.src + '. ' + pinS + ' and ' + expS + ' name it "' + fact.nr + '", which verify/bsdata.js does not read as a Hunter profile ("… (Hunter: …)"). GW wins.'
        : pinS + ' has ' + f.source + '; ' + (fact.src || 'GW’s datasheet (the new codex, as Wahapedia transcribes it)') + ' has ' + fact.gw + (gwN(fact.nr) === gwN(fact.gw) ? ', as ' + expS + ' does' : '; ' + expS + ' has ' + fact.nr) + '. GW wins.';
      evidence = (fact.src ? fact.file : fact.file + ': ' + name + ' ' + m[2] + ' ' + fact.gw) + '; ' + EXP + ': ' + fact.nr + '.';
    }
    // (and its reason, "InSv ← Soul Forge Boons", which BSData's modifiers do not give either)
    const hs = !fact && m[1] === 'stats' && handStats.find(x => x.unit === f.unit && x.row === name && (m[2] === 'from' ? x.from && val === x.field + ' ← ' + x.from : x.field === m[2] && gwN(x.value) === gwN(val)));
    if (hs) { reason = hs.why + ' ' + pinS + ' and ' + expS + ' do not give it. GW wins.'; evidence = hs.evidence; }
  } else if (f.field === 'ability.text' || f.field === 'ability') {
    const name = f.field === 'ability' ? (f.app || f.source) : f.app.slice(0, f.app.indexOf(': '));
    // (verify/bsdata.js names a BSData ability with its tag: "[Psychic Abilities] - Shrouding (Psychic Level 1)")
    const untag = n => String(n || '').replace(/\s*\([^()]*\)$/, '');
    const rec = devs.find(x => x.unit === f.unit && (x.name === name || x.bsdata === name || (x.bsdata && typo(x.bsdata) === typo(untag(name)))) && (f.field === 'ability' ? x.field === 'ability' : x.field === 'ability.text'));
    if (rec) {
      reason = (f.field === 'ability' ? (rec.bsdata == null ? 'GW’s datasheet prints the ability ' + rec.app + ' (a box of its own); ' + pinS + ' and ' + expS + ' do not have it' : rec.app == null ? 'GW’s datasheet does not print the ability ' + rec.bsdata + '; ' + pinS + ' and ' + expS + ' have it, so the app leaves it out' : 'GW names the ability ' + rec.app + ', ' + pinS + ' ' + rec.bsdata) : 'The app has GW’s words: ' + rec.why + ' (' + pinS + ' has its own wording' + (textEq(rec.app, rec.bsdata) ? '' : '; ' + expS + ' has "' + clip(rec.bsdata, 120) + '"') + ')') + '. GW wins.';
      evidence = f.field === 'ability' && rec.app == null ? rec.file + ': no ability ' + rec.bsdata + ' among its abilities and boxes.' : rec.file + ': "' + (f.field === 'ability' ? rec.app : clip(rec.app, 240)) + '".';
    }
  } else if (f.field === 'ability.tag') {
    // (a tag BSData gives that GW's datasheet does not print: "One Head Looks Back (Aura)", GW's One Head Looks Back)
    const rec = devs.find(x => x.unit === f.unit && x.field === 'ability.tag' && typo(String(f.source || '')) === typo(x.name + ' (' + x.bsdata + ')'));
    if (rec) { reason = 'GW’s datasheet prints ' + rec.name + ' without a tag (no "(' + rec.bsdata + ')"); ' + pinS + ' and ' + expS + ' name it "' + rec.name + ' (' + rec.bsdata + ')". Only what GW tags (Aura) is an aura (Core Rules 22.01). GW wins.'; evidence = rec.file + ': "' + rec.name + ':" (no tag).'; }
  } else if (f.field === 'rules') {
    const extra = f.app, missing = !f.app ? f.source : null, gw = G.core.concat(G.army).map(typo);
    if (extra && gw.some(x => lc(x) === lc(extra))) { reason = 'GW’s datasheet prints ' + extra + ' (CORE ABILITIES / ARMY RULES); ' + pinS + ' does not give the unit it' + (u.rules && u.rules.includes(extra) ? '' : '') + '. GW wins.'; evidence = G.files.join(', ') + ': "' + G.core.concat(G.army).join(', ') + '".'; }
    const allyR = missing && (G.allyArmy || []).find(x => lc(x) === lc(typo(missing)));
    if (allyR) { reason = pinS + ' gives the unit ' + missing + ', the army rule of its own faction (' + G.ally + '; GW’s datasheet prints it under ARMY RULES); the unit is an ally in a ' + D.factions[factionId].name + ' army, and the owner’s ruling is that a unit taken as an ally or agent does not get its own faction’s army rule (as the Nurglings in Chaos Knights lists have no Shadow of Chaos).'; evidence = G.files.join(', ') + ': ARMY RULES "' + G.allyArmy.join(', ') + '".'; }
    else if (missing && !gw.some(x => lc(x) === lc(typo(missing)))) { reason = pinS + ' gives the unit ' + missing + '; GW’s datasheet does not print it (' + expS + (u._exportRules && u._exportRules.some(x => lc(x) === lc(typo(missing))) ? ' has it too' : ' does not have it either') + '). GW wins.'; evidence = G.files.join(', ') + ': CORE ABILITIES / ARMY RULES "' + G.core.concat(G.army).join(', ') + '".'; }
  } else if (f.field === 'kw') {
    const rec = gwDevs.find(x => x.unit === f.unit && x.kind === 'kw' && x.app === f.app), hk = handKw.find(x => x.unit === f.unit && x.kw === f.app);
    if (hk) { reason = hk.why + ' ' + pinS + ' and ' + expS + ' do not give it. GW wins.'; evidence = hk.evidence; }
    else if (rec) { reason = 'GW’s datasheet has the keyword ' + rec.app.toUpperCase() + '; ' + pinS + ' and ' + expS + ' do not. GW wins.'; evidence = 'verify/.cache/waha/ds/' + rec.file + ': KEYWORDS.'; }
    else {
      // a keyword GW's datasheet prints that the export has (a newer catalogue) and the pin does not (FRAME), or a category the pin
      // gives that GW's datasheet does not print (a "Plasma" category of a wargear entry)
      const ds = (u._partNames || []).map(n => wahaDs(n)).filter(x => x && x.ds);
      const printed = ds.flatMap(x => x.ds.keywords.concat(x.ds.factionKeywords, Object.values(x.ds.modelKeywords || {}).flat())).map(gwKw);
      const files = ds.map(x => 'verify/.cache/waha/ds/' + x.file).join(', ');
      if (f.app && printed.includes(gwKw(f.app))) { reason = 'GW’s datasheet has the keyword ' + gwKw(f.app) + (u._exportKw && u._exportKw.includes(f.app) ? ', as ' + expS + ' does' : '') + '; ' + pinS + ' does not. GW wins.'; evidence = files + ': KEYWORDS.'; }
      else if (!f.app && f.source && ds.length && !printed.includes(gwKw(f.source))) { reason = pinS + ' gives the unit the category ' + f.source + (u._exportKw && !u._exportKw.includes(f.source) ? ' (' + expS + ' does not)' : '') + '; GW’s datasheet does not print that keyword. GW wins.'; evidence = files + ': KEYWORDS (no ' + gwKw(f.source) + ').'; }
    }
  } else if (f.field === 'leads') {
    if (G.leader.some(x => lc(x) === lc(f.app))) { reason = 'GW’s datasheet lets this model lead ' + f.app + '; the Leader text of ' + pinS + ' is the previous codex’s list. GW wins (' + expS + ' has GW’s list).'; evidence = G.files[0] + ': LEADER "This model can be attached to the following units: ' + G.leader.join(', ') + '".'; }
  }
  if (reason) devList.push({ army: f.army, unit: f.unit, field: f.field, app: f.app, source: f.source, reason, evidence, by: 'verify/from-json.js' });
  else stillFailing.push(f);
}
for (const x of REFS ? [] : dispDevs) devList.push({ army: armyId, faction: factionId, detachment: x.detachment, field: 'dispositions', app: x.app, source: null,
  reason: 'BSData at the pin has no Force Disposition for ' + x.detachment + ' (its entry is the unfinished "' + x.detachment + ' (ITS NOT READY)", with no disposition marker); the Wahapedia faction page (the codex) marks the detachment ' + x.app.join(', ') + (/Disruption/.test(x.app.join()) ? ', as New Recruit’s export does (its category "Disruption")' : '') + '. GW wins.',
  evidence: 'verify/.cache/waha/' + factionId + '.html, ' + x.detachment + ': "Force Disposition: ' + x.app.join('", "Force Disposition: ') + '"; ' + EXP + ': Detachment › ' + x.detachment + ' categories.', by: 'verify/from-json.js' });
fs.writeFileSync(DEVF, JSON.stringify(devList, null, 1) + '\n');
// and what verify/nr.js checks against the export itself (New Recruit's base sizes)
spawnSync(process.execPath, [path.join(ROOT, 'verify/nr.js'), '--quiet'], { cwd: ROOT, encoding: 'utf8' });
const NRDEVF = path.join(ROOT, 'verify/deviations-nr.json');
const nrDevs = JSON.parse(fs.readFileSync(NRDEVF, 'utf8')).filter(x => !ours(x));
for (const f of (JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/out/nr.json'), 'utf8')).failures || []).filter(f => f.army === armyId && (!REFS || refIds.has(f.unit)))) {
  const m = /^stats\[(.*)\]\.base$/.exec(f.field), fact = m && gwFacts.get(f.unit + '|stats|' + nm(m[1]) + '|base');
  const nrRule = f.field === 'rules' || /^rules\b/.test(f.field) ? devs.find(x => x.kind === 'nr' && x.unit === f.unit && x.field === 'rules' && (x.name === f.source || String(f.source || '').includes(x.name))) : null;
  // (an allied unit's own faction's army rule, which New Recruit's Rules line has: left out, the reason as in deviations-bsdata.json)
  const allyRule = f.field === 'rules' || /^rules\b/.test(f.field) ? devs.find(x => x.kind === 'ally' && x.unit === f.unit && (x.name === f.source || String(f.source || '').includes(x.name))) : null;
  if (allyRule) { nrDevs.push({ army: f.army, unit: f.unit, field: f.field, app: f.app, source: f.source, reason: expS + ' lists ' + allyRule.name + ' on the Rules line; ' + allyRule.why + ' (the owner’s ruling: a unit taken as an ally or agent does not get its own faction’s army rule, as the Nurglings in Chaos Knights lists have no Shadow of Chaos).', evidence: allyRule.file + ': ARMY RULES "' + allyRule.name + '"; ' + EXP + ': rule ' + allyRule.name + '.', by: 'verify/from-json.js' }); continue; }
  if (nrRule) { nrDevs.push({ army: f.army, unit: f.unit, field: f.field, app: f.app, source: f.source, reason: expS + ' lists ' + nrRule.name + ' on the Rules line; ' + nrRule.why + ', so the app leaves it off the Rules line (its When targeted line keeps the condition; GW’s datasheet does not print it among CORE ABILITIES). GW wins.', evidence: nrRule.file + '; ' + EXP + ': rule ' + nrRule.name + '.', by: 'verify/from-json.js' }); continue; }
  if (fact && gwN(fact.gw) === gwN(f.app)) nrDevs.push({ army: f.army, unit: f.unit, field: f.field, app: f.app, source: f.source, reason: expS + ' gives the base as ' + f.source + '; ' + fact.src + ' has ' + fact.gw + '. GW wins (base sizes too).', evidence: fact.file + '; ' + EXP + ': Base ' + f.source + '.', by: 'verify/from-json.js' });
  else want(f.unit + ' ' + f.field, 'verify/nr.js: app ' + JSON.stringify(f.app) + ', export ' + JSON.stringify(f.source), 'no GW evidence from this run: look at it by hand');
}
fs.writeFileSync(NRDEVF, JSON.stringify(nrDevs, null, 1) + '\n');
const dn = devList.filter(x => x.army === armyId && x.by === 'verify/from-json.js').length;
filled.push({ what: dn + ' deviations from BSData at the pin declared in verify/deviations-bsdata.json (GW’s value, with the datasheet as evidence)', from: 'verify/bsdata.js failures matched to this run’s comparisons with Wahapedia' });
for (const f of stillFailing) want(f.unit + ' ' + f.field, 'verify/bsdata.js: app ' + JSON.stringify(f.app) + ', BSData ' + JSON.stringify(f.source), 'no GW evidence from this run: look at it by hand');
// the "+" marks again, now that BSData's list resolves (a mark is BSData's modifier, not a deviation)
spawnSync(process.execPath, [path.join(ROOT, 'verify/write-grants.js')], { cwd: ROOT, encoding: 'utf8' });
// the in-app import's BSData id table (so the export imports to this list) and the pinned BSData extract
for (const args of [['verify/import-ids.js', '--write'], ['verify/bsdata.js', '--write-extract']]) {
  const r = spawnSync(process.execPath, args.map((x, i) => i ? x : path.join(ROOT, x)), { cwd: ROOT, encoding: 'utf8' });
  filled.push({ what: (r.stdout || r.stderr).trim().split('\n')[0], from: args.join(' ') });
}
// the list was written in full (the old form): its units become references to their datasheets (DATASHEETS), as
// verify/import-nr.js does; new datasheets are added, ones another list has are shared
{
  const t = spawnSync(process.execPath, [path.join(ROOT, 'verify/tables.js'), '--write'], { cwd: ROOT, encoding: 'utf8' });
  filled.push({ what: 'table form: ' + (t.stdout || t.stderr).trim().split('\n')[0], from: 'verify/tables.js --write' });
  // (and once more through the old form: the key order of the lists' objects, TABLE_ORDER, is then the one --expand/--write keeps)
  for (const a of ['--expand', '--write']) spawnSync(process.execPath, [path.join(ROOT, 'verify/tables.js'), a], { cwd: ROOT, encoding: 'utf8' });
}
fs.writeFileSync(path.join(ROOT, 'verify/out/from-json-' + armyId + '.md'), report());
fs.writeFileSync(path.join(ROOT, 'verify/out/from-json-' + armyId + '.json'), JSON.stringify({ todo, filled, devs, modified: bsChecked.modified, datasheets: [...dsWant] }, null, 1) + '\n');
console.log('wrote ' + armyId + ' into data.js: ' + units.length + ' units; ' + todo.length + ' not filled mechanically (verify/out/from-json-' + armyId + '.md)');
