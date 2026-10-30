/* verify/gw-order.js: GW's order of what a datasheet prints, from its Wahapedia page (GW's codex as Wahapedia transcribes it), by
   position on the page. No hand ordering: each list is sorted by where its items stand on the unit's datasheet page(s).
     weapon rows          by the page's weapon rows (a multi-profile weapon's profiles stay together, in the page's order)
     a weapon's keywords  by the page row's keyword spans; one a rule of the list adds (its from) last
     abilities            datasheet abilities, then wargear abilities (the page's order), then rows the page has none of (New Recruit's
                          Leader, Invulnerable Save, Damaged), then the list's own (an enhancement's, an upgrade's)
     the Rules line       CORE ABILITIES, then ARMY RULES (the page's labels); one the page has not (an enhancement's) last
     keywords             the KEYWORDS line (then a model's own keywords), keywords the page has not, then FACTION KEYWORDS, then
                          the list's own (Warlord, a keyword a rule of the list gives: why.kw) last
   An attached unit keeps its parts in the order its rows have them; each part sorted by its own page. An item the page does not
   name keeps its place after the item before it. A datasheet with no page (sheetsWithoutPage) keeps its order.
     const O = require('./gw-order')(ROOT)  ->  { units(armies), rows(kind, rows, pages), kw(list, pages, listOwn), pageFor, noPage } */
'use strict';
const fs = require('fs'), path = require('path');
const WW = require('./waha-words');

