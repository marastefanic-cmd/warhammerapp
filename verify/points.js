#!/usr/bin/env node
/* verify/points.js: the gate step points. Every list unit's points are GW's, as its datasheet page prints them (Wahapedia: "YOUR UNIT
   COSTS" / "YOUR 1ST TO 2ND UNITS COST" / "YOUR 3RD+ UNIT COSTS", each unit size priced; WARGEAR OPTIONS "per <item> N"), read by
   verify/catalog.js gwCosts. It stands where the retired bsdata step held the points to BSData.
   For each unit of each list (a reference sheet has no points), each part of it (an attached unit's parts by its ptsNote,
   "<leader> + <Bodyguard> <pts>"):
     the part's points, less the enhancement it bears (the list's detachments' rows: an enhancement on its bearer's part, an Upgrade on
     the bodyguard), are the page's price for that copy of the datasheet in the list (the k-th unit of it, in the list's order) and its
     number of models (the models lines whose model is a profile or UNIT COMPOSITION line of that datasheet), plus each "per <item> N"
     row for every such item the part's models lines carry (an item of that name, or a bundle naming it: builder.js wargearOf's rule,
     names in the singular). An allied unit's price is the page's "Assigned Agent" one where GW prints both.
   A difference fails, unless verify/deviations-points.json declares it ({ list, unit, part, app, gw, reason, evidence }); a declaration
   nothing matches fails. A part whose page or price cannot be read fails too (never passed in silence).
     node verify/points.js     writes verify/out/points.json
   VERIFY_CACHE=<dir>: read the pages from another cache (verify/currency.js: today's pages). */
