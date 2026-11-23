#!/usr/bin/env node
/* verify/catalog.js: the gate step catalog. Every faction catalogue (verify/sources/catalog/<faction>.json: every current datasheet
   and detachment of a faction, docs/catalog.md) is checked against GW's datasheets and faction page as Wahapedia transcribes them
   (verify/.cache/waha) and against the lists. BSData is not used (the owner's decision, 22 Nov 2026):
     filter     nothing of Warhammer Legends, Crusade or the Crucible anywhere in a catalogue row or detachment (the owner's standing rule)
     complete   the catalogue's rows are exactly the faction page's datasheet index (verify/waha-catalog.js index): every datasheet of
                the faction's own book that is not marked Warhammer Legends is a row, none extra (another faction's datasheet the page
                lists, an ally's, is none); the faction's detachments in data.js are exactly the page's detachment headings, but for
                the ones the catalogue file names as left out (another game mode's: Boarding Actions) each with its rule
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
                  label    a tag the row has from verify/derive.js's reading of its words ("Once per turn, …"), GW printing none
     nr         the same, for every unit of every list of the faction (each part's rows, as nr.js checked them against the PDF):
                each of its rows is a row of the catalogue with the same values, but for what a rule of the list changes (from)
     composition  a row's models are GW's UNIT COMPOSITION: each "N[-M] <model>" line of the datasheet page is the row's model of that
                name with that minimum and maximum (a group's, where New Recruit counts a model line inside a group; several model
                entries New Recruit keeps for one of GW's lines, "Termagant w/ shardlauncher", together allow GW's numbers)
     options    a row's wargear choices are GW's: every choice is named in the page's UNIT COMPOSITION ("equipped with") or WARGEAR
                OPTIONS, or is a weapon or ability row of the datasheet (which verify/numbers.js and verify/words.js hold to the page);
                everything "equipped with" names is a choice or a row. The limits of a choice (its minimum and maximum) are New
                Recruit's as the catalogue file recorded them, and builder.js holds an export to them; they are not read from GW's
                sentences here
     texts      every ability's words are on the datasheet's Wahapedia page (GW's codex) or GW's Printed Product Updates / Faction
                Pack for it; the row's points are GW's costs on the page (each copy, each unit size, each "per <wargear> N");
                every detachment's rule, enhancement and stratagem words are checked by verify/texts.js as every detachment is
     bases      by verify/bases.js (every DATASHEETS row's models, the catalogue's too)
   A difference of composition or options that is New Recruit's way of holding GW's datasheet is declared in
   verify/deviations-catalog.json ({ datasheet, what, reason, evidence }); a declaration nothing matches fails.
   node verify/catalog.js            the gate (verify/out/catalog.json) */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
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

