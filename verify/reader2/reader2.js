#!/usr/bin/env node
// ISOLATION (verify/reader2/, release tooling of the two-reader rule, verify/agree.js): this reader must never import the app's reading
// code (verify/effects-extract.js, effects-migrate.js, coverage.js, evidence.js, lines.js, defence.js, derive.js) nor read data.js BOXES.
// The gate step agree fails if it does (check R1). Its code is kept as it was written (scratchpad reader2, round 4); run it with
// KODEX_APP=<this repo> KODEX_CACHE=<this repo>/verify/.cache, as the gate does.
/* reader2.js: an independent second reader of Warhammer 40,000 (11th edition) rules sentences for Kunnin' Kodex.

   Written from GW's text and the Core Rules only. It shares the app's effect *vocabulary* (FX / COND / DF / DCOND / ST /
   STCOND ids and value shapes, read from the labels in effects.js) but none of its matching code.

   For every source sentence it outputs either
     status:'read'   — the whole sentence was consumed by the grammar below (effects, attack kind, conditions, reach,
                       duration, side), or it is a sentence with no effect of its own (restriction, selection, lead-in, note);
     status:'unread' — with `reason`: 'outside-vocabulary:<topic>' (it was understood to be about something the vocabulary
                       has no effect for) or 'unparsed:<the words left over>' (the grammar could not consume it). Never a guess.

   Usage:  node reader2.js            write readings2.json next to this file, print coverage
           node reader2.js --test     run the unit tests
           node reader2.js --check    exit 1 if the readings differ from readings2.json (release check)
           node reader2.js --say "<sentence>"   read one sentence
   Deterministic: no network, no clock, no randomness; sources in data.js order. */
'use strict';
const fs = require('fs'), path = require('path');

/* ------------------------------------------------------------------ text normalisation ------------------------------- */

// Words in capitals that are not keywords (characteristic abbreviations, headings).
const NOT_KW = new Set(['AP', 'OC', 'CP', 'BS', 'WS', 'BTP', 'FNP', 'FAQ', 'KEYWORDS', 'II', 'III', 'IV', 'VP', 'D3', 'D6']);
const PLURAL = { MONSTERS:'MONSTER', VEHICLES:'VEHICLE', CHARACTERS:'CHARACTER', WALKERS:'WALKER', PSYKERS:'PSYKER', SWARMS:'SWARM',
  TITANICS:'TITANIC', BEASTS:'BEASTS', DAEMONS:'DAEMON' };

