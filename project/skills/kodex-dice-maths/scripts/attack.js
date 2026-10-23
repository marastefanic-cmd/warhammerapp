#!/usr/bin/env node
// attack.js: the Kunnin' Kodex damage engine (calc.js, the same file the app's Damage tab uses) from the command line.
// Usage: node attack.js input.json   (or: echo '{...}' | node attack.js -)
// Input: calc.js's run() input (see the comment at the top of calc.js), e.g.
// { "groups":[{ "name":"Bolt rifle", "n":10, "A":"2", "skill":"3+", "S":"4", "AP":"-1", "D":"1", "range":"24\"", "kw":["Assault","Heavy"],
//               "mods":[{ "from":"Oath of Moment", "rrHit":"all" }] }],
//   "target":{ "T":4, "kw":["Infantry"], "models":[{ "name":"Boyz", "count":10, "W":1, "T":4, "Sv":"5+" }] },
//   "ctx":{ "ranged":true, "cover":false }, "sims":20000 }
// Prints the averages (hits, wounds, unsaved, damage, models destroyed), the chance of destroying the whole unit,
// the chance of destroying at least k models, and the exact step-by-step averages (explain).
'use strict';
const fs = require('fs'), path = require('path');
const C = require(path.join(__dirname, 'calc.js'));
const src = process.argv[2] && process.argv[2] !== '-' ? fs.readFileSync(process.argv[2], 'utf8') : fs.readFileSync(0, 'utf8');
const input = JSON.parse(src);
input.sims = input.sims || 20000;
// numbers as the engine wants them: "5+" → 5, "-1" → -1, "–"/"-" (no save) → 7 for Sv / none for InSv and FNP
const num = v => typeof v === 'string' && /^[+-]?\d+\+?$/.test(v.trim()) ? parseInt(v, 10) : v;
const none = v => typeof v === 'string' && /^[-–—]$/.test(v.trim());
for(const g of input.groups || []){ for(const k of ['S', 'AP']) if(g[k] !== undefined) g[k] = num(g[k]); if(typeof g.skill === 'number') g.skill = g.skill + '+'; }
const t = input.target || {}; if(t.T !== undefined) t.T = num(t.T);
for(const m of t.models || []){
  for(const k of ['W', 'T']) if(m[k] !== undefined) m[k] = num(m[k]);
  if(m.Sv !== undefined) m.Sv = none(m.Sv) ? 7 : num(m.Sv);
  for(const k of ['InSv', 'fnp', 'fnpMortal']) if(m[k] !== undefined){ if(none(m[k])) delete m[k]; else m[k] = num(m[k]); }
}
if(!input.seed) input.seed = 1;
// keywords the engine does not count (misspelt, a number missing, or one that changes no numbers): said, never silently dropped
const counted = x => { const k = C.keywords([x]); return k.anti.length > 0 || Object.keys(k).some(key => !['anti', 'dup', 'src', 'text'].includes(key) && k[key]); };
const ignored = [...new Set((input.groups || []).flatMap(g => (g.kw || []).filter(x => typeof x === 'string' && !counted(x.replace(/^.*?:\s*/, '')))))];
const r = C.run(input);
const f = x => Math.round(x * 100) / 100, pc = x => Math.round(x * 1000) / 10 + '%';
const out = [];
out.push('Games played: ' + r.sims);
r.groups.forEach((g, i) => out.push(`- ${(input.groups[i] || {}).name || 'weapon'}: ${f(g.attacks)} attacks → ${f(g.hits)} hits → ${f(g.wounds)} wounds → ${f(g.unsaved)} unsaved` + (g.mortals ? ` + ${f(g.mortals)} mortal wounds` : '') + ` → ${f(g.dmg)} damage` + (g.notes && g.notes.length ? ' (' + g.notes.join('; ') + ')' : '')));
out.push(`Total: ${f(r.dmg)} wounds lost on average, ${f(r.killed)} of ${r.models} models destroyed on average, whole unit destroyed ${pc(r.wipe)} of the time.`);
let atLeast = 1; const cum = []; for(let k = r.dist.length - 1, s = 0; k >= 0; k--){ s += r.dist[k]; cum[k] = s; }
out.push('Chance of destroying at least k models: ' + cum.map((p, k) => k ? k + ': ' + pc(p) : null).filter(Boolean).join(', '));
try { const e = C.explain(input); if(e) out.push('Working (exact averages before allocation):\n' + JSON.stringify(e, null, 1)); } catch(err){ out.push('(no working: ' + err.message + ')'); }
if(ignored.length) out.unshift('Keywords not counted by the engine (check the spelling, or they change no numbers): ' + ignored.join(', '));
console.log(out.join('\n'));
