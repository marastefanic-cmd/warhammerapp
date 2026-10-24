/* =====================================================================
   Warhammer companion: data.
   One file holds every army plus the faction and core rules they use, as tables
   (docs/tables.md; verify/columns.json says where every column comes from):
   RULES, CORE_STRATAGEMS, FACTIONS (detachments, stratagems, enhancements, army
   rules), ARMIES (each list, its unit entries holding what the list chose),
   DATASHEETS (each datasheet's facts, shared by every list that has it),
   RULE_OPTIONS and GRANTS (read from the rules' words by verify/derive.js).
   To add an army: node verify/add-army.js <list.pdf> (README.md): the list is
   written in full and verify/tables.js --write makes each unit a reference to
   its datasheet; add any new detachments, rules or aliases to FACTIONS / RULES /
   RULE_ALIASES, bump VERSION, then run `node build.js`.
   (build.js stamps a content hash, so installed apps reload on any change.)

   Text markup used in rules text:
     **bold**   ~~struck through~~   - a line starting "- " is a bullet   - *italic line*
   Phases: command | movement | shooting | charge | fight
   Turn:   your | opp | either;  turns:{ phase:turn } overrides it for one phase
   (Try Dat Button! is "your Shooting phase or the Fight phase": turn either, turns {shooting:'your'}).
===================================================================== */
window.WH_DATA = (function(){

const VERSION = '2026-10-24.1';

/* ---------------- core rules (11th edition) ---------------- */
// Weapon keyword and core ability text: the official Core Rules PDF (11th edition), BSData and the
// Wahapedia rules appendix where marked "(app)"
// (Snap Shooting and Actions from Wahapedia's core rules, 15.09 and 16; a line only Wahapedia's core rules have is marked
// "*Wahapedia core rules (not in GW’s Core Rules PDF, 01-06): …*").
const RULES = {
  // Orks terms (Wahapedia Orks page; RULE_SRC says where): the pulse jet move Wazdakka's Pulse Jet allows,
  // and [SUPA-HAZARDOUS], which the Shoota Boyz enhancement Supa-glowy Fing defines
  'Pulse Jet Move': '**MAXIMUM DISTANCE:** Pulse roll + 18"\n**ELIGIBLE IF:** As stated in the rule allowing this move type.\n**EFFECT:** Your unit moves as described in Moving (Core Rules, 03).\n**BEFORE MOVING:**\n- Make a **pulse roll** by rolling one D6.\n**WHILE MOVING:**\n- Ignore all vertical distance for the purposes of how far your unit has moved.\n- Your unit can move through all types of model.\n- Your unit can move horizontally and vertically through all categories of terrain feature.\n**AFTER MOVING:**\n- Your unit must be unengaged.\n- Until the end of the turn, your unit is not eligible to declare a charge or start an action.\n- Until the start of your next turn, attacks that target your unit have -1 to hit rolls.',
  'Supa-hazardous': 'Each time a unit is **selected to shoot**, after that unit has resolved all of its attacks, make two **hazard rolls** for that unit for each **[SUPA-HAZARDOUS]** weapon you selected in the Select Weapons step.',
  'Assault': 'Units containing one or more models with an **[ASSAULT]** weapon can shoot using **assault shooting** (10.05).',
  'Blast': 'Each time you gather **attack dice** for a **[BLAST]** weapon, add one additional **attack dice** for every five models that were in the target unit in the Select Targets step (rounding down).\nIf this ability takes the form **[BLAST X]**, each time you gather **attack dice** for such a weapon, add **X** additional **attack dice** for every five models that were in the target unit in the Select Targets step (rounding down) instead.\n*Example: If a [BLAST 2] weapon with an A characteristic of 3 targets a unit containing 12 models, you would gather four additional attack dice for that weapon (for a total of seven for that weapon).*',
  'Cleave': 'This ability always takes the form **[CLEAVE X]**. Each time you gather **attack dice** for a **[CLEAVE]** weapon, if you only selected one target for all of that weapon’s attacks, add **X** additional **attack dice** for every five models that were in the target unit in the Select Targets step (rounding down).\n*Example: If a [CLEAVE 1] weapon with an A characteristic of 3 targets one unit containing 16 models, you would gather three additional attack dice for that weapon (for a total of six for that weapon).*',
  'Close-quarters': 'Units containing one or more models with a **[CLOSE-QUARTERS]** weapon can shoot using **close-quarters shooting** (10.06). When using another **shooting type**, for each model in that unit (excluding **MONSTER/VEHICLE** models), you can only select one of the following to make attacks with:\n- One or more of its **[CLOSE-QUARTERS]** weapons.\n- One or more of its other ranged weapons.\n*[PISTOL] and [CLOSE-QUARTERS] are identical for all rules purposes.*',
  'Devastating Wounds': 'Each time an attack made with a **[DEVASTATING WOUNDS]** weapon results in a **critical wound**, the attack sequence for that attack ends and the target unit suffers a number of **mortal wounds** equal to the **D** characteristic of that weapon. These are inflicted after resolving any normal damage inflicted by those attacks.\n**Mortal wounds** inflicted by **[DEVASTATING WOUNDS]** weapons can damage a maximum of one model for each **critical wound**; any remaining **mortal wounds** inflicted by that attack are lost.',
  'Extra Attacks': 'Each time a unit containing one or more models with an **[EXTRA ATTACKS]** weapon fights, those models will make attacks with those weapons in addition to any others. In the Select Weapons step (04.01), for each of those models, you must select:\n- All of that model’s **[EXTRA ATTACKS]** weapons.\n- One of that model’s other melee weapons, if possible.',
  'Harpooned': 'When this unit **declares a charge**, if an enemy **MONSTER/VEHICLE** unit is within 12" of this unit and was hit by an attack made by this weapon this turn, you can use this ability. If you do:\n- This unit has +2 to **charge rolls** until the end of the phase.\n- This unit must end that **charge move engaged** with that **MONSTER/VEHICLE** unit.',
  'Hazardous': 'Each time a unit is **selected to shoot** or **selected to fight**, after that unit has resolved all of its attacks, make a number of **hazard rolls** (06.03) for that unit equal to the number of **[HAZARDOUS]** weapons you selected in the Select Weapons step.',
  'Heavy': 'In your Shooting phase, each time an attack is made with a **[HEAVY]** weapon, add 1 to the **hit roll** if all of the following apply to the attacking unit:\n- That unit is **unengaged**.\n- That unit was not set up on the battlefield this turn.\n- No model in that unit has moved more than 3" this turn.',
  'Ignores Cover': 'Each time an attack is made with an **[IGNORES COVER]** weapon, the target cannot have the **benefit of cover** against that attack (13.08), including from rules that give a model or unit the **benefit of cover** (e.g. **Stealth**).',
  'Infiltrators': 'During deployment, if every model in a unit has this ability, it can be set up anywhere on the battlefield that is more than 8" horizontally from your opponent’s deployment zone and all enemy units.',
  'Lethal Hits': 'Each time an attack made with a **[LETHAL HITS]** weapon results in a **critical hit**, you can choose for that attack to automatically wound the target.\n*Designer’s Note: Choosing to automatically wound the target means that no wound roll is made for that attack. You may decide against this, as it means that attack cannot result in a critical wound and so cannot trigger other abilities such as [DEVASTATING WOUNDS].*',
  'Precision': 'While resolving attacks made with one or more **[PRECISION]** weapons, at the start of the Allocation Order step (05.03), if the target unit contains one or more **CHARACTER** models **visible** to one or more of the attacking models, the active player can select one allocation group that contains one of those **visible CHARACTER** models. If they do, until those attacks are resolved, or until that **CHARACTER** group is **destroyed** (whichever happens first), that **CHARACTER** group is the current allocation group.\n**24.28.01 Precision and Devastating Wounds (app):** **Mortal Wounds** inflicted by a **[PRECISION]** attack with the **[DEVASTATING WOUNDS]** ability are first applied to the **CHARACTER** group that was selected for those **[PRECISION]** attacks (if that group is not already **destroyed**).',
  'Rapid Fire': 'This ability always takes the form **[RAPID FIRE X]**. Each time you gather **attack dice** for a **[RAPID FIRE]** weapon, add **X** additional **attack dice** if the target unit was within half range of that weapon in the Select Targets step.',
  'Sustained Hits': 'This ability always takes the form **[SUSTAINED HITS X]**. Each time an attack made with a **[SUSTAINED HITS]** weapon results in a **critical hit**, that attack results in a number of additional hits on the target as denoted by **X**.',
  'Torrent': 'Each time an attack is made with a **[TORRENT]** weapon, that attack automatically hits the target.',
  'Twin-linked': 'Each time an attack is made with a **[TWIN-LINKED]** weapon, you can re-roll the **wound roll**.',
  'Anti': 'This ability always takes the form **[ANTI-X Y+]**. Each time an attack is made with an **[ANTI]** weapon, if the target unit has the keyword denoted by **X**, an unmodified **wound roll** of **Y+** is a **critical wound**.\n*Example: An attack made with an [ANTI-VEHICLE 4+] weapon against a VEHICLE unit will result in a critical wound on an unmodified wound roll of 4+, while an attack made with an [ANTI-PSYKER 2+] weapon against a PSYKER unit will result in a critical wound on an unmodified wound roll of 2+.*',
  'Hunter': '**04.01.03 Multiple Weapon Profiles (app):** In the Select Weapons step (04.01), if a selected weapon has more than one profile, then the controlling player must also select one of those profiles. The selected profile is then used in the Resolve Attacks step (04.03).\nSome of these profiles are known as **Hunter** profiles. **Hunter** profiles can only target units with the specified keywords.\nNote that if a unit is equipped with more than one such weapon, a different profile can be selected for each model within that unit.\n*App note, not rules text: New Recruit prints these weapons as two profiles, one marked “Hunter: MONSTER/VEHICLE”. That profile can only target MONSTER or VEHICLE units. The Hunter rule is in the rules appendix of the Warhammer 40,000 app (Wahapedia 04.01.03), not in the printed Core Rules.*',

  'Deep Strike': 'Each time this unit makes an **ingress move** (20.04), if every model in this unit has this ability, it can be set up anywhere on the battlefield that is more than 8" horizontally from all enemy units, even if that is within your opponent’s deployment zone.\n*App note, not rules text: unless a rule says otherwise, units in strategic reserves can only make an ingress move from the second battle round onwards, and any that have not made an ingress move by the end of the third battle round are destroyed, except repositioned units and units embarked within a TRANSPORT that has made an ingress move (Strategic Reserves, 20.03).*',
  'Deadly Demise': 'This ability always takes the form **Deadly Demise X**. Each time a model in this unit is **destroyed**, after the units embarked within it (if any) have made their **emergency disembark moves**, roll one D6. On a 6, that model suffers a **deadly demise**; each unit within 6" of that model suffers a number of **mortal wounds** denoted by **X** (if this is a random number, roll separately for each unit within 6").',
  'Damaged': '*Wahapedia core rules (24.39, not in GW’s Core Rules PDF, 01-06): This ability always takes the form Damaged X. While a model’s remaining wounds are equal to or less than X, that model is damaged: while damaged, that model’s attacks have -1 to hit rolls.*',
  'Feel No Pain': 'This ability always takes the form **Feel No Pain X+**. Each time a model with this ability would lose a wound, roll one D6: on an **X+**, that wound is not lost.',
  'Leader': 'Before the battle, in the Muster Armies step, for each **leader** and **support** unit in your army, you can select one friendly **bodyguard** unit that unit can **lead**. That unit will then **lead** that **bodyguard** unit for the battle and form an **attached** unit with it.\nUnless otherwise stated, each **bodyguard** unit can only have one **leader** unit and one **support** unit attached to it.',
  'Support': 'Before the battle, in the Muster Armies step, for each **leader** and **support** unit in your army, you can select one friendly **bodyguard** unit that unit can **lead**. That unit will then **lead** that **bodyguard** unit for the battle and form an **attached** unit with it.\nUnless otherwise stated, each **bodyguard** unit can only have one **leader** unit and one **support** unit attached to it.',
  'Lone Operative': 'Unless part of an **attached** unit, this unit is not **visible** to enemy models unless they are within 12" of this unit, and it cannot be targeted by **[INDIRECT FIRE]** weapons unless the attacking model is within 12" of this unit.\nIf this ability takes the form **Lone Operative X"**, unless part of an **attached** unit, this unit is not **visible** to enemy models unless they are within **X"** of this unit, and it cannot be targeted by **[INDIRECT FIRE]** weapons unless the attacking model is within **X"** of this unit.\n**24.24.01 Attached units and Lone Operative (app):** If all models in an attached unit have Lone Operative, that unit will benefit from **Lone Operative**.\nIf a unit has **Lone Operative**, but models in that unit have different range values for **Lone Operative**, the highest value amongst that unit’s models on the battlefield is applied to the whole unit.\nIf an **attached** unit **below starting strength** only contains models with **Lone Operative**, **Lone Operative** becomes active again.',
  'Fights First': 'While every model in a unit has this ability, that unit is a **Fights First** unit.\nSee the Resolve Fights First Combats step in the Fight phase (12.04).',
  'Actions': 'A unit is eligible to start an action unless one or more of the following apply to that unit:\n- It is not on the battlefield.\n- It is an **AIRCRAFT**/**FORTIFICATION** unit.\n- It is battle-shocked.\n- It has an OC characteristic of 0 or ‘-’.\n- It is engaged (unless it is a **TITANIC** unit).\n- It made an advance or fall-back move this turn.\n- It started another action this turn.\nIf a unit starts an action, until the end of the turn:\n- It is not eligible to shoot (excluding **TITANIC** units).\n- It is not eligible to declare a charge.\nIf a unit performing an action makes a move (excluding pile-in and consolidation moves) or leaves the battlefield, that unit does not complete that action. Otherwise, when an action is completed, its ‘Effect’ section is triggered.',
  'Snap Shooting': 'ELIGIBLE IF: As stated in the rule allowing this shooting type.\nEFFECT: Your unit shoots as described in Making Attacks (04).\nWHILE SHOOTING:\n- You can only target one visible enemy unit within 24" of your unit (and only if it is an eligible target).\n- Each attack only hits on an unmodified hit roll of 6 (irrespective of the attacking weapon’s BS characteristic or any modifiers).\n*Wahapedia core rules (not in GW’s Core Rules PDF, 01-06): Those hits are not critical hits.*\n- You cannot re-roll hit rolls.\nAFTER SHOOTING: Until the end of the phase, your unit is not eligible to start an action.',
  'Mobile': '**Dense:**\n- **INFANTRY/BEASTS/SWARM/MOBILE** models can move horizontally through **dense terrain features**.\n- **INFANTRY/BEASTS/SWARM** models can move vertically through **dense terrain features**.\n- Other models can move horizontally through **dense terrain features** provided that all sections of that **terrain feature** that the moving model’s base would move through are 2" or less in height. Otherwise, the moving model must move vertically to ascend or descend such sections. They cannot move through ceilings and floors while doing so, and they cannot end that move on any surface of that **terrain feature** that is not on ground level (see below).\n*App note, not rules text: MOBILE has no rule of its own in the core rules. These are the Dense lines of Terrain and Movement (13.06). Super-Heavy Walker (24.35), Designer’s Note: “Gaining the MOBILE keyword for the duration of a move will enable models in that unit to move horizontally through dense terrain features (13.06).”*',
  'Lance': 'Each time an attack is made with a **[LANCE]** weapon, if the attacking model’s unit made a **charge move** this turn, add 1 to the **wound roll**.',
  'Melta': 'This ability always takes the form **[MELTA X]**. Each time a model makes an attack with a **[MELTA]** weapon, if the target unit was within half range of that weapon in the Select Targets step, until the attacking unit’s attacks have been resolved, add **X** to that weapon’s **D** characteristic.\n*Example: A model targets a unit that is within half range of a [MELTA 2] weapon with a D characteristic of D6. While resolving those attacks, that weapon has a D characteristic of D6+2.*',
  'Super-Heavy Walker': 'Each time a unit with this ability makes a **normal**, **advance** or **fall-back move**:\n- Models in that unit can move through models (including **MONSTER/VEHICLE** models, but excluding **TITANIC** models) and can move horizontally through sections of **terrain features** that are 4" or less in height.\n- Before moving that unit, you can select for all models in that unit to have the **MOBILE** keyword until that move ends. If you do, when that move ends, roll one D6: on a 1, that unit is battle-shocked.\n*Designer’s Note: Gaining the MOBILE keyword for the duration of a move will enable models in that unit to move horizontally through dense terrain features (13.06).*',
  'Firing Deck': 'This ability always takes the form **Firing Deck X**. In your Shooting phase, each time this **TRANSPORT** is **selected to shoot**, if one or more units are embarked within it, resolve the following sequence:\n- 1. Select up to **X** models embarked within this **TRANSPORT** (excluding models whose units have already been **selected to shoot** this phase).\n- 2. For each selected model, select one of its ranged weapons (excluding **[ONE SHOT]** weapons).\n- 3. Until this **TRANSPORT** has resolved all of its attacks, it has all of those selected weapons in addition to its other weapons.\n- 4. Until the end of the turn, units embarked within this **TRANSPORT** are not eligible to shoot.',
  'Scouts': 'This ability always takes the form **Scouts X"**. In the Resolve Pre-battle Abilities step, if every model in a unit has this ability, you can do one of the following:\n- If that unit is in **strategic reserves**, you can set up that unit anywhere that is wholly within your deployment zone.\n- If that unit is wholly within your deployment zone, it can make a **scout move** (see below).\n- If that unit is embarked within a **DEDICATED TRANSPORT** that is wholly within your deployment zone, and if every model embarked within that **DEDICATED TRANSPORT** has the Scouts ability, that **DEDICATED TRANSPORT** can make a **scout move**.\n**24.32 Scout Move:**\n**MAXIMUM DISTANCE:** The **X"** in **Scouts X"**.\n**ELIGIBLE IF:** It is the Resolve Pre-battle Abilities step, and your unit is wholly within your deployment zone.\n**EFFECT:** Your unit moves as described in Moving (03).\n**AFTER MOVING:** Your unit must be more than 8" horizontally from all enemy units.',
  'Psychic': 'Each time an attack is made with a **[PSYCHIC]** weapon, you can ignore any or all modifiers to that attack’s **BS** or **WS** characteristic and any or all modifiers to the **hit roll**. Attacks made with **[PSYCHIC]** weapons are known as **psychic attacks** (this can be important for the triggering of other rules).',
  // core rules terms the rules texts use (Core Rules PDF, and the app appendix where marked)
  'Hazard Roll': 'To make a **hazard roll** for a unit, roll one D6: on a 1-2, that roll fails and that unit suffers 1 **mortal wound** (see above), or 3 **mortal wounds** instead if each model in that unit is a **MONSTER/VEHICLE** model. If more than one **hazard roll** is required for a unit, make all of those rolls simultaneously.\n**06.03.01 Hazardous Test (app):** The term ‘Hazardous test’ is the same as hazard roll.\n*Wahapedia FAQ: If a rule says my unit must make a hazard roll does every model in the unit make a hazard roll? No, the unit would make 1 single hazard roll.*\n*Wahapedia FAQ: I failed hazard rolls from [Hazardous] weapons, do those mortal wounds have to be allocated to the models with the [HAZARDOUS] weapons? No, you allocate the mortal wounds to the unit as per Mortal Wounds (06.02).*',
  'Mortal Wounds': 'Some attacks or rules inflict **mortal wounds** on units. Each time a unit suffers one or more **mortal wounds**, its controlling player must resolve the following sequence for each of those **mortal wounds**, until either all of them have been inflicted or that unit is **destroyed**:\n- **Select Model:** Select one model in that unit by following the first instruction below that applies:\n- If a non-**CHARACTER** model in that unit has lost one or more wounds, you must select that model.\n- Otherwise, if that unit contains one or more non-**CHARACTER** models, you must select one of those models.\n- Otherwise, if one or more **CHARACTER** models in that unit have lost one or more wounds, you must select one of those models.\n- Otherwise, you must select one **CHARACTER** model in that unit.\n- **Resolve Damage:** The selected model loses 1 wound. If this reduces that model’s remaining wounds to 0, it is **destroyed**.\nWhen resolving **attack dice**, if those attacks inflict a mixture of both **mortal wounds** and normal damage, resolve all of the normal damage first, then resolve all of the **mortal wounds**.',
  'Battle-shock': '**01.06 Leadership Rolls:** To make a **leadership roll** for a unit, its controlling player rolls 2D6: if the result is equal to or greater than one or more of the **Ld** characteristics in that unit, that roll succeeds. Otherwise, that roll fails.\n**01.07 Battle-shock Rolls:** To make a **battle-shock roll** for a unit, its controlling player makes a **leadership roll** for it (see above).\n- If that roll succeeds, that unit does not become **battle-shocked**.\n- If that roll fails, that unit, and each model in it, is **battle-shocked**.\nWhile a unit is **battle-shocked**:\n- The Objective Control (**OC**) characteristic of all of its models is modified to ‘-’ (02.02).\n- Its controlling player cannot target that unit with **stratagems** (15).\n- It is not **eligible to start an action** (16), and any **action** it has started cannot be completed.\n**01.07.02 Battle-shock Test (app):** The term Battle-shock test is the same as **battle-shock roll**.\n**08.03 Battle-shock:** The active player must now make one **battle-shock roll** (01.07) for each unit in their army that fulfils one or both of the following conditions:\n- That unit is currently **battle-shocked**.\n- That unit is at, or below, **half-strength**.\nIf a unit was **battle-shocked** at the start of this step and its **battle-shock roll** during this step succeeds, it is no longer **battle-shocked**.',
  'Engagement': 'A model’s **engagement range** is the area of the battlefield within 2" horizontally and 5" vertically of it.\n- While a friendly model is within **engagement range** of one or more enemy models, those models – and the units they belong to – are **engaged** with each other.\n- While a unit contains no **engaged** models, that unit is **unengaged**.\n*Wahapedia FAQ: Does my model or unit become engaged while moving through a enemy units engagement range during a move? No*',
  'Selected to Attack': '**04.01.05 Selected to Attack (app):** Some rules use the term **selected to attack**. If a unit is **selected to fight**, **selected to shoot** or chosen to make attacks, that unit is **selected to attack**.\n*App note, not rules text: from the rules appendix in the Warhammer 40,000 app, as Wahapedia prints it (04.01.05); the printed Core Rules do not include it.*',
  'Destroyed': 'Throughout a battle, models will suffer damage, lose wounds and be **destroyed**. When every model in a unit has been **destroyed**, that unit is **destroyed**.\nWhen a model is **destroyed**, first resolve any rules that are triggered when it is **destroyed**, then it is removed from the battlefield. If any such rules apply, and if the model was **destroyed** as the result of an attack, unless otherwise stated, those rules are only resolved and that model is only removed after the attacking unit’s attacks have been resolved. Unless otherwise stated, **destroyed** models and units cannot use abilities or be selected or targeted by rules.\n**05.04.05 Fight On Death (app):** Some rules enable models to attack after they have been **destroyed**. When a model under such an effect is **destroyed**, do not remove it from play.\nThose models will stay on the battlefield until their unit is **selected to attack** and has attacked, or until the end of the phase (whichever comes first). Any rules triggered by those models being **destroyed** are resolved, and then those **destroyed** models are removed.',
  'Normal Move': '**MAXIMUM DISTANCE:** Your unit’s **M** characteristic.\n**ELIGIBLE IF:** Your unit is on the battlefield and **unengaged**.\n**EFFECT:** Your unit moves as described in Moving (03).\n**AFTER MOVING:** Your unit must be **unengaged**.\n**09.05.01 More Than One Normal Move in a Phase (app):** A unit cannot make more than one **Normal Move** in a phase.',
  'Advance Move': '**MAXIMUM DISTANCE:** Advance roll + your unit’s **M** characteristic.\n**ELIGIBLE IF:** Your unit is on the battlefield and **unengaged**.\n**EFFECT:** Your unit moves as described in Moving (03).\n**BEFORE MOVING:** Make an **advance roll** by rolling one D6.\n**AFTER MOVING:**\n- Your unit must be **unengaged**.\n- Until the end of the turn, unless otherwise stated, your unit is not **eligible to declare a charge** or **start an action**.',
  'Fall-back Move': '**MAXIMUM DISTANCE:** Your unit’s **M** characteristic.\n**ELIGIBLE IF:** Your unit is **engaged**.\n**EFFECT:** Your unit moves as described in Moving (03).\n**BEFORE MOVING:** Select fall-back mode:\n- Ordered Retreat: If your unit is not **battle-shocked**, you can select this mode.\n- Desperate Escape: Otherwise, you must select this mode. Make a **hazard roll** for each model in your unit (06.03).\n**WHILE MOVING:**\n- Desperate Escape: Each model that is moved can be moved through enemy models.\n**AFTER MOVING:**\n- Your unit must be **unengaged**.\n- Until the end of the turn, unless otherwise stated, your unit is not **eligible to shoot**, **declare a charge** or **start an action**.\n- Desperate Escape: If your unit is not **battle-shocked**, you must make a **battle-shock roll** for your unit (01.07).\n**Desperate Escape Test (app):** Some rules may reference the term ‘Desperate Escape test’. In all instances this means the **hazard rolls** made for the **desperate escape** mode of a **fall-back move**.\nAbilities that subtract from a unit’s Desperate Escape test instead subtract from those **hazard rolls**.\nIf a **stratagem** or ability instructs a unit to make a Desperate Escape test, that unit:\n- Must use the **desperate escape** mode when it is selected to make a **fall-back move**.\n- Must make one **hazard roll** for each model in that unit.\n- Must make a **battle-shock roll**.',
  'Charge': '- 1. **Declare Charge:** Select one friendly unit that has not **declared a charge** this phase and is **eligible to declare a charge** (see below). That unit **declares a charge**.\nA unit is **eligible to declare a charge** if it is on the battlefield, unless otherwise stated. Here are some rules that prevent a unit from being **eligible to declare a charge**:\n- It is not within 12" of one or more enemy units.\n- It is **engaged**.\n- It made an **advance** or **fall-back move** this turn.\n- 2. **Make Charge Roll:** Make a **charge roll** by rolling 2D6: the result is the **maximum distance** for the **charge move**.\n- 3. **Attempt Charge:** If it is possible to make a **charge move**, and if you still want to, make a **charge move** with that unit (see opposite). Otherwise, your unit does not make a **charge move**. In either case, the **charge** is then resolved.\n*Wahapedia FAQ: When a rule instructs you to perform a charge outside of the charge phase, do I resolve step 2 and 3 of the Charge step (11.02)? Yes*',
  'Charge Move': '**MAXIMUM DISTANCE:** **Charge roll**.\n**ELIGIBLE IF:** Your unit declared a charge this phase.\n**EFFECT:** Your unit moves as described in Moving (03).\n**BEFORE MOVING:** Select one or more enemy units that are within 12" of your unit and within the maximum distance of your unit; until the end of this move, each of those enemy units is a charge target.\n**WHILE MOVING:**\n- Each model must end its move closer to one or more **charge targets**.\n- Each model that can end its move within 1" of one or more **charge targets** must do so.\n- Each model that can end its move **engaged** with one or more **charge targets** must do so.\n**AFTER MOVING:**\n- Your unit must be **engaged** with all of the **charge targets**.\n- Your unit cannot be **engaged** with one or more enemy units that are not **charge targets**.\n- Until the end of the turn, each model in your unit has the **Fights First** ability (24.13).',
  'Pile-in Move': '**MAXIMUM DISTANCE:** 3"\n**ELIGIBLE IF:** It is the Fight phase and one or more of the following apply to your unit:\n- It is **engaged**.\n- It made a **charge move** this turn.\n- It was selected to make an **overrun fight** this phase (12.06).\n**EFFECT:** Your unit moves as described in Moving (03).\n**BEFORE MOVING:** Select pile-in targets:\n- If your unit is **engaged**, select every enemy unit it is **engaged** with.\n- Otherwise, select one or more enemy units within 5" of your unit.\n**WHILE MOVING:**\n- Models in base-contact with one or more enemy models cannot be moved.\n- Each model that is moved must end its move closer to the closest **pile-in target**, and **engaged** with it if possible.\n**AFTER MOVING:**\n- Your unit must be **engaged**.\n- Each model that started this move **engaged** with an enemy unit must still be **engaged** with that enemy unit.',
  'Consolidation Move': '**MAXIMUM DISTANCE:** 3"\n**ELIGIBLE IF:** It is the Fight phase and your unit was **eligible to fight** this phase.\n**EFFECT:** Your unit moves as described in Moving (03).\n**BEFORE MOVING:** Select **consolidation mode**:\n- Ongoing Consolidation: If your unit is **engaged**, you must select this mode and select every enemy unit it is **engaged** with.\n- Engaging Consolidation: Otherwise, if your unit is within 3" of one or more enemy units, you must select this mode and select one or more of those enemy units.\n- Objective Consolidation: Otherwise, if your unit is within 3" of one or more **objectives**, you must select this mode and select one of those **objectives**.\n**WHILE MOVING:**\n- Ongoing Consolidation: Models in base-contact with one or more enemy models cannot be moved. Each model that is moved must end its move closer to the closest selected enemy unit, and **engaged** with it if possible.\n- Engaging Consolidation: Each model that is moved must end its move closer to the closest selected enemy unit, and **engaged** with it if possible.\n- Objective Consolidation: Each model that is moved must end its move within range of the selected **objective** if possible, or closer to it if not.\n**AFTER MOVING:**\n- Ongoing Consolidation: Each model that started this move **engaged** with an enemy unit must still be **engaged** with that enemy unit.\n- Engaging Consolidation: Your unit must be **engaged** with all of the selected enemy units. If one or more enemy units **engaged** with your unit have not been **selected to fight** this phase, your opponent must select each of those units, one at a time; when each is selected, it becomes **eligible to fight** and is **selected to fight** (12.04).\n- Objective Consolidation: Your unit must be within range of the selected **objective**.\n*Wahapedia core rules errata (12.08 Consolidation Move, After Moving, Ongoing Consolidation): Each model that started this move engaged with an enemy unit must still be engaged with that enemy unit. If one or more enemy units engaged with your unit have not been selected to fight this phase, your opponent must select each of those units, one at a time; when each is selected, it becomes eligible to fight and is selected to fight*\n*App note, not rules text: the lines above the errata are the printed Core Rules (01/06/2026). GW’s Warhammer 40,000 app, as Wahapedia prints it, changes two After Moving lines: the errata replaces the Ongoing Consolidation line, and the Objective Consolidation line reads “Your unit must be unengaged and within range of the selected objective”. No GW PDF has either change yet (16 Oct 2026).*',
  'Benefit of Cover': 'Each time a ranged attack targets a unit, if every model in that unit meets one or more of the following conditions, that unit has the **benefit of cover** against that attack:\n- That model has the **INFANTRY/BEASTS/SWARM** keyword and is within a **terrain area**.\n- That model is not **fully visible** to the attacking model due to one or more intervening **terrain features** and/or one or more intervening **obscuring terrain areas** (see below).\nEach time a ranged attack targets a unit that has the **benefit of cover** against it, worsen the **BS** characteristic of that attack by 1.',
  'Attached Units': 'Some units have the **Leader** or **Support** ability listed on their datasheet (see below). Such units are known as **leader** units and **support** units respectively. Both of these abilities allow such units to **lead** other friendly units (known as **bodyguard** units) to form **attached** units. An **attached** unit is a single unit for all rules purposes. **Leader** and **support** units can only **lead** specific **bodyguard** units, as listed in the Warhammer 40,000 app.\n**19.04 Abilities in Attached Units:** Abilities/rules that affect a single specified model (e.g. from an **enhancement** or an item of wargear) only ever apply to that model, even while part of an **attached** unit.\nOtherwise, abilities/rules that affect a unit (or models in it) apply to every model in an **attached** unit, until the source of that ability/rule is **destroyed**, as shown below.\nSOURCE OF ABILITY/RULE: APPLIES TO THE ATTACHED UNIT UNTIL\n- Leader/support unit: The last model in that **leader**/**support** unit is **destroyed**.*\n- Bodyguard unit (e.g. from a datasheet ability): The last model in that **bodyguard** unit is **destroyed**.\n- A specific model (e.g. the bearer of an **enhancement** or an item of wargear): That model is **destroyed**.\n* This means **leader**/**support** units continue to benefit from their own ‘while this model is **leading** a unit’ abilities even after their **bodyguard** unit is **destroyed**, provided they started the battle in an **attached** unit.\nIn all of the above cases, if that last model was **destroyed** as the result of an attack, the ability it was conferring upon the **attached** unit applies until the attacking unit has resolved all of its attacks.\n*Wahapedia FAQ: When does a model’s or unit’s ability in an attached unit apply to all models in that unit? A rule that applies to ‘this/that unit’ or ‘models in this/that unit’ applies to all models in an attached unit. Rules that just apply to one model in an attached unit (for example, a rule that grants a model Feel No Pain or Lone Operative) only apply to that model, not to all models in the attached unit.*',
  'Strategic Reserves': 'Before the battle, in the Declare Battle Formations step, you can select one or more friendly units (excluding **FORTIFICATIONS**) to place in **strategic reserves**. Instead of setting up these units on the battlefield during deployment, place them to one side; they are **strategic reserves** units, and will arrive later in the battle.\nUnless otherwise stated, the combined points value of all of your **strategic reserves** units (including those embarked within **TRANSPORTS** that are themselves placed in **strategic reserves**) cannot exceed 50% of your points limit for your battle size.\n**20.01.01 Reserves (app):** The term ‘Reserves’ is the same as strategic reserves.\n**20.02 Repositioned Units:** Some rules allow units to be removed from the battlefield and placed in **strategic reserves** during the battle. Units that use such rules are known as **repositioned** units. In addition to any other rules that apply to such units (such as where they can or cannot arrive), all of the following rules apply to them:\n- If used in the Movement phase, such rules can be used on units that have already moved that phase.\n- A **repositioned** unit that is set up in the same turn in which it made an **advance**, **fall-back** or **disembark move** has still made an **advance**, **fall-back** or **disembark move** that turn.\n- When they are removed from the battlefield, any rules that are affecting such units for a specified duration or under specified circumstances continue to affect them while that duration and/or those circumstances apply.\n**20.03 Arriving from Strategic Reserves:** To arrive on the battlefield, each **strategic reserves** unit must make an **ingress move** (see below). Unless otherwise stated, they can only do so from the second battle round onwards.\nAt the end of the third battle round, unless otherwise stated, all **strategic reserves** units that have not made one or more **ingress moves** are **destroyed**, with the following exceptions:\n- Units embarked within **TRANSPORTS** that have made an **ingress move** during the battle.\n- **Repositioned** units (see opposite).',
  'Ingress Move': '**SET-UP DISTANCE:** 6"\n**ELIGIBLE IF:** Your unit is in **strategic reserves** (excluding units that are embarked within **TRANSPORTS** that are themselves in **strategic reserves**).\n**EFFECT:** Your unit is set up as described in Set Up (03.02).\n**WHILE MOVING:** Set up your unit wholly within the **set-up distance** of one or more battlefield edges and more than 8" horizontally from all enemy units.\n- **Before the Third Battle Round:** While doing so, no models can be set up within your opponent’s deployment zone.\n**AFTER MOVING:** Unless otherwise stated, until the start of the next Charge phase, your unit is not eligible to make any other type of move.\n**20.03.01 Set Up As Reinforcements (app):** If a rule mentions a unit being set up on the battlefield as Reinforcements, it means a unit that made an ingress move.',
  'Surge Move': 'Some rules allow a unit to make a surge move, as described below.\n**MAXIMUM DISTANCE:** As stated in the rule allowing this move type.\n**ELIGIBLE IF:** All of the following apply:\n- The rule allowing this **move type** has been triggered.\n- Your unit is not **battle-shocked**.\n- Your unit is **unengaged**.\n- Your unit has not moved this phase.\n**EFFECT:** Your unit moves as described in Moving (03).\n**BEFORE MOVING:** Select the closest enemy unit to be the **surge target**.\n**WHILE MOVING:**\n- Each model must end its move **engaged** with the **surge target** if possible.\n- Each model that cannot end its move **engaged** with the **surge target** must end its move as close as possible to the **surge target**.\n**AFTER MOVING:**\n- Your unit cannot be **engaged** with one or more enemy units that were not the **surge target**.\n- Your unit cannot move again this phase.',
  'Scout Move': '**MAXIMUM DISTANCE:** The **X"** in **Scouts X"**.\n**ELIGIBLE IF:** It is the Resolve Pre-battle Abilities step, and your unit is wholly within your deployment zone.\n**EFFECT:** Your unit moves as described in Moving (03).\n**AFTER MOVING:** Your unit must be more than 8" horizontally from all enemy units.',
  'Stealth': 'If every model in a unit has this ability, each time a ranged attack targets that unit, that unit has the **benefit of cover** against that attack (13.08).',
  // Core Rules p86 (supporting materials); its table is written as two lists
  'Starting Strength': 'The number of models a unit contains at the start of the first battle round is its **starting strength**. The **starting strength** of an **attached** unit is the number of models that unit contains at the start of the first battle round.\nSome rules refer to units being below **starting strength**, or at – or below – **half-strength**. The meaning of these terms varies depending on a unit’s **starting strength**, as shown below.\n**Starting strength of 1:**\n- Below starting strength: model’s remaining wounds are less than its W characteristic.\n- At half-strength: model’s remaining wounds are half of its W characteristic.\n- Below half-strength: model’s remaining wounds are less than half of its W characteristic.\n**Starting strength of 2 or more:**\n- Below starting strength: number of remaining models in the unit is less than its starting strength.\n- At half-strength: number of remaining models in the unit is half of its starting strength.\n- Below half-strength: number of remaining models in the unit is less than half of its starting strength.\n**Some units cannot be at half-strength:** If a model’s W characteristic or a unit’s starting strength cannot be evenly divided in half, that model or unit cannot be at half-strength (but can be below half-strength as described above).\n*Example: A Captain (1 model) is attached to a unit of Intercessors (5 models). This attached unit has a starting strength of 6. If three Intercessors were destroyed, the unit would be at half-strength. If four Intercessors were destroyed, the unit would be below half-strength. If all of the Intercessors were destroyed, the remaining Captain would be below half-strength, despite having his full wounds remaining.*',
  // Core Rules 22.05
  'Plunging Fire': 'Each time a model makes a ranged attack that targets a visible unit containing one or more models on ground level, if one or more of the following conditions apply, improve the **BS** characteristic of that attack by 1:\n- The attacking model is on a section of a terrain feature that is 3" or more in height.\n- The attacking model has the **TOWERING** keyword and the target unit is within 12".\n**23.03 Shooting:** The **Plunging Fire** rule (22.05) has no effect on attacks made by, or targeting, **AIRCRAFT** units.',
  // Core Rules 04.01, its Sidearms note, 24.11 and the multiple-profiles rule (04.01.03, app)
  'Select Weapons': 'For each model in the attacking unit, select which weapons that model will make attacks with. Models make ranged attacks with ranged weapons, and make melee attacks with melee weapons.\n**While shooting:** You can select one or more ranged weapons that model has.\n**While fighting:** You must select one melee weapon that model has.\n**Sidearms:** Some models are equipped with **[CLOSE-QUARTERS]** weapons in addition to other firearms. Such models can be an exception to the rules in this section, as you may not be able to select all of their weapons to make attacks with.\n**24.11 [EXTRA ATTACKS]:** Each time a unit containing one or more models with an **[EXTRA ATTACKS]** weapon fights, those models will make attacks with those weapons in addition to any others.\n**04.01.03 Multiple Weapon Profiles (app):** In the Select Weapons step (04.01), if a selected weapon has more than one profile, then the controlling player must also select one of those profiles. The selected profile is then used in the Resolve Attacks step (04.03).'
};

// Which RULES entry a keyword or rule chip opens ("RAPID FIRE 4" -> "Rapid Fire").
// where a RULES entry comes from when it is not a core rule
const RULE_SRC = { 'Pulse Jet Move':'Orks army rule (special move type)', 'Supa-hazardous':'Shoota Boyz enhancement Supa-glowy Fing' };
const RULE_ALIASES = [
  [/^supa-hazardous/i, 'Supa-hazardous'], [/^pulse jet move$/i, 'Pulse Jet Move'], [/^support$/i, 'Support'],
  [/^(below |at |at or below )?(starting|half)[- ]strength$/i, 'Starting Strength'], [/^towering$/i, 'Plunging Fire'], [/^(select|choosing) weapons?$/i, 'Select Weapons'],
  [/^anti-/i, 'Anti'], [/^blast/i, 'Blast'], [/^cleave/i, 'Cleave'], [/^close-quarters/i, 'Close-quarters'],
  [/^pistol/i, 'Close-quarters'], [/^devastating/i, 'Devastating Wounds'], [/^extra attacks/i, 'Extra Attacks'],
  [/^hazardous(?!( roll| test)s?$)/i, 'Hazardous'], [/^heavy$/i, 'Heavy'], [/^ignores cover/i, 'Ignores Cover'], [/^lethal hits/i, 'Lethal Hits'],
  [/^precision/i, 'Precision'], [/^rapid fire/i, 'Rapid Fire'], [/^sustained hits/i, 'Sustained Hits'],
  [/^torrent/i, 'Torrent'], [/^twin-linked/i, 'Twin-linked'], [/^assault/i, 'Assault'],
  [/^deep strike/i, 'Deep Strike'], [/^deadly demise/i, 'Deadly Demise'], [/^feel no pain/i, 'Feel No Pain'],
  [/^leader\b/i, 'Leader'], [/^lone operative/i, 'Lone Operative'], [/^mobile/i, 'Mobile'], [/^hunter/i, 'Hunter'], [/^snap shooting/i, 'Snap Shooting'],
  [/^fights first/i, 'Fights First'], [/^actions?$/i, 'Actions'],
  [/^melta/i, 'Melta'], [/^lance/i, 'Lance'], [/^super-heavy walker/i, 'Super-Heavy Walker'],
  [/^firing deck/i, 'Firing Deck'], [/^scouts/i, 'Scouts'], [/^damaged \d+$/i, 'Damaged'],
  [/^psychic$/i, 'Psychic'],
  [/^harpooned$/i, 'Harpooned'],
  [/^hazard(ous)? (roll|test)s?$/i, 'Hazard Roll'],
  [/^mortal wounds?$/i, 'Mortal Wounds'],
  [/^battle-shock/i, 'Battle-shock'],
  [/^leadership (roll|test)s?$/i, 'Battle-shock'],
  [/^(un)?engage(d|ment( range)?)?$/i, 'Engagement'],
  [/^selected to attack$/i, 'Selected to Attack'],
  [/^(destroy(ed|s)?|fight on death)$/i, 'Destroyed'],
  [/^normal( move)?s?$/i, 'Normal Move'],
  [/^advance( move| roll)?s?$/i, 'Advance Move'],
  [/^fall[- ]back( move| mode)?s?$/i, 'Fall-back Move'],
  [/^(desperate escape|ordered retreat)( mode| test)?s?$/i, 'Fall-back Move'],
  [/^(charges?|charge rolls?|declares? a charge|declared a charge|eligible to declare a charge|resolve a charge)$/i, 'Charge'],
  [/^charge (move|target)s?/i, 'Charge Move'],
  [/^pile-in( move| target)?s?$/i, 'Pile-in Move'],
  [/^consolidat(e|ion)( move| mode)?s?$/i, 'Consolidation Move'],
  [/^benefit of cover$/i, 'Benefit of Cover'],
  [/^(attached( units?)?|bodyguard( units?| models?)?)$/i, 'Attached Units'],
  [/^((strategic )?reserves|repositioned( units?)?)$/i, 'Strategic Reserves'],
  [/^ingress moves?$/i, 'Ingress Move'],
  [/^surge (move|target)s?$/i, 'Surge Move'],
  [/^scout moves?$/i, 'Scout Move'],
  [/^stealth$/i, 'Stealth'],
  [/^(lead|leading)$/i, 'Leader'], [/^support units?$/i, 'Support']
];

/* ---------------- core stratagems ----------------
   Wahapedia wording (Core Rules, 11th edition, section 15).
   needs: { all, any, none } keyword lists a unit must match to use it.   */
const CORE_STRATAGEMS = [
  { id:'command-re-roll', gist:'Re-roll an advance, charge, damage, hazard, hit, save or wound roll, or a roll for a weapon’s number of attacks, just made (one dice of several; a charge roll in full).', gistOf:'377ce33f', name:'Command Re-roll', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either',
    when:'Any phase, just after you make one of the following rolls for a friendly unit or model:\n- **Advance roll**\n- **Charge roll**\n- **Damage roll**\n- **Hazard roll**\n- **Hit roll**\n- **Save roll**\n- **Wound roll**\n- A roll to determine the number of attacks generated with a weapon.',
    target:'That unit or model.',
    effect:'You re-roll that roll. If you are rolling more than one dice together, select one of those dice to re-roll (excluding **charge rolls**, which you must re-roll in full).' },
  { id:'epic-challenge', gist:'One CHARACTER model in your unit: its melee weapons have [PRECISION] until the end of the phase.', gistOf:'59bef664', name:'Epic Challenge', cp:1, phases:['fight'], turn:'either', needs:{ all:['Character'] },
    when:'Fight phase, just after a friendly **CHARACTER** unit is **selected to fight**.',
    target:'That **CHARACTER** unit.',
    effect:'Select one **CHARACTER** model in your unit. Until the end of the phase, that model’s melee weapons have the **[PRECISION]** ability.' },
  { id:'insane-bravery', gist:'The battle-shock roll you are about to make for your unit is automatically successful.', gistOf:'02ffa2fd', note:'Wahapedia FAQ: Can I use the Insane Bravery stratagem on a battle-shocked unit? No, as a unit’s controlling player cannot target that unit with stratagems (01.07).', name:'Insane Bravery', cp:1, phases:['command'], turn:'your', limit:'Once per battle',
    when:'Battle-shock step of your Command phase, just before you make a **battle-shock roll** for a friendly unit.',
    target:'That unit.',
    effect:'That **battle-shock roll** is automatically successful.',
    restrictions:'You cannot use this **stratagem** more than once per battle.' },
  { id:'explosives', gist:'Your unengaged unit, eligible to shoot and with no advance move this turn: one EXPLOSIVES/GRENADES model: six D6 at an unengaged enemy unit within 8" of and visible to it, 1 mortal wound for each 4+.', gistOf:'a461971d', note:'Wahapedia errata: The Grenade Stratagem is the same as the Explosives stratagem.', name:'Explosives', cp:1, phases:['shooting'], turn:'your', needs:{ any:['Explosives','Grenades'] },
    when:'Your Shooting phase.',
    target:'One friendly **unengaged** **EXPLOSIVES/GRENADES** unit that is **eligible to shoot** and did not make an **advance move** this turn.',
    effect:'Resolve the following sequence:\n- 1. Select one **EXPLOSIVES/GRENADES** model in your unit.\n- 2. Select one **unengaged** enemy unit within 8" of and **visible** to that model.\n- 3. Roll six D6: for each 4+, that enemy unit suffers 1 **mortal wound** (06.02).' },
  { id:'crushing-impact', gist:'After the charge: D6 equal to T of your model engaged with an enemy unit; each 5+: 1 mortal wound to it, each 1: 1 to yours…', gistOf:'78e19d20', note:'Wahapedia errata: The Tank Shock Stratagem is the same as the Crushing Impact stratagem.', name:'Crushing Impact', cp:1, phases:['charge'], turn:'your', needs:{ any:['Monster','Vehicle'] },
    when:'Your Charge phase, just after a friendly **MONSTER/VEHICLE** unit ends a **charge move**.',
    target:'That **MONSTER/VEHICLE** unit.',
    effect:'Resolve the following sequence:\n- 1. Select one enemy unit **engaged** with your unit.\n- 2. Select one model in your unit **engaged** with that enemy unit.\n- 3. Roll a number of D6 equal to the **T** characteristic of that model: for each 1, your unit suffers 1 **mortal wound**; for each 5+, that enemy unit suffers 1 **mortal wound** (to a maximum of 6 **mortal wounds** per unit).' },
  { id:'rapid-ingress', gist:'Your unit in strategic reserves makes an ingress move (not in the first battle round).', gistOf:'12170370', name:'Rapid Ingress', cp:1, phases:['movement'], turn:'opp', needs:{ none:['Aircraft'] },
    when:'End of your opponent’s Movement phase.',
    target:'One friendly unit that is in **strategic reserves** (excluding **AIRCRAFT**).',
    effect:'Your unit makes an **ingress move** (20.04).',
    restrictions:'You cannot use this **stratagem** during the first battle round.' },
  { id:'fire-overwatch', gist:'Your unengaged unit shoots using snap shooting.', gistOf:'27a2e015', name:'Fire Overwatch', cp:1, phases:['movement'], turn:'opp', needs:{ none:['Titanic'] },
    when:'End of your opponent’s Movement phase.',
    target:'One friendly **unengaged** unit (excluding **TITANIC** units).',
    effect:'Your unit shoots using **snap shooting**.' },
  { id:'smokescreen', gist:'Until the end of the phase, your SMOKE unit, and a unit not fully visible because of it, has the benefit of cover…', gistOf:'041dc9b7', defCalc:{ cover:true }, name:'Smokescreen', cp:1, phases:['shooting'], turn:'opp', needs:{ all:['Smoke'] },
    when:'Start of your opponent’s Shooting phase.',
    target:'One friendly **SMOKE** unit.',
    effect:'Until the end of the phase, each time an attack targets either your **SMOKE** unit, or a unit that is not **fully visible** to the attacking model because of one or more models in your **SMOKE** unit, the target has the **benefit of cover** against that attack (13.08).' },
  { id:'heroic-intervention', gist:'Your unengaged unit within 12" of an enemy unit resolves a charge, choosing Leap to Defend or Into the Fray (+1CP)…', gistOf:'67df1e2f', note:'Wahapedia FAQ: If a stratagem contains a section that carries an additional CP cost (such as the Into the Fray option of Heroic Intervention), is that additional cost considered to be a modifier? No, a stratagem that costs 1CP and is making use of an optional +1CP section has an original cost of 2CP.', name:'Heroic Intervention', cp:1, cpNote:'Into the Fray +1CP', phases:['charge'], turn:'opp', needs:{ unless:{ all:['Vehicle'], none:['Character','Walker'] } },
    when:'End of your opponent’s Charge phase.',
    target:'One friendly **unengaged** unit within 12" of one or more enemy units. You can only select a **VEHICLE** unit if it is a **CHARACTER/WALKER** unit.',
    effect:'**Resolve a charge** with your unit (11.02). While doing so, before making the **charge roll**, you must select one of the following modes:\n- **Leap to Defend:** When selecting **charge targets**, you can only select enemy units that made a **charge move** this phase and are within the **maximum distance**.\n- **Into the Fray (+1CP):** When making the **charge roll**, if the result is greater than 6 (after modifiers), change it to 6. When selecting **charge targets**, you can select any enemy units that are within 6" of your unit and within the **maximum distance**.' },
  { id:'counteroffensive', gist:'Your unit has Fights First until the end of the phase and must be the next unit you select to fight.', gistOf:'d16b1ee7', name:'Counteroffensive', cp:2, phases:['fight'], turn:'opp',
    when:'Fight step of your opponent’s Fight phase, just after an enemy unit has resolved its attacks.',
    target:'One friendly unit that is **eligible to fight**.',
    effect:'Until the end of the phase, your unit has the **Fights First** ability and it must be the next unit you **select to fight** (12.04).' }
];

/* ---------------- factions ---------------- */
const FACTIONS = {
  orks: {
    name: 'Orks',
    // words players use for a rule that has another name
    aliases: [[/^riled up/i, 'Waaagh!']],
    armyRules: [
      { name:'Waaagh!',
        text:'Friendly **ORKS** units with this ability can:\n- Re-roll **advance rolls**.\n- Become **riled up**, as stated in other rules.\nWhile a unit is **riled up**:\n- That unit has 5+ **InSv**.\n- That unit’s ranged attacks have **[ASSAULT]**.\n- When that unit is selected to make an **advance move**, that **advance move** does not prevent that unit from being **eligible to declare a charge**.' },
      { name:'War Cry', tag:'Once per battle, per army', ph:['command'], turn:'either',
        text:'At the start of the Command phase, you can use this ability. If you do, friendly **ORKS** units with the **Waaagh!** ability are **riled up** until the end of the next turn.' },
      { name:'Da Boss', at:'Start of the battle round', ph:['command'], turn:'either',
        text:'At the start of the battle round, if a model with this ability is your **WARLORD**, gain 1CP.\n*Wahapedia core rules errata (07.01, CP Generated by a Warlord; not in GW’s printed Core Rules): you do not gain the 1CP while your **WARLORD** is destroyed.*' }
    ],
    // Wahapedia also lists Unstable Energies (ORKS PSYKER units) and Special Move Types; Pulse Jet Move,
    // which Wazdakka uses, is in the glossary (RULES, with RULE_SRC); the others are left out.
    detachments: {
      // Bully Boyz and Runt Swarm: Wahapedia wording (Orks, codex; GW publishes no Orks Faction Pack);
      // enhancement pts and UPGRADE marks from Wahapedia, matching BSData
      'bully-boyz': {
        name:'Bully Boyz', dispositions:['Purge the Foe'], dp:1,
        rule:{ name:'Displays of Savagery', ph:['fight'], turn:'either', needs:{ any:['Meganobz','Nobz'] },
          text:'Friendly **MEGANOBZ**/**NOBZ** units’ melee attacks have **[SUSTAINED HITS 1]**.' },
        enhancements:[
          { name:'Wimp-kickaz', pts:15, upgrade:true, text:'**NOBZ** unit only. When an enemy unit **engaged** with this unit is selected to make a **fall-back move**:\n- That enemy unit must select the **desperate escape** mode.\n- If this unit is **riled up**, that enemy unit has -1 to the **hazard rolls** made for that **desperate escape**.' },
          { name:'Tellyporta Boss', pts:20, text:'**MEGA ARMOUR** model only. This unit (excluding **VEHICLE** units) has **Deep Strike**.' }
        ],
        stratagems:[
          { id:'too-arrogant-to-die', gist:'An enemy unit targets your unit: a model of it destroyed while your unit has not been selected to fight this phase: D6 (+1 if riled up); on a 4+ it stays until your unit has fought or the phase ends.', gistOf:'75ddbd22', name:'Too Arrogant to Die', cp:1, phases:['fight'], turn:'either', needs:{ any:['Meganobz','Nobz'] },
            def:'Fight phase: a model destroyed while your unit has not been selected to fight this phase is not removed on a 4+ (D6, +1 if riled up; removed once your unit has fought or at the end of the phase)', defOf:'75ddbd22',
            when:'Fight phase, when an enemy unit targets a friendly **MEGANOBZ**/**NOBZ** unit.',
            target:'That **MEGANOBZ**/**NOBZ** unit.',
            effect:'When a model in your unit is **destroyed**, if your unit has not been **selected to fight** this phase, roll one D6, with +1 to that roll if your unit is **riled up**:\n- On a 4+, do not remove that model from the battlefield. When your unit has fought, or at the end of the phase (whichever comes first), that model is removed from the battlefield.' },
          { id:'armed-to-da-teef', gist:'Your unit’s attacks can re-roll hit rolls of 1, or re-roll hit rolls if your unit is riled up.', gistOf:'602b09cc', name:'Armed to da Teef', cp:1, phases:['shooting','fight'], turn:'either', turns:{ shooting:'your' }, needs:{ any:['Meganobz','Nobz'] },
            mod:{ kind:'all', when:'Your Shooting phase or the Fight phase', note:'can re-roll hit rolls of 1 (riled up: can re-roll hit rolls)',
              pick:[{ name:'Hit rolls of 1', note:'re-roll hit rolls of 1' }, { name:'Riled up: every hit roll', note:'re-roll hit rolls' }] },
            when:'Your Shooting phase or the Fight phase, when a friendly **MEGANOBZ**/**NOBZ** unit is **selected to attack**.',
            target:'That **MEGANOBZ**/**NOBZ** unit.',
            effect:'Your unit’s attacks can:\n- Re-roll **hit rolls** of 1.\n- If your unit is **riled up**, re-roll **hit rolls**.' },
          // Wahapedia prints the +1CP option as a badge above "Or:"; the app writes the badge at the start of that line
          { id:'hulking-brutes', gist:'Ranged attacks that target your unit with S greater than its T have -1 to wound rolls; for +1CP, all ranged attacks that target it do.', gistOf:'1fe7712e', name:'Hulking Brutes', cp:1, cpNote:'Or: +1CP', phases:['shooting'], turn:'opp', needs:{ any:['Meganobz','Nobz'] },
            def:'their Shooting phase: -1 to wound when the attack’s S is greater than its T (+1CP: every ranged attack)', defOf:'1fe7712e',
            when:'Your opponent’s Shooting phase, when an enemy unit targets a friendly **MEGANOBZ**/**NOBZ** unit.',
            target:'That **MEGANOBZ**/**NOBZ** unit.',
            effect:'Ranged attacks that target your unit with a **S** greater than your unit’s **T** have -1 to **wound rolls**.\n**+1CP** Or: Ranged attacks that target your unit have -1 to **wound rolls**.' }
        ]
      },
      'dread-mob': {
        name:'Dread Mob', dispositions:['Purge the Foe'], dp:1,
        // tableAt: Wahapedia prints the table after "…have the relevant rule(s):", before the hazard-roll line
        rule:{ name:'Try Dat Button!', ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' }, needs:{ all:['Walker'], none:['Titanic'] }, tableAt:1,
          // one D6: one result of the table; two D6: two different results ("keep re-rolling duplicate results": the owner's reading,
          // two D6 always give two different results), so the picks are the three results and the three pairs. Its hazard roll with two
          // D6 is the rules' (said in the note) and not counted: the Damage tab shows damage dealt
          mod:{ kind:'all', when:'Your Shooting phase or the Fight phase, when selected to attack (optional: one D6 or two D6)', note:'1–2 +1 A · 3–4 +2 S · 5–6 +1 AP (two D6: keep re-rolling duplicate results; one hazard roll when the unit has attacked)',
            // label: what the Damage tab's chip says (the owner's call: the effect, not the dice results); name stays the key
            pick:[{ name:'1–2', label:'+1 A', note:'+1 A' }, { name:'3–4', label:'+2 S', note:'+2 S' }, { name:'5–6', label:'+1 AP', note:'+1 AP' }, { name:'1–2 and 3–4', label:'+1 A & +2 S', note:'+1 A, +2 S' }, { name:'1–2 and 5–6', label:'+1 A & +1 AP', note:'+1 A, +1 AP' }, { name:'3–4 and 5–6', label:'+2 S & +1 AP', note:'+2 S, +1 AP' }] },
          text:'In your Shooting phase or the Fight phase, when a friendly **ORKS WALKER** unit (excluding **TITANIC** units) is **selected to attack**, you can use this ability. If you do, roll either one D6 or two D6 (keep re-rolling duplicate results). This unit’s attacks have the relevant rule(s):\nIf you rolled two D6, when this unit has attacked, this unit makes one **hazard roll**.',
          table:[['1–2','+1 **A**'],['3–4','+2 **S**'],['5–6','+1 **AP**']] },
        enhancements:[
          { name:'Cybork Boosta', pts:10, text:'**BIG MEK/MEK** model only. This model has +2" **M**.' },
          { name:'Dreadherder', pts:30, text:'**BIG MEK** model only. While this model is within 3" of a friendly **ORKS WALKER** unit (excluding **BIG MEK** units):\n- This model has **Lone Operative**.\n- In your Shooting phase, you can select one friendly **ORKS WALKER** unit within 3" of this model. That unit’s attacks can re-roll **hit rolls** of 1 until the end of the turn.' }
        ],
        stratagems:[
          { id:'crazed-rampage', gist:'An enemy unit targets your unit: a model of it destroyed while your unit has not been selected to fight this phase: roll one D6; on a 4+ it stays until your unit has fought or the phase ends…', gistOf:'263b4efe', name:'Crazed Rampage', cp:1, phases:['fight'], turn:'either', needs:{ all:['Walker'], none:['Titanic'] },
            note:'Wahapedia FAQ: “If my unit has the Deadly Demise ability and has an ability that allows it to Fight on Death, how do I resolve this?” “Fight on Death rules are resolved before Deadly Demise abilities, meaning that your unit’s Deadly Demise will resolve after your unit has fought/at the end of the phase and the relevant models have been removed from the battlefield.”',
            def:'Fight phase: a model destroyed while your unit has not been selected to fight this phase is not removed on a 4+ (removed once your unit has fought or at the end of the phase)', defOf:'263b4efe',
            when:'Fight phase, when an enemy unit targets a friendly **ORKS WALKER** unit (excluding **TITANIC** units).',
            target:'That **ORKS WALKER** unit.',
            effect:'When a model in your unit is **destroyed**, if your unit has not been **selected to fight** this phase, roll one D6, with +3 to the result if your unit has ~~**DEFF DREAD**~~:\n- On a 4+, do not remove that model from the battlefield. When your unit has fought, or at the end of the phase (whichever comes first), that model is removed from the battlefield.' },
          { id:'dread-power', gist:'Your unit is riled up until the start of your next turn.', gistOf:'b4e25831', name:'Dread Power', cp:1, phases:['movement'], turn:'your', needs:{ all:['Walker'] },
            when:'Your Movement phase.',
            target:'One friendly **ORKS WALKER** unit.',
            effect:'Your unit is **riled up** until the start of your next turn.' },
          { id:'stomping-juggernaut', gist:'When your unit is selected to move or declares a charge: it has MOBILE.', gistOf:'ad7e8279', name:'Stomping Juggernaut', cp:1, phases:['movement','charge'], turn:'your', needs:{ all:['Walker'] },
            when:'Your Movement/Charge phase, when a friendly **ORKS WALKER** unit is **selected to move** or **declares a charge**.',
            target:'That **ORKS WALKER** unit.',
            effect:'Your unit has **MOBILE**.' }
        ]
      },
      // the rule names no phase (an advance or fall-back move), so it has no ph
      'runt-swarm': {
        name:'Runt Swarm', dispositions:['Priority Assets'], dp:1,
        rule:{ name:'Sneaky Little Gitz', needs:{ all:['Gretchin'] },
          text:'- Friendly **GRETCHIN** units have **BATTLELINE**.\n- When a friendly **GRETCHIN** unit is selected to make an **advance**/**fall-back move**, that move does not prevent this unit from being **eligible to start an action**.' },
        enhancements:[
          { name:'Extra Sneaky', pts:10, upgrade:true, text:'**GRETCHIN** unit only. This unit has -3" **detection range**.' },
          { name:'Minefield Detail', pts:10, upgrade:true, text:'**GRETCHIN** unit only. While this unit is not embarked, this unit has **Scouts 6"**.' }
        ],
        stratagems:[
          { id:'infested-war-zone', gist:'After an enemy unit has attacked: add a new GRETCHIN unit identical to your just-destroyed unit to your army, in strategic reserves, at its starting strength.', gistOf:'c64b6483', name:'Infested War Zone', cp:2, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Gretchin'] },
            when:'Any phase, when an enemy unit has attacked.',
            target:'One friendly **GRETCHIN** unit that was just **destroyed**. You can target that unit with this **stratagem** even though that unit was just **destroyed**.',
            effect:'Add a new **GRETCHIN** unit to your army identical to your **destroyed** unit, in **strategic reserves**, at its **starting strength**, with its full wounds remaining.' },
          { id:'scarper', gist:'An enemy unit ends a move within 8" of your unengaged unit: your unit can make a normal move of up to D6", or up to 6" if it is an attached unit.', gistOf:'b77ff37f', name:'Scarper!', cp:1, phases:['movement'], turn:'opp', needs:{ all:['Gretchin'] },
            when:'Your opponent’s Movement phase, when an enemy unit ends a move within 8" of a friendly **unengaged GRETCHIN** unit.',
            target:'That **GRETCHIN** unit.',
            effect:'Your unit can make a **normal move** of:\n- Up to D6".\n- Or: Up to 6" instead if your unit is an **attached** unit.' },
          // needs is the TARGET (the GRETCHIN unit); the ORKS INFANTRY unit it names is the one being shot
          // shield: the Damage tab offers it as help to the ORKS INFANTRY unit (not GRETCHIN) of a list with a GRETCHIN unit, when it
          // is shot at in the Shooting phase: each hit roll that results in a hit ends that attack and the GRETCHIN unit suffers 1
          // mortal wound, while a model of it is on the battlefield ([TORRENT] hits are not hit rolls: the FAQ);
          // shield.def: the "When targeted" line of each unit it protects (their Shooting phase only), with the FAQ quoted
          { id:'grot-shields', shield:{ protects:{ all:['Faction: Orks','Infantry'], none:['Gretchin'] }, by:{ all:['Gretchin'] },
              def:'their Shooting phase, with a friendly GRETCHIN unit within 3": each hit roll of the attacking unit’s ranged attacks that results in a hit ends that attack, and that GRETCHIN unit suffers 1 mortal wound, while a model of it is on the battlefield. Wahapedia FAQ: “When using the Grot Shields stratagem, are hits by [TORRENT] weapons considered ’hit rolls that result in a hit’?” “No.”' },
            gist:'An enemy unit targets an ORKS INFANTRY unit (excluding GRETCHIN units) within 3" of your GRETCHIN unit: if a model in your GRETCHIN unit is on the battlefield, each hit roll of that enemy unit’s ranged attacks on that ORKS unit that results in a hit ends that attack, and your GRETCHIN unit suffers 1 mortal wound.', gistOf:'049168ae', name:'Grot Shields', cp:1, phases:['shooting'], turn:'opp', needs:{ all:['Gretchin'] },
            note:'Wahapedia FAQ: “When using the Grot Shields stratagem, are hits by [TORRENT] weapons considered ’hit rolls that result in a hit’?” “No.”',
            when:'Your opponent’s Shooting phase, when an enemy unit targets a friendly **ORKS INFANTRY** unit (excluding **GRETCHIN** units).',
            target:'One friendly **GRETCHIN** unit within 3" of that **ORKS INFANTRY** unit.',
            effect:'When a **hit roll** for that enemy unit’s ranged attacks that target that **ORKS** unit results in a hit, if a model in your **GRETCHIN** unit is on the battlefield, end the attack sequence for that attack and your **GRETCHIN** unit suffers 1 **mortal wound**.' }
        ]
      },
      // Shoota Boyz and Wreckas: Wahapedia wording (Orks, codex; GW publishes no Orks Faction Pack)
      'shoota-boyz': {
        name:'Shoota Boyz', dispositions:['Purge the Foe'], dp:1,
        rule:{ name:'Dakka! Dakka! Dakka!', ph:['movement','shooting'], turn:'either', turns:{ movement:'opp' }, needs:{ all:['Faction: Orks','Infantry'] },
          mod:{ kind:'ranged', when:'Riled up', cond:'riled', note:'+3" range' },
          text:'Friendly **ORKS INFANTRY** units’ ranged attacks have:\n- **[ASSAULT]**.\n- While this unit is **riled up**, +3" **R**.' },
        enhancements:[
          { name:'Supa-glowy Fing', pts:25, text:'**ORKS INFANTRY** model only (excluding **WEIRDBOY** models). This model’s ranged attacks have:\n- **[ANTI-INFANTRY 4+]**.\n- **[DEVASTATING WOUNDS]**.\n- **[SUPA-HAZARDOUS]**.\n**[SUPA-HAZARDOUS]:** Each time a unit is **selected to shoot**, after that unit has resolved all of its attacks, make two **hazard rolls** for that unit for each **[SUPA-HAZARDOUS]** weapon you selected in the Select Weapons step.' },
          { name:'Targetin’ Squigs', pts:20, text:'**BIG MEK**/**BIGBOSS**/**WARBOSS** model only. This unit’s ranged attacks (excluding **[TORRENT]** attacks) have +3" **R**.' }
        ],
        stratagems:[
          { id:'kustom-dakka', gist:'Your unit’s ranged attacks have +1 to wound rolls against a unit (excluding MONSTER/VEHICLE units).', gistOf:'d592ba36', name:'Kustom Dakka', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Faction: Orks','Infantry'] },
            mod:{ kind:'ranged', when:'Your Shooting phase, vs non-MONSTER/VEHICLE targets', note:'+1 to wound rolls', vs:{ none:['Monster','Vehicle'] } },
            when:'Your Shooting phase, when a friendly **ORKS INFANTRY** unit is **selected to shoot**.',
            target:'That **ORKS INFANTRY** unit.',
            effect:'Your unit’s ranged attacks that target a unit (excluding **MONSTER**/**VEHICLE** units) have +1 to **wound rolls**.' },
          { id:'glowin-dakka', gist:'Your unit’s ranged attacks against a unit within 9" have +1 AP.', gistOf:'5f6a7b0e', name:'Glowin’ Dakka', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Faction: Orks','Infantry'] },
            mod:{ kind:'ranged', when:'Your Shooting phase, vs targets within 9"', note:'+1 AP' },
            when:'Your Shooting phase, when a friendly **ORKS INFANTRY** unit is **selected to shoot**.',
            target:'That **ORKS INFANTRY** unit.',
            effect:'Your unit’s ranged attacks that target a unit within 9" have +1 **AP**.' },
          { id:'never-enough-dakka', gist:'Your unit’s ranged attacks have [SUSTAINED HITS 1].', gistOf:'e564f4a2', name:'Never Enough Dakka', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Faction: Orks','Infantry'] },
            mod:{ kind:'ranged', when:'Your Shooting phase', note:'[SUSTAINED HITS 1]' },
            when:'Your Shooting phase, when a friendly **ORKS INFANTRY** unit is **selected to shoot**.',
            target:'That **ORKS INFANTRY** unit.',
            effect:'Your unit’s ranged attacks have **[SUSTAINED HITS 1]**.' }
        ]
      },
      'war-horde': {
        name:'War Horde', dispositions:['Purge the Foe','Take and Hold'], dp:3,
        rule:{ name:'Get Stuck In', ph:['fight'], turn:'either', needs:{ all:['Faction: Orks'] },
          text:'Friendly **ORKS** units’ melee attacks have **[SUSTAINED HITS 1]**.' },
        enhancements:[
          { name:'Headwoppa’s Killchoppa', pts:15, text:'**ORKS** model only. If this unit made a **charge move** this turn, this model’s melee attacks have +1 AP.' },
          { name:'Da Boss is Watchin’', pts:25, text:'**ORKS** model only. (Once per battle, per army) In your Movement phase, you can use this ability. If you do, this unit is **riled up** until the start of your next turn.' },
          { name:'Kunnin’ But Brutal', pts:20, text:'**ORKS** model only. When this unit is selected to make a **fall-back move**, that fall-back move does not prevent this unit from being **eligible to shoot**/**declare a charge**.' },
          { name:'Follow Me Ladz', pts:20, text:'**ORKS** model only. This unit has +2" **M**.' }
        ],
        stratagems:[
          { id:'breakin-heads', gist:'Roll one D3: your unit suffers that many mortal wounds and is no longer battle-shocked.', gistOf:'7a31ce90', name:'Breakin’ Heads', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Faction: Orks','Infantry'], attached:true },
            when:'Any phase, when a friendly **attached ORKS INFANTRY** unit becomes **battle-shocked**.',
            target:'That **ORKS INFANTRY** unit. You can target that unit with this **stratagem** even though it is **battle-shocked**.',
            effect:'Roll one D3:\n- Your unit suffers a number of **mortal wounds** equal to the result.\n- Your unit is no longer **battle-shocked**.' },
          { id:'hit-em-harder', gist:'Your unit’s melee attacks have [LETHAL HITS].', gistOf:'8f79aca5', name:'Hit ’Em Harder', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: Orks'] },
            mod:{ kind:'melee', when:'Fight phase', note:'[LETHAL HITS]' },
            when:'Fight phase, when a friendly **ORKS** unit is **selected to fight**.',
            target:'That **ORKS** unit.',
            effect:'Your unit’s melee attacks have **[LETHAL HITS]**.' },
          { id:'orks-is-never-beaten', gist:'An enemy unit targets your unit: a model of it destroyed while your unit has not been selected to fight this phase: D6 (+1 if riled up); on a 4+ it stays until your unit has fought or the phase ends.', gistOf:'ff252f09', name:'Orks Is Never Beaten', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: Orks'], none:['Titanic'] },
            when:'Fight phase, when an enemy unit targets a friendly **ORKS** unit (excluding **TITANIC** units).',
            target:'That **ORKS** unit.',
            effect:'When a model in your unit is **destroyed**, if your unit has not been **selected to fight** this phase, roll one D6, with +1 to that roll if your unit is **riled up**:\n- On a 4+, do not remove that model from the battlefield. When your unit has fought, or at the end of the phase (whichever comes first), that model is removed from the battlefield.' },
          { id:'mow-em-down', gist:'Your unit made a charge move this turn: its melee attacks have [CLEAVE 1], or +1 to the value of a [CLEAVE] they already have.', gistOf:'b60d067f', name:'Mow ’Em Down', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: Orks','Vehicle'], none:['Walker'] },
            when:'Fight phase, when a friendly **ORKS VEHICLE** unit (excluding **WALKER** units) that made a **charge move** this turn is **selected to fight**.',
            target:'That **ORKS VEHICLE** unit.',
            effect:'Your unit’s melee attacks have:\n- **[CLEAVE 1]**.\n- Or: If that attack already has **[CLEAVE]**, +1 to the value of that **[CLEAVE]** (e.g. **[CLEAVE 1]** becomes **[CLEAVE 2]**).' },
          { id:'fungus-fuel-injection', gist:'Your unit has +2" M.', gistOf:'fb9e2724', name:'Fungus-fuel Injection', cp:1, phases:['movement'], turn:'your', needs:{ all:['Faction: Orks'], any:['Mounted','Vehicle'] },
            when:'Your Movement phase, when a friendly **ORKS MOUNTED**/**VEHICLE** unit is **selected to move**.',
            target:'That **ORKS MOUNTED**/**VEHICLE** unit.',
            effect:'Your unit has +2" **M**.' },
          { id:'close-range-dakka', gist:'Your unit’s ranged attacks have [RAPID FIRE 1], or +1 to the value of a [RAPID FIRE] they already have.', gistOf:'221896b5', name:'Close-range Dakka', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Faction: Orks'] },
            when:'Your Shooting phase, when a friendly **ORKS** unit is **selected to shoot**.',
            target:'That **ORKS** unit.',
            effect:'Your unit’s ranged attacks have:\n- **[RAPID FIRE 1]**.\n- Or: If that attack already has **[RAPID FIRE]**, +1 to the value of that **[RAPID FIRE]** (e.g. **[RAPID FIRE 1]** becomes **[RAPID FIRE 2]**).' }
        ]
      },
      'wreckas': {
        name:'Wreckas', dispositions:['Priority Assets'], dp:1,
        rule:{ name:'Wreckin’ and Lootin’', ph:['shooting'], turn:'your', needs:{ any:['Breaka Boyz','Flash Gitz','Tankbustas'] },
          mod:{ kind:'ranged', when:'Your Shooting phase, this unit or the target within range of an objective', cond:'objective', note:'can re-roll hit rolls of 1' },
          text:'In your Shooting phase, when a friendly **BREAKA BOYZ**/**FLASH GITZ**/**TANKBUSTAS** unit is **selected to shoot**, if any of the following apply, that unit’s attacks can re-roll **hit rolls** of 1:\n- That unit is within range of an **objective**.\n- The target of that attack is within range of an **objective**.' },
        enhancements:[
          { name:'Kaptin’s Hat', pts:25, text:'**LEADER: FLASH GITZ**\n**BIG MEK**/**WARBOSS INFANTRY** model only. When both players have deployed their armies, you can redeploy up to three friendly **ORKS INFANTRY** units. When doing so, you can set those units up in **strategic reserves**, regardless of how many units are already in strategic reserves.' },
          { name:'Supa-snazz Dakka', pts:25, upgrade:true, text:'**FLASH GITZ** unit only. This unit’s Snazzgun weapons have **[RAPID FIRE 1]**.' }
        ],
        stratagems:[
          { id:'drive-by-bustin', gist:'Your unit’s ranged attacks with weapons selected for Firing Deck have +1 to hit rolls.', gistOf:'99232c49', name:'Drive-by Bustin’', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Faction: Orks','Transport'] },
            when:'Your Shooting phase, when a friendly **ORKS TRANSPORT** unit is **selected to shoot**.',
            target:'That **ORKS TRANSPORT** unit.',
            effect:'Your unit’s ranged attacks with weapons selected for the **Firing Deck** ability have +1 to **hit rolls**.' },
          { id:'grab-it', gist:'After shooting, if unengaged: can make a normal move of up to 6", ending within range of an objective; not eligible to declare a charge this turn.', gistOf:'017e3667', name:'Grab It', cp:1, phases:['shooting'], turn:'your', needs:{ any:['Breaka Boyz','Flash Gitz','Tankbustas'] },
            when:'Your Shooting phase, when a friendly **unengaged BREAKA BOYZ**/**FLASH GITZ**/**TANKBUSTAS** unit has shot.',
            target:'That **BREAKA BOYZ**/**FLASH GITZ**/**TANKBUSTAS** unit.',
            effect:'- Your unit can make a **normal move** of up to 6", and must end that move within range of an **objective**.\n- Your unit is not **eligible to declare a charge** until the end of the turn.' },
          { id:'gun-crazy-show-offs', gist:'After an enemy unit has shot and hit yours: your unit shoots using normal shooting, but only at that enemy unit.', gistOf:'676149ce', name:'Gun-crazy Show-offs', cp:1, phases:['shooting'], turn:'opp', needs:{ any:['Flash Gitz','Tankbustas'] },
            when:'Your opponent’s Shooting phase, when an enemy unit has shot.',
            target:'One friendly **FLASH GITZ**/**TANKBUSTAS** unit hit by those attacks.',
            effect:'Your unit shoots using **normal shooting**, but while doing so your unit can only target that enemy unit.' }
        ]
      }
    }
  },
  'imperial-knights': {
    name: 'Imperial Knights',
    // words players use for a rule that has another name
    aliases: [[/^oath/i, 'Code Chivalric'], [/^honoured/i, 'Code Chivalric']],
    armyRules: [
      // Wahapedia wording; the table is the Deed and Quality tables (D6 roll, the oath line as the name).
      // The 'We pledge to reap a great tally' Deed is Wahapedia's errata wording (the page text already has it),
      // identical to the Rules Updates in GW's Faction Pack v1.2 (legal from 26 Aug 2026), PDF p27.
      { name:'Code Chivalric',
        text:'If your Army Faction is **IMPERIAL KNIGHTS**, at the end of the Read Mission Objectives step, you must determine your army’s Oath for the coming battle. An Oath consists of two parts - one Deed and one Quality. There are three options for each part, shown below.\nTo determine your army’s Deed, you can either select one Deed or you can randomly select one Deed by rolling a D6 and consulting the relevant table below. The selected Deed will describe what needs to be achieved in order to complete that Deed.\nTo determine your army’s Quality, you can either select one Quality or you can randomly select one Quality by rolling a D6 and consulting the relevant table below. Until the end of the battle, the ability described in the Quality selected applies to all models in your army with this ability.\nThe first time your selected Deed is completed your Oath is fulfilled and, until the end of the battle, your army becomes Honoured and you gain 2CP, or 3CP if you randomly selected your Deed and/or Quality (CP gained in this way are an exemption to the Core Rules that limit the maximum number of CP you can gain per battle round to 1).',
        table:[
          ['Deed 1–2 · We vow to lay low the tyrant…', 'At the start of the battle, select one **CHARACTER** model in your opponent’s army. This Deed is completed at the end of a turn if that **CHARACTER** is destroyed.'],
          ['Deed 3–4 · We swear to reclaim the realm…', 'This deed is completed at the end of your opponent’s turn if you control more objective markers than your opponent.'],
          ['Deed 5–6 · We pledge to reap a great tally…', 'This deed is completed at the end of the battle round if the number of enemy units destroyed this battle round is greater than the battle round number even if those units are subsequently returned to the battlefield (for example, two destroyed enemy units in the first battle round).'],
          ['Quality 1–2 · …with our martial valour risen over all', 'Each time this model is selected to shoot or fight, you can re-roll one **Hit roll** and you can re-roll one **Wound roll**.'],
          ['Quality 3–4 · …and we are eager for the challenge', 'Add 2" to this model’s Move characteristic and add 1 to **Advance** and **Charge rolls** made for this model.'],
          ['Quality 5–6 · …yet shall our legacy be unsullied', 'Improve this model’s Objective Control characteristic by 2 and its Leadership characteristic by 1.']
        ],
        // the Damage tab's reading (read by it alone): the Quality that changes attacks is listed as not counted (one re-roll a selection:
        // the calculator re-rolls no single die)
        calcNc:[{ kind:'all', from:'Code Chivalric', when:'Quality 1–2 (…with our martial valour risen over all)', note:'each time this model is selected to shoot or fight, you can re-roll one Hit roll and one Wound roll', why:'one re-roll: the calculator re-rolls no single die' }] },
      // needs: a Bondsman ability only ever affects an ARMIGER model, so without one in the army it does nothing
      { name:'Bondsman', ph:['command'], turn:'your', needs:{ any:['Armiger'] },
        text:'Some **IMPERIAL KNIGHTS** models have a Bondsman ability, tagged with the word ‘Bondsman’. In your Command phase, one or more models from your army with a Bondsman ability can use that ability. For each one that does, select one friendly **ARMIGER** model within 12" of that model (you cannot select an **ARMIGER** model that is already being affected by a Bondsman ability). Until the start of your next Command phase, that **ARMIGER** model is affected by that Bondsman ability.' },
      // Wahapedia, Codex: Imperial Knights army rules (GW's Faction Pack 1.2 prints "FACTION: Code Chivalric, Super-heavy
      // Walker" on the Imperial Knights datasheets). coreTwin: the core ability of the same name (Core Rules 24.35), which the
      // datasheets' Rules line opens; the two are shown together, and the note says the sources don't settle which applies
      // ph/turn: where its Normal, Advance and Fall Back moves are made
      { name:'Super-heavy Walker', coreTwin:'Super-Heavy Walker', ph:['movement'], turn:'your',
        note:'IMPERIAL KNIGHTS datasheets list Super-heavy Walker as a FACTION ability (Faction Pack 1.2), whose Codex text differs from Core Rules 24.35; the sources don’t say which applies.',
        text:'Each time a model with this ability makes a **Normal**, **Advance** or **Fall Back move**, it can move through models (excluding **TITANIC** models) and sections of **terrain features** that are 4" or less in height. When doing so:\n- It can move within **Engagement Range** of enemy models, but cannot end that move within Engagement Range of them.\n- It can also move through sections of terrain features that are more than 4" in height, but if it does, after it has moved, roll one D6: on a 1, that model is **Battle-shocked**.' }
    ],
    detachments: {
      'freeblade-company': {
        name:'Freeblade Company', dispositions:['Priority Assets','Purge the Foe'], dp:3,
        // rule, enhancements and stratagems: Wahapedia wording (Freeblade Company, App. Imperial Knights 11th edition v1.2),
        // checked word for word against GW's Faction Pack v1.2 (legal from 26 Aug 2026), pp5-6, which prints this detachment in full.
        // ph/turn: the part done at a moment, "at the start of your Command phase" (its Feel No Pain 6+ is a state: the datasheets'
        // When targeted line)
        rule:{ name:'Knights of Legend', ph:['command'], turn:'your', needs:{ all:['Faction: Imperial Knights'] },
          // proposed: the app adds this to the "When targeted" line of every unit the rule applies to
          def:'Feel No Pain 6+', defOf:'3ad29b72',
          text:'**IMPERIAL KNIGHTS** models from your army have the **Feel No Pain 6+** ability. In addition, at the start of your Command phase, each **IMPERIAL KNIGHTS** model from your army regains 1 lost wound.' },
        enhancements:[
          { name:'Bringer of Justice', pts:30, text:'**IMPERIAL KNIGHTS** model only. Improve the Attacks characteristic of melee weapons equipped by the bearer by 2, and each time the bearer makes a melee attack, add 1 to the **Hit roll**.' },
          { name:'Hunter’s Eye', pts:25, text:'**IMPERIAL KNIGHTS** model only. Ranged weapons equipped by the bearer have the **[IGNORES COVER]** ability.' },
          { name:'Mysterious Guardian', pts:35, text:'**IMPERIAL KNIGHTS** model only. (Once per battle, per army) At the end of your opponent’s turn, if this unit is **unengaged**, you can use this ability. If you do:\n- Place this unit in **strategic reserves**.\n- This unit has **Deep Strike** until the start of your next Shooting phase.\n- This unit must make an **ingress move** in your next Movement phase (including in your first turn).' },
          { name:'Sanctuary', pts:20, text:'**IMPERIAL KNIGHTS** model only. The bearer has a 5+ invulnerable save.' }
        ],
        stratagems:[
          { id:'noble-sacrifice', gist:'Your unit just destroyed: its Deadly Demise inflicts mortal wounds on a D6 roll of 4+ (adding 1 if it is an ARMIGER unit) instead of only a 6.', gistOf:'ef5c9ff3', name:'Noble Sacrifice', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Faction: Imperial Knights'] },
            when:'Any phase.',
            target:'One **IMPERIAL KNIGHTS** unit from your army that was just destroyed. You can target that unit with this Stratagem even though it was just destroyed.',
            effect:'Your unit’s **Deadly Demise** ability inflicts **mortal wounds** on a D6 roll of 4+, adding 1 to the result if it is an **ARMIGER** unit, instead of only a 6.' },
          { id:'strength-from-exile', gist:'Until the end of the phase, if no other friendly units are within 9", your unit’s attacks re-roll a hit roll of 1 and a wound roll of 1.', gistOf:'407f79f0', mod:{ kind:'all', when:'No other friendly unit within 9"', note:'re-roll hit and wound rolls of 1 (your Shooting or the Fight phase)', calc:{ rrHit:'1s', rrWound:'1s' } }, name:'Strength from Exile', cp:1, phases:['shooting','fight'], turn:'either', turns:{ shooting:'your' }, needs:{ all:['Faction: Imperial Knights'] },
            when:'Your Shooting phase or the Fight phase.',
            target:'One **IMPERIAL KNIGHTS** unit from your army that has not been selected to shoot or fight this phase.',
            effect:'Until the end of the phase, each time a model in your unit makes an attack, if there are no other friendly units within 9" of your unit, re-roll a **Hit roll** of 1 and re-roll a **Wound roll** of 1.' },
          // The Faction Pack (p6) prints DESTRIER as a keyword, not struck through: Wahapedia's strike-through is its
          // "Keyword does not appear in that faction" marker, not errata, so the effect uses the pack's wording.
          // The pack's Rules Updates entry "Full Tilt Stratagem, Target Section" (PDF p27) is under VALOURSTRIKE LANCE: it is that
          // detachment's 2CP Full Tilt, a different stratagem, so this one's target stays as printed.
          { id:'full-tilt', gist:'Until the end of the phase, if your unit Advances, no Advance roll: +6" Move instead (+9" for an ARMIGER or DESTRIER unit).', gistOf:'e0abe369',
            note:'No datasheet has the DESTRIER keyword; the Knight Destrier has KNIGHT DESTRIER. Wahapedia FAQ (02.05 Keywords): “Do rules that affect a keyword include multi-word keywords that contain that keyword? For example, would rules that affect COMMISSAR units affect a unit that has the COMMISSAR GRAVES keyword?” “No.” So a Knight Destrier adds either 6" or 9": the sources don’t say whether this stratagem’s DESTRIER means KNIGHT DESTRIER.',
            name:'Full Tilt', cp:1, phases:['movement'], turn:'your', needs:{ all:['Faction: Imperial Knights'] },
            when:'Your Movement phase.',
            target:'One **IMPERIAL KNIGHTS** unit from your army.',
            effect:'Until the end of the phase, if your unit Advances, do not make an Advance roll for it. Instead, until the end of the phase, add 6" to the Move characteristic of models in your unit, or 9" instead if your unit is an **ARMIGER** or **DESTRIER** unit.' },
          { id:'point-blank-barrage', gist:'Until the end of the phase, your unit’s Blast weapons can target enemy units within Engagement Range of it (if no other friendly unit is within Engagement Range of that enemy unit) and it has no hit roll penalty for being within Engagement Range; each unmodified hit roll of 1 with a Blast weapon against a unit within Engagement Range of it is 1 mortal wound to your unit, after all its attacks are resolved.', gistOf:'4543a023', name:'Point-Blank Barrage', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Faction: Imperial Knights'] },
            when:'Your Shooting phase.',
            target:'One **IMPERIAL KNIGHTS** unit from your army that has not been selected to shoot this phase.',
            effect:'Until the end of the phase, when making ranged attacks with Blast weapons, models in your unit can target enemy units within **Engagement Range** of your unit (provided no other friendly units are also within Engagement Range of that enemy unit). In addition, until the end of the phase, your unit does not suffer the penalty to its **Hit rolls** for being within Engagement Range of one or more enemy units, but each time a model in your unit makes an attack with a Blast weapon that targets a unit within Engagement Range of your unit, on an unmodified Hit roll of 1, your unit suffers 1 **mortal wound** after all of its attacks have been resolved.' },
          { id:'survivor-of-strife', gist:'Until the end of the phase, attacks against your unit whose S is greater than its T have -1 to the wound roll.', gistOf:'22e04f1b', def:'their Shooting phase: -1 to wound when the attack’s S is greater than its T', defOf:'22e04f1b', name:'Survivor of Strife', cp:1, phases:['shooting'], turn:'opp', needs:{ all:['Faction: Imperial Knights'] },
            when:'Your opponent’s Shooting phase, just after an enemy unit has selected its targets.',
            target:'One **IMPERIAL KNIGHTS** unit from your army that was selected as the target of one or more of the attacking unit’s attacks.',
            effect:'Until the end of the phase, each time an attack targets your unit, if the Strength characteristic of that attack is greater than the Toughness characteristic of your unit, subtract 1 from the **Wound roll**.' },
          { id:'flanking-manoeuvres', gist:'Your unit within 9" of a battlefield edge and not within Engagement Range of an enemy unit: remove it from the battlefield and place it into Strategic Reserves.', gistOf:'eb5e7255', name:'Flanking Manoeuvres', cp:1, phases:['fight'], turn:'opp', needs:{ all:['Armiger'] },
            when:'End of your opponent’s Fight phase.',
            target:'One **ARMIGER** unit from your army that is within 9" of one or more battlefield edges and not within **Engagement Range** of one or more enemy units.',
            effect:'Remove your unit from the battlefield and place it into **Strategic Reserves**.' }
        ]
      }
    }
  },
  'world-eaters': {
    name: 'World Eaters',
    // "Blessing of Khorne" (singular) in ability text opens the army rule
    aliases: [[/^blessings? of khorne/i, 'Blessings of Khorne']],
    // Wahapedia also lists Pact of Blood (a mustering restriction on BLOOD LEGIONS); it does nothing in play, so it is left out.
    armyRules: [
      { name:'Blessings of Khorne', at:'Start of the battle round', ph:['command','charge','fight'], turn:'either',
        // Wahapedia wording; the example's "1,2, 2" typo is written "1, 2, 2"
        text:'If your Army Faction is **WORLD EATERS**, at the start of the battle round, you can make a Blessings of Khorne roll. To do so, roll eight D6. You can then use those dice to activate up to two Blessings of Khorne (see below). Each Blessing of Khorne specifies the dice results it requires (where a number is specified, a double or triple of that value or higher is required). You can only activate each Blessing of Khorne once per battle round. Any unused dice from the Blessings of Khorne roll are then discarded. Once activated, each Blessing of Khorne applies to all units from your army with this ability until the end of the battle round.\n*Example: Ash makes a Blessings of Khorne roll, getting the following: 1, 2, 2, 2, 3, 4, 6, 6.*\n*First they use the two 6s to activate Warp Blades (which requires a double 5+), leaving the following dice: 1, 2, 2, 2, 3, 4.*\n*They then use the two 2s to activate Unbridled Bloodlust.*\n*Now that two Blessings of Khorne have been activated, no more can be activated and the remaining dice are discarded.*',
        // the six Blessings (Wahapedia), label = name and the dice it requires (drawn as dice icons on the page);
        // Unbridled Bloodlust uses its errata wording (adds the full stop)
        table:[
          ['Unbridled Bloodlust · double 1+', 'This unit has +1 to **charge rolls**.'],
          ['Rage-fuelled Invigoration · double 2+', 'Each time a model in this unit makes a Pile-in or **Consolidation move**, it can move up to 6" instead of up to 3".'],
          ['Total Carnage · double 3+', 'Each time a model in this unit is destroyed by a melee attack, if it has not fought this phase, roll one D6: on a 4+, do not remove it from play. The destroyed model can fight after the attacking unit has finished making its attacks, and is then removed from play.'],
          ['Martial Excellence · double 4+ or triple 1+', 'Melee weapons equipped by models in this unit have the **[SUSTAINED HITS 1]** ability.'],
          ['Warp Blades · double 5+ or triple 2+', 'Melee weapons equipped by models in this unit have the **[LETHAL HITS]** ability.'],
          ['Decapitating Strikes · double 6 or triple 3+', 'Each time a model in this unit makes a melee attack that targets an **INFANTRY** unit, that attack has the **[DEVASTATING WOUNDS]** ability.']
        ],
        // the Damage tab's reading (read by it alone): the Blessings that change a fight, each its own tick (which are active is the
        // player's to say); limit: up to two active at once, one more with Skulls for the Skull Throne! or, for a TERMINATOR SQUAD unit,
        // Adamantine Avalanche, every one for the unit of Archslaughterer's bearer: more ticked are counted by you. Total Carnage plays
        // in the fight back (onDeath: its models destroyed by the melee attacks before it fought fight on a 4+). Unbridled Bloodlust
        // (the charge is taken to succeed) and Rage-fuelled Invigoration (moves) change no numbers here
        calcMods:[
          { kind:'melee', from:'Martial Excellence', limit:'blessing', lasts:'round', when:'Blessing of Khorne active this battle round', note:'[SUSTAINED HITS 1]' },
          { kind:'melee', from:'Warp Blades', limit:'blessing', lasts:'round', when:'Blessing of Khorne active this battle round', note:'[LETHAL HITS]' },
          { kind:'melee', from:'Decapitating Strikes', limit:'blessing', lasts:'round', when:'Blessing of Khorne active this battle round, melee attacks that target an INFANTRY unit', note:'[DEVASTATING WOUNDS]', vs:{ any:['Infantry'] } },
          { kind:'melee', from:'Total Carnage', limit:'blessing', lasts:'round', when:'Blessing of Khorne active this battle round', note:'fighting back: its models destroyed by melee attacks before it fought fight on a 4+, then are removed', onDeath:{ roll:4 }, calc:{} }
        ],
        limit:{ blessing:{ n:2, what:'Blessings of Khorne', more:[{ strat:'skulls-for-the-skull-throne', n:1 }, { rule:'Adamantine Avalanche', n:1 }, { enhancement:'Archslaughterer', all:true }] } } }
    ],
    detachments: {
      'berzerker-warband': {
        name:'Berzerker Warband', dispositions:['Purge the Foe'], dp:2,
        // Wahapedia wording (the errata "Change to" text is the same as the main text)
        rule:{ name:'Relentless Rage', ph:['fight'], turn:'either', needs:{ all:['Faction: World Eaters'] },
          tag:'Already in A', note:'Already counted: every melee A value in this app includes this +1 A. Do not add it again.',
          text:'Friendly **WORLD EATERS** units’ melee attacks have +1 **A**.' },
        enhancements:[
          { name:'Berzerker Glaive', pts:35, text:'**WORLD EATERS** model only. Add 1 to the Attacks and Damage characteristics of melee weapons (excluding Extra Attacks weapons) equipped by the bearer.' },
          { name:'Helm of Brazen Ire', pts:30, text:'**WORLD EATERS** model only. Each time an attack is allocated to the bearer, subtract 1 from the Damage characteristic of that attack.' },
          { name:'Favoured of Khorne', pts:20, text:'**WORLD EATERS** model only. Each time you make a **Blessings of Khorne roll**, if the bearer is on the battlefield, you can re-roll up to two of the D6 rolled.' },
          { name:'Battle-lust', pts:20, text:'**WORLD EATERS** model only. You can re-roll **Charge rolls** made for the bearer’s unit. In addition, while the Unbridled Bloodlust Blessing of Khorne is active for your army, add 1 to Charge rolls made for the bearer’s unit.' }
        ],
        stratagems:[
          { id:'blood-offering', gist:'Your unit just destroyed within range of objective markers you controlled at the end of the previous phase: one of those objective markers stays under your control until your opponent’s Level of Control over it is greater than yours at the end of a phase.', gistOf:'953fd8a4', name:'Blood Offering', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Faction: World Eaters'] },
            when:'Any phase.',
            target:'One **WORLD EATERS** unit from your army that was just destroyed while it was within range of one or more objective markers you controlled at the end of the previous phase. You can use this Stratagem on that unit even though it was just destroyed.',
            effect:'Select one of those objective markers. That objective marker remains under your control until your opponent’s Level of Control over that objective marker is greater than yours at the end of a phase.' },
          { id:'hack-and-slash', gist:'Your unit made a charge move this turn and has not been selected to fight this phase: until the end of the phase, its melee weapons have +1 AP.', gistOf:'2800cd94', mod:{ kind:'melee', when:'Made a charge move this turn', cond:'charged', note:'+1 AP in the Fight phase' }, name:'Hack and Slash', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: World Eaters'] },
            when:'Fight phase.',
            target:'One **WORLD EATERS** unit from your army that has not been selected to fight this phase and that made a **charge move** this turn.',
            effect:'Until the end of the phase, improve the Armour Penetration characteristic of melee weapons equipped by models in your unit by 1.' },
          { id:'frenzied-resilience', gist:'Until the end of the phase, -1 Damage to each attack allocated to a model in your unit.', gistOf:'e3699df1', def:'Fight phase: -1 Damage to each attack allocated to it', defOf:'e3699df1', name:'Frenzied Resilience', cp:2, phases:['fight'], turn:'either', needs:{ all:['Faction: World Eaters'] },
            when:'Fight phase, just after an enemy unit has selected its targets.',
            target:'One **WORLD EATERS** unit from your army that was selected as the target of one or more of the attacking unit’s attacks.',
            effect:'Until the end of the phase, each time an attack is allocated to a model in your unit, subtract 1 from the Damage characteristic of that attack.' },
          { id:'skulls-for-the-skull-throne', gist:'Just after your unit destroys a CHARACTER or MONSTER model: make a Blessings of Khorne roll and use it to activate one Blessing of Khorne, active until the end of the battle round in addition to the others.', gistOf:'8130d977', name:'Skulls for the Skull Throne!', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: World Eaters'] },
            when:'Fight phase, just after a **WORLD EATERS** unit from your army destroys a **CHARACTER** or **MONSTER** model.',
            target:'That **WORLD EATERS** unit.',
            effect:'Make a **Blessings of Khorne roll** and use the results to activate one Blessing of Khorne. Until the end of the battle round, that Blessing of Khorne is active in addition to any other Blessings of Khorne that are currently active.' },
          // New Recruit gives the Khorne Berzerkers the keyword "Berzerkers"
          // (Wahapedia's phase icon for this one is the Charge phase; the WHEN is the Movement phase, so it is listed there)
          { id:'apoplectic-frenzy', gist:'Until the end of the turn, your unit is eligible to declare a charge even though it Advanced.', gistOf:'a3be681f', name:'Apoplectic Frenzy', cp:1, phases:['movement'], turn:'your', needs:{ all:['Berzerkers'] },
            when:'Your Movement phase, just after a **KHORNE BERZERKERS** unit from your army is selected to **Advance**.',
            target:'That **KHORNE BERZERKERS** unit.',
            effect:'Until the end of the turn, your unit is eligible to declare a charge in a turn in which it Advanced.' },
          // target and effect: Wahapedia errata wording (bolds "surge move")
          { id:'berzerkers-wrath', gist:'Your unit’s surge move is up to 8" instead of a D6 roll.', gistOf:'cadbd052', name:'Berzerker’s Wrath', cp:1, phases:['shooting'], turn:'opp', needs:{ all:['Berzerkers'] },
            note:'Wahapedia FAQ: “After being the target of a ranged attack, can a Leader unit make a Blood Surge move if it was previously attached to a unit of Khorne Berzerkers and if the last model in the attached unit was destroyed by that ranged attack?” No.',
            when:'Your opponent’s Shooting phase, just after an enemy unit has shot.',
            target:'One **KHORNE BERZERKERS** unit from your army that can make a **surge move** as a result of those attacks.',
            effect:'Do not roll a D6 to determine how far models in your unit can move when they make a **surge move**. Instead, when making a **surge move**, those models can move up to 8".' }
        ]
      },
      // Khorne Daemonkin: GW's Faction Pack (1.3) does not print it, only Rules Updates to Disciple of Khorne and Summoned by
      // Slaughter (their wording is used); the rest is Wahapedia's. The detachment rule's RESTRICTIONS are part of it as printed.
      'khorne-daemonkin': {
        name:'Khorne Daemonkin', dispositions:['Reconnaissance'], dp:2,
        rule:{ name:'Blood Tithe', ph:['command'], turn:'either', needs:{ any:['Faction: Blood Legions','Faction: World Eaters'] },
          text:'Each time a **BLOOD LEGIONS** or **WORLD EATERS** unit from your army destroys an enemy unit, roll one D6: on a 3+, you gain 1 Blood Tithe point (BTP). At the start of the Command phase, you can spend one or more of your BTP to activate one of the following abilities until the end of the battle:\n- **Enraged Abjuration [2BTP]**\n**BLOOD LEGIONS** and **WORLD EATERS** models from your army have the **Feel No Pain 5+** ability against **Psychic Attacks** and **mortal wounds**.\n- **Daemonic Rage [3BTP]**\nMelee weapons equipped by **BLOOD LEGIONS** units from your army have the **[lance]** ability.\n- **Boon of Blood [4BTP]**\n**BLOOD LEGIONS** units from your army have a 4+ invulnerable save.\n- **Might of Khorne [5BTP]**\n**BLOOD LEGIONS** units from your army gain the Blessings of Khorne ability.\nRESTRICTIONS\nYou can include the **BLOOD LEGIONS** units in your army. The combined points cost of such units you can include in your army is:\n- **Incursion:** Up to 500 pts\n- **Strike Force:** Up to 1000 pts\n- **Onslaught:** Up to 1500 pts\nNo **BLOOD LEGIONS** model from your army can be your **WARLORD**.',
          // the four abilities, each on the units its words name (BLOOD LEGIONS and WORLD EATERS models, BLOOD LEGIONS units): once
          // activated with BTP they last until the end of the battle, so each is shown with "active"
          parts:[
            { name:'Enraged Abjuration', needs:{ any:['Faction: Blood Legions','Faction: World Eaters'] }, def:'Enraged Abjuration active (2BTP): Feel No Pain 5+ against Psychic Attacks and mortal wounds', defOf:'09981cf0' },
            { name:'Daemonic Rage', needs:{ any:['Faction: Blood Legions'] }, mod:{ kind:'melee', when:'Daemonic Rage active (3BTP)', note:'[LANCE]' } },
            { name:'Boon of Blood', needs:{ any:['Faction: Blood Legions'] }, def:'Boon of Blood active (4BTP): 4+ invulnerable save', defOf:'09981cf0' },
            // grants: the Damage tab gives a BLOOD LEGIONS unit without the Blessings of Khorne ability the Blessings' ticks, with this condition
            { name:'Might of Khorne', needs:{ any:['Faction: Blood Legions'] }, grants:'Blessings of Khorne', when:'Might of Khorne active (5BTP)' }
          ] },
        enhancements:[
          { name:'Icon of War', pts:25, text:'**WORLD EATERS** model only. While a friendly **BLOOD LEGIONS** unit is within 6" of the bearer, that unit has the Blessings of Khorne ability. If the Might of Khorne ability is active for your army, then while a friendly **BLOOD LEGIONS** unit is within 6" of the bearer, you can re-roll **Battle-shock tests** taken for that unit.' },
          { name:'Blood-forged Armour', pts:20, text:'**BLOOD LEGIONS** or **WORLD EATERS** model only. The bearer has a Save characteristic of 2+. If the bearer is destroyed, you gain 1 Blood Tithe point.' },
          // the Faction Pack's Rules Update (Wahapedia's errata is the same)
          { name:'Disciple of Khorne', pts:15, text:'**LORD ON JUGGERNAUT** model only. The bearer has the Deep Strike ability, and it has the **BLOOD LEGIONS** Faction keyword instead of the **WORLD EATERS** Faction keyword.' },
          // "bearer’s" as BSData and New Recruit print it (Wahapedia: "bearers", deviations-texts.json)
          { name:'Blade of Endless Bloodshed', pts:30, text:'**WORLD EATERS** model only. Add 1 to the Attacks, Strength and Damage characteristics of the bearer’s melee weapons. Each time the bearer’s unit destroys an enemy unit with a melee attack, do not roll to gain a Blood Tithe point, you automatically gain 1 Blood Tithe point instead.' }
        ],
        stratagems:[
          // the Faction Pack's Rules Update (Wahapedia's text has "first.)" for "first)."); no BLOODLETTERS unit in a list shows it on no unit
          { id:'summoned-by-slaughter', gist:'The last model of a unit is destroyed: set your BLOODLETTERS unit in Reserves up wholly within 9" of that model and more than 6" horizontally away from all enemy units (once per battle round).', gistOf:'70d783dd', name:'Summoned by Slaughter', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Bloodletters'] },
            when:'Any phase, when the last model in a unit is destroyed, before removing it from play. (If that unit is a **TRANSPORT**, any units embarked within that **TRANSPORT** model must disembark first).',
            target:'One **BLOODLETTERS** unit from your army that is in Reserves.',
            effect:'Set your unit up anywhere on the battlefield wholly within 9" of that destroyed model and more than 6" horizontally away from all enemy units, then remove the destroyed model from play.',
            restrictions:'You cannot use this Stratagem more than once per battle round.' },
          // needs is the TARGET (the BLOOD LEGIONS unit); the WORLD EATERS unit within 6" it selects is the one whose weapons change:
          // help lists it on each WORLD EATERS unit of a list with another BLOOD LEGIONS unit, with its footnote (via: who is its target)
          { id:'daemonic-fury', help:{ to:{ all:['Faction: World Eaters'] }, by:{ all:['Faction: Blood Legions'] }, via:'its target: a BLOOD LEGIONS unit within 6"',
              mod:{ kind:'melee', when:'Start of your Fight phase, selected by its target, a friendly BLOOD LEGIONS unit within 6"', note:'[LANCE] until the end of the turn (Daemonic Rage active: also [TWIN-LINKED] until the end of the phase)',
                pick:[{ name:'[LANCE]', note:'[LANCE]' }, { name:'Daemonic Rage active', note:'[LANCE], [TWIN-LINKED]' }] } },
            gist:'Select one friendly WORLD EATERS unit within 6" of your unit: until the end of the turn its melee weapons have [LANCE] (and [TWIN-LINKED] until the end of the phase if Daemonic Rage is active).', gistOf:'bf58a7af', name:'Daemonic Fury', cp:1, phases:['fight'], turn:'your', needs:{ all:['Faction: Blood Legions'] },
            when:'Start of your Fight phase.',
            target:'One **BLOOD LEGIONS** unit from your army.',
            effect:'Select one friendly **WORLD EATERS** unit within 6" of your unit. Until the end of the turn, melee weapons equipped by models in your **WORLD EATERS** unit have the **[LANCE]** ability. If the Daemonic Rage ability is active for your army, then until the end of the phase those melee weapons also have the **[TWIN-LINKED]** ability.' },
          { id:'a-worthy-skull', gist:'Your unit has fought and destroyed one or more enemy CHARACTER or MONSTER models: you gain D3BTP and can then spend BTP to activate one of the Blood Tithe abilities.', gistOf:'dbf68968', name:'A Worthy Skull', cp:1, phases:['fight'], turn:'either', needs:{ any:['Faction: Blood Legions','Faction: World Eaters'] },
            when:'Fight phase, just after a **BLOOD LEGIONS** or **WORLD EATERS** unit from your army has fought, and one or more enemy **CHARACTER** or **MONSTER** models were destroyed as a result of those attacks.',
            target:'That **BLOOD LEGIONS** or **WORLD EATERS** unit.',
            effect:'You gain D3BTP and you can then spend one or more BTP you have to activate one of the Blood Tithe abilities.' },
          // needs is the TARGET (the BLOOD LEGIONS unit); shield.def: the "When targeted" line of each WORLD EATERS unit, with a
          // BLOOD LEGIONS unit in the list, as the effect says it ("models in your WORLD EATERS unit")
          { id:'blessing-of-burning-blood', shield:{ protects:{ all:['Faction: World Eaters'] }, by:{ all:['Faction: Blood Legions'] },
              def:'their Shooting phase or the Fight phase, with a friendly BLOOD LEGIONS unit within 6": its models have a 5+ invulnerable save until the end of the phase (4+ if Boon of Blood is active)' },
            gist:'A WORLD EATERS unit within 6" of your unit is selected as a target: until the end of the phase, models in that WORLD EATERS unit have a 5+ invulnerable save (4+ if Boon of Blood is active).', gistOf:'220ca20b', name:'Blessing of Burning Blood', cp:1, phases:['shooting','fight'], turn:'either', turns:{ shooting:'opp' }, needs:{ all:['Faction: Blood Legions'] },
            when:'Your opponent’s Shooting phase or the Fight phase, just after an enemy unit has selected its targets.',
            target:'One **BLOOD LEGIONS** unit from your army that is within 6" of a friendly **WORLD EATERS** unit that was selected as the target as one or more of the attacking unit’s attacks.',
            effect:'Until the end of the phase, models in your **WORLD EATERS** unit have a 5+ invulnerable save. If the Boon of Blood ability is active for your army, then until the end of the phase, models in your **WORLD EATERS** unit have a 4+ invulnerable save.' },
          // needs is the TARGET (the WORLD EATERS unit); the models return to a BLOOD LEGIONS unit within 6" of it
          { id:'daemontide', gist:'Select one friendly BLOOD LEGIONS unit within 6" of your unit: one destroyed MOUNTED model, up to D3 destroyed BEAST models or up to D6 destroyed INFANTRY models return to it with full wounds (not CHARACTER models to Attached units).', gistOf:'c8925706', name:'Daemontide', cp:1, phases:['command'], turn:'your', needs:{ all:['Faction: World Eaters'] },
            when:'Your Command phase.',
            target:'One **WORLD EATERS** unit from your army.',
            effect:'Select one friendly **BLOOD LEGIONS** unit within 6" of your unit. One destroyed **MOUNTED** model, up to D3 destroyed **BEAST** models, or up to D6 destroyed **INFANTRY** models are returned to that **BLOOD LEGIONS** unit with their full wounds remaining.',
            restrictions:'This Stratagem cannot be used to return destroyed **CHARACTER** models to Attached units.' },
          { id:'murder-call', gist:'Your unit on the battlefield and not within Engagement Range of one or more enemy units: remove it from the battlefield and place it into Strategic Reserves.', gistOf:'1b2b8cbb', name:'Murder-call', cp:1, phases:['fight'], turn:'opp', needs:{ all:['Faction: Blood Legions'] },
            when:'End of your opponent’s Fight phase.',
            target:'One **BLOOD LEGIONS** unit from your army that is on the battlefield and not within **Engagement Range** of one or more enemy units.',
            effect:'Remove your unit from the battlefield and place it into **Strategic Reserves**.' }
        ]
      },
      // Butchers of Khorne: the Faction Pack (1.3, p3) prints it in full, word for word as Wahapedia; its Rules Updates do not change it
      'butchers-of-khorne': {
        name:'Butchers of Khorne', dispositions:['Take and Hold'], dp:1,
        rule:{ name:'Adamantine Avalanche', ph:['fight'], turn:'either', needs:{ all:['Terminator Squad'] },
          text:'At the start of the Fight phase, if a friendly **TERMINATOR SQUAD** unit is **engaged**, make a **Blessings of Khorne roll** and use the results to activate one **Blessing of Khorne**. Until the end of the phase, that **Blessing of Khorne** is active for friendly **TERMINATOR SQUAD** units in addition to any other **Blessings of Khorne** that are currently active.' },
        // pts from Wahapedia, matching BSData; both are Upgrades (Wahapedia and the pack mark them UPGRADE).
        // The pack prints the names in capitals; Gore-stained Veterans is spelled as BSData and New Recruit
        // spell it (Wahapedia: "Gore-Stained"), so the list import finds it.
        enhancements:[
          { name:'Sanctified in Slaughter', pts:15, upgrade:true, text:'**TERMINATOR SQUAD** unit only. This unit has +1 **OC**.' },
          { name:'Gore-stained Veterans', pts:20, upgrade:true, text:'**TERMINATOR SQUAD** unit only. This unit’s melee attacks have +1 **WS**.' }
        ],
        stratagems:[
          { id:'focused-ferocity', gist:'Your unit’s melee attacks have +1 A.', gistOf:'f1e3267b', mod:{ kind:'melee', when:'When selected to fight', note:'+1 A' }, name:'Focused Ferocity', cp:1, phases:['fight'], turn:'either', needs:{ all:['Terminator Squad'] },
            when:'Fight phase, when a friendly **TERMINATOR SQUAD** unit is **selected to fight**.',
            target:'That **TERMINATOR SQUAD** unit.',
            effect:'Your unit’s melee attacks have +1 **A**.' },
          { id:'a-trophy-for-the-throne', gist:'Your unit’s attacks against a MONSTER/VEHICLE unit have +1 to wound rolls.', gistOf:'be5bf151', mod:{ kind:'melee', when:'When selected to fight, vs MONSTER/VEHICLE targets', note:'+1 to wound rolls', vs:{ any:['Monster','Vehicle'] } }, name:'A Trophy for the Throne', cp:1, phases:['fight'], turn:'either', needs:{ all:['Terminator Squad'] },
            when:'Fight phase, when a friendly **TERMINATOR SQUAD** unit is **selected to fight**.',
            target:'That **TERMINATOR SQUAD** unit.',
            effect:'Your unit’s attacks that target a **MONSTER/VEHICLE** unit have +1 to **wound rolls**.' },
          // "Shooting Phase" with a capital P, as both the pack and Wahapedia print it
          { id:'wrath-beyond-reason', gist:'Ranged attacks that target your unit have -1 D until that enemy unit has attacked.', gistOf:'9ef034bd', def:'their Shooting phase: -1 D to ranged attacks that target it (until that enemy unit has attacked)', defOf:'9ef034bd', name:'Wrath Beyond Reason', cp:2, phases:['shooting'], turn:'opp', needs:{ all:['Terminator Squad'] },
            when:'Your opponent’s Shooting Phase, when an enemy unit targets a friendly **TERMINATOR SQUAD** unit.',
            target:'That **TERMINATOR SQUAD** unit.',
            effect:'Ranged attacks that target your unit have -1 **D** until that enemy unit has attacked.' }
        ]
      },
      'vessels-of-wrath': {
        name:'Vessels of Wrath', dispositions:['Priority Assets'], dp:1,
        rule:{ name:'Wrath of Khorne', ph:['fight'], turn:'either', needs:{ all:['Faction: World Eaters','Character'], none:['Epic Hero'] },
          mod:{ kind:'melee', when:'When selected to fight', note:'CHARACTER models: [CLEAVE 1] or +1 AP',
            pick:[{ name:'[CLEAVE 1]', note:'CHARACTER models: [CLEAVE 1]' }, { name:'+1 AP', note:'CHARACTER models: +1 AP' }] },
          text:'When a friendly **WORLD EATERS CHARACTER** unit (excluding **EPIC HERO** units) is **selected to fight**, that unit’s **CHARACTER** models’ melee attacks can have:\n- **[CLEAVE 1]**.\n- Or: +1 **AP**.' },
        enhancements:[
          { name:'Archslaughterer', pts:30, text:'**WORLD EATERS** model only. (Once per battle, per army) In your Command phase, you can use this ability. If you do, every **Blessing of Khorne** is active for this unit until the start of your next turn.' },
          { name:'Gateways to Glory', pts:10, text:'**WORLD EATERS DAEMON PRINCE** model only. This model has:\n- **MOBILE**.\n- +1 to **charge rolls**.' }
        ],
        stratagems:[
          { id:'scorn-the-witch', gist:'Your unit has Feel No Pain 4+ against mortal wounds.', gistOf:'bef180bd', def:'Feel No Pain 4+ against mortal wounds', defOf:'bef180bd', name:'Scorn the Witch', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Faction: World Eaters','Character'], none:['Epic Hero'] },
            when:'Any phase, when a friendly **WORLD EATERS CHARACTER** unit (excluding **EPIC HERO** units) suffers a **mortal wound**.',
            target:'That **WORLD EATERS CHARACTER** unit.',
            effect:'Your unit has **Feel No Pain 4+** against **mortal wounds**.' },
          { id:'aspire-to-infamy', gist:'Your unit’s CHARACTER models’ melee attacks have +1 A and +2 S.', gistOf:'64a0e87c', mod:{ kind:'melee', when:'When selected to fight', note:'CHARACTER models +1 A, +2 S' }, name:'Aspire to Infamy', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: World Eaters','Character'], none:['Epic Hero'] },
            when:'Fight phase, when a friendly **WORLD EATERS CHARACTER** unit (excluding **EPIC HERO** units) is **selected to fight**.',
            target:'That **WORLD EATERS CHARACTER** unit.',
            effect:'Your unit’s **CHARACTER** models’ melee attacks have:\n- +1 **A**.\n- +2 **S**.' },
          { id:'punish-the-craven', gist:'An enemy unit engaged with your unit is selected to fall back: it must use desperate escape (-1 to those hazard rolls if it is battle-shocked).', gistOf:'d37cb14a', name:'Punish the Craven', cp:1, phases:['movement'], turn:'opp', needs:{ all:['Faction: World Eaters','Character'] },
            when:'Your opponent’s Movement phase, when a unit is selected to make a **fall-back move**, if that unit is **engaged** with a friendly **WORLD EATERS CHARACTER** unit.',
            target:'That **WORLD EATERS CHARACTER** unit.',
            effect:'When an enemy unit **engaged** with your unit is selected to make a **fall-back move**, that enemy unit must use the **desperate escape** mode. If that enemy unit is **battle-shocked**, -1 from those **hazard rolls**.' }
        ]
      }
    }
  },
  'thousand-sons': {
    name: 'Thousand Sons',
    // words players use for a rule that has another name ("Psychic test" in Magnus’ ability text)
    aliases: [[/^rituals?$/i, 'Cabal of Sorcerers'], [/^psychic tests?$/i, 'Cabal of Sorcerers']],
    // army rules: Wahapedia, Thousand Sons, Army Rules
    armyRules: [
      { name:'Cabal of Sorcerers', ph:['shooting','charge'], turn:'your',
        // The Psychic test sequence is a diagram on Wahapedia: its dice pictures (2D6, then + one D6)
        // are written out as "roll one additional D6" (Arcane Focus calls it "the additional D6").
        // The army rules have no rendered note field, so the official FAQ (Faction Pack 1.3, also on Wahapedia) goes in the text as italic lines.
        text:'If your Army Faction is **THOUSAND SONS**, at the start of your Shooting phase, one or more models from your army with this ability can attempt Rituals from those listed below. To do so, select one model from your army with this ability that has not yet attempted a Ritual this turn and select one Ritual no model from your army has attempted to manifest this turn, then take a Psychic test for that model by following the sequence below.\n**Psychic Test Sequence**\n- **Roll 2D6**\n- **Channel the Warp** (Optional)\n- Then, if one or more doubles or triples were rolled during this test, that model’s unit suffers D3 mortal wounds.\n- If that model is not destroyed, the combined total of all the dice rolled during this test is the Psychic test result. If this equals or exceeds the Warp Charge value of the Ritual being attempted, that model manifests that Ritual and you resolve its effects.\n*FAQ (Faction Pack 1.3): Do I need to sequence all of my Cabal of Sorcerers Rituals at the start of my Shooting phase? No, you just pick a model with the Cabal of Sorcerers rule, pick a Ritual to manifest, and attempt it, then repeat the process until you have run out of models or Rituals or both.*\n*FAQ (Faction Pack 1.3): When using the Cabal of Sorcerers army rule, do I have to choose whether to Channel the Warp before rolling any dice? No.*\n*FAQ (Faction Pack 1.3): When using the Cabal of Sorcerers army rule, if I roll one or more doubles or triples, does my model only suffer D3 mortal wounds if I chose to Channel the Warp? Yes.*\n*App note, not rules text: Channel the Warp means rolling one more D6 for the test (the printed card shows it as a die).*',
        // the Rituals, label = name and Warp Charge value
        table:[
          ['Destiny’s Ruin (Psychic) · Warp Charge 5', 'Select one enemy unit within 24" of and **visible** to the manifesting model. Until the end of the phase, each time a **THOUSAND SONS** or **SCINTILLATING LEGIONS** model from your army makes an attack that targets that unit, re-roll a **Hit roll** of 1. If the Psychic test result for this Ritual was 10+, you can re-roll the Hit roll instead.'],
          ['Temporal Surge (Psychic) · Warp Charge 6', 'Select one friendly **THOUSAND SONS** or **SCINTILLATING LEGIONS** unit that is not within **Engagement Range** of one or more enemy units and is within 24" of and **visible** to the manifesting model. That unit can make a **Normal move** of up to D6". If the Psychic test result for this Ritual was 10+, that unit can make a Normal move of up to 6" instead. In either case, until the end of the turn, that unit is not eligible to declare a charge.'],
          ['Doombolt (Psychic) · Warp Charge 7', 'Select one enemy unit within 24" of and **visible** to the manifesting model (excluding units with the **Lone Operative** ability that are not part of an Attached unit and are not within 12" of the manifesting model); that unit suffers D3 **mortal wounds**. If the Psychic test result for this Ritual was 11+, that unit suffers D3+3 mortal wounds instead.'],
          ['Twist of Fate (Psychic) · Warp Charge 9', 'Select one enemy unit within 24" of and **visible** to the manifesting model. Until the end of the phase, each time a **THOUSAND SONS** or **SCINTILLATING LEGIONS** model from your army makes an attack that targets that unit, improve the Armour Penetration characteristic of that attack by 1. If the Psychic test result for this Ritual was 12+, improve the Armour Penetration characteristic of that attack by 2 instead.']
        ],
        // the Damage tab's reading (read by it alone): the two Rituals that change attacks on the unit they select, for THOUSAND SONS and
        // SCINTILLATING LEGIONS models of the army until the end of the phase (help: a model with this ability manifests it); the pick is
        // the Psychic test result. Doombolt's mortal wounds and Temporal Surge's move are not attacks
        calcMods:[
          { kind:'ranged', from:'Destiny’s Ruin', help:true, needs:{ any:['Faction: Thousand Sons','Scintillating Legions'] }, when:'Your Shooting phase, manifested against this target (Warp Charge 5)', note:'re-roll hit rolls of 1 (10+: re-roll hit rolls)',
            pick:[{ name:'Result 5-9', note:'re-roll hit rolls of 1' }, { name:'Result 10+', note:'re-roll hit rolls' }] },
          { kind:'ranged', from:'Twist of Fate', help:true, needs:{ any:['Faction: Thousand Sons','Scintillating Legions'] }, when:'Your Shooting phase, manifested against this target (Warp Charge 9)', note:'+1 AP (12+: +2 AP)',
            pick:[{ name:'Result 9-11', note:'+1 AP' }, { name:'Result 12+', note:'+2 AP' }] }
        ] },
      { name:'Pact of Sorcery',
        text:'When mustering your army, unless specifically stated otherwise, you cannot select **SCINTILLATING LEGIONS** as your Army Faction.' }
    ],
    detachments: {
      'grand-coven': {
        name:'Grand Coven', dispositions:['Disruption','Priority Assets'], dp:3,
        // rule, enhancements and stratagems: Wahapedia, Thousand Sons, Grand Coven
        // needs: the units with Psychic weapons (every one of them is a PSYKER unit, and no other unit of the list has one)
        rule:{ name:'Kindred Sorcery', ph:['command','movement','shooting','fight'], turn:'either', turns:{ command:'your', movement:'opp', shooting:'your' }, needs:{ all:['Faction: Thousand Sons','Psyker'] },
          mod:{ kind:'all', lasts:'round', when:'Kindred Sorcery (one ability, picked in your Command phase; each ability only once per battle)', note:'Psychic weapons only: Imbued Manifestation +6" range (ranged) · Psychic Maelstrom +1 to wound rolls · Wrath of the Immaterium [DEVASTATING WOUNDS]',
            pick:[{ name:'Imbued Manifestation', note:'Psychic weapons only: +6" range' }, { name:'Psychic Maelstrom', note:'Psychic weapons only: +1 to wound rolls' }, { name:'Wrath of the Immaterium', note:'Psychic weapons only: [DEVASTATING WOUNDS]' }] },
          text:'In your Command phase, you can select one of the abilities listed below to take effect until the start of your next Command phase. You can only select each of these abilities once per battle.',
          table:[
            ['Imbued Manifestation', 'Add 6" to the Range characteristic of ranged Psychic weapons equipped by **THOUSAND SONS** models from your army.'],
            ['Psychic Maelstrom', 'Each time a **THOUSAND SONS** model from your army makes an attack with a Psychic weapon, add 1 to the **Wound roll**.'],
            ['Wrath of the Immaterium', 'Psychic weapons equipped by **THOUSAND SONS** models from your army have the **[DEVASTATING WOUNDS]** ability.']
          ] },
        // pts match the New Recruit roster: Sorcerer in Terminator Armour 110 + 30 = 140, Daemon Prince 170 + 35 = 205
        enhancements:[
          { name:'Lord of Forbidden Lore', pts:20, text:'**THOUSAND SONS** model only. Each time the bearer manifests a **Ritual**, while resolving that Ritual, add 6" to its range.' },
          // nr: New Recruit and BSData spell it "Incandeum"; GW (Wahapedia, Faction Pack) "Incandaeum"
          { name:'Incandaeum', nr:'Incandeum', pts:15, text:'**EXALTED SORCERER** model only. Once per battle, when selecting a **Ritual** for the bearer to attempt, you can select Doombolt, even if a model from your army have already attempted to manifest that Ritual this phase.' },
          { name:'Umbralefic Crystal', pts:30, text:'**THOUSAND SONS** model only. (Once per battle, per army) In your Command phase, if this unit is **unengaged**, you can use this ability. If you do:\n- Place this unit in **strategic reserves**.\n- This unit has **Deep Strike** until the start of your next Shooting phase.\n- This unit must make an **ingress move** in your next Movement phase (including in your first turn).' },
          { name:'Eldritch Vortex of E’taph', pts:35, text:'**THOUSAND SONS** model only. Add 1 to the Strength and Damage characteristics of Psychic weapons equipped by the bearer.' }
        ],
        // phases and turn from Wahapedia's stratagem icons (Any/Either, Command/Your, Shooting/Your)
        stratagems:[
          // effect: Wahapedia's current wording (checked 20 Oct 2026; the Faction Pack 1.3 Rules Updates do not change this stratagem)
          { id:'psychic-dominion', gist:'Until the end of the phase, attacks made against your unit with Psychic weapons have [HAZARDOUS], and models in your unit have Feel No Pain 4+ against Psychic Attacks.', gistOf:'3b079fbd', def:'Feel No Pain 4+ against psychic attacks; attacks against it with Psychic weapons have [HAZARDOUS]', defOf:'3b079fbd', name:'Psychic Dominion', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Faction: Thousand Sons'] },
            when:'Any phase, just after an enemy unit has selected its targets.',
            target:'One **THOUSAND SONS** unit from your army that was selected as the target of one or more of the attacking unit’s attacks.',
            effect:'Until the end of the phase, all attacks made against your unit with Psychic weapons have the **[HAZARDOUS]** ability and all models in your unit have the **Feel No Pain 4+** ability against **Psychic Attacks**.' },
          // mod/def candidate, not active: def:'After a failed save for a PSYKER model: that attack’s Damage becomes 0'
          { id:'destined-by-fate', gist:'Just after a saving throw is failed for your PSYKER model: change the Damage of that attack to 0.', gistOf:'847b2941', def:'after a failed save for a PSYKER model, that attack’s Damage becomes 0', defOf:'847b2941', name:'Destined by Fate', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Faction: Thousand Sons','Psyker'] },
            when:'Any phase, just after a saving throw is failed for a **THOUSAND SONS PSYKER** model from your army. If you are using fast dice rolling, this Stratagem can still be used after rolling multiple saving throws at once.',
            target:'That **PSYKER** model.',
            effect:'Change the Damage characteristic of that attack to 0. If you are using fast dice rolling, select one of those attacks you failed a saving throw for.' },
          // mod/def candidate, not active: mod:{ kind:'all', when:'Egotistical Power on this unit', note:'Psychic weapons: the Kindred Sorcery ability you pick, even one already used' }
          { id:'egotistical-power', gist:'Until the start of your next Command phase, your unit has Imbued Manifestation, Psychic Maelstrom or Wrath of the Immaterium instead of any other Kindred Sorcery ability, even one already selected this battle.', gistOf:'465b9e18', name:'Egotistical Power', cp:1, phases:['command'], turn:'your', needs:{ all:['Faction: Thousand Sons','Psyker'] },
            when:'Your Command phase.',
            target:'One **THOUSAND SONS PSYKER** unit from your army.',
            effect:'Select the Imbued Manifestation, Psychic Maelstrom or Wrath of the Immaterium ability. Until the start of your next Command phase, that ability applies to your unit instead of any other Kindred Sorcery ability, even if you have already selected that ability this battle.' },
          { id:'desecration-of-worlds', gist:'An objective marker you control that your unit is within range of stays under your control until your opponent’s Level of Control over it is greater than yours at the end of a phase.', gistOf:'23a22d1e', name:'Desecration of Worlds', cp:1, phases:['command'], turn:'your', needs:{ all:['Faction: Thousand Sons','Psyker'] },
            when:'Your Command phase.',
            target:'One **THOUSAND SONS PSYKER** unit from your army within range of an objective marker you control.',
            effect:'That objective marker remains under your control until your opponent’s Level of Control over that objective marker is greater than yours at the end of a phase.' },
          // needs: only models with Cabal of Sorcerers take Psychic tests; in this list every one of them is a PSYKER
          { id:'arcane-focus', gist:'Just after your model’s Psychic test with Channelling the Warp, before resolving that Ritual: re-roll all the D6 of that Psychic test (the Channelling the Warp D6 included).', gistOf:'14526c8a', name:'Arcane Focus', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Faction: Thousand Sons'] },
            when:'Your Shooting phase, just after you take a Psychic test for a **THOUSAND SONS** model from your army that Channelled the Warp (before resolving that **Ritual**).',
            target:'That **THOUSAND SONS** model.',
            effect:'Re-roll all of the D6 rolled for that Psychic test (including the additional D6 for Channelling the Warp).' },
          // mod/def candidate, not active: mod:{ kind:'ranged', when:'Devastating Sorcery used this phase', note:'Psychic weapons +9" range; re-roll hit rolls and wound rolls with Psychic weapons' }
          { id:'devastating-sorcery', gist:'Until the end of the phase, your unit’s Psychic weapons have +9" range and can re-roll the hit roll and the wound roll.', gistOf:'abea7dcf', mod:{ kind:'ranged', when:'Psychic weapons, your Shooting phase', note:'+9" range, re-roll hit and wound rolls' }, name:'Devastating Sorcery', cp:2, phases:['shooting'], turn:'your', needs:{ all:['Faction: Thousand Sons','Psyker'] },
            when:'Your Shooting phase.',
            target:'One **THOUSAND SONS PSYKER** unit from your army that has not been selected to shoot this phase.',
            effect:'Until the end of the phase, add 9" to the Range characteristic of Psychic weapons equipped by models in your unit, and each time a model in your unit makes an attack with a Psychic weapon, you can re-roll the **Hit roll** and you can re-roll the **Wound roll**.' }
        ]
      },
      // Ritual of Regeneration: GW's Faction Pack (1.3) prints it in full (p2); its wording, with Wahapedia's bold keywords.
      // (Wahapedia's Mutagenic Magicks EFFECT repeats its WHEN and TARGET before "Select one enemy unit"; the pack's does not.)
      'ritual-of-regeneration': {
        name:'Ritual of Regeneration', dispositions:['Take and Hold'], dp:1,
        // ph/turn: a Ritual is attempted at the start of your Shooting phase (Cabal of Sorcerers)
        // needs: a THOUSAND SONS PSYKER unit (a unit with one PSYKER model is one), excluding MONSTER units
        rule:{ name:'Sorcerous Invigoration', tag:'Once per turn, per unit', ph:['shooting'], turn:'your', needs:{ all:['Faction: Thousand Sons','Psyker'], none:['Monster'] },
          text:'(Once per turn, per unit) When a friendly **THOUSAND SONS PSYKER** unit (excluding **MONSTER** units) successfully manifests a **Ritual**, that unit **heals** D3 wounds.' },
        // pts from Wahapedia (the pack prints none), matching New Recruit: Tzaangor Shaman 65 + Curse of Life 20 = 85
        enhancements:[
          { name:'Eruption of Vitality', pts:35, text:'**INFANTRY**/**MOUNTED THOUSAND SONS PSYKER** model only. (Once per battle, per army) When this model is **destroyed**, at the end of the phase, roll one D6:\n- On a 2+, set up this model on the battlefield, **unengaged** and as close as possible to where it was destroyed. This model is not part of an attached unit and its unit has a **starting strength** of 1. This model has 3 wounds remaining.' },
          { name:'Curse of Life', pts:20, text:'**INFANTRY**/**MOUNTED THOUSAND SONS PSYKER** model only. When this model **heals** as a result of the **Sorcerous Invigoration detachment rule**, you can add 3 to the number of wounds **healed**.' }
        ],
        // phases and turn from the WHEN ("Any phase" = all five, either turn)
        // needs: "INFANTRY/MOUNTED THOUSAND SONS PSYKER unit" is a THOUSAND SONS PSYKER unit that is INFANTRY or MOUNTED
        stratagems:[
          { id:'relentless-rebirth', gist:'When your unit suffers a mortal wound: it has Feel No Pain 5+ against mortal wounds.', gistOf:'24cc8bf8', def:'when it suffers a mortal wound: Feel No Pain 5+ against mortal wounds', defOf:'24cc8bf8', name:'Relentless Rebirth', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Faction: Thousand Sons','Psyker'], any:['Infantry','Mounted'] },
            when:'Any phase, when a friendly **INFANTRY**/**MOUNTED THOUSAND SONS PSYKER** unit suffers a **mortal wound**.',
            target:'That **INFANTRY/MOUNTED THOUSAND SONS PSYKER** unit.',
            effect:'Your unit has **Feel No Pain 5+** against **mortal wounds**.' },
          { id:'mutagenic-magicks', gist:'Your engaged unit: select one enemy unit engaged with it and roll six D6; for each 4+, that enemy unit suffers 1 mortal wound.', gistOf:'83879768', name:'Mutagenic Magicks', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: Thousand Sons','Psyker'] },
            when:'Start of the Fight phase.',
            target:'One friendly **engaged THOUSAND SONS PSYKER** unit.',
            effect:'Select one enemy unit engaged with your unit. Roll six D6:\n- For each 4+, that enemy unit suffers 1 **mortal wound**.' },
          { id:'multitudinous-limbs', gist:'Your unit’s advance or fall back move does not prevent it from being eligible to start an action.', gistOf:'fefae6c7', name:'Multitudinous Limbs', cp:1, phases:['movement'], turn:'your', needs:{ all:['Faction: Thousand Sons','Psyker'], any:['Infantry','Mounted'] },
            when:'Your Movement phase, when a friendly **INFANTRY**/**MOUNTED THOUSAND SONS PSYKER** unit is selected to make an **advance**/**fall back move**.',
            target:'That **INFANTRY/MOUNTED THOUSAND SONS PSYKER** unit.',
            effect:'That move does not prevent your unit from being **eligible to start an action**.' }
        ]
      },
      // Warpmeld Pact: a codex detachment the Faction Pack (1.3) does not print, only Rules Updates (Warpmeld Sacrifice, Bray Lord,
      // Twisted Mirage) and FAQs; Wahapedia wording with those updates (Wahapedia's errata texts are the same)
      'warpmeld-pact': {
        name:'Warpmeld Pact', dispositions:['Purge the Foe'], dp:2,
        // needs: TZEENTCH MUTANT INFANTRY or TZEENTCH MUTANT MOUNTED units (a unit with one such model is one: the rule is about units)
        // ph: wherever a unit is selected to shoot or fight (Fire Overwatch, at the end of the opponent's Movement phase, included)
        // parts: the sacrifice when selected as a target ("When targeted") and when selected to shoot or fight (its attacks); the
        // KEYWORDS paragraph is for TZAANGORS units: its +1 OC is not in New Recruit's OC (statNote)
        rule:{ name:'Warpmeld Sacrifice', ph:['movement','shooting','fight'], turn:'either', needs:{ all:['Tzeentch','Mutant'], any:['Infantry','Mounted'] },
          text:'Each time an enemy unit is selected to shoot or fight and one or more **TZEENTCH MUTANT INFANTRY** or **TZEENTCH MUTANT MOUNTED** units from your army are selected as a target of one or more of those attacks, each of those **TZEENTCH MUTANT** units can make a Warpmeld Sacrifice. If it does, until the end of the phase, each time an attack targets that unit, subtract 1 from the Wound roll. At the end of the phase, that **TZEENTCH MUTANT** unit suffers D3 mortal wounds.\nEach time a **TZEENTCH MUTANT INFANTRY** or **TZEENTCH MUTANT MOUNTED** unit from your army is selected to shoot or fight, before selecting its targets, that unit can make a Warpmeld Sacrifice. If it does, until the end of the phase, each time a model in that unit makes an attack, add 1 to the Wound roll. At the end of the phase, that **TZEENTCH MUTANT** unit suffers D3 mortal wounds.\nKEYWORDS\n**TZAANGORS** units from your army have the **BATTLELINE** keyword, and while such a unit is not **Battle-shocked**, add 1 to the Objective Control characteristic of **TZAANGOR** models in that unit.',
          parts:[
            { name:'Warpmeld Sacrifice (selected as a target)', needs:{ all:['Tzeentch','Mutant'], any:['Infantry','Mounted'] }, def:'Warpmeld Sacrifice (D3 mortal wounds to it at the end of the phase): -1 to wound rolls against it until the end of the phase', defOf:'e924f440' },
            { name:'Warpmeld Sacrifice (selected to shoot or fight)', needs:{ all:['Tzeentch','Mutant'], any:['Infantry','Mounted'] }, mod:{ kind:'all', when:'Warpmeld Sacrifice made when selected to shoot or fight (D3 mortal wounds to it at the end of the phase)', note:'+1 to wound rolls' } },
            { name:'Keywords', needs:{ all:['Tzaangors'] }, statNote:{ text:'OC +1 for each TZAANGOR model unless Battle-shocked, not in the OC above' } }
          ] },
        // pts from Wahapedia, matching New Recruit: Tzaangor Shaman 65 + Diamond of Distortion 20 = 85, + Flowing Flesh 10 = 75
        enhancements:[
          { name:'Warpmeld Dagger', pts:10, text:'**TZAANGOR SHAMAN** model only. Each time the bearer attempts a **Ritual**, just before determining the Psychic test result, the bearer can use this Enhancement. If it does, the bearer suffers D3 **mortal wounds**; if it is not destroyed as a result, add 1 to that Psychic test result for each of those mortal wounds suffered.' },
          { name:'Diamond of Distortion', pts:20, text:'**TZAANGOR SHAMAN** model only. While the bearer is leading a unit, each time an attack targets that unit, subtract 1 from the **Hit roll**.' },
          // the Faction Pack's Rules Update (Wahapedia's errata is the same; its main text has a stray "LEADER: TZAANGORS" line)
          { name:'Bray Lord', pts:15, text:'**SORCERER** or **INFERNAL MASTER** model only. The bearer has the **Scouts 6"** ability.' },
          { name:'Flowing Flesh', pts:10, text:'**TZAANGOR SHAMAN** model only. The bearer has the **Feel No Pain 4+** ability and a Wounds characteristic of 5.' }
        ],
        // phases and turn from the WHEN
        stratagems:[
          // needs: a THOUSAND SONS CHARACTER model (excluding MONSTERS): the unit it is in
          { id:'gift-of-change', gist:'Your CHARACTER model just destroyed: at the end of the phase, add a TZEENTCH CHAOS SPAWN unit of one model to your army, set up as close as possible to where it was destroyed and unengaged (once per battle round).', gistOf:'9b72bbb6', name:'Gift of Change', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Faction: Thousand Sons','Character'], none:['Monster'] },
            when:'Any phase.',
            target:'One **THOUSAND SONS CHARACTER** model from your army (excluding **MONSTERS**) that was just destroyed. You can use this Stratagem on that model even though it was just destroyed.',
            effect:'At the end of the phase, add one **TZEENTCH CHAOS SPAWN** unit containing one model to your army, and set it up as close as possible to where your model was destroyed and not within **Engagement Range** of one or more enemy units.',
            restrictions:'You can only use this Stratagem once per battle round.' },
          { id:'warped-vicissitude', gist:'Just after an enemy unit selects your unit as a target: until the end of the phase, your unit’s models have a 4+ invulnerable save.', gistOf:'0793ef00', def:'their Shooting phase or the Fight phase: 4+ invulnerable save (until the end of the phase)', defOf:'0793ef00', name:'Warped Vicissitude', cp:1, phases:['shooting','fight'], turn:'either', turns:{ shooting:'opp' }, needs:{ all:['Tzaangors'] },
            when:'Your opponent’s Shooting phase or the Fight phase, just after an enemy unit has selected its targets.',
            target:'One **TZAANGORS** unit from your army that was selected as the target of one or more of the attacking unit’s attacks.',
            effect:'Until the end of the phase, models in your unit have a 4+ invulnerable save.' },
          { id:'deranged-ferocity', gist:'Until the end of the phase, your unit’s models pile in and consolidate up to 6", and models within 3" of enemy models are eligible to fight (targeting an enemy unit within 3" of them and engaged with their unit).', gistOf:'68d43cfe', name:'Deranged Ferocity', cp:1, phases:['fight'], turn:'either', needs:{ all:['Tzeentch','Mutant'] },
            when:'Fight phase, just after a **TZEENTCH MUTANT** unit from your army is selected to fight.',
            target:'That **TZEENTCH MUTANT** unit.',
            effect:'Until the end of the phase, each time a model in your unit makes a Pile-in or **Consolidation move**, it can move up to 6" instead of up to 3", and when determining which models in it are eligible to fight, any models in it that are within 3" of one or more enemy models are eligible to fight. When resolving those attacks, such models can target one of those enemy units that is within 3" of them and within **Engagement Range** of their unit.' },
          // needs: its two targets, a THOUSAND SONS PSYKER model and a TZAANGORS unit: shown on the units of either
          { id:'blessed-transmutations', gist:'Return up to D3+1 destroyed models (excluding CHARACTERS) to a TZAANGORS unit below its Starting Strength within 12" of your PSYKER model.', gistOf:'42a95792', name:'Blessed Transmutations', cp:1, phases:['command'], turn:'your', needs:{ all:['Faction: Thousand Sons'], any:['Psyker','Tzaangors'] },
            when:'Your Command phase.',
            target:'One **THOUSAND SONS PSYKER** model from your army, and one friendly **TZAANGORS** unit that is below its Starting Strength and within 12" of that **PSYKER** model.',
            effect:'Return up to D3+1 destroyed models (excluding **CHARACTERS**) to your **TZAANGORS** unit.' },
          { id:'touched-by-tzeentch', gist:'Until the end of the turn, your unit is eligible to shoot or declare a charge in a turn in which it Advanced.', gistOf:'dc3388e9', name:'Touched by Tzeentch', cp:1, phases:['movement'], turn:'your', needs:{ all:['Tzeentch','Mutant'] },
            note:'FAQ (Faction Pack 1.3): When using the Touched by Tzeentch Stratagem in the Warpmeld Pact Detachment, do I have to declare if my unit will shoot or charge after Advancing as soon as I use the Stratagem? No, you may decide later in the turn.',
            when:'Start of your Movement phase.',
            target:'One **TZEENTCH MUTANT** unit from your army.',
            effect:'Until the end of the turn, your unit is eligible to shoot or declare a charge in a turn in which it Advanced.' },
          // effect: the Faction Pack's Rules Update (6" and 8"), as Wahapedia prints it
          { id:'twisted-mirage', gist:'Your unit arriving from Strategic Reserves can be set up anywhere on the battlefield more than 6" horizontally away from all enemy units (more than 8" for a MONSTER unit); until the end of the turn, it is not eligible to declare a charge.', gistOf:'48d6dbf1', name:'Twisted Mirage', cp:1, phases:['movement'], turn:'your', needs:{ all:['Tzeentch','Mutant'] },
            note:'FAQ (Faction Pack 1.3): When going second, can a Tzaangor unit that started the game on the battlefield and was placed into Strategic Reserves by its Ambushing Hunters ability then arrive during my first turn using the Twisted Mirage Stratagem? No.',
            when:'Reinforcements step of your Movement phase.',
            target:'One **TZEENTCH MUTANT** unit from your army that is arriving from **Strategic Reserves** this phase.',
            effect:'Your unit can be set up anywhere on the battlefield that is more than 6" horizontally away from all enemy units, or anywhere on the battlefield that is more than 8" horizontally away from all enemy units if it is a **MONSTER** unit. In either case, until the end of the turn, it is not eligible to declare a charge.' }
        ]
      }
    }
  },
  'tyranids': {
    name: 'Tyranids',
    // words players use for a rule that has another name
    aliases: [[/^synapse range$/i, 'Synapse']],
    armyRules: [
      // Wahapedia wording (the errata "Change to" text has the same words, without the bold)
      { name:'Synapse',
        text:'If your Army Faction is **TYRANIDS**, while a **TYRANIDS** unit from your army is within 6" of one or more friendly **SYNAPSE** models, that **TYRANIDS** unit is said to be within Synapse Range of that model and of your army. While a **TYRANIDS** unit from your army is within Synapse Range of your army:\n- Each time that unit takes a **Battle-shock test**, take that test on 3D6 instead of 2D6.\n- Each time a model in that unit makes a melee attack, add 1 to the Strength characteristic of that attack.' },
      // Wahapedia wording (the errata "Change to" text has the same words, without the bold)
      { name:'Shadow in the Warp', tag:'Once per battle', ph:['command'], turn:'either',
        note:'Wahapedia FAQ: “Can units targeted by the Shadow in the Warp army rule use the Insane Bravery Stratagem?” “No. Insane Bravery can only be used in your Command phase.”',
        text:'If your Army Faction is **TYRANIDS**, once per battle, in either player’s Command phase, if one or more units from your army with this ability are on the battlefield, you can unleash the Shadow in the Warp. When you do, each enemy unit on the battlefield must take a **Battle-shock test**. Each time an enemy unit takes such a Battle-shock test, if it is within 6" of one or more **SYNAPSE** units from your army, subtract 1 from that test.' }
    ],
    detachments: {
      // Wahapedia still prints this detachment in its codex wording (Battle-shock test, Engagement Range,
      // Normal/Advance/Fall Back move), not in the 11th-edition terms of the Talons below.
      'crusher-stampede': {
        name:'Crusher Stampede', dispositions:['Purge the Foe'], dp:2,
        // Wahapedia wording (the errata "Change to" text has the same words, without the bold)
        rule:{ name:'Enraged Behemoths', ph:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Faction: Tyranids','Monster'] },
          mod:{ kind:'all', when:'Below Starting Strength', note:'+1 to hit rolls; also +1 to wound rolls if Below Half-strength',
            pick:[{ name:'Below Starting Strength', note:'+1 to hit rolls' }, { name:'Below Half-strength', note:'+1 to hit rolls, +1 to wound rolls' }],
            single:{ when:'Lost any wounds (below Starting Strength)', note:'+1 to hit rolls; also +1 to wound rolls at {half} or fewer wounds left' } },
          statNote:{ text:'OC {OC+2} while at Starting Strength, unless Battle-shocked', single:'OC {OC+2} while it has lost no wounds, unless Battle-shocked' },
          text:'Each time a **TYRANIDS MONSTER** model from your army makes an attack, add 1 to the **Hit roll** if that model’s unit is below its Starting Strength, and add 1 to the **Wound roll** as well if that model’s unit is **Below Half-strength**. In addition, while a **TYRANIDS MONSTER** unit from your army (excluding **Battle-shocked** units) is at its Starting Strength, add 2 to the Objective Control characteristic of models in that unit.' },
        // pts from Wahapedia; Monstrous Nemesis 25 matches BSData (Hive Tyrant 195 + 25 = the 220 New Recruit prints)
        enhancements:[
          { name:'Ominous Presence', pts:15, text:'**TYRANIDS MONSTER** model only. Add 3 to the bearer’s Objective Control characteristic.' },
          { name:'Enraged Reserves', pts:20, text:'**TYRANIDS MONSTER** model only. If the bearer is destroyed by a melee attack, if it has not fought this phase, roll one D6: on a 3+, do not remove it from play. It can fight after the attacking model’s unit has finished making its attacks, and is then removed from play.' },
          { name:'Null Nodules', pts:10, text:'**TYRANIDS MONSTER** model only. Once per battle, when a **Psychic Attack** is allocated to the bearer, it can use this ability. If it does, until the end of the phase, the bearer has the **Feel No Pain 5+** ability against Psychic Attacks.' },
          { name:'Monstrous Nemesis', pts:25, text:'**TYRANIDS MONSTER** model only. Each time the bearer makes a melee attack that targets a **MONSTER** or **VEHICLE** unit, add 1 to the **Wound roll**.' }
        ],
        stratagems:[
          { id:'corrosive-viscera', gist:'Your MONSTER model (one that cannot FLY) just destroyed: its Deadly Demise mortal wounds are inflicted automatically (no D6 roll).', gistOf:'90c54863', name:'Corrosive Viscera', cp:1, phases:['shooting','fight'], turn:'either', turns:{ shooting:'opp' }, needs:{ all:['Faction: Tyranids','Monster'], none:['Fly'] },
            when:'Your opponent’s Shooting phase or the Fight phase, just after a **TYRANIDS MONSTER** model from your army with the **Deadly Demise** ability that cannot **FLY** is destroyed.',
            target:'That **TYRANIDS MONSTER** model. You can use this Stratagem on that model even though it was just destroyed.',
            effect:'Do not roll one D6 to determine whether **mortal wounds** are inflicted by your model’s Deadly Demise ability. Instead, mortal wounds are automatically inflicted.' },
          { id:'rampaging-monstrosities', gist:'Until the end of the phase, your unit’s attacks can re-roll the hit roll.', gistOf:'ca1851c1', mod:{ kind:'melee', when:'Fight phase', note:'re-roll hit rolls' }, name:'Rampaging Monstrosities', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: Tyranids','Monster'] },
            when:'Fight phase.',
            target:'One **TYRANIDS MONSTER** unit from your army that has not been selected to fight this phase.',
            effect:'Until the end of the phase, each time a model in your unit makes an attack, you can re-roll the **Hit roll**.' },
          { id:'savage-roar', gist:'An enemy unit has selected your unit as a target: it takes a Battle-shock test and has -1 to hit your unit until the end of the phase; also -1 to wound if it failed the test.', gistOf:'4a887823',
            defPick:[{ name:'Test passed', calc:{ hitMinus:1 } }, { name:'Test failed', calc:{ hitMinus:1, woundMinus:1 } }], name:'Savage Roar', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: Tyranids','Monster'] },
            when:'Fight phase, just after an enemy unit has selected its targets.',
            target:'One **TYRANIDS MONSTER** unit from your army that was selected as the target of one or more of the attacking unit’s attacks.',
            effect:'That enemy unit must take a **Battle-shock test** and, until the end of the phase, each time a model in that enemy unit makes an attack that targets your unit, subtract 1 from the **Hit roll**. If that Battle-shock test was failed, subtract 1 from the **Wound roll** as well.' },
          // Wahapedia wording (the errata "Change to" text has the same words, without the bold)
          { id:'untrammelled-ferocity', gist:'Until the end of the phase, your unit’s Normal, Advance and Fall Back moves can pass through models (excluding TITANIC) and terrain up to 4" tall, and through Engagement Range without ending there; taller terrain too, but then, after your unit has moved, roll one D6: on a 1, your unit is Battle-shocked.', gistOf:'a32594dd', name:'Untrammelled Ferocity', cp:1, phases:['movement'], turn:'your', needs:{ all:['Faction: Tyranids','Monster'] },
            when:'Your Movement phase.',
            target:'One **TYRANIDS MONSTER** unit from your army that has not been selected to move this phase.',
            effect:'Until the end of the phase, each time a model in your unit makes a **Normal**, **Advance** or **Fall Back move**, it can move through models (excluding **TITANIC** models) and sections of **terrain features** that are 4" or less in height. When doing so:\n- It can move within **Engagement Range** of enemy models, but cannot end that move within Engagement Range of them.\n- It can also move through sections of terrain features that are more than 4" in height, but if it does, after its unit has moved, roll one D6: on a 1, your unit is **Battle-shocked**.' },
          { id:'swarm-guided-salvoes', gist:'Until the end of the phase, your unit’s ranged weapons have [IGNORES COVER], and its attacks can ignore any or all modifiers to BS and to the hit roll.', gistOf:'fc165280', mod:{ kind:'ranged', when:'Your Shooting phase', note:'[IGNORES COVER]; can ignore any or all modifiers to BS and any or all modifiers to the hit roll' }, name:'Swarm-guided Salvoes', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Faction: Tyranids','Monster'] },
            when:'Your Shooting phase.',
            target:'One **TYRANIDS MONSTER** unit from your army that has not been selected to shoot this phase.',
            effect:'Until the end of the phase, ranged weapons equipped by models in your unit have the **[IGNORES COVER]** ability, and until the end of the phase each time a model in your unit makes an attack, you can ignore any or all modifiers to that model’s Ballistic Skill characteristic and any or all modifiers to the **Hit roll**.' },
          { id:'massive-impact', gist:'Your model has ended a Charge move: select one enemy unit within Engagement Range of it and roll six D6: 1 mortal wound for each 4+.', gistOf:'53f358da', name:'Massive Impact', cp:1, phases:['charge'], turn:'your', needs:{ all:['Faction: Tyranids','Monster'] },
            when:'Your Charge phase, just after a **TYRANIDS MONSTER** model from your army ends a **Charge move**.',
            target:'That **TYRANIDS MONSTER** model.',
            effect:'Select one enemy unit within **Engagement Range** of your model and roll six D6: for each 4+, that enemy unit suffers 1 **mortal wound**.' }
        ]
      },
      'talons-of-the-norn-queen': {
        name:'Talons of the Norn Queen', dispositions:['Take and Hold'], dp:1,
        // Protean Purpose is also on the Norn units' cards (with ph), so the rule itself has no ph
        rule:{ name:'Higher Imperatives', needs:{ any:['Norn Emissary','Norn Assimilator'] },
          text:'Friendly **NORN EMISSARY/NORN ASSIMILATOR** units have the following ability:\n**Protean Purpose:** (Once per battle, per unit) In your Command phase, you can use this ability. If you do, this unit can make a selection for its **Singular Purpose** ability (this replaces the previous selection).' },
        // pts from Wahapedia, matching BSData (Norn Emissary 250 + 20 = 270; Norn Assimilator 250 + 30 = 280).
        // Wahapedia tags both as Upgrades: they can go on non-CHARACTER units and an army can include up to
        // three of the same one (core rules), so both Assimilators can take Synaptoprescience.
        enhancements:[
          { name:'Destabilising Predation', pts:20, text:'**NORN EMISSARY** unit only. This unit’s ranged attacks have **[ANTI-CHARACTER 2+]**.' },
          { name:'Synaptoprescience', pts:30, text:'**NORN ASSIMILATOR** unit only. This unit has 4+ **InSv**.' }
        ],
        stratagems:[
          { id:'catalytic-biofortification', gist:'Your unit has Feel No Pain 4+ against mortal wounds.', gistOf:'7aada345', def:'Feel No Pain 4+ against mortal wounds', defOf:'7aada345', name:'Catalytic Biofortification', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Norn Assimilator'] },
            when:'Any phase, when a friendly **NORN ASSIMILATOR** unit suffers a **mortal wound**.',
            target:'That **NORN ASSIMILATOR** unit.',
            effect:'Your unit has **Feel No Pain 4+** against **mortal wounds**.' },
          { id:'lesser-prey', gist:'Your unit’s melee attacks have +2 S.', gistOf:'bb361063', mod:{ kind:'melee', when:'When selected to fight', note:'+2 S' }, name:'Lesser Prey', cp:1, phases:['fight'], turn:'either', needs:{ any:['Norn Assimilator','Norn Emissary'] },
            when:'Fight phase, when a friendly **NORN ASSIMILATOR/NORN EMISSARY** unit is **selected to fight**.',
            target:'That **NORN ASSIMILATOR/NORN EMISSARY** unit.',
            effect:'Your unit’s melee attacks have +2 **S**.' },
          { id:'tanglestrike-rounds', gist:'After your unit has shot: one enemy unit hit by those attacks is tethered (-2" M) until the start of your next Command phase.', gistOf:'c6193054', name:'Tanglestrike Rounds', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Norn Assimilator'] },
            when:'Your Shooting phase, when a friendly **NORN ASSIMILATOR** unit has shot.',
            target:'That **NORN ASSIMILATOR** unit.',
            effect:'Select one enemy unit hit by those attacks. That enemy unit is **tethered** until the start of your next Command phase:\n- While a unit is **tethered**, that unit has -2" **M**.' }
        ]
      }
    }
  },
  'adeptus-mechanicus': {
    name: 'Adeptus Mechanicus',
    // words players use for a rule that has another name: New Recruit (BSData) prints the Cohort Cybernetica rule as
    // "Cyber Psalm-Programming" (its glossary in purge-goes-the-foe, p11); GW's Faction Pack spells it "Cyber-psalm Programming"
    aliases: [[/^cyber psalm-programming$/i, 'Cyber-psalm Programming']],
    // Wahapedia, Adeptus Mechanicus, Army Rules: Doctrina Imperatives is its only army rule (Crusade and Boarding Actions rules left out).
    // The two Imperatives are the Rules Updates' wording in GW's Faction Pack v1.4 (legal from 14 Oct 2026), PDF p17,
    // the same words as Wahapedia's main text; the table is the two Imperatives (name, then their bullet points).
    armyRules: [
      { name:'Doctrina Imperatives', at:'Start of the battle round', ph:['command'], turn:'either',
        text:'At the start of the battle round, you can select one of the Doctrina Imperatives below. Until the end of the battle round, that Doctrina Imperative is active for your army, and all units from your army that have the Doctrina Imperatives ability gain the relevant abilities shown below.',
        table:[
          ['Protector Imperative', '- Ranged weapons equipped by models in this unit have the **[HEAVY]** ability.\n- Improve the Ballistic Skill characteristic of ranged weapons equipped by models in this unit by 1.\n- Each time a melee attack targets this unit, if this unit has the **BATTLELINE** keyword and/or it is within 6" of one or more friendly **ADEPTUS MECHANICUS BATTLELINE** units, subtract 1 from the **Hit roll**.'],
          ['Conqueror Imperative', '- Ranged weapons equipped by models in this unit have the **[ASSAULT]** ability.\n- Improve the Weapon Skill characteristic of melee weapons equipped by models in this unit by 1.\n- Each time a model in this unit makes an attack, if this unit has the **BATTLELINE** keyword and/or it is within 6" of one or more friendly **ADEPTUS MECHANICUS BATTLELINE** units, improve the Armour Penetration characteristic of that attack by 1.']
        ],
        // the Damage tab's reading (read by it alone, never shown on the datasheets): calcMods for the attacks of a unit with this ability.
        // One pick, the Imperative active (Protector, Conqueror, or Both where a rule of the list makes
        // both active for that unit: both, else Both is counted by you). The BATTLELINE / within 6" condition is a fact of the table
        // (part.cond battleline6: said for the unit; a BATTLELINE unit meets it by itself). [ASSAULT] changes no numbers here.
        // The Faction Pack's FAQ (Auto-divinatory Targeting): its BS 3+ is set first, then the Protector Imperative improves it (skill)
        calcMods:[
          { kind:'ranged', lasts:'round', when:'The Imperative active for your army this battle round', note:'Protector: [HEAVY], BS improved by 1 · Conqueror: [ASSAULT] · +1 AP with Conqueror if this unit is BATTLELINE or within 6" of a friendly ADEPTUS MECHANICUS BATTLELINE unit',
            pick:[{ name:'Protector', note:'[HEAVY], BS improved by 1', calc:{ heavy:true, skill:1 } }, { name:'Conqueror', note:'[ASSAULT] (no change here)', calc:{} },
              { name:'Both', both:true, note:'[HEAVY], BS improved by 1, [ASSAULT]', calc:{ heavy:true, skill:1 } }],
            part:{ cond:'battleline6', picks:['Conqueror', 'Both'], calc:{ ap:1 }, note:'+1 AP' } },
          { kind:'melee', lasts:'round', when:'The Imperative active for your army this battle round', note:'Conqueror: WS improved by 1 · +1 AP with Conqueror if this unit is BATTLELINE or within 6" of a friendly ADEPTUS MECHANICUS BATTLELINE unit · Protector: nothing for its melee attacks',
            pick:[{ name:'Protector', note:'nothing for its melee attacks', calc:{} }, { name:'Conqueror', note:'WS improved by 1', calc:{ skill:1 } },
              { name:'Both', both:true, note:'WS improved by 1', calc:{ skill:1 } }],
            part:{ cond:'battleline6', picks:['Conqueror', 'Both'], calc:{ ap:1 }, note:'+1 AP' } }
        ],
        // what makes both Imperatives active for a unit: Omnicogitator (the bearer's unit), Transcendent Cogitation (its target), and
        // Thulia Ghuld's Icon of War, The Fires of Mars (a SKITARII or THULIA GHULD unit within 6" of her)
        both:[{ enhancement:'Omnicogitator' }, { strat:'transcendent-cogitation' }, { ability:'Icon of War', part:'The Fires of Mars', of:'Thulia Ghuld', needs:{ any:['Skitarii','Thulia Ghuld'] } }] }
    ],
    detachments: {
      'cohort-cybernetica': {
        name:'Cohort Cybernetica', dispositions:['Take and Hold'], dp:1,
        // Wahapedia wording (codex detachment; GW's Faction Pack v1.4 does not print it). The rule is the Rules Updates' wording
        // in the Faction Pack v1.4, PDF p17 ("Cyber-psalm Programming", the pack's spelling), the same words as Wahapedia's main text.
        // No ph: its words name no phase or moment. New Recruit's Move values already include its +2" (BSData: Kastelan Robot
        // and Cybernetica Datasmith M 6", New Recruit 8"); its +1 OC is not in them.
        // statNote: the +1 OC under the unit's stats, as New Recruit's OC does not include it (one line for every profile:
        // no {OC+1} value, a unit can have two OC values)
        rule:{ name:'Cyber-psalm Programming', needs:{ all:['Legio Cybernetica'] },
          statNote:{ text:'OC +1 for each model unless Battle-shocked, not in the OC above' },
          text:'Add 2" to the Move characteristic of models in **LEGIO CYBERNETICA** units from your army. In addition, unless that unit is **Battle-shocked**, add 1 to the Objective Control characteristic of models in that unit.' },
        // pts from Wahapedia, matching BSData
        enhancements:[
          { name:'Necromechanic', pts:20, text:'**TECH-PRIEST** model only. Once per battle round, when a saving throw made for a friendly **LEGIO CYBERNETICA** or **ADEPTUS MECHANICUS VEHICLE** model within 12" of the bearer is failed, the bearer can use this Enhancement. If they do, change the Damage characteristic of that attack to 0.' },
          { name:'Lord of Machines', pts:15, text:'**TECH-PRIEST** model only. Once per turn, at the start of your opponent’s Shooting phase, select one enemy VEHICLE unit within 12" of and visible to the bearer. That unit must take a **Leadership test**: if that test is passed, until the end of the phase, each time a model in that unit makes an attack, subtract 1 from the **Hit roll**; if that test is failed, that unit is not eligible to shoot this phase.' },
          { name:'Emotionless Clarity', pts:10, text:'**TECH-PRIEST** model only. Once per turn, when a friendly **LEGIO CYBERNETICA** or **ADEPTUS MECHANICUS VEHICLE** model with the **Deadly Demise** ability that is within 12" of the bearer is destroyed, the bearer can use this Enhancement. If it does, do not roll to determine whether any **mortal wounds** are inflicted as a result of that model’s Deadly Demise ability. Instead, mortal wounds are automatically inflicted.' },
          { name:'Arch-negator', pts:5, text:'**TECH-PRIEST** model only. Ranged weapons equipped by the bearer have the **[ANTI-VEHICLE 4+]** ability.' }
        ],
        // needs: "LEGIO CYBERNETICA or ADEPTUS MECHANICUS VEHICLE" is written as an ADEPTUS MECHANICUS unit that is
        // LEGIO CYBERNETICA or VEHICLE (every LEGIO CYBERNETICA unit is an ADEPTUS MECHANICUS unit)
        stratagems:[
          { id:'motive-imperative', gist:'Until the start of your next Command phase, your unit has +3" Move and +1 to Advance and Charge rolls.', gistOf:'74c9edce', name:'Motive Imperative', cp:1, phases:['command'], turn:'your', needs:{ all:['Faction: Adeptus Mechanicus','Vehicle'] },
            when:'Your Command phase.',
            target:'One **ADEPTUS MECHANICUS VEHICLE** unit from your army.',
            effect:'Until the start of your next Command phase, add 3" to the Move characteristic of models in your unit and add 1 to **Advance** and **Charge rolls** made for it.' },
          { id:'auto-divinatory-targeting', gist:'Until the start of your next Command phase, your unit’s ranged weapons have BS 3+ and [IGNORES COVER], but can only target units within range of the selected objective marker.', gistOf:'e0edfb73', name:'Auto-divinatory Targeting', cp:1, phases:['command'], turn:'your', needs:{ all:['Faction: Adeptus Mechanicus'], any:['Legio Cybernetica','Vehicle'] },
            mod:{ kind:'ranged', lasts:'round', when:'Your Command phase, until the start of your next Command phase', note:'BS 3+, [IGNORES COVER]; can only target units within range of the selected objective marker', calc:{ set:{ BS:'3+' }, ignoresCover:true } },
            note:'FAQ (Faction Pack 1.4): “If I target a unit with the Auto-divinatory Targeting Stratagem while the Protector Imperative is active for my army, in what order are the Ballistic Skill modifiers applied?” “The Ballistic Skill characteristic of ranged weapons equipped by models in that unit is first changed to 3+ by the Stratagem, then improved by 1 by the Protector Imperative, for a final result of 2+ (assuming no other modifiers apply).”',
            when:'Your Command phase.',
            target:'One **LEGIO CYBERNETICA** or **ADEPTUS MECHANICUS VEHICLE** unit from your army, and one objective marker.',
            effect:'Until the start of your next Command phase, ranged weapons equipped by models in your unit have a Ballistic Skill characteristic of 3+ and the **[IGNORES COVER]** ability, but they can only target units within range of the selected objective marker.' },
          { id:'machine-spirit-resurgent', gist:'Your unit, if below its Starting Strength: until the start of your next Command phase, its attacks can re-roll the hit roll, and the wound roll as well if it is Below Half-strength.', gistOf:'da102dc5', name:'Machine Spirit Resurgent', cp:1, phases:['command'], turn:'your', needs:{ all:['Faction: Adeptus Mechanicus'], any:['Legio Cybernetica','Vehicle'] },
            mod:{ kind:'all', lasts:'round', when:'Your Command phase, below its Starting Strength; until the start of your next Command phase', note:'can re-roll hit rolls (and wound rolls if Below Half-strength)',
              pick:[{ name:'Below Starting Strength', note:'re-roll hit rolls' }, { name:'Below Half-strength', note:'re-roll hit rolls and wound rolls' }] },
            when:'Your Command phase.',
            target:'One **LEGIO CYBERNETICA** or **ADEPTUS MECHANICUS VEHICLE** unit from your army that is below its Starting Strength.',
            effect:'Until the start of your next Command phase, each time a model in your unit makes an attack, you can re-roll the **Hit roll**. If your unit is **Below Half-strength**, you can re-roll the **Wound roll** as well.' },
          { id:'machine-superiority', gist:'Until the end of the turn, your unit is eligible to shoot after Falling Back, and you can ignore any or all modifiers to its characteristics and to its rolls and tests (not saving throws).', gistOf:'530feb04', name:'Machine Superiority', cp:1, phases:['command'], turn:'your', needs:{ all:['Faction: Adeptus Mechanicus'], any:['Legio Cybernetica','Vehicle'] },
            mod:{ kind:'all', when:'Your Command phase, until the end of the turn', note:'can ignore any or all modifiers to its characteristics and to any roll or test made for it (not saving throws)' },
            when:'Your Command phase.',
            target:'One **LEGIO CYBERNETICA** or **ADEPTUS MECHANICUS VEHICLE** unit from your army.',
            effect:'Until the end of the turn, your unit is eligible to shoot in a turn in which it Fell Back and you can ignore any or all modifiers to its characteristics and/or to any roll or test made for it (excluding modifiers to saving throws).' },
          { id:'transcendent-cogitation', gist:'Until the start of your next Command phase, the Conqueror and Protector Imperatives are both active for your unit.', gistOf:'49a3f45f', name:'Transcendent Cogitation', cp:1, phases:['command'], turn:'your', needs:{ all:['Faction: Adeptus Mechanicus'], any:['Legio Cybernetica','Vehicle'] },
            when:'Your Command phase.',
            target:'One **LEGIO CYBERNETICA** or **ADEPTUS MECHANICUS VEHICLE** unit from your army.',
            effect:'Until the start of your next Command phase, the Conqueror Imperative and Protector Imperative are both active for your unit.' },
          { id:'benevolence-of-the-omnissiah', gist:'Until the start of your next Command phase, your unit has Feel No Pain 6+ (5+ against mortal wounds).', gistOf:'70b07544', def:'Feel No Pain 6+ (5+ against mortal wounds), until the start of your next Command phase', defOf:'70b07544', name:'Benevolence of the Omnissiah', cp:1, phases:['command'], turn:'your', needs:{ all:['Faction: Adeptus Mechanicus'], any:['Legio Cybernetica','Vehicle'] },
            when:'Your Command phase.',
            target:'One **LEGIO CYBERNETICA** or **ADEPTUS MECHANICUS VEHICLE** unit from your army.',
            effect:'Until the start of your next Command phase, models in your unit have the **Feel No Pain 6+** ability, which is improved to Feel No Pain 5+ against **mortal wounds**.' }
        ]
      },
      'eradication-cohort': {
        name:'Eradication Cohort', dispositions:['Purge the Foe'], dp:2,
        // rule, enhancements and stratagems: GW's Faction Pack v1.4 (legal from 14 Oct 2026), PDF pp5-6, which prints this
        // detachment in full (the same words as Wahapedia), with Wahapedia's markup; pts from Wahapedia, matching BSData.
        // Belicosa-class: the pack prints the name in capitals; "-class" as BSData and New Recruit spell it.
        // No ph on the rule: its words name no phase or moment.
        rule:{ name:'Murderous Imperative', needs:{ all:['Skitarii'] },
          // follow: the Damage tab takes the Imperative from the Doctrina Imperatives pick (no pick of its own, so it is never taken for
          // the Imperative itself), ticked with it
          mod:{ kind:'all', when:'Protector or Conqueror Imperative active for this unit', note:'Protector: re-roll hit rolls of 1 · Conqueror: re-roll wound rolls of 1', follow:'Doctrina Imperatives',
            pick:[{ name:'Protector', note:'re-roll hit rolls of 1' }, { name:'Conqueror', note:'re-roll wound rolls of 1' }, { name:'Both', note:'re-roll hit rolls of 1 and wound rolls of 1' }] },
          text:'Each time a model in a **SKITARII** unit from your army makes an attack:\n- If the Protector Imperative is active for that unit, re-roll a **Hit roll** of 1.\n- If the Conqueror Imperative is active for that unit, re-roll a **Wound roll** of 1.' },
        enhancements:[
          { name:'Omnicogitator', pts:25, text:'**SKITARII MARSHAL** model only. The Conqueror Imperative and Protector Imperative are both active for the bearer’s unit.' },
          { name:'Martial Signatum Amplificator', pts:15, text:'**TECH-PRIEST** model only. Models in the bearer’s unit have the **SKITARII** keyword.' },
          { name:'Belicosa-class Capacitor Vanes', pts:25, text:'**ADEPTUS MECHANICUS** model only. Add 6" to the Range characteristic of ranged weapons equipped by models in the bearer’s unit, and add 1 to the Strength characteristic of those weapons.' },
          { name:'Omnissiah’s Fury', pts:10, text:'**SKITARII MARSHAL** model only. Add 2 to the Attacks characteristic of melee weapons equipped by the bearer, and improve the Armour Penetration and Damage characteristics of those weapons by 1.' }
        ],
        stratagems:[
          { id:'servo-driven-charge', gist:'Until the end of the phase, your unit’s melee weapons have [LANCE].', gistOf:'565fbe33', name:'Servo-driven Charge', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: Adeptus Mechanicus'] },
            mod:{ kind:'melee', when:'Fight phase', note:'[LANCE]' },
            when:'Fight phase.',
            target:'One **ADEPTUS MECHANICUS** unit from your army that has not been selected to fight this phase.',
            effect:'Until the end of the phase, melee weapons equipped by models in your unit have the **[LANCE]** ability.' },
          { id:'unrelenting-aggression', gist:'Until the end of the turn, your unit is eligible to shoot after Falling Back (a SKITARII unit: to shoot and declare a charge).', gistOf:'f22b603c', name:'Unrelenting Aggression', cp:1, phases:['movement'], turn:'your', needs:{ all:['Faction: Adeptus Mechanicus'] },
            when:'Your Movement phase, just after an **ADEPTUS MECHANICUS** unit from your army Falls Back.',
            target:'That **ADEPTUS MECHANICUS** unit.',
            effect:'Until the end of the turn, your unit is eligible to shoot in a turn in which it Fell Back. If your unit has the **SKITARII** keyword, your unit is eligible to shoot and declare a charge in a turn in which it Fell Back instead.' },
          { id:'unshackled-wrath', gist:'Until the end of the phase, your unit’s ranged weapons have [SUSTAINED HITS 1] or [LETHAL HITS], or all of [SUSTAINED HITS 1], [LETHAL HITS] and [HAZARDOUS].', gistOf:'81de5445', name:'Unshackled Wrath', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Skitarii'] },
            mod:{ kind:'ranged', when:'Your Shooting phase', note:'[SUSTAINED HITS 1] or [LETHAL HITS], or both and [HAZARDOUS]',
              pick:[{ name:'Sustained Hits', note:'[SUSTAINED HITS 1]' }, { name:'Lethal Hits', note:'[LETHAL HITS]' }, { name:'All three', note:'[SUSTAINED HITS 1], [LETHAL HITS] and [HAZARDOUS]' }] },
            when:'Your Shooting phase.',
            target:'One **SKITARII** unit from your army that has not been selected to shoot this phase.',
            effect:'Select the **[SUSTAINED HITS 1]** or **[LETHAL HITS]** ability. Until the end of the phase, ranged weapons equipped by models in your unit have the selected ability. You can instead select the **[SUSTAINED HITS 1]**, **[LETHAL HITS]** and **[HAZARDOUS]** abilities to apply to those weapons until the end of the phase.' },
          { id:'threat-cogitation-targeters', gist:'Until the end of the phase, your unit’s ranged attacks allocated to a MONSTER or VEHICLE model can re-roll the Damage roll.', gistOf:'cfa80657', name:'Threat-cogitation Targeters', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Skitarii','Vehicle'] },
            mod:{ kind:'ranged', when:'Your Shooting phase, attacks allocated to a MONSTER or VEHICLE model', note:'can re-roll the Damage roll', vs:{ any:['Monster','Vehicle'] } },
            when:'Your Shooting phase.',
            target:'One **SKITARII VEHICLE** unit from your army that has not been selected to shoot this phase.',
            effect:'Until the end of the phase, each time a ranged attack made by a model in your unit is allocated to a **MONSTER** or **VEHICLE** model, you can re-roll the Damage roll.' },
          { id:'precision-onslaught', gist:'When your unit ends a Charge move: one D6 for each of its models within Engagement Range of one enemy unit; 1 mortal wound to that unit for each 4+.', gistOf:'6f2cfcd5', name:'Precision Onslaught', cp:1, phases:['charge'], turn:'your', needs:{ all:['Sicarian'] },
            when:'Your Charge phase, just after a **SICARIAN** unit from your army **declares a charge**.',
            target:'That **SICARIAN** unit.',
            effect:'Until the end of the phase, when your unit ends a **Charge move**, select one enemy unit within **Engagement Range** of it, then roll one D6 for each model in your unit that is within Engagement Range of that enemy unit: for each 4+, that enemy unit suffers 1 **mortal wound**.' },
          { id:'analytic-reprisals', gist:'An enemy unit has shot and your unit lost models to those attacks: your unit shoots as if it were your Shooting phase, but only at that enemy unit (and only if it is an eligible target).', gistOf:'365e76e8', name:'Analytic Reprisals', cp:1, phases:['shooting'], turn:'opp', needs:{ all:['Skitarii','Infantry'] },
            when:'Your opponent’s Shooting phase, just after an enemy unit has shot.',
            target:'One **SKITARII INFANTRY** unit from your army that lost one or more models as a result of the attacking unit’s attacks.',
            effect:'Your unit can shoot as if it were your Shooting phase, but must target only that enemy unit when doing so, and can only do so if that enemy unit is an eligible target.' }
        ]
      }
    }
  },
  'emperors-children': {
    name: 'Emperor’s Children',
    // army rules: Wahapedia, Emperor’s Children, Army Rules (the Faction Pack 1.3 prints no army rule and its Rules Updates change none)
    armyRules: [
      // Wahapedia prints “another units charge” (no apostrophe); New Recruit prints “another unit's charge”
      { name:'Thrill Seekers', ph:['shooting','charge'], turn:'your',
        text:'If your Army Faction is **EMPEROR’S CHILDREN**, this unit is eligible to shoot and declare a charge in a turn in which it Advanced or Fell Back, but when doing so:\n- It cannot target a unit it was within **Engagement Range** of at the start of the turn.\n- It cannot target a unit that was the target of another units charge or attack this phase.' },
      { name:'Pact of Excess',
        text:'When mustering your army, unless specifically stated otherwise, you cannot select **LEGIONS OF EXCESS** as your Army Faction.' }
    ],
    detachments: {
      // Coterie of the Conceited: a codex detachment the Faction Pack 1.3 does not print; rule, enhancements and stratagems from
      // Wahapedia, with the pack's Rules Updates (Armour of Abhorrence, Effect)
      'coterie-of-the-conceited': {
        name:'Coterie of the Conceited', dispositions:['Priority Assets','Purge the Foe'], dp:3,
        // the bonuses, label = the Pact points they need (cumulative)
        rule:{ name:'Pledges to the Dark Prince', at:'Start of the battle round', ph:['command','shooting','fight'], turn:'either', needs:{ all:['Faction: Emperor\'s Children'] },
          // the Pact point bonuses for all attacks: one pick, the Pact points gained so far (5+ adds [LETHAL HITS] and [SUSTAINED HITS 1] to
          // melee weapons only: each unit's own melee footnote)
          mod:{ kind:'all', lasts:'battle', when:'Pact points gained during the battle (cumulative)', note:'1+ re-roll hit rolls of 1 · 3+ also re-roll wound rolls of 1 · 7+ also a Critical Hit on an unmodified hit roll of 5+',
            pick:[{ name:'1+ Pact points', note:'re-roll hit rolls of 1' }, { name:'3+ Pact points', note:'re-roll hit rolls of 1 and wound rolls of 1' },
              { name:'7+ Pact points', note:'re-roll hit rolls of 1 and wound rolls of 1, a Critical Hit on an unmodified hit roll of 5+', calc:{ rrHit:'1s', rrWound:'1s', critHit:5 } }] },
          text:'At the start of the battle round, if your **WARLORD** is on the battlefield, you must pledge a number to Slaanesh representing how many enemy units will be destroyed this battle round. At the end of the battle round, if the number of enemy units destroyed this battle round is greater than or equal to your pledge, you gain a number of Pact points equal to your pledge. Otherwise, you do not gain any Pact points this battle round and your **WARLORD** model suffers D3 **mortal wounds**.\n**EMPEROR’S CHILDREN** units from your army gain a bonus depending on how many Pact points you have gained during the battle, as shown below (these are all cumulative).',
          table:[
            ['1+', 'Each time a model in this unit makes an attack, re-roll a **Hit roll** of 1.'],
            ['3+', 'Each time a model in this unit makes an attack, re-roll a **Wound roll** of 1.'],
            ['5+', 'Melee weapons equipped by models in this unit have the **[LETHAL HITS]** and **[SUSTAINED HITS 1]** abilities.'],
            ['7+', 'Each time a model in this unit makes an attack, a Critical Hit is scored on an unmodified **Hit roll** of 5+.']
          ] },
        enhancements:[
          { name:'Pledge of Eternal Servitude', pts:25, text:'**EMPEROR’S CHILDREN** model only. The first time the bearer is destroyed, take a **Leadership test** for the bearer at the end of the phase. If that test is passed, set the bearer back up on the battlefield, as close as possible to where it was destroyed and not within **Engagement Range** of one or more enemy units, with D6 wounds remaining (up to its Wounds characteristic).' },
          { name:'Pledge of Dark Glory', pts:25, text:'**EMPEROR’S CHILDREN** model only. While the bearer is leading a unit, improve the Leadership and Objective Control characteristics of models in that unit by 1.' },
          { name:'Pledge of Mortal Pain', pts:15, text:'**EMPEROR’S CHILDREN** model only. At the start of your Shooting phase, select one enemy unit within 12" of and **visible** to the bearer. That unit must take a **Leadership test**, subtracting 2 from the result if it is **Battle-shocked**: if failed, that enemy unit suffers 3 **mortal wounds**.' },
          { name:'Pledge of Unholy Fortune', pts:30, text:'**EMPEROR’S CHILDREN** model only. Once per turn, just after making a **Hit roll**, a **Wound roll** or a saving throw for a model in the bearer’s unit, if the bearer is not **Battle-shocked**, it can use this Enhancement. If it does, treat the result as an unmodified roll of 6 instead.' }
        ],
        stratagems:[
          { id:'protection-of-the-dark-prince', gist:'Just after a mortal wound or attack is allocated to a model in your unit: until the end of the phase, your unit has Feel No Pain 6+, and Feel No Pain 4+ against mortal wounds.', gistOf:'c67f3d03', def:'Feel No Pain 6+, and Feel No Pain 4+ against mortal wounds (until the end of the phase)', defOf:'c67f3d03', name:'Protection of the Dark Prince', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Faction: Emperor\'s Children'] },
            when:'Any phase, just after a **mortal wound** or attack is allocated to a model in an **EMPEROR’S CHILDREN** unit from your army.',
            target:'That **EMPEROR’S CHILDREN** unit.',
            effect:'Until the end of the phase, models in your unit have the **Feel No Pain 6+** ability, and the **Feel No Pain 4+** ability against **mortal wounds**.' },
          // the calculator counts the hit roll part (no modifier to the wound roll is set on a target here)
          { id:'unshakeable-opponents', gist:'Until the end of the turn, your unit’s attacks can ignore any or all modifiers to BS or WS, the hit roll and the wound roll.', gistOf:'df1ed0dd', mod:{ kind:'all', when:'Command phase, until the end of the turn', note:'can ignore any or all modifiers to BS or WS, to the hit roll and to the wound roll', calc:{ ignoreHitMods:true } }, name:'Unshakeable Opponents', cp:1, phases:['command'], turn:'either', needs:{ all:['Faction: Emperor\'s Children'] },
            when:'Command phase.',
            target:'One **EMPEROR’S CHILDREN** unit from your army.',
            effect:'Until the end of the turn, each time a model in your unit makes an attack, you can ignore any or all modifiers to the following: that attack’s Ballistic Skill or Weapon Skill characteristic; the **Hit roll**; the **Wound roll**.' },
          { id:'embrace-the-pain', gist:'Until the end of the phase, each enemy model within Engagement Range of your unit must select your unit as the target of its attacks.', gistOf:'eeb92a47', name:'Embrace the Pain', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: Emperor\'s Children','Infantry'] },
            when:'Start of the Fight phase.',
            target:'One **EMPEROR’S CHILDREN INFANTRY** unit from your army.',
            effect:'Until the end of the phase, each time an enemy model within **Engagement Range** of your unit selects targets, it must select your unit as the target of its attacks.' },
          { id:'martial-perfection', gist:'Your unit has not been selected to fight this phase: until the end of the phase, it can re-roll the hit roll.', gistOf:'a79ca781', mod:{ kind:'melee', when:'Fight phase, not yet selected to fight', note:'re-roll hit rolls' }, name:'Martial Perfection', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: Emperor\'s Children'] },
            when:'Fight phase.',
            target:'One **EMPEROR’S CHILDREN** unit from your army that has not been selected to fight this phase.',
            effect:'Until the end of the phase, each time a model in your unit makes an attack, you can re-roll the **Hit roll**.' },
          // the Faction Pack’s FAQ (also on Wahapedia), as the note
          { id:'unbound-arrogance', gist:'Just after your unit destroys an enemy unit: increase your pledge to Slaanesh by 1 (once per battle round).', gistOf:'c0f2bbce', name:'Unbound Arrogance', cp:1, phases:['shooting','fight'], turn:'either', turns:{ shooting:'your' }, needs:{ all:['Faction: Emperor\'s Children'] },
            note:'Faction Pack FAQ: “While using the Coterie of the Conceited Detachment, if my WARLORD is not on the battlefield, can I use the Unbound Arrogance Stratagem?” “Yes, your pledge to Slaanesh would increase from 0 to 1.”',
            when:'Your Shooting phase or the Fight phase, just after an **EMPEROR’S CHILDREN** unit from your army destroys an enemy unit.',
            target:'That **EMPEROR’S CHILDREN** unit.',
            effect:'Increase your pledge to Slaanesh by 1.',
            restrictions:'You can only use this Stratagem once per battle round.' },
          // effect: the Faction Pack 1.3 Rules Updates wording (“Change to”), as Wahapedia’s errata
          { id:'armour-of-abhorrence', gist:'Just after an enemy unit selects your unit as a target: until that unit has finished making its attacks, worsen the AP of each attack that targets your unit by 1.', gistOf:'906a14a4', def:'their Shooting phase or the Fight phase: worsen the AP of attacks that target it by 1 (until that enemy unit has attacked)', defOf:'906a14a4', name:'Armour of Abhorrence', cp:1, phases:['shooting','fight'], turn:'either', turns:{ shooting:'opp' }, needs:{ all:['Faction: Emperor\'s Children'] },
            when:'Your opponent’s Shooting phase or the Fight phase, just after an enemy unit has selected its targets.',
            target:'One **EMPEROR’S CHILDREN** unit from your army that was selected as the target of one or more of the attacking unit’s attacks.',
            effect:'Until the attacking unit has finished making its attacks, each time an attack targets your unit, worsen the Armour Penetration characteristic of that attack by 1.' }
        ]
      }
    }
  },
  'chaos-knights': {
    name: 'Chaos Knights',
    // Wahapedia also lists Dreadblades (CHAOS KNIGHTS models in another faction's army); it does nothing in these lists, so it is left out.
    armyRules: [
      // Wahapedia wording; the table is the Dread abilities, label = the name and the D6 result that selects it (drawn as a dice
      // icon on the page; Deathly Terror prints N/A). Darkness is the Rules Updates wording of GW's Faction Pack 1.2 (legal from
      // 26 Aug 2026), which Wahapedia's text already has.
      { name:'Harbingers of Dread', at:'Start of the battle round', ph:['command'], turn:'either',
        text:'If your Army Faction is **CHAOS KNIGHTS**, each unit from your army with this ability gains Dread abilities, depending which are active for your army (see below). The Deathly Terror ability is active for your army from the start of the battle. In addition, at the start of the first, third and fifth battle rounds, you can either select one of the other Dread abilities or randomly select two Dread abilities to apply by rolling two D6 and applying the results rolled, from those numbered 1-6.\nAny Dread abilities that have been selected are active until the end of the battle. You cannot select the same Dread ability more than once, and any duplicated Dread abilities (as a result of randomly selecting them) have no additional effect.',
        table:[
          ['Deathly Terror (Aura) · N/A', 'While an enemy unit is within 9" of this model, worsen the Leadership characteristic of models in that unit by 1.'],
          ['Despair (Aura) · 1', 'While an enemy unit is within 9" of this model, worsen the Leadership characteristic of models in that unit by 1. This is cumulative with the Deathly Terror ability (see above).'],
          ['Doom · 2', 'Each time this model makes an attack, if the target of that attack is **Battle-shocked**, add 1 to the **Wound roll**.'],
          ['Darkness · 3', 'This model has **Stealth**.'],
          ['Dismay (Aura) · 4', 'In the Battle-shock step of your opponent’s Command phase, for each enemy unit that is below its Starting Strength and within 9" of this model, that enemy unit must take a Battle-shock test.'],
          ['Delirium (Aura) · 5', 'While an enemy unit that is **Below Half-strength** is within 9" of this model, each time that unit fails a Battle-shock test, it suffers D3 **mortal wounds**.'],
          ['Dominion · 6', 'Add 3" to the range of this model’s **Aura abilities**.']
        ],
        // the Damage tab's reading (read by it alone): Doom, a box the player ticks (whether it is active and the target Battle-shocked
        // is theirs to say); the other Dread abilities change no numbers of your attacks
        calcMods:[{ kind:'all', from:'Doom', lasts:'battle', when:'Doom active (Harbingers of Dread), the target Battle-shocked', note:'+1 to wound rolls' }] },
      // Wahapedia, Codex: Chaos Knights army rules (GW's Faction Pack 1.2 prints "FACTION: Harbingers of Dread, Super-heavy Walker"
      // on the Chaos Knights datasheets). coreTwin: the core ability of the same name (Core Rules 24.35), which the datasheets'
      // Rules line opens; the two are shown together, and the note says the sources don't settle which applies
      // ph/turn: where its Normal, Advance and Fall Back moves are made; needs: only a unit whose Rules line names it has it
      // (the Knights; War Dogs only with Preyslayer's Mantle), so a list with none marks it as applying to no unit
      { name:'Super-heavy Walker', coreTwin:'Super-Heavy Walker', ph:['movement'], turn:'your', needs:{ rule:['Super-heavy Walker'] },
        note:'CHAOS KNIGHTS datasheets list Super-heavy Walker as a FACTION ability (Faction Pack 1.2), whose Codex text differs from Core Rules 24.35; the sources don’t say which applies.',
        text:'Each time a model with this ability makes a **Normal**, **Advance** or **Fall Back move**, it can move through models (excluding **TITANIC** models) and sections of **terrain features** that are 4" or less in height. When doing so:\n- It can move within **Engagement Range** of enemy models, but cannot end that move within Engagement Range of them.\n- It can also move through sections of terrain features that are more than 4" in height, but if it does, after it has moved, roll one D6: on a 1, that model is **Battle-shocked**.' }
    ],
    detachments: {
      // Infernal Lance: a codex detachment the Faction Pack 1.2 does not print; rule, enhancements and stratagems from Wahapedia, with
      // the pack's Rules Updates (Malefic Surge's Unnatural Fortitude, Hellforged Construction's Effect), which Wahapedia's text already has
      'infernal-lance': {
        name:'Infernal Lance', dispositions:['Priority Assets','Purge the Foe'], dp:3,
        // ph/turn: the Malefic Surge is made in your Command phase; Diabolic Power (an attack bonus, one of two) is the footnote,
        // Unnatural Fortitude (5+ invulnerable save or Feel No Pain 6+) the When targeted line
        rule:{ name:'Malefic Surge', ph:['command'], turn:'your', needs:{ all:['Faction: Chaos Knights'] },
          mod:{ kind:'all', when:'Empowered, using Diabolic Power (when selected to shoot or fight)', note:'[LETHAL HITS] or [SUSTAINED HITS 1] (until the end of the phase)',
            pick:[{ name:'Lethal Hits', note:'[LETHAL HITS]' }, { name:'Sustained Hits 1', note:'[SUSTAINED HITS 1]' }] },
          def:'Empowered, using Unnatural Fortitude: a 5+ invulnerable save or Feel No Pain 6+ (until the end of the phase)', defOf:'90edb259',
          text:'In your Command phase, one or more **CHAOS KNIGHTS** units from your army can make a Malefic Surge. Each one that does must first take a **Leadership test**; if that test is failed, that unit suffers D3 **mortal wounds**. Then, until the start of your next Command phase, that unit is Empowered. While a unit is Empowered it can use one of the Malefic Surge abilities below. Once that unit has used a Malefic Surge ability, it is no longer Empowered.\n- **Unholy Hunger:** When a model in this unit makes a **Normal**, **Advance** or **Fall Back move**, until the end of the phase, add 3" to its Move characteristic.\n- **Diabolic Power:** When this unit is selected to shoot or fight, select either the **[LETHAL HITS]** or **[SUSTAINED HITS 1]** ability. Until the end of the phase, weapons equipped by models in this unit have the selected ability.\n- **Unnatural Fortitude:** When this unit is selected as the target of an attack, select one of the following to apply until the end of the phase:\n- Models in this unit have a 5+ invulnerable save.\n- Models in this unit have the **Feel No Pain 6+** ability.\n*Designer’s Note: We recommend placing a token next to Chaos Knights models that are Empowered, removing it once they have used a Malefic Surge ability, and removing all unused tokens at the start of your Command phase.*' },
        enhancements:[
          { name:'Knight Diabolus', pts:25, text:'**CHAOS KNIGHTS** model only. Improve the Weapon Skill characteristic of the bearer’s melee weapons by 1. While the bearer is using the Diabolic Power ability, its melee weapons have the **[LANCE]** ability.' },
          { name:'Blasphemous Engine', pts:35, text:'**CHAOS KNIGHTS** model only. Add 2 to the bearer’s Wounds characteristic. Each time the bearer’s unit makes a Malefic Surge, you can re-roll the **Leadership test** taken to see if it suffers any **mortal wounds**.' },
          { name:'Fleshmetal Fusion', pts:35, text:'**CHAOS KNIGHTS** model only. Add 1 to the bearer’s Toughness characteristic. While the bearer is using the Unnatural Fortitude ability, each time an attack with a Damage characteristic of 1 is allocated to the bearer, add 1 to any armour saving throw made against that attack.' },
          { name:'Bestial Aspect', pts:30, text:'**CHAOS KNIGHTS** model only. The bearer’s ranged weapons have the **[ASSAULT]** ability. While the bearer is using the Unholy Hunger ability, it can ignore any or all modifiers to its Move characteristic and/or to **Advance rolls** made for its unit.' }
        ],
        stratagems:[
          { id:'profane-symbiosis', gist:'End of any phase: your unit that is not Empowered makes a Malefic Surge (not the same unit more than once per battle round).', gistOf:'b271d243', name:'Profane Symbiosis', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Faction: Chaos Knights'] },
            when:'End of any phase.',
            target:'One **CHAOS KNIGHTS** unit from your army that is not Empowered.',
            effect:'Your unit makes a Malefic Surge.',
            restrictions:'You cannot select the same unit as the target of this Stratagem more than once per battle round.' },
          { id:'hellforged-construction', gist:'Just after an enemy unit selects your unit as a target: until that unit has finished making its attacks, worsen the AP of each attack that targets your unit by 1.', gistOf:'eb621f06', def:'Fight phase: worsen the AP of attacks that target it by 1 (until that enemy unit has attacked)', defOf:'eb621f06', name:'Hellforged Construction', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: Chaos Knights'] },
            when:'Fight phase, just after an enemy unit has selected its targets.',
            target:'One **CHAOS KNIGHTS** unit from your army that was selected as the target of one or more of the attacking unit’s attacks.',
            effect:'Until the attacking unit has finished making its attacks, each time an attack targets your unit, worsen the Armour Penetration characteristic of that attack by 1.' },
          { id:'corrupting-taint', gist:'Just after your unit makes a Malefic Surge: select one objective marker you control that your unit is within range of; it stays under your control until your opponent’s Level of Control over it is greater than yours at the end of a phase.', gistOf:'4b839bc6', name:'Corrupting Taint', cp:1, phases:['command'], turn:'your', needs:{ all:['Faction: Chaos Knights','Character'] },
            when:'Your Command phase, just after a **CHAOS KNIGHTS CHARACTER** unit from your army makes a Malefic Surge.',
            target:'That **CHAOS KNIGHTS CHARACTER** unit.',
            effect:'Select one objective marker your unit is within range of that you control. That objective marker remains under your control until your opponent’s Level of Control over that objective marker is greater than yours at the end of a phase.' },
          { id:'unleash-balefire', gist:'After your unit has shot: one enemy unit it hit takes a Battle-shock test; if failed, it is aflame until the end of your opponent’s next turn (-2" Move, -2 to Charge rolls).', gistOf:'0d71729a', name:'Unleash Balefire', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Faction: Chaos Knights'] },
            when:'Your Shooting phase.',
            target:'One **CHAOS KNIGHTS** unit from your army that has not been selected to shoot this phase.',
            effect:'After your unit has shot, select one enemy unit hit by one or more of those attacks. That enemy unit must take a **Battle-shock test**; if the test is failed, until the end of your opponent’s next turn, it is aflame. While a unit is aflame, subtract 2" from its Move characteristic and subtract 2 from **Charge rolls** made for it.' },
          { id:'warp-vision', gist:'Until the end of the phase, your unit’s ranged weapons have [IGNORES COVER].', gistOf:'d33f9b4e', mod:{ kind:'ranged', when:'Your Shooting phase', note:'ranged weapons have [IGNORES COVER]' }, name:'Warp Vision', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Faction: Chaos Knights'] },
            when:'Your Shooting phase.',
            target:'One **CHAOS KNIGHTS** unit from your army that has not been selected to shoot this phase.',
            effect:'Until the end of the phase, ranged weapons equipped by models in your unit have the **[IGNORES COVER]** ability.' },
          { id:'diabolic-bulwark', gist:'Just after an enemy unit selects your unit as a target: until the end of the phase, your unit’s models have a 4+ invulnerable save.', gistOf:'c7778f00', def:'their Shooting phase: 4+ invulnerable save (until the end of the phase)', defOf:'c7778f00', name:'Diabolic Bulwark', cp:1, phases:['shooting'], turn:'opp', needs:{ all:['Faction: Chaos Knights'] },
            when:'Your opponent’s Shooting phase, just after an enemy unit has selected its targets.',
            target:'One **CHAOS KNIGHTS** unit from your army that was selected as the target of one or more of the attacking unit’s attacks.',
            effect:'Until the end of the phase, models in your unit have a 4+ invulnerable save.' }
        ]
      },
      // Houndpack Lance: a codex detachment the Faction Pack 1.2 does not print; Wahapedia wording, with the pack's Rules Updates
      // (Animalistic Rage's When, Harrying Hounds' Target), which Wahapedia's text already has
      'houndpack-lance': {
        name:'Houndpack Lance', dispositions:['Reconnaissance'], dp:2,
        // ph/turn: the unit is selected at the start of your Command phase; the attack bonus is the footnote of every WAR DOG unit
        rule:{ name:'Marked Prey', ph:['command'], turn:'your', needs:{ all:['War Dog'] },
          mod:{ kind:'all', lasts:'round', when:'Target is the unit selected at the start of your Command phase, visible to the attacking model', note:'[SUSTAINED HITS 1]' },
          text:'At the start of your Command phase, select one unit from your opponent’s army. Until the start of your next Command phase, each time a **WAR DOG** model from your army makes an attack that targets that enemy unit, if that unit is visible to the attacking model, that attack has the **[SUSTAINED HITS 1]** ability.\nKEYWORDS\nWhile using the Houndpack Lance Detachment, the following rules apply:\n- Your army must include three or more **WAR DOG** units.\n- **WAR DOG** units from your army have the **BATTLELINE** keyword.\n- When mustering your army, select three **WAR DOG** units from your army. Until the end of the battle, those units have the **CHARACTER** keyword.*\n***Designer’s Note:** This means that the selected units can be given Enhancements and one of them can be selected as your **WARLORD**.' },
        enhancements:[
          { name:'Preyslayer’s Mantle', pts:15, text:'**WAR DOG** model only. The bearer has the Super-heavy Walker ability.' },
          { name:'Final Howl (Aura)', pts:20, text:'**WAR DOG** model only. While a friendly War Dog model is within 6" of the bearer, each time that model makes an attack, re-roll a **Wound roll** of 1.' },
          { name:'Loping Predator', pts:10, text:'**WAR DOG** model only. The bearer’s ranged weapons have the **[ASSAULT]** ability.' },
          { name:'Panoply of the Cursed Knights', pts:15, text:'**WAR DOG** model only. Each time an attack targets the bearer, worsen the Armour Penetration characteristic of that attack by 1.' }
        ],
        stratagems:[
          // Wahapedia strikes WAR DOG CHARACTER through (its mark for a keyword that does not appear in the faction); needs reads it as
          // a WAR DOG unit with the CHARACTER keyword (this detachment's three selected units)
          { id:'vox-howl', gist:'Each enemy unit within 6" of your unit takes a Battle-shock test; each Battle-shocked friendly WAR DOG unit within 6" takes a Leadership test and, if passed, is no longer Battle-shocked (once per turn).', gistOf:'d5b4d69a', name:'Vox-howl', cp:2, phases:['shooting','fight'], turn:'either', needs:{ all:['War Dog','Character'] },
            when:'Start of the Shooting phase or the start of the Fight phase.',
            target:'One ~~**WAR DOG CHARACTER**~~ unit from your army.',
            effect:'Each enemy unit within 6" of your unit must take a **Battle-shock test**. Each friendly **WAR DOG** unit that is within 6" of your unit and is Battle-shocked must take a **Leadership test**; if that test is passed, that unit is no longer Battle-shocked.',
            restrictions:'You can only use this Stratagem once per turn.' },
          { id:'hungry-for-combat', gist:'Two or more of your WAR DOG units within Engagement Range of the same enemy unit: until the end of the phase, they can only target one enemy unit within Engagement Range of them, but their attacks score a Critical Hit on an unmodified hit roll of 5+.', gistOf:'a5afcf82', mod:{ kind:'melee', when:'Fight phase, two or more WAR DOG units within Engagement Range of the target (they can only target it)', note:'a Critical Hit on an unmodified hit roll of 5+', calc:{ critHit:5 } }, name:'Hungry for Combat', cp:1, phases:['fight'], turn:'either', needs:{ all:['War Dog'] },
            when:'Start of the Fight phase.',
            target:'Two or more **WAR DOG** units from your army within **Engagement Range** of the same enemy unit.',
            effect:'Select one enemy unit within Engagement Range of those **WAR DOG** units. Until the end of the phase, models in those **WAR DOG** units can only target that enemy unit, but each time a model in one of those **WAR DOG** units makes an attack, an unmodified **Hit roll** of 5+ scores a Critical Hit.' },
          { id:'cunning-hunter', gist:'Until the end of the turn, your unit can shoot and declare a charge in a turn in which it Fell Back.', gistOf:'de80796e', name:'Cunning Hunter', cp:1, phases:['movement'], turn:'your', needs:{ all:['War Dog'] },
            when:'Your Movement phase, just after a **WAR DOG** unit from your army Falls Back.',
            target:'That **WAR DOG** unit.',
            effect:'Until the end of the turn, your unit is eligible to shoot and declare a charge in a turn in which it Fell Back.' },
          { id:'animalistic-rage', gist:'Your WAR DOG unit just destroyed, not yet selected to attack this phase: before its Deadly Demise, it can shoot or fight, targeting only the enemy unit that destroyed it, if that unit is an eligible target.', gistOf:'85fd3659', name:'Animalistic Rage', cp:1, phases:['shooting','fight'], turn:'either', turns:{ shooting:'opp' }, needs:{ all:['War Dog'] },
            when:'Your opponent’s Shooting phase or the Fight phase, just after a **WAR DOG** unit from your army that has not been **selected to attack** this phase is **destroyed**.',
            target:'That **WAR DOG** unit. You can use this **Stratagem** on that unit even though it was just destroyed.',
            effect:'Before resolving your unit’s **Deadly Demise** ability, it can either shoot or fight. When doing so, it must target only the enemy unit that just destroyed it, and can only do so if that enemy unit is an eligible target. After it has done so and after any **Consolidation moves** have been made, resolve your unit’s **Deadly Demise** ability as normal.' },
          { id:'harrying-hounds', gist:'An enemy unit just ended a Normal, Advance or Fall Back move within 8" of your unit: your unit can make a Normal move of up to 6".', gistOf:'9b533d21', name:'Harrying Hounds', cp:1, phases:['movement'], turn:'opp', needs:{ all:['War Dog'] },
            when:'Your opponent’s Movement phase, just after an enemy unit ends a **Normal**, **Advance** or **Fall Back move**.',
            target:'One **WAR DOG** unit from your army that is within 8" of that enemy unit.',
            effect:'Your unit can make a **Normal move** of up to 6".' },
          { id:'encircling-pack', gist:'Your unit wholly within 12" of a battlefield edge and not within Engagement Range of an enemy unit: remove it from the battlefield and place it into Strategic Reserves.', gistOf:'90b596bf', name:'Encircling Pack', cp:1, phases:['fight'], turn:'opp', needs:{ all:['War Dog'] },
            when:'End of your opponent’s Fight phase.',
            target:'One **WAR DOG** unit from your army that is wholly within 12" of one or more battlefield edges and not within **Engagement Range** of one or more enemy units.',
            effect:'Remove your unit from the battlefield and place it into **Strategic Reserves**.' }
        ]
      },
      // Hunting Warpack: GW's Faction Pack 1.2 prints it in full (p3); its wording, checked against Wahapedia's
      'hunting-warpack': {
        name:'Hunting Warpack', dispositions:['Reconnaissance'], dp:1,
        rule:{ name:'Scenting Fear', tag:'Once per battle round, per army', ph:['shooting'], turn:'your', needs:{ all:['War Dog'] },
          text:'(Once per battle round, per army) In your Shooting phase, you can select one **visible** enemy unit within 12" of a friendly **WAR DOG** unit. That enemy unit has +6" **detection range**.\nThis detachment has the **WAR DOGS** tag and cannot be taken with another **WAR DOGS** detachment.' },
        enhancements:[
          { name:'Soul-Spoor Auspicator', pts:15, upgrade:true, text:'**HUNTSMAN** unit only. This unit’s ranged attacks have +6" **R**.' },
          { name:'Snarling Rivalry', pts:10, upgrade:true, text:'**EXECUTIONER** unit only. This unit’s ranged attacks have **[IGNORES COVER]**.' }
        ],
        stratagems:[
          { id:'insensate-bloodthirst', gist:'An enemy unit targets your unit in the Fight phase: your unit has Feel No Pain 5+.', gistOf:'6431f660', def:'Fight phase: Feel No Pain 5+', defOf:'6431f660', name:'Insensate Bloodthirst', cp:1, phases:['fight'], turn:'either', needs:{ all:['War Dog'] },
            when:'Fight phase, when an enemy unit targets a friendly **WAR DOG** unit.',
            target:'That **WAR DOG** unit.',
            effect:'Your unit has **Feel No Pain 5+**.' },
          { id:'leash-of-the-masters', gist:'Your unit has shot: those attacks do not prevent it from being eligible to start an action.', gistOf:'72cb1e76', name:'Leash of the Masters', cp:1, phases:['shooting'], turn:'your', needs:{ all:['War Dog'] },
            when:'Your Shooting phase, when a friendly **WAR DOG** unit has shot.',
            target:'That **WAR DOG** unit.',
            effect:'Those attacks do not prevent your unit from being **eligible to start an action**.' },
          { id:'stalking-focus', gist:'An enemy unit targets your unit within range of an objective: ranged attacks that target your unit have -1 AP until that enemy unit has attacked.', gistOf:'6916566f', def:'their Shooting phase, within range of an objective: -1 AP to ranged attacks that target it (until that enemy unit has attacked)', defOf:'6916566f', name:'Stalking Focus', cp:1, phases:['shooting'], turn:'opp', needs:{ all:['War Dog'] },
            when:'Your opponent’s Shooting phase, when an enemy unit targets a friendly **WAR DOG** unit within range of an **objective**.',
            target:'That **WAR DOG** unit.',
            effect:'Ranged attacks that target your unit have -1 **AP** until that enemy unit has attacked.' }
        ]
      }
    }
  },
  'adeptus-custodes': {
    name: 'Adeptus Custodes',
    // New Recruit (BSData) spells the army rule with a straight apostrophe, Wahapedia "Martial Ka’tah"
    aliases: [[/^martial ka'tah$/i, 'Martial Ka’tah']],
    // Sources: the new Codex: Adeptus Custodes as Wahapedia prints it (with GW's Printed Product Updates of 14 Oct 2026, which change
    // nothing in this list). GW's Faction Pack 1.2 (legal from 30 Sep 2026) is the previous codex's: its Rules Updates and its
    // detachments (a Might of the Moritoi of its own among them) are not used.
    // army rules: Wahapedia, Adeptus Custodes, Army Rules. Martial Ka’tah: the rule, then its Favoured Ka’tah paragraph
    // (a sub-heading inside the rule on Wahapedia); the table is the six ka’tah abilities (name, then their WHEN / TARGET / EFFECT).
    // Wahapedia also lists Special Move Types (the Shock Disembark Move, for a unit embarked within a TRANSPORT): no TRANSPORT in these
    // lists, so it is left out.
    armyRules: [
      // def: Kaptaris, the ka’tah ability that protects the unit (Fight phase)
      { name:'Martial Ka’tah', at:'Start of your Command phase', ph:['command','movement','shooting','fight'], turn:'either', turns:{ command:'your', movement:'your', shooting:'your' },
        def:'Kaptaris (start of the Fight phase, a readied unit): melee attacks that target it have -1 to hit rolls', defOf:'545367df', defPh:['fight'],
        text:'At the start of your Command phase, friendly **ADEPTUS CUSTODES** units with this ability are **readied**. While a friendly unit is **readied**, you can select one of the **ka’tah abilities** presented below for that unit to use. If you do, that unit is no longer **readied**.\nEach **ka’tah ability** will tell you when that **ka’tah ability** can be used, and the effects that **ka’tah ability** has on the unit using it.\nWe recommend placing a token next to each **readied** unit, removing it when that unit is no longer **readied**.\n**Favoured Ka’tah**\nAll **detachments** tagged ‘Unique: Shield Host’ state a Favoured Ka’tah. If you selected one of these **detachments**, the **ka’tah ability** that is the Favoured Ka’tah of that **detachment** grants the additional effect listed in that **detachment**.\n**Example:** If you selected the Solar Watch **detachment**, when you select the Calistus **ka’tah ability** for a **readied** unit, that unit has +2" **M** in addition to the normal effect of Calistus.',
        table:[
          ['Conservai', 'KA’TAH ABILITY\n**WHEN:** Your Command phase.\n**TARGET:** One friendly **readied** unit.\n**EFFECT:** Until the end of the turn:\n- Being **engaged**/**battle-shocked** does not prevent your unit from being eligible to start an action.\n- Starting an action does not prevent your unit from being eligible to shoot.'],
          ['Calistus', 'KA’TAH ABILITY\n**WHEN:** Your Movement phase, when a friendly **readied** unit is selected to move.\n**TARGET:** That **readied** unit.\n**EFFECT:** When your unit makes a normal/advance/fall-back move, your unit can move through all types of model.'],
          ['Salvus', 'KA’TAH ABILITY\n**WHEN:** Your Shooting phase, when a friendly **readied** unit is selected to shoot.\n**TARGET:** That **readied** unit.\n**EFFECT:** Your unit can ignore modifiers to your unit’s:\n- **BS.**\n- Hit rolls and wound rolls.'],
          ['Dacatarai', 'KA’TAH ABILITY\n**WHEN:** Start of the Fight phase.\n**TARGET:** One friendly **readied** unit.\n**EFFECT:** Your unit’s melee attacks that target an enemy unit (excluding **MONSTER**/**VEHICLE** units) can **re-roll hit rolls** of 1.'],
          ['Kaptaris', 'KA’TAH ABILITY\n**WHEN:** Start of the Fight phase.\n**TARGET:** One friendly **readied** unit.\n**EFFECT:** Melee attacks that target your unit have -1 to hit rolls.'],
          ['Rendax', 'KA’TAH ABILITY\n**WHEN:** Fight phase, when a friendly **readied** unit is selected to fight.\n**TARGET:** One friendly **readied** unit.\n**EFFECT:** Your unit’s melee attacks have **[Lethal Hits: Monster/Vehicle]**.']
        ],
        // the Damage tab's reading (read by it alone): the ka’tah abilities that change your unit's attacks, each a box the player ticks
        // (whether the unit is readied and which ka’tah it uses are theirs to say). Salvus: the calculator counts the hit roll part.
        // Kaptaris protects the unit and Calistus / Conservai change no numbers of its attacks
        calcMods:[
          { kind:'ranged', from:'Salvus', when:'Salvus (your Shooting phase, a readied unit selected to shoot)', note:'can ignore modifiers to BS, hit rolls and wound rolls', calc:{ ignoreHitMods:true } },
          { kind:'melee', from:'Dacatarai', when:'Dacatarai (start of the Fight phase, a readied unit), vs non-MONSTER/VEHICLE targets', note:'re-roll hit rolls of 1', vs:{ none:['Monster','Vehicle'] } },
          { kind:'melee', from:'Rendax', when:'Rendax (Fight phase, a readied unit selected to fight), vs MONSTER/VEHICLE targets', note:'[LETHAL HITS]', vs:{ any:['Monster','Vehicle'] } }
        ] },
      { name:'Aegis of the Emperor', def:'Feel No Pain 5+ against mortal wounds', defOf:'df193819',
        text:'Friendly **ADEPTUS CUSTODES** units with this ability have Feel No Pain 5+ against mortal wounds.' },
      { name:'Aquila Commander', at:'Start of the battle round', ph:['command'], turn:'either',
        text:'At the start of the battle round, if a model with this ability is your **WARLORD**, gain 1CP.' },
      { name:'Daughters of the Abyss', def:'Feel No Pain 3+ against psychic attacks', defOf:'7e9be553',
        text:'- Friendly **ANATHEMA PSYKANA** units with this ability have Feel No Pain 3+ against psychic attacks.\n- Friendly **ANATHEMA PSYKANA** units with this ability have the following ability:\n**Psychic Null (Aura):** Friendly **ADEPTUS CUSTODES** units within 6" of this unit have **Feel No Pain 5+** against **psychic attacks**.' },
      // how an Adeptus Custodes army includes the Prosecutors and Witchseekers (ANATHEMA PSYKANA, not ADEPTUS CUSTODES)
      { name:'Anathema Psykana',
        text:'You can include **ANATHEMA PSYKANA** units in your army, even though they do not have the **ADEPTUS CUSTODES** faction keyword.\nWhen mustering your army, unless otherwise stated:\n- You cannot select **ANATHEMA PSYKANA** as your army faction.\n- You cannot select an **ANATHEMA PSYKANA** model to be your **WARLORD**.' }
    ],
    detachments: {
      // Emperor’s Chosen: rule, enhancements and stratagems from Wahapedia (the codex)
      'emperors-chosen': {
        name:'Emperor’s Chosen', dispositions:['Priority Assets'], dp:1,
        // ph/turn: "selected to attack" (shoot or fight, and Fire Overwatch in the opponent's Movement phase); the Favoured Ka’tah's additional effect is Rendax's, in the Fight phase
        rule:{ name:'Magna Imperator', ph:['movement','shooting','fight'], turn:'either', turns:{ movement:'opp', shooting:'your' }, needs:{ all:['Faction: Adeptus Custodes'] },
          mod:{ kind:'all', when:'Selected to attack', note:'re-roll one hit roll and re-roll one wound roll' },
          text:'When a friendly **ADEPTUS CUSTODES** unit is **selected to attack**, that unit’s attacks can:\n- Re-roll one **hit roll**.\n- Re-roll one **wound roll**.\n**Favoured ka’tah: RENDAX**\n**Additional Effect:** You can select one enemy **MONSTER**/**VEHICLE** unit **engaged** with your unit and roll one D6:\n- On a 1-2, that enemy unit suffers 1 **mortal wound**.\n- On a 3-5, that enemy unit suffers D3 **mortal wounds**.\n- On a 6, that enemy unit suffers 3 **mortal wounds**.' },
        enhancements:[
          { name:'From the Hall of Armouries', pts:15, text:'**ADEPTUS CUSTODES** model only. This model’s melee attacks have **[Devastating Wounds]**.' },
          { name:'Radiant Mantle', pts:40, text:'**ADEPTUS CUSTODES INFANTRY** model only. Attacks that target this unit have -1 to **hit rolls**.' }
        ],
        stratagems:[
          { id:'in-auramite-clad', gist:'An enemy unit targets your unit: attacks that target your unit have -1 AP until that enemy unit has attacked.', gistOf:'64da3d9f', def:'their Shooting phase or the Fight phase: -1 AP to attacks that target it (until that enemy unit has attacked)', defOf:'64da3d9f', name:'In Auramite Clad', cp:1, phases:['shooting','fight'], turn:'either', turns:{ shooting:'opp' }, needs:{ all:['Faction: Adeptus Custodes'], none:['Custodian Wardens'] },
            when:'Your opponent’s Shooting phase or the Fight phase, when an enemy unit targets a friendly **ADEPTUS CUSTODES** unit (excluding **CUSTODIAN WARDENS** units).',
            target:'That **ADEPTUS CUSTODES** unit.',
            effect:'Attacks that target your unit have -1 **AP** until that enemy unit has attacked.' },
          { id:'superhuman-focus', gist:'End of any phase: your unit that is not readied is readied (not the same unit more than once per battle round).', gistOf:'bf9e086f', name:'Superhuman Focus', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Faction: Adeptus Custodes'] },
            when:'End of any phase.',
            target:'One friendly **ADEPTUS CUSTODES** unit that is not **readied**.',
            effect:'Your unit is **readied**.',
            restrictions:'You cannot select the same unit as the target of this **stratagem** more than once per battle round.' },
          // Wahapedia strikes MONSTER through (its mark for a keyword that does not appear in the faction)
          { id:'impenetrable-bastion', gist:'Select one objective your unit is controlling: that objective is secured.', gistOf:'9e6e7214', name:'Impenetrable Bastion', cp:1, phases:['movement'], turn:'your', needs:{ all:['Faction: Adeptus Custodes'], none:['Monster','Vehicle'] },
            when:'End of your Movement phase.',
            target:'One friendly **ADEPTUS CUSTODES** unit (excluding ~~MONSTER~~/**VEHICLE** units).',
            effect:'Select one **objective** your unit is controlling. That **objective** is **secured**.' }
        ]
      },
      // Grav-Assault Force: Wahapedia wording (the codex)
      'grav-assault-force': {
        name:'Grav-Assault Force', dispositions:['Reconnaissance'], dp:1,
        rule:{ name:'Flare Shields', needs:{ all:['Grav-assault'] }, def:'4+ InSv against ranged attacks', defOf:'2c89de41',
          text:'Friendly **GRAV-ASSAULT** units have 4+ **InSv** against ranged attacks.' },
        enhancements:[
          { name:'Anti-gravitic Mobility', pts:15, upgrade:true, text:'**GRAV-ASSAULT** unit only. When this unit makes a **fall-back move**, that **fall-back move** does not prevent this unit from being **eligible to shoot**.' },
          { name:'Combat Deployment', pts:20, upgrade:true, text:'**GRAV-ASSAULT TRANSPORT** model only. When a friendly **ADEPTUS CUSTODES** unit is selected to make a **disembark move** from this unit, until the end of the turn:\n- That unit can re-roll **charge rolls**.\n- Enemy units cannot target that unit with **snap shooting** attacks.' }
        ],
        stratagems:[
          { id:'victory-before-death', gist:'Your unit within range of an objective is destroyed: select one objective it was controlling when it was destroyed, with no enemy units (excluding AIRCRAFT) within range of it: that objective is secured.', gistOf:'722bfcd2', name:'Victory Before Death', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Grav-assault'] },
            when:'Any phase, when a friendly **GRAV-ASSAULT** unit within range of an **objective** is **destroyed**.',
            target:'That **GRAV-ASSAULT** unit. You can target that unit with this **stratagem** even though it is **destroyed**.',
            effect:'Select one **objective** that:\n- Your unit was controlling when it was **destroyed**.\n- Has no enemy units (excluding **AIRCRAFT** units) within range of it.\nThat **objective** is **secured**.' },
          { id:'advanced-stabilisers', gist:'Your unit’s ranged attacks have [ASSAULT].', gistOf:'9ce5cb53', mod:{ kind:'ranged', when:'Your Shooting phase, selected to shoot', note:'ranged attacks have [ASSAULT]' }, name:'Advanced Stabilisers', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Grav-assault'] },
            when:'Your Shooting phase, when a friendly **GRAV-ASSAULT** unit is **selected to shoot**.',
            target:'That **GRAV-ASSAULT** unit.',
            effect:'Your unit’s ranged attacks have **[Assault]**.' },
          // the calculator counts the hit roll part (BS and hit roll modifiers)
          { id:'inevitable-annihilation', gist:'Your unit can ignore modifiers to its BS and hit rolls.', gistOf:'0b8d7833', mod:{ kind:'ranged', when:'Your Shooting phase, selected to shoot', note:'can ignore modifiers to BS and hit rolls', calc:{ ignoreHitMods:true } }, name:'Inevitable Annihilation', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Grav-assault'] },
            when:'Your Shooting phase, when a friendly **GRAV-ASSAULT** unit is **selected to shoot**.',
            target:'That **GRAV-ASSAULT** unit.',
            effect:'Your unit can ignore modifiers to your unit’s:\n- **BS**.\n- **Hit rolls**.' }
        ]
      },
      // Might of the Moritoi: the codex detachment (Moritoi Ancients, Memento Moritoi, Augury Uplink), as Wahapedia, BSData and New
      // Recruit print it
      'might-of-the-moritoi': {
        name:'Might of the Moritoi', dispositions:['Take and Hold'], dp:1,
        // the re-rolls for below starting strength / below half-strength: one pick (OC +2 at starting strength is not an attack)
        rule:{ name:'Moritoi Ancients', needs:{ all:['Faction: Adeptus Custodes','Dreadnought'] },
          mod:{ kind:'all', when:'Below starting strength, or below half-strength', note:'below starting strength: re-roll hit rolls of 1 · below half-strength: re-roll hit rolls of 1 and wound rolls of 1',
            pick:[{ name:'Below starting strength', note:'re-roll hit rolls of 1' }, { name:'Below half-strength', note:'re-roll hit rolls of 1 and wound rolls of 1' }] },
          text:'- While a friendly **ADEPTUS CUSTODES DREADNOUGHT** unit is at **starting strength**, that unit has +2 **OC**.\n- While a friendly **ADEPTUS CUSTODES DREADNOUGHT** unit is **below starting strength**, that unit’s attacks can re-roll **hit rolls** of 1.\n- While a friendly **ADEPTUS CUSTODES DREADNOUGHT** unit is **below half-strength**, that unit’s attacks can:\n- Re-roll **hit rolls** of 1.\n- Re-roll **wound rolls** of 1.' },
        // limit: Wahapedia prints "(one per army)" after the name; New Recruit and BSData name them without it
        enhancements:[
          { name:'Memento Moritoi', limit:'one per army', pts:30, upgrade:true, text:'**ADEPTUS CUSTODES DREADNOUGHT** model only. This model’s melee attacks have +1 **A**, **S** and **D**.' },
          { name:'Augury Uplink', limit:'one per army', pts:30, upgrade:true, text:'**ADEPTUS CUSTODES DREADNOUGHT** model only. This model has **Feel No Pain 5+**.' }
        ],
        stratagems:[
          { id:'honoured-interred', help:{ to:{ all:['Faction: Adeptus Custodes'] }, by:{ all:['Faction: Adeptus Custodes','Dreadnought'] }, via:'its aura: within 6" of the ADEPTUS CUSTODES DREADNOUGHT unit with it',
              mod:{ kind:'all', when:'Your Shooting phase or the Fight phase, within 6" of an ADEPTUS CUSTODES DREADNOUGHT unit with Honoured Interred', note:'re-roll hit rolls of 1' } }, gist:'Your unit has the Honoured Interred aura: friendly ADEPTUS CUSTODES units within 6" can re-roll hit rolls of 1.', gistOf:'644594f9', mod:{ kind:'all', when:'Your Shooting phase or the Fight phase (Honoured Interred, friendly ADEPTUS CUSTODES units within 6")', note:'re-roll hit rolls of 1' }, name:'Honoured Interred', cp:1, phases:['shooting','fight'], turn:'either', turns:{ shooting:'your' }, needs:{ all:['Faction: Adeptus Custodes','Dreadnought'] },
            when:'Your Shooting phase or the Fight phase.',
            target:'One friendly **ADEPTUS CUSTODES DREADNOUGHT** unit.',
            effect:'Your unit has the following ability:\n**Honoured Interred (Aura):** Friendly **ADEPTUS CUSTODES** units within 6" of this unit can re-roll **hit rolls** of 1.' },
          { id:'unceasing-onslaught', gist:'Your unit ended an advance move: its ranged attacks have [ASSAULT] until the end of the turn, and that move does not prevent it from declaring a charge.', gistOf:'12129802', mod:{ kind:'ranged', when:'Ended an advance move this turn (until the end of the turn)', note:'ranged attacks have [ASSAULT]' }, name:'Unceasing Onslaught', cp:1, phases:['movement'], turn:'your', needs:{ all:['Faction: Adeptus Custodes','Dreadnought'] },
            when:'Your Movement phase, when a friendly **ADEPTUS CUSTODES DREADNOUGHT** unit ends an **advance move**.',
            target:'That **ADEPTUS CUSTODES DREADNOUGHT** unit.',
            effect:'- Your unit’s ranged attacks have **[Assault]** until the end of the turn.\n- That move does not prevent your unit from being **eligible to declare a charge**.' },
          { id:'unstoppable-momentum', gist:'Your unit selected to move or declaring a charge has MOBILE.', gistOf:'c197996a', name:'Unstoppable Momentum', cp:1, phases:['movement','charge'], turn:'your', needs:{ all:['Faction: Adeptus Custodes','Dreadnought'] },
            when:'Your Movement/Charge phase, when a friendly **ADEPTUS CUSTODES DREADNOUGHT** unit is **selected to move** or **declares a charge**.',
            target:'That **ADEPTUS CUSTODES DREADNOUGHT** unit.',
            effect:'Your unit has **MOBILE**.' }
        ]
      }
    }
  },
};

/* ---------------- armies ----------------
   Each list's unit entries hold only what the list chose: ds (its datasheet in DATASHEETS, below; for an attached
   unit the leader's, the other characters' and the bodyguard's), points, copies, models, gear, enhancement, warlord,
   the attachment, its notes, footnotes and auras, and the values a rule of the list changed (from). The datasheet's
   facts (name, role, stats, weapons, abilities and their texts, rules, keywords) are in DATASHEETS; data.js joins the
   two when it loads (resolveArmies, at the end), so the app gets each unit with every field below. A row of an entry
   (stats, ranged, melee, abilities) names its datasheet row and adds the list's fields; an entry without one kind of
   rows has all of its datasheet's. over: a datasheet fact this list has otherwise than another list, kept per list
   until decided (verify/out/tables.md). verify/tables.js --write writes all of it; edit a datasheet in DATASHEETS.
   Army: id, name, faction (key into FACTIONS), points, pointsUsed, battleSize,
         disposition, detachments (keys), source;
         config: the other selections New Recruit prints under the army name, label → value
         as printed ("Code Chivalric: Deed, Quality" → { 'Code Chivalric':'Deed, Quality' }).
   Unit fields (of the unit the app gets):
     role        Epic Hero | Character | Battleline | Infantry | Mounted | Monster | Vehicle
     short       shorter name where two units share one (e.g. Beastboss)
     pts, ptsNote  points (for the whole attached unit) and how they add up
     copies      how many identical units the list has (New Recruit prints "x3")
     warlord, enhancement, leads (name of the unit it leads),
                 support (it is attached as Support, not Leader), upgrade (an UPGRADE
                 enhancement the bodyguard has)
                 also: the other characters attached to the same bodyguard, [{ name, support }]
                 (a Warboss leading the Breaka Boyz a Bigboss supports); enhOn / warlordOn: the
                 character with the enhancement / the Warlord, when it is not the first
     models      lines from the "Models" box
     gear        per models line, the weapons that line carries (weapon name, or group
                 for a multi-profile weapon), from New Recruit's Options column. It tells
                 the app which weapons a model uses together and which are a choice.
     unplaced    wargear New Recruit lists for the unit (a weapon or an ability, with its
                 who and n) but on no models line: the app shows it as not said which
                 models carry it
     stats       one row per model profile: M T Sv W Ld OC InSv base
     ranged / melee  weapons: name, range, A, BS|WS, S, AP, D, kw[]
                 group  joins the "pick one profile" rows of one weapon
                 who    which model in an attached unit carries it
                 n      how many models carry it
                 hunter the Hunter: MONSTER/VEHICLE profile; enh  weapon from an enhancement
     from        (on a weapon or stats row) values a rule of the list already changed, as
                 { keyword or field: rule name | [names] }; written from BSData's modifiers
                 by verify/bsdata.js and checked against them and New Recruit's "(…)" marks
     printed     (on a stats row) what New Recruit prints for a value the app shows with a rule applied that
                 BSData does not apply ({ InSv:'5+*' }, before Sanctuary); checked by verify/nr.js
     abilities   name, text, tag, who; ph/turn/turns = the phase it triggers in;
                 def = one-line summary for the datasheet's "When targeted" line
                 note = the app's note under it (an FAQ, a core rule it meets, a question the rules leave
                 open: both readings); its quotes are checked by verify/texts.js, its words signed off
     mods        abilities that change this unit's attacks, shown under its weapon tables:
                 kind ranged|melee|all, when, note, from. With weapon + set, that weapon's
                 cell shows both values ("8/14") and the condition becomes its footnote.
     (stratagems can carry a mod or def too: it shows on every unit that can use them,
      with its CP cost, e.g. "1CP Hack and Slash")
     (mods, auras and stratagem mods, for the Damage tab: always = applies whenever its vs holds, so the box starts
      ticked; selfAlways = the same for an aura's own unit (22.01); vs = the targets it is for: { any:[keywords] }
      (at least one), { all:[keywords] } (every one), { none:[keywords] } (none of them), { maxT:6 } (no model T 7+);
      calc = its numbers when the words of its note say more than the calculator counts; pick = a choice of one of
      several effects ([{ name, note }]: one box, the player picks which). On an ability: riled = this unit is always riled up)
     guard       help this unit gives other units of its list when they are attacked: needs, kind, when, note,
                 calc (insv, fnp, stealth), one = one model only
     aura        mods this unit gives to other units: needs = which units (keywords),
                 notSelf = not the unit itself, selfWhen = the condition on its own sheet
     rules       core/faction rules that open a glossary entry
     srcNote     where the sources disagree about the unit: { at: a model's name (its models line) or 'kw' (the keywords), note }
     kwOnly      keywords in `kw` that only some models of the unit have, keyword → those models (Wahapedia's "KEYWORDS – ALL
                 MODELS: … ASPIRING SORCERER ONLY: PSYKER", BSData's categories on one model): the datasheet lists them apart
     partialRules  rules in `rules` that only some models of the unit have, label → the model that has it
                 ({ 'Scouts 6"':'Slaughterbound' }): the unit cannot use a rule every model must have (24.09,
                 24.31), and the app names that model next to the rule
     kw, kwNote  the unit's keywords ("Categories")                                     */
const ARMIES = [
{
  id:'shooty', name:'Me shooty yer’ booty', faction:'orks', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Purge the Foe',
  detachments:['dread-mob','shoota-boyz','wreckas'],
  source:'New Recruit, exported 17 Oct 2026',
  units:[
    {
      id:'wazdakka', ds:'orks/wazdakka-gutsmek', pts:200,
      models:['1× Wazdakka Gutsmek'],
      gear:[['Fixit’s Wrench','Grabba Dragga','Psyko-gatler','Speeding Bulk and Flaming Exhaust']]
    },
    {
      id:'dakkarig-herder', ds:'orks/big-mek-dakkarig', short:'Big Mek', pts:190, enhancement:'Dreadherder',
      models:['1× Big Mek Dakkarig'],
      gear:[['Blitzkannon','Multi-busta Launcha','Stompy Feet']],
      abilities:[
        { name:'Even More Dakka' },
        { name:'Blitz Dem Gitz!' },
        { name:'Dreadherder', tag:'Enhancement', ph:['shooting','fight'], turn:'your', def:'Lone Operative while within 3" of a friendly ORKS WALKER unit (not BIG MEK)', text:'**BIG MEK** model only. While this model is within 3" of a friendly **ORKS WALKER** unit (excluding **BIG MEK** units):\n- This model has **Lone Operative**.\n- In your Shooting phase, you can select one friendly **ORKS WALKER** unit within 3" of this model. That unit’s attacks can re-roll **hit rolls** of 1 until the end of the turn.', defOf:'2373b0a6' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', weapon:'Blitzkannon', set:{ A:'+6' }, when:'vs non-MONSTER/VEHICLE targets', note:'in your Shooting phase', from:'Blitz Dem Gitz!', always:true, vs:{ none:['Monster','Vehicle'] } },
        { kind:'ranged', when:'Riled up', cond:'riled', note:'[SUSTAINED HITS 1]', from:'Even More Dakka' }
      ],
      aura:[
        { kind:'all', needs:{ all:['Faction: Orks','Walker'] }, when:'Picked by the Dreadherder', selfWhen:'Picked by the Dreadherder for its own unit', note:'re-roll hit rolls of 1 this turn', from:'Dreadherder', lasts:'turn' }
      ]
    },
    {
      id:'dakkarig-boosta', ds:'orks/big-mek-dakkarig', short:'Big Mek', pts:170, enhancement:'Cybork Boosta',
      models:['1× Big Mek Dakkarig'],
      gear:[['Blitzkannon','Multi-busta Launcha','Stompy Feet']],
      stats:[
        { name:'Big Mek Dakkarig', M:'10"', from:{ M:'Cybork Boosta' } }
      ],
      abilities:[
        { name:'Even More Dakka' },
        { name:'Blitz Dem Gitz!' },
        { name:'Cybork Boosta', tag:'Enhancement', text:'**BIG MEK/MEK** model only. This model has +2" **M**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', weapon:'Blitzkannon', set:{ A:'+6' }, when:'vs non-MONSTER/VEHICLE targets', note:'in your Shooting phase', from:'Blitz Dem Gitz!', always:true, vs:{ none:['Monster','Vehicle'] } },
        { kind:'ranged', when:'Riled up', cond:'riled', note:'[SUSTAINED HITS 1]', from:'Even More Dakka' }
      ]
    },
    {
      id:'bigmek-mega', ds:'orks/big-mek-in-mega-armour', short:'Big Mek', pts:115, enhancement:'Supa-glowy Fing',
      models:['1× Big Mek in Mega Armour'],
      gear:[['Kustom Mega-blasta','Power Klaw','Tellyport Blasta']],
      ranged:[
        { name:'Kustom Mega-blasta', kw:['HAZARDOUS','IGNORES COVER','ASSAULT','ANTI-INFANTRY 4+','DEVASTATING WOUNDS','SUPA-HAZARDOUS'], from:{ 'IGNORES COVER':'More Dakka', ASSAULT:'Dakka! Dakka! Dakka!', 'ANTI-INFANTRY 4+':'Supa-glowy Fing', 'DEVASTATING WOUNDS':'Supa-glowy Fing', 'SUPA-HAZARDOUS':'Supa-glowy Fing' } },
        { name:'Tellyport Blasta', kw:['BLAST 1','IGNORES COVER','ASSAULT','ANTI-INFANTRY 4+','DEVASTATING WOUNDS','SUPA-HAZARDOUS'], from:{ 'IGNORES COVER':'More Dakka', ASSAULT:'Dakka! Dakka! Dakka!', 'ANTI-INFANTRY 4+':'Supa-glowy Fing', 'DEVASTATING WOUNDS':'Supa-glowy Fing', 'SUPA-HAZARDOUS':'Supa-glowy Fing' } }
      ],
      abilities:[
        { name:'Fix Dat Armour Up' },
        { name:'More Dakka' },
        { name:'Supa-glowy Fing', tag:'Enhancement', text:'**ORKS INFANTRY** model only (excluding **WEIRDBOY** models). This model’s ranged attacks have:\n- **[ANTI-INFANTRY 4+]**.\n- **[DEVASTATING WOUNDS]**.\n- **[SUPA-HAZARDOUS]**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Riled up', cond:'riled', note:'[SUSTAINED HITS 1]', from:'More Dakka' }
      ],
      rules:['Waaagh!','Leader','Supa-hazardous'],
      why:{ rules:{ 'Supa-hazardous':'Supa-glowy Fing' } }
    },
    {
      id:'warboss', ds:'orks/warboss', pts:100, warlord:true,
      models:['1× Warboss'],
      gear:[['Kustom Choppa','Kustom Shoota']],
      ranged:[
        { name:'Kustom Shoota', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 2','ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Made a charge move this turn', cond:'charged', note:'+3 A, +2 S', from:'Might is Right' },
        { kind:'ranged', when:'Boss’ Ammo Runt used (your Shooting phase, when selected to shoot)', note:'+1 to hit rolls', from:'Boss’ Ammo Runt' }
      ],
      kw:['Character','Faction: Orks','Grenades','Infantry','Warboss','Warlord'],
      why:{ kw:{ Warlord:'Warlord' } }
    },
    {
      id:'mek-tankbustas', ds:['orks/mek','orks/tankbustas'], role:'Character', pts:215, copies:2, ptsNote:'55 + Tankbustas 160',
      leads:'Tankbustas', support:true,
      models:['1× Mek','1× Nob','1× Tankbusta w/ Two Busta Rokkit Launchas','4× Tankbusta w/ Busta Rokkit Launcha'],
      gear:[['Kustom Mega-slugga','Mek’s Toolz'],['Choppa','Rokkit pistol','Rokkit pistol'],['Busta Rokkit Launcha','Busta Rokkit Launcha','Gitstikka'],['Busta Rokkit Launcha','Gitstikka']],
      stats:[
        { name:'Mek' },
        { name:'Nob' },
        { name:'Tankbusta ×5' }
      ],
      ranged:[
        { name:'Kustom Mega-slugga', who:'Mek', kw:['CLOSE-QUARTERS','HAZARDOUS','IGNORES COVER','ASSAULT'], from:{ 'IGNORES COVER':'Kustom Dakka', ASSAULT:'Dakka! Dakka! Dakka!' } },
        { name:'Rokkit pistol', who:'Tankbustas', n:2, kw:['CLOSE-QUARTERS','ASSAULT','IGNORES COVER'], from:{ ASSAULT:'Dakka! Dakka! Dakka!', 'IGNORES COVER':'Kustom Dakka' } },
        { name:'Hunter', who:'Tankbustas', n:6, kw:['ASSAULT','IGNORES COVER'], from:{ ASSAULT:'Dakka! Dakka! Dakka!', 'IGNORES COVER':'Kustom Dakka' } },
        { name:'Standard', who:'Tankbustas', n:6, kw:['ASSAULT','IGNORES COVER'], from:{ ASSAULT:'Dakka! Dakka! Dakka!', 'IGNORES COVER':'Kustom Dakka' } }
      ],
      melee:[
        { name:'Mek’s Toolz', who:'Mek' },
        { name:'Choppa', who:'Tankbustas' },
        { name:'Gitstikka', who:'Tankbustas', n:5 }
      ],
      abilities:[
        { name:'Clever Know-wotz', who:'Mek' },
        { name:'Kustom Dakka', who:'Mek' },
        { name:'Rokkit Barrage', who:'Tankbustas' },
        { name:'Bomb Squig', who:'Tankbustas' }
      ],
      aura:[
        { kind:'all', needs:{ all:['Faction: Orks','Vehicle'], none:['Aircraft','Titanic'] }, when:'Picked by a Mek’s Clever Know-wotz', note:'that VEHICLE model’s attacks have +1 to hit rolls until the start of your next Movement phase', from:'Clever Know-wotz', calc:{ hit:1 }, oneModel:true, lasts:'round' }
      ],
      rules:['Waaagh!','Support'],
      kw:['Character','Explosives','Faction: Orks','Infantry','Mek','Tankbustas'],
      kwNote:'Tankbustas comes from the supported Tankbustas.'
    },
    {
      id:'mek-flashgitz', ds:['orks/mek','orks/flash-gitz'], role:'Character', pts:300, ptsNote:'55 + Flash Gitz 245', upgrade:'Supa-snazz Dakka',
      leads:'Flash Gitz', support:true,
      models:['1× Mek','1× Kaptin','9× Flash Gitz'],
      gear:[['Kustom Mega-slugga','Mek’s Toolz'],['Choppa','Snazzgun'],['Choppa','Snazzgun']],
      stats:[
        { name:'Mek' },
        { name:'Flash Gitz' }
      ],
      ranged:[
        { name:'Kustom Mega-slugga', who:'Mek', kw:['CLOSE-QUARTERS','HAZARDOUS','IGNORES COVER','ASSAULT'], from:{ 'IGNORES COVER':'Kustom Dakka', ASSAULT:'Dakka! Dakka! Dakka!' } },
        { name:'Cutta', who:'Flash Gitz', n:10, kw:['HAZARDOUS','MELTA 2','ASSAULT','RAPID FIRE 1','IGNORES COVER'], from:{ ASSAULT:'Dakka! Dakka! Dakka!', 'RAPID FIRE 1':'Supa-snazz Dakka', 'IGNORES COVER':'Kustom Dakka' } },
        { name:'Dakka', who:'Flash Gitz', n:10, kw:['LETHAL HITS: non-MONSTER/VEHICLE','SUSTAINED HITS 1','ASSAULT','RAPID FIRE 1','IGNORES COVER'], from:{ ASSAULT:'Dakka! Dakka! Dakka!', 'RAPID FIRE 1':'Supa-snazz Dakka', 'IGNORES COVER':'Kustom Dakka' } },
        { name:'Kill Shot', who:'Flash Gitz', n:10, kw:['HAZARDOUS','ASSAULT','RAPID FIRE 1','IGNORES COVER'], from:{ ASSAULT:'Dakka! Dakka! Dakka!', 'RAPID FIRE 1':'Supa-snazz Dakka', 'IGNORES COVER':'Kustom Dakka' } }
      ],
      melee:[
        { name:'Mek’s Toolz', who:'Mek' },
        { name:'Choppa', who:'Flash Gitz', n:10 }
      ],
      abilities:[
        { name:'Clever Know-wotz', who:'Mek' },
        { name:'Kustom Dakka', who:'Mek' },
        { name:'Finderz Keeperz', who:'Flash Gitz' },
        { name:'Supa-snazz Dakka', who:'Flash Gitz', tag:'Upgrade', text:'**FLASH GITZ** unit only. This unit’s Snazzgun weapons have **[RAPID FIRE 1]**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Your Shooting phase, this unit or the target within range of an objective', cond:'objective', note:'+1 AP', from:'Finderz Keeperz' }
      ],
      aura:[
        { kind:'all', needs:{ all:['Faction: Orks','Vehicle'], none:['Aircraft','Titanic'] }, when:'Picked by a Mek’s Clever Know-wotz', note:'that VEHICLE model’s attacks have +1 to hit rolls until the start of your next Movement phase', from:'Clever Know-wotz', calc:{ hit:1 }, oneModel:true, lasts:'round' }
      ],
      rules:['Waaagh!','Support'],
      kw:['Character','Explosives','Faction: Orks','Infantry','Mek','Flash Gitz'],
      kwNote:'Flash Gitz comes from the supported Flash Gitz.'
    },
    {
      id:'gretchin', ds:'orks/gretchin', pts:45, copies:3,
      models:['10× Gretchin'],
      gear:[['Grot Blasta','Scavenged Shivs']],
      stats:[
        { name:'Gretchin ×10' }
      ],
      ranged:[
        { name:'Grot Blasta', n:10, kw:['CLOSE-QUARTERS','ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } }
      ],
      melee:[
        { name:'Scavenged Shivs', n:10 }
      ]
    },
    {
      id:'deffkoptas', ds:'orks/deffkoptas', pts:85,
      models:['3× Deffkopta'],
      gear:[['Choppa','Rokkit Launcha','Slugga','Spinnin’ Blades']],
      stats:[
        { name:'Deffkoptas ×3' }
      ],
      ranged:[
        { name:'Busta', n:3 },
        { name:'Blasta', n:3 },
        { name:'Slugga', n:3 }
      ],
      melee:[
        { name:'Choppa', n:3 },
        { name:'Spinnin’ Blades', n:3 }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Your Shooting phase, after an ingress move this turn', note:'+1 to hit rolls', from:'Deff from Above' }
      ]
    },
    {
      id:'killa-kans', ds:'orks/killa-kans', pts:275,
      models:['6× Killa Kan'],
      gear:[['Kan Blasta','Kan Klaw']],
      stats:[
        { name:'Killa Kan ×6' }
      ],
      ranged:[
        { name:'Kill Shot', n:6 },
        { name:'Point Blank', n:6 },
        { name:'Dakka', n:6 }
      ],
      melee:[
        { name:'Kan Klaw', n:6 }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'vs units with no T 7+ models', note:'+1 to hit rolls', from:'Spiteful Power Trip', always:true, vs:{ maxT:6 } }
      ]
    }
  ]
},
{
  id:'melee', name:'Melee', faction:'orks', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Purge the Foe',
  detachments:['war-horde'],
  source:'New Recruit, exported 20 Oct 2026',
  units:[
    {
      id:'ghazghkull-thraka', ds:'orks/ghazghkull-thraka', pts:290, warlord:true,
      models:['1× Ghazghkull Thraka'],
      gear:[['Adamantine ’Eadbutt','Gork’s Klaw','Mork’s Roar']],
      melee:[
        { name:'Adamantine ’Eadbutt', kw:['DEVASTATING WOUNDS','EXTRA ATTACKS','PRECISION','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Gork’s Klaw', kw:['CLEAVE 2','DEVASTATING WOUNDS','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } }
      ],
      aura:[
        { kind:'melee', needs:{ all:['Faction: Orks'] }, when:'Within 6" of Ghazghkull', selfWhen:'Own aura', note:'+1 to hit, +1 to wound', from:'Prophet of Da Great Waaagh!', selfAlways:true }
      ],
      kw:['Character','Epic Hero','Explosives','Faction: Orks','Ghazghkull Thraka','Infantry','Warboss','Warlord'],
      why:{ kw:{ Warlord:'Warlord' } }
    },
    {
      id:'mozrog-skragbad', ds:'orks/mozrog-skragbad', pts:170,
      models:['1× Mozrog Skragbad'],
      gear:[['Big Chompa’s Jaws','Gutrippa','Thump Gun']],
      melee:[
        { name:'Big Chompa’s Jaws', kw:['ANTI-MONSTER/VEHICLE 3+','EXTRA ATTACKS','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Hunter', kw:['LETHAL HITS','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Standard', kw:['CLEAVE 1','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'vs MONSTER/VEHICLE', note:'can re-roll wound rolls', from:'Da Bigger Dey Iz…', always:true, vs:{ any:['Monster','Vehicle'] } }
      ]
    },
    {
      id:'nazdreg-meganobz', ds:['orks/nazdreg','orks/meganobz'], role:'Epic Hero', pts:365, ptsNote:'165 + Meganobz 200',
      leads:'Meganobz',
      models:['1× Nazdreg','5× Meganob w/ Twin Killsaw'],
      gear:[['Kustom Blasta X','Moonchewa'],['Twin Killsaw']],
      stats:[
        { name:'Nazdreg' },
        { name:'Meganob ×5' }
      ],
      ranged:[
        { name:'Skorcha', who:'Nazdreg', kw:['BLAST 1','TORRENT','IGNORES COVER'], from:{ 'IGNORES COVER':'Nazdreg’s Know-wotz' } },
        { name:'Gatler', who:'Nazdreg', kw:['HAZARDOUS','IGNORES COVER'], from:{ 'IGNORES COVER':'Nazdreg’s Know-wotz' } },
        { name:'Shoota', who:'Nazdreg', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 2','IGNORES COVER'], from:{ 'IGNORES COVER':'Nazdreg’s Know-wotz' } }
      ],
      melee:[
        { name:'Kustom Blasta X', who:'Nazdreg', kw:['CLEAVE 1','EXTRA ATTACKS','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Moonchewa', who:'Nazdreg', kw:['CLEAVE 1','TWIN-LINKED','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Twin Killsaw', who:'Meganobz', n:5, kw:['TWIN-LINKED','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } }
      ],
      abilities:[
        { name:'Nazdreg’s Know-wotz', who:'Nazdreg' },
        { name:'Supreme Kunnin’', who:'Nazdreg' },
        { name:'Intimidating Motivation', who:'Nazdreg' },
        { name:'Krumpin’ Time', who:'Meganobz' },
        { name:'Arrogant Invulnerability', who:'Meganobz' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Riled up, Fight phase', cond:'riled', note:'+1 to hit rolls', from:'Krumpin’ Time' }
      ],
      rules:['Waaagh!','Leader','Da Boss','Deep Strike'],
      kw:['Character','Epic Hero','Faction: Orks','Infantry','Mega Armour','Nazdreg','Warboss','Explosives','Meganobz'],
      kwNote:'Explosives, Meganobz come from the led Meganobz.'
    },
    {
      id:'beastboss-on-squigosaur-headwoppas-killchoppa', ds:'orks/beastboss-on-squigosaur', short:'Beastboss', pts:155, enhancement:'Headwoppa’s Killchoppa',
      models:['1× Beastboss on Squigosaur'],
      gear:[['Beastchoppa','Slugga','Squigosaur’s jaws','Thump Gun']],
      melee:[
        { name:'Hunter', kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Standard', kw:['CLEAVE 1','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Squigosaur’s jaws', kw:['ANTI-MONSTER/VEHICLE 3+','EXTRA ATTACKS','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } }
      ],
      abilities:[
        { name:'Thundering Stampede' },
        { name:'Boss of da Hunt' },
        { name:'Keep Huntin’!' },
        { name:'Headwoppa’s Killchoppa', tag:'Enhancement', ph:['fight'], turn:'either', text:'**ORKS** model only. If this unit made a **charge move** this turn, this model’s melee attacks have +1 AP.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Made a charge move this turn', cond:'charged', note:'+1 AP', from:'Headwoppa’s Killchoppa' }
      ]
    },
    {
      id:'big-mek-painboy-nobz', ds:['orks/big-mek','orks/painboy','orks/nobz'], role:'Character', pts:405, ptsNote:'120 + Painboy 45 + Nobz 240', enhancement:'Kunnin’ But Brutal',
      leads:'Nobz',
      also:[
        { name:'Painboy', support:true }
      ],
      models:['1× Big Mek','1× Painboy','8× Nob w/ Kustom Shoota and Kustom Krumpa','2× Nob w/ Kustom Krumpa and Paired Krumpas (Paired Krumpas)'],
      gear:[['Kustom mega-blasta','Drilla'],['’Urty syringe','Dok’s Toolz'],['Kustom Krumpa','Kustom Shoota'],['Kustom Krumpa']],
      stats:[
        { name:'Big Mek' },
        { name:'Painboy' },
        { name:'Nob ×10' }
      ],
      ranged:[
        { name:'Kustom mega-blasta', who:'Big Mek', kw:['HAZARDOUS','IGNORES COVER'], from:{ 'IGNORES COVER':'More Dakka' } },
        { name:'Kustom Shoota', who:'Nobz', n:8, kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 2','IGNORES COVER'], from:{ 'IGNORES COVER':'More Dakka' } }
      ],
      melee:[
        { name:'Drilla', who:'Big Mek', kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'’Urty syringe', who:'Painboy', kw:['ANTI-INFANTRY 4+','DEVASTATING WOUNDS: INFANTRY','EXTRA ATTACKS','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Dok’s Toolz', who:'Painboy', kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Kustom Krumpa', who:'Nobz', n:10, kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } }
      ],
      abilities:[
        { name:'Shokk-boosta', who:'Big Mek' },
        { name:'More Dakka', who:'Big Mek' },
        { name:'Kunnin’ But Brutal', who:'Big Mek', tag:'Enhancement', ph:['movement','shooting','charge'], turn:'your', text:'**ORKS** model only. When this unit is selected to make a **fall-back move**, that fall-back move does not prevent this unit from being **eligible to shoot**/**declare a charge**.' },
        { name:'Crude Surgery', who:'Painboy' },
        { name:'Catch Dat Red Bit', who:'Painboy' },
        { name:'Ammo Runts', who:'Nobz' },
        { name:'Get Out da Way!', who:'Nobz' },
        { name:'Paired Krumpas', who:'Nobz' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Riled up', cond:'riled', note:'[SUSTAINED HITS 1]', from:'More Dakka' },
        { kind:'ranged', when:'Ammo Runts used (your Shooting phase, when selected to shoot)', note:'+1 to hit rolls', from:'Ammo Runts' },
        { kind:'melee', weapon:'Kustom Krumpa', when:'Kustom Krumpa of a Nob w/ Paired Krumpas', note:'can re-roll hit rolls and wound rolls', from:'Paired Krumpas', always:true }
      ],
      rules:['Waaagh!','Leader','Support'],
      kw:['Big Mek','Character','Explosives','Faction: Orks','Infantry','Painboy','Nobz'],
      kwNote:'Painboy, Nobz come from the combined unit.'
    },
    {
      id:'big-mek-in-mega-armour-meganobz', ds:['orks/big-mek-in-mega-armour','orks/meganobz'], pts:310, ptsNote:'110 + Meganobz 200', enhancement:'Follow Me Ladz',
      leads:'Meganobz',
      models:['1× Big Mek in Mega Armour (Kustom Force Field)','5× Meganob w/ Twin Killsaw'],
      gear:[['Kustom Mega-blasta','Power Klaw'],['Twin Killsaw']],
      stats:[
        { name:'Big Mek in Mega Armour', M:'7"', InSv:'4+*', from:{ M:'Follow Me Ladz' }, why:{ InSv:'Kustom Force Field' } },
        { name:'Meganob ×5', M:'7"', InSv:'4+*', from:{ M:'Follow Me Ladz' }, why:{ InSv:'Kustom Force Field' } }
      ],
      ranged:[
        { name:'Kustom Mega-blasta', who:'Big Mek in Mega Armour', kw:['HAZARDOUS','IGNORES COVER'], from:{ 'IGNORES COVER':'More Dakka' } }
      ],
      melee:[
        { name:'Power Klaw', who:'Big Mek in Mega Armour', kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Twin Killsaw', who:'Meganobz', n:5, kw:['TWIN-LINKED','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } }
      ],
      abilities:[
        { name:'Fix Dat Armour Up', who:'Big Mek in Mega Armour' },
        { name:'More Dakka', who:'Big Mek in Mega Armour' },
        { name:'Follow Me Ladz', who:'Big Mek in Mega Armour', tag:'Enhancement', text:'**ORKS** model only. This unit has +2" **M**.' },
        { name:'Kustom Force Field', who:'Big Mek in Mega Armour' },
        { name:'Krumpin’ Time', who:'Meganobz' },
        { name:'Arrogant Invulnerability', who:'Meganobz' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Riled up', cond:'riled', note:'[SUSTAINED HITS 1]', from:'More Dakka' },
        { kind:'melee', when:'Riled up, Fight phase', cond:'riled', note:'+1 to hit rolls', from:'Krumpin’ Time' }
      ],
      kw:['Big Mek','Big Mek in Mega Armour','Character','Explosives','Faction: Orks','Infantry','Mega Armour','Meganobz'],
      kwNote:'Meganobz comes from the led Meganobz.'
    },
    {
      id:'gretchin', ds:'orks/gretchin', pts:45, copies:2,
      models:['10× Gretchin'],
      gear:[['Grot Blasta','Scavenged Shivs']],
      stats:[
        { name:'Gretchin ×10' }
      ],
      ranged:[
        { name:'Grot Blasta', n:10 }
      ],
      melee:[
        { name:'Scavenged Shivs', n:10, kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } }
      ]
    },
    {
      id:'deffkoptas', ds:'orks/deffkoptas', pts:85,
      models:['2× Deffkopta','1× Deffkopta w/ Kustom mega-blasta'],
      gear:[['Choppa','Rokkit Launcha','Slugga','Spinnin’ Blades'],['Choppa','Kustom Mega-blasta','Slugga','Spinnin’ Blades']],
      stats:[
        { name:'Deffkoptas ×3' }
      ],
      ranged:[
        { name:'Busta', n:2 },
        { name:'Blasta', n:2 },
        { name:'Slugga', n:3 },
        { name:'Kustom Mega-blasta' }
      ],
      melee:[
        { name:'Choppa', n:3, kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Spinnin’ Blades', n:3, kw:['CLEAVE 1','HAZARDOUS','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Your Shooting phase, after an ingress move this turn', note:'+1 to hit rolls', from:'Deff from Above' }
      ]
    },
    {
      id:'squighog-boyz', ds:'orks/squighog-boyz', pts:130,
      models:['1× Nob on Smasha Squig','3× Squighog Boy'],
      gear:[['Big Choppa','Slugga','Squig Jaws'],['Saddlegit’s Shiv','Squig Jaws','Stikka']],
      stats:[
        { name:'Nob on Smasha Squig' },
        { name:'Squighog Boyz ×3' }
      ],
      ranged:[
        { name:'Slugga' },
        { name:'Saddlegit’s Shiv', n:3 },
        { name:'Stikka', n:3 }
      ],
      melee:[
        { name:'Big Choppa', kw:['ANTI-MONSTER/VEHICLE 4+','CLEAVE 2','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Squig Jaws', n:4, kw:['EXTRA ATTACKS','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Stikka', n:3, kw:['ANTI-MONSTER/VEHICLE 4+','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Made a charge move this turn', cond:'charged', note:'+1 D', from:'Brutal Impact' }
      ]
    }
  ]
},
{
  id:'princes', name:'Princes', faction:'world-eaters', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Purge the Foe',
  detachments:['berzerker-warband','vessels-of-wrath'],
  source:'New Recruit, exported 20 Oct 2026',
  units:[
    {
      id:'kh-rn-the-betrayer-khorne-berzerkers', ds:['world-eaters/kharn-the-betrayer','world-eaters/khorne-berzerkers'], role:'Epic Hero', pts:285, ptsNote:'115 + Khorne Berzerkers 170',
      leads:'Khorne Berzerkers',
      models:['1× Khârn the Betrayer','1× Khorne Berzerker Champion (Icon of Khorne)','7× Khorne Berzerker','2× Khorne Berzerker w/ eviscerator and plasma pistol'],
      gear:[['Gorechild','Plasma pistol'],['Chainblade','Plasma pistol'],['Bolt pistol','Chainblade'],['Khornate eviscerator','Plasma pistol']],
      stats:[
        { name:'Khârn the Betrayer' },
        { name:'Khorne Berzerker ×10' }
      ],
      ranged:[
        { name:'standard', who:'Khârn the Betrayer' },
        { name:'supercharge', who:'Khârn the Betrayer' },
        { name:'standard', who:'Khorne Berzerkers', n:3 },
        { name:'supercharge', who:'Khorne Berzerkers', n:3 },
        { name:'Bolt pistol', who:'Khorne Berzerkers', n:7 }
      ],
      melee:[
        { name:'Gorechild', who:'Khârn the Betrayer', A:'9', from:{ A:'Relentless Rage' } },
        { name:'Chainblade', who:'Khorne Berzerkers', n:8, A:'5', from:{ A:'Relentless Rage' } },
        { name:'Khornate eviscerator', who:'Khorne Berzerkers', n:2, A:'4', from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Legendary Killer', who:'Khârn the Betrayer' },
        { name:'The Betrayer', who:'Khârn the Betrayer' },
        { name:'Berserker Frenzy', who:'Khârn the Betrayer' },
        { name:'Blood Surge', who:'Khorne Berzerkers' },
        { name:'Murderous Charge', who:'Khorne Berzerkers' },
        { name:'Icon of Khorne', who:'Khorne Berzerkers' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        // "that unit" is the unit Khârn leads; he leads it for the whole battle
        { kind:'melee', when:'While Khârn leads this unit', note:'re-roll hit rolls of 1 and wound rolls of 1', from:'Legendary Killer', always:true },
        { kind:'melee', when:'Made a charge move this turn', cond:'charged', note:'+1 S', from:'Murderous Charge' }
      ],
      rules:['Leader','Blessings of Khorne','Pistol','Hazardous'],
      kw:['Chaos','Character','Epic Hero','Faction: World Eaters','Grenades','Infantry','Khorne','Khârn the Betrayer','Battleline','Berzerkers'],
      kwNote:'Battleline, Berzerkers come from the led Khorne Berzerkers.'
    },
    {
      id:'daemon-prince-of-khorne-helm-of-brazen-ire', ds:'world-eaters/daemon-prince-of-khorne', short:'Daemon Prince', pts:230, enhancement:'Helm of Brazen Ire', warlord:true,
      models:['1× Daemon Prince of Khorne'],
      gear:[['Hellforged weapons','Infernal cannon']],
      melee:[
        { name:'strike', A:'9', from:{ A:'Relentless Rage' } },
        { name:'sweep', A:'17', from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Lord of Murder' },
        { name:'Devastating Assault' },
        { name:'Direct the Slaughter' },
        { name:'Helm of Brazen Ire', tag:'Enhancement', def:'-1 D to each attack allocated to this model', text:'**WORLD EATERS** model only. Each time an attack is allocated to the bearer, subtract 1 from the Damage characteristic of that attack.', defOf:'385eacd0' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Made a charge move this turn', cond:'charged', note:'Hellforged weapons have [DEVASTATING WOUNDS] until the end of the turn', from:'Devastating Assault' }
      ],
      kw:['Chaos','Character','Daemon','Daemon Prince','Faction: World Eaters','Khorne','Monster','Warlord'],
      why:{ kw:{ Warlord:'Warlord' } }
    },
    {
      id:'daemon-prince-of-khorne-berzerker-glaive', ds:'world-eaters/daemon-prince-of-khorne', short:'Daemon Prince', pts:235, enhancement:'Berzerker Glaive',
      models:['1× Daemon Prince of Khorne'],
      gear:[['Hellforged weapons','Infernal cannon']],
      melee:[
        { name:'strike', A:'10', D:'4', from:{ A:['Berzerker Glaive','Relentless Rage'], D:'Berzerker Glaive' } },
        { name:'sweep', A:'18', D:'2', from:{ A:['Berzerker Glaive','Relentless Rage'], D:'Berzerker Glaive' } }
      ],
      abilities:[
        { name:'Lord of Murder' },
        { name:'Devastating Assault' },
        { name:'Direct the Slaughter' },
        { name:'Berzerker Glaive', tag:'Enhancement', text:'**WORLD EATERS** model only. Add 1 to the Attacks and Damage characteristics of melee weapons (excluding Extra Attacks weapons) equipped by the bearer.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Made a charge move this turn', cond:'charged', note:'Hellforged weapons have [DEVASTATING WOUNDS] until the end of the turn', from:'Devastating Assault' }
      ]
    },
    {
      id:'lord-on-juggernaut-khorne-berzerkers', ds:['world-eaters/lord-on-juggernaut','world-eaters/khorne-berzerkers'], pts:455, ptsNote:'125 + Khorne Berzerkers 330', enhancement:'Archslaughterer',
      leads:'Khorne Berzerkers',
      models:['1× Lord on Juggernaut','1× Khorne Berzerker Champion','15× Khorne Berzerker','3× Khorne Berzerker w/ eviscerator and plasma pistol','1× Khorne Berzerker w/ eviscerator and plasma pistol (Icon of Khorne)'],
      gear:[['Bladed horn','Exalted chainblade','Plasma pistol'],['Chainblade','Plasma pistol'],['Bolt pistol','Chainblade'],['Khornate eviscerator','Plasma pistol'],['Khornate eviscerator','Plasma pistol']],
      stats:[
        { name:'Lord on Juggernaut' },
        { name:'Khorne Berzerker ×20', M:'10"', from:{ M:'Aggressive Advance' } }
      ],
      ranged:[
        { name:'standard', who:'Lord on Juggernaut' },
        { name:'supercharge', who:'Lord on Juggernaut' },
        { name:'standard', who:'Khorne Berzerkers', n:5 },
        { name:'supercharge', who:'Khorne Berzerkers', n:5 },
        { name:'Bolt pistol', who:'Khorne Berzerkers', n:15 }
      ],
      melee:[
        { name:'Bladed horn', who:'Lord on Juggernaut', A:'5', from:{ A:'Relentless Rage' } },
        { name:'Exalted chainblade', who:'Lord on Juggernaut', A:'8', from:{ A:'Relentless Rage' } },
        { name:'Chainblade', who:'Khorne Berzerkers', n:16, A:'5', from:{ A:'Relentless Rage' } },
        { name:'Khornate eviscerator', who:'Khorne Berzerkers', n:4, A:'4', from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Aggressive Advance', who:'Lord on Juggernaut' },
        { name:'Crush All Who Stand Before Us', who:'Lord on Juggernaut' },
        { name:'Archslaughterer', who:'Lord on Juggernaut', tag:'Enhancement · Once per battle, per army', ph:['command'], turn:'your', text:'**WORLD EATERS** model only. (Once per battle, per army) In your Command phase, you can use this ability. If you do, every **Blessing of Khorne** is active for this unit until the start of your next turn.' },
        { name:'Blood Surge', who:'Khorne Berzerkers' },
        { name:'Murderous Charge', who:'Khorne Berzerkers' },
        { name:'Icon of Khorne', who:'Khorne Berzerkers' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Made a charge move this turn', cond:'charged', note:'+1 S', from:'Murderous Charge' }
      ],
      kw:['Chaos','Character','Faction: World Eaters','Khorne','Lord on Juggernaut','Mounted','Battleline','Berzerkers','Grenades','Infantry'],
      kwNote:'Battleline, Berzerkers, Grenades, Infantry come from the led Khorne Berzerkers.'
    },
    {
      id:'slaughterbound-exalted-eightbound', ds:['world-eaters/slaughterbound','world-eaters/exalted-eightbound'], pts:240, ptsNote:'110 + Exalted Eightbound 130', enhancement:'Battle-lust',
      leads:'Exalted Eightbound',
      models:['1× Slaughterbound','1× Exalted Eightbound Champion','2× Exalted Eightbound'],
      gear:[['Lacerator and daemonic claw'],['Chainblades'],['Chainblades']],
      stats:[
        { name:'Slaughterbound' },
        { name:'Exalted Eightbound ×3' }
      ],
      melee:[
        { name:'Lacerator and daemonic claw', who:'Slaughterbound', A:'7', from:{ A:'Relentless Rage' } },
        { name:'Chainblades', who:'Exalted Eightbound', n:3, A:'5', from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Rage Eternal', who:'Slaughterbound' },
        { name:'Possessed Lord', who:'Slaughterbound' },
        { name:'Lord of the Eightbound', who:'Slaughterbound' },
        { name:'Battle-lust', who:'Slaughterbound', tag:'Enhancement', ph:['charge'], turn:'either', text:'**WORLD EATERS** model only. You can re-roll **Charge rolls** made for the bearer’s unit. In addition, while the Unbridled Bloodlust Blessing of Khorne is active for your army, add 1 to Charge rolls made for the bearer’s unit.' },
        { name:'Rend and Tear', who:'Exalted Eightbound' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', weapon:'Lacerator and daemonic claw', set:{ A:'10' }, when:'Possessed Lord (once per battle, start of the Fight phase)', note:'and [DEVASTATING WOUNDS] until the end of the phase', from:'Possessed Lord' },
        // "this unit" is the whole attached unit, the Slaughterbound included
        { kind:'melee', when:'vs MONSTER/VEHICLE', note:'+1 D', from:'Rend and Tear', always:true, vs:{ any:['Monster','Vehicle'] } }
      ],
      rules:['Leader','Deadly Demise D3','Blessings of Khorne','Deep Strike','Scouts 6"','Anti'],
      kw:['Chaos','Character','Daemon','Faction: World Eaters','Infantry','Khorne','Possessed','Slaughterbound','Exalted Eightbound'],
      kwNote:'Exalted Eightbound comes from the led Exalted Eightbound.',
      // only the Slaughterbound model has Scouts 6" (Lord of the Eightbound); its Exalted Eightbound don't, so the unit can't scout (24.31)
      partialRules:{ 'Scouts 6"':'Slaughterbound' }
    },
    {
      id:'chaos-rhino', ds:'world-eaters/chaos-rhino', pts:75,
      models:['1× Chaos Rhino'],
      gear:[['Armoured tracks','Combi-bolter']],
      melee:[
        { name:'Armoured tracks', A:'7', from:{ A:'Relentless Rage' } }
      ]
    },
    {
      id:'eightbound', ds:'world-eaters/eightbound', pts:125,
      models:['1× Eightbound Champion','2× Eightbound'],
      gear:[['Chainblades'],['Chainblades']],
      melee:[
        { name:'Chainblades', n:3, A:'6', from:{ A:'Relentless Rage' } }
      ],
      aura:[
        { kind:'melee', needs:{ all:['Faction: World Eaters'] }, when:'Within 6" of Eightbound, vs non-MONSTER/VEHICLE targets', selfWhen:'Own aura, vs non-MONSTER/VEHICLE targets', note:'+1 to hit', from:'Beacons of Rage', selfAlways:true, vs:{ none:['Monster','Vehicle'] }, calc:{ hit:1 } },
        { kind:'melee', needs:{ all:['Faction: World Eaters'] }, when:'Within 6" of Eightbound, target Below Half-strength, vs non-MONSTER/VEHICLE targets', selfWhen:'Own aura, target Below Half-strength, vs non-MONSTER/VEHICLE targets', note:'+1 to wound rolls', from:'Beacons of Rage', vs:{ none:['Monster','Vehicle'] }, calc:{ wound:1 } }
      ]
    },
    {
      id:'jakhals', ds:'world-eaters/jakhals', pts:65,
      models:['1× Jakhal Pack Leader','1× Dishonoured w/ paired manglers','8× Jakhal'],
      gear:[['Autopistol','Chainblades'],['Paired manglers'],['Autopistol','Chainblades']],
      ranged:[
        { name:'Autopistol', n:9 }
      ],
      melee:[
        { name:'Chainblades', n:9, A:'4', from:{ A:'Relentless Rage' } },
        { name:'Paired manglers', A:'5', from:{ A:'Relentless Rage' } }
      ]
    },
    {
      id:'forgefiend', ds:'world-eaters/forgefiend', pts:145, copies:2,
      models:['1× Forgefiend'],
      gear:[['Hades autocannon','Hades autocannon','Ectoplasma cannon','Forgefiend claws']],
      ranged:[
        { name:'Hades autocannon', n:2 },
        { name:'Ectoplasma cannon' }
      ],
      melee:[
        { name:'Forgefiend claws', A:'7', from:{ A:'Relentless Rage' } }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target is the closest eligible target within 18"', cond:'closest18', note:'re-roll the hit roll', from:'Furious Onslaught' },
        { kind:'all', when:'Damaged (1-4 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-4 wounds remaining' }
      ]
    }
  ]
},
{
  id:'standard', name:'Standard', faction:'world-eaters', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Purge the Foe',
  detachments:['berzerker-warband','vessels-of-wrath'],
  source:'New Recruit, exported 20 Oct 2026',
  units:[
    {
      id:'angron', ds:'world-eaters/angron', pts:330, warlord:true,
      models:['1× Angron'],
      gear:[['Samni’arius and Spinegrinder']],
      melee:[
        { name:'strike', A:'9', from:{ A:'Relentless Rage' } },
        { name:'sweep', A:'17', from:{ A:'Relentless Rage' } }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Damaged (1-6 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-6 wounds remaining' }
      ],
      aura:[
        { kind:'melee', needs:{ all:['Faction: World Eaters'] }, when:'Within 6" of Angron, if he has Driven by Ultimate Rage this round', selfWhen:'Own aura, if he has Driven by Ultimate Rage this round', note:'re-roll hit rolls of 1 and wound rolls of 1', from:'Driven by Ultimate Rage' }
      ],
      kw:['Angron','Chaos','Character','Daemon','Epic Hero','Faction: World Eaters','Fly','Khorne','Monster','Primarch','Warlord'],
      why:{ kw:{ Warlord:'Warlord' } }
    },
    {
      id:'kh-rn-the-betrayer-khorne-berzerkers', ds:['world-eaters/kharn-the-betrayer','world-eaters/khorne-berzerkers'], role:'Epic Hero', pts:285, ptsNote:'115 + Khorne Berzerkers 170',
      leads:'Khorne Berzerkers',
      models:['1× Khârn the Betrayer','1× Khorne Berzerker Champion (Icon of Khorne)','7× Khorne Berzerker','2× Khorne Berzerker w/ eviscerator and plasma pistol'],
      gear:[['Gorechild','Plasma pistol'],['Chainblade','Plasma pistol'],['Bolt pistol','Chainblade'],['Khornate eviscerator','Plasma pistol']],
      stats:[
        { name:'Khârn the Betrayer' },
        { name:'Khorne Berzerker ×10' }
      ],
      ranged:[
        { name:'standard', who:'Khârn the Betrayer' },
        { name:'supercharge', who:'Khârn the Betrayer' },
        { name:'standard', who:'Khorne Berzerkers', n:3 },
        { name:'supercharge', who:'Khorne Berzerkers', n:3 },
        { name:'Bolt pistol', who:'Khorne Berzerkers', n:7 }
      ],
      melee:[
        { name:'Gorechild', who:'Khârn the Betrayer', A:'9', from:{ A:'Relentless Rage' } },
        { name:'Chainblade', who:'Khorne Berzerkers', n:8, A:'5', from:{ A:'Relentless Rage' } },
        { name:'Khornate eviscerator', who:'Khorne Berzerkers', n:2, A:'4', from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Legendary Killer', who:'Khârn the Betrayer' },
        { name:'The Betrayer', who:'Khârn the Betrayer' },
        { name:'Berserker Frenzy', who:'Khârn the Betrayer' },
        { name:'Blood Surge', who:'Khorne Berzerkers' },
        { name:'Murderous Charge', who:'Khorne Berzerkers' },
        { name:'Icon of Khorne', who:'Khorne Berzerkers' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        // "that unit" is the unit Khârn leads; he leads it for the whole battle
        { kind:'melee', when:'While Khârn leads this unit', note:'re-roll hit rolls of 1 and wound rolls of 1', from:'Legendary Killer', always:true },
        { kind:'melee', when:'Made a charge move this turn', cond:'charged', note:'+1 S', from:'Murderous Charge' }
      ],
      rules:['Leader','Blessings of Khorne','Pistol','Hazardous'],
      kw:['Chaos','Character','Epic Hero','Faction: World Eaters','Grenades','Infantry','Khorne','Khârn the Betrayer','Battleline','Berzerkers'],
      kwNote:'Battleline, Berzerkers come from the led Khorne Berzerkers.'
    },
    {
      id:'lord-on-juggernaut', ds:'world-eaters/lord-on-juggernaut', pts:95,
      models:['1× Lord on Juggernaut'],
      gear:[['Bladed horn','Exalted chainblade','Plasma pistol']],
      melee:[
        { name:'Bladed horn', A:'5', from:{ A:'Relentless Rage' } },
        { name:'Exalted chainblade', A:'8', from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Aggressive Advance', na:'Not leading a unit in this list' },
        { name:'Crush All Who Stand Before Us' }
      ]
    },
    {
      id:'slaughterbound', ds:'world-eaters/slaughterbound', pts:90,
      models:['1× Slaughterbound'],
      gear:[['Lacerator and daemonic claw']],
      melee:[
        { name:'Lacerator and daemonic claw', A:'7', from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Rage Eternal', na:'Not leading a unit in this list' },
        { name:'Possessed Lord' },
        { name:'Lord of the Eightbound' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', weapon:'Lacerator and daemonic claw', set:{ A:'10' }, when:'Possessed Lord (once per battle, start of the Fight phase)', note:'and [DEVASTATING WOUNDS] until the end of the phase', from:'Possessed Lord' }
      ]
    },
    {
      id:'slaughterbound-exalted-eightbound', ds:['world-eaters/slaughterbound','world-eaters/exalted-eightbound'], pts:255, ptsNote:'125 + Exalted Eightbound 130', enhancement:'Berzerker Glaive',
      leads:'Exalted Eightbound',
      models:['1× Slaughterbound','1× Exalted Eightbound Champion','2× Exalted Eightbound'],
      gear:[['Lacerator and daemonic claw'],['Chainblades'],['Chainblades']],
      stats:[
        { name:'Slaughterbound' },
        { name:'Exalted Eightbound ×3' }
      ],
      melee:[
        { name:'Lacerator and daemonic claw', who:'Slaughterbound', A:'8', D:'3', from:{ A:['Berzerker Glaive','Relentless Rage'], D:'Berzerker Glaive' } },
        { name:'Chainblades', who:'Exalted Eightbound', n:3, A:'5', from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Rage Eternal', who:'Slaughterbound' },
        { name:'Possessed Lord', who:'Slaughterbound' },
        { name:'Lord of the Eightbound', who:'Slaughterbound' },
        { name:'Berzerker Glaive', who:'Slaughterbound', tag:'Enhancement', text:'**WORLD EATERS** model only. Add 1 to the Attacks and Damage characteristics of melee weapons (excluding Extra Attacks weapons) equipped by the bearer.' },
        { name:'Rend and Tear', who:'Exalted Eightbound' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', weapon:'Lacerator and daemonic claw', set:{ A:'11' }, when:'Possessed Lord (once per battle, start of the Fight phase)', note:'and [DEVASTATING WOUNDS] until the end of the phase', from:'Possessed Lord' },
        // "this unit" is the whole attached unit, the Slaughterbound included
        { kind:'melee', when:'vs MONSTER/VEHICLE', note:'+1 D', from:'Rend and Tear', always:true, vs:{ any:['Monster','Vehicle'] } }
      ],
      rules:['Leader','Deadly Demise D3','Blessings of Khorne','Deep Strike','Scouts 6"','Anti'],
      kw:['Chaos','Character','Daemon','Faction: World Eaters','Infantry','Khorne','Possessed','Slaughterbound','Exalted Eightbound'],
      kwNote:'Exalted Eightbound comes from the led Exalted Eightbound.',
      // only the Slaughterbound model has Scouts 6" (Lord of the Eightbound); its Exalted Eightbound don't, so the unit can't scout (24.31)
      partialRules:{ 'Scouts 6"':'Slaughterbound' }
    },
    {
      id:'chaos-rhino', ds:'world-eaters/chaos-rhino', pts:75,
      models:['1× Chaos Rhino'],
      gear:[['Armoured tracks','Combi-bolter']],
      melee:[
        { name:'Armoured tracks', A:'7', from:{ A:'Relentless Rage' } }
      ]
    },
    {
      id:'eightbound', ds:'world-eaters/eightbound', pts:125, copies:2,
      models:['1× Eightbound Champion','2× Eightbound'],
      gear:[['Chainblades'],['Chainblades']],
      melee:[
        { name:'Chainblades', n:3, A:'6', from:{ A:'Relentless Rage' } }
      ],
      aura:[
        { kind:'melee', needs:{ all:['Faction: World Eaters'] }, when:'Within 6" of Eightbound, vs non-MONSTER/VEHICLE targets', selfWhen:'Own aura, vs non-MONSTER/VEHICLE targets', note:'+1 to hit', from:'Beacons of Rage', selfAlways:true, vs:{ none:['Monster','Vehicle'] }, calc:{ hit:1 } },
        { kind:'melee', needs:{ all:['Faction: World Eaters'] }, when:'Within 6" of Eightbound, target Below Half-strength, vs non-MONSTER/VEHICLE targets', selfWhen:'Own aura, target Below Half-strength, vs non-MONSTER/VEHICLE targets', note:'+1 to wound rolls', from:'Beacons of Rage', vs:{ none:['Monster','Vehicle'] }, calc:{ wound:1 } }
      ]
    },
    {
      id:'exalted-eightbound', ds:'world-eaters/exalted-eightbound', pts:130,
      models:['1× Exalted Eightbound Champion','2× Exalted Eightbound'],
      gear:[['Chainblades'],['Chainblades']],
      melee:[
        { name:'Chainblades', n:3, A:'5', from:{ A:'Relentless Rage' } }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'vs MONSTER/VEHICLE', note:'+1 D', from:'Rend and Tear', always:true, vs:{ any:['Monster','Vehicle'] } }
      ]
    },
    {
      id:'goremongers', ds:'world-eaters/goremongers', pts:70,
      models:['1× Blood Herald','7× Goremonger w/ chainblade'],
      gear:[['Autopistol','Chainblade','Close combat weapon'],['Autopistol','Chainblade','Close combat weapon']],
      ranged:[
        { name:'Autopistol', n:8 }
      ],
      melee:[
        { name:'Chainblade', n:8, A:'4', from:{ A:'Relentless Rage' } },
        { name:'Close combat weapon', n:8, A:'3', from:{ A:'Relentless Rage' } }
      ]
    },
    {
      id:'jakhals', ds:'world-eaters/jakhals', pts:65, copies:2,
      models:['1× Jakhal Pack Leader','1× Dishonoured w/ paired manglers','8× Jakhal'],
      gear:[['Autopistol','Chainblades'],['Paired manglers'],['Autopistol','Chainblades']],
      ranged:[
        { name:'Autopistol', n:9 }
      ],
      melee:[
        { name:'Chainblades', n:9, A:'4', from:{ A:'Relentless Rage' } },
        { name:'Paired manglers', A:'5', from:{ A:'Relentless Rage' } }
      ]
    },
    {
      id:'forgefiend', ds:'world-eaters/forgefiend', pts:145, copies:2,
      models:['1× Forgefiend'],
      gear:[['Hades autocannon','Hades autocannon','Ectoplasma cannon','Forgefiend claws']],
      ranged:[
        { name:'Hades autocannon', n:2 },
        { name:'Ectoplasma cannon' }
      ],
      melee:[
        { name:'Forgefiend claws', A:'7', from:{ A:'Relentless Rage' } }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target is the closest eligible target within 18"', cond:'closest18', note:'re-roll the hit roll', from:'Furious Onslaught' },
        { kind:'all', when:'Damaged (1-4 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-4 wounds remaining' }
      ]
    }
  ]
},
{
  id:'pubstomper', name:'Pubstomper', faction:'thousand-sons', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Priority Assets',
  detachments:['grand-coven'],
  source:'New Recruit, exported 23 Oct 2026',
  units:[
    {
      id:'magnus-the-red', ds:'thousand-sons/magnus-the-red', pts:455, warlord:true,
      models:['1× Magnus the Red'],
      gear:[['Blade of Magnus','Gaze of Magnus','Tzeentch’s Firestorm']],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Damaged (1-6 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-6 wounds remaining' }
      ],
      kw:['Chaos','Character','Daemon','Epic Hero','Faction: Thousand Sons','Fly','Magnus the Red','Monster','Primarch','Psyker','Tzeentch','Warlord'],
      why:{ kw:{ Warlord:'Warlord' } }
    },
    {
      id:'daemon-prince-of-tzeentch-with-wings', ds:'thousand-sons/daemon-prince-of-tzeentch-with-wings', pts:205, enhancement:'Eldritch Vortex of E’taph',
      models:['1× Daemon Prince of Tzeentch with wings'],
      gear:[['Dark Blessing','Hellforged weapons','Infernal cannon']],
      ranged:[
        { name:'Dark Blessing', S:'5', D:'2', from:{ S:'Eldritch Vortex of E’taph', D:'Eldritch Vortex of E’taph' } },
        { name:'Infernal cannon' }
      ],
      melee:[
        { name:'strike', S:'9', D:'4', from:{ S:'Eldritch Vortex of E’taph', D:'Eldritch Vortex of E’taph' } },
        { name:'sweep', S:'7', D:'2', from:{ S:'Eldritch Vortex of E’taph', D:'Eldritch Vortex of E’taph' } }
      ],
      abilities:[
        { name:'Aetherstride' },
        { name:'Hunter of Souls' },
        { name:'Eldritch Vortex of E’taph', tag:'Enhancement', text:'**THOUSAND SONS** model only. Add 1 to the Strength and Damage characteristics of Psychic weapons equipped by the bearer.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'vs CHARACTER units', note:'re-roll hit rolls of 1 and wound rolls of 1', from:'Hunter of Souls', always:true, vs:{ any:['Character'] } },
        { kind:'all', when:'vs PSYKER CHARACTER units', note:'re-roll the hit roll and the wound roll', from:'Hunter of Souls', always:true, vs:{ all:['Psyker','Character'] } },
        { kind:'ranged', when:'After an aetherstride this turn', note:'Dark Blessing has [SUSTAINED HITS D3]', from:'Aetherstride', calc:{ sus:'D3', weapon:'Dark Blessing' }, lasts:'turn' }
      ]
    },
    {
      id:'exalted-sorcerer-rubric-marines', ds:['thousand-sons/exalted-sorcerer','thousand-sons/rubric-marines'], role:'Character', pts:230, ptsNote:'115 + Rubric Marines 115', enhancement:'Incandaeum',
      leads:'Rubric Marines',
      models:['1× Exalted Sorcerer','1× Aspiring Sorcerer','1× Rubric Marine w/ soulreaper cannon','3× Rubric Marine w/ warpflamer'],
      // New Recruit prints "Icon of Flame - Rubric Marines" with the abilities, on no models line; BSData has it as an
      // option of the unit for one of its Rubric Marines. Neither says which one carries it.
      unplaced:['Icon of Flame'],
      gear:[['Astral Blast','Force weapon','Inferno bolt pistol','Prosperine khopesh'],['Force weapon','Malefic Curse','Warpflame pistol'],['Close combat weapon','Soulreaper cannon'],['Close combat weapon','Warpflamer']],
      stats:[
        { name:'Exalted Sorcerer' },
        { name:'Rubric Marine', InSv:'4+', from:{ InSv:'Arcane Shield' } },
        { name:'Aspiring Sorcerer', InSv:'4+', from:{ InSv:'Arcane Shield' } }
      ],
      ranged:[
        { name:'Astral Blast', who:'Exalted Sorcerer' },
        { name:'Inferno bolt pistol', who:'Exalted Sorcerer' },
        { name:'Malefic Curse', who:'Rubric Marines', kw:['ANTI-INFANTRY 4+','DEVASTATING WOUNDS','IGNORES COVER','PSYCHIC'], from:{ 'IGNORES COVER':'Icon of Flame' } },
        { name:'Warpflame pistol', who:'Rubric Marines' },
        { name:'Soulreaper cannon', who:'Rubric Marines', kw:['DEVASTATING WOUNDS','IGNORES COVER'], from:{ 'IGNORES COVER':'Icon of Flame' } },
        { name:'Warpflamer', who:'Rubric Marines', n:3 }
      ],
      melee:[
        { name:'Force weapon', who:'Exalted Sorcerer' },
        { name:'Prosperine khopesh', who:'Exalted Sorcerer' },
        { name:'Force weapon', who:'Rubric Marines' },
        { name:'Close combat weapon', who:'Rubric Marines', n:4 }
      ],
      abilities:[
        { name:'Arcane Shield', who:'Exalted Sorcerer' },
        { name:'Rebind Rubricae', who:'Exalted Sorcerer' },
        // Incandaeum: GW’s spelling and wording (Faction Pack Rules Updates, Wahapedia); New Recruit and BSData spell it "Incandeum" (the enhancement’s nr)
        // and print it without "EXALTED SORCERER model only." and with "has" for GW's "have" (verify/deviations-nr.json)
        { name:'Incandaeum', who:'Exalted Sorcerer', tag:'Enhancement · Once per battle', ph:['shooting'], turn:'your', text:'**EXALTED SORCERER** model only. Once per battle, when selecting a **Ritual** for the bearer to attempt, you can select Doombolt, even if a model from your army have already attempted to manifest that Ritual this phase.' },
        { name:'Bringers of Change', who:'Rubric Marines' },
        { name:'Icon of Flame', who:'Rubric Marines' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Every ranged attack', note:'re-roll wound rolls of 1', from:'Bringers of Change', always:true, calc:{ rrWound:'1s' } },
        { kind:'ranged', when:'Target within range of an objective marker you do not control', cond:'targetObjectiveNotYours', note:'re-roll the wound roll', from:'Bringers of Change', calc:{ rrWound:'all' } }
      ],
      rules:['Leader','Cabal of Sorcerers','Blast','Devastating Wounds','Psychic','Pistol','Anti','Torrent','Ignores Cover'],
      kw:['Chaos','Character','Exalted Sorcerer','Faction: Thousand Sons','Grenades','Infantry','Psyker','Tzeentch','Battleline','Rubric','Rubric Marines','Rubricae'],
      kwNote:'Battleline, Rubric, Rubric Marines, Rubricae come from the led Rubric Marines.',
      partialRules:{ 'Cabal of Sorcerers':'Exalted Sorcerer and Aspiring Sorcerer' },
      // Wahapedia's Rubric Marines: "ASPIRING SORCERER ONLY: PSYKER" and "Cabal of Sorcerers (Aspiring Sorcerer only)"; BSData has
      // both on the Aspiring Sorcerer model; the Exalted Sorcerer has both on his own datasheet
      kwOnly:{ Psyker:'Exalted Sorcerer and Aspiring Sorcerer' }
    },
    {
      id:'sorcerer-in-terminator-armour-scarab-occult-terminators', ds:['thousand-sons/sorcerer-in-terminator-armour','thousand-sons/scarab-occult-terminators'], role:'Character', pts:565, ptsNote:'140 + Scarab Occult Terminators 425', enhancement:'Umbralefic Crystal',
      leads:'Scarab Occult Terminators',
      models:['1× Sorcerer in Terminator Armour','1× Scarab Occult Sorcerer','7× Scarab Occult Terminator','2× Scarab Occult Terminator w/ soulreaper cannon'],
      // New Recruit prints "Hellfyre missile rack (x2) - Scarab Occult Terminators" in the weapons table, on no models line.
      // The datasheet: "For every 5 models in this unit, 1 Scarab Occult Terminator can be equipped with 1 hellfyre missile
      // rack"; BSData: a unit option, max 2, each for one model of the "4-9 Scarab Occult Terminators" (plain or with a
      // heavy weapon). No source says which two carry them.
      unplaced:['Hellfyre missile rack'],
      gear:[['Force weapon','Gaze of Hate','Inferno combi-bolter'],['Force weapon','Malefic Curse','Inferno combi-bolter'],['Inferno combi-bolter','Prosperine khopesh'],['Prosperine khopesh','Soulreaper cannon']],
      stats:[
        { name:'Sorcerer in Terminator Armour' },
        { name:'Scarab Occult Sorcerer' },
        { name:'Scarab Occult Terminator ×9' }
      ],
      ranged:[
        { name:'Gaze of Hate', who:'Sorcerer in Terminator Armour', kw:['ANTI-MONSTER 4+','ANTI-VEHICLE 4+','DEVASTATING WOUNDS','PSYCHIC','LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Inferno combi-bolter', who:'Sorcerer in Terminator Armour', kw:['RAPID FIRE 2','LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Malefic Curse', who:'Scarab Occult Terminators', kw:['ANTI-INFANTRY 4+','DEVASTATING WOUNDS','PSYCHIC','LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Inferno combi-bolter', who:'Scarab Occult Terminators', n:8, kw:['RAPID FIRE 2','LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Soulreaper cannon', who:'Scarab Occult Terminators', n:2, kw:['DEVASTATING WOUNDS','LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Hellfyre missile rack', who:'Scarab Occult Terminators', n:2, kw:['LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } }
      ],
      melee:[
        { name:'Force weapon', who:'Sorcerer in Terminator Armour', kw:['PSYCHIC','LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Force weapon', who:'Scarab Occult Terminators', kw:['PSYCHIC','LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Prosperine khopesh', who:'Scarab Occult Terminators', n:9, kw:['LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } }
      ],
      abilities:[
        { name:'Marked by Fate', who:'Sorcerer in Terminator Armour' },
        { name:'Empyric Guidance', who:'Sorcerer in Terminator Armour' },
        { name:'Umbralefic Crystal', who:'Sorcerer in Terminator Armour', tag:'Enhancement · Once per battle, per army', ph:['command','movement'], turn:'your', text:'**THOUSAND SONS** model only. (Once per battle, per army) In your Command phase, if this unit is **unengaged**, you can use this ability. If you do:\n- Place this unit in **strategic reserves**.\n- This unit has **Deep Strike** until the start of your next Shooting phase.\n- This unit must make an **ingress move** in your next Movement phase (including in your first turn).' },
        { name:'Rites of Coalescence', who:'Scarab Occult Terminators' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Your Shooting phase, vs the enemy unit picked at its start', note:'+1 to hit rolls', from:'Marked by Fate' }
      ],
      rules:['Leader','Deep Strike','Cabal of Sorcerers','Psychic','Anti','Devastating Wounds','Rapid Fire'],
      kw:['Chaos','Character','Faction: Thousand Sons','Infantry','Psyker','Sorcerer','Terminator','Tzeentch','Rubricae','Scarab Occult'],
      kwNote:'Rubricae, Scarab Occult come from the led Scarab Occult Terminators.',
      partialRules:{ 'Cabal of Sorcerers':'Sorcerer in Terminator Armour and Scarab Occult Sorcerer' },
      // Wahapedia's Scarab Occult Terminators: "SCARAB OCCULT SORCERER ONLY: PSYKER" and "Cabal of Sorcerers (Scarab Occult Sorcerer
      // only)"; BSData has both on the Scarab Occult Sorcerer model; the Sorcerer in Terminator Armour has both on his own datasheet
      kwOnly:{ Psyker:'Sorcerer in Terminator Armour and Scarab Occult Sorcerer' }
    },
    {
      id:'tzaangors', ds:'thousand-sons/tzaangors', pts:75,
      models:['1× Twistbray','7× Tzaangor w/ Tzaangor blades','1× Tzaangor w/ Tzaangor blades (Brayhorn)','1× Tzaangor w/ Tzaangor blades (Herd banner)'],
      gear:[['Tzaangor blades'],['Tzaangor blades'],['Tzaangor blades'],['Tzaangor blades']],
      melee:[
        { name:'Tzaangor blades', n:10 }
      ]
    },
    {
      id:'tzaangor-enlightened-with-fatecaster-greatbows', ds:'thousand-sons/tzaangor-enlightened-with-fatecaster-greatbows', pts:55,
      models:['1× Aviarch','2× Enlightened'],
      gear:[['Close combat weapon','Fatecaster greatbow'],['Close combat weapon','Fatecaster greatbow']],
      ranged:[
        { name:'Fatecaster greatbow', n:3 }
      ],
      melee:[
        { name:'Close combat weapon', n:3 }
      ]
    },
    {
      id:'defiler', ds:'thousand-sons/defiler', pts:330,
      models:['1× Defiler'],
      gear:[['Ectoplasma destructor','Heavy reaper autocannon','Heavy reaper autocannon','Shearing claws','Excruciator cannon','Excruciator cannon']],
      ranged:[
        { name:'Ectoplasma destructor' },
        { name:'Excruciator cannon', n:2 },
        { name:'Heavy reaper autocannon', n:2 }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Damaged (1-6 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-6 wounds remaining' }
      ]
    },
    {
      id:'sekhetar-robots', ds:'thousand-sons/sekhetar-robots', pts:85,
      models:['2× Sekhetar Robot w/ pyreflux meltagun'],
      gear:[['Close combat weapon','Heavy warpflamer','Hellfyre missile rack','Pyreflux meltagun']],
      stats:[
        { name:'Sekhetar Robots ×2' }
      ],
      ranged:[
        { name:'Heavy warpflamer', n:2 },
        { name:'Hellfyre missile rack', n:2 },
        { name:'Pyreflux meltagun', n:2 }
      ],
      melee:[
        { name:'Close combat weapon', n:2 }
      ]
    }
  ]
},
{
  id:'nidzillas', name:'Nidzillas', faction:'tyranids', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Purge the Foe',
  detachments:['crusher-stampede','talons-of-the-norn-queen'],
  source:'New Recruit, exported 20 Oct 2026',
  units:[
    {
      id:'the-swarmlord', ds:'tyranids/the-swarmlord', pts:210,
      models:['1× The Swarmlord'],
      gear:[['Bone Sabres','Synaptic Pulse']],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' }
      ],
      aura:[
        { kind:'all', needs:{ all:['Faction: Tyranids'] }, when:'Within 9" of the Swarmlord', note:'within your army’s Synapse Range', from:'Domination of the Hive Mind' }
      ]
    },
    {
      id:'hive-tyrant', ds:'tyranids/hive-tyrant', pts:220, enhancement:'Monstrous Nemesis', warlord:true,
      models:['1× Hive Tyrant'],
      gear:[['Monstrous bonesword and lash whip','Monstrous scything talons']],
      abilities:[
        { name:'Onslaught' },
        { name:'Will of the Hive Mind' },
        { name:'Monstrous Nemesis', tag:'Enhancement', ph:['fight'], turn:'either', text:'**TYRANIDS MONSTER** model only. Each time the bearer makes a melee attack that targets a **MONSTER** or **VEHICLE** unit, add 1 to the **Wound roll**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' },
        { kind:'melee', when:'vs MONSTER/VEHICLE', note:'+1 to wound rolls', from:'Monstrous Nemesis', always:true, vs:{ any:['Monster','Vehicle'] } }
      ],
      aura:[
        { kind:'ranged', needs:{ all:['Faction: Tyranids'] }, when:'Within 6" of the Hive Tyrant', note:'ranged weapons have [ASSAULT] and [LETHAL HITS]', from:'Onslaught', selfAlways:true }
      ],
      kw:['Character','Faction: Tyranids','Great Devourer','Hive Tyrant','Monster','Psyker','Synapse','Warlord'],
      why:{ kw:{ Warlord:'Warlord' } }
    },
    {
      id:'neurogaunts', ds:'tyranids/neurogaunts', pts:45, copies:2,
      models:['1× Neurogaunt Nodebeast','10× Neurogaunt'],
      gear:[['Chitinous claws and teeth'],['Chitinous claws and teeth']],
      stats:[
        { name:'Neurogaunt Nodebeast' },
        { name:'Neurogaunt ×10' }
      ],
      melee:[
        { name:'Chitinous claws and teeth', n:11 }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' }
      ]
    },
    {
      id:'norn-assimilator-synaptoprescience', ds:'tyranids/norn-assimilator', pts:280, enhancement:'Synaptoprescience',
      models:['1× Norn Assimilator'],
      gear:[['Monstrous scything talons','Toxinjecter Harpoon']],
      stats:[
        { name:'Norn Assimilator', InSv:'4+', from:{ InSv:'Synaptoprescience' } }
      ],
      abilities:[
        { name:'Harpoon Barbs' },
        { name:'Damaged: 1-5 Wounds Remaining' },
        { name:'Singular Purpose' },
        { name:'Protean Purpose' },
        { name:'Synaptoprescience', tag:'Enhancement', text:'**NORN ASSIMILATOR** unit only. This unit has 4+ **InSv**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' },
        { kind:'all', when:'Damaged (1-5 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-5 Wounds Remaining' },
        { kind:'all', when:'If its Singular Purpose is an enemy unit, vs that unit', note:'re-roll hit rolls and wound rolls', from:'Singular Purpose', lasts:'battle' }
      ]
    },
    {
      id:'norn-assimilator-synaptoprescience-2', ds:'tyranids/norn-assimilator', pts:300, enhancement:'Synaptoprescience',
      models:['1× Norn Assimilator'],
      gear:[['Monstrous scything talons','Toxinjecter Harpoon']],
      stats:[
        { name:'Norn Assimilator', InSv:'4+', from:{ InSv:'Synaptoprescience' } }
      ],
      abilities:[
        { name:'Harpoon Barbs' },
        { name:'Damaged: 1-5 Wounds Remaining' },
        { name:'Singular Purpose' },
        { name:'Protean Purpose' },
        { name:'Synaptoprescience', tag:'Enhancement', text:'**NORN ASSIMILATOR** unit only. This unit has 4+ **InSv**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' },
        { kind:'all', when:'Damaged (1-5 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-5 Wounds Remaining' },
        { kind:'all', when:'If its Singular Purpose is an enemy unit, vs that unit', note:'re-roll hit rolls and wound rolls', from:'Singular Purpose', lasts:'battle' }
      ]
    },
    {
      id:'norn-emissary-destabilising-predation', ds:'tyranids/norn-emissary', pts:270, enhancement:'Destabilising Predation',
      models:['1× Norn Emissary'],
      gear:[['Monstrous rending claws','Monstrous scything talons','Psychic tendril']],
      ranged:[
        { name:'neuroparasite', kw:['PRECISION','PSYCHIC','ANTI-CHARACTER 2+'], from:{ 'ANTI-CHARACTER 2+':'Destabilising Predation' } },
        { name:'neurolance', kw:['MELTA 2','PSYCHIC','ANTI-CHARACTER 2+'], from:{ 'ANTI-CHARACTER 2+':'Destabilising Predation' } },
        { name:'neuroblast', kw:['BLAST','PSYCHIC','ANTI-CHARACTER 2+'], from:{ 'ANTI-CHARACTER 2+':'Destabilising Predation' } }
      ],
      abilities:[
        { name:'Singular Purpose' },
        { name:'Damaged: 1-5 Wounds Remaining' },
        { name:'Protean Purpose' },
        { name:'Destabilising Predation', tag:'Enhancement', text:'**NORN EMISSARY** unit only. This unit’s ranged attacks have **[ANTI-CHARACTER 2+]**.' },
        { name:'Unnatural Resistance' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' },
        { kind:'all', when:'Damaged (1-5 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-5 Wounds Remaining' },
        { kind:'all', when:'If its Singular Purpose is an enemy unit, vs that unit', note:'re-roll hit rolls and wound rolls', from:'Singular Purpose', lasts:'battle' }
      ],
      rules:['Deadly Demise D6','Shadow in the Warp','Synapse','Feel No Pain','Anti','Extra Attacks','Melta','Blast','Psychic'],
      why:{ rules:{ Anti:'Destabilising Predation' } }
    },
    {
      id:'norn-emissary', ds:'tyranids/norn-emissary', pts:270,
      models:['1× Norn Emissary'],
      gear:[['Monstrous rending claws','Monstrous scything talons','Psychic tendril']],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' },
        { kind:'all', when:'Damaged (1-5 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-5 Wounds Remaining' },
        { kind:'all', when:'If its Singular Purpose is an enemy unit, vs that unit', note:'re-roll hit rolls and wound rolls', from:'Singular Purpose', lasts:'battle' }
      ]
    },
    {
      id:'tyrannofex', ds:'tyranids/tyrannofex', pts:180, copies:2,
      models:['1× Tyrannofex'],
      gear:[['Powerful limbs','Stinger salvoes','Acid spray']],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' },
        { kind:'all', when:'Damaged (1-5 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-5 Wounds Remaining' }
      ]
    }
  ]
},
{
  id:'6-bigs', name:'6 bigs', faction:'imperial-knights', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Purge the Foe',
  detachments:['freeblade-company'],
  config:{ 'Code Chivalric':'Deed, Quality' },
  source:'New Recruit, exported 20 Oct 2026',
  units:[
    {
      id:'knight-destrier', ds:'imperial-knights/knight-destrier', pts:265, copies:2,
      models:['1× Knight Destrier'],
      gear:[['Questoris heavy stubber','Titanic feet','Chastiser gatling cannon','Frag bombard']],
      abilities:[
        { name:'Damaged: 1-6 Wounds Remaining' },
        // this list's Destriers have Titanic feet, not a thundershock spear and bellatus reaper chainsword, so it does not apply
        { name:'Thundercharge', na:'Needs a thundershock spear and bellatus reaper chainsword: not this loadout' },
        { name:'Ram Jets' },
        { name:'Saturation Fire' },
        { name:'Invulnerable Save (5+*)' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target within range of an objective marker', cond:'targetObjective', note:'ranged attacks have [IGNORES COVER]', from:'Saturation Fire' },
        { kind:'all', when:'Damaged (1-6 wounds left)', note:'-1 to hit rolls (and -4 OC)', from:'Damaged: 1-6 Wounds Remaining' }
      ]
    },
    {
      id:'knight-errant', ds:'imperial-knights/knight-errant', pts:355,
      models:['1× Knight Errant'],
      gear:[['Thermal cannon','Stormspear rocket pod','Meltagun','Reaper chainsword']],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target is the closest eligible target', cond:'closest', note:'+1 to hit rolls', from:'Aggressive Assault' },
        { kind:'all', when:'Damaged (1-9 wounds left)', note:'-1 to hit rolls (and -5 OC)', from:'Damaged: 1-9 Wounds Remaining' }
      ],
      aura:[
        { kind:'ranged', needs:{ all:['Armiger'] }, when:'Affected by Errant’s Duty (Bondsman)', note:'ranged weapons have [ASSAULT]', from:'Errant’s Duty' }
      ]
    },
    {
      id:'knight-paladin', ds:'imperial-knights/knight-paladin', pts:375, copies:2,
      models:['1× Knight Paladin'],
      gear:[['Questoris heavy stubber','Rapid-fire battle cannon','Stormspear rocket pod','Meltagun','Reaper chainsword']],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target is the closest eligible target', cond:'closest', note:'improve AP by 1', from:'Seasoned Noble' },
        { kind:'all', when:'Damaged (1-9 wounds left)', note:'-1 to hit rolls (and -5 OC)', from:'Damaged: 1-9 Wounds Remaining' }
      ],
      aura:[
        { kind:'all', needs:{ all:['Armiger'] }, when:'Affected by Paladin’s Duty (Bondsman)', note:'weapons have [LETHAL HITS]', from:'Paladin’s Duty' },
        { kind:'melee', needs:{ all:['Armiger'] }, when:'Affected by Paladin’s Duty (Bondsman)', note:'melee weapons have [LANCE]', from:'Paladin’s Duty' }
      ]
    },
    {
      id:'knight-warden', ds:'imperial-knights/knight-warden', pts:365, warlord:true,
      models:['1× Knight Warden'],
      gear:[['Avenger gatling cannon','Heavy flamer','Stormspear rocket pod','Meltagun','Reaper chainsword']],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'vs non-MONSTER/VEHICLE targets', note:'ranged attacks have [DEVASTATING WOUNDS]', from:'Thin Their Ranks', always:true, vs:{ none:['Monster','Vehicle'] } },
        { kind:'all', when:'Damaged (1-9 wounds left)', note:'-1 to hit rolls (and -5 OC)', from:'Damaged: 1-9 Wounds Remaining' }
      ],
      aura:[
        { kind:'all', needs:{ all:['Armiger'] }, when:'Affected by Warden’s Duty (Bondsman)', note:'weapons have [SUSTAINED HITS 1]', from:'Warden’s Duty' },
        { kind:'ranged', needs:{ all:['Armiger'] }, when:'Affected by Warden’s Duty (Bondsman)', note:'ranged weapons have [IGNORES COVER]', from:'Warden’s Duty' }
      ],
      kw:['Character','Faction: Imperial Knights','Imperium','Knight Warden','Questoris','Titanic','Towering','Vehicle','Walker','Warlord'],
      why:{ kw:{ Warlord:'Warlord' } }
    }
  ]
},
{
  id:'4-megas-and-a-destrier', name:'4 megas and a destrier', faction:'imperial-knights', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Purge the Foe',
  detachments:['freeblade-company'],
  config:{ 'Code Chivalric':'Deed, Quality' },
  source:'New Recruit, exported 20 Oct 2026',
  units:[
    {
      id:'canis-rex', ds:'imperial-knights/canis-rex', pts:415,
      models:['1× Canis Rex','1× Sir Hekhtur'],
      gear:[['Freedom’s Hand','Las-impulsor','Questoris multi-laser'],['Close combat weapon','Hekhtur’s pistol']],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Damaged (1-9 wounds left)', note:'-1 to hit rolls (and -5 OC)', from:'Damaged: 1-9 Wounds Remaining' }
      ]
    },
    {
      id:'cerastus-knight-atrapos', ds:'imperial-knights/cerastus-knight-atrapos', pts:450, enhancement:'Bringer of Justice',
      models:['1× Cerastus Knight Atrapos'],
      gear:[['Atrapos lascutter','Graviton singularity cannon']],
      melee:[
        { name:'high intensity', A:'8', from:{ A:'Bringer of Justice' } },
        { name:'low intensity', A:'14', from:{ A:'Bringer of Justice' } }
      ],
      abilities:[
        { name:'Macro-extinction Protocols' },
        { name:'Damaged: 1-10 Wounds Remaining' },
        { name:'Bringer of Justice', tag:'Enhancement', text:'**IMPERIAL KNIGHTS** model only. Improve the Attacks characteristic of melee weapons equipped by the bearer by 2, and each time the bearer makes a melee attack, add 1 to the **Hit roll**.' },
        { name:'Atrapos’ Duty' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      // (Bringer of Justice's +2 A is already in the melee profiles, as New Recruit prints them: only its +1 to hit is a footnote)
      mods:[
        { kind:'all', when:'vs MONSTER/VEHICLE', note:'+1 to hit rolls', from:'Macro-extinction Protocols', always:true, vs:{ any:['Monster','Vehicle'] } },
        { kind:'all', when:'vs TITANIC/TOWERING', note:'+1 to wound rolls', from:'Macro-extinction Protocols', always:true, vs:{ any:['Titanic','Towering'], also:{ any:['Monster','Vehicle'] } } },
        { kind:'melee', when:'Every melee attack', note:'+1 to hit rolls', from:'Bringer of Justice', always:true },
        { kind:'all', when:'Damaged (1-10 wounds left)', note:'-1 to hit rolls (and -5 OC)', from:'Damaged: 1-10 Wounds Remaining' }
      ],
      aura:[
        { kind:'all', needs:{ all:['Armiger'] }, when:'Affected by Atrapos’ Duty (Bondsman), vs a TITANIC or TOWERING model', note:'re-roll the hit roll and the wound roll', from:'Atrapos’ Duty', vs:{ any:['Titanic','Towering'] } }
      ]
    },
    {
      id:'cerastus-knight-lancer', ds:'imperial-knights/cerastus-knight-lancer', pts:415,
      models:['1× Cerastus Knight Lancer'],
      gear:[['Cerastus shock lance']],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Damaged (1-10 wounds left)', note:'-1 to hit rolls (and -5 OC)', from:'Damaged: 1-10 Wounds Remaining' }
      ]
    },
    {
      id:'knight-crusader', ds:'imperial-knights/knight-crusader', pts:435, enhancement:'Hunter’s Eye',
      models:['1× Knight Crusader'],
      gear:[['Avenger gatling cannon','Heavy flamer','Titanic feet','Stormspear rocket pod','Meltagun','Questoris heavy stubber','Rapid-fire battle cannon']],
      ranged:[
        { name:'Avenger gatling cannon', kw:['IGNORES COVER'], from:{ 'IGNORES COVER':'Hunter’s Eye' } },
        { name:'Heavy flamer', kw:['IGNORES COVER','TORRENT','IGNORES COVER'], from:{ 'IGNORES COVER':'Hunter’s Eye' } },
        { name:'Stormspear rocket pod', kw:['IGNORES COVER'], from:{ 'IGNORES COVER':'Hunter’s Eye' } },
        { name:'Meltagun', kw:['MELTA 2','IGNORES COVER'], from:{ 'IGNORES COVER':'Hunter’s Eye' } },
        { name:'Questoris heavy stubber', kw:['RAPID FIRE 3','IGNORES COVER'], from:{ 'IGNORES COVER':'Hunter’s Eye' } },
        { name:'Rapid-fire battle cannon', kw:['BLAST','RAPID FIRE D6+3','IGNORES COVER'], from:{ 'IGNORES COVER':'Hunter’s Eye' } }
      ],
      abilities:[
        { name:'Punishing Salvoes' },
        { name:'Invulnerable Save (5+*)' },
        { name:'Damaged: 1-9 Wounds Remaining' },
        { name:'Hunter’s Eye', tag:'Enhancement', text:'**IMPERIAL KNIGHTS** model only. Ranged weapons equipped by the bearer have the **[IGNORES COVER]** ability.' },
        { name:'Crusader’s Duty' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      // (Hunter's Eye's [IGNORES COVER] is already on every ranged weapon, as New Recruit prints them: no footnote)
      mods:[
        { kind:'ranged', when:'Remained Stationary in your Movement phase', cond:'stationary', note:'ranged weapons have [SUSTAINED HITS 1] until the end of the turn', from:'Punishing Salvoes' },
        { kind:'all', when:'Damaged (1-9 wounds left)', note:'-1 to hit rolls (and -5 OC)', from:'Damaged: 1-9 Wounds Remaining' }
      ],
      aura:[
        { kind:'ranged', needs:{ all:['Armiger'] }, when:'Affected by Crusader’s Duty (Bondsman)', note:'+1 to hit rolls', from:'Crusader’s Duty' }
      ],
      rules:['Deadly Demise D6','Super-Heavy Walker','Code Chivalric','Sustained Hits','Bondsman','Ignores Cover','Torrent','Melta','Rapid Fire','Blast'],
      why:{ rules:{ 'Ignores Cover':'Hunter’s Eye' } }
    },
    {
      id:'knight-destrier', ds:'imperial-knights/knight-destrier', pts:285, enhancement:'Sanctuary',
      models:['1× Knight Destrier'],
      gear:[['Questoris heavy stubber','Titanic feet','Chastiser gatling cannon','Frag bombard']],
      // InSv 5+ against all attacks from Sanctuary ("The bearer has a 5+ invulnerable save"); New Recruit and BSData print
      // the datasheet's 5+* (ranged attacks only): printed, checked by verify/nr.js (deviations-nr.json, deviations-bsdata.json)
      stats:[
        { name:'Knight Destrier', InSv:'5+', from:{ InSv:'Sanctuary' }, printed:{ InSv:'5+*' } }
      ],
      abilities:[
        { name:'Damaged: 1-6 Wounds Remaining' },
        // this list's Destrier has Titanic feet, not a thundershock spear and bellatus reaper chainsword, so it does not apply
        { name:'Thundercharge', na:'Needs a thundershock spear and bellatus reaper chainsword: not this loadout' },
        { name:'Ram Jets' },
        { name:'Saturation Fire' },
        { name:'Invulnerable Save (5+*)' },
        { name:'Sanctuary', tag:'Enhancement', def:'Sanctuary: 5+ invulnerable save', text:'**IMPERIAL KNIGHTS** model only. The bearer has a 5+ invulnerable save.', defOf:'5b60c82a' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target within range of an objective marker', cond:'targetObjective', note:'ranged attacks have [IGNORES COVER]', from:'Saturation Fire' },
        { kind:'all', when:'Damaged (1-6 wounds left)', note:'-1 to hit rolls (and -4 OC)', from:'Damaged: 1-6 Wounds Remaining' }
      ]
    }
  ]
},
{
  id:'ooga-booga', name:'Ooga booga', faction:'orks', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Purge the Foe',
  detachments:['bully-boyz','runt-swarm','shoota-boyz'],
  source:'New Recruit, exported 20 Oct 2026',
  units:[
    {
      id:'ghazghkull-thraka', ds:'orks/ghazghkull-thraka', pts:290, warlord:true,
      models:['1× Ghazghkull Thraka'],
      gear:[['Adamantine ’Eadbutt','Gork’s Klaw','Mork’s Roar']],
      ranged:[
        { name:'Point Blank', kw:['CLOSE-QUARTERS','TORRENT','ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } },
        { name:'Aimed', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 4','ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } }
      ],
      aura:[
        { kind:'melee', needs:{ all:['Faction: Orks'] }, when:'Within 6" of Ghazghkull', selfWhen:'Own aura', note:'+1 to hit, +1 to wound', from:'Prophet of Da Great Waaagh!', selfAlways:true }
      ],
      kw:['Character','Epic Hero','Explosives','Faction: Orks','Ghazghkull Thraka','Infantry','Warboss','Warlord'],
      why:{ kw:{ Warlord:'Warlord' } }
    },
    {
      id:'nazdreg-meganobz', ds:['orks/nazdreg','orks/meganobz'], role:'Epic Hero', pts:365, ptsNote:'165 + Meganobz 200',
      leads:'Meganobz',
      models:['1× Nazdreg','5× Meganob w/ Twin Killsaw'],
      gear:[['Kustom Blasta X','Moonchewa'],['Twin Killsaw']],
      stats:[
        { name:'Nazdreg' },
        { name:'Meganob ×5' }
      ],
      ranged:[
        { name:'Skorcha', who:'Nazdreg', kw:['BLAST 1','TORRENT','IGNORES COVER','ASSAULT'], from:{ 'IGNORES COVER':'Nazdreg’s Know-wotz', ASSAULT:'Dakka! Dakka! Dakka!' } },
        { name:'Gatler', who:'Nazdreg', kw:['HAZARDOUS','IGNORES COVER','ASSAULT'], from:{ 'IGNORES COVER':'Nazdreg’s Know-wotz', ASSAULT:'Dakka! Dakka! Dakka!' } },
        { name:'Shoota', who:'Nazdreg', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 2','IGNORES COVER','ASSAULT'], from:{ 'IGNORES COVER':'Nazdreg’s Know-wotz', ASSAULT:'Dakka! Dakka! Dakka!' } }
      ],
      melee:[
        { name:'Kustom Blasta X', who:'Nazdreg', kw:['CLEAVE 1','EXTRA ATTACKS','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Displays of Savagery' } },
        { name:'Moonchewa', who:'Nazdreg', kw:['CLEAVE 1','TWIN-LINKED','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Displays of Savagery' } },
        { name:'Twin Killsaw', who:'Meganobz', n:5, kw:['TWIN-LINKED','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Displays of Savagery' } }
      ],
      abilities:[
        { name:'Nazdreg’s Know-wotz', who:'Nazdreg' },
        { name:'Supreme Kunnin’', who:'Nazdreg' },
        { name:'Intimidating Motivation', who:'Nazdreg' },
        { name:'Krumpin’ Time', who:'Meganobz' },
        { name:'Arrogant Invulnerability', who:'Meganobz' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Riled up, Fight phase', cond:'riled', note:'+1 to hit rolls', from:'Krumpin’ Time' }
      ],
      rules:['Waaagh!','Leader','Da Boss','Deep Strike'],
      kw:['Character','Epic Hero','Faction: Orks','Infantry','Mega Armour','Nazdreg','Warboss','Explosives','Meganobz'],
      kwNote:'Explosives, Meganobz come from the led Meganobz.'
    },
    {
      id:'zodgrod-wortsnagga-runtherd-gretchin', ds:['orks/zodgrod-wortsnagga','orks/runtherd','orks/gretchin'], role:'Epic Hero', pts:150, ptsNote:'50 + Runtherd 10 + Gretchin 90', upgrade:'Extra Sneaky',
      leads:'Gretchin',
      also:[
        { name:'Runtherd', support:true }
      ],
      models:['1× Zodgrod Wortsnagga','1× Runtherd','20× Gretchin'],
      gear:[['Da Grabzappa','Squigstoppa'],['Runtherd’s Toolz','Slugga'],['Grot Blasta','Scavenged Shivs']],
      stats:[
        { name:'Zodgrod Wortsnagga' },
        { name:'Runtherd' },
        { name:'Gretchin ×20' }
      ],
      ranged:[
        { name:'Squigstoppa', who:'Zodgrod Wortsnagga', kw:['ANTI-MONSTER/VEHICLE 4+','CLOSE-QUARTERS','DEVASTATING WOUNDS: MONSTER/VEHICLE','ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } },
        { name:'Slugga', who:'Runtherd', kw:['CLOSE-QUARTERS','LETHAL HITS: non-MONSTER/VEHICLE','ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } },
        { name:'Grot Blasta', who:'Gretchin', n:20, kw:['CLOSE-QUARTERS','ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } }
      ],
      melee:[
        { name:'Da Grabzappa', who:'Zodgrod Wortsnagga' },
        { name:'Runtherd’s Toolz', who:'Runtherd' },
        { name:'Scavenged Shivs', who:'Gretchin', n:20, A:'2', WS:'4+', S:'3', from:{ A:'Super Runts', WS:'Super Runts', S:'Super Runts' } }
      ],
      abilities:[
        { name:'Super Runts', who:'Zodgrod Wortsnagga' },
        { name:'That’ll Learn Ya', who:'Runtherd' },
        { name:'Downtrodden', who:'Gretchin' },
        { name:'Thievin’ Scavengers', who:'Gretchin' },
        { name:'Extra Sneaky', who:'Gretchin', tag:'Upgrade', def:'-3" detection range', text:'**GRETCHIN** unit only. This unit has -3" **detection range**.', defOf:'10b55c47' }
      ],
      rules:['Waaagh!','Leader','Support'],
      kw:['Character','Epic Hero','Faction: Orks','Infantry','Runtherd','Zodgrod Wortsnagga','Battleline','Gretchin','Grots'],
      kwNote:'Battleline, Gretchin, Grots come from the combined unit.'
    },
    {
      id:'big-mek-painboy-nobz', ds:['orks/big-mek','orks/painboy','orks/nobz'], role:'Character', pts:385, copies:2, ptsNote:'100 + Painboy 45 + Nobz 240',
      leads:'Nobz',
      also:[
        { name:'Painboy', support:true }
      ],
      models:['1× Big Mek','1× Painboy','8× Nob w/ Kombi-rokkit and Kustom Krumpa','2× Nob w/ Kustom Krumpa and Paired Krumpas (Paired Krumpas)'],
      gear:[['Kustom mega-blasta','Drilla'],['’Urty syringe','Dok’s Toolz'],['Kombi-rokkit','Kustom Krumpa'],['Kustom Krumpa']],
      stats:[
        { name:'Big Mek' },
        { name:'Painboy' },
        { name:'Nob ×10' }
      ],
      ranged:[
        { name:'Kustom mega-blasta', who:'Big Mek', kw:['HAZARDOUS','IGNORES COVER','ASSAULT'], from:{ 'IGNORES COVER':'More Dakka', ASSAULT:'Dakka! Dakka! Dakka!' } },
        { name:'Busta Rokkit', who:'Nobz', n:8, kw:['IGNORES COVER','ASSAULT'], from:{ 'IGNORES COVER':'More Dakka', ASSAULT:'Dakka! Dakka! Dakka!' } },
        { name:'Shoota', who:'Nobz', n:8, kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 1','IGNORES COVER','ASSAULT'], from:{ 'IGNORES COVER':'More Dakka', ASSAULT:'Dakka! Dakka! Dakka!' } }
      ],
      melee:[
        { name:'Drilla', who:'Big Mek', kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Displays of Savagery' } },
        { name:'’Urty syringe', who:'Painboy', kw:['ANTI-INFANTRY 4+','DEVASTATING WOUNDS: INFANTRY','EXTRA ATTACKS','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Displays of Savagery' } },
        { name:'Dok’s Toolz', who:'Painboy', kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Displays of Savagery' } },
        { name:'Kustom Krumpa', who:'Nobz', n:10, kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Displays of Savagery' } }
      ],
      abilities:[
        { name:'Shokk-boosta', who:'Big Mek' },
        { name:'More Dakka', who:'Big Mek' },
        { name:'Crude Surgery', who:'Painboy' },
        { name:'Catch Dat Red Bit', who:'Painboy' },
        { name:'Ammo Runts', who:'Nobz' },
        { name:'Get Out da Way!', who:'Nobz' },
        { name:'Paired Krumpas', who:'Nobz' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Riled up', cond:'riled', note:'[SUSTAINED HITS 1]', from:'More Dakka' },
        { kind:'ranged', when:'Ammo Runts used (your Shooting phase, when selected to shoot)', note:'+1 to hit rolls', from:'Ammo Runts' },
        { kind:'melee', weapon:'Kustom Krumpa', when:'Kustom Krumpa of a Nob w/ Paired Krumpas', note:'can re-roll hit rolls and wound rolls', from:'Paired Krumpas', always:true }
      ],
      rules:['Waaagh!','Leader','Support'],
      kw:['Big Mek','Character','Explosives','Faction: Orks','Infantry','Painboy','Nobz'],
      kwNote:'Painboy, Nobz come from the combined unit.'
    },
    {
      id:'big-mek-in-mega-armour-meganobz', ds:['orks/big-mek-in-mega-armour','orks/meganobz'], pts:290, ptsNote:'115 + Meganobz 175', enhancement:'Supa-glowy Fing',
      leads:'Meganobz',
      models:['1× Big Mek in Mega Armour','5× Meganob w/ Kombi-weapon and Power Klaw'],
      gear:[['Kustom Mega-blasta','Power Klaw','Tellyport Blasta'],['Kombi-weapon','Power Klaw']],
      stats:[
        { name:'Big Mek in Mega Armour' },
        { name:'Meganob ×5' }
      ],
      ranged:[
        { name:'Kustom Mega-blasta', who:'Big Mek in Mega Armour', kw:['HAZARDOUS','ANTI-INFANTRY 4+','DEVASTATING WOUNDS','SUPA-HAZARDOUS','IGNORES COVER','ASSAULT'], from:{ 'ANTI-INFANTRY 4+':'Supa-glowy Fing', 'DEVASTATING WOUNDS':'Supa-glowy Fing', 'SUPA-HAZARDOUS':'Supa-glowy Fing', 'IGNORES COVER':'More Dakka', ASSAULT:'Dakka! Dakka! Dakka!' } },
        { name:'Tellyport Blasta', who:'Big Mek in Mega Armour', kw:['BLAST 1','ANTI-INFANTRY 4+','DEVASTATING WOUNDS','SUPA-HAZARDOUS','IGNORES COVER','ASSAULT'], from:{ 'ANTI-INFANTRY 4+':'Supa-glowy Fing', 'DEVASTATING WOUNDS':'Supa-glowy Fing', 'SUPA-HAZARDOUS':'Supa-glowy Fing', 'IGNORES COVER':'More Dakka', ASSAULT:'Dakka! Dakka! Dakka!' } },
        { name:'Point Blank', who:'Meganobz', n:5, kw:['BLAST 1','TORRENT','ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } },
        { name:'Kill Shot', who:'Meganobz', n:5, kw:['ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } },
        { name:'Shoota', who:'Meganobz', n:5, kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 1','ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } }
      ],
      melee:[
        { name:'Power Klaw', who:'Big Mek in Mega Armour', kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Displays of Savagery' } },
        { name:'Power Klaw', who:'Meganobz', n:5, kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Displays of Savagery' } }
      ],
      abilities:[
        { name:'Fix Dat Armour Up', who:'Big Mek in Mega Armour' },
        { name:'More Dakka', who:'Big Mek in Mega Armour' },
        { name:'Supa-glowy Fing', who:'Big Mek in Mega Armour', tag:'Enhancement', text:'**ORKS INFANTRY** model only (excluding **WEIRDBOY** models). This model’s ranged attacks have:\n- **[ANTI-INFANTRY 4+]**.\n- **[DEVASTATING WOUNDS]**.\n- **[SUPA-HAZARDOUS]**.' },
        { name:'Krumpin’ Time', who:'Meganobz' },
        { name:'Arrogant Invulnerability', who:'Meganobz' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      // More Dakka's [IGNORES COVER] is printed on the Big Mek's weapons only: BSData gives it to the leader's own
      // profiles while it labels the Meganobz' Kombi-weapon "(More Dakka)" too; the rule is for the whole attached
      // unit (Core Rules 19.04), so the Meganobz' profile stays as printed and the footnote says it
      mods:[
        { kind:'ranged', when:'Every ranged attack', note:'[IGNORES COVER]', from:'More Dakka', always:true },
        { kind:'ranged', when:'Riled up', cond:'riled', note:'[SUSTAINED HITS 1]', from:'More Dakka' },
        { kind:'melee', when:'Riled up, Fight phase', cond:'riled', note:'+1 to hit rolls', from:'Krumpin’ Time' }
      ],
      rules:['Waaagh!','Leader','Supa-hazardous'],
      kw:['Big Mek','Big Mek in Mega Armour','Character','Explosives','Faction: Orks','Infantry','Mega Armour','Meganobz'],
      kwNote:'Meganobz comes from the led Meganobz.'
    },
    {
      id:'gretchin', ds:'orks/gretchin', role:'Battleline', pts:45, copies:3,
      models:['10× Gretchin'],
      gear:[['Grot Blasta','Scavenged Shivs']],
      stats:[
        { name:'Gretchin ×10' }
      ],
      ranged:[
        { name:'Grot Blasta', n:10, kw:['CLOSE-QUARTERS','ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } }
      ],
      melee:[
        { name:'Scavenged Shivs', n:10 }
      ],
      kw:['Battleline','Faction: Orks','Gretchin','Grots','Infantry'],
      why:{ kw:{ Battleline:'Sneaky Little Gitz' }, role:{ Battleline:'Sneaky Little Gitz' } }
    }
  ]
},
{
  id:'super-terminators', name:'Super Terminators', faction:'world-eaters', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Take and Hold',
  detachments:['berzerker-warband','butchers-of-khorne'],
  source:'New Recruit, exported 20 Oct 2026',
  units:[
    {
      id:'angron', ds:'world-eaters/angron', pts:330, warlord:true,
      models:['1× Angron'],
      gear:[['Samni’arius and Spinegrinder']],
      melee:[
        { name:'strike', A:'9', from:{ A:'Relentless Rage' } },
        { name:'sweep', A:'17', from:{ A:'Relentless Rage' } }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Damaged (1-6 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-6 wounds remaining' }
      ],
      aura:[
        { kind:'melee', needs:{ all:['Faction: World Eaters'] }, when:'Within 6" of Angron, if he has Driven by Ultimate Rage this round', selfWhen:'Own aura, if he has Driven by Ultimate Rage this round', note:'re-roll hit rolls of 1 and wound rolls of 1', from:'Driven by Ultimate Rage' }
      ],
      kw:['Angron','Chaos','Character','Daemon','Epic Hero','Faction: World Eaters','Fly','Khorne','Monster','Primarch','Warlord'],
      why:{ kw:{ Warlord:'Warlord' } }
    },
    {
      id:'chaos-terminators', ds:'world-eaters/chaos-terminators', pts:370, copies:2, upgrade:'Gore-stained Veterans',
      models:['1× Terminator Champion','2× Combi-bolter, chainfist','4× Combi-bolter, power fist','1× Paired accursed weapons','2× Heavy weapon'],
      gear:[['Paired accursed weapons'],['Chainfist','Combi-bolter'],['Combi-bolter','Power fist'],['Paired accursed weapons'],['Reaper autocannon','Power fist']],
      ranged:[
        { name:'Combi-bolter', n:6 },
        { name:'Reaper autocannon', n:2 }
      ],
      melee:[
        { name:'Paired accursed weapons', n:2, A:'6', WS:'2+', from:{ A:'Relentless Rage', WS:'Gore-stained Veterans' } },
        { name:'Chainfist', n:2, A:'4', WS:'3+', from:{ A:'Relentless Rage', WS:'Gore-stained Veterans' } },
        { name:'Power fist', n:6, A:'4', WS:'2+', from:{ A:'Relentless Rage', WS:'Gore-stained Veterans' } }
      ],
      abilities:[
        { name:'Bloody Fury' },
        // already in the WS values above (from); its official text starts with the restriction New Recruit leaves out
        { name:'Gore-stained Veterans', tag:'Upgrade', text:'**TERMINATOR SQUAD** unit only. This unit’s melee attacks have +1 **WS**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target is the closest eligible target', cond:'closest', note:'re-roll hit rolls', from:'Bloody Fury' }
      ]
    },
    {
      id:'chaos-terminators-2', ds:'world-eaters/chaos-terminators', pts:380, upgrade:'Gore-stained Veterans',
      models:['1× Terminator Champion','2× Combi-bolter, chainfist','4× Combi-bolter, power fist','1× Paired accursed weapons','2× Heavy weapon'],
      gear:[['Paired accursed weapons'],['Chainfist','Combi-bolter'],['Combi-bolter','Power fist'],['Paired accursed weapons'],['Reaper autocannon','Power fist']],
      ranged:[
        { name:'Combi-bolter', n:6 },
        { name:'Reaper autocannon', n:2 }
      ],
      melee:[
        { name:'Paired accursed weapons', n:2, A:'6', WS:'2+', from:{ A:'Relentless Rage', WS:'Gore-stained Veterans' } },
        { name:'Chainfist', n:2, A:'4', WS:'3+', from:{ A:'Relentless Rage', WS:'Gore-stained Veterans' } },
        { name:'Power fist', n:6, A:'4', WS:'2+', from:{ A:'Relentless Rage', WS:'Gore-stained Veterans' } }
      ],
      abilities:[
        { name:'Bloody Fury' },
        // already in the WS values above (from); its official text starts with the restriction New Recruit leaves out
        { name:'Gore-stained Veterans', tag:'Upgrade', text:'**TERMINATOR SQUAD** unit only. This unit’s melee attacks have +1 **WS**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target is the closest eligible target', cond:'closest', note:'re-roll hit rolls', from:'Bloody Fury' }
      ]
    },
    {
      id:'eightbound', ds:'world-eaters/eightbound', pts:125,
      models:['1× Eightbound Champion','2× Eightbound'],
      gear:[['Chainblades'],['Chainblades']],
      melee:[
        { name:'Chainblades', n:3, A:'6', from:{ A:'Relentless Rage' } }
      ],
      aura:[
        { kind:'melee', needs:{ all:['Faction: World Eaters'] }, when:'Within 6" of Eightbound, vs non-MONSTER/VEHICLE targets', selfWhen:'Own aura, vs non-MONSTER/VEHICLE targets', note:'+1 to hit', from:'Beacons of Rage', selfAlways:true, vs:{ none:['Monster','Vehicle'] }, calc:{ hit:1 } },
        { kind:'melee', needs:{ all:['Faction: World Eaters'] }, when:'Within 6" of Eightbound, target Below Half-strength, vs non-MONSTER/VEHICLE targets', selfWhen:'Own aura, target Below Half-strength, vs non-MONSTER/VEHICLE targets', note:'+1 to wound rolls', from:'Beacons of Rage', vs:{ none:['Monster','Vehicle'] }, calc:{ wound:1 } }
      ]
    },
    {
      id:'goremongers', ds:'world-eaters/goremongers', pts:70,
      models:['1× Blood Herald','7× Goremonger w/ chainblade'],
      gear:[['Autopistol','Chainblade','Close combat weapon'],['Autopistol','Chainblade','Close combat weapon']],
      ranged:[
        { name:'Autopistol', n:8 }
      ],
      melee:[
        { name:'Chainblade', n:8, A:'4', from:{ A:'Relentless Rage' } },
        { name:'Close combat weapon', n:8, A:'3', from:{ A:'Relentless Rage' } }
      ]
    },
    {
      id:'jakhals', ds:'world-eaters/jakhals', pts:65,
      models:['1× Jakhal Pack Leader','1× Dishonoured w/ paired manglers','8× Jakhal'],
      gear:[['Autopistol','Chainblades'],['Paired manglers'],['Autopistol','Chainblades']],
      ranged:[
        { name:'Autopistol', n:9 }
      ],
      melee:[
        { name:'Chainblades', n:9, A:'4', from:{ A:'Relentless Rage' } },
        { name:'Paired manglers', A:'5', from:{ A:'Relentless Rage' } }
      ]
    },
    {
      id:'forgefiend', ds:'world-eaters/forgefiend', pts:145, copies:2,
      models:['1× Forgefiend'],
      gear:[['Hades autocannon','Hades autocannon','Ectoplasma cannon','Forgefiend claws']],
      ranged:[
        { name:'Hades autocannon', n:2 },
        { name:'Ectoplasma cannon' }
      ],
      melee:[
        { name:'Forgefiend claws', A:'7', from:{ A:'Relentless Rage' } }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target is the closest eligible target within 18"', cond:'closest18', note:'re-roll the hit roll', from:'Furious Onslaught' },
        { kind:'all', when:'Damaged (1-4 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-4 wounds remaining' }
      ]
    }
  ]
},
{
  id:'purge-goes-the-foe', name:'Purge goes the Foe', faction:'adeptus-mechanicus', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Purge the Foe',
  detachments:['cohort-cybernetica','eradication-cohort'],
  source:'New Recruit, exported 20 Oct 2026',
  units:[
    {
      id:'belisarius-cawl', ds:'adeptus-mechanicus/belisarius-cawl', pts:220, warlord:true,
      models:['1× Belisarius Cawl'],
      gear:[['Arc Scourge','Cawl’s Omnissian axe','Mechadendrite hive','Solar atomiser']],
      // what Belisarius Cawl gives other units: the Invocation of Machine Vengeance canticle (Binharic Courage's OC and
      // test bonus and Shroudpsalm's Stealth change no attacks)
      aura:[
        { kind:'all', needs:{ all:['Faction: Adeptus Mechanicus'] }, when:'If Cawl has Invocation of Machine Vengeance, vs your Machine Vengeance target', selfWhen:'If he has Invocation of Machine Vengeance, vs your Machine Vengeance target', note:'can re-roll the hit roll', from:'Canticles of the Omnissiah', lasts:'round' }
      ],
      // help this unit gives other units of its list when they are attacked (the Damage tab offers it as a tick box)
      guard:[
        { from:'Shroudpsalm', needs:{ all:['Faction: Adeptus Mechanicus'] }, kind:'ranged', when:'Within 6" of Cawl, if he has Shroudpsalm', note:'Stealth: the benefit of cover against ranged attacks', calc:{ stealth:true } }
      ],
      kw:['Belisarius Cawl','Character','Cult Mechanicus','Epic Hero','Faction: Adeptus Mechanicus','Imperium','Mobile','Monster','Tech-Priest','Warlord'],
      why:{ kw:{ Warlord:'Warlord' } }
    },
    {
      id:'thulia-ghuld', ds:'adeptus-mechanicus/thulia-ghuld', pts:180,
      models:['1× Thulia Ghuld'],
      gear:[['Jericho-class conversion resonator','Rod of the War Forge']]
    },
    {
      id:'tech-priest-enginseer', ds:'adeptus-mechanicus/tech-priest-enginseer', pts:75, enhancement:'Necromechanic',
      models:['1× Tech-Priest Enginseer'],
      gear:[['Mechanicus pistol','Omnissian axe','Servo arm']],
      abilities:[
        { name:'Enginseer' },
        { name:'Omnissiah’s Blessing' },
        { name:'Vengeance for the Omnissiah' },
        // the Cohort Cybernetica enhancement as data.js has it; New Recruit leaves out "TECH-PRIEST model only." (deviations-nr.json)
        { name:'Necromechanic', tag:'Enhancement · Once per battle round', text:'**TECH-PRIEST** model only. Once per battle round, when a saving throw made for a friendly **LEGIO CYBERNETICA** or **ADEPTUS MECHANICUS VEHICLE** model within 12" of the bearer is failed, the bearer can use this Enhancement. If they do, change the Damage characteristic of that attack to 0.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', weapon:'Omnissian axe', set:{ A:'6' }, when:'After a friendly ADEPTUS MECHANICUS VEHICLE model is destroyed within 12" of it', note:'until the end of the battle', from:'Vengeance for the Omnissiah', calc:{}, lasts:'battle' }
      ],
      // help this unit gives other units of its list when they are attacked (the Damage tab offers it as a tick box)
      guard:[
        { from:'Omnissiah’s Blessing', needs:{ all:['Faction: Adeptus Mechanicus','Vehicle'] }, kind:'all', one:true, when:'Picked by the Enginseer in your Command phase (within 3")', note:'Feel No Pain 5+ for that VEHICLE model', calc:{ fnp:5 } },
        // the enhancement's "friendly LEGIO CYBERNETICA or ADEPTUS MECHANICUS VEHICLE model": no calc (a choice once per battle round
        // after a failed save, not numbers the calculator plays)
        { from:'Necromechanic', needs:{ all:['Faction: Adeptus Mechanicus'], any:['Legio Cybernetica','Vehicle'] }, kind:'all', when:'Within 12" of the Enginseer, once per battle round', note:'after a failed saving throw, the Enginseer can change the Damage characteristic of that attack to 0' }
      ]
    },
    {
      id:'cybernetica-datasmith-kastelan-robots', ds:['adeptus-mechanicus/cybernetica-datasmith','adeptus-mechanicus/kastelan-robots'], role:'Character', pts:335, ptsNote:'35 + Kastelan Robots 300', enhancement:'Martial Signatum Amplificator',
      leads:'Kastelan Robots', support:true,
      models:['1× Cybernetica Datasmith','4× Kastelan Robot'],
      gear:[['Mechanicus pistol','Power fist'],['Twin Kastelan fist','Incendine combustor']],
      stats:[
        { name:'Cybernetica Datasmith', M:'8"', from:{ M:'Cyber-psalm Programming' } },
        { name:'Kastelan Robot ×4', M:'8"', from:{ M:'Cyber-psalm Programming' } }
      ],
      ranged:[
        { name:'Mechanicus pistol', who:'Cybernetica Datasmith' },
        { name:'Incendine combustor', who:'Kastelan Robots', n:4 }
      ],
      melee:[
        { name:'Power fist', who:'Cybernetica Datasmith' },
        { name:'Twin Kastelan fist', who:'Kastelan Robots', n:4 }
      ],
      abilities:[
        { name:'Battle Protocols', who:'Cybernetica Datasmith' },
        { name:'Data-severed', who:'Cybernetica Datasmith' },
        { name:'Martial Signatum Amplificator', who:'Cybernetica Datasmith', tag:'Enhancement', text:'**TECH-PRIEST** model only. Models in the bearer’s unit have the **SKITARII** keyword.' },
        { name:'Robotic Bodyguard', who:'Kastelan Robots' },
        { name:'Repulsor Grid', who:'Kastelan Robots' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', weapon:'Incendine combustor', set:{ A:'+2' }, when:'In Protector Protocol', note:'selected in your Command phase', from:'Battle Protocols', calc:{}, lasts:'round' },
        { kind:'melee', weapon:'Twin Kastelan fist', set:{ A:'+2' }, when:'In Conqueror Protocol', note:'selected in your Command phase', from:'Battle Protocols', calc:{}, lasts:'round' }
      ],
      rules:['Support','Doctrina Imperatives','Feel No Pain 4+','Devastating Wounds','Pistol','Deadly Demise 1','Twin-linked','Ignores Cover','Torrent'],
      kw:['Character','Cybernetica Datasmith','Faction: Adeptus Mechanicus','Imperium','Legio Cybernetica','Skitarii','Tech-Priest','Vehicle','Kastelan Robots','Walker'],
      kwNote:'Kastelan Robots, Walker come from the supported Kastelan Robots; Skitarii from the Martial Signatum Amplificator.'
    },
    {
      id:'skitarii-rangers', ds:'adeptus-mechanicus/skitarii-rangers', pts:85, copies:2,
      models:['1× Skitarii Ranger Alpha','1× Skitarii Ranger w/ arc rifle','1× Skitarii Ranger w/ plasma caliver','1× Skitarii Ranger w/ transuranic arquebus','1× Skitarii Ranger w/ omnispex (Omnispex)','5× Skitarii Ranger w/ galvanic rifle'],
      gear:[['Alpha combat weapon','Close combat weapon','Galvanic rifle'],['Arc rifle','Close combat weapon'],['Close combat weapon','Plasma caliver'],['Close combat weapon','Transuranic arquebus'],['Close combat weapon','Galvanic rifle'],['Close combat weapon','Galvanic rifle']],
      stats:[
        { name:'Skitarii Rangers ×10' }
      ],
      ranged:[
        { name:'Galvanic rifle', n:7, kw:['IGNORES COVER'], from:{ 'IGNORES COVER':'Omnispex' } },
        { name:'Arc rifle', kw:['ANTI-VEHICLE 4+','DEVASTATING WOUNDS','RAPID FIRE 1','IGNORES COVER'], from:{ 'IGNORES COVER':'Omnispex' } },
        { name:'supercharge', kw:['HAZARDOUS','IGNORES COVER'], from:{ 'IGNORES COVER':'Omnispex' } },
        { name:'standard', kw:['IGNORES COVER'], from:{ 'IGNORES COVER':'Omnispex' } },
        { name:'Transuranic arquebus', kw:['HEAVY','PRECISION','IGNORES COVER'], from:{ 'IGNORES COVER':'Omnispex' } }
      ],
      melee:[
        { name:'Alpha combat weapon' },
        { name:'Close combat weapon', n:10 }
      ]
    },
    {
      id:'ironstrider-ballistarii', ds:'adeptus-mechanicus/ironstrider-ballistarii', pts:280,
      models:['3× Ironstrider Ballistarius (Twin cognis lascannon)'],
      gear:[['Ironstrider feet','Twin cognis lascannon']],
      stats:[
        { name:'Ironstrider Ballistarii ×3' }
      ],
      ranged:[
        { name:'Twin cognis lascannon', n:3 }
      ],
      melee:[
        { name:'Ironstrider feet', n:3 }
      ]
    },
    {
      id:'ironstrider-ballistarii-2', ds:'adeptus-mechanicus/ironstrider-ballistarii', pts:250,
      models:['3× Ironstrider Ballistarius (Twin cognis autocannon)'],
      gear:[['Ironstrider feet','Twin cognis autocannon']],
      stats:[
        { name:'Ironstrider Ballistarii ×3' }
      ],
      ranged:[
        { name:'Twin cognis autocannon', n:3 }
      ],
      melee:[
        { name:'Ironstrider feet', n:3 }
      ]
    },
    {
      id:'onager-dunecrawler', ds:'adeptus-mechanicus/onager-dunecrawler', pts:150,
      models:['1× Onager Dunecrawler (Broad spectrum data-tether)'],
      gear:[['Cognis heavy stubber','Dunecrawler legs','Twin Onager heavy phosphor blaster']],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Damaged (1-4 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-4 wounds remaining' }
      ],
      // help this unit gives other units of its list when they are attacked (the Damage tab offers it as a tick box)
      guard:[
        { from:'Emanatus Forcefield', needs:{ all:['Faction: Adeptus Mechanicus','Battleline'] }, kind:'ranged', when:'Wholly within 6" of the Onager Dunecrawler', note:'4+ InSv against ranged attacks', calc:{ insv:4 } }
      ]
    },
    {
      id:'skorpius-disintegrator', ds:'adeptus-mechanicus/skorpius-disintegrator', pts:170, copies:2,
      models:['1× Skorpius Disintegrator'],
      gear:[['Armoured hull','Cognis heavy stubber','Cognis heavy stubber','Cognis heavy stubber','Disruptor missile launcher','Ferrumite cannon']],
      ranged:[
        { name:'Cognis heavy stubber', n:3 },
        { name:'Disruptor missile launcher' },
        { name:'Ferrumite cannon' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables (it has no belleros energy cannon)
      mods:[
        { kind:'ranged', weapon:'Ferrumite cannon', when:'Ferrumite cannon vs MONSTER or VEHICLE targets', note:'+1 to hit rolls', from:'Blistering Salvoes', always:true, vs:{ any:['Monster','Vehicle'] } },
        { kind:'all', when:'Damaged (1-4 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-4 wounds remaining' }
      ]
    }
  ]
},
{
  id:'defilers-and-friends', name:'Defilers and friends', faction:'emperors-children', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Purge the Foe',
  detachments:['coterie-of-the-conceited'],
  source:'New Recruit, exported 22 Oct 2026',
  units:[
    {
      id:'lucius-the-eternal-flawless-blades', ds:['emperors-children/lucius-the-eternal','emperors-children/flawless-blades'], role:'Epic Hero', pts:225, ptsNote:'130 + Flawless Blades 95', warlord:true,
      leads:'Flawless Blades',
      models:['1× Lucius the Eternal','3× Flawless Blade'],
      gear:[['Blade of the Laer','Lash of Torment'],['Blissblade','Bolt pistol']],
      stats:[
        { name:'Lucius the Eternal' },
        { name:'Flawless Blades' }
      ],
      ranged:[
        { name:'Bolt pistol', who:'Flawless Blades', n:3 }
      ],
      melee:[
        { name:'Blade of the Laer', who:'Lucius the Eternal' },
        { name:'Lash of Torment', who:'Lucius the Eternal' },
        { name:'Blissblade', who:'Flawless Blades', n:3 }
      ],
      abilities:[
        { name:'Duellist’s Hubris', who:'Lucius the Eternal' },
        { name:'A Challenge Worthy of Skill', who:'Lucius the Eternal' },
        { name:'Daemonic Patrons', who:'Flawless Blades' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'vs CHARACTER, MONSTER or WALKER units', note:'re-roll the hit roll and the wound roll', from:'A Challenge Worthy of Skill', always:true, vs:{ any:['Character','Monster','Walker'] } },
        { kind:'melee', when:'Called upon daemonic patrons when selected to fight (until the end of the phase)', note:'a Critical Wound on an unmodified wound roll of 3+', from:'Daemonic Patrons', calc:{ critWound:3 } },
        { kind:'melee', when:'5+ Pact points gained during the battle', note:'[LETHAL HITS] and [SUSTAINED HITS 1]', from:'Pledges to the Dark Prince', rule:'Pledges to the Dark Prince' }
      ],
      rules:['Leader','Thrill Seekers','Feel No Pain 5+','Lone Operative','Precision','Sustained Hits','Pistol'],
      kw:['Chaos','Character','Epic Hero','Faction: Emperor\'s Children','Infantry','Lucius the Eternal','Slaanesh','Warlord','Flawless Blades','Grenades'],
      kwNote:'Flawless Blades, Grenades come from the led Flawless Blades.'
    },
    {
      id:'daemon-prince-of-slaanesh-with-wings', ds:'emperors-children/daemon-prince-of-slaanesh-with-wings', pts:205,
      models:['1× Daemon Prince of Slaanesh with Wings'],
      gear:[['Hellforged weapons','Infernal cannon']],
      // the Pledges to the Dark Prince bonus for melee weapons (the detachment rule's footnote has the rest)
      mods:[
        { kind:'melee', when:'5+ Pact points gained during the battle', note:'[LETHAL HITS] and [SUSTAINED HITS 1]', from:'Pledges to the Dark Prince', rule:'Pledges to the Dark Prince' }
      ]
    },
    {
      id:'lord-exultant-infractors', ds:['emperors-children/lord-exultant','emperors-children/infractors'], role:'Character', pts:190, copies:2, ptsNote:'95 + Infractors 95',
      leads:'Infractors',
      models:['1× Lord Exultant','1× Obsessionist','3× Infractor','1× Infractor (Icon of Excess)'],
      gear:[['Bolt pistol','Close combat weapon','Phoenix power spear','Rapture lash'],['Power sword','Plasma pistol'],['Bolt pistol','Duelling sabre'],['Bolt pistol','Duelling sabre']],
      stats:[
        { name:'Lord Exultant' },
        { name:'Infractors' }
      ],
      ranged:[
        { name:'Bolt pistol', who:'Lord Exultant', kw:['PISTOL','LETHAL HITS'], from:{ 'LETHAL HITS':'Perfectionists' } },
        { name:'standard', who:'Infractors', kw:['PISTOL','LETHAL HITS'], from:{ 'LETHAL HITS':'Perfectionists' } },
        { name:'supercharge', who:'Infractors', kw:['HAZARDOUS','PISTOL','LETHAL HITS'], from:{ 'LETHAL HITS':'Perfectionists' } },
        { name:'Bolt pistol', who:'Infractors', n:4, kw:['PISTOL','LETHAL HITS'], from:{ 'LETHAL HITS':'Perfectionists' } }
      ],
      melee:[
        { name:'Close combat weapon', who:'Lord Exultant', kw:['LETHAL HITS'], from:{ 'LETHAL HITS':'Perfectionists' } },
        { name:'Phoenix power spear', who:'Lord Exultant', kw:['LANCE','LETHAL HITS'], from:{ 'LETHAL HITS':'Perfectionists' } },
        { name:'Rapture lash', who:'Lord Exultant', kw:['EXTRA ATTACKS','LETHAL HITS'], from:{ 'LETHAL HITS':'Perfectionists' } },
        { name:'Power sword', who:'Infractors', kw:['PRECISION','LETHAL HITS'], from:{ 'LETHAL HITS':'Perfectionists' } },
        { name:'Duelling sabre', who:'Infractors', n:4, kw:['PRECISION','LETHAL HITS'], from:{ 'LETHAL HITS':'Perfectionists' } }
      ],
      abilities:[
        { name:'Perfectionists', who:'Lord Exultant' },
        { name:'Euphoric Strikes', who:'Lord Exultant' },
        { name:'Lord of the Host', who:'Lord Exultant' },
        { name:'Excessive Assault', who:'Infractors' },
        { name:'Icon of Excess', who:'Infractors' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Euphoric Strikes used at the start of the Fight phase (once per battle)', note:'+3 A and +1 AP', from:'Euphoric Strikes' },
        { kind:'melee', when:'Every melee attack', note:'re-roll wound rolls of 1', from:'Excessive Assault', always:true },
        { kind:'melee', when:'Target within range of an objective marker', cond:'targetObjective', note:'re-roll the wound roll', from:'Excessive Assault' },
        { kind:'melee', when:'5+ Pact points gained during the battle', note:'[LETHAL HITS] and [SUSTAINED HITS 1]', from:'Pledges to the Dark Prince', rule:'Pledges to the Dark Prince' }
      ],
      rules:['Leader','Thrill Seekers','Infiltrators','Scouts 6"','Pistol','Lance','Extra Attacks','Precision','Hazardous'],
      kw:['Chaos','Character','Faction: Emperor\'s Children','Grenades','Infantry','Lord Exultant','Slaanesh','Battleline','Infractors'],
      kwNote:'Battleline, Infractors come from the led Infractors.'
    },
    {
      id:'tormentors', ds:'emperors-children/tormentors', pts:85, copies:2,
      models:['1× Obsessionist','3× Tormentor','1× Tormentor w/ meltagun'],
      // New Recruit prints the Icon of Excess ability on no models line; BSData has it as an option of the unit for one of
      // its models. Neither says which one carries it.
      unplaced:['Icon of Excess'],
      gear:[['Plasma pistol','Power sword'],['Boltgun','Close combat weapon'],['Close combat weapon','Meltagun']],
      ranged:[
        { name:'standard' },
        { name:'supercharge' },
        { name:'Boltgun', n:3 },
        { name:'Meltagun' }
      ],
      melee:[
        { name:'Power sword' },
        { name:'Close combat weapon', n:4 }
      ],
      // the Pledges to the Dark Prince bonus for melee weapons (the detachment rule's footnote has the rest)
      mods:[
        { kind:'melee', when:'5+ Pact points gained during the battle', note:'[LETHAL HITS] and [SUSTAINED HITS 1]', from:'Pledges to the Dark Prince', rule:'Pledges to the Dark Prince' }
      ]
    },
    {
      id:'chaos-rhino', ds:'emperors-children/chaos-rhino', pts:70,
      models:['1× Chaos Rhino'],
      gear:[['Armoured tracks','Combi-bolter','Combi-bolter','Havoc launcher']],
      ranged:[
        { name:'Combi-bolter', n:2 },
        { name:'Havoc launcher' }
      ],
      // the Pledges to the Dark Prince bonus for melee weapons (the detachment rule's footnote has the rest)
      mods:[
        { kind:'melee', when:'5+ Pact points gained during the battle', note:'[LETHAL HITS] and [SUSTAINED HITS 1]', from:'Pledges to the Dark Prince', rule:'Pledges to the Dark Prince' }
      ]
    },
    {
      id:'defiler', ds:'emperors-children/defiler', pts:330,
      models:['1× Defiler'],
      gear:[['Ectoplasma destructor','Heavy reaper autocannon','Heavy reaper autocannon','Shearing claws','Excruciator cannon','Excruciator cannon']],
      ranged:[
        { name:'Ectoplasma destructor' },
        { name:'Excruciator cannon', n:2 },
        { name:'Heavy reaper autocannon', n:2 }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Target not Below Half-strength', note:'+1 to hit rolls', from:'Revel in Desecration' },
        { kind:'all', when:'Damaged (1-6 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-6 wounds remaining' },
        { kind:'melee', when:'5+ Pact points gained during the battle', note:'[LETHAL HITS] and [SUSTAINED HITS 1]', from:'Pledges to the Dark Prince', rule:'Pledges to the Dark Prince' }
      ]
    },
    {
      id:'defiler-2', ds:'emperors-children/defiler', pts:380,
      models:['1× Defiler'],
      gear:[['Ectoplasma destructor','Heavy reaper autocannon','Heavy reaper autocannon','Shearing claws','Excruciator cannon','Excruciator cannon']],
      ranged:[
        { name:'Ectoplasma destructor' },
        { name:'Excruciator cannon', n:2 },
        { name:'Heavy reaper autocannon', n:2 }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Target not Below Half-strength', note:'+1 to hit rolls', from:'Revel in Desecration' },
        { kind:'all', when:'Damaged (1-6 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-6 wounds remaining' },
        { kind:'melee', when:'5+ Pact points gained during the battle', note:'[LETHAL HITS] and [SUSTAINED HITS 1]', from:'Pledges to the Dark Prince', rule:'Pledges to the Dark Prince' }
      ]
    },
    {
      id:'maulerfiend', ds:'emperors-children/maulerfiend', pts:120, copies:2,
      models:['1× Maulerfiend'],
      gear:[['Maulerfiend fists','Magma cutter','Magma cutter']],
      ranged:[
        { name:'Magma cutter', n:2 }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables (one model: below its Starting Strength once it has
      // lost a wound, Below Half-strength at 5 or fewer of its 12 wounds left)
      mods:[
        { kind:'all', when:'Lost any wounds (below Starting Strength)', note:'+1 to hit rolls; also +1 to wound rolls if Below Half-strength', from:'Glutton for Punishment', pick:[{ name:'Below Starting Strength', note:'+1 to hit rolls' },{ name:'Below Half-strength', note:'+1 to hit rolls, +1 to wound rolls' }] },
        { kind:'all', when:'Damaged (1-4 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-4 wounds remaining' },
        { kind:'melee', when:'5+ Pact points gained during the battle', note:'[LETHAL HITS] and [SUSTAINED HITS 1]', from:'Pledges to the Dark Prince', rule:'Pledges to the Dark Prince' }
      ]
    }
  ]
},
{
  id:'infernal-lance', name:'Infernal Lance', faction:'chaos-knights', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Purge the Foe',
  detachments:['infernal-lance'],
  source:'New Recruit, exported 22 Oct 2026',
  units:[
    {
      id:'chaos-cerastus-knight-atrapos', ds:'chaos-knights/chaos-cerastus-knight-atrapos', pts:410, enhancement:'Knight Diabolus',
      models:['1× Chaos Cerastus Knight Atrapos'],
      gear:[['Atrapos lascutter','Graviton singularity cannon']],
      melee:[
        { name:'low intensity', WS:'2+', from:{ WS:'Knight Diabolus' } },
        { name:'high intensity', WS:'2+', from:{ WS:'Knight Diabolus' } }
      ],
      abilities:[
        { name:'Macro-extinction Protocols' },
        { name:'Consumed with Hunger', na:'No WAR DOG in this list' },
        { name:'Damaged: 1-10 wounds remaining' },
        { name:'Knight Diabolus', tag:'Enhancement', text:'**CHAOS KNIGHTS** model only. Improve the Weapon Skill characteristic of the bearer’s melee weapons by 1. While the bearer is using the Diabolic Power ability, its melee weapons have the **[LANCE]** ability.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      // (Knight Diabolus's improved WS is already in the melee profiles, as New Recruit prints them: only its [LANCE] is a footnote)
      mods:[
        { kind:'all', when:'vs MONSTER/VEHICLE', note:'+1 to hit rolls', from:'Macro-extinction Protocols', always:true, vs:{ any:['Monster','Vehicle'] } },
        { kind:'all', when:'vs TITANIC/TOWERING', note:'+1 to wound rolls', from:'Macro-extinction Protocols', always:true, vs:{ any:['Titanic','Towering'], also:{ any:['Monster','Vehicle'] } } },
        { kind:'melee', when:'Using the Diabolic Power ability (Malefic Surge)', note:'melee weapons have [LANCE]', from:'Knight Diabolus' },
        { kind:'all', when:'Damaged (1-10 wounds left)', note:'-1 to hit rolls (and -5 OC)', from:'Damaged: 1-10 wounds remaining' }
      ],
      aura:[
        { kind:'all', needs:{ all:['War Dog'] }, when:'Within 6" of Chaos Cerastus Knight Atrapos, vs a TITANIC or TOWERING unit', note:'re-roll the hit roll', from:'Consumed with Hunger', vs:{ any:['Titanic','Towering'] } }
      ]
    },
    {
      id:'chaos-cerastus-knight-lancer', ds:'chaos-knights/chaos-cerastus-knight-lancer', pts:420, enhancement:'Blasphemous Engine',
      models:['1× Chaos Cerastus Knight Lancer'],
      gear:[['Cerastus shock lance']],
      stats:[
        { name:'Chaos Cerastus Knight Lancer', W:'30', from:{ W:'Blasphemous Engine' } }
      ],
      abilities:[
        { name:'Shock Charge' },
        { name:'Dark Fervour', na:'No WAR DOG in this list' },
        { name:'Damaged: 1-10 wounds remaining' },
        { name:'Blasphemous Engine', tag:'Enhancement', text:'**CHAOS KNIGHTS** model only. Add 2 to the bearer’s Wounds characteristic. Each time the bearer’s unit makes a Malefic Surge, you can re-roll the **Leadership test** taken to see if it suffers any **mortal wounds**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Damaged (1-10 wounds left)', note:'-1 to hit rolls (and -5 OC)', from:'Damaged: 1-10 wounds remaining' }
      ],
      aura:[
        { kind:'ranged', needs:{ all:['War Dog'] }, when:'Within 6" of Chaos Cerastus Knight Lancer', note:'ranged weapons have [ASSAULT]', from:'Dark Fervour' }
      ]
    },
    {
      id:'knight-despoiler', ds:'chaos-knights/knight-despoiler', pts:440, enhancement:'Bestial Aspect', warlord:true,
      models:['1× Knight Despoiler'],
      gear:[['Titanic feet','Ruinspear rocket pod','Diabolus heavy stubber','Despoiler gatling cannon','Despoiler gatling cannon','Heavy darkflamer','Heavy darkflamer']],
      ranged:[
        { name:'Ruinspear rocket pod', kw:['ASSAULT'], from:{ ASSAULT:'Bestial Aspect' } },
        { name:'Despoiler gatling cannon', n:2, kw:['ASSAULT'], from:{ ASSAULT:'Bestial Aspect' } },
        { name:'Heavy darkflamer', n:2, kw:['TORRENT','IGNORES COVER','ASSAULT'], from:{ ASSAULT:'Bestial Aspect' } },
        { name:'Diabolus heavy stubber', kw:['RAPID FIRE 3','ASSAULT'], from:{ ASSAULT:'Bestial Aspect' } }
      ],
      abilities:[
        { name:'Dread Dominion', na:'No WAR DOG in this list' },
        { name:'Seething Hatred' },
        { name:'Damaged: 1-9 wounds remaining' },
        { name:'*Invulnerable Save' },
        { name:'Bestial Aspect', tag:'Enhancement', text:'**CHAOS KNIGHTS** model only. The bearer’s ranged weapons have the **[ASSAULT]** ability. While the bearer is using the Unholy Hunger ability, it can ignore any or all modifiers to its Move characteristic and/or to **Advance rolls** made for its unit.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      // (Bestial Aspect's [ASSAULT] is already on every ranged weapon, as New Recruit prints them: no footnote)
      mods:[
        { kind:'all', when:'Selected to shoot or fight', note:'re-roll one hit roll or one wound roll', from:'Seething Hatred' },
        { kind:'all', when:'Damaged (1-9 wounds left)', note:'-1 to hit rolls (and -5 OC)', from:'Damaged: 1-9 wounds remaining' }
      ],
      rules:['Super-Heavy Walker','Deadly Demise D6','Harbingers of Dread','Assault','Torrent','Ignores Cover','Rapid Fire'],
      kw:['Abhorrent','Chaos','Character','Faction: Chaos Knights','Knight Despoiler','Titanic','Towering','Vehicle','Walker','Warlord'],
      why:{ kw:{ Warlord:'Warlord' }, rules:{ Assault:'Bestial Aspect' } }
    },
    {
      id:'knight-ruinator-fleshmetal-fusion', ds:'chaos-knights/knight-ruinator', pts:360, enhancement:'Fleshmetal Fusion',
      models:['1× Knight Ruinator'],
      gear:[['Darkflame lance','Fellbore','Terrorpulse missiles']],
      stats:[
        { name:'Knight Ruinator', T:'12', from:{ T:'Fleshmetal Fusion' } }
      ],
      abilities:[
        { name:'Methodical Destruction' },
        { name:'Close-range Killers', na:'No WAR DOG in this list' },
        { name:'Damaged: 1-9 wounds remaining' },
        { name:'*Invulnerable Save' },
        { name:'Fleshmetal Fusion', tag:'Enhancement', text:'**CHAOS KNIGHTS** model only. Add 1 to the bearer’s Toughness characteristic. While the bearer is using the Unnatural Fortitude ability, each time an attack with a Damage characteristic of 1 is allocated to the bearer, add 1 to any armour saving throw made against that attack.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Target is its victim (selected at the start of the first battle round, and a new one each time its victim is destroyed)', note:'re-roll the wound roll', from:'Methodical Destruction' },
        { kind:'all', when:'Damaged (1-9 wounds left)', note:'-1 to hit rolls (and -5 OC)', from:'Damaged: 1-9 wounds remaining' }
      ],
      aura:[
        { kind:'all', needs:{ all:['War Dog'] }, when:'Within 9" of Knight Ruinator, target is the closest enemy unit', note:'improve AP by 1', from:'Close-range Killers' }
      ]
    },
    {
      id:'knight-ruinator', ds:'chaos-knights/knight-ruinator', pts:325,
      models:['1× Knight Ruinator'],
      gear:[['Darkflame lance','Fellbore','Terrorpulse missiles']],
      abilities:[
        { name:'Methodical Destruction' },
        { name:'Close-range Killers', na:'No WAR DOG in this list' },
        { name:'Damaged: 1-9 wounds remaining' },
        { name:'*Invulnerable Save' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Target is its victim (selected at the start of the first battle round, and a new one each time its victim is destroyed)', note:'re-roll the wound roll', from:'Methodical Destruction' },
        { kind:'all', when:'Damaged (1-9 wounds left)', note:'-1 to hit rolls (and -5 OC)', from:'Damaged: 1-9 wounds remaining' }
      ],
      aura:[
        { kind:'all', needs:{ all:['War Dog'] }, when:'Within 9" of Knight Ruinator, target is the closest enemy unit', note:'improve AP by 1', from:'Close-range Killers' }
      ]
    },
    {
      id:'nurglings', ds:'chaos-knights/nurglings', pts:45,
      models:['3× Nurgling Swarm'],
      gear:[['Diseased claws and teeth']],
      melee:[
        { name:'Diseased claws and teeth', n:3 }
      ]
    }
  ]
},
{
  id:'woof-woof', name:'Woof Woof', faction:'chaos-knights', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Reconnaissance',
  detachments:['houndpack-lance','hunting-warpack'],
  source:'New Recruit, exported 22 Oct 2026',
  units:[
    {
      id:'war-dog-brigand-final-howl-aura', ds:'chaos-knights/war-dog-brigand', role:'Battleline', pts:155, enhancement:'Final Howl (Aura)', warlord:true,
      models:['1× War Dog Brigand (Houndpack Lance Character)'],
      gear:[['Armoured feet','Avenger chaincannon','Daemonbreath spear','Diabolus heavy stubber']],
      abilities:[
        { name:'Brigand' },
        { name:'Damaged: 1-5 wounds remaining' },
        { name:'*Invulnerable Save' },
        { name:'Final Howl (Aura)', tag:'Enhancement · Aura', text:'**WAR DOG** model only. While a friendly War Dog model is within 6" of the bearer, each time that model makes an attack, re-roll a **Wound roll** of 1.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target in range of an objective marker', cond:'targetObjective', note:'ranged attacks have [IGNORES COVER]', from:'Brigand' },
        { kind:'all', when:'Damaged (1-5 wounds left)', note:'-1 to hit rolls (and -3 OC)', from:'Damaged: 1-5 wounds remaining' }
      ],
      aura:[
        { kind:'all', needs:{ all:['War Dog'] }, when:'Within 6" of the War Dog Brigand with Final Howl', selfWhen:'Own aura', note:'re-roll wound rolls of 1', from:'Final Howl (Aura)', selfAlways:true }
      ],
      kw:['Battleline','Brigand','Chaos','Character','Faction: Chaos Knights','Vehicle','Walker','War Dog','Warlord'],
      kwNote:'Character comes from Houndpack Lance Character (Houndpack Lance: “When mustering your army, select three WAR DOG units from your army. Until the end of the battle, those units have the CHARACTER keyword.”).',
      why:{ kw:{ Warlord:'Warlord', Battleline:'Marked Prey', Character:'Marked Prey' }, role:{ Battleline:'Marked Prey' } }
    },
    {
      id:'war-dog-brigand', ds:'chaos-knights/war-dog-brigand', role:'Battleline', pts:135,
      models:['1× War Dog Brigand (Houndpack Lance Character)'],
      gear:[['Armoured feet','Avenger chaincannon','Daemonbreath spear','Diabolus heavy stubber']],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target in range of an objective marker', cond:'targetObjective', note:'ranged attacks have [IGNORES COVER]', from:'Brigand' },
        { kind:'all', when:'Damaged (1-5 wounds left)', note:'-1 to hit rolls (and -3 OC)', from:'Damaged: 1-5 wounds remaining' }
      ],
      kw:['Battleline','Brigand','Chaos','Character','Faction: Chaos Knights','Vehicle','Walker','War Dog'],
      kwNote:'Character comes from Houndpack Lance Character (Houndpack Lance: “When mustering your army, select three WAR DOG units from your army. Until the end of the battle, those units have the CHARACTER keyword.”).',
      why:{ kw:{ Battleline:'Marked Prey', Character:'Marked Prey' }, role:{ Battleline:'Marked Prey' } }
    },
    {
      id:'war-dog-brigand-2', ds:'chaos-knights/war-dog-brigand', role:'Battleline', pts:135, copies:3,
      models:['1× War Dog Brigand'],
      gear:[['Armoured feet','Avenger chaincannon','Daemonbreath spear','Diabolus heavy stubber']],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target in range of an objective marker', cond:'targetObjective', note:'ranged attacks have [IGNORES COVER]', from:'Brigand' },
        { kind:'all', when:'Damaged (1-5 wounds left)', note:'-1 to hit rolls (and -3 OC)', from:'Damaged: 1-5 wounds remaining' }
      ],
      kw:['Battleline','Brigand','Chaos','Faction: Chaos Knights','Vehicle','Walker','War Dog'],
      why:{ kw:{ Battleline:'Marked Prey' }, role:{ Battleline:'Marked Prey' } }
    },
    {
      id:'war-dog-executioner', ds:'chaos-knights/war-dog-executioner', role:'Battleline', pts:140, copies:3, upgrade:'Snarling Rivalry',
      models:['1× War Dog Executioner'],
      gear:[['Armoured feet','War Dog autocannon','War Dog autocannon','Diabolus heavy stubber']],
      ranged:[
        { name:'War Dog autocannon', n:2, kw:['IGNORES COVER'], from:{ 'IGNORES COVER':'Snarling Rivalry' } },
        { name:'Diabolus heavy stubber', kw:['RAPID FIRE 3','IGNORES COVER'], from:{ 'IGNORES COVER':'Snarling Rivalry' } }
      ],
      abilities:[
        { name:'Executioner' },
        { name:'Damaged: 1-5 wounds remaining' },
        { name:'*Invulnerable Save' },
        { name:'Snarling Rivalry', tag:'Upgrade', text:'**EXECUTIONER** unit only. This unit’s ranged attacks have **[IGNORES COVER]**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      // (Snarling Rivalry's [IGNORES COVER] is already on every ranged weapon, as New Recruit prints them: no footnote)
      mods:[
        { kind:'all', when:'Target Below Half-strength', note:'+1 to hit rolls', from:'Executioner' },
        { kind:'all', when:'Damaged (1-5 wounds left)', note:'-1 to hit rolls (and -3 OC)', from:'Damaged: 1-5 wounds remaining' }
      ],
      kw:['Battleline','Chaos','Executioner','Faction: Chaos Knights','Vehicle','Walker','War Dog'],
      why:{ kw:{ Battleline:'Marked Prey' }, role:{ Battleline:'Marked Prey' } }
    },
    {
      id:'war-dog-karnivore-panoply-of-the-cursed-knights', ds:'chaos-knights/war-dog-karnivore', role:'Battleline', pts:160, enhancement:'Panoply of the Cursed Knights',
      models:['1× War Dog Karnivore (Houndpack Lance Character)'],
      gear:[['Reaper chaintalon','Slaughterclaw','Diabolus heavy stubber']],
      abilities:[
        { name:'Karnivore' },
        { name:'Damaged: 1-5 wounds remaining' },
        { name:'*Invulnerable Save' },
        { name:'Panoply of the Cursed Knights', tag:'Enhancement', def:'worsen the AP of each attack that targets it by 1', text:'**WAR DOG** model only. Each time an attack targets the bearer, worsen the Armour Penetration characteristic of that attack by 1.', defOf:'6b3ad7c8' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Damaged (1-5 wounds left)', note:'-1 to hit rolls (and -3 OC)', from:'Damaged: 1-5 wounds remaining' }
      ],
      kw:['Battleline','Chaos','Character','Faction: Chaos Knights','Karnivore','Vehicle','Walker','War Dog'],
      kwNote:'Character comes from Houndpack Lance Character (Houndpack Lance: “When mustering your army, select three WAR DOG units from your army. Until the end of the battle, those units have the CHARACTER keyword.”).',
      why:{ kw:{ Battleline:'Marked Prey', Character:'Marked Prey' }, role:{ Battleline:'Marked Prey' } }
    },
    {
      id:'war-dog-karnivore', ds:'chaos-knights/war-dog-karnivore', role:'Battleline', pts:145, copies:5,
      models:['1× War Dog Karnivore'],
      gear:[['Reaper chaintalon','Slaughterclaw','Diabolus heavy stubber']],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Damaged (1-5 wounds left)', note:'-1 to hit rolls (and -3 OC)', from:'Damaged: 1-5 wounds remaining' }
      ],
      kw:['Battleline','Chaos','Faction: Chaos Knights','Karnivore','Vehicle','Walker','War Dog'],
      why:{ kw:{ Battleline:'Marked Prey' }, role:{ Battleline:'Marked Prey' } }
    }
  ]
},
{
  id:'big-demons-baby', name:'Big demons baby', faction:'world-eaters', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Priority Assets',
  detachments:['khorne-daemonkin','vessels-of-wrath'],
  source:'New Recruit, exported 23 Oct 2026',
  units:[
    {
      id:'angron', ds:'world-eaters/angron', pts:330, warlord:true,
      models:['1× Angron'],
      gear:[['Samni’arius and Spinegrinder']],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Damaged (1-6 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-6 wounds remaining' }
      ],
      aura:[
        { kind:'melee', needs:{ all:['Faction: World Eaters'] }, when:'Within 6" of Angron, if he has Driven by Ultimate Rage this round', selfWhen:'Own aura, if he has Driven by Ultimate Rage this round', note:'re-roll hit rolls of 1 and wound rolls of 1', from:'Driven by Ultimate Rage' }
      ],
      kw:['Angron','Chaos','Character','Daemon','Epic Hero','Faction: World Eaters','Fly','Khorne','Monster','Primarch','Warlord'],
      why:{ kw:{ Warlord:'Warlord' } }
    },
    {
      id:'skarbrand', ds:'world-eaters/skarbrand', pts:315,
      models:['1× Skarbrand'],
      gear:[['Bellow of endless fury','Slaughter and Carnage']],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Damaged (1-7 wounds left)', note:'+2 A', from:'Damaged: 1-7 wounds remaining' }
      ],
      // "a friendly BLOOD LEGIONS unit": an attached unit with a BLOOD LEGIONS model (the Lord on Juggernaut with Disciple of Khorne) is one
      aura:[
        { kind:'melee', needs:{ any:['Faction: Blood Legions'] }, when:'Within 6" of Skarbrand', selfWhen:'Own aura', note:'+1 A', from:'Rage Embodied', selfAlways:true }
      ]
    },
    {
      id:'bloodthirster', ds:'world-eaters/bloodthirster', pts:320,
      models:['1× Bloodthirster'],
      gear:[['Hellfire breath','Great axe of Khorne']],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Damaged (1-6 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-6 wounds remaining' }
      ],
      // "a friendly BLOOD LEGIONS unit": an attached unit with a BLOOD LEGIONS model (the Lord on Juggernaut with Disciple of Khorne) is one
      aura:[
        { kind:'melee', needs:{ any:['Faction: Blood Legions'] }, when:'Within 6" of the Bloodthirster', selfWhen:'Own aura', note:'+1 to hit', from:'Daemon Lord of Khorne', selfAlways:true }
      ]
    },
    {
      id:'daemon-prince-of-khorne', ds:'world-eaters/daemon-prince-of-khorne', short:'Daemon Prince', pts:230, enhancement:'Blade of Endless Bloodshed',
      models:['1× Daemon Prince of Khorne'],
      gear:[['Hellforged weapons','Infernal cannon']],
      melee:[
        { name:'strike', A:'9', S:'9', D:'4', from:{ A:'Blade of Endless Bloodshed', S:'Blade of Endless Bloodshed', D:'Blade of Endless Bloodshed' } },
        { name:'sweep', A:'17', S:'7', D:'2', from:{ A:'Blade of Endless Bloodshed', S:'Blade of Endless Bloodshed', D:'Blade of Endless Bloodshed' } }
      ],
      abilities:[
        { name:'Lord of Murder' },
        { name:'Devastating Assault' },
        { name:'Direct the Slaughter' },
        { name:'Blade of Endless Bloodshed', tag:'Enhancement', text:'**WORLD EATERS** model only. Add 1 to the Attacks, Strength and Damage characteristics of the bearer’s melee weapons. Each time the bearer’s unit destroys an enemy unit with a melee attack, do not roll to gain a Blood Tithe point, you automatically gain 1 Blood Tithe point instead.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Made a charge move this turn', cond:'charged', note:'Hellforged weapons have [DEVASTATING WOUNDS] until the end of the turn', from:'Devastating Assault' }
      ]
    },
    {
      id:'master-of-executions', ds:'world-eaters/master-of-executions', pts:80, enhancement:'Blood-forged Armour',
      models:['1× Master of Executions'],
      gear:[['Axe of dismemberment','Bolt pistol']],
      stats:[
        { name:'Master of Executions', Sv:'2+', from:{ Sv:'Blood-forged Armour' } }
      ],
      abilities:[
        { name:'A Worthy Skull' },
        { name:'Forwards, For Blood!', na:'Not leading a unit in this list' },
        { name:'Blood-forged Armour', tag:'Enhancement', text:'**BLOOD LEGIONS** or **WORLD EATERS** model only. The bearer has a Save characteristic of 2+. If the bearer is destroyed, you gain 1 Blood Tithe point.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Melee attacks that target a CHARACTER unit', note:'can re-roll the hit roll and the wound roll', from:'A Worthy Skull', vs:{ any:['Character'] } }
      ]
    },
    {
      id:'lord-on-juggernaut-khorne-berzerkers', ds:['world-eaters/lord-on-juggernaut','world-eaters/khorne-berzerkers'], pts:440, ptsNote:'110 + Khorne Berzerkers 330', enhancement:'Disciple of Khorne',
      leads:'Khorne Berzerkers',
      models:['1× Lord on Juggernaut','1× Khorne Berzerker Champion (Icon of Khorne)','15× Khorne Berzerker','4× Khorne Berzerker w/ eviscerator and plasma pistol'],
      gear:[['Bladed horn','Exalted chainblade','Plasma pistol'],['Chainblade','Plasma pistol'],['Bolt pistol','Chainblade'],['Khornate eviscerator','Plasma pistol']],
      stats:[
        { name:'Lord on Juggernaut' },
        { name:'Khorne Berzerker ×20', M:'10"', from:{ M:'Aggressive Advance' } }
      ],
      ranged:[
        { name:'standard', who:'Lord on Juggernaut' },
        { name:'supercharge', who:'Lord on Juggernaut' },
        { name:'standard', who:'Khorne Berzerkers', n:5 },
        { name:'supercharge', who:'Khorne Berzerkers', n:5 },
        { name:'Bolt pistol', who:'Khorne Berzerkers', n:15 }
      ],
      melee:[
        { name:'Bladed horn', who:'Lord on Juggernaut' },
        { name:'Exalted chainblade', who:'Lord on Juggernaut' },
        { name:'Chainblade', who:'Khorne Berzerkers', n:16 },
        { name:'Khornate eviscerator', who:'Khorne Berzerkers', n:4 }
      ],
      abilities:[
        { name:'Aggressive Advance', who:'Lord on Juggernaut' },
        { name:'Crush All Who Stand Before Us', who:'Lord on Juggernaut' },
        { name:'Disciple of Khorne', who:'Lord on Juggernaut', tag:'Enhancement', text:'**LORD ON JUGGERNAUT** model only. The bearer has the Deep Strike ability, and it has the **BLOOD LEGIONS** Faction keyword instead of the **WORLD EATERS** Faction keyword.' },
        { name:'Blood Surge', who:'Khorne Berzerkers' },
        { name:'Murderous Charge', who:'Khorne Berzerkers' },
        { name:'Icon of Khorne', who:'Khorne Berzerkers' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Made a charge move this turn', cond:'charged', note:'+1 S', from:'Murderous Charge' }
      ],
      rules:['Leader','Blessings of Khorne','Deep Strike','Extra Attacks','Lance','Pistol','Hazardous'],
      kw:['Chaos','Character','Faction: Blood Legions','Khorne','Lord on Juggernaut','Mounted','Battleline','Berzerkers','Faction: World Eaters','Grenades','Infantry'],
      kwNote:'Battleline, Berzerkers, Faction: World Eaters, Grenades, Infantry come from the led Khorne Berzerkers; Faction: Blood Legions comes from Disciple of Khorne on the Lord on Juggernaut (“The bearer has the Deep Strike ability, and it has the BLOOD LEGIONS Faction keyword instead of the WORLD EATERS Faction keyword.”).',
      // Deep Strike is the Lord on Juggernaut's (Disciple of Khorne); the Khorne Berzerkers don't have it, so the unit can't use it (24.09)
      partialRules:{ 'Deep Strike':'Lord on Juggernaut' }
    },
    {
      id:'goremongers', ds:'world-eaters/goremongers', pts:70,
      models:['1× Blood Herald','7× Goremonger w/ chainblade'],
      gear:[['Autopistol','Chainblade','Close combat weapon'],['Autopistol','Chainblade','Close combat weapon']],
      ranged:[
        { name:'Autopistol', n:8 }
      ],
      melee:[
        { name:'Chainblade', n:8 },
        { name:'Close combat weapon', n:8 }
      ]
    },
    {
      id:'jakhals', ds:'world-eaters/jakhals', pts:65,
      models:['1× Jakhal Pack Leader','1× Dishonoured w/ paired manglers','8× Jakhal'],
      gear:[['Autopistol','Chainblades'],['Paired manglers'],['Autopistol','Chainblades']],
      ranged:[
        { name:'Autopistol', n:9 }
      ],
      melee:[
        { name:'Chainblades', n:9 },
        { name:'Paired manglers' }
      ]
    },
    {
      id:'flesh-hounds', ds:'world-eaters/flesh-hounds', pts:75, copies:2,
      models:['1× Gore Hound (Collar of Khorne)','4× Flesh Hound (Collar of Khorne)'],
      gear:[['Burning roar','Gore-drenched fangs'],['Gore-drenched fangs']],
      melee:[
        { name:'Gore-drenched fangs', n:5 }
      ]
    }
  ]
},
{
  id:'mucho-mutantes', name:'Mucho Mutantes', faction:'thousand-sons', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Purge the Foe',
  detachments:['ritual-of-regeneration','warpmeld-pact'],
  source:'New Recruit, exported 23 Oct 2026',
  units:[
    {
      id:'magnus-the-red', ds:'thousand-sons/magnus-the-red', pts:455, warlord:true,
      models:['1× Magnus the Red'],
      gear:[['Blade of Magnus','Gaze of Magnus','Tzeentch’s Firestorm']],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Damaged (1-6 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-6 wounds remaining' }
      ],
      kw:['Chaos','Character','Daemon','Epic Hero','Faction: Thousand Sons','Fly','Magnus the Red','Monster','Primarch','Psyker','Tzeentch','Warlord'],
      why:{ kw:{ Warlord:'Warlord' } }
    },
    {
      id:'ahriman-tzaangor-enlightened-with-fatecaster-greatbows', ds:['thousand-sons/ahriman','thousand-sons/tzaangor-enlightened-with-fatecaster-greatbows'], role:'Epic Hero', pts:215, ptsNote:'105 + Tzaangor Enlightened with Fatecaster greatbows 110',
      leads:'Tzaangor Enlightened with Fatecaster greatbows',
      models:['1× Ahriman','1× Aviarch','5× Enlightened'],
      gear:[['Black Staff of Ahriman','Inferno bolt pistol','Transmogrifying Blast'],['Close combat weapon','Fatecaster greatbow'],['Close combat weapon','Fatecaster greatbow']],
      stats:[
        { name:'Ahriman' },
        { name:'Tzaangor Enlightened with Fatecaster greatbows' }
      ],
      ranged:[
        { name:'Inferno bolt pistol', who:'Ahriman' },
        { name:'Transmogrifying Blast', who:'Ahriman' },
        { name:'Fatecaster greatbow', who:'Tzaangor Enlightened with Fatecaster greatbows', n:6 }
      ],
      melee:[
        { name:'Black Staff of Ahriman', who:'Ahriman' },
        { name:'Close combat weapon', who:'Tzaangor Enlightened with Fatecaster greatbows', n:6 }
      ],
      abilities:[
        { name:'Scryer of Fates', who:'Ahriman' },
        { name:'Arch-Sorcerer of Tzeentch', who:'Ahriman' },
        { name:'Malign Trickery', who:'Tzaangor Enlightened with Fatecaster greatbows' }
      ],
      rules:['Leader','Cabal of Sorcerers','Psychic','Pistol','Blast','Ignores Cover','Lethal Hits','Precision'],
      kw:['Ahriman','Chaos','Character','Epic Hero','Faction: Thousand Sons','Fly','Infantry','Mounted','Psyker','Tzeentch','Mutant','Tzaangor Enlightened','Tzaangor Enlightened with Fatecaster Greatbows'],
      kwNote:'Mutant, Tzaangor Enlightened, Tzaangor Enlightened with Fatecaster Greatbows come from the led Tzaangor Enlightened with Fatecaster greatbows.',
      partialRules:{ 'Cabal of Sorcerers':'Ahriman' },
      // Wahapedia: Ahriman is INFANTRY, MOUNTED … PSYKER; the Tzaangor Enlightened with Fatecaster greatbows are MOUNTED, not INFANTRY or
      // PSYKER, and have no Cabal of Sorcerers (BSData the same)
      kwOnly:{ Infantry:'Ahriman', Psyker:'Ahriman' }
    },
    {
      id:'daemon-prince-of-tzeentch-with-wings', ds:'thousand-sons/daemon-prince-of-tzeentch-with-wings', pts:170,
      models:['1× Daemon Prince of Tzeentch with wings'],
      gear:[['Dark Blessing','Hellforged weapons','Infernal cannon']],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'vs CHARACTER units', note:'re-roll hit rolls of 1 and wound rolls of 1', from:'Hunter of Souls', always:true, vs:{ any:['Character'] } },
        { kind:'all', when:'vs PSYKER CHARACTER units', note:'re-roll the hit roll and the wound roll', from:'Hunter of Souls', always:true, vs:{ all:['Psyker','Character'] } },
        { kind:'ranged', when:'After an aetherstride this turn', note:'Dark Blessing has [SUSTAINED HITS D3]', from:'Aetherstride', calc:{ sus:'D3', weapon:'Dark Blessing' }, lasts:'turn' }
      ]
    },
    {
      id:'exalted-sorcerer-on-disc-of-tzeentch-tzaangor-enlightened-with-fatecaster-greatbows', ds:['thousand-sons/exalted-sorcerer-on-disc-of-tzeentch','thousand-sons/tzaangor-enlightened-with-fatecaster-greatbows'], role:'Character', pts:205, copies:2, ptsNote:'95 + Tzaangor Enlightened with Fatecaster greatbows 110',
      leads:'Tzaangor Enlightened with Fatecaster greatbows',
      models:['1× Exalted Sorcerer on Disc of Tzeentch','1× Aviarch','5× Enlightened'],
      gear:[['Arcane Fire','Force weapon','Inferno bolt pistol','Prosperine khopesh'],['Close combat weapon','Fatecaster greatbow'],['Close combat weapon','Fatecaster greatbow']],
      stats:[
        { name:'Exalted Sorcerer on Disc of Tzeentch' },
        { name:'Tzaangor Enlightened with Fatecaster greatbows' }
      ],
      ranged:[
        { name:'Arcane Fire', who:'Exalted Sorcerer on Disc of Tzeentch' },
        { name:'Inferno bolt pistol', who:'Exalted Sorcerer on Disc of Tzeentch' },
        { name:'Fatecaster greatbow', who:'Tzaangor Enlightened with Fatecaster greatbows', n:6 }
      ],
      melee:[
        { name:'Force weapon', who:'Exalted Sorcerer on Disc of Tzeentch' },
        { name:'Prosperine khopesh', who:'Exalted Sorcerer on Disc of Tzeentch' },
        { name:'Close combat weapon', who:'Tzaangor Enlightened with Fatecaster greatbows', n:6 }
      ],
      abilities:[
        { name:'Illusions of Tzeentch', who:'Exalted Sorcerer on Disc of Tzeentch' },
        { name:'Binding Tendrils', who:'Exalted Sorcerer on Disc of Tzeentch' },
        { name:'Malign Trickery', who:'Tzaangor Enlightened with Fatecaster greatbows' }
      ],
      rules:['Leader','Cabal of Sorcerers','Torrent','Ignores Cover','Psychic','Pistol','Lethal Hits','Precision'],
      kw:['Chaos','Character','Exalted Sorcerer','Faction: Thousand Sons','Fly','Grenades','Infantry','Mounted','Psyker','Tzeentch','Mutant','Tzaangor Enlightened','Tzaangor Enlightened with Fatecaster Greatbows'],
      kwNote:'Mutant, Tzaangor Enlightened, Tzaangor Enlightened with Fatecaster Greatbows come from the led Tzaangor Enlightened with Fatecaster greatbows.',
      partialRules:{ 'Cabal of Sorcerers':'Exalted Sorcerer on Disc of Tzeentch' },
      // Wahapedia: the Exalted Sorcerer on Disc of Tzeentch is INFANTRY, MOUNTED … GRENADES, PSYKER; the Tzaangor Enlightened with Fatecaster
      // greatbows are MOUNTED, without those, and have no Cabal of Sorcerers (BSData the same)
      kwOnly:{ Grenades:'Exalted Sorcerer on Disc of Tzeentch', Infantry:'Exalted Sorcerer on Disc of Tzeentch', Psyker:'Exalted Sorcerer on Disc of Tzeentch' }
    },
    {
      id:'tzaangor-shaman-tzaangor-enlightened-curse-of-life', ds:['thousand-sons/tzaangor-shaman','thousand-sons/tzaangor-enlightened'], role:'Character', pts:175, ptsNote:'85 + Tzaangor Enlightened 90', enhancement:'Curse of Life',
      leads:'Tzaangor Enlightened',
      models:['1× Tzaangor Shaman','1× Aviarch','5× Divining spear Enlightened'],
      gear:[['Baleful Devolution','Force stave'],['Divining spear'],['Divining spear']],
      stats:[
        { name:'Tzaangor Shaman' },
        { name:'Tzaangor Enlightened' }
      ],
      ranged:[
        { name:'Baleful Devolution', who:'Tzaangor Shaman' }
      ],
      melee:[
        { name:'Force stave', who:'Tzaangor Shaman' },
        { name:'Divining spear', who:'Tzaangor Enlightened', n:6 }
      ],
      abilities:[
        { name:'Sacrificial Blessing', who:'Tzaangor Shaman' },
        { name:'Bestial Prophet', who:'Tzaangor Shaman' },
        { name:'Curse of Life', who:'Tzaangor Shaman', tag:'Enhancement', ph:['shooting'], turn:'your', text:'**INFANTRY**/**MOUNTED THOUSAND SONS PSYKER** model only. When this model **heals** as a result of the **Sorcerous Invigoration detachment rule**, you can add 3 to the number of wounds **healed**.' },
        { name:'Prophesied Doom', who:'Tzaangor Enlightened' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      // Bestial Prophet: every model of the unit it leads, the Shaman included; New Recruit does not print it in the hit rolls
      mods:[
        { kind:'all', when:'Every attack (this model leads the unit)', note:'+1 to hit rolls', from:'Bestial Prophet', always:true },
        { kind:'all', who:'Tzaangor Shaman', when:'Sacrificial Blessing used this phase (your Shooting phase or the Fight phase; one Bodyguard model destroyed)', note:'Psychic weapons +D3 A and +D3 S', from:'Sacrificial Blessing' }
      ],
      rules:['Leader','Cabal of Sorcerers','Devastating Wounds','Blast','Psychic','Lance','Precision'],
      kw:['Chaos','Character','Faction: Thousand Sons','Fly','Infantry','Mounted','Mutant','Psyker','Tzaangor Shaman','Tzeentch','Tzaangor Enlightened'],
      kwNote:'Tzaangor Enlightened comes from the led Tzaangor Enlightened.',
      partialRules:{ 'Cabal of Sorcerers':'Tzaangor Shaman' },
      // Wahapedia: the Tzaangor Shaman is INFANTRY, MOUNTED … PSYKER; the Tzaangor Enlightened are MOUNTED, not INFANTRY or PSYKER, and have
      // no Cabal of Sorcerers (BSData the same)
      kwOnly:{ Infantry:'Tzaangor Shaman', Psyker:'Tzaangor Shaman' }
    },
    {
      id:'tzaangor-shaman-tzaangor-enlightened-diamond-of-distortion', ds:['thousand-sons/tzaangor-shaman','thousand-sons/tzaangor-enlightened'], role:'Character', pts:175, ptsNote:'85 + Tzaangor Enlightened 90', enhancement:'Diamond of Distortion',
      leads:'Tzaangor Enlightened',
      models:['1× Tzaangor Shaman','1× Aviarch','5× Divining spear Enlightened'],
      gear:[['Baleful Devolution','Force stave'],['Divining spear'],['Divining spear']],
      stats:[
        { name:'Tzaangor Shaman' },
        { name:'Tzaangor Enlightened' }
      ],
      ranged:[
        { name:'Baleful Devolution', who:'Tzaangor Shaman' }
      ],
      melee:[
        { name:'Force stave', who:'Tzaangor Shaman' },
        { name:'Divining spear', who:'Tzaangor Enlightened', n:6 }
      ],
      abilities:[
        { name:'Sacrificial Blessing', who:'Tzaangor Shaman' },
        { name:'Bestial Prophet', who:'Tzaangor Shaman' },
        { name:'Diamond of Distortion', who:'Tzaangor Shaman', tag:'Enhancement', def:'-1 to hit rolls against it (while the bearer leads it)', text:'**TZAANGOR SHAMAN** model only. While the bearer is leading a unit, each time an attack targets that unit, subtract 1 from the **Hit roll**.', defOf:'ee6006b5' },
        { name:'Prophesied Doom', who:'Tzaangor Enlightened' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      // Bestial Prophet: every model of the unit it leads, the Shaman included; New Recruit does not print it in the hit rolls
      mods:[
        { kind:'all', when:'Every attack (this model leads the unit)', note:'+1 to hit rolls', from:'Bestial Prophet', always:true },
        { kind:'all', who:'Tzaangor Shaman', when:'Sacrificial Blessing used this phase (your Shooting phase or the Fight phase; one Bodyguard model destroyed)', note:'Psychic weapons +D3 A and +D3 S', from:'Sacrificial Blessing' }
      ],
      rules:['Leader','Cabal of Sorcerers','Devastating Wounds','Blast','Psychic','Lance','Precision'],
      kw:['Chaos','Character','Faction: Thousand Sons','Fly','Infantry','Mounted','Mutant','Psyker','Tzaangor Shaman','Tzeentch','Tzaangor Enlightened'],
      kwNote:'Tzaangor Enlightened comes from the led Tzaangor Enlightened.',
      partialRules:{ 'Cabal of Sorcerers':'Tzaangor Shaman' },
      // Wahapedia: the Tzaangor Shaman is INFANTRY, MOUNTED … PSYKER; the Tzaangor Enlightened are MOUNTED, not INFANTRY or PSYKER, and have
      // no Cabal of Sorcerers (BSData the same)
      kwOnly:{ Infantry:'Tzaangor Shaman', Psyker:'Tzaangor Shaman' }
    },
    {
      id:'tzaangor-shaman-tzaangor-enlightened-flowing-flesh', ds:['thousand-sons/tzaangor-shaman','thousand-sons/tzaangor-enlightened'], role:'Character', pts:165, ptsNote:'75 + Tzaangor Enlightened 90', enhancement:'Flowing Flesh',
      leads:'Tzaangor Enlightened',
      models:['1× Tzaangor Shaman','1× Aviarch','5× Divining spear Enlightened'],
      gear:[['Baleful Devolution','Force stave'],['Divining spear'],['Divining spear']],
      stats:[
        { name:'Tzaangor Shaman', W:'5', from:{ W:'Flowing Flesh' } },
        { name:'Tzaangor Enlightened' }
      ],
      ranged:[
        { name:'Baleful Devolution', who:'Tzaangor Shaman' }
      ],
      melee:[
        { name:'Force stave', who:'Tzaangor Shaman' },
        { name:'Divining spear', who:'Tzaangor Enlightened', n:6 }
      ],
      abilities:[
        { name:'Sacrificial Blessing', who:'Tzaangor Shaman' },
        { name:'Bestial Prophet', who:'Tzaangor Shaman' },
        { name:'Flowing Flesh', who:'Tzaangor Shaman', tag:'Enhancement', text:'**TZAANGOR SHAMAN** model only. The bearer has the **Feel No Pain 4+** ability and a Wounds characteristic of 5.' },
        { name:'Prophesied Doom', who:'Tzaangor Enlightened' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      // Bestial Prophet: every model of the unit it leads, the Shaman included; New Recruit does not print it in the hit rolls
      mods:[
        { kind:'all', when:'Every attack (this model leads the unit)', note:'+1 to hit rolls', from:'Bestial Prophet', always:true },
        { kind:'all', who:'Tzaangor Shaman', when:'Sacrificial Blessing used this phase (your Shooting phase or the Fight phase; one Bodyguard model destroyed)', note:'Psychic weapons +D3 A and +D3 S', from:'Sacrificial Blessing' }
      ],
      rules:['Leader','Cabal of Sorcerers','Feel No Pain 4+','Devastating Wounds','Blast','Psychic','Lance','Precision'],
      kw:['Chaos','Character','Faction: Thousand Sons','Fly','Infantry','Mounted','Mutant','Psyker','Tzaangor Shaman','Tzeentch','Tzaangor Enlightened'],
      kwNote:'Tzaangor Enlightened comes from the led Tzaangor Enlightened.',
      partialRules:{ 'Cabal of Sorcerers':'Tzaangor Shaman', 'Feel No Pain 4+':'Tzaangor Shaman' },
      // Wahapedia: the Tzaangor Shaman is INFANTRY, MOUNTED … PSYKER; the Tzaangor Enlightened are MOUNTED, not INFANTRY or PSYKER, and have
      // no Cabal of Sorcerers (BSData the same)
      kwOnly:{ Infantry:'Tzaangor Shaman', Psyker:'Tzaangor Shaman' }
    },
    {
      id:'tzaangors', ds:'thousand-sons/tzaangors', role:'Battleline', pts:75, copies:2,
      models:['1× Twistbray','9× Tzaangor w/ Tzaangor blades'],
      gear:[['Tzaangor blades'],['Tzaangor blades']],
      melee:[
        { name:'Tzaangor blades', n:10 }
      ],
      abilities:[
        { name:'Ambushing Hunters' }
      ],
      kw:['Battleline','Chaos','Faction: Thousand Sons','Infantry','Mutant','Tzaangors','Tzeentch'],
      why:{ kw:{ Battleline:'Warpmeld Sacrifice' }, role:{ Battleline:'Warpmeld Sacrifice' } }
    },
    {
      id:'sekhetar-robots', ds:'thousand-sons/sekhetar-robots', pts:85,
      models:['2× Sekhetar Robot w/ pyreflux meltagun'],
      gear:[['Close combat weapon','Heavy warpflamer','Hellfyre missile rack','Pyreflux meltagun']],
      stats:[
        { name:'Sekhetar Robots ×2' }
      ],
      ranged:[
        { name:'Heavy warpflamer', n:2 },
        { name:'Hellfyre missile rack', n:2 },
        { name:'Pyreflux meltagun', n:2 }
      ],
      melee:[
        { name:'Close combat weapon', n:2 }
      ]
    }
  ]
},
{
  id:'lite-knights', name:'Lite Knights', faction:'adeptus-custodes', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Take and Hold',
  detachments:['emperors-chosen','grav-assault-force','might-of-the-moritoi'],
  source:'New Recruit, exported 23 Oct 2026',
  units:[
    {
      id:'trajann-valoris-allarus-custodians', ds:['adeptus-custodes/trajann-valoris','adeptus-custodes/allarus-custodians'], role:'Epic Hero', pts:445, ptsNote:'265 + Allarus Custodians 180', warlord:true,
      leads:'Allarus Custodians',
      models:['1× Trajann Valoris','1× Allarus Custodian','1× Allarus Custodian (Vexilla)'],
      gear:[['Eagle’s Scream','Watcher’s Axe'],['Balistus grenade launcher','Castellan axe'],['Balistus grenade launcher','Castellan axe']],
      stats:[
        { name:'Trajann Valoris', OC:'3', from:{ OC:'Vexilla' } },
        { name:'Allarus Custodian ×2', OC:'3', from:{ OC:'Vexilla' } }
      ],
      ranged:[
        { name:'Eagle’s Scream', who:'Trajann Valoris' },
        { name:'Balistus grenade launcher', who:'Allarus Custodians', n:2 },
        { name:'Castellan axe', who:'Allarus Custodians', n:2 }
      ],
      melee:[
        { name:'Watcher’s Axe', who:'Trajann Valoris' },
        { name:'Castellan axe', who:'Allarus Custodians', n:2 }
      ],
      abilities:[
        { name:'Captain-General', who:'Trajann Valoris' },
        { name:'Moment Shackle', who:'Trajann Valoris' },
        { name:'Slayer of Tyrants', who:'Allarus Custodians' },
        { name:'Vexilla', who:'Allarus Custodians' }
      ],
      mods:[
        { kind:'melee', weapon:'Watcher’s Axe', when:'Moment Shackle (once per battle, at the start of any phase, one of its two effects), until the end of the phase', note:'+3 A', from:'Moment Shackle' },
        { kind:'melee', when:'Target has a T greater than this unit’s T', note:'+1 to wound rolls', from:'Slayer of Tyrants' }
      ],
      // Captain-General: friendly ADEPTUS CUSTODES units (excluding MONSTER/VEHICLE units) within 6" of Trajann, his own unit included
      aura:[
        { kind:'all', needs:{ all:['Faction: Adeptus Custodes'], none:['Monster','Vehicle'] }, when:'Within 6" of Trajann Valoris', selfWhen:'Own aura', note:'re-roll hit rolls of 1 and wound rolls of 1', from:'Captain-General', selfAlways:true }
      ],
      rules:['Aquila Commander','Aegis of the Emperor','Martial Ka\'tah','Leader','Deep Strike','Feel No Pain 5+*','Feel No Pain 5+','Assault','Rapid Fire','Cleave','Blast'],
      kw:['Character','Epic Hero','Faction: Adeptus Custodes','Imperium','Infantry','Trajann Valoris','Warlord','Allarus Custodians','Terminator'],
      kwNote:'Allarus Custodians, Terminator come from the led Allarus Custodians.',
      // Feel No Pain 5+: a core ability of Trajann Valoris's datasheet (Wahapedia, CORE ABILITIES), not of the Allarus Custodians
      partialRules:{ 'Feel No Pain 5+':'Trajann Valoris' }
    },
    {
      id:'prosecutor-squad', ds:'adeptus-custodes/prosecutor-squad', pts:45, copies:2,
      models:['4× Prosecutor'],
      gear:[['Boltgun','Gun Stock']],
      stats:[
        { name:'Prosecutor ×4' }
      ],
      ranged:[
        { name:'Boltgun', n:4 }
      ],
      melee:[
        { name:'Gun Stock', n:4 }
      ],
      // Daughters of the Abyss: its Psychic Null aura, for the ADEPTUS CUSTODES units within 6" of this unit
      guard:[
        { from:'Daughters of the Abyss', needs:{ all:['Faction: Adeptus Custodes'] }, kind:'all', when:'Within 6" of a friendly ANATHEMA PSYKANA unit with Daughters of the Abyss (Psychic Null)', note:'Feel No Pain 5+ against psychic attacks' }
      ]
    },
    {
      id:'witchseeker-squad', ds:'adeptus-custodes/witchseeker-squad', pts:55,
      models:['4× Witchseeker'],
      gear:[['Flamer','Gun Stock']],
      stats:[
        { name:'Witchseeker ×4' }
      ],
      ranged:[
        { name:'Flamer', n:4 }
      ],
      melee:[
        { name:'Gun Stock', n:4 }
      ],
      // Daughters of the Abyss: its Psychic Null aura, for the ADEPTUS CUSTODES units within 6" of this unit
      guard:[
        { from:'Daughters of the Abyss', needs:{ all:['Faction: Adeptus Custodes'] }, kind:'all', when:'Within 6" of a friendly ANATHEMA PSYKANA unit with Daughters of the Abyss (Psychic Null)', note:'Feel No Pain 5+ against psychic attacks' }
      ]
    },
    {
      id:'witchseeker-squad-2', ds:'adeptus-custodes/witchseeker-squad', pts:60,
      models:['5× Witchseeker'],
      gear:[['Flamer','Gun Stock']],
      stats:[
        { name:'Witchseeker ×5' }
      ],
      ranged:[
        { name:'Flamer', n:5 }
      ],
      melee:[
        { name:'Gun Stock', n:5 }
      ],
      // Daughters of the Abyss: its Psychic Null aura, for the ADEPTUS CUSTODES units within 6" of this unit
      guard:[
        { from:'Daughters of the Abyss', needs:{ all:['Faction: Adeptus Custodes'] }, kind:'all', when:'Within 6" of a friendly ANATHEMA PSYKANA unit with Daughters of the Abyss (Psychic Null)', note:'Feel No Pain 5+ against psychic attacks' }
      ]
    },
    {
      id:'caladius-annihilator-grav-tank', ds:'adeptus-custodes/caladius-annihilator-grav-tank', pts:250,
      models:['1× Caladius Annihilator Grav-tank'],
      gear:[['Arachnus Blaze Carronade','Twin Lastrum Bolt Cannon','Armoured hull']],
      stats:[
        { name:'Caladius Annihilator Grav-tank', InSv:'5+, 4+*', from:{ InSv:'Flare Shields' } }
      ],
      mods:[
        { kind:'ranged', when:'vs MONSTER/VEHICLE', note:'re-roll one hit roll, one wound roll and one damage roll', from:'Advanced Firepower', always:true, vs:{ any:['Monster','Vehicle'] } },
        { kind:'all', when:'Damaged (5 or fewer wounds remaining)', note:'-1 to hit rolls', from:'Damaged 5' }
      ]
    },
    {
      id:'contemptor-achillus-dreadnought', ds:'adeptus-custodes/contemptor-achillus-dreadnought', pts:230,
      models:['1× Contemptor-Achillus Dreadnought'],
      gear:[['Dreadspear','Lastrum storm bolter','Lastrum storm bolter']],
      ranged:[
        { name:'Dreadspear' },
        { name:'Lastrum storm bolter', n:2 }
      ],
      mods:[
        { kind:'all', when:'Damaged (4 or fewer wounds remaining)', note:'-1 to hit rolls', from:'Damaged 4' }
      ]
    },
    {
      id:'contemptor-galatus-dreadnought', ds:'adeptus-custodes/contemptor-galatus-dreadnought', pts:250, upgrade:'Memento Moritoi',
      models:['1× Contemptor-Galatus Dreadnought'],
      gear:[['Warblade']],
      melee:[
        { name:'Warblade', A:'9', S:'11', D:'4', from:{ A:'Memento Moritoi', S:'Memento Moritoi', D:'Memento Moritoi' } }
      ],
      abilities:[
        { name:'Unyielding Ancient' },
        // the upgrade's published text starts with its restriction, which New Recruit (BSData) leaves out; the +1 A, S and D are in the
        // Warblade's melee profile already (from)
        { name:'Memento Moritoi', tag:'Upgrade', text:'**ADEPTUS CUSTODES DREADNOUGHT** model only. This model’s melee attacks have +1 **A**, **S** and **D**.' }
      ],
      mods:[
        { kind:'all', when:'Damaged (4 or fewer wounds remaining)', note:'-1 to hit rolls', from:'Damaged 4' }
      ]
    },
    {
      id:'telemon-heavy-dreadnought', ds:'adeptus-custodes/telemon-heavy-dreadnought', pts:310, upgrade:'Augury Uplink',
      models:['1× Telemon Heavy Dreadnought'],
      gear:[['Spiculus bolt launcher','Dual Caestus Fists','Twin Neutronium Cascade Projectors','Twin Neutronium Cascade Projectors']],
      ranged:[
        { name:'Spiculus bolt launcher' },
        { name:'Twin Neutronium Cascade Projectors', n:2 }
      ],
      melee:[
        { name:'Dual Caestus Fists' }
      ],
      abilities:[
        { name:'Guardian Eternal' },
        // the upgrade's published text starts with its restriction, which New Recruit (BSData) leaves out
        { name:'Augury Uplink', tag:'Upgrade', def:'Feel No Pain 5+', text:'**ADEPTUS CUSTODES DREADNOUGHT** model only. This model has **Feel No Pain 5+**.', defOf:'bd81d7df' }
      ],
      mods:[
        { kind:'all', when:'Damaged (5 or fewer wounds remaining)', note:'-1 to hit rolls', from:'Damaged 5' }
      ],
      rules:['Martial Ka\'tah','Deadly Demise D3','Damaged 5','Aegis of the Emperor','Feel No Pain 5+*','Feel No Pain 5+','Blast','Twin-linked','Torrent'],
      why:{ rules:{ 'Feel No Pain 5+':'Augury Uplink', Blast:'its wargear (Spiculus bolt launcher)', 'Twin-linked':'its wargear (Twin Neutronium Cascade Projectors)', Torrent:'its wargear (Twin Neutronium Cascade Projectors)' } }
    },
    {
      id:'telemon-heavy-dreadnought-2', ds:'adeptus-custodes/telemon-heavy-dreadnought', pts:310,
      models:['1× Telemon Heavy Dreadnought'],
      gear:[['Spiculus bolt launcher','Adrathic Desolator','Caestus Fist','Twin Neutronium Cascade Projectors']],
      ranged:[
        { name:'Spiculus bolt launcher' },
        { name:'Adrathic Desolator' },
        { name:'Twin Neutronium Cascade Projectors' }
      ],
      melee:[
        { name:'Caestus Fist' }
      ],
      mods:[
        { kind:'all', when:'Damaged (5 or fewer wounds remaining)', note:'-1 to hit rolls', from:'Damaged 5' }
      ],
      rules:['Martial Ka\'tah','Deadly Demise D3','Damaged 5','Aegis of the Emperor','Feel No Pain 5+*','Blast','Torrent','Twin-linked'],
      why:{ rules:{ Blast:'its wargear (Spiculus bolt launcher)', Torrent:'its wargear (Twin Neutronium Cascade Projectors)', 'Twin-linked':'its wargear (Twin Neutronium Cascade Projectors)' } }
    }
  ]
},
];

// ---- DATASHEETS: written by verify/tables.js --write (edit a datasheet here; --write keeps the table in shape) ----
const DATASHEETS = {
'orks/wazdakka-gutsmek':{
  name:'Wazdakka Gutsmek', faction:'orks', bsId:'2ab7-ab71-0af4-5d39', role:'Epic Hero',
  stats:[
    { name:'Wazdakka Gutsmek', M:'14"', T:'8', Sv:'3+', W:'10', Ld:'6+', OC:'3', InSv:'4+', base:'120×92mm' }
  ],
  ranged:[
    { name:'Grabba Dragga', range:'12"', A:'1', BS:'2+', S:'10', AP:'-2', D:'3', kw:['ASSAULT','PRECISION'] },
    { name:'Psyko-gatler', range:'24"', A:'12', BS:'4+', S:'6', AP:'-2', D:'2', kw:['ASSAULT','LETHAL HITS: non-MONSTER/VEHICLE','SUSTAINED HITS 1'] }
  ],
  melee:[
    { name:'Fixit’s Wrench', range:'Melee', A:'1', WS:'4+', S:'3', AP:'0', D:'1', kw:['EXTRA ATTACKS'] },
    { name:'Grabba Dragga', range:'Melee', A:'6', WS:'2+', S:'10', AP:'-2', D:'3', kw:['CLEAVE 2','LANCE'] },
    { name:'Speeding Bulk and Flaming Exhaust', range:'Melee', A:'3', WS:'2+', S:'5', AP:'-1', D:'1', kw:['CLEAVE 1','EXTRA ATTACKS'] }
  ],
  abilities:[
    { name:'Full Throttle', ph:['command','movement','charge'], turn:'your', text:'In your Command phase, select one Throttlerokkit Shokka Engine ability. This unit has that ability until the start of your next Command phase.' },
    { name:'Turbo Engine', who:'Throttlerokkit Shokka Engine', ph:['movement','charge'], turn:'your', text:'When this unit is selected to make an **advance**/**fall-back move**, that move does not prevent this unit from being **eligible to declare a charge**.' },
    // def: the "When targeted" line on the datasheet (the Pulse Jet Move's AFTER MOVING)
    { name:'Pulse Jet', who:'Throttlerokkit Shokka Engine', ph:['movement'], turn:'your', def:'After a pulse jet move: attacks that target it have -1 to hit rolls, until the start of your next turn', text:'In your Movement phase, when this unit is **selected to move**, if this unit is **unengaged**, this unit can make a **pulse jet move**.', defOf:'e266e544' },
    { name:'Shokk Attack Engine', who:'Throttlerokkit Shokka Engine', ph:['command'], turn:'your', text:'In your Command phase, if this unit is **unengaged**, you can place this unit in **strategic reserves**.' }
  ],
  rules:['Deadly Demise D3','Deep Strike','Lone Operative','Waaagh!'],
  kw:['Character','Epic Hero','Faction: Orks','Mounted','Smoke','Speed Freeks','Vehicle','Wazdakka Gutsmek']
},
'orks/big-mek-dakkarig':{
  name:'Big Mek Dakkarig', faction:'orks', bsId:'78a7-cf35-aa8d-c420', role:'Character',
  stats:[
    { name:'Big Mek Dakkarig', M:'8"', T:'8', Sv:'3+', W:'11', Ld:'7+', OC:'3', InSv:'5+', base:'90mm' }
  ],
  ranged:[
    { name:'Blitzkannon', range:'24"', A:'8', BS:'4+', S:'7', AP:'-2', D:'2', kw:['IGNORES COVER','LETHAL HITS: non-MONSTER/VEHICLE'] },
    { name:'Multi-busta Launcha', range:'24"', A:'6', BS:'5+', S:'10', AP:'-2', D:'3', kw:['IGNORES COVER','LETHAL HITS'] }
  ],
  melee:[
    { name:'Stompy Feet', range:'Melee', A:'4', WS:'3+', S:'6', AP:'-1', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Even More Dakka', ph:['movement','shooting'], turn:'your', turns:{ movement:'opp' }, text:'If this unit is **riled up**, this unit’s ranged attacks have **[SUSTAINED HITS 1]**.' },
    { name:'Blitz Dem Gitz!', ph:['shooting'], turn:'your', text:'In your Shooting phase, if this unit’s Blitzkannon weapon targets a unit (excluding **MONSTER/VEHICLE** units), that weapon has +6 **A**.' }
  ],
  rules:['Deadly Demise 1','Waaagh!'],
  kw:['Big Mek','Big Mek Dakkarig','Character','Faction: Orks','Vehicle','Walker']
},
'orks/big-mek-in-mega-armour':{
  name:'Big Mek in Mega Armour', faction:'orks', bsId:'95e9-6da3-5e75-2566', role:'Character',
  stats:[
    { name:'Big Mek in Mega Armour', M:'5"', T:'6', Sv:'2+', W:'5', Ld:'7+', OC:'1', InSv:'–', base:'40mm' }
  ],
  ranged:[
    { name:'Kustom Mega-blasta', range:'24"', A:'3', BS:'4+', S:'9', AP:'-2', D:'3' },
    { name:'Tellyport Blasta', range:'12"', A:'6', BS:'4+', S:'9', AP:'-2', D:'3' }
  ],
  melee:[
    { name:'Power Klaw', range:'Melee', A:'3', WS:'3+', S:'10', AP:'-2', D:'2', kw:[] }
  ],
  abilities:[
    { name:'Fix Dat Armour Up', tag:'Once per battle, per unit', ph:['command'], turn:'your', text:'In your Command phase, this unit **heals** 3 wounds.\n*Place a Grot Oiler token next to the unit, removing it when this ability is used.*' },
    { name:'More Dakka', text:'This unit’s ranged attacks have:\n- **[IGNORES COVER]**.\n- If this unit is **riled up**, **[SUSTAINED HITS 1]**.' },
    { name:'Kustom Force Field', def:'4+ InSv against ranged attacks', text:'This unit has 4+ **InSv** against ranged attacks.', defOf:'e9dead84' }
  ],
  rules:['Waaagh!','Leader'],
  kw:['Big Mek','Big Mek in Mega Armour','Character','Explosives','Faction: Orks','Infantry','Mega Armour']
},
'orks/warboss':{
  name:'Warboss', faction:'orks', bsId:'2efc-c4b3-2ecc-5a37', role:'Character',
  stats:[
    { name:'Warboss', M:'6"', T:'6', Sv:'4+', W:'6', Ld:'6+', OC:'1', InSv:'5+', base:'50mm' }
  ],
  ranged:[
    { name:'Kustom Shoota', range:'18"', A:'4', BS:'5+', S:'4', AP:'0', D:'1' }
  ],
  melee:[
    { name:'Kustom Choppa', range:'Melee', A:'6', WS:'2+', S:'7', AP:'-2', D:'2', kw:['CLEAVE 2'] }
  ],
  abilities:[
    { name:'Might is Right', ph:['fight'], turn:'either', text:'If this unit made a **charge move** this turn, this model’s melee attacks have:\n- +3 **A**.\n- +2 **S**.' },
    { name:'Boss’ Ammo Runt', tag:'Once per battle, per unit', ph:['shooting'], turn:'your', text:'In your Shooting phase, when this unit is **selected to shoot**, you can use this ability. If you do, this model’s ranged attacks have +1 to **hit rolls**.\nPlace a Boss’ Ammo Runt token next to the unit, removing it when this ability is used.' },
    { name:'Intimidating Motivation', tag:'Once per battle round, per army', ph:['movement'], turn:'your', text:'In your Movement phase, at the start or end of this unit’s move, you can select one friendly **ORKS** unit within 6" of this unit. That unit:\n- Is no longer **battle-shocked**.\n- Is **riled up** until the start of your next turn.' }
  ],
  rules:['Da Boss','Leader','Waaagh!'],
  kw:['Character','Faction: Orks','Grenades','Infantry','Warboss']
},
'orks/mek':{
  name:'Mek', faction:'orks', bsId:'3b2-8c11-616a-1005',
  stats:[
    { name:'Mek', M:'6"', T:'5', Sv:'5+', W:'4', Ld:'7+', OC:'1', InSv:'–', base:'32mm' }
  ],
  ranged:[
    { name:'Kustom Mega-slugga', range:'12"', A:'3', BS:'4+', S:'8', AP:'-2', D:'3' }
  ],
  melee:[
    { name:'Mek’s Toolz', range:'Melee', A:'3', WS:'3+', S:'5', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Clever Know-wotz', ph:['movement','shooting','fight'], turn:'either', turns:{ movement:'your', shooting:'your' }, text:'In your Movement phase, at the start or end of this unit’s move, you can select one friendly **ORKS VEHICLE** model (excluding **AIRCRAFT**/**TITANIC** models) within 3" of this model:\n- That **VEHICLE** model **heals** D3 wounds.\n- That **VEHICLE** model’s attacks have +1 to **hit rolls** until the start of your next Movement phase.' },
    { name:'Kustom Dakka', text:'This unit’s ranged attacks have **[IGNORES COVER]**.' }
  ]
},
'orks/tankbustas':{
  name:'Tankbustas', faction:'orks', bsId:'dadc-d370-ef10-853c',
  stats:[
    { name:'Nob', M:'6"', T:'5', Sv:'4+', W:'3', Ld:'7+', OC:'1', InSv:'–', base:'32mm' },
    { name:'Tankbusta', M:'6"', T:'5', Sv:'4+', W:'2', Ld:'7+', OC:'1', InSv:'–', base:'32mm' }
  ],
  ranged:[
    { name:'Rokkit pistol', range:'12"', A:'1', BS:'4+', S:'10', AP:'-2', D:'3' },
    { name:'Hunter', group:'Busta Rokkit Launcha', hunter:true, range:'24"', A:'3', BS:'4+', S:'12', AP:'-2', D:'3' },
    { name:'Standard', group:'Busta Rokkit Launcha', range:'24"', A:'2', BS:'4+', S:'10', AP:'-2', D:'3' }
  ],
  melee:[
    { name:'Choppa', range:'Melee', A:'4', WS:'3+', S:'5', AP:'-1', D:'1', kw:[] },
    { name:'Gitstikka', range:'Melee', A:'3', WS:'3+', S:'5', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Rokkit Barrage', ph:['shooting'], turn:'your', text:'In your Shooting phase, when this unit has shot, select one enemy unit hit by those attacks. That unit makes a **battle-shock roll**, with -1 to that **battle-shock roll**.' },
    { name:'Bomb Squig', tag:'Once per turn, twice per battle, per unit', ph:['movement'], turn:'your', text:'In your Movement phase, when this unit ends a **normal move**, you can select one **visible** enemy unit within 12" of this unit and roll one D6:\n- On a 3+, that enemy unit suffers D3 **mortal wounds**.\n*Place two Bomb Squig tokens next to the unit, removing one each time this ability is used.*' }
  ]
},
'orks/flash-gitz':{
  name:'Flash Gitz', faction:'orks', bsId:'1de9-b138-28a1-9c4b',
  stats:[
    { name:'Flash Gitz', M:'6"', T:'5', Sv:'4+', W:'3', Ld:'7+', OC:'1', InSv:'–', base:'40mm' }
  ],
  ranged:[
    { name:'Cutta', group:'Snazzgun', range:'12"', A:'1', BS:'4+', S:'9', AP:'-3', D:'D3+2' },
    { name:'Dakka', group:'Snazzgun', range:'24"', A:'3', BS:'4+', S:'6', AP:'-1', D:'2' },
    { name:'Kill Shot', group:'Snazzgun', range:'36"', A:'2', BS:'4+', S:'8', AP:'-2', D:'2' }
  ],
  melee:[
    { name:'Choppa', range:'Melee', A:'4', WS:'3+', S:'5', AP:'-1', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Finderz Keeperz', ph:['shooting'], turn:'your', text:'In your Shooting phase, if any of the following apply, this unit’s ranged attacks have +1 **AP**.\n- This unit is within range of an **objective**.\n- The target of that attack is within range of an **objective**.' }
  ]
},
'orks/gretchin':{
  name:'Gretchin', faction:'orks', bsId:'de8f-24f9-c543-92b7', role:'Infantry',
  stats:[
    { name:'Gretchin', M:'6"', T:'2', Sv:'6+', W:'1', Ld:'8+', OC:'1', InSv:'–', base:'25mm' }
  ],
  ranged:[
    { name:'Grot Blasta', range:'12"', A:'1', BS:'4+', S:'3', AP:'0', D:'1', kw:['CLOSE-QUARTERS'] }
  ],
  melee:[
    { name:'Scavenged Shivs', range:'Melee', A:'1', WS:'5+', S:'2', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Downtrodden', text:'For the purposes of **transport capacity**, each 2 Gretchin models (rounding up) take up the space of 1 model.' },
    { name:'Thievin’ Scavengers', ph:['movement'], turn:'your', text:'At the end of your Movement phase, if this unit is controlling an **objective**, that objective is **secured**.' }
  ],
  rules:['Waaagh!'],
  kw:['Faction: Orks','Gretchin','Grots','Infantry']
},
'orks/deffkoptas':{
  name:'Deffkoptas', faction:'orks', bsId:'2d6e-aa3b-c28c-5ef0', role:'Mounted',
  stats:[
    { name:'Deffkoptas', M:'12"', T:'6', Sv:'4+', W:'4', Ld:'7+', OC:'2', InSv:'6+', base:'75×42mm' }
  ],
  ranged:[
    { name:'Busta', group:'Rokkit Launcha', range:'24"', A:'2', BS:'5+', S:'10', AP:'-2', D:'3', kw:['LETHAL HITS'] },
    { name:'Blasta', group:'Rokkit Launcha', range:'24"', A:'2', BS:'5+', S:'4', AP:'0', D:'1', kw:['BLAST 2'] },
    { name:'Slugga', range:'12"', A:'1', BS:'5+', S:'4', AP:'0', D:'1', kw:['CLOSE-QUARTERS','LETHAL HITS: non-MONSTER/VEHICLE'] },
    { name:'Kustom Mega-blasta', range:'24"', A:'3', BS:'5+', S:'9', AP:'-2', D:'3', kw:['HAZARDOUS','LETHAL HITS'] }
  ],
  melee:[
    { name:'Choppa', range:'Melee', A:'3', WS:'4+', S:'5', AP:'-1', D:'1', kw:[] },
    { name:'Spinnin’ Blades', range:'Melee', A:'4', WS:'3+', S:'5', AP:'-1', D:'1', kw:['CLEAVE 1','HAZARDOUS'] }
  ],
  abilities:[
    { name:'Aerial Manoover', ph:['fight'], turn:'opp', text:'At the end of your opponent’s Fight phase, if this unit is **unengaged**, you can place this unit in **strategic reserves**.' },
    { name:'Deff from Above', ph:['shooting'], turn:'your', text:'In your Shooting phase, if this unit made an **ingress move** this turn, this unit’s ranged attacks have +1 to **hit rolls**.' }
  ],
  rules:['Deep Strike','Waaagh!'],
  kw:['Deffkoptas','Explosives','Faction: Orks','Fly','Mounted','Speed Freeks']
},
'orks/killa-kans':{
  name:'Killa Kans', faction:'orks', bsId:'8c36-c946-2e0f-f648', role:'Vehicle',
  stats:[
    { name:'Killa Kan', M:'8"', T:'7', Sv:'3+', W:'5', Ld:'8+', OC:'2', InSv:'6+', base:'60mm' }
  ],
  ranged:[
    { name:'Kill Shot', group:'Kan Blasta', range:'24"', A:'2', BS:'4+', S:'10', AP:'-2', D:'3', kw:[] },
    { name:'Point Blank', group:'Kan Blasta', range:'12"', A:'3', BS:'–', S:'5', AP:'-1', D:'1', kw:['BLAST 2','TORRENT'] },
    { name:'Dakka', group:'Kan Blasta', range:'24"', A:'4', BS:'4+', S:'6', AP:'-1', D:'1', kw:['BLAST 1','IGNORES COVER','SUSTAINED HITS 1'] }
  ],
  melee:[
    { name:'Kan Klaw', range:'Melee', A:'3', WS:'4+', S:'8', AP:'-2', D:'3', kw:[] }
  ],
  abilities:[
    { name:'Spiteful Power Trip', ph:['movement','shooting','fight'], turn:'either', turns:{ movement:'opp', shooting:'your' }, text:'This unit’s attacks that target a unit that has no models with a **T** of 7+ have +1 to **hit rolls**.' }
  ],
  rules:['Deadly Demise 1','Waaagh!'],
  kw:['Faction: Orks','Grots','Killa Kans','Vehicle','Walker']
},
'orks/ghazghkull-thraka':{
  name:'Ghazghkull Thraka', faction:'orks', bsId:'4ea0-6b70-c17c-bc00', role:'Epic Hero',
  stats:[
    { name:'Ghazghkull Thraka', M:'8"', T:'10', Sv:'2+', W:'16', Ld:'6+', OC:'4', InSv:'4+', base:'80mm' }
  ],
  ranged:[
    { name:'Point Blank', group:'Mork’s Roar', range:'9"', A:'2D6+2', BS:'–', S:'6', AP:'-1', D:'1', kw:['CLOSE-QUARTERS','TORRENT'] },
    { name:'Aimed', group:'Mork’s Roar', range:'36"', A:'12', BS:'5+', S:'6', AP:'-1', D:'1', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 4'] }
  ],
  melee:[
    { name:'Adamantine ’Eadbutt', range:'Melee', A:'1', WS:'2+', S:'14', AP:'-2', D:'D3+3', kw:['DEVASTATING WOUNDS','EXTRA ATTACKS','PRECISION'] },
    { name:'Gork’s Klaw', range:'Melee', A:'7', WS:'2+', S:'14', AP:'-3', D:'4', kw:['CLEAVE 2','DEVASTATING WOUNDS'] }
  ],
  abilities:[
    { name:'Supreme Commander', note:'Wahapedia core rules, 25.04 Fill Your Army Roster: “Some units have a rule on their datasheet stating that they must be your WARLORD. If you want to include one or more of these units in your army, you must select one of them to be your WARLORD.”', text:'If this model is in your army, it must be your **WARLORD**.' },
    { name:'Makari, Hoist Dat Banner!', tag:'Once per battle, per army', ph:['movement'], turn:'your', text:'In your Movement phase, you can select a number of friendly **ORKS** units equal to or less than the current battle round number. Those units are **riled up** until the start of your next turn.\n*Place one Makari token next to the unit, removing it after this ability is used.*' },
    { name:'Da Grand Warlord’s Ladz', def:'Lone Operative while within 3" of another friendly ORKS INFANTRY unit', text:'While this unit is within 3" of another friendly **ORKS INFANTRY** unit, this unit has **Lone Operative**.', defOf:'b7669049' },
    { name:'Prophet of Da Great Waaagh!', tag:'Aura', ph:['fight'], turn:'either', text:'While a friendly **ORKS** unit is within 6" of this unit, that unit’s melee attacks have:\n- +1 to **hit rolls**.\n- +1 to **wound rolls**.' }
  ],
  rules:['Waaagh!','Da Boss'],
  kw:['Character','Epic Hero','Explosives','Faction: Orks','Ghazghkull Thraka','Infantry','Warboss']
},
'orks/mozrog-skragbad':{
  name:'Mozrog Skragbad', faction:'orks', bsId:'b42b-ea0-38f1-6300', role:'Epic Hero',
  stats:[
    { name:'Mozrog Skragbad', M:'10"', T:'9', Sv:'3+', W:'10', Ld:'6+', OC:'3', InSv:'4+', base:'80mm' }
  ],
  ranged:[
    { name:'Thump Gun', range:'18"', A:'3', BS:'5+', S:'6', AP:'0', D:'2', kw:['ANTI-MONSTER/VEHICLE 4+'] }
  ],
  melee:[
    { name:'Big Chompa’s Jaws', range:'Melee', A:'3', WS:'3+', S:'7', AP:'-2', D:'4' },
    { name:'Hunter', group:'Gutrippa', hunter:true, range:'Melee', A:'6', WS:'2+', S:'12', AP:'-2', D:'D6+1' },
    { name:'Standard', group:'Gutrippa', range:'Melee', A:'6', WS:'2+', S:'9', AP:'-2', D:'2' }
  ],
  abilities:[
    { name:'Beast Snagga Following', def:'Lone Operative while within 3" of a friendly BEAST SNAGGA unit (not MONSTER CHARACTER)', text:'While this unit is within 3" of a friendly **BEAST SNAGGA** unit (excluding **MONSTER CHARACTER** units), this unit has **Lone Operative**.', defOf:'951ba989' },
    { name:'One Last Kill', ph:['fight'], turn:'either', def:'Destroyed in the Fight phase before being selected to fight: on a 2+ it stays until it has fought or the phase ends', text:'In the Fight phase, when this model is **destroyed**, if this unit has not been **selected to fight** this phase, roll one D6:\n- On a 2+, do not remove this model from the battlefield. When this unit has fought, or at the end of the phase (whichever comes first), this model is removed from the battlefield.', defOf:'0bf404d3' },
    { name:'Da Bigger Dey Iz…', ph:['fight'], turn:'either', text:'This unit’s melee attacks that target a **MONSTER/VEHICLE** unit can re-roll **wound rolls**.' }
  ],
  rules:['Feel No Pain 5+','Waaagh!'],
  kw:['Beast Snagga','Character','Epic Hero','Faction: Orks','Monster','Mozrog Skragbad']
},
'orks/nazdreg':{
  name:'Nazdreg', faction:'orks', bsId:'80c4-14b2-d02d-d289',
  stats:[
    { name:'Nazdreg', M:'5"', T:'7', Sv:'2+', W:'8', Ld:'6+', OC:'1', InSv:'5+', base:'60mm' }
  ],
  ranged:[
    { name:'Skorcha', group:'Kustom Blasta X', fireAll:true, range:'12"', A:'3', BS:'–', S:'5', AP:'-1', D:'1' },
    { name:'Gatler', group:'Kustom Blasta X', fireAll:true, range:'24"', A:'6', BS:'4+', S:'9', AP:'-2', D:'3' },
    { name:'Shoota', group:'Kustom Blasta X', fireAll:true, range:'18"', A:'4', BS:'4+', S:'5', AP:'-1', D:'1' }
  ],
  melee:[
    { name:'Kustom Blasta X', range:'Melee', A:'6', WS:'2+', S:'5', AP:'-1', D:'1' },
    { name:'Moonchewa', range:'Melee', A:'5', WS:'2+', S:'12', AP:'-2', D:'3' }
  ],
  abilities:[
    { name:'Nazdreg’s Know-wotz', text:'- This unit has **Deep Strike**.\n- This unit’s ranged attacks have **[IGNORES COVER]**.' },
    { name:'Supreme Kunnin’', tag:'Once per phase, per army', ph:['movement'], turn:'opp', text:'In your opponent’s Movement phase, when an enemy unit ends a move within 8" of this unit, if this unit is **unengaged**, this unit can:\n- Make a **normal move** of up to D6".\n- Or: If this unit is **riled up**, make a **normal move** of up to 5".' },
    { name:'Intimidating Motivation', tag:'Once per battle round, per army', ph:['movement'], turn:'your', text:'In your Movement phase, at the start or end of this unit’s move, you can select one friendly **ORKS** unit within 6" of this unit. That unit:\n- Is no longer **battle-shocked**.\n- Is **riled up** until the start of your next turn.' }
  ]
},
'orks/meganobz':{
  name:'Meganobz', faction:'orks', bsId:'7067-34f4-5272-e05f',
  stats:[
    { name:'Meganob', M:'5"', T:'6', Sv:'2+', W:'3', Ld:'7+', OC:'1', InSv:'–', base:'40mm' }
  ],
  ranged:[
    { name:'Point Blank', group:'Kombi-weapon', range:'12"', A:'3', BS:'–', S:'5', AP:'0', D:'1' },
    { name:'Kill Shot', group:'Kombi-weapon', range:'24"', A:'1', BS:'5+', S:'10', AP:'-2', D:'3' },
    { name:'Shoota', group:'Kombi-weapon', range:'18"', A:'2', BS:'5+', S:'4', AP:'0', D:'1' }
  ],
  melee:[
    { name:'Twin Killsaw', range:'Melee', A:'3', WS:'4+', S:'10', AP:'-2', D:'3' },
    { name:'Power Klaw', range:'Melee', A:'3', WS:'3+', S:'10', AP:'-2', D:'2' }
  ],
  abilities:[
    { name:'Krumpin’ Time', ph:['fight'], turn:'either', text:'In the Fight phase, if this unit is **riled up**, this unit has +1 to **hit rolls**.' },
    { name:'Arrogant Invulnerability', def:'Attacks that target this unit have -1 AP', text:'Attacks that target this unit have -1 **AP**.', defOf:'07cfa46d' }
  ]
},
'orks/beastboss-on-squigosaur':{
  name:'Beastboss on Squigosaur', faction:'orks', bsId:'a8b7-351-d911-a4d6', role:'Character',
  stats:[
    { name:'Beastboss on Squigosaur', M:'10"', T:'9', Sv:'3+', W:'10', Ld:'6+', OC:'3', InSv:'5+', base:'80mm' }
  ],
  ranged:[
    { name:'Slugga', range:'12"', A:'1', BS:'5+', S:'4', AP:'0', D:'1', kw:['CLOSE-QUARTERS','LETHAL HITS: non-MONSTER/VEHICLE'] },
    { name:'Thump Gun', range:'18"', A:'3', BS:'5+', S:'6', AP:'0', D:'2', kw:['ANTI-MONSTER/VEHICLE 4+'] }
  ],
  melee:[
    { name:'Hunter', group:'Beastchoppa', hunter:true, range:'Melee', A:'6', WS:'2+', S:'12', AP:'-2', D:'D6' },
    { name:'Standard', group:'Beastchoppa', range:'Melee', A:'6', WS:'2+', S:'6', AP:'-2', D:'2' },
    { name:'Squigosaur’s jaws', range:'Melee', A:'3', WS:'3+', S:'7', AP:'-2', D:'3' }
  ],
  abilities:[
    { name:'Thundering Stampede', tag:'Aura', ph:['charge'], turn:'either', text:'Friendly **BEAST SNAGGA** units within 6" of this unit have +1 to **charge rolls**.' },
    { name:'Boss of da Hunt', def:'Lone Operative while within 3" of a friendly BEAST SNAGGA unit (not MONSTER CHARACTER)', text:'While this unit is within 3" of a friendly **BEAST SNAGGA** unit (excluding **MONSTER CHARACTER** units), this unit has **Lone Operative**.', defOf:'951ba989' },
    { name:'Keep Huntin’!', tag:'Once per battle round, per army', ph:['movement'], turn:'your', text:'In your Movement phase, at the start or end of this unit’s move, you can select one friendly **BEAST SNAGGA** unit within 6" of this unit. That unit:\n- Is no longer **battle-shocked**.\n- Is **riled up** until the start of your next turn.' }
  ],
  rules:['Da Boss','Waaagh!','Feel No Pain 5+'],
  kw:['Beast Snagga','Beastboss on Squigosaur','Character','Faction: Orks','Monster','Warboss']
},
'orks/big-mek':{
  name:'Big Mek', faction:'orks', bsId:'fbee-427a-1c46-f621',
  stats:[
    { name:'Big Mek', M:'6"', T:'5', Sv:'3+', W:'6', Ld:'7+', OC:'1', InSv:'–', base:'50mm' }
  ],
  ranged:[
    { name:'Kustom mega-blasta', range:'24"', A:'3', BS:'4+', S:'9', AP:'-2', D:'3' }
  ],
  melee:[
    { name:'Drilla', range:'Melee', A:'3', WS:'3+', S:'12', AP:'-3', D:'3' }
  ],
  abilities:[
    { name:'Shokk-boosta', ph:['movement'], turn:'your', text:'In your Movement phase, when this unit is selected to make an **advance move**, you can use this ability. If you do:\n- This unit can change that **advance roll** to a 6.\n- This unit can move through all types of model.\n- When this unit ends that **advance move**, make a **hazard roll** for each model in this unit.' },
    { name:'More Dakka', text:'This unit’s ranged attacks have:\n- **[IGNORES COVER]**.\n- If this unit is **riled up**, **[SUSTAINED HITS 1]**.' }
  ]
},
'orks/painboy':{
  name:'Painboy', faction:'orks', bsId:'7669-1442-2c0b-e0c9',
  stats:[
    { name:'Painboy', M:'6"', T:'5', Sv:'5+', W:'3', Ld:'7+', OC:'1', InSv:'–', base:'32mm' }
  ],
  melee:[
    { name:'’Urty syringe', range:'Melee', A:'1', WS:'3+', S:'2', AP:'0', D:'D6' },
    { name:'Dok’s Toolz', range:'Melee', A:'3', WS:'3+', S:'10', AP:'-2', D:'2' }
  ],
  abilities:[
    { name:'Crude Surgery', ph:['command'], turn:'your', text:'In your Command phase, this unit **heals** 3 wounds.' },
    { name:'Catch Dat Red Bit', tag:'Once per battle, per unit', ph:['command'], turn:'your', text:'When this model uses its **Crude Surgery** ability, you can add D3 to the number of wounds **healed**.\n*Place a Grot Orderly token next to the unit, removing it when this ability is used.*' }
  ]
},
'orks/nobz':{
  name:'Nobz', faction:'orks', bsId:'b16a-7132-3f8a-abe5',
  stats:[
    { name:'Nob', M:'6"', T:'5', Sv:'4+', W:'3', Ld:'7+', OC:'1', InSv:'–', base:'32mm' }
  ],
  ranged:[
    { name:'Kustom Shoota', range:'18"', A:'4', BS:'5+', S:'4', AP:'0', D:'1' },
    { name:'Busta Rokkit', group:'Kombi-rokkit', range:'24"', A:'1', BS:'5+', S:'10', AP:'-2', D:'3' },
    { name:'Shoota', group:'Kombi-rokkit', range:'18"', A:'2', BS:'5+', S:'4', AP:'0', D:'1' }
  ],
  melee:[
    { name:'Kustom Krumpa', range:'Melee', A:'3', WS:'3+', S:'10', AP:'-2', D:'2' }
  ],
  abilities:[
    { name:'Ammo Runts', tag:'Once per battle, per unit', ph:['shooting'], turn:'your', text:'In your Shooting phase, when this unit is **selected to shoot**, you can use this ability. If you do, this unit’s ranged attacks have +1 to **hit rolls**.\n*Place any number of Ammo Runt tokens next to the unit, removing them when this ability is used.*' },
    { name:'Get Out da Way!', ph:['charge'], turn:'either', text:'While making a **charge move**, this unit can move through models (excluding **MONSTER/VEHICLE** models).' },
    { name:'Paired Krumpas', text:'Attacks made with this model’s Kustom Krumpa weapon can re-roll **hit rolls** and **wound rolls**.' }
  ]
},
'orks/squighog-boyz':{
  name:'Squighog Boyz', faction:'orks', bsId:'6a83-8e1f-63ef-50c3', role:'Mounted',
  stats:[
    { name:'Nob on Smasha Squig', M:'10"', T:'6', Sv:'4+', W:'4', Ld:'7+', OC:'2', InSv:'6+', base:'90×52.5mm' },
    { name:'Squighog Boyz', M:'10"', T:'6', Sv:'4+', W:'3', Ld:'7+', OC:'2', InSv:'6+', base:'75×42mm' }
  ],
  ranged:[
    { name:'Slugga', range:'12"', A:'1', BS:'5+', S:'4', AP:'0', D:'1', kw:['CLOSE-QUARTERS','LETHAL HITS: non-MONSTER/VEHICLE'] },
    { name:'Saddlegit’s Shiv', range:'9"', A:'1', BS:'4+', S:'3', AP:'0', D:'1', kw:['ASSAULT'] },
    { name:'Stikka', range:'9"', A:'1', BS:'5+', S:'5', AP:'-1', D:'2', kw:['ANTI-MONSTER/VEHICLE 4+','ASSAULT'] }
  ],
  melee:[
    { name:'Big Choppa', range:'Melee', A:'4', WS:'3+', S:'7', AP:'-1', D:'2' },
    { name:'Squig Jaws', range:'Melee', A:'3', WS:'4+', S:'6', AP:'-1', D:'2' },
    { name:'Stikka', range:'Melee', A:'3', WS:'3+', S:'5', AP:'-1', D:'2' }
  ],
  abilities:[
    { name:'Brutal Impact', ph:['fight'], turn:'either', text:'If this unit made a **charge move** this turn, this unit’s attacks have +1 **D**.' },
    { name:'Bomb Squig', tag:'Once per battle, per unit', ph:['movement'], turn:'your', text:'In your Movement phase, when this unit ends a **normal move**, you can select one **visible** enemy unit within 12" of this unit and roll one D6:\n- On a 3+, that enemy unit suffers D3 **mortal wounds**.\n*Place one Bomb Squig token next to the unit, removing it after this ability is used.*' }
  ],
  rules:['Waaagh!'],
  kw:['Beast Snagga','Explosives','Faction: Orks','Mobile','Mounted','Squighog Boyz']
},
'orks/zodgrod-wortsnagga':{
  name:'Zodgrod Wortsnagga', faction:'orks', bsId:'ce45-db08-3795-18a9',
  stats:[
    { name:'Zodgrod Wortsnagga', M:'6"', T:'5', Sv:'5+', W:'5', Ld:'7+', OC:'1', InSv:'6+', base:'50mm' }
  ],
  ranged:[
    { name:'Squigstoppa', range:'12"', A:'1', BS:'5+', S:'4', AP:'-1', D:'1' }
  ],
  melee:[
    { name:'Da Grabzappa', range:'Melee', A:'5', WS:'2+', S:'7', AP:'-2', D:'2', kw:[] }
  ],
  abilities:[
    { name:'Super Runts', riled:true, text:'- This unit is **riled up**.\n- This unit’s Scavenged Shivs weapons have +1 **A**, **WS** and **S**.' }
  ]
},
'orks/runtherd':{
  name:'Runtherd', faction:'orks', bsId:'f401-c74a-cca8-5de3',
  stats:[
    { name:'Runtherd', M:'6"', T:'5', Sv:'5+', W:'3', Ld:'7+', OC:'1', InSv:'–', base:'32mm' }
  ],
  ranged:[
    { name:'Slugga', range:'12"', A:'1', BS:'5+', S:'4', AP:'0', D:'1' }
  ],
  melee:[
    { name:'Runtherd’s Toolz', range:'Melee', A:'3', WS:'3+', S:'5', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'That’ll Learn Ya', tag:'Once per battle round, per unit', text:'When this unit becomes **battle-shocked**, if this unit contains 4+ Gretchin models, you can roll one D3:\n- That number of Gretchin models in this unit are **destroyed**.\n- That unit is no longer **battle-shocked**.' }
  ]
},
'world-eaters/kharn-the-betrayer':{
  name:'Khârn the Betrayer', faction:'world-eaters', bsId:'3449-7dac-6ac8-5d51',
  stats:[
    { name:'Khârn the Betrayer', M:'8"', T:'5', Sv:'3+', W:'5', Ld:'6+', OC:'1', InSv:'4+', base:'40mm' }
  ],
  ranged:[
    { name:'standard', group:'Plasma pistol', range:'12"', A:'1', BS:'3+', S:'7', AP:'-2', D:'1', kw:['PISTOL'] },
    { name:'supercharge', group:'Plasma pistol', range:'12"', A:'1', BS:'3+', S:'8', AP:'-3', D:'2', kw:['HAZARDOUS','PISTOL'] }
  ],
  melee:[
    { name:'Gorechild', range:'Melee', WS:'2+', S:'7', AP:'-2', D:'3', kw:[] }
  ],
  abilities:[
    { name:'Legendary Killer', ph:['fight'], turn:'either', text:'While this model is leading a unit, each time a model in that unit makes a melee attack, re-roll a Hit roll of 1 and re-roll a Wound roll of 1.' },
    { name:'The Betrayer', ph:['charge'], turn:'your', text:'At the end of your Charge phase, if this unit is on the battlefield, is **unengaged**, and contains a **bodyguard** model, this unit makes a **leadership roll**:\n- If that **leadership roll** is failed, one **bodyguard** model in this unit is **destroyed**.' },
    { name:'Berserker Frenzy', def:'Khârn: the first time he is destroyed, at the end of the phase on a 2+ he is set back up with 3 wounds, as close as possible to where he was destroyed and not within Engagement Range of enemy units', text:'The first time this model is destroyed, at the end of the phase, roll one D6: on a 2+, set this model back up on the battlefield as close as possible to where it was destroyed and not within Engagement Range of any enemy units, with 3 wounds remaining.', defOf:'b3301bb7' }
  ]
},
'world-eaters/khorne-berzerkers':{
  name:'Khorne Berzerkers', faction:'world-eaters', bsId:'f909-00c7-8ba4-018a',
  stats:[
    { name:'Khorne Berzerker', M:'8"', T:'5', Sv:'3+', W:'2', Ld:'6+', OC:'2', InSv:'–', base:'32mm' }
  ],
  ranged:[
    { name:'standard', group:'Plasma pistol', range:'12"', A:'1', BS:'4+', S:'7', AP:'-2', D:'1', kw:['PISTOL'] },
    { name:'supercharge', group:'Plasma pistol', range:'12"', A:'1', BS:'4+', S:'8', AP:'-3', D:'2', kw:['HAZARDOUS','PISTOL'] },
    { name:'Bolt pistol', range:'12"', A:'1', BS:'4+', S:'5', AP:'-1', D:'1', kw:['PISTOL'] }
  ],
  melee:[
    { name:'Chainblade', range:'Melee', WS:'3+', S:'5', AP:'-1', D:'1', kw:[], A:'4' },
    { name:'Khornate eviscerator', range:'Melee', WS:'3+', S:'8', AP:'-2', D:'2', kw:[], A:'3' }
  ],
  abilities:[
    { name:'Blood Surge', ph:['shooting'], turn:'opp', text:'In your opponent’s Shooting phase, when an enemy unit has shot, if a model in this unit was destroyed as a result of those attacks, this unit can make a surge move of up to D6+2".' },
    { name:'Murderous Charge', ph:['fight'], turn:'either', text:'If this unit made a charge move this turn, this unit’s melee attacks have +1 S.' },
    // at/ph: when its extra dice are rolled, with a Blessings of Khorne roll (the start of the battle round; Skulls for the Skull
    // Throne! in the Fight phase)
    { name:'Icon of Khorne', at:'Start of the battle round', ph:['command','movement','shooting','fight'], turn:'either', turns:{ movement:'opp', shooting:'your' }, text:'If the bearer’s unit contains one or more Icons of Khorne, each time the bearer’s unit destroys an enemy unit, you gain 1 Bloodshed point. Each time you make a **Blessings of Khorne** roll, roll one additional D6 for each Bloodshed point you have, after which, all your Bloodshed points are lost.' }
  ]
},
'world-eaters/daemon-prince-of-khorne':{
  name:'Daemon Prince of Khorne', faction:'world-eaters', bsId:'40c5-9ebd-6d42-2855', role:'Character',
  stats:[
    { name:'Daemon Prince of Khorne', M:'10"', T:'10', Sv:'2+', W:'10', Ld:'6+', OC:'3', InSv:'4+', base:'60mm' }
  ],
  ranged:[
    { name:'Infernal cannon', range:'24"', A:'3', BS:'3+', S:'5', AP:'-1', D:'2', kw:['RAPID FIRE 1'] }
  ],
  melee:[
    { name:'strike', group:'Hellforged weapons', range:'Melee', WS:'2+', S:'8', AP:'-2', D:'3', kw:[] },
    { name:'sweep', group:'Hellforged weapons', range:'Melee', WS:'2+', S:'6', AP:'-1', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Lord of Murder', def:'Lone Operative while within 3" of a friendly WORLD EATERS INFANTRY unit', text:'While this model is within 3" of one or more friendly **WORLD EATERS INFANTRY** units, this model has the **Lone Operative** ability.', defOf:'45fe6a69' },
    { name:'Devastating Assault', ph:['charge','fight'], turn:'either', text:'Each time this model makes a Charge move, until the end of the turn, its hellforged weapons have the **[DEVASTATING WOUNDS]** ability.' },
    { name:'Direct the Slaughter', tag:'Once per battle round', ph:['command','movement','shooting','charge','fight'], turn:'either', text:'Once per battle round, one model from your army with this ability can use it when a friendly **WORLD EATERS** unit within 12" of this model is targeted with a Stratagem. If it does, reduce the CP cost of that Stratagem by 1CP.' }
  ],
  rules:['Deadly Demise D3','Blessings of Khorne','Rapid Fire'],
  kw:['Chaos','Character','Daemon','Daemon Prince','Faction: World Eaters','Khorne','Monster']
},
'world-eaters/lord-on-juggernaut':{
  name:'Lord on Juggernaut', faction:'world-eaters', bsId:'ec72-f024-4283-0558', role:'Character',
  stats:[
    { name:'Lord on Juggernaut', M:'10"', T:'6', Sv:'3+', W:'7', Ld:'6+', OC:'2', InSv:'4+', base:'90×52.5mm' }
  ],
  ranged:[
    { name:'standard', group:'Plasma pistol', range:'12"', A:'1', BS:'3+', S:'7', AP:'-2', D:'1', kw:['PISTOL'] },
    { name:'supercharge', group:'Plasma pistol', range:'12"', A:'1', BS:'3+', S:'8', AP:'-3', D:'2', kw:['HAZARDOUS','PISTOL'] }
  ],
  melee:[
    { name:'Bladed horn', range:'Melee', WS:'3+', S:'6', AP:'-1', D:'2', kw:['EXTRA ATTACKS','LANCE'], A:'4' },
    { name:'Exalted chainblade', range:'Melee', WS:'2+', S:'6', AP:'-1', D:'2', kw:[], A:'7' }
  ],
  abilities:[
    { name:'Aggressive Advance', ph:['movement','charge'], turn:'your', turns:{ charge:'either' }, text:'While this model is leading a unit, models in that unit have a Move characteristic of 10" and each time a model in that unit makes a Normal, Advance, Fall Back or Charge move, it can move horizontally through terrain features.' },
    { name:'Crush All Who Stand Before Us', ph:['fight'], turn:'either', text:'Each time this model’s unit is selected to fight, you can use this ability. When determining which models in this unit are eligible to fight, any models in it that are within 3" of one or more enemy models are eligible to fight. When resolving those attacks, such models can target one of those enemy units that is within 3" of them and within Engagement Range of their unit.' }
  ],
  rules:['Leader','Blessings of Khorne','Extra Attacks','Lance','Pistol','Hazardous'],
  kw:['Chaos','Character','Faction: World Eaters','Khorne','Lord on Juggernaut','Mounted']
},
'world-eaters/slaughterbound':{
  name:'Slaughterbound', faction:'world-eaters', bsId:'71c9-b10b-b55f-483e', role:'Character',
  stats:[
    { name:'Slaughterbound', M:'10"', T:'6', Sv:'3+', W:'6', Ld:'6+', OC:'1', InSv:'5+', base:'50mm' }
  ],
  melee:[
    { name:'Lacerator and daemonic claw', range:'Melee', WS:'2+', S:'10', AP:'-2', D:'2', kw:[] }
  ],
  abilities:[
    { name:'Rage Eternal', ph:['command'], turn:'your', text:'While this model is leading a unit, in your Command phase, you can return one destroyed Bodyguard model to that unit.' },
    { name:'Possessed Lord', tag:'Once per battle', ph:['fight'], turn:'either', text:'Once per battle, at the start of the Fight phase, this model can use this ability. If it does, until the end of the phase, add 3 to the Attacks characteristic of melee weapons equipped by this model and those weapons have the **[Devastating Wounds]** ability.' },
    { name:'Lord of the Eightbound', text:'If this model is attached to a **WORLD EATERS POSSESSED** unit during the Declare Battle Formations step, this model has the **Deep Strike** and **Scouts 6"** abilities.' }
  ],
  rules:['Leader','Deadly Demise D3','Blessings of Khorne'],
  kw:['Chaos','Character','Daemon','Faction: World Eaters','Infantry','Khorne','Possessed','Slaughterbound']
},
'world-eaters/exalted-eightbound':{
  name:'Exalted Eightbound', faction:'world-eaters', bsId:'9932-3d2b-1e47-d53b', role:'Infantry',
  stats:[
    { name:'Exalted Eightbound', M:'10"', T:'6', Sv:'3+', W:'3', Ld:'6+', OC:'1', InSv:'5+', base:'40mm' }
  ],
  melee:[
    { name:'Chainblades', range:'Melee', WS:'3+', S:'8', AP:'-3', D:'2', kw:['ANTI-MONSTER 3+','ANTI-VEHICLE 3+'] }
  ],
  abilities:[
    { name:'Rend and Tear', ph:['fight'], turn:'either', text:'Each time a model in this unit makes a melee attack that targets a **MONSTER** or **VEHICLE** unit, until the end of the phase, improve the Damage characteristic of that attack by 1.' }
  ],
  rules:['Deep Strike','Blessings of Khorne','Anti'],
  kw:['Chaos','Daemon','Exalted Eightbound','Faction: World Eaters','Infantry','Khorne','Possessed']
},
'world-eaters/chaos-rhino':{
  name:'Chaos Rhino', faction:'world-eaters', bsId:'e849-ce40-ee43-7623', role:'Dedicated Transport',
  stats:[
    { name:'Chaos Rhino', M:'12"', T:'9', Sv:'3+', W:'10', Ld:'6+', OC:'2', InSv:'–', base:'Hull' }
  ],
  ranged:[
    { name:'Combi-bolter', range:'24"', A:'2', BS:'4+', S:'5', AP:'-1', D:'1', kw:['RAPID FIRE 4'] }
  ],
  melee:[
    { name:'Armoured tracks', range:'Melee', WS:'3+', S:'6', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Meet Any Challenge', ph:['movement'], turn:'opp', text:'In your opponent’s Movement phase, each time an enemy unit is set up or ends a Normal, Advance or Fall Back move within 8" of this model, any units embarked within it can disembark.' },
    { name:'Transport', tag:'Capacity', text:'This model has a transport capacity of 12 **WORLD EATERS INFANTRY** models. It cannot transport **POSSESSED** or **TERMINATOR** models.' }
  ],
  rules:['Deadly Demise D3','Blessings of Khorne','Firing Deck 2','Rapid Fire'],
  kw:['Chaos','Dedicated Transport','Faction: World Eaters','Frame','Khorne','Rhino','Smoke','Transport','Vehicle']
},
'world-eaters/eightbound':{
  name:'Eightbound', faction:'world-eaters', bsId:'9435-1f44-7e5b-d510', role:'Infantry',
  stats:[
    { name:'Eightbound', M:'10"', T:'6', Sv:'3+', W:'3', Ld:'6+', OC:'1', InSv:'5+', base:'40mm' }
  ],
  melee:[
    { name:'Chainblades', range:'Melee', WS:'3+', S:'8', AP:'-2', D:'2', kw:[] }
  ],
  abilities:[
    { name:'Beacons of Rage', tag:'Aura', ph:['fight'], turn:'either', text:'While a friendly **WORLD EATERS** unit is within 6" of this unit, each time a model in that unit makes a melee attack that targets a unit (excluding **MONSTERS** and **VEHICLES**), add 1 to the Hit roll. If that attack targets a unit that is Below Half-strength, add 1 to the Wound roll as well.' }
  ],
  rules:['Scouts 6"','Blessings of Khorne'],
  kw:['Chaos','Daemon','Eightbound','Faction: World Eaters','Infantry','Khorne','Possessed']
},
'world-eaters/jakhals':{
  name:'Jakhals', faction:'world-eaters', bsId:'6f81-4538-a414-251e', role:'Infantry',
  stats:[
    { name:'Jakhal', M:'7"', T:'4', Sv:'6+', W:'1', Ld:'7+', OC:'1', InSv:'–', base:'28.5mm' },
    { name:'Dishonoured w/ paired manglers', M:'7"', T:'4', Sv:'6+', W:'1', Ld:'7+', OC:'1', InSv:'–', base:'40mm' }
  ],
  ranged:[
    { name:'Autopistol', range:'12"', A:'1', BS:'4+', S:'3', AP:'0', D:'1', kw:['PISTOL'] }
  ],
  melee:[
    { name:'Chainblades', range:'Melee', WS:'4+', S:'3', AP:'0', D:'1', kw:[], A:'3' },
    { name:'Paired manglers', range:'Melee', WS:'4+', S:'4', AP:'0', D:'1', kw:[], A:'4' }
  ],
  abilities:[
    { name:'Objective Ravaged', ph:['command'], turn:'your', text:'At the end of your Command phase, if this unit is within range of an objective marker you control, that objective marker remains under your control until your opponent’s Level of Control over that objective marker is greater than yours at the end of a phase.' }
  ],
  rules:['Blessings of Khorne','Pistol'],
  kw:['Chaos','Faction: World Eaters','Grenades','Infantry','Jakhals','Khorne']
},
'world-eaters/forgefiend':{
  name:'Forgefiend', faction:'world-eaters', bsId:'81e1-b212-69c1-308f', role:'Vehicle',
  stats:[
    { name:'Forgefiend', M:'10"', T:'10', Sv:'3+', W:'12', Ld:'6+', OC:'3', InSv:'5+', base:'120×92mm' }
  ],
  ranged:[
    { name:'Hades autocannon', range:'36"', A:'6', BS:'4+', S:'8', AP:'-1', D:'2', kw:['RAPID FIRE 4'] },
    { name:'Ectoplasma cannon', range:'36"', A:'D3', BS:'4+', S:'10', AP:'-3', D:'3', kw:['BLAST','RAPID FIRE 1'] }
  ],
  melee:[
    { name:'Forgefiend claws', range:'Melee', WS:'3+', S:'6', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Furious Onslaught', ph:['shooting'], turn:'your', text:'Each time this model makes a ranged attack that targets the closest eligible target within 18", you can re-roll the Hit roll.' },
    { name:'Damaged: 1-4 wounds remaining', damaged:'1-4', text:'While this model has 1-4 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' }
  ],
  rules:['Deadly Demise D3','Blessings of Khorne','Rapid Fire','Blast'],
  kw:['Chaos','Daemon','Faction: World Eaters','Forgefiend','Khorne','Vehicle','Walker']
},
'world-eaters/angron':{
  name:'Angron', faction:'world-eaters', bsId:'f4b8-1179-de57-4d69', role:'Epic Hero',
  stats:[
    { name:'Angron', M:'14"', T:'11', Sv:'2+', W:'16', Ld:'5+', OC:'6', InSv:'4+', base:'100mm' }
  ],
  melee:[
    { name:'strike', group:'Samni’arius and Spinegrinder', range:'Melee', WS:'2+', S:'14', AP:'-3', D:'D6+2', kw:['DEVASTATING WOUNDS'], A:'8' },
    { name:'sweep', group:'Samni’arius and Spinegrinder', range:'Melee', WS:'2+', S:'7', AP:'-2', D:'2', kw:['DEVASTATING WOUNDS'], A:'16' }
  ],
  abilities:[
    { name:'Reborn in Blood', at:'Start of the battle round', ph:['command','movement'], turn:'either', turns:{ movement:'your' }, text:'At the start of the battle round, when you make a **Blessings of Khorne** roll, if this model is destroyed, you can use a triple 6 from that roll to use this ability instead of activating any Blessings of Khorne at the start of that battle round. If you do, this model is no longer destroyed and in the Reinforcements step of your next Movement phase, it is set up anywhere on the battlefield using its **Deep Strike** ability, with 8 wounds remaining.' },
    { name:'Wrathful Presence', at:'Start of the battle round', ph:['command'], turn:'either', text:'At the start of the battle round, select one Wrathful Presence ability. Until the start of the next battle round, this model has that ability.' },
    { name:'Damaged: 1-6 wounds remaining', damaged:'1-6', text:'While this model has 1-6 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' },
    // the three Wrathful Presence abilities: Angron has the one selected at the start of the battle round
    { name:'The Blood God’s Favour', who:'Wrathful Presence: pick one', text:'Each time you make a **Blessings of Khorne** roll, if this model is on the battlefield, you can re-roll up to 6 of the D6 rolled.' },
    // GW Faction Pack Rules Update wording (BSData has it too)
    { name:'Driven by Ultimate Rage', who:'Wrathful Presence: pick one', tag:'Aura', ph:['fight'], turn:'either', text:'While a friendly **WORLD EATERS** unit is within 6" of this unit, that unit’s melee attacks can:\n- Re-roll hit rolls of 1.\n- Re-roll wound rolls of 1.' },
    { name:'Overwhelming Wrath', who:'Wrathful Presence: pick one', tag:'Aura', ph:['movement'], turn:'opp', text:'Each time an enemy unit within 6" of this model is selected to Fall Back, that unit must take a Leadership test. If that test is failed, that unit must Remain Stationary this phase instead.' }
  ],
  rules:['Deadly Demise D6','Deep Strike','Blessings of Khorne','Devastating Wounds'],
  kw:['Angron','Chaos','Character','Daemon','Epic Hero','Faction: World Eaters','Fly','Khorne','Monster','Primarch']
},
'world-eaters/goremongers':{
  name:'Goremongers', faction:'world-eaters', bsId:'b399-9b66-e550-8050', role:'Infantry',
  stats:[
    { name:'Goremongers', M:'9"', T:'4', Sv:'6+', W:'1', Ld:'7+', OC:'1', InSv:'–', base:'32mm' }
  ],
  ranged:[
    { name:'Autopistol', range:'12"', A:'1', BS:'4+', S:'3', AP:'0', D:'1', kw:['PISTOL'] }
  ],
  melee:[
    { name:'Chainblade', range:'Melee', WS:'4+', S:'3', AP:'0', D:'1', kw:['LANCE'], A:'3' },
    { name:'Close combat weapon', range:'Melee', WS:'4+', S:'3', AP:'0', D:'1', kw:[], A:'2' }
  ],
  abilities:[
    { name:'Loping Speed', ph:['movement'], turn:'opp', text:'In your opponent’s Movement phase, if an enemy unit ends a move within 8" of this unit, if this unit is not within **Engagement Range** of one or more enemy units, this unit can make a **Normal move** of up to D6".' }
  ],
  rules:['Infiltrators','Blessings of Khorne','Pistol','Lance'],
  kw:['Chaos','Faction: World Eaters','Goremongers','Grenades','Infantry','Khorne']
},
'world-eaters/chaos-terminators':{
  name:'Chaos Terminators', faction:'world-eaters', bsId:'45f6-8429-a1d9-2a51', role:'Infantry',
  stats:[
    { name:'Chaos Terminators', M:'7"', T:'6', Sv:'2+', W:'3', Ld:'6+', OC:'1', InSv:'4+', base:'40mm' }
  ],
  ranged:[
    { name:'Combi-bolter', range:'24"', A:'2', BS:'4+', S:'5', AP:'-1', D:'1', kw:['RAPID FIRE 4'] },
    { name:'Reaper autocannon', range:'36"', A:'4', BS:'4+', S:'7', AP:'-1', D:'1', kw:['DEVASTATING WOUNDS','RAPID FIRE 2','SUSTAINED HITS 1'] }
  ],
  melee:[
    { name:'Paired accursed weapons', range:'Melee', S:'5', AP:'-2', D:'1', kw:['TWIN-LINKED'] },
    { name:'Chainfist', range:'Melee', S:'8', AP:'-3', D:'2', kw:['ANTI-VEHICLE 3+'] },
    { name:'Power fist', range:'Melee', S:'8', AP:'-2', D:'2', kw:[] }
  ],
  abilities:[
    // GW Faction Pack Rules Update wording ("Chaos Terminators, Blood Fury Ability"), Wahapedia's bold. Its two parts are
    // bullets there, the second with two sub-bullets; the app has one level of bullets, so the parts are paragraphs
    { name:'Bloody Fury', ph:['shooting','charge'], turn:'your', turns:{ charge:'either' }, text:'This unit’s ranged attacks that target the closest eligible target can re-roll **hit rolls**.\nWhen this unit **declares a charge**, you can use this part of this ability. If you do:\n- This unit can re-roll that **charge roll**.\n- This unit must end that **charge move** **engaged** with the closest **charge target**.' }
  ],
  rules:['Deep Strike','Blessings of Khorne','Twin-linked','Anti','Rapid Fire','Sustained Hits','Devastating Wounds'],
  kw:['Chaos','Faction: World Eaters','Infantry','Khorne','Terminator','Terminator Squad']
},
'world-eaters/skarbrand':{
  name:'Skarbrand', faction:'world-eaters', bsId:'71d9-9dc2-2b9a-6db3', role:'Epic Hero',
  stats:[
    { name:'Skarbrand', M:'10"', T:'11', Sv:'3+', W:'20', Ld:'6+', OC:'5', InSv:'4+', base:'100mm' }
  ],
  ranged:[
    { name:'Bellow of endless fury', range:'12"', A:'2D6', BS:'–', S:'8', AP:'-1', D:'1', kw:['IGNORES COVER','TORRENT'] }
  ],
  melee:[
    { name:'strike', group:'Slaughter and Carnage', range:'Melee', A:'8', WS:'2+', S:'16', AP:'-4', D:'6', kw:[] },
    { name:'sweep', group:'Slaughter and Carnage', range:'Melee', A:'16', WS:'2+', S:'8', AP:'-2', D:'2', kw:[] }
  ],
  abilities:[
    { name:'Rage Embodied', tag:'Aura', ph:['fight'], turn:'either', text:'While a friendly **BLOOD LEGIONS** unit is within 6" of this model, add 1 to the Attacks characteristic of melee weapons equipped by models in that unit.' },
    { name:'Murderlust', text:'This unit is eligible to declare a charge in a turn in which it Advanced.' },
    { name:'Damaged: 1-7 wounds remaining', damaged:'1-7', text:'While this model has 1-7 wounds remaining, add 2 to the Attacks characteristic of this model’s Slaughter and Carnage.' }
  ],
  rules:['Deadly Demise D6','Deep Strike','Ignores Cover','Torrent'],
  kw:['Chaos','Character','Daemon','Epic Hero','Faction: Blood Legions','Khorne','Monster','Skarbrand']
},
'world-eaters/bloodthirster':{
  name:'Bloodthirster', faction:'world-eaters', bsId:'4ad2-bd20-6dfe-776b', role:'Character',
  stats:[
    { name:'Bloodthirster', M:'12"', T:'11', Sv:'3+', W:'18', Ld:'6+', OC:'5', InSv:'4+', base:'120×92mm' }
  ],
  ranged:[
    { name:'Hellfire breath', range:'12"', A:'D6', BS:'–', S:'5', AP:'-1', D:'1', kw:['IGNORES COVER','TORRENT'] }
  ],
  melee:[
    { name:'strike', group:'Great axe of Khorne', range:'Melee', A:'7', WS:'2+', S:'16', AP:'-4', D:'D6+2', kw:[] },
    { name:'sweep', group:'Great axe of Khorne', range:'Melee', A:'14', WS:'2+', S:'10', AP:'-2', D:'2', kw:[] }
  ],
  abilities:[
    { name:'Daemon Lord of Khorne', tag:'Aura', ph:['fight'], turn:'either', text:'While a friendly **BLOOD LEGIONS** unit is within 6" of this model, each time a model in that unit makes a melee attack, add 1 to the **Hit roll**.' },
    { name:'Relentless Carnage', ph:['fight'], turn:'either', text:'At the end of the Fight phase, you can select one enemy unit within Engagement Range of this model and roll eight D6: for each 4+, that enemy unit suffers 1 mortal wound.' },
    { name:'Damaged: 1-6 wounds remaining', damaged:'1-6', text:'While this model has 1-6 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' }
  ],
  rules:['Deadly Demise D6','Deep Strike','Ignores Cover','Torrent'],
  kw:['Bloodthirster','Chaos','Character','Daemon','Faction: Blood Legions','Fly','Khorne','Monster','Summoned']
},
'world-eaters/master-of-executions':{
  name:'Master of Executions', faction:'world-eaters', bsId:'1b56-682c-ac33-bc5f', role:'Character',
  stats:[
    { name:'Master of Executions', M:'8"', T:'5', W:'4', Ld:'6+', OC:'1', InSv:'–', base:'40mm' }
  ],
  ranged:[
    { name:'Bolt pistol', range:'12"', A:'1', BS:'3+', S:'5', AP:'-1', D:'1', kw:['PISTOL'] }
  ],
  melee:[
    { name:'Axe of dismemberment', range:'Melee', A:'5', WS:'2+', S:'7', AP:'-2', D:'2', kw:['DEVASTATING WOUNDS','PRECISION'] }
  ],
  abilities:[
    { name:'A Worthy Skull', ph:['fight'], turn:'either', text:'Each time this model makes a melee attack that targets a **CHARACTER** unit, you can re-roll the **Hit roll** and you can re-roll the **Wound roll**. Each time this model’s unit destroys a **CHARACTER** model, you gain 1CP.' },
    { name:'Forwards, For Blood!', ph:['movement','shooting'], turn:'your', turns:{ shooting:'opp' }, text:'While this model is leading a unit, you can re-roll Advance rolls made for that unit and each time that unit makes a Blood Surge move, you can re-roll the D6 used to determine how far models in that unit move.' }
  ],
  rules:['Leader','Blessings of Khorne','Precision','Devastating Wounds','Pistol'],
  kw:['Chaos','Character','Faction: World Eaters','Infantry','Khorne','Master of Executions']
},
'world-eaters/flesh-hounds':{
  name:'Flesh Hounds', faction:'world-eaters', bsId:'b657-1743-6e3a-0838', role:'Beast',
  stats:[
    { name:'Flesh Hounds', M:'12"', T:'4', Sv:'7+', W:'2', Ld:'7+', OC:'1', InSv:'5+', base:'60×35.5mm' }
  ],
  ranged:[
    { name:'Burning roar', range:'12"', A:'D6', BS:'–', S:'4', AP:'0', D:'1', kw:['IGNORES COVER','TORRENT'] }
  ],
  melee:[
    { name:'Gore-drenched fangs', range:'Melee', A:'3', WS:'3+', S:'5', AP:'-1', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Hunters from the Warp', at:'End of your opponent’s turn', ph:['fight'], turn:'opp', text:'At the end of your opponent’s turn, if this unit is not within Engagement Range of one or more enemy units, you can remove it from the battlefield and place it into Strategic Reserves.' },
    { name:'Collar of Khorne', def:'Feel No Pain 3+ against Psychic Attacks', text:'The bearer has the Feel No Pain 3+ ability against Psychic Attacks.', defOf:'dd155389' }
  ],
  rules:['Deep Strike','Ignores Cover','Torrent','Feel No Pain 3+'],
  kw:['Beast','Chaos','Daemon','Faction: Blood Legions','Flesh Hounds','Khorne','Summoned']
},
'thousand-sons/magnus-the-red':{
  name:'Magnus the Red', faction:'thousand-sons', bsId:'91dc-9aad-0505-52a8', role:'Epic Hero',
  stats:[
    { name:'Magnus the Red', M:'14"', T:'11', Sv:'2+', W:'16', Ld:'5+', OC:'6', InSv:'4+', base:'100mm' }
  ],
  ranged:[
    { name:'Gaze of Magnus', range:'24"', A:'3D3', BS:'2+', S:'11', AP:'-2', D:'3', kw:['DEVASTATING WOUNDS','PSYCHIC'] },
    { name:'Tzeentch’s Firestorm', range:'24"', A:'D6+3', BS:'2+', S:'6', AP:'-1', D:'2', kw:['BLAST','IGNORES COVER','PSYCHIC'] }
  ],
  melee:[
    { name:'strike', group:'Blade of Magnus', range:'Melee', A:'7', WS:'2+', S:'16', AP:'-3', D:'3', kw:['DEVASTATING WOUNDS','PSYCHIC'] },
    { name:'sweep', group:'Blade of Magnus', range:'Melee', A:'14', WS:'2+', S:'8', AP:'-1', D:'2', kw:['PSYCHIC'] }
  ],
  abilities:[
    { name:'Damaged: 1-6 wounds remaining', damaged:'1-6', text:'While this model has 1-6 wounds remaining, each time this model makes an attack, subtract 1 from the **Hit roll**.' },
    { name:'Unearthly Power', at:'Start of the battle round', ph:['command'], turn:'either', text:'At the start of the battle round, select one of the abilities in the Crimson King section. Until the start of the next battle round, this model has that ability.' },
    { name:'Lord of the Planet of the Sorcerers', tag:'Psychic', ph:['shooting'], turn:'your', text:'This model can attempt up to 2 **Rituals** per turn instead of one, and each time this model attempts a **Ritual**, add 2 to the **Psychic test** result.' },
    { name:'Impossible Form', who:'Crimson King', tag:'Psychic', def:'Impossible Form (if picked this round): -1 Damage to attacks against Magnus, excluding psychic attacks', text:'Each time an attack is made against this **PSYKER** (excluding **Psychic Attacks**), subtract 1 from the Damage characteristic of that attack.', defOf:'e55add18' },
    { name:'Treason of Tzeentch', who:'Crimson King', tag:'Psychic', ph:['shooting'], turn:'opp', text:'At the start of your opponent’s Shooting phase, select one enemy unit within 24" of this **PSYKER**. Until the end of the phase, ranged weapons equipped by models in that unit have the **[HAZARDOUS]** ability.' },
    { name:'Time Flux', who:'Crimson King', tag:'Aura, Psychic', ph:['movement'], turn:'your', text:'While a friendly **THOUSAND SONS** unit is within 6" of this **PSYKER**, add 2" to the Move characteristic of models in that unit.' }
  ],
  rules:['Deep Strike','Deadly Demise D6','Cabal of Sorcerers','Devastating Wounds','Psychic','Blast','Ignores Cover'],
  kw:['Chaos','Character','Daemon','Epic Hero','Faction: Thousand Sons','Fly','Magnus the Red','Monster','Primarch','Psyker','Tzeentch']
},
'thousand-sons/daemon-prince-of-tzeentch-with-wings':{
  name:'Daemon Prince of Tzeentch with wings', faction:'thousand-sons', bsId:'66f4-929e-1769-f277', role:'Character',
  stats:[
    { name:'Daemon Prince of Tzeentch with wings', M:'13"', T:'9', Sv:'2+', W:'10', Ld:'6+', OC:'3', InSv:'4+', base:'60mm' }
  ],
  ranged:[
    { name:'Dark Blessing', range:'24"', A:'9', BS:'2+', AP:'-1', kw:['IGNORES COVER','PSYCHIC','SUSTAINED HITS 1'], S:'4', D:'1' },
    { name:'Infernal cannon', range:'24"', A:'3', BS:'2+', S:'5', AP:'-2', D:'2', kw:[] }
  ],
  melee:[
    { name:'strike', group:'Hellforged weapons', range:'Melee', A:'6', WS:'2+', AP:'-2', kw:['DEVASTATING WOUNDS','PSYCHIC'], S:'8', D:'3' },
    { name:'sweep', group:'Hellforged weapons', range:'Melee', A:'12', WS:'2+', AP:'-1', kw:['DEVASTATING WOUNDS','PSYCHIC'], S:'6', D:'1' }
  ],
  abilities:[
    // Aetherstride: the Faction Pack's Rules Updates wording ("that is more than 6\""); New Recruit and BSData print the older text
    { name:'Aetherstride', tag:'Psychic', ph:['movement','shooting','charge'], turn:'your', text:'In your Movement phase, when this model is set up on the battlefield using the **Deep Strike** ability, it can perform an aetherstride. If it does:\n- It can be set up anywhere on the battlefield that is more than 6" horizontally away from all enemy units.\n- Until the end of the turn, its Dark Blessing has the **[SUSTAINED HITS D3]** ability.\n- Until the end of the turn, it is not eligible to declare a charge.' },
    { name:'Hunter of Souls', ph:['movement','shooting','fight'], turn:'either', turns:{ movement:'opp', shooting:'your' }, text:'Each time this model makes an attack that targets a **CHARACTER** unit, re-roll a Hit roll of 1 and re-roll a Wound roll of 1 (if that attack targets a **PSYKER CHARACTER** unit, you can re-roll the Hit roll and you can re-roll the Wound roll instead). Each time this model destroys a **CHARACTER** unit, this model regains up to D3 lost wounds (if that **CHARACTER** unit was a **PSYKER**, this model regains up to 3 lost wounds instead).' }
  ],
  rules:['Deadly Demise D3','Cabal of Sorcerers','Deep Strike','Ignores Cover','Sustained Hits','Psychic','Devastating Wounds'],
  kw:['Chaos','Character','Daemon','Daemon Prince','Faction: Thousand Sons','Fly','Monster','Psyker','Tzeentch']
},
'thousand-sons/exalted-sorcerer':{
  name:'Exalted Sorcerer', faction:'thousand-sons', bsId:'c3a6-8fab-45f0-2d45',
  stats:[
    { name:'Exalted Sorcerer', M:'6"', T:'5', Sv:'3+', W:'5', Ld:'6+', OC:'1', InSv:'4+', base:'32mm' }
  ],
  ranged:[
    { name:'Astral Blast', range:'18"', A:'D6', BS:'2+', S:'6', AP:'-2', D:'D3', kw:['BLAST','DEVASTATING WOUNDS','PSYCHIC'] },
    { name:'Inferno bolt pistol', range:'12"', A:'1', BS:'2+', S:'5', AP:'-2', D:'1', kw:['PISTOL'] }
  ],
  melee:[
    { name:'Force weapon', range:'Melee', A:'5', WS:'2+', S:'6', AP:'-1', D:'D3', kw:['PSYCHIC'] },
    { name:'Prosperine khopesh', range:'Melee', A:'4', WS:'2+', S:'5', AP:'-2', D:'2', kw:[] }
  ],
  abilities:[
    { name:'Arcane Shield', tag:'Psychic', text:'While this model is leading a unit, models in that unit have a 4+ invulnerable save.' },
    { name:'Rebind Rubricae', tag:'Psychic', ph:['command'], turn:'your', text:'In your Command phase, if this model is leading a unit, you can roll one D6: on a 1, that unit suffers D3 **mortal wounds**; on a 2-5, you can return 1 destroyed **Bodyguard** model to that unit; on a 6, you can return up to 2 destroyed Bodyguard models to that unit.' }
  ]
},
'thousand-sons/rubric-marines':{
  name:'Rubric Marines', faction:'thousand-sons', bsId:'5d3d-e13b-8b76-dad3',
  stats:[
    { name:'Rubric Marine', M:'6"', T:'5', Sv:'3+', W:'2', Ld:'7+', OC:'2', base:'32mm' },
    { name:'Aspiring Sorcerer', M:'6"', T:'5', Sv:'3+', W:'3', Ld:'6+', OC:'2', base:'32mm' }
  ],
  ranged:[
    { name:'Malefic Curse', range:'24"', A:'3', BS:'3+', S:'4', AP:'-3', D:'1' },
    { name:'Warpflame pistol', range:'12"', A:'D6', BS:'–', S:'3', AP:'-1', D:'1', kw:['IGNORES COVER','PISTOL','TORRENT'] },
    { name:'Soulreaper cannon', range:'24"', A:'6', BS:'3+', S:'6', AP:'-2', D:'1' },
    { name:'Warpflamer', range:'12"', A:'D6', BS:'–', S:'4', AP:'-1', D:'1', kw:['IGNORES COVER','TORRENT'] }
  ],
  melee:[
    { name:'Force weapon', range:'Melee', A:'3', WS:'3+', S:'6', AP:'-1', D:'D3', kw:['PSYCHIC'] },
    { name:'Close combat weapon', range:'Melee', A:'2', WS:'3+', S:'5', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Bringers of Change', ph:['movement','shooting'], turn:'your', turns:{ movement:'opp' }, text:'Each time a model in this unit makes a ranged attack, re-roll a Wound roll of 1. If the attack targets a unit within range of an objective marker you do not control, you can re-roll the Wound roll instead.' },
    { name:'Icon of Flame', text:'Ranged weapons equipped by models in the bearer’s unit (excluding **CHARACTERS**) have the **[IGNORES COVER]** ability.' }
  ]
},
'thousand-sons/sorcerer-in-terminator-armour':{
  name:'Sorcerer in Terminator Armour', faction:'thousand-sons', bsId:'c6d1-e73b-9d26-5d8b',
  stats:[
    { name:'Sorcerer in Terminator Armour', M:'5"', T:'6', Sv:'2+', W:'5', Ld:'6+', OC:'1', InSv:'4+', base:'40mm' }
  ],
  ranged:[
    { name:'Gaze of Hate', range:'18"', A:'3', BS:'3+', S:'4', AP:'-3', D:'2' },
    { name:'Inferno combi-bolter', range:'24"', A:'2', BS:'3+', S:'5', AP:'-2', D:'1' }
  ],
  melee:[
    { name:'Force weapon', range:'Melee', A:'5', WS:'3+', S:'6', AP:'-1', D:'D3' }
  ],
  abilities:[
    { name:'Marked by Fate', tag:'Psychic', ph:['shooting'], turn:'your', text:'At the start of your Shooting phase, select one enemy unit that is **visible** to this **PSYKER** model. Until the end of the phase, each time a model in this unit makes an attack that targets that enemy unit, add 1 to the **Hit roll**.' },
    { name:'Empyric Guidance', tag:'Psychic', text:'While this model is leading a unit, weapons equipped by models in that unit have the **[LETHAL HITS]** ability.' }
  ]
},
'thousand-sons/scarab-occult-terminators':{
  name:'Scarab Occult Terminators', faction:'thousand-sons', bsId:'b1cf-c5-5121-92a4',
  stats:[
    { name:'Scarab Occult Sorcerer', M:'5"', T:'6', Sv:'2+', W:'4', Ld:'6+', OC:'1', InSv:'4+', base:'40mm' },
    { name:'Scarab Occult Terminator', M:'5"', T:'6', Sv:'2+', W:'3', Ld:'7+', OC:'1', InSv:'4+', base:'40mm' }
  ],
  ranged:[
    { name:'Malefic Curse', range:'24"', A:'3', BS:'3+', S:'4', AP:'-3', D:'1' },
    { name:'Inferno combi-bolter', range:'24"', A:'2', BS:'3+', S:'5', AP:'-2', D:'1' },
    { name:'Soulreaper cannon', range:'24"', A:'6', BS:'3+', S:'6', AP:'-2', D:'1' },
    { name:'Hellfyre missile rack', range:'36"', A:'2', BS:'3+', S:'10', AP:'-2', D:'3' }
  ],
  melee:[
    { name:'Force weapon', range:'Melee', A:'4', WS:'3+', S:'6', AP:'-1', D:'D3' },
    { name:'Prosperine khopesh', range:'Melee', A:'3', WS:'3+', S:'5', AP:'-2', D:'2' }
  ],
  abilities:[
    { name:'Rites of Coalescence', def:'-1 to wound rolls against this unit while it contains a PSYKER model', text:'While this unit contains one or more **PSYKER** models, each time an attack targets this unit, subtract 1 from the **Wound roll**.', defOf:'34a6e2e8' }
  ]
},
'thousand-sons/tzaangors':{
  name:'Tzaangors', faction:'thousand-sons', bsId:'f5b9-50c8-5c60-d8ea', role:'Infantry',
  stats:[
    { name:'Tzaangors', M:'6"', T:'4', Sv:'6+', W:'1', Ld:'7+', OC:'1', InSv:'6+', base:'32mm' }
  ],
  melee:[
    { name:'Tzaangor blades', range:'Melee', A:'2', WS:'4+', S:'5', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Ambushing Hunters', at:'End of your opponent’s turn', ph:['fight'], turn:'opp', text:'At the end of your opponent’s turn, if this unit is more than 6" horizontally away from all enemy units, you can remove this unit from the battlefield and place it into **Strategic Reserves**.' },
    { name:'Brayhorn', ph:['movement','charge'], turn:'either', turns:{ movement:'your' }, text:'You can re-roll **Advance** and **Charge rolls** made for the bearer’s unit.' },
    { name:'Herd banner', text:'While the bearer’s unit is within range of one or more objective markers you control, improve the Leadership characteristic of models in the bearer’s unit by 1.' }
  ],
  rules:['Scouts 6"'],
  kw:['Chaos','Faction: Thousand Sons','Infantry','Mutant','Tzaangors','Tzeentch']
},
'thousand-sons/tzaangor-enlightened-with-fatecaster-greatbows':{
  name:'Tzaangor Enlightened with Fatecaster greatbows', faction:'thousand-sons', bsId:'8b9f-917f-37c1-99c3', role:'Mounted',
  stats:[
    { name:'Tzaangor Enlightened with Fatecaster greatbows', M:'10"', T:'4', Sv:'5+', W:'2', Ld:'7+', OC:'2', InSv:'5+', base:'40mm' }
  ],
  ranged:[
    { name:'Fatecaster greatbow', range:'30"', A:'2', BS:'4+', S:'5', AP:'-2', D:'2', kw:['IGNORES COVER','LETHAL HITS','PRECISION'] }
  ],
  melee:[
    { name:'Close combat weapon', range:'Melee', A:'2', WS:'4+', S:'4', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Malign Trickery', ph:['movement'], turn:'opp', text:'In your opponent\'s Movement phase, if an enemy unit ends a move within 8” of this unit, if this unit is not within **Engagement Range** of one or more enemy units, this unit can make a **Normal move** of up to D6”.' }
  ],
  rules:['Ignores Cover','Lethal Hits','Precision'],
  kw:['Chaos','Faction: Thousand Sons','Fly','Mounted','Mutant','Tzaangor Enlightened','Tzaangor Enlightened with Fatecaster Greatbows','Tzeentch']
},
'thousand-sons/defiler':{
  name:'Defiler', faction:'thousand-sons', bsId:'f158-2979-c38b-65b5', role:'Vehicle',
  stats:[
    { name:'Defiler', M:'12"', T:'11', Sv:'3+', W:'18', Ld:'6+', OC:'5', InSv:'5+', base:'160mm' }
  ],
  ranged:[
    { name:'Ectoplasma destructor', range:'36"', A:'D6', BS:'3+', S:'12', AP:'-3', D:'3', kw:['BLAST'] },
    { name:'Excruciator cannon', range:'36"', A:'6', BS:'3+', S:'6', AP:'-2', D:'2', kw:[] },
    { name:'Heavy reaper autocannon', range:'48"', A:'4', BS:'3+', S:'9', AP:'-2', D:'3', kw:['DEVASTATING WOUNDS','SUSTAINED HITS 1'] }
  ],
  melee:[
    { name:'strike', group:'Shearing claws', range:'Melee', A:'5', WS:'3+', S:'16', AP:'-3', D:'D6+1', kw:[] },
    { name:'sweep', group:'Shearing claws', range:'Melee', A:'10', WS:'3+', S:'6', AP:'-2', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Scuttling Walker', ph:['movement','shooting'], turn:'your', text:'Each time this unit makes a **Normal**, **Advance** or **Fall Back move**, it can move through models (excluding **TITANIC** models) and **terrain features**. When doing so, it can move within **Engagement Range** of enemy models, but cannot end that move within Engagement Range of them, and any Desperate Escape test is automatically passed.' },
    // every source ends the text with a stray closing quote mark (’); the app leaves it out
    { name:'Destroyer of Futures', tag:'Once per phase, per unit', ph:['fight'], turn:'opp', text:'You can target this unit with the Counteroffensive stratagem, regardless of any other uses of that stratagem this phase. If you do:\n- That use is -1 CP.\n- That use does not prevent any uses of that stratagem on other units this phase.' },
    { name:'Damaged: 1-6 wounds remaining', damaged:'1-6', text:'While this model has 1-6 wounds remaining, each time this model makes an attack, subtract 1 from the **Hit roll**.' }
  ],
  rules:['Deadly Demise D6','Blast','Sustained Hits','Devastating Wounds'],
  kw:['Chaos','Daemon','Defiler','Faction: Thousand Sons','Tzeentch','Vehicle','Walker']
},
'thousand-sons/sekhetar-robots':{
  name:'Sekhetar Robots', faction:'thousand-sons', bsId:'fe4b-b3a4-69b7-3088', role:'Vehicle',
  stats:[
    { name:'Sekhetar Robots', M:'8"', T:'6', Sv:'3+', W:'4', Ld:'7+', OC:'1', InSv:'5+', base:'40mm' }
  ],
  ranged:[
    { name:'Heavy warpflamer', range:'12"', A:'D6', BS:'–', S:'5', AP:'-2', D:'1', kw:['IGNORES COVER','TORRENT'] },
    { name:'Hellfyre missile rack', range:'36"', A:'2', BS:'4+', S:'10', AP:'-2', D:'3', kw:[] },
    { name:'Pyreflux meltagun', range:'12"', A:'1', BS:'4+', S:'10', AP:'-4', D:'D6', kw:['MELTA 2'] }
  ],
  melee:[
    { name:'Close combat weapon', range:'Melee', A:'3', WS:'4+', S:'5', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Prophetic Sentinels', tag:'Once per turn', ph:['movement','charge'], turn:'opp', text:'Once per turn, when you target this unit with the **Fire Overwatch**/**Heroic Intervention** stratagem, that use is -1 CP.' }
  ],
  rules:['Infiltrators','Stealth','Ignores Cover','Torrent','Melta'],
  kw:['Chaos','Faction: Thousand Sons','Sekhetar Robots','Tzeentch','Vehicle','Walker']
},
'thousand-sons/ahriman':{
  name:'Ahriman', faction:'thousand-sons', bsId:'3bfa-bf00-b5ed-cc81',
  stats:[
    { name:'Ahriman', M:'10"', T:'5', Sv:'3+', W:'6', Ld:'6+', OC:'2', InSv:'4+', base:'40mm' }
  ],
  ranged:[
    { name:'Inferno bolt pistol', range:'12"', A:'1', BS:'2+', S:'5', AP:'-2', D:'1', kw:['PISTOL'] },
    { name:'Transmogrifying Blast', range:'18"', A:'D6+1', BS:'2+', S:'6', AP:'-1', D:'D3', kw:['BLAST','PSYCHIC'] }
  ],
  melee:[
    { name:'Black Staff of Ahriman', range:'Melee', A:'5', WS:'2+', S:'7', AP:'-1', D:'3', kw:['PSYCHIC'] }
  ],
  abilities:[
    // Scryer of Fates: Wahapedia's wording ("If …", "three"); New Recruit and BSData print "if …" and "3" (deviations)
    { name:'Scryer of Fates', tag:'Psychic', text:'If your army includes this model, after both players have deployed their armies, you can select up to three **THOUSAND SONS** units from your army and redeploy them. When doing so, you can set those units up in **Strategic Reserves** if you wish, regardless of how many units are already in Strategic Reserves.' },
    { name:'Arch-Sorcerer of Tzeentch', tag:'Psychic', ph:['shooting'], turn:'your', text:'Each time this model attempts a **Ritual**, add 1 to the Psychic test result.' }
  ]
},
'thousand-sons/exalted-sorcerer-on-disc-of-tzeentch':{
  name:'Exalted Sorcerer on Disc of Tzeentch', faction:'thousand-sons', bsId:'1724-8c9c-c385-16c6',
  stats:[
    { name:'Exalted Sorcerer on Disc of Tzeentch', M:'10"', T:'5', Sv:'3+', W:'6', Ld:'6+', OC:'2', InSv:'4+', base:'40mm' }
  ],
  ranged:[
    { name:'Arcane Fire', range:'18"', A:'D6', BS:'–', S:'6', AP:'-2', D:'D3', kw:['IGNORES COVER','PSYCHIC','TORRENT'] },
    { name:'Inferno bolt pistol', range:'12"', A:'1', BS:'2+', S:'5', AP:'-2', D:'1', kw:['PISTOL'] }
  ],
  melee:[
    { name:'Force weapon', range:'Melee', A:'5', WS:'2+', S:'6', AP:'-1', D:'D3', kw:['PSYCHIC'] },
    { name:'Prosperine khopesh', range:'Melee', A:'4', WS:'2+', S:'5', AP:'-2', D:'2', kw:[] }
  ],
  abilities:[
    { name:'Illusions of Tzeentch', tag:'Psychic', def:'only by a ranged attack whose attacking model is within 18"', text:'While this model is leading a unit, that unit can only be selected as the target of a ranged attack if the attacking model is within 18".', defOf:'6d8635b3' },
    { name:'Binding Tendrils', tag:'Psychic', ph:['shooting'], turn:'your', text:'In your Shooting phase, after this model has shot, select one enemy **INFANTRY** unit hit by one or more of those attacks made with Arcane Fire. Until the start of your next turn, that unit is ensnared. While a unit is ensnared, subtract 2" from its Move characteristic and subtract 2 from **Charge rolls** made for it.' }
  ]
},
'thousand-sons/tzaangor-shaman':{
  name:'Tzaangor Shaman', faction:'thousand-sons', bsId:'c251-bd54-441-4799',
  stats:[
    { name:'Tzaangor Shaman', M:'10"', T:'4', Sv:'5+', W:'4', Ld:'7+', OC:'2', InSv:'5+', base:'40mm' }
  ],
  ranged:[
    { name:'Baleful Devolution', range:'18"', A:'D6', BS:'3+', S:'9', AP:'0', D:'1', kw:['BLAST','DEVASTATING WOUNDS','PSYCHIC'] }
  ],
  melee:[
    { name:'Force stave', range:'Melee', A:'3', WS:'3+', S:'5', AP:'-1', D:'D3', kw:['PSYCHIC'] }
  ],
  abilities:[
    { name:'Sacrificial Blessing', ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' }, text:'While this model is leading a unit, in your Shooting phase and the Fight phase, each time that unit is selected to shoot or fight, this model can use this ability. If it does, select one **Bodyguard** model in that unit; that Bodyguard model is destroyed and, until the end of the phase, add D3 to the Attacks and Strength characteristics of Psychic weapons equipped by this model.' },
    { name:'Bestial Prophet', text:'While this model is leading a unit, each time a model in that unit makes an attack, add 1 to the **Hit roll**.' }
  ]
},
'thousand-sons/tzaangor-enlightened':{
  name:'Tzaangor Enlightened', faction:'thousand-sons', bsId:'1703-3edd-5eb3-fcef',
  stats:[
    { name:'Tzaangor Enlightened', M:'10"', T:'4', Sv:'5+', W:'2', Ld:'7+', OC:'2', InSv:'5+', base:'40mm' }
  ],
  melee:[
    { name:'Divining spear', range:'Melee', A:'3', WS:'4+', S:'5', AP:'-1', D:'2', kw:['LANCE','PRECISION'] }
  ],
  abilities:[
    { name:'Prophesied Doom', ph:['charge'], turn:'either', text:'Each time this unit makes a Charge move, select one enemy unit within Engagement Range of it, then roll one D6 for each model in this unit that is within Engagement Range of that enemy unit: for each 4+, that enemy unit suffers 1 **mortal wound**.' }
  ]
},
'tyranids/the-swarmlord':{
  name:'The Swarmlord', faction:'tyranids', bsId:'13f7-1a3-eff-7393', role:'Epic Hero',
  stats:[
    { name:'The Swarmlord', M:'8"', T:'10', Sv:'2+', W:'10', Ld:'7+', OC:'3', InSv:'4+', base:'60mm' }
  ],
  ranged:[
    { name:'Synaptic Pulse', range:'18"', A:'D6+3', BS:'–', S:'5', AP:'-1', D:'2', kw:['PSYCHIC','TORRENT'] }
  ],
  melee:[
    { name:'Bone Sabres', range:'Melee', A:'8', WS:'2+', S:'9', AP:'-2', D:'3', kw:['TWIN-LINKED'] }
  ],
  abilities:[
    { name:'Hive Commander', ph:['command'], turn:'your', text:'At the start of your Command phase, if this model is on the battlefield, you gain 1CP' },
    { name:'Malign Presence', tag:'Aura · Once per turn', ph:['command','movement','shooting','charge','fight'], turn:'either', text:'Once per turn, when your opponent targets a unit from their army within 12" of this model with a **stratagem**, you can use this ability. If you do increase the CP cost of that use of that **stratagem** by 1CP.' },
    { name:'Domination of the Hive Mind', tag:'Aura', text:'While a friendly **TYRANIDS** unit is within 9" of this model, that unit is within your army’s **Synapse Range**.' }
  ],
  rules:['Deadly Demise D3','Shadow in the Warp','Synapse','Leader','Twin-linked','Torrent'],
  kw:['Character','Epic Hero','Faction: Tyranids','Great Devourer','Hive Tyrant','Monster','Psyker','Synapse','The Swarmlord']
},
'tyranids/hive-tyrant':{
  name:'Hive Tyrant', faction:'tyranids', bsId:'3e96-8098-3401-77af', role:'Character',
  stats:[
    { name:'Hive Tyrant', M:'8"', T:'10', Sv:'2+', W:'10', Ld:'7+', OC:'3', InSv:'4+', base:'50mm' }
  ],
  melee:[
    { name:'Monstrous bonesword and lash whip', range:'Melee', A:'6', WS:'2+', S:'9', AP:'-2', D:'3', kw:['TWIN-LINKED'] },
    { name:'Monstrous scything talons', range:'Melee', A:'4', WS:'2+', S:'7', AP:'-2', D:'2', kw:['EXTRA ATTACKS'] }
  ],
  abilities:[
    { name:'Onslaught', tag:'Aura, Psychic', ph:['movement','shooting'], turn:'either', turns:{ shooting:'your' }, text:'While a friendly **TYRANIDS** unit is within 6" of this model, ranged weapons equipped by models in that unit have the **[ASSAULT]** and **[LETHAL HITS]** abilities.' },
    { name:'Will of the Hive Mind', tag:'Once per battle round', ph:['command','movement','shooting','charge','fight'], turn:'either', text:'Once per battle round, one model from your army with this ability can use it when a friendly **TYRANIDS** unit within 12" of that model is targeted with a Stratagem. If it does, reduce the CP cost of that use of that Stratagem by 1CP.' }
  ],
  rules:['Deadly Demise D3','Shadow in the Warp','Synapse','Leader','Twin-linked','Extra Attacks'],
  kw:['Character','Faction: Tyranids','Great Devourer','Hive Tyrant','Monster','Psyker','Synapse']
},
'tyranids/neurogaunts':{
  name:'Neurogaunts', faction:'tyranids', bsId:'8ccc-3f27-7e4e-da81', role:'Infantry',
  stats:[
    { name:'Neurogaunt Nodebeast', M:'6"', T:'3', Sv:'6+', W:'1', Ld:'8+', OC:'1', InSv:'–', base:'28.5mm' },
    { name:'Neurogaunt', M:'6"', T:'3', Sv:'6+', W:'1', Ld:'8+', OC:'1', InSv:'–', base:'25mm' }
  ],
  melee:[
    { name:'Chitinous claws and teeth', range:'Melee', A:'1', WS:'4+', S:'3', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Neurocytes', text:'While this unit is within **Synapse Range** of your friendly **TYRANIDS** unit (excluding **NEUROGAUNT** units), it has the **SYNAPSE** keyword.' }
  ],
  rules:['Synapse'],
  kw:['Endless Multitude','Faction: Tyranids','Great Devourer','Infantry','Neurogaunts']
},
'tyranids/norn-assimilator':{
  name:'Norn Assimilator', faction:'tyranids', bsId:'6a9b-8e2f-edac-fa2d', role:'Monster',
  stats:[
    { name:'Norn Assimilator', M:'10"', T:'11', Sv:'2+', W:'16', Ld:'7+', OC:'5', base:'100mm' }
  ],
  ranged:[
    { name:'Toxinjecter Harpoon', range:'12"', A:'2', BS:'2+', S:'12', AP:'-3', D:'D6+1', kw:['HARPOONED'] }
  ],
  melee:[
    { name:'Monstrous scything talons', range:'Melee', A:'6', WS:'2+', S:'9', AP:'-2', D:'3', kw:[] },
    { name:'Toxinjecter Harpoon', range:'Melee', A:'4', WS:'2+', S:'12', AP:'-3', D:'D6+1', kw:['EXTRA ATTACKS'] }
  ],
  abilities:[
    { name:'Harpoon Barbs', tag:'Once per turn', ph:['movement'], turn:'opp', text:'Once per turn, when an enemy unit within Engagement Range of this unit is chosen to Fall Back, roll one D6; on a 2+, that unit suffers D6 mortal wounds.' },
    { name:'Damaged: 1-5 Wounds Remaining', damaged:'1-5', text:'While this model has 1-5 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' },
    { name:'Singular Purpose', at:'Start of the first battle round', ph:['command','shooting','fight'], turn:'either', note:'With Enraged Behemoths’ “add 2 to the Objective Control characteristic”: 15 or 17. The sources here don’t say whether “an Objective Control characteristic of 15” is applied before or after modifiers.', def:'If its Singular Purpose is an objective marker: Feel No Pain 5+ and OC 15 while within range of it', text:'At the start of the first battle round, select one of the following:\n- Select one enemy unit. Until the end of the battle, each time this model makes an attack that targets that unit you can re-roll the Hit roll and you can re-roll the Wound roll\n- Select one objective marker. Until the end of the battle, while this model is within range of that objective marker, it has the **Feel No Pain 5+** ability and an Objective Control characteristic of 15.', defOf:'f285866f' },
    { name:'Protean Purpose', tag:'Once per battle, per unit', ph:['command'], turn:'your', text:'(Once per battle, per unit) In your Command phase, you can use this ability. If you do, this unit can make a selection for its **Singular Purpose** ability (this replaces the previous selection).' }
  ],
  rules:['Deadly Demise D6','Shadow in the Warp','Synapse','Harpooned','Extra Attacks'],
  kw:['Faction: Tyranids','Great Devourer','Harvester','Monster','Norn Assimilator','Synapse']
},
'tyranids/norn-emissary':{
  name:'Norn Emissary', faction:'tyranids', bsId:'5720-2873-8c2c-edc3', role:'Monster',
  stats:[
    { name:'Norn Emissary', M:'10"', T:'11', Sv:'2+', W:'16', Ld:'7+', OC:'5', InSv:'4+', base:'100mm' }
  ],
  ranged:[
    { name:'neuroparasite', group:'Psychic tendril', range:'18"', A:'2', BS:'2+', S:'8', AP:'-2', D:'D3', kw:['PRECISION','PSYCHIC'] },
    { name:'neurolance', group:'Psychic tendril', range:'18"', A:'2', BS:'2+', S:'12', AP:'-3', D:'D6', kw:['MELTA 2','PSYCHIC'] },
    { name:'neuroblast', group:'Psychic tendril', range:'18"', A:'2D6', BS:'2+', S:'6', AP:'-2', D:'1', kw:['BLAST','PSYCHIC'] }
  ],
  melee:[
    { name:'Monstrous rending claws', range:'Melee', A:'4', WS:'2+', S:'7', AP:'-2', D:'2', kw:['EXTRA ATTACKS'] },
    { name:'Monstrous scything talons', range:'Melee', A:'6', WS:'2+', S:'9', AP:'-2', D:'3', kw:[] }
  ],
  abilities:[
    { name:'Singular Purpose', at:'Start of the first battle round', ph:['command','shooting','fight'], turn:'either', note:'With Enraged Behemoths’ “add 2 to the Objective Control characteristic”: 15 or 17. The sources here don’t say whether “an Objective Control characteristic of 15” is applied before or after modifiers.', def:'If its Singular Purpose is an objective marker: Feel No Pain 5+ and OC 15 while within range of it', text:'At the start of the first battle round, select one of the following:\n- Select one enemy unit. Until the end of the battle, each time this model makes an attack that targets that unit you can re-roll the Hit roll and you can re-roll the Wound roll\n- Select one objective marker. Until the end of the battle, while this model is within range of that objective marker, it has the **Feel No Pain 5+** ability and an Objective Control characteristic of 15.', defOf:'f285866f' },
    { name:'Damaged: 1-5 Wounds Remaining', damaged:'1-5', text:'While this model has 1-5 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' },
    { name:'Protean Purpose', tag:'Once per battle, per unit', ph:['command'], turn:'your', text:'(Once per battle, per unit) In your Command phase, you can use this ability. If you do, this unit can make a selection for its **Singular Purpose** ability (this replaces the previous selection).' },
    { name:'Unnatural Resistance', def:'Feel No Pain 4+ against mortal wounds', text:'This model has the **Feel No Pain 4+** ability against Mortal Wounds.', defOf:'ece97c50' }
  ],
  rules:['Deadly Demise D6','Shadow in the Warp','Synapse','Feel No Pain','Extra Attacks','Melta','Blast','Psychic'],
  kw:['Faction: Tyranids','Great Devourer','Monster','Norn Emissary','Psyker','Synapse']
},
'tyranids/tyrannofex':{
  name:'Tyrannofex', faction:'tyranids', bsId:'1705-379b-330d-36d4', role:'Monster',
  stats:[
    { name:'Tyrannofex', M:'9"', T:'12', Sv:'2+', W:'16', Ld:'8+', OC:'5', InSv:'–', base:'120×92mm' }
  ],
  ranged:[
    { name:'Stinger salvoes', range:'24"', A:'8', BS:'3+', S:'5', AP:'0', D:'1', kw:[] },
    { name:'Acid spray', range:'18"', A:'D6+6', BS:'–', S:'6', AP:'-2', D:'2', kw:['TORRENT'] }
  ],
  melee:[
    { name:'Powerful limbs', range:'Melee', A:'4', WS:'3+', S:'8', AP:'0', D:'2', kw:[] }
  ],
  abilities:[
    { name:'Resilient Organism', tag:'Once per battle', def:'Once per battle: change the Damage of an attack allocated to it to 0', text:'Once per battle, when an attack is allocated to this model, you can change the Damage characteristic of that attack to 0.', defOf:'2d7e2fc0' },
    { name:'Damaged: 1-5 Wounds Remaining', damaged:'1-5', text:'While this model has 1-5 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' }
  ],
  rules:['Deadly Demise D6','Synapse','Torrent'],
  kw:['Faction: Tyranids','Great Devourer','Monster','Tyrannofex'],
  // the keywords as BSData and New Recruit have them; Wahapedia's Tyrannofex page lists FRAME too, from its errata line
  // "Hierophant, Toxicrene, Tyrannocyte and Tyrannofex. Add the FRAME keyword.", which GW's Tyranids Faction Pack (14-10, the
  // newest on GW's downloads on 22 Oct 2026) does not print
  srcNote:{ at:'kw', note:'Wahapedia also lists FRAME (from its errata); GW’s Faction Pack (14-10) and BSData don’t' }
},
'imperial-knights/knight-destrier':{
  name:'Knight Destrier', faction:'imperial-knights', bsId:'10d8-d702-f556-5d3c', role:'Character',
  stats:[
    { name:'Knight Destrier', M:'12"', T:'10', Sv:'3+', W:'18', Ld:'6+', OC:'8', InSv:'5+*', base:'150×95mm' }
  ],
  ranged:[
    { name:'Questoris heavy stubber', range:'36"', A:'6', BS:'3+', S:'4', AP:'-1', D:'1', kw:['ASSAULT','RAPID FIRE 3'] },
    { name:'Chastiser gatling cannon', range:'24"', A:'12', BS:'3+', S:'6', AP:'-1', D:'2', kw:['ASSAULT'] },
    { name:'Frag bombard', range:'24"', A:'D6+3', BS:'3+', S:'7', AP:'-1', D:'2', kw:['ASSAULT','BLAST','RAPID FIRE D6+3'] }
  ],
  melee:[
    { name:'Titanic feet', range:'Melee', A:'4', WS:'4+', S:'7', AP:'-1', D:'2', kw:[] }
  ],
  abilities:[
    { name:'Damaged: 1-6 Wounds Remaining', damaged:'1-6', text:'While this model has 1-6 wounds remaining, subtract 4 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the **Hit roll**.' },
    { name:'Thundercharge', text:'If this model is equipped with a thundershock spear and a bellatus reaper chainsword, add 2 to the Attacks characteristic of melee weapons equipped by this model.' },
    { name:'Ram Jets', ph:['movement'], turn:'your', text:'Each time this unit is selected to make a **Normal** or **Advance move**, until the end of the phase, add D3" to the Move characteristic of this model.' },
    { name:'Saturation Fire', ph:['shooting'], turn:'your', text:'Each time this model makes a ranged attack that targets a unit within range of one or more objective markers, that attack has the **[IGNORES COVER]** ability.' },
    { name:'Invulnerable Save (5+*)', def:'5+ invulnerable save against ranged attacks only', text:'This model has a 5+ invulnerable save against ranged attacks.', defOf:'08e20e06' }
  ],
  rules:['Deadly Demise D6','Super-Heavy Walker','Code Chivalric','Assault','Rapid Fire','Blast'],
  kw:['Bellatus','Character','Faction: Imperial Knights','Imperium','Knight Destrier','Titanic','Towering','Vehicle','Walker']
},
'imperial-knights/knight-errant':{
  name:'Knight Errant', faction:'imperial-knights', bsId:'9efd-ec72-353f-4b23', role:'Character',
  stats:[
    { name:'Knight Errant', M:'10"', T:'11', Sv:'3+', W:'26', Ld:'6+', OC:'10', InSv:'5+*', base:'170×109mm' }
  ],
  ranged:[
    { name:'Thermal cannon', range:'24"', A:'2D3', BS:'3+', S:'12', AP:'-4', D:'D6', kw:['BLAST','MELTA 6'] },
    { name:'Stormspear rocket pod', range:'48"', A:'3', BS:'3+', S:'8', AP:'-2', D:'D6', kw:[] },
    { name:'Meltagun', range:'12"', A:'1', BS:'3+', S:'9', AP:'-4', D:'D6', kw:['MELTA 2'] }
  ],
  melee:[
    { name:'strike', group:'Reaper chainsword', range:'Melee', A:'4', WS:'3+', S:'14', AP:'-4', D:'6', kw:[] },
    { name:'sweep', group:'Reaper chainsword', range:'Melee', A:'12', WS:'3+', S:'9', AP:'-3', D:'2', kw:[] }
  ],
  abilities:[
    { name:'Aggressive Assault', ph:['shooting'], turn:'your', text:'Each time this model makes a ranged attack that targets the closest eligible target, add 1 to the **Hit roll**.' },
    { name:'Invulnerable Save (5+*)', def:'5+ invulnerable save against ranged attacks only', text:'This model has a 5+ invulnerable save against ranged attacks.', defOf:'08e20e06' },
    { name:'Damaged: 1-9 Wounds Remaining', damaged:'1-9', text:'While this model has 1‑9 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the **Hit roll**.' },
    { name:'Errant’s Duty', tag:'Bondsman', text:'While a model is affected by this ability, you can re-roll **Advance rolls** made for that model and ranged weapons equipped by that model have the **[ASSAULT]** ability.' }
  ],
  // New Recruit's Rules line also has Assault, named only by Errant’s Duty, which affects an ARMIGER model (deviations-nr.json)
  rules:['Deadly Demise D6','Super-Heavy Walker','Code Chivalric','Bondsman','Melta','Blast'],
  kw:['Character','Faction: Imperial Knights','Imperium','Knight Errant','Questoris','Titanic','Towering','Vehicle','Walker']
},
'imperial-knights/knight-paladin':{
  name:'Knight Paladin', faction:'imperial-knights', bsId:'8441-8356-5e7c-69ee', role:'Character',
  stats:[
    { name:'Knight Paladin', M:'10"', T:'11', Sv:'3+', W:'26', Ld:'6+', OC:'10', InSv:'5+*', base:'170×109mm' }
  ],
  ranged:[
    { name:'Questoris heavy stubber', range:'36"', A:'3', BS:'3+', S:'4', AP:'-1', D:'1', kw:['RAPID FIRE 3'] },
    { name:'Rapid-fire battle cannon', range:'72"', A:'D6+3', BS:'3+', S:'10', AP:'-1', D:'3', kw:['BLAST','RAPID FIRE D6+3'] },
    { name:'Stormspear rocket pod', range:'48"', A:'3', BS:'3+', S:'8', AP:'-2', D:'D6', kw:[] },
    { name:'Meltagun', range:'12"', A:'1', BS:'3+', S:'9', AP:'-4', D:'D6', kw:['MELTA 2'] }
  ],
  melee:[
    { name:'strike', group:'Reaper chainsword', range:'Melee', A:'4', WS:'3+', S:'14', AP:'-4', D:'6', kw:[] },
    { name:'sweep', group:'Reaper chainsword', range:'Melee', A:'12', WS:'3+', S:'9', AP:'-3', D:'2', kw:[] }
  ],
  abilities:[
    { name:'Seasoned Noble', ph:['shooting'], turn:'your', text:'Each time this model makes a ranged attack that targets the closest eligible target, improve the Armour Penetration characteristic of that attack by 1.' },
    { name:'Invulnerable Save (5+*)', def:'5+ invulnerable save against ranged attacks only', text:'This model has a 5+ invulnerable save against ranged attacks.', defOf:'08e20e06' },
    { name:'Damaged: 1-9 Wounds Remaining', damaged:'1-9', text:'While this model has 1‑9 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the **Hit roll**.' },
    { name:'Paladin’s Duty', tag:'Bondsman', text:'While a model is affected by this ability, weapons equipped by that model have the **[LETHAL HITS]** ability, and melee weapons equipped by that model have the **[LANCE]** ability.' }
  ],
  // New Recruit's Rules line also has Lethal Hits and Lance, named only by Paladin’s Duty, which affects an ARMIGER model (deviations-nr.json)
  rules:['Deadly Demise D6','Super-Heavy Walker','Code Chivalric','Bondsman','Rapid Fire','Blast','Melta'],
  kw:['Character','Faction: Imperial Knights','Imperium','Knight Paladin','Questoris','Titanic','Towering','Vehicle','Walker']
},
'imperial-knights/knight-warden':{
  name:'Knight Warden', faction:'imperial-knights', bsId:'c609-c87e-f9dd-5006', role:'Character',
  stats:[
    { name:'Knight Warden', M:'10"', T:'11', Sv:'3+', W:'26', Ld:'6+', OC:'10', InSv:'5+*', base:'170×109mm' }
  ],
  ranged:[
    { name:'Avenger gatling cannon', range:'36"', A:'18', BS:'3+', S:'6', AP:'-2', D:'2', kw:[] },
    { name:'Heavy flamer', range:'12"', A:'D6', BS:'–', S:'5', AP:'-1', D:'1', kw:['IGNORES COVER','TORRENT'] },
    { name:'Stormspear rocket pod', range:'48"', A:'3', BS:'3+', S:'8', AP:'-2', D:'D6', kw:[] },
    { name:'Meltagun', range:'12"', A:'1', BS:'3+', S:'9', AP:'-4', D:'D6', kw:['MELTA 2'] }
  ],
  melee:[
    { name:'strike', group:'Reaper chainsword', range:'Melee', A:'4', WS:'3+', S:'14', AP:'-4', D:'6', kw:[] },
    { name:'sweep', group:'Reaper chainsword', range:'Melee', A:'12', WS:'3+', S:'9', AP:'-3', D:'2', kw:[] }
  ],
  abilities:[
    { name:'Thin Their Ranks', ph:['shooting'], turn:'your', text:'Each time this model makes a ranged attack that targets an enemy unit (excluding **MONSTERS** and **VEHICLES**), that attack has the **[DEVASTATING WOUNDS]** ability.' },
    { name:'Invulnerable Save (5+*)', def:'5+ invulnerable save against ranged attacks only', text:'This model has a 5+ invulnerable save against ranged attacks.', defOf:'08e20e06' },
    { name:'Damaged: 1-9 Wounds Remaining', damaged:'1-9', text:'While this model has 1‑9 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the **Hit roll**.' },
    { name:'Warden’s Duty', tag:'Bondsman', text:'While a model is affected by this ability, weapons equipped by that model have the **[SUSTAINED HITS 1]** ability, and ranged weapons equipped by that model have the **[IGNORES COVER]** ability.' }
  ],
  // New Recruit's Rules line also has Sustained Hits, named only by Warden’s Duty, which affects an ARMIGER model (deviations-nr.json)
  rules:['Deadly Demise D6','Super-Heavy Walker','Code Chivalric','Devastating Wounds','Bondsman','Ignores Cover','Torrent','Melta'],
  kw:['Character','Faction: Imperial Knights','Imperium','Knight Warden','Questoris','Titanic','Towering','Vehicle','Walker']
},
'imperial-knights/canis-rex':{
  name:'Canis Rex', faction:'imperial-knights', bsId:'55fb-9c91-1a4f-3037', role:'Epic Hero',
  stats:[
    { name:'Canis Rex', M:'10"', T:'11', Sv:'3+', W:'26', Ld:'6+', OC:'10', InSv:'5+*', base:'170×109mm' },
    { name:'Sir Hekhtur', M:'6"', T:'3', Sv:'4+', W:'3', Ld:'5+', OC:'1', InSv:'–', base:'25mm' }
  ],
  ranged:[
    { name:'high intensity', group:'Las-impulsor', range:'24"', A:'D6', BS:'2+', S:'14', AP:'-3', D:'4', kw:['BLAST','SUSTAINED HITS 1'] },
    { name:'low intensity', group:'Las-impulsor', range:'36"', A:'2D6', BS:'2+', S:'7', AP:'-1', D:'2', kw:['BLAST','SUSTAINED HITS 1'] },
    { name:'Questoris multi-laser', range:'36"', A:'4', BS:'2+', S:'6', AP:'0', D:'1', kw:['SUSTAINED HITS 1'] },
    { name:'Hekhtur’s pistol', range:'12"', A:'1', BS:'2+', S:'5', AP:'-1', D:'2', kw:['PISTOL'] }
  ],
  melee:[
    { name:'strike', group:'Freedom’s Hand', range:'Melee', A:'5', WS:'2+', S:'20', AP:'-3', D:'9', kw:['SUSTAINED HITS 1'] },
    { name:'sweep', group:'Freedom’s Hand', range:'Melee', A:'10', WS:'2+', S:'10', AP:'-2', D:'3', kw:['SUSTAINED HITS 1'] },
    { name:'Close combat weapon', range:'Melee', A:'2', WS:'2+', S:'3', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Chainbreaker', tag:'Once per battle', ph:['command','movement','shooting','charge','fight'], turn:'either', text:'Once per battle, at the start of any phase, you can select one friendly **IMPERIUM** unit that is **Battle-shocked** and within 12" of this model. That unit is no longer Battle-shocked.' },
    { name:'Legendary Freeblade', tag:'Once per turn', ph:['command','movement','shooting','charge','fight'], turn:'either', text:'Once per turn, when you target this model with a stratagem, you may reduce the CP cost of that use of that stratagem by 1CP.' },
    { name:'Invulnerable Save (5+*)', def:'5+ invulnerable save against ranged attacks only', text:'This model has a 5+ invulnerable save against ranged attacks.', defOf:'08e20e06' },
    { name:'Damaged: 1-9 Wounds Remaining', damaged:'1-9', text:'While this model has 1‑9 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the **Hit roll**.' },
    // embarked: the Damage tab reads Sir Hekhtur as not on the battlefield while Canis Rex lives (a model disembarking from a destroyed
    // Transport: 18.05 sets it up then), so his weapons start unticked (counted by you) and Canis Rex is the target alone
    { name:'Using Sir Hekhtur', embarked:{ model:'Sir Hekhtur', until:'Canis Rex' }, text:'If your Canis Rex model is destroyed, this model is treated as a model disembarking from a destroyed Transport and must perform an Emergency Disembarkation. Sir Hekhtur cannot be selected as the target of any of your Stratagems other than Core Stratagems. Your Canis Rex unit is not considered to be destroyed until Sir Hekhtur is also destroyed.' }
  ],
  rules:['Deadly Demise D6','Sustained Hits','Super-Heavy Walker','Blast','Code Chivalric','Lone Operative'],
  kw:['Canis Rex','Character','Epic Hero','Faction: Imperial Knights','Imperium','Infantry','Questoris','Sir Hekhtur','Titanic','Towering','Vehicle','Walker'],
  // BSData has Lone Operative on the Sir Hekhtur model only, not on Canis Rex (24.24.01: an attached unit benefits only if
  // all its models have it). Sir Hekhtur's base: GW's Base Size Guide (Event Companion, Oct 2026) "Sir Hekhtur 25mm";
  // BSData, and so New Recruit, give him Canis Rex's 170×109mm (deviations-nr.json, deviations-bsdata.json)
  partialRules:{ 'Lone Operative':'Sir Hekhtur' },
  // Wahapedia's 11th-edition Canis Rex is "1 Canis Rex – EPIC HERO" (415 pts), Sir Hekhtur its own EPIC HERO datasheet; BSData
  // and New Recruit have him in this unit (his base: as New Recruit prints it, the owner's rule)
  srcNote:{ at:'Sir Hekhtur', note:'Wahapedia: his own EPIC HERO datasheet; BSData and New Recruit: in this unit' },
  // BSData's categories on each model (the unit has the others)
  kwOnly:{ 'Canis Rex':'Canis Rex', Questoris:'Canis Rex', Titanic:'Canis Rex', Towering:'Canis Rex', Vehicle:'Canis Rex', Walker:'Canis Rex', Infantry:'Sir Hekhtur', 'Sir Hekhtur':'Sir Hekhtur' }
},
'imperial-knights/cerastus-knight-atrapos':{
  name:'Cerastus Knight Atrapos', faction:'imperial-knights', bsId:'37a7-d156-1e4c-8fe1', role:'Character',
  stats:[
    { name:'Cerastus Knight Atrapos', M:'12"', T:'11', Sv:'3+', W:'28', Ld:'6+', OC:'10', InSv:'5+', base:'170×109mm' }
  ],
  ranged:[
    { name:'high intensity', group:'Atrapos lascutter', range:'24"', A:'D6', BS:'3+', S:'14', AP:'-3', D:'4', kw:['SUSTAINED HITS 1'] },
    { name:'low intensity', group:'Atrapos lascutter', range:'36"', A:'2D6', BS:'3+', S:'7', AP:'-1', D:'2', kw:['SUSTAINED HITS 1'] },
    { name:'singularity', group:'Graviton singularity cannon', range:'24"', A:'D3', BS:'3+', S:'16', AP:'-4', D:'D6+1', kw:['BLAST','DEVASTATING WOUNDS','HAZARDOUS'] },
    { name:'contained', group:'Graviton singularity cannon', range:'24"', A:'D3', BS:'3+', S:'16', AP:'-4', D:'D6+1', kw:['BLAST'] }
  ],
  melee:[
    { name:'high intensity', group:'Atrapos lascutter', range:'Melee', WS:'3+', S:'14', AP:'-3', D:'4', kw:['SUSTAINED HITS 1'] },
    { name:'low intensity', group:'Atrapos lascutter', range:'Melee', WS:'3+', S:'7', AP:'-1', D:'2', kw:['SUSTAINED HITS 1'] }
  ],
  abilities:[
    { name:'Macro-extinction Protocols', text:'Each time this model makes an attack that targets a MONSTER or VEHICLE unit, add 1 to the Hit roll. If that target is TITANIC or TOWERING, add 1 to the Wound roll as well.' },
    { name:'Damaged: 1-10 Wounds Remaining', damaged:'1-10', text:'While this model has 1-10 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the Hit roll.' },
    { name:'Atrapos’ Duty', tag:'Bondsman', text:'While a model is affected by this ability, each time that model makes an attack that targets a TITANIC or TOWERING model, you can re-roll the Hit roll and you can re-roll the Wound roll.' }
  ],
  rules:['Code Chivalric','Deadly Demise D6+2','Super-Heavy Walker','Bondsman','Sustained Hits','Blast','Devastating Wounds','Hazardous'],
  kw:['Cerastus','Character','Faction: Imperial Knights','Imperium','Knight Atrapos','Titanic','Towering','Vehicle','Walker']
},
'imperial-knights/cerastus-knight-lancer':{
  name:'Cerastus Knight Lancer', faction:'imperial-knights', bsId:'9ee-e289-bc6c-d943', role:'Character',
  stats:[
    { name:'Cerastus Knight Lancer', M:'14"', T:'11', Sv:'3+', W:'28', Ld:'6+', OC:'10', InSv:'4+', base:'170×109mm' }
  ],
  ranged:[
    { name:'Cerastus shock lance', range:'12"', A:'6', BS:'3+', S:'6', AP:'0', D:'2', kw:['ASSAULT','SUSTAINED HITS 2'] }
  ],
  melee:[
    { name:'strike', group:'Cerastus shock lance', range:'Melee', A:'5', WS:'2+', S:'20', AP:'-3', D:'8', kw:['LANCE'] },
    { name:'sweep', group:'Cerastus shock lance', range:'Melee', A:'10', WS:'2+', S:'10', AP:'-2', D:'3', kw:[] }
  ],
  abilities:[
    { name:'Shock Charge', text:'You can target this model with the Tank Shock Stratagem for 0CP, and can do so even if you have already targeted a different unit with that Stratagem this phase.' },
    { name:'Damaged: 1-10 Wounds Remaining', damaged:'1-10', text:'While this model has 1-10 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the Hit roll.' },
    { name:'Lancer’s Duty', tag:'Bondsman', text:'While a model is affected by this ability, it is eligible to declare a charge in a turn in which it Advanced.' }
  ],
  rules:['Deadly Demise D6+2','Code Chivalric','Super-Heavy Walker','Bondsman','Sustained Hits','Assault','Lance'],
  kw:['Cerastus','Character','Faction: Imperial Knights','Imperium','Knight Lancer','Titanic','Towering','Vehicle','Walker']
},
'imperial-knights/knight-crusader':{
  name:'Knight Crusader', faction:'imperial-knights', bsId:'1e27-a6de-3840-a050', role:'Character',
  stats:[
    { name:'Knight Crusader', M:'10"', T:'11', Sv:'3+', W:'26', Ld:'6+', OC:'10', InSv:'5+*', base:'170×109mm' }
  ],
  ranged:[
    { name:'Avenger gatling cannon', range:'36"', A:'18', BS:'3+', S:'6', AP:'-2', D:'2' },
    { name:'Heavy flamer', range:'12"', A:'D6', BS:'–', S:'5', AP:'-1', D:'1' },
    { name:'Stormspear rocket pod', range:'48"', A:'3', BS:'3+', S:'8', AP:'-2', D:'D6' },
    { name:'Meltagun', range:'12"', A:'1', BS:'3+', S:'9', AP:'-4', D:'D6' },
    { name:'Questoris heavy stubber', range:'36"', A:'3', BS:'3+', S:'4', AP:'-1', D:'1' },
    { name:'Rapid-fire battle cannon', range:'72"', A:'D6+3', BS:'3+', S:'10', AP:'-1', D:'3' }
  ],
  melee:[
    { name:'Titanic feet', range:'Melee', A:'4', WS:'4+', S:'8', AP:'-1', D:'2', kw:[] }
  ],
  abilities:[
    { name:'Punishing Salvoes', ph:['movement','shooting'], turn:'your', text:'In your Movement phase, if this model Remains Stationary, until the end of the turn, ranged weapons equipped by this model have the [SUSTAINED HITS 1] ability.' },
    { name:'Invulnerable Save (5+*)', def:'5+ invulnerable save against ranged attacks only', text:'This model has a 5+ invulnerable save against ranged attacks.', defOf:'08e20e06' },
    { name:'Damaged: 1-9 Wounds Remaining', damaged:'1-9', text:'While this model has 1‑9 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the **Hit roll**.' },
    { name:'Crusader’s Duty', tag:'Bondsman', text:'While a model is affected by this ability, each time that model makes a ranged attack, add 1 to the Hit roll.' }
  ],
  rules:['Deadly Demise D6','Super-Heavy Walker','Code Chivalric','Sustained Hits','Bondsman','Torrent','Melta','Rapid Fire','Blast'],
  kw:['Character','Faction: Imperial Knights','Imperium','Knight Crusader','Questoris','Titanic','Towering','Vehicle','Walker']
},
'adeptus-mechanicus/belisarius-cawl':{
  name:'Belisarius Cawl', faction:'adeptus-mechanicus', bsId:'1f1e-2989-4762-cf88', role:'Epic Hero',
  stats:[
    { name:'Belisarius Cawl', M:'8"', T:'8', Sv:'2+', W:'10', Ld:'6+', OC:'3', InSv:'4+', base:'105×70mm' }
  ],
  ranged:[
    { name:'Solar atomiser', range:'18"', A:'3', BS:'2+', S:'14', AP:'-4', D:'D6', kw:['MELTA 3'] }
  ],
  melee:[
    { name:'Arc Scourge', range:'Melee', A:'4', WS:'2+', S:'5', AP:'-1', D:'1', kw:['ANTI-VEHICLE 4+','DEVASTATING WOUNDS','EXTRA ATTACKS'] },
    { name:'Cawl’s Omnissian axe', range:'Melee', A:'4', WS:'2+', S:'8', AP:'-2', D:'2', kw:[] },
    { name:'Mechadendrite hive', range:'Melee', A:'2D6', WS:'3+', S:'4', AP:'0', D:'1', kw:['EXTRA ATTACKS'] }
  ],
  abilities:[
    // New Recruit prints the ability and the Canticles of the Omnissiah section as one text. The words are the Rules
    // Updates' in GW's Faction Pack v1.4 (PDF p17: Canticles, Invocation of Machine Vengeance, Mantra of Discipline,
    // Shroudpsalm), with Wahapedia's markup and layout; New Recruit's "(Aura)" after Invocation of Machine Vengeance and
    // its quote mark after "add 1 to that test." are not in them (deviations-nr.json, deviations-bsdata.json)
    { name:'Canticles of the Omnissiah', ph:['command'], turn:'your', text:'At the start of your Command phase, select one of the abilities in the Canticles of the Omnissiah section. Until the start of your next Command phase, this model has that ability.\n**Invocation of Machine Vengeance:** At the start of your Command phase, select one unit from your opponent’s army. Until the start of your next Command phase, that enemy unit is your Machine Vengeance target. Each time a model in a friendly **ADEPTUS MECHANICUS** unit makes an attack that targets your Machine Vengeance target, you can re-roll the **Hit roll**.\n**Mantra of Discipline:** This model has the **BATTLELINE** keyword and has the following ability:\n- **Binharic Courage (Aura):** While a friendly **ADEPTUS MECHANICUS** unit is within 6" of this model, add 1 to the Objective Control characteristic of models in that unit and each time you take a Battle-shock or **Leadership test** for that unit, add 1 to that test.\n**Shroudpsalm (Aura):** While a friendly **ADEPTUS MECHANICUS** unit is within 6" of this model, that unit has the **Stealth** ability.' },
    { name:'Mechanicus Bodyguard', def:'Lone Operative while within 3" of another friendly ADEPTUS MECHANICUS unit', text:'While this model is within 3" of one or more other friendly **ADEPTUS MECHANICUS** units, this model has the **Lone Operative** ability.', defOf:'a15f3d7e' },
    { name:'Self-repair Mechanisms', ph:['command'], turn:'your', text:'At the start of your Command phase, this model regains up to D3 lost wounds.' },
    { name:'Supreme Commander', note:'Wahapedia core rules, 25.04 Fill Your Army Roster: “Some units have a rule on their datasheet stating that they must be your WARLORD. If you want to include one or more of these units in your army, you must select one of them to be your WARLORD.”', text:'If this model is in your army, it must be your Warlord.' }
  ],
  // no Blast: none of his weapons has [BLAST] (the Solar atomiser is [MELTA 3]); BSData still links a Blast rule to it, and
  // New Recruit prints it (deviations-nr.json, deviations-bsdata.json)
  rules:['Doctrina Imperatives','Anti','Devastating Wounds','Extra Attacks','Melta'],
  kw:['Belisarius Cawl','Character','Cult Mechanicus','Epic Hero','Faction: Adeptus Mechanicus','Imperium','Mobile','Monster','Tech-Priest']
},
'adeptus-mechanicus/thulia-ghuld':{
  name:'Thulia Ghuld', faction:'adeptus-mechanicus', bsId:'7135-8430-eb02-ded4', role:'Epic Hero',
  stats:[
    { name:'Thulia Ghuld', M:'8"', T:'8', Sv:'2+', W:'10', Ld:'6+', OC:'3', InSv:'4+', base:'80mm' }
  ],
  ranged:[
    { name:'shockwave', group:'Jericho-class conversion resonator', range:'24"', A:'D6+2', BS:'2+', S:'6', AP:'-2', D:'1', kw:['BLAST','SUSTAINED HITS 1'] },
    { name:'titanic impact', group:'Jericho-class conversion resonator', range:'24"', A:'2', BS:'2+', S:'12', AP:'-3', D:'D6+2', kw:['DEVASTATING WOUNDS'] }
  ],
  melee:[
    { name:'strike', group:'Rod of the War Forge', range:'Melee', A:'6', WS:'2+', S:'10', AP:'-2', D:'3', kw:[] },
    { name:'sweep', group:'Rod of the War Forge', range:'Melee', A:'12', WS:'2+', S:'6', AP:'-1', D:'1', kw:[] }
  ],
  abilities:[
    // the three abilities Rod of the War Forge selects from: shooting and declaring a charge after an Advance or a
    // Fall Back (your Shooting and Charge phases), and both Imperatives (attacks in either player's Fight phase too)
    { name:'Icon of War', ph:['command','movement','shooting','charge','fight'], turn:'either', turns:{ command:'your', movement:'opp', charge:'your' }, note:'FAQ (Faction Pack 1.4): “When I select one of Thulia Ghuld’s Icon of War abilities, when do I select the unit that ability affects?” “When you have selected the Icon of War ability you want to use.”', text:'**Fanatical Devotion:** You can select one friendly **SKITARII** or **THULIA GHULD** unit within 6" of this model; until the start of your next Command phase, that unit is eligible to shoot and declare a charge in a turn in which it Advanced.\n**Adaptive Tactics:** You can select one friendly **SKITARII** or **THULIA GHULD** unit within 6" of this model; until the start of your next Command phase, that unit is eligible to shoot and declare a charge in a turn in which it Fell Back.\n**The Fires of Mars:** You can select one friendly **SKITARII** or **THULIA GHULD** unit within 6" of this model; until the start of your next Command phase, the Conqueror Imperative and Protector Imperative are both active for that unit.' },
    { name:'Mechanicus Bodyguard', def:'Lone Operative while within 3" of another friendly ADEPTUS MECHANICUS unit', text:'While this model is within 3" of one or more other friendly **ADEPTUS MECHANICUS** units, this model has the **Lone Operative** ability.', defOf:'a15f3d7e' },
    { name:'Secutor of Olympus', ph:['shooting'], turn:'your', text:'At the start of your Shooting phase, select one enemy **VEHICLE** unit within 12" of this model and roll one D6: on a 2+, that enemy unit suffers D3+1 **mortal wounds**.' },
    { name:'Supreme Commander', note:'Wahapedia core rules, 25.04 Fill Your Army Roster: “Some units have a rule on their datasheet stating that they must be your WARLORD. If you want to include one or more of these units in your army, you must select one of them to be your WARLORD.”', text:'If this model is in your army, it must be your Warlord.' },
    // New Recruit's words; GW's Faction Pack and Wahapedia add "(see next page)" after "section", pointing at the
    // pack's next page, where Icon of War is printed (here it is the first ability above) (deviations-texts.json)
    { name:'Rod of the War Forge', ph:['command'], turn:'your', text:'In your Command phase, select one of the abilities in the Icon of War section. Until the start of your next Command phase, this model has that ability.' }
  ],
  rules:['Doctrina Imperatives','Blast','Sustained Hits','Devastating Wounds'],
  kw:['Character','Cult Mechanicus','Epic Hero','Faction: Adeptus Mechanicus','Imperium','Mobile','Monster','Tech-Priest','Thulia Ghuld']
},
'adeptus-mechanicus/tech-priest-enginseer':{
  name:'Tech-Priest Enginseer', faction:'adeptus-mechanicus', bsId:'c0e0-4d86-96d2-ec86', role:'Character',
  stats:[
    { name:'Tech-Priest Enginseer', M:'6"', T:'4', Sv:'3+', W:'3', Ld:'7+', OC:'1', InSv:'5+', base:'32mm' }
  ],
  ranged:[
    { name:'Mechanicus pistol', range:'12"', A:'1', BS:'3+', S:'6', AP:'-1', D:'1', kw:['DEVASTATING WOUNDS','PISTOL'] }
  ],
  melee:[
    { name:'Omnissian axe', range:'Melee', A:'3', WS:'4+', S:'6', AP:'-2', D:'2', kw:[] },
    { name:'Servo arm', range:'Melee', A:'1', WS:'4+', S:'6', AP:'-2', D:'2', kw:['EXTRA ATTACKS'] }
  ],
  abilities:[
    { name:'Enginseer', def:'Lone Operative while within 3" of a friendly ADEPTUS MECHANICUS VEHICLE unit, unless it is leading a unit', text:'While this model is within 3" of one or more friendly **ADEPTUS MECHANICUS VEHICLE** units, unless it is leading a unit, this model has the **Lone Operative** ability.', defOf:'c1523ba6' },
    // Wahapedia's datasheet wording; New Recruit (BSData) has no full stop at the end (deviations-nr.json)
    { name:'Omnissiah’s Blessing', ph:['command'], turn:'your', text:'In your Command phase, select one friendly **ADEPTUS MECHANICUS** model within 3" of this model. That model regains up to D3 lost wounds and, if it is a **VEHICLE** model, until the start of your next Command phase, that model has the **Feel No Pain 5+** ability. Each model can only be selected for this ability once per Command phase.' },
    { name:'Vengeance for the Omnissiah', text:'If a friendly **ADEPTUS MECHANICUS VEHICLE** model is destroyed within 12" of this model, until the end of the battle, this model’s Omnissian axe has an Attacks characteristic of 6.' }
  ],
  rules:['Leader','Doctrina Imperatives','Devastating Wounds','Pistol','Extra Attacks'],
  kw:['Character','Cult Mechanicus','Enginseer','Faction: Adeptus Mechanicus','Imperium','Infantry','Tech-Priest']
},
'adeptus-mechanicus/cybernetica-datasmith':{
  name:'Cybernetica Datasmith', faction:'adeptus-mechanicus', bsId:'d59d-ef1-9ef8-4f44',
  stats:[
    { name:'Cybernetica Datasmith', T:'4', Sv:'2+', W:'3', Ld:'7+', OC:'1', InSv:'5+', base:'32mm' }
  ],
  ranged:[
    { name:'Mechanicus pistol', range:'12"', A:'1', BS:'3+', S:'6', AP:'-1', D:'1', kw:['DEVASTATING WOUNDS','PISTOL'] }
  ],
  melee:[
    { name:'Power fist', range:'Melee', A:'2', WS:'3+', S:'8', AP:'-2', D:'2', kw:[] }
  ],
  abilities:[
    { name:'Battle Protocols', ph:['command'], turn:'your', def:'Aegis Protocol: KASTELAN ROBOT models +1 Toughness (from the start of the battle until another protocol is selected)', text:'At the start of the battle, if this model is leading a **KASTELAN ROBOTS** unit, that unit enters Aegis Protocols (see below). In your Command phase, if this model is leading a **KASTELAN ROBOTS** unit, you can select one protocol from those listed below for that unit to enter. Once a unit enters a protocol, it remains in that protocol until it enters a different one.\n- **Protector Protocol:** Add 2 to the Attacks characteristic of ranged weapons equipped by **KASTELAN ROBOT** models in that unit.\n- **Conqueror Protocol:** Add 2 to the Attacks characteristic of melee weapons equipped by **KASTELAN ROBOT** models in that unit.\n- **Aegis Protocol:** Add 1 to the Toughness characteristic of **KASTELAN ROBOT** models in that unit.', defOf:'3aa72642' },
    // Wahapedia's markup and bullets (BSData and GW's Faction Pack, PDF p17, print the two bullets too)
    { name:'Data-severed', text:'If there are no **KASTELAN ROBOT** models in this unit:\n- This unit loses **VEHICLE**.\n- This unit has **INFANTRY**.' }
  ]
},
'adeptus-mechanicus/kastelan-robots':{
  name:'Kastelan Robots', faction:'adeptus-mechanicus', bsId:'bd6c-8683-8bc4-962d',
  stats:[
    { name:'Kastelan Robot', T:'9', Sv:'2+', W:'7', Ld:'7+', OC:'2', InSv:'5+', base:'60mm' }
  ],
  ranged:[
    { name:'Incendine combustor', range:'12"', A:'D6', BS:'–', S:'6', AP:'-1', D:'1', kw:['IGNORES COVER','TORRENT'] }
  ],
  melee:[
    { name:'Twin Kastelan fist', range:'Melee', A:'4', WS:'4+', S:'12', AP:'-2', D:'3', kw:['TWIN-LINKED'] }
  ],
  abilities:[
    { name:'Robotic Bodyguard', def:'Cybernetica Datasmith only: Feel No Pain 4+ while leading this unit', text:'While a **CYBERNETICA DATASMITH** model is leading this unit, that model has the **Feel No Pain** 4+ ability.', defOf:'128a9dc3' },
    // GW's Faction Pack v1.4 Rules Update wording (PDF p17), with Wahapedia's markup
    { name:'Repulsor Grid', def:'Ranged attacks: each unmodified 6 on its save rolls, 1 mortal wound to the attacking unit after it has shot', text:'When an enemy unit targets this unit with ranged attacks, until that enemy unit has shot, when this unit makes a **save roll**:\n- On an unmodified 6, that enemy unit suffers 1 **mortal wound** after that enemy unit has shot.', defOf:'a9d06bd4' }
  ]
},
'adeptus-mechanicus/skitarii-rangers':{
  name:'Skitarii Rangers', faction:'adeptus-mechanicus', bsId:'de59-f65c-181a-8509', role:'Battleline',
  stats:[
    // New Recruit prints "Skitarii Rangers (x2)"; the unit's 10 models all have this profile (BSData ×10) (deviations-nr.json)
    { name:'Skitarii Rangers', M:'6"', T:'3', Sv:'4+', W:'1', Ld:'7+', OC:'2', InSv:'5+', base:'25mm' }
  ],
  ranged:[
    { name:'Galvanic rifle', range:'30"', A:'2', BS:'4+', S:'4', AP:'0', D:'1' },
    { name:'Arc rifle', range:'30"', A:'1', BS:'4+', S:'8', AP:'-1', D:'D3' },
    { name:'supercharge', group:'Plasma caliver', range:'30"', A:'2', BS:'4+', S:'8', AP:'-3', D:'2' },
    { name:'standard', group:'Plasma caliver', range:'30"', A:'2', BS:'4+', S:'7', AP:'-2', D:'1' },
    { name:'Transuranic arquebus', range:'36"', A:'1', BS:'4+', S:'7', AP:'-2', D:'D3' }
  ],
  melee:[
    { name:'Alpha combat weapon', range:'Melee', A:'2', WS:'4+', S:'5', AP:'-1', D:'1', kw:[] },
    { name:'Close combat weapon', range:'Melee', A:'1', WS:'4+', S:'3', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    // Wahapedia's datasheet wording (11th edition: "Level of Control", as in Core Rules 14.02); New Recruit (BSData) still
    // prints the codex wording "…even if you have no models within range of it, until your opponent controls it at the
    // start or end of any turn." (deviations-nr.json, deviations-bsdata.json)
    { name:'Objective Scouted', ph:['command'], turn:'your', text:'At the end of your Command phase, if this unit is within range of an objective marker you control, that objective marker remains under your control until your opponent’s Level of Control over that objective marker is greater than yours at the end of a phase.' },
    // already in the weapons' keywords (their IGNORES COVER is marked as from the Omnispex)
    { name:'Omnispex', text:'Ranged weapons equipped by models in the bearer’s unit have the **IGNORES COVER** ability.' }
  ],
  rules:['Scouts 6"','Doctrina Imperatives','Rapid Fire','Anti','Devastating Wounds','Hazardous','Heavy','Precision'],
  kw:['Battleline','Faction: Adeptus Mechanicus','Imperium','Infantry','Rangers','Skitarii']
},
'adeptus-mechanicus/ironstrider-ballistarii':{
  name:'Ironstrider Ballistarii', faction:'adeptus-mechanicus', bsId:'7efb-de37-79c4-cccb', role:'Vehicle',
  stats:[
    { name:'Ironstrider Ballistarii', M:'10"', T:'7', Sv:'3+', W:'7', Ld:'7+', OC:'2', InSv:'5+', base:'105×70mm' }
  ],
  ranged:[
    { name:'Twin cognis lascannon', range:'48"', A:'2', BS:'4+', S:'12', AP:'-3', D:'D6+1', kw:['SUSTAINED HITS 1','TWIN-LINKED'] },
    { name:'Twin cognis autocannon', range:'48"', A:'4', BS:'4+', S:'9', AP:'-1', D:'3', kw:['SUSTAINED HITS 1','TWIN-LINKED'] }
  ],
  melee:[
    { name:'Ironstrider feet', range:'Melee', A:'3', WS:'4+', S:'5', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Elevated Strider', ph:['movement','shooting'], turn:'your', text:'This unit is eligible to shoot in a turn in which it Fell Back or Advanced, and you can re-roll Desperate Escape tests taken for models in this unit.' },
    { name:'Broad Spectrum Data-tether', text:'Each time you select this unit as the target of a Stratagem, roll one D6: on a 5+, you gain 1CP.' }
  ],
  rules:['Deadly Demise 1','Doctrina Imperatives','Sustained Hits'],
  kw:['Faction: Adeptus Mechanicus','Imperium','Ironstrider Ballistarii','Skitarii','Smoke','Vehicle','Walker']
},
'adeptus-mechanicus/onager-dunecrawler':{
  name:'Onager Dunecrawler', faction:'adeptus-mechanicus', bsId:'ea05-4db7-9ee6-7a87', role:'Vehicle',
  stats:[
    { name:'Onager Dunecrawler', M:'8"', T:'10', Sv:'2+', W:'11', Ld:'7+', OC:'3', InSv:'4+', base:'130mm' }
  ],
  ranged:[
    { name:'Cognis heavy stubber', range:'36"', A:'3', BS:'4+', S:'4', AP:'0', D:'1', kw:['RAPID FIRE 3','SUSTAINED HITS 1'] },
    { name:'Twin Onager heavy phosphor blaster', range:'36"', A:'12', BS:'4+', S:'6', AP:'-1', D:'2', kw:['IGNORES COVER','TWIN-LINKED'] }
  ],
  melee:[
    { name:'Dunecrawler legs', range:'Melee', A:'3', WS:'4+', S:'6', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Emanatus Forcefield', tag:'Aura', text:'While a friendly **ADEPTUS MECHANICUS BATTLELINE** model is wholly within 6" of this model, that **BATTLELINE** model has a 4+ invulnerable save against ranged attacks.' },
    // "mdel" in New Recruit and BSData; Wahapedia's datasheet has "model" (deviations-nr.json, deviations-bsdata.json)
    { name:'Damaged: 1-4 wounds remaining', damaged:'1-4', text:'While this model has 1-4 wounds remaining, each time this model makes an attack, subtract 1 from the **Hit roll**.' },
    { name:'Scuttling Walker', ph:['movement'], turn:'your', text:'Each time this model makes a **Normal**, **Advance** or **Fall Back move**, it can move through friendly **MONSTER** and **VEHICLE** models and sections of **terrain features** that are 4" or less in height.' },
    { name:'Broad spectrum data-tether', text:'The bearer loses the **SMOKE** keyword, but each time you target the bearer with a **Stratagem**, roll one D6: on a 5+, you gain 1CP.' }
  ],
  rules:['Deadly Demise D3','Doctrina Imperatives','Rapid Fire','Sustained Hits','Ignores Cover','Twin-linked'],
  kw:['Faction: Adeptus Mechanicus','Imperium','Onager Dunecrawler','Skitarii','Vehicle','Walker']
},
'adeptus-mechanicus/skorpius-disintegrator':{
  name:'Skorpius Disintegrator', faction:'adeptus-mechanicus', bsId:'3fcc-b6a1-399b-1a29', role:'Vehicle',
  stats:[
    { name:'Skorpius Disintegrator', M:'10"', T:'10', Sv:'2+', W:'12', Ld:'7+', OC:'3', InSv:'–', base:'Hull' }
  ],
  ranged:[
    { name:'Cognis heavy stubber', range:'36"', A:'3', BS:'4+', S:'4', AP:'0', D:'1', kw:['RAPID FIRE 3','SUSTAINED HITS 1'] },
    { name:'Disruptor missile launcher', range:'36"', A:'3', BS:'4+', S:'9', AP:'-2', D:'D6', kw:['TWIN-LINKED'] },
    { name:'Ferrumite cannon', range:'48"', A:'3', BS:'4+', S:'12', AP:'-3', D:'D6+1', kw:[] }
  ],
  melee:[
    { name:'Armoured hull', range:'Melee', A:'3', WS:'4+', S:'6', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Broad spectrum data-tether', text:'Each time you select the bearer as the target of a Stratagem, roll one D6: on a 5+, you gain 1CP.' },
    { name:'Blistering Salvoes', text:'Each time this model makes an attack with a belleros energy cannon that targets an **INFANTRY** unit, add 1 to the **Hit roll**. Each time this model makes an attack with a ferrumite cannon that targets a **MONSTER** or **VEHICLE** unit, add 1 to the Hit roll.' },
    { name:'Damaged: 1-4 wounds remaining', damaged:'1-4', text:'While this model has 1-4 wounds remaining, each time this model makes an attack, subtract 1 from the **Hit roll**.' }
  ],
  rules:['Deadly Demise D3','Doctrina Imperatives','Rapid Fire','Sustained Hits','Twin-linked'],
  kw:['Faction: Adeptus Mechanicus','Frame','Imperium','Skitarii','Skorpius Disintegrator','Smoke','Vehicle']
},
'emperors-children/lucius-the-eternal':{
  name:'Lucius the Eternal', faction:'emperors-children', bsId:'e390-b58b-db9-816',
  stats:[
    { name:'Lucius the Eternal', M:'8"', T:'6', Sv:'2+', W:'6', Ld:'6+', OC:'1', InSv:'4+', base:'50mm' }
  ],
  melee:[
    { name:'Blade of the Laer', range:'Melee', A:'6', WS:'2+', S:'8', AP:'-3', D:'3', kw:['PRECISION'] },
    { name:'Lash of Torment', range:'Melee', A:'10', WS:'2+', S:'4', AP:'-1', D:'1', kw:['SUSTAINED HITS 1'] }
  ],
  abilities:[
    { name:'Duellist’s Hubris', ph:['fight'], turn:'either', text:'At the start of the Fight phase, if this model is not leading a unit, until the end of the phase, it has the Fights First ability.' },
    { name:'A Challenge Worthy of Skill', text:'Each time this model makes an attack that targets a **CHARACTER**, **MONSTER** or **WALKER** unit, you can re-roll the **Hit roll** and re-roll the **Wound roll**.' }
  ]
},
'emperors-children/flawless-blades':{
  name:'Flawless Blades', faction:'emperors-children', bsId:'183e-f3bb-3ce6-7b55',
  stats:[
    { name:'Flawless Blades', M:'8"', T:'5', Sv:'3+', W:'3', Ld:'6+', OC:'1', InSv:'5+', base:'40mm' }
  ],
  ranged:[
    { name:'Bolt pistol', range:'12"', A:'1', BS:'3+', S:'5', AP:'-1', D:'1', kw:['PISTOL'] }
  ],
  melee:[
    { name:'Blissblade', range:'Melee', A:'4', WS:'2+', S:'6', AP:'-3', D:'2', kw:[] }
  ],
  abilities:[
    { name:'Daemonic Patrons', ph:['fight'], turn:'either', text:'Each time this unit is selected to fight, it can call upon daemonic patrons. If it does, until the end of the phase, each time a model in this unit makes an attack. an unmodified **Wound roll** of 3+ scores a Critical Wound. At the end of the Fight phase, if this unit called upon daemonic patrons this phase and no enemy models were destroyed by attacks made by models in this unit this phase, one model in this unit is destroyed.' }
  ]
},
'emperors-children/daemon-prince-of-slaanesh-with-wings':{
  name:'Daemon Prince of Slaanesh with Wings', faction:'emperors-children', bsId:'e452-08be-33e6-3864', role:'Character',
  stats:[
    { name:'Daemon Prince of Slaanesh with Wings', M:'14"', T:'9', Sv:'2+', W:'10', Ld:'6+', OC:'3', InSv:'4+', base:'60mm' }
  ],
  ranged:[
    { name:'Infernal cannon', range:'24"', A:'3', BS:'2+', S:'5', AP:'-1', D:'2', kw:[] }
  ],
  melee:[
    { name:'strike', group:'Hellforged weapons', range:'Melee', A:'6', WS:'2+', S:'8', AP:'-2', D:'3', kw:[] },
    { name:'sweep', group:'Hellforged weapons', range:'Melee', A:'14', WS:'2+', S:'6', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Daemonic Destruction', ph:['charge'], turn:'either', text:'Each time this model ends a Charge move, select one enemy unit within Engagement Range of this model and roll one D6 for each of this model’s remaining wounds: for each 4+, that enemy unit suffers 1 mortal wound (to a maximum of 6 mortal wounds).' },
    { name:'Stimulated by Pain', def:'-1 D to each attack allocated to this model', text:'Each time an attack is allocated to this model, subtract 1 from the Damage characteristic of that attack.', defOf:'b9b595b9' }
  ],
  rules:['Deadly Demise D3','Thrill Seekers','Deep Strike'],
  kw:['Chaos','Character','Daemon','Daemon Prince with Wings','Faction: Emperor\'s Children','Fly','Monster','Slaanesh']
},
'emperors-children/lord-exultant':{
  name:'Lord Exultant', faction:'emperors-children', bsId:'7b4c-dfe0-6a0a-304a',
  stats:[
    { name:'Lord Exultant', M:'7"', T:'5', Sv:'3+', W:'5', Ld:'6+', OC:'1', InSv:'4+', base:'40mm' }
  ],
  ranged:[
    { name:'Bolt pistol', range:'12"', A:'1', BS:'2+', S:'5', AP:'-1', D:'1' }
  ],
  melee:[
    { name:'Close combat weapon', range:'Melee', A:'6', WS:'2+', S:'5', AP:'0', D:'1' },
    { name:'Phoenix power spear', range:'Melee', A:'5', WS:'2+', S:'7', AP:'-2', D:'2' },
    { name:'Rapture lash', range:'Melee', A:'4', WS:'2+', S:'4', AP:'-1', D:'1' }
  ],
  abilities:[
    { name:'Perfectionists', text:'While this model is leading a unit, weapons equipped by models in that unit have the [LETHAL HITS] ability.' },
    { name:'Euphoric Strikes', tag:'Once per battle', ph:['fight'], turn:'either', text:'Once per battle, at the start of the Fight phase, this model can use this ability. If it does so, until the end of the phase, add 3 to the Attacks characteristic of melee weapons equipped by this model and improve the Armour Penetration characteristic of those weapons by 1.' },
    { name:'Lord of the Host', text:'If this model is attached to an Emperor’s Children Battleline unit during the Declare Battle Formations step, this model has the Infiltrators and Scouts 6" ability.' }
  ]
},
'emperors-children/infractors':{
  name:'Infractors', faction:'emperors-children', bsId:'e456-0afc-9b42-226c',
  stats:[
    { name:'Infractors', M:'7"', T:'5', Sv:'3+', W:'2', Ld:'6+', OC:'2', InSv:'–', base:'32mm' }
  ],
  ranged:[
    { name:'standard', group:'Plasma pistol', range:'12"', A:'1', BS:'3+', S:'7', AP:'-2', D:'1' },
    { name:'supercharge', group:'Plasma pistol', range:'12"', A:'1', BS:'3+', S:'8', AP:'-3', D:'2' },
    { name:'Bolt pistol', range:'12"', A:'1', BS:'3+', S:'5', AP:'-1', D:'1' }
  ],
  melee:[
    { name:'Power sword', range:'Melee', A:'4', WS:'3+', S:'5', AP:'-2', D:'1' },
    { name:'Duelling sabre', range:'Melee', A:'4', WS:'3+', S:'5', AP:'-1', D:'1' }
  ],
  abilities:[
    { name:'Excessive Assault', text:'Each time a model in this unit targets an enemy unit with a melee attack, re-roll a Wound roll of 1. If that enemy unit is within range of an objective marker, you can re-roll the Wound roll instead.' },
    { name:'Icon of Excess', ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' }, text:'At the end of your Shooting phase or the Fight phase, if the bearer’s unit destroyed one or more enemy units this phase, the bearer’s unit takes a Leadership test. If that test is passed, you gain 1CP.' }
  ]
},
'emperors-children/tormentors':{
  name:'Tormentors', faction:'emperors-children', bsId:'4494-dd7d-69f7-306c', role:'Battleline',
  stats:[
    { name:'Tormentors', M:'7"', T:'5', Sv:'3+', W:'2', Ld:'6+', OC:'2', InSv:'–', base:'32mm' }
  ],
  ranged:[
    { name:'standard', group:'Plasma pistol', range:'12"', A:'1', BS:'3+', S:'7', AP:'-2', D:'1', kw:['PISTOL','PRECISION'] },
    { name:'supercharge', group:'Plasma pistol', range:'12"', A:'1', BS:'3+', S:'8', AP:'-3', D:'2', kw:['HAZARDOUS','PISTOL','PRECISION'] },
    { name:'Boltgun', range:'24"', A:'2', BS:'3+', S:'5', AP:'-1', D:'1', kw:['PRECISION'] },
    { name:'Meltagun', range:'12"', A:'1', BS:'3+', S:'9', AP:'-4', D:'D6', kw:['MELTA 2','PRECISION'] }
  ],
  melee:[
    { name:'Power sword', range:'Melee', A:'4', WS:'3+', S:'5', AP:'-2', D:'1', kw:[] },
    { name:'Close combat weapon', range:'Melee', A:'3', WS:'3+', S:'5', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Objective Defiled', ph:['command'], turn:'your', text:'At the end of your Command phase, if this unit is within range of an objective marker you control, that objective marker remains under your control until your opponent’s Level of Control over that objective marker is greater than yours at the end of a phase.' },
    { name:'Icon of Excess', ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' }, text:'At the end of your Shooting phase or the Fight phase, if the bearer’s unit destroyed one or more enemy units this phase, the bearer’s unit takes a Leadership test. If that test is passed, you gain 1CP.' }
  ],
  rules:['Infiltrators','Thrill Seekers','Hazardous','Pistol','Precision','Melta'],
  kw:['Battleline','Chaos','Faction: Emperor\'s Children','Grenades','Infantry','Slaanesh','Tormentors']
},
'emperors-children/chaos-rhino':{
  name:'Chaos Rhino', faction:'emperors-children', bsId:'8ae1-aa47-e1d1-1b31', role:'Dedicated Transport',
  stats:[
    { name:'Chaos Rhino', M:'12"', T:'9', Sv:'3+', W:'10', Ld:'6+', OC:'2', InSv:'–', base:'Hull' }
  ],
  ranged:[
    { name:'Combi-bolter', range:'24"', A:'2', BS:'3+', S:'5', AP:'-1', D:'1', kw:['RAPID FIRE 2'] },
    { name:'Havoc launcher', range:'48"', A:'D6', BS:'3+', S:'5', AP:'0', D:'1', kw:['BLAST'] }
  ],
  melee:[
    { name:'Armoured tracks', range:'Melee', A:'3', WS:'4+', S:'6', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Assault Vehicle', text:'Units can disembark from this Vehicle after it has Advanced. Units that do so count as having made a Normal move that phase, and cannot declare a charge in the same turn, but can otherwise act normally.' },
    { name:'Transport', tag:'Capacity', text:'This model has a transport capacity of 12 Emperor’s Children Infantrymodels (excluding Terminator and Flawless Blade models).' }
  ],
  rules:['Deadly Demise D3','Thrill Seekers','Firing Deck 2','Rapid Fire','Blast'],
  kw:['Chaos','Dedicated Transport','Faction: Emperor\'s Children','Frame','Rhino','Slaanesh','Smoke','Transport','Vehicle']
},
'emperors-children/defiler':{
  name:'Defiler', faction:'emperors-children', bsId:'b541-3292-a5cc-dbeb', role:'Vehicle',
  stats:[
    { name:'Defiler', M:'12"', T:'11', Sv:'3+', W:'18', Ld:'6+', OC:'5', InSv:'5+', base:'160mm' }
  ],
  ranged:[
    { name:'Ectoplasma destructor', range:'36"', A:'D6', BS:'3+', S:'12', AP:'-3', D:'3', kw:['BLAST'] },
    { name:'Excruciator cannon', range:'36"', A:'6', BS:'3+', S:'6', AP:'-1', D:'2', kw:[] },
    { name:'Heavy reaper autocannon', range:'48"', A:'4', BS:'3+', S:'9', AP:'-1', D:'3', kw:['DEVASTATING WOUNDS','SUSTAINED HITS 1'] }
  ],
  melee:[
    { name:'strike', group:'Shearing claws', range:'Melee', A:'5', WS:'3+', S:'16', AP:'-3', D:'D6+1', kw:['PRECISION'] },
    { name:'sweep', group:'Shearing claws', range:'Melee', A:'10', WS:'3+', S:'6', AP:'-2', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Scuttling Walker', ph:['movement','shooting'], turn:'your', text:'Each time this unit makes a **Normal**, **Advance** or **Fall Back move**, it can move through models (excluding **TITANIC** models) and **terrain features**. When doing so, it can move within **Engagement Range** of enemy models, but cannot end that move within Engagement Range of them, and any Desperate Escape test is automatically passed.' },
    { name:'Revel in Desecration', text:'Each time this model makes an attack that targets an enemy unit that is not below Half-strength, add 1 to the Hit roll.' },
    { name:'Damaged: 1-6 wounds remaining', damaged:'1-6', text:'While this model has 1-6 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' }
  ],
  rules:['Deadly Demise D6','Thrill Seekers','Blast','Sustained Hits','Devastating Wounds','Precision'],
  kw:['Chaos','Daemon','Defiler','Faction: Emperor\'s Children','Slaanesh','Vehicle','Walker']
},
'emperors-children/maulerfiend':{
  name:'Maulerfiend', faction:'emperors-children', bsId:'656c-8b78-8e59-0591', role:'Vehicle',
  stats:[
    { name:'Maulerfiend', M:'10"', T:'10', Sv:'3+', W:'12', Ld:'6+', OC:'3', InSv:'5+', base:'120×92mm' }
  ],
  ranged:[
    { name:'Magma cutter', range:'6"', A:'2', BS:'3+', S:'9', AP:'-4', D:'D6', kw:['MELTA 2'] }
  ],
  melee:[
    { name:'Maulerfiend fists', range:'Melee', A:'6', WS:'3+', S:'14', AP:'-2', D:'D6+1', kw:[] }
  ],
  abilities:[
    { name:'Glutton for Punishment', text:'Each time this model makes an attack, if it is below its Starting Strength, add 1 to the **Hit roll**. If this model is also **Below Half-strength**, add 1 to the **Wound roll** as well.' },
    { name:'Damaged: 1-4 wounds remaining', damaged:'1-4', text:'While this model has 1-4 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' }
  ],
  rules:['Deadly Demise D3','Thrill Seekers'],
  kw:['Chaos','Daemon','Faction: Emperor\'s Children','Maulerfiend','Slaanesh','Vehicle','Walker']
},
'chaos-knights/chaos-cerastus-knight-atrapos':{
  name:'Chaos Cerastus Knight Atrapos', faction:'chaos-knights', bsId:'8b1d-9029-f9e1-42d9', role:'Character',
  stats:[
    { name:'Chaos Cerastus Knight Atrapos', M:'12"', T:'11', Sv:'3+', W:'28', Ld:'6+', OC:'10', InSv:'5+', base:'170×109mm' }
  ],
  ranged:[
    { name:'low intensity', group:'Atrapos lascutter', range:'36"', A:'2D6', BS:'3+', S:'7', AP:'-1', D:'2', kw:['SUSTAINED HITS 1'] },
    { name:'high intensity', group:'Atrapos lascutter', range:'24"', A:'D6', BS:'3+', S:'14', AP:'-3', D:'4', kw:['SUSTAINED HITS 1'] },
    { name:'contained', group:'Graviton singularity cannon', range:'24"', A:'D3', BS:'3+', S:'16', AP:'-4', D:'D6+1', kw:['BLAST'] },
    { name:'singularity', group:'Graviton singularity cannon', range:'24"', A:'D3', BS:'3+', S:'16', AP:'-4', D:'D6+1', kw:['BLAST','DEVASTATING WOUNDS','HAZARDOUS'] }
  ],
  melee:[
    { name:'low intensity', group:'Atrapos lascutter', range:'Melee', A:'12', S:'7', AP:'-1', D:'2', kw:['SUSTAINED HITS 1'] },
    { name:'high intensity', group:'Atrapos lascutter', range:'Melee', A:'6', S:'14', AP:'-3', D:'4', kw:['SUSTAINED HITS 1'] }
  ],
  abilities:[
    { name:'Macro-extinction Protocols', text:'Each time this model makes an attack that targets a **MONSTER** or **VEHICLE** unit, add 1 to the **Hit roll**. If that target is **TITANIC** or **TOWERING**, add 1 to the **Wound roll** as well.' },
    { name:'Consumed with Hunger', tag:'Aura', text:'While a friendly **WAR DOG** model is within 6" of this model, each time that **WAR DOG** model makes an attack that targets a **TITANIC** or **TOWERING** unit, you can re-roll the **Hit roll**.' },
    { name:'Damaged: 1-10 wounds remaining', damaged:'1-10', text:'While this model has 1-10 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the **Hit roll**.' }
  ],
  rules:['Deadly Demise D6+2','Harbingers of Dread','Super-Heavy Walker','Sustained Hits','Blast','Devastating Wounds','Hazardous'],
  kw:['Cerastus','Chaos','Character','Faction: Chaos Knights','Knight Atrapos','Titanic','Towering','Vehicle','Walker']
},
'chaos-knights/chaos-cerastus-knight-lancer':{
  name:'Chaos Cerastus Knight Lancer', faction:'chaos-knights', bsId:'4175-82c6-8e96-bef8', role:'Character',
  stats:[
    { name:'Chaos Cerastus Knight Lancer', M:'14"', T:'11', Sv:'3+', Ld:'6+', OC:'10', InSv:'4+', base:'170×109mm' }
  ],
  ranged:[
    { name:'Cerastus shock lance', range:'12"', A:'6', BS:'3+', S:'6', AP:'0', D:'2', kw:['ASSAULT','SUSTAINED HITS 2'] }
  ],
  melee:[
    { name:'strike', group:'Cerastus shock lance', range:'Melee', A:'5', WS:'2+', S:'20', AP:'-3', D:'8', kw:['LANCE'] },
    { name:'sweep', group:'Cerastus shock lance', range:'Melee', A:'10', WS:'2+', S:'10', AP:'-2', D:'3', kw:[] }
  ],
  abilities:[
    { name:'Shock Charge', text:'You can target this model with the Tank Shock Stratagem for 0CP, and can do so even if you have already targeted a different unit with that Stratagem this phase.' },
    { name:'Dark Fervour', tag:'Aura', text:'While a friendly **WAR DOG** model is within 6" of this model, ranged weapons equipped by that War Dog model have the **[ASSAULT]** ability.' },
    { name:'Damaged: 1-10 wounds remaining', damaged:'1-10', text:'While this model has 1-10 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the **Hit roll**.' }
  ],
  rules:['Deadly Demise D6+2','Harbingers of Dread','Super-Heavy Walker','Sustained Hits','Assault','Lance'],
  kw:['Cerastus','Chaos','Character','Faction: Chaos Knights','Knight Lancer','Titanic','Towering','Vehicle','Walker']
},
'chaos-knights/knight-despoiler':{
  name:'Knight Despoiler', faction:'chaos-knights', bsId:'0119-8c04-435e-c782', role:'Character',
  stats:[
    { name:'Knight Despoiler', M:'10"', T:'11', Sv:'3+', W:'26', Ld:'6+', OC:'10', InSv:'5+*', base:'170×109mm' }
  ],
  ranged:[
    { name:'Ruinspear rocket pod', range:'48"', A:'3', BS:'3+', S:'8', AP:'-2', D:'D6' },
    { name:'Despoiler gatling cannon', range:'36"', A:'18', BS:'3+', S:'6', AP:'-2', D:'2' },
    { name:'Heavy darkflamer', range:'12"', A:'D6', BS:'–', S:'5', AP:'-1', D:'1' },
    { name:'Diabolus heavy stubber', range:'36"', A:'3', BS:'3+', S:'5', AP:'0', D:'1' }
  ],
  melee:[
    { name:'Titanic feet', range:'Melee', A:'4', WS:'4+', S:'8', AP:'-1', D:'2', kw:[] }
  ],
  abilities:[
    { name:'Dread Dominion', tag:'Aura', text:'While a friendly **WAR DOG** model is within 9" of this model, improve that **WAR DOG** model’s Leadership and Objective Control characteristics by 1.' },
    { name:'Seething Hatred', ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' }, text:'Each time this model is selected to shoot or fight, you can re-roll one **Hit roll** or you can re-roll one **Wound roll** when resolving those attacks.' },
    { name:'Damaged: 1-9 wounds remaining', damaged:'1-9', text:'While this model has 1-9 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the **Hit roll**.' },
    { name:'*Invulnerable Save', def:'5+ invulnerable save against ranged attacks only', text:'This model has a 5+ invulnerable save against ranged attacks.', defOf:'08e20e06' }
  ],
  rules:['Super-Heavy Walker','Deadly Demise D6','Harbingers of Dread','Torrent','Ignores Cover','Rapid Fire'],
  kw:['Abhorrent','Chaos','Character','Faction: Chaos Knights','Knight Despoiler','Titanic','Towering','Vehicle','Walker']
},
'chaos-knights/knight-ruinator':{
  name:'Knight Ruinator', faction:'chaos-knights', bsId:'c0a2-eb65-6d34-5bc6', role:'Character',
  stats:[
    { name:'Knight Ruinator', M:'10"', Sv:'3+', W:'26', Ld:'6+', OC:'10', InSv:'5+*', base:'170×109mm', T:'11' }
  ],
  ranged:[
    { name:'Darkflame lance', range:'18"', A:'D6+6', BS:'–', S:'8', AP:'-1', D:'2', kw:['IGNORES COVER','TORRENT'] },
    { name:'Terrorpulse missiles', range:'36"', A:'D6+6', BS:'3+', S:'8', AP:'-2', D:'2', kw:['BLAST'] }
  ],
  melee:[
    { name:'strike', group:'Fellbore', range:'Melee', A:'4', WS:'3+', S:'14', AP:'-3', D:'6', kw:['ANTI-MONSTER 2+','ANTI-VEHICLE 2+'] },
    { name:'sweep', group:'Fellbore', range:'Melee', A:'10', WS:'3+', S:'9', AP:'-2', D:'2', kw:[] }
  ],
  abilities:[
    { name:'Methodical Destruction', at:'Start of the first battle round', ph:['command','shooting','fight'], turn:'either', turns:{ shooting:'your' }, text:'At the start of the first battle round, select one unit from your opponent’s army to be this model’s victim. Each time this model makes an attack that targets its victim, you can re-roll the **Wound roll**. Each time this model’s victim is destroyed, select one new enemy unit to be this model’s victim.' },
    { name:'Close-range Killers', tag:'Aura', text:'While a friendly War Dog model is within 9" of this model, each time that War Dog model makes an attack that targets the closest enemy unit, improve the Armour Penetration characteristic of that attack by 1.' },
    { name:'Damaged: 1-9 wounds remaining', damaged:'1-9', text:'While this model has 1-9 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the **Hit roll**.' },
    { name:'*Invulnerable Save', def:'5+ invulnerable save against ranged attacks only', text:'This model has a 5+ invulnerable save against ranged attacks.', defOf:'08e20e06' }
  ],
  rules:['Super-Heavy Walker','Deadly Demise D6','Harbingers of Dread','Ignores Cover','Torrent','Sustained Hits','Blast'],
  kw:['Abhorrent','Chaos','Character','Faction: Chaos Knights','Knight Ruinator','Titanic','Towering','Vehicle','Walker']
},
'chaos-knights/nurglings':{
  name:'Nurglings', faction:'chaos-knights', bsId:'e403-3a9-279e-41b7', role:'Allies: Legiones Daemonica',
  stats:[
    { name:'Nurglings', M:'5"', T:'3', Sv:'7+', W:'4', Ld:'8+', OC:'0', InSv:'5+', base:'40mm' }
  ],
  melee:[
    { name:'Diseased claws and teeth', range:'Melee', A:'4', WS:'5+', S:'2', AP:'0', D:'1', kw:['LETHAL HITS'] }
  ],
  abilities:[
    { name:'Mischief Makers', tag:'Aura', ph:['fight'], turn:'either', def:'Fight phase: an enemy unit (excluding TITANIC units) within Engagement Range of it, selected to fight: -1 to hit with each melee attack until the end of the phase', text:'Each time an enemy unit (excluding **TITANIC** units) within **Engagement Range** of one or more units with this ability is selected to fight, until the end of the phase, each time a model in that enemy unit makes a melee attack, subtract 1 from the **Hit roll**.', defOf:'b35db159' }
  ],
  rules:['Deep Strike','Infiltrators','Lethal Hits'],
  kw:['Allies: Legiones Daemonica','Battleline','Chaos','Daemon','Faction: Legiones Daemonica','Nurgle','Nurglings','Swarm']
},
'chaos-knights/war-dog-brigand':{
  name:'War Dog Brigand', faction:'chaos-knights', bsId:'753d-4e02-eda3-4809',
  stats:[
    { name:'War Dog Brigand', M:'12"', T:'9', Sv:'3+', W:'14', Ld:'7+', OC:'6', InSv:'5+*', base:'100mm' }
  ],
  ranged:[
    { name:'Avenger chaincannon', range:'24"', A:'12', BS:'3+', S:'6', AP:'-1', D:'1', kw:[] },
    { name:'Daemonbreath spear', range:'18"', A:'2', BS:'3+', S:'12', AP:'-4', D:'D6', kw:['MELTA 4'] },
    { name:'Diabolus heavy stubber', range:'36"', A:'3', BS:'3+', S:'5', AP:'0', D:'1', kw:['RAPID FIRE 3'] }
  ],
  melee:[
    { name:'Armoured feet', range:'Melee', A:'4', WS:'3+', S:'6', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Brigand', text:'Ranged weapons equipped by this model have the [Ignores Cover] ability while targeting enemy units in range of one or more objective markers.' },
    { name:'Damaged: 1-5 wounds remaining', damaged:'1-5', text:'While this model has 1-5 wounds remaining, subtract 3 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the **Hit roll**.' },
    { name:'*Invulnerable Save', def:'5+ invulnerable save against ranged attacks only', text:'This model has a 5+ invulnerable save against ranged attacks.', defOf:'08e20e06' }
  ],
  rules:['Deadly Demise D3','Harbingers of Dread','Melta','Rapid Fire'],
  kw:['Brigand','Chaos','Faction: Chaos Knights','Vehicle','Walker','War Dog']
},
'chaos-knights/war-dog-executioner':{
  name:'War Dog Executioner', faction:'chaos-knights', bsId:'8df0-fc3c-8ced-ffce',
  stats:[
    { name:'War Dog Executioner', M:'12"', T:'9', Sv:'3+', W:'14', Ld:'7+', OC:'6', InSv:'5+*', base:'100mm' }
  ],
  ranged:[
    { name:'War Dog autocannon', range:'48"', A:'4', BS:'3+', S:'9', AP:'-1', D:'3' },
    { name:'Diabolus heavy stubber', range:'36"', A:'3', BS:'3+', S:'5', AP:'0', D:'1' }
  ],
  melee:[
    { name:'Armoured feet', range:'Melee', A:'4', WS:'3+', S:'6', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Executioner', text:'Each time this model makes an attack that targets a unit **Below Half-strength**, add 1 to the **Hit roll**. Each time an enemy unit is destroyed as the result of this model’s attacks, before removing the last model in that unit from the battlefield, each other unit from your opponent’s army that is within 3" of it must take a **Battle-shock test**.' },
    { name:'Damaged: 1-5 wounds remaining', damaged:'1-5', text:'While this model has 1-5 wounds remaining, subtract 3 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the **Hit roll**.' },
    { name:'*Invulnerable Save', def:'5+ invulnerable save against ranged attacks only', text:'This model has a 5+ invulnerable save against ranged attacks.', defOf:'08e20e06' }
  ],
  rules:['Deadly Demise D3','Harbingers of Dread','Rapid Fire'],
  kw:['Chaos','Executioner','Faction: Chaos Knights','Vehicle','Walker','War Dog']
},
'chaos-knights/war-dog-karnivore':{
  name:'War Dog Karnivore', faction:'chaos-knights', bsId:'e96b-ac98-7fd2-a155',
  stats:[
    { name:'War Dog Karnivore', M:'14"', T:'9', Sv:'3+', W:'14', Ld:'7+', OC:'6', InSv:'5+*', base:'100mm' }
  ],
  ranged:[
    { name:'Diabolus heavy stubber', range:'36"', A:'3', BS:'3+', S:'5', AP:'0', D:'1', kw:['RAPID FIRE 3'] }
  ],
  melee:[
    { name:'Reaper chaintalon', range:'Melee', A:'12', WS:'3+', S:'8', AP:'-2', D:'1', kw:['SUSTAINED HITS 1'] },
    { name:'Slaughterclaw', range:'Melee', A:'6', WS:'3+', S:'12', AP:'-3', D:'D6+2', kw:['SUSTAINED HITS 1'] }
  ],
  abilities:[
    { name:'Karnivore', text:'You can re-roll **Advance** and **Charge rolls** made for this model.' },
    { name:'Damaged: 1-5 wounds remaining', damaged:'1-5', text:'While this model has 1-5 wounds remaining, subtract 3 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the **Hit roll**.' },
    { name:'*Invulnerable Save', def:'5+ invulnerable save against ranged attacks only', text:'This model has a 5+ invulnerable save against ranged attacks.', defOf:'08e20e06' }
  ],
  rules:['Deadly Demise D3','Harbingers of Dread','Sustained Hits','Rapid Fire'],
  kw:['Chaos','Faction: Chaos Knights','Karnivore','Vehicle','Walker','War Dog']
},
'adeptus-custodes/trajann-valoris':{
  name:'Trajann Valoris', faction:'adeptus-custodes', bsId:'7d7c-c212-47a3-38e4',
  stats:[
    { name:'Trajann Valoris', M:'8"', T:'7', Sv:'2+', W:'10', Ld:'5+', InSv:'4+', base:'40mm' }
  ],
  ranged:[
    { name:'Eagle’s Scream', range:'24"', A:'2', BS:'2+', S:'6', AP:'-2', D:'2', kw:['ASSAULT','RAPID FIRE 2'] }
  ],
  melee:[
    { name:'Watcher’s Axe', range:'Melee', A:'6', WS:'2+', S:'12', AP:'-3', D:'4', kw:['CLEAVE 1'] }
  ],
  abilities:[
    // the new codex's wording (Wahapedia); New Recruit prints the bullets without full stops
    { name:'Captain-General', tag:'Aura', text:'Friendly **ADEPTUS CUSTODES** units (excluding **MONSTER/VEHICLE** units) within 6" of this model can:\n- Re-roll hit rolls of 1.\n- Re-roll wound rolls of 1.' },
    // ph/turn: "at the start of any phase"; the +3 A is the Watcher's Axe footnote, the 3+ InSv the When targeted line (one of the two)
    { name:'Moment Shackle', tag:'Once per battle, per army', ph:['command','movement','shooting','charge','fight'], turn:'either', def:'Moment Shackle (once per battle, at the start of any phase, one of its two effects): 3+ InSv until the end of the phase', text:'(Once per battle, per army) At the start of any phase, you can select one of the following to take effect until the end of the phase:\n- This model’s Watcher’s Axe weapon has +3 **A**.\n- This model has 3+ **InSv**.', defOf:'5935cd9c' }
  ]
},
'adeptus-custodes/allarus-custodians':{
  name:'Allarus Custodians', faction:'adeptus-custodes', bsId:'c8a6-a4c5-703e-b717',
  stats:[
    { name:'Allarus Custodian', M:'7"', T:'8', Sv:'2+', W:'6', Ld:'5+', InSv:'4+', base:'40mm' }
  ],
  ranged:[
    { name:'Balistus grenade launcher', range:'18"', A:'3', BS:'2+', S:'5', AP:'-1', D:'1', kw:['ASSAULT','BLAST 1'] },
    { name:'Castellan axe', range:'24"', A:'2', BS:'2+', S:'5', AP:'-1', D:'2', kw:['ASSAULT','RAPID FIRE 2'] }
  ],
  melee:[
    { name:'Castellan axe', range:'Melee', A:'3', WS:'2+', S:'10', AP:'-2', D:'4', kw:[] }
  ],
  abilities:[
    // the new codex's name (Wahapedia); New Recruit prints "Slayers of Tyrants"
    { name:'Slayer of Tyrants', text:'This unit’s melee attacks that target a unit with a **T** greater than this unit’s **T** have +1 to **wound rolls**.' },
    { name:'Vexilla', text:'- This unit has +1 **OC**.\n- This unit can ignore modifiers to this unit’s **Ld**.' }
  ]
},
'adeptus-custodes/prosecutor-squad':{
  name:'Prosecutor Squad', faction:'adeptus-custodes', bsId:'3ec3-a4df-fdbf-5507', role:'Infantry',
  stats:[
    { name:'Prosecutor', M:'7"', T:'3', Sv:'3+', W:'1', Ld:'6+', OC:'2', InSv:'–', base:'32mm' }
  ],
  ranged:[
    { name:'Boltgun', range:'24"', A:'1', BS:'3+', S:'5', AP:'-1', D:'1', kw:['ANTI-PSYKER 4+','ASSAULT','RAPID FIRE 1'] }
  ],
  melee:[
    // Gun Stock: the new codex's A 2 (Wahapedia); New Recruit and BSData give A 3 (deviations-nr.json, deviations-bsdata.json)
    { name:'Gun Stock', range:'Melee', A:'2', WS:'3+', S:'3', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Purity of Execution', ph:['shooting'], turn:'your', text:'In your Shooting phase, you can select one **visible** enemy unit within 18" of this unit. That unit is **detected**:\n- While a unit is **detected**, that unit has +3" **detection range**.' }
  ],
  rules:['Feel No Pain 3+*','Daughters of the Abyss','Assault','Anti','Rapid Fire'],
  kw:['Anathema Psykana','Faction: Anathema Psykana','Imperium','Infantry','Prosecutor Squad']
},
'adeptus-custodes/witchseeker-squad':{
  name:'Witchseeker Squad', faction:'adeptus-custodes', bsId:'503b-f7be-eeeb-9e31', role:'Infantry',
  stats:[
    { name:'Witchseeker', M:'7"', T:'3', Sv:'3+', W:'1', Ld:'6+', OC:'1', InSv:'–', base:'32mm' }
  ],
  ranged:[
    { name:'Flamer', range:'12"', A:'3', BS:'–', S:'4', AP:'-1', D:'1', kw:['ANTI-PSYKER 4+','ASSAULT','BLAST 1','TORRENT'] }
  ],
  melee:[
    // Gun Stock: the new codex's A 2 (Wahapedia); New Recruit and BSData give A 3 (deviations-nr.json, deviations-bsdata.json)
    { name:'Gun Stock', range:'Melee', A:'2', WS:'3+', S:'3', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    // Wahapedia's wording: New Recruit (BSData) prints it without "you can", with stray asterisks and a double full stop (deviations-nr, deviations-bsdata)
    { name:'Sanctified Flames', ph:['shooting'], turn:'your', text:'In your Shooting phase, when this unit has shot, you can select one enemy unit hit by those attacks. That enemy unit makes a **battle-shock roll**, with -1 to that **battle-shock roll** if that enemy unit is a **PSYKER** unit.' }
  ],
  rules:['Scouts 7"','Feel No Pain 3+*','Daughters of the Abyss','Anti','Torrent','Assault','Blast'],
  kw:['Anathema Psykana','Faction: Anathema Psykana','Imperium','Infantry','Witchseeker Squad']
},
'adeptus-custodes/caladius-annihilator-grav-tank':{
  name:'Caladius Annihilator Grav-tank', faction:'adeptus-custodes', bsId:'dbf0-5211-463c-40ec', role:'Vehicle',
  stats:[
    // base: GW's Base Size Guide (Event Companion, Oct 2026) "Caladius Grav-tank 170x109mm Oval Base"; BSData, and so New Recruit,
    // give 150×95mm (deviations-nr.json, deviations-bsdata.json)
    { name:'Caladius Annihilator Grav-tank', M:'10"', T:'11', Sv:'2+', W:'14', Ld:'5+', OC:'4', base:'170×109mm Oval' }
  ],
  ranged:[
    { name:'Arachnus Blaze Carronade', range:'48"', A:'4', BS:'2+', S:'12', AP:'-3', D:'D6+2', kw:['LETHAL HITS: MONSTER/VEHICLE'] },
    { name:'Twin Lastrum Bolt Cannon', range:'36"', A:'3', BS:'2+', S:'6', AP:'-2', D:'2', kw:['SUSTAINED HITS 1','TWIN-LINKED'] }
  ],
  melee:[
    { name:'Armoured hull', range:'Melee', A:'4', WS:'4+', S:'6', AP:'0', D:'1', kw:[] }
  ],
  abilities:[
    { name:'Advanced Firepower', text:'This unit’s ranged attacks that target a **MONSTER/VEHICLE** unit can:\n- Re-roll one **hit roll**.\n- Re-roll one **wound roll**.\n- Re-roll one **damage roll**.' }
  ],
  rules:['Deadly Demise D3','Aegis of the Emperor','Feel No Pain 5+*','Damaged 5','Deep Strike','Lethal Hits','Sustained Hits'],
  // CALADIUS: the datasheet's keywords (Wahapedia: "VEHICLE; CALADIUS; FLY; FRAME; GRAV-ASSAULT; IMPERIUM"); New Recruit prints
  // "Caladius Annihilator Grav-tank" and not CALADIUS. Flare Shields is the Grav-Assault Force detachment rule (GW's words), which
  // applies to it as a GRAV-ASSAULT unit; New Recruit prints it as an ability of the unit in its own words (deviations-nr.json)
  kw:['Caladius','Caladius Annihilator Grav-tank','Faction: Adeptus Custodes','Fly','Frame','Grav-assault','Imperium','Vehicle']
},
'adeptus-custodes/contemptor-achillus-dreadnought':{
  name:'Contemptor-Achillus Dreadnought', faction:'adeptus-custodes', bsId:'db3b-02cd-87a2-3b52', role:'Vehicle',
  stats:[
    { name:'Contemptor-Achillus Dreadnought', M:'9"', T:'10', Sv:'2+', W:'12', Ld:'5+', OC:'3', InSv:'5+', base:'60mm' }
  ],
  ranged:[
    { name:'Dreadspear', range:'18"', A:'2', BS:'2+', S:'10', AP:'-3', D:'D3+2', kw:[] },
    { name:'Lastrum storm bolter', range:'24"', A:'3', BS:'2+', S:'5', AP:'-1', D:'1', kw:['RAPID FIRE 3'] }
  ],
  melee:[
    { name:'Dreadspear', range:'Melee', A:'5', WS:'2+', S:'12', AP:'-3', D:'D3+3', kw:['LANCE'] }
  ],
  abilities:[
    { name:'Unyielding Ancient', def:'-1 to wound rolls for attacks with S greater than its T', text:'Attacks that target this unit with a **S** greater than this unit’s **T** have -1 to **wound rolls**.', defOf:'15a3c4f8' }
  ],
  rules:['Martial Ka\'tah','Deadly Demise D3','Aegis of the Emperor','Feel No Pain 5+*','Damaged 4','Lance','Rapid Fire'],
  kw:['Contemptor-Achillus Dreadnought','Dreadnought','Faction: Adeptus Custodes','Imperium','Vehicle','Walker']
},
'adeptus-custodes/contemptor-galatus-dreadnought':{
  name:'Contemptor-Galatus Dreadnought', faction:'adeptus-custodes', bsId:'4988-d93e-5034-2b3c', role:'Vehicle',
  stats:[
    { name:'Contemptor-Galatus Dreadnought', M:'9"', T:'10', Sv:'2+', W:'12', Ld:'5+', OC:'3', InSv:'4+', base:'60mm' }
  ],
  ranged:[
    { name:'Warblade', range:'12"', A:'4', BS:'–', S:'6', AP:'-1', D:'2', kw:['BLAST 2','TORRENT','TWIN-LINKED'] }
  ],
  melee:[
    { name:'Warblade', range:'Melee', WS:'2+', AP:'-2', kw:['CLEAVE 1','SUSTAINED HITS 1: non-MONSTER/VEHICLE'] }
  ],
  abilities:[
    { name:'Unyielding Ancient', def:'-1 to wound rolls for attacks with S greater than its T', text:'Attacks that target this unit with a **S** greater than this unit’s **T** have -1 to **wound rolls**.', defOf:'15a3c4f8' }
  ],
  rules:['Martial Ka\'tah','Deadly Demise D3','Aegis of the Emperor','Feel No Pain 5+*','Damaged 4','Blast','Torrent','Twin-linked'],
  kw:['Contemptor-Galatus Dreadnought','Dreadnought','Faction: Adeptus Custodes','Imperium','Vehicle','Walker']
},
'adeptus-custodes/telemon-heavy-dreadnought':{
  name:'Telemon Heavy Dreadnought', faction:'adeptus-custodes', bsId:'e7d8-1c73-7d03-8b62', role:'Vehicle',
  stats:[
    { name:'Telemon Heavy Dreadnought', M:'10"', T:'11', Sv:'2+', W:'14', Ld:'5+', OC:'4', InSv:'4+', base:'100mm' }
  ],
  ranged:[
    { name:'Spiculus bolt launcher', range:'36"', A:'6', BS:'2+', S:'5', AP:'-1', D:'1', kw:['BLAST 2'] },
    { name:'Twin Neutronium Cascade Projectors', range:'12"', A:'3', BS:'–', S:'7', AP:'-2', D:'1', kw:['BLAST 1','TORRENT','TWIN-LINKED'] },
    { name:'Adrathic Desolator', range:'24"', A:'4', BS:'2+', S:'10', AP:'-2', D:'4', kw:[] }
  ],
  melee:[
    { name:'Dual Caestus Fists', range:'Melee', A:'7', WS:'2+', S:'14', AP:'-3', D:'4', kw:['TWIN-LINKED'] },
    { name:'Caestus Fist', range:'Melee', A:'5', WS:'2+', S:'14', AP:'-3', D:'4', kw:[] }
  ],
  abilities:[
    { name:'Guardian Eternal', def:'Ranged attacks that target it have -1 D', text:'Ranged attacks that target this unit have -1 **D**.', defOf:'f7500cb9' }
  ],
  rules:['Martial Ka\'tah','Deadly Demise D3','Damaged 5','Aegis of the Emperor','Feel No Pain 5+*'],
  kw:['Dreadnought','Faction: Adeptus Custodes','Imperium','Telemon Heavy Dreadnought','Vehicle','Walker']
}
};
// ---- end of DATASHEETS ----

// core terms (not abilities): kept out of a unit's rule list and the glossary of rules units have
const CONCEPTS = ['Hazard Roll','Mortal Wounds','Battle-shock','Engagement','Selected to Attack','Destroyed','Normal Move','Advance Move','Fall-back Move','Charge','Charge Move','Pile-in Move','Consolidation Move','Benefit of Cover','Strategic Reserves','Ingress Move','Surge Move','Scout Move','Starting Strength','Select Weapons'];

// ---- BS_IDS: written by verify/import-ids.js from BSData (do not edit) ----
const BS_IDS = {
  factions:{
    "03fe-a162-4c02-f07b":"emperors-children",
    "1069-10ff-3ba9-873b":"thousand-sons",
    "1f19-6509-d906-ca10":"adeptus-custodes",
    "25dd-7aa0-6bf4-f2d5":"imperial-knights",
    "46d8-abc8-ef3a-9f85":"chaos-knights",
    "77b9-2f66-3f9b-5cf3":"adeptus-mechanicus",
    "a55f-b7b3-6c65-a05f":"orks",
    "b984-7317-81cc-20f":"tyranids",
    "df9a-59b2-f464-59ad":"world-eaters"
  },
  roots:{
    "1162-9cd5-d6b0-1663":"detachment",
    "2f69-9148-45b4-86a8":"disposition",
    "3b0d-dccf-8661-be1c":"detachment",
    "5218-339c-eb34-9ac0":"detachment",
    "564e-fbc6-5266-3ea4":"battleSize",
    "5a84-ea91-b707-1656":"detachment",
    "6470-c44a-45f4-3313":"detachment",
    "73c2-d0ed-3c7e-7e17":"detachment",
    "84c8-b821-877d-72e6":"detachment",
    "a435-b94a-eb7b-7c0c":"detachment",
    "a6ad-d379-46ee-2c24":"detachment",
    "bac9-a18e-5a8a-48d1":"detachment",
    "c82f-1b42-946-9c9a":"detachment"
  },
  battleSizes:{
    "baf8-997f-e323-a090":"Strike Force"
  },
  limits:{
    "Strike Force":2000
  },
  dispositions:{
    "081d-bc07-5d4e-ab22":"Priority Assets",
    "31ed-50f0-6571-c4c1":"Disruption",
    "3b81-de3e-f72c-b208":"Reconnaissance",
    "7da4-f0a6-65ec-da48":"Purge the Foe",
    "a271-bfab-1b97-c55d":"Take and Hold"
  },
  detachments:{
    "0985-28ae-cf24-2fba":"world-eaters/butchers-of-khorne",
    "1558-660f-466b-a087":"world-eaters/khorne-daemonkin",
    "1bb5-5aba-6c8f-7afc":"adeptus-custodes/might-of-the-moritoi",
    "1c7e-56bc-3196-b5cd":"adeptus-custodes/emperors-chosen",
    "3490-ec82-70b3-c5cf":"world-eaters/berzerker-warband",
    "496c-ddb9-3e71-e0b3":"orks/war-horde",
    "4b17-a73a-7a0a-a265":"orks/bully-boyz",
    "4b8b-16b7-091d-7b6f":"thousand-sons/ritual-of-regeneration",
    "4e8e-50db-0d32-423c":"imperial-knights/freeblade-company",
    "5be7-3aa8-5d64-cbaf":"thousand-sons/warpmeld-pact",
    "5d30-981f-43b8-81be":"chaos-knights/hunting-warpack",
    "6cb5-45cf-c626-fa86":"chaos-knights/houndpack-lance",
    "6d06-9e26-0d3c-5317":"adeptus-mechanicus/eradication-cohort",
    "70d9-0c7a-6b46-65fa":"world-eaters/vessels-of-wrath",
    "7b06-be3a-9754-1bd4":"orks/runt-swarm",
    "807c-9732-5465-5ca5":"orks/dread-mob",
    "812b-f056-ec50-2c3c":"chaos-knights/infernal-lance",
    "850e-bee1-4845-820d":"tyranids/crusher-stampede",
    "8d8b-a030-83d5-f4e6":"tyranids/talons-of-the-norn-queen",
    "9aba-cb08-cd38-9e01":"thousand-sons/grand-coven",
    "9db8-cf55-983f-9671":"emperors-children/coterie-of-the-conceited",
    "ccb7-6823-6a97-7c19":"adeptus-custodes/grav-assault-force",
    "f67d-6f59-21b8-e1f9":"adeptus-mechanicus/cohort-cybernetica",
    "f782-e3f1-c132-fe52":"orks/wreckas",
    "fca1-ecdf-4e4a-df41":"orks/shoota-boyz"
  },
  config:{
    "9508-a2b1-713f-cf7b":"Code Chivalric"
  },
  configKids:{
    "35d6-ec47-0b46-bce5":"Deed",
    "36a1-1871-451c-0405":"Quality"
  },
  info:{
    "5558-f47e-9f45-3fca":"Blessings of Khorne Reference",
    "7a3e-cedf-9f08-fcac":"Martial Ka'tah Reference",
    "87f0-0a14-9b6b-f367":"Rituals reference",
    "e8ef-836a-a9d1-901d":"Show/Hide Options"
  },
  infoKids:{
    "1248-8642-b42f-1dca":"Show Tzeentch Daemons",
    "2973-ea51-7f8d-5403":"Show Unaligned Forces",
    "41bc-337c-cae2-eb21":"Show Pariah Nexus content",
    "5700-66f7-a020-7386":"Show Armageddon content",
    "57cc-822a-1d43-be52":"Show Crucible Characters",
    "9869-d845-89a6-6273":"Show Killzone Upgrade: Shadowvaults content",
    "9ed-cbf4-bfe5-90bf":"Show Legends",
    "aeb4-96de-7401-eaa3":"Show Chaos Knights",
    "c00c-b9d6-e0f7-4c37":"Show White Dwarf content",
    "c566-c14f-c589-5375":"Show Tyrannic War content",
    "c9b3-8039-f1e9-c975":"Show Nachmund Gauntlet content",
    "d3ff-16f0-dad2-c03c":"Show Slaanesh Daemons",
    "e08b-2448-5606-fefb":"Show Imperial Agents",
    "e82c-6f8c-2b97-a287":"Show Imperial Knights",
    "e916-2cf4-a49d-b8c4":"Show Unaligned Fortifications",
    "f26b-79db-80e0-3a3b":"Show Titans",
    "f486-5e38-994c-15ec":"Show Nurgle Daemons",
    "f5f9-1339-84bb-ae85":"Show Khorne Daemons"
  },
  units:{
    "4-megas-and-a-destrier/canis-rex":["55fb-9c91-1a4f-3037|1×84c0-f59d-901a-e94f,1×84c0-f59d-901a-e94f/43a9-66c5-ec02-baa9,1×84c0-f59d-901a-e94f/70b4-8523-6b7c-1b0a,1×84c0-f59d-901a-e94f/f1aa-b2e0-2fa8-4c39,1×a41b-81a0-ca89-75c1,1×a41b-81a0-ca89-75c1/b74a-d992-b5eb-23ff,1×a41b-81a0-ca89-75c1/e8b4-ffab-1b5c-d2a0"],
    "4-megas-and-a-destrier/cerastus-knight-atrapos":["37a7-d156-1e4c-8fe1|1×406-60ac-f728-9c6d,1×73e9-498e-2d97-e18,1×cc5a-e1bc-3dd8-f367"],
    "4-megas-and-a-destrier/cerastus-knight-lancer":["9ee-e289-bc6c-d943|1×58f8-dd4e-bb8f-f357"],
    "4-megas-and-a-destrier/knight-crusader":["1e27-a6de-3840-a050|1×273-38fa-249e-3aa4,1×288c-1cbc-8340-9c0a,1×441c-a2a8-59a4-85a4,1×4fc1-2679-a110-3cd,1×a05e-db63-84ad-4c5e,1×a05e-db63-84ad-4c5e/d6c0-4d42-c3c4-db8a,1×a05e-db63-84ad-4c5e/eedf-6059-a15-3c86,1×ca02-db54-10e6-f20e,1×e584-f803-7858-05bc"],
    "4-megas-and-a-destrier/knight-destrier":["10d8-d702-f556-5d3c|1×3ded-7df8-ef3e-913a,1×646c-5f7f-cd1c-d5c9,1×c62a-bc9c-37fb-2b36,1×cb31-e496-08de-77d4,1×fc2d-063a-a9fa-968f"],
    "6-bigs/knight-destrier":["10d8-d702-f556-5d3c|1×3ded-7df8-ef3e-913a,1×646c-5f7f-cd1c-d5c9,1×c62a-bc9c-37fb-2b36,1×fc2d-063a-a9fa-968f"],
    "6-bigs/knight-errant":["9efd-ec72-353f-4b23|1×1187-f3db-ea97-bada,1×273-38fa-249e-3aa4,1×441c-a2a8-59a4-85a4,1×86c9-46db-4de-4a5d"],
    "6-bigs/knight-paladin":["8441-8356-5e7c-69ee|1×1187-f3db-ea97-bada,1×273-38fa-249e-3aa4,1×441c-a2a8-59a4-85a4,1×93c3-d64f-2d6e-ea,1×d6c0-4d42-c3c4-db8a"],
    "6-bigs/knight-warden":["c609-c87e-f9dd-5006|1×1187-f3db-ea97-bada,1×273-38fa-249e-3aa4,1×441c-a2a8-59a4-85a4,1×4fc1-2679-a110-3cd,1×ad65-d3cb-c677-7cb3,1×ca02-db54-10e6-f20e"],
    "big-demons-baby/angron":["f4b8-1179-de57-4d69|1×3f1f-49de-78f6-e59e,1×9754-481c-c292-a1f9"],
    "big-demons-baby/bloodthirster":["4ad2-bd20-6dfe-776b|1×819a-63a5-f90c-7794,1×9064-698b-c833-b972"],
    "big-demons-baby/daemon-prince-of-khorne":["40c5-9ebd-6d42-2855|1×3e4b-1a3a-8473-578c,1×75ce-5ce7-0a6e-a876,1×f132-71e1-81e2-5074"],
    "big-demons-baby/flesh-hounds":["b657-1743-6e3a-0838|4×13cd-5399-07f2-6d79,4×13cd-5399-07f2-6d79/c7e3-601f-3442-250b,4×13cd-5399-07f2-6d79/dd8d-1bc7-029f-3674,1×a0d5-2805-f05a-29e1,1×a0d5-2805-f05a-29e1/c214-c491-ef49-04ec,1×a0d5-2805-f05a-29e1/c7e3-601f-3442-250b,1×a0d5-2805-f05a-29e1/dd8d-1bc7-029f-3674"],
    "big-demons-baby/goremongers":["b399-9b66-e550-8050|7×3a22-1796-8a64-6d3b,7×3a22-1796-8a64-6d3b/062f-464f-9cfe-5dce,7×3a22-1796-8a64-6d3b/81d1-50cc-2825-7475,7×3a22-1796-8a64-6d3b/f70d-d0cb-5cb8-3be9,1×f60b-c058-268e-5e87,1×f60b-c058-268e-5e87/062f-464f-9cfe-5dce,1×f60b-c058-268e-5e87/81d1-50cc-2825-7475,1×f60b-c058-268e-5e87/f70d-d0cb-5cb8-3be9"],
    "big-demons-baby/jakhals":["6f81-4538-a414-251e|1×307d-0ce0-fcf0-9100,1×307d-0ce0-fcf0-9100/88ee-2f6b-0b00-0852,1×47af-ef6b-9d50-2c4a,1×47af-ef6b-9d50-2c4a/cde4-4b0b-0fa4-766e,1×47af-ef6b-9d50-2c4a/f70d-d0cb-5cb8-3be9,1×a93b-d0d4-9bfe-40c3,8×a93b-d0d4-9bfe-40c3/0620-25eb-4da2-5dae,8×a93b-d0d4-9bfe-40c3/0620-25eb-4da2-5dae/cde4-4b0b-0fa4-766e,8×a93b-d0d4-9bfe-40c3/0620-25eb-4da2-5dae/f70d-d0cb-5cb8-3be9"],
    "big-demons-baby/lord-on-juggernaut-khorne-berzerkers":["ec72-f024-4283-0558|1×1673-a61f-d5a2-b17c,1×4292-1471-4fd6-7dac,1×47e1-9e86-8a80-66e1,1×6d28-ca9d-79a5-063a","f909-00c7-8ba4-018a|1×38fb-1df5-8eb6-fdf6,1×38fb-1df5-8eb6-fdf6/44b0-1947-ea4a-3005,1×38fb-1df5-8eb6-fdf6/f20c-0563-3e0a-e0c8,4×8cbb-0e54-096a-e053,4×8cbb-0e54-096a-e053/6fd1-efa4-7787-db82,4×8cbb-0e54-096a-e053/a3b4-f330-4ed9-8314,1×8e1d-9846-a460-6002,15×b568-8a23-be6f-a14d,15×b568-8a23-be6f-a14d/2ba4-635b-fffd-0f59,15×b568-8a23-be6f-a14d/44b0-1947-ea4a-3005"],
    "big-demons-baby/master-of-executions":["1b56-682c-ac33-bc5f|1×6105-a18c-fcd1-a9da,1×c41d-61c0-3e59-01b5,1×eddd-9b27-00c2-b0ce"],
    "big-demons-baby/skarbrand":["71d9-9dc2-2b9a-6db3|1×1d6b-5a43-7bc9-18af,1×78e7-69eb-d93a-2b00"],
    "defilers-and-friends/chaos-rhino":["8ae1-aa47-e1d1-1b31|2×02c9-ea19-b105-af58,1×661a-207c-a66d-8da0,1×7695-54a2-f38b-a89c"],
    "defilers-and-friends/daemon-prince-of-slaanesh-with-wings":["e452-08be-33e6-3864|1×9ad3-083a-577b-56b0,1×b464-6a59-916f-c9d9"],
    "defilers-and-friends/defiler":["b541-3292-a5cc-dbeb|1×23ce-dba1-8242-532d,2×23ce-dba1-8242-532d/bd01-88b9-7d60-b49a,1×2ca0-73ea-2725-79c7,2×34b5-f449-28f6-b365,1×b77f-43c5-91b6-7da7"],
    "defilers-and-friends/defiler-2":["b541-3292-a5cc-dbeb|1×23ce-dba1-8242-532d,2×23ce-dba1-8242-532d/bd01-88b9-7d60-b49a,1×2ca0-73ea-2725-79c7,2×34b5-f449-28f6-b365,1×b77f-43c5-91b6-7da7"],
    "defilers-and-friends/lord-exultant-infractors":["7b4c-dfe0-6a0a-304a|1×1e16-0387-abcf-0e9a,1×3469-166f-44f3-51b8,1×d5fe-026f-1f46-e9c5,1×f1b5-b55a-e18b-fe84","e456-0afc-9b42-226c|1×8a59-c996-8ae9-8bd6,1×b59f-e25b-6248-8f90,1×b59f-e25b-6248-8f90/e13a-503d-72dc-f4ed,1×b59f-e25b-6248-8f90/ea86-f483-33bb-182b,4×ea82-9845-1b96-c57c,4×ea82-9845-1b96-c57c/3469-166f-44f3-51b8,4×ea82-9845-1b96-c57c/6ab9-df1b-b1fb-8d20"],
    "defilers-and-friends/lucius-the-eternal-flawless-blades":["e390-b58b-db9-816|1×23e2-6d93-5012-304d,1×c7a7-3164-12bc-3462,1×cd60-e6ca-4de4-bf07","183e-f3bb-3ce6-7b55|3×0567-0f45-90e8-d3f4,3×0567-0f45-90e8-d3f4/3469-166f-44f3-51b8,3×0567-0f45-90e8-d3f4/f048-127d-0e0b-2279"],
    "defilers-and-friends/maulerfiend":["656c-8b78-8e59-0591|1×167f-5eee-fb7b-a9a9,1×9ef8-1cb6-2f19-cc1b,2×9ef8-1cb6-2f19-cc1b/bd33-fe8e-fe90-2bb7"],
    "defilers-and-friends/tormentors":["4494-dd7d-69f7-306c|1×2a06-5c5b-c129-27d7,1×2a06-5c5b-c129-27d7/e13a-503d-72dc-f4ed,1×2a06-5c5b-c129-27d7/ea86-f483-33bb-182b,1×c1d2-2cf5-b6bd-17fc,1×c6a8-0dbc-ab1b-38b5,1×c6a8-0dbc-ab1b-38b5/ab80-e71b-5a84-2852,1×c6a8-0dbc-ab1b-38b5/b717-8754-263b-3a20,3×d813-7c6b-1dfe-e99a,3×d813-7c6b-1dfe-e99a/8ff6-03ed-5125-9b6d,3×d813-7c6b-1dfe-e99a/ab80-e71b-5a84-2852"],
    "infernal-lance/chaos-cerastus-knight-atrapos":["8b1d-9029-f9e1-42d9|1×4676-0c32-b62c-debd,1×7546-5742-581c-9e8b,1×f57d-be6e-77e4-bfe3"],
    "infernal-lance/chaos-cerastus-knight-lancer":["4175-82c6-8e96-bef8|1×545a-eead-e216-5939,1×c799-77ce-c706-3079"],
    "infernal-lance/knight-despoiler":["0119-8c04-435e-c782|1×005c-b2d1-4432-415a,1×3bee-8c85-68f7-e54b,1×3f41-4b71-a07b-506a,1×4268-2d76-f972-d7f5,1×4268-2d76-f972-d7f5/89c4-132e-6ad6-2a08,1×4268-2d76-f972-d7f5/f4a1-7f17-ec57-6c69,1×48a2-a603-9607-4df8,1×48a2-a603-9607-4df8/89c4-132e-6ad6-2a08,1×48a2-a603-9607-4df8/f4a1-7f17-ec57-6c69,1×4ff3-7dce-5a52-94e9,1×dfe8-cea0-8d16-db95"],
    "infernal-lance/knight-ruinator":["c0a2-eb65-6d34-5bc6|1×9e94-b7d4-ec7f-9163,1×b4ca-3419-c219-f429,1×f075-4ccc-9a91-5e6d"],
    "infernal-lance/knight-ruinator-fleshmetal-fusion":["c0a2-eb65-6d34-5bc6|1×27b4-53af-ee1b-688a,1×9e94-b7d4-ec7f-9163,1×b4ca-3419-c219-f429,1×f075-4ccc-9a91-5e6d"],
    "infernal-lance/nurglings":["e403-3a9-279e-41b7|3×7212-7cc9-ec49-72b8,3×7212-7cc9-ec49-72b8/2aea-961-8345-fce5"],
    "lite-knights/caladius-annihilator-grav-tank":["dbf0-5211-463c-40ec|1×62a1-1fa7-70b7-614d,1×d9ca-c6b0-ba9c-b6c8,1×dca3-638e-52a2-b1b8"],
    "lite-knights/contemptor-achillus-dreadnought":["db3b-02cd-87a2-3b52|1×b1eb-9d70-dfc2-208b,2×d9a6-8dbd-2c01-862b"],
    "lite-knights/contemptor-galatus-dreadnought":["4988-d93e-5034-2b3c|1×5514-3810-cf3e-3b23,1×a287-990-9f34-9836"],
    "lite-knights/prosecutor-squad":["3ec3-a4df-fdbf-5507|4×6814-ce42-4b23-72a9,4×6814-ce42-4b23-72a9/3d5c-4127-b923-d579,4×6814-ce42-4b23-72a9/77b6-41ee-7952-e94d"],
    "lite-knights/telemon-heavy-dreadnought":["e7d8-1c73-7d03-8b62|1×1189-dcd8-e3ed-7837,1×3f27-79c1-1aea-5be7,1×3f27-79c1-1aea-5be7/8dc7-bea2-997b-a1c9,2×3f27-79c1-1aea-5be7/9f43-3691-5be1-8623,1×7b41-35aa-3265-14d7"],
    "lite-knights/telemon-heavy-dreadnought-2":["e7d8-1c73-7d03-8b62|1×1189-dcd8-e3ed-7837,1×8555-148a-0e35-4749,1×8555-148a-0e35-4749/6445-6811-f628-9750,1×8555-148a-0e35-4749/72c5-8bd0-19f5-f246,1×8555-148a-0e35-4749/9f43-3691-5be1-8623"],
    "lite-knights/trajann-valoris-allarus-custodians":["7d7c-c212-47a3-38e4|1×0574-f558-2957-584f,1×5622-c756-d3e8-85ae,1×b330-bad6-ea21-ecb","c8a6-a4c5-703e-b717|1×59ef-1bf3-f681-c8ae,2×fab4-d437-6e07-eb33,2×fab4-d437-6e07-eb33/4863-f443-2b45-e18b,2×fab4-d437-6e07-eb33/94b3-ef7f-f71f-c86e"],
    "lite-knights/witchseeker-squad":["503b-f7be-eeeb-9e31|4×9fdd-e31a-5f28-85ea,4×9fdd-e31a-5f28-85ea/77b6-41ee-7952-e94d,4×9fdd-e31a-5f28-85ea/f12b-b113-de8a-4f1e"],
    "lite-knights/witchseeker-squad-2":["503b-f7be-eeeb-9e31|5×9fdd-e31a-5f28-85ea,5×9fdd-e31a-5f28-85ea/77b6-41ee-7952-e94d,5×9fdd-e31a-5f28-85ea/f12b-b113-de8a-4f1e"],
    "melee/beastboss-on-squigosaur-headwoppas-killchoppa":["a8b7-351-d911-a4d6|1×109a-db29-c4a5-f826,1×40fb-e485-dca0-cb12,1×4dcd-5d7f-65c2-245b,1×6084-9fb5-76d2-8487,1×d231-f7e4-f722-d987"],
    "melee/big-mek-in-mega-armour-meganobz":["95e9-6da3-5e75-2566|1×6b9e-c6ae-2626-45c9,1×e0c6-58cd-a822-8b84,1×ed0c-e9cb-399f-a5a2,1×f65e-dc30-e7c0-7e47","7067-34f4-5272-e05f|5×731f-2f2-7ca0-23ed,5×731f-2f2-7ca0-23ed/b46a-4885-3b28-428b"],
    "melee/big-mek-painboy-nobz":["fbee-427a-1c46-f621|1×673b-c3e-6682-ae28,1×df3a-0414-6edc-005a,1×e201-253f-1f52-e389","7669-1442-2c0b-e0c9|1×96d6-846e-edd3-332f,1×e083-787f-1fff-4170","b16a-7132-3f8a-abe5|8×252b-cdba-84bd-3ed3,8×252b-cdba-84bd-3ed3/392a-657c-8bfe-a1e6,8×252b-cdba-84bd-3ed3/8bba-d0bf-1102-2131,2×cff4-311e-b386-0879,2×cff4-311e-b386-0879/392a-657c-8bfe-a1e6,2×cff4-311e-b386-0879/9a9f-3dab-02c0-8be7"],
    "melee/deffkoptas":["2d6e-aa3b-c28c-5ef0|1×484b-6da4-9390-33ae,1×484b-6da4-9390-33ae/2575-9440-a8cf-1c50,1×484b-6da4-9390-33ae/89b1-3250-5148-c69f,1×484b-6da4-9390-33ae/d137-294e-49d2-53a9,1×484b-6da4-9390-33ae/d231-f7e4-f722-d987,2×c0f6-1a61-c90f-f188,2×c0f6-1a61-c90f-f188/2575-9440-a8cf-1c50,2×c0f6-1a61-c90f-f188/7d49-39ac-d17e-63bf,2×c0f6-1a61-c90f-f188/89b1-3250-5148-c69f,2×c0f6-1a61-c90f-f188/d231-f7e4-f722-d987"],
    "melee/ghazghkull-thraka":["4ea0-6b70-c17c-bc00|1×07b7-836e-524b-7227,1×4325-5811-1915-3c15,1×7f5-23ea-19ab-176,1×8b5-898c-f79b-5a9c"],
    "melee/gretchin":["de8f-24f9-c543-92b7|10×43dd-f974-3fc8-8abc,10×43dd-f974-3fc8-8abc/140d-7163-8a11-81c5,10×43dd-f974-3fc8-8abc/5cd1-cb47-fd8f-5704"],
    "melee/mozrog-skragbad":["b42b-ea0-38f1-6300|1×109a-db29-c4a5-f826,1×2ace-f88f-3405-d191,1×2fec-7b95-a5df-f688"],
    "melee/nazdreg-meganobz":["80c4-14b2-d02d-d289|1×0955-1e48-ac34-156f,1×b27b-4fee-2644-a355","7067-34f4-5272-e05f|5×731f-2f2-7ca0-23ed,5×731f-2f2-7ca0-23ed/b46a-4885-3b28-428b"],
    "melee/squighog-boyz":["6a83-8e1f-63ef-50c3|3×954d-5938-64d8-597c,3×954d-5938-64d8-597c/5efb-f61f-fdb6-a7d7,3×954d-5938-64d8-597c/8a8f-5ceb-8a0a-6c6c,3×954d-5938-64d8-597c/fa30-43a8-57eb-a82e,1×99c8-e37d-ae6d-a8ba,1×99c8-e37d-ae6d-a8ba/aecd-6ba5-5558-fee2,1×99c8-e37d-ae6d-a8ba/d231-f7e4-f722-d987,1×99c8-e37d-ae6d-a8ba/fa30-43a8-57eb-a82e"],
    "mucho-mutantes/ahriman-tzaangor-enlightened-with-fatecaster-greatbows":["3bfa-bf00-b5ed-cc81|1×570a-6d55-51ee-9fc7,1×93c8-9c05-8892-b481,1×c70d-46dc-32da-b1a4","8b9f-917f-37c1-99c3|5×414e-b8ff-7132-48c7,5×414e-b8ff-7132-48c7/23a5-d6be-b617-1565,5×414e-b8ff-7132-48c7/8097-77df-1ed5-1e1a,1×6cc8-d237-eec9-d038,1×6cc8-d237-eec9-d038/23a5-d6be-b617-1565,1×6cc8-d237-eec9-d038/8097-77df-1ed5-1e1a"],
    "mucho-mutantes/daemon-prince-of-tzeentch-with-wings":["66f4-929e-1769-f277|1×2313-45a2-28ff-c81a,1×7205-f4fe-f064-0edf,1×ca9c-de3c-61e1-31"],
    "mucho-mutantes/exalted-sorcerer-on-disc-of-tzeentch-tzaangor-enlightened-with-fatecaster-greatbows":["1724-8c9c-c385-16c6|1×6633-5a38-bd55-b080,1×74f5-4553-6d71-b44c,1×aac1-5b0f-4802-1628,1×c70d-46dc-32da-b1a4","8b9f-917f-37c1-99c3|5×414e-b8ff-7132-48c7,5×414e-b8ff-7132-48c7/23a5-d6be-b617-1565,5×414e-b8ff-7132-48c7/8097-77df-1ed5-1e1a,1×6cc8-d237-eec9-d038,1×6cc8-d237-eec9-d038/23a5-d6be-b617-1565,1×6cc8-d237-eec9-d038/8097-77df-1ed5-1e1a"],
    "mucho-mutantes/magnus-the-red":["91dc-9aad-0505-52a8|1×9916-8701-bbbd-780e,1×a021-c1a0-c35c-f10f,1×b114-2c55-f1b6-6f98,1×d379-7bdd-e3f9-9183"],
    "mucho-mutantes/sekhetar-robots":["fe4b-b3a4-69b7-3088|2×4ba8-dbf3-05f9-f868,2×4ba8-dbf3-05f9-f868/0dc4-725f-e51b-77f7,2×4ba8-dbf3-05f9-f868/ae78-f3d8-6cf0-6a89,2×4ba8-dbf3-05f9-f868/af48-0e3e-56f5-f5b1,2×4ba8-dbf3-05f9-f868/ce35-c6e4-d9cc-799c"],
    "mucho-mutantes/tzaangor-shaman-tzaangor-enlightened-curse-of-life":["c251-bd54-441-4799|1×1a98-844f-f54b-f76c,1×4287-4c82-30d5-bfaa,1×44f2-27ca-fad5-70ad","1703-3edd-5eb3-fcef|1×7ebd-c3dc-8467-70ae,1×7ebd-c3dc-8467-70ae/7b4e-03d3-6b3f-6c48,5×996-bd56-400b-a51e,5×996-bd56-400b-a51e/7b4e-03d3-6b3f-6c48"],
    "mucho-mutantes/tzaangor-shaman-tzaangor-enlightened-diamond-of-distortion":["c251-bd54-441-4799|1×190d-7321-6e85-5251,1×1a98-844f-f54b-f76c,1×4287-4c82-30d5-bfaa","1703-3edd-5eb3-fcef|1×7ebd-c3dc-8467-70ae,1×7ebd-c3dc-8467-70ae/7b4e-03d3-6b3f-6c48,5×996-bd56-400b-a51e,5×996-bd56-400b-a51e/7b4e-03d3-6b3f-6c48"],
    "mucho-mutantes/tzaangor-shaman-tzaangor-enlightened-flowing-flesh":["c251-bd54-441-4799|1×1a98-844f-f54b-f76c,1×4287-4c82-30d5-bfaa,1×c84c-683a-79be-1620","1703-3edd-5eb3-fcef|1×7ebd-c3dc-8467-70ae,1×7ebd-c3dc-8467-70ae/7b4e-03d3-6b3f-6c48,5×996-bd56-400b-a51e,5×996-bd56-400b-a51e/7b4e-03d3-6b3f-6c48"],
    "mucho-mutantes/tzaangors":["f5b9-50c8-5c60-d8ea|1×255b-146d-ca61-55fb,1×255b-146d-ca61-55fb/ee84-120d-a66b-0b72,9×5b9-7d59-48fd-b485,9×5b9-7d59-48fd-b485/a484-6a41-3648-bce1"],
    "nidzillas/hive-tyrant":["3e96-8098-3401-77af|1×131b-ff57-84bb-e87a,1×ceab-62d9-31bf-7c61,1×d0cf-a582-5166-fbba,1×effb-d65d-a1b1-51d6"],
    "nidzillas/neurogaunts":["8ccc-3f27-7e4e-da81|1×8488-2efe-825f-a403,1×8488-2efe-825f-a403/65d0-a5c5-919a-6444,10×a998-39ce-f312-129,10×a998-39ce-f312-129/65d0-a5c5-919a-6444"],
    "nidzillas/norn-assimilator-synaptoprescience":["6a9b-8e2f-edac-fa2d|1×50f3-6a18-bc71-2a59,1×59a4-4504-cb52-93b1,1×d40a-c9a6-74d5-288d"],
    "nidzillas/norn-assimilator-synaptoprescience-2":["6a9b-8e2f-edac-fa2d|1×50f3-6a18-bc71-2a59,1×59a4-4504-cb52-93b1,1×d40a-c9a6-74d5-288d"],
    "nidzillas/norn-emissary":["5720-2873-8c2c-edc3|1×c102-d98b-dc50-5b53,1×d7b3-df20-933-63b7,1×dc69-1094-613-6daf"],
    "nidzillas/norn-emissary-destabilising-predation":["5720-2873-8c2c-edc3|1×a336-1346-0281-b4b2,1×c102-d98b-dc50-5b53,1×d7b3-df20-933-63b7,1×dc69-1094-613-6daf"],
    "nidzillas/the-swarmlord":["13f7-1a3-eff-7393|1×7a17-4fb0-c0f5-e22,1×a30-4bad-cef5-5e55"],
    "nidzillas/tyrannofex":["1705-379b-330d-36d4|1×5e02-c4ce-b7e6-d59,1×a87e-4f8-a6f7-15de,1×f64-8faa-ac54-73ff"],
    "ooga-booga/big-mek-in-mega-armour-meganobz":["95e9-6da3-5e75-2566|1×10f9-eb42-632e-3a6f,1×82cc-4b0b-8e55-bf48,1×e0c6-58cd-a822-8b84,1×f65e-dc30-e7c0-7e47","7067-34f4-5272-e05f|5×cdad-e2e0-9db3-93fc,5×cdad-e2e0-9db3-93fc/ce61-585b-aea7-18fc,5×cdad-e2e0-9db3-93fc/f65e-dc30-e7c0-7e47"],
    "ooga-booga/big-mek-painboy-nobz":["fbee-427a-1c46-f621|1×673b-c3e-6682-ae28,1×df3a-0414-6edc-005a","7669-1442-2c0b-e0c9|1×96d6-846e-edd3-332f,1×e083-787f-1fff-4170","b16a-7132-3f8a-abe5|2×cff4-311e-b386-0879,2×cff4-311e-b386-0879/392a-657c-8bfe-a1e6,2×cff4-311e-b386-0879/9a9f-3dab-02c0-8be7,8×e4b1-2a15-2843-283a,8×e4b1-2a15-2843-283a/32ab-c37c-b71f-8415,8×e4b1-2a15-2843-283a/392a-657c-8bfe-a1e6"],
    "ooga-booga/ghazghkull-thraka":["4ea0-6b70-c17c-bc00|1×07b7-836e-524b-7227,1×4325-5811-1915-3c15,1×7f5-23ea-19ab-176,1×8b5-898c-f79b-5a9c"],
    "ooga-booga/gretchin":["de8f-24f9-c543-92b7|10×43dd-f974-3fc8-8abc,10×43dd-f974-3fc8-8abc/140d-7163-8a11-81c5,10×43dd-f974-3fc8-8abc/5cd1-cb47-fd8f-5704"],
    "ooga-booga/nazdreg-meganobz":["80c4-14b2-d02d-d289|1×0955-1e48-ac34-156f,1×b27b-4fee-2644-a355","7067-34f4-5272-e05f|5×731f-2f2-7ca0-23ed,5×731f-2f2-7ca0-23ed/b46a-4885-3b28-428b"],
    "ooga-booga/zodgrod-wortsnagga-runtherd-gretchin":["ce45-db08-3795-18a9|1×7dfc-efc5-a31c-a724,1×c1a7-616a-af3a-cdf9","f401-c74a-cca8-5de3|1×aa3c-6662-6bf0-6a7e,1×d231-f7e4-f722-d987","de8f-24f9-c543-92b7|20×43dd-f974-3fc8-8abc,20×43dd-f974-3fc8-8abc/140d-7163-8a11-81c5,20×43dd-f974-3fc8-8abc/5cd1-cb47-fd8f-5704,1×8ba4-a299-ac96-fbc5"],
    "princes/chaos-rhino":["e849-ce40-ee43-7623|1×9cc3-1188-9678-0ee1,1×f76c-0f51-ad33-c118"],
    "princes/daemon-prince-of-khorne-berzerker-glaive":["40c5-9ebd-6d42-2855|1×2c4c-5aac-b510-28ef,1×3e4b-1a3a-8473-578c,1×f132-71e1-81e2-5074"],
    "princes/daemon-prince-of-khorne-helm-of-brazen-ire":["40c5-9ebd-6d42-2855|1×3e4b-1a3a-8473-578c,1×6836-5818-2135-a8aa,1×9754-481c-c292-a1f9,1×f132-71e1-81e2-5074"],
    "princes/eightbound":["9435-1f44-7e5b-d510|1×6f2c-fc26-53bc-34bd,1×6f2c-fc26-53bc-34bd/adff-65e7-4566-084b,2×7e60-1733-57d1-71f3,2×7e60-1733-57d1-71f3/f8bc-c08c-22f0-8ebb"],
    "princes/forgefiend":["81e1-b212-69c1-308f|1×54ca-fec8-f0c6-2c77,1×54ca-fec8-f0c6-2c77/4b2a-4860-aed5-56b6,1×54ca-fec8-f0c6-2c77/a58b-974d-14a0-ece2,1×d877-3dd3-2d5a-e092,2×d877-3dd3-2d5a-e092/a343-07e9-e8f9-67f2"],
    "princes/jakhals":["6f81-4538-a414-251e|1×307d-0ce0-fcf0-9100,1×307d-0ce0-fcf0-9100/88ee-2f6b-0b00-0852,1×47af-ef6b-9d50-2c4a,1×47af-ef6b-9d50-2c4a/cde4-4b0b-0fa4-766e,1×47af-ef6b-9d50-2c4a/f70d-d0cb-5cb8-3be9,1×a93b-d0d4-9bfe-40c3,8×a93b-d0d4-9bfe-40c3/0620-25eb-4da2-5dae,8×a93b-d0d4-9bfe-40c3/0620-25eb-4da2-5dae/cde4-4b0b-0fa4-766e,8×a93b-d0d4-9bfe-40c3/0620-25eb-4da2-5dae/f70d-d0cb-5cb8-3be9"],
    "princes/kh-rn-the-betrayer-khorne-berzerkers":["3449-7dac-6ac8-5d51|1×47e1-9e86-8a80-66e1,1×ee6b-763b-5885-19da","f909-00c7-8ba4-018a|1×38fb-1df5-8eb6-fdf6,1×38fb-1df5-8eb6-fdf6/44b0-1947-ea4a-3005,1×38fb-1df5-8eb6-fdf6/f20c-0563-3e0a-e0c8,2×8cbb-0e54-096a-e053,2×8cbb-0e54-096a-e053/6fd1-efa4-7787-db82,2×8cbb-0e54-096a-e053/a3b4-f330-4ed9-8314,1×8e1d-9846-a460-6002,7×b568-8a23-be6f-a14d,7×b568-8a23-be6f-a14d/2ba4-635b-fffd-0f59,7×b568-8a23-be6f-a14d/44b0-1947-ea4a-3005"],
    "princes/lord-on-juggernaut-khorne-berzerkers":["ec72-f024-4283-0558|1×1673-a61f-d5a2-b17c,1×4292-1471-4fd6-7dac,1×47e1-9e86-8a80-66e1,1×5b76-3e1c-8801-1e4b","f909-00c7-8ba4-018a|1×38fb-1df5-8eb6-fdf6,1×38fb-1df5-8eb6-fdf6/44b0-1947-ea4a-3005,1×38fb-1df5-8eb6-fdf6/f20c-0563-3e0a-e0c8,4×8cbb-0e54-096a-e053,4×8cbb-0e54-096a-e053/6fd1-efa4-7787-db82,4×8cbb-0e54-096a-e053/a3b4-f330-4ed9-8314,1×8e1d-9846-a460-6002,15×b568-8a23-be6f-a14d,15×b568-8a23-be6f-a14d/2ba4-635b-fffd-0f59,15×b568-8a23-be6f-a14d/44b0-1947-ea4a-3005"],
    "princes/slaughterbound-exalted-eightbound":["71c9-b10b-b55f-483e|1×33e2-4ee8-2e10-3e47,1×a085-ae61-1810-46d0","9932-3d2b-1e47-d53b|2×8719-8732-d0be-c527,2×8719-8732-d0be-c527/2307-58f3-bfa0-52a1,1×d009-9bd9-59a1-9119,1×d009-9bd9-59a1-9119/217a-9e22-3821-27e9"],
    "pubstomper/daemon-prince-of-tzeentch-with-wings":["66f4-929e-1769-f277|1×2313-45a2-28ff-c81a,1×7205-f4fe-f064-0edf,1×7213-a7b3-4c8e-96bc,1×ca9c-de3c-61e1-31"],
    "pubstomper/defiler":["f158-2979-c38b-65b5|1×636b-f3ef-1a09-d692,1×78be-1bfa-16ca-f674,2×b069-6851-b6a8-3026,1×c089-546a-0546-3537,2×c089-546a-0546-3537/0d87-7d7c-2a4a-7a09"],
    "pubstomper/exalted-sorcerer-rubric-marines":["c3a6-8fab-45f0-2d45|1×1150-7501-d526-d373,1×74f5-4553-6d71-b44c,1×a289-aacb-7152-e243,1×c70d-46dc-32da-b1a4,1×ce11-db3f-1373-27f7","5d3d-e13b-8b76-dad3|1×3cbf-631a-2bbe-6b54,1×3cbf-631a-2bbe-6b54/82ba-6095-1f1f-202d,1×3cbf-631a-2bbe-6b54/9ec7-baa9-ba0c-6a7,1×a453-2220-cdf7-ef10,1×a453-2220-cdf7-ef10/2e4b-dfab-27ef-87d9,1×a453-2220-cdf7-ef10/48de-a40a-2252-66c,1×a453-2220-cdf7-ef10/60c9-9f30-7dc8-2b63,3×b005-ca60-ce5b-89c7,3×b005-ca60-ce5b-89c7/2afa-364b-7daf-f95e,3×b005-ca60-ce5b-89c7/82ba-6095-1f1f-202d,1×d9f5-2270-b9b2-8060"],
    "pubstomper/magnus-the-red":["91dc-9aad-0505-52a8|1×9916-8701-bbbd-780e,1×a021-c1a0-c35c-f10f,1×b114-2c55-f1b6-6f98,1×d379-7bdd-e3f9-9183"],
    "pubstomper/sekhetar-robots":["fe4b-b3a4-69b7-3088|2×4ba8-dbf3-05f9-f868,2×4ba8-dbf3-05f9-f868/0dc4-725f-e51b-77f7,2×4ba8-dbf3-05f9-f868/ae78-f3d8-6cf0-6a89,2×4ba8-dbf3-05f9-f868/af48-0e3e-56f5-f5b1,2×4ba8-dbf3-05f9-f868/ce35-c6e4-d9cc-799c"],
    "pubstomper/sorcerer-in-terminator-armour-scarab-occult-terminators":["c6d1-e73b-9d26-5d8b|1×3811-a215-d4a1-d197,1×74f5-4553-6d71-b44c,1×9147-8824-3c93-86ed,1×c95f-7907-e078-7e21","b1cf-c5-5121-92a4|1×4aa5-24c5-89bc-7023,1×4aa5-24c5-89bc-7023/5d06-5a71-fde7-a641,1×4aa5-24c5-89bc-7023/9147-8824-3c93-86ed,1×4aa5-24c5-89bc-7023/f6b2-238a-4613-a59f,2×9cea-2e7-8711-11bf,7×a7ee-9112-4e83-bc2,7×a7ee-9112-4e83-bc2/7361-7d8a-dbfc-b6e8,7×a7ee-9112-4e83-bc2/e92-e1d4-babd-22b2,2×f0e4-fd2b-1ba8-7234,2×f0e4-fd2b-1ba8-7234/1fd1-28df-182d-bfcb,2×f0e4-fd2b-1ba8-7234/782c-e91c-5a17-27c4"],
    "pubstomper/tzaangor-enlightened-with-fatecaster-greatbows":["8b9f-917f-37c1-99c3|2×414e-b8ff-7132-48c7,2×414e-b8ff-7132-48c7/23a5-d6be-b617-1565,2×414e-b8ff-7132-48c7/8097-77df-1ed5-1e1a,1×6cc8-d237-eec9-d038,1×6cc8-d237-eec9-d038/23a5-d6be-b617-1565,1×6cc8-d237-eec9-d038/8097-77df-1ed5-1e1a"],
    "pubstomper/tzaangors":["f5b9-50c8-5c60-d8ea|1×1e68-75a-f434-7977,1×255b-146d-ca61-55fb,1×255b-146d-ca61-55fb/ee84-120d-a66b-0b72,9×5b9-7d59-48fd-b485,9×5b9-7d59-48fd-b485/a484-6a41-3648-bce1,1×a61b-434-6817-679a"],
    "purge-goes-the-foe/belisarius-cawl":["1f1e-2989-4762-cf88|1×0580-79ca-da98-77c3,1×238d-d584-47ee-856d,1×2f59-b41c-83be-4efe,1×4858-7bde-a8d4-e7da,1×665-8af3-4b52-8ac6"],
    "purge-goes-the-foe/cybernetica-datasmith-kastelan-robots":["d59d-ef1-9ef8-4f44|1×2b1f-798d-9bca-4ad9,1×666c-57c1-9f31-fd7d,1×e4da-4f2d-19c3-416b","bd6c-8683-8bc4-962d|4×20cf-5b7c-71d2-451d,4×20cf-5b7c-71d2-451d/2ce1-75b2-4291-586e,4×20cf-5b7c-71d2-451d/d92d-2a5e-3dd9-f60f"],
    "purge-goes-the-foe/ironstrider-ballistarii":["7efb-de37-79c4-cccb|3×8fc1-9168-5137-2b5d,3×8fc1-9168-5137-2b5d/a3ad-1621-c20a-7e3a,3×8fc1-9168-5137-2b5d/f09-36ce-d80d-1464"],
    "purge-goes-the-foe/ironstrider-ballistarii-2":["7efb-de37-79c4-cccb|3×2d5d-40b5-4ac8-cedc,3×2d5d-40b5-4ac8-cedc/5be8-d319-e2a9-8409,3×2d5d-40b5-4ac8-cedc/a3ad-1621-c20a-7e3a"],
    "purge-goes-the-foe/onager-dunecrawler":["ea05-4db7-9ee6-7a87|1×1aed-a297-70d2-78b4,1×407b-a252-25b0-0cf4,1×67d3-0a50-aa82-c444,1×eb85-7ead-6dee-f00f"],
    "purge-goes-the-foe/skitarii-rangers":["de59-f65c-181a-8509|1×22b3-9c84-0982-8627,1×22b3-9c84-0982-8627/2f1a-2fc7-2843-549d,1×22b3-9c84-0982-8627/882-910a-c7c4-13b2,1×626e-72e0-7869-82c1,1×626e-72e0-7869-82c1/2f1a-2fc7-2843-549d,1×626e-72e0-7869-82c1/3d89-dec1-eaa9-47f3,1×626e-72e0-7869-82c1/b7a3-bfbd-1464-141d,5×b27c-7f37-083e-9234,5×b27c-7f37-083e-9234/2f1a-2fc7-2843-549d,5×b27c-7f37-083e-9234/6483-eb5-46a4-ff63,1×b472-94bc-9482-44b6,1×b472-94bc-9482-44b6/2f1a-2fc7-2843-549d,1×b472-94bc-9482-44b6/ab93-64bd-1c95-c6a7,1×b93c-a0a7-1c46-66c4,1×b93c-a0a7-1c46-66c4/2f1a-2fc7-2843-549d,1×b93c-a0a7-1c46-66c4/a3ca-8ea1-d6de-8df2,1×e4b2-478b-a217-f999,1×e4b2-478b-a217-f999/2f1a-2fc7-2843-549d,1×e4b2-478b-a217-f999/5e8b-2f7f-6ef5-42e3,1×e4b2-478b-a217-f999/90fb-6049-048b-b4d2"],
    "purge-goes-the-foe/skorpius-disintegrator":["3fcc-b6a1-399b-1a29|1×1911-226b-90f1-d420,1×5059-e78f-c558-c8e8,3×88b0-793f-b85c-680b,1×eea3-949a-21d2-d33f"],
    "purge-goes-the-foe/tech-priest-enginseer":["c0e0-4d86-96d2-ec86|1×2b1f-798d-9bca-4ad9,1×81fb-325e-49fd-9a6f,1×a886-5b5b-d3b2-cf38,1×f209-cd62-f531-edc0"],
    "purge-goes-the-foe/thulia-ghuld":["7135-8430-eb02-ded4|1×914d-7966-28d3-85fd,1×b037-0e67-adac-8eb4"],
    "shooty/bigmek-mega":["95e9-6da3-5e75-2566|1×10f9-eb42-632e-3a6f,1×82cc-4b0b-8e55-bf48,1×e0c6-58cd-a822-8b84,1×f65e-dc30-e7c0-7e47"],
    "shooty/dakkarig-boosta":["78a7-cf35-aa8d-c420|1×47f0-7e05-a4aa-2cef,1×6feb-277f-7f31-504a,1×f3f0-a73b-d062-9dc6,1×f51b-ebb2-a713-b492"],
    "shooty/dakkarig-herder":["78a7-cf35-aa8d-c420|1×3924-3f8-745d-7097,1×47f0-7e05-a4aa-2cef,1×6feb-277f-7f31-504a,1×f51b-ebb2-a713-b492"],
    "shooty/deffkoptas":["2d6e-aa3b-c28c-5ef0|3×c0f6-1a61-c90f-f188,3×c0f6-1a61-c90f-f188/2575-9440-a8cf-1c50,3×c0f6-1a61-c90f-f188/7d49-39ac-d17e-63bf,3×c0f6-1a61-c90f-f188/89b1-3250-5148-c69f,3×c0f6-1a61-c90f-f188/d231-f7e4-f722-d987"],
    "shooty/gretchin":["de8f-24f9-c543-92b7|10×43dd-f974-3fc8-8abc,10×43dd-f974-3fc8-8abc/140d-7163-8a11-81c5,10×43dd-f974-3fc8-8abc/5cd1-cb47-fd8f-5704"],
    "shooty/killa-kans":["8c36-c946-2e0f-f648|6×f03b-8761-eac6-1405,6×f03b-8761-eac6-1405/3ea6-60b4-5fb0-b40f,6×f03b-8761-eac6-1405/d7b7-a7e-ef2-783a"],
    "shooty/mek-flashgitz":["3b2-8c11-616a-1005|1×1d21-9b32-c427-398e,1×c6e4-e5a5-d4be-d07c","1de9-b138-28a1-9c4b|1×217d-4d10-bad0-1d6e,9×65c-aa48-f306-465a,9×65c-aa48-f306-465a/8fca-90dd-a784-b5c0,9×65c-aa48-f306-465a/f606-38ce-2ada-4fbd,1×7d0f-67d3-25b-f6fe,1×7d0f-67d3-25b-f6fe/8fca-90dd-a784-b5c0,1×7d0f-67d3-25b-f6fe/f606-38ce-2ada-4fbd"],
    "shooty/mek-tankbustas":["3b2-8c11-616a-1005|1×1d21-9b32-c427-398e,1×c6e4-e5a5-d4be-d07c","dadc-d370-ef10-853c|1×3697-d01c-ebcd-835d,2×3697-d01c-ebcd-835d/7819-56c3-cf02-6cdb,1×3697-d01c-ebcd-835d/9707-82cf-9501-fb43,4×40b3-1364-acb9-c1eb,4×40b3-1364-acb9-c1eb/7819-56c3-cf02-6cdb,4×40b3-1364-acb9-c1eb/9707-82cf-9501-fb43,1×cdd4-c8f7-bc72-9af0,2×cdd4-c8f7-bc72-9af0/811f-e844-83ab-78a4,1×cdd4-c8f7-bc72-9af0/8fca-90dd-a784-b5c0"],
    "shooty/warboss":["2efc-c4b3-2ecc-5a37|1×8b5-898c-f79b-5a9c,1×8bba-d0bf-1102-2131,1×d034-cadd-41e5-dc21"],
    "shooty/wazdakka":["2ab7-ab71-0af4-5d39|1×5447-603b-27a0-7240,1×6739-941d-5e71-b461,1×c26c-fe9c-e557-e706,1×ef63-b27a-c026-19f2"],
    "standard/angron":["f4b8-1179-de57-4d69|1×3f1f-49de-78f6-e59e,1×9754-481c-c292-a1f9"],
    "standard/chaos-rhino":["e849-ce40-ee43-7623|1×9cc3-1188-9678-0ee1,1×f76c-0f51-ad33-c118"],
    "standard/eightbound":["9435-1f44-7e5b-d510|1×6f2c-fc26-53bc-34bd,1×6f2c-fc26-53bc-34bd/adff-65e7-4566-084b,2×7e60-1733-57d1-71f3,2×7e60-1733-57d1-71f3/f8bc-c08c-22f0-8ebb"],
    "standard/exalted-eightbound":["9932-3d2b-1e47-d53b|2×8719-8732-d0be-c527,2×8719-8732-d0be-c527/2307-58f3-bfa0-52a1,1×d009-9bd9-59a1-9119,1×d009-9bd9-59a1-9119/217a-9e22-3821-27e9"],
    "standard/forgefiend":["81e1-b212-69c1-308f|1×54ca-fec8-f0c6-2c77,1×54ca-fec8-f0c6-2c77/4b2a-4860-aed5-56b6,1×54ca-fec8-f0c6-2c77/a58b-974d-14a0-ece2,1×d877-3dd3-2d5a-e092,2×d877-3dd3-2d5a-e092/a343-07e9-e8f9-67f2"],
    "standard/goremongers":["b399-9b66-e550-8050|7×3a22-1796-8a64-6d3b,7×3a22-1796-8a64-6d3b/062f-464f-9cfe-5dce,7×3a22-1796-8a64-6d3b/81d1-50cc-2825-7475,7×3a22-1796-8a64-6d3b/f70d-d0cb-5cb8-3be9,1×f60b-c058-268e-5e87,1×f60b-c058-268e-5e87/062f-464f-9cfe-5dce,1×f60b-c058-268e-5e87/81d1-50cc-2825-7475,1×f60b-c058-268e-5e87/f70d-d0cb-5cb8-3be9"],
    "standard/jakhals":["6f81-4538-a414-251e|1×307d-0ce0-fcf0-9100,1×307d-0ce0-fcf0-9100/88ee-2f6b-0b00-0852,1×47af-ef6b-9d50-2c4a,1×47af-ef6b-9d50-2c4a/cde4-4b0b-0fa4-766e,1×47af-ef6b-9d50-2c4a/f70d-d0cb-5cb8-3be9,1×a93b-d0d4-9bfe-40c3,8×a93b-d0d4-9bfe-40c3/0620-25eb-4da2-5dae,8×a93b-d0d4-9bfe-40c3/0620-25eb-4da2-5dae/cde4-4b0b-0fa4-766e,8×a93b-d0d4-9bfe-40c3/0620-25eb-4da2-5dae/f70d-d0cb-5cb8-3be9"],
    "standard/kh-rn-the-betrayer-khorne-berzerkers":["3449-7dac-6ac8-5d51|1×47e1-9e86-8a80-66e1,1×ee6b-763b-5885-19da","f909-00c7-8ba4-018a|1×38fb-1df5-8eb6-fdf6,1×38fb-1df5-8eb6-fdf6/44b0-1947-ea4a-3005,1×38fb-1df5-8eb6-fdf6/f20c-0563-3e0a-e0c8,2×8cbb-0e54-096a-e053,2×8cbb-0e54-096a-e053/6fd1-efa4-7787-db82,2×8cbb-0e54-096a-e053/a3b4-f330-4ed9-8314,1×8e1d-9846-a460-6002,7×b568-8a23-be6f-a14d,7×b568-8a23-be6f-a14d/2ba4-635b-fffd-0f59,7×b568-8a23-be6f-a14d/44b0-1947-ea4a-3005"],
    "standard/lord-on-juggernaut":["ec72-f024-4283-0558|1×1673-a61f-d5a2-b17c,1×4292-1471-4fd6-7dac,1×47e1-9e86-8a80-66e1"],
    "standard/slaughterbound":["71c9-b10b-b55f-483e|1×a085-ae61-1810-46d0"],
    "standard/slaughterbound-exalted-eightbound":["71c9-b10b-b55f-483e|1×2c4c-5aac-b510-28ef,1×a085-ae61-1810-46d0","9932-3d2b-1e47-d53b|2×8719-8732-d0be-c527,2×8719-8732-d0be-c527/2307-58f3-bfa0-52a1,1×d009-9bd9-59a1-9119,1×d009-9bd9-59a1-9119/217a-9e22-3821-27e9"],
    "super-terminators/angron":["f4b8-1179-de57-4d69|1×3f1f-49de-78f6-e59e,1×9754-481c-c292-a1f9"],
    "super-terminators/chaos-terminators":["45f6-8429-a1d9-2a51|1×10f6-ffca-ae38-250e,1×10f6-ffca-ae38-250e/32bc-0724-a7cf-f17c,2×5f1f-f3bb-d6dd-6714,2×5f1f-f3bb-d6dd-6714/a1b4-80b4-e85e-96ec,2×5f1f-f3bb-d6dd-6714/f0b2-e942-6896-6acf,1×723d-aaaa-3268-09e3,1×723d-aaaa-3268-09e3/32bc-0724-a7cf-f17c,4×782f-6bfe-7238-960a,4×782f-6bfe-7238-960a/2d4d-9623-1cea-b73a,4×782f-6bfe-7238-960a/a1b4-80b4-e85e-96ec,2×b0b9-9511-44c1-b272,2×b0b9-9511-44c1-b272/2d4d-9623-1cea-b73a,2×b0b9-9511-44c1-b272/d2a3-be7e-4ec8-f9f6,1×ebfb-d2a4-5280-a6e6"],
    "super-terminators/chaos-terminators-2":["45f6-8429-a1d9-2a51|1×10f6-ffca-ae38-250e,1×10f6-ffca-ae38-250e/32bc-0724-a7cf-f17c,2×5f1f-f3bb-d6dd-6714,2×5f1f-f3bb-d6dd-6714/a1b4-80b4-e85e-96ec,2×5f1f-f3bb-d6dd-6714/f0b2-e942-6896-6acf,1×723d-aaaa-3268-09e3,1×723d-aaaa-3268-09e3/32bc-0724-a7cf-f17c,4×782f-6bfe-7238-960a,4×782f-6bfe-7238-960a/2d4d-9623-1cea-b73a,4×782f-6bfe-7238-960a/a1b4-80b4-e85e-96ec,2×b0b9-9511-44c1-b272,2×b0b9-9511-44c1-b272/2d4d-9623-1cea-b73a,2×b0b9-9511-44c1-b272/d2a3-be7e-4ec8-f9f6,1×ebfb-d2a4-5280-a6e6"],
    "super-terminators/eightbound":["9435-1f44-7e5b-d510|1×6f2c-fc26-53bc-34bd,1×6f2c-fc26-53bc-34bd/adff-65e7-4566-084b,2×7e60-1733-57d1-71f3,2×7e60-1733-57d1-71f3/f8bc-c08c-22f0-8ebb"],
    "super-terminators/forgefiend":["81e1-b212-69c1-308f|1×54ca-fec8-f0c6-2c77,1×54ca-fec8-f0c6-2c77/4b2a-4860-aed5-56b6,1×54ca-fec8-f0c6-2c77/a58b-974d-14a0-ece2,1×d877-3dd3-2d5a-e092,2×d877-3dd3-2d5a-e092/a343-07e9-e8f9-67f2"],
    "super-terminators/goremongers":["b399-9b66-e550-8050|7×3a22-1796-8a64-6d3b,7×3a22-1796-8a64-6d3b/062f-464f-9cfe-5dce,7×3a22-1796-8a64-6d3b/81d1-50cc-2825-7475,7×3a22-1796-8a64-6d3b/f70d-d0cb-5cb8-3be9,1×f60b-c058-268e-5e87,1×f60b-c058-268e-5e87/062f-464f-9cfe-5dce,1×f60b-c058-268e-5e87/81d1-50cc-2825-7475,1×f60b-c058-268e-5e87/f70d-d0cb-5cb8-3be9"],
    "super-terminators/jakhals":["6f81-4538-a414-251e|1×307d-0ce0-fcf0-9100,1×307d-0ce0-fcf0-9100/88ee-2f6b-0b00-0852,1×47af-ef6b-9d50-2c4a,1×47af-ef6b-9d50-2c4a/cde4-4b0b-0fa4-766e,1×47af-ef6b-9d50-2c4a/f70d-d0cb-5cb8-3be9,1×a93b-d0d4-9bfe-40c3,8×a93b-d0d4-9bfe-40c3/0620-25eb-4da2-5dae,8×a93b-d0d4-9bfe-40c3/0620-25eb-4da2-5dae/cde4-4b0b-0fa4-766e,8×a93b-d0d4-9bfe-40c3/0620-25eb-4da2-5dae/f70d-d0cb-5cb8-3be9"],
    "woof-woof/war-dog-brigand":["753d-4e02-eda3-4809|1×0b63-2988-ec78-7913,1×6638-278a-5331-d1ff,1×a30d-6752-d912-315e,1×b02a-a6e2-3eb4-4872,1×dfe8-cea0-8d16-db95"],
    "woof-woof/war-dog-brigand-2":["753d-4e02-eda3-4809|1×0b63-2988-ec78-7913,1×6638-278a-5331-d1ff,1×a30d-6752-d912-315e,1×dfe8-cea0-8d16-db95"],
    "woof-woof/war-dog-brigand-final-howl-aura":["753d-4e02-eda3-4809|1×0b63-2988-ec78-7913,1×3bee-8c85-68f7-e54b,1×42e1-e706-eb89-6cb6,1×6638-278a-5331-d1ff,1×a30d-6752-d912-315e,1×b02a-a6e2-3eb4-4872,1×dfe8-cea0-8d16-db95"],
    "woof-woof/war-dog-executioner":["8df0-fc3c-8ced-ffce|1×6638-278a-5331-d1ff,1×68b0-c798-79a8-28f5,2×7193-1dfe-7721-ecbd,1×dfe8-cea0-8d16-db95"],
    "woof-woof/war-dog-karnivore":["e96b-ac98-7fd2-a155|1×2a1d-e15f-408e-7660,1×dfe8-cea0-8d16-db95,1×efec-643e-117d-a977"],
    "woof-woof/war-dog-karnivore-panoply-of-the-cursed-knights":["e96b-ac98-7fd2-a155|1×2a1d-e15f-408e-7660,1×b02a-a6e2-3eb4-4872,1×dfe8-cea0-8d16-db95,1×efec-643e-117d-a977,1×fb26-6d89-aa65-fb7e"]
  },
  names:{
    "005c-b2d1-4432-415a":"Ruinspear rocket pod",
    "0119-8c04-435e-c782":"Knight Despoiler",
    "02c9-ea19-b105-af58":"Combi-bolter",
    "0567-0f45-90e8-d3f4":"Flawless Blade",
    "0574-f558-2957-584f":"Warlord",
    "0580-79ca-da98-77c3":"Warlord",
    "0620-25eb-4da2-5dae":"Jakhal",
    "062f-464f-9cfe-5dce":"Close combat weapon",
    "07b7-836e-524b-7227":"Gork's Klaw",
    "0955-1e48-ac34-156f":"Moonchewa",
    "0b63-2988-ec78-7913":"Daemonbreath spear",
    "0d87-7d7c-2a4a-7a09":"Excruciator cannon",
    "0dc4-725f-e51b-77f7":"Heavy warpflamer",
    "109a-db29-c4a5-f826":"Thump Gun",
    "10d8-d702-f556-5d3c":"Knight Destrier",
    "10f6-ffca-ae38-250e":"Paired accursed weapons",
    "10f9-eb42-632e-3a6f":"Supa-glowy Fing",
    "1150-7501-d526-d373":"Incandeum",
    "1187-f3db-ea97-bada":"Reaper chainsword",
    "1189-dcd8-e3ed-7837":"Spiculus bolt launcher",
    "131b-ff57-84bb-e87a":"Monstrous Nemesis",
    "13cd-5399-07f2-6d79":"Flesh Hound",
    "13f7-1a3-eff-7393":"The Swarmlord",
    "140d-7163-8a11-81c5":"Grot Blasta",
    "1673-a61f-d5a2-b17c":"Bladed horn",
    "167f-5eee-fb7b-a9a9":"Maulerfiend fists",
    "1703-3edd-5eb3-fcef":"Tzaangor Enlightened",
    "1705-379b-330d-36d4":"Tyrannofex",
    "1724-8c9c-c385-16c6":"Exalted Sorcerer on Disc of Tzeentch",
    "183e-f3bb-3ce6-7b55":"Flawless Blades",
    "190d-7321-6e85-5251":"Diamond of Distortion",
    "1911-226b-90f1-d420":"Disruptor missile launcher",
    "1a98-844f-f54b-f76c":"Baleful Devolution",
    "1aed-a297-70d2-78b4":"Cognis heavy stubber",
    "1b56-682c-ac33-bc5f":"Master of Executions",
    "1d21-9b32-c427-398e":"Kustom Mega-slugga",
    "1d6b-5a43-7bc9-18af":"Bellow of endless fury",
    "1de9-b138-28a1-9c4b":"Flash Gitz",
    "1e16-0387-abcf-0e9a":"Phoenix power spear",
    "1e27-a6de-3840-a050":"Knight Crusader",
    "1e68-75a-f434-7977":"Brayhorn",
    "1f1e-2989-4762-cf88":"Belisarius Cawl",
    "1fd1-28df-182d-bfcb":"Prosperine khopesh",
    "20cf-5b7c-71d2-451d":"Kastelan Robot",
    "217a-9e22-3821-27e9":"Chainblades",
    "217d-4d10-bad0-1d6e":"Supa-snazz Dakka",
    "22b3-9c84-0982-8627":"Skitarii Ranger w/ transuranic arquebus",
    "2307-58f3-bfa0-52a1":"Chainblades",
    "2313-45a2-28ff-c81a":"Infernal cannon",
    "238d-d584-47ee-856d":"Solar atomiser",
    "23a5-d6be-b617-1565":"Close combat weapon",
    "23ce-dba1-8242-532d":"Two excruciator cannons",
    "23e2-6d93-5012-304d":"Lash of Torment",
    "252b-cdba-84bd-3ed3":"Nob w/ Kustom Shoota and Kustom Krumpa",
    "255b-146d-ca61-55fb":"Twistbray",
    "2575-9440-a8cf-1c50":"Spinnin' Blades",
    "273-38fa-249e-3aa4":"Stormspear rocket pod",
    "27b4-53af-ee1b-688a":"Fleshmetal Fusion",
    "288c-1cbc-8340-9c0a":"Titanic feet",
    "2a06-5c5b-c129-27d7":"Obsessionist",
    "2a1d-e15f-408e-7660":"Slaughterclaw",
    "2ab7-ab71-0af4-5d39":"Wazdakka Gutsmek",
    "2ace-f88f-3405-d191":"Big Chompa's Jaws",
    "2aea-961-8345-fce5":"Diseased claws and teeth",
    "2afa-364b-7daf-f95e":"Warpflamer",
    "2b1f-798d-9bca-4ad9":"Mechanicus pistol",
    "2ba4-635b-fffd-0f59":"Bolt pistol",
    "2c4c-5aac-b510-28ef":"Berzerker Glaive",
    "2ca0-73ea-2725-79c7":"Ectoplasma destructor",
    "2ce1-75b2-4291-586e":"Incendine combustor",
    "2d4d-9623-1cea-b73a":"Combi-bolter",
    "2d5d-40b5-4ac8-cedc":"Ironstrider Ballistarius (Twin cognis autocannon)",
    "2d6e-aa3b-c28c-5ef0":"Deffkoptas",
    "2e4b-dfab-27ef-87d9":"Warpflame pistol",
    "2efc-c4b3-2ecc-5a37":"Warboss",
    "2f1a-2fc7-2843-549d":"Close combat weapon",
    "2f59-b41c-83be-4efe":"Arc scourge",
    "2fec-7b95-a5df-f688":"Gutrippa",
    "307d-0ce0-fcf0-9100":"Dishonoured w/ paired manglers",
    "32ab-c37c-b71f-8415":"Kombi-rokkit",
    "32bc-0724-a7cf-f17c":"Paired accursed weapons",
    "33e2-4ee8-2e10-3e47":"Battle-lust",
    "3449-7dac-6ac8-5d51":"Khârn the Betrayer",
    "3469-166f-44f3-51b8":"Bolt pistol",
    "34b5-f449-28f6-b365":"Heavy reaper autocannon",
    "3697-d01c-ebcd-835d":"Tankbusta w/ Two Busta Rokkit Launchas",
    "37a7-d156-1e4c-8fe1":"Cerastus Knight Atrapos",
    "3811-a215-d4a1-d197":"Umbralefic Crystal",
    "38fb-1df5-8eb6-fdf6":"Khorne Berzerker Champion",
    "3924-3f8-745d-7097":"Dreadherder",
    "392a-657c-8bfe-a1e6":"Kustom Krumpa",
    "3a22-1796-8a64-6d3b":"Goremonger w/ chainblade",
    "3b2-8c11-616a-1005":"Mek",
    "3bee-8c85-68f7-e54b":"Warlord",
    "3bfa-bf00-b5ed-cc81":"Ahriman",
    "3cbf-631a-2bbe-6b54":"Rubric Marine w/ soulreaper cannon",
    "3d5c-4127-b923-d579":"Boltgun",
    "3d89-dec1-eaa9-47f3":"Galvanic rifle",
    "3ded-7df8-ef3e-913a":"Chastiser gatling cannon",
    "3e4b-1a3a-8473-578c":"Hellforged weapons",
    "3e96-8098-3401-77af":"Hive Tyrant",
    "3ea6-60b4-5fb0-b40f":"Kan Blasta",
    "3ec3-a4df-fdbf-5507":"Prosecutor Squad",
    "3f1f-49de-78f6-e59e":"Samni'arius and Spinegrinder",
    "3f27-79c1-1aea-5be7":"Dual Fists and 2 Projectors",
    "3f41-4b71-a07b-506a":"Titanic feet",
    "3fcc-b6a1-399b-1a29":"Skorpius Disintegrator",
    "406-60ac-f728-9c6d":"Graviton singularity cannon",
    "407b-a252-25b0-0cf4":"Broad spectrum data-tether",
    "40b3-1364-acb9-c1eb":"Tankbusta w/ Busta Rokkit Launcha",
    "40c5-9ebd-6d42-2855":"Daemon Prince of Khorne",
    "40fb-e485-dca0-cb12":"Headwoppa's Killchoppa",
    "414e-b8ff-7132-48c7":"Enlightened",
    "4175-82c6-8e96-bef8":"Chaos Cerastus Knight Lancer",
    "4268-2d76-f972-d7f5":"Gatling cannon and flamer",
    "4287-4c82-30d5-bfaa":"Force stave",
    "4292-1471-4fd6-7dac":"Exalted chainblade",
    "42e1-e706-eb89-6cb6":"Final Howl (Aura)",
    "4325-5811-1915-3c15":"Mork's Roar",
    "43a9-66c5-ec02-baa9":"Questoris multi-laser",
    "43dd-f974-3fc8-8abc":"Gretchin",
    "441c-a2a8-59a4-85a4":"Meltagun",
    "4494-dd7d-69f7-306c":"Tormentors",
    "44b0-1947-ea4a-3005":"Chainblade",
    "44f2-27ca-fad5-70ad":"Curse of Life",
    "45f6-8429-a1d9-2a51":"Chaos Terminators",
    "4676-0c32-b62c-debd":"Knight Diabolus",
    "47af-ef6b-9d50-2c4a":"Jakhal Pack Leader",
    "47e1-9e86-8a80-66e1":"Plasma pistol",
    "47f0-7e05-a4aa-2cef":"Multi-busta Launcha",
    "484b-6da4-9390-33ae":"Deffkopta w/ Kustom mega-blasta",
    "4858-7bde-a8d4-e7da":"Cawl's Omnissian axe",
    "4863-f443-2b45-e18b":"Balistus grenade launcher",
    "48a2-a603-9607-4df8":"Gatling cannon and flamer",
    "48de-a40a-2252-66c":"Force weapon",
    "4988-d93e-5034-2b3c":"Contemptor-Galatus Dreadnought",
    "4aa5-24c5-89bc-7023":"Scarab Occult Sorcerer",
    "4ad2-bd20-6dfe-776b":"Bloodthirster",
    "4b2a-4860-aed5-56b6":"Forgefiend claws",
    "4ba8-dbf3-05f9-f868":"Sekhetar Robot w/ pyreflux meltagun",
    "4dcd-5d7f-65c2-245b":"Squigosaur's jaws",
    "4ea0-6b70-c17c-bc00":"Ghazghkull Thraka",
    "4fc1-2679-a110-3cd":"Avenger gatling cannon",
    "4ff3-7dce-5a52-94e9":"Bestial Aspect",
    "503b-f7be-eeeb-9e31":"Witchseeker Squad",
    "5059-e78f-c558-c8e8":"Ferrumite cannon",
    "50f3-6a18-bc71-2a59":"Toxinjecter harpoon",
    "5447-603b-27a0-7240":"Psyko-gatler",
    "545a-eead-e216-5939":"Cerastus shock lance",
    "54ca-fec8-f0c6-2c77":"Ectoplasma cannon and claws",
    "5514-3810-cf3e-3b23":"Memento Moritoi",
    "55fb-9c91-1a4f-3037":"Canis Rex",
    "5622-c756-d3e8-85ae":"Watcher's Axe",
    "570a-6d55-51ee-9fc7":"Transmogrifying Blast",
    "5720-2873-8c2c-edc3":"Norn Emissary",
    "58f8-dd4e-bb8f-f357":"Cerastus shock lance",
    "59a4-4504-cb52-93b1":"Monstrous scything talons",
    "59ef-1bf3-f681-c8ae":"Vexilla",
    "5b76-3e1c-8801-1e4b":"Archslaughterer",
    "5b9-7d59-48fd-b485":"Tzaangor w/ Tzaangor blades",
    "5be8-d319-e2a9-8409":"Twin cognis autocannon",
    "5cd1-cb47-fd8f-5704":"Scavenged Shivs",
    "5d06-5a71-fde7-a641":"Force weapon",
    "5d3d-e13b-8b76-dad3":"Rubric Marines",
    "5e02-c4ce-b7e6-d59":"Stinger salvoes",
    "5e8b-2f7f-6ef5-42e3":"Alpha combat weapon",
    "5efb-f61f-fdb6-a7d7":"Stikka",
    "5f1f-f3bb-d6dd-6714":"Heavy weapon",
    "6084-9fb5-76d2-8487":"Beastchoppa",
    "60c9-9f30-7dc8-2b63":"Malefic Curse",
    "6105-a18c-fcd1-a9da":"Axe of dismemberment",
    "626e-72e0-7869-82c1":"Skitarii Ranger w/ omnispex",
    "62a1-1fa7-70b7-614d":"Twin Lastrum Bolt Cannon",
    "636b-f3ef-1a09-d692":"Shearing claws",
    "6445-6811-f628-9750":"Adrathic Desolator",
    "646c-5f7f-cd1c-d5c9":"Questoris heavy stubber",
    "6483-eb5-46a4-ff63":"Galvanic rifle",
    "656c-8b78-8e59-0591":"Maulerfiend",
    "65c-aa48-f306-465a":"Flash Gitz",
    "65d0-a5c5-919a-6444":"Chitinous claws and teeth",
    "661a-207c-a66d-8da0":"Armoured tracks",
    "6633-5a38-bd55-b080":"Prosperine khopesh",
    "6638-278a-5331-d1ff":"Armoured feet",
    "665-8af3-4b52-8ac6":"Mechadendrite hive",
    "666c-57c1-9f31-fd7d":"Power fist",
    "66f4-929e-1769-f277":"Daemon Prince of Tzeentch with wings",
    "6739-941d-5e71-b461":"Speeding Bulk and Flaming Exhaust",
    "673b-c3e-6682-ae28":"Drilla",
    "67d3-0a50-aa82-c444":"Twin Onager heavy phosphor blaster",
    "6814-ce42-4b23-72a9":"Prosecutor",
    "6836-5818-2135-a8aa":"Helm of Brazen Ire",
    "68b0-c798-79a8-28f5":"Snarling Rivalry",
    "6a83-8e1f-63ef-50c3":"Squighog Boyz",
    "6a9b-8e2f-edac-fa2d":"Norn Assimilator",
    "6ab9-df1b-b1fb-8d20":"Duelling sabre",
    "6b9e-c6ae-2626-45c9":"Kustom Force Field",
    "6cc8-d237-eec9-d038":"Aviarch",
    "6d28-ca9d-79a5-063a":"Disciple of Khorne",
    "6f2c-fc26-53bc-34bd":"Eightbound Champion",
    "6f81-4538-a414-251e":"Jakhals",
    "6fd1-efa4-7787-db82":"Plasma pistol",
    "6feb-277f-7f31-504a":"Stompy Feet",
    "7067-34f4-5272-e05f":"Meganobz",
    "70b4-8523-6b7c-1b0a":"Freedom's Hand",
    "7135-8430-eb02-ded4":"Thulia Ghuld",
    "7193-1dfe-7721-ecbd":"War Dog autocannon",
    "71c9-b10b-b55f-483e":"Slaughterbound",
    "71d9-9dc2-2b9a-6db3":"Skarbrand",
    "7205-f4fe-f064-0edf":"Dark Blessing",
    "7212-7cc9-ec49-72b8":"Nurgling Swarm",
    "7213-a7b3-4c8e-96bc":"Eldritch Vortex of E'taph",
    "723d-aaaa-3268-09e3":"Terminator Champion",
    "72c5-8bd0-19f5-f246":"Caestus Fist",
    "731f-2f2-7ca0-23ed":"Meganob w/ Twin Killsaw",
    "7361-7d8a-dbfc-b6e8":"Prosperine khopesh",
    "73e9-498e-2d97-e18":"Atrapos lascutter",
    "74f5-4553-6d71-b44c":"Force weapon",
    "753d-4e02-eda3-4809":"War Dog Brigand",
    "7546-5742-581c-9e8b":"Graviton singularity cannon",
    "75ce-5ce7-0a6e-a876":"Blade of Endless Bloodshed",
    "7669-1442-2c0b-e0c9":"Painboy",
    "7695-54a2-f38b-a89c":"Havoc launcher",
    "77b6-41ee-7952-e94d":"Gun Stock",
    "7819-56c3-cf02-6cdb":"Busta Rokkit Launcha",
    "782c-e91c-5a17-27c4":"Soulreaper cannon",
    "782f-6bfe-7238-960a":"Combi-bolter, power fist",
    "78a7-cf35-aa8d-c420":"Big Mek Dakkarig",
    "78be-1bfa-16ca-f674":"Ectoplasma destructor",
    "78e7-69eb-d93a-2b00":"Slaughter and Carnage",
    "7a17-4fb0-c0f5-e22":"Bone Sabres",
    "7b41-35aa-3265-14d7":"Augury Uplink",
    "7b4c-dfe0-6a0a-304a":"Lord Exultant",
    "7b4e-03d3-6b3f-6c48":"Divining spear",
    "7d0f-67d3-25b-f6fe":"Kaptin",
    "7d49-39ac-d17e-63bf":"Rokkit Launcha",
    "7d7c-c212-47a3-38e4":"Trajann Valoris",
    "7dfc-efc5-a31c-a724":"Da Grabzappa",
    "7e60-1733-57d1-71f3":"Eightbound",
    "7ebd-c3dc-8467-70ae":"Aviarch",
    "7efb-de37-79c4-cccb":"Ironstrider Ballistarii",
    "7f5-23ea-19ab-176":"Adamantine 'Eadbutt",
    "8097-77df-1ed5-1e1a":"Fatecaster greatbow",
    "80c4-14b2-d02d-d289":"Nazdreg",
    "811f-e844-83ab-78a4":"Rokkit Pistol",
    "819a-63a5-f90c-7794":"Great axe of Khorne",
    "81d1-50cc-2825-7475":"Chainblade",
    "81e1-b212-69c1-308f":"Forgefiend",
    "81fb-325e-49fd-9a6f":"Servo arm",
    "82ba-6095-1f1f-202d":"Close combat weapon",
    "82cc-4b0b-8e55-bf48":"Tellyport Blasta",
    "8441-8356-5e7c-69ee":"Knight Paladin",
    "8488-2efe-825f-a403":"Neurogaunt Nodebeast",
    "84c0-f59d-901a-e94f":"Canis Rex",
    "8555-148a-0e35-4749":"Adrathic Desolator, 1 Fist and 1 Projectors",
    "86c9-46db-4de-4a5d":"Thermal cannon",
    "8719-8732-d0be-c527":"Exalted Eightbound",
    "882-910a-c7c4-13b2":"Transuranic arquebus",
    "88b0-793f-b85c-680b":"Cognis heavy stubber",
    "88ee-2f6b-0b00-0852":"Paired manglers",
    "89b1-3250-5148-c69f":"Choppa",
    "89c4-132e-6ad6-2a08":"Despoiler gatling cannon",
    "8a59-c996-8ae9-8bd6":"Icon of Excess",
    "8a8f-5ceb-8a0a-6c6c":"Saddlegit's Shiv",
    "8ae1-aa47-e1d1-1b31":"Chaos Rhino",
    "8b1d-9029-f9e1-42d9":"Chaos Cerastus Knight Atrapos",
    "8b5-898c-f79b-5a9c":"Warlord",
    "8b9f-917f-37c1-99c3":"Tzaangor Enlightened with Fatecaster greatbows",
    "8ba4-a299-ac96-fbc5":"Extra Sneaky",
    "8bba-d0bf-1102-2131":"Kustom Shoota",
    "8c36-c946-2e0f-f648":"Killa Kans",
    "8cbb-0e54-096a-e053":"Khorne Berzerker w/ eviscerator and plasma pistol",
    "8ccc-3f27-7e4e-da81":"Neurogaunts",
    "8dc7-bea2-997b-a1c9":"Dual Caestus Fists",
    "8df0-fc3c-8ced-ffce":"War Dog Executioner",
    "8e1d-9846-a460-6002":"Icon of Khorne",
    "8fc1-9168-5137-2b5d":"Ironstrider Ballistarius (Twin cognis lascannon)",
    "8fca-90dd-a784-b5c0":"Choppa",
    "8ff6-03ed-5125-9b6d":"Boltgun",
    "9064-698b-c833-b972":"Hellfire breath",
    "90fb-6049-048b-b4d2":"Galvanic rifle",
    "9147-8824-3c93-86ed":"Inferno combi-bolter",
    "914d-7966-28d3-85fd":"Jericho-class conversion resonator",
    "91dc-9aad-0505-52a8":"Magnus the Red",
    "93c3-d64f-2d6e-ea":"Questoris heavy stubber",
    "93c8-9c05-8892-b481":"Black Staff of Ahriman",
    "9435-1f44-7e5b-d510":"Eightbound",
    "94b3-ef7f-f71f-c86e":"Castellan Axe",
    "954d-5938-64d8-597c":"Squighog Boy",
    "95e9-6da3-5e75-2566":"Big Mek in Mega Armour",
    "96d6-846e-edd3-332f":"'Urty syringe",
    "9707-82cf-9501-fb43":"Gitstikka",
    "9754-481c-c292-a1f9":"Warlord",
    "9916-8701-bbbd-780e":"Blade of Magnus",
    "9932-3d2b-1e47-d53b":"Exalted Eightbound",
    "996-bd56-400b-a51e":"Divining spear Enlightened",
    "99c8-e37d-ae6d-a8ba":"Nob on Smasha Squig",
    "9a9f-3dab-02c0-8be7":"Paired Krumpas",
    "9ad3-083a-577b-56b0":"Hellforged weapons",
    "9cc3-1188-9678-0ee1":"Combi-bolter",
    "9cea-2e7-8711-11bf":"Hellfyre missile rack",
    "9e94-b7d4-ec7f-9163":"Terrorpulse missiles",
    "9ec7-baa9-ba0c-6a7":"Soulreaper cannon",
    "9ee-e289-bc6c-d943":"Cerastus Knight Lancer",
    "9ef8-1cb6-2f19-cc1b":"2 magma cutters",
    "9efd-ec72-353f-4b23":"Knight Errant",
    "9f43-3691-5be1-8623":"Twin Neutronium Cascade Projectors",
    "9fdd-e31a-5f28-85ea":"Witchseeker",
    "a021-c1a0-c35c-f10f":"Warlord",
    "a05e-db63-84ad-4c5e":"Rapid-fire battlecannon and Questoris heavy stubber",
    "a085-ae61-1810-46d0":"Lacerator and daemonic claw",
    "a0d5-2805-f05a-29e1":"Gore Hound",
    "a1b4-80b4-e85e-96ec":"Power fist",
    "a287-990-9f34-9836":"Warblade",
    "a289-aacb-7152-e243":"Astral Blast",
    "a30-4bad-cef5-5e55":"Synaptic Pulse",
    "a30d-6752-d912-315e":"Avenger chaincannon",
    "a336-1346-0281-b4b2":"Destabilising Predation",
    "a343-07e9-e8f9-67f2":"Hades autocannon",
    "a3ad-1621-c20a-7e3a":"Ironstrider feet",
    "a3b4-f330-4ed9-8314":"Khornate eviscerator",
    "a3ca-8ea1-d6de-8df2":"Arc rifle",
    "a41b-81a0-ca89-75c1":"Sir Hekhtur",
    "a453-2220-cdf7-ef10":"Aspiring Sorcerer",
    "a484-6a41-3648-bce1":"Tzaangor blades",
    "a58b-974d-14a0-ece2":"Ectoplasma cannon",
    "a61b-434-6817-679a":"Herd banner",
    "a7ee-9112-4e83-bc2":"Scarab Occult Terminator",
    "a87e-4f8-a6f7-15de":"Powerful limbs",
    "a886-5b5b-d3b2-cf38":"Necromechanic",
    "a8b7-351-d911-a4d6":"Beastboss on Squigosaur",
    "a93b-d0d4-9bfe-40c3":"8 chainblades",
    "a998-39ce-f312-129":"Neurogaunt",
    "aa3c-6662-6bf0-6a7e":"Runtherd's Toolz",
    "aac1-5b0f-4802-1628":"Arcane Fire",
    "ab80-e71b-5a84-2852":"Close combat weapon",
    "ab93-64bd-1c95-c6a7":"Plasma caliver",
    "ad65-d3cb-c677-7cb3":"Warlord",
    "adff-65e7-4566-084b":"Chainblades",
    "ae78-f3d8-6cf0-6a89":"Hellfyre missile rack",
    "aecd-6ba5-5558-fee2":"Big Choppa",
    "af48-0e3e-56f5-f5b1":"Close combat weapon",
    "b005-ca60-ce5b-89c7":"Rubric Marine w/ warpflamer",
    "b02a-a6e2-3eb4-4872":"Houndpack Lance Character",
    "b037-0e67-adac-8eb4":"Rod of the War Forge",
    "b069-6851-b6a8-3026":"Heavy reaper autocannon",
    "b0b9-9511-44c1-b272":"Combi-bolter, chainfist",
    "b114-2c55-f1b6-6f98":"Tzeentch's Firestorm",
    "b16a-7132-3f8a-abe5":"Nobz",
    "b1cf-c5-5121-92a4":"Scarab Occult Terminators",
    "b1eb-9d70-dfc2-208b":"Dreadspear",
    "b27b-4fee-2644-a355":"Kustom Blasta X",
    "b27c-7f37-083e-9234":"Skitarii Ranger w/ galvanic rifle",
    "b330-bad6-ea21-ecb":"Eagle's Scream",
    "b399-9b66-e550-8050":"Goremongers",
    "b42b-ea0-38f1-6300":"Mozrog Skragbad",
    "b464-6a59-916f-c9d9":"Infernal cannon",
    "b46a-4885-3b28-428b":"Twin Killsaw",
    "b472-94bc-9482-44b6":"Skitarii Ranger w/ plasma caliver",
    "b4ca-3419-c219-f429":"Darkflame lance",
    "b541-3292-a5cc-dbeb":"Defiler",
    "b568-8a23-be6f-a14d":"Khorne Berzerker",
    "b59f-e25b-6248-8f90":"Obsessionist",
    "b657-1743-6e3a-0838":"Flesh Hounds",
    "b717-8754-263b-3a20":"Meltagun",
    "b74a-d992-b5eb-23ff":"Close combat weapon",
    "b77f-43c5-91b6-7da7":"Shearing claws",
    "b7a3-bfbd-1464-141d":"Omnispex",
    "b93c-a0a7-1c46-66c4":"Skitarii Ranger w/ arc rifle",
    "bd01-88b9-7d60-b49a":"Excruciator cannon",
    "bd33-fe8e-fe90-2bb7":"Magma cutter",
    "bd6c-8683-8bc4-962d":"Kastelan Robots",
    "c089-546a-0546-3537":"Two excruciator cannons",
    "c0a2-eb65-6d34-5bc6":"Knight Ruinator",
    "c0e0-4d86-96d2-ec86":"Tech-Priest Enginseer",
    "c0f6-1a61-c90f-f188":"Deffkopta",
    "c102-d98b-dc50-5b53":"Psychic tendril",
    "c1a7-616a-af3a-cdf9":"Squigstoppa",
    "c1d2-2cf5-b6bd-17fc":"Icon of Excess",
    "c214-c491-ef49-04ec":"Burning roar",
    "c251-bd54-441-4799":"Tzaangor Shaman",
    "c26c-fe9c-e557-e706":"Grabba Dragga",
    "c3a6-8fab-45f0-2d45":"Exalted Sorcerer",
    "c41d-61c0-3e59-01b5":"Bolt pistol",
    "c609-c87e-f9dd-5006":"Knight Warden",
    "c62a-bc9c-37fb-2b36":"Titanic feet",
    "c6a8-0dbc-ab1b-38b5":"Tormentor w/ meltagun",
    "c6d1-e73b-9d26-5d8b":"Sorcerer in Terminator Armour",
    "c6e4-e5a5-d4be-d07c":"Mek's Toolz",
    "c70d-46dc-32da-b1a4":"Inferno bolt pistol",
    "c799-77ce-c706-3079":"Blasphemous Engine",
    "c7a7-3164-12bc-3462":"Warlord",
    "c7e3-601f-3442-250b":"Collar of Khorne",
    "c84c-683a-79be-1620":"Flowing Flesh",
    "c8a6-a4c5-703e-b717":"Allarus Custodians",
    "c95f-7907-e078-7e21":"Gaze of Hate",
    "ca02-db54-10e6-f20e":"Heavy flamer",
    "ca9c-de3c-61e1-31":"Hellforged weapons",
    "cb31-e496-08de-77d4":"Sanctuary",
    "cc5a-e1bc-3dd8-f367":"Bringer of Justice",
    "cd60-e6ca-4de4-bf07":"Blade of the Laer",
    "cdad-e2e0-9db3-93fc":"Meganob w/ Kombi-weapon and Power Klaw",
    "cdd4-c8f7-bc72-9af0":"Nob",
    "cde4-4b0b-0fa4-766e":"Chainblades",
    "ce11-db3f-1373-27f7":"Prosperine khopesh",
    "ce35-c6e4-d9cc-799c":"Pyreflux meltagun",
    "ce45-db08-3795-18a9":"Zodgrod Wortsnagga",
    "ce61-585b-aea7-18fc":"Kombi-weapon",
    "ceab-62d9-31bf-7c61":"Warlord",
    "cff4-311e-b386-0879":"Nob w/ Kustom Krumpa and Paired Krumpas",
    "d009-9bd9-59a1-9119":"Exalted Eightbound Champion",
    "d034-cadd-41e5-dc21":"Kustom Choppa",
    "d0cf-a582-5166-fbba":"Monstrous scything talons",
    "d137-294e-49d2-53a9":"Kustom Mega-blasta",
    "d231-f7e4-f722-d987":"Slugga",
    "d2a3-be7e-4ec8-f9f6":"Chainfist",
    "d379-7bdd-e3f9-9183":"Gaze of Magnus",
    "d40a-c9a6-74d5-288d":"Synaptoprescience",
    "d59d-ef1-9ef8-4f44":"Cybernetica Datasmith",
    "d5fe-026f-1f46-e9c5":"Close combat weapon",
    "d6c0-4d42-c3c4-db8a":"Rapid-fire battle cannon",
    "d7b3-df20-933-63b7":"Monstrous rending claws",
    "d7b7-a7e-ef2-783a":"Kan Klaw",
    "d813-7c6b-1dfe-e99a":"Tormentor",
    "d877-3dd3-2d5a-e092":"2 Hades autocannons",
    "d92d-2a5e-3dd9-f60f":"Twin Kastelan fist",
    "d9a6-8dbd-2c01-862b":"Lastrum storm bolter",
    "d9ca-c6b0-ba9c-b6c8":"Arachnus Blaze Carronade",
    "d9f5-2270-b9b2-8060":"Icon of Flame",
    "dadc-d370-ef10-853c":"Tankbustas",
    "db3b-02cd-87a2-3b52":"Contemptor-Achillus Dreadnought",
    "dbf0-5211-463c-40ec":"Caladius Annihilator Grav-tank",
    "dc69-1094-613-6daf":"Monstrous scything talons",
    "dca3-638e-52a2-b1b8":"Armoured hull",
    "dd8d-1bc7-029f-3674":"Gore-drenched fangs",
    "de59-f65c-181a-8509":"Skitarii Rangers",
    "de8f-24f9-c543-92b7":"Gretchin",
    "df3a-0414-6edc-005a":"Kustom mega-blasta",
    "dfe8-cea0-8d16-db95":"Diabolus heavy stubber",
    "e083-787f-1fff-4170":"Dok's Toolz",
    "e0c6-58cd-a822-8b84":"Kustom Mega-blasta",
    "e13a-503d-72dc-f4ed":"Plasma pistol",
    "e201-253f-1f52-e389":"Kunnin' But Brutal",
    "e390-b58b-db9-816":"Lucius the Eternal",
    "e403-3a9-279e-41b7":"Nurglings",
    "e452-08be-33e6-3864":"Daemon Prince of Slaanesh with Wings",
    "e456-0afc-9b42-226c":"Infractors",
    "e4b1-2a15-2843-283a":"Nob w/ Kombi-rokkit and Kustom Krumpa",
    "e4b2-478b-a217-f999":"Skitarii Ranger Alpha",
    "e4da-4f2d-19c3-416b":"Martial Signatum Amplificator",
    "e584-f803-7858-05bc":"Hunter's Eye",
    "e7d8-1c73-7d03-8b62":"Telemon Heavy Dreadnought",
    "e849-ce40-ee43-7623":"Chaos Rhino",
    "e8b4-ffab-1b5c-d2a0":"Hekhtur's pistol",
    "e92-e1d4-babd-22b2":"Inferno combi-bolter",
    "e96b-ac98-7fd2-a155":"War Dog Karnivore",
    "ea05-4db7-9ee6-7a87":"Onager Dunecrawler",
    "ea82-9845-1b96-c57c":"Infractor",
    "ea86-f483-33bb-182b":"Power sword",
    "eb85-7ead-6dee-f00f":"Dunecrawler legs",
    "ebfb-d2a4-5280-a6e6":"Gore-stained Veterans",
    "ec72-f024-4283-0558":"Lord on Juggernaut",
    "ed0c-e9cb-399f-a5a2":"Follow Me Ladz",
    "eddd-9b27-00c2-b0ce":"Blood-forged Armour",
    "ee6b-763b-5885-19da":"Gorechild",
    "ee84-120d-a66b-0b72":"Tzaangor blades",
    "eea3-949a-21d2-d33f":"Armoured hull",
    "eedf-6059-a15-3c86":"Questoris heavy stubber",
    "ef63-b27a-c026-19f2":"Fixit's Wrench",
    "efec-643e-117d-a977":"Reaper chaintalon",
    "effb-d65d-a1b1-51d6":"Monstrous bonesword and lash whip",
    "f03b-8761-eac6-1405":"Killa Kan",
    "f048-127d-0e0b-2279":"Blissblade",
    "f075-4ccc-9a91-5e6d":"Fellbore",
    "f09-36ce-d80d-1464":"Twin cognis lascannon",
    "f0b2-e942-6896-6acf":"Reaper autocannon",
    "f0e4-fd2b-1ba8-7234":"Scarab Occult Terminator w/ soulreaper cannon",
    "f12b-b113-de8a-4f1e":"Flamer",
    "f132-71e1-81e2-5074":"Infernal cannon",
    "f158-2979-c38b-65b5":"Defiler",
    "f1aa-b2e0-2fa8-4c39":"Las-impulsor",
    "f1b5-b55a-e18b-fe84":"Rapture lash",
    "f209-cd62-f531-edc0":"Omnissian axe",
    "f20c-0563-3e0a-e0c8":"Plasma pistol",
    "f3f0-a73b-d062-9dc6":"Cybork Boosta",
    "f401-c74a-cca8-5de3":"Runtherd",
    "f4a1-7f17-ec57-6c69":"Heavy darkflamer",
    "f4b8-1179-de57-4d69":"Angron",
    "f51b-ebb2-a713-b492":"Blitzkannon",
    "f57d-be6e-77e4-bfe3":"Atrapos lascutter",
    "f5b9-50c8-5c60-d8ea":"Tzaangors",
    "f606-38ce-2ada-4fbd":"Snazzgun",
    "f60b-c058-268e-5e87":"Blood Herald",
    "f64-8faa-ac54-73ff":"Acid spray",
    "f65e-dc30-e7c0-7e47":"Power Klaw",
    "f6b2-238a-4613-a59f":"Malefic Curse",
    "f70d-d0cb-5cb8-3be9":"Autopistol",
    "f76c-0f51-ad33-c118":"Armoured tracks",
    "f8bc-c08c-22f0-8ebb":"Chainblades",
    "f909-00c7-8ba4-018a":"Khorne Berzerkers",
    "fa30-43a8-57eb-a82e":"Squig Jaws",
    "fab4-d437-6e07-eb33":"Allarus Custodian",
    "fb26-6d89-aa65-fb7e":"Panoply of the Cursed Knights",
    "fbee-427a-1c46-f621":"Big Mek",
    "fc2d-063a-a9fa-968f":"Frag bombard",
    "fe4b-b3a4-69b7-3088":"Sekhetar Robots"
  },
  maxPerList:{
    "10f9-eb42-632e-3a6f":1,
    "1150-7501-d526-d373":1,
    "131b-ff57-84bb-e87a":1,
    "13f7-1a3-eff-7393":1,
    "190d-7321-6e85-5251":1,
    "1f1e-2989-4762-cf88":1,
    "217d-4d10-bad0-1d6e":3,
    "27b4-53af-ee1b-688a":1,
    "2ab7-ab71-0af4-5d39":1,
    "2c4c-5aac-b510-28ef":1,
    "33e2-4ee8-2e10-3e47":1,
    "3449-7dac-6ac8-5d51":1,
    "3811-a215-d4a1-d197":1,
    "3924-3f8-745d-7097":1,
    "3bfa-bf00-b5ed-cc81":1,
    "40fb-e485-dca0-cb12":1,
    "42e1-e706-eb89-6cb6":1,
    "44f2-27ca-fad5-70ad":1,
    "4676-0c32-b62c-debd":1,
    "4ea0-6b70-c17c-bc00":1,
    "4ff3-7dce-5a52-94e9":1,
    "5514-3810-cf3e-3b23":1,
    "55fb-9c91-1a4f-3037":1,
    "5b76-3e1c-8801-1e4b":1,
    "6836-5818-2135-a8aa":1,
    "68b0-c798-79a8-28f5":3,
    "6d28-ca9d-79a5-063a":1,
    "7135-8430-eb02-ded4":1,
    "71d9-9dc2-2b9a-6db3":1,
    "7213-a7b3-4c8e-96bc":1,
    "75ce-5ce7-0a6e-a876":1,
    "7b41-35aa-3265-14d7":1,
    "7d7c-c212-47a3-38e4":1,
    "80c4-14b2-d02d-d289":1,
    "8ba4-a299-ac96-fbc5":3,
    "91dc-9aad-0505-52a8":1,
    "a336-1346-0281-b4b2":3,
    "a886-5b5b-d3b2-cf38":1,
    "b02a-a6e2-3eb4-4872":3,
    "b42b-ea0-38f1-6300":1,
    "c799-77ce-c706-3079":1,
    "c84c-683a-79be-1620":1,
    "cb31-e496-08de-77d4":1,
    "cc5a-e1bc-3dd8-f367":1,
    "ce45-db08-3795-18a9":1,
    "d40a-c9a6-74d5-288d":3,
    "e201-253f-1f52-e389":1,
    "e390-b58b-db9-816":1,
    "e4da-4f2d-19c3-416b":1,
    "e584-f803-7858-05bc":1,
    "ebfb-d2a4-5280-a6e6":3,
    "ed0c-e9cb-399f-a5a2":1,
    "eddd-9b27-00c2-b0ce":1,
    "f3f0-a73b-d062-9dc6":1,
    "f4b8-1179-de57-4d69":1,
    "fb26-6d89-aa65-fb7e":1
  }
};
// ---- end of BS_IDS ----

// ---- RULE_OPTIONS, GRANTS: written by verify/tables.js --write from verify/derive.js (do not edit) ----
// RULE_OPTIONS: the options inside a rule or ability (Blessings of Khorne's, Try Dat Button!'s), each with the phases its
// text gives: trigger (when it is used) and used (where its effect is used); phases = both. GRANTS: a rule or option giving
// units an ability or keyword ("BLOOD LEGIONS units from your army gain the Blessings of Khorne ability"), to whom (needs) and
// while what. Derived from the words by verify/derive.js's rule tables; derive.js checks them against the words every run.
const RULE_OPTIONS = [
  { rule:'Orks · Dread Mob rule · Try Dat Button!', option:'1–2', text:'+1 **A**', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' } }, used:null, phases:{ ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' } } },
  { rule:'Orks · Dread Mob rule · Try Dat Button!', option:'3–4', text:'+2 **S**', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' } }, used:null, phases:{ ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' } } },
  { rule:'Orks · Dread Mob rule · Try Dat Button!', option:'5–6', text:'+1 **AP**', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' } }, used:null, phases:{ ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' } } },
  { rule:'Imperial Knights army rule · Code Chivalric', option:'Deed 1–2', text:'At the start of the battle, select one **CHARACTER** model in your opponent’s army. This Deed is completed at the end of a turn if that **CHARACTER** is destroyed.', found:'table row', explicit:false, trigger:null, used:null, phases:null },
  { rule:'Imperial Knights army rule · Code Chivalric', option:'Deed 3–4', text:'This deed is completed at the end of your opponent’s turn if you control more objective markers than your opponent.', found:'table row', explicit:false, trigger:null, used:null, phases:null },
  { rule:'Imperial Knights army rule · Code Chivalric', option:'Deed 5–6', text:'This deed is completed at the end of the battle round if the number of enemy units destroyed this battle round is greater than the battle round number even if those units are subsequently returned to the battlefield (for example, two destroyed enemy units in the first battle round).', found:'table row', explicit:false, trigger:null, used:null, phases:null },
  { rule:'Imperial Knights army rule · Code Chivalric', option:'Quality 1–2', text:'Each time this model is selected to shoot or fight, you can re-roll one **Hit roll** and you can re-roll one **Wound roll**.', found:'table row', explicit:false, trigger:null, used:{ ph:['movement','shooting','fight'], turn:'either', turns:{ movement:'opp', shooting:'your' } }, phases:{ ph:['movement','shooting','fight'], turn:'either', turns:{ movement:'opp', shooting:'your' } } },
  { rule:'Imperial Knights army rule · Code Chivalric', option:'Quality 3–4', text:'Add 2" to this model’s Move characteristic and add 1 to **Advance** and **Charge rolls** made for this model.', found:'table row', explicit:false, trigger:null, used:{ ph:['movement','charge'], turn:'either', turns:{ movement:'your' } }, phases:{ ph:['movement','charge'], turn:'either', turns:{ movement:'your' } } },
  { rule:'Imperial Knights army rule · Code Chivalric', option:'Quality 5–6', text:'Improve this model’s Objective Control characteristic by 2 and its Leadership characteristic by 1.', found:'table row', explicit:false, trigger:null, used:null, phases:null },
  { rule:'World Eaters army rule · Blessings of Khorne', option:'Unbridled Bloodlust', text:'This unit has +1 to **charge rolls**.', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ at:'Start of the battle round', ph:['command'], turn:'either' }, used:{ ph:['charge'], turn:'either' }, phases:{ at:'Start of the battle round', ph:['command','charge'], turn:'either' } },
  { rule:'World Eaters army rule · Blessings of Khorne', option:'Rage-fuelled Invigoration', text:'Each time a model in this unit makes a Pile-in or **Consolidation move**, it can move up to 6" instead of up to 3".', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ at:'Start of the battle round', ph:['command'], turn:'either' }, used:{ ph:['fight'], turn:'either' }, phases:{ at:'Start of the battle round', ph:['command','fight'], turn:'either' } },
  { rule:'World Eaters army rule · Blessings of Khorne', option:'Total Carnage', text:'Each time a model in this unit is destroyed by a melee attack, if it has not fought this phase, roll one D6: on a 4+, do not remove it from play. The destroyed model can fight after the attacking unit has finished making its attacks, and is then removed from play.', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ at:'Start of the battle round', ph:['command'], turn:'either' }, used:{ ph:['fight'], turn:'either' }, phases:{ at:'Start of the battle round', ph:['command','fight'], turn:'either' } },
  { rule:'World Eaters army rule · Blessings of Khorne', option:'Martial Excellence', text:'Melee weapons equipped by models in this unit have the **[SUSTAINED HITS 1]** ability.', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ at:'Start of the battle round', ph:['command'], turn:'either' }, used:{ ph:['fight'], turn:'either' }, phases:{ at:'Start of the battle round', ph:['command','fight'], turn:'either' } },
  { rule:'World Eaters army rule · Blessings of Khorne', option:'Warp Blades', text:'Melee weapons equipped by models in this unit have the **[LETHAL HITS]** ability.', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ at:'Start of the battle round', ph:['command'], turn:'either' }, used:{ ph:['fight'], turn:'either' }, phases:{ at:'Start of the battle round', ph:['command','fight'], turn:'either' } },
  { rule:'World Eaters army rule · Blessings of Khorne', option:'Decapitating Strikes', text:'Each time a model in this unit makes a melee attack that targets an **INFANTRY** unit, that attack has the **[DEVASTATING WOUNDS]** ability.', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ at:'Start of the battle round', ph:['command'], turn:'either' }, used:{ ph:['fight'], turn:'either' }, phases:{ at:'Start of the battle round', ph:['command','fight'], turn:'either' } },
  { rule:'World Eaters · Khorne Daemonkin rule · Blood Tithe', option:'Enraged Abjuration', text:'**BLOOD LEGIONS** and **WORLD EATERS** models from your army have the **Feel No Pain 5+** ability against **Psychic Attacks** and **mortal wounds**.', found:'bullet "**Name**" and its line, trigger: the rule\'s', explicit:false, trigger:{ ph:['command'], turn:'either' }, used:{ ph:['shooting','fight'], turn:'either', turns:{ shooting:'opp' } }, phases:{ ph:['command','shooting','fight'], turn:'either', turns:{ shooting:'opp' } } },
  { rule:'World Eaters · Khorne Daemonkin rule · Blood Tithe', option:'Daemonic Rage', text:'Melee weapons equipped by **BLOOD LEGIONS** units from your army have the **[lance]** ability.', found:'bullet "**Name**" and its line, trigger: the rule\'s', explicit:false, trigger:{ ph:['command'], turn:'either' }, used:{ ph:['fight'], turn:'either' }, phases:{ ph:['command','fight'], turn:'either' } },
  { rule:'World Eaters · Khorne Daemonkin rule · Blood Tithe', option:'Boon of Blood', text:'**BLOOD LEGIONS** units from your army have a 4+ invulnerable save.', found:'bullet "**Name**" and its line, trigger: the rule\'s', explicit:false, trigger:{ ph:['command'], turn:'either' }, used:{ ph:['shooting','fight'], turn:'either', turns:{ shooting:'opp' } }, phases:{ ph:['command','shooting','fight'], turn:'either', turns:{ shooting:'opp' } } },
  { rule:'World Eaters · Khorne Daemonkin rule · Blood Tithe', option:'Might of Khorne', text:'**BLOOD LEGIONS** units from your army gain the Blessings of Khorne ability.', found:'bullet "**Name**" and its line, trigger: the rule\'s', explicit:false, trigger:{ ph:['command'], turn:'either' }, used:null, phases:{ ph:['command'], turn:'either' } },
  { rule:'Thousand Sons army rule · Cabal of Sorcerers', option:'Destiny’s Ruin', text:'Select one enemy unit within 24" of and **visible** to the manifesting model. Until the end of the phase, each time a **THOUSAND SONS** or **SCINTILLATING LEGIONS** model from your army makes an attack that targets that unit, re-roll a **Hit roll** of 1. If the Psychic test result for this Ritual was 10+, you can re-roll the Hit roll instead.', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ ph:['shooting'], turn:'your' }, used:{ ph:['shooting'], turn:'your' }, phases:{ ph:['shooting'], turn:'your' } },
  { rule:'Thousand Sons army rule · Cabal of Sorcerers', option:'Temporal Surge', text:'Select one friendly **THOUSAND SONS** or **SCINTILLATING LEGIONS** unit that is not within **Engagement Range** of one or more enemy units and is within 24" of and **visible** to the manifesting model. That unit can make a **Normal move** of up to D6". If the Psychic test result for this Ritual was 10+, that unit can make a Normal move of up to 6" instead. In either case, until the end of the turn, that unit is not eligible to declare a charge.', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ ph:['shooting'], turn:'your' }, used:{ ph:['shooting','charge'], turn:'your' }, phases:{ ph:['shooting','charge'], turn:'your' } },
  { rule:'Thousand Sons army rule · Cabal of Sorcerers', option:'Doombolt', text:'Select one enemy unit within 24" of and **visible** to the manifesting model (excluding units with the **Lone Operative** ability that are not part of an Attached unit and are not within 12" of the manifesting model); that unit suffers D3 **mortal wounds**. If the Psychic test result for this Ritual was 11+, that unit suffers D3+3 mortal wounds instead.', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ ph:['shooting'], turn:'your' }, used:{ ph:['shooting'], turn:'your' }, phases:{ ph:['shooting'], turn:'your' } },
  { rule:'Thousand Sons army rule · Cabal of Sorcerers', option:'Twist of Fate', text:'Select one enemy unit within 24" of and **visible** to the manifesting model. Until the end of the phase, each time a **THOUSAND SONS** or **SCINTILLATING LEGIONS** model from your army makes an attack that targets that unit, improve the Armour Penetration characteristic of that attack by 1. If the Psychic test result for this Ritual was 12+, improve the Armour Penetration characteristic of that attack by 2 instead.', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ ph:['shooting'], turn:'your' }, used:{ ph:['shooting'], turn:'your' }, phases:{ ph:['shooting'], turn:'your' } },
  { rule:'Thousand Sons · Grand Coven rule · Kindred Sorcery', option:'Imbued Manifestation', text:'Add 6" to the Range characteristic of ranged Psychic weapons equipped by **THOUSAND SONS** models from your army.', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ ph:['command'], turn:'your' }, used:null, phases:{ ph:['command'], turn:'your' } },
  { rule:'Thousand Sons · Grand Coven rule · Kindred Sorcery', option:'Psychic Maelstrom', text:'Each time a **THOUSAND SONS** model from your army makes an attack with a Psychic weapon, add 1 to the **Wound roll**.', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ ph:['command'], turn:'your' }, used:{ ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' } }, phases:{ ph:['command','shooting','fight'], turn:'your', turns:{ fight:'either' } } },
  { rule:'Thousand Sons · Grand Coven rule · Kindred Sorcery', option:'Wrath of the Immaterium', text:'Psychic weapons equipped by **THOUSAND SONS** models from your army have the **[DEVASTATING WOUNDS]** ability.', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ ph:['command'], turn:'your' }, used:null, phases:{ ph:['command'], turn:'your' } },
  { rule:'Tyranids · Talons of the Norn Queen rule · Higher Imperatives', option:'Protean Purpose', text:'(Once per battle, per unit) In your Command phase, you can use this ability. If you do, this unit can make a selection for its **Singular Purpose** ability (this replaces the previous selection).', found:'"**Name:** effect"', explicit:true, trigger:{ ph:['command'], turn:'your' }, used:null, phases:{ ph:['command'], turn:'your' } },
  { rule:'Adeptus Mechanicus army rule · Doctrina Imperatives', option:'Protector Imperative', text:'- Ranged weapons equipped by models in this unit have the **[HEAVY]** ability.\n- Improve the Ballistic Skill characteristic of ranged weapons equipped by models in this unit by 1.\n- Each time a melee attack targets this unit, if this unit has the **BATTLELINE** keyword and/or it is within 6" of one or more friendly **ADEPTUS MECHANICUS BATTLELINE** units, subtract 1 from the **Hit roll**.', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ at:'Start of the battle round', ph:['command'], turn:'either' }, used:{ ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' } }, phases:{ at:'Start of the battle round', ph:['command','shooting','fight'], turn:'either', turns:{ shooting:'your' } } },
  { rule:'Adeptus Mechanicus army rule · Doctrina Imperatives', option:'Conqueror Imperative', text:'- Ranged weapons equipped by models in this unit have the **[ASSAULT]** ability.\n- Improve the Weapon Skill characteristic of melee weapons equipped by models in this unit by 1.\n- Each time a model in this unit makes an attack, if this unit has the **BATTLELINE** keyword and/or it is within 6" of one or more friendly **ADEPTUS MECHANICUS BATTLELINE** units, improve the Armour Penetration characteristic of that attack by 1.', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ at:'Start of the battle round', ph:['command'], turn:'either' }, used:{ ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' } }, phases:{ at:'Start of the battle round', ph:['command','shooting','fight'], turn:'either', turns:{ shooting:'your' } } },
  { rule:'Emperor’s Children · Coterie of the Conceited rule · Pledges to the Dark Prince', option:'1+', text:'Each time a model in this unit makes an attack, re-roll a **Hit roll** of 1.', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ at:'Start of the battle round', ph:['command'], turn:'either' }, used:{ ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' } }, phases:{ at:'Start of the battle round', ph:['command','shooting','fight'], turn:'either', turns:{ shooting:'your' } } },
  { rule:'Emperor’s Children · Coterie of the Conceited rule · Pledges to the Dark Prince', option:'3+', text:'Each time a model in this unit makes an attack, re-roll a **Wound roll** of 1.', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ at:'Start of the battle round', ph:['command'], turn:'either' }, used:{ ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' } }, phases:{ at:'Start of the battle round', ph:['command','shooting','fight'], turn:'either', turns:{ shooting:'your' } } },
  { rule:'Emperor’s Children · Coterie of the Conceited rule · Pledges to the Dark Prince', option:'5+', text:'Melee weapons equipped by models in this unit have the **[LETHAL HITS]** and **[SUSTAINED HITS 1]** abilities.', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ at:'Start of the battle round', ph:['command'], turn:'either' }, used:{ ph:['fight'], turn:'either' }, phases:{ at:'Start of the battle round', ph:['command','fight'], turn:'either' } },
  { rule:'Emperor’s Children · Coterie of the Conceited rule · Pledges to the Dark Prince', option:'7+', text:'Each time a model in this unit makes an attack, a Critical Hit is scored on an unmodified **Hit roll** of 5+.', found:'table row, trigger: the rule\'s', explicit:false, trigger:{ at:'Start of the battle round', ph:['command'], turn:'either' }, used:{ ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' } }, phases:{ at:'Start of the battle round', ph:['command','shooting','fight'], turn:'either', turns:{ shooting:'your' } } },
  { rule:'Chaos Knights army rule · Harbingers of Dread', option:'Deathly Terror', text:'While an enemy unit is within 9" of this model, worsen the Leadership characteristic of models in that unit by 1.', found:'table row', explicit:false, trigger:null, used:null, phases:null },
  { rule:'Chaos Knights army rule · Harbingers of Dread', option:'Despair', text:'While an enemy unit is within 9" of this model, worsen the Leadership characteristic of models in that unit by 1. This is cumulative with the Deathly Terror ability (see above).', found:'table row', explicit:false, trigger:null, used:null, phases:null },
  { rule:'Chaos Knights army rule · Harbingers of Dread', option:'Doom', text:'Each time this model makes an attack, if the target of that attack is **Battle-shocked**, add 1 to the **Wound roll**.', found:'table row', explicit:false, trigger:null, used:{ ph:['movement','shooting','fight'], turn:'either', turns:{ movement:'opp', shooting:'your' } }, phases:{ ph:['movement','shooting','fight'], turn:'either', turns:{ movement:'opp', shooting:'your' } } },
  { rule:'Chaos Knights army rule · Harbingers of Dread', option:'Darkness', text:'This model has **Stealth**.', found:'table row', explicit:false, trigger:null, used:null, phases:null },
  { rule:'Chaos Knights army rule · Harbingers of Dread', option:'Dismay', text:'In the Battle-shock step of your opponent’s Command phase, for each enemy unit that is below its Starting Strength and within 9" of this model, that enemy unit must take a Battle-shock test.', found:'table row', explicit:true, trigger:{ ph:['command'], turn:'opp' }, used:null, phases:{ ph:['command'], turn:'opp' } },
  { rule:'Chaos Knights army rule · Harbingers of Dread', option:'Delirium', text:'While an enemy unit that is **Below Half-strength** is within 9" of this model, each time that unit fails a Battle-shock test, it suffers D3 **mortal wounds**.', found:'table row', explicit:false, trigger:null, used:null, phases:null },
  { rule:'Chaos Knights army rule · Harbingers of Dread', option:'Dominion', text:'Add 3" to the range of this model’s **Aura abilities**.', found:'table row', explicit:false, trigger:null, used:null, phases:null },
  { rule:'Chaos Knights · Infernal Lance rule · Malefic Surge', option:'Unholy Hunger', text:'When a model in this unit makes a **Normal**, **Advance** or **Fall Back move**, until the end of the phase, add 3" to its Move characteristic.', found:'"**Name:** effect", trigger: the rule\'s', explicit:false, trigger:{ ph:['command'], turn:'your' }, used:null, phases:{ ph:['command'], turn:'your' } },
  { rule:'Chaos Knights · Infernal Lance rule · Malefic Surge', option:'Diabolic Power', text:'When this unit is selected to shoot or fight, select either the **[LETHAL HITS]** or **[SUSTAINED HITS 1]** ability. Until the end of the phase, weapons equipped by models in this unit have the selected ability.', found:'"**Name:** effect", trigger: the rule\'s', explicit:false, trigger:{ ph:['command'], turn:'your' }, used:null, phases:{ ph:['command'], turn:'your' } },
  { rule:'Chaos Knights · Infernal Lance rule · Malefic Surge', option:'Unnatural Fortitude', text:'When this unit is selected as the target of an attack, select one of the following to apply until the end of the phase:', found:'"**Name:** effect", trigger: the rule\'s', explicit:false, trigger:{ ph:['command'], turn:'your' }, used:null, phases:{ ph:['command'], turn:'your' } },
  { rule:'Adeptus Custodes army rule · Martial Ka’tah', option:'Conservai', text:'KA’TAH ABILITY\n**WHEN:** Your Command phase.\n**TARGET:** One friendly **readied** unit.\n**EFFECT:** Until the end of the turn:\n- Being **engaged**/**battle-shocked** does not prevent your unit from being eligible to start an action.\n- Starting an action does not prevent your unit from being eligible to shoot.', found:'table row', explicit:true, trigger:{ ph:['command'], turn:'your' }, used:{ ph:['shooting'], turn:'your' }, phases:{ ph:['command','shooting'], turn:'your' } },
  { rule:'Adeptus Custodes army rule · Martial Ka’tah', option:'Calistus', text:'KA’TAH ABILITY\n**WHEN:** Your Movement phase, when a friendly **readied** unit is selected to move.\n**TARGET:** That **readied** unit.\n**EFFECT:** When your unit makes a normal/advance/fall-back move, your unit can move through all types of model.', found:'table row', explicit:true, trigger:{ ph:['movement'], turn:'your' }, used:{ ph:['movement'], turn:'your' }, phases:{ ph:['movement'], turn:'your' } },
  { rule:'Adeptus Custodes army rule · Martial Ka’tah', option:'Salvus', text:'KA’TAH ABILITY\n**WHEN:** Your Shooting phase, when a friendly **readied** unit is selected to shoot.\n**TARGET:** That **readied** unit.\n**EFFECT:** Your unit can ignore modifiers to your unit’s:\n- **BS.**\n- Hit rolls and wound rolls.', found:'table row', explicit:true, trigger:{ ph:['shooting'], turn:'your' }, used:{ ph:['shooting'], turn:'your' }, phases:{ ph:['shooting'], turn:'your' } },
  { rule:'Adeptus Custodes army rule · Martial Ka’tah', option:'Dacatarai', text:'KA’TAH ABILITY\n**WHEN:** Start of the Fight phase.\n**TARGET:** One friendly **readied** unit.\n**EFFECT:** Your unit’s melee attacks that target an enemy unit (excluding **MONSTER**/**VEHICLE** units) can **re-roll hit rolls** of 1.', found:'table row', explicit:true, trigger:{ ph:['fight'], turn:'either' }, used:{ ph:['fight'], turn:'either' }, phases:{ ph:['fight'], turn:'either' } },
  { rule:'Adeptus Custodes army rule · Martial Ka’tah', option:'Kaptaris', text:'KA’TAH ABILITY\n**WHEN:** Start of the Fight phase.\n**TARGET:** One friendly **readied** unit.\n**EFFECT:** Melee attacks that target your unit have -1 to hit rolls.', found:'table row', explicit:true, trigger:{ ph:['fight'], turn:'either' }, used:{ ph:['fight'], turn:'either' }, phases:{ ph:['fight'], turn:'either' } },
  { rule:'Adeptus Custodes army rule · Martial Ka’tah', option:'Rendax', text:'KA’TAH ABILITY\n**WHEN:** Fight phase, when a friendly **readied** unit is selected to fight.\n**TARGET:** One friendly **readied** unit.\n**EFFECT:** Your unit’s melee attacks have **[Lethal Hits: Monster/Vehicle]**.', found:'table row', explicit:true, trigger:{ ph:['fight'], turn:'either' }, used:{ ph:['fight'], turn:'either' }, phases:{ ph:['fight'], turn:'either' } },
  { rule:'Adeptus Custodes army rule · Martial Ka’tah', option:'Example', text:'If you selected the Solar Watch **detachment**, when you select the Calistus **ka\'tah ability** for a **readied** unit, that unit has +2" **M** in addition to the normal effect of Calistus.', found:'"**Name:** effect", trigger: the rule\'s', explicit:false, trigger:{ ph:['command'], turn:'your' }, used:{ ph:['movement'], turn:'your' }, phases:{ ph:['command','movement'], turn:'your' } },
  { rule:'Adeptus Custodes army rule · Daughters of the Abyss', option:'Psychic Null (Aura)', text:'Friendly **ADEPTUS CUSTODES** units within 6" of this unit have **Feel No Pain 5+** against **psychic attacks**.', found:'"**Name:** effect"', explicit:false, trigger:null, used:{ ph:['movement','shooting','fight'], turn:'either', turns:{ movement:'your', shooting:'opp' } }, phases:{ ph:['movement','shooting','fight'], turn:'either', turns:{ movement:'your', shooting:'opp' } } },
  { rule:'Adeptus Custodes · Emperor’s Chosen rule · Magna Imperator', option:'Additional Effect', text:'You can select one enemy **MONSTER**/**VEHICLE** unit **engaged** with your unit and roll one D6:', found:'"**Name:** effect"', explicit:false, trigger:null, used:null, phases:null },
  { rule:'purge-goes-the-foe · Belisarius Cawl · Canticles of the Omnissiah', option:'Invocation of Machine Vengeance', text:'At the start of your Command phase, select one unit from your opponent\'s army. Until the start of your next Command phase, that enemy unit is your Machine Vengeance target. Each time a model in a friendly **ADEPTUS MECHANICUS** unit makes an attack that targets your Machine Vengeance target, you can re-roll the **Hit roll**.', found:'"**Name:** effect"', explicit:true, trigger:{ ph:['command'], turn:'your' }, used:{ ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' } }, phases:{ ph:['command','shooting','fight'], turn:'your', turns:{ fight:'either' } } },
  { rule:'purge-goes-the-foe · Belisarius Cawl · Canticles of the Omnissiah', option:'Mantra of Discipline', text:'This model has the **BATTLELINE** keyword and has the following ability:', found:'"**Name:** effect", trigger: the rule\'s', explicit:false, trigger:{ ph:['command'], turn:'your' }, used:null, phases:{ ph:['command'], turn:'your' } },
  { rule:'purge-goes-the-foe · Belisarius Cawl · Canticles of the Omnissiah', option:'Binharic Courage (Aura)', text:'While a friendly **ADEPTUS MECHANICUS** unit is within 6" of this model, add 1 to the Objective Control characteristic of models in that unit and each time you take a Battle-shock or **Leadership test** for that unit, add 1 to that test.', found:'"**Name:** effect", trigger: the rule\'s', explicit:false, trigger:{ ph:['command'], turn:'your' }, used:null, phases:{ ph:['command'], turn:'your' } },
  { rule:'purge-goes-the-foe · Belisarius Cawl · Canticles of the Omnissiah', option:'Shroudpsalm (Aura)', text:'While a friendly **ADEPTUS MECHANICUS** unit is within 6" of this model, that unit has the **Stealth** ability.', found:'"**Name:** effect", trigger: the rule\'s', explicit:false, trigger:{ ph:['command'], turn:'your' }, used:null, phases:{ ph:['command'], turn:'your' } },
  { rule:'purge-goes-the-foe · Thulia Ghuld · Icon of War', option:'Fanatical Devotion', text:'You can select one friendly **SKITARII** or **THULIA GHULD** unit within 6" of this model; until the start of your next Command phase, that unit is eligible to shoot and declare a charge in a turn in which it Advanced.', found:'"**Name:** effect"', explicit:false, trigger:null, used:{ ph:['movement','shooting','charge'], turn:'your', turns:{ movement:'either' } }, phases:{ ph:['movement','shooting','charge'], turn:'your', turns:{ movement:'either' } } },
  { rule:'purge-goes-the-foe · Thulia Ghuld · Icon of War', option:'Adaptive Tactics', text:'You can select one friendly **SKITARII** or **THULIA GHULD** unit within 6" of this model; until the start of your next Command phase, that unit is eligible to shoot and declare a charge in a turn in which it Fell Back.', found:'"**Name:** effect"', explicit:false, trigger:null, used:{ ph:['movement','shooting','charge'], turn:'your', turns:{ movement:'either' } }, phases:{ ph:['movement','shooting','charge'], turn:'your', turns:{ movement:'either' } } },
  { rule:'purge-goes-the-foe · Thulia Ghuld · Icon of War', option:'The Fires of Mars', text:'You can select one friendly **SKITARII** or **THULIA GHULD** unit within 6" of this model; until the start of your next Command phase, the Conqueror Imperative and Protector Imperative are both active for that unit.', found:'"**Name:** effect"', explicit:false, trigger:null, used:null, phases:null },
  { rule:'purge-goes-the-foe · Cybernetica Datasmith · Battle Protocols', option:'Protector Protocol', text:'Add 2 to the Attacks characteristic of ranged weapons equipped by **KASTELAN ROBOT** models in that unit.', found:'"**Name:** effect", trigger: the rule\'s', explicit:false, trigger:{ ph:['command'], turn:'your' }, used:{ ph:['shooting'], turn:'your' }, phases:{ ph:['command','shooting'], turn:'your' } },
  { rule:'purge-goes-the-foe · Cybernetica Datasmith · Battle Protocols', option:'Conqueror Protocol', text:'Add 2 to the Attacks characteristic of melee weapons equipped by **KASTELAN ROBOT** models in that unit.', found:'"**Name:** effect", trigger: the rule\'s', explicit:false, trigger:{ ph:['command'], turn:'your' }, used:{ ph:['fight'], turn:'either' }, phases:{ ph:['command','fight'], turn:'either', turns:{ command:'your' } } },
  { rule:'purge-goes-the-foe · Cybernetica Datasmith · Battle Protocols', option:'Aegis Protocol', text:'Add 1 to the Toughness characteristic of **KASTELAN ROBOT** models in that unit.', found:'"**Name:** effect", trigger: the rule\'s', explicit:false, trigger:{ ph:['command'], turn:'your' }, used:null, phases:{ ph:['command'], turn:'your' } }
];
const GRANTS = [
  { rule:'Orks · Runt Swarm rule · Sneaky Little Gitz', grants:'BATTLELINE', type:'keyword or weapon ability', to:{ all:['Gretchin'] }, while:null, text:'- Friendly **GRETCHIN** units have **BATTLELINE**.' },
  { rule:'Imperial Knights · Freeblade Company rule · Knights of Legend', grants:'Feel No Pain 6+', type:'ability', to:{ all:['Faction: Imperial Knights'] }, while:null, text:'**IMPERIAL KNIGHTS** models from your army have the **Feel No Pain 6+** ability.' },
  { rule:'World Eaters · Khorne Daemonkin rule · Blood Tithe', option:'Enraged Abjuration', grants:'Feel No Pain 5+', type:'ability', to:{ any:['Faction: Blood Legions','Faction: World Eaters'] }, while:'Enraged Abjuration active', text:'**BLOOD LEGIONS** and **WORLD EATERS** models from your army have the **Feel No Pain 5+** ability against **Psychic Attacks** and **mortal wounds**.' },
  { rule:'World Eaters · Khorne Daemonkin rule · Blood Tithe', option:'Might of Khorne', grants:'Blessings of Khorne', type:'ability', to:{ all:['Faction: Blood Legions'] }, while:'Might of Khorne active', text:'**BLOOD LEGIONS** units from your army gain the Blessings of Khorne ability.' },
  { rule:'Thousand Sons · Warpmeld Pact rule · Warpmeld Sacrifice', grants:'BATTLELINE', type:'keyword or weapon ability', to:{ all:['Tzaangors'] }, while:null, text:'**TZAANGORS** units from your army have the **BATTLELINE** keyword, and while such a unit is not **Battle-shocked**, add 1 to the Objective Control characteristic of **TZAANGOR** models in that unit.' },
  { rule:'Tyranids · Talons of the Norn Queen rule · Higher Imperatives', grants:'Protean Purpose', type:'ability', to:{ any:['Norn Emissary','Norn Assimilator'] }, while:null, text:'Friendly **NORN EMISSARY/NORN ASSIMILATOR** units have the following ability:' },
  { rule:'Chaos Knights army rule · Harbingers of Dread', option:'Darkness', grants:'Stealth', type:'ability', to:'this unit / model', while:'Darkness active', text:'This model has **Stealth**.' },
  { rule:'Chaos Knights army rule · Harbingers of Dread', grants:'Dread', type:'ability', to:null, while:'If your Army Faction is CHAOS KNIGHTS', text:'If your Army Faction is **CHAOS KNIGHTS**, each unit from your army with this ability gains Dread abilities, depending which are active for your army (see below).' },
  { rule:'Chaos Knights · Infernal Lance rule · Malefic Surge', grants:'Feel No Pain 6+', type:'ability', to:'this unit / model', while:null, text:'- Models in this unit have the **Feel No Pain 6+** ability.' },
  { rule:'Chaos Knights · Houndpack Lance rule · Marked Prey', grants:'BATTLELINE', type:'keyword or weapon ability', to:{ all:['War Dog'] }, while:null, text:'- **WAR DOG** units from your army have the **BATTLELINE** keyword.' },
  { rule:'Chaos Knights · Houndpack Lance rule · Marked Prey', grants:'CHARACTER', type:'keyword or weapon ability', to:null, while:'Until the end of the battle', text:'Until the end of the battle, those units have the **CHARACTER** keyword.*' },
  { rule:'Adeptus Custodes army rule · Daughters of the Abyss', option:'Psychic Null (Aura)', grants:'Feel No Pain 5+', type:'ability', to:{ all:['Faction: Adeptus Custodes'] }, while:'Psychic Null (Aura) active', text:'Friendly **ADEPTUS CUSTODES** units within 6" of this unit have **Feel No Pain 5+** against **psychic attacks**.' },
  { rule:'Adeptus Custodes army rule · Daughters of the Abyss', grants:'Psychic Null (Aura)', type:'ability', to:{ all:['Faction: Anathema Psykana'] }, while:null, text:'- Friendly **ANATHEMA PSYKANA** units with this ability have the following ability:' },
  { rule:'shooty · Big Mek Dakkarig · Dreadherder', grants:'Lone Operative', type:'ability', to:'this unit / model', while:null, text:'- This model has **Lone Operative**.' },
  { rule:'melee · Ghazghkull Thraka · Da Grand Warlord’s Ladz', grants:'Lone Operative', type:'ability', to:'this unit / model', while:'While this unit is within 3" of another friendly ORKS INFANTRY unit', text:'While this unit is within 3" of another friendly **ORKS INFANTRY** unit, this unit has **Lone Operative**.' },
  { rule:'melee · Mozrog Skragbad · Beast Snagga Following', grants:'Lone Operative', type:'ability', to:'this unit / model', while:'While this unit is within 3" of a friendly BEAST SNAGGA unit (excluding MONSTER CHARACTER units)', text:'While this unit is within 3" of a friendly **BEAST SNAGGA** unit (excluding **MONSTER CHARACTER** units), this unit has **Lone Operative**.' },
  { rule:'melee · Nazdreg · Nazdreg’s Know-wotz', grants:'Deep Strike', type:'ability', to:'this unit / model', while:null, text:'- This unit has **Deep Strike**.' },
  { rule:'melee · Beastboss on Squigosaur · Boss of da Hunt', grants:'Lone Operative', type:'ability', to:'this unit / model', while:'While this unit is within 3" of a friendly BEAST SNAGGA unit (excluding MONSTER CHARACTER units)', text:'While this unit is within 3" of a friendly **BEAST SNAGGA** unit (excluding **MONSTER CHARACTER** units), this unit has **Lone Operative**.' },
  { rule:'princes · Daemon Prince of Khorne · Lord of Murder', grants:'Lone Operative', type:'ability', to:'this unit / model', while:'While this model is within 3" of one or more friendly WORLD EATERS INFANTRY units', text:'While this model is within 3" of one or more friendly **WORLD EATERS INFANTRY** units, this model has the **Lone Operative** ability.' },
  { rule:'princes · Slaughterbound · Lord of the Eightbound', grants:'Deep Strike', type:'ability', to:'this unit / model', while:'If this model is attached to a WORLD EATERS POSSESSED unit during the Declare Battle Formations step', text:'If this model is attached to a **WORLD EATERS POSSESSED** unit during the Declare Battle Formations step, this model has the **Deep Strike** and **Scouts 6"** abilities.' },
  { rule:'pubstomper · Sorcerer in Terminator Armour · Umbralefic Crystal', grants:'Deep Strike', type:'ability', to:'this unit / model', while:null, text:'- This unit has **Deep Strike** until the start of your next Shooting phase.' },
  { rule:'nidzillas · Neurogaunts · Neurocytes', grants:'SYNAPSE', type:'keyword or weapon ability', to:'this unit / model', while:'While this unit is within Synapse Range of your friendly TYRANIDS unit (excluding NEUROGAUNT units)', text:'While this unit is within **Synapse Range** of your friendly **TYRANIDS** unit (excluding **NEUROGAUNT** units), it has the **SYNAPSE** keyword.' },
  { rule:'nidzillas · Norn Assimilator · Singular Purpose', grants:'Feel No Pain 5+', type:'ability', to:'this unit / model', while:'Until the end of the battle', text:'Until the end of the battle, while this model is within range of that objective marker, it has the **Feel No Pain 5+** ability and an Objective Control characteristic of 15.' },
  { rule:'nidzillas · Norn Emissary · Unnatural Resistance', grants:'Feel No Pain 4+', type:'ability', to:'this unit / model', while:null, text:'This model has the **Feel No Pain 4+** ability against Mortal Wounds.' },
  { rule:'purge-goes-the-foe · Belisarius Cawl · Canticles of the Omnissiah', option:'Mantra of Discipline', grants:'BATTLELINE', type:'keyword or weapon ability', to:'this unit / model', while:'Mantra of Discipline active', text:'This model has the **BATTLELINE** keyword and has the following ability:' },
  { rule:'purge-goes-the-foe · Belisarius Cawl · Canticles of the Omnissiah', option:'Shroudpsalm (Aura)', grants:'Stealth', type:'ability', to:{ all:['Faction: Adeptus Mechanicus'] }, while:'Shroudpsalm (Aura) active; While a friendly ADEPTUS MECHANICUS unit is within 6" of this model', text:'While a friendly **ADEPTUS MECHANICUS** unit is within 6" of this model, that unit has the **Stealth** ability.' },
  { rule:'purge-goes-the-foe · Belisarius Cawl · Mechanicus Bodyguard', grants:'Lone Operative', type:'ability', to:'this unit / model', while:'While this model is within 3" of one or more other friendly ADEPTUS MECHANICUS units', text:'While this model is within 3" of one or more other friendly **ADEPTUS MECHANICUS** units, this model has the **Lone Operative** ability.' },
  { rule:'purge-goes-the-foe · Tech-Priest Enginseer · Enginseer', grants:'Lone Operative', type:'ability', to:'this unit / model', while:'While this model is within 3" of one or more friendly ADEPTUS MECHANICUS VEHICLE units', text:'While this model is within 3" of one or more friendly **ADEPTUS MECHANICUS VEHICLE** units, unless it is leading a unit, this model has the **Lone Operative** ability.' },
  { rule:'purge-goes-the-foe · Tech-Priest Enginseer · Omnissiah’s Blessing', grants:'Feel No Pain 5+', type:'ability', to:'this unit / model', while:null, text:'That model regains up to D3 lost wounds and, if it is a **VEHICLE** model, until the start of your next Command phase, that model has the **Feel No Pain 5+** ability.' },
  { rule:'purge-goes-the-foe · Cybernetica Datasmith · Data-severed', grants:'INFANTRY', type:'keyword or weapon ability', to:'this unit / model', while:null, text:'- This unit has **INFANTRY**.' },
  { rule:'purge-goes-the-foe · Cybernetica Datasmith · Martial Signatum Amplificator', grants:'SKITARII', type:'keyword or weapon ability', to:'this unit / model', while:null, text:'Models in the bearer\'s unit have the **SKITARII** keyword.' },
  { rule:'purge-goes-the-foe · Cybernetica Datasmith · Robotic Bodyguard', grants:'Feel No Pain', type:'ability', to:{ all:['Cybernetica Datasmith'] }, while:'While a CYBERNETICA DATASMITH model is leading this unit', text:'While a **CYBERNETICA DATASMITH** model is leading this unit, that model has the **Feel No Pain** 4+ ability.' },
  { rule:'purge-goes-the-foe · Skitarii Rangers · Omnispex', grants:'IGNORES COVER', type:'keyword or weapon ability', to:'this unit / model', while:null, text:'Ranged weapons equipped by models in the bearer\'s unit have the **IGNORES COVER** ability.' },
  { rule:'defilers-and-friends · Lucius the Eternal · Duellist’s Hubris', grants:'Fights First', type:'ability', to:'this unit / model', while:null, text:'At the start of the Fight phase, if this model is not leading a unit, until the end of the phase, it has the Fights First ability.' },
  { rule:'big-demons-baby · Lord on Juggernaut · Disciple of Khorne', grants:'Deep Strike', type:'ability', to:'this unit / model', while:null, text:'The bearer has the Deep Strike ability, and it has the **BLOOD LEGIONS** Faction keyword instead of the **WORLD EATERS** Faction keyword.' },
  { rule:'mucho-mutantes · Tzaangor Shaman · Flowing Flesh', grants:'Feel No Pain 4+', type:'ability', to:'this unit / model', while:null, text:'The bearer has the **Feel No Pain 4+** ability and a Wounds characteristic of 5.' },
  { rule:'lite-knights · Telemon Heavy Dreadnought · Augury Uplink', grants:'Feel No Pain 5+', type:'ability', to:'this unit / model', while:null, text:'This model has **Feel No Pain 5+**.' }
];
// ---- end of RULE_OPTIONS, GRANTS ----

// ---- resolveArmies: written by verify/tables.js --write (do not edit) ----
const TABLE_ORDER = {
  unit:['id','name','short','role','pts','copies','ptsNote','enhancement','warlord','upgrade','leads','support','also','models','unplaced','gear','stats','ranged','melee','abilities','mods','aura','guard','rules','kw','kwNote','partialRules','srcNote','kwOnly'],
  stats:['name','M','T','Sv','W','Ld','OC','InSv','base','from','printed'],
  ranged:['group','fireAll','name','who','n','hunter','range','A','BS','S','AP','D','kw','from'],
  melee:['group','name','who','n','hunter','range','A','WS','S','AP','D','kw','from'],
  abilities:['name','who','at','tag','embarked','damaged','na','ph','riled','turn','turns','note','def','text','defOf']
};
// Each unit entry of ARMIES names its datasheet (ds: an id of DATASHEETS; a list of them for an attached unit: the leader,
// the other characters, the bodyguard) and holds only what the list chose. The app gets each unit as one object: the
// datasheet's columns, then the entry's own (an entry's value replaces the datasheet's; null: the list has none). Rows
// (stats, ranged, melee, abilities) name a row of the datasheet (a stats row by its model's name, without "×N"): the
// datasheet's row, then the entry row's own fields. An entry without its rows takes all of the datasheet's; a row the
// datasheet does not have (an enhancement's ability) is the list's own. over: a datasheet fact this list has otherwise
// than another list (verify/out/tables.md), kept per list until it is decided. why: the reason a value of the entry (or
// its row) is not the datasheet's: the rule, Warlord, enhancement or wargear that gives it (the value is the list's). of: which datasheet of an attached unit a
// row is from, when its who does not say. Hidden from the app: ds, over, of, a datasheet's faction and bsId, and the
// fingerprints (gistOf, defOf) of AI-written columns.
function resolveArmies(armies, sheets, order, opts){
  opts = opts || {};
  var ROWS = ['stats', 'ranged', 'melee', 'abilities'];
  var HIDE = ['ds', 'over', 'of', 'why', 'faction', 'bsId'].concat(["gistOf","defOf"]).filter(function(k){ return (opts.keep || []).indexOf(k) < 0; });
  function put(o, x){ for(var k in x) if(HIDE.indexOf(k) < 0){ if(x[k] === null) delete o[k]; else o[k] = x[k]; } return o; }
  function copy(x){ return JSON.parse(JSON.stringify(x)); }   // each unit its own copy of a datasheet's values
  function sorted(o, keys){ var out = {}, i, k; for(i = 0; i < keys.length; i++) if(keys[i] in o) out[keys[i]] = o[keys[i]]; for(k in o) if(!(k in out)) out[k] = o[k]; return out; }
  function rowOf(part, kind, name){ var rows = (part && part[kind]) || [], j; for(j = 0; j < rows.length; j++) if(rows[j].name === name) return j; return -1; }
  function find(parts, kind, r){
    var name = kind === 'stats' ? String(r.name).replace(/ ×\d+$/, '') : r.name, i, j;
    if(r.of !== undefined) return { p:r.of, j:rowOf(parts[r.of], kind, name) };
    for(i = 0; i < parts.length; i++) if(parts[i].name === r.who && (j = rowOf(parts[i], kind, name)) >= 0) return { p:i, j:j };
    for(i = 0; i < parts.length; i++) if((j = rowOf(parts[i], kind, name)) >= 0) return { p:i, j:j };
    return { p:-1, j:-1 };
  }
  return armies.map(function(a){
    return Object.assign({}, a, { units:a.units.map(function(u){
      if(!u.ds) return u;
      var ids = [].concat(u.ds), parts = ids.map(function(id){ if(!sheets[id]) throw new Error('data.js: ' + a.id + '/' + u.id + ' names no datasheet ' + id); return sheets[id]; });
      var out = {}, k, rest = {};
      for(k in parts[0]) if(ROWS.indexOf(k) < 0 && HIDE.indexOf(k) < 0) out[k] = copy(parts[0][k]);
      for(k in u) if(ROWS.indexOf(k) < 0) rest[k] = u[k];
      put(out, rest); if(u.over) put(out, u.over);
      ROWS.forEach(function(kind){
        var list;
        if(kind in u){ if(u[kind] === null){ delete out[kind]; return; } list = u[kind]; }
        else if(parts.length === 1 && parts[0][kind]) list = parts[0][kind].map(function(r){ return { name:r.name }; });
        else return;
        out[kind] = list.map(function(r, n){
          var at = find(parts, kind, r);
          if(at.j < 0){ if(opts.trace) opts.trace(a, u, kind, n, null, -1); return put({}, r); }
          if(opts.trace) opts.trace(a, u, kind, n, ids[at.p], at.j);
          var row = put({}, copy(parts[at.p][kind][at.j])); put(row, r); if(r.over) put(row, r.over);
          return sorted(row, order[kind] || []);
        });
      });
      return sorted(out, order.unit || []);
    }) });
  });
}
// ---- end of resolveArmies ----

return { version:VERSION, concepts:CONCEPTS, rules:RULES, ruleSrc:RULE_SRC, ruleAliases:RULE_ALIASES, coreStratagems:CORE_STRATAGEMS, factions:FACTIONS, armies:resolveArmies(ARMIES, DATASHEETS, TABLE_ORDER), bsIds:BS_IDS, datasheets:DATASHEETS, ruleOptions:RULE_OPTIONS, grants:GRANTS };
})();
