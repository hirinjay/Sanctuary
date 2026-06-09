// Data-driven enemy definitions. spawnEnemies() uses this to pick faction-appropriate
// enemies by tier. Add entries here to create new enemies without changing combat code.
//
// faction:    'raider' | 'animal' | 'adventurer' | 'dungeon'
// aiRole:     'melee' | 'ranged' | 'support' | 'berserker' | 'pack' | 'alpha' | 'flanker' | 'territorial'
// abilities:  ability IDs (resolved in endTurn AI loop and doAttack)
// dc:         raise class when Varek raises this corpse
// isSolo:     true = always spawns alone (Cave Bear)

export const ENEMY_DEFS = [

  // ── RAIDER FACTION ──────────────────────────────────────────────────────────
  {
    id: 'raider', name: 'Raider', tier: 1, faction: 'raider', aiRole: 'berserker',
    hp: 5, dmg: 3, def: 0, move: 3, attackRange: 1, sight: 4, spot: 0.60,
    dc: 'Skeleton Warrior', emoji: '⚔️',
    abilities: [],
    desc: 'A desperate wasteland raider. Rushes the nearest target without hesitation.',
  },
  {
    id: 'raider_veteran', name: 'Raider Veteran', tier: 2, faction: 'raider', aiRole: 'berserker',
    hp: 8, dmg: 4, def: 0, move: 3, attackRange: 1, sight: 4, spot: 0.65,
    dc: 'Skeleton Warrior', emoji: '🗡️',
    abilities: ['e_battle_cry'],
    desc: 'Hardened raider who rallies the pack with a fearsome battle cry.',
  },
  {
    id: 'raider_shaman', name: 'Raider Shaman', tier: 2, faction: 'raider', aiRole: 'ranged',
    hp: 4, dmg: 2, def: 0, move: 3, attackRange: 3, sight: 5, spot: 0.60,
    dc: 'Grave Stalker', emoji: '🔮',
    abilities: ['e_curse'],
    desc: 'A tribal shaman who curses enemies to amplify all damage they take.',
  },
  {
    id: 'raider_captain', name: 'Raider Captain', tier: 2, faction: 'raider', aiRole: 'territorial',
    hp: 9, dmg: 4, def: 1, move: 3, attackRange: 1, sight: 5, spot: 0.70,
    dc: 'Skeleton Warrior', emoji: '🪖',
    abilities: ['e_rally'],
    desc: 'Commands from the rear and rallies fallen raiders to vengeance.',
    triggerRadius: 4,
  },
  {
    id: 'death_raider', name: 'Death Raider', tier: 3, faction: 'raider', aiRole: 'berserker',
    hp: 11, dmg: 5, def: 1, move: 4, attackRange: 1, sight: 4, spot: 0.70,
    dc: 'Skeleton Warrior', emoji: '💀',
    abilities: ['e_battle_hardened', 'e_execution_strike'],
    desc: 'Elite raider. Hardened against damage and ruthless against weakened foes.',
  },
  {
    id: 'raider_berserker', name: 'Raider Berserker', tier: 3, faction: 'raider', aiRole: 'berserker',
    hp: 10, dmg: 6, def: 0, move: 4, attackRange: 1, sight: 4, spot: 0.75,
    dc: 'Skeleton Warrior', emoji: '🪓',
    abilities: ['e_bloodrage', 'e_reckless_charge'],
    desc: 'A berserker who grows more deadly with every wound received.',
  },

  // ── WILD ANIMALS ───────────────────────────────────────────────────────────
  {
    id: 'wolf', name: 'Wolf', tier: 1, faction: 'animal', aiRole: 'pack',
    hp: 4, dmg: 3, def: 0, move: 5, attackRange: 1, sight: 5, spot: 0.65,
    dc: 'Skeleton Warrior', emoji: '🐺',
    abilities: [],
    desc: 'Pack hunter. Fast and relentless but fragile alone.',
  },
  {
    id: 'pack_wolf', name: 'Pack Wolf', tier: 2, faction: 'animal', aiRole: 'pack',
    hp: 5, dmg: 3, def: 0, move: 5, attackRange: 1, sight: 5, spot: 0.65,
    dc: 'Skeleton Warrior', emoji: '🐺',
    abilities: ['e_pack_tactics'],
    desc: 'Pack tactics — grows stronger near kin. +1 dmg per adjacent wolf.',
  },
  {
    id: 'dire_wolf', name: 'Dire Wolf', tier: 2, faction: 'animal', aiRole: 'alpha',
    hp: 14, dmg: 5, def: 1, move: 6, attackRange: 1, sight: 6, spot: 0.80,
    dc: 'Grave Warden', emoji: '🐺',
    abilities: ['e_alpha_presence', 'e_pounce'],
    desc: 'Alpha of the pack. Its presence drives wolves into a frenzy.',
  },
  {
    id: 'shadow_wolf', name: 'Shadow Wolf', tier: 3, faction: 'animal', aiRole: 'pack',
    hp: 8, dmg: 5, def: 0, move: 6, attackRange: 1, sight: 6, spot: 0.85,
    dc: 'Grave Stalker', emoji: '🐺',
    abilities: ['e_pack_tactics', 'e_shadow_stalker'],
    desc: 'Darkness-touched predator. Invisible in shadow until it strikes.',
  },
  {
    id: 'cave_bear', name: 'Cave Bear', tier: 2, faction: 'animal', aiRole: 'berserker',
    hp: 20, dmg: 6, def: 2, move: 3, attackRange: 1, sight: 3, spot: 0.45,
    dc: 'Grave Warden', emoji: '🐻',
    abilities: ['e_maul', 'e_enrage'],
    isSolo: true,
    desc: 'A massive solitary predator. Never retreats. Never coordinates.',
  },

  // ── ADVENTURING PARTIES (spawn after bounty threshold — see HANDOFF.md) ────
  {
    id: 'adv_sword', name: 'Sword & Shield', tier: 2, faction: 'adventurer', aiRole: 'melee',
    hp: 12, dmg: 4, def: 2, move: 3, attackRange: 1, sight: 4, spot: 0.70,
    dc: 'Grave Warden', emoji: '🛡️',
    abilities: ['e_intercept'],
    desc: 'A stalwart defender who interposes himself between allies and Varek.',
  },
  {
    id: 'adv_ranger', name: 'Ranger', tier: 2, faction: 'adventurer', aiRole: 'ranged',
    hp: 7, dmg: 4, def: 0, move: 4, attackRange: 3, sight: 6, spot: 0.85,
    dc: 'Grave Stalker', emoji: '🏹',
    abilities: ['e_aimed_shot'],
    desc: 'A precise hunter who prioritizes Varek as a target.',
  },
  {
    id: 'adv_rogue', name: 'Rogue', tier: 2, faction: 'adventurer', aiRole: 'flanker',
    hp: 6, dmg: 5, def: 0, move: 5, attackRange: 1, sight: 5, spot: 0.75,
    dc: 'Grave Stalker', emoji: '🗡️',
    abilities: ['e_backstab'],
    desc: 'Flanks Varek specifically, striking for bonus damage from behind.',
  },
  {
    id: 'adv_cleric', name: 'Cleric', tier: 2, faction: 'adventurer', aiRole: 'support',
    hp: 6, dmg: 2, def: 1, move: 2, attackRange: 3, sight: 4, spot: 0.60,
    dc: 'Skeleton Warrior', emoji: '✝️',
    abilities: ['e_party_heal'],
    desc: 'Keeps the party alive. Heals the most wounded adventurer each turn.',
  },
  {
    id: 'adv_mage', name: 'Mage', tier: 2, faction: 'adventurer', aiRole: 'ranged',
    hp: 4, dmg: 5, def: 0, move: 2, attackRange: 4, sight: 6, spot: 0.75,
    dc: 'Grave Stalker', emoji: '🧙',
    abilities: ['e_arcane_bolt'],
    desc: 'Devastating ranged caster. Arcane Bolt gains power against clustered undead.',
  },
  {
    id: 'adv_paladin', name: 'Paladin', tier: 2, faction: 'adventurer', aiRole: 'melee',
    hp: 10, dmg: 3, def: 2, move: 3, attackRange: 1, sight: 4, spot: 0.65,
    dc: 'Grave Warden', emoji: '⚔️',
    abilities: ['e_consecrate'],
    desc: 'Holy warrior who consecrates ground to damage undead over time.',
  },

  // ── TIER 3 ADVENTURERS ─────────────────────────────────────────────────────
  {
    id: 'adv_veteran_sword', name: 'Veteran Sword & Shield', tier: 3, faction: 'adventurer', aiRole: 'melee',
    hp: 16, dmg: 5, def: 3, move: 3, attackRange: 1, sight: 4, spot: 0.70,
    dc: 'Grave Warden', emoji: '🛡️',
    abilities: ['e_intercept', 'e_iron_will'],
    desc: 'Battle-hardened defender. Immune to Slow and Root.',
  },
  {
    id: 'adv_veteran_ranger', name: 'Veteran Ranger', tier: 3, faction: 'adventurer', aiRole: 'ranged',
    hp: 9, dmg: 5, def: 0, move: 4, attackRange: 4, sight: 7, spot: 0.90,
    dc: 'Grave Stalker', emoji: '🏹',
    abilities: ['e_aimed_shot', 'e_eagle_eye'],
    desc: 'Expert hunter. Eagle Eye lets shots pass through cover.',
  },
  {
    id: 'adv_veteran_rogue', name: 'Veteran Rogue', tier: 3, faction: 'adventurer', aiRole: 'flanker',
    hp: 8, dmg: 6, def: 0, move: 6, attackRange: 1, sight: 5, spot: 0.80,
    dc: 'Grave Stalker', emoji: '🗡️',
    abilities: ['e_backstab', 'e_shadow_vanish'],
    desc: 'Master assassin. Can vanish, becoming untargetable for one turn.',
  },
  {
    id: 'adv_veteran_cleric', name: 'Veteran Cleric', tier: 3, faction: 'adventurer', aiRole: 'support',
    hp: 8, dmg: 2, def: 1, move: 2, attackRange: 4, sight: 5, spot: 0.65,
    dc: 'Skeleton Warrior', emoji: '✝️',
    abilities: ['e_party_heal_strong', 'e_revive'],
    desc: 'Can revive fallen adventurers at half HP. A dangerous presence.',
  },
  {
    id: 'adv_veteran_mage', name: 'Veteran Mage', tier: 3, faction: 'adventurer', aiRole: 'ranged',
    hp: 6, dmg: 7, def: 0, move: 2, attackRange: 5, sight: 7, spot: 0.80,
    dc: 'Grave Stalker', emoji: '🧙',
    abilities: ['e_arcane_bolt_strong', 'e_arcane_surge'],
    desc: 'Arcane Surge deals damage equal to undead count × 2. Terrifying at scale.',
  },
  {
    id: 'adv_veteran_paladin', name: 'Veteran Paladin', tier: 3, faction: 'adventurer', aiRole: 'melee',
    hp: 13, dmg: 5, def: 3, move: 3, attackRange: 1, sight: 4, spot: 0.70,
    dc: 'Grave Warden', emoji: '⚔️',
    abilities: ['e_consecrate_strong', 'e_holy_shield'],
    desc: 'Veteran paladin. Holy Shield can reduce a single hit to 1 damage.',
  },
];

