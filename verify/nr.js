#!/usr/bin/env node
// verify/nr.js: checks data.js against the owner's five New Recruit list PDFs, both ways.
//
// Source: verify/sources/nr/<armyId>.txt, the `pdftotext -layout` text of each PDF (committed).
// The text keeps the PDF's table layout as columns of characters, so this file parses that layout:
// page headers and footers are dropped, every table is split into its columns by the header row's
// positions, and wrapped cells are put back together by row (a cell's lines are vertically centred
// on its row, so each row's lines are found by centring, see `distribute` and `partitionRows`).
// When this was written, the parse of all five committed texts was cross-checked against an
// independent parse of the original PDFs from word coordinates (pdftotext -bbox): every unit,
// model line, option, stat row, weapon row, ability, Rules and Categories entry came out identical.
// `node verify/nr.js --dump <armyId>` prints the parse.
//
// Usage: node verify/nr.js [--data data.js] [--sources verify/sources/nr] [--out verify/out/nr.json]
//                          [--deviations verify/deviations-nr.json] [--dump <armyId>] [--quiet]
// Exit code: 0 when there are no failures, 1 otherwise (2 when a source cannot be parsed).
//
// The normalisation applied before comparing is listed in NORMALISATION below and in the output.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

const NORMALISATION = [
  'Quotes: ’ ‘ → \' and “ ” → "; non-breaking hyphen (U+2011) → -; × → x (model counts, stat-row counts, base sizes).',
  'Whitespace collapsed. A wrapped cell is rejoined with a space, or with nothing after a line ending in a hyphen glued to a word ("combi-" + "bolter").',
  'App text markup removed before comparing: **bold**, "- " bullets, *italic* lines, line breaks. Text inside **bold** is compared case-insensitively (NR sets keywords in small capitals: its text layer says "World Eaters Infantry" where the page shows WORLD EATERS INFANTRY, as the app does); all other text is compared exactly, case included. NR bullet glyphs are not in the pdftotext text, so bullets are not compared.',
  'Characteristic cells: NR "-", "N/A" and an empty cell are the app\'s "–". Weapon keywords are compared upper-cased (NR prints "Rapid Fire 3" for some factions, the app always "RAPID FIRE 3"), in order.',
  'Weapon names: NR "➤" dropped; "[1]"/"[2]" (NR\'s disambiguation of two same-named weapons) dropped; "(xN)" is the app\'s n; " - <unit>" is the app\'s who; "(Hunter: …)" is hunter:true; "A - B" is group A, profile B; a parenthesis lists the abilities, enhancements and detachment rules already applied to the profile: each name must be one of the names in that weapon\'s `from` marks.',
  'Stat rows: " - <unit>" suffix dropped (stat rows are matched by model name); "(xN)" is the app\'s "×N"; a parenthesis naming what is already applied must be one of the names in that row\'s `from` marks; Base compared as printed.',
  'Models: "Nx Name" is the app\'s "N× Name", compared as an ordered list. Options per model line: "Warlord" is warlord:true, "• Leading: X[n]" is leads X, an item that is one of the faction\'s enhancements is the enhancement; an NR option "Group (a, b)" counts as its weapons a and b and "2x Weapon" as Weapon; the remaining items that are weapons printed in the unit\'s weapon tables are that line\'s gear, compared as a set; an item that is not a printed weapon (wargear, e.g. Icon of Khorne) must be on the app\'s model line as "N× Name (Item)".',
  'Abilities: matched by name and who (" - <unit>" suffix). NR "Name (Tag)" is the app\'s name + tag. The app may add a tag part NR does not print only when it is "Enhancement" on the unit\'s enhancement, the second header of the NR table the ability sits in (e.g. "Capacity"), the first header of a sub-table (e.g. "Crimson King") or words printed in the ability\'s own NR text (e.g. "Once per battle"); the app\'s who may name a sub-table ("Crimson King: pick one").',
  'Categories (kw) compared as a set; NR\'s "*from combined unit" marks must each be named in the app\'s kwNote. Rules line compared as a set (duplicates dropped); an NR rule that is a weapon ability counts as present when one of the unit\'s weapons has that keyword in the app.',
  'Points: header points are the app\'s pts; for an attached unit the roster lines (leader + bodyguard) must be the app\'s ptsNote "L + Bodyguard B". Copies: the "xN" in the unit header and the number of identical roster lines are the app\'s copies.'
];

// ---------------------------------------------------------------- CLI
function parseArgs(argv) {
  const a = { data: path.join(ROOT, 'data.js'), sources: path.join(__dirname, 'sources', 'nr'),
    out: path.join(__dirname, 'out', 'nr.json'), deviations: path.join(__dirname, 'deviations-nr.json'), dump: null, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--quiet') a.quiet = true;
    else if (k.startsWith('--') && i + 1 < argv.length) a[k.slice(2)] = argv[++i];
    else throw new Error('unknown argument ' + k);
  }
  return a;
}

