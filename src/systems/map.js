import { TILE, W, H } from '../data/constants';

export const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function walkable(tiles, x, y, units) {
  if (x < 0 || x >= W || y < 0 || y >= H) return false;
  if (tiles[y][x].type === TILE.WALL) return false;
  if (units.find(u => u.x === x && u.y === y && !u.fallen)) return false;
  return true;
}

export function moveRange(unit, tiles, units) {
  const r = new Set();
  const q = [{ x:unit.x, y:unit.y, s:0 }];
  const v = new Set([`${unit.x},${unit.y}`]);
  while (q.length) {
    const { x, y, s } = q.shift();
    if (s > 0) r.add(`${x},${y}`);
    if (s >= unit.moveRange) continue;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x+dx, ny = y+dy, k = `${nx},${ny}`;
      if (!v.has(k) && walkable(tiles, nx, ny, units)) {
        v.add(k);
        q.push({ x:nx, y:ny, s:s+1 });
      }
    }
  }
  return r;
}

export function hasLOS(tiles, ax, ay, bx, by) {
  let x = ax, y = ay;
  const dx = Math.abs(bx-ax), dy = Math.abs(by-ay);
  const sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
  let err = dx - dy;
  while (true) {
    if (x === bx && y === by) return true;
    if (tiles[y]?.[x]?.type === TILE.WALL) return false;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx)  { err += dx; y += sy; }
  }
}

export function fog(units, noise, tiles) {
  const noiseMod = noise < 30 ? -1 : noise < 60 ? 0 : 1;
  const range = 4 + noiseMod;
  const v = new Set();
  for (const u of units.filter(u => u.type !== 'enemy' && !u.fallen)) {
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > range) continue;
        const tx = u.x+dx, ty = u.y+dy;
        if (tx < 0 || tx >= W || ty < 0 || ty >= H) continue;
        if (hasLOS(tiles, u.x, u.y, tx, ty)) v.add(`${tx},${ty}`);
      }
    }
  }
  return v;
}

export function revealTraps(tiles, units) {
  const t = tiles.map(r => r.map(c => ({ ...c })));
  const friendly = units.filter(u => u.type !== 'enemy' && !u.fallen);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (t[y][x].type !== TILE.TRAP) continue;
      for (const u of friendly) {
        if (dist(u, { x, y }) <= (u.trapReveal || 1)) {
          t[y][x] = { type:TILE.TRAP, revealed:true };
          break;
        }
      }
    }
  }
  return t;
}

