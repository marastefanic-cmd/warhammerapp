#!/usr/bin/env node
/* verify/agree.js: the gate step "agree", the two-reader rule (the owner's decision, 3 Nov 2026).

   A box of the Damage tab (data.js BOXES b), a "When targeted" line (BOXES d) or a stat line (BOXES st) counts, and is shown as a counted
   footnote or line, only where two independent readings of GW's words agree on it:
     the app's reading   data.js BOXES (verify/effects-extract.js, effects.js), and
     reader2's reading   verify/reader2/ (written apart from the app's reading code, and never importing it: R1 below).
   Each box is classed by the sentence(s) its quote lies in (align, then compare: the comparison of scratchpad reader-cmp, kept here as
   it was written):
     A  both read it and agree                      → confirmed ("A")
     B  both read it and disagree                   → confirmed only by a reviewed verdict of verify/sources/agree-verdicts.json with a GW
                                                      quote and the verdict "app right" or "both right" ("V")
     C  the app counts it, reader2 left it unread   → falls back (0)
   A box of a Core Rules weapon ability or Feel No Pain X+ (BOXES c|): GW's Core Rules, outside the comparison (reader2 reads the lists'
   rules, not the Core Rules): "core", counted as before (listed for the owner).
   A box that falls back is shown as GW's words with "see the rule" (moved to its source's not-counted words: effects.js agreed), never counted.

   The table: data.js AGREE (boxes: each BOXES key with a box → per field b / d / st, per box "A", "V", "core" or 0), written by
   node verify/agree.js --write, never by hand.

   Checks (each must pass):
     R1  verify/reader2/ never requires the app's reading code (effects-extract.js, effects-migrate.js, coverage.js, evidence.js, lines.js,
         defence.js, derive.js) nor reads data.js BOXES: every require is a builtin or a file of verify/reader2/, no string of its code
         names one of those files, no name of its code is boxes / BOXES
     R2  reader2's own tests pass (reader2.js --test) and its readings are what it reads now (reader2.js --check: deterministic)
     T   data.js AGREE is the table the comparison computes now
     Q   every verdict's GW quotes are in GW's text (verify/.cache: Wahapedia's faction pages and datasheets, GW's documents)
     S   every verdict is of a current class-B pair, and that pair is still what was reviewed (its fingerprint: the diffs, the app's
         entries, reader2's reading); a stale verdict fails
     K   no box AGREE marks confirmed is in class B or C without a verdict that confirms it
   Then the counts per list (verify/out/agree.json).

     node verify/agree.js              the gate step
     node verify/agree.js --write      write data.js AGREE from the comparison
     node verify/agree.js --bind ID    record the fingerprint of the pair a verdict was reviewed against (after reviewing it)
     node verify/agree.js --pairs      also write verify/out/agree-pairs.json (every pair, its class and diffs) */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data.js');
