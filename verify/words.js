// The gate step words: every datasheet ability text a unit screen shows is GW's datasheet's, word for word, as Wahapedia transcribes it
// (verify/.cache/waha/ds), read by the shared page reader (verify/gw-order.js: wahaSectionsOf on the datasheet cut out of its page,
// pageAbility). Every DATASHEETS row's abilities (a faction catalogue's too) and every list unit's, resolved as the app gets them:
// datasheet, wargear, box and Damaged abilities; an enhancement's or upgrade's ability is the list's own (verify/texts.js checks it against
// its detachment); an invulnerable save is a box (verify/numbers.js reads INSV).
//   text     equal to the page's after markup normalisation (gw-order.js norm: bold and other markers, "- " bullets, an *italic* line, line
//            breaks, curly vs straight quotes, odd spaces, whitespace)
//   Leader   a Leader / Support line: the units it names, as a list, equal to the page's LEADER / SUPPORT box's
//   name     GW's spelling where the page spells it otherwise (gw-order.js gwName: Berzerker Frenzy); verify/tables.js --write writes it
// Anything else fails, unless verify/deviations-words.json declares it:
//   { page, ability, app, waha, reason, evidence, gw?: { file, quote }, status? }
//   page: the Wahapedia page file ('(no page)' for a datasheet with none); app / waha: the two texts (compared normalised: a changed text on
//   either side unmatches it); waha '(none)' for an ability the page does not print; Leader: app the app's line, waha the page's units
//   joined with ', '. gw: GW's own document the app follows over the page (a Faction Pack's rewrite, an FAQ): its quote must be in
//   verify/.cache/gw/<file>. reason and evidence are required; a declaration nothing matches fails (stale); status 'pending' is listed on
//   every run, not passed in silence.
// verify/tables.js --write writes every text and name so (gw-order.js gwWords); this step checks what data.js holds.
//   node verify/words.js      writes verify/out/words.json
'use strict';
const fs = require('fs'), path = require('path');
const { ROOT, loadData, writeJSON } = require('./lib');
const O = require('./gw-order')(ROOT);
const D = loadData();
const DEVS = O.DEVW, N = O.norm;
const fails = [], pending = [], used = new Set(), seen = new Set();
const counts = { texts:0, equal:0, leaders:0, declared:0, names:0 };
const where = (list, unit) => list + '/' + unit;
function differ(x){
  const k = [x.page, x.ability, N(x.app), N(x.waha)].join('\0'); if(seen.has(k)) return; seen.add(k);
  const i = DEVS.findIndex(d => d.page === x.page && d.ability === x.ability && N(d.app) === N(x.app) && N(d.waha) === N(x.waha));
  if(i < 0){ fails.push(x); return; }
  used.add(i); counts.declared++;
  if(DEVS[i].status === 'pending') pending.push(Object.assign({ pending:DEVS[i].reason }, x));
}
function check(faction, u, ab, list, unit){
  if(/\b(Enhancement|Upgrade)\b/.test(ab.tag || '') || /^\*?invulnerable save\b/i.test(ab.name)) return;
  counts.texts++;
  const P = O.abilityPage(faction, u, ab), at = where(list, unit);
  if(!P) return differ({ page:'(no page)', ability:ab.name, app:ab.text, waha:'(none)', where:at });
  const pa = O.pageAbility(P, ab);
  if(!pa) return differ({ page:P.file, ability:ab.name, app:ab.text, waha:'(none)', where:at });
  if(pa.kind === 'leader'){
    counts.leaders++;
    const want = O.leaderList(ab.text), got = pa.list.map(x => N(x).toLowerCase()).sort();
    if(want && want.map(x => N(x).toLowerCase()).join('|') === got.join('|')){ counts.equal++; return; }
    return differ({ page:P.file, ability:ab.name, app:ab.text, waha:pa.list.join(', '), where:at });
  }
  const gn = O.gwName(ab, pa);
  if(gn){ counts.names++; const k = 'name\0' + P.file + '\0' + ab.name; if(!seen.has(k)){ seen.add(k); fails.push({ page:P.file, ability:ab.name, where:at, why:'GW names it ' + gn + ' (node verify/tables.js --write writes GW\'s name)' }); } }
  if(N(ab.text) === N(pa.g.text)){ counts.equal++; return; }
  differ({ page:P.file, ability:ab.name, app:ab.text, waha:pa.g.text, where:at });
}
let sheets = 0, units = 0;
for(const [id, s] of Object.entries(D.datasheets || {})){ sheets++; for(const ab of s.abilities || []) check(s.faction, s, ab, 'DATASHEETS', id); }
for(const a of D.armies) for(const u of a.units){ units++; for(const ab of u.abilities || []) check(a.faction, u, ab, a.id, u.id); }
// a declaration: its reason and evidence; GW's quote in its document (verify/.cache/gw, whitespace, quotes and bullets normalised)
const GW = path.join(ROOT, 'verify/.cache/gw'), sp = t => String(t).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[▪■]/g, ' ').replace(/\s+/g, ' ');
const gwText = new Map(), gwOf = f => { if(!gwText.has(f)) gwText.set(f, fs.existsSync(path.join(GW, f)) ? sp(fs.readFileSync(path.join(GW, f), 'utf8')) : null); return gwText.get(f); };
DEVS.forEach((d, i) => {
  const tag = 'verify/deviations-words.json #' + i + ' (' + d.page + ' · ' + d.ability + ')';
  if(!d.reason || !d.evidence) fails.push({ page:d.page, ability:d.ability, why:tag + ': no reason or evidence' });
  if(d.gw){ const t = gwOf(d.gw.file); if(t === null || !t.includes(sp(d.gw.quote))) fails.push({ page:d.page, ability:d.ability, why:tag + ': its GW quote is not in verify/.cache/gw/' + d.gw.file }); }
  if(!used.has(i)) fails.push({ stale:true, page:d.page, ability:d.ability, why:tag + ': nothing matches it' });
});
writeJSON(path.join(ROOT, 'verify/out/words.json'), { counts, sheets, units, declared:used.size, pending, fails });
console.log('words: ' + (fails.length ? fails.length + ' failure(s); ' : '') + counts.texts + ' ability texts of ' + sheets + ' datasheets and ' + units + ' list units checked against their Wahapedia datasheet pages: ' + counts.equal + ' equal (' + counts.leaders + ' Leader lines as unit lists); ' + used.size + ' declared differences (verify/deviations-words.json)' + (pending.length ? '; ' + pending.length + ' PENDING (declared, not decided): ' + pending.map(x => x.page + ' ' + x.ability).join(', ') : ''));
for(const f of fails) console.log('  FAIL ' + (f.stale ? 'stale ' : '') + (f.why ? f.why : f.page + ' · ' + f.ability + ' (' + f.where + ')\n       app:  ' + N(f.app) + '\n       page: ' + N(f.waha)));
for(const x of pending) console.log('  PENDING ' + x.page + ' · ' + x.ability + ': ' + x.pending);
process.exit(fails.length ? 1 : 0);