// ---------------------------------------------------------------- small helpers
const q = s => String(s).replace(/[’‘`]/g, "'").replace(/[“”]/g, '"').replace(/\u2011/g, '-').replace(/×/g, 'x');
const ws = s => String(s).replace(/\s+/g, ' ').trim();
const nm = s => ws(q(s));                       // normalised name
const lc = s => nm(s).toLowerCase();
const indentOf = s => s.search(/\S/);
const uniq = a => [...new Set(a)];
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// join the lines of one wrapped cell
function joinLines(parts) {
  let out = '';
  for (const p0 of parts) {
    const p = p0.trim();
    if (!p) continue;
    if (!out) out = p;
    else if (/\S-$/.test(out) && !/\s-$/.test(out)) out += p;   // "combi-" + "bolter"
    else out += ' ' + p;
  }
  return out;
}

// words of a line with their start columns
function words(line) {
  const out = []; const re = /\S+/g; let m;
  while ((m = re.exec(line))) out.push({ w: m[0], s: m.index, e: m.index + m[0].length });
  return out;
}

// Split a line into its left cell and right cell. The right cell starts at the first word that
// begins at or after column `col` (or after a gap of `gap` spaces, when gap is given and the word
// begins at or after `minCol`).
function splitAt(line, col, opts = {}) {
  const ws_ = words(line);
  let k = -1;
  for (let i = 0; i < ws_.length; i++) {
    if (ws_[i].s >= col) { k = i; break; }
    if (opts.gap && i > 0 && ws_[i].s - ws_[i - 1].e >= opts.gap && ws_[i].s >= (opts.minCol || 0)) { k = i; break; }
  }
  if (k === -1) return { L: line.trim(), R: '' };
  if (k === 0) return { L: '', R: line.trim() };
  return { L: line.slice(0, ws_[k].s).trim(), R: line.slice(ws_[k].s).trim() };
}

// ---------------------------------------------------------------- row assembly by centring
// Each row r has a centre (the line index its cells are centred on) and `own` lines (lines of the
// cell being assembled that certainly belong to it, e.g. the name on a weapon's values line).
// `items` (line indices, ascending) are given to the rows in order, each row taking a contiguous
// run, so that each row's cell (own + run) is centred on the row and reads as one plausible cell
// (`penalty(r, run)`). Returns, per row, the items it takes.
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
function distribute(anchors, items, opts = {}) {
  const emptyCost = opts.emptyCost === undefined ? 1 : opts.emptyCost, penalty = opts.penalty;
  const R = anchors.length, K = items.length;
  const cost = (r, i, j) => {           // row r takes items[i..j)
    if (i < j) {
      if (r > 0 && items[i] < anchors[r - 1].centre) return Infinity;
      if (r < R - 1 && items[j - 1] > anchors[r + 1].centre) return Infinity;
    }
    const idx = [...anchors[r].own, ...items.slice(i, j)];
    const c = idx.length ? Math.abs(mean(idx) - anchors[r].centre) : emptyCost;
    return penalty ? c + penalty(r, items.slice(i, j)) : c;
  };
  const D = Array.from({ length: R + 1 }, () => new Array(K + 1).fill(Infinity));
  const B = Array.from({ length: R + 1 }, () => new Array(K + 1).fill(-1));
  D[0][0] = 0;
  for (let r = 1; r <= R; r++)
    for (let j = 0; j <= K; j++)
      for (let i = 0; i <= j; i++) {
        if (D[r - 1][i] === Infinity) continue;
        const c = D[r - 1][i] + cost(r - 1, i, j);
        if (c < D[r][j] - 1e-9) { D[r][j] = c; B[r][j] = i; }
      }
  if (D[R][K] === Infinity) throw new Error('cannot assign wrapped lines to rows (lines ' + items.join(',') + ')');
  const out = new Array(R);
  let j = K;
  for (let r = R; r >= 1; r--) { const i = B[r][j]; out[r - 1] = items.slice(i, j); j = i; }
  return out;
}
// the text of a cell from its pieces {i, t}, in line order
const cellText = pieces => joinLines([...pieces].sort((a, b) => a.i - b.i).map(x => x.t));

// Plausibility of a reassembled cell, used as a penalty when rows are assembled:
// parentheses balance, a "➤" only starts a cell, a cell does not end on a comma or a hyphen, and
// in an attached unit a weapon or ability name ends with " - <the unit it belongs to>".
const balanced = t => { let d = 0; for (const ch of t) { if (ch === '(') d++; if (ch === ')') d--; if (d < 0) return false; } return d === 0; };
function cellPenalty(text, opts = {}) {
  if (!text) return opts.required ? 5 : 0;
  let p = 0;
  if (!balanced(text)) p += 5;
  if (/.\s*➤/.test(text)) p += 5;
  if (/[,-]$/.test(text)) p += 3;
  if (opts.who && opts.who.length && !opts.who.some(w => endsWithWho(text, w))) p += 5;
  return p;
}
const endsWithWho = (text, w) => new RegExp('-\\s+' + escRe(w) + '(\\[\\d+\\])?$').test(text);

// Rows of a two-column table with no anchor column (abilities: name | description). `rows` is the
// list of {i (line index), L, R}. Every row needs at least one name line and one description line.
// A row's name is centred on its description (or the other way round when the name is taller).
// Cost of a row = distance between the two centres, + a penalty when the description is cut
// after a line that does not end a sentence, - a small bonus per row (so two one-line abilities
// on two lines stay two abilities).
function partitionRows(lines, who) {
  const N = lines.length;
  const endsSentence = t => /[.:!?…)\]'"]$|\d+CP$/.test(t.trim());
  const segCost = (a, b) => {            // lines[a..b)
    const L = [], R = [];
    for (let t = a; t < b; t++) { if (lines[t].L) L.push(lines[t].i); if (lines[t].R) R.push(lines[t].i); }
    if (!L.length || !R.length) return Infinity;
    const cl = L.reduce((x, y) => x + y, 0) / L.length, cr = R.reduce((x, y) => x + y, 0) / R.length;
    // a name block is never more than one line away from its description block
    if (L[0] > R[R.length - 1] + 1.01 || R[0] > L[L.length - 1] + 1.01) return Infinity;
    let c = Math.abs(cl - cr) - 0.05;
    // the last description line of a row ends a sentence (soft)
    let lastR = null; for (let t = b - 1; t >= a; t--) if (lines[t].R) { lastR = lines[t].R; break; }
    if (b < N && !endsSentence(lastR)) c += 0.6;
    // gaps inside a name block: lines of a name are adjacent, or alternate with description lines
    for (let x = 1; x < L.length; x++) if (L[x] - L[x - 1] > 2) c += 2;
    for (let x = 1; x < R.length; x++) if (R[x] - R[x - 1] > 2) c += 2;
    c += cellPenalty(joinLines(lines.slice(a, b).filter(x => x.L).map(x => x.L)), { who });
    return c;
  };
  const D = new Array(N + 1).fill(Infinity), B = new Array(N + 1).fill(-1);
  D[0] = 0;
  for (let b = 1; b <= N; b++) for (let a = 0; a < b; a++) {
    if (D[a] === Infinity) continue;
    const c = D[a] + segCost(a, b);
    if (c < D[b] - 1e-9) { D[b] = c; B[b] = a; }
  }
  if (D[N] === Infinity) return null;
  const segs = []; let b = N;
  while (b > 0) { const a = B[b]; segs.unshift(lines.slice(a, b)); b = a; }
  return segs.map(s => ({ L: joinLines(s.filter(x => x.L).map(x => x.L)), R: joinLines(s.filter(x => x.R).map(x => x.R)), lines: s.map(x => x.i) }));
}

// ---------------------------------------------------------------- reading the text
function readPages(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const pages = raw.split('\f');
  const out = []; let total = null, title = null, date = null;
  for (let p = 0; p < pages.length; p++) {
    const ls = pages[p].split('\n');
    let i = 0; while (i < ls.length && !ls[i].trim()) i++;
    if (i >= ls.length) continue;
    const h = /^(\d+\/\d+\/\d+), \d+:\d+ [AP]M\s+(.+ - New Recruit)\s*$/.exec(ls[i]);
    if (!h) break;                         // not a New Recruit page (Freeblade_Knights.pdf goes on with Wahapedia pages)
    if (title && h[2] !== title) throw new Error(file + ': page ' + (p + 1) + ' header changes');
    title = h[2]; date = date || h[1];
    const lines = []; let footer = null;
    for (let j = i + 1; j < ls.length; j++) {
      const f = /^https:\/\/www\.newrecruit\.eu\/\S+\s+(\d+)\/(\d+)\s*$/.exec(ls[j]);
      if (f) { footer = [+f[1], +f[2]]; break; }
      lines.push(ls[j].replace(/\s+$/, ''));
    }
    if (!footer) throw new Error(file + ': page ' + (p + 1) + ' has no New Recruit footer');
    if (footer[0] !== out.length + 1) throw new Error(file + ': page ' + (p + 1) + ' is numbered ' + footer.join('/'));
    total = footer[1];
    out.push({ n: footer[0], lines });
  }
  if (!out.length || out.length !== total) throw new Error(file + ': read ' + out.length + ' New Recruit pages of ' + total);
  return { title, date, pages: out };
}

// ---------------------------------------------------------------- page 1: army and roster
const ROLES = ['Epic Hero', 'Character', 'Battleline', 'Infantry', 'Mounted', 'Vehicle', 'Monster', 'Dedicated Transport', 'Beast', 'Swarm', 'Fortification'];
function parseArmy(lines) {
  const army = { bullets: {}, roster: [] };
  let i = 0;
  const next = () => { while (i < lines.length && !lines[i].trim()) i++; return lines[i]; };
  let m = /^\s*(.+?) \[(\d+)pts\]$/.exec(next());
  if (!m) throw new Error('army title line not found');
  army.name = m[1]; army.pts = +m[2]; i++;
  m = /^\s*Army Roster \[(\d+) Detachment Points, (\d+) pts\] \((.+)\)$/.exec(next());
  if (!m) throw new Error('Army Roster line not found');
  army.detachmentPoints = +m[1]; army.rosterPts = +m[2]; army.faction = m[3]; i++;
  const bl = [];
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^NAME\s+ROLE\s+PTS\s+OPTIONS$/.test(t)) break;
    if (!t) continue;
    if (t.startsWith('•')) bl.push(t.replace(/^•\s*/, ''));
    else if (bl.length) bl[bl.length - 1] += ' ' + t;
    else throw new Error('unexpected line before the roster: ' + t);
  }
  for (const b of bl) {
    const k = b.indexOf(': ');
    if (k > 0) army.bullets[b.slice(0, k)] = b.slice(k + 2); else army.bullets[b] = true;
  }
  // roster: NAME | ROLE | PTS | OPTIONS, cells centred on their row
  const hdr = lines[i]; i++;
  const optCol = hdr.indexOf('OPTIONS');
  const roleRe = new RegExp('^(.*?)\\s+(' + ROLES.map(escRe).join('|') + ')\\s+(\\d+)\\b\\s*(.*)$');
  const rows = [], Ls = [], Rs = [];
  for (; i < lines.length; i++) {
    const line = lines[i]; if (!line.trim()) continue;
    const r = roleRe.exec(line);
    if (r) { rows.push({ i, name: r[1].trim(), role: r[2], pts: +r[3], opt: r[4].trim() }); continue; }
    if (indentOf(line) <= 6) { const s = splitAt(line, optCol - 2, { gap: 3, minCol: 20 }); if (s.L) Ls.push({ i, t: s.L }); if (s.R) Rs.push({ i, t: s.R }); }
    else Rs.push({ i, t: line.trim() });
  }
  const nameParts = distribute(rows.map(r => ({ centre: r.i, own: r.name ? [r.i] : [] })), Ls.map(x => x.i), { emptyCost: 5,
    penalty: (k, idx) => cellPenalty(cellText([...idx.map(ii => Ls.find(x => x.i === ii)), ...(rows[k].name ? [{ i: rows[k].i, t: rows[k].name }] : [])]), { required: true }) });
  const optParts = distribute(rows.map(r => ({ centre: r.i, own: r.opt ? [r.i] : [] })), Rs.map(x => x.i), { emptyCost: 0 });
  rows.forEach((r, k) => {
    const full = cellText([...nameParts[k].map(ii => Ls.find(x => x.i === ii)), ...(r.name ? [{ i: r.i, t: r.name }] : [])]);
    const ol = [...optParts[k].map(ii => Rs.find(x => x.i === ii)), ...(r.opt ? [{ i: r.i, t: r.opt }] : [])].sort((a, b) => a.i - b.i).map(x => x.t);
    const c = /^\((\d+)\)\s+(.*)$/.exec(full);
    army.roster.push({ count: c ? +c[1] : null, name: c ? c[2] : full, role: r.role, pts: r.pts, options: ol });
  });
  return army;
}

// ---------------------------------------------------------------- unit pages
const RE = {
  unit: /^\s*(\d+) PTS\s{2,}(\S.*?)(?:\s{2,}x(\d+))?$/,
  models: /^\s*Models\s+Options$/,
  stats: /^\s*Unit\s+M\s+T\s+Sv\s+W\s+LD\s+OC\s+InSv(\s+Base)?$/,
  ranged: /^\s*Ranged Weapons\s+Range\s+A\s+BS\s+S\s+AP\s+D\s+Keywords$/,
  melee: /^\s*Melee Weapons\s+Range\s+A\s+WS\s+S\s+AP\s+D\s+Keywords$/,
  table: /^\s{1,6}(\S(?:.*?\S)?)\s+(Description|Effect|Capacity)$/,   // "Throttlerokkit Shokka Engine Description": one space
  rules: /^\s{1,6}Rules\s+(\S.*)$/,
  cats: /^\s{1,6}Categories\s+(\S.*)$/,
  glossary: /^\s{0,4}Rules$/
};

function splitUnits(pages) {
  const all = [];
  for (const p of pages.slice(1)) for (const l of p.lines) all.push({ t: l, page: p.n });
  const units = []; let cur = null; let glossary = null;
  for (let k = 0; k < all.length; k++) {
    const { t, page } = all[k];
    if (RE.glossary.test(t)) { glossary = all.slice(k + 1); break; }
    const m = RE.unit.exec(t);
    if (m) { cur = { pts: +m[1], header: m[2], copies: m[3] ? +m[3] : 1, page, lines: [] }; units.push(cur); continue; }
    if (!cur) { if (t.trim()) throw new Error('text before the first unit: ' + t.trim()); continue; }
    cur.lines.push(t);
  }
  return { units, glossary: glossary || [] };
}

function sectionsOf(u) {
  const secs = []; let cur = null;
  u.lines.forEach((t, i) => {
    let m;
    const start = (kind, extra) => { cur = Object.assign({ kind, header: t, lines: [] }, extra || {}); secs.push(cur); };
    if (RE.models.test(t)) return start('models');
    if (RE.stats.test(t)) return start('stats');
    if (RE.ranged.test(t)) return start('ranged');
    if (RE.melee.test(t)) return start('melee');
    if ((m = RE.rules.exec(t))) return start('rules', { first: m[1] });
    if ((m = RE.cats.exec(t))) return start('cats', { first: m[1] });
    if ((m = RE.table.exec(t)) && !/^\s*(Models|Unit)\b/.test(t)) return start('table', { name: m[1], col2: m[2] });
    if (!cur) { if (t.trim()) throw new Error(u.header + ': line before the first section: ' + t.trim()); return; }
    cur.lines.push({ i, t });
  });
  return secs;
}

// --- Models | Options
// A model line starts "Nx"; its wrapped name lines follow it. The Options cell (wrapped, a
// "• Leading: …" line of its own) is centred on the model's name lines.
function parseModels(sec, known) {
  const L = [], R = [], notes = [];
  for (const { i, t } of sec.lines) {
    if (!t.trim()) continue;
    if (indentOf(t) > 6) { R.push({ i, t: t.trim() }); continue; }
    let s = splitAt(t, 1e9, { gap: 2 });        // the name ends at the first gap of 2+ spaces
    if (!s.R) {
      // no gap: the options were pulled left onto the model name ("… soulreaper cannon Close combat weapon, …").
      // Split before the first word from which the rest is a list of this unit's printed weapons and abilities.
      const w = words(t);
      for (let k = 2; k < w.length; k++) {
        const right = t.slice(w[k].s).trim();
        const items = splitItems(right);
        if (items.length > 1 && items.every(x => known.has(lc(x.replace(/^\d+x\s+/, ''))))) {
          s = { L: t.slice(0, w[k].s).trim(), R: right };
          notes.push('models: "' + t.trim() + '" has no gap in the text; split before "' + right + '" (a list of this unit\'s weapons)');
          break;
        }
      }
    }
    if (s.L) L.push({ i, t: s.L });
    if (s.R) R.push({ i, t: s.R });
  }
  const models = [];
  for (const x of L) {
    if (/^\d+x(\s|$)/.test(x.t)) models.push({ lines: [x.i], parts: [x] });
    else if (models.length) { models[models.length - 1].lines.push(x.i); models[models.length - 1].parts.push(x); }
    else throw new Error('model name before the first "Nx" line: ' + x.t);
  }
  const optText = (k, idx) => cellText(idx.map(ii => R.find(x => x.i === ii)));
  const given = distribute(models.map(m => ({ centre: mean(m.lines), own: [] })), R.map(x => x.i),
    { emptyCost: 2, penalty: (k, idx) => cellPenalty(optText(k, idx)) });
  models.forEach((m, k) => {
    m.line = cellText(m.parts);
    // a "• Leading: …" line is an item of its own
    const chunks = [];
    for (const ii of given[k]) { const o = R.find(x => x.i === ii).t; if (o.startsWith('•') || !chunks.length) chunks.push([o]); else chunks[chunks.length - 1].push(o); }
    m.options = chunks.flatMap(c => splitItems(joinLines(c)));
    delete m.parts; delete m.lines;
  });
  return { models, notes };
}

// split "a, b (c, d), e" at top-level commas
function splitItems(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

// --- Unit | M T Sv W LD OC InSv Base (InSv and Base may be empty)
function parseStats(sec) {
  const rows = [], others = [];
  for (const { i, t } of sec.lines) {
    if (!t.trim()) continue;
    const m = /^(.*?\S)\s+(\d+"|-)\s+(\d+)\s+(\d\+|-)\s+(\d+)\s+(\d\+|-)\s+(\d+)((?:\s+\S+)*)$/.exec(t);
    if (!m) { others.push({ i, t: t.trim() }); continue; }
    const rest = m[8].trim() ? m[8].trim().split(/\s+/) : [];
    let InSv = '', Base = '';
    if (rest.length === 2) [InSv, Base] = rest;
    else if (rest.length === 1) { if (/^\d\+\*?$/.test(rest[0])) InSv = rest[0]; else Base = rest[0]; }
    else if (rest.length > 2) throw new Error('stat row with too many cells: ' + t.trim());
    rows.push({ i, name: m[1].trim(), M: m[2], T: m[3], Sv: m[4], W: m[5], LD: m[6], OC: m[7], InSv, Base });
  }
  const pieces = (k, idx) => [...idx.map(ii => others.find(x => x.i === ii)), { i: rows[k].i, t: rows[k].name }];
  const given = distribute(rows.map(r => ({ centre: r.i, own: [r.i] })), others.map(x => x.i),
    { penalty: (k, idx) => cellPenalty(cellText(pieces(k, idx))) });
  rows.forEach((r, k) => { r.name = cellText(pieces(k, given[k])); delete r.i; });
  return rows;
}
// " - <unit>" suffixes of the stat rows: the units of an attached unit
function whoOf(stats) {
  if (!stats.length || !stats.every(r => / - /.test(r.name))) return [];
  return uniq(stats.map(r => r.name.slice(r.name.lastIndexOf(' - ') + 3)));
}

// --- Ranged / Melee weapons: one values line per row; the name (left) and keyword (right) cells
// may wrap above and below it.
const CELL = {
  range: /^(\d+"|Melee)$/, A: /^(\d+|\d*D\d+(\+\d+)?)$/, BS: /^(\d\+|-|–|N\/A)$/, S: /^(\d+|\d*D\d+(\+\d+)?)$/,
  AP: /^(0|-\d+)$/, D: /^(\d+|\d*D\d+(\+\d+)?)$/
};
function parseWeapons(sec, who) {
  const rows = [], L = [], R = [];
  for (const { i, t } of sec.lines) {
    if (!t.trim()) continue;
    const w = words(t);
    let k = -1;
    for (let x = 0; x + 5 < w.length; x++) {
      if (CELL.range.test(w[x].w) && CELL.A.test(w[x + 1].w) && CELL.BS.test(w[x + 2].w) && CELL.S.test(w[x + 3].w) && CELL.AP.test(w[x + 4].w) && CELL.D.test(w[x + 5].w)) { k = x; break; }
    }
    if (k >= 0) {
      rows.push({ i, name: t.slice(0, w[k].s).trim(), range: w[k].w, A: w[k + 1].w, BS: w[k + 2].w, S: w[k + 3].w, AP: w[k + 4].w, D: w[k + 5].w,
        kw: w.length > k + 6 ? t.slice(w[k + 6].s).trim() : '' });
      continue;
    }
    if (indentOf(t) <= 6) { const s = splitAt(t, 1e9, { gap: 3 }); if (s.L) L.push({ i, t: s.L }); if (s.R) R.push({ i, t: s.R }); }
    else R.push({ i, t: t.trim() });
  }
  const namePieces = (k, idx) => [...idx.map(ii => L.find(x => x.i === ii)), ...(rows[k].name ? [{ i: rows[k].i, t: rows[k].name }] : [])];
  const kwPieces = (k, idx) => [...idx.map(ii => R.find(x => x.i === ii)), ...(rows[k].kw ? [{ i: rows[k].i, t: rows[k].kw }] : [])];
  const gl = distribute(rows.map(r => ({ centre: r.i, own: r.name ? [r.i] : [] })), L.map(x => x.i),
    { emptyCost: 5, penalty: (k, idx) => cellPenalty(cellText(namePieces(k, idx)), { required: true, who }) });
  const gr = distribute(rows.map(r => ({ centre: r.i, own: r.kw ? [r.i] : [] })), R.map(x => x.i),
    { emptyCost: 0, penalty: (k, idx) => cellPenalty(cellText(kwPieces(k, idx))) });
  rows.forEach((r, k) => { r.name = cellText(namePieces(k, gl[k])); r.kw = cellText(kwPieces(k, gr[k])); delete r.i; });
  return rows;
}

// --- Abilities (and the other two-column tables: "Crimson King | Effect", "Transport | Capacity").
// The description column starts at the header's second word, or further left where a
// description line starts there; a name line's words from that column on are description.
function parseTable(sec, who) {
  const hdrCol = indentOf(sec.header);
  const col2 = sec.header.lastIndexOf(sec.col2);
  const lines = sec.lines.filter(x => x.t.trim());
  const pure = lines.filter(x => indentOf(x.t) > hdrCol + 6).map(x => indentOf(x.t));
  const descCol = Math.min(col2, ...pure);
  const rows = lines.map(({ i, t }) => {
    if (indentOf(t) > hdrCol + 6) return { i, L: '', R: t.trim() };
    const s = splitAt(t, descCol);
    return { i, L: s.L, R: s.R };
  });
  const segs = partitionRows(rows, who);
  if (!segs) throw new Error('cannot split the "' + sec.name + '" table into rows');
  return segs.map(s => ({ name: s.L, text: s.R }));
}

function parseList(sec) {
  return splitItems(joinLines([sec.first, ...sec.lines.map(x => x.t)])).filter(Boolean);
}

// a weapon name without its decorations ("➤", "(…)", "[1]", " - <unit>"), to recognise option items
function weaponBase(n, who) {
  let t = n.replace(/^➤\s*/, '');
  for (const w of who) if (endsWithWho(t, w)) t = t.replace(new RegExp('\\s*-\\s+' + escRe(w) + '$'), '');
  return t.replace(/\s*\([^)]*\)/g, '').replace(/\[\d+\]/g, '').trim();
}

function parseUnit(u, enhNames) {
  const secs = sectionsOf(u);
  const unit = { header: u.header, pts: u.pts, copies: u.copies, page: u.page, models: [], stats: [], ranged: [], melee: [], tables: [], rules: [], cats: [], notes: [] };
  const statSec = secs.find(s => s.kind === 'stats');
  if (statSec) unit.stats = parseStats(statSec);
  unit.who = whoOf(unit.stats);
  for (const s of secs) {
    if (s.kind === 'ranged') unit.ranged = parseWeapons(s, unit.who);
    else if (s.kind === 'melee') unit.melee = parseWeapons(s, unit.who);
    else if (s.kind === 'table') unit.tables.push({ name: s.name, col2: s.col2, rows: parseTable(s, unit.who) });
    else if (s.kind === 'rules') unit.rules = parseList(s);
    else if (s.kind === 'cats') unit.cats = parseList(s);
  }
  // option items the Models table may list: the unit's printed weapons and abilities, enhancements
  const known = new Set(['warlord', ...enhNames.map(lc)]);
  for (const w of [...unit.ranged, ...unit.melee]) { const b = weaponBase(w.name, unit.who); known.add(lc(b)); known.add(lc(b.split(/\s*-\s+/)[0])); }
  for (const t of unit.tables) for (const r of t.rows) known.add(lc(weaponBase(r.name, unit.who)));
  const ms = secs.find(s => s.kind === 'models');
  if (ms) { const r = parseModels(ms, known); unit.models = r.models; unit.notes.push(...r.notes); }
  for (const k of ['models', 'stats', 'cats']) if (!secs.some(s => s.kind === k)) throw new Error(u.header + ': no ' + k + ' section');
  return unit;
}

// the glossary at the end ("Rules"): entry names. An entry is a "Name:" line after a blank line;
// the "Army Roster (…)" block lists the army rules as a title line followed by text.
function parseGlossary(lines) {
  const names = []; let inRoster = false, prevBlank = true, prevEnds = true;
  for (const { t } of lines) {
    if (!t.trim()) { prevBlank = true; continue; }
    let m;
    if (/^\s{2,4}Army Roster \(/.test(t)) { inRoster = true; prevBlank = false; prevEnds = true; continue; }
    if (prevBlank && (m = /^\s{2,4}(\S.*?):$/.exec(t))) { inRoster = false; names.push(...m[1].split(' / ').map(x => x.trim())); }
    else if (inRoster && prevEnds && (m = /^ {4}(\S.*)$/.exec(t))) {
      const title = m[1].replace(/\s*\([^)]*\)$/, '').trim();
      if (title.length < 40 && !/[,.:;]/.test(title)) names.push(title);
    }
    prevEnds = /[.:!]$/.test(t.trim()) || inRoster && /^ {4}\S/.test(t) && names[names.length - 1] === t.trim().replace(/\s*\([^)]*\)$/, '');
    prevBlank = false;
  }
  return uniq(names);
}

function parseNR(file, enhNames) {
  const { title, date, pages } = readPages(file);
  const army = parseArmy(pages[0].lines);
  army.title = title; army.date = date; army.pageCount = pages.length;
  const { units, glossary } = splitUnits(pages);
  army.units = units.map(u => parseUnit(u, enhNames));
  army.glossary = parseGlossary(glossary);
  return army;
}

module.exports = { parseNR, joinLines, distribute, partitionRows };

// ================================================================ comparison
const NONE = '–';
const cellV = v => { const t = nm(v); return (t === '' || t === '-' || t === '–' || t === 'N/A') ? NONE : t; };

// App text without markup, with a mask of the characters inside **bold** (compared case-insensitively).
function appText(text) {
  const lines = String(text).split('\n').map(l => {
    l = l.replace(/^- /, '');                                   // bullet
    const it = /^\*([^*].*[^*])\*$/.exec(l); if (it) l = it[1]; // *italic line*
    return l;
  });
  const t = lines.join(' ');
  const chars = [], ci = [];
  let bold = false;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '*' && t[i + 1] === '*') { bold = !bold; i++; continue; }
    if (t[i] === '~' && t[i + 1] === '~') { i++; chars.push('~', '~'); ci.push(false, false); continue; }   // struck text is kept, so it fails
    chars.push(q(t[i])); ci.push(bold);
  }
  // collapse whitespace, keeping the mask aligned
  const s = [], m = [];
  for (let i = 0; i < chars.length; i++) {
    if (/\s/.test(chars[i])) { if (s.length && s[s.length - 1] !== ' ') { s.push(' '); m.push(false); } continue; }
    s.push(chars[i]); m.push(ci[i]);
  }
  while (s.length && s[s.length - 1] === ' ') { s.pop(); m.pop(); }
  return { s: s.join(''), ci: m };
}
function textEq(app, nr) {
  const A = appText(app), N = nm(nr);
  if (A.s.length !== N.length) return false;
  for (let i = 0; i < N.length; i++) if (A.s[i] !== N[i] && !(A.ci[i] && A.s[i].toLowerCase() === N[i].toLowerCase())) return false;
  return true;
}

// NR names --------------------------------------------------------
// "➤ Kombi-weapon - Kill Shot (Nazdreg's Know-wotz) (x5) - Meganobz"
function nrWeapon(row, who) {
  let t = nm(row.name).replace(/^➤\s*/, ''), w = null, n = null, hunter = false;
  const parens = [];
  for (const x of who) if (endsWithWho(t, nm(x))) { w = nm(x); t = t.replace(new RegExp('\\s*-\\s+' + escRe(w) + '$'), ''); break; }
  let m;
  while ((m = /\s*\(([^()]*)\)$/.exec(t))) {
    const inner = m[1];
    if (/^x\d+$/.test(inner)) n = +inner.slice(1);
    else if (/^Hunter: /.test(inner)) hunter = true;
    else parens.unshift(inner);
    t = t.slice(0, m.index);
  }
  t = t.replace(/\[\d+\]/g, '').trim();
  const g = /^(.*?\S)\s*-\s+(\S.*)$/.exec(t);
  return { group: g ? g[1] : null, name: g ? g[2] : t, who: w, n, hunter, parens };
}
// "Meganob (x5) - Meganobz", "Big Mek Dakkarig (Cybork Boosta)"
function nrStatName(name, who) {
  let t = nm(name), n = null; const parens = [];
  if (who.length) { const k = t.lastIndexOf(' - '); if (k > 0) t = t.slice(0, k); }
  let m;
  while ((m = /\s*\(([^()]*)\)$/.exec(t))) { if (/^x\d+$/.test(m[1])) n = +m[1].slice(1); else parens.unshift(m[1]); t = t.slice(0, m.index); }
  return { name: t, n, parens };
}
// "Supreme Kunnin' (Once per phase, per army) - Nazdreg"
function nrAbility(name, who) {
  let t = nm(name), w = null;
  for (const x of who) if (endsWithWho(t, nm(x))) { w = nm(x); t = t.replace(new RegExp('\\s*-\\s+' + escRe(w) + '$'), ''); break; }
  const m = /^(.*?)\s*\(([^()]*)\)$/.exec(t);
  return { full: t, base: m ? m[1] : t, paren: m ? m[2] : null, who: w };
}
// option items of one model line
function nrOptions(items, enhNames) {
  const r = { warlord: false, leads: null, support: false, enhancement: null, gear: [] };
  const enh = new Set(enhNames.map(lc));
  for (const it0 of items) {
    const it = nm(it0);
    let m;
    if (it === 'Warlord') r.warlord = true;
    else if ((m = /^•\s*(Leading|Supporting):\s*(.+?)(\[\d+\])?$/.exec(it))) { r.leads = m[2]; r.support = m[1] === 'Supporting'; }
    else if (enh.has(lc(it))) { r.enhancement = it; r.enhItem = it; }
    else {
      // "Ectoplasma cannon and claws (Ectoplasma cannon, Forgefiend claws)" counts as its weapons; "2x Weapon" as Weapon
      const g = /^.*?\((.*)\)$/.exec(it);
      const parts = g ? splitItems(g[1]) : [it];
      for (const p of parts) r.gear.push(nm(p).replace(/^\d+x\s+/, ''));
    }
  }
  return r;
}
// "Brute Bosses [1Detachment Points], Da Big Hunt [1Detachment Points]"
const nrDetachments = s => splitItems(s || '').map(x => nm(x.replace(/\s*\[\d+\s*Detachment Points\]$/, '')));
// weapon keyword -> the rule it opens ("RAPID FIRE 2" -> rapid fire, "ANTI-VEHICLE 4+" -> anti)
const kwRule = k => lc(k).replace(/:.*$/, '').replace(/^anti-.*$/, 'anti').replace(/\s+(\d+|d\d+(\+\d+)?|\d*d\d+(\+\d+)?)\+?$/, '').trim();

// ---------------------------------------------------------------- per army
function compareArmy(D, A, nr, out, srcFile) {
  const F = D.factions[A.faction];
  const enhNames = Object.values(F.detachments).flatMap(d => (d.enhancements || []).map(e => e.name));
  const where = p => path.relative(ROOT, srcFile) + (p ? ' p' + p : '');
  const fail = (unit, field, app, source, page) => out.failures.push({ army: A.id, unit, field, app: app === undefined ? null : app, source: source === undefined ? null : source, where: where(page) });
  const chk = (cat, n = 1) => { out.checked[cat] = (out.checked[cat] || 0) + n; };
  const cmp = (cat, unit, field, app, source, page) => { chk(cat); if (!deepEq(app, source)) fail(unit, field, app, source, page); };

  // army facts (page 1)
  const b = nr.bullets;
  cmp('army', null, 'name', nm(A.name), nm(nr.name), 1);
  cmp('army', null, 'pointsUsed', A.pointsUsed, nr.pts, 1);
  cmp('army', null, 'pointsUsed (Army Roster line)', A.pointsUsed, nr.rosterPts, 1);
  const bs = /^(.*?) \((\d+) Point limit\)$/.exec(b['Battle Size'] || '') || [];
  cmp('army', null, 'battleSize', A.battleSize, bs[1] || null, 1);
  cmp('army', null, 'points', A.points, bs[2] ? +bs[2] : null, 1);
  cmp('army', null, 'disposition', A.disposition, b['Force Disposition'] || null, 1);
  cmp('army', null, 'detachments', A.detachments.map(id => nm((F.detachments[id] || {}).name || id)).sort(), nrDetachments(b['Detachment']).sort(), 1);
  cmp('army', null, 'faction', nm(F.name), nm(nr.faction.replace(/^.* - /, '')), 1);
  const dm = /^(\d+)\/(\d+)\/(\d+)$/.exec(nr.date);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  cmp('army', null, 'source (export date)', A.source, 'New Recruit, exported ' + (+dm[2]) + ' ' + MON[+dm[1] - 1] + ' 20' + dm[3], 1);
  const used = A.units.reduce((s, u) => s + u.pts * (u.copies || 1), 0);
  cmp('army', null, 'pointsUsed (sum of unit pts × copies)', used, nr.pts, 1);

  // two units New Recruit prints alike, page for page (two Mek + Tankbustas), are one app unit
  // with copies 2, as "Gretchin (x3)" is
  const sig = u => JSON.stringify(Object.assign({}, u, { page: null, copies: null })).replace(/\[\d+\]/g, '');   // "Supporting: Tankbustas[1]" / "[2]"
  const units = [];
  for (const nu of nr.units) { const twin = units.find(x => sig(x) === sig(nu)); if (twin) twin.copies += nu.copies; else units.push(Object.assign({}, nu)); }
  // match NR units to app units: name (NR prints it in capitals) + points, then the enhancement
  const pool = [...A.units];
  const pairs = [];
  for (const nu of units) {
    const enh = nu.models.map(m => nrOptions(m.options, enhNames).enhancement).find(Boolean) || null;
    let c = pool.filter(u => nm(u.name).toUpperCase() === nm(nu.header));
    if (c.length > 1 && c.some(u => u.pts === nu.pts)) c = c.filter(u => u.pts === nu.pts);
    if (c.length > 1) c = c.filter(u => (u.enhancement ? nm(u.enhancement) : null) === enh);
    // two units printed alike ("Supporting: Tankbustas[1]" and "[2]"): the next one of them
    if (c.length > 1 && c.every(u => u.pts === c[0].pts && (u.leads || '') === (c[0].leads || ''))) c = [c[0]];
    chk('units');
    if (c.length !== 1) { fail(null, 'unit', c.length ? c.map(u => u.id) : null, nu.header + ' ' + nu.pts + ' PTS' + (nu.copies > 1 ? ' x' + nu.copies : ''), nu.page); continue; }
    pool.splice(pool.indexOf(c[0]), 1);
    pairs.push([nu, c[0]]);
  }
  for (const u of pool) { chk('units'); fail(u.id, 'unit', u.name + ' ' + u.pts, null); }

  // roster (page 1): who leads whom, the points of each part, copies, role, model counts
  const roster = nr.roster.map(r => Object.assign({ used: false }, r));
  for (const [nu, au] of pairs) {
    const unit = au.id;
    const first = nrOptions((nu.models[0] || { options: [] }).options, enhNames);
    const modelSum = ms => ms.reduce((s, m) => s + (+(/^(\d+)/.exec(nm(m)) || [0, 0])[1]), 0);
    if (first.leads) {
      // one leader line and one bodyguard line per copy
      let bg = null, ld = null, found = 0;
      for (let k = 0; k < nu.copies; k++) {
        const b2 = roster.find(r => !r.used && lc(r.name) === lc(first.leads) && lc(joinLines(r.options)).includes(lc(nu.header)));
        const l2 = b2 && roster.find(r => !r.used && lc(r.name) === lc(nu.header) && r.pts === nu.pts - b2.pts);
        if (!b2 || !l2) break;
        b2.used = l2.used = true; bg = bg || b2; ld = ld || l2; found++;
      }
      chk('roster');
      if (!bg || !ld) { fail(unit, 'roster (leader + bodyguard lines)', au.ptsNote || null, 'no roster lines for ' + nu.header + ' leading ' + first.leads + ' (' + nu.pts + ' pts together)', 1); continue; }
      cmp('roster', unit, 'copies (leader + bodyguard roster lines)', au.copies || 1, found, 1);
      cmp('pts', unit, 'ptsNote', au.ptsNote ? nm(au.ptsNote) : null, ld.pts + ' + ' + nm(bg.name) + ' ' + bg.pts, 1);
      cmp('roster', unit, 'name', nm(au.name), nm(ld.name), 1);
      cmp('roster', unit, 'role', au.role, ld.role, 1);
      // the roster's OPTIONS column prints "Warlord" for some warlords only (not for Ghazghkull or Magnus): one way
      if (ld.options.includes('Warlord')) cmp('roster', unit, 'warlord (roster)', !!au.warlord, true, 1);
      cmp('roster', unit, 'models (bodyguard count)', modelSum(au.models.slice(1)), bg.count, 1);
    } else {
      const rs = roster.filter(r => !r.used && lc(r.name) === lc(nu.header) && r.pts === nu.pts).slice(0, nu.copies);
      rs.forEach(r => { r.used = true; });
      cmp('roster', unit, 'copies (roster lines)', au.copies || 1, rs.length, 1);
      if (!rs.length) continue;
      cmp('pts', unit, 'ptsNote', au.ptsNote ? nm(au.ptsNote) : null, null, 1);
      cmp('roster', unit, 'name', nm(au.name), nm(rs[0].name), 1);
      cmp('roster', unit, 'role', au.role, rs[0].role, 1);
      if (rs.some(r => r.options.includes('Warlord'))) cmp('roster', unit, 'warlord (roster)', !!au.warlord, true, 1);
      cmp('roster', unit, 'models (count)', modelSum(au.models), rs[0].count || 1, 1);
    }
  }
  for (const r of roster.filter(r => !r.used)) { chk('roster'); fail(null, 'roster line', null, (r.count ? '(' + r.count + ') ' : '') + r.name + ' ' + r.role + ' ' + r.pts, 1); }

  // rules that act on the whole army, which New Recruit names in a weapon's "(…)" when it applied them
  const armyRuleNames = new Set(A.detachments.map(id => F.detachments[id]).filter(Boolean).map(d => d.rule && d.rule.name).concat(F.armyRules.map(r => r.name)).filter(Boolean).map(x => lc(nm(x))));
  for (const [nu, au] of pairs) compareUnit(nu, au, enhNames, { armyRuleNames, fail: (f, a, s) => fail(au.id, f, a, s, nu.page), chk, cmp: (c, f, a, s) => cmp(c, au.id, f, a, s, nu.page) });

  // glossary: every rule New Recruit prints at the end opens something in the app
  for (const g of nr.glossary) { chk('glossary'); if (!ruleKnown(D, A, g)) fail(null, 'glossary rule', null, g, nr.pageCount); }
}

// the lookup the app makes when a rule chip is tapped (as check.js does)
function ruleKnown(D, A, label) {
  const f = D.factions[A.faction];
  let clean = q(String(label)).replace(/^\[|\]$/g, '').trim();
  for (const [re, key] of f.aliases || []) if (re.test(clean)) { clean = key; break; }
  const l = lc(clean);
  if (f.armyRules.some(r => lc(r.name) === l)) return true;
  if (A.detachments.some(id => { const d = f.detachments[id]; return d && d.rule && lc(d.rule.name) === l; })) return true;
  if (D.ruleAliases.some(([re]) => re.test(clean))) return true;
  return Object.keys(D.rules).some(k => lc(k) === l);
}

// ---------------------------------------------------------------- per unit
function compareUnit(nu, au, enhNames, { fail, chk, cmp, armyRuleNames = new Set() }) {
  cmp('pts', 'pts', au.pts, nu.pts);
  cmp('copies', 'copies', au.copies || 1, nu.copies);

  // models and their options. An option that is none of the unit's printed weapons is wargear
  // (Icon of Khorne): the app names it on the model line, "1× … (Icon of Khorne)".
  const printed = new Set();
  for (const r of [...nu.ranged, ...nu.melee]) { const w = nrWeapon(r, nu.who); printed.add(lc(w.name)); if (w.group) { printed.add(lc(w.group)); printed.add(lc(w.group + ' - ' + w.name)); } }
  const opts = nu.models.map(m => {
    const o = nrOptions(m.options, enhNames);
    o.wargear = o.gear.filter(g => !printed.has(lc(g)));
    o.gear = o.gear.filter(g => printed.has(lc(g)));
    o.line = nm(m.line) + (o.wargear.length ? ' (' + o.wargear.join(', ') + ')' : '');
    return o;
  });
  const nrModels = opts.map(o => o.line);
  cmp('models', 'models', (au.models || []).map(nm), nrModels);
  const nrEnh = opts.map(o => o.enhancement).filter(Boolean);
  cmp('enhancement', 'enhancement', au.enhancement ? nm(au.enhancement) : null, nrEnh.length ? nrEnh.join(', ') : null);
  cmp('warlord', 'warlord', !!au.warlord, opts.some(o => o.warlord));
  const nrLeads = opts.map(o => o.leads).filter(Boolean);
  cmp('leads', 'leads', au.leads ? nm(au.leads) : null, nrLeads.length ? nm(nrLeads.join(', ')) : null);
  const appModels = (au.models || []).map(nm);
  opts.forEach((o, k) => {
    const line = o.line;
    const ak = appModels[k] === line ? k : appModels.indexOf(line);
    if (ak < 0) { chk('gear'); fail('gear[' + line + ']', null, o.gear.slice().sort()); return; }
    const appGear = ((au.gear || [])[ak] || []).map(nm).filter(g => !(o.enhItem && g === o.enhItem && !o.gear.includes(g)));
    const nrGear = o.gear.slice();
    if (o.enhItem && appGear.includes(o.enhItem)) nrGear.push(o.enhItem);
    // letter case aside: New Recruit's option list can capitalise a weapon its weapon row does not ("Rokkit Pistol" / "Rokkit pistol")
    cmp('gear', 'gear[' + line + ']', uniq(appGear.map(lc)).sort(), uniq(nrGear.map(lc)).sort());
  });
  // app model lines New Recruit does not print: their gear is unmatched too
  appModels.forEach((l, k) => { if (!nrModels.includes(l)) { chk('gear'); fail('gear[' + l + ']', uniq(((au.gear || [])[k] || []).map(nm)).sort(), null); } });

  // stat rows
  const enhLc = au.enhancement ? lc(au.enhancement) : null;
  const boosts = [];
  const nrStats = nu.stats.map(r => Object.assign(nrStatName(r.name, nu.who), { r }));
  const appStats = (au.stats || []).map(s => { const m = /^(.*?) x(\d+)$/.exec(nm(s.name)); return { name: m ? m[1] : nm(s.name), n: m ? +m[2] : null, s }; });
  const sKey = x => x.name + (x.n ? ' x' + x.n : '');
  cmp('stats', 'stats (rows)', appStats.map(sKey), nrStats.map(sKey));
  // "(Dakka! Dakka! Dakka!, Supa-snazz Dakka, Kustom Dakka)": each name must be a source in the row's `from` marks
  const fromNames = o => new Set(Object.values((o && o.from) || {}).flat().map(x => lc(nm(x))));
  const annotated = (label, parens, obj) => {
    for (const p of uniq(parens.flatMap(b => b.split(/,\s*/)))) { chk('from'); boosts.push(p);
      if (!fromNames(obj).has(lc(p))) fail('from[' + label + ']', obj && obj.from ? JSON.stringify(obj.from) : null, 'New Recruit marks "(' + p + ')" as applied'); }
  };
  for (const ns of nrStats) {
    const as = appStats.find(x => x.name === ns.name) ;
    annotated('stats ' + ns.name, ns.parens, as && as.s);
    if (!as) continue;
    const S = as.s, R = ns.r;
    for (const [ak, nk] of [['M', 'M'], ['T', 'T'], ['Sv', 'Sv'], ['W', 'W'], ['Ld', 'LD'], ['OC', 'OC'], ['InSv', 'InSv'], ['base', 'Base']])
      cmp('stats', 'stats[' + ns.name + '].' + ak, cellV(S[ak]), cellV(R[nk]));
  }

  // weapons
  for (const kind of ['ranged', 'melee']) {
    const nrW = nu[kind].map(r => Object.assign(nrWeapon(r, nu.who), { r }));
    const appW = (au[kind] || []).map(w => ({ group: w.group ? nm(w.group) : null, name: nm(w.name), who: w.who ? nm(w.who) : null, w }));
    const wKey = x => (x.group ? x.group + ' - ' : '') + x.name + (x.who ? ' | ' + x.who : '');
    cmp(kind, kind + ' (rows)', appW.map(wKey), nrW.map(wKey));
    const usedA = new Set();
    for (const nw of nrW) {
      const aw = appW.find(x => !usedA.has(x) && wKey(x) === wKey(nw));
      annotated(kind + ' ' + wKey(nw), nw.parens, aw && aw.w);
      if (!aw) continue;
      usedA.add(aw);
      const W = aw.w, R = nw.r, key = kind + '[' + wKey(nw) + ']';
      const sk = kind === 'ranged' ? 'BS' : 'WS';
      cmp(kind, key + '.range', cellV(W.range), cellV(R.range));
      cmp(kind, key + '.A', cellV(W.A), cellV(R.A));
      cmp(kind, key + '.' + sk, cellV(W[sk]), cellV(R.BS));
      cmp(kind, key + '.S', cellV(W.S), cellV(R.S));
      cmp(kind, key + '.AP', cellV(W.AP), cellV(R.AP));
      cmp(kind, key + '.D', cellV(W.D), cellV(R.D));
      cmp(kind, key + '.n', W.n || 1, nw.n || 1);
      cmp(kind, key + '.hunter', !!W.hunter, nw.hunter);
      cmp(kind, key + '.kw', (W.kw || []).map(k => nm(k).toUpperCase()), splitItems(R.kw).map(k => nm(k).toUpperCase()));
    }
  }
  // and each such name is one of the unit's abilities (enhancements included) or a detachment/army rule of the list
  const abilNames = new Set(nu.tables.flatMap(t => t.rows.map(r => lc(nrAbility(r.name, nu.who).base))));
  for (const p of uniq(boosts)) { chk('from'); if (!abilNames.has(lc(p)) && !armyRuleNames.has(lc(p)) && !(enhLc && lc(p) === enhLc)) fail('weapon/stat name', null, '(' + p + ')'); }

  // abilities
  const appA = (au.abilities || []).map(x => ({ name: nm(x.name), who: x.who ? nm(x.who) : null, tag: x.tag ? nm(x.tag) : null, x }));
  const nrA = [];
  for (const t of nu.tables) for (const r of t.rows) nrA.push(Object.assign(nrAbility(r.name, nu.who), { table: t.name, col2: t.col2, text: r.text }));
  const used = new Set();
  const nrKeys = [];
  for (const na of nrA) {
    // the app names a "Transport | Capacity" row after its table
    const sub = na.table !== 'Abilities';
    let cands = appA.filter(x => !used.has(x) && (x.name === na.full || x.name === na.base || (sub && x.name === nm(na.table))));
    const whoOk = x => x.who === na.who || (sub && x.who && x.who.startsWith(nm(na.table)));
    cands = cands.filter(whoOk);
    const key = na.full + (na.who ? ' | ' + na.who : '');
    nrKeys.push(key);
    chk('abilities');
    if (!cands.length) { fail('abilities[' + key + ']', null, 'present'); continue; }
    const ax = cands[0]; used.add(ax);
    // tag: NR's "(…)" against the app's tag, less the parts the app may add (see NORMALISATION)
    const enhA = au.enhancement && ax.name === nm(au.enhancement);
    let parts = ax.tag ? ax.tag.split(' · ').map(nm) : [];
    parts = parts.filter(p => !(p === 'Enhancement' && enhA) && !(p === 'Upgrade' && au.upgrade && ax.name === nm(au.upgrade)) && !(sub && (p === nm(na.table) || p === nm(na.col2))) && !(p !== na.paren && lc(na.text).includes(lc(p))));
    // "Invulnerable Save (5+*)": the app keeps NR's parenthesis in the name
    const parenInName = na.paren !== null && ax.name === na.full;
    const appParen = parts.length ? parts.join(', ') : null;
    const nrParen = parenInName ? null : na.paren;
    cmp('abilities', 'abilities[' + key + '].tag', appParen, nrParen);
    chk('abilities');
    if (!textEq(ax.x.text, na.text)) fail('abilities[' + key + '].text', appText(ax.x.text).s, nm(na.text));
  }
  for (const ax of appA.filter(x => !used.has(x))) { chk('abilities'); fail('abilities[' + ax.name + (ax.who ? ' | ' + ax.who : '') + ']', 'present', null); }

  // keywords ("Categories")
  const cats = nu.cats.filter(c => !/^\*from combined unit$/.test(c));
  const starred = cats.filter(c => /\*$/.test(c)).map(c => nm(c.replace(/\*$/, '')));
  cmp('kw', 'kw', (au.kw || []).map(nm).sort(), uniq(cats.map(c => nm(c.replace(/\*$/, '')))).sort());
  for (const s of starred) { chk('kw'); if (!au.kwNote || !nm(au.kwNote).includes(s)) fail('kwNote', au.kwNote || null, s + '* (from combined unit)'); }
  if (!starred.length && au.kwNote) { chk('kw'); fail('kwNote', au.kwNote, null); }

  // rules
  const nrRules = uniq(nu.rules.map(nm));
  const appRules = uniq((au.rules || []).map(nm));
  const weaponRules = new Set([...(au.ranged || []), ...(au.melee || [])].flatMap(w => (w.kw || []).map(kwRule)));
  for (const r of nrRules) { chk('rules'); if (!appRules.some(x => lc(x) === lc(r)) && !weaponRules.has(lc(r))) fail('rules', null, r); }
  for (const r of appRules) { chk('rules'); if (!nrRules.some(x => lc(x) === lc(r))) fail('rules', r, null); }
}

// the same readings for verify/import-nr.js, so the importer writes what this file checks
Object.assign(module.exports, { nrOptions, nrWeapon, nrStatName, nrAbility, nrDetachments, splitItems, nm, lc, q, cellV, appText, textEq, compareArmy });

// ---------------------------------------------------------------- main
function main(args) {
  const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(args.data, 'utf8'), ctx);
  const D = ctx.window.WH_DATA;
  const enhOf = A => Object.values(D.factions[A.faction].detachments).flatMap(d => (d.enhancements || []).map(e => e.name));
  if (args.dump) {
    const A = D.armies.find(x => x.id === args.dump);
    console.log(JSON.stringify(parseNR(path.join(args.sources, args.dump + '.txt'), enhOf(A)), null, 1));
    return 0;
  }
  const out = { source: 'verify/sources/nr/<armyId>.txt (pdftotext -layout of the owner\'s New Recruit PDFs)', normalisation: NORMALISATION, checked: {}, failures: [], deviations: 0, parseNotes: [] };
  // every army in data.js, each against its own PDF text (verify/sources/nr/<armyId>.txt)
  for (const A of D.armies) {
    const id = A.id, file = path.join(args.sources, id + '.txt');
    if (!fs.existsSync(file)) { out.failures.push({ army: id, unit: null, field: 'army', app: 'present', source: null, where: 'no New Recruit PDF for this army (' + path.relative(ROOT, file) + ')' }); continue; }
    const nr = parseNR(file, enhOf(A));
    for (const u of nr.units) for (const n of u.notes) out.parseNotes.push(id + ' / ' + u.header + ': ' + n);
    compareArmy(D, A, nr, out, file);
  }

  // declared deviations: an exact match turns a failure into an accepted deviation; an unused one fails
  let devs = [];
  if (fs.existsSync(args.deviations)) devs = JSON.parse(fs.readFileSync(args.deviations, 'utf8'));
  const usedDev = new Set();
  out.failures = out.failures.filter(f => {
    const k = devs.findIndex((d, i) => !usedDev.has(i) && d.army === f.army && d.unit === f.unit && d.field === f.field && deepEq(d.app, f.app) && deepEq(d.source, f.source));
    if (k < 0) return true;
    usedDev.add(k); return false;
  });
  devs.forEach((d, i) => {
    if (!d.reason || !d.evidence) out.failures.push({ army: d.army, unit: d.unit, field: d.field, app: d.app, source: d.source, where: path.relative(ROOT, args.deviations) + ' #' + i + ': no reason or evidence' });
    else if (!usedDev.has(i)) out.failures.push({ army: d.army, unit: d.unit, field: d.field, app: d.app, source: d.source, where: path.relative(ROOT, args.deviations) + ' #' + i + ': stale (nothing matches it)' });
  });
  out.deviations = usedDev.size;
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(out, null, 1) + '\n');
  const total = Object.values(out.checked).reduce((x, y) => x + y, 0);
  // summary first: verify/run.js reports the first line
  console.log('nr: ' + out.failures.length + ' failure(s); ' + total + ' facts checked (' + Object.entries(out.checked).map(([k, v]) => k + ' ' + v).join(', ') + '); ' + out.deviations + ' declared deviations used. Report: ' + path.relative(ROOT, args.out));
  if (!args.quiet) {
    for (const f of out.failures) console.log('FAIL', f.army, '|', f.unit, '|', f.field, '\n   app:    ' + JSON.stringify(f.app) + '\n   source: ' + JSON.stringify(f.source) + '\n   where:  ' + f.where);
  }
  return out.failures.length ? 1 : 0;
}

if (require.main === module) {
  let code;
  try { code = main(parseArgs(process.argv.slice(2))); }
  catch (e) { console.error('nr: cannot check: ' + (e && e.stack || e)); code = 2; }
  process.exit(code);
}
