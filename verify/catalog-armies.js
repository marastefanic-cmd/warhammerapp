/* verify/catalog-armies.js: what a phone import of a faction whose catalogue is read (its AI layers written: the catalogue file's aiRead,
   docs/catalog.md) can place, as lists the gate checks like the owner's: for each detachment of the faction, one list with every datasheet
   of the faction once (GW's default wargear: its rows as DATASHEETS has them), each ability a rule of that detachment gives its units
   (builder.js ruleAbilities, as an import gets them), and each enhancement of the detachment on a CHARACTER its words allow. These lists are
   no part of the app (data.js ARMIES): verify/effects-migrate.js reads their sources into BOXES, verify/lines.js holds their placed lines
   to their summaries, as for the owner's lists, so an imported unit's sheet is complete.
     const CA = require('./catalog-armies'); CA.armies(D) → resolved lists (ids "catalog:<faction>:<detachment>")
     CA.add(D) → D.armies with them appended (in place), for a script whose app reads D.armies */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const B = require('../builder.js');

function readFactions() {
  const dir = path.join(ROOT, 'verify/sources/catalog');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).filter(c => c.aiRead).map(c => c.faction);
}
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// an enhancement's own restriction, its first sentence ("**WORLD EATERS MONSTER** model only."): the keywords it names, against the unit's
function allows(e, kw) {
  const lead = (/^(.*?\bonly\b[^.]*)\./.exec(String(e.text || '')) || [])[1]; if (!lead) return true;
  const K = kw.map(k => String(k).replace(/^Faction: /i, '').toUpperCase());
  const alts = (lead.replace(/\(excluding[^)]*\)/g, '').match(/\*\*[^*]+\*\*/g) || []).map(x => x.replace(/\*\*/g, ''));
  const has = ph => { const W = ph.toUpperCase().split(/\s+/); const can = i => i === W.length || K.some(k => { const kw2 = k.split(' '); return kw2.every((x, j) => W[i + j] === x) && can(i + kw2.length); }); return can(0); };
  if (alts.length && !alts.some(has)) return false;
  for (const m of lead.matchAll(/\(excluding ([^)]*)\)/g)) for (const x of (m[1].match(/\*\*[^*]+\*\*/g) || []).map(y => y.replace(/\*\*/g, ''))) if (has(x.replace(/S$/, ''))) return false;
  return true;
}
function armies(D) {
  const out = [];
  for (const fk of readFactions()) {
    const F = (D.factions || {})[fk]; if (!F) continue;
    const keys = Object.keys(D.datasheets || {}).filter(k => D.datasheets[k].faction === fk && D.datasheets[k].points).sort();
    for (const [dk, det] of Object.entries(F.detachments || {})) {
      const RA = B.ruleAbilities(D.grants, D.ruleOptions, F, [det], D);
      const unit = (k, extra, enh) => { const S = D.datasheets[k], own = (S.abilities || []).filter(a => !/^(Leader|Support)$/.test(a.name));
        // (with the keywords its enhancement gives it, as builder.js gives an import: Murder-Forged Entity's DAEMON)
        const ek = enh ? B.enhKeywords(enh).map(x => x.k) : [];
        const granted = B.ruleAbilitiesOf(RA, (S.kw || []).concat(ek), own, S.rules || []).map(x => x.row);
        const models = (S.composition || []).filter(c => c.min > 0 || (c.groupMin && c === (S.composition || []).find(x => x.group === c.group))).map(c => (c.min || c.groupMin) + '× ' + c.model);
        // (why an ability does nothing here, as builder.js's na gives it an import: alone, leading no unit, with GW's default wargear)
        const wn = [].concat(S.ranged || [], S.melee || []).flatMap(w => [w.name, w.group]).filter(Boolean).map(x => String(x).toLowerCase());
        const allKw = keys.flatMap(k2 => D.datasheets[k2].kw || []);
        const abs = own.map(a => { const o = { name:a.name }, na = B.naOf(a.text, false, wn, allKw); if(na) o.na = na; return o; });
        return Object.assign({ id:slug(S.name), ds:k, pts:0, models:models.length ? models : ['1× ' + S.name], gear:[], abilities:abs.concat(granted) },
          ek.length ? { kw:(S.kw || []).filter(x => !/^Faction: /.test(x)).concat(ek.filter(x => !(S.kw || []).includes(x)), (S.kw || []).filter(x => /^Faction: /.test(x))) } : {}, extra || {}); };
      const units = keys.map(k => unit(k));
      // each enhancement on the first CHARACTER (not EPIC HERO) its words allow
      for (const e of det.enhancements || []) {
        const k = keys.find(k0 => { const kw = D.datasheets[k0].kw || []; return kw.includes('Character') && !kw.includes('Epic Hero') && allows(e, kw); }) || keys.find(k0 => allows(e, D.datasheets[k0].kw || []));
        if (!k) continue;
        const u = unit(k, { id:slug(D.datasheets[k].name) + '-' + slug(e.name) }, e);
        if (e.upgrade) u.upgrade = e.name; else u.enhancement = e.name;
        u.abilities = u.abilities.concat({ name:e.name, tag:(e.upgrade ? 'Upgrade' : 'Enhancement'), text:e.text });
        units.push(u);
      }
      const a = D.resolve({ id:'catalog:' + fk + ':' + dk, name:'Catalogue ' + F.name + ' · ' + det.name, faction:fk, points:2000, pointsUsed:0, battleSize:'Strike Force',
        disposition:(det.dispositions || [])[0], detachments:[dk], source:'verify/catalog-armies.js', units });
      a.catalog = true;
      out.push(a);
    }
  }
  return out;
}
function add(D) { if (!D.armies.some(a => a.catalog)) D.armies.push(...armies(D)); return D.armies; }
module.exports = { armies, add, readFactions };