'use strict';
const fs = require('fs'), path = require('path');
const { ROOT, loadData, readJSON, writeJSON } = require('./lib');
const CAT = require('./catalog'), WC = require('./waha-catalog');
const D = loadData();
const RAW = (() => { const w = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8').replace(/\nreturn \{ version:VERSION,/, '\nreturn { RAW:{ ARMIES }, version:VERSION,'))(w); return w.WH_DATA.RAW.ARMIES; })();
const DEVF = path.join(ROOT, 'verify/deviations-points.json'), DEVS = readJSON(DEVF, []), used = new Set();
const lc = s => String(s).toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim(), sing = WC.sing;
const FJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/sources/factions.json'), 'utf8'));
// (each page read once)
const WWs = {}, WW = f => WWs[f] || (WWs[f] = (W => { const p0 = W.wahaPage, memo = new Map(); W.wahaPage = (n, f2) => { const k = n + '\u0000' + f2; if(!memo.has(k)) memo.set(k, p0(n, f2)); return memo.get(k); }; return W; })(require('./waha-words')(ROOT, f)));
// GW's costs of a datasheet, from its page (null: no page, or no costs on it)
const costs = new Map();
const gwOf = key => { if(costs.has(key)) return costs.get(key);
  const S = D.datasheets[key]; let g = null, file = null;
  // (an allied unit's page is under its own faction's pages: verify/sources/factions.json allies)
  let fac = S && S.faction;
  if(S){ for(const f of [S.faction].concat(Object.values((FJ[S.faction] || {}).allies || {}))){ const W = WW(f), pg = W.wahaPage(S.name, f); if(pg){ fac = f; file = pg.file;
      // (a datasheet GW prices twice, on its own and as an "Assigned Agent" in another faction's army, the Navigator's 60 and 75: an
      // allied unit's price is the Assigned Agent's)
      const L = W.markup(pg.tokens, pg.P, 0, pg.P.s.length - 1).split('\n'), bare = L.map(l => l.replace(/\*\*/g, '').trim()), at = bare.findIndex((l, i) => /^Assigned Agents?$/i.test(l) && /^YOUR .*COSTS?$/.test(bare.slice(i + 1).find(Boolean) || ''));
      g = at < 0 ? CAT.gwCosts(L) : f !== S.faction ? CAT.gwCosts(L.slice(at + 1)) : CAT.gwCosts(L.slice(0, at)); break; } } }
  const o = { g, file, sheet:S ? WC(ROOT).sheet(WW(fac), S.name, fac) : null }; costs.set(key, o); return o; };
// the "per <item> N" rows a wargear or weapon name takes: the row of its name, or of each item of a bundle it names (builder.js wargearOf's
// rule on wt-pts), names compared in the singular (New Recruit's "Twin Killsaw", GW's "per Twin Killsaws 5")
const wargearOf = (P, name) => { const rows = (P && P.wargear) || [], n = sing(name), hit = rows.filter(w => sing(w.name) === n);
  if(hit.length) return hit; const parts = lc(name).split(/\s*(?:&|,|\band\b)\s*/).filter(Boolean).map(sing); return parts.length > 1 ? rows.filter(w => parts.includes(sing(w.name))) : []; };
const fails = [], notes = [], counts = { parts:0, copies:0, wargear:0, lists:0 };
const enhPts = (a, name) => { for(const k of a.detachments || []) for(const e of ((D.factions[a.faction].detachments[k] || {}).enhancements || [])) if(lc(e.name) === lc(name) || (e.nr && lc(e.nr) === lc(name))) return Number(e.pts) || 0; return null; };
for(const a of D.armies){
  counts.lists++;
  const raw = RAW.find(x => x.id === a.id), seen = {};
  a.units.forEach((u, ui) => {
    if(u.ref) return;
    const e = raw.units.find(x => x.id === u.id), keys = [].concat((e && e.ds) || []), where = a.id + '/' + u.id;
    if(!keys.length){ fails.push(where + ': no datasheet (ds)'); return; }
    // the parts' points: the unit's, or its ptsNote's ("55 + Tankbustas 160")
    let pp = [u.pts];
    if(keys.length > 1){ const m = String(u.ptsNote || '').split(/\s*\+\s*/).map(x => +(/(\d+)\s*$/.exec(x) || [])[1]);
      if(m.length !== keys.length || m.some(isNaN) || m.reduce((t, x) => t + x, 0) !== u.pts){ fails.push(where + ': its ptsNote "' + u.ptsNote + '" does not give ' + keys.length + ' parts adding up to ' + u.pts); return; } pp = m; }
    // the models lines of each part: a line whose model is a profile or composition line of that part's datasheet; any other the bodyguard's
    const lines = (u.models || []).map((l, i) => { const m = /^(\d+)× (.*?)(?: \(([^()]*)\))?$/.exec(l) || [, 1, l, '']; return { n:+m[1], name:m[2], wargear:(m[3] || '').split(/,\s*/).filter(Boolean), gear:(u.gear || [])[i] || [] }; });
    const namesOf = k => { const S = D.datasheets[k] || {}, G = gwOf(k); return new Set([S.name].concat((S.stats || []).map(r => r.name), (S.composition || []).map(c => c.model), G.sheet ? G.sheet.models.map(m => m.model) : []).filter(Boolean).map(x => sing(String(x).replace(/\s*\(ref\. only\)$/i, '')))); };
    const partOf = l => { const b = sing(l.name.replace(/\s+w\/.*$/i, '')); let i = keys.findIndex(k => namesOf(k).has(b)); if(i < 0) i = keys.findIndex(k => [...namesOf(k)].some(x => b.startsWith(x) || x.startsWith(b))); return i < 0 ? keys.length - 1 : i; };
    const byPart = keys.map(() => []); for(const l of lines) byPart[partOf(l)].push(l);
    // the enhancement's part: the one its bearer is (enhOn), else the leader; an Upgrade: the bodyguard
    const enh = keys.map(() => 0);
    for(const [name, dflt] of [[u.enhancement, 0], [u.upgrade, keys.length - 1]]) if(name){ const p = enhPts(a, name);
      if(p === null){ fails.push(where + ': enhancement ' + name + ' is none of the list’s detachments’'); return; }
      const on = u.enhOn && name === u.enhancement ? keys.findIndex(k => (D.datasheets[k] || {}).name === u.enhOn) : -1; enh[on >= 0 ? on : dflt] += p; }
    const copies = u.copies || 1;
    for(let c = 0; c < copies; c++) keys.forEach((k, pi) => {
      counts.parts++;
      const S = D.datasheets[k], G = gwOf(k), part = S ? S.name : k, kth = (seen[k] = (seen[k] || 0) + 1);
      const dev = DEVS.findIndex(d => d.list === a.id && d.unit === u.id && d.part === part);
      const differ = (gw, why) => { if(dev >= 0 && DEVS[dev].app === pp[pi] && String(DEVS[dev].gw) === String(gw)){ used.add(dev); notes.push(where + ' · ' + part + ': declared'); return; }
        fails.push(where + ' · ' + part + (copies > 1 ? ' (copy ' + (c + 1) + ')' : '') + ': ' + pp[pi] + ' pts' + (enh[pi] ? ' with its ' + enh[pi] + '-pt enhancement' : '') + ', ' + why); };
      if(!G.g){ differ(null, G.file ? 'GW’s datasheet page ' + G.file + ' prints no unit costs' : 'no cached Wahapedia datasheet page'); return; }
      const grp = G.g.costs.find(x => x.from <= kth && (x.to == null || x.to >= kth)), n = byPart[pi].reduce((t, l) => t + l.n, 0);
      // (a datasheet GW prices at one size only has that price, whatever the list's models lines count: Canis Rex with Sir Hekhtur)
      const size = grp && (grp.models.find(x => x.models === n) || (grp.models.length === 1 ? grp.models[0] : null));
      if(!size){ differ(null, 'GW’s datasheet (' + G.file + ') prices no unit of ' + n + ' models as the ' + kth + (kth === 1 ? 'st' : kth === 2 ? 'nd' : kth === 3 ? 'rd' : 'th') + ' of the list (' + CAT.costsText(G.g) + ')'); return; }
      let wg = 0; const took = [];
      for(const l of byPart[pi]){ const cnt = xs => { const c = {}; for(const x of xs) c[x] = (c[x] || 0) + 1; return c; }, cg = cnt(l.gear), cw = cnt(l.wargear), per = {};
        // (an item the models line names in brackets and among its weapons is one item)
        for(const x of new Set(l.gear.concat(l.wargear))) per[x] = Math.max(cg[x] || 0, cw[x] || 0);
        for(const [x, k2] of Object.entries(per)) for(const w of wargearOf(G.g, x)){ wg += w.pts * k2 * l.n; took.push(k2 * l.n + '× ' + w.name + ' ' + w.pts); counts.wargear++; } }
      if(pi === keys.length - 1) for(const x of u.unplaced || []) for(const w of wargearOf(G.g, x)){ wg += w.pts; took.push('1× ' + w.name + ' ' + w.pts); counts.wargear++; }
      const want = size.pts + wg, have = pp[pi] - enh[pi];
      counts.copies++;
      if(want !== have) differ(want, 'GW’s datasheet (' + G.file + ') gives ' + want + (enh[pi] ? ' + ' + enh[pi] : '') + ': ' + n + ' models, the ' + kth + (kth === 1 ? 'st' : kth === 2 ? 'nd' : kth === 3 ? 'rd' : 'th') + ' of the list, ' + size.pts + (took.length ? ', ' + took.join(', ') : ''));
    });
  });
}
DEVS.forEach((d, i) => { if(!used.has(i)) fails.push('verify/deviations-points.json: nothing matches the declaration for ' + d.list + '/' + d.unit + ' · ' + d.part); });
writeJSON(process.env.VERIFY_OUT ? path.resolve(process.env.VERIFY_OUT, 'points.json') : path.join(ROOT, 'verify/out/points.json'), { checked:counts, declared:used.size, failures:fails });
if(fails.length){ console.log('FAIL points: ' + fails.length + ' problem(s)\n' + fails.map(x => ' - ' + x).join('\n')); process.exit(1); }
console.log('points: the points of ' + counts.copies + ' unit parts in ' + counts.lists + ' lists (each copy; an attached unit’s parts by its ptsNote), less their enhancements, are GW’s costs on their datasheet pages for that copy and unit size, with ' + counts.wargear + ' “per <item>” wargear costs' + (used.size ? '; ' + used.size + ' declared' : ''));
