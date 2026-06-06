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
