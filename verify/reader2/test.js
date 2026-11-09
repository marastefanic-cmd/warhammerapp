// ISOLATION (verify/reader2/, release tooling of the two-reader rule, verify/agree.js): this reader must never import the app's reading
// code (verify/effects-extract.js, effects-migrate.js, coverage.js, evidence.js, lines.js, defence.js, derive.js) nor read data.js BOXES.
// The gate step agree fails if it does (check R1). Its code is kept as it was written (scratchpad reader2, round 4); run it with
// KODEX_APP=<this repo> KODEX_CACHE=<this repo>/verify/.cache, as the gate does.
// Unit tests for reader2.js: hand-picked GW sentences (10 factions) and tricky forms. Run: node reader2.js --test
'use strict';
const assert = require('assert');
const { readSentence, readSource } = require('./reader2.js');

let pass = 0, fail = 0;
// `want` lists only the fields that matter; effects/conditions compare as id[:value] strings, in order
function check(name, got, want){
  try {
    if(want.status) assert.strictEqual(got.status, want.status, 'status');
    if(want.reason) assert.ok(new RegExp(want.reason).test(got.reason || ''), 'reason ' + got.reason);
    if(want.fx) assert.deepStrictEqual(got.effects.map(e => e.id + (e.v === true ? '' : ':' + e.v)), want.fx, 'effects');
    if(want.attack) assert.strictEqual(got.attack, want.attack, 'attack');
    if(want.side) assert.strictEqual(got.side, want.side, 'side');
    if(want.reach) for(const [k, v] of Object.entries(want.reach)) assert.deepStrictEqual(got.reach && got.reach[k], v, 'reach.' + k);
    if(want.cond) assert.deepStrictEqual(got.conditions.map(c => c.id + (c.v === undefined || c.v === true ? '' : ':' + JSON.stringify(c.v))), want.cond, 'conditions');
    if('duration' in want) assert.strictEqual(got.duration, want.duration, 'duration');
    if(want.kind) assert.strictEqual(got.kind, want.kind, 'kind');
    if(want.debuff) assert.strictEqual(got.debuff, true, 'debuff');
    pass++;
  } catch(e){
    fail++; console.log('FAIL ' + name + ': ' + e.message + '\n  got ' + JSON.stringify(got));
  }
}
const say = (t, ctx) => readSentence(t, ctx || {});

/* ---- tricky forms the brief names ---- */
// Tyranids (Hive Tyrant-style gaping maw): every successful unmodified wound roll critical
check('critWoundAll', say("Each time an attack with this model's gaping maw targets an **INFANTRY**, **MOUNTED** or **BEASTS** unit, each successful unmodified **Wound roll** is a **Critical Wound**."),
  { status:'read', fx:['critWoundAll'], side:'attack', reach:{ type:'self' }, cond:['targetKw:{"any":["INFANTRY","MOUNTED","BEASTS"]}', 'weapon:"gaping maw"'] });
// aura with "or" and "(excluding …)"
check('aura or/excluding', say('While a friendly **INFANTRY** or **MOUNTED** unit (excluding **EPIC HERO** units) is within 6" of this model, each time a model in that unit makes a melee attack, add 1 to the Hit roll.'),
  { status:'read', fx:['hit:1'], attack:'melee', reach:{ type:'aura', range:6, kw:{ any:['INFANTRY', 'MOUNTED'] }, excluding:['EPIC HERO'] }, cond:['aura:6'] });
// Adeptus Custodes (Faction Pack): friendly units (excluding X/Y) within 6" … can: (bullet)
{
  const rs = readSource({ kind:'ability', name:'Test', text:'Friendly **ADEPTUS CUSTODES** units (excluding **MONSTER**/**VEHICLE** units) within 6" of this model can:\n- Re-roll **hit rolls** of 1.' });
  check('custodes aura lead', rs[0], { status:'read', kind:'leadIn' });
  check('custodes aura bullet', rs[1], { status:'read', fx:['rrHit1'], reach:{ type:'aura', range:6, kw:{ any:['ADEPTUS CUSTODES'] }, excluding:['MONSTER', 'VEHICLE'] } });
}
// weapons equipped by models in this model's unit
check("this model's unit weapons", say("Weapons equipped by models in this model's unit have [SUSTAINED HITS 1]."),
  { status:'read', fx:['sus:1'], attack:'any', reach:{ type:'unit', of:'this model' } });
// enemy-unit debuff (Thousand Sons-style aura on enemies)
check('enemy debuff', say('While an enemy unit is within 12" of this model, each time a model in that unit makes a Psychic Attack, subtract 1 from the Wound roll.'),
  { status:'read', fx:['wound:-1'], attack:'psychic', reach:{ type:'enemyAura', range:12 }, debuff:true });
// until the end of the battle (Tyranids enhancement)
check('end of battle', say('At the start of any turn, if the bearer has fewer than its starting number of wounds remaining, until the end of the battle, it has the Feel No Pain 4+ ability instead.', { lastSubject:{ type:'bearer' } }),
  { status:'read', fx:['fnp:4'], side:'defence', duration:'end of the battle', cond:['timing:"start of any turn"', 'woundsLost'] });
// "the first time …": Kharn's rule is about coming back, not an effect in the vocabulary → unread with the reason
check('first time (unread)', say('The first time this model is destroyed, at the end of the phase, roll one D6: on a 2+, set this model back up on the battlefield as close as possible to where it was destroyed and not within **Engagement Range** of one or more enemy units, with 3 wounds remaining.'),
  { status:'unread', reason:'^outside-vocabulary' });
check('first time (read)', say('The first time the bearer\'s unit destroys an enemy unit, until the end of the battle, add 1 to the Attacks characteristic of melee weapons equipped by the bearer.'),
  { status:'read', fx:['a:1'], attack:'melee', duration:'end of the battle', cond:['firstTime:"the bearer\'s unit destroys an enemy unit"'] });
