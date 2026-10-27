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
  { id:'until',          re:new RegExp('\\buntil the (?:start|end) of (?:your opponent\'s next |your opponent\'s |your next |your |the next |the |that )?(?:' + PHW + ' phase|turn|battle round|battle|phase)\\b', 'gi'), why:'a duration ("until the start of your next Command phase", "… of your opponent\'s next Command phase"), not when it is used' },
  { id:'once-per-phase', re:new RegExp('\\b(?:once|twice) per ' + PHW + ' phase\\b', 'gi'), why:'a limit ("once per Command phase"), not a timing' },
];
// moments that are not a phase
const MOMENT_RULES = [
  { id:'any-phase', re:/\b(?:(?:at the )?(?:start|end) of )?any phase\b|(?:^|[.!?]\s+)at the (?:start|end) of (?:a|each) phase\b/i, ph:Object.fromEntries(PH.map(p => [p, 'either'])),
    why:'"any phase" / "the start of any phase" / a text opening "At the end of a phase" (Blood Tainted) or "At the end of each phase" (not "… until … at the end of a phase", a duration): every phase of both turns' },
  { id:'start-battle-round-first', re:/^(?:(?:once per battle|if your army faction is [^,]+), )?at the start of the first battle round\b/i, at:'Start of the first battle round', ph:{ command:'either' },
    why:'the text opens with "At the start of the first battle round": a moment before the first Command phase (07.01)' },
  { id:'start-battle-round', re:/^(?:(?:once per battle|if your army faction is [^,]+), )?at the start of the battle round\b/i, at:'Start of the battle round', ph:{ command:'either' },
    why:'the text opens with "At the start of the battle round": a moment before either player\'s Command phase (07.01)' },
  { id:'start-battle-round-later', re:/\b(?:at the )?start of the (?:first )?battle round\b/i, ph:{ command:'either' },
    why:'"the start of the battle round" later in the text: listed with the Command phase, no moment tag (the text does not open with it)' },
  { id:'start-your-command', rulesOnly:true, re:/^at the start of your command phase\b/i, at:'Start of your Command phase', ph:{ command:'your' },
    why:'an army or detachment rule whose text opens with "At the start of your Command phase": the moment its choice is made, before anything else in that phase (Martial Ka’tah, Combat Doctrines); not read on abilities or rule options' },
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
  { id:'targeted', def:true, re:/\b(?:a|an enemy) model makes an attack that targets this (?:model|unit)\b|(?<!\bmakes? (?:ranged |melee )?|\bmakes? (?:an?|its) (?:ranged |melee )?|\b(?:unit|model|bearer)'s )\b(?:an attack|attacks?) (?:that )?(?:targets?|is made against) (?:this|the bearer|that unit|it)\b|\b(?:is|are) allocated to (?:this|the bearer|that model)\b|\bmade against this\b|\binvulnerable save\b|\binsv\b|\bsave characteristic\b|\bsaving throws?\b|\bsave rolls?\b|\bfeel no pain\b/i, ph:TARGETED,
    why:'it protects the unit when it is attacked (a save, an invulnerable save, Feel No Pain, a modifier to attacks on it; "each time a model makes an attack that targets this model", Beguiling Form): the attacker\'s phases (their Shooting phase, the Fight phase). Not the unit\'s own attacks: "this model makes an attack that targets that unit" is an attack it makes' },
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
  { id:'any-attack', re:/(?<!\b(?:a|an enemy) model )\bmakes? an attack\b(?! with an? (?:ranged|melee) weapon)|\b(?:unit|model|bearer)'s attacks\b|\battacks made (?:with|by) (?:this|the bearer)|\bselected to shoot or fight\b/i, ph:{ shooting:'your', fight:'either' }, shoots:true,
    why:'"makes an attack" (ranged or melee): your Shooting phase and the Fight phase' },
  { id:'charge-move', re:/\bcharge (?:rolls?|moves?)\b|\bends a charge\b|\bmakes a charge\b/i, ph:{ charge:'either' },
    why:'charge rolls / charge moves: the Charge phase (either turn: a Heroic Intervention is a charge move too)' },
  { id:'declare-charge', re:/\bdeclares? a charge\b|\beligible to declare a charge\b/i, ph:{ charge:'your' },
    why:'"declare a charge": your Charge phase' },
  { id:'move-enemy', re:/\benemy unit\b[^.]*\b(?:ends a (?:normal |advance |fall back )?move|(?:selected|chosen) to fall back|falls back|makes? a (?:normal|advance|fall back) move)\b/i, ph:{ movement:'opp' },
    why:'an enemy unit moving / Falling Back ("each time an enemy unit … Falls Back"): your opponent\'s Movement phase' },
  { id:'move-own', re:/\b(?:normal|advance|fall[- ]back|pulse jet|ingress) moves?\b|\badvance (?:and charge )?rolls?\b|\bselected to (?:move|advance)\b|\bmove characteristic\b|\b(?:advanced|fell back|falls back|remains stationary)\b|\+\d+" m\b/i, ph:{ movement:'your' },
    why:'its own moves (Normal, Advance, Fall Back), advance rolls, its Move characteristic: your Movement phase' },
];
// modifiers on the phases above
const USED_MODIFIERS = [
  { id:'after-charge', re:/\bmade a charge move this turn\b/i,
    why:'"made a charge move this turn": a condition, not a move; only the Fight phase is left in that turn (its attacks are not in the Shooting phase)' },
  { id:'overwatch', why:'an always-on ranged effect (no trigger in the text) is also used when the unit shoots with a Core stratagem whose EFFECT is "Your unit shoots" (Fire Overwatch: its WHEN, your opponent\'s Movement phase); when it protects against ranged attacks, the same moment in the other turn (the enemy\'s Fire Overwatch)' },
  { id:'phase-locked', re:/\[HEAVY\]/i,
    why:'[HEAVY] works "In your Shooting phase" only (Core Rules 24.16), so it is phase-locked (07.02.01) and not used with Fire Overwatch: a clause that gives only [HEAVY] adds no Overwatch' },
  { id:'trigger-phase', why:'an effect used in the phase it is triggered in has the trigger\'s turn ("In your opponent\'s Movement phase, … this unit can make a Normal move": the opponent\'s Movement phase only)' },
  { id:'opening-phase', re:/^in (?:the|your|your opponent's) (?:command|movement|shooting|charge|fight) phase,/i,
    why:'the text opens with its phase ("In the Fight phase, when this unit is selected to fight or when an enemy unit targets this unit, …") and says no duration: every effect is used in that phase only (Bladeguard\'s -1 to hit rolls for attacks that target it is not used in the Shooting phase)' },
  { id:'same-phase', re:/\buntil the end of the phase\b/i,
    why:'triggered in a phase with an effect "until the end of the phase": used in that phase only (Destiny\'s Ruin: manifested at the start of your Shooting phase, so its attacks are that phase\'s)' },
  { id:'same-turn', re:/\buntil the end of the turn\b|\bthis turn\b/i,
    why:'triggered in one player\'s turn with an effect "until the end of the turn": used in that turn only, from the trigger\'s phase on' },
];
const AFTER_CHARGE = USED_MODIFIERS[0];

const addPh = (out, p, t) => { out[p] = out[p] && out[p] !== t ? 'either' : t; };
const OTHER = { your:'opp', opp:'your', either:'either' };
// phases named in the text (table 1, explicit part); null when it names none
function explicitTiming(text, opts){
  let t = plain(rulesText(text));
  const reasons = [], out = {}, named = new Set();
  let at, atPh = [];
  // the moment a text opens with comes after an enhancement's "X model only." and a tag in brackets ("IMPERIAL KNIGHTS model only.
  // (Once per battle, per army) At the end of your opponent’s turn, …": Mysterious Guardian): those are who may take it and how often
  const tm = t.replace(/^[A-Z][A-Z0-9 '’/-]*? (?:models?|units?|characters?) only\.\s+(?:\([^)]*\)\s+)?/, '');
  for(const r of MOMENT_RULES){
    if(r.rulesOnly && !(opts && opts.rule)) continue;
    const m = r.re.exec(r.re.source[0] === '^' ? tm : t);
    if(!m) continue;
    if(r.id === 'start-battle-round-later' && at) continue;      // already the opening moment
    if(r.id === 'start-battle-round' && at) continue;
    if(r.at){ at = r.at; atPh = Object.keys(r.ph); }
    for(const [p, o] of Object.entries(r.ph)) addPh(out, p, o);
    reasons.push({ rule:r.id, match:m[0] });
    if(r.id === 'any-phase') t = t.replace(r.re, ' ');
  }
  if(!(opts && opts.keepDurations)) for(const r of NOT_TIMING) t = t.replace(r.re, m => { reasons.push({ rule:'skip-' + r.id, match:m }); return ' '; });
  t = t.replace(/\bstart of the (?:first )?battle round\b/gi, ' ');
  PHASE_RE.lastIndex = 0;
  for(let m; (m = PHASE_RE.exec(t));){
    const own = OWNER_RULES.find(o => o.re.test(m[1] || ''));
    for(const p of m[2].toLowerCase().split(/\s*\/\s*|\s*,\s*|\s+or\s+|\s+and\s+/)){ addPh(out, p, own.turn); named.add(p); }
    reasons.push({ rule:own.id, match:m[0] });
  }
  // atOnly: the phases only the opening moment gives ("At the start of the battle round": listed with the Command phase)
  return Object.keys(out).length ? { ph:out, at, reasons, atOnly:atPh.filter(p => !named.has(p)) } : null;
}

const PHASE_LOCKED = USED_MODIFIERS.find(r => r.id === 'phase-locked');
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
            const w = timing(other, { core:ctx.core, noStrat:ctx.noStrat });
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
        if(r.blocker){ if(ctx && ctx.noStrat) continue; if(!((ctx && ctx.core) || []).some(cs => cs.name.toLowerCase() === m[1].toLowerCase())) blocked = { rule:r.id, match:m[0] }; continue; }
        if(r.none){ none = none || { rule:r.id, match:m[0] }; continue; }
        if(r.id === 'any-stratagem' && reasons.some(x => x.rule === 'named-core-stratagem')) continue;
        if(r.id === 'any-stratagem' && ctx && ctx.noStrat) continue;   // (the checklist: no phase reached through a stratagem)
        if(r.id === 'move-own' && /\benemy unit\b/i.test(s) && ACTIVITY_RULES.find(x => x.id === 'move-enemy').re.test(s)) continue;
        // (a clause whose only weapon ability is [HEAVY]: phase-locked, no Overwatch from it)
        const locked = PHASE_LOCKED.re.test(s) && !/\[(?!HEAVY\])/i.test(s) && !/\bBS\b|\bballistic skill\b|\bhit roll/i.test(s);
        if(locked && !reasons.some(x => x.rule === 'phase-locked')) reasons.push({ rule:'phase-locked', match:'[HEAVY]' });
        if(r.shoots && !locked && !(afterCharge && r.id === 'any-attack')) shoots = true;
        add(r.ph, r);
        reasons.push({ rule:r.id, match:m[0] });
      }
    }
  }
  if(afterCharge && reasons.some(r => r.rule === 'any-attack' || r.rule === 'weapons-have')) reasons.push({ rule:'after-charge', match:afterCharge[0] });
  // Fire Overwatch: an always-on effect only (a triggered one lasts from its trigger; one that lasts "until the end of the turn" is
  // triggered in that turn, even when derive.js reads no trigger in its words: Shudderblink's [ASSAULT] after an advance move)
  if(!trig && (shoots || guarded) && !USED_MODIFIERS.find(r => r.id === 'same-turn').re.test(t)){
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
  // the text opens with its phase and has no duration ("In the Fight phase, …, you can select one of the following"): that phase only
  const opening = USED_MODIFIERS.find(r => r.id === 'opening-phase').re.exec(t);
  if(trig && opening && !/\buntil\b|\bthis turn\b/i.test(t) && Object.keys(out).some(p => !trig.ph[p])){
    for(const p of Object.keys(out)) if(!trig.ph[p]) delete out[p];
    reasons.push({ rule:'opening-phase', match:opening[0] });
  }
  // triggered in a phase, "until the end of the phase": that phase only
  const samePh = USED_MODIFIERS.find(r => r.id === 'same-phase').re.exec(t);
  if(trig && samePh && Object.keys(out).length && Object.keys(out).some(p => !trig.ph[p])){
    for(const p of Object.keys(out)) if(!trig.ph[p]) delete out[p];
    reasons.push({ rule:'same-phase', match:samePh[0] });
  }
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
  const trig = explicitTiming(text, ctx && ctx.rule ? { rule:true } : undefined);
  const used = usedIn(text, ctx, trig);
  const ph = Object.assign({}, trig ? trig.ph : {});
  for(const [p, o] of Object.entries(used.ph)) addPh(ph, p, o);
  const reasons = (trig ? trig.reasons.map(r => Object.assign({ part:'trigger' }, r)) : []).concat(used.reasons.map(r => Object.assign({ part:'used' }, r)));
  const trigLabel = trig ? asLabel(trig.ph, trig.at) : null, usedLabel = Object.keys(used.ph).length ? asLabel(used.ph) : null;
  if(Object.keys(ph).length || (trig && trig.at)) return { how:trig ? 'explicit' : 'activity', ph, at:trig && trig.at, reasons, trigger:trigLabel, used:usedLabel, trigPh:trig && trig.ph, usedPh:used.ph, atOnly:trig ? trig.atOnly : [] };
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
// the sentences after the first unit's that open with a friendly unit phrase of keywords ("X units from your army …"), as needs
function ruleSubjects(V, text, first){
  const out = [], firstS = sentences(text).findIndex(x => prepBold(x).includes(first.matched));
  sentences(text).forEach((sen, i) => {
    if(i <= firstS) return;
    const u = friendlyUnit(V, sen, { keyword:true });
    if(!u || u.at > 2 || !/^\s*'?\s*from your army\b/i.test(u.after)) return;
    const n = needsOf(V, u, []);
    if(!n.bad) out.push({ unit:u, n });
  });
  return out;
}
function ruleNeeds(V, r){
  const reasons = [];
  const unit = friendlyUnit(V, rulesText(r.text), { keyword:true });
  if(unit){
    reasons.push({ rule:'first-unit', match:clip(plain(unit.matched), 80) });
    let n = needsOf(V, unit, reasons);
    if(n.bad) return { how:'none', reasons:[{ rule:'unparsed', match:n.bad }] };
    // every other sentence whose subject is a friendly unit phrase ("**SOUL FORGE** units from your army have a 5+ invulnerable
    // save."): the rule reaches those units too, so its needs are the "or" of them all (Soul Forge Boons: three sentences)
    const more = ruleSubjects(V, rulesText(r.text), unit);
    if(more.length){
      const alts = [n].concat(more.map(x => x.n));
      // (one alternative per keyword of an "any": HERETIC ASTARTES VEHICLE, LORD DISCORDANT and VASHTORR THE ARKIFANE)
      const sets = []; for(const a of alts) for(const k of (a.any.length ? a.any : [null])){ const x = a.all.concat(k ? [k] : []); if(!sets.some(y => y.join('|') === x.join('|'))) sets.push(x); }
      const c = sets.length > 1 ? combineAlts(sets) : { all:sets[0], any:[], rules:[] };
      if(!c.bad && alts.every(a => !a.none.length && !a.rule)){
        n = { all:c.all, any:c.any, none:[] };
        reasons.push(...more.map(x => ({ rule:'more-subjects', match:clip(plain(x.unit.matched), 80) })), { rule:c.rules.join('+') || 'kw-all', match:sets.map(x => x.join(' ')).join(' | ') });
      }
    }
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
  // Aura is GW's tag, never the wording: Core Rules 22.01, aura abilities "are tagged with the word 'Aura'". GW's tag is part of
  // the printed name ("Final Howl (Aura)"); otherwise it is the "(Aura)" New Recruit prints after the name, which data.js keeps as
  // the tag and verify/nr.js checks against the PDF, so it is a part the text cannot give (like Psychic)
  { id:'tag-aura-name', name:/\(Aura\)/i, give:'Aura', why:'the ability\'s name as GW prints it says "(Aura)" (Core Rules 22.01: aura abilities are tagged with the word "Aura"); never derived from wording such as "within 6" of this model". An "(Aura)" New Recruit prints after the name is GW\'s tag the text cannot give: kept as stored, checked by verify/nr.js' },
  { id:'tag-bondsman', re:/^while a model is affected by this ability\b/i, give:'Bondsman',
    why:'"While a model is affected by this ability": the wording of a Bondsman ability (the Bondsman army rule: "affected by that Bondsman ability")' },
  { id:'tag-capacity', re:/\btransport capacity of \d+/i, give:'Capacity', why:'"has a transport capacity of N": the Transport ability' },
  { id:'tag-once', re:/^(?:[^.]*? (?:model|unit) only(?: \([^)]*\))?\. )?[^.]*?\(?\b(once per (?:battle round|battle|turn|phase)(?:, per (?:army|unit))?)\b/i, once:true,
    why:'"Once per …" in the opening sentence (after a "X model only." prefix): that limit (the app\'s onceTag reads the same words from the text, so the row shows it either way)' },
];
// a stored tag in parts: "Once per turn, twice per battle, per unit" is one part; "Aura, Psychic" two
function tagParts(tag){
  const out = [];
  let t = String(tag || '');
  // (a "Once per …" part anywhere: "Aura · Once per turn")
  for(const seg of t.split(' · ')){
    const once = /^(?:once|twice) per [a-z ]+(?:, (?:once|twice) per [a-z ]+)?(?:, per (?:army|unit))?/i.exec(seg);
    if(once){ out.push(once[0]); t = t.replace(once[0], '').replace(/^\s*(?:,| · )\s*|\s*(?:,| · )\s*$/g, ''); }
  }
  for(const p of t.split(/\s*(?:,| · )\s*/)) if(p) out.push(p);
  return out;
}
const DERIVABLE_TAG = (p, ab) => /^(Enhancement|Upgrade|Bondsman|Capacity)$/.test(p) || /^(once|twice) per /i.test(p) || (p === 'Aura' && !!ab && /\(Aura\)/i.test(ab.name));
function abilityTag(ab, ctx){
  const reasons = [], parts = [];
  const en = (ctx.enh || []).find(e => e.name === ab.name);
  if(en){ parts.push(en.upgrade ? 'Upgrade' : 'Enhancement'); reasons.push({ rule:'tag-enhancement', match:(en.upgrade ? 'upgrade ' : 'enhancement ') + en.name }); }
  const t = plain(ab.text);
  for(const r of TAG_RULES.slice(1)){
    const m = r.name ? r.name.exec(ab.name) : r.re.exec(r.once ? (sentences(t)[0] || '') + ' ' + ((/^[^.]+ (?:model|unit) only(?: \([^)]*\))?\.(?: |$)/i.test(sentences(t)[0] || '') && sentences(t)[1]) || '') : t);
    if(m && parts.includes(r.give)) continue;
    if(!m) continue;
    if(r.once){ const o = m[1]; parts.push(o[0].toUpperCase() + o.slice(1)); }
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

// the options inside a rule or ability: its table's rows, "**Name:** effect" lines, a bullet "**Name**" and the line under it
// (t: the text without its italic notes, rulesText)
function optionsOf(t, table){
  const opts = [];
  for(const row of table || []) opts.push({ name:String(row[0]).split(' · ')[0].replace(/ \((?:Aura|Psychic)\)$/, ''), text:row[1], how:'table row', row:row[0] });
  const lines = t.split('\n');
  lines.forEach((l, i) => {
    let m = /^(?:- )?\*\*([^*]{3,60}?)(?::\*\*|\*\*:)\s*(.+)$/.exec(l);
    if(m && !isUpperWord(m[1].replace(/[^A-Za-z]/g, '') || 'a')) { opts.push({ name:m[1].trim(), text:m[2], how:'"**Name:** effect"' }); return; }
    m = /^- \*\*([^*]{3,60})\*\*\s*$/.exec(l);
    if(m && lines[i + 1] && !/^\s*- /.test(lines[i + 1]) && !/^\s*\*\*[^*]+\*\*\s*$/.test(lines[i + 1])) opts.push({ name:m[1].replace(/\s*\[[^\]]*\]$/, '').trim(), text:lines[i + 1], how:'bullet "**Name**" and its line' });
  });
  // a rule with no table whose options are headings of their own, each followed by its text: a bold line ("**Furor Tactics**",
  // Wahapedia's sub-heading: Mission Tactics) or, when it has none, a line in capitals ("ASSAULT DOCTRINE": Combat Doctrines)
  if(!opts.length && !(table || []).length){
    const heads = (re, how) => { const out = [];
      lines.forEach((l, i) => { const m = re.exec(l.trim()), nx = lines[i + 1];
        if(m && nx && !re.test(nx.trim()) && !/^\s*- /.test(nx) && /[a-z]/.test(nx)) out.push({ name:m[1].trim(), text:nx, how }); });
      return out; };
    const bold = heads(/^\*\*([^*]{3,60})\*\*$/, 'heading "**Name**" and its line');
    opts.push(...(bold.length ? bold : heads(/^([A-Z][A-Z’'-]+(?: [A-Z’'-]+)+)$/, 'heading in capitals and its line')));
  }
  // army-building limits ("**Incursion:** Up to 500 pts") are not options, and nor is a worked example ("**Example:** …", Martial Ka'tah)
  // or a designer's note ("**Designer’s Note:** When using fast dice rolling, …", Fates in Flux)
  for(let i = opts.length - 1; i >= 0; i--) if(/^up to \d+ ?pts\b/i.test(plain(opts[i].text)) || /^examples?$/i.test(opts[i].name) || /^designer['’]s note$/i.test(opts[i].name)) opts.splice(i, 1);
  return opts;
}

// ---- the checklist table (data.js CHECKLIST) ----
// a rule's or ability's own text without its options (each option has its own entry)
const withoutOptions = (text, table) => { const t = rulesText(text);
  // an option that ends in a list ("select one of the following to apply …:", Unnatural Fortitude) takes the "- " lines under it
  const cut = (s2, o) => { const i = s2.indexOf(o.text); if(i < 0) return s2; let j = i + o.text.length;
    if(/:\s*$/.test(o.text)){ const m = /^(?:\n- (?!\*\*[^*\n]+?:?\*\*:?)[^\n]*)+/.exec(s2.slice(j)); if(m) j += m[0].length; }
    return s2.slice(0, i) + s2.slice(j); };
  return optionsOf(t, table).reduce(cut, t).replace(/^(?:- )?\*\*Examples?(?::\*\*|\*\*:).*$/gim, ''); };
const phStr = m => m ? PH.filter(p => m[p]).map(p => p + ':' + m[p]).join(',') : '';
// The checklist's scope, a fixed rule (s: listed): a rule, ability or option whose own words (without its options' words, durations
// and italic notes) have, in one sentence with no unit activation in it, a fixed moment of the game sequence: the start or end of a
// battle round, turn or phase ("At the start of the battle round", "At the end of your Command phase", "WHEN: Start of the Fight
// phase"), or a Command phase ("In your Command phase, you can …", "WHEN: Your Command phase"), or another phase with a choice
// ("In your Movement phase, you can select …"). Unit activation (remembered from that unit's datasheet): "selected to …", "each time /
// when this (or a) unit or model …", "this unit's move / attacks", "makes an attack / a charge / a move", "is targeted", "targets this",
// "destroys", "is destroyed", "the first time". An option without such a sentence is listed with its rule (what the rule puts in
// force: a Blessing of Khorne) unless its own WHEN line is a unit activation (a: Calistus, "WHEN: … selected to move"). Once-per-battle uses are listed too
// (the app's perBattle), and an item derive cannot place with a moment data.js stores (at: Icon of Khorne).
const SEQ = {
  moment:/\b(?:start|end) of (?:the |your |your opponent['’]s |each |every |any |that |a )?(?:first |next )?(?:battle round|turn|(?:command|movement|shooting|charge|fight) phase|phase)\b/i,
  command:/\b(?:your |your opponent['’]s |the |each |either player['’]s )command phase\b/i,
  choice:/\b(?:your |your opponent['’]s |the |each |either player['’]s )?(?:movement|shooting|charge|fight) phase,?[^.]*?\b(?:you can|select|choose)\b/i,
  activation:/\bselected to\b|\beach time (?:this|that|the|a|an|your) [^.,]*?\b(?:unit|model|bearer)\b|\bwhen (?:this|that|the|a|an|your) [^.,]*?\b(?:unit|model|bearer)\b[^.,]*?\b(?:is|are|makes?|ends?|has|have|was)\b|\b(?:this|that|the bearer['’]?s?) (?:unit|model)['’]s (?:move|attacks?)\b|\bmakes? an? (?:attack|charge|move)\b|\bis targeted\b|\btargets? (?:this|that|the bearer)\b|\bafter (?:this|that|the) (?:unit|model|bearer)\b[^.,]*?\bhas (?:shot|fought|moved|charged)\b|\bdestroys?\b|\bfirst time\b/i,
};
function seqTrigger(text){
  // paragraph by paragraph: in one that opens with a unit activation ("Each time … is selected to shoot or fight", Warpmeld
  // Sacrifice, Daemonic Patrons), a later moment is that activation's ("At the end of the phase, that unit suffers D3 mortal wounds")
  // unless it is a choice of its own ("At the start of the Command phase, you can spend", Blood Tithe); sentence by sentence, with durations ("until the
  // start of your next Command phase"), once-per-phase limits and a moment named only as a past reference ("a unit it was within
  // Engagement Range of at the start of the turn", Thrill Seekers) left out
  const PAST = /\b(?:was|were)\b[^.;:]*?\b(?:at the )?(?:start|end) of (?:the|that) (?:turn|phase|battle round)\b/gi;
  return plain(rulesText(text)).split(/\n+/).some(par => {
    const ss = sentences(par).map(x => NOT_TIMING.reduce((y, r) => y.replace(r.re, ' '), x).replace(PAST, ' '));
    const opensAct = ss.length && SEQ.activation.test(ss[0]);
    // (a sentence that opens with its moment, "At the start of your opponent's Shooting phase, select one enemy unit … : until the end of the
    // phase, each time a model in that enemy unit makes an attack, …" (Mischief and Confusion): the activation after it is its effect's)
    const opensMoment = x => /^\W*at the (?:start|end) of\b/i.test(x) && SEQ.moment.test(x) && x.search(SEQ.moment) < x.search(SEQ.activation);
    return ss.some(x => (SEQ.moment.test(x) || SEQ.command.test(x) || SEQ.choice.test(x)) && (!SEQ.activation.test(x) || opensMoment(x)) && (!opensAct || /\b(?:you can|select|choose)\b/i.test(x)));
  });
}
// a unit activation as the item's own trigger: its WHEN line; or a first sentence opening with "When" (Diabolic Power: "When this unit is
// selected to shoot or fight"), or with a "when / each time / after … selected to …" clause in it (Pulse Jet: "In your Movement phase,
// when this unit is selected to move"; Overwhelming Wrath: "Each time an enemy unit … is selected to Fall Back"). An effect's "Each
// time a model in this unit makes …" (a Blessing of Khorne) is not its trigger
function actOf(text){
  const p = plain(rulesText(text)), when = /^\W*WHEN:\W*(.*)$/im.exec(p), first = sentences(p)[0] || '';
  // (and an enemy's attack on it: "Each time a model makes an attack that targets this model", Beguiling Form, is triggered by the attacker)
  return when ? SEQ.activation.test(when[1]) : (/^\W*when\b/i.test(first) && SEQ.activation.test(first)) || /\b(?:when|whenever|each time|after)\b[^.]*?\bselected to\b/i.test(first)
    || /^each time (?:a|an enemy) model makes an attack that targets this (?:model|unit)\b/i.test(first);
}
// what a listed ability selects among ("select one of the abilities in the X section", "select one X ability": the app's pickOptions)
// is in force for the duration its words give from where it is triggered (pk, coverOf), or x
function pickCover(text, e){
  const t = plain(rulesText(text));
  if(!/\bselect one of the abilities in the .+? section\b|\bselect one [^.,;]+? ability\b/i.test(t)) return null;
  // the first duration in its words (not the first in DURATIONS' order: "this turn" would win over a later-listed "until the start of your next Command phase")
  const d = DURATIONS.map(x => ({ id:x.id, i:t.search(x.re) })).filter(x => x.i >= 0).sort((a, b) => a.i - b.i)[0];
  return coverOf(d && d.id, e);
}
// the duration a rule's or ability's own words give its options (oc): coverOf on the first duration in its own words, from where it is
// triggered, when it has options; null when none is read
function optCover(text, own, table, e){
  if(!optionsOf(rulesText(text), table).length) return null;
  // the first "until …" duration in its own words (a bare "this turn", Cabal of Sorcerers' "not yet attempted a Ritual this turn", is not one)
  const t = plain(own), d = DURATIONS.map(x => ({ id:x.id, i:[...t.matchAll(new RegExp(x.re.source, 'gi'))].filter(m => /^until\b/i.test(m[0])).map(m => m.index)[0] }))
    .filter(x => x.i >= 0).sort((a, b) => a.i - b.i)[0];
  if(!d) return null; const c = coverOf(d.id, e); return c.u ? c : null;
}
// a protection against mortal wounds (a Feel No Pain or a save "against … mortal wounds", Enraged Abjuration) is used whenever mortal
// wounds are suffered: every phase of both turns
const MORTAL_GUARD = /\b(?:feel no pain|invulnerable save|saving throws?|save)\b[^.]*\bmortal wounds\b/i;
const EVERY_PHASE = PH.map(p => p + ':either').join(',');
// … within a duration the same words give: the first "until …" duration, from where it is triggered (coverOf); none: every phase;
// one read that covers no phase: null (its use as table 1 reads it)
function mortalUse(text, e){
  const t = plain(rulesText(text)), d = DURATIONS.map(x => ({ id:x.id, i:[...t.matchAll(new RegExp(x.re.source, 'gi'))].filter(m => /^until\b/i.test(m[0])).map(m => m.index)[0] }))
    .filter(x => x.i >= 0).sort((a, b) => a.i - b.i)[0];
  if(!d) return EVERY_PHASE;
  const c = coverOf(d.id, e); return c.u || null;
}
// the checklist reads where an effect is used without the stratagems (the checklist has none): no phase reached through Fire Overwatch,
// a core stratagem the text names, or "targeted with a Stratagem" (ckCtx)
const ckCtx = c => Object.assign({}, c, { core:[], noStrat:true });
// the end moments a text names as when something is checked or done ("This Deed is completed at the end of a turn"): ends
const endsOf = text => { const t = plain(rulesText(text)).replace(/\buntil the (?:start|end) of [^,.;]*/gi, ' '), out = new Set();
  for(const m of t.matchAll(/\bat the end of (a|your|your opponent['’]s|the) (turn|battle round)\b/gi)){
    const w = m[1].toLowerCase();
    if(m[2].toLowerCase() === 'battle round') out.add('End of the battle round');
    else if(w === 'a' || w === 'the') { out.add('End of your turn'); out.add('End of your opponent’s turn'); }
    else out.add(w === 'your' ? 'End of your turn' : 'End of your opponent’s turn'); }
  return [...out]; };
// t: where it is triggered (the phases the text names, less those only its opening moment gives), u: where its effect is used,
// at: the moment it opens with; none: no phase (before the battle, what a unit carries); x: not derivable
function ckEntry(d, text){
  if(d.how === 'none') return { x:1 };
  const tp = Object.assign({}, d.trigPh || {}); for(const p of d.atOnly || []) delete tp[p];
  // a phase named only in a sentence whose moment is the unit's own activation ("In your Shooting phase and the Fight phase, after this
  // model has finished making its attacks, …", Daemonic Poisons; "after this model has shot"): not a trigger, as a unit activation is not
  { const ss = sentences(plain(rulesText(text || ''))), ACT = /\bafter this (?:model|unit) has (?:finished making its attacks|shot|fought)\b/i, phs = x => [...x.matchAll(/\b(command|movement|shooting|charge|fight)(?=(?:,? (?:or |and )?(?:the |your )?(?:command|movement|shooting|charge|fight))* phases?\b)/gi)].map(m => m[1].toLowerCase());
    const named = ss.filter(x => ACT.test(x)).flatMap(phs), elsewhere = ss.filter(x => !ACT.test(x)).flatMap(phs);
    for(const p of new Set(named)) if(!elsewhere.includes(p)) delete tp[p]; }
  const e = {};
  if(d.at) e.at = d.at;
  // a phase named only as "your / the next X phase" is when the effect happens ("must make an ingress move in your next Movement
  // phase", Umbralefic Crystal), not the trigger, when the text has a trigger besides
  const pt = plain(text || ''), nexts = [...pt.matchAll(/\b(?:your|the) next (command|movement|shooting|charge|fight) phase\b/gi)].map(m => m[1].toLowerCase());
  const rest = pt.replace(/\b(?:your|the) next (?:command|movement|shooting|charge|fight) phase\b/gi, ' ');
  for(const p of new Set(nexts)) if(tp[p] && !new RegExp('\\b' + p + ' phase\\b', 'i').test(rest) && (d.at || Object.keys(tp).some(q => q !== p && !nexts.includes(q)))) delete tp[p];
  if(phStr(tp)) e.t = phStr(tp);
  // a sentence at the end of the battle round (Pledges to the Dark Prince's check): that moment too (ae)
  if(/(?:^|[.\n]\s*)at the end of the battle round\b/i.test(pt)) e.ae = 'End of the battle round';
  // triggered in named phases and lasting no longer ("In your Shooting phase, when … selected to shoot, that unit's attacks can
  // re-roll"): used only there, in the trigger's turn, not in every phase its words could be read for (no "until", "this turn", "next")
  let up = d.usedPh;
  if(phStr(tp) && !d.at && !/\buntil\b|\bthis turn\b|\bnext\b|\bfor the rest of\b/i.test(plain(text || '')))
    up = Object.fromEntries(Object.entries(up || {}).filter(([p]) => tp[p]).map(([p, o]) => [p, o === 'either' ? tp[p] : tp[p] === 'either' || tp[p] === o ? o : null]).filter(([, o]) => o));
  if(MORTAL_GUARD.test(pt)){ const mu = mortalUse(text, e); if(mu) up = Object.fromEntries(mu.split(',').map(x => x.split(':'))); }
  if(phStr(up)) e.u = phStr(up);
  return Object.keys(e).length ? e : { none:1 };
}
// what a triggered text puts in force from a rule defined elsewhere (f): a bold term of its text that is one of its faction's army
// or detachment rules, by name or by the faction's aliases ("**riled up**" is Waaagh!), and that the text makes a state of units:
// "is / are / be / become(s) **X**" in a clause with no "if", "while", "unless" or "when" before it (War Cry: "If you do, friendly
// ORKS units … are **riled up** until the end of the next turn"; not Krumpin' Time's "if this unit is **riled up**"). Its phases are
// those the duration in the same sentence covers from where the text is triggered (t, at), in the order of a turn and the next:
// "until the end of the phase" that phase; "of the turn" / "this turn" the rest of that turn; "of the next turn" the rest of that
// turn and the whole next one; "until the start of your next turn / Command phase" the rest of that turn, and the opponent's turn
// after one of yours; "until the start of your opponent's next turn / Command phase" the rest of that turn, and your turn after one of
// theirs (Fulgrim's Daemon Primarch of Slaanesh); "until the end of the battle" every phase; "of the battle round" or "until the start of the next battle round" every phase only from the start of the
// battle round. Any other duration, or none, or no trigger: x (When unclear), nothing guessed
const DURATIONS = [
  { id:'phase', re:/\buntil the end of the phase\b/i }, { id:'next', re:/\buntil the end of the next turn\b/i },
  { id:'turn', re:/\buntil the end of (?:the|this|that) turn\b|\bthis turn\b/i }, { id:'yournext', re:/\buntil the start of your next (?:turn|command phase)\b/i },
  { id:'oppnext', re:/\buntil the start of your opponent.s next (?:turn|command phase)\b/i },
  { id:'battle', re:/\buntil the end of the battle\b(?! round)|\buntil (?:it|they) enters? a different one\b|\buntil (?:it is |they are )?changed\b/i }, { id:'round', re:/\buntil the end of the battle round\b|\buntil the start of the next battle round\b/i },
];
function inForce(text, f, self, e){
  const out = [], seen = new Set(), t = rulesText(text);
  const rules = f.armyRules.concat(Object.values(f.detachments).flatMap(detRules));
  const named = term => { const lc = plain(term).toLowerCase(); const r = rules.find(x => norm(x.name).toLowerCase() === lc); if(r) return r.name;
    const al = (f.aliases || []).find(([re]) => re.test(plain(term))); return al && rules.some(x => x.name === al[1]) ? al[1] : null; };
  for(const sent of sentences(t)) for(const m of sent.matchAll(/\b(?:is|are|be|becomes?)\s+\*\*([^*]+)\*\*/gi)){
    const r = named(m[1]);
    if(!r || r === self || seen.has(r)) continue;
    const clause = sent.slice(0, m.index).split(/[,;:.]/).pop();
    if(/\b(?:if|while|unless|when)\b/i.test(clause)) continue;
    seen.add(r);
    const d = DURATIONS.find(x => x.re.test(plain(sent)));
    out.push(Object.assign({ n:plain(m[1]), r }, coverOf(d && d.id, e)));
  }
  return out;
}
// the phases a duration covers from the trigger (phase:your|opp|either), or x
function coverOf(dur, e){
  const T = ['your', 'opp'], seq = T.flatMap(w => PH.map(p => p + '|' + w)), cov = new Set();
  const trig = Object.entries(Object.fromEntries(String(e.t || '').split(',').filter(Boolean).map(x => x.split(':')))).flatMap(([p, w]) => (w === 'either' ? T : [w]).map(x => p + '|' + x));
  const startRound = /^start of the (?:first )?battle round$/i.test(e.at || ''), endOpp = /^end of your opponent.s turn$/i.test(e.at || '');
  if(startRound) trig.push('command|your', 'command|opp');
  // "until the end of the phase" from the start of the battle round names no phase in progress: not read
  if(!dur || (!trig.length && !endOpp) || (dur === 'round' && !startRound) || ((dur === 'phase' || dur === 'yournext' || dur === 'oppnext') && startRound)) return { x:1 };
  const from = s => { const [p, w] = s.split('|'), i = PH.indexOf(p); return PH.slice(i).map(x => x + '|' + w); };
  const all = w => PH.map(x => x + '|' + w), other = w => w === 'your' ? 'opp' : 'your';
  for(const s of trig){ const w = s.split('|')[1];
    const add = dur === 'phase' ? [s] : dur === 'turn' ? from(s) : dur === 'next' ? from(s).concat(all(other(w))) : dur === 'yournext' ? from(s).concat(w === 'your' ? all('opp') : []) : dur === 'oppnext' ? from(s).concat(w === 'opp' ? all('your') : []) : seq;
    add.forEach(x => cov.add(x)); }
  // at the end of your opponent's turn: the next turn is yours; to the end of the battle is every phase after it, in both turns
  if(endOpp){ if(dur === 'next' || dur === 'oppnext') all('your').forEach(x => cov.add(x)); else if(dur === 'battle') seq.forEach(x => cov.add(x)); else if(dur !== 'yournext') return { x:1 }; }
  if(!cov.size) return { x:1 };
  const m = {}; for(const x of cov){ const [p, w] = x.split('|'); m[p] = m[p] && m[p] !== w ? 'either' : w; }
  return { u:phStr(m) };
}
// an ability's key: a hash of its name and text (the app's ckHash, the same for an imported list's copy of the unit)
const ckHash = s => { let h = 0x811c9dc5; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
const abilityCk = ab => 'a|' + ckHash(ab.name + '\n' + ab.text);
const CK_START = '// ---- CHECKLIST: written by verify/derive.js --write from the rules text (do not edit) ----';
const CK_END = '// ---- end of CHECKLIST ----';
function ckBlock(T){
  return CK_START + '\n' +
    '// The Phase checklist: per army or detachment rule (r|faction|name) and ability (a|hash of its name and text), as the rule\n' +
    '// tables of verify/derive.js give it: s listed (a fixed moment of the sequence, seqTrigger), t where it is triggered, u where its effect is used (phase:your|opp|either), at the moment it\n' +
    '// opens with, none no phase, x not derivable; o its options (n name, row its table row; t and at only when the option names its own; a its own WHEN line a unit activation),\n' +
    '// g the abilities it gives to units by keyword (to: the keywords, opt: the option that gives it, while: the condition); f what it puts\n' +
    '// in force from a rule (inForce); ae a sentence at the end of the battle round; a its own trigger a unit activation (actOf); pk where\n' +
    '// the ability it selects is in force (pickCover); oc where its options are in force (optCover); an option\'s ends the end moments it\n' +
    '// names (endsOf)\n' +
    'const CHECKLIST = {\n' + Object.keys(T).map(k => '  ' + JSON.stringify(k) + ':' + JSON.stringify(T[k])).join(',\n') + '\n};\n' + CK_END;
}

function derive(D){
  const V = vocab(D);
  // the comments next to an item: data.js in the old form (each unit in full, as the lists were written), where each comment
  // is on every unit it is about (verify/tables.js)
  const src = require('./tables').oldForm(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'));
  const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  // the app's own matches(), so "selects the same units" means what the app does
  const matches = new Function('hasKw', appFunctions(html).matches + '\nreturn matches;')((u, k) => u.kw.some(x => norm(x).toLowerCase() === norm(k).toLowerCase()));
  const ctx = { core:D.coreStratagems };
  const items = [];
  const add = it => items.push(it);
  // the checklist table (data.js CHECKLIST, the Phase checklist): per rule and ability, where it is triggered and where its
  // effect is used, and the same for each of its options; the same words on several units must give the same entry
  const CK = {}, CKO = {};
  const ckPut = (k, v) => { if(!CK[k]) CK[k] = v; else if(JSON.stringify(CK[k]) !== JSON.stringify(v)) CK[k] = { x:1 }; };
  const sinkOf = k => CKO[k] || (CKO[k] = { opts:[], grants:[] });
  Object.defineProperty(items, 'checklist', { enumerable:false, get:() => Object.fromEntries(Object.keys(CK).sort().map(k => {
    const e = Object.assign({}, CK[k]), o = CKO[k];
    if(o && o.opts.length) e.o = o.opts;
    if(o && o.grants.length) e.g = o.grants;
    return [k, e];
  })) });
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
      .concat(Object.values(f.detachments).flatMap(d => detRules(d).map(r => ({ r, where:f.name + ' · ' + d.name + ' rule · ' + r.name, det:true }))));
    for(const { r, where, det } of rules){
      const comments = commentsNear(src, r.name);
      timingItem('rule-timing', where, r, r.text, { comments }, { core:D.coreStratagems, rule:true });
      { const own = withoutOptions(r.text, r.table), ce = ckEntry(timing(own, ckCtx({ core:D.coreStratagems, rule:true })), own), fo = inForce(own, f, r.name, ce); if(fo.length) ce.f = fo; if(seqTrigger(own)) ce.s = 1; { const oc = optCover(r.text, own, r.table, ce.x && r.at ? { at:r.at } : ce); if(oc) ce.oc = oc; } ckPut('r|' + fk + '|' + r.name, ce); }
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
    const sp = tagParts(ab.tag), sder = sp.filter(p => DERIVABLE_TAG(p, ab)), skept = sp.filter(p => !DERIVABLE_TAG(p, ab));
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
        const actx = { core:D.coreStratagems, named:n => {
          const o = u.abilities.find(x => x !== ab && norm(x.name).toLowerCase() === norm(n).toLowerCase());
          if(o) return o.text;
          const r = f.armyRules.concat(a.detachments.flatMap(id => detRules(f.detachments[id]))).find(x => norm(x.name).toLowerCase() === norm(n).toLowerCase());
          return r ? r.text : null;
        } };
        timingItem('ability-timing', where, ab, ab.text, { comments, dedupe:ab.name + '\n' + ab.text }, actx);
        { const own = withoutOptions(ab.text, null), ce = ckEntry(timing(own, ckCtx(actx)), own), fo = inForce(own, f, ab.name, ce); if(fo.length) ce.f = fo; if(seqTrigger(own)) ce.s = 1; else if(actOf(own)) ce.a = 1; const pk = pickCover(own, ce); if(pk) ce.pk = pk; { const oc = optCover(ab.text, own, null, ce); if(oc) ce.oc = oc; } ckPut(abilityCk(ab), ce); }
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
  // ---- rule options and grants (coverage only): the rows of data.js's RULE_OPTIONS and GRANTS (verify/tables.js --write writes
  // them from ruleTables below, which reads them from the words), each against what the rule's footnotes and the unit sheets store ----
  const fresh = ruleTables(D);
  for(const [k, v] of Object.entries(fresh.sinks)) CKO[k] = v;   // the checklist's options and grants (ruleTables)
  const TB = { options:D.ruleOptions || [], grants:D.grants || [] };
  Object.defineProperty(items, 'tablesStale', { value:JSON.stringify(TB) !== JSON.stringify({ options:fresh.options, grants:fresh.grants }) });
  const whyOf = new Map(); fresh.options.forEach((o, i) => { const k = o.rule + '\n' + o.option; if(!whyOf.has(k)) whyOf.set(k, fresh.reasons[i]); });
  for(const s of ruleSources(D)) optionsAndGrants(s.where, s.stored, s.fk, s.self);
  function optionsAndGrants(where, stored, fk, self){
    for(const o of TB.options.filter(x => x.rule === where)){
      const phs = o.phases && o.phases.ph ? o.phases.ph : [];
      const mine = stored.filter(sx => sx.name && norm(sx.name).toLowerCase().startsWith(norm(o.option).toLowerCase()) || (sx.picks || []).some(n => norm(o.option).toLowerCase().startsWith(norm(n).toLowerCase()) || norm(n).toLowerCase().startsWith(norm(o.option).split(' ')[0].toLowerCase())));
      const storedPh = new Set(mine.flatMap(sx => sx.kind === 'melee' ? ['fight'] : sx.kind === 'ranged' ? ['shooting'] : sx.kind === 'all' ? ['shooting', 'fight'] : sx.kind === 'def' ? ['shooting', 'fight'] : []));
      const inDerived = [...storedPh].every(p => phs.includes(p));
      const status = !phs.length ? 'not-derivable' : !mine.length ? 'different' : inDerived ? 'identical' : 'different';
      add({ kind:'rule-option', coverage:true, where:where + ' · ' + o.option, stored:mine.length ? mine.map(sx => sx.what + (sx.picks && sx.picks.length ? ' picks ' + sx.picks.join('/') : '')).join('; ') : null,
        derived:phs.length ? o.phases : null, trigger:o.trigger, used:o.used,
        how:o.explicit ? 'explicit' : 'activity', status, noPerOption:!mine.length || undefined, optionFrom:o.found,
        reasons:whyOf.get(o.rule + '\n' + o.option) || [], text:o.text });
      grantItems(where, o.option, stored, fk, self);
    }
    grantItems(where, undefined, stored, fk, self);
  }
  // "BLOOD LEGIONS units from your army gain the Blessings of Khorne ability", "Friendly X units have the following ability:"
  function grantItems(where, option, stored, fk, self){
    for(const g of TB.grants.filter(x => x.rule === where && x.option === option)){
      const { grants:grantName, type, to, text:sent } = g, wh = g.while;
      const inParts = stored.find(sx => sx.grants && norm(sx.grants).toLowerCase() === norm(grantName).toLowerCase());
      const holds = u => (u.rules || []).concat(u.abilities.map(y => y.name), u.kw || []).some(r => norm(r).toLowerCase() === norm(grantName).toLowerCase() || norm(r).toLowerCase().startsWith(norm(grantName).toLowerCase() + ' '));
      // who should hold it: this unit (an ability's own grant) or the units it is for
      const forUnits = to === 'this unit / model' ? (self ? [self] : []) : to ? D.armies.filter(a => a.faction === fk).flatMap(a => a.units.filter(u => matches(to, u))) : [];
      const onSheets = forUnits.filter(holds).map(u => u.name);
      const storedG = inParts ? { grants:inParts.grants, to:inParts.needs || null, while:inParts.when || null } : onSheets.length ? 'on the datasheet' + (onSheets.length > 1 ? 's' : '') + ' (Rules line, abilities or keywords): ' + [...new Set(onSheets)].slice(0, 5).join(', ') + (new Set(onSheets).size > 5 ? '…' : '') + (onSheets.length < forUnits.length ? ' (' + onSheets.length + ' of ' + forUnits.length + ' units it is for)' : '') : null;
      const same = inParts ? JSON.stringify(canonNeeds(inParts.needs)) === JSON.stringify(canonNeeds(typeof to === 'object' ? to : null)) : !!onSheets.length;
      add({ kind:'rule-grant', coverage:true, where:where + (option !== undefined ? ' · ' + option : '') + ' → ' + grantName, derived:{ grants:grantName, type, to, while:wh }, stored:storedG,
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

// ---------------------------------------------------------------------------------------------
// READINGS: a footnote (mods) the words give by a fixed rule. verify/tables.js --write writes a datasheet's or an enhancement's
// reading from these rules (readBy:'derive') where they give exactly the reading data.js had, and writes it again from the words
// when they change. Only the words are read (and the name the reading is from, which it names); none: not derivable.
// ---------------------------------------------------------------------------------------------
const READING_BONUS = '\\+\\d+ (?:A|S|D|AP)';
const READING_RULES = [
  // "While this model has 1-6 wounds remaining, [subtract 4 from this model's Objective Control characteristic and] each time this
  // model makes an attack, subtract 1 from the Hit roll."
  { id:'damaged-hit', re:/^While this model has 1-(\d+) wounds remaining, (?:subtract (\d+) from this model's Objective Control characteristic and )?each time this model makes an attack, subtract 1 from the Hit roll\.$/i,
    give:(m, name) => [{ kind:'all', when:'Damaged (1-' + m[1] + ' wounds left)', note:'-1 to hit rolls' + (m[2] ? ' (and -' + m[2] + ' OC)' : ''), from:name }],
    why:'a Damaged ability whose only effect is -1 to its attacks\' hit rolls (and a lower OC, said in brackets): one footnote for every attack' },
  // the core ability Damaged X (its glossary text, with its name): "while damaged, that model's attacks have -1 to hit rolls"
  { id:'damaged-core', re:/^Damaged (\d+): .*\bwhile damaged, that model's attacks have -1 to hit rolls\b/i,
    give:(m, name) => name === 'Damaged ' + m[1] ? [{ kind:'all', when:'Damaged (' + m[1] + ' or fewer wounds remaining)', note:'-1 to hit rolls', from:name }] : null,
    why:'the core ability Damaged X: -1 to hit rolls while it has X or fewer wounds remaining' },
  // "If this unit is riled up, this unit's ranged attacks have [SUSTAINED HITS 1]."
  { id:'riled-weapon-ability', re:/^If this unit is riled up, this unit's (ranged|melee) attacks have \[([^\]]+)\]\.$/i,
    give:(m, name) => [{ kind:m[1].toLowerCase(), when:'Riled up', cond:'riled', note:'[' + m[2] + ']', from:name }],
    why:'a weapon ability its attacks have while riled up: a footnote under that kind of weapons, while riled up' },
  // "This unit's ranged attacks have:\n- [IGNORES COVER].\n- If this unit is riled up, [SUSTAINED HITS 1]." (the unconditional ones
  // are on the weapons, marked +)
  { id:'riled-weapon-ability-list', re:/^This unit's (ranged|melee) attacks have:((?:\n- (?:If this unit is riled up, )?\[[^\]]+\]\.)+)$/i,
    give:(m, name) => { const out = [...m[2].matchAll(/\n- If this unit is riled up, \[([^\]]+)\]\./gi)].map(x => ({ kind:m[1].toLowerCase(), when:'Riled up', cond:'riled', note:'[' + x[1] + ']', from:name })); return out.length ? out : null; },
    why:'a list of weapon abilities its attacks have, one of them while riled up: a footnote for each of those' },
  // "If this unit made a charge move this turn, this unit's melee attacks have +1 S." (or a list: "have:\n- +3 A.\n- +2 S.")
  { id:'charge-stat', re:new RegExp('^(?:[A-Z][A-Za-z\'/ ]* models? only\\. )?If this unit made a charge move this turn, this (?:unit|model)\'s melee attacks have(?: (' + READING_BONUS + ')\\.|:((?:\\n- ' + READING_BONUS + '\\.)+))$', 'i'),
    give:(m, name) => [{ kind:'melee', when:'Made a charge move this turn', cond:'charged', note:m[1] || [...m[2].matchAll(new RegExp(READING_BONUS, 'gi'))].map(x => x[0]).join(', '), from:name }],
    why:'a characteristic bonus to its melee attacks after it charged: one footnote under its melee weapons' },
];
// the words as one reading: GW's markup and italic notes left out, the bullets kept on lines of their own
const readingWords = t => rulesText(t).split('\n').map(l => plain(l)).filter(Boolean).join('\n');
function readingsOf(text, name){
  const w = readingWords(text);
  for(const r of READING_RULES){ const m = r.re.exec(w); if(!m) continue; const mods = r.give(m, name); if(mods) return { mods, rule:r.id }; }
  return null;
}

// ---------------------------------------------------------------------------------------------
// RULE_OPTIONS and GRANTS: the options inside a rule or ability, and the abilities a rule gives units, read from the words.
// verify/tables.js --write writes them into data.js; derive() reads them there and fails the gate when the words say otherwise.
// ---------------------------------------------------------------------------------------------
// what the rule's footnotes and the unit sheets store for its options (compared, not part of the tables)
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
// the rules and abilities read for options and grants: every army and detachment rule, then every ability of every list (once per words)
// a detachment's rules: `rule`, then any further ones (`moreRules`: Blood Legion's Blood Tainted)
function detRules(d){ return d && d.rule ? [d.rule].concat(d.moreRules || []) : []; }
function ruleSources(D){
  const out = [];
  for(const [fk, f] of Object.entries(D.factions)){
    const rules = f.armyRules.map(r => ({ r, where:f.name + ' army rule · ' + r.name }))
      .concat(Object.values(f.detachments).flatMap(d => detRules(d).map(r => ({ r, where:f.name + ' · ' + d.name + ' rule · ' + r.name }))));
    for(const { r, where } of rules) out.push({ where, text:r.text, table:r.table, stored:storedOptionsOfRule(r), fk, ck:'r|' + fk + '|' + r.name });
  }
  const seen = new Set();
  for(const a of D.armies) for(const u of a.units) for(const ab of u.abilities){
    const k = ab.name + '\n' + ab.text; if(seen.has(k)) continue; seen.add(k);
    out.push({ where:a.id + ' · ' + u.name + ' · ' + ab.name, text:ab.text, table:null, stored:storedOptionsOfAbility(u, ab), fk:a.faction, self:u, ck:abilityCk(ab) });
  }
  return out;
}
// a grant: "has / have / gain(s) the X keyword / ability" said of units, with no negation in its clause, not inside a condition
// ("if this unit has the BATTLELINE keyword": it depends on it) or a relative clause ("units that have the X ability": who it is
// for), not of a detachment ("This detachment has the WAR DOGS tag"), and not the rule's own name
const GRANT_RE = /\b(gains?|have|has)(?: the)? (?:(following) abilit(?:y|ies)|\*\*([^*\[\]]+)\*\*(?: abilit(?:y|ies))?|([A-Z][\w'’ -]+?) abilit(?:y|ies))/g;
const notAGrant = (sent, m, rule, name) => {
  const clause = sent.slice(0, m.index).split(/[,;:]/).pop();
  return /^\s*(?:-\s*)?(?:if|unless|whether|each time|every time|when|whenever)\b/i.test(clause) || /\b(?:that|which|who|with)\s*$/i.test(clause) ||
    /\b(?:not|cannot|never|no longer)\b/i.test(clause) || /\bdetachment\b/i.test(clause) || /^\s+tag\b/i.test(sent.slice(m.index + m[0].length)) ||
    norm(name).toLowerCase() === norm(String(rule).split(' · ').pop()).toLowerCase();
};
function ruleTables(D){
  const V = vocab(D), options = [], grants = [], reasons = [], sinks = {};   // sinks: the checklist's options and grants per CHECKLIST key
  let ck;
  const grantSink = g => { if(g.type === 'ability' && g.to && typeof g.to === 'object') ck.grants.push(Object.assign({ name:g.grants, to:g.to }, g.option !== undefined ? { opt:g.option } : {}, g.while ? { while:g.while } : {})); };
  for(const s of ruleSources(D)){
    const t = rulesText(s.text);
    const opts = optionsOf(t, s.table);
    ck = sinks[s.ck] || (sinks[s.ck] = { opts:[], grants:[] });
    // the rule's own trigger: its text without its options
    const parentTrig = explicitTiming(opts.reduce((s2, o) => s2.replace(o.text, ''), t));
    for(const o of opts){
      const own = explicitTiming(o.text), trig = own || parentTrig;
      const used = usedIn(o.text, { core:D.coreStratagems }, trig);
      const ph = Object.assign({}, trig ? trig.ph : {}); for(const [p, v] of Object.entries(used.ph)) addPh(ph, p, v);
      options.push({ rule:s.where, option:o.name, text:o.text, found:o.how + (own ? '' : parentTrig ? ', trigger: the rule\'s' : ''), explicit:!!own,
        trigger:trig ? asLabel(trig.ph, trig.at) : null, used:Object.keys(used.ph).length ? asLabel(used.ph) : null, phases:Object.keys(ph).length ? asLabel(ph, trig && trig.at) : null });
      reasons.push((trig ? trig.reasons.map(r => Object.assign({ part:own ? 'trigger' : 'rule trigger' }, r)) : []).concat(used.reasons.map(r => Object.assign({ part:'used' }, r))));
      // the checklist: an option's own trigger, or none (the rule's is listed with the rule), and where it is used
      {
        const e = { n:o.name };
        if(o.row) e.row = o.row;
        if(own){ const tp = Object.assign({}, own.ph); for(const p of own.atOnly || []) delete tp[p]; if(own.at) e.at = own.at; if(phStr(tp)) e.t = phStr(tp); }
        const usedCk = usedIn(o.text, ckCtx({}), trig), phCk = Object.assign({}, trig ? trig.ph : {}); for(const [p, v] of Object.entries(usedCk.ph)) addPh(phCk, p, v);
        if(phStr(usedCk.ph)) e.u = phStr(usedCk.ph);
        const tr = own || parentTrig, tp = tr ? Object.assign({}, tr.ph) : {}; for(const p of (tr && tr.atOnly) || []) delete tp[p];
        if(MORTAL_GUARD.test(plain(o.text))){ const mu = mortalUse(o.text, { t:phStr(tp), at:tr && tr.at }); if(mu) e.u = mu; }
        { const en = endsOf(o.text); if(en.length) e.ends = en; }
        if(!Object.keys(phCk).length && !(own && own.at)) e.x = 1;
        const fo = inForce(o.text, D.factions[s.fk], o.name, { t:phStr(tp), at:tr && tr.at });
        if(fo.length) e.f = fo;
        // a: an option whose own WHEN is a unit activation (Calistus: "WHEN: Your Movement phase, when a friendly readied unit is
        // selected to move"); an option's other words are its effect ("Each time a model in this unit makes a melee attack…"), listed
        if(seqTrigger(o.text)) e.s = 1; else if(actOf(o.text)) e.a = 1;
        ck.opts.push(e);
      }
      grantRows(s.where, o.name, o.text, o.name + ' active');
    }
    grantRows(s.where, undefined, opts.reduce((s2, o) => s2.replace(o.text, ''), t), null, opts.filter(o => /^heading/.test(o.how)));
  }
  function grantRows(rule, option, text, whileOpt, headed){
    for(const sent of sentences(norm(text))){
      let m, name;
      for(const x of sent.matchAll(GRANT_RE)){
        const n = (x[3] || x[4] || (x[2] ? ((/\*\*([^*]+?):?\*\*:?/.exec(norm(text).slice(norm(text).indexOf(sent) + sent.length)) || [])[1] || 'the following ability') : '')).replace(/:$/, '').trim();
        if(!notAGrant(sent, x, rule, n)){ m = x; name = n; break; }
      }
      if(!m) continue;
      // "… have the following abilities:" then headed options: it gives those (Mission Tactics: Furor, Malleus and Purgatus Tactics)
      if(m[2] && headed && headed.length && /abilities/i.test(m[0])){
        const before = sent.slice(0, m.index), subj = friendlyUnit(V, before + ' ', { any:true }), rs = [];
        const to = subj && subj.run ? tidyNeeds(needsOf(V, subj, rs)) : null;
        for(const o of headed) grants.push(Object.assign({ rule }, { grants:o.name, type:'ability', to, while:null, text:sent }));
        continue;
      }
      if(!name || /^\[/.test(name) || /\b(?:keyword|characteristic)\b/i.test(name)) continue;
      const before = sent.slice(0, m.index);
      const subj = friendlyUnit(V, before + ' ', { any:true }) || friendlyUnit(V, before.replace(/$/, ' unit'), { any:true });
      const rs = [];
      // (the clause just before the verb names who has it: "while the bearer is within 6" of one or more friendly HARVESTER units,
      // models in the bearer's unit have the Fights First ability" gives it to the bearer's unit, not to the HARVESTER units)
      const own = /\b(?:this|the bearer'?s?|that) (?:unit|model)\b|\bthe bearer\b|\bthis model\b/i, last = before.split(/,\s*/).pop();
      const to = own.test(before) && (!(subj && subj.run) || (/\b(?:this|the bearer'?s?) (?:unit|model)\b/i.test(last) && !(friendlyUnit(V, last + ' ', { any:true }) || {}).run)) ? 'this unit / model' : subj && subj.run ? tidyNeeds(needsOf(V, subj, rs)) : null;
      // (the condition opens the sentence, or follows the moment it is checked at: Duellist’s Hubris, "At the start of the Fight phase; if
      // this model is not leading a unit, …", or "In addition, ": Instinctive Defence)
      const cond = (/^(?:at the (?:start|end) of [^,;]+[,;] |in addition, )?((?:while|if|when|until) [^,]+)/i.exec(plain(sent)) || [])[1];
      const wh = [whileOpt, cond].filter(Boolean).join('; ') || null;
      // a Feel No Pain the sentence gives only "against …" keeps its condition ("Feel No Pain 3+ against Psychic Attacks and mortal wounds")
      const against = /^feel no pain\b/i.test(name) ? /^\s*(?:ability\s+)?(against [^.;]+?)\s*(?:\.|;|$)/i.exec(plain(sent.slice(m.index + m[0].length))) : null;
      const grantName = name.replace(/ ability$/i, '') + (against ? ' ' + against[1].replace(/\*\*/g, '') : '');
      const type = isUpperWord(grantName.replace(/[^A-Za-z]/g, '')) ? 'keyword or weapon ability' : 'ability';
      const g = Object.assign({ rule }, option !== undefined ? { option } : {}, { grants:grantName, type, to, while:wh, text:sent });
      grants.push(g); grantSink(g);   // (the checklist: an ability it gives to units by keyword, Might of Khorne's Blessings of Khorne)
    }
  }
  return { options, grants, reasons, sinks };
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
    '### 3. Tags', '', ...TAG_RULES.map(r => '- `' + r.id + '`: ' + r.why), '- Not derivable from the text (kept as stored, shown under "parts the text cannot give"): Aura and Psychic (GW\'s tags, as New Recruit prints them after the name), a "Once per…" that only the ability\'s name in New Recruit carries, other words.', '',
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
    fn('phasesOf'), fn('phTurn'), fn('whenTag'), fn('shortWhen'), fn('onceTag'), fn('isEnhancement')].join('\n');
  return new Function(src + '\nreturn { whenTag, shortWhen, onceTag, isEnhancement };')();
}
function screenOf(F, ab){
  const once = F.onceTag(ab), row = (ab.ph && !ab.na ? F.shortWhen(ab) : '');
  const meta = [ab.tag, ab.ph ? F.whenTag(ab) : ''].filter(Boolean).join(' · ');
  return ['row: ' + [F.isEnhancement(ab) ? '[Enhancement]' : '', once ? '[' + once + ']' : '', row].filter(Boolean).join(' '), 'opened: ' + (meta || '—')].join(' | ');
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
      const tag = [...new Set([].concat(it.derived ? it.derived.split(/, (?!per )/) : [], keep))].join(' · ');   // parts the app adds: " · " (verify/nr.js)
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
  // the checklist table in data.js must be what the rules give (--write puts it there)
  let ckStale = false;
  {
    const file = path.join(ROOT, 'data.js'), src = fs.readFileSync(file, 'utf8'), want = ckBlock(items.checklist);
    const i = src.indexOf(CK_START), j = src.indexOf(CK_END), have = i >= 0 && j > i ? src.slice(i, j + CK_END.length) : null;
    if(process.argv.includes('--write')){
      let out = have ? src.slice(0, i) + want + src.slice(j + CK_END.length) : null;
      // (after BS_IDS, where verify/tables.js --write keeps it: among the parts of data.js outside its tables)
      if(!out){ const bs = src.indexOf('// ---- end of BS_IDS ----'), at = bs >= 0 ? src.indexOf('\n', bs) + 1 : src.indexOf('\nreturn { version:VERSION') + 1;
        if(at <= 0) throw new Error('data.js: return line not found'); out = src.slice(0, at) + '\n' + want + '\n' + src.slice(at); }
      if(!/checklist:CHECKLIST/.test(out)) out = /bsIds:BS_IDS/.test(out) ? out.replace(/bsIds:BS_IDS/, 'bsIds:BS_IDS, checklist:CHECKLIST') : out.replace(/ \};\n\}\)\(\);/, ', checklist:CHECKLIST };\n})();');
      fs.writeFileSync(file, out);
      console.log('derive: wrote CHECKLIST into data.js (' + Object.keys(items.checklist).length + ' entries)');
    } else if(have !== want){ ckStale = true; console.log('derive: data.js CHECKLIST ' + (have ? 'differs from' : 'is missing;') + ' what the rules text gives. Run: node verify/derive.js --write'); }
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
  if(items.tablesStale) console.log('  STALE data.js RULE_OPTIONS / GRANTS are not what the words give now: node verify/tables.js --write');
  process.exit(drift.length || items.tablesStale || ckStale ? 1 : 0);
}
module.exports = { derive, ruleTables, readingsOf, READING_RULES, ckHash, timing, explicitTiming, stratNeeds, ruleNeeds, canonNeeds, OWNER_RULES, NOT_TIMING, MOMENT_RULES, ACTIVITY_RULES, USED_MODIFIERS, NEEDS_RULES, TAG_RULES, BONUS_RULES, DEF_RULES };
