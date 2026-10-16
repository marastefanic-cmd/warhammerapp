/* =====================================================================
   Warhammer companion: data.
   One file holds every army plus the faction and core rules they use.
   To add an army: append an object to ARMIES (units transcribed from the
   New Recruit PDF), add any new detachments, rules or aliases to FACTIONS /
   RULES / RULE_ALIASES, bump VERSION, then run `node build.js`.
   (build.js stamps a content hash, so installed apps reload on any change.)

   Text markup used in rules text:
     **bold**   - a line starting "- " is a bullet   - *italic line*
   Phases: command | movement | shooting | charge | fight
   Turn:   your | opp | either
===================================================================== */
window.WH_DATA = (function(){

const VERSION = '2026-10-16.10';

/* ---------------- core rules (11th edition) ---------------- */
// Weapon keyword and core ability text, from the BSData wh40k-11e game system
// (Snap Shooting from Wahapedia's core rules, 15.09).
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
  'Hunter': 'Weapon profiles marked **Hunter: MONSTER/VEHICLE** are the profile to pick when attacking a **MONSTER** or **VEHICLE** unit; use the Standard profile against everything else.\n*App note, not rules text: written for this app from how New Recruit labels the profile.*',

  'Deep Strike': 'Each time this unit makes an **ingress move** (20.04), if every model in this unit has this ability, it can be set up anywhere on the battlefield that is more than 8" horizontally from all enemy units, even if that is within your opponent’s deployment zone.',
  'Deadly Demise': 'This ability always takes the form **Deadly Demise X**. Each time a model in this unit is **destroyed**, after the units embarked within it (if any) have made their **emergency disembark moves**, roll one D6. On a 6, that model suffers a **deadly demise**; each unit within 6" of that model suffers a number of **mortal wounds** denoted by **X** (if this is a random number, roll separately for each unit within 6").',
  'Feel No Pain': 'This ability always takes the form **Feel No Pain X+**. Each time a model with this ability would lose a wound, roll one D6: on an **X+**, that wound is not lost.',
  'Leader': 'Before the battle, in the Muster Armies step, for each leader and support unit in your army, you can select one friendly bodyguard unit that unit can lead. That unit will then lead that bodyguard unit for the battle and form an attached unit with it. Unless otherwise stated, each bodyguard unit can only have one leader unit and one support unit attached to it.',
  'Lone Operative': 'Unless part of an **attached** unit, this unit is not **visible** to enemy models unless they are within 12" of this unit, and it cannot be targeted by **[INDIRECT FIRE]** weapons unless the attacking model is within 12" of this unit.',
  'Snap Shooting': 'ELIGIBLE IF: As stated in the rule allowing this shooting type.\nEFFECT: Your unit shoots as described in Making Attacks (04).\nWHILE SHOOTING:\n- You can only target one visible enemy unit within 24" of your unit (and only if it is an eligible target).\n- Each attack only hits on an unmodified hit roll of 6 (irrespective of the attacking weapon’s BS characteristic or any modifiers).\n- You cannot re-roll hit rolls.\nAFTER SHOOTING: Until the end of the phase, your unit is not eligible to start an action.',
  'Mobile': 'Models with the **MOBILE** keyword can move horizontally through **dense terrain features** (13.06).\n*App note, not rules text: taken from the designer\u2019s note under Super-Heavy Walker; check the core rules for the full MOBILE rule.*'
};

// Which RULES entry a keyword or rule chip opens ("RAPID FIRE 4" -> "Rapid Fire").
const RULE_ALIASES = [
  [/^anti-/i, 'Anti'], [/^blast/i, 'Blast'], [/^cleave/i, 'Cleave'], [/^close-quarters/i, 'Close-quarters'],
  [/^pistol/i, 'Close-quarters'], [/^devastating/i, 'Devastating Wounds'], [/^extra attacks/i, 'Extra Attacks'],
  [/^hazardous/i, 'Hazardous'], [/^ignores cover/i, 'Ignores Cover'], [/^lethal hits/i, 'Lethal Hits'],
  [/^precision/i, 'Precision'], [/^rapid fire/i, 'Rapid Fire'], [/^sustained hits/i, 'Sustained Hits'],
  [/^torrent/i, 'Torrent'], [/^twin-linked/i, 'Twin-linked'], [/^assault/i, 'Assault'],
  [/^deep strike/i, 'Deep Strike'], [/^deadly demise/i, 'Deadly Demise'], [/^feel no pain/i, 'Feel No Pain'],
  [/^leader/i, 'Leader'], [/^lone operative/i, 'Lone Operative'], [/^mobile/i, 'Mobile'], [/^hunter/i, 'Hunter'], [/^snap shooting/i, 'Snap Shooting']
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
  { id:'heroic-intervention', name:'Heroic Intervention', cp:1, phases:['charge'], turn:'opp',
    when:'End of your opponent’s Charge phase.',
    target:'One friendly unengaged unit within 12" of one or more enemy units. You can only select a **VEHICLE** unit if it is a **CHARACTER/WALKER** unit.',
    effect:'Resolve a charge with your unit (11.02). While doing so, before making the charge roll, you must select one of the following modes:\n- **Leap to Defend:** When selecting charge targets, you can only select enemy units that made a charge move this phase and are within the maximum distance.\n- **Into the Fray (+1CP):** When making the charge roll, if the result is greater than 6 (after modifiers), change it to 6. When selecting charge targets, you can select any enemy units that are within 6" of your unit and within the maximum distance.' },
  { id:'counteroffensive', name:'Counteroffensive', cp:2, phases:['fight'], turn:'opp',
    when:'Fight step of your opponent’s Fight phase, just after an enemy unit has resolved its attacks.',
    target:'One friendly unit that is eligible to fight.',
    effect:'Until the end of the phase, your unit has the Fights First ability and it must be the next unit you select to fight (12.04).' }
];

/* ---------------- factions ---------------- */
const FACTIONS = {
  orks: {
    name: 'Orks',
    // words players use for a rule that has another name
    aliases: [[/^riled up/i, 'Waaagh!']],
    armyRules: [
      { name:'Waaagh!', text:'Friendly **ORKS** units with this ability can:\n- Re-roll **advance rolls**.\n- Become **riled up**, as stated in other rules.\nWhile a unit is **riled up**:\n- That unit has 5+ **InSv**.\n- That unit’s ranged attacks have **[ASSAULT]**.\n- When that unit is selected to make an **advance move**, that **advance move** does not prevent that unit from being **eligible to declare a charge**.' },
      { name:'War Cry', tag:'Once per battle, per army', ph:['command'], turn:'your',
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
        rule:{ name:'Da Hunt Is On', ph:['shooting','fight'], turn:'either', needs:{ all:['Beast Snagga'] },
          mod:{ kind:'all', when:'vs MONSTER/VEHICLE', note:'+1 AP' },
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
        rule:{ name:'Try Dat Button!', ph:['shooting','fight'], turn:'either', needs:{ all:['Walker'], none:['Titanic'] },
          mod:{ kind:'all', when:'Selected to attack', note:'roll D6: 1–2 +1 A, 3–4 +2 S, 5–6 +1 AP (two dice: hazard roll after)' },
          text:'In your Shooting phase or the Fight phase, when a friendly **ORKS WALKER** unit (excluding **TITANIC** units) is **selected to attack**, you can use this ability. If you do, roll either one D6 or two D6 (keep re-rolling duplicate results). This unit’s attacks have the relevant rule(s):\nIf you rolled two D6, when this unit has attacked, this unit makes one **hazard roll**.',
          table:[['1–2','+1 **A**'],['3–4','+2 **S**'],['5–6','+1 **AP**']] },
        enhancements:[
          { name:'Cybork Boosta', pts:10, text:'**BIG MEK/MEK** model only. This model has +2" **M**.' },
          { name:'Dreadherder', pts:30, text:'**BIG MEK** model only. While this model is within 3" of a friendly **ORKS WALKER** unit (excluding **BIG MEK** units):\n- This model has **Lone Operative**.\n- In your Shooting phase, you can select one friendly **ORKS WALKER** unit within 3" of this model. That unit’s attacks can re-roll **hit rolls** of 1 until the end of the turn.' }
        ],
        stratagems:[
          { id:'crazed-rampage', name:'Crazed Rampage', cp:1, phases:['fight'], turn:'either', needs:{ all:['Walker'], none:['Titanic'] },
            when:'Fight phase, when an enemy unit targets a friendly **ORKS WALKER** unit (excluding **TITANIC** units).',
            target:'That **ORKS WALKER** unit.',
            effect:'When a model in your unit is destroyed, if your unit has not been selected to fight this phase, roll one D6, with +3 to the result if your unit has **DEFF DREAD**:\n- On a 4+, do not remove that model from the battlefield. When your unit has fought, or at the end of the phase (whichever comes first), that model is removed from the battlefield.' },
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
     stats       one row per model profile: M T Sv W Ld OC InSv base
     boostNote   a stat that already includes an enhancement
     ranged / melee  weapons: name, range, A, BS|WS, S, AP, D, kw[]
                 group  joins the "pick one profile" rows of one weapon
                 who    which model in an attached unit carries it
                 n      how many models carry it
                 hunter the Hunter: MONSTER/VEHICLE profile; enh  weapon from an enhancement
     abilities   name, text, tag, who; ph/turn = the phase it triggers in
     mods        abilities that change attacks (kind ranged|melee|all, who = only those models).
                 With weapon + set, that weapon shows two profiles: baseWhen (normal stats)
                 and when (set applied). Otherwise note is a reminder line in the weapon table.
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
      models:['1× Ghazghkull Thraka'],
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
        { name:'Da Grand Warlord’s Ladz', text:'While this unit is within 3" of another friendly **ORKS INFANTRY** unit, this unit has **Lone Operative**.' },
        { name:'Prophet of Da Great Waaagh!', tag:'Aura', ph:['fight'], turn:'either',
          text:'While a friendly **ORKS** unit is within 6" of this unit, that unit’s melee attacks have:\n- +1 to **hit rolls**.\n- +1 to **wound rolls**.' }
      ],
      rules:['Waaagh!','Da Boss'],
      kw:['Character','Epic Hero','Explosives','Faction: Orks','Ghazghkull Thraka','Infantry','Warboss','Warlord']
    },
    {
      id:'mozrog', name:'Mozrog Skragbad', role:'Epic Hero', pts:170,
      models:['1× Mozrog Skragbad'],
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
        { name:'Beast Snagga Following', text:'While this unit is within 3" of a friendly **BEAST SNAGGA** unit (excluding **MONSTER CHARACTER** units), this unit has **Lone Operative**.' },
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
      models:['1× Nazdreg','3× Meganob w/ Kombi-weapon and Killsaw','2× Meganob w/ Kombi-weapon and Power Klaw'],
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
        { name:'Arrogant Invulnerability', who:'Meganobz', text:'Attacks that target this unit have -1 **AP**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'melee', who:'Meganobz', when:'Riled up', note:'Meganobz +1 to hit rolls', from:'Krumpin’ Time · Fight phase' }
      ],
      rules:['Waaagh!','Leader','Da Boss','Deep Strike'],
      kw:['Character','Epic Hero','Faction: Orks','Infantry','Mega Armour','Nazdreg','Warboss','Explosives','Meganobz'],
      kwNote:'Explosives and Meganobz come from the attached Meganobz.'
    },
    {
      id:'beastboss-bbk', name:'Beastboss on Squigosaur', short:'Beastboss', role:'Character', pts:170, enhancement:'Brutal But Kunnin’',
      models:['1× Beastboss on Squigosaur'],
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
        { name:'Thundering Stampede', tag:'Aura', ph:['charge'], turn:'your', text:'Friendly **BEAST SNAGGA** units within 6" of this unit have +1 to **charge rolls**.' },
        { name:'Boss of da Hunt', text:'While this unit is within 3" of a friendly **BEAST SNAGGA** unit (excluding **MONSTER CHARACTER** units), this unit has **Lone Operative**.' },
        { name:'Keep Huntin’!', tag:'Once per battle round, per army', ph:['movement'], turn:'your',
          text:'In your Movement phase, at the start or end of this unit’s move, you can select one friendly **BEAST SNAGGA** unit within 6" of this unit. That unit:\n- Is no longer **battle-shocked**.\n- Is **riled up** until the start of your next turn.' },
        { name:'Brutal But Kunnin’', tag:'Enhancement', text:'**WARBOSS** model only. This model’s melee attacks have +1 **D**.' }
      ],
      rules:['Da Boss','Waaagh!','Feel No Pain 5+'],
      kw:['Beast Snagga','Beastboss on Squigosaur','Character','Faction: Orks','Monster','Warboss']
    },
    {
      id:'beastboss-gobshot', name:'Beastboss on Squigosaur', short:'Beastboss', role:'Character', pts:160, enhancement:'Da Gobshot Thunderbuss',
      models:['1× Beastboss on Squigosaur'],
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
        { name:'Thundering Stampede', tag:'Aura', ph:['charge'], turn:'your', text:'Friendly **BEAST SNAGGA** units within 6" of this unit have +1 to **charge rolls**.' },
        { name:'Boss of da Hunt', text:'While this unit is within 3" of a friendly **BEAST SNAGGA** unit (excluding **MONSTER CHARACTER** units), this unit has **Lone Operative**.' },
        { name:'Keep Huntin’!', tag:'Once per battle round, per army', ph:['movement'], turn:'your',
          text:'In your Movement phase, at the start or end of this unit’s move, you can select one friendly **BEAST SNAGGA** unit within 6" of this unit. That unit:\n- Is no longer **battle-shocked**.\n- Is **riled up** until the start of your next turn.' }
      ],
      rules:['Da Boss','Waaagh!','Feel No Pain 5+'],
      kw:['Beast Snagga','Beastboss on Squigosaur','Character','Faction: Orks','Monster','Warboss']
    },
    {
      id:'dakkarig-boosta', name:'Big Mek Dakkarig', short:'Big Mek', role:'Character', pts:170, enhancement:'Cybork Boosta',
      models:['1× Big Mek Dakkarig'],
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
        { kind:'ranged', weapon:'Blitzkannon', baseWhen:'vs Monster/Vehicle', when:'vs anything else', set:{ A:'14' },
          from:'Blitz Dem Gitz!', note:'+6 A, your Shooting phase only (else A 8).' },
        { kind:'ranged', when:'Riled up', note:'ranged attacks have [SUSTAINED HITS 1]', from:'Even More Dakka' }
      ],
      rules:['Deadly Demise 1','Waaagh!'],
      kw:['Big Mek','Big Mek Dakkarig','Character','Faction: Orks','Vehicle','Walker']
    },
    {
      id:'dakkarig-herder', name:'Big Mek Dakkarig', short:'Big Mek', role:'Character', pts:190, enhancement:'Dreadherder',
      models:['1× Big Mek Dakkarig'],
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
        { name:'Dreadherder', tag:'Enhancement', ph:['shooting'], turn:'your',
          text:'**BIG MEK** model only. While this model is within 3" of a friendly **ORKS WALKER** unit (excluding **BIG MEK** units):\n- This model has **Lone Operative**.\n- In your Shooting phase, you can select one friendly **ORKS WALKER** unit within 3" of this model. That unit’s attacks can re-roll **hit rolls** of 1 until the end of the turn.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'ranged', weapon:'Blitzkannon', baseWhen:'vs Monster/Vehicle', when:'vs anything else', set:{ A:'14' },
          from:'Blitz Dem Gitz!', note:'+6 A, your Shooting phase only (else A 8).' },
        { kind:'ranged', when:'Riled up', note:'ranged attacks have [SUSTAINED HITS 1]', from:'Even More Dakka' }
      ],
      rules:['Deadly Demise 1','Waaagh!'],
      kw:['Big Mek','Big Mek Dakkarig','Character','Faction: Orks','Vehicle','Walker']
    },
    {
      id:'gretchin', name:'Gretchin', role:'Infantry', pts:45, copies:3,
      models:['10× Gretchin'],
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
      models:['3× Deffkopta'],
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
        { kind:'ranged', when:'After an ingress move this turn', note:'+1 to hit rolls', from:'Deff from Above · your Shooting phase' }
      ],
      rules:['Deep Strike','Waaagh!'],
      kw:['Deffkoptas','Explosives','Faction: Orks','Fly','Mounted','Speed Freeks']
    },
    {
      id:'killa-kans', name:'Killa Kans', role:'Vehicle', pts:275,
      models:['6× Killa Kan'],
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
        { name:'Spiteful Power Trip', ph:['shooting','fight'], turn:'either', text:'This unit’s attacks that target a unit that has no models with a **T** of 7+ have +1 to **hit rolls**.' }
      ],
      // abilities that change this unit's attacks, shown inside its weapon tables
      mods:[
        { kind:'all', when:'Target has no models with T 7+', note:'+1 to hit rolls', from:'Spiteful Power Trip' }
      ],
      rules:['Deadly Demise 1','Waaagh!'],
      kw:['Faction: Orks','Grots','Killa Kans','Vehicle','Walker']
    }
  ]
}
];

return { version:VERSION, rules:RULES, ruleAliases:RULE_ALIASES, coreStratagems:CORE_STRATAGEMS, factions:FACTIONS, armies:ARMIES };
})();