// { costs:[{ from, to, models:[{ models, pts }] }], wargear:[{ name, pts }] }: per copy of the datasheet in the army (from the from-th
// to the to-th, to null: and every one after), the price of each unit size GW lists ("4 models 45 · 5 models 50 · 9 models 80"), and
// what GW's WARGEAR OPTIONS costs ("per Praesidium Shield 25")
// GW's, from its datasheet (Wahapedia: "YOUR UNIT COSTS", "YOUR 1ST TO 2ND UNITS COST", "YOUR 3RD+ UNIT COSTS", then "N models" / pts)
function gwCosts(lines) {
  const L = lines.map(l => String(l).replace(/\*\*/g, '').replace(/^- /, '').trim()).filter(Boolean);
  const out = { costs: [] }; let cur = null, wg = null;
  for (let i = 0; i < L.length; i++) {
    const h = /^YOUR (?:(\d+)(?:ST|ND|RD|TH)(?: TO (\d+)(?:ST|ND|RD|TH))?(\+)? )?UNITS? COSTS?$/.exec(L[i]);
    if (h) { const from = h[1] ? +h[1] : 1; cur = { from, to: h[2] ? +h[2] : h[3] ? null : h[1] ? from : null, models: [] }; out.costs.push(cur); wg = null; continue; }
    if (!out.costs.length) continue;
    if (L[i] === 'WARGEAR OPTIONS') { wg = out.wargear = []; cur = null; continue; }
    const m = /^(\d+) models?$/.exec(L[i]);
    if (cur && m && /^\d+$/.test(L[i + 1] || '')) { cur.models.push({ models: +m[1], pts: +L[i + 1] }); i++; continue; }
    const w = /^per (.+)$/.exec(L[i]);
    if (wg && w && /^\d+$/.test(L[i + 1] || '')) { wg.push({ name: w[1].trim(), pts: +L[i + 1] }); i++; continue; }
    if (/^[A-Z][A-Z’' ]+[A-Z]$/.test(L[i]) || /^KEYWORDS/.test(L[i])) break;
  }
  return out.costs.length ? out : null;
}
const costsText = c => c.costs.map(g => (g.from === 1 && g.to == null ? 'any copy' : g.to == null ? g.from + '+' : g.from === g.to ? 'copy ' + g.from : g.from + '-' + g.to) + ': ' + g.models.map(x => x.models + ' ' + x.pts).join(' · ')).join('; ') + ((c.wargear || []).length ? '; wargear: ' + c.wargear.map(w => w.name + ' ' + w.pts).join(', ') : '');

// ---------------------------------------------------------------- a DATASHEETS row (or a list's unit) against its catalogue row
const KINDS = ['stats', 'ranged', 'melee', 'abilities'];
// a catalogue row's keywords as GW prints them (verify/gw-order.js: its page's KEYWORDS and FACTION KEYWORDS, its name keyword, its
// Daemonic Allegiance god); null: no page
let GWO_ = null;
const gwKw = R => { const O = GWO_ || (GWO_ = require('./gw-order')(ROOT)); const parts = [{ name:R.name, page:O.pageFor(R.faction, R.name) }]; parts.faction = R.faction;
  const own = O.catalogOwn(R), kw = parts[0].page ? O.gwKeywords(R, parts, own, [R.kw]) : null; return kw ? kw.slice() : null; };
function rowDiffs(S, R, opts) {
  opts = opts || {};
  const out = [], put = (kind, what, data, cat) => out.push({ kind, what, data, cat });
  for (const f of ['name', 'role', 'kw', 'kwOnly', 'bsId']) {
    if (!(f in S)) { if (R[f] !== undefined && !opts.listUnit) put('fill', f, null, R[f]); continue; }
    // (keywords: as a set, against GW's keywords of the catalogue's row, verify/gw-order.js gwKeywords as verify/tables.js --write writes
    // them, in GW's order; verify/keywords.js checks them against GW's page)
    if (f === 'kw' && Array.isArray(S.kw) && Array.isArray(R.kw)) { const want = gwKw(R) || R.kw;
      if (stable(S.kw.map(lc).sort()) !== stable(want.map(lc).sort())) put(opts.listUnit ? 'list' : 'other', f, S[f], want); continue; }
    if (stable(S[f]) !== stable(R[f])) put(opts.listUnit && f !== 'name' ? 'list' : 'other', f, S[f], R[f]);
  }
  if ('rules' in S) {
    const miss = S.rules.filter(r => !(R.rules || []).some(x => lc(x) === lc(r)));
    put(miss.length ? 'other' : stable(S.rules) === stable(R.rules) ? 'same' : 'rules', 'rules', S.rules, R.rules);
  } else if (!opts.listUnit && R.rules) put('fill', 'rules', null, R.rules);
  for (const kind of KINDS) {
    const key = r => kind === 'stats' ? String(r.name).replace(/ ×\d+$/, '') : r.name + (r.group ? ' (' + r.group + ')' : '');
    const b = new Map((R[kind] || []).map(r => [key(r), r]));
    for (const r of S[kind] || []) {
      const c = b.get(key(r));
      if (!c) { put(opts.listUnit && kind === 'abilities' && (/\b(Enhancement|Upgrade)\b/.test(r.tag || '') || (opts.ruleAb || []).includes(r.name)) ? 'list' : 'other', kind + ' ' + key(r) + ': not in the catalogue', r, null); continue; }
      const fields = kind === 'stats' ? ['M', 'T', 'Sv', 'W', 'Ld', 'OC', 'InSv', 'base'] : kind === 'abilities' ? ['tag', 'text'] : ['range', 'A', 'BS', 'WS', 'S', 'AP', 'D', 'kw', 'group', 'fireAll', 'hunter'];
      for (const f of fields) {
        if (stable(r[f]) === stable(c[f])) continue;
        if (r[f] === undefined) { if (!opts.listUnit) put('fill', kind + ' ' + key(r) + ' ' + f, null, c[f]); continue; }
        if (opts.listUnit && r.from && f in r.from) continue;   // a value a rule of the list gives
        if (opts.listUnit && f === 'kw' && r.from) { const own = (r.kw || []).filter(k => !Object.keys(r.from).includes(k)); if (stable(own.map(x => x.toUpperCase()).sort()) === stable((c.kw || []).map(x => x.toUpperCase()).sort())) continue; }
        if (f === 'text' && words(r.text) === words(c.text)) { put('markup', kind + ' ' + key(r) + ' text', r.text, c.text); continue; }
        // (a tag the lists' row has from verify/derive.js's reading of the words, "Once per turn, …", which GW prints with no tag: a label)
        if (f === 'tag' && kind === 'abilities' && r.tag) { const extra = r.tag.split(' · ').filter(t => !String(c.tag || '').split(' · ').includes(t));
          if (extra.length && extra.every(t => /^Once per /i.test(t) && lc(String(r.text || '').replace(/\*\*/g, '')).includes(lc(t.replace(/,.*$/, ''))))) { put('label', kind + ' ' + key(r) + ' tag', r.tag, c.tag); continue; } }
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
  const fails = [], notes = [], checked = { filter: 0, complete: 0, tables: 0, nr: 0, composition: 0, options: 0, texts: 0 };
  const fail = (step, msg) => fails.push(step + ': ' + msg);
  const WC = require('./waha-catalog')(ROOT), { sing } = WC;
  const dir = path.join(ROOT, 'verify/sources/catalog');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort() : [];
  global.window = {}; delete require.cache[path.join(ROOT, 'data.js')]; require(path.join(ROOT, 'data.js')); const D = window.WH_DATA;
  // (the datasheets the lists name: ARMIES as data.js writes it, each unit entry's ds)
  const T = require('./tables'), RAW = T.read(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8')).A.value;
  const listed = new Set(RAW.flatMap(a => a.units.flatMap(u => [].concat(u.ds || []))));
  const DEVCF = path.join(ROOT, 'verify/deviations-catalog.json'), DEVC = fs.existsSync(DEVCF) ? JSON.parse(fs.readFileSync(DEVCF, 'utf8')) : [];
  const usedC = new Set();
  const report = { factions: {} };
  for (const f of files) {
    const cat = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), faction = cat.faction, rep = report.factions[faction] = { datasheets: Object.keys(cat.datasheets).length, detachments: (cat.detachments || []).length, excluded: (cat.excluded || []).length, differences: [] };
    // the owner's standing rule (Legends, Crusade, Crucible: left out, ever): nothing of them anywhere in what the catalogue gives the
    // app, a datasheet, an option, a weapon, an ability or a detachment (only its excluded list names them)
    // (and the names of the entries it left out as Legends, Crucible or Crusade, without their bracket tag: Horticulous Slimux's Leader
    // naming Plague Toads, Tormentbringer's keyword "Tormentbringer On Exalted Seeker Chariot")
    { const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const gone = [...new Set((cat.excluded || []).filter(x => ['legends', 'crucible', 'crusade'].includes(x.kind)).map(x => String(x.name).replace(/\s*\[[^\]]*\]\s*$/, '').trim()).filter(n => n.length > 3))];
      const goneRe = gone.length ? new RegExp('(?<![A-Za-z’\'])(?:' + gone.map(esc).join('|') + ')(?![A-Za-z’\'])', 'gi') : null;
      // (not a part of a longer name, a title-case word after it: "Null Maiden Vigil", the detachment)
      const goneIn = o => { if (!goneRe) return null; goneRe.lastIndex = 0; for (let m; (m = goneRe.exec(o));) if (!/^\s+[A-Z][a-z]/.test(o.slice(m.index + m[0].length))) return m; return null; };
      // (a LEADER list in GW's words may name a Legends datasheet, "the following units: …, CUSTODIAN GUARD SODALITY WITH ADRASITE SPEARS":
      // GW's text is shown, checked by verify/texts.js; the unit is no catalogue row, so it is never offered)
      const leaderText = at => /\.abilities\[\d+\]\.text$/.test(at) && /^This (?:model|unit) can be attached to the following units?:/.test(curText);
      let curText = '';
      const bad = []; const walk = (o, at) => { if (typeof o === 'string') { curText = o; const g = leaderText(at) ? null : goneIn(o); if (/\[(?:Legends|Crucible)\]|\bCrucible\b|\bCrusade\b|\bOrder of Battle\b/i.test(o) || g) bad.push(at + ': ' + (g ? '"' + g[0] + '" (left out) in ' : '') + o.slice(0, 80)); return; }
        if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, at + (Array.isArray(o) ? '[' + k + ']' : '.' + k)); };
      for (const [id, row] of Object.entries(cat.datasheets)) walk(row, id);
      walk(cat.detachments || [], 'detachments'); walk(cat.detachmentRows || {}, 'detachmentRows');
      checked.filter += Object.keys(cat.datasheets).length;
      for (const b of bad) fail('filter', faction + ': Legends, Crusade or Crucible in the catalogue’s rows (left out, ever): ' + b); }
    const WW0 = require('./waha-words')(ROOT, faction), FJ0 = WC.FJ[faction] || {}, F = D.factions[faction] || { name: faction, detachments: {} };
    // complete: the faction page's datasheet index. A datasheet of the faction's own pages that Wahapedia marks with no other book
    // than the faction's (its codex, its Faction Pack or app, Forge World among them) and not Warhammer Legends is a row
    { const own = FJ0.wahaDs || FJ0.waha || faction, I = WC.index(faction);
      const ours = x => x.pageFaction === own && !x.legends && (!x.source || lc(x.source).includes(lc(F.name)));
      const want = I.filter(ours), rowPage = new Map(Object.entries(cat.datasheets).map(([id, r]) => [id, WW0.wahaAddress(r.name)]));
      rep.index = { datasheets: I.length, current: want.length, legends: I.filter(x => x.legends).length, otherBooks: I.filter(x => !x.legends && !ours(x)).length };
      for (const x of want) { checked.complete++; if (![...rowPage.values()].includes(x.page)) fail('complete', faction + ': ' + x.name + ' (Wahapedia ' + own + '/' + x.page + (x.source ? ', ' + x.source : '') + ') is a current datasheet of the faction page’s index and no catalogue row'); }
      for (const [id, pg] of rowPage) if (!want.some(x => x.page === pg)) { const x = I.find(y => y.page === pg); fail('complete', faction + ': ' + id + ' is ' + (x ? (x.legends ? 'Warhammer Legends' : 'another book’s (' + x.source + ')') + ' in the faction page’s index: left out' : 'no datasheet of the faction page’s index (' + pg + ')')); }
      // complete: detachments (each heading of the page a detachment of the faction in data.js, by GW's name; one the catalogue file
      // names as left out, another game mode's, is none)
      const out = new Set((cat.excluded || []).filter(x => /^detachment/.test(x.kind || '')).map(x => lc(typo(x.name))));
      const dets = WC.detachments(faction).filter(d => !out.has(lc(d.name)));
      for (const d of dets) { checked.complete++; if (!Object.values(F.detachments).some(x => lc(x.name) === lc(d.name) || (x.nr && lc(x.nr) === lc(d.name)))) fail('complete', faction + ': the faction page’s detachment ' + d.name + ' is not a detachment of ' + faction + ' in data.js'); }
      for (const [k, x] of Object.entries(F.detachments)) if (!dets.some(d => lc(d.name) === lc(x.name))) fail('complete', faction + ': data.js’s detachment ' + x.name + ' (' + k + ') is no detachment heading of the faction page (or is one the catalogue leaves out)');
      for (const [k, x] of Object.entries(F.detachments)) if (x.aiStatus === 'not-read' && (x.stratagems || []).some(s => s.gist || s.mod)) fail('tables', faction + ': detachment ' + k + ' is marked aiStatus not-read but has AI-written columns: drop the mark once they are read'); }
    // composition and options: GW's UNIT COMPOSITION and WARGEAR OPTIONS (the datasheet page)
    for (const [id, R] of Object.entries(cat.datasheets)) {
      const P = WC.sheet(WW0, R.name, faction); if (!P) continue;   // (no page: texts, below, fails)
      const declared = what => { const dv = DEVC.find(x => x.datasheet === id && x.what === what); if (dv) { usedC.add(dv); if (!dv.reason || !dv.evidence) fail('composition', id + ' · ' + what + ': its declaration has no reason or evidence'); } return !!dv; };
      // composition
      // (New Recruit's entry for one god's choice of a Daemonic Allegiance datasheet, "Khorne Soul Grinder": GW's model of the name without it)
      const god = /^(Khorne|Tzeentch|Nurgle|Slaanesh) /.test(R.name) && !P.models.some(g => sing(g.model) === sing(R.name)) ? /^(?:khorne|tzeentch|nurgle|slaanesh) / : null;
      const C = R.composition || [], base = m => { const b = sing(String(m).replace(/\s+w\/.*$/i, '')); return god ? b.replace(god, '') : b; };
      for (const g of P.models) {
        checked.composition++;
        const exact = C.find(c => base(c.model) === sing(g.model));
        const rng = c => c.groupMin !== undefined ? [c.groupMin, c.groupMax] : [c.min, c.max];
        if (exact && C.filter(c => base(c.model) === sing(g.model)).length === 1) { const [a, b] = rng(exact); if (a === g.min && b === g.max) continue; }
        // (New Recruit's model entries for one of GW's lines, "<model> w/ <weapon>": together they allow GW's numbers)
        const vs = C.filter(c => base(c.model) === sing(g.model));
        if (vs.length > 1 && vs.reduce((t, c) => t + c.min, 0) <= g.min && vs.reduce((t, c) => t + c.max, 0) >= g.max) { rep.differences.push({ id, kind: 'variants', what: 'composition ' + g.model }); continue; }
        if (declared('composition ' + g.model)) continue;
        fail('composition', id + ': GW’s UNIT COMPOSITION has "' + (g.min === g.max ? g.min : g.min + '-' + g.max) + ' ' + g.model + '" (' + P.file + '), the catalogue ' + JSON.stringify(vs.length ? vs : C));
      }
      for (const c of C) if (!P.models.some(g => sing(g.model) === base(c.model)) && !declared('composition ' + c.model)) fail('composition', id + ': the catalogue’s model ' + c.model + ' is no line of GW’s UNIT COMPOSITION (' + P.file + ': ' + JSON.stringify(P.lines.composition.filter(l => /^- /.test(l))) + ')');
      // options
      // (names compared in the singular, apostrophes aside: New Recruit's "Attendant's hellblades" is GW's "attendants’ hellblades"; a name
      // the catalogue file maps to GW's, weaponNames: "Tarsis buckler" is GW's "Tarsus Buckler")
      const WN = cat.weaponNames || {}, gwn = x => { const k = Object.keys(WN).find(y => lc(y) === lc(x)); return k ? WN[k] : x; };
      const sg = x => sing(gwn(x)).replace(/'/g, '');
      const text = sg(P.lines.composition.concat(P.lines.options).join(' ; ')), rowNames = new Set();
      // (a choice an ability of the datasheet names in bold capitals, the god of a Daemonic Allegiance: "**KHORNE**")
      const bold = new Set((R.abilities || []).flatMap(a => [...String(a.text || '').matchAll(/\*\*([A-Z][A-Z’' -]+)\*\*/g)].map(m => sing(m[1]))));
      for (const k of ['ranged', 'melee']) for (const r of R[k] || []) { rowNames.add(sg(r.name)); if (r.group) rowNames.add(sg(r.group)); }
      for (const a of R.abilities || []) rowNames.add(sg(a.name));
      const names = [...new Set((R.options || []).flatMap(o => o.choices.map(c => c.name)))];
      for (const nm0 of names) {
        checked.options++;
        const parts = nm0.split(/\s*(?:&|,|\band\b)\s*/).filter(Boolean);
        if (text.includes(sg(nm0)) || rowNames.has(sg(nm0)) || bold.has(sg(nm0)) || (parts.length > 1 && parts.every(x => text.includes(sg(x)) || rowNames.has(sg(x))))) continue;
        if (declared('option ' + nm0)) continue;
        fail('options', id + ': the choice ' + nm0 + ' is not named in GW’s UNIT COMPOSITION or WARGEAR OPTIONS (' + P.file + ') and is no weapon or ability row of the datasheet');
      }
      const have = new Set(names.flatMap(x => [x].concat(x.split(/\s*(?:&|,|\band\b)\s*/))).map(sg));
      for (const l of P.equipped) for (const it of l.replace(/^.*?equipped with:\s*/i, '').replace(/\.$/, '').split(/\s*;\s*/).map(x => x.replace(/^\d+\s+/, '')).filter(x => x && !/^nothing$/i.test(x))) {
        checked.options++;
        if (have.has(sg(it)) || rowNames.has(sg(it)) || [...have].some(h => h.includes(sg(it))) || [...rowNames].some(h => h.startsWith(sg(it)))) continue;
        if (declared('equipped ' + it)) continue;
        fail('options', id + ': GW’s UNIT COMPOSITION equips ' + it + ' (' + P.file + '), which is no choice, weapon or ability of the catalogue row');
      }
    }
    // tables: every row in DATASHEETS
    for (const [id, R] of Object.entries(cat.datasheets)) {
      checked.tables++;
      const S = (D.datasheets || {})[id];
      if (!S) { fail('tables', id + ': the catalogue row is not in DATASHEETS (node verify/tables.js --write)'); continue; }
      const inList = listed.has(id);
      // (the catalogue's own columns: DATASHEETS has them as the catalogue does, a list's row too)
      for (const f of ['points', 'composition', 'options']) if (stable(S[f]) !== stable(R[f])) fail('tables', id + ' · ' + f + ': DATASHEETS ' + JSON.stringify(S[f]) + ', the catalogue ' + JSON.stringify(R[f]) + ' (node verify/tables.js --write)');
      for (const d of rowDiffs(S, R)) {
        if (d.kind === 'fill' && !inList) { fail('tables', id + ' · ' + d.what + ': DATASHEETS lacks the catalogue’s value'); continue; }
        rep.differences.push({ id, kind: d.kind, what: d.what });
        if (['fill', 'markup', 'tag', 'rules', 'label'].includes(d.kind)) continue;
        const dev = DEVC.find(x => x.datasheet === id && x.what === d.what);
        if (dev) { usedC.add(dev); if (!dev.reason || !dev.evidence) fail('tables', id + ' · ' + d.what + ': its declaration has no reason or evidence'); continue; }
        fail('tables', id + ' · ' + d.what + ': DATASHEETS ' + JSON.stringify(d.data) + ', the catalogue ' + JSON.stringify(d.cat) + ' (settle it at the source, or declare it in verify/deviations-catalog.json)');
      }
      if (!inList && S.aiStatus !== 'not-read') fail('tables', id + ': no list has it and it has no aiStatus "not-read"');
      // (its When targeted lines are its defence boxes, BOXES d, made by script: no reading to be marked)
    }
    // the detachments the catalogue adds: in FACTIONS as the catalogue has them, but for verify/derive.js's labels
    { const F = D.factions[faction] || { detachments: {} }, LAB = ['phases', 'turn', 'turns', 'needs', 'at', 'ph', 'limit'];   // (limit: verify/lines.js L0, from RESTRICTIONS)
      const unlab = x => JSON.parse(JSON.stringify(x, (k, v) => LAB.includes(k) ? undefined : v));
      for (const [id, d] of Object.entries(cat.detachmentRows || {})) {
        checked.tables++;
        const have = F.detachments[id];
        if (!have) { fail('tables', faction + ': the catalogue’s detachment ' + id + ' is not in data.js (node verify/from-waha.js ' + faction + ' --write)'); continue; }
        const h = Object.assign({}, have); delete h.aiStatus;
        if (have.aiStatus !== 'not-read') fail('tables', faction + ': detachment ' + id + ' is the catalogue’s but has no aiStatus "not-read"');
        if (stable(unlab(h)) !== stable(unlab(d))) fail('tables', faction + ': detachment ' + id + ' in data.js is not the catalogue’s (node verify/from-waha.js ' + faction + ' --write)');
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
        // (an ability a rule of the list gives the unit is the list's, as an enhancement's: Protean Purpose, verify/tables.js ruleAbilities)
        const ruleAb = require('../builder.js').ruleAbilitiesOf(require('./tables').ruleAbilitiesFull(D.factions, D.grants, D.ruleOptions, a, D), u.kw, [], u.rules).map(x => x.name);
        for (const d of rowDiffs(S, R, { listUnit: true, ruleAb })) {
          if (['markup', 'tag', 'list', 'label'].includes(d.kind)) continue;
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
      // (the points: GW's costs as the datasheet prints them)
      { const g = gwCosts(WW.markup(pg.tokens, pg.P, 0, pg.P.s.length - 1).split('\n')); checked.texts++;
        if (g && stable(g) !== stable(R.points)) fail('texts', id + ' · points: the catalogue ' + (R.points && R.points.costs ? costsText(R.points) : JSON.stringify(R.points)) + ', GW’s datasheet ' + costsText(g) + ' (' + pg.file + ')'); }
      for (const a of R.abilities || []) {
        checked.texts++;
        const w = a.name === 'Leader' ? words(a.text).replace(/^this model can be attached to the following units /, '') : words(a.text);
        // (words the Faction Pack's Rules Updates gave it when the catalogue was built, packApplied: verify/texts.js checks them against the pack)
        if ((cat.packApplied || []).concat(cat.handApplied || []).some(x => x.id === id && x.field === 'ability[' + a.name + '].text')) continue;
        if (!hay.includes(w)) fail('texts', id + ' · ' + a.name + ': its words are not on ' + pg.file + (pack ? ' nor in ' + pack.file : ''));
      }
    }
  }
  for (const d of DEVC) if (!usedC.has(d)) fail('tables', 'verify/deviations-catalog.json: nothing matches the declaration for ' + d.datasheet + ' · ' + d.what);
  fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'verify/out/catalog.json'), JSON.stringify({ checked, failures: fails, notes, report }, null, 1) + '\n');
  const sum = Object.entries(report.factions).map(([k, v]) => k + ' ' + v.datasheets + ' datasheets, ' + v.detachments + ' detachments, ' + v.excluded + ' left out').join('; ');
  if (fails.length) { console.log('FAIL catalog: ' + fails.length + ' failure(s) (' + sum + ')\n' + fails.slice(0, 60).map(x => ' - ' + x).join('\n')); process.exit(1); }
  console.log('catalog: ' + (sum || 'no catalogues') + '; checked ' + JSON.stringify(checked) + '; ' + usedC.size + ' declared differences used' + (notes.length ? '; ' + notes.join('; ') : ''));
}
module.exports = { rowDiffs, gwCosts, costsText };
if (require.main === module) main();
