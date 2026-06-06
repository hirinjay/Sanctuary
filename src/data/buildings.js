// Sanctuary building definitions.
// multi:true = can be placed many times (wall/floor, grid-only).
// multi:false = game-logic node, tracked in nodes[] array.
export const BUILDINGS = [
  { id:'wall',     name:'Stone Wall',  emoji:'🧱', color:'#1e1e2a', cost:{ stone:2 },                    workers:0, desc:'Defensive perimeter',       multi:true  },
  { id:'floor',    name:'Floor',       emoji:'⬜', color:'#141c14', cost:{ stone:1 },                    workers:0, desc:'Paved floor tile',           multi:true  },
  { id:'farm',     name:'Farm Plot',   emoji:'🌱', color:'#1a3a18', cost:{ cloth:2, bone:1 },             workers:0, desc:'Yields 2 food on return',   multi:false },
  { id:'quarry',   name:'Quarry',      emoji:'⛏',  color:'#1e1e1e', cost:{ scrap_iron:2 },                workers:1, desc:'Yields 2 iron on return',   multi:false },
  { id:'forge',    name:'Forge',       emoji:'🔥', color:'#2a1204', cost:{ scrap_iron:3, bone:2 },        workers:2, desc:'Craft weapons & armor',     multi:false },
  { id:'storage',  name:'Storage',     emoji:'📦', color:'#1a1204', cost:{ wood:4, nails:2 },             workers:1, desc:'Keeps goods safe',          multi:false },
  { id:'barracks', name:'Barracks',    emoji:'⚔️', color:'#060a1e', cost:{ wood:6, stone:2, nails:4 },  workers:3, desc:'Recruit survivors',          multi:false },
  { id:'workshop', name:'Workshop',    emoji:'🔧', color:'#0a1a1a', cost:{ wood:4, scrap_iron:3, nails:4 }, workers:2, desc:'Craft tools & gear',     multi:false },
];

export const building = (id) => BUILDINGS.find(b => b.id === id);
