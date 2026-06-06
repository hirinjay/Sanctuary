import { UT, XP_LEVELS, VAREK_LU, UNDEAD_LU } from '../data/constants';
import { ARCHETYPES, CLASS_STATS } from '../data/archetypes';

export function xpNext(lv) {
  return XP_LEVELS[Math.min(lv, XP_LEVELS.length-1)] || 999;
}

export function tetherUsed(roster, mUnits) {
  const mIds = new Set((mUnits || []).filter(u => u.type === UT.UNDEAD).map(u => u.id));
  return roster.filter(u => !mIds.has(u.id)).length
    + (mUnits || []).filter(u => u.type === UT.UNDEAD && !u.fallen).length;
}

export function classStats(cls, fresh, ub) {
  const base = CLASS_STATS[cls] || { hp:6, dmg:3, def:0, moveRange:3, trapReveal:1, attackRange:1 };
  const hp  = fresh ? base.hp  : Math.ceil(base.hp * .6);
  const dmg = fresh ? base.dmg : Math.max(1, base.dmg - 1);
  const def = fresh ? base.def : 0;
  return {
    hp:  hp  + (ub?.hp  || 0),
    maxHp: hp + (ub?.hp  || 0),
    dmg: dmg + (ub?.dmg || 0),
    def,
    moveRange:   base.moveRange,
    trapReveal:  base.trapReveal,
    attackRange: base.attackRange || 1,
  };
}

export function applyXpToUnits(units, uid, amt, luqRef) {
  return units.map(u => {
    if (u.id !== uid) return u;
    let xp = u.xp + amt, lv = u.level;
    while (xp >= xpNext(lv) && lv < 5) {
      xp -= xpNext(lv);
      lv++;
      luqRef.push({ uid, opts: u.type === UT.VAREK ? VAREK_LU : UNDEAD_LU });
    }
    return { ...u, xp, level: lv };
  });
}

export function spawnEnemies(danger, mode) {
  const hpMult  = 1 + (danger-1) * 0.35;
  const dmgMult = 1 + (danger-1) * 0.25;
  return Array.from({ length: 1+danger }, (_, i) => {
    const a  = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];
    const hp = Math.round(a.hp * hpMult);
    const dmg = Math.max(1, Math.round(a.dmg * dmgMult));
    return {
      id: `e${i}`, type: UT.ENEMY,
      name: a.name, emoji: a.emoji,
      x: 2+Math.floor(Math.random()*(14)), y: 1+Math.floor(Math.random()*4),
      hp, maxHp: hp, dmg, def: 0,
      ap: 2, moveRange: a.move, attackRange: a.attackRange || 1,
      fallen: false, raiseTurn: null,
      alerted: mode === 'raid',
      patrol: [{ dx:1, dy:0 }, { dx:-1, dy:0 }], pi: 0,
      xp: a.xp, dc: a.dc, sight: a.sight, spot: a.spot,
      weapon: null, armor: null, level: 1, xpVal: 0,
      chaseTurns: 0, lastKnown: null,
    };
  });
}
