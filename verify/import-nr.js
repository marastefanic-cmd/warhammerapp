#!/usr/bin/env node
/* verify/import-nr.js: a New Recruit list PDF (its `pdftotext -layout` text) -> the army in data.js.

   It writes the facts, with nothing typed by hand:
     from New Recruit   army name, points, battle size, disposition, detachments, export date;
                        per unit: name, role, points, copies, leader/support and the points of each
                        part, enhancement / upgrade / warlord, models lines, gear per line (with
                        counts: "2x Busta Rokkit Launcha"), stat rows, weapon rows (group, profile,
                        who carries it, ×N, Hunter), abilities (name, tag, who), rules, keywords
     wording            each ability's text with its markup (bold keywords, bullets, italics) from
                        the cached Wahapedia datasheet, found by its words, which must equal New
                        Recruit's; an enhancement's from data.js; else New Recruit's plain words,
                        listed as such
     exceptions         verify/deviations-nr.json entries for this army (e.g. a base size GW's guide
                        changed) are applied
   and lists what it cannot know (verify/out/import-<army>.md): phase tags, weapon footnotes and
   auras, "When targeted" lines, detachments or rules data.js lacks, stratagem gists.
   When the army is already in data.js the import keeps those hand-written parts for every unit
   and ability that is unchanged (same unit, same ability words), and its unit ids.

   With --write it then writes the "+" marks (verify/bsdata.js, verify/write-grants.js), and the gate checks
   everything as for a hand-made list: node verify/run.js (NR, BSData, GW texts, screens, sign-off)

   Usage: node verify/import-nr.js <nr.txt> <armyId> [--fresh] [--write] [--data data.js] [--out file] [--reuse old-data.js]
     --fresh   ignore the army's current data.js entry (keeps nothing; used to prove the importer)
     --write   put the army into data.js (replacing the army with this id); else print to --out
                                                                     (default verify/out/import-<armyId>.js) */
'use strict';
const fs = require('fs'), path = require('path');
const NR = require('./nr');
const { nrOptions, nrWeapon, nrStatName, nrAbility, nrDetachments, splitItems, nm, lc, cellV, appText, textEq } = NR;
const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2);
const flag = f => argv.includes(f);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const pos = argv.filter((a, i) => !a.startsWith('--') && !['--data', '--out', '--reuse'].includes(argv[i - 1]));
if (pos.length < 2) { console.error('usage: node verify/import-nr.js <nr.txt> <armyId> [--fresh] [--write] [--data data.js] [--out file]'); process.exit(2); }
const [srcFile, armyId] = pos;
const dataFile = path.resolve(opt('--data', path.join(ROOT, 'data.js')));
global.window = {}; require(dataFile); const D = window.WH_DATA;
const old = flag('--fresh') ? null : D.armies.find(a => a.id === armyId) || null;

