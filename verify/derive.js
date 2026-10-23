// Labels derived from the rules text by fixed rules: the same text always gets the same label.
//
// data.js holds GW's words (checked word for word by verify/texts.js) and, on top of them, labels the app
// files things by: a stratagem's phases, turn and needs, a rule's or ability's phase tags, an ability's tag.
// Those labels were written by hand. This file derives each of them again from the item's own text
// (WHEN / TARGET / ability or rule text / ability name) with the rule tables below, and compares.
// Each derived label carries its reasons: the rule id and the words it matched.
//
//   node verify/derive.js            the gate: every item recorded as agreeing (verify/derive-agreed.json)
//                                     must still agree; prints how many differ or cannot be derived
//   node verify/derive.js --report   the same, saying where the report is: verify/out/derive.md and derive.json
//                                     (written on every run): every item, derived vs stored, grouped as
//                                     identical / different / not derivable
//   node verify/derive.js --agree    records the items that agree today (verify/derive-agreed.json)
//
// Only the item's text is read, never its name: no rule says "if the stratagem is X". Where no rule
// matches, the item is "not derivable" and nothing is guessed. A label the text cannot give (a judgement,
// such as a timing the rules leave open) shows as a difference or as not derivable, with any comment
// data.js has next to the item.
'use strict';
const fs = require('fs'), path = require('path');
const { ROOT, loadData, readJSON, writeJSON } = require('./lib');
const { appFunctions } = require('./helpers');

const PH = ['command', 'movement', 'shooting', 'charge', 'fight'];
const PHW = '(?:command|movement|shooting|charge|fight)';

