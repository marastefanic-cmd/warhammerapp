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

const VERSION = '2026-10-20.2';

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
  'Hazardous': 'Each time a unit is **selected to shoot** or **selected to fight**, after that unit has resolved all of its attacks, make a number of **hazard rolls** (06.03) for that unit equal to the number of **[HAZARDOUS]** weapons you selected in the Select Weapons step.',
  'Ignores Cover': 'Each time an attack is made with an **[IGNORES COVER]** weapon, the target cannot have the **benefit of cover** against that attack (13.08), including from rules that give a model or unit the **benefit of cover** (e.g. **Stealth**).',
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
  [/^hazardous(?!( roll| test)s?$)/i, 'Hazardous'], [/^ignores cover/i, 'Ignores Cover'], [/^lethal hits/i, 'Lethal Hits'],
  [/^precision/i, 'Precision'], [/^rapid fire/i, 'Rapid Fire'], [/^sustained hits/i, 'Sustained Hits'],
  [/^torrent/i, 'Torrent'], [/^twin-linked/i, 'Twin-linked'], [/^assault/i, 'Assault'],
  [/^deep strike/i, 'Deep Strike'], [/^deadly demise/i, 'Deadly Demise'], [/^feel no pain/i, 'Feel No Pain'],
  [/^leader\b/i, 'Leader'], [/^lone operative/i, 'Lone Operative'], [/^mobile/i, 'Mobile'], [/^hunter/i, 'Hunter'], [/^snap shooting/i, 'Snap Shooting'],
  [/^fights first/i, 'Fights First'], [/^actions?$/i, 'Actions'],
  [/^melta/i, 'Melta'], [/^lance/i, 'Lance'], [/^super-heavy walker/i, 'Super-Heavy Walker'],
  [/^firing deck/i, 'Firing Deck'], [/^scouts/i, 'Scouts'],
  [/^psychic$/i, 'Psychic'],
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
  { id:'smokescreen', gist:'Until the end of the phase, your SMOKE unit, and a unit not fully visible because of it, has the benefit of cover…', name:'Smokescreen', cp:1, phases:['shooting'], turn:'opp', needs:{ all:['Smoke'] },
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
      'dread-mob': {
        name:'Dread Mob', dp:1,
        // tableAt: Wahapedia prints the table after "…have the relevant rule(s):", before the hazard-roll line
        rule:{ name:'Try Dat Button!', ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' }, needs:{ all:['Walker'], none:['Titanic'] }, tableAt:1,
          mod:{ kind:'all', when:'Your Shooting phase or the Fight phase, when selected to attack (optional: one D6 or two D6)', note:'1–2 +1 A · 3–4 +2 S · 5–6 +1 AP (two D6: keep re-rolling duplicate results; one hazard roll when the unit has attacked)' },
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
      // Shoota Boyz and Wreckas: Wahapedia wording (Orks, codex; GW publishes no Orks Faction Pack)
      'shoota-boyz': {
        name:'Shoota Boyz', dp:1,
        rule:{ name:'Dakka! Dakka! Dakka!', ph:['movement','shooting'], turn:'either', turns:{ movement:'opp' }, needs:{ all:['Faction: Orks','Infantry'] },
          mod:{ kind:'ranged', when:'Riled up', note:'+3" range' },
          text:'Friendly **ORKS INFANTRY** units’ ranged attacks have:\n- **[ASSAULT]**.\n- While this unit is **riled up**, +3" **R**.' },
        enhancements:[
          { name:'Supa-glowy Fing', pts:25, text:'**ORKS INFANTRY** model only (excluding **WEIRDBOY** models). This model’s ranged attacks have:\n- **[ANTI-INFANTRY 4+]**.\n- **[DEVASTATING WOUNDS]**.\n- **[SUPA-HAZARDOUS]**.\n**[SUPA-HAZARDOUS]:** Each time a unit is **selected to shoot**, after that unit has resolved all of its attacks, make two **hazard rolls** for that unit for each **[SUPA-HAZARDOUS]** weapon you selected in the Select Weapons step.' },
          { name:'Targetin’ Squigs', pts:20, text:'**BIG MEK**/**BIGBOSS**/**WARBOSS** model only. This unit’s ranged attacks (excluding **[TORRENT]** attacks) have +3" **R**.' }
        ],
        stratagems:[
          { id:'kustom-dakka', gist:'Your unit’s ranged attacks have +1 to wound rolls against a unit (excluding MONSTER/VEHICLE units).', name:'Kustom Dakka', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Faction: Orks','Infantry'] },
            mod:{ kind:'ranged', when:'Your Shooting phase, vs non-MONSTER/VEHICLE targets', note:'+1 to wound rolls' },
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
          mod:{ kind:'ranged', when:'Your Shooting phase, this unit or the target within range of an objective', note:'can re-roll hit rolls of 1' },
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
};

/* ---------------- armies ----------------
   Army: id, name, faction (key into FACTIONS), points, pointsUsed, battleSize,
         disposition, detachments (keys), source.
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
        { kind:'ranged', weapon:'Blitzkannon', set:{ A:'+6' }, when:'vs non-MONSTER/VEHICLE targets', note:'in your Shooting phase', from:'Blitz Dem Gitz!' },
        { kind:'ranged', when:'Riled up', note:'[SUSTAINED HITS 1]', from:'Even More Dakka' }
      ],
      aura:[
        { kind:'all', needs:{ all:['Faction: Orks','Walker'] }, when:'Picked by the Dreadherder', note:'re-roll hit rolls of 1 this turn', from:'Dreadherder' }
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
        { kind:'ranged', weapon:'Blitzkannon', set:{ A:'+6' }, when:'vs non-MONSTER/VEHICLE targets', note:'in your Shooting phase', from:'Blitz Dem Gitz!' },
        { kind:'ranged', when:'Riled up', note:'[SUSTAINED HITS 1]', from:'Even More Dakka' }
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
        { kind:'ranged', when:'Riled up', note:'[SUSTAINED HITS 1]', from:'More Dakka' }
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
        { kind:'melee', when:'Made a charge move this turn', note:'+3 A, +2 S', from:'Might is Right' },
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
        { kind:'all', needs:{ all:['Faction: Orks','Vehicle'], none:['Aircraft','Titanic'] }, when:'Picked by a Mek’s Clever Know-wotz', note:'that VEHICLE model’s attacks have +1 to hit rolls until the start of your next Movement phase', from:'Clever Know-wotz' }
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
        { kind:'ranged', when:'Your Shooting phase, this unit or the target within range of an objective', note:'+1 AP', from:'Finderz Keeperz' }
      ],
      aura:[
        { kind:'all', needs:{ all:['Faction: Orks','Vehicle'], none:['Aircraft','Titanic'] }, when:'Picked by a Mek’s Clever Know-wotz', note:'that VEHICLE model’s attacks have +1 to hit rolls until the start of your next Movement phase', from:'Clever Know-wotz' }
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
        { kind:'all', when:'vs units with no T 7+ models', note:'+1 to hit rolls', from:'Spiteful Power Trip' }
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
        { kind:'melee', needs:{ all:['Faction: Orks'] }, when:'Within 6" of Ghazghkull', selfWhen:'Own aura', note:'+1 to hit, +1 to wound', from:'Prophet of Da Great Waaagh!' }
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
        { name:'One Last Kill', ph:['fight'], turn:'either', def:'Destroyed in the Fight phase before being selected to fight: on a 2+ it stays until it has fought or the phase ends', text:'In the Fight phase, when this model is **destroyed**, if this unit has not been **selected to fight** this phase, roll one D6:\n- On a 2+, do not remove this model from the battlefield. When this unit has fought, or at the end of the phase (whichever comes first), this model is removed from the battlefield.' },
        { name:'Da Bigger Dey Iz…', ph:['fight'], turn:'either', text:'This unit’s melee attacks that target a **MONSTER/VEHICLE** unit can re-roll **wound rolls**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'vs MONSTER/VEHICLE', note:'can re-roll wound rolls', from:'Da Bigger Dey Iz…' }
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
        { name:'Arrogant Invulnerability', who:'Meganobz', def:'Attacks that target this unit have -1 AP', text:'Attacks that target this unit have -1 **AP**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Riled up, Fight phase', note:'+1 to hit rolls', from:'Krumpin’ Time' }
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
        { kind:'melee', when:'Made a charge move this turn', note:'+1 AP', from:'Headwoppa’s Killchoppa' }
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
        { kind:'ranged', when:'Ammo Runts used (your Shooting phase, when selected to shoot)', note:'+1 to hit rolls', from:'Ammo Runts' },
        { kind:'melee', weapon:'Kustom Krumpa', when:'Kustom Krumpa of a Nob w/ Paired Krumpas', note:'can re-roll hit rolls and wound rolls', from:'Paired Krumpas' }
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
        { name:'Arrogant Invulnerability', who:'Meganobz', def:'Attacks that target this unit have -1 AP', text:'Attacks that target this unit have -1 **AP**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Riled up, Fight phase', note:'+1 to hit rolls', from:'Krumpin’ Time' }
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
        { kind:'melee', when:'Made a charge move this turn', note:'+1 D', from:'Brutal Impact' }
      ],
      rules:['Waaagh!'],
      kw:['Beast Snagga','Explosives','Faction: Orks','Mobile','Mounted','Squighog Boyz']
    }
  ]
},
];

// core terms (not abilities): kept out of a unit's rule list and the glossary of rules units have
const CONCEPTS = ['Hazard Roll','Mortal Wounds','Battle-shock','Engagement','Selected to Attack','Destroyed','Normal Move','Advance Move','Fall-back Move','Charge','Charge Move','Pile-in Move','Consolidation Move','Benefit of Cover','Strategic Reserves','Ingress Move','Surge Move','Scout Move','Starting Strength','Select Weapons'];

return { version:VERSION, concepts:CONCEPTS, rules:RULES, ruleSrc:RULE_SRC, ruleAliases:RULE_ALIASES, coreStratagems:CORE_STRATAGEMS, factions:FACTIONS, armies:ARMIES };
})();
