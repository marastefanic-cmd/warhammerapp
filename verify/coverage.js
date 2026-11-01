/* verify/coverage.js: every condition GW's words put on a box is on the box (the attack side's BOXES b, verify/lines.js LC; the defence side's
   BOXES d, verify/defence.js DC). D5 / G5 / L5 hold each stated condition to the words; this holds the words' conditions to the box: each
   condition-bearing clause of its quote (and the line it continues, and the rule's own structure) is said by a condition (COND, DCOND, its
   kind) or quoted (q: shown "If (see the rule)" or in GW's words), or its sentence is listed not counted (no box). Read here by fixed
   patterns of their own, not the extractor's condition code:
     option     the box is one option of its rule: a table row, a "**Name:**" or bold line, "select one of the following", "Or:", or one of
                the abilities of a section another ability of the unit selects from (verify/gw-order.js selectsFrom): opt or pick
     once       "once per battle" / "once per turn" (the quote, its line, the rule's tag): oncePerBattle / oncePerTurn, or quoted;
                "once per battle round": quoted
     clause     every "if / while / unless …" clause: a condition whose pattern reads it, or quoted ("if it does" / "if you do": used)
     within     every "within N"" (not the attack's own range): a condition with N (aura, nearFriendly) or quoted, or the box's reach
                with an aura or a selected mark (the units it reaches are within N")
     kind       "melee" / "ranged" / "psychic" attacks or weapons, the Fight / Shooting phase in the quote or its line: the box's kind, or a
                label that says it, or quoted */
