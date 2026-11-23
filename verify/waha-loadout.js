/* verify/waha-loadout.js: a datasheet's models and wargear as GW prints them (UNIT COMPOSITION, "equipped with", WARGEAR OPTIONS on its
   Wahapedia page, verify/waha-catalog.js sheet), read into the three columns of a faction catalogue row (docs/catalog.md) that
   verify/from-waha.js writes and builder.js holds an export to:
     composition  [{ model, min, max, group?, groupMin?, groupMax? }]: each of GW's model lines (a one-model datasheet's model by the
                  datasheet's New Recruit name, opts.rename: "Lord on Juggernaut" for GW's "World Eaters Lord on Juggernaut"); a line New Recruit holds as several model
                  entries (the names a committed export of the owner's has shown for it, "Khorne Berzerker w/ eviscerator and plasma
                  pistol") is a group of them, GW's numbers the group's
     options      [{ on, choices:[{ name }] }]: every weapon and wargear item GW names for a model line ("on": its model) or for the unit
                  ("on": "unit"): the names builder.js recognises (no limits here: loadout has them)
     loadout      what GW allows, read from its sentences: { lines:[{ model, names, default }], swaps:[…], adds:[…], caps:{…}, unread:[…] }
                    lines    each model line: its model, the model names an export may use for it, the weapons every such model carries
                    swaps    "<who>’s X can be replaced with Y" in its forms: { who, from:[items], to:[[items], …], limit }
                    adds     "<who> can be equipped with Y": { who, to:[[items], …], not:[items], limit }
                    limit    { kind:'each' } (every model may), { kind:'unit', n } (n models of the unit), { kind:'per', every, n }
                             (n for every <every> models in the unit)
                    caps     { <item>: n }: "(a model cannot be equipped with more than one X)"
                    unread   every sentence this reader cannot express: builder.js refuses a loadout other than GW's default on that
                             datasheet, naming the unit (never a guess)
   An item is a weapon row's name (its group's, for a weapon of several profiles) where the datasheet has that weapon, else the wargear's
   name as GW prints it. No BSData (the owner's decision, 22 Nov 2026). */
