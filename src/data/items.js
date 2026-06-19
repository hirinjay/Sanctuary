export const ITEMS = [
  // Survival
  { id:'scrap_iron',   name:'Scrap Iron',    tier:'c', emoji:'🔩', type:'mat' },
  { id:'bone',         name:'Bone',          tier:'u', emoji:'🦴', type:'mat' },
  { id:'cloth',        name:'Cloth',         tier:'c', emoji:'🧶', type:'mat' },
  { id:'food',         name:'Dried Food',    tier:'c', emoji:'🥩', type:'mat' },
  { id:'arcane',       name:'Arcane Residue',tier:'r', emoji:'✨', type:'mat' },
  { id:'leather',      name:'Leather',       tier:'u', emoji:'🧱', type:'mat' },
  { id:'blueprint',    name:'Blueprint',     tier:'r', emoji:'📋', type:'mat' },
  // Building materials
  { id:'wood',         name:'Wood',          tier:'c', emoji:'🪵', type:'mat' },
  { id:'stone',        name:'Stone',         tier:'c', emoji:'🪨', type:'mat' },
  { id:'clay',         name:'Clay',          tier:'c', emoji:'🟫', type:'mat' },
  { id:'rope',         name:'Rope',          tier:'c', emoji:'🪢', type:'mat' },
  { id:'nails',        name:'Nails',         tier:'c', emoji:'📌', type:'mat' },
  { id:'sheet_metal',  name:'Sheet Metal',   tier:'u', emoji:'🔲', type:'mat' },
  { id:'lumber',       name:'Lumber',        tier:'u', emoji:'🪚', type:'mat' },
  { id:'coal',         name:'Coal',          tier:'c', emoji:'⚫', type:'mat', desc:'Forge fuel; upgrade recipes pending' },
  { id:'herbs',        name:'Herbs',         tier:'c', emoji:'🌿', type:'mat' },
  { id:'rare_herbs',   name:'Rare Herbs',    tier:'u', emoji:'🌱', type:'mat' },
  { id:'pale_fungus',  name:'Pale Fungus',   tier:'u', emoji:'🍄', type:'mat' },
  { id:'bitterroot',   name:'Bitterroot',    tier:'u', emoji:'🥀', type:'mat' },
  { id:'pickaxe',      name:'Pickaxe',       tier:'u', emoji:'⛏',  type:'tool' },
  { id:'rusty_blade',  name:'Rusty Blade',   tier:'c', emoji:'🗡️', type:'weapon', dmg:0, desc:'Restores full dmg (unarmed -1)' },
  { id:'iron_sword',   name:'Iron Sword',    tier:'u', emoji:'⚔️', type:'weapon', dmg:1, desc:'+1 above baseline' },
  { id:'bone_club',    name:'Bone Club',     tier:'c', emoji:'🏏', type:'weapon', dmg:0, desc:'Restores full dmg (unarmed -1)' },
  { id:'cloth_wrap',   name:'Cloth Wraps',   tier:'c', emoji:'🧣', type:'armor',  def:1, desc:'-1 dmg taken' },
  { id:'leather_vest', name:'Leather Vest',  tier:'u', emoji:'🥋', type:'armor',  def:2, desc:'-2 dmg taken' },
  { id:'bone_plate',   name:'Bone Plate',    tier:'c', emoji:'🦾', type:'armor',  def:1, desc:'-1 dmg taken' },
  // Rare gear (floor 4+ loot)
  { id:'steel_sword',       name:'Steel Sword',       tier:'r', emoji:'⚔️', type:'weapon', dmg:2, desc:'+2 above baseline' },
  { id:'reinforced_plate',  name:'Reinforced Plate',  tier:'r', emoji:'🛡️', type:'armor',  def:3, desc:'-3 dmg taken' },
  // Boss-unique drops
  { id:'dungeon_sigil',     name:'Dungeon Sigil',     tier:'r', emoji:'🔑', type:'relic',      desc:'A sigil marking a cleared dungeon' },
  { id:'warlord_axe',       name:'Warlord Axe',       tier:'r', emoji:'🪓', type:'weapon', dmg:2, desc:'+2 dmg, heavy raider weapon' },
  { id:'lich_phylactery',   name:'Lich Phylactery',   tier:'r', emoji:'💎', type:'relic',      desc:'Contains bound soul energy. Rare arcane material.' },
  { id:'arcane_tome',       name:'Arcane Tome',       tier:'r', emoji:'📖', type:'relic',      desc:'Forbidden spells sealed in binding.' },
  { id:'void_shard',        name:'Void Shard',        tier:'r', emoji:'🌑', type:'mat',        desc:'Crystallized void energy.' },
  { id:'warchief_banner',   name:'Warchief Banner',   tier:'r', emoji:'🏴', type:'relic',      desc:'Banner of a defeated Raider Warchief.' },
  { id:'hunters_bow',       name:"Hunter's Bow",      tier:'r', emoji:'🏹', type:'weapon', dmg:2, attackRange:2, desc:'+2 dmg, strikes from 2 tiles away' },
  { id:'trappers_kit',      name:"Trapper's Kit",     tier:'r', emoji:'🪤', type:'tool',       desc:'Improves trap detection and disarming' },
  // Arcane artifacts (accessory slot)
  { id:'pale_signet',       name:'Pale Signet',       tier:'r', emoji:'💍', type:'artifact', slot:'accessory', varekOnly:true, tetherCap:1, desc:'+1 tether cap (Varek only)' },
  { id:'bone_talisman',     name:'Bone Talisman',     tier:'r', emoji:'📿', type:'artifact', slot:'accessory', desc:'Bone healing at Sanctuary restores +2 extra HP' },
  { id:'wraithveil',        name:'Wraithveil',        tier:'r', emoji:'🌫️', type:'artifact', slot:'accessory', desc:'Always counts as standing in shadow' },
  { id:'draining_stone',    name:'Draining Stone',    tier:'r', emoji:'🩸', type:'artifact', slot:'accessory', varekOnly:true, desc:'Varek drain heals +1 additional HP' },
  { id:'iron_heart',        name:'Iron Heart',        tier:'r', emoji:'🫀', type:'artifact', slot:'accessory', maxHp:2, desc:'+2 max HP' },
  { id:'arcane_focus',      name:'Arcane Focus',      tier:'r', emoji:'🔮', type:'artifact', slot:'accessory', desc:'Active abilities may be used twice per encounter' },
  { id:'grave_seal',        name:'Grave Seal',        tier:'r', emoji:'☠️', type:'artifact', slot:'accessory', desc:'20% chance on kill to heal 5 HP' },
  { id:'soul_anchor_shard', name:'Soul Anchor Shard', tier:'r', emoji:'⚓', type:'artifact', slot:'accessory', tetherMod:-0.5, desc:'This unit costs 0.5 less tether' },
];

