// Terrain types — colors are Pixi hex numbers (0xRRGGBB)
export const TERRAIN = {
  plains:   { id:'plains',   label:'Plains',   color:0x2e4a1e, dimColor:0x18280f, passable:true,  desc:'Open land. Good forage.', encounterChance:0.06 },
  forest:   { id:'forest',   label:'Forest',   color:0x1a3a14, dimColor:0x0d1e0a, passable:true,  desc:'Dense woodland. Rich in wood.', encounterChance:0.15 },
  ruins:    { id:'ruins',    label:'Ruins',    color:0x3c3420, dimColor:0x1e1a10, passable:true,  desc:'Old structures. Salvage possible.', encounterChance:0.20 },
  mountain: { id:'mountain', label:'Mountain', color:0x40394e, dimColor:0x201c27, passable:false, desc:'Impassable peaks.', encounterChance:0 },
  swamp:    { id:'swamp',    label:'Swamp',    color:0x1e3020, dimColor:0x0f1810, passable:true,  desc:'Treacherous marsh.', encounterChance:0.22 },
  water:    { id:'water',    label:'Water',    color:0x0e2038, dimColor:0x07101c, passable:false, desc:'Deep water. No passage.', encounterChance:0 },
  ash:      { id:'ash',      label:'Ash Waste', color:0x302b2a, dimColor:0x181514, passable:true, desc:'Volcanic ash and coal seams.', encounterChance:0.12 },
  tundra:   { id:'tundra',   label:'Frozen Tundra', color:0xb8d8e8, dimColor:0x5c6c74, passable:true, desc:'Icy northern wastes.', encounterChance:0.10 },
}

// Location types that can appear on world tiles
export const LOC_TYPE = {
  dungeon:     { id:'dungeon',     label:'Dungeon',        emoji:'⚔',  danger:2, lq:'uncommon', tint:0x8a2a2a, noEnemies:false },
  camp:        { id:'camp',        label:'Raider Camp',    emoji:'🔥', danger:2, lq:'uncommon', tint:0x8a6a2a, noEnemies:false },
  village:     { id:'village',     label:'Village',        emoji:'🏘', danger:1, lq:'common',   tint:0x4a8a4a, noEnemies:false },
  merchant:    { id:'merchant',    label:'Merchant',       emoji:'💰', danger:0, lq:'uncommon', tint:0x8a8a2a, noEnemies:false },
  cabin:       { id:'cabin',       label:'Abandoned Cabin',emoji:'🛖', danger:1, lq:'common',   tint:0x8a6a3a, noEnemies:false },
  battlefield:  { id:'battlefield',  label:'Battlefield',    emoji:'🗡', danger:1, lq:'uncommon', tint:0x6a5a3a, noEnemies:true  },
  wizard_tower: { id:'wizard_tower', label:'Wizard Tower',   emoji:'🗼', danger:3, lq:'rare',     tint:0x4a2a8a, noEnemies:false },
  crypt:        { id:'crypt',        label:'Ancient Crypt',  emoji:'⚰',  danger:2, lq:'uncommon', tint:0x3a3a4a, noEnemies:false },
}

// Per-terrain forage loot pools and hidden-find chance
export const FORAGE_LOOT = {
  plains:   { pool:['food','food','cloth','stone','wood','rope'],          hiddenChance:0.03 },
  forest:   { pool:['wood','wood','wood','rope','food','stone','clay'],     hiddenChance:0.08 },
  ruins:    { pool:['stone','nails','scrap_iron','wood','cloth'],           hiddenChance:0.18 },
  swamp:    { pool:['rope','clay','cloth','food','wood'],                   hiddenChance:0.05 },
  mountain: { pool:['stone','stone','coal','scrap_iron'],                   hiddenChance:0.02 },
}

export const LOCATION_RESOURCE_TABLE = {
  dungeon: ['stone','scrap_iron','arcane'],
  camp: ['bone','cloth','rusty_blade'],
  wizard_tower: ['arcane','rare_herbs','arcane_tome'],
  forest: ['wood','herbs','food'],
  ruins: ['stone','scrap_iron','nails','cloth'],
  swamp: ['rare_herbs','pale_fungus','bitterroot'],
  mountain: ['stone','scrap_iron','coal'],
  battlefield: ['bone','scrap_iron','rusty_blade'],
  crypt: ['stone','bone','arcane'],
  cabin: ['wood','cloth','food'],
  village: ['food','cloth','wood'],
};

export function primaryResourceFor(location, terrain = null, rng = Math.random) {
  const key = location?.type || terrain || 'plains';
  const table = LOCATION_RESOURCE_TABLE[key] || LOCATION_RESOURCE_TABLE[terrain] || ['food'];
  return table[Math.floor(rng() * table.length)];
}

export function rollForageLoot(terrain, rng = Math.random) {

  const table = FORAGE_LOOT[terrain] || FORAGE_LOOT.plains
  const count = 1 + Math.floor(rng() * 2)
  const items = Array.from({ length: count }, () => table.pool[Math.floor(rng() * table.pool.length)])
  const hiddenFind = rng() < (table.hiddenChance || 0)
  return { items, hiddenFind }
}


export const FORAGEABLE_TERRAINS = new Set(['plains','forest','swamp','ruins','ash','tundra']);

export const FORAGE_ENCOUNTER_CHANCE = {
  plains: 0.10,
  forest: 0.20,
  swamp: 0.30,
  ruins: 0.25,
  ash: 0.35,
  tundra: 0.25,
};

