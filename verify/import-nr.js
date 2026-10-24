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
// the Wahapedia datasheet wording and the data.js writer: verify/waha-words.js (shared with verify/from-json.js)
let WW = null; const ww = () => WW || (WW = require('./waha-words')(ROOT, factionId));
const wahaAddress = n => ww().wahaAddress(n);
// ---------------------------------------------------------------- faction and detachments
const nr0 = NR.parseNR(path.resolve(srcFile), []);
const catalogues = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/sources/factions.json'), 'utf8'))).filter(([k, v]) => k[0] !== '_' && v.bsdata).map(([k, v]) => [k, v.bsdata]));
const factionId = Object.keys(catalogues).find(k => nm(catalogues[k]) === nm(nr0.faction)) ||
  Object.keys(D.factions).find(k => nm(D.factions[k].name) === nm(nr0.faction.replace(/^.* - /, ''))) || slug(nr0.faction.replace(/^.* - /, ''));
const F = D.factions[factionId];
// an allied unit (New Recruit's role "Allies: Legiones Daemonica") has its datasheet under its own faction's Wahapedia pages:
// sources/factions.json names them (the faction's "allies": { "Legiones Daemonica": "chaos-daemons" })
const ALLIES = (JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/sources/factions.json'), 'utf8'))[factionId] || {}).allies || {};
const allyOf = role => { const m = /^Allies: (.+)$/.exec(role || ''); return m ? m[1] : null; };
if (!F) note(null, 'faction ' + nr0.faction + ' is not in data.js: transcribe its army rules, detachments, enhancements and stratagems from Wahapedia/GW, and add it to verify/sources/factions.json (verify/add-army.js does)');
const enhs = F ? Object.values(F.detachments).flatMap(d => d.enhancements || []) : [];
// (with New Recruit's spelling where it differs from GW's: an enhancement's `nr`)
const enhNames = F ? NR.enhNamesOf(F) : [];
const nr = NR.parseNR(path.resolve(srcFile), enhNames);   // again, now knowing which options are enhancements
const detIds = nrDetachments(nr.bullets['Detachment']).map(n => {
  const id = F && Object.keys(F.detachments).find(k => nm(F.detachments[k].name) === n);
  if (!id) note(null, 'detachment ' + n + ' is not in data.js: transcribe its rule, enhancements and stratagems (each stratagem with a gist)');
  return id || slug(n);
});
if (F) for (const id of detIds) for (const s of ((F.detachments[id] || {}).stratagems || [])) if (!s.gist) note(null, 'stratagem ' + s.name + ' has no gist');

// ---------------------------------------------------------------- the Wahapedia datasheet, as marked-up text
const wahaPage = (n, fac) => ww().wahaPage(n, fac);
const wording = (text, pages) => ww().wording(text, pages);
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
// an earlier version of this same list (same id) in --reuse is a donor too when data.js no longer has the list
for (const f of (flag('--fresh') ? '' : opt('--reuse', '') || '').split(',').filter(Boolean)) { global.window = {}; delete require.cache[path.resolve(f)]; require(path.resolve(f)); donorArmies.push(...window.WH_DATA.armies.filter(a => a.id !== armyId || !old)); }
const donorUnits = donorArmies.flatMap(a => a.units.map(u => Object.assign({ _army: a.id }, u)));
const reused = [];
const units = [];

for (const nu of nrUnits) {
  const opts = nu.models.map(m => nrOptions(m.options, enhNames));
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
  // the Wahapedia faction of its datasheet: an allied unit's own
  const ally = allyOf(role), pageFac = ally ? ALLIES[ally] : factionId;
  if (ally && !pageFac) note(name, 'allied unit (' + role + '): name its Wahapedia faction in verify/sources/factions.json (' + factionId + '.allies), then import again');
  const tag0 = [name].concat(also.map(c => c.name), lead ? [typo(lead)] : []).join(' + ');   // how the notes name it

  // weapons first: their names (and letter case) are what the gear lines refer to
  const kinds = {};
  for (const kind of ['ranged', 'melee']) kinds[kind] = nu[kind].map(r => {
    const w = nrWeapon(r, nu.who), o = {};
    // in data.js's order: group, who, n, name, hunter for a profile; name, who, n for a weapon
    if (w.group) o.group = typo(w.group); else o.name = typo(w.name);
    // New Recruit marks the profiles you pick one of with "➤"; a group without it fires every profile (Kustom Blasta X)
    // (a melee group is always a pick: a model fights with one melee weapon, 04.01; verify/choice.js)
    if (kind === 'ranged' && w.group && !/^\s*➤/.test(r.name)) o.fireAll = true;
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
    // a bundle whose own name has a comma ("Adrathic Desolator, 1 Fist and 1 Projectors (Adrathic Desolator, Caestus Fist, …)"):
    // the part before the comma is not an item of its own when the bundle holds it and the weapon table prints it once
    const items0 = m.options.map(nm).filter((it, j, all) => {
      const nx = all[j + 1] && /^.*?\((.*)\)$/.exec(all[j + 1]);
      if (/\(/.test(it) || !nx || !splitItems(nx[1]).some(x => lc(nm(x)) === lc(it))) return true;
      const rows = [...kinds.ranged, ...kinds.melee].filter(w => lc(w.group || w.name) === lc(it));
      return !(rows.length && rows.every(w => !w.n));
    });
    for (const it0 of items0) {
      if (it0 === 'Warlord' || /^•/.test(it0) || (o.enhItem && it0 === o.enhItem)) continue;
      const inner = /^.*?\((.*)\)$/.exec(it0);
      // a bundle taken more than once ("2x Gatling cannon and flamer (Despoiler gatling cannon, Heavy darkflamer)"): each of its items as often
      const times0 = inner ? +((/^(\d+)x\s+/.exec(it0) || [0, 1])[1]) : 1;
      for (const p of inner ? splitItems(inner[1]) : [it0]) {
        const c = /^(\d+)x\s+(.*)$/.exec(nm(p)), n = (c ? +c[1] : 1) * times0, base = c ? c[2] : nm(p);
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
  const pages = pageFac ? uniq([name].concat(also.map(c => c.name), nu.who.length ? nu.who : [], bodyguard ? [bodyguard] : [])).map(n => wahaPage(n, pageFac)) : [];
  // every datasheet page the unit's wording comes from, for verify/fetch.sh (Wahapedia's address is the name, words capitalised)
  uniq([name].concat(also.map(c => c.name), nu.who.length ? nu.who : [], bodyguard ? [bodyguard] : [])).forEach((n, k) => { if (pageFac) wantPages.add(pageFac + ' ' + wahaAddress(n)); });
  if (!pages.some(Boolean)) note(tag0, 'no cached Wahapedia datasheet: its ability texts are New Recruit’s plain words (run sh verify/fetch.sh and import again)');
  let upgrade = null;
  const abilities = [];
  for (const t of nu.tables) for (const r of t.rows) {
    const a = nrAbility(r.name, nu.who), o = {};
    const e = enhs.find(x => [x.name, x.nr].filter(Boolean).map(nm).some(n => n === a.base || n === a.full));
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
      // (New Recruit's plain words against the bold keywords as written: "Character unit" = "**CHARACTER** unit")
      if (appText(pa.text).s === appText(ab.text).s || (ab._plain && textEq(pa.text, ab.text)) || typoDev) { ab.text = pa.text; delete ab._plain; }
      else { note(tag0, 'ability ' + ab.name + ' has new words: its phase tags and footnotes were not kept'); continue; }
      for (const k of ['damaged', 'at', 'ph', 'turn', 'turns', 'def', 'na']) if (pa[k] !== undefined) ab[k] = pa[k];
    }
    // a hand-written note on a keyword a selection of the unit gives it (Houndpack Lance Character), while the unit still has it
    if (!u.kwNote && prev.kwNote && /^(.+?) comes? from (.+?) \(/.test(prev.kwNote) && u.models.some(l => l.includes(/^(.+?) comes? from (.+?) \(/.exec(prev.kwNote)[2]))) u.kwNote = prev.kwNote;
    // which models of the unit have a keyword or rule, and what no models line carries: while the unit still has them
    const gearNames = new Set([...u.ranged || [], ...u.melee || []].map(w => w.group || w.name).concat(u.abilities.map(a => a.name)));
    if (prev.unplaced) { const keep = prev.unplaced.filter(n => gearNames.has(n) && !u.models.some(l => l.includes(n))); if (keep.length) u.unplaced = keep; }
    if (prev.kwOnly) { const keep = Object.entries(prev.kwOnly).filter(([k]) => u.kw.includes(k)); if (keep.length) u.kwOnly = Object.fromEntries(keep); }
    if (prev.partialRules) { const keep = Object.entries(prev.partialRules).filter(([k]) => u.rules.includes(k)); if (keep.length) u.partialRules = Object.fromEntries(keep); }
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
      const sameWords = n => { const a1 = u.abilities.find(a => a.name === n), a2 = (d.abilities || []).find(a => a.name === n); return a1 && a2 && (appText(a1.text).s === appText(a2.text).s || (a1._plain && textEq(a2.text, a1.text))); };
      for (const k of ['mods', 'aura']) {
        const keep = (d[k] || []).filter(m => (!m.weapon || weapons.has(m.weapon)) && (!m.from || (names.has(m.from) && sameWords(m.from)) || armyNames.has(m.from)));
        if (keep.length) { u[k] = JSON.parse(JSON.stringify(keep)); reused.push(tag0 + ': ' + k + ' from ' + d._army + '/' + d.id); }
      }
    }
  }
  // each ability's phase tags and "When targeted" line: from any copy of it with the same name and words
  for (const ab of u.abilities) {
    if (ab.ph !== undefined) continue;
    const da = donorUnits.flatMap(x => (x.abilities || []).map(a => [x, a])).find(([x, a]) => a.name === ab.name && (appText(a.text).s === appText(ab.text).s || (ab._plain && textEq(a.text, ab.text))));
    if (!da) continue;
    for (const k of ['damaged', 'at', 'ph', 'turn', 'turns', 'def']) if (da[1][k] !== undefined) ab[k] = JSON.parse(JSON.stringify(da[1][k]));
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
const roleAt = r => ROLES.includes(r) ? ROLES.indexOf(r) : ROLES.length;   // allied units last
units.sort((a, b) => (roleAt(a.role) - roleAt(b.role)) || ((a.leads ? 1 : 0) - (b.leads ? 1 : 0)) || (a._page - b._page));

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

const { lit, block, unitSrc } = require('./waha-words').writer;
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
    // the list was written in full (the old form): its units become references to their datasheets (DATASHEETS)
    const t = spawnSync(process.execPath, [path.join(ROOT, 'verify/tables.js'), '--write'], { cwd: ROOT, encoding: 'utf8' });
    console.log((t.stdout || t.stderr).trim());
  }
} else {
  const out = path.resolve(opt('--out', path.join(ROOT, 'verify/out/import-' + armyId + '.js')));
  fs.writeFileSync(out, src);
  console.log('wrote ' + path.relative(process.cwd(), out) + ': ' + units.length + ' units; ' + todo.length + ' things to write (verify/out/import-' + armyId + '.md)');
}