// "select one of the abilities in the X section" (Adeptus Mechanicus, Belisarius Cawl)
{
  const rs = readSource({ kind:'ability', name:'Canticles of the Omnissiah', text:'At the start of your Command phase, select one of the abilities in the Canticles of the Omnissiah section. Until the start of your next Command phase, this model has that ability.\n**Shroudpsalm (Aura):** While a friendly **ADEPTUS MECHANICUS** unit is within 6" of this model, that unit has the **Stealth** ability.' });
  check('section pick', rs[0], { status:'read', kind:'optionPick' });
  check('section grants', rs[1], { status:'read', kind:'grantsSelected' });
  check('section option', rs[2], { status:'read', fx:['stealth'], side:'defence', reach:{ type:'aura', range:6, kw:{ any:['ADEPTUS MECHANICUS'] } }, cond:['aura:6', 'opt:"Shroudpsalm (Aura)"', 'choice:"At the start of your Command phase, select one of the abilities in the Canticles of the Omnissiah section."', 'timing:"start of your command phase"'] });
}
// "select one of the following" with bullets (option pick)
{
  const rs = readSource({ kind:'ability', name:'T', text:'In your Shooting phase, select one of the following abilities: [IGNORES COVER]; [LETHAL HITS]; [SUSTAINED HITS D3].' });
  check('inline options', rs[0], { status:'read' });
  assert.deepStrictEqual(rs[0].options.map(o => o.id), ['ignoresCover', 'lethal', 'sus']);
}

/* ---- ordinary sentences, one or more per faction ---- */
// Orks
check('orks riled', say("If this unit is **riled up**, this unit's ranged attacks have **[SUSTAINED HITS 1]**."), { status:'read', fx:['sus:1'], attack:'ranged', reach:{ type:'unit' }, cond:['riled'] });
check('orks melee D', say("**WARBOSS** model only. This model’s melee attacks have +1 **D**.".split('. ')[1]), { status:'read', fx:['d:1'], attack:'melee', reach:{ type:'self' } });
check('orks restriction', say('**WARBOSS** model only.'), { status:'read', kind:'restriction' });
check('orks InSv', say('That unit has 5+ InSv.', { ref:{ type:'riledUnit' } }), { status:'read', fx:['inv:5'], side:'defence', reach:{ type:'riledUnit' } });
check('orks weapon-target', say("In your Shooting phase, if this unit’s Blitzkannon weapon targets a unit (excluding **MONSTER/VEHICLE** units), that weapon has +6 **A**."),
  { status:'read', fx:['a:6'], cond:['phase:{"phase":"shooting","turn":"your"}', 'targetKw:{"none":["MONSTER","VEHICLE"]}', 'weapon:"blitzkannon"'] });
// World Eaters
check('we lethal', say('While this model is leading a unit, melee weapons equipped by models in that unit have the [LETHAL HITS] ability.'), { status:'read', fx:['lethal'], attack:'melee', reach:{ type:'ledUnit' }, cond:['leading'] });
check('we charge dev', say('Each time this model makes a Charge move, until the end of the turn, its melee weapons have the [DEVASTATING WOUNDS] ability.'), { status:'read', fx:['dev'], attack:'melee', cond:['charged'], duration:'end of the turn' });
// Tyranids
check('nids stealth aura', say('Friendly **TYRANIDS** units within 6" of this unit have **Stealth**.'), { status:'read', fx:['stealth'], reach:{ type:'aura', range:6, kw:{ any:['TYRANIDS'] } } });
check('nids T>T', say("This unit's melee attacks that target a unit with a T greater than this unit's T have +1 to wound rolls."), { status:'read', fx:['wound:1'], attack:'melee', cond:['targetTGreater'] });
// Adeptus Mechanicus
check('admech gear', say('Each time this model makes an attack with a belleros energy cannon that targets an INFANTRY unit, add 1 to the Hit roll.'), { status:'read', fx:['hit:1'], cond:['weapon:"belleros energy cannon"', 'targetKw:{"any":["INFANTRY"]}'] });
// Imperial Knights
check('knights damaged', say('While this model has 1-10 wounds remaining, subtract 5 from this model\'s Objective Control characteristic and each time this model makes an attack, subtract 1 from the Hit roll.'),
  { status:'read', fx:['ocMinus:5', 'hit:-1'], cond:['woundsRemaining:"1-10"'] });