'use strict';
const n0 = s => String(s).toLowerCase().replace(/[’‘']/g, "'").replace(/[^a-z0-9']+/g, ' ').trim();
const sing = s => n0(s).split(' ').map(w => w.replace(/ies$/, 'y').replace(/(?<=[a-z])xes$/, 'x').replace(/(?<![su])s$/, '')).join(' ');
const NUM = { one:1, two:2, three:3, four:4, five:5 };

// "1 Hades battle cannon; 2 excruciator cannons" / "plasma pistol; Gorechild" → [{ n, name }]
function itemsOf(text) {
  return String(text).replace(/\.$/, '').split(/\s*;\s*/).map(x => x.trim()).filter(x => x && !/^nothing$/i.test(x)).map(x => {
    const m = /^(\d+|one|two|three)\s+(.+)$/i.exec(x); return m ? { n: NUM[m[1].toLowerCase()] || +m[1], name: m[2].trim() } : { n: 1, name: x };
  });
}
// "1 ectoplasma cannon and 1 Forgefiend claws" → two items; "1 combi-weapon" → one
const andItems = t => (/^\d+ .+ and \d+ /.test(t) ? t.split(/ and (?=\d+ )/).flatMap(itemsOf) : itemsOf(t)).map(x => ({ n: x.n, name: x.name.replace(/^additional /i, '') }));

module.exports = function read(sheet, rows, opts) {
  opts = opts || {};
  const unread = [];
  const weaponNames = [].concat(rows.ranged || [], rows.melee || []).map(w => w.group || w.name).filter((x, i, a) => a.indexOf(x) === i);
  // an item's name: the weapon row it is (its group's name), else GW's wargear name
  const itemName = raw => { const s = sing(raw); const w = weaponNames.find(x => sing(x) === s) || weaponNames.find(x => sing(x.replace(/[’']/g, '')) === s.replace(/'/g, ''));
    return w || raw.replace(/^./, c => c.toUpperCase()); };
  // (an item that is no weapon of the datasheet but whose comma-separated parts are: "Coward’s Bane, bladed horn")
  const items = t => andItems(t).flatMap(x => { const nm1 = itemName(x.name); if (weaponNames.includes(nm1) || !/,/.test(x.name)) return [{ n: x.n, name: nm1 }];
    const ps = x.name.split(/\s*,\s*/).map(itemName); return ps.every(p => weaponNames.includes(p)) ? ps.map(p => ({ n: x.n, name: p })) : [{ n: x.n, name: nm1 }]; });
  // ---- composition: GW's lines ("- 1 Jakhal Pack Leader, 1 Dishonoured and 8 Jakhals" / "or:" / "- 1 Jakhal Pack Leader, 2 …")
  const comp = [];
  { const alts = [[]];
    for (const l of sheet.lines.composition) {
      if (/^or:?$/i.test(l.trim())) { alts.push([]); continue; }
      const m = /^- (.+)$/.exec(l); if (!m) continue;
      for (const seg of m[1].replace(/\*/g, '').split(/,\s*|\s+and\s+(?=\d)/)) { const s = /^(\d+)(?:-(\d+))?\s+(.+?)(?:\s+models?)?(?:\s+[–-]\s+EPIC HERO)?$/.exec(seg.trim()); if (s) alts[alts.length - 1].push({ model: s[3].trim(), min: +s[1], max: +(s[2] || s[1]) }); }
    }
    for (const a of alts) for (const x of a) { x.gw = x.model; if ((opts.rename || {})[x.model]) x.model = opts.rename[x.model]; const c = comp.find(y => sing(y.model) === sing(x.model)); if (c) { c.min = Math.min(c.min, x.min); c.max = Math.max(c.max, x.max); } else comp.push(Object.assign({}, x)); }
    // (a model line of one alternative only: none in the others)
    if (alts.length > 1) for (const c of comp) if (alts.some(a => !a.some(x => sing(x.model) === sing(c.model)))) c.min = 0;
  }
  // the names New Recruit uses for a line (opts.nrModels: { <GW model>: [names] }), GW's own first
  const lines = comp.map(c => ({ model: c.model, names: [c.model].concat(((opts.nrModels || {})[c.gw]) || ((opts.nrModels || {})[c.model]) || []).filter((x, i, a) => a.findIndex(y => n0(y) === n0(x)) === i), default: [], wargear: [] }));
  const lineFor = who => { const s = sing(who); return lines.filter(l => sing(l.model) === s || sing(l.model).endsWith(' ' + s) || s.endsWith(' ' + sing(l.model))); };
  const one = lines.length === 1;
  // ---- "equipped with": "Every model is equipped with: …", "This model is equipped with: …", "The Gore Hound is equipped with: …",
  // "The Jakhal Pack Leader and every Jakhal is equipped with: …", "Every Flesh Hound is equipped with: …"
  for (const e of sheet.equipped) {
    const m = /^(.*?) (?:is|are) equipped with:\s*(.+)$/i.exec(e); if (!m) { unread.push(e); continue; }
    const subj = m[1].replace(/^The /, '');
    let to = /^(Every model|This model|Each model)$/i.test(subj) ? lines : subj.split(/\s+and\s+/).flatMap(s => lineFor(s.replace(/^(every|each|the)\s+/i, '')));
    if (!to.length) { unread.push(e); continue; }
    for (const it of items(m[2])) for (const l of to) { const isW = weaponNames.includes(it.name); for (let k = 0; k < it.n; k++) (isW ? l.default : l.wargear).push(it.name); }
  }
  // ---- WARGEAR OPTIONS: each sentence, with the "- 1 X" lines that follow one ending "one of the following:"
  const sents = [];
  for (const l0 of sheet.options) {
    const l = l0.replace(/^- /, '').trim();
    if (/^none\.?$/i.test(l)) continue;
    if (/^\d+ /.test(l) && sents.length && /following:$/.test(sents[sents.length - 1].t)) { sents[sents.length - 1].alts.push(l); continue; }
    sents.push({ t: l, alts: [] });
  }
  const swaps = [], adds = [], caps = {};
  const capOf = t => t.replace(/\s*\(a model cannot be equipped with more than one ([^)]+)\)/i, (m0, x) => { caps[itemName(x)] = 1; return ''; });
  // the replacement: "1 plasma pistol", "2 magma cutters", "1 axe of Khorne and one of the following:" + alternatives, "one of the following:"
  const toOf = (t, alts) => {
    const fixed = /^(.*?)\s*(?:and )?one of the following:$/.exec(t);
    if (fixed) { const base = fixed[1] ? items(fixed[1]) : []; return alts.map(a => base.concat(items(capOf(a)))); }
    return [items(capOf(t))];
  };
  const who1 = s => s.replace(/[’']s$/, '');
  const excl = [];
  for (const s of sents) {
    const t = s.t; let m;
    // a footnote's limits: "*This model cannot be equipped with both a X and a Y. This model cannot be equipped with more than 1 X, and it
    // cannot be equipped with more than 1 Y."
    if (/cannot be equipped with/.test(t)) {
      let rest = t.replace(/^\*/, '');
      for (const mm of rest.matchAll(/cannot be equipped with both (?:an? |1 )?(.+?) and (?:an? |1 )(.+?)(?=[.,]|$)/g)) excl.push([itemName(mm[1]), itemName(mm[2])]);
      for (const mm of rest.matchAll(/cannot be equipped with more than (?:1|one) (.+?)(?=[.,]|, and|$)/g)) caps[itemName(mm[1])] = 1;
      rest = rest.replace(/(?:This model|it|A model|a model) cannot be equipped with (?:both (?:an? |1 )?.+? and (?:an? |1 ).+?|more than (?:1|one) .+?)(?=[.,]|, and|$)/g, '').replace(/^[\s.,]*(?:and[\s.,]*)*$/g, '').replace(/[\s.,]|and/g, '');
      if (!rest) continue;
    }
    const flat = (it, n) => it.flatMap(x => Array(x.n * (n || 1)).fill(x.name));
    const push = (arr, o) => { arr.push(o); };
    // (what is replaced: "combi-bolter and accursed weapon" two items where each is one)
    // (an item named in the plural with no count, "This model’s excruciator cannons can be replaced with 2 magma cutters": every one the
    // default of the swap's model has, its count from that default; "their chainblade", or "1 combi-bolter", as named)
    const defCount = (name, who) => { const ls = who && who !== 'model' ? lineFor(who) : lines; return Math.max(0, ...ls.map(l => l.default.concat(l.wargear).filter(x => x === name).length)); };
    const plural = raw => !/^(?:\d+|one|two|three|four|five)\s/i.test(raw.trim()) && n0(raw) !== sing(raw);
    const fromOf = (f, who) => { f = f.replace(/^(?:their|its) /, ''); const ps = f.split(/\s+and\s+/);
      const its = ps.length > 1 && ps.map(itemName).every(p => weaponNames.includes(p)) ? ps.flatMap(p => items(p).map(x => Object.assign(x, { raw:p }))) : items(f).map(x => Object.assign(x, { raw:f }));
      return flat(its.map(x => plural(x.raw) && defCount(x.name, who) > x.n ? { n: defCount(x.name, who), name: x.name } : x)); };
    try {
      if ((m = /^(?:This model’s|The (.+?)’s) (.+?) can be replaced with (.+)$/.exec(t))) { push(swaps, { who: m[1] || (one ? lines[0].model : 'model'), from: fromOf(m[2], m[1] || (one ? lines[0].model : 'model')), to: toOf(m[3], s.alts).map(a => flat(a)), limit: { kind: m[1] ? 'unit' : 'each', n: 1 }, text: t }); continue; }
      if ((m = /^For every (\d+) models in this unit, (\d+) (.+?)’s (.+?) can be replaced with (.+)$/.exec(t))) { push(swaps, { who: m[3] === 'model' ? 'model' : who1(m[3]), from: fromOf(m[4], m[3] === 'model' ? 'model' : who1(m[3])), to: toOf(m[5], s.alts).map(a => flat(a)), limit: { kind: 'per', every: +m[1], n: +m[2] }, text: t }); continue; }
      if ((m = /^For every (\d+) models in this unit, up to (\d+) models can each have their (.+?) replaced with (.+)$/.exec(t))) { push(swaps, { who: 'model', from: fromOf(m[3], 'model'), to: toOf(m[4], s.alts).map(a => flat(a)), limit: { kind: 'per', every: +m[1], n: +m[2] }, text: t }); continue; }
      if ((m = /^(?:Any number of (?:(.+?) )?models|All models in this unit) can each be equipped with (.+)$/.exec(t))) { push(adds, { who: m[1] || 'model', not: [], to: toOf(m[2], s.alts).map(a => flat(a)), limit: { kind: 'each' }, text: t }); continue; }
      if ((m = /^(?:Any number of (?:(.+?) )?models|All models in this unit) can each have their (.+?) replaced with (.+)$/.exec(t))) { push(swaps, { who: m[1] || 'model', from: fromOf(m[2], m[1] || 'model'), to: toOf(m[3], s.alts).map(a => flat(a)), limit: { kind: 'each' }, text: t }); continue; }
      if ((m = /^(\d+) (.+?)’s (.+?) can be replaced with (.+)$/.exec(t))) { push(swaps, { who: m[2] === 'model' ? 'model' : m[2], from: fromOf(m[3], m[2] === 'model' ? 'model' : m[2]), to: toOf(m[4], s.alts).map(a => flat(a)), limit: { kind: 'unit', n: +m[1] }, text: t }); continue; }
      if ((m = /^For every (\d+) models in this unit, (\d+) (.+?) can be equipped with (.+)$/.exec(t))) { push(adds, { who: m[3] === 'model' ? 'model' : m[3], not: [], to: toOf(m[4], s.alts).map(a => flat(a)), limit: { kind: 'per', every: +m[1], n: +m[2] }, text: t }); continue; }
      if ((m = /^(\d+) (.+?)(?: that is not equipped with (?:an?|1) (.+?))? can be equipped with (.+)$/.exec(t)) && !/ or can /.test(t)) { push(adds, { who: m[2] === 'model' ? 'model' : m[2], not: m[3] ? [itemName(m[3])] : [], to: toOf(m[4], s.alts).map(a => flat(a)), limit: { kind: 'unit', n: +m[1] }, text: t }); continue; }
      // ("This model can be equipped with 1 havoc launcher or can replace 1 combi-bolter with 1 havoc launcher.": the add or the swap, one of
      // that item a model)
      if ((m = /^This model can be equipped with 1 (.+?) or can replace (1 .+?) with 1 (.+?)\.?$/.exec(t)) && itemName(m[1]) === itemName(m[3])) { const w = one ? lines[0].model : 'model';
        push(adds, { who: w, not: [], to: [[itemName(m[1])]], limit: { kind: 'each' }, text: t }); push(swaps, { who: w, from: fromOf(m[2], w), to: [[itemName(m[3])]], limit: { kind: 'each' }, text: t }); caps[itemName(m[1])] = 1; continue; }
      if ((m = /^This model can be equipped with (.+)$/.exec(t)) && !/ or can /.test(t)) { push(adds, { who: one ? lines[0].model : 'model', not: [], to: toOf(m[1], s.alts).map(a => flat(a)), limit: { kind: 'each' }, text: t }); continue; }
    } catch (e) {}
    unread.push(t + (s.alts.length ? ' ' + s.alts.join('; ') : ''));
  }
  // a swap's or add's model: a line of the datasheet (by GW's name, in the singular), or any model ("model")
  for (const x of swaps.concat(adds)) {
    if (x.who === 'model') { x.lines = lines.map(l => l.model); continue; }
    const ls = lineFor(x.who); if (!ls.length) { unread.push(x.text); x.bad = true; continue; }
    x.lines = ls.map(l => l.model);
  }
  const ok = x => !x.bad;
  const clean = x => { const o = { lines: x.lines, from: x.from, to: x.to, limit: x.limit, text: x.text }; if (!x.from) delete o.from; if (x.not && x.not.length) o.not = x.not; return o; };
  const loadout = { lines: lines.map(l => Object.assign({ model: l.model, names: l.names, default: l.default }, l.wargear.length ? { wargear: l.wargear } : {})), swaps: swaps.filter(ok).map(clean), adds: adds.filter(ok).map(clean) };
  if (Object.keys(caps).length) loadout.caps = caps;
  if (excl.length) loadout.excl = excl;
  if (unread.length) loadout.unread = unread;
  // ---- the composition builder.js checks: GW's lines, a line New Recruit holds as several entries a group of them
  const composition = [];
  for (const c of comp) {
    const l = lines.find(x => x.model === c.model);
    if (l.names.length === 1) { composition.push({ model: c.model, min: c.min, max: c.max }); continue; }
    const g = (c.min === c.max ? c.min : c.min + '-' + c.max) + ' ' + (c.gw || c.model);
    for (const nm1 of l.names) composition.push({ model: nm1, min: 0, max: c.max, group: g, groupMin: c.min, groupMax: c.max });
  }
  // ---- options: every item GW names for a line, and the unit's (an add for any model, which New Recruit holds on the unit)
  const options = [];
  for (const l of lines) {
    const names = [].concat(l.default, l.wargear || [], ...loadout.swaps.filter(x => x.lines.includes(l.model)).flatMap(x => x.to), ...loadout.adds.filter(x => x.lines.includes(l.model)).flatMap(x => x.to));
    const ch = names.filter((x, i, a) => a.indexOf(x) === i).map(x => ({ name: x }));
    for (const nm1 of l.names) if (ch.length) options.push({ on: nm1, choices: ch.map(x => Object.assign({}, x)) });
  }
  const unitAdds = [...new Set(loadout.adds.flatMap(x => x.to).flat())].filter(x => !weaponNames.includes(x));
  if (unitAdds.length && lines.length > 1) options.push({ on: 'unit', choices: unitAdds.map(x => ({ name: x })) });
  return { composition, options, loadout, sing };
};
module.exports.sing = sing;
