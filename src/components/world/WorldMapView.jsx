import { useEffect, useRef } from 'react'
import { Application, Graphics, Container, Text, TextStyle } from 'pixi.js'
import { useGameStore } from '../../store/gameStore'
import { hexToPixel, hexPoints, tileKey, hexNeighbors, hexDist } from '../../world/hexMath'
import { TERRAIN, LOC_TYPE } from '../../world/tileTypes'
import { isPlayableWorld } from '../../world/worldState'
import { item } from '../../data/items'

export default function WorldMapView() {
  const containerRef = useRef(null)
  const appRef       = useRef(null)
  const layersRef    = useRef(null)
  const initZoom     = window.innerWidth >= 1200 ? 1.1 : window.innerWidth >= 768 ? 0.85 : 0.6
  const cameraRef    = useRef({ x: 0, y: 0, zoom: initZoom, drag: false, lx: 0, ly: 0 })
  const sizeRef      = useRef({ w: window.innerWidth || 800, h: window.innerHeight || 600 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let destroyed = false

    const w = container.clientWidth  || window.innerWidth  || 800
    const h = container.clientHeight || window.innerHeight || 600
    sizeRef.current = { w, h }

    const app = new Application()
    app.init({
      backgroundColor: 0x020408,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      width: w,
      height: h,
    }).then(() => {
      if (destroyed) { app.destroy(true); return }
      appRef.current = app

      // Let Pixi own its canvas; position it to fill the container
      const cv = app.canvas
      cv.style.position   = 'absolute'
      cv.style.top        = '0'
      cv.style.left       = '0'
      cv.style.touchAction = 'none'
      container.appendChild(cv)

      const worldCont = new Container()
      const terrain   = new Graphics()
      const fog       = new Graphics()
      const locs      = new Container()
      const units     = new Container()
      const hl        = new Graphics()

      worldCont.addChild(terrain)
      worldCont.addChild(locs)
      worldCont.addChild(fog)
      worldCont.addChild(units)
      worldCont.addChild(hl)
      app.stage.addChild(worldCont)
      layersRef.current = { worldCont, terrain, fog, locs, units, hl }

      const { world, worldPos, selectedHex, worldPath } = useGameStore.getState()
      if (isPlayableWorld(world, worldPos)) {
        drawTerrain(world, terrain)
        drawLocIcons(world, locs)
        redrawFog(world, fog)
        drawUnits(world, units)
        if (worldPos) centerOn(worldPos.col, worldPos.row)
        redrawHighlight(selectedHex, worldPath, worldPos, world, hl)
      }

      const unsubWorld = useGameStore.subscribe(
        s => s.world,
        (world) => {
          const { worldPos } = useGameStore.getState()
          if (!isPlayableWorld(world, worldPos) || !layersRef.current) return
          const { terrain, fog, locs } = layersRef.current
          drawTerrain(world, terrain)
          drawLocIcons(world, locs)
          redrawFog(world, fog)
        }
      )
      const unsubFog = useGameStore.subscribe(
        s => s.world?.tiles,
        () => {
          const { world } = useGameStore.getState()
          if (!isPlayableWorld(world, useGameStore.getState().worldPos) || !layersRef.current) return
          redrawFog(world, layersRef.current.fog)
          drawUnits(world, layersRef.current.units)
        }
      )
      const unsubPos = useGameStore.subscribe(
        s => s.worldPos,
        (pos) => {
          const { world } = useGameStore.getState()
          if (!isPlayableWorld(world, pos) || !layersRef.current) return
          drawUnits(world, layersRef.current.units)
          centerOn(pos.col, pos.row)
        }
      )
      const unsubResources = useGameStore.subscribe(
        s => s.locationResources,
        () => {
          const { world } = useGameStore.getState()
          if (!isPlayableWorld(world, useGameStore.getState().worldPos) || !layersRef.current) return
          drawLocIcons(world, layersRef.current.locs)
          redrawFog(world, layersRef.current.fog)
        }
      )
      const unsubSel = useGameStore.subscribe(
        s => [s.selectedHex, s.worldPath, s.worldPos, s.world],
        ([sel, path, pos, world]) => {
          if (!layersRef.current) return
          redrawHighlight(sel, path, pos, world, layersRef.current.hl)
        },
        { equalityFn: (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] }
      )

      setupInteraction(cv)
      app._worldUnsubs = [unsubWorld, unsubFog, unsubPos, unsubResources, unsubSel]
    }).catch(err => {
      console.error('[world-map] Pixi initialization failed:', err)
    })

    const ro = new ResizeObserver(() => {
      const nw = container.clientWidth  || window.innerWidth  || 800
      const nh = container.clientHeight || window.innerHeight || 600
      sizeRef.current = { w: nw, h: nh }
      if (appRef.current) appRef.current.renderer.resize(nw, nh)
    })
    ro.observe(container)

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

  // ── Draw terrain ──────────────────────────────────────────────────────
  function drawTerrain(world, g) {
    g.clear()
    if (!Array.isArray(world?.tiles)) return
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
    if (!Array.isArray(world?.tiles)) return
    const style = new TextStyle({ fontSize: 14, fill: 0xffffff })
    for (const tile of world.tiles) {
      if (!tile.location && !tile.hasSanctuary && !tile.forageDepletedUntil) continue
      const { x, y } = hexToPixel(tile.col, tile.row)

      let child
      if (tile.hasSanctuary) {
        const g = new Graphics()
        g.poly([x, y - 11, x - 8, y - 3, x + 8, y - 3]).fill({ color: 0xdd8833, alpha: 1 })
        g.rect(x - 6, y - 3, 12, 10).fill({ color: 0xaa5511, alpha: 1 })
        g.rect(x - 2, y + 1, 4, 6).fill({ color: 0x220e00, alpha: 1 })
        child = g
      } else if (!tile.location && tile.forageDepletedUntil) {
        const t = new Text({ text: '🧺', style: new TextStyle({ fontSize: 10, fill: 0x8a6a3a }) })
        t.anchor.set(0.5)
        t.position.set(x, y)
        child = t
      } else {
        const group = new Container()
        const t = new Text({ text: LOC_TYPE[tile.location.type]?.emoji ?? '?', style })
        t.anchor.set(0.5)
        t.position.set(x, y)
        group.addChild(t)
        const locId = `${tile.location.type}_${tile.col}_${tile.row}`
        const primary = useGameStore.getState().locationResources?.[locId]
        if (primary) {
          const r = new Text({ text: item(primary)?.emoji ?? '◇', style: new TextStyle({ fontSize: 9, fill: 0xc4a882 }) })
          r.anchor.set(0.5)
          r.position.set(x + 9, y + 9)
          group.addChild(r)
        }
        child = group
      }

      child.alpha = 0
      child._tileKey = tileKey(tile.col, tile.row)
      cont.addChild(child)
    }
  }

  // ── Fog of war ────────────────────────────────────────────────────────
  function redrawFog(world, g) {
    g.clear()
    if (!Array.isArray(world?.tiles)) return
    const locs = layersRef.current?.locs
    if (locs) locs.children.forEach(c => { c.alpha = 0 })

    for (const tile of world.tiles) {
      const { x, y } = hexToPixel(tile.col, tile.row)
      const pts = hexPoints(x, y)
      if (tile.fog === 'hidden') {
        g.poly(pts).fill({ color: 0x000000, alpha: 1 })
      } else if (tile.fog === 'explored') {
        const dimColor = TERRAIN[tile.terrain]?.dimColor ?? 0x080808
        g.poly(pts).fill({ color: dimColor, alpha: 0.65 })
        if (locs) {
          const icon = locs.children.find(c => c._tileKey === tileKey(tile.col, tile.row))
          if (icon) icon.alpha = 0.35
        }
      } else {
        if (locs) {
          const icon = locs.children.find(c => c._tileKey === tileKey(tile.col, tile.row))
          if (icon) icon.alpha = 1
        }
      }
    }
  }

  // ── Varek unit ────────────────────────────────────────────────────────
  function drawUnits(world, cont) {
    cont.removeChildren()
    const { worldPos } = useGameStore.getState()
    if (!isPlayableWorld(world, worldPos)) return
    const { x, y } = hexToPixel(worldPos.col, worldPos.row)
    const g = new Graphics()
    g.circle(x, y - 3, 7).fill({ color: 0xffffff, alpha: 0.95 })
    g.circle(x, y - 3, 7).stroke({ color: 0xff8800, width: 2.5, alpha: 1 })
    g.circle(x, y - 3, 3).fill({ color: 0xff8800, alpha: 0.9 })
    cont.addChild(g)
  }

  // ── Highlight ─────────────────────────────────────────────────────────
  function redrawHighlight(sel, _path, varekPos, world, g) {
    g.clear()
    if (isPlayableWorld(world, varekPos)) {
      const { x: vx, y: vy } = hexToPixel(varekPos.col, varekPos.row)
      g.poly(hexPoints(vx, vy)).fill({ color: 0xff8800, alpha: 0.28 })
      g.poly(hexPoints(vx, vy)).stroke({ color: 0xff8800, width: 2.5, alpha: 0.95 })

      for (const n of hexNeighbors(varekPos.col, varekPos.row, world.width, world.height)) {
        const nt = world.tiles[n.row * world.width + n.col]
        if (!nt || nt.fog === 'hidden' || !TERRAIN[nt.terrain]?.passable) continue
        const { x: nx, y: ny } = hexToPixel(n.col, n.row)
        g.poly(hexPoints(nx, ny)).fill({ color: 0x1a4a1a, alpha: 0.18 })
        g.poly(hexPoints(nx, ny)).stroke({ color: 0x4a9a4a, width: 2, alpha: 0.8 })
      }
    }
    if (!sel) return
    const { x, y } = hexToPixel(sel.col, sel.row)
    const pts = hexPoints(x, y)
    g.poly(pts).stroke({ color: 0xc4a882, width: 2, alpha: 0.9 })
    g.poly(pts).fill({ color: 0xc4a882, alpha: 0.15 })
  }

  // ── Camera ────────────────────────────────────────────────────────────
  function centerOn(col, row) {
    const cam  = cameraRef.current
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

  // ── Input ─────────────────────────────────────────────────────────────
  function setupInteraction(cv) {
    const cam = cameraRef.current
    let startX = 0, startY = 0

    cv.addEventListener('pointerdown', e => {
      cam.drag = true
      startX = e.clientX; startY = e.clientY
      cam.lx = e.clientX; cam.ly = e.clientY
    })
    cv.addEventListener('pointermove', e => {
      if (!cam.drag) return
      cam.x += e.clientX - cam.lx
      cam.y += e.clientY - cam.ly
      cam.lx = e.clientX; cam.ly = e.clientY
      applyCamera()
    })
    cv.addEventListener('pointerup', e => {
      if (!cam.drag) return
      cam.drag = false
      const dx = Math.abs(e.clientX - startX), dy = Math.abs(e.clientY - startY)
      if (dx < 8 && dy < 8) handleClick(e.offsetX, e.offsetY)
    })
    cv.addEventListener('pointerleave', () => { cam.drag = false })
    cv.addEventListener('wheel', e => {
      e.preventDefault()
      const factor   = e.deltaY < 0 ? 1.12 : 0.9
      const newZoom  = Math.max(0.25, Math.min(3.0, cam.zoom * factor))
      const mx = e.offsetX, my = e.offsetY
      cam.x = mx - (mx - cam.x) * (newZoom / cam.zoom)
      cam.y = my - (my - cam.y) * (newZoom / cam.zoom)
      cam.zoom = newZoom
      applyCamera()
    }, { passive: false })

    // Pinch-to-zoom for touch
    let lastPinchDist = 0
    cv.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        lastPinchDist = Math.hypot(dx, dy)
      }
    }, { passive: true })
    cv.addEventListener('touchmove', e => {
      if (e.touches.length !== 2) return
      e.preventDefault()
      const dx   = e.touches[0].clientX - e.touches[1].clientX
      const dy   = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      if (lastPinchDist === 0) { lastPinchDist = dist; return }
      const factor  = dist / lastPinchDist
      const newZoom = Math.max(0.25, Math.min(3.0, cam.zoom * factor))
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const rect = cv.getBoundingClientRect()
      const ox = mx - rect.left, oy = my - rect.top
      cam.x = ox - (ox - cam.x) * (newZoom / cam.zoom)
      cam.y = oy - (oy - cam.y) * (newZoom / cam.zoom)
      cam.zoom = newZoom
      lastPinchDist = dist
      applyCamera()
    }, { passive: false })
    cv.addEventListener('touchend', () => { lastPinchDist = 0 }, { passive: true })
  }

  function handleClick(ox, oy) {
    const cam   = cameraRef.current
    const store = useGameStore.getState()
    const { world, sanctuaryPos, pendingSanctuaryTile, worldPos } = store
    if (!isPlayableWorld(world, worldPos)) return

    if (pendingSanctuaryTile) { store.cancelSanctuaryPlacement(); return }

    const wx  = (ox - cam.x) / cam.zoom
    const wy  = (oy - cam.y) / cam.zoom
    const hit = nearestHex(wx, wy, world)
    if (!hit) return
    const tile = world.tiles[hit.row * world.width + hit.col]
    if (!tile || tile.fog === 'hidden') return

    if (!sanctuaryPos) {
      if (TERRAIN[tile.terrain]?.passable)
        store.requestSanctuaryPlacement(hit.col, hit.row)
      return
    }

    store.selectHex(hit.col, hit.row)

    if (worldPos && hexDist(worldPos, hit) === 1 && TERRAIN[tile.terrain]?.passable) {
      store.travelTo(hit.col, hit.row)
    }
  }

  function nearestHex(px, py, world) {
    let best = null, bestD = Infinity
    const maxDist = 40 * 40
    for (const tile of world.tiles) {
      const { x, y } = hexToPixel(tile.col, tile.row)
      const d = (px - x) ** 2 + (py - y) ** 2
      if (d < bestD && d < maxDist) { bestD = d; best = tile }
    }
    return best
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
    />
  )
}