const R2DIR = path.join(ROOT, 'verify/reader2');
const VERDICTS = path.join(ROOT, 'verify/sources/agree-verdicts.json');
const CACHE = path.join(ROOT, 'verify/.cache');
const E = require(path.join(ROOT, 'effects.js'));
function loadData(src){ const sb = {}; return new Function('window', 'self', (src || fs.readFileSync(DATA, 'utf8')) + ';return window.WH_DATA;')(sb, sb); }
// ---- keys: every rule source (the enumeration reader2/sources.js makes) and its BOXES key, as app.html DM_KEY makes it
const ckHash = s => { let h = 0x811c9dc5; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
const dmStratText = s => ['WHEN: ' + s.when, 'TARGET: ' + s.target, 'EFFECT: ' + s.effect, s.restrictions ? 'RESTRICTIONS: ' + s.restrictions : ''].filter(Boolean).join('\n');
const dmRuleText = r => r.text + (r.table ? '\n' + r.table.map(t => t.join(': ')).join('\n') : '');
const K = { a:ab => 'a|' + ckHash(ab.name + '\n' + ab.text), r:r => 'r|' + ckHash(r.name + '\n' + dmRuleText(r)), s:s => 's|' + ckHash(s.name + '\n' + dmStratText(s)) };
const squash = t => String(t || '').replace(/\*\*|~~/g, '').replace(/[^A-Za-z0-9+"]+/g, ' ').trim().toLowerCase();
function sources(D){
  const out = [];
  const push = s => { if(s.text && String(s.text).trim()) out.push(s); };
  for(const [key, d] of Object.entries(D.datasheets)) for(const a of d.abilities || []) push({ kind:'ability', owner:'ds:' + key, ownerName:d.name, faction:d.faction, name:a.name, text:a.text, key:K.a(a), raw:a });
  const onSheet = new Set(); for(const d of Object.values(D.datasheets)) for(const x of d.abilities || []) onSheet.add(x.name + '|' + squash(x.text));
  const seen = new Set();
  for(const a of D.armies) for(const u of a.units) for(const x of u.abilities || []){
    if(!x.text || onSheet.has(x.name + '|' + squash(x.text))) continue;
    const k = a.id + '|' + u.id + '|' + x.name; if(seen.has(k)) continue; seen.add(k);
    push({ kind:'unitAbility', owner:'army:' + a.id + '/' + u.id, ownerName:u.name, faction:a.faction, name:x.name, text:x.text, key:K.a(x), raw:x });
  }
  for(const [fid, f] of Object.entries(D.factions)){
    for(const r of f.armyRules || []) push({ kind:'armyRule', owner:'faction:' + fid, ownerName:f.name, faction:fid, name:r.name, text:r.text, key:K.r(r), raw:r });
    for(const [did, det] of Object.entries(f.detachments || {})){
      const o = 'det:' + fid + '/' + did;
      if(det.rule) push({ kind:'detachmentRule', owner:o, ownerName:det.name, faction:fid, name:det.rule.name, text:det.rule.text, key:K.r(det.rule), raw:det.rule });
      for(const r of det.moreRules || []) push({ kind:'detachmentRule', owner:o, ownerName:det.name, faction:fid, name:r.name, text:r.text, key:K.r(r), raw:r });
      for(const e of det.enhancements || []) push({ kind:'enhancement', owner:o, ownerName:det.name, faction:fid, name:e.name, text:e.text, key:K.a(e), alt:[K.r(e)], raw:e });
      for(const s of det.stratagems || []) push({ kind:'stratagem', owner:o, ownerName:det.name, faction:fid, name:s.name, text:s.effect, key:K.s(s), raw:s });
    }
  }
  for(const s of D.coreStratagems || []) push({ kind:'stratagem', owner:'core', ownerName:'Core Stratagems', faction:'core', name:s.name, text:s.effect, key:K.s(s), raw:s });
  return out;
}
// ---- uses: which lists (and which of their units) use each rule source, by the BOXES key the app looks it up by
function uses(D){
  const S = sources(D), byKey = {}, out = {};
  for(const a of D.armies) for(const u of a.units) for(const x of u.abilities || []) if(x.text){ const k = K.a(x); (byKey[k] = byKey[k] || []).push(a.id + '/' + u.id); }
  // what a list printed into its units' profiles (a weapon's or a stat line's from: the rule that gives it, marked + on screen)
  const baked = {};
  for(const a of D.armies) for(const u of a.units) for(const p of [].concat(u.stats || [], u.ranged || [], u.melee || [])) for(const [ch, src] of Object.entries(p.from || {})){ (baked[src] = baked[src] || new Set()).add(a.id + '/' + u.id + ':' + ch); }
  for(const s of S){
    const sk = s.owner + '|' + s.name; let lists = [], units = [];
    if(s.kind === 'ability' || s.kind === 'unitAbility' || s.kind === 'enhancement'){ units = byKey[s.key] || []; if(s.kind === 'unitAbility') units = units.length ? units : [s.owner.slice(5)]; lists = [...new Set(units.map(x => x.split('/')[0]))]; }
    if(s.kind === 'armyRule') lists = D.armies.filter(a => 'faction:' + a.faction === s.owner).map(a => a.id);
    if(s.kind === 'detachmentRule' || (s.kind === 'stratagem' && s.owner !== 'core')) lists = D.armies.filter(a => a.detachments.some(d => s.owner === 'det:' + a.faction + '/' + d)).map(a => a.id);
    if(s.owner === 'core') lists = D.armies.map(a => a.id);
    // an enhancement whose holder is not in the list words: it is still on offer to the list's detachments
    if(s.kind === 'enhancement' && !units.length) lists = [];
    const bk = [...(baked[s.name] || [])].filter(x => !units.length || units.includes(x.split(':')[0]) || s.kind !== 'ability');
    out[sk] = { lists, units, baked:bk };
  }
  return out;
}
// ---- align: the app's BOXES entries paired with reader2's sentence readings, source by source, sentence by sentence: one row per
// reader2 sentence (with the app entries whose quote lies in it), plus app entries that fit no sentence (orphans)
function align(D, readings){
  const norm = t => String(t || '').replace(/^\s*-\s+/, '').replace(/\*\*|~~/g, '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ').trim().toLowerCase().replace(/[.:;,*]+$/, '').trim();
  const B = D.boxes, S = sources(D);
  // reader2 rows by source (owner|name)
  const bySrc = {};
  for(const [k, r] of Object.entries(readings)){ const sk = r.owner + '|' + r.source; (bySrc[sk] = bySrc[sk] || []).push(Object.assign({ key:k }, r)); }
  const rows = [], orphans = [];
  const srcIndex = {};
  for(const s of S){
    const sk = s.owner + '|' + s.name; if(srcIndex[sk]) continue; srcIndex[sk] = 1;   // (a name twice in one owner: same key as reader2 makes)
    const key = B[s.key] ? s.key : (s.alt || []).find(x => B[x]) || null, box = key ? B[key] : null;
    // a rule table's rows are reader2 sources of their own ("Rule › row"): they belong to the rule's BOXES key (the app's table-row boxes)
    const rowSrcs = Object.keys(bySrc).filter(k => k.startsWith(sk + ' › ')).sort();
    const sent = (bySrc[sk] || []).sort((a, b) => a.idx - b.idx).concat(...rowSrcs.map(k => bySrc[k].sort((a, b) => a.idx - b.idx)));
    const myRows = sent.map(r => ({ id:r.key, owner:s.owner, ownerName:s.ownerName, faction:s.faction, sourceKind:r.sourceKind === 'tableRow' ? 'tableRow' : s.kind, source:r.source, parent:s.name, idx:r.idx,
      text:r.text, lead:r.lead || null, boxKey:key, r2:r, app:[] }));
    if(!myRows.length && box) myRows.push({ id:sk + '|-', owner:s.owner, ownerName:s.ownerName, faction:s.faction, sourceKind:s.kind, source:s.name, idx:-1, text:s.text, boxKey:key, r2:null, app:[] });
    rows.push(...myRows);
    if(!box) continue;
    const entries = [];
    for(const f of ['b', 'd', 'st', 'nc', 'dnc', 'snc']) (box[f] || []).forEach((e, i) => entries.push(Object.assign({ field:f, i, boxReach:box.reach || null }, e)));
    for(const e of entries){
      const pieces = [...new Set([e.quote].concat((e.pick || []).flatMap(p => [p.quote || '', (p.part && p.part.quote) || ''])).join('\n').split('\n').map(norm).filter(Boolean))];
      let hit = new Set();
      for(const p of pieces){
        // exact sentence first, then the sentence containing the piece, then the piece containing the sentence
        let c = myRows.filter(r => norm(r.text) === p);
        if(!c.length) c = myRows.filter(r => norm(r.text).includes(p));
        if(!c.length) c = myRows.filter(r => p.includes(norm(r.text)) && norm(r.text).length > 12);
        if(c.length > 1 && e.lead){ const l = norm(e.lead); const c2 = c.filter(r => r.lead && (l.includes(norm(r.lead)) || norm(r.lead).includes(l))); if(c2.length) c = c2; }
        if(c.length > 1){ const c3 = c.filter(r => !r.app.some(x => x.field === e.field && x.i === e.i)); }
        c.forEach(r => hit.add(r));
      }
      if(!hit.size){
        // token overlap fallback
        const toks = new Set(norm(e.quote).split(/[^a-z0-9+"]+/).filter(w => w.length > 2));
        let best = null, bs = 0;
        for(const r of myRows){ const rt = new Set(norm(r.text).split(/[^a-z0-9+"]+/).filter(w => w.length > 2)); let n = 0; toks.forEach(w => { if(rt.has(w)) n++; }); const sc = n / Math.max(toks.size, 1); if(sc > bs){ bs = sc; best = r; } }
        if(best && bs >= 0.6){ hit.add(best); e.fuzzy = +bs.toFixed(2); }
      }
      if(!hit.size){ orphans.push({ owner:s.owner, ownerName:s.ownerName, source:s.name, sourceKind:s.kind, faction:s.faction, boxKey:key, entry:e }); continue; }
      if(hit.size > 1) e.multi = hit.size;
      hit.forEach(r => r.app.push(e));
    }
  }
  // "… have the selected ability" after "select either [A] or [B]": the sentence the app's pick box quotes is the one before it
  for(let i = 1; i < rows.length; i++){ const r = rows[i], pr = rows[i - 1];
    if(!r.app.length && r.r2 && r.r2.options && pr.owner === r.owner && pr.source === r.source && /selected ability/.test(r.text) && pr.app.some(e => e.pick)) r.app.push(...pr.app.filter(e => e.pick).map(e => Object.assign({ joinedFrom:pr.id }, e))); }
  return JSON.parse(JSON.stringify({ rows, orphans }));
}
// ---- compare: each aligned sentence classed A-E, by group, with what differs
function compare(aligned, DD, USES){
  const { rows, orphans } = aligned;
  const lc = s => String(s).toLowerCase().replace(/^faction: /, '').replace(/[’‘]/g, "'").trim();
  const val = v => v === true || v === undefined || v === null ? 'T' : String(v).toLowerCase();
  const kindN = k => (!k || k === 'all' || k === 'any') ? 'any' : k;
  // ---- effects to canonical strings: side:id=v@kind -------------------------------------------------------------
  const ENEMY = new Set(['enemyAura', 'selectedEnemy', 'triggeringEnemy']);
  function r2Effects(r){
    const out = [], enemy = r.debuff && ENEMY.has((r.reach || {}).type) && !r.reach2;
    for(const e of r.effects || []){
      if(e.table === 'NC') continue;
      // ignoring modifiers, as components: the vocabulary's ignoreHitMods = BS/WS + the hit roll; reader2's own ids are one component each
      if(e.id === 'ignoreHitMods'){ out.push('atk:ign.skill=T@' + kindN(e.attack || r.attack), 'atk:ign.hitroll=T@' + kindN(e.attack || r.attack)); continue; }
      if(/^ignore(Skill|HitRoll|Wound)Mods$/.test(e.id)){ out.push('atk:ign.' + { ignoreSkillMods:'skill', ignoreHitRollMods:'hitroll', ignoreWoundMods:'wound' }[e.id] + '=T@' + kindN(e.attack || r.attack)); continue; }
      if(e.id === 'oneAny' && (r.conditions || []).some(c => c.id === 'justRolled')){ out.push('atk:oneAnyPhase=T@' + kindN(e.attack || r.attack)); continue; }   // Command Re-roll: once per phase, as the app's oneAnyPhase   // reader2's not-counted effects (halveA, everyCrit): the app keeps them as nc, not compared
      if(e.table === 'SET'){ out.push('set:' + e.id + '=' + String(e.v).toLowerCase() + '@any'); continue; }   // a characteristic set to a value the vocabulary has no id for
      let side = e.table === 'FX' ? 'atk' : e.table === 'DF' ? 'def' : 'st', id = e.id, v = val(e.v), k = kindN(e.attack || r.attack);
      if(side === 'atk' && enemy){                    // a penalty to the enemy's own attacks ≡ a defence box marked foe
        if(id === 'hit'){ side = 'def'; id = 'hitMinus'; v = String(-e.v); }
        else if(id === 'wound'){ side = 'def'; id = 'woundMinus'; v = String(-e.v); }
        else if(id === 'hazardous'){ side = 'def'; }
        side += '/foe';
      }
      if(side === 'st' && enemy) side += '/foe';
      if(side === 'def' && id === 'inv' && k === 'ranged'){ id = 'invRanged'; }
      if(side === 'def' && /^(fnp|fnpMortal|fnpPsychic|fnpPsyMortal|inv|invRanged|svSet|t|stealth|loneOp|svPlus)$/.test(id) && !(id === 'svPlus' && k !== 'any')) k = 'any';
      if(side.startsWith('st')) k = 'any';
      out.push(side + ':' + id + '=' + v + '@' + k);
    }
    return out;
  }
  function appEffects(e){
    const out = [], k0 = kindN(e.kind);
    const one = (side, id, v) => { let k = k0;
      if(side === 'atk' && id === 'oc'){ side = 'st'; id = 'ocMinus'; v = String(Math.abs(+v)); }
      if(side === 'def' && id === 'inv' && k === 'ranged') id = 'invRanged';
      if(side === 'def' && /^(fnp|fnpMortal|fnpPsychic|fnpPsyMortal|inv|invRanged|svSet|t|stealth|loneOp|svPlus)$/.test(id) && !(id === 'svPlus' && k !== 'any')) k = 'any';
      if(side.startsWith('st')) k = 'any';
      if(e.foe && side === 'def') side = 'def/foe';
      if(e.foe && side === 'st') side = 'st/foe';
      out.push(side + ':' + id + '=' + val(v) + '@' + k); };
    if(e.field === 'b') (e.fx || []).forEach(([id, v]) => { if(id === 'ignoreHitMods'){ one('atk', 'ign.skill', true); one('atk', 'ign.hitroll', true); } else if(id === 'ignoreHitRollMods') one('atk', 'ign.hitroll', true); else if(id === 'ignoreWoundMods') one('atk', 'ign.wound', true); else one('atk', id, v); });
    if(e.field === 'd') (e.df || []).forEach(([id, v]) => one('def', id, v));
    if(e.field === 'st') (e.st || []).forEach(([id, v]) => one('st', id, v));
    return out;
  }
  const ignX = ([id, v]) => id === 'ignoreHitMods' ? ['ign.skill=T', 'ign.hitroll=T'] : id === 'ignoreHitRollMods' ? ['ign.hitroll=T'] : id === 'ignoreWoundMods' ? ['ign.wound=T'] : [id + '=' + val(v)];
  const appPick = e => (e.pick || []).map(p => (p.fx || p.df || []).flatMap(ignX).sort().join('+')).sort();
  const r2Pick = r => (r.options || []).map(o => (Array.isArray(o) ? o : [o]).map(x => x.id + '=' + val(x.v)).sort().join('+')).sort();
  // ---- reach ---------------------------------------------------------------------------------------------------
  const R2CAT = { self:'model', bearer:'model', leaderModel:'model', affectedModel:'selected', unit:'unit', bearerUnit:'unit', ledUnit:'unit', riledUnit:'unit',
    aura:'aura', friendly:'friendly', army:'friendly', selected:'selected', enemyAura:'enemy', selectedEnemy:'enemy', triggeringEnemy:'enemy', anyAttacker:'anyAttacker' };
  function r2Reach(r){
    let re = r.reach || {};
    if(r.reach2 && ENEMY.has(re.type)) re = r.reach2;            // "a friendly X model makes an attack that targets that (enemy) unit": the attacker
    const cat = R2CAT[re.type] || re.type || 'unit';
    let kw = null;
    if(re.kw && typeof re.kw === 'object'){ const dnf = []; if(re.kw.all) dnf.push(re.kw.all.flatMap(x => x.split('+')).map(lc)); if(re.kw.any) re.kw.any.forEach(x => dnf.push(x.split('+').map(lc))); kw = { dnf, none:(re.excluding || []).map(lc) }; }
    else if(re.excluding) kw = { dnf:[], none:re.excluding.map(lc) };
    return { cat, kw, range:re.range || null, type:re.type };
  }
  function appReach(e){
    const rc = e.reach || e.boxReach;
    let cat = e.mark === 'aura' ? 'aura' : e.mark === 'friendly' ? 'friendly' : e.mark === 'selected' ? 'selected' : e.foe ? 'enemy' : null;
    if(!cat) cat = e.scope && e.scope.models === 'model' ? 'model' : 'unit';
    let kw = null;
    if(rc && (cat === 'aura' || cat === 'friendly' || cat === 'selected')){ const all = (rc.all || []).map(lc), dnf = rc.any && rc.any.length ? rc.any.map(a => all.concat(lc(a))) : [all]; kw = { dnf, none:(rc.none || []).map(lc) }; }
    return { cat, kw };
  }
  const dnfKey = kw => !kw ? '' : kw.dnf.map(c => [...new Set(c)].sort().join('&')).filter(Boolean).sort().join(' | ') + (kw.none.length ? ' ¬(' + kw.none.sort().join('|') + ')' : '');
  // keyword runs: reader2 keeps an unknown multi-word run whole; compare by the words of each conjunction
  const dnfWords = kw => !kw ? '' : kw.dnf.map(c => c.join(' ').split(/\s+/).filter(Boolean).sort().join(' ')).filter(Boolean).sort().join(' | ') + (kw.none.length ? ' ¬(' + kw.none.join(' ').split(/\s+/).sort().join(' ') + ')' : '');
  // ---- conditions ----------------------------------------------------------------------------------------------
  // vocabulary ids compared as a set; equivalences: bearerLeading ≡ leading; aura implied by an aura reach; 'selected'
  // (a unit it selects) ≡ reader2's selected / affectedByThisAbility / selectedEnemy reach; phase (stratagem WHEN context) ignored
  const CEQ = { bearerLeading:'leading', objective:'targetObjective|onObjective' };
  const IGNORE_APP = new Set(['q', 'opt', 'selected', 'aura', 'anyOf']);
  const IGNORE_R2 = new Set(['phase', 'opt', 'aura']);
  const QCOVER = { belowHalf:/below half/, targetBelowHalf:/below half/, belowStarting:/below (its )?starting/, targetBelowStarting:/below (its )?starting/, controlling:/you control|controlling/,
    nearFriendly:/within \d+"/, charged:/charge/, onObjective:/objective/, targetObjective:/objective/, leading:/leading/, ledBy:/leading/, oncePerBattle:/once per battle/, oncePerTurn:/once per turn/,
    stationary:/stationary/, used:/if (it|you|they) do/, targetKw:/target/, sOverT:/greater than/, riled:/riled/, selfKw:/model only|has the/ };
  function condCmp(r, apps, ctx){
    const a = new Map(), b = new Map();
    for(const e of apps) for(const [id, v] of e.on || []) if(!IGNORE_APP.has(id)) a.set(CEQ[id] || id, v && typeof v === 'object' && !Array.isArray(v) && v.said ? (({ said, ...rest }) => rest)(v) : v);   // targetKw.said: GW's words for the label
    const tk = [];   // reader2 can carry several targetKw (a continuation keeps the earlier one); an effect's own restriction (only) is one too
    for(const c of r.conditions || []) if(c.table !== 'own' && !IGNORE_R2.has(c.id)){ if(c.negated){ b.set('not:' + c.id, c.v); continue; } if(c.id === 'targetKw') tk.push(c.v); else b.set(c.id, c.v); }
    for(const e of r.effects || []) if(e.only && e.only.targetKw) tk.push(e.only.targetKw);
    // the selection's keywords (reader2 own 'selected' with kw, e.g. "select one visible enemy VEHICLE unit") ≡ the app's targetKw on attacks against it
    const sel = (r.conditions || []).find(c => c.id === 'selected' && c.v && c.v.kw && c.v.type === 'selectedEnemy'); if(sel) tk.push(sel.v.kw);
    const norm = v => JSON.stringify(v).toLowerCase().replace(/faction: /g, '').replace(/beasts/g, 'beasts');
    const atk = a.get('targetKw');
    if(atk !== undefined){ const i = tk.findIndex(v => norm(v) === norm(atk)); if(i >= 0){ tk.splice(i, 1); b.set('targetKw', atk); } else if(tk.length){ b.set('targetKw', tk.shift()); } }
    const qsT = apps.flatMap(e => (e.on || []).filter(c => c[0] === 'q').map(c => String(c[1]).toLowerCase()));
    const tkLeft = tk.filter(v => !qsT.some(q => Object.values(v).flat().every(w => q.includes(String(w).toLowerCase()))));
    if(!b.has('targetKw') && tkLeft.length) b.set('targetKw', tkLeft.shift());
    const extraTk = tkLeft;
    const anyOf = (r.conditions || []).find(c => c.id === 'anyOf'); if(anyOf){ b.delete('anyOf'); const ids = anyOf.v.map(x => x.id).sort().join(','); if(ids === 'onObjective,targetObjective' && a.has('targetObjective|onObjective')){ a.delete('targetObjective|onObjective'); } else b.set('anyOf', ids); }
    // a pick's options carry their own conditions (Martial Ka'tah: Dacatarai excludes MONSTER/VEHICLE targets, Rendax needs them)
    for(const e of apps) for(const o of e.pick || []) for(const [id, v] of o.on || []) if(id === 'targetKw' && !a.has('targetKw') && tk.some(t => norm(t) === norm(v))){ a.set('targetKw', v); }
    if(a.has('targetKw') && !b.has('targetKw')){ const i = tk.findIndex(v => norm(v) === norm(a.get('targetKw'))); if(i >= 0){ b.set('targetKw', tk[i]); tk.splice(i, 1); } }
    // the rule's own words (reader2's tableTerms / WHEN) give "you can use this ability … If you do" and "once per battle"
    const terms = (r.conditions || []).filter(c => ['tableTerms', 'when', 'choice'].includes(c.id)).map(c => JSON.stringify(c.v).toLowerCase()).join(' ');
    if(a.has('used') && !b.has('used') && /use this ability|if you do|can use/.test(terms)) a.delete('used');
    if(a.has('oncePerBattle') && !b.has('oncePerBattle') && /once per battle/.test(terms)) a.delete('oncePerBattle');
    if(a.has('targetObjective|onObjective')){ a.delete('targetObjective|onObjective'); if(b.has('targetObjective')) a.set('targetObjective', true); else if(b.has('onObjective')) a.set('onObjective', true); else a.set('objective', true); }
    const diffs = [];
    for(const v of (typeof extraTk !== 'undefined' ? extraTk : [])) diffs.push('reader2 only: targetKw=' + JSON.stringify(v));
    // allocated to a MONSTER/VEHICLE model ≡ the target has that keyword (reader2 own allocatedToKw ≡ app targetKw)
    const alloc = (r.conditions || []).find(c => c.id === 'allocatedToKw'); if(alloc && !b.has('targetKw')) b.set('targetKw', alloc.v);
    // an implied condition: Below Half-strength implies below Starting Strength
    if(b.has('belowHalf') || a.has('belowHalf')){ a.delete('belowStarting'); b.delete('belowStarting'); }
    if(b.has('targetBelowHalf') || a.has('targetBelowHalf')){ a.delete('targetBelowStarting'); b.delete('targetBelowStarting'); }
    if(a.has('maxT') && b.has('maxT') && +a.get('maxT') + 1 === +b.get('maxT')) a.set('maxT', b.get('maxT'));   // app keeps the highest T allowed, reader2 the T of "no models with a T of N+"
    const qs0 = apps.flatMap(e => (e.on || []).filter(c => c[0] === 'q').map(c => String(c[1]).toLowerCase()));
    for(const [id, v] of a) if(!b.has(id)){
      if(ctx && ctx.stratWords && QCOVER[id] && QCOVER[id].test(ctx.stratWords)) continue;   // from the stratagem's WHEN/TARGET, which reader2 does not read for conditions
      diffs.push('app only: ' + id + (v === true ? '' : '=' + JSON.stringify(v)));
    }
    for(const [id, v] of b) if(!a.has(id)){
      if(QCOVER[id] && qs0.some(q => QCOVER[id].test(q))) continue;   // the app keeps it as GW's words (q / lead)
      if(/^not:/.test(id) && qs0.some(q => /\bunless\b|\bnot\b/.test(q) && QCOVER[id.slice(4)] && QCOVER[id.slice(4)].test(q))) continue;   // "unless …" kept as GW's words
      diffs.push('reader2 only: ' + id + (v === undefined ? '' : '=' + JSON.stringify(v)));
    }
    for(const [id, v] of a) if(b.has(id) && v !== true && b.get(id) !== undefined){
      const x = JSON.stringify(v).toLowerCase(), y = JSON.stringify(b.get(id)).toLowerCase();
      const xs = JSON.stringify(v).toLowerCase().replace(/faction: /g, ''), ys = JSON.stringify(b.get(id)).toLowerCase();
      if(xs !== ys && !(id === 'aura' && +v === +b.get(id))) diffs.push('value ' + id + ': app ' + x + ' / reader2 ' + y);
    }
    // reader2's own (free-text) conditions: must be covered by an app q / scope / id of the same meaning
    const qs = apps.flatMap(e => (e.on || []).filter(c => c[0] === 'q').map(c => String(c[1]).toLowerCase()));
    const scopeW = apps.map(e => (e.scope && e.scope.weapon) || '').join(' ');
    const appIds = new Set(apps.flatMap(e => (e.on || []).map(c => c[0])));
    const OWNCOVER = { woundsRemaining:/wounds? remaining|remaining wounds|damaged/, battleShocked:/battle-?shocked/, targetBattleShocked:/battle-?shocked/, moved:/move|ingress|advanced|fell back|normal/,
      synapse:/synapse/, affectedByThisAbility:/affected by this ability/, usingAbility:/using the/, contains:/contains/, firstTime:/first time/, timing:/start of|end of/,
      targetWithin:/within/, targetTGreater:/toughness|\bt\b/, onCritWound:/critical wound/, woundsLost:/lost|wounds/, allocatedToKw:/allocated/, targetDestroyedYourUnit:/destroyed/, trigger:/selected to|targets this|targeted|target of|selected as/, oncePer:/once per/, armyFaction:/army/ };
    for(const c of r.conditions || []){
      if(c.table !== 'own' || ['phase', 'when', 'timing', 'choice', 'choiceTerms', 'table', 'tableTerms', 'tableDurations', 'justRolled', 'roll', 'tableThreshold', 'tableKey', 'anyOf'].includes(c.id)) continue;   // context (WHEN, timing); choices compared below
      let ok = false;
      const leads = apps.map(e => String(e.lead || '').replace(/\*\*/g, '').toLowerCase()).join(' ');
      const kwWords = v => { const k = v && v.kw; return k ? Object.values(k).flat().map(w => String(w).toLowerCase().replace(/s$/, '')) : []; };
      const appKw = JSON.stringify(apps.map(e => [e.reach, e.boxReach, e.scope, (e.on || []).filter(x => ['targetKw', 'selfKw', 'ledBy', 'nearFriendly'].includes(x[0]))])).toLowerCase();
      if(c.id === 'weapon') ok = scopeW.toLowerCase().includes(String(c.v).toLowerCase()) || qs.some(q => q.includes(String(c.v).toLowerCase()));
      else if(c.id === 'weaponExcluding') ok = apps.some(e => e.excl || (e.scope && (e.scope.wkw || e.scope.wkwNot))) || apps.some(e => (e.on || []).some(x => x[0] === 'q' && /excluding/i.test(x[1])));
      else if(c.id === 'allocatedToKw') ok = true;   // compared as targetKw above
      else if(c.id === 'trigger') ok = (ctx && ctx.kind === 'stratagem') || apps.some(e => e.pool || e.kind === 'ranged' || e.kind === 'melee') || qs.some(q => OWNCOVER.trigger.test(q)) || appIds.has('used');
      else if(c.id === 'affectedByThisAbility') ok = appIds.has('selected') || qs.some(q => OWNCOVER.affectedByThisAbility.test(q));
      else if(c.id === 'synapse') ok = qs.some(q => /synapse/.test(q));
      else if(c.id === 'onlyFor') ok = (ctx && /enhancement|unitAbility/.test(ctx.kind)) || /\bonly\b/.test(leads) || kwWords(c.v).every(w => appKw.includes(w.trim())) || appIds.has('selfKw') || appIds.has('opt');
      else if(c.id === 'selected' && apps.some(e => e.scope && e.scope.models === 'char') && /CHARACTER/.test(JSON.stringify(c.v.kw || ''))) ok = true;
      else if(c.id === 'selected') ok = (appIds.has('targetSelected') || appIds.has('selected') || apps.some(e => e.mark === 'selected' || e.foe) || qs.some(q => /select/.test(q))) && kwWords(c.v).every(w => appKw.includes(w.trim()));
      else if(c.id === 'test') ok = qs.some(q => /test/.test(q)) || appIds.has('opt');
      else if(c.id === 'abilityActive') ok = qs.some(q => /active|doctrine/.test(q)) || appIds.has('opt');
      else if(c.id === 'weaponKind') ok = apps.some(e => e.kind === c.v || (e.scope && e.scope.wkw));
      else if(['factionState', 'targetState', 'grantsState', 'grantsAbility'].includes(c.id)){ const w = JSON.stringify(c.v).toLowerCase().match(/[a-z][a-z' ]{3,}/g) || []; const st = w.filter(x => !/^(who|that unit|state)$/.test(x.trim())); ok = qs.some(q => st.some(x => q.includes(x.trim()))) || appIds.has('opt') || appIds.has('selected') || appIds.has('targetSelected') || (ctx && ctx.kind === 'stratagem'); }
      else if(c.id === 'leadingKw') ok = appIds.has('leading') || appIds.has('ledBy') || qs.some(q => /leading/.test(q));
      else if(c.id === 'unengaged') ok = qs.some(q => /unengaged|engag/.test(q));
      else if(c.id === 'cost') ok = qs.some(q => /cp|btp/.test(q)) || appIds.has('opt');
      else if(c.id === 'onSelectedObjective') ok = qs.some(q => /objective/.test(q)) || appIds.has('opt');
      else if(OWNCOVER[c.id]) ok = qs.some(q => OWNCOVER[c.id].test(q));
      if(!ok) diffs.push('reader2 only: ' + c.id + (c.v === true || c.v === undefined ? '' : '=' + JSON.stringify(c.v)));
    }
    return diffs;
  }
  // ---- duration ------------------------------------------------------------------------------------------------
  const durR2 = d => !d ? '-' : /end of the phase|until that enemy unit has attacked|attacking unit has finished|fight phase/.test(d) ? '-' : /end of the turn/.test(d) ? 'turn' : /next command phase|next turn|next movement phase|battle round/.test(d) ? 'round' : /battle/.test(d) ? 'battle' : d;
  const durApp = apps => { for(const e of apps){ if(e.lasts) return e.lasts; if(e.until) return /battle round/.test(e.until) ? 'round' : /battle/.test(e.until) ? 'battle' : /next (command phase|turn)/i.test(e.until) ? 'round' : e.until; } return '-'; };
  // ---- classify, by group: the sentences and the app entries that quote them, joined while one entry spans several sentences ----
  const SRC = {}; for(const x of sources(DD)) SRC[x.owner + '|' + x.name] = x;
  const plain = t => String(t || '').replace(/\*\*|~~/g, '').replace(/[’‘]/g, "'").toLowerCase();
  const isCounted = e => ['b', 'd', 'st'].includes(e.field) && ((e.fx || e.df || e.st || []).length || (e.pick || []).length);
  const eKey = (row, e) => row.owner + '|' + row.source + '|' + row.boxKey + '|' + e.field + e.i;
  // groups
  const parent = {}; const find = x => parent[x] === x ? x : (parent[x] = find(parent[x])); const uni = (a, b) => { parent[find(a)] = find(b); };
  rows.forEach(r => { parent[r.id] = r.id; r.app.forEach(e => { const k = eKey(r, e); if(!parent[k]) parent[k] = k; uni(r.id, k); }); });
  const groups = {}; rows.forEach(r => { (groups[find(r.id)] = groups[find(r.id)] || []).push(r); });
  // attack kind: reader2 'any' and the app's ranged / melee agree when the rule names one phase only (Shooting → ranged, Fight → melee),
  // or the stratagem's WHEN does; the app's PSYCHIC weapon keyword ≡ reader2's psychic attacks
  function phaseKind(rs, src){
    const ph = rs.flatMap(r => (r.r2 && r.r2.conditions || []).filter(c => c.id === 'phase').map(c => c.v.phase));
    if(ph.length && ph.every(p => p === 'shooting')) return 'ranged';
    if(ph.length && ph.every(p => p === 'fight')) return 'melee';
    const t = plain((src && src.raw && (src.raw.when || '')) + ' ' + (src ? src.text : '') + ' ' + rs.map(r => r.lead || '').join(' '));
    const sh = /shooting phase|selected to shoot/.test(t), fi = /fight phase|selected to fight/.test(t);
    if(sh && !fi) return 'ranged'; if(fi && !sh) return 'melee'; return null;
  }
  const pairsOut = [];
  for(const [gid, rs] of Object.entries(groups)){
    const src = SRC[rs[0].owner + '|' + (rs[0].parent || rs[0].source)];
    const seen = new Set(), apps = [];
    rs.forEach(r => r.app.forEach(e => { const k = eKey(r, e); if(!seen.has(k)){ seen.add(k); apps.push(e); } }));
    const cnt = apps.filter(isCounted), nc = apps.filter(e => e.field === 'nc' || e.field === 'dnc' || e.field === 'snc');
    const r2s = rs.map(r => r.r2).filter(Boolean);
    const readR = r2s.flatMap(r => [r].concat((r.alternatives || []).filter(x => x.status === 'read')))   // reader2's "(… instead)" alternatives are readings too
      .filter(r => r.status === 'read' && r.kind === 'effect' && ((r.effects || []).some(e => e.table !== 'NC') || (r.options || []).length));
    let cls, diffs = [], equiv = [];
    if(cnt.length && readR.length){
      const pk = phaseKind(rs, src);
      const fixK = (s, e) => s;
      let A = cnt.flatMap(e => appEffects(e).map(x => (e.scope && /psychic/i.test(e.scope.wkw || '')) ? x.replace(/@\w+$/, '@psychic') : x)).sort();
      let Rr = readR.flatMap(r2Effects).sort();
      // a characteristic the app shows as a not-counted stat line (snc, with GW's words) ≡ reader2's ST / SET effect on that characteristic
      const sncStats = new Set(apps.filter(e => e.field === 'snc').map(e => String(e.stat).toUpperCase()));
      const ST2 = { ocAdd:'OC', ocMinus:'OC', mAdd:'M' };
      if(sncStats.size){ const before = Rr.length; Rr = Rr.filter(x => { const m = /^(set|st(?:\/foe)?):(\w+)=/.exec(x); if(!m) return true; const stat = m[1] === 'set' ? m[2].toUpperCase() : ST2[m[2]]; return !sncStats.has(stat); }); if(Rr.length < before) equiv.push('stat shown as not counted (snc)'); }
      if(pk){ Rr = Rr.map(x => { if(/@any$/.test(x) && x.startsWith('atk') || /@any$/.test(x) && /def:(hitMinus|woundMinus|apWorse|dmgMinus|dmgHalf|dmg0|cover)/.test(x)){ const y = x.replace(/@any$/, '@' + pk); if(A.includes(y)){ equiv.push('attack kind from the phase'); return y; } } return x; }); }
      const pa = cnt.flatMap(appPick).sort(), pr = readR.flatMap(r2Pick).sort();
      const strip = s => s.replace(/@.*/, '');
      const rest = (x, y) => { const m = y.slice(); return x.filter(s => { const i = m.indexOf(s); if(i >= 0){ m.splice(i, 1); return false; } return true; }); };
      // an app pick ≡ reader2's options read one sentence each, every one under a choice (opt / choice)
      const rAsPick = readR.every(x => (x.conditions || []).some(c => ['opt', 'choice', 'roll', 'tableThreshold'].includes(c.id))) && !pr.length && pa.length
        && (() => { const g = {}; for(const x of readR){ const o = ((x.conditions || []).find(c => c.id === 'opt' || c.id === 'roll' || c.id === 'abilityActive') || { v:x.id }).v; const k = JSON.stringify(o); (g[k] = g[k] || []).push(...r2Effects(x).map(z => z.replace(/^[^:]*:/, '').replace(/@.*/, ''))); }
            return Object.values(g).every(es => pa.includes(es.sort().join('+'))); })() && !A.length;
      if(rAsPick) equiv.push('pick ≡ one option per sentence');
      else if(A.map(strip).join(',') !== Rr.map(strip).join(',') || pa.join(',') !== pr.join(',')){
        diffs.push({ what:'effects', app:A.concat(pa.map(p => 'pick:' + p)), reader2:Rr.concat(pr.map(p => 'pick:' + p)), appOnly:rest(A.map(strip), Rr.map(strip)).concat(rest(pa, pr).map(p => 'pick:' + p)), r2Only:rest(Rr.map(strip), A.map(strip)).concat(rest(pr, pa).map(p => 'pick:' + p)) });
      } else if(A.join(',') !== Rr.join(',')) diffs.push({ what:'attack kind', app:A, reader2:Rr });
      // reach (first counted entry / first read sentence)
      const r = readR[0], e0 = cnt[0];
      const ar = appReach(e0), rr = r2Reach(r);
      if(e0.reach && !e0.mark && ar.cat === 'unit'){ ar.cat = 'friendly'; const rc = e0.reach, all = (rc.all || []).map(lc); ar.kw = { dnf:rc.any && rc.any.length ? rc.any.map(x => all.concat(lc(x))) : [all], none:(rc.none || []).map(lc) }; }
      if(e0.scope && e0.scope.models && e0.scope.models !== 'model' && e0.scope.models !== 'char') ar.cat = 'part:' + lc(e0.scope.models);
      if(e0.scope && e0.scope.models === 'char' && (r.reach || {}).type === 'selected') ar.cat = 'part:char';
      if(r.reach && r.reach.type === 'leaderModel' && r.reach.kw) rr.cat = 'part:' + lc(r.reach.kw);
      const tSel = readR.some(x => (x.conditions || []).some(c => c.id === 'targetSelected')) || cnt.some(x => (x.on || []).some(c => c[0] === 'targetSelected'));
      const ruleSrc = src && /armyRule|detachmentRule/.test(src.kind) || rs[0].sourceKind === 'tableRow';
      let catEq = ar.cat === rr.cat || rr.cat === 'anyAttacker'
        || (ruleSrc && ar.cat === 'unit' && ['friendly', 'army'].includes(rr.cat))   // a rule's box reaches the units that have the rule (its needs)
        || (ar.cat === 'part:one' && rr.cat === 'selected') || (ar.cat === 'part:char' && rr.type === 'selected' && /character/i.test(JSON.stringify(rr.kw || '')))
        || (tSel && ['selected', 'aura', 'friendly', 'unit', 'model', 'enemy'].includes(ar.cat) && ['friendly', 'unit', 'model', 'enemy', 'selected'].includes(rr.cat) && (ar.cat === 'selected' || ar.cat === 'aura' || rr.cat !== 'friendly'))
        || (ar.cat === 'selected' && rr.cat === 'enemy');
      if(catEq && ar.cat !== rr.cat) equiv.push('reach: ' + ar.cat + ' ≡ ' + rr.cat + (tSel ? ' (attacks against the selected/affected enemy unit)' : ''));
      // a one-model unit: "this model" ≡ "this unit"
      if(!catEq && ((ar.cat === 'unit' && rr.cat === 'model') || (ar.cat === 'model' && rr.cat === 'unit'))){
        const ds = rs[0].owner.startsWith('ds:') ? DD.datasheets[rs[0].owner.slice(3)] : null;
        const one = ds && /^1 model|^1 [A-Z]/.test(String(ds.composition || ds.models || '')) ;
        if(one){ catEq = true; equiv.push('reach: model ≡ unit (one-model unit)'); }
      }
      if(!catEq) diffs.push({ what:'reach', app:ar.cat, reader2:rr.cat + (rr.type !== rr.cat ? ' (' + rr.type + ')' : '') });
      else if((ar.kw || rr.kw) && ['aura', 'friendly', 'selected'].includes(ar.cat) && !(rr.type === 'affectedModel' && !rr.kw)){
        if(dnfWords(ar.kw) !== dnfWords(rr.kw) && !(ar.kw && rr.kw && dnfKey(ar.kw) === dnfKey(rr.kw))) diffs.push({ what:'reach keywords', app:dnfKey(ar.kw), reader2:dnfKey(rr.kw) });
      }
      if(rr.cat === 'aura' && ar.cat === 'aura'){ const av = (e0.on || []).find(c => c[0] === 'aura'); if(av && rr.range && +av[1] !== +rr.range) diffs.push({ what:'aura range', app:av[1], reader2:rr.range }); }
      const ctx = { kind: src ? src.kind : '', stratWords: src && src.kind === 'stratagem' ? plain(src.raw.when + ' ' + src.raw.target) : '' };
      const cd = [...new Set(readR.flatMap(x => condCmp(x, cnt, ctx)))];
      // a choice: the app's opt / pick / "select one of the following" words ≡ reader2's opt / options; a keyword-gated option (selfKw) counts as one
      const aOpt = cnt.some(e => e.opt || (e.pick || []).length || (e.on || []).some(c => c[0] === 'opt' || (c[0] === 'q' && /select one|one of the following|or:|is active|doctrine/i.test(c[1]))));
      const rOpt = readR.some(x => x.options || (x.conditions || []).some(c => ['opt', 'choice', 'roll', 'tableThreshold', 'abilityActive'].includes(c.id)));
      const kwGate = readR.some(x => (x.conditions || []).some(c => c.id === 'selfKw'));
      if(aOpt !== rOpt && !(aOpt && kwGate)) cd.push(aOpt ? 'app only: a choice (opt)' : 'reader2 only: a choice (opt)');
      if(cd.length) diffs.push({ what:'conditions', list:cd });
      // duration: the app's span of a "this turn" condition (charged this turn) or of the lead's selection is the same span
      const da = durApp(cnt), drs = readR.map(x => durR2(x.duration)), dr = drs.find(x => x !== '-') || '-';
      if(da !== dr){
        const srcT = plain(src ? src.text : '');
        const ok = (dr === '-' && da === 'turn' && (/this turn/.test(plain(rs.map(x => x.text + ' ' + (x.lead || '')).join(' ') + ' ' + (src && src.raw.when || '') + ' ' + (src && src.raw.target || ''))) || /until the end of the turn/.test(srcT)))
          || (dr === '-' && da === 'round' && /until the start of your next (command phase|turn)/.test(srcT))
          || (dr === '-' && da === 'battle' && /until the end of the battle/.test(srcT));
        if(ok) equiv.push('duration from the condition / lead (' + da + ')'); else diffs.push({ what:'duration', app:da, reader2:readR.map(x => x.duration).find(Boolean) || '-' });
      }
      cls = diffs.length ? 'B' : 'A';
    } else if(cnt.length) cls = 'C';
    else if(readR.length && nc.some(e => e.field === 'snc') && readR.every(x => (x.effects || []).every(z => z.table === 'ST' || z.table === 'SET' || z.table === 'NC'))) cls = 'D-snc';   // the app shows it, marked not counted (a stat line)
    else if(readR.length) cls = (((USES[rs[0].owner + '|' + (rs[0].parent || rs[0].source)] || {}).baked || []).length && ((USES[rs[0].owner + '|' + (rs[0].parent || rs[0].source)] || {}).lists || []).length && !/Daemonic Allegiance/.test(rs[0].source)) ? 'D-baked' : 'D';
    else cls = 'E';
    const appState = cnt.length ? 'counted' : nc.length ? 'not counted (' + [...new Set(nc.map(e => e.why))].join('; ') + ')' : rs[0].boxKey ? 'box, no entry for this sentence' : 'no box';
    const appOut = apps.map(e => { const o = Object.assign({}, e); delete o.boxReach; if(e.boxReach && !e.reach) o.boxReach = e.boxReach; return o; });
    for(const row of rs){
      const r = row.r2;
      pairsOut.push({ id:row.id, group:rs.length > 1 ? gid : undefined, cls, owner:row.owner, parent:row.parent, ownerName:row.ownerName, faction:row.faction, sourceKind:row.sourceKind, source:row.source, idx:row.idx, text:row.text, lead:row.lead || undefined,
        boxKey:row.boxKey, appState, lists:(USES[row.owner + '|' + (row.parent || row.source)] || {}).lists || [], units:(USES[row.owner + '|' + (row.parent || row.source)] || {}).units || [], baked:(USES[row.owner + '|' + (row.parent || row.source)] || {}).baked, app:row === rs[0] ? appOut : undefined,
        r2:r ? { status:r.status, kind:r.kind, reason:r.reason, effects:r.effects, options:r.options, attack:r.attack, side:r.side, reach:r.reach, reach2:r.reach2, debuff:r.debuff, conditions:r.conditions, duration:r.duration, partial:r.partial, gw:r.gw } : null,
        diffs:row === rs[0] ? diffs : undefined, equiv:row === rs[0] && equiv.length ? [...new Set(equiv)] : undefined });
    }
  }
  for(const o of orphans){
    const e = o.entry, counted = isCounted(e);
    pairsOut.push({ id:o.owner + '|' + o.source + '|app:' + e.field + e.i, cls:counted ? 'C' : 'E', orphan:true, owner:o.owner, ownerName:o.ownerName, faction:o.faction, sourceKind:o.sourceKind, source:o.source, idx:null,
      text:e.quote, boxKey:o.boxKey, appState:counted ? 'counted' : 'not counted', lists:(USES[o.owner + '|' + o.source] || {}).lists || [], units:(USES[o.owner + '|' + o.source] || {}).units || [], app:[e], r2:null, diffs:[], note:'the app quote fits no reader2 sentence (reader2 does not read rule tables, nor the term definitions the app pulls in)' });
  }

  return pairsOut;
}
// ---- release: per box (BOXES key × b / d / st entry, as the app draws it: the same ability on several datasheets is one box), its class:
// the worst of its pairs' (C, then B without a verdict, then B with one, then A); and whether it changes a Damage-tab number when ticked
// (an attack box with an effect calc.js plays: effects.js FX mod not null; range alone counts only through half range, not taken)
const counted = e => ['b', 'd', 'st'].includes(e.field) && ((e.fx || e.df || e.st || []).length || (e.pick || []).length);
const fxNum = fx => (fx || []).some(([id, v]) => id !== 'range' && E.FX[id] && E.FX[id].mod(v) != null);
const numeric = e => e.field === 'b' && (fxNum(e.fx) || (e.pick || []).some(p => fxNum(p.fx) || (p.part && fxNum(p.part.fx))));
const kindOf = e => e.field === 'b' ? (numeric(e) ? 'number' : 'label') : e.field === 'd' ? 'defence' : 'stat';
function release(P, okB){
  const byBox = {};
  for(const p of P.filter(p => p.app)) for(const e of p.app.filter(counted)){
    const cls = p.cls === 'B' && okB.has(p.id) ? 'B-ok' : p.cls, k = p.boxKey + '|' + e.field + e.i;
    const b = byBox[k] = byBox[k] || { key:p.boxKey, field:e.field, i:e.i, cls:new Set(), kind:kindOf(e), src:p.sourceKind, name:p.source, lists:new Set(), units:new Set(), pairs:[] };
    b.cls.add(cls); b.pairs.push(p.id); p.lists.forEach(l => b.lists.add(l)); p.units.forEach(u => b.units.add(u));
  }
  for(const b of Object.values(byBox)) b.c = b.cls.has('C') ? 'C' : b.cls.has('B') ? 'B' : b.cls.has('B-ok') ? 'B-ok' : 'A';
  return byBox;
}
// ---- the table: per BOXES key with a box, per field, per entry: "A" (both readers), "V" (a reviewed verdict), "core" (a Core Rules box,
// outside the comparison), 0 (falls back); null: no effect, nothing to count
const hasFx = (f, e) => !!((f === 'b' ? e.fx : f === 'd' ? e.df : e.st) || []).length || !!(e.pick || []).length;
function table(D, byBox){
  const out = {};
  for(const k of Object.keys(D.boxes).sort()){ const o = D.boxes[k], row = {};
    for(const f of ['b', 'd', 'st']) if((o[f] || []).some(e => hasFx(f, e))) row[f] = o[f].map((e, i) => { if(!hasFx(f, e)) return null;
      if(/^c\|/.test(k)) return 'core';
      const b = byBox[k + '|' + f + i]; return b && b.c === 'A' ? 'A' : b && b.c === 'B-ok' ? 'V' : 0; });
    if(Object.keys(row).length) out[k] = row;
  }
  return { boxes:out };
}
const START = '// ---- AGREE: written by verify/agree.js --write from BOXES, reader2\'s readings and the reviewed verdicts (do not edit) ----';
const END = '// ---- end of AGREE ----';
const block = T => START + '\n' +
  '// The two-reader rule (the owner\'s decision, 3 Nov 2026): a box of BOXES (b, d, st) counts only where reader2 (verify/reader2/, an\n' +
  '// independent second reading of GW\'s words) agrees with it ("A") or a reviewed verdict with GW\'s quote shows the app right ("V",\n' +
  '// verify/sources/agree-verdicts.json); a Core Rules box is outside the comparison ("core"). Any other (0) is shown as GW\'s words, "see the\n' +
  '// rule", and never counted (effects.js agreed). boxes: per BOXES key, per field, per box\n' +
  'const AGREE = {\n  boxes:{\n' + Object.entries(T.boxes).map(([k, v]) => '    ' + JSON.stringify(k) + ':' + JSON.stringify(v)).join(',\n') + '\n  }\n};\n' + END + '\n';
function write(src, T){
  const i = src.indexOf(START), j = src.indexOf(END);
  if(i >= 0 && j > i) src = src.slice(0, i) + block(T) + src.slice(j + END.length + 1);
  else { const k = src.indexOf('// ---- end of BOXES ----\n'); if(k < 0) throw new Error('data.js: no end of BOXES'); const at = k + '// ---- end of BOXES ----\n'.length; src = src.slice(0, at) + block(T) + src.slice(at); }
  if(!/agree:AGREE/.test(src)) src = src.replace(/boxes:BOXES/, 'boxes:BOXES, agree:AGREE');
  return src;
}
// ---- the checks
// R1: what reader2's code requires and names (comments and the words of its strings apart: "defence" is a word of its readings)
const R2_BANNED = ['effects-extract', 'effects-migrate', 'coverage', 'evidence', 'lines', 'defence', 'derive'];
const BUILTIN = new Set(require('module').builtinModules);
function stripComments(s){
  let out = '', i = 0, q = null;
  while(i < s.length){ const c = s[i], n = s[i + 1];
    if(q){ out += c; if(c === '\\'){ out += n || ''; i += 2; continue; } if(c === q) q = null; i++; continue; }
    if(c === '/' && n === '*'){ const j = s.indexOf('*/', i + 2); i = j < 0 ? s.length : j + 2; out += ' '; continue; }
    if(c === '/' && n === '/'){ const j = s.indexOf('\n', i); i = j < 0 ? s.length : j; continue; }
    // (a regular expression literal: copied as it is, so a quote in it opens no string)
    if(c === '/' && /[=(,:;!&|?{}\[\n]\s*$/.test(out.slice(-3) || '\n')){ let j = i + 1, cls = false; while(j < s.length && s[j] !== '\n'){ if(s[j] === '\\'){ j += 2; continue; } if(s[j] === '[') cls = true; else if(s[j] === ']') cls = false; else if(s[j] === '/' && !cls) break; j++; }
      out += s.slice(i, j + 1); i = j + 1; continue; }
    if(c === '\'' || c === '"' || c === '`') q = c;
    out += c; i++; }
  return out;
}
function readerImports(dir){
  const bad = [], files = fs.readdirSync(dir).filter(f => /\.(js|cjs|mjs)$/.test(f)).sort();
  for(const f of files){
    const code = stripComments(fs.readFileSync(path.join(dir, f), 'utf8'));
    const strs = [...code.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map(m => m[1] || m[2] || m[3] || '');
    for(const s of strs) for(const b of R2_BANNED) if(s.includes(b + '.js') || new RegExp('[\\\\/]' + b + '$').test(s)) bad.push(f + ': names ' + b + '.js (“' + s + '”)');
    // every require: a builtin, or a file of this folder by a literal path (./x.js, or path.join(__dirname, 'x.js'))
    for(const m of code.matchAll(/\brequire\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)){
      const a = m[1].trim(), lit = /^['"]([^'"]+)['"]$/.exec(a), joined = /^path\.join\(\s*__dirname\s*,\s*['"]([^'"\/]+)['"]\s*\)$/.exec(a);
      if(lit && BUILTIN.has(lit[1].replace(/^node:/, ''))) continue;
      const rel = lit && /^\.\/[^\/]+$/.test(lit[1]) ? lit[1].slice(2) : joined ? joined[1] : null;
      if(rel && fs.existsSync(path.join(dir, rel.endsWith('.js') ? rel : rel + '.js'))) continue;
      bad.push(f + ': requires ' + a + ' (only builtins and files of verify/reader2/)');
    }
    if(/\bimport\s*\(|^\s*import\s/m.test(code)) bad.push(f + ': an import statement');
    const ids = code.replace(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g, "''");
    if(/\b(boxes|BOXES)\b/.test(ids) || /\[\s*['"](boxes|BOXES)['"]\s*\]/.test(code)) bad.push(f + ': reads boxes (data.js BOXES)');
  }
  return { files, bad };
}
// Q: GW's text, as one string of words (Wahapedia's faction pages, its datasheets as text, GW's documents)
const sq = t => String(t).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&rsquo;|&#8217;|&lsquo;|&#8216;/g, "'").replace(/&amp;/g, '&')
  .replace(/&quot;|&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"').replace(/\*\*|~~/g, '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—−]/g, '-')
  .toLowerCase().replace(/[^a-z0-9+"']+/g, ' ').replace(/\s+/g, ' ').trim();
let CORPUS = null;
function corpus(){
  if(CORPUS !== null) return CORPUS;
  const parts = [];
  for(const d of ['waha', 'waha/ds', 'gw']){ let ns = []; try { ns = fs.readdirSync(path.join(CACHE, d)).sort(); } catch(e){}
    for(const n of ns) if(/\.(txt|html)$/.test(n) && !(d === 'waha' && /\.html$/.test(n))) parts.push(sq(fs.readFileSync(path.join(CACHE, d, n), 'utf8'))); }
  return (CORPUS = parts.join(' | '));
}
// a quote's pieces (GW's words between an ellipsis or an editor's [ … ]), each at least 12 characters
const pieces = q => String(q).split(/…|\.\.\.|\[[^\]]*\]/).map(sq).filter(x => x.length >= 12);
// S: what a verdict was reviewed against (the class-B pair's diffs, the app's entries, reader2's reading)
const fingerprint = p => crypto.createHash('sha256').update(JSON.stringify({ diffs:p.diffs || [], app:p.app || [], r2:p.r2 || null })).digest('hex').slice(0, 16);
const confirms = v => /^(app right|both right)/.test(v.verdict || '');

function compute(D){
  const readings = JSON.parse(fs.readFileSync(path.join(R2DIR, 'readings2.json'), 'utf8')).readings;
  const USES = uses(D), P = compare(align(D, readings), D, USES);
  const V = JSON.parse(fs.readFileSync(VERDICTS, 'utf8')).verdicts;
  const okB = new Set(Object.entries(V).filter(([, v]) => confirms(v) && (v.quotes || []).length).map(([k]) => k));
  const byBox = release(P, okB);
  return { P, V, okB, byBox, T:table(D, byBox) };
}
if(require.main === module){
  const arg = process.argv[2];
  const src = fs.readFileSync(DATA, 'utf8'), D = loadData(src);
  if(arg === '--write'){
    const { T } = compute(D);
    fs.writeFileSync(DATA, write(src, T));
    const n = Object.values(T.boxes).flatMap(r => Object.values(r).flat()).filter(x => x !== null);
    console.log('agree: wrote data.js AGREE (' + n.length + ' boxes: ' + n.filter(x => x === 'A').length + ' A, ' + n.filter(x => x === 'V').length + ' V, ' + n.filter(x => x === 'core').length + ' core, ' + n.filter(x => x === 0).length + ' fall back)');
    process.exit(0);
  }
  if(arg === '--bind'){
    const id = process.argv[3], { P } = compute(D), p = P.find(x => x.id === id && x.app);
    if(!p){ console.error('agree: no current pair ' + id); process.exit(1); }
    const F = JSON.parse(fs.readFileSync(VERDICTS, 'utf8')); if(!F.verdicts[id]){ console.error('agree: no verdict ' + id); process.exit(1); }
    F.verdicts[id].pair = fingerprint(p); fs.writeFileSync(VERDICTS, JSON.stringify(F, null, 1) + '\n'); console.log('agree: bound ' + id + ' to ' + F.verdicts[id].pair); process.exit(0);
  }
  const fails = [], note = [];
  // R1
  const imp = readerImports(R2DIR);
  if(!imp.files.length) fails.push('R1 verify/reader2/ has no code');
  imp.bad.forEach(b => fails.push('R1 ' + b));
  // R2
  const env = Object.assign({}, process.env, { KODEX_APP:ROOT, KODEX_CACHE:CACHE });
  for(const a of ['--test', '--check']){ const r = spawnSync(process.execPath, [path.join(R2DIR, 'reader2.js'), a], { cwd:R2DIR, env, encoding:'utf8' });
    const o = (r.stdout + r.stderr).trim();
    if(r.status !== 0) fails.push('R2 reader2.js ' + a + ' fails: ' + o.split('\n').slice(-3).join(' / '));
    else note.push('reader2 ' + a + ': ' + o.split('\n')[a === '--check' ? 0 : o.split('\n').length - 1].slice(0, 80)); }
  const { P, V, byBox, T } = compute(D);
  // T
  const have = (D.agree || {}).boxes || null, want = T.boxes;
  if(!have) fails.push('T data.js has no AGREE (node verify/agree.js --write)');
  else for(const k of [...new Set(Object.keys(have).concat(Object.keys(want)))].sort()){
    const a = JSON.stringify(have[k] || null), b = JSON.stringify(want[k] || null);
    if(a !== b) fails.push('T AGREE ' + k + ' (' + ((D.boxes[k] || {}).n || '?') + ') is ' + a + ', the comparison gives ' + b + ' (node verify/agree.js --write)');
  }
  // Q
  const C = corpus();
  for(const [id, v] of Object.entries(V)){
    if(!(v.quotes || []).length && confirms(v)) note.push('verdict without a GW quote (confirms nothing): ' + id);
    for(const q of v.quotes || []){ const ps = pieces(q);
      if(!ps.length) fails.push('Q ' + id + ': the quote “' + q + '” has no words to find');
      for(const x of ps) if(!C.includes(x)) fails.push('Q ' + id + ': GW’s text has no “' + x + '”'); }
  }
  // S
  const leads = {}; for(const p of P) if(p.app) leads[p.id] = p;
  for(const [id, v] of Object.entries(V)){ const p = leads[id];
    if(!p) fails.push('S stale verdict ' + id + ': no current pair');
    else if(p.cls !== 'B') fails.push('S stale verdict ' + id + ': the pair is class ' + p.cls + ' now, not B');
    else if(v.pair !== fingerprint(p)) fails.push('S stale verdict ' + id + ': the pair is not what was reviewed (fingerprint ' + fingerprint(p) + ', reviewed ' + v.pair + ')'); }
  // K: what AGREE (stored) marks confirmed, against the classes
  for(const [k, row] of Object.entries(have || {})) for(const [f, xs] of Object.entries(row)) xs.forEach((x, i) => { if(x !== 'A' && x !== 'V') return;
    const b = byBox[k + '|' + f + i];
    if(!b) fails.push('K AGREE ' + k + ' ' + f + i + ' is confirmed (' + x + '), but no pair of the comparison has it');
    else if(b.c === 'C' || b.c === 'B') fails.push('K AGREE ' + k + ' ' + f + i + ' (' + b.name + ') is confirmed (' + x + '), but it is class ' + b.c + ' without a verdict that confirms it');
    else if(x === 'A' && b.c !== 'A') fails.push('K AGREE ' + k + ' ' + f + i + ' (' + b.name + ') says A, but it is ' + b.c); });
  // the counts, per list
  const boxes = Object.values(byBox), lists = {};
  const fb = b => b.c === 'C' || b.c === 'B';
  for(const b of boxes) for(const l of b.lists){ const L = lists[l] = lists[l] || { boxes:0, number:0, fallsBack:0, fallsBackNumber:0, names:{} };
    L.boxes++; if(b.kind === 'number') L.number++;
    if(fb(b)){ L.fallsBack++; if(b.kind === 'number') L.fallsBackNumber++; const n = L.names[b.name] = L.names[b.name] || { boxes:0, number:0 }; n.boxes++; if(b.kind === 'number') n.number++; } }
  const tally = f => boxes.reduce((o, b) => { const k = f(b); o[k] = (o[k] || 0) + 1; return o; }, {});
  const core = Object.values(T.boxes).flatMap(r => Object.values(r).flat()).filter(x => x === 'core').length;
  const sum = { boxes:boxes.length, byClass:tally(b => b.c), fallsBack:boxes.filter(fb).length, fallsBackNumber:boxes.filter(b => fb(b) && b.kind === 'number').length, core,
    verdicts:Object.keys(V).length, confirmedByVerdict:boxes.filter(b => b.c === 'B-ok').length,
    lists:Object.fromEntries(Object.entries(lists).sort((a, b) => b[1].fallsBack - a[1].fallsBack || a[0].localeCompare(b[0]))),
    fallback:boxes.filter(fb).map(b => ({ box:b.key + '|' + b.field + b.i, name:b.name, cls:b.c, kind:b.kind, lists:[...b.lists].sort() })).sort((a, b) => a.name.localeCompare(b.name) || a.box.localeCompare(b.box)) };
  fs.mkdirSync(path.join(ROOT, 'verify/out'), { recursive:true });
  fs.writeFileSync(path.join(ROOT, 'verify/out/agree.json'), JSON.stringify(sum, null, 1) + '\n');
  if(process.argv.includes('--pairs')) fs.writeFileSync(path.join(ROOT, 'verify/out/agree-pairs.json'), JSON.stringify(P, null, 1) + '\n');
  const head = 'agree: ' + sum.boxes + ' boxes compared, ' + sum.fallsBack + ' fall back (' + sum.fallsBackNumber + ' change a number), ' + sum.confirmedByVerdict + ' confirmed by a verdict, ' + core + ' core';
  console.log((fails.length ? 'FAIL ' : '') + head + (fails.length ? '; ' + fails.length + ' problems' : ''));
  fails.forEach(f => console.log('  ' + f));
  note.forEach(n => console.log('  ' + n));
  for(const [l, L] of Object.entries(sum.lists)) console.log('  ' + l + ': ' + L.boxes + ' boxes (' + L.number + ' number), ' + L.fallsBack + ' fall back (' + L.fallsBackNumber + ' number)' +
    (L.fallsBack ? ': ' + Object.entries(L.names).map(([n, x]) => n + ' ' + x.number + '/' + x.boxes).join(', ') : ''));
  process.exit(fails.length ? 1 : 0);
}
module.exports = { loadData, sources, uses, align, compare, release, table, write, readerImports, fingerprint, pieces, START, END };
