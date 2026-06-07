import { useState, useEffect } from 'react'
import { useGameStore } from '../../store/gameStore'
import { BUILDINGS, building } from '../../data/buildings'
import { item } from '../../data/items'

const pg = { background: '#040810', minHeight: '100vh', fontFamily: 'Georgia,serif', color: '#c4a882' }

const TILE_PX = 40

// Ground tile colors vary by position for natural look
function groundColor(col, row) {
  const v = ((col * 7 + row * 13) % 8) / 8
  const base = 0x0c
  const r = base + Math.floor(v * 6)
  return `rgb(${r}, ${r + 4}, ${r})`
}

const BLD_COLORS = {
  wall:     '#1e1e2a', floor:    '#141c14', farm:     '#1a3a18',
  quarry:   '#1e1e1e', forge:    '#2a1204', storage:  '#1a1204',
  barracks: '#060a1e', workshop: '#0a1a1a',
}

function btn(on, c) {
  return {
    background: on ? `${c}18` : '#0b0f1c', border: `1px solid ${on ? c : '#222233'}`,
    borderRadius: 5, padding: '5px 10px', color: on ? c : '#5a5a6a',
    cursor: on ? 'pointer' : 'default', fontSize: 11,
  }
}

export default function SanctuaryMapScreen() {
  const {
    inv, nodes, vp, roster, sanctuaryGrid, sanctuaryPos,
    setScreen, initSanctuaryGrid, placeBuilding, demolishBuilding, ti,
  } = useGameStore()

  const [placingId, setPlacingId] = useState(null)   // building being placed
  const [infoTile,  setInfoTile]  = useState(null)   // tile clicked for info

  const t        = ti(null)
  const workers  = t.baseCount
  const established = !!sanctuaryPos

  useEffect(() => { if (!sanctuaryGrid) initSanctuaryGrid() }, [])

  if (!sanctuaryGrid) return (
    <div style={{ ...pg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#3a4a3a' }}>Initialising…</span>
    </div>
  )

  const { tiles, width, height } = sanctuaryGrid

  function handleTileClick(col, row) {
    const tile = tiles.find(t => t.col === col && t.row === row)
    if (!tile) return

    if (tile.building) {
      setInfoTile(tile)
      setPlacingId(null)
      return
    }

    if (placingId) {
      placeBuilding(col, row, placingId)
      setPlacingId(null)
      return
    }

    setInfoTile(null)
  }

  function canBuild(bld) {
    if (!established) return false
    if (!bld.multi && !bld.workerCost && nodes.includes(bld.id)) return false
    if (bld.workerCost) {
      const placed = tiles.filter(t => t.building === bld.id).length
      if (placed >= workers) return false
    }
    const afford = Object.entries(bld.cost).every(([id, amt]) => (inv[id] || 0) >= amt)
    return afford && workers >= bld.workers
  }

  function costStr(bld) {
    return Object.entries(bld.cost).map(([id, amt]) => {
      const it = item(id)
      return `${amt}${it?.emoji || id}`
    }).join(' ')
  }

  return (
    <div style={pg}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 14 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h2 style={{ color: '#e8d5b0', margin: 0, fontSize: 16, letterSpacing: 2 }}>⌂ SANCTUARY MAP</h2>
            <div style={{ fontSize: 10, color: '#3a4a3a', marginTop: 2 }}>
              Workers: {workers}/{t.baseCap}
              {!established && <span style={{ color: '#7a4a2a', marginLeft: 10 }}>⚠ Place sanctuary on world map first</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {placingId && (
              <button onClick={() => setPlacingId(null)} style={btn(true, '#7a4a2a')}>
                ✕ Cancel Placement
              </button>
            )}
            <button onClick={() => setScreen('sanctuary')} style={btn(true, '#6a6aaa')}>
              ← Sanctuary
            </button>
          </div>
        </div>

        {placingId && (
          <div style={{ background: '#0a1a0a', border: '1px solid #3a6a3a', borderRadius: 6,
            padding: '7px 14px', marginBottom: 10, fontSize: 11, color: '#6a9a6a' }}>
            Placing: {building(placingId)?.emoji} {building(placingId)?.name} — click a ground tile
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

          {/* ── Grid ──────────────────────────────────────────────────── */}
          <div style={{ flex: 1, overflowX: 'auto' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${width}, ${TILE_PX}px)`,
              gap: 1,
              border: '1px solid #1a2a1a',
              borderRadius: 4,
              background: '#0a0a0a',
              padding: 1,
            }}>
              {tiles.map(tile => {
                const bld     = tile.building ? building(tile.building) : null
                const isInfo  = infoTile?.col === tile.col && infoTile?.row === tile.row
                const placing = !!placingId && !tile.building
                return (
                  <div
                    key={`${tile.col},${tile.row}`}
                    onClick={() => handleTileClick(tile.col, tile.row)}
                    title={bld ? `${bld.name}\n${bld.desc}` : `${tile.col},${tile.row}`}
                    style={{
                      width: TILE_PX, height: TILE_PX,
                      background: bld ? (BLD_COLORS[tile.building] || '#1a1a2a') : groundColor(tile.col, tile.row),
                      border: isInfo
                        ? '2px solid #c4a882'
                        : placing
                          ? '1px dashed #4a8a4a'
                          : '1px solid #0f150f',
                      cursor: (bld || placing) ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: bld ? 18 : 0, userSelect: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.1s',
                    }}
                  >
                    {bld?.emoji}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Right panel ───────────────────────────────────────────── */}
          <div style={{ width: 220, flexShrink: 0 }}>

            {/* Tile info */}
            {infoTile?.building && (() => {
              const bld = building(infoTile.building)
              return (
                <div style={{ background: '#090e1a', border: '1px solid #2a2a3a', borderRadius: 8,
                  padding: 10, marginBottom: 10 }}>
                  <div style={{ fontWeight: 'bold', color: '#e8d5b0', marginBottom: 4 }}>
                    {bld?.emoji} {bld?.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#4a5a4a', marginBottom: 8 }}>{bld?.desc}</div>
                  <button onClick={() => { demolishBuilding(infoTile.col, infoTile.row); setInfoTile(null) }}
                    style={btn(true, '#7a2a2a')}>
                    🔨 Demolish (50% back)
                  </button>
                </div>
              )
            })()}

            {/* Build palette */}
            <div style={{ fontSize: 11, color: '#4a5a4a', marginBottom: 7 }}>
              Build · {workers} worker{workers !== 1 ? 's' : ''} available
            </div>
            {BUILDINGS.map(bld => {
              const built   = !bld.multi && !bld.workerCost && nodes.includes(bld.id)
              const canPlace = canBuild(bld)
              const selecting = placingId === bld.id
              const placedCount = bld.workerCost ? tiles.filter(t => t.building === bld.id).length : 0
              const workersFull = bld.workerCost && placedCount >= workers
              const missingWorkers = workers < bld.workers
              const missingMats = !Object.entries(bld.cost).every(([id, amt]) => (inv[id] || 0) >= amt)
              const why = !established ? 'No sanctuary'
                : built ? 'Already built'
                : workersFull ? `Workers full (${workers} available, ${placedCount} built)`
                : missingWorkers ? `Need ${bld.workers} worker${bld.workers !== 1 ? 's' : ''}`
                : missingMats ? 'Not enough materials'
                : null

              return (
                <div key={bld.id}
                  onClick={() => canPlace && setPlacingId(selecting ? null : bld.id)}
                  title={why || undefined}
                  style={{
                    background: selecting ? '#0a1a0a' : '#090e1a',
                    border: `1px solid ${selecting ? '#4a8a4a' : '#1a1a2a'}`,
                    borderRadius: 6, padding: '7px 9px', marginBottom: 5,
                    cursor: canPlace ? 'pointer' : 'default',
                    opacity: canPlace || built ? 1 : 0.5,
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 16 }}>{bld.emoji}</span>
                    <div>
                      <div style={{ color: '#c4a882', fontSize: 11, fontWeight: built ? 'normal' : 'bold' }}>
                        {bld.name}
                        {built && <span style={{ color: '#5a8a5a', fontWeight: 'normal', marginLeft: 6, fontSize: 10 }}>✓</span>}
                        {bld.workerCost && placedCount > 0 && <span style={{ color: '#5a8a5a', fontWeight: 'normal', marginLeft: 6, fontSize: 10 }}>×{placedCount}</span>}
                      </div>
                      <div style={{ color: '#4a5a4a', fontSize: 9 }}>{bld.desc}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 9, color: '#3a4a3a' }}>
                    {costStr(bld)}
                    {bld.workers > 0 && ` · ${bld.workers}👤`}
                    {why && !built && <span style={{ color: '#6a4a2a', marginLeft: 6 }}>{why}</span>}
                  </div>
                </div>
              )
            })}

            {/* Inventory quick-view */}
            <div style={{ marginTop: 12, fontSize: 10, color: '#3a4a3a', borderTop: '1px solid #1a1a2a', paddingTop: 8 }}>
              <div style={{ marginBottom: 4 }}>📦 Materials</div>
              {['wood','stone','clay','rope','nails','sheet_metal','lumber','coal','scrap_iron','bone','cloth'].map(id => {
                const qty = inv[id] || 0
                if (!qty) return null
                const it = item(id)
                return (
                  <div key={id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span>{it?.emoji} {it?.name}</span>
                    <span style={{ color: '#c4a882' }}>×{qty}</span>
                  </div>
                )
              })}
              {Object.keys(inv).length === 0 && <span style={{ color: '#2a3a2a' }}>Empty</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
