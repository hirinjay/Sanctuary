// Flat-top hexes, even-q offset storage, axial math.
// Storage coords: (col, row) — rectangular grid, even columns unshifted.
// Axial coords: (q, r)     — used for distance and neighbor math.

export const HEX_SIZE = 32  // circumradius (center to vertex)
export const HEX_W    = HEX_SIZE * 2                    // tip-to-tip width
export const HEX_H    = HEX_SIZE * Math.sqrt(3)        // flat-to-flat height
export const COL_STEP = HEX_SIZE * 1.5                 // horizontal center-to-center
export const ROW_STEP = HEX_H                           // vertical center-to-center

// Offset (col,row) → pixel center
export function hexToPixel(col, row) {
  const x = col * COL_STEP + HEX_SIZE
  const y = row * ROW_STEP + (col & 1 ? ROW_STEP * 0.5 : 0) + HEX_SIZE
  return { x, y }
}

// Pixel → nearest (col,row) — for mouse picking
export function pixelToHex(px, py, width, height) {
  // Brute-force nearest for correctness; fast enough for click events
  let best = null, bestD = Infinity
  for (let c = 0; c < width; c++) {
    for (let r = 0; r < height; r++) {
      const { x, y } = hexToPixel(c, r)
      const d = (px - x) ** 2 + (py - y) ** 2
      if (d < bestD) { bestD = d; best = { col: c, row: r } }
    }
  }
  return best
}

// 6 vertices of a flat-top hex (for drawing)
export function hexPoints(cx, cy) {
  const pts = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i
    pts.push(cx + HEX_SIZE * Math.cos(a), cy + HEX_SIZE * Math.sin(a))
  }
  return pts
}

// Offset → axial
export function offsetToAxial(col, row) {
  const q = col
  const r = row - Math.floor(col / 2)
  return { q, r }
}

// Axial → offset
export function axialToOffset(q, r) {
  const col = q
  const row = r + Math.floor(q / 2)
  return { col, row }
}

// Axial distance
export function hexDist(a, b) {
  const aq = a.col !== undefined ? a.col : a.q
  const ar = a.col !== undefined ? a.row - Math.floor(a.col / 2) : a.r
  const bq = b.col !== undefined ? b.col : b.q
  const br = b.col !== undefined ? b.row - Math.floor(b.col / 2) : b.r
  return (Math.abs(aq-bq) + Math.abs(aq+ar-bq-br) + Math.abs(ar-br)) / 2
}

// All tiles within axial distance `range` of (col,row), filtered to [0,W)×[0,H)
export function hexesInRange(col, row, range, mapWidth, mapHeight) {
  const { q: cq, r: cr } = offsetToAxial(col, row)
  const result = []
  for (let dq = -range; dq <= range; dq++) {
    for (let dr = Math.max(-range, -dq-range); dr <= Math.min(range, -dq+range); dr++) {
      const nq = cq + dq, nr = cr + dr
      const { col: nc, row: nr2 } = axialToOffset(nq, nr)
      if (nc >= 0 && nc < mapWidth && nr2 >= 0 && nr2 < mapHeight) {
        result.push({ col: nc, row: nr2 })
      }
    }
  }
  return result
}

// Immediate neighbors (distance 1)
export function hexNeighbors(col, row, mapWidth, mapHeight) {
  return hexesInRange(col, row, 1, mapWidth, mapHeight).filter(
    h => !(h.col === col && h.row === row)
  )
}

export const tileKey = (col, row) => `${col},${row}`

// BFS path between two hex tiles through passable, non-hidden tiles.
// Returns array of { col, row } steps (not including start), or null if no path.
export function bfsPath(tiles, from, to, passableFn, mapWidth, mapHeight) {
  const key = (c, r) => `${c},${r}`
  const queue = [{ col:from.col, row:from.row, path:[] }]
  const visited = new Set([key(from.col, from.row)])

  while (queue.length) {
    const { col, row, path } = queue.shift()
    if (col === to.col && row === to.row) return path

    for (const n of hexNeighbors(col, row, mapWidth, mapHeight)) {
      const k = key(n.col, n.row)
      if (visited.has(k)) continue
      const tile = tiles[n.row * mapWidth + n.col]
      if (!tile || !passableFn(tile)) continue
      visited.add(k)
      queue.push({ col:n.col, row:n.row, path:[...path, { col:n.col, row:n.row }] })
    }
  }
  return null
}
