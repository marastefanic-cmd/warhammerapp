// The gate step numbers: every profile number a unit screen shows is GW's datasheet's, as Wahapedia transcribes it (verify/.cache/waha/ds),
// with GW's own documents on top (a Faction Pack's errata, a newer codex): a stat of each model type (M T Sv W Ld OC InSv), a weapon's
// Range A BS|WS S AP D, and the number in a weapon keyword ("RAPID FIRE 2", "ANTI-INFANTRY 4+", "MELTA 2").
//   A value a rule of the list changed (its row's from names the rule: a granted value) is compared by its base: the datasheet's own
//   value, else BSData's value before the rules (verify/out/bsdata.json grants, from verify/bsdata.js), against GW's; and the value shown
//   must be BSData's after the rules. A granted value with no base found fails. A keyword a rule gives must have its number in that rule's
//   words. A numbered keyword the page has not, that no rule gives, is a difference like any other. Every other difference fails, unless verify/deviations-numbers.json declares it with GW's
//   evidence ({ ds, kind, row, field, app, waha, reason, evidence }; status 'pending': noted on every run, not passed in silence). A row
//   the page has none of (a model or weapon Wahapedia's datasheet does not print: Sir Hekhtur's) is listed as unchecked; one that is not
//   declared fails too. A declaration nothing matches fails (stale).
//   node verify/numbers.js     writes verify/out/numbers.json
'use strict';
const fs = require('fs'), path = require('path');
const { ROOT, loadData, readJSON, writeJSON } = require('./lib');
const O = require('./gw-order')(ROOT);
const D = loadData();
const DEVS = readJSON(path.join(ROOT, 'verify/deviations-numbers.json'), []);

const nv = v => String(v == null ? '' : v).replace(/[−–—‐‑]/g, '-').replace(/["”″\s*]/g, '').toLowerCase().replace(/^n\/a$/, '-').replace(/^-$/, '-');
const STATS = [['M', 'M'], ['T', 'T'], ['Sv', 'SV'], ['W', 'W'], ['Ld', 'LD'], ['OC', 'OC'], ['InSv', 'INSV']];
const n = O.n;
// a granted value's base: BSData's value before the rules of the list change it (verify/bsdata.js, verify/out/bsdata.json grants), which is then
// compared with GW's datasheet as every other value; the value shown must be BSData's after the rules
const GR = new Map(((readJSON(path.join(ROOT, 'verify/out/bsdata.json'), {}) || {}).grants || []).map(g => [[g.army, g.unit, g.kind, g.idx, g.key].join('|'), g]));
// the words of a rule the list has, by its name: the unit's abilities, the faction's army and detachment rules, enhancements, stratagems
const ruleText = (a, u, name) => { const F = D.factions[a.faction] || {}, ds = Object.values(F.detachments || {});
  const all = [].concat(u.abilities || [], F.armyRules || [], ds.flatMap(d => [d.rule].concat(d.moreRules || [], d.enhancements || [], d.stratagems || [])).filter(Boolean));
  return all.filter(x => x.name === name).map(x => [x.text, x.effect].filter(Boolean).join(' ')).join(' ') || null; };
const fails = [], notes = [], unchecked = [], used = new Set(), seen = new Set(), shown = new Map();
const pageDev = (ds, kind, row) => { const i = DEVS.findIndex(d => d.ds === ds && d.kind === kind && d.row === row && d.field === 'page'); if(i >= 0) used.add(i); return i >= 0; };
const counts = { stats:0, weapons:0, keywords:0, granted:0 };
const declared = x => DEVS.findIndex(d => d.ds === x.ds && d.kind === x.kind && d.row === x.row && d.field === x.field && nv(d.app) === nv(x.app) && nv(d.waha) === nv(x.waha));
function differ(x){
  const k = JSON.stringify(x); if(seen.has(k)) return; seen.add(k);
  const i = declared(x);
  if(i < 0){ fails.push(x); return; }
  used.add(i);
  if(DEVS[i].status === 'pending') notes.push(Object.assign({ pending:DEVS[i].reason }, x));
}

// a stats row's page profile: by the model's name (GW's singular: "Flash Gitz" Flash Git, "Heavy Intercessor Squad" Heavy Intercessor);
// a page with one profile: every model's (GW prints one profile for the unit)
const base = s => n(String(s).replace(/ ×\d+$/, '').replace(/\s*[([][^)\]]*[)\]]\s*$/, ''));
const profileOf = (P, name, id) => { const ps = P.profiles; if(!ps.length) return null;
  const dev = id ? DEVS.findIndex(d => d.ds === id && d.kind === 'stats' && d.row === String(name).replace(/ ×\d+$/, '') && d.wahaName) : -1;
  if(dev >= 0){ used.add(dev); return ps.find(p => p.name === DEVS[dev].wahaName) || null; }
  if(ps.length === 1) return ps[0];
  const want = base(name), pn = p => n(p.name);
  let hit = ps.find(p => p.name && (pn(p) === want || pn(p) + 's' === want || pn(p) + 'z' === want || pn(p) === want + 's'));
  if(!hit) hit = ps.filter(p => p.name && want.startsWith(pn(p))).sort((a, b) => pn(b).length - pn(a).length)[0];
  return hit || null; };
