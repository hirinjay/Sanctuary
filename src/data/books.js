export const BOOKS = [
  {
    id:'pale', name:'The Pale Codex', emoji:'📖',
    bonus:'Tether +2', trade:'HP -2', desc:'More slots, less flesh.',
    ap:{ tetherCap:3, hp:8, maxHp:8, raiseRange:2, drainRange:2 },
    ub:null,
  },
  {
    id:'flesh', name:'Whispers of the Flesh', emoji:'📕',
    bonus:'HP +6, Drain +1', trade:'Tether -1', desc:'Varek endures.',
    ap:{ tetherCap:0, hp:16, maxHp:16, raiseRange:2, drainRange:3 },
    ub:null,
  },
  {
    id:'verdant', name:'The Verdant Rite', emoji:'📗',
    bonus:'Raise Range +2', trade:'Drain melee only', desc:'Reach further.',
    ap:{ tetherCap:1, hp:10, maxHp:10, raiseRange:4, drainRange:1, raiseWindow:4 },
    ub:null,
  },
  {
    id:'tinker', name:"The Tinker's Grimoire", emoji:'📘',
    bonus:'Undead +1hp, dmg cap ×2', trade:'Tether -1', desc:'Fewer, better.',
    ap:{ tetherCap:0, hp:10, maxHp:10, raiseRange:2, drainRange:2 },
    ub:{ dmg:0, hp:1, tinker:true },
  },
];
