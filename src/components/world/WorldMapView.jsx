import { useEffect, useRef } from 'react'
import { Application, Graphics, Container, Text, TextStyle } from 'pixi.js'
import { useGameStore } from '../../store/gameStore'
import { hexToPixel, hexPoints, tileKey } from '../../world/hexMath'
import { TERRAIN, LOC_TYPE } from '../../world/tileTypes'

const SIGHT_RADIUS = 3

export default function WorldMapView() {
  const canvasRef   = useRef(null)
  const appRef      = useRef(null)
  const layersRef   = useRef(null)  // { world, terrain, fog, locs, units, hl }
  const cameraRef   = useRef({ x: 0, y: 0, zoom: 0.8, drag: false, lx: 0, ly: 0 })
  const sizeRef     = useRef({ w: 800, h: 600 })

  // ── Init Pixi once ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let destroyed = false

    const app = new Application()
    app.init({
      canvas,
      backgroundColor: 0x020408,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      width: canvas.parentElement?.clientWidth || 800,
      height: canvas.parentElement?.clientHeight || 600,
    }).then(() => {
      if (destroyed) { app.destroy(true); return }
      appRef.current = app

      const worldCont = new Container()
      const terrain   = new Graphics()
      const fog       = new Graphics()
      const locs      = new Container()
      const units     = new Container()
      const hl        = new Graphics()

      worldCont.addChild(terrain)
      worldCont.addChild(locs)
      worldCont.addChild(units)
      worldCont.addChild(fog)
      worldCont.addChild(hl)
      app.stage.addChild(worldCont)
      layersRef.current = { worldCont, terrain, fog, locs, units, hl }

      // Draw current world if already generated
      const { world, worldPos, sanctuaryPos, selectedHex } = useGameStore.getState()
      if (world) {
        drawTerrain(world, terrain)
        drawLocIcons(world, locs)
        redrawFog(world, fog)
        if (worldPos) centerOn(worldPos.col, worldPos.row, app, world)
      }

      // Subscribe to store changes
      const unsubWorld = useGameStore.subscribe(
        s => s.world,
        (world) => {
          if (!world || !layersRef.current) return
          const { terrain, fog, locs } = layersRef.current
          drawTerrain(world, terrain)
          drawLocIcons(world, locs)
          redrawFog(world, fog)
        }
      )
      const unsubFog = useGameStore.subscribe(
        s => s.world?.tiles,
        (tiles) => {
          const { world } = useGameStore.getState()
          if (!world || !layersRef.current) return
          redrawFog(world, layersRef.current.fog)
          drawUnits(world, layersRef.current.units)
        }
      )
      const unsubPos = useGameStore.subscribe(
        s => s.worldPos,
        (pos) => {
          const { world } = useGameStore.getState()
          if (!pos || !world || !layersRef.current) return
          drawUnits(world, layersRef.current.units)
          centerOn(pos.col, pos.row, app, world)
        }
      )
      const unsubSel = useGameStore.subscribe(
        s => s.selectedHex,
        (sel) => {
          if (!layersRef.current) return
          redrawHighlight(sel, layersRef.current.hl)
        }
      )

      setupInteraction(canvas, app)

      // Cleanup subscriptions on destroy
      app._worldUnsubs = [unsubWorld, unsubFog, unsubPos, unsubSel]
    })

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (!appRef.current) return
      const w = canvas.parentElement?.clientWidth || 800
      const h = canvas.parentElement?.clientHeight || 600
      sizeRef.current = { w, h }
      appRef.current.renderer.resize(w, h)
    })
    ro.observe(canvas.parentElement)

    return () => {
      destroyed = true
      ro.disconnect()
      if (appRef.current) {
        appRef.current._worldUnsubs?.forEach(u => u())
        appRef.current.destroy(true)
        appRef.current = null
      }
    }
  }, [])

  // ── Draw terrain (static, only on world change) ──────────────────────
  function drawTerrain(world, g) {
    g.clear()
    for (const tile of world.tiles) {
      const { x, y } = hexToPixel(tile.col, tile.row)
      const color     = TERRAIN[tile.terrain]?.color ?? 0x111111
      const pts       = hexPoints(x, y)
      g.poly(pts).fill({ color })
      g.poly(pts).stroke({ color: 0x000000, width: 0.5, alpha: 0.4 })
    }
  }

  // ── Draw location icons ───────────────────────────────────────────────
  function drawLocIcons(world, cont) {
    cont.removeChildren()
    const style = new TextStyle({ fontSize: 14, fill: 0xffffff })
    for (const tile of world.tiles) {
      if (!tile.location && !tile.hasSanctuary) continue
      const { x, y } = hexToPixel(tile.col, tile.row)
      const emoji = tile.hasSanctuary ? '⌂' : (LOC_TYPE[tile.location.type]?.emoji ?? '?')
      const t = new Text({ text: emoji, style })
      t.anchor.set(0.5)
      t.position.set(x, y)
      t.alpha = 0  // start hidden; fog layer reveals
      t._tileKey = tileKey(tile.col, tile.row)
      cont.addChild(t)
    }
  }

  // ── Fog of war overlay ────────────────────────────────────────────────
  function redrawFog(world, g) {
    g.clear()
    const locs = layersRef.current?.locs
    // Reset all loc icon visibility
    if (locs) locs.children.forEach(c => { c.alpha = 0 })

    for (const tile of world.tiles) {
      const { x, y } = hexToPixel(tile.col, tile.row)
      const pts = hexPoints(x, y)
      if (tile.fog === 'hidden') {
        g.poly(pts).fill({ color: 0x000000, alpha: 1 })
      } else if (tile.fog === 'explored') {
        // Dim terrain: draw the dim color at partial alpha
        const dimColor = TERRAIN[tile.terrain]?.dimColor ?? 0x080808
        g.poly(pts).fill({ color: dimColor, alpha: 0.65 })
        // Show loc icons dimly
        if (locs) {
          const icon = locs.children.find(c => c._tileKey === tileKey(tile.col, tile.row))
          if (icon) icon.alpha = 0.35
        }
      } else {
        // visible — show loc icons fully
        if (locs) {
          const icon = locs.children.find(c => c._tileKey === tileKey(tile.col, tile.row))
          if (icon) icon.alpha = 1
        }
      }
    }
  }

  // ── Unit positions ────────────────────────────────────────────────────
  function drawUnits(world, cont) {
    cont.removeChildren()
    const { worldPos, sanctuaryPos } = useGameStore.getState()
    if (!worldPos) return
    const style = new TextStyle({ fontSize: 16, fill: 0xffffff })
    const v = new Text({ text: '🧙', style })
    const { x, y } = hexToPixel(worldPos.col, worldPos.row)
    v.anchor.set(0.5)
    v.position.set(x, y - 4)
    cont.addChild(v)
  }

  // ── Highlight selected hex ────────────────────────────────────────────
  function redrawHighlight(sel, g) {
    g.clear()
    if (!sel) return
    const { x, y } = hexToPixel(sel.col, sel.row)
    const pts = hexPoints(x, y)
    g.poly(pts).stroke({ color: 0xc4a882, width: 2, alpha: 0.9 })
    g.poly(pts).fill({ color: 0xc4a882, alpha: 0.15 })
  }

  // ── Center camera on (col,row) ────────────────────────────────────────
  function centerOn(col, row, app, world) {
    const cam = cameraRef.current
    const size = sizeRef.current
    const { x, y } = hexToPixel(col, row)
    cam.x = size.w / 2 - x * cam.zoom
    cam.y = size.h / 2 - y * cam.zoom
    applyCamera()
  }

  function applyCamera() {
    const l = layersRef.current
    if (!l) return
    const { x, y, zoom } = cameraRef.current
    l.worldCont.position.set(x, y)
    l.worldCont.scale.set(zoom)
  }

  // ── Camera interaction ────────────────────────────────────────────────
  function setupInteraction(canvas, app) {
    const cam = cameraRef.current

    canvas.addEventListener('pointerdown', e => {
      cam.drag = true; cam.lx = e.clientX; cam.ly = e.clientY
    })
    canvas.addEventListener('pointermove', e => {
      if (!cam.drag) {
        // Hover highlight
        const { world } = useGameStore.getState()
        if (!world) return
        const wx = (e.offsetX - cam.x) / cam.zoom
        const wy = (e.offsetY - cam.y) / cam.zoom
        const hit = nearestHex(wx, wy, world)
        if (hit) useGameStore.getState().selectHex(hit.col, hit.row)
        return
      }
      cam.x += e.clientX - cam.lx
      cam.y += e.clientY - cam.ly
      cam.lx = e.clientX; cam.ly = e.clientY
      applyCamera()
    })
    canvas.addEventListener('pointerup', e => {
      if (!cam.drag) return
      const dx = Math.abs(e.clientX - cam.lx), dy = Math.abs(e.clientY - cam.ly)
      cam.drag = false
      // Only fire click if not a drag
      if (dx < 4 && dy < 4) handleClick(e.offsetX, e.offsetY)
    })
    canvas.addEventListener('pointerleave', () => { cam.drag = false })
    canvas.addEventListener('wheel', e => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      const newZoom = Math.max(0.3, Math.min(2.5, cam.zoom * factor))
      // Zoom toward mouse position
      const mx = e.offsetX, my = e.offsetY
      cam.x = mx - (mx - cam.x) * (newZoom / cam.zoom)
      cam.y = my - (my - cam.y) * (newZoom / cam.zoom)
      cam.zoom = newZoom
      applyCamera()
    }, { passive: false })
  }

  function handleClick(ox, oy) {
    const cam = cameraRef.current
    const { world, worldPos, sanctuaryPos } = useGameStore.getState()
    if (!world) return
    const wx = (ox - cam.x) / cam.zoom
    const wy = (oy - cam.y) / cam.zoom
    const hit = nearestHex(wx, wy, world)
    if (!hit) return
    const tile = world.tiles[hit.row * world.width + hit.col]
    if (!tile || tile.fog === 'hidden') return

    if (!sanctuaryPos) {
      // Sanctuary placement phase
      if (TERRAIN[tile.terrain]?.passable) {
        useGameStore.getState().placeSanctuary(hit.col, hit.row)
        useGameStore.getState().moveOnWorld(hit.col, hit.row)
      }
      return
    }
    // Normal movement/selection
    useGameStore.getState().selectHex(hit.col, hit.row)
    // If clicking current sanctuary: go to sanctuary screen
    if (sanctuaryPos && hit.col === sanctuaryPos.col && hit.row === sanctuaryPos.row) {
      useGameStore.getState().setScreen('sanctuary')
      return
    }
    // Move or launch mission
    if (TERRAIN[tile.terrain]?.passable && tile.fog !== 'hidden') {
      if (tile.location) {
        // Show in WorldUI — WorldScreen handles the panel
      } else {
        useGameStore.getState().moveOnWorld(hit.col, hit.row)
      }
    }
  }

  // Nearest hex to pixel coords (brute-force, fast enough for click events)
  function nearestHex(px, py, world) {
    let best = null, bestD = Infinity
    const maxDist = 40 * 40  // within ~40px radius
    for (const tile of world.tiles) {
      const { x, y } = hexToPixel(tile.col, tile.row)
      const d = (px - x) ** 2 + (py - y) ** 2
      if (d < bestD && d < maxDist) { bestD = d; best = tile }
    }
    return best
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
    />
  )
}