// a weapon row's page row, by its name: as it is, a bracket as words ("Gauntlets of Ultramar (Overhead Smash)"), without the bracket
// ("Force weapon [Psychic]"), without "The"; a Hunter profile ("Melta Rifle HUNTER:…") as GW's "Melta Rifle - Hunter"; a name Wahapedia
// spells otherwise only as verify/deviations-numbers.json names it (wahaName)
const weaponRowOf = (P, kind, r, id, rowName) => {
  const L = P.weapons[kind], dev = DEVS.findIndex(d => d.ds === id && d.kind === kind && d.row === rowName && d.wahaName);
  if(dev >= 0){ used.add(dev); return L.find(w => w.name === DEVS[dev].wahaName) || null; }
  const g = r.group ? n(r.group) : '';
  if(r.hunter || /\bhunter\b/i.test(r.name)){ const h = L.find(w => n(w.group) === (g || n(r.name.replace(/\s*hunter.*$/i, ''))) && /^hunter/i.test(w.profile || '')); if(h) return h; }
  const names = [r.name, r.name.replace(/[()[\]]/g, ' '), r.name.replace(/\s*[([][^)\]]*[)\]]\s*$/, ''), r.name.replace(/^the /i, '')].map(n);
  const full = w => [n(w.name), n(w.name).replace(/^the/, '')];
  for(const x of names){
    const hit = L.find(w => full(w).includes(g && !x.startsWith(g) ? g + x : x)) || L.find(w => full(w).includes(x)) || (g && L.find(w => n(w.group) === g && n(w.profile) === x))
      || L.find(w => full(w).some(y => y.replace(/s$/, '') === (g && !x.startsWith(g) ? g + x : x).replace(/s$/, '')));
    if(hit) return hit;
  }
  return null;
};

