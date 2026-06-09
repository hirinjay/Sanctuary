import { UT, XP_LEVELS, VAREK_LU, UNDEAD_LU, VERDANT_VAREK_LU } from '../data/constants';
import { ARCHETYPES, CLASS_STATS } from '../data/archetypes';

const PLACEMENT_WEIGHTS = {
  dungeon:     ['patrol','patrol','patrol','guard','guard','sleep','roam'],
  cabin:       ['guard','guard','sleep','patrol'],
  wild_forest: ['roam','roam','patrol','sleep','ambush'],
  wild_ruins:  ['patrol','roam','roam','sleep','ambush'],
  wild_swamp:  ['roam','roam','roam','ambush','ambush'],
  camp:        ['guard','guard','patrol','sleep','sleep'],
  village:     ['patrol','roam','sleep','guard'],
  default:     ['patrol','patrol','roam'],
};

function pickPlacement(locType) {
  const key = Object.keys(PLACEMENT_WEIGHTS).find(k => locType?.startsWith(k)) ?? 'default';
  const tbl = PLACEMENT_WEIGHTS[key];
  return tbl[Math.floor(Math.random() * tbl.length)];
}

function genWaypoints(tiles, mapW, mapH, spawnX, spawnY, count) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    for (let a = 0; a < 60; a++) {
      const x = 1 + Math.floor(Math.random() * (mapW - 2));
      const y = 1 + Math.floor(Math.random() * (mapH - 2));
      if (tiles?.[y]?.[x]?.type !== 'wall'
        && Math.abs(x-spawnX)+Math.abs(y-spawnY) > 4
        && !pts.some(p => Math.abs(p.x-x)+Math.abs(p.y-y) < 4))
      { pts.push({x,y}); break; }
    }
  }
  return pts;
}

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

// Returns stat/xp bonus from a sacrifice unit. Returns null for tier-3 (ability transfer instead).
export function calcSacrificeBonus(sac) {
  if (!sac || sac.tier === 3) return null;
  const score = (sac.tier ?? 1) * (sac.level ?? 1);
  const bonus = { hp: 0, dmg: 0, move: 0, startingXp: Math.min(11, score) };
  const dc = sac.dc ?? 'Skeleton Warrior';
  if (dc === 'Grave Warden')       bonus.hp   = Math.floor(score * 0.5);
  else if (dc === 'Skeleton Warrior') bonus.dmg = score >= 8 ? 2 : score >= 5 ? 1 : 0;
  else if (dc === 'Grave Stalker')    bonus.move = score >= 8 ? 2 : score >= 5 ? 1 : 0;
  return bonus;
}

export function applyXpToUnits(units, uid, amt, luqRef, varekOpts) {
  return units.map(u => {
    if (u.id !== uid) return u;
    let xp = u.xp + amt, lv = u.level;
    const maxLv = u.tier === 3 ? 10 : 5;
    while (xp >= xpNext(lv) && lv < maxLv) {
      xp -= xpNext(lv);
      lv++;
      const isClassPromo = u.type !== UT.VAREK && !u.classId && lv === 2;
      luqRef.push({
        uid,
        opts: u.type === UT.VAREK ? (varekOpts ?? VAREK_LU) : UNDEAD_LU,
        ...(isClassPromo ? { type: 'class_promotion' } : {}),
      });
    }
    if (lv >= maxLv) xp = Math.min(xp, xpNext(maxLv) - 1);
    return { ...u, xp, level: lv };
  });
}
export { VERDANT_VAREK_LU };

export function spawnEnemies(danger, mode, tiles, spawnX = 1, spawnY = 10, threats = null, locType = '') {
  const pool    = threats?.length ? threats : ARCHETYPES;
  const hpMult  = 1 + (danger-1) * 0.35;
  const dmgMult = 1 + (danger-1) * 0.25;
  const mapH = tiles?.length ?? 12;
  const mapW = tiles?.[0]?.length ?? 16;
  return Array.from({ length: 1+danger }, (_, i) => {
    const a   = pool[Math.floor(Math.random() * pool.length)];
    const hp  = Math.round(a.hp * hpMult);
    const dmg = Math.max(1, Math.round(a.dmg * dmgMult));

    const placement   = mode === 'raid' ? 'roam' : pickPlacement(locType);
    const sleeping    = placement === 'sleep';
    const waypoints   = placement === 'patrol' ? genWaypoints(tiles, mapW, mapH, spawnX, spawnY, 2+Math.floor(Math.random()*2)) : undefined;
    const triggerRow  = placement === 'ambush' ? Math.floor(mapH * 0.5) : undefined;

    // Pick spawn; ambush units go in the upper half of the map
    let ex = Math.floor(mapW / 2), ey = Math.floor(mapH / 3);
    const maxEnemyY = placement === 'ambush' ? Math.floor(mapH * 0.5) - 1 : mapH - 2;
    for (let attempt = 0; attempt < 60; attempt++) {
      const tx = 1 + Math.floor(Math.random() * (mapW - 2));
      const ty = 1 + Math.floor(Math.random() * Math.max(1, maxEnemyY - 1));
      const tooClose = Math.abs(tx - spawnX) + Math.abs(ty - spawnY) <= 5;
      const passable = tiles?.[ty]?.[tx]?.type !== 'wall';
      if (!tooClose && passable) { ex = tx; ey = ty; break; }
    }

    return {
      id: `e${i}`, type: UT.ENEMY,
      name: a.name, emoji: a.emoji,
      x: ex, y: ey,
      hp, maxHp: hp, dmg, def: 0,
      ap: 2, moveRange: a.move, attackRange: a.attackRange || 1,
      fallen: false, raiseTurn: null,
      alerted: mode === 'raid',
      placement, sleeping,
      waypoints, wi: 0,
      ambushTriggered: placement !== 'ambush',
      triggerRow,
      patrol: [{ dx:1, dy:0 }, { dx:-1, dy:0 }], pi: 0,
      xp: a.xp, dc: a.dc, sight: a.sight, spot: a.spot,
      weapon: null, armor: null, level: 1, xpVal: 0,
      chaseTurns: 0, lastKnown: null,
    };
  });
}
