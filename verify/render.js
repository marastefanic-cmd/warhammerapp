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
          bigIcons:[...document.querySelectorAll('#top svg, #view svg, #sheetIn svg, #subbar svg, #bbar svg')].filter(x => x.getBoundingClientRect().width > 40 || x.getBoundingClientRect().height > 40).map(x => (x.getAttribute('class') || '') + ' ' + ((x.querySelector('use') || {}).getAttribute ? x.querySelector('use').getAttribute('href') : '') + ' in .' + x.parentElement.className).slice(0, 3), tabs:document.querySelectorAll('#bbar .tabs button').length === 5,
          cut:[...document.querySelectorAll('#bbar .tabs button span')].filter(x => x.scrollWidth > x.clientWidth + 0.5).map(x => x.textContent),
          dmrules:[...document.querySelectorAll('#view .game [data-dmrule]')].map(x => x.dataset.dmrule) };
      }, [String(fn), HELPER_SEL, !!folded]);
      if(r.overflow > 0) fail('no-sideways-scroll', a.id, label, 'the page is ' + r.overflow + 'px wider than the phone');
      if(r.bigIcons.length) fail('icon-size', a.id, label, 'icons drawn over 40px (no size set): ' + r.bigIcons.join(', '));
      if(label !== 'home' && label !== 'settings' && !r.tabs) fail('tabs', a.id, label, 'no tab bar');
      if(r.cut.length) fail('tabs-fit', a.id, label, 'tab labels cut off: ' + r.cut.join(', '));   // each of the five labels whole
      r.dmrules.forEach(l => gameOther.add(l));
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
    const links = new Set(), gameLinks = new Set(), gameOther = new Set();   // gameOther: the Game tracker's links to the opponent's rules (opened from their list)
    const screen = async (s, extra) => {
      const r = await take(s + (extra ? ' ' + JSON.stringify(extra) : ''), `() => { hideSheet(); openStrats.clear(); ${extra && extra.open ? `allStratagems().forEach(x => openStrats.add(x.id));` : ''} go({ s:'${s}', army:'${a.id}' }); }`, extra && extra.folded);
      r.links.forEach(l => links.add(l));
    };
    // each list is checked as the one you opened (yours), not as a look at another list's opponent
    await page.evaluate(id => { sess.mine = id; sess.peekD = null; }, a.id);
    if(a === armies[0]){ await take('settings', `() => { hideSheet(); go({ s:'settings' }); }`); await take('home', `() => { hideSheet(); go({ s:'home' }); }`); }
    for(const s of ['army','pregame','units','ranged','melee','abilities','rules','bases']) await screen(s);
    // the damage calculator, against the next list: this list's first unit with ranged weapons shooting its first unit (Shoot), its
    // first unit with melee weapons fighting it, charged (Fight), and its first unit with both shooting, charging and fighting it (Both);
    // each taken once every effect is worked out (the list's order and every number settled: the background work is seeded, so the text
    // is the same every run)
    const vs = armies[(armies.indexOf(a) + 1) % armies.length].id;
    for(const ph of ['shooting', 'fight', 'both']){
      await page.evaluate(([id, vs, ph]) => { hideSheet(); store.set('wh-opp-' + id, vs); sess.dmg = {};
        const A = armyById(id), B = armyById(vs), kind = ph === 'fight' ? 'melee' : 'ranged', u = (ph === 'both' && A.units.find(x => (x.ranged || []).length && (x.melee || []).length)) || A.units.find(x => (x[kind] || []).length) || A.units[0];
        sess.dmg[id] = { dir:'me', atk:u.id, tArmy:vs, tgt:B.units[0].id, turn:{ me:dmModeTurn(ph === 'shooting' ? 'shoot' : ph, ph === 'fight' ? { fc:true } : {}) } };
        go({ s:'damage', army:id }); }, [a.id, vs, ph]);
      await page.waitForFunction(() => !dmBusy() && !document.querySelector('#dmList .fxv.wait, #dmList .fxv.est, #dmAns.prov, #dmList .upd'), null, { timeout:120000, polling:50 });
      await take('damage ' + ph, `() => {}`);
    }
    await screen('strats', { folded:true });   // every stratagem folded: its one-line gist, timing and users
    await screen('strats', { open:true });     // every stratagem, unfolded
    for(const u of a.units){
      const r = await take('unit ' + u, `() => { hideSheet(); go({ s:'unit', army:'${a.id}', unit:'${u}' }); }`);
      r.links.forEach(l => links.add(l));
    }
    // the Game tracker, against the next list (after the datasheets, so every other screen and popup is taken as before): a new
    // game (every fold open); round 2 with the first option of every choice picked (and the first of their units where it asks
    // for one); then each phase of both turns of the first battle round, the This phase part only (the folds of the phase
    // open), and the last turn's Fight phase of round 2 (the end of the battle round)
    const gameAt = async (label, state, part) => {
      const r = await take(label, `() => { hideSheet(); sess.gfold = {}; store.set('wh-opp-${a.id}', '${vs}'); store.set('wh-used-${a.id}', []);
        store.set('wh-game-${a.id}', ${JSON.stringify(state)}); go({ s:'game', army:'${a.id}' });
        ${state.pickAll ? `const A = armyById('${a.id}'); for(const c of gameChoices(A)) for(const gr of c.groups){ const g = gameOf(A), R = gcRound(c, g), o = gr.opts[0];
          gamePick(A, JSON.stringify([c.key, R, gr.name, o.name])); const tg = gcTargets(o.text, oppOf(A)); if(tg && tg.length) gamePick(A, JSON.stringify([c.key, R, 'target:' + gr.name, tg[0].id])); }
          render();` : ''}
        ${part ? `const P = $('#gPhase'); if(P){ while(P.previousElementSibling) P.previousElementSibling.remove(); const pre = $('#view .gpre'); if(pre) pre.remove(); }
          document.querySelectorAll('#view .gphase details, #view details.gopp').forEach(d => d.open = true);` : state.pickAll ? `document.querySelectorAll('#view details:not(.gpre):not(.gseq)').forEach(d => d.open = true);` : ''} }`, !!(part || state.pickAll));
      r.links.forEach(l => gameLinks.add(l));
    };
    await gameAt('game', {});
    await gameAt('game mid-game', { round:2, half:1, first:'opp', ph:'shooting', cp:{ mine:3, opp:2 }, vp:{ mine:15, opp:10 }, pickAll:true });
    for(const [half, who] of [[0, 'your'], [1, 'their']]) for(const ph of ['command', 'movement', 'shooting', 'charge', 'fight'])
      await gameAt('game round 1 ' + who + ' ' + ph, { round:1, half, first:'mine', ph }, true);
    await gameAt('game round 2 last fight', { round:2, half:1, first:'mine', ph:'fight' }, true);
    await page.evaluate(([id, u]) => { hideSheet(); store.set('wh-game-' + id, null); store.set('wh-used-' + id, []); go({ s:'unit', army:id, unit:u }); }, [a.id, a.units[a.units.length - 1]]);   // back where the popups start from
    // every popup a link on these screens opens
    const opener = { rule:'showRule', strat:'showStrat', ability:'showAbility', enh:'showEnhancement', kw:'showKeywords' };
    for(const l of [...links].filter(Boolean).sort()){
      const i = l.indexOf(':'), k = l.slice(0, i), v = l.slice(i + 1);
      const call = k === 'grant' ? `(g => showGrant(g[0].split('|'), g[1], g[2], g[3]))(${v})` : `${opener[k]}(${JSON.stringify(v)})`;
      const r = await take('popup ' + l, `() => { hideSheet(); go({ s:'army', army:'${a.id}' }); ${call}; }`);
      const open = await page.evaluate(() => !$('#sheetHost').hidden && $('#sheetTitle').textContent.trim().length > 0);
      if(!open) fail('link-resolves', a.id, l, 'the link opens nothing');
    }

    // the Game tracker's links that no other screen has: each opens its popup (taken by the popups above when another screen has it too)
    for(const l of [...gameLinks].filter(x => x && !links.has(x)).sort()){
      const i = l.indexOf(':'), k = l.slice(0, i), v = l.slice(i + 1);
      const ok = await page.evaluate(([id, k, v]) => { hideSheet(); go({ s:'game', army:id }); ({ rule:showRule, strat:showStrat, ability:showAbility, enh:showEnhancement })[k](v);
        return !$('#sheetHost').hidden && $('#sheetTitle').textContent.trim().length > 0; }, [a.id, k, v]);
      if(!ok) fail('link-resolves', a.id, 'game: ' + l, 'the link opens nothing');
    }
    for(const l of [...gameOther].sort()){
      const ok = await page.evaluate(([id, l]) => { hideSheet(); go({ s:'game', army:id }); const [t, aid, ...rest] = l.split('|'), k = rest.join('|'), L = armyById(aid);
        if(!L || !['strat', 'rule', 'ability'].includes(t)) return false;
        dmShowIn(L, () => t === 'strat' ? showStrat(k) : t === 'rule' ? showRule(k) : showAbility(k));
        return !$('#sheetHost').hidden && $('#sheetTitle').textContent.trim().length > 0; }, [a.id, l]);
      if(!ok) fail('link-resolves', a.id, 'game: ' + l, 'the opponent’s rule opens nothing');
    }
    await page.evaluate(id => { hideSheet(); store.set('wh-game-' + id, null); store.set('wh-used-' + id, []); }, a.id);

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
      // - the target has as many models as the unit (dmModels), less a model not on the battlefield yet (embarked: Sir Hekhtur)
      // - an InSv marked * (against ranged attacks) is not used against melee attacks
      // - a value New Recruit already includes (a weapon's `from`) is never added again by the same rule
      // - a rule for one weapon or one model of an attached unit reaches only that weapon or model
      const foe = A.units[0];
      for(const u of A.units){
        for(const kind of ['ranged', 'melee']){
          const rows = dmModels(u, kind), emb = dmEmbarked(u), away = emb ? u.models.filter(l => emb.names.has(l.replace(/^\d+× /, '').replace(/ \(.*\)$/, ''))).reduce((t, l) => t + (parseInt(l, 10) || 1), 0) : 0;
          if(rows.reduce((t, r) => t + r.count, 0) !== modelCount(u) - away) out.push(['damage-models', u.id, kind + ': ' + rows.reduce((t, r) => t + r.count, 0) + ' models, the unit has ' + modelCount(u)]);
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
  // first unit (Shoot; Both where it says so) ----
  {
    const A = armies[0].id;
    let B = armies[1].id;
    const settled = async () => { await page.waitForFunction(() => !dmBusy() && !document.querySelector('#dmList .fxv.wait, #dmList .fxv.est, #dmAns.prov, #dmList .upd'), null, { timeout:120000, polling:50 }); await page.waitForTimeout(300); };
    // (at: [list, unit], another list's unit attacking: that list open as yours; a tap within 350ms of opening a screen is not taken)
    const open = async (mode, at) => { await page.evaluate(([A, B, mode, at]) => { hideSheet(); const M = at ? at[0] : A, T = at && M === B ? A : B; store.set('wh-opp-' + M, T); sess.mine = M; sess.dmg = {};
      const L = armyById(M), u = at ? L.units.find(x => x.id === at[1]) : L.units.find(x => (x.ranged || []).length) || L.units[0];
      sess.dmg[M] = { dir:'me', atk:u.id, tArmy:T, tgt:armyById(T).units[0].id, turn:{ me:dmModeTurn(mode || 'shoot') } };
      go({ s:'damage', army:M }); scrollTo(0, 0); }, [A, B, mode, at || null]);
      await settled(); await page.waitForTimeout(200); };
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
        if(!want.test(ctx) && !(document.querySelector('#dmAns.static .dmmsg'))) bad.push('the card says “' + ctx.slice(0, 40) + '”');
        return { bad }; }, m);
      if(r.bad.length) fail('damage-mode', A, m, r.bad.join('; '));
      await settled();
    }
    // Both: its total is the Shoot → Charge → Fight play of the same choices (the Shoot step and the charged Fight step, one after the
    // other in the same games), the card says each part, and the shooting's and the fight's choices are in their own sections
    await open('both');
    const both = await page.evaluate(() => { const C = DM_CTX; if(!C || !C.plan.both) return { skip:true };
      const st = JSON.parse(JSON.stringify(C.st)), one = m => { const s = JSON.parse(JSON.stringify(st)); s.turn[s.dir] = dmModeTurn(m, m === 'fight' ? { fc:true } : {}); return dmPlan(s).beats[0]; };
      const bs = [one('shoot'), one('fight')], r = WH_CALC.play({ beats:bs.map(b => ({ side:1, ph:b.ph, fight:b.ph === 'fight', input:Object.assign({}, b.M.input, { sims:undefined, seed:undefined }) })), sims:DM_X, seed:7 });
      const one1 = C.A.one, want = WH_CALC.fmt(one1 ? r.beats.reduce((t, x) => t + x.dmg, 0) : r.sides[1].killed), got = document.querySelector('#dmAns .dmbig b').textContent;
      const parts = (document.querySelector('#dmAns .dmparts') || {}).textContent || '';
      const secs = [...document.querySelectorAll('#dmList .dmpart')].map(p => p.dataset.dmstep + ':' + [...p.querySelectorAll('.dmh3')].map(h => h.firstChild.textContent.trim()).filter(t => /weapons/.test(t)).join());
      return { want, got, parts, secs }; });
    if(!both.skip && (Math.abs(+both.want - +both.got) > 0.1 || !/^Shoot [\d.]+ · Fight [\d.]+ · /.test(both.parts) || both.secs.join('|') !== 'shoot:Ranged weapons|fight:Melee weapons'))
      fail('damage-both', A, 'Both', JSON.stringify(both));
    // a mode the unit has no weapons for: its segment says so and stays tappable; tapped, the card says so (Both: the part it has)
    const gun = await page.evaluate(() => { for(const L of WH_DATA.armies) for(const u of L.units) if(!(u.ranged || []).length && (u.melee || []).length) return [L.id, u.id]; return null; });
    if(gun){ await open('shoot', gun);
      const g = await page.evaluate(() => { const s = document.querySelector('[data-dmmode="shoot"]'), b = document.querySelector('[data-dmmode="both"]');
        return { s:s ? s.textContent : '', b:b ? b.textContent : '', dis:!!(s && s.disabled), msg:(document.querySelector('.dmans .dmmsg') || {}).textContent || '' }; });
      await page.click('[data-dmmode="both"]'); await settled();
      await page.evaluate(A => { sess.mine = A; }, A);
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
    // no divider touches or crosses a text line, a pick or a box, on the matchups with picks under their rows (Try Dat Button!, a
    // weapon's profiles, the Blessings, the Doctrina Imperatives), every fold open, with the card in its place and pinned
    // (in the page: every border-top/bottom line of the screen against every text line and every box; a line drawn by a box itself, or
    // inside it, is the box's own; one under the pinned card is not seen, unless it shows through)
    const dmLines = () => {
      const bad = [], root = document.querySelector('#view'), pin = document.querySelector('#dmPin');
      const pr = pin && !pin.hidden && pin.firstElementChild ? pin.firstElementChild.getBoundingClientRect() : null;
      const under = (r, e) => pr && !pin.contains(e) && r.bottom > pr.top && r.top < pr.bottom;   // under the pinned card: not seen
      const shown = e => { for(let x = e; x && x !== document.body; x = x.parentElement){ const cs = getComputedStyle(x); if(cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false; } return true; };
      const lines = [], boxes = [];
      const BOX = '.dmpp, .dmop, .dmchip, .dmbh, .btn, .btn2, .sd, .best, .dmmode button, .dmans, .dmmx:not([hidden]), .dmst, .dmtyin, .textbtn, .dmswap';
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
      ['shooty', { atk:'dakkarig-boosta', tArmy:'princes', tgt:'lord-on-juggernaut-khorne-berzerkers' }, 'Try Dat Button!'],
      ['shooty', { atk:'mek-flashgitz', tArmy:'super-terminators', tgt:'chaos-terminators' }, 'profiles'],
      ['princes', { atk:'kh-rn-the-betrayer-khorne-berzerkers', tArmy:'shooty', tgt:'mek-flashgitz', turn:{ me:{ mode:'fight', fight:true, charge:true, fc:true } } }, 'Blessings'],
      ['purge-goes-the-foe', { atk:'skitarii-rangers', tArmy:'typed', typed:{ n:10, T:4, W:1, Sv:4, InSv:0, fnp:0 } }, 'Doctrina'],
      ['shooty', { atk:'mek-flashgitz', tArmy:'princes', tgt:'lord-on-juggernaut-khorne-berzerkers', turn:{ me:{ mode:'both', shoot:true, fight:true, charge:true } } }, 'Both']]){
      if(!armies.some(x => x.id === L0) || !await page.evaluate(([L0, u]) => !!armyById(L0).units.find(x => x.id === u), [L0, st0.atk])){ fail('damage-lines', L0, label, 'the matchup is not in the data'); continue; }
      await page.evaluate(([L0, st0]) => { hideSheet(); sess.mine = L0; sess.dmg = { [L0]:Object.assign({ dir:'me', turn:{ me:dmModeTurn('shoot') }, fold:{ nc:true, outs:true, more:true } }, st0) }; go({ s:'damage', army:L0 }); scrollTo(0, 0); }, [L0, st0]);
      await settled();
      const top = await page.evaluate(dmLines);
      await page.evaluate(async () => { scrollTo(0, 900); await new Promise(f => requestAnimationFrame(() => requestAnimationFrame(f))); dmStick(); await new Promise(f => requestAnimationFrame(f)); });
      const bad = top.concat((await page.evaluate(dmLines)).map(x => 'pinned: ' + x)); await page.evaluate(() => scrollTo(0, 0));
      if(bad.length) fail('damage-lines', L0, label, bad.slice(0, 6).join(' | '));
    }
    await page.evaluate(A => { sess.mine = A; }, A);
    // another target: the facts said about the pair (the closest target, a half-range band) reset, the toast names them, Undo puts them back
    await open();
    const rs = await page.evaluate(async B => { const st = dmState(), d = st.dir, P = dmPair(st), u = armyById(B).units.find(x => x.id !== st.tgt); if(!u) return null;
      st.facts[d] = { theirs:{ closest:true } }; dmCh(st, 'shoot').val.half = 9; saveSession();
      const before = dmBefore(st, true), r = dmSetUnit(st, 'theirs', B, u.id); saveSession(); rerender(); dmChange(r.words, before, r.dropped);
      await new Promise(f => setTimeout(f, 300)); const said = $('#toast').innerText, gone = !(dmState().facts[d].theirs || {}).closest;
      document.querySelector('#toast [data-undo]').click(); await new Promise(f => setTimeout(f, 400));
      const s2 = dmState(); return { said, gone, back:!!(s2.facts[d].theirs || {}).closest && dmCh(s2, 'shoot').val.half === 9 && s2.tgt === before.tgt }; }, B);
    if(!rs || !/reset: .*closest target/.test(rs.said) || !rs.gone || !rs.back) fail('damage-reset', A, 'another target', JSON.stringify(rs));
    // its toast: over the tab bar, on one line, covering no number of the card; a tap on its words reaches the tab bar below it
    const toast = await page.evaluate(async B => { const st = dmState(), u = armyById(B).units.find(x => x.id !== st.tgt); if(!u) return null;
      const before = dmBefore(st, true), r = dmSetUnit(st, 'theirs', B, u.id); saveSession(); rerender(); dmChange(r.words, before, r.dropped); await new Promise(f => setTimeout(f, 300));
      const tr = $('#toast').getBoundingClientRect(), a = $('#dmAns'), ar = a ? a.getBoundingClientRect() : null, over = [];
      if(ar && ar.bottom > tr.top + 1 && ar.top < tr.bottom - 1 && ar.right > tr.left && ar.left < tr.right) over.push('the card');
      if(tr.height > 48) over.push('two lines');
      const tm = $('#toast .tm').getBoundingClientRect(), below = document.elementFromPoint(tm.left + 4, tm.top + tm.height / 2);
      if(!below || !below.closest('#bbar')) over.push('the tab bar\'s taps');
      document.querySelector('#toast [data-undo]').click(); await new Promise(f => setTimeout(f, 300)); return over; }, B);
    if(toast && toast.length) fail('damage-toast', A, 'a unit picked', 'the toast covers ' + toast.join(', '));
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
  // ---- the Game tracker under a finger (each width): opened from its row on Find and Back to Find; the steppers, ten Next taps
  // (round 1's two turns), a pick, New game and Undo ----
  {
    const A = armies[0].id, B = armies[1].id;
    const tapIt = async sel => { await page.evaluate(sel => { const e = document.querySelector(sel); e.scrollIntoView({ block:'center' }); }, sel); await page.waitForTimeout(120); await page.click(sel); await page.waitForTimeout(150); };
    await page.evaluate(([A, B]) => { hideSheet(); store.set('wh-opp-' + A, B); store.set('wh-game-' + A, null); store.set('wh-used-' + A, []); sess.mine = A; go({ s:'army', army:A }); scrollTo(0, 0); }, [A, B]);
    await page.waitForTimeout(500);
    await tapIt('#armyMenu [data-go="game"]'); await page.waitForTimeout(400);
    const nav = await page.evaluate(() => [cur.s, $('#top .back') ? $('#top .back').innerText.trim() : '', $('#bbar [data-tab].on') ? $('#bbar [data-tab].on').dataset.tab : '']);
    if(nav[0] !== 'game' || nav[2] !== 'army') fail('game-row', A, 'Find → Game tracker', JSON.stringify(nav) + ': not the Game tracker under the Find tab');
    await tapIt('#top [data-back]'); await page.waitForTimeout(400);
    if(await page.evaluate(() => cur.s) !== 'army') fail('game-row', A, 'Game tracker → Back', 'not back on Find');
    await page.evaluate(A => { go({ s:'game', army:A }); scrollTo(0, 0); }, A);
    await page.waitForTimeout(500);
    await tapIt('[data-gstep="cp|mine|1"]'); await tapIt('[data-gstep="cp|mine|1"]'); await tapIt('[data-gstep="vp|opp|1"]'); await tapIt('[data-gstep="cp|mine|-1"]');
    const s1 = await page.evaluate(() => [gameOf(army()).cp.mine, gameOf(army()).vp.opp, document.querySelector('[data-gstep="cp|mine|1"]').parentElement.querySelector('b').textContent]);
    if(s1.join() !== '1,1,1') fail('game-steppers', A, 'CP +, +, −; VP +', JSON.stringify(s1));
    for(let i = 0; i < 10; i++) await tapIt('[data-gnext]');
    const s2 = await page.evaluate(() => { const g = gameOf(army()); return [g.round, g.half, g.ph]; });
    if(s2.join() !== '2,0,command') fail('game-next', A, 'ten Next taps', 'round ' + s2.join(', ') + ', not round 2, first turn, Command');
    const c0 = await page.evaluate(() => { const c = gameChoices(army())[0]; return c ? JSON.stringify([c.key, gcRound(c, gameOf(army())), c.groups[0].name, c.groups[0].opts[0].name]) : null; });
    if(c0){ await page.evaluate(v => { const e = [...document.querySelectorAll('[data-gpick]')].find(x => x.dataset.gpick === v); e.click(); }, c0); await page.waitForTimeout(200);
      const on = await page.evaluate(v => { const e = [...document.querySelectorAll('[data-gpick]')].find(x => x.dataset.gpick === v); return !!e && e.classList.contains('on'); }, c0);
      if(!on) fail('game-pick', A, 'the first option of the first choice', 'not shown as picked'); }
    await tapIt('[data-gnew]');
    const s3 = await page.evaluate(() => { const g = gameOf(army()); return [g.round, g.cp.mine, Object.keys(g.picks).length, store.get('wh-game-' + army().id, 'x')]; });
    if(s3[0] !== 1 || s3[1] !== 0 || s3[2] !== 0 || s3[3] !== null) fail('game-new', A, 'New game', JSON.stringify(s3));
    await page.click('#toast [data-undo]'); await page.waitForTimeout(250);
    const s4 = await page.evaluate(() => { const g = gameOf(army()); return [g.round, g.cp.mine]; });
    if(s4.join() !== '2,1') fail('game-new', A, 'New game, then Undo', JSON.stringify(s4));
    await page.evaluate(A => { store.set('wh-game-' + A, null); hideSheet(); }, A);
  }
  if(pageErrors.length) fail('page-errors', '', '', pageErrors.join(' | '));

  if(main) writeJSON(path.join(ROOT, 'verify/out/helpers.json'), [...helpers.values()].map(h => Object.assign(h, { refs:[...h.refs].sort() })).sort((x, y) => x.text.localeCompare(y.text)));
  writeJSON(path.join(ROOT, 'verify/out/render' + (main ? '' : '-' + W) + '.json'), { width:W, checked:counts, helpers:helpers.size, failures });
  console.log('render at ' + W + 'px: ' + Object.values(counts).reduce((t, c) => t + c.screens, 0) + ' screens and popups, ' + helpers.size + ' helper texts, ' + failures.length + ' failures');
  for(const f of failures.slice(0, 60)) console.log('  ' + f.check + ' · ' + f.army + ' · ' + f.where + ' · ' + f.detail);
  await browser.close(); site.close();
  process.exit(failures.length ? 1 : 0);
})();
