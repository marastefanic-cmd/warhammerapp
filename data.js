/* =====================================================================
   Warhammer companion: data.
   One file holds every army plus the faction and core rules they use.
   To add an army: append an object to ARMIES (units transcribed from the
   New Recruit PDF), add any new detachments, rules or aliases to FACTIONS /
   RULES / RULE_ALIASES, bump VERSION, then run `node build.js`.
   (build.js stamps a content hash, so installed apps reload on any change.)

   Text markup used in rules text:
     **bold**   ~~struck through~~   - a line starting "- " is a bullet   - *italic line*
   Phases: command | movement | shooting | charge | fight
   Turn:   your | opp | either;  turns:{ phase:turn } overrides it for one phase
   (Try Dat Button! is "your Shooting phase or the Fight phase": turn either, turns {shooting:'your'}).
===================================================================== */
window.WH_DATA = (function(){

const VERSION = '2026-10-21.2';

/* ---------------- core rules (11th edition) ---------------- */
// Weapon keyword and core ability text: the official Core Rules PDF (11th edition), BSData and the
// Wahapedia rules appendix where marked "(app)"
// (Snap Shooting and Actions from Wahapedia's core rules, 15.09 and 16).
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
  'Feel No Pain': 'This ability always takes the form **Feel No Pain X+**. Each time a model with this ability would lose a wound, roll one D6: on an **X+**, that wound is not lost.',
  'Leader': 'Before the battle, in the Muster Armies step, for each **leader** and **support** unit in your army, you can select one friendly **bodyguard** unit that unit can **lead**. That unit will then **lead** that **bodyguard** unit for the battle and form an **attached** unit with it.\nUnless otherwise stated, each **bodyguard** unit can only have one **leader** unit and one **support** unit attached to it.',
  'Support': 'Before the battle, in the Muster Armies step, for each **leader** and **support** unit in your army, you can select one friendly **bodyguard** unit that unit can **lead**. That unit will then **lead** that **bodyguard** unit for the battle and form an **attached** unit with it.\nUnless otherwise stated, each **bodyguard** unit can only have one **leader** unit and one **support** unit attached to it.',
  'Lone Operative': 'Unless part of an **attached** unit, this unit is not **visible** to enemy models unless they are within 12" of this unit, and it cannot be targeted by **[INDIRECT FIRE]** weapons unless the attacking model is within 12" of this unit.\nIf this ability takes the form **Lone Operative X"**, unless part of an **attached** unit, this unit is not **visible** to enemy models unless they are within **X"** of this unit, and it cannot be targeted by **[INDIRECT FIRE]** weapons unless the attacking model is within **X"** of this unit.\n**24.24.01 Attached units and Lone Operative (app):** If all models in an attached unit have Lone Operative, that unit will benefit from **Lone Operative**.\nIf a unit has **Lone Operative**, but models in that unit have different range values for **Lone Operative**, the highest value amongst that unit’s models on the battlefield is applied to the whole unit.\nIf an **attached** unit **below starting strength** only contains models with **Lone Operative**, **Lone Operative** becomes active again.',
  'Fights First': 'While every model in a unit has this ability, that unit is a **Fights First** unit.\nSee the Resolve Fights First Combats step in the Fight phase (12.04).',
  'Actions': 'A unit is eligible to start an action unless one or more of the following apply to that unit:\n- It is not on the battlefield.\n- It is an **AIRCRAFT**/**FORTIFICATION** unit.\n- It is battle-shocked.\n- It has an OC characteristic of 0 or ‘-’.\n- It is engaged (unless it is a **TITANIC** unit).\n- It made an advance or fall-back move this turn.\n- It started another action this turn.\nIf a unit starts an action, until the end of the turn:\n- It is not eligible to shoot (excluding **TITANIC** units).\n- It is not eligible to declare a charge.\nIf a unit performing an action makes a move (excluding pile-in and consolidation moves) or leaves the battlefield, that unit does not complete that action. Otherwise, when an action is completed, its ‘Effect’ section is triggered.',
  'Snap Shooting': 'ELIGIBLE IF: As stated in the rule allowing this shooting type.\nEFFECT: Your unit shoots as described in Making Attacks (04).\nWHILE SHOOTING:\n- You can only target one visible enemy unit within 24" of your unit (and only if it is an eligible target).\n- Each attack only hits on an unmodified hit roll of 6 (irrespective of the attacking weapon’s BS characteristic or any modifiers).\n- You cannot re-roll hit rolls.\nAFTER SHOOTING: Until the end of the phase, your unit is not eligible to start an action.',
  'Mobile': '**Dense:**\n- **INFANTRY/BEASTS/SWARM/MOBILE** models can move horizontally through **dense terrain features**.\n- **INFANTRY/BEASTS/SWARM** models can move vertically through **dense terrain features**.\n- Other models can move horizontally through **dense terrain features** provided that all sections of that **terrain feature** that the moving model’s base would move through are 2" or less in height. Otherwise, the moving model must move vertically to ascend or descend such sections. They cannot move through ceilings and floors while doing so, and they cannot end that move on any surface of that **terrain feature** that is not on ground level (see below).\n*App note, not rules text: MOBILE has no rule of its own in the core rules. These are the Dense lines of Terrain and Movement (13.06). Super-Heavy Walker (24.35), Designer’s Note: “Gaining the MOBILE keyword for the duration of a move will enable models in that unit to move horizontally through dense terrain features (13.06).”*',
  'Lance': 'Each time an attack is made with a **[LANCE]** weapon, if the attacking model’s unit made a **charge move** this turn, add 1 to the **wound roll**.',
  'Melta': 'This ability always takes the form **[MELTA X]**. Each time a model makes an attack with a **[MELTA]** weapon, if the target unit was within half range of that weapon in the Select Targets step, until the attacking unit’s attacks have been resolved, add **X** to that weapon’s **D** characteristic.\n*Example: A model targets a unit that is within half range of a [MELTA 2] weapon with a D characteristic of D6. While resolving those attacks, that weapon has a D characteristic of D6+2.*',
  'Super-Heavy Walker': 'Each time a unit with this ability makes a **normal**, **advance** or **fall-back move**:\n- Models in that unit can move through models (including **MONSTER/VEHICLE** models, but excluding **TITANIC** models) and can move horizontally through sections of **terrain features** that are 4" or less in height.\n- Before moving that unit, you can select for all models in that unit to have the **MOBILE** keyword until that move ends. If you do, when that move ends, roll one D6: on a 1, that unit is battle-shocked.\n*Designer’s Note: Gaining the MOBILE keyword for the duration of a move will enable models in that unit to move horizontally through dense terrain features (13.06).*',
  'Firing Deck': 'This ability always takes the form **Firing Deck X**. In your Shooting phase, each time this **TRANSPORT** is **selected to shoot**, if one or more units are embarked within it, resolve the following sequence:\n- 1. Select up to **X** models embarked within this **TRANSPORT** (excluding models whose units have already been **selected to shoot** this phase).\n- 2. For each selected model, select one of its ranged weapons (excluding **[ONE SHOT]** weapons).\n- 3. Until this **TRANSPORT** has resolved all of its attacks, it has all of those selected weapons in addition to its other weapons.\n- 4. Until the end of the turn, units embarked within this **TRANSPORT** are not eligible to shoot.',
  'Scouts': 'This ability always takes the form **Scouts X"**. In the Resolve Pre-battle Abilities step, if every model in a unit has this ability, you can do one of the following:\n- If that unit is in **strategic reserves**, you can set up that unit anywhere that is wholly within your deployment zone.\n- If that unit is wholly within your deployment zone, it can make a **scout move** (see below).\n- If that unit is embarked within a **DEDICATED TRANSPORT** that is wholly within your deployment zone, and if every model embarked within that **DEDICATED TRANSPORT** has the Scouts ability, that **DEDICATED TRANSPORT** can make a **scout move**.',
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
  [/^firing deck/i, 'Firing Deck'], [/^scouts/i, 'Scouts'],
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
  { id:'command-re-roll', gist:'Re-roll an advance, charge, damage, hazard, hit, save or wound roll you just made…', name:'Command Re-roll', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either',
    when:'Any phase, just after you make one of the following rolls for a friendly unit or model:\n- **Advance roll**\n- **Charge roll**\n- **Damage roll**\n- **Hazard roll**\n- **Hit roll**\n- **Save roll**\n- **Wound roll**\n- A roll to determine the number of attacks generated with a weapon.',
    target:'That unit or model.',
    effect:'You re-roll that roll. If you are rolling more than one dice together, select one of those dice to re-roll (excluding **charge rolls**, which you must re-roll in full).' },
  { id:'epic-challenge', gist:'One CHARACTER model in your unit: its melee weapons have [PRECISION] until the end of the phase.', name:'Epic Challenge', cp:1, phases:['fight'], turn:'either', needs:{ all:['Character'] },
    when:'Fight phase, just after a friendly **CHARACTER** unit is **selected to fight**.',
    target:'That **CHARACTER** unit.',
    effect:'Select one **CHARACTER** model in your unit. Until the end of the phase, that model’s melee weapons have the **[PRECISION]** ability.' },
  { id:'insane-bravery', gist:'The battle-shock roll you are about to make for your unit is automatically successful.', note:'Wahapedia FAQ: Can I use the Insane Bravery stratagem on a battle-shocked unit? No, as a unit’s controlling player cannot target that unit with stratagems (01.07).', name:'Insane Bravery', cp:1, phases:['command'], turn:'your', limit:'Once per battle',
    when:'Battle-shock step of your Command phase, just before you make a **battle-shock roll** for a friendly unit.',
    target:'That unit.',
    effect:'That **battle-shock roll** is automatically successful.',
    restrictions:'You cannot use this **stratagem** more than once per battle.' },
  { id:'explosives', gist:'One EXPLOSIVES/GRENADES model: six D6 at an enemy unit within 8", 1 mortal wound for each 4+…', note:'Wahapedia errata: The Grenade Stratagem is the same as the Explosives stratagem.', name:'Explosives', cp:1, phases:['shooting'], turn:'your', needs:{ any:['Explosives','Grenades'] },
    when:'Your Shooting phase.',
    target:'One friendly **unengaged** **EXPLOSIVES/GRENADES** unit that is **eligible to shoot** and did not make an **advance move** this turn.',
    effect:'Resolve the following sequence:\n- 1. Select one **EXPLOSIVES/GRENADES** model in your unit.\n- 2. Select one **unengaged** enemy unit within 8" of and **visible** to that model.\n- 3. Roll six D6: for each 4+, that enemy unit suffers 1 **mortal wound** (06.02).' },
  { id:'crushing-impact', gist:'After the charge: D6 equal to T of your model engaged with an enemy unit; each 5+: 1 mortal wound to it, each 1: 1 to yours…', note:'Wahapedia errata: The Tank Shock Stratagem is the same as the Crushing Impact stratagem.', name:'Crushing Impact', cp:1, phases:['charge'], turn:'your', needs:{ any:['Monster','Vehicle'] },
    when:'Your Charge phase, just after a friendly **MONSTER/VEHICLE** unit ends a **charge move**.',
    target:'That **MONSTER/VEHICLE** unit.',
    effect:'Resolve the following sequence:\n- 1. Select one enemy unit **engaged** with your unit.\n- 2. Select one model in your unit **engaged** with that enemy unit.\n- 3. Roll a number of D6 equal to the **T** characteristic of that model: for each 1, your unit suffers 1 **mortal wound**; for each 5+, that enemy unit suffers 1 **mortal wound** (to a maximum of 6 **mortal wounds** per unit).' },
  { id:'rapid-ingress', gist:'Your unit in strategic reserves makes an ingress move (not in the first battle round).', name:'Rapid Ingress', cp:1, phases:['movement'], turn:'opp', needs:{ none:['Aircraft'] },
    when:'End of your opponent’s Movement phase.',
    target:'One friendly unit that is in **strategic reserves** (excluding **AIRCRAFT**).',
    effect:'Your unit makes an **ingress move** (20.04).',
    restrictions:'You cannot use this **stratagem** during the first battle round.' },
  { id:'fire-overwatch', gist:'Your unit shoots using snap shooting.', name:'Fire Overwatch', cp:1, phases:['movement'], turn:'opp', needs:{ none:['Titanic'] },
    when:'End of your opponent’s Movement phase.',
    target:'One friendly **unengaged** unit (excluding **TITANIC** units).',
    effect:'Your unit shoots using **snap shooting**.' },
  { id:'smokescreen', gist:'Until the end of the phase, your SMOKE unit, and a unit not fully visible because of it, has the benefit of cover…', defCalc:{ cover:true }, calcNote:'for a unit that is not fully visible to the attacking models because of one or more models in your SMOKE unit, tick “Target has the benefit of cover” instead', name:'Smokescreen', cp:1, phases:['shooting'], turn:'opp', needs:{ all:['Smoke'] },
    when:'Start of your opponent’s Shooting phase.',
    target:'One friendly **SMOKE** unit.',
    effect:'Until the end of the phase, each time an attack targets either your **SMOKE** unit, or a unit that is not **fully visible** to the attacking model because of one or more models in your **SMOKE** unit, the target has the **benefit of cover** against that attack (13.08).' },
  { id:'heroic-intervention', gist:'Your unit resolves a charge, choosing Leap to Defend or Into the Fray (+1CP)…', note:'Wahapedia FAQ: If a stratagem contains a section that carries an additional CP cost (such as the Into the Fray option of Heroic Intervention), is that additional cost considered to be a modifier? No, a stratagem that costs 1CP and is making use of an optional +1CP section has an original cost of 2CP.', name:'Heroic Intervention', cp:1, cpNote:'Into the Fray +1CP', phases:['charge'], turn:'opp', needs:{ unless:{ all:['Vehicle'], none:['Character','Walker'] } },
    when:'End of your opponent’s Charge phase.',
    target:'One friendly **unengaged** unit within 12" of one or more enemy units. You can only select a **VEHICLE** unit if it is a **CHARACTER/WALKER** unit.',
    effect:'**Resolve a charge** with your unit (11.02). While doing so, before making the **charge roll**, you must select one of the following modes:\n- **Leap to Defend:** When selecting **charge targets**, you can only select enemy units that made a **charge move** this phase and are within the **maximum distance**.\n- **Into the Fray (+1CP):** When making the **charge roll**, if the result is greater than 6 (after modifiers), change it to 6. When selecting **charge targets**, you can select any enemy units that are within 6" of your unit and within the **maximum distance**.' },
  { id:'counteroffensive', gist:'Your unit has Fights First until the end of the phase and must be the next unit you select to fight.', name:'Counteroffensive', cp:2, phases:['fight'], turn:'opp',
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
        // short reminders shown in the stratagem phase views (app wording, not rules text)
        remind:[
          { ph:['movement'], turn:'your', text:'Re-roll advance rolls. Riled up: advancing still lets a unit declare a charge.' },
          { ph:['shooting'], turn:'your', text:'Riled up: ranged attacks have [ASSAULT].' },
          { ph:['charge'], turn:'your', text:'A unit that was riled up when it advanced can still declare a charge.' }
        ],
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
        name:'Bully Boyz', dp:1,
        rule:{ name:'Displays of Savagery', ph:['fight'], turn:'either', needs:{ any:['Meganobz','Nobz'] },
          text:'Friendly **MEGANOBZ**/**NOBZ** units’ melee attacks have **[SUSTAINED HITS 1]**.' },
        enhancements:[
          { name:'Wimp-kickaz', pts:15, upgrade:true, text:'**NOBZ** unit only. When an enemy unit **engaged** with this unit is selected to make a **fall-back move**:\n- That enemy unit must select the **desperate escape** mode.\n- If this unit is **riled up**, that enemy unit has -1 to the **hazard rolls** made for that **desperate escape**.' },
          { name:'Tellyporta Boss', pts:20, text:'**MEGA ARMOUR** model only. This unit (excluding **VEHICLE** units) has **Deep Strike**.' }
        ],
        stratagems:[
          { id:'too-arrogant-to-die', gist:'Model in your unit destroyed, unit not selected to fight this phase: D6 (+1 if riled up); on a 4+ it stays until your unit has fought or the phase ends.', name:'Too Arrogant to Die', cp:1, phases:['fight'], turn:'either', needs:{ any:['Meganobz','Nobz'] },
            def:'Fight phase: a model destroyed while your unit has not been selected to fight this phase is not removed on a 4+ (D6, +1 if riled up; removed once your unit has fought or at the end of the phase)',
            when:'Fight phase, when an enemy unit targets a friendly **MEGANOBZ**/**NOBZ** unit.',
            target:'That **MEGANOBZ**/**NOBZ** unit.',
            effect:'When a model in your unit is **destroyed**, if your unit has not been **selected to fight** this phase, roll one D6, with +1 to that roll if your unit is **riled up**:\n- On a 4+, do not remove that model from the battlefield. When your unit has fought, or at the end of the phase (whichever comes first), that model is removed from the battlefield.' },
          { id:'armed-to-da-teef', gist:'Your unit’s attacks can re-roll hit rolls of 1, or re-roll hit rolls if your unit is riled up.', name:'Armed to da Teef', cp:1, phases:['shooting','fight'], turn:'either', turns:{ shooting:'your' }, needs:{ any:['Meganobz','Nobz'] },
            mod:{ kind:'all', when:'Your Shooting phase or the Fight phase', note:'can re-roll hit rolls of 1 (riled up: can re-roll hit rolls)',
              pick:[{ name:'Hit rolls of 1', note:'re-roll hit rolls of 1' }, { name:'Riled up: every hit roll', note:'re-roll hit rolls' }] },
            when:'Your Shooting phase or the Fight phase, when a friendly **MEGANOBZ**/**NOBZ** unit is **selected to attack**.',
            target:'That **MEGANOBZ**/**NOBZ** unit.',
            effect:'Your unit’s attacks can:\n- Re-roll **hit rolls** of 1.\n- If your unit is **riled up**, re-roll **hit rolls**.' },
          // Wahapedia prints the +1CP option as a badge above "Or:"; the app writes the badge at the start of that line
          { id:'hulking-brutes', gist:'Ranged attacks that target your unit with S greater than its T have -1 to wound rolls; for +1CP, all ranged attacks that target it do.', name:'Hulking Brutes', cp:1, cpNote:'Or: +1CP', phases:['shooting'], turn:'opp', needs:{ any:['Meganobz','Nobz'] },
            def:'their Shooting phase: -1 to wound when the attack’s S is greater than its T (+1CP: every ranged attack)',
            defPick:[{ name:'S greater than T', calc:{ woundMinusSgt:1 } }, { name:'+1CP: every ranged attack', calc:{ woundMinus:1 } }],
            when:'Your opponent’s Shooting phase, when an enemy unit targets a friendly **MEGANOBZ**/**NOBZ** unit.',
            target:'That **MEGANOBZ**/**NOBZ** unit.',
            effect:'Ranged attacks that target your unit with a **S** greater than your unit’s **T** have -1 to **wound rolls**.\n**+1CP** Or: Ranged attacks that target your unit have -1 to **wound rolls**.' }
        ]
      },
      'dread-mob': {
        name:'Dread Mob', dp:1,
        // tableAt: Wahapedia prints the table after "…have the relevant rule(s):", before the hazard-roll line
        rule:{ name:'Try Dat Button!', ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' }, needs:{ all:['Walker'], none:['Titanic'] }, tableAt:1,
          mod:{ kind:'all', when:'Your Shooting phase or the Fight phase, when selected to attack (optional: one D6 or two D6)', note:'1–2 +1 A · 3–4 +2 S · 5–6 +1 AP (two D6: keep re-rolling duplicate results; one hazard roll when the unit has attacked)',
            pick:[{ name:'1–2', note:'+1 A' }, { name:'3–4', note:'+2 S' }, { name:'5–6', note:'+1 AP' }, { name:'1–2 and 3–4', note:'+1 A, +2 S' }, { name:'1–2 and 5–6', note:'+1 A, +1 AP' }, { name:'3–4 and 5–6', note:'+2 S, +1 AP' }],
            // the dice rolled, a choice of its own beside the result: "If you rolled two D6, when this unit has attacked, this unit
            // makes one hazard roll", whatever the result; a pick of two results is two D6 by itself. Two D6 with one result stays a
            // choice: "keep re-rolling duplicate results" can mean the same row of the table or the same die value
            dice:{ opts:['one D6', 'two D6'], two:['1–2 and 3–4', '1–2 and 5–6', '3–4 and 5–6'],
              note:'two D6, one result: “keep re-rolling duplicate results” can mean the same row of the table (two D6 always give two results) or the same die value (a 1 and a 2 give one result, and the hazard roll is still made)' },
            hazard:{ rolls:1, dice:'two D6' } },
          text:'In your Shooting phase or the Fight phase, when a friendly **ORKS WALKER** unit (excluding **TITANIC** units) is **selected to attack**, you can use this ability. If you do, roll either one D6 or two D6 (keep re-rolling duplicate results). This unit’s attacks have the relevant rule(s):\nIf you rolled two D6, when this unit has attacked, this unit makes one **hazard roll**.',
          table:[['1–2','+1 **A**'],['3–4','+2 **S**'],['5–6','+1 **AP**']] },
        enhancements:[
          { name:'Cybork Boosta', pts:10, text:'**BIG MEK/MEK** model only. This model has +2" **M**.' },
          { name:'Dreadherder', pts:30, text:'**BIG MEK** model only. While this model is within 3" of a friendly **ORKS WALKER** unit (excluding **BIG MEK** units):\n- This model has **Lone Operative**.\n- In your Shooting phase, you can select one friendly **ORKS WALKER** unit within 3" of this model. That unit’s attacks can re-roll **hit rolls** of 1 until the end of the turn.' }
        ],
        stratagems:[
          { id:'crazed-rampage', gist:'Model in your unit destroyed, unit not selected to fight this phase: roll one D6; on a 4+ it stays until your unit has fought or the phase ends…', name:'Crazed Rampage', cp:1, phases:['fight'], turn:'either', needs:{ all:['Walker'], none:['Titanic'] },
            note:'Wahapedia FAQ: “If my unit has the Deadly Demise ability and has an ability that allows it to Fight on Death, how do I resolve this?” “Fight on Death rules are resolved before Deadly Demise abilities, meaning that your unit’s Deadly Demise will resolve after your unit has fought/at the end of the phase and the relevant models have been removed from the battlefield.”',
            def:'Fight phase: a model destroyed while your unit has not been selected to fight this phase is not removed on a 4+ (removed once your unit has fought or at the end of the phase)',
            when:'Fight phase, when an enemy unit targets a friendly **ORKS WALKER** unit (excluding **TITANIC** units).',
            target:'That **ORKS WALKER** unit.',
            effect:'When a model in your unit is **destroyed**, if your unit has not been **selected to fight** this phase, roll one D6, with +3 to the result if your unit has ~~**DEFF DREAD**~~:\n- On a 4+, do not remove that model from the battlefield. When your unit has fought, or at the end of the phase (whichever comes first), that model is removed from the battlefield.' },
          { id:'dread-power', gist:'Your unit is riled up until the start of your next turn.', name:'Dread Power', cp:1, phases:['movement'], turn:'your', needs:{ all:['Walker'] },
            when:'Your Movement phase.',
            target:'One friendly **ORKS WALKER** unit.',
            effect:'Your unit is **riled up** until the start of your next turn.' },
          { id:'stomping-juggernaut', gist:'Your unit has MOBILE.', name:'Stomping Juggernaut', cp:1, phases:['movement','charge'], turn:'your', needs:{ all:['Walker'] },
            when:'Your Movement/Charge phase, when a friendly **ORKS WALKER** unit is **selected to move** or **declares a charge**.',
            target:'That **ORKS WALKER** unit.',
            effect:'Your unit has **MOBILE**.' }
        ]
      },
      // the rule names no phase (an advance or fall-back move), so it has no ph
      'runt-swarm': {
        name:'Runt Swarm', dp:1,
        rule:{ name:'Sneaky Little Gitz', needs:{ all:['Gretchin'] },
          text:'- Friendly **GRETCHIN** units have **BATTLELINE**.\n- When a friendly **GRETCHIN** unit is selected to make an **advance**/**fall-back move**, that move does not prevent this unit from being **eligible to start an action**.' },
        enhancements:[
          { name:'Extra Sneaky', pts:10, upgrade:true, text:'**GRETCHIN** unit only. This unit has -3" **detection range**.' },
          { name:'Minefield Detail', pts:10, upgrade:true, text:'**GRETCHIN** unit only. While this unit is not embarked, this unit has **Scouts 6"**.' }
        ],
        stratagems:[
          { id:'infested-war-zone', gist:'Add a new GRETCHIN unit identical to your destroyed unit to your army, in strategic reserves, at its starting strength.', name:'Infested War Zone', cp:2, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Gretchin'] },
            when:'Any phase, when an enemy unit has attacked.',
            target:'One friendly **GRETCHIN** unit that was just **destroyed**. You can target that unit with this **stratagem** even though that unit was just **destroyed**.',
            effect:'Add a new **GRETCHIN** unit to your army identical to your **destroyed** unit, in **strategic reserves**, at its **starting strength**, with its full wounds remaining.' },
          { id:'scarper', gist:'Your unit can make a normal move of up to D6", or up to 6" if your unit is an attached unit.', name:'Scarper!', cp:1, phases:['movement'], turn:'opp', needs:{ all:['Gretchin'] },
            when:'Your opponent’s Movement phase, when an enemy unit ends a move within 8" of a friendly **unengaged GRETCHIN** unit.',
            target:'That **GRETCHIN** unit.',
            effect:'Your unit can make a **normal move** of:\n- Up to D6".\n- Or: Up to 6" instead if your unit is an **attached** unit.' },
          // needs is the TARGET (the GRETCHIN unit); the ORKS INFANTRY unit it names is the one being shot
          { id:'grot-shields', gist:'If a model in your GRETCHIN unit is on the battlefield, each hit roll of that enemy unit’s ranged attacks on that ORKS unit that results in a hit ends that attack, and your GRETCHIN unit suffers 1 mortal wound.', name:'Grot Shields', cp:1, phases:['shooting'], turn:'opp', needs:{ all:['Gretchin'] },
            note:'Wahapedia FAQ: “When using the Grot Shields stratagem, are hits by [TORRENT] weapons considered ’hit rolls that result in a hit’?” “No.”',
            when:'Your opponent’s Shooting phase, when an enemy unit targets a friendly **ORKS INFANTRY** unit (excluding **GRETCHIN** units).',
            target:'One friendly **GRETCHIN** unit within 3" of that **ORKS INFANTRY** unit.',
            effect:'When a **hit roll** for that enemy unit’s ranged attacks that target that **ORKS** unit results in a hit, if a model in your **GRETCHIN** unit is on the battlefield, end the attack sequence for that attack and your **GRETCHIN** unit suffers 1 **mortal wound**.' }
        ]
      },
      // Shoota Boyz and Wreckas: Wahapedia wording (Orks, codex; GW publishes no Orks Faction Pack)
      'shoota-boyz': {
        name:'Shoota Boyz', dp:1,
        rule:{ name:'Dakka! Dakka! Dakka!', ph:['movement','shooting'], turn:'either', turns:{ movement:'opp' }, needs:{ all:['Faction: Orks','Infantry'] },
          mod:{ kind:'ranged', when:'Riled up', cond:'riled', note:'+3" range' },
          text:'Friendly **ORKS INFANTRY** units’ ranged attacks have:\n- **[ASSAULT]**.\n- While this unit is **riled up**, +3" **R**.' },
        enhancements:[
          { name:'Supa-glowy Fing', pts:25, text:'**ORKS INFANTRY** model only (excluding **WEIRDBOY** models). This model’s ranged attacks have:\n- **[ANTI-INFANTRY 4+]**.\n- **[DEVASTATING WOUNDS]**.\n- **[SUPA-HAZARDOUS]**.\n**[SUPA-HAZARDOUS]:** Each time a unit is **selected to shoot**, after that unit has resolved all of its attacks, make two **hazard rolls** for that unit for each **[SUPA-HAZARDOUS]** weapon you selected in the Select Weapons step.' },
          { name:'Targetin’ Squigs', pts:20, text:'**BIG MEK**/**BIGBOSS**/**WARBOSS** model only. This unit’s ranged attacks (excluding **[TORRENT]** attacks) have +3" **R**.' }
        ],
        stratagems:[
          { id:'kustom-dakka', gist:'Your unit’s ranged attacks have +1 to wound rolls against a unit (excluding MONSTER/VEHICLE units).', name:'Kustom Dakka', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Faction: Orks','Infantry'] },
            mod:{ kind:'ranged', when:'Your Shooting phase, vs non-MONSTER/VEHICLE targets', note:'+1 to wound rolls', vs:{ none:['Monster','Vehicle'] } },
            when:'Your Shooting phase, when a friendly **ORKS INFANTRY** unit is **selected to shoot**.',
            target:'That **ORKS INFANTRY** unit.',
            effect:'Your unit’s ranged attacks that target a unit (excluding **MONSTER**/**VEHICLE** units) have +1 to **wound rolls**.' },
          { id:'glowin-dakka', gist:'Your unit’s ranged attacks against a unit within 9" have +1 AP.', name:'Glowin’ Dakka', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Faction: Orks','Infantry'] },
            mod:{ kind:'ranged', when:'Your Shooting phase, vs targets within 9"', note:'+1 AP' },
            when:'Your Shooting phase, when a friendly **ORKS INFANTRY** unit is **selected to shoot**.',
            target:'That **ORKS INFANTRY** unit.',
            effect:'Your unit’s ranged attacks that target a unit within 9" have +1 **AP**.' },
          { id:'never-enough-dakka', gist:'Your unit’s ranged attacks have [SUSTAINED HITS 1].', name:'Never Enough Dakka', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Faction: Orks','Infantry'] },
            mod:{ kind:'ranged', when:'Your Shooting phase', note:'[SUSTAINED HITS 1]' },
            when:'Your Shooting phase, when a friendly **ORKS INFANTRY** unit is **selected to shoot**.',
            target:'That **ORKS INFANTRY** unit.',
            effect:'Your unit’s ranged attacks have **[SUSTAINED HITS 1]**.' }
        ]
      },
      'war-horde': {
        name:'War Horde', dp:3,
        rule:{ name:'Get Stuck In', ph:['fight'], turn:'either', needs:{ all:['Faction: Orks'] },
          text:'Friendly **ORKS** units’ melee attacks have **[SUSTAINED HITS 1]**.' },
        enhancements:[
          { name:'Headwoppa’s Killchoppa', pts:15, text:'**ORKS** model only. If this unit made a **charge move** this turn, this model’s melee attacks have +1 AP.' },
          { name:'Da Boss is Watchin’', pts:25, text:'**ORKS** model only. (Once per battle, per army) In your Movement phase, you can use this ability. If you do, this unit is **riled up** until the start of your next turn.' },
          { name:'Kunnin’ But Brutal', pts:20, text:'**ORKS** model only. When this unit is selected to make a **fall-back move**, that fall-back move does not prevent this unit from being **eligible to shoot**/**declare a charge**.' },
          { name:'Follow Me Ladz', pts:20, text:'**ORKS** model only. This unit has +2" **M**.' }
        ],
        stratagems:[
          { id:'breakin-heads', gist:'Roll one D3: your unit suffers that many mortal wounds and is no longer battle-shocked.', name:'Breakin’ Heads', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Faction: Orks','Infantry'], attached:true },
            when:'Any phase, when a friendly **attached ORKS INFANTRY** unit becomes **battle-shocked**.',
            target:'That **ORKS INFANTRY** unit. You can target that unit with this **stratagem** even though it is **battle-shocked**.',
            effect:'Roll one D3:\n- Your unit suffers a number of **mortal wounds** equal to the result.\n- Your unit is no longer **battle-shocked**.' },
          { id:'hit-em-harder', gist:'Your unit’s melee attacks have [LETHAL HITS].', name:'Hit ’Em Harder', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: Orks'] },
            mod:{ kind:'melee', when:'Fight phase', note:'[LETHAL HITS]' },
            when:'Fight phase, when a friendly **ORKS** unit is **selected to fight**.',
            target:'That **ORKS** unit.',
            effect:'Your unit’s melee attacks have **[LETHAL HITS]**.' },
          { id:'orks-is-never-beaten', gist:'Model in your unit destroyed, unit not selected to fight this phase: D6 (+1 if riled up); on a 4+ it stays until your unit has fought or the phase ends.', name:'Orks Is Never Beaten', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: Orks'], none:['Titanic'] },
            when:'Fight phase, when an enemy unit targets a friendly **ORKS** unit (excluding **TITANIC** units).',
            target:'That **ORKS** unit.',
            effect:'When a model in your unit is **destroyed**, if your unit has not been **selected to fight** this phase, roll one D6, with +1 to that roll if your unit is **riled up**:\n- On a 4+, do not remove that model from the battlefield. When your unit has fought, or at the end of the phase (whichever comes first), that model is removed from the battlefield.' },
          { id:'mow-em-down', gist:'Your unit’s melee attacks have [CLEAVE 1], or +1 to the value of a [CLEAVE] they already have.', name:'Mow ’Em Down', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: Orks','Vehicle'], none:['Walker'] },
            when:'Fight phase, when a friendly **ORKS VEHICLE** unit (excluding **WALKER** units) that made a **charge move** this turn is **selected to fight**.',
            target:'That **ORKS VEHICLE** unit.',
            effect:'Your unit’s melee attacks have:\n- **[CLEAVE 1]**.\n- Or: If that attack already has **[CLEAVE]**, +1 to the value of that **[CLEAVE]** (e.g. **[CLEAVE 1]** becomes **[CLEAVE 2]**).' },
          { id:'fungus-fuel-injection', gist:'Your unit has +2" M.', name:'Fungus-fuel Injection', cp:1, phases:['movement'], turn:'your', needs:{ all:['Faction: Orks'], any:['Mounted','Vehicle'] },
            when:'Your Movement phase, when a friendly **ORKS MOUNTED**/**VEHICLE** unit is **selected to move**.',
            target:'That **ORKS MOUNTED**/**VEHICLE** unit.',
            effect:'Your unit has +2" **M**.' },
          { id:'close-range-dakka', gist:'Your unit’s ranged attacks have [RAPID FIRE 1], or +1 to the value of a [RAPID FIRE] they already have.', name:'Close-range Dakka', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Faction: Orks'] },
            when:'Your Shooting phase, when a friendly **ORKS** unit is **selected to shoot**.',
            target:'That **ORKS** unit.',
            effect:'Your unit’s ranged attacks have:\n- **[RAPID FIRE 1]**.\n- Or: If that attack already has **[RAPID FIRE]**, +1 to the value of that **[RAPID FIRE]** (e.g. **[RAPID FIRE 1]** becomes **[RAPID FIRE 2]**).' }
        ]
      },
      'wreckas': {
        name:'Wreckas', dp:1,
        rule:{ name:'Wreckin’ and Lootin’', ph:['shooting'], turn:'your', needs:{ any:['Breaka Boyz','Flash Gitz','Tankbustas'] },
          mod:{ kind:'ranged', when:'Your Shooting phase, this unit or the target within range of an objective', cond:'objective', note:'can re-roll hit rolls of 1' },
          text:'In your Shooting phase, when a friendly **BREAKA BOYZ**/**FLASH GITZ**/**TANKBUSTAS** unit is **selected to shoot**, if any of the following apply, that unit’s attacks can re-roll **hit rolls** of 1:\n- That unit is within range of an **objective**.\n- The target of that attack is within range of an **objective**.' },
        enhancements:[
          { name:'Kaptin’s Hat', pts:25, text:'**LEADER: FLASH GITZ**\n**BIG MEK**/**WARBOSS INFANTRY** model only. When both players have deployed their armies, you can redeploy up to three friendly **ORKS INFANTRY** units. When doing so, you can set those units up in **strategic reserves**, regardless of how many units are already in strategic reserves.' },
          { name:'Supa-snazz Dakka', pts:25, upgrade:true, text:'**FLASH GITZ** unit only. This unit’s Snazzgun weapons have **[RAPID FIRE 1]**.' }
        ],
        stratagems:[
          { id:'drive-by-bustin', gist:'Your unit’s ranged attacks with weapons selected for Firing Deck have +1 to hit rolls.', name:'Drive-by Bustin’', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Faction: Orks','Transport'] },
            when:'Your Shooting phase, when a friendly **ORKS TRANSPORT** unit is **selected to shoot**.',
            target:'That **ORKS TRANSPORT** unit.',
            effect:'Your unit’s ranged attacks with weapons selected for the **Firing Deck** ability have +1 to **hit rolls**.' },
          { id:'grab-it', gist:'After shooting: can make a normal move of up to 6", ending within range of an objective; not eligible to declare a charge this turn.', name:'Grab It', cp:1, phases:['shooting'], turn:'your', needs:{ any:['Breaka Boyz','Flash Gitz','Tankbustas'] },
            when:'Your Shooting phase, when a friendly **unengaged BREAKA BOYZ**/**FLASH GITZ**/**TANKBUSTAS** unit has shot.',
            target:'That **BREAKA BOYZ**/**FLASH GITZ**/**TANKBUSTAS** unit.',
            effect:'- Your unit can make a **normal move** of up to 6", and must end that move within range of an **objective**.\n- Your unit is not **eligible to declare a charge** until the end of the turn.' },
          { id:'gun-crazy-show-offs', gist:'After an enemy unit has shot and hit yours: your unit shoots using normal shooting, but only at that enemy unit.', name:'Gun-crazy Show-offs', cp:1, phases:['shooting'], turn:'opp', needs:{ any:['Flash Gitz','Tankbustas'] },
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
        // short reminders shown in the stratagem phase views (app wording, not rules text)
        remind:[
          { ph:['movement','charge'], turn:'either', turns:{ movement:'your' }, text:'Quality 3–4 (eager for the challenge): +2" Move, +1 to Advance and Charge rolls.' },
          { ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' }, text:'Quality 1–2 (martial valour): each time a Knight shoots or fights, re-roll one Hit roll and one Wound roll.' }
        ],
        text:'If your Army Faction is **IMPERIAL KNIGHTS**, at the end of the Read Mission Objectives step, you must determine your army’s Oath for the coming battle. An Oath consists of two parts - one Deed and one Quality. There are three options for each part, shown below.\nTo determine your army’s Deed, you can either select one Deed or you can randomly select one Deed by rolling a D6 and consulting the relevant table below. The selected Deed will describe what needs to be achieved in order to complete that Deed.\nTo determine your army’s Quality, you can either select one Quality or you can randomly select one Quality by rolling a D6 and consulting the relevant table below. Until the end of the battle, the ability described in the Quality selected applies to all models in your army with this ability.\nThe first time your selected Deed is completed your Oath is fulfilled and, until the end of the battle, your army becomes Honoured and you gain 2CP, or 3CP if you randomly selected your Deed and/or Quality (CP gained in this way are an exemption to the Core Rules that limit the maximum number of CP you can gain per battle round to 1).',
        table:[
          ['Deed 1–2 · We vow to lay low the tyrant…', 'At the start of the battle, select one **CHARACTER** model in your opponent’s army. This Deed is completed at the end of a turn if that **CHARACTER** is destroyed.'],
          ['Deed 3–4 · We swear to reclaim the realm…', 'This deed is completed at the end of your opponent’s turn if you control more objective markers than your opponent.'],
          ['Deed 5–6 · We pledge to reap a great tally…', 'This deed is completed at the end of the battle round if the number of enemy units destroyed this battle round is greater than the battle round number even if those units are subsequently returned to the battlefield (for example, two destroyed enemy units in the first battle round).'],
          ['Quality 1–2 · …with our martial valour risen over all', 'Each time this model is selected to shoot or fight, you can re-roll one **Hit roll** and you can re-roll one **Wound roll**.'],
          ['Quality 3–4 · …and we are eager for the challenge', 'Add 2" to this model’s Move characteristic and add 1 to **Advance** and **Charge rolls** made for this model.'],
          ['Quality 5–6 · …yet shall our legacy be unsullied', 'Improve this model’s Objective Control characteristic by 2 and its Leadership characteristic by 1.']
        ] },
      // needs: a Bondsman ability only ever affects an ARMIGER model, so without one in the army it does nothing
      { name:'Bondsman', ph:['command'], turn:'your', needs:{ any:['Armiger'] },
        text:'Some **IMPERIAL KNIGHTS** models have a Bondsman ability, tagged with the word ‘Bondsman’. In your Command phase, one or more models from your army with a Bondsman ability can use that ability. For each one that does, select one friendly **ARMIGER** model within 12" of that model (you cannot select an **ARMIGER** model that is already being affected by a Bondsman ability). Until the start of your next Command phase, that **ARMIGER** model is affected by that Bondsman ability.' }
    ],
    detachments: {
      'freeblade-company': {
        name:'Freeblade Company', dp:3,
        // rule, enhancements and stratagems: Wahapedia wording (Freeblade Company, App. Imperial Knights 11th edition v1.2),
        // checked word for word against GW's Faction Pack v1.2 (legal from 26 Aug 2026), pp5-6, which prints this detachment in full.
        rule:{ name:'Knights of Legend', ph:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Faction: Imperial Knights'] },
          // proposed: the app adds this to the "When targeted" line of every unit the rule applies to
          def:'Feel No Pain 6+',
          text:'**IMPERIAL KNIGHTS** models from your army have the **Feel No Pain 6+** ability. In addition, at the start of your Command phase, each **IMPERIAL KNIGHTS** model from your army regains 1 lost wound.' },
        enhancements:[
          { name:'Bringer of Justice', pts:30, text:'**IMPERIAL KNIGHTS** model only. Improve the Attacks characteristic of melee weapons equipped by the bearer by 2, and each time the bearer makes a melee attack, add 1 to the **Hit roll**.' },
          { name:'Hunter’s Eye', pts:25, text:'**IMPERIAL KNIGHTS** model only. Ranged weapons equipped by the bearer have the **[IGNORES COVER]** ability.' },
          { name:'Mysterious Guardian', pts:35, text:'**IMPERIAL KNIGHTS** model only. (Once per battle, per army) At the end of your opponent’s turn, if this unit is **unengaged**, you can use this ability. If you do:\n- Place this unit in **strategic reserves**.\n- This unit has **Deep Strike** until the start of your next Shooting phase.\n- This unit must make an **ingress move** in your next Movement phase (including in your first turn).' },
          { name:'Sanctuary', pts:20, text:'**IMPERIAL KNIGHTS** model only. The bearer has a 5+ invulnerable save.' }
        ],
        stratagems:[
          { id:'noble-sacrifice', gist:'Its Deadly Demise inflicts mortal wounds on a D6 roll of 4+ (adding 1 if it is an ARMIGER unit) instead of only a 6.', name:'Noble Sacrifice', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Faction: Imperial Knights'] },
            when:'Any phase.',
            target:'One **IMPERIAL KNIGHTS** unit from your army that was just destroyed. You can target that unit with this Stratagem even though it was just destroyed.',
            effect:'Your unit’s **Deadly Demise** ability inflicts **mortal wounds** on a D6 roll of 4+, adding 1 to the result if it is an **ARMIGER** unit, instead of only a 6.' },
          { id:'strength-from-exile', gist:'Until the end of the phase, if no other friendly units are within 9", your unit’s attacks re-roll a hit roll of 1 and a wound roll of 1.', mod:{ kind:'all', when:'No other friendly unit within 9"', note:'re-roll hit and wound rolls of 1 (your Shooting or the Fight phase)', calc:{ rrHit:'1s', rrWound:'1s' } }, name:'Strength from Exile', cp:1, phases:['shooting','fight'], turn:'either', turns:{ shooting:'your' }, needs:{ all:['Faction: Imperial Knights'] },
            when:'Your Shooting phase or the Fight phase.',
            target:'One **IMPERIAL KNIGHTS** unit from your army that has not been selected to shoot or fight this phase.',
            effect:'Until the end of the phase, each time a model in your unit makes an attack, if there are no other friendly units within 9" of your unit, re-roll a **Hit roll** of 1 and re-roll a **Wound roll** of 1.' },
          // The Faction Pack (p6) prints DESTRIER as a keyword, not struck through: Wahapedia's strike-through is its
          // "Keyword does not appear in that faction" marker, not errata, so the effect uses the pack's wording.
          // The pack's Rules Updates entry "Full Tilt Stratagem, Target Section" (PDF p27) is under VALOURSTRIKE LANCE: it is that
          // detachment's 2CP Full Tilt, a different stratagem, so this one's target stays as printed.
          { id:'full-tilt', gist:'Until the end of the phase, if your unit Advances, no Advance roll: +6" Move instead (+9" for an ARMIGER or DESTRIER unit).', name:'Full Tilt', cp:1, phases:['movement'], turn:'your', needs:{ all:['Faction: Imperial Knights'] },
            when:'Your Movement phase.',
            target:'One **IMPERIAL KNIGHTS** unit from your army.',
            effect:'Until the end of the phase, if your unit Advances, do not make an Advance roll for it. Instead, until the end of the phase, add 6" to the Move characteristic of models in your unit, or 9" instead if your unit is an **ARMIGER** or **DESTRIER** unit.' },
          { id:'point-blank-barrage', gist:'Until the end of the phase, your unit’s Blast weapons can target enemy units within Engagement Range of it (if no other friendly unit is within Engagement Range of that enemy unit) and it has no hit roll penalty for being within Engagement Range; each unmodified hit roll of 1 with a Blast weapon against a unit within Engagement Range of it is 1 mortal wound to your unit, after all its attacks are resolved.', name:'Point-Blank Barrage', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Faction: Imperial Knights'] },
            when:'Your Shooting phase.',
            target:'One **IMPERIAL KNIGHTS** unit from your army that has not been selected to shoot this phase.',
            effect:'Until the end of the phase, when making ranged attacks with Blast weapons, models in your unit can target enemy units within **Engagement Range** of your unit (provided no other friendly units are also within Engagement Range of that enemy unit). In addition, until the end of the phase, your unit does not suffer the penalty to its **Hit rolls** for being within Engagement Range of one or more enemy units, but each time a model in your unit makes an attack with a Blast weapon that targets a unit within Engagement Range of your unit, on an unmodified Hit roll of 1, your unit suffers 1 **mortal wound** after all of its attacks have been resolved.' },
          { id:'survivor-of-strife', gist:'Until the end of the phase, attacks against your unit whose S is greater than its T have -1 to the wound roll.', def:'their Shooting phase: -1 to wound when the attack’s S is greater than its T', defCalc:{ woundMinusSgt:1 }, name:'Survivor of Strife', cp:1, phases:['shooting'], turn:'opp', needs:{ all:['Faction: Imperial Knights'] },
            when:'Your opponent’s Shooting phase, just after an enemy unit has selected its targets.',
            target:'One **IMPERIAL KNIGHTS** unit from your army that was selected as the target of one or more of the attacking unit’s attacks.',
            effect:'Until the end of the phase, each time an attack targets your unit, if the Strength characteristic of that attack is greater than the Toughness characteristic of your unit, subtract 1 from the **Wound roll**.' },
          { id:'flanking-manoeuvres', gist:'Remove your unit from the battlefield and place it into Strategic Reserves.', name:'Flanking Manoeuvres', cp:1, phases:['fight'], turn:'opp', needs:{ all:['Armiger'] },
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
        // short reminder shown in the stratagem phase views (app wording, not rules text)
        remind:[
          { ph:['command'], turn:'either', text:'Start of the battle round: roll 8 D6, activate up to two Blessings.' },
          { ph:['charge'], turn:'either', text:'Unbridled Bloodlust active? +1 to charge rolls. Battle-lust: while Unbridled Bloodlust is active for your army, add 1 to Charge rolls made for the Slaughterbound’s unit. Archslaughterer used: every Blessing of Khorne is active for the Lord’s unit until the start of your next turn.' },
          { ph:['fight'], turn:'either', text:'Active Blessings: Martial Excellence [SUSTAINED HITS 1] · Warp Blades [LETHAL HITS] · Decapitating Strikes [DEVASTATING WOUNDS] vs INFANTRY · Rage-fuelled Invigoration: 6" pile-in and consolidation · Total Carnage: each time a model is destroyed by a melee attack, if it has not fought this phase, on a 4+ it is not removed; it can fight after the attacking unit has finished making its attacks, then is removed. Archslaughterer used: all six for the Lord’s unit.' }
        ],
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
        ] }
    ],
    detachments: {
      'berzerker-warband': {
        name:'Berzerker Warband', dp:2,
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
          { id:'blood-offering', gist:'One of those objective markers stays under your control until your opponent’s Level of Control over it is greater than yours at the end of a phase.', name:'Blood Offering', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Faction: World Eaters'] },
            when:'Any phase.',
            target:'One **WORLD EATERS** unit from your army that was just destroyed while it was within range of one or more objective markers you controlled at the end of the previous phase. You can use this Stratagem on that unit even though it was just destroyed.',
            effect:'Select one of those objective markers. That objective marker remains under your control until your opponent’s Level of Control over that objective marker is greater than yours at the end of a phase.' },
          { id:'hack-and-slash', gist:'Until the end of the phase, your unit’s melee weapons have +1 AP.', mod:{ kind:'melee', when:'Made a charge move this turn', cond:'charged', note:'+1 AP in the Fight phase' }, name:'Hack and Slash', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: World Eaters'] },
            when:'Fight phase.',
            target:'One **WORLD EATERS** unit from your army that has not been selected to fight this phase and that made a **charge move** this turn.',
            effect:'Until the end of the phase, improve the Armour Penetration characteristic of melee weapons equipped by models in your unit by 1.' },
          { id:'frenzied-resilience', gist:'Until the end of the phase, -1 Damage to each attack allocated to a model in your unit.', def:'Fight phase: -1 Damage to each attack allocated to it', name:'Frenzied Resilience', cp:2, phases:['fight'], turn:'either', needs:{ all:['Faction: World Eaters'] },
            when:'Fight phase, just after an enemy unit has selected its targets.',
            target:'One **WORLD EATERS** unit from your army that was selected as the target of one or more of the attacking unit’s attacks.',
            effect:'Until the end of the phase, each time an attack is allocated to a model in your unit, subtract 1 from the Damage characteristic of that attack.' },
          { id:'skulls-for-the-skull-throne', gist:'Make a Blessings of Khorne roll and use it to activate one Blessing of Khorne, active until the end of the battle round in addition to the others.', name:'Skulls for the Skull Throne!', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: World Eaters'] },
            when:'Fight phase, just after a **WORLD EATERS** unit from your army destroys a **CHARACTER** or **MONSTER** model.',
            target:'That **WORLD EATERS** unit.',
            effect:'Make a **Blessings of Khorne roll** and use the results to activate one Blessing of Khorne. Until the end of the battle round, that Blessing of Khorne is active in addition to any other Blessings of Khorne that are currently active.' },
          // New Recruit gives the Khorne Berzerkers the keyword "Berzerkers"
          // (Wahapedia's phase icon for this one is the Charge phase; the WHEN is the Movement phase, so it is listed there)
          { id:'apoplectic-frenzy', gist:'Until the end of the turn, your unit is eligible to declare a charge even though it Advanced.', name:'Apoplectic Frenzy', cp:1, phases:['movement'], turn:'your', needs:{ all:['Berzerkers'] },
            when:'Your Movement phase, just after a **KHORNE BERZERKERS** unit from your army is selected to **Advance**.',
            target:'That **KHORNE BERZERKERS** unit.',
            effect:'Until the end of the turn, your unit is eligible to declare a charge in a turn in which it Advanced.' },
          // target and effect: Wahapedia errata wording (bolds "surge move")
          { id:'berzerkers-wrath', gist:'Your unit’s surge move is up to 8" instead of a D6 roll.', name:'Berzerker’s Wrath', cp:1, phases:['shooting'], turn:'opp', needs:{ all:['Berzerkers'] },
            note:'Wahapedia FAQ: “After being the target of a ranged attack, can a Leader unit make a Blood Surge move if it was previously attached to a unit of Khorne Berzerkers and if the last model in the attached unit was destroyed by that ranged attack?” No.',
            when:'Your opponent’s Shooting phase, just after an enemy unit has shot.',
            target:'One **KHORNE BERZERKERS** unit from your army that can make a **surge move** as a result of those attacks.',
            effect:'Do not roll a D6 to determine how far models in your unit can move when they make a **surge move**. Instead, when making a **surge move**, those models can move up to 8".' }
        ]
      },
      // Butchers of Khorne: the Faction Pack (1.3, p3) prints it in full, word for word as Wahapedia; its Rules Updates do not change it
      'butchers-of-khorne': {
        name:'Butchers of Khorne', dp:1,
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
          { id:'focused-ferocity', gist:'Your unit’s melee attacks have +1 A.', mod:{ kind:'melee', when:'When selected to fight', note:'+1 A' }, name:'Focused Ferocity', cp:1, phases:['fight'], turn:'either', needs:{ all:['Terminator Squad'] },
            when:'Fight phase, when a friendly **TERMINATOR SQUAD** unit is **selected to fight**.',
            target:'That **TERMINATOR SQUAD** unit.',
            effect:'Your unit’s melee attacks have +1 **A**.' },
          { id:'a-trophy-for-the-throne', gist:'Your unit’s attacks against a MONSTER/VEHICLE unit have +1 to wound rolls.', mod:{ kind:'melee', when:'When selected to fight, vs MONSTER/VEHICLE targets', note:'+1 to wound rolls', vs:{ any:['Monster','Vehicle'] } }, name:'A Trophy for the Throne', cp:1, phases:['fight'], turn:'either', needs:{ all:['Terminator Squad'] },
            when:'Fight phase, when a friendly **TERMINATOR SQUAD** unit is **selected to fight**.',
            target:'That **TERMINATOR SQUAD** unit.',
            effect:'Your unit’s attacks that target a **MONSTER/VEHICLE** unit have +1 to **wound rolls**.' },
          // "Shooting Phase" with a capital P, as both the pack and Wahapedia print it
          { id:'wrath-beyond-reason', gist:'Ranged attacks that target your unit have -1 D until that enemy unit has attacked.', def:'their Shooting phase: -1 D to ranged attacks that target it (until that enemy unit has attacked)', defCalc:{ dMinus:1, dChar:true }, name:'Wrath Beyond Reason', cp:2, phases:['shooting'], turn:'opp', needs:{ all:['Terminator Squad'] },
            when:'Your opponent’s Shooting Phase, when an enemy unit targets a friendly **TERMINATOR SQUAD** unit.',
            target:'That **TERMINATOR SQUAD** unit.',
            effect:'Ranged attacks that target your unit have -1 **D** until that enemy unit has attacked.' }
        ]
      },
      'vessels-of-wrath': {
        name:'Vessels of Wrath', dp:1,
        rule:{ name:'Wrath of Khorne', ph:['fight'], turn:'either', needs:{ all:['Faction: World Eaters','Character'], none:['Epic Hero'] },
          mod:{ kind:'melee', when:'When selected to fight', note:'CHARACTER models: [CLEAVE 1] or +1 AP',
            pick:[{ name:'[CLEAVE 1]', note:'CHARACTER models: [CLEAVE 1]' }, { name:'+1 AP', note:'CHARACTER models: +1 AP' }] },
          text:'When a friendly **WORLD EATERS CHARACTER** unit (excluding **EPIC HERO** units) is **selected to fight**, that unit’s **CHARACTER** models’ melee attacks can have:\n- **[CLEAVE 1]**.\n- Or: +1 **AP**.' },
        enhancements:[
          { name:'Archslaughterer', pts:30, text:'**WORLD EATERS** model only. (Once per battle, per army) In your Command phase, you can use this ability. If you do, every **Blessing of Khorne** is active for this unit until the start of your next turn.' },
          { name:'Gateways to Glory', pts:10, text:'**WORLD EATERS DAEMON PRINCE** model only. This model has:\n- **MOBILE**.\n- +1 to **charge rolls**.' }
        ],
        stratagems:[
          { id:'scorn-the-witch', gist:'Your unit has Feel No Pain 4+ against mortal wounds.', def:'Feel No Pain 4+ against mortal wounds', name:'Scorn the Witch', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Faction: World Eaters','Character'], none:['Epic Hero'] },
            when:'Any phase, when a friendly **WORLD EATERS CHARACTER** unit (excluding **EPIC HERO** units) suffers a **mortal wound**.',
            target:'That **WORLD EATERS CHARACTER** unit.',
            effect:'Your unit has **Feel No Pain 4+** against **mortal wounds**.' },
          { id:'aspire-to-infamy', gist:'Your unit’s CHARACTER models’ melee attacks have +1 A and +2 S.', mod:{ kind:'melee', when:'When selected to fight', note:'CHARACTER models +1 A, +2 S' }, name:'Aspire to Infamy', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: World Eaters','Character'], none:['Epic Hero'] },
            when:'Fight phase, when a friendly **WORLD EATERS CHARACTER** unit (excluding **EPIC HERO** units) is **selected to fight**.',
            target:'That **WORLD EATERS CHARACTER** unit.',
            effect:'Your unit’s **CHARACTER** models’ melee attacks have:\n- +1 **A**.\n- +2 **S**.' },
          { id:'punish-the-craven', gist:'That enemy unit must use desperate escape (-1 to those hazard rolls if it is battle-shocked).', name:'Punish the Craven', cp:1, phases:['movement'], turn:'opp', needs:{ all:['Faction: World Eaters','Character'] },
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
        ] },
      { name:'Pact of Sorcery',
        text:'When mustering your army, unless specifically stated otherwise, you cannot select **SCINTILLATING LEGIONS** as your Army Faction.' }
    ],
    detachments: {
      'grand-coven': {
        name:'Grand Coven', dp:3,
        // rule, enhancements and stratagems: Wahapedia, Thousand Sons, Grand Coven
        // needs: the units with Psychic weapons (every one of them is a PSYKER unit)
        rule:{ name:'Kindred Sorcery', ph:['command','movement','shooting','fight'], turn:'either', turns:{ command:'your', movement:'opp', shooting:'your' }, needs:{ all:['Faction: Thousand Sons'] },
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
          { name:'Incandaeum', pts:15, text:'**EXALTED SORCERER** model only. Once per battle, when selecting a **Ritual** for the bearer to attempt, you can select Doombolt, even if a model from your army have already attempted to manifest that Ritual this phase.' },
          { name:'Umbralefic Crystal', pts:30, text:'**THOUSAND SONS** model only. (Once per battle, per army) In your Command phase, if this unit is **unengaged**, you can use this ability. If you do:\n- Place this unit in **strategic reserves**.\n- This unit has **Deep Strike** until the start of your next Shooting phase.\n- This unit must make an **ingress move** in your next Movement phase (including in your first turn).' },
          { name:'Eldritch Vortex of E’taph', pts:35, text:'**THOUSAND SONS** model only. Add 1 to the Strength and Damage characteristics of Psychic weapons equipped by the bearer.' }
        ],
        // phases and turn from Wahapedia's stratagem icons (Any/Either, Command/Your, Shooting/Your)
        stratagems:[
          // effect: Wahapedia's current wording (checked 20 Oct 2026; the Faction Pack 1.3 Rules Updates do not change this stratagem)
          { id:'psychic-dominion', gist:'Until the end of the phase, attacks made against your unit with Psychic weapons have [HAZARDOUS], and models in your unit have Feel No Pain 4+ against Psychic Attacks.', def:'Feel No Pain 4+ against psychic attacks; attacks against it with Psychic weapons have [HAZARDOUS]', name:'Psychic Dominion', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Faction: Thousand Sons'] },
            when:'Any phase, just after an enemy unit has selected its targets.',
            target:'One **THOUSAND SONS** unit from your army that was selected as the target of one or more of the attacking unit’s attacks.',
            effect:'Until the end of the phase, all attacks made against your unit with Psychic weapons have the **[HAZARDOUS]** ability and all models in your unit have the **Feel No Pain 4+** ability against **Psychic Attacks**.' },
          // mod/def candidate, not active: def:'After a failed save for a PSYKER model: that attack’s Damage becomes 0'
          { id:'destined-by-fate', gist:'Change the Damage of that attack to 0.', def:'after a failed save for a PSYKER model, that attack’s Damage becomes 0', name:'Destined by Fate', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Faction: Thousand Sons','Psyker'] },
            when:'Any phase, just after a saving throw is failed for a **THOUSAND SONS PSYKER** model from your army. If you are using fast dice rolling, this Stratagem can still be used after rolling multiple saving throws at once.',
            target:'That **PSYKER** model.',
            effect:'Change the Damage characteristic of that attack to 0. If you are using fast dice rolling, select one of those attacks you failed a saving throw for.' },
          // mod/def candidate, not active: mod:{ kind:'all', when:'Egotistical Power on this unit', note:'Psychic weapons: the Kindred Sorcery ability you pick, even one already used' }
          { id:'egotistical-power', gist:'Until the start of your next Command phase, your unit has Imbued Manifestation, Psychic Maelstrom or Wrath of the Immaterium instead of any other Kindred Sorcery ability, even one already selected this battle.', name:'Egotistical Power', cp:1, phases:['command'], turn:'your', needs:{ all:['Faction: Thousand Sons','Psyker'] },
            when:'Your Command phase.',
            target:'One **THOUSAND SONS PSYKER** unit from your army.',
            effect:'Select the Imbued Manifestation, Psychic Maelstrom or Wrath of the Immaterium ability. Until the start of your next Command phase, that ability applies to your unit instead of any other Kindred Sorcery ability, even if you have already selected that ability this battle.' },
          { id:'desecration-of-worlds', gist:'That objective marker stays under your control until your opponent’s Level of Control over it is greater than yours at the end of a phase.', name:'Desecration of Worlds', cp:1, phases:['command'], turn:'your', needs:{ all:['Faction: Thousand Sons','Psyker'] },
            when:'Your Command phase.',
            target:'One **THOUSAND SONS PSYKER** unit from your army within range of an objective marker you control.',
            effect:'That objective marker remains under your control until your opponent’s Level of Control over that objective marker is greater than yours at the end of a phase.' },
          // needs: only models with Cabal of Sorcerers take Psychic tests; in this list every one of them is a PSYKER
          { id:'arcane-focus', gist:'Re-roll all the D6 of that Psychic test (the Channelling the Warp D6 included).', name:'Arcane Focus', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Faction: Thousand Sons'] },
            when:'Your Shooting phase, just after you take a Psychic test for a **THOUSAND SONS** model from your army that Channelled the Warp (before resolving that **Ritual**).',
            target:'That **THOUSAND SONS** model.',
            effect:'Re-roll all of the D6 rolled for that Psychic test (including the additional D6 for Channelling the Warp).' },
          // mod/def candidate, not active: mod:{ kind:'ranged', when:'Devastating Sorcery used this phase', note:'Psychic weapons +9" range; re-roll hit rolls and wound rolls with Psychic weapons' }
          { id:'devastating-sorcery', gist:'Until the end of the phase, your unit’s Psychic weapons have +9" range and can re-roll the hit roll and the wound roll.', mod:{ kind:'ranged', when:'Psychic weapons, your Shooting phase', note:'+9" range, re-roll hit and wound rolls' }, name:'Devastating Sorcery', cp:2, phases:['shooting'], turn:'your', needs:{ all:['Faction: Thousand Sons','Psyker'] },
            when:'Your Shooting phase.',
            target:'One **THOUSAND SONS PSYKER** unit from your army that has not been selected to shoot this phase.',
            effect:'Until the end of the phase, add 9" to the Range characteristic of Psychic weapons equipped by models in your unit, and each time a model in your unit makes an attack with a Psychic weapon, you can re-roll the **Hit roll** and you can re-roll the **Wound roll**.' }
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
        // short reminders shown in the stratagem phase views (app wording, not rules text)
        remind:[
          { ph:['command','movement','shooting','charge','fight'], turn:'either', text:'Within Synapse Range: Battle-shock tests are taken on 3D6 instead of 2D6.' },
          { ph:['fight'], turn:'either', text:'Within Synapse Range: melee attacks have +1 S.' }
        ],
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
        name:'Crusher Stampede', dp:2,
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
          { id:'corrosive-viscera', gist:'Its Deadly Demise mortal wounds are inflicted automatically (no D6 roll).', name:'Corrosive Viscera', cp:1, phases:['shooting','fight'], turn:'either', turns:{ shooting:'opp' }, needs:{ all:['Faction: Tyranids','Monster'], none:['Fly'] },
            when:'Your opponent’s Shooting phase or the Fight phase, just after a **TYRANIDS MONSTER** model from your army with the **Deadly Demise** ability that cannot **FLY** is destroyed.',
            target:'That **TYRANIDS MONSTER** model. You can use this Stratagem on that model even though it was just destroyed.',
            effect:'Do not roll one D6 to determine whether **mortal wounds** are inflicted by your model’s Deadly Demise ability. Instead, mortal wounds are automatically inflicted.' },
          { id:'rampaging-monstrosities', gist:'Until the end of the phase, your unit’s attacks can re-roll the hit roll.', mod:{ kind:'melee', when:'Fight phase', note:'re-roll hit rolls' }, name:'Rampaging Monstrosities', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: Tyranids','Monster'] },
            when:'Fight phase.',
            target:'One **TYRANIDS MONSTER** unit from your army that has not been selected to fight this phase.',
            effect:'Until the end of the phase, each time a model in your unit makes an attack, you can re-roll the **Hit roll**.' },
          { id:'savage-roar', gist:'That enemy unit takes a Battle-shock test and has -1 to hit your unit until the end of the phase; also -1 to wound if it failed the test.',
            defPick:[{ name:'Test passed', calc:{ hitMinus:1 } }, { name:'Test failed', calc:{ hitMinus:1, woundMinus:1 } }], name:'Savage Roar', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: Tyranids','Monster'] },
            when:'Fight phase, just after an enemy unit has selected its targets.',
            target:'One **TYRANIDS MONSTER** unit from your army that was selected as the target of one or more of the attacking unit’s attacks.',
            effect:'That enemy unit must take a **Battle-shock test** and, until the end of the phase, each time a model in that enemy unit makes an attack that targets your unit, subtract 1 from the **Hit roll**. If that Battle-shock test was failed, subtract 1 from the **Wound roll** as well.' },
          // Wahapedia wording (the errata "Change to" text has the same words, without the bold)
          { id:'untrammelled-ferocity', gist:'Until the end of the phase, your unit’s Normal, Advance and Fall Back moves can pass through models (excluding TITANIC) and terrain up to 4" tall, and through Engagement Range without ending there; taller terrain too, but then, after your unit has moved, roll one D6: on a 1, your unit is Battle-shocked.', name:'Untrammelled Ferocity', cp:1, phases:['movement'], turn:'your', needs:{ all:['Faction: Tyranids','Monster'] },
            when:'Your Movement phase.',
            target:'One **TYRANIDS MONSTER** unit from your army that has not been selected to move this phase.',
            effect:'Until the end of the phase, each time a model in your unit makes a **Normal**, **Advance** or **Fall Back move**, it can move through models (excluding **TITANIC** models) and sections of **terrain features** that are 4" or less in height. When doing so:\n- It can move within **Engagement Range** of enemy models, but cannot end that move within Engagement Range of them.\n- It can also move through sections of terrain features that are more than 4" in height, but if it does, after its unit has moved, roll one D6: on a 1, your unit is **Battle-shocked**.' },
          { id:'swarm-guided-salvoes', gist:'Until the end of the phase, your unit’s ranged weapons have [IGNORES COVER], and its attacks can ignore any or all modifiers to BS and to the hit roll.', mod:{ kind:'ranged', when:'Your Shooting phase', note:'[IGNORES COVER]; can ignore any or all modifiers to BS and any or all modifiers to the hit roll' }, name:'Swarm-guided Salvoes', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Faction: Tyranids','Monster'] },
            when:'Your Shooting phase.',
            target:'One **TYRANIDS MONSTER** unit from your army that has not been selected to shoot this phase.',
            effect:'Until the end of the phase, ranged weapons equipped by models in your unit have the **[IGNORES COVER]** ability, and until the end of the phase each time a model in your unit makes an attack, you can ignore any or all modifiers to that model’s Ballistic Skill characteristic and any or all modifiers to the **Hit roll**.' },
          { id:'massive-impact', gist:'Select one enemy unit within Engagement Range of your model and roll six D6: 1 mortal wound for each 4+.', name:'Massive Impact', cp:1, phases:['charge'], turn:'your', needs:{ all:['Faction: Tyranids','Monster'] },
            when:'Your Charge phase, just after a **TYRANIDS MONSTER** model from your army ends a **Charge move**.',
            target:'That **TYRANIDS MONSTER** model.',
            effect:'Select one enemy unit within **Engagement Range** of your model and roll six D6: for each 4+, that enemy unit suffers 1 **mortal wound**.' }
        ]
      },
      'talons-of-the-norn-queen': {
        name:'Talons of the Norn Queen', dp:1,
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
          { id:'catalytic-biofortification', gist:'Your unit has Feel No Pain 4+ against mortal wounds.', def:'Feel No Pain 4+ against mortal wounds', name:'Catalytic Biofortification', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Norn Assimilator'] },
            when:'Any phase, when a friendly **NORN ASSIMILATOR** unit suffers a **mortal wound**.',
            target:'That **NORN ASSIMILATOR** unit.',
            effect:'Your unit has **Feel No Pain 4+** against **mortal wounds**.' },
          { id:'lesser-prey', gist:'Your unit’s melee attacks have +2 S.', mod:{ kind:'melee', when:'When selected to fight', note:'+2 S' }, name:'Lesser Prey', cp:1, phases:['fight'], turn:'either', needs:{ any:['Norn Assimilator','Norn Emissary'] },
            when:'Fight phase, when a friendly **NORN ASSIMILATOR/NORN EMISSARY** unit is **selected to fight**.',
            target:'That **NORN ASSIMILATOR/NORN EMISSARY** unit.',
            effect:'Your unit’s melee attacks have +2 **S**.' },
          { id:'tanglestrike-rounds', gist:'One enemy unit hit by those attacks is tethered (-2" M) until the start of your next Command phase.', name:'Tanglestrike Rounds', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Norn Assimilator'] },
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
        ] }
    ],
    detachments: {
      'cohort-cybernetica': {
        name:'Cohort Cybernetica', dp:1,
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
          { id:'motive-imperative', gist:'Until the start of your next Command phase, your unit has +3" Move and +1 to Advance and Charge rolls.', name:'Motive Imperative', cp:1, phases:['command'], turn:'your', needs:{ all:['Faction: Adeptus Mechanicus','Vehicle'] },
            when:'Your Command phase.',
            target:'One **ADEPTUS MECHANICUS VEHICLE** unit from your army.',
            effect:'Until the start of your next Command phase, add 3" to the Move characteristic of models in your unit and add 1 to **Advance** and **Charge rolls** made for it.' },
          { id:'auto-divinatory-targeting', gist:'Until the start of your next Command phase, your unit’s ranged weapons have BS 3+ and [IGNORES COVER], but can only target units within range of the selected objective marker.', name:'Auto-divinatory Targeting', cp:1, phases:['command'], turn:'your', needs:{ all:['Faction: Adeptus Mechanicus'], any:['Legio Cybernetica','Vehicle'] },
            mod:{ kind:'ranged', lasts:'round', when:'Your Command phase, until the start of your next Command phase', note:'BS 3+, [IGNORES COVER]; can only target units within range of the selected objective marker', calc:{ set:{ BS:'3+' }, ignoresCover:true } },
            note:'FAQ (Faction Pack 1.4): “If I target a unit with the Auto-divinatory Targeting Stratagem while the Protector Imperative is active for my army, in what order are the Ballistic Skill modifiers applied?” “The Ballistic Skill characteristic of ranged weapons equipped by models in that unit is first changed to 3+ by the Stratagem, then improved by 1 by the Protector Imperative, for a final result of 2+ (assuming no other modifiers apply).”',
            when:'Your Command phase.',
            target:'One **LEGIO CYBERNETICA** or **ADEPTUS MECHANICUS VEHICLE** unit from your army, and one objective marker.',
            effect:'Until the start of your next Command phase, ranged weapons equipped by models in your unit have a Ballistic Skill characteristic of 3+ and the **[IGNORES COVER]** ability, but they can only target units within range of the selected objective marker.' },
          { id:'machine-spirit-resurgent', gist:'Until the start of your next Command phase, your unit’s attacks can re-roll the hit roll, and the wound roll as well if it is Below Half-strength.', name:'Machine Spirit Resurgent', cp:1, phases:['command'], turn:'your', needs:{ all:['Faction: Adeptus Mechanicus'], any:['Legio Cybernetica','Vehicle'] },
            mod:{ kind:'all', lasts:'round', when:'Your Command phase, below its Starting Strength; until the start of your next Command phase', note:'can re-roll hit rolls (and wound rolls if Below Half-strength)',
              pick:[{ name:'Below Starting Strength', note:'re-roll hit rolls' }, { name:'Below Half-strength', note:'re-roll hit rolls and wound rolls' }] },
            when:'Your Command phase.',
            target:'One **LEGIO CYBERNETICA** or **ADEPTUS MECHANICUS VEHICLE** unit from your army that is below its Starting Strength.',
            effect:'Until the start of your next Command phase, each time a model in your unit makes an attack, you can re-roll the **Hit roll**. If your unit is **Below Half-strength**, you can re-roll the **Wound roll** as well.' },
          { id:'machine-superiority', gist:'Until the end of the turn, your unit is eligible to shoot after Falling Back, and you can ignore any or all modifiers to its characteristics and to its rolls and tests (not saving throws).', name:'Machine Superiority', cp:1, phases:['command'], turn:'your', needs:{ all:['Faction: Adeptus Mechanicus'], any:['Legio Cybernetica','Vehicle'] },
            mod:{ kind:'all', when:'Your Command phase, until the end of the turn', note:'can ignore any or all modifiers to its characteristics and to any roll or test made for it (not saving throws)' },
            when:'Your Command phase.',
            target:'One **LEGIO CYBERNETICA** or **ADEPTUS MECHANICUS VEHICLE** unit from your army.',
            effect:'Until the end of the turn, your unit is eligible to shoot in a turn in which it Fell Back and you can ignore any or all modifiers to its characteristics and/or to any roll or test made for it (excluding modifiers to saving throws).' },
          { id:'transcendent-cogitation', gist:'Until the start of your next Command phase, the Conqueror and Protector Imperatives are both active for your unit.', name:'Transcendent Cogitation', cp:1, phases:['command'], turn:'your', needs:{ all:['Faction: Adeptus Mechanicus'], any:['Legio Cybernetica','Vehicle'] },
            when:'Your Command phase.',
            target:'One **LEGIO CYBERNETICA** or **ADEPTUS MECHANICUS VEHICLE** unit from your army.',
            effect:'Until the start of your next Command phase, the Conqueror Imperative and Protector Imperative are both active for your unit.' },
          { id:'benevolence-of-the-omnissiah', gist:'Until the start of your next Command phase, your unit has Feel No Pain 6+ (5+ against mortal wounds).', def:'Feel No Pain 6+ (5+ against mortal wounds), until the start of your next Command phase', defCalc:{ fnp:6, fnpMortal:5 }, lasts:'round', name:'Benevolence of the Omnissiah', cp:1, phases:['command'], turn:'your', needs:{ all:['Faction: Adeptus Mechanicus'], any:['Legio Cybernetica','Vehicle'] },
            when:'Your Command phase.',
            target:'One **LEGIO CYBERNETICA** or **ADEPTUS MECHANICUS VEHICLE** unit from your army.',
            effect:'Until the start of your next Command phase, models in your unit have the **Feel No Pain 6+** ability, which is improved to Feel No Pain 5+ against **mortal wounds**.' }
        ]
      },
      'eradication-cohort': {
        name:'Eradication Cohort', dp:2,
        // rule, enhancements and stratagems: GW's Faction Pack v1.4 (legal from 14 Oct 2026), PDF pp5-6, which prints this
        // detachment in full (the same words as Wahapedia), with Wahapedia's markup; pts from Wahapedia, matching BSData.
        // Belicosa-class: the pack prints the name in capitals; "-class" as BSData and New Recruit spell it.
        // No ph on the rule: its words name no phase or moment.
        rule:{ name:'Murderous Imperative', needs:{ all:['Skitarii'] },
          mod:{ kind:'all', when:'Protector or Conqueror Imperative active for this unit', note:'Protector: re-roll hit rolls of 1 · Conqueror: re-roll wound rolls of 1',
            pick:[{ name:'Protector', note:'re-roll hit rolls of 1' }, { name:'Conqueror', note:'re-roll wound rolls of 1' }, { name:'Both', note:'re-roll hit rolls of 1 and wound rolls of 1' }] },
          text:'Each time a model in a **SKITARII** unit from your army makes an attack:\n- If the Protector Imperative is active for that unit, re-roll a **Hit roll** of 1.\n- If the Conqueror Imperative is active for that unit, re-roll a **Wound roll** of 1.' },
        enhancements:[
          { name:'Omnicogitator', pts:25, text:'**SKITARII MARSHAL** model only. The Conqueror Imperative and Protector Imperative are both active for the bearer’s unit.' },
          { name:'Martial Signatum Amplificator', pts:15, text:'**TECH-PRIEST** model only. Models in the bearer’s unit have the **SKITARII** keyword.' },
          { name:'Belicosa-class Capacitor Vanes', pts:25, text:'**ADEPTUS MECHANICUS** model only. Add 6" to the Range characteristic of ranged weapons equipped by models in the bearer’s unit, and add 1 to the Strength characteristic of those weapons.' },
          { name:'Omnissiah’s Fury', pts:10, text:'**SKITARII MARSHAL** model only. Add 2 to the Attacks characteristic of melee weapons equipped by the bearer, and improve the Armour Penetration and Damage characteristics of those weapons by 1.' }
        ],
        stratagems:[
          { id:'servo-driven-charge', gist:'Until the end of the phase, your unit’s melee weapons have [LANCE].', name:'Servo-driven Charge', cp:1, phases:['fight'], turn:'either', needs:{ all:['Faction: Adeptus Mechanicus'] },
            mod:{ kind:'melee', when:'Fight phase', note:'[LANCE]' },
            when:'Fight phase.',
            target:'One **ADEPTUS MECHANICUS** unit from your army that has not been selected to fight this phase.',
            effect:'Until the end of the phase, melee weapons equipped by models in your unit have the **[LANCE]** ability.' },
          { id:'unrelenting-aggression', gist:'Until the end of the turn, your unit is eligible to shoot after Falling Back (a SKITARII unit: to shoot and declare a charge).', name:'Unrelenting Aggression', cp:1, phases:['movement'], turn:'your', needs:{ all:['Faction: Adeptus Mechanicus'] },
            when:'Your Movement phase, just after an **ADEPTUS MECHANICUS** unit from your army Falls Back.',
            target:'That **ADEPTUS MECHANICUS** unit.',
            effect:'Until the end of the turn, your unit is eligible to shoot in a turn in which it Fell Back. If your unit has the **SKITARII** keyword, your unit is eligible to shoot and declare a charge in a turn in which it Fell Back instead.' },
          { id:'unshackled-wrath', gist:'Until the end of the phase, your unit’s ranged weapons have [SUSTAINED HITS 1] or [LETHAL HITS], or all of [SUSTAINED HITS 1], [LETHAL HITS] and [HAZARDOUS].', name:'Unshackled Wrath', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Skitarii'] },
            mod:{ kind:'ranged', when:'Your Shooting phase', note:'[SUSTAINED HITS 1] or [LETHAL HITS], or both and [HAZARDOUS]',
              pick:[{ name:'Sustained Hits', note:'[SUSTAINED HITS 1]' }, { name:'Lethal Hits', note:'[LETHAL HITS]' }, { name:'All three', note:'[SUSTAINED HITS 1], [LETHAL HITS] and [HAZARDOUS]' }] },
            when:'Your Shooting phase.',
            target:'One **SKITARII** unit from your army that has not been selected to shoot this phase.',
            effect:'Select the **[SUSTAINED HITS 1]** or **[LETHAL HITS]** ability. Until the end of the phase, ranged weapons equipped by models in your unit have the selected ability. You can instead select the **[SUSTAINED HITS 1]**, **[LETHAL HITS]** and **[HAZARDOUS]** abilities to apply to those weapons until the end of the phase.' },
          { id:'threat-cogitation-targeters', gist:'Until the end of the phase, your unit’s ranged attacks allocated to a MONSTER or VEHICLE model can re-roll the Damage roll.', name:'Threat-cogitation Targeters', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Skitarii','Vehicle'] },
            mod:{ kind:'ranged', when:'Your Shooting phase, attacks allocated to a MONSTER or VEHICLE model', note:'can re-roll the Damage roll', vs:{ any:['Monster','Vehicle'] } },
            when:'Your Shooting phase.',
            target:'One **SKITARII VEHICLE** unit from your army that has not been selected to shoot this phase.',
            effect:'Until the end of the phase, each time a ranged attack made by a model in your unit is allocated to a **MONSTER** or **VEHICLE** model, you can re-roll the Damage roll.' },
          { id:'precision-onslaught', gist:'When your unit ends a Charge move: one D6 for each of its models within Engagement Range of one enemy unit; 1 mortal wound to that unit for each 4+.', name:'Precision Onslaught', cp:1, phases:['charge'], turn:'your', needs:{ all:['Sicarian'] },
            when:'Your Charge phase, just after a **SICARIAN** unit from your army **declares a charge**.',
            target:'That **SICARIAN** unit.',
            effect:'Until the end of the phase, when your unit ends a **Charge move**, select one enemy unit within **Engagement Range** of it, then roll one D6 for each model in your unit that is within Engagement Range of that enemy unit: for each 4+, that enemy unit suffers 1 **mortal wound**.' },
          { id:'analytic-reprisals', gist:'Your unit shoots as if it were your Shooting phase, but only at that enemy unit (and only if it is an eligible target).', name:'Analytic Reprisals', cp:1, phases:['shooting'], turn:'opp', needs:{ all:['Skitarii','Infantry'] },
            when:'Your opponent’s Shooting phase, just after an enemy unit has shot.',
            target:'One **SKITARII INFANTRY** unit from your army that lost one or more models as a result of the attacking unit’s attacks.',
            effect:'Your unit can shoot as if it were your Shooting phase, but must target only that enemy unit when doing so, and can only do so if that enemy unit is an eligible target.' }
        ]
      }
    }
  },
};

/* ---------------- armies ----------------
   Army: id, name, faction (key into FACTIONS), points, pointsUsed, battleSize,
         disposition, detachments (keys), source;
         config: the other selections New Recruit prints under the army name, label → value
         as printed ("Code Chivalric: Deed, Quality" → { 'Code Chivalric':'Deed, Quality' }).
   Unit fields:
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
     abilities   name, text, tag, who; ph/turn/turns = the phase it triggers in;
                 def = one-line summary for the datasheet's "When targeted" line
     mods        abilities that change this unit's attacks, shown under its weapon tables:
                 kind ranged|melee|all, when, note, from. With weapon + set, that weapon's
                 cell shows both values ("8/14") and the condition becomes its footnote.
     (stratagems can carry a mod or def too: it shows on every unit that can use them,
      with its CP cost, e.g. "1CP Hack and Slash")
     (mods, auras and stratagem mods, for the Damage tab: always = applies whenever its vs holds, so the box starts
      ticked; selfAlways = the same for an aura's own unit (22.01); vs = the targets it is for: { any:[keywords] }
      (at least one), { all:[keywords] } (every one), { none:[keywords] } (none of them), { maxT:6 } (no model T 7+);
      calc = its numbers when the words of its note say more than the calculator counts; pick = a choice of one of
      several effects ([{ name, note }]: one box, the player picks which). On an ability: defAlways = its def always protects the unit,
      defCalc = the def's numbers (model: only that model); riled = this unit is always riled up)
     guard       help this unit gives other units of its list when they are attacked: needs, kind, when, note,
                 calc (insv, fnp, stealth), one = one model only
     aura        mods this unit gives to other units: needs = which units (keywords),
                 notSelf = not the unit itself, selfWhen = the condition on its own sheet
     rules       core/faction rules that open a glossary entry
     kw, kwNote  the unit's keywords ("Categories")                                     */
const ARMIES = [
{
  id:'shooty', name:'Me shooty yer’ booty', faction:'orks', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Purge the Foe',
  detachments:['dread-mob','shoota-boyz','wreckas'],
  source:'New Recruit, exported 17 Oct 2026',
  units:[
    {
      id:'wazdakka', name:'Wazdakka Gutsmek', role:'Epic Hero', pts:200,
      models:['1× Wazdakka Gutsmek'],
      gear:[['Fixit’s Wrench','Grabba Dragga','Psyko-gatler','Speeding Bulk and Flaming Exhaust']],
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
        { name:'Pulse Jet', who:'Throttlerokkit Shokka Engine', ph:['movement'], turn:'your', text:'In your Movement phase, when this unit is **selected to move**, if this unit is **unengaged**, this unit can make a **pulse jet move**.' },
        { name:'Shokk Attack Engine', who:'Throttlerokkit Shokka Engine', ph:['command'], turn:'your', text:'In your Command phase, if this unit is **unengaged**, you can place this unit in **strategic reserves**.' }
      ],
      rules:['Deadly Demise D3','Deep Strike','Lone Operative','Waaagh!'],
      kw:['Character','Epic Hero','Faction: Orks','Mounted','Smoke','Speed Freeks','Vehicle','Wazdakka Gutsmek']
    },
    {
      id:'dakkarig-herder', name:'Big Mek Dakkarig', short:'Big Mek', role:'Character', pts:190, enhancement:'Dreadherder',
      models:['1× Big Mek Dakkarig'],
      gear:[['Blitzkannon','Multi-busta Launcha','Stompy Feet']],
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
        { name:'Blitz Dem Gitz!', ph:['shooting'], turn:'your', text:'In your Shooting phase, if this unit’s Blitzkannon weapon targets a unit (excluding **MONSTER/VEHICLE** units), that weapon has +6 **A**.' },
        { name:'Dreadherder', tag:'Enhancement', ph:['shooting','fight'], turn:'your', def:'Lone Operative while within 3" of a friendly ORKS WALKER unit (not BIG MEK)', text:'**BIG MEK** model only. While this model is within 3" of a friendly **ORKS WALKER** unit (excluding **BIG MEK** units):\n- This model has **Lone Operative**.\n- In your Shooting phase, you can select one friendly **ORKS WALKER** unit within 3" of this model. That unit’s attacks can re-roll **hit rolls** of 1 until the end of the turn.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', weapon:'Blitzkannon', set:{ A:'+6' }, when:'vs non-MONSTER/VEHICLE targets', note:'in your Shooting phase', from:'Blitz Dem Gitz!', always:true, vs:{ none:['Monster','Vehicle'] } },
        { kind:'ranged', when:'Riled up', cond:'riled', note:'[SUSTAINED HITS 1]', from:'Even More Dakka' }
      ],
      aura:[
        { kind:'all', needs:{ all:['Faction: Orks','Walker'] }, when:'Picked by the Dreadherder', note:'re-roll hit rolls of 1 this turn', from:'Dreadherder', lasts:'turn' }
      ],
      rules:['Deadly Demise 1','Waaagh!'],
      kw:['Big Mek','Big Mek Dakkarig','Character','Faction: Orks','Vehicle','Walker']
    },
    {
      id:'dakkarig-boosta', name:'Big Mek Dakkarig', short:'Big Mek', role:'Character', pts:170, enhancement:'Cybork Boosta',
      models:['1× Big Mek Dakkarig'],
      gear:[['Blitzkannon','Multi-busta Launcha','Stompy Feet']],
      stats:[
        { name:'Big Mek Dakkarig', M:'10"', T:'8', Sv:'3+', W:'11', Ld:'7+', OC:'3', InSv:'5+', base:'90mm', from:{ M:'Cybork Boosta' } }
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
        { name:'Blitz Dem Gitz!', ph:['shooting'], turn:'your', text:'In your Shooting phase, if this unit’s Blitzkannon weapon targets a unit (excluding **MONSTER/VEHICLE** units), that weapon has +6 **A**.' },
        { name:'Cybork Boosta', tag:'Enhancement', text:'**BIG MEK/MEK** model only. This model has +2" **M**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', weapon:'Blitzkannon', set:{ A:'+6' }, when:'vs non-MONSTER/VEHICLE targets', note:'in your Shooting phase', from:'Blitz Dem Gitz!', always:true, vs:{ none:['Monster','Vehicle'] } },
        { kind:'ranged', when:'Riled up', cond:'riled', note:'[SUSTAINED HITS 1]', from:'Even More Dakka' }
      ],
      rules:['Deadly Demise 1','Waaagh!'],
      kw:['Big Mek','Big Mek Dakkarig','Character','Faction: Orks','Vehicle','Walker']
    },
    {
      id:'bigmek-mega', name:'Big Mek in Mega Armour', short:'Big Mek', role:'Character', pts:115, enhancement:'Supa-glowy Fing',
      models:['1× Big Mek in Mega Armour'],
      gear:[['Kustom Mega-blasta','Power Klaw','Tellyport Blasta']],
      stats:[
        { name:'Big Mek in Mega Armour', M:'5"', T:'6', Sv:'2+', W:'5', Ld:'7+', OC:'1', InSv:'–', base:'40mm' }
      ],
      ranged:[
        { name:'Kustom Mega-blasta', range:'24"', A:'3', BS:'4+', S:'9', AP:'-2', D:'3', kw:['HAZARDOUS','IGNORES COVER','ASSAULT','ANTI-INFANTRY 4+','DEVASTATING WOUNDS','SUPA-HAZARDOUS'], from:{ 'IGNORES COVER':'More Dakka', ASSAULT:'Dakka! Dakka! Dakka!', 'ANTI-INFANTRY 4+':'Supa-glowy Fing', 'DEVASTATING WOUNDS':'Supa-glowy Fing', 'SUPA-HAZARDOUS':'Supa-glowy Fing' } },
        { name:'Tellyport Blasta', range:'12"', A:'6', BS:'4+', S:'9', AP:'-2', D:'3', kw:['BLAST 1','IGNORES COVER','ASSAULT','ANTI-INFANTRY 4+','DEVASTATING WOUNDS','SUPA-HAZARDOUS'], from:{ 'IGNORES COVER':'More Dakka', ASSAULT:'Dakka! Dakka! Dakka!', 'ANTI-INFANTRY 4+':'Supa-glowy Fing', 'DEVASTATING WOUNDS':'Supa-glowy Fing', 'SUPA-HAZARDOUS':'Supa-glowy Fing' } }
      ],
      melee:[
        { name:'Power Klaw', range:'Melee', A:'3', WS:'3+', S:'10', AP:'-2', D:'2', kw:[] }
      ],
      abilities:[
        { name:'Fix Dat Armour Up', tag:'Once per battle, per unit', ph:['command'], turn:'your', text:'In your Command phase, this unit **heals** 3 wounds.\nPlace a Grot Oiler token next to the unit, removing it when this ability is used.' },
        { name:'More Dakka', text:'This unit’s ranged attacks have:\n- **[IGNORES COVER]**.\n- If this unit is **riled up**, **[SUSTAINED HITS 1]**.' },
        { name:'Supa-glowy Fing', tag:'Enhancement', text:'**ORKS INFANTRY** model only (excluding **WEIRDBOY** models). This model’s ranged attacks have:\n- **[ANTI-INFANTRY 4+]**.\n- **[DEVASTATING WOUNDS]**.\n- **[SUPA-HAZARDOUS]**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Riled up', cond:'riled', note:'[SUSTAINED HITS 1]', from:'More Dakka' }
      ],
      rules:['Waaagh!','Leader','Supa-hazardous'],
      kw:['Big Mek','Big Mek in Mega Armour','Character','Explosives','Faction: Orks','Infantry','Mega Armour']
    },
    {
      id:'warboss', name:'Warboss', role:'Character', pts:100, warlord:true,
      models:['1× Warboss'],
      gear:[['Kustom Choppa','Kustom Shoota']],
      stats:[
        { name:'Warboss', M:'6"', T:'6', Sv:'4+', W:'6', Ld:'6+', OC:'1', InSv:'5+', base:'50mm' }
      ],
      ranged:[
        { name:'Kustom Shoota', range:'18"', A:'4', BS:'5+', S:'4', AP:'0', D:'1', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 2','ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } }
      ],
      melee:[
        { name:'Kustom Choppa', range:'Melee', A:'6', WS:'2+', S:'7', AP:'-2', D:'2', kw:['CLEAVE 2'] }
      ],
      abilities:[
        { name:'Might is Right', ph:['fight'], turn:'either', text:'If this unit made a **charge move** this turn, this model’s melee attacks have:\n- +3 **A**.\n- +2 **S**.' },
        { name:'Boss’ Ammo Runt', tag:'Once per battle, per unit', ph:['shooting'], turn:'your', text:'In your Shooting phase, when this unit is **selected to shoot**, you can use this ability. If you do, this model’s ranged attacks have +1 to **hit rolls**.\nPlace a Boss’ Ammo Runt token next to the unit, removing it when this ability is used.' },
        { name:'Intimidating Motivation', tag:'Once per battle round, per army', ph:['movement'], turn:'your', text:'In your Movement phase, at the start or end of this unit’s move, you can select one friendly **ORKS** unit within 6" of this unit. That unit:\n- Is no longer **battle-shocked**.\n- Is **riled up** until the start of your next turn.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Made a charge move this turn', cond:'charged', note:'+3 A, +2 S', from:'Might is Right' },
        { kind:'ranged', when:'Boss’ Ammo Runt used (your Shooting phase, when selected to shoot)', note:'+1 to hit rolls', from:'Boss’ Ammo Runt' }
      ],
      rules:['Da Boss','Leader','Waaagh!'],
      kw:['Character','Faction: Orks','Grenades','Infantry','Warboss','Warlord']
    },
    {
      id:'mek-tankbustas', name:'Mek', role:'Character', pts:215, copies:2, ptsNote:'55 + Tankbustas 160',
      leads:'Tankbustas', support:true,
      models:['1× Mek','1× Nob','1× Tankbusta w/ Two Busta Rokkit Launchas','4× Tankbusta w/ Busta Rokkit Launcha'],
      gear:[['Kustom Mega-slugga','Mek’s Toolz'],['Choppa','Rokkit pistol','Smash Hammer'],['Busta Rokkit Launcha','Busta Rokkit Launcha','Gitstikka'],['Busta Rokkit Launcha','Gitstikka']],
      stats:[
        { name:'Mek', M:'6"', T:'5', Sv:'5+', W:'4', Ld:'7+', OC:'1', InSv:'–', base:'32mm' },
        { name:'Nob', M:'6"', T:'5', Sv:'4+', W:'3', Ld:'7+', OC:'1', InSv:'–', base:'32mm' },
        { name:'Tankbusta ×5', M:'6"', T:'5', Sv:'4+', W:'2', Ld:'7+', OC:'1', InSv:'–', base:'32mm' }
      ],
      ranged:[
        { name:'Kustom Mega-slugga', who:'Mek', range:'12"', A:'3', BS:'4+', S:'8', AP:'-2', D:'3', kw:['CLOSE-QUARTERS','HAZARDOUS','IGNORES COVER','ASSAULT'], from:{ 'IGNORES COVER':'Kustom Dakka', ASSAULT:'Dakka! Dakka! Dakka!' } },
        { name:'Rokkit pistol', who:'Tankbustas', range:'12"', A:'1', BS:'4+', S:'10', AP:'-2', D:'3', kw:['CLOSE-QUARTERS','ASSAULT','IGNORES COVER'], from:{ ASSAULT:'Dakka! Dakka! Dakka!', 'IGNORES COVER':'Kustom Dakka' } },
        { group:'Busta Rokkit Launcha', who:'Tankbustas', n:6, name:'Hunter', hunter:true, range:'24"', A:'3', BS:'4+', S:'12', AP:'-2', D:'3', kw:['ASSAULT','IGNORES COVER'], from:{ ASSAULT:'Dakka! Dakka! Dakka!', 'IGNORES COVER':'Kustom Dakka' } },
        { group:'Busta Rokkit Launcha', who:'Tankbustas', n:6, name:'Standard', range:'24"', A:'2', BS:'4+', S:'10', AP:'-2', D:'3', kw:['ASSAULT','IGNORES COVER'], from:{ ASSAULT:'Dakka! Dakka! Dakka!', 'IGNORES COVER':'Kustom Dakka' } }
      ],
      melee:[
        { name:'Mek’s Toolz', who:'Mek', range:'Melee', A:'3', WS:'3+', S:'5', AP:'0', D:'1', kw:[] },
        { name:'Choppa', who:'Tankbustas', range:'Melee', A:'4', WS:'3+', S:'5', AP:'-1', D:'1', kw:[] },
        { group:'Smash Hammer', who:'Tankbustas', name:'Hunter', hunter:true, range:'Melee', A:'3', WS:'3+', S:'12', AP:'-2', D:'3', kw:[] },
        { group:'Smash Hammer', who:'Tankbustas', name:'Standard', range:'Melee', A:'3', WS:'3+', S:'7', AP:'-2', D:'2', kw:[] },
        { name:'Gitstikka', who:'Tankbustas', n:5, range:'Melee', A:'3', WS:'3+', S:'5', AP:'0', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Clever Know-wotz', who:'Mek', ph:['movement','shooting','fight'], turn:'either', turns:{ movement:'your', shooting:'your' }, text:'In your Movement phase, at the start or end of this unit’s move, you can select one friendly **ORKS VEHICLE** model (excluding **AIRCRAFT**/**TITANIC** models) within 3" of this model:\n- That **VEHICLE** model **heals** D3 wounds.\n- That **VEHICLE** model’s attacks have +1 to **hit rolls** until the start of your next Movement phase.' },
        { name:'Kustom Dakka', who:'Mek', text:'This unit’s ranged attacks have **[IGNORES COVER]**.' },
        { name:'Rokkit Barrage', who:'Tankbustas', ph:['shooting'], turn:'your', text:'In your Shooting phase, when this unit has shot, select one enemy unit hit by those attacks. That unit makes a **battle-shock roll**, with -1 to that **battle-shock roll**.' },
        { name:'Bomb Squig', who:'Tankbustas', tag:'Once per turn, twice per battle, per unit', ph:['movement'], turn:'your', text:'In your Movement phase, when this unit ends a **normal move**, you can select one **visible** enemy unit within 12" of this unit and roll one D6:\n- On a 3+, that enemy unit suffers D3 **mortal wounds**.\n*Place two Bomb Squig tokens next to the unit, removing one each time this ability is used.*' }
      ],
      aura:[
        { kind:'all', needs:{ all:['Faction: Orks','Vehicle'], none:['Aircraft','Titanic'] }, when:'Picked by a Mek’s Clever Know-wotz', note:'that VEHICLE model’s attacks have +1 to hit rolls until the start of your next Movement phase', from:'Clever Know-wotz', calc:{ hit:1 }, oneModel:true, lasts:'round' }
      ],
      rules:['Waaagh!','Support'],
      kw:['Character','Explosives','Faction: Orks','Infantry','Mek','Tankbustas'],
      kwNote:'Tankbustas comes from the supported Tankbustas.'
    },
    {
      id:'mek-flashgitz', name:'Mek', role:'Character', pts:300, ptsNote:'55 + Flash Gitz 245', upgrade:'Supa-snazz Dakka',
      leads:'Flash Gitz', support:true,
      models:['1× Mek','1× Kaptin','9× Flash Gitz'],
      gear:[['Kustom Mega-slugga','Mek’s Toolz'],['Choppa','Snazzgun'],['Choppa','Snazzgun']],
      stats:[
        { name:'Mek', M:'6"', T:'5', Sv:'5+', W:'4', Ld:'7+', OC:'1', InSv:'–', base:'32mm' },
        { name:'Flash Gitz', M:'6"', T:'5', Sv:'4+', W:'3', Ld:'7+', OC:'1', InSv:'–', base:'40mm' }
      ],
      ranged:[
        { name:'Kustom Mega-slugga', who:'Mek', range:'12"', A:'3', BS:'4+', S:'8', AP:'-2', D:'3', kw:['CLOSE-QUARTERS','HAZARDOUS','IGNORES COVER','ASSAULT'], from:{ 'IGNORES COVER':'Kustom Dakka', ASSAULT:'Dakka! Dakka! Dakka!' } },
        { group:'Snazzgun', who:'Flash Gitz', n:10, name:'Cutta', range:'12"', A:'1', BS:'4+', S:'9', AP:'-3', D:'D3+2', kw:['HAZARDOUS','MELTA 2','ASSAULT','RAPID FIRE 1','IGNORES COVER'], from:{ ASSAULT:'Dakka! Dakka! Dakka!', 'RAPID FIRE 1':'Supa-snazz Dakka', 'IGNORES COVER':'Kustom Dakka' } },
        { group:'Snazzgun', who:'Flash Gitz', n:10, name:'Dakka', range:'24"', A:'3', BS:'4+', S:'6', AP:'-1', D:'2', kw:['LETHAL HITS: non-MONSTER/VEHICLE','SUSTAINED HITS 1','ASSAULT','RAPID FIRE 1','IGNORES COVER'], from:{ ASSAULT:'Dakka! Dakka! Dakka!', 'RAPID FIRE 1':'Supa-snazz Dakka', 'IGNORES COVER':'Kustom Dakka' } },
        { group:'Snazzgun', who:'Flash Gitz', n:10, name:'Kill Shot', range:'36"', A:'2', BS:'4+', S:'8', AP:'-2', D:'2', kw:['HAZARDOUS','ASSAULT','RAPID FIRE 1','IGNORES COVER'], from:{ ASSAULT:'Dakka! Dakka! Dakka!', 'RAPID FIRE 1':'Supa-snazz Dakka', 'IGNORES COVER':'Kustom Dakka' } }
      ],
      melee:[
        { name:'Mek’s Toolz', who:'Mek', range:'Melee', A:'3', WS:'3+', S:'5', AP:'0', D:'1', kw:[] },
        { name:'Choppa', who:'Flash Gitz', n:10, range:'Melee', A:'4', WS:'3+', S:'5', AP:'-1', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Clever Know-wotz', who:'Mek', ph:['movement','shooting','fight'], turn:'either', turns:{ movement:'your', shooting:'your' }, text:'In your Movement phase, at the start or end of this unit’s move, you can select one friendly **ORKS VEHICLE** model (excluding **AIRCRAFT**/**TITANIC** models) within 3" of this model:\n- That **VEHICLE** model **heals** D3 wounds.\n- That **VEHICLE** model’s attacks have +1 to **hit rolls** until the start of your next Movement phase.' },
        { name:'Kustom Dakka', who:'Mek', text:'This unit’s ranged attacks have **[IGNORES COVER]**.' },
        { name:'Finderz Keeperz', who:'Flash Gitz', ph:['shooting'], turn:'your', text:'In your Shooting phase, if any of the following apply, this unit’s ranged attacks have +1 **AP**.\n- This unit is within range of an **objective**.\n- The target of that attack is within range of an **objective**.' },
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
      id:'gretchin', name:'Gretchin', role:'Infantry', pts:45, copies:3,
      models:['10× Gretchin'],
      gear:[['Grot Blasta','Scavenged Shivs']],
      stats:[
        { name:'Gretchin ×10', M:'6"', T:'2', Sv:'6+', W:'1', Ld:'8+', OC:'1', InSv:'–', base:'25mm' }
      ],
      ranged:[
        { name:'Grot Blasta', n:10, range:'12"', A:'1', BS:'4+', S:'3', AP:'0', D:'1', kw:['CLOSE-QUARTERS','ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } }
      ],
      melee:[
        { name:'Scavenged Shivs', n:10, range:'Melee', A:'1', WS:'5+', S:'2', AP:'0', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Downtrodden', text:'For the purposes of **transport capacity**, each 2 Gretchin models (rounding up) take up the space of 1 model.' },
        { name:'Thievin’ Scavengers', ph:['movement'], turn:'your', text:'At the end of your Movement phase, if this unit is controlling an **objective**, that **objective** is **secured**.' }
      ],
      rules:['Waaagh!'],
      kw:['Faction: Orks','Gretchin','Grots','Infantry']
    },
    {
      id:'deffkoptas', name:'Deffkoptas', role:'Mounted', pts:85,
      models:['3× Deffkopta'],
      gear:[['Choppa','Rokkit Launcha','Slugga','Spinnin’ Blades']],
      stats:[
        { name:'Deffkoptas ×3', M:'12"', T:'6', Sv:'4+', W:'4', Ld:'7+', OC:'2', InSv:'6+', base:'75×42mm' }
      ],
      ranged:[
        { group:'Rokkit Launcha', n:3, name:'Busta', range:'24"', A:'2', BS:'5+', S:'10', AP:'-2', D:'3', kw:['LETHAL HITS'] },
        { group:'Rokkit Launcha', n:3, name:'Blasta', range:'24"', A:'2', BS:'5+', S:'4', AP:'0', D:'1', kw:['BLAST 2'] },
        { name:'Slugga', n:3, range:'12"', A:'1', BS:'5+', S:'4', AP:'0', D:'1', kw:['CLOSE-QUARTERS','LETHAL HITS: non-MONSTER/VEHICLE'] }
      ],
      melee:[
        { name:'Choppa', n:3, range:'Melee', A:'3', WS:'4+', S:'5', AP:'-1', D:'1', kw:[] },
        { name:'Spinnin’ Blades', n:3, range:'Melee', A:'4', WS:'3+', S:'5', AP:'-1', D:'1', kw:['CLEAVE 1','HAZARDOUS'] }
      ],
      abilities:[
        { name:'Aerial Manoover', ph:['fight'], turn:'opp', text:'At the end of your opponent’s Fight phase, if this unit is **unengaged**, you can place this unit in **strategic reserves**.' },
        { name:'Deff from Above', ph:['shooting'], turn:'your', text:'In your Shooting phase, if this unit made an **ingress move** this turn, this unit’s ranged attacks have +1 to **hit rolls**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Your Shooting phase, after an ingress move this turn', note:'+1 to hit rolls', from:'Deff from Above' }
      ],
      rules:['Deep Strike','Waaagh!'],
      kw:['Deffkoptas','Explosives','Faction: Orks','Fly','Mounted','Speed Freeks']
    },
    {
      id:'killa-kans', name:'Killa Kans', role:'Vehicle', pts:275,
      models:['6× Killa Kan'],
      gear:[['Kan Blasta','Kan Klaw']],
      stats:[
        { name:'Killa Kan ×6', M:'8"', T:'7', Sv:'3+', W:'5', Ld:'8+', OC:'2', InSv:'6+', base:'60mm' }
      ],
      ranged:[
        { group:'Kan Blasta', n:6, name:'Kill Shot', range:'24"', A:'2', BS:'4+', S:'10', AP:'-2', D:'3', kw:[] },
        { group:'Kan Blasta', n:6, name:'Point Blank', range:'12"', A:'3', BS:'–', S:'5', AP:'-1', D:'1', kw:['BLAST 2','TORRENT'] },
        { group:'Kan Blasta', n:6, name:'Dakka', range:'24"', A:'4', BS:'4+', S:'6', AP:'-1', D:'1', kw:['BLAST 1','IGNORES COVER','SUSTAINED HITS 1'] }
      ],
      melee:[
        { name:'Kan Klaw', n:6, range:'Melee', A:'3', WS:'4+', S:'8', AP:'-2', D:'3', kw:[] }
      ],
      abilities:[
        { name:'Spiteful Power Trip', ph:['movement','shooting','fight'], turn:'either', turns:{ movement:'opp', shooting:'your' }, text:'This unit’s attacks that target a unit that has no models with a **T** of 7+ have +1 to **hit rolls**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'vs units with no T 7+ models', note:'+1 to hit rolls', from:'Spiteful Power Trip', always:true, vs:{ maxT:6 } }
      ],
      rules:['Deadly Demise 1','Waaagh!'],
      kw:['Faction: Orks','Grots','Killa Kans','Vehicle','Walker']
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
      id:'ghazghkull-thraka', name:'Ghazghkull Thraka', role:'Epic Hero', pts:290, warlord:true,
      models:['1× Ghazghkull Thraka'],
      gear:[['Adamantine ’Eadbutt','Gork’s Klaw','Mork’s Roar']],
      stats:[
        { name:'Ghazghkull Thraka', M:'8"', T:'10', Sv:'2+', W:'16', Ld:'6+', OC:'4', InSv:'4+', base:'80mm' }
      ],
      ranged:[
        { group:'Mork’s Roar', name:'Point Blank', range:'9"', A:'2D6+2', BS:'–', S:'6', AP:'-1', D:'1', kw:['CLOSE-QUARTERS','TORRENT'] },
        { group:'Mork’s Roar', name:'Aimed', range:'36"', A:'12', BS:'5+', S:'6', AP:'-1', D:'1', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 4'] }
      ],
      melee:[
        { name:'Adamantine ’Eadbutt', range:'Melee', A:'1', WS:'2+', S:'14', AP:'-2', D:'D3+3', kw:['DEVASTATING WOUNDS','EXTRA ATTACKS','PRECISION','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Gork’s Klaw', range:'Melee', A:'7', WS:'2+', S:'14', AP:'-3', D:'4', kw:['CLEAVE 2','DEVASTATING WOUNDS','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } }
      ],
      abilities:[
        { name:'Supreme Commander', text:'If this model is in your army, it must be your **WARLORD**.' },
        { name:'Makari, Hoist Dat Banner!', tag:'Once per battle, per army', ph:['movement'], turn:'your', text:'In your Movement phase, you can select a number of friendly **ORKS** units equal to or less than the current battle round number. Those units are **riled up** until the start of your next turn.\n*Place one Makari token next to the unit, removing it after this ability is used.*' },
        { name:'Da Grand Warlord’s Ladz', def:'Lone Operative while within 3" of another friendly ORKS INFANTRY unit', text:'While this unit is within 3" of another friendly **ORKS INFANTRY** unit, this unit has **Lone Operative**.' },
        { name:'Prophet of Da Great Waaagh!', tag:'Aura', ph:['fight'], turn:'either', text:'While a friendly **ORKS** unit is within 6" of this unit, that unit’s melee attacks have:\n- +1 to **hit rolls**.\n- +1 to **wound rolls**.' }
      ],
      aura:[
        { kind:'melee', needs:{ all:['Faction: Orks'] }, when:'Within 6" of Ghazghkull', selfWhen:'Own aura', note:'+1 to hit, +1 to wound', from:'Prophet of Da Great Waaagh!', selfAlways:true }
      ],
      rules:['Waaagh!','Da Boss'],
      kw:['Character','Epic Hero','Explosives','Faction: Orks','Ghazghkull Thraka','Infantry','Warboss','Warlord']
    },
    {
      id:'mozrog-skragbad', name:'Mozrog Skragbad', role:'Epic Hero', pts:170,
      models:['1× Mozrog Skragbad'],
      gear:[['Big Chompa’s Jaws','Gutrippa','Thump Gun']],
      stats:[
        { name:'Mozrog Skragbad', M:'10"', T:'9', Sv:'3+', W:'10', Ld:'6+', OC:'3', InSv:'4+', base:'80mm' }
      ],
      ranged:[
        { name:'Thump Gun', range:'18"', A:'3', BS:'5+', S:'6', AP:'0', D:'2', kw:['ANTI-MONSTER/VEHICLE 4+'] }
      ],
      melee:[
        { name:'Big Chompa’s Jaws', range:'Melee', A:'3', WS:'3+', S:'7', AP:'-2', D:'4', kw:['ANTI-MONSTER/VEHICLE 3+','EXTRA ATTACKS','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { group:'Gutrippa', name:'Hunter', hunter:true, range:'Melee', A:'6', WS:'2+', S:'12', AP:'-2', D:'D6+1', kw:['LETHAL HITS','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { group:'Gutrippa', name:'Standard', range:'Melee', A:'6', WS:'2+', S:'9', AP:'-2', D:'2', kw:['CLEAVE 1','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } }
      ],
      abilities:[
        { name:'Beast Snagga Following', def:'Lone Operative while within 3" of a friendly BEAST SNAGGA unit (not MONSTER CHARACTER)', text:'While this unit is within 3" of a friendly **BEAST SNAGGA** unit (excluding **MONSTER CHARACTER** units), this unit has **Lone Operative**.' },
        { name:'One Last Kill', ph:['fight'], turn:'either', fightOnDeath:{ roll:2 }, def:'Destroyed in the Fight phase before being selected to fight: on a 2+ it stays until it has fought or the phase ends', text:'In the Fight phase, when this model is **destroyed**, if this unit has not been **selected to fight** this phase, roll one D6:\n- On a 2+, do not remove this model from the battlefield. When this unit has fought, or at the end of the phase (whichever comes first), this model is removed from the battlefield.' },
        { name:'Da Bigger Dey Iz…', ph:['fight'], turn:'either', text:'This unit’s melee attacks that target a **MONSTER/VEHICLE** unit can re-roll **wound rolls**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'vs MONSTER/VEHICLE', note:'can re-roll wound rolls', from:'Da Bigger Dey Iz…', always:true, vs:{ any:['Monster','Vehicle'] } }
      ],
      rules:['Feel No Pain 5+','Waaagh!'],
      kw:['Beast Snagga','Character','Epic Hero','Faction: Orks','Monster','Mozrog Skragbad']
    },
    {
      id:'nazdreg-meganobz', name:'Nazdreg', role:'Epic Hero', pts:365, ptsNote:'165 + Meganobz 200',
      leads:'Meganobz',
      models:['1× Nazdreg','5× Meganob w/ Twin Killsaw'],
      gear:[['Kustom Blasta X','Moonchewa'],['Twin Killsaw']],
      stats:[
        { name:'Nazdreg', M:'5"', T:'7', Sv:'2+', W:'8', Ld:'6+', OC:'1', InSv:'5+', base:'60mm' },
        { name:'Meganob ×5', M:'5"', T:'6', Sv:'2+', W:'3', Ld:'7+', OC:'1', InSv:'–', base:'40mm' }
      ],
      ranged:[
        { group:'Kustom Blasta X', fireAll:true, who:'Nazdreg', name:'Skorcha', range:'12"', A:'3', BS:'–', S:'5', AP:'-1', D:'1', kw:['BLAST 1','TORRENT','IGNORES COVER'], from:{ 'IGNORES COVER':'Nazdreg’s Know-wotz' } },
        { group:'Kustom Blasta X', fireAll:true, who:'Nazdreg', name:'Gatler', range:'24"', A:'6', BS:'4+', S:'9', AP:'-2', D:'3', kw:['HAZARDOUS','IGNORES COVER'], from:{ 'IGNORES COVER':'Nazdreg’s Know-wotz' } },
        { group:'Kustom Blasta X', fireAll:true, who:'Nazdreg', name:'Shoota', range:'18"', A:'4', BS:'4+', S:'5', AP:'-1', D:'1', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 2','IGNORES COVER'], from:{ 'IGNORES COVER':'Nazdreg’s Know-wotz' } }
      ],
      melee:[
        { name:'Kustom Blasta X', who:'Nazdreg', range:'Melee', A:'6', WS:'2+', S:'5', AP:'-1', D:'1', kw:['CLEAVE 1','EXTRA ATTACKS','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Moonchewa', who:'Nazdreg', range:'Melee', A:'5', WS:'2+', S:'12', AP:'-2', D:'3', kw:['CLEAVE 1','TWIN-LINKED','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Twin Killsaw', who:'Meganobz', n:5, range:'Melee', A:'3', WS:'4+', S:'10', AP:'-2', D:'3', kw:['TWIN-LINKED','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } }
      ],
      abilities:[
        { name:'Nazdreg’s Know-wotz', who:'Nazdreg', text:'- This unit has **Deep Strike**.\n- This unit’s ranged attacks have **[IGNORES COVER]**.' },
        { name:'Supreme Kunnin’', who:'Nazdreg', tag:'Once per phase, per army', ph:['movement'], turn:'opp', text:'In your opponent’s Movement phase, when an enemy unit ends a move within 8" of this unit, if this unit is **unengaged**, this unit can:\n- Make a **normal move** of up to D6".\n- Or: If this unit is **riled up**, make a **normal move** of up to 5".' },
        { name:'Intimidating Motivation', who:'Nazdreg', tag:'Once per battle round, per army', ph:['movement'], turn:'your', text:'In your Movement phase, at the start or end of this unit’s move, you can select one friendly **ORKS** unit within 6" of this unit. That unit:\n- Is no longer **battle-shocked**.\n- Is **riled up** until the start of your next turn.' },
        { name:'Krumpin’ Time', who:'Meganobz', ph:['fight'], turn:'either', text:'In the Fight phase, if this unit is **riled up**, this unit has +1 to **hit rolls**.' },
        { name:'Arrogant Invulnerability', who:'Meganobz', def:'Attacks that target this unit have -1 AP', defAlways:true, text:'Attacks that target this unit have -1 **AP**.' }
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
      id:'beastboss-on-squigosaur-headwoppas-killchoppa', name:'Beastboss on Squigosaur', short:'Beastboss', role:'Character', pts:155, enhancement:'Headwoppa’s Killchoppa',
      models:['1× Beastboss on Squigosaur'],
      gear:[['Beastchoppa','Slugga','Squigosaur’s jaws','Thump Gun']],
      stats:[
        { name:'Beastboss on Squigosaur', M:'10"', T:'9', Sv:'3+', W:'10', Ld:'6+', OC:'3', InSv:'5+', base:'80mm' }
      ],
      ranged:[
        { name:'Slugga', range:'12"', A:'1', BS:'5+', S:'4', AP:'0', D:'1', kw:['CLOSE-QUARTERS','LETHAL HITS: non-MONSTER/VEHICLE'] },
        { name:'Thump Gun', range:'18"', A:'3', BS:'5+', S:'6', AP:'0', D:'2', kw:['ANTI-MONSTER/VEHICLE 4+'] }
      ],
      melee:[
        { group:'Beastchoppa', name:'Hunter', hunter:true, range:'Melee', A:'6', WS:'2+', S:'12', AP:'-2', D:'D6', kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { group:'Beastchoppa', name:'Standard', range:'Melee', A:'6', WS:'2+', S:'6', AP:'-2', D:'2', kw:['CLEAVE 1','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Squigosaur’s jaws', range:'Melee', A:'3', WS:'3+', S:'7', AP:'-2', D:'3', kw:['ANTI-MONSTER/VEHICLE 3+','EXTRA ATTACKS','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } }
      ],
      abilities:[
        { name:'Thundering Stampede', tag:'Aura', ph:['charge'], turn:'either', text:'Friendly **BEAST SNAGGA** units within 6" of this unit have +1 to **charge rolls**.' },
        { name:'Boss of da Hunt', def:'Lone Operative while within 3" of a friendly BEAST SNAGGA unit (not MONSTER CHARACTER)', text:'While this unit is within 3" of a friendly **BEAST SNAGGA** unit (excluding **MONSTER CHARACTER** units), this unit has **Lone Operative**.' },
        { name:'Keep Huntin’!', tag:'Once per battle round, per army', ph:['movement'], turn:'your', text:'In your Movement phase, at the start or end of this unit’s move, you can select one friendly **BEAST SNAGGA** unit within 6" of this unit. That unit:\n- Is no longer **battle-shocked**.\n- Is **riled up** until the start of your next turn.' },
        { name:'Headwoppa’s Killchoppa', tag:'Enhancement', ph:['fight'], turn:'either', text:'**ORKS** model only. If this unit made a **charge move** this turn, this model’s melee attacks have +1 AP.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Made a charge move this turn', cond:'charged', note:'+1 AP', from:'Headwoppa’s Killchoppa' }
      ],
      rules:['Da Boss','Waaagh!','Feel No Pain 5+'],
      kw:['Beast Snagga','Beastboss on Squigosaur','Character','Faction: Orks','Monster','Warboss']
    },
    {
      id:'big-mek-painboy-nobz', name:'Big Mek', role:'Character', pts:405, ptsNote:'120 + Painboy 45 + Nobz 240', enhancement:'Kunnin’ But Brutal',
      leads:'Nobz', also:[{ name:'Painboy', support:true }],
      models:['1× Big Mek','1× Painboy','8× Nob w/ Kustom Shoota and Kustom Krumpa','2× Nob w/ Kustom Krumpa and Paired Krumpas (Paired Krumpas)'],
      gear:[['Kustom mega-blasta','Drilla'],['’Urty syringe','Dok’s Toolz'],['Kustom Krumpa','Kustom Shoota'],['Kustom Krumpa']],
      stats:[
        { name:'Big Mek', M:'6"', T:'5', Sv:'3+', W:'6', Ld:'7+', OC:'1', InSv:'–', base:'50mm' },
        { name:'Painboy', M:'6"', T:'5', Sv:'5+', W:'3', Ld:'7+', OC:'1', InSv:'–', base:'32mm' },
        { name:'Nob ×10', M:'6"', T:'5', Sv:'4+', W:'3', Ld:'7+', OC:'1', InSv:'–', base:'32mm' }
      ],
      ranged:[
        { name:'Kustom mega-blasta', who:'Big Mek', range:'24"', A:'3', BS:'4+', S:'9', AP:'-2', D:'3', kw:['HAZARDOUS','IGNORES COVER'], from:{ 'IGNORES COVER':'More Dakka' } },
        { name:'Kustom Shoota', who:'Nobz', n:8, range:'18"', A:'4', BS:'5+', S:'4', AP:'0', D:'1', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 2','IGNORES COVER'], from:{ 'IGNORES COVER':'More Dakka' } }
      ],
      melee:[
        { name:'Drilla', who:'Big Mek', range:'Melee', A:'3', WS:'3+', S:'12', AP:'-3', D:'3', kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'’Urty syringe', who:'Painboy', range:'Melee', A:'1', WS:'3+', S:'2', AP:'0', D:'D6', kw:['ANTI-INFANTRY 4+','DEVASTATING WOUNDS: INFANTRY','EXTRA ATTACKS','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Dok’s Toolz', who:'Painboy', range:'Melee', A:'3', WS:'3+', S:'10', AP:'-2', D:'2', kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Kustom Krumpa', who:'Nobz', n:10, range:'Melee', A:'3', WS:'3+', S:'10', AP:'-2', D:'2', kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } }
      ],
      abilities:[
        { name:'Shokk-boosta', who:'Big Mek', ph:['movement'], turn:'your', text:'In your Movement phase, when this unit is selected to make an **advance move**, you can use this ability. If you do:\n- This unit can change that **advance roll** to a 6.\n- This unit can move through all types of model.\n- When this unit ends that **advance move**, make a **hazard roll** for each model in this unit.' },
        { name:'More Dakka', who:'Big Mek', text:'This unit’s ranged attacks have:\n- **[IGNORES COVER]**.\n- If this unit is **riled up**, **[SUSTAINED HITS 1]**.' },
        { name:'Kunnin’ But Brutal', who:'Big Mek', tag:'Enhancement', ph:['movement','shooting','charge'], turn:'your', text:'**ORKS** model only. When this unit is selected to make a **fall-back move**, that fall-back move does not prevent this unit from being **eligible to shoot**/**declare a charge**.' },
        { name:'Crude Surgery', who:'Painboy', ph:['command'], turn:'your', text:'In your Command phase, this unit **heals** 3 wounds.' },
        { name:'Catch Dat Red Bit', who:'Painboy', tag:'Once per battle, per unit', ph:['command'], turn:'your', text:'When this model uses its **Crude Surgery** ability, you can add D3 to the number of wounds **healed**.\n*Place a Grot Orderly token next to the unit, removing it when this ability is used.*' },
        { name:'Ammo Runts', who:'Nobz', tag:'Once per battle, per unit', ph:['shooting'], turn:'your', text:'In your Shooting phase, when this unit is **selected to shoot**, you can use this ability. If you do, this unit’s ranged attacks have +1 to **hit rolls**.\n*Place any number of Ammo Runt tokens next to the unit, removing them when this ability is used.*' },
        { name:'Get Out da Way!', who:'Nobz', ph:['charge'], turn:'either', text:'While making a **charge move**, this unit can move through models (excluding **MONSTER/VEHICLE** models).' },
        { name:'Paired Krumpas', who:'Nobz', text:'Attacks made with this model’s Kustom Krumpa weapon can re-roll **hit rolls** and **wound rolls**.' }
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
      id:'big-mek-in-mega-armour-meganobz', name:'Big Mek in Mega Armour', role:'Character', pts:310, ptsNote:'110 + Meganobz 200', enhancement:'Follow Me Ladz',
      leads:'Meganobz',
      models:['1× Big Mek in Mega Armour (Kustom Force Field)','5× Meganob w/ Twin Killsaw'],
      gear:[['Kustom Mega-blasta','Power Klaw'],['Twin Killsaw']],
      stats:[
        { name:'Big Mek in Mega Armour', M:'7"', T:'6', Sv:'2+', W:'5', Ld:'7+', OC:'1', InSv:'4+*', base:'40mm', from:{ M:'Follow Me Ladz' } },
        { name:'Meganob ×5', M:'7"', T:'6', Sv:'2+', W:'3', Ld:'7+', OC:'1', InSv:'4+*', base:'40mm', from:{ M:'Follow Me Ladz' } }
      ],
      ranged:[
        { name:'Kustom Mega-blasta', who:'Big Mek in Mega Armour', range:'24"', A:'3', BS:'4+', S:'9', AP:'-2', D:'3', kw:['HAZARDOUS','IGNORES COVER'], from:{ 'IGNORES COVER':'More Dakka' } }
      ],
      melee:[
        { name:'Power Klaw', who:'Big Mek in Mega Armour', range:'Melee', A:'3', WS:'3+', S:'10', AP:'-2', D:'2', kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Twin Killsaw', who:'Meganobz', n:5, range:'Melee', A:'3', WS:'4+', S:'10', AP:'-2', D:'3', kw:['TWIN-LINKED','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } }
      ],
      abilities:[
        { name:'Fix Dat Armour Up', who:'Big Mek in Mega Armour', tag:'Once per battle, per unit', ph:['command'], turn:'your', text:'In your Command phase, this unit **heals** 3 wounds.\n*Place a Grot Oiler token next to the unit, removing it when this ability is used.*' },
        { name:'More Dakka', who:'Big Mek in Mega Armour', text:'This unit’s ranged attacks have:\n- **[IGNORES COVER]**.\n- If this unit is **riled up**, **[SUSTAINED HITS 1]**.' },
        { name:'Follow Me Ladz', who:'Big Mek in Mega Armour', tag:'Enhancement', text:'**ORKS** model only. This unit has +2" **M**.' },
        { name:'Kustom Force Field', who:'Big Mek in Mega Armour', def:'4+ InSv against ranged attacks', text:'This unit has 4+ **InSv** against ranged attacks.' },
        { name:'Krumpin’ Time', who:'Meganobz', ph:['fight'], turn:'either', text:'In the Fight phase, if this unit is **riled up**, this unit has +1 to **hit rolls**.' },
        { name:'Arrogant Invulnerability', who:'Meganobz', def:'Attacks that target this unit have -1 AP', defAlways:true, text:'Attacks that target this unit have -1 **AP**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Riled up', cond:'riled', note:'[SUSTAINED HITS 1]', from:'More Dakka' },
        { kind:'melee', when:'Riled up, Fight phase', cond:'riled', note:'+1 to hit rolls', from:'Krumpin’ Time' }
      ],
      rules:['Waaagh!','Leader'],
      kw:['Big Mek','Big Mek in Mega Armour','Character','Explosives','Faction: Orks','Infantry','Mega Armour','Meganobz'],
      kwNote:'Meganobz comes from the led Meganobz.'
    },
    {
      id:'gretchin', name:'Gretchin', role:'Infantry', pts:45, copies:2,
      models:['10× Gretchin'],
      gear:[['Grot Blasta','Scavenged Shivs']],
      stats:[
        { name:'Gretchin ×10', M:'6"', T:'2', Sv:'6+', W:'1', Ld:'8+', OC:'1', InSv:'–', base:'25mm' }
      ],
      ranged:[
        { name:'Grot Blasta', n:10, range:'12"', A:'1', BS:'4+', S:'3', AP:'0', D:'1', kw:['CLOSE-QUARTERS'] }
      ],
      melee:[
        { name:'Scavenged Shivs', n:10, range:'Melee', A:'1', WS:'5+', S:'2', AP:'0', D:'1', kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } }
      ],
      abilities:[
        { name:'Downtrodden', text:'For the purposes of **transport capacity**, each 2 Gretchin models (rounding up) take up the space of 1 model.' },
        { name:'Thievin’ Scavengers', ph:['movement'], turn:'your', text:'At the end of your Movement phase, if this unit is controlling an **objective**, that objective is **secured**.' }
      ],
      rules:['Waaagh!'],
      kw:['Faction: Orks','Gretchin','Grots','Infantry']
    },
    {
      id:'deffkoptas', name:'Deffkoptas', role:'Mounted', pts:85,
      models:['2× Deffkopta','1× Deffkopta w/ Kustom mega-blasta'],
      gear:[['Choppa','Rokkit Launcha','Slugga','Spinnin’ Blades'],['Choppa','Kustom Mega-blasta','Slugga','Spinnin’ Blades']],
      stats:[
        { name:'Deffkoptas ×3', M:'12"', T:'6', Sv:'4+', W:'4', Ld:'7+', OC:'2', InSv:'6+', base:'75×42mm' }
      ],
      ranged:[
        { group:'Rokkit Launcha', n:2, name:'Busta', range:'24"', A:'2', BS:'5+', S:'10', AP:'-2', D:'3', kw:['LETHAL HITS'] },
        { group:'Rokkit Launcha', n:2, name:'Blasta', range:'24"', A:'2', BS:'5+', S:'4', AP:'0', D:'1', kw:['BLAST 2'] },
        { name:'Slugga', n:3, range:'12"', A:'1', BS:'5+', S:'4', AP:'0', D:'1', kw:['CLOSE-QUARTERS','LETHAL HITS: non-MONSTER/VEHICLE'] },
        { name:'Kustom Mega-blasta', range:'24"', A:'3', BS:'5+', S:'9', AP:'-2', D:'3', kw:['HAZARDOUS','LETHAL HITS'] }
      ],
      melee:[
        { name:'Choppa', n:3, range:'Melee', A:'3', WS:'4+', S:'5', AP:'-1', D:'1', kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Spinnin’ Blades', n:3, range:'Melee', A:'4', WS:'3+', S:'5', AP:'-1', D:'1', kw:['CLEAVE 1','HAZARDOUS','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } }
      ],
      abilities:[
        { name:'Aerial Manoover', ph:['fight'], turn:'opp', text:'At the end of your opponent’s Fight phase, if this unit is **unengaged**, you can place this unit in **strategic reserves**.' },
        { name:'Deff from Above', ph:['shooting'], turn:'your', text:'In your Shooting phase, if this unit made an **ingress move** this turn, this unit’s ranged attacks have +1 to **hit rolls**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Your Shooting phase, after an ingress move this turn', note:'+1 to hit rolls', from:'Deff from Above' }
      ],
      rules:['Deep Strike','Waaagh!'],
      kw:['Deffkoptas','Explosives','Faction: Orks','Fly','Mounted','Speed Freeks']
    },
    {
      id:'squighog-boyz', name:'Squighog Boyz', role:'Mounted', pts:130,
      models:['1× Nob on Smasha Squig','3× Squighog Boy'],
      gear:[['Big Choppa','Slugga','Squig Jaws'],['Saddlegit’s Shiv','Squig Jaws','Stikka']],
      stats:[
        { name:'Nob on Smasha Squig', M:'10"', T:'6', Sv:'4+', W:'4', Ld:'7+', OC:'2', InSv:'6+', base:'90×52.5mm' },
        { name:'Squighog Boyz ×3', M:'10"', T:'6', Sv:'4+', W:'3', Ld:'7+', OC:'2', InSv:'6+', base:'75×42mm' }
      ],
      ranged:[
        { name:'Slugga', range:'12"', A:'1', BS:'5+', S:'4', AP:'0', D:'1', kw:['CLOSE-QUARTERS','LETHAL HITS: non-MONSTER/VEHICLE'] },
        { name:'Saddlegit’s Shiv', n:3, range:'9"', A:'1', BS:'4+', S:'3', AP:'0', D:'1', kw:['ASSAULT'] },
        { name:'Stikka', n:3, range:'9"', A:'1', BS:'5+', S:'5', AP:'-1', D:'2', kw:['ANTI-MONSTER/VEHICLE 4+','ASSAULT'] }
      ],
      melee:[
        { name:'Big Choppa', range:'Melee', A:'4', WS:'3+', S:'7', AP:'-1', D:'2', kw:['ANTI-MONSTER/VEHICLE 4+','CLEAVE 2','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Squig Jaws', n:4, range:'Melee', A:'3', WS:'4+', S:'6', AP:'-1', D:'2', kw:['EXTRA ATTACKS','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } },
        { name:'Stikka', n:3, range:'Melee', A:'3', WS:'3+', S:'5', AP:'-1', D:'2', kw:['ANTI-MONSTER/VEHICLE 4+','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Get Stuck In' } }
      ],
      abilities:[
        { name:'Brutal Impact', ph:['fight'], turn:'either', text:'If this unit made a **charge move** this turn, this unit’s attacks have +1 **D**.' },
        { name:'Bomb Squig', tag:'Once per battle, per unit', ph:['movement'], turn:'your', text:'In your Movement phase, when this unit ends a **normal move**, you can select one **visible** enemy unit within 12" of this unit and roll one D6:\n- On a 3+, that enemy unit suffers D3 **mortal wounds**.\n*Place one Bomb Squig token next to the unit, removing it after this ability is used.*' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Made a charge move this turn', cond:'charged', note:'+1 D', from:'Brutal Impact' }
      ],
      rules:['Waaagh!'],
      kw:['Beast Snagga','Explosives','Faction: Orks','Mobile','Mounted','Squighog Boyz']
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
      id:'kh-rn-the-betrayer-khorne-berzerkers', name:'Khârn the Betrayer', role:'Epic Hero', pts:285, ptsNote:'115 + Khorne Berzerkers 170',
      leads:'Khorne Berzerkers',
      models:['1× Khârn the Betrayer','1× Khorne Berzerker Champion','7× Khorne Berzerker','2× Khorne Berzerker w/ eviscerator and plasma pistol'],
      gear:[['Gorechild','Plasma pistol'],['Chainblade','Plasma pistol'],['Bolt pistol','Chainblade'],['Khornate eviscerator','Plasma pistol']],
      stats:[
        { name:'Khârn the Betrayer', M:'8"', T:'5', Sv:'3+', W:'5', Ld:'6+', OC:'1', InSv:'4+', base:'40mm' },
        { name:'Khorne Berzerker ×10', M:'8"', T:'5', Sv:'3+', W:'2', Ld:'6+', OC:'2', InSv:'–', base:'32mm' }
      ],
      ranged:[
        { group:'Plasma pistol', who:'Khârn the Betrayer', name:'standard', range:'12"', A:'1', BS:'3+', S:'7', AP:'-2', D:'1', kw:['PISTOL'] },
        { group:'Plasma pistol', who:'Khârn the Betrayer', name:'supercharge', range:'12"', A:'1', BS:'3+', S:'8', AP:'-3', D:'2', kw:['HAZARDOUS','PISTOL'] },
        { group:'Plasma pistol', who:'Khorne Berzerkers', n:3, name:'standard', range:'12"', A:'1', BS:'4+', S:'7', AP:'-2', D:'1', kw:['PISTOL'] },
        { group:'Plasma pistol', who:'Khorne Berzerkers', n:3, name:'supercharge', range:'12"', A:'1', BS:'4+', S:'8', AP:'-3', D:'2', kw:['HAZARDOUS','PISTOL'] },
        { name:'Bolt pistol', who:'Khorne Berzerkers', n:7, range:'12"', A:'1', BS:'4+', S:'5', AP:'-1', D:'1', kw:['PISTOL'] }
      ],
      melee:[
        { name:'Gorechild', who:'Khârn the Betrayer', range:'Melee', A:'9', WS:'2+', S:'7', AP:'-2', D:'3', kw:[], from:{ A:'Relentless Rage' } },
        { name:'Chainblade', who:'Khorne Berzerkers', n:8, range:'Melee', A:'5', WS:'3+', S:'5', AP:'-1', D:'1', kw:[], from:{ A:'Relentless Rage' } },
        { name:'Khornate eviscerator', who:'Khorne Berzerkers', n:2, range:'Melee', A:'4', WS:'3+', S:'8', AP:'-2', D:'2', kw:[], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Legendary Killer', who:'Khârn the Betrayer', ph:['fight'], turn:'either', text:'While this model is leading a unit, each time a model in that unit makes a melee attack, re-roll a Hit roll of 1 and re-roll a Wound roll of 1.' },
        { name:'The Betrayer', who:'Khârn the Betrayer', ph:['charge'], turn:'your', text:'At the end of your Charge phase, if this unit is on the battlefield, is **unengaged**, and contains a **bodyguard** model, this unit makes a **leadership roll**:\n- If that **leadership roll** is failed, one **bodyguard** model in this unit is **destroyed**.' },
        { name:'Berserker Frenzy', who:'Khârn the Betrayer', comeback:{ roll:2, wounds:3 }, def:'Khârn: the first time he is destroyed, at the end of the phase on a 2+ he is set back up with 3 wounds, as close as possible to where he was destroyed and not within Engagement Range of enemy units', text:'The first time this model is destroyed, at the end of the phase, roll one D6: on a 2+, set this model back up on the battlefield as close as possible to where it was destroyed and not within Engagement Range of any enemy units, with 3 wounds remaining.' },
        { name:'Blood Surge', who:'Khorne Berzerkers', ph:['shooting'], turn:'opp', text:'In your opponent’s Shooting phase, when an enemy unit has shot, if a model in this unit was destroyed as a result of those attacks, this unit can make a surge move of up to D6+2".' },
        { name:'Murderous Charge', who:'Khorne Berzerkers', ph:['fight'], turn:'either', text:'If this unit made a charge move this turn, this unit’s melee attacks have +1 S.' },
        { name:'Icon of Khorne', who:'Khorne Berzerkers', na:'No Icon of Khorne in this unit', text:'If the bearer’s unit contains one or more Icons of Khorne, each time the bearer’s unit destroys an enemy unit, you gain 1 Bloodshed point. Each time you make a **Blessings of Khorne** roll, roll one additional D6 for each Bloodshed point you have, after which, all your Bloodshed points are lost.' }
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
      id:'daemon-prince-of-khorne-helm-of-brazen-ire', name:'Daemon Prince of Khorne', short:'Daemon Prince', role:'Character', pts:230, enhancement:'Helm of Brazen Ire', warlord:true,
      models:['1× Daemon Prince of Khorne'],
      gear:[['Hellforged weapons','Infernal cannon']],
      stats:[
        { name:'Daemon Prince of Khorne', M:'10"', T:'10', Sv:'2+', W:'10', Ld:'6+', OC:'3', InSv:'4+', base:'60mm' }
      ],
      ranged:[
        { name:'Infernal cannon', range:'24"', A:'3', BS:'3+', S:'5', AP:'-1', D:'2', kw:['RAPID FIRE 1'] }
      ],
      melee:[
        { group:'Hellforged weapons', name:'strike', range:'Melee', A:'9', WS:'2+', S:'8', AP:'-2', D:'3', kw:[], from:{ A:'Relentless Rage' } },
        { group:'Hellforged weapons', name:'sweep', range:'Melee', A:'17', WS:'2+', S:'6', AP:'-1', D:'1', kw:[], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Lord of Murder', def:'Lone Operative while within 3" of a friendly WORLD EATERS INFANTRY unit', text:'While this model is within 3" of one or more friendly **WORLD EATERS INFANTRY** units, this model has the **Lone Operative** ability.' },
        { name:'Devastating Assault', ph:['charge','fight'], turn:'either', text:'Each time this model makes a Charge move, until the end of the turn, its hellforged weapons have the **[DEVASTATING WOUNDS]** ability.' },
        { name:'Direct the Slaughter', ph:['command','movement','shooting','charge','fight'], turn:'either', text:'Once per battle round, one model from your army with this ability can use it when a friendly **WORLD EATERS** unit within 12" of this model is targeted with a Stratagem. If it does, reduce the CP cost of that Stratagem by 1CP.' },
        { name:'Helm of Brazen Ire', tag:'Enhancement', def:'-1 D to each attack allocated to this model', defAlways:true, text:'**WORLD EATERS** model only. Each time an attack is allocated to the bearer, subtract 1 from the Damage characteristic of that attack.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Made a charge move this turn', cond:'charged', note:'Hellforged weapons have [DEVASTATING WOUNDS] until the end of the turn', from:'Devastating Assault' }
      ],
      rules:['Deadly Demise D3','Blessings of Khorne','Rapid Fire'],
      kw:['Chaos','Character','Daemon','Daemon Prince','Faction: World Eaters','Khorne','Monster','Warlord']
    },
    {
      id:'daemon-prince-of-khorne-berzerker-glaive', name:'Daemon Prince of Khorne', short:'Daemon Prince', role:'Character', pts:235, enhancement:'Berzerker Glaive',
      models:['1× Daemon Prince of Khorne'],
      gear:[['Hellforged weapons','Infernal cannon']],
      stats:[
        { name:'Daemon Prince of Khorne', M:'10"', T:'10', Sv:'2+', W:'10', Ld:'6+', OC:'3', InSv:'4+', base:'60mm' }
      ],
      ranged:[
        { name:'Infernal cannon', range:'24"', A:'3', BS:'3+', S:'5', AP:'-1', D:'2', kw:['RAPID FIRE 1'] }
      ],
      melee:[
        { group:'Hellforged weapons', name:'strike', range:'Melee', A:'10', WS:'2+', S:'8', AP:'-2', D:'4', kw:[], from:{ A:['Berzerker Glaive','Relentless Rage'], D:'Berzerker Glaive' } },
        { group:'Hellforged weapons', name:'sweep', range:'Melee', A:'18', WS:'2+', S:'6', AP:'-1', D:'2', kw:[], from:{ A:['Berzerker Glaive','Relentless Rage'], D:'Berzerker Glaive' } }
      ],
      abilities:[
        { name:'Lord of Murder', def:'Lone Operative while within 3" of a friendly WORLD EATERS INFANTRY unit', text:'While this model is within 3" of one or more friendly **WORLD EATERS INFANTRY** units, this model has the **Lone Operative** ability.' },
        { name:'Devastating Assault', ph:['charge','fight'], turn:'either', text:'Each time this model makes a Charge move, until the end of the turn, its hellforged weapons have the **[DEVASTATING WOUNDS]** ability.' },
        { name:'Direct the Slaughter', ph:['command','movement','shooting','charge','fight'], turn:'either', text:'Once per battle round, one model from your army with this ability can use it when a friendly **WORLD EATERS** unit within 12" of this model is targeted with a Stratagem. If it does, reduce the CP cost of that Stratagem by 1CP.' },
        { name:'Berzerker Glaive', tag:'Enhancement', text:'**WORLD EATERS** model only. Add 1 to the Attacks and Damage characteristics of melee weapons (excluding Extra Attacks weapons) equipped by the bearer.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Made a charge move this turn', cond:'charged', note:'Hellforged weapons have [DEVASTATING WOUNDS] until the end of the turn', from:'Devastating Assault' }
      ],
      rules:['Deadly Demise D3','Blessings of Khorne','Rapid Fire'],
      kw:['Chaos','Character','Daemon','Daemon Prince','Faction: World Eaters','Khorne','Monster']
    },
    {
      id:'lord-on-juggernaut-khorne-berzerkers', name:'Lord on Juggernaut', role:'Character', pts:455, ptsNote:'125 + Khorne Berzerkers 330', enhancement:'Archslaughterer',
      leads:'Khorne Berzerkers',
      models:['1× Lord on Juggernaut','1× Khorne Berzerker Champion','15× Khorne Berzerker','3× Khorne Berzerker w/ eviscerator and plasma pistol','1× Khorne Berzerker w/ eviscerator and plasma pistol (Icon of Khorne)'],
      gear:[['Bladed horn','Exalted chainblade','Plasma pistol'],['Chainblade','Plasma pistol'],['Bolt pistol','Chainblade'],['Khornate eviscerator','Plasma pistol'],['Khornate eviscerator','Plasma pistol']],
      stats:[
        { name:'Lord on Juggernaut', M:'10"', T:'6', Sv:'3+', W:'7', Ld:'6+', OC:'2', InSv:'4+', base:'90×52.5mm' },
        { name:'Khorne Berzerker ×20', M:'10"', T:'5', Sv:'3+', W:'2', Ld:'6+', OC:'2', InSv:'–', base:'32mm', from:{ M:'Aggressive Advance' } }
      ],
      ranged:[
        { group:'Plasma pistol', who:'Lord on Juggernaut', name:'standard', range:'12"', A:'1', BS:'3+', S:'7', AP:'-2', D:'1', kw:['PISTOL'] },
        { group:'Plasma pistol', who:'Lord on Juggernaut', name:'supercharge', range:'12"', A:'1', BS:'3+', S:'8', AP:'-3', D:'2', kw:['HAZARDOUS','PISTOL'] },
        { group:'Plasma pistol', who:'Khorne Berzerkers', n:5, name:'standard', range:'12"', A:'1', BS:'4+', S:'7', AP:'-2', D:'1', kw:['PISTOL'] },
        { group:'Plasma pistol', who:'Khorne Berzerkers', n:5, name:'supercharge', range:'12"', A:'1', BS:'4+', S:'8', AP:'-3', D:'2', kw:['HAZARDOUS','PISTOL'] },
        { name:'Bolt pistol', who:'Khorne Berzerkers', n:15, range:'12"', A:'1', BS:'4+', S:'5', AP:'-1', D:'1', kw:['PISTOL'] }
      ],
      melee:[
        { name:'Bladed horn', who:'Lord on Juggernaut', range:'Melee', A:'5', WS:'3+', S:'6', AP:'-1', D:'2', kw:['EXTRA ATTACKS','LANCE'], from:{ A:'Relentless Rage' } },
        { name:'Exalted chainblade', who:'Lord on Juggernaut', range:'Melee', A:'8', WS:'2+', S:'6', AP:'-1', D:'2', kw:[], from:{ A:'Relentless Rage' } },
        { name:'Chainblade', who:'Khorne Berzerkers', n:16, range:'Melee', A:'5', WS:'3+', S:'5', AP:'-1', D:'1', kw:[], from:{ A:'Relentless Rage' } },
        { name:'Khornate eviscerator', who:'Khorne Berzerkers', n:4, range:'Melee', A:'4', WS:'3+', S:'8', AP:'-2', D:'2', kw:[], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Aggressive Advance', who:'Lord on Juggernaut', ph:['movement','charge'], turn:'your', turns:{ charge:'either' }, text:'While this model is leading a unit, models in that unit have a Move characteristic of 10" and each time a model in that unit makes a Normal, Advance, Fall Back or Charge move, it can move horizontally through terrain features.' },
        { name:'Crush All Who Stand Before Us', who:'Lord on Juggernaut', ph:['fight'], turn:'either', text:'Each time this model’s unit is selected to fight, you can use this ability. When determining which models in this unit are eligible to fight, any models in it that are within 3" of one or more enemy models are eligible to fight. When resolving those attacks, such models can target one of those enemy units that is within 3" of them and within Engagement Range of their unit.' },
        { name:'Archslaughterer', who:'Lord on Juggernaut', tag:'Enhancement', ph:['command'], turn:'your', text:'**WORLD EATERS** model only. (Once per battle, per army) In your Command phase, you can use this ability. If you do, every **Blessing of Khorne** is active for this unit until the start of your next turn.' },
        { name:'Blood Surge', who:'Khorne Berzerkers', ph:['shooting'], turn:'opp', text:'In your opponent’s Shooting phase, when an enemy unit has shot, if a model in this unit was destroyed as a result of those attacks, this unit can make a surge move of up to D6+2".' },
        { name:'Murderous Charge', who:'Khorne Berzerkers', ph:['fight'], turn:'either', text:'If this unit made a charge move this turn, this unit’s melee attacks have +1 S.' },
        { name:'Icon of Khorne', who:'Khorne Berzerkers', ph:['command','movement','shooting','fight'], turn:'either', turns:{ movement:'opp', shooting:'your' }, text:'If the bearer’s unit contains one or more Icons of Khorne, each time the bearer’s unit destroys an enemy unit, you gain 1 Bloodshed point. Each time you make a **Blessings of Khorne** roll, roll one additional D6 for each Bloodshed point you have, after which, all your Bloodshed points are lost.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Made a charge move this turn', cond:'charged', note:'+1 S', from:'Murderous Charge' }
      ],
      rules:['Leader','Blessings of Khorne','Extra Attacks','Lance','Pistol','Hazardous'],
      kw:['Chaos','Character','Faction: World Eaters','Khorne','Lord on Juggernaut','Mounted','Battleline','Berzerkers','Grenades','Infantry'],
      kwNote:'Battleline, Berzerkers, Grenades, Infantry come from the led Khorne Berzerkers.'
    },
    {
      id:'slaughterbound-exalted-eightbound', name:'Slaughterbound', role:'Character', pts:240, ptsNote:'110 + Exalted Eightbound 130', enhancement:'Battle-lust',
      // only the Slaughterbound model has Scouts 6" (Lord of the Eightbound); its Exalted Eightbound don't, so the unit can't scout (24.31)
      partialRules:['Scouts 6"'],
      leads:'Exalted Eightbound',
      models:['1× Slaughterbound','1× Exalted Eightbound Champion','2× Exalted Eightbound'],
      gear:[['Lacerator and daemonic claw'],['Chainblades'],['Chainblades']],
      stats:[
        { name:'Slaughterbound', M:'10"', T:'6', Sv:'3+', W:'6', Ld:'6+', OC:'1', InSv:'5+', base:'50mm' },
        { name:'Exalted Eightbound', M:'10"', T:'6', Sv:'3+', W:'3', Ld:'6+', OC:'1', InSv:'5+', base:'40mm' }
      ],
      melee:[
        { name:'Lacerator and daemonic claw', who:'Slaughterbound', range:'Melee', A:'7', WS:'2+', S:'10', AP:'-2', D:'2', kw:[], from:{ A:'Relentless Rage' } },
        { name:'Chainblades', who:'Exalted Eightbound', n:3, range:'Melee', A:'5', WS:'3+', S:'8', AP:'-3', D:'2', kw:['ANTI-MONSTER 3+','ANTI-VEHICLE 3+'], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Rage Eternal', who:'Slaughterbound', ph:['command'], turn:'your', text:'While this model is leading a unit, in your Command phase, you can return one destroyed Bodyguard model to that unit.' },
        { name:'Possessed Lord', who:'Slaughterbound', ph:['fight'], turn:'either', text:'Once per battle, at the start of the Fight phase, this model can use this ability. If it does, until the end of the phase, add 3 to the Attacks characteristic of melee weapons equipped by this model and those weapons have the **[Devastating Wounds]** ability.' },
        { name:'Lord of the Eightbound', who:'Slaughterbound', text:'If this model is attached to a **WORLD EATERS POSSESSED** unit during the Declare Battle Formations step, this model has the **Deep Strike** and **Scouts 6"** abilities.' },
        { name:'Battle-lust', who:'Slaughterbound', tag:'Enhancement', ph:['charge'], turn:'either', text:'**WORLD EATERS** model only. You can re-roll **Charge rolls** made for the bearer’s unit. In addition, while the Unbridled Bloodlust Blessing of Khorne is active for your army, add 1 to Charge rolls made for the bearer’s unit.' },
        { name:'Rend and Tear', who:'Exalted Eightbound', ph:['fight'], turn:'either', text:'Each time a model in this unit makes a melee attack that targets a **MONSTER** or **VEHICLE** unit, until the end of the phase, improve the Damage characteristic of that attack by 1.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', weapon:'Lacerator and daemonic claw', set:{ A:'10' }, when:'Possessed Lord (once per battle, start of the Fight phase)', note:'and [DEVASTATING WOUNDS] until the end of the phase', from:'Possessed Lord' },
        // "this unit" is the whole attached unit, the Slaughterbound included
        { kind:'melee', when:'vs MONSTER/VEHICLE', note:'+1 D', from:'Rend and Tear', always:true, vs:{ any:['Monster','Vehicle'] } }
      ],
      rules:['Leader','Deadly Demise D3','Blessings of Khorne','Deep Strike','Scouts 6"','Anti'],
      kw:['Chaos','Character','Daemon','Faction: World Eaters','Infantry','Khorne','Possessed','Slaughterbound','Exalted Eightbound'],
      kwNote:'Exalted Eightbound comes from the led Exalted Eightbound.'
    },
    {
      id:'chaos-rhino', name:'Chaos Rhino', role:'Dedicated Transport', pts:75,
      models:['1× Chaos Rhino'],
      gear:[['Armoured tracks','Combi-bolter']],
      stats:[
        { name:'Chaos Rhino', M:'12"', T:'9', Sv:'3+', W:'10', Ld:'6+', OC:'2', InSv:'–', base:'Hull' }
      ],
      ranged:[
        { name:'Combi-bolter', range:'24"', A:'2', BS:'4+', S:'5', AP:'-1', D:'1', kw:['RAPID FIRE 4'] }
      ],
      melee:[
        { name:'Armoured tracks', range:'Melee', A:'7', WS:'3+', S:'6', AP:'0', D:'1', kw:[], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Meet Any Challenge', ph:['movement'], turn:'opp', text:'In your opponent’s Movement phase, each time an enemy unit is set up or ends a Normal, Advance or Fall Back move within 8" of this model, any units embarked within it can disembark.' },
        { name:'Transport', tag:'Capacity', text:'This model has a transport capacity of 12 **WORLD EATERS INFANTRY** models. It cannot transport **POSSESSED** or **TERMINATOR** models.' }
      ],
      rules:['Deadly Demise D3','Blessings of Khorne','Firing Deck 2','Rapid Fire'],
      kw:['Chaos','Dedicated Transport','Faction: World Eaters','Frame','Khorne','Rhino','Smoke','Transport','Vehicle']
    },
    {
      id:'eightbound', name:'Eightbound', role:'Infantry', pts:125,
      models:['1× Eightbound Champion','2× Eightbound'],
      gear:[['Chainblades'],['Chainblades']],
      stats:[
        { name:'Eightbound', M:'10"', T:'6', Sv:'3+', W:'3', Ld:'6+', OC:'1', InSv:'5+', base:'40mm' }
      ],
      melee:[
        { name:'Chainblades', n:3, range:'Melee', A:'6', WS:'3+', S:'8', AP:'-2', D:'2', kw:[], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Beacons of Rage', tag:'Aura', ph:['fight'], turn:'either', text:'While a friendly **WORLD EATERS** unit is within 6" of this unit, each time a model in that unit makes a melee attack that targets a unit (excluding **MONSTERS** and **VEHICLES**), add 1 to the Hit roll. If that attack targets a unit that is Below Half-strength, add 1 to the Wound roll as well.' }
      ],
      aura:[
        { kind:'melee', needs:{ all:['Faction: World Eaters'] }, when:'Within 6" of Eightbound, vs non-MONSTER/VEHICLE targets', selfWhen:'Own aura, vs non-MONSTER/VEHICLE targets', note:'+1 to hit', from:'Beacons of Rage', selfAlways:true, vs:{ none:['Monster','Vehicle'] }, calc:{ hit:1 } },
        { kind:'melee', needs:{ all:['Faction: World Eaters'] }, when:'Within 6" of Eightbound, target Below Half-strength, vs non-MONSTER/VEHICLE targets', selfWhen:'Own aura, target Below Half-strength, vs non-MONSTER/VEHICLE targets', note:'+1 to wound rolls', from:'Beacons of Rage', vs:{ none:['Monster','Vehicle'] }, calc:{ wound:1 } }
      ],
      rules:['Scouts 6"','Blessings of Khorne'],
      kw:['Chaos','Daemon','Eightbound','Faction: World Eaters','Infantry','Khorne','Possessed']
    },
    {
      id:'jakhals', name:'Jakhals', role:'Infantry', pts:65,
      models:['1× Jakhal Pack Leader','1× Dishonoured w/ paired manglers','8× Jakhal'],
      gear:[['Autopistol','Chainblades'],['Paired manglers'],['Autopistol','Chainblades']],
      stats:[
        { name:'Jakhal', M:'7"', T:'4', Sv:'6+', W:'1', Ld:'7+', OC:'1', InSv:'–', base:'28.5mm' },
        { name:'Dishonoured w/ paired manglers', M:'7"', T:'4', Sv:'6+', W:'1', Ld:'7+', OC:'1', InSv:'–', base:'40mm' }
      ],
      ranged:[
        { name:'Autopistol', n:9, range:'12"', A:'1', BS:'4+', S:'3', AP:'0', D:'1', kw:['PISTOL'] }
      ],
      melee:[
        { name:'Chainblades', n:9, range:'Melee', A:'4', WS:'4+', S:'3', AP:'0', D:'1', kw:[], from:{ A:'Relentless Rage' } },
        { name:'Paired manglers', range:'Melee', A:'5', WS:'4+', S:'4', AP:'0', D:'1', kw:[], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Objective Ravaged', ph:['command'], turn:'your', text:'At the end of your Command phase, if this unit is within range of an objective marker you control, that objective marker remains under your control until your opponent’s Level of Control over that objective marker is greater than yours at the end of a phase.' }
      ],
      rules:['Blessings of Khorne','Pistol'],
      kw:['Chaos','Faction: World Eaters','Grenades','Infantry','Jakhals','Khorne']
    },
    {
      id:'forgefiend', name:'Forgefiend', role:'Vehicle', pts:145, copies:2,
      models:['1× Forgefiend'],
      gear:[['Hades autocannon','Hades autocannon','Ectoplasma cannon','Forgefiend claws']],
      stats:[
        { name:'Forgefiend', M:'10"', T:'10', Sv:'3+', W:'12', Ld:'6+', OC:'3', InSv:'5+', base:'120×92mm' }
      ],
      ranged:[
        { name:'Hades autocannon', n:2, range:'36"', A:'6', BS:'4+', S:'8', AP:'-1', D:'2', kw:['RAPID FIRE 4'] },
        { name:'Ectoplasma cannon', range:'36"', A:'D3', BS:'4+', S:'10', AP:'-3', D:'3', kw:['BLAST','RAPID FIRE 1'] }
      ],
      melee:[
        { name:'Forgefiend claws', range:'Melee', A:'7', WS:'3+', S:'6', AP:'0', D:'1', kw:[], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Furious Onslaught', ph:['movement','shooting'], turn:'either', turns:{ movement:'opp', shooting:'your' }, text:'Each time this model makes a ranged attack that targets the closest eligible target within 18", you can re-roll the Hit roll.' },
        { name:'Damaged: 1-4 wounds remaining', damaged:'1-4', text:'While this model has 1-4 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target is the closest eligible target within 18"', cond:'closest18', note:'re-roll the hit roll', from:'Furious Onslaught' },
        { kind:'all', when:'Damaged (1-4 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-4 wounds remaining' }
      ],
      rules:['Deadly Demise D3','Blessings of Khorne','Rapid Fire','Blast'],
      kw:['Chaos','Daemon','Faction: World Eaters','Forgefiend','Khorne','Vehicle','Walker']
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
      id:'angron', name:'Angron', role:'Epic Hero', pts:330, warlord:true,
      models:['1× Angron'],
      gear:[['Samni’arius and Spinegrinder']],
      stats:[
        { name:'Angron', M:'14"', T:'11', Sv:'2+', W:'16', Ld:'5+', OC:'6', InSv:'4+', base:'100mm' }
      ],
      melee:[
        { group:'Samni’arius and Spinegrinder', name:'strike', range:'Melee', A:'9', WS:'2+', S:'14', AP:'-3', D:'D6+2', kw:['DEVASTATING WOUNDS'], from:{ A:'Relentless Rage' } },
        { group:'Samni’arius and Spinegrinder', name:'sweep', range:'Melee', A:'17', WS:'2+', S:'7', AP:'-2', D:'2', kw:['DEVASTATING WOUNDS'], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Reborn in Blood', ph:['command','movement'], turn:'either', turns:{ movement:'your' }, text:'At the start of the battle round, when you make a **Blessings of Khorne** roll, if this model is destroyed, you can use a triple 6 from that roll to use this ability instead of activating any Blessings of Khorne at the start of that battle round. If you do, this model is no longer destroyed and in the Reinforcements step of your next Movement phase, it is set up anywhere on the battlefield using its **Deep Strike** ability, with 8 wounds remaining.' },
        { name:'Wrathful Presence', at:'Start of the battle round', ph:['command'], turn:'either', text:'At the start of the battle round, select one Wrathful Presence ability. Until the start of the next battle round, this model has that ability.' },
        { name:'Damaged: 1-6 wounds remaining', damaged:'1-6', text:'While this model has 1-6 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' },
        // the three Wrathful Presence abilities: Angron has the one selected at the start of the battle round
        { name:'The Blood God’s Favour', who:'Wrathful Presence: pick one', text:'Each time you make a **Blessings of Khorne** roll, if this model is on the battlefield, you can re-roll up to 6 of the D6 rolled.' },
        // GW Faction Pack Rules Update wording (BSData has it too)
        { name:'Driven by Ultimate Rage', who:'Wrathful Presence: pick one', tag:'Aura', ph:['fight'], turn:'either', text:'While a friendly **WORLD EATERS** unit is within 6" of this unit, that unit’s melee attacks can:\n- Re-roll hit rolls of 1.\n- Re-roll wound rolls of 1.' },
        { name:'Overwhelming Wrath', who:'Wrathful Presence: pick one', tag:'Aura', ph:['movement'], turn:'opp', text:'Each time an enemy unit within 6" of this model is selected to Fall Back, that unit must take a Leadership test. If that test is failed, that unit must Remain Stationary this phase instead.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Damaged (1-6 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-6 wounds remaining' }
      ],
      aura:[
        { kind:'melee', needs:{ all:['Faction: World Eaters'] }, when:'Within 6" of Angron, if he has Driven by Ultimate Rage this round', selfWhen:'Own aura, if he has Driven by Ultimate Rage this round', note:'re-roll hit rolls of 1 and wound rolls of 1', from:'Driven by Ultimate Rage' }
      ],
      rules:['Deadly Demise D6','Deep Strike','Blessings of Khorne','Devastating Wounds'],
      kw:['Angron','Chaos','Character','Daemon','Epic Hero','Faction: World Eaters','Fly','Khorne','Monster','Primarch','Warlord']
    },
    {
      id:'kh-rn-the-betrayer-khorne-berzerkers', name:'Khârn the Betrayer', role:'Epic Hero', pts:285, ptsNote:'115 + Khorne Berzerkers 170',
      leads:'Khorne Berzerkers',
      models:['1× Khârn the Betrayer','1× Khorne Berzerker Champion','7× Khorne Berzerker','2× Khorne Berzerker w/ eviscerator and plasma pistol'],
      gear:[['Gorechild','Plasma pistol'],['Chainblade','Plasma pistol'],['Bolt pistol','Chainblade'],['Khornate eviscerator','Plasma pistol']],
      stats:[
        { name:'Khârn the Betrayer', M:'8"', T:'5', Sv:'3+', W:'5', Ld:'6+', OC:'1', InSv:'4+', base:'40mm' },
        { name:'Khorne Berzerker ×10', M:'8"', T:'5', Sv:'3+', W:'2', Ld:'6+', OC:'2', InSv:'–', base:'32mm' }
      ],
      ranged:[
        { group:'Plasma pistol', who:'Khârn the Betrayer', name:'standard', range:'12"', A:'1', BS:'3+', S:'7', AP:'-2', D:'1', kw:['PISTOL'] },
        { group:'Plasma pistol', who:'Khârn the Betrayer', name:'supercharge', range:'12"', A:'1', BS:'3+', S:'8', AP:'-3', D:'2', kw:['HAZARDOUS','PISTOL'] },
        { group:'Plasma pistol', who:'Khorne Berzerkers', n:3, name:'standard', range:'12"', A:'1', BS:'4+', S:'7', AP:'-2', D:'1', kw:['PISTOL'] },
        { group:'Plasma pistol', who:'Khorne Berzerkers', n:3, name:'supercharge', range:'12"', A:'1', BS:'4+', S:'8', AP:'-3', D:'2', kw:['HAZARDOUS','PISTOL'] },
        { name:'Bolt pistol', who:'Khorne Berzerkers', n:7, range:'12"', A:'1', BS:'4+', S:'5', AP:'-1', D:'1', kw:['PISTOL'] }
      ],
      melee:[
        { name:'Gorechild', who:'Khârn the Betrayer', range:'Melee', A:'9', WS:'2+', S:'7', AP:'-2', D:'3', kw:[], from:{ A:'Relentless Rage' } },
        { name:'Chainblade', who:'Khorne Berzerkers', n:8, range:'Melee', A:'5', WS:'3+', S:'5', AP:'-1', D:'1', kw:[], from:{ A:'Relentless Rage' } },
        { name:'Khornate eviscerator', who:'Khorne Berzerkers', n:2, range:'Melee', A:'4', WS:'3+', S:'8', AP:'-2', D:'2', kw:[], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Legendary Killer', who:'Khârn the Betrayer', ph:['fight'], turn:'either', text:'While this model is leading a unit, each time a model in that unit makes a melee attack, re-roll a Hit roll of 1 and re-roll a Wound roll of 1.' },
        { name:'The Betrayer', who:'Khârn the Betrayer', ph:['charge'], turn:'your', text:'At the end of your Charge phase, if this unit is on the battlefield, is **unengaged**, and contains a **bodyguard** model, this unit makes a **leadership roll**:\n- If that **leadership roll** is failed, one **bodyguard** model in this unit is **destroyed**.' },
        { name:'Berserker Frenzy', who:'Khârn the Betrayer', comeback:{ roll:2, wounds:3 }, def:'Khârn: the first time he is destroyed, at the end of the phase on a 2+ he is set back up with 3 wounds, as close as possible to where he was destroyed and not within Engagement Range of enemy units', text:'The first time this model is destroyed, at the end of the phase, roll one D6: on a 2+, set this model back up on the battlefield as close as possible to where it was destroyed and not within Engagement Range of any enemy units, with 3 wounds remaining.' },
        { name:'Blood Surge', who:'Khorne Berzerkers', ph:['shooting'], turn:'opp', text:'In your opponent’s Shooting phase, when an enemy unit has shot, if a model in this unit was destroyed as a result of those attacks, this unit can make a surge move of up to D6+2".' },
        { name:'Murderous Charge', who:'Khorne Berzerkers', ph:['fight'], turn:'either', text:'If this unit made a charge move this turn, this unit’s melee attacks have +1 S.' },
        { name:'Icon of Khorne', who:'Khorne Berzerkers', na:'No Icon of Khorne in this unit', text:'If the bearer’s unit contains one or more Icons of Khorne, each time the bearer’s unit destroys an enemy unit, you gain 1 Bloodshed point. Each time you make a **Blessings of Khorne** roll, roll one additional D6 for each Bloodshed point you have, after which, all your Bloodshed points are lost.' }
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
      id:'lord-on-juggernaut', name:'Lord on Juggernaut', role:'Character', pts:95,
      models:['1× Lord on Juggernaut'],
      gear:[['Bladed horn','Exalted chainblade','Plasma pistol']],
      stats:[
        { name:'Lord on Juggernaut', M:'10"', T:'6', Sv:'3+', W:'7', Ld:'6+', OC:'2', InSv:'4+', base:'90×52.5mm' }
      ],
      ranged:[
        { group:'Plasma pistol', name:'standard', range:'12"', A:'1', BS:'3+', S:'7', AP:'-2', D:'1', kw:['PISTOL'] },
        { group:'Plasma pistol', name:'supercharge', range:'12"', A:'1', BS:'3+', S:'8', AP:'-3', D:'2', kw:['HAZARDOUS','PISTOL'] }
      ],
      melee:[
        { name:'Bladed horn', range:'Melee', A:'5', WS:'3+', S:'6', AP:'-1', D:'2', kw:['EXTRA ATTACKS','LANCE'], from:{ A:'Relentless Rage' } },
        { name:'Exalted chainblade', range:'Melee', A:'8', WS:'2+', S:'6', AP:'-1', D:'2', kw:[], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Aggressive Advance', ph:['movement','charge'], turn:'your', turns:{ charge:'either' }, text:'While this model is leading a unit, models in that unit have a Move characteristic of 10" and each time a model in that unit makes a Normal, Advance, Fall Back or Charge move, it can move horizontally through terrain features.' },
        { name:'Crush All Who Stand Before Us', ph:['fight'], turn:'either', text:'Each time this model’s unit is selected to fight, you can use this ability. When determining which models in this unit are eligible to fight, any models in it that are within 3" of one or more enemy models are eligible to fight. When resolving those attacks, such models can target one of those enemy units that is within 3" of them and within Engagement Range of their unit.' }
      ],
      rules:['Leader','Blessings of Khorne','Extra Attacks','Lance','Pistol','Hazardous'],
      kw:['Chaos','Character','Faction: World Eaters','Khorne','Lord on Juggernaut','Mounted']
    },
    {
      id:'slaughterbound', name:'Slaughterbound', role:'Character', pts:90,
      models:['1× Slaughterbound'],
      gear:[['Lacerator and daemonic claw']],
      stats:[
        { name:'Slaughterbound', M:'10"', T:'6', Sv:'3+', W:'6', Ld:'6+', OC:'1', InSv:'5+', base:'50mm' }
      ],
      melee:[
        { name:'Lacerator and daemonic claw', range:'Melee', A:'7', WS:'2+', S:'10', AP:'-2', D:'2', kw:[], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Rage Eternal', ph:['command'], turn:'your', text:'While this model is leading a unit, in your Command phase, you can return one destroyed Bodyguard model to that unit.' },
        { name:'Possessed Lord', ph:['fight'], turn:'either', text:'Once per battle, at the start of the Fight phase, this model can use this ability. If it does, until the end of the phase, add 3 to the Attacks characteristic of melee weapons equipped by this model and those weapons have the **[Devastating Wounds]** ability.' },
        { name:'Lord of the Eightbound', text:'If this model is attached to a **WORLD EATERS POSSESSED** unit during the Declare Battle Formations step, this model has the **Deep Strike** and **Scouts 6"** abilities.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', weapon:'Lacerator and daemonic claw', set:{ A:'10' }, when:'Possessed Lord (once per battle, start of the Fight phase)', note:'and [DEVASTATING WOUNDS] until the end of the phase', from:'Possessed Lord' }
      ],
      rules:['Leader','Deadly Demise D3','Blessings of Khorne'],
      kw:['Chaos','Character','Daemon','Faction: World Eaters','Infantry','Khorne','Possessed','Slaughterbound']
    },
    {
      id:'slaughterbound-exalted-eightbound', name:'Slaughterbound', role:'Character', pts:255, ptsNote:'125 + Exalted Eightbound 130', enhancement:'Berzerker Glaive',
      // only the Slaughterbound model has Scouts 6" (Lord of the Eightbound); its Exalted Eightbound don't, so the unit can't scout (24.31)
      partialRules:['Scouts 6"'],
      leads:'Exalted Eightbound',
      models:['1× Slaughterbound','1× Exalted Eightbound Champion','2× Exalted Eightbound'],
      gear:[['Lacerator and daemonic claw'],['Chainblades'],['Chainblades']],
      stats:[
        { name:'Slaughterbound', M:'10"', T:'6', Sv:'3+', W:'6', Ld:'6+', OC:'1', InSv:'5+', base:'50mm' },
        { name:'Exalted Eightbound', M:'10"', T:'6', Sv:'3+', W:'3', Ld:'6+', OC:'1', InSv:'5+', base:'40mm' }
      ],
      melee:[
        { name:'Lacerator and daemonic claw', who:'Slaughterbound', range:'Melee', A:'8', WS:'2+', S:'10', AP:'-2', D:'3', kw:[], from:{ A:['Berzerker Glaive','Relentless Rage'], D:'Berzerker Glaive' } },
        { name:'Chainblades', who:'Exalted Eightbound', n:3, range:'Melee', A:'5', WS:'3+', S:'8', AP:'-3', D:'2', kw:['ANTI-MONSTER 3+','ANTI-VEHICLE 3+'], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Rage Eternal', who:'Slaughterbound', ph:['command'], turn:'your', text:'While this model is leading a unit, in your Command phase, you can return one destroyed Bodyguard model to that unit.' },
        { name:'Possessed Lord', who:'Slaughterbound', ph:['fight'], turn:'either', text:'Once per battle, at the start of the Fight phase, this model can use this ability. If it does, until the end of the phase, add 3 to the Attacks characteristic of melee weapons equipped by this model and those weapons have the **[Devastating Wounds]** ability.' },
        { name:'Lord of the Eightbound', who:'Slaughterbound', text:'If this model is attached to a **WORLD EATERS POSSESSED** unit during the Declare Battle Formations step, this model has the **Deep Strike** and **Scouts 6"** abilities.' },
        { name:'Berzerker Glaive', who:'Slaughterbound', tag:'Enhancement', text:'**WORLD EATERS** model only. Add 1 to the Attacks and Damage characteristics of melee weapons (excluding Extra Attacks weapons) equipped by the bearer.' },
        { name:'Rend and Tear', who:'Exalted Eightbound', ph:['fight'], turn:'either', text:'Each time a model in this unit makes a melee attack that targets a **MONSTER** or **VEHICLE** unit, until the end of the phase, improve the Damage characteristic of that attack by 1.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', weapon:'Lacerator and daemonic claw', set:{ A:'11' }, when:'Possessed Lord (once per battle, start of the Fight phase)', note:'and [DEVASTATING WOUNDS] until the end of the phase', from:'Possessed Lord' },
        // "this unit" is the whole attached unit, the Slaughterbound included
        { kind:'melee', when:'vs MONSTER/VEHICLE', note:'+1 D', from:'Rend and Tear', always:true, vs:{ any:['Monster','Vehicle'] } }
      ],
      rules:['Leader','Deadly Demise D3','Blessings of Khorne','Deep Strike','Scouts 6"','Anti'],
      kw:['Chaos','Character','Daemon','Faction: World Eaters','Infantry','Khorne','Possessed','Slaughterbound','Exalted Eightbound'],
      kwNote:'Exalted Eightbound comes from the led Exalted Eightbound.'
    },
    {
      id:'chaos-rhino', name:'Chaos Rhino', role:'Dedicated Transport', pts:75,
      models:['1× Chaos Rhino'],
      gear:[['Armoured tracks','Combi-bolter']],
      stats:[
        { name:'Chaos Rhino', M:'12"', T:'9', Sv:'3+', W:'10', Ld:'6+', OC:'2', InSv:'–', base:'Hull' }
      ],
      ranged:[
        { name:'Combi-bolter', range:'24"', A:'2', BS:'4+', S:'5', AP:'-1', D:'1', kw:['RAPID FIRE 4'] }
      ],
      melee:[
        { name:'Armoured tracks', range:'Melee', A:'7', WS:'3+', S:'6', AP:'0', D:'1', kw:[], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Meet Any Challenge', ph:['movement'], turn:'opp', text:'In your opponent’s Movement phase, each time an enemy unit is set up or ends a Normal, Advance or Fall Back move within 8" of this model, any units embarked within it can disembark.' },
        { name:'Transport', tag:'Capacity', text:'This model has a transport capacity of 12 **WORLD EATERS INFANTRY** models. It cannot transport **POSSESSED** or **TERMINATOR** models.' }
      ],
      rules:['Deadly Demise D3','Blessings of Khorne','Firing Deck 2','Rapid Fire'],
      kw:['Chaos','Dedicated Transport','Faction: World Eaters','Frame','Khorne','Rhino','Smoke','Transport','Vehicle']
    },
    {
      id:'eightbound', name:'Eightbound', role:'Infantry', pts:125, copies:2,
      models:['1× Eightbound Champion','2× Eightbound'],
      gear:[['Chainblades'],['Chainblades']],
      stats:[
        { name:'Eightbound', M:'10"', T:'6', Sv:'3+', W:'3', Ld:'6+', OC:'1', InSv:'5+', base:'40mm' }
      ],
      melee:[
        { name:'Chainblades', n:3, range:'Melee', A:'6', WS:'3+', S:'8', AP:'-2', D:'2', kw:[], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Beacons of Rage', tag:'Aura', ph:['fight'], turn:'either', text:'While a friendly **WORLD EATERS** unit is within 6" of this unit, each time a model in that unit makes a melee attack that targets a unit (excluding **MONSTERS** and **VEHICLES**), add 1 to the Hit roll. If that attack targets a unit that is Below Half-strength, add 1 to the Wound roll as well.' }
      ],
      aura:[
        { kind:'melee', needs:{ all:['Faction: World Eaters'] }, when:'Within 6" of Eightbound, vs non-MONSTER/VEHICLE targets', selfWhen:'Own aura, vs non-MONSTER/VEHICLE targets', note:'+1 to hit', from:'Beacons of Rage', selfAlways:true, vs:{ none:['Monster','Vehicle'] }, calc:{ hit:1 } },
        { kind:'melee', needs:{ all:['Faction: World Eaters'] }, when:'Within 6" of Eightbound, target Below Half-strength, vs non-MONSTER/VEHICLE targets', selfWhen:'Own aura, target Below Half-strength, vs non-MONSTER/VEHICLE targets', note:'+1 to wound rolls', from:'Beacons of Rage', vs:{ none:['Monster','Vehicle'] }, calc:{ wound:1 } }
      ],
      rules:['Scouts 6"','Blessings of Khorne'],
      kw:['Chaos','Daemon','Eightbound','Faction: World Eaters','Infantry','Khorne','Possessed']
    },
    {
      id:'exalted-eightbound', name:'Exalted Eightbound', role:'Infantry', pts:130,
      models:['1× Exalted Eightbound Champion','2× Exalted Eightbound'],
      gear:[['Chainblades'],['Chainblades']],
      stats:[
        { name:'Exalted Eightbound', M:'10"', T:'6', Sv:'3+', W:'3', Ld:'6+', OC:'1', InSv:'5+', base:'40mm' }
      ],
      melee:[
        { name:'Chainblades', n:3, range:'Melee', A:'5', WS:'3+', S:'8', AP:'-3', D:'2', kw:['ANTI-MONSTER 3+','ANTI-VEHICLE 3+'], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Rend and Tear', ph:['fight'], turn:'either', text:'Each time a model in this unit makes a melee attack that targets a **MONSTER** or **VEHICLE** unit, until the end of the phase, improve the Damage characteristic of that attack by 1.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'vs MONSTER/VEHICLE', note:'+1 D', from:'Rend and Tear', always:true, vs:{ any:['Monster','Vehicle'] } }
      ],
      rules:['Deep Strike','Blessings of Khorne','Anti'],
      kw:['Chaos','Daemon','Exalted Eightbound','Faction: World Eaters','Infantry','Khorne','Possessed']
    },
    {
      id:'goremongers', name:'Goremongers', role:'Infantry', pts:70,
      models:['1× Blood Herald','7× Goremonger w/ chainblade'],
      gear:[['Autopistol','Chainblade','Close combat weapon'],['Autopistol','Chainblade','Close combat weapon']],
      stats:[
        { name:'Goremongers', M:'9"', T:'4', Sv:'6+', W:'1', Ld:'7+', OC:'1', InSv:'–', base:'32mm' }
      ],
      ranged:[
        { name:'Autopistol', n:8, range:'12"', A:'1', BS:'4+', S:'3', AP:'0', D:'1', kw:['PISTOL'] }
      ],
      melee:[
        { name:'Chainblade', n:8, range:'Melee', A:'4', WS:'4+', S:'3', AP:'0', D:'1', kw:['LANCE'], from:{ A:'Relentless Rage' } },
        { name:'Close combat weapon', n:8, range:'Melee', A:'3', WS:'4+', S:'3', AP:'0', D:'1', kw:[], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Loping Speed', ph:['movement'], turn:'opp', text:'In your opponent’s Movement phase, if an enemy unit ends a move within 8" of this unit, if this unit is not within Engagement Range of one or more enemy units, this unit can make a Normal move of up to D6".' }
      ],
      rules:['Infiltrators','Blessings of Khorne','Pistol','Lance'],
      kw:['Chaos','Faction: World Eaters','Goremongers','Grenades','Infantry','Khorne']
    },
    {
      id:'jakhals', name:'Jakhals', role:'Infantry', pts:65, copies:2,
      models:['1× Jakhal Pack Leader','1× Dishonoured w/ paired manglers','8× Jakhal'],
      gear:[['Autopistol','Chainblades'],['Paired manglers'],['Autopistol','Chainblades']],
      stats:[
        { name:'Jakhal', M:'7"', T:'4', Sv:'6+', W:'1', Ld:'7+', OC:'1', InSv:'–', base:'28.5mm' },
        { name:'Dishonoured w/ paired manglers', M:'7"', T:'4', Sv:'6+', W:'1', Ld:'7+', OC:'1', InSv:'–', base:'40mm' }
      ],
      ranged:[
        { name:'Autopistol', n:9, range:'12"', A:'1', BS:'4+', S:'3', AP:'0', D:'1', kw:['PISTOL'] }
      ],
      melee:[
        { name:'Chainblades', n:9, range:'Melee', A:'4', WS:'4+', S:'3', AP:'0', D:'1', kw:[], from:{ A:'Relentless Rage' } },
        { name:'Paired manglers', range:'Melee', A:'5', WS:'4+', S:'4', AP:'0', D:'1', kw:[], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Objective Ravaged', ph:['command'], turn:'your', text:'At the end of your Command phase, if this unit is within range of an objective marker you control, that objective marker remains under your control until your opponent’s Level of Control over that objective marker is greater than yours at the end of a phase.' }
      ],
      rules:['Blessings of Khorne','Pistol'],
      kw:['Chaos','Faction: World Eaters','Grenades','Infantry','Jakhals','Khorne']
    },
    {
      id:'forgefiend', name:'Forgefiend', role:'Vehicle', pts:145, copies:2,
      models:['1× Forgefiend'],
      gear:[['Hades autocannon','Hades autocannon','Ectoplasma cannon','Forgefiend claws']],
      stats:[
        { name:'Forgefiend', M:'10"', T:'10', Sv:'3+', W:'12', Ld:'6+', OC:'3', InSv:'5+', base:'120×92mm' }
      ],
      ranged:[
        { name:'Hades autocannon', n:2, range:'36"', A:'6', BS:'4+', S:'8', AP:'-1', D:'2', kw:['RAPID FIRE 4'] },
        { name:'Ectoplasma cannon', range:'36"', A:'D3', BS:'4+', S:'10', AP:'-3', D:'3', kw:['BLAST','RAPID FIRE 1'] }
      ],
      melee:[
        { name:'Forgefiend claws', range:'Melee', A:'7', WS:'3+', S:'6', AP:'0', D:'1', kw:[], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Furious Onslaught', ph:['movement','shooting'], turn:'either', turns:{ movement:'opp', shooting:'your' }, text:'Each time this model makes a ranged attack that targets the closest eligible target within 18", you can re-roll the Hit roll.' },
        { name:'Damaged: 1-4 wounds remaining', damaged:'1-4', text:'While this model has 1-4 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target is the closest eligible target within 18"', cond:'closest18', note:'re-roll the hit roll', from:'Furious Onslaught' },
        { kind:'all', when:'Damaged (1-4 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-4 wounds remaining' }
      ],
      rules:['Deadly Demise D3','Blessings of Khorne','Rapid Fire','Blast'],
      kw:['Chaos','Daemon','Faction: World Eaters','Forgefiend','Khorne','Vehicle','Walker']
    }
  ]
},
{
  id:'pubstomper', name:'Pubstomper', faction:'thousand-sons', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Priority Assets',
  detachments:['grand-coven'],
  source:'New Recruit, exported 20 Oct 2026',
  units:[
    {
      id:'magnus-the-red', name:'Magnus the Red', role:'Epic Hero', pts:455, warlord:true,
      models:['1× Magnus the Red'],
      gear:[['Blade of Magnus','Gaze of Magnus','Tzeentch’s Firestorm']],
      stats:[
        { name:'Magnus the Red', M:'14"', T:'11', Sv:'2+', W:'16', Ld:'5+', OC:'6', InSv:'4+', base:'100mm' }
      ],
      ranged:[
        { name:'Gaze of Magnus', range:'24"', A:'3D3', BS:'2+', S:'11', AP:'-2', D:'3', kw:['DEVASTATING WOUNDS','PSYCHIC'] },
        { name:'Tzeentch’s Firestorm', range:'24"', A:'D6+3', BS:'2+', S:'6', AP:'-1', D:'2', kw:['BLAST','IGNORES COVER','PSYCHIC'] }
      ],
      melee:[
        { group:'Blade of Magnus', name:'strike', range:'Melee', A:'7', WS:'2+', S:'16', AP:'-3', D:'3', kw:['DEVASTATING WOUNDS','PSYCHIC'] },
        { group:'Blade of Magnus', name:'sweep', range:'Melee', A:'14', WS:'2+', S:'8', AP:'-1', D:'2', kw:['PSYCHIC'] }
      ],
      abilities:[
        { name:'Damaged: 1-6 wounds remaining', damaged:'1-6', text:'While this model has 1-6 wounds remaining, each time this model makes an attack, subtract 1 from the **Hit roll**.' },
        { name:'Unearthly Power', at:'Start of the battle round', ph:['command'], turn:'either', text:'At the start of the battle round, select one of the abilities in the Crimson King section. Until the start of the next battle round, this model has that ability.' },
        { name:'Lord of the Planet of the Sorcerers', tag:'Psychic', ph:['shooting'], turn:'your', text:'This model can attempt up to 2 **Rituals** per turn instead of one, and each time this model attempts a **Ritual**, add 2 to the **Psychic test** result.' },
        { name:'Impossible Form', who:'Crimson King', tag:'Psychic', def:'Impossible Form (if picked this round): -1 Damage to attacks against Magnus, excluding psychic attacks', text:'Each time an attack is made against this **PSYKER** (excluding **Psychic Attacks**), subtract 1 from the Damage characteristic of that attack.' },
        { name:'Treason of Tzeentch', who:'Crimson King', tag:'Psychic', ph:['shooting'], turn:'opp', text:'At the start of your opponent’s Shooting phase, select one enemy unit within 24" of this **PSYKER**. Until the end of the phase, ranged weapons equipped by models in that unit have the **[HAZARDOUS]** ability.' },
        { name:'Time Flux', who:'Crimson King', tag:'Aura, Psychic', ph:['movement'], turn:'your', text:'While a friendly **THOUSAND SONS** unit is within 6" of this **PSYKER**, add 2" to the Move characteristic of models in that unit.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Damaged (1-6 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-6 wounds remaining' }
      ],
      rules:['Deep Strike','Deadly Demise D6','Cabal of Sorcerers','Devastating Wounds','Psychic','Blast','Ignores Cover'],
      kw:['Chaos','Character','Daemon','Epic Hero','Faction: Thousand Sons','Fly','Magnus the Red','Monster','Primarch','Psyker','Tzeentch','Warlord']
    },
    {
      id:'daemon-prince-of-tzeentch-with-wings', name:'Daemon Prince of Tzeentch with wings', role:'Character', pts:205, enhancement:'Eldritch Vortex of E’taph',
      models:['1× Daemon Prince of Tzeentch with wings'],
      gear:[['Dark Blessing','Hellforged weapons','Infernal cannon']],
      stats:[
        { name:'Daemon Prince of Tzeentch with wings', M:'13"', T:'9', Sv:'2+', W:'10', Ld:'6+', OC:'3', InSv:'4+', base:'60mm' }
      ],
      ranged:[
        { name:'Dark Blessing', range:'24"', A:'9', BS:'2+', S:'5', AP:'-1', D:'2', kw:['IGNORES COVER','PSYCHIC','SUSTAINED HITS 1'], from:{ S:'Eldritch Vortex of E’taph', D:'Eldritch Vortex of E’taph' } },
        { name:'Infernal cannon', range:'24"', A:'3', BS:'2+', S:'5', AP:'-2', D:'2', kw:[] }
      ],
      melee:[
        { group:'Hellforged weapons', name:'strike', range:'Melee', A:'6', WS:'2+', S:'9', AP:'-2', D:'4', kw:['DEVASTATING WOUNDS','PSYCHIC'], from:{ S:'Eldritch Vortex of E’taph', D:'Eldritch Vortex of E’taph' } },
        { group:'Hellforged weapons', name:'sweep', range:'Melee', A:'12', WS:'2+', S:'7', AP:'-1', D:'2', kw:['DEVASTATING WOUNDS','PSYCHIC'], from:{ S:'Eldritch Vortex of E’taph', D:'Eldritch Vortex of E’taph' } }
      ],
      abilities:[
        // Aetherstride: the Faction Pack's Rules Updates wording ("that is more than 6\""); New Recruit and BSData print the older text
        { name:'Aetherstride', tag:'Psychic', ph:['movement','shooting','charge'], turn:'your',
          text:'In your Movement phase, when this model is set up on the battlefield using the **Deep Strike** ability, it can perform an aetherstride. If it does:\n- It can be set up anywhere on the battlefield that is more than 6" horizontally away from all enemy units.\n- Until the end of the turn, its Dark Blessing has the **[SUSTAINED HITS D3]** ability.\n- Until the end of the turn, it is not eligible to declare a charge.' },
        { name:'Hunter of Souls', ph:['movement','shooting','fight'], turn:'either', turns:{ movement:'opp', shooting:'your' },
          text:'Each time this model makes an attack that targets a **CHARACTER** unit, re-roll a Hit roll of 1 and re-roll a Wound roll of 1 (if that attack targets a **PSYKER CHARACTER** unit, you can re-roll the Hit roll and you can re-roll the Wound roll instead). Each time this model destroys a **CHARACTER** unit, this model regains up to D3 lost wounds (if that **CHARACTER** unit was a **PSYKER**, this model regains up to 3 lost wounds instead).' },
        { name:'Eldritch Vortex of E’taph', tag:'Enhancement', text:'**THOUSAND SONS** model only. Add 1 to the Strength and Damage characteristics of Psychic weapons equipped by the bearer.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'vs CHARACTER units', note:'re-roll hit rolls of 1 and wound rolls of 1', from:'Hunter of Souls', always:true, vs:{ any:['Character'] } },
        { kind:'all', when:'vs PSYKER CHARACTER units', note:'re-roll the hit roll and the wound roll', from:'Hunter of Souls', always:true, vs:{ all:['Psyker','Character'] } },
        { kind:'ranged', when:'After an aetherstride this turn', note:'Dark Blessing has [SUSTAINED HITS D3]', from:'Aetherstride', calc:{ sus:'D3', weapon:'Dark Blessing' }, lasts:'turn' }
      ],
      rules:['Deadly Demise D3','Cabal of Sorcerers','Deep Strike','Ignores Cover','Sustained Hits','Psychic','Devastating Wounds'],
      kw:['Chaos','Character','Daemon','Daemon Prince','Faction: Thousand Sons','Fly','Monster','Psyker','Tzeentch']
    },
    {
      id:'sorcerer-rubric-marines', name:'Sorcerer', role:'Character', pts:215, ptsNote:'100 + Rubric Marines 115',
      leads:'Rubric Marines',
      models:['1× Sorcerer','1× Aspiring Sorcerer','1× Rubric Marine w/ soulreaper cannon','3× Rubric Marine w/ warpflamer'],
      // New Recruit prints "Icon of Flame - Rubric Marines" with the abilities, on no models line; BSData has it as an
      // option of the unit for one of its Rubric Marines. Neither says which one carries it.
      unplaced:['Icon of Flame'],
      gear:[['Force weapon','Inferno bolt pistol','Pandaemonic Delusion','Prosperine khopesh'],['Force weapon','Malefic Curse','Warpflame pistol'],['Close combat weapon','Soulreaper cannon'],['Close combat weapon','Warpflamer']],
      stats:[
        { name:'Sorcerer', M:'6"', T:'5', Sv:'3+', W:'4', Ld:'6+', OC:'1', InSv:'5+', base:'40mm' },
        { name:'Rubric Marine', M:'6"', T:'5', Sv:'3+', W:'2', Ld:'7+', OC:'2', InSv:'5+', base:'32mm' },
        { name:'Aspiring Sorcerer', M:'6"', T:'5', Sv:'3+', W:'3', Ld:'6+', OC:'2', InSv:'5+', base:'32mm' }
      ],
      ranged:[
        { name:'Inferno bolt pistol', who:'Sorcerer', range:'12"', A:'1', BS:'3+', S:'5', AP:'-2', D:'1', kw:['PISTOL','LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Pandaemonic Delusion', who:'Sorcerer', range:'24"', A:'6', BS:'3+', S:'5', AP:'-1', D:'1', kw:['PSYCHIC','SUSTAINED HITS 3','LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Malefic Curse', who:'Rubric Marines', range:'24"', A:'3', BS:'3+', S:'4', AP:'-3', D:'1', kw:['ANTI-INFANTRY 4+','DEVASTATING WOUNDS','IGNORES COVER','PSYCHIC','LETHAL HITS'], from:{ 'IGNORES COVER':'Icon of Flame', 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Warpflame pistol', who:'Rubric Marines', range:'12"', A:'D6', BS:'–', S:'3', AP:'-1', D:'1', kw:['IGNORES COVER','PISTOL','TORRENT','LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Soulreaper cannon', who:'Rubric Marines', range:'24"', A:'6', BS:'3+', S:'6', AP:'-2', D:'1', kw:['DEVASTATING WOUNDS','IGNORES COVER','LETHAL HITS'], from:{ 'IGNORES COVER':'Icon of Flame', 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Warpflamer', who:'Rubric Marines', n:3, range:'12"', A:'D6', BS:'–', S:'4', AP:'-1', D:'1', kw:['IGNORES COVER','TORRENT','LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } }
      ],
      melee:[
        { name:'Force weapon', who:'Sorcerer', range:'Melee', A:'4', WS:'3+', S:'6', AP:'-1', D:'D3', kw:['PSYCHIC','LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Prosperine khopesh', who:'Sorcerer', range:'Melee', A:'3', WS:'3+', S:'5', AP:'-2', D:'2', kw:['LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Force weapon', who:'Rubric Marines', range:'Melee', A:'3', WS:'3+', S:'6', AP:'-1', D:'D3', kw:['PSYCHIC','LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Close combat weapon', who:'Rubric Marines', n:4, range:'Melee', A:'2', WS:'3+', S:'5', AP:'0', D:'1', kw:['LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } }
      ],
      abilities:[
        { name:'Twisted Sorceries', who:'Sorcerer', tag:'Psychic', ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' }, text:'Once per battle, in your Shooting phase or the Fight phase, this model can use this ability. If it does, until the end of the phase, improve the Strength and Attacks characteristic of Psychic weapons equipped by this model by 3.' },
        { name:'Empyric Guidance', who:'Sorcerer', tag:'Psychic', text:'While this model is leading a unit, weapons equipped by models in that unit have the **[LETHAL HITS]** ability.' },
        { name:'Bringers of Change', who:'Rubric Marines', ph:['movement','shooting'], turn:'your', turns:{ movement:'opp' }, text:'Each time a model in this unit makes a ranged attack, re-roll a Wound roll of 1. If the attack targets a unit within range of an objective marker you do not control, you can re-roll the Wound roll instead.' },
        { name:'Icon of Flame', who:'Rubric Marines', text:'Ranged weapons equipped by models in the bearer’s unit (excluding **CHARACTERS**) have the **[IGNORES COVER]** ability.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', who:'Sorcerer', when:'Twisted Sorceries used this phase (your Shooting phase or the Fight phase, once per battle)', note:'Psychic weapons +3 S and +3 A', from:'Twisted Sorceries' },
        { kind:'ranged', when:'Every ranged attack', note:'re-roll wound rolls of 1', from:'Bringers of Change', always:true, calc:{ rrWound:'1s' } },
        { kind:'ranged', when:'Target within range of an objective marker you do not control', cond:'targetObjectiveNotYours', note:'re-roll the wound roll', from:'Bringers of Change', calc:{ rrWound:'all' } }
      ],
      rules:['Leader','Cabal of Sorcerers','Psychic','Pistol','Sustained Hits','Anti','Devastating Wounds','Torrent','Ignores Cover'],
      kw:['Chaos','Character','Faction: Thousand Sons','Grenades','Infantry','Psyker','Sorcerer','Tzeentch','Battleline','Rubric','Rubric Marines','Rubricae'],
      kwNote:'Battleline, Rubric, Rubric Marines, Rubricae come from the led Rubric Marines.'
    },
    {
      id:'sorcerer-in-terminator-armour-scarab-occult-terminators', name:'Sorcerer in Terminator Armour', role:'Character', pts:565, ptsNote:'140 + Scarab Occult Terminators 425', enhancement:'Umbralefic Crystal',
      leads:'Scarab Occult Terminators',
      models:['1× Sorcerer in Terminator Armour','1× Scarab Occult Sorcerer','7× Scarab Occult Terminator','2× Scarab Occult Terminator w/ soulreaper cannon'],
      // New Recruit prints "Hellfyre missile rack (x2) - Scarab Occult Terminators" in the weapons table, on no models line.
      // The datasheet: "For every 5 models in this unit, 1 Scarab Occult Terminator can be equipped with 1 hellfyre missile
      // rack"; BSData: a unit option, max 2, each for one model of the "4-9 Scarab Occult Terminators" (plain or with a
      // heavy weapon). No source says which two carry them.
      unplaced:['Hellfyre missile rack'],
      gear:[['Force weapon','Gaze of Hate','Inferno combi-bolter'],['Force weapon','Malefic Curse','Inferno combi-bolter'],['Inferno combi-bolter','Prosperine khopesh'],['Prosperine khopesh','Soulreaper cannon']],
      stats:[
        { name:'Sorcerer in Terminator Armour', M:'5"', T:'6', Sv:'2+', W:'5', Ld:'6+', OC:'1', InSv:'4+', base:'40mm' },
        { name:'Scarab Occult Sorcerer', M:'5"', T:'6', Sv:'2+', W:'4', Ld:'6+', OC:'1', InSv:'4+', base:'40mm' },
        { name:'Scarab Occult Terminator ×9', M:'5"', T:'6', Sv:'2+', W:'3', Ld:'7+', OC:'1', InSv:'4+', base:'40mm' }
      ],
      ranged:[
        { name:'Gaze of Hate', who:'Sorcerer in Terminator Armour', range:'18"', A:'3', BS:'3+', S:'4', AP:'-3', D:'2', kw:['ANTI-MONSTER 4+','ANTI-VEHICLE 4+','DEVASTATING WOUNDS','PSYCHIC','LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Inferno combi-bolter', who:'Sorcerer in Terminator Armour', range:'24"', A:'2', BS:'3+', S:'5', AP:'-2', D:'1', kw:['RAPID FIRE 2','LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Malefic Curse', who:'Scarab Occult Terminators', range:'24"', A:'3', BS:'3+', S:'4', AP:'-3', D:'1', kw:['ANTI-INFANTRY 4+','DEVASTATING WOUNDS','PSYCHIC','LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Inferno combi-bolter', who:'Scarab Occult Terminators', n:8, range:'24"', A:'2', BS:'3+', S:'5', AP:'-2', D:'1', kw:['RAPID FIRE 2','LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Soulreaper cannon', who:'Scarab Occult Terminators', n:2, range:'24"', A:'6', BS:'3+', S:'6', AP:'-2', D:'1', kw:['DEVASTATING WOUNDS','LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Hellfyre missile rack', who:'Scarab Occult Terminators', n:2, range:'36"', A:'2', BS:'3+', S:'10', AP:'-2', D:'3', kw:['LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } }
      ],
      melee:[
        { name:'Force weapon', who:'Sorcerer in Terminator Armour', range:'Melee', A:'5', WS:'3+', S:'6', AP:'-1', D:'D3', kw:['PSYCHIC','LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Force weapon', who:'Scarab Occult Terminators', range:'Melee', A:'4', WS:'3+', S:'6', AP:'-1', D:'D3', kw:['PSYCHIC','LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } },
        { name:'Prosperine khopesh', who:'Scarab Occult Terminators', n:9, range:'Melee', A:'3', WS:'3+', S:'5', AP:'-2', D:'2', kw:['LETHAL HITS'], from:{ 'LETHAL HITS':'Empyric Guidance' } }
      ],
      abilities:[
        { name:'Marked by Fate', who:'Sorcerer in Terminator Armour', tag:'Psychic', ph:['shooting'], turn:'your', text:'At the start of your Shooting phase, select one enemy unit that is **visible** to this **PSYKER** model. Until the end of the phase, each time a model in this unit makes an attack that targets that enemy unit, add 1 to the **Hit roll**.' },
        { name:'Empyric Guidance', who:'Sorcerer in Terminator Armour', tag:'Psychic', text:'While this model is leading a unit, weapons equipped by models in that unit have the **[LETHAL HITS]** ability.' },
        { name:'Umbralefic Crystal', who:'Sorcerer in Terminator Armour', tag:'Enhancement', ph:['command','movement'], turn:'your', text:'**THOUSAND SONS** model only. (Once per battle, per army) In your Command phase, if this unit is **unengaged**, you can use this ability. If you do:\n- Place this unit in **strategic reserves**.\n- This unit has **Deep Strike** until the start of your next Shooting phase.\n- This unit must make an **ingress move** in your next Movement phase (including in your first turn).' },
        { name:'Rites of Coalescence', who:'Scarab Occult Terminators', def:'-1 to wound rolls against this unit while it contains a PSYKER model', defCalc:{ woundMinus:1 }, defAlways:true, calcNote:'counted for every attack, as if a PSYKER model stays in the unit', text:'While this unit contains one or more **PSYKER** models, each time an attack targets this unit, subtract 1 from the **Wound roll**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Your Shooting phase, vs the enemy unit picked at its start', note:'+1 to hit rolls', from:'Marked by Fate' }
      ],
      rules:['Leader','Deep Strike','Cabal of Sorcerers','Psychic','Anti','Devastating Wounds','Rapid Fire'],
      kw:['Chaos','Character','Faction: Thousand Sons','Infantry','Psyker','Sorcerer','Terminator','Tzeentch','Rubricae','Scarab Occult'],
      kwNote:'Rubricae, Scarab Occult come from the led Scarab Occult Terminators.'
    },
    {
      id:'tzaangors', name:'Tzaangors', role:'Infantry', pts:75,
      models:['1× Twistbray','7× Tzaangor w/ Tzaangor blades','1× Tzaangor w/ Tzaangor blades (Brayhorn)','1× Tzaangor w/ Tzaangor blades (Herd banner)'],
      gear:[['Tzaangor blades'],['Tzaangor blades'],['Tzaangor blades'],['Tzaangor blades']],
      stats:[
        { name:'Tzaangors', M:'6"', T:'4', Sv:'6+', W:'1', Ld:'7+', OC:'1', InSv:'6+', base:'32mm' }
      ],
      melee:[
        { name:'Tzaangor blades', n:10, range:'Melee', A:'2', WS:'4+', S:'5', AP:'0', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Ambushing Hunters', at:'End of your opponent’s turn', ph:['fight'], turn:'opp', text:'At the end of your opponent’s turn, if this unit is more than 6" horizontally away from all enemy units, you can remove this unit from the battlefield and place it into **Strategic Reserves**.' },
        { name:'Brayhorn', ph:['movement','charge'], turn:'either', turns:{ movement:'your' }, text:'You can re-roll **Advance** and **Charge rolls** made for the bearer’s unit.' },
        { name:'Herd banner', text:'While the bearer’s unit is within range of one or more objective markers you control, improve the Leadership characteristic of models in the bearer’s unit by 1.' }
      ],
      rules:['Scouts 6"'],
      kw:['Chaos','Faction: Thousand Sons','Infantry','Mutant','Tzaangors','Tzeentch']
    },
    {
      id:'tzaangor-enlightened', name:'Tzaangor Enlightened', role:'Mounted', pts:50, copies:2,
      models:['1× Aviarch','2× Divining spear Enlightened'],
      gear:[['Divining spear'],['Divining spear']],
      stats:[
        { name:'Tzaangor Enlightened', M:'10"', T:'4', Sv:'5+', W:'2', Ld:'7+', OC:'2', InSv:'5+', base:'40mm' }
      ],
      melee:[
        { name:'Divining spear', n:3, range:'Melee', A:'3', WS:'4+', S:'5', AP:'-1', D:'2', kw:['LANCE','PRECISION'] }
      ],
      abilities:[
        { name:'Prophesied Doom', ph:['charge'], turn:'either', text:'Each time this unit makes a Charge move, select one enemy unit within Engagement Range of it, then roll one D6 for each model in this unit that is within Engagement Range of that enemy unit: for each 4+, that enemy unit suffers 1 **mortal wound**.' }
      ],
      rules:['Lance','Precision'],
      kw:['Chaos','Faction: Thousand Sons','Fly','Mounted','Mutant','Tzaangor Enlightened','Tzeentch']
    },
    {
      id:'tzaangor-enlightened-with-fatecaster-greatbows', name:'Tzaangor Enlightened with Fatecaster greatbows', role:'Mounted', pts:55,
      models:['1× Aviarch','2× Enlightened'],
      gear:[['Close combat weapon','Fatecaster greatbow'],['Close combat weapon','Fatecaster greatbow']],
      stats:[
        { name:'Tzaangor Enlightened with Fatecaster greatbows', M:'10"', T:'4', Sv:'5+', W:'2', Ld:'7+', OC:'2', InSv:'5+', base:'40mm' }
      ],
      ranged:[
        { name:'Fatecaster greatbow', n:3, range:'30"', A:'2', BS:'4+', S:'5', AP:'-2', D:'2', kw:['IGNORES COVER','LETHAL HITS','PRECISION'] }
      ],
      melee:[
        { name:'Close combat weapon', n:3, range:'Melee', A:'2', WS:'4+', S:'4', AP:'0', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Malign Trickery', ph:['movement'], turn:'opp', text:'In your opponent\'s Movement phase, if an enemy unit ends a move within 8” of this unit, if this unit is not within **Engagement Range** of one or more enemy units, this unit can make a **Normal move** of up to D6”.' }
      ],
      rules:['Ignores Cover','Lethal Hits','Precision'],
      kw:['Chaos','Faction: Thousand Sons','Fly','Mounted','Mutant','Tzaangor Enlightened','Tzaangor Enlightened with Fatecaster Greatbows','Tzeentch']
    },
    {
      id:'defiler', name:'Defiler', role:'Vehicle', pts:330,
      models:['1× Defiler'],
      gear:[['Ectoplasma destructor','Heavy reaper autocannon','Heavy reaper autocannon','Shearing claws','Excruciator cannon','Excruciator cannon']],
      stats:[
        { name:'Defiler', M:'12"', T:'11', Sv:'3+', W:'18', Ld:'6+', OC:'5', InSv:'5+', base:'160mm' }
      ],
      ranged:[
        { name:'Ectoplasma destructor', range:'36"', A:'D6', BS:'3+', S:'12', AP:'-3', D:'3', kw:['BLAST'] },
        { name:'Excruciator cannon', n:2, range:'36"', A:'6', BS:'3+', S:'6', AP:'-2', D:'2', kw:[] },
        { name:'Heavy reaper autocannon', n:2, range:'48"', A:'4', BS:'3+', S:'9', AP:'-2', D:'3', kw:['DEVASTATING WOUNDS','SUSTAINED HITS 1'] }
      ],
      melee:[
        { group:'Shearing claws', name:'strike', range:'Melee', A:'5', WS:'3+', S:'16', AP:'-3', D:'D6+1', kw:[] },
        { group:'Shearing claws', name:'sweep', range:'Melee', A:'10', WS:'3+', S:'6', AP:'-2', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Scuttling Walker', ph:['movement','shooting'], turn:'your', text:'Each time this unit makes a **Normal**, **Advance** or **Fall Back move**, it can move through models (excluding **TITANIC** models) and **terrain features**. When doing so, it can move within **Engagement Range** of enemy models, but cannot end that move within Engagement Range of them, and any Desperate Escape test is automatically passed.' },
        // every source ends the text with a stray closing quote mark (’); the app leaves it out
        { name:'Destroyer of Futures', tag:'Once per phase, per unit', ph:['fight'], turn:'opp',
          text:'You can target this unit with the Counteroffensive stratagem, regardless of any other uses of that stratagem this phase. If you do:\n- That use is -1 CP.\n- That use does not prevent any uses of that stratagem on other units this phase.' },
        { name:'Damaged: 1-6 wounds remaining', damaged:'1-6', text:'While this model has 1-6 wounds remaining, each time this model makes an attack, subtract 1 from the **Hit roll**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Damaged (1-6 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-6 wounds remaining' }
      ],
      rules:['Deadly Demise D6','Blast','Sustained Hits','Devastating Wounds'],
      kw:['Chaos','Daemon','Defiler','Faction: Thousand Sons','Tzeentch','Vehicle','Walker']
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
      id:'the-swarmlord', name:'The Swarmlord', role:'Epic Hero', pts:210,
      models:['1× The Swarmlord'],
      gear:[['Bone Sabres','Synaptic Pulse']],
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
        { name:'Malign Presence', tag:'Aura', ph:['command','movement','shooting','charge','fight'], turn:'either', text:'Once per turn, when your opponent targets a unit from their army within 12" of this model with a **stratagem**, you can use this ability. If you do increase the CP cost of that use of that **stratagem** by 1CP.' },
        { name:'Domination of the Hive Mind', tag:'Aura', text:'While a friendly **TYRANIDS** unit is within 9" of this model, that unit is within your army’s **Synapse Range**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' }
      ],
      aura:[
        { kind:'all', needs:{ all:['Faction: Tyranids'] }, when:'Within 9" of the Swarmlord', note:'within your army’s Synapse Range', from:'Domination of the Hive Mind' }
      ],
      rules:['Deadly Demise D3','Shadow in the Warp','Synapse','Leader','Twin-linked','Torrent'],
      kw:['Character','Epic Hero','Faction: Tyranids','Great Devourer','Hive Tyrant','Monster','Psyker','Synapse','The Swarmlord']
    },
    {
      id:'hive-tyrant', name:'Hive Tyrant', role:'Character', pts:220, enhancement:'Monstrous Nemesis', warlord:true,
      models:['1× Hive Tyrant'],
      gear:[['Monstrous bonesword and lash whip','Monstrous scything talons']],
      stats:[
        { name:'Hive Tyrant', M:'8"', T:'10', Sv:'2+', W:'10', Ld:'7+', OC:'3', InSv:'4+', base:'50mm' }
      ],
      melee:[
        { name:'Monstrous bonesword and lash whip', range:'Melee', A:'6', WS:'2+', S:'9', AP:'-2', D:'3', kw:['TWIN-LINKED'] },
        { name:'Monstrous scything talons', range:'Melee', A:'4', WS:'2+', S:'7', AP:'-2', D:'2', kw:['EXTRA ATTACKS'] }
      ],
      abilities:[
        { name:'Onslaught', tag:'Aura, Psychic', ph:['movement','shooting'], turn:'either', turns:{ shooting:'your' }, text:'While a friendly **TYRANIDS** unit is within 6" of this model, ranged weapons equipped by models in that unit have the **[ASSAULT]** and **[LETHAL HITS]** abilities.' },
        { name:'Will of the Hive Mind', ph:['command','movement','shooting','charge','fight'], turn:'either', text:'Once per battle round, one model from your army with this ability can use it when a friendly **TYRANIDS** unit within 12" of that model is targeted with a Stratagem. If it does, reduce the CP cost of that use of that Stratagem by 1CP.' },
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
      rules:['Deadly Demise D3','Shadow in the Warp','Synapse','Leader','Twin-linked','Extra Attacks'],
      kw:['Character','Faction: Tyranids','Great Devourer','Hive Tyrant','Monster','Psyker','Synapse','Warlord']
    },
    {
      id:'neurogaunts', name:'Neurogaunts', role:'Infantry', pts:45, copies:2,
      models:['1× Neurogaunt Nodebeast','10× Neurogaunt'],
      gear:[['Chitinous claws and teeth'],['Chitinous claws and teeth']],
      stats:[
        { name:'Neurogaunt Nodebeast', M:'6"', T:'3', Sv:'6+', W:'1', Ld:'8+', OC:'1', InSv:'–', base:'28.5mm' },
        { name:'Neurogaunt ×10', M:'6"', T:'3', Sv:'6+', W:'1', Ld:'8+', OC:'1', InSv:'–', base:'25mm' }
      ],
      melee:[
        { name:'Chitinous claws and teeth', n:11, range:'Melee', A:'1', WS:'4+', S:'3', AP:'0', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Neurocytes', text:'While this unit is within **Synapse Range** of your friendly **TYRANIDS** unit (excluding **NEUROGAUNT** units), it has the **SYNAPSE** keyword.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' }
      ],
      rules:['Synapse'],
      kw:['Endless Multitude','Faction: Tyranids','Great Devourer','Infantry','Neurogaunts']
    },
    {
      id:'norn-assimilator-synaptoprescience', name:'Norn Assimilator', role:'Monster', pts:280, enhancement:'Synaptoprescience',
      models:['1× Norn Assimilator'],
      gear:[['Monstrous scything talons','Toxinjecter Harpoon']],
      stats:[
        { name:'Norn Assimilator', M:'10"', T:'11', Sv:'2+', W:'16', Ld:'7+', OC:'5', InSv:'4+', base:'100mm', from:{ InSv:'Synaptoprescience' } }
      ],
      ranged:[
        { name:'Toxinjecter Harpoon', range:'12"', A:'2', BS:'2+', S:'12', AP:'-3', D:'D6+1', kw:['HARPOONED'] }
      ],
      melee:[
        { name:'Monstrous scything talons', range:'Melee', A:'6', WS:'2+', S:'9', AP:'-2', D:'3', kw:[] },
        { name:'Toxinjecter Harpoon', range:'Melee', A:'4', WS:'2+', S:'12', AP:'-3', D:'D6+1', kw:['EXTRA ATTACKS'] }
      ],
      abilities:[
        { name:'Harpoon Barbs', ph:['movement'], turn:'opp', text:'Once per turn, when an enemy unit within Engagement Range of this unit is chosen to Fall Back, roll one D6; on a 2+, that unit suffers D6 mortal wounds.' },
        { name:'Damaged: 1-5 Wounds Remaining', damaged:'1-5', text:'While this model has 1-5 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' },
        { name:'Singular Purpose', tag:'Start of the first battle round', ph:['command','movement','shooting','charge','fight'], turn:'either', def:'If its Singular Purpose is an objective marker: Feel No Pain 5+ and OC 15 while within range of it', defCalc:{ fnp:5 },
          text:'At the start of the first battle round, select one of the following:\n- Select one enemy unit. Until the end of the battle, each time this model makes an attack that targets that unit you can re-roll the Hit roll and you can re-roll the Wound roll\n- Select one objective marker. Until the end of the battle, while this model is within range of that objective marker, it has the **Feel No Pain 5+** ability and an Objective Control characteristic of 15.' },
        { name:'Protean Purpose', tag:'Once per battle, per unit', ph:['command'], turn:'your', text:'(Once per battle, per unit) In your Command phase, you can use this ability. If you do, this unit can make a selection for its **Singular Purpose** ability (this replaces the previous selection).' },
        { name:'Synaptoprescience', tag:'Enhancement', text:'**NORN ASSIMILATOR** unit only. This unit has 4+ **InSv**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' },
        { kind:'all', when:'Damaged (1-5 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-5 Wounds Remaining' },
        { kind:'all', when:'If its Singular Purpose is an enemy unit, vs that unit', note:'re-roll hit rolls and wound rolls', from:'Singular Purpose', lasts:'battle' }
      ],
      rules:['Deadly Demise D6','Shadow in the Warp','Synapse','Harpooned','Extra Attacks'],
      kw:['Faction: Tyranids','Great Devourer','Harvester','Monster','Norn Assimilator','Synapse']
    },
    {
      id:'norn-assimilator-synaptoprescience-2', name:'Norn Assimilator', role:'Monster', pts:300, enhancement:'Synaptoprescience',
      models:['1× Norn Assimilator'],
      gear:[['Monstrous scything talons','Toxinjecter Harpoon']],
      stats:[
        { name:'Norn Assimilator', M:'10"', T:'11', Sv:'2+', W:'16', Ld:'7+', OC:'5', InSv:'4+', base:'100mm', from:{ InSv:'Synaptoprescience' } }
      ],
      ranged:[
        { name:'Toxinjecter Harpoon', range:'12"', A:'2', BS:'2+', S:'12', AP:'-3', D:'D6+1', kw:['HARPOONED'] }
      ],
      melee:[
        { name:'Monstrous scything talons', range:'Melee', A:'6', WS:'2+', S:'9', AP:'-2', D:'3', kw:[] },
        { name:'Toxinjecter Harpoon', range:'Melee', A:'4', WS:'2+', S:'12', AP:'-3', D:'D6+1', kw:['EXTRA ATTACKS'] }
      ],
      abilities:[
        { name:'Harpoon Barbs', ph:['movement'], turn:'opp', text:'Once per turn, when an enemy unit within Engagement Range of this unit is chosen to Fall Back, roll one D6; on a 2+, that unit suffers D6 mortal wounds.' },
        { name:'Damaged: 1-5 Wounds Remaining', damaged:'1-5', text:'While this model has 1-5 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' },
        { name:'Singular Purpose', tag:'Start of the first battle round', ph:['command','movement','shooting','charge','fight'], turn:'either', def:'If its Singular Purpose is an objective marker: Feel No Pain 5+ and OC 15 while within range of it', defCalc:{ fnp:5 },
          text:'At the start of the first battle round, select one of the following:\n- Select one enemy unit. Until the end of the battle, each time this model makes an attack that targets that unit you can re-roll the Hit roll and you can re-roll the Wound roll\n- Select one objective marker. Until the end of the battle, while this model is within range of that objective marker, it has the **Feel No Pain 5+** ability and an Objective Control characteristic of 15.' },
        { name:'Protean Purpose', tag:'Once per battle, per unit', ph:['command'], turn:'your', text:'(Once per battle, per unit) In your Command phase, you can use this ability. If you do, this unit can make a selection for its **Singular Purpose** ability (this replaces the previous selection).' },
        { name:'Synaptoprescience', tag:'Enhancement', text:'**NORN ASSIMILATOR** unit only. This unit has 4+ **InSv**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' },
        { kind:'all', when:'Damaged (1-5 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-5 Wounds Remaining' },
        { kind:'all', when:'If its Singular Purpose is an enemy unit, vs that unit', note:'re-roll hit rolls and wound rolls', from:'Singular Purpose', lasts:'battle' }
      ],
      rules:['Deadly Demise D6','Shadow in the Warp','Synapse','Harpooned','Extra Attacks'],
      kw:['Faction: Tyranids','Great Devourer','Harvester','Monster','Norn Assimilator','Synapse']
    },
    {
      id:'norn-emissary-destabilising-predation', name:'Norn Emissary', role:'Monster', pts:270, enhancement:'Destabilising Predation',
      models:['1× Norn Emissary'],
      gear:[['Monstrous rending claws','Monstrous scything talons','Psychic tendril']],
      stats:[
        { name:'Norn Emissary', M:'10"', T:'11', Sv:'2+', W:'16', Ld:'7+', OC:'5', InSv:'4+', base:'100mm' }
      ],
      ranged:[
        { group:'Psychic tendril', name:'neuroparasite', range:'18"', A:'2', BS:'2+', S:'8', AP:'-2', D:'D3', kw:['PRECISION','PSYCHIC','ANTI-CHARACTER 2+'], from:{ 'ANTI-CHARACTER 2+':'Destabilising Predation' } },
        { group:'Psychic tendril', name:'neurolance', range:'18"', A:'2', BS:'2+', S:'12', AP:'-3', D:'D6', kw:['MELTA 2','PSYCHIC','ANTI-CHARACTER 2+'], from:{ 'ANTI-CHARACTER 2+':'Destabilising Predation' } },
        { group:'Psychic tendril', name:'neuroblast', range:'18"', A:'2D6', BS:'2+', S:'6', AP:'-2', D:'1', kw:['BLAST','PSYCHIC','ANTI-CHARACTER 2+'], from:{ 'ANTI-CHARACTER 2+':'Destabilising Predation' } }
      ],
      melee:[
        { name:'Monstrous rending claws', range:'Melee', A:'4', WS:'2+', S:'7', AP:'-2', D:'2', kw:['EXTRA ATTACKS'] },
        { name:'Monstrous scything talons', range:'Melee', A:'6', WS:'2+', S:'9', AP:'-2', D:'3', kw:[] }
      ],
      abilities:[
        { name:'Singular Purpose', tag:'Start of the first battle round', ph:['command','movement','shooting','charge','fight'], turn:'either', def:'If its Singular Purpose is an objective marker: Feel No Pain 5+ and OC 15 while within range of it', defCalc:{ fnp:5 },
          text:'At the start of the first battle round, select one of the following:\n- Select one enemy unit. Until the end of the battle, each time this model makes an attack that targets that unit you can re-roll the Hit roll and you can re-roll the Wound roll\n- Select one objective marker. Until the end of the battle, while this model is within range of that objective marker, it has the **Feel No Pain 5+** ability and an Objective Control characteristic of 15.' },
        { name:'Damaged: 1-5 Wounds Remaining', damaged:'1-5', text:'While this model has 1-5 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' },
        { name:'Protean Purpose', tag:'Once per battle, per unit', ph:['command'], turn:'your', text:'(Once per battle, per unit) In your Command phase, you can use this ability. If you do, this unit can make a selection for its **Singular Purpose** ability (this replaces the previous selection).' },
        { name:'Destabilising Predation', tag:'Enhancement', text:'**NORN EMISSARY** unit only. This unit’s ranged attacks have **[ANTI-CHARACTER 2+]**.' },
        { name:'Unnatural Resistance', def:'Feel No Pain 4+ against mortal wounds', defAlways:true, text:'This model has the **Feel No Pain 4+** ability against Mortal Wounds.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' },
        { kind:'all', when:'Damaged (1-5 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-5 Wounds Remaining' },
        { kind:'all', when:'If its Singular Purpose is an enemy unit, vs that unit', note:'re-roll hit rolls and wound rolls', from:'Singular Purpose', lasts:'battle' }
      ],
      rules:['Deadly Demise D6','Shadow in the Warp','Synapse','Feel No Pain','Anti','Extra Attacks','Melta','Blast','Psychic'],
      kw:['Faction: Tyranids','Great Devourer','Monster','Norn Emissary','Psyker','Synapse']
    },
    {
      id:'norn-emissary', name:'Norn Emissary', role:'Monster', pts:270,
      models:['1× Norn Emissary'],
      gear:[['Monstrous rending claws','Monstrous scything talons','Psychic tendril']],
      stats:[
        { name:'Norn Emissary', M:'10"', T:'11', Sv:'2+', W:'16', Ld:'7+', OC:'5', InSv:'4+', base:'100mm' }
      ],
      ranged:[
        { group:'Psychic tendril', name:'neuroparasite', range:'18"', A:'2', BS:'2+', S:'8', AP:'-2', D:'D3', kw:['PRECISION','PSYCHIC'] },
        { group:'Psychic tendril', name:'neurolance', range:'18"', A:'2', BS:'2+', S:'12', AP:'-3', D:'D6', kw:['MELTA 2','PSYCHIC'] },
        { group:'Psychic tendril', name:'neuroblast', range:'18"', A:'2D6', BS:'2+', S:'6', AP:'-2', D:'1', kw:['BLAST','PSYCHIC'] }
      ],
      melee:[
        { name:'Monstrous rending claws', range:'Melee', A:'4', WS:'2+', S:'7', AP:'-2', D:'2', kw:['EXTRA ATTACKS'] },
        { name:'Monstrous scything talons', range:'Melee', A:'6', WS:'2+', S:'9', AP:'-2', D:'3', kw:[] }
      ],
      abilities:[
        { name:'Singular Purpose', tag:'Start of the first battle round', ph:['command','movement','shooting','charge','fight'], turn:'either', def:'If its Singular Purpose is an objective marker: Feel No Pain 5+ and OC 15 while within range of it', defCalc:{ fnp:5 },
          text:'At the start of the first battle round, select one of the following:\n- Select one enemy unit. Until the end of the battle, each time this model makes an attack that targets that unit you can re-roll the Hit roll and you can re-roll the Wound roll\n- Select one objective marker. Until the end of the battle, while this model is within range of that objective marker, it has the **Feel No Pain 5+** ability and an Objective Control characteristic of 15.' },
        { name:'Damaged: 1-5 Wounds Remaining', damaged:'1-5', text:'While this model has 1-5 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' },
        { name:'Protean Purpose', tag:'Once per battle, per unit', ph:['command'], turn:'your', text:'(Once per battle, per unit) In your Command phase, you can use this ability. If you do, this unit can make a selection for its **Singular Purpose** ability (this replaces the previous selection).' },
        { name:'Unnatural Resistance', def:'Feel No Pain 4+ against mortal wounds', defAlways:true, text:'This model has the **Feel No Pain 4+** ability against Mortal Wounds.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' },
        { kind:'all', when:'Damaged (1-5 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-5 Wounds Remaining' },
        { kind:'all', when:'If its Singular Purpose is an enemy unit, vs that unit', note:'re-roll hit rolls and wound rolls', from:'Singular Purpose', lasts:'battle' }
      ],
      rules:['Deadly Demise D6','Shadow in the Warp','Synapse','Feel No Pain','Extra Attacks','Melta','Blast','Psychic'],
      kw:['Faction: Tyranids','Great Devourer','Monster','Norn Emissary','Psyker','Synapse']
    },
    {
      id:'tyrannofex', name:'Tyrannofex', role:'Monster', pts:180, copies:2,
      models:['1× Tyrannofex'],
      gear:[['Powerful limbs','Stinger salvoes','Acid spray']],
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
        { name:'Resilient Organism', tag:'Once per battle', def:'Once per battle: change the Damage of an attack allocated to it to 0', text:'Once per battle, when an attack is allocated to this model, you can change the Damage characteristic of that attack to 0.' },
        { name:'Damaged: 1-5 Wounds Remaining', damaged:'1-5', text:'While this model has 1-5 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' },
        { kind:'all', when:'Damaged (1-5 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-5 Wounds Remaining' }
      ],
      rules:['Deadly Demise D6','Synapse','Torrent'],
      kw:['Faction: Tyranids','Great Devourer','Monster','Tyrannofex']
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
      id:'knight-destrier', name:'Knight Destrier', role:'Character', pts:265, copies:2,
      models:['1× Knight Destrier'],
      gear:[['Questoris heavy stubber','Titanic feet','Chastiser gatling cannon','Frag bombard']],
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
        // this list's Destriers have Titanic feet, not a thundershock spear and bellatus reaper chainsword, so it does not apply
        { name:'Thundercharge', na:'Needs a thundershock spear and bellatus reaper chainsword: not this loadout', text:'If this model is equipped with a thundershock spear and a bellatus reaper chainsword, add 2 to the Attacks characteristic of melee weapons equipped by this model.' },
        { name:'Ram Jets', ph:['movement'], turn:'your', text:'Each time this unit is selected to make a **Normal** or **Advance move**, until the end of the phase, add D3" to the Move characteristic of this model.' },
        { name:'Saturation Fire', ph:['shooting'], turn:'your', text:'Each time this model makes a ranged attack that targets a unit within range of one or more objective markers, that attack has the **[IGNORES COVER]** ability.' },
        { name:'Invulnerable Save (5+*)', def:'5+ invulnerable save against ranged attacks only', text:'This model has a 5+ invulnerable save against ranged attacks.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target within range of an objective marker', cond:'targetObjective', note:'ranged attacks have [IGNORES COVER]', from:'Saturation Fire' },
        { kind:'all', when:'Damaged (1-6 wounds left)', note:'-1 to hit rolls (and -4 OC)', from:'Damaged: 1-6 Wounds Remaining' }
      ],
      rules:['Deadly Demise D6','Super-Heavy Walker','Code Chivalric','Assault','Rapid Fire','Blast'],
      kw:['Bellatus','Character','Faction: Imperial Knights','Imperium','Knight Destrier','Titanic','Towering','Vehicle','Walker']
    },
    {
      id:'knight-errant', name:'Knight Errant', role:'Character', pts:355,
      models:['1× Knight Errant'],
      gear:[['Thermal cannon','Stormspear rocket pod','Meltagun','Reaper chainsword']],
      stats:[
        { name:'Knight Errant', M:'10"', T:'11', Sv:'3+', W:'26', Ld:'6+', OC:'10', InSv:'5+*', base:'170×109mm' }
      ],
      ranged:[
        { name:'Thermal cannon', range:'24"', A:'2D3', BS:'3+', S:'12', AP:'-4', D:'D6', kw:['BLAST','MELTA 6'] },
        { name:'Stormspear rocket pod', range:'48"', A:'3', BS:'3+', S:'8', AP:'-2', D:'D6', kw:[] },
        { name:'Meltagun', range:'12"', A:'1', BS:'3+', S:'9', AP:'-4', D:'D6', kw:['MELTA 2'] }
      ],
      melee:[
        { group:'Reaper chainsword', name:'strike', range:'Melee', A:'4', WS:'3+', S:'14', AP:'-4', D:'6', kw:[] },
        { group:'Reaper chainsword', name:'sweep', range:'Melee', A:'12', WS:'3+', S:'9', AP:'-3', D:'2', kw:[] }
      ],
      abilities:[
        { name:'Aggressive Assault', ph:['shooting'], turn:'your', text:'Each time this model makes a ranged attack that targets the closest eligible target, add 1 to the **Hit roll**.' },
        { name:'Invulnerable Save (5+*)', def:'5+ invulnerable save against ranged attacks only', text:'This model has a 5+ invulnerable save against ranged attacks.' },
        { name:'Damaged: 1-9 Wounds Remaining', damaged:'1-9', text:'While this model has 1‑9 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the **Hit roll**.' },
        { name:'Errant’s Duty', tag:'Bondsman', text:'While a model is affected by this ability, you can re-roll **Advance rolls** made for that model and ranged weapons equipped by that model have the **[ASSAULT]** ability.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target is the closest eligible target', cond:'closest', note:'+1 to hit rolls', from:'Aggressive Assault' },
        { kind:'all', when:'Damaged (1-9 wounds left)', note:'-1 to hit rolls (and -5 OC)', from:'Damaged: 1-9 Wounds Remaining' }
      ],
      aura:[
        { kind:'ranged', needs:{ all:['Armiger'] }, when:'Affected by Errant’s Duty (Bondsman)', note:'ranged weapons have [ASSAULT]', from:'Errant’s Duty' }
      ],
      // New Recruit's Rules line also has Assault, named only by Errant’s Duty, which affects an ARMIGER model (deviations-nr.json)
      rules:['Deadly Demise D6','Super-Heavy Walker','Code Chivalric','Bondsman','Melta','Blast'],
      kw:['Character','Faction: Imperial Knights','Imperium','Knight Errant','Questoris','Titanic','Towering','Vehicle','Walker']
    },
    {
      id:'knight-paladin', name:'Knight Paladin', role:'Character', pts:375, copies:2,
      models:['1× Knight Paladin'],
      gear:[['Questoris heavy stubber','Rapid-fire battle cannon','Stormspear rocket pod','Meltagun','Reaper chainsword']],
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
        { group:'Reaper chainsword', name:'strike', range:'Melee', A:'4', WS:'3+', S:'14', AP:'-4', D:'6', kw:[] },
        { group:'Reaper chainsword', name:'sweep', range:'Melee', A:'12', WS:'3+', S:'9', AP:'-3', D:'2', kw:[] }
      ],
      abilities:[
        { name:'Seasoned Noble', ph:['shooting'], turn:'your', text:'Each time this model makes a ranged attack that targets the closest eligible target, improve the Armour Penetration characteristic of that attack by 1.' },
        { name:'Invulnerable Save (5+*)', def:'5+ invulnerable save against ranged attacks only', text:'This model has a 5+ invulnerable save against ranged attacks.' },
        { name:'Damaged: 1-9 Wounds Remaining', damaged:'1-9', text:'While this model has 1‑9 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the **Hit roll**.' },
        { name:'Paladin’s Duty', tag:'Bondsman', text:'While a model is affected by this ability, weapons equipped by that model have the **[LETHAL HITS]** ability, and melee weapons equipped by that model have the **[LANCE]** ability.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target is the closest eligible target', cond:'closest', note:'improve AP by 1', from:'Seasoned Noble' },
        { kind:'all', when:'Damaged (1-9 wounds left)', note:'-1 to hit rolls (and -5 OC)', from:'Damaged: 1-9 Wounds Remaining' }
      ],
      aura:[
        { kind:'all', needs:{ all:['Armiger'] }, when:'Affected by Paladin’s Duty (Bondsman)', note:'weapons have [LETHAL HITS]', from:'Paladin’s Duty' },
        { kind:'melee', needs:{ all:['Armiger'] }, when:'Affected by Paladin’s Duty (Bondsman)', note:'melee weapons have [LANCE]', from:'Paladin’s Duty' }
      ],
      // New Recruit's Rules line also has Lethal Hits and Lance, named only by Paladin’s Duty, which affects an ARMIGER model (deviations-nr.json)
      rules:['Deadly Demise D6','Super-Heavy Walker','Code Chivalric','Bondsman','Rapid Fire','Blast','Melta'],
      kw:['Character','Faction: Imperial Knights','Imperium','Knight Paladin','Questoris','Titanic','Towering','Vehicle','Walker']
    },
    {
      id:'knight-warden', name:'Knight Warden', role:'Character', pts:365, warlord:true,
      models:['1× Knight Warden'],
      gear:[['Avenger gatling cannon','Heavy flamer','Stormspear rocket pod','Meltagun','Reaper chainsword']],
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
        { group:'Reaper chainsword', name:'strike', range:'Melee', A:'4', WS:'3+', S:'14', AP:'-4', D:'6', kw:[] },
        { group:'Reaper chainsword', name:'sweep', range:'Melee', A:'12', WS:'3+', S:'9', AP:'-3', D:'2', kw:[] }
      ],
      abilities:[
        { name:'Thin Their Ranks', ph:['shooting'], turn:'your', text:'Each time this model makes a ranged attack that targets an enemy unit (excluding **MONSTERS** and **VEHICLES**), that attack has the **[DEVASTATING WOUNDS]** ability.' },
        { name:'Invulnerable Save (5+*)', def:'5+ invulnerable save against ranged attacks only', text:'This model has a 5+ invulnerable save against ranged attacks.' },
        { name:'Damaged: 1-9 Wounds Remaining', damaged:'1-9', text:'While this model has 1‑9 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the **Hit roll**.' },
        { name:'Warden’s Duty', tag:'Bondsman', text:'While a model is affected by this ability, weapons equipped by that model have the **[SUSTAINED HITS 1]** ability, and ranged weapons equipped by that model have the **[IGNORES COVER]** ability.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'vs non-MONSTER/VEHICLE targets', note:'ranged attacks have [DEVASTATING WOUNDS]', from:'Thin Their Ranks', always:true, vs:{ none:['Monster','Vehicle'] } },
        { kind:'all', when:'Damaged (1-9 wounds left)', note:'-1 to hit rolls (and -5 OC)', from:'Damaged: 1-9 Wounds Remaining' }
      ],
      aura:[
        { kind:'all', needs:{ all:['Armiger'] }, when:'Affected by Warden’s Duty (Bondsman)', note:'weapons have [SUSTAINED HITS 1]', from:'Warden’s Duty' },
        { kind:'ranged', needs:{ all:['Armiger'] }, when:'Affected by Warden’s Duty (Bondsman)', note:'ranged weapons have [IGNORES COVER]', from:'Warden’s Duty' }
      ],
      // New Recruit's Rules line also has Sustained Hits, named only by Warden’s Duty, which affects an ARMIGER model (deviations-nr.json)
      rules:['Deadly Demise D6','Super-Heavy Walker','Code Chivalric','Devastating Wounds','Bondsman','Ignores Cover','Torrent','Melta'],
      kw:['Character','Faction: Imperial Knights','Imperium','Knight Warden','Questoris','Titanic','Towering','Vehicle','Walker','Warlord']
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
      id:'canis-rex', name:'Canis Rex', role:'Epic Hero', pts:415,
      models:['1× Canis Rex','1× Sir Hekhtur'],
      gear:[['Freedom’s Hand','Las-impulsor','Questoris multi-laser'],['Close combat weapon','Hekhtur’s pistol']],
      stats:[
        { name:'Canis Rex', M:'10"', T:'11', Sv:'3+', W:'26', Ld:'6+', OC:'10', InSv:'5+*', base:'170×109mm' },
        { name:'Sir Hekhtur', M:'6"', T:'3', Sv:'4+', W:'3', Ld:'5+', OC:'1', InSv:'–', base:'170×109mm' }
      ],
      ranged:[
        { group:'Las-impulsor', name:'high intensity', range:'24"', A:'D6', BS:'2+', S:'14', AP:'-3', D:'4', kw:['BLAST','SUSTAINED HITS 1'] },
        { group:'Las-impulsor', name:'low intensity', range:'36"', A:'2D6', BS:'2+', S:'7', AP:'-1', D:'2', kw:['BLAST','SUSTAINED HITS 1'] },
        { name:'Questoris multi-laser', range:'36"', A:'4', BS:'2+', S:'6', AP:'0', D:'1', kw:['SUSTAINED HITS 1'] },
        { name:'Hekhtur’s pistol', range:'12"', A:'1', BS:'2+', S:'5', AP:'-1', D:'2', kw:['PISTOL'] }
      ],
      melee:[
        { group:'Freedom’s Hand', name:'strike', range:'Melee', A:'5', WS:'2+', S:'20', AP:'-3', D:'9', kw:['SUSTAINED HITS 1'] },
        { group:'Freedom’s Hand', name:'sweep', range:'Melee', A:'10', WS:'2+', S:'10', AP:'-2', D:'3', kw:['SUSTAINED HITS 1'] },
        { name:'Close combat weapon', range:'Melee', A:'2', WS:'2+', S:'3', AP:'0', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Chainbreaker', ph:['command','movement','shooting','charge','fight'], turn:'either', text:'Once per battle, at the start of any phase, you can select one friendly **IMPERIUM** unit that is **Battle-shocked** and within 12" of this model. That unit is no longer Battle-shocked.' },
        { name:'Legendary Freeblade', ph:['command','movement','shooting','charge','fight'], turn:'either', text:'Once per turn, when you target this model with a stratagem, you may reduce the CP cost of that use of that stratagem by 1CP.' },
        { name:'Invulnerable Save (5+*)', def:'5+ invulnerable save against ranged attacks only', text:'This model has a 5+ invulnerable save against ranged attacks.' },
        { name:'Damaged: 1-9 Wounds Remaining', damaged:'1-9', text:'While this model has 1‑9 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the **Hit roll**.' },
        { name:'Using Sir Hekhtur', text:'If your Canis Rex model is destroyed, this model is treated as a model disembarking from a destroyed Transport and must perform an Emergency Disembarkation. Sir Hekhtur cannot be selected as the target of any of your Stratagems other than Core Stratagems. Your Canis Rex unit is not considered to be destroyed until Sir Hekhtur is also destroyed.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Damaged (1-9 wounds left)', note:'-1 to hit rolls (and -5 OC)', from:'Damaged: 1-9 Wounds Remaining' }
      ],
      rules:['Deadly Demise D6','Sustained Hits','Super-Heavy Walker','Blast','Code Chivalric','Lone Operative'],
      kw:['Canis Rex','Character','Epic Hero','Faction: Imperial Knights','Imperium','Infantry','Questoris','Sir Hekhtur','Titanic','Towering','Vehicle','Walker']
    },
    {
      id:'cerastus-knight-atrapos', name:'Cerastus Knight Atrapos', role:'Character', pts:450, enhancement:'Bringer of Justice',
      models:['1× Cerastus Knight Atrapos'],
      gear:[['Atrapos lascutter','Graviton singularity cannon']],
      stats:[
        { name:'Cerastus Knight Atrapos', M:'12"', T:'11', Sv:'3+', W:'28', Ld:'6+', OC:'10', InSv:'5+', base:'170×109mm' }
      ],
      ranged:[
        { group:'Atrapos lascutter', name:'high intensity', range:'24"', A:'D6', BS:'3+', S:'14', AP:'-3', D:'4', kw:['SUSTAINED HITS 1'] },
        { group:'Atrapos lascutter', name:'low intensity', range:'36"', A:'2D6', BS:'3+', S:'7', AP:'-1', D:'2', kw:['SUSTAINED HITS 1'] },
        { group:'Graviton singularity cannon', name:'singularity', range:'24"', A:'D3', BS:'3+', S:'16', AP:'-4', D:'D6+1', kw:['BLAST','DEVASTATING WOUNDS','HAZARDOUS'] },
        { group:'Graviton singularity cannon', name:'contained', range:'24"', A:'D3', BS:'3+', S:'16', AP:'-4', D:'D6+1', kw:['BLAST'] }
      ],
      melee:[
        { group:'Atrapos lascutter', name:'high intensity', range:'Melee', A:'8', WS:'3+', S:'14', AP:'-3', D:'4', kw:['SUSTAINED HITS 1'], from:{ A:'Bringer of Justice' } },
        { group:'Atrapos lascutter', name:'low intensity', range:'Melee', A:'14', WS:'3+', S:'7', AP:'-1', D:'2', kw:['SUSTAINED HITS 1'], from:{ A:'Bringer of Justice' } }
      ],
      abilities:[
        { name:'Macro-extinction Protocols', text:'Each time this model makes an attack that targets a MONSTER or VEHICLE unit, add 1 to the Hit roll. If that target is TITANIC or TOWERING, add 1 to the Wound roll as well.' },
        { name:'Damaged: 1-10 Wounds Remaining', damaged:'1-10', text:'While this model has 1-10 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the Hit roll.' },
        { name:'Bringer of Justice', tag:'Enhancement', text:'**IMPERIAL KNIGHTS** model only. Improve the Attacks characteristic of melee weapons equipped by the bearer by 2, and each time the bearer makes a melee attack, add 1 to the **Hit roll**.' },
        { name:'Atrapos’ Duty', tag:'Bondsman', text:'While a model is affected by this ability, each time that model makes an attack that targets a TITANIC or TOWERING model, you can re-roll the Hit roll and you can re-roll the Wound roll.' }
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
      ],
      rules:['Code Chivalric','Deadly Demise D6+2','Super-Heavy Walker','Bondsman','Sustained Hits','Blast','Devastating Wounds','Hazardous'],
      kw:['Cerastus','Character','Faction: Imperial Knights','Imperium','Knight Atrapos','Titanic','Towering','Vehicle','Walker']
    },
    {
      id:'cerastus-knight-lancer', name:'Cerastus Knight Lancer', role:'Character', pts:415,
      models:['1× Cerastus Knight Lancer'],
      gear:[['Cerastus shock lance']],
      stats:[
        { name:'Cerastus Knight Lancer', M:'14"', T:'11', Sv:'3+', W:'28', Ld:'6+', OC:'10', InSv:'4+', base:'170×109mm' }
      ],
      ranged:[
        { name:'Cerastus shock lance', range:'12"', A:'6', BS:'3+', S:'6', AP:'0', D:'2', kw:['ASSAULT','SUSTAINED HITS 2'] }
      ],
      melee:[
        { group:'Cerastus shock lance', name:'strike', range:'Melee', A:'5', WS:'2+', S:'20', AP:'-3', D:'8', kw:['LANCE'] },
        { group:'Cerastus shock lance', name:'sweep', range:'Melee', A:'10', WS:'2+', S:'10', AP:'-2', D:'3', kw:[] }
      ],
      abilities:[
        { name:'Shock Charge', text:'You can target this model with the Tank Shock Stratagem for 0CP, and can do so even if you have already targeted a different unit with that Stratagem this phase.' },
        { name:'Damaged: 1-10 Wounds Remaining', damaged:'1-10', text:'While this model has 1-10 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the Hit roll.' },
        { name:'Lancer’s Duty', tag:'Bondsman', text:'While a model is affected by this ability, it is eligible to declare a charge in a turn in which it Advanced.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Damaged (1-10 wounds left)', note:'-1 to hit rolls (and -5 OC)', from:'Damaged: 1-10 Wounds Remaining' }
      ],
      rules:['Deadly Demise D6+2','Code Chivalric','Super-Heavy Walker','Bondsman','Sustained Hits','Assault','Lance'],
      kw:['Cerastus','Character','Faction: Imperial Knights','Imperium','Knight Lancer','Titanic','Towering','Vehicle','Walker']
    },
    {
      id:'knight-crusader', name:'Knight Crusader', role:'Character', pts:435, enhancement:'Hunter’s Eye',
      models:['1× Knight Crusader'],
      gear:[['Avenger gatling cannon','Heavy flamer','Titanic feet','Stormspear rocket pod','Meltagun','Questoris heavy stubber','Rapid-fire battle cannon']],
      stats:[
        { name:'Knight Crusader', M:'10"', T:'11', Sv:'3+', W:'26', Ld:'6+', OC:'10', InSv:'5+*', base:'170×109mm' }
      ],
      ranged:[
        { name:'Avenger gatling cannon', range:'36"', A:'18', BS:'3+', S:'6', AP:'-2', D:'2', kw:['IGNORES COVER'], from:{ 'IGNORES COVER':'Hunter’s Eye' } },
        { name:'Heavy flamer', range:'12"', A:'D6', BS:'–', S:'5', AP:'-1', D:'1', kw:['IGNORES COVER','TORRENT','IGNORES COVER'], from:{ 'IGNORES COVER':'Hunter’s Eye' } },
        { name:'Stormspear rocket pod', range:'48"', A:'3', BS:'3+', S:'8', AP:'-2', D:'D6', kw:['IGNORES COVER'], from:{ 'IGNORES COVER':'Hunter’s Eye' } },
        { name:'Meltagun', range:'12"', A:'1', BS:'3+', S:'9', AP:'-4', D:'D6', kw:['MELTA 2','IGNORES COVER'], from:{ 'IGNORES COVER':'Hunter’s Eye' } },
        { name:'Questoris heavy stubber', range:'36"', A:'3', BS:'3+', S:'4', AP:'-1', D:'1', kw:['RAPID FIRE 3','IGNORES COVER'], from:{ 'IGNORES COVER':'Hunter’s Eye' } },
        { name:'Rapid-fire battle cannon', range:'72"', A:'D6+3', BS:'3+', S:'10', AP:'-1', D:'3', kw:['BLAST','RAPID FIRE D6+3','IGNORES COVER'], from:{ 'IGNORES COVER':'Hunter’s Eye' } }
      ],
      melee:[
        { name:'Titanic feet', range:'Melee', A:'4', WS:'4+', S:'8', AP:'-1', D:'2', kw:[] }
      ],
      abilities:[
        { name:'Punishing Salvoes', ph:['movement','shooting'], turn:'your', text:'In your Movement phase, if this model Remains Stationary, until the end of the turn, ranged weapons equipped by this model have the [SUSTAINED HITS 1] ability.' },
        { name:'Invulnerable Save (5+*)', def:'5+ invulnerable save against ranged attacks only', text:'This model has a 5+ invulnerable save against ranged attacks.' },
        { name:'Damaged: 1-9 Wounds Remaining', damaged:'1-9', text:'While this model has 1‑9 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the **Hit roll**.' },
        { name:'Hunter’s Eye', tag:'Enhancement', text:'**IMPERIAL KNIGHTS** model only. Ranged weapons equipped by the bearer have the **[IGNORES COVER]** ability.' },
        { name:'Crusader’s Duty', tag:'Bondsman', text:'While a model is affected by this ability, each time that model makes a ranged attack, add 1 to the Hit roll.' }
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
      kw:['Character','Faction: Imperial Knights','Imperium','Knight Crusader','Questoris','Titanic','Towering','Vehicle','Walker']
    },
    {
      id:'knight-destrier', name:'Knight Destrier', role:'Character', pts:285, enhancement:'Sanctuary',
      models:['1× Knight Destrier'],
      gear:[['Questoris heavy stubber','Titanic feet','Chastiser gatling cannon','Frag bombard']],
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
        // this list's Destrier has Titanic feet, not a thundershock spear and bellatus reaper chainsword, so it does not apply
        { name:'Thundercharge', na:'Needs a thundershock spear and bellatus reaper chainsword: not this loadout', text:'If this model is equipped with a thundershock spear and a bellatus reaper chainsword, add 2 to the Attacks characteristic of melee weapons equipped by this model.' },
        { name:'Ram Jets', ph:['movement'], turn:'your', text:'Each time this unit is selected to make a **Normal** or **Advance move**, until the end of the phase, add D3" to the Move characteristic of this model.' },
        { name:'Saturation Fire', ph:['shooting'], turn:'your', text:'Each time this model makes a ranged attack that targets a unit within range of one or more objective markers, that attack has the **[IGNORES COVER]** ability.' },
        { name:'Invulnerable Save (5+*)', def:'5+ invulnerable save against ranged attacks only', text:'This model has a 5+ invulnerable save against ranged attacks.' },
        { name:'Sanctuary', tag:'Enhancement', def:'Sanctuary: 5+ invulnerable save', defAlways:true, defCalc:{ insv:5 }, text:'**IMPERIAL KNIGHTS** model only. The bearer has a 5+ invulnerable save.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target within range of an objective marker', cond:'targetObjective', note:'ranged attacks have [IGNORES COVER]', from:'Saturation Fire' },
        { kind:'all', when:'Damaged (1-6 wounds left)', note:'-1 to hit rolls (and -4 OC)', from:'Damaged: 1-6 Wounds Remaining' }
      ],
      rules:['Deadly Demise D6','Super-Heavy Walker','Code Chivalric','Assault','Rapid Fire','Blast'],
      kw:['Bellatus','Character','Faction: Imperial Knights','Imperium','Knight Destrier','Titanic','Towering','Vehicle','Walker']
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
      id:'ghazghkull-thraka', name:'Ghazghkull Thraka', role:'Epic Hero', pts:290, warlord:true,
      models:['1× Ghazghkull Thraka'],
      gear:[['Adamantine ’Eadbutt','Gork’s Klaw','Mork’s Roar']],
      stats:[
        { name:'Ghazghkull Thraka', M:'8"', T:'10', Sv:'2+', W:'16', Ld:'6+', OC:'4', InSv:'4+', base:'80mm' }
      ],
      ranged:[
        { group:'Mork’s Roar', name:'Point Blank', range:'9"', A:'2D6+2', BS:'–', S:'6', AP:'-1', D:'1', kw:['CLOSE-QUARTERS','TORRENT','ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } },
        { group:'Mork’s Roar', name:'Aimed', range:'36"', A:'12', BS:'5+', S:'6', AP:'-1', D:'1', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 4','ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } }
      ],
      melee:[
        { name:'Adamantine ’Eadbutt', range:'Melee', A:'1', WS:'2+', S:'14', AP:'-2', D:'D3+3', kw:['DEVASTATING WOUNDS','EXTRA ATTACKS','PRECISION'] },
        { name:'Gork’s Klaw', range:'Melee', A:'7', WS:'2+', S:'14', AP:'-3', D:'4', kw:['CLEAVE 2','DEVASTATING WOUNDS'] }
      ],
      abilities:[
        { name:'Supreme Commander', text:'If this model is in your army, it must be your **WARLORD**.' },
        { name:'Makari, Hoist Dat Banner!', tag:'Once per battle, per army', ph:['movement'], turn:'your', text:'In your Movement phase, you can select a number of friendly **ORKS** units equal to or less than the current battle round number. Those units are **riled up** until the start of your next turn.\n*Place one Makari token next to the unit, removing it after this ability is used.*' },
        { name:'Da Grand Warlord’s Ladz', def:'Lone Operative while within 3" of another friendly ORKS INFANTRY unit', text:'While this unit is within 3" of another friendly **ORKS INFANTRY** unit, this unit has **Lone Operative**.' },
        { name:'Prophet of Da Great Waaagh!', tag:'Aura', ph:['fight'], turn:'either', text:'While a friendly **ORKS** unit is within 6" of this unit, that unit’s melee attacks have:\n- +1 to **hit rolls**.\n- +1 to **wound rolls**.' }
      ],
      aura:[
        { kind:'melee', needs:{ all:['Faction: Orks'] }, when:'Within 6" of Ghazghkull', selfWhen:'Own aura', note:'+1 to hit, +1 to wound', from:'Prophet of Da Great Waaagh!', selfAlways:true }
      ],
      rules:['Waaagh!','Da Boss'],
      kw:['Character','Epic Hero','Explosives','Faction: Orks','Ghazghkull Thraka','Infantry','Warboss','Warlord']
    },
    {
      id:'nazdreg-meganobz', name:'Nazdreg', role:'Epic Hero', pts:365, ptsNote:'165 + Meganobz 200',
      leads:'Meganobz',
      models:['1× Nazdreg','5× Meganob w/ Twin Killsaw'],
      gear:[['Kustom Blasta X','Moonchewa'],['Twin Killsaw']],
      stats:[
        { name:'Nazdreg', M:'5"', T:'7', Sv:'2+', W:'8', Ld:'6+', OC:'1', InSv:'5+', base:'60mm' },
        { name:'Meganob ×5', M:'5"', T:'6', Sv:'2+', W:'3', Ld:'7+', OC:'1', InSv:'–', base:'40mm' }
      ],
      ranged:[
        { group:'Kustom Blasta X', fireAll:true, who:'Nazdreg', name:'Skorcha', range:'12"', A:'3', BS:'–', S:'5', AP:'-1', D:'1', kw:['BLAST 1','TORRENT','IGNORES COVER','ASSAULT'], from:{ 'IGNORES COVER':'Nazdreg’s Know-wotz', ASSAULT:'Dakka! Dakka! Dakka!' } },
        { group:'Kustom Blasta X', fireAll:true, who:'Nazdreg', name:'Gatler', range:'24"', A:'6', BS:'4+', S:'9', AP:'-2', D:'3', kw:['HAZARDOUS','IGNORES COVER','ASSAULT'], from:{ 'IGNORES COVER':'Nazdreg’s Know-wotz', ASSAULT:'Dakka! Dakka! Dakka!' } },
        { group:'Kustom Blasta X', fireAll:true, who:'Nazdreg', name:'Shoota', range:'18"', A:'4', BS:'4+', S:'5', AP:'-1', D:'1', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 2','IGNORES COVER','ASSAULT'], from:{ 'IGNORES COVER':'Nazdreg’s Know-wotz', ASSAULT:'Dakka! Dakka! Dakka!' } }
      ],
      melee:[
        { name:'Kustom Blasta X', who:'Nazdreg', range:'Melee', A:'6', WS:'2+', S:'5', AP:'-1', D:'1', kw:['CLEAVE 1','EXTRA ATTACKS','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Displays of Savagery' } },
        { name:'Moonchewa', who:'Nazdreg', range:'Melee', A:'5', WS:'2+', S:'12', AP:'-2', D:'3', kw:['CLEAVE 1','TWIN-LINKED','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Displays of Savagery' } },
        { name:'Twin Killsaw', who:'Meganobz', n:5, range:'Melee', A:'3', WS:'4+', S:'10', AP:'-2', D:'3', kw:['TWIN-LINKED','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Displays of Savagery' } }
      ],
      abilities:[
        { name:'Nazdreg’s Know-wotz', who:'Nazdreg', text:'- This unit has **Deep Strike**.\n- This unit’s ranged attacks have **[IGNORES COVER]**.' },
        { name:'Supreme Kunnin’', who:'Nazdreg', tag:'Once per phase, per army', ph:['movement'], turn:'opp', text:'In your opponent’s Movement phase, when an enemy unit ends a move within 8" of this unit, if this unit is **unengaged**, this unit can:\n- Make a **normal move** of up to D6".\n- Or: If this unit is **riled up**, make a **normal move** of up to 5".' },
        { name:'Intimidating Motivation', who:'Nazdreg', tag:'Once per battle round, per army', ph:['movement'], turn:'your', text:'In your Movement phase, at the start or end of this unit’s move, you can select one friendly **ORKS** unit within 6" of this unit. That unit:\n- Is no longer **battle-shocked**.\n- Is **riled up** until the start of your next turn.' },
        { name:'Krumpin’ Time', who:'Meganobz', ph:['fight'], turn:'either', text:'In the Fight phase, if this unit is **riled up**, this unit has +1 to **hit rolls**.' },
        { name:'Arrogant Invulnerability', who:'Meganobz', def:'Attacks that target this unit have -1 AP', defAlways:true, text:'Attacks that target this unit have -1 **AP**.' }
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
      id:'zodgrod-wortsnagga-runtherd-gretchin', name:'Zodgrod Wortsnagga', role:'Epic Hero', pts:150, ptsNote:'50 + Runtherd 10 + Gretchin 90', upgrade:'Extra Sneaky',
      leads:'Gretchin', also:[{ name:'Runtherd', support:true }],
      models:['1× Zodgrod Wortsnagga','1× Runtherd','20× Gretchin'],
      gear:[['Da Grabzappa','Squigstoppa'],['Runtherd’s Toolz','Slugga'],['Grot Blasta','Scavenged Shivs']],
      stats:[
        { name:'Zodgrod Wortsnagga', M:'6"', T:'5', Sv:'5+', W:'5', Ld:'7+', OC:'1', InSv:'6+', base:'50mm' },
        { name:'Runtherd', M:'6"', T:'5', Sv:'5+', W:'3', Ld:'7+', OC:'1', InSv:'–', base:'32mm' },
        { name:'Gretchin ×20', M:'6"', T:'2', Sv:'6+', W:'1', Ld:'8+', OC:'1', InSv:'–', base:'25mm' }
      ],
      ranged:[
        { name:'Squigstoppa', who:'Zodgrod Wortsnagga', range:'12"', A:'1', BS:'5+', S:'4', AP:'-1', D:'1', kw:['ANTI-MONSTER/VEHICLE 4+','CLOSE-QUARTERS','DEVASTATING WOUNDS: MONSTER/VEHICLE','ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } },
        { name:'Slugga', who:'Runtherd', range:'12"', A:'1', BS:'5+', S:'4', AP:'0', D:'1', kw:['CLOSE-QUARTERS','LETHAL HITS: non-MONSTER/VEHICLE','ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } },
        { name:'Grot Blasta', who:'Gretchin', n:20, range:'12"', A:'1', BS:'4+', S:'3', AP:'0', D:'1', kw:['CLOSE-QUARTERS','ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } }
      ],
      melee:[
        { name:'Da Grabzappa', who:'Zodgrod Wortsnagga', range:'Melee', A:'5', WS:'2+', S:'7', AP:'-2', D:'2', kw:[] },
        { name:'Runtherd’s Toolz', who:'Runtherd', range:'Melee', A:'3', WS:'3+', S:'5', AP:'0', D:'1', kw:[] },
        { name:'Scavenged Shivs', who:'Gretchin', n:20, range:'Melee', A:'2', WS:'4+', S:'3', AP:'0', D:'1', kw:[], from:{ A:'Super Runts', WS:'Super Runts', S:'Super Runts' } }
      ],
      abilities:[
        { name:'Super Runts', who:'Zodgrod Wortsnagga', riled:true, text:'- This unit is **riled up**.\n- This unit’s Scavenged Shivs weapons have +1 **A**, **WS** and **S**.' },
        { name:'That’ll Learn Ya', who:'Runtherd', tag:'Once per battle round, per unit', text:'When this unit becomes **battle-shocked**, if this unit contains 4+ Gretchin models, you can roll one D3:\n- That number of Gretchin models in this unit are **destroyed**.\n- That unit is no longer **battle-shocked**.' },
        { name:'Downtrodden', who:'Gretchin', text:'For the purposes of **transport capacity**, each 2 Gretchin models (rounding up) take up the space of 1 model.' },
        { name:'Thievin’ Scavengers', who:'Gretchin', ph:['movement'], turn:'your', text:'At the end of your Movement phase, if this unit is controlling an **objective**, that objective is **secured**.' },
        { name:'Extra Sneaky', who:'Gretchin', tag:'Upgrade', def:'-3" detection range', text:'**GRETCHIN** unit only. This unit has -3" **detection range**.' }
      ],
      rules:['Waaagh!','Leader','Support'],
      kw:['Character','Epic Hero','Faction: Orks','Infantry','Runtherd','Zodgrod Wortsnagga','Battleline','Gretchin','Grots'],
      kwNote:'Battleline, Gretchin, Grots come from the combined unit.'
    },
    {
      id:'big-mek-painboy-nobz', name:'Big Mek', role:'Character', pts:385, copies:2, ptsNote:'100 + Painboy 45 + Nobz 240',
      leads:'Nobz', also:[{ name:'Painboy', support:true }],
      models:['1× Big Mek','1× Painboy','8× Nob w/ Kombi-rokkit and Kustom Krumpa','2× Nob w/ Kustom Krumpa and Paired Krumpas (Paired Krumpas)'],
      gear:[['Kustom mega-blasta','Drilla'],['’Urty syringe','Dok’s Toolz'],['Kombi-rokkit','Kustom Krumpa'],['Kustom Krumpa']],
      stats:[
        { name:'Big Mek', M:'6"', T:'5', Sv:'3+', W:'6', Ld:'7+', OC:'1', InSv:'–', base:'50mm' },
        { name:'Painboy', M:'6"', T:'5', Sv:'5+', W:'3', Ld:'7+', OC:'1', InSv:'–', base:'32mm' },
        { name:'Nob ×10', M:'6"', T:'5', Sv:'4+', W:'3', Ld:'7+', OC:'1', InSv:'–', base:'32mm' }
      ],
      ranged:[
        { name:'Kustom mega-blasta', who:'Big Mek', range:'24"', A:'3', BS:'4+', S:'9', AP:'-2', D:'3', kw:['HAZARDOUS','IGNORES COVER','ASSAULT'], from:{ 'IGNORES COVER':'More Dakka', ASSAULT:'Dakka! Dakka! Dakka!' } },
        { group:'Kombi-rokkit', who:'Nobz', n:8, name:'Busta Rokkit', range:'24"', A:'1', BS:'5+', S:'10', AP:'-2', D:'3', kw:['IGNORES COVER','ASSAULT'], from:{ 'IGNORES COVER':'More Dakka', ASSAULT:'Dakka! Dakka! Dakka!' } },
        { group:'Kombi-rokkit', who:'Nobz', n:8, name:'Shoota', range:'18"', A:'2', BS:'5+', S:'4', AP:'0', D:'1', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 1','IGNORES COVER','ASSAULT'], from:{ 'IGNORES COVER':'More Dakka', ASSAULT:'Dakka! Dakka! Dakka!' } }
      ],
      melee:[
        { name:'Drilla', who:'Big Mek', range:'Melee', A:'3', WS:'3+', S:'12', AP:'-3', D:'3', kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Displays of Savagery' } },
        { name:'’Urty syringe', who:'Painboy', range:'Melee', A:'1', WS:'3+', S:'2', AP:'0', D:'D6', kw:['ANTI-INFANTRY 4+','DEVASTATING WOUNDS: INFANTRY','EXTRA ATTACKS','SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Displays of Savagery' } },
        { name:'Dok’s Toolz', who:'Painboy', range:'Melee', A:'3', WS:'3+', S:'10', AP:'-2', D:'2', kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Displays of Savagery' } },
        { name:'Kustom Krumpa', who:'Nobz', n:10, range:'Melee', A:'3', WS:'3+', S:'10', AP:'-2', D:'2', kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Displays of Savagery' } }
      ],
      abilities:[
        { name:'Shokk-boosta', who:'Big Mek', ph:['movement'], turn:'your', text:'In your Movement phase, when this unit is selected to make an **advance move**, you can use this ability. If you do:\n- This unit can change that **advance roll** to a 6.\n- This unit can move through all types of model.\n- When this unit ends that **advance move**, make a **hazard roll** for each model in this unit.' },
        { name:'More Dakka', who:'Big Mek', text:'This unit’s ranged attacks have:\n- **[IGNORES COVER]**.\n- If this unit is **riled up**, **[SUSTAINED HITS 1]**.' },
        { name:'Crude Surgery', who:'Painboy', ph:['command'], turn:'your', text:'In your Command phase, this unit **heals** 3 wounds.' },
        { name:'Catch Dat Red Bit', who:'Painboy', tag:'Once per battle, per unit', ph:['command'], turn:'your', text:'When this model uses its **Crude Surgery** ability, you can add D3 to the number of wounds **healed**.\n*Place a Grot Orderly token next to the unit, removing it when this ability is used.*' },
        { name:'Ammo Runts', who:'Nobz', tag:'Once per battle, per unit', ph:['shooting'], turn:'your', text:'In your Shooting phase, when this unit is **selected to shoot**, you can use this ability. If you do, this unit’s ranged attacks have +1 to **hit rolls**.\n*Place any number of Ammo Runt tokens next to the unit, removing them when this ability is used.*' },
        { name:'Get Out da Way!', who:'Nobz', ph:['charge'], turn:'either', text:'While making a **charge move**, this unit can move through models (excluding **MONSTER/VEHICLE** models).' },
        { name:'Paired Krumpas', who:'Nobz', text:'Attacks made with this model’s Kustom Krumpa weapon can re-roll **hit rolls** and **wound rolls**.' }
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
      id:'big-mek-in-mega-armour-meganobz', name:'Big Mek in Mega Armour', role:'Character', pts:290, ptsNote:'115 + Meganobz 175', enhancement:'Supa-glowy Fing',
      leads:'Meganobz',
      models:['1× Big Mek in Mega Armour','5× Meganob w/ Kombi-weapon and Power Klaw'],
      gear:[['Kustom Mega-blasta','Power Klaw','Tellyport Blasta'],['Kombi-weapon','Power Klaw']],
      stats:[
        { name:'Big Mek in Mega Armour', M:'5"', T:'6', Sv:'2+', W:'5', Ld:'7+', OC:'1', InSv:'–', base:'40mm' },
        { name:'Meganob ×5', M:'5"', T:'6', Sv:'2+', W:'3', Ld:'7+', OC:'1', InSv:'–', base:'40mm' }
      ],
      ranged:[
        { name:'Kustom Mega-blasta', who:'Big Mek in Mega Armour', range:'24"', A:'3', BS:'4+', S:'9', AP:'-2', D:'3', kw:['HAZARDOUS','ANTI-INFANTRY 4+','DEVASTATING WOUNDS','SUPA-HAZARDOUS','IGNORES COVER','ASSAULT'], from:{ 'ANTI-INFANTRY 4+':'Supa-glowy Fing', 'DEVASTATING WOUNDS':'Supa-glowy Fing', 'SUPA-HAZARDOUS':'Supa-glowy Fing', 'IGNORES COVER':'More Dakka', ASSAULT:'Dakka! Dakka! Dakka!' } },
        { name:'Tellyport Blasta', who:'Big Mek in Mega Armour', range:'12"', A:'6', BS:'4+', S:'9', AP:'-2', D:'3', kw:['BLAST 1','ANTI-INFANTRY 4+','DEVASTATING WOUNDS','SUPA-HAZARDOUS','IGNORES COVER','ASSAULT'], from:{ 'ANTI-INFANTRY 4+':'Supa-glowy Fing', 'DEVASTATING WOUNDS':'Supa-glowy Fing', 'SUPA-HAZARDOUS':'Supa-glowy Fing', 'IGNORES COVER':'More Dakka', ASSAULT:'Dakka! Dakka! Dakka!' } },
        { group:'Kombi-weapon', who:'Meganobz', n:5, name:'Point Blank', range:'12"', A:'3', BS:'–', S:'5', AP:'0', D:'1', kw:['BLAST 1','TORRENT','ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } },
        { group:'Kombi-weapon', who:'Meganobz', n:5, name:'Kill Shot', range:'24"', A:'1', BS:'5+', S:'10', AP:'-2', D:'3', kw:['ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } },
        { group:'Kombi-weapon', who:'Meganobz', n:5, name:'Shoota', range:'18"', A:'2', BS:'5+', S:'4', AP:'0', D:'1', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 1','ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } }
      ],
      melee:[
        { name:'Power Klaw', who:'Big Mek in Mega Armour', range:'Melee', A:'3', WS:'3+', S:'10', AP:'-2', D:'2', kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Displays of Savagery' } },
        { name:'Power Klaw', who:'Meganobz', n:5, range:'Melee', A:'3', WS:'3+', S:'10', AP:'-2', D:'2', kw:['SUSTAINED HITS 1'], from:{ 'SUSTAINED HITS 1':'Displays of Savagery' } }
      ],
      abilities:[
        { name:'Fix Dat Armour Up', who:'Big Mek in Mega Armour', tag:'Once per battle, per unit', ph:['command'], turn:'your', text:'In your Command phase, this unit **heals** 3 wounds.\n*Place a Grot Oiler token next to the unit, removing it when this ability is used.*' },
        { name:'More Dakka', who:'Big Mek in Mega Armour', text:'This unit’s ranged attacks have:\n- **[IGNORES COVER]**.\n- If this unit is **riled up**, **[SUSTAINED HITS 1]**.' },
        { name:'Supa-glowy Fing', who:'Big Mek in Mega Armour', tag:'Enhancement', text:'**ORKS INFANTRY** model only (excluding **WEIRDBOY** models). This model’s ranged attacks have:\n- **[ANTI-INFANTRY 4+]**.\n- **[DEVASTATING WOUNDS]**.\n- **[SUPA-HAZARDOUS]**.' },
        { name:'Krumpin’ Time', who:'Meganobz', ph:['fight'], turn:'either', text:'In the Fight phase, if this unit is **riled up**, this unit has +1 to **hit rolls**.' },
        { name:'Arrogant Invulnerability', who:'Meganobz', def:'Attacks that target this unit have -1 AP', defAlways:true, text:'Attacks that target this unit have -1 **AP**.' }
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
      id:'gretchin', name:'Gretchin', role:'Battleline', pts:45, copies:3,
      models:['10× Gretchin'],
      gear:[['Grot Blasta','Scavenged Shivs']],
      stats:[
        { name:'Gretchin ×10', M:'6"', T:'2', Sv:'6+', W:'1', Ld:'8+', OC:'1', InSv:'–', base:'25mm' }
      ],
      ranged:[
        { name:'Grot Blasta', n:10, range:'12"', A:'1', BS:'4+', S:'3', AP:'0', D:'1', kw:['CLOSE-QUARTERS','ASSAULT'], from:{ ASSAULT:'Dakka! Dakka! Dakka!' } }
      ],
      melee:[
        { name:'Scavenged Shivs', n:10, range:'Melee', A:'1', WS:'5+', S:'2', AP:'0', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Downtrodden', text:'For the purposes of **transport capacity**, each 2 Gretchin models (rounding up) take up the space of 1 model.' },
        { name:'Thievin’ Scavengers', ph:['movement'], turn:'your', text:'At the end of your Movement phase, if this unit is controlling an **objective**, that objective is **secured**.' }
      ],
      rules:['Waaagh!'],
      kw:['Battleline','Faction: Orks','Gretchin','Grots','Infantry']
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
      id:'angron', name:'Angron', role:'Epic Hero', pts:330, warlord:true,
      models:['1× Angron'],
      gear:[['Samni’arius and Spinegrinder']],
      stats:[
        { name:'Angron', M:'14"', T:'11', Sv:'2+', W:'16', Ld:'5+', OC:'6', InSv:'4+', base:'100mm' }
      ],
      melee:[
        { group:'Samni’arius and Spinegrinder', name:'strike', range:'Melee', A:'9', WS:'2+', S:'14', AP:'-3', D:'D6+2', kw:['DEVASTATING WOUNDS'], from:{ A:'Relentless Rage' } },
        { group:'Samni’arius and Spinegrinder', name:'sweep', range:'Melee', A:'17', WS:'2+', S:'7', AP:'-2', D:'2', kw:['DEVASTATING WOUNDS'], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Reborn in Blood', ph:['command','movement'], turn:'either', turns:{ movement:'your' }, text:'At the start of the battle round, when you make a **Blessings of Khorne** roll, if this model is destroyed, you can use a triple 6 from that roll to use this ability instead of activating any Blessings of Khorne at the start of that battle round. If you do, this model is no longer destroyed and in the Reinforcements step of your next Movement phase, it is set up anywhere on the battlefield using its **Deep Strike** ability, with 8 wounds remaining.' },
        { name:'Wrathful Presence', at:'Start of the battle round', ph:['command'], turn:'either', text:'At the start of the battle round, select one Wrathful Presence ability. Until the start of the next battle round, this model has that ability.' },
        { name:'Damaged: 1-6 wounds remaining', damaged:'1-6', text:'While this model has 1-6 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' },
        // the three Wrathful Presence abilities: Angron has the one selected at the start of the battle round
        { name:'The Blood God’s Favour', who:'Wrathful Presence: pick one', text:'Each time you make a **Blessings of Khorne** roll, if this model is on the battlefield, you can re-roll up to 6 of the D6 rolled.' },
        // GW Faction Pack Rules Update wording (BSData has it too)
        { name:'Driven by Ultimate Rage', who:'Wrathful Presence: pick one', tag:'Aura', ph:['fight'], turn:'either', text:'While a friendly **WORLD EATERS** unit is within 6" of this unit, that unit’s melee attacks can:\n- Re-roll hit rolls of 1.\n- Re-roll wound rolls of 1.' },
        { name:'Overwhelming Wrath', who:'Wrathful Presence: pick one', tag:'Aura', ph:['movement'], turn:'opp', text:'Each time an enemy unit within 6" of this model is selected to Fall Back, that unit must take a Leadership test. If that test is failed, that unit must Remain Stationary this phase instead.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Damaged (1-6 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-6 wounds remaining' }
      ],
      aura:[
        { kind:'melee', needs:{ all:['Faction: World Eaters'] }, when:'Within 6" of Angron, if he has Driven by Ultimate Rage this round', selfWhen:'Own aura, if he has Driven by Ultimate Rage this round', note:'re-roll hit rolls of 1 and wound rolls of 1', from:'Driven by Ultimate Rage' }
      ],
      rules:['Deadly Demise D6','Deep Strike','Blessings of Khorne','Devastating Wounds'],
      kw:['Angron','Chaos','Character','Daemon','Epic Hero','Faction: World Eaters','Fly','Khorne','Monster','Primarch','Warlord']
    },
    {
      id:'chaos-terminators', name:'Chaos Terminators', role:'Infantry', pts:370, copies:2, upgrade:'Gore-stained Veterans',
      models:['1× Terminator Champion','2× Combi-bolter, chainfist','4× Combi-bolter, power fist','1× Paired accursed weapons','2× Heavy weapon'],
      gear:[['Paired accursed weapons'],['Chainfist','Combi-bolter'],['Combi-bolter','Power fist'],['Paired accursed weapons'],['Reaper autocannon','Power fist']],
      stats:[
        { name:'Chaos Terminators', M:'7"', T:'6', Sv:'2+', W:'3', Ld:'6+', OC:'1', InSv:'4+', base:'40mm' }
      ],
      ranged:[
        { name:'Combi-bolter', n:6, range:'24"', A:'2', BS:'4+', S:'5', AP:'-1', D:'1', kw:['RAPID FIRE 4'] },
        { name:'Reaper autocannon', n:2, range:'36"', A:'4', BS:'4+', S:'7', AP:'-1', D:'1', kw:['DEVASTATING WOUNDS','RAPID FIRE 2','SUSTAINED HITS 1'] }
      ],
      melee:[
        { name:'Paired accursed weapons', n:2, range:'Melee', A:'6', WS:'2+', S:'5', AP:'-2', D:'1', kw:['TWIN-LINKED'], from:{ A:'Relentless Rage', WS:'Gore-stained Veterans' } },
        { name:'Chainfist', n:2, range:'Melee', A:'4', WS:'3+', S:'8', AP:'-3', D:'2', kw:['ANTI-VEHICLE 3+'], from:{ A:'Relentless Rage', WS:'Gore-stained Veterans' } },
        { name:'Power fist', n:6, range:'Melee', A:'4', WS:'2+', S:'8', AP:'-2', D:'2', kw:[], from:{ A:'Relentless Rage', WS:'Gore-stained Veterans' } }
      ],
      abilities:[
        // GW Faction Pack Rules Update wording ("Chaos Terminators, Blood Fury Ability"), Wahapedia's bold. Its two parts are
        // bullets there, the second with two sub-bullets; the app has one level of bullets, so the parts are paragraphs
        { name:'Bloody Fury', ph:['movement','shooting','charge'], turn:'your', turns:{ movement:'opp', charge:'either' }, text:'This unit’s ranged attacks that target the closest eligible target can re-roll **hit rolls**.\nWhen this unit **declares a charge**, you can use this part of this ability. If you do:\n- This unit can re-roll that **charge roll**.\n- This unit must end that **charge move** **engaged** with the closest **charge target**.' },
        // already in the WS values above (from); its official text starts with the restriction New Recruit leaves out
        { name:'Gore-stained Veterans', tag:'Upgrade', text:'**TERMINATOR SQUAD** unit only. This unit’s melee attacks have +1 **WS**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target is the closest eligible target', cond:'closest', note:'re-roll hit rolls', from:'Bloody Fury' }
      ],
      rules:['Deep Strike','Blessings of Khorne','Twin-linked','Anti','Rapid Fire','Sustained Hits','Devastating Wounds'],
      kw:['Chaos','Faction: World Eaters','Infantry','Khorne','Terminator','Terminator Squad']
    },
    {
      id:'chaos-terminators-2', name:'Chaos Terminators', role:'Infantry', pts:380, upgrade:'Gore-stained Veterans',
      models:['1× Terminator Champion','2× Combi-bolter, chainfist','4× Combi-bolter, power fist','1× Paired accursed weapons','2× Heavy weapon'],
      gear:[['Paired accursed weapons'],['Chainfist','Combi-bolter'],['Combi-bolter','Power fist'],['Paired accursed weapons'],['Reaper autocannon','Power fist']],
      stats:[
        { name:'Chaos Terminators', M:'7"', T:'6', Sv:'2+', W:'3', Ld:'6+', OC:'1', InSv:'4+', base:'40mm' }
      ],
      ranged:[
        { name:'Combi-bolter', n:6, range:'24"', A:'2', BS:'4+', S:'5', AP:'-1', D:'1', kw:['RAPID FIRE 4'] },
        { name:'Reaper autocannon', n:2, range:'36"', A:'4', BS:'4+', S:'7', AP:'-1', D:'1', kw:['DEVASTATING WOUNDS','RAPID FIRE 2','SUSTAINED HITS 1'] }
      ],
      melee:[
        { name:'Paired accursed weapons', n:2, range:'Melee', A:'6', WS:'2+', S:'5', AP:'-2', D:'1', kw:['TWIN-LINKED'], from:{ A:'Relentless Rage', WS:'Gore-stained Veterans' } },
        { name:'Chainfist', n:2, range:'Melee', A:'4', WS:'3+', S:'8', AP:'-3', D:'2', kw:['ANTI-VEHICLE 3+'], from:{ A:'Relentless Rage', WS:'Gore-stained Veterans' } },
        { name:'Power fist', n:6, range:'Melee', A:'4', WS:'2+', S:'8', AP:'-2', D:'2', kw:[], from:{ A:'Relentless Rage', WS:'Gore-stained Veterans' } }
      ],
      abilities:[
        // GW Faction Pack Rules Update wording ("Chaos Terminators, Blood Fury Ability"), Wahapedia's bold. Its two parts are
        // bullets there, the second with two sub-bullets; the app has one level of bullets, so the parts are paragraphs
        { name:'Bloody Fury', ph:['movement','shooting','charge'], turn:'your', turns:{ movement:'opp', charge:'either' }, text:'This unit’s ranged attacks that target the closest eligible target can re-roll **hit rolls**.\nWhen this unit **declares a charge**, you can use this part of this ability. If you do:\n- This unit can re-roll that **charge roll**.\n- This unit must end that **charge move** **engaged** with the closest **charge target**.' },
        // already in the WS values above (from); its official text starts with the restriction New Recruit leaves out
        { name:'Gore-stained Veterans', tag:'Upgrade', text:'**TERMINATOR SQUAD** unit only. This unit’s melee attacks have +1 **WS**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target is the closest eligible target', cond:'closest', note:'re-roll hit rolls', from:'Bloody Fury' }
      ],
      rules:['Deep Strike','Blessings of Khorne','Twin-linked','Anti','Rapid Fire','Sustained Hits','Devastating Wounds'],
      kw:['Chaos','Faction: World Eaters','Infantry','Khorne','Terminator','Terminator Squad']
    },
    {
      id:'eightbound', name:'Eightbound', role:'Infantry', pts:125,
      models:['1× Eightbound Champion','2× Eightbound'],
      gear:[['Chainblades'],['Chainblades']],
      stats:[
        { name:'Eightbound', M:'10"', T:'6', Sv:'3+', W:'3', Ld:'6+', OC:'1', InSv:'5+', base:'40mm' }
      ],
      melee:[
        { name:'Chainblades', n:3, range:'Melee', A:'6', WS:'3+', S:'8', AP:'-2', D:'2', kw:[], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Beacons of Rage', tag:'Aura', ph:['fight'], turn:'either', text:'While a friendly **WORLD EATERS** unit is within 6" of this unit, each time a model in that unit makes a melee attack that targets a unit (excluding **MONSTERS** and **VEHICLES**), add 1 to the Hit roll. If that attack targets a unit that is Below Half-strength, add 1 to the Wound roll as well.' }
      ],
      aura:[
        { kind:'melee', needs:{ all:['Faction: World Eaters'] }, when:'Within 6" of Eightbound, vs non-MONSTER/VEHICLE targets', selfWhen:'Own aura, vs non-MONSTER/VEHICLE targets', note:'+1 to hit', from:'Beacons of Rage', selfAlways:true, vs:{ none:['Monster','Vehicle'] }, calc:{ hit:1 } },
        { kind:'melee', needs:{ all:['Faction: World Eaters'] }, when:'Within 6" of Eightbound, target Below Half-strength, vs non-MONSTER/VEHICLE targets', selfWhen:'Own aura, target Below Half-strength, vs non-MONSTER/VEHICLE targets', note:'+1 to wound rolls', from:'Beacons of Rage', vs:{ none:['Monster','Vehicle'] }, calc:{ wound:1 } }
      ],
      rules:['Scouts 6"','Blessings of Khorne'],
      kw:['Chaos','Daemon','Eightbound','Faction: World Eaters','Infantry','Khorne','Possessed']
    },
    {
      id:'goremongers', name:'Goremongers', role:'Infantry', pts:70,
      models:['1× Blood Herald','7× Goremonger w/ chainblade'],
      gear:[['Autopistol','Chainblade','Close combat weapon'],['Autopistol','Chainblade','Close combat weapon']],
      stats:[
        { name:'Goremongers', M:'9"', T:'4', Sv:'6+', W:'1', Ld:'7+', OC:'1', InSv:'–', base:'32mm' }
      ],
      ranged:[
        { name:'Autopistol', n:8, range:'12"', A:'1', BS:'4+', S:'3', AP:'0', D:'1', kw:['PISTOL'] }
      ],
      melee:[
        { name:'Chainblade', n:8, range:'Melee', A:'4', WS:'4+', S:'3', AP:'0', D:'1', kw:['LANCE'], from:{ A:'Relentless Rage' } },
        { name:'Close combat weapon', n:8, range:'Melee', A:'3', WS:'4+', S:'3', AP:'0', D:'1', kw:[], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Loping Speed', ph:['movement'], turn:'opp', text:'In your opponent’s Movement phase, if an enemy unit ends a move within 8" of this unit, if this unit is not within Engagement Range of one or more enemy units, this unit can make a Normal move of up to D6".' }
      ],
      rules:['Infiltrators','Blessings of Khorne','Pistol','Lance'],
      kw:['Chaos','Faction: World Eaters','Goremongers','Grenades','Infantry','Khorne']
    },
    {
      id:'jakhals', name:'Jakhals', role:'Infantry', pts:65,
      models:['1× Jakhal Pack Leader','1× Dishonoured w/ paired manglers','8× Jakhal'],
      gear:[['Autopistol','Chainblades'],['Paired manglers'],['Autopistol','Chainblades']],
      stats:[
        { name:'Jakhal', M:'7"', T:'4', Sv:'6+', W:'1', Ld:'7+', OC:'1', InSv:'–', base:'28.5mm' },
        { name:'Dishonoured w/ paired manglers', M:'7"', T:'4', Sv:'6+', W:'1', Ld:'7+', OC:'1', InSv:'–', base:'40mm' }
      ],
      ranged:[
        { name:'Autopistol', n:9, range:'12"', A:'1', BS:'4+', S:'3', AP:'0', D:'1', kw:['PISTOL'] }
      ],
      melee:[
        { name:'Chainblades', n:9, range:'Melee', A:'4', WS:'4+', S:'3', AP:'0', D:'1', kw:[], from:{ A:'Relentless Rage' } },
        { name:'Paired manglers', range:'Melee', A:'5', WS:'4+', S:'4', AP:'0', D:'1', kw:[], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Objective Ravaged', ph:['command'], turn:'your', text:'At the end of your Command phase, if this unit is within range of an objective marker you control, that objective marker remains under your control until your opponent’s Level of Control over that objective marker is greater than yours at the end of a phase.' }
      ],
      rules:['Blessings of Khorne','Pistol'],
      kw:['Chaos','Faction: World Eaters','Grenades','Infantry','Jakhals','Khorne']
    },
    {
      id:'forgefiend', name:'Forgefiend', role:'Vehicle', pts:145, copies:2,
      models:['1× Forgefiend'],
      gear:[['Hades autocannon','Hades autocannon','Ectoplasma cannon','Forgefiend claws']],
      stats:[
        { name:'Forgefiend', M:'10"', T:'10', Sv:'3+', W:'12', Ld:'6+', OC:'3', InSv:'5+', base:'120×92mm' }
      ],
      ranged:[
        { name:'Hades autocannon', n:2, range:'36"', A:'6', BS:'4+', S:'8', AP:'-1', D:'2', kw:['RAPID FIRE 4'] },
        { name:'Ectoplasma cannon', range:'36"', A:'D3', BS:'4+', S:'10', AP:'-3', D:'3', kw:['BLAST','RAPID FIRE 1'] }
      ],
      melee:[
        { name:'Forgefiend claws', range:'Melee', A:'7', WS:'3+', S:'6', AP:'0', D:'1', kw:[], from:{ A:'Relentless Rage' } }
      ],
      abilities:[
        { name:'Furious Onslaught', ph:['movement','shooting'], turn:'either', turns:{ movement:'opp', shooting:'your' }, text:'Each time this model makes a ranged attack that targets the closest eligible target within 18", you can re-roll the Hit roll.' },
        { name:'Damaged: 1-4 wounds remaining', damaged:'1-4', text:'While this model has 1-4 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target is the closest eligible target within 18"', cond:'closest18', note:'re-roll the hit roll', from:'Furious Onslaught' },
        { kind:'all', when:'Damaged (1-4 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-4 wounds remaining' }
      ],
      rules:['Deadly Demise D3','Blessings of Khorne','Rapid Fire','Blast'],
      kw:['Chaos','Daemon','Faction: World Eaters','Forgefiend','Khorne','Vehicle','Walker']
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
      id:'belisarius-cawl', name:'Belisarius Cawl', role:'Epic Hero', pts:220, warlord:true,
      models:['1× Belisarius Cawl'],
      gear:[['Arc Scourge','Cawl’s Omnissian axe','Mechadendrite hive','Solar atomiser']],
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
        { name:'Mechanicus Bodyguard', def:'Lone Operative while within 3" of another friendly ADEPTUS MECHANICUS unit', text:'While this model is within 3" of one or more other friendly **ADEPTUS MECHANICUS** units, this model has the **Lone Operative** ability.' },
        { name:'Self-repair Mechanisms', ph:['command'], turn:'your', text:'At the start of your Command phase, this model regains up to D3 lost wounds.' },
        { name:'Supreme Commander', text:'If this model is in your army, it must be your Warlord.' }
      ],
      // what Belisarius Cawl gives other units: the Invocation of Machine Vengeance canticle (Binharic Courage's OC and
      // test bonus and Shroudpsalm's Stealth change no attacks)
      aura:[
        { kind:'all', needs:{ all:['Faction: Adeptus Mechanicus'] }, when:'If Cawl has Invocation of Machine Vengeance, vs your Machine Vengeance target', selfWhen:'If he has Invocation of Machine Vengeance, vs your Machine Vengeance target', note:'can re-roll the hit roll', from:'Canticles of the Omnissiah', lasts:'round' }
      ],
      // help this unit gives other units of its list when they are attacked (the Damage tab offers it as a tick box)
      guard:[
        { from:'Shroudpsalm', needs:{ all:['Faction: Adeptus Mechanicus'] }, kind:'ranged', when:'Within 6" of Cawl, if he has Shroudpsalm', note:'Stealth: the benefit of cover against ranged attacks', calc:{ stealth:true } }
      ],
      rules:['Doctrina Imperatives','Anti','Devastating Wounds','Extra Attacks','Blast','Melta'],
      kw:['Belisarius Cawl','Character','Cult Mechanicus','Epic Hero','Faction: Adeptus Mechanicus','Imperium','Mobile','Monster','Tech-Priest','Warlord']
    },
    {
      id:'thulia-ghuld', name:'Thulia Ghuld', role:'Epic Hero', pts:180,
      models:['1× Thulia Ghuld'],
      gear:[['Jericho-class conversion resonator','Rod of the War Forge']],
      stats:[
        { name:'Thulia Ghuld', M:'8"', T:'8', Sv:'2+', W:'10', Ld:'6+', OC:'3', InSv:'4+', base:'80mm' }
      ],
      ranged:[
        { group:'Jericho-class conversion resonator', name:'shockwave', range:'24"', A:'D6+2', BS:'2+', S:'6', AP:'-2', D:'1', kw:['BLAST','SUSTAINED HITS 1'] },
        { group:'Jericho-class conversion resonator', name:'titanic impact', range:'24"', A:'2', BS:'2+', S:'12', AP:'-3', D:'D6+2', kw:['DEVASTATING WOUNDS'] }
      ],
      melee:[
        { group:'Rod of the War Forge', name:'strike', range:'Melee', A:'6', WS:'2+', S:'10', AP:'-2', D:'3', kw:[] },
        { group:'Rod of the War Forge', name:'sweep', range:'Melee', A:'12', WS:'2+', S:'6', AP:'-1', D:'1', kw:[] }
      ],
      abilities:[
        // the three abilities Rod of the War Forge selects from: shooting and declaring a charge after an Advance or a
        // Fall Back (your Shooting and Charge phases), and both Imperatives (attacks in either player's Fight phase too)
        { name:'Icon of War', ph:['command','movement','shooting','charge','fight'], turn:'either', turns:{ command:'your', movement:'opp', charge:'your' }, text:'**Fanatical Devotion:** You can select one friendly **SKITARII** or **THULIA GHULD** unit within 6" of this model; until the start of your next Command phase, that unit is eligible to shoot and declare a charge in a turn in which it Advanced.\n**Adaptive Tactics:** You can select one friendly **SKITARII** or **THULIA GHULD** unit within 6" of this model; until the start of your next Command phase, that unit is eligible to shoot and declare a charge in a turn in which it Fell Back.\n**The Fires of Mars:** You can select one friendly **SKITARII** or **THULIA GHULD** unit within 6" of this model; until the start of your next Command phase, the Conqueror Imperative and Protector Imperative are both active for that unit.' },
        { name:'Mechanicus Bodyguard', def:'Lone Operative while within 3" of another friendly ADEPTUS MECHANICUS unit', text:'While this model is within 3" of one or more other friendly **ADEPTUS MECHANICUS** units, this model has the **Lone Operative** ability.' },
        { name:'Secutor of Olympus', ph:['shooting'], turn:'your', text:'At the start of your Shooting phase, select one enemy **VEHICLE** unit within 12" of this model and roll one D6: on a 2+, that enemy unit suffers D3+1 **mortal wounds**.' },
        { name:'Supreme Commander', text:'If this model is in your army, it must be your Warlord.' },
        // New Recruit's words; GW's Faction Pack and Wahapedia add "(see next page)" after "section", pointing at the
        // pack's next page, where Icon of War is printed (here it is the first ability above) (deviations-texts.json)
        { name:'Rod of the War Forge', ph:['command'], turn:'your', text:'In your Command phase, select one of the abilities in the Icon of War section. Until the start of your next Command phase, this model has that ability.' }
      ],
      rules:['Doctrina Imperatives','Blast','Sustained Hits','Devastating Wounds'],
      kw:['Character','Cult Mechanicus','Epic Hero','Faction: Adeptus Mechanicus','Imperium','Mobile','Monster','Tech-Priest','Thulia Ghuld']
    },
    {
      id:'tech-priest-enginseer', name:'Tech-Priest Enginseer', role:'Character', pts:75, enhancement:'Necromechanic',
      models:['1× Tech-Priest Enginseer'],
      gear:[['Mechanicus pistol','Omnissian axe','Servo arm']],
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
        { name:'Enginseer', def:'Lone Operative while within 3" of a friendly ADEPTUS MECHANICUS VEHICLE unit, unless it is leading a unit', text:'While this model is within 3" of one or more friendly **ADEPTUS MECHANICUS VEHICLE** units, unless it is leading a unit, this model has the **Lone Operative** ability.' },
        // Wahapedia's datasheet wording; New Recruit (BSData) has no full stop at the end (deviations-nr.json)
        { name:'Omnissiah’s Blessing', ph:['command'], turn:'your', text:'In your Command phase, select one friendly **ADEPTUS MECHANICUS** model within 3" of this model. That model regains up to D3 lost wounds and, if it is a **VEHICLE** model, until the start of your next Command phase, that model has the **Feel No Pain 5+** ability. Each model can only be selected for this ability once per Command phase.' },
        { name:'Vengeance for the Omnissiah', text:'If a friendly **ADEPTUS MECHANICUS VEHICLE** model is destroyed within 12" of this model, until the end of the battle, this model’s Omnissian axe has an Attacks characteristic of 6.' },
        // the Cohort Cybernetica enhancement as data.js has it; New Recruit leaves out "TECH-PRIEST model only." (deviations-nr.json)
        { name:'Necromechanic', tag:'Enhancement', text:'**TECH-PRIEST** model only. Once per battle round, when a saving throw made for a friendly **LEGIO CYBERNETICA** or **ADEPTUS MECHANICUS VEHICLE** model within 12" of the bearer is failed, the bearer can use this Enhancement. If they do, change the Damage characteristic of that attack to 0.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', weapon:'Omnissian axe', set:{ A:'6' }, when:'After a friendly ADEPTUS MECHANICUS VEHICLE model is destroyed within 12" of it', note:'until the end of the battle', from:'Vengeance for the Omnissiah', calc:{}, lasts:'battle' }
      ],
      // help this unit gives other units of its list when they are attacked (the Damage tab offers it as a tick box)
      guard:[
        { from:'Omnissiah’s Blessing', needs:{ all:['Faction: Adeptus Mechanicus','Vehicle'] }, kind:'all', one:true, when:'Picked by the Enginseer in your Command phase (within 3")', note:'Feel No Pain 5+ for that VEHICLE model', calc:{ fnp:5 } }
      ],
      rules:['Leader','Doctrina Imperatives','Devastating Wounds','Pistol','Extra Attacks'],
      kw:['Character','Cult Mechanicus','Enginseer','Faction: Adeptus Mechanicus','Imperium','Infantry','Tech-Priest']
    },
    {
      id:'cybernetica-datasmith-kastelan-robots', name:'Cybernetica Datasmith', role:'Character', pts:335, ptsNote:'35 + Kastelan Robots 300', enhancement:'Martial Signatum Amplificator',
      leads:'Kastelan Robots', support:true,
      models:['1× Cybernetica Datasmith','4× Kastelan Robot'],
      gear:[['Mechanicus pistol','Power fist'],['Twin Kastelan fist','Incendine combustor']],
      stats:[
        { name:'Cybernetica Datasmith', M:'8"', T:'4', Sv:'2+', W:'3', Ld:'7+', OC:'1', InSv:'5+', base:'32mm', from:{ M:'Cyber-psalm Programming' } },
        { name:'Kastelan Robot ×4', M:'8"', T:'9', Sv:'2+', W:'7', Ld:'7+', OC:'2', InSv:'5+', base:'60mm', from:{ M:'Cyber-psalm Programming' } }
      ],
      ranged:[
        { name:'Mechanicus pistol', who:'Cybernetica Datasmith', range:'12"', A:'1', BS:'3+', S:'6', AP:'-1', D:'1', kw:['DEVASTATING WOUNDS','PISTOL'] },
        { name:'Incendine combustor', who:'Kastelan Robots', n:4, range:'12"', A:'D6', BS:'–', S:'6', AP:'-1', D:'1', kw:['IGNORES COVER','TORRENT'] }
      ],
      melee:[
        { name:'Power fist', who:'Cybernetica Datasmith', range:'Melee', A:'2', WS:'3+', S:'8', AP:'-2', D:'2', kw:[] },
        { name:'Twin Kastelan fist', who:'Kastelan Robots', n:4, range:'Melee', A:'4', WS:'4+', S:'12', AP:'-2', D:'3', kw:['TWIN-LINKED'] }
      ],
      abilities:[
        { name:'Battle Protocols', who:'Cybernetica Datasmith', ph:['command'], turn:'your', def:'Aegis Protocol: KASTELAN ROBOT models +1 Toughness (from the start of the battle until another protocol is selected)', defCalc:{ t:1, model:'Kastelan Robot' }, text:'At the start of the battle, if this model is leading a **KASTELAN ROBOTS** unit, that unit enters Aegis Protocols (see below). In your Command phase, if this model is leading a **KASTELAN ROBOTS** unit, you can select one protocol from those listed below for that unit to enter. Once a unit enters a protocol, it remains in that protocol until it enters a different one.\n- **Protector Protocol:** Add 2 to the Attacks characteristic of ranged weapons equipped by **KASTELAN ROBOT** models in that unit.\n- **Conqueror Protocol:** Add 2 to the Attacks characteristic of melee weapons equipped by **KASTELAN ROBOT** models in that unit.\n- **Aegis Protocol:** Add 1 to the Toughness characteristic of **KASTELAN ROBOT** models in that unit.' },
        // Wahapedia's markup and bullets (BSData and GW's Faction Pack, PDF p17, print the two bullets too)
        { name:'Data-severed', who:'Cybernetica Datasmith', text:'If there are no **KASTELAN ROBOT** models in this unit:\n- This unit loses **VEHICLE**.\n- This unit has **INFANTRY**.' },
        { name:'Martial Signatum Amplificator', who:'Cybernetica Datasmith', tag:'Enhancement', text:'**TECH-PRIEST** model only. Models in the bearer’s unit have the **SKITARII** keyword.' },
        { name:'Robotic Bodyguard', who:'Kastelan Robots', def:'Cybernetica Datasmith only: Feel No Pain 4+ while leading this unit', defAlways:true, defCalc:{ fnp:4, model:'Cybernetica Datasmith' }, text:'While a **CYBERNETICA DATASMITH** model is leading this unit, that model has the **Feel No Pain** 4+ ability.' },
        // GW's Faction Pack v1.4 Rules Update wording (PDF p17), with Wahapedia's markup
        { name:'Repulsor Grid', who:'Kastelan Robots', def:'Ranged attacks: each unmodified 6 on its save rolls, 1 mortal wound to the attacking unit after it has shot', text:'When an enemy unit targets this unit with ranged attacks, until that enemy unit has shot, when this unit makes a **save roll**:\n- On an unmodified 6, that enemy unit suffers 1 **mortal wound** after that enemy unit has shot.' }
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
      id:'skitarii-rangers', name:'Skitarii Rangers', role:'Battleline', pts:85, copies:2,
      models:['1× Skitarii Ranger Alpha','1× Skitarii Ranger w/ arc rifle','1× Skitarii Ranger w/ plasma caliver','1× Skitarii Ranger w/ transuranic arquebus','1× Skitarii Ranger w/ omnispex (Omnispex)','5× Skitarii Ranger w/ galvanic rifle'],
      gear:[['Alpha combat weapon','Close combat weapon','Galvanic rifle'],['Arc rifle','Close combat weapon'],['Close combat weapon','Plasma caliver'],['Close combat weapon','Transuranic arquebus'],['Close combat weapon','Galvanic rifle'],['Close combat weapon','Galvanic rifle']],
      stats:[
        // New Recruit prints "Skitarii Rangers (x2)"; the unit's 10 models all have this profile (BSData ×10) (deviations-nr.json)
        { name:'Skitarii Rangers ×10', M:'6"', T:'3', Sv:'4+', W:'1', Ld:'7+', OC:'2', InSv:'5+', base:'25mm' }
      ],
      ranged:[
        { name:'Galvanic rifle', n:7, range:'30"', A:'2', BS:'4+', S:'4', AP:'0', D:'1', kw:['IGNORES COVER'], from:{ 'IGNORES COVER':'Omnispex' } },
        { name:'Arc rifle', range:'30"', A:'1', BS:'4+', S:'8', AP:'-1', D:'D3', kw:['ANTI-VEHICLE 4+','DEVASTATING WOUNDS','RAPID FIRE 1','IGNORES COVER'], from:{ 'IGNORES COVER':'Omnispex' } },
        { group:'Plasma caliver', name:'supercharge', range:'30"', A:'2', BS:'4+', S:'8', AP:'-3', D:'2', kw:['HAZARDOUS','IGNORES COVER'], from:{ 'IGNORES COVER':'Omnispex' } },
        { group:'Plasma caliver', name:'standard', range:'30"', A:'2', BS:'4+', S:'7', AP:'-2', D:'1', kw:['IGNORES COVER'], from:{ 'IGNORES COVER':'Omnispex' } },
        { name:'Transuranic arquebus', range:'36"', A:'1', BS:'4+', S:'7', AP:'-2', D:'D3', kw:['HEAVY','PRECISION','IGNORES COVER'], from:{ 'IGNORES COVER':'Omnispex' } }
      ],
      melee:[
        { name:'Alpha combat weapon', range:'Melee', A:'2', WS:'4+', S:'5', AP:'-1', D:'1', kw:[] },
        { name:'Close combat weapon', n:10, range:'Melee', A:'1', WS:'4+', S:'3', AP:'0', D:'1', kw:[] }
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
    {
      id:'ironstrider-ballistarii', name:'Ironstrider Ballistarii', role:'Vehicle', pts:280,
      models:['3× Ironstrider Ballistarius (Twin cognis lascannon)'],
      gear:[['Ironstrider feet','Twin cognis lascannon']],
      stats:[
        { name:'Ironstrider Ballistarii ×3', M:'10"', T:'7', Sv:'3+', W:'7', Ld:'7+', OC:'2', InSv:'5+', base:'105×70mm' }
      ],
      ranged:[
        { name:'Twin cognis lascannon', n:3, range:'48"', A:'2', BS:'4+', S:'12', AP:'-3', D:'D6+1', kw:['SUSTAINED HITS 1','TWIN-LINKED'] }
      ],
      melee:[
        { name:'Ironstrider feet', n:3, range:'Melee', A:'3', WS:'4+', S:'5', AP:'0', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Elevated Strider', ph:['movement','shooting'], turn:'your', text:'This unit is eligible to shoot in a turn in which it Fell Back or Advanced, and you can re-roll Desperate Escape tests taken for models in this unit.' },
        { name:'Broad Spectrum Data-tether', text:'Each time you select this unit as the target of a Stratagem, roll one D6: on a 5+, you gain 1CP.' }
      ],
      rules:['Deadly Demise 1','Doctrina Imperatives','Sustained Hits'],
      kw:['Faction: Adeptus Mechanicus','Imperium','Ironstrider Ballistarii','Skitarii','Smoke','Vehicle','Walker']
    },
    {
      id:'ironstrider-ballistarii-2', name:'Ironstrider Ballistarii', role:'Vehicle', pts:250,
      models:['3× Ironstrider Ballistarius (Twin cognis autocannon)'],
      gear:[['Ironstrider feet','Twin cognis autocannon']],
      stats:[
        { name:'Ironstrider Ballistarii ×3', M:'10"', T:'7', Sv:'3+', W:'7', Ld:'7+', OC:'2', InSv:'5+', base:'105×70mm' }
      ],
      ranged:[
        { name:'Twin cognis autocannon', n:3, range:'48"', A:'4', BS:'4+', S:'9', AP:'-1', D:'3', kw:['SUSTAINED HITS 1','TWIN-LINKED'] }
      ],
      melee:[
        { name:'Ironstrider feet', n:3, range:'Melee', A:'3', WS:'4+', S:'5', AP:'0', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Elevated Strider', ph:['movement','shooting'], turn:'your', text:'This unit is eligible to shoot in a turn in which it Fell Back or Advanced, and you can re-roll Desperate Escape tests taken for models in this unit.' },
        { name:'Broad Spectrum Data-tether', text:'Each time you select this unit as the target of a Stratagem, roll one D6: on a 5+, you gain 1CP.' }
      ],
      rules:['Deadly Demise 1','Doctrina Imperatives','Sustained Hits'],
      kw:['Faction: Adeptus Mechanicus','Imperium','Ironstrider Ballistarii','Skitarii','Smoke','Vehicle','Walker']
    },
    {
      id:'onager-dunecrawler', name:'Onager Dunecrawler', role:'Vehicle', pts:150,
      models:['1× Onager Dunecrawler (Broad spectrum data-tether)'],
      gear:[['Cognis heavy stubber','Dunecrawler legs','Twin Onager heavy phosphor blaster']],
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
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Damaged (1-4 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-4 wounds remaining' }
      ],
      // help this unit gives other units of its list when they are attacked (the Damage tab offers it as a tick box)
      guard:[
        { from:'Emanatus Forcefield', needs:{ all:['Faction: Adeptus Mechanicus','Battleline'] }, kind:'ranged', when:'Wholly within 6" of the Onager Dunecrawler', note:'4+ InSv against ranged attacks', calc:{ insv:4 } }
      ],
      rules:['Deadly Demise D3','Doctrina Imperatives','Rapid Fire','Sustained Hits','Ignores Cover','Twin-linked'],
      kw:['Faction: Adeptus Mechanicus','Imperium','Onager Dunecrawler','Skitarii','Vehicle','Walker']
    },
    {
      id:'skorpius-disintegrator', name:'Skorpius Disintegrator', role:'Vehicle', pts:170, copies:2,
      models:['1× Skorpius Disintegrator'],
      gear:[['Armoured hull','Cognis heavy stubber','Cognis heavy stubber','Cognis heavy stubber','Disruptor missile launcher','Ferrumite cannon']],
      stats:[
        { name:'Skorpius Disintegrator', M:'10"', T:'10', Sv:'2+', W:'12', Ld:'7+', OC:'3', InSv:'–', base:'Hull' }
      ],
      ranged:[
        { name:'Cognis heavy stubber', n:3, range:'36"', A:'3', BS:'4+', S:'4', AP:'0', D:'1', kw:['RAPID FIRE 3','SUSTAINED HITS 1'] },
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
      // abilities that change this unit's attacks, shown inside its weapon tables (it has no belleros energy cannon)
      mods:[
        { kind:'ranged', weapon:'Ferrumite cannon', when:'Ferrumite cannon vs MONSTER or VEHICLE targets', note:'+1 to hit rolls', from:'Blistering Salvoes', always:true, vs:{ any:['Monster','Vehicle'] } },
        { kind:'all', when:'Damaged (1-4 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-4 wounds remaining' }
      ],
      rules:['Deadly Demise D3','Doctrina Imperatives','Rapid Fire','Sustained Hits','Twin-linked'],
      kw:['Faction: Adeptus Mechanicus','Frame','Imperium','Skitarii','Skorpius Disintegrator','Smoke','Vehicle']
    }
  ]
},
];

// core terms (not abilities): kept out of a unit's rule list and the glossary of rules units have
const CONCEPTS = ['Hazard Roll','Mortal Wounds','Battle-shock','Engagement','Selected to Attack','Destroyed','Normal Move','Advance Move','Fall-back Move','Charge','Charge Move','Pile-in Move','Consolidation Move','Benefit of Cover','Strategic Reserves','Ingress Move','Surge Move','Scout Move','Starting Strength','Select Weapons'];

return { version:VERSION, concepts:CONCEPTS, rules:RULES, ruleSrc:RULE_SRC, ruleAliases:RULE_ALIASES, coreStratagems:CORE_STRATAGEMS, factions:FACTIONS, armies:ARMIES };
})();