export const item = (id) => ITEMS.find(i => i.id === id);

export const SCAVENGE_LOOT = {
  common:   ['wood','wood','stone','stone','cloth','food','herbs','bone','nails','scrap_iron'],
  uncommon: ['stone','scrap_iron','nails','cloth','wood','food','herbs','rare_herbs','bone','coal','lumber','sheet_metal'],
  rare:     ['arcane','rare_herbs','pale_fungus','bitterroot','coal','sheet_metal','lumber','blueprint'],
};

export const RAID_LOOT = {
  common:   ['rusty_blade','bone_club','cloth_wrap','leather_vest','bone_plate'],
  uncommon: ['iron_sword','leather_vest','bone_plate','hunters_bow','trappers_kit'],
  rare:     ['steel_sword','reinforced_plate','warlord_axe','arcane_tome','dungeon_sigil'],
};

export const ARTIFACT_LOOT = ['pale_signet','bone_talisman','wraithveil','draining_stone','iron_heart','arcane_focus','grave_seal','soul_anchor_shard'];

export const LOOT = SCAVENGE_LOOT;

export const FLOOR_LOOT = {
  scavenge: {
    1: SCAVENGE_LOOT.common,
    2: [...SCAVENGE_LOOT.uncommon, 'stone','scrap_iron','wood'],
    3: [...SCAVENGE_LOOT.uncommon, ...SCAVENGE_LOOT.rare],
    4: [...SCAVENGE_LOOT.rare, 'arcane','coal','rare_herbs'],
  },
  raid: {
    1: RAID_LOOT.common,
    2: [...RAID_LOOT.common, ...RAID_LOOT.uncommon],
    3: [...RAID_LOOT.uncommon, ...RAID_LOOT.rare, ...ARTIFACT_LOOT],
    4: [...RAID_LOOT.rare, ...ARTIFACT_LOOT, ...ARTIFACT_LOOT],
  },
};

export function lootTableForMode(mode, lq = 'common', floor = 1) {
  const key = Math.min(Math.max(floor, 1), 4);
  return FLOOR_LOOT[mode]?.[key] ?? (mode === 'raid' ? RAID_LOOT[lq] : SCAVENGE_LOOT[lq]) ?? SCAVENGE_LOOT.common;
}

export const RECIPES = [
  { id:'pickaxe',      name:'Pickaxe',      emoji:'⛏',  cost:{ scrap_iron:2, wood:1 } },
  { id:'rusty_blade',  name:'Rusty Blade',  emoji:'🗡️', cost:{ scrap_iron:2 } },
  { id:'bone_club',    name:'Bone Club',    emoji:'🏏', cost:{ bone:3 } },
  { id:'iron_sword',   name:'Iron Sword',   emoji:'⚔️', cost:{ scrap_iron:3, bone:1 } },
  { id:'cloth_wrap',   name:'Cloth Wraps',  emoji:'🧣', cost:{ cloth:2 } },
  { id:'bone_plate',   name:'Bone Plate',   emoji:'🦾', cost:{ bone:3, cloth:1 } },
  { id:'leather_vest', name:'Leather Vest', emoji:'🥋', cost:{ leather:2, scrap_iron:1 } },
];

export const BODY_LOOT = ['bone','bone','bone','cloth',null,null];
