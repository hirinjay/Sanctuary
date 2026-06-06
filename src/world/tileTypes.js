// Terrain types — colors are Pixi hex numbers (0xRRGGBB)
export const TERRAIN = {
  plains:   { id:'plains',   label:'Plains',   color:0x2e4a1e, dimColor:0x18280f, passable:true  },
  forest:   { id:'forest',   label:'Forest',   color:0x1a3a14, dimColor:0x0d1e0a, passable:true  },
  ruins:    { id:'ruins',    label:'Ruins',    color:0x3c3420, dimColor:0x1e1a10, passable:true  },
  mountain: { id:'mountain', label:'Mountain', color:0x40394e, dimColor:0x201c27, passable:false },
  swamp:    { id:'swamp',    label:'Swamp',    color:0x1e3020, dimColor:0x0f1810, passable:true  },
  water:    { id:'water',    label:'Water',    color:0x0e2038, dimColor:0x07101c, passable:false },
}

// Location types that can appear on world tiles
export const LOC_TYPE = {
  dungeon:  { id:'dungeon',  label:'Dungeon',     emoji:'⚔',  danger:2, lq:'uncommon', tint:0x8a2a2a },
  camp:     { id:'camp',     label:'Raider Camp', emoji:'🔥', danger:2, lq:'uncommon', tint:0x8a6a2a },
  village:  { id:'village',  label:'Village',     emoji:'🏘', danger:1, lq:'common',   tint:0x4a8a4a },
  merchant: { id:'merchant', label:'Merchant',    emoji:'💰', danger:0, lq:'uncommon', tint:0x8a8a2a },
}

// Maps LOC_TYPE danger → loot quality string
export function locLq(danger) {
  return ['common','common','uncommon','rare'][Math.min(danger, 3)]
}

// Wild encounter configuration per terrain
export const WILD_ENCOUNTERS = {
  plains: {
    chance:  0.06,
    danger:  1,
    lq:      'common',
    threats: [
      { name:'Stray Dogs',    emoji:'🐕', hp:4,  dmg:2, move:4, xp:4,  dc:'Skeleton Warrior', sight:4, spot:0.5, attackRange:1 },
      { name:'Feral Wolves',  emoji:'🐺', hp:5,  dmg:3, move:4, xp:5,  dc:'Skeleton Warrior', sight:5, spot:0.6, attackRange:1 },
      { name:'Road Bandits',  emoji:'🗡', hp:5,  dmg:2, move:3, xp:6,  dc:'Skeleton Warrior', sight:3, spot:0.5, attackRange:1 },
    ],
  },
  forest: {
    chance:  0.15,
    danger:  1,
    lq:      'common',
    threats: [
      { name:'Giant Spider',  emoji:'🕷', hp:6,  dmg:2, move:3, xp:6,  dc:'Grave Stalker',    sight:4, spot:0.7, attackRange:1 },
      { name:'Black Bear',    emoji:'🐻', hp:10, dmg:4, move:2, xp:10, dc:'Grave Warden',     sight:2, spot:0.4, attackRange:1 },
      { name:'Forest Bandit', emoji:'🏹', hp:5,  dmg:2, move:4, xp:6,  dc:'Grave Stalker',    sight:5, spot:0.8, attackRange:2 },
    ],
  },
  ruins: {
    chance:  0.20,
    danger:  2,
    lq:      'uncommon',
    threats: [
      { name:'Feral Ghoul',   emoji:'🧟', hp:7,  dmg:3, move:3, xp:8,  dc:'Skeleton Warrior', sight:3, spot:0.5, attackRange:1 },
      { name:'Rabid Hound',   emoji:'🐕', hp:5,  dmg:3, move:5, xp:6,  dc:'Grave Stalker',    sight:5, spot:0.7, attackRange:1 },
      { name:'Scavenger Gang',emoji:'⚔',  hp:6,  dmg:2, move:3, xp:7,  dc:'Skeleton Warrior', sight:3, spot:0.6, attackRange:1 },
    ],
  },
  swamp: {
    chance:  0.22,
    danger:  2,
    lq:      'uncommon',
    threats: [
      { name:'Giant Toad',    emoji:'🐸', hp:8,  dmg:3, move:2, xp:7,  dc:'Grave Warden',     sight:2, spot:0.3, attackRange:1 },
      { name:'Bog Shambler',  emoji:'🌿', hp:9,  dmg:2, move:2, xp:8,  dc:'Grave Warden',     sight:2, spot:0.4, attackRange:1 },
      { name:'Swamp Witch',   emoji:'🧙', hp:5,  dmg:3, move:3, xp:12, dc:'Grave Stalker',    sight:4, spot:0.6, attackRange:2 },
    ],
  },
}

// Roll for a wild encounter on a given terrain tile
// Returns encounter location descriptor or null
export function rollWildEncounter(terrain, rng = Math.random) {
  const enc = WILD_ENCOUNTERS[terrain]
  if (!enc || rng() >= enc.chance) return null
  const threat = enc.threats[Math.floor(rng() * enc.threats.length)]
  return {
    id:       `wild_${terrain}`,
    name:     threat.name,
    danger:   enc.danger,
    lq:       enc.lq,
    isWild:   true,
    wildUnit: threat,
    links:    [],
    desc:     '',
  }
}
