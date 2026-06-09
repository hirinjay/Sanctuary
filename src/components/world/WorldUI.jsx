import { useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { TERRAIN, LOC_TYPE } from '../../world/tileTypes'
import { item } from '../../data/items'
import { isPlayableWorld } from '../../world/worldState'
import LevelUpModal from '../mission/LevelUpModal'
import PromotionModal from '../mission/PromotionModal'

export default function WorldUI() {
  const {
    world, worldPos, sanctuaryPos, selectedHex,
    pendingSanctuaryTile, travelBag,
    luq, promotionQueue,
    startMission, selectHex, openBestiary, goHome, enterSanctuary,
    confirmSanctuaryPlacement, cancelSanctuaryPlacement,
    depositLoot, forageCurrentTile,
  } = useGameStore()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!isPlayableWorld(world, worldPos)) return null

  const safeTravelBag = travelBag ?? {}
  const safeLuq = luq ?? []
  const safePromotionQueue = promotionQueue ?? []

  // Post-mission modals: level-up stat picks first, then promotions
  if (safeLuq.length > 0) return <LevelUpModal />
  if (safePromotionQueue.length > 0) return <PromotionModal />

  const selTile = selectedHex
    ? world.tiles[selectedHex.row * world.width + selectedHex.col]
    : null

  const bagCount = Object.values(safeTravelBag).reduce((a, b) => a + b, 0)
  const bagItems = Object.entries(safeTravelBag).map(([id, cnt]) => ({ it: item(id), cnt })).filter(x => x.it)

  const isVarekHere = worldPos && selectedHex &&
    worldPos.col === selectedHex.col && worldPos.row === selectedHex.row

  const canForage = isVarekHere && selTile && !selTile.location

  const tag = (color, label) => (
    <span style={{
      background: `${color}22`, border: `1px solid ${color}44`,
      borderRadius: 3, padding: '1px 6px', fontSize: 10, color, marginRight: 5,
    }}>{label}</span>
  )

  return (
    <>
      {/* ── Top-left: Varek status ──────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 12, left: 12, background: '#06091488',
        backdropFilter: 'blur(4px)', border: '1px solid #1a1a2a', borderRadius: 8,
        padding: '8px 12px', fontSize: 11, color: '#c4a882', pointerEvents: 'none', minWidth: 140,
      }}>
        <div style={{ color: '#e8d5b0', marginBottom: 3, fontWeight: 'bold' }}>🧙 Varek</div>
        {worldPos && (
          <div style={{ color: '#4a5a4a', fontSize: 10 }}>
            {worldPos.col},{worldPos.row}
          </div>
        )}
        {bagCount > 0 && (
          <div style={{ marginTop: 5, borderTop: '1px solid #1a1a2a', paddingTop: 5 }}>
            <div style={{ color: '#7a6a3a', fontSize: 9, marginBottom: 3 }}>🎒 Carrying</div>
            {bagItems.slice(0, 4).map(({ it, cnt }) => (
              <div key={it.id} style={{ fontSize: 10, color: '#c4a882' }}>{it.emoji} {it.name} ×{cnt}</div>
            ))}
            {bagItems.length > 4 && <div style={{ fontSize: 9, color: '#4a5a4a' }}>+{bagItems.length - 4} more</div>}
            {!sanctuaryPos && (
              <div style={{ fontSize: 9, color: '#5a4a2a', marginTop: 3 }}>
                ⚠ No sanctuary — all at risk on retreat
              </div>
            )}
          </div>
        )}
        {!sanctuaryPos && (
          <div style={{ color: '#8a6a2a', fontSize: 10, marginTop: 6 }}>
            Click a passable tile to place Sanctuary
          </div>
        )}
      </div>

      {/* ── Top-right: controls + menu ──────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        <div style={{
          background: '#06091466', border: '1px solid #1a1a2a', borderRadius: 6,
          padding: '6px 10px', fontSize: 9, color: '#2a3a3a', pointerEvents: 'none', textAlign: 'right',
        }}>
          Click tile → move · Scroll → zoom · Drag → pan
        </div>
        <button onClick={() => setMenuOpen(o => !o)} style={{
          background: '#06091488', border: '1px solid #2a2a3a', borderRadius: 6,
          padding: '5px 10px', color: '#4a5a6a', cursor: 'pointer', fontSize: 11,
        }}>≡ Menu</button>
        {menuOpen && (
          <div style={{
            background: '#0b0f1c', border: '1px solid #2a2a3a', borderRadius: 8,
            padding: 8, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 150,
          }}>
            <button onClick={() => { setMenuOpen(false); openBestiary(); }} style={{
              background: '#0a0a14', border: '1px solid #3a2a5a', borderRadius: 5,
              padding: '7px 12px', color: '#8a6aba', cursor: 'pointer', fontSize: 11, textAlign: 'left',
            }}>📖 Bestiary</button>
            <button onClick={() => { setMenuOpen(false); goHome(); }} style={{
              background: '#0a0a14', border: '1px solid #3a3a5a', borderRadius: 5,
              padding: '7px 12px', color: '#8a8aba', cursor: 'pointer', fontSize: 11, textAlign: 'left',
            }}>🏚 Return to Home</button>
            <button onClick={() => setMenuOpen(false)} style={{
              background: 'none', border: 'none', color: '#3a4a3a', cursor: 'pointer', fontSize: 10, textAlign: 'left',
            }}>Cancel</button>
          </div>
        )}
      </div>

      {/* ── Sanctuary confirm modal ─────────────────────────────────────── */}
      {pendingSanctuaryTile && (() => {
        const t = world.tiles[pendingSanctuaryTile.row * world.width + pendingSanctuaryTile.col]
        return (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: '#0b0f1c', border: '1px solid #4a6a4a', borderRadius: 10,
            padding: '20px 24px', width: 280, textAlign: 'center', zIndex: 50,
            boxShadow: '0 8px 32px #000a',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⌂</div>
            <div style={{ color: '#e8d5b0', fontWeight: 'bold', marginBottom: 6 }}>Establish Sanctuary?</div>
            <div style={{ fontSize: 11, color: '#4a5a4a', marginBottom: 4 }}>
              {TERRAIN[t?.terrain]?.label} at {pendingSanctuaryTile.col},{pendingSanctuaryTile.row}
            </div>
            <div style={{ fontSize: 10, color: '#3a4a3a', marginBottom: 16 }}>
              This becomes your home. You cannot move it.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={cancelSanctuaryPlacement} style={{
                flex: 1, background: '#140a0a', border: '1px solid #4a2a2a', borderRadius: 5,
                padding: '9px 0', color: '#7a4a4a', cursor: 'pointer', fontSize: 12,
              }}>Cancel</button>
              <button onClick={confirmSanctuaryPlacement} style={{
                flex: 1, background: '#0a1a0a', border: '1px solid #4a8a4a', borderRadius: 5,
                padding: '9px 0', color: '#6a9a6a', cursor: 'pointer', fontSize: 12, fontWeight: 'bold',
              }}>Establish</button>
            </div>
          </div>
        )
      })()}

      {/* ── Bottom: selected hex panel ──────────────────────────────────── */}
      {selTile && !pendingSanctuaryTile && selTile.fog !== 'hidden' && (
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          background: '#06091488', backdropFilter: 'blur(4px)',
          border: '1px solid #2a2a3a', borderRadius: 8, padding: '10px 16px',
          minWidth: 300, maxWidth: 440, color: '#c4a882', fontSize: 11,
        }}>
          {/* Tile header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div>
              {selTile.hasSanctuary && tag('#6a9a6a', '⌂ Sanctuary')}
              {selTile.location && tag('#c4a882', selTile.location.name)}
              <span style={{ color: '#e8d5b0', fontWeight: 'bold' }}>
                {TERRAIN[selTile.terrain]?.label}
              </span>
              {selTile.fog === 'explored' && (
                <span style={{ color: '#3a4a3a', fontSize: 10, marginLeft: 6 }}>(explored)</span>
              )}
            </div>
            <span style={{ color: '#3a4a3a', fontSize: 9 }}>{selTile.col},{selTile.row}</span>
          </div>

          {/* Terrain description */}
          <div style={{ fontSize: 10, color: '#4a5a4a', marginBottom: 6 }}>
            {TERRAIN[selTile.terrain]?.desc}
            {TERRAIN[selTile.terrain]?.encounterChance > 0 && (
              <span style={{ color: '#6a5a3a', marginLeft: 8 }}>
                ⚠ {Math.round(TERRAIN[selTile.terrain].encounterChance * 100)}% encounter/hex
              </span>
            )}
          </div>

          {/* Location detail */}
          {selTile.location && (
            <div style={{ fontSize: 10, marginBottom: 8 }}>
              <span style={{ color: '#4a5a4a' }}>Type: </span>
              <span style={{ color: '#c4a882' }}>
                {LOC_TYPE[selTile.location.type]?.emoji} {selTile.location.name}
              </span>
              <span style={{ color: '#4a5a4a', marginLeft: 10 }}>Danger: </span>
              <span style={{ color: selTile.location.danger > 1 ? '#8a4a4a' : '#5a8a5a' }}>
                {'▲'.repeat(selTile.location.danger) || '—'}
              </span>
              <span style={{ color: '#4a5a4a', marginLeft: 10 }}>Loot: </span>
              <span style={{ color: '#c4a882' }}>{selTile.location.lq}</span>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>

            {/* ── Varek is here: sanctuary actions ── */}
            {selTile.hasSanctuary && isVarekHere && (
              <>
                <button onClick={() => enterSanctuary()} style={actionBtn('#6a9a6a')}>
                  ⌂ Enter Sanctuary
                </button>
                {bagCount > 0 && (
                  <button onClick={depositLoot} style={actionBtn('#7a6a3a')}>
                    📥 Deposit {bagCount} item{bagCount !== 1 ? 's' : ''}
                  </button>
                )}
              </>
            )}

            {/* ── Varek is here: location actions ── */}
            {isVarekHere && selTile.location && (
              <>
                <button onClick={() => {
                  startMission({
                    id: `${selTile.location.type}_${selTile.col}_${selTile.row}`,
                    type: selTile.location.type,
                    name: selTile.location.name,
                    danger: selTile.location.danger,
                    lq: selTile.location.lq, desc: '', links: [],
                  }, 'scavenge')
                  selectHex(null)
                }} style={actionBtn('#3a6a3a')}>
                  🤫 Scavenge
                </button>
                {selTile.location.type !== 'cabin' && (
                  <button onClick={() => {
                    startMission({
                      id: `${selTile.location.type}_${selTile.col}_${selTile.row}`,
                      type: selTile.location.type,
                      name: selTile.location.name,
                      danger: selTile.location.danger,
                      lq: selTile.location.lq, desc: '', links: [],
                    }, 'raid')
                    selectHex(null)
                  }} style={actionBtn('#6a3a3a')}>
                    ⚔️ Raid
                  </button>
                )}
              </>
            )}

            {/* ── Varek is here: forage empty tile ── */}
            {canForage && (
              <button onClick={() => { forageCurrentTile(); selectHex(null); }} style={actionBtn('#3a5a3a')}>
                🌿 Forage
              </button>
            )}

          </div>
        </div>
      )}
    </>
  )
}

function actionBtn(color) {
  return {
    background: `${color}22`, border: `1px solid ${color}88`, borderRadius: 5,
    padding: '6px 12px', color, cursor: 'pointer', fontSize: 11,
  }
}
