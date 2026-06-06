import { useGameStore } from '../../store/gameStore'
import { TERRAIN, LOC_TYPE } from '../../world/tileTypes'

export default function WorldUI() {
  const { world, worldPos, sanctuaryPos, selectedHex, startMission, setScreen, selectHex, moveOnWorld } = useGameStore()

  if (!world) return null

  const selTile = selectedHex
    ? world.tiles[selectedHex.row * world.width + selectedHex.col]
    : null

  const isVarekHere = worldPos && selectedHex &&
    worldPos.col === selectedHex.col && worldPos.row === selectedHex.row

  const isSanctuaryHere = sanctuaryPos && selectedHex &&
    sanctuaryPos.col === selectedHex.col && sanctuaryPos.row === selectedHex.row

  const canMove = selTile && selTile.fog !== 'hidden' && TERRAIN[selTile.terrain]?.passable && !isVarekHere

  const tag = (color, label) => (
    <span style={{ background:`${color}22`, border:`1px solid ${color}44`, borderRadius:3,
      padding:'1px 6px', fontSize:10, color, marginRight:5 }}>
      {label}
    </span>
  )

  return (
    <>
      {/* Top-left: Varek status */}
      <div style={{ position:'absolute', top:12, left:12, background:'#06091488',
        backdropFilter:'blur(4px)', border:'1px solid #1a1a2a', borderRadius:8,
        padding:'8px 12px', fontSize:11, color:'#c4a882', pointerEvents:'none' }}>
        <div style={{ color:'#e8d5b0', marginBottom:3 }}>🧙 Varek</div>
        {worldPos && <div style={{ color:'#4a5a4a', fontSize:10 }}>
          Hex {worldPos.col},{worldPos.row}
        </div>}
        {!sanctuaryPos && (
          <div style={{ color:'#8a6a2a', fontSize:10, marginTop:4 }}>
            Click a passable tile to place Sanctuary
          </div>
        )}
      </div>

      {/* Top-right: controls hint */}
      <div style={{ position:'absolute', top:12, right:12, background:'#06091466',
        border:'1px solid #1a1a2a', borderRadius:6, padding:'6px 10px',
        fontSize:9, color:'#2a3a3a', pointerEvents:'none', textAlign:'right' }}>
        Drag to pan · Scroll to zoom<br/>
        Click hex to select · Double-click to move
      </div>

      {/* Bottom panel: selected hex info */}
      {selTile && selTile.fog !== 'hidden' && (
        <div style={{ position:'absolute', bottom:16, left:'50%', transform:'translateX(-50%)',
          background:'#06091488', backdropFilter:'blur(4px)',
          border:'1px solid #2a2a3a', borderRadius:8, padding:'10px 16px',
          minWidth:260, maxWidth:360, color:'#c4a882', fontSize:11 }}>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <div>
              {isSanctuaryHere && tag('#6a9a6a','⌂ Sanctuary')}
              {selTile.location && tag(LOC_TYPE[selTile.location.type]?.tint ? '#c4a882' : '#c4a882', selTile.location.name)}
              <span style={{ color:'#e8d5b0', fontWeight:'bold' }}>
                {TERRAIN[selTile.terrain]?.label}
              </span>
              {selTile.fog === 'explored' && <span style={{ color:'#3a4a3a', fontSize:10, marginLeft:6 }}>(explored)</span>}
            </div>
            <span style={{ color:'#3a4a3a', fontSize:9 }}>{selTile.col},{selTile.row}</span>
          </div>

          {selTile.location && (
            <div style={{ marginBottom:8, fontSize:10 }}>
              <span style={{ color:'#4a5a4a' }}>Danger: </span>
              <span style={{ color:selTile.location.danger > 1 ? '#8a4a4a' : '#5a8a5a' }}>
                {'▲'.repeat(selTile.location.danger) || '—'}
              </span>
              <span style={{ color:'#4a5a4a', marginLeft:10 }}>Loot: </span>
              <span style={{ color:'#c4a882' }}>{selTile.location.lq}</span>
            </div>
          )}

          <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
            {isSanctuaryHere && (
              <button onClick={() => setScreen('sanctuary')} style={actionBtn('#6a9a6a')}>
                ⌂ Enter Sanctuary
              </button>
            )}
            {canMove && !selTile.location && !isSanctuaryHere && (
              <button onClick={() => moveOnWorld(selTile.col, selTile.row)} style={actionBtn('#4a6a8a')}>
                ↗ Move Here
              </button>
            )}
            {isVarekHere && selTile.location && (
              <>
                <button onClick={() => {
                  startMission({ id:`${selTile.location.type}_${selTile.col}_${selTile.row}`,
                    name:selTile.location.name, danger:selTile.location.danger,
                    lq:selTile.location.lq, desc:'', links:[] }, 'scavenge')
                  selectHex(null)
                }} style={actionBtn('#3a6a3a')}>
                  🤫 Scavenge
                </button>
                <button onClick={() => {
                  startMission({ id:`${selTile.location.type}_${selTile.col}_${selTile.row}`,
                    name:selTile.location.name, danger:selTile.location.danger,
                    lq:selTile.location.lq, desc:'', links:[] }, 'raid')
                  selectHex(null)
                }} style={actionBtn('#6a3a3a')}>
                  ⚔️ Raid
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function actionBtn(color) {
  return {
    background:`${color}22`, border:`1px solid ${color}88`, borderRadius:5,
    padding:'6px 12px', color, cursor:'pointer', fontSize:11,
  }
}
