/* verify/catalog-write.js: what `node verify/from-bsdata.js <faction> --write` writes (docs/catalog.md)
     verify/sources/catalog/<faction>.json   the catalogue rows (DATASHEETS rows, one per current datasheet) and what was left out
     data.js FACTIONS                        each detachment data.js lacks: its rule(s), enhancements and stratagems in GW's words
                                             (Wahapedia, the codex), Force Dispositions from BSData, the labels verify/derive.js
                                             gives (phases, turn, needs), aiStatus 'not-read' (no gists, readings or When targeted
                                             lines yet); one data.js already has is left as it is
     verify/deviations-bsdata.json           each difference between a catalogue row and BSData at the pin (GW's value, with the
                                             datasheet as evidence), as verify/from-json.js declares a list's; army "catalog"
   then verify/tables.js --write (every catalogue row into DATASHEETS). Rerunning it gives the same files. */
'use strict';
const fs = require('fs'), path = require('path');
const { spawnSync } = require('child_process');
const { lit } = require('./waha-words').writer;

module.exports = function write(ROOT, faction, r, SRC) {
  const DATA = path.join(ROOT, 'data.js');
  const loadD = () => { global.window = {}; delete require.cache[DATA]; require(DATA); return window.WH_DATA; };
  const node = args => spawnSync(process.execPath, args.map((x, i) => i ? x : path.join(ROOT, x)), { cwd: ROOT, encoding: 'utf8' });
  // 1. the catalogue rows
  fs.mkdirSync(path.dirname(SRC), { recursive: true });
  fs.writeFileSync(SRC, JSON.stringify(r.cat, null, 1) + '\n');
  // 2. the detachments the catalogue adds: an earlier run's (aiStatus 'not-read') taken out, this run's written
  const dets = Object.entries(r.cat.detachmentRows || {});
  {
    let d = fs.readFileSync(DATA, 'utf8');
    const mark = '      // ', tail = ': Wahapedia (the codex), from the catalogue (verify/from-bsdata.js ' + faction + ')';
    for (;;) {
      const i = d.indexOf(tail); if (i < 0) break;
      const s0 = d.lastIndexOf('\n' + mark, i), e0 = d.indexOf('\n      }', i) + '\n      }'.length;
      // (with the comma before it)
      const c = d.lastIndexOf(',', s0); d = d.slice(0, c) + d.slice(e0);
    }
    fs.writeFileSync(DATA, d);
  }
  if (dets.length) {
    const I = '    ';
    const block = (id, d) => {
      let s = I + '  // ' + d.name + ': Wahapedia (the codex), from the catalogue (verify/from-bsdata.js ' + faction + '); no gists, readings or When targeted lines yet (aiStatus)\n';
      s += I + "  '" + id + "': {\n" + I + '    name:' + lit(d.name) + (d.nr ? ', nr:' + lit(d.nr) : '') + ', dispositions:' + lit(d.dispositions || []) + ', dp:' + d.dp + ", aiStatus:'not-read',\n";
      s += I + '    rule:' + lit(d.rule) + ',\n';
      if (d.moreRules) s += I + '    moreRules:[\n' + d.moreRules.map(x => I + '      ' + lit(x)).join(',\n') + '\n' + I + '    ],\n';
      s += I + '    enhancements:[\n' + d.enhancements.map(e => I + '      ' + lit(e)).join(',\n') + '\n' + I + '    ],\n';
      s += I + '    stratagems:[\n' + d.stratagems.map(x => I + '      ' + lit(x)).join(',\n') + '\n' + I + '    ]\n' + I + '  }';
      return s;
    };
    const put = objs => {
      let d = fs.readFileSync(DATA, 'utf8');
      const fAt = d.indexOf("  '" + faction + "': {"), dAt = d.indexOf('    detachments: {\n', fAt);
      if (fAt < 0 || dAt < 0) throw new Error('data.js has no FACTIONS row ' + faction + ' with detachments');
      // after the faction's last detachment: the detachments object ends at the first line "    }" after its start, at this depth
      const end = d.indexOf('\n    }', dAt + 19);
      const text = objs.map(([id, x]) => block(id, x)).join(',\n');
      d = d.slice(0, end) + ',\n' + text + d.slice(end);
      fs.writeFileSync(DATA, d);
      return text;
    };
    const first = dets.map(([id, d]) => [id, JSON.parse(JSON.stringify(d))]);
    const t1 = put(first);
    // the labels verify/derive.js reads from their words (as verify/from-json.js writes a new detachment's)
    const D = loadD(), F = D.factions[faction];
    const items = require('./derive').derive(D);
    const at = (dn, n) => items.filter(it => it.where === F.name + ' · ' + dn + ' · ' + n || it.where === F.name + ' · ' + dn + ' rule · ' + n);
    const lab = x => { const o = {}; if (x.at) o.at = x.at; if (x.ph && x.ph.length) { o.ph = x.ph; o.turn = x.turn; } if (x.turns) o.turns = x.turns; return o; };
    const labelled = first.map(([id, d]) => {
      const x = JSON.parse(JSON.stringify(d));
      // (a rule's labels after its name, as data.js writes them: name, at, ph, turn, turns, needs, then its words)
      const withLabels = rr => {
        const its = at(x.name, rr.name), tm = its.find(i => i.kind === 'rule-timing'), nd = its.find(i => i.kind === 'rule-needs');
        const o = { name: rr.name };
        // (the labels as verify/derive.js gives them, with no exception of the writer's own: derive.js is their only source)
        if (tm && tm.derived) Object.assign(o, lab(tm.derived));
        if (nd && nd.derived) o.needs = nd.derived;
        for (const [k, v] of Object.entries(rr)) if (!(k in o)) o[k] = v;
        return o;
      };
      x.rule = withLabels(x.rule);
      if (x.moreRules) x.moreRules = x.moreRules.map(withLabels);
      x.stratagems = x.stratagems.map(s0 => {
        const its = at(x.name, s0.name), tm = its.find(i => i.kind === 'strat-timing'), nd = its.find(i => i.kind === 'strat-needs');
        const o = {};
        for (const [k, v] of Object.entries(s0)) {
          o[k] = v;
          if (k === 'cp') { if (tm && tm.derived) { o.phases = tm.derived.ph; o.turn = tm.derived.turn; if (tm.derived.turns) o.turns = tm.derived.turns; } if (nd && nd.derived) o.needs = nd.derived; }
        }
        return o;
      });
      return [id, x];
    });
    let d = fs.readFileSync(DATA, 'utf8');
    d = d.replace(t1, labelled.map(([id, x]) => block(id, x)).join(',\n'));
    fs.writeFileSync(DATA, d);
  }
  // 3. the deviations (each difference of a catalogue row from BSData at the pin, with GW's evidence)
  const CAT = require('./catalog');
  const DEVF = path.join(ROOT, 'verify/deviations-bsdata.json');
  const ours = x => x.army === 'catalog' && String(x.unit).startsWith(faction + '/');
  const devList = JSON.parse(fs.readFileSync(DEVF, 'utf8')).filter(x => !ours(x));
  devList.push(...CAT.declarations(ROOT, faction, r));
  // (the lists' declarations first, as they are; then the catalogues', by faction, each faction's in the order its import writes
  // them: the file is the same whatever order the factions are written in)
  const facOf = x => x.army === 'catalog' ? String(x.unit).split('/')[0] : '';
  const sorted = devList.map((x, i) => [x, i]).sort((a, b) => (facOf(a[0]) === facOf(b[0]) ? a[1] - b[1] : facOf(a[0]) < facOf(b[0]) ? -1 : 1)).map(([x]) => x);
  devList.length = 0; devList.push(...sorted);
  fs.writeFileSync(DEVF, JSON.stringify(devList, null, 1) + '\n');
  // 4. the tables: every catalogue row into DATASHEETS (and once more through the old form, as verify/from-json.js does)
  const t = node(['verify/tables.js', '--write']);
  if (t.status !== 0) { console.error(t.stdout + t.stderr); process.exit(1); }
  for (const a of ['--expand', '--write']) node(['verify/tables.js', a]);
  console.log('wrote ' + path.relative(ROOT, SRC) + ', ' + dets.length + ' detachments into data.js, ' + devList.filter(ours).length + ' catalogue deviations; ' + (t.stdout || '').trim().split('\n')[0]);
};
