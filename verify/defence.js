#!/usr/bin/env node
/* verify/defence.js: the gate step "defence": the "When targeted" lines on a unit's screen stand on GW's words by fixed rules, as the
   Damage tab's boxes do (verify/evidence.js G1-G9) and the footnotes under its weapons (verify/lines.js L1-L8).

   The defence side of every rule, ability and stratagem is in data.js BOXES (d: its defence boxes, dnc: its words about attacks against the
   unit that no defence reads, dreach: the units a stratagem protects when they are not its TARGET), made by verify/effects-extract.js
   (defenceOf) with the effects.js catalogue (DF the defences, DCOND their own conditions, DNC the reasons words are not counted). This step
   checks:

     D1  schema and catalogue: every defence box carries the fields the script writes and no other; every defence is a DF id with a value of
         its domain, every condition a COND or DCOND id; its kind one of ranged, melee, psychic, all; and no hand or AI column of the
         defence side is left in data.js (def, defOf, defPh, guard, shield, defPick, defCalc)
     D2  every quote, the line it continues and every not-counted sentence is a verbatim sentence of its source's GW text (or of a faction term
         its words name in bold, RULE_SRC: the Pulse Jet's "pulse jet move", term)
     D3  every defence's own words are in its quote (or the line it continues): the DF patterns find it there, with its value
     D4  completeness: every sentence of a source the DF patterns read a defence in that is about attacks against the unit (DEFENCE, the
         extractor's own DEF_CTX) or is a defence wherever it is (Feel No Pain, an invulnerable save …), and every sentence the DNC patterns
         name, is a defence box's quote or in dnc (never left out)
     D5  every condition stands on its words: a COND or DCOND pattern in the quote, its line or its source's words; a quoted one verbatim;
         a reach's keywords literal keywords of the words; "while this model is leading a unit" in a quote is a leading condition
     D6  the code: every function and constant of the defence side (defenceItems, defSources, defLineOf, defLine, DEF_KIND, any def… or
         DEF_… declaration) reads no reading column (def, guard, shield, defPick, defCalc, note, when) and no rule's words, and writes no
         defence (no "5+ INV", no "Feel No Pain" in the code)
     DC  every condition GW's words put on a box is on it (verify/coverage.js): its option (a table row, a named or bold option, "select
         one of the following", "Or:", one of a section's abilities another ability selects), once per battle / turn / battle round, each
         "if / while / unless" clause, each "within N"", the kind of attack (melee, ranged, psychic): said, quoted ("If (see the rule)"), or
         the sentence listed not counted
     D7  data.js BOXES' defence side is exactly what the words give (node verify/effects-migrate.js --write)
     D8  every DF defence and DCOND condition says its own value in its label, and a box of it alone renders that label
     DL  the lines as the screen has them, for every list × unit: each "When targeted" line is a defence box the database gives that unit,
         said in its defences' and conditions' labels (a box whose only conditions are GW's quoted words: "If (see the rule)"); every box
         the database gives it is one line, once; a source of the unit with words not counted has one "not counted here: see the rule" line

     node verify/defence.js     the gate step; writes verify/out/defence.json */
'use strict';
const fs = require('fs'), path = require('path');
const { ROOT } = require('./lib');
const E = require('../effects.js');
const X = require('./effects-extract');
const M = require('./effects-migrate');
const T0 = require('./tables');

const dm = require('./damage-node')(['defenceItems', 'defSources', 'defLineOf', 'defLine', 'abilityKey']);
const D = dm.D, A = dm.app, fails = [], stats = {};
const fail = (g, where, what) => fails.push(g + ' ' + where + ': ' + what);
const flat = s => X.plainCase(s).toLowerCase();
const T = M.build(D), S = M.sources(D);
const KINDS = new Set(['ranged', 'melee', 'psychic', 'all']);
const C = Object.assign({}, E.COND, E.DCOND);