check('knights inv ranged', say('This model has a 5+ invulnerable save against ranged attacks.'), { status:'read', fx:['invRanged:5'], side:'defence' });
// Necrons
check('necrons fnp', say('While a friendly **NECRONS VEHICLE** unit is within 6" of the bearer, that unit has the Feel No Pain 6+ ability.'), { status:'read', fx:['fnp:6'], reach:{ type:'aura', range:6, of:'the bearer', kw:{ all:['NECRONS', 'VEHICLE'] } } });
// Chaos Daemons
check('daemons T aura', say('While a friendly NURGLE LEGIONES DAEMONICA unit is within 6" of this model, add 1 to the Toughness characteristic of models in that unit.'), { status:'read', fx:['t:1'], side:'defence', reach:{ kw:{ all:['NURGLE', 'LEGIONES DAEMONICA'] } } });
// Chaos Space Marines: continuation sentence ("… as well") reads the previous sentence's attack
{
  const rs = readSource({ kind:'ability', name:'Warp-sighted Butcher', text:'While this model is leading a unit, each time a model in that unit makes a melee attack that targets a unit that is below its Starting Strength, you can re-roll the **Hit roll**. If that unit is **Below Half-strength**, you can re-roll the **Wound roll** as well.' });
  check('csm first', rs[0], { status:'read', fx:['rrHit'], attack:'melee', reach:{ type:'ledUnit' }, cond:['leading', 'targetBelowStarting'] });
  // the second sentence keeps the first one's conditions (leading, the target below its Starting Strength)
  check('csm as well', rs[1], { status:'read', fx:['rrWound'], attack:'melee', reach:{ type:'ledUnit' }, cond:['leading', 'targetBelowStarting', 'targetBelowHalf'] });
}
// Thousand Sons / psychic weapons
check('tsons psychic', say('Add 1 to the Strength and Damage characteristics of Psychic weapons equipped by the bearer.'), { status:'read', fx:['s:1', 'd:1'], attack:'psychic', reach:{ type:'bearer' } });
// Emperor's Children / defence 11th form
check('ec defence', say("Attacks that target this unit with a S greater than this unit's T have -1 to wound rolls."), { status:'read', fx:['woundMinus:1'], side:'defence', cond:['sOverT'] });
// Ultramarines-style damage reduction (10th form)
check('dmg -1', say('Each time an attack is allocated to the bearer, subtract 1 from the Damage characteristic of that attack.'), { status:'read', fx:['dmgMinus:1'], side:'defence', reach:{ type:'bearer' } });
// a stratagem read with its WHEN
{
  const rs = readSource({ kind:'stratagem', name:'Kustom Dakka', when:'Your Shooting phase, when a friendly **ORKS** unit is selected to shoot.', target:'That unit.', text:"Your unit's ranged attacks that target a unit (excluding **MONSTER/VEHICLE** units) have +1 to wound rolls." });
  check('strat', rs[0], { status:'read', fx:['wound:1'], attack:'ranged', reach:{ type:'unit', of:'stratagem target' }, cond:['targetKw:{"none":["MONSTER","VEHICLE"]}', 'phase:{"phase":"shooting","turn":"your"}', 'when:"Your Shooting phase, when a friendly ORKS unit is selected to shoot."'] });
}
// things the reader must NOT read
check('outside CP', say('At the start of your Command phase, if this model is on the battlefield, you gain 1CP.'), { status:'unread', reason:'^outside-vocabulary:command points' });
check('no antecedent', say("That unit's attacks can re-roll hit rolls of 1."), { status:'unread', reason:'^unparsed' });
check('partial is unread', say('While this model is leading a unit, add 1 to the Move characteristic of models in that unit and you can re-roll Advance rolls made for that unit.'), { status:'unread' });
check('rapid fire is outside', say("This unit's Snazzgun weapons have [RAPID FIRE 1]."), { status:'unread', reason:'weapon ability' });