for(const a of D.armies) for(const u of [...a.units, ...(a.refs || [])]){
  const parts = O.partsOf(u, a.faction), ids = [].concat(D.armies.length && u.ds || []);
  const partOf = r => parts.length === 1 ? 0 : parts.findIndex(p => p.name === r.who);
  // the datasheet's own value of a field a rule of the list changed (from): the DATASHEETS row's
  const sheetIdOf = i => a.faction + '/' + String(parts[i].name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const own = (i, kind, r, f) => { const s = D.datasheets[sheetIdOf(i)]; const row = s && (s[kind] || []).find(x => x.name === String(r.name).replace(/ ×\d+$/, '') && (x.group || null) === (r.group || null)); return row ? row[f] : undefined; };
  // a granted value's base (the datasheet's own, else BSData's before the rules); none: a failure, never a silent pass
  const base = (a0, u0, kind, r, f, dsv, id, row) => {
    const g = GR.get([a.id, u.id, kind, (u[kind] || []).indexOf(r), f].join('|'));
    if(g && g.after !== undefined && nv(g.after) !== nv(r[f])) differ({ ds:id, kind, row, field:f, app:r[f], waha:'(BSData with the rules: ' + g.after + ')', file:'' });
    const b = dsv !== undefined ? dsv : g && g.before;
    if(b === undefined) differ({ ds:id, kind, row, field:f, app:r[f], waha:'(granted by ' + [].concat(r.from[f]).join(', ') + ': no base value found)', file:'' });
    return b;
  };
  // stats: each model type
  for(const r of u.stats || []){
    // (in an attached unit: the part whose page names this model, else the part of its name, else the bodyguard)
    let i = parts.length === 1 ? 0 : parts.findIndex((p, k) => p.page && p.page.profiles.length > 1 && profileOf(p.page, r.name, sheetIdOf(k)));
    if(i < 0) i = parts.findIndex(p => n(p.name) === n(String(r.name).replace(/ ×\d+$/, '')));
    if(i < 0) i = parts.length - 1;
    const id = sheetIdOf(i), rn = String(r.name).replace(/ ×\d+$/, '');
    if(pageDev(id, 'stats', rn)) continue;   // (declared: no GW profile of this model on the page)
    const P = parts[i] && parts[i].page, pr = P && profileOf(P, r.name, id);
    if(!pr){ unchecked.push({ ds:id, kind:'stats', row:r.name, why:P ? 'no profile of this model on ' + P.file : 'no Wahapedia datasheet page' }); continue; }
    for(const [f, g] of STATS){
      if(pr[g] === undefined && f === 'InSv'){ if(r.InSv && nv(r.InSv) !== '-' && !(r.from && r.from.InSv)) differ({ ds:id, kind:'stats', row:String(r.name).replace(/ ×\d+$/, ''), field:f, app:r[f], waha:'–', file:P.file }); counts.stats++; continue; }
      if(pr[g] === undefined) continue;
      counts.stats++;
      let v = r[f];
      if(r.from && r.from[f] !== undefined){ counts.granted++; v = base(a, u, 'stats', r, f, own(i, 'stats', r, f), id, String(r.name).replace(/ ×\d+$/, '')); if(v === undefined) continue; }
      shown.set([id, 'stats', String(r.name).replace(/ ×\d+$/, ''), f].join('|'), v);
      if(nv(v) !== nv(pr[g])) differ({ ds:id, kind:'stats', row:String(r.name).replace(/ ×\d+$/, ''), field:f, app:v, waha:pr[g], file:P.file });
    }
  }
  // weapons: Range A BS|WS S AP D, and the numbers in its keywords
  for(const kind of ['ranged', 'melee']) for(const r of u[kind] || []){
    if(r.enh) continue;   // (an enhancement's weapon: the list's own, its text checked by verify/texts.js)
    const i = Math.max(0, partOf(r)), P = parts[i] && parts[i].page, id = sheetIdOf(i), rowName = (r.group ? r.group + ' – ' : '') + r.name;
    if(pageDev(id, kind, rowName)) continue;
    const w = P && weaponRowOf(P, kind, r, id, rowName), exact = !!w;
    if(!exact){ unchecked.push({ ds:id, kind, row:rowName, why:P ? 'no row of this weapon on ' + P.file : 'no Wahapedia datasheet page' }); continue; }
    for(const [f, g] of [['range', 'range'], ['A', 'A'], [kind === 'ranged' ? 'BS' : 'WS', 'skill'], ['S', 'S'], ['AP', 'AP'], ['D', 'D']]){
      counts.weapons++;
      let v = r[f];
      if(r.from && r.from[f] !== undefined){ counts.granted++; v = base(a, u, kind, r, f, own(i, kind, r, f), id, rowName); if(v === undefined) continue; }
      shown.set([id, kind, rowName, f].join('|'), v);
      if(nv(v) !== nv(w[g])) differ({ ds:id, kind, row:rowName, field:f, app:v, waha:w[g], file:P.file });
    }
    for(const k of r.kw || []){
      if(!/\d/.test(k)) continue;
      if(r.from && r.from[k] !== undefined){
        // a keyword a rule of the list gives: its number as the rule's words give it ("[SUSTAINED HITS 1]")
        counts.granted++; counts.keywords++;
        const t = [].concat(r.from[k]).map(x => ruleText(a, u, x)).filter(Boolean).join(' ').replace(/\*\*/g, '').toUpperCase(), want = k.replace(/:.*$/, '').trim().toUpperCase();
        if(!t || !t.includes(want)) differ({ ds:id, kind, row:rowName, field:'kw ' + k.replace(/\s*\d.*$/, ''), app:k, waha:'(granted by ' + [].concat(r.from[k]).join(', ') + ': ' + (t ? 'its words do not give ' + want : 'no words of it found') + ')', file:'' });
        continue;
      }
      const gk = w.kw.find(x => O.kwBase(x) === O.kwBase(k) && (!/^ANTI-/i.test(k) || n(x.replace(/\s*\d.*$/, '')) === n(k.replace(/\s*\d.*$/, ''))));
      counts.keywords++;
      // (a numbered keyword the page has not, and no rule of the list gives: a difference, declared or failed)
      if(!gk){ differ({ ds:id, kind, row:rowName, field:'kw ' + k.replace(/\s*\d.*$/, ''), app:k, waha:'–', file:P.file }); continue; }
      const num = x => (String(x).replace(/:.*$/, '').match(/D?\d+\+?(?:[+-]\d+)?/gi) || []).join(' ').toLowerCase();
      if(num(k) !== num(gk)) differ({ ds:id, kind, row:rowName, field:'kw ' + k.replace(/\s*\d.*$/, ''), app:k, waha:gk, file:P.file });
    }
  }
}
// an ability's declared spelling (kind 'abilities', for verify/gw-order.js): the unit has the ability, the page the spelling
DEVS.forEach((d, i) => { if(d.kind !== 'abilities' || !d.wahaName) return;
  const [fac, ...rest] = d.ds.split('/'), sheet = D.datasheets[d.ds], P = sheet && O.pageFor(fac, sheet.name);
  if(sheet && (sheet.abilities || []).some(x => x.name === d.row) && P && P.abilities.some(x => x.name === d.wahaName)) used.add(i);
  else fails.push({ ds:d.ds, kind:d.kind, row:d.row, field:'name', why:'verify/deviations-numbers.json #' + i + ': no such ability, or its page has no ' + d.wahaName }); });
// a GW document over Wahapedia (gw: { file, quote, value }): its words must be in that file (verify/.cache/gw); one the app follows
// where Wahapedia agrees with the app (a Faction Pack line a newer codex superseded: superseded true) is matched by the value shown
const GWDIR = path.join(ROOT, 'verify/.cache/gw'), sp = t => String(t).replace(/\s+/g, ' ');
DEVS.forEach((d, i) => {
  if(!d.gw) return;
  const f = fs.existsSync(GWDIR) && fs.readdirSync(GWDIR).find(x => x === d.gw.file);
  if(!f || !sp(fs.readFileSync(path.join(GWDIR, f), 'utf8')).includes(sp(d.gw.quote))) fails.push({ ds:d.ds, kind:d.kind, row:d.row, field:d.field, why:'verify/deviations-numbers.json #' + i + ': its GW quote is not in verify/.cache/gw/' + d.gw.file });
  if(nv(d.app) === nv(d.waha)){ const v = shown.get([d.ds, d.kind, d.row, d.field].join('|')); if(v !== undefined && nv(v) === nv(d.app)){ used.add(i); if(d.status === 'pending') notes.push(Object.assign({ pending:d.reason }, d)); } }
});
// an unchecked row must be declared too (field 'page')
{ const k = x => [x.ds, x.kind, x.row].join('|'), u0 = new Map(unchecked.map(x => [k(x), x])); unchecked.length = 0; unchecked.push(...u0.values()); }
for(const x of unchecked){ const i = DEVS.findIndex(d => d.ds === x.ds && d.kind === x.kind && d.row === x.row && d.field === 'page'); if(i >= 0) used.add(i); else fails.push(Object.assign({ field:'page', app:'(shown)', waha:'(none)' }, x)); }
DEVS.forEach((d, i) => { if(!used.has(i)) fails.push({ stale:true, ds:d.ds, kind:d.kind, row:d.row, field:d.field, app:d.app, waha:d.waha, why:'verify/deviations-numbers.json #' + i + ': nothing matches it' });
  else if(!d.reason || !d.evidence) fails.push({ ds:d.ds, kind:d.kind, row:d.row, field:d.field, why:'verify/deviations-numbers.json #' + i + ': no reason or evidence' }); });
writeJSON(path.join(ROOT, 'verify/out/numbers.json'), { counts, declared:used.size, pending:notes, unchecked, fails });
console.log('numbers: ' + (fails.length ? fails.length + ' failure(s); ' : '') + counts.stats + ' stats, ' + counts.weapons + ' weapon numbers and ' + counts.keywords + ' keyword numbers checked against the Wahapedia datasheets (' + counts.granted + ' granted values compared as the datasheet has them); ' + used.size + ' declared deviations used' + (notes.length ? '; ' + notes.length + ' PENDING (declared, not decided): ' + notes.map(x => x.ds + ' ' + x.row + ' ' + x.field).join(', ') : ''));
for(const f of fails) console.log('  FAIL ' + (f.stale ? 'stale ' : '') + f.ds + ' · ' + f.kind + ' · ' + f.row + ' · ' + f.field + ': app ' + JSON.stringify(f.app) + ', Wahapedia ' + JSON.stringify(f.waha) + (f.why ? ' (' + f.why + ')' : f.file ? ' (' + f.file + ')' : ''));
for(const x of notes) console.log('  PENDING ' + x.ds + ' · ' + x.row + ' · ' + x.field + ': ' + x.pending);
process.exit(fails.length ? 1 : 0);
