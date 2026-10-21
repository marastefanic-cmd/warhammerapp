// Renders every screen and popup of every army in a headless browser and writes:
// - verify/out/snapshots/<army>.txt: the plain text of each, with every fold open (run.js compares
//   it with the committed verify/snapshots/ copy: no screen changes without someone seeing it)
// - verify/out/helpers.json: every sentence the app writes itself (footnotes, "When targeted",
//   reminders, use lines, tags, notes), with where it shows and what it cites
// - verify/out/render.json: the screen-level checks (failures fail the build)
// Usage: node verify/render.js   (needs a built index.html; NODE_PATH=$(npm root -g) for playwright)
// VERIFY_WIDTH=320 checks a small phone (snapshots and helpers come from the run at 390).
const path = require('path'), fs = require('fs');
const { ROOT, normText, serve, writeJSON, sha, loadData } = require('./lib');
const { chromium } = require('playwright');

// app-written text, by where the app puts it
const HELPER_SEL = ['.mod', '.def', '.rem', '.use', '.dsl', '.varc', '.note', '.tg', '.cr', '.tq', '.wn small', '.lbn',
  '.mods.all > .il', '.who', '.aw', '.abt', '.dl > div', '.pxm', '.pfl', '.army-sub', '.sec-h .c', '.usedby', '.wj', '.mlt'];

