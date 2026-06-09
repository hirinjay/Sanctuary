// Named enemy types, grouped under an archetype (role category).
// key must exactly match the enemy's `name` field in the combat system so
// bestiary encounter tracking lines up correctly.
// Wild encounter enemies currently have T1 only — add tiers when designed.
// Generic dungeon archetypes (Wanderer, Scout, Brute) include T2/T3 scaffolding.
export const ENEMY_TYPES = [

  // ── WANDERER (raises: Skeleton Warrior) ──────────────────────────────────
  { id:'wanderer', archetype:'Wanderer', tiers:[
    { tier:1, key:'Wanderer',          name:'Wanderer',          emoji:'🚶', dc:'Skeleton Warrior', hp:6,  dmg:3, move:3, xp:8,  sight:3, spot:0.60, attackRange:1, desc:'Generic dungeon patrol. Predictable routes, average in all respects.' },
    { tier:2, key:'hollow_knight',     name:'Hollow Knight',     emoji:'⚔️',  dc:'Skeleton Warrior', hp:10, dmg:4, move:3, xp:16, sight:3, spot:0.65, attackRange:1, implemented:false },
    { tier:3, key:'wretched_revenant', name:'Wretched Revenant', emoji:'💀', dc:'Skeleton Warrior', hp:16, dmg:6, move:3, xp:28, sight:4, spot:0.70, attackRange:1, implemented:false },
  ]},
  { id:'stray_dogs', archetype:'Wanderer', tiers:[
    { tier:1, key:'Stray Dogs',    name:'Stray Dogs',    emoji:'🐕', dc:'Skeleton Warrior', hp:4, dmg:2, move:4, xp:4, sight:4, spot:0.50, attackRange:1, desc:'Feral dogs scavenging the open plains. Quick and aggressive in packs.' },
  ]},
  { id:'feral_wolves', archetype:'Wanderer', tiers:[
    { tier:1, key:'Feral Wolves',  name:'Feral Wolves',  emoji:'🐺', dc:'Skeleton Warrior', hp:5, dmg:3, move:4, xp:5, sight:5, spot:0.60, attackRange:1, desc:'Wild wolves driven to madness by the spreading corruption.' },
  ]},
  { id:'road_bandits', archetype:'Wanderer', tiers:[
    { tier:1, key:'Road Bandits',  name:'Road Bandits',  emoji:'🗡️', dc:'Skeleton Warrior', hp:5, dmg:2, move:3, xp:6, sight:3, spot:0.50, attackRange:1, desc:'Desperate survivors turned to banditry. Patrol old trade roads.' },
  ]},
  { id:'feral_ghoul', archetype:'Wanderer', tiers:[
    { tier:1, key:'Feral Ghoul',   name:'Feral Ghoul',   emoji:'🧟', dc:'Skeleton Warrior', hp:7, dmg:3, move:3, xp:8, sight:3, spot:0.50, attackRange:1, desc:'Ruin-dwelling undead. Aggressive and territorial in collapsed structures.' },
  ]},
  { id:'scavenger_gang', archetype:'Wanderer', tiers:[
    { tier:1, key:'Scavenger Gang',name:'Scavenger Gang',emoji:'⚔️',  dc:'Skeleton Warrior', hp:6, dmg:2, move:3, xp:7, sight:3, spot:0.60, attackRange:1, desc:'Looters picking through rubble. Travel in loose, dangerous groups.' },
  ]},

  // ── SCOUT (raises: Grave Stalker) ────────────────────────────────────────
  { id:'scout', archetype:'Scout', tiers:[
    { tier:1, key:'Scout',           name:'Scout',           emoji:'🏹', dc:'Grave Stalker', hp:5,  dmg:2, move:4, xp:6,  sight:5, spot:0.80, attackRange:2, desc:'Generic dungeon scout. Fast, ranged, and highly perceptive.' },
    { tier:2, key:'cursed_archer',   name:'Cursed Archer',   emoji:'🏹', dc:'Grave Stalker', hp:8,  dmg:3, move:4, xp:12, sight:6, spot:0.85, attackRange:2, implemented:false },
    { tier:3, key:'spectral_wraith', name:'Spectral Wraith', emoji:'👻', dc:'Grave Stalker', hp:12, dmg:5, move:5, xp:22, sight:7, spot:0.90, attackRange:2, implemented:false },
  ]},
  { id:'giant_spider', archetype:'Scout', tiers:[
    { tier:1, key:'Giant Spider',  name:'Giant Spider',  emoji:'🕷️', dc:'Grave Stalker', hp:6, dmg:2, move:3, xp:6,  sight:4, spot:0.70, attackRange:1, desc:'Ambush hunters lurking in forest undergrowth. Highly perceptive.' },
  ]},
  { id:'forest_bandit', archetype:'Scout', tiers:[
    { tier:1, key:'Forest Bandit', name:'Forest Bandit', emoji:'🏹', dc:'Grave Stalker', hp:5, dmg:2, move:4, xp:6,  sight:5, spot:0.80, attackRange:2, desc:'Poachers and outlaws using the canopy as cover. Ranged ambushers.' },
  ]},
  { id:'rabid_hound', archetype:'Scout', tiers:[
    { tier:1, key:'Rabid Hound',   name:'Rabid Hound',   emoji:'🐕', dc:'Grave Stalker', hp:5, dmg:3, move:5, xp:6,  sight:5, spot:0.70, attackRange:1, desc:'Disease-maddened dogs found in ruins. Extraordinarily fast and erratic.' },
  ]},
  { id:'swamp_witch', archetype:'Scout', tiers:[
    { tier:1, key:'Swamp Witch',   name:'Swamp Witch',   emoji:'🧙', dc:'Grave Stalker', hp:5, dmg:3, move:3, xp:12, sight:4, spot:0.60, attackRange:2, desc:'Hex-wielding hermits lurking in the bogs. Cunning and ranged.' },
  ]},

  // ── BRUTE (raises: Grave Warden) ─────────────────────────────────────────
  { id:'brute', archetype:'Brute', tiers:[
    { tier:1, key:'Brute',         name:'Brute',         emoji:'💪', dc:'Grave Warden', hp:10, dmg:4, move:2, xp:12, sight:2, spot:0.40, attackRange:1, desc:'Generic dungeon enforcer. Slow, heavily armored, devastating up close.' },
    { tier:2, key:'iron_brute',    name:'Iron Brute',    emoji:'🪖', dc:'Grave Warden', hp:16, dmg:6, move:2, xp:22, sight:2, spot:0.40, attackRange:1, implemented:false },
    { tier:3, key:'stone_colossus',name:'Stone Colossus',emoji:'🗿', dc:'Grave Warden', hp:24, dmg:8, move:2, xp:36, sight:2, spot:0.40, attackRange:1, implemented:false },
  ]},
  { id:'black_bear', archetype:'Brute', tiers:[
    { tier:1, key:'Black Bear',    name:'Black Bear',    emoji:'🐻', dc:'Grave Warden', hp:10, dmg:4, move:2, xp:10, sight:2, spot:0.40, attackRange:1, desc:'Territorial predator haunting deep forests. Massive and hard to stop.' },
  ]},
  { id:'giant_toad', archetype:'Brute', tiers:[
    { tier:1, key:'Giant Toad',    name:'Giant Toad',    emoji:'🐸', dc:'Grave Warden', hp:8,  dmg:3, move:2, xp:7,  sight:2, spot:0.30, attackRange:1, desc:'Bloated swamp predators. Sluggish but nearly impossible to bring down.' },
  ]},
  { id:'bog_shambler', archetype:'Brute', tiers:[
    { tier:1, key:'Bog Shambler',  name:'Bog Shambler',  emoji:'🌿', dc:'Grave Warden', hp:9,  dmg:2, move:2, xp:8,  sight:2, spot:0.40, attackRange:1, desc:'Animate vegetation twisted by swamp corruption. Resilient and relentless.' },
  ]},

  // ── RAIDER FACTION ──────────────────────────────────────────────────────────
  { id:'raider',           archetype:'Raider', tiers:[
    { tier:1, key:'Raider',            name:'Raider',            emoji:'⚔️', dc:'Skeleton Warrior', hp:5,  dmg:3, def:0, move:3, xp:5,  sight:4, spot:0.60, attackRange:1, desc:'A desperate wasteland raider. Rushes the nearest target without hesitation.' },
    { tier:2, key:'Raider Veteran',    name:'Raider Veteran',    emoji:'🗡️', dc:'Skeleton Warrior', hp:8,  dmg:4, def:0, move:3, xp:8,  sight:4, spot:0.65, attackRange:1, desc:'Hardened raider who rallies the pack with a fearsome battle cry.', abilities:['e_battle_cry'] },
    { tier:3, key:'Death Raider',      name:'Death Raider',      emoji:'💀', dc:'Skeleton Warrior', hp:11, dmg:5, def:1, move:4, xp:11, sight:4, spot:0.70, attackRange:1, desc:'Elite raider. Hardened against damage and ruthless against weakened foes.', abilities:['e_battle_hardened','e_execution_strike'] },
  ]},
  { id:'raider_shaman',    archetype:'Raider', tiers:[
    { tier:2, key:'Raider Shaman',     name:'Raider Shaman',     emoji:'🔮', dc:'Grave Stalker',    hp:4,  dmg:2, def:0, move:3, xp:5,  sight:5, spot:0.60, attackRange:3, desc:'A tribal shaman who curses enemies to amplify all damage they take.', abilities:['e_curse'] },
  ]},
  { id:'raider_captain',   archetype:'Raider', tiers:[
    { tier:2, key:'Raider Captain',    name:'Raider Captain',    emoji:'🪖', dc:'Skeleton Warrior', hp:9,  dmg:4, def:1, move:3, xp:9,  sight:5, spot:0.70, attackRange:1, desc:'Commands from the rear. Rallies fallen raiders to vengeance.', abilities:['e_rally'] },
  ]},
  { id:'raider_berserker', archetype:'Raider', tiers:[
    { tier:3, key:'Raider Berserker',  name:'Raider Berserker',  emoji:'🪓', dc:'Skeleton Warrior', hp:10, dmg:6, def:0, move:4, xp:10, sight:4, spot:0.75, attackRange:1, desc:'A berserker who grows more deadly with every wound received.', abilities:['e_bloodrage','e_reckless_charge'] },
  ]},

  // ── WILD ANIMALS ───────────────────────────────────────────────────────────
  { id:'wolf', archetype:'Animal', tiers:[
    { tier:1, key:'Wolf',            name:'Wolf',            emoji:'🐺', dc:'Skeleton Warrior', hp:4,  dmg:3, def:0, move:5, xp:4,  sight:5, spot:0.65, attackRange:1, desc:'Pack hunter. Fast and relentless but fragile alone.' },
    { tier:2, key:'Pack Wolf',       name:'Pack Wolf',       emoji:'🐺', dc:'Skeleton Warrior', hp:5,  dmg:3, def:0, move:5, xp:5,  sight:5, spot:0.65, attackRange:1, desc:'Pack tactics — grows stronger near kin. +1 dmg per adjacent wolf.', abilities:['e_pack_tactics'] },
    { tier:3, key:'Shadow Wolf',     name:'Shadow Wolf',     emoji:'🐺', dc:'Grave Stalker',    hp:8,  dmg:5, def:0, move:6, xp:8,  sight:6, spot:0.85, attackRange:1, desc:'Darkness-touched predator. Invisible in shadow until it strikes.', abilities:['e_pack_tactics','e_shadow_stalker'] },
  ]},
  { id:'dire_wolf', archetype:'Animal', tiers:[
    { tier:2, key:'Dire Wolf',       name:'Dire Wolf',       emoji:'🐺', dc:'Grave Warden',     hp:14, dmg:5, def:1, move:6, xp:14, sight:6, spot:0.80, attackRange:1, desc:'Alpha of the pack. Its presence drives wolves into a frenzy.', abilities:['e_alpha_presence','e_pounce'] },
  ]},
  { id:'cave_bear', archetype:'Animal', tiers:[
    { tier:2, key:'Cave Bear',       name:'Cave Bear',       emoji:'🐻', dc:'Grave Warden',     hp:20, dmg:6, def:2, move:3, xp:20, sight:3, spot:0.45, attackRange:1, desc:'A massive solitary predator. Never retreats. Never coordinates.', abilities:['e_maul','e_enrage'] },
  ]},
];
