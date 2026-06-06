import { hexNeighbors, tileKey } from './hexMath'
import { TERRAIN, LOC_TYPE } from './tileTypes'

export const WORLD_W = 48
export const WORLD_H = 32

// Seeded PRNG (mulberry32)
function mkRng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Simple value-noise: interpolate random values at coarse grid points
function makeNoise(rng, cols, rows, scale) {
  const cw = Math.ceil(cols / scale) + 2
  const ch = Math.ceil(rows / scale) + 2
  const grid = Array.from({ length: cw * ch }, () => rng())
  const g = (cx, cy) => grid[Math.max(0, Math.min(cy, ch - 1)) * cw + Math.max(0, Math.min(cx, cw - 1))]
  const lerp = (a, b, t) => a + (b - a) * t
  return (col, row) => {
    const fx = col / scale, fy = row / scale
    const x0 = Math.floor(fx), y0 = Math.floor(fy)
    const tx = fx - x0, ty = fy - y0
    return lerp(lerp(g(x0, y0), g(x0 + 1, y0), tx), lerp(g(x0, y0 + 1), g(x0 + 1, y0 + 1), tx), ty)
  }
}

function terrainFromNoise(n1, n2, edgeDist) {
  // Water at edges
  if (edgeDist < 1.5) return 'water'
  // Mountain from first noise layer (high values)
  if (n1 > 0.72) return 'mountain'
  // Forest from second noise layer
  if (n2 > 0.62) return 'forest'
  // Swamp in low-noise areas near edges
  if (n1 < 0.28 && edgeDist < 4) return 'swamp'
  // Ruins scattered at mid-values
  if (n1 > 0.54 && n1 < 0.62) return 'ruins'
  return 'plains'
}

// Majority smoothing — reduce noise-speckle
function smooth(tiles, W, H) {
  const next = tiles.map(t => ({ ...t }))
  for (let row = 0; row < H; row++) {
    for (let col = 0; col < W; col++) {
      const nbrs = hexNeighbors(col, row, W, H)
      const counts = {}
      for (const n of nbrs) {
        const tt = tiles[n.row * W + n.col].terrain
        counts[tt] = (counts[tt] || 0) + 1
      }
      const majority = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
      if (majority && majority !== 'water') next[row * W + col].terrain = majority
    }
  }
  return next
}

function placeLocations(tiles, rng, W, H) {
  const passable = (col, row) => {
    const t = tiles[row * W + col]
    return t && TERRAIN[t.terrain]?.passable && !t.location
  }
  const cx = Math.floor(W / 2), cy = Math.floor(H / 2)
  const dist = (col, row) => Math.abs(col - cx) + Math.abs(row - cy)

  const place = (type, count, preferTerrain, minDist = 0) => {
    let placed = 0, attempts = 0
    while (placed < count && attempts < 500) {
      attempts++
      const col = 1 + Math.floor(rng() * (W - 2))
      const row = 1 + Math.floor(rng() * (H - 2))
      if (!passable(col, row)) continue
      if (dist(col, row) < minDist) continue
      const t = tiles[row * W + col]
      if (preferTerrain && t.terrain !== preferTerrain && rng() > 0.3) continue
      // No two locations too close together
      const tooClose = tiles.some(t2 => t2.location && Math.abs(t2.col - col) + Math.abs(t2.row - row) < 4)
      if (tooClose) continue
      const lt = LOC_TYPE[type]
      t.location = { type, name: lt.label, danger: lt.danger, lq: lt.lq }
      placed++
    }
  }

  place('dungeon',  5, 'ruins',  6)
  place('camp',     4, null,     5)
  place('village',  3, 'plains', 4)
  place('merchant', 2, 'plains', 3)
}

export function generateWorld(seed) {
  const rng  = mkRng(seed)
  const n1   = makeNoise(rng, WORLD_W, WORLD_H, 8)
  const n2   = makeNoise(rng, WORLD_W, WORLD_H, 5)

  let tiles = []
  for (let row = 0; row < WORLD_H; row++) {
    for (let col = 0; col < WORLD_W; col++) {
      const edgeDist = Math.min(col, row, WORLD_W - 1 - col, WORLD_H - 1 - row)
      const terrain  = terrainFromNoise(n1(col, row), n2(col, row), edgeDist)
      tiles.push({ col, row, terrain, location: null, fog: 'hidden' })
    }
  }

  // Two smoothing passes
  tiles = smooth(tiles, WORLD_W, WORLD_H)
  tiles = smooth(tiles, WORLD_W, WORLD_H)

  placeLocations(tiles, rng, WORLD_W, WORLD_H)

  return { seed, tiles, width: WORLD_W, height: WORLD_H }
}

// Reveal hexes in radius around (col,row); hexesInRange passed in to avoid circular import
export function revealAround(tiles, col, row, radius, hexesInRangeFn, W, H) {
  const next = tiles.map(t => ({ ...t }))
  // Everything currently visible → explored
  for (const t of next) if (t.fog === 'visible') t.fog = 'explored'
  // New visible ring
  for (const { col: nc, row: nr } of hexesInRangeFn(col, row, radius, W, H)) {
    next[nr * W + nc].fog = 'visible'
  }
  return next
}
