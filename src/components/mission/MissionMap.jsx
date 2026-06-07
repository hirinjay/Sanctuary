import { TILE } from '../../data/constants';

// Per-theme wall backgrounds and floor backgrounds
const THEME_WALL_BG = {
  forest:      '#071407',
  plains:      '#0c1408',
  ruins:       '#1a1610',
  swamp:       '#071410',
  dungeon:     '#111118',
  cabin:       '#130e08',
  battlefield: '#0e0c06',
  default:     '#111118',
};
const THEME_FLOOR_BG = {
  forest:      '#0a170a',
  plains:      '#0d1609',
  ruins:       '#131008',
  swamp:       '#0a160e',
  dungeon:     '#0b1120',
  cabin:       '#100e08',
  battlefield: '#14120a',
  default:     '#0b1120',
};

const TILE_BG = {
  [TILE.LOOT]:     '#0c240c',
  [TILE.LOOT_OPEN]:'#091509',
  [TILE.EXIT]:     '#0c1c28',
  [TILE.TRAP_X]:   '#340d0d',
  [TILE.RUBBLE]:   '#1a1510',
  [TILE.HOLY]:     '#1e1c08',
  [TILE.SHADOW]:   '#07070f',
  [TILE.WATER]:    '#081e30',
  [TILE.ELEVATED]: '#1c1508',
  [TILE.FIRE]:     '#2c0800',
};

const TILE_ICON = {
  [TILE.LOOT]:     '📦',
  [TILE.LOOT_OPEN]:'📭',
  [TILE.EXIT]:     '🚪',
  [TILE.TRAP_X]:   '💥',
  [TILE.RUBBLE]:   '·',
  [TILE.HOLY]:     '⛪',
  [TILE.SHADOW]:   '🌑',
  [TILE.WATER]:    '💧',
  [TILE.ELEVATED]: '⛰',
  [TILE.FIRE]:     '🔥',
};

// Deterministic wall icon based on position + theme
function wallIcon(theme, x, y) {
  const r = (x * 7 + y * 13) % 12;
  if (theme === 'forest' || theme === 'swamp') {
    if (r < 5)  return '🌲';
    if (r < 8)  return '🌳';
    if (r < 10) return '🌿';
    return '';
  }
  if (theme === 'ruins') {
    if (r < 3) return '🧱';
    if (r < 5) return '🪨';
    return '';
  }
  if (theme === 'plains') {
    if (r < 3) return '🌿';
    return '';
  }
  if (theme === 'cabin') {
    if (r < 4) return '🪵';
    return '';
  }
  if (theme === 'battlefield') {
    if (r < 4) return '🪨';
    return '';
  }
  return ''; // dungeon/default: no icon, just dark stone
}

function tileBg(tile, visible, theme) {
  if (!visible) return '#04040a';
  if (tile.type === TILE.TRAP)  return tile.revealed ? '#240c0c' : (THEME_FLOOR_BG[theme] || THEME_FLOOR_BG.default);
  if (tile.type === TILE.WALL)  return THEME_WALL_BG[theme]  || THEME_WALL_BG.default;
  if (tile.type === TILE.FLOOR) return THEME_FLOOR_BG[theme] || THEME_FLOOR_BG.default;
  if (tile.type === TILE.DOOR)  return tile.open ? (THEME_FLOOR_BG[theme] || THEME_FLOOR_BG.default) : '#1c0e06';
  return TILE_BG[tile.type] || THEME_FLOOR_BG.default;
}

function tileContent(tile, visible, theme, x, y) {
  if (!visible) return null;
  if (tile.type === TILE.TRAP) return tile.revealed ? '⚠️' : null;
  if (tile.type === TILE.WALL) return wallIcon(theme, x, y) || null;
  if (tile.type === TILE.DOOR) return tile.open ? null : '🚪';
  return TILE_ICON[tile.type] || null;
}

export default function MissionMap({ tiles, units, W, fv, hilight, raiseable, onCellClick, theme = 'dungeon' }) {
  return (
    <div style={{
      display:'grid',
      gridTemplateColumns:`repeat(${W},1fr)`,
      gap:1,
      maxWidth:560,
      margin:'0 auto 7px',
    }}>
      {tiles.map((row, y) => row.map((tile, x) => {
        const k   = `${x},${y}`;
        const vis = fv.has(k);
        const hi  = hilight.has(k);
        const u   = units.find(u => u.x===x && u.y===y);
        const isR = raiseable.some(r => r.x===x && r.y===y);
        const bg  = hi ? '#0f2a0f' : isR ? '#0f0f2a' : tileBg(tile, vis, theme);
        const content = tileContent(tile, vis, theme, x, y);

        const visibleUnit = u && u.ambushTriggered !== false;
        const apGlow = visibleUnit && !u.fallen
          ? u.ap >= 2 ? '0 0 4px 1px #2a7a2a'
          : u.ap === 1 ? '0 0 4px 1px #7a6a10'
          : '0 0 4px 1px #7a1a1a'
          : undefined;
        return (
          <div key={k}
            onClick={() => onCellClick(x, y, visibleUnit ? u : null, vis, hi)}
            style={{
              width:'100%', aspectRatio:'1',
              background: bg,
              border: hi ? '1px solid #2a5a2a' : isR ? '1px solid #4a4a8a' : '1px solid transparent',
              boxShadow: apGlow,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:9, cursor:vis ? 'pointer' : 'default', borderRadius:1,
            }}>
            {vis && (
              visibleUnit
                ? <span style={{ opacity:u.fallen?0.3:1, fontSize:u.id==='varek'?12:9 }}>{u.sleeping ? '💤' : u.emoji}</span>
                : content
                  ? <span style={{ fontSize: tile.type===TILE.WALL ? 10 : 7, opacity: tile.type===TILE.WALL ? 0.7 : 0.6 }}>{content}</span>
                  : null
            )}
          </div>
        );
      }))}
    </div>
  );
}
