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
// what a box's conditions say, as words: their ids, their quoted words, the keywords they name
function saidOf(b){
  const on = (b.on || []).concat((b.pick || []).flatMap(p => p.on || []));
  const kws = on.flatMap(([id, p]) => id === 'nearFriendly' ? [p.not || ''] : id === 'targetKw' ? [].concat(p.none || [], p.any || [], p.all || []) : []).concat([].concat(((b.reach || {}).none) || []), (b.scope || {}).models === 'nonchar' ? ['character'] : [], ((b.srcNeeds || {}).none) || [])
    .map(k => n(String(k).replace(/^Faction: /, '')));
  return { ids:new Set(on.map(x => x[0])), q:on.filter(x => x[0] === 'q' || x[0] === 'anyOf').map(x => n([].concat(x[1]).join(' '))), on, kws };
}
// the sentence of the rule a box's quote is, as the extractor's structure reader has it (its line, the sentence before it)
const unitOf = (src, quote) => { const q = n(String(quote).split('\n')[0]).replace(/^-\s+/, '').slice(0, 60); return X.unitsOf(src).find(x => n(x.s).includes(q) || q.includes(n(x.s).slice(0, 60))) || null; };
// the phrases of GW's words that condition what they say (each must be said, quoted or not counted)
const PHRASES = [
  { what:'clause', re:/\b(?:[Ii]f|[Ww]hile|[Uu]nless) [^,.:;]+/g },
  { what:'first time', re:/\b[Tt]he first time (?:(?! while\b)[^,.:;()])+/g },
  { what:'exclusion', re:/\(excluding [^)]+\)/g },
  { what:'target', re:/\bthat targets? (?:a|an|an enemy) unit (?:with|within) [^,.;:]+/g },
  { what:'target', re:/\bthat targets? an? (?!enemy\b|unit\b)(?:[a-z][a-z-]* )+?unit\b/g },
  { what:'target', re:/\btargets? (?:a|an|an enemy) unit that is (?!below\b|not below\b)[^,.;:]+/g },
  { what:'can only target', re:/\bcan only target [^,.;:]+/g },
  { what:'contains', re:/\bcontains (?:a|one or more) [A-Z][A-Za-z' ]+? models?\b/g },
  { what:'weapons selected', re:/\bwith weapons selected for the [^,.;:]+? ability\b/g },
  // (the defence side's own: the attacker, the attack, the moment, a roll)
  { what:'attacker', re:/\b[Ee]ach time an enemy (?:unit|model)\b[^,.;:]*/g, side:'defence' },
  { what:'attack', re:/\b(?:[Ee]ach time|[Ww]hen) an attack with [^,.;:]+/g, side:'defence' },
  { what:'moment', re:/\b[Aa]t the start of [^,.;:]+?, select one enemy unit [^,.;:]+/g, side:'defence' },
  { what:'roll', re:/\b[Oo]n an? (?:unmodified )?(?:D6 )?(?:roll of )?\d(?:-\d|\+)?(?=,)/g, side:'defence' },
  { what:'failed save', re:/\b(?:[Ww]hen|[Jj]ust after) a saving throw [^,.;:]+/g, side:'defence' },
  { what:'cost', re:/^\+\d+CP\b/g }
];
// the gaps of one box (b: a box or a defence box; src: its source as verify/effects-migrate.js sources gives it; side: 'attack' | 'defence';
// others: the unit's other abilities, for a section another selects from)
// GW's friendly-unit phrase in the first of these texts that has one: { run (its keywords' words, bold kept), excl (its "(excluding …)") }
const RUN_B = '((?:\\*\\*[^*]+\\*\\*(?:\\s*(?:,|\\/|or|and)\\s*)?)+)', RUN_P = "((?:[A-Z][\\w'’-]*(?:\\s+|\\s*\\/\\s*|,\\s*| or | and ))+?)";
const PHRASE_RES = [new RegExp('(?<!\\bwithin \\d+" of (?:a |an |one or more )?)\\b[Ff]riendly ' + RUN_B + '\\s*(?:units?|models?)\\b'),
  new RegExp(RUN_B + '\\s*(?:units?|models?) from your army\\b'),
  new RegExp('(?<!\\bwithin \\d+" of (?:a |an |one or more )?)\\b[Ff]riendly ' + RUN_P + '(?:units?|models?)\\b')];
const counts = { checked:0, unchecked:0 };   // (reach boxes and keyword models scopes checked against GW's phrase, and those only said "If (see the rule)")
function reachPhrase(texts){
  for(const t0 of texts){ const t = String(t0 || ''); if(!t) continue;
    for(const re of PHRASE_RES){ const m = re.exec(t); if(!m) continue;
      const ex = /^\s*\(excluding ([^)]+)\)/.exec(t.slice(m.index + m[0].length).replace(/~~[^~]*~~\/?/g, ''));
      return { run:m[1].trim(), excl:ex ? ex[1] : null }; } }
  return null;
}
// GW's friendly-unit phrase as a keyword expression: { or:[[keyword…]…], not:[[keyword…]…] } (null: a word of it is no keyword)
const kwWords = k => n(String(k).replace(/^Faction: /, '')).split(/\s+/).map(w => w.replace(/s$/, ''));
function altsOf(V, run){
  const Dv = require('./derive'), out = [];
  for(const a of String(run).replace(/\*\*|~~/g, '').split(/\s*(?:\/|,? or |,? and |, )\s*/).map(x => x.trim()).filter(Boolean)){
    const ks = Dv.tokens(V, a), want = n(a).split(/\s+/).map(w => w.replace(/s$/, '')), got = ks.flatMap(kwWords);
    if(!ks.length || want.join(' ') !== got.join(' ')) return null;
    out.push(ks); }
  return out.length ? out : null;
}
function phraseExpr(V, run, excl){ const or = altsOf(V, run); if(!or) return null; let not = [];
  if(excl){ not = altsOf(V, String(excl).replace(/\s*\b(?:units?|models?)\s*$/i, '')); if(!not) return null; }
  return { or, not }; }
