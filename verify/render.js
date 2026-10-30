// Renders every screen and popup of every army in a headless browser and writes:
// - verify/out/snapshots/<army>.txt: the plain text of each, with every fold open (run.js compares
//   it with the committed verify/snapshots/ copy: no screen changes without someone seeing it)
// - verify/out/helpers.json: every sentence the app writes itself (footnotes, "When targeted",
//   reminders, use lines, tags, notes), with where it shows and what it cites
// - verify/out/render.json: the screen-level checks (failures fail the build)
// Usage: node verify/render.js   (needs a built index.html; NODE_PATH=$(npm root -g) for playwright)
// VERIFY_WIDTH=320 checks a small phone (snapshots and helpers come from the run at 390).
const path = require('path'), fs = require('fs');
const { ROOT, normText, serve, writeJSON, sha, loadData, columnSources } = require('./lib');
const { chromium } = require('playwright');
// a promise rejected with nothing to catch it (the browser gone, a page closed mid-call): its cause first, so the gate's summary line shows it
process.on('unhandledRejection', e => { console.log('render crashed: ' + ((e && e.stack) || e)); process.exit(1); });

// app-written text, by where the app puts it
const HELPER_SEL = ['.mod', '.def', '.rem', '.use', '.dsl', '.varc', '.note', '.tg', '.cr', '.tq', '.wn small', '.lbn',
  '.mods.all > .il', '.who', '.aw', '.abt', '.dl > div', '.pxm', '.pfl', '.army-sub', '.sec-h .c', '.usedby', '.wj', '.mlt'];

