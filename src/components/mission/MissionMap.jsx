import { TILE } from '../../data/constants';
import UnitSprite from './UnitSprite';

// Per-theme wall backgrounds and floor backgrounds — walls are near-black, floors are clearly lighter
const THEME_WALL_BG = {
  forest:      '#020804',
  plains:      '#040904',
  ruins:       '#0c0904',
  village:     '#120c08',
  cave:        '#100b06',
  swamp:       '#020a06',
  dungeon:     '#070710',
  cabin:       '#0a0604',
  camp:        '#100804',
  battlefield: '#080604',
  wizard_tower:'#0a0418',
  crypt:       '#06080c',
  default:     '#070710',
};
const THEME_FLOOR_BG = {
  forest:      '#0e2210',
  plains:      '#131e0a',
  ruins:       '#201a10',
  village:     '#211810',
  cave:        '#18120d',
  swamp:       '#0e1e14',
  dungeon:     '#141a2e',
  cabin:       '#1c1610',
  camp:        '#2a1e0f',
  battlefield: '#1c1a0e',
  wizard_tower:'#201640',
  crypt:       '#161a22',
  default:     '#141a2e',
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
  if (theme === 'forest') return r < 8 ? '🌲' : '🌳';
  if (theme === 'swamp') return r < 7 ? '🌿' : '♒';
  if (theme === 'ruins') return r < 7 ? '🧱' : '╳';
  if (theme === 'village') return r < 8 ? '🧱' : '⌂';
  if (theme === 'plains') return r < 7 ? '🌾' : '·';
  if (theme === 'cabin') return r < 8 ? '🪵' : '╫';
  if (theme === 'camp') return r < 8 ? '🪵' : '╪';
  if (theme === 'battlefield') return r < 6 ? '☠' : '⚔';
  if (theme === 'wizard_tower') return r < 6 ? '🔮' : '✦';
  if (theme === 'crypt') return r < 6 ? '⚰' : '🦴';
  if (theme === 'cave') return r < 7 ? '⛰' : '◼';
  if (theme === 'dungeon') return r < 7 ? '🪨' : '▪';
  return '▪';
}

function tileBg(tile, visible, theme, turn) {
  if (!visible) return '#04040a';
  if (tile.type === TILE.TRAP)  return tile.revealed ? '#240c0c' : (THEME_FLOOR_BG[theme] || THEME_FLOOR_BG.default);
  if (tile.safeZone && turn <= 2) return '#102014';
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
  if (tile.type === TILE.EXIT) return tile.exitIcon ?? TILE_ICON[tile.type] ?? null;
  return TILE_ICON[tile.type] || null;
}

const STATUS_ICONS = { root:'🌿', slow:'🐢', bind:'⛓', stun:'💫', poison:'☠', burning:'🔥', marked:'🎯', shielded:'🛡' };

export default function MissionMap({ tiles, units, W, fv, hilight, phaseMoveTiles, phaseWallTiles, raiseable, onCellClick, theme = 'dungeon', tileSize = 46, turn = 999 }) {
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
        // Phase targeting: blue = reachable normally, green = only by phasing through a wall
        const phMove = phaseMoveTiles?.has(k);
        const phWall = phaseWallTiles?.has(k);
        const isR    = raiseable.some(r => r.x===x && r.y===y);
        const marked = tile.marked && tile.type === TILE.LOOT && vis;
        const bg     = phWall ? '#0f2a0f' : phMove ? '#0a1a3a' : hi ? '#0f2a0f' : isR ? '#0f0f2a' : tileBg(tile, vis, theme, turn);
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
          ? (liveUnit.actionPoints > 0 && liveUnit.movementPoints > 0) ? '0 0 5px 2px #2a7a2a88'
          : (liveUnit.actionPoints > 0 || liveUnit.movementPoints > 0) ? '0 0 5px 2px #7a6a1088'
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
              border: phWall ? '1px solid #2a5a2a' : phMove ? '1px solid #2a4a7a' : hi ? '1px solid #2a5a2a' : isR ? '1px solid #4a4a8a' : marked ? '1px solid #c4a882' : '1px solid transparent',
              boxShadow: marked ? '0 0 5px 1px #c4a88288' : apGlow,
              display:'flex', alignItems:'center', justifyContent:'center',
              cursor: (vis || phMove || phWall) ? 'pointer' : 'default', borderRadius:1,
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
