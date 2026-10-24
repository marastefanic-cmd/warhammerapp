/* verify/waha-words.js: what verify/import-nr.js (a New Recruit PDF) and verify/from-json.js (a New Recruit JSON export)
   share: a rule's wording with its markup (bold keywords, bullets, italics) from the cached Wahapedia datasheet, found by
   New Recruit's (or BSData's) plain words; and an army block written the way data.js writes it.
     const W = require('./waha-words')(ROOT, factionId)  ->  { wahaAddress, wahaPage, wording, wahaTokens, plainOf, markup }
     require('./waha-words').writer                      ->  { lit, block, unitSrc } */
'use strict';
const fs = require('fs'), path = require('path');
const NR = require('./nr');
const { nm, textEq } = NR;

function make(ROOT, factionId) {
  // the Chapter whose view of a Space Marines datasheet page is the faction's (sources/factions.json "wahaChapter": "UL")
  let CHAPTER = null;
  try { CHAPTER = (JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/sources/factions.json'), 'utf8'))[factionId] || {}).wahaChapter || null; } catch (e) {}
  // a datasheet's Wahapedia address, as the faction page links it ("Kh-rn-The-Betrayer", "Lord-on-Juggernaut": no one rule
  // makes them); a name the page does not link gets each word capitalised
  let wahaLinks = null;
  function wahaAddress(n) {
    if (!wahaLinks) {
      const f = path.join(ROOT, 'verify/.cache/waha', factionId + '.html');
      const html = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
      wahaLinks = [...new Set([...html.matchAll(/href="\/wh40k11ed\/factions\/[^/"]+\/([^"#/?]+)"/g)].map(m => m[1]))];
    }
    const keys = s => { const t = String(s).replace(/['’]/g, '').toLowerCase();
      return [t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''), t.replace(/[^a-z0-9]/g, '')]; };   // "Khârn": kharn, khrn
    const want = keys(n), hit = wahaLinks.find(l => keys(l).some(k => want.includes(k)));
    // Wahapedia numbers a second page of a name ("Impulsor-1": the Black Templars'); a name whose only page is numbered
    // ("Wardens-of-Ultramar-1") is that page
    const num = hit ? [] : wahaLinks.filter(l => /-\d+$/.test(l) && keys(l.replace(/-\d+$/, '')).some(k => want.includes(k)));
    return hit || (num.length === 1 ? num[0] : null) || nm(n).replace(/['’]/g, '').split(/\s+/).map(w => w[0].toUpperCase() + w.slice(1)).join('-');
  }


  // tokens: text runs with bold/italic, and line breaks / bullets
  function wahaTokens(html) {
    html = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, '');
    const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '’', nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…', times: '×', bull: '•', shy: '' };
    const dec = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e.toLowerCase()] ?? m));
    const out = [], stack = [];
    let bold = 0, ital = 0, kwd = 0;
    const re = /<(\/?)([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
    let m;
    while ((m = re.exec(html))) {
      if (m[4] !== undefined) { let t = dec(m[4]).replace(/\s+/g, ' '); if (kwd) t = t.toUpperCase(); if (t) out.push({ t, b: bold > 0, i: ital > 0 }); continue; }   // a keyword span: capitals, as the app writes keywords
      const close = m[1] === '/', name = m[2].toLowerCase(), attrs = m[3] || '';
      const kw = name === 'span' && /class="kwb\b/.test(attrs);
      if (!close) {
        if (name === 'br' || name === 'p' || name === 'div' || name === 'ul' || name === 'tr') out.push({ nl: true });
        if (name === 'li') out.push({ li: true });
        if (/^(br|img|hr|input|meta|link|wbr)$/.test(name) || /\/\s*$/.test(attrs)) continue;
        stack.push({ name, kw });
        if (name === 'b' || name === 'strong' || kw) bold++;
        if (kw) kwd++;
        if (name === 'i' || name === 'em') ital++;
      } else {
        let k = stack.length - 1; while (k >= 0 && stack[k].name !== name) k--;
        if (k < 0) continue;
        while (stack.length > k) { const t = stack.pop(); if (t.name === 'b' || t.name === 'strong' || t.kw) bold--; if (t.kw) kwd--; if (t.name === 'i' || t.name === 'em') ital--; }
        if (/^(div|p|ul|li|tr|td)$/.test(name)) out.push({ nl: true });
      }
    }
    // "ORKS VEHICLE", "MONSTER/VEHICLE": one bold run across a space or slash between bold words
    for (let i = 1; i < out.length - 1; i++) if (out[i].t && /^[ /]+$/.test(out[i].t) && !out[i].b && out[i - 1].b && out[i + 1].b) out[i].b = true;
    return out;
  }
  // the plain text of the tokens (for finding New Recruit's words), and for each character its token
  function plainOf(tokens) {
    let s = ''; const at = [];
    tokens.forEach((t, k) => { const x = t.t !== undefined ? t.t : ' '; for (let j = 0; j < x.length; j++) { s += x[j]; at.push([k, j]); } });
    // normalised as nm() does, one character at a time, keeping the map
    let n = '', map = [];
    for (let i = 0; i < s.length; i++) {
      const c = NR.q(s[i]);
      if (/\s/.test(c)) { if (n.length && n[n.length - 1] !== ' ') { n += ' '; map.push(i); } continue; }
      n += c; map.push(i);
    }
    return { s, at, n, map };
  }
  // tokens -> app markup, from plain character a to b (inclusive)
  function markup(tokens, P, a, b) {
    const [k0, j0] = P.at[a], [k1, j1] = P.at[b];
    let out = '', B = false, I = false;
    const set = (b2, i2) => { if (I && !i2) { out += '*'; I = false; } if (B !== b2) { out += '**'; B = b2; } if (!I && i2) { out += '*'; I = true; } };
    for (let k = k0; k <= k1; k++) {
      const t = tokens[k];
      if (t.t === undefined) { set(false, false); out = out.replace(/ +$/, ''); if (t.li) out += '\n- '; else if (!/\n$/.test(out) && !/\n- $/.test(out)) out += '\n'; continue; }
      let x = t.t.slice(k === k0 ? j0 : 0, k === k1 ? j1 + 1 : undefined);
      if (/\n(- )?$/.test(out) || out === '') x = x.replace(/^ +/, '');
      if (!x) continue;
      // keep spaces outside the markers: "**heals** D3", not "**heals **D3"
      const lead = /^ +/.exec(x), trail = / +$/.exec(x);
      if (lead && (t.b !== B || t.i !== I)) { set(false, false); out += ' '; x = x.slice(lead[0].length); }
      set(t.b, t.i);
      if (trail && x.length > trail[0].length) { out += x.slice(0, -trail[0].length); set(false, false); out += ' '; }
      else out += x;
    }
    set(false, false);
    return out.replace(/\n{2,}/g, '\n').replace(/ +\n/g, '\n').replace(/\*\*\*\*/g, '').trim();
  }
  const wahaCache = new Map();
  function wahaPage(unitName, fac = factionId) {
    const dir = path.join(ROOT, 'verify/.cache/waha/ds');
    const want = (fac + '_' + wahaAddress(unitName)).toLowerCase();
    if (wahaCache.has(want)) return wahaCache.get(want);
    const f = fs.existsSync(dir) && fs.readdirSync(dir).find(x => x.toLowerCase() === want + '.html');
    let r = null;
    if (f) { const tokens = wahaTokens(chapterView(fs.readFileSync(path.join(dir, f), 'utf8'), CHAPTER)); r = { file: f, tokens, P: plainOf(tokens) }; }
    wahaCache.set(want, r);
    return r;
  }
  // the marked-up wording of New Recruit's plain `text`, from the datasheet pages of the unit's parts.
  // Found by its words; a full stop where the datasheet has a colon (". This unit is" / ":") takes
  // New Recruit's mark, so the result always reads exactly as New Recruit prints it.
  const PUNCT = /[.:;]/g;
  function wording(text, pages) {
    const N = nm(text);
    for (const p of pages.filter(Boolean)) {
      const hay = [p.P.n, p.P.n.toLowerCase(), p.P.n.replace(PUNCT, '.'), p.P.n.toLowerCase().replace(PUNCT, '.')];
      const ndl = [N, N.toLowerCase(), N.replace(PUNCT, '.'), N.toLowerCase().replace(PUNCT, '.')];
      let i = -1; for (let k = 0; k < 4 && i < 0; k++) i = hay[k].indexOf(ndl[k]);
      if (i < 0) continue;
      let md = markup(p.tokens, p.P, p.P.map[i], p.P.map[i + N.length - 1]);
      md = withMarks(md, N);
      if (md && textEq(md, text)) return { text: md, from: 'Wahapedia ' + p.file };
    }
    return null;
  }
  // put New Recruit's punctuation into the marked-up text, character for character
  function withMarks(md, N) {
    let out = '', j = 0, lineStart = true;
    for (let i = 0; i < md.length; i++) {
      const c = md[i];
      if (c === '*') { out += c; continue; }
      if (c === '\n') { out += c; lineStart = true; if (N[j] === ' ') j++; continue; }
      if (lineStart && c === '-' && md[i + 1] === ' ') { out += '- '; i++; lineStart = false; continue; }
      lineStart = false;
      if (/[.:;]/.test(c) && /[.:;]/.test(N[j] || '')) { out += N[j]; j++; continue; }
      out += c; j++;
    }
    return out;
  }

  return { wahaAddress, wahaPage, wording, withMarks, wahaTokens, plainOf, markup, chapter: CHAPTER };
}

// ---------------------------------------------------------------- the army, as data.js writes it
const lit = v => {
  if (Array.isArray(v)) return '[' + v.map(lit).join(',') + ']';
  if (v && typeof v === 'object') return '{ ' + Object.entries(v).map(([k, x]) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : lit(k)) + ':' + lit(x)).join(', ') + ' }';
  if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
  if (v instanceof RegExp) return String(v);
  return JSON.stringify(v);
};
const block = (key, rows) => rows && rows.length ? '      ' + key + ':[\n' + rows.map(r => '        ' + lit(r)).join(',\n') + '\n      ],\n' : '';
function unitSrc(u) {
  const head = ['id', 'name', 'short', 'role', 'pts', 'copies', 'ptsNote', 'enhancement', 'enhOn', 'upgrade', 'warlord', 'warlordOn'].filter(k => u[k] !== undefined).map(k => k + ':' + lit(u[k])).join(', ');
  let s = '    {\n      ' + head + ',\n';
  if (u.leads) s += '      leads:' + lit(u.leads) + (u.support ? ', support:true' : '') + (u.also ? ', also:' + lit(u.also) : '') + ',\n';
  s += '      models:' + lit(u.models) + ',\n' + (u.unplaced ? '      unplaced:' + lit(u.unplaced) + ',\n' : '') + '      gear:' + lit(u.gear) + ',\n';
  const AB = ['name', 'who', 'tag', 'damaged', 'at', 'ph', 'turn', 'turns', 'note', 'def', 'na', 'text'];   // an ability's fields in data.js's order
  const abs = u.abilities.map(a => Object.fromEntries(Object.keys(a).sort((x, y) => (AB.indexOf(x) + 1 || 99) - (AB.indexOf(y) + 1 || 99)).map(k => [k, a[k]])));
  s += block('stats', u.stats) + block('ranged', u.ranged) + block('melee', u.melee) + block('abilities', abs);
  if (u.mods) s += "      // abilities that change this unit's attacks, shown inside its weapon tables\n" + block('mods', u.mods);
  s += block('aura', u.aura);
  s += '      rules:' + lit(u.rules) + ',\n      kw:' + lit(u.kw) + (u.kwNote ? ',\n      kwNote:' + lit(u.kwNote) : '') + (u.kwOnly ? ',\n      kwOnly:' + lit(u.kwOnly) : '') + (u.partialRules ? ',\n      partialRules:' + lit(u.partialRules) : '') + '\n    }';
  return s;
}

// ---------------------------------------------------------------- one Chapter's view of a Space Marines page
// Wahapedia prints every Chapter's variant of a Space Marines datasheet on one page and hides the others in the browser
// (the Chapter picked in its filter): an element of class clFl / clFlCH is shown for a Chapter when its data-f mask
// ("CH:1001") has that Chapter's bit (the page's _wahaFBits: UL is 12), or, with no CH mask, when its classes name the
// Chapter (CHUL). chapterView(html, 'UL') removes every element Wahapedia would hide for the Ultramarines: Dark Angels'
// DEATHWING keyword on the Bladeguard Veteran Squad, the Black Templars' Impulsor rows.
function chapterView(html, code) {
  if (!code) return html;
  const bm = /_wahaFBits\s*=\s*(\{.*?\}\})/.exec(html);
  const bits = bm ? JSON.parse(bm[1]).CH || {} : {};
  // a datasheet another Chapter's view shows (the Deathwatch Terminator Squad, which an Ultramarines army takes through
  // Deathwatch Support): that Chapter's view (DW), the first Chapter its mask has
  const fm = /class="dsOuterFrame datasheet[^"]*" data-f="[^"]*?CH:([0-9a-f]+)/i.exec(html);
  if (fm && bits[code] !== undefined && (BigInt('0x' + fm[1]) & (1n << BigInt(bits[code]))) === 0n) {
    const own = Object.entries(bits).find(([c, b]) => c !== 'CH' && (BigInt('0x' + fm[1]) & (1n << BigInt(b))) !== 0n);
    if (own) code = own[0];
  }
  const VOID = /^(br|img|hr|input|meta|link|wbr|area|base|col|source|track|param|embed)$/i;
  const hides = attrs => {
    const cls = (/\bclass="([^"]*)"/.exec(attrs) || [])[1] || '';
    if (!/(^|\s)clFl(CH)?(\s|$)/.test(cls)) return false;
    const df = (/\bdata-f="([^"]*)"/.exec(attrs) || [])[1] || '', ch = /(?:^|,)CH:([0-9a-f]+)/i.exec(df);
    if (ch && bits[code] !== undefined) return (BigInt('0x' + ch[1]) & (1n << BigInt(bits[code]))) === 0n;
    const codes = cls.split(/\s+/).filter(c => /^CH[A-Z0-9]{2}$/.test(c));
    return codes.length > 0 && !codes.includes('CH' + code);
  };
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
  let out = '', last = 0, m, skip = null;   // skip: { name, depth }
  while ((m = re.exec(html))) {
    const close = m[1] === '/', name = m[2].toLowerCase(), attrs = m[3] || '';
    const isVoid = VOID.test(name) || /\/\s*$/.test(attrs);
    if (skip) {
      if (name === skip.name && !isVoid) { if (close) { if (--skip.depth === 0) { skip = null; last = re.lastIndex; } } else skip.depth++; }
      continue;
    }
    if (!close && !isVoid && hides(attrs)) { out += html.slice(last, m.index); skip = { name, depth: 1 }; continue; }
  }
  return out + (skip ? '' : html.slice(last));
}
make.chapterView = chapterView;