(async () => {
  const site = await serve(ROOT);
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const W = +(process.env.VERIFY_WIDTH || 390);   // run.js checks 390 (snapshots) and 320 (layout)
  const main = W === 390;
  const page = await (await browser.newContext({ viewport:{ width:W, height:844 }, serviceWorkers:'block' })).newPage();   // (a service worker's fetches would pass by the stand-in verified.js below)
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  // only the app's own files and its web fonts (the layout checks need the real fonts' widths)
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());   // the app ships its own fonts
  // verified.js is the result of the last gate run (this one writes it when it ends): a fixed stand-in, as if
  // this build passed, so the screens and their snapshots do not depend on how the previous run went
  const build = sha(['app.html', 'data.js', 'calc.js', 'effects.js', 'ask.js', 'import.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('')).slice(0, 10);
  const stub = { ok:true, build, data:loadData().version, date:'(date of the check)', checks:[{ label:'(checks)', detail:'(as listed by verify/run.js)' }], sources:[{ label:'(sources)', detail:'(as listed by verify/run.js)' }], tables:columnSources() };
  await page.route(/\/verified\.js(\?|$)/, r => r.fulfill({ contentType:'application/javascript', body:'window.WH_VERIFIED = ' + JSON.stringify(stub) + ';' }));
  await page.goto(site.url + 'index.html');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();

  const failures = [], helpers = new Map(), counts = {};
  // the list import: a New Recruit JSON export of a list in data.js, and the same with a unit renamed (refused)
  const IMPORT_FILE = path.join(ROOT, 'verify/sources/nr-json/6-bigs.json');
  const IMPORT_BAD = (j => { j.roster.forces[0].selections.find(x => x.name === 'Knight Errant').name = 'Knight Errant Mk II'; return j; })(JSON.parse(fs.readFileSync(IMPORT_FILE, 'utf8')));
  const fail = (check, army, where, detail) => failures.push({ check, army, where, detail });
  const armies = await page.evaluate(() => WH_DATA.armies.map(a => ({ id:a.id, units:a.units.concat(a.refs || []).map(u => u.id) })));
  // a fresh folder each run, so a list that left the app leaves no old snapshot behind
  if(main) fs.rmSync(path.join(ROOT, 'verify/out/snapshots'), { recursive:true, force:true });
  fs.mkdirSync(path.join(ROOT, 'verify/out/snapshots'), { recursive:true });

  // ---- the home screen's folders ----
  // - home-folders: home is two rows, Favorites and All lists, each with its count; a tap opens the folder; Back returns home
  // - home-fav: a list's star in All lists adds it to Favorites (kept on this phone, over a reload) and stays in All lists, starred; the star
  //   on its Find screen says so and takes it off again; nothing is starred at first; an empty Favorites says how to add one
  // - home-sort: each order puts All lists in it (newest: by the date in its source line, A to Z by name, by faction under bands), kept over a
  //   reload; the folder screens come back on a reload, with their Back
  const homeChecks = async () => {
    // (a tap right after a screen change is dropped; nothing there to tap is a failure, and the checks go on)
    const tap = async q => { await page.waitForTimeout(400); if(!await page.isVisible(q)){ fail('home-tap', '', q, 'nothing visible there to tap'); return; } await page.click(q); await page.waitForTimeout(200); };
    await page.evaluate(() => { localStorage.removeItem('wh-favs'); localStorage.removeItem('wh-home-sort'); hideSheet(); go({ s:'home' }); });
    const h = await page.evaluate(() => [...document.querySelectorAll('#view [data-folder]')].map(b => b.dataset.folder + ':' + b.querySelector('.c').textContent));
    if(h.join() !== 'favs:0,lists:' + armies.length) fail('home-folders', '', 'home', h.join());
    await tap('#view [data-folder="favs"]');
    const e = await page.evaluate(() => ({ s:cur.s, t:$('#top').innerText, rows:document.querySelectorAll('#view .arow').length, hint:/No favorites yet/.test($('#view').innerText), link:!!document.querySelector('#view [data-folder="lists"]') }));
    if(e.s !== 'favs' || !/Favorites/.test(e.t) || e.rows || !e.hint || !e.link) fail('home-fav', '', 'empty Favorites', JSON.stringify(e));
    await tap('#view [data-folder="lists"]');
    const id = armies[armies.length - 1].id;
    await tap(`#view [data-fav="${id}"]`);
    const st = await page.evaluate(id => ({ kept:localStorage.getItem('wh-favs'), on:(document.querySelector(`#view [data-fav="${id}"]`) || { getAttribute:() => 'none' }).getAttribute('aria-pressed'), still:!!document.querySelector(`#view [data-army="${id}"]`) }), id);
    if(st.kept !== JSON.stringify([id]) || st.on !== 'true' || !st.still) fail('home-fav', '', 'star in All lists', JSON.stringify(st));
    await page.reload(); await page.evaluate(() => document.fonts.ready);
    const re = await page.evaluate(() => ({ s:cur.s, back:($('#top [data-back]') || {}).textContent || '' }));
    if(re.s !== 'lists' || re.back !== 'Armies') fail('home-sort', '', 'reload on All lists', JSON.stringify(re));
    await tap('#top [data-back]');
    const hb = await page.evaluate(() => ({ s:cur.s, favs:(document.querySelector('#view [data-folder="favs"] .c') || {}).textContent }));
    if(hb.s !== 'home' || hb.favs !== '1') fail('home-folders', '', 'Back from All lists', JSON.stringify(hb));
    await tap('#view [data-folder="favs"]');
    const fv = await page.evaluate(() => [...document.querySelectorAll('#view .arow')].map(r => r.dataset.army));
    if(fv.join() !== id) fail('home-fav', '', 'Favorites with one', fv.join());
    await tap(`#view [data-army="${id}"]`);
    const fs1 = await page.evaluate(() => { const b = $('#top [data-fav]'); return b ? b.getAttribute('aria-pressed') : 'none'; });
    if(fs1 !== 'true') fail('home-fav', '', 'the star on Find', fs1);
    await tap('#top [data-fav]');
    const fs2 = await page.evaluate(() => ({ on:($('#top [data-fav]') || { getAttribute:() => 'none' }).getAttribute('aria-pressed'), kept:localStorage.getItem('wh-favs') }));
    if(fs2.on !== 'false' || fs2.kept !== '[]') fail('home-fav', '', 'unstarred on Find', JSON.stringify(fs2));
    // - home-fav-undo: unstarred in Favorites, the list leaves it with an Undo; Undo stars it again, with no other toast
    await page.evaluate(id => { store.set('wh-favs', [id]); hideSheet(); go({ s:'home' }); go({ s:'favs' }); }, id);
    await tap(`#view [data-fav="${id}"]`);
    const un = await page.evaluate(() => ({ kept:localStorage.getItem('wh-favs'), toast:$('#toast').innerText, rows:document.querySelectorAll('#view .arow').length }));
    if(un.kept !== '[]' || !/Removed from Favorites/.test(un.toast) || un.rows) fail('home-fav-undo', '', 'unstarred in Favorites', JSON.stringify(un));
    await page.waitForTimeout(400); if(await page.isVisible('#toast [data-undo]')) await page.click('#toast [data-undo]'); else fail('home-fav-undo', '', 'Undo', 'no Undo in the toast');
    await page.waitForTimeout(200);
    const ud = await page.evaluate(() => ({ kept:localStorage.getItem('wh-favs'), toast:$('#toast').classList.contains('show') ? $('#toast').innerText : '', rows:[...document.querySelectorAll('#view .arow')].map(r => r.dataset.army).join() }));
    if(ud.kept !== JSON.stringify([id]) || /Ticks/.test(ud.toast) || ud.rows !== id) fail('home-fav-undo', '', 'Undo', JSON.stringify(ud));
    // - home-fav-stale: a kept star of a list no longer in the app is not counted or shown
    await page.evaluate(id => { store.set('wh-favs', ['gone', id]); hideSheet(); go({ s:'home' }); }, id);
    const sc = await page.evaluate(() => (document.querySelector('#view [data-folder="favs"] .c') || {}).textContent);
    if(sc !== '1') fail('home-fav-stale', '', 'a star of a list that left the app', 'Favorites count ' + sc);
    await page.evaluate(() => { localStorage.removeItem('wh-favs'); hideSheet(); go({ s:'home' }); });
    // the orders
    const dateOf = src => { const m = /(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})/.exec(src || ''); return m ? Date.parse(m[1] + ' ' + m[2] + ' ' + m[3] + ' UTC') : 0; };
    const meta = await page.evaluate(() => WH_DATA.armies.map((a, i) => ({ id:a.id, name:a.name, src:a.source, f:factionOf(a).name, i })));
    const want = {
      new:meta.slice().sort((x, y) => dateOf(y.src) - dateOf(x.src) || y.i - x.i).map(x => x.id),
      az:meta.slice().sort((x, y) => x.name.localeCompare(y.name, 'en', { sensitivity:'base' })).map(x => x.id),
      faction:meta.slice().sort((x, y) => x.f.localeCompare(y.f) || x.name.localeCompare(y.name, 'en', { sensitivity:'base' })).map(x => x.id) };
    if(meta.some(x => !dateOf(x.src))) fail('home-sort', '', 'newest', 'a list without a date in its source line: ' + meta.filter(x => !dateOf(x.src)).map(x => x.id).join(', '));
    await page.evaluate(() => { hideSheet(); go({ s:'lists' }); });
    for(const k of ['az', 'faction', 'new']){
      await tap('#view [data-sort]'); await tap(`#sheetIn [data-sortv="${k}"]`);
      const got = await page.evaluate(() => ({ ids:[...document.querySelectorAll('#view .arow')].map(r => r.dataset.army), bands:document.querySelectorAll('#view .rgh').length, kept:localStorage.getItem('wh-home-sort'), sheet:$('#sheetHost').hidden }));
      if(got.ids.join() !== want[k].join() || got.kept !== JSON.stringify(k) || !got.sheet || (k === 'faction') !== got.bands > 0) fail('home-sort', '', k, JSON.stringify(got));
    }
    await page.evaluate(() => { localStorage.removeItem('wh-favs'); localStorage.removeItem('wh-home-sort'); hideSheet(); go({ s:'home' }); });
  };

  // ---- How the app works (from the home screen) ----
  // - how-row: home has the row "How the app works and why you should be able to trust the data"; it opens the screen, which comes back
  //   on a reload with its Back, and Back returns home
  // - how-tables: every table of data.js (TABLE_ORDER aside: the key order verify/tables.js writes, which the app never gets) has its card,
  //   with its real row count (and ARMIES its unit entries); every table of verify/columns.json has its columns, as columns.json lists them
  // - how-example: the unit entry shown is the one data.js stores (its ds and every field shown, as data.js has them)
  // - how-links: every GRANTS and RULE_OPTIONS row's rule is where the card says (an army rule, a detachment rule, a list's unit's ability);
  //   every CHECKLIST column is explained
  const howChecks = async () => {
    const src = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'), names = [...src.matchAll(/^const ([A-Z_]+) = /gm)].map(m => m[1]).filter(n => n !== 'TABLE_ORDER');
    const RAW = (() => { const t = src.replace(/\nreturn \{ version:VERSION/, '\nreturn { __raw:{ ' + names.join(', ') + ' }, version:VERSION'); if(t === src) return null;
      const w = {}; new Function('window', t)(w); return w.WH_DATA.__raw; })();
    if(!RAW){ fail('how-tables', '', 'data.js', 'its return line was not found: the raw tables could not be read'); return; }
    const rows = v => Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 1;
    const COLS = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify/columns.json'), 'utf8')).tables;
    await page.evaluate(() => { hideSheet(); go({ s:'home' }); });
    await page.waitForTimeout(400);
    const label = await page.evaluate(() => { const b = document.querySelector('#view [data-how]'); return b ? b.innerText.trim() : null; });
    if(label !== 'How the app works and why you should be able to trust the data') fail('how-row', '', 'home', JSON.stringify(label));
    if(label){ await page.click('#view [data-how]'); await page.waitForTimeout(300); }
    const o = await page.evaluate(() => ({ s:cur.s, t:$('#top').innerText, back:($('#top [data-back]') || {}).textContent || '' }));
    if(o.s !== 'how' || !/How the app works/.test(o.t) || o.back !== 'Armies') fail('how-row', '', 'the row opens it', JSON.stringify(o));
    const got = await page.evaluate(() => ({ cards:[...document.querySelectorAll('#view .hwc')].map(c => ({ t:c.dataset.table, rows:+c.dataset.rows, head:c.querySelector('summary .hwcnt').textContent })),
      cols:Object.fromEntries([...document.querySelectorAll('#view .hwct')].map(x => [x.dataset.t, x.dataset.cols])),
      n:Object.fromEntries([...document.querySelectorAll('#view .hwct[data-n]')].map(x => [x.dataset.t, +x.dataset.n])),
      lines:[...document.querySelectorAll('#view .hwct .hwl[data-l]')].map(x => ({ t:x.closest('.hwct').dataset.t, l:x.dataset.l, c:x.dataset.c.split(',') })),
      map:JSON.parse((document.querySelector('#view .hwmap') || { dataset:{ counts:'{}' } }).dataset.counts) }));
    for(const n of names){ const c = got.cards.find(x => x.t === n), want = rows(RAW[n]);
      if(!c) fail('how-tables', '', n, 'no card'); else if(c.rows !== want || !(n === 'VERSION' ? c.head === 'one value' : c.head.startsWith(want + ' '))) fail('how-tables', '', n, 'shows ' + c.rows + ' (' + c.head + '), data.js has ' + want); }
    for(const c of got.cards) if(!names.includes(c.t)) fail('how-tables', '', c.t, 'a card for a table data.js does not have');
    const entries = RAW.ARMIES.reduce((x, a) => x + a.units.length, 0), ac = got.cards.find(x => x.t === 'ARMIES');
    if(ac && !ac.head.includes(entries + ' unit entries')) fail('how-tables', '', 'ARMIES', 'unit entries: ' + ac.head + ', data.js has ' + entries);
    for(const t of Object.keys(COLS)){ const want = Object.entries(COLS[t].columns || {}).map(([n, x]) => n + ':' + x.source).join(','); if(got.cols[t] !== want) fail('how-tables', '', t, 'columns ' + got.cols[t] + ', columns.json ' + want); }
    // each column under the layer its columns.json source gives
    const LAYER = { 'ai-summary':'sum', 'ai-reading':'read', hand:'hand' };
    for(const x of got.lines) for(const c of x.c){ const s = ((COLS[x.t] || { columns:{} }).columns[c] || {}).source; if((LAYER[s] || 'mech') !== x.l) fail('how-tables', '', x.t + '.' + c, 'shown as ' + x.l + ', columns.json source ' + s); }
    // the inner tables' rows and the map's numbers, counted here from data.js as stored
    const walk = (root, parts) => parts.reduce((xs, k) => xs.flatMap(x => { const v = x[k]; return v == null ? [] : Array.isArray(v) ? v : k === 'detachments' ? Object.values(v) : [v]; }), root);
    const ROOTS = { ARMIES:RAW.ARMIES, DATASHEETS:Object.values(RAW.DATASHEETS), FACTIONS:Object.values(RAW.FACTIONS) };
    for(const [t, n] of Object.entries(got.n)){ const p = t.split('.'); if(p.length < 2) continue; const want = ROOTS[p[0]] ? walk(ROOTS[p[0]], p.slice(1)).length : null;
      if(want !== n) fail('how-tables', '', t, 'shows ' + n + ' rows, data.js has ' + want); }
    for(const t of ['DATASHEETS.stats', 'DATASHEETS.abilities', 'FACTIONS.detachments', 'FACTIONS.detachments.stratagems', 'ARMIES.units']) if(!(t in got.n)) fail('how-tables', '', t, 'no row count shown');
    const dets = walk(ROOTS.FACTIONS, ['detachments']);
    const wantMap = { lists:RAW.ARMIES.length, entries, factions:rows(RAW.FACTIONS), armyRules:walk(ROOTS.FACTIONS, ['armyRules']).length, detachments:dets.length,
      stratagems:walk(dets, ['stratagems']).length, enhancements:walk(dets, ['enhancements']).length, datasheets:rows(RAW.DATASHEETS), rules:rows(RAW.RULES), aliases:rows(RAW.RULE_ALIASES),
      ruleSrc:rows(RAW.RULE_SRC), concepts:rows(RAW.CONCEPTS), grants:rows(RAW.GRANTS), ruleOptions:rows(RAW.RULE_OPTIONS), checklist:rows(RAW.CHECKLIST), core:rows(RAW.CORE_STRATAGEMS), bsIds:rows(RAW.BS_IDS) };
    if(JSON.stringify(got.map) !== JSON.stringify(wantMap)) fail('how-tables', '', 'the map', 'shows ' + JSON.stringify(got.map) + ', data.js has ' + JSON.stringify(wantMap));
    for(const t of Object.keys(got.cols)) if(!COLS[t]) fail('how-tables', '', t, 'columns of a table columns.json does not have');
    const ex = await page.evaluate(() => { const el = document.querySelector('#view [data-hwentry]'); return el && { at:el.dataset.hwentry, rows:[...el.querySelectorAll('.pgr')].map(r => [r.querySelector('.pgk').textContent, r.querySelector('.pgv > span').textContent]) }; });
    if(!ex) fail('how-example', '', 'ARMIES', 'no unit entry shown');
    else { const [aid, uid] = ex.at.split('|'), e = ((RAW.ARMIES.find(x => x.id === aid) || { units:[] }).units.find(x => x.id === uid));
      if(!e) fail('how-example', '', ex.at, 'not an entry of data.js');
      else { const want = await page.evaluate(e => Object.fromEntries(Object.keys(e).map(k => [k, hwCut(hwPlain(hwVal(e[k])))])), e);
        for(const [k, v] of ex.rows) if(want[k] !== v) fail('how-example', '', ex.at + ' ' + k, 'shows ' + JSON.stringify(v) + ', data.js has ' + JSON.stringify(want[k])); } }
    const ln = await page.evaluate(() => {
      const fac = n => Object.values(D.factions).find(f => f.name === n);
      const at = r => { const p = r.split(' · '), k = hwRuleAt(r);
        if(k === 'army'){ const f = fac(p[0].replace(/ army rule$/, '')); return !!f && f.armyRules.some(x => x.name === p[1]); }
        if(k === 'det'){ const f = fac(p[0]); return !!f && Object.values(f.detachments).some(d => d.name + ' rule' === p[1]); }
        const a = armyById(p[0]); return !!a && unitsAll(a).some(u => u.name === p[1] && u.abilities.some(x => x.name === p[2])); };
      return { bad:D.grants.concat(D.ruleOptions).filter(x => !at(x.rule)).map(x => x.rule),
        ck:[...new Set(Object.values(D.checklist).flatMap(Object.keys))].filter(c => !hasOwn(HW_CK, c)) }; });
    if(ln.bad.length) fail('how-links', '', 'GRANTS / RULE_OPTIONS', 'a rule not where the card says: ' + ln.bad.slice(0, 5).join('; '));
    if(ln.ck.length) fail('how-links', '', 'CHECKLIST', 'columns the card does not explain: ' + ln.ck.join(', '));
    await page.reload(); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
    const re = await page.evaluate(() => ({ s:cur.s, back:($('#top [data-back]') || {}).textContent || '' }));
    if(re.s !== 'how' || re.back !== 'Armies') fail('how-row', '', 'reload on How the app works', JSON.stringify(re));
    if(re.back){ await page.click('#top [data-back]'); await page.waitForTimeout(300); }
    const hb = await page.evaluate(() => cur.s);
    if(hb !== 'home') fail('how-row', '', 'Back', hb);
  };

  // VERIFY_LISTS=a,b: only those lists' screens (a check run by hand, e.g. that the same build renders the same text again; run.js
  // renders every list)
  const only = (process.env.VERIFY_LISTS || '').split(',').filter(Boolean);
  for(const a of armies.filter(x => !only.length || only.includes(x.id))){
    const snap = [];
    // one screen: render it, open every fold, keep its text and its helpers
    const take = async (label, fn, folded) => {
      const r = await page.evaluate(([fn, sel, folded]) => {
        (0, eval)(fn)();
        if(!folded) document.querySelectorAll('#view details').forEach(d => d.open = true);
        const host = $('#sheetHost').hidden ? $('#view') : $('#sheetIn');
        const found = [...host.querySelectorAll(sel.join(','))].filter(el => !el.parentElement.closest(sel.join(',')));
        const hs = found.map(el => ({ cls:el.className, text:el.innerText, refs:[...el.querySelectorAll('[data-rule],[data-strat],[data-ability],[data-enh],[data-unit]')]
          .map(x => Object.entries(x.dataset).filter(([k]) => ['rule','strat','ability','enh','unit'].includes(k)).map(([k, v]) => k + ':' + v)[0]) }));
        // a granted value or keyword ("Granted by …") opens its own popup: its link carries what showGrant needs
        // a hidden popup keeps its last content (often another list's): only an open one counts
        const links = [...document.querySelectorAll('#view [data-rule],#view [data-strat],#view [data-ability],#view [data-enh],#view [data-kw],#view [data-grant]' + ($('#sheetHost').hidden ? '' : ',#sheetIn [data-rule],#sheetIn [data-strat],#sheetIn [data-ability],#sheetIn [data-enh],#sheetIn [data-kw]'))]
          .map(x => x.dataset.grant ? 'grant:' + JSON.stringify([x.dataset.grant, x.dataset.gu, x.dataset.what, x.dataset.rule || null])
            : Object.entries(x.dataset).filter(([k]) => ['rule','strat','ability','enh','kw'].includes(k)).map(([k, v]) => k + ':' + v)[0]);
        return { title:$('#top').innerText.replace(/\s+/g, ' ').trim(), text:host.innerText, hs, links, overflow:document.documentElement.scrollWidth - innerWidth,
          bigIcons:[...document.querySelectorAll('#top svg, #view svg, #sheetIn svg, #subbar svg, #bbar svg')].filter(x => !x.closest('.hwmap')).filter(x => x.getBoundingClientRect().width > 40 || x.getBoundingClientRect().height > 40).map(x => (x.getAttribute('class') || '') + ' ' + ((x.querySelector('use') || {}).getAttribute ? x.querySelector('use').getAttribute('href') : '') + ' in .' + x.parentElement.className).slice(0, 3), tabs:document.querySelectorAll('#bbar .tabs button').length === 5,
          unnamed:[...document.querySelectorAll('#bbar .tabs button')].filter(x => !(x.getAttribute('aria-label') || '').trim()).map(x => x.dataset.tab) };
      }, [String(fn), HELPER_SEL, !!folded]);
      if(r.overflow > 0) fail('no-sideways-scroll', a.id, label, 'the page is ' + r.overflow + 'px wider than the phone');
      if(r.bigIcons.length) fail('icon-size', a.id, label, 'icons drawn over 40px (no size set): ' + r.bigIcons.join(', '));
      if(!/^home\b/.test(label) && label !== 'settings' && !/^popup (import|order)/.test(label) && !r.tabs)   // (the import sheet opens on the home screen)
      fail('tabs', a.id, label, 'no tab bar');
      if(r.unnamed.length) fail('tabs-named', a.id, label, 'tabs (icons only) without a name for screen readers: ' + r.unnamed.join(', '));
      // the data version changes with every release: the snapshot keeps a placeholder
      snap.push('######## ' + label + ' · ' + r.title + '\n' + r.text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().replace(/^Data \d{4}-\d\d-\d\d\.\d+$/m, 'Data (version)'));
      for(const h of r.hs){
        const t = normText(h.text);
        if(!t) continue;
        const e = helpers.get(t) || { text:t, kind:h.cls, where:[], refs:new Set() };
        if(e.where.length < 12) e.where.push(a.id + ' · ' + label);
        for(const x of h.refs) if(x) e.refs.add(x);
        helpers.set(t, e);
      }
      return r;
    };
    const links = new Set();
    const screen = async (s, extra) => {
      const r = await take(s + (extra ? ' ' + JSON.stringify(extra) : ''), `() => { hideSheet(); openStrats.clear(); ${extra && extra.open ? `allStratagems().forEach(x => openStrats.add(x.id));` : ''} go({ s:'${s}', army:'${a.id}' }); }`, extra && extra.folded);
      r.links.forEach(l => links.add(l));
    };
    if(a === armies[0]){ await take('settings', `() => { hideSheet(); go({ s:'settings' }); }`); await take('home', `() => { hideSheet(); go({ s:'home' }); }`);
      // its two folders: Favorites (none at first, then two lists starred), All lists in each order, and the order's sheet
      await take('home favorites (none)', `() => { hideSheet(); go({ s:'home' }); go({ s:'favs' }); }`);
      for(const [k, n] of [['new', 'newest first'], ['az', 'a to z'], ['faction', 'by faction']]) await take('home all lists (' + n + ')', `() => { store.set('wh-home-sort', '${k}'); hideSheet(); go({ s:'home' }); go({ s:'lists' }); }`);
      await take('popup order', `() => { hideSheet(); go({ s:'home' }); go({ s:'lists' }); showSort(); }`);
      await take('home favorites (two)', `() => { const ids = ['shooty', 'healybois'].filter(armyById); store.set('wh-favs', ids.length === 2 ? ids : WH_DATA.armies.slice(0, 2).map(x => x.id)); store.set('wh-home-sort', 'az'); hideSheet(); go({ s:'home' }); go({ s:'favs' }); }`);
      await take('home (two favorites)', `() => { hideSheet(); go({ s:'home' }); }`);
      await take('home how the app works', `() => { hideSheet(); go({ s:'home' }); go({ s:'how' }); }`);
      await homeChecks();
      await howChecks();
      // the list import's sheet, empty and with an export it refuses (6 bigs with a unit renamed: verify/import-test.js has the rest)
      await take('popup import', `() => { hideSheet(); go({ s:'home' }); showImport(); }`);
      await take('popup import (not recognized)', `() => { hideSheet(); go({ s:'home' }); showImport(); runImport(${JSON.stringify(JSON.stringify(IMPORT_BAD))}); }`); }
    // (the Phase checklist from Find, then back to Find: the screens after it are reached as before, their back buttons the same)
    for(const s of ['army','checklist','pregame','units','ranged','melee','abilities','rules','bases']){ await screen(s); if(s === 'checklist') await page.evaluate(id => { hideSheet(); go({ s:'army', army:id }); }, a.id); }
    // the damage calculator, at a target set by hand (a fresh one: 5 × T4 Sv 3+ W2): this list's first unit with ranged weapons
    // shooting (Shoot), its first unit with melee weapons fighting, charged (Fight), and its first unit with both shooting, charging
    // and fighting (Both); each taken once every effect is worked out (the list's order and every number settled: the background work
    // is seeded, so the text is the same every run)
    for(const ph of ['shooting', 'fight', 'both']){
      await page.evaluate(([id, ph]) => { hideSheet(); sess.dmg = {};
        const A = armyById(id), kind = ph === 'fight' ? 'melee' : 'ranged', u = (ph === 'both' && A.units.find(x => (x.ranged || []).length && (x.melee || []).length)) || A.units.find(x => (x[kind] || []).length) || A.units[0];
        sess.dmg[id] = { atk:u.id, turn:{ me:dmModeTurn(ph === 'shooting' ? 'shoot' : ph, ph === 'fight' ? { fc:true } : {}) } };
        go({ s:'damage', army:id }); }, [a.id, ph]);
      await page.waitForFunction(() => !dmBusy() && !document.querySelector('#dmList .fxv.wait, #dmList .fxv.est, #dmAns.prov, #dmList .upd'), null, { timeout:120000, polling:50 });
      const custFolded = await page.evaluate(() => { const c = [...document.querySelectorAll('#dmList details.dmcust')]; return c.length > 0 && c.every(d => !d.open); });   // (as drawn: the take opens every fold)
      await take('damage ' + ph, `() => {}`);
      // the five groups, in order (Army rules, Unit rules, From other units in your list, Stratagems, Custom modifiers), in each part of
      // the list; every rule box in exactly one of them; the Custom modifiers folded, each of effects.js's once
      const grp = await page.evaluate(() => { const bad = [], parts = document.querySelectorAll('#dmList .dmpart').length || 1;
        const heads = [...document.querySelectorAll('#dmList .dmh3')].map(h => h.firstChild.textContent.trim()).filter(t => DM_GROUPS.some(g => g[1] === t));
        const want = DM_GROUPS.slice(0, 4).map(g => g[1]); for(let i = 0; i < parts; i++) if(heads.slice(i * 4, i * 4 + 4).join('|') !== want.join('|')) bad.push('groups: ' + heads.join(', '));
        const cust = [...document.querySelectorAll('#dmList details.dmcust')];
        if(cust.length !== parts) bad.push(cust.length + ' Custom modifiers groups for ' + parts + ' parts');
        for(const c of cust){ const n = c.querySelectorAll('[data-dmlv*="r:u:"]').length; if(n && n !== WH_EFFECTS.CUSTOM.length)   // (drawn once opened: the opening is checked below, damage-modifiers)
           bad.push('Custom modifiers: ' + n + ' of ' + WH_EFFECTS.CUSTOM.length); }
        for(const e of document.querySelectorAll('#dmList .dmlv[data-dmlv*="r:"]')){ const n = [e.closest('[data-dmgrp]'), e.closest('details.dmcust')].filter(Boolean).length; if(n !== 1) bad.push(e.dataset.dmlv + ' in ' + n + ' groups'); }
        return bad; });
      if(!custFolded) grp.unshift('Custom modifiers not folded');
      if(grp.length) fail('damage-groups', a.id, ph, grp.slice(0, 5).join('; '));
      // (ai-summary: a "Not counted" stratagem line quotes GW's words, not its gist: no AI label; its name opens the stratagem)
      { const bad = await page.evaluate(() => [...document.querySelectorAll('#view .dmncr [data-strat]')].map(el => { const s = allStratagems().find(x => x.id === el.dataset.strat), lab = !!el.querySelector('.ai');
          return !s ? el.dataset.strat + ': no such stratagem' : lab ? s.name + ': an AI label on GW’s words' : ''; }).filter(Boolean));
        for(const x of bad) fail('ai-summary', a.id, 'damage ' + ph, x); }
    }
    await screen('strats', { folded:true });   // every stratagem folded: its one-line gist, timing and users
    // - ai-summary: every stratagem row with a gist (AI-written) carries the AI label, and the row opens its rules as written (WHEN,
    //   TARGET, EFFECT as data.js has them); no row without a gist has the label
    { const bad = await page.evaluate(() => { const out = [], al = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        for(const el of document.querySelectorAll('#view details.strat')){ const s = allStratagems().find(x => x.id === el.dataset.stratId); if(!s) continue;
          const lab = !!el.querySelector('summary .cpw .ai');
          if(!!s.gist !== lab) out.push(s.name + (s.gist ? ': its summary has no AI label' : ': an AI label without a summary'));
          if(!al(el.querySelector('.sb').textContent).includes(al(s.effect).slice(0, 150))) out.push(s.name + ': the open row lacks the rules as written'); }
        return out; });
      for(const x of bad) fail('ai-summary', a.id, 'strats', x); }
    await screen('strats', { open:true });     // every stratagem, unfolded
    for(const u of a.units){
      const r = await take('unit ' + u, `() => { hideSheet(); go({ s:'unit', army:'${a.id}', unit:'${u}' }); }`);
      r.links.forEach(l => links.add(l));
    }
    // every popup a link on these screens opens
    const opener = { rule:'showRule', strat:'showStrat', ability:'showAbility', enh:'showEnhancement', kw:'showKeywords' };
    for(const l of [...links].filter(Boolean).sort()){
      const i = l.indexOf(':'), k = l.slice(0, i), v = l.slice(i + 1);
      const call = k === 'grant' ? `(g => showGrant(g[0].split('|'), g[1], g[2], g[3]))(${v})` : `${opener[k]}(${JSON.stringify(v)})`;
      const r = await take('popup ' + l, `() => { hideSheet(); go({ s:'army', army:'${a.id}' }); ${call}; }`);
      const open = await page.evaluate(() => !$('#sheetHost').hidden && $('#sheetTitle').textContent.trim().length > 0);
      if(!open) fail('link-resolves', a.id, l, 'the link opens nothing');
    }

    // ---- the datasheet's "When targeted" fold ----
    // - targeted-fold: a fold (a summary, the browser's button with its expanded state), closed at first, its line saying how many
    //   lines it has; a tap opens it and shows them, the open fold is kept for the session (the screen drawn again: still open), a
    //   second tap closes it and forgets it
    // - targeted-items: opened, a line per item of defenceItems (as the datasheet takes them), shown, each with every word of the
    //   item's own text in order (only split and styled: no word left out), the model of an attached unit as its label
    const tg = await page.evaluate(async armyId => {
      const out = [], A = WH_DATA.armies.find(x => x.id === armyId), tick = () => new Promise(r => setTimeout(r, 0));
      const words = t => t.replace(/[“”"’'():;,.·]/g, ' ').split(/\s+/).filter(Boolean);
      const shown = el => el.getClientRects().length > 0 && !!el.innerText.trim();
      hideSheet(); go({ s:'army', army:armyId });
      for(const u of A.units){
        for(const k of [...openStrats]) if(k.startsWith('tg|')) openStrats.delete(k);
        go({ s:'unit', army:armyId, unit:u.id }); navAt = -1e9;   // (a tap just after a screen is drawn is let through)
        const items = defenceItems(u, null, { shields:true }).filter(x => !armyRuleOption(x));
        const fold = () => document.querySelector('#view details.tgt');
        if(!items.length){ if(fold()) out.push(['targeted-fold', u.id, 'a When targeted fold with nothing in it']); continue; }
        let d = fold();
        if(!d){ out.push(['targeted-fold', u.id, 'no When targeted fold for ' + items.length + ' items']); continue; }
        const sum = d.querySelector(':scope > summary');
        if(!sum || !/^when targeted$/i.test((sum.querySelector('.il') || {}).textContent || '')) out.push(['targeted-fold', u.id, 'its line does not say When targeted']);
        const n = sum && sum.querySelector('.x');
        if(!n || n.textContent.trim() !== String(items.length)) out.push(['targeted-fold', u.id, 'its count says ' + (n ? n.textContent : 'nothing') + ' for ' + items.length + ' items']);
        if(d.open || d.querySelector('.tgls').innerText.trim()) out.push(['targeted-fold', u.id, 'open before a tap']);   // (closed: its lines not drawn, no text)
        sum.click(); await tick();
        if(!d.open || ![...d.querySelectorAll('.tgl')].every(l => l.innerText.trim())) out.push(['targeted-fold', u.id, 'a tap does not open it']);
        go({ s:'unit', army:armyId, unit:u.id }); navAt = -1e9; d = fold();
        if(!d || !d.open) out.push(['targeted-fold', u.id, 'not kept open when the screen is drawn again']);
        const lines = [...d.querySelectorAll('.tgl')];
        if(lines.length !== items.length) out.push(['targeted-items', u.id, lines.length + ' lines for ' + items.length + ' items']);
        items.forEach((x, i) => { const l = lines[i];
          if(!l || !shown(l)){ out.push(['targeted-items', u.id, 'not shown: ' + x.t.slice(0, 60)]); return; }
          const lab = l.querySelector(':scope > .sc'), text = l.innerText.replace(/\s+/g, ' ');
          if(lab && !(x.who && lab.textContent === x.who)) out.push(['targeted-items', u.id, 'a label that is not its model: ' + lab.textContent]);
          const have = words(lab ? text.slice(lab.innerText.length) : text), want = words(x.t);
          let j = 0; for(const w of have) if(j < want.length && w === want[j]) j++;
          if(j < want.length) out.push(['targeted-items', u.id, '“' + want.slice(j, j + 4).join(' ') + '” missing from “' + text.slice(0, 80) + '”']);
          if(!l.querySelector('[data-rule],[data-strat],[data-ability],[data-unit]')) out.push(['targeted-items', u.id, 'a line that opens nothing: ' + text.slice(0, 60)]);
        });
        d.querySelector(':scope > summary').click(); await tick();
        if(d.open || openStrats.has('tg|' + armyId + '|' + u.id)) out.push(['targeted-fold', u.id, 'a second tap does not close it']);
      }
      return out; }, a.id);
    for(const [c, w, d] of tg) fail(c, a.id, w, d);

    // ---- screen-level checks ----
    const res = await page.evaluate(armyId => {
      const out = [], A = WH_DATA.armies.find(x => x.id === armyId);
      hideSheet(); go({ s:'army', army:armyId });
      // (not a limit on what the ability selects, "Each model can only be selected for this ability once per turn": the Technomancer's
      // use is not limited, the app's onceTag shows none)
      const onceOf = ab => { const m = /(?<!\bselected for this ability )once per (battle round|battle|phase|turn)(, per (army|unit))?/i.exec((ab.tag || '') + ' ' + (ab.text || '')); return m && m[0].toLowerCase(); };
      for(const u of A.units){
        go({ s:'unit', army:armyId, unit:u.id });
        document.querySelectorAll('#view details').forEach(d => d.open = true);
        // every ability is on its datasheet (a Damaged profile as its band)
        const rows = [...document.querySelectorAll('#sec-abilities .ab > summary')];
        for(const ab of u.abilities){
          if(ab.damaged){ if(!document.querySelector('.def.dmg')) out.push(['ability-listed', u.id, ab.name + ': no Damaged band']); continue; }
          const row = rows.find(r => r.querySelector('b') && r.querySelector('b').textContent.trim() === ab.name);
          if(!row){ out.push(['ability-listed', u.id, ab.name + ': not on the datasheet']); continue; }
          const once = onceOf(ab);
          if(once && !row.textContent.toLowerCase().includes(once)) out.push(['once-tag', u.id, ab.name + ': the row does not say "' + once + '"']);
        }
        // a footnote for ranged and melee attacks alike sits in the "All attacks" block
        if((u.ranged || []).length && (u.melee || []).length){
          const k = m => [m.from, m.when, m.note].join('|');
          const mr = unitMods(u, 'ranged'), mm = new Set(unitMods(u, 'melee').map(k));
          const all = (document.querySelector('.mods.all') || {}).innerText || '';
          for(const m of mr) if(mm.has(k(m)) && !(m.weapon && m.set) && !u.abilities.some(ab => ab.damaged && ab.name === m.from) && !all.includes(m.note.slice(0, 40)))
            out.push(['all-attacks-block', u.id, m.from + ': ' + m.note]);
        }
        // the army facts the datasheet shows where they matter:
        // - a unit always riled up by its own rule (riled: Super Runts) says so on every riled-up line, When targeted and footnotes
        // - Waaagh!'s [ASSAULT] while riled up, on a unit with Waaagh! some of whose ranged weapons lack [ASSAULT]
        // - what another unit of the list gives it when it is attacked (guard), under When targeted
        // - every keyword once, a keyword only some models have under those models (kwOnly)
        const lines = [...document.querySelectorAll('#view .tgl, #view .mod')].map(x => x.innerText.replace(/\s+/g, ' '));   // (When targeted: a line each)
        if(u.abilities.some(ab => ab.riled && !ab.na)) for(const l of lines) if(/(^|· |TARGETED ?)Riled up(?! \()/i.test(l)) out.push(['always-riled', u.id, 'a riled-up line without “always riled up”: ' + l.slice(0, 80)]);
        if(u.rules.includes('Waaagh!') && (u.ranged || []).some(w => !w.kw.some(x => /^assault$/i.test(x))) && !lines.some(l => l.includes('[ASSAULT] (Waaagh!)')))
          out.push(['riled-assault', u.id, 'no “Riled up: [ASSAULT] (Waaagh!)” footnote']);
        const when = (document.querySelector('#view .def.tgt') || {}).innerText || '';
        for(const src of A.units) for(const g of src.guard || []) if(src !== u && matches(g.needs, u) && !when.includes('(' + g.from + ')')) out.push(['guard-shown', u.id, g.from + ' (' + src.name + ') is not under When targeted']);
        const pills = [...document.querySelectorAll('#sec-kw .pill')].map(x => x.textContent.replace(/\*$/, '').toLowerCase());
        if(pills.length !== u.kw.length || u.kw.some(x => !pills.includes(x.toLowerCase()))) out.push(['keywords-shown', u.id, pills.length + ' keyword pills for ' + u.kw.length + ' keywords']);
      }
      // the Units list: a unit with several stats rows shows each (Squighog Boyz' Nob and Boyz, Canis Rex and Sir Hekhtur)
      go({ s:'units', army:armyId });
      for(const u of A.units){ const n = document.querySelectorAll('[data-unit="' + u.id + '"] .sn').length;
        if(u.stats.length > 1 && n !== u.stats.length) out.push(['units-rows', u.id, n + ' stats rows shown of ' + u.stats.length]); }
      // the Overview lists the detachment rules with the army rules
      go({ s:'pregame', army:armyId });
      const ov = [...document.querySelectorAll('#view .rr > summary b')].map(b => b.textContent);
      for(const d of detachmentsOf(A)) for(const r of (d.rule ? [d.rule].concat(d.moreRules || []) : [])) if(!ov.includes(r.name)) out.push(['overview-rules', armyId, r.name + ' is not in the Overview’s rules']);
      // the Phase checklist: every army and detachment rule, option and ability of the list it lists (listed: a fixed moment of the
      // sequence, a once-per-battle use, a stored moment) is on it, and no other, each in the sections its CHECKLIST entry names (To do now where it is triggered, or at the moment it opens with; Active
      // now where its effect is used and it is not triggered; Once per battle, from where it is triggered, for an ability with uses per
      // battle); what the entry cannot place under When unclear (unless data.js has its phase tag) or No phase; no stratagem; each
      // section a fold, closed at first, its line counting each part; a box ticked is kept, Reset clears it and not a once-per-battle box
      for(const k of [...openStrats]) if(k.startsWith('ck|')) openStrats.delete(k);
      go({ s:'checklist', army:armyId });
      const ck = {};
      if(document.querySelector('#view [data-ckfold][open]')) out.push(['checklist-folds', armyId, 'a section starts open']);
      for(const d of document.querySelectorAll('#view [data-ckfold]')){ const g = ck[d.querySelector('summary b').textContent] = {};
        for(const x of d.querySelectorAll('.ckg')) g[x.querySelector('.qh').textContent] = [...x.querySelectorAll('.tl')];
        const said = d.querySelector('summary .rs').textContent, n = Object.entries(g).map(([k, ls]) => ls.length + ' ' + (k === 'To do now' ? 'to do' : k === 'Active now' ? 'active' : k.toLowerCase())).join(' · ') || 'nothing';
        if(said !== n) out.push(['checklist-folds', armyId, d.querySelector('summary b').textContent + ': the line says “' + said + '”, the fold has ' + n]); }
      const lineIn = (sec, grp, test) => ((ck[sec] || {})[grp] || []).some(test);
      const T = s => s.includes('|') ? PHASE_NAME[s.split('|')[0]] + ' · ' + TURN_NAME[s.split('|')[1]] : s;
      const secsOf = e => [...new Set(ckAt(e.at).concat(Object.entries(ckMap(e.t)).flatMap(([p, t]) => (t === 'either' ? ['your', 'opp'] : [t]).map(w => p + '|' + w)), e.ae ? [e.ae] : []))];
      const usedOf = e => Object.entries(ckMap(e.u)).flatMap(([p, t]) => (t === 'either' ? ['your', 'opp'] : [t]).map(w => p + '|' + w));
      // each place an entry should be: [section heading, group]
      const want = (e, once, kind, x, force) => {
        if(x && !force && !listed(e, x, once)) return [];   // on its datasheet: not listed
        if(!e || e.x){ if(x && x.at) e = { at:x.at }; else return [['When unclear', kind]]; }
        if(e.none) return [['No phase', kind]];
        const tr = secsOf(e), act = usedOf(e).filter(s => !tr.includes(s));
        if(once) return (tr.length ? tr : act).map(s => [T(s), 'Once per battle']);
        return tr.map(s => [T(s), 'To do now']).concat(act.map(s => [T(s), 'Active now']));
      };
      const CK = WH_DATA.checklist || {};
      // what is listed, as the screen's note documents it, written out again here (not derive.js's seqTrigger): a sentence of the item's
      // own words (its options' lines, worked examples, italic notes and durations left out) naming the start or end of a battle round,
      // turn or phase, a Command phase, or another phase with a choice, with no unit activation in it; a once-per-battle use; a moment
      // data.js stores for an item derive cannot place
      const ACT = /\bselected to\b|\beach time (?:this|that|the|a|an|your) [^.,]*?\b(?:unit|model|bearer)\b|\bwhen (?:this|that|the|a|an|your) [^.,]*?\b(?:unit|model|bearer)\b[^.,]*?\b(?:is|are|makes?|ends?|has|have|was)\b|\b(?:this|that|the bearer['’]?s?) (?:unit|model)['’]s (?:move|attacks?)\b|\bmakes? an? (?:attack|charge|move)\b|\bis targeted\b|\btargets? (?:this|that|the bearer)\b|\bafter (?:this|that|the) (?:unit|model|bearer)\b[^.,]*?\bhas (?:shot|fought|moved|charged)\b|\bdestroys?\b|\bfirst time\b/i;
      // paragraph by paragraph: in one that opens with a unit activation, a later moment counts only with a choice of its own; a moment
      // named only as a past reference ("was within … at the start of the turn") is not one
      const seqOwn = (x, e) => { const L = String(x.text || '').split('\n'), drop = new Set();
        L.forEach((l, i) => { const b = l.replace(/^- /, ''); if(/^\*\*Examples?(?::\*\*|\*\*:)/i.test(b) || /^\*[^*].*\*$/.test(l)) drop.add(i);
          if(((e && e.o) || []).some(o => b.startsWith('**' + o.n))){ drop.add(i); if(/^- \*\*[^*]+\*\*\s*$/.test(l)) drop.add(i + 1);
            if(/:\s*$/.test(l)) for(let k = i + 1; k < L.length && /^- (?!\*\*)/.test(L[k]); k++) drop.add(k); } });
        return L.filter((l, i) => !drop.has(i)).join('\n').replace(/\*\*|~~/g, '').split(/\n+/).some(par => {
          const ss = par.split(/(?<=[.!?])\s+/).map(z => z.replace(/\buntil the (?:start|end) of [^,.;]*/gi, ' ').replace(/\b(?:once|twice) per \w+ phase\b/gi, ' ')
            .replace(/\b(?:was|were)\b[^.;:]*?\b(?:at the )?(?:start|end) of (?:the|that) (?:turn|phase|battle round)\b/gi, ' '));
          const opensAct = ss.length && ACT.test(ss[0]);
          // (a sentence that opens with its moment: an activation after it is its effect's, Mischief and Confusion)
          const MOM = /\b(?:start|end) of (?:the |your |your opponent['’]s |each |every |any |that |a )?(?:first |next )?(?:battle round|turn|(?:command|movement|shooting|charge|fight) phase|phase)\b/i;
          const opensMoment = z => /^\W*at the (?:start|end) of\b/i.test(z) && MOM.test(z) && z.search(MOM) < z.search(ACT);
          return ss.some(z => (/\b(?:start|end) of (?:the |your |your opponent['’]s |each |every |any |that |a )?(?:first |next )?(?:battle round|turn|(?:command|movement|shooting|charge|fight) phase|phase)\b/i.test(z) ||
            /\b(?:your |your opponent['’]s |the |each |either player['’]s )command phase\b/i.test(z) || /\b(?:your |your opponent['’]s |the |each |either player['’]s )?(?:movement|shooting|charge|fight) phase,?[^.]*?\b(?:you can|select|choose)\b/i.test(z)) &&
            (!ACT.test(z) || opensMoment(z)) && (!opensAct || /\b(?:you can|select|choose)\b/i.test(z))); }); };
      const listed = (e, x, once) => !!(seqOwn(x, e) || (e && e.x && x.at) || once);
      if(document.querySelector('#view [data-strat]')) out.push(['checklist-sections', armyId, 'a stratagem is listed']);
      const ckRules = factionOf(A).armyRules.concat(detachmentsOf(A).flatMap(d => d.rule ? [d.rule].concat(d.moreRules || []) : []));
      // "Each time you make a X roll": where the list's listed rules and abilities make that roll (written out again, not ckRollMoments)
      const plainT = t => String(t || '').replace(/\*\*|~~/g, ''), rollM = {};
      for(const [x, e0] of ckRules.map(r => [r, CK['r|' + A.faction + '|' + r.name]]).concat(A.units.flatMap(u => u.abilities.map(ab => [ab, CK['a|' + ckHash(ab.name + '\n' + ab.text)]])))){
        if(!e0 || !listed(e0, x, false)) continue; const e = e0.x && x.at ? { at:x.at } : e0;
        for(const sent of plainT(x.text).split(/(?<=[.!?])\s+|\n+/)){ if(/\b(?:each time|when) you make\b/i.test(sent)) continue;
          for(const m of sent.matchAll(/\bmake an? ([A-Z][\w’'-]*(?: (?:of|[A-Z][\w’'-]*))*) roll\b/g)){ const y = rollM[m[1]] = rollM[m[1]] || { at:'', t:{} };
            if(e.at && !y.at) y.at = e.at; for(const [p, w] of Object.entries(ckMap(e.t))) y.t[p] = y.t[p] && y.t[p] !== w ? 'either' : w; } } }
      const rolled = (e0, x) => { const k = (/\b[Ee]ach time you make an? ([A-Z][\w’'-]*(?: (?:of|[A-Z][\w’'-]*))*) roll\b/.exec(plainT(x.text)) || [])[1], y = k && rollM[k];
        if(!y || !(y.at || Object.keys(y.t).length) || seqOwn(x, e0)) return null; const t = Object.entries(y.t).map(([p, w]) => p + ':' + w).join(',');
        return Object.assign({}, y.at ? { at:y.at } : {}, t ? { t } : {}); };
      // "You can only select each … once per battle" (Kindred Sorcery, Combat Doctrines): a box per option (its table's rows, else its
      // CHECKLIST options), each under Once per battle where the rule is triggered, a unit activation or not
      const eachOf = r => /\bselect each\b[^.;]*?\bonce per battle\b(?! round)/i.test(plainT(r.text)) && !!(r.table || ((CK['r|' + A.faction + '|' + r.name] || {}).o || []).length);
      for(const r of ckRules){
        const e0 = CK['r|' + A.faction + '|' + r.name], e = e0 && ckStored(e0, r);
        if(!e0) out.push(['checklist-sections', armyId, r.name + ': no CHECKLIST entry (node verify/derive.js --write)']);
        const hit = l => [...l.querySelectorAll('[data-rule]')].some(x => x.dataset.rule === r.name) && l.textContent.startsWith(r.name + ' · ');
        const each = eachOf(r);
        const onceR = !inertRule(r.name) && !each && !CK_EACH_ONCE.test(r.text || '') && !!perBattle(r, true) && !/per battle\b(?! round)[^.)]*\bper unit\b/i.test(r.text || ''), inR = listed(e0, r, onceR);
        // listed only through options with moments of their own: the rule, once, without its options
        const collapse = !inR && ((e0 && e0.o) || []).some(o => o.s && !A.units.some(u => u.abilities.some(ab => ab.name === o.n)));
        // (at the end moments its options name, Code Chivalric's Deeds; none: as its entry says)
        const ends = collapse ? [...new Set((e0.o || []).flatMap(o => o.ends || []))] : [];
        const w = ends.length ? ends.map(z => [z, 'To do now']) : want(e0, onceR, 'Rules', r, collapse);
        const listedR = Object.values(ck).some(g => Object.values(g).some(ls => ls.some(hit)));
        if(listedR !== !!(w && w.length || !w)) out.push(['checklist-sections', armyId, r.name + (listedR ? ' is listed, and is always on' : ' is not listed')]);
        else if(w) for(const [sec, grp] of w) if(!lineIn(sec, grp, hit)) out.push(['checklist-sections', armyId, r.name + ' is not under ' + sec + ' · ' + grp]);
        for(const o of (e && e.o) || []){
          if(A.units.some(u => u.abilities.some(ab => ab.name === o.n))) continue;
          const oIn = !collapse && !!(o.s || (inR && (!o.a || (each && !inertRule(r.name))))), oListed = Object.values(ck).some(g => Object.values(g).some(ls => ls.some(l => l.textContent.startsWith(o.n + ' · option of ' + r.name))));
          if(oIn !== oListed) out.push(['checklist-sections', armyId, r.name + ' · ' + o.n + (oListed ? ' is listed, and should not be' : ' is not listed')]);
          if(!oIn) continue;
          const oc = e.oc || e.pk, oe = !o.x && (o.t || o.at) ? o : !o.x && o.u ? { u:o.u } : oc && oc.u ? { u:oc.u } : { x:1 }, oh = l => l.textContent.startsWith(o.n + ' · option of ' + r.name);
          const ow = each && !inertRule(r.name) && !o.x ? (o.t || o.at ? secsOf(o) : secsOf(e)).map(s => [T(s), 'Once per battle']) : want(oe, false, 'Rules');
          for(const [sec, grp] of ow) if(!lineIn(sec, grp, oh)) out.push(['checklist-sections', armyId, r.name + ' · ' + o.n + ' is not under ' + sec + ' · ' + grp]);
        }
      }
      // what a listed rule or ability puts in force from a rule of the list (CHECKLIST f): "Riled up (War Cry) · Waaagh!" under Active
      // now in each phase its entry names, or When unclear
      const onceR0 = r => { const each = eachOf(r); return !inertRule(r.name) && !each && !CK_EACH_ONCE.test(r.text || '') && !!perBattle(r, true) && !/per battle\b(?! round)[^.)]*\bper unit\b/i.test(r.text || ''); };
      const forcedIn = (fs, src, kind) => { for(const x of fs || []){ if(!ckRules.some(y => y.name === x.r)) continue;
        const N = x.n.charAt(0).toUpperCase() + x.n.slice(1) + ' (' + src + ') · ' + x.r, fh = l => l.textContent.startsWith(N);
        const fw = x.x ? [['When unclear', kind]] : usedOf({ u:x.u }).map(s => [T(s), 'Active now']);
        for(const [sec, grp] of fw) if(!lineIn(sec, grp, fh)) out.push(['checklist-sections', armyId, N + ' is not under ' + sec + ' · ' + grp]); } };
      for(const r of ckRules){ const e0 = CK['r|' + A.faction + '|' + r.name]; if(!e0) continue;
        const each = eachOf(r), inR = listed(e0, r, !inertRule(r.name) && !each && !CK_EACH_ONCE.test(r.text || '') && !!perBattle(r, true) && !/per battle\b(?! round)[^.)]*\bper unit\b/i.test(r.text || ''));
        if(inR && !onceR0(r)) forcedIn(e0.f, r.name, 'Rules');   // (what a once-per-battle use puts in force: its box only)
        const collapse = !inR && (e0.o || []).some(o => o.s && !A.units.some(u => u.abilities.some(ab => ab.name === o.n)));
        for(const o of e0.o || []) if(!collapse && (o.s || (inR && (!o.a || (each && !inertRule(r.name))))) && !A.units.some(u => u.abilities.some(ab => ab.name === o.n))) forcedIn(o.f, o.n, 'Rules'); }
      for(const ab of new Set(A.units.flatMap(u => u.abilities))){ const e0 = CK['a|' + ckHash(ab.name + '\n' + ab.text)]; if(!e0) continue;
        const onceA = !naReason(ab) && !!perBattle(ab), inA = listed(e0, ab, onceA);
        if(inA && !onceA) forcedIn(e0.f, ab.name, 'Abilities');
        // the ability a listed one selects (pickOptions): Active now where it is used within its selector's duration (pk), unless it is
        // listed itself or its own trigger is a unit activation (a)
        if(inA && !onceA && e0.pk) for(const P of pickOptions(ab, A.units.find(u => u.abilities.includes(ab))).list){
          const eP = CK['a|' + ckHash(P.name + '\n' + P.text)] || { x:1 };
          if(eP.a || listed(eP, P, !naReason(P) && !!perBattle(P)) || rolled(eP, P)) continue;
          // where it is used: its own use, or its options' when every one is read; none read: the selector's whole duration
          const oU = !eP.u && (eP.o || []).length && eP.o.every(o => o.u) ? eP.o.map(o => o.u) : null;
          const uni = us => { const m = {}; for(const x of us) for(const [p, t] of Object.entries(ckMap(x))) m[p] = m[p] && m[p] !== t ? 'either' : t; return Object.entries(m).map(([p, t]) => p + ':' + t).join(','); };
          const use = eP.u || (oU && uni(oU));
          const within = (a, b) => { const B = ckMap(b); return Object.entries(ckMap(a)).map(([p, t]) => [p, !B[p] ? null : t === 'either' ? B[p] : B[p] === 'either' || B[p] === t ? t : null]).filter(([, t]) => t).map(([p, t]) => p + ':' + t).join(','); };
          const u2 = e0.pk.x ? '' : use ? within(use, e0.pk.u) : e0.pk.u, N = P.name + ' (' + ab.name + ') · ';
          const pw = u2 ? usedOf({ u:u2 }).map(z => [T(z), 'Active now']) : [['When unclear', 'Abilities']];
          for(const [sec, grp] of pw) if(!lineIn(sec, grp, l => l.textContent.startsWith(N))) out.push(['checklist-sections', armyId, N + 'is not under ' + sec + ' · ' + grp]); }
        for(const o of e0.o || []) if(o.s || (inA && !o.a)) forcedIn(o.f, o.n, 'Abilities'); }
      const firstOf = ab => A.units.flatMap(u => u.abilities).find(x => x.name === ab.name && x.text === ab.text && !naReason(x) === !naReason(ab));
      for(const u of A.units) for(const ab of u.abilities){
        const e = CK['a|' + ckHash(ab.name + '\n' + ab.text)], key = abilityKey(ab);
        if(!e) out.push(['checklist-sections', armyId, u.id + ' · ' + ab.name + ': no CHECKLIST entry under the app’s key (node verify/derive.js --write)']);
        // (an ability a listed one selects names its selector: "The Blood God’s Favour (Wrathful Presence) · Angron")
        const hit = l => [...l.querySelectorAll('[data-ability]')].some(x => x.dataset.ability === key) && (l.textContent.startsWith(ab.name + ' ·') || l.textContent.startsWith(ab.name + ' (')) &&
          !/\|pk:/.test((l.querySelector('[data-ctick]') || { dataset:{} }).dataset.ctick || '');   // (not its line as the ability another selects: pk)
        const R = e && rolled(e, firstOf(ab));
        const w = R ? want(R, !naReason(ab) && !!perBattle(ab), 'Abilities', firstOf(ab), true) : want(e, !naReason(ab) && !!perBattle(ab), 'Abilities', firstOf(ab), !!e && !listed(e, firstOf(ab), !naReason(ab) && !!perBattle(ab)) && (e.o || []).some(o => o.s));
        const listedA = Object.values(ck).some(g => Object.values(g).some(ls => ls.some(hit)));
        if(listedA !== !!(w && w.length || !w)) out.push(['checklist-sections', armyId, u.id + ' · ' + ab.name + (listedA ? ' is listed, and is always on' : ' is not listed')]);
        else if(w) for(const [sec, grp] of w) if(!lineIn(sec, grp, hit)) out.push(['checklist-sections', armyId, u.id + ' · ' + ab.name + ' is not under ' + sec + ' · ' + grp]);
      }
      { navAt = -1e9;
        const cb = document.querySelector('#view [data-ctick]'), ob = document.querySelector('#view [data-tick]'), ck0 = cb && cb.dataset.ctick, ob0 = ob && ob.dataset.tick;
        if(!cb || !document.querySelector('#view .sec-h [data-ckreset]')) out.push(['checklist-ticks', armyId, 'no box or no Reset']);
        else {
          cb.click(); if(ob) ob.click();
          const kept = JSON.parse(localStorage.getItem('wh-check-' + armyId) || '[]').includes(ck0);
          go({ s:'checklist', army:armyId }); navAt = -1e9;
          const on = (document.querySelector('#view [data-ctick="' + CSS.escape(ck0) + '"]') || {}).className || '';
          document.querySelector('#view [data-ckreset]').click();
          const cleared = !document.querySelector('#view [data-ctick].on') && JSON.parse(localStorage.getItem('wh-check-' + armyId) || '[]').length === 0;
          const onceKept = !ob || usedSet().has(ob0);
          if(!kept || !/\bon\b/.test(on) || !cleared || !onceKept) out.push(['checklist-ticks', armyId, JSON.stringify({ kept, on, cleared, onceKept })]);
          localStorage.removeItem('wh-check-' + armyId); localStorage.removeItem('wh-used-' + armyId); $('#toast').classList.remove('show', 'act'); undoFn = null;
        } }
      // the damage calculator, for every unit of this list as the attacker (every rule ticked), at a target set by hand:
      // - a value New Recruit already includes (a weapon's `from`) is never added again by the same rule
      // - a rule for one weapon or one model of an attached unit reaches only that weapon or model
      for(const u of A.units){
        for(const kind of ['ranged', 'melee']){
          if(!(u[kind] || []).length) continue;
          const st = { dir:'me', ph:kind === 'ranged' ? 'shooting' : 'fight', off:{}, pick:{}, on:{}, man:{}, val:{} };
          for(const r of dmCalc(st, A, u, {}, kind).rules) st.on[r.k] = true;
          for(const it of weaponItems(u[kind])) st.off[kind + ':' + itemName(it) + '|' + (it.who || '')] = false;
          const c = dmCalc(st, A, u, {}, kind);
          c.input.groups.forEach((g, i) => {
            const w = c.gOf[i].w, it = c.gOf[i].it;
            if(g.from !== w.from) out.push(['damage-bonus-twice', u.id, g.name + ': the weapon’s pre-applied values are not passed to the calculator']);
            for(const x of c.R.groups[i].applied) if([].concat((w.from || {})[x.key] || []).includes(x.from)) out.push(['damage-bonus-twice', u.id, g.name + ': ' + x.key + ' from ' + x.from + ' added again']);
            for(const m of g.mods){ const r = c.rules.find(x => x.on && x.m.from === m.from); if(!r) continue;
              const sc = (r.sc && r.sc.scope) || {}, nm = itemName(it).toLowerCase();
              if(sc.weapon && !it.profiles.some(p => [p.name, it.group, itemName(it)].some(x => String(x || '').toLowerCase().replace(/[’']/g, "'").startsWith(sc.weapon)))) out.push(['damage-mod-scope', u.id, m.from + ' (for ' + sc.weapon + ') reaches ' + g.name]);
              if(sc.models === 'model' && r.m.ab && r.m.ab.who && u.leads && r.m.ab.who !== (it.who || '')) out.push(['damage-mod-scope', u.id, m.from + ' (for ' + r.m.ab.who + ') reaches ' + g.name]); }
          });
        }
      }
      // Bases: every model of every unit gets a base line
      go({ s:'bases', army:armyId });
      const cards = [...document.querySelectorAll('.px')];
      A.units.forEach(u => {
        const card = cards.find(c => c.querySelector('[data-unit="' + u.id + '"]'));
        const n = card ? [...card.querySelectorAll('.pxn')].reduce((t, x) => t + parseInt(x.textContent, 10), 0) : 0;
        if(n !== modelCount(u)) out.push(['bases-count', u.id, 'Bases lists ' + n + ' models, the unit has ' + modelCount(u)]);
      });
      // search finds every name the paper has
      const names = [];
      for(const u of A.units){
        names.push(['unit', u.name]);
        for(const w of [...(u.ranged || []), ...(u.melee || [])]) names.push(['weapon', w.group || w.name]);
        for(const ab of u.abilities) names.push(['ability', ab.name]);
      }
      for(const s of usableStrats(A)) names.push(['stratagem', s.name]);
      const seen = new Set();
      go({ s:'army', army:armyId });   // the search box lives on the army screen
      for(const [kind, name] of names){
        if(seen.has(kind + name)) continue; seen.add(kind + name);
        query[armyId] = name; moreShown.clear(); renderFinder();
        const titles = [...document.querySelectorAll('#qres .rg .res b')].map(b => b.textContent.trim().toLowerCase());
        const n = name.toLowerCase();   // a weapon with profiles is found as "Gutrippa – Hunter"
        if(!titles.some(t => t === n || t.startsWith(n + ' – '))) out.push(['search-finds', kind, name]);
      }
      // an opponent named by older saved state (the Opponent row's pick, the list that was "yours") is ignored: Find searches
      // this list only, the Overview is "Your list"; and the rules chat
      // says it sends your list (a key stands in for one saved)
      const B = WH_DATA.armies[(WH_DATA.armies.findIndex(x => x.id === armyId) + 1) % WH_DATA.armies.length], wasOpp = store.get('wh-opp-' + armyId), wasAsk = store.get('wh-ask');
      store.set('wh-opp-' + armyId, B.id); sess.mine = B.id; sess.peekD = 0;
      query[armyId] = B.units[0].name; moreShown.clear(); renderFinder();
      const other = [...document.querySelectorAll('#qres .rg > .lbl')].map(l => l.textContent).filter(t => !KIND_ORDER.some(k => t.startsWith(k + ' · ')));
      if(other.length || document.querySelector('#qres [data-their]')) out.push(['opp-ignored', armyId, 'Find, searching ' + B.units[0].name + ', shows another list: ' + other.join(', ')]);
      query[armyId] = ''; renderFinder();
      go({ s:'pregame', army:armyId });
      const head = (document.querySelector('#view .sec-h h2') || {}).textContent || '';
      if(head !== 'Your list') out.push(['opp-ignored', armyId, 'the Overview is headed “' + head + '”']);
      // outside Claude the ? opens the copy for the Claude Project (with a Copy button); with a key, "Other ways to ask" opens the key chat
      store.set('wh-ask', { key:'sk-ant-check' }); askKeyChat = false; openAsk();
      const copyNote = [...document.querySelectorAll('#sheetIn .note')].map(x => x.textContent).find(t => /^Copies your question/.test(t)) || '';
      if(!document.querySelector('#sheetIn [data-askcopy]') || !/your whole list/.test(copyNote)) out.push(['ask-copy', armyId, 'no Copy button or note: “' + copyNote + '”']);
      hideSheet(); askKeyChat = true; openAsk();
      const sent = [...document.querySelectorAll('#sheetIn .note')].map(x => x.textContent).find(t => /^Sent with each question/.test(t)) || '';
      if(sent !== 'Sent with each question: your list (' + A.name + '), the Core Rules and this screen.') out.push(['ask-sends', armyId, '“' + sent + '”']);
      hideSheet(); askConv = null; store.set('wh-ask', wasAsk == null ? null : wasAsk); store.set('wh-opp-' + armyId, wasOpp); delete sess.mine; delete sess.peekD;
      go({ s:'army', army:armyId });
      query[armyId] = ''; renderFinder();
      return out;
    }, a.id);
    for(const [check, where, detail] of res) fail(check, a.id, where, detail);
    // a Phase checklist fold opened stays open when the screen is drawn again (for the session, like a stratagem card)
    const kept = await page.evaluate(async armyId => { hideSheet(); for(const k of [...openStrats]) if(k.startsWith('ck|')) openStrats.delete(k);
      go({ s:'checklist', army:armyId }); const d = document.querySelectorAll('#view [data-ckfold]')[1]; if(!d) return 'no folds';
      const k = d.dataset.ckfold; d.open = true; await new Promise(r => setTimeout(r, 50)); go({ s:'checklist', army:armyId });
      const again = document.querySelector('#view [data-ckfold="' + CSS.escape(k) + '"]'), n = document.querySelectorAll('#view [data-ckfold][open]').length;
      openStrats.delete(k); saveSession(); go({ s:'army', army:armyId });   // (back on Find, where the checks above leave each list)
      return again && again.open && n === 1 ? '' : 'opened ' + k + ', drawn again: ' + (again && again.open) + ', ' + n + ' open'; }, a.id);
    if(kept) fail('checklist-folds', a.id, 'kept open', kept);

    if(main) fs.writeFileSync(path.join(ROOT, 'verify/out/snapshots', a.id + '.txt'), snap.join('\n\n') + '\n');
    counts[a.id] = { screens:snap.length, links:links.size };
  }
  // ---- the Damage tab under a finger (each width): the first list's first unit with ranged weapons at a target set by hand (Shoot;
  // Both where it says so) ----
  {
    const A = armies[0].id;
    const settled = async () => { await page.waitForFunction(() => !dmBusy() && !document.querySelector('#dmList .fxv.wait, #dmList .fxv.est, #dmAns.prov, #dmList .upd'), null, { timeout:120000, polling:50 }); await page.waitForTimeout(300); };
    // (at: [list, unit], that list's unit; a tap within 350ms of opening a screen is not taken)
    const open = async (mode, at, more) => { await page.evaluate(([A, mode, at, more]) => { hideSheet(); const M = at ? at[0] : A; sess.dmg = {};
      const L = armyById(M), u = at ? L.units.find(x => x.id === at[1]) : L.units.find(x => (x.ranged || []).length) || L.units[0];
      sess.dmg[M] = Object.assign({ atk:u.id, turn:{ me:dmModeTurn(mode || 'shoot') } }, more || {});
      go({ s:'damage', army:M }); scrollTo(0, 0); }, [A, mode || '', at || null, more || null]);
      await settled(); await page.waitForTimeout(200); };
    const where = () => page.evaluate(() => JSON.stringify([cur.s, cur.army, sess.dmg[cur.army] && sess.dmg[cur.army].atk]));
    // a rule's popup opened from the list, closed (its Close, then Escape): the same screen and unit
    const linked = await page.evaluate(A => (armyById(A).units.find(u => { hideSheet(); sess.dmg = { [A]:{ atk:u.id } }; go({ s:'damage', army:A }); return !!document.querySelector('#dmList .dmrl'); }) || {}).id, A);
    if(!linked) fail('damage-popup-stays', A, 'no rule of the list in the list', '');
    else { await open('', [A, linked]);
      const home = await where();
      for(const how of ['close', 'escape']){
        await page.evaluate(() => document.querySelector('#dmList .dmrl').scrollIntoView({ block:'center' })); await page.waitForTimeout(200);
        await page.evaluate(() => document.querySelector('#dmList .dmrl').click()); await page.waitForTimeout(400);
        const shown = await page.evaluate(() => !$('#sheetHost').hidden);
        if(how === 'close') await page.evaluate(() => { const c = document.querySelector('#sheetIn [data-close], #sheet [data-close]'); if(c) c.click(); else closeSheet(); });
        else await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        const now = await where();
        if(!shown || now !== home) fail('damage-popup-stays', A, 'closed with ' + how, (shown ? '' : 'no popup; ') + 'the app moved from ' + home + ' to ' + now);
      } }
    // a tap never moves the row under the finger: the same spot tapped twice, quickly, toggles the same row back
    await open();
    const rows = await page.evaluate(() => [...document.querySelectorAll('#dmList .dmlv[data-dmlv]')].filter(e => e.getClientRects().length && !e.classList.contains('rad')).map(e => e.dataset.dmlv));
    for(const id of rows.slice(0, 6)){
      await settled();
      // (scrolled to it as a finger would: a scroll lets go of the row tapped before, dmAnchor)
      const pt = await page.evaluate(id => { dmAnchor = null; const e = [...document.querySelectorAll('#dmList .dmlv[data-dmlv]')].find(x => x.dataset.dmlv === id); scrollTo(0, e.getBoundingClientRect().top + scrollY - 420); const r = e.getBoundingClientRect(), k = e.querySelector('.ck').getBoundingClientRect(); return [k.left + k.width / 2, k.top + k.height / 2, e.getAttribute('aria-pressed')]; }, id);   // (its box: the rule's name opens its rule)
      await page.waitForTimeout(300);
      const under = () => page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y), r = e && e.closest('[data-dmlv]'); return r ? [r.dataset.dmlv, r.getAttribute('aria-pressed')] : null; }, pt);
      await page.mouse.click(pt[0], pt[1]); await page.waitForTimeout(120);
      const mid = await under();
      await page.mouse.click(pt[0], pt[1]); await page.waitForTimeout(1500);
      const end = await under();
      if(!mid || mid[0] !== id || !end || end[0] !== id || end[1] !== pt[2]) fail('damage-tap-twice', A, id, 'tapped twice at the same spot: ' + JSON.stringify([mid, end]) + ', was ' + pt[2]);
    }
    // the top control, Shoot | Fight | Both: every segment one tap, the one on obvious (filled, pressed), a thumb's size, the control
    // on the screen; each mode is what the card says (its steps), and a tap moves nothing (the segment where it was, the page as tall
    // from the first frame on)
    await open('shoot');
    for(const m of ['fight', 'both', 'shoot']){
      const r = await page.evaluate(async m => { const q = () => document.querySelector('[data-dmmode="' + m + '"]'), b = q(); if(!b) return { bad:['no ' + m + ' segment'] };
        const bad = [], r0 = b.getBoundingClientRect();
        if(r0.height < 44 || r0.width < 60) bad.push(m + ' is ' + Math.round(r0.width) + '×' + Math.round(r0.height) + 'px');
        const c = b.closest('.dmmode').getBoundingClientRect(); if(c.right > innerWidth + 0.5 || c.left < -0.5 || document.documentElement.scrollWidth > innerWidth) bad.push('the control is wider than the screen');
        b.click(); const s = [], t0 = performance.now();
        while(performance.now() - t0 < 3000){ await new Promise(f => requestAnimationFrame(f)); const x = q(); s.push([x ? Math.round(x.getBoundingClientRect().top) : null, document.documentElement.scrollHeight]); }
        if(s.some(x => x[0] == null || Math.abs(x[0] - Math.round(r0.top)) > 2)) bad.push('the segment moved: ' + Math.round(r0.top) + ' → ' + [...new Set(s.map(x => x[0]))].join(', '));
        if(s.some(x => x[1] !== s[0][1])) bad.push('the page height changed after the first frame: ' + [...new Set(s.map(x => x[1]))].join(' → '));
        const on = [...document.querySelectorAll('[data-dmmode]')].filter(x => x.getAttribute('aria-pressed') === 'true').map(x => x.dataset.dmmode);
        if(on.join() !== m) bad.push('pressed: ' + on.join());
        const st = getComputedStyle(q()), off = getComputedStyle(document.querySelector('[data-dmmode]:not([aria-pressed="true"])'));
        if(st.backgroundColor === off.backgroundColor) bad.push('the segment on looks like the others');
        const want = { shoot:/^Shoot ·/, fight:/^Fight ·/, both:/^Shoot → (Charge → )?Fight ·/ }[m], ctx = (document.querySelector('#dmAns .dmctx') || {}).textContent || '';
        if(!want.test(ctx) && !(document.querySelector('.dmans.static .dmmsg'))) bad.push('the card says “' + ctx.slice(0, 40) + '”');
        return { bad }; }, m);
      if(r.bad.length) fail('damage-mode', A, m, r.bad.join('; '));
      await settled();
    }
    // Both: its total is the Shoot → Charge → Fight play of the same choices (the Shoot step and the charged Fight step, one after the
    // other in the same games), the card says each part, and the shooting's and the fight's choices are in their own sections
    await open('both');
    const both = await page.evaluate(() => { const C = DM_CTX; if(!C || !C.plan.both) return { skip:true };
      const r = WH_CALC.play({ beats:C.plan.beats.map(b => ({ side:1, ph:b.ph, fight:b.ph === 'fight', input:Object.assign({}, b.M.input, { sims:undefined, seed:undefined }) })), sims:DM_X, seed:7 });
      const one1 = C.A.one, want = WH_CALC.fmt(one1 ? r.beats.reduce((t, x) => t + x.dmg, 0) : r.sides[1].killed), got = document.querySelector('#dmAns .dmbig b').textContent;
      const parts = (document.querySelector('#dmAns .dmparts') || {}).textContent || '';
      const secs = [...document.querySelectorAll('#dmList .dmpart')].map(p => p.dataset.dmstep + ':' + [...p.querySelectorAll('.dmh3')].map(h => h.firstChild.textContent.trim()).filter(t => /weapons/.test(t)).join());
      return { want, got, parts, secs, charged:C.plan.beats[1].M.ctx.charged }; });
    if(!both.skip && (Math.abs(+both.want - +both.got) > 0.1 || !/^Shoot [\d.]+ · Fight [\d.]+ · /.test(both.parts) || both.secs.join('|') !== 'shoot:Ranged weapons|fight:Melee weapons' || !both.charged))
      fail('damage-both', A, 'Both', JSON.stringify(both));
    // a mode the unit has no weapons for: its segment says so and stays tappable; tapped, the card says so (Both: the part it has)
    const gun = await page.evaluate(() => { for(const L of WH_DATA.armies) for(const u of L.units) if(!(u.ranged || []).length && (u.melee || []).length) return [L.id, u.id]; return null; });
    if(gun){ await open('shoot', gun);
      const g = await page.evaluate(() => { const s = document.querySelector('[data-dmmode="shoot"]'), b = document.querySelector('[data-dmmode="both"]');
        return { s:s ? s.textContent : '', b:b ? b.textContent : '', dis:!!(s && s.disabled), msg:(document.querySelector('.dmans .dmmsg') || {}).textContent || '' }; });
      await page.click('[data-dmmode="both"]'); await settled();
      const gb = await page.evaluate(() => ({ note:(document.querySelector('#dmAns .dmparts') || {}).textContent || '', on:(document.querySelector('[data-dmmode][aria-pressed="true"]') || {}).dataset }));
      if(!/no ranged weapons/.test(g.s) || !/fight only/.test(g.b) || g.dis || !/no ranged weapons/.test(g.msg) || !/no ranged weapons, so this is the fight alone/.test(gb.note) || gb.on.dmmode !== 'both') fail('damage-mode', A, 'a unit with no ranged weapons', JSON.stringify([g, gb])); }
    // nothing moves while the effects fill in: a row tapped, then every frame for 3 s, the row stays where it was (within 2px) and the
    // page is as tall as in the first frame (the effects before the tap stay in place, dimmed; every number has its room)
    for(const mode of ['shoot', 'both']){ await open(mode);
      const ids = await page.evaluate(() => [...document.querySelectorAll('#dmList .dmlv[data-dmlv], #dmList .dmpp[data-dmlv]')].filter(e => e.getClientRects().length).map(e => e.dataset.dmlv));
      for(const id of ids.filter((x, i) => i % Math.max(1, Math.floor(ids.length / 5)) === 0).slice(0, 5)){
        const r = await page.evaluate(async id => { const q = () => document.querySelector('#dmList [data-dmlv="' + CSS.escape(id) + '"]'), e = q(); if(!e) return null;
          scrollTo(0, e.getBoundingClientRect().top + scrollY - 420); await new Promise(f => requestAnimationFrame(() => requestAnimationFrame(f)));
          const r0 = q().getBoundingClientRect(), y0 = Math.round(r0.top); q().dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:r0.left + 30, clientY:r0.top + 10 }));
          const s = [], t0 = performance.now();
          while(performance.now() - t0 < 3000){ await new Promise(f => requestAnimationFrame(f)); const x = q(); s.push([Math.round(scrollY), x ? Math.round(x.getBoundingClientRect().top) : null, document.documentElement.scrollHeight]); }
          return { y0, moved:s.filter(x => x[1] == null || Math.abs(x[1] - y0) > 2).length, grew:s.filter(x => x[2] !== s[0][2]).length, frames:s.length, heights:[...new Set(s.map(x => x[2]))], tops:[...new Set(s.map(x => x[1]))] }; }, id);
        if(r && (r.moved || r.grew)) fail('damage-steady', A, mode + ' · ' + id, r.moved + ' of ' + r.frames + ' frames the row moved (' + r.y0 + ' → ' + r.tops.join(', ') + '), ' + r.grew + ' the page height changed (' + r.heights.join(' → ') + ')');
        await settled(); } }
    // no divider touches or crosses a text line, a pick or a box, on the units with picks under their rows (Try Dat Button!, a weapon's
    // profiles and its boxes, the Blessings, the Doctrina Imperatives), every fold open, with the card in its place and pinned
    // (in the page: every border-top/bottom line of the screen against every text line and every box; a line drawn by a box itself, or
    // inside it, is the box's own; one under the pinned card is not seen, unless it shows through)
    const dmLines = () => {
      const bad = [], root = document.querySelector('#view'), pin = document.querySelector('#dmPin');
      const pr = pin && !pin.hidden && pin.firstElementChild ? pin.firstElementChild.getBoundingClientRect() : null;
      const under = (r, e) => pr && !pin.contains(e) && r.bottom > pr.top && r.top < pr.bottom;   // under the pinned card: not seen
      const shown = e => { for(let x = e; x && x !== document.body; x = x.parentElement){ const cs = getComputedStyle(x); if(cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false; } return true; };
      const lines = [], boxes = [];
      const BOX = '.dmpp, .dmop, .dmchip, .dmbh, .btn, .btn2, .sd, .best, .dmmode button, .dmans, .dmmx:not([hidden]), .dwb, .dmtt, .textbtn';
      for(const e of root.querySelectorAll('*')){
        if(!e.getClientRects().length) continue;
        const cs = getComputedStyle(e), r = e.getBoundingClientRect();
        if(r.width < 1 || r.height < 0.5) continue;
        for(const s of ['Top', 'Bottom']){ const w = parseFloat(cs['border' + s + 'Width']);
          if(w > 0 && cs['border' + s + 'Style'] !== 'none' && !/rgba\(\d+, \d+, \d+, 0\)/.test(cs['border' + s + 'Color']) && shown(e)){ const y = s === 'Top' ? r.top : r.bottom - w;
            if(!under({ top:y, bottom:y + w }, e)) lines.push({ e, y, h:w, x1:r.left, x2:r.right, s });
            else { const t = document.elementFromPoint((Math.max(r.left, 0) + Math.min(r.right, innerWidth)) / 2, y + w / 2); if(t && !pin.contains(t)) bad.push('a line shows through the pinned card: ' + (e.className || e.tagName)); } } }
        if(e.matches(BOX) && shown(e) && !under(r, e)) boxes.push({ e, r });
      }
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
      while((n = tw.nextNode())){ if(!n.textContent.trim()) continue; const pe = n.parentElement; if(!pe || !pe.getClientRects().length || !shown(pe)) continue;
        if(pe.closest('.dwv')) continue;   // (a wheel's rows scroll inside it: the wheel is the box)
        const rg = document.createRange(); rg.selectNodeContents(n);
        for(const r of rg.getClientRects()) if(r.width > 0.5 && !under(r, pe)) boxes.push({ e:pe, r, t:n.textContent.trim().slice(0, 28) }); }
      const nm = e => (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : e.tagName.toLowerCase()) + (e.dataset.dmlv ? '[' + e.dataset.dmlv.slice(0, 24) + ']' : '');
      for(const L of lines) for(const B of boxes){
        if(!B.t && (B.e === L.e || B.e.contains(L.e))) continue;   // the box's own edge, or a line drawn inside it
        if(pin && pin.contains(B.e) !== pin.contains(L.e)) continue;   // the list scrolling under the pinned card's edge
        if(L.x2 <= B.r.left + 0.5 || L.x1 >= B.r.right - 0.5) continue;
        if(L.y + L.h > B.r.top - 2 && L.y < B.r.bottom + 2){ const k = nm(L.e) + ' ' + L.s.toLowerCase() + ' line ' + (L.y < B.r.bottom && L.y + L.h > B.r.top ? 'through' : 'touching') + ' ' + (B.t ? '“' + B.t + '”' : nm(B.e));
          if(!bad.includes(k)) bad.push(k); } }
      return bad;
    };
    for(const [L0, st0, label] of [
      ['shooty', { atk:'dakkarig-boosta' }, 'Try Dat Button!'],
      ['shooty', { atk:'mek-flashgitz' }, 'profiles, models left'],
      ['princes', { atk:'kh-rn-the-betrayer-khorne-berzerkers', turn:{ me:{ mode:'fight', fight:true, charge:true, fc:true } } }, 'Blessings'],
      ['purge-goes-the-foe', { atk:'skitarii-rangers', typed:{ n:10, T:4, W:1, Sv:4, InSv:0, fnp:0 } }, 'Doctrina'],
      ['shooty', { atk:'mek-flashgitz', turn:{ me:{ mode:'both', shoot:true, fight:true, charge:true } } }, 'Both']]){
      if(!armies.some(x => x.id === L0) || !await page.evaluate(([L0, u]) => !!armyById(L0).units.find(x => x.id === u), [L0, st0.atk])){ fail('damage-lines', L0, label, 'the unit is not in the data'); continue; }
      await page.evaluate(([L0, st0]) => { hideSheet(); sess.dmg = { [L0]:Object.assign({ turn:{ me:dmModeTurn('shoot') }, fold:{ nc:true, outs:true, more:true, left:true } }, st0) }; go({ s:'damage', army:L0 }); scrollTo(0, 0); }, [L0, st0]);
      await settled();
      const top = await page.evaluate(dmLines);
      await page.evaluate(async () => { scrollTo(0, 900); await new Promise(f => requestAnimationFrame(() => requestAnimationFrame(f))); dmStick(); await new Promise(f => requestAnimationFrame(f)); });
      const bad = top.concat((await page.evaluate(dmLines)).map(x => 'pinned: ' + x)); await page.evaluate(() => scrollTo(0, 0));
      if(bad.length) fail('damage-lines', L0, label, bad.slice(0, 6).join(' | '));
    }
    // your unit changed: the facts about the attack (the closest target, a half-range band) reset, the toast names them, Undo puts them back
    await open();
    const rs = await page.evaluate(async A => { const st = dmState(), u = armyById(A).units.find(x => x.id !== st.atk && (x.ranged || []).length); if(!u) return null;
      st.facts.me = { theirs:{ closest:true } }; dmCh(st, 'shoot').val.half = 9; saveSession();
      const before = dmBefore(st, true), r = dmSetUnit(st, u.id); saveSession(); rerender(); dmChange(r.words, before, r.dropped);
      await new Promise(f => setTimeout(f, 300)); const said = $('#toast').innerText, gone = !(dmState().facts.me.theirs || {}).closest;
      document.querySelector('#toast [data-undo]').click(); await new Promise(f => setTimeout(f, 400));
      const s2 = dmState(); return { said, gone, back:!!(s2.facts.me.theirs || {}).closest && dmCh(s2, 'shoot').val.half === 9 && s2.atk === before.atk }; }, A);
    if(!rs || !/reset: .*closest target/.test(rs.said) || !rs.gone || !rs.back) fail('damage-reset', A, 'another unit', JSON.stringify(rs));
    // its toast: over the tab bar, on one line, covering no number of the card; a tap on its words reaches the tab bar below it
    const toast = await page.evaluate(async A => { const st = dmState(), u = armyById(A).units.find(x => x.id !== st.atk && (x.ranged || []).length); if(!u) return null;
      const before = dmBefore(st, true), r = dmSetUnit(st, u.id); saveSession(); rerender(); dmChange(r.words, before, r.dropped); await new Promise(f => setTimeout(f, 300));
      const tr = $('#toast').getBoundingClientRect(), a = $('#dmAns'), ar = a ? a.getBoundingClientRect() : null, over = [];
      if(ar && ar.bottom > tr.top + 1 && ar.top < tr.bottom - 1 && ar.right > tr.left && ar.left < tr.right) over.push('the card');
      if(tr.height > 48) over.push('two lines');
      const tm = $('#toast .tm').getBoundingClientRect(), below = document.elementFromPoint(tm.left + 4, tm.top + tm.height / 2);
      if(!below || !below.closest('#bbar')) over.push('the tab bar\'s taps');
      document.querySelector('#toast [data-undo]').click(); await new Promise(f => setTimeout(f, 300)); return over; }, A);
    if(toast && toast.length) fail('damage-toast', A, 'a unit picked', 'the toast covers ' + toast.join(', '));
    // the target's wheels: six spinbuttons a thumb wide, the value in the middle row (role, aria-valuenow and its words); the arrow keys
    // and the mouse wheel change the value once the column stops, and the answer with it; the screen is redrawn around the wheels (the
    // same nodes) and the page stays where it was
    await open();
    const wh = await page.evaluate(() => [...document.querySelectorAll('#dmTgt .dwv[role="spinbutton"]')].map(e => { const r = e.getBoundingClientRect(); e._seen = 1; return [e.dataset.wh, Math.round(r.width), Math.round(r.height), e.getAttribute('aria-valuetext'), e.getAttribute('aria-label'), Math.round(e.scrollTop)]; }));
    const wantTxt = ['5', '4', '3+', '2', '–', '–'];
    if(wh.length !== 6 || wh.some((x, i) => x[1] < 40 || x[2] < 100 || x[3] !== wantTxt[i] || !x[4])) fail('damage-wheels', A, 'the target', JSON.stringify(wh));
    const y0 = await page.evaluate(() => { scrollTo(0, 40); return scrollY; });
    await page.focus('[data-wh="tg:n"]'); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(1400);
    const kb = await page.evaluate(() => ({ n:dmTypedVals(dmState()).n, kept:document.querySelector('[data-wh="tg:n"]')._seen === 1, now:document.querySelector('[data-wh="tg:n"]').getAttribute('aria-valuenow'), ctx:$('#dmAns .dmctx').textContent, y:scrollY }));
    if(kb.n !== 6 || !kb.kept || kb.now !== '5' || !/→ 6 × T4/.test(kb.ctx) || Math.abs(kb.y - y0) > 1) fail('damage-wheels', A, 'Models: the arrow key up', JSON.stringify(kb));
    const box = await page.evaluate(() => { const r = document.querySelector('[data-wh="tg:T"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await page.mouse.move(box[0], box[1]); await page.mouse.wheel(0, 80); await page.waitForTimeout(1600);
    const mw = await page.evaluate(() => ({ T:dmTypedVals(dmState()).T, txt:document.querySelector('[data-wh="tg:T"]').getAttribute('aria-valuetext'), kept:document.querySelector('[data-wh="tg:n"]')._seen === 1 }));
    if(!(mw.T > 4) || mw.txt !== String(mw.T) || !mw.kept) fail('damage-wheels', A, 'T: the mouse wheel', JSON.stringify(mw));
    // its two boxes: the benefit of cover and -1 Damage, pressed, counted (the card says so), the wheels kept
    await page.click('[data-dmtt="cover"]'); await page.waitForTimeout(600);
    const tt = await page.evaluate(() => ({ cover:dmTypedVals(dmState()).cover, pressed:document.querySelector('[data-dmtt="cover"]').getAttribute('aria-pressed'), ctx:$('#dmAns .dmctx').textContent, kept:document.querySelector('[data-wh="tg:n"]')._seen === 1 }));
    if(!tt.cover || tt.pressed !== 'true' || !/cover/.test(tt.ctx) || !tt.kept) fail('damage-wheels', A, 'Benefit of cover', JSON.stringify(tt));
    // a group added to the target (a Leader): its own six wheels, CHARACTER ticked, Precision offered; ticked, counted (the card says so,
    // with the Leader's fate); the page no wider than the phone; removed, the target as before
    await page.evaluate(() => document.querySelector('[data-dmgadd]').click()); await page.waitForTimeout(600);
    const gr = await page.evaluate(() => ({ n:document.querySelectorAll('#dmTgt .dwv[role="spinbutton"]').length, lead:!!document.querySelector('[data-dmgch="0"][aria-pressed="true"]'), prec:!!document.querySelector('[data-dmtt="prec"]'),
      wide:document.documentElement.scrollWidth - innerWidth, ctx:$('#dmAns .dmctx').textContent }));
    if(gr.n !== 12 || !gr.lead || !gr.prec || gr.wide > 0 || !/\(CHARACTER\)/.test(gr.ctx)) fail('damage-groups', A, 'a group added', JSON.stringify(gr));
    await page.evaluate(() => document.querySelector('[data-dmtt="prec"]').click()); await settled();
    const pr = await page.evaluate(() => ({ ctx:$('#dmAns .dmctx').textContent, sub:$('#dmAns .dmbig small').textContent, pressed:document.querySelector('[data-dmtt="prec"]').getAttribute('aria-pressed'), wide:document.documentElement.scrollWidth - innerWidth }));
    if(!/\[PRECISION\]/.test(pr.ctx) || !/Leader destroyed in/.test(pr.sub) || pr.pressed !== 'true' || pr.wide > 0) fail('damage-groups', A, 'Precision', JSON.stringify(pr));
    await page.evaluate(() => document.querySelector('[data-dmgrm="0"]').click()); await page.waitForTimeout(600);
    const rm = await page.evaluate(() => ({ n:document.querySelectorAll('#dmTgt .dwv[role="spinbutton"]').length, prec:!!document.querySelector('[data-dmtt="prec"]'), more:dmTypedVals(dmState()).more.length }));
    if(rm.n !== 6 || rm.prec || rm.more) fail('damage-groups', A, 'the group removed', JSON.stringify(rm));
    // the custom modifiers, folded under one row that says how many are ticked: +1 to Hit rolls ticked, said there and as a chip
    await page.evaluate(() => { const d = document.querySelector('#dmList .dmcust'); d.scrollIntoView({ block:'center' }); d.querySelector('summary').click(); }); await settled(); await page.waitForTimeout(300);
    await page.click('[data-dmlv="r:u:hit:1"]'); await settled();
    const md = await page.evaluate(() => ({ sum:document.querySelector('#dmList .dmcust > summary').textContent, chip:[...document.querySelectorAll('#dmAns .dmchip')].map(c => c.textContent).join(' | ') }));
    if(!/Custom modifiers · 1 ticked/.test(md.sum) || !/Custom: \+1 to Hit rolls/.test(md.chip)) fail('damage-modifiers', A, '+1 to Hit rolls', JSON.stringify(md));
    // the models left of your unit: one wheel for each models line, folded; one fewer said in its row
    const many = await page.evaluate(() => { for(const u of armyById(WH_DATA.armies[0].id).units) if(u.models.length > 1 && (u.ranged || []).length) return u.id; return null; });
    if(many){ await open('', [A, many], { fold:{ left:true } });
      const lw = await page.evaluate(() => ({ n:document.querySelectorAll('#dmLeft .dwv[role="spinbutton"]').length, lines:dmPair(dmState()).au.models.length, sum:document.querySelector('#dmLeft > summary').textContent }));
      const last = '[data-wh="left:' + (lw.lines - 1) + '"]';
      await page.focus(last); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(1400);
      const lw2 = await page.evaluate(last => ({ sum:document.querySelector('#dmLeft > summary').textContent, left:JSON.stringify(dmState().left), open:document.querySelector('#dmLeft').open }), last);
      if(lw.n !== lw.lines || !/Models left · all \d+/.test(lw.sum) || !/Models left · \d+ of \d+/.test(lw2.sum) || !lw2.open) fail('damage-models-left', A, many, JSON.stringify([lw, lw2])); }
    // no empty band under the pinned card at any scroll position: just below it there is always some of the screen's content
    await open();
    const gaps = await page.evaluate(async () => { const out = [], H = document.documentElement.scrollHeight - innerHeight;
      for(let y = 0; y <= Math.min(H, 2400); y += 15){ scrollTo(0, y); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const pin = $('#dmPin'); if(!pin || pin.hidden) continue;
        const b = pin.getBoundingClientRect().bottom, x = innerWidth / 2; let hit = false;
        for(let dy = 2; dy <= 72 && !hit; dy += 6){ const e = document.elementFromPoint(x, b + dy); hit = !!(e && e.closest('#dmAns, #dmList, .dmtg, .dmsen, .dmpin')); }
        if(!hit) out.push(y); }
      scrollTo(0, 0); return out; });
    if(gaps.length) fail('damage-no-gap', A, 'scrollY ' + gaps.slice(0, 8).join(', '), 'an empty band of over 70px under the pinned card');

    // ---- half range: a band tapped stays selected and the profiles picked stay (Mek + Flash Gitz, the Snazzgun opening on Dakka;
    // and the first units of the other lists with bands); the weapons and their profiles come before the bands ----
    const bandUnits = await page.evaluate(() => { const out = [['shooty', 'mek-flashgitz']], seen = new Set(['shooty']);
      for(const L of WH_DATA.armies) for(const u of L.units){ if(seen.has(L.id) || !(u.ranged || []).length) continue;
        const st = { dir:'me', ph:'shooting', on:{}, off:{}, pick:{}, man:{}, val:{} };
        let M = null; try { M = inArmy(L, () => dmCalc(st, L, u, {}, 'ranged')); } catch(e){}
        if(M && M.bands && M.bands.opts.length > 1){ out.push([L.id, u.id]); seen.add(L.id); } }
      return out.slice(0, 4); });
    const prof = () => page.evaluate(() => [...document.querySelectorAll('#dmList .dmprofs .dmpp')].map(e => e.dataset.dmlv + '=' + e.getAttribute('aria-pressed')).join(' '));
    const bandIds = () => page.evaluate(() => [...document.querySelectorAll('#dmList .dmbands [data-dmlv]')].map(e => e.dataset.dmlv));
    const tapBands = async (at, tag) => {
      for(const id of await bandIds()){
        const p0 = await prof(), b0 = await bandIds();
        const there = await page.evaluate(id => { const e = [...document.querySelectorAll('#dmList .dmbands [data-dmlv]')].find(x => x.dataset.dmlv === id); if(e) e.scrollIntoView({ block:'center' }); return !!e; }, id);
        if(!there){ fail('damage-band-stays', at[0], at[1] + tag + ' · ' + id, 'the band is gone: ' + b0.join()); break; }
        await page.waitForTimeout(400);
        await page.click('#dmList .dmbands [data-dmlv="' + id + '"] .ck');
        await settled();
        const on = await page.evaluate(() => [...document.querySelectorAll('#dmList .dmbands [data-dmlv]')].filter(e => e.getAttribute('aria-pressed') === 'true').map(e => e.dataset.dmlv));
        const p1 = await prof(), b1 = await bandIds();
        if(on.join() !== id || p1 !== p0 || b1.join() !== b0.join()) fail('damage-band-stays', at[0], at[1] + tag + ' · ' + id, 'selected ' + on.join() + '; profiles ' + p0 + ' → ' + p1 + '; bands ' + b0.join() + ' → ' + b1.join()); } };
    for(const at of bandUnits){
      await open('shoot', at);
      const order = await page.evaluate(() => { const b = document.querySelector('#dmList .dmbands'), w = [...document.querySelectorAll('#dmList .dmh3')].find(h => /weapons/.test(h.textContent));
        return !b ? 'no bands' : !w ? 'no weapons' : w.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? '' : 'the bands come before the weapons'; });
      if(order) fail('damage-band-order', at[0], at[1], order);
      await tapBands(at, '');
    }
    // with Dakka! Dakka! Dakka! ticked (+3" range while riled up): a band of its own; without it, none
    {
      const at = ['shooty', 'mek-flashgitz'], kid = '#dmList [data-dmlv^="r:m:Dakka! Dakka! Dakka!"]';
      await open('shoot', at);
      const before = (await bandIds()).join();
      await page.evaluate(k => document.querySelector(k).scrollIntoView({ block:'center' }), kid); await page.waitForTimeout(400);
      await page.click(kid); await settled();
      const after = (await bandIds()).join();
      if(before !== 'b:0,b:12' || after !== 'b:0,b:13.5,b:12') fail('damage-band-ticked', at[0], at[1], 'bands ' + before + ' unticked, ' + after + ' with Dakka! Dakka! Dakka! ticked');
      await tapBands(at, ' (Dakka! Dakka! Dakka! ticked)');
    }
    // a fact's box with the rules it switches on (ticked in their groups): none ticked, empty; some, partly; all, ticked (one rule: Riled up → Dakka!
    // Dakka! Dakka!; two: the objective → Finderz Keeperz, Wreckin’ and Lootin’)
    {
      const at = ['shooty', 'mek-flashgitz'];
      const mark = f => page.evaluate(f => { const e = document.querySelector('#dmList [data-dmlv="' + f + '"]'); return e.classList.contains('part') ? 'part' : e.getAttribute('aria-pressed') === 'true' ? 'on' : 'off'; }, f);
      // (the boxes a fact ticks are in their groups, each in one: tapped there)
      const KIDS = { 'f:mine:riled':['Dakka! Dakka! Dakka!'], 'f:pair:objective':['Wreckin’ and Lootin’', 'Finderz Keeperz'] };
      const kidTap = async (f, i) => { const sel = '#dmList [data-dmgrp] .dmrh > [data-dmlv^="r:m:' + KIDS[f][i] + '|"]';
        await page.evaluate(s => document.querySelector(s).scrollIntoView({ block:'center' }), sel); await page.waitForTimeout(400);
        await page.locator(sel).first().click(); await settled(); };
      for(const [f, n] of [['f:mine:riled', 1], ['f:pair:objective', 2]]){
        await open('shoot', at);
        const seen = [await mark(f)], want = n === 1 ? ['off', 'on', 'off'] : ['off', 'part', 'on', 'part', 'off'];
        for(const i of n === 1 ? [0, 0] : [0, 1, 0, 1]){ await kidTap(f, i); seen.push(await mark(f)); }
        if(seen.join() !== want.join()) fail('damage-fact-kids', at[0], f, 'its box ' + seen.join(' → ') + ', not ' + want.join(' → ')); }
    }
    // each profile to pick shows its own characteristics (RNG for a ranged one) and keywords, inside the screen
    {
      await open('shoot', ['shooty', 'mek-flashgitz']);
      const ps = await page.evaluate(() => [...document.querySelectorAll('#dmList .dmprofs .dmpp')].map(e => { const r = e.getBoundingClientRect();
        return { t:e.querySelector('b').textContent, cells:[...e.querySelectorAll('.dmwst > span > i')].map(i => i.textContent).join(' '), kw:!!e.querySelector('.dmkw'), out:r.right > innerWidth + 0.5 || r.left < -0.5 }; }));
      const bad = ps.filter(p => p.cells !== 'RNG A BS S AP D' || !p.kw || p.out);
      if(ps.length !== 3 || bad.length) fail('damage-profile-stats', 'shooty', 'Snazzgun', JSON.stringify(ps.length !== 3 ? ps : bad));
    }
  }
  // ---- the list import: the sheet (a file picker for .json, a paste box, Import) fits the phone; the export chosen as a file opens
  // as a list exactly like the app's own (every screen's text the same but its source line and its Remove), kept over a reload;
  // a refused one lists every item import.js names, one per line, and adds nothing; Remove asks on the page, then the list is gone ----
  {
    const L = 'import';
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await page.reload(); await page.evaluate(() => document.fonts.ready);
    const fit = () => page.evaluate(() => { const r = $('#sheet').getBoundingClientRect(), bad = [];
      if(document.documentElement.scrollWidth > innerWidth) bad.push('the page is wider than the phone');
      for(const e of $('#sheetIn').querySelectorAll('*')){ const b = e.getBoundingClientRect(); if(b.width && (b.right > r.right + 0.5 || b.left < r.left - 0.5)) { bad.push((e.className || e.tagName) + ' wider than the sheet'); break; } }
      return bad; });
    await page.evaluate(() => { hideSheet(); go({ s:'home' }); });
    const row = await page.evaluate(() => { const b = document.querySelector('#view [data-import]'); const l = b && b.closest('.list'), last = [...document.querySelectorAll('#view [data-folder]')].pop();
      return !b ? 'no row' : !(last && last.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? 'not under the folders' : /Import a list from New Recruit/.test(b.textContent) ? '' : 'says ' + b.textContent; });
    if(row) fail('import-row', L, 'home', row);
    await page.waitForTimeout(400);   // (a tap right after a screen change is taken as a double tap and dropped)
    await page.click('#view [data-import]'); await page.waitForTimeout(300);
    const sh = await page.evaluate(() => { const f = $('#sheetIn input[type=file]'); return { open:!$('#sheetHost').hidden, accept:f ? f.accept : null, box:!!$('#sheetIn textarea'), go:!!$('#sheetIn [data-impgo]'), title:$('#sheetTitle').textContent }; });
    if(!sh.open || !/\.json/.test(sh.accept || '') || !sh.box || !sh.go || sh.title !== 'Import a list') fail('import-sheet', L, 'the sheet', JSON.stringify(sh));
    for(const b of await fit()) fail('import-sheet', L, 'the sheet', b);
    // refused: pasted, every message one line, nothing kept
    const want = await page.evaluate(bad => WH_IMPORT.resolve(bad, WH_DATA).errors, IMPORT_BAD);
    await page.fill('#impText', JSON.stringify(IMPORT_BAD)); await page.click('#sheetIn [data-impgo]'); await page.waitForTimeout(300);
    const no = await page.evaluate(() => ({ lines:[...document.querySelectorAll('#impOut li')].map(x => x.textContent), kept:localStorage.getItem('wh-imported'), n:WH_DATA.armies.length, open:!$('#sheetHost').hidden }));
    if(JSON.stringify(no.lines.map(x => x.toLowerCase())) !== JSON.stringify(want.map(x => x.toLowerCase())) || no.kept || !no.open || no.n !== armies.length) fail('import-refused', L, 'a unit renamed', JSON.stringify([no, want]));
    for(const b of await fit()) fail('import-refused', L, 'the sheet', b);
    // imported from the file: opens the list
    await page.waitForTimeout(400); await page.setInputFiles('#impFile', IMPORT_FILE); await page.waitForTimeout(600);
    const yes = await page.evaluate(() => ({ cur:plain(cur), kept:JSON.parse(localStorage.getItem('wh-imported') || '[]').map(x => x.id), sheet:$('#sheetHost').hidden }));
    const id = yes.cur.army;
    if(yes.cur.s !== 'army' || !/^import-/.test(id || '') || yes.kept.join() !== id || !yes.sheet) fail('import-opens', L, '6 bigs', JSON.stringify(yes));
    // kept over a reload, under its faction in All lists (and first by newest: imported today), and every screen as the app's own list's
    await page.reload(); await page.evaluate(() => document.fonts.ready);
    const same = await page.evaluate(([id, orig]) => { const out = [], A = armyById(id); if(!A) return ['not there after a reload'];
      const txt = (s, a, x) => { hideSheet(); go(Object.assign({ s, army:a }, x || {})); document.querySelectorAll('#view details').forEach(d => d.open = true); return $('#view').innerText; };
      const drop = (t, imp) => imp ? t.replace(/New Recruit, imported [^\n]*/, '').replace(/\nON THIS PHONE[\s\S]*$/i, '') : t.replace(/New Recruit, exported [^\n]*/, '');
      for(const s of ['army', 'pregame', 'checklist', 'units', 'strats', 'ranged', 'melee', 'abilities', 'rules', 'bases']) if(drop(txt(s, orig), false).trim() !== drop(txt(s, id), true).trim()) out.push(s + ' differs');
      for(const u of armyById(orig).units) if(txt('unit', orig, { unit:u.id }) !== txt('unit', id, { unit:u.id })) out.push('unit ' + u.id + ' differs');
      store.set('wh-home-sort', 'new'); hideSheet(); go({ s:'lists' });
      const first = (document.querySelector('#view .arow') || {}).dataset; if(!first || first.army !== id) out.push('not first in All lists by newest');
      store.set('wh-home-sort', 'faction'); hideSheet(); go({ s:'lists' });
      const rows = [...document.querySelectorAll('#view .arow')].filter(r => r.dataset.army === id || r.dataset.army === orig).map(r => r.closest('.list').previousElementSibling.textContent);
      if(rows.length !== 2 || rows[0] !== rows[1]) out.push('home rows: ' + rows.join(' | '));
      return out; }, [id, '6-bigs']);
    for(const x of same) fail('import-same', L, '6 bigs', x);
    // Remove: a confirm on the page with both buttons in sight; Keep it leaves it; Remove takes it off the phone
    await page.evaluate(id => { hideSheet(); go({ s:'pregame', army:id }); }, id);
    await page.waitForTimeout(400); await page.locator('[data-imprm]').scrollIntoViewIfNeeded(); await page.click('[data-imprm]'); await page.waitForTimeout(300);
    const conf = await page.evaluate(() => { const bb = $('#bbar').hidden ? innerHeight : $('#bbar').getBoundingClientRect().top;
      return ['[data-imprmyes]', '[data-imprmno]'].map(q => { const e = document.querySelector(q); if(!e) return q + ' missing'; const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= bb + 0.5 ? '' : q + ' not in sight (' + Math.round(r.top) + '–' + Math.round(r.bottom) + ', tab bar at ' + Math.round(bb) + ')'; }).filter(Boolean); });
    for(const c of conf) fail('import-remove', L, 'the confirm', c);
    await page.click('[data-imprmno]'); await page.waitForTimeout(200);
    const kept = await page.evaluate(id => !!armyById(id) && !!document.querySelector('[data-imprm]'), id);
    if(!kept) fail('import-remove', L, 'Keep it', 'the list or its Remove is gone');
    // (with a per-battle tick and a Phase checklist box kept for it: Remove clears both)
    await page.evaluate(id => { localStorage.setItem('wh-used-' + id, '["x"]'); localStorage.setItem('wh-check-' + id, '["x"]'); }, id);
    await page.click('[data-imprm]'); await page.waitForTimeout(200); await page.click('[data-imprmyes]'); await page.waitForTimeout(400);
    const gone = await page.evaluate(id => ({ s:cur.s, there:!!armyById(id), kept:localStorage.getItem('wh-imported'), n:WH_DATA.armies.length, ticks:[localStorage.getItem('wh-used-' + id), localStorage.getItem('wh-check-' + id)] }), id);
    if(gone.s !== 'home' || gone.there || gone.kept !== '[]' || gone.n !== armies.length || gone.ticks.some(x => x !== null)) fail('import-remove', L, 'Remove', JSON.stringify(gone));
    // a kept export that cannot be read: the app starts, lists it as out of date with its Remove
    await page.evaluate(() => localStorage.setItem('wh-imported', JSON.stringify([{ id:'import-broken', name:'Broken', date:'1 Jan 2026', json:{ roster:{ forces:[{ catalogueId:'x', selections:[null] }] } } }])));
    await page.reload(); await page.evaluate(() => document.fonts.ready);
    const st = await page.evaluate(() => { hideSheet(); go({ s:'home' }); const r = document.querySelector('#view [data-impstale="import-broken"]'); return { row:!!r, n:WH_DATA.armies.length }; });
    if(!st.row || st.n !== armies.length) fail('import-stale', L, 'a kept export that cannot be read', JSON.stringify(st));
    await page.waitForTimeout(400); await page.click('#view [data-impstale="import-broken"]'); await page.waitForTimeout(450);   // (a tap right after the sheet opens is dropped)
    await page.click('#sheetIn [data-imprm]'); await page.waitForTimeout(200); await page.click('#sheetIn [data-imprmyes]'); await page.waitForTimeout(300);
    const st2 = await page.evaluate(() => ({ row:!!document.querySelector('#view [data-impstale]'), kept:localStorage.getItem('wh-imported') }));
    if(st2.row || st2.kept !== '[]') fail('import-stale', L, 'Remove', JSON.stringify(st2));
    counts[L] = { screens:6, links:0 };
  }
  if(pageErrors.length) fail('page-errors', '', '', pageErrors.join(' | '));

  if(main) writeJSON(path.join(ROOT, 'verify/out/helpers.json'), [...helpers.values()].map(h => Object.assign(h, { refs:[...h.refs].sort() })).sort((x, y) => x.text.localeCompare(y.text)));
  writeJSON(path.join(ROOT, 'verify/out/render' + (main ? '' : '-' + W) + '.json'), { width:W, checked:counts, helpers:helpers.size, failures });
  console.log('render at ' + W + 'px: ' + Object.values(counts).reduce((t, c) => t + c.screens, 0) + ' screens and popups, ' + helpers.size + ' helper texts, ' + failures.length + ' failures');
  for(const f of failures.slice(0, 60)) console.log('  ' + f.check + ' · ' + f.army + ' · ' + f.where + ' · ' + f.detail);
  await browser.close(); site.close();
  process.exit(failures.length ? 1 : 0);
})();
