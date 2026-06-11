// Data-driven class trees. Adding a class requires only a new entry here.
// baseClass: matches dc field set on units at raise time
// grimoires: which book ids can access this class
// fromClass: null = promotes from base unit; class id = requires that tier-2 class
// promotesTo: tier-3 class id (null if terminal)
// abilityChoice: player picks one of these at promotion
// stats: full stat replacement applied on promotion
// tether: tether cost this unit occupies (0.5 = half slot)

export const DC_TO_BASE = {
  'Skeleton Warrior': 'skeleton_warrior',
  'Grave Stalker':    'grave_stalker',
  'Grave Warden':     'grave_warden',
};

// Off-lineage classes that are still "brute" (heavy melee tank) types,
// e.g. Flesh Warden (skeleton_warrior tree, tier 3) hits as hard as a Grave Warden.
export const BRUTE_CLASS_IDS = new Set(['flesh_warden_sw']);

// True for any tier 2+ unit strong enough to bash open a locked door:
// the whole Grave Warden lineage, plus off-lineage brutes like Flesh Warden.
export function isBruteUnit(unit) {
  return ((unit?.dc === 'Grave Warden') || BRUTE_CLASS_IDS.has(unit?.classId)) && (unit?.tier ?? 1) >= 2;
}

export const CLASSES = {

  // ══════════════════════════════════════════════════════════════
  // SKELETON WARRIOR TREE
  // ══════════════════════════════════════════════════════════════

  // ── Pale Codex + Tinker ──────────────────────────────────────
  death_knight: {
    id:'death_knight', name:'Death Knight', emoji:'⚔️',
    baseClass:'skeleton_warrior', tier:2,
    grimoires:['pale','tinker'],
    stats:{ hp:8, dmg:4, def:1, move:3, range:1, trapReveal:1 },
    tether:1,
    abilityChoice:['bone_shield','intimidate'],
    fromClass:null, promotesTo:'dread_knight',
  },
  grave_archer: {
    id:'grave_archer', name:'Grave Archer', emoji:'🏹',
    baseClass:'skeleton_warrior', tier:2,
    grimoires:['pale','tinker'],
    stats:{ hp:5, dmg:3, def:0, move:3, range:2, trapReveal:1 },
    tether:1,
    abilityChoice:['true_aim','volley'],
    fromClass:null, promotesTo:'shadow_archer',
  },
  dread_knight: {
    id:'dread_knight', name:'Dread Knight', emoji:'💀',
    baseClass:'skeleton_warrior', tier:3,
    grimoires:['pale','tinker'],
    stats:{ hp:12, dmg:5, def:2, move:3, range:1, trapReveal:1 },
    tether:1,
    abilityChoice:['fortress_shell','fear_aura'],
    fromClass:'death_knight', promotesTo:null,
  },
  shadow_archer: {
    id:'shadow_archer', name:'Shadow Archer', emoji:'🌑',
    baseClass:'skeleton_warrior', tier:3,
    grimoires:['pale','tinker'],
    stats:{ hp:6, dmg:4, def:0, move:3, range:3, trapReveal:1 },
    tether:1,
    silentAttacks:true,
    abilityChoice:['ghost_arrow','rain_of_arrows'],
    fromClass:'grave_archer', promotesTo:null,
  },

  // ── Whispers of the Flesh ────────────────────────────────────
  flesh_knight: {
    id:'flesh_knight', name:'Flesh Knight', emoji:'🩸',
    baseClass:'skeleton_warrior', tier:2,
    grimoires:['flesh'],
    stats:{ hp:10, dmg:4, def:1, move:3, range:1, trapReveal:1 },
    tether:1,
    abilityChoice:['drain_touch','rend'],
    fromClass:null, promotesTo:'flesh_warden_sw',
  },
  bone_berserker: {
    id:'bone_berserker', name:'Bone Berserker', emoji:'💢',
    baseClass:'skeleton_warrior', tier:2,
    grimoires:['flesh'],
    stats:{ hp:7, dmg:5, def:0, move:4, range:1, trapReveal:1 },
    tether:1,
    abilityChoice:['bloodlust','frenzy'],
    fromClass:null, promotesTo:'chaos_knight',
  },
  flesh_warden_sw: {
    id:'flesh_warden_sw', name:'Flesh Warden', emoji:'🧬',
    baseClass:'skeleton_warrior', tier:3,
    grimoires:['flesh'],
    stats:{ hp:15, dmg:5, def:2, move:3, range:1, trapReveal:1 },
    tether:1,
    abilityChoice:['consume','devour'],
    fromClass:'flesh_knight', promotesTo:null,
  },
  chaos_knight: {
    id:'chaos_knight', name:'Chaos Knight', emoji:'🔥',
    baseClass:'skeleton_warrior', tier:3,
    grimoires:['flesh'],
    stats:{ hp:9, dmg:7, def:0, move:4, range:1, trapReveal:1 },
    tether:1,
    abilityChoice:['carnage','rampage'],
    fromClass:'bone_berserker', promotesTo:null,
  },

  // ── Verdant Rite ────────────────────────────────────────────
  verdant_knight: {
    id:'verdant_knight', name:'Verdant Knight', emoji:'🌿',
    baseClass:'skeleton_warrior', tier:2,
    grimoires:['verdant'],
    stats:{ hp:8, dmg:4, def:1, move:4, range:1, trapReveal:1 },
    tether:1,
    abilityChoice:['thornmail','overgrowth_strike'],
    fromClass:null, promotesTo:'grove_champion',
  },
  verdant_archer: {
    id:'verdant_archer', name:'Verdant Archer', emoji:'🌱',
    baseClass:'skeleton_warrior', tier:2,
    grimoires:['verdant'],
    stats:{ hp:5, dmg:3, def:0, move:4, range:3, trapReveal:1 },
    tether:1,
    abilityChoice:['entangling_shot','scatter_shot'],
    fromClass:null, promotesTo:'grove_warden_sw',
  },
  grove_champion: {
    id:'grove_champion', name:'Grove Champion', emoji:'🌳',
    baseClass:'skeleton_warrior', tier:3,
    grimoires:['verdant'],
    stats:{ hp:12, dmg:5, def:2, move:4, range:1, trapReveal:1 },
    tether:1,
    abilityChoice:['briarwall','stranglehold'],
    fromClass:'verdant_knight', promotesTo:null,
  },
  grove_warden_sw: {
    id:'grove_warden_sw', name:'Grove Warden', emoji:'🍃',
    baseClass:'skeleton_warrior', tier:3,
    grimoires:['verdant'],
    stats:{ hp:7, dmg:4, def:0, move:4, range:3, trapReveal:1 },
    tether:1,
    abilityChoice:['thornfield_shot','barrage'],
    fromClass:'verdant_archer', promotesTo:null,
  },

  // ══════════════════════════════════════════════════════════════
  // GRAVE STALKER TREE
  // ══════════════════════════════════════════════════════════════

  // ── Pale Codex + Whispers + Tinker ──────────────────────────
  phantom: {
    id:'phantom', name:'Phantom', emoji:'👻',
    baseClass:'grave_stalker', tier:2,
    grimoires:['pale','flesh','tinker'],
    stats:{ hp:6, dmg:2, def:0, move:4, range:1, trapReveal:4 },
    tether:1,
    abilityChoice:['phase','shadow_meld'],
    fromClass:null, promotesTo:'wraith',
  },
  ranger: {
    id:'ranger', name:'Ranger', emoji:'🏹',
    baseClass:'grave_stalker', tier:2,
    grimoires:['pale','flesh','tinker'],
    stats:{ hp:5, dmg:3, def:0, move:4, range:2, trapReveal:4 },
    tether:1,
    abilityChoice:['ambush','tracker'],
    fromClass:null, promotesTo:'pathfinder',
  },
  wraith: {
    id:'wraith', name:'Wraith', emoji:'🌫️',
    baseClass:'grave_stalker', tier:3,
    grimoires:['pale','flesh','tinker'],
    stats:{ hp:8, dmg:3, def:0, move:4, range:1, trapReveal:5 },
    tether:1,
    untargetableInShadow:true,
    abilityChoice:['death_mark','incorporeal'],
    fromClass:'phantom', promotesTo:null,
  },
  pathfinder: {
    id:'pathfinder', name:'Pathfinder', emoji:'🗺️',
    baseClass:'grave_stalker', tier:3,
    grimoires:['pale','flesh','tinker'],
    stats:{ hp:6, dmg:4, def:0, move:4, range:3, trapReveal:5 },
    tether:1,
    fullMapRevealOnEntry:true,
    abilityChoice:['superior_ambush','wayfinder'],
    fromClass:'ranger', promotesTo:null,
  },

  // ── Verdant Rite ────────────────────────────────────────────
  grove_phantom: {
    id:'grove_phantom', name:'Grove Phantom', emoji:'🌾',
    baseClass:'grave_stalker', tier:2,
    grimoires:['verdant'],
    stats:{ hp:6, dmg:2, def:0, move:4, range:1, trapReveal:5 },
    tether:1,
    forestCostZero:true,
    cannotInteract:true,  // cannot loot, open doors, or use cages
    abilityChoice:['natures_veil','thornwall'],
    fromClass:null, promotesTo:'grove_wraith',
  },
  verdant_ranger: {
    id:'verdant_ranger', name:'Verdant Ranger', emoji:'🌿',
    baseClass:'grave_stalker', tier:2,
    grimoires:['verdant'],
    stats:{ hp:5, dmg:3, def:0, move:4, range:3, trapReveal:4 },
    tether:1,
    forageBonus:2,
    abilityChoice:['entangle','overgrowth'],
    fromClass:null, promotesTo:'grove_pathfinder',
  },
  grove_wraith: {
    id:'grove_wraith', name:'Grove Wraith', emoji:'🍀',
    baseClass:'grave_stalker', tier:3,
    grimoires:['verdant'],
    stats:{ hp:8, dmg:3, def:0, move:4, range:1, trapReveal:6 },
    tether:1,
    forestCostZero:true, untargetableInShadow:true, cannotInteract:true,
    abilityChoice:['vanish','briarvine'],
    fromClass:'grove_phantom', promotesTo:null,
  },
  grove_pathfinder: {
    id:'grove_pathfinder', name:'Grove Pathfinder', emoji:'🌲',
    baseClass:'grave_stalker', tier:3,
    grimoires:['verdant'],
    stats:{ hp:6, dmg:4, def:0, move:4, range:3, trapReveal:5 },
    tether:1,
    fullMapRevealOnEntry:true, forageBonus:3,
    abilityChoice:['mass_entangle','strangling_vines'],
    fromClass:'grove_phantom', promotesTo:null,
  },

  // ══════════════════════════════════════════════════════════════
  // GRAVE WARDEN TREE
  // ══════════════════════════════════════════════════════════════

  // ── Pale Codex + Tinker ──────────────────────────────────────
  siege_warden: {
    id:'siege_warden', name:'Siege Warden', emoji:'🛡️',
    baseClass:'grave_warden', tier:2,
    grimoires:['pale','tinker'],
    stats:{ hp:12, dmg:4, def:2, move:2, range:1, trapReveal:1 },
    tether:1,
    abilityChoice:['shove','shield_wall'],
    fromClass:null, promotesTo:'fortress',
  },
  eternal_warden: {
    id:'eternal_warden', name:'Eternal Warden', emoji:'⚖️',
    baseClass:'grave_warden', tier:2,
    grimoires:['pale','tinker'],
    stats:{ hp:14, dmg:4, def:1, move:2, range:1, trapReveal:1 },
    tether:1,
    abilityChoice:['hold_the_line','guardian'],
    fromClass:null, promotesTo:'immortal',
  },
  fortress: {
    id:'fortress', name:'Fortress', emoji:'🏰',
    baseClass:'grave_warden', tier:3,
    grimoires:['pale','tinker'],
    stats:{ hp:16, dmg:5, def:3, move:2, range:1, trapReveal:1 },
    tether:1,
    immunities:['shove','push','root','slow'],
    abilityChoice:['shockwave','immovable'],
    fromClass:'siege_warden', promotesTo:null,
  },
  immortal: {
    id:'immortal', name:'Immortal', emoji:'♾️',
    baseClass:'grave_warden', tier:3,
    grimoires:['pale','tinker'],
    stats:{ hp:18, dmg:4, def:2, move:2, range:1, trapReveal:1 },
    tether:1,
    surviveOnce:true,  // auto-survive at 1hp once per encounter, no arming needed
    abilityChoice:['bastion','sacrifice'],
    fromClass:'eternal_warden', promotesTo:null,
  },

  // ── Whispers of the Flesh ────────────────────────────────────
  flesh_warden_gw: {
    id:'flesh_warden_gw', name:'Flesh Warden', emoji:'🩸',
    baseClass:'grave_warden', tier:2,
    grimoires:['flesh'],
    stats:{ hp:16, dmg:4, def:1, move:2, range:1, trapReveal:1 },
    tether:1,
    abilityChoice:['consume_gw','undying_hunger'],
    fromClass:null, promotesTo:'flesh_titan',
  },
  flesh_eternal: {
    id:'flesh_eternal', name:'Flesh Eternal', emoji:'💉',
    baseClass:'grave_warden', tier:2,
    grimoires:['flesh'],
    stats:{ hp:18, dmg:4, def:1, move:2, range:1, trapReveal:1 },
    tether:1,
    abilityChoice:['blood_pact','regenerate'],
    fromClass:null, promotesTo:'flesh_immortal',
  },
  flesh_titan: {
    id:'flesh_titan', name:'Flesh Titan', emoji:'🧟',
    baseClass:'grave_warden', tier:3,
    grimoires:['flesh'],
    stats:{ hp:22, dmg:5, def:2, move:2, range:1, trapReveal:1 },
    tether:1,
    abilityChoice:['devour_titan','death_denied'],
    fromClass:'flesh_warden_gw', promotesTo:null,
  },
  flesh_immortal: {
    id:'flesh_immortal', name:'Flesh Immortal', emoji:'💀',
    baseClass:'grave_warden', tier:3,
    grimoires:['flesh'],
    stats:{ hp:24, dmg:4, def:2, move:2, range:1, trapReveal:1 },
    tether:1,
    regenPerTurn:2, surviveOnce:true,
    abilityChoice:['life_link','undying'],
    fromClass:'flesh_eternal', promotesTo:null,
  },

  // ── Verdant Rite ────────────────────────────────────────────
  grove_warden_gw: {
    id:'grove_warden_gw', name:'Grove Warden', emoji:'🌿',
    baseClass:'grave_warden', tier:2,
    grimoires:['verdant'],
    stats:{ hp:12, dmg:4, def:1, move:3, range:1, trapReveal:1 },
    tether:1,
    abilityChoice:['thornfield','root_strike'],
    fromClass:null, promotesTo:'ancient_warden',
  },
  grove_eternal: {
    id:'grove_eternal', name:'Grove Eternal', emoji:'🌳',
    baseClass:'grave_warden', tier:2,
    grimoires:['verdant'],
    stats:{ hp:14, dmg:4, def:1, move:3, range:1, trapReveal:1 },
    tether:1,
    abilityChoice:['overgrowth','entangle'],
    fromClass:null, promotesTo:'grove_immortal',
  },
  ancient_warden: {
    id:'ancient_warden', name:'Ancient Warden', emoji:'🌲',
    baseClass:'grave_warden', tier:3,
    grimoires:['verdant'],
    stats:{ hp:16, dmg:5, def:2, move:3, range:1, trapReveal:1 },
    tether:1,
    abilityChoice:['stranglehold_field','briarvine_warden'],
    fromClass:'grove_warden_gw', promotesTo:null,
  },
  grove_immortal: {
    id:'grove_immortal', name:'Grove Immortal', emoji:'🌺',
    baseClass:'grave_warden', tier:3,
    grimoires:['verdant'],
    stats:{ hp:18, dmg:4, def:2, move:3, range:1, trapReveal:1 },
    tether:1,
    abilityChoice:['living_fortress','mass_entangle_warden'],
    fromClass:'grove_eternal', promotesTo:null,
  },

  // ══════════════════════════════════════════════════════════════
  // EXCLUSIVE CLASSES
  // ══════════════════════════════════════════════════════════════

  // ── Pale Codex exclusive: branches directly from Grave Warden base ──
  pale_warden: {
    id:'pale_warden', name:'Pale Warden', emoji:'💠',
    baseClass:'grave_warden', tier:2,
    grimoires:['pale'],
    stats:{ hp:7, dmg:3, def:0, move:3, range:1, trapReveal:1 },
    tether:0.5,
    boneExplosion:true,  // on death: deals lifetime_levels dmg to all adjacent
    abilityChoice:['frenzy','death_charge'],
    fromClass:null, promotesTo:null,
    note:'On death: Bone Explosion deals lifetime_levels damage to all adjacent. lifetime_levels never resets on rebirth.',
  },

  // ── Tinker exclusive: built at Workshop, not raised ──────────────────
  iron_revenant: {
    id:'iron_revenant', name:'Iron Revenant', emoji:'🤖',
    baseClass:null,  // not raised — built
    tier:2,
    grimoires:['tinker'],
    stats:{ hp:12, dmg:4, def:2, move:2, range:1, trapReveal:1 },
    tether:0,
    noMissions:true, sanctuaryOnly:true,
    buildingRequired:'workshop',
    buildCost:{ scrap_iron:3, bone:2 },
    productionBonus:1.5,
    abilityChoice:['construct_armor'],
    fromClass:null, promotesTo:null,
  },
};

// Returns all tier-2 classes available to a unit+grimoire combo.
export function getAvailablePromotions(unit, bookId) {
  const base = DC_TO_BASE[unit.dc] || unit.baseClass;
  return Object.values(CLASSES).filter(c =>
    c.tier === 2 &&
    c.baseClass === base &&
    !c.noMissions &&
    c.grimoires.includes(bookId)
  );
}

// Returns the tier-3 class for a given tier-2 classId (null if none).
export function getTier3Class(classId) {
  return Object.values(CLASSES).find(c => c.fromClass === classId && c.tier === 3) ?? null;
}

// Returns true if a unit is eligible for promotion at its current level.
export function isPromotionEligible(unit, bookId) {
  if (unit.type !== 'undead') return false;
  if (unit.level >= 5 && unit.classId) {
    const cls = CLASSES[unit.classId];
    return cls?.tier === 2 && !!getTier3Class(unit.classId);
  }
  if (unit.level >= 2 && !unit.classId) {
    return getAvailablePromotions(unit, bookId).length > 0;
  }
  return false;
}
