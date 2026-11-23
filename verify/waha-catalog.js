/* verify/waha-catalog.js: what GW prints about a faction's datasheets that a faction catalogue (verify/sources/catalog, docs/catalog.md)
   stands on, read from Wahapedia's cached pages (verify/.cache/waha) and nothing else:
     index(faction)        the faction page's datasheet index: [{ name, page (the datasheet's address), pageFaction, source (the book
                           Wahapedia marks it with), legends }] (a Warhammer Legends datasheet is marked "(Warhammer Legends)")
     detachments(faction)  the faction page's detachments: [{ name, dp, dispositions }] (verify/dispositions.js reads the same headings)
     sheet(WW, name, faction)  a datasheet page's UNIT COMPOSITION and WARGEAR OPTIONS:
                           { file, models:[{ model, min, max }], equipped:[sentences], options:[lines], lines:{ composition, options } }
     items(text)           the wargear a line names, in lower case, singular ("1 Praesidium Shield; 1 Pyrithite Spear" → two items)
   BSData is not used (the owner's decision, 22 Nov 2026). */
'use strict';
const fs = require('fs'), path = require('path');
const txt = s => String(s).replace(/<[^>]+>/g, '').replace(/&rsquo;|&#8217;|&apos;|&#39;/g, '’').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const n = s => String(s).toLowerCase().replace(/[’‘']/g, "'").replace(/[^a-z0-9']+/g, ' ').trim();
const sing = s => n(s).split(' ').map(w => w.replace(/ies$/, 'y').replace(/(?<=[a-z])xes$/, 'x').replace(/(?<!s)s$/, '')).join(' ');

module.exports = ROOT => {
  const FJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/sources/factions.json'), 'utf8'));
  const html = faction => fs.readFileSync(path.join((process.env.VERIFY_CACHE ? path.resolve(process.env.VERIFY_CACHE) : path.join(ROOT, 'verify/.cache')), 'waha', faction + '.html'), 'utf8');
  function index(faction){
    const h = html(faction), out = [], seen = new Set();
    for(const m of h.matchAll(/((?:<img class="tooltip logo2" title="([^"]*)"[^>]*>)?)<a href="\/wh40k11ed\/factions\/([^\/"]+)\/([^"#\/?]+)" class="cnClr">([^<]*)<\/a>/g)){
      const key = m[3] + '/' + m[4]; if(seen.has(key)) continue; seen.add(key);
      out.push({ name:txt(m[5]), page:m[4], pageFaction:m[3], source:txt(m[2] || ''), legends:/Warhammer Legends/i.test(m[2] || '') });
    }
    return out;
  }
  function detachments(faction){
    const out = [];
    for(const m of html(faction).matchAll(/<h2 id="[^"]*" class="outline_header">((?:<img[^>]*>)*[^<]*)<span class="dpPts">([\s\S]*?)<\/span><\/h2>/g)){
      const dp = /(\d+)DP\s*$/.exec(txt(m[2]));
      out.push({ name:txt(m[1]), dp:dp ? +dp[1] : null, source:txt((/title="([^"]*)"/.exec(m[1]) || [, ''])[1]), dispositions:[...m[2].matchAll(/<img title="Force Disposition: ([^"]+)"/g)].map(x => txt(x[1])) });
    }
    return out;
  }
  function sheet(WW, name, faction){
    const pg = WW.wahaPage(name, faction); if(!pg) return null;
    const L = WW.markup(pg.tokens, pg.P, 0, pg.P.s.length - 1).split('\n').map(l => l.replace(/\*\*/g, '').trim()).filter(Boolean);
    const sec = head => { const a = L.indexOf(head), o = []; if(a < 0) return o;
      for(let k = a + 1; k < L.length && !/^[A-Z][A-Z’' ]{3,}$/.test(L[k]) && !/^YOUR /.test(L[k]) && !/^KEYWORDS/.test(L[k]); k++) o.push(L[k]); return o; };
    const C = sec('UNIT COMPOSITION'), W = sec('WARGEAR OPTIONS');
    const models = C.map(l => /^- (\d+)(?:-(\d+))? (.+?)(?: models?)?(?:\s+[–-]\s+EPIC HERO)?$/.exec(l)).filter(Boolean).map(m => ({ model:m[3].replace(/\s+[–-]\s+EPIC HERO$/, ''), min:+m[1], max:+(m[2] || m[1]) }));
    return { file:pg.file, models, equipped:C.filter(l => /equipped with:/i.test(l)), options:W, lines:{ composition:C, options:W } };
  }
  return { index, detachments, sheet, n, sing, FJ };
};
module.exports.n = n; module.exports.sing = sing;