// Dungeon map: carved rooms connected by corridors, rich with loot and traps
export function genDungeonMap(danger) {
  const t = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => ({ type: TILE.WALL }))
  );

  // Carve rooms
  const rooms = [];
  for (let attempt = 0; attempt < 30 && rooms.length < 4 + danger; attempt++) {
    const rw = 3 + Math.floor(Math.random() * 3);
    const rh = 2 + Math.floor(Math.random() * 3);
    const rx = 1 + Math.floor(Math.random() * (W - rw - 2));
    const ry = 1 + Math.floor(Math.random() * (H - rh - 2));
    const overlaps = rooms.some(r =>
      rx < r.rx + r.rw + 1 && rx + rw + 1 > r.rx &&
      ry < r.ry + r.rh + 1 && ry + rh + 1 > r.ry
    );
    if (overlaps) continue;
    for (let y = ry; y < ry + rh; y++)
      for (let x = rx; x < rx + rw; x++)
        t[y][x] = { type: TILE.FLOOR };
    rooms.push({ cx: rx + Math.floor(rw / 2), cy: ry + Math.floor(rh / 2), rx, ry, rw, rh });
  }

  // Fall back to generic map if room carving failed completely
  if (rooms.length === 0) return genMap(danger);

  // Connect rooms with L-shaped corridors
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1], b = rooms[i];
    let x = a.cx, y = a.cy;
    while (x !== b.cx) { if (x >= 0 && x < W && y >= 0 && y < H) t[y][x] = { type: TILE.FLOOR }; x += x < b.cx ? 1 : -1; }
    while (y !== b.cy) { if (x >= 0 && x < W && y >= 0 && y < H) t[y][x] = { type: TILE.FLOOR }; y += y < b.cy ? 1 : -1; }
    if (x >= 0 && x < W && y >= 0 && y < H) t[y][x] = { type: TILE.FLOOR };
  }

  // Ensure spawn and exit areas are open
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const sx = 1 + dx, sy = H - 2 + dy;
    if (sx > 0 && sx < W - 1 && sy > 0 && sy < H - 1) t[sy][sx] = { type: TILE.FLOOR };
    const ex = W - 2 + dx, ey = 1 + dy;
    if (ex > 0 && ex < W - 1 && ey > 0 && ey < H - 1) t[ey][ex] = { type: TILE.FLOOR };
  }

  // Connect spawn (1, H-2) and exit (W-2, 1) to nearest rooms
  const connect = (fx, fy, room) => {
    let x = fx, y = fy;
    while (x !== room.cx) { if (x >= 0 && x < W && y >= 0 && y < H) t[y][x] = { type: TILE.FLOOR }; x += x < room.cx ? 1 : -1; }
    while (y !== room.cy) { if (x >= 0 && x < W && y >= 0 && y < H) t[y][x] = { type: TILE.FLOOR }; y += y < room.cy ? 1 : -1; }
  };
  const nearest = (fx, fy) => rooms.reduce((best, r) =>
    Math.abs(r.cx - fx) + Math.abs(r.cy - fy) < Math.abs(best.cx - fx) + Math.abs(best.cy - fy) ? r : best
  );
  connect(1, H - 2, nearest(1, H - 2));
  connect(W - 2, 1, nearest(W - 2, 1));

  // Place lots of loot — dungeons are worth the risk
  for (let i = 0; i < 10 + danger * 3; i++) {
    for (let a = 0; a < 50; a++) {
      const x = 1 + Math.floor(Math.random() * (W - 2));
      const y = 1 + Math.floor(Math.random() * (H - 2));
      if (t[y][x].type === TILE.FLOOR) { t[y][x] = { type: TILE.LOOT }; break; }
    }
  }

  // Lots of traps
  for (let i = 0; i < 3 + danger * 2; i++) {
    for (let a = 0; a < 50; a++) {
      const x = 1 + Math.floor(Math.random() * (W - 2));
      const y = 1 + Math.floor(Math.random() * (H - 2));
      if (t[y][x].type === TILE.FLOOR) { t[y][x] = { type: TILE.TRAP }; break; }
    }
  }

  t[1][W - 2] = { type: TILE.EXIT };
  return t;
}

export function genMap(danger) {
  const t = [];
  for (let y = 0; y < H; y++) {
    t[y] = [];
    for (let x = 0; x < W; x++) {
      if (x === 0 || x === W-1 || y === 0 || y === H-1) {
        t[y][x] = { type:TILE.WALL };
        continue;
      }
      const r = Math.random();
      t[y][x] = { type: r < .12 ? TILE.WALL : r < .18 ? TILE.RUBBLE : TILE.FLOOR };
    }
  }
  // Place loot
  for (let i = 0; i < 6+danger; i++) {
    for (let a = 0; a < 50; a++) {
      const x = 1+Math.floor(Math.random()*(W-2));
      const y = 1+Math.floor(Math.random()*(H-2));
      if (t[y][x].type === TILE.FLOOR) { t[y][x] = { type:TILE.LOOT }; break; }
    }
  }
  // Place traps
  for (let i = 0; i < 1+danger; i++) {
    for (let a = 0; a < 50; a++) {
      const x = 1+Math.floor(Math.random()*(W-2));
      const y = 1+Math.floor(Math.random()*(H-2));
      if (t[y][x].type === TILE.FLOOR) { t[y][x] = { type:TILE.TRAP }; break; }
    }
  }
  // Guarantee exit and spawn are accessible (3×3 clear zones)
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const ex = W-2+dx, ey = 1+dy;
      if (ex > 0 && ex < W-1 && ey > 0 && ey < H-1) t[ey][ex] = { type:TILE.FLOOR };
      const sx = 1+dx, sy = H-2+dy;
      if (sx > 0 && sx < W-1 && sy > 0 && sy < H-1) t[sy][sx] = { type:TILE.FLOOR };
    }
  }
  t[1][W-2] = { type:TILE.EXIT };
  return t;
}