// ---- D1 schema; D2 verbatim; D3 its words; D5 its conditions ----
const BOX_KEYS = new Set(['quote', 'lead', 'df', 'on', 'kind', 'scope', 'reach', 'mark', 'notSelf', 'foe', 'opt', 'pick', 'term', 'until']),
  PICK_KEYS = new Set(['name', 'df', 'quote']), SCOPE_KEYS = new Set(['models']), DNC_KEYS = new Set(['quote', 'why', 'term']);
const domOk = (id, p) => !!E.DF[id] && E.DF[id].dom.some(x => String(x) === String(p));
let nBox = 0, nDnc = 0;
for(const [name, TT] of [['the words', T], ['data.js BOXES', D.boxes || {}]]) for(const [key, o] of Object.entries(TT)){
  if(!o.d && !o.dnc && !o.dreach) continue;
  const src = S.get(key); if(!src){ fail('D1', key, 'no source of the lists has this key'); continue; }
  const where = key + ' ' + o.n + (name === 'the words' ? '' : ' (data.js)'), text = flat((src.table ? M.ruleText(src) : src.text || '') + (src.tagText ? '\n' + src.tagText : '') + (src.terms || []).map(t => '\n' + t.text).join(''));
  const ex = (x, keys) => Object.keys(x || {}).filter(k => !keys.has(k));
  for(const b of o.d || []){ if(name === 'the words') nBox++;
    const bad = ex(b, BOX_KEYS).concat(ex(b.scope, SCOPE_KEYS), (b.pick || []).flatMap(p => ex(p, PICK_KEYS)));
    if(bad.length) fail('D1', where, 'fields no script writes: ' + bad.join(', '));
    const dfs = b.pick ? b.pick.flatMap(p => p.df) : b.df;
    if(!dfs || !dfs.length) fail('D1', where, 'a defence box with no defence');
    for(const [id, p] of dfs || []) if(!domOk(id, p)) fail('D1', where, 'defence ' + id + ' ' + JSON.stringify(p) + ' not in the catalogue or its domain');
    for(const [id] of b.on || []) if(!C[id]) fail('D1', where, 'condition ' + id + ' not in the catalogue');
    if(!KINDS.has(b.kind)) fail('D1', where, 'kind ' + b.kind);
    // D2
    for(const q of String(b.quote || '').split('\n').concat(b.lead ? b.lead.split('\n') : []).concat((b.pick || []).map(p => p.quote))) if(!text.includes(flat(q).replace(/\s*\.\s*$/, ''))) fail('D2', where, 'not GW’s words: “' + q.slice(0, 80) + '”');
    // D3
    for(const part of b.pick || [b]){ const found = X.findDf(E.norm(part.quote)).df.concat(b.lead ? X.findDf(E.norm(b.lead + ' ' + part.quote)).df : []);
      for(const [id, p] of part.df) if(!found.some(([i2, p2]) => i2 === id && String(p2) === String(p))) fail('D3', where, id + ' ' + p + ' is not in its quote “' + String(part.quote).slice(0, 80) + '”'); }
    // D5
    if(b.term && !(src.terms || []).some(t => t.name === b.term)) fail('D5', where, 'the term ' + b.term + ' is not one its words name');
    const ctxT = E.norm([b.quote, b.lead || '', src.when || '', src.target || '', src.table ? M.ruleText(src) : src.text || '', src.tagText || '', src.tag || '', src.pickOf ? src.pickOf.text : '', (src.terms || []).map(t => t.text).join(' ')].join(' '));
    for(const [id, p] of b.on || []){ const c = C[id]; if(!c) continue;
      if(c.pats.length && !c.pats.some(re => re.test(ctxT))) fail('D5', where, 'condition ' + id + ' has no words in its source');
      // (GW's struck words left out: "(excluding ~~MONSTER~~/VEHICLE units)")
      const unstruck = flat(String(src.when + ' ' + src.target + ' ' + ((src.table ? M.ruleText(src) : src.text || '') + (src.terms || []).map(t => '\n' + t.text).join(''))).replace(/~~[^~]*~~\/?/g, ''));
      if(id === 'q' && !flat(src.when + ' ' + src.target + ' ' + text).includes(flat(p).toLowerCase()) && !unstruck.includes(flat(p).toLowerCase()) && !/^Once per battle round$/.test(p)) fail('D5', where, 'quoted condition not verbatim: ' + p); }
    if(b.until && !flat(text + ' ' + (src.effect || '')).includes(flat(b.until))) fail('D5', where, 'its duration not GW’s words: ' + b.until);
    if(/\bwhile this (?:model|unit) is leading a unit\b/.test(E.norm(b.quote)) && !(b.on || []).some(x => x[0] === 'leading')) fail('D5', where, '"while this model is leading a unit" and no leading condition');
    for(const k of [].concat(((b.reach || {}).all) || [], ((b.reach || {}).any) || [], ((b.reach || {}).none) || [])) if(!text.includes(String(k).replace(/^Faction: /, '').toLowerCase().replace(/s$/, ''))) fail('D5', where, 'reach keyword ' + k + ' is not a literal keyword of its words');
  }
  for(const x of o.dnc || []){ if(name === 'the words') nDnc++;
    if(ex(x, DNC_KEYS).length) fail('D1', where, 'not-counted fields no script writes: ' + ex(x, DNC_KEYS).join(', '));
    if(!Object.values(E.DNC).some(r => r.why === x.why)) fail('D1', where, 'not counted for a reason not in effects.js DNC: ' + x.why);
    if(!flat(text + ' ' + (src.effect || '')).includes(flat(x.quote).replace(/\s*\.\s*$/, ''))) fail('D2', where, 'not counted, not GW’s words: “' + x.quote.slice(0, 80) + '”'); }
  if(o.dreach && src.type !== 'strat') fail('D1', where, 'dreach on a source that is no stratagem');
}
stats.boxes = nBox; stats.notCounted = nDnc;
// D1 no hand or AI column of the defence side in data.js
{ const RETIRED = new Set(['def', 'defOf', 'defPh', 'guard', 'shield', 'defPick', 'defCalc']);
  const RAW = T0.read(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'));
  const walk = (x, where) => { if(Array.isArray(x)) return x.forEach((y, i) => walk(y, where + '[' + i + ']')); if(!x || typeof x !== 'object') return;
    for(const [k, v] of Object.entries(x)){ if(RETIRED.has(k)) fail('D1', where, 'keeps the retired column ' + k); walk(v, where + '.' + k); } };
  for(const [name, key] of [['ARMIES', 'A'], ['DATASHEETS', 'S']]) walk(RAW[key] ? RAW[key].value : null, name);
  walk(D.factions, 'FACTIONS'); walk(D.coreStratagems, 'CORE_STRATAGEMS'); }

// ---- D4 completeness: a defence the patterns read, or words the DNC patterns name, is a box or not counted ----
{ let n = 0;
  for(const [key, src] of S){ const o = T[key] || {}, qs = (o.d || []).flatMap(b => [b.quote].concat((b.pick || []).map(p => p.quote))).map(q => E.norm(q)), ncs = (o.dnc || []).map(x => E.norm(x.quote));
    if(src.type === 'core' && src.wkw) continue;
    for(const u of X.unitsOf(src).concat((src.terms || []).flatMap(t => X.unitsOf({ type:'term', text:t.text })))){ const s = E.norm(u.s);
      if(/^\s*example:/.test(s) || /\bfast dice rolling\b/.test(s)) continue;
      const only = X.findDf(s.replace(/\(excluding psychic attacks\)/g, ' ')).df.filter(([id]) => E.DF[id].only);
      const ctx = X.DEFENCE.some(re => re.test(s)) || X.DEF_CTX.some(re => re.test(s));
      const said = only.length || (ctx && X.findDf(s).df.length) || Object.values(E.DNC).some(r => r.pats.some(re => re.test(s)));
      if(!said) continue; n++;
      if(!qs.some(q => q.includes(s.replace(/\s*\.\s*$/, ''))) && !ncs.includes(s)) fail('D4', key + ' ' + src.name, 'a defence or its words in “' + u.s.slice(0, 90) + '” is in no defence box and not listed as not counted'); } }
  stats.sentences = n; }

// ---- DC every condition GW's words put on a defence box is on it (verify/coverage.js: option, once per, if / while / unless, within N",
// the kind of attack), said or quoted ("If (see the rule)"), or its sentence is listed not counted ----
{ const Cv = require('./coverage'), CTX = { V:require('./derive').vocab(D), kws:D.armies.flatMap(a => a.units.map(u => u.kw || [])).concat(Object.values(D.datasheets || {}).map(x => x.kw || [])) }; let n = 0;
  for(const [key, o] of Object.entries(T)){ const src = S.get(key); if(!src) continue;
    for(const g of Cv.srcGaps(o, src)) fail('DC', key + ' ' + o.n, g);
    for(const b of o.d || []){ n++; for(const g of Cv.gaps(b, src, 'defence', src.others, CTX)) fail('DC', key + ' ' + o.n, g + ': “' + X.plainCase(b.quote).slice(0, 70) + '”'); } }
  stats.covered = n; stats.reachChecked = Cv.counts.checked; stats.reachUnchecked = Cv.counts.unchecked; }
// ---- D6 the code ----
{ const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  const fnSrc = name => { const m = new RegExp('\\n(?:function ' + name + '\\(|const ' + name + ' = )').exec(html); if(!m) return ''; const rest = html.slice(m.index + 1), e = rest.slice(1).search(/\n(?:function |const |let |\/\/ |\/\*)/); return rest.slice(0, e < 0 ? undefined : e + 1); };
  // (every function and constant of the defence side, its helpers' tables too: DEF_KIND, defWords, defBoxesOf …)
  const names = [...new Set(['defenceItems', 'defSources', 'defLineOf', 'defLine', 'defKindSaid', 'alwaysRiled', 'riledWhen'].concat([...html.matchAll(/\n(?:function |const )((?:def|DEF_)[A-Za-z_]\w*)\b/g)].map(m => m[1])))];
  for(const name of names){
    const c = fnSrc(name).replace(/\/\/[^\n]*/g, '');
    if(!c){ fail('D6', 'app.html', name + ' not found'); continue; }
    const r = /\.(?:def|defOf|defPh|guard|shield|defPick|defCalc|note|when|selfWhen)\b(?!\s*\()/.exec(c.replace(/\bx\.when\b|\bS\.s\.when\b/g, ''));
    if(r) fail('D6', 'app.html ' + name, 'reads a reading column: ' + r[0]);
    if(/\b(?:ab|r|s|S\.s|S\.ab)\.(?:text|effect|target)\b/.test(c)) fail('D6', 'app.html ' + name, 'reads a rule\'s words');
    const NUM = /'[^'\n]*(?:\d\+ ?(?:INV|InSv|invulnerable)|Feel No Pain|-1 (?:to|D|AP)|Lone Operative|Stealth)[^'\n]*'/i;
    if(NUM.test(c)) fail('D6', 'app.html ' + name, 'a defence written in the code: ' + NUM.exec(c)[0]); }
  if(/Riled up: 5\+ INV/.test(html)) fail('D6', 'app.html', 'the riled-up save written in the code'); }

// ---- D7 BOXES' defence side is what the words give ----
{ const pick = TT => JSON.stringify(Object.fromEntries(Object.keys(TT).sort().filter(k => TT[k].d || TT[k].dnc || TT[k].dreach).map(k => [k, { d:TT[k].d, dnc:TT[k].dnc, dreach:TT[k].dreach }])));
  if(pick(D.boxes || {}) !== pick(JSON.parse(JSON.stringify(T)))) fail('D7', 'data.js BOXES', 'its defence side is not what the words give (node verify/effects-migrate.js --write)'); }

// ---- D8 the labels ----
{ let n = 0; const u0 = { id:'x', name:'X', kw:[], models:['2× X'], stats:[{ W:'4', InSv:'–', Sv:'3+' }], abilities:[], rules:[], ranged:[], melee:[] };
  const dash = t => String(t).replace(/[−–]/g, '-');
  for(const [id, f] of Object.entries(E.DF)){
    for(const p of f.dom){ const l = dash(f.label(p));
      if(typeof p === 'number' && !new RegExp('(?:^|[^\\d])' + p + '(?![\\d])').test(l)) fail('D8', 'effects.js DF ' + id, 'its label for ' + p + ' is “' + l + '”'); else n++; }
    // (read back: its label's words give it again where they are a defence's words)
    const p = f.dom[0], x = A.defLineOf({ grp:'army', name:'R', a:'rule', v:'R', key:'r|x' }, { quote:'', df:[[id, p]], on:[], kind:'all' }, u0);
    if(!x || x.text !== f.label(p) || x.when) fail('D8', 'effects.js DF ' + id, 'a box of it alone says “' + (x && x.when + ': ' + x.text) + '”, not “' + f.label(p) + '”'); }
  const CV = { nearFriendly:[[{ d:3, kw:'orks walker', not:'big mek' }, '3" of a friendly ORKS WALKER unit (not BIG MEK)']], ledBy:[['cybernetica datasmith', 'CYBERNETICA DATASMITH']], itIs:[['vehicle', 'VEHICLE']] };
  for(const [id, c] of Object.entries(E.DCOND)){ const [p, want] = (CV[id] || [[true, null]])[0], l = c.label(p);
    if(want && !l.includes(want)) fail('D8', 'effects.js DCOND ' + id, 'its label for ' + JSON.stringify(p) + ' is “' + l + '”'); else n++;
    if(id === 'itIs') continue;   // (a keyword the unit lacks: no line)
    const x = A.defLineOf({ grp:'army', name:'R', a:'rule', v:'R', key:'r|x' }, { quote:'', df:[['fnp', 5]], on:[[id, p]], kind:'all' }, u0);
    if(!x || x.when !== l) fail('D8', 'effects.js DCOND ' + id, 'a box of it alone says “' + (x && x.when) + '”, not “' + l + '”'); }
  stats.labels = n; }

// ---- DL the lines as the screen has them ----
{ let n = 0, nc = 0; const BX = E.agreed(D.boxes, D.agree);
  const hasK = (u, k) => (u.kw || []).some(x => x.toLowerCase() === String(k).toLowerCase());
  const meets = (q, u) => !q || ((!q.all || q.all.every(k => hasK(u, k))) && (!q.any || !q.any.length || q.any.some(k => hasK(u, k))) && (!q.none || !q.none.some(k => hasK(u, k))) && (!q.unless || !meets(q.unless, u)));
  for(const a of D.armies) for(const u of a.units){
    const where = a.id + '/' + u.id, got = A.inArmy(a, () => A.defenceItems(u)), srcs = A.inArmy(a, () => A.defSources(u));
    const want = [];
    // (the boxes as the screen counts them, the two-reader rule: data.js AGREE, effects.js agreed; one it does not confirm is its source's
    // words not counted, a "see the rule" line)
    for(const Sx of srcs){ const o = BX[Sx.key] || {};
      for(const b of o.d || []){
        if(!b.pick && !(b.df || []).length) continue;
        if(b.foe ? false : Sx.reachOnly ? !(b.reach && meets(b.reach, u)) : b.reach ? !meets(b.reach, u) || (Sx.grp === 'unit' && b.notSelf) : Sx.grp === 'other') continue;
        if((b.on || []).some(([id, p]) => (id === 'selfKw' || id === 'itIs') && !hasK(u, p))) continue;
        want.push({ Sx, b }); }
      // (its words not counted: one line; another unit's are its own)
      if(Sx.grp !== 'other' && (o.dnc || []).length){ const ms = got.filter(x => x.ncLine && x.key === Sx.key);
        if(ms.length !== 1) fail('DL', where, Sx.name + ': words not counted, ' + ms.length + ' "see the rule" lines'); else if(ms[0].text !== 'not counted here: see the rule') fail('DL', where, Sx.name + ' says “' + ms[0].text + '”'); else nc++; } }
    for(const w of want){ const ms = got.filter(x => x.box === w.b && x.key === w.Sx.key);
      // (left out where the list printed it into the stats, marked from this rule; a Rules-line Feel No Pain its own words say)
      if(!ms.length){ const dfs = w.b.pick ? [] : w.b.df, baked = dfs.length && dfs.every(([id]) => ['inv', 'svSet', 't'].includes(id)) && (u.stats || []).some(r => r.from && Object.values(r.from).some(v => String(v).split(/\s*,\s*/).includes(w.Sx.name)));
        const rl = w.Sx.rl && /^feel no pain/i.test(w.Sx.rl);
        if(!baked && !rl) fail('DL', where, 'no line for the defence box of ' + w.Sx.name + ' “' + X.plainCase(w.b.quote).slice(0, 70) + '”'); continue; }
      if(ms.length > 1){ fail('DL', where, ms.length + ' lines for one box of ' + w.Sx.name); continue; }
      const m = ms[0]; n++;
      const sc = w.b.scope || {}, models = sc.models && sc.models !== 'model' ? sc.models + ' models: ' : '';
      const exp = models + (w.b.pick ? 'one of: ' + w.b.pick.map(p => E.dfLabel(p.df)).join(' · ') : E.dfLabel(w.b.df));
      const expT = exp + (w.b.until ? ' (' + w.b.until + ')' : '');
      if(m.text !== expT) fail('DL', where, w.Sx.name + ' says “' + m.text + '”, its box “' + expT + '”');
      const on = w.b.on || [], quoted = on.filter(([id]) => C[id] && C[id].quoted);
      if(on.length && quoted.length === on.length){ if(!/If \(see the rule\)$/.test(m.when)) fail('DL', where, w.Sx.name + ': only GW’s quoted words as its conditions, and it does not say “If (see the rule)”: “' + m.when + '”'); }
      else for(const [id, p] of on){ const l = E.DCOND[id] ? E.DCOND[id].label(p) : id === 'aura' || id === 'selected' || id === 'belowStarting' || id === 'belowHalf' ? null : E.COND[id].label(p);
        if(l && !m.when.includes(l)) fail('DL', where, w.Sx.name + ': its condition “' + l + '” is not said (“' + m.when + '”)'); }
      // (never wider than its rule: a stratagem's line names its phases, a ranged-only or melee-only box its kind)
      if(w.Sx.s && !m.when) fail('DL', where, w.Sx.name + ': a stratagem line with no phase');
      if((w.b.kind === 'ranged' || w.b.kind === 'melee') && !/[Rr]anged|[Mm]elee/.test(m.when + ' ' + m.text)) fail('DL', where, w.Sx.name + ': a ' + w.b.kind + '-only defence that does not say so'); }
    for(const m of got) if(!m.ncLine && !want.some(w => w.b === m.box && w.Sx.key === m.key)) fail('DL', where, 'the line of ' + m.name + ' “' + m.text + '” is no defence box the database gives this unit');
  }
  stats.lines = n; stats.ncLines = nc; }

fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive:true });
fs.writeFileSync(path.join(ROOT, 'verify/out/defence.json'), JSON.stringify({ stats, fails }, null, 1));
console.log('defence: ' + (fails.length ? fails.length + ' failure(s); ' : '') + stats.boxes + ' defence boxes and ' + stats.notCounted + ' sentences not counted, from GW\'s words (' + stats.sentences + ' sentences of the defence side, each a box or listed; ' + stats.covered + ' boxes with every condition of their words; ' + stats.reachChecked + ' reach boxes and models scopes checked against GW’s phrase, ' + stats.reachUnchecked + ' unchecked (said “If (see the rule)”)); ' + stats.labels + ' catalogue labels with their values; ' + stats.lines + ' "When targeted" lines of every list unit, each a box said in its labels, ' + stats.ncLines + ' "see the rule" lines');
for(const f of fails.slice(0, 60)) console.log('  FAIL ' + f);
process.exit(fails.length ? 1 : 0);
