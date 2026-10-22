#!/usr/bin/env node
/* verify/texts.js: every verbatim rules text in data.js, checked against the documents it comes from.

   What it checks (each one is a "fact"; counts go to out/texts.json under checked):
     rules          D.rules: each paragraph (line) of each entry, found word for word in its source
     coreStrat      D.coreStratagems: name, cp, when, target, effect, restrictions vs GW Core Rules section 15,
                    and the packet's list of core stratagems (both ways)
     armyRule       faction armyRules: text and table rows vs Wahapedia army rules (+ the Faction Pack's Rules Updates)
     detachment     detachment rule (name, text, table), enhancements (name, pts, text) and stratagems
                    (name, cp, when, target, effect, restrictions) vs the Faction Pack where it prints the detachment,
                    else Wahapedia (+ the pack's Rules Updates); both ways (every source item must be in the app)
     unitText       unit abilities that are not datasheet abilities (enhancements, detachment/army rules on units)
     unitRules      every name in a unit's rules list opens a rule text (D.rules, army rule or detachment rule)
     packUpdate     the Faction Packs' Rules Updates ("Change to …") for every army rule, detachment item and unit ability
                    in the lists; an update that concerns the lists but matches no app text is a failure
     packDatasheet  abilities of units whose datasheet a Faction Pack prints (Knight Destrier, Defiler)
     noteQuote      every quotation (“…”) inside an app note (army/detachment rule, stratagem, ability, a stratagem's shield line), word for word in a
                    source or in the verified text of the item the note is on (the note's own words are judgements: helpers.js)
   A line marked "*Wahapedia core rules (…): …*" (a sentence GW's Core Rules PDF does not print) is checked word for word in
   Wahapedia's core rules only.
   Lines the app marks as its own ("*App note, not rules text: …*") are not checked; they are listed in out/texts.json
   (appNotes). Any other line of a verbatim field that is in no source is a failure (also listed: notInAnySource).

   Sources (authority order): GW Core Rules, Universal Rules Updates and Faction Packs (verify/.cache/gw, read with
   `pdftotext -raw`), Wahapedia (verify/.cache/waha: <faction>.txt from waha-extract.py, and the .html pages),
   the packet's core stratagems (verify/sources/packet/core-stratagems.txt).

   Normalisation (both sides, before any comparison): see norm(), stripMarkup() and glueOf() below.
   Usage: node verify/texts.js [--data data.js] [--out verify/out/texts.json] [--provenance verify/provenance.json] [--quiet]
          node verify/texts.js --find "some words"     where a normalised phrase occurs in the sources
          node verify/texts.js --debug-dets | --debug-updates   what the parsers read from the sources
   Writes out/texts.json and provenance.json (every checked text -> document, page or section, sha256).
   Exit 1 when there is any failure not covered by verify/deviations-texts.json (a stale deviation is a failure). */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const VERIFY = __dirname;
const ROOT = path.resolve(VERIFY, '..');
const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const DATA = path.resolve(arg('--data', path.join(ROOT, 'data.js')));
const OUT = path.resolve(arg('--out', path.join(VERIFY, 'out', 'texts.json')));
const DEVS = path.resolve(arg('--deviations', path.join(VERIFY, 'deviations-texts.json')));
const PROV = path.resolve(arg('--provenance', path.join(VERIFY, 'provenance.json')));
const QUIET = process.argv.includes('--quiet');
const CACHE = process.env.VERIFY_CACHE ? path.resolve(process.env.VERIFY_CACHE) : path.join(VERIFY, '.cache');   // verify/currency.js points it at the newest sources

