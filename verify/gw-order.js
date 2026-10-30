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
    weapons[hd.k].push({ name, group:parts.length > 1 ? parts[0] : null, profile:parts.length > 1 ? parts.slice(1).join(' - ') : null, kw:kws });
  }
  const labels = {};
  for (const m of h.matchAll(/class="dsCoreArmyLabel[^"]*">([\s\S]*?)<\/td><td class="dsCoreArmyValue">([\s\S]*?)<\/td>/g)) labels[txt(m[1])] = txt(m[2]).split(/\s*,\s*/).filter(Boolean);
  const abilities = [];
  const a0 = h.indexOf('>ABILITIES<'), a1 = h.indexOf('>UNIT COMPOSITION<');
  if (a0 >= 0) for (const m of h.slice(a0, a1 > a0 ? a1 : undefined).matchAll(/<div class="dsAbility( dsWargearAbility)?">([\s\S]*?)(?=<div class="dsAbility|<div class="dsHeader|<\/td>)/g)) {
    const b = /<b>([\s\S]*?)<\/b>/.exec(m[2]); if (!b) continue;
    const name = txt(b[1]).replace(/:$/, '').replace(/\s*\([^)]*\)\s*:?$/, '').trim();
    if (name) abilities.push({ name, wargear:!!m[1] });
  }
  const ds = WW.wahaDatasheet(html, null) || {};
  const kws = (ds.keywords || []).concat(...Object.values(ds.modelKeywords || {}));
  return { weapons, labels, abilities, keywords:kws, factionKeywords:ds.factionKeywords || [] };
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
  const findIn = (list, want, f) => { let i = list.findIndex(x => f(x) === want); return i; };
  // a weapon row's place on the page: "Group - profile", the name, the name in GW's plural or singular
  function weaponIndex(P, kind, r) {
    const L = P.weapons[kind]; if (!L.length) return -1;
    const full = n(r.group ? r.group + ' ' + r.name : r.name), plain = n(r.name);
    let i = findIn(L, full, w => n(w.name));
    if (i < 0) i = findIn(L, plain, w => n(w.name));
    if (i < 0 && r.group) i = L.findIndex(w => n(w.group) === n(r.group) && n(w.profile) === plain);
    if (i < 0) i = L.findIndex(w => { const a = n(w.name), b = r.group ? full : plain; return a.replace(/s$/, '') === b.replace(/s$/, ''); });
    if (i < 0 && r.group) i = L.findIndex(w => n(w.group) === n(r.group));   // (a profile named otherwise: with its weapon)
    return i;
  }

  // a resolved unit's datasheet parts and their pages
  const partsOf = (u, faction) => {
    const names = u.leads ? [u.name].concat((u.also || []).map(x => x.name), [u.leads]) : [u.name];
    return names.map(nm0 => ({ name:nm0, page:pageFor(faction, nm0) }));
  };
  const partIx = (parts, r) => parts.length === 1 ? 0 : parts.findIndex(p => p.name === r.who);

  function orderWeapons(u, kind, parts) {
    const rows = u[kind]; if (!Array.isArray(rows) || rows.length < 1) return;
    // each part in the order its rows first come in today; an item a page does not name after the item before it
    const rank = []; rows.forEach(r => { const w = r.who || ''; if (!rank.includes(w)) rank.push(w); });
    const at = rows.map(r => { if (r.enh) return Infinity; const p = parts[partIx(parts, r)]; return p && p.page ? weaponIndex(p.page, kind, r) : -2; });
    if (at.every(x => x === -2)) return;   // no page: as it is
    // a multi-profile weapon's profiles together: at the place of its first profile on the page
    const gAt = new Map(); rows.forEach((r, i) => { if (r.group && at[i] >= 0) { const g = (r.who || '') + '\0' + r.group; gAt.set(g, Math.min(gAt.has(g) ? gAt.get(g) : Infinity, at[i])); } });
    u[kind] = sortBy(rows, (r, i) => {
      const g = r.group ? gAt.get((r.who || '') + '\0' + r.group) : undefined;
      if (at[i] < 0 && g === undefined) return null;
      return [rank.indexOf(r.who || ''), g !== undefined ? g : at[i], at[i] >= 0 ? at[i] : Infinity];
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
    const rank = []; rows.forEach(r => { const w = r.who || ''; if (!rank.includes(w)) rank.push(w); });
    u.abilities = sortBy(rows, (ab, i) => {
      const R = rank.indexOf(ab.who || '');
      if (isOwn(ab)) return [R, 3, i];
      const p = parts[partIx(parts, ab)] || (parts.length > 1 ? null : parts[0]);
      if (!p || !p.page) return null;
      const L = p.page.abilities, a = n(ab.name);
      let j = L.findIndex(x => n(x.name) === a); if (j < 0) j = L.findIndex(x => a && (n(x.name).startsWith(a) || a.startsWith(n(x.name))));
      return j < 0 ? [R, 2, i] : [R, L[j].wargear ? 1 : 0, j];
    });
  }

  function orderRules(u, parts) {
    if (!Array.isArray(u.rules) || u.rules.length < 2 || parts.every(p => !p.page)) return;
    const core = [], army = [];
    for (const p of parts) if (p.page) { core.push(...(p.page.labels['CORE ABILITIES'] || []).map(n)); army.push(...(p.page.labels['ARMY RULES'] || []).map(n)); }
    const at = (L, r) => { const x = n(r); let i = L.indexOf(x); if (i < 0) i = L.findIndex(y => y && (x.startsWith(y) || y.startsWith(x))); return i; };
    u.rules = sortBy(u.rules, (r, i) => { const c = at(core, r); if (c >= 0) return [0, c]; const a = at(army, r); if (a >= 0) return [1, a]; return [2, i]; });
  }

  // keywords: own = the list's (Warlord, a keyword a rule of the list gives), last
  function orderKw(u, parts, own) {
    if (!Array.isArray(u.kw) || parts.every(p => !p.page)) return;
    const K = [], F = [];
    for (const p of parts) if (p.page) { for (const k of p.page.keywords) if (!K.includes(n(k))) K.push(n(k)); for (const k of p.page.factionKeywords) if (!F.includes(n(k))) F.push(n(k)); }
    const ownSet = new Set((own || []).map(n));
    u.kw = sortBy(u.kw, (k, i) => {
      if (ownSet.has(n(k))) return [4, i];
      const f = /^Faction: (.*)$/.exec(k);
      if (f) { const j = F.indexOf(n(f[1])); return j >= 0 ? [2, j] : [3, i]; }
      const j = K.indexOf(n(k)); return j >= 0 ? [0, j] : [1, i];
    });
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
  return { units, sheet, orderKw, partsOf, pageFor, noPage, kwBase, n };
};