// ---------------------------------------------------------------------------------------------
// Text: GW's markup is **bold** (keywords, terms) and ~~struck~~. Struck words are kept: Wahapedia strikes
// a keyword that does not appear in the faction (data.js's comment on Vox-howl), it does not delete them.
// ---------------------------------------------------------------------------------------------
const norm = s => String(s == null ? '' : s).replace(/~~/g, '').replace(/[’‘´`]/g, '\'').replace(/[“”]/g, '"')
  .replace(/[‐‑‒–—]/g, '-').replace(/ /g, ' ');
const plain = s => norm(s).replace(/\*\*/g, '').replace(/[ \t]+/g, ' ').trim();
// a line wholly in *italics* is a note under the rule (a Wahapedia FAQ or errata, a token reminder), not the rule
const NOTE_LINE = { id:'skip-note-line', re:/^\*(?!\*)[^\n]*\*$/gm, why:'a line in *italics* is a note under the rule (an FAQ, an errata, "Place a token…"), not its timing' };
const rulesText = s => norm(s).replace(NOTE_LINE.re, '');
const sentences = s => s.split(/\n+|(?<=[.!?])\s+(?=[A-Z(*-])/).map(x => x.trim()).filter(Boolean);
const clip = (s, n) => { s = String(s); return s.length > (n || 120) ? s.slice(0, n || 120) + '…' : s; };

// =============================================================================================
// RULE TABLE 1: timing (phases and whose turn) — stratagem WHEN, ability text, rule text
// =============================================================================================
// A phase named in the text: its owner word decides the turn.
const OWNER_RULES = [
  { id:'phase-opp',    re:/^your opponent's$/i,                       turn:'opp',    why:'"your opponent\'s X phase": only in the opponent\'s turn' },
  { id:'phase-your',   re:/^your( next)?$/i,                          turn:'your',   why:'"your X phase" / "your next X phase": only in your turn' },
  { id:'phase-either', re:/^(the( next)?|either player's|each|any)?$/i, turn:'either', why:'"the X phase", "either player\'s X phase" or a bare "X phase": both players\' turns' },
];
// "Your Movement/Charge phase", "Your Shooting phase or the Fight phase" (two names, each with its owner)
const PHASE_RE = new RegExp('(?:\\b(your opponent\'s|your next|your|the next|the|either player\'s|each|any) )?(' + PHW +
  '(?:(?:\\s*/\\s*|\\s*,\\s*|\\s+or\\s+|\\s+and\\s+)' + PHW + ')*) phases?\\b', 'gi');
// words that name a phase without saying when the item is used: cut out before looking for phases
const NOT_TIMING = [
  { id:'until',          re:new RegExp('\\buntil the (?:start|end) of (?:your opponent\'s |your next |your |the next |the |that )?(?:' + PHW + ' phase|turn|battle round|battle|phase)\\b', 'gi'), why:'a duration ("until the start of your next Command phase"), not when it is used' },
  { id:'once-per-phase', re:new RegExp('\\b(?:once|twice) per ' + PHW + ' phase\\b', 'gi'), why:'a limit ("once per Command phase"), not a timing' },
];
// moments that are not a phase
const MOMENT_RULES = [
  { id:'any-phase', re:/\b(?:(?:at the )?(?:start|end) of )?any phase\b/i, ph:Object.fromEntries(PH.map(p => [p, 'either'])),
    why:'"any phase" / "the start of any phase": every phase of both turns' },
  { id:'start-battle-round-first', re:/^(?:(?:once per battle|if your army faction is [^,]+), )?at the start of the first battle round\b/i, at:'Start of the first battle round', ph:{ command:'either' },
    why:'the text opens with "At the start of the first battle round": a moment before the first Command phase (07.01)' },
  { id:'start-battle-round', re:/^(?:(?:once per battle|if your army faction is [^,]+), )?at the start of the battle round\b/i, at:'Start of the battle round', ph:{ command:'either' },
    why:'the text opens with "At the start of the battle round": a moment before either player\'s Command phase (07.01)' },
  { id:'start-battle-round-later', re:/\b(?:at the )?start of the (?:first )?battle round\b/i, ph:{ command:'either' },
    why:'"the start of the battle round" later in the text: listed with the Command phase, no moment tag (the text does not open with it)' },
  { id:'end-opp-turn', re:/^at the end of your opponent's turn\b/i, at:'End of your opponent’s turn', ph:{ fight:'opp' },
    why:'"At the end of your opponent\'s turn": after their Fight phase, the last phase of the turn' },
];
// When the text names no phase and no moment, what the ability does says when it is used.
// (Tried sentence by sentence; every rule that matches adds its phases.)
const ACTIVITY_RULES = [
  { id:'damaged-band', re:/^while this model has \d+-\d+ wounds remaining\b/i, none:true,
    why:'a Damaged band ("While this model has 1-6 wounds remaining"): always on while damaged, no phase' },
  { id:'defensive', re:/\b(?:attacks? (?:that )?targets? (?:this|the bearer|that unit)|(?:is|are) allocated to (?:this|the bearer)|made against this|against (?:ranged|melee) attacks|invulnerable save|\binsv\b|save characteristic|saving throw|feel no pain|target of a ranged attack|targets this unit with)/i, none:true,
    why:'it protects the unit when it is attacked: shown as "When targeted", not in a phase' },
  { id:'lone-operative', re:/\bhas (?:the )?lone operative\b/i, none:true,
    why:'it gives Lone Operative (it cannot be targeted from far away): a protection, no phase' },
  { id:'pre-battle', re:/\bdeclare battle formations\b|\bafter both players have deployed\b|\bif this model is in your army\b|\btransport capacity\b/i, none:true,
    why:'before the battle (Declare Battle Formations, deployment, mustering) or what it can carry: no phase' },
  { id:'named-ability', named:true,
    why:'"when this model uses its X ability" / "as a result of the X detachment rule": that ability\'s or rule\'s timing (this table, on its text)' },
  { id:'named-core-stratagem', core:true,
    why:'it names a Core stratagem: that stratagem\'s phases and turn (from its WHEN, table 1)' },
  { id:'named-other-stratagem', re:/\bthe ((?:[A-Z][\w'-]*)(?: [A-Z][\w'-]*)*) stratagem\b/, blocker:true,
    why:'it names a stratagem this file has no WHEN for: not derivable' },
  { id:'any-stratagem', re:/\b(?:targets?|targeted|select)\b[^.]*\bwith an? stratagem\b|\btarget of an? stratagem\b|\btarget the bearer with an? stratagem\b/i, ph:Object.fromEntries(PH.map(p => [p, 'either'])),
    why:'"targeted with a Stratagem": stratagems are used in any phase of either turn' },
  { id:'ritual', re:/\britual|psychic test\b/i, ph:{ shooting:'your' },
    why:'Rituals are attempted at the start of your Shooting phase (the Cabal of Sorcerers army rule)' },
  { id:'melee-only-keyword', re:/\[(?:LANCE|EXTRA ATTACKS)\]|\bWS\b|\bweapon skill\b/i, ph:{ fight:'either' },
    why:'a melee-only weapon ability ([LANCE], [EXTRA ATTACKS]) or Weapon Skill: the Fight phase' },
  { id:'ranged-only-keyword', re:/\[(?:RAPID FIRE|HEAVY|ASSAULT|BLAST|TORRENT|INDIRECT FIRE|IGNORES COVER)[^\]]*\]|\bBS\b|\bballistic skill\b/i, ph:{ shooting:'your' },
    why:'a ranged-only weapon ability ([RAPID FIRE], [HEAVY], [ASSAULT], [IGNORES COVER]…) or Ballistic Skill: your Shooting phase' },
  { id:'weapons-have', re:/\b(?<!ranged |melee |psychic )weapons (?:equipped by [^.]*? )?have\b/i, ph:{ shooting:'your', fight:'either' },
    why:'"weapons … have" (ranged and melee alike): your Shooting phase and the Fight phase; not when the clause gives a ranged-only or melee-only weapon ability' },
  { id:'melee', re:/\bmelee (?:attacks?|weapons?)\b|\bselected to fight\b|\beligible to fight\b|\bfights first\b/i, ph:{ fight:'either' },
    why:'melee attacks / "selected to fight": the Fight phase of either turn' },
  { id:'ranged', re:/(?<!against |target of a |with )\branged (?:attacks?|weapons?)\b|\bselected to shoot\b|\beligible to shoot\b|\bhas shot\b/i, ph:{ shooting:'your' },
    why:'ranged attacks / "selected to shoot": your Shooting phase (Fire Overwatch, a stratagem, is not counted)' },
  { id:'any-attack', re:/\bmakes? an attack\b|\b(?:unit|model|bearer)'s attacks\b|\battacks made (?:with|by) (?:this|the bearer)|\bselected to shoot or fight\b/i, ph:{ shooting:'your', fight:'either' },
    why:'"makes an attack" (ranged or melee): your Shooting phase and the Fight phase' },
  { id:'charge-move', re:/\bcharge (?:rolls?|moves?)\b|\bends a charge\b|\bmakes a charge\b/i, ph:{ charge:'either' },
    why:'charge rolls / charge moves: the Charge phase (either turn: a Heroic Intervention is a charge move too)' },
  { id:'declare-charge', re:/\bdeclares? a charge\b|\beligible to declare a charge\b/i, ph:{ charge:'your' },
    why:'"declare a charge": your Charge phase' },
  { id:'move-enemy', re:/\benemy unit\b[^.]*\b(?:ends a (?:normal |advance |fall back )?move|(?:selected|chosen) to fall back|makes? a (?:normal|advance|fall back) move)\b/i, ph:{ movement:'opp' },
    why:'an enemy unit moving / Falling Back: your opponent\'s Movement phase' },
  { id:'move-own', re:/\b(?:normal|advance|fall[- ]back|pulse jet|ingress) moves?\b|\badvance (?:and charge )?rolls?\b|\bselected to (?:move|advance)\b|\bmove characteristic\b|\b(?:advanced|fell back|falls back|remains stationary)\b|\+\d+" m\b/i, ph:{ movement:'your' },
    why:'its own moves (Normal, Advance, Fall Back), advance rolls, its Move characteristic: your Movement phase' },
];
// "If this unit made a charge move this turn": only the Fight phase follows the Charge phase in that turn
const AFTER_CHARGE = { id:'after-charge', re:/\bmade a charge move this turn\b/i,
  why:'"made a charge move this turn": a condition, not a move; only the Fight phase is left in that turn' };

const addPh = (out, p, t) => { out[p] = out[p] && out[p] !== t ? 'either' : t; };

// phases named in the text (table 1, explicit part); null when it names none
function explicitTiming(text, opts){
  let t = plain(rulesText(text));
  const reasons = [], out = {};
  let at;
  for(const r of MOMENT_RULES){
    const m = r.re.exec(t);
    if(!m) continue;
    if(r.id === 'start-battle-round-later' && at) continue;      // already the opening moment
    if(r.id === 'start-battle-round' && at) continue;
    if(r.at) at = r.at;
    for(const [p, o] of Object.entries(r.ph)) addPh(out, p, o);
    reasons.push({ rule:r.id, match:m[0] });
    if(r.id === 'any-phase') t = t.replace(r.re, ' ');
  }
  if(!(opts && opts.keepDurations)) for(const r of NOT_TIMING) t = t.replace(r.re, m => { reasons.push({ rule:'skip-' + r.id, match:m }); return ' '; });
  t = t.replace(/\bstart of the (?:first )?battle round\b/gi, ' ');
  PHASE_RE.lastIndex = 0;
  for(let m; (m = PHASE_RE.exec(t));){
    const own = OWNER_RULES.find(o => o.re.test(m[1] || ''));
    for(const p of m[2].toLowerCase().split(/\s*\/\s*|\s*,\s*|\s+or\s+|\s+and\s+/)) addPh(out, p, own.turn);
    reasons.push({ rule:own.id, match:m[0] });
  }
  return Object.keys(out).length ? { ph:out, at, reasons } : null;
}

// table 1 in full: explicit phases first; if none, the activities
function timing(text, ctx){
  const ex = explicitTiming(text);
  if(ex) return Object.assign({ how:'explicit' }, ex);
  let t = plain(rulesText(text));
  const reasons = [], out = {};
  let none = null, blocked = null;
  const afterCharge = AFTER_CHARGE.re.exec(t);
  if(afterCharge) t = t.replace(AFTER_CHARGE.re, ' ');                  // a condition: no charge-move rule on it
  for(const sent of sentences(t)){
    // a sentence about the unit being attacked (or a Damaged band) says nothing about when the unit acts
    const quiet = ACTIVITY_RULES.filter(r => r.none).map(r => [r, r.re.exec(sent)]).find(x => x[1]);
    if(quiet){ none = none || { rule:quiet[0].id, match:quiet[1][0] }; continue; }
    // clause by clause ("weapons … have [LETHAL HITS], and melee weapons … have [LANCE]")
    for(const s of sent.split(/,\s+and\s+|;\s+/)){
    const kwOnly = ACTIVITY_RULES.filter(r => /-only-keyword$/.test(r.id)).some(r => r.re.test(s));
    for(const r of ACTIVITY_RULES){
      if(r.id === 'weapons-have' && kwOnly) continue;   // "Snazzgun weapons have [RAPID FIRE 1]": the keyword says which weapons
      if(r.named){
        const m = /\b(?:uses its|as a result of the) ([A-Z][^,.]*?)(?: ability| detachment rule)\b/.exec(s);
        const other = m && ctx && ctx.named && ctx.named(m[1]);
        if(other){
          const w = timing(other, { core:ctx.core });
          if(w.ph && Object.keys(w.ph).length){ for(const [p, o] of Object.entries(w.ph)) addPh(out, p, o); reasons.push({ rule:r.id, match:m[0] + ' → ' + w.reasons.map(x => x.match).join(', ') }); }
        }
        continue;
      }
      if(r.core){
        for(const cs of (ctx && ctx.core) || []){
          const m = new RegExp('\\b' + cs.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b[^.]*\\bstratagem\\b', 'i').exec(s);
          if(!m) continue;
          const w = explicitTiming(cs.when.split(/[.:]/)[0]);
          if(w) { for(const [p, o] of Object.entries(w.ph)) addPh(out, p, o); reasons.push({ rule:r.id, match:cs.name + ' → ' + w.reasons.map(x => x.match).join(', ') }); }
        }
        continue;
      }
      const m = r.re.exec(s);
      if(!m) continue;
      if(r.blocker){ if(!((ctx && ctx.core) || []).some(cs => cs.name.toLowerCase() === m[1].toLowerCase())) blocked = { rule:r.id, match:m[0] }; continue; }
      if(r.id === 'any-stratagem' && reasons.some(x => x.rule === 'named-core-stratagem')) continue;
      if(r.id === 'move-own' && /\benemy unit\b/i.test(s) && ACTIVITY_RULES.find(x => x.id === 'move-enemy').re.test(s)) continue;
      for(const [p, o] of Object.entries(r.ph)){
        if(afterCharge && p === 'shooting' && (r.id === 'any-attack')) continue;
        addPh(out, p, o);
      }
      reasons.push({ rule:r.id, match:m[0] });
    }
    }
  }
  if(afterCharge && reasons.some(r => r.rule === 'any-attack')) reasons.push({ rule:AFTER_CHARGE.id, match:afterCharge[0] });
  if(Object.keys(out).length) return { how:'activity', ph:out, reasons };
  if(blocked) return { how:'none', blocked:true, reasons:[blocked] };
  if(none) return { how:'activity', ph:{}, reasons:[none] };          // positively: no phase
  return { how:'none', reasons:[] };
}

// the stored label as a phase → turn map (the app's phasesOf / phTurn)
const storedMap = x => Object.fromEntries((x.phases || x.ph || []).map(p => [p, (x.turns && x.turns[p]) || x.turn || 'either']));
// a phase → turn map in data.js's form: phases in order, turn the most common value, turns the others
function asLabel(map, at){
  const ph = PH.filter(p => map[p]);
  if(!ph.length) return at ? { at } : {};
  const count = {}; for(const p of ph) count[map[p]] = (count[map[p]] || 0) + 1;
  const turn = Object.keys(count).sort((a, b) => count[b] - count[a] || (a === 'either' ? -1 : b === 'either' ? 1 : 0))[0];
  const turns = Object.fromEntries(ph.filter(p => map[p] !== turn).map(p => [p, map[p]]));
  return Object.assign(at ? { at } : {}, { ph, turn }, Object.keys(turns).length ? { turns } : {});
}
const mapKey = (m, at) => (at || '') + '|' + PH.filter(p => m[p]).map(p => p + ':' + m[p]).join(',');

// =============================================================================================
// RULE TABLE 2: needs (which units) — stratagem TARGET (and WHEN for "That … unit"), rule text
// =============================================================================================
const NEEDS_RULES = {
  'kw-all':        'keywords in one bold run ("ORKS WALKER"): the unit has every one',
  'kw-slash':      'keywords joined by "/" ("MONSTER/VEHICLE", "ORKS MOUNTED/VEHICLE"): the unit has one of them',
  'kw-or':         'runs joined by "or" / "," ("BLOOD LEGIONS or WORLD EATERS"): the unit has one of them',
  'kw-or-common':  'alternatives sharing keywords ("TZEENTCH MUTANT INFANTRY or TZEENTCH MUTANT MOUNTED"): the shared ones all, the rest any',
  'kw-or-faction': 'alternatives where only some name the army\'s Faction keyword ("LEGIO CYBERNETICA or ADEPTUS MECHANICUS VEHICLE"): the Faction keyword applies to all (every unit of the army has it)',
  'excluding':     '"(excluding X units)" after the unit: the unit has none of them',
  'cannot':        '"that cannot X" in the unit\'s clause: the unit lacks X',
  'only-select-if':'"You can only select a X unit if it is a Y/Z unit": a X unit qualifies only with Y or Z (needs.unless)',
  'attached':      '"attached" in WHEN/TARGET: a unit with a leader or support character (needs.attached)',
  'with-ability':  '"with the X ability" in the unit\'s clause: the unit\'s Rules line names X (needs.rule)',
  'with-this-ability':'a rule for "a model with this ability" and no keyword: the units whose Rules line names this rule (needs.rule)',
  'that-unit':     'TARGET "That … unit": the unit WHEN names (its keywords and exclusions) and TARGET\'s keywords',
  'first-unit':    'stratagems: the first unit TARGET names; rules: the first friendly / "from your army" unit the text names with a keyword. Later units (a unit it is near, an enemy) are not who it is for',
  'no-keyword':    'the unit named has no keyword: any unit (no needs)',
};

function vocab(D){
  const v = new Map();
  for(const a of D.armies) for(const u of a.units) for(const k of u.kw){
    const name = norm(k).replace(/^Faction: /, '').toLowerCase();
    if(/^Faction: /.test(k) || !v.has(name)) v.set(name, k);
  }
  for(const f of Object.values(D.factions)){ const n = norm(f.name).toLowerCase(); if(!v.has(n)) v.set(n, 'Faction: ' + norm(f.name)); }
  return v;
}
const isUpperWord = w => /[A-Z]/.test(w) && w === w.toUpperCase();
const titleCase = s => s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
// "THOUSAND SONS PSYKER" → ['Faction: Thousand Sons', 'Psyker'] (longest known keyword first; unknown words in a row are one keyword)
function tokens(V, s){
  const w = s.trim().split(/\s+/).filter(Boolean), out = [];
  let unknown = [];
  const flush = () => { if(unknown.length){ out.push(titleCase(unknown.join(' '))); unknown = []; } };
  for(let i = 0; i < w.length;){
    let hit = null;
    for(let n = Math.min(6, w.length - i); n >= 1 && !hit; n--){
      const k = w.slice(i, i + n).join(' ').toLowerCase();
      if(V.has(k)) hit = { k:V.get(k), n };
      else if(/s$/.test(k) && V.has(k.slice(0, -1))) hit = { k:V.get(k.slice(0, -1)), n };   // MONSTERS → Monster
    }
    if(hit){ flush(); out.push(hit.k); i += hit.n; } else { unknown.push(w[i]); i++; }
  }
  flush();
  return out;
}
// one alternative: "INFANTRY/MOUNTED THOUSAND SONS PSYKER" → { all:[TS, Psyker], any:[Infantry, Mounted] }
function parseAlt(V, s){
  const parts = s.split(/\s*\/\s*/).map(p => tokens(V, p));
  const groups = [];
  parts.forEach((ts, i) => {
    if(i && groups.length && ts.length){
      const last = groups.pop(), first = ts.shift();
      groups.push([].concat(last, first));
    }
    for(const t of ts) groups.push(t);
  });
  const all = groups.filter(g => typeof g === 'string'), anys = groups.filter(g => Array.isArray(g));
  return { all, any:anys.length === 1 ? anys[0] : anys.length ? null : [], slash:anys.length > 0, multiAny:anys.length > 1 };
}
// a keyword run: "**BLOOD LEGIONS** or **WORLD EATERS**" → needs, with the rule ids used
function parseRun(V, run){
  const r = run.replace(/\*\*/g, '').trim();
  const alts = r.split(/\s*,\s*(?:or\s+)?|\s+or\s+/).filter(Boolean).map(a => parseAlt(V, a));
  const rules = new Set();
  if(alts.some(a => a.multiAny)) return { bad:'two "/" groups in one run', rules:['kw-slash'] };
  if(alts.some(a => a.slash)) rules.add('kw-slash');
  if(alts.length === 1) { if(alts[0].all.length) rules.add('kw-all'); return { all:alts[0].all, any:alts[0].any, rules:[...rules] }; }
  if(alts.some(a => a.any.length)) return { bad:'"or" between runs that use "/"', rules:['kw-or'] };
  rules.add('kw-or');
  let sets = alts.map(a => a.all);
  if(sets.every(x => x.length === 1)) return { all:[], any:sets.map(x => x[0]), rules:[...rules] };
  const common = sets[0].filter(k => sets.every(x => x.includes(k)));
  let rest = sets.map(x => x.filter(k => !common.includes(k)));
  if(common.length && rest.every(x => x.length === 1)){ rules.add('kw-or-common'); return { all:common, any:rest.map(x => x[0]), rules:[...rules] }; }
  const fac = [...new Set(sets.flat().filter(k => /^Faction: /.test(k)))];
  if(fac.length === 1){
    rest = rest.map(x => x.filter(k => k !== fac[0]));
    if(rest.every(x => x.length === 1)){ rules.add('kw-or-faction'); return { all:common.concat(fac.filter(f => !common.includes(f))), any:rest.map(x => x[0]), rules:[...rules] }; }
  }
  return { bad:'"or" between runs of several keywords', rules:[...rules] };
}
// bold segments that are terms, not keywords ("**unengaged**", "**selected to fight**") lose their bold; a lowercase word
// inside a keyword's bold ("**attached ORKS INFANTRY**") moves out of it; "**A**/**B**" is one run "**A/B**"
function prepBold(s){
  s = norm(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, (m, inner) => {
    const w = inner.split(/(\s+)/);
    if(!w.some(x => isUpperWord(x))) return inner;
    const lead = [], body = [];
    let i = 0;
    while(i < w.length && !isUpperWord(w[i])) lead.push(w[i++]);
    for(; i < w.length; i++) body.push(w[i]);
    return lead.join('') + '**' + body.join('').trim() + '**';
  });
  return s.replace(/\*\*\s*\/\s*\*\*/g, '/');
}
const RUN = '(\\*\\*[^*]+\\*\\*(?:(?:\\s*/\\s*|,\\s*|\\s+or\\s+|\\s+and\\s+)\\*\\*[^*]+\\*\\*)*)';
// keywords in "(excluding **AIRCRAFT**/**TITANIC** models)": every one of them excluded
const excluded = (V, inner) => [...prepBold(inner).matchAll(/\*\*([^*]+)\*\*/g)].flatMap(m => m[1].split(/\s*\/\s*|\s*,\s*|\s+or\s+|\s+and\s+/).flatMap(x => tokens(V, x)));

// the first friendly unit a text names: its keyword run, and the clause right after it
function friendlyUnit(V, text, opts){
  const s = prepBold(text);
  const re = new RegExp('(?:' + RUN + '\\s+)?\\b(units?|models?)\\b', 'g');
  for(let m; (m = re.exec(s));){
    const before = s.slice(Math.max(0, m.index - 40), m.index), after = s.slice(m.index + m[0].length);
    if(/\benemy\s*$|\benemy (?:\w+ )?$/i.test(before)) continue;
    const friendly = /\bfriendly\s+(?:\w+\s+)?$/i.test(before) || /^'?\s*(?:\([^)]*\)\s*)?from your army\b/i.test(after) || /^\s*'?\s*\([^)]*\)\s*from your army/i.test(after);
    if(!friendly && !(opts && opts.any)) continue;
    if(opts && opts.keyword && !m[1]) continue;
    return { run:m[1] || '', noun:m[2], at:m.index, after, matched:m[0] };
  }
  return null;
}
// needs from one unit phrase and its clause
function needsOf(V, unit, reasons){
  const n = { all:[], any:[], none:[] };
  if(unit.run){
    const p = parseRun(V, unit.run);
    if(p.bad) return { bad:p.bad + ': ' + unit.run.replace(/\*\*/g, '') };
    n.all.push(...p.all); n.any.push(...p.any);
    reasons.push({ rule:p.rules.join('+') || 'kw-all', match:unit.matched.replace(/\*\*/g, '') });
  } else reasons.push({ rule:'no-keyword', match:unit.matched });
  // the clause after the unit, up to the end of its sentence
  const clause = unit.after.split(/[.;]/)[0];
  const ex = /^\s*(?:from your army\s*)?\(excluding ([^)]*)\)/i.exec(unit.after) || /^[^(]{0,60}?\(excluding ([^)]*)\)/i.exec(clause);
  if(ex){ n.none.push(...excluded(V, ex[1])); reasons.push({ rule:'excluding', match:ex[0].trim().replace(/\*\*/g, '') }); }
  const cannot = /\bthat cannot \*\*([^*]+)\*\*/i.exec(clause);
  if(cannot){ n.none.push(...tokens(V, cannot[1])); reasons.push({ rule:'cannot', match:cannot[0].replace(/\*\*/g, '') }); }
  const withAb = /^\s*(?:from your army\s*)?with the \*\*([^*]+)\*\* ability/i.exec(unit.after);
  if(withAb){ n.rule = [withAb[1]]; reasons.push({ rule:'with-ability', match:withAb[0].trim().replace(/\*\*/g, '') }); }
  return n;
}
function mergeNeeds(a, b){
  const u = (x, y) => [...new Set([].concat(x || [], y || []))];
  const out = { all:u(a.all, b.all), any:(b.any && b.any.length ? b.any : a.any) || [], none:u(a.none, b.none) };
  if(a.rule || b.rule) out.rule = u(a.rule, b.rule);
  return out;
}

function stratNeeds(V, s){
  const reasons = [];
  const target = norm(s.target), when = norm(s.when).split(/\n/)[0];
  const first = target.split(/(?<=\.)\s+/)[0];
  let unit = friendlyUnit(V, first, { any:true });
  if(!unit) return { how:'none', reasons:[{ rule:'no-unit', match:clip(plain(first)) }] };
  reasons.push({ rule:'first-unit', match:plain(first.slice(0, unit.at + unit.matched.length)) });
  let n = needsOf(V, unit, reasons);
  if(n.bad) return { how:'none', reasons:[{ rule:'unparsed', match:n.bad }] };
  if(/^that\b/i.test(plain(first))){
    const w = friendlyUnit(V, when);
    if(w){
      const wr = [];
      const wn = needsOf(V, w, wr);
      if(!wn.bad){ n = mergeNeeds(n, wn); reasons.push({ rule:'that-unit', match:'WHEN: ' + plain(w.matched) }, ...wr.filter(r => r.rule !== 'no-keyword')); }
    }
  }
  const only = /you can only select an? \*\*([^*]+)\*\* unit if it is an? \*\*([^*]+)\*\* unit/i.exec(prepBold(target));
  if(only){
    n.unless = { all:tokens(V, only[1]), none:only[2].split(/\s*\/\s*/).flatMap(x => tokens(V, x)) };
    reasons.push({ rule:'only-select-if', match:plain(only[0]) });
  }
  if(/\battached\b/i.test(plain(s.when + ' ' + s.target))){ n.attached = true; reasons.push({ rule:'attached', match:(/[^.]*\battached\b[^.]*/i.exec(plain(s.when + ' ' + s.target)) || [''])[0].trim().slice(0, 80) }); }
  return { how:'explicit', needs:n, reasons };
}
function ruleNeeds(V, r){
  const reasons = [];
  const unit = friendlyUnit(V, rulesText(r.text), { keyword:true });
  if(unit){
    reasons.push({ rule:'first-unit', match:clip(plain(unit.matched), 80) });
    const n = needsOf(V, unit, reasons);
    if(n.bad) return { how:'none', reasons:[{ rule:'unparsed', match:n.bad }] };
    if(/\battached\b/i.test(plain(r.text))) { n.attached = true; reasons.push({ rule:'attached', match:'attached' }); }
    return { how:'explicit', needs:n, reasons };
  }
  const m = /\b(?:a model|models|units?) (?:from your army )?with this ability\b/i.exec(plain(r.text));
  if(m) return { how:'explicit', needs:{ rule:[r.name] }, reasons:[{ rule:'with-this-ability', match:m[0] }] };
  return { how:'none', reasons:[] };
}
// needs in one form for comparing: a one-keyword "any" is "all"; empty lists dropped; sorted
function canonNeeds(n){
  if(!n) return {};
  const o = {};
  const all = [...(n.all || [])], any = [...(n.any || [])];
  if(any.length === 1) all.push(any.shift());
  if(all.length) o.all = [...new Set(all)].sort();
  if(any.length) o.any = [...new Set(any)].sort();
  if(n.none && n.none.length) o.none = [...new Set(n.none)].sort();
  if(n.unless){ const u = canonNeeds(n.unless); if(Object.keys(u).length) o.unless = u; }
  if(n.rule && n.rule.length) o.rule = [...n.rule].map(norm).sort();
  if(n.attached) o.attached = true;
  return o;
}
const tidyNeeds = n => { const o = {}; for(const k of ['all', 'any', 'none', 'unless', 'rule', 'attached']) if(n && n[k] !== undefined && !(Array.isArray(n[k]) && !n[k].length)) o[k] = n[k]; return o; };

// =============================================================================================
// RULE TABLE 3: ability tags (the words shown beside the name: Aura, Enhancement, Once per battle…)
// =============================================================================================
const TAG_RULES = [
  { id:'tag-enhancement', why:'the ability is named as an enhancement of the list\'s detachments: "Enhancement" ("Upgrade" when that entry is an upgrade)' },
  { id:'tag-aura-name', name:/\(Aura\)/i, give:'Aura', why:'the ability\'s name says "(Aura)"' },
  { id:'tag-aura', re:/\b(?:friendly|enemy)\b[^.]*?\b(?:units?|models?)(?: \([^)]*\))? (?:is |are )?(?:wholly )?within (?:\d+"|engagement range) of (?:this|the bearer|one or more units with this ability)\b|\bunits? from their army within \d+" of this\b/i, give:'Aura', sentence:true,
    why:'it affects other units (friendly or enemy) while they are within a distance of this model ("While a friendly X unit is within 6" of this model", "an enemy unit within 6" of this model"); not a unit it selects, not a unit that "ends a move within"' },
  { id:'tag-bondsman', re:/^while a model is affected by this ability\b/i, give:'Bondsman',
    why:'"While a model is affected by this ability": the wording of a Bondsman ability (the Bondsman army rule: "affected by that Bondsman ability")' },
  { id:'tag-capacity', re:/\btransport capacity of \d+/i, give:'Capacity', why:'"has a transport capacity of N": the Transport ability' },
  { id:'tag-once', re:/^\((once per [^)]+)\)|^(?:\*\*[^*]+\*\* (?:model|unit) only(?: \([^)]*\))?\. )?\((once per [^)]+)\)|^(once per (?:battle round|battle|turn|phase)(?:, per (?:army|unit))?)[,.]/i, once:true,
    why:'the text opens with "(Once per …)" or "Once per …,": that limit (the app\'s onceTag reads the same words from the text, so the row shows it either way)' },
];
// a stored tag in parts: "Once per turn, twice per battle, per unit" is one part; "Aura, Psychic" two
function tagParts(tag){
  const out = [];
  let t = String(tag || '');
  const once = /^(?:once|twice) per [a-z ]+(?:, (?:once|twice) per [a-z ]+)?(?:, per (?:army|unit))?/i.exec(t);
  if(once){ out.push(once[0]); t = t.slice(once[0].length).replace(/^,\s*/, ''); }
  for(const p of t.split(/\s*,\s*/)) if(p) out.push(p);
  return out;
}
const DERIVABLE_TAG = p => /^(Aura|Enhancement|Upgrade|Bondsman|Capacity)$/.test(p) || /^(once|twice) per /i.test(p);
function abilityTag(ab, ctx){
  const reasons = [], parts = [];
  const en = (ctx.enh || []).find(e => e.name === ab.name);
  if(en){ parts.push(en.upgrade ? 'Upgrade' : 'Enhancement'); reasons.push({ rule:'tag-enhancement', match:(en.upgrade ? 'upgrade ' : 'enhancement ') + en.name }); }
  const t = plain(ab.text);
  for(const r of TAG_RULES.slice(1)){
    let m = r.name ? r.name.exec(ab.name) : r.sentence ? null : r.re.exec(t);
    // (an aura: in one sentence, and not a unit the ability selects: "select one friendly ORKS unit within 6"")
    if(r.sentence) for(const x of sentences(t)){ const y = r.re.exec(x); if(y && !/\bselect/i.test(x.slice(0, y.index + y[0].length))){ m = y; break; } }
    if(m && parts.includes(r.give)) continue;
    if(!m) continue;
    if(r.once){ const o = (m[1] || m[2] || m[3]); parts.push(o[0].toUpperCase() + o.slice(1)); }
    else parts.push(r.give);
    reasons.push({ rule:r.id, match:clip(m[0], 90) });
  }
  return { parts, reasons };
}

// =============================================================================================
// RULE TABLE 4 (coverage only, not compared as labels): aura reach and the Damage tab's bonuses
// =============================================================================================
const REACH_RE = /\bwithin (\d+)" of (?:this|the bearer)\b/i;
// each: the words in the ability's text (matched on plain text) → the bonus; and how a footnote's note says it
const BONUS_RULES = [
  { id:'hit+1',      re:/\+1 to (?:the )?hit rolls?|add 1 to the hit roll/i,                                note:/\+1 to hit/i },
  { id:'wound+1',    re:/\+1 to (?:the )?wound rolls?|add 1 to the wound roll/i,                            note:/\+1 to wound/i },
  { id:'rr-hit-1',   re:/re-roll (?:a )?hit rolls? of 1/i,                                                  note:/re-roll[^.;]*?\bhit rolls? of 1|re-roll hit and wound rolls of 1/i },
  { id:'rr-wound-1', re:/re-roll (?:a )?wound rolls? of 1/i,                                                note:/re-roll[^.;]*?\bwound rolls? of 1/i },
  { id:'rr-hit',     re:/re-roll (?:a |the |one )?hit rolls?\b(?! of 1)/i,                                  note:/re-roll[^.;]*?\bhit rolls?\b(?! of 1)(?! and wound rolls of 1)/i },
  { id:'rr-wound',   re:/re-roll[^.;]*?\bwound rolls?\b(?! of 1)/i,                                          note:/re-roll[^.;]*?\bwound rolls?\b(?! of 1)/i },
  { id:'lethal',     re:/\[LETHAL HITS\]/i,                                                                  note:/LETHAL HITS/i },
  { id:'sustained',  re:/\[SUSTAINED HITS [^\]]+\]/i,                                                        note:/SUSTAINED HITS/i },
  { id:'devwounds',  re:/\[DEVASTATING WOUNDS\]/i,                                                           note:/DEVASTATING WOUNDS/i },
  { id:'ignores-cover', re:/\[?IGNORES COVER\]?/i,                                                           note:/IGNORES COVER/i },
  { id:'lance',      re:/\[LANCE\]/i,                                                                        note:/LANCE/i },
  { id:'ap+1',       re:/\+\d+ AP\b|improve the armour penetration characteristic/i,                         note:/\+\d+ AP|improve AP|AP improved/i },
  { id:'a+',         re:/\+\d+ A\b|add (?:\d+|D3) to the attacks(?: and [a-z]+)*(?:,? [a-z]+)* characteristics?|improve the attacks characteristic/i, note:/\+(?:\d+|D3) A\b|"A":"\+|attacks? \+\d/i },
  { id:'s+',         re:/\+\d+ S\b|add (?:\d+|D3) to the (?:attacks,? )?(?:and )?strength(?: and [a-z]+)* characteristics?|add \d+ to the strength/i, note:/\+(?:\d+|D3) S\b|"S":"\+/i },
  { id:'d+',         re:/\+\d+ D\b|improve the damage characteristic of that attack by|add \d+ to the (?:[a-z]+,? )*(?:and )?damage characteristics?/i, note:/\+\d+ D\b|"D":"\+/i },
  { id:'hit-1',      re:/this model makes an attack, subtract 1 from the hit roll/i,                        note:/-1 to hit/i },
];
// what protects the unit: the ability's text vs its "When targeted" line (ab.def)
const DEF_RULES = [
  { id:'fnp',        re:/feel no pain (\d)\+|feel no pain\*?\*? (\d)\+/i,                                   note:/feel no pain|FNP/i },
  { id:'invuln',     re:/(\d)\+ (?:invulnerable save|insv)/i,                                                note:/invulnerable save|InSv/i },
  { id:'dmg-1',      re:/subtract 1 from the damage characteristic/i,                                        note:/-1 D\b|-1 Damage/i },
  { id:'dmg-0',      re:/change the damage characteristic of that attack to 0/i,                             note:/Damage[^.]* to 0/i },
  { id:'ap-worse',   re:/-1 AP\b|worsen the armour penetration/i,                                            note:/-1 AP|worsen the AP/i },
  { id:'hit-1',      re:/\b(?:an attack targets|attacks that target) (?:this|the bearer|that unit|it)\b[^.]*?(?:subtract 1 from the hit roll|-1 to hit rolls)/i, note:/-1 to hit/i },
  { id:'wound-1',    re:/\b(?:an attack targets|attacks that target) (?:this|the bearer|that unit|it)\b[^.]*?(?:subtract 1 from the wound roll|-1 to wound rolls)/i, note:/-1 to wound/i },
];

// =============================================================================================
// the items: every label in data.js this file derives
// =============================================================================================
function commentsNear(src, name){
  const out = [];
  const esc = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, '\\\\?\'');
  const re = new RegExp('name:\\s*\'' + esc + '\'');
  const lines = src.split('\n');
  const i = lines.findIndex(l => re.test(l));
  if(i < 0) return out;
  const inl = /\/\/(.*)$/.exec(lines[i].replace(/'(?:[^'\\]|\\.)*'/g, '\'\''));
  if(inl) out.push(inl[1].trim());
  const above = [];
  for(let j = i - 1; j >= 0 && /^\s*\/\//.test(lines[j]); j--) above.unshift(lines[j].replace(/^\s*\/\/\s?/, ''));
  if(above.length) out.unshift(above.join(' '));
  return out;
}

function derive(D){
  const V = vocab(D);
  const src = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  // the app's own matches(), so "selects the same units" means what the app does
  const matches = new Function('hasKw', appFunctions(html).matches + '\nreturn matches;')((u, k) => u.kw.some(x => norm(x).toLowerCase() === norm(k).toLowerCase()));
  const ctx = { core:D.coreStratagems };
  const items = [];
  const add = it => items.push(it);
  const unitsOf = fk => D.armies.filter(a => !fk || a.faction === fk).flatMap(a => a.units.map(u => ({ a, u })));
  const selDiff = (fk, n1, n2) => unitsOf(fk).filter(({ u }) => matches(n1 && Object.keys(n1).length ? n1 : null, u) !== matches(n2 && Object.keys(n2).length ? n2 : null, u)).map(({ a, u }) => a.id + '/' + u.name);

  const timingItem = (kind, where, x, text, extra, tctx) => {
    const d = timing(text, tctx || ctx), sm = storedMap(x), sAt = x.at;
    const stored = Object.assign(x.at ? { at:x.at } : {}, (x.phases || x.ph) ? { ph:x.phases || x.ph, turn:x.turn } : {}, x.turns ? { turns:x.turns } : {});
    let status;
    if(d.how === 'none') status = 'not-derivable';
    else status = mapKey(sm, sAt) === mapKey(d.ph, d.at) ? 'identical' : 'different';
    add(Object.assign({ kind, where, stored, derived:d.how === 'none' ? null : asLabel(d.ph, d.at), how:d.how, status, reasons:d.reasons, text }, extra));
  };

  // stratagems: core and every detachment's
  const strats = [].concat(D.coreStratagems.map(s => ({ s, where:'Core · ' + s.name, fk:null })),
    ...Object.entries(D.factions).flatMap(([fk, f]) => Object.entries(f.detachments).flatMap(([dk, d]) => (d.stratagems || []).map(s => ({ s, where:f.name + ' · ' + d.name + ' · ' + s.name, fk })))));
  for(const { s, where, fk } of strats){
    const when1 = s.when.split(/[.:]/)[0];
    const ex = explicitTiming(when1, { keepDurations:true });
    const sm = storedMap(s);
    const comments = commentsNear(src, s.name);
    add({ kind:'strat-timing', where, stored:Object.assign({ ph:s.phases, turn:s.turn }, s.turns ? { turns:s.turns } : {}), derived:ex ? asLabel(ex.ph) : null, how:ex ? 'explicit' : 'none',
      status:!ex ? 'not-derivable' : mapKey(sm) === mapKey(ex.ph) ? 'identical' : 'different', reasons:ex ? ex.reasons : [], text:'WHEN: ' + s.when, comments });
    const dn = stratNeeds(V, s);
    const st = canonNeeds(s.needs), dv = dn.needs ? canonNeeds(dn.needs) : null;
    const status = !dv ? 'not-derivable' : JSON.stringify(st) === JSON.stringify(dv) ? 'identical' : 'different';
    add({ kind:'strat-needs', where, stored:s.needs || null, derived:dn.needs ? tidyNeeds(dn.needs) : null, how:dn.how, status, reasons:dn.reasons,
      text:'TARGET: ' + s.target + '\nWHEN: ' + s.when, comments, selects:status === 'different' ? selDiff(fk, s.needs, tidyNeeds(dn.needs)) : undefined });
  }
  // army rules and detachment rules
  for(const [fk, f] of Object.entries(D.factions)){
    const rules = f.armyRules.map(r => ({ r, where:f.name + ' army rule · ' + r.name, det:false }))
      .concat(Object.values(f.detachments).filter(d => d.rule).map(d => ({ r:d.rule, where:f.name + ' · ' + d.name + ' rule · ' + d.rule.name, det:true })));
    for(const { r, where, det } of rules){
      const comments = commentsNear(src, r.name);
      timingItem('rule-timing', where, r, r.text, { comments });
      if(det || r.needs){
        const dn = ruleNeeds(V, r);
        const st = canonNeeds(r.needs), dv = dn.needs ? canonNeeds(dn.needs) : null;
        const status = !dv ? 'not-derivable' : JSON.stringify(st) === JSON.stringify(dv) ? 'identical' : 'different';
        add({ kind:'rule-needs', where, stored:r.needs || null, derived:dn.needs ? tidyNeeds(dn.needs) : null, how:dn.how, status, reasons:dn.reasons, text:r.text, comments,
          selects:status === 'different' ? selDiff(fk, r.needs, tidyNeeds(dn.needs)) : undefined });
      }
      if(r.tag) tagItem('rule-tag', where, r, {}, comments);
    }
  }
  function tagItem(kind, where, ab, tctx, comments, dedupe){
    const d = abilityTag(ab, tctx);
    const sp = tagParts(ab.tag), sder = sp.filter(DERIVABLE_TAG), skept = sp.filter(p => !DERIVABLE_TAG(p));
    if(!sp.length && !d.parts.length) return;
    const same = JSON.stringify([...sder].map(x => x.toLowerCase()).sort()) === JSON.stringify([...d.parts].map(x => x.toLowerCase()).sort());
    const status = !d.parts.length ? 'not-derivable' : same ? 'identical' : 'different';
    add({ kind, where, stored:ab.tag || null, derived:d.parts.length ? d.parts.join(', ') : null, how:d.parts.length ? 'explicit' : 'none', status, reasons:d.reasons,
      notDerivableParts:skept.length ? skept : undefined, text:ab.text, comments, dedupe });
  }
  // abilities on every unit of every list
  for(const a of D.armies){
    const f = D.factions[a.faction];
    const enh = a.detachments.flatMap(id => (f.detachments[id] || {}).enhancements || []);
    for(const u of a.units){
      const seen = {};
      // (two units of the same name in a list, the Big Mek Dakkarigs: told apart by their ids)
      const uName = u.name + (a.units.filter(x => x.name === u.name).length > 1 ? ' [' + u.id + ']' : '');
      for(const ab of u.abilities){
        let where = a.id + ' · ' + uName + ' · ' + (ab.who ? ab.who + ' · ' : '') + ab.name;
        seen[where] = (seen[where] || 0) + 1; if(seen[where] > 1) where += ' #' + seen[where];
        const comments = commentsNear(src, ab.name);
        timingItem('ability-timing', where, ab, ab.text, { comments, dedupe:ab.name + '\n' + ab.text }, { core:D.coreStratagems, named:n => {
          const o = u.abilities.find(x => x !== ab && norm(x.name).toLowerCase() === norm(n).toLowerCase());
          if(o) return o.text;
          const r = f.armyRules.concat(a.detachments.map(id => (f.detachments[id] || {}).rule).filter(Boolean)).find(x => norm(x.name).toLowerCase() === norm(n).toLowerCase());
          return r ? r.text : null;
        } });
        tagItem('ability-tag', where, ab, { enh }, comments, ab.name + '\n' + ab.text);
      }
      // coverage only: aura reach, and the bonuses a footnote's source text names vs what the footnote says
      for(const m of u.aura || []){
        const ab = u.abilities.find(x => x.name === m.from);
        if(!ab) continue;
        const r = REACH_RE.exec(plain(ab.text)), s = /within (\d+)"/i.exec(m.when || '');
        add({ kind:'unit-aura', coverage:true, where:a.id + ' · ' + uName + ' · ' + m.from, stored:s ? s[1] + '"' : (m.when || null), derived:r ? r[1] + '"' : null, how:r ? 'explicit' : 'none',
          status:!r ? 'not-derivable' : s && s[1] === r[1] ? 'identical' : 'different', reasons:r ? [{ rule:'aura-reach', match:r[0] }] : [], text:ab.text, dedupe:m.from + '\n' + ab.text + '\n' + JSON.stringify(m) });
      }
      // a footnote per bonus or per condition: an ability's footnotes on this unit together say what it gives
      const byFrom = new Map();
      for(const m of u.mods || []){ const k = m.from + (m.weapon ? ' (' + m.weapon + ')' : ''); if(!byFrom.has(k)) byFrom.set(k, []); byFrom.get(k).push(m); }
      for(const [k, ms] of byFrom){
        const ab = u.abilities.find(x => x.name === ms[0].from);
        if(!ab) continue;
        const text = plain(ab.text), said = ms.map(m => (m.note || '') + ' ' + JSON.stringify(m.set || {})).join(' | ');
        cover('unit-mod', a.id + ' · ' + uName + ' · ' + k, BONUS_RULES, text, said, ms.map(m => m.note).join(' | '), ab.text, k + '\n' + ab.text + '\n' + said);
      }
      for(const ab of u.abilities){
        const text = plain(ab.text);
        if(!DEF_RULES.some(r => r.re.test(text)) && !ab.def) continue;
        cover('ability-def', a.id + ' · ' + uName + ' · ' + ab.name, DEF_RULES, text, ab.def || '', ab.def || null, ab.text, ab.name + '\n' + ab.text + '\n' + (ab.def || ''));
      }
    }
  }
  function cover(kind, where, table, text, said, stored, src, dedupe){
    const got = table.filter(b => b.re.test(text)), has = table.filter(b => b.note.test(said));
    if(!got.length && !has.length) return;
    const missing = got.filter(b => !has.includes(b)).map(b => b.id), extra = has.filter(b => !got.includes(b)).map(b => b.id);
    add({ kind, coverage:true, where, stored, derived:got.map(b => b.id).join(', ') || null, how:got.length ? 'explicit' : 'none',
      status:!got.length ? 'not-derivable' : !missing.length && !extra.length ? 'identical' : 'different',
      reasons:got.map(b => ({ rule:b.id, match:(b.re.exec(text) || [''])[0] })), missing:missing.length ? missing : undefined, extra:extra.length ? extra : undefined, text:src, dedupe });
  }
  return items;
}

// =============================================================================================
// report and gate
// =============================================================================================
const KINDS = ['strat-timing', 'strat-needs', 'rule-timing', 'rule-needs', 'rule-tag', 'ability-timing', 'ability-tag', 'unit-aura', 'unit-mod', 'ability-def'];
const KIND_TITLE = {
  'strat-timing':'Stratagems: phases and turn (from WHEN)', 'strat-needs':'Stratagems: needs (from TARGET)',
  'rule-timing':'Army and detachment rules: phases, turn, moment', 'rule-needs':'Army and detachment rules: needs', 'rule-tag':'Army and detachment rules: tag',
  'ability-timing':'Abilities: phases, turn, moment', 'ability-tag':'Abilities: tag',
  'unit-aura':'Auras: reach (coverage only)', 'unit-mod':'Damage-tab footnotes: attack bonuses named (coverage only)', 'ability-def':'"When targeted" lines: protections named (coverage only)',
};
const J = x => x == null ? '—' : typeof x === 'string' ? x : JSON.stringify(x).replace(/"/g, '').replace(/,/g, ', ').replace(/:/g, ':');
function counts(items){
  const c = {};
  for(const k of KINDS) c[k] = { identical:0, different:0, 'not-derivable':0 };
  for(const it of items) c[it.kind][it.status]++;
  return c;
}
// the same ability on several lists is one entry, with every place it is on
function grouped(items){
  const m = new Map();
  for(const it of items){
    const k = it.kind + '\n' + (it.dedupe || it.where) + '\n' + JSON.stringify(it.stored);
    if(!m.has(k)) m.set(k, Object.assign({}, it, { places:[it.where] }));
    else m.get(k).places.push(it.where);
  }
  return [...m.values()];
}
function report(items){
  const c = counts(items);
  const lines = ['# Derived labels vs data.js', '',
    'Every label below is derived from the item\'s own text by the rule tables in `verify/derive.js` (each rule a pattern and the label it gives), and compared with the label data.js stores.',
    '(a) identical · (b) different: both values, the rules and the words they matched, the source text · (c) not derivable: no rule matched, nothing guessed.',
    'Timing compares what the app shows (phase → whose turn, and the moment tag): `turn:either, turns:{shooting:your}` and `turn:your, turns:{fight:either}` for Shooting+Fight are the same.',
    'Needs compares the same units-selection form: a one-keyword `any` is `all`. A difference marked "selects the same units" changes no list in data.js today.',
    'The same ability on several lists is one entry (its places listed). The gate (`node verify/derive.js`) fails only if an item that agrees today stops agreeing (verify/derive-agreed.json).', '',
    '| Kind | identical | different | not derivable |', '|---|---:|---:|---:|',
    ...KINDS.map(k => '| ' + KIND_TITLE[k] + ' | ' + c[k].identical + ' | ' + c[k].different + ' | ' + c[k]['not-derivable'] + ' |'), '',
    '(Counts are per place: an ability on three lists counts three times.)', '',
    '## The rule tables', '',
    '### 1. Timing', '',
    ...OWNER_RULES.map(r => '- `' + r.id + '`: ' + r.why),
    ...NOT_TIMING.map(r => '- `skip-' + r.id + '`: ' + r.why), '- `' + NOTE_LINE.id + '`: ' + NOTE_LINE.why,
    ...MOMENT_RULES.map(r => '- `' + r.id + '`: ' + r.why + (r.at ? ' → at "' + r.at + '"' : '')),
    '- Only when the text names no phase or moment, the activities (sentence by sentence):',
    ...ACTIVITY_RULES.map(r => '  - `' + r.id + '`: ' + r.why + (r.ph ? ' → ' + J(r.ph) : '')),
    '  - `' + AFTER_CHARGE.id + '`: ' + AFTER_CHARGE.why,
    '- Stratagems: the first sentence of WHEN only, phases only (no activities): every stratagem\'s WHEN names its phases.', '',
    '### 2. Needs', '', ...Object.entries(NEEDS_RULES).map(([k, v]) => '- `' + k + '`: ' + v),
    '- Keywords: a bold run in capitals is split into the keywords units in data.js have (longest first; "THOUSAND SONS" is the Faction keyword); capital words no unit has, in a row, are one keyword ("BREAKA BOYZ"); a plural with a singular keyword is that keyword ("MONSTERS").', '',
    '### 3. Tags', '', ...TAG_RULES.map(r => '- `' + r.id + '`: ' + r.why), '- Not derivable from the text (kept as stored, shown under "parts the text cannot give"): Psychic (New Recruit\'s name suffix), a "Once per…" that only the ability\'s name in New Recruit carries, other words.', '',
    '### 4. Coverage only', '', '- `aura-reach`: "within N" of this model" in the ability vs the distance in the aura\'s "Within N" of …" line.',
    '- attack bonuses: ' + BONUS_RULES.map(b => '`' + b.id + '`').join(', ') + ': named in the ability\'s text vs named in its footnotes on that unit (their note and set) together. Footnotes of rules and stratagems are not covered.',
    '- protections: ' + DEF_RULES.map(b => '`' + b.id + '`').join(', ') + ': named in the ability\'s text vs its "When targeted" line (def).',
    '- "the text names, the footnote does not" can be right: a bonus against a target the Damage tab does not model, or one shown elsewhere.', ''];
  const G = grouped(items);
  // the same words stored with different labels on different lists: one of the copies is wrong, whatever the rules say
  const byText = new Map();
  for(const it of G.filter(x => x.dedupe && !x.coverage)){ const k = it.kind + '\n' + it.dedupe; if(!byText.has(k)) byText.set(k, []); byText.get(k).push(it); }
  const split = [...byText.values()].filter(v => v.length > 1);
  lines.push('## Same words, different stored labels (' + split.length + ')', '', 'The same ability text carries different labels on different lists (derived is the same for all of them):', '');
  for(const v of split) lines.push('- **' + v[0].kind + ' · ' + v[0].where.split(' · ').pop() + '**: ' + v.map(it => '`' + J(it.stored) + '` on ' + it.places.join(', ')).join('; ') + ' · derived `' + J(v[0].derived) + '`');
  lines.push('');
  for(const k of KINDS){
    const g = G.filter(x => x.kind === k);
    lines.push('## ' + KIND_TITLE[k], '', c[k].identical + ' identical · ' + c[k].different + ' different · ' + c[k]['not-derivable'] + ' not derivable (' + g.length + ' entries)', '');
    const diff = g.filter(x => x.status === 'different').sort((x, y) => (x.how === 'explicit' ? 0 : 1) - (y.how === 'explicit' ? 0 : 1) || ((x.selects || []).length ? 0 : 1) - ((y.selects || []).length ? 0 : 1));
    lines.push('### (b) Different (' + diff.length + ')', '');
    for(const it of diff){
      lines.push('#### ' + it.where + (it.places.length > 1 ? ' (+' + (it.places.length - 1) + ' more)' : ''), '',
        '- stored: `' + J(it.stored) + '`', '- derived: `' + J(it.derived) + '`' + (it.how === 'activity' ? ' (from what it does: the text names no phase)' : ''),
        '- rules: ' + (it.reasons.length ? it.reasons.map(r => '`' + r.rule + '` "' + clip(r.match, 100) + '"').join(' · ') : '—'));
      if(it.selects) lines.push('- ' + (it.selects.length ? 'selects other units: ' + it.selects.slice(0, 8).join(', ') + (it.selects.length > 8 ? ' (+' + (it.selects.length - 8) + ')' : '') : 'selects the same units in every list in data.js'));
      if(it.missing) lines.push('- the text names, the footnote does not: ' + it.missing.join(', '));
      if(it.extra) lines.push('- the footnote names, the text does not: ' + it.extra.join(', '));
      if(it.notDerivableParts) lines.push('- parts the text cannot give: ' + it.notDerivableParts.join(', '));
      if(it.comments && it.comments.length) lines.push('- data.js comment: ' + it.comments.map(x => '"' + clip(x, 300) + '"').join(' '));
      if(it.places.length > 1) lines.push('- on: ' + it.places.join('; '));
      lines.push('- text: ' + clip(plain(it.text).replace(/\n/g, ' / '), 600), '');
    }
    const nd = g.filter(x => x.status === 'not-derivable');
    lines.push('### (c) Not derivable (' + nd.length + ')', '');
    for(const it of nd) lines.push('- **' + it.where + '**' + (it.places.length > 1 ? ' (+' + (it.places.length - 1) + ')' : '') + ': stored `' + J(it.stored) + '`' +
      (it.reasons.length ? ' · ' + it.reasons.map(r => '`' + r.rule + '` "' + clip(r.match, 80) + '"').join(' · ') : '') +
      (it.comments && it.comments.length ? ' · data.js: "' + clip(it.comments.join(' '), 200) + '"' : '') + ' · text: "' + clip(plain(it.text), 160) + '"');
    lines.push('');
    const id = g.filter(x => x.status === 'identical');
    lines.push('### (a) Identical (' + id.length + ')', '', id.map(it => it.where.replace(/^[^·]+ · /, k.startsWith('ability') || k.startsWith('unit') ? '' : '$&').trim() + ' `' + J(it.derived) + '`').join(' · '), '');
  }
  return lines.join('\n');
}

const AGREED = path.join(ROOT, 'verify/derive-agreed.json');
const keyOf = it => it.kind + ' | ' + it.where;

if(require.main === module){
  const D = loadData();
  const items = derive(D);
  const labelled = items.filter(it => !it.coverage);
  const c = counts(items);
  {   // the report is always written (verify/out is not committed); --report only says so
    const out = path.join(ROOT, 'verify/out');
    fs.mkdirSync(out, { recursive:true });
    fs.writeFileSync(path.join(out, 'derive.md'), report(items) + '\n');
    writeJSON(path.join(out, 'derive.json'), { counts:c, rules:{ owner:OWNER_RULES.map(r => r.id), notTiming:NOT_TIMING.map(r => r.id), moments:MOMENT_RULES.map(r => r.id), activity:ACTIVITY_RULES.map(r => r.id).concat(AFTER_CHARGE.id), needs:Object.keys(NEEDS_RULES), tags:TAG_RULES.map(r => r.id), coverage:['aura-reach'].concat(BONUS_RULES.map(b => b.id), DEF_RULES.map(b => b.id)) },
      items:items.map(({ dedupe, ...it }) => it) });
    if(process.argv.includes('--report')) console.log('derive: report written to verify/out/derive.md and derive.json');
  }
  if(process.argv.includes('--agree')){
    const keys = labelled.filter(it => it.status === 'identical').map(it => ({ key:keyOf(it), label:it.derived }));
    writeJSON(AGREED, { note:'labels derived from the text (verify/derive.js) that equal data.js; the gate keeps them equal', items:Object.fromEntries(keys.map(k => [k.key, k.label])) });
    console.log('derive: recorded ' + keys.length + ' agreeing labels in verify/derive-agreed.json');
  }
  // the gate: an item that agreed must still agree
  if(!fs.existsSync(AGREED)){ console.log('derive: verify/derive-agreed.json is missing (node verify/derive.js --agree records the labels that agree today)'); process.exit(1); }
  const agreed = (readJSON(AGREED, {}).items) || {};
  const now = new Map(labelled.map(it => [keyOf(it), it]));
  const drift = [], stale = [];
  for(const [k, label] of Object.entries(agreed)){
    const it = now.get(k);
    if(!it){ stale.push(k); continue; }
    if(it.status !== 'identical') drift.push(k + ': stored ' + J(it.stored) + ', derived ' + J(it.derived) + ' (agreed ' + J(label) + ')');
  }
  const L = k => c[k].identical + '/' + c[k].different + '/' + c[k]['not-derivable'];
  const total = s => labelled.filter(it => it.status === s).length;
  console.log('derive: ' + Object.keys(agreed).length + ' agreed labels hold' + (drift.length ? ' except ' + drift.length : '') + '; ' + total('different') + ' differ, ' + total('not-derivable') + ' not derivable (not failing; verify/out/derive.md)' + (stale.length ? '; ' + stale.length + ' agreed items no longer exist' : ''));
  console.log('  identical/different/not derivable: ' + KINDS.map(k => k + ' ' + L(k)).join(' · '));
  for(const d of drift) console.log('  DRIFT ' + d);
  process.exit(drift.length ? 1 : 0);
}
module.exports = { derive, timing, explicitTiming, stratNeeds, ruleNeeds, canonNeeds, OWNER_RULES, NOT_TIMING, MOMENT_RULES, ACTIVITY_RULES, NEEDS_RULES, TAG_RULES, BONUS_RULES, DEF_RULES };
