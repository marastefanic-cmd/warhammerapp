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

const VERSION = '2026-10-16.12';

/* ---------------- core rules (11th edition) ---------------- */
// Weapon keyword and core ability text, from the BSData wh40k-11e game system
// (Snap Shooting and Actions from Wahapedia's core rules, 15.09 and 16).
const RULES = {
  'Assault': 'Units containing one or more models with an **[ASSAULT]** weapon can shoot using **assault shooting** (10.05).',
  'Blast': 'Each time you gather attack dice for a **[BLAST]** weapon, add one additional **attack dice** for every five models that were in the target unit in the Select Targets step (rounding down). If this ability takes the form **[BLAST X]**, each time you gather **attack dice** for such a weapon, add **X** additional **attack dice** for every five models that were in the target unit in the Select Targets step (rounding down) instead.\n*Example: a [BLAST 2] weapon with A 3 targeting a 12-model unit gathers 4 extra dice, 7 in total.*',
  'Cleave': 'This ability always takes the form **[CLEAVE X]**. Each time you gather **attack dice** for a **[CLEAVE]** weapon, if you only selected one target for all of that weapon’s attacks, add **X** additional **attack dice** for every five models that were in the target unit in the Select Targets step (rounding down).\n*Example: a [CLEAVE 1] weapon with A 3 targeting one 16-model unit gathers 3 extra dice, 6 in total.*',
  'Close-quarters': 'Units containing one or more models with a **[CLOSE-QUARTERS]** weapon can shoot using **close-quarters shooting** (10.06). When using another **shooting type**, for each model in that unit (excluding **MONSTER/VEHICLE** models), you can only select one of the following to make attacks with:\n- One or more of its **[CLOSE-QUARTERS]** weapons.\n- One or more of its other ranged weapons.\n*[PISTOL] and [CLOSE-QUARTERS] are identical for all rules purposes.*',
  'Devastating Wounds': 'Each time an attack made with a **[DEVASTATING WOUNDS]** weapon results in a **critical wound**, the attack sequence for that attack ends and the target unit suffers a number of **mortal wounds** equal to the **D** characteristic of that weapon. These are inflicted after resolving any normal damage inflicted by those attacks.\n**Mortal wounds** inflicted by **[DEVASTATING WOUNDS]** weapons can damage a maximum of one model for each **critical wound**; any remaining **mortal wounds** inflicted by that attack are lost.',
  'Extra Attacks': 'Each time a unit containing one or more models with an **[EXTRA ATTACKS]** weapon fights, those models will make attacks with those weapons in addition to any others. In the Select Weapons step (04.01), for each of those models, you must select:\n- All of that model’s **[EXTRA ATTACKS]** weapons.\n- One of that model’s other melee weapons, if possible.',
  'Hazardous': 'Each time a unit is **selected to shoot** or **selected to fight**, after that unit has resolved all of its attacks, make a number of **hazard rolls** (06.03) for that unit equal to the number of **[HAZARDOUS]** weapons you selected in the Select Weapons step.',
  'Ignores Cover': 'Each time an attack is made with an **[IGNORES COVER]** weapon, the target cannot have the **benefit of cover** against that attack (13.08), including from rules that give a model or unit the **benefit of cover** (e.g. **Stealth**).',
  'Lethal Hits': 'Each time an attack made with a **[LETHAL HITS]** weapon results in a **critical hit**, you can choose for that attack to automatically wound the target.\n*Designer’s note: choosing to automatically wound means no wound roll is made, so that attack cannot become a critical wound and cannot trigger rules such as [DEVASTATING WOUNDS].*\n*App note, not rules text: the suffix “: non-MONSTER/VEHICLE” reads as applying only against targets that are not MONSTER or VEHICLE units.*',
  'Precision': 'While resolving attacks made with one or more **[PRECISION]** weapons, at the start of the Allocation Order step (05.03), if the target unit contains one or more **CHARACTER** models **visible** to one or more of the attacking models, the active player can select one allocation group that contains one of those **visible CHARACTER** models. If they do, until those attacks are resolved, or until that **CHARACTER** group is **destroyed** (whichever happens first), that **CHARACTER** group is the current allocation group.',
  'Rapid Fire': 'This ability always takes the form **[RAPID FIRE X]**. Each time you gather **attack dice** for a **[RAPID FIRE]** weapon, add **X** additional **attack dice** if the target unit was within half range of that weapon in the Select Targets step.',
  'Sustained Hits': 'This ability always takes the form **[SUSTAINED HITS X]**. Each time an attack made with a **[SUSTAINED HITS]** weapon results in a **critical hit**, that attack results in a number of additional hits on the target as denoted by **X**.',
  'Torrent': 'Each time an attack is made with a **[TORRENT]** weapon, that attack automatically hits the target.',
  'Twin-linked': 'Each time an attack is made with a **[TWIN-LINKED]** weapon, you can re-roll the **wound roll**.',
  'Anti': 'This ability always takes the form **[ANTI-X Y+]**. Each time an attack is made with an **[ANTI]** weapon, if the target unit has the keyword denoted by **X**, an unmodified **wound roll** of **Y+** is a **critical wound**.\n*Example: [ANTI-VEHICLE 4+] against a VEHICLE unit is a critical wound on an unmodified 4+.*',
  'Hunter': 'New Recruit prints these weapons as two profiles, one marked **Hunter: MONSTER/VEHICLE**. This app reads that as: use the Hunter profile when the target is a **MONSTER** or **VEHICLE** unit, and the Standard profile against everything else.\n*App note, not rules text: the Hunter rule itself is not in this app’s sources, so check the datasheet if a ruling depends on it.*',

  'Deep Strike': 'Each time this unit makes an **ingress move** (20.04), if every model in this unit has this ability, it can be set up anywhere on the battlefield that is more than 8" horizontally from all enemy units, even if that is within your opponent’s deployment zone.',
  'Deadly Demise': 'This ability always takes the form **Deadly Demise X**. Each time a model in this unit is **destroyed**, after the units embarked within it (if any) have made their **emergency disembark moves**, roll one D6. On a 6, that model suffers a **deadly demise**; each unit within 6" of that model suffers a number of **mortal wounds** denoted by **X** (if this is a random number, roll separately for each unit within 6").',
  'Feel No Pain': 'This ability always takes the form **Feel No Pain X+**. Each time a model with this ability would lose a wound, roll one D6: on an **X+**, that wound is not lost.',
  'Leader': 'Before the battle, in the Muster Armies step, for each leader and support unit in your army, you can select one friendly bodyguard unit that unit can lead. That unit will then lead that bodyguard unit for the battle and form an attached unit with it. Unless otherwise stated, each bodyguard unit can only have one leader unit and one support unit attached to it.',
  'Lone Operative': 'Unless part of an **attached** unit, this unit is not **visible** to enemy models unless they are within 12" of this unit, and it cannot be targeted by **[INDIRECT FIRE]** weapons unless the attacking model is within 12" of this unit.',
  'Fights First': 'While every model in a unit has this ability, that unit is a **Fights First** unit.\nSee the Resolve Fights First Combats step in the Fight phase (12.04).',
  'Actions': 'A unit is eligible to start an action unless one or more of the following apply to that unit:\n- It is not on the battlefield.\n- It is an **AIRCRAFT**/**FORTIFICATION** unit.\n- It is battle-shocked.\n- It has an OC characteristic of 0 or ‘-’.\n- It is engaged (unless it is a **TITANIC** unit).\n- It made an advance or fall-back move this turn.\n- It started another action this turn.\nIf a unit starts an action, until the end of the turn:\n- It is not eligible to shoot (excluding **TITANIC** units).\n- It is not eligible to declare a charge.\nIf a unit performing an action makes a move (excluding pile-in and consolidation moves) or leaves the battlefield, that unit does not complete that action. Otherwise, when an action is completed, its ‘Effect’ section is triggered.',
  'Snap Shooting': 'ELIGIBLE IF: As stated in the rule allowing this shooting type.\nEFFECT: Your unit shoots as described in Making Attacks (04).\nWHILE SHOOTING:\n- You can only target one visible enemy unit within 24" of your unit (and only if it is an eligible target).\n- Each attack only hits on an unmodified hit roll of 6 (irrespective of the attacking weapon’s BS characteristic or any modifiers).\n- You cannot re-roll hit rolls.\nAFTER SHOOTING: Until the end of the phase, your unit is not eligible to start an action.',
  'Mobile': 'Models with the **MOBILE** keyword can move horizontally through **dense terrain features** (13.06).\n*App note, not rules text: taken from the designer\u2019s note under Super-Heavy Walker; check the core rules for the full MOBILE rule.*',
  'Lance': 'Each time an attack is made with a **[LANCE]** weapon, if the attacking model’s unit made a **charge move** this turn, add 1 to the **wound roll**.',
  'Melta': 'This ability always takes the form **[MELTA X]**. Each time a model makes an attack with a **[MELTA]** weapon, if the target unit was within half range of that weapon in the Select Targets step, until the attacking unit’s attacks have been resolved, add **X** to that weapon’s **D** characteristic.\n*Example: A model targets a unit that is within half range of a [MELTA 2] weapon with a D characteristic of D6. While resolving those attacks, that weapon has a D characteristic of D6+2.*',
  'Super-Heavy Walker': 'Each time a unit with this ability makes a **normal**, **advance** or **fall-back move**:\n- Models in that unit can move through models (including **MONSTER/VEHICLE** models, but excluding **TITANIC** models) and can move horizontally through sections of **terrain features** that are 4" or less in height.\n- Before moving that unit, you can select for all models in that unit to have the **MOBILE** keyword until that move ends. If you do, when that move ends, roll one D6: on a 1, that unit is battle-shocked.\n*Designer’s Note: Gaining the MOBILE keyword for the duration of a move will enable models in that unit to move horizontally through dense terrain features (13.06).*',
  'Firing Deck': 'This ability always takes the form **Firing Deck X**. In your Shooting phase, each time this **TRANSPORT** is **selected to shoot**, if one or more units are embarked within it, resolve the following sequence:\n- 1. Select up to **X** models embarked within this **TRANSPORT** (excluding models whose units have already been **selected to shoot** this phase).\n- 2. For each selected model, select one of its ranged weapons (excluding **[ONE SHOT]** weapons).\n- 3. Until this **TRANSPORT** has resolved all of its attacks, it has all of those selected weapons in addition to its other weapons.\n- 4. Until the end of the turn, units embarked within this **TRANSPORT** are not eligible to shoot.',
  'Scouts': 'This ability always takes the form **Scouts X"**. In the Resolve Pre-battle Abilities step, if every model in a unit has this ability, you can do one of the following:\n- If that unit is in **strategic reserves**, you can set up that unit anywhere that is wholly within your deployment zone.\n- If that unit is wholly within your deployment zone, it can make a **scout move**.\n- If that unit is embarked within a **DEDICATED TRANSPORT** that is wholly within your deployment zone, and if every model embarked within that **DEDICATED TRANSPORT** has the Scouts ability, that **DEDICATED TRANSPORT** can make a **scout move**.',
  'Psychic': 'Each time an attack is made with a **[PSYCHIC]** weapon, you can ignore any or all modifiers to that attack’s **BS** or **WS** characteristic and any or all modifiers to the **hit roll**. Attacks made with **[PSYCHIC]** weapons are known as **psychic attacks** (this can be important for the triggering of other rules).',
  'Harpooned': 'When this unit **declares a charge**, if an enemy **MONSTER/VEHICLE** unit is within 12" of this unit and was hit by an attack made by this weapon this turn, you can use this ability. If you do:\n- This unit has +2 to **charge rolls** until the end of the phase.\n- This unit must end that **charge move engaged** with that **MONSTER/VEHICLE** unit.'
};

// Which RULES entry a keyword or rule chip opens ("RAPID FIRE 4" -> "Rapid Fire").
const RULE_ALIASES = [
  [/^anti-/i, 'Anti'], [/^blast/i, 'Blast'], [/^cleave/i, 'Cleave'], [/^close-quarters/i, 'Close-quarters'],
  [/^pistol/i, 'Close-quarters'], [/^devastating/i, 'Devastating Wounds'], [/^extra attacks/i, 'Extra Attacks'],
  [/^hazardous/i, 'Hazardous'], [/^ignores cover/i, 'Ignores Cover'], [/^lethal hits/i, 'Lethal Hits'],
  [/^precision/i, 'Precision'], [/^rapid fire/i, 'Rapid Fire'], [/^sustained hits/i, 'Sustained Hits'],
  [/^torrent/i, 'Torrent'], [/^twin-linked/i, 'Twin-linked'], [/^assault/i, 'Assault'],
  [/^deep strike/i, 'Deep Strike'], [/^deadly demise/i, 'Deadly Demise'], [/^feel no pain/i, 'Feel No Pain'],
  [/^leader/i, 'Leader'], [/^lone operative/i, 'Lone Operative'], [/^mobile/i, 'Mobile'], [/^hunter/i, 'Hunter'], [/^snap shooting/i, 'Snap Shooting'],
  [/^fights first/i, 'Fights First'], [/^actions?$/i, 'Actions'],
  [/^melta/i, 'Melta'], [/^lance/i, 'Lance'], [/^super-heavy walker/i, 'Super-Heavy Walker'],
  [/^firing deck/i, 'Firing Deck'], [/^scouts/i, 'Scouts'],
  [/^psychic$/i, 'Psychic'],
  [/^harpooned$/i, 'Harpooned']
];

/* ---------------- core stratagems ----------------
   Wahapedia wording (Core Rules, 11th edition, section 15).
   needs: { all, any, none } keyword lists a unit must match to use it.   */