function plain(t){
  return String(t == null ? '' : t)
    .replace(/~~[^~]*~~/g, '').replace(/\(excluding\s*\/\s*/g, '(excluding ').replace(/\*\*\s*\/\s*\*\*/g, '/')
    .replace(/\*\*|~~|__/g, '')
    .replace(/[’‘`]/g, "'").replace(/[“”]/g, '"')
    .replace(/[‐‑‒–—−]/g, '-').replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ').trim();
}

// Turn a plain sentence into the token form the grammar reads: [ABILITY] → ⟪ability⟫, keyword runs → ⟦KW RUN⟧,
// everything else lower case.
let TITLE_RE = null;
function titleKeywords(s){
  if(!TITLE_RE){
    const words = [...known()].filter(k => k.length >= 4 && /^[A-Z][A-Z' -]+$/.test(k)).sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
    TITLE_RE = words.length ? new RegExp("\\b(" + words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ")(?= (?:units?|models?)\\b)", 'gi') : /$^/;
  }
  return s.replace(TITLE_RE, w => w.toUpperCase());
}
function tokenise(s){
  s = titleKeywords(s);
  const brackets = [];
  s = s.replace(/\[([^\]]+)\]/g, (m, x) => { brackets.push(x.toLowerCase().trim()); return '\u0001' + (brackets.length - 1) + '\u0002'; });
  // keyword runs: consecutive capitalised words of 2+ letters (allowing ' and -) separated by single spaces
  const W = "[A-Z][A-Z'\\-]*[A-Z]";
  s = s.replace(new RegExp('\\b' + W + '(?: ' + W + ')*\\b', 'g'), run => {
    const words = run.split(' ').filter(w => !NOT_KW.has(w));
    if(words.length !== run.split(' ').length) return run.split(' ').map(w => NOT_KW.has(w) ? w : '\u0003' + w + '\u0004').join(' ');
    return '\u0003' + run + '\u0004';
  });
  s = s.replace(/[^\u0003\u0004]+(?=\u0003)|[^\u0003\u0004]+$/g, x => x); // (no-op: keeps structure explicit)
  // lower-case outside keyword runs
  let out = '', inKw = false;
  for(const ch of s){
    if(ch === '\u0003'){ inKw = true; out += '⟦'; continue; }
    if(ch === '\u0004'){ inKw = false; out += '⟧'; continue; }
    out += inKw ? ch : ch.toLowerCase();
  }
  out = out.replace(/\u0001(\d+)\u0002/g, (m, i) => '⟪' + brackets[+i] + '⟫');
  out = out.replace(/⟧\/⟦/g, '⟧/⟦');
  return out.replace(/\s+/g, ' ').trim();
}

const deplural = w => PLURAL[w] || w;
// Known keywords (from the datasheets' keyword lines) so a run splits into keywords, longest first.
let KNOWN = null;
function known(){ if(!KNOWN){ try { KNOWN = new Set(require(path.join(__dirname, 'sources.js')).listKeywords()); } catch(e){ KNOWN = new Set(); } } return KNOWN; }
function splitRun(run){
  const w = run.split(' '), out = [];
  for(let i = 0; i < w.length;){
    let j = w.length;
    for(; j > i; j--){ const cand = w.slice(i, j).join(' '); if(known().has(cand) || known().has(deplural(cand)) || (j - i === 1 && known().has(deplural(w[i])))) break; }
    if(j === i){ return [run]; } // a word the datasheets never print: keep the run whole
    out.push(deplural(w.slice(i, j).join(' '))); i = j;
  }
  return out;
}

/* ------------------------------------------------------------------ keyword expressions ------------------------------ */

const K = '⟦[^⟧]+⟧';
const KX = K + '(?:(?:, |/|,? or |,? and )' + K + ')*';
// "(excluding ⟦A⟧ units)", "(excluding ⟦A⟧ and ⟦B⟧)", "(excluding battle-shocked units)"
const EXCL = ' \\(excluding (' + KX + ')(?: (?:units?|models?))?\\)';

// '⟦A⟧/⟦B⟧' → { any:['A','B'] } ; '⟦A B⟧' → { all:['A','B'] } ; and-lists only where `andIsOr`
function kwExpr(str, opts){
  opts = opts || {};
  const runs = [], seps = [];
  const re = new RegExp('(' + K + ')|(, |/|,? or |,? and )', 'g'); let m;
  while((m = re.exec(str))){ if(m[1]) runs.push(m[1].slice(1, -1)); else seps.push(m[2].trim().replace(/^,\s*/, '') || ','); }
  if(!runs.length) return null;
  const hasAnd = seps.some(x => x === 'and');
  if(hasAnd && !opts.andIsOr) return { ambiguous:true, runs };
  if(runs.length === 1){ const w = splitRun(runs[0]); return w.length === 1 ? { any:w } : { all:w }; }
  // "INFANTRY/MOUNTED THOUSAND SONS PSYKER": a slash binds the keywords next to it, the rest are shared by all
  if(seps.every(x => x === '/')){
    const parts = runs.map(splitRun), first = parts[0], last = parts[parts.length - 1];
    const pre = first.slice(0, -1), post = last.slice(1);
    if(pre.length || post.length){
      const mid = parts.map((p, i) => i === 0 && i === parts.length - 1 ? p : i === 0 ? p.slice(-1) : i === parts.length - 1 ? p.slice(0, 1) : p);
      if(mid.every(p => p.length === 1)) return { all:pre.concat([{ any:mid.map(p => p[0]) }], post) };
    }
  }
  return { any:runs.map(r => splitRun(r).join(' + ')) };
}
function kwList(str){ const e = kwExpr(str, { andIsOr:true }); return e ? (e.any || [e.all.join(' ')]) : []; }

/* ------------------------------------------------------------------ vocabulary --------------------------------------- */

const BRACKET_FX = [
  [/^lethal hits$/, () => ['lethal', true]],
  [/^devastating wounds$/, () => ['dev', true]],
  [/^twin-linked$/, () => ['twin', true]],
  [/^lance$/, () => ['lance', true]],
  [/^precision$/, () => ['precision', true]],
  [/^ignores? cover$/, () => ['ignoresCover', true]],
  [/^heavy$/, () => ['heavy', true]],
  [/^hazardous$/, () => ['hazardous', true]],
  [/^indirect fire$/, () => ['indirect', true]],
  [/^assault$/, () => ['assault', true]],
  [/^pistol$/, () => ['pistol', true]],
  [/^sustained hits (1|2|d3)$/, m => ['sus', m[1] === 'd3' ? 'D3' : m[1]]],
  [/^cleave (\d)$/, m => ['cleave', +m[1]]],
  [/^anti-([a-z][a-z \-]*?) (\d)\+$/, m => ['anti', m[1].toUpperCase() + ' ' + m[2] + '+']]
];
function bracketFx(word){
  let q = null, m0;
  if((m0 = /^(.+?): non-([a-z][a-z -]*(?:\/[a-z][a-z -]*)*)$/.exec(word))){ word = m0[1]; q = { targetKw:{ none:m0[2].split('/').map(x => deplural(x.trim().toUpperCase())) } }; }
  else if((m0 = /^(.+?): ([a-z][a-z -]*(?:\/[a-z][a-z -]*)*)$/.exec(word))){ word = m0[1]; q = { targetKw:{ any:m0[2].split('/').map(x => deplural(x.trim().toUpperCase())) } }; }
  else if(/:/.test(word)) return null;
  for(const [re, f] of BRACKET_FX){ const m = re.exec(word); if(m){ const e = f(m); return q ? [e[0], e[1], q] : e; } }
  return null;
}
const num = x => /^d\d$/i.test(x) ? x.toUpperCase() : +x;
const ROLL = { hit:'hit', wound:'wound' };
const CHAR = { attacks:'a', strength:'s', 'armour penetration':'ap', damage:'d', ap:'ap', a:'a', s:'s', d:'d' };

/* ------------------------------------------------------------------ the reading object -------------------------------- */

class Unread extends Error { constructor(reason){ super(reason); this.reason = reason; } }
const outside = topic => { throw new Unread('outside-vocabulary:' + topic); };

function newReading(){
  return { status:'read', kind:'effect', effects:[], attack:null, side:null, reach:null, conditions:[], duration:null };
}
// A referent ("that unit", "it") remembers the sentence that set it and the conditions it was set under, so a later
// sentence using it carries them: a reading is never looser than its words.
// "unless X": the condition X, negated (vocabulary pairs where they exist)
function negate(c){
  const PAIR = { battleShocked:{ id:'notShocked', table:'STCOND' }, targetBelowHalf:{ id:'targetNotBelowHalf', table:'COND' } };
  if(PAIR[c.id]) return Object.assign({}, PAIR[c.id]);
  return Object.assign({}, c, { negated:true });
}
const sentOf = ctx => (ctx.sentNo == null ? 0 : ctx.sentNo);
function setRef(ctx, slot, reach, via){ reach._sent = sentOf(ctx); reach._via = (via || []).map(c => Object.assign({}, c)); ctx[slot] = reach; return reach; }
function useRef(ctx, ref){ if(ref){ (ctx.usedRefs = ctx.usedRefs || []).push(ref); } return ref; }
let CTX = {};
const cond = (r, id, v, table) => { r.conditions.push(v === undefined ? { id, table:table || 'COND' } : { id, v, table:table || 'COND' }); };

/* ------------------------------------------------------------------ subjects (reach) --------------------------------- */

// Each returns { reach, len, plural } for the subject at the start of s, or null.
function subject(s, ctx){
  const res = subject0(s, ctx);
  if(res){
    const m = new RegExp('^' + EXCL).exec(s.slice(res.len));
    if(m){ res.reach = Object.assign({}, res.reach, { excluding:(res.reach.excluding || []).concat(kwList(m[1])) }); res.len += m[0].length; }
  }
  return res;
}
function subject0(s, ctx){
  let m;
  const R = (reach, len, extra) => Object.assign({ reach, len }, extra || {});
  const ofRange = (rng, of) => ({ range:+rng, of:of });
  const OF = '(this model|this unit|the bearer|your unit|that model|that unit|the bearer\'s unit)';
  // friendly ⟦X⟧ units (excluding …) (with this ability) (from your army) (within N" of …)
  if((m = new RegExp('^(?:models in |each model in |all models in |an? )?(?:other )?friendly (?:(' + KX + ') )?(units?|models?)(?:' + EXCL + ')?( with this ability)?( from your army)?(?: within (\\d+)" of ' + OF + ')?').exec(s))){
    const reach = { type:m[6] ? 'aura' : m[5] ? 'army' : 'friendly', unitsOrModels:m[2].startsWith('model') ? 'models' : 'units' };
    if(m[1]){ const k = kwExpr(m[1]); if(k.ambiguous) throw new Unread('unparsed:keyword list joined by "and": ' + m[1]); reach.kw = k; }
    if(m[3]) reach.excluding = kwList(m[3]);
    if(m[4]) reach.withThisAbility = true;
    if(m[6]){ reach.range = +m[6]; reach.of = m[7]; }
    if(/other friendly/.test(m[0])) reach.other = true;
    return R(reach, m[0].length);
  }
  if((m = new RegExp('^(?:models in )?(' + KX + ') (units?|models?)(?:' + EXCL + ')? from your army').exec(s))){
    const k = kwExpr(m[1], { andIsOr:true });
    const reach = { type:'army', kw:k, unitsOrModels:m[2].startsWith('model') ? 'models' : 'units' };
    if(m[3]) reach.excluding = kwList(m[3]);
    return R(reach, m[0].length);
  }
  if((m = /^(?:each |all )?(units|models) from your army(?: with this ability)?/.exec(s))) return R({ type:'army', unitsOrModels:m[1] }, m[0].length);
  if((m = /^(?:each |all )?(?:models in |each model in |a model in )?this model's unit/.exec(s))) return R({ type:'unit', of:'this model' }, m[0].length);
  if((m = new RegExp("^(?:models in |each model in |a model in |all models in )?the bearer's unit(?:" + EXCL + ')?').exec(s))) return R(m[1] ? { type:'bearerUnit', excluding:kwList(m[1]) } : { type:'bearerUnit' }, m[0].length);
  if((m = /^the bearer/.exec(s))) return R({ type:'bearer' }, m[0].length);
  if((m = /^this model/.exec(s))) return R({ type:'self' }, m[0].length);
  if((m = new RegExp('^(?:each |an? )?(' + KX + ') models? in this unit').exec(s))) return R({ type:'models', kw:kwExpr(m[1], { andIsOr:true }), of:'this unit' }, m[0].length);
  if((m = /^(?:models in |each model in |a model in |all models in )?this unit/.exec(s))) return R({ type:'unit' }, m[0].length);
  if((m = new RegExp('^(?:each |an? )?(' + KX + ') models? in (?:that|those) units?').exec(s)) && ctx.ref) return R(Object.assign({}, useRef(ctx, ctx.ref), { models:true, modelKw:kwExpr(m[1], { andIsOr:true }) }), m[0].length);
  if((m = new RegExp('^(?:models in |each model in |a model in |all models in )?your (?:(' + KX + ') )?unit(?!s)').exec(s))){
    const target = ctx.stratTarget;
    const reach = { type:'unit', of:'stratagem target' };
    if(target){ for(const k of ['kw', 'excluding', 'qualifier']) if(target[k]) reach['target' + k.charAt(0).toUpperCase() + k.slice(1)] = target[k]; if(target.unparsed) reach.targetText = target.text; }
    if(m[1]){
      const k = kwExpr(m[1], { andIsOr:true }), words = (k.any || k.all || []).join(' ');
      const has = e => !!e && JSON.stringify(e).includes(words);
      const sel = ctx.ref && ctx.ref.selection && !ctx.ref.enemy ? ctx.ref : null;
      if(sel && has(sel.kw) && !(target && has(target.kw))) return R(Object.assign({}, useRef(ctx, sel)), m[0].length);
      if(sel && !(target && has(target.kw))) throw new Unread('unparsed:"your ' + clean(m[1]) + ' unit" could be the stratagem\'s target or the unit selected');
      reach.kw = k;
    }
    return R(reach, m[0].length);
  }
  if((m = /^that model\b/.exec(s)) && ctx.refModel) return R(Object.assign({}, useRef(ctx, ctx.refModel)), m[0].length);
  if((m = new RegExp('^(?:models in |each model in |a model in |all models in )?(?:that|those) (?:(' + KX + ') )?(enemy )?(units?|models?)').exec(s))){
    // "LEGIO CYBERNETICA units from your army … unless that unit …": a plural subject is read distributively
    const ref = m[2] ? ctx.refEnemy : (ctx.ref || (ctx.lastSubject && ['army', 'friendly'].includes(ctx.lastSubject.type) && !/those/.test(m[0]) ? ctx.lastSubject : null));
    if(!ref) throw new Unread('unparsed:"' + m[0] + '" refers to a unit no earlier sentence selected');
    useRef(ctx, ref);
    const reach = Object.assign({}, ref);
    if(m[1]) reach.kw = kwExpr(m[1], { andIsOr:true });
    if(/model/.test(m[3]) && !/in /.test(m[0])) reach.models = true;
    return R(reach, m[0].length);
  }
  if((m = /^(?:that model|it)\b/.exec(s)) && ctx.refModel) return R(Object.assign({}, useRef(ctx, ctx.refModel)), m[0].length);
  if((m = /^that (⟦[^⟧]+⟧)(?! (?:unit|model))/.exec(s)) && ctx.refLeaderKw === m[1]) return R(Object.assign({}, useRef(ctx, ctx.refModel)), m[0].length);
  if((m = /^(?:models in |all models in )(?:it|them)\b/.exec(s)) && ctx.lastSubject) return R(Object.assign({}, ctx.lastSubject), m[0].length);
  if((m = /^this (⟦[^⟧]+⟧)(?! (?:unit|model))/.exec(s))) return R({ type:'self' }, m[0].length);
  if((m = /^it\b/.exec(s)) && ctx.lastSubject) return R(Object.assign({}, ctx.lastSubject), m[0].length);
  return null;
}

const subjOf = w => ({ 'this model':{ type:'self' }, 'the bearer':{ type:'bearer' }, "the bearer's unit":{ type:'bearerUnit' }, "this model's unit":{ type:'unit', of:'this model' }, 'your unit':{ type:'unit', of:'stratagem target' } })[w] || { type:'unit' };

/* ------------------------------------------------------------------ attack targets ("that targets …") ---------------- */

function targetPhrase(s, r){
  let m;
  const ctx = CTX;
  if((m = /^the enemy unit that just destroyed your (⟦[^⟧]+⟧ )?unit/.exec(s))){ cond(r, 'targetDestroyedYourUnit', m[1] ? clean(m[1].trim()) : true, 'own'); return m[0].length; }
  if((m = /^(?:that|the selected|the) enemy unit|^that unit|^your mark|^the selected unit|^(?:its victim|your machine vengeance target|its quarry|its prey|that target|the marked unit)|^(?:this model's|its|your) (?:mark|prey|quarry|victim)\b/.exec(s))){
    const ref = ctx.refEnemy || (ctx.ref && ctx.ref.selection ? ctx.ref : null);
    if(!ref) throw new Unread('unparsed:"' + clean(m[0]) + '" refers to a unit no earlier sentence selected');
    useRef(ctx, ref); cond(r, 'targetSelected');
    return m[0].length;
  }
  const T = [
    [/^the closest eligible target within 18"/, () => cond(r, 'closest18')],
    [/^the closest eligible target/, () => cond(r, 'closest')],
    [/^(?:that|the selected|the) enemy unit|^that unit|^your mark|^the selected unit/, () => cond(r, 'targetSelected')],
    [/^an? (?:enemy )?unit that is below half-strength|^an? (?:enemy )?unit that is below half strength/, () => cond(r, 'targetBelowHalf')],
    [/^an? (?:enemy )?unit that is not below half-strength/, () => cond(r, 'targetNotBelowHalf')],
    [/^an? (?:enemy )?unit that is below its starting strength/, () => cond(r, 'targetBelowStarting')],
    [/^an? (?:enemy )?unit (?:that is )?within range of an objective marker you do not control/, () => cond(r, 'targetObjectiveNotYours')],
    [/^an? (?:enemy )?unit (?:that is )?within range of an objective(?: marker)?/, () => cond(r, 'targetObjective')],
    [/^an? (?:enemy )?unit/, () => {}]
  ];
  // keyword target: "a ⟦X⟧ unit", "an ⟦A⟧, ⟦B⟧ or ⟦C⟧ unit", "a unit (excluding ⟦X⟧ units)", "an enemy ⟦X⟧ unit"
  if((m = new RegExp('^an? (?:enemy )?(' + KX + ') (?:unit|model)(?:' + EXCL + ')?').exec(s))){
    const k = kwExpr(m[1], { andIsOr:true }); cond(r, 'targetKw', k);
    if(m[2]) cond(r, 'targetKw', { none:kwList(m[2]) });
    return m[0].length;
  }
  if((m = new RegExp('^an? (?:enemy )?unit(?:' + EXCL + ')? (?:that is )?below half-strength').exec(s))){ if(m[1]) cond(r, 'targetKw', { none:kwList(m[1]) }); cond(r, 'targetBelowHalf'); return m[0].length; }
  if((m = new RegExp('^an? (?:enemy )?unit' + EXCL).exec(s))){ cond(r, 'targetKw', { none:kwList(m[1]) }); return m[0].length; }
  if((m = /^an? (dreadful foe|prosecuted|aflame|disrupted|marked) unit/.exec(s))){ cond(r, 'targetState', m[1], 'own'); return m[0].length; }
  if((m = /^an? (?:enemy )?unit that is battle-shocked/.exec(s))){ cond(r, 'targetBattleShocked', true, 'own'); return m[0].length; }
  if((m = /^an? (?:enemy )?unit (?:that is )?within range of one or more objective markers/.exec(s))){ cond(r, 'targetObjective'); return m[0].length; }
  if((m = /^an? (?:enemy )?unit that can (⟦[^⟧]+⟧)/.exec(s))){ cond(r, 'targetKw', { any:[m[1].slice(1, -1)] }); return m[0].length; }
  if((m = /^an? (?:enemy )?unit within (\d+)"(?: of (this unit|your unit|this model))?/.exec(s))){ cond(r, 'targetWithin', m[2] ? { d:+m[1], of:m[2] } : +m[1], 'own'); return m[0].length; }
  if((m = /^(?:this model's|its|your) (mark|prey|quarry|victim)\b/.exec(s))){ cond(r, 'targetSelected'); return m[0].length; }
  if((m = /^an? (?:enemy )?unit with an? (?:t|toughness(?: characteristic)?) greater than (?:this|your) (?:unit's|model's) (?:t|toughness(?: characteristic)?)/.exec(s))){ cond(r, 'targetTGreater', true, 'own'); return m[0].length; }
  if((m = /^an? (?:enemy )?unit that (?:has|contains) no models with an? (?:t|toughness(?: characteristic)?) of (\d+)\+/.exec(s))){ cond(r, 'maxT', +m[1]); return m[0].length; }
  if((m = /^(?:its victim|your machine vengeance target|its quarry|that target|the marked unit)/.exec(s))){ cond(r, 'targetSelected'); return m[0].length; }
  for(const [re, f] of T){ if((m = re.exec(s))){ f(); return m[0].length; } }
  return 0;
}

/* ------------------------------------------------------------------ effect phrases ----------------------------------- */

// 10th-edition "each time … makes an attack, <effect>" effect phrases. Returns { len, fx:[[id,v]] } or null.
function attackEffect10(s){
  let m;
  const E = [
    [/^(?:you can )?add (\d|d3) to the (hit|wound) roll(?: as well)?/, m => [[ROLL[m[2]], num(m[1])]]],
    [/^(?:you must )?subtract (\d) from the (hit|wound) roll(?: as well)?/, m => [[ROLL[m[2]], -m[1]]]],
    [/^(?:you can )?re-roll the hit roll and (?:you can )?re-roll the wound roll/, () => [['rrHit', true], ['rrWound', true]]],
    [/^(?:you can )?re-roll one hit roll or (?:you can re-roll )?one wound roll(?: when resolving those attacks)?/, () => [['oneEither', true]]],
    [/^(?:you can )?re-roll one (hit|wound|damage) roll(?: when resolving those attacks)?/, m => [[{ hit:'oneHit', wound:'oneWound', damage:'oneDmg' }[m[1]], true]]],
    [/^(?:you can )?re-roll the (hit|wound|damage) roll(?: as well)?/, m => [[{ hit:'rrHit', wound:'rrWound', damage:'rrDmg' }[m[1]], true]]],
    [/^(?:you can )?re-roll an? (hit|wound) roll of 1/, m => [[m[1] === 'hit' ? 'rrHit1' : 'rrWound1', true]]],
    [/^an? (?:successful )?unmodified hit roll of (\d)\+ scores a critical hit(?: as well)?/, m => [['critHit', +m[1]]]],
    [/^an? (?:successful )?unmodified wound roll of (\d)\+ scores a critical wound(?: as well)?/, m => [['critWound', +m[1]]]],
    [/^each successful unmodified wound roll is a critical wound/, () => [['critWoundAll', true]]],
    [/^a critical hit is scored on an unmodified hit roll of (\d)\+/, m => [['critHit', +m[1]]]],
    [/^a critical wound is scored on an unmodified wound roll of (\d)\+/, m => [['critWound', +m[1]]]],
    [/^an? successful hit roll scores a critical hit/, () => [['NC.everyCrit', true]]],
    [/^(?:that attack|the attacking weapon|that weapon) has (?:the )?((?:⟪[^⟫]+⟫(?:,? and |, )?)+)(?: abilit(?:y|ies))?/, m => bracketList(m[1])],
    [/^(?:add|increase) (\d|d3) to (?:the )?((?:attacks|strength|armour penetration|damage)(?:(?:, | and )(?:attacks|strength|armour penetration|damage))*) characteristics? of that (?:attack|weapon)/,
      m => charList(m[2]).map(c => [c, num(m[1])])],
    [/^improve the ((?:strength|armour penetration|damage|attacks)(?:(?:, | and )(?:strength|armour penetration|damage|attacks))*) characteristics? of that (?:attack|weapon) by (\d)/,
      m => charList(m[1]).map(c => [c, +m[2]])],
    [/^you can ignore any or all modifiers to the hit roll and any or all modifiers to the (?:ballistic|weapon) skill characteristic of that (?:weapon|attack)/, () => [['ignoreHitMods', true]]],
    [/^you can ignore any or all modifiers to (?:that model's|the) (?:ballistic skill|weapon skill|ballistic skill or weapon skill) characteristics? and(?: any or all modifiers to)? the hit roll/, () => [['ignoreHitMods', true]]]
  ];
  for(const [re, f] of E){ if((m = re.exec(s))) return { len:m[0].length, fx:f(m) }; }
  return null;
}
function bracketList(str){
  const out = [];
  for(const w of str.match(/⟪[^⟫]+⟫/g)){
    const f = bracketFx(w.slice(1, -1));
    if(!f) outside('weapon ability ' + w);
    out.push(f);
  }
  return out;
}
function charList(str){ return str.split(/, | and /).map(c => CHAR[c.trim()]); }

// 11th-edition "<x>'s attacks have / can <effect>" phrases (attack side).
function attackEffect11(s){
  let m;
  const E = [
    [/^have ([+-])(\d) to (hit|wound) rolls/, m => [[m[3], (m[1] === '-' ? -1 : 1) * m[2]]]],
    [/^have \+(\d|d3) ((?:ap|a|s|d)(?:(?:, | and )(?:ap|a|s|d))+)\b/, m => m[2].split(/, | and /).map(c => [CHAR[c], num(m[1])])],
    [/^have \+(\d|d3) (ap|a|s|d|attacks|strength|damage)\b/, m => [[CHAR[m[2]], num(m[1])]]],
    [/^have \+(\d+)" (?:r|range)\b/, m => [['range', +m[1]]]],
    [/^have \+(\d) (ws|bs)\b/, m => [['skill', +m[1]]]],
    [/^have ((?:⟪[^⟫]+⟫(?:,? and |, )?)+)(?: abilit(?:y|ies))?/, m => bracketList(m[1])],
    [/^can re-roll hit rolls and wound rolls/, () => [['rrHit', true], ['rrWound', true]]],
    [/^can re-roll (hit|wound) rolls of 1/, m => [[m[1] === 'hit' ? 'rrHit1' : 'rrWound1', true]]],
    [/^can re-roll (hit|wound|damage) rolls/, m => [[{ hit:'rrHit', wound:'rrWound', damage:'rrDmg' }[m[1]], true]]],
    [/^can re-roll one (hit|wound|damage) roll/, m => [[{ hit:'oneHit', wound:'oneWound', damage:'oneDmg' }[m[1]], true]]],
    [/^can re-roll one hit roll or one wound roll|^can re-roll one hit or wound roll/, () => [['oneEither', true]]],
    [/^can ignore modifiers to (?:their |its )?hit rolls and wound rolls/, () => [['ignoreHitRollMods', true], ['ignoreWoundMods', true]]],
    [/^can ignore modifiers to (?:their |its )?hit rolls(?! and)/, () => [['ignoreHitRollMods', true]]],
    [/^can ignore modifiers to (?:their |its )?wound rolls/, () => [['ignoreWoundMods', true]]],
    [/^have critical hits on (?:unmodified hit rolls of )?(\d)\+/, m => [['critHit', +m[1]]]],
    [/^score critical hits on (?:unmodified hit rolls of )?(\d)\+/, m => [['critHit', +m[1]]]],
    [/^score critical wounds on (?:unmodified wound rolls of )?(\d)\+/, m => [['critWound', +m[1]]]]
  ];
  for(const [re, f] of E){ if((m = re.exec(s))) return { len:m[0].length, fx:f(m) }; }
  return null;
}
// bare list items after "… attacks can:" / "… have:" lead-ins: "re-roll hit rolls of 1", "+1 to hit rolls", "⟪lethal hits⟫"
function bareAttackItem(s){
  let m;
  if((m = /^re-roll (?:one )?(hit|wound|damage) rolls?(?: of 1)?/.exec(s))){
    const one = /re-roll one/.test(m[0]), of1 = /of 1/.test(m[0]);
    const id = one ? { hit:'oneHit', wound:'oneWound', damage:'oneDmg' }[m[1]] : of1 ? (m[1] === 'hit' ? 'rrHit1' : m[1] === 'wound' ? 'rrWound1' : null) : { hit:'rrHit', wound:'rrWound', damage:'rrDmg' }[m[1]];
    if(!id) return null;
    return { len:m[0].length, fx:[[id, true]] };
  }
  if((m = /^([+-])(\d) to (hit|wound) rolls/.exec(s))) return { len:m[0].length, fx:[[m[3], (m[1] === '-' ? -1 : 1) * m[2]]] };
  if((m = /^\+(\d|d3) (ap|a|s|d)\b/.exec(s))) return { len:m[0].length, fx:[[CHAR[m[2]], num(m[1])]] };
  if((m = /^\+(\d) (ws|bs)\b/.exec(s))) return { len:m[0].length, fx:[['skill', +m[1]]] };
  if((m = /^((?:⟪[^⟫]+⟫(?:,? and |, )?)+)/.exec(s))) return { len:m[0].length, fx:bracketList(m[1]) };
  return null;
}

// Defence phrases after "<subject> has/have …".
function hasPhrase(s, r){
  let m;
  const D = [
    [/^an? (\d)\+ invulnerable save against ranged attacks|^(\d)\+ insv against ranged attacks/, m => ['DF', 'invRanged', +(m[1] || m[2])]],
    [/^an? (\d)\+ invulnerable save|^(\d)\+ insv/, m => ['DF', 'inv', +(m[1] || m[2])]],
    [/^(?:the )?feel no pain (\d)\+(?: ability)? against (?:psychic attacks and mortal wounds|mortal wounds and psychic attacks)/, m => ['DF', 'fnpPsyMortal', +m[1]]],
    [/^(?:the )?feel no pain (\d)\+(?: ability)? against mortal wounds/, m => ['DF', 'fnpMortal', +m[1]]],
    [/^(?:the )?feel no pain (\d)\+(?: ability)? against psychic attacks/, m => ['DF', 'fnpPsychic', +m[1]]],
    [/^(?:the )?feel no pain (\d)\+(?: ability)?/, m => ['DF', 'fnp', +m[1]]],
    [/^an? save characteristic of (\d)\+/, m => ['DF', 'svSet', +m[1]]],
    [/^(?:the )?stealth(?: ability)?/, () => ['DF', 'stealth', true]],
    [/^(?:the )?lone operative(?: ability)?/, () => ['DF', 'loneOp', true]],
    [/^the benefit of cover/, () => ['DF', 'cover', true]],
    [/^\+(\d) oc\b|^\+(\d) objective control/, m => ['ST', 'ocAdd', +(m[1] || m[2])]],
    [/^-(\d) oc\b/, m => ['ST', 'ocMinus', +m[1]]],
    [/^\+(\d)" m\b|^\+(\d)" move/, m => ['ST', 'mAdd', +(m[1] || m[2])]],
    [/^\+(\d) t\b|^\+(\d) toughness/, m => ['DF', 't', +(m[1] || m[2])]],
    [/^an? (objective control|leadership|wounds|move|toughness|attacks|ballistic skill|weapon skill|oc|ld|w) characteristic of (\d+)("|\+)?/, m => {
      const c = { 'objective control':'OC', oc:'OC', leadership:'Ld', ld:'Ld', wounds:'W', w:'W', move:'M', toughness:'T', attacks:'A', 'ballistic skill':'BS', 'weapon skill':'WS' }[m[1]];
      if(c === 'BS') return ['FX', 'bsSet', +m[2]];
      if(c === 'A') return ['FX', 'aSet', +m[2]];
      return ['SET', c, m[2] + (m[3] === '+' ? '+' : m[3] === '"' ? '"' : '')];
    }]
  ];
  for(const [re, f] of D){ if((m = re.exec(s))){ const [table, id, v] = f(m); return { len:m[0].length, table, id, v }; } }
  // things a unit "has" that the vocabulary has no effect for
  if((m = /^(?:the )?(deep strike|scouts?|infiltrators|fights first|deadly demise|firing deck|leader|feel no pain)\b/.exec(s))) outside('ability ' + m[1]);
  if((m = /^(?:a |an |\+|-)?(?:\d+"? )?(w|ld|wounds?|leadership|sv|move|m|oc|objective control|toughness)\b(?: characteristic)?/.exec(s))) outside('characteristic ' + m[1]);
  if(/^the ⟦/.test(s) && /keyword/.test(s)) outside('keyword');
  return null;
}

/* ------------------------------------------------------------------ prefix / suffix conditions ------------------------ */

const PHASES = 'command|movement|shooting|charge|fight';
const OBJ = 'an objective(?: marker)?(?: you control| that you control)?';

// Returns length consumed or 0. Pushes conditions / duration / trigger.
function prefix(s, r, ctx){
  let m;
  const P = [
    // durations
    [/^(?:then )?until the (start|end) of (the phase|the turn|the battle round|the battle|your next turn|your opponent's next turn|the next turn|the next battle round|your next command phase|your next movement phase|your next shooting phase|your next fight phase|your opponent's next command phase|your turn|your opponent's turn)(?:,| -)? ?/,
      m => { r.duration = m[1] + ' of ' + m[2]; }],
    // once-per
    [/^\(?once per battle(?! round)(?:, per (?:army|unit))?\)?,? ?/, () => cond(r, 'oncePerBattle')],
    [/^\(?once per turn(?:, per (?:army|unit))?\)?,? ?/, () => cond(r, 'oncePerTurn')],
    [/^\(?once per (phase|battle round)(?:, per (army|unit))?\)?,? ?/, m => cond(r, 'oncePer', m[1] + (m[2] ? ', per ' + m[2] : ''), 'own')],
    // "if you do / if it does"
    [/^if (?:you do|it does|they do)(?:,| -)? (?:then )?/, () => cond(r, 'used')],
    [/^in addition, /, () => {}],
    [/^instead, /, () => { r.instead = true; }],
    // phases
    [new RegExp('^(?:in|during) (your|your opponent\'s|the|each|any) (' + PHASES + ') phase,? '), m => cond(r, 'phase', { phase:m[2], turn:m[1] === 'your' ? 'your' : m[1] === "your opponent's" ? 'opp' : 'either' }, 'own')],
    [new RegExp('^(?:in|during) your (' + PHASES + ') phase or (?:your opponent\'s|the) (' + PHASES + ') phase,? '), m => cond(r, 'phase', { phase:m[1] + '|' + m[2], turn:'mixed' }, 'own')],
    // timings (triggers)
    [new RegExp('^(?:at the|at) (start|end) of (any phase|the battle round|the first battle round|each battle round|the battle|your turn|your opponent\'s turn|any turn|each turn|(?:the|your|your opponent\'s|each|any) (?:' + PHASES + ') phase)(?: step)?(?: of [^,]+)?,? '),
      m => cond(r, 'timing', m[1] + ' of ' + m[2], 'own')],
    [/^(?:each time|when) (this model|this unit|the bearer|your unit) is selected to shoot or fight,? /, m => { cond(r, 'trigger', 'selected to shoot or fight', 'own'); ctx.triggerSubject = subjOf(m[1]); }],
    [/^when (?:this unit|this model) is selected as the target of an attack,? /, () => cond(r, 'trigger', 'selected as the target of an attack', 'own')],
    [/^when (this unit|this model) is selected to fight or when an enemy unit targets (?:this unit|it|this model),? /, m => { cond(r, 'trigger', 'selected to fight, or targeted by an enemy unit', 'own'); ctx.triggerSubject = subjOf(m[1]); }],
    [/^while (this model|the bearer|this unit) is using the ([a-z' -]+?) ability,? /, m => { cond(r, 'usingAbility', m[2], 'own'); ctx.lastSubject = subjOf(m[1]); }],
    [/^if (?:that|the) (?:(battle-shock|leadership|psychic) )?test (?:is|was) (passed|failed),? (?:then )?/, m => cond(r, 'test', { test:m[1] || 'that test', passed:m[2] === 'passed' }, 'own')],
    [/^(?:if|while) the ([a-z' -]+?) (ability|doctrine|imperative|ka'tah) is active(?: for (?:your army|your unit|this unit|that unit))?,? (?:then )?/, m => cond(r, 'abilityActive', m[1] + ' ' + m[2], 'own')],
    [new RegExp('^each time an enemy unit(?:' + EXCL + ')? within (engagement range|\\d+") of (one or more units (?:from your army )?with this ability|this model|this unit|the bearer) is selected to (fight|shoot),? '), m => {
      const t = { enemy:'selected to ' + m[4], within:m[2], of:m[3] }; if(m[1]) t.excluding = kwList(m[1]);
      cond(r, 'trigger', t, 'own');
      setRef(ctx, 'refEnemy', Object.assign({ type:'triggeringEnemy', enemy:true }, m[1] ? { excluding:kwList(m[1]) } : {}), [{ id:'trigger', v:t, table:'own' }]);
    }],
    [/^each time an enemy unit within (\d+)" of (this model|this unit|the bearer) targets (this model|this unit|the bearer),? /, m => {
      const t = { enemy:'targets ' + m[3], within:+m[1] + '"', of:m[2] };
      cond(r, 'trigger', t, 'own'); ctx.defTrigger = subjOf(m[3]);
      setRef(ctx, 'refEnemy', { type:'triggeringEnemy', enemy:true }, [{ id:'trigger', v:t, table:'own' }]);
    }],
    [new RegExp('^when a friendly (' + KX + ') unit(?:' + EXCL + ')? is selected to (shoot|fight|attack),? '), m => {
      const reach = { type:'friendly', kw:kwExpr(m[1], { andIsOr:true }), unitsOrModels:'units' }; if(m[2]) reach.excluding = kwList(m[2]);
      const t = 'a friendly unit is selected to ' + m[3]; cond(r, 'trigger', t, 'own');
      if(m[3] === 'shoot') ctx.whenKind = 'ranged'; if(m[3] === 'fight') ctx.whenKind = 'melee';
      setRef(ctx, 'ref', reach, [{ id:'trigger', v:t, table:'own' }]);
    }],
    [/^at the start or end of (this unit's|this model's) move,? /, m => cond(r, 'timing', 'start or end of ' + m[1] + ' move', 'own')],
    [/^(?:if|while) (?:your|this|that) unit is an? (⟦[^⟧]+⟧) unit,? /, m => cond(r, 'selfKw', m[1].slice(1, -1))],
    [/^(?:,? )?unless ([^,]+), /, m => {
      const c = condOnly(m[1] + '.', ctx);
      if(!c) throw new Unread('unparsed:"unless ' + clean(m[1]) + '"');
      r.conditions.push(negate(c));
    }],
    [/^(?:while|if) (this model|this unit|the bearer|that unit|your unit|it) is within your army's ([a-z' -]+?), /, m => cond(r, 'factionState', { who:m[1], state:"within your army's " + m[2] }, 'own')],
    [/^(?:while|if) (this model|this unit|the bearer|that unit|your unit|it) is (readied|empowered|aflame|disrupted|prosecuted|marked|regenerating),? /, m => cond(r, 'factionState', { who:m[1], state:m[2] }, 'own')],
    [new RegExp('^when a saving throw made for an? (friendly )?(' + KX + ') model within (\\d+)" of (the bearer|this model) is failed,? '), m => {
      const reach = { type:'aura', range:+m[3], of:m[4], kw:kwExpr(m[2], { andIsOr:true }), unitsOrModels:'models' };
      const via = [{ id:'failedSave', table:'DCOND' }, { id:'aura', v:+m[3], table:'COND' }];
      const before = r.conditions.map(c => Object.assign({}, c));
      r.conditions.push(...via.map(c => Object.assign({}, c)));
      setRef(ctx, 'refModel', reach, before.concat(via)); ctx.pendingDefence = reach;
    }],
    [new RegExp('^each time an enemy unit is selected to (shoot or fight|shoot|fight) and one or more (' + KX + ') units from your army are selected as a target of one or more of those attacks, '), m => {
      const t = { enemy:'selected to ' + m[1], targets:kwExpr(m[2], { andIsOr:true }) };
      cond(r, 'trigger', t, 'own');
      setRef(ctx, 'ref', { type:'army', kw:kwExpr(m[2], { andIsOr:true }), unitsOrModels:'units', note:'each targeted unit' }, [{ id:'trigger', v:t, table:'own' }]);
    }],
    [/^each time an enemy unit within (\d+)" of (this model|this unit) is selected to (fall back|move|charge),? /, m => {
      const t = { enemy:'selected to ' + m[3], within:+m[1] + '"', of:m[2] }; cond(r, 'trigger', t, 'own');
      setRef(ctx, 'ref', { type:'triggeringEnemy', enemy:true }, [{ id:'trigger', v:t, table:'own' }]); ctx.refEnemy = ctx.ref;
    }],
    [/^for each one that does,? /, () => cond(r, 'used')],
    [/^while a unit is riled up,? /, () => { cond(r, 'riled'); setRef(ctx, 'ref', { type:'riledUnit', note:'a unit with this ability that is riled up' }, [{ id:'riled', table:'COND' }]); }],
    [/^each time (this model|this unit|the bearer|the bearer's unit|this model's unit|a model in this unit|your unit) is selected to (shoot|fight|attack),? /, m => { cond(r, 'trigger', 'selected to ' + m[2], 'own'); ctx.triggerSubject = subjOf(m[1]); if(m[2] === 'shoot') ctx.whenKind = 'ranged'; if(m[2] === 'fight') ctx.whenKind = 'melee'; }],
    [/^when (this model|this unit|the bearer|the bearer's unit|this model's unit|your unit) is selected to (shoot|fight|attack),? /, m => { cond(r, 'trigger', 'selected to ' + m[2], 'own'); ctx.triggerSubject = subjOf(m[1]); if(m[2] === 'shoot') ctx.whenKind = 'ranged'; if(m[2] === 'fight') ctx.whenKind = 'melee'; }],
    [/^(?:each time|when) (this model|this unit|the bearer|the bearer's unit|this model's unit|your unit) (?:makes|ends) a charge move,? /, m => { cond(r, 'charged'); ctx.lastSubject = m[1] === 'this model' ? { type:'self' } : m[1] === 'the bearer' ? { type:'bearer' } : { type:'unit' }; }],
    [/^the first time (this model|this unit|the bearer) is destroyed,? /, () => { cond(r, 'firstTime', 'destroyed', 'own'); ctx.onDeath = true; }],
    [/^the first time ([^,]+?), /, m => cond(r, 'firstTime', m[1], 'own')],
    // while/if conditions
    [/^(?:while|if) (?:this model|the bearer|it) is leading a unit,? /, () => { cond(r, 'leading'); setRef(ctx, 'ref', { type:'ledUnit' }, [{ id:'leading', table:'COND' }]); }],
    [new RegExp('^(?:while|if) (?:this model|the bearer) is leading an? (' + KX + ') unit,? '), m => { const k = kwExpr(m[1], { andIsOr:true }); r.conditions.push({ id:'leading', table:'COND' }, { id:'leadingKw', v:k, table:'own' }); setRef(ctx, 'ref', { type:'ledUnit', kw:k }, [{ id:'leading', table:'COND' }, { id:'leadingKw', v:k, table:'own' }]); }],
    [/^(?:while|if) this unit's ([a-z'-]+) model has (\d+-\d+) wounds remaining,? /, m => { cond(r, 'woundsRemaining', { model:m[1], wounds:m[2] }, 'own'); setRef(ctx, 'refModel', { type:'models', name:m[1], of:'this unit' }, [{ id:'woundsRemaining', v:{ model:m[1], wounds:m[2] }, table:'own' }]); }],
    [/^(?:while|if) (?:this model|this unit|it) is within range of that objective marker,? /, () => { const ref = ctx.refObjective; if(!ref) throw new Unread('unparsed:"that objective marker" refers to no selected objective marker'); useRef(ctx, ref); cond(r, 'onSelectedObjective', true, 'own'); }],
    [/^while a model is affected by this ability,? /, () => { cond(r, 'affectedByThisAbility', true, 'own'); setRef(ctx, 'refModel', { type:'affectedModel', models:true }, [{ id:'affectedByThisAbility', v:true, table:'own' }]); ctx.ref = ctx.refModel; }],
    [/^(?:while|if) (?:this model|the bearer) is equipped with (?:an? )?([a-z' -]+?(?:,? and (?:an? )?[a-z' -]+?)*), /, m => cond(r, 'selfGear', m[1].split(/,? and (?:an? )?/))],
    [/^until (that enemy unit has attacked|the attacking unit has finished making its attacks|that unit has fought|your unit has fought),? /, m => { r.duration = 'until ' + m[1]; }],
    [/^(?:when|after|once) (this model|this unit|the bearer's unit|your unit) has (shot|fought),? /, m => { cond(r, 'timing', 'after ' + m[2], 'own'); ctx.lastSubject = m[1] === 'this model' ? { type:'self' } : { type:'unit' }; }],

    [/^(?:while|if) (?:this unit|this model|your unit|that unit) (?:remained|remains) stationary(?: this turn)?,? /, () => cond(r, 'stationary')],
    [/^(?:while|if) (?:this unit|this model|your unit|that unit) (?:made|has made) an? (ingress|advance|normal|fall-back|surge|scout) move this turn,? /, m => cond(r, 'moved', m[1], 'own')],
    [/^(?:while|if) (?:this unit|this model|your unit|that unit) advanced this turn,? /, () => cond(r, 'moved', 'advance', 'own')],
    [/^(?:\+\d+cp )?or: /, m => cond(r, 'opt', m[0].trim())],
    [/^(?:while|if) this (?:model|unit) is (?:not )?(?:being )?led by an? (⟦[^⟧]+⟧) model,? |^(?:while|if) an? (⟦[^⟧]+⟧) model is leading this unit,? /, m => { cond(r, 'ledBy', (m[1] || m[2]).slice(1, -1), 'DCOND'); setRef(ctx, 'refModel', { type:'leaderModel', kw:(m[1] || m[2]).slice(1, -1) }, [{ id:'ledBy', v:(m[1] || m[2]).slice(1, -1), table:'DCOND' }]); ctx.refLeaderKw = (m[1] || m[2]); }],
    [/^(?:while|if) (?:this unit|this model|the bearer's unit|your unit|that unit|the bearer|this model's unit) (?:made|has made) a charge move this turn,? |^(?:while|if) (?:this unit|this model|your unit|that unit|the bearer's unit) charged this turn,? /, () => cond(r, 'charged')],
    [/^(?:while|if) (?:this unit|this model|your unit|that unit|the bearer's unit|the bearer) (?:is|was) riled up,? /, () => cond(r, 'riled')],
    [/^(?:while|if) (?:this unit|this model|your unit|that unit|the bearer's unit) remained stationary this turn,? /, () => cond(r, 'stationary')],
    [new RegExp('^(?:while|if) (?:this unit|this model|your unit|that unit|the bearer\'s unit|the bearer) is within range of ' + OBJ + ',? '), m => cond(r, /control/.test(m[0]) ? 'controlling' : 'onObjective', undefined, /control/.test(m[0]) ? 'DCOND' : 'COND')],
    [/^(?:while|if) (?:this unit|this model|your unit|that unit|the bearer's unit) is (?:controlling|in control of) an objective(?: marker)?,? /, () => cond(r, 'controlling', undefined, 'DCOND')],
    [/^(?:while|if) (?:this unit|this model|your unit|that unit|the bearer's unit|the bearer) is below half-strength,? /, () => cond(r, 'belowHalf')],
    [/^(?:while|if) (?:this unit|this model|your unit|that unit|the bearer's unit|the bearer) is below its starting strength,? /, () => cond(r, 'belowStarting')],
    [/^(?:while|if) (?:this unit|this model|your unit|that unit|the bearer's unit) is at its starting strength,? /, () => cond(r, 'atStarting', undefined, 'STCOND')],
    [/^(?:while|if) (?:this unit|this model|your unit|that unit|the bearer's unit|the bearer) is not battle-shocked,? /, () => cond(r, 'notShocked', undefined, 'STCOND')],
    [/^(?:while|if) (?:this unit|this model|your unit|that unit|the bearer's unit|the bearer) is battle-shocked,? /, () => cond(r, 'battleShocked', true, 'own')],
    [/^(?:while|if) (?:this unit|this model|your unit|that unit|the bearer's unit|the bearer) is (?:unengaged|not within engagement range of (?:one or more|any) enemy units),? /, () => cond(r, 'unengaged', true, 'own')],
    [/^(?:while|if) (?:this unit|this model|your unit|that unit|the bearer's unit|the bearer) is (?:engaged|within engagement range of one or more enemy units),? /, () => cond(r, 'engaged', true, 'own')],
    [/^(?:while|if) (?:this model|the bearer) has fewer than its starting number of wounds remaining,? /, () => cond(r, 'woundsLost', true, 'own')],
    [/^(?:while|if) this model has (\d+-\d+) wounds remaining,? /, m => cond(r, 'woundsRemaining', m[1], 'own')],
    [/^(?:while|if) (?:this model|the bearer|this unit|your unit) has the (⟦[^⟧]+⟧) keyword,? /, m => cond(r, 'selfKw', m[1].slice(1, -1))],
    [/^(?:while|if) your army faction is (⟦[^⟧]+⟧),? /, m => cond(r, 'armyFaction', m[1].slice(1, -1), 'own')],
    [/^(?:while|if) (?:this unit|your unit|that unit) is within (?:your army's )?synapse range(?: of your army)?,? /, () => cond(r, 'synapse', true, 'own')],
    [/^(?:while|if) (?:this unit|this model|your unit|that unit) is wholly within your deployment zone,? /, () => cond(r, 'inDeployment', true, 'own')],
    [new RegExp('^(?:while|if) (?:this unit|this model|your unit|that unit) is within (\\d+)" of (?:one or more |an? )?(other |another )?(?:friendly )?(⟦[^⟧]+⟧(?:/⟦[^⟧]+⟧)*) (?:units?|models?)(?:' + EXCL + ')?,? '),
      m => cond(r, 'nearFriendly', Object.assign({ d:+m[1], kw:m[3].replace(/[⟦⟧]/g, '') }, m[2] ? { other:true } : {}, m[4] ? { not:kwList(m[4]).join('/') } : {}), 'DCOND')],
    [/^(?:while|if) (?:this unit|this model|your unit|that unit) contains (?:one or more|an?) (⟦[^⟧]+⟧) models?,? /, m => cond(r, 'contains', m[1].slice(1, -1), 'own')],
    [/^(?:while|if) (?:this model|the bearer) is not destroyed,? /, () => {}]
  ];
  for(const [re, f] of P){ if((m = re.exec(s))){ f(m); return m[0].length; } }
  // aura / range prefix: "while a friendly ⟦X⟧ unit (excluding …) is within N" of this model, "
  if((m = new RegExp('^while (?:a|an|each|another) (other )?friendly (?:(' + KX + ') )?(unit|model)(?:' + EXCL + ')? is (?:wholly )?within (\\d+)" of (this model|this unit|the bearer|the bearer\'s unit|that model|this ⟦[^⟧]+⟧|this unit\'s [a-z\'-]+ model),? ').exec(s))){
    const reach = { type:'aura', range:+m[5], of:m[6], unitsOrModels:m[3] + 's' };
    if(m[2]){ const k = kwExpr(m[2], { andIsOr:false }); if(k.ambiguous) throw new Unread('unparsed:keyword list joined by "and": ' + m[2]); reach.kw = k; }
    if(m[4]) reach.excluding = kwList(m[4]);
    if(m[1]) reach.other = true;
    setRef(ctx, 'ref', reach, [{ id:'aura', v:+m[5], table:'COND' }]); r.reachFromAura = reach;
    cond(r, 'aura', +m[5]);
    return m[0].length;
  }
  if((m = new RegExp('^while (?:a|an|each) friendly (?:(' + KX + ') )?(unit|model)(?:' + EXCL + ')? is (below (?:its )?starting strength|below half-strength|battle-shocked|not battle-shocked),? ').exec(s))){
    const reach = { type:'friendly', unitsOrModels:m[2] + 's' };
    if(m[1]) reach.kw = kwExpr(m[1], { andIsOr:true });
    if(m[3]) reach.excluding = kwList(m[3]);
    const id = { 'below starting strength':'belowStarting', 'below its starting strength':'belowStarting', 'below half-strength':'belowHalf', 'battle-shocked':'battleShocked', 'not battle-shocked':'notShocked' }[m[4]];
    const c = id === 'notShocked' ? { id, table:'STCOND', of:'that unit' } : id === 'battleShocked' ? { id, v:true, table:'own', of:'that unit' } : { id, table:'COND', of:'that unit' };
    setRef(ctx, 'ref', reach, [c]); r.reachFromAura = reach; r.conditions.push(Object.assign({}, c));
    return m[0].length;
  }
  if((m = new RegExp('^while (?:a|an|each) friendly (?:(' + KX + ') )?(unit|model)(?:' + EXCL + ')? is within range of an objective(?: marker)?,? ').exec(s))){
    const reach = { type:'friendly', unitsOrModels:m[2] + 's' };
    if(m[1]){ const k = kwExpr(m[1], { andIsOr:false }); if(k.ambiguous) throw new Unread('unparsed:keyword list joined by "and": ' + m[1]); reach.kw = k; }
    if(m[3]) reach.excluding = kwList(m[3]);
    setRef(ctx, 'ref', reach, [{ id:'onObjective', table:'COND', of:'that unit' }]); r.reachFromAura = reach;
    r.conditions.push({ id:'onObjective', table:'COND', of:'that unit' });
    return m[0].length;
  }
  if((m = new RegExp('^while (?:an|each) enemy (?:(' + KX + ') )?(unit|model)(?:' + EXCL + ')? is within (\\d+)" of (this model|this unit|the bearer|the bearer\'s unit),? ').exec(s))){
    const reach = { type:'enemyAura', range:+m[4], of:m[5] };
    if(m[1]) reach.kw = kwExpr(m[1], { andIsOr:true });
    if(m[3]) reach.excluding = kwList(m[3]);
    setRef(ctx, 'refEnemy', reach, [{ id:'aura', v:+m[4], table:'COND' }]); ctx.ref = reach; r.reachFromAura = reach;
    cond(r, 'aura', +m[4]);
    return m[0].length;
  }
  if((m = /^if (this unit's|this model's|the bearer's|its) ([a-z' -]+?) weapon targets /.exec(s))){
    const n = targetPhrase(s.slice(m[0].length), r);
    if(n && /^, /.test(s.slice(m[0].length + n))){
      const reach = subjOf(m[1].replace(/'s$/, '')); cond(r, 'weapon', m[2], 'own');
      ctx.lastWeapons = { reach, kind:'any', name:m[2] };
      return m[0].length + n + 2;
    }
  }
  if((m = /^(?:while|if) this (?:model|unit) is within (\d+)" of (?:one or more )?enemy units?,? /.exec(s))){ cond(r, 'nearEnemy', +m[1], 'own'); return m[0].length; }
  return 0;
}

/* ------------------------------------------------------------------ the core clauses --------------------------------- */

// Each core reader returns the length consumed, filling r; or 0.
function core(s, r, ctx){
  let m, sub;
  const setReach = reach => {
    if(!r.reach) r.reach = reach;
    r._clauseReach = reach;
    ctx.lastSubject = reach;
  };
  const setKind = k => { if(!r.attack || r.attack === k) r.attack = k; else if(r.attack !== k) r.attack = 'mixed'; };
  const setSide = side => { if(!r.side || r.side === side) r.side = side; else r.side = 'mixed'; };
  const kindOf = w => w ? (w === 'psychic' ? 'psychic' : w) : 'any';
  const addFx = (table, list, kind) => list.forEach(([id, v, w]) => r.effects.push(Object.assign(kind ? { table, id, v, attack:kind } : { table, id, v }, w ? { only:w } : {})));

  // ---- A. 10th: each time <S> makes a [kind] attack [with …] [that targets T], <effects>
  {
    const re = /^each time (?:an? (?:model|⟦[^⟧]+⟧ model) in |a model from |an? )?/;
    const pre = re.exec(s);
    if(pre && /^each time /.test(s)){
      let t = s.slice(pre[0].length), len = pre[0].length, reach = null;
      // subject: "a model in this unit" / "this model" / "a friendly ⟦X⟧ model" / "a ⟦X⟧ model in this unit"
      let km;
      if((km = new RegExp('^(?:friendly )?(' + KX + ') model from your army ').exec(t)) || (km = new RegExp('^friendly (' + KX + ') model ').exec(t))){
        reach = { type:/from your army/.test(km[0]) ? 'army' : 'friendly', kw:kwExpr(km[1], { andIsOr:true }), unitsOrModels:'models' }; t = t.slice(km[0].length - 1); len += km[0].length - 1;
      } else if((km = new RegExp('^(?:a |an )?(' + KX + ') model in this unit').exec(s.slice(11)))){
        reach = { type:'models', kw:kwExpr(km[1], { andIsOr:true }), of:'this unit' }; t = s.slice(11 + km[0].length); len = 11 + km[0].length;
      } else if((sub = subject(t, ctx))){ reach = sub.reach; t = t.slice(sub.len); len += sub.len; }
      else if((km = /^(?:a )?model in (?:any of )?those selected units/.exec(t)) && ctx.ref){ reach = Object.assign({}, ctx.ref); t = t.slice(km[0].length); len += km[0].length; }
      let am;
      if(reach && (am = /^ makes an? (?:(ranged|melee|psychic) )?attack(?: with (?:an? )?(psychic|ranged|melee) weapons?| with (?:its|this model's|the bearer's|an?|the) ([a-z' -]+?)(?= that|,))?/.exec(t))){
        t = t.slice(am[0].length); len += am[0].length;
        let kind = kindOf(am[1] || am[2]);
        if(am[3]) cond(r, 'weapon', am[3], 'own');
        let tm;
        if((tm = /^ that targets /.exec(t))){
          const n = targetPhrase(t.slice(tm[0].length), r);
          if(!n) throw new Unread('unparsed:attack target "' + t.slice(tm[0].length, tm[0].length + 40) + '"');
          t = t.slice(tm[0].length + n); len += tm[0].length + n;
        }
        if(!/^, /.test(t)) return 0;
        t = t.slice(2); len += 2;
        // optional inner conditions
        let inner;
        while((inner = innerCond(t, r))){ t = t.slice(inner); len += inner; }
        const fxs = effectList(t, attackEffect10);
        if(!fxs) return 0;
        // a negative modifier on a friendly unit's own rolls is still an attack-side effect
        const enemy = reach.type === 'enemyAura' || reach.enemy;
        setReach(reach); setKind(kind); setSide('attack'); addFx('FX', fxs.fx, kind);
        if(enemy) r.debuff = true;

        return len + fxs.len;
      }
    }
  }
  // ---- A4. each time a [kind] attack made by <S> targets <T> / is allocated to a <KW> model, <effects>
  if((m = /^each time an? (?:(ranged|melee|psychic) )?attack made by /.exec(s))){
    let t = s.slice(m[0].length), len = m[0].length;
    sub = subject(t, ctx);
    if(sub){
      t = t.slice(sub.len); len += sub.len;
      let tm, ok = false;
      if((tm = /^ targets /.exec(t))){ const n = targetPhrase(t.slice(tm[0].length), r); if(n){ t = t.slice(tm[0].length + n); len += tm[0].length + n; ok = true; } }
      else if((tm = new RegExp('^ is allocated to an? (' + KX + ') model').exec(t))){ cond(r, 'allocatedToKw', kwExpr(tm[1], { andIsOr:true }), 'own'); t = t.slice(tm[0].length); len += tm[0].length; ok = true; }
      if(ok && /^, /.test(t)){
        t = t.slice(2); len += 2;
        const fxs = effectList(t, attackEffect10);
        if(fxs){ const kind = kindOf(m[1]); setReach(sub.reach); setKind(kind); setSide('attack'); addFx('FX', fxs.fx, kind); return len + fxs.len; }
      }
      return 0;
    }
  }
  // ---- A3. each time an attack made with this model's <weapon> targets T, <effects>
  if((m = /^each time an attack (?:made )?with (?:this model's|its|the bearer's|an?) ([a-z' -]+?) targets /.exec(s))){
    let t = s.slice(m[0].length), len = m[0].length;
    const n = targetPhrase(t, r); if(!n) return 0;
    t = t.slice(n); len += n;
    if(!/^, /.test(t)) return 0; t = t.slice(2); len += 2;
    const fxs = effectList(t, attackEffect10); if(!fxs) return 0;
    cond(r, 'weapon', m[1], 'own');
    setReach({ type:'self' }); setKind('any'); setSide('attack'); addFx('FX', fxs.fx, 'any');
    return len + fxs.len;
  }
  // ---- A2. 10th: each time an attack [made with …] targets <S> / is allocated to a model in <S>, <defence effects>
  if((m = /^(?:each time|when) an? (?:(ranged|melee|psychic) )?attack (?:made with (?:a |an )?(psychic|ranged|melee) weapon |with an? damage characteristic of (\d+) )?(targets |is allocated to (?:a model in |an? )?)/.exec(s))){
    let t = s.slice(m[0].length), len = m[0].length;
    if(m[3]) cond(r, 'attackDamage', +m[3], 'own');
    sub = subject(t, ctx); if(!sub) return 0;
    t = t.slice(sub.len); len += sub.len;
    if(!/^, /.test(t)) return 0;
    t = t.slice(2); len += 2;
    let inner;
    while((inner = innerCond(t, r))){ t = t.slice(inner); len += inner; }
    const fxs = effectList(t, defenceEffect10);
    if(!fxs) return 0;
    setReach(sub.reach); setKind(kindOf(m[1] || m[2])); setSide('defence'); addFx('DF', fxs.fx, kindOf(m[1] || m[2]));
    return len + fxs.len;
  }
  // ---- B. 11th: <S>'s [kind] attacks [that target T] have/can …
  {
    const sp = possessive(s, ctx);
    if(sp){
      let t = s.slice(sp.len), len = sp.len;
      let am = /^ ?(?:(ranged|melee|psychic) )?attacks(?: made with (?:a |an )?(psychic|ranged|melee) weapons?)?(?: \(excluding ([^)]+)\))?/.exec(t);
      if(am){
        t = t.slice(am[0].length); len += am[0].length;
        if(am[3]) cond(r, 'weaponExcluding', am[3], 'own');
        let tm;
        if((tm = /^ that target /.exec(t))){
          const n = targetPhrase(t.slice(tm[0].length).replace(/^(an?|that|the) /, (x) => x), r) || targetPhrase('a ' + t.slice(tm[0].length), r) - 2;
          if(n <= 0) throw new Unread('unparsed:attack target "' + t.slice(tm[0].length, tm[0].length + 40) + '"');
          t = t.slice(tm[0].length + n); len += tm[0].length + n;
        }
        if(!/^ /.test(t)) return 0;
        t = t.slice(1); len += 1;
        const fxs = effectList(t, attackEffect11, true);
        if(!fxs) return 0;
        setReach(sp.reach); setKind(kindOf(am[1] || am[2])); setSide('attack'); addFx('FX', fxs.fx, kindOf(am[1] || am[2]));
        if(sp.reach.type === 'enemyAura' || sp.reach.enemy) r.debuff = true;

        return len + fxs.len;
      }
      // <S>'s [kind] weapons have [X]
      if((am = /^ ?(?:(ranged|melee|psychic) )?weapons (?:have|gain) /.exec(t))){
        const fxs = effectList(t.slice(am[0].length), weaponHave);
        if(!fxs) return 0;
        setReach(sp.reach); setKind(kindOf(am[1])); setSide('attack'); addFx('FX', fxs.fx, kindOf(am[1]));
        return len + am[0].length + fxs.len;
      }
    }
  }
  // ---- C. attacks that target <S> have … (defence; or an attacker buff when <S> is an enemy)
  if((m = /^(?:(ranged|melee|psychic) )?attacks (?:made with (?:a |an )?(psychic|ranged|melee) weapons? )?(?:that target|allocated to) /.exec(s))){
    let t = s.slice(m[0].length), len = m[0].length;
    sub = subject(t, ctx);
    let enemyTarget = false;
    if(!sub){
      const pm = /^an? (prosecuted|marked) unit|^your (?:machine vengeance|mark|oath of moment) target/.exec(t);
      if(pm) outside('target condition "' + pm[0] + '"');
      return 0;
    }
    t = t.slice(sub.len); len += sub.len;
    if(sub.reach.enemy || sub.reach.type === 'enemyAura') enemyTarget = true;
    let sm;
    if((sm = /^ with (?:an? )?(?:s|strength(?: characteristic)?) (?:that is )?greater than (?:this|that|your|its) (?:unit's |model's )?(?:t|toughness(?: characteristic)?)/.exec(t))){ cond(r, 'sOverT', undefined, 'DCOND'); t = t.slice(sm[0].length); len += sm[0].length; }
    if(!/^ have /.test(t)) return 0;
    t = t.slice(6); len += 6;
    if(enemyTarget){
      const fxs = effectList(t, attackEffect11Bare);
      if(!fxs) return 0;
      setReach({ type:'anyAttacker', against:sub.reach }); setKind(kindOf(m[1] || m[2])); setSide('attack'); addFx('FX', fxs.fx, kindOf(m[1] || m[2])); cond(r, 'targetSelected');
      return len + fxs.len;
    }
    const fxs = effectList(t, defenceEffect11);
    if(!fxs) return 0;
    setReach(sub.reach); setKind(kindOf(m[1] || m[2])); setSide('defence'); addFx('DF', fxs.fx, kindOf(m[1] || m[2]));
    return len + fxs.len;
  }
  // ---- D. <weapons> equipped by <S> have [X] / a characteristic of N
  if((m = /^(?:all )?(?:the )?(?:(ranged|melee|psychic) )?weapons (?:equipped by|in) /.exec(s))){
    let t = s.slice(m[0].length), len = m[0].length;
    sub = subject(t, ctx); if(!sub) return 0;
    t = t.slice(sub.len); len += sub.len;
    const hm = /^ (?:have|gain) /.exec(t); if(!hm) return 0;
    t = t.slice(hm[0].length); len += hm[0].length;
    const fxs = effectList(t, weaponHave);
    if(!fxs) return 0;
    if(!fxs.fx.length && ctx.selectedOptions){
      r.options = ctx.selectedOptions.fx.map(([id, v]) => ({ table:'FX', id, v, attack:kindOf(m[1]) }));
      r.conditions.push(...ctx.selectedOptions.via.map(c => Object.assign({}, c)), { id:'opt', v:'the selected ability: one of ' + ctx.selectedOptions.words, table:'COND' });
    }
    setReach(sub.reach); setKind(kindOf(m[1])); setSide('attack'); addFx('FX', fxs.fx, kindOf(m[1]));
    ctx.lastWeapons = { reach:sub.reach, kind:kindOf(m[1]) };
    return len + fxs.len;
  }
  // ---- E. add/subtract/improve characteristics
  if((m = /^(add|subtract|increase) (\d+"?|d3) (?:to|from) (?:the )?((?:attacks|strength|armour penetration|damage|range|move|objective control|toughness|leadership|wounds|save)(?:(?:, | and )(?:attacks|strength|armour penetration|damage))*) characteristics? of /.exec(s))
     || (m = /^(improve|worsen) (?:the )?((?:strength|armour penetration|attacks|damage|ballistic skill|weapon skill|leadership|save)(?:(?:, | and )(?:strength|armour penetration|attacks|damage))*)(?: characteristics?)? of /.exec(s))){
    const improve = m[1] === 'improve' || m[1] === 'worsen';
    const op = m[1], chars = improve ? m[2] : m[3], val = improve ? null : m[2];
    let t = s.slice(m[0].length), len = m[0].length;
    // what: weapons of S / models in S / S / S's weapons
    let kind = 'any', reach = null, wm;
    if((wm = /^(?:those|these) weapons/.exec(t)) && ctx.lastWeapons){
      reach = ctx.lastWeapons.reach; kind = ctx.lastWeapons.kind; t = t.slice(wm[0].length); len += wm[0].length;
      if(ctx.lastWeapons.name) cond(r, 'weapon', ctx.lastWeapons.name, 'own');
    } else if((wm = /^(?:the )?(?:(ranged |melee )?(?:(ranged|melee|psychic) ))?weapons(?: \(excluding ([^)]+)\))? (?:equipped by|in) /.exec(t))){
      if(wm[1]) cond(r, 'weaponKind', wm[1].trim(), 'own');
      wm = [wm[0], wm[2], wm[3]];
      kind = kindOf(wm[1]); t = t.slice(wm[0].length); len += wm[0].length;
      if(wm[2]) cond(r, 'weaponExcluding', wm[2], 'own');
      sub = subject(t, ctx); if(!sub) return 0; reach = sub.reach; t = t.slice(sub.len); len += sub.len;
      ctx.lastWeapons = { reach, kind };
    } else {
      const sp = possessive(t, ctx);
      let nm;
      if(sp && (wm = /^ ?(?:(ranged|melee|psychic) )?weapons/.exec(t.slice(sp.len)))){
        reach = sp.reach; kind = kindOf(wm[1]); t = t.slice(sp.len + wm[0].length); len += sp.len + wm[0].length;
        ctx.lastWeapons = { reach, kind };
      } else if(sp && (nm = /^ ([a-z][a-z' -]*?)(?= by |,| and |$)/.exec(t.slice(sp.len)))){
        reach = sp.reach; cond(r, 'weapon', nm[1], 'own'); t = t.slice(sp.len + nm[0].length); len += sp.len + nm[0].length;
        ctx.lastWeapons = { reach, kind, name:nm[1] }; wm = nm;
      } else if((sub = subject(t, ctx))){ reach = sub.reach; t = t.slice(sub.len); len += sub.len; wm = null; }
      else return 0;
    }
    let by = null, bm;
    if(improve){ if(!(bm = /^ by (\d|d3)/.exec(t))) return 0; by = bm[1]; t = t.slice(bm[0].length); len += bm[0].length; }
    const cs = chars.split(/, | and /);
    const v = by || val;
    const isWeapon = !!wm || kind !== 'any';
    for(const c of cs){
      if(['attacks', 'strength', 'armour penetration', 'damage'].includes(c)){
        if(op === 'subtract' || op === 'worsen') outside('lowering ' + c);
        r.effects.push({ table:'FX', id:CHAR[c], v:num(v) }); setSide('attack');
      } else if(c === 'range'){ r.effects.push({ table:'FX', id:'range', v:parseInt(v, 10) }); setSide('attack'); }
      else if(c === 'objective control'){ r.effects.push({ table:'ST', id:op === 'subtract' ? 'ocMinus' : 'ocAdd', v:+v }); setSide('stat'); }
      else if(c === 'move' && op !== 'subtract'){ r.effects.push({ table:'ST', id:'mAdd', v:parseInt(v, 10) }); setSide('stat'); }
      else if(c === 'toughness' && op === 'add'){ r.effects.push({ table:'DF', id:'t', v:+v }); setSide('defence'); }
      else if((c === 'ballistic skill' || c === 'weapon skill') && op === 'improve'){ r.effects.push({ table:'FX', id:'skill', v:+v }); setSide('attack'); }
      else outside('characteristic ' + c + ' (' + op + ')');
    }
    setReach(reach); if(r.side === 'attack') setKind(kind);
    r.effects.forEach(e => { if(e.table === 'FX' && !e.attack) e.attack = kind; });
    void isWeapon;
    return len;
  }
  // ---- G0. "increase the Range characteristic of such weapons by 3\""
  if((m = /^increase the range characteristic of (?:such|those) weapons by (\d+)"/.exec(s)) && ctx.lastWeapons){
    setReach(ctx.lastWeapons.reach); setSide('attack'); r.effects.push({ table:'FX', id:'range', v:+m[1], attack:ctx.lastWeapons.kind });
    return m[0].length;
  }
  // ---- G. "those weapons have …" / "<S>'s <named weapon> has …"
  if((m = /^(?:those|these|that|its) (?:(?:melee|ranged|psychic) )?weapons? (?:also )?(?:have|has|gain) /.exec(s)) && ctx.lastWeapons){
    const fxs = effectList(s.slice(m[0].length), weaponHave); if(!fxs) return 0;
    if(ctx.lastWeapons.reach && ctx.lastWeapons.reach.selection) useRef(ctx, ctx.lastWeapons.reach);
    setReach(ctx.lastWeapons.reach); setKind(ctx.lastWeapons.kind); setSide('attack'); addFx('FX', fxs.fx, ctx.lastWeapons.kind);
    if(ctx.lastWeapons.name) cond(r, 'weapon', ctx.lastWeapons.name, 'own');
    return m[0].length + fxs.len;
  }
  {
    const sp = possessive(s, ctx); let nm;
    if(sp && (nm = /^ ([a-z][a-z' -]*?)(?: weapons?)? (?:has|have|gains?) (?=(?:the )?⟪|\+\d)/.exec(s.slice(sp.len))) && !/^(?:ranged |melee |psychic )?(?:attacks|weapons)?$/.test(nm[1])){
      const fxs = effectList(s.slice(sp.len + nm[0].length), weaponHave); if(!fxs) return 0;
      cond(r, 'weapon', nm[1], 'own'); setReach(sp.reach); setKind('any'); setSide('attack'); addFx('FX', fxs.fx, 'any');
      return sp.len + nm[0].length + fxs.len;
    }
  }
  if((sub = subject(s, ctx)) && (sub.reach.enemy || sub.reach.type === 'enemyAura') && (m = /^ cannot have the benefit of cover/.exec(s.slice(sub.len)))){
    setReach({ type:'anyAttacker', against:sub.reach }); setKind('any'); setSide('attack'); r.effects.push({ table:'FX', id:'ignoresCover', v:true }); cond(r, 'targetSelected');
    return sub.len + m[0].length;
  }
  // ---- E3. halve the Attacks characteristic of <weapons> (counted as "not counted": NC halveA)
  if((m = /^halve the attacks characteristic of /.exec(s))){
    let t = s.slice(m[0].length), len = m[0].length, wm, reach = null, kind = 'any';
    const sp = possessive(t, ctx);
    if(sp && (wm = /^ ?(?:(ranged|melee) )?weapons/.exec(t.slice(sp.len)))){ reach = sp.reach; kind = kindOf(wm[1]); len += sp.len + wm[0].length; }
    else if((wm = /^(?:(ranged|melee) )?weapons equipped by /.exec(t)) && (sub = subject(t.slice(wm[0].length), ctx))){ reach = sub.reach; kind = kindOf(wm[1]); len += wm[0].length + sub.len; }
    else return 0;
    setReach(reach); setSide('attack'); r.effects.push({ table:'NC', id:'halveA', v:true, attack:kind });
    return len;
  }
  // ---- E2. add/subtract N to/from <S>'s <characteristic> characteristic
  if((m = /^(add|subtract) (\d+"?|d3) (?:to|from) /.exec(s))){
    const sp = possessive(s.slice(m[0].length), ctx); let cm;
    if(sp && (cm = /^ (objective control|move|toughness) characteristic/.exec(s.slice(m[0].length + sp.len)))){
      const c = cm[1], op = m[1], v = parseInt(m[2], 10);
      if(c === 'objective control') r.effects.push({ table:'ST', id:op === 'subtract' ? 'ocMinus' : 'ocAdd', v });
      else if(c === 'move' && op === 'add') r.effects.push({ table:'ST', id:'mAdd', v });
      else if(c === 'toughness' && op === 'add') r.effects.push({ table:'DF', id:'t', v });
      else outside('characteristic ' + c + ' (' + op + ')');
      setReach(sp.reach); setSide(c === 'toughness' ? 'defence' : 'stat');
      return m[0].length + sp.len + cm[0].length;
    }
  }
  // ---- H. <S> can ignore modifiers to <S>'s BS / hit rolls / wound rolls (own ids where the vocabulary has none)
  if((sub = subject(s, ctx)) && (m = /^ can ignore (?:any or all )?modifiers to /.exec(s.slice(sub.len)))){
    let t = s.slice(sub.len + m[0].length), len = sub.len + m[0].length;
    const sp = possessive(t, ctx); if(sp){ t = t.slice(sp.len + 1); len += sp.len + 1; }
    const im = /^(bs|ws|ballistic skill|weapon skill|hit rolls|wound rolls)(?: and (hit rolls|wound rolls))?/.exec(t);
    if(im){
      const ID = { bs:'ignoreSkillMods', ws:'ignoreSkillMods', 'ballistic skill':'ignoreSkillMods', 'weapon skill':'ignoreSkillMods', 'hit rolls':'ignoreHitRollMods', 'wound rolls':'ignoreWoundMods' };
      [im[1], im[2]].filter(Boolean).forEach(x => r.effects.push({ table:'own', id:ID[x], v:true, attack:'any' }));
      setReach(sub.reach); setSide('attack'); setKind('any');
      return len + im[0].length;
    }
  }
  // ---- F. <S> has/have <defence or stat>
  if((sub = subject(s, ctx))){
    let t = s.slice(sub.len), len = sub.len;
    let hm;
    if((hm = /^ (?:has|have|gains?)(?: an additional)? /.exec(t))){
      t = t.slice(hm[0].length); len += hm[0].length;
      let total = 0; const fx = [];
      for(;;){
        const h = hasPhrase(t, r);
        if(!h){ const b = bareAttackItem(t); if(b){ fx.push(...b.fx.map(([id, v, w]) => Object.assign({ table:'FX', id, v }, w ? { only:w } : {}))); t = t.slice(b.len); total += b.len; } else return 0; }
        else { fx.push({ table:h.table, id:h.id, v:h.v }); t = t.slice(h.len); total += h.len; }
        const am = /^(?:,? and |, )/.exec(t);
        if(am && (hasPhrase(t.slice(am[0].length), r) || bareAttackItem(t.slice(am[0].length)))){ t = t.slice(am[0].length); total += am[0].length; continue; }
        break;
      }
      setReach(sub.reach);
      for(const f of fx){ r.effects.push(f); setSide(f.table === 'DF' ? 'defence' : f.table === 'ST' || f.table === 'SET' ? 'stat' : 'attack'); if(f.table === 'FX') setKind('any'); }
      return len + total;
    }
    // <S> can re-roll hit rolls … (attacks implied)
    if((hm = /^ can (re-roll (?:one )?(?:hit|wound|damage) rolls?(?: of 1)?)/.exec(t))){
      const b = bareAttackItem(hm[1]); if(!b) return 0;
      setReach(sub.reach); setKind('any'); setSide('attack'); addFx('FX', b.fx, 'any');
      return len + hm[0].length;
    }
    // <S> can ignore modifiers … / other abilities → outside
  }
  return 0;
}

// "this unit's", "the bearer's", "friendly ⟦X⟧ units'", "your unit's", "that unit's", "its"
function possessive(s, ctx){
  let m;
  if((m = /^its\b/.exec(s)) && ctx.lastSubject) return { reach:ctx.lastSubject, len:m[0].length };
  const sub = subject(s, ctx);
  if(!sub) return null;
  const t = s.slice(sub.len);
  if((m = /^(?:'s|s'|')/.exec(t))) return { reach:sub.reach, len:sub.len + m[0].length };
  return null;
}

// conditions that can sit between the attack clause and its effect: "if that target is …, "
function innerCond(t, r){
  let m;
  const C = [
    [/^if (?:the target|that target|that unit|the target unit|that enemy unit|the target of that attack) is (?:also )?below half-strength,? /, () => cond(r, 'targetBelowHalf')],
    [/^if (?:the target|that target|that enemy unit|the target of that attack|the target of those attacks) is (?:an enemy unit )?within range of (?:an|one or more) objectives?(?: markers?)?,? /, () => cond(r, 'targetObjective')],
    [/^if this unit has the ⟦BATTLELINE⟧ keyword and\/or it is within 6" of one or more friendly ⟦ADEPTUS MECHANICUS BATTLELINE⟧ units,? /, () => cond(r, 'battleline6')],
    [/^if (?:the target|that target|the target of that attack) is battle-shocked,? /, () => cond(r, 'targetBattleShocked', true, 'own')],
    [/^if (?:this model|this unit|the bearer|your unit) (?:made|has made) a charge move this turn,? /, () => cond(r, 'charged')],
    [/^if (?:this unit|your unit|this model) is (?:also )?below half-strength,? /, () => cond(r, 'belowHalf')],
    [/^if the strength characteristic of that attack is greater than (?:the toughness characteristic of (?:this|that|your) (?:unit|model)|(?:this|that|your) (?:unit|model)'s toughness characteristic),? /, () => cond(r, 'sOverT', undefined, 'DCOND')],
    [/^if that attack has an armour penetration characteristic of -(\d),? /, m => cond(r, 'apIs', -m[1], 'own')],
    [/^on a critical wound,? /, () => cond(r, 'onCritWound', true, 'own')],
    [/^until the (start|end) of (the phase|the turn|the battle), /, m => { r.duration = m[1] + ' of ' + m[2]; }],
    [/^if it is below its starting strength,? /, () => cond(r, 'belowStarting')],
    [/^if the attacking model's unit is within (\d+)" of your (⟦[^⟧]+⟧ )?unit,? /, m => cond(r, 'attackerWithin', { d:+m[1], of:'your ' + (m[2] ? clean(m[2]) : '') + 'unit' }, 'own')],
    [/^if (?:it|that attack) is made with an? (pistol|⟪pistol⟫|psychic weapon|melee weapon|ranged weapon),? /, m => cond(r, 'attackWith', clean(m[1]), 'own')],
    [new RegExp('^if (?:that|the) target is (?:an? )?(' + KX + ')(?: (?:unit|model))?,? '), m => cond(r, 'targetKw', kwExpr(m[1], { andIsOr:true }))],
    [/^on a critical hit,? /, () => cond(r, 'onCritHit', true, 'own')],
    [/^if the psychic test result for this ritual was (\d+)\+,? /, m => cond(r, 'test', { test:'Psychic test', result:m[1] + '+', passed:true }, 'own')]
  ];
  for(const [re, f] of C){ if((m = re.exec(t))){ f(m); return m[0].length; } }
  if((m = /^if that attack targets /.exec(t))){
    const n = targetPhrase(t.slice(m[0].length), r);
    if(n && /^,? /.test(t.slice(m[0].length + n))){ const k = /^,? /.exec(t.slice(m[0].length + n))[0].length; return m[0].length + n + k; }
  }
  return 0;
}

function defenceEffect10(s){
  let m;
  const E = [
    [/^subtract 1 from the hit roll/, () => [['hitMinus', 1]]],
    [/^subtract 1 from the wound roll/, () => [['woundMinus', 1]]],
    [/^subtract 1 from the damage characteristic of that attack/, () => [['dmgMinus', 1]]],
    [/^(?:worsen|reduce) the armour penetration characteristic of that attack by 1/, () => [['apWorse', 1]]],
    [/^halve the damage characteristic of that attack/, () => [['dmgHalf', true]]],
    [/^(?:you can )?change the damage characteristic of that attack to 0/, () => [['dmg0', true]]],
    [/^models in (?:it|this unit|that unit|your unit) have the benefit of cover against that attack/, () => [['cover', true]]],
    [/^(?:that|this) (?:unit|model) has the benefit of cover against that attack/, () => [['cover', true]]],
    [/^add 1 to (?:the|any) armour saving throws? made (?:against that attack|for that model)/, () => [['armourPlus', 1]]],
    [/^add 1 to (?:the|any) saving throws? made (?:against that attack|for that model)/, () => [['svPlus', 1]]],
    [/^models in (?:this|that|your) unit have the benefit of cover against that attack/, () => [['cover', true]]]
  ];
  for(const [re, f] of E){ if((m = re.exec(s))) return { len:m[0].length, fx:f(m) }; }
  return null;
}
function defenceEffect11(s){
  let m;
  const E = [
    [/^-1 to hit rolls?/, () => [['hitMinus', 1]]],
    [/^-1 to wound rolls?/, () => [['woundMinus', 1]]],
    [/^-1 ap\b/, () => [['apWorse', 1]]],
    [/^-1 d\b|^-1 damage/, () => [['dmgMinus', 1]]],
    [/^⟪hazardous⟫/, () => [['hazardous', true]]]
  ];
  for(const [re, f] of E){ if((m = re.exec(s))) return { len:m[0].length, fx:f(m) }; }
  return null;
}
function attackEffect11Bare(s){
  let m;
  if((m = /^\+(\d) (ap|a|s|d)\b/.exec(s))) return { len:m[0].length, fx:[[CHAR[m[2]], +m[1]]] };
  if((m = /^\+(\d) to (hit|wound) rolls?/.exec(s))) return { len:m[0].length, fx:[[m[2], +m[1]]] };
  if((m = /^((?:⟪[^⟫]+⟫(?:,? and |, )?)+)/.exec(s))) return { len:m[0].length, fx:bracketList(m[1]) };
  return null;
}
function weaponHave(s){
  let m;
  if((m = /^the selected abilit(?:y|ies)/.exec(s)) && CTX.selectedOptions) return { len:m[0].length, fx:[], selected:true };
  if((m = /^(?:the )?((?:⟪[^⟫]+⟫(?:,? and (?:the )?|, (?:the )?)?)+)(?: abilit(?:y|ies))?/.exec(s))) return { len:m[0].length, fx:bracketList(m[1]) };
  if((m = /^an? ballistic skill characteristic of (\d)\+/.exec(s))) return { len:m[0].length, fx:[['bsSet', +m[1]]] };
  if((m = /^an? attacks characteristic of (\d+)/.exec(s))) return { len:m[0].length, fx:[['aSet', +m[1]]] };
  if((m = /^\+(\d|d3) (ap|a|s|d)\b/.exec(s))) return { len:m[0].length, fx:[[CHAR[m[2]], num(m[1])]] };
  if((m = /^\+(\d+)" range/.exec(s))) return { len:m[0].length, fx:[['range', +m[1]]] };
  return null;
}

// a list of effects joined by ", " / " and " / ", and "; each item read by `one`
function effectList(t, one, allowBare){
  let len = 0; const fx = [];
  let e = one(t);
  if(!e) return null;
  for(;;){
    fx.push(...e.fx); t = t.slice(e.len); len += e.len;
    const am = /^(?:,? and (?:you can |can |have )?|, (?:you can |can )?)/.exec(t);
    if(!am) break;
    const rest = t.slice(am[0].length);
    const n = one(rest) || (allowBare ? bareAttackItem(rest) : null) || (/can $/.test(am[0]) ? one('can ' + rest) && Object.assign(one('can ' + rest), { len:one('can ' + rest).len - 4 }) : null)
      || (/have $/.test(am[0]) ? (one('have ' + rest) ? Object.assign(one('have ' + rest), { len:one('have ' + rest).len - 5 }) : null) : null);
    if(!n) break;
    t = rest; len += am[0].length; e = n;
  }
  return { len, fx };
}

/* ------------------------------------------------------------------ sentences with no effect of their own ------------- */

function structural(s, r, ctx){
  let m;
  const S = [
    // restrictions on who can take an enhancement / be a target

    [/^(?:if you do|if it does|that unit|this model has|this unit has|that model|your unit|your unit's attacks can|this unit's attacks can|that unit's attacks can|that unit's attacks have|this unit's attacks have|your unit's attacks have|the bearer's unit has|that unit has|on a \d\+|or)[:]?:$/, 'leadIn'],
    [/^:$/, 'leadIn'],
    [/^\d+\.?$/, 'step'],
    [/^(?:keywords|example:.*|\*.*\*)$/, 'note'],
    [/^\*/, 'note'],
    [/^this model can be attached to the following units?:/, 'leader'],
    [/^if this (?:model|unit) is in your army, it must be your (?:warlord|⟦warlord⟧|⟦WARLORD⟧)\.?$/, 'listBuilding'],
    [/^(?:\(once per [a-z ,]+\) )?(?:this model|this unit|you|the bearer|it) can use this (?:ability|enhancement)(?: one additional time)?\.?$/, 'activation'],
    [/\*$/, 'note']
  ];
  for(const [re, kind] of S){ if(re.test(s)){ r.kind = kind; return true; } }
  // "X model only." / "X units only (excluding Y)." / "X model with the Z ability only.": who the rest of the text is for
  if((m = new RegExp('^((?:' + KX + ')(?: (?:' + KX + '))?) (model|unit)s?( with the ([a-z\' -]+) ability)? only(?:' + EXCL + ')?\\.?$').exec(s))){
    r.kind = 'restriction';
    r.only = { kw:kwExpr(m[1].replace(/⟧ ⟦/g, ' '), { andIsOr:true }), of:m[2] };
    if(m[4]) r.only.ability = m[4];
    if(m[5]) r.only.excluding = kwList(m[5]);
    return true;
  }
  // selections: set the referent of "that unit" for later sentences
  // selections: "select one [visible] [friendly|enemy] [KW] unit|model [qualifiers…]"; every qualifier is kept
  const SEL = new RegExp('^(?:you can |then )?select (one|up to (?:one|two|three|\\d+)|any number of|a number of) (other )?(?:visible )?(friendly |enemy )?(?:visible )?(?:(' + KX + '|infantry|monster|vehicle|character) )?(units?|models?)(?: from (your|your opponent\'s) army)?');
  if((m = SEL.exec(s))){
    let t = s.slice(m[0].length).replace(/[.:]$/, '');
    const enemy = m[3] === 'enemy ' || m[6] === "your opponent's";
    const reach = { type:enemy ? 'selectedEnemy' : 'selected', unitsOrModels:/model/.test(m[5]) ? 'models' : 'units', count:m[1] };
    if(m[4]) reach.kw = /⟦/.test(m[4]) ? kwExpr(m[4], { andIsOr:true }) : { any:[m[4].toUpperCase()] };
    if(/^ ?visible|select one (?:other )?visible/.test(s)) (reach.qualifiers = reach.qualifiers || []).push('visible');
    const OFW = "(this model|this unit|the bearer|your unit|the bearer's unit|that unit|the manifesting model|that model|those ⟦[^⟧]+⟧ units|this ⟦[^⟧]+⟧(?: model)?|that ⟦[^⟧]+⟧ model)";
    const Q = [
      [new RegExp('^' + EXCL), x => { reach.excluding = (reach.excluding || []).concat(kwList(x[1])); }],
      [/^ \(excluding ([^)]+)\)/, x => q('excluding ' + x[1])],
      [/^ \(([^)]+)\)/, x => q(x[1])],
      [/^ in (?:your|this) unit/, () => { reach.of = 'your unit'; }],
      [new RegExp('^,? (?:that is |that are )?within (\\d+)" of (?:and visible to )?' + OFW), x => { reach.range = +x[1]; reach.of = x[2]; if(/visible to/.test(x[0])) q('visible'); }],
      [new RegExp('^,? (?:that is |that are )?within engagement range of ' + OFW), x => { reach.engagedWith = x[1]; }],
      [new RegExp('^,? (?:and |that is |that are )?visible to ' + OFW), x => q('visible to ' + x[1])],
      [/^,? (?:that is |that are )?(battle-shocked|not battle-shocked|unengaged)(?: and)?/, x => q(x[1])],
      [/^,? (?:that was |that were )?hit by (?:one or more of )?(?:those|this unit's|its) (?:attacks|[a-z' -]+? weapon)(?: made with [^.]+)?/, x => q(x[0].replace(/^,? /, ''))],
      [/^,? that (?:was|were) selected as the target of one or more of (?:your unit's|its|those) attacks/, x => q(x[0].replace(/^,? /, ''))],
      [/^,? (?:that is |that are )?engaged with (?:this unit|your unit)/, x => q(x[0].replace(/^,? /, ''))],
      [/^ to be (?:this model's|your) [a-z]+/, x => q(x[0].trim())],
      [/^ to be an? ([a-z' -]+?) unit/, x => { reach.becomes = x[1]; q(x[0].trim()); }],
      [/^ until the (start|end) of (the phase|the turn|the battle|your next command phase|your next turn|the battle round)/, x => { reach.until = x[1] + ' of ' + x[2]; }],
      [/^ equal to or less than the current battle round number/, x => q(x[0].trim())]
    ];
    function q(x){ (reach.qualifiers = reach.qualifiers || []).push(x); }
    for(let guard = 0; t && guard < 12; guard++){
      let hit = false;
      for(const [re, f] of Q){ const x = re.exec(t); if(x){ f(x); t = t.slice(x[0].length); hit = true; break; } }
      if(!hit) break;
    }
    if(!t.trim()){
      if(enemy) reach.enemy = true;
      reach.selection = true;
      setRef(ctx, 'ref', reach, r.conditions);
      if(enemy) ctx.refEnemy = reach;
      if(/model/.test(m[5])) ctx.refModel = reach;
      r.kind = 'select'; r.reach = reach;
      return true;
    }
  }
  if((m = /^(?:you can )?select one of the (?:following(?: abilities| modes| options)?|abilities in the (.+?) section(?: \((?:see [a-z ]+)\))?)(?: to (?:take effect|apply) until the (end|start) of (the phase|the turn|your next command phase))?(?:: (.*))?[.:]?$/.exec(s))){
    r.kind = 'optionPick'; ctx.optMode = true; if(m[1]) r.optionSection = m[1];
    if(m[2]) { r.duration = m[2] + ' of ' + m[3]; ctx.optDuration = r.duration; }
    if(m[4]){ // inline options: "[IGNORES COVER]; [LETHAL HITS]; …"
      const opts = m[4].split(/; | or /);
      const fx = []; for(const o of opts){ const b = bareAttackItem(o.replace(/\.$/, '')); if(!b) throw new Unread('unparsed:option "' + o + '"'); fx.push(...b.fx); }
      r.kind = 'effect'; r.side = 'attack'; r.attack = 'any'; r.options = fx.map(([id, v, w]) => Object.assign({ table:'FX', id, v }, w ? { only:w } : {})); r.effects = [];
      cond(r, 'opt', 'one of: ' + opts.join(' / ')); r.reach = ctx.lastSubject || { type:'self' };
    }
    return true;
  }
  if(/^(?:until the (?:start|end) of [a-z' ]+, )?(?:this model|this unit|the bearer|that unit) has (?:that|the selected) abilit(?:y|ies)(?: until the (?:start|end) of [a-z' ]+)?\.?$/.test(s)){ r.kind = 'grantsSelected'; return true; }
  if((m = /^(?:you can )?select either (?:the )?(⟪[^⟫]+⟫) or (?:the )?(⟪[^⟫]+⟫) abilit(?:y|ies)$/.exec(s))){
    const fx = bracketList(m[1] + ' and ' + m[2]);
    ctx.selectedOptions = { fx, via:r.conditions.map(c => Object.assign({}, c)), words:clean(m[1] + ' or ' + m[2]) };
    r.kind = 'optionPick'; return true;
  }
  if((m = /^while a unit is ([a-z'-]+),? it can use one of the ([a-z' -]+?) abilities below$/.exec(s))){
    r.kind = 'optionPick'; r.conditions.push({ id:'factionState', v:{ who:'that unit', state:m[1] }, table:'own' }); return true;
  }
  if((m = /^that (⟦[^⟧]+⟧ )?(model|unit) is affected by that ([a-z' -]+?) ability$/.exec(s))){
    const ref = ctx.refModel || ctx.ref; if(!ref) throw new Unread('unparsed:"that model" refers to nothing selected');
    useRef(ctx, ref); r.kind = 'grantsAbility'; r.reach = clean(ref); r.grants = m[3] + ' ability'; return true;
  }
  if((m = /^(that unit|this unit|this model|the area of the battlefield within (\d+)" of (?:this model|this ⟦[^⟧]+⟧)) is (?:considered to be )?within your army's ([a-z' -]+)$/.exec(s))){
    if(/^that unit/.test(m[1])){ const ref = ctx.ref; if(!ref) throw new Unread('unparsed:"that unit" refers to nothing'); useRef(ctx, ref); r.reach = clean(ref); }
    else r.reach = m[2] ? { type:'area', range:+m[2] } : subjOf(m[1]);
    r.kind = 'grantsState'; r.grants = "within your army's " + m[3]; return true;
  }
  if(/^one or more models from your army with an? [a-z' -]+ ability can use that ability$/.test(s)){ r.kind = 'activation'; return true; }
  if(new RegExp("^some (" + KX + ") models have an? [a-z' -]+ ability, tagged with the word '[a-z]+'$").test(s)){ r.kind = 'note'; return true; }
  if((m = new RegExp('^each of those (' + KX + ') units can make an? ([a-z\' -]+)$').exec(s))){ r.kind = 'activation'; r.activation = m[2]; return true; }
  if((m = /^(?:you can )?select one objective marker(?: you control| within range of this model)?\.?$/.exec(s))){ r.kind = 'select'; const ref = { type:'objective', selection:true }; setRef(ctx, 'refObjective', ref, r.conditions); r.reach = ref; return true; }
  if((m = /^(?:you can )?select one ([a-z' -]+?) from those listed below(?: for that unit to enter)?\.?$/.exec(s))){ r.kind = 'optionPick'; r.optionSection = m[1]; return true; }
  if((m = /^(?:you can )?select one (?:of the )?([a-z' -]+?) (?:listed|shown) below\.?$|^(?:you can )?select one ([a-z' -]+?) abilit(?:y|ies)(?: \(see [a-z ]+\))?\.?$/.exec(s))){ r.kind = 'optionPick'; r.optionSection = m[1] || m[2]; return true; }
  if((m = /^(?:you can )?spend (one or more of your [a-z]+) to activate one of the following abilities(?: until the (end|start) of (the battle|the turn|the phase|the battle round))?:?$/.exec(s))){
    r.kind = 'optionPick'; r.cost = m[1]; if(m[2]) r.duration = m[2] + ' of ' + m[3]; return true;
  }
  return false;
}

/* ------------------------------------------------------------------ topics outside the vocabulary --------------------- */

const OUTSIDE = [
  [/contains \d+ models? for each|add one new [a-z ]+ unit/, 'unit composition'],
  [/snap shooting|shoots? using|normal shooting|shoot as if it were/, 'shooting out of phase (snap shooting hits only on unmodified 6s: no vocabulary effect)'],
  [/\d+" a\d+ (?:bs|ws)\d\+|melee a\d+ ws\d\+|has the following weapon/, 'a weapon profile'],
  [/mortal wounds?/, 'mortal wounds'], [/\b\d*cp\b|command points?/, 'command points'], [/battle-shock|leadership|\bld\b/, 'battle-shock / leadership'],
  [/additionally equipped|is equipped with|has the following weapon/, 'wargear'], [/removed? (?:it |them |that model |this model )?from the battlefield|do not remove/, 'on destruction'],
  [/readied|doctrine|shadow of chaos|synapse|ka'tah|blessings? of khorne|dread abilit|disrupted|aflame|pact|hyper-adaptation|singular purpose|imperative|warlord|chapter/, 'faction mechanic'],
  [/charge roll|advance roll|eligible to (?:declare a charge|shoot|charge|start an action)|fall(?:s|en)? back|fall-back/, 'movement / charge eligibility'],
  [/normal move|advance move|\bmove\b|remain stationary|deep strike|strategic reserves|set (?:it|this model|this unit|them)? ?(?:back )?up|redeploy|ingress|surge move|pile-in|consolidat/, 'movement / deployment'],
  [/regains?|lost wounds|heal|return(?:ed)? (?:up to )?(?:\w+ )?destroyed|resurrect|reanimation/, 'healing / returning models'],
  [/objective|level of control|secured|sticky/, 'objectives'],
  [/stratagem/, 'stratagems'], [/psychic test|psyker level|psychic level|ritual/, 'psychic tests'],
  [/destroyed/, 'on destruction'], [/token|points?\b|blessings|pledge|dice pool/, 'faction resources'],
  [/fights? first|fight (?:first|last)|selected to fight/, 'fight sequencing'], [/visible|target(?:ed)? (?:with|by)|cannot be (?:selected|targeted)|lone operative/, 'targeting'],
  [/hazard roll|desperate escape/, 'hazard rolls'], [/saving throw|save roll/, 'saving throws'], [/wounds? characteristic|\+\d+ w\b/, 'wounds characteristic'],
  [/roll (?:one|a|\d+) d6|roll one dice/, 'dice roll result table'], [/keyword/, 'keywords'], [/transport|embark|disembark/, 'transports'],
  [/army faction|mustering|include|warlord|enhancements?/, 'army building'], [/action/, 'actions'], [/detection range|engagement range/, 'engagement / detection']
];
// Words of the vocabulary's own subjects: a sentence that has them and went unread is "unparsed", never "outside".
const COMBAT = /hit roll|wound roll|damage roll|armour penetration|\bap\b|damage characteristic|invulnerable|\binsv\b|feel no pain|⟪|critical|attacks characteristic|strength characteristic|objective control|\boc\b|move characteristic|toughness|re-roll (?:the |a |one )?(?:hit|wound|damage)|stealth|benefit of cover|lone operative|to hit rolls|to wound rolls/;
function outsideTopic(s, whole){ if(COMBAT.test(whole || s)) return null; for(const [re, t] of OUTSIDE) if(re.test(s)) return t; return null; }

/* ------------------------------------------------------------------ reading one sentence ------------------------------ */

function readSentence(text, ctx){
  ctx = ctx || {};
  // "<effect> (if …, <effect> instead)": the bracket is an alternative, read with the main sentence's conditions
  let bm;
  if((bm = /^(.*\S) \((if [^()]+?) instead\)\.?$/i.exec(plain(text).replace(/^-\s*/, '')))){
    const main = readSentence(bm[1] + '.', ctx);
    if(main.status !== 'read' || main.kind !== 'effect') return main.status === 'read' ? { status:'unread', reason:'unparsed:bracketed alternative after a sentence with no effect' } : main;
    const alt = readSentence(bm[2] + ' instead.', ctx);
    if(alt.status !== 'read' || alt.kind !== 'effect') return { status:'unread', reason:'unparsed:bracketed alternative: ' + (alt.reason || alt.kind), partial:main.effects };
    main.alternatives = [Object.assign({ instead:true }, alt)];
    return main;
  }
  CTX = ctx; ctx.usedRefs = [];
  const r = newReading();
  let s = tokenise(plain(text)).replace(/^-\s*/, '');
  ctx.curS = s;
  try {
    if(!s || /^[.:;]$/.test(s)){ r.kind = 'empty'; return r; }
    // leading tag "(aura)" etc is handled by the caller; strip trailing full stop
    s = s.replace(/\s*\.$/, '').replace(/\s*\(\d+(?:\.\d+)?\)$/, '').replace(/\s*\(\d+\.\d+\)/g, '');
    ctx.curS = s;
    if(structural(s, r, ctx)) return clean(r);
    let rest = s, guard = 0, m0;
    // "If that unit is …, … as well": the unit last named is the previous attack's target
    if(/^if that unit is .* as well$/.test(s) && ctx.lastAttack && ctx.lastAttack.conds.some(c => /^target|^closest|^maxT/.test(c.id))) rest = s.replace(/^if that unit is/, 'if the target unit is');
    // conditions and durations before the clause
    for(;;){ const n = prefix(rest, r, ctx); if(!n) break; rest = rest.slice(n); if(++guard > 20) break; }
    if(!rest){ r.kind = 'condition'; return clean(r); }
    if(structural(rest, r, ctx)){ return clean(r); }
    if(r.reachFromAura) r.reach = r.reachFromAura;
    // remember the sentence's subject, so a later "it"/"its" has an antecedent even when this sentence goes unread
    try { const sj = subject(rest, ctx); if(sj) ctx.lastSubject = sj.reach; } catch(e){ if(!(e instanceof Unread)) throw e; }
    // "Each time an enemy unit … targets this model, subtract 1 from the Hit roll …": the trigger names whose defence
    if(ctx.defTrigger && r.conditions.some(c => c.id === 'trigger')){
      const fx = defenceEffect10(rest);
      if(fx){
        r.reach = ctx.defTrigger; r.side = 'defence'; r.attack = 'any';
        fx.fx.forEach(([id, v]) => r.effects.push({ table:'DF', id, v, _reach:ctx.defTrigger }));
        rest = rest.slice(fx.len); ctx.defTrigger = null;
        const am = /^,? and (?:, )?/.exec(rest);
        if(am){ rest = rest.slice(am[0].length); let g = 0; for(;;){ const n2 = prefix(rest, r, ctx); if(!n2) break; rest = rest.slice(n2); if(++g > 10) break; } const n = core(rest, r, ctx); if(n){ for(const e of r.effects) if(!e._reach) e._reach = r._clauseReach; rest = rest.slice(n); } }
        if(!rest.replace(/^[\s.,;:]+/, '')) return finish(r, ctx);
        throw new Unread('unparsed:' + rest.slice(0, 120));
      }
    }
    // "you can re-roll one Hit roll, one Wound roll, … or one saving throw made for X": vocabulary rolls read, the rest listed
    if((m0 = /^(?:you can )?re-roll (one [a-z]+ (?:roll|throw)(?:, one [a-z]+ (?:roll|throw))*,? or one [a-z]+ (?:roll|throw))(?: made for (this model|this unit|the bearer|the bearer's unit|that unit))?$/.exec(rest))){
      const rolls = m0[1].split(/,? or |, /).map(x => x.replace(/^one /, '').replace(/saving throw/, 'save roll'));
      const inV = rolls.filter(x => /^(hit|wound|damage) roll$/.test(x)), outV = rolls.filter(x => !/^(hit|wound|damage) roll$/.test(x));
      const key = inV.map(x => x.split(' ')[0]).sort().join('+');
      const id = { 'damage+hit+wound':'oneAny', 'hit+wound':'oneEither', hit:'oneHit', wound:'oneWound', damage:'oneDmg' }[key];
      if(!id) throw new Unread('unparsed:a re-roll list of ' + inV.join(', '));
      r.effects.push({ table:'FX', id, v:true, attack:'any' }); r.side = 'attack'; r.attack = 'any';
      r.reach = m0[2] ? subject(m0[2], ctx).reach : (ctx.lastSubject || { type:'self' });
      if(outV.length) r.alsoOutsideVocabulary = outV.map(x => 're-roll one ' + x);
      return finish(r, ctx);
    }
    // "If they do, change the Damage characteristic of that attack to 0." after "when a saving throw made for … is failed"
    if(ctx.pendingDefence && r.conditions.some(c => c.id === 'used')){
      const fx = defenceEffect10(rest);
      if(fx && !rest.slice(fx.len).replace(/^[\s.,;:]+/, '')){
        useRef(ctx, ctx.refModel); r.reach = ctx.pendingDefence; r.side = 'defence'; r.attack = 'any';
        fx.fx.forEach(([id, v]) => r.effects.push({ table:'DF', id, v }));
        return finish(r, ctx);
      }
    }
    // a stratagem's "You re-roll that roll." after a WHEN that lists the rolls
    if(/^you re-roll that roll$/.test(rest) && ctx.stratRolls){
      const inV = ctx.stratRolls.filter(x => /^(hit|wound|damage) roll$/.test(x)), outV = ctx.stratRolls.filter(x => !/^(hit|wound|damage) roll$/.test(x));
      if(!inV.length) outside('re-rolls of ' + outV.join(', '));
      r.effects.push({ table:'FX', id:'oneAny', v:true, attack:'any' }); r.reach = { type:'unit', of:'stratagem target' }; r.side = 'attack'; r.attack = 'any';
      cond(r, 'justRolled', inV, 'own');
      if(outV.length) r.alsoOutsideVocabulary = outV.map(x => 're-roll that ' + x);
      return finish(r, ctx);
    }
    // Smokescreen: cover for your SMOKE unit and for units it hides
    if((m0 = new RegExp("^each time an attack targets either your (" + K + ") unit, or a unit that is not fully visible to the attacking model because of one or more models in your (" + K + ") unit, the target has the benefit of cover against that attack$").exec(rest))){
      r.effects.push({ table:'DF', id:'cover', v:true }); r.side = 'defence'; r.attack = 'any';
      r.reach = { type:'unit', of:'stratagem target', kw:kwExpr(m0[1]), alsoUnitsNotFullyVisibleBecauseOfIt:true }; r._eitherIsReach = true;
      if(ctx.stratTarget && ctx.stratTarget.kw) r.reach.targetKw = ctx.stratTarget.kw;
      return finish(r, ctx);
    }
    // "Each time this model is selected to shoot, you can re-roll one hit roll …": the trigger names whose attacks
    if(ctx.triggerSubject && r.conditions.some(c => c.id === 'trigger')){
      const fx = effectList(rest, attackEffect10);
      if(fx && !rest.slice(fx.len).replace(/^[\s.,;:]+/, '')){
        r.reach = ctx.triggerSubject; r.attack = 'any'; r.side = 'attack';
        fx.fx.forEach(([id, v, w]) => r.effects.push(Object.assign({ table:'FX', id, v, attack:'any' }, w ? { only:w } : {})));
        return finish(r, ctx);
      }
    }
    for(let i = 0; i < 6; i++){
      const before = r.effects.length; r._clauseReach = null;
      const n = core(rest, r, ctx);
      for(let j = before; j < r.effects.length; j++) r.effects[j]._reach = r._clauseReach || r.reach;
      if(!n) break;
      rest = rest.slice(n);
      // trailing duration / conditions
      let d;
      if((d = /^,? until the (start|end) of (the phase|the turn|the battle round|the battle|your next turn|your opponent's next turn|the next turn|the next battle round|your next command phase|your next movement phase)/.exec(rest))){ r.duration = d[1] + ' of ' + d[2]; rest = rest.slice(d[0].length); }
      if((d = /^,? until (that enemy unit has attacked|the attacking unit has finished making its attacks|that unit has fought|your unit has fought)/.exec(rest))){ r.duration = 'until ' + d[1]; rest = rest.slice(d[0].length); }
      if((d = /^ (?:while|if) (this model|this unit|it|that unit) is within range of an objective(?: marker)?/.exec(rest))){ cond(r, 'onObjective'); rest = rest.slice(d[0].length); }
      if((d = /^ (?:while|if) (?:this unit|that unit|it) is riled up/.exec(rest))){ cond(r, 'riled'); rest = rest.slice(d[0].length); }
      if((d = /^ (?:while|if) (?:this model|the bearer) is leading a unit/.exec(rest))){ cond(r, 'leading'); rest = rest.slice(d[0].length); }
      if((d = /^ instead/.exec(rest))){ r.instead = true; rest = rest.slice(d[0].length); }
      if((d = /^,? unless ([^,]+?)$/.exec(rest))){ const c = condOnly(d[1] + '.', ctx); if(!c) throw new Unread('unparsed:"unless ' + clean(d[1]) + '"'); r.conditions.push(negate(c)); rest = ''; }
      if((d = /^ as well/.exec(rest))){ rest = rest.slice(d[0].length); }
      const am = /^(?:,? and (?:then )?|; |, )/.exec(rest);
      if(am && rest.length > am[0].length){
        // a second clause, possibly with its own conditions/duration
        let r2 = rest.slice(am[0].length), g = 0;
        for(;;){ const n2 = prefix(r2, r, ctx); if(!n2) break; r2 = r2.slice(n2); if(++g > 10) break; }
        rest = r2; continue;
      }
      break;
    }
    rest = rest.replace(/^[\s.,;:]+|[\s.,;:]+$/g, '');
    if(rest){
      if(!r.effects.length){
        // bare effect sentence that continues the previous attack ("… add 1 to the wound roll as well")
        if(ctx.lastAttack){
          let inner, t = rest, n0 = 0;
          while((inner = innerCond(t, r))){ t = t.slice(inner); n0 += inner; }
          if(/ instead$/.test(t)){ r.instead = true; t = t.replace(/ instead$/, ''); }
          const e = attackEffect10(t);
          if(e && t.slice(e.len).replace(/^[\s.,;:]+/, '') === ''){
            r.reach = ctx.lastAttack.reach; r.attack = ctx.lastAttack.kind; r.side = 'attack';
            // the previous sentence's conditions still hold ("… as well" / "… instead" adds to that attack)
            r.conditions = ctx.lastAttack.conds.map(c => Object.assign({}, c)).concat(r.conditions);
            if(!r.duration) r.duration = ctx.lastAttack.duration;
            e.fx.forEach(([id, v, w]) => r.effects.push(Object.assign({ table:'FX', id, v }, w ? { only:w } : {})));
            r.continues = 'previous attack sentence';
            return finish(r, ctx);
          }
        }
          const topic = outsideTopic(rest, s);
        if(topic) throw new Unread('outside-vocabulary:' + topic);
      } else {
        const topic = outsideTopic(rest);
        if(topic) throw new Unread('outside-vocabulary:' + topic + ' (in the part after what was read)');
      }
      throw new Unread('unparsed:' + rest.slice(0, 120));
    }
    return finish(r, ctx);
  } catch(e){
    if(!(e instanceof Unread)) throw e;
    let reason = e.reason;
    if(/^unparsed/.test(reason) && !r.effects.length){ const t = outsideTopic(s, s); if(t) reason = 'outside-vocabulary:' + t; }
    return clean({ status:'unread', reason, partial:r.effects.length ? r.effects : undefined });
  }
}
// Self-check: never output a reading looser than its sentence. Every keyword, number, negation and condition opener of
// the sentence must be carried somewhere in the reading; choices ("either", "or" between effects) need an option.
function selfCheck(r, ctx){
  const s = ctx.curS || '';
  // vocabulary ids whose meaning includes words of the sentence
  const IMPLIED = { battleline6:' battleline adeptus mechanicus 6', closest18:' 18', sOverT:' strength toughness' };
  const json = (JSON.stringify(clean(r)) + r.conditions.map(c => IMPLIED[c.id] || '').join('')).toLowerCase();
  const fail = why => { throw new Unread('unparsed:self-check: ' + why); };
  for(const k of (s.match(/⟦[^⟧]+⟧/g) || [])){
    const words = k.slice(1, -1).split(' ').map(w => deplural(w).toLowerCase());
    for(const w of words) if(!json.includes(w.replace(/s$/, ''))) fail('keyword ' + k.slice(1, -1) + ' is not in the reading');
  }
  for(const n of (s.replace(/⟪[^⟫]*⟫/g, x => x).match(/\d+/g) || [])) if(!json.includes(n)) fail('the number ' + n + ' is not in the reading');
  if(/\bunless\b/.test(s) && !r.conditions.some(c => c.negated || /^not|Not/.test(c.id))) fail('"unless" is not read');
  if(/\beither\b/.test(s) && !r._eitherIsReach && !r.conditions.some(c => c.id === 'opt')) fail('"either" without an option');
  if(/⟫ or (?:the )?⟪|\bor (?:you can )?(?:re-roll|add|subtract|improve)\b/.test(s) && !r.effects.some(e => /^one(?:Either|Any)/.test(e.id)) && !r.conditions.some(c => c.id === 'opt')) fail('"or" between effects without an option');
  if(/\b(?:not|cannot|no)\b/.test(s.replace(/feel no pain/g, '').replace(/has no models with/, '')) && !/not|no /.test(json.replace(/"(?:table|id)":"[a-z]+"/g, m => /not/i.test(m) ? m : ''))) fail('a negation is not in the reading');
  if(/\bonly\b/.test(s)) fail('"only" is not read');
  const openers = (s.match(/\b(?:while|if|the first time|once per)\b/g) || []).length;
  if(openers > r.conditions.length) fail(openers + ' condition openers but ' + r.conditions.length + ' conditions');
}
// output words without the reader's internal keyword / ability marks
function clean(x){
  if(typeof x === 'string') return x.replace(/⟦([^⟧]*)⟧/g, '$1').replace(/⟪([^⟫]*)⟫/g, (m, w) => '[' + w.toUpperCase() + ']').replace(/[⟦⟧⟪⟫]/g, '');
  if(Array.isArray(x)) return x.map(clean);
  if(x && typeof x === 'object'){ const o = {}; for(const k of Object.keys(x)) if(k.charAt(0) !== '_') o[k] = clean(x[k]); return o; }
  return x;
}
function finish(r, ctx){
  // one sentence, two reaches ("halve the Attacks of that model's weapons, and each time this unit makes an attack …"):
  // each effect says whose it is
  const reaches = r.effects.map(e => JSON.stringify(clean(e._reach || r.reach)));
  if(new Set(reaches).size > 1){
    r.effects.forEach(e => { e.reach = clean(e._reach || r.reach); });
    // the sentence's reach is the reach of its counted effects (FX/DF/ST) when they share one; `reachPerEffect` says to look per effect
    const counted = r.effects.filter(e => ['FX', 'DF', 'ST'].includes(e.table)).map(e => JSON.stringify(e.reach));
    if(counted.length && new Set(counted).size === 1) r.reach = JSON.parse(counted[0]);
    r.reachPerEffect = true;
  }
  r.effects.forEach(e => { delete e._reach; }); delete r._clauseReach;
  const eitherOk = r._eitherIsReach; delete r._eitherIsReach; r._eitherIsReach = eitherOk;
  r.effects.forEach(e => { if(/^NC\./.test(e.id)){ e.table = 'NC'; e.id = e.id.slice(3); } });
  const seen = new Set(); r.conditions = r.conditions.filter(c => { const k = JSON.stringify(c); if(seen.has(k)) return false; seen.add(k); return true; });
  if(!r.effects.length && r.kind === 'effect' && !r.options) throw new Unread('unparsed:no effect');
  // an attack made by a unit selected to shoot is ranged, selected to fight melee: only for this trigger's own sentence,
  // the "If it does/you do" sentences after it, or a stratagem whose WHEN names it
  const kindFrom = ctx.stratKind || ((r.conditions.some(c => c.id === 'trigger' || c.id === 'used')) ? ctx.whenKind : null);
  if(r.side === 'attack' && kindFrom){
    r.effects.forEach(e => { if(e.table === 'FX' && e.attack === 'any'){ e.attack = kindFrom; e.attackFrom = ctx.stratKind ? 'stratagem WHEN' : 'trigger'; } });
    if(r.attack === 'any'){ r.attack = kindFrom; r.attackFrom = ctx.stratKind ? 'stratagem WHEN' : 'trigger'; }
  }
  if(r.reach && (r.reach.enemy || r.reach.type === 'enemyAura' || r.reach.type === 'selectedEnemy')) r.debuff = true;
  // referents set by an earlier sentence bring the conditions they were set under, and selections say what was selected
  for(const ref of ctx.usedRefs || []){
    if(ref._sent !== sentOf(ctx)) for(const c of ref._via || []) r.conditions.push(Object.assign({}, c));
    if(ref.selection) r.conditions.push({ id:'selected', v:clean(ref), table:'own' });
  }
  const seen2 = new Set(); r.conditions = r.conditions.filter(c => { const k = JSON.stringify(clean(c)); if(seen2.has(k)) return false; seen2.add(k); return true; });
  selfCheck(r, ctx); delete r._eitherIsReach;
  if(r.side === 'attack' && !r.continues) ctx.lastAttack = { reach:r.reach, kind:r.attack, conds:r.conditions.map(c => Object.assign({}, c)), duration:r.duration };
  if(r.side === 'mixed' || r.attack === 'mixed') { /* keep: the sentence carries effects on both sides */ }
  delete r.reachFromAura;
  return clean(r);
}

/* ------------------------------------------------------------------ splitting a source into sentences ----------------- */

// Lines → sentences, keeping the text's structure:
//   heading  an ALL-CAPS line or a bold-only line ("ASSAULT DOCTRINE", "- **Enraged Abjuration [2BTP]**"): names a section
//   sub      "**Name:** text" / "Name (Aura): text": names a sub-ability
//   lead     a line ending ":" leads the bullets after it; a bullet ending ":" leads the bullets after it (nested)
//   alt      bullets of a group containing an "Or:" bullet, and an "Or:" line with the sentence before it, are alternatives
function sentencesOf(text){
  const out = [];
  const lines = String(text || '').split('\n');
  let lead = null, outerLead = null, nestedSub = null, section = null, group = 0;
  for(const raw of lines){
    let line = raw.trim();
    if(!line) continue;
    const bullet = /^-\s+/.test(line);
    let m;
    const bare = plain(line.replace(/^-\s+/, ''));
    if((m = /^(?:-\s+)?\*\*([^*]+)\*\*\s*$/.exec(line)) && (/^\[.*\]\.?$/.test(m[1].trim()) || !/\S\s+\S/.test(m[1].trim()))) m = null;
    if(m || (/^[A-Z][A-Z0-9' &:\-]{2,50}$/.test(bare) && !/[.!?]$/.test(bare) && /[A-Z]{3}/.test(bare))){
      section = plain(m ? m[1] : bare).replace(/:$/, ''); lead = outerLead = nestedSub = null; group++;
      out.push({ text:section, heading:true, section, bullet, group });
      continue;
    }
    if(!bullet){ lead = outerLead = nestedSub = null; group++; }
    let sub = null;
    if((m = /^(?:-\s+)?\*\*([^*]{2,60}?)(?::\*\*|\*\*:)\s*/.exec(line))){ sub = plain(m[1]).trim(); line = (bullet ? '- ' : '') + line.slice(m[0].length); }
    else if((m = /^(?:-\s+)?(\[[A-Z][A-Z ]+\]|[A-Z][A-Za-z'’ \-]{2,40}(?: \((?:Aura|Psychic|Aura, Psychic)\))?):\s+(?=[A-Z(])/.exec(line)) && !/^(?:-\s+)?(?:Or|Example|On a|If you do|Note|FAQ|Designer)\b/.test(line)){
      sub = plain(m[1]).trim(); line = (bullet ? '- ' : '') + line.slice(m[0].length);
    }
    if(bullet && sub && lead !== outerLead){ lead = outerLead; nestedSub = null; } // a named bullet ends a nested list
    let alt = null;
    if((m = /^(?:-\s+)?((?:\+\d+CP )?Or):\s*/i.exec(plain(line)))){ alt = m[1]; line = (bullet ? '- ' : '') + plain(line).slice(m[0].length); }
    const parts = splitSentences(line.replace(/^-\s+/, ''));
    parts.forEach((p, i) => out.push({ text:p, bullet, lead:bullet ? lead : null, sub:sub || (bullet ? nestedSub : null), section, first:i === 0, alt, group }));
    if(/:\s*$/.test(line)){
      const l = line.replace(/^-\s+/, '').split(/(?<=[.!?])\s+(?=[A-Z(*\[])/).pop();
      if(!bullet){ lead = outerLead = l; group++; }
      else { lead = l; nestedSub = sub; group++; }
      // the lead's own bullets form a group
      out[out.length - 1].leadsGroup = group;
    }
  }
  // alternatives: a bullet group with an "Or:" bullet; an "Or:" line and the sentence before it
  const groups = {};
  out.forEach((x, i) => { if(x.bullet && x.alt){ groups[x.group] = true; } });
  out.forEach((x, i) => {
    if(x.heading) return;
    if(x.bullet && groups[x.group]) x.alt = 'option ' + (1 + out.filter((y, j) => j < i && y.bullet && y.group === x.group && y.first && !y.heading).length) + ' of ' + out.filter(y => y.bullet && y.group === x.group && y.first && !y.heading).length;
    else if(!x.bullet && x.alt){ x.alt = 'option 2 (' + x.alt + ')'; for(let j = i - 1; j >= 0 && !out[j].heading; j--){ if(out[j].alt) break; out[j].alt = 'option 1'; if(out[j].first && !out[j].bullet) break; } }
  });
  return out;
}
function splitSentences(line){
  // protect "e.g." and "(13.08)" style references
  const p = line.replace(/e\.g\./g, 'e\u0005g\u0005').replace(/\((\d+)\.(\d+)\)/g, '($1\u0005$2)');
  return p.split(/(?<=[.!?])\s+(?=[A-Z(*\[]|-\s)/).map(x => x.replace(/\u0005/g, '.').trim()).filter(Boolean);
}

// Join a bullet with its lead-in so the grammar reads one sentence: "This unit's attacks can:" + "Re-roll hit rolls of 1."
function leadType(lead){
  const l = plain(lead);
  if(/select one of|one of the following|choose one of|select either/i.test(l)) return 'option';
  if(/\bselect (?:one|up to)\b/i.test(l)) return 'select';
  if(/^(?:if you do|if it does|then):$/i.test(l)) return 'used';
  if(/roll (?:one|a|\d+) d6/i.test(l)) return 'roll';
  if(/^resolve the following sequence:?$/i.test(l)) return 'sequence';
  if(/any of the following apply/i.test(l)) return 'anyOf';
  if(/on a \d\+:?$|all of the following/i.test(l)) return 'other';
  return 'compose';
}
function composeBullet(lead, text){
  const l = lead.replace(/:\s*$/, '');
  let m;
  if((m = /^((?:if|while) [^,]+), (.*)$/i.exec(text))) return m[1] + ', ' + composeBullet(lead, m[2].charAt(0).toUpperCase() + m[2].slice(1));
  if(/(?:can|have|has|gain|gains|that unit:?|this model has|this unit has|'s|’s|\bto)$/i.test(l) || !/^(?:if|while|when|at|in|until|each time|after|during|once|for)\b/i.test(l)) return l + ' ' + text.charAt(0).toLowerCase() + text.slice(1);
  return l + ', ' + text.charAt(0).toLowerCase() + text.slice(1);
}

/* ------------------------------------------------------------------ reading a source ---------------------------------- */

const TAG_COND = [
  [/once per battle(?! round)/i, r => cond(r, 'oncePerBattle')],
  [/once per turn/i, r => cond(r, 'oncePerTurn')],
  [/once per (phase|battle round)/i, (r, m) => cond(r, 'oncePer', m[1].toLowerCase(), 'own')]
];
// a choice among effects (not a selection of a unit): every effect after it must say which option it is
const CHOICE = /select one of the following|one of the following (?:abilities|modes|options|to |abilit)|select (?:one|either) of the abilities|select either|abilities in the [^.]* section|select one [a-z' -]+? (?:ability|abilities|doctrine|imperative|mode|option)\b|(?:listed|shown) below|abilities below|activate one of|choose one|do one of the following|select one of the [a-z' -]+? (?:shown|below|imperatives|abilities)/i;

function stratagemContext(src, ctx){
  const w = tokenise(plain(src.when || ''));
  const conds = [];
  let m;
  if((m = /^(your|your opponent's|the|any) (?:(command|movement|shooting|charge|fight) phase)(?: or (your |your opponent's |the )?(command|movement|shooting|charge|fight) phase)?/.exec(w))){
    const turn = x => x === 'your' ? 'your' : x === "your opponent's" ? 'opp' : 'either';
    conds.push({ id:'phase', v:{ phase:m[2] + (m[4] ? '|' + m[4] : ''), turn:turn(m[1]) + (m[4] ? '|' + turn((m[3] || 'the').trim()) : '') }, table:'own' });
  }
  if(/selected to shoot/.test(w) && !/selected to (?:fight|attack)/.test(w)) ctx.stratKind = 'ranged';
  else if(/selected to fight/.test(w) && !/selected to (?:shoot|attack)/.test(w)) ctx.stratKind = 'melee';
  if(/has (?:made|ended) a charge move|made a charge move this turn/.test(w)) conds.push({ id:'charged', table:'COND' });
  conds.push({ id:'when', v:plain(src.when), table:'own' });
  if(/just after you make one of the following rolls/i.test(src.when || '')) ctx.stratRolls = plain(src.when).split('\n').slice(1).map(x => x.replace(/^-\s*/, '').replace(/\.$/, '').toLowerCase()).map(x => /number of attacks/.test(x) ? 'attacks roll' : x);
  // TARGET: the unit "your unit" means, as a reach restriction
  const t = tokenise(plain(src.target || '')).replace(/\.$/, '');
  const target = { text:plain(src.target || '') };
  if((m = new RegExp('^(?:one|that|up to \\w+) (?:other )?(?:friendly )?(?:(' + KX + ') )?(?:unit|model)s?(?: from your army)?(?:' + EXCL + ')?(.*)$').exec(t))){
    if(m[1]) target.kw = kwExpr(m[1], { andIsOr:true });
    if(m[2]) target.excluding = kwList(m[2]);
    if(m[3] && m[3].trim()) target.qualifier = clean(m[3].trim().replace(/^,\s*/, ''));
  } else if(t) target.unparsed = true;
  ctx.stratTarget = target;
  // with no selection, a stratagem's "that unit" / "those X units" is its TARGET, and "that enemy unit" the one its WHEN names
  setRef(ctx, 'ref', Object.assign({ type:'unit', of:'stratagem target' }, target.kw ? { targetKw:target.kw } : {}), []); ctx.ref._sent = -2;
  let tm2;
  if((tm2 = /,? and one enemy unit (.+)$/.exec(t))){ setRef(ctx, 'refEnemy', { type:'enemyInTarget', enemy:true, qualifier:clean(tm2[1]) }, [{ id:'target', v:plain(src.target), table:'own' }]); ctx.refEnemy._sent = -2; }
  else if(/\ban enemy unit\b/.test(w) && !/\benemy units\b/.test(w)){ setRef(ctx, 'refEnemy', { type:'enemyInWhen', enemy:true, when:plain(src.when) }, [{ id:'when', v:plain(src.when), table:'own' }]); ctx.refEnemy._sent = -2; }
  return conds;
}

// Choices made by another ability of the same datasheet ("select one Wrathful Presence ability", sub-abilities
// listed under "Wrathful Presence: pick one"): owner → { group name (lower case) → picker ability }
function pickGroups(sources){
  const by = {};
  for(const x of sources){
    const t = plain(x.text);
    let m;
    const re = /select one (?:of the abilities in the )?([A-Za-z'’ \-]+?) (?:ability|abilities|section)\b/g;
    while((m = re.exec(t))){ (by[x.owner] = by[x.owner] || {})[stem(m[1])] = x.name + ': ' + t; }
  }
  return by;
}
const stem = w => plain(w).toLowerCase().replace(/: pick one$/, '').replace(/ (?:abilities|ability)$/, '').replace(/s$/, '').trim();

// "<head> roll one D6: on a 2-5, <effect>; on a 6, <effect>": one reading per result, all of which must read
function diceTable(text, ctx){
  const m = /^(.*?)(?:,? (?:and |then )?|^)roll one D6: (on an? .+)$/i.exec(plain(text));
  if(!m) return null;
  const head = m[1].replace(/[,.\s]+$/, '');
  let headRd = null;
  if(head){ headRd = readSentence(head, Object.assign({}, ctx)); if(headRd.status !== 'read' || !['select', 'condition'].includes(headRd.kind)) return null; headRd = readSentence(head, ctx); }
  const rows = m[2].replace(/\.$/, '').split(/; (?=on an? )/i), outcomes = [];
  for(const row of rows){
    const rm = /^on an? (\d+(?:-\d+|\+)?),? (.*)$/i.exec(row);
    if(!rm) return { status:'unread', reason:'unparsed:dice table row ' + row.slice(0, 60) };
    const rd = readSentence(rm[2].charAt(0).toUpperCase() + rm[2].slice(1), ctx);
    if(rd.status !== 'read' || rd.kind !== 'effect') return { status:'unread', reason:(/^outside/.test(rd.reason || '') ? rd.reason : 'unparsed:dice table row "on a ' + rm[1] + '": ' + (rd.reason || rd.kind)) };
    rd.conditions = (headRd ? headRd.conditions : []).concat([{ id:'roll', v:{ dice:'D6', result:rm[1] }, table:'own' }], rd.conditions);
    outcomes.push(Object.assign({ result:rm[1] }, rd));
  }
  return { status:'read', kind:'diceTable', effects:[], conditions:headRd ? headRd.conditions : [], reach:headRd ? headRd.reach : null, outcomes };
}

// A rule-table row: which row it is (an option, a dice result, a threshold, a cost, a test), and the rule's own words
const DUR_RE = /until the (start|end) of (the battle round|the battle|the phase|the turn|your next command phase|your next turn|the next battle round)/gi;
function rowContext(src){
  const conds = [], label = src.rowLabel;
  const [name, key] = label.split(/\s*·\s*/);
  let m;
  if(/^\d+(?:[–-]\d+)?$/.test(label)) conds.push({ id:'roll', v:{ result:label.replace('–', '-'), roll:'the rule\'s D6' }, table:'own' });
  else if(/^\d+\+$/.test(label)) conds.push({ id:'tableThreshold', v:label, table:'own' });
  else {
    conds.push({ id:'opt', v:plain(name), table:'COND' });
    if(key){
      if((m = /^warp charge (\d+)$/i.exec(key))) conds.push({ id:'test', v:{ test:'Psychic test', result:m[1] + '+', passed:true }, table:'own' });
      else if(/double|triple/i.test(key)) conds.push({ id:'cost', v:'Blessings dice: ' + plain(key), table:'own' });
      else if(/^\d+$/.test(key)) conds.push({ id:'tableThreshold', v:key, table:'own' });
      else if(/^\d+[–-]\d+$/.test(key.replace(/^(deed|quality) /i, ''))) conds.push({ id:'roll', v:{ result:key, roll:'D6 or selected' }, table:'own' });
      else if(!/^N\/A$/.test(key)) conds.push({ id:'tableKey', v:plain(key), table:'own' });
    }
    if((m = /^(Deed|Quality) (\d+[–-]\d+)/.exec(name))) conds.push({ id:'roll', v:{ result:m[2].replace('–', '-'), roll:'D6, or selected' }, table:'own' });
  }
  conds.push({ id:'table', v:{ rule:src.parent, row:label }, table:'own' });
  const terms = plain(src.parentText).split('\n').filter(l => l && !/^\*/.test(l)).join(' ');
  conds.push({ id:'tableTerms', v:terms, table:'own' });
  const durs = [...new Set((terms.match(DUR_RE) || []).map(d => d.toLowerCase().replace(/^until the /, '')))];
  return { conds, durs };
}

// "<effect> if any of the following apply:" + bullets: each bullet is one alternative condition (COND anyOf)
function condOnly(text, ctx){
  const r = newReading(); CTX = ctx;
  let s = (/[⟦⟪]/.test(text) ? text : tokenise(plain(text))).replace(/^-\s*/, '').replace(/\.$/, '');
  s = 'if ' + s.charAt(0).toLowerCase() + s.slice(1) + ', ';
  try {
    let n = prefix(s, r, ctx) || innerCond(s, r);
    if(!n || n !== s.length) return null;
    return r.conditions.length === 1 ? clean(r.conditions[0]) : null;
  } catch(e){ if(e instanceof Unread) return null; throw e; }
}
function readSource(src){
  const ctx = { usedRefs:[] };
  const readings = [];
  const extraConds = [];
  if(src.kind === 'stratagem' || (src.kind === 'tableRow' && src.when)) extraConds.push(...stratagemContext(src, ctx));
  let rowDurs = null;
  if(src.kind === 'tableRow'){
    const rc = rowContext(src); extraConds.push(...rc.conds); rowDurs = rc.durs;
    // a row that completes a lead-in of the rule ("This unit's attacks have the relevant rule(s):" + "+1 A")
    if(src.tableAt != null){
      const lines = String(src.parentText).split('\n'), lead = lines[src.tableAt - 1];
      if(lead && /:\s*$/.test(lead) && !/\n/.test(src.text)){
        const l = plain(lead).split(/(?<=[.!?])\s+(?=[A-Z])/).pop().replace(/ the relevant (?:rule\(s\)|rules?|abilit(?:y|ies)):$/i, ':');
        src = Object.assign({}, src, { text:'- ' + src.text, leadLine:l });
      }
    }
  }
  if(src.tag){ for(const [re, f] of TAG_COND){ const m = re.exec(src.tag); if(m){ const tmp = { conditions:[] }; f(tmp, m); extraConds.push(...tmp.conditions); } } }
  const aura = /aura/i.test(src.tag || '');
  const psychicTag = /psychic/i.test(src.tag || '');
  const sents = sentencesOf(src.leadLine ? src.leadLine + '\n' + src.text : src.text);
  let choice = null;      // the sentence that opened a choice among effects
  let choiceRd = null, choiceOpts = false; const choiceTerms = []; const anyOfDone = {};
  let scope = null, scopeSection;  // "X units only." restriction in force
  sents.forEach((st, i) => {
    ctx.sentNo = i;
    const out = { idx:i, text:plain(st.text) };
    if(st.lead) out.lead = plain(st.lead);
    if(st.sub) out.sub = st.sub;
    if(st.section) out.section = st.section;
    if(st.alt) out.alt = st.alt;
    if(st.heading){ readings.push(Object.assign(out, { status:'read', kind:'heading', effects:[], conditions:[] })); if(scopeSection !== st.section) scope = null; return; }
    if(scope && scopeSection !== st.section) scope = null;
    let text = st.text;
    let composed = null, lt = null, leadRd = null;
    if(st.bullet && st.lead){
      lt = leadType(st.lead);
      if(lt === 'compose') composed = composeBullet(st.lead, text);
      if(lt === 'option'){ leadRd = readSentence(st.lead, Object.assign({}, ctx, { sentNo:-1 })); if(leadRd.status !== 'read') leadRd = null; }
      if(lt === 'select'){ ctx.sentNo = -1; leadRd = readSentence(st.lead, ctx); ctx.sentNo = i; if(leadRd.status !== 'read' || leadRd.kind !== 'select') lt = 'other'; }
      if(lt === 'roll'){ const rm = /^on an? (\d+(?:-\d+|\+)?),? (.*)$/i.exec(plain(text)); if(rm){ text = rm[2].charAt(0).toUpperCase() + rm[2].slice(1); out.roll = { roll:plain(st.lead).replace(/:$/, ''), result:rm[1] }; } else lt = 'other'; }
    }
    const isCue = CHOICE.test(plain(st.text)) && !choice;
    if(isCue) choice = plain(st.text);
    let rd;
    if(lt === 'anyOf'){
      rd = anyOfDone[i] || { status:'unread', reason:'unparsed:a condition of an "if any of the following apply" list the reader cannot read' };
    } else if(!st.bullet && /if any of the following apply/i.test(text) && /:\s*$/.test(text)){
      // read the effect without the clause, then every bullet as an alternative condition
      const bullets = []; for(let j = i + 1; j < sents.length && sents[j].bullet && sents[j].lead === text; j++) bullets.push(j);
      const conds = bullets.map(j => condOnly(sents[j].text, ctx));
      const eff = text.replace(/,? if any of the following apply,?/i, '').replace(/:\s*$/, '.');
      rd = conds.length && conds.every(Boolean) ? readSentence(eff, ctx) : { status:'unread', reason:'unparsed:"if any of the following apply" with a condition the reader cannot read' };
      if(rd.status === 'read' && rd.kind === 'effect'){
        rd.conditions = rd.conditions.concat([{ id:'anyOf', v:conds, table:'COND' }]);
        bullets.forEach(j => { anyOfDone[j] = { status:'read', kind:'condition', readThrough:'the sentence it lists conditions for', effects:[], conditions:[] }; });
      } else if(rd.status === 'read') rd = { status:'unread', reason:'unparsed:"if any of the following apply" without an effect' };
    } else rd = diceTable(composed || text, ctx) || readSentence(composed || text, ctx);
    if(isCue){ choiceRd = rd; }
    else if(choice && !choiceOpts && rd.status !== 'read' && lt !== 'option' && !st.alt) choiceTerms.push(plain(st.text));
    if(lt === 'option' && !leadRd && rd.status === 'read' && rd.kind === 'effect') rd = { status:'unread', reason:'unparsed:option list under a lead-in the reader cannot read: ' + plain(st.lead) };
    if(lt === 'other' && rd.status === 'read' && rd.kind === 'effect') rd = { status:'unread', reason:'unparsed:bullet under a lead-in the reader cannot read: ' + plain(st.lead) };
    if(lt === 'roll' && rd.status === 'read' && rd.kind === 'effect' && !out.roll) rd = { status:'unread', reason:'unparsed:dice table row' };
    // a lead-in line whose words are re-read inside each of its bullets
    if(rd.status === 'unread' && /:\s*$/.test(text) && sents[i + 1] && sents[i + 1].bullet && ['compose', 'roll'].includes(leadType(text)) && !/any of the following/i.test(text)) rd = { status:'read', kind:'leadIn', readThrough:'its bullets', effects:[], conditions:[] };
    if(rd.status === 'read' && rd.kind === 'effect' && (/^additional effect/i.test(st.sub || '') || /favoured ka'tah/i.test(st.section || '')))
      rd = { status:'unread', reason:'unparsed:an "Additional Effect" of a favoured ka\'tah: applies only with a choice made by another rule' };
    Object.assign(out, rd);
    // a selection the reader could not read: no later "that unit" may point at an older referent
    if(rd.status !== 'read' && /\bselect (?:one|up to|a number)\b/i.test(text)){ ctx.ref = ctx.refEnemy = ctx.refModel = null; }
    if(rd.status === 'read' && rd.kind === 'restriction'){ scope = rd.only; scopeSection = st.section; }
    if(rd.status === 'read' && rd.kind === 'effect'){
      const add = [];
      add.push(...extraConds);
      if(out.roll) add.push({ id:'roll', v:out.roll, table:'own' });
      // which option of a choice this sentence is
      let opt = null;
      if(lt === 'option' && leadRd){ opt = plain(text).replace(/\.$/, ''); add.push(...(leadRd.conditions || [])); if(leadRd.duration && !out.duration) out.duration = leadRd.duration; }
      if(st.alt) opt = (opt ? opt + ' / ' : '') + st.alt + ': ' + plain(text).replace(/\.$/, '');
      if(choice && !opt) opt = st.sub || (st.section && st.section !== 'RESTRICTIONS' ? st.section : null);
      if(st.bullet && st.sub && lt === 'option' && opt) opt = st.sub + ' › ' + opt;
      if(src.pick) add.push({ id:'opt', v:src.pick.option, table:'COND' }, { id:'choice', v:'picked by ' + src.pick.by + ' (' + src.pick.group + ')', table:'own' });
      if(opt) add.push({ id:'opt', v:opt, table:'COND' });
      if(choice && opt){
        choiceOpts = true;
        add.push({ id:'choice', v:choice, table:'own' });
        if(choiceTerms.length) add.push({ id:'choiceTerms', v:choiceTerms.slice(), table:'own' });
        if(choiceRd && choiceRd.status === 'read'){ if(choiceRd.duration && !out.duration) out.duration = choiceRd.duration; if(choiceRd.cost) add.push({ id:'cost', v:choiceRd.cost, table:'own' }); add.push(...(choiceRd.conditions || [])); }
      }
      if(scope) add.push({ id:'onlyFor', v:scope, table:'own' });
      if(rowDurs && rowDurs.length){ if(!out.duration && rowDurs.length === 1) out.duration = rowDurs[0]; else add.push({ id:'tableDurations', v:rowDurs, table:'own' }); }
      if(lt === 'used' && !rd.conditions.some(c => c.id === 'used')) add.push({ id:'used', table:'COND' });
      const seenC = new Set();
      out.conditions = (out.conditions || []).concat(add).filter(c => { const k = JSON.stringify(c); if(seenC.has(k)) return false; seenC.add(k); return true; });
      if(aura && rd.reach && rd.reach.type === 'aura') out.tagAura = true;
      if(psychicTag) out.psychicAbility = true;
      if(src.who && !src.pick) out.who = src.who;
      // never looser than GW: a choice is open but this sentence's option is not known
      if(choice && opt && !(choiceRd && choiceRd.status === 'read')) Object.assign(out, { status:'unread', reason:'unparsed:an option of a choice whose terms the reader cannot read ("' + choice.slice(0, 80) + '")', effects:undefined, conditions:undefined, reach:undefined, attack:undefined, side:undefined, duration:undefined, kind:undefined });
      if(choice && !opt && !src.pick && !rd.options) Object.assign(out, { status:'unread', reason:'unparsed:part of a choice ("' + choice.slice(0, 80) + '"), but which option this sentence is cannot be told', effects:undefined, conditions:undefined, reach:undefined, attack:undefined, side:undefined, duration:undefined, kind:undefined });
    }
    readings.push(out);
  });
  // terms of a choice wherever they stand (before or after its options): every unread sentence that is not an option
  const terms = readings.filter(x => x.status !== 'read' && !x.alt && !(x.sub && choice) && x.text).map(x => x.text);
  for(const x of readings) if(x.status === 'read' && (x.conditions || []).some(c => c.id === 'choice')){
    x.conditions = x.conditions.filter(c => c.id !== 'choiceTerms');
    if(terms.length) x.conditions.push({ id:'choiceTerms', v:terms, table:'own' });
  }
  return readings;
}

/* ------------------------------------------------------------------ GW text check ------------------------------------- */

const CACHE = process.env.KODEX_CACHE || '/home/user/warhammerapp/verify/.cache';
const squash = t => plain(t).toLowerCase().replace(/&[a-z#0-9]+;/g, ' ').replace(/[^a-z0-9+"]+/g, ' ').replace(/\s+/g, ' ').trim();
let CORPUS = null;
function corpus(){
  if(CORPUS !== null) return CORPUS;
  const parts = [];
  const add = f => { try { let t = fs.readFileSync(f, 'utf8'); if(/\.html$/.test(f)) t = t.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&rsquo;|&#8217;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"'); parts.push(squash(t)); } catch(e){} };
  for(const d of ['waha', 'waha/ds', 'gw']){
    let names = []; try { names = fs.readdirSync(path.join(CACHE, d)).sort(); } catch(e){}
    names.filter(n => /\.(txt|html)$/.test(n)).forEach(n => { if(d === 'waha' && /\.html$/.test(n)) return; add(path.join(CACHE, d, n)); });
  }
  CORPUS = parts.join(' | ');
  return CORPUS;
}
function gwFound(sentence){
  const q = squash(sentence);
  if(q.length < 12) return null; // too short to mean anything
  return corpus().includes(q);
}

/* ------------------------------------------------------------------ run over every source ------------------------------ */

// mark abilities that another ability of the same datasheet picks among
function prepare(sources){
  const picks = pickGroups(sources);
  for(const x of sources){
    if(!x.who) continue;
    const g = picks[x.owner] && picks[x.owner][stem(x.who)];
    if(g) x.pick = { group:x.who.replace(/: pick one$/i, ''), option:x.name, by:g };
    else if(/pick one/i.test(x.who)) x.pick = { group:x.who.replace(/: pick one$/i, ''), option:x.name, by:'(no picking ability found)' };
  }
  return sources;
}
function runAll(){
  const { listSources } = require(path.join(__dirname, 'sources.js'));
  const sources = prepare(listSources());
  const result = {};
  const counts = { sources:sources.length, sentences:0, read:0, readWithEffects:0, readNoEffect:0, unread:0, unreadOutside:0, unreadUnparsed:0, gwFound:0, gwNotFound:0, gwShort:0 };
  for(const src of sources){
    const rs = readSource(src);
    // stratagem WHEN/TARGET are context only, recorded once
    rs.forEach(rd => {
      const key = src.owner + '|' + src.name + '|' + rd.idx;
      const g = gwFound(rd.text);
      rd.gw = g === null ? 'short' : g ? 'found' : 'not-found';
      counts.sentences++;
      if(rd.status === 'read'){ counts.read++; if(rd.effects && rd.effects.length || rd.options || rd.outcomes) counts.readWithEffects++; else counts.readNoEffect++; }
      else { counts.unread++; if(/^outside/.test(rd.reason)) counts.unreadOutside++; else counts.unreadUnparsed++; }
      if(g === null) counts.gwShort++; else if(g) counts.gwFound++; else counts.gwNotFound++;
      result[key] = Object.assign({ owner:src.owner, ownerName:src.ownerName, source:src.name, sourceKind:src.kind }, rd);
    });
  }
  return { result, counts };
}

module.exports = { readSentence, readSource, sentencesOf, tokenise, plain, kwExpr, prepare };

if(require.main === module){
  const arg = process.argv[2];
  if(arg === '--say'){ console.log(JSON.stringify(readSentence(process.argv[3], {}), null, 1)); process.exit(0); }
  if(arg === '--test'){ require(path.join(__dirname, 'test.js')); process.exit(0); }
  const { result, counts } = runAll();
  const file = path.join(__dirname, 'readings2.json');
  const json = JSON.stringify({ reader:'reader2', counts, readings:result }, null, 1) + '\n';
  if(arg === '--check'){
    const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if(old !== json){ console.error('readings2.json is out of date (sources or reader changed): run node reader2.js'); process.exit(1); }
    console.log('readings2.json up to date', counts); process.exit(0);
  }
  fs.writeFileSync(file, json);
  console.log(counts);
}