// Quick lookup: faction → pool of ENEMY_DEFS
export const FACTION_POOLS = {
  raider:     ENEMY_DEFS.filter(e => e.faction === 'raider'),
  animal:     ENEMY_DEFS.filter(e => e.faction === 'animal' && !e.isSolo),
  adventurer: ENEMY_DEFS.filter(e => e.faction === 'adventurer'),
};

// Tier table:  Danger 1 F1=T1, D1 F2-3=T2, D2 F1-2=T2, D2 F3+=T3, D3 F1-2=T2, D3 F3+=T3, boss floor=T3
export function calcEnemyTier(danger, floor, isBossFloor = false) {
  if (isBossFloor) return 3;
  if (danger <= 1) return floor <= 1 ? 1 : 2;
  if (danger === 2) return floor <= 2 ? 2 : 3;
  return floor <= 2 ? 2 : 3; // danger 3+
}

// XP kill bonus by tier (applied to maxHp fraction)
export function killXpByTier(maxHp, tier, isBoss = false) {
  if (isBoss) return Math.ceil(maxHp / 2);
  if (tier === 3) return Math.ceil(maxHp / 3);
  if (tier === 2) return Math.ceil(maxHp / 4);
  return Math.ceil(maxHp / 5); // tier 1
}

// Attacker tier from level (reborn counts one higher)
export function unitTier(level, reborn = false) {
  const effective = reborn ? level + 4 : level;
  if (effective >= 9) return 3;
  if (effective >= 5) return 2;
  return 1;
}

// XP multiplier when attacker tier vs enemy tier differ
export function xpTierMultiplier(attackerLevel, attackerReborn, enemyTier) {
  const atkTier = unitTier(attackerLevel, attackerReborn);
  const diff = enemyTier - atkTier;
  if (diff >= 1) return 2;
  if (diff === 0) return 1;
  if (diff === -1) return 0.75;
  return 0.5; // enemy 2+ tiers lower
}