/* ------------------------------------------------------------------ normalisation */
// One function for app text and source text:
//  - NFC; soft hyphen and zero-width characters removed
//  - quotes: ‘ ’ ‚ ‛ ′ ` ´ -> '   “ ” „ ″ -> "
//  - dashes: ‐ ‑ ‒ – — ― − -> -     ellipsis … -> ...
//  - bullets ▪ ■ • ◦ ▫ ● ► and the PDF's unmapped icon glyphs (U+FFFD) removed; control characters and every
//    kind of space -> one space
//  - lower case (the PDFs print keywords in capitals or in title case; the app writes them in capitals)
//  - no space before . , ; : ! ? ) ] and after ( [ ; no space around /
// App markup is removed first (stripMarkup): **bold**, ~~struck~~ (the text stays), a leading "- " (bullet),
// the * * around an italic line, and the "- 1." numbering prefix becomes "1.".
function norm(s) {
  return String(s).normalize('NFC')
    .replace(/[\u00AD\u200B\u200C\u200D\uFEFF]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[\u2018\u2019\u201A\u201B\u2032`\u00B4]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u25AA\u25A0\u2022\u25E6\u25AB\u25CF\u25BA\uFFFD]/g, ' ')
    .replace(/[\s\u00A0\u2000-\u200A\u202F\u205F\u3000]+/g, ' ')
    .toLowerCase()
    .replace(/ ([.,;:!?)\]])/g, '$1')
    .replace(/([(\[]) /g, '$1')
    .replace(/ ?\/ ?/g, '/')
    .trim();
}
function stripMarkup(line) {
  let l = String(line);
  l = l.replace(/\*\*/g, '').replace(/~~/g, '');
  l = l.replace(/^\s*-\s+(?=\d+\.\s)/, '');          // "- 1. Select" -> "1. Select"
  l = l.replace(/^\s*-\s+/, '');                       // bullet
  const t = l.trim();
  if (/^\*[^*]/.test(t) && /\*$/.test(t)) l = t.slice(1, -1);   // *italic line*
  return l;
}
const normApp = s => norm(stripMarkup(s));
// the app's text as one string (lines joined with a space), for whole-field comparison
const normField = s => norm(String(s || '').split('\n').map(stripMarkup).join(' '));
// sentences of a normalised string (split after . ! ? followed by a space)
const sentences = n => n.split(/(?<=[.!?])\s+(?=\S)/).filter(x => x.length);

/* ------------------------------------------------------------------ sources */
const sha256 = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const rel = f => path.relative(ROOT, f);
function must(f, hint) {
  if (!fs.existsSync(f)) { console.error('missing source: ' + rel(f) + (hint ? '\n  ' + hint : '')); process.exit(2); }
  return f;
}
const GWFILES = {
  core: 'eng_01-06_warhammer40k_new40k_core_rules-was6fbu1ix-hfewhmxyiy.pdf',
  uru: 'eng_wh40k_coreandkey_universal_rules_updates-lu3grocned-rphh78bl6k.pdf'
};
const GWLABEL = {
  core: 'GW Core Rules (11th edition, 01/06/2026)', uru: 'GW Universal Rules Updates v1.1'
};
// each faction's GW Faction Pack, from sources/factions.json (Orks have none: Wahapedia is the source)
for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(path.join(VERIFY, 'sources', 'factions.json'), 'utf8'))))
  if (k[0] !== '_' && v.pack) { GWFILES['pack:' + k] = v.pack.file; GWLABEL['pack:' + k] = v.pack.label; }
const DOCS = {};

// Joining two normalised source lines: no space after a word-hyphen ("battle-" + "shock"), after "/", "(" or "[",
// or before punctuation; otherwise one space.
const glueOf = (prev, n) => ((/[a-z]-$/.test(prev) && /^[a-z]/.test(n)) || /[\/(\[]$/.test(prev) || /^[\/.,;:!?)\]]/.test(n)) ? '' : ' ';
function joinNorm(lines) {
  let out = '', prev = '';
  for (const raw of lines) {
    const n = norm(String(raw).replace(/\*\*/g, '').replace(/~~/g, '').replace(/^\s*-\s+/, ''));
    if (!n) continue;
    out += (out ? glueOf(prev, n) : '') + n; prev = n;
  }
  return out;
}
// A document = pages of lines. Index: one normalised string with each line's start offset and page.
function makeDoc(id, label, file, pages, kind) {
  const d = { id, label, file: rel(file), sha256: sha256(file), kind, pages };
  const parts = [], starts = [], lineRef = [];
  let len = 0, prevRaw = '';
  pages.forEach((p, pi) => p.lines.forEach((raw, li) => {
    const n = norm(raw.replace(/\*\*/g, '').replace(/~~/g, '').replace(/^\s*-\s+/, ''));
    if (!n) return;
    // a line that ends in a hyphen inside a word joins the next line without a space ("battle-" + "shock")
    const glue = len === 0 ? '' : glueOf(prevRaw, n);
    len += glue.length;
    starts.push(len); lineRef.push({ page: pi, line: li });
    parts.push(glue + n); len += n.length; prevRaw = n;
  }));
  d.N = parts.join('');
  d.starts = starts; d.lineRef = lineRef;
  DOCS[id] = d;
  return d;
}
function lineAt(d, off) {   // index of the line containing offset off
  let lo = 0, hi = d.starts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (d.starts[mid] <= off) lo = mid; else hi = mid - 1; }
  return lo;
}
function pageRange(d, p0, p1) {   // [start, end) offsets of pages p0..p1 (0-based, inclusive)
  let s = -1, e = -1;
  d.lineRef.forEach((r, i) => { if (r.page >= p0 && r.page <= p1) { if (s < 0) s = d.starts[i]; e = i; } });
  if (s < 0) return [0, 0];
  const end = e + 1 < d.starts.length ? d.starts[e + 1] : d.N.length;
  return [s, end];
}
const isWord = c => !!c && /[a-z0-9]/.test(c);
// every offset where needle occurs in d.N within [from, to), on word boundaries
function findAll(d, needle, from = 0, to = d.N.length) {
  const out = [];
  if (!needle) return out;
  let i = d.N.indexOf(needle, from);
  while (i >= 0 && i + needle.length <= to) {
    const okL = !isWord(needle[0]) || !isWord(d.N[i - 1]);
    const okR = !isWord(needle[needle.length - 1]) || !isWord(d.N[i + needle.length]);
    if (okL && okR) out.push(i);
    i = d.N.indexOf(needle, i + 1);
  }
  return out;
}
function where(d, off) {
  const r = d.lineRef[lineAt(d, off)];
  const p = d.pages[r.page];
  if (d.kind === 'wahahtml') {
    // the nearest line above that is a numbered heading ("Hazard Rolls 06.03", "24.28.01 Precision and …")
    for (let pi = r.page, li = r.line; pi >= 0; pi--, li = pi >= 0 ? d.pages[pi].lines.length - 1 : 0)
      for (; li >= 0; li--) {
        const l = d.pages[pi].lines[li];
        if (l.length < 90 && (/^(\d\. )?[A-Z0-9][^.]{1,80} \d\d\.\d\d(\.\d\d)?$/.test(l) || /^\d\d\.\d\d(\.\d\d)? [A-Z][^.]{1,80}$/.test(l)) && !/^\d+$/.test(l)) return d.label + ' § ' + l;
      }
  }
  return p.where;
}

// GW PDFs: pdftotext -raw (content-stream order keeps each text frame together), one page per form feed
function loadPdf(id) {
  const f = must(path.join(CACHE, 'gw', GWFILES[id]), 'run: sh verify/fetch.sh');
  let txt;
  try { txt = execFileSync('pdftotext', ['-raw', '-enc', 'UTF-8', f, '-'], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch (e) { console.error('pdftotext (poppler) is needed to read ' + rel(f)); process.exit(2); }
  const pages = txt.split('\f').map((t, i) => ({ where: 'PDF p' + (i + 1), lines: t.split('\n') }));
  if (pages.length && !pages[pages.length - 1].lines.join('').trim()) pages.pop();
  return makeDoc(id, GWLABEL[id], f, pages, 'gw');
}

// Wahapedia faction text (waha-extract.py): sections "######## <name>"
function loadWahaTxt(faction) {
  const f = must(path.join(CACHE, 'waha', faction + '.txt'),
    'make it with: python3 -I verify/waha-extract.py verify/.cache/waha/' + faction + '.html verify/.cache/waha/' + faction + '.txt');
  const pages = [];
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = /^######## (.*)$/.exec(line);
    if (m) { pages.push({ where: 'Wahapedia ' + faction + ' § ' + m[1].trim(), section: m[1].trim(), lines: [] }); continue; }
    if (pages.length) pages[pages.length - 1].lines.push(line);
  }
  return makeDoc('waha:' + faction, 'Wahapedia ' + faction + ' (text)', f, pages, 'waha');
}

// Wahapedia HTML page flattened to lines (all of its text, including FAQ/errata spoilers and tooltip headers),
// for words the text extraction leaves out. The section is the last heading seen.
const VOID = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr', 'param']);
const BLOCK = new Set(['div', 'p', 'br', 'li', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'table', 'ul', 'ol', 'tbody', 'thead', 'section']);
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', times: '×', deg: '°', middot: '·', bull: '•', shy: '' };
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (e.toLowerCase() in ENT ? ENT[e.toLowerCase()] : m));
function flattenHtml(html) {
  html = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, '');
  const out = [], heads = [];
  let cur = '', skip = 0;
  const stack = [];
  const flush = () => { if (cur.trim()) out.push(cur); cur = ''; };
  const re = /<(\/?)([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  let m, headBuf = null;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) { if (!skip) { const t = decode(m[4]); cur += t; if (headBuf !== null) headBuf += t; } continue; }
    const close = m[1] === '/', name = m[2].toLowerCase(), attrs = m[3] || '';
    if (!close) {
      const selfClose = VOID.has(name) || /\/\s*$/.test(attrs);
      const drop = /class="[^"]*\b(page_ads\w*|NavDropdown|DetFilterCols)\b/.test(attrs);
      if (BLOCK.has(name) && !skip) flush();
      if (/^h[1-4]$/.test(name) && !skip) headBuf = '';
      if (!selfClose) { stack.push({ name, drop }); if (drop) skip++; }
    } else {
      // pop to the matching tag (tolerates unclosed tags)
      let k = stack.length - 1; while (k >= 0 && stack[k].name !== name) k--;
      if (k >= 0) { while (stack.length > k) { const t = stack.pop(); if (t.drop) skip--; } }
      if (BLOCK.has(name) && !skip) flush();
      if (/^h[1-4]$/.test(name) && headBuf !== null) { heads.push({ at: out.length, text: headBuf.replace(/\s+/g, ' ').trim() }); headBuf = null; }
    }
  }
  flush();
  return { lines: out.map(l => l.replace(/[ \t\u00A0]+/g, ' ').trim()).filter(Boolean), heads };
}
function loadWahaHtml(id, file, label) {
  const f = must(file, 'run: sh verify/fetch.sh');
  const { lines, heads } = flattenHtml(fs.readFileSync(f, 'utf8'));
  // pages = runs of lines under one heading
  const pages = [];
  let hi = 0, curHead = '(top)';
  let page = { where: label + ' § ' + curHead, lines: [] };
  lines.forEach((l, i) => {
    while (hi < heads.length && heads[hi].at <= i) { curHead = heads[hi].text || curHead; hi++; if (page.lines.length) pages.push(page); page = { where: label + ' § ' + curHead, lines: [] }; }
    page.lines.push(l);
  });
  if (page.lines.length) pages.push(page);
  return makeDoc(id, label, f, pages, 'wahahtml');
}

function loadPacket() {
  const f = must(path.join(VERIFY, 'sources', 'packet', 'core-stratagems.txt'));
  const pages = fs.readFileSync(f, 'utf8').split('\f').map((t, i) => ({ where: 'packet core-stratagems p' + (i + 1), lines: t.split('\n') }));
  return makeDoc('packet', 'Packet core stratagems (Wahapedia print, 10/3/26)', f, pages, 'packet');
}


/* ------------------------------------------------------------------ load */
global.window = {};
require(DATA);
const D = window.WH_DATA;
const FACTIONS = Object.keys(D.factions);
for (const id of Object.keys(GWFILES)) if (id.startsWith('pack:') && !D.factions[id.slice(5)]) { delete GWFILES[id]; delete GWLABEL[id]; }   // only the packs of factions in data.js

for (const id of Object.keys(GWFILES)) loadPdf(id);
for (const f of FACTIONS) loadWahaTxt(f);
for (const f of FACTIONS) loadWahaHtml('wahahtml:' + f, path.join(CACHE, 'waha', f + '.html'), 'Wahapedia ' + f);
loadWahaHtml('wahahtml:core', path.join(CACHE, 'waha', 'core.html'), 'Wahapedia core rules');
loadPacket();

if (process.argv.includes('--find')) {   // debugging aid: node verify/texts.js --find "some text" [--ctx 200]
  const q = norm(arg('--find')), ctx = +arg('--ctx', 200);
  for (const d of Object.values(DOCS)) {
    let i = d.N.indexOf(q);
    while (i >= 0) { console.log('[' + d.id + ' ' + where(d, i) + '] …' + d.N.slice(Math.max(0, i - ctx), i + q.length + ctx) + '…\n'); i = d.N.indexOf(q, i + 1); }
  }
  process.exit(0);
}

/* ------------------------------------------------------------------ results */
const checked = {};
const failures = [];
const prov = [];       // provenance rows
const appWritten = []; // app-written sentences found inside verbatim fields
const info = [];       // not failures: where the sources differ from each other and the app follows the right one
const count = (cat, n = 1) => { checked[cat] = (checked[cat] || 0) + n; };
function fail(cat, army, unit, field, app, source, where) { failures.push({ cat, army, unit, field, app, source, where }); }
function provRow(item, field, d, off, extra) {
  prov.push(Object.assign({ item, field, doc: d.label, file: d.file, sha256: d.sha256, where: off == null ? null : where(d, off) }, extra || {}));
}
// search a normalised needle in docs (in order), returns { d, off } of the first doc that has it
function locate(needle, docIds, prefer) {
  for (const id of docIds) {
    const d = DOCS[id]; if (!d) continue;
    const hits = findAll(d, needle);
    if (hits.length) {
      let off = hits[0];
      if (prefer && prefer.d === d) { const after = hits.find(h => h >= prefer.off); if (after != null) off = after; }
      return { d, off, n: hits.length };
    }
  }
  return null;
}
// the source text closest to an app sentence that was not found: longest prefix that is found
function nearest(needle, docIds) {
  let lo = 0, hi = needle.length, best = null;
  const raw = q => { for (const id of docIds) { const d = DOCS[id]; if (!d) continue; const i = d.N.indexOf(q); if (i >= 0) return { d, off: i }; } return null; };
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const r = raw(needle.slice(0, mid));
    if (r) { lo = mid; best = r; } else hi = mid - 1;
  }
  if (!best || lo < 12) return { text: '(no part of it found)', where: '' };
  const s = best.d.N.slice(best.off, best.off + Math.max(needle.length + 40, lo + 80));
  return { text: '…matches up to "' + needle.slice(Math.max(0, lo - 40), lo) + '" then source has: "' + best.d.N.slice(best.off + lo, best.off + lo + 120) + '"', where: where(best.d, best.off), full: s };
}

/* ------------------------------------------------------------------ line classes */
// Lines of a rules text, by what they claim to be:
//   appnote   "*App note, not rules text: …*"                  the app's own words, not checked (listed)
//   wfaq      "*Wahapedia FAQ: <question>? <answer>*"          Wahapedia FAQ (question and answer checked)
//   werrata   "*Wahapedia … errata (…): …*"                    Wahapedia errata
//   packfaq   "*FAQ (Faction Pack …): …*"                       the Faction Pack's FAQ
//   appsec    "**NN.NN Title (app):** text"                    Wahapedia rules appendix
//   sec       "**NN.NN Title:** text"                          a Core Rules section, quoted with its number
//   text      anything else (italic lines included)            word for word from the field's source
function classify(line) {
  const t = line.trim();
  let m;
  if (/^\*App note\b/.test(t)) return { kind: 'appnote', body: t };
  if ((m = /^\*Wahapedia FAQ:\s*(.*)\*$/.exec(t))) return { kind: 'wfaq', body: m[1] };
  if ((m = /^\*Wahapedia ([^:]*?)errata \(([^)]*)\):\s*(.*)\*$/.exec(t))) return { kind: 'werrata', body: m[3], ref: m[2] };
  if ((m = /^\*FAQ \(Faction Pack[^)]*\):\s*(.*)\*$/.exec(t))) return { kind: 'packfaq', body: m[1] };
  // a line only Wahapedia's core rules print, marked as such ("*Wahapedia core rules (not in GW’s Core Rules PDF, 01-06): …*")
  if ((m = /^\*Wahapedia core rules \(([^)]*)\):\s*(.*)\*$/.exec(t))) return { kind: 'wcore', body: m[2], ref: m[1] };
  if ((m = /^\*\*(?:(\d\d\.\d\d(?:\.\d\d)?) )?([^*]+?) \(app\):\*\*\s*(.*)$/.exec(t))) return { kind: 'appsec', num: m[1] || '', title: m[2], body: m[3] };
  if ((m = /^\*\*(\d\d\.\d\d(?:\.\d\d)?) ([^*]+?):\*\*\s*(.*)$/.exec(t))) return { kind: 'sec', num: m[1], title: m[2], body: m[3] };
  return { kind: 'text', body: t };
}
// the documents a text was looked for in, named so that adding a faction (and its pack) leaves the message as it was
const docsLabel = docs => { const named = docs.filter(d => !d.startsWith('pack:')), packs = docs.length - named.length;
  return named.concat(packs ? ['the Faction Packs'] : []).join(', '); };
// (Wahapedia's core rules page also carries the rules-appendix passages the app labels "(app)")
const WAHA_CORE = ['wahahtml:core'];
const GW_ALL = ['core', 'uru'].concat(Object.keys(GWFILES).filter(k => k.startsWith('pack:')));

// check one line's body against docs: the whole line, word for word (after normalisation)
//  - fallback "label colon": the app writes a heading or a table cell that the source prints on its own as
//    "Label: text"; accepted when the source has the label immediately followed by the text (label up to 100 characters)
function checkLine(body, docs, lessDocs, prev) {
  const n = normApp(body);
  if (!n) return { ok: true };
  let r = locate(n, docs, prev);
  if (r) return { ok: true, at: r };
  const lc = /^([^:]{2,100}): (.+)$/.exec(n);
  if (lc && (r = locate(lc[1] + ' ' + lc[2], docs, prev))) return { ok: true, at: r, labelColon: true };
  if (/^[^:]{2,100}:$/.test(n) && (r = locate(n.slice(0, -1), docs, prev))) return { ok: true, at: r, labelColon: true };
  // not in the authoritative documents: is it in a less authoritative one?
  if (lessDocs && lessDocs.length) {
    const l = locate(n, lessDocs) || (lc && locate(lc[1] + ' ' + lc[2], lessDocs));
    if (l) return { ok: false, less: l, n };
  }
  const miss = sentences(n).filter(x => !locate(x, docs) && !(lessDocs && locate(x, lessDocs)));
  return { ok: false, n, miss, near: nearest(n, docs) };
}
const labelColons = [];

/* ------------------------------------------------------------------ check: texts made of lines */
// Every line of a rules text must be found word for word (after normalisation) in the documents its class allows.
// A plain line after a "**NN.NN Title:**" line belongs to that section (same documents) until the next such line.
// gwDocs: the authoritative documents for plain lines; wahaDocs: where Wahapedia lines (FAQ, errata, appendix) live.
// special(lineNorm) can claim a line (e.g. a table the app writes as a list) and return a result itself.
function checkLines(cat, army, unit, field, text, gwDocs, wahaDocs, opts = {}) {
  let prev = null, block = null;
  const item = [army, unit, field].join(' / ');
  for (const raw of String(text || '').split('\n')) {
    if (!raw.trim()) continue;
    let c = classify(raw);
    if (c.kind === 'appsec' || c.kind === 'sec') block = c.kind;
    else if (c.kind === 'text' && block) c = { kind: block, body: c.body, inherited: true };
    count(cat);
    if (c.kind === 'appnote') { appWritten.push({ army, unit, field, text: raw.trim(), marked: true }); continue; }
    if (opts.special) { const sp = opts.special(raw); if (sp) { if (sp.ok) { if (sp.at) provRow(item, field, sp.at.d, sp.at.off, { text: raw.trim().slice(0, 80), how: sp.how }); } else fail(cat, army, unit, field, raw.trim(), sp.source, sp.where || ''); continue; } }
    let docs = gwDocs, less = wahaDocs, parts = [c.body];
    if (c.kind === 'wcore') { docs = WAHA_CORE; less = null; }
    else if (c.kind === 'wfaq') {
      docs = wahaDocs; less = null;
      const q = /^(.*?\?)\s+(.*)$/.exec(c.body);
      parts = q ? [q[1], q[2]] : [c.body];
    } else if (c.kind === 'werrata' || c.kind === 'appsec') { docs = wahaDocs.concat(gwDocs); less = null; }
    else if (c.kind === 'packfaq') {
      docs = opts.packDocs || gwDocs; less = wahaDocs;
      const q = /^(.*?\?)\s+(.*)$/.exec(c.body);   // "<question>? <answer>": both word for word (the pack prints "Q: … A: …")
      parts = q ? [q[1], q[2]] : [c.body];
    }
    if ((c.kind === 'appsec' || c.kind === 'sec') && !c.inherited) {
      // the quoted section heading must exist as "Title NN.NN" or "NN.NN Title"
      const hdocs = c.kind === 'appsec' ? wahaDocs : gwDocs;
      const hd = c.num ? [norm(c.title + ' ' + c.num), norm(c.num + ' ' + c.title)] : [norm(c.title), norm(c.title)];
      const h = locate(hd[0], hdocs) || locate(hd[1], hdocs);
      if (!h) {
        const hl = c.kind === 'sec' ? (locate(hd[0], wahaDocs) || locate(hd[1], wahaDocs)) : null;
        fail(cat, army, unit, field + ' (heading)', c.num + ' ' + c.title,
          hl ? 'heading only in the less authoritative ' + hl.d.label + '; ' + docsLabel(hdocs) + ' has no "' + c.title + ' ' + c.num + '"'
             : 'no heading "' + c.title + ' ' + c.num + '" in ' + docsLabel(hdocs), hl ? where(hl.d, hl.off) : '');
      }
    }
    for (const part of parts) {
      const r = checkLine(part, docs, less, prev);
      if (r.ok) {
        if (r.at) { provRow(item, field, r.at.d, r.at.off, { text: raw.trim().slice(0, 80) }); prev = r.at; }
        if (r.labelColon) labelColons.push(item + ': ' + raw.trim().slice(0, 60));
        continue;
      }
      if (r.less) {
        fail(cat, army, unit, field, raw.trim(), 'only in the less authoritative ' + r.less.d.label + ' (not in ' + docsLabel(docs) + ')', where(r.less.d, r.less.off));
        provRow(item, field, r.less.d, r.less.off, { text: raw.trim().slice(0, 80), lessAuthoritative: true });
        continue;
      }
      appWritten.push({ army, unit, field, text: raw.trim(), marked: false, missing: r.miss });
      fail(cat, army, unit, field, raw.trim(), r.near.text + (r.miss && r.miss.length ? ' | sentences not found: ' + JSON.stringify(r.miss) : ''), r.near.where);
    }
  }
}

/* ------------------------------------------------------------------ D.rules */
// Starting Strength: the Core Rules print a table (columns: starting strength of 1 / of 2 or more;
// rows: below starting strength / at half-strength / below half-strength); the app writes it as two lists.
// Each app row "Row label: cell" is checked against the cell of that row and column.
function startingStrengthTable() {
  const d = DOCS.core;
  const a = d.N.indexOf('unit strength starting strength of 1 starting strength of 2 or more');
  if (a < 0) return null;
  const b = d.N.indexOf('example:', a);
  const t = d.N.slice(a, b);
  const rows = ['below starting strength', 'at half-strength', 'below half-strength'];
  const out = {};
  rows.forEach((r, i) => {
    const s = t.indexOf(r + ' ', i ? t.indexOf(rows[i - 1] + ' ') + rows[i - 1].length : 0);
    const e = i + 1 < rows.length ? t.indexOf(rows[i + 1] + ' ', s + r.length) : t.length;
    const cells = t.slice(s + r.length, e).trim().split(/(?<=\.) /);
    out[r] = { cells, off: a + s };
  });
  return out;
}
const SS = startingStrengthTable();
function ssSpecial() {
  let col = null;
  return raw => {
    const n = normApp(raw);
    if (n === 'starting strength of 1:') { col = 0; return { ok: true, at: { d: DOCS.core, off: DOCS.core.N.indexOf('starting strength of 1') }, how: 'table column' }; }
    if (n === 'starting strength of 2 or more:') { col = 1; return { ok: true, at: { d: DOCS.core, off: DOCS.core.N.indexOf('starting strength of 2 or more') }, how: 'table column' }; }
    const m = /^(below starting strength|at half-strength|below half-strength): (.*)$/.exec(n);
    if (!m || col == null) return null;
    if (!SS) return { ok: false, source: 'Starting Strength table not found in the Core Rules' };
    const cell = SS[m[1]].cells[col];
    return cell === m[2] ? { ok: true, at: { d: DOCS.core, off: SS[m[1]].off }, how: 'table cell' }
      : { ok: false, source: 'table row "' + m[1] + '", column ' + (col ? '2 or more' : '1') + ': "' + cell + '"', where: where(DOCS.core, SS[m[1]].off) };
  };
}
for (const [key, text] of Object.entries(D.rules))   // a faction term (D.ruleSrc) comes from its faction's pages, as detachment texts do
  checkLines('rules', 'core', 'rule:' + key, 'text', text, (D.ruleSrc || {})[key] ? GW_ALL.concat(FACTIONS.map(f => 'wahahtml:' + f)) : GW_ALL, WAHA_CORE, key === 'Starting Strength' ? { special: ssSpecial() } : {});

/* ------------------------------------------------------------------ source parsers: stratagems */
// Lines of a document (page range) as { text, page, line }; the PDF extraction keeps each text frame together.
function docLines(d, p0 = 0, p1 = d.pages.length - 1) {
  const out = [];
  for (let pi = p0; pi <= p1 && pi < d.pages.length; pi++)
    d.pages[pi].lines.forEach((t, li) => {
      const c = t.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/\*\*/g, '').replace(/~~/g, '').trim();
      if (c) out.push({ text: c, page: pi, line: li, struck: struckOf(t) });
    });
  return out;
}
// struck-through words (Wahapedia's ~~x~~: a keyword that does not exist in that faction); compared on their own,
// since the normalisation drops the markers
const struckOf = t => [...String(t || '').matchAll(/~~(.+?)~~/g)].map(m => norm(m[1].replace(/\*\*/g, '')));
const sameStruck = (appText, lines) => struckOf(appText).join('|') === lines.flatMap(l => l.struck || []).join('|');
const LABEL = /^(WHEN|TARGET|EFFECT|RESTRICTIONS):\s*(.*)$/;
const isCaps = t => t.length >= 10 && / /.test(t) && !/[a-z]/.test(t) && /[A-Z]{3}/.test(t);
// Stratagem blocks: header (name, cp), then flavour text, then WHEN/TARGET/EFFECT/RESTRICTIONS fields.
// headerAt(lines, i) -> { name, cp } when line i starts a stratagem (or { stop: true } for a non-stratagem heading)
function parseStrats(lines, headerAt, stopAt) {
  const out = [];
  let cur = null, field = null;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].text;
    const h = headerAt(lines, i);
    if (h) { cur = h.stop ? null : { name: h.name, cp: h.cp, num: h.num, fields: {}, at: lines[i] }; if (cur) out.push(cur); field = null; i += h.skip || 0; continue; }
    if (!cur) continue;
    const m = LABEL.exec(t);
    if (m) { field = m[1].toLowerCase(); cur.fields[field] = [m[2]]; cur.struck = cur.struck || {}; cur.struck[field] = [].concat(lines[i].struck || []); continue; }
    if (stopAt(t, lines, i)) { cur = null; field = null; continue; }
    if (field) { cur.fields[field].push(t); cur.struck[field].push(...(lines[i].struck || [])); }
  }
  for (const s of out) for (const k of Object.keys(s.fields)) s.fields[k] = s.fields[k].filter(Boolean);
  return out;
}
const stopPdf = t => !/STRATAGEM$/.test(t) && (/^\d+$/.test(t) || /^\+?\d?CP$/.test(t) || /^\+\+/.test(t) || /^(ENHANCEMENTS|DETACHMENT RULES?|STRATAGEMS)$/.test(t) || isCaps(t));
// GW Core Rules section 15: "COMMAND RE-ROLL 15.02 1CP"
const coreHeader = (L, i) => {
  const m = /^([A-Z][A-Z’'\- !?]+?) (1[56]\.\d\d)(?: (\d)CP)?$/.exec(L[i].text);
  if (!m) return null;
  return m[3] ? { name: m[1], cp: +m[3], num: m[2] } : { stop: true };
};
// Faction Packs: "SCORN THE WITCH 1CP" / "NOBLE SACRIFICE" followed by "<DETACHMENT> ... STRATAGEM"
const packHeader = (L, i) => {
  const next = L[i + 1] && L[i + 1].text;
  if (!next || !/STRATAGEM$/.test(next) || /STRATAGEM$/.test(L[i].text)) return null;
  const m = /^(.*?\S)(?: (\d)CP)?$/.exec(L[i].text);
  return { name: m[1], cp: m[2] ? +m[2] : null };
};
// Wahapedia text: "CRAZED RAMPAGE" / "1CP" / "Dread Mob Stratagem"
const wahaHeader = (L, i) => {
  const a = L[i + 1] && L[i + 1].text, b = L[i + 2] && L[i + 2].text;
  if (a && /^\dCP$/.test(a) && b && /Stratagem$/.test(b) && !/[a-z]/.test(L[i].text)) return { name: L[i].text, cp: +a[0], skip: 2 };
  return null;
};
const stopWaha = (t, L, i) => /^(Enhancements|Stratagems|Detachment Rules?|FAQ|Errata|FAQ \/ Errata|Show)$/.test(t) || /^\dCP$/.test(t) || /Stratagem$/.test(t) || !!wahaHeader(L, i);


// first difference between two normalised strings, for the report
function diffAt(a, b) {
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i === a.length && i === b.length) return '';
  const k = Math.max(0, i - 30);
  return 'differs at "…' + a.slice(k, i) + '[' + a.slice(i, i + 40) + '…]" vs source "…' + b.slice(k, i) + '[' + b.slice(i, i + 40) + '…]"';
}
// compare one app field with one source field (both ways: equal after normalisation)
function sameField(appText, srcLines) {
  const a = normField(appText), b = joinNorm(srcLines);
  return { ok: a === b, a, b, diff: a === b ? '' : diffAt(a, b) };
}
// is the app field, with its label, word for word in a (less authoritative) document?
function inDoc(id, label, appText) {
  const d = DOCS[id]; if (!d) return null;
  const n = (label ? label + ': ' : '') + normField(appText);
  const h = findAll(d, n);
  return h.length ? { d, off: h[0] } : null;
}
const FIELDS = ['when', 'target', 'effect', 'restrictions'];

/* ------------------------------------------------------------------ core stratagems */
{
  const src = [];
  // (PDF p55 repeats two of them as an example; the section itself, later in the document, wins)
  for (const s of parseStrats(docLines(DOCS.core), coreHeader, stopPdf)) { const k = src.findIndex(x => norm(x.name) === norm(s.name)); if (k >= 0) src[k] = s; else src.push(s); }
  // the packet (Wahapedia print): names, numbers and CP from its header lines
  const packet = [];
  DOCS.packet.pages.forEach((p, pi) => p.lines.forEach(l => {
    const m = /^\s*([A-Z][A-Z’'\- !?]+?) (15\.\d\d)\s+(\d)CP\s*$/.exec(l);
    if (m) packet.push({ name: m[1].trim(), num: m[2], cp: +m[3], page: pi });
  }));
  const app = D.coreStratagems;
  for (const s of src) {
    count('coreStrat');
    if (!app.some(a => norm(a.name) === norm(s.name))) fail('coreStrat', 'core', 'stratagem:' + s.name, 'missing', '', s.name + ' (' + s.cp + 'CP) is in the Core Rules but not in D.coreStratagems', DOCS.core.pages[s.at.page].where);
  }
  for (const s of packet) {
    count('coreStrat');
    if (!app.some(a => norm(a.name) === norm(s.name))) fail('coreStrat', 'core', 'stratagem:' + s.name, 'missing', '', s.name + ' ' + s.num + ' (' + s.cp + 'CP) is in the packet but not in D.coreStratagems', DOCS.packet.pages[s.page].where);
  }
  for (const a of app) {
    const item = 'core / coreStratagem:' + a.id;
    const s = src.find(x => norm(x.name) === norm(a.name));
    const pk = packet.find(x => norm(x.name) === norm(a.name));
    count('coreStrat');
    if (!s) { fail('coreStrat', 'core', 'coreStratagem:' + a.id, 'name', a.name, 'no core stratagem of this name in the Core Rules (section 15)' + (pk ? '; the packet has it' : ''), ''); continue; }
    const wh = DOCS.core.pages[s.at.page].where + ' (' + s.num + ')';
    provRow(item, 'name', DOCS.core, DOCS.core.starts[0], { where: wh });
    count('coreStrat');
    if (a.cp !== s.cp) fail('coreStrat', 'core', 'coreStratagem:' + a.id, 'cp', String(a.cp), s.cp + 'CP', wh);
    if (pk && pk.cp !== s.cp) fail('coreStrat', 'core', 'coreStratagem:' + a.id, 'cp (packet)', String(a.cp), 'packet prints ' + pk.cp + 'CP, the Core Rules ' + s.cp + 'CP', wh);
    for (const f of FIELDS) {
      if (a[f] == null && !s.fields[f]) continue;
      count('coreStrat');
      const r = sameField(a[f] || '', s.fields[f] || []);
      prov.push({ item, field: f, doc: DOCS.core.label, file: DOCS.core.file, sha256: DOCS.core.sha256, where: wh });
      if (r.ok) continue;
      const w = inDoc('wahahtml:core', f, a[f] || '');
      fail('coreStrat', 'core', 'coreStratagem:' + a.id, f, a[f] || '(none)',
        (w ? 'matches the less authoritative Wahapedia core rules, not the Core Rules: ' : '') + (s.fields[f] ? s.fields[f].join(' ') : '(no ' + f + ' section)') + ' | ' + r.diff, wh);
    }
  }
}

/* ------------------------------------------------------------------ source parsers: detachments */
const isHead = t => !/[a-z]/.test(t) && /[A-Z]{3}/.test(t) && !/^\d/.test(t) && !/\dCP$/.test(t) && !/[.,:;)\]]$/.test(t);
const SEGHEAD = /^(Detachment Rules?|Enhancements|Stratagems)$/;
const NOTEHEAD = /^(FAQ|Errata|FAQ \/ Errata)$/;
function wahaSection(faction, title) {
  const d = DOCS['waha:' + faction];
  const pi = d.pages.findIndex(p => p.section && norm(p.section).replace(/ \d+dp$/, '') === norm(title));
  return pi < 0 ? null : { d, pi, page: d.pages[pi] };
}
// Wahapedia detachment: "Detachment Rule(s)" name + body, "Enhancements" "- Name N pts" + body, "Stratagems" blocks
function wahaDetachment(faction, name) {
  const sec = wahaSection(faction, name); if (!sec) return null;
  const L = docLines(sec.d, sec.pi, sec.pi);
  const dp = /(\d+)DP$/.exec(sec.page.section);
  const res = { dp: dp ? +dp[1] : null, where: sec.page.where, d: sec.d, rule: null, enh: [], strats: [] };
  let seg = null, cur = null, inNote = false;
  for (let i = 0; i < L.length; i++) {
    const t = L[i].text;
    if (SEGHEAD.test(t)) { seg = /^Detachment/.test(t) ? 'rule' : t === 'Enhancements' ? 'enh' : 'strat'; cur = null; inNote = false; if (seg === 'rule') res.rule = { name: null, body: [] }; continue; }
    if (NOTEHEAD.test(t)) { inNote = true; continue; }
    if (seg === 'rule') { if (inNote) continue; if (!res.rule.name) { res.rule.name = t; res.rule.at = L[i]; } else res.rule.body.push(L[i]); }
    else if (seg === 'enh') {
      const m = /^- (.+?)\s*(UPGRADE)?\s*(\d+) pts$/.exec(t);
      if (m) { cur = { name: m[1].trim(), upgrade: !!m[2], pts: +m[3], body: [], at: L[i] }; res.enh.push(cur); inNote = false; continue; }
      if (cur && !inNote) cur.body.push(L[i]);
    }
  }
  res.strats = parseStrats(L, wahaHeader, stopWaha);
  return res;
}
// Faction Pack: the contents page names the detachments it prints; each starts on the page whose first line is its name
function packContents(d) {
  const toc = [];
  let group = null;
  for (const raw of d.pages[0].lines) {
    const t = raw.replace(/[\x00-\x1F�]/g, ' ').replace(/\s+/g, ' ').trim();
    const m = /^(.+?) ?(\d+)$/.exec(t);
    if (!m) continue;
    if (/^(Detachments|Datasheets|Imperial Armour Datasheets|Rules Updates|Legends Datasheets)$/.test(m[1])) { group = m[1]; toc.push({ name: m[1], page: +m[2], group: 'top' }); continue; }
    toc.push({ name: m[1], page: +m[2], group });
  }
  return toc;
}
const squash = t => norm(t).replace(/[^a-z0-9]/g, '');
function packDetachment(faction, name) {
  const d = DOCS['pack:' + faction]; if (!d) return null;
  const toc = packContents(d);
  const k = toc.findIndex(e => e.group === 'Detachments' && norm(e.name) === norm(name));
  if (k < 0) return null;
  const p0 = d.pages.findIndex((p, pi) => pi > 0 && p.lines.some(l => l.trim()) && squash(p.lines.find(l => l.trim())) === squash(name));
  if (p0 < 0) return { error: 'detachment ' + name + ' is in the contents but no page starts with its name', d };
  const p1 = p0 + (toc[k + 1].page - toc[k].page) - 1;
  const L = docLines(d, p0, p1);
  const res = { d, pages: [p0, p1], where: d.label + ' PDF p' + (p0 + 1) + (p1 > p0 ? '-' + (p1 + 1) : ''), rule: null, enh: [], strats: [] };
  let seg = null, cur = null;
  for (let i = 0; i < L.length; i++) {
    const t = L[i].text;
    if (/^DETACHMENT RULES?$/.test(t)) { seg = 'rule'; res.rule = { name: null, body: [] }; continue; }
    if (t === 'ENHANCEMENTS') { seg = 'enh'; cur = null; continue; }
    if (packHeader(L, i) || /STRATAGEM$/.test(t) || /^\d+$/.test(t) || /^\dCP$/.test(t)) { seg = null; continue; }
    if (seg === 'rule') {
      if (!res.rule.name) { res.rule.name = t; res.rule.at = L[i]; continue; }
      if (isHead(t)) { seg = null; continue; }
      res.rule.body.push(L[i]);
    } else if (seg === 'enh') {
      if (isHead(t)) { const m = /^(.*?)( UPGRADE)?$/.exec(t); cur = { name: m[1], upgrade: !!m[2], body: [], at: L[i] }; res.enh.push(cur); continue; }
      if (cur) cur.body.push(L[i]);
    }
  }
  res.strats = parseStrats(L, packHeader, stopPdf);
  // CP: on the name line ("SCORN THE WITCH 1CP"); else, when every CP badge on these pages is the same, that value
  const badges = [...new Set(L.filter(l => /^\dCP$/.test(l.text)).map(l => +l.text[0]))];
  for (const st of res.strats) if (st.cp == null && badges.length === 1) { st.cp = badges[0]; st.cpFrom = 'the CP badges on these pages (all ' + badges[0] + 'CP)'; }
  return res;
}


/* ------------------------------------------------------------------ source parsers: Faction Pack Rules Updates */
// Entries: [section header] title line(s), an instruction ("Change to:", "Change first paragraph to:", "Add new ability:",
// "Change 9" to 8".") and, after a colon, the new text (quoted: up to the closing quote; unquoted: up to the next title).
const isCapsHeader = t => /^(ARMY RULES|DATASHEETS|UPDATES|FAQS|[A-Z][A-Z’' \-]+ DETACHMENT)$/.test(t);
const isInstr = t => /^([▪■]\s*)?(Change\b|Add new\b|Add ['‘]|Remove ['‘])/.test(t) || /^[▪■]\s*[A-Z][\w ,–-]*:\s*(Change\b|Add ['‘]|Remove ['‘])/.test(t);
function packUpdates(fk) {
  const d = DOCS['pack:' + fk]; if (!d) return [];
  const p0 = d.pages.findIndex(p => p.lines.some(l => l.trim() === 'RULES UPDATES'));
  if (p0 < 0) return [];
  let p1 = d.pages.findIndex((p, i) => i > p0 && p.lines.some(l => /WARHAMMER L E G E N D S/.test(l)));
  p1 = (p1 < 0 ? d.pages.length : p1) - 1;
  const L = docLines(d, p0, p1);
  const start = L.findIndex(l => l.text === 'UPDATES'), stop = L.findIndex(l => l.text === 'FAQS');
  const out = [];
  let section = null, title = [], cur = null, mode = null;
  for (let i = start + 1; i < (stop < 0 ? L.length : stop); i++) {
    const t = L[i].text;
    if (mode === 'text') {
      // the text ends at a section header, before a title (a line followed by an instruction), or at its closing quote
      // (some quoted texts in the packs have no closing quote, some have no opening one: a line that closes a quote
      // is the text's last line, not the next entry's title)
      const n1 = L[i + 1] && L[i + 1].text, n2 = L[i + 2] && L[i + 2].text;
      const prevEnds = cur.text.length > 0 && /[.’'"]$/.test(cur.text[cur.text.length - 1]);
      if (isCapsHeader(t) || isInstr(t) || (n1 && isInstr(n1) && !/\.['’]$/.test(t)) ||
          (!cur.quoted && prevEnds && n2 && isInstr(n2) && !isInstr(n1 || '') && !/[.’']$/.test(t))) mode = null;   // two-line title
      else {
        if (cur.quoted == null) cur.quoted = /^([▪■]\s*)?['‘]/.test(t);
        cur.text.push(t);
        if (cur.quoted && /['’]\.?$/.test(t) && cur.text.join(' ').replace(/[▪■'‘’\s]/g, '').length > 0) mode = null;
        continue;
      }
    }
    if (isCapsHeader(t)) { section = t; title = []; continue; }
    if (isInstr(t)) {
      // "Change <part> to:" right after another entry, with no title of its own, is under that entry's title
      // ("Doctrina Imperatives / Change Protector Imperative to: … / Change Conqueror Imperative to: …")
      const prev = out[out.length - 1];
      const cont = !title.length && prev && prev.section === section && /^Change .+ to:$/.test(t);
      cur = { section, title: cont ? prev.title : title.join(' '), instr: t, text: [], quoted: null, at: L[i], d };
      out.push(cur); title = [];
      const m = /:\s*(.*)$/.exec(t);
      if (m) { mode = 'text'; if (m[1]) { cur.quoted = /^['‘]/.test(m[1]); cur.text.push(m[1]); if (cur.quoted && /['’]\.?$/.test(m[1]) && m[1].replace(/[▪■'‘’\s]/g, '').length > 0) mode = null; } }
      continue;
    }
    title.push(t);
  }
  for (const e of out) {
    // the new text without its enclosing quotes; "TARGET: …" / "EFFECT: …" sections split out
    let txt = e.text.join('\n').replace(/^([▪■]\s*)?['‘]\s*/, '').replace(/['’](\.)?\s*$/, (m0, dot) => dot ? '.' : '');
    e.newText = txt;
    e.where = d.label + ' ' + d.pages[e.at.page].where + ', Rules Updates: ' + (e.section || '') + ' / ' + e.title;
    const parts = {}; let k = null;
    for (const line of txt.split('\n')) { const m = LABEL.exec(line.trim()); if (m) { k = m[1].toLowerCase(); parts[k] = [m[2]]; } else if (k) parts[k].push(line); }
    e.fields = parts;
  }
  return out;
}

if (process.argv.includes('--debug-updates')) {
  for (const fk of FACTIONS) for (const e of packUpdates(fk)) console.log('[' + fk + '] {' + e.section + '} ' + e.title + ' || ' + e.instr + '\n    ' + JSON.stringify(e.newText).slice(0, 300));
  process.exit(0);
}
if (process.argv.includes('--debug-dets')) {
  const show = (r) => { if (!r) return console.log('  (none)'); console.log('  where', r.where, 'dp', r.dp); if (r.rule) console.log('  RULE', r.rule.name, '::', r.rule.body.map(l => l.text).join(' | ')); for (const e of r.enh) console.log('  ENH', e.name, e.pts, '::', e.body.map(l => l.text).join(' | ')); for (const st of r.strats) { console.log('  STRAT', st.name, st.cp); for (const [k, v] of Object.entries(st.fields)) console.log('     ', k, ':', v.join(' | ')); } };
  for (const [fk, f] of Object.entries(D.factions)) for (const [id, det] of Object.entries(f.detachments)) {
    console.log('=== ' + fk + ' / ' + det.name + ' — WAHAPEDIA'); show(wahaDetachment(fk, det.name));
    console.log('=== ' + fk + ' / ' + det.name + ' — PACK'); show(packDetachment(fk, det.name));
  }
  process.exit(0);
}

/* ------------------------------------------------------------------ factions: helpers */
const armiesOf = fk => D.armies.filter(a => a.faction === fk);
const armyIdsOf = fk => fk;   // faction rules are reported under the faction, so adding a list of it changes no report line
const usedDetachments = fk => [...new Set(armiesOf(fk).flatMap(a => a.detachments))];
const UPD = {}; for (const fk of FACTIONS) UPD[fk] = packUpdates(fk);
const usedUpdates = new Set();
// Rules Updates titles that misname the ability they change: the World Eaters pack's "Chaos Terminators, Blood Fury Ability"
// changes the datasheet's Bloody Fury (Wahapedia, BSData and New Recruit name it so; the new text is that ability's)
const TITLE_TYPOS = { 'chaos terminators, blood fury ability': 'chaos terminators, bloody fury ability' };
const titleN = e => { const t = norm(e.title).replace(/['"]/g, ''); return TITLE_TYPOS[t] || t; };
// a datasheet name in a Rules Updates title: at its start or after a separator, not the end of a longer name
// ("Eightbound" is not in "Exalted Eightbound, Rend and Tear Ability")
const nameInTitle = (n, t) => new RegExp('(^|[,–-]|(?<!\\p{L}) |(?<=\\band) )' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(,| –| -|$)', 'u').test(t);
const nameN = t => norm(t).replace(/['"]/g, '').replace(/\.\.\.$/, '').trim();
// app text vs the pack's "Change to" text: equal after normalisation
function checkUpdate(cat, army, unit, field, appText, e, part) {
  usedUpdates.add(e);
  const src = part != null ? part : e.newText;
  const a = normField(appText), b = joinNorm(String(src).split('\n'));
  count(cat);
  prov.push({ item: [army, unit, field].join(' / '), field, doc: e.d.label, file: e.d.file, sha256: e.d.sha256, where: e.where });
  if (a !== b) fail(cat, army, unit, field, appText, 'Rules Updates "' + e.instr + '": ' + b + ' | ' + diffAt(a, b), e.where);
  return a === b;
}
// "Change 9" to 8"." on an app text: the new value is there and the old one is not
function checkChangeValue(cat, army, unit, field, appText, e) {
  const m = /^(?:[▪■]\s*)?Change (\S+) to (\S+?)\.?$/.exec(e.instr);
  if (!m) return false;
  usedUpdates.add(e);
  count(cat);
  const a = normField(appText), from = norm(m[1]), to = norm(m[2]);
  prov.push({ item: [army, unit, field].join(' / '), field, doc: e.d.label, file: e.d.file, sha256: e.d.sha256, where: e.where });
  if (!a.includes(to) || a.includes(from)) fail(cat, army, unit, field, appText, 'Rules Updates: "' + e.instr + '"', e.where);
  return true;
}
// the pack prints flavour text and then the rule; the app's text must be the end of that block, starting at a sentence
function suffixOf(appText, bodyLines) {
  const a = normField(appText), b = joinNorm(bodyLines.map(l => l.text));
  if (b.endsWith(a)) { const pre = b.slice(0, b.length - a.length).trim(); if (!pre || /[.!?]$/.test(pre)) return { ok: true }; }
  // show where it goes wrong: longest common suffix
  let i = 0; while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return { ok: false, msg: 'source: "' + b + '" | the app text ' + (i === a.length ? 'starts mid-sentence' : 'differs before "…' + a.slice(a.length - i, a.length - i + 40) + '": app "' + a.slice(Math.max(0, a.length - i - 50), a.length - i) + '" vs source "' + b.slice(Math.max(0, b.length - i - 50), b.length - i) + '"') };
}
// the pack's block has flavour text before the rule, so a missing first sentence would still be a suffix: Wahapedia
// (no flavour text) shows where the rule starts; when its text is in the pack and is longer, the app has lost the start
function lostStart(appText, wahaLines, packBody) {
  if (!wahaLines || !wahaLines.length) return null;
  const a = normField(appText), w = joinNorm(wahaLines.map(l => l.text));
  if (w === a || !w.endsWith(a) || !suffixOf(wahaLines.map(l => l.text).join('\n'), packBody).ok) return null;
  return 'the source rule starts "' + w.slice(0, w.length - a.length).trim() + '" (in both the Faction Pack and Wahapedia); the app text starts later';
}
// Wahapedia weapon table inside an enhancement ("RANGED WEAPONS / RANGE / A / BS / S / AP / D / name+keywords / values")
function wahaWeapon(body) {
  const k = body.findIndex(l => /^(RANGED|MELEE) WEAPONS$/.test(l.text));
  if (k < 0) return null;
  const rest = body.slice(k + 1).map(l => l.text);
  const heads = []; let i = 0;
  while (i < rest.length && /^(RANGE|A|BS|WS|S|AP|D)$/.test(rest[i])) heads.push(rest[i++]);
  const names = []; while (i < rest.length && !/^(\d|-|Melee|N\/A)/.test(rest[i])) names.push(rest[i++]);
  const vals = rest.slice(i, i + heads.length);
  return { prose: body.slice(0, k), heads, nameKw: names[0] || '', vals, line: body[k] };
}
const WEAPON_LINE = /^(.+?): (\S+) A(\S+) (BS|WS)(\S+) S(\S+) AP(\S+) D(\S+) \[(.*)\]$/;

/* ------------------------------------------------------------------ factions: detachments */
for (const fk of FACTIONS) {
  const F = D.factions[fk];
  const army = armyIdsOf(fk);
  for (const detId of usedDetachments(fk)) {
    const det = F.detachments[detId];
    const U = 'detachment:' + detId;
    if (!det) { fail('detachment', army, U, 'missing', '', 'an army uses detachment ' + detId + ' but D.factions.' + fk + ' has no such detachment', ''); continue; }
    const W = wahaDetachment(fk, det.name);
    const P = packDetachment(fk, det.name);
    if (P && P.error) fail('detachment', army, U, 'source', det.name, P.error, P.d.label);
    const pack = P && !P.error ? P : null;
    count('detachment');
    if (!W) { fail('detachment', army, U, 'name', det.name, 'no Wahapedia section of this name in ' + DOCS['waha:' + fk].label, ''); continue; }
    const where = (pack ? pack.where + '; ' : '') + W.where;
    provRow(army + ' / ' + U, 'name', W.d, W.d.starts[0], { where: W.where });
    count('detachment');
    if (det.dp != null && W.dp != null && det.dp !== W.dp) fail('detachment', army, U, 'dp', String(det.dp), W.dp + 'DP', W.where);
    const upd = UPD[fk].filter(e => e.section && norm(e.section) === norm(det.name + ' detachment'));

    /* rule */
    const R = det.rule || {};
    const srcRule = pack ? pack.rule : W.rule;
    count('detachment');
    if (!srcRule || !srcRule.name) fail('detachment', army, U + '/rule', 'name', R.name || '', 'no detachment rule found in the source', where);
    else if (norm(R.name || '') !== norm(srcRule.name)) fail('detachment', army, U + '/rule', 'name', R.name || '', srcRule.name, where);
    const ruleUpd = upd.find(e => titleN(e) === nameN(R.name + ' detachment rule'));
    if (ruleUpd) checkUpdate('detachment', army, U + '/rule', 'text (Rules Updates)', R.text, ruleUpd);
    if (srcRule && srcRule.name) {
      count('detachment');
      if (pack && W.rule && !suffixOf(W.rule.body.map(l => l.text).join('\n'), srcRule.body).ok)
        info.push({ army, unit: U + '/rule', field: 'text', note: 'the Faction Pack and Wahapedia differ; the app is checked against the pack', wahapedia: joinNorm(W.rule.body.map(l => l.text)) });
      if (pack) {
        const r = suffixOf(R.text, srcRule.body);
        provRow(army + ' / ' + U + '/rule', 'text', pack.d, null, { where: pack.where });
        const ls = r.ok && lostStart(R.text, W.rule && W.rule.body, srcRule.body);
        if (ls) fail('detachment', army, U + '/rule', 'text', R.text, ls, pack.where);
        if (!r.ok) {
          const w = compareWahaBody(R.text, R.table, W.rule ? W.rule.body : [], W.rule ? W.rule.name : '');
          fail('detachment', army, U + '/rule', 'text', R.text, (w.length ? '' : 'matches the less authoritative Wahapedia text, not the Faction Pack: ') + r.msg, pack.where);
        }
      } else if (!ruleUpd) {
        const probs = compareWahaBody(R.text, R.table, srcRule.body, srcRule.name);
        prov.push({ item: army + ' / ' + U + '/rule', field: 'text', doc: W.d.label, file: W.d.file, sha256: W.d.sha256, where: W.where });
        for (const pr of probs) fail('detachment', army, U + '/rule', pr.app != null ? 'text' : 'text (missing)', pr.app || '', pr.msg + (pr.src ? ': ' + pr.src : ''), W.where);
        if (!sameStruck(R.text, srcRule.body)) fail('detachment', army, U + '/rule', 'text (struck through)', R.text, 'struck-through words differ from the source', W.where);
      }
    }

    /* enhancements: both ways */
    const srcEnh = pack ? pack.enh : W.enh;
    for (const se of srcEnh) {
      count('detachment');
      if (!(det.enhancements || []).some(e => norm(e.name) === norm(se.name)))
        fail('detachment', army, U + '/enhancement:' + se.name, 'missing', '', se.name + ' is in ' + (pack ? pack.where : W.where) + ' but not in the app', pack ? pack.where : W.where);
    }
    for (const e of det.enhancements || []) {
      const I = U + '/enhancement:' + e.name;
      const se = srcEnh.find(x => norm(x.name) === norm(e.name));
      const we = W.enh.find(x => norm(x.name) === norm(e.name));
      count('detachment');
      if (!se) { fail('detachment', army, I, 'name', e.name, 'not an enhancement of ' + det.name + ' in ' + (pack ? pack.where : W.where), ''); continue; }
      count('detachment');
      prov.push({ item: army + ' / ' + I, field: 'pts', doc: W.d.label, file: W.d.file, sha256: W.d.sha256, where: W.where });
      if (!we) fail('detachment', army, I, 'pts', String(e.pts), 'not on Wahapedia (the only source with points)', W.where);
      else if (e.pts !== we.pts) fail('detachment', army, I, 'pts', String(e.pts), we.pts + ' pts', W.where);
      const eu = upd.find(x => titleN(x) === nameN(e.name + ' enhancement'));
      if (eu) checkUpdate('detachment', army, I, 'text (Rules Updates)', e.text, eu);
      count('detachment');
      if (pack && we && !suffixOf(we.body.map(l => l.text).join('\n'), se.body).ok)
        info.push({ army, unit: I, field: 'text', note: 'the Faction Pack and Wahapedia differ; the app is checked against the pack', wahapedia: joinNorm(we.body.map(l => l.text)) });
      if (pack) {
        const r = suffixOf(e.text, se.body);
        provRow(army + ' / ' + I, 'text', pack.d, null, { where: pack.where });
        const ls = r.ok && lostStart(e.text, we && we.body, se.body);
        if (ls) fail('detachment', army, I, 'text', e.text, ls, pack.where);
        if (!r.ok) {
          const wOk = we && normField(e.text) === joinNorm(we.body.map(l => l.text));
          fail('detachment', army, I, 'text', e.text, (wOk ? 'matches the less authoritative Wahapedia text, not the Faction Pack: ' : '') + r.msg, pack.where);
        }
      } else if (!eu) {
        prov.push({ item: army + ' / ' + I, field: 'text', doc: W.d.label, file: W.d.file, sha256: W.d.sha256, where: W.where });
        const wt = wahaWeapon(se.body);
        if (wt) {
          // prose, then the weapon written as one line "Name: 24" A6 BS4+ S7 AP-2 D2 [KEYWORDS]"
          const lines = String(e.text).split('\n');
          const wl = lines.findIndex(l => WEAPON_LINE.test(stripMarkup(l).trim()));
          const prose = lines.filter((l, i) => i !== wl).join('\n');
          const a = normField(prose), b = joinNorm(wt.prose.map(l => l.text));
          if (a !== b) fail('detachment', army, I, 'text', prose, b + ' | ' + diffAt(a, b), W.where);
          count('detachment');
          const m = wl >= 0 ? WEAPON_LINE.exec(stripMarkup(lines[wl]).trim()) : null;
          const app = m ? { name: m[1], RANGE: m[2], A: m[3], [m[4]]: m[5], S: m[6], AP: m[7], D: m[8], kw: m[9] } : null;
          const src = {}; wt.heads.forEach((h, i) => { src[h] = wt.vals[i]; });
          const probs = [];
          if (!app) probs.push('no weapon line');
          else {
            for (const h of wt.heads) if (norm(app[h] || '') !== norm(src[h] || '')) probs.push(h + ' ' + app[h] + ' vs ' + src[h]);
            const nk = norm(wt.nameKw), an = norm(app.name);
            if (!nk.startsWith(an)) probs.push('name "' + app.name + '" vs "' + wt.nameKw + '"');
            else if (norm(app.kw.replace(/,\s*/g, ' ')) !== nk.slice(an.length).trim()) probs.push('keywords "' + app.kw + '" vs "' + wt.nameKw.slice(app.name.length).trim() + '"');
          }
          if (probs.length) fail('detachment', army, I, 'text (weapon)', wl >= 0 ? lines[wl] : '', probs.join('; '), W.where);
        } else {
          const a = normField(e.text), b = joinNorm(se.body.map(l => l.text));
          if (a !== b) fail('detachment', army, I, 'text', e.text, b + ' | ' + diffAt(a, b), W.where);
        }
        if (!sameStruck(e.text, se.body)) fail('detachment', army, I, 'text (struck through)', e.text, 'struck-through words differ from the source', W.where);
      }
    }

    /* stratagems: both ways */
    const srcStr = pack ? pack.strats : W.strats;
    for (const ss of srcStr) {
      count('detachment');
      if (!(det.stratagems || []).some(x => norm(x.name) === norm(ss.name)))
        fail('detachment', army, U + '/stratagem:' + ss.name, 'missing', '', ss.name + ' (' + ss.cp + 'CP) is in ' + (pack ? pack.where : W.where) + ' but not in the app', pack ? pack.where : W.where);
    }
    for (const st of det.stratagems || []) {
      const I = U + '/stratagem:' + st.id;
      const ss = srcStr.find(x => norm(x.name) === norm(st.name));
      const ws = W.strats.find(x => norm(x.name) === norm(st.name));
      count('detachment');
      if (!ss) { fail('detachment', army, I, 'name', st.name, 'not a stratagem of ' + det.name + ' in ' + (pack ? pack.where : W.where), ''); continue; }
      const sWhere = (pack ? pack.d.label + ' ' + pack.d.pages[ss.at.page].where : W.where) + ' (' + ss.name + ')';
      count('detachment');
      const cp = ss.cp != null ? ss.cp : ws && ws.cp;
      if (st.cp !== cp) fail('detachment', army, I, 'cp', String(st.cp), cp + 'CP' + (ss.cpFrom ? ' (' + ss.cpFrom + ')' : ''), sWhere);
      if (pack && ws) for (const f of FIELDS) if ((ss.fields[f] || ws.fields[f]) && joinNorm(ss.fields[f] || []) !== joinNorm(ws.fields[f] || []))
        info.push({ army, unit: I, field: f, note: 'the Faction Pack and Wahapedia differ; the app is checked against the pack', pack: joinNorm(ss.fields[f] || []), wahapedia: joinNorm(ws.fields[f] || []) });
      const su = upd.filter(x => titleN(x).startsWith(nameN(st.name + ' stratagem')));
      for (const f of FIELDS) {
        if (st[f] == null && !ss.fields[f]) continue;
        count('detachment');
        const u = su.find(x => x.fields[f] || (/effect section/i.test(x.title) && f === 'effect' && !Object.keys(x.fields).length) || (/target section/i.test(x.title) && f === 'target' && !Object.keys(x.fields).length));
        if (u) { checkUpdate('detachment', army, I, f + ' (Rules Updates)', st[f] || '', u, u.fields[f] ? u.fields[f].join('\n') : undefined); continue; }
        const r = sameField(st[f] || '', ss.fields[f] || []);
        prov.push({ item: army + ' / ' + I, field: f, doc: pack ? pack.d.label : W.d.label, file: pack ? pack.d.file : W.d.file, sha256: pack ? pack.d.sha256 : W.d.sha256, where: sWhere });
        const sk = (ss.struck && ss.struck[f]) || [];
        if (struckOf(st[f]).join('|') !== sk.join('|')) fail('detachment', army, I, f + ' (struck through)', st[f] || '', 'struck-through words: app [' + struckOf(st[f]).join(', ') + '], source [' + sk.join(', ') + ']', sWhere);
        if (r.ok) continue;
        const wOk = pack && ws && sameField(st[f] || '', ws.fields[f] || []).ok;
        fail('detachment', army, I, f, st[f] || '(none)', (wOk ? 'matches the less authoritative Wahapedia text, not the Faction Pack: ' : '') + (ss.fields[f] ? ss.fields[f].join(' ') : '(no ' + f + ' section)') + ' | ' + r.diff, sWhere);
      }
    }
  }
}


/* ------------------------------------------------------------------ factions: army rules */
// Wahapedia "Army Rules": a rule starts at a short name line ("Waaagh!", "Code Chivalric") that is followed by a long
// line; its body runs to the next name line, without its "FAQ"/"Errata" spoilers. A short line followed by bullet
// points is a heading inside the rule (Doctrina Imperatives: "Protector Imperative", then its bullets), not a new rule.
function wahaArmyRules(fk) {
  const sec = wahaSection(fk, 'Army Rules'); if (!sec) return null;
  const L = docLines(sec.d, sec.pi, sec.pi);
  const isName = i => { const t = L[i].text, n = L[i + 1] && L[i + 1].text; return t.length < 50 && /^[A-Z]/.test(t) && /[a-z]/.test(t) && !/[.:,;]/.test(t) && !/ Army Rule$/.test(t) && !/^(Errata|FAQ|Show|FAQ \/ Errata)$/.test(t) && !!n && n.length >= 35 && !/^- /.test(n); };
  const rules = []; let cur = null, note = false;
  for (let i = 0; i < L.length; i++) {
    if (isName(i)) { cur = { name: L[i].text, at: L[i], body: [] }; rules.push(cur); note = false; continue; }
    if (NOTEHEAD.test(L[i].text)) { note = true; continue; }
    if (cur && !note) cur.body.push(L[i]);
  }
  return { sec, rules, where: sec.page.where };
}
const RAW_HTML = {};
const rawHtml = fk => RAW_HTML[fk] || (RAW_HTML[fk] = fs.readFileSync(path.join(CACHE, 'waha', fk + '.html'), 'utf8'));
// World Eaters Blessings: the dice a Blessing needs are drawn with CSS classes (cruD1w = a 1, cruPlusw = "+", cruORw = "or")
function weDice(fk, name) {
  const h = rawHtml(fk), i = h.indexOf('>' + name.toUpperCase() + '<');
  if (i < 0) return null;
  const j = h.indexOf('cruWEwrapAll', i), k = h.indexOf('</p>', j);
  if (j < 0 || j - i > 400) return null;
  const cls = (h.slice(j, k).match(/cru(D\d|Plus|OR)w/g) || []);
  const groups = [[]]; for (const c of cls) { if (c === 'cruORw') groups.push([]); else groups[groups.length - 1].push(c); }
  return groups.map(g => { const ds = g.filter(c => /D\d/.test(c)); const n = ds.length, f = ds[0] ? ds[0][4] : '?'; return (n === 2 ? 'double' : n === 3 ? 'triple' : n + '×') + ' ' + f + (g.includes('cruPlusw') ? '+' : ''); }).join(' or ');
}
// Chaos Knights Dread abilities: the D6 result that selects one is a dice icon next to its name (cruD6wrap: cruD3 = a 3), or "N/A"
function ckDice(fk, name) {
  const h = rawHtml(fk), i = h.indexOf('<span>' + name.toUpperCase() + '</span>');
  if (i < 0) return null;
  const m = /^<span><div class="cruD6wrap">(?:N\/A|<div class="cruD(\d)"><\/div>)<\/div><\/span>/.exec(h.slice(i + name.length + 13, i + name.length + 120));
  return m ? (m[1] || 'n/a') : null;
}
// Imperial Knights Oath tables: the D6 column is dice images (d1.png …) in the row of that text
function ikDice(fk, rowStart) {
  // the page without its tags (dice images and row ends kept), so that the row's text can be found
  const h = RAW_HTML[fk + ':text'] || (RAW_HTML[fk + ':text'] = decode(rawHtml(fk).replace(/<(?!img\b|\/tr>)[^>]*>/g, '')));
  const i = h.indexOf(rowStart); if (i < 0) return null;
  const e = h.indexOf('</tr>', i);
  const imgs = (h.slice(i, e).match(/img\/d(\d)\.png/g) || []).map(x => x.match(/d(\d)/)[1]);
  return imgs.length ? imgs.join('-') : null;
}

for (const fk of FACTIONS) {
  const F = D.factions[fk], army = armyIdsOf(fk);
  const W = wahaArmyRules(fk);
  if (!W) { fail('armyRule', army, 'armyRules', 'source', '', 'no "Army Rules" section on Wahapedia', ''); continue; }
  const upd = UPD[fk].filter(e => e.section === 'ARMY RULES');
  const claimed = new Set(), SRC = new Map();
  // first find every app rule's source (a rule printed inside another one claims its line from that one)
  for (const R of F.armyRules) {
    const U = 'armyRule:' + R.name;
    let src = W.rules.find(r => norm(r.name) === norm(R.name));
    if (!src) {
      // a rule printed inside another one: "**War Cry (Once per battle, per army):** At the start …"
      for (const r of W.rules) for (const l of r.body) {
        const m = new RegExp('^' + R.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?: \\(([^)]*)\\))?:\\s*(.*)$').exec(l.text);
        if (m && !src) { src = { name: R.name, at: l, body: [{ text: m[2], page: l.page, line: l.line }], inline: m[1] }; claimed.add(l); }
      }
      if (src && src.inline && R.tag && norm(src.inline) !== norm(R.tag)) fail('armyRule', army, U, 'tag', R.tag, '(' + src.inline + ')', W.where);
    }
    SRC.set(R, src);
  }
  for (const r of W.rules) if (![...SRC.values()].includes(r))
    info.push({ army, unit: 'armyRules', note: 'Wahapedia lists an army rule the app leaves out (not a failure: a rule a unit uses must resolve, see unitRules)', wahapedia: r.name });
  for (const R of F.armyRules) {
    const U = 'armyRule:' + R.name;
    const src = SRC.get(R);
    count('armyRule');
    if (!src) { fail('armyRule', army, U, 'name', R.name, 'no army rule of this name in ' + W.where, W.where); continue; }
    const whereR = W.where + ' (' + src.name + ')';
    provRow(army + ' / ' + U, 'text', W.sec.d, null, { where: whereR });
    // the app's lines: rules text, and its own marked lines (FAQ, errata, app notes) checked on their own
    const own = [], prose = [];
    for (const raw of String(R.text || '').split('\n')) { if (!raw.trim()) continue; const c = classify(raw); if (c.kind === 'text') prose.push(raw); else own.push(raw); }
    checkLines('armyRule', army, U, 'text (marked lines)', own.join('\n'), ['pack:' + fk], ['wahahtml:' + fk, 'waha:' + fk].concat(WAHA_CORE), { packDocs: ['pack:' + fk] });
    // source lines, without the table rows the app has in its table
    const body = src.body.filter(l => !claimed.has(l)).map(l => ({ text: l.text, n: norm(l.text.replace(/^-\s+/, '')), used: false, l }));
    let section = null;
    for (const x of body) { if (/^(deed|quality)$/.test(x.n)) { section = x.n; x.used = true; } else if (/^d6$/.test(x.n)) x.used = true; x.section = section; }
    for (const [label, text] of R.table || []) {
      count('armyRule');
      const parts = label.split(' · ');
      const rowU = U + '/row:' + parts[0];
      const t = normApp(text);
      // the row in the source: a name line (World Eaters, Thousand Sons), then the text; or the text alone (Imperial Knights)
      const kName = body.findIndex(x => !x.used && nameN(x.n) === nameN(parts[0]));
      let kText = -1, extra = [];
      if (kName >= 0) {
        body[kName].used = true;
        let k = kName + 1;
        if (body[k] && body[k].n === 'warp charge') { extra.push('warp charge ' + (body[k + 1] ? body[k + 1].n : '?')); body[k].used = true; if (body[k + 1]) body[k + 1].used = true; k += 2; }
        else if (body[k] && body[k].n === 'n/a') { body[k].used = true; k += 1; }   // Chaos Knights: Deathly Terror's D6 column
        kText = k < body.length ? k : -1;
      } else kText = body.findIndex(x => !x.used && x.n === t);
      // the row's update: titled with the row, or under the rule's title naming the row ("Change Protector Imperative to:")
      const ru = upd.find(e => titleN(e) === nameN(parts[0]) || titleN(e) === nameN(R.name + ', ' + parts[0]) ||
        (parts[1] && titleN(e).startsWith(nameN(R.name) + ', ') && titleN(e).includes(nameN(parts[1]).replace(/^\.\.\./, ''))) ||
        (titleN(e) === nameN(R.name) && nameN((/^Change (.+) to:$/.exec(e.instr) || [])[1] || '') === nameN(parts[0])) ||
        new RegExp('^' + nameN(R.name + ', ' + parts[0].replace(/ \(aura\)$/i, '')).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' [a-z]+ ability$').test(titleN(e)));
      if (kText < 0) { fail('armyRule', army, rowU, 'text', text, 'no such row in ' + whereR, whereR); continue; }
      // a row of several lines (an Imperative's bullet points) is that many source lines after its name
      const nRow = kName >= 0 ? String(text).split('\n').filter(l => l.trim()).length : 1;
      const rowLines = body.slice(kText, kText + nRow);
      rowLines.forEach(x => { x.used = true; });
      const rowSrc = nRow > 1 ? { n: joinNorm(rowLines.map(x => x.text)), text: rowLines.map(x => x.text).join('\n') } : body[kText];
      const tr = nRow > 1 ? normField(text) : t;
      if (!ru) prov.push({ item: army + ' / ' + rowU, field: 'text', doc: W.sec.d.label, file: W.sec.d.file, sha256: W.sec.d.sha256, where: whereR });
      if (ru) {
        checkUpdate('armyRule', army, rowU, 'text', text, ru);
        if (rowSrc.n !== tr) info.push({ army, unit: rowU, note: 'Wahapedia main text differs from the Faction Pack Rules Update the app follows', wahapedia: rowSrc.text });
      } else if (rowSrc.n !== tr) fail('armyRule', army, rowU, 'text', text, rowSrc.text + ' | ' + diffAt(tr, rowSrc.n), whereR);
      // label: name (+ Warp Charge / dice / table)
      count('armyRule');
      const rest = parts.slice(1).map(p => norm(p));
      if (kName < 0) {
        // Imperial Knights: "Deed 1–2 · We vow to lay low the tyrant…": the oath line (HTML) right before the text, its table and dice
        const m = /^(deed|quality) (\d)-(\d)$/.exec(norm(parts[0]));
        const oath = parts[1] ? nameN(parts[1]) : '';
        const hd = DOCS['wahahtml:' + fk];
        // the oath line, then (after "..." at most) the row's text
        const core = oath.replace(/^\.+/, '').replace(/\.+$/, '').trim();
        let okOath = false;
        for (let at = core ? hd.N.indexOf(core) : -1; at >= 0 && !okOath; at = hd.N.indexOf(core, at + 1))
          okOath = hd.N.slice(at + core.length, at + core.length + 6 + 40).replace(/^\.*\s*/, '').startsWith(t.slice(0, 40));
        const dice = ikDice(fk, body[kText].text.slice(0, 70));
        const probs = [];
        if (!m) probs.push('label is not "Deed|Quality N–N"');
        else {
          if (body[kText].section !== m[1]) probs.push('row is in the ' + body[kText].section + ' table');
          if (dice !== m[2] + '-' + m[3]) probs.push('the D6 column shows ' + dice);
        }
        if (!okOath) probs.push('the oath line "' + (parts[1] || '') + '" is not printed right before this text (Wahapedia HTML)');
        if (probs.length) fail('armyRule', army, rowU, 'label', label, probs.join('; '), whereR);
      } else {
        const probs = [];
        for (const r of rest) {
          if (/^warp charge/.test(r)) { if (!extra.includes(r)) probs.push('"' + r + '" vs ' + (extra[0] || 'no Warp Charge')); continue; }
          if (/^(double|triple)/.test(r)) { const dice = weDice(fk, parts[0]); if (norm(dice || '') !== r) probs.push('dice "' + r + '" vs the page\'s dice icons: ' + dice); continue; }
          if (/^(n\/a|[1-6])$/.test(r)) { const dice = ckDice(fk, parts[0]); if (dice !== r) probs.push('D6 "' + r + '" vs the page\'s dice icon: ' + dice); continue; }
          probs.push('label part "' + r + '" not checked');
        }
        if (probs.length) fail('armyRule', army, rowU, 'label', label, probs.join('; '), whereR);
      }
    }
    // the rest of the body is the rule's prose: equal to the app's prose (both ways)
    count('armyRule');
    const srcProse = body.filter(x => !x.used).map(x => x.text);
    const a = normField(prose.join('\n')), b = joinNorm(srcProse);
    const whole = upd.find(e => titleN(e) === nameN(R.name) && /^Change to:/.test(e.instr));
    const first = upd.find(e => titleN(e) === nameN(R.name) && /^Change first paragraph to:/.test(e.instr));
    if (whole) {
      checkUpdate('armyRule', army, U, 'text', prose.join('\n'), whole);
      if (a !== b) info.push({ army, unit: U, note: 'Wahapedia main text differs from the Faction Pack Rules Update the app follows', diff: diffAt(a, b) });
    } else {
      if (first) {
        const ok = checkUpdate('armyRule', army, U, 'text (first paragraph)', prose[0] || '', first);
        if (!ok && normApp(prose[0] || '') === norm(srcProse[0] || '')) {
          const f = failures[failures.length - 1]; f.source = 'matches the less authoritative Wahapedia main text, not the Faction Pack: ' + f.source;
        }
      }
      if (a !== b) fail('armyRule', army, U, 'text', prose.join('\n'), b + ' | ' + diffAt(a, b), whereR);
    }
  }
}

/* ------------------------------------------------------------------ units: texts that are not datasheet abilities, rule names */
// the app's own rule lookup (app.html ruleFor): faction aliases, army rules, the army's detachment rules, core aliases, core rules
function ruleText(a, label) {
  const f = D.factions[a.faction];
  let clean = String(label).replace(/^\[|\]$/g, '').replace(/\*$/, '').trim();
  for (const [re, key] of f.aliases || []) if (re.test(clean)) { clean = key; break; }
  const lc = clean.toLowerCase();
  const ar = f.armyRules.find(r => r.name.toLowerCase() === lc); if (ar) return { text: ar.text, src: 'army rule ' + ar.name };
  for (const d of a.detachments.map(x => f.detachments[x]).filter(Boolean)) if (d.rule && d.rule.name.toLowerCase() === lc) return { text: d.rule.text, src: 'detachment rule ' + d.rule.name };
  for (const [re, key] of D.ruleAliases) if (re.test(clean)) return { text: D.rules[key], src: ((D.ruleSrc || {})[key] || 'core rule') + ' ' + key };
  if (D.rules[clean]) return { text: D.rules[clean], src: 'core rule ' + clean };
  return null;
}
for (const a of D.armies) {
  const f = D.factions[a.faction];
  const dets = a.detachments.map(x => f.detachments[x]).filter(Boolean);
  const enhs = dets.flatMap(d => (d.enhancements || []).map(e => Object.assign({ det: d.name }, e)));
  // abilities a detachment rule gives to units: "**Protean Purpose:** (Once per battle, per unit) …"
  const given = [];
  for (const d of dets) for (const l of String(d.rule && d.rule.text || '').split('\n')) { const m = /^\*\*([^*]+?):\*\*\s*(.*)$/.exec(l.trim()); if (m) given.push({ name: m[1], text: m[2], det: d.name }); }
  for (const u of a.units) {
    // the enhancement the unit takes is one of its army's detachments' enhancements
    if (u.enhancement) {
      count('unitText');
      if (!enhs.some(e => norm(e.name) === norm(u.enhancement))) fail('unitText', a.id, u.id, 'enhancement', u.enhancement, 'not an enhancement of ' + dets.map(d => d.name).join(' / '), '');
    }
    for (const ab of u.abilities || []) {
      const e = enhs.find(x => norm(x.name) === norm(ab.name));
      const g = given.find(x => norm(x.name) === norm(ab.name));
      const r = f.armyRules.find(x => norm(x.name) === norm(ab.name));
      const ref = e ? { text: e.text, what: 'enhancement ' + e.name + ' (' + e.det + ')' } : g ? { text: g.text, what: 'detachment rule ability ' + g.name + ' (' + g.det + ')' } : r ? { text: r.text, what: 'army rule ' + r.name } : null;
      if (!ref) continue;
      count('unitText');
      prov.push({ item: a.id + ' / ' + u.id + ' / ability:' + ab.name, field: 'text', doc: 'data.js', file: 'data.js', sha256: null, where: 'same text as the ' + ref.what + ' (whose source is recorded under that item)' });
      if (e && norm((e.upgrade ? u.upgrade : u.enhancement) || '') !== norm(e.name)) fail('unitText', a.id, u.id, 'ability:' + ab.name, ab.name, 'the unit has the ' + e.name + ' enhancement text but its enhancement is ' + (u.enhancement || '(none)'), '');
      // a "**[X]:** …" definition line of the enhancement may live in the unit's glossary rule X instead
      // (as New Recruit prints it: the enhancement text, then the rule under Rules); the rule must be
      // one of the unit's rules and its glossary text must be that line, word for word
      const defs = String(ref.text).split('\n').filter(l => { const m = /^\*\*\[([^\]]+)\]:\*\*\s*(.*)$/.exec(l.trim()); if (!m) return false;
        const rt = ruleText(a, m[1]); return (u.rules || []).some(x => norm(x) === norm(m[1])) && rt && normField(rt.text) === normField(m[2]); });
      const refBody = defs.length && normField(ab.text) !== normField(ref.text) ? String(ref.text).split('\n').filter(l => !defs.includes(l)).join('\n') : ref.text;
      if (normField(ab.text) !== normField(refBody)) fail('unitText', a.id, u.id, 'ability:' + ab.name + '.text', ab.text, 'the ' + ref.what + ' reads: ' + ref.text + ' | ' + diffAt(normField(ab.text), normField(ref.text)), '');
    }
    for (const name of u.rules || []) {
      count('unitRules');
      const r = ruleText(a, name);
      if (!r || !String(r.text || '').trim()) fail('unitRules', a.id, u.id, 'rules', name, 'no rule text: not in D.rules (or its aliases), the army rules or the army\'s detachment rules', '');
    }
    for (const w of [...(u.ranged || []), ...(u.melee || [])]) for (const k of w.kw || []) {
      count('unitRules');
      const r = ruleText(a, k);
      if (!r || !String(r.text || '').trim()) fail('unitRules', a.id, u.id, 'weapon ' + w.name + ' keyword', k, 'no rule text for this weapon keyword', '');
    }
  }
}

/* ------------------------------------------------------------------ units: the Faction Packs' datasheet updates and datasheets */
// The datasheet name an ability belongs to: its "who" (a model of an attached unit) or the unit's name.
// A who that names a choice on the unit's own datasheet ("Wrathful Presence: pick one") is not another datasheet.
const dsName = (u, ab) => (ab.who && !/: pick one$/.test(ab.who)) ? ab.who : u.name;
for (const a of D.armies) {
  const fk = a.faction;
  const upd = UPD[fk].filter(e => e.section === 'DATASHEETS');
  for (const u of a.units) for (const ab of u.abilities || []) {
    const ds = nameN(dsName(u, ab)), an = nameN(ab.name);
    for (const e of upd) {
      const t = titleN(e);
      const unitHit = nameInTitle(ds, t);
      if (!unitHit) continue;
      let hit = false, part;
      if (t.includes(', ' + an + ' ability') || t.includes('– ' + an + ' ability') || t.includes('- ' + an + ' ability') || t.includes('– ' + an + ' wargear ability') || t.includes('- ' + an + ' wargear ability')) hit = true;
      else if (/damaged section$/.test(t) && /^damaged/.test(an)) hit = true;
      else if (/abilities section$/.test(t) && /^Add new ability:/.test(e.instr)) { const m = /^([^:]+):\s*([\s\S]*)$/.exec(e.newText); if (m && nameN(m[1]) === an) { hit = true; part = m[2]; } }
      if (!hit) continue;
      const I = u.id, F = 'ability:' + ab.name + (ab.who ? ' (' + ab.who + ')' : '');
      if (/^Change to:|^Add new ability:/.test(e.instr)) checkUpdate('packUpdate', a.id, I, F, ab.text, e, part);
      else if (!checkChangeValue('packUpdate', a.id, I, F, ab.text, e)) fail('packUpdate', a.id, I, F, ab.text, 'Rules Updates entry not checked mechanically: ' + e.instr, e.where);
    }
  }
}
// "<datasheets> – Faction Abilities section" (or Core Abilities) "Add 'X'.": each of those datasheets in the lists has X
// in its unit's rules list (Adeptus Mechanicus: Doctrina Imperatives on Belisarius Cawl, Cybernetica Datasmith, …)
for (const a of D.armies) {
  for (const e of UPD[a.faction].filter(x => x.section === 'DATASHEETS' && /abilities section$/.test(titleN(x)))) {
    const m = /^Add ['‘]([^'’]+)['’]\.?$/.exec(e.instr); if (!m) continue;
    const t = titleN(e);
    for (const u of a.units) {
      const names = [...new Set([u.name, ...(u.abilities || []).filter(ab => ab.who && !/: pick one$/.test(ab.who)).map(ab => ab.who)])];
      for (const n of names) {
        if (!new RegExp('(^|[ ,–-])' + nameN(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(,| –| -|$)').test(t)) continue;
        usedUpdates.add(e); count('packUpdate');
        prov.push({ item: a.id + ' / ' + u.id + ' / rules', field: 'rules', doc: e.d.label, file: e.d.file, sha256: e.d.sha256, where: e.where });
        if (!(u.rules || []).some(r => norm(r) === norm(m[1]))) fail('packUpdate', a.id, u.id, 'rules (' + n + ')', (u.rules || []).join(', '), 'Rules Updates: "' + e.instr + '"', e.where);
      }
    }
  }
}
// weapon abilities the Rules Updates rewrite ("Norn Assimilator, [HARPOONED] Weapon Ability") are core-rule entries in the app
for (const fk of FACTIONS) for (const e of UPD[fk]) {
  const m = /\[([^\]]+)\] weapon ability$/.exec(titleN(e));
  if (!m || e.section !== 'DATASHEETS') continue;
  const key = Object.keys(D.rules).find(k => norm(k) === m[1]);
  if (!key) continue;
  const t = /^([^:]+):\s*([\s\S]*)$/.exec(e.newText);
  checkUpdate('packUpdate', 'core', 'rule:' + key, 'text', D.rules[key], e, t && norm(t[1]) === m[1] ? t[2] : undefined);
}
// Datasheets the Faction Pack prints in full (pages whose first line is the datasheet name): each ability text of
// that unit must be in those pages word for word ("Name: text", or the DAMAGED / INVULNERABLE SAVE boxes)
for (const a of D.armies) {
  const d = DOCS['pack:' + a.faction]; if (!d) continue;
  const toc = packContents(d).filter(e => e.group === 'Datasheets' || e.group === 'Imperial Armour Datasheets');
  for (const u of a.units) {
    const e = toc.find(x => norm(x.name) === norm(u.name)); if (!e) continue;
    const p0 = d.pages.findIndex((p, pi) => pi > 0 && squash(p.lines.find(l => l.trim()) || '') === squash(u.name));
    if (p0 < 0) continue;
    const [s0, s1] = pageRange(d, p0, p0 + 1);
    const wh = d.label + ' PDF p' + (p0 + 1) + '-' + (p0 + 2) + ' (' + u.name + ' datasheet)';
    for (const ab of u.abilities || []) {
      if (ab.who && norm(ab.who) !== norm(u.name)) continue;
      if (enhNames(a).has(norm(ab.name))) continue;
      if (/^invulnerable save/.test(norm(ab.name))) continue;   // a box ("INVULNERABLE SAVE* 5+ * Against ranged attacks only"), not text
      count('packDatasheet');
      const n = normField(ab.text);
      const hits = findAll(d, n, s0, s1);
      prov.push({ item: a.id + ' / ' + u.id + ' / ability:' + ab.name, field: 'text', doc: d.label, file: d.file, sha256: d.sha256, where: wh });
      if (!hits.length) {
        const nm = norm(ab.name);
        const alt = /^damaged/.test(nm) || /^invulnerable/.test(nm);
        fail('packDatasheet', a.id, u.id, 'ability:' + ab.name, ab.text, (alt ? '(box) ' : '') + nearest(n, [d.id]).text, wh);
      } else if (!/^(damaged|invulnerable)/.test(norm(ab.name)) && !findAll(d, norm(ab.name) + ': ' + n, s0, s1).length && !findAll(d, norm(ab.name) + ' ' + n, s0, s1).length &&
                 !(ab.tag && findAll(d, norm(ab.name + ' (' + ab.tag + '):') + ' ' + n, s0, s1).length))
        fail('packDatasheet', a.id, u.id, 'ability:' + ab.name + ' (name)', ab.name, 'the text is on the datasheet, but not under this name', wh);
    }
  }
}
function enhNames(a) { const f = D.factions[a.faction]; return new Set(a.detachments.flatMap(x => (f.detachments[x] && f.detachments[x].enhancements || []).map(e => norm(e.name)))); }

/* ------------------------------------------------------------------ Rules Updates that concern the lists but matched no app text */
for (const fk of FACTIONS) {
  const army = armyIdsOf(fk);
  const dets = usedDetachments(fk).map(id => D.factions[fk].detachments[id]).filter(Boolean).map(d => norm(d.name + ' detachment'));
  const names = new Set(); for (const a of armiesOf(fk)) for (const u of a.units) { names.add(nameN(u.name)); for (const ab of u.abilities || []) if (ab.who) names.add(nameN(ab.who)); }
  for (const e of UPD[fk]) {
    if (usedUpdates.has(e)) continue;
    const t = titleN(e);
    let concerns = e.section === 'ARMY RULES' || dets.includes(norm(e.section || ''));
    if (e.section === 'DATASHEETS') for (const n of names) if (nameInTitle(n, t) && /ability$|abilities section$|damaged section$/.test(t)) concerns = true;
    // a wargear ability is on a unit only with that wargear: its update concerns the list only when a unit has the ability
    // (Jakhals without an Icon of Khorne)
    const wg = / - (.+) wargear ability$/.exec(t);
    if (concerns && wg && !armiesOf(fk).some(a => a.units.some(u => (u.abilities || []).some(ab => nameN(ab.name) === wg[1])))) concerns = false;
    if (!concerns) continue;
    // a datasheet update for an ability the list's unit does not have (another datasheet of the same name) is fine only if no unit has that ability
    count('packUpdate');
    fail('packUpdate', army, 'rulesUpdate', e.section + ' / ' + e.title, '', 'this Rules Update concerns the list but no app text was matched to it: ' + e.instr + ' ' + e.newText.slice(0, 200), e.where);
  }
}
// Wahapedia rule body (with an optional table) vs the app's text + table: line by line, both ways
function compareWahaBody(appText, appTable, body, ruleName) {
  const src = body.map(l => ({ n: norm(l.text.replace(/^-\s+/, '')), raw: l.text, used: false }));
  const probs = [];
  let pos = -1;
  for (const line of String(appText || '').split('\n')) {
    const n = normApp(line); if (!n) continue;
    const k = src.findIndex(x => !x.used && x.n === n);
    if (k < 0) { probs.push({ app: line, msg: 'not a line of the source' + nearLine(n, src) }); continue; }
    if (k < pos) probs.push({ app: line, msg: 'out of order' });
    src[k].used = true; pos = k;
  }
  for (const [label, text] of appTable || []) {
    const name = nameN(label.split(' · ')[0]), t = normApp(text);
    const kn = src.findIndex(x => !x.used && nameN(x.n) === name), kt = src.findIndex(x => !x.used && x.n === t);
    if (kn >= 0 && kt >= 0) { src[kn].used = src[kt].used = true; continue; }
    const glued = (name + t).replace(/\s/g, '');
    const kg = src.findIndex(x => !x.used && x.n.replace(/\s/g, '') === glued);
    if (kg >= 0) { src[kg].used = true; continue; }
    probs.push({ app: label + ' | ' + text, msg: 'table row not in the source' + (kn < 0 ? ' (no row "' + name + '")' : '') + (kt < 0 ? ' (text differs' + nearLine(t, src) + ')' : '') });
  }
  for (const x of src) if (!x.used && !/^d6 ?result$/.test(x.n) && nameN(x.n) !== nameN(ruleName)) probs.push({ src: x.raw, msg: 'source line missing from the app' });
  return probs;
}
function nearLine(n, src) {
  let best = null, bl = 0;
  for (const x of src) { let i = 0; while (i < n.length && n[i] === x.n[i]) i++; if (i > bl) { bl = i; best = x; } }
  return best && bl > 10 ? '; closest source line differs at "…' + n.slice(Math.max(0, bl - 25), bl) + '[' + n.slice(bl, bl + 30) + '…]" vs "[' + best.n.slice(bl, bl + 30) + '…]"' : '';
}
/* ------------------------------------------------------------------ quotes in the app's notes */
// A note (on an army or detachment rule, a stratagem or an ability) is the app's own sentence, a judgement signed off in
// verify/helpers.js; the words it puts in quotation marks (“…”) are rules text. Each quote is found word for word in GW's
// documents or Wahapedia, a piece at a time where it leaves words out ("…"), or in the text of the item the note is on
// (its rule or stratagem, the unit's abilities), which the other checks verify.
const ALL_DOCS = GW_ALL.concat(WAHA_CORE, Object.keys(DOCS).filter(k => !GW_ALL.includes(k) && !WAHA_CORE.includes(k)));   // GW's first
function checkQuotes(army, unit, note, own) {
  for (const m of String(note || '').matchAll(/“([^”]+)”/g)) {
    for (const piece of m[1].split(/…|\.\.\./)) {
      const n = norm(stripMarkup(piece)).replace(/^[\s.,;:]+|[\s,;:]+$/g, '');
      if (!/[a-z0-9]/.test(n)) continue;
      count('noteQuote');
      const r = locate(n, ALL_DOCS);
      if (r) { provRow(army + ' / ' + unit, 'note', r.d, r.off, { text: piece.trim().slice(0, 80) }); continue; }
      if (own.some(t => normField(t).includes(n))) { prov.push({ item: army + ' / ' + unit, field: 'note', doc: 'data.js', file: 'data.js', sha256: null, where: 'the text of the item the note is on', text: piece.trim().slice(0, 80) }); continue; }
      fail('noteQuote', army, unit, 'note', m[0], 'quoted words not in any source, nor in the text the note is on: "' + piece.trim() + '"' + (nearest(n, ALL_DOCS).text ? ' | ' + nearest(n, ALL_DOCS).text : ''), '');
    }
  }
}
const stratOwn = s => [s.when, s.target, s.effect, s.restrictions].filter(Boolean);
for (const s of D.coreStratagems) if (s.note) checkQuotes('core', 'coreStratagem:' + s.id, s.note, stratOwn(s));
for (const fk of FACTIONS) {
  const F = D.factions[fk];
  for (const r of F.armyRules) if (r.note) checkQuotes(fk, 'armyRule:' + r.name, r.note, [r.text].concat((r.table || []).map(t => t[1])));
  for (const [dk, d] of Object.entries(F.detachments || {})) {
    if (d.rule && d.rule.note) checkQuotes(fk, 'detachment:' + dk + '/rule', d.rule.note, [d.rule.text]);
    for (const s of d.stratagems || []) if (s.note) checkQuotes(fk, 'detachment:' + dk + '/stratagem:' + s.id, s.note, stratOwn(s));
    // the "When targeted" line a stratagem gives the units it protects (Grot Shields), with the FAQ it quotes
    for (const s of d.stratagems || []) if (s.shield && s.shield.def) checkQuotes(fk, 'detachment:' + dk + '/stratagem:' + s.id + ' (shield)', s.shield.def, stratOwn(s));
  }
}
for (const a of D.armies) for (const u of a.units) for (const ab of u.abilities || []) if (ab.note) {
  const f = D.factions[a.faction], dets = a.detachments.map(x => f.detachments[x]).filter(Boolean);
  // the unit's abilities, and the rules of its list (Enraged Behemoths' words in a note on Singular Purpose)
  const own = (u.abilities || []).map(x => x.text).concat(f.armyRules.map(r => r.text), dets.filter(d => d.rule).map(d => d.rule.text));
  checkQuotes(a.id, u.id + ' / ability:' + ab.name, ab.note, own);
}

/* ------------------------------------------------------------------ deviations, output, provenance */
let devs = [];
if (fs.existsSync(DEVS)) devs = JSON.parse(fs.readFileSync(DEVS, 'utf8'));
const KEYS = ['army', 'unit', 'field', 'app', 'source'];
const usedDev = new Set();
const remaining = [];
for (const f of failures) {
  const k = devs.findIndex(d => KEYS.every(x => d[x] === f[x]));
  if (k >= 0) usedDev.add(k); else remaining.push(f);
}
devs.forEach((d, k) => { if (!usedDev.has(k)) remaining.push({ cat: 'deviation', army: d.army, unit: d.unit, field: d.field, app: d.app, source: 'stale deviation: no failure matches this entry of ' + rel(DEVS), where: rel(DEVS) }); });
for (const d of devs) for (const x of KEYS.concat(['reason', 'evidence'])) if (!(x in d)) remaining.push({ cat: 'deviation', army: d.army, unit: d.unit, field: d.field, app: d.app || '', source: 'deviation entry has no "' + x + '"', where: rel(DEVS) });

const docList = Object.values(DOCS).map(d => ({ id: d.id, label: d.label, file: d.file, sha256: d.sha256 }));
const out = {
  checked,
  failures: remaining.map(f => ({ army: f.army, unit: f.unit, field: f.field, app: f.app, source: f.source, where: f.where })),
  deviations: usedDev.size,
  categories: remaining.reduce((m, f) => (m[f.cat] = (m[f.cat] || 0) + 1, m), {}),
  // the app's own lines it marks as such (not checked), and lines of verbatim fields that are in no source (failures)
  appNotes: appWritten.filter(a => a.marked).map(a => ({ army: a.army, unit: a.unit, field: a.field, text: a.text })),
  notInAnySource: appWritten.filter(a => !a.marked).map(a => ({ army: a.army, unit: a.unit, field: a.field, text: a.text })),
  sourceDifferences: info,
  labelColon: labelColons,
  sources: docList
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
// provenance: every checked text -> document, page/section, sha256 of the document
const byLabel = {}; for (const d of docList) byLabel[d.label] = d.id;
const provOut = {
  generatedBy: 'verify/texts.js',
  documents: docList,
  texts: prov.map(p => ({ item: p.item, field: p.field, text: p.text, doc: byLabel[p.doc] || p.doc, where: p.where, sha256: p.sha256, lessAuthoritative: p.lessAuthoritative || undefined, how: p.how || undefined }))
};
fs.writeFileSync(PROV, JSON.stringify(provOut, null, 1) + '\n');

const total = Object.values(checked).reduce((a, b) => a + b, 0);
console.log(remaining.length + ' failure(s) in ' + total + ' checked facts, ' + usedDev.size + ' deviation(s) used; ' + rel(OUT) + ', ' + rel(PROV));
if (!QUIET) {
  console.log('checked ' + JSON.stringify(checked));
  for (const f of remaining) console.log('FAIL [' + f.cat + '] ' + f.army + ' / ' + f.unit + ' / ' + f.field + '\n  app:    ' + String(f.app).split('\n').join('\n          ') + '\n  source: ' + f.source + (f.where ? '\n  where:  ' + f.where : ''));
}
process.exit(remaining.length ? 1 : 0);
