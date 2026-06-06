export const ARCHETYPES = [
  { name:'Wanderer', emoji:'🚶', hp:6,  dmg:3, move:3, xp:8,  dc:'Skeleton Warrior', sight:3, spot:0.60, attackRange:1 },
  { name:'Scout',    emoji:'🏹', hp:5,  dmg:2, move:4, xp:6,  dc:'Grave Stalker',    sight:5, spot:0.80, attackRange:2 },
  { name:'Brute',    emoji:'💪', hp:10, dmg:4, move:2, xp:12, dc:'Grave Warden',     sight:2, spot:0.40, attackRange:1 },
];

export const CLASS_STATS = {
  'Skeleton Warrior': { hp:6,  dmg:3, def:0, moveRange:3, trapReveal:1, attackRange:1 },
  'Grave Stalker':    { hp:4,  dmg:2, def:0, moveRange:4, trapReveal:3, attackRange:2 },
  'Grave Warden':     { hp:10, dmg:4, def:1, moveRange:2, trapReveal:1, attackRange:1 },
};
