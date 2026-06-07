// Weighted objective pools per location type.
// Battlefield has no enemies so eliminate is excluded there.
const POOLS = {
  dungeon:     ['exit','exit','exit','eliminate','eliminate','loot_named','loot_named','silent_bonus'],
  cabin:       ['exit','exit','exit','loot_named','loot_named','silent_bonus','silent_bonus'],
  wild_forest: ['exit','exit','eliminate','eliminate','survive','survive','silent_bonus'],
  wild_swamp:  ['exit','exit','survive','survive','survive','silent_bonus','silent_bonus'],
  wild_ruins:  ['exit','exit','eliminate','loot_named','silent_bonus'],
  camp:        ['exit','exit','eliminate','eliminate','eliminate','silent_bonus','silent_bonus'],
  village:     ['exit','exit','loot_named','loot_named','eliminate','silent_bonus'],
  battlefield: ['exit','exit','exit','loot_named','loot_named'],
  default:     ['exit','exit','exit','eliminate','survive','silent_bonus'],
};

export function generateObjective(locType, tiles, units, danger) {
  const pool = POOLS[locType] || POOLS.default;
  const type = pool[Math.floor(Math.random() * pool.length)];
  return buildObjective(type, tiles, units, danger);
}

function buildObjective(type, tiles, units, danger) {
  const enemies = (units || []).filter(u => u.type === 'enemy');

  switch (type) {

    case 'eliminate': {
      if (!enemies.length) return buildObjective('exit', tiles, units, danger);
      const tgt = enemies[Math.floor(Math.random() * enemies.length)];
      return {
        type, complete: false, failed: false,
        label: `Eliminate ${tgt.name}`,
        targetId: tgt.id,
        bonus: ['arcane'],
      };
    }

    case 'loot_named': {
      const lootTiles = [];
      if (tiles) {
        tiles.forEach((row, y) => row.forEach((t, x) => {
          if (t.type === 'loot') lootTiles.push({ x, y });
        }));
      }
      if (!lootTiles.length) return buildObjective('exit', tiles, units, danger);
      const lt = lootTiles[Math.floor(Math.random() * lootTiles.length)];
      return {
        type, complete: false, failed: false,
        label: 'Recover the marked cache',
        targetX: lt.x, targetY: lt.y,
        bonus: ['scrap_iron', 'cloth'],
      };
    }

    case 'survive': {
      const turns = 5 + (danger || 1) * 2;
      return {
        type, complete: false, failed: false,
        label: `Hold out ${turns} turns, then exit`,
        turns,
        bonus: ['food', 'bone'],
      };
    }

    case 'silent_bonus':
      return {
        type, complete: false, failed: false,
        label: 'Exit without triggering full alert',
        bonus: ['leather', 'scrap_iron'],
      };

    default:
      return { type: 'exit', complete: false, failed: false, label: 'Reach the exit', bonus: [] };
  }
}