const CORE_STRATAGEMS = [
  { id:'command-re-roll', name:'Command Re-roll', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either',
    when:'Any phase, just after you make one of the following rolls for a friendly unit or model:\n- Advance roll\n- Charge roll\n- Damage roll\n- Hazard roll\n- Hit roll\n- Save roll\n- Wound roll\n- A roll to determine the number of attacks generated with a weapon.',
    target:'That unit or model.',
    effect:'You re-roll that roll. If you are rolling more than one dice together, select one of those dice to re-roll (excluding charge rolls, which you must re-roll in full).' },
  { id:'epic-challenge', name:'Epic Challenge', cp:1, phases:['fight'], turn:'either', needs:{ all:['Character'] },
    when:'Fight phase, just after a friendly **CHARACTER** unit is selected to fight.',
    target:'That **CHARACTER** unit.',
    effect:'Select one **CHARACTER** model in your unit. Until the end of the phase, that model’s melee weapons have the **[PRECISION]** ability.' },
  { id:'insane-bravery', name:'Insane Bravery', cp:1, phases:['command'], turn:'your', limit:'Once per battle',
    when:'Battle-shock step of your Command phase, just before you make a battle-shock roll for a friendly unit.',
    target:'That unit.',
    effect:'That battle-shock roll is automatically successful.',
    restrictions:'You cannot use this stratagem more than once per battle.' },
  { id:'explosives', name:'Explosives', cp:1, phases:['shooting'], turn:'your', needs:{ any:['Explosives','Grenades'] },
    when:'Your Shooting phase.',
    target:'One friendly unengaged **EXPLOSIVES/GRENADES** unit that is eligible to shoot and did not make an advance move this turn.',
    effect:'Resolve the following sequence:\n- 1. Select one **EXPLOSIVES/GRENADES** model in your unit.\n- 2. Select one unengaged enemy unit within 8" of and visible to that model.\n- 3. Roll six D6: for each 4+, that enemy unit suffers 1 mortal wound (06.02).' },
  { id:'crushing-impact', name:'Crushing Impact', cp:1, phases:['charge'], turn:'your', needs:{ any:['Monster','Vehicle'] },
    when:'Your Charge phase, just after a friendly **MONSTER/VEHICLE** unit ends a charge move.',
    target:'That **MONSTER/VEHICLE** unit.',
    effect:'Resolve the following sequence:\n- 1. Select one enemy unit engaged with your unit.\n- 2. Select one model in your unit engaged with that enemy unit.\n- 3. Roll a number of D6 equal to the **T** characteristic of that model: for each 1, your unit suffers 1 mortal wound; for each 5+, that enemy unit suffers 1 mortal wound (to a maximum of 6 mortal wounds per unit).' },
  { id:'rapid-ingress', name:'Rapid Ingress', cp:1, phases:['movement'], turn:'opp', needs:{ none:['Aircraft'] },
    when:'End of your opponent’s Movement phase.',
    target:'One friendly unit that is in strategic reserves (excluding **AIRCRAFT**).',
    effect:'Your unit makes an ingress move (20.04).',
    restrictions:'You cannot use this stratagem during the first battle round.' },
  { id:'fire-overwatch', name:'Fire Overwatch', cp:1, phases:['movement'], turn:'opp', needs:{ none:['Titanic'] },
    when:'End of your opponent’s Movement phase.',
    target:'One friendly unengaged unit (excluding **TITANIC** units).',
    effect:'Your unit shoots using **snap shooting**.' },
  { id:'smokescreen', name:'Smokescreen', cp:1, phases:['shooting'], turn:'opp', needs:{ all:['Smoke'] },
    when:'Start of your opponent’s Shooting phase.',
    target:'One friendly **SMOKE** unit.',
    effect:'Until the end of the phase, each time an attack targets either your **SMOKE** unit, or a unit that is not fully visible to the attacking model because of one or more models in your **SMOKE** unit, the target has the benefit of cover against that attack (13.08).' },
  { id:'heroic-intervention', name:'Heroic Intervention', cp:1, cpNote:'Into the Fray +1CP', phases:['charge'], turn:'opp',
    when:'End of your opponent’s Charge phase.',
    target:'One friendly unengaged unit within 12" of one or more enemy units. You can only select a **VEHICLE** unit if it is a **CHARACTER/WALKER** unit.',
    effect:'Resolve a charge with your unit (11.02). While doing so, before making the charge roll, you must select one of the following modes:\n- **Leap to Defend:** When selecting charge targets, you can only select enemy units that made a charge move this phase and are within the maximum distance.\n- **Into the Fray (+1CP):** When making the charge roll, if the result is greater than 6 (after modifiers), change it to 6. When selecting charge targets, you can select any enemy units that are within 6" of your unit and within the maximum distance.' },
  { id:'counteroffensive', name:'Counteroffensive', cp:2, phases:['fight'], turn:'opp',
    when:'Fight step of your opponent’s Fight phase, just after an enemy unit has resolved its attacks.',
    target:'One friendly unit that is eligible to fight.',
    effect:'Until the end of the phase, your unit has the **Fights First** ability and it must be the next unit you select to fight (12.04).' }
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
          { ph:['charge'], turn:'your', text:'Riled up: a unit that advanced can still declare a charge.' }
        ],
        text:'Friendly **ORKS** units with this ability can:\n- Re-roll **advance rolls**.\n- Become **riled up**, as stated in other rules.\nWhile a unit is **riled up**:\n- That unit has 5+ **InSv**.\n- That unit’s ranged attacks have **[ASSAULT]**.\n- When that unit is selected to make an **advance move**, that **advance move** does not prevent that unit from being **eligible to declare a charge**.' },
      { name:'War Cry', tag:'Once per battle, per army', ph:['command'], turn:'either',
        text:'At the start of the Command phase, you can use this ability. If you do, friendly **ORKS** units with the **Waaagh!** ability are **riled up** until the end of the next turn.' },
      { name:'Da Boss', ph:['command'], turn:'either',
        text:'At the start of the battle round, if a model with this ability is your **WARLORD**, gain 1CP.' }
    ],
    detachments: {
      'brute-bosses': {
        name:'Brute Bosses', dp:1,
        rule:{ name:'’Ard As Nails', ph:['fight'], turn:'either', needs:{ all:['Warboss'] },
          text:'When a friendly **WARBOSS** model is **destroyed**, if this unit has not been **selected to fight** this phase, roll one D6, with +1 to the roll if your unit is **riled up**:\n- On a 3+, do not remove this **WARBOSS** model from the battlefield. When this unit has fought, or at the end of the phase (whichever comes first), this **WARBOSS** model is removed from the battlefield.' },
        enhancements:[
          { name:'Brutal But Kunnin’', pts:30, text:'**WARBOSS** model only. This model’s melee attacks have +1 **D**.' },
          { name:'Da Gobshot Thunderbuss', pts:20, text:'**WARBOSS** model only. This model has the following weapon:\n- Da Gobshot Thunderbuss: 24" A6 BS4+ S7 AP-2 D2 [LETHAL HITS: non-MONSTER/VEHICLE, RAPID FIRE 6]' },
          { name:'Blitzboss', pts:20, text:'**WARBOSS** model only. A **TRANSPORT** unit (excluding **WALKER** units) this unit is embarked within has:\n- +2" **M**.\n- 5+ **InSv**.' },
          { name:'Proper Killy', pts:15, text:'**WARBOSS** model only. This model can re-roll **hit rolls** of 1.' },
          { name:'Morgog’s Finkin’ Cap', pts:50, text:'**WARBOSS** model only. (Once per battle, per army) At the end of your opponent’s Movement phase, if this unit is **unengaged**, this unit can make a **normal move** of:\n- Up to D6".\n- If this unit is **riled up**, you can re-roll that D6.' },
          { name:'Surly As A Squiggoth', pts:25, text:'**INFANTRY WARBOSS** model only. (Once per battle, per army) At the end of a phase in which this model is **destroyed**, roll one D6:\n- On a 2+, set this model back up on the battlefield as close as possible to where it was **destroyed**, **unengaged**, with 3 wounds remaining.' }
        ],
        stratagems:[]
      },
      'da-big-hunt': {
        name:'Da Big Hunt', dp:1,
        rule:{ name:'Da Hunt Is On', ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' }, needs:{ all:['Beast Snagga'] },
          // hunter: added to the Hunter profiles, which are only used against MONSTER/VEHICLE units
          mod:{ kind:'all', when:'vs MONSTER/VEHICLE', note:'+1 AP', hunter:{ AP:1 } },
          text:'Friendly **BEAST SNAGGA** units’ attacks that target a **MONSTER/VEHICLE** unit have +1 **AP**.' },
        enhancements:[
          { name:'Glory Hog', pts:25, text:'**BEAST SNAGGA** model only. When this unit is selected to make a **fall-back move**, that **fall-back move** does not prevent this unit from being **eligible to declare a charge**.' },
          { name:'It Came From Da Drops', pts:20, text:'**BEASTBOSS ON SQUIGOSAUR** model only. This model has +1 **T**.' }
        ],
        stratagems:[
          { id:'where-dya-fink', name:'Where D’ya Fink You’re Going?', cp:1, phases:['movement'], turn:'opp', needs:{ all:['Beast Snagga'] },
            when:'Your opponent’s Movement phase, when an enemy unit is selected to make a fall-back move, if that enemy unit is engaged with a friendly **BEAST SNAGGA** unit.',
            target:'That **BEAST SNAGGA** unit.',
            effect:'When an enemy unit engaged with your unit is selected to make a fall-back move, that enemy unit must use the desperate escape mode. If that enemy unit is a **MONSTER/VEHICLE** unit, that enemy unit makes three additional hazard rolls for each **BEAST SNAGGA** unit it is engaged with, with -1 from those hazard rolls if that enemy unit is battle-shocked.' },
          { id:'goaded-into-action', name:'Goaded Into Action', cp:1, phases:['shooting'], turn:'opp', needs:{ all:['Beast Snagga'] },
            when:'Your opponent’s Shooting phase, when an enemy unit has shot.',
            target:'One friendly unengaged **BEAST SNAGGA** unit that lost a wound as a result of those attacks.',
            effect:'Your unit can make a surge move of up to D6". If your unit is riled up, it can re-roll that D6.' },
          { id:'instinctive-hunters', name:'Instinctive Hunters', cp:1, phases:['fight'], turn:'opp', needs:{ all:['Beast Snagga'] },
            when:'End of your opponent’s Fight phase.',
            target:'One friendly unengaged **BEAST SNAGGA** unit within 6" of a battlefield edge.',
            effect:'Place your unit in strategic reserves.' }
        ]
      },
      'dread-mob': {
        name:'Dread Mob', dp:1,
        rule:{ name:'Try Dat Button!', ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' }, needs:{ all:['Walker'], none:['Titanic'] },
          mod:{ kind:'all', when:'Optional D6', note:'1–2 +1 A · 3–4 +2 S · 5–6 +1 AP (2 D6: two effects, then a hazard roll)' },
          text:'In your Shooting phase or the Fight phase, when a friendly **ORKS WALKER** unit (excluding **TITANIC** units) is **selected to attack**, you can use this ability. If you do, roll either one D6 or two D6 (keep re-rolling duplicate results). This unit’s attacks have the relevant rule(s):\nIf you rolled two D6, when this unit has attacked, this unit makes one **hazard roll**.',
          table:[['1–2','+1 **A**'],['3–4','+2 **S**'],['5–6','+1 **AP**']] },
        enhancements:[
          { name:'Cybork Boosta', pts:10, text:'**BIG MEK/MEK** model only. This model has +2" **M**.' },
          { name:'Dreadherder', pts:30, text:'**BIG MEK** model only. While this model is within 3" of a friendly **ORKS WALKER** unit (excluding **BIG MEK** units):\n- This model has **Lone Operative**.\n- In your Shooting phase, you can select one friendly **ORKS WALKER** unit within 3" of this model. That unit’s attacks can re-roll **hit rolls** of 1 until the end of the turn.' }
        ],
        stratagems:[
          { id:'crazed-rampage', name:'Crazed Rampage', cp:1, phases:['fight'], turn:'either', needs:{ all:['Walker'], none:['Titanic'] },
            note:'Wahapedia shows DEFF DREAD struck through, but current guides (Tabletop Battles, 1d6chan) still give Deff Dreads the +3. No unit in this list has DEFF DREAD either way, so here the roll is a 4+.',
            when:'Fight phase, when an enemy unit targets a friendly **ORKS WALKER** unit (excluding **TITANIC** units).',
            target:'That **ORKS WALKER** unit.',
            effect:'When a model in your unit is destroyed, if your unit has not been selected to fight this phase, roll one D6, with +3 to the result if your unit has ~~**DEFF DREAD**~~:\n- On a 4+, do not remove that model from the battlefield. When your unit has fought, or at the end of the phase (whichever comes first), that model is removed from the battlefield.' },
          { id:'dread-power', name:'Dread Power', cp:1, phases:['movement'], turn:'your', needs:{ all:['Walker'] },
            when:'Your Movement phase.',
            target:'One friendly **ORKS WALKER** unit.',
            effect:'Your unit is riled up until the start of your next turn.' },
          { id:'stomping-juggernaut', name:'Stomping Juggernaut', cp:1, phases:['movement','charge'], turn:'your', needs:{ all:['Walker'] },
            when:'Your Movement/Charge phase, when a friendly **ORKS WALKER** unit is selected to move or declares a charge.',
            target:'That **ORKS WALKER** unit.',
            effect:'Your unit has **MOBILE**.' }
        ]
      }
    }
  },
  'imperial-knights': {
    name: 'Imperial Knights',
    // words players use for a rule that has another name
    aliases: [[/^oath/i, 'Code Chivalric'], [/^honoured/i, 'Code Chivalric']],
    armyRules: [
      { name:'Code Chivalric',
        // the Deed and Quality tables the text refers to are not in this list's sources
        missing:['Deeds table','Qualities table'],
        text:'If your Army Faction is **IMPERIAL KNIGHTS**, at the end of the Read Mission Objectives step, you must determine your army’s Oath for the coming battle. An Oath consists of two parts - one Deed and one Quality. There are three options for each part.\nTo determine your army’s Deed, you can either select one Deed or you can randomly select one Deed by rolling a D6 and consulting the relevant table. The selected Deed will describe what needs to be achieved in order to complete that Deed.\nTo determine your army’s Quality, you can either select one Quality or you can randomly select one Quality by rolling a D6 and consulting the relevant table. Until the end of the battle, the ability described in the Quality selected applies to all models in your army with this ability.\nThe first time your selected Deed is completed your Oath is fulfilled and, until the end of the battle, your army becomes Honoured and you gain 2CP, or 3CP if you randomly selected your Deed and/or Quality (CP gained in this way are an exemption to the Core Rules that limit the maximum number of CP you can gain per battle round to 1).' },
      { name:'Bondsman', ph:['command'], turn:'your',
        text:'Some **IMPERIAL KNIGHTS** models have a Bondsman ability, tagged with the word ‘Bondsman’. In your Command phase, one or more models from your army with a Bondsman ability can use that ability. For each one that does, select one friendly **ARMIGER** model within 12" of that model (you cannot select an **ARMIGER** model that is already being affected by a Bondsman ability). Until the start of your next Command phase, that **ARMIGER** model is affected by that Bondsman ability.' }
    ],
    detachments: {
      'freeblade-company': {
        name:'Freeblade Company', dp:3,
        // rule wording from the New Recruit Rules page (the Wahapedia detachment page is not in the packet)
        rule:{ name:'Knights of Legend', ph:['command'], turn:'your', needs:{ all:['Faction: Imperial Knights'] },
          // proposed: the app adds this to the "When targeted" line of every unit the rule applies to
          def:'Feel No Pain 6+',
          text:'**IMPERIAL KNIGHTS** models from your army have the **Feel No Pain 6+** ability. In addition, at the start of your Command phase, each **IMPERIAL KNIGHTS** model from your army regains 1 lost wound.' },
        enhancements:[],
        missing:['enhancements'],
        stratagems:[
          { id:'noble-sacrifice', name:'Noble Sacrifice', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Faction: Imperial Knights'] },
            when:'Any phase.',
            target:'One **IMPERIAL KNIGHTS** unit from your army that was just destroyed. You can target that unit with this Stratagem even though it was just destroyed.',
            effect:'Your unit’s **Deadly Demise** ability inflicts **mortal wounds** on a D6 roll of 4+, adding 1 to the result if it is an **ARMIGER** unit, instead of only a 6.' },
          { id:'strength-from-exile', name:'Strength from Exile', cp:1, phases:['shooting','fight'], turn:'either', turns:{ shooting:'your' }, needs:{ all:['Faction: Imperial Knights'] },
            when:'Your Shooting phase or the Fight phase.',
            target:'One **IMPERIAL KNIGHTS** unit from your army that has not been selected to shoot or fight this phase.',
            effect:'Until the end of the phase, each time a model in your unit makes an attack, if there are no other friendly units within 9" of your unit, re-roll a **Hit roll** of 1 and re-roll a **Wound roll** of 1.' },
          { id:'full-tilt', name:'Full Tilt', cp:1, phases:['movement'], turn:'your', needs:{ all:['Faction: Imperial Knights'] },
            note:'Wahapedia shows DESTRIER struck through. Current guides (Tabletop Battles, 1d6chan) read it as Destriers getting 9", which is how most players will play your Knight Destriers. Check with your opponent.',
            when:'Your Movement phase.',
            target:'One **IMPERIAL KNIGHTS** unit from your army.',
            effect:'Until the end of the phase, if your unit Advances, do not make an Advance roll for it. Instead, until the end of the phase, add 6" to the Move characteristic of models in your unit, or 9" instead if your unit is an **ARMIGER** or ~~**DESTRIER**~~ unit.' },
          { id:'point-blank-barrage', name:'Point-Blank Barrage', cp:1, phases:['shooting'], turn:'your', needs:{ all:['Faction: Imperial Knights'] },
            when:'Your Shooting phase.',
            target:'One **IMPERIAL KNIGHTS** unit from your army that has not been selected to shoot this phase.',
            effect:'Until the end of the phase, when making ranged attacks with Blast weapons, models in your unit can target enemy units within **Engagement Range** of your unit (provided no other friendly units are also within Engagement Range of that enemy unit). In addition, until the end of the phase, your unit does not suffer the penalty to its **Hit rolls** for being within Engagement Range of one or more enemy units, but each time a model in your unit makes an attack with a Blast weapon that targets a unit within Engagement Range of your unit, on an unmodified Hit roll of 1, your unit suffers 1 **mortal wound** after all of its attacks have been resolved.' },
          { id:'survivor-of-strife', name:'Survivor of Strife', cp:1, phases:['shooting'], turn:'opp', needs:{ all:['Faction: Imperial Knights'] },
            when:'Your opponent’s Shooting phase, just after an enemy unit has selected its targets.',
            target:'One **IMPERIAL KNIGHTS** unit from your army that was selected as the target of one or more of the attacking unit’s attacks.',
            effect:'Until the end of the phase, each time an attack targets your unit, if the Strength characteristic of that attack is greater than the Toughness characteristic of your unit, subtract 1 from the **Wound roll**.' },
          { id:'flanking-manoeuvres', name:'Flanking Manoeuvres', cp:1, phases:['fight'], turn:'opp', needs:{ all:['Armiger'] },
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
    armyRules: [
      // The Blessings themselves (the "Blessings of Khorne Reference" table) are not in the sources.
      { name:'Blessings of Khorne', ph:['command'], turn:'either',
        text:'If your Army Faction is **WORLD EATERS**, at the start of the battle round, you can make a Blessings of Khorne roll. To do so, roll eight D6. You can then use those dice to activate up to two Blessings of Khorne. Each Blessing of Khorne specifies the dice results it requires (where a number is specified, a double or triple of that value or higher is required). You can only activate each Blessing of Khorne once per battle round. Any unused dice from the Blessings of Khorne roll are then discarded. Once activated, each Blessing of Khorne applies to all units from your army with this ability until the end of the battle round.\n*Example: Ash makes their Blessings of Khorne roll and gets the following dice: 1, 2, 2, 2, 3, 4, 6, 6.*\n*First they use the two 6s to activate Warp Blades (which requires a double 5+), leaving the following dice: 1, 2, 2, 2, 3, 4.*\n*They then use the two 2s to activate Wrathful Devotion (which requires any double), leaving the following dice: 1, 2, 3, 4.*\n*However, now that they have activated two Blessings of Khorne, they cannot activate any more and the remaining dice are discarded.*' }
    ],
    detachments: {
      'berzerker-warband': {
        name:'Berzerker Warband', dp:2,
        // rule text from the New Recruit Rules page (the Wahapedia pages for this detachment's rule and enhancements are not in the packet)
        rule:{ name:'Relentless Rage', ph:['fight'], turn:'either', needs:{ all:['Faction: World Eaters'] },
          mod:{ kind:'melee', when:'Always', note:'+1 A' },
          text:'Friendly **WORLD EATERS** units’ melee attacks have +1 **A**.' },
        // only the three taken in this list, text from their New Recruit cards; points not printed
        enhancements:[
          { name:'Helm of Brazen Ire', text:'Each time an attack is allocated to the bearer, subtract 1 from the Damage characteristic of that attack.' },
          { name:'Berzerker Glaive', text:'Add 1 to the Attacks and Damage characteristics of melee weapons (excluding Extra Attacks weapons) equipped by the bearer.' },
          { name:'Battle-lust', text:'You can re-roll Charge rolls made for the bearer’s unit. In addition, while the Unbridled Bloodlust Blessing of Khorne is active for your army, add 1 to Charge rolls made for the bearer’s unit.' }
        ],
        missing:['enhancements'],
        stratagems:[
          { id:'blood-offering', name:'Blood Offering', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either',
            when:'Any phase.',
            target:'One **WORLD EATERS** unit from your army that was just destroyed while it was within range of one or more objective markers you controlled at the end of the previous phase. You can use this Stratagem on that unit even though it was just destroyed.',
            effect:'Select one of those objective markers. That objective marker remains under your control until your opponent’s Level of Control over that objective marker is greater than yours at the end of a phase.' },
          { id:'hack-and-slash', name:'Hack and Slash', cp:1, phases:['fight'], turn:'either',
            when:'Fight phase.',
            target:'One **WORLD EATERS** unit from your army that has not been selected to fight this phase and that made a charge move this turn.',
            effect:'Until the end of the phase, improve the Armour Penetration characteristic of melee weapons equipped by models in your unit by 1.' },
          { id:'frenzied-resilience', name:'Frenzied Resilience', cp:2, phases:['fight'], turn:'either',
            when:'Fight phase, just after an enemy unit has selected its targets.',
            target:'One **WORLD EATERS** unit from your army that was selected as the target of one or more of the attacking unit’s attacks.',
            effect:'Until the end of the phase, each time an attack is allocated to a model in your unit, subtract 1 from the Damage characteristic of that attack.' },
          { id:'skulls-for-the-skull-throne', name:'Skulls for the Skull Throne!', cp:1, phases:['fight'], turn:'either',
            when:'Fight phase, just after a **WORLD EATERS** unit from your army destroys a **CHARACTER** or **MONSTER** model.',
            target:'That **WORLD EATERS** unit.',
            effect:'Make a **Blessings of Khorne roll** and use the results to activate one Blessing of Khorne. Until the end of the battle round, that Blessing of Khorne is active in addition to any other Blessings of Khorne that are currently active.' },
          // New Recruit gives the Khorne Berzerkers the keyword "Berzerkers"
          { id:'apoplectic-frenzy', name:'Apoplectic Frenzy', cp:1, phases:['movement'], turn:'your', needs:{ all:['Berzerkers'] },
            when:'Your Movement phase, just after a **KHORNE BERZERKERS** unit from your army is selected to Advance.',
            target:'That **KHORNE BERZERKERS** unit.',
            effect:'Until the end of the turn, your unit is eligible to declare a charge in a turn in which it Advanced.' },
          { id:'berzerkers-wrath', name:'Berzerker’s Wrath', cp:1, phases:['shooting'], turn:'opp', needs:{ all:['Berzerkers'] },
            when:'Your opponent’s Shooting phase, just after an enemy unit has shot.',
            target:'One **KHORNE BERZERKERS** unit from your army that can make a surge move as a result of those attacks.',
            effect:'Do not roll a D6 to determine how far models in your unit can move when they make a surge move. Instead, when making a surge move, those models can move up to 8".' }
        ]
      },
      'vessels-of-wrath': {
        name:'Vessels of Wrath', dp:1,
        rule:{ name:'Wrath of Khorne', ph:['fight'], turn:'either', needs:{ all:['Character'], none:['Epic Hero'] },
          mod:{ kind:'melee', when:'When selected to fight', note:'CHARACTER models: [CLEAVE 1] or +1 AP' },
          text:'When a friendly **WORLD EATERS CHARACTER** unit (excluding **EPIC HERO** units) is **selected to fight**, that unit’s **CHARACTER** models’ melee attacks can have:\n- **[CLEAVE 1]**.\n- Or: +1 **AP**.' },
        enhancements:[
          { name:'Archslaughterer', pts:30, text:'**WORLD EATERS** model only. (Once per battle, per army) In your Command phase, you can use this ability. If you do, every **Blessing of Khorne** is active for this unit until the start of your next turn.' },
          { name:'Gateways to Glory', pts:10, text:'**WORLD EATERS DAEMON PRINCE** model only. This model has:\n- **MOBILE**.\n- +1 to **charge rolls**.' }
        ],
        stratagems:[
          { id:'scorn-the-witch', name:'Scorn the Witch', cp:1, phases:['command','movement','shooting','charge','fight'], turn:'either', needs:{ all:['Character'], none:['Epic Hero'] },
            when:'Any phase, when a friendly **WORLD EATERS CHARACTER** unit (excluding **EPIC HERO** units) suffers a mortal wound.',
            target:'That **WORLD EATERS CHARACTER** unit.',
            effect:'Your unit has **Feel No Pain 4+** against mortal wounds.' },
          { id:'aspire-to-infamy', name:'Aspire to Infamy', cp:1, phases:['fight'], turn:'either', needs:{ all:['Character'], none:['Epic Hero'] },
            when:'Fight phase, when a friendly **WORLD EATERS CHARACTER** unit (excluding **EPIC HERO** units) is selected to fight.',
            target:'That **WORLD EATERS CHARACTER** unit.',
            effect:'Your unit’s **CHARACTER** models’ melee attacks have:\n- +1 **A**.\n- +2 **S**.' },
          { id:'punish-the-craven', name:'Punish the Craven', cp:1, phases:['movement'], turn:'opp', needs:{ all:['Character'] },
            when:'Your opponent’s Movement phase, when a unit is selected to make a fall-back move, if that unit is engaged with a friendly **WORLD EATERS CHARACTER** unit.',
            target:'That **WORLD EATERS CHARACTER** unit.',
            effect:'When an enemy unit engaged with your unit is selected to make a fall-back move, that enemy unit must use the desperate escape mode. If that enemy unit is battle-shocked, -1 from those hazard rolls.' }
        ]
      }
    }
  },
  'thousand-sons': {
    name: 'Thousand Sons',
    // words players use for a rule that has another name
    aliases: [[/^rituals?$/i, 'Cabal of Sorcerers']],
    armyRules: [
      { name:'Cabal of Sorcerers', ph:['shooting'], turn:'your',
        text:'If your army Faction is **THOUSAND SONS**, at the start of your Shooting phase, one or more models from your army with this ability can attempt **Rituals**. To do so, select one model from your army with this ability that has not yet attempted a **Ritual** this turn and select one **Ritual** no model from your army has attempted to manifest this turn, then take a **Psychic test** by following the sequence below:\n- 1. Roll 2D6\n- 2. Optionally, roll one additional D6 (**Channel the Warp**). Then, if one or more doubles or triples were rolled during this test, that model’s unit suffers D3 **mortal wounds**.\n- 3. If that model is not destroyed, the combined total of all the dice rolled during this test is the **Psychic test** result. If this equals or exceeds the **Warp Charge** value of the **Ritual** being attempted, that model manifests that **Ritual** and you resolve its effects.\n*App note, not rules text: the Rituals below are the BSData “Rituals reference” entry. The New Recruit list selects it but does not print it.*',
        // Rituals reference (BSData), label = name and Warp Charge value
        table:[
          ['Destiny’s Ruin (Psychic) · Warp Charge 5', 'Select one enemy unit within 24" of and visible to the manifesting model. Until the end of the phase, each time a **THOUSAND SONS** or **SCINTILLATING LEGION** model from your army makes an attack that targets that unit, re-roll a Hit roll of 1. If the Psychic test result for this Ritual was 10+, you can re-roll the Hit roll instead.'],
          ['Temporal Surge (Psychic) · Warp Charge 6', 'Select one friendly **THOUSAND SONS** or **SCINTILLATING LEGIONS** unit that is not within Engagement Range of one or more enemy units and is within 24" of and visible to the manifesting model. That unit can make a Normal move of up to D6". If the Psychic test result for this Ritual was 10+, that model can make a Normal move of up to 6" instead. In either case, until the end of the turn, that unit is not eligible to declare a charge.'],
          ['Doombolt (Psychic) · Warp Charge 7', 'Select one enemy unit within 24" of and visible to the manifesting model (excluding units with the **Lone Operative** ability that are not part of an Attached unit and are not within 12" of the manifesting model); that unit suffers D3 mortal wounds. If the Psychic test result for this Ritual was 11+, that unit suffers D3+3 mortal wounds instead.'],
          ['Twist of Fate (Psychic) · Warp Charge 9', 'Select one enemy unit within 24" of and visible to the manifesting model. Until the end of the phase, each time a **THOUSAND SONS** or **SCINTILLATING LEGION** model from your army makes an attack that targets that unit, improve the Armour Penetration characteristic of that attack by 1. If the Psychic test result for this Ritual was 12+, improve the Armour Penetration characteristic of that attack by 2 instead.']
        ] }
    ],
    detachments: {
      'grand-coven': {
        name:'Grand Coven', dp:3,
        // the Wahapedia page was not in the packet
        missing:['stratagems','enhancements'],
        // needs: the units with Psychic weapons (every one of them is a PSYKER unit)
        rule:{ name:'Kindred Sorcery', ph:['command'], turn:'your', needs:{ all:['Faction: Thousand Sons','Psyker'] },
          mod:{ kind:'all', when:'Kindred Sorcery (one ability, picked in your Command phase)', note:'Psychic weapons only: Imbued Manifestation +6" range (ranged) · Psychic Maelstrom +1 to wound rolls · Wrath of the Immaterium [DEVASTATING WOUNDS]' },
          text:'In your Command phase, you can select one of the abilities listed below to take effect until the start of your next Command phase. You can only select each of these abilities once per battle.',
          table:[
            ['Imbued Manifestation', 'Add 6" to the range characteristic of ranged Psychic weapons equipped by **THOUSAND SONS** models in your army.'],
            ['Psychic Maelstrom', 'Each time a **THOUSAND SONS** model from your army makes an attack with a Psychic weapon, add 1 to the Wound roll.'],
            ['Wrath of the Immaterium', 'Psychic weapons equipped by **THOUSAND SONS** models in your army have the **[DEVASTATING WOUNDS]** ability.']
          ] },
        // only the two this list takes, text from the New Recruit cards; pts from BSData
        // (110 + 30 = 140 and 170 + 35 = 205, matching the New Recruit roster)
        enhancements:[
          { name:'Umbralefic Crystal', pts:30, text:'(Once per battle, per army) In your Command phase, if this unit is **unengaged**, you can use this ability. If you do:\n- Place this unit in **strategic reserves**.\n- This unit has **Deep Strike** until the start of your next Shooting phase.\n- This unit must make an **ingress move** in your next Movement phase (including in your first turn).' },
          { name:'Eldritch Vortex of E’taph', pts:35, text:'Add 1 to the Strength and Damage characteristics of Psychic weapons equipped by the bearer.' }
        ],
        stratagems:[]
      }
    }
  },
  'tyranids': {
    name: 'Tyranids',
    // words players use for a rule that has another name
    aliases: [[/^synapse range$/i, 'Synapse']],
    armyRules: [
      { name:'Synapse',
        // short reminders shown in the stratagem phase views (app wording, not rules text)
        remind:[
          { ph:['command'], turn:'either', text:'Within Synapse Range: Battle-shock tests are taken on 3D6 instead of 2D6.' },
          { ph:['fight'], turn:'either', text:'Within Synapse Range: melee attacks have +1 S.' }
        ],
        text:'If your Army Faction is **TYRANIDS**, while a **TYRANIDS** unit from your army is within 6" of one or more friendly **SYNAPSE** models, that **TYRANIDS** unit is said to be within **Synapse Range** of that model and of your army. While a **TYRANIDS** unit from your army is within Synapse Range of your army:\n- Each time that unit takes a Battle-shock test, take that test on 3D6 instead of 2D6.\n- Each time a model in that unit makes a melee attack, add 1 to the Strength characteristic of that attack.' },
      { name:'Shadow in the Warp', tag:'Once per battle', ph:['command'], turn:'either',
        text:'If your Army Faction is **TYRANIDS**, once per battle, in either player’s Command phase, if one or more units from your army with this ability are on the battlefield, you can unleash the Shadow in the Warp. When you do, each enemy unit on the battlefield must take a Battle-shock test. Each time an enemy unit takes such a Battle-shock test, if it is within 6" of one or more **SYNAPSE** units from your army, subtract 1 from that test.' }
    ],
    detachments: {
      'crusher-stampede': {
        name:'Crusher Stampede', dp:2,
        rule:{ name:'Enraged Behemoths', ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' }, needs:{ all:['Faction: Tyranids','Monster'] },
          mod:{ kind:'all', when:'Below Starting Strength', note:'+1 to hit rolls; also +1 to wound rolls if Below Half-strength' },
          text:'Each time a **TYRANIDS MONSTER** model from your army makes an attack, add 1 to the Hit roll if that model’s unit is below its Starting Strength, and add 1 to the Wound roll as well if that model’s unit is Below Half-strength. In addition, while a **TYRANIDS MONSTER** unit from your army (excluding Battle-shocked units) is at its Starting Strength, add 2 to the Objective Control characteristic of models in that unit.' },
        enhancements:[
          // pts from BSData (Hive Tyrant 195 + 25 = the 220 New Recruit prints)
          { name:'Monstrous Nemesis', pts:25, text:'**TYRANIDS MONSTER** only. Each time the bearer makes a melee attack that targets a **MONSTER** or **VEHICLE** unit, add 1 to the Wound roll.' }
        ],
        stratagems:[],
        missing:['stratagems','enhancements']
      },
      'talons-of-the-norn-queen': {
        name:'Talons of the Norn Queen', dp:1,
        rule:{ name:'Higher Imperatives', needs:{ any:['Norn Emissary','Norn Assimilator'] },
          text:'Friendly **NORN EMISSARY/NORN ASSIMILATOR** units have the **Protean Purpose** ability.' },
        enhancements:[
          // pts from BSData (Norn Assimilator 250 + 30 = 280; Norn Emissary 250 + 20 = 270)
          { name:'Synaptoprescience', pts:30, text:'**NORN ASSIMILATOR** unit only. This unit has 4+ **InSv**.' },
          { name:'Destabilising Predation', pts:20, text:'**NORN EMISSARY** unit only. This unit’s ranged attacks have **[ANTI-CHARACTER 2+]**.' }
        ],
        stratagems:[],
        missing:['stratagems','enhancements']
      }
    }
  }
};

/* ---------------- armies ----------------
   Army: id, name, faction (key into FACTIONS), points, pointsUsed, battleSize,
         disposition, detachments (keys), source.
   Unit fields:
     role        Epic Hero | Character | Battleline | Infantry | Mounted | Monster | Vehicle
     short       shorter name where two units share one (e.g. Beastboss)
     pts, ptsNote  points (for the whole attached unit) and how they add up
     copies      how many identical units the list has (New Recruit prints "x3")
     warlord, enhancement, leads (name of the unit it leads)
     models      lines from the "Models" box
     gear        per models line, the weapons that line carries (weapon name, or group
                 for a multi-profile weapon), from New Recruit's Options column. It tells
                 the app which weapons a model uses together and which are a choice.
     stats       one row per model profile: M T Sv W Ld OC InSv base
     boostNote   a stat that already includes an enhancement
     ranged / melee  weapons: name, range, A, BS|WS, S, AP, D, kw[]
                 group  joins the "pick one profile" rows of one weapon
                 who    which model in an attached unit carries it
                 n      how many models carry it
                 hunter the Hunter: MONSTER/VEHICLE profile; enh  weapon from an enhancement
     abilities   name, text, tag, who; ph/turn/turns = the phase it triggers in;
                 def = one-line summary for the datasheet's "When targeted" line
     mods        abilities that change this unit's attacks, shown under its weapon tables:
                 kind ranged|melee|all, when, note, from. With weapon + set, that weapon's
                 cell shows both values ("8/14") and the condition becomes its footnote.
     aura        mods this unit gives to other units: needs = which units (keywords),
                 notSelf = not the unit itself, selfWhen = the condition on its own sheet
     rules       core/faction rules that open a glossary entry
     kw, kwNote  the unit's keywords ("Categories")                                     */
const ARMIES = [
{
  id:'cooking', name:'Cooking', faction:'orks', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Purge the Foe',
  detachments:['brute-bosses','da-big-hunt','dread-mob'],
  source:'New Recruit, exported 16 Oct 2026',
  units:[
    {
      id:'ghazghkull', name:'Ghazghkull Thraka', role:'Epic Hero', pts:290, warlord:true,
      models:['1× Ghazghkull Thraka'], gear:[['Adamantine ’Eadbutt','Gork’s Klaw','Mork’s Roar']],
      stats:[{ name:'Ghazghkull Thraka', M:'8"', T:'10', Sv:'2+', W:'16', Ld:'6+', OC:'4', InSv:'4+', base:'80mm' }],
      ranged:[
        { group:'Mork’s Roar', name:'Point Blank', range:'9"', A:'2D6+2', BS:'–', S:'6', AP:'-1', D:'1', kw:['CLOSE-QUARTERS','TORRENT'] },
        { group:'Mork’s Roar', name:'Aimed', range:'36"', A:'12', BS:'5+', S:'6', AP:'-1', D:'1', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 4'] }
      ],
      melee:[
        { name:'Adamantine ’Eadbutt', range:'Melee', A:'1', WS:'2+', S:'14', AP:'-2', D:'D3+3', kw:['DEVASTATING WOUNDS','EXTRA ATTACKS','PRECISION'] },
        { name:'Gork’s Klaw', range:'Melee', A:'7', WS:'2+', S:'14', AP:'-3', D:'4', kw:['CLEAVE 2','DEVASTATING WOUNDS'] }
      ],
      abilities:[
        { name:'Supreme Commander', text:'If this model is in your army, it must be your **WARLORD**.' },
        { name:'Makari, Hoist Dat Banner!', tag:'Once per battle, per army', ph:['movement'], turn:'your',
          text:'In your Movement phase, you can select a number of friendly **ORKS** units equal to or less than the current battle round number. Those units are **riled up** until the start of your next turn.\n*Place one Makari token next to the unit, removing it after this ability is used.*' },
        { name:'Da Grand Warlord’s Ladz', def:'Lone Operative while within 3" of another ORKS INFANTRY unit', text:'While this unit is within 3" of another friendly **ORKS INFANTRY** unit, this unit has **Lone Operative**.' },
        { name:'Prophet of Da Great Waaagh!', tag:'Aura', ph:['fight'], turn:'either',
          text:'While a friendly **ORKS** unit is within 6" of this unit, that unit’s melee attacks have:\n- +1 to **hit rolls**.\n- +1 to **wound rolls**.' }
      ],
      aura:[
        { kind:'melee', needs:{ all:['Faction: Orks'] }, when:'Within 6" of Ghazghkull', selfWhen:'Own aura', note:'+1 to hit, +1 to wound', from:'Prophet of Da Great Waaagh!' }
      ],
      rules:['Waaagh!','Da Boss'],
      kw:['Character','Epic Hero','Explosives','Faction: Orks','Ghazghkull Thraka','Infantry','Warboss','Warlord']
    },
    {
      id:'mozrog', name:'Mozrog Skragbad', role:'Epic Hero', pts:170,
      models:['1× Mozrog Skragbad'], gear:[['Big Chompa’s Jaws','Gutrippa','Thump Gun']],
      stats:[{ name:'Mozrog Skragbad', M:'10"', T:'9', Sv:'3+', W:'10', Ld:'6+', OC:'3', InSv:'4+', base:'80mm' }],
      ranged:[
        { name:'Thump Gun', range:'18"', A:'3', BS:'5+', S:'6', AP:'0', D:'2', kw:['ANTI-MONSTER/VEHICLE 4+'] }
      ],
      melee:[
        { name:'Big Chompa’s Jaws', range:'Melee', A:'3', WS:'3+', S:'7', AP:'-2', D:'4', kw:['ANTI-MONSTER/VEHICLE 3+','EXTRA ATTACKS'] },
        { group:'Gutrippa', name:'Hunter', hunter:true, range:'Melee', A:'6', WS:'2+', S:'12', AP:'-2', D:'D6+1', kw:['LETHAL HITS'] },
        { group:'Gutrippa', name:'Standard', range:'Melee', A:'6', WS:'2+', S:'9', AP:'-2', D:'2', kw:['CLEAVE 1'] }
      ],
      abilities:[
        { name:'Beast Snagga Following', def:'Lone Operative while within 3" of a BEAST SNAGGA unit (not MONSTER CHARACTER)', text:'While this unit is within 3" of a friendly **BEAST SNAGGA** unit (excluding **MONSTER CHARACTER** units), this unit has **Lone Operative**.' },
        { name:'One Last Kill', ph:['fight'], turn:'either',
          text:'In the Fight phase, when this model is **destroyed**, if this unit has not been **selected to fight** this phase, roll one D6:\n- On a 2+, do not remove this model from the battlefield. When this unit has fought, or at the end of the phase (whichever comes first), this model is removed from the battlefield.' },
        { name:'Da Bigger Dey Iz…', ph:['fight'], turn:'either',
          text:'This unit’s melee attacks that target a **MONSTER/VEHICLE** unit can re-roll **wound rolls**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'vs MONSTER/VEHICLE', note:'re-roll wound rolls', from:'Da Bigger Dey Iz…' }
      ],
      rules:['Feel No Pain 5+','Waaagh!'],
      kw:['Beast Snagga','Character','Epic Hero','Faction: Orks','Monster','Mozrog Skragbad']
    },
    {
      id:'nazdreg', name:'Nazdreg', role:'Epic Hero', pts:355, ptsNote:'165 + Meganobz 190',
      leads:'Meganobz',
      models:['1× Nazdreg','3× Meganob w/ Kombi-weapon and Killsaw','2× Meganob w/ Kombi-weapon and Power Klaw'], gear:[['Kustom Blasta X','Moonchewa'],['Kombi-weapon','Killsaw'],['Kombi-weapon','Power Klaw']],
      stats:[
        { name:'Nazdreg', M:'5"', T:'7', Sv:'2+', W:'8', Ld:'6+', OC:'1', InSv:'5+', base:'60mm' },
        { name:'Meganob ×5', M:'5"', T:'6', Sv:'2+', W:'3', Ld:'7+', OC:'1', InSv:'–', base:'40mm' }
      ],
      ranged:[
        { group:'Kustom Blasta X', who:'Nazdreg', name:'Skorcha', range:'12"', A:'3', BS:'–', S:'5', AP:'-1', D:'1', kw:['BLAST 1','TORRENT','IGNORES COVER'] },
        { group:'Kustom Blasta X', who:'Nazdreg', name:'Gatler', range:'24"', A:'6', BS:'4+', S:'9', AP:'-2', D:'3', kw:['HAZARDOUS','IGNORES COVER'] },
        { group:'Kustom Blasta X', who:'Nazdreg', name:'Shoota', range:'18"', A:'4', BS:'4+', S:'5', AP:'-1', D:'1', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 2','IGNORES COVER'] },
        { group:'Kombi-weapon', who:'Meganobz', n:5, name:'Point Blank', range:'12"', A:'3', BS:'–', S:'5', AP:'0', D:'1', kw:['BLAST 1','TORRENT','IGNORES COVER'] },
        { group:'Kombi-weapon', who:'Meganobz', n:5, name:'Kill Shot', range:'24"', A:'1', BS:'5+', S:'10', AP:'-2', D:'3', kw:['IGNORES COVER'] },
        { group:'Kombi-weapon', who:'Meganobz', n:5, name:'Shoota', range:'18"', A:'2', BS:'5+', S:'4', AP:'0', D:'1', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 1','IGNORES COVER'] }
      ],
      melee:[
        { name:'Kustom Blasta X', who:'Nazdreg', range:'Melee', A:'6', WS:'2+', S:'5', AP:'-1', D:'1', kw:['CLEAVE 1','EXTRA ATTACKS'] },
        { name:'Moonchewa', who:'Nazdreg', range:'Melee', A:'5', WS:'2+', S:'12', AP:'-2', D:'3', kw:['CLEAVE 1','TWIN-LINKED'] },
        { name:'Killsaw', who:'Meganobz', n:3, range:'Melee', A:'3', WS:'4+', S:'10', AP:'-2', D:'3', kw:[] },
        { name:'Power Klaw', who:'Meganobz', n:2, range:'Melee', A:'3', WS:'3+', S:'10', AP:'-2', D:'2', kw:[] }
      ],
      abilities:[
        { name:'Nazdreg’s Know-wotz', who:'Nazdreg', text:'- This unit has **Deep Strike**.\n- This unit’s ranged attacks have **[IGNORES COVER]**.' },
        { name:'Supreme Kunnin’', who:'Nazdreg', tag:'Once per phase, per army', ph:['movement'], turn:'opp',
          text:'In your opponent’s Movement phase, when an enemy unit ends a move within 8" of this unit, if this unit is **unengaged**, this unit can:\n- Make a **normal move** of up to D6".\n- Or: if this unit is **riled up**, make a **normal move** of up to 5".' },
        { name:'Intimidating Motivation', who:'Nazdreg', tag:'Once per battle round, per army', ph:['movement'], turn:'your',
          text:'In your Movement phase, at the start or end of this unit’s move, you can select one friendly **ORKS** unit within 6" of this unit. That unit:\n- Is no longer **battle-shocked**.\n- Is **riled up** until the start of your next turn.' },
        { name:'Krumpin’ Time', who:'Meganobz', ph:['fight'], turn:'either', text:'In the Fight phase, if this unit is **riled up**, this unit has +1 to **hit rolls**.' },
        { name:'Arrogant Invulnerability', who:'Meganobz', def:'Attacks that target this unit have -1 AP', text:'Attacks that target this unit have -1 **AP**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        // "this unit" is the whole attached unit, Nazdreg included
        { kind:'melee', when:'Riled up, Fight phase', note:'+1 to hit rolls', from:'Krumpin’ Time' }
      ],
      rules:['Waaagh!','Leader','Da Boss','Deep Strike'],
      kw:['Character','Epic Hero','Faction: Orks','Infantry','Mega Armour','Nazdreg','Warboss','Explosives','Meganobz'],
      kwNote:'Explosives and Meganobz come from the attached Meganobz.'
    },
    {
      id:'beastboss-bbk', name:'Beastboss on Squigosaur', short:'Beastboss', role:'Character', pts:170, enhancement:'Brutal But Kunnin’',
      models:['1× Beastboss on Squigosaur'], gear:[['Beastchoppa','Slugga','Squigosaur’s jaws']],
      stats:[{ name:'Beastboss on Squigosaur', M:'10"', T:'9', Sv:'3+', W:'10', Ld:'6+', OC:'3', InSv:'5+', base:'80mm' }],
      ranged:[
        { name:'Slugga', range:'12"', A:'1', BS:'5+', S:'4', AP:'0', D:'1', kw:['CLOSE-QUARTERS','LETHAL HITS: non-MONSTER/VEHICLE'] }
      ],
      melee:[
        { group:'Beastchoppa', name:'Hunter', hunter:true, range:'Melee', A:'6', WS:'2+', S:'12', AP:'-2', D:'D6+1', kw:[] },
        { group:'Beastchoppa', name:'Standard', range:'Melee', A:'6', WS:'2+', S:'6', AP:'-2', D:'3', kw:['CLEAVE 1'] },
        { name:'Squigosaur’s jaws', range:'Melee', A:'3', WS:'3+', S:'7', AP:'-2', D:'4', kw:['ANTI-MONSTER/VEHICLE 3+','EXTRA ATTACKS'] }
      ],
      boostNote:'Melee D already includes +1 from Brutal But Kunnin’.',
      abilities:[
        { name:'Thundering Stampede', tag:'Aura', ph:['charge'], turn:'either', text:'Friendly **BEAST SNAGGA** units within 6" of this unit have +1 to **charge rolls**.' },
        { name:'Boss of da Hunt', def:'Lone Operative while within 3" of a BEAST SNAGGA unit (not MONSTER CHARACTER)', text:'While this unit is within 3" of a friendly **BEAST SNAGGA** unit (excluding **MONSTER CHARACTER** units), this unit has **Lone Operative**.' },
        { name:'Keep Huntin’!', tag:'Once per battle round, per army', ph:['movement'], turn:'your',
          text:'In your Movement phase, at the start or end of this unit’s move, you can select one friendly **BEAST SNAGGA** unit within 6" of this unit. That unit:\n- Is no longer **battle-shocked**.\n- Is **riled up** until the start of your next turn.' },
        { name:'Brutal But Kunnin’', tag:'Enhancement', text:'**WARBOSS** model only. This model’s melee attacks have +1 **D**.' }
      ],
      rules:['Da Boss','Waaagh!','Feel No Pain 5+'],
      kw:['Beast Snagga','Beastboss on Squigosaur','Character','Faction: Orks','Monster','Warboss']
    },
    {
      id:'beastboss-gobshot', name:'Beastboss on Squigosaur', short:'Beastboss', role:'Character', pts:160, enhancement:'Da Gobshot Thunderbuss',
      models:['1× Beastboss on Squigosaur'], gear:[['Da Gobshot Thunderbuss','Beastchoppa','Slugga','Squigosaur’s jaws']],
      stats:[{ name:'Beastboss on Squigosaur', M:'10"', T:'9', Sv:'3+', W:'10', Ld:'6+', OC:'3', InSv:'5+', base:'80mm' }],
      ranged:[
        { name:'Da Gobshot Thunderbuss', range:'24"', A:'6', BS:'4+', S:'7', AP:'-2', D:'2', kw:['LETHAL HITS: non-MONSTER/VEHICLE','RAPID FIRE 6'], enh:true },
        { name:'Slugga', range:'12"', A:'1', BS:'5+', S:'4', AP:'0', D:'1', kw:['CLOSE-QUARTERS','LETHAL HITS: non-MONSTER/VEHICLE'] }
      ],
      melee:[
        { group:'Beastchoppa', name:'Hunter', hunter:true, range:'Melee', A:'6', WS:'2+', S:'12', AP:'-2', D:'D6', kw:[] },
        { group:'Beastchoppa', name:'Standard', range:'Melee', A:'6', WS:'2+', S:'6', AP:'-2', D:'2', kw:['CLEAVE 1'] },
        { name:'Squigosaur’s jaws', range:'Melee', A:'3', WS:'3+', S:'7', AP:'-2', D:'3', kw:['ANTI-MONSTER/VEHICLE 3+','EXTRA ATTACKS'] }
      ],
      abilities:[
        { name:'Thundering Stampede', tag:'Aura', ph:['charge'], turn:'either', text:'Friendly **BEAST SNAGGA** units within 6" of this unit have +1 to **charge rolls**.' },
        { name:'Boss of da Hunt', def:'Lone Operative while within 3" of a BEAST SNAGGA unit (not MONSTER CHARACTER)', text:'While this unit is within 3" of a friendly **BEAST SNAGGA** unit (excluding **MONSTER CHARACTER** units), this unit has **Lone Operative**.' },
        { name:'Keep Huntin’!', tag:'Once per battle round, per army', ph:['movement'], turn:'your',
          text:'In your Movement phase, at the start or end of this unit’s move, you can select one friendly **BEAST SNAGGA** unit within 6" of this unit. That unit:\n- Is no longer **battle-shocked**.\n- Is **riled up** until the start of your next turn.' }
      ],
      rules:['Da Boss','Waaagh!','Feel No Pain 5+'],
      kw:['Beast Snagga','Beastboss on Squigosaur','Character','Faction: Orks','Monster','Warboss']
    },
    {
      id:'dakkarig-boosta', name:'Big Mek Dakkarig', short:'Big Mek', role:'Character', pts:170, enhancement:'Cybork Boosta',
      models:['1× Big Mek Dakkarig'], gear:[['Blitzkannon','Multi-busta Launcha','Stompy Feet']],
      stats:[{ name:'Big Mek Dakkarig', M:'10"', T:'8', Sv:'3+', W:'11', Ld:'7+', OC:'3', InSv:'5+', base:'90mm' }],
      boostNote:'M already includes +2" from Cybork Boosta.',
      ranged:[
        { name:'Blitzkannon', range:'24"', A:'8', BS:'4+', S:'7', AP:'-2', D:'2', kw:['IGNORES COVER','LETHAL HITS: non-MONSTER/VEHICLE'] },
        { name:'Multi-busta Launcha', range:'24"', A:'6', BS:'5+', S:'10', AP:'-2', D:'3', kw:['IGNORES COVER','LETHAL HITS'] }
      ],
      melee:[
        { name:'Stompy Feet', range:'Melee', A:'4', WS:'3+', S:'6', AP:'-1', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Even More Dakka', ph:['shooting'], turn:'your', text:'If this unit is **riled up**, this unit’s ranged attacks have **[SUSTAINED HITS 1]**.' },
        { name:'Blitz Dem Gitz!', ph:['shooting'], turn:'your', text:'In your Shooting phase, if this unit’s Blitzkannon weapon targets a unit (excluding **MONSTER/VEHICLE** units), that weapon has +6 **A**.' },
        { name:'Cybork Boosta', tag:'Enhancement', text:'**BIG MEK/MEK** model only. This model has +2" **M**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', weapon:'Blitzkannon', set:{ A:'14' }, when:'vs non-MONSTER/VEHICLE targets', note:'in your Shooting phase', from:'Blitz Dem Gitz!' },
        { kind:'ranged', when:'Riled up', note:'[SUSTAINED HITS 1]', from:'Even More Dakka' }
      ],
      rules:['Deadly Demise 1','Waaagh!'],
      kw:['Big Mek','Big Mek Dakkarig','Character','Faction: Orks','Vehicle','Walker']
    },
    {
      id:'dakkarig-herder', name:'Big Mek Dakkarig', short:'Big Mek', role:'Character', pts:190, enhancement:'Dreadherder',
      models:['1× Big Mek Dakkarig'], gear:[['Blitzkannon','Multi-busta Launcha','Stompy Feet']],
      stats:[{ name:'Big Mek Dakkarig', M:'8"', T:'8', Sv:'3+', W:'11', Ld:'7+', OC:'3', InSv:'5+', base:'90mm' }],
      ranged:[
        { name:'Blitzkannon', range:'24"', A:'8', BS:'4+', S:'7', AP:'-2', D:'2', kw:['IGNORES COVER','LETHAL HITS: non-MONSTER/VEHICLE'] },
        { name:'Multi-busta Launcha', range:'24"', A:'6', BS:'5+', S:'10', AP:'-2', D:'3', kw:['IGNORES COVER','LETHAL HITS'] }
      ],
      melee:[
        { name:'Stompy Feet', range:'Melee', A:'4', WS:'3+', S:'6', AP:'-1', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Even More Dakka', ph:['shooting'], turn:'your', text:'If this unit is **riled up**, this unit’s ranged attacks have **[SUSTAINED HITS 1]**.' },
        { name:'Blitz Dem Gitz!', ph:['shooting'], turn:'your', text:'In your Shooting phase, if this unit’s Blitzkannon weapon targets a unit (excluding **MONSTER/VEHICLE** units), that weapon has +6 **A**.' },
        { name:'Dreadherder', tag:'Enhancement', ph:['shooting'], turn:'your', def:'Lone Operative while within 3" of an ORKS WALKER unit (not BIG MEK)',
          text:'**BIG MEK** model only. While this model is within 3" of a friendly **ORKS WALKER** unit (excluding **BIG MEK** units):\n- This model has **Lone Operative**.\n- In your Shooting phase, you can select one friendly **ORKS WALKER** unit within 3" of this model. That unit’s attacks can re-roll **hit rolls** of 1 until the end of the turn.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', weapon:'Blitzkannon', set:{ A:'14' }, when:'vs non-MONSTER/VEHICLE targets', note:'in your Shooting phase', from:'Blitz Dem Gitz!' },
        { kind:'ranged', when:'Riled up', note:'[SUSTAINED HITS 1]', from:'Even More Dakka' }
      ],
      aura:[
        { kind:'all', needs:{ all:['Walker'] }, notSelf:true, when:'Picked by the Dreadherder', note:'re-roll hit rolls of 1 this turn', from:'Dreadherder' }
      ],
      rules:['Deadly Demise 1','Waaagh!'],
      kw:['Big Mek','Big Mek Dakkarig','Character','Faction: Orks','Vehicle','Walker']
    },
    {
      id:'gretchin', name:'Gretchin', role:'Infantry', pts:45, copies:3,
      models:['10× Gretchin'], gear:[['Grot Blasta','Scavenged Shivs']],
      stats:[{ name:'Gretchin ×10', M:'6"', T:'2', Sv:'6+', W:'1', Ld:'8+', OC:'1', InSv:'–', base:'25mm' }],
      ranged:[
        { name:'Grot Blasta', n:10, range:'12"', A:'1', BS:'4+', S:'3', AP:'0', D:'1', kw:['CLOSE-QUARTERS'] }
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
      models:['3× Deffkopta'], gear:[['Choppa','Rokkit Launcha','Slugga','Spinnin’ Blades']],
      stats:[{ name:'Deffkoptas ×3', M:'12"', T:'6', Sv:'4+', W:'4', Ld:'7+', OC:'2', InSv:'6+', base:'75×42mm' }],
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
        { kind:'ranged', when:'After an ingress move this turn', note:'+1 to hit rolls', from:'Deff from Above' }
      ],
      rules:['Deep Strike','Waaagh!'],
      kw:['Deffkoptas','Explosives','Faction: Orks','Fly','Mounted','Speed Freeks']
    },
    {
      id:'killa-kans', name:'Killa Kans', role:'Vehicle', pts:275,
      models:['6× Killa Kan'], gear:[['Kan Blasta','Kan Klaw']],
      stats:[{ name:'Killa Kan ×6', M:'8"', T:'7', Sv:'3+', W:'5', Ld:'8+', OC:'2', InSv:'6+', base:'60mm' }],
      ranged:[
        { group:'Kan Blasta', n:6, name:'Kill Shot', range:'24"', A:'2', BS:'4+', S:'10', AP:'-2', D:'3', kw:[] },
        { group:'Kan Blasta', n:6, name:'Point Blank', range:'12"', A:'3', BS:'–', S:'5', AP:'-1', D:'1', kw:['BLAST 2','TORRENT'] },
        { group:'Kan Blasta', n:6, name:'Dakka', range:'24"', A:'4', BS:'4+', S:'6', AP:'-1', D:'1', kw:['BLAST 1','IGNORES COVER','SUSTAINED HITS 1'] }
      ],
      melee:[
        { name:'Kan Klaw', n:6, range:'Melee', A:'3', WS:'4+', S:'8', AP:'-2', D:'3', kw:[] }
      ],
      abilities:[
        { name:'Spiteful Power Trip', ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' }, text:'This unit’s attacks that target a unit that has no models with a **T** of 7+ have +1 to **hit rolls**.' }
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
  id:'purge-freeblade', name:'Purge Freeblade', faction:'imperial-knights', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Purge the Foe',
  detachments:['freeblade-company'],
  source:'New Recruit, exported 13 Oct 2026',
  units:[
    {
      id:'knight-warden', name:'Knight Warden', role:'Character', pts:365, warlord:true,
      models:['1× Knight Warden'],
      gear:[['Avenger gatling cannon','Heavy flamer','Stormspear rocket pod','Meltagun','Reaper chainsword']],
      stats:[{ name:'Knight Warden', M:'10"', T:'11', Sv:'3+', W:'26', Ld:'6+', OC:'10', InSv:'5+*', base:'170×109mm' }],
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
        { name:'Thin Their Ranks', ph:['shooting'], turn:'your',
          text:'Each time this model makes a ranged attack that targets an enemy unit (excluding **MONSTERS** and **VEHICLES**), that attack has the **[DEVASTATING WOUNDS]** ability.' },
        { name:'Invulnerable Save (5+*)', def:'5+ invulnerable save against ranged attacks only',
          text:'This model has a 5+ invulnerable save against ranged attacks.' },
        { name:'Damaged: 1-9 Wounds Remaining', damaged:'1-9', ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' },
          text:'While this model has 1-9 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the Hit roll.' },
        { name:'Warden’s Duty', tag:'Bondsman',
          text:'While a model is affected by this ability, weapons equipped by that model have the **[SUSTAINED HITS 1]** ability, and ranged weapons equipped by that model have the **[IGNORES COVER]** ability.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'vs non-MONSTER/VEHICLE targets', note:'ranged attacks have [DEVASTATING WOUNDS]', from:'Thin Their Ranks' },
        { kind:'all', when:'Damaged (1-9 wounds left)', note:'-1 to hit rolls (and -5 OC)', from:'Damaged: 1-9 Wounds Remaining' }
      ],
      // the Bondsman ability, on the ARMIGER model it is used on (this list has none)
      aura:[
        { kind:'all', needs:{ all:['Armiger'] }, notSelf:true, when:'Affected by Warden’s Duty (Bondsman)', note:'weapons have [SUSTAINED HITS 1]', from:'Warden’s Duty' },
        { kind:'ranged', needs:{ all:['Armiger'] }, notSelf:true, when:'Affected by Warden’s Duty (Bondsman)', note:'ranged weapons have [IGNORES COVER]', from:'Warden’s Duty' }
      ],
      rules:['Deadly Demise D6','Super-Heavy Walker','Code Chivalric','Devastating Wounds','Bondsman','Ignores Cover','Sustained Hits','Torrent','Melta'],
      kw:['Character','Faction: Imperial Knights','Imperium','Knight Warden','Questoris','Titanic','Towering','Vehicle','Walker','Warlord']
    },
    {
      id:'knight-paladin', name:'Knight Paladin', role:'Character', pts:375, copies:2,
      models:['1× Knight Paladin'],
      gear:[['Questoris heavy stubber','Rapid-fire battle cannon','Stormspear rocket pod','Meltagun','Reaper chainsword']],
      stats:[{ name:'Knight Paladin', M:'10"', T:'11', Sv:'3+', W:'26', Ld:'6+', OC:'10', InSv:'5+*', base:'170×109mm' }],
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
        { name:'Seasoned Noble', ph:['shooting'], turn:'your',
          text:'Each time this model makes a ranged attack that targets the closest eligible target, improve the Armour Penetration characteristic of that attack by 1.' },
        { name:'Invulnerable Save (5+*)', def:'5+ invulnerable save against ranged attacks only',
          text:'This model has a 5+ invulnerable save against ranged attacks.' },
        { name:'Damaged: 1-9 Wounds Remaining', damaged:'1-9', ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' },
          text:'While this model has 1-9 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the Hit roll.' },
        { name:'Paladin’s Duty', tag:'Bondsman',
          text:'While a model is affected by this ability, weapons equipped by that model have the **[LETHAL HITS]** ability, and melee weapons equipped by that model have the **[LANCE]** ability.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target is the closest eligible target', note:'improve AP by 1', from:'Seasoned Noble' },
        { kind:'all', when:'Damaged (1-9 wounds left)', note:'-1 to hit rolls (and -5 OC)', from:'Damaged: 1-9 Wounds Remaining' }
      ],
      // the Bondsman ability, on the ARMIGER model it is used on (this list has none)
      aura:[
        { kind:'all', needs:{ all:['Armiger'] }, notSelf:true, when:'Affected by Paladin’s Duty (Bondsman)', note:'weapons have [LETHAL HITS]', from:'Paladin’s Duty' },
        { kind:'melee', needs:{ all:['Armiger'] }, notSelf:true, when:'Affected by Paladin’s Duty (Bondsman)', note:'melee weapons have [LANCE]', from:'Paladin’s Duty' }
      ],
      rules:['Deadly Demise D6','Super-Heavy Walker','Code Chivalric','Lethal Hits','Lance','Bondsman','Rapid Fire','Blast','Melta'],
      kw:['Character','Faction: Imperial Knights','Imperium','Knight Paladin','Questoris','Titanic','Towering','Vehicle','Walker']
    },
    {
      id:'knight-errant', name:'Knight Errant', role:'Character', pts:355,
      models:['1× Knight Errant'],
      gear:[['Thermal cannon','Stormspear rocket pod','Meltagun','Reaper chainsword']],
      stats:[{ name:'Knight Errant', M:'10"', T:'11', Sv:'3+', W:'26', Ld:'6+', OC:'10', InSv:'5+*', base:'170×109mm' }],
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
        { name:'Aggressive Assault', ph:['shooting'], turn:'your',
          text:'Each time this model makes a ranged attack that targets the closest eligible target, add 1 to the Hit roll.' },
        { name:'Invulnerable Save (5+*)', def:'5+ invulnerable save against ranged attacks only',
          text:'This model has a 5+ invulnerable save against ranged attacks.' },
        { name:'Damaged: 1-9 Wounds Remaining', damaged:'1-9', ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' },
          text:'While this model has 1-9 wounds remaining, subtract 5 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the Hit roll.' },
        { name:'Errant’s Duty', tag:'Bondsman',
          text:'While a model is affected by this ability, you can re-roll Advance rolls made for that model and ranged weapons equipped by that model have the **[ASSAULT]** ability.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target is the closest eligible target', note:'+1 to hit rolls', from:'Aggressive Assault' },
        { kind:'all', when:'Damaged (1-9 wounds left)', note:'-1 to hit rolls (and -5 OC)', from:'Damaged: 1-9 Wounds Remaining' }
      ],
      // the Bondsman ability, on the ARMIGER model it is used on (this list has none)
      aura:[
        { kind:'ranged', needs:{ all:['Armiger'] }, notSelf:true, when:'Affected by Errant’s Duty (Bondsman)', note:'ranged weapons have [ASSAULT]', from:'Errant’s Duty' }
      ],
      rules:['Deadly Demise D6','Super-Heavy Walker','Code Chivalric','Assault','Bondsman','Melta','Blast'],
      kw:['Character','Faction: Imperial Knights','Imperium','Knight Errant','Questoris','Titanic','Towering','Vehicle','Walker']
    },
    {
      id:'knight-destrier', name:'Knight Destrier', role:'Character', pts:265, copies:2,
      models:['1× Knight Destrier'],
      gear:[['Questoris heavy stubber','Titanic feet','Chastiser gatling cannon','Frag bombard']],
      stats:[{ name:'Knight Destrier', M:'12"', T:'10', Sv:'3+', W:'18', Ld:'6+', OC:'8', InSv:'5+*', base:'150×95mm' }],
      ranged:[
        { name:'Questoris heavy stubber', range:'36"', A:'6', BS:'3+', S:'4', AP:'-1', D:'1', kw:['ASSAULT','RAPID FIRE 3'] },
        { name:'Chastiser gatling cannon', range:'24"', A:'12', BS:'3+', S:'6', AP:'-1', D:'2', kw:['ASSAULT'] },
        { name:'Frag bombard', range:'24"', A:'D6+3', BS:'3+', S:'7', AP:'-1', D:'2', kw:['ASSAULT','BLAST','RAPID FIRE D6+3'] }
      ],
      melee:[
        { name:'Titanic feet', range:'Melee', A:'4', WS:'4+', S:'7', AP:'-1', D:'2', kw:[] }
      ],
      abilities:[
        { name:'Damaged: 1-6 Wounds Remaining', damaged:'1-6', ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' },
          text:'While this model has 1-6 wounds remaining, subtract 4 from this model’s Objective Control characteristic and each time this model makes an attack, subtract 1 from the Hit roll.' },
        // this list's Destriers have Titanic feet, not a thundershock spear and bellatus reaper chainsword, so it does not apply
        { name:'Thundercharge',
          text:'If this model is equipped with a thundershock spear and a bellatus reaper chainsword, add 2 to the Attacks characteristic of melee weapons equipped by this model.' },
        { name:'Ram Jets', ph:['movement'], turn:'your',
          text:'Each time this unit is selected to make a Normal or Advance move, until the end of the phase, add D3" to the Move characteristic of this model.' },
        { name:'Saturation Fire', ph:['shooting'], turn:'your',
          text:'Each time this model makes a ranged attack that targets a unit within range of one or more objective markers, that attack has the **[IGNORES COVER]** ability.' },
        { name:'Invulnerable Save (5+*)', def:'5+ invulnerable save against ranged attacks only',
          text:'This model has a 5+ invulnerable save against ranged attacks.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target within range of an objective marker', note:'ranged attacks have [IGNORES COVER]', from:'Saturation Fire' },
        { kind:'all', when:'Damaged (1-6 wounds left)', note:'-1 to hit rolls (and -4 OC)', from:'Damaged: 1-6 Wounds Remaining' }
      ],
      rules:['Deadly Demise D6','Super-Heavy Walker','Code Chivalric','Assault','Rapid Fire','Blast'],
      kw:['Bellatus','Character','Faction: Imperial Knights','Imperium','Knight Destrier','Titanic','Towering','Vehicle','Walker']
    }
  ]
},
{
  id:'hurrdurr', name:'Hurrdurr', faction:'world-eaters', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Purge the Foe',
  detachments:['berzerker-warband','vessels-of-wrath'],
  source:'New Recruit, exported 16 Oct 2026',
  units:[
    {
      id:'kharn', name:'Khârn the Betrayer', role:'Epic Hero', pts:285, ptsNote:'115 + Khorne Berzerkers 170',
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
        { name:'Gorechild', who:'Khârn the Betrayer', range:'Melee', A:'9', WS:'2+', S:'7', AP:'-2', D:'3', kw:[] },
        { name:'Chainblade', who:'Khorne Berzerkers', n:8, range:'Melee', A:'5', WS:'3+', S:'5', AP:'-1', D:'1', kw:[] },
        { name:'Khornate eviscerator', who:'Khorne Berzerkers', n:2, range:'Melee', A:'4', WS:'3+', S:'8', AP:'-2', D:'2', kw:[] }
      ],
      abilities:[
        { name:'Legendary Killer', who:'Khârn the Betrayer', ph:['fight'], turn:'either',
          text:'While this model is leading a unit, each time a model in that unit makes a melee attack, re-roll a Hit roll of 1 and re-roll a Wound roll of 1.' },
        { name:'The Betrayer', who:'Khârn the Betrayer', ph:['charge'], turn:'your',
          text:'At the end of your Charge phase, if this unit is on the battlefield, is **unengaged**, and contains a **bodyguard** model, this unit makes a **leadership roll**:\n- If that **leadership roll** is failed, one **bodyguard** model in this unit is **destroyed**.' },
        { name:'Berserker Frenzy', who:'Khârn the Betrayer', def:'Khârn: the first time he is destroyed, on a 2+ he is set back up with 3 wounds at the end of the phase',
          text:'The first time this model is destroyed, at the end of the phase, roll one D6: on a 2+, set this model back up on the battlefield as close as possible to where it was destroyed and not within Engagement Range of any enemy units, with 3 wounds remaining.' },
        { name:'Blood Surge', who:'Khorne Berzerkers', ph:['shooting'], turn:'opp',
          text:'In your opponent’s Shooting phase, when an enemy unit has shot, if a model in this unit was destroyed as a result of those attacks, this unit can make a surge move of up to D6+2".' },
        { name:'Murderous Charge', who:'Khorne Berzerkers', ph:['fight'], turn:'either',
          text:'If this unit made a charge move this turn, this unit’s melee attacks have +1 S.' },
        { name:'Icon of Khorne', who:'Khorne Berzerkers',
          text:'If the bearer’s unit contains 1 or more Icons of Khorne, each time the bearer’s unit destroys an enemy unit, you gain one Bloodshed point. Each time you make a **Blessings of Khorne** roll, roll one additional D6 for each Bloodshed point you have, after which, all your Bloodshed points are lost.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        // "that unit" is the unit Khârn leads; he leads it for the whole battle
        { kind:'melee', when:'While Khârn leads this unit', note:'re-roll hit rolls of 1 and wound rolls of 1', from:'Legendary Killer' },
        { kind:'melee', when:'Made a charge move this turn', note:'+1 S', from:'Murderous Charge' }
      ],
      rules:['Leader','Blessings of Khorne'],
      kw:['Chaos','Character','Epic Hero','Faction: World Eaters','Grenades','Infantry','Khorne','Khârn the Betrayer','Battleline','Berzerkers'],
      kwNote:'Battleline and Berzerkers come from the attached Khorne Berzerkers.'
    },
    {
      id:'daemon-prince-helm', name:'Daemon Prince of Khorne', short:'Daemon Prince', role:'Character', pts:230, warlord:true, enhancement:'Helm of Brazen Ire',
      models:['1× Daemon Prince of Khorne'], gear:[['Hellforged weapons','Infernal cannon']],
      stats:[{ name:'Daemon Prince of Khorne', M:'10"', T:'10', Sv:'2+', W:'10', Ld:'6+', OC:'3', InSv:'4+', base:'60mm' }],
      ranged:[
        { name:'Infernal cannon', range:'24"', A:'3', BS:'3+', S:'5', AP:'-1', D:'2', kw:['RAPID FIRE 1'] }
      ],
      melee:[
        { group:'Hellforged weapons', name:'strike', range:'Melee', A:'9', WS:'2+', S:'8', AP:'-2', D:'3', kw:[] },
        { group:'Hellforged weapons', name:'sweep', range:'Melee', A:'17', WS:'2+', S:'6', AP:'-1', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Lord of Murder', def:'Lone Operative while within 3" of a WORLD EATERS INFANTRY unit',
          text:'While this model is within 3" of one or more friendly **WORLD EATERS INFANTRY** units, this model has the **Lone Operative** ability.' },
        { name:'Devastating Assault', ph:['charge','fight'], turn:'either',
          text:'Each time this model makes a Charge move, until the end of the turn, its hellforged weapons have the **[DEVASTATING WOUNDS]** ability.' },
        { name:'Direct the Slaughter', tag:'Once per battle round',
          text:'Once per battle round, one model from your army with this ability can use it when a friendly **WORLD EATERS** unit within 12" of this model is targeted with a Stratagem. If it does, reduce the CP cost of that Stratagem by 1CP.' },
        { name:'Helm of Brazen Ire', tag:'Enhancement', def:'-1 D to each attack allocated to this model',
          text:'Each time an attack is allocated to the bearer, subtract 1 from the Damage characteristic of that attack.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Made a charge move this turn', note:'Hellforged weapons have [DEVASTATING WOUNDS] until the end of the turn', from:'Devastating Assault' }
      ],
      rules:['Deadly Demise D3','Blessings of Khorne'],
      kw:['Chaos','Character','Daemon','Daemon Prince','Faction: World Eaters','Khorne','Monster','Warlord']
    },
    {
      id:'daemon-prince-glaive', name:'Daemon Prince of Khorne', short:'Daemon Prince', role:'Character', pts:235, enhancement:'Berzerker Glaive',
      models:['1× Daemon Prince of Khorne'], gear:[['Hellforged weapons','Infernal cannon']],
      stats:[{ name:'Daemon Prince of Khorne', M:'10"', T:'10', Sv:'2+', W:'10', Ld:'6+', OC:'3', InSv:'4+', base:'60mm' }],
      ranged:[
        { name:'Infernal cannon', range:'24"', A:'3', BS:'3+', S:'5', AP:'-1', D:'2', kw:['RAPID FIRE 1'] }
      ],
      melee:[
        { group:'Hellforged weapons', name:'strike', range:'Melee', A:'10', WS:'2+', S:'8', AP:'-2', D:'4', kw:[] },
        { group:'Hellforged weapons', name:'sweep', range:'Melee', A:'18', WS:'2+', S:'6', AP:'-1', D:'2', kw:[] }
      ],
      boostNote:'Hellforged weapons A and D already include +1 from Berzerker Glaive.',
      abilities:[
        { name:'Lord of Murder', def:'Lone Operative while within 3" of a WORLD EATERS INFANTRY unit',
          text:'While this model is within 3" of one or more friendly **WORLD EATERS INFANTRY** units, this model has the **Lone Operative** ability.' },
        { name:'Devastating Assault', ph:['charge','fight'], turn:'either',
          text:'Each time this model makes a Charge move, until the end of the turn, its hellforged weapons have the **[DEVASTATING WOUNDS]** ability.' },
        { name:'Direct the Slaughter', tag:'Once per battle round',
          text:'Once per battle round, one model from your army with this ability can use it when a friendly **WORLD EATERS** unit within 12" of this model is targeted with a Stratagem. If it does, reduce the CP cost of that Stratagem by 1CP.' },
        { name:'Berzerker Glaive', tag:'Enhancement',
          text:'Add 1 to the Attacks and Damage characteristics of melee weapons (excluding Extra Attacks weapons) equipped by the bearer.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Made a charge move this turn', note:'Hellforged weapons have [DEVASTATING WOUNDS] until the end of the turn', from:'Devastating Assault' }
      ],
      rules:['Deadly Demise D3','Blessings of Khorne'],
      kw:['Chaos','Character','Daemon','Daemon Prince','Faction: World Eaters','Khorne','Monster']
    },
    {
      id:'lord-on-juggernaut', name:'Lord on Juggernaut', role:'Character', pts:455, ptsNote:'125 + Khorne Berzerkers 330',
      leads:'Khorne Berzerkers', enhancement:'Archslaughterer',
      models:['1× Lord on Juggernaut','1× Khorne Berzerker Champion','15× Khorne Berzerker','3× Khorne Berzerker w/ eviscerator and plasma pistol','1× Khorne Berzerker w/ eviscerator and plasma pistol (Icon of Khorne)'],
      gear:[['Bladed horn','Exalted chainblade','Plasma pistol'],['Chainblade','Plasma pistol'],['Bolt pistol','Chainblade'],['Khornate eviscerator','Plasma pistol'],['Khornate eviscerator','Plasma pistol']],
      stats:[
        { name:'Lord on Juggernaut', M:'10"', T:'6', Sv:'3+', W:'7', Ld:'6+', OC:'2', InSv:'4+', base:'90×52.5mm' },
        { name:'Khorne Berzerker ×20', M:'10"', T:'5', Sv:'3+', W:'2', Ld:'6+', OC:'2', InSv:'–', base:'32mm' }
      ],
      boostNote:'Khorne Berzerker M 10" already includes Aggressive Advance.',
      ranged:[
        { group:'Plasma pistol', who:'Lord on Juggernaut', name:'standard', range:'12"', A:'1', BS:'3+', S:'7', AP:'-2', D:'1', kw:['PISTOL'] },
        { group:'Plasma pistol', who:'Lord on Juggernaut', name:'supercharge', range:'12"', A:'1', BS:'3+', S:'8', AP:'-3', D:'2', kw:['HAZARDOUS','PISTOL'] },
        { group:'Plasma pistol', who:'Khorne Berzerkers', n:5, name:'standard', range:'12"', A:'1', BS:'4+', S:'7', AP:'-2', D:'1', kw:['PISTOL'] },
        { group:'Plasma pistol', who:'Khorne Berzerkers', n:5, name:'supercharge', range:'12"', A:'1', BS:'4+', S:'8', AP:'-3', D:'2', kw:['HAZARDOUS','PISTOL'] },
        { name:'Bolt pistol', who:'Khorne Berzerkers', n:15, range:'12"', A:'1', BS:'4+', S:'5', AP:'-1', D:'1', kw:['PISTOL'] }
      ],
      melee:[
        { name:'Bladed horn', who:'Lord on Juggernaut', range:'Melee', A:'5', WS:'3+', S:'6', AP:'-1', D:'2', kw:['EXTRA ATTACKS','LANCE'] },
        { name:'Exalted chainblade', who:'Lord on Juggernaut', range:'Melee', A:'8', WS:'2+', S:'6', AP:'-1', D:'2', kw:[] },
        { name:'Chainblade', who:'Khorne Berzerkers', n:16, range:'Melee', A:'5', WS:'3+', S:'5', AP:'-1', D:'1', kw:[] },
        { name:'Khornate eviscerator', who:'Khorne Berzerkers', n:4, range:'Melee', A:'4', WS:'3+', S:'8', AP:'-2', D:'2', kw:[] }
      ],
      abilities:[
        { name:'Aggressive Advance', who:'Lord on Juggernaut',
          text:'While this model is leading a unit, models in that unit have a Move characteristic of 10" and each time a model in that unit makes a Normal, Advance, Fall Back or Charge move, it can move horizontally though terrain features.' },
        { name:'Crush All Who Stand Before Us', who:'Lord on Juggernaut', ph:['fight'], turn:'either',
          text:'Each time this model’s unit is selected to fight, you can use this ability. When determining which models in this unit are eligible to fight, any models in it that are within 3" of one or more enemy models are eligible to fight. When resolving those attacks, such models can target one of those enemy units that is within 3" of them and within Engagement Range of their unit.' },
        { name:'Archslaughterer', who:'Lord on Juggernaut', tag:'Enhancement', ph:['command'], turn:'your',
          text:'(Once per battle, per army) In your Command phase, you can use this ability. If you do, every **Blessing of Khorne** is active for this unit until the start of your next turn.' },
        { name:'Blood Surge', who:'Khorne Berzerkers', ph:['shooting'], turn:'opp',
          text:'In your opponent’s Shooting phase, when an enemy unit has shot, if a model in this unit was destroyed as a result of those attacks, this unit can make a surge move of up to D6+2".' },
        { name:'Murderous Charge', who:'Khorne Berzerkers', ph:['fight'], turn:'either',
          text:'If this unit made a charge move this turn, this unit’s melee attacks have +1 S.' },
        { name:'Icon of Khorne', who:'Khorne Berzerkers',
          text:'If the bearer’s unit contains 1 or more Icons of Khorne, each time the bearer’s unit destroys an enemy unit, you gain one Bloodshed point. Each time you make a **Blessings of Khorne** roll, roll one additional D6 for each Bloodshed point you have, after which, all your Bloodshed points are lost.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Made a charge move this turn', note:'+1 S', from:'Murderous Charge' }
      ],
      rules:['Leader','Blessings of Khorne'],
      kw:['Chaos','Character','Faction: World Eaters','Khorne','Lord on Juggernaut','Mounted','Battleline','Berzerkers','Grenades','Infantry'],
      kwNote:'Battleline, Berzerkers, Grenades and Infantry come from the attached Khorne Berzerkers.'
    },
    {
      id:'slaughterbound', name:'Slaughterbound', role:'Character', pts:240, ptsNote:'110 + Exalted Eightbound 130',
      leads:'Exalted Eightbound', enhancement:'Battle-lust',
      models:['1× Slaughterbound','1× Exalted Eightbound Champion','2× Exalted Eightbound'], gear:[['Lacerator and daemonic claw'],['Chainblades'],['Chainblades']],
      stats:[
        { name:'Slaughterbound', M:'10"', T:'6', Sv:'3+', W:'6', Ld:'6+', OC:'1', InSv:'5+', base:'50mm' },
        { name:'Exalted Eightbound ×3', M:'10"', T:'6', Sv:'3+', W:'3', Ld:'6+', OC:'1', InSv:'5+', base:'40mm' }
      ],
      melee:[
        { name:'Lacerator and daemonic claw', who:'Slaughterbound', range:'Melee', A:'7', WS:'2+', S:'10', AP:'-2', D:'2', kw:[] },
        { name:'Chainblades', who:'Exalted Eightbound', n:3, range:'Melee', A:'5', WS:'3+', S:'8', AP:'-3', D:'2', kw:['ANTI-MONSTER 3+','ANTI-VEHICLE 3+'] }
      ],
      abilities:[
        { name:'Rage Eternal', who:'Slaughterbound', ph:['command'], turn:'your',
          text:'While this model is leading a unit, in your Command phase, you can return one destroyed Bodyguard model to that unit.' },
        { name:'Possessed Lord', who:'Slaughterbound', tag:'Once per battle', ph:['fight'], turn:'either',
          text:'Once per battle, at the start of the Fight phase, this model can use this ability. If it does, until the end of the phase, add 3 to the Attacks characteristic of melee weapons equipped by this model and those weapons have the **[Devastating Wounds]** ability.' },
        { name:'Lord of the Eightbound', who:'Slaughterbound',
          text:'If this model is attached to a **WORLD EATERS POSSESSED** unit during the Declare Battle Formations step, this model has the **Deep Strike** and **Scouts 6"** abilities.' },
        { name:'Battle-lust', who:'Slaughterbound', tag:'Enhancement', ph:['charge'], turn:'either',
          text:'You can re-roll Charge rolls made for the bearer’s unit. In addition, while the Unbridled Bloodlust Blessing of Khorne is active for your army, add 1 to Charge rolls made for the bearer’s unit.' },
        { name:'Rend and Tear', who:'Exalted Eightbound', ph:['fight'], turn:'either',
          text:'Each time a model in this unit makes a melee attack that targets a **MONSTER** or **VEHICLE** unit, until the end of the phase, improve the Damage characteristic of that attack by 1.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', weapon:'Lacerator and daemonic claw', set:{ A:'10' }, when:'Possessed Lord (once per battle, start of the Fight phase)', note:'and [DEVASTATING WOUNDS] until the end of the phase', from:'Possessed Lord' },
        // "this unit" is the whole attached unit, the Slaughterbound included
        { kind:'melee', when:'vs MONSTER/VEHICLE', note:'+1 D', from:'Rend and Tear' }
      ],
      rules:['Leader','Deadly Demise D3','Blessings of Khorne','Deep Strike','Scouts 6"'],
      kw:['Chaos','Character','Daemon','Faction: World Eaters','Infantry','Khorne','Possessed','Slaughterbound','Exalted Eightbound'],
      kwNote:'Exalted Eightbound comes from the attached Exalted Eightbound.'
    },
    {
      id:'eightbound', name:'Eightbound', role:'Infantry', pts:125,
      models:['1× Eightbound Champion','2× Eightbound'], gear:[['Chainblades'],['Chainblades']],
      stats:[{ name:'Eightbound ×3', M:'10"', T:'6', Sv:'3+', W:'3', Ld:'6+', OC:'1', InSv:'5+', base:'40mm' }],
      melee:[
        { name:'Chainblades', n:3, range:'Melee', A:'6', WS:'3+', S:'8', AP:'-2', D:'2', kw:[] }
      ],
      abilities:[
        { name:'Beacons of Rage', tag:'Aura', ph:['fight'], turn:'either',
          text:'While a friendly **WORLD EATERS** unit is within 6" of this unit, each time a model in that unit makes a melee attack that targets a unit (excluding **MONSTERS** and **VEHICLES**), add 1 to the Hit roll. If that attack targets a unit that is Below Half-strength, add 1 to the Wound roll as well.' }
      ],
      aura:[
        { kind:'melee', needs:{ all:['Faction: World Eaters'] }, when:'Within 6" of Eightbound, vs non-MONSTER/VEHICLE targets', selfWhen:'Own aura, vs non-MONSTER/VEHICLE targets', note:'+1 to hit; also +1 to wound if the target is Below Half-strength', from:'Beacons of Rage' }
      ],
      rules:['Scouts 6"','Blessings of Khorne'],
      kw:['Chaos','Daemon','Eightbound','Faction: World Eaters','Infantry','Khorne','Possessed']
    },
    {
      id:'jakhals', name:'Jakhals', role:'Infantry', pts:65,
      models:['1× Jakhal Pack Leader','1× Dishonoured w/ paired manglers','8× Jakhal'], gear:[['Autopistol','Chainblades'],['Paired manglers'],['Autopistol','Chainblades']],
      stats:[
        { name:'Jakhal ×9', M:'7"', T:'4', Sv:'6+', W:'1', Ld:'7+', OC:'1', InSv:'–', base:'28.5mm' },
        { name:'Dishonoured w/ paired manglers', M:'7"', T:'4', Sv:'6+', W:'1', Ld:'7+', OC:'1', InSv:'–', base:'40mm' }
      ],
      ranged:[
        { name:'Autopistol', n:9, range:'12"', A:'1', BS:'4+', S:'3', AP:'0', D:'1', kw:['PISTOL'] }
      ],
      melee:[
        { name:'Chainblades', n:9, range:'Melee', A:'4', WS:'4+', S:'3', AP:'0', D:'1', kw:[] },
        { name:'Paired manglers', range:'Melee', A:'5', WS:'4+', S:'4', AP:'0', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Objective Ravaged', ph:['command'], turn:'your',
          text:'At the end of your Command phase, if this unit is within range of an objective marker you control, that objective marker remains under your control until your opponent’s Level of Control over that objective marker is greater than yours at the end of a phase.' }
      ],
      rules:['Blessings of Khorne'],
      kw:['Chaos','Faction: World Eaters','Grenades','Infantry','Jakhals','Khorne']
    },
    {
      id:'forgefiend', name:'Forgefiend', role:'Vehicle', pts:145, copies:2,
      models:['1× Forgefiend'], gear:[['Hades autocannon','Ectoplasma cannon','Forgefiend claws']],
      stats:[{ name:'Forgefiend', M:'10"', T:'10', Sv:'3+', W:'12', Ld:'6+', OC:'3', InSv:'5+', base:'120×92mm' }],
      ranged:[
        { name:'Hades autocannon', n:2, range:'36"', A:'6', BS:'4+', S:'8', AP:'-1', D:'2', kw:['RAPID FIRE 4'] },
        { name:'Ectoplasma cannon', range:'36"', A:'D3', BS:'4+', S:'10', AP:'-3', D:'3', kw:['BLAST','RAPID FIRE 1'] }
      ],
      melee:[
        { name:'Forgefiend claws', range:'Melee', A:'7', WS:'3+', S:'6', AP:'0', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Furious Onslaught', ph:['shooting'], turn:'your',
          text:'Each time this model makes a ranged attack that targets the closest eligible target within 18", you can re-roll the Hit roll.' },
        { name:'Damaged: 1-4 wounds remaining', damaged:'1-4',
          text:'While this model has 1-4 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'Target is the closest eligible target within 18"', note:'re-roll the hit roll', from:'Furious Onslaught' },
        { kind:'all', when:'Damaged (1-4 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-4 wounds remaining' }
      ],
      rules:['Deadly Demise D3','Blessings of Khorne'],
      kw:['Chaos','Daemon','Faction: World Eaters','Forgefiend','Khorne','Vehicle','Walker']
    },
    {
      id:'chaos-rhino', name:'Chaos Rhino', role:'Dedicated Transport', pts:75,
      models:['1× Chaos Rhino'], gear:[['Armoured tracks','Combi-bolter']],
      stats:[{ name:'Chaos Rhino', M:'12"', T:'9', Sv:'3+', W:'10', Ld:'6+', OC:'2', InSv:'–', base:'Hull' }],
      ranged:[
        { name:'Combi-bolter', range:'24"', A:'2', BS:'4+', S:'5', AP:'-1', D:'1', kw:['RAPID FIRE 4'] }
      ],
      melee:[
        { name:'Armoured tracks', range:'Melee', A:'7', WS:'3+', S:'6', AP:'0', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Meet Any Challenge', ph:['movement'], turn:'opp',
          text:'In your opponent’s Movement phase, each time an enemy unit is set up or ends a Normal, Advance or Fall Back move within 8" of this model, any units embarked within it can disembark.' },
        { name:'Transport', tag:'Capacity',
          text:'This model has a transport capacity of 12 **WORLD EATERS INFANTRY** models. It cannot transport **POSSESSED** or **TERMINATOR** models.' }
      ],
      rules:['Deadly Demise D3','Blessings of Khorne','Firing Deck 2'],
      kw:['Chaos','Dedicated Transport','Faction: World Eaters','Frame','Khorne','Rhino','Smoke','Transport','Vehicle']
    }
  ]
},
{
  id:'oioioi', name:'oioioi', faction:'thousand-sons', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Priority Assets',
  detachments:['grand-coven'],
  source:'New Recruit, exported 16 Oct 2026',
  units:[
    {
      id:'magnus', name:'Magnus the Red', role:'Epic Hero', pts:455, warlord:true,
      models:['1× Magnus the Red'], gear:[['Blade of Magnus','Gaze of Magnus','Tzeentch’s Firestorm']],
      stats:[{ name:'Magnus the Red', M:'14"', T:'11', Sv:'2+', W:'16', Ld:'5+', OC:'6', InSv:'4+', base:'100mm' }],
      ranged:[
        { name:'Gaze of Magnus', range:'24"', A:'3D3', BS:'2+', S:'11', AP:'-2', D:'3', kw:['DEVASTATING WOUNDS','PSYCHIC'] },
        { name:'Tzeentch’s Firestorm', range:'24"', A:'D6+3', BS:'2+', S:'6', AP:'-1', D:'2', kw:['BLAST','IGNORES COVER','PSYCHIC'] }
      ],
      melee:[
        { group:'Blade of Magnus', name:'strike', range:'Melee', A:'7', WS:'2+', S:'16', AP:'-3', D:'3', kw:['DEVASTATING WOUNDS','PSYCHIC'] },
        { group:'Blade of Magnus', name:'sweep', range:'Melee', A:'14', WS:'2+', S:'8', AP:'-1', D:'2', kw:['PSYCHIC'] }
      ],
      abilities:[
        { name:'Damaged: 1-6 wounds remaining', damaged:'1-6',
          text:'While this model has 1-6 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' },
        { name:'Unearthly Power', ph:['command'], turn:'either',
          text:'At the start of the battle round, select one of the abilities in the Crimson King section. Until the start of the next battle round, this model has that ability.' },
        { name:'Lord of the Planet of the Sorcerers', tag:'Psychic', ph:['shooting'], turn:'your',
          text:'This model can attempt up to 2 **Rituals** per turn instead of one, and each time this model attempts a **Ritual**, add 2 to the **Psychic test** result.' },
        // the three Crimson King choices for Unearthly Power
        { name:'Impossible Form', tag:'Crimson King · Psychic', def:'Impossible Form (if picked this round): -1 Damage to attacks against Magnus, excluding psychic attacks',
          text:'Each time an attack is made against this **PSYKER** (excluding Psychic Attacks), subtract 1 from the Damage characteristic of that attack.' },
        { name:'Treason of Tzeentch', tag:'Crimson King · Psychic', ph:['shooting'], turn:'opp',
          text:'At the start of your opponent’s Shooting phase, select one enemy unit within 24" of this **PSYKER**. Until the end of the phase, ranged weapons equipped by models in that unit have the **[HAZARDOUS]** ability.' },
        { name:'Time Flux', tag:'Crimson King · Aura, Psychic', ph:['movement'], turn:'your',
          text:'While a friendly **THOUSAND SONS** unit is within 6" of this **PSYKER**, add 2" to the Move characteristic of models in that unit.' }
      ],
      mods:[
        { kind:'all', when:'Damaged (1-6 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-6 wounds remaining' }
      ],
      rules:['Deep Strike','Deadly Demise D6','Cabal of Sorcerers'],
      kw:['Chaos','Character','Daemon','Epic Hero','Faction: Thousand Sons','Fly','Magnus the Red','Monster','Primarch','Psyker','Tzeentch','Warlord']
    },
    {
      id:'daemon-prince', name:'Daemon Prince of Tzeentch with wings', role:'Character', pts:205, enhancement:'Eldritch Vortex of E’taph',
      models:['1× Daemon Prince of Tzeentch with wings'], gear:[['Dark Blessing','Hellforged weapons','Infernal cannon']],
      stats:[{ name:'Daemon Prince of Tzeentch with wings', M:'13"', T:'9', Sv:'2+', W:'10', Ld:'6+', OC:'3', InSv:'4+', base:'60mm' }],
      boostNote:'S and D of Dark Blessing and Hellforged weapons already include +1 from Eldritch Vortex of E’taph.',
      ranged:[
        { name:'Dark Blessing', range:'24"', A:'9', BS:'2+', S:'5', AP:'-1', D:'2', kw:['IGNORES COVER','PSYCHIC','SUSTAINED HITS 1'] },
        { name:'Infernal cannon', range:'24"', A:'3', BS:'2+', S:'5', AP:'-2', D:'2', kw:[] }
      ],
      melee:[
        { group:'Hellforged weapons', name:'strike', range:'Melee', A:'6', WS:'2+', S:'9', AP:'-2', D:'4', kw:['DEVASTATING WOUNDS','PSYCHIC'] },
        { group:'Hellforged weapons', name:'sweep', range:'Melee', A:'12', WS:'2+', S:'7', AP:'-1', D:'2', kw:['DEVASTATING WOUNDS','PSYCHIC'] }
      ],
      abilities:[
        { name:'Aetherstride', tag:'Psychic', ph:['movement'], turn:'your',
          text:'In your Movement phase, when this model is set up on the battlefield using the **Deep Strike** ability, it can perform an aetherstride. If it does:\n- It can be set up anywhere on the battlefield more than 6" horizontally away from all enemy units.\n- Until the end of the turn, its Dark Blessing has the **[SUSTAINED HITS D3]** ability.\n- Until the end of the turn, it is not eligible to declare a charge.' },
        { name:'Hunter of Souls', ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' },
          text:'Each time this model makes an attack that targets a **CHARACTER** unit, re-roll a Hit roll of 1 and re-roll a Wound roll of 1 (if that attack targets a **PSYKER CHARACTER** unit, you can re-roll the Hit roll and you can re-roll the Wound roll instead). Each time this model destroys a **CHARACTER** unit, this model regains up to D3 lost wounds (if that **CHARACTER** unit was a **PSYKER**, this model regains up to 3 lost wounds instead).' },
        { name:'Eldritch Vortex of E’taph', tag:'Enhancement',
          text:'Add 1 to the Strength and Damage characteristics of Psychic weapons equipped by the bearer.' }
      ],
      mods:[
        { kind:'all', when:'vs CHARACTER units', note:'re-roll hit rolls of 1 and wound rolls of 1 (vs PSYKER CHARACTER units: re-roll the hit roll and the wound roll)', from:'Hunter of Souls' },
        { kind:'ranged', when:'After an aetherstride this turn', note:'Dark Blessing has [SUSTAINED HITS D3]', from:'Aetherstride' }
      ],
      rules:['Deadly Demise D3','Cabal of Sorcerers','Deep Strike'],
      kw:['Chaos','Character','Daemon','Daemon Prince','Faction: Thousand Sons','Fly','Monster','Psyker','Tzeentch']
    },
    {
      id:'sorcerer', name:'Sorcerer', role:'Character', pts:215, ptsNote:'100 + Rubric Marines 115',
      leads:'Rubric Marines',
      models:['1× Sorcerer','1× Aspiring Sorcerer','1× Rubric Marine w/ soulreaper cannon','3× Rubric Marine w/ warpflamer'], gear:[['Force weapon','Inferno bolt pistol','Pandaemonic Delusion','Prosperine khopesh'],['Force weapon','Malefic Curse','Warpflame pistol'],['Close combat weapon','Soulreaper cannon'],['Close combat weapon','Warpflamer']],
      stats:[
        { name:'Sorcerer', M:'6"', T:'5', Sv:'3+', W:'4', Ld:'6+', OC:'1', InSv:'5+', base:'40mm' },
        { name:'Rubric Marine ×4', M:'6"', T:'5', Sv:'3+', W:'2', Ld:'7+', OC:'2', InSv:'5+', base:'32mm' },
        { name:'Aspiring Sorcerer', M:'6"', T:'5', Sv:'3+', W:'3', Ld:'6+', OC:'2', InSv:'5+', base:'32mm' }
      ],
      boostNote:'[LETHAL HITS] on every weapon comes from Empyric Guidance (while the Sorcerer leads); [IGNORES COVER] on the Rubric Marines’ guns comes from the Icon of Flame.',
      ranged:[
        { name:'Inferno bolt pistol', who:'Sorcerer', range:'12"', A:'1', BS:'3+', S:'5', AP:'-2', D:'1', kw:['PISTOL','LETHAL HITS'] },
        { name:'Pandaemonic Delusion', who:'Sorcerer', range:'24"', A:'6', BS:'3+', S:'5', AP:'-1', D:'1', kw:['PSYCHIC','SUSTAINED HITS 3','LETHAL HITS'] },
        { name:'Malefic Curse', who:'Rubric Marines', range:'24"', A:'3', BS:'3+', S:'4', AP:'-3', D:'1', kw:['ANTI-INFANTRY 4+','DEVASTATING WOUNDS','IGNORES COVER','PSYCHIC','LETHAL HITS'] },
        { name:'Warpflame pistol', who:'Rubric Marines', range:'12"', A:'D6', BS:'–', S:'3', AP:'-1', D:'1', kw:['IGNORES COVER','PISTOL','TORRENT','LETHAL HITS'] },
        { name:'Soulreaper cannon', who:'Rubric Marines', range:'24"', A:'6', BS:'3+', S:'6', AP:'-2', D:'1', kw:['DEVASTATING WOUNDS','IGNORES COVER','LETHAL HITS'] },
        { name:'Warpflamer', who:'Rubric Marines', n:3, range:'12"', A:'D6', BS:'–', S:'4', AP:'-1', D:'1', kw:['IGNORES COVER','TORRENT','LETHAL HITS'] }
      ],
      melee:[
        { name:'Force weapon', who:'Sorcerer', range:'Melee', A:'4', WS:'3+', S:'6', AP:'-1', D:'D3', kw:['PSYCHIC','LETHAL HITS'] },
        { name:'Prosperine khopesh', who:'Sorcerer', range:'Melee', A:'3', WS:'3+', S:'5', AP:'-2', D:'2', kw:['LETHAL HITS'] },
        { name:'Force weapon', who:'Rubric Marines', range:'Melee', A:'3', WS:'3+', S:'6', AP:'-1', D:'D3', kw:['PSYCHIC','LETHAL HITS'] },
        { name:'Close combat weapon', who:'Rubric Marines', n:4, range:'Melee', A:'2', WS:'3+', S:'5', AP:'0', D:'1', kw:['LETHAL HITS'] }
      ],
      abilities:[
        { name:'Twisted Sorceries', who:'Sorcerer', tag:'Psychic', ph:['shooting','fight'], turn:'either', turns:{ shooting:'your' },
          text:'Once per battle, in your Shooting phase or the Fight phase, this model can use this ability. If it does, until the end of the phase, improve the Strength and Attacks characteristic of Psychic weapons equipped by this model by 3.' },
        { name:'Empyric Guidance', who:'Sorcerer', tag:'Psychic',
          text:'While this model is leading a unit, weapons equipped by models in that unit have the **[LETHAL HITS]** ability.' },
        { name:'Bringers of Change', who:'Rubric Marines', ph:['shooting'], turn:'your',
          text:'Each time a model in this unit makes a ranged attack, re-roll a Wound roll of 1. If the attack targets a unit within range of an objective marker you do not control, you can re-roll the Wound roll instead.' },
        { name:'Icon of Flame', who:'Rubric Marines',
          text:'Ranged weapons equipped by models in the bearer’s unit (excluding **CHARACTERS**) have the **[IGNORES COVER]** ability.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', who:'Sorcerer', when:'Twisted Sorceries used this phase (once per battle)', note:'Psychic weapons +3 S and +3 A', from:'Twisted Sorceries' },
        // "this unit" is the whole attached unit, the Sorcerer included
        { kind:'ranged', when:'Every ranged attack', note:'re-roll wound rolls of 1 (vs a unit within range of an objective marker you do not control: re-roll the wound roll)', from:'Bringers of Change' }
      ],
      rules:['Leader','Cabal of Sorcerers'],
      kw:['Chaos','Character','Faction: Thousand Sons','Grenades','Infantry','Psyker','Sorcerer','Tzeentch','Battleline','Rubric','Rubric Marines','Rubricae'],
      kwNote:'Battleline, Rubric, Rubric Marines and Rubricae come from the attached Rubric Marines.'
    },
    {
      id:'sorcerer-terminator', name:'Sorcerer in Terminator Armour', role:'Character', pts:565, ptsNote:'140 + Scarab Occult Terminators 425',
      enhancement:'Umbralefic Crystal', leads:'Scarab Occult Terminators',
      models:['1× Sorcerer in Terminator Armour','1× Scarab Occult Sorcerer','7× Scarab Occult Terminator','2× Scarab Occult Terminator w/ soulreaper cannon'],
      // Hellfyre missile rack ×2: New Recruit puts it on the unit, not on a model line (BSData: unit upgrade,
      // max 2), so which models carry it is not in the source. It is listed with the 7× line; see notes.
      gear:[['Force weapon','Gaze of Hate','Inferno combi-bolter'],['Force weapon','Malefic Curse','Inferno combi-bolter'],['Inferno combi-bolter','Prosperine khopesh','Hellfyre missile rack'],['Prosperine khopesh','Soulreaper cannon']],
      stats:[
        { name:'Sorcerer in Terminator Armour', M:'5"', T:'6', Sv:'2+', W:'5', Ld:'6+', OC:'1', InSv:'4+', base:'40mm' },
        { name:'Scarab Occult Sorcerer', M:'5"', T:'6', Sv:'2+', W:'4', Ld:'6+', OC:'1', InSv:'4+', base:'40mm' },
        { name:'Scarab Occult Terminator ×9', M:'5"', T:'6', Sv:'2+', W:'3', Ld:'7+', OC:'1', InSv:'4+', base:'40mm' }
      ],
      boostNote:'[LETHAL HITS] on every weapon comes from Empyric Guidance (while the Sorcerer leads).',
      ranged:[
        { name:'Gaze of Hate', who:'Sorcerer in Terminator Armour', range:'18"', A:'3', BS:'3+', S:'4', AP:'-3', D:'2', kw:['ANTI-MONSTER 4+','ANTI-VEHICLE 4+','DEVASTATING WOUNDS','PSYCHIC','LETHAL HITS'] },
        { name:'Inferno combi-bolter', who:'Sorcerer in Terminator Armour', range:'24"', A:'2', BS:'3+', S:'5', AP:'-2', D:'1', kw:['RAPID FIRE 2','LETHAL HITS'] },
        { name:'Malefic Curse', who:'Scarab Occult Terminators', range:'24"', A:'3', BS:'3+', S:'4', AP:'-3', D:'1', kw:['ANTI-INFANTRY 4+','DEVASTATING WOUNDS','PSYCHIC','LETHAL HITS'] },
        { name:'Inferno combi-bolter', who:'Scarab Occult Terminators', n:8, range:'24"', A:'2', BS:'3+', S:'5', AP:'-2', D:'1', kw:['RAPID FIRE 2','LETHAL HITS'] },
        { name:'Soulreaper cannon', who:'Scarab Occult Terminators', n:2, range:'24"', A:'6', BS:'3+', S:'6', AP:'-2', D:'1', kw:['DEVASTATING WOUNDS','LETHAL HITS'] },
        { name:'Hellfyre missile rack', who:'Scarab Occult Terminators', n:2, range:'36"', A:'2', BS:'3+', S:'10', AP:'-2', D:'3', kw:['LETHAL HITS'] }
      ],
      melee:[
        { name:'Force weapon', who:'Sorcerer in Terminator Armour', range:'Melee', A:'5', WS:'3+', S:'6', AP:'-1', D:'D3', kw:['PSYCHIC','LETHAL HITS'] },
        { name:'Force weapon', who:'Scarab Occult Terminators', range:'Melee', A:'4', WS:'3+', S:'6', AP:'-1', D:'D3', kw:['PSYCHIC','LETHAL HITS'] },
        { name:'Prosperine khopesh', who:'Scarab Occult Terminators', n:9, range:'Melee', A:'3', WS:'3+', S:'5', AP:'-2', D:'2', kw:['LETHAL HITS'] }
      ],
      abilities:[
        { name:'Marked by Fate', who:'Sorcerer in Terminator Armour', tag:'Psychic', ph:['shooting'], turn:'your',
          text:'At the start of your Shooting phase, select one enemy unit that is visible to this **PSYKER** model. Until the end of the phase, each time a model in this unit makes an attack that targets that enemy unit, add 1 to the Hit roll.' },
        { name:'Empyric Guidance', who:'Sorcerer in Terminator Armour', tag:'Psychic',
          text:'While this model is leading a unit, weapons equipped by models in that unit have the **[LETHAL HITS]** ability.' },
        { name:'Umbralefic Crystal', who:'Sorcerer in Terminator Armour', tag:'Enhancement', ph:['command'], turn:'your',
          text:'(Once per battle, per army) In your Command phase, if this unit is **unengaged**, you can use this ability. If you do:\n- Place this unit in **strategic reserves**.\n- This unit has **Deep Strike** until the start of your next Shooting phase.\n- This unit must make an **ingress move** in your next Movement phase (including in your first turn).' },
        { name:'Rites of Coalescence', who:'Scarab Occult Terminators', def:'-1 to wound rolls against this unit while it contains a PSYKER model',
          text:'While this unit contains one or more **PSYKER** models, each time an attack targets this unit, subtract 1 from the Wound roll.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', when:'vs the enemy unit picked at the start of your Shooting phase', note:'+1 to hit rolls', from:'Marked by Fate' }
      ],
      rules:['Leader','Deep Strike','Cabal of Sorcerers'],
      kw:['Chaos','Character','Faction: Thousand Sons','Infantry','Psyker','Sorcerer','Terminator','Tzeentch','Rubricae','Scarab Occult'],
      kwNote:'Rubricae and Scarab Occult come from the attached Scarab Occult Terminators.'
    },
    {
      id:'tzaangors', name:'Tzaangors', role:'Infantry', pts:75,
      models:['1× Twistbray','9× Tzaangor w/ Tzaangor blades'], gear:[['Tzaangor blades'],['Tzaangor blades']],
      stats:[{ name:'Tzaangors ×10', M:'6"', T:'4', Sv:'6+', W:'1', Ld:'7+', OC:'1', InSv:'6+', base:'32mm' }],
      melee:[
        { name:'Tzaangor blades', n:10, range:'Melee', A:'2', WS:'4+', S:'5', AP:'0', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Ambushing Hunters', ph:['fight'], turn:'opp',
          text:'At the end of your opponent’s turn, if this unit is more than 6" horizontally away from all enemy units, you can remove this unit from the battlefield and place it into **Strategic Reserves**.' }
      ],
      rules:['Scouts 6"'],
      kw:['Chaos','Faction: Thousand Sons','Infantry','Mutant','Tzaangors','Tzeentch']
    },
    {
      id:'enlightened', name:'Tzaangor Enlightened', role:'Mounted', pts:50, copies:2,
      models:['1× Aviarch','2× Divining spear Enlightened'], gear:[['Divining spear'],['Divining spear']],
      stats:[{ name:'Tzaangor Enlightened ×3', M:'10"', T:'4', Sv:'5+', W:'2', Ld:'7+', OC:'2', InSv:'5+', base:'40mm' }],
      melee:[
        { name:'Divining spear', n:3, range:'Melee', A:'3', WS:'4+', S:'5', AP:'-1', D:'2', kw:['LANCE','PRECISION'] }
      ],
      abilities:[
        { name:'Prophesied Doom', ph:['charge'], turn:'either',
          text:'Each time this unit makes a Charge move, select one enemy unit within Engagement Range of it, then roll one D6 for each model in this unit that is within Engagement Range of that enemy unit: for each 4+, that enemy unit suffers 1 **mortal wound**.' }
      ],
      rules:[],
      kw:['Chaos','Faction: Thousand Sons','Fly','Mounted','Mutant','Tzaangor Enlightened','Tzeentch']
    },
    {
      id:'enlightened-greatbows', name:'Tzaangor Enlightened with Fatecaster greatbows', role:'Mounted', pts:55,
      models:['1× Aviarch','2× Enlightened'], gear:[['Close combat weapon','Fatecaster greatbow'],['Close combat weapon','Fatecaster greatbow']],
      stats:[{ name:'Tzaangor Enlightened with Fatecaster greatbows ×3', M:'10"', T:'4', Sv:'5+', W:'2', Ld:'7+', OC:'2', InSv:'5+', base:'40mm' }],
      ranged:[
        { name:'Fatecaster greatbow', n:3, range:'30"', A:'2', BS:'4+', S:'5', AP:'-2', D:'2', kw:['IGNORES COVER','LETHAL HITS','PRECISION'] }
      ],
      melee:[
        { name:'Close combat weapon', n:3, range:'Melee', A:'2', WS:'4+', S:'4', AP:'0', D:'1', kw:[] }
      ],
      abilities:[
        { name:'Malign Trickery', ph:['movement'], turn:'opp',
          text:'In your opponent’s Movement phase, if an enemy unit ends a move within 8" of this unit, if this unit is not within Engagement Range of one or more enemy units, this unit can make a **Normal move** of up to D6".' }
      ],
      rules:[],
      kw:['Chaos','Faction: Thousand Sons','Fly','Mounted','Mutant','Tzaangor Enlightened','Tzaangor Enlightened with Fatecaster Greatbows','Tzeentch']
    },
    {
      id:'defiler', name:'Defiler', role:'Vehicle', pts:330,
      models:['1× Defiler'], gear:[['Ectoplasma destructor','Heavy reaper autocannon','Shearing claws','Excruciator cannon']],
      stats:[{ name:'Defiler', M:'12"', T:'11', Sv:'3+', W:'18', Ld:'6+', OC:'5', InSv:'5+', base:'160mm' }],
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
        { name:'Scuttling Walker', ph:['movement'], turn:'your',
          text:'Each time this unit makes a Normal, Advance or Fall Back move, it can move through models (excluding **TITANIC** models) and terrain features. When doing so, it can move within Engagement Range of enemy models, but cannot end that move within Engagement Range of them, and any Desperate Escape test is automatically passed.' },
        { name:'Destroyer of Futures', tag:'Once per phase, per unit', ph:['fight'], turn:'opp',
          text:'You can target this unit with the Counteroffensive stratagem, regardless of any other uses of that stratagem this phase. If you do:\n- That use is -1 CP.\n- That use does not prevent any uses of that stratagem on other units this phase.' },
        { name:'Damaged: 1-6 wounds remaining', damaged:'1-6',
          text:'While this model has 1-6 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' }
      ],
      mods:[
        { kind:'all', when:'Damaged (1-6 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-6 wounds remaining' }
      ],
      rules:['Deadly Demise D6'],
      kw:['Chaos','Daemon','Defiler','Faction: Thousand Sons','Tzeentch','Vehicle','Walker']
    }
  ]
},
{
  id:'nidzillas', name:'Nidzillas', faction:'tyranids', points:2000, pointsUsed:2000,
  battleSize:'Strike Force', disposition:'Purge the Foe',
  detachments:['crusher-stampede','talons-of-the-norn-queen'],
  source:'New Recruit, exported 16 Oct 2026',
  units:[
    {
      id:'swarmlord', name:'The Swarmlord', role:'Epic Hero', pts:210,
      models:['1× The Swarmlord'],
      gear:[['Bone Sabres','Synaptic Pulse']],
      stats:[{ name:'The Swarmlord', M:'8"', T:'10', Sv:'2+', W:'10', Ld:'7+', OC:'3', InSv:'4+', base:'60mm' }],
      ranged:[
        { name:'Synaptic Pulse', range:'18"', A:'D6+3', BS:'–', S:'5', AP:'-1', D:'2', kw:['PSYCHIC','TORRENT'] }
      ],
      melee:[
        { name:'Bone Sabres', range:'Melee', A:'8', WS:'2+', S:'9', AP:'-2', D:'3', kw:['TWIN-LINKED'] }
      ],
      abilities:[
        { name:'Hive Commander', ph:['command'], turn:'your',
          text:'At the start of your Command phase, if this model is on the battlefield, you gain 1CP' },
        { name:'Malign Presence', tag:'Aura', ph:['command','movement','shooting','charge','fight'], turn:'either',
          def:'Once per turn: an enemy stratagem that targets their unit within 12" costs +1CP',
          text:'Once per turn, when your opponent targets a unit from their army within 12" of this model with a **stratagem**, you can use this ability. If you do increase the CP cost of that use of that **stratagem** by 1CP.' },
        { name:'Domination of the Hive Mind', tag:'Aura',
          text:'While a friendly **TYRANIDS** unit is within 9" of this model, that unit is within your army’s **Synapse Range**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' }
      ],
      aura:[
        { kind:'melee', needs:{ all:['Faction: Tyranids'] }, notSelf:true, when:'Within 9" of the Swarmlord', note:'within Synapse Range, so +1 S', from:'Domination of the Hive Mind' }
      ],
      rules:['Deadly Demise D3','Shadow in the Warp','Synapse','Leader','Twin-linked','Torrent'],
      kw:['Character','Epic Hero','Faction: Tyranids','Great Devourer','Hive Tyrant','Monster','Psyker','Synapse','The Swarmlord']
    },
    {
      id:'hive-tyrant', name:'Hive Tyrant', role:'Character', pts:220, warlord:true, enhancement:'Monstrous Nemesis',
      models:['1× Hive Tyrant'],
      gear:[['Monstrous bonesword and lash whip','Monstrous scything talons']],
      stats:[{ name:'Hive Tyrant', M:'8"', T:'10', Sv:'2+', W:'10', Ld:'7+', OC:'3', InSv:'4+', base:'50mm' }],
      melee:[
        { name:'Monstrous bonesword and lash whip', range:'Melee', A:'6', WS:'2+', S:'9', AP:'-2', D:'3', kw:['TWIN-LINKED'] },
        { name:'Monstrous scything talons', range:'Melee', A:'4', WS:'2+', S:'7', AP:'-2', D:'2', kw:['EXTRA ATTACKS'] }
      ],
      abilities:[
        { name:'Onslaught', tag:'Aura, Psychic', ph:['shooting'], turn:'your',
          text:'While a friendly **TYRANIDS** unit is within 6" of this model, ranged weapons equipped by models in that unit have the **[ASSAULT]** and **[LETHAL HITS]** abilities.' },
        { name:'Will of the Hive Mind', ph:['command','movement','shooting','charge','fight'], turn:'either',
          text:'Once per battle round, one model from your army with this ability can use it when a friendly **TYRANIDS** unit within 12" of that model is targeted with a Stratagem. If it does, reduce the CP cost of that use of that Stratagem by 1CP.' },
        { name:'Monstrous Nemesis', tag:'Enhancement', ph:['fight'], turn:'either',
          text:'**TYRANIDS MONSTER** only. Each time the bearer makes a melee attack that targets a **MONSTER** or **VEHICLE** unit, add 1 to the Wound roll.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' },
        { kind:'melee', when:'vs MONSTER/VEHICLE', note:'+1 to wound rolls', from:'Monstrous Nemesis' }
      ],
      aura:[
        // notSelf: the Hive Tyrant has no ranged weapons of its own
        { kind:'ranged', needs:{ all:['Faction: Tyranids'] }, notSelf:true, when:'Within 6" of the Hive Tyrant', note:'ranged weapons have [ASSAULT] and [LETHAL HITS]', from:'Onslaught' }
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
      id:'norn-assimilator-280', name:'Norn Assimilator', short:'Assimilator (280)', role:'Monster', pts:280, enhancement:'Synaptoprescience',
      models:['1× Norn Assimilator'],
      gear:[['Monstrous scything talons','Toxinjecter Harpoon']],
      stats:[{ name:'Norn Assimilator', M:'10"', T:'11', Sv:'2+', W:'16', Ld:'7+', OC:'5', InSv:'4+', base:'100mm' }],
      boostNote:'InSv already includes the 4+ from Synaptoprescience.',
      ranged:[
        { name:'Toxinjecter Harpoon', range:'12"', A:'2', BS:'2+', S:'12', AP:'-3', D:'D6+1', kw:['HARPOONED'] }
      ],
      melee:[
        { name:'Monstrous scything talons', range:'Melee', A:'6', WS:'2+', S:'9', AP:'-2', D:'3', kw:[] },
        { name:'Toxinjecter Harpoon', range:'Melee', A:'4', WS:'2+', S:'12', AP:'-3', D:'D6+1', kw:['EXTRA ATTACKS'] }
      ],
      abilities:[
        { name:'Harpoon Barbs', ph:['movement'], turn:'opp',
          text:'Once per turn, when an enemy unit within Engagement Range of this unit is chosen to Fall Back, roll one D6; on a 2+, that unit suffers D6 mortal wounds.' },
        { name:'Damaged: 1-5 Wounds Remaining', damaged:'1-5',
          text:'While this model has 1-5 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' },
        { name:'Singular Purpose', def:'Feel No Pain 5+ while within range of its Singular Purpose objective marker',
          text:'At the start of the first battle round, select one of the following:\n- Select one enemy unit. Until the end of the battle, each time this model makes an attack that targets that unit you can re-roll the Hit roll and you can re-roll the Wound roll\n- Select one objective marker. Until the end of the battle, while this model is within range of that objective marker, it has the **Feel No Pain 5+** ability and an Objective Control characteristic of 15.' },
        { name:'Protean Purpose', tag:'Once per battle, per unit', ph:['command'], turn:'your',
          text:'(Once per battle, per unit) In your Command phase, you can use this ability. If you do, this unit can make a selection for its **Singular Purpose** ability (this replaces the previous selection).' },
        { name:'Synaptoprescience', tag:'Enhancement', text:'**NORN ASSIMILATOR** unit only. This unit has 4+ **InSv**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' },
        { kind:'all', when:'Damaged (1-5 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-5 Wounds Remaining' },
        { kind:'all', when:'vs its Singular Purpose enemy unit', note:'re-roll hit rolls and wound rolls', from:'Singular Purpose' }
      ],
      rules:['Deadly Demise D6','Shadow in the Warp','Synapse','Harpooned','Extra Attacks'],
      kw:['Faction: Tyranids','Great Devourer','Harvester','Monster','Norn Assimilator','Synapse']
    },
    {
      id:'norn-assimilator-300', name:'Norn Assimilator', short:'Assimilator (300)', role:'Monster', pts:300, enhancement:'Synaptoprescience',
      models:['1× Norn Assimilator'],
      gear:[['Monstrous scything talons','Toxinjecter Harpoon']],
      stats:[{ name:'Norn Assimilator', M:'10"', T:'11', Sv:'2+', W:'16', Ld:'7+', OC:'5', InSv:'4+', base:'100mm' }],
      boostNote:'InSv already includes the 4+ from Synaptoprescience.',
      ranged:[
        { name:'Toxinjecter Harpoon', range:'12"', A:'2', BS:'2+', S:'12', AP:'-3', D:'D6+1', kw:['HARPOONED'] }
      ],
      melee:[
        { name:'Monstrous scything talons', range:'Melee', A:'6', WS:'2+', S:'9', AP:'-2', D:'3', kw:[] },
        { name:'Toxinjecter Harpoon', range:'Melee', A:'4', WS:'2+', S:'12', AP:'-3', D:'D6+1', kw:['EXTRA ATTACKS'] }
      ],
      abilities:[
        { name:'Harpoon Barbs', ph:['movement'], turn:'opp',
          text:'Once per turn, when an enemy unit within Engagement Range of this unit is chosen to Fall Back, roll one D6; on a 2+, that unit suffers D6 mortal wounds.' },
        { name:'Damaged: 1-5 Wounds Remaining', damaged:'1-5',
          text:'While this model has 1-5 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' },
        { name:'Singular Purpose', def:'Feel No Pain 5+ while within range of its Singular Purpose objective marker',
          text:'At the start of the first battle round, select one of the following:\n- Select one enemy unit. Until the end of the battle, each time this model makes an attack that targets that unit you can re-roll the Hit roll and you can re-roll the Wound roll\n- Select one objective marker. Until the end of the battle, while this model is within range of that objective marker, it has the **Feel No Pain 5+** ability and an Objective Control characteristic of 15.' },
        { name:'Protean Purpose', tag:'Once per battle, per unit', ph:['command'], turn:'your',
          text:'(Once per battle, per unit) In your Command phase, you can use this ability. If you do, this unit can make a selection for its **Singular Purpose** ability (this replaces the previous selection).' },
        { name:'Synaptoprescience', tag:'Enhancement', text:'**NORN ASSIMILATOR** unit only. This unit has 4+ **InSv**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' },
        { kind:'all', when:'Damaged (1-5 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-5 Wounds Remaining' },
        { kind:'all', when:'vs its Singular Purpose enemy unit', note:'re-roll hit rolls and wound rolls', from:'Singular Purpose' }
      ],
      rules:['Deadly Demise D6','Shadow in the Warp','Synapse','Harpooned','Extra Attacks'],
      kw:['Faction: Tyranids','Great Devourer','Harvester','Monster','Norn Assimilator','Synapse']
    },
    {
      id:'norn-emissary-dp', name:'Norn Emissary', role:'Monster', pts:270, enhancement:'Destabilising Predation',
      models:['1× Norn Emissary'],
      gear:[['Monstrous rending claws','Monstrous scything talons','Psychic tendril']],
      stats:[{ name:'Norn Emissary', M:'10"', T:'11', Sv:'2+', W:'16', Ld:'7+', OC:'5', InSv:'4+', base:'100mm' }],
      boostNote:'Ranged keywords already include [ANTI-CHARACTER 2+] from Destabilising Predation.',
      ranged:[
        { group:'Psychic tendril', name:'neuroparasite', range:'18"', A:'2', BS:'2+', S:'8', AP:'-2', D:'D3', kw:['PRECISION','PSYCHIC','ANTI-CHARACTER 2+'] },
        { group:'Psychic tendril', name:'neurolance', range:'18"', A:'2', BS:'2+', S:'12', AP:'-3', D:'D6', kw:['MELTA 2','PSYCHIC','ANTI-CHARACTER 2+'] },
        { group:'Psychic tendril', name:'neuroblast', range:'18"', A:'2D6', BS:'2+', S:'6', AP:'-2', D:'1', kw:['BLAST','PSYCHIC','ANTI-CHARACTER 2+'] }
      ],
      melee:[
        { name:'Monstrous rending claws', range:'Melee', A:'4', WS:'2+', S:'7', AP:'-2', D:'2', kw:['EXTRA ATTACKS'] },
        { name:'Monstrous scything talons', range:'Melee', A:'6', WS:'2+', S:'9', AP:'-2', D:'3', kw:[] }
      ],
      abilities:[
        { name:'Singular Purpose', def:'Feel No Pain 5+ while within range of its Singular Purpose objective marker',
          text:'At the start of the first battle round, select one of the following:\n- Select one enemy unit. Until the end of the battle, each time this model makes an attack that targets that unit you can re-roll the Hit roll and you can re-roll the Wound roll\n- Select one objective marker. Until the end of the battle, while this model is within range of that objective marker, it has the **Feel No Pain 5+** ability and an Objective Control characteristic of 15.' },
        { name:'Damaged: 1-5 Wounds Remaining', damaged:'1-5',
          text:'While this model has 1-5 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' },
        { name:'Protean Purpose', tag:'Once per battle, per unit', ph:['command'], turn:'your',
          text:'(Once per battle, per unit) In your Command phase, you can use this ability. If you do, this unit can make a selection for its **Singular Purpose** ability (this replaces the previous selection).' },
        { name:'Destabilising Predation', tag:'Enhancement', text:'**NORN EMISSARY** unit only. This unit’s ranged attacks have **[ANTI-CHARACTER 2+]**.' },
        { name:'Unnatural Resistance', def:'Feel No Pain 4+ against mortal wounds', text:'This model has the **Feel No Pain 4+** ability against Mortal Wounds.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' },
        { kind:'all', when:'Damaged (1-5 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-5 Wounds Remaining' },
        { kind:'all', when:'vs its Singular Purpose enemy unit', note:'re-roll hit rolls and wound rolls', from:'Singular Purpose' }
      ],
      rules:['Deadly Demise D6','Shadow in the Warp','Synapse','Feel No Pain','Anti','Extra Attacks','Melta','Blast','Psychic'],
      kw:['Faction: Tyranids','Great Devourer','Monster','Norn Emissary','Psyker','Synapse']
    },
    {
      id:'norn-emissary', name:'Norn Emissary', role:'Monster', pts:270,
      models:['1× Norn Emissary'],
      gear:[['Monstrous rending claws','Monstrous scything talons','Psychic tendril']],
      stats:[{ name:'Norn Emissary', M:'10"', T:'11', Sv:'2+', W:'16', Ld:'7+', OC:'5', InSv:'4+', base:'100mm' }],
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
        { name:'Singular Purpose', def:'Feel No Pain 5+ while within range of its Singular Purpose objective marker',
          text:'At the start of the first battle round, select one of the following:\n- Select one enemy unit. Until the end of the battle, each time this model makes an attack that targets that unit you can re-roll the Hit roll and you can re-roll the Wound roll\n- Select one objective marker. Until the end of the battle, while this model is within range of that objective marker, it has the **Feel No Pain 5+** ability and an Objective Control characteristic of 15.' },
        { name:'Damaged: 1-5 Wounds Remaining', damaged:'1-5',
          text:'While this model has 1-5 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' },
        { name:'Protean Purpose', tag:'Once per battle, per unit', ph:['command'], turn:'your',
          text:'(Once per battle, per unit) In your Command phase, you can use this ability. If you do, this unit can make a selection for its **Singular Purpose** ability (this replaces the previous selection).' },
        { name:'Unnatural Resistance', def:'Feel No Pain 4+ against mortal wounds', text:'This model has the **Feel No Pain 4+** ability against Mortal Wounds.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', when:'Within Synapse Range', note:'+1 S', from:'Synapse', rule:'Synapse' },
        { kind:'all', when:'Damaged (1-5 wounds left)', note:'-1 to hit rolls', from:'Damaged: 1-5 Wounds Remaining' },
        { kind:'all', when:'vs its Singular Purpose enemy unit', note:'re-roll hit rolls and wound rolls', from:'Singular Purpose' }
      ],
      rules:['Deadly Demise D6','Shadow in the Warp','Synapse','Feel No Pain','Extra Attacks','Melta','Blast','Psychic'],
      kw:['Faction: Tyranids','Great Devourer','Monster','Norn Emissary','Psyker','Synapse']
    },
    {
      id:'tyrannofex', name:'Tyrannofex', role:'Monster', pts:180, copies:2,
      models:['1× Tyrannofex'],
      gear:[['Powerful limbs','Stinger salvoes','Acid spray']],
      stats:[{ name:'Tyrannofex', M:'9"', T:'12', Sv:'2+', W:'16', Ld:'8+', OC:'5', InSv:'–', base:'120×92mm' }],
      ranged:[
        { name:'Stinger salvoes', range:'24"', A:'8', BS:'3+', S:'5', AP:'0', D:'1', kw:[] },
        { name:'Acid spray', range:'18"', A:'D6+6', BS:'–', S:'6', AP:'-2', D:'2', kw:['TORRENT'] }
      ],
      melee:[
        { name:'Powerful limbs', range:'Melee', A:'4', WS:'3+', S:'8', AP:'0', D:'2', kw:[] }
      ],
      abilities:[
        { name:'Resilient Organism', tag:'Once per battle', def:'Once per battle: change the Damage of an attack allocated to it to 0',
          text:'Once per battle, when an attack is allocated to this model, you can change the Damage characteristic of that attack to 0.' },
        { name:'Damaged: 1-5 Wounds Remaining', damaged:'1-5',
          text:'While this model has 1-5 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.' }
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
}
];

return { version:VERSION, rules:RULES, ruleAliases:RULE_ALIASES, coreStratagems:CORE_STRATAGEMS, factions:FACTIONS, armies:ARMIES };
})();
