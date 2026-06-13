import { UT, XP_LEVELS, VAREK_LU, UNDEAD_LU, VERDANT_VAREK_LU } from '../data/constants';
import { ARCHETYPES, CLASS_STATS } from '../data/archetypes';
import { FACTION_POOLS, calcEnemyTier, killXpByTier } from '../data/enemyDefs';

const PLACEMENT_WEIGHTS = {
  dungeon:     ['patrol','patrol','patrol','guard','guard','sleep','roam'],
  cabin:       ['guard','guard','sleep','patrol'],
  wild_forest: ['roam','roam','patrol','sleep','ambush'],
  wild_ruins:  ['patrol','roam','roam','sleep','ambush'],
  wild_swamp:  ['roam','roam','roam','ambush','ambush'],
  camp:        ['guard','guard','patrol','sleep','sleep'],
  village:     ['patrol','roam','sleep','guard'],
  wizard_tower:['guard','guard','sleep','patrol','ambush'],
  crypt:       ['guard','sleep','sleep','patrol','ambush'],
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
    const maxLv = u.tier === 3 ? 10 : u.type === UT.VAREK ? 5 + (u.varekAscensions ?? 0) * 5 : 5;
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

// ── Defense temperament ──────────────────────────────────────────────
// Maps a unit to its defensive reaction: dodge / counter / defend.
// Also doubles as the retreat-temperament classification used by enemy AI:
// dodge & counter units retreat toward allies at low HP, defend units fight on.
export function defenseTypeFor(unit) {
  if (unit.type === UT.VAREK) return 'defend';
  if (unit.type === UT.ENEMY) {
    if (unit.isBoss) return 'defend';
    if (['ranged','support','flanker'].includes(unit.aiRole)) return 'dodge';
    if (['berserker','alpha','territorial'].includes(unit.aiRole)) return 'defend';
    // Only Wanderer-lineage enemies (Skeleton Warrior dc) have a counter-attack passive.
    if (unit.dc === 'Skeleton Warrior') return 'counter';
    return 'hit';
  }
  // Player/undead units, classified by base-class lineage (dc field)
  if (unit.dc === 'Grave Stalker') return 'dodge';
  if (unit.dc === 'Grave Warden')  return 'defend';
  return 'counter';
}

// Chance (0-100) that a unit successfully dodges/counters/defends an incoming hit.
export function evasionChance(unit) {
  const tier = unit.xpTier ?? unit.tier ?? 1;
  const base = unit.isBoss ? 25 : tier === 3 ? 20 : tier === 2 ? 15 : 10;
  const bonus = (unit.evasionBonus ?? 0) * 3;
  return Math.min(35, base + bonus);
}

// Resolves an attack against a defender's evasion chance and temperament.
// Legacy traits (acquired via rebirth/merge) roll independently alongside the
// defender's primary temperament — first success wins.
export function resolveDefense(attacker, defender, dmg) {
  const chance = evasionChance(defender);
  const types = [...new Set([defenseTypeFor(defender), ...(defender.legacy_traits ?? [])])];
  for (const type of types) {
    if (type === 'hit') continue;
    if (Math.random() * 100 >= chance) continue;
    if (type === 'dodge')   return { outcome:'dodge', dmg:0 };
    if (type === 'counter') return { outcome:'counter', dmg, counterDmg: defender.dmg||1 };
    if (type === 'defend')  return { outcome:'defend', dmg: Math.ceil(dmg/2) };
  }
  return { outcome:'hit', dmg };
}

// Weighted faction pools per location type — 'dungeon' means the plain
// ARCHETYPES fallback (skeleton-ish guardians). Mixing in adventurer/raider
// factions gives dungeons, towers, and villages more varied threats than a
// uniform 3-archetype pool.
const LOC_FACTION_WEIGHTS = {
  camp:         ['raider'],
  village:      ['adventurer','adventurer','dungeon'],
  wizard_tower: ['dungeon','dungeon','adventurer','adventurer'],
  crypt:        ['dungeon','dungeon','dungeon','adventurer'],
  dungeon:      ['dungeon','dungeon','dungeon','adventurer'],
  default:      ['dungeon'],
};

function pickFaction(locType) {
  const key = Object.keys(LOC_FACTION_WEIGHTS).find(k => locType?.startsWith(k)) ?? 'default';
  const tbl = LOC_FACTION_WEIGHTS[key];
  return tbl[Math.floor(Math.random() * tbl.length)];
}

// Pick enemy template: faction pool when locType matches, else archetype pool
function pickTemplate(locType, requiredTier, threats) {
  if (threats?.length) return threats[Math.floor(Math.random() * threats.length)];

  const faction = pickFaction(locType);
  if (faction !== 'dungeon') {
    const pool = FACTION_POOLS[faction] ?? [];
    const eligible = pool.filter(e => e.tier <= requiredTier);
    // Weight toward higher tiers within limit
    const weighted = eligible.flatMap(e => Array(e.tier).fill(e));
    const src = weighted.length ? weighted : eligible;
    if (src.length) {
      const def = src[Math.floor(Math.random() * src.length)];
      // Convert enemyDef shape to the shared enemy template shape
      return { name:def.name, emoji:def.emoji, hp:def.hp, dmg:def.dmg, def:def.def||0,
               move:def.move, xp:0, dc:def.dc, sight:def.sight, spot:def.spot,
               attackRange:def.attackRange||1, aiRole:def.aiRole, faction:def.faction,
               tier:def.tier, abilities:def.abilities??[], triggerRadius:def.triggerRadius };
    }
  }
  // Fallback: dungeon archetypes
  const a = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];
  return { ...a, move: a.move, aiRole:'melee', faction:'dungeon', tier: requiredTier, abilities:[] };
}