'use strict';
const E = require('../effects.js'), X = require('./effects-extract');
const { selectsFrom } = require('./gw-order');
const C = Object.assign({}, E.COND, E.DCOND);
const pc = t => X.plainCase(t || ''), n = t => E.norm(t || '');
// the option a box's quote is in, by the rule's structure (verify/effects-extract.js unitsOf: its lines, tables, bold options)
function optionOf(src, quote){
  const q = n(String(quote).split('\n')[0]).replace(/^-\s+/, '').slice(0, 60);
  const u = X.unitsOf(src).find(x => n(x.s).includes(q) || q.includes(n(x.s).slice(0, 60)));
  if(!u) return null;
  if(u.sec) return u.sec;
  if(u.or) return 'Or:';
  if(u.lead && /\b(?:select|choose) one of the following\b|\bselect one of the following\b|\bcan have:$/i.test(n(u.lead))) return u.lead;
  return null;
}
// what a box's conditions say, as words: their labels and their quoted words
function saidOf(b, kindSaid){
  const on = b.on || [];
  return { ids:new Set(on.map(x => x[0])), q:on.filter(x => x[0] === 'q' || x[0] === 'anyOf').map(x => n([].concat(x[1]).join(' '))), on };
}
// the gaps of one box (b: a box or a defence box; src: its source as verify/effects-migrate.js sources gives it; side: 'attack' | 'defence';
// units: the unit's other abilities, for a section another selects from)
function gaps(b, src, side, others){
  const out = [], S = saidOf(b), lead = b.lead || '', words = n([b.quote, lead].join(' ')), pcw = pc([lead, b.quote].join(' '));
  const quotedHas = re => S.q.some(q => re.test(q));
  // option
  const sel = src.type === 'ability' && (src.pickOf || (others || []).some(x => x.name !== src.name && src.who && selectsFrom(x.text || '', src.who)));
  const opt = sel || optionOf(src, b.quote);
  if(opt && !S.ids.has('opt') && !b.pick && !b.tableRows && !b.excl && !quotedHas(/\bselect one of the following\b/)) out.push('an option of its rule (' + (sel ? 'one of the abilities another selects' : String(opt).slice(0, 40)) + ') and no option condition');
  // once
  const ow = [words, n(src.tag)].join(' ');
  if(/\bonce per battle\b(?! round)/.test(ow) && !S.ids.has('oncePerBattle') && !quotedHas(/\bonce per battle\b/)) out.push('"once per battle" and no once-per-battle condition');
  if(/\bonce per turn\b/.test(ow) && !S.ids.has('oncePerTurn') && !quotedHas(/\bonce per turn\b/)) out.push('"once per turn" and no once-per-turn condition');
  if(/\bonce per battle round\b/.test(ow) && !quotedHas(/\bonce per battle round\b/)) out.push('"once per battle round" not quoted');
  // clauses
  for(const m of pcw.matchAll(/\b(?:[Ii]f|[Ww]hile|[Uu]nless) [^,.:;()]+/g)){ const cl = m[0], cn = n(cl), after = pcw.slice(m.index + cl.length);
    // (not a condition of the effect, as GW's grammar says: "if any of the following apply" (its list is the box's condition: objective,
    // anyOf), a cost ("if that test is failed, that unit suffers …"), a definition ("… that unit is said to be within Synapse Range"), a word
    // the sentence defines ("that model is damaged: while damaged"))
    if(/^if any of the following apply\b/.test(cn) && S.on.some(([id]) => id === 'objective' || id === 'anyOf')) continue;
    if(/^,?\s*(?:that unit|this unit|your unit|it|that model|this model) suffers\b/i.test(after)) continue;
    if(/^,?\s*that [^.]*? is said to be\b/i.test(after)) continue;
    { const w = /^while (\w+)$/.exec(cn); if(w && new RegExp('\\bis ' + w[1] + '\\b').test(n(pcw))) continue; }
    if(/^if (?:it|you|they) do(?:es)?\b/.test(cn)){ if(!S.ids.has('used') && !S.ids.has('bearerUses') && !quotedHas(/\bif (?:it|you|they) do/) && !S.q.length) out.push('“' + cl + '” and no used condition'); continue; }
    const read = S.on.some(([id]) => C[id] && C[id].pats.some(re => re.test(cn) || re.test(n(pcw.slice(m.index, m.index + cl.length + 80)))));
    const quoted = S.q.some(q => q.includes(cn.slice(0, 30)) || cn.includes(q.slice(0, 30)));
    // (a clause about the attack's target, said by the target's keywords or a target condition)
    const target = /\b(?:targets?|that target is)\b/.test(cn) && S.on.some(([id]) => id === 'targetKw' || /^target|^closest|^maxT$/.test(id));
    if(!read && !quoted && !target) out.push('“' + cl + '” is no condition of the box');
  }
  // within N"
  for(const m of words.matchAll(/\bwithin (\d+)"/g)){ const N = +m[1], at = words.slice(Math.max(0, m.index - 40), m.index + 60);
    if(/\b(?:range|move|moves|set up|more than)\b/.test(words.slice(Math.max(0, m.index - 25), m.index))) continue;
    if(/^[^.]*?\bis said to be\b/.test(words.slice(m.index))) continue;   // (a definition: "… is said to be within Synapse Range")
    const said = S.on.some(([id, p]) => (id === 'aura' && +p === N) || (id === 'nearFriendly' && p && +p.d === N) || (C[id] && C[id].pats.some(re => { const r = re.exec(words); return r && r[0].includes('within ' + N + '"'); })))
      || S.q.some(q => q.includes('within ' + N + '"')) || (b.reach && ['aura', 'selected'].includes(b.mark)) || b.foe;
    if(!said) out.push('“…' + at.trim().slice(0, 70) + '…” and no condition within ' + N + '"'); }
  // kind (its clause's words; a duration's phase is no kind)
  // (the clause with its effect: "weapons … have [SUSTAINED HITS 1], and ranged weapons … have [IGNORES COVER]" is two boxes, each its kind)
  const kinds = { melee:/\bmelee (?:attacks?|weapons?)\b|\bfight phase\b/, ranged:/\branged (?:attacks?|weapons?)\b|\bshooting phase\b/, psychic:/\bpsychic attacks?\b|\bpsychic weapons\b/ };
  const mine = (b.pick ? b.pick.flatMap(p => p.df || p.fx || []) : (b.df || b.fx || [])).map(([id]) => id);
  const segs = n(b.quote).split(/(?:,? and,? |; )(?=(?:until|that|each|all|models|melee|ranged|on a|weapons)\b)/);
  const effOf = sg => (side === 'defence' ? X.findDf(sg).df : X.findFx(sg).fx).map(([id]) => id);
  const own = segs.filter(sg => effOf(sg).some(id => mine.includes(id)));
  const kw = (own.length ? own.join(' ') : n(b.quote)).replace(X.DURATION_RE, ' ') + ' ' + n(lead).replace(X.DURATION_RE, ' ');
  const has = Object.entries(kinds).filter(([, re]) => re.test(kw.replace(/\(excluding psychic attacks\)/g, ' ').replace(/\bfeel no pain \d\+ (?:ability )?against [a-z ]+/g, ' '))).map(([k]) => k);
  if(has.length === 1){ const k = has[0], df = b.pick ? b.pick.flatMap(p => p.df || p.fx || []) : (b.df || b.fx || []);
    const labelSays = df.length && df.every(([id]) => (k === 'ranged' && /Ranged$/.test(id)) || (k === 'psychic' && /^fnpPsy/.test(id)) || (k === 'ranged' && E.FX[id] && ['range', 'bsSet', 'assault', 'heavy', 'indirect', 'pistol'].includes(id)));
    const excluded = k === 'psychic' && S.ids.has('notPsychic');
    if(b.kind !== k && !labelSays && !excluded && !quotedHas(kinds[k]) && !(side === 'attack' && k === 'psychic' && (b.scope || {}).wkw === 'PSYCHIC') && !(src.type === 'strat'))
      out.push('its words say ' + k + ' attacks, the box is for ' + b.kind); }
  return out;
}
module.exports = { gaps, optionOf };