// ---------------------------------------------------------------- the Wahapedia datasheet's facts (the codex as Wahapedia transcribes it)
// profiles (M T SV W LD OC, INSV, base size, model name), weapon rows (name, keywords, range A BS|WS S AP D), keywords
function wahaDatasheet(html, chapter) {
  html = chapterView(html, chapter);
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', times: '×' };
  const dec = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e.toLowerCase()] ?? m));
  const txt = s => dec(String(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  let h = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  const at = h.indexOf('dsOuterFrame datasheet'); if (at < 0) return null;
  h = h.slice(at);
  const end = h.indexOf('UNIT COMPOSITION'); const top = end > 0 ? h.slice(0, end) : h;
  const out = { profiles: [], weapons: [], keywords: [], factionKeywords: [], base: null };
  const b2 = /dsModelBase2[^>]*>([^<]*)</.exec(top); if (b2) out.base = txt(b2[1]).replace(/^\(⌀?|\)$/g, '').trim();
  const inv = /dsCharInvulValue[^>]*>([^<]*)</.exec(top);
  let charNames = null;
  for (const blk of top.split('class="dsProfileBaseWrap"').slice(1)) {
    const p = {};
    for (const m of blk.matchAll(/<div class="dsCharName">([\s\S]*?)<\/div>[\s\S]*?<div class="dsCharValue[^"]*">([\s\S]*?)<\/div>/g)) p[txt(m[1])] = txt(m[2]);
    // a second model's profile prints its values only, in the first profile's order (Wardens of Ultramar: M T SV W LD OC)
    if (Object.keys(p).length) charNames = Object.keys(p);
    else if (charNames) [...blk.split('class="dsInvulWrap"')[0].matchAll(/<div class="dsCharValue[^"]*">([\s\S]*?)<\/div>/g)].forEach((m, k) => { if (charNames[k]) p[charNames[k]] = txt(m[1]); });
    const nmM = /dsModelName[^>]*>([^<]*)</.exec(blk); if (nmM) p.name = txt(nmM[1]);
    const bM = /dsModelBase[^2][^>]*>([^<]*)</.exec(blk) || /dsModelBase"[^>]*>([^<]*)</.exec(blk); if (bM) p.base = txt(bM[1]).replace(/^\(⌀?|\)$/g, '').trim();
    out.profiles.push(p);
  }
  // each invulnerable save box, with its footnote for the models it is for ("INSV* 5+ * Gaius Silva only", then "INSV* 4+ * Veteran
  // Sergeant Metaurus only"): a box without a footnote is every model's
  const boxes = top.split('class="dsInvulWrap"').slice(1).map(b => {
    const v = /dsCharInvulValue[^>]*>([^<]*)</.exec(b), only = /dsInvulComment[^>]*>\s*\*\s*([^<]*?)\s+only\s*</.exec(b.split('class="dsInvulWrap"')[0]);
    return v ? { v: txt(v[1]), names: only ? txt(only[1]).split(/\s*(?:,|\band\b)\s*/).filter(Boolean).map(x => x.toLowerCase()) : null } : null;
  }).filter(Boolean);
  if (!boxes.length && inv) boxes.push({ v: txt(inv[1]), names: null });
  for (const p of out.profiles) { const b = boxes.find(x => x.names && x.names.includes(String(p.name || '').toLowerCase())) || boxes.find(x => !x.names); if (b) p.INSV = b.v; }
  for (const m of top.matchAll(/<tr class="dsWeaponRow">([\s\S]*?)<\/tr>/g)) {
    const row = m[1], name = txt((/dsWeaponName">([\s\S]*?)<\/b>/.exec(row) || [])[1] || '');
    const kws = [...row.matchAll(/<span class="kwbw[^"]*">([\s\S]*?)<\/span><\/span><\/span>/g)].map(k => txt(k[1]));
    const v = [...row.matchAll(/<div class="ct pad2626">([\s\S]*?)<\/div>/g)].map(k => txt(k[1]));
    out.weapons.push({ name, kw: kws, range: v[0], A: v[1], BS: v[2], S: v[3], AP: v[4], D: v[5] });
  }
  // "KEYWORDS – ALL MODELS: INFANTRY; … TACTICUS Dainal Komelius: PSYKER": every model's, then one model's (modelKeywords)
  const kw = /KEYWORDS(?: – ALL MODELS)?:([\s\S]*?)FACTION KEYWORDS:([\s\S]*?)(?:<\/table>|STRATAGEMS)/.exec(h);
  if (kw) {
    // (each model's own keywords follow a vertical line: "… CHAOS | DARK APOSTLE ONLY: CHARACTER; DARK APOSTLE", in capitals too)
    const segs = kw[1].split(/<span class="dsVertLine"><\/span>/);
    const all = txt(segs[0]), m0 = segs.length > 1 ? null : /^(.*?)\s+([A-Z][a-z][^:;]*:[\s\S]*)$/.exec(all);
    out.keywords = (m0 ? m0[1] : all).split(/\s*[;,]\s*/).filter(Boolean);
    out.modelKeywords = {};
    if (m0) for (const m of m0[2].matchAll(/([A-Z][a-z][^:;]*?):\s*([A-Z][A-Z ;,-]*[A-Z])/g)) out.modelKeywords[m[1].trim()] = m[2].split(/\s*[;,]\s*/).filter(Boolean);
    for (const sg of segs.slice(1)) { const m = /^(.*?):\s*(.*)$/.exec(txt(sg)); if (m) out.modelKeywords[m[1].replace(/\s+ONLY$/i, '').trim()] = m[2].split(/\s*[;,]\s*/).filter(Boolean); }
    out.factionKeywords = txt(kw[2]).split(/\s*[;,]\s*/).filter(Boolean);
  }
  return out;
}
make.wahaDatasheet = wahaDatasheet;

// the army rules a Wahapedia faction page lists in its contents (the "Army Rules" entry's sub-entries: each an anchored
// heading on the page); a heading inside a rule ("Favoured Ka’tah" in Martial Ka’tah) is not one. null: no contents found
function wahaArmyRuleNames(html) {
  const i = html.indexOf('href="#Army-Rules"'); if (i < 0) return null;
  const s = html.slice(html.lastIndexOf('<div', i)), out = [];
  const re = /<div class="[^"]*\b(i\d+) ATln"[^>]*><a href="#[^"]*" class="cnClrInv">(?:<b>)?([^<]*)/g;
  let m, first = true;
  while ((m = re.exec(s))) { if (first) { first = false; continue; } if (m[1] !== 'i30') break; out.push(m[2].replace(/&rsquo;/g, '’').replace(/&amp;/g, '&').trim()); }
  return out.length ? out : null;
}
make.wahaArmyRuleNames = wahaArmyRuleNames;

make.writer = { lit, block, unitSrc };
module.exports = make;
