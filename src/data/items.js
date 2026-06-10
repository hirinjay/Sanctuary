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
  { id:'coal',         name:'Coal',          tier:'c', emoji:'⚫', type:'mat' },
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
  { id:'arcane_focus',      name:'Arcane Focus',      tier:'r', emoji:'🔮', type:'tool',       desc:'Amplifies arcane drain range' },
  // Boss-unique drops
  { id:'dungeon_sigil',     name:'Dungeon Sigil',     tier:'r', emoji:'🔑', type:'relic',      desc:'A sigil marking a cleared dungeon' },
  { id:'warlord_axe',       name:'Warlord Axe',       tier:'r', emoji:'🪓', type:'weapon', dmg:2, desc:'+2 dmg, heavy raider weapon' },
  { id:'lich_phylactery',   name:'Lich Phylactery',   tier:'r', emoji:'💎', type:'relic',      desc:'Contains bound soul energy. Rare arcane material.' },
  { id:'arcane_tome',       name:'Arcane Tome',       tier:'r', emoji:'📖', type:'relic',      desc:'Forbidden spells sealed in binding.' },
  { id:'void_shard',        name:'Void Shard',        tier:'r', emoji:'🌑', type:'mat',        desc:'Crystallized void energy.' },
  { id:'warchief_banner',   name:'Warchief Banner',   tier:'r', emoji:'🏴', type:'relic',      desc:'Banner of a defeated Raider Warchief.' },
  { id:'hunters_bow',       name:"Hunter's Bow",      tier:'r', emoji:'🏹', type:'weapon', dmg:2, attackRange:2, desc:'+2 dmg, strikes from 2 tiles away' },
  { id:'trappers_kit',      name:"Trapper's Kit",     tier:'r', emoji:'🪤', type:'tool',       desc:'Improves trap detection and disarming' },
];

export const item = (id) => ITEMS.find(i => i.id === id);

export const LOOT = {
  common:   ['scrap_iron','food','rusty_blade','bone_club','cloth_wrap','scrap_iron','food','wood','stone','rope','cloth'],
  uncommon: ['leather','scrap_iron','cloth','rusty_blade','iron_sword','leather_vest','bone_plate','nails','sheet_metal','lumber'],
  rare:     ['arcane','blueprint','iron_sword','leather_vest','sheet_metal','lumber'],
};

// Floor-depth loot tables override LOOT[lq] when inside a multi-floor location.
// Floor 1: common materials only. Floor 2-3: uncommon + basic gear. Floor 4+: rare + better gear.
export const FLOOR_LOOT = {
  1: ['scrap_iron','scrap_iron','food','food','wood','stone','cloth','rope','rusty_blade','bone_club','cloth_wrap'],
  2: ['leather','iron_sword','leather_vest','bone_plate','nails','sheet_metal','lumber','scrap_iron','food'],
  3: ['leather','iron_sword','leather_vest','sheet_metal','lumber','arcane','bone_plate','blueprint'],
  4: ['arcane','blueprint','steel_sword','reinforced_plate','arcane_focus','arcane','sheet_metal'],
};

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
