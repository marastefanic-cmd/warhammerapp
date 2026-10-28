// Mechanical rules every army must satisfy. Each catches a class of mistake once and for all,
// instead of hoping a reviewer notices it:
// - a stratagem is listed in exactly the phases and turn its WHEN names
// - a stratagem is offered to exactly the units its TARGET's keywords describe
// - an ability whose text names a phase ("In your Command phase") is in that phase's list
// - a Damaged band says the wound range the ability's name says
// - every number in a footnote or "When targeted" line is in the text it cites
// - a weapon carried by several models says how many (×N) and the count adds up
// - in an attached unit, every weapon belongs to the leader or the bodyguard
// An exception needs an entry in verify/allow-invariants.json: { check, where, reason }.
const path = require('path');
const { ROOT, loadData, readJSON, writeJSON } = require('./lib');
const detRules_ = d => d && d.rule ? [d.rule].concat(d.moreRules || []) : [];   // a detachment's rules: rule, then moreRules (Blood Legion's Blood Tainted)

const PH = ['command', 'movement', 'shooting', 'charge', 'fight'];
const plain = s => String(s || '').replace(/\*\*|~~/g, '').replace(/[’‘]/g, '\'').toLowerCase();

// "Your Movement/Charge phase", "Your opponent's Shooting phase", "the Fight phase" -> { phase: owner }
function phasesNamed(text){
  const t = plain(text), out = {};
  if(/^(?:(?:start|end) of )?any phase/.test(t)) { PH.forEach(p => out[p] = 'either'); return out; }   // "End of any phase" (Profane Symbiosis) too
  const SEP = '(?:\\s*[\\/,]\\s*|\\s+or\\s+(?:the\\s+)?|\\s+and\\s+(?:the\\s+)?)';
  const re = new RegExp("(your opponent's |your |the |either player's )?((?:command|movement|shooting|charge|fight)(?:" + SEP + "(?:command|movement|shooting|charge|fight))*) phase", 'g');
  for(let m; (m = re.exec(t));){
    const owner = /opponent/.test(m[1] || '') ? 'opp' : /^your /.test(m[1] || '') ? 'your' : 'either';
    for(const p of m[2].split(new RegExp(SEP))) out[p] = out[p] && out[p] !== owner ? 'either' : owner;
  }
  return out;
}
const effTurn = (x, p) => (x.turns && x.turns[p]) || x.turn || 'either';

