#!/usr/bin/env node
/* verify/lines.js: the gate step "lines": the lines the app writes itself on a unit or stratagem screen stand on GW's words by fixed
   rules, as the Damage tab's boxes do (verify/evidence.js G1-G9).

     L0  columns a fixed rule derives from GW's words, stored = derived:
         damaged  an ability's Damaged range ("Damaged 1-6 W") is its words' "has 1-N wounds remaining" (or its name's "Damaged: 1-N
                  wounds remaining"), for every row that has one, and every list unit's ability with such words has it
         limit    a stratagem's "Once per battle" chip is exactly where its RESTRICTIONS say it can be used once per battle ("cannot use
                  this Stratagem more than once per battle", "can only use this Stratagem once per battle"; not "per battle round", not
                  "on the same … model")
     LF  (interim) every effect a datasheet footnote's words name (effects.js patterns over its note) is an effect of the unit's boxes
         (data.js BOXES of the sources the Damage tab gives it, its Damaged bands, its weapons' core abilities)

     node verify/lines.js      the gate step; writes verify/out/lines.json */
'use strict';
const fs = require('fs'), path = require('path');
const { ROOT } = require('./lib');
const E = require('../effects.js');
const X = require('./effects-extract');
const T = require('./tables');
const M = require('./effects-migrate');

const dm = require('./damage-node')(['shownMods']);
const D = dm.D, A = dm.app, fails = [], stats = {};
const fail = (g, where, what) => fails.push(g + ' ' + where + ': ' + what);

// ---- L0 damaged ----
const DAMAGED_NAME = /^Damaged: (\d+)-(\d+) wounds remaining$/i, DAMAGED_WORDS = /\bhas (\d+)-(\d+) wounds remaining\b/i;
const damagedOf = ab => { const m = DAMAGED_NAME.exec(ab.name || '') || DAMAGED_WORDS.exec(ab.text || ''); return m ? m[1] + '-' + m[2] : null; };
{ let n = 0;
  const RAW = T.read(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'));
  const rows = [];
  for(const a of D.armies) for(const u of a.units) for(const ab of u.abilities || []) rows.push([a.id + '/' + u.id, ab, true]);
  for(const [sid, S] of Object.entries(RAW.S ? RAW.S.value : {})) for(const ab of S.abilities || []) rows.push(['DATASHEETS ' + sid, ab, false]);
  for(const [where, ab, listed] of rows){
    const d = damagedOf(ab);
    if(ab.damaged != null){ n++; if(ab.damaged !== d) fail('L0', where + ' · ' + ab.name, 'damaged ' + JSON.stringify(ab.damaged) + ', its words give ' + (d || 'no range')); }
    else if(listed && d) fail('L0', where + ' · ' + ab.name, 'its words give Damaged ' + d + ', the row has none');
  }
  stats.damaged = n; }

// ---- L0 limit ----
const ONCE = /\b(?:cannot use this stratagem more than once per battle|can only use this stratagem once per battle)\b(?! round)/i;
{ let n = 0;
  const all = D.coreStratagems.map(s => ['Core · ' + s.name, s]).concat(Object.values(D.factions).flatMap(f => Object.values(f.detachments || {}).flatMap(d => (d.stratagems || []).map(s => [f.name + ' · ' + d.name + ' · ' + s.name, s]))));
  for(const [where, s] of all){
    const want = ONCE.test(X.plainCase(s.restrictions || '')) ? 'Once per battle' : undefined;
    if(s.limit !== want) fail('L0', where, 'limit ' + JSON.stringify(s.limit) + ', its RESTRICTIONS give ' + JSON.stringify(want || null) + ': “' + X.plainCase(s.restrictions || '') + '”');
    if(want) n++;
  }
  stats.limits = n; }

// ---- LF (interim): a footnote's effects are the unit's boxes' ----
// (a footnote's words read by the catalogue's patterns; the one-die re-rolls as the one they are part of, "re-roll one hit roll or one
// wound roll" read by the patterns as one hit roll; words in parentheses are what the footnote excludes)
const WIDER = { oneHit:['oneEither', 'oneAny'], oneWound:['oneEither', 'oneAny'], oneEither:['oneAny'], oneDmg:['oneAny'] };
const fxOfBox = o => !o ? [] : (o.b || []).flatMap(b => (b.fx || []).concat(b.part ? b.part.fx : []).concat((b.pick || []).flatMap(p => (p.fx || []).concat(p.part ? p.part.fx : []))));
const k = ([i, p]) => i + ':' + p;
if(typeof A.shownMods === 'function'){
  let n = 0, bad = 0;
  for(const a of D.armies) for(const u of a.units){
    const have = new Set();
    for(const S of A.inArmy(a, () => A.dmSources(a, u))) for(const f of fxOfBox((D.boxes || {})[S.key])) have.add(k(f));
    for(const ab of u.abilities || []) if(/^Damaged: /i.test(ab.name)) for(const f of fxOfBox((D.boxes || {})[M.KEY.ability(ab)])) have.add(k(f));
    for(const w of [].concat(u.ranged || [], u.melee || [])) for(const kw of w.kw || []) if(/^lance$/i.test(kw)) have.add('wound:1');
    for(const kind of ['ranged', 'melee']) for(const m of A.inArmy(a, () => A.shownMods(u, kind))){
      if(m.from === 'Plunging Fire') continue;   // (the situation's box on the Damage tab)
      n++;
      const words = String(m.note || '').replace(/\([^)]*\)/g, ' ') + ' ' + (m.set ? Object.entries(m.set).map(([c, v]) => /^[+-]/.test(v) ? v + ' ' + c.toLowerCase() : '').join(' ') : '');
      for(const f of X.findFx(E.norm(words)).fx){ const id = f[0];
        if(have.has(k(f)) || (WIDER[id] || []).some(w => [...have].some(h => h.startsWith(w + ':')))) continue;
        bad++; fail('LF', a.id + '/' + u.id + ' ' + kind, 'footnote of ' + m.from + ' “' + m.note + '” names ' + k(f) + ', no box of the unit has it'); }
    }
  }
  stats.footnotes = n; stats.footnoteFxNotInBoxes = bad;
}

fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive:true });
fs.writeFileSync(path.join(ROOT, 'verify/out/lines.json'), JSON.stringify({ stats, fails }, null, 1));
console.log('lines: ' + (fails.length ? fails.length + ' failure(s); ' : '') + stats.damaged + ' Damaged ranges and ' + stats.limits + ' once-per-battle chips as their words give them' +
  (stats.footnotes != null ? '; ' + stats.footnotes + ' footnotes, each effect one of the unit’s boxes' : ''));
for(const f of fails.slice(0, 60)) console.log('  FAIL ' + f);
process.exit(fails.length ? 1 : 0);
