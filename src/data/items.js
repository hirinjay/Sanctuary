export const ITEMS = [
  { id:'scrap_iron',   name:'Scrap Iron',    tier:'c', emoji:'🔩', type:'mat' },
  { id:'bone',         name:'Bone',          tier:'u', emoji:'🦴', type:'mat' },
  { id:'cloth',        name:'Cloth',         tier:'c', emoji:'🧶', type:'mat' },
  { id:'food',         name:'Dried Food',    tier:'c', emoji:'🥩', type:'mat' },
  { id:'arcane',       name:'Arcane Residue',tier:'r', emoji:'✨', type:'mat' },
  { id:'leather',      name:'Leather',       tier:'u', emoji:'🧱', type:'mat' },
  { id:'blueprint',    name:'Blueprint',     tier:'r', emoji:'📋', type:'mat' },
  { id:'rusty_blade',  name:'Rusty Blade',   tier:'c', emoji:'🗡️', type:'weapon', dmg:0, desc:'Restores full dmg (unarmed -1)' },
  { id:'iron_sword',   name:'Iron Sword',    tier:'u', emoji:'⚔️', type:'weapon', dmg:1, desc:'+1 above baseline' },
  { id:'bone_club',    name:'Bone Club',     tier:'c', emoji:'🏏', type:'weapon', dmg:0, desc:'Restores full dmg (unarmed -1)' },
  { id:'cloth_wrap',   name:'Cloth Wraps',   tier:'c', emoji:'🧣', type:'armor',  def:1, desc:'-1 dmg taken' },
  { id:'leather_vest', name:'Leather Vest',  tier:'u', emoji:'🥋', type:'armor',  def:2, desc:'-2 dmg taken' },
  { id:'bone_plate',   name:'Bone Plate',    tier:'c', emoji:'🦾', type:'armor',  def:1, desc:'-1 dmg taken' },
];

export const item = (id) => ITEMS.find(i => i.id === id);

export const LOOT = {
  common:   ['scrap_iron','food','rusty_blade','bone_club','cloth_wrap','scrap_iron','food'],
  uncommon: ['leather','scrap_iron','cloth','rusty_blade','iron_sword','leather_vest','bone_plate'],
  rare:     ['arcane','blueprint','iron_sword','leather_vest'],
};

export const RECIPES = [
  { id:'rusty_blade',  name:'Rusty Blade',  emoji:'🗡️', cost:{ scrap_iron:2 } },
  { id:'bone_club',    name:'Bone Club',    emoji:'🏏', cost:{ bone:3 } },
  { id:'iron_sword',   name:'Iron Sword',   emoji:'⚔️', cost:{ scrap_iron:3, bone:1 } },
  { id:'cloth_wrap',   name:'Cloth Wraps',  emoji:'🧣', cost:{ cloth:2 } },
  { id:'bone_plate',   name:'Bone Plate',   emoji:'🦾', cost:{ bone:3, cloth:1 } },
  { id:'leather_vest', name:'Leather Vest', emoji:'🥋', cost:{ leather:2, scrap_iron:1 } },
];

export const BODY_LOOT = ['bone','bone','bone','cloth',null,null];