function run(D){
  const fails = [];
  const F = (check, where, detail) => fails.push({ check, where, detail });
  const armies = D.armies;

  // ---- stratagems: phases and turn from WHEN; eligible units from TARGET ----
  const stratsOf = a => a.detachments.flatMap(id => (D.factions[a.faction].detachments[id] || {}).stratagems || []);
  const seenStrat = new Set();
  for(const a of armies) for(const s of stratsOf(a).concat(D.coreStratagems)){
    if(seenStrat.has(a.id + s.id)) continue; seenStrat.add(a.id + s.id);
    const named = phasesNamed(s.when.split(/[.:]/)[0]);
    const where = a.id + ' · ' + s.name;
    if(!Object.keys(named).length) F('strat-when', where, 'WHEN names no phase: "' + s.when + '"');
    else {
      const want = Object.keys(named).sort().join(','), have = s.phases.slice().sort().join(',');
      if(want !== have) F('strat-phases', where, 'WHEN says ' + want + ', listed in ' + have);
      for(const p of s.phases) if(named[p] && named[p] !== effTurn(s, p)) F('strat-turn', where, p + ': WHEN says ' + named[p] + ', listed as ' + effTurn(s, p));
    }
    // keywords: every keyword in needs is in the TARGET or WHEN; every unit keyword in TARGET is in needs
    const n = s.needs || {};
    const needKws = x => !x ? [] : [].concat(x.all || [], x.any || [], x.none || [], needKws(x.unless));
    // (and the keywords its needs name, which no unit of the list may have: TRIARCH PRAETORIANS, so its TRIARCH is not read alone)
    const kws = new Set(a.units.flatMap(u => u.kw).concat(needKws(n)).filter(k => !/^Faction:/.test(k)).map(k => k.toUpperCase()));
    const boldOf = t => [...t.matchAll(/\*\*([^*]+)\*\*/g)].map(m => m[1].toUpperCase().replace(/~~/g, '')).join(' | ');
    // (a TARGET's "that **ORKS INFANTRY** unit" is the unit its WHEN names, not the target: Grot Shields' "One friendly **GRETCHIN** unit
    // within 3" of that **ORKS INFANTRY** unit", the unit being shot; its keywords are not the target's)
    const whenB = boldOf(s.when).split(' | '), tgt = String(s.target).replace(/\bthat \*\*([^*]+)\*\*/g, (m, k) => whenB.some(w => w.includes(k.toUpperCase())) ? 'that #' : m);
    const bold = boldOf(s.target + ' ' + s.when), boldTarget = boldOf(tgt);   // WHEN may name the enemy's keywords
    for(const k of needKws(n)){
      const word = k.replace(/^Faction: /, '').toUpperCase();
      if(!bold.includes(word) && !plain(s.target + ' ' + s.when).includes(word.toLowerCase())) F('strat-needs', where, 'needs ' + k + ' but TARGET/WHEN does not name it');
    }
    // keywords named in the TARGET, longest first: a keyword inside a longer one that is named ("TERMINATOR" in
    // TERMINATOR SQUAD) is not named by itself; a keyword every unit of the army has ("KHORNE" in KHORNE
    // BERZERKERS, in a World Eaters list) selects nothing, so needs does not have to use it
    const every = new Set([...kws].filter(k => a.units.every(u => u.kw.some(x => x.toUpperCase() === k))));
    let left = boldTarget;
    const named2 = [...kws].sort((x, y) => y.length - x.length).filter(k => {
      const re = new RegExp('(^|[^A-Z])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[^A-Z]|$)', 'g');
      if(!re.test(left)) return false;
      left = left.replace(re, '$1#');
      return !every.has(k);
    });
    for(const k of named2) if(!needKws(n).some(x => x.toUpperCase() === k)) F('strat-needs', where, 'TARGET names ' + k + ' but needs does not use it');
    // "a friendly attached … unit" (Breakin' Heads): only units with a character attached
    if(/\battached\b/.test(plain(s.when + ' ' + s.target)) !== !!n.attached) F('strat-needs', where, n.attached ? 'needs attached but WHEN/TARGET does not say attached' : 'WHEN/TARGET says attached but needs does not');
  }

  // ---- rules and abilities: a phase named in the text is a phase it is listed in ----
  for(const a of armies){
    for(const u of a.units) for(const ab of u.abilities){
      const t = plain(ab.text);
      const trig = /\b(in|at the start of|at the end of|during|until the end of) (your|your opponent's|the|either player's|each|any) (command|movement|shooting|charge|fight) phase/.exec(t)
        || /^(once per [a-z ]+, )?(in|at the start of|at the end of) (your|your opponent's|the|either player's) (command|movement|shooting|charge|fight) phase/.exec(t);
      const startRound = /start of the (first )?battle round/.test(t);
      if((trig || startRound) && !(ab.ph || []).length) F('ability-phase', a.id + ' · ' + u.name + ' · ' + ab.name, 'the text names a phase but the ability is in no phase list');
      // Damaged band: the range in its name
      if(ab.damaged){
        const m = /(\d+)\s*-\s*(\d+)/.exec(ab.name);
        if(!m || ab.damaged !== m[1] + '-' + m[2]) F('damaged-range', a.id + ' · ' + u.name, 'name says ' + ab.name + ', band says ' + ab.damaged);
      }
    }
  }

  // ---- numbers in the app's own sentences come from the text they cite ----
  // (a Core Rules section cited, "01.02.04", is not a number taken from the rule's own text)
  const nums = s => (String(s || '').replace(/\{[^}]*\}/g, '').replace(/\b\d{2}\.\d{2}(?:\.\d{2})*\b/g, '').match(/\d+/g) || []);
  const has = (src, n) => new RegExp('(^|[^0-9])' + n + '([^0-9]|$)').test(src);
  const ruleText = (a, name) => {
    const f = D.factions[a.faction];
    const ar = f.armyRules.find(r => r.name === name);
    if(ar) return ar.text + JSON.stringify(ar.table || '');
    for(const id of a.detachments){ for(const r of detRules_(f.detachments[id])) if(r.name === name) return r.text + JSON.stringify(r.table || ''); }
    if(D.rules[name]) return D.rules[name];
    // a core rule with its value in its name on the Rules line ("Damaged 5"): the glossary entry its alias names, and the name, whose
    // number is the X of "Damaged X"
    const k = (D.ruleAliases.find(([re]) => re.test(name)) || [])[1];
    return k && D.rules[k] && /\d/.test(name) ? name + ': ' + D.rules[k] : '';
  };
  for(const a of armies){
    const strats = stratsOf(a).concat(D.coreStratagems);
    for(const u of a.units){
      const src = m => { const ab = u.abilities.find(x => x.name === m.from); if(ab) return ab.text; const s = strats.find(x => x.name === m.from); if(s) return s.when + s.target + s.effect; return ruleText(a, m.rule || m.from); };
      for(const m of [...(u.mods || []), ...(u.aura || [])]){
        const text = src(m), say = [m.when, m.note, m.selfWhen].join(' ');
        for(const n of nums(say)) if(!has(text, n) && !has(JSON.stringify(m.set || ''), n)) F('number-cited', a.id + ' · ' + u.name + ' · ' + m.from, '"' + n + '" in "' + say + '" is not in the text it cites');
      }
      // (or in a faction's own term its text names in bold, D.ruleSrc: the Pulse Jet's "pulse jet move", whose AFTER MOVING has the -1)
      const named = t => [...String(t).matchAll(/\*\*([^*]+)\*\*/g)].map(m => { const k = (D.ruleAliases.find(([re]) => re.test(m[1])) || [])[1]; return k && (D.ruleSrc || {})[k] ? D.rules[k] || '' : ''; }).join(' ');
      for(const ab of u.abilities) if(ab.def) for(const n of nums(ab.def)) if(!has(ab.text, n) && !has(named(ab.text), n)) F('number-cited', a.id + ' · ' + u.name + ' · ' + ab.name, '"' + n + '" in "' + ab.def + '" is not in its text');
    }
    for(const s of strats) for(const k of ['def']) if(s[k]) for(const n of nums(s[k])) if(!has(s.when + s.target + s.effect, n)) F('number-cited', a.id + ' · ' + s.name, '"' + n + '" in "' + s[k] + '" is not in its text');
    // the line a stratagem gives the units it protects (Grot Shields' shield.def)
    for(const s of strats) if(s.shield && s.shield.def) for(const n of nums(s.shield.def)) if(!has(s.when + s.target + s.effect, n)) F('number-cited', a.id + ' · ' + s.name + ' (shield)', '"' + n + '" in "' + s.shield.def + '" is not in its text');
    const f = D.factions[a.faction];
    const rules = f.armyRules.concat(a.detachments.flatMap(id => detRules_(f.detachments[id])));
    for(const r of rules){
      const text = r.text + JSON.stringify(r.table || '');
      for(const k of ['def']) if(r[k]) for(const n of nums(r[k])) if(!has(text, n)) F('number-cited', a.id + ' · ' + r.name, '"' + n + '" in "' + r[k] + '" is not in its text');
      if(r.mod) for(const n of nums([r.mod.when, r.mod.note].join(' '))) if(!has(text, n)) F('number-cited', a.id + ' · ' + r.name, '"' + n + '" in its footnote is not in its text');
    }
  }

  // ---- weapons: counts add up; attached units split by model ----
  for(const a of armies) for(const u of a.units){
    const count = m => parseInt(m, 10) || 1;
    const lines = u.models.map((m, i) => ({ n:count(m), name:m.replace(/^\d+× /, ''), gear:(u.gear || [])[i] || [] }));
    const total = lines.reduce((t, l) => t + l.n, 0);
    const seen = new Set();
    // in an attached unit, the first models lines are the characters' (the unit's own name, then `also`), the rest the bodyguard's
    const chars = u.leads ? [u.name].concat((u.also || []).map(c => c.name)) : [];
    // a character part of several models (the Wardens of Ultramar): its models lines are those whose weapons are all that part's
    const weapons = [...(u.ranged || []), ...(u.melee || [])];
    // (a line whose weapons several parts have is the part of the line before it, when that part has them: lines are in the parts' order)
    const lineWhos = []; { let cur = null; for(const l of lines){
      let ws = null;   // the parts that have every weapon of the line
      for(const g of l.gear){ const s = new Set(weapons.filter(x => (x.group || x.name) === g && x.who).map(x => x.who)); if(s.size) ws = ws ? new Set([...ws].filter(x => s.has(x))) : s; }
      if(ws && ws.size === 1) cur = [...ws][0]; else if(ws && ws.size && !ws.has(cur)) cur = null;
      lineWhos.push(ws && ws.size ? cur : null); } }
    const lineWho = l => lineWhos[lines.indexOf(l)];
    const multiChar = new Set(chars.filter(c => c !== u.name && lines.filter(l => lineWho(l) === c).length > 1));
    // (the leader's own part of several models, the Dark Apostle and his Dark Disciples: its first lines, while their weapons are its)
    let lead = 1; if(u.leads) while(lead < lines.length - 1 && lineWho(lines[lead]) === u.name) lead++;
    if(lead > 1) multiChar.add(u.name);
    const body = lines.slice(Math.max(chars.length + lead - 1, 1)).filter(l => !multiChar.has(lineWho(l)));
    const charLine = w => u.leads && w.who && w.who !== u.leads && body.every(l => l.name.replace(/ w\/.*$/, '') !== w.who) ? Math.max(chars.indexOf(w.who) + (chars.indexOf(w.who) > 0 ? lead - 1 : 0), 0) : -1;
    for(const w of [...(u.ranged || []), ...(u.melee || [])]){
      const g = w.group || w.name; if(seen.has(g + '|' + w.who)) continue; seen.add(g + '|' + w.who);
      const mine = !u.leads ? lines : multiChar.has(w.who) ? lines.filter(l => lineWho(l) === w.who) : charLine(w) >= 0 ? [lines[charLine(w)]] : body;
      // a gear line that names a weapon twice (the Two-Busta Tankbusta) is two of it per model
      const carriers = mine.reduce((t, l) => t + l.n * l.gear.filter(x => x === g).length, 0);
      if(total > 1 && carriers > 1 && +w.n !== carriers) F('weapon-count', a.id + ' · ' + u.name + ' · ' + g, carriers + ' carried by its models, the app says ×' + (w.n || 1));
      if(total > 1 && carriers === 1 && w.n && +w.n !== 1) F('weapon-count', a.id + ' · ' + u.name + ' · ' + g, 'one model carries it, the app says ×' + w.n);
    }
    if(u.leads){
      const ok = new Set([...chars, u.short, u.leads, ...lines.map(l => l.name.replace(/ w\/.*$/, ''))].filter(Boolean));
      for(const w of [...(u.ranged || []), ...(u.melee || [])]) if(!w.who || !ok.has(w.who)) F('weapon-owner', a.id + ' · ' + u.name + ' · ' + (w.group || w.name), 'belongs to "' + (w.who || '?') + '", not a character or the bodyguard');
    }
  }
  return fails;
}

if(require.main === module){
  const D = loadData();
  const allow = readJSON(path.join(ROOT, 'verify/allow-invariants.json'), []);
  const all = run(D), used = new Set();
  const failures = all.filter(f => { const i = allow.findIndex(x => x.check === f.check && x.where === f.where); if(i >= 0){ used.add(i); return false; } return true; });
  const stale = allow.map((x, i) => i).filter(i => !used.has(i)).map(i => ({ check:'stale-allow', where:allow[i].where, detail:'allowed exception no longer happens: ' + allow[i].check }));
  const out = failures.concat(stale);
  writeJSON(path.join(ROOT, 'verify/out/invariants.json'), { checked:'stratagem phases/turn/needs, ability phases, damaged ranges, cited numbers, weapon counts and owners', allowed:used.size, failures:out });
  console.log('invariants: ' + out.length + ' failures (' + used.size + ' allowed exceptions)');
  for(const f of out) console.log('  ' + f.check + ' · ' + f.where + ' · ' + f.detail);
  process.exit(out.length ? 1 : 0);
}
module.exports = { run, phasesNamed };
