// x/y are percentages of the overworld map container (0–100)
export const LOCS = [
  {
    id:'town', name:'Ruined Town', danger:1, lq:'common',
    desc:'Abandoned streets. Good for quiet work.',
    x:12, y:68, links:['market'],
  },
  {
    id:'market', name:'Collapsed Market', danger:2, lq:'uncommon',
    desc:'Dense containers, narrow corridors.',
    x:50, y:44, links:['town','outpost'],
  },
  {
    id:'outpost', name:'Wizard Outpost', danger:3, lq:'rare',
    desc:'Arcane residue. Powerful and deadly.',
    x:84, y:18, links:['market'],
  },
];

export const locById = (id) => LOCS.find(l => l.id === id);