function pickOne(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
function qty(id, count) { return Array.from({ length:count }, () => id); }

export function rollForageYield(terrain, rng = Math.random) {
  let items = [];
  if (terrain === 'plains') {
    items.push(...qty('food', 1 + Math.floor(rng() * 2)));
    if (rng() < 0.30) items.push('ironweed');
  } else if (terrain === 'forest') {
    const primary = rng() < 0.5 ? qty('food', 1 + Math.floor(rng() * 2)) : ['herbs'];
    items.push(...primary);
    if (rng() < 0.40) items.push(pickOne(['bitterroot','pale_fungus'], rng));
  } else if (terrain === 'swamp') {
    const primary = pickOne(['nightshade','pale_fungus'], rng);
    items.push(...qty(primary, 1 + Math.floor(rng() * 2)));
    if (rng() < 0.35) items.push('bitterroot');
  } else if (terrain === 'ruins') {
    if (rng() < 0.5) items.push(...qty('bone', 1 + Math.floor(rng() * 2)));
    else items.push('cloth');
    if (rng() < 0.25) items.push('scrap_iron');
  } else if (terrain === 'ash') {
    items.push(...qty('embermoss', 1 + Math.floor(rng() * 2)));
    if (rng() < 0.20) items.push('coal');
  } else if (terrain === 'tundra') {
    items.push('rare_crystal');
    if (rng() < 0.30) items.push('preserved_food');
  } else {
    return { items:[], healingItems:[] };
  }
  return { items, healingItems:items.filter(id => ['food','preserved_food','pale_fungus','herbs','nightshade'].includes(id)) };
}

export function forageEncounterForTerrain(terrain, rng = Math.random) {
  const pools = {
    plains: [
      { name:'Foraging Wolves', emoji:'🐺', danger:1, lq:'common', threats:[
        { name:'Wolf', emoji:'🐺', hp:4, dmg:3, move:5, xp:4, dc:'Skeleton Warrior', sight:5, spot:0.65, attackRange:1, faction:'animal' },
        { name:'Pack Wolf', emoji:'🐺', hp:5, dmg:3, move:5, xp:5, dc:'Skeleton Warrior', sight:5, spot:0.65, attackRange:1, faction:'animal' },
      ] },
      { name:'Wanderer Group', emoji:'🚶', danger:1, lq:'common', threats:WILD_ENCOUNTERS.plains.threats },
    ],
    forest: [
      { name:'Forest Wolf Pack', emoji:'🐺', danger:2, lq:'uncommon', threats:WILD_ENCOUNTERS.forest.threats },
      { name:'Dire Wolf Trail', emoji:'🐺', danger:2, lq:'uncommon', threats:[{ name:'Dire Wolf', emoji:'🐺', hp:14, dmg:5, move:6, xp:14, dc:'Grave Warden', sight:6, spot:0.8, attackRange:1, faction:'animal', tier:2 }] },
      { name:'Cave Bear', emoji:'🐻', danger:2, lq:'uncommon', threats:[{ name:'Cave Bear', emoji:'🐻', hp:20, dmg:6, def:2, move:3, xp:20, dc:'Grave Warden', sight:3, spot:0.45, attackRange:1, faction:'animal', tier:2 }] },
    ],
    swamp: [
      { name:'Swamp Wolf Pack', emoji:'🐺', danger:2, lq:'uncommon', threats:WILD_ENCOUNTERS.swamp.threats },
      { name:'Raider Scouts', emoji:'🗡️', danger:2, lq:'uncommon', threats:WILD_ENCOUNTERS.ruins.threats },
    ],
    ruins: [
      { name:'Raider Scavengers', emoji:'⚔', danger:2, lq:'uncommon', threats:WILD_ENCOUNTERS.ruins.threats },
      { name:'Wanderer Group', emoji:'🚶', danger:1, lq:'common', threats:WILD_ENCOUNTERS.plains.threats },
    ],
    ash: [
      { name:'Ash Raiders', emoji:'🪓', danger:2, lq:'uncommon', threats:WILD_ENCOUNTERS.ruins.threats },
      { name:'Cave Bear', emoji:'🐻', danger:2, lq:'uncommon', threats:[{ name:'Cave Bear', emoji:'🐻', hp:20, dmg:6, def:2, move:3, xp:20, dc:'Grave Warden', sight:3, spot:0.45, attackRange:1, faction:'animal', tier:2 }] },
    ],
    tundra: [
      { name:'Dire Wolf Pack', emoji:'🐺', danger:2, lq:'uncommon', threats:[{ name:'Dire Wolf', emoji:'🐺', hp:14, dmg:5, def:1, move:6, xp:14, dc:'Grave Warden', sight:6, spot:0.8, attackRange:1, faction:'animal', tier:2 }] },
      { name:'Ancient Guardian', emoji:'🛡️', danger:3, lq:'rare', threats:[{ name:'Ancient Guardian', emoji:'🛡️', hp:18, dmg:5, def:2, move:2, xp:18, dc:'Grave Warden', sight:4, spot:0.55, attackRange:1, tier:3 }] },
    ],
  };
  const table = pools[terrain] ?? pools.plains;
  const base = terrain === 'tundra' && rng() < 0.10 ? table[1] : pickOne(table, rng);
  return { id:`forage_${terrain}`, type:terrain, isForage:true, forageAmbush:true, primaryResource:terrain, desc:'', links:[], ...base };
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
    type:     terrain,
    primaryResource: primaryResourceFor(null, terrain, rng),
    wildUnit: threat,
    threats:  enc.threats,
    links:    [],
    desc:     '',
  }
}