export function spawnEnemies(danger, mode, tiles, spawnX = 1, spawnY = 10, threats = null, locType = '', floor = 1, isBossFloor = false) {
  const requiredTier = calcEnemyTier(danger, floor, isBossFloor);
  const hpMult  = 1 + (danger-1) * 0.35;
  const dmgMult = 1 + (danger-1) * 0.25;
  const mapH = tiles?.length ?? 12;
  const mapW = tiles?.[0]?.length ?? 16;
  const baseCount = 1 + danger;

  // Occasionally a guard room: a tight cluster of 3-4 enemies led by an
  // elite mini-boss, planted somewhere the player must fight through.
  const eliteChance = Math.min(0.5, 0.22 + 0.08 * (danger - 1) + (floor - 1) * 0.05);
  const hasElitePack = !isBossFloor && mode !== 'raid' && Math.random() < eliteChance;
  const clusterSize = hasElitePack ? 3 + Math.floor(Math.random() * 2) : 0; // 3-4
  const count = Math.max(baseCount, clusterSize);

  // Anchor point for the guard room — far from spawn, on open ground
  let anchorX = Math.floor(mapW / 2), anchorY = Math.floor(mapH / 3);
  if (hasElitePack) {
    for (let a = 0; a < 60; a++) {
      const tx = 1 + Math.floor(Math.random() * (mapW - 2));
      const ty = 1 + Math.floor(Math.random() * (mapH - 2));
      if (Math.abs(tx - spawnX) + Math.abs(ty - spawnY) > 6 && tiles?.[ty]?.[tx]?.type !== 'wall') {
        anchorX = tx; anchorY = ty; break;
      }
    }
  }

  const placed = [];
  return Array.from({ length: count }, (_, i) => {
    const inCluster = i < clusterSize;
    const isElite   = inCluster && i === 0;
    const tier      = isElite ? Math.min(3, requiredTier + 1) : requiredTier;
    const a   = pickTemplate(locType, tier, threats);
    const hp  = Math.round(a.hp * hpMult * (isElite ? 1.5 : 1));
    const dmg = Math.max(1, Math.round(a.dmg * dmgMult * (isElite ? 1.3 : 1)));
    // Faction enemies in raids use roam; dungeon enemies use placement weights
    const factionRaid = mode === 'raid' && (a.faction === 'raider' || a.faction === 'animal');
    const placement   = inCluster ? 'guard' : factionRaid ? 'roam' : (mode === 'raid' ? 'roam' : pickPlacement(locType));
    const sleeping    = placement === 'sleep';
    const waypoints   = placement === 'patrol' ? genWaypoints(tiles, mapW, mapH, spawnX, spawnY, 2+Math.floor(Math.random()*2)) : undefined;
    const triggerRow  = placement === 'ambush' ? Math.floor(mapH * 0.5) : undefined;

    let ex, ey;
    if (inCluster) {
      // Cluster around the guard-room anchor, spreading within a small radius
      ex = anchorX; ey = anchorY;
      for (let attempt = 0; attempt < 40; attempt++) {
        const tx = anchorX + Math.floor(Math.random() * 5) - 2;
        const ty = anchorY + Math.floor(Math.random() * 5) - 2;
        if (tx >= 1 && tx < mapW - 1 && ty >= 1 && ty < mapH - 1
          && tiles?.[ty]?.[tx]?.type !== 'wall'
          && !placed.some(p => p.x === tx && p.y === ty)) { ex = tx; ey = ty; break; }
      }
    } else {
      ex = Math.floor(mapW / 2); ey = Math.floor(mapH / 3);
      const maxEnemyY = placement === 'ambush' ? Math.floor(mapH * 0.5) - 1 : mapH - 2;
      for (let attempt = 0; attempt < 60; attempt++) {
        const tx = 1 + Math.floor(Math.random() * (mapW - 2));
        const ty = 1 + Math.floor(Math.random() * Math.max(1, maxEnemyY - 1));
        const tooClose = Math.abs(tx - spawnX) + Math.abs(ty - spawnY) <= 5;
        const passable = tiles?.[ty]?.[tx]?.type !== 'wall';
        if (!tooClose && passable) { ex = tx; ey = ty; break; }
      }
    }
    placed.push({ x: ex, y: ey });

    // xp computed by tier formula at spawn (scaled by danger via hp)
    const xpVal = killXpByTier(hp, a.tier ?? 1, false);

    return {
      id: `e${i}`, type: UT.ENEMY,
      name: isElite ? `Elite ${a.name}` : a.name, emoji: a.emoji,
      x: ex, y: ey,
      hp, maxHp: hp, dmg, def: a.def ?? 0,
      actionPoints: 1, movementPoints: 1, moveRange: a.move, attackRange: a.attackRange || 1,
      fallen: false, raiseTurn: null,
      alerted: mode === 'raid',
      placement, sleeping,
      waypoints, wi: 0,
      ambushTriggered: placement !== 'ambush',
      triggerRow,
      patrol: [{ dx:1, dy:0 }, { dx:-1, dy:0 }], pi: 0,
      xp: xpVal, xpTier: a.tier ?? 1,
      dc: a.dc, sight: a.sight, spot: a.spot,
      aiRole: a.aiRole ?? 'melee',
      faction: a.faction ?? 'dungeon',
      abilities: a.abilities ?? [],
      triggerRadius: a.triggerRadius,
      isElite,
      weapon: null, armor: null, level: 1, xpVal: 0,
      chaseTurns: 0, lastKnown: null,
      statusEffects: [],
    };
  });
}