// ---------------------------------------------------------------- small helpers
const typo = s => String(s).replace(/'/g, '’');   // the app's apostrophes (’Uge, ’Eadbutt, Mek’s: New Recruit uses no single quote marks)
const slug = s => nm(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const times = s => String(s).replace(/(\d)x(\b|\d)/g, '$1×$2');    // "1x Mek" -> "1× Mek", "120x92mm" -> "120×92mm"
const uniq = a => [...new Set(a)];
const todo = [];           // what a person (or Claude) still writes; each is then signed off by the gate
const note = (unit, what) => todo.push({ unit, what });
const label = u => [u.name].concat((u.also || []).map(c => c.name), u.leads ? [u.leads] : []).join(' + ');
const wantPages = new Set();   // "<faction> <Wahapedia-Name>" lines for verify/sources/waha-datasheets.txt
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
  return hit || nm(n).replace(/['’]/g, '').split(/\s+/).map(w => w[0].toUpperCase() + w.slice(1)).join('-');
}

// ---------------------------------------------------------------- faction and detachments
const nr0 = NR.parseNR(path.resolve(srcFile), []);
const catalogues = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/sources/factions.json'), 'utf8'))).filter(([k, v]) => k[0] !== '_' && v.bsdata).map(([k, v]) => [k, v.bsdata]));
const factionId = Object.keys(catalogues).find(k => nm(catalogues[k]) === nm(nr0.faction)) ||
  Object.keys(D.factions).find(k => nm(D.factions[k].name) === nm(nr0.faction.replace(/^.* - /, ''))) || slug(nr0.faction.replace(/^.* - /, ''));
const F = D.factions[factionId];
if (!F) note(null, 'faction ' + nr0.faction + ' is not in data.js: transcribe its army rules, detachments, enhancements and stratagems from Wahapedia/GW, and add it to verify/sources/factions.json (verify/add-army.js does)');
const enhs = F ? Object.values(F.detachments).flatMap(d => d.enhancements || []) : [];
const nr = NR.parseNR(path.resolve(srcFile), enhs.map(e => e.name));   // again, now knowing which options are enhancements
const detIds = nrDetachments(nr.bullets['Detachment']).map(n => {
  const id = F && Object.keys(F.detachments).find(k => nm(F.detachments[k].name) === n);
  if (!id) note(null, 'detachment ' + n + ' is not in data.js: transcribe its rule, enhancements and stratagems (each stratagem with a gist)');
  return id || slug(n);
});
if (F) for (const id of detIds) for (const s of ((F.detachments[id] || {}).stratagems || [])) if (!s.gist) note(null, 'stratagem ' + s.name + ' has no gist');

// ---------------------------------------------------------------- the Wahapedia datasheet, as marked-up text
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
function wahaPage(unitName) {
  const dir = path.join(ROOT, 'verify/.cache/waha/ds');
  const want = (factionId + '_' + wahaAddress(unitName)).toLowerCase();
  if (wahaCache.has(want)) return wahaCache.get(want);
  const f = fs.existsSync(dir) && fs.readdirSync(dir).find(x => x.toLowerCase() === want + '.html');
  let r = null;
  if (f) { const tokens = wahaTokens(fs.readFileSync(path.join(dir, f), 'utf8')); r = { file: f, tokens, P: plainOf(tokens) }; }
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

// ---------------------------------------------------------------- units
const sig = u => JSON.stringify(Object.assign({}, u, { page: null, copies: null })).replace(/\[\d+\]/g, '');
const nrUnits = [];
for (const nu of nr.units) { const twin = nrUnits.find(x => sig(x) === sig(nu)); if (twin) twin.copies += nu.copies; else nrUnits.push(Object.assign({}, nu)); }
const roster = nr.roster.map(r => Object.assign({ used: false }, r));
const deviations = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/deviations-nr.json'), 'utf8')).filter(d => d.army === armyId);
const ROLES = ['Epic Hero', 'Character', 'Battleline', 'Dedicated Transport', 'Infantry', 'Mounted', 'Beast', 'Swarm', 'Vehicle', 'Monster', 'Fortification'];
const oldPool = old ? [...old.units] : [];
// donors for a unit that is new to this army: the same datasheet in another army of data.js, or in an
// older data.js (--reuse file[,file]: e.g. git show <commit>:data.js), whose hand-written parts were signed off
const donorArmies = flag('--fresh') ? [] : D.armies.filter(a => a.id !== armyId);   // --fresh: nothing kept, nothing borrowed
for (const f of (flag('--fresh') ? '' : opt('--reuse', '') || '').split(',').filter(Boolean)) { global.window = {}; delete require.cache[path.resolve(f)]; require(path.resolve(f)); donorArmies.push(...window.WH_DATA.armies.filter(a => a.id !== armyId)); }
const donorUnits = donorArmies.flatMap(a => a.units.map(u => Object.assign({ _army: a.id }, u)));
const reused = [];
const units = [];

for (const nu of nrUnits) {
  const opts = nu.models.map(m => nrOptions(m.options, enhs.map(e => e.name)));
  // the characters: every models line "• Leading: X" / "• Supporting: X" (a Warboss leading and a Bigboss
  // supporting the same Breaka Boyz are one unit); the first names the unit, the others are `also`
  const chars = nu.models.map((m, k) => ({ name: nm(m.line).replace(/^\d+x\s+/, ''), o: opts[k] })).filter(c => c.o.leads);
  const lead = chars.length ? chars[0].o.leads : null;
  const support = chars.length ? chars[0].o.support : false;
  // the roster lines: the bodyguard's (its OPTIONS name the characters) and one per character, whose points add up
  let name, role, ptsNote = null, bodyguard = null, also = [];
  if (lead) {
    let bg = null, cl = null;
    for (let k = 0; k < nu.copies; k++) {
      const b2 = roster.find(r => !r.used && lc(r.name) === lc(lead) && chars.every(c => lc(r.options.join(' ')).includes(lc(c.name))));
      if (!b2) break;
      const pick = (j, left, taken) => {
        if (j === chars.length) return left === 0 ? [] : null;
        for (const r of roster) if (!r.used && !taken.includes(r) && lc(r.name) === lc(chars[j].name) && r.pts <= left) { const rest = pick(j + 1, left - r.pts, taken.concat(r)); if (rest) return [r].concat(rest); }
        return null;
      };
      const c2 = pick(0, nu.pts - b2.pts, []);
      if (!c2) break;
      b2.used = true; c2.forEach(r => { r.used = true; });
      bg = bg || b2; cl = cl || c2;
    }
    if (!cl) { note(nu.header, 'no roster lines for ' + chars.map(c => c.name).join(' + ') + ' with ' + lead); continue; }
    name = cl[0].name; role = cl[0].role; bodyguard = bg.name;
    ptsNote = cl[0].pts + cl.slice(1).map(r => ' + ' + typo(r.name) + ' ' + r.pts).join('') + ' + ' + typo(bg.name) + ' ' + bg.pts;
    also = chars.slice(1).map(c => Object.assign({ name: typo(c.name) }, c.o.support ? { support: true } : {}));
  } else {
    const rs = roster.filter(r => !r.used && lc(r.name) === lc(nu.header) && r.pts === nu.pts).slice(0, nu.copies);
    rs.forEach(r => { r.used = true; });
    if (!rs.length) { note(nu.header, 'no roster line'); continue; }
    name = rs[0].name; role = rs[0].role;
  }
  name = typo(name);
  const tag0 = [name].concat(also.map(c => c.name), lead ? [typo(lead)] : []).join(' + ');   // how the notes name it

  // weapons first: their names (and letter case) are what the gear lines refer to
  const kinds = {};
  for (const kind of ['ranged', 'melee']) kinds[kind] = nu[kind].map(r => {
    const w = nrWeapon(r, nu.who), o = {};
    // in data.js's order: group, who, n, name, hunter for a profile; name, who, n for a weapon
    if (w.group) o.group = typo(w.group); else o.name = typo(w.name);
    // New Recruit marks the profiles you pick one of with "➤"; a group without it fires every profile (Kustom Blasta X)
    if (w.group && !/^\s*➤/.test(r.name)) o.fireAll = true;
    if (w.who) o.who = typo(w.who);
    if (w.n && w.n > 1) o.n = w.n;
    if (w.group) o.name = typo(w.name);
    if (w.hunter) o.hunter = true;
    o.range = cellV(r.range); o.A = cellV(r.A); o[kind === 'ranged' ? 'BS' : 'WS'] = cellV(r.BS); o.S = cellV(r.S); o.AP = cellV(r.AP); o.D = cellV(r.D);
    // keywords in capitals, as the datasheet prints them (New Recruit writes a rule-given one as "Sustained Hits 1");
    // after a colon it stays as printed ("LETHAL HITS: non-MONSTER/VEHICLE")
    o.kw = splitItems(r.kw || '').map(nm).filter(Boolean).map(k => k.replace(/^[^:]+/, x => x.toUpperCase()));
    return o;
  });
  const weaponName = new Map();
  for (const w of [...kinds.ranged, ...kinds.melee]) { weaponName.set(lc(w.group || w.name), w.group || w.name); if (w.group) weaponName.set(lc(w.group + ' - ' + w.name), w.group); }

  // models lines and gear (a model's options that are not weapons are wargear, named on its line)
  const models = [], gear = [];
  let enhancement = null, warlord = false;
  nu.models.forEach((m, k) => {
    const o = opts[k], g = [], wargear = [];
    if (o.warlord) warlord = true;
    if (o.enhancement) enhancement = typo(o.enhancement);
    for (const it0 of m.options.map(nm)) {
      if (it0 === 'Warlord' || /^•/.test(it0) || (o.enhItem && it0 === o.enhItem)) continue;
      const inner = /^.*?\((.*)\)$/.exec(it0);
      for (const p of inner ? splitItems(inner[1]) : [it0]) {
        const c = /^(\d+)x\s+(.*)$/.exec(nm(p)), n = c ? +c[1] : 1, base = c ? c[2] : nm(p);
        const w = weaponName.get(lc(base));
        if (w) for (let j = 0; j < n; j++) g.push(typo(w)); else wargear.push(typo(base));
      }
    }
    models.push(times(nm(m.line)).replace(/^(\d+)× /, '$1× ').replace(/'/g, '’') + (wargear.length ? ' (' + wargear.join(', ') + ')' : ''));
    gear.push(g);
  });

  // stat rows
  const stats = nu.stats.map(r => {
    const s = nrStatName(r.name, nu.who);
    return { name: typo(s.name) + (s.n ? ' ×' + s.n : ''), M: cellV(r.M), T: cellV(r.T), Sv: cellV(r.Sv), W: cellV(r.W), Ld: cellV(r.LD), OC: cellV(r.OC), InSv: cellV(r.InSv), base: times(cellV(r.Base)) };
  });

  // abilities: New Recruit's tables, worded as the datasheet (or the enhancement) words them
  const pages = uniq([name].concat(also.map(c => c.name), nu.who.length ? nu.who : [], bodyguard ? [bodyguard] : [])).map(wahaPage);
  // every datasheet page the unit's wording comes from, for verify/fetch.sh (Wahapedia's address is the name, words capitalised)
  uniq([name].concat(also.map(c => c.name), nu.who.length ? nu.who : [], bodyguard ? [bodyguard] : [])).forEach((n, k) => { wantPages.add(factionId + ' ' + wahaAddress(n)); });
  if (!pages.some(Boolean)) note(tag0, 'no cached Wahapedia datasheet: its ability texts are New Recruit’s plain words (run sh verify/fetch.sh and import again)');
  let upgrade = null;
  const abilities = [];
  for (const t of nu.tables) for (const r of t.rows) {
    const a = nrAbility(r.name, nu.who), o = {};
    const e = enhs.find(x => nm(x.name) === a.base || nm(x.name) === a.full);
    o.name = typo(e ? e.name : (a.paren !== null && /\d\+\*?$/.test(a.paren) ? a.full : a.base));
    if (t.name !== 'Abilities') o.who = typo(t.name);
    else if (a.who) o.who = typo(a.who);
    if (e) { o.tag = e.upgrade ? 'Upgrade' : 'Enhancement'; if (e.upgrade) upgrade = e.name; }
    else if (a.paren !== null && o.name === typo(a.base)) o.tag = a.paren;
    // an enhancement's text from data.js: as many of its lines as New Recruit prints (the faction's
    // text can go on with a definition, "[SUPA-HAZARDOUS]: …", that the unit's copy leaves out)
    const heads = e ? e.text.split('\n').map((x, k, all) => all.slice(0, k + 1).join('\n')).reverse() : [];
    const dev = deviations.find(d => /^abilities\[(.*)\]\.text$/.test(d.field) && nm(d.field.slice(10, -6)) === nm(o.name));
    let w = heads.find(h => textEq(h, r.text)) ? { text: heads.find(h => textEq(h, r.text)), from: 'data.js enhancement' } : e ? null : wording(r.text, pages);
    // a deviation (New Recruit's typo): the lines whose words come closest to New Recruit's
    if (!w && dev && e) { const len = nm(r.text).length; w = { text: heads.slice().sort((x, y) => Math.abs(appText(x).s.length - len) - Math.abs(appText(y).s.length - len))[0], from: 'data.js enhancement (deviations-nr.json)' }; }
    if (!w && e) w = wording(r.text, pages);
    if (!w) { w = { text: typo(nm(r.text)), from: 'New Recruit' }; o._plain = true; }
    o.text = w.text;
    abilities.push(o);
  }
  if (upgrade) enhancement = enhancement && nm(enhancement) === nm(upgrade) ? null : enhancement;

  const cats = nu.cats.filter(c => !/^\*from combined unit$/.test(c));
  const starred = cats.filter(c => /\*$/.test(c)).map(c => nm(c.replace(/\*$/, '')));
  const u = { id: null, name, role, pts: nu.pts };
  if (nu.copies > 1) u.copies = nu.copies;
  if (ptsNote) u.ptsNote = ptsNote;
  if (enhancement) u.enhancement = enhancement;
  if (upgrade) u.upgrade = upgrade;
  if (warlord) u.warlord = true;
  // the enhancement on a character other than the first: which one
  const holder = opts.findIndex(o => o.enhancement);
  if (enhancement && holder > 0 && chars.length > 1) u.enhOn = typo(nm(nu.models[holder].line).replace(/^\d+x\s+/, ''));
  // and the Warlord, when it is not the first character
  const wl = opts.findIndex(o => o.warlord);
  if (warlord && wl > 0 && chars.length > 1) u.warlordOn = typo(nm(nu.models[wl].line).replace(/^\d+x\s+/, ''));
  if (lead) { u.leads = typo(lead); if (support) u.support = true; if (also.length) u.also = also; }
  Object.assign(u, { models, gear, stats, ranged: kinds.ranged, melee: kinds.melee, abilities, rules: uniq(nu.rules.map(nm)), kw: uniq(cats.map(c => nm(c.replace(/\*$/, '')))) });
  if (starred.length) u.kwNote = starred.join(', ') + (starred.length > 1 ? ' come' : ' comes') + ' from the ' + (also.length ? 'combined unit' : (support ? 'supported ' : 'led ') + typo(lead)) + '.';
  u._page = nu.page;
  // what New Recruit already applied to a weapon or stat row ("(Kustom Dakka)"): shown as a "+" mark, no footnote needed
  u._applied = new Set([...nu.ranged, ...nu.melee].flatMap(r => nrWeapon(r, nu.who).parens).concat(nu.stats.flatMap(r => nrStatName(r.name, nu.who).parens)).flatMap(p => p.split(/,\s*/)).map(lc));

  // the same unit already in data.js: keep its id and what was written by hand
  const cands = oldPool.filter(x => nm(x.name) === nm(name) && (x.leads || null) === (u.leads || null));
  const prev = cands.find(x => x.pts === u.pts && (x.enhancement || null) === (u.enhancement || null)) || cands.find(x => (x.enhancement || null) === (u.enhancement || null)) || null;
  if (prev) {
    oldPool.splice(oldPool.indexOf(prev), 1);
    u.id = prev.id;
    if (prev.short) u.short = prev.short;
    // the "+" marks of rows that are unchanged (write-grants.js writes the others; bsdata.js checks all)
    const bare = o => JSON.stringify(Object.assign({}, o, { from: undefined }));
    for (const k of ['stats', 'ranged', 'melee']) for (const row of u[k]) { const pr = (prev[k] || []).find(x => bare(x) === bare(row)); if (pr && pr.from) row.from = pr.from; }
    for (const ab of u.abilities) {
      const pa = (prev.abilities || []).find(x => x.name === ab.name && ((x.who || null) === (ab.who || null) || (ab.who && (x.who || '').startsWith(ab.who + ':'))));
      if (!pa) continue;
      if (pa.who) ab.who = pa.who;
      // the same words: its markup as written; or the official wording where New Recruit has a typo (deviations-nr.json)
      const typoDev = deviations.some(d => d.unit === prev.id && /^abilities\[/.test(d.field) && d.field.slice(10).startsWith(nm(ab.name)) && appText(d.source).s === appText(ab.text).s);
      if (appText(pa.text).s === appText(ab.text).s || typoDev) { ab.text = pa.text; delete ab._plain; }
      else { note(tag0, 'ability ' + ab.name + ' has new words: its phase tags and footnotes were not kept'); continue; }
      for (const k of ['damaged', 'ph', 'turn', 'turns', 'def', 'na']) if (pa[k] !== undefined) ab[k] = pa[k];
    }
    const names = new Set(u.abilities.map(a => a.name));
    for (const k of ['mods', 'aura']) {
      const keep = (prev[k] || []).filter(m => !m.from || names.has(m.from) || D.factions[factionId].armyRules.some(r => r.name === m.from) || detIds.some(id => ((F.detachments[id] || {}).rule || {}).name === m.from));
      (prev[k] || []).filter(m => !keep.includes(m)).forEach(m => note(tag0, k + ' from ' + m.from + ' dropped: the unit no longer has it'));
      if (keep.length) u[k] = keep;
    }
  }
  // a unit new to this army: what another list's copy of the datasheet has, where it is the same
  const armyNames = new Set((F ? F.armyRules.map(r => r.name) : []).concat(detIds.map(id => ((F && F.detachments[id] || {}).rule || {}).name).filter(Boolean)));
  if (!prev) {
    // the whole unit's footnotes and auras: only from a unit of the same shape (same characters and bodyguard)
    const shape = x => [x.name].concat((x.also || []).map(c => c.name), x.leads ? [x.leads] : []).map(nm).join('+');
    const d = donorUnits.find(x => shape(x) === shape(u));
    if (d) {
      if (d.short) u.short = d.short;
      const names = new Set(u.abilities.map(a => a.name)), weapons = new Set([...u.ranged, ...u.melee].map(w => w.group || w.name));
      const sameWords = n => { const a1 = u.abilities.find(a => a.name === n), a2 = (d.abilities || []).find(a => a.name === n); return a1 && a2 && appText(a1.text).s === appText(a2.text).s; };
      for (const k of ['mods', 'aura']) {
        const keep = (d[k] || []).filter(m => (!m.weapon || weapons.has(m.weapon)) && (!m.from || (names.has(m.from) && sameWords(m.from)) || armyNames.has(m.from)));
        if (keep.length) { u[k] = JSON.parse(JSON.stringify(keep)); reused.push(tag0 + ': ' + k + ' from ' + d._army + '/' + d.id); }
      }
    }
  }
  // each ability's phase tags and "When targeted" line: from any copy of it with the same name and words
  for (const ab of u.abilities) {
    if (ab.ph !== undefined) continue;
    const da = donorUnits.flatMap(x => (x.abilities || []).map(a => [x, a])).find(([x, a]) => a.name === ab.name && appText(a.text).s === appText(ab.text).s);
    if (!da) continue;
    for (const k of ['ph', 'turn', 'turns', 'def']) if (da[1][k] !== undefined) ab[k] = JSON.parse(JSON.stringify(da[1][k]));
    // "not usable here" (na) is about that list's units: not copied, only pointed out
    if (da[1].na) note(tag0, 'ability ' + ab.name + ': another list marks it "' + da[1].na + '"; check whether that holds for this list before writing na');
    if (ab._plain) { ab.text = da[1].text; delete ab._plain; }   // its markup as written there
    reused.push(tag0 + ': ' + ab.name + ' from ' + da[0]._army + '/' + da[0].id);
  }
  for (const ab of u.abilities.filter(x => x._plain)) { delete ab._plain; note(tag0, 'ability ' + ab.name + ': no marked-up wording found; it has New Recruit’s plain words (add bold keywords and bullets by hand, or fetch the datasheet)'); }
  units.push(u);
}
for (const r of roster.filter(r => !r.used)) note(null, 'roster line not matched to a unit: ' + r.name + ' ' + r.pts);

// ids for new units: the name, then what tells two apart
for (const u of units.filter(u => !u.id)) {
  let id = [u.name].concat((u.also || []).map(c => c.name), u.leads ? [u.leads] : []).map(slug).join('-');
  if (units.some(x => x !== u && slug(x.name) === slug(u.name) && (x.leads || null) === (u.leads || null))) id += u.enhancement ? '-' + slug(u.enhancement) : '';
  let k = 2, base = id; while (units.some(x => x.id === id)) id = base + '-' + k++;
  u.id = id;
}

// deviations-nr.json: the app's value where it deliberately differs from New Recruit
for (const d of deviations) {
  const u = units.find(x => x.id === d.unit); if (!u) { note(d.unit, 'deviation for a unit not in the list: ' + d.field); continue; }
  let m;
  if ((m = /^stats\[(.*)\]\.(\w+)$/.exec(d.field))) { const s = u.stats.find(x => nm(x.name).replace(/ x\d+$/, '') === nm(m[1])); if (s && cellV(s[m[2]]) === cellV(d.source)) s[m[2]] = d.app; else note(u.id, 'deviation ' + d.field + ': New Recruit no longer prints ' + d.source); }
  else if (!/^abilities\[.*\]\.text$/.test(d.field)) note(u.id, 'deviation ' + d.field + ' is not applied by the importer: apply it by hand');
}

// sorted as the roster reads: role, then units without a leader, then New Recruit's page order
units.sort((a, b) => (ROLES.indexOf(a.role) - ROLES.indexOf(b.role)) || ((a.leads ? 1 : 0) - (b.leads ? 1 : 0)) || (a._page - b._page));

// ---------------------------------------------------------------- what it cannot know
const PHASE = /\b(Command|Movement|Shooting|Charge|Fight) phase\b|\bbattle round\b|\bturn\b|\bselected to (shoot|fight|move)|\bcharge move\b|\bwhen\b/i;
const ATTACKS = /attacks[^.]{0,80}\b(have|can re-roll)\b|\bhas \+\d|\+\d+ (to )?\*?\*?(hit|wound|A|S|AP|D|BS|WS)\b|\bre-roll\b/i;
for (const u of units) {
  for (const ab of u.abilities) {
    if (ab.ph === undefined && PHASE.test(appText(ab.text).s)) note(label(u), 'ability ' + ab.name + ': phase tags (ph, turn, turns) where its words name a phase or a moment');
    if (ATTACKS.test(appText(ab.text).s) && !u._applied.has(lc(ab.name)) && !(u.mods || []).concat(u.aura || []).some(m => m.from === ab.name)) note(label(u), 'ability ' + ab.name + ': changes attacks? a footnote under the weapons (mods) or for other units (aura), copied from its words');
    if (/\b(targets? this unit|attacks? that target (this|your) unit)\b/i.test(appText(ab.text).s) && !ab.def) note(label(u), 'ability ' + ab.name + ': a "When targeted" line (def)?');
  }
}
if (F) for (const g of nr.glossary) {
  let clean = NR.q(g).replace(/^\[|\]$/g, '').trim();
  for (const [re, key] of F.aliases || []) if (re.test(clean)) { clean = key; break; }
  const known = F.armyRules.some(r => lc(r.name) === lc(clean)) || detIds.some(id => lc(((F.detachments[id] || {}).rule || {}).name || '') === lc(clean)) ||
    D.ruleAliases.some(([re]) => re.test(clean)) || Object.keys(D.rules).some(k => lc(k) === lc(clean));
  if (!known) note(null, 'rule ' + g + ' (New Recruit’s glossary) is not in data.js RULES: add GW’s wording');
}

// ---------------------------------------------------------------- the army, as data.js writes it
const dm = /^(\d+)\/(\d+)\/(\d+)$/.exec(nr.date) || [];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const bs = /^(.*?) \((\d+) Point limit\)$/.exec(nr.bullets['Battle Size'] || '') || [];
const army = { id: armyId, name: typo(nr.name), faction: factionId, points: +bs[2] || null, pointsUsed: nr.pts, battleSize: bs[1] || null, disposition: nr.bullets['Force Disposition'] || null, detachments: detIds, source: 'New Recruit, exported ' + (+dm[2]) + ' ' + MON[+dm[1] - 1] + ' 20' + dm[3] };
// the other selections printed under the army name, as printed ("Code Chivalric: Deed, Quality")
army.config = Object.fromEntries(Object.entries(nr.bullets).filter(([k, v]) => typeof v === 'string' && !['Battle Size', 'Detachment', 'Force Disposition', 'Show/Hide Options'].includes(k)).map(([k, v]) => [typo(k), typo(v)]));

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
  s += '      models:' + lit(u.models) + ',\n      gear:' + lit(u.gear) + ',\n';
  const AB = ['name', 'who', 'tag', 'damaged', 'ph', 'turn', 'turns', 'def', 'na', 'text'];   // an ability's fields in data.js's order
  const abs = u.abilities.map(a => Object.fromEntries(Object.keys(a).sort((x, y) => (AB.indexOf(x) + 1 || 99) - (AB.indexOf(y) + 1 || 99)).map(k => [k, a[k]])));
  s += block('stats', u.stats) + block('ranged', u.ranged) + block('melee', u.melee) + block('abilities', abs);
  if (u.mods) s += "      // abilities that change this unit's attacks, shown inside its weapon tables\n" + block('mods', u.mods);
  s += block('aura', u.aura);
  s += '      rules:' + lit(u.rules) + ',\n      kw:' + lit(u.kw) + (u.kwNote ? ',\n      kwNote:' + lit(u.kwNote) : '') + '\n    }';
  return s;
}
const src = '{\n' + ['id', 'name', 'faction', 'points', 'pointsUsed'].map(k => k + ':' + lit(army[k])).join(', ').replace(/^/, '  ') + ',\n' +
  '  battleSize:' + lit(army.battleSize) + ', disposition:' + lit(army.disposition) + ',\n' +
  '  detachments:' + lit(army.detachments) + ',\n' + (Object.keys(army.config).length ? '  config:' + lit(army.config) + ',\n' : '') + '  source:' + lit(army.source) + ',\n  units:[\n' + units.map(u => { delete u._page; delete u._applied; return unitSrc(u); }).join(',\n') + '\n  ]\n},\n';

// ---------------------------------------------------------------- write
// the datasheet pages verify/fetch.sh should download (it reads verify/sources/waha-datasheets.txt)
const dsList = path.join(ROOT, 'verify/sources/waha-datasheets.txt');
const listed = new Set(fs.readFileSync(dsList, 'utf8').split('\n').map(l => l.trim().toLowerCase()).filter(Boolean));
const newPages = [...wantPages].filter(l => !listed.has(l.toLowerCase()));
if (newPages.length) note(null, 'Wahapedia datasheets to download: ' + newPages.join(', ') + (flag('--write') ? ' (added to verify/sources/waha-datasheets.txt; run sh verify/fetch.sh, then import again)' : ' (add them to verify/sources/waha-datasheets.txt, run sh verify/fetch.sh, import again)'));
if (flag('--write') && newPages.length) fs.appendFileSync(dsList, newPages.join('\n') + '\n');
const report = ['# Import of ' + army.name + ' (' + armyId + ')', '', 'From ' + path.relative(ROOT, path.resolve(srcFile)) + (old ? '; kept the hand-written parts of the current ' + armyId : '; fresh (nothing kept)') + '.', '',
  units.length + ' units (' + units.reduce((t, u) => t + (u.copies || 1), 0) + ' with copies), ' + units.reduce((t, u) => t + u.pts * (u.copies || 1), 0) + ' pts.', '',
  '## Still to write (' + todo.length + ')', '', 'Each is then checked by the gate (verify/run.js): phase tags, footnotes and gists are signed off in verify/helpers.js.', '',
  ...todo.map(t => '- ' + (t.unit ? '**' + t.unit + '**: ' : '') + t.what), '',
  ...(reused.length ? ['## Reused from other lists (' + reused.length + ')', '', 'Same datasheet, same words: their signed-off phase tags, footnotes and auras.', '', ...reused.map(r => '- ' + r), ''] : []),
  '## Then', '', '`node verify/run.js` until it passes (with --write the "+" marks from BSData are already written).', ''].join('\n');
fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'verify/out/import-' + armyId + '.md'), report);
if (flag('--write')) {
  let d = fs.readFileSync(dataFile, 'utf8');
  const start = d.indexOf("{\n  id:'" + armyId + "',");
  if (start >= 0) { const end = d.indexOf('\n},\n', start); if (end < 0) throw new Error('no end of army ' + armyId); d = d.slice(0, start) + src + d.slice(end + 4); }
  else { const at = d.indexOf('const ARMIES = [\n'), end = at < 0 ? -1 : d.indexOf('\n];', at); if (end < 0) throw new Error('no ARMIES in data.js'); d = d.slice(0, end + 1) + src + d.slice(end + 1); }   // a new army goes last
  fs.writeFileSync(dataFile, d);
  console.log('wrote ' + armyId + ' into ' + path.relative(process.cwd(), dataFile) + ': ' + units.length + ' units; ' + todo.length + ' things to write (verify/out/import-' + armyId + '.md)');
  // the "+" marks: BSData's modifiers on the new rows (bsdata.js lists them, write-grants.js writes them)
  if (path.resolve(dataFile) === path.join(ROOT, 'data.js')) {
    const { spawnSync } = require('child_process');
    spawnSync(process.execPath, [path.join(ROOT, 'verify/bsdata.js')], { cwd: ROOT, encoding: 'utf8' });
    const g = spawnSync(process.execPath, [path.join(ROOT, 'verify/write-grants.js')], { cwd: ROOT, encoding: 'utf8' });
    console.log((g.stdout || g.stderr).trim());
  }
} else {
  const out = path.resolve(opt('--out', path.join(ROOT, 'verify/out/import-' + armyId + '.js')));
  fs.writeFileSync(out, src);
  console.log('wrote ' + path.relative(process.cwd(), out) + ': ' + units.length + ' units; ' + todo.length + ' things to write (verify/out/import-' + armyId + '.md)');
}
