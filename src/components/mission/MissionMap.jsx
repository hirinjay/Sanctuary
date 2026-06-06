import { TILE } from '../../data/constants';

const TILE_BG = {
  [TILE.WALL]:     '#181828',
  [TILE.RUBBLE]:   '#241a0d',
  [TILE.LOOT]:     '#0c240c',
  [TILE.LOOT_OPEN]:'#091509',
  [TILE.EXIT]:     '#0c1c28',
  [TILE.TRAP_X]:   '#340d0d',
  [TILE.FLOOR]:    '#0b1120',
};

const TILE_ICON = {
  [TILE.LOOT]:     '📦',
  [TILE.LOOT_OPEN]:'📭',
  [TILE.EXIT]:     '🚪',
  [TILE.TRAP_X]:   '💥',
  [TILE.RUBBLE]:   '·',
};

function tileBg(tile, visible) {
  if (!visible) return '#04040a';
  if (tile.type === TILE.TRAP) return tile.revealed ? '#240c0c' : '#0b1120';
  return TILE_BG[tile.type] || '#0b1120';
}

function tileIcon(tile, visible) {
  if (!visible) return '';
  if (tile.type === TILE.TRAP) return tile.revealed ? '⚠️' : '';
  return TILE_ICON[tile.type] || '';
}

export default function MissionMap({ tiles, units, W, fv, hilight, raiseable, onCellClick }) {
  return (
    <div style={{
      display:'grid',
      gridTemplateColumns:`repeat(${W},1fr)`,
      gap:1,
      maxWidth:510,
      margin:'0 auto 7px',
    }}>
      {tiles.map((row, y) => row.map((tile, x) => {
        const k   = `${x},${y}`;
        const vis = fv.has(k);
        const hi  = hilight.has(k);
        const u   = units.find(u => u.x===x && u.y===y);
        const isR = raiseable.some(r => r.x===x && r.y===y);

        return (
          <div key={k}
            onClick={() => onCellClick(x, y, u, vis, hi)}
            style={{
              width:'100%', aspectRatio:'1',
              background: hi ? '#0f2a0f' : isR ? '#0f0f2a' : tileBg(tile, vis),
              border: hi ? '1px solid #2a5a2a' : isR ? '1px solid #4a4a8a' : '1px solid transparent',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:9, cursor:vis ? 'pointer' : 'default', borderRadius:1,
            }}>
            {vis && (
              u
                ? <span style={{ opacity:u.fallen?.3:1, fontSize:u.id==='varek'?12:9 }}>{u.emoji}</span>
                : <span style={{ fontSize:7, opacity:.6 }}>{tileIcon(tile, vis)}</span>
            )}
          </div>
        );
      }))}
    </div>
  );
}
