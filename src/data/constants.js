export const TILE = {
  FLOOR:'floor', WALL:'wall', RUBBLE:'rubble',
  LOOT:'loot', LOOT_OPEN:'loot_open', EXIT:'exit',
  TRAP:'trap', TRAP_X:'trap_x',
  HOLY:'holy',
  SHADOW:'shadow', WATER:'water', ELEVATED:'elevated', FIRE:'fire', DOOR:'door', CAGE:'cage',
};
export const UT = { VAREK:'varek', UNDEAD:'undead', ENEMY:'enemy' };
export const W = 16;
export const H = 12;
export const XP_LEVELS = [0, 12, 18, 27, 40, 60, 80, 100, 120, 150];

export const UNAMES = [
  'Marn','Brel','Tosk','Veth','Gorr','Ilde','Sorn','Cael','Thev','Dusk',
  'Rael','Oswin','Breck','Fynn','Yael','Koss','Muir','Dren','Hela','Sable',
  'Thorn','Wren','Greave','Ashe','Cinder','Voss','Nael','Lurk','Bane','Hollow',
];

// 'evasion' label/desc are resolved dynamically (see defenseTypeFor) based on
// the unit's defensive temperament — dodge/counter/defend.
export const VAREK_LU = [
  { id:'tether',   label:'Tether +2',      desc:'+1 auto per level, +1 bonus if chosen' },
  { id:'drain',    label:'Drain Range +1', desc:'Drain reaches further' },
  { id:'hp',       label:'HP +4',          desc:'More health' },
  { id:'raise',    label:'Raise Range +1', desc:'Raise from further' },
  { id:'evasion',  label:'<dynamic>',      desc:'Improve your defensive reaction (capped)' },
];
// Verdant Rite variant — drain is melee-only so range is moot; swap for attack power
export const VERDANT_VAREK_LU = [
  { id:'tether',   label:'Tether +2',      desc:'+1 auto per level, +1 bonus if chosen' },
  { id:'dmg',      label:'Attack +1',      desc:'Drain hits harder (cap 6, then lifesteal)' },
  { id:'hp',       label:'HP +4',          desc:'More health' },
  { id:'raise',    label:'Raise Range +1', desc:'Raise from further' },
  { id:'evasion',  label:'<dynamic>',      desc:'Improve your defensive reaction (capped)' },
];
export const UNDEAD_LU = [
  { id:'hp',      label:'HP +3',     desc:'Sturdier bones' },
  { id:'dmg',     label:'Damage +1', desc:'Hits harder' },
  { id:'move',    label:'Move +1',   desc:'Faster' },
  { id:'evasion', label:'<dynamic>', desc:'Improve your defensive reaction (capped)' },
];

// Status effect ids — stored as { id, duration, magnitude, sourceId } in unit.statusEffects[]
export const STATUS = {
  ROOT:     'root',     // cannot move; can attack and use abilities
  SLOW:     'slow',     // move range halved (rounded down)
  BIND:     'bind',     // cannot move or attack; abilities usable
  STUN:     'stun',     // cannot move, attack, or use abilities (1 turn)
  POISON:   'poison',   // lose magnitude hp per turn (does not affect undead unless arcane)
  BURNING:  'burning',  // 1hp per turn; spreads to adjacent tiles each turn
  MARKED:   'marked',   // takes +magnitude dmg from all sources
  SHIELDED: 'shielded', // negates next magnitude damage
};

export const DEFAULT_VP = {
  hp:10, maxHp:10, xp:0, level:1,
  dmg:2, raiseRange:2, drainRange:2, tetherCap:1,
  moveRange:3, trapReveal:1, weapon:null, armor:null,
  varekAscensions:0, varekAbilities:[],
};