const has = (kw, k) => kw.some(x => x.toLowerCase() === String(k).toLowerCase());
const evalExpr = (e, kw) => e.or.some(a => a.every(k => has(kw, k))) && !e.not.some(a => a.every(k => has(kw, k)));
// a reach as the app reads it (app.html matches): all, any, none, unless
const meets = (q, kw) => !q || ((!q.all || q.all.every(k => has(kw, k))) && (!q.any || !q.any.length || q.any.some(k => has(kw, k))) && (!q.none || !q.none.some(k => has(kw, k))) && (!q.unless || !meets(q.unless, kw)));
function gaps(b, src, side, others, ctx){
  const out = [], S = saidOf(Object.assign({ srcNeeds:src.needs }, b)), u = unitOf(src, b.quote);
  // (its words: the line it continues, the sentence before it where it refers back to it ("If they do, …", "That model …"), the quote; GW's
  // struck words are not its words)
  const back = u && u.prevS && /^(?:if (?:it|you|they) do|that |those |until )/i.test(n(b.quote)) && !b.lead ? u.prevS : '';
  const lead = b.lead || '', raw = [lead, back, b.quote].filter(Boolean).join(' ').replace(/~~[^~]*~~\/?/g, '');
  const words = n(raw), pcw = pc(raw);
  // (the clauses of its quote after the last one with its effect are another's: "…; on a 6, that enemy unit is not eligible to shoot")
  const mine0 = (b.pick ? b.pick.flatMap(p => p.df || p.fx || []) : (b.df || b.fx || [])).map(([id]) => id);
  const pq = pc(String(b.quote).replace(/~~[^~]*~~\/?/g, '')), qAt = pcw.lastIndexOf(pq);
  let endAt = pcw.length;
  // (and on the defence side a clause of its own condition, "…, and, if that enemy unit is Below Half-strength, …": another box's,
  // verify/effects-extract.js defenceOf IF_CUT)
  { const parts = pq.split(side === 'defence' ? /(?=(?:,? and,? |; )(?:until|that|each|all|models|melee|ranged|on a|weapons)\b|,? and,? if\b)/i : /(?=(?:,? and,? |; )(?:until|that|each|all|models|melee|ranged|on a|weapons)\b)/i); let pos = 0, last = -1;
    parts.forEach((x, i) => { const ids = (side === 'defence' ? X.findDf(n(x)).df : X.findFx(n(x)).fx).map(([id]) => id); if(ids.some(id => mine0.includes(id))) last = i; });
    if(last >= 0 && qAt >= 0){ for(let i = 0; i <= last; i++) pos += parts[i].length; endAt = qAt + pos; } }
  const quotedHas = re => S.q.some(q => re.test(q));
  const covers = (ph, at) => { const pn = n(ph), win = n(pcw.slice(at, at + ph.length + 80));
    return S.on.some(([id]) => C[id] && C[id].pats.some(re => { if(re.test(pn)) return true; const r = re.exec(win); return !!r && r.index < pn.length; }))
      || S.q.some(q => q.includes(pn.slice(0, 25)) || pn.includes(q.slice(0, 25))); };
  // option
  const secOf = w => (others || []).some(x => x.name !== src.name && w && (selectsFrom(x.text || '', w) || new RegExp('\\bselect one ' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' ability\\b', 'i').test(pc(x.text))));
  const sel = src.type === 'ability' && (src.pickOf || secOf(src.who));
  const opt = sel || optionOf(src, b.quote);
  if(opt && !S.ids.has('opt') && !b.pick && !b.tableRows && !b.excl && !quotedHas(/\bselect one of the following\b/)) out.push('an option of its rule (' + (sel ? 'one of the abilities another selects' : String(opt).slice(0, 40)) + ') and no option condition');
  // a unit another selects ("select one friendly … model"): said
  if(side === 'defence' && b.mark === 'selected' && !S.ids.has('selected')) out.push('a unit another selects and no selected condition');
  // the models it is for, by GW's words: "that CHARACTER has", "KASTELAN ROBOT models in that unit", "that model has" with "a X model is leading
  // this unit": that keyword (the line says "X models:")
  { let m, want = null; const rp = raw.replace(/\*\*/g, '');
    if((m = /\bthat ([A-Z][A-Z' -]*[A-Z])(?: model)? has\b/.exec(rp)) || (m = /\b([A-Z][A-Z' -]*[A-Z]) models in that unit\b/.exec(rp))) want = m[1].trim();
    else if(/\bthat model has\b/i.test(rp) && (m = /\b[Ww]hile an? ([A-Z][A-Z' -]*[A-Z]) model is leading this unit\b/.exec(rp))) want = m[1].trim();
    // (by meaning where the vocabulary is given: the keywords of its words and of its scope the same set)
    const sc = (b.scope || {}).models || (b.scope || {}).part || '', kset = t => { const a = altsOf(ctx.V, t); return a && a.length === 1 ? a[0].map(k => k.toLowerCase()).sort().join('|') : null; };
    const same = ctx && ctx.V ? (kset(want) !== null ? kset(want) === kset(sc) : String(sc).toUpperCase() === want.toUpperCase()) : String(sc).toUpperCase() === want.toUpperCase();
    // (a keyword scope with no phrase of GW's that gives it, or one not read by keywords: checked against nothing, so only where the line says
    // "If (see the rule)"; counted)
    const kwScope = sc && !['model', 'one', 'char', 'nonchar'].includes(sc);
    const ifOnly0 = (b.on || []).length && (b.on || []).every(([id]) => C[id] && C[id].quoted);
    if(kwScope && (!want || (ctx && ctx.V && kset(want) === null))){ counts.unchecked++; if(!ifOnly0) out.push('its models scope ' + sc + ' is checked against no GW phrase and its line does not say “If (see the rule)”'); }
    else if(kwScope) counts.checked++;
    if(want && !same && !(ctx && ctx.V && kset(want) === null && (b.on || []).length && (b.on || []).every(([id]) => C[id] && C[id].quoted))) out.push('its words give it to ' + want + ' models, its scope ' + JSON.stringify((b.scope || {}).models || 'the unit')); }
  // the friendly units it reaches: every keyword GW names for them is in its reach ("a friendly NECRONS VEHICLE unit", "a friendly LEGIO
  // CYBERNETICA or ADEPTUS MECHANICUS VEHICLE model", "BLOOD LEGIONS units from your army"); "other friendly", "another", "because of this
  // … model": not the unit itself (notSelf); a reach by an aura's range: its aura mark
  if(b.reach){
    // GW's phrase for the friendly units it reaches, where GW states it: the quote, the line it continues, the sentence before it, the
    // rule its tag names (Bondsman); in bold or not ("a friendly War Dog model"); "Friendly …" at a sentence's start too. Not a phrase
    // saying where they must be ("within 6" of one or more friendly SYNAPSE models"), as the extractor's reach reader skips it
    // (nearest first: the quote, the line it continues, the sentence it refers back to, the sentences before it in its rule, its tag's rule)
    const us = X.unitsOf(src), at = u ? us.findIndex(x => x.s === u.s && x.lead === u.lead) : -1, before = at > 0 ? us.slice(0, at).reverse().map(x => x.s) : [];
    const ph = reachPhrase([b.quote, lead, back, u && u.prevS || ''].concat(before, [src.tagText || '']).map(t => String(t).replace(/~~[^~]*~~\/?/g, '')));
    // ("Ranged attacks that target that enemy unit", "that enemy unit cannot have the Benefit of Cover": every friendly unit's, an empty reach)
    const every = X.EVERY_FRIENDLY.test(n(b.quote)) && !Object.keys(b.reach).length;
    const ifOnly = S.on.length && S.on.every(([id]) => C[id] && C[id].quoted);
    // (a reach checked against no phrase of GW's: only where the line says "If (see the rule)"; counted either way)
    const unchecked = why => { counts.unchecked++; if(!ifOnly) out.push('its reach is checked against no GW phrase (' + why + ') and its line does not say “If (see the rule)”'); };
    if(every) counts.checked++;
    else if(!ph) unchecked('no friendly-unit phrase found');
    else { const m = ph;
      const rw = new Set([].concat(b.reach.all || [], b.reach.any || []).flatMap(k => n(String(k).replace(/^Faction: /, '')).split(/\s+/)));
      const miss = m.run.replace(/\*\*/g, '').split(/\s*(?:\/|,? or |,? and |, )\s*|\s+/).map(w => n(w)).filter(w => w && !rw.has(w) && !rw.has(w.replace(/s$/, '')));
      if(miss.length) out.push('its words name the friendly units ' + m.run.replace(/\*\*/g, '') + ', its reach leaves out ' + miss.join(', '));
      // (and as GW joins them, by meaning: GW's phrase read as a keyword expression (alternatives joined by "or", "/", ",", "and" (either);
      // within one, every keyword its words name; less the keywords "(excluding …)" names, GW's struck words left out), and the reach as
      // the app reads it (all / any / none), give the same answer for every unit of the lists and every datasheet row; a phrase not read
      // whole by keywords is unparsed: its box says "If (see the rule)")
      if(!(ctx && ctx.V)) counts.checked++;
      if(ctx && ctx.V){ const expr = phraseExpr(ctx.V, m.run, m.excl);
        if(!expr) unchecked('“' + m.run.replace(/\*\*/g, '') + '” not read whole by keywords');
        else { counts.checked++; const bad = ctx.kws.filter(kw => evalExpr(expr, kw) !== meets(b.reach, kw));
          if(bad.length) out.push('its reach ' + JSON.stringify(b.reach) + ' and GW’s “' + m.run.replace(/\*\*/g, '') + (m.excl ? ' (excluding ' + m.excl.replace(/\*\*|~~/g, '') + ')' : '') + '” disagree on ' + bad.length + ' unit(s), e.g. ' + JSON.stringify(bad[0].slice(0, 8))); } }
    }
    if(/\bother friendly\b|\banother friendly\b|\bbecause of this [a-z' -]+ model\b/.test(words) && !b.notSelf) out.push('“other” / “because of this model” and the box is not notSelf');
    if(S.ids.has('aura') && !['aura', 'selected'].includes(b.mark)) out.push('a reach by its aura\'s range and no aura mark'); }
  // a faction term's words (Pulse Jet's "pulse jet move"): had when the ability's sentence naming it is, quoted
  if(b.term && !S.q.some(q => q.includes(n(b.term)))) out.push('the words of ' + b.term + ' and no condition naming it');
  // once
  const ow = [words, n(src.tag)].join(' ');
  if(/\bonce per battle\b(?! round)/.test(ow) && !S.ids.has('oncePerBattle') && !quotedHas(/\bonce per battle\b/)) out.push('"once per battle" and no once-per-battle condition');
  if(/\bonce per turn\b/.test(ow) && !S.ids.has('oncePerTurn') && !quotedHas(/\bonce per turn\b/)) out.push('"once per turn" and no once-per-turn condition');
  if(/\bonce per battle round\b/.test(ow) && !quotedHas(/\bonce per battle round\b/)) out.push('"once per battle round" not quoted');
  // the phrases
  for(const P of PHRASES){ if(P.side && P.side !== side) continue;
    for(const m of pcw.matchAll(P.re)){ const ph = m[0].trim(), pn = n(ph), after = pcw.slice(m.index + m[0].length);
      if(m.index >= endAt) continue;
      if(P.what === 'clause'){
        // (not a condition of the effect, as GW's grammar says: "if any of the following apply" (its list is the box's condition: objective,
        // anyOf), a cost ("if that test is failed, that unit suffers …"), a definition ("… is said to be within Synapse Range"), a word the
        // sentence defines ("that model is damaged: while damaged"))
        if(/^if any of the following apply\b/.test(pn) && S.on.some(([id]) => id === 'objective' || id === 'anyOf')) continue;
        if(/^,?\s*(?:that unit|this unit|your unit|it|that model|this model) suffers\b/i.test(after)) continue;
        if(/^,?\s*that [^.]*? is said to be\b/i.test(after)) continue;
        { const w = /^while (\w+)$/.exec(pn); if(w && new RegExp('\\bis ' + w[1] + '\\b').test(words)) continue; }
        if(/^if (?:it|you|they) do(?:es)?\b/.test(pn)){ if(!S.ids.has('used') && !S.ids.has('bearerUses') && !quotedHas(/\bif (?:it|you|they) do/) && !S.q.length) out.push('“' + ph + '” and no used condition'); continue; }
        // (a clause about the attack's target, said by the target's keywords or a target condition)
        if(side === 'attack' && /\b(?:targets?|that target is)\b/.test(pn) && S.on.some(([id]) => id === 'targetKw' || /^target|^closest|^maxT$/.test(id))) continue;
      }
      if(P.what === 'exclusion'){
        // (its keywords in a condition's: nearFriendly's "not", the target's "none", the reach's "none"; "(excluding Psychic Attacks)": notPsychic)
        // (who can take an enhancement, "ORKS INFANTRY model only (excluding WEIRDBOY models)": the list's, not a condition of its effect)
        if(/\bmodel only $/.test(pcw.slice(Math.max(0, m.index - 12), m.index))) continue;
        if(/psychic attacks/.test(pn)){ if(!S.ids.has('notPsychic') && !quotedHas(/excluding psychic attacks/)) out.push('“' + ph + '” and no Not Psychic Attacks condition'); continue; }
        const ks = pn.replace(/^\(excluding |\)$/g, '').replace(/\bunits?$|\bmodels?$/, '').split(/\/|,? and |, | or /).map(k => k.trim().replace(/s$/, '')).filter(Boolean);
        if(ks.every(k => S.kws.some(x => x.replace(/s$/, '').includes(k) || k.includes(x.replace(/s$/, ''))) || S.q.some(q => q.includes(k)))) continue;
        // (weapons it is not for, "(excluding Extra Attacks weapons)": the box's scope wkwNot, that weapon keyword; other words: quoted)
        if(/\bweapons?\)$/.test(pn)){ const ex = X.weaponExcl(pn);
          if(!(ex && ex.kw && (b.scope || {}).wkwNot === ex.kw) && !quotedHas(new RegExp(pn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))) out.push('“' + ph + '”: weapons it excludes, and no wkwNot scope nor its words quoted');
          continue; }
        if(side === 'attack' && covers(ph, m.index)) continue;
        out.push('“' + ph + '” is no condition of the box'); continue; }
      // (a failed save is its own condition, failedSave, or quoted; what a unit can only target is GW's words, never another condition's)
      if(P.what === 'failed save'){ if(!S.ids.has('failedSave') && !quotedHas(/\bsaving throw\b/)) out.push('“' + ph + '” and no failed-save condition'); continue; }
      if(P.what === 'can only target'){ if(!S.q.some(q => q.includes(pn.slice(0, 25)) || pn.includes(q.slice(0, 25)))) out.push('“' + ph + '” not quoted'); continue; }
      if(!covers(ph, m.index)) out.push('“' + ph + '” is no condition of the box'); } }
  // within N"
  for(const m of words.matchAll(/\bwithin (\d+)"/g)){ const N = +m[1], at = words.slice(Math.max(0, m.index - 40), m.index + 60);
    if(/\b(?:range|move|moves|set up|more than)\b/.test(words.slice(Math.max(0, m.index - 25), m.index))) continue;
    if(/^[^.]*?\bis said to be\b/.test(words.slice(m.index))) continue;   // (a definition: "… is said to be within Synapse Range")
    const said = S.on.some(([id, p]) => (id === 'aura' && +p === N) || (id === 'nearFriendly' && p && +p.d === N) || (C[id] && C[id].pats.some(re => { const r = re.exec(words); return r && r[0].includes('within ' + N + '"'); })))
      || S.q.some(q => q.includes('within ' + N + '"')) || (b.reach && ['aura', 'selected'].includes(b.mark));
    if(!said) out.push('“…' + at.trim().slice(0, 70) + '…” and no condition within ' + N + '"'); }
  // kind (its clause's words; a duration's phase is no kind)
  const kinds = { melee:/\bmelee (?:attacks?|weapons?)\b|\bfight phase\b/, ranged:/\branged (?:attacks?|weapons?)\b|\bshooting phase\b/, psychic:/\bpsychic attacks?\b|\bpsychic weapons\b/ };
  const mine = (b.pick ? b.pick.flatMap(p => p.df || p.fx || []) : (b.df || b.fx || [])).map(([id]) => id);
  const segs = n(b.quote).split(/(?:,? and,? |; )(?=(?:until|that|each|all|models|melee|ranged|on a|weapons)\b)/);
  const effOf = sg => (side === 'defence' ? X.findDf(sg).df : X.findFx(sg).fx).map(([id]) => id);
  const own = segs.filter(sg => effOf(sg).some(id => mine.includes(id)));
  const kw = (own.length ? own.join(' ') : n(b.quote)).replace(X.DURATION_RE, ' ') + ' ' + n(lead).replace(X.DURATION_RE, ' ');
  const has = Object.entries(kinds).filter(([, re]) => re.test(kw.replace(/\(excluding psychic attacks\)/g, ' ').replace(/\bfeel no pain \d\+ (?:ability )?against [a-z ]+/g, ' '))).map(([k]) => k);
  if(has.length === 1){ const k = has[0], df = b.pick ? b.pick.flatMap(p => p.df || p.fx || []) : (b.df || b.fx || []);
    const labelSays = df.length && df.every(([id]) => (k === 'ranged' && /Ranged$/.test(id)) || (k === 'psychic' && /^fnpPsy/.test(id)) || (k === 'ranged' && E.FX[id] && ['range', 'bsSet', 'assault', 'heavy', 'indirect', 'pistol'].includes(id)));
    if(b.kind !== k && !labelSays && !quotedHas(kinds[k]) && !(side === 'attack' && k === 'psychic' && (b.scope || {}).wkw === 'PSYCHIC') && !(src.type === 'strat'))
      out.push('its words say ' + k + ' attacks, the box is for ' + b.kind); }
  // how long it lasts, beyond the phase, as GW states it: its own words (the quote, the line it continues) or, for an option of its rule (a
  // table row, a bold option, a pick) whose own words say none, the sentence of the rule that says how long its options last ("Once
  // activated, each Blessing of Khorne applies … until the end of the battle round"): the attack side's lasts ('battle', 'round', 'turn'),
  // the defence side's until
  { const durOf = t => /\buntil the end of the battle\b(?! round)/.test(t) ? 'battle' : /\buntil the (?:end of the battle round|start of your next (?:command|movement) phase|start of your next turn)\b/.test(t) ? 'round'
      : /\buntil the end of (?:the|your opponent's next) turn\b|\bthis turn\b/.test(t) && !/\buntil the end of the phase\b/.test(t) ? 'turn' : '';
    const isOpt = !!(opt || b.pick || b.tableRows || S.ids.has('opt'));
    const ruleDur = () => { if(src.type === 'strat') return ''; for(const l of String(src.text || '').split('\n')){ if(/^\*[^*]/.test(l.trim())) continue;
      for(const x of l.split(/(?<=[.!?])\s+/)){ const w = n(x).replace(/\bthis turn\b/g, ' '); if(/\b(?:abilit(?:y|ies)|active|appl(?:y|ies)|the following|below)\b/.test(w) && durOf(w)) return durOf(w); } } return ''; };
    // (its own words: the quote, the line it continues, a stratagem's WHEN and TARGET; a pick's quotes)
    const own = n([lead, b.quote].concat((b.pick || []).map(p => p.quote || ''), src.type === 'strat' ? [src.when || '', src.target || ''] : []).join(' '));
    const want = durOf(own) || (isOpt && !/\buntil the end of the phase\b/.test(own) ? ruleDur() : '');
    if(want && side === 'defence' && !b.until) out.push('GW states a duration (' + want + ') and the box has no until');
    // (both ways: a box never lasts longer, nor shorter, than GW says)
    if(side === 'attack' && (b.lasts || '') !== want) out.push('GW states ' + (want ? 'a duration (' + want + ')' : 'no duration beyond the phase') + ' and the box lasts ' + JSON.stringify(b.lasts || 'the phase'));
    if(side === 'defence' && b.until && !want) out.push('GW states no duration beyond the phase and the box has until “' + b.until + '”'); }
  // a stratagem's WHEN beyond its standard trigger, its TARGET's where (the defence side: a quoted condition, or one that reads it)
  if(side === 'defence' && src.type === 'strat'){ const w = pc(src.when).split(/(?<=\.)\s+/)[0].replace(/\.\s*$/, ''), rest = n(w).replace(/^(?:any phase|(?:(?:start|end) of )?(?:your opponent's |your |the )?(?:command|movement|shooting|charge|fight) phase(?: or the (?:shooting|fight) phase)?),?\s*/, '');
    if(rest && !/^(?:just after|when) an enemy unit (?:has selected its targets|targets a friendly [^.]+? unit(?: \([^)]*\))?)$/.test(rest) && !covers(w, 0) && !S.q.some(q => q.includes(n(w).slice(0, 25)))) out.push('its WHEN “' + w + '” is no condition of the box');
    const t = pc(src.target).replace(/\.\s*$/, ''); if(/\bwithin (?:engagement range|\d+") of\b/.test(n(t)) && !S.q.some(q => q === n(t))) out.push('its TARGET “' + t.slice(0, 60) + '” is no condition of the box'); }
  return out;
}
// a stratagem's source-level gap: a unit it protects that is not its TARGET (its WHEN's "targets a friendly X unit", its TARGET's "of a
// friendly X unit that was selected as the target") and no dreach
function srcGaps(o, src){
  if(src.type !== 'strat' || !(o.d || []).length) return [];
  const tn = n(src.target), other = /\bof a friendly .+? unit that was selected as the target\b/.test(tn) || (/\bwhen an enemy unit targets a friendly\b/.test(n(src.when)) && !/^that\b/.test(tn));
  return other && !o.dreach ? ['it protects a unit that is not its TARGET and has no dreach'] : [];
}
// a source's sentences with words of the numbers that are neither counted nor listed not counted (never silent): every sentence of its words
// (a rule's table rows, a stratagem's EFFECT) that names a hit, wound or damage roll, AP, a save, Feel No Pain, OC, Move, a weapon ability
// ("[LANCE]"), the Benefit of Cover, a critical hit or wound, or the Attacks or Strength characteristic is quoted by one of its BOXES entries: a box (b, d, st:
// its quote, a pick's or a part's) or a not-counted one (nc, dnc, snc). Read by its own words, not the extractor's; not a weapon's profile
// line, a designer's note or an example, nor a line that leads a list (":"), whose bullets are its words. Quoted means whole: a quote that
// is the sentence or holds it, or quotes inside it that leave no words of the numbers
const NUM_WORDS = /\bbenefit of cover\b|\b(?:hit|wound|damage) rolls?\b|\barmou?r penetration\b|\bap\b|\bdamage characteristic\b|\bsaving throws?\b|\bsave rolls?\b|\binvulnerable saves?\b|\bfeel no pain\b|\bobjective control\b|\boc\b|\bmove characteristic\b|(?:^|\s)[+-]\d+"? m\b|\[[a-z][a-z -]*?(?: \d\+?| d3)?\]|\bcritical (?:hit|wound)s?\b|\b(?:attacks|strength) characteristics?\b/;
const key = t => n(String(t).replace(/^\s*-\s+/, '')).replace(/^[^:"]{1,40}:\s+/, '').replace(/[.\s]+$/, '').trim();
// (the characteristics a sentence names: "Objective Control characteristic", "Leadership and Objective Control characteristics", "+1 OC")
const STAT_NAMES = /\b(move|objective control|toughness|wounds|leadership)\b(?=[^.;]*?\bcharacteristics?\b)|(?:^|\s)[+-]\d+"? (oc|m|ld|w|t)\b/g;
const STAT_KEY = { move:'M', 'objective control':'OC', toughness:'T', wounds:'W', leadership:'Ld', oc:'OC', m:'M', ld:'Ld', w:'W', t:'T' };
function silent(src, o){
  o = o || {};
  const qs = [].concat(o.b || [], o.d || [], o.st || [], o.nc || [], o.dnc || [], o.snc || []).flatMap(b => [b.quote, b.part && b.part.quote].concat((b.pick || []).flatMap(p => [p.quote, p.part && p.part.quote])))
    .filter(Boolean).flatMap(q => String(q).split('\n')).map(key).filter(Boolean);
  const text = src.type === 'strat' ? src.effect : [src.text || ''].concat((src.table || []).map(r => r.slice(1).join('\n'))).join('\n');
  return X.sentencesOf(text).map(u => u.s).filter(s => { const w = n(s), k = key(s);
    if(!NUM_WORDS.test(w) || /\b\d+" a[\dd]+ (?:bs|ws)\d\+|\bmelee a[\dd]+ ws\d\+/.test(w) || /^(?:designer's note|example):/.test(w) || /:\s*$/.test(w)) return false;
    // (a quote covers the sentence whole, or the quotes inside it do, and what they leave has no words of the numbers: a fragment, "that enemy
    // unit", does not)
    // (a sentence only not-counted stat entries quote: each characteristic it names is one of theirs, "OC … and its Leadership": OC and Ld)
    const sn = (o.snc || []).filter(x => { const q = key(x.quote); return q.includes(k) || k.includes(q); });
    if(sn.length && !qs.some(q => (q.includes(k) || k.includes(q)) && !sn.some(x => key(x.quote) === q))){
      const named = [...new Set([...w.matchAll(STAT_NAMES)].map(m => STAT_KEY[m[1] || m[2]]))];
      if(named.some(st => !sn.some(x => x.stat === st))) return true; }
    if(qs.some(q => q.includes(k))) return false;
    let rest = k; for(const q of qs.filter(q => k.includes(q)).sort((a, b) => b.length - a.length)) rest = rest.split(q).join(' ');
    return rest === k || NUM_WORDS.test(rest); });
}
module.exports = { gaps, srcGaps, optionOf, counts, silent, NUM_WORDS };