const n = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`']/g, '').replace(/[^a-z0-9]/g, '');
const ENT = { amp:'&', lt:'<', gt:'>', quot:'"', apos:'’', nbsp:' ', rsquo:'’', lsquo:'‘', ldquo:'“', rdquo:'”', ndash:'–', mdash:'—', hellip:'…', times:'×', shy:'' };
const dec = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e.toLowerCase()] ?? m));
const txt = h => dec(String(h).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
// a keyword's name without its value ("SUSTAINED HITS 1", "ANTI-INFANTRY 4+", "LETHAL HITS: non-MONSTER/VEHICLE": sustainedhits, antiinfantry, lethalhits)
const kwBase = k => n(String(k).replace(/:.*$/, '').replace(/\s+(D?\d+\+?|D\d+[+-]\d+|\d*D\d+)$/i, ''));

// the page's facts in their order
function parse(html, chapter) {
  html = WW.chapterView(html, chapter).replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, '');
  const at = html.indexOf('dsOuterFrame datasheet'); if (at < 0) return null;
  const h = html.slice(at), end = h.indexOf('UNIT COMPOSITION'), top = end > 0 ? h.slice(0, end) : h;
  const heads = [...top.matchAll(/(RANGED WEAPONS|MELEE WEAPONS)</g)].map(m => ({ at:m.index, k:m[1][0] === 'R' ? 'ranged' : 'melee' }));
  const weapons = { ranged:[], melee:[] };
  for (const m of top.matchAll(/<tr class="dsWeaponRow">([\s\S]*?)<\/tr>/g)) {
    const hd = heads.filter(x => x.at < m.index).pop(); if (!hd) continue;
    const row = m[1], nm = /<b class="dsWeaponName">([\s\S]*?)<\/b>/.exec(row); if (!nm) continue;
    const kws = [];
    for (const k of row.matchAll(/<span class="kwbw[^"]*">/g)) {
      const re = /<(\/?)span\b[^>]*>/g; re.lastIndex = k.index + k[0].length; let depth = 1, m2;
      while (depth && (m2 = re.exec(row))) depth += m2[1] ? -1 : 1;
      if (m2) kws.push(txt(row.slice(k.index + k[0].length, m2.index)));
    }
    const name = txt(nm[1]), parts = name.split(/ [-–] /);
    const v = [...row.matchAll(/<div class="ct pad2626">([\s\S]*?)<\/div>/g)].map(k => txt(k[1]));   // (its numbers: verify/numbers.js)
    weapons[hd.k].push({ name, group:parts.length > 1 ? parts[0] : null, profile:parts.length > 1 ? parts.slice(1).join(' - ') : null, kw:kws, range:v[0], A:v[1], skill:v[2], S:v[3], AP:v[4], D:v[5] });
  }
  const labels = {};
  for (const m of h.matchAll(/class="dsCoreArmyLabel[^"]*">([\s\S]*?)<\/td><td class="dsCoreArmyValue">([\s\S]*?)<\/td>/g)) labels[txt(m[1])] = txt(m[2]).split(/\s*,\s*/).filter(Boolean);
  // the boxes of the page in their order (SUPREME COMMANDER, WRATHFUL PRESENCE, ABILITIES, a wargear option's box, TRANSPORT, DAMAGED: …),
  // each with the abilities it names; the weapon tables and their column heads are none
  const boxes = [], abilities = [], STD = /^(RANGE|A|BS|WS|S|AP|D|)$/;
  let box = null;
  for (const m of h.matchAll(/<div class="(?:ct )?dsHeader[^"]*">([\s\S]*?)<\/div>|<div class="dsAbility( dsWargearAbility)?">([\s\S]*?)(?=<div class="dsAbility|<div class="dsHeader|<\/td>)/g)) {
    if (m[1] !== undefined) {
      const t = txt(m[1]);
      if (STD.test(t)) continue;
      if (t === 'STRATAGEMS') break;
      if (t === 'RANGED WEAPONS' || t === 'MELEE WEAPONS') { box = null; continue; }
      boxes.push(box = { h:t, ab:[], pos:m.index });
      continue;
    }
    if (!box) continue;
    const b = /<b>([\s\S]*?)<\/b>/.exec(m[3]); if (!b) continue;
    const name = txt(b[1]).replace(/:$/, '').replace(/\s*\([^)]*\)\s*:?$/, '').trim().replace(/:$/, '');
    if (name) { const a = { name, wargear:!!m[2], box:boxes.length - 1, at:box.ab.length, pos:m.index }; box.ab.push(a); abilities.push(a); }
  }
  const ds = WW.wahaDatasheet(html, null) || {};
  const kws = (ds.keywords || []).concat(...Object.values(ds.modelKeywords || {}));
  return { weapons, labels, abilities, boxes, html:h, keywords:kws, unitKeywords:ds.keywords || [], modelKeywords:ds.modelKeywords || {}, detachmentKeywords:ds.detachmentKeywords || {}, factionKeywords:ds.factionKeywords || [], profiles:ds.profiles || [] };
}

module.exports = function make(ROOT) {
  const DIR = path.join(ROOT, 'verify/.cache/waha/ds');
  const FJ = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/sources/factions.json'), 'utf8')); } catch (e) { return {}; } })();
  const files = fs.existsSync(DIR) ? fs.readdirSync(DIR) : [];
  const lower = new Map(files.map(f => [f.toLowerCase(), f]));
  const words = new Map(), cache = new Map(), noPage = new Set();
  const ww = fac => words.get(fac) || (words.set(fac, WW(ROOT, fac)), words.get(fac));
  // a datasheet's page: under the list's faction, else under one of its allied factions (sources/factions.json), by the faction page's
  // link (waha-words wahaAddress); a reference entry's name less its bracket ("Spore Mines (Biovore)")
  function pageFor(faction, name) {
    const k = faction + '\0' + name;
    if (cache.has(k)) return cache.get(k);
    let r = null;
    const facs = [faction].concat(Object.values((FJ[faction] || {}).allies || {}));
    for (const nmx of [name, String(name).replace(/\s*\([^()]*\)$/, '')]) {
      for (const fac of facs) {
        const f = lower.get((fac + '_' + ww(fac).wahaAddress(nmx) + '.html').toLowerCase());
        if (f) { const p = parse(fs.readFileSync(path.join(DIR, f), 'utf8'), ww(fac).chapter); if (p) { r = Object.assign(p, { file:f }); break; } }
      }
      if (r) break;
    }
    if (!r) noPage.add(faction + '/' + name);
    cache.set(k, r);
    return r;
  }

  // sort xs by key(x, i) (an array of numbers, or null: keeps its place after the item before it), stably
  function sortBy(xs, key) {
    const ks = []; let prev = [-1];
    xs.forEach((x, i) => { const k = key(x, i); ks.push(k ? (prev = k) : prev); });
    const idx = xs.map((x, i) => i).sort((a, b) => { const A = ks[a], B = ks[b]; for (let j = 0; j < Math.max(A.length, B.length); j++) { const d = (A[j] ?? -1) - (B[j] ?? -1); if (d) return d; } return a - b; });
    return idx.map(i => xs[i]);
  }
  // the names an item may have on the page: as it is; less a leading article ("The Emperor’s Sword": GW's "Emperor’s Sword"); less the
  // app's own suffix in brackets ("Coruscating Blue flames (ref. only)"); a bracket as words ("Gauntlets of Ultramar (Overhead Smash)")
  const names = s0 => { const s1 = String(s0), out = [];
    for (const x of [s1, s1.replace(/\s*\([^()]*\)\s*$/, ''), s1.replace(/[()[\]]/g, ' '), s1.replace(/\s*\[[^\]]*\]\s*$/, '')]) for (const y of [x, x.replace(/^(the|a|an)\s+/i, '')]) { const k = n(y); if (k && !out.includes(k)) out.push(k); }
    return out; };
  const art = k => k.replace(/^(the|a|an)(?=[a-z])/, '');
  // a weapon row's place on the page: "Group - profile", the name, the name in GW's plural or singular; a Hunter profile as "X - Hunter"
  // a name Wahapedia spells otherwise, as verify/deviations-numbers.json declares it (wahaName: "Toxinjecter Harpoon" / "Toxinjector Harpoon")
  const SPELL = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/deviations-numbers.json'), 'utf8')).filter(d => d.wahaName); } catch (e) { return []; } })();
  function weaponIndex(P, kind, r) {
    const L = P.weapons[kind]; if (!L.length) return -1;
    { const d = SPELL.find(x => x.kind === kind && x.row === (r.group ? r.group + ' – ' : '') + r.name && L.some(w => w.name === x.wahaName)); if (d) return L.findIndex(w => w.name === d.wahaName); }
    const pn = L.map(w => n(w.name)), pa = pn.map(art), G = r.group ? names(r.group) : [], N = names(r.name);
    const full = G.length ? G.flatMap(g => N.map(x => x.startsWith(g) ? x : g + x)) : N;
    for (const c of full.concat(N)) { let i = pn.indexOf(c); if (i < 0) i = pa.indexOf(art(c)); if (i >= 0) return i; }
    if (r.hunter || /\bhunter\b/i.test(r.name)) { const b = G.length ? G : names(String(r.name).replace(/\s*hunter.*$/i, '')); const i = L.findIndex(w => b.includes(n(w.group)) && /^hunter/i.test(w.profile || '')); if (i >= 0) return i; }
    if (G.length) { const i = L.findIndex(w => G.includes(n(w.group)) && N.includes(n(w.profile))); if (i >= 0) return i; }
    for (const c of full.concat(N)) { const i = pa.findIndex(x => x.replace(/s$/, '') === art(c).replace(/s$/, '')); if (i >= 0) return i; }
    if (G.length) { const i = L.findIndex(w => G.includes(n(w.group))); if (i >= 0) return i; }   // (a profile named otherwise: with its weapon)
    return -1;
  }
  // an ability's place on the page: [box, its place in the box]; one named as a box (Supreme Commander, Transport, Leader, a Damaged band)
  // at its box's head
  function abilityAt(P, ab) {
    const sp = SPELL.find(x => x.kind === 'abilities' && x.row === ab.name), N = names(ab.name).concat(sp ? names(sp.wahaName) : []), B = P.boxes;
    for (let b = 0; b < B.length; b++) { if (B[b].h === 'UNIT COMPOSITION') continue; const j = B[b].ab.findIndex(x => N.includes(n(x.name)) || N.includes(art(n(x.name)))); if (j >= 0) return [b, j]; }
    for (let b = 0; b < B.length; b++) { if (B[b].h === 'UNIT COMPOSITION') continue; const j = B[b].ab.findIndex(x => N.some(a => a.length > 3 && (n(x.name).startsWith(a) || a.startsWith(n(x.name))))); if (j >= 0) return [b, j]; }
    const hb = B.findIndex(x => N.includes(n(x.h)) || (/^damaged/i.test(ab.name) && n(x.h) === n(ab.name)));
    if (hb >= 0) return [hb, -1];
    // an invulnerable save New Recruit lists as an ability: GW prints it in the profile, before every box
    if (/^\*?invulnerable save\b/i.test(ab.name)) return [-1, 0];
    // else where its name stands in the page's words ("NORN ASSIMILATOR units have the following ability: Protean Purpose:"): in that box,
    // after the abilities before it
    const w = String(ab.name).replace(/\s*\([^()]*\)\s*$/, '').trim().split(/\s+/).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, "['’]"));
    const hit = w.length && new RegExp('>[^<]*\\b' + w.join('(?:\\s|&nbsp;|<[^>]+>)+'), 'i').exec(P.html);
    if (hit) { const at = hit.index; let b = -1; B.forEach((x, i) => { if (x.pos <= at && x.h !== 'UNIT COMPOSITION') b = i; }); if (b >= 0) { const j = B[b].ab.filter(a => a.pos < at).length; return [b, j - 0.5]; } }
    return null;
  }
  // rows of each part of an attached unit together, the parts in the order their rows first come in; each part's rows sorted by key
  // (a single datasheet's who is an option's name, "Throttlerokkit Shokka Engine": its rows sit where the page has them)
  function byPart(rows, key, parts) {
    if (parts && parts.length === 1) return sortBy(rows, key);
    const rank = []; rows.forEach(r => { const w = r.who || ''; if (!rank.includes(w)) rank.push(w); });
    return rank.flatMap(w => sortBy(rows.filter(r => (r.who || '') === w), key));
  }

  // a resolved unit's datasheet parts and their pages
  const partsOf = (u, faction) => {
    const names = u.leads ? [u.name].concat((u.also || []).map(x => x.name), [u.leads]) : [u.name];
    const out = names.map(nm0 => ({ name:nm0, page:pageFor(faction, nm0) })); out.faction = faction; return out;
  };
  const partIx = (parts, r) => parts.length === 1 ? 0 : parts.findIndex(p => p.name === r.who);

  function orderWeapons(u, kind, parts) {
    const rows = u[kind]; if (!Array.isArray(rows) || rows.length < 1) return;
    // each part's rows together, in the order its rows first come in today; an item a page does not name after the item before it
    const at = new Map(rows.map(r => { if (r.enh) return [r, Infinity]; const p = parts[partIx(parts, r)]; return [r, p && p.page ? weaponIndex(p.page, kind, r) : -2]; }));
    if ([...at.values()].every(x => x === -2)) return;   // no page: as it is
    // a multi-profile weapon's profiles together: at the place of its first profile on the page
    const gAt = new Map(); rows.forEach(r => { if (r.group && at.get(r) >= 0) { const g = (r.who || '') + '\0' + r.group; gAt.set(g, Math.min(gAt.has(g) ? gAt.get(g) : Infinity, at.get(r))); } });
    u[kind] = byPart(rows, r => {
      const g = r.group ? gAt.get((r.who || '') + '\0' + r.group) : undefined, a = at.get(r);
      if (a < 0 && g === undefined) return null;
      return [g !== undefined ? g : a, a >= 0 ? a : Infinity];
    });
    // a weapon's keywords: the page row's order; one a rule of the list adds (from) last
    for (const r of u[kind]) {
      if (!Array.isArray(r.kw) || r.kw.length < 2) continue;
      const p = parts[partIx(parts, r)]; if (!p || !p.page) continue;
      const i = weaponIndex(p.page, kind, r); if (i < 0) continue;
      const gk = p.page.weapons[kind][i].kw.map(kwBase), from = r.from || {};
      r.kw = sortBy(r.kw, k => from[k] !== undefined ? [Infinity] : gk.indexOf(kwBase(k)) >= 0 ? [gk.indexOf(kwBase(k))] : null);
    }
  }

  const isOwn = ab => /\b(Enhancement|Upgrade)\b/.test(ab.tag || '');
  function orderAbilities(u, parts) {
    const rows = u.abilities; if (!Array.isArray(rows) || rows.length < 2) return;
    if (parts.every(p => !p.page)) return;
    // each part's together; in a part, the page's boxes in their order and each box's abilities in theirs; the list's own last
    u.abilities = byPart(rows, ab => {
      if (isOwn(ab)) return [1e9];
      const p = parts[partIx(parts, ab)] || (parts.length > 1 ? null : parts[0]);
      if (!p || !p.page) return null;
      return abilityAt(p.page, ab);
    }, parts);
  }

  function orderRules(u, parts) {
    if (!Array.isArray(u.rules) || u.rules.length < 2 || parts.every(p => !p.page)) return;
    const core = [], army = [];
    for (const p of parts) if (p.page) { core.push(...(p.page.labels['CORE ABILITIES'] || []).map(n)); army.push(...(p.page.labels['ARMY RULES'] || []).map(n)); }
    const at = (L, r) => { const x = n(r); let i = L.indexOf(x); if (i < 0) i = L.findIndex(y => y && (x.startsWith(y) || y.startsWith(x))); return i; };
    u.rules = sortBy(u.rules, (r, i) => { const c = at(core, r); if (c >= 0) return [0, c]; const a = at(army, r); if (a >= 0) return [1, a]; return [2, i]; });
  }

  // keywords: own = the list's (Warlord, a keyword a rule of the list gives), last
  function orderKw(u, parts, own, names) {
    if (!Array.isArray(u.kw) || parts.every(p => !p.page)) return;
    const K = [], F = [];
    // (each part's KEYWORDS, then its datasheet's name keyword where the page leaves it out; an Allies marker is the list's own)
    for (const p of parts) if (p.page) { for (const k of p.page.keywords) if (!K.includes(n(k))) K.push(n(k)); for (const x of [p.name, (names || [])[parts.indexOf(p)]]) if (x && !K.includes(n(x))) K.push(n(x)); for (const k of p.page.factionKeywords) if (!F.includes(n(k))) F.push(n(k)); }
    const ownSet = new Set((own || []).concat(u.kw.filter(k => /^Allies: /.test(k))).map(n));
    u.kw = sortBy(u.kw, (k, i) => {
      // (a keyword GW's page prints is in GW's place, though a rule of the list also gives it: the Bloodmaster's BATTLELINE)
      const f = /^Faction: (.*)$/.exec(k);
      if (f) { const j = F.indexOf(n(f[1])); return j >= 0 ? [2, j] : ownSet.has(n(k)) ? [4, i] : [3, i]; }
      const j = K.indexOf(n(k)); return j >= 0 ? [0, j] : ownSet.has(n(k)) ? [4, i] : [1, i];
    });
  }

  // a unit's keywords as GW prints them (verify/keywords.js checks them; verify/tables.js --write writes them): every part's KEYWORDS and
  // FACTION KEYWORDS; and, of the unit's own, those GW prints or the list takes: its datasheet's name (GW prints it; Wahapedia's new-codex
  // pages leave it out), a keyword a named rule of the list gives (own: why.kw; a kwNote's "comes from <rule>"), a model's keyword
  // (kwOnly; a page's "MODEL: KW") or a detachment's (Wahapedia's detachment-only keyword) the list has, an Allies marker. Spelled as the
  // unit has it, else as GW prints it in title case. null: a part with no page (as it is)
  const TC = k => k.toLowerCase().replace(/(^|[\s-])([a-z\u00e0-\u00ff])/g, (m, a, b) => a + b.toUpperCase());
  // each BSData entry's own categories (verify/sources/bsdata-extract.json, by id), loaded on first use
  let BSC = null;
  const bsCats = id => { if (!BSC) { BSC = new Map(); try { const x = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/sources/bsdata-extract.json'), 'utf8'));
      const walk = o => { if (Array.isArray(o)) { o.forEach(walk); return; } if (!o || typeof o !== 'object') return; if (o.id && Array.isArray(o.categoryLinks)) BSC.set(o.id, o.categoryLinks.map(c => c.name)); for (const k in o) if (o[k] && typeof o[k] === 'object') walk(o[k]); };
      walk(x.files); } catch (e) {} }
    return BSC.get(id) || []; };
  // the BSData categories of each part of a list's unit (by the roots data.js BS_IDS names for it), [] when unknown
  const partCats = (bsIds, unitKey, parts) => { const sig = ((bsIds || {}).units || {})[unitKey];
    return parts.map((p, i) => Array.isArray(sig) && sig.length === parts.length ? bsCats(sig[i].split('|')[0]) : []); };
  // a datasheet's name keyword (GW prints one on every datasheet; Wahapedia's new-codex pages leave it out, so its spelling is BSData's)
  //   1. exact: the page's keyword or BSData's category that is the whole name; else the name less its leading words that are the page's
  //      own keywords (CHAOS Rhino, KHORNE Berzerkers, CANOPTEK Spyders, WAR DOG Brigand) and less "of <a page keyword>" (Daemon Prince of
  //      SLAANESH with Wings): that, as a keyword ("Daemon Prince with Wings"), as "<it, singular> Squad" (Chaos Terminators: TERMINATOR
  //      SQUAD), or less a last word that is a page keyword (Scarab Occult TERMINATORS: SCARAB OCCULT)
  //   2. head: the keyword the name's head (before of/on/in/with) ends with, else starts with, on the page or else in BSData. Not
  //      GW's by itself: only as verify/deviations-keywords.json declares it for the datasheet (name, with its evidence); else none
  //      (how:'head', undeclared), and verify/keywords.js fails
  //   A pick the page prints for another reason (a keyword of other datasheets too: HORRORS, SORCERER) is never exact by a head match.
  // a Wahapedia faction page's keyword index ("BERZERKERS (1); DAEMON PRINCE (2); …"): keyword -> how many datasheets have it
  const IDX = new Map();
  function keywordIndex(fac) {
    if (IDX.has(fac)) return IDX.get(fac);
    let out = {};
    try { const t = fs.readFileSync(path.join(ROOT, 'verify/.cache/waha', fac + '.html'), 'utf8').replace(/<[^>]+>/g, ' ').replace(/&rsquo;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
      const m = /((?:[A-Z][A-Z’'\- ]+ \(\d+\); )+[A-Z][A-Z’'\- ]+ \(\d+\)) The keywords presented/.exec(t);
      if (m) out = Object.fromEntries(m[1].split('; ').map(x => { const q = /^(.*) \((\d+)\)$/.exec(x.trim()); return [q[1].trim().replace(/’/g, "'"), +q[2]]; })); } catch (e) {}
    IDX.set(fac, out); return out;
  }
  const NAMES = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/deviations-keywords.json'), 'utf8')).filter(d => d.nameKeyword); } catch (e) { return []; } })();
  function nameKeyword(p, cats, faction) {
    const name = String(p.name).replace(/\s*\([^()]*\)\s*$/, ''), nm = n(name), uk = p.page.unitKeywords.map(k => k.replace(/\s*:\s*$/, ''));
    const pk = uk.concat(...Object.values(p.page.modelKeywords)).map(k => k.replace(/\s*:\s*$/, ''));
    const bc = (cats || []).filter(c => !/^Faction: /.test(c)), all = pk.map(k => ({ k:TC(k), from:'page' })).concat(bc.map(c => ({ k:c, from:'bsdata' })));
    const same = (x, y) => n(x) === n(y), find = v => all.find(x => same(x.k, v)) || all.find(x => n(x.k) + 's' === n(v) || n(x.k) === n(v) + 's');
    // the whole name, then less its leading words that are the page's own keywords or a god's name (one, then more), each also less
    // "of <a page keyword or god>"; the first that is a keyword (as it is, "<singular> Squad", in the plural or singular, or less a
    // last word that is a page keyword) is the name keyword
    const GOD = /^(khorne|tzeentch|nurgle|slaanesh)$/i, lead = x => GOD.test(x) || uk.some(y => same(y, x));
    const vs = [], words = name.split(/\s+/);
    for (let s0 = [words]; s0.length;) { const w = s0.shift(); vs.push(w.join(' ')); for (let k = 1; k <= Math.min(3, w.length - 1); k++) if (lead(w.slice(0, k).join(" "))) { s0.push(w.slice(k)); break; } }
    for (const v of vs.slice()) { const o = v.replace(/\s+of\s+(\S+)(?=\s|$)/i, (m, g) => lead(g) ? "" : m).trim(); if (o && o !== v) vs.push(o); }
    // (a part of the name is never a keyword the faction's Wahapedia keyword index gives two or more datasheets: WAR DOG, HORRORS,
    // DAEMON PRINCE, TERMINATOR; the index leaves out a name keyword only one datasheet has)
    const idx = keywordIndex(String(p.page.file).split('_')[0]), mine = x => !((idx[String(x.k).toUpperCase().replace(/’/g, "'")] || 0) >= 2);
    const ok = r => r && mine(r) ? { kw:r.k, from:r.from, how:'exact' } : null;
    for (const v of vs) {
      if (v === name) { const r = all.find(x => same(x.k, v)) || find(v); if (r) return { kw:r.k, from:r.from, how:'exact' }; }   // (the whole name: GW's, shared or not, WARBOSS)
      const r = ok(all.find(x => same(x.k, v))) || ok(all.find(x => same(x.k, v.replace(/s$/i, '') + ' Squad'))) || ok(find(v)); if (r) return r;
    }
    for (const v of vs) { const vw = v.split(/\s+/);
      if (vw.length > 2 && uk.some(x => same(x, vw[vw.length - 1]) || n(x) + 's' === n(vw[vw.length - 1]))) { const r = ok(all.find(x => same(x.k, vw.slice(0, -1).join(' ')))); if (r) return r; } }
    // head matches: only as declared
    const hd = n(name.split(/\s+(?:of|on|in|with)\s+/i)[0]);
    const suf = k => { const x = n(k); return x.length > 2 && (hd.endsWith(x) || hd.endsWith(x + 's')); }, pre = k => { const x = n(k); return x.length > 2 && hd.startsWith(x); };
    const longest = l => l.sort((a, b) => (suf(b.k) - suf(a.k)) || n(b.k).length - n(a.k).length)[0];
    const head = longest(all.filter(x => (x.from === 'page' || !pk.some(k => same(k, x.k))) && (suf(x.k) || pre(x.k))).filter((x, i, l) => x.from === 'page' || !l.some(y => y.from === 'page')));
    const dec = NAMES.find(d => d.datasheet === (faction ? faction + '/' : '') + p.name || d.datasheet === p.name);
    if (dec) {
      // (the declaration accepts the head match the rule finds, no other keyword; its evidence quotes that keyword where it is: the page's
      // KEYWORDS line as the page has it, or BSData's category)
      const ev = String(dec.evidence || ''), line = (/KEYWORDS "([^"]*)"/.exec(ev) || [])[1], bad = [];
      if (!head || !same(head.k, dec.nameKeyword)) bad.push('the declared ' + dec.nameKeyword + ' is not the head match the rule finds (' + (head ? head.k : 'none') + ')');
      if (!ev.includes('verify/.cache/waha/ds/' + p.page.file)) bad.push('its evidence does not cite the page verify/.cache/waha/ds/' + p.page.file);
      if (line === undefined || line !== uk.join('; ')) bad.push('its evidence does not quote the page\'s KEYWORDS line ("' + uk.join('; ') + '")');
      const where = head && head.from;
      if (where === 'page' && line !== undefined && !line.split('; ').some(k => same(k, dec.nameKeyword))) bad.push('the KEYWORDS line it quotes has no ' + dec.nameKeyword);
      if (where === 'bsdata' && !(ev.includes('"' + dec.nameKeyword + '"') && bc.some(c => same(c, dec.nameKeyword)))) bad.push('its evidence does not quote BSData\'s category "' + dec.nameKeyword + '", or BSData has none');
      if (dec.from && where && dec.from !== where) bad.push('it says from ' + dec.from + ', the pick is from ' + where);
      return Object.assign({ kw:dec.nameKeyword, from:where || dec.from || '?', how:'declared' }, bad.length ? { bad:bad.join('; ') } : {});
    }
    return head ? { kw:head.k, from:head.from, how:'head', undeclared:true } : null;
  }
  // cats: each part's BSData categories (partCats), for its name keyword; the result's .names: each part's name keyword, .missing: the
  // parts with none found
  function gwKeywords(u, parts, own, cats) {
    if (!Array.isArray(u.kw) || parts.some(p => !p.page)) return null;
    const want = [], keep = new Set(), add = (k, tc) => { if (!want.some(x => n(x) === n(k))) want.push(tc ? TC(k) : k); };
    for (const p of parts) for (const k of p.page.unitKeywords) add(k, true);
    const fac = parts.faction;
    const names = parts.map((p, i) => nameKeyword(p, (cats || [])[i], fac));
    for (const x of names) if (x && !x.undeclared) add(x.kw);
    for (const p of parts) for (const k of p.page.factionKeywords) add('Faction: ' + TC(k));
    const listed = new Set([].concat(parts.map(p => p.name), own || [], Object.keys(u.kwOnly || {}),
      parts.flatMap(p => Object.values(p.page.modelKeywords).flat().map(k => k.replace(/\s*:\s*$/, ''))), parts.flatMap(p => Object.keys(p.page.detachmentKeywords)),
      String(u.kwNote || '').split(/;\s*/).flatMap(seg => { const m = /^(.*?) comes? from (.*)$/.exec(seg); return m && !/^the (led|supported|combined)/.test(m[2]) ? m[1].split(/,\s*/) : []; })).map(n));
    for (const k of u.kw) if (listed.has(n(k)) || /^Allies: /.test(k)) keep.add(n(k));
    const out = u.kw.filter(k => keep.has(n(k)) || want.some(x => n(x) === n(k)));
    for (const k of want) if (!out.some(x => n(x) === n(k))) out.push(k);
    out.names = names.map(x => x && !x.undeclared ? x.kw : null); out.picks = names; out.missing = parts.filter((p, i) => !names[i] || names[i].undeclared || names[i].bad).map(p => p.name);
    return out;
  }
  // every resolved unit of the lists (the old form): its rows, a weapon's keywords, the Rules line (keywords: orderKw, with the list's own)
  function units(armies) {
    for (const a of armies) for (const u of a.units) {
      if (u.ds) continue;
      const parts = partsOf(u, a.faction);
      orderWeapons(u, 'ranged', parts); orderWeapons(u, 'melee', parts); orderAbilities(u, parts); orderRules(u, parts);
    }
  }
  // a datasheet row's lists (DATASHEETS: a faction catalogue's rows too), as one unit of it
  function sheet(id, s) {
    const u = Object.assign({}, s), parts = [{ name:s.name, page:pageFor(s.faction || id.split('/')[0], s.name) }];
    orderWeapons(u, 'ranged', parts); orderWeapons(u, 'melee', parts); orderAbilities(u, parts); orderRules(u, parts); orderKw(u, parts, []);
    return u;
  }
  return { units, sheet, orderKw, gwKeywords, nameKeyword, partCats, partsOf, pageFor, noPage, kwBase, n, weaponIndex, abilityAt, names };
};
