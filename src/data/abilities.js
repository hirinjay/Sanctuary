// All ability definitions. Mechanics are resolved in gameStore by ability id.
// type: 'active' | 'reactive' | 'passive'
// trigger: what fires a reactive (checked in doAttack / endTurn)
// usesPerEncounter: null = passive (unlimited / always on)
export const ABILITIES = {

  // ── SKELETON WARRIOR — Standard ──────────────────────────────────────
  bone_shield: {
    id:'bone_shield', name:'Bone Shield', type:'reactive', trigger:'on_hit',
    desc:'Negate damage from one hit. Resets unused at encounter start.',
    usesPerEncounter:1,
  },
  intimidate: {
    id:'intimidate', name:'Intimidate', type:'active',
    desc:'Adjacent enemies lose 1 AP next turn.',
    usesPerEncounter:1,
  },
  true_aim: {
    id:'true_aim', name:'True Aim', type:'passive',
    desc:'Attacks ignore cover and shadow bonuses.',
    usesPerEncounter:null,
  },
  volley: {
    id:'volley', name:'Volley', type:'active',
    desc:'Hit all units in a straight line up to range. Hits friendlies.',
    usesPerEncounter:1,
  },

  // ── SKELETON WARRIOR — Tier 3: Dread Knight ─────────────────────────
  fortress_shell: {
    id:'fortress_shell', name:'Fortress Shell', type:'reactive', trigger:'on_hit',
    desc:'Negate damage AND reflect 2 dmg to attacker when triggered.',
    usesPerEncounter:1,
  },
  fear_aura: {
    id:'fear_aura', name:'Fear Aura', type:'passive',
    desc:'Adjacent enemies always have -1 AP at turn start while this unit lives.',
    usesPerEncounter:null,
  },

  // ── SKELETON WARRIOR — Tier 3: Shadow Archer ────────────────────────
  ghost_arrow: {
    id:'ghost_arrow', name:'Ghost Arrow', type:'passive',
    desc:'Attacks ignore DEF and cover/shadow bonuses.',
    usesPerEncounter:null,
  },
  rain_of_arrows: {
    id:'rain_of_arrows', name:'Rain of Arrows', type:'active',
    desc:'Hit all units in a 3-tile radius. Hits friendlies.',
    usesPerEncounter:1,
  },

  // ── SKELETON WARRIOR — Whispers of the Flesh ────────────────────────
  drain_touch: {
    id:'drain_touch', name:'Drain Touch', type:'passive',
    desc:'Melee attacks restore 1 hp to self.',
    usesPerEncounter:null,
  },
  rend: {
    id:'rend', name:'Rend', type:'active',
    desc:'Attack permanently reduces target DEF by 1.',
    usesPerEncounter:1,
  },
  bloodlust: {
    id:'bloodlust', name:'Bloodlust', type:'passive',
    desc:'+1 DMG per kill this encounter. Resets next encounter.',
    usesPerEncounter:null,
  },
  frenzy: {
    id:'frenzy', name:'Frenzy', type:'active',
    desc:'Attack twice at DMG -1 each.',
    usesPerEncounter:1,
  },

  // ── SKELETON WARRIOR — Tier 3: Flesh Warden (Whispers) ──────────────
  consume: {
    id:'consume', name:'Consume', type:'active',
    desc:'One attack restores HP equal to full damage dealt.',
    usesPerEncounter:1,
  },
  devour: {
    id:'devour', name:'Devour', type:'active',
    desc:'Attack reduces target DEF by 2 AND restores 2 hp to self.',
    usesPerEncounter:1,
  },

  // ── SKELETON WARRIOR — Tier 3: Chaos Knight (Whispers) ──────────────
  carnage: {
    id:'carnage', name:'Carnage', type:'passive',
    desc:'+1 DMG and +1 Move per kill this encounter. Both reset next encounter.',
    usesPerEncounter:null,
  },
  rampage: {
    id:'rampage', name:'Rampage', type:'active',
    desc:'Move through a line of enemies dealing DMG -1 to each.',
    usesPerEncounter:1,
  },

  // ── SKELETON WARRIOR — Verdant Rite ─────────────────────────────────
  thornmail: {
    id:'thornmail', name:'Thornmail', type:'passive',
    desc:'Attackers take 1 dmg when hitting this unit in melee.',
    usesPerEncounter:null,
  },
  overgrowth_strike: {
    id:'overgrowth_strike', name:'Overgrowth Strike', type:'active',
    desc:'Attack applies Slow to target for 1 turn.',
    usesPerEncounter:1,
  },
  entangling_shot: {
    id:'entangling_shot', name:'Entangling Shot', type:'active',
    desc:'Ranged attack applies Root to target for 1 turn.',
    usesPerEncounter:1,
  },
  scatter_shot: {
    id:'scatter_shot', name:'Scatter Shot', type:'active',
    desc:'Fire at up to 3 separate targets in range at DMG -1 each.',
    usesPerEncounter:1,
  },

  // ── SKELETON WARRIOR — Tier 3: Grove Champion (Verdant) ─────────────
  briarwall: {
    id:'briarwall', name:'Briarwall', type:'passive',
    desc:'Attackers take 2 dmg and are Slowed for 1 turn.',
    usesPerEncounter:null,
  },
  stranglehold: {
    id:'stranglehold', name:'Stranglehold', type:'active',
    desc:'Apply Bind AND deal +1 dmg.',
    usesPerEncounter:1,
  },

  // ── SKELETON WARRIOR — Tier 3: Grove Warden (Verdant Archer) ────────
  thornfield_shot: {
    id:'thornfield_shot', name:'Thornfield', type:'active',
    desc:'Slow terrain in 3-tile radius for 3 turns. Enemies take 1 dmg on entry.',
    usesPerEncounter:1,
  },
  barrage: {
    id:'barrage', name:'Barrage', type:'active',
    desc:'Fire at all visible enemies in range at DMG -1. No target limit.',
    usesPerEncounter:1,
  },

  // ── GRAVE STALKER — Standard ─────────────────────────────────────────
  phase: {
    id:'phase', name:'Phase', type:'active',
    desc:'Pass through one wall tile this turn.',
    usesPerEncounter:1,
  },
  shadow_meld: {
    id:'shadow_meld', name:'Shadow Meld', type:'reactive', trigger:'on_targeted_in_shadow',
    desc:'When attacked while in a shadow tile, dodge automatically.',
    usesPerEncounter:1,
  },
  ambush: {
    id:'ambush', name:'Ambush', type:'active',
    desc:'+1 dmg and no retaliation on next attack.',
    usesPerEncounter:1,
  },
  tracker: {
    id:'tracker', name:'Tracker', type:'passive',
    desc:"Enemy patrol routes highlight when they enter vision range.",
    usesPerEncounter:null,
  },

  // ── GRAVE STALKER — Tier 3: Wraith ──────────────────────────────────
  death_mark: {
    id:'death_mark', name:'Death Mark', type:'active',
    desc:'Target takes double damage from all sources for 2 turns.',
    usesPerEncounter:1,
  },
  incorporeal: {
    id:'incorporeal', name:'Incorporeal', type:'passive',
    desc:'30% chance to dodge any hit.',
    usesPerEncounter:null,
  },

  // ── GRAVE STALKER — Tier 3: Pathfinder ──────────────────────────────
  superior_ambush: {
    id:'superior_ambush', name:'Superior Ambush', type:'active',
    desc:'+2 dmg and no retaliation on next attack.',
    usesPerEncounter:1,
  },
  wayfinder: {
    id:'wayfinder', name:'Wayfinder', type:'passive',
    desc:'When leading expedition, travel duration reduced by 2 moves.',
    usesPerEncounter:null,
  },

  // ── GRAVE STALKER — Verdant Rite ─────────────────────────────────────
  natures_veil: {
    id:'natures_veil', name:"Nature's Veil", type:'passive',
    desc:'Invisible in forest and shadow tiles until attacking.',
    usesPerEncounter:null,
  },
  thornwall: {
    id:'thornwall', name:'Thornwall', type:'reactive', trigger:'on_hit',
    desc:"Attacker's tile becomes impassable for 2 turns when triggered.",
    usesPerEncounter:1,
  },
  entangle: {
    id:'entangle', name:'Entangle', type:'active',
    desc:'Root all enemies in 2-tile radius for 1 turn.',
    usesPerEncounter:1,
  },
  overgrowth: {
    id:'overgrowth', name:'Overgrowth', type:'passive',
    desc:'Enemies moving adjacent lose 1 move remaining that turn.',
    usesPerEncounter:null,
  },

  // ── GRAVE STALKER — Tier 3: Grove Wraith (Verdant) ──────────────────
  vanish: {
    id:'vanish', name:'Vanish', type:'active',
    desc:'Untargetable for 1 full turn. Cannot attack while active.',
    usesPerEncounter:1,
  },
  briarvine: {
    id:'briarvine', name:'Briarvine', type:'reactive', trigger:'on_hit',
    desc:'Attacker Bound for 1 turn AND takes 1 dmg when triggered.',
    usesPerEncounter:1,
  },

  // ── GRAVE STALKER — Tier 3: Grove Pathfinder (Verdant) ──────────────
  mass_entangle: {
    id:'mass_entangle', name:'Mass Entangle', type:'active',
    desc:'Root all enemies in 3-tile radius for 2 turns.',
    usesPerEncounter:1,
  },
  strangling_vines: {
    id:'strangling_vines', name:'Strangling Vines', type:'passive',
    desc:'Enemies adjacent take 1 dmg per turn AND lose 1 move.',
    usesPerEncounter:null,
  },

  // ── GRAVE WARDEN — Standard ──────────────────────────────────────────
  shove: {
    id:'shove', name:'Shove', type:'active',
    desc:'Push adjacent enemy back 2 tiles. 1 dmg if stopped by wall; 1 dmg to both if pushed into another unit.',
    usesPerEncounter:1,
  },
  shield_wall: {
    id:'shield_wall', name:'Shield Wall', type:'reactive', trigger:'on_hit',
    desc:'Negate all damage from next hit. Resets unused at encounter start.',
    usesPerEncounter:1,
  },
  hold_the_line: {
    id:'hold_the_line', name:'Hold the Line', type:'passive',
    desc:'Adjacent friendlies take -1 dmg from all sources.',
    usesPerEncounter:null,
  },
  guardian: {
    id:'guardian', name:'Guardian', type:'reactive', trigger:'on_adjacent_targeted',
    desc:'When adjacent friendly is targeted, intercept attack and take damage instead.',
    usesPerEncounter:1,
  },

  // ── GRAVE WARDEN — Tier 3: Fortress ─────────────────────────────────
  shockwave: {
    id:'shockwave', name:'Shockwave', type:'active',
    desc:'2 dmg to all adjacent enemies. Push all back 1 tile. Stun any pushed into wall or unit for 1 turn.',
    usesPerEncounter:1,
  },
  immovable: {
    id:'immovable', name:'Immovable', type:'reactive', trigger:'on_hit',
    desc:'Negate damage AND deal 2 dmg back to attacker when triggered.',
    usesPerEncounter:1,
  },

  // ── GRAVE WARDEN — Tier 3: Immortal ─────────────────────────────────
  bastion: {
    id:'bastion', name:'Bastion', type:'passive',
    desc:'Adjacent friendlies take -2 dmg from all sources. Applies to self.',
    usesPerEncounter:null,
  },
  sacrifice: {
    id:'sacrifice', name:'Sacrifice', type:'reactive', trigger:'on_adjacent_targeted',
    desc:'Fully absorb lethal damage targeting adjacent ally. Own survival triggers if this would kill you.',
    usesPerEncounter:1,
  },

  // ── GRAVE WARDEN — Whispers of the Flesh ────────────────────────────
  consume_gw: {
    id:'consume_gw', name:'Consume', type:'active',
    desc:'Melee attack restores HP equal to full damage dealt.',
    usesPerEncounter:1,
  },
  undying_hunger: {
    id:'undying_hunger', name:'Undying Hunger', type:'reactive', trigger:'on_lethal_hit',
    desc:'When lethal damage would be taken, drain 3 hp from nearest living enemy and survive.',
    usesPerEncounter:1,
  },
  blood_pact: {
    id:'blood_pact', name:'Blood Pact', type:'reactive', trigger:'on_adjacent_targeted',
    desc:'When adjacent friendly would take damage, split damage evenly between them and self.',
    usesPerEncounter:1,
  },
  regenerate: {
    id:'regenerate', name:'Regenerate', type:'passive',
    desc:'Recover 1 hp per turn while in combat.',
    usesPerEncounter:null,
  },

  // ── GRAVE WARDEN — Tier 3: Flesh Titan (Whispers) ───────────────────
  devour_titan: {
    id:'devour_titan', name:'Devour', type:'active',
    desc:'+2 dmg, restores full damage dealt as HP, permanently reduces target DEF by 1.',
    usesPerEncounter:1,
  },
  death_denied: {
    id:'death_denied', name:'Death Denied', type:'reactive', trigger:'on_lethal_hit',
    desc:'Drain from ALL living enemies in 2-tile radius when triggered. Survive at combined total.',
    usesPerEncounter:1,
  },

  // ── GRAVE WARDEN — Tier 3: Flesh Immortal (Whispers) ────────────────
  life_link: {
    id:'life_link', name:'Life Link', type:'reactive', trigger:'on_adjacent_targeted',
    desc:'Fully absorb all damage targeting adjacent ally.',
    usesPerEncounter:1,
  },
  undying: {
    id:'undying', name:'Undying', type:'passive',
    desc:'Recover 2 hp per turn AND revive once per encounter at 25% maxHP automatically.',
    usesPerEncounter:null,
  },

  // ── GRAVE WARDEN — Verdant Rite ──────────────────────────────────────
  thornfield: {
    id:'thornfield', name:'Thornfield', type:'active',
    desc:'Slow terrain in 2-tile radius for 3 turns. Enemies lose 1 move on entry; friendlies unaffected.',
    usesPerEncounter:1,
  },
  root_strike: {
    id:'root_strike', name:'Root Strike', type:'reactive', trigger:'on_melee_attack_received',
    desc:'When attacked in melee, attacker is Rooted for 1 turn after hit.',
    usesPerEncounter:1,
  },

  // ── GRAVE WARDEN — Tier 3: Ancient Warden (Verdant) ─────────────────
  stranglehold_field: {
    id:'stranglehold_field', name:'Stranglehold', type:'active',
    desc:'Radius 3 tiles, lasts 5 turns. Enemies take 1 dmg AND are Slowed on entry.',
    usesPerEncounter:1,
  },
  briarvine_warden: {
    id:'briarvine_warden', name:'Briarvine', type:'reactive', trigger:'on_hit',
    desc:'Attacker Bound for 1 turn AND takes 1 dmg when triggered.',
    usesPerEncounter:1,
  },

  // ── GRAVE WARDEN — Tier 3: Grove Immortal (Verdant) ─────────────────
  living_fortress: {
    id:'living_fortress', name:'Living Fortress', type:'passive',
    desc:'Enemies adjacent take 1 dmg per turn AND lose 1 move.',
    usesPerEncounter:null,
  },
  mass_entangle_warden: {
    id:'mass_entangle_warden', name:'Mass Entangle', type:'active',
    desc:'Root all enemies in 3-tile radius for 2 turns.',
    usesPerEncounter:1,
  },

  // ── Pale Codex exclusive: Pale Warden ───────────────────────────────
  death_charge: {
    id:'death_charge', name:'Death Charge', type:'reactive', trigger:'on_low_hp',
    desc:'When HP drops below 25%, immediately move toward nearest enemy and attack.',
    usesPerEncounter:1,
  },

  // ── Tinker's Grimoire exclusives ─────────────────────────────────────
  construct_armor: {
    id:'construct_armor', name:'Construct Armor', type:'reactive', trigger:'on_hit',
    desc:'First hit each encounter reduced to 1 dmg regardless of source.',
    usesPerEncounter:1,
  },
  overclock: {
    id:'overclock', name:'Overclock', type:'active',
    desc:'Sacrifice 2 hp to deal full DMG to all adjacent enemies simultaneously.',
    usesPerEncounter:1,
  },
  failsafe: {
    id:'failsafe', name:'Failsafe', type:'passive',
    desc:'When HP hits 0, triggers survival AND deals 3 dmg to all adjacent enemies.',
    usesPerEncounter:null,
  },

  // ── Varek achievement-gated abilities ────────────────────────────────
  tether_pulse: {
    id:'tether_pulse', name:'Tether Pulse', type:'active',
    desc:'All undead within 3 tiles restore 1 HP. Cannot be used if last encounter was fled.',
    usesPerEncounter:1,
  },
  pale_ward: {
    id:'pale_ward', name:'Pale Ward', type:'active',
    desc:'One adjacent undead takes no damage from the next hit this encounter.',
    usesPerEncounter:1,
  },
  desecrate: {
    id:'desecrate', name:'Desecrate', type:'active',
    desc:'Drain hits all living units in drain range simultaneously.',
    usesPerEncounter:1,
  },
  varek_mark: {
    id:'varek_mark', name:'Mark', type:'active',
    desc:'Target enemy takes +1 dmg from all sources this turn.',
    usesPerEncounter:1,
  },
  reclaim: {
    id:'reclaim', name:'Reclaim', type:'active',
    desc:'Immediately raise your own fallen undead within 3 tiles at 50% HP.',
    usesPerEncounter:1,
  },
  phantom_sight: {
    id:'phantom_sight', name:'Phantom Sight', type:'active',
    desc:'Reveal all living enemy positions on the map for 2 turns.',
    usesPerEncounter:1,
  },
  grief: {
    id:'grief', name:'Grief', type:'passive',
    desc:'All undead +1 DMG permanently (gained after Sanctuary is lost to a raid).',
    usesPerEncounter:null,
  },
  grave_knowledge: {
    id:'grave_knowledge', name:'Grave Knowledge', type:'passive',
    desc:'Arcane dust found in +1 quantity per find.',
    usesPerEncounter:null,
  },
  unravel: {
    id:'unravel', name:'Unravel', type:'passive',
    desc:'On kill, 20% chance to automatically raise the fallen enemy at degraded stats.',
    usesPerEncounter:null,
  },

  // ── Enemy-only abilities (resolved in AI loop / doAttack) ────────────────
  // These appear on enemy units, not the player roster. Mechanics handled in code.

  e_battle_cry: {
    id:'e_battle_cry', name:'Battle Cry', type:'active', enemyOnly:true,
    desc:'All Raiders within 3 tiles gain +1 Move this turn. Once per encounter.',
    usesPerEncounter:1,
  },
  e_curse: {
    id:'e_curse', name:'Curse', type:'active', enemyOnly:true,
    desc:'Target unit is Marked for 2 turns, taking +2 dmg from all sources. Once per encounter.',
    usesPerEncounter:1,
  },
  e_rally: {
    id:'e_rally', name:'Rally', type:'reactive', enemyOnly:true,
    desc:'When a Raider falls within 4 tiles, this unit and nearby Raiders gain +1 DMG for 2 turns.',
    usesPerEncounter:1,
  },
  e_battle_hardened: {
    id:'e_battle_hardened', name:'Battle Hardened', type:'passive', enemyOnly:true,
    desc:'Takes -1 dmg from all sources (effectively +1 DEF).',
    usesPerEncounter:null,
  },
  e_execution_strike: {
    id:'e_execution_strike', name:'Execution Strike', type:'active', enemyOnly:true,
    desc:'Double damage to any unit below 30% HP. Once per encounter.',
    usesPerEncounter:1,
  },
  e_bloodrage: {
    id:'e_bloodrage', name:'Bloodrage', type:'passive', enemyOnly:true,
    desc:'Gains +1 DMG each time damaged this encounter, up to +3 total.',
    usesPerEncounter:null,
  },
  e_reckless_charge: {
    id:'e_reckless_charge', name:'Reckless Charge', type:'active', enemyOnly:true,
    desc:'Moves full movement range and attacks, taking 1 self-damage. Once per encounter.',
    usesPerEncounter:1,
  },
  e_pack_tactics: {
    id:'e_pack_tactics', name:'Pack Tactics', type:'passive', enemyOnly:true,
    desc:'+1 DMG per adjacent unit of the same faction.',
    usesPerEncounter:null,
  },
  e_alpha_presence: {
    id:'e_alpha_presence', name:'Alpha Presence', type:'passive', enemyOnly:true,
    desc:'While alive, all animal-faction allies within 5 tiles gain +1 Move per turn.',
    usesPerEncounter:null,
  },
  e_pounce: {
    id:'e_pounce', name:'Pounce', type:'active', enemyOnly:true,
    desc:'Moves full movement range, attacks, and knocks target back 1 tile. Once per encounter.',
    usesPerEncounter:1,
  },
  e_maul: {
    id:'e_maul', name:'Maul', type:'active', enemyOnly:true,
    desc:'Double damage and applies Slow for 2 turns. Once per encounter.',
    usesPerEncounter:1,
  },
  e_enrage: {
    id:'e_enrage', name:'Enrage', type:'passive', enemyOnly:true,
    desc:'When HP drops below 50%, permanently gains +2 DMG and +1 Move.',
    usesPerEncounter:null,
  },
  e_shadow_stalker: {
    id:'e_shadow_stalker', name:'Shadow Stalker', type:'passive', enemyOnly:true,
    desc:'Counts as in a shadow tile at all times. Invisible until it attacks.',
    usesPerEncounter:null,
  },
  e_intercept: {
    id:'e_intercept', name:'Intercept', type:'reactive', enemyOnly:true,
    desc:'When an adjacent adventurer is targeted, intercept and take the hit instead.',
    usesPerEncounter:1,
  },
  e_aimed_shot: {
    id:'e_aimed_shot', name:'Aimed Shot', type:'active', enemyOnly:true,
    desc:'+2 DMG on next attack. Ignores DEF. Once per encounter.',
    usesPerEncounter:1,
  },
  e_backstab: {
    id:'e_backstab', name:'Backstab', type:'passive', enemyOnly:true,
    desc:'+2 DMG when attacking Varek from outside Varek\'s vision cone.',
    usesPerEncounter:null,
  },
  e_party_heal: {
    id:'e_party_heal', name:'Heal', type:'active', enemyOnly:true,
    desc:'Restores 3 HP to the most wounded adventurer within 3 tiles.',
    usesPerEncounter:1,
  },
  e_arcane_bolt: {
    id:'e_arcane_bolt', name:'Arcane Bolt', type:'active', enemyOnly:true,
    desc:'Ranged attack +1 dmg per adjacent undead near the target.',
    usesPerEncounter:1,
  },
  e_consecrate: {
    id:'e_consecrate', name:'Consecrate', type:'active', enemyOnly:true,
    desc:'Sanctifies ground in 1-tile radius — undead take 1 dmg per turn while standing in it.',
    usesPerEncounter:1,
  },
  e_iron_will: {
    id:'e_iron_will', name:'Iron Will', type:'passive', enemyOnly:true,
    desc:'Immune to Slow and Root.',
    usesPerEncounter:null,
  },
  e_eagle_eye: {
    id:'e_eagle_eye', name:'Eagle Eye', type:'passive', enemyOnly:true,
    desc:'Ranged attacks ignore cover and shadow bonuses within full range.',
    usesPerEncounter:null,
  },
  e_shadow_vanish: {
    id:'e_shadow_vanish', name:'Shadow Vanish', type:'active', enemyOnly:true,
    desc:'Becomes untargetable for 1 turn. Cannot attack while active. Once per encounter.',
    usesPerEncounter:1,
  },
  e_party_heal_strong: {
    id:'e_party_heal_strong', name:'Greater Heal', type:'active', enemyOnly:true,
    desc:'Restores 6 HP to the most wounded adventurer within 4 tiles.',
    usesPerEncounter:1,
  },
  e_revive: {
    id:'e_revive', name:'Revive', type:'active', enemyOnly:true,
    desc:'Raises a fallen adventurer at 50% HP. Once per encounter.',
    usesPerEncounter:1,
  },
  e_arcane_bolt_strong: {
    id:'e_arcane_bolt_strong', name:'Arcane Bolt', type:'active', enemyOnly:true,
    desc:'Ranged attack. +3 dmg per adjacent undead near the target.',
    usesPerEncounter:1,
  },
  e_arcane_surge: {
    id:'e_arcane_surge', name:'Arcane Surge', type:'active', enemyOnly:true,
    desc:'Deals damage equal to undead count × 2 in a 3-tile radius. Once per encounter.',
    usesPerEncounter:1,
  },
  e_consecrate_strong: {
    id:'e_consecrate_strong', name:'Greater Consecrate', type:'active', enemyOnly:true,
    desc:'Sanctifies 2-tile radius — undead take 1 dmg per turn. Lasts 3 turns.',
    usesPerEncounter:1,
  },
  e_holy_shield: {
    id:'e_holy_shield', name:'Holy Shield', type:'reactive', enemyOnly:true,
    desc:'Reduces incoming damage to 1 once per encounter.',
    usesPerEncounter:1,
  },
};