/* ---- regressions from the review against GW: never looser than the sentence ---- */
{
  const { prepare } = require('./reader2.js');
  const all = prepare(require('./sources.js').listSources());
  const src = (owner, name) => { const x = all.find(x => x.owner === owner && x.name === name); assert.ok(x, owner + ' ' + name); return readSource(x); };
  const optOf = r => (r.conditions || []).filter(c => c.id === 'opt').map(c => c.v);
  const effects = rs => rs.filter(r => r.status === 'read' && r.kind === 'effect');
  const everyEffectHasOption = (name, rs) => { const bad = effects(rs).filter(r => !optOf(r).length); check(name + ': every effect is an option', { status:bad.length ? 'unread' : 'read' }, { status:'read' }); };
  // choices read as always on
  const tithe = src('det:world-eaters/khorne-daemonkin', 'Blood Tithe');
  everyEffectHasOption('Blood Tithe', tithe);
  check('Blood Tithe Boon of Blood', effects(tithe).find(r => r.effects[0].id === 'inv'), { status:'read', fx:['inv:4'], duration:'end of the battle' });
  assert.deepStrictEqual(optOf(effects(tithe).find(r => r.effects[0].id === 'inv')), ['Boon of Blood [4BTP]']);
  everyEffectHasOption('Synaptic Imperatives', src('det:tyranids/synaptic-nexus', 'Synaptic Imperatives'));
  everyEffectHasOption('Combat Doctrines', src('faction:ultramarines', 'Combat Doctrines'));
  assert.deepStrictEqual(optOf(effects(src('faction:ultramarines', 'Combat Doctrines'))[0]), ['DEVASTATOR DOCTRINE']);
  const gilded = src('det:adeptus-custodes/aquilan-shield', 'Gilded Guardians');
  check('Gilded Guardians additional effect', gilded.find(r => /\+6" R/.test(r.text)), { status:'unread', reason:'Additional Effect' });
  check('Gilded Guardians struck MONSTER', gilded[0], { status:'read', fx:['woundMinus:1'], reach:{ excluding:['VEHICLE'] }, cond:['onObjective', 'sOverT'] });
  const rage = src('ds:world-eaters/angron', 'Driven by Ultimate Rage');
  effects(rage).forEach(r => assert.deepStrictEqual(optOf(r), ['Driven by Ultimate Rage']));
  check('Angron pick', { status:effects(rage).length === 2 ? 'read' : 'unread' }, { status:'read' });
  const surge = src('det:chaos-knights/infernal-lance', 'Malefic Surge');
  everyEffectHasOption('Malefic Surge', surge);
  // round 4: read, as an option of Unnatural Fortitude, while Empowered, with the surge's terms attached
  const msInv = surge.find(r => /5\+ invulnerable/.test(r.text));
  check('Malefic Surge InSv is an option while Empowered', msInv, { status:'read', fx:['inv:5'], duration:'end of the phase' });
  assert.ok(msInv.conditions.some(c => c.id === 'factionState' && c.v.state === 'empowered'));
  assert.ok(msInv.conditions.find(c => c.id === 'choiceTerms').v.some(t => /Leadership test/.test(t)));
  const blade = src('det:adeptus-custodes/null-maiden-vigil', 'Anathema Blademastery');
  assert.deepStrictEqual(effects(blade).map(r => optOf(r)[0]), ['option 1 of 2: [Sustained Hits 1]', 'option 2 of 2: [Lethal Hits]']);
  // the unit an effect goes to
  const fury = src('det:world-eaters/khorne-daemonkin', 'Daemonic Fury');
  check('Daemonic Fury lance goes to the selected unit', fury[1], { status:'read', fx:['lance'], reach:{ type:'selected', kw:{ any:['WORLD EATERS'] }, range:6 } });
  // restrictions kept
  const thief = src('ds:chaos-space-marines/lord-discordant-on-helstalker', 'Spirit Thief');
  const sel = thief[1].conditions.find(c => c.id === 'selected');
  check('Spirit Thief keeps VEHICLE and visible', { status:sel && JSON.stringify(sel.v.kw) === '{"any":["VEHICLE"]}' && sel.v.qualifiers.includes('visible') ? 'read' : 'unread' }, { status:'read' });
  check('Spirit Thief timing', thief[1], { status:'read', fx:['rrWound1'], duration:'end of the phase' });
  check('Macro-extinction keeps MONSTER/VEHICLE', src('ds:imperial-knights/cerastus-knight-atrapos', 'Macro-extinction Protocols')[1],
    { status:'read', fx:['wound:1'], cond:['targetKw:{"any":["MONSTER","VEHICLE"]}', 'targetKw:{"any":["TITANIC","TOWERING"]}'] });
  const prince = src('det:chaos-daemons/shadow-legion', 'First Prince of Chaos');
  check('First Prince Stealth only for TZEENTCH', prince.find(r => /has Stealth/.test(r.text)),
    { status:'read', fx:['stealth'], cond:['onlyFor:{"kw":{"any":["SHADOW LEGION TZEENTCH"]},"of":"unit"}'] });
  // shapes added
  check('weapon ability with non-X', say("This unit's melee attacks have [Sustained Hits 1: non-Monster/Vehicle]."), { status:'read', fx:['sus:1'] });
  assert.deepStrictEqual(say("This unit's melee attacks have [Sustained Hits 1: non-Monster/Vehicle].").effects[0].only, { targetKw:{ none:['MONSTER', 'VEHICLE'] } });
  check('everyCrit', say('Each time a model in this unit makes a melee attack, if the target of that attack is Below Half-strength, a successful Hit roll scores a Critical Hit.'), { status:'read', fx:['everyCrit'], cond:['targetBelowHalf'] });
  check('halve A', say('While this unit\'s Szarekh model has 1-6 wounds remaining, halve the Attacks characteristic of that model\'s weapons.'), { status:'read', fx:['halveA'] });
  check('OC set', src('ds:tyranids/norn-assimilator', 'Singular Purpose')[4], { status:'read', fx:['fnp:5', 'OC:15'], duration:'end of the battle' });
  check('War Dog in Title Case', say('While a friendly War Dog model is within 6" of this model, ranged weapons equipped by that War Dog model have the [ASSAULT] ability.'), { status:'read', fx:['assault'], reach:{ type:'aura', kw:{ any:['WAR DOG'] } } });
  check('stratagem TARGET', src('det:adeptus-custodes/null-maiden-vigil', 'Anathema Blademastery')[1], { status:'read', reach:{ of:'stratagem target', targetKw:{ any:['VIGILATOR SQUAD'] } } });
  check('add N to models in that unit', src('ds:adeptus-mechanicus/cybernetica-datasmith', 'Battle Protocols').find(r => /Toughness/.test(r.text)),
    { status:'read', fx:['t:1'], reach:{ type:'ledUnit', modelKw:{ any:['KASTELAN ROBOT'] } } });
  const table = readSource({ kind:'ability', name:'T', text:'At the start of your Shooting phase, select one enemy unit within 12" of this model and roll one D6: on a 2-5, until the end of the phase, each time a model in that unit makes an attack, subtract 1 from the Hit roll; on a 6, until the end of the phase, each time a model in that unit makes an attack, subtract 2 from the Hit roll.' });
  check('dice table', table[0], { status:'read', kind:'diceTable' });
  assert.deepStrictEqual(table[0].outcomes.map(o => o.result + ':' + o.effects.map(e => e.id + e.v).join()), ['2-5:hit-1', '6:hit-2']);
  // the self-check refuses sentences it would read loosely
  check('self-check unless it cannot read', say('Each time this model makes an attack, add 1 to the Hit roll unless the moon is full.'), { status:'unread' });
  check('self-check "or" between effects', say('Each time this model makes an attack, add 1 to the Hit roll or add 1 to the Wound roll.'), { status:'unread' });
  check('no referent, no reading', say('Each time this model makes an attack that targets that unit, add 1 to the Hit roll.'), { status:'unread' });
}


/* ---- round 3: narrower-than-GW fix, rule tables, core stratagems, new shapes ---- */
{
  const { prepare } = require('./reader2.js');
  const all = prepare(require('./sources.js').listSources());
  const src = (owner, name) => { const x = all.find(x => x.owner === owner && x.name === name); assert.ok(x, owner + ' ' + name); return readSource(x); };
  const optOf = r => (r.conditions || []).filter(c => c.id === 'opt').map(c => c.v);
  // The Silent King: the hit penalty is the whole unit's, the halved Attacks the Szarekh model's
  const sk = src('ds:necrons/the-silent-king', 'Damaged: 1-6 wounds remaining')[0];
  check('Silent King per-effect reach', sk, { status:'read', fx:['halveA', 'hit:-1'] });
  assert.deepStrictEqual(sk.effects.map(e => e.reach.type), ['models', 'unit']);
  // rule tables
  const tdb = src('det:orks/dread-mob', 'Try Dat Button! › 3–4');
  check('Try Dat Button 3-4', tdb[1], { status:'read', fx:['s:2'], reach:{ type:'unit' } });
  assert.ok(tdb[1].conditions.some(c => c.id === 'roll' && c.v.result === '3-4'));
  const me = src('faction:world-eaters', 'Blessings of Khorne › Martial Excellence · double 4+ or triple 1+')[0];
  check('Blessings row', me, { status:'read', fx:['sus:1'], attack:'melee', duration:'end of the battle round' });
  assert.deepStrictEqual(optOf(me), ['Martial Excellence']);
  check('Pledges 5+', src('det:emperors-children/coterie-of-the-conceited', 'Pledges to the Dark Prince › 5+')[0], { status:'read', fx:['lethal', 'sus:1'] });
  check('Pledges 7+', src('det:emperors-children/coterie-of-the-conceited', 'Pledges to the Dark Prince › 7+')[0], { status:'read', fx:['critHit:5'] });
  const prot = src('faction:adeptus-mechanicus', 'Doctrina Imperatives › Protector Imperative');
  check('Doctrina Protector BS', prot[1], { status:'read', fx:['skill:1'], attack:'ranged', duration:'end of the battle round' });
  check('Doctrina Protector battleline6', prot[2], { status:'read', fx:['hitMinus:1'], attack:'melee' });
  assert.ok(prot[2].conditions.some(c => c.id === 'battleline6'));
  const ruin = src('faction:thousand-sons', 'Cabal of Sorcerers › Destiny’s Ruin (Psychic) · Warp Charge 5');
  check('Cabal ritual', ruin[1], { status:'read', fx:['rrHit1'], duration:'end of the phase' });
  assert.ok(ruin[2].conditions.some(c => c.id === 'test' && c.v.result === '10+'), 'test 10+');
  assert.ok(ruin[2].instead || ruin[2].continues);
  // core stratagems
  const cr = src('core', 'Command Re-roll')[0];
  check('Command Re-roll', cr, { status:'read', fx:['oneAny'] });
  assert.ok(cr.alsoOutsideVocabulary.length >= 4, 'other rolls listed');
  check('Epic Challenge', src('core', 'Epic Challenge')[1], { status:'read', fx:['precision'], attack:'melee', duration:'end of the phase' });
  check('Smokescreen', src('core', 'Smokescreen')[0], { status:'read', fx:['cover'], side:'defence', duration:'end of the phase' });
  check('Fire Overwatch', src('core', 'Fire Overwatch')[0], { status:'unread', reason:'snap shooting' });
  // shapes
  const fk = src('ds:orks/flash-gitz', 'Finderz Keeperz');
  check('if any of the following apply', fk[0], { status:'read', fx:['ap:1'], attack:'ranged' });
  assert.deepStrictEqual(fk[0].conditions.find(c => c.id === 'anyOf').v.map(c => c.id), ['onObjective', 'targetObjective']);
  const hos = src('ds:thousand-sons/daemon-prince-of-tzeentch-with-wings', 'Hunter of Souls')[0];
  check('bracketed instead', hos, { status:'read', fx:['rrHit1', 'rrWound1'] });
  assert.deepStrictEqual(hos.alternatives[0].effects.map(e => e.id), ['rrHit', 'rrWound']);
  assert.ok(hos.alternatives[0].conditions.some(c => c.id === 'targetKw' && JSON.stringify(c.v).includes('PSYKER')));
  check('long trigger', src('ds:chaos-daemons/nurglings', 'Mischief Makers')[0], { status:'read', fx:['hit:-1'], attack:'melee', reach:{ type:'triggeringEnemy' }, duration:'end of the phase', debuff:true });
  const bb = src('det:world-eaters/khorne-daemonkin', 'Blessing of Burning Blood');
  check('ability active', bb[1], { status:'read', fx:['inv:4'], duration:'end of the phase' });
  assert.ok(bb[1].conditions.some(c => c.id === 'abilityActive'));
  check('test passed', say('If that test is passed, until the end of the phase, this model has a 4+ invulnerable save.'), { status:'read', fx:['inv:4'], cond:['test:{"test":"that test","passed":true}'], duration:'end of the phase' });
  check('that unit after a selection', src('ds:tyranids/broodlord', 'Hypnotic Gaze')[1], { status:'read', fx:['hit:-1'], debuff:true, duration:'end of the phase' });
  check('lethal on MONSTER/VEHICLE only', say("Your unit's melee attacks have [LETHAL HITS: MONSTER/VEHICLE]."), { status:'read', fx:['lethal'] });
  // an unread selection clears older referents
  const cleared = readSource({ kind:'ability', name:'T', text:'While this model is leading a unit, models in that unit have Stealth. At the start of your Shooting phase, select one enemy unit that lurks in the shadows. Until the end of the phase, each time a model in that unit makes an attack, subtract 1 from the Hit roll.' });
  check('unread selection clears referents', cleared[2], { status:'unread' });
}


/* ---- round 4 ---- */
{
  const { prepare } = require('./reader2.js');
  const all = prepare(require('./sources.js').listSources());
  const src = (owner, name) => { const x = all.find(x => x.owner === owner && x.name === name); assert.ok(x, owner + ' ' + name); return readSource(x); };
  // The Silent King: the sentence's reach is the unit (the counted -1 to Hit); only halveA is on the Szarekh model
  const sk = src('ds:necrons/the-silent-king', 'Damaged: 1-6 wounds remaining')[0];
  check('Silent King top-level reach is the unit', sk, { status:'read', reach:{ type:'unit' } });
  assert.strictEqual(sk.effects.find(e => e.id === 'hit').reach.type, 'unit');
  assert.strictEqual(sk.effects.find(e => e.id === 'halveA').reach.name, 'szarekh');
  // unless
  const eng = src('ds:adeptus-mechanicus/tech-priest-enginseer', 'Enginseer')[0];
  check('unless leading', eng, { status:'read', fx:['loneOp'] });
  assert.ok(eng.conditions.some(c => c.id === 'leading' && c.negated));
  check('unless battle-shocked', src('det:adeptus-mechanicus/cohort-cybernetica', 'Cyber-psalm Programming')[1], { status:'read', fx:['ocAdd:1'] });
  assert.ok(src('det:adeptus-mechanicus/cohort-cybernetica', 'Cyber-psalm Programming')[1].conditions.some(c => c.id === 'notShocked'));
  check('unless at the end', say('Each time this model makes an attack, add 1 to the Hit roll unless that attack targets a VEHICLE unit.'), { status:'read', fx:['hit:1'] });
  // re-roll lists
  const pa = src('det:tyranids/invasion-fleet', 'Perfectly Adapted')[1];
  check('re-roll list', pa, { status:'read', fx:['oneAny'], reach:{ type:'bearer' } });
  assert.deepStrictEqual(pa.alsoOutsideVocabulary, ['re-roll one advance roll', 're-roll one charge roll', 're-roll one save roll']);
  // If they do, change the Damage … to 0
  check('if they do, damage 0', src('det:adeptus-mechanicus/cohort-cybernetica', 'Necromechanic')[2], { status:'read', fx:['dmg0'], side:'defence', reach:{ type:'aura', range:12 } });
  // faction states as named conditions
  check('dreadful foe', src('det:adeptus-custodes/auric-champions', 'Assemblage of Might')[1], { status:'read', fx:['wound:1'], cond:['targetState:"dreadful foe"'] });
  check('Shadow of Chaos', src('det:chaos-daemons/daemonic-incursion', 'A’rgath, the King of Blades')[2], { status:'read', fx:['a:2', 's:2'] });
  check('Bondsman grant', src('faction:imperial-knights', 'Bondsman')[3], { status:'read', kind:'grantsAbility', duration:'start of your next command phase' });
  // Diabolic Power: "the selected ability" is one of the two
  const dp = src('det:chaos-knights/infernal-lance', 'Malefic Surge').find(r => /the selected ability/.test(r.text));
  check('Diabolic Power', dp, { status:'read', duration:'end of the phase' });
  assert.deepStrictEqual(dp.options.map(o => o.id), ['lethal', 'sus']);
  // ignoring wound-roll modifiers has its own id
  const salvus = src('faction:adeptus-custodes', 'Martial Ka’tah › Salvus');
  check('Salvus BS', salvus.find(r => r.text === 'BS.'), { status:'read', fx:['ignoreSkillMods'] });
  check('Salvus hit and wound', salvus.find(r => /Hit rolls and wound rolls/.test(r.text)), { status:'read', fx:['ignoreHitRollMods', 'ignoreWoundMods'] });
  // the six "that unit" sentences of round 3
  check('Irresistible Will: the TARGET\'s enemy unit', src('det:tyranids/synaptic-nexus', 'Irresistible Will')[0], { status:'read', fx:['rrHit1', 'rrWound1'], duration:'end of the phase' });
  check('Warpmeld Sacrifice', src('det:thousand-sons/warpmeld-pact', 'Warpmeld Sacrifice')[1], { status:'read', fx:['woundMinus:1'], duration:'end of the phase' });
  check('Seed Spore Mines is outside', src('ds:tyranids/biovores', 'Seed Spore Mines')[2], { status:'unread', reason:'^outside' });
  // once per battle round is not once per battle
  assert.ok(src('det:adeptus-mechanicus/cohort-cybernetica', 'Necromechanic')[2].conditions.some(c => c.id === 'oncePer' && c.v === 'battle round'));
  assert.ok(!src('det:adeptus-mechanicus/cohort-cybernetica', 'Necromechanic')[2].conditions.some(c => c.id === 'oncePerBattle'));
}

/* ---- round 5: phrasings agree.js reported as falling back (each family: a GW sentence, verbatim) ---- */
{
  const { prepare } = require('./reader2.js');
  const all = prepare(require('./sources.js').listSources());
  const src = (owner, name) => { const x = all.find(x => x.owner === owner && x.name === name); assert.ok(x, owner + ' ' + name); return readSource(x); };
  const strat = (when, target, effect) => readSource({ kind:'stratagem', name:'Test', when, target, text:effect });
  // 1. each-time subjects. Adrenal Surge (Tyranids, Invasion Fleet): "Until the end of the phase, each time a model in any of those
  //    selected units makes an attack, an unmodified Hit roll of 5+ scores a Critical Hit." (those selected units: the TARGET)
  const as = strat('Fight phase.', 'Up to two **TYRANIDS** units from your army that are within Synapse Range of your army and are eligible to fight, or one other **TYRANIDS** unit from your army that is eligible to fight.',
    'Until the end of the phase, each time a model in any of those selected units makes an attack, an unmodified **Hit roll** of 5+ scores a Critical Hit.')[0];
  check('any of those selected units', as, { status:'read', fx:['critHit:5'], reach:{ type:'unit', of:'stratagem target' }, duration:'end of the phase' });
  assert.ok(/or one other TYRANIDS unit/.test(as.reach.targetQualifier), 'the whole TARGET is kept');
  // Archagonists (Legion of Excess): "… each time a model in one of those units makes an attack, add 1 to the Wound roll."
  check('one of those units', src('det:chaos-daemons/legion-of-excess', 'Archagonists')[0], { status:'read', fx:['wound:1'], reach:{ type:'unit', of:'stratagem target' } });
  // never an enemy selection
  check('one of those units: not an enemy', readSource({ kind:'ability', name:'Test', text:'Select one enemy unit within 12" of this model. Each time a model in one of those units makes an attack, add 1 to the Wound roll.' })[1], { status:'unread' });
  // Murderous Imperative (Eradication Cohort): "Each time a model in a SKITARII unit from your army makes an attack:" + "If the Protector
  //    Imperative is active for that unit, re-roll a Hit roll of 1."
  const mi = src('det:adeptus-mechanicus/eradication-cohort', 'Murderous Imperative');
  check('a model in a X unit from your army', mi[1], { status:'read', fx:['rrHit1'], reach:{ type:'army', kw:{ any:['SKITARII'] } }, cond:['abilityActive:"protector imperative"'] });
  check('a model in a X unit from your army (2)', mi[2], { status:'read', fx:['rrWound1'], cond:['abilityActive:"conqueror imperative"'] });
  // Excessive Assault (Infractors): "Each time a model in this unit targets an enemy unit with a melee attack, re-roll a Wound roll of 1.
  //    If that enemy unit is within range of an objective marker, you can re-roll the Wound roll instead."
  const ea = readSource({ kind:'ability', name:'Test', text:'Each time a model in this unit targets an enemy unit with a melee attack, re-roll a **Wound roll** of 1. If that enemy unit is within range of an objective marker, you can re-roll the Wound roll instead.' });
  check('targets X with a melee attack', ea[0], { status:'read', fx:['rrWound1'], attack:'melee', reach:{ type:'unit' } });
  check('targets X with a melee attack, instead', ea[1], { status:'read', fx:['rrWound'], attack:'melee', cond:['targetObjective'] });
  assert.ok(ea[1].instead);
  // Synapse (Tyranids): "While a TYRANIDS unit from your army is within Synapse Range of your army:" + "Each time a model in that unit makes
  //    a melee attack, add 1 to the Strength characteristic of that attack."
  check('within Synapse Range', src('faction:tyranids', 'Synapse')[3], { status:'read', fx:['s:1'], attack:'melee', reach:{ type:'army', kw:{ any:['TYRANIDS'] } }, cond:['synapse'] });
  // 2. a clause outside the vocabulary joined by "and". Errant's Duty: "While a model is affected by this ability, you can re-roll Advance
  //    rolls made for that model and ranged weapons equipped by that model have the [ASSAULT] ability."
  const ed = say('While a model is affected by this ability, you can re-roll **Advance rolls** made for that model and ranged weapons equipped by that model have the **[ASSAULT]** ability.');
  check('outside and vocabulary', ed, { status:'read', fx:['assault'], attack:'ranged', reach:{ type:'affectedModel' } });
  assert.deepStrictEqual(ed.alsoOutsideVocabulary, ['you can re-roll advance rolls made for that model']);
  // Phaeron of the Blades: "… you can re-roll Charge rolls made for that unit and each time a model in that unit makes a melee attack, add 1
  //    to the Strength characteristic of that attack."
  check('outside and vocabulary (charge)', say('While a friendly **NECRONS** unit (excluding **MONSTER** units) is within 6" of this unit’s Szarekh model, you can re-roll **Charge rolls** made for that unit and each time a model in that unit makes a melee attack, add 1 to the Strength characteristic of that attack.'),
    { status:'read', fx:['s:1'], attack:'melee', reach:{ type:'aura', range:6, kw:{ any:['NECRONS'] }, excluding:['MONSTER'] }, cond:['aura:6'] });
  // Omnissiah's Blessing: "That model regains up to D3 lost wounds and, if it is a VEHICLE model, until the start of your next Command
  //    phase, that model has the Feel No Pain 5+ ability." (the FNP only for a VEHICLE)
  const ob = src('ds:adeptus-mechanicus/tech-priest-enginseer', 'Omnissiah’s Blessing')[1];
  check('regains wounds and, if VEHICLE, FNP', ob, { status:'read', fx:['fnp:5'], reach:{ type:'selected' }, duration:'start of your next command phase' });
  assert.ok(ob.conditions.some(c => c.id === 'selfKw' && c.v === 'VEHICLE'));
  // Master of Mechanisms: "That VEHICLE model regains up to D3 lost wounds and, until the start of your next Command phase, each time that
  //    VEHICLE makes an attack, add 1 to the Hit roll."
  check('regains wounds and +1 hit', src('ds:chaos-space-marines/warpsmith', 'Master of Mechanisms')[1], { status:'read', fx:['hit:1'], reach:{ type:'selected' }, duration:'start of your next command phase' });
  // Savage Roar: "That enemy unit must take a Battle-shock test and, until the end of the phase, each time a model in that enemy unit makes
  //    an attack that targets your unit, subtract 1 from the Hit roll." / "If that Battle-shock test was failed, subtract 1 from the Wound
  //    roll as well."
  const sr = src('det:tyranids/crusher-stampede', 'Savage Roar');
  check('battle-shock test and -1 hit', sr[0], { status:'read', fx:['hit:-1'], debuff:true, duration:'end of the phase' });
  check('if that test was failed, -1 wound as well', sr[1], { status:'read', fx:['wound:-1'], debuff:true });
  assert.ok(sr[1].conditions.some(c => c.id === 'test' && c.v.passed === false));
  // 3. named weapons. Super Runts: "This unit’s Scavenged Shivs weapons have +1 A, WS and S."
  check('+1 A, WS and S', say('This unit’s Scavenged Shivs weapons have +1 **A**, **WS** and **S**.'), { status:'read', fx:['a:1', 'skill:1', 's:1'], cond:['weapon:"scavenged shivs"'] });
  // Skarbrand: "While this model has 1-7 wounds remaining, add 2 to the Attacks characteristic of this model’s Slaughter and Carnage."
  check('a weapon named X and Y', say('While this model has 1-7 wounds remaining, add 2 to the Attacks characteristic of this model’s Slaughter and Carnage.'), { status:'read', fx:['a:2'], cond:['woundsRemaining:"1-7"', 'weapon:"slaughter and carnage"'] });
  // Aetherstride: "Until the end of the turn, its Dark Blessing has the [SUSTAINED HITS D3] ability." (its: this model, set up by Deep Strike)
  check('its named weapon', src('ds:thousand-sons/daemon-prince-of-tzeentch-with-wings', 'Aetherstride')[3], { status:'read', fx:['sus:D3'], reach:{ type:'self' }, duration:'end of the turn' });
  // Daemonic Ordnance: "If it does, until the end of the phase, its ranged weapons have the [DEVASTATING WOUNDS] and [HAZARDOUS] abilities."
  check('its ranged weapons', src('ds:chaos-space-marines/forgefiend', 'Daemonic Ordnance')[1], { status:'read', fx:['dev', 'hazardous'], attack:'ranged', reach:{ type:'self' } });
  // Skullmaster's Fury: "While this model is leading a unit, each time that unit ends a Charge move, until the end of the turn, Juggernaut’s
  //    bladed horns equipped by models in that unit have the [DEVASTATING WOUNDS] ability."
  check('named weapon equipped by', say('While this model is leading a unit, each time that unit ends a **Charge move**, until the end of the turn, Juggernaut’s bladed horns equipped by models in that unit have the **[DEVASTATING WOUNDS]** ability.'),
    { status:'read', fx:['dev'], reach:{ type:'ledUnit' }, cond:['leading', 'charged', 'weapon:"juggernaut\'s bladed horns"'], duration:'end of the turn' });
  // Vengeance for the Omnissiah: "If a friendly ADEPTUS MECHANICUS VEHICLE model is destroyed within 12" of this model, until the end of the
  //    battle, this model’s Omnissian axe has an Attacks characteristic of 6."
  check('a named weapon set to A 6', say('If a friendly **ADEPTUS MECHANICUS VEHICLE** model is destroyed within 12" of this model, until the end of the battle, this model’s Omnissian axe has an Attacks characteristic of 6.'),
    { status:'read', fx:['aSet:6'], duration:'end of the battle', cond:['friendlyDestroyed:{"kw":{"all":["ADEPTUS MECHANICUS","VEHICLE"]},"of":"model","within":12,"near":"this model"}', 'weapon:"omnissian axe"'] });
  // 4. the self-check. Burning Spray: "Until the end of the phase, that enemy unit cannot have the Benefit of Cover." (ignoresCover is it)
  check('cannot have the Benefit of Cover', src('ds:tyranids/pyrovores', 'Burning Spray')[1], { status:'read', fx:['ignoresCover'], duration:'end of the phase' });
  // Parasitic Biomorphology: "The first time the bearer’s unit destroys an enemy unit in the Fight phase while the bearer is within 6" of one
  //    or more friendly HARVESTER units, until the end of the battle, add 1 to the Attacks characteristic of melee weapons equipped by models in
  //    the bearer’s unit." (the "while" is the trigger's own words)
  const pb = say('The first time the bearer’s unit destroys an enemy unit in the Fight phase while the bearer is within 6" of one or more friendly **HARVESTER** units, until the end of the battle, add 1 to the Attacks characteristic of melee weapons equipped by models in the bearer’s unit.');
  check('a while inside the first time', pb, { status:'read', fx:['a:1'], attack:'melee', reach:{ type:'bearerUnit' }, duration:'end of the battle' });
  assert.ok(/while the bearer is within 6/.test(pb.conditions.find(c => c.id === 'firstTime').v));
  // a "while" outside the trigger still needs its condition
  check('a while outside the first time', say('The first time this unit is destroyed, while the bearer is within 6" of a ruin, add 1 to the Hit roll.'), { status:'unread' });
  // Psychological Saboteur: "Each time a friendly TYRANIDS model makes an attack that targets that unit, add 1 to the Wound roll." (under
  //    "While an enemy unit is within 12" of this model, if that unit is Battle-shocked:"): the attacker is the TYRANIDS model (reach2)
  const ps = src('ds:tyranids/neurolictor', 'Psychological Saboteur')[2];
  check('friendly attacker of an enemy aura', ps, { status:'read', fx:['wound:1'], reach:{ type:'enemyAura', range:12 } });
  assert.deepStrictEqual(ps.reach2.kw, { any:['TYRANIDS'] });
  // 5. unit states. Dark Zealotry: "While this unit is leading a unit and contains a DARK APOSTLE model, each time a model in that unit makes
  //    a melee attack, add 1 to the Wound roll."
  check('leading and contains', say('While this unit is leading a unit and contains a **DARK APOSTLE** model, each time a model in that unit makes a melee attack, add 1 to the **Wound roll**.'),
    { status:'read', fx:['wound:1'], attack:'melee', reach:{ type:'ledUnit' }, cond:['leading', 'contains:"DARK APOSTLE"'] });
  // Strength from Exile: "Until the end of the phase, each time a model in your unit makes an attack, if there are no other friendly units
  //    within 9" of your unit, re-roll a Hit roll of 1 and re-roll a Wound roll of 1."
  const se = say('Until the end of the phase, each time a model in your unit makes an attack, if there are no other friendly units within 9" of your unit, re-roll a **Hit roll** of 1 and re-roll a **Wound roll** of 1.');
  check('no other friendly units within', se, { status:'read', fx:['rrHit1', 'rrWound1'] });
  assert.ok(se.conditions.some(c => c.id === 'nearFriendly' && c.negated && c.v.d === 9 && c.v.other));
  // Moritoi Ancients: "While a friendly ADEPTUS CUSTODES DREADNOUGHT unit is at starting strength, that unit has +2 OC."
  check('at starting strength', say('While a friendly **ADEPTUS CUSTODES DREADNOUGHT** unit is at starting strength, that unit has +2 **OC**.'),
    { status:'read', fx:['ocAdd:2'], reach:{ type:'friendly', kw:{ all:['ADEPTUS CUSTODES', 'DREADNOUGHT'] } }, cond:['atStarting'] });
  // Enraged Behemoths: "In addition, while a TYRANIDS MONSTER unit from your army (excluding Battle-shocked units) is at its Starting
  //    Strength, add 2 to the Objective Control characteristic of models in that unit."
  check('at its starting strength, excluding battle-shocked', src('det:tyranids/crusher-stampede', 'Enraged Behemoths')[1], { status:'read', fx:['ocAdd:2'], reach:{ type:'army' }, cond:['atStarting', 'notShocked'] });
  // 6. referents. Encroaching Darkness: "Until the end of the phase, weapons equipped by models in your selected units have the [IGNORES
  //    COVER] ability."
  check('your selected units', src('det:chaos-daemons/shadow-legion', 'Encroaching Darkness')[0], { status:'read', fx:['ignoresCover'], reach:{ type:'unit', of:'stratagem target' } });
  // Draught of Terror: "In addition, until the end of the phase, each time such a weapon targets a unit that is Battle-shocked, you can
  //    re-roll the Wound roll."
  check('such a weapon targets', src('det:chaos-daemons/daemonic-incursion', 'Draught of Terror')[1], { status:'read', fx:['rrWound'], cond:['targetBattleShocked', 'phase:{"phase":"shooting|fight","turn":"your|either"}', 'when:"Your Shooting phase or the Fight phase."'], duration:'end of the phase' });
  // 7. Unshakeable Opponents: "Until the end of the turn, each time a model in your unit makes an attack, you can ignore any or all
  //    modifiers to the following: that attack’s Ballistic Skill or Weapon Skill characteristic; the Hit roll; the Wound roll."
  check('ignore modifiers to the following', say('Until the end of the turn, each time a model in your unit makes an attack, you can ignore any or all modifiers to the following: that attack’s Ballistic Skill or Weapon Skill characteristic; the **Hit roll**; the **Wound roll**.'),
    { status:'read', fx:['ignoreHitMods', 'ignoreWoundMods'], duration:'end of the turn' });
}

console.log(`${pass} passed, ${fail} failed`);
if(fail) process.exitCode = 1;
