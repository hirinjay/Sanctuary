export const TILE = {
  FLOOR:'floor', WALL:'wall', RUBBLE:'rubble',
  LOOT:'loot', LOOT_OPEN:'loot_open', EXIT:'exit',
  TRAP:'trap', TRAP_X:'trap_x',
  HOLY:'holy',
  SHADOW:'shadow', WATER:'water', ELEVATED:'elevated', FIRE:'fire', DOOR:'door',
};
export const UT = { VAREK:'varek', UNDEAD:'undead', ENEMY:'enemy' };
export const W = 16;
export const H = 12;
export const XP_LEVELS = [0, 12, 18, 27, 40, 60];

export const UNAMES = [
  'Marn','Brel','Tosk','Veth','Gorr','Ilde','Sorn','Cael','Thev','Dusk',
  'Rael','Oswin','Breck','Fynn','Yael','Koss','Muir','Dren','Hela','Sable',
  'Thorn','Wren','Greave','Ashe','Cinder','Voss','Nael','Lurk','Bane','Hollow',
];

export const VAREK_LU = [
  { id:'tether', label:'Tether +2',      desc:'+1 auto per level, +1 bonus if chosen' },
  { id:'drain',  label:'Drain Range +1', desc:'Drain reaches further' },
  { id:'hp',     label:'HP +4',          desc:'More health' },
  { id:'raise',  label:'Raise Range +1', desc:'Raise from further' },
];
export const UNDEAD_LU = [
  { id:'hp',   label:'HP +3',     desc:'Sturdier bones' },
  { id:'dmg',  label:'Damage +1', desc:'Hits harder' },
  { id:'move', label:'Move +1',   desc:'Faster' },
];

export const DEFAULT_VP = {
  hp:10, maxHp:10, xp:0, level:1,
  raiseRange:2, drainRange:2, tetherCap:1,
  moveRange:3, trapReveal:1, weapon:null, armor:null,
};