(async () => {
  const site = await serve(ROOT);
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const W = +(process.env.VERIFY_WIDTH || 390);   // run.js checks 390 (snapshots) and 320 (layout)
  const main = W === 390;
  const page = await (await browser.newContext({ viewport:{ width:W, height:844 } })).newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  // only the app's own files and its web fonts (the layout checks need the real fonts' widths)
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());   // the app ships its own fonts
  // verified.js is the result of the last gate run (this one writes it when it ends): a fixed stand-in, as if
  // this build passed, so the screens and their snapshots do not depend on how the previous run went
  const build = sha(['app.html', 'data.js', 'calc.js', 'ask.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('')).slice(0, 10);
  const stub = { ok:true, build, data:loadData().version, date:'(date of the check)', checks:[{ label:'(checks)', detail:'(as listed by verify/run.js)' }], sources:[{ label:'(sources)', detail:'(as listed by verify/run.js)' }] };
  await page.route(/\/verified\.js(\?|$)/, r => r.fulfill({ contentType:'application/javascript', body:'window.WH_VERIFIED = ' + JSON.stringify(stub) + ';' }));
  await page.goto(site.url + 'index.html');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();

  const failures = [], helpers = new Map(), counts = {};
  const fail = (check, army, where, detail) => failures.push({ check, army, where, detail });
  const armies = await page.evaluate(() => WH_DATA.armies.map(a => ({ id:a.id, units:a.units.map(u => u.id) })));
  // a fresh folder each run, so a list that left the app leaves no old snapshot behind
  if(main) fs.rmSync(path.join(ROOT, 'verify/out/snapshots'), { recursive:true, force:true });
  fs.mkdirSync(path.join(ROOT, 'verify/out/snapshots'), { recursive:true });

  for(const a of armies){
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
          bigIcons:[...document.querySelectorAll('#top svg, #view svg, #sheetIn svg, #subbar svg, #bbar svg')].filter(x => x.getBoundingClientRect().width > 40 || x.getBoundingClientRect().height > 40).map(x => (x.getAttribute('class') || '') + ' ' + ((x.querySelector('use') || {}).getAttribute ? x.querySelector('use').getAttribute('href') : '') + ' in .' + x.parentElement.className).slice(0, 3), tabs:document.querySelectorAll('#bbar .tabs button').length === 5 };
      }, [String(fn), HELPER_SEL, !!folded]);
      if(r.overflow > 0) fail('no-sideways-scroll', a.id, label, 'the page is ' + r.overflow + 'px wider than the phone');
      if(r.bigIcons.length) fail('icon-size', a.id, label, 'icons drawn over 40px (no size set): ' + r.bigIcons.join(', '));
      if(label !== 'home' && label !== 'settings' && !r.tabs) fail('tabs', a.id, label, 'no tab bar');
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
    // each list is checked as the one you opened (yours), not as a look at another list's opponent
    await page.evaluate(id => { sess.mine = id; sess.peekD = null; }, a.id);
    if(a === armies[0]){ await take('settings', `() => { hideSheet(); go({ s:'settings' }); }`); await take('home', `() => { hideSheet(); go({ s:'home' }); }`); }
    for(const s of ['army','pregame','units','ranged','melee','abilities','rules','bases']) await screen(s);
    // the damage calculator, against the next list: this list's first unit with ranged weapons shooting its first unit, and its first
    // unit with melee weapons charging and fighting it, with the fight back; each taken once every effect is worked out (the list's
    // order and every number settled: the background work is seeded, so the text is the same every run)
    const vs = armies[(armies.indexOf(a) + 1) % armies.length].id;
    for(const ph of ['shooting', 'fight']){
      await page.evaluate(([id, vs, ph]) => { hideSheet(); store.set('wh-opp-' + id, vs); sess.dmg = {};
        const A = armyById(id), B = armyById(vs), kind = ph === 'fight' ? 'melee' : 'ranged', u = A.units.find(x => (x[kind] || []).length) || A.units[0];
        sess.dmg[id] = Object.assign({ dir:'me', atk:u.id, tArmy:vs, tgt:B.units[0].id }, ph === 'fight' ? { turn:{ me:{ charge:true, fight:true, back:true } }, step:{ me:'fight' } } : {});
        go({ s:'damage', army:id }); }, [a.id, vs, ph]);
      await page.waitForFunction(() => !dmBusy() && !document.querySelector('#dmList .fxv.wait, #dmList .fxv.est, #dmAns.prov'), null, { timeout:120000, polling:50 });
      await take('damage ' + ph, `() => {}`);
    }
    await screen('strats', { folded:true });   // every stratagem folded: its one-line gist, timing and users
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

    // ---- screen-level checks ----
    const res = await page.evaluate(armyId => {
      const out = [], A = WH_DATA.armies.find(x => x.id === armyId);
      hideSheet(); go({ s:'army', army:armyId });
      const onceOf = ab => { const m = /once per (battle round|battle|phase|turn)(, per (army|unit))?/i.exec((ab.tag || '') + ' ' + (ab.text || '')); return m && m[0].toLowerCase(); };
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
      }
      // the damage calculator, for every unit of this list as the attacker (every rule ticked) and as the target:
      // - the target has as many models as the unit (dmModels)
      // - an InSv marked * (against ranged attacks) is not used against melee attacks
      // - a value New Recruit already includes (a weapon's `from`) is never added again by the same rule
      // - a rule for one weapon or one model of an attached unit reaches only that weapon or model
      const foe = A.units[0];
      for(const u of A.units){
        for(const kind of ['ranged', 'melee']){
          const rows = dmModels(u, kind);
          if(rows.reduce((t, r) => t + r.count, 0) !== modelCount(u)) out.push(['damage-models', u.id, kind + ': ' + rows.reduce((t, r) => t + r.count, 0) + ' models, the unit has ' + modelCount(u)]);
          if(kind === 'melee' && rows.some(r => r.star && r.InSv < 7)) out.push(['damage-insv', u.id, 'an InSv marked * (ranged attacks) is used against melee attacks']);
          if(!(u[kind] || []).length) continue;
          const st = { dir:'me', ph:kind === 'ranged' ? 'shooting' : 'fight', off:{}, pick:{}, on:{}, man:{}, val:{}, dist:null };
          for(const r of dmCalc(st, A, A, u, foe, kind).rules) st.on[r.k] = true;
          for(const it of weaponItems(u[kind])) st.off[kind + ':' + itemName(it) + '|' + (it.who || '')] = false;
          const c = dmCalc(st, A, A, u, foe, kind);
          c.input.groups.forEach((g, i) => {
            const w = c.gOf[i].w, it = c.gOf[i].it;
            if(g.from !== w.from) out.push(['damage-bonus-twice', u.id, g.name + ': the weapon’s pre-applied values are not passed to the calculator']);
            for(const x of c.R.groups[i].applied) if([].concat((w.from || {})[x.key] || []).includes(x.from)) out.push(['damage-bonus-twice', u.id, g.name + ': ' + x.key + ' from ' + x.from + ' added again']);
            for(const m of g.mods){ const r = c.rules.find(x => x.on && x.m.from === m.from); if(!r) continue;
              if(r.m.weapon && r.m.weapon !== itemName(it)) out.push(['damage-mod-scope', u.id, m.from + ' (for ' + r.m.weapon + ') reaches ' + g.name]);
              if(r.m.who && r.m.who !== (it.who || '')) out.push(['damage-mod-scope', u.id, m.from + ' (for ' + r.m.who + ') reaches ' + g.name]); }
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
        const titles = [...document.querySelectorAll('#qres .rg:not(.oth) .res b')].map(b => b.textContent.trim().toLowerCase());   // this list's, not the opponent's
        const n = name.toLowerCase();   // a weapon with profiles is found as "Gutrippa – Hunter"
        if(!titles.some(t => t === n || t.startsWith(n + ' – '))) out.push(['search-finds', kind, name]);
      }
      // the other list of the game: Find searches it too, after this list's and marked whose (the next list's first unit is under
      // "Their units" and opens in that list), and its Overview, opened from this list, is "Their list"
      const B = WH_DATA.armies[(WH_DATA.armies.findIndex(x => x.id === armyId) + 1) % WH_DATA.armies.length], wasOpp = store.get('wh-opp-' + armyId);
      if(B.id !== armyId){
        store.set('wh-opp-' + armyId, B.id);
        query[armyId] = B.units[0].name; moreShown.clear(); renderFinder();
        if(![...document.querySelectorAll('#qres .rg.oth .res[data-their="' + B.id + '"][data-unit="' + B.units[0].id + '"] b')].some(b => b.textContent.trim() === B.units[0].name))
          out.push(['search-their', armyId, B.units[0].name + ' (' + B.id + ') is not under their units']);
        query[armyId] = ''; renderFinder();
        go({ s:'pregame', army:B.id });
        const head = (document.querySelector('#view .sec-h h2') || {}).textContent || '';
        if(head !== 'Their list') out.push(['their-list', armyId, B.id + '’s Overview opened from this list is headed “' + head + '”']);
        go({ s:'army', army:armyId });
        store.set('wh-opp-' + armyId, wasOpp);
      }
      query[armyId] = ''; renderFinder();
      return out;
    }, a.id);
    for(const [check, where, detail] of res) fail(check, a.id, where, detail);

    if(main) fs.writeFileSync(path.join(ROOT, 'verify/out/snapshots', a.id + '.txt'), snap.join('\n\n') + '\n');
    counts[a.id] = { screens:snap.length, links:links.size };
  }
  // ---- the Damage tab under a finger (each width): the first list's first unit with ranged weapons shooting the next list's
  // first unit, its turn shoot → charge → fight → fight back ----
  {
    const A = armies[0].id;
    let B = armies[1].id;
    const open = async () => { await page.evaluate(([A, B]) => { hideSheet(); store.set('wh-opp-' + A, B); sess.mine = A; sess.dmg = {};
      const L = armyById(A), u = L.units.find(x => (x.ranged || []).length) || L.units[0];
      sess.dmg[A] = { dir:'me', atk:u.id, tArmy:B, tgt:armyById(B).units[0].id, turn:{ me:{ shoot:true, charge:true, fight:true, back:true } }, step:{ me:'shoot' } };
      go({ s:'damage', army:A }); scrollTo(0, 0); }, [A, B]);
      await page.waitForFunction(() => !dmBusy() && !document.querySelector('#dmList .fxv.wait, #dmList .fxv.est, #dmAns.prov'), null, { timeout:120000, polling:50 }); await page.waitForTimeout(300); };
    const where = () => page.evaluate(() => JSON.stringify([cur.s, cur.army, sess.dmg[cur.army] && sess.dmg[cur.army].atk, sess.dmg[cur.army] && sess.dmg[cur.army].tgt, sess.dmg[cur.army] && sess.dmg[cur.army].dir]));
    // a popup of the other list's rule, opened from the Damage tab, closed (its Close, then Escape): the same list and matchup
    // (against the first list after it whose unit has a rule of its own in the list)
    const foreign = () => page.evaluate(A => !![...document.querySelectorAll('#dmList [data-dmrule]')].find(x => x.dataset.dmrule.split('|')[1] !== A), A);
    for(const L of armies.slice(1)){ B = L.id; await open(); if(await foreign()) break; }
    const home = await where();
    for(const how of ['close', 'escape']){
      const ok = await page.evaluate(A => { const l = [...document.querySelectorAll('#dmList [data-dmrule]')].find(x => x.dataset.dmrule.split('|')[1] !== A); if(!l) return false; l.scrollIntoView({ block:'center' }); return true; }, A);
      if(!ok){ fail('damage-popup-stays', A, 'no rule of the other list in the list', ''); break; }
      await page.waitForTimeout(200);
      await page.evaluate(A => [...document.querySelectorAll('#dmList [data-dmrule]')].find(x => x.dataset.dmrule.split('|')[1] !== A).click(), A);
      await page.waitForTimeout(400);
      if(how === 'close') await page.evaluate(() => { const c = document.querySelector('#sheetIn [data-close], #sheet [data-close]'); if(c) c.click(); else closeSheet(); });
      else await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const now = await where();
      if(now !== home) fail('damage-popup-stays', A, 'closed with ' + how, 'the app moved from ' + home + ' to ' + now);
    }
    // a tap never moves the row under the finger: the same spot tapped twice, quickly, toggles the same row back
    B = armies[1].id; await open();
    const rows = await page.evaluate(() => [...document.querySelectorAll('#dmList .dmlv[data-dmlv]')].filter(e => e.getClientRects().length && !e.classList.contains('rad')).map(e => e.dataset.dmlv));
    for(const id of rows.slice(0, 6)){
      const pt = await page.evaluate(id => { const e = [...document.querySelectorAll('#dmList .dmlv[data-dmlv]')].find(x => x.dataset.dmlv === id); scrollTo(0, e.getBoundingClientRect().top + scrollY - 420); const r = e.getBoundingClientRect(); return [r.left + 30, r.top + 12, e.getAttribute('aria-pressed')]; }, id);
      await page.waitForTimeout(300);
      const under = () => page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y), r = e && e.closest('[data-dmlv]'); return r ? [r.dataset.dmlv, r.getAttribute('aria-pressed')] : null; }, pt);
      await page.mouse.click(pt[0], pt[1]); await page.waitForTimeout(120);
      const mid = await under();
      await page.mouse.click(pt[0], pt[1]); await page.waitForTimeout(1500);
      const end = await under();
      if(!mid || mid[0] !== id || !end || end[0] !== id || end[1] !== pt[2]) fail('damage-tap-twice', A, id, 'tapped twice at the same spot: ' + JSON.stringify([mid, end]) + ', was ' + pt[2]);
    }
    // the card and the strip show the same figure at every moment after a tap (the same games), and Undo reverts what its toast names
    await open();
    const sync = await page.evaluate(async () => { const r = [...document.querySelectorAll('#dmList .dmlv[data-dmlv]')].find(e => e.getClientRects().length && !e.classList.contains('rad')); if(!r) return [];
      r.click(); const seen = [];
      for(let i = 0; i < 30; i++){ await new Promise(f => setTimeout(f, 80)); const a = $('#dmAns .dmbig b'), b = document.querySelector('#dmStrip .dms.cur b'); seen.push((a ? a.textContent : '') + '/' + (b ? b.textContent : '')); }
      return [...new Set(seen)].filter(x => { const [a, b] = x.split('/'); return a !== b; }); });
    if(sync.length) fail('damage-card-strip', A, 'after a tap', 'the card and the strip differ: ' + sync.join(', '));
    const undo = await page.evaluate(async () => { const st = dmState(), t0 = JSON.stringify(st.turn[st.dir]);
      dmGoStep('charge'); await new Promise(f => setTimeout(f, 300)); const t1 = JSON.stringify(dmState().turn[dmState().dir]), said = $('#toast').innerText;
      // the toast covers no number: neither the card nor the strip, on one line
      const tr = $('#toast').getBoundingClientRect(), hit = ['#dmAns', '#dmStrip'].filter(q => { const e = $(q); if(!e) return false; const r = e.getBoundingClientRect(); return r.bottom > tr.top + 1 && r.top < tr.bottom - 1 && r.right > tr.left && r.left < tr.right; });
      if(hit.length || tr.height > 48) return { changed:true, back:true, said, over:hit.concat(tr.height > 48 ? ['two lines'] : []) };
      // a tap on the toast's words reaches the tab bar below it (only its Undo takes the tap)
      const tm = $('#toast .tm').getBoundingClientRect(), below = document.elementFromPoint(tm.left + 4, tm.top + tm.height / 2);
      if(!below || !below.closest('#bbar')) return { changed:true, back:true, said, over:['the tab bar\'s taps'] };
      document.querySelector('#toast [data-undo]').click(); await new Promise(f => setTimeout(f, 300));
      return { back:JSON.stringify(dmState().turn[dmState().dir]) === t0, changed:t1 !== t0, said }; });
    if(undo.over) fail('damage-toast', A, 'a step added', 'the toast covers ' + undo.over.join(', '));
    else if(!undo.changed || !undo.back || !/Charge/.test(undo.said)) fail('damage-undo', A, 'Charge, then Undo', JSON.stringify(undo));
    // a typed number typed slowly (keys 0.4 s apart) keeps every digit; an entry it cannot count is said under the field, and leaving
    // the field puts the counted value back
    await page.evaluate(A => { hideSheet(); sess.dmg = {}; const L = armyById(A), u = L.units.find(x => (x.ranged || []).length) || L.units[0];
      sess.dmg[A] = { dir:'me', atk:u.id, tArmy:'typed', typed:{ n:5, T:4, W:2, Sv:3 } }; go({ s:'damage', army:A }); scrollTo(0, 0); }, A);
    await page.waitForTimeout(800);
    await page.click('[data-dmtyped="n"]'); await page.waitForTimeout(150);
    await page.keyboard.press('1'); await page.waitForTimeout(400); await page.keyboard.press('2'); await page.waitForTimeout(700);
    const ty = await page.evaluate(() => ({ n:dmTypedVals(dmState()).n, field:document.querySelector('[data-dmtyped="n"]').value, focus:(document.activeElement || {}).dataset ? document.activeElement.dataset.dmtyped : '' }));
    if(ty.n !== 12 || ty.field !== '12' || ty.focus !== 'n') fail('damage-typed-slow', A, '"1", 0.4 s, "2"', JSON.stringify(ty));
    await page.keyboard.press('Tab'); await page.waitForTimeout(400);
    await page.click('[data-dmtyped="Sv"]'); await page.waitForTimeout(150); await page.keyboard.press('9'); await page.waitForTimeout(500);
    const hint = await page.evaluate(() => ({ shown:!$('#dmTyHint').hidden, sv:dmTypedVals(dmState()).Sv }));
    await page.keyboard.press('Tab'); await page.waitForTimeout(500);
    const back = await page.evaluate(() => ({ field:document.querySelector('[data-dmtyped="Sv"]').value, hint:$('#dmTyHint').hidden }));
    if(!hint.shown || hint.sv !== 3 || back.field !== '3+' || !back.hint) fail('damage-typed-hint', A, 'Save "9"', JSON.stringify([hint, back]));
    // too big an entry is put back as the hint says, not clamped (Models "101" leaves 12)
    await page.click('[data-dmtyped="n"]'); await page.waitForTimeout(150); await page.keyboard.press('Control+A');
    await page.keyboard.type('101', { delay:120 }); await page.waitForTimeout(500); await page.keyboard.press('Tab'); await page.waitForTimeout(500);
    const big = await page.evaluate(() => ({ n:dmTypedVals(dmState()).n, field:document.querySelector('[data-dmtyped="n"]').value }));
    if(big.n !== 12 || big.field !== '12') fail('damage-typed-big', A, 'Models "101", then leaving the field', JSON.stringify(big));
    // no empty band under the pinned card at any scroll position: just below it there is always some of the screen's content
    await open();
    const gaps = await page.evaluate(async () => { const out = [], H = document.documentElement.scrollHeight - innerHeight;
      for(let y = 0; y <= Math.min(H, 2400); y += 15){ scrollTo(0, y); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const pin = $('#dmPin'); if(!pin || pin.hidden) continue;
        const b = pin.getBoundingClientRect().bottom, x = innerWidth / 2; let hit = false;
        for(let dy = 2; dy <= 72 && !hit; dy += 6){ const e = document.elementFromPoint(x, b + dy); hit = !!(e && e.closest('#dmAns, #dmList, .dmty, .dmsent, .dmpin')); }
        if(!hit) out.push(y); }
      scrollTo(0, 0); return out; });
    if(gaps.length) fail('damage-no-gap', A, 'scrollY ' + gaps.slice(0, 8).join(', '), 'an empty band of over 70px under the pinned card');
  }
  if(pageErrors.length) fail('page-errors', '', '', pageErrors.join(' | '));

  if(main) writeJSON(path.join(ROOT, 'verify/out/helpers.json'), [...helpers.values()].map(h => Object.assign(h, { refs:[...h.refs].sort() })).sort((x, y) => x.text.localeCompare(y.text)));
  writeJSON(path.join(ROOT, 'verify/out/render' + (main ? '' : '-' + W) + '.json'), { width:W, checked:counts, helpers:helpers.size, failures });
  console.log('render at ' + W + 'px: ' + Object.values(counts).reduce((t, c) => t + c.screens, 0) + ' screens and popups, ' + helpers.size + ' helper texts, ' + failures.length + ' failures');
  for(const f of failures.slice(0, 60)) console.log('  ' + f.check + ' · ' + f.army + ' · ' + f.where + ' · ' + f.detail);
  await browser.close(); site.close();
  process.exit(failures.length ? 1 : 0);
})();
