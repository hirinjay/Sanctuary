import { TILE } from '../../data/constants';
import UnitSprite from './UnitSprite';

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
  [TILE.CAGE]:     '#0a0a14',
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
  [TILE.CAGE]:     '⛓',
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
  if (tile.type === TILE.DOOR)  return tile.open ? (THEME_FLOOR_BG[theme] || THEME_FLOOR_BG.default) : tile.locked ? '#1c0305' : '#1c0e06';
  return TILE_BG[tile.type] || THEME_FLOOR_BG.default;
}

function tileContent(tile, visible, theme, x, y) {
  if (!visible) return null;
  if (tile.type === TILE.TRAP) return tile.revealed ? '⚠️' : null;
  if (tile.type === TILE.WALL) return wallIcon(theme, x, y) || null;
  if (tile.type === TILE.DOOR) return tile.open ? null : tile.locked ? '🔒' : '🚪';
  return TILE_ICON[tile.type] || null;
}

const STATUS_ICONS = { root:'🌿', slow:'🐢', bind:'⛓', stun:'💫', poison:'☠', burning:'🔥', marked:'🎯', shielded:'🛡' };

export default function MissionMap({ tiles, units, W, fv, hilight, raiseable, onCellClick, theme = 'dungeon', tileSize = 46 }) {
  const spriteSize = Math.round(tileSize * 0.58);
  const sFont      = Math.round(tileSize * 0.17);
  const wFont      = Math.round(tileSize * 0.28);
  const iFont      = Math.round(tileSize * 0.22);

  return (
    <div style={{
      display:'grid',
      gridTemplateColumns:`repeat(${W},${tileSize}px)`,
      gap:1,
      width:'fit-content',
    }}>
      {tiles.map((row, y) => row.map((tile, x) => {
        const k      = `${x},${y}`;
        const vis    = fv.has(k);
        const hi     = hilight.has(k);
        const isR    = raiseable.some(r => r.x===x && r.y===y);
        const marked = tile.marked && tile.type === TILE.LOOT && vis;
        const bg     = hi ? '#0f2a0f' : isR ? '#0f0f2a' : tileBg(tile, vis, theme);
        const content = tileContent(tile, vis, theme, x, y);

        // All units at this tile, sorted: living first (z-order top), fallen last (z-order bottom)
        const tileUnits = units
          .filter(u => u.x === x && u.y === y && u.ambushTriggered !== false)
          .sort((a, b) => (a.fallen ? 1 : 0) - (b.fallen ? 1 : 0));

        // Top unit drives glow + click — always the living one if present
        const topUnit = tileUnits[0] ?? null;
        const liveUnit = topUnit && !topUnit.fallen ? topUnit : null;
        const clickTarget = liveUnit ?? (tileUnits.find(u => u.fallen) ?? null);

        const apGlow = liveUnit && liveUnit.type !== 'enemy'
          ? liveUnit.ap >= 2 ? '0 0 5px 2px #2a7a2a88'
          : liveUnit.ap === 1 ? '0 0 5px 2px #7a6a1088'
          : '0 0 5px 2px #7a1a1a88'
          : undefined;

        const statusIcon = liveUnit?.statusEffects?.length
          ? STATUS_ICONS[liveUnit.statusEffects[0]?.id] ?? null
          : null;

        return (
          <div key={k}
            onClick={() => onCellClick(x, y, clickTarget, vis, hi)}
            style={{
              width:tileSize, height:tileSize,
              background: bg,
              border: hi ? '1px solid #2a5a2a' : isR ? '1px solid #4a4a8a' : marked ? '1px solid #c4a882' : '1px solid transparent',
              boxShadow: marked ? '0 0 5px 1px #c4a88288' : apGlow,
              display:'flex', alignItems:'center', justifyContent:'center',
              cursor: vis ? 'pointer' : 'default', borderRadius:1,
              position:'relative', flexShrink:0,
            }}>
            {vis && (
              tileUnits.length > 0
                ? <>
                    {/* Fallen units drawn first (behind) */}
                    {tileUnits.filter(u => u.fallen).map(u => (
                      <div key={u.id} style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:0 }}>
                        <UnitSprite unit={u} size={spriteSize} fallen />
                      </div>
                    ))}
                    {/* Living unit drawn on top */}
                    {liveUnit && (
                      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:1 }}>
                        <UnitSprite unit={liveUnit} size={spriteSize} />
                      </div>
                    )}
                    {/* Status badge */}
                    {statusIcon && (
                      <span style={{ position:'absolute', top:2, right:2, fontSize:sFont, lineHeight:1, zIndex:2 }}>{statusIcon}</span>
                    )}
                    {/* Sleeping indicator */}
                    {liveUnit?.sleeping && (
                      <span style={{ position:'absolute', top:2, left:2, fontSize:sFont, lineHeight:1, zIndex:2 }}>💤</span>
                    )}
                    {/* Multi-unit indicator: show count of fallen when living is also present */}
                    {liveUnit && tileUnits.length > 1 && (
                      <span style={{ position:'absolute', bottom:2, right:2, fontSize:Math.round(tileSize*0.14), color:'#5a3a3a', lineHeight:1, zIndex:2 }}>
                        ⊗{tileUnits.length - 1}
                      </span>
                    )}
                  </>
                : content
                  ? <span style={{ fontSize: tile.type===TILE.WALL ? wFont : iFont, opacity: tile.type===TILE.WALL ? 0.7 : 0.6 }}>{content}</span>
                  : null
            )}
          </div>
        );
      }))}
    </div>
  );
}
