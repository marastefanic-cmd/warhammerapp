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
  const page = await (await browser.newContext({ viewport:{ width:W, height:844 } })).newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  // only the app's own files and its web fonts (the layout checks need the real fonts' widths)
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());   // the app ships its own fonts
  // verified.js is the result of the last gate run (this one writes it when it ends): a fixed stand-in, as if
  // this build passed, so the screens and their snapshots do not depend on how the previous run went
  const build = sha(['app.html', 'data.js', 'calc.js', 'ask.js', 'import.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('')).slice(0, 10);
  const stub = { ok:true, build, data:loadData().version, date:'(date of the check)', checks:[{ label:'(checks)', detail:'(as listed by verify/run.js)' }], sources:[{ label:'(sources)', detail:'(as listed by verify/run.js)' }] };
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
          unnamed:[...document.querySelectorAll('#bbar .tabs button')].filter(x => !(x.getAttribute('aria-label') || '').trim()).map(x => x.dataset.tab) };
      }, [String(fn), HELPER_SEL, !!folded]);
      if(r.overflow > 0) fail('no-sideways-scroll', a.id, label, 'the page is ' + r.overflow + 'px wider than the phone');
      if(r.bigIcons.length) fail('icon-size', a.id, label, 'icons drawn over 40px (no size set): ' + r.bigIcons.join(', '));
      if(label !== 'home' && label !== 'settings' && !/^popup import/.test(label) && !r.tabs)   // (the import sheet opens on the home screen)
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
        // the army facts the datasheet shows where they matter:
        // - a unit always riled up by its own rule (riled: Super Runts) says so on every riled-up line, When targeted and footnotes
        // - Waaagh!'s [ASSAULT] while riled up, on a unit with Waaagh! some of whose ranged weapons lack [ASSAULT]
        // - what another unit of the list gives it when it is attacked (guard), under When targeted
        // - every keyword once, a keyword only some models have under those models (kwOnly)
        const lines = [...document.querySelectorAll('#view .def, #view .mod')].map(x => x.innerText.replace(/\s+/g, ' '));
        if(u.abilities.some(ab => ab.riled && !ab.na)) for(const l of lines) if(/(^|· |TARGETED ?)Riled up(?! \()/i.test(l)) out.push(['always-riled', u.id, 'a riled-up line without “always riled up”: ' + l.slice(0, 80)]);
        if(u.rules.includes('Waaagh!') && (u.ranged || []).some(w => !w.kw.some(x => /^assault$/i.test(x))) && !lines.some(l => l.includes('[ASSAULT] (Waaagh!)')))
          out.push(['riled-assault', u.id, 'no “Riled up: [ASSAULT] (Waaagh!)” footnote']);
        const when = (document.querySelector('#view .def') || {}).innerText || '';
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
      for(const d of detachmentsOf(A)) if(d.rule && !ov.includes(d.rule.name)) out.push(['overview-rules', armyId, d.rule.name + ' is not in the Overview’s rules']);
      // the Phase checklist: every triggered (ckTriggered) army and detachment rule, option and ability of the list is on it, and no
      // other, each in the sections its CHECKLIST entry names (To do now where it is triggered, or at the moment it opens with; Active
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
      const secsOf = e => (e.at ? [e.at] : []).concat(Object.entries(ckMap(e.t)).flatMap(([p, t]) => (t === 'either' ? ['your', 'opp'] : [t]).map(w => p + '|' + w)));
      const usedOf = e => Object.entries(ckMap(e.u)).flatMap(([p, t]) => (t === 'either' ? ['your', 'opp'] : [t]).map(w => p + '|' + w));
      // each place an entry should be: [section heading, group]
      const want = (e, once, kind, x) => {
        if(!triggered(e && x ? ckStored(e, x) : e || { x:1 }, x || {})) return [];   // always on: not listed
        if(!e || e.x) return x && (phasesOf(x).length || x.at) ? null : [['When unclear', kind]];
        if(e.none) return [['No phase', kind]];
        const tr = secsOf(e), act = usedOf(e).filter(s => !tr.includes(s));
        if(once) return (tr.length ? tr : act).map(s => [T(s), 'Once per battle']);
        return tr.map(s => [T(s), 'To do now']).concat(act.map(s => [T(s), 'Active now']));
      };
      const CK = WH_DATA.checklist || {};
      // "triggered", as the screen's note documents it, written out again here (not the app's ckTriggered): when named (t, at), a
      // limit on its uses, the player acting, a named move or action, dice rolled or a test taken as something happens
      const triggered = (e, x) => !!(e.t || e.at) || [x.text, x.tag].some(t => { const p = String(t || '').replace(/\*\*|~~/g, '');
        return /\b(once|twice|three times) per (battle|battle round|turn|phase)\b/i.test(p) || /\bcan make an? [A-Z]/.test(p) ||
          /\byou can (use this|select|choose)\b|\bcan use (it|this ability|this enhancement|this part)\b|\b(select|choose)s? (one|up to|a|an)\b|\bwhen\b[^.]*?\byou can (?!re-roll)/i.test(p) ||
          /(?<!-)\broll (one|two|a|an|\d+|up to)\b|\btakes? an? [a-z-]+ test\b/i.test(p); });
      if(document.querySelector('#view [data-strat]')) out.push(['checklist-sections', armyId, 'a stratagem is listed']);
      const ckRules = factionOf(A).armyRules.concat(detachmentsOf(A).filter(d => d.rule).map(d => d.rule));
      for(const r of ckRules){
        const e0 = CK['r|' + A.faction + '|' + r.name], e = e0 && ckStored(e0, r);
        if(!e0) out.push(['checklist-sections', armyId, r.name + ': no CHECKLIST entry (node verify/derive.js --write)']);
        const hit = l => [...l.querySelectorAll('[data-rule]')].some(x => x.dataset.rule === r.name) && l.textContent.startsWith(r.name + ' · ');
        const each = /\beach of these [a-z ]+ once per battle/i.test(r.text) && r.table;
        const w = want(e0, !inertRule(r.name) && !each && !!perBattle(r, true) && !/per battle\b(?! round)[^.)]*\bper unit\b/i.test(r.text || ''), 'Rules', r);
        const listedR = Object.values(ck).some(g => Object.values(g).some(ls => ls.some(hit)));
        if(listedR !== !!(w && w.length || !w)) out.push(['checklist-sections', armyId, r.name + (listedR ? ' is listed, and is always on' : ' is not listed')]);
        else if(w) for(const [sec, grp] of w) if(!lineIn(sec, grp, hit)) out.push(['checklist-sections', armyId, r.name + ' is not under ' + sec + ' · ' + grp]);
        for(const o of (e && e.o) || []){
          if(A.units.some(u => u.abilities.some(ab => ab.name === o.n))) continue;
          const oIn = !!(triggered(e, r) || o.t || o.at), oListed = Object.values(ck).some(g => Object.values(g).some(ls => ls.some(l => l.textContent.startsWith(o.n + ' · option of ' + r.name))));
          if(oIn !== oListed) out.push(['checklist-sections', armyId, r.name + ' · ' + o.n + (oListed ? ' is listed, an option of an always-on rule' : ' is not listed')]);
          if(!oIn) continue;
          const oe = o.x ? { x:1 } : o.t || o.at ? o : o.u ? { u:o.u } : { t:e.t, at:e.at }, oh = l => l.textContent.startsWith(o.n + ' · option of ' + r.name);
          const ow = each && !inertRule(r.name) && !o.x ? (o.t || o.at ? secsOf(o) : secsOf(e)).map(s => [T(s), 'Once per battle']) : want(oe, false, 'Rules');
          for(const [sec, grp] of ow) if(!lineIn(sec, grp, oh)) out.push(['checklist-sections', armyId, r.name + ' · ' + o.n + ' is not under ' + sec + ' · ' + grp]);
        }
      }
      const firstOf = ab => A.units.flatMap(u => u.abilities).find(x => x.name === ab.name && x.text === ab.text && !naReason(x) === !naReason(ab));
      for(const u of A.units) for(const ab of u.abilities){
        const e = CK['a|' + ckHash(ab.name + '\n' + ab.text)], key = abilityKey(ab);
        if(!e) out.push(['checklist-sections', armyId, u.id + ' · ' + ab.name + ': no CHECKLIST entry under the app’s key (node verify/derive.js --write)']);
        const hit = l => [...l.querySelectorAll('[data-ability]')].some(x => x.dataset.ability === key) && l.textContent.startsWith(ab.name + ' ·');
        const w = want(e, !naReason(ab) && !!perBattle(ab), 'Abilities', firstOf(ab));
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
    // the modifiers, folded under one row that says what is set: +1 to hit set, said there and as a chip
    await page.evaluate(() => { const d = document.querySelector('#dmList .dmmanf'); d.open = true; d.scrollIntoView({ block:'center' }); }); await page.waitForTimeout(300);
    await page.click('[data-dmman="hit|1"]'); await settled();
    const md = await page.evaluate(() => ({ sum:document.querySelector('#dmList .dmmanf > summary').textContent, chip:[...document.querySelectorAll('#dmAns .dmchip')].map(c => c.textContent).join(' | ') }));
    if(!/Modifiers · Hit \+1/.test(md.sum) || !/Hit \+1/.test(md.chip)) fail('damage-modifiers', A, '+1 to hit', JSON.stringify(md));
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
    // a fact's box with the rules it switches on: none ticked, empty; some, partly; all, ticked (one rule: Riled up → Dakka!
    // Dakka! Dakka!; two: the objective → Finderz Keeperz, Wreckin’ and Lootin’)
    {
      const at = ['shooty', 'mek-flashgitz'];
      const mark = f => page.evaluate(f => { const e = document.querySelector('#dmList [data-dmlv="' + f + '"]'); return e.classList.contains('part') ? 'part' : e.getAttribute('aria-pressed') === 'true' ? 'on' : 'off'; }, f);
      const kidTap = async (f, i) => { const sel = '#dmList .dmrw:has([data-dmlv="' + f + '"]) .dmkid';
        await page.evaluate(([s, i]) => document.querySelectorAll(s)[i].scrollIntoView({ block:'center' }), [sel, i]); await page.waitForTimeout(400);
        await page.locator(sel).nth(i).click(); await settled(); };
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
    const row = await page.evaluate(() => { const b = document.querySelector('#view [data-import]'); const l = b && b.closest('.list'), last = [...document.querySelectorAll('#view .armies .arow')].pop();
      return !b ? 'no row' : !(last && last.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? 'not under the armies' : /Import a list from New Recruit/.test(b.textContent) ? '' : 'says ' + b.textContent; });
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
    // kept over a reload, under its faction on the home screen, and every screen as the app's own list's
    await page.reload(); await page.evaluate(() => document.fonts.ready);
    const same = await page.evaluate(([id, orig]) => { const out = [], A = armyById(id); if(!A) return ['not there after a reload'];
      const txt = (s, a, x) => { hideSheet(); go(Object.assign({ s, army:a }, x || {})); document.querySelectorAll('#view details').forEach(d => d.open = true); return $('#view').innerText; };
      const drop = (t, imp) => imp ? t.replace(/New Recruit, imported [^\n]*/, '').replace(/\nON THIS PHONE[\s\S]*$/i, '') : t.replace(/New Recruit, exported [^\n]*/, '');
      for(const s of ['army', 'pregame', 'checklist', 'units', 'strats', 'ranged', 'melee', 'abilities', 'rules', 'bases']) if(drop(txt(s, orig), false).trim() !== drop(txt(s, id), true).trim()) out.push(s + ' differs');
      for(const u of armyById(orig).units) if(txt('unit', orig, { unit:u.id }) !== txt('unit', id, { unit:u.id })) out.push('unit ' + u.id + ' differs');
      hideSheet(); go({ s:'home' });
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
