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
// Where its EFFECT IS USED: read from what the effect does, clause by clause (every rule that matches adds its phases).
// The phases the app shows are the trigger's (above) and these together.
const TARGETED = { shooting:'opp', fight:'either' };     // an attack on your unit: the attacker's Shooting phase, or a fight
const ACTIVITY_RULES = [
  // being attacked: the attacker's phases (a sentence about the unit being attacked is read by these rules only)
  { id:'targeted-ranged', def:true, re:/\bagainst ranged attacks\b|\btarget of a ranged attack\b|\btargets this unit with ranged attacks\b|\branged attacks? (?:that )?targets? (?:this|it)\b/i, ph:{ shooting:'opp' },
    why:'it protects the unit against ranged attacks: the attacker\'s Shooting phase' },
  { id:'targeted-melee', def:true, re:/\bagainst melee attacks\b|\bmelee attacks? (?:that )?targets? (?:this|it)\b/i, ph:{ fight:'either' },
    why:'it protects the unit against melee attacks: the Fight phase' },
  { id:'targeted', def:true, re:/\b(?:an attack|attacks?) (?:that )?(?:targets?|is made against) (?:this|the bearer|that unit|it)\b|\b(?:is|are) allocated to (?:this|the bearer|that model)\b|\bmade against this\b|\binvulnerable save\b|\binsv\b|\bsave characteristic\b|\bsaving throws?\b|\bsave rolls?\b|\bfeel no pain\b/i, ph:TARGETED,
    why:'it protects the unit when it is attacked (a save, an invulnerable save, Feel No Pain, a modifier to attacks on it): the attacker\'s phases (their Shooting phase, the Fight phase)' },
  { id:'lone-operative', def:true, re:/\bhas (?:the )?lone operative\b/i, ph:{ shooting:'opp' },
    why:'Lone Operative: it cannot be selected as the target of a ranged attack from far away: the attacker\'s Shooting phase' },
  { id:'pre-battle', re:/\bdeclare battle formations\b|\bafter both players have deployed\b|\bif this model is in your army\b|\btransport capacity\b/i, none:true,
    why:'before the battle (Declare Battle Formations, deployment, mustering) or what it can carry: no phase' },
  { id:'named-ability', named:true,
    why:'"when this model uses its X ability" / "as a result of the X detachment rule": that ability\'s or rule\'s phases (this table, on its text)' },
  { id:'named-core-stratagem', core:true,
    why:'it names a Core stratagem: that stratagem\'s phases and turn (from its WHEN)' },
  { id:'named-other-stratagem', re:/\bthe ((?:[A-Z][\w'-]*)(?: [A-Z][\w'-]*)*) stratagem\b/, blocker:true,
    why:'it names a stratagem this file has no WHEN for: not derivable' },
  { id:'any-stratagem', re:/\b(?:targets?|targeted|select)\b[^.]*\bwith an? stratagem\b|\btarget of an? stratagem\b|\btarget the bearer with an? stratagem\b/i, ph:Object.fromEntries(PH.map(p => [p, 'either'])),
    why:'"targeted with a Stratagem": stratagems are used in any phase of either turn' },
  { id:'ritual', re:/\britual|psychic test\b/i, ph:{ shooting:'your' },
    why:'Rituals are attempted at the start of your Shooting phase (the Cabal of Sorcerers army rule)' },
  { id:'melee-only-keyword', re:/\[(?:LANCE|EXTRA ATTACKS)\]|\bWS\b|\bweapon skill\b/i, ph:{ fight:'either' },
    why:'a melee-only weapon ability ([LANCE], [EXTRA ATTACKS]) or Weapon Skill: the Fight phase' },
  { id:'ranged-only-keyword', re:/\[(?:RAPID FIRE|HEAVY|ASSAULT|BLAST|TORRENT|INDIRECT FIRE|IGNORES COVER)[^\]]*\]|\bBS\b|\bballistic skill\b/i, ph:{ shooting:'your' }, shoots:true,
    why:'a ranged-only weapon ability ([RAPID FIRE], [HEAVY], [ASSAULT], [IGNORES COVER]…) or Ballistic Skill: your Shooting phase' },
  { id:'weapons-have', re:/\b(?<!ranged |melee |psychic )weapons (?:equipped by [^.]*? )?have\b/i, ph:{ shooting:'your', fight:'either' }, shoots:true,
    why:'"weapons … have" (ranged and melee alike): your Shooting phase and the Fight phase; not when the clause gives a ranged-only or melee-only weapon ability' },
  { id:'melee', re:/\bmelee (?:attacks?|weapons?)\b|\bselected to fight\b|\beligible to fight\b|\bfights first\b|\bpile-in\b|\bconsolidation move\b/i, ph:{ fight:'either' },
    why:'melee attacks / "selected to fight" / pile-in and consolidation moves: the Fight phase of either turn' },
  { id:'ranged', re:/(?<!against |target of a |with )\branged (?:attacks?|weapons?)\b|\bselected to shoot\b|\beligible to shoot\b|\bhas shot\b|\bshoots\b/i, ph:{ shooting:'your' }, shoots:true,
    why:'ranged attacks / "selected to shoot": your Shooting phase' },
  { id:'any-attack', re:/\bmakes? an attack\b|\b(?:unit|model|bearer)'s attacks\b|\battacks made (?:with|by) (?:this|the bearer)|\bselected to shoot or fight\b/i, ph:{ shooting:'your', fight:'either' }, shoots:true,
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
// modifiers on the phases above
const USED_MODIFIERS = [
  { id:'after-charge', re:/\bmade a charge move this turn\b/i,
    why:'"made a charge move this turn": a condition, not a move; only the Fight phase is left in that turn (its attacks are not in the Shooting phase)' },
  { id:'overwatch', why:'an always-on ranged effect (no trigger in the text) is also used when the unit shoots with a Core stratagem whose EFFECT is "Your unit shoots" (Fire Overwatch: its WHEN, your opponent\'s Movement phase); when it protects against ranged attacks, the same moment in the other turn (the enemy\'s Fire Overwatch)' },
  { id:'trigger-phase', why:'an effect used in the phase it is triggered in has the trigger\'s turn ("In your opponent\'s Movement phase, … this unit can make a Normal move": the opponent\'s Movement phase only)' },
  { id:'same-turn', re:/\buntil the end of the turn\b|\bthis turn\b/i,
    why:'triggered in one player\'s turn with an effect "until the end of the turn": used in that turn only, from the trigger\'s phase on' },
];
const AFTER_CHARGE = USED_MODIFIERS[0];

const addPh = (out, p, t) => { out[p] = out[p] && out[p] !== t ? 'either' : t; };
const OTHER = { your:'opp', opp:'your', either:'either' };
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

// table 1 in full: where it is triggered (the phases and moments the text names) and where its effect is used
function usedIn(text, ctx, trig){
  let t = plain(rulesText(text));
  const reasons = [], out = {};
  let none = null, blocked = null, shoots = false, guarded = false;
  const afterCharge = AFTER_CHARGE.re.exec(t);
  if(afterCharge) t = t.replace(AFTER_CHARGE.re, ' ');                  // a condition: no charge-move rule on it
  const add = (ph, r) => { for(const [p, o] of Object.entries(ph)){ if(afterCharge && p === 'shooting' && r.shoots && r.id !== 'ranged' && r.id !== 'ranged-only-keyword') continue; addPh(out, p, o); } };
  for(const sent of sentences(t)){
    // a sentence about the unit being attacked is read by the "targeted" rules only
    const defs = ACTIVITY_RULES.filter(r => r.def).map(r => [r, r.re.exec(sent)]).filter(x => x[1]);
    if(defs.length){
      const d = defs.find(x => x[0].id !== 'targeted') || defs[0];      // "against ranged attacks" is more precise than "invulnerable save"
      add(d[0].ph, d[0]); reasons.push({ rule:d[0].id, match:d[1][0] });
      if(d[0].ph.shooting) guarded = true;
      continue;
    }
    // clause by clause ("weapons … have [LETHAL HITS], and melee weapons … have [LANCE]")
    for(const s of sent.split(/,\s+and\s+|;\s+/)){
      const kwOnly = ACTIVITY_RULES.filter(r => /-only-keyword$/.test(r.id)).some(r => r.re.test(s));
      for(const r of ACTIVITY_RULES){
        if(r.def) continue;
        if(r.id === 'weapons-have' && kwOnly) continue;   // "Snazzgun weapons have [RAPID FIRE 1]": the keyword says which weapons
        if(r.named){
          const m = /\b(?:uses its|as a result of the) ([A-Z][^,.]*?)(?: ability| detachment rule)\b/.exec(s);
          const other = m && ctx && ctx.named && ctx.named(m[1]);
          if(other){
            const w = timing(other, { core:ctx.core });
            if(w.ph && Object.keys(w.ph).length){ add(w.ph, r); reasons.push({ rule:r.id, match:m[0] + ' → ' + w.reasons.map(x => x.match).join(', ') }); }
          }
          continue;
        }
        if(r.core){
          for(const cs of (ctx && ctx.core) || []){
            const m = new RegExp('\\b' + cs.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b[^.]*\\bstratagem\\b', 'i').exec(s);
            if(!m) continue;
            const w = explicitTiming(cs.when.split(/[.:]/)[0]);
            if(w){ add(w.ph, r); reasons.push({ rule:r.id, match:cs.name + ' → ' + w.reasons.map(x => x.match).join(', ') }); }
          }
          continue;
        }
        const m = r.re.exec(s);
        if(!m) continue;
        if(r.blocker){ if(!((ctx && ctx.core) || []).some(cs => cs.name.toLowerCase() === m[1].toLowerCase())) blocked = { rule:r.id, match:m[0] }; continue; }
        if(r.none){ none = none || { rule:r.id, match:m[0] }; continue; }
        if(r.id === 'any-stratagem' && reasons.some(x => x.rule === 'named-core-stratagem')) continue;
        if(r.id === 'move-own' && /\benemy unit\b/i.test(s) && ACTIVITY_RULES.find(x => x.id === 'move-enemy').re.test(s)) continue;
        if(r.shoots && !(afterCharge && r.id === 'any-attack')) shoots = true;
        add(r.ph, r);
        reasons.push({ rule:r.id, match:m[0] });
      }
    }
  }
  if(afterCharge && reasons.some(r => r.rule === 'any-attack' || r.rule === 'weapons-have')) reasons.push({ rule:'after-charge', match:afterCharge[0] });
  // Fire Overwatch: an always-on effect only (a triggered one lasts from its trigger)
  if(!trig && (shoots || guarded)){
    for(const cs of (ctx && ctx.core) || []){
      if(!/\byour unit shoots\b/i.test(plain(cs.effect))) continue;
      const w = explicitTiming(cs.when.split(/[.:]/)[0]);
      if(!w) continue;
      for(const [p, o] of Object.entries(w.ph)){ if(shoots) addPh(out, p, o); if(guarded) addPh(out, p, OTHER[o]); }
      reasons.push({ rule:'overwatch', match:cs.name + ': ' + w.reasons.map(x => x.match).join(', ') + (guarded && !shoots ? ' (the enemy\'s)' : '') });
    }
  }
  // an effect used in the phase it is triggered in is used in that turn ("In your opponent's Movement phase, … make a Normal move")
  if(trig) for(const p of Object.keys(out)) if(trig.ph[p]) out[p] = trig.ph[p];
  // triggered in one turn, "until the end of the turn": that turn only, from the trigger's phase on
  const same = USED_MODIFIERS.find(r => r.id === 'same-turn').re.exec(t);
  if(trig && same && Object.keys(out).length){
    const owners = [...new Set(Object.values(trig.ph))], first = PH.findIndex(p => trig.ph[p]);
    if(owners.length === 1 && owners[0] !== 'either'){
      for(const p of Object.keys(out)){ if(PH.indexOf(p) < first) delete out[p]; else out[p] = owners[0]; }
      reasons.push({ rule:'same-turn', match:same[0] });
    }
  }
  return { ph:out, reasons, none, blocked };
}
function timing(text, ctx){
  const trig = explicitTiming(text);
  const used = usedIn(text, ctx, trig);
  const ph = Object.assign({}, trig ? trig.ph : {});
  for(const [p, o] of Object.entries(used.ph)) addPh(ph, p, o);
  const reasons = (trig ? trig.reasons.map(r => Object.assign({ part:'trigger' }, r)) : []).concat(used.reasons.map(r => Object.assign({ part:'used' }, r)));
  const trigLabel = trig ? asLabel(trig.ph, trig.at) : null, usedLabel = Object.keys(used.ph).length ? asLabel(used.ph) : null;
  if(Object.keys(ph).length || (trig && trig.at)) return { how:trig ? 'explicit' : 'activity', ph, at:trig && trig.at, reasons, trigger:trigLabel, used:usedLabel };
  if(used.blocked) return { how:'none', blocked:true, reasons:[used.blocked] };
  if(used.none) return { how:'activity', ph:{}, reasons:[used.none], trigger:null, used:null };   // positively: no phase
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
  'multi-target':  'TARGET with two targets ("One X model …, and one friendly Y unit …"): for a unit of either kind (the alternatives as "or")',
  'kw-every':      'compared without a keyword every unit of that faction\'s lists has (the Faction keyword "ORKS" in Orks lists): in the app\'s matches() it selects nothing, and data.js names it in some needs and not in others',
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
  const alts = r.split(/\s*,\s*(?:or\s+|and\s+)?|\s+or\s+|\s+and\s+/).filter(Boolean).map(a => parseAlt(V, a));
  const rules = new Set();
  if(alts.some(a => a.multiAny)) return { bad:'two "/" groups in one run', rules:['kw-slash'] };
  if(alts.some(a => a.slash)) rules.add('kw-slash');
  if(alts.length === 1) { if(alts[0].all.length) rules.add('kw-all'); return { all:alts[0].all, any:alts[0].any, rules:[...rules] }; }
  if(alts.some(a => a.any.length)) return { bad:'"or" between runs that use "/"', rules:['kw-or'] };
  rules.add('kw-or');
  const c = combineAlts(alts.map(a => a.all));
  return c.bad ? { bad:c.bad, rules:[...rules] } : { all:c.all, any:c.any, rules:[...rules, ...c.rules] };
}
// alternatives, each a list of keywords the unit has all of → { all, any }
function combineAlts(sets){
  const rules = new Set();
  if(sets.every(x => x.length === 1)) return { all:[], any:sets.map(x => x[0]), rules:['kw-or'] };
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
  // "One X model from your army, and one friendly Y unit …": two targets, the stratagem is for a unit of either kind
  const parts = first.split(/,?\s+and\s+(?=(?:one|two|up to \w+)\b)/i);
  if(parts.length > 1){
    const alts = [n];
    for(const part of parts.slice(1)){
      const u2 = friendlyUnit(V, part, { any:true });
      if(!u2 || !u2.run) continue;
      const r2 = [], n2 = needsOf(V, u2, r2);
      if(n2.bad || n2.any.length || n2.none.length || (n.any || []).length || (n.none || []).length) return { how:'none', reasons:[{ rule:'unparsed', match:'two targets with "/" or exclusions: ' + clip(plain(first), 90) }] };
      alts.push(n2);
      reasons.push({ rule:'multi-target', match:plain(u2.matched) });
    }
    if(alts.length > 1){
      const c = combineAlts(alts.map(x => x.all));
      if(c.bad) return { how:'none', reasons:[{ rule:'unparsed', match:c.bad }] };
      n = { all:c.all, any:c.any, none:[] };
      reasons.push({ rule:c.rules.join('+'), match:alts.map(x => x.all.join(' ')).join(' | ') });
    }
  }
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
function canonNeeds(n, every){
  if(!n) return {};
  const o = {};
  const all = [...(n.all || [])].filter(k => !(every && every.has(norm(k).toLowerCase()))), any = [...(n.any || [])];
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
  { id:'tag-aura', re:/\b(?:friendly|enemy)\b[^.]*?\b(?:units?|models?)(?: \([^)]*\))? (?:is |are )?(?:wholly )?within (?:\d+"|engagement range) of (?:this|the bearer|that model|one or more units with this ability)\b|\bunits? from their army within \d+" of this\b/i, give:'Aura', sentence:true,
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
  // a keyword every unit of the faction's lists has ("ORKS" in an Orks list) selects nothing in the app's matches(): needs may
  // name it or leave it out (data.js does both: Kustom Dakka has Faction: Orks, Dread Power not), so it is not compared
  const everyKw = fk => { if(!fk) return null; const us = unitsOf(fk).map(x => x.u); if(!us.length) return null;
    return new Set(us[0].kw.map(k => norm(k).toLowerCase()).filter(k => us.every(u => u.kw.some(x => norm(x).toLowerCase() === k)))); };
  const selDiff = (fk, n1, n2) => unitsOf(fk).filter(({ u }) => matches(n1 && Object.keys(n1).length ? n1 : null, u) !== matches(n2 && Object.keys(n2).length ? n2 : null, u)).map(({ a, u }) => a.id + '/' + u.name);

  const timingItem = (kind, where, x, text, extra, tctx) => {
    const d = timing(text, tctx || ctx), sm = storedMap(x), sAt = x.at;
    const stored = Object.assign(x.at ? { at:x.at } : {}, (x.phases || x.ph) ? { ph:x.phases || x.ph, turn:x.turn } : {}, x.turns ? { turns:x.turns } : {});
    let status;
    if(d.how === 'none') status = 'not-derivable';
    else status = mapKey(sm, sAt) === mapKey(d.ph, d.at) ? 'identical' : 'different';
    add(Object.assign({ kind, where, stored, derived:d.how === 'none' ? null : asLabel(d.ph, d.at), trigger:d.trigger, used:d.used, how:d.how, status, reasons:d.reasons, text }, extra));
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
    const st = canonNeeds(s.needs, everyKw(fk)), dv = dn.needs ? canonNeeds(dn.needs, everyKw(fk)) : null;
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
        const st = canonNeeds(r.needs, everyKw(fk)), dv = dn.needs ? canonNeeds(dn.needs, everyKw(fk)) : null;
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
        const tItem = items[items.length - 1]; Object.defineProperty(tItem, 'ab', { value:ab, enumerable:false });
        const before = items.length;
        tagItem('ability-tag', where, ab, { enh }, comments, ab.name + '\n' + ab.text);
        if(items.length > before) Object.defineProperty(items[items.length - 1], 'ab', { value:ab, enumerable:false });
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
        const text = plain(ab.text), said = ms.map(m => (m.note || '') + ' ' + JSON.stringify(m.set || {}).replace(/"(A|S|D)":"\d/g, '"$1":"+')).join(' | ') + elsewhere(u, ab);
        cover('unit-mod', a.id + ' · ' + uName + ' · ' + k, BONUS_RULES, text, said, ms.map(m => m.note).join(' | '), ab.text, k + '\n' + ab.text + '\n' + said);
      }
      for(const ab of u.abilities){
        const text = plain(ab.text);
        if(!DEF_RULES.some(r => r.re.test(text)) && !ab.def) continue;
        cover('ability-def', a.id + ' · ' + uName + ' · ' + ab.name, DEF_RULES, text, (ab.def || '') + elsewhere(u, ab), ab.def || null, ab.text, ab.name + '\n' + ab.text + '\n' + (ab.def || ''));
      }
    }
  }
  // what the datasheet shows for an ability outside its footnotes: a value or keyword it grants (marked + on the weapon or
  // stat line, from BSData), a Feel No Pain on the unit's Rules line, the "given to other units" lines (guard)
  function elsewhere(u, ab){
    const out = [];
    for(const x of [...u.stats, ...(u.ranged || []), ...(u.melee || [])]) for(const [k, v] of Object.entries(x.from || {})) if([].concat(v).includes(ab.name))
      out.push(/^(A|S|D)$/.test(k) ? '"' + k + '":"+' : k === 'AP' ? '+1 AP' : k === 'InSv' ? 'invulnerable save' : k === 'W' ? 'Wounds' : '[' + k + ']');
    if(/feel no pain/i.test(ab.text)) for(const r of u.rules || []) if(/^feel no pain \d\+/i.test(r) && plain(ab.text).toLowerCase().includes(r.toLowerCase())) out.push('Feel No Pain (Rules line)');
    for(const g of u.guard || []) if(g.from === ab.name) out.push((g.note || '') + ' ' + JSON.stringify(g.calc || {}).replace(/"fnp":/, 'feel no pain '));
    return out.length ? ' | elsewhere: ' + out.join(' | ') : '';
  }
  // ---- rule options and grants (coverage only) ----
  for(const [fk, f] of Object.entries(D.factions)){
    const rules = f.armyRules.map(r => ({ r, where:f.name + ' army rule · ' + r.name }))
      .concat(Object.values(f.detachments).filter(d => d.rule).map(d => ({ r:d.rule, where:f.name + ' · ' + d.name + ' rule · ' + d.rule.name })));
    for(const { r, where } of rules) optionsAndGrants(where, r, r.text, r.table, storedOptionsOfRule(r), fk);
  }
  { const seen = new Set();
    for(const a of D.armies) for(const u of a.units) for(const ab of u.abilities){
      const k = ab.name + '\n' + ab.text; if(seen.has(k)) continue; seen.add(k);
      optionsAndGrants(a.id + ' · ' + u.name + ' · ' + ab.name, ab, ab.text, null, storedOptionsOfAbility(u, ab), a.faction, u);
    } }
  function storedOptionsOfRule(r){
    const out = [];
    for(const m of r.calcMods || []) out.push({ name:m.from, what:'calcMods (' + m.kind + ')', kind:m.kind, picks:(m.pick || []).map(p => p.name) });
    for(const p of r.parts || []) out.push({ name:p.name, what:'parts' + (p.mod ? ' mod (' + p.mod.kind + ')' : p.def ? ' def' : p.grants ? ' grants ' + p.grants : ''), kind:p.mod ? p.mod.kind : p.def ? 'def' : null, grants:p.grants, needs:p.needs, when:p.when });
    if(r.mod) out.push({ name:null, what:'mod (' + r.mod.kind + ')', kind:r.mod.kind, picks:(r.mod.pick || []).map(p => p.name), note:r.mod.note });
    return out;
  }
  function storedOptionsOfAbility(u, ab){
    return (u.mods || []).concat(u.aura || [], u.guard || []).filter(m => m.from === ab.name).map(m => ({ name:null, what:'footnote (' + m.kind + ')', kind:m.kind, picks:(m.pick || []).map(p => p.name), note:m.note }));
  }
  function optionsAndGrants(where, x, text, table, stored, fk, self){
    const t = rulesText(text);
    const opts = [];
    for(const row of table || []) opts.push({ name:String(row[0]).split(' · ')[0].replace(/ \((?:Aura|Psychic)\)$/, ''), text:row[1], how:'table row' });
    const lines = t.split('\n');
    lines.forEach((l, i) => {
      let m = /^(?:- )?\*\*([^*]{3,60}?)(?::\*\*|\*\*:)\s*(.+)$/.exec(l);
      if(m && !isUpperWord(m[1].replace(/[^A-Za-z]/g, '') || 'a')) { opts.push({ name:m[1].trim(), text:m[2], how:'"**Name:** effect"' }); return; }
      m = /^- \*\*([^*]{3,60})\*\*\s*$/.exec(l);
      if(m && lines[i + 1] && !/^\s*- /.test(lines[i + 1]) && !/^\s*\*\*[^*]+\*\*\s*$/.test(lines[i + 1])) opts.push({ name:m[1].replace(/\s*\[[^\]]*\]$/, '').trim(), text:lines[i + 1], how:'bullet "**Name**" and its line' });
    });
    // army-building limits ("**Incursion:** Up to 500 pts") are not options
    for(let i = opts.length - 1; i >= 0; i--) if(/^up to \d+ ?pts\b/i.test(plain(opts[i].text))) opts.splice(i, 1);
    // the rule's own trigger: its text without its options
    const parentTrig = explicitTiming(opts.reduce((s2, o) => s2.replace(o.text, ''), t));
    for(const o of opts){
      const own = explicitTiming(o.text), trig = own || parentTrig;
      const used = usedIn(o.text, { core:D.coreStratagems }, trig);
      const ph = Object.assign({}, trig ? trig.ph : {}); for(const [p, v] of Object.entries(used.ph)) addPh(ph, p, v);
      const mine = stored.filter(sx => sx.name && norm(sx.name).toLowerCase().startsWith(norm(o.name).toLowerCase()) || (sx.picks || []).some(n => norm(o.name).toLowerCase().startsWith(norm(n).toLowerCase()) || norm(n).toLowerCase().startsWith(norm(o.name).split(' ')[0].toLowerCase())));
      const storedPh = new Set(mine.flatMap(sx => sx.kind === 'melee' ? ['fight'] : sx.kind === 'ranged' ? ['shooting'] : sx.kind === 'all' ? ['shooting', 'fight'] : sx.kind === 'def' ? ['shooting', 'fight'] : []));
      const inDerived = [...storedPh].every(p => ph[p]);
      const status = !Object.keys(ph).length ? 'not-derivable' : !mine.length ? 'different' : inDerived ? 'identical' : 'different';
      add({ kind:'rule-option', coverage:true, where:where + ' · ' + o.name, stored:mine.length ? mine.map(sx => sx.what + (sx.picks && sx.picks.length ? ' picks ' + sx.picks.join('/') : '')).join('; ') : null,
        derived:Object.keys(ph).length ? asLabel(ph, trig && trig.at) : null, trigger:trig ? asLabel(trig.ph, trig.at) : null, used:Object.keys(used.ph).length ? asLabel(used.ph) : null,
        how:own ? 'explicit' : 'activity', status, noPerOption:!mine.length || undefined, optionFrom:o.how + (own ? '' : parentTrig ? ', trigger: the rule\'s' : ''),
        reasons:(trig ? trig.reasons.map(r => Object.assign({ part:own ? 'trigger' : 'rule trigger' }, r)) : []).concat(used.reasons.map(r => Object.assign({ part:'used' }, r))), text:o.text });
      grantsIn(where + ' · ' + o.name, o.text, stored, fk, o.name + ' active', self);
    }
    grantsIn(where, opts.reduce((s2, o) => s2.replace(o.text, ''), t), stored, fk, null, self);
  }
  // "BLOOD LEGIONS units from your army gain the Blessings of Khorne ability", "Friendly X units have the following ability:"
  function grantsIn(where, text, stored, fk, whileOpt, self){
    for(const sent of sentences(norm(text))){
      const m = /\b(gains?|have|has)(?: the)? (?:(following) abilit(?:y|ies)|\*\*([^*\[\]]+)\*\*(?: abilit(?:y|ies))?|([A-Z][\w'’ -]+?) abilit(?:y|ies))/.exec(sent);
      if(!m) continue;
      const name = (m[3] || m[4] || (m[2] ? ((/\*\*([^*]+?):?\*\*:?/.exec(norm(text).slice(norm(text).indexOf(sent) + sent.length)) || [])[1] || 'the following ability') : '')).replace(/:$/, '').trim();
      if(!name || /^\[/.test(name) || /\b(?:keyword|characteristic)\b/i.test(name)) continue;
      const before = sent.slice(0, m.index);
      const subj = friendlyUnit(V, before + ' ', { any:true }) || friendlyUnit(V, before.replace(/$/, ' unit'), { any:true });
      const rs = [];
      const to = /\b(?:this|the bearer'?s?|that) (?:unit|model)\b|\bthe bearer\b|\bthis model\b/i.test(before) && !(subj && subj.run) ? 'this unit / model' : subj && subj.run ? tidyNeeds(needsOf(V, subj, rs)) : null;
      const cond = (/^(while|if|when|until) [^,]+/i.exec(plain(sent)) || [])[0];
      const wh = [whileOpt, cond].filter(Boolean).join('; ') || null;
      const grantName = name.replace(/ ability$/i, '');
      const type = isUpperWord(grantName.replace(/[^A-Za-z]/g, '')) ? 'keyword or weapon ability' : 'ability';
      const inParts = stored.find(sx => sx.grants && norm(sx.grants).toLowerCase() === norm(grantName).toLowerCase());
      const holds = u => (u.rules || []).concat(u.abilities.map(y => y.name), u.kw || []).some(r => norm(r).toLowerCase() === norm(grantName).toLowerCase() || norm(r).toLowerCase().startsWith(norm(grantName).toLowerCase() + ' '));
      // who should hold it: this unit (an ability's own grant) or the units it is for
      const forUnits = to === 'this unit / model' ? (self ? [self] : []) : to ? D.armies.filter(a => a.faction === fk).flatMap(a => a.units.filter(u => matches(to, u))) : [];
      const onSheets = forUnits.filter(holds).map(u => u.name);
      const storedG = inParts ? { grants:inParts.grants, to:inParts.needs || null, while:inParts.when || null } : onSheets.length ? 'on the datasheet' + (onSheets.length > 1 ? 's' : '') + ' (Rules line, abilities or keywords): ' + [...new Set(onSheets)].slice(0, 5).join(', ') + (new Set(onSheets).size > 5 ? '…' : '') + (onSheets.length < forUnits.length ? ' (' + onSheets.length + ' of ' + forUnits.length + ' units it is for)' : '') : null;
      const same = inParts ? JSON.stringify(canonNeeds(inParts.needs)) === JSON.stringify(canonNeeds(typeof to === 'object' ? to : null)) : !!onSheets.length;
      add({ kind:'rule-grant', coverage:true, where:where + ' → ' + grantName, derived:{ grants:grantName, type, to, while:wh }, stored:storedG,
        how:'explicit', status:same ? 'identical' : 'different', noPerOption:!storedG || undefined, reasons:[{ rule:'grant', match:clip(plain(sent), 120) }], text:sent });
    }
  }
  function cover(kind, where, table, text, said, stored, src, dedupe){
    const got = table.filter(b => b.re.test(text)), has = table.filter(b => b.note.test(said));
    if(!got.length && !has.length) return;
    const missing = got.filter(b => !has.includes(b)).map(b => b.id), extra = has.filter(b => !got.includes(b)).map(b => b.id);
    const shownElsewhere = /\| elsewhere: /.test(said) ? said.split('| elsewhere: ')[1] : undefined;
    add({ kind, coverage:true, where, stored, shownElsewhere, derived:got.map(b => b.id).join(', ') || null, how:got.length ? 'explicit' : 'none',
      status:!got.length ? 'not-derivable' : !missing.length && !extra.length ? 'identical' : 'different',
      reasons:got.map(b => ({ rule:b.id, match:(b.re.exec(text) || [''])[0] })), missing:missing.length ? missing : undefined, extra:extra.length ? extra : undefined, text:src, dedupe });
  }
  return items;
}

// =============================================================================================
// report and gate
// =============================================================================================
const KINDS = ['strat-timing', 'strat-needs', 'rule-timing', 'rule-needs', 'rule-tag', 'ability-timing', 'ability-tag', 'unit-aura', 'unit-mod', 'ability-def', 'rule-option', 'rule-grant'];
const KIND_TITLE = {
  'strat-timing':'Stratagems: phases and turn (from WHEN)', 'strat-needs':'Stratagems: needs (from TARGET)',
  'rule-timing':'Army and detachment rules: phases, turn, moment', 'rule-needs':'Army and detachment rules: needs', 'rule-tag':'Army and detachment rules: tag',
  'ability-timing':'Abilities: phases, turn, moment', 'ability-tag':'Abilities: tag',
  'unit-aura':'Auras: reach (coverage only)', 'unit-mod':'Damage-tab footnotes: attack bonuses named (coverage only)', 'ability-def':'"When targeted" lines: protections named (coverage only)',
  'rule-option':'Options inside a rule or ability: trigger and used-in per option (coverage only)', 'rule-grant':'Grants: a rule giving units an ability (coverage only)',
};
const J = x => x == null ? '—' : typeof x === 'string' ? x : JSON.stringify(x).replace(/"/g, '').replace(/,(?! )/g, ', ');
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
    '### 1. Timing: shown = where it is triggered ∪ where its effect is used', '',
    'Trigger: the phases and moments the text names (stratagems: the first sentence of WHEN, nothing else).', '',
    ...OWNER_RULES.map(r => '- `' + r.id + '`: ' + r.why),
    ...NOT_TIMING.map(r => '- `skip-' + r.id + '`: ' + r.why), '- `' + NOTE_LINE.id + '`: ' + NOTE_LINE.why,
    ...MOMENT_RULES.map(r => '- `' + r.id + '`: ' + r.why + (r.at ? ' → at "' + r.at + '"' : '')),
    '', 'Used in: what the effect does, sentence by sentence and clause by clause (a sentence about the unit being attacked is read by the `targeted` rules only):', '',
    ...ACTIVITY_RULES.map(r => '- `' + r.id + '`: ' + r.why + (r.ph ? ' → ' + J(r.ph) : '')),
    ...USED_MODIFIERS.map(r => '- `' + r.id + '`: ' + r.why), '',
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
        '- stored: `' + J(it.stored) + '`', '- derived: `' + J(it.derived) + '`' + (it.trigger !== undefined ? ' = trigger `' + J(it.trigger) + '` ∪ used in `' + J(it.used) + '`' : ''),
        '- rules: ' + (it.reasons.length ? it.reasons.map(r => (r.part ? r.part + ' ' : '') + '`' + r.rule + '` "' + clip(r.match, 100) + '"').join(' · ') : '—'));
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
      (it.comments && it.comments.length ? ' · data.js: "' + clip(it.comments.join(' '), 200) + '"' : '') + ' · text: "' + clip(plain(it.text).replace(/\n/g, ' / '), 160) + '"');
    lines.push('');
    const id = g.filter(x => x.status === 'identical');
    lines.push('### (a) Identical (' + id.length + ')', '', id.map(it => it.where.replace(/^[^·]+ · /, k.startsWith('ability') || k.startsWith('unit') ? '' : '$&').trim() + ' `' + J(it.derived) + '`').join(' · '), '');
  }
  // would change on screen
  const wc = wouldChange(items), vis = wc.filter(x => x.visible);
  const seenW = new Map();
  for(const x of wc){ const k = x.kind + x.where.split(' · ').pop() + JSON.stringify(x.change) + x.before; if(!seenW.has(k)) seenW.set(k, Object.assign({}, x, { places:[x.where] })); else seenW.get(k).places.push(x.where); }
  lines.push('## Would change on screen (' + vis.length + ' places, ' + [...seenW.values()].filter(x => x.visible).length + ' entries; not applied)', '',
    'The plain inconsistencies: the same words stored differently on different lists, and a tag or moment the text gives that the label lacks. Each is set to the derived value here and shown as the ability row would show it (the app\'s own whenTag / shortWhen / onceTag). Every one changes what a screen shows, so none is applied to data.js: the owner decides. (Invisible ones would be applied: ' + (wc.length - vis.length) + '.)', '');
  for(const x of seenW.values()) lines.push('- **' + x.where + '**' + (x.places.length > 1 ? ' (+' + (x.places.length - 1) + ': ' + x.places.slice(1).map(p => p.split(' · ')[0]).join(', ') + ')' : '') + ': `' + J(x.change) + '` · before: ' + x.before + ' → after: ' + x.after + ' · ' + x.why + ' · text: "' + clip(plain(x.text).replace(/\n/g, ' / '), 160) + '"');
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------
// "would change on screen": the plain inconsistencies (the same words stored differently; a tag or moment the text gives and
// the label lacks), each set to the derived value, and what the ability's row would show before and after. The app's own
// whenTag / shortWhen / onceTag (from app.html) say what is shown. Nothing here is applied to data.js.
// ---------------------------------------------------------------------------------------------
function screenFns(){
  const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  const grab = re => { const m = re.exec(html); if(!m) throw new Error('app.html: ' + re); return m[0]; };
  const fn = name => { const m = new RegExp('\\n(function ' + name + '\\(|const ' + name + ' = )').exec(html); const rest = html.slice(m.index + 1), end = rest.slice(1).search(/\n(function |const |let |\/\/ |\/\*)/); return rest.slice(0, end + 1); };
  const src = [grab(/const PHASES = [^\n]*/), grab(/const PHASE_NAME = [^\n]*/), grab(/const TURN_NAME = [^\n]*/), grab(/const PHASE_SHORT = [^\n]*/),
    fn('phasesOf'), fn('phTurn'), fn('whenTag'), fn('shortWhen'), fn('onceTag')].join('\n');
  return new Function(src + '\nreturn { whenTag, shortWhen, onceTag };')();
}
function screenOf(F, ab){
  const once = F.onceTag(ab), row = (ab.ph && !ab.na ? F.shortWhen(ab) : '');
  const meta = [ab.tag, ab.ph ? F.whenTag(ab) : ''].filter(Boolean).join(' · ');
  return ['row: ' + [ab.tag === 'Enhancement' ? '[Enhancement]' : '', once ? '[' + once + ']' : '', row].filter(Boolean).join(' '), 'opened: ' + (meta || '—')].join(' | ');
}
function wouldChange(items){
  const F = screenFns(), out = [];
  const ab = items.filter(it => it.ab);
  const at = new Set(MOMENT_RULES.filter(r => r.at).map(r => r.at.toLowerCase()));
  const propose = (it, change, why) => {
    const before = screenOf(F, it.ab), after = screenOf(F, Object.assign({}, it.ab, change));
    for(const k of Object.keys(change)) if(change[k] === undefined) delete change[k];
    out.push({ where:it.where, kind:it.kind, change, before, after, visible:before !== after, why, text:it.ab.text, reasons:it.reasons });
  };
  // the same words stored differently: the copies in the minority take the majority's label
  const groups = new Map();
  for(const it of ab.filter(x => x.kind === 'ability-timing')){ const k = it.ab.name + '\n' + it.ab.text; if(!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
  for(const g of groups.values()){
    const by = new Map(); for(const it of g){ const k = JSON.stringify(it.stored); if(!by.has(k)) by.set(k, []); by.get(k).push(it); }
    if(by.size < 2) continue;
    const ranked = [...by.entries()].sort((x, y) => y[1].length - x[1].length);
    if(ranked[0][1].length === ranked[1][1].length) continue;
    const major = JSON.parse(ranked[0][0]);
    for(const [, its] of ranked.slice(1)) for(const it of its) propose(it, { at:major.at, ph:major.ph, turn:major.turn, turns:major.turns }, 'the same words are stored as ' + J(major) + ' on ' + ranked[0][1].length + ' other lists');
  }
  for(const it of ab){
    if(it.kind === 'ability-tag' && it.status === 'different'){
      const keep = (it.notDerivableParts || []);
      const tag = [...new Set([].concat(it.derived ? it.derived.split(/, (?!per )/) : [], keep))].join(', ');
      propose(it, { tag }, 'the tag the text gives (' + it.reasons.map(r => r.rule).join(', ') + ')');
    }
    if(it.kind === 'ability-timing' && it.status === 'different' && it.derived){
      const sm = storedMap(it.ab), dm = Object.fromEntries((it.derived.ph || []).map(p => [p, (it.derived.turns && it.derived.turns[p]) || it.derived.turn]));
      const tagMoment = it.ab.tag && at.has(it.ab.tag.toLowerCase());
      if(mapKey(sm) === mapKey(dm) && (it.ab.at || '') !== (it.derived.at || '')) propose(it, { at:it.derived.at }, 'the text opens with the moment "' + it.derived.at + '"');
      else if(tagMoment && it.derived.at && it.derived.at.toLowerCase() === it.ab.tag.toLowerCase())
        propose(it, { tag:undefined, at:it.derived.at, ph:it.derived.ph, turn:it.derived.turn, turns:it.derived.turns }, 'its tag is the moment the text opens with; as `at`, like Methodical Destruction');
    }
  }
  return out;
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
    writeJSON(path.join(out, 'derive.json'), { counts:c, wouldChangeOnScreen:wouldChange(items), rules:{ owner:OWNER_RULES.map(r => r.id), notTiming:NOT_TIMING.map(r => r.id), moments:MOMENT_RULES.map(r => r.id), used:ACTIVITY_RULES.map(r => r.id).concat(USED_MODIFIERS.map(r => r.id)), needs:Object.keys(NEEDS_RULES), tags:TAG_RULES.map(r => r.id), coverage:['aura-reach'].concat(BONUS_RULES.map(b => b.id), DEF_RULES.map(b => b.id)) },
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
module.exports = { derive, timing, explicitTiming, stratNeeds, ruleNeeds, canonNeeds, OWNER_RULES, NOT_TIMING, MOMENT_RULES, ACTIVITY_RULES, USED_MODIFIERS, NEEDS_RULES, TAG_RULES, BONUS_RULES, DEF_RULES };
