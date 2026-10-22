// The Damage tab's own code (app.html: dmCalc and what it calls), run in node with data.js and calc.js, so the gate's
// calc step can check what the screen builds for real matchups without a browser.
//   const dm = require('./damage-node')(); dm.calc({ army, ph, atk, typed, left, on, off, pick, man, val, fx, ... }): your unit's attack
//   at the target set by hand (typed: { n, T, Sv, W, InSv, fnp, cover, dm1 })
//   dm.plan({ army, atk, typed, left, …, turn:{ me:dmModeTurn('both') } or the earlier steps { shoot, charge, fight }, ch:{ 'me:fight':{ on, … } }, facts }) → the turn
// Only top-level declarations are taken from app.html (the ones dmCalc needs, found by name); nothing touches a page.
const fs = require('fs'), path = require('path');
const { ROOT, loadData } = require('./lib');

module.exports = function load(){
  const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).sort((a, b) => b.length - a.length)[0];
  const lines = script.split('\n');
  // top-level declarations: name → source
  const START = /^(?:async )?function ([\w$]+)\(|^(?:const|let) ([\w$]+)\s*=/;
  const ENDS = /^(?:(?:async )?function |const |let |var |\/\/|\/\*|[\w$.]+\s*\(|if\s*\(|for\s*\(|try\b)/;
  const decl = new Map();
  for(let i = 0; i < lines.length; i++){
    const m = START.exec(lines[i]);
    if(!m) continue;
    let j = i + 1;
    while(j < lines.length && !ENDS.test(lines[j])) j++;
    decl.set(m[1] || m[2], { at:i, src:lines.slice(i, j).join('\n') });
  }
  // what the Damage helpers use, followed name by name (the page's state is given here instead)
  const given = new Set(['D', 'cur', 'sess', 'store', 'session', 'BUILD', '$', '$$', 'WH_CALC']);
  const need = new Set(), todo = ['dmCalc', 'dmShown', 'dmModels', 'dmUnits', 'dmState', 'dmSides', 'dmTypedVals', 'unitLabel', 'modelCount', 'DM_ONE_OF', 'dmPair', 'dmPlan', 'dmIn', 'dmBeatAns', 'dmFx', 'dmLevers', 'dmNums', 'dmZero', 'dmDelta', 'dmSetUnit', 'dmCleanTicks', 'dmResetPair', 'dmCharged', 'dmSetCharge', 'dmMe', 'dmModeTurn', 'dmModeOf', 'dmModeOld', 'dmStart', 'dmTotalAns', 'dmAnsOf', 'dmWorth'];
  while(todo.length){
    const n = todo.pop();
    if(need.has(n) || given.has(n) || !decl.has(n)) continue;
    need.add(n);
    // the code's own names (not words in its comments or strings, not properties: x.back, { back:true })
    const code = decl.get(n).src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ' ').replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "''")
      .replace(/(?<!\.)\.\s*[A-Za-z_$][\w$]*/g, ' ').replace(/[A-Za-z_$][\w$]*:(?!:)/g, ' ');
    for(const id of new Set(code.match(/[A-Za-z_$][\w$]*/g))) if(decl.has(id) && !need.has(id) && !given.has(id)) todo.push(id);
  }
  const src = [...need].sort((a, b) => decl.get(a).at - decl.get(b).at).map(n => decl.get(n).src).join('\n');
  const D = loadData(), WH_CALC = require(path.join(ROOT, 'calc.js'));
  const mem = new Map(), store = { get:k => mem.get(k), set:(k, v) => mem.set(k, v) };
  const env = new Function('D', 'WH_CALC', 'store', 'window', 'let cur = { s:"damage", army:null }, sess = {};\n' + src + '\n' +
    'return { set:(a, st) => { cur.army = a; sess.dmg = { [a]:st }; }, dmState, dmSides, dmTypedVals, dmCalc, dmShown, dmModels, dmUnits, army, unitLabel, modelCount, dmPair, dmPlan, dmIn, dmBeatAns, dmFx, dmLevers, dmNums, dmZero, dmDelta, dmSetUnit, dmCleanTicks, dmResetPair, dmCharged, dmSetCharge, dmMe, dmModeTurn, dmModeOf, dmModeOld, dmStart, dmTotalAns, dmAnsOf, dmWorth };');
  const app = env(D, WH_CALC, store, { WH_DATA:D });
  // one attack as the screen builds it: s = { army, ph, atk, typed, left, on, off, pick, man, val, fx }: the unit as the screen picks it
  // (dmSides), at the target set by hand; left: the models left of each models line
  const calc = s => {
    app.set(s.army, Object.assign({ dir:'me', ph:'shooting', off:{}, pick:{}, on:{}, man:{}, val:{}, fold:{}, typed:{} }, s));
    const st = app.dmState(), { A, au, tg, kind } = app.dmSides(st);
    return au ? app.dmCalc(st, A, au, tg, kind) : null;
  };
  // the whole turn as the screen plans it (its steps, each step's calculation): s as for calc, with turn, step, ch, facts, left (by unit)
  const plan = s => {
    app.set(s.army, Object.assign({ dir:'me', fold:{}, typed:{}, left:{}, turn:{}, step:{}, ch:{}, facts:{} }, s));
    return app.dmPlan(app.dmState());
  };
  return { D, WH_CALC, app, calc, plan, names:[...need] };
};
