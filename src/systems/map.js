import { TILE, W as DEF_W, H as DEF_H } from '../data/constants';

export const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// BFS from spawn: returns Set of "x,y" keys reachable through non-wall tiles
export function reachableSet(tiles, spawnX, spawnY) {
  const H = tiles.length, W = tiles[0]?.length ?? 0;
  const IMPASSABLE = new Set([TILE.WALL]);
  const visited = new Set();
  const q = [{ x: spawnX, y: spawnY }];
  visited.add(`${spawnX},${spawnY}`);
  while (q.length) {
    const { x, y } = q.shift();
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x+dx, ny = y+dy, k = `${nx},${ny}`;
      if (!visited.has(k) && nx >= 0 && nx < W && ny >= 0 && ny < H) {
        const tile = tiles[ny][nx];
        if (!IMPASSABLE.has(tile?.type)) { visited.add(k); q.push({ x: nx, y: ny }); }
      }
    }
  }
  return visited;
}

// Strip special tiles (LOOT, TRAP, HOLY, etc.) that ended up unreachable from spawn
export function cullUnreachable(tiles, spawnX, spawnY) {
  const reach = reachableSet(tiles, spawnX, spawnY);
  const SPECIAL = new Set([TILE.LOOT, TILE.TRAP, TILE.HOLY, TILE.SHADOW, TILE.WATER, TILE.ELEVATED, TILE.FIRE, TILE.EXIT]);
  return tiles.map((row, y) => row.map((tile, x) => {
    if (reach.has(`${x},${y}`)) return tile;
    if (SPECIAL.has(tile?.type)) return { type: TILE.WALL };
    return tile;
  }));
}

// Find N valid floor positions near spawn for unit placement (BFS order)
export function findSpawnSlots(tiles, spawnX, spawnY, count) {
  const H = tiles.length, W = tiles[0]?.length ?? 0;
  const slots = [];
  const visited = new Set([`${spawnX},${spawnY}`]);
  const q = [{ x: spawnX, y: spawnY }];
  slots.push({ x: spawnX, y: spawnY });
  while (q.length && slots.length < count) {
    const { x, y } = q.shift();
    for (const [dx, dy] of [[1,0],[0,-1],[-1,0],[0,1]]) {
      const nx = x+dx, ny = y+dy, k = `${nx},${ny}`;
      if (!visited.has(k) && nx > 0 && nx < W-1 && ny > 0 && ny < H-1) {
        visited.add(k);
        const t = tiles[ny]?.[nx];
        if (t?.type === TILE.FLOOR) { slots.push({ x: nx, y: ny }); q.push({ x: nx, y: ny }); }
      }
    }
  }
  return slots;
}

export function walkable(tiles, x, y, units) {
  const H = tiles.length, W = tiles[0]?.length ?? 0;
  if (x < 0 || x >= W || y < 0 || y >= H) return false;
  const tile = tiles[y]?.[x];
  if (tile?.type === TILE.WALL) return false;
  if (tile?.type === TILE.CAGE) return false;
  if (tile?.type === TILE.DOOR && !tile?.open) return false;
  if (units.find(u => u.x === x && u.y === y && !u.fallen)) return false;
  return true;
}

export function moveRange(unit, tiles, units) {
  const r    = new Set();
  const best = new Map([[ `${unit.x},${unit.y}`, 0 ]]);
  const q    = [{ x:unit.x, y:unit.y, s:0 }];
  while (q.length) {
    q.sort((a,b) => a.s - b.s);
    const { x, y, s } = q.shift();
    if (s > 0) r.add(`${x},${y}`);
    if (s >= unit.moveRange) continue;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x+dx, ny = y+dy, k = `${nx},${ny}`;
      const tile = tiles[ny]?.[nx];
      if (!tile) continue;
      // Closed doors block movement — opening is a separate adjacent action, not a move target.
      if (tile.type === TILE.DOOR && !tile.open) continue;
      if (!walkable(tiles, nx, ny, units)) continue;
      const cost = tile.type === TILE.WATER ? 2 : 1;
      const ns   = s + cost;
      if (ns <= unit.moveRange && ns < (best.get(k) ?? Infinity)) {
        best.set(k, ns);
        q.push({ x:nx, y:ny, s:ns });
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
  const H = tiles.length, W = tiles[0]?.length ?? 0;
  const noiseMod = noise < 30 ? -1 : noise < 60 ? 0 : 1;
  const v = new Set();
  for (const u of units.filter(u => u.type !== 'enemy' && !u.fallen)) {
    const elevMod = tiles[u.y]?.[u.x]?.type === TILE.ELEVATED ? 1 : 0;
    const range = 4 + noiseMod + elevMod;
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
  const H = tiles.length, W = tiles[0]?.length ?? 0;
  const t = tiles.map(r => r.map(c => ({ ...c })));
  const friendly = units.filter(u => u.type !== 'enemy' && !u.fallen);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (t[y][x].type !== TILE.TRAP) continue;
      for (const u of friendly) {
        // Scout-lineage units (Grave Stalker dc) detect in a square radius,
        // catching corner/diagonal tiles at the edge of their range.
        const d = u.dc === 'Grave Stalker'
          ? Math.max(Math.abs(u.x - x), Math.abs(u.y - y))
          : dist(u, { x, y });
        if (d <= (u.trapReveal || 1)) {
          t[y][x] = { type:TILE.TRAP, revealed:true };
          break;
        }
      }
    }
  }
  return t;
}

// BFS full path from (fromX,fromY) to (toX,toY) — returns ordered step array (not including start)
export function bfsPath(tiles, fromX, fromY, toX, toY, units) {
  if (fromX === toX && fromY === toY) return [];
  const prev = new Map();
  const q = [{ x: fromX, y: fromY }];
  prev.set(`${fromX},${fromY}`, null);

  while (q.length) {
    const cur = q.shift();
    if (cur.x === toX && cur.y === toY) {
      const path = [];
      let node = cur;
      while (true) {
        const par = prev.get(`${node.x},${node.y}`);
        if (par === null) break;
        path.unshift(node);
        node = par;
      }
      return path;
    }
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      const k = `${nx},${ny}`;
      if (!prev.has(k)) {
        const canStep = (nx === toX && ny === toY) || walkable(tiles, nx, ny, units);
        if (canStep) { prev.set(k, cur); q.push({ x: nx, y: ny }); }
      }
    }
  }
  return [];
}

// BFS next-step pathfinding for alerted enemies — routes around walls
export function bfsStepToward(tiles, fromX, fromY, toX, toY, units) {
  if (fromX === toX && fromY === toY) return null;
  const prev = new Map();
  const q = [{ x: fromX, y: fromY }];
  prev.set(`${fromX},${fromY}`, null);

  while (q.length) {
    const cur = q.shift();
    if (cur.x === toX && cur.y === toY) {
      // Trace back to find first step after origin
      let node = cur;
      while (true) {
        const par = prev.get(`${node.x},${node.y}`);
        if (!par || (par.x === fromX && par.y === fromY)) break;
        node = par;
      }
      return { x: node.x, y: node.y };
    }
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      const k = `${nx},${ny}`;
      if (!prev.has(k)) {
        const canStep = (nx === toX && ny === toY) || walkable(tiles, nx, ny, units);
        if (canStep) {
          prev.set(k, cur);
          q.push({ x: nx, y: ny });
        }
      }
    }
  }
  return null;
}

// Cabin interior: one or two cozy rooms, lots of loot, minimal enemies
export function genCabinMap(_danger, mapW, mapH) {
  const W = mapW ?? DEF_W, H = mapH ?? DEF_H;
  const t = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => ({ type: TILE.WALL }))
  );

  // Main room — small and centered
  const rw = 7, rh = 5;
  const rx = Math.floor((W - rw) / 2);
  const ry = Math.floor((H - rh) / 2);
  for (let y = ry; y < ry + rh; y++)
    for (let x = rx; x < rx + rw; x++)
      t[y][x] = { type: TILE.FLOOR };

  // Optional back room (storage alcove)
  if (Math.random() > 0.4) {
    const bx = rx + 1, by = Math.max(1, ry - 2);
    for (let y = by; y < by + 2; y++)
      for (let x = bx; x < bx + 4; x++)
        if (x > 0 && x < W - 1 && y > 0 && y < H - 1) t[y][x] = { type: TILE.FLOOR };
    t[ry][bx + 1] = { type: TILE.FLOOR };
  }

  // Lots of loot — it's a cabin with stored goods
  for (let i = 0; i < 8; i++) {
    for (let a = 0; a < 40; a++) {
      const x = rx + Math.floor(Math.random() * rw);
      const y = ry + Math.floor(Math.random() * rh);
      if (t[y][x].type === TILE.FLOOR) { t[y][x] = { type: TILE.LOOT }; break; }
    }
  }

  // A couple traps (booby-trapped belongings)
  for (let i = 0; i < 2; i++) {
    for (let a = 0; a < 30; a++) {
      const x = rx + Math.floor(Math.random() * rw);
      const y = ry + Math.floor(Math.random() * rh);
      if (t[y][x].type === TILE.FLOOR) { t[y][x] = { type: TILE.TRAP }; break; }
    }
  }

  // Connect spawn (1, H-2) to room
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const sx = 1 + dx, sy = H - 2 + dy;
    if (sx > 0 && sx < W - 1 && sy > 0 && sy < H - 1) t[sy][sx] = { type: TILE.FLOOR };
  }
  const cx = rx + Math.floor(rw / 2), cy = ry + Math.floor(rh / 2);
  let x = 1, y = H - 2;
  while (x !== cx) { t[y][x] = { type: TILE.FLOOR }; x += x < cx ? 1 : -1; }
  while (y !== cy) { t[y][x] = { type: TILE.FLOOR }; y += y < cy ? 1 : -1; }

  // Connect exit (W-2, 1) to room
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const ex = W - 2 + dx, ey = 1 + dy;
    if (ex > 0 && ex < W - 1 && ey > 0 && ey < H - 1) t[ey][ex] = { type: TILE.FLOOR };
  }
  x = W - 2; y = 1;
  while (x !== cx) { t[y][x] = { type: TILE.FLOOR }; x += x < cx ? 1 : -1; }
  while (y !== cy) { t[y][x] = { type: TILE.FLOOR }; y += y < cy ? 1 : -1; }

  t[1][W - 2] = { type: TILE.EXIT };
  return t;
}

// Dungeon map: carved rooms connected by corridors, rich with loot and traps
export function genDungeonMap(danger, mapW, mapH) {
  const W = mapW ?? DEF_W, H = mapH ?? DEF_H;
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
  if (rooms.length === 0) return genMap(danger, W, H);

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

  // Holy ground — old shrines and sacred markings (0-2 per dungeon)
  for (let i = 0; i < Math.floor(Math.random() * 3); i++) {
    for (let a = 0; a < 40; a++) {
      const x = 1 + Math.floor(Math.random() * (W - 2));
      const y = 1 + Math.floor(Math.random() * (H - 2));
      if (t[y][x].type === TILE.FLOOR) { t[y][x] = { type: TILE.HOLY }; break; }
    }
  }

  // Shadow tiles — dark alcoves adjacent to walls
  for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
    for (let a = 0; a < 50; a++) {
      const x = 1 + Math.floor(Math.random() * (W - 2));
      const y = 1 + Math.floor(Math.random() * (H - 2));
      const adjWall = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => t[y+dy]?.[x+dx]?.type === TILE.WALL);
      if (t[y][x].type === TILE.FLOOR && adjWall) { t[y][x] = { type: TILE.SHADOW }; break; }
    }
  }
  // Doors at corridor chokepoints
  let doorsPlaced = 0;
  for (let cy = 2; cy < H - 2 && doorsPlaced < 3; cy++) {
    for (let cx = 2; cx < W - 2 && doorsPlaced < 3; cx++) {
      if (t[cy][cx].type !== TILE.FLOOR) continue;
      const hCorridor = t[cy][cx-1]?.type === TILE.WALL && t[cy][cx+1]?.type === TILE.WALL;
      const vCorridor = t[cy-1]?.[cx]?.type === TILE.WALL && t[cy+1]?.[cx]?.type === TILE.WALL;
      if ((hCorridor || vCorridor) && Math.random() < 0.35) {
        t[cy][cx] = { type: TILE.DOOR, open: false };
        doorsPlaced++;
      }
    }
  }

  // 0-2 locked doors deeper in the dungeon — require key held by a guard enemy
  const maxLocked = danger >= 3 ? 2 : 1;
  let lockedPlaced = 0;
  for (let cy = Math.floor(H * 0.3); cy < H - 3 && lockedPlaced < maxLocked; cy++) {
    for (let cx = Math.floor(W * 0.3); cx < W - 3 && lockedPlaced < maxLocked; cx++) {
      if (t[cy][cx].type !== TILE.FLOOR) continue;
      const hCorridor = t[cy][cx-1]?.type === TILE.WALL && t[cy][cx+1]?.type === TILE.WALL;
      const vCorridor = t[cy-1]?.[cx]?.type === TILE.WALL && t[cy+1]?.[cx]?.type === TILE.WALL;
      if ((hCorridor || vCorridor) && Math.random() < 0.25) {
        t[cy][cx] = { type: TILE.DOOR, open: false, locked: true, keyId: `key_${lockedPlaced + 1}` };
        lockedPlaced++;
      }
    }
  }

  // 0-1 cage in dungeon (danger 2+, 40% chance) — placed in upper-right area away from spawn
  if (danger >= 2 && Math.random() < 0.4) {
    let cagePlaced = false;
    for (let cy = 2; cy < Math.floor(H * 0.4) && !cagePlaced; cy++) {
      for (let cx = Math.floor(W * 0.6); cx < W - 2 && !cagePlaced; cx++) {
        if (t[cy][cx].type === TILE.FLOOR) {
          t[cy][cx] = { type: TILE.CAGE };
          cagePlaced = true;
        }
      }
    }
  }

  t[1][W - 2] = { type: TILE.EXIT };
  return t;
}

export function genMap(danger, mapW, mapH) {
  const W = mapW ?? DEF_W, H = mapH ?? DEF_H;
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
  // Holy ground — battlefields and ruins occasionally have sacred remnants
  if (Math.random() < 0.4) {
    for (let a = 0; a < 30; a++) {
      const x = 1+Math.floor(Math.random()*(W-2));
      const y = 1+Math.floor(Math.random()*(H-2));
      if (t[y][x].type === TILE.FLOOR) { t[y][x] = { type:TILE.HOLY }; break; }
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

// Forest: dense tree walls, organic winding paths carved by drunkard's walk
export function genForest(danger, mapW, mapH) {
  const W = mapW ?? 22, H = mapH ?? 18;
  const t = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => ({ type: TILE.WALL }))
  );
  const carve = (x, y) => { if (x > 0 && x < W-1 && y > 0 && y < H-1) t[y][x] = { type: TILE.FLOOR }; };
  // Four drunken walks from random starts to open up clearings
  for (let walk = 0; walk < 4; walk++) {
    let x = 1 + Math.floor(Math.random() * (W-2));
    let y = 1 + Math.floor(Math.random() * (H-2));
    for (let step = 0; step < Math.floor(W * H / 3); step++) {
      carve(x, y);
      const d = Math.floor(Math.random() * 4);
      if (d === 0 && x < W-2) x++;
      else if (d === 1 && x > 1) x--;
      else if (d === 2 && y < H-2) y++;
      else if (d === 3 && y > 1)  y--;
    }
  }
  // Guarantee L-path from spawn to exit so map is always traversable
  const [sx, sy, ex, ey] = [1, H-2, W-2, 1];
  let x = sx, y = sy;
  while (x !== ex) { carve(x, y); x += x < ex ? 1 : -1; }
  while (y !== ey) { carve(x, y); y += y < ey ? 1 : -1; }
  // Clear spawn + exit zones
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const fx = sx+dx, fy = sy+dy; if (fx > 0 && fx < W-1 && fy > 0 && fy < H-1) t[fy][fx] = { type: TILE.FLOOR };
    const fx2 = ex+dx, fy2 = ey+dy; if (fx2 > 0 && fx2 < W-1 && fy2 > 0 && fy2 < H-1) t[fy2][fx2] = { type: TILE.FLOOR };
  }
  for (let i = 0; i < 3+danger; i++) {
    for (let a = 0; a < 40; a++) { const lx=1+Math.floor(Math.random()*(W-2)),ly=1+Math.floor(Math.random()*(H-2)); if(t[ly][lx].type===TILE.FLOOR){t[ly][lx]={type:TILE.LOOT};break;} }
  }
  for (let i = 0; i < 1+danger; i++) {
    for (let a = 0; a < 40; a++) { const lx=1+Math.floor(Math.random()*(W-2)),ly=1+Math.floor(Math.random()*(H-2)); if(t[ly][lx].type===TILE.FLOOR){t[ly][lx]={type:TILE.TRAP};break;} }
  }
  t[1][W-2] = { type: TILE.EXIT };
  return t;
}

// Ruined town: street grid with building-block interiors, some collapsed to rubble
export function genRuinedTown(danger, mapW, mapH) {
  const W = mapW ?? 20, H = mapH ?? 16;
  const t = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => ({ type: TILE.WALL }))
  );
  const sr = [Math.floor(H*0.35), Math.floor(H*0.65)];
  const sc = [Math.floor(W*0.35), Math.floor(W*0.65)];
  // Carve streets
  for (let x = 1; x < W-1; x++) { t[sr[0]][x] = { type: TILE.FLOOR }; t[sr[1]][x] = { type: TILE.FLOOR }; }
  for (let y = 1; y < H-1; y++) { t[y][sc[0]] = { type: TILE.FLOOR }; t[y][sc[1]] = { type: TILE.FLOOR }; }
  // Carve building blocks between streets
  const blocks = [
    [1,1,sc[0]-1,sr[0]-1],[sc[0]+1,1,sc[1]-1,sr[0]-1],[sc[1]+1,1,W-2,sr[0]-1],
    [1,sr[0]+1,sc[0]-1,sr[1]-1],[sc[0]+1,sr[0]+1,sc[1]-1,sr[1]-1],[sc[1]+1,sr[0]+1,W-2,sr[1]-1],
    [1,sr[1]+1,sc[0]-1,H-2],[sc[0]+1,sr[1]+1,sc[1]-1,H-2],[sc[1]+1,sr[1]+1,W-2,H-2],
  ];
  for (const [x1,y1,x2,y2] of blocks) {
    if (x2 < x1 || y2 < y1) continue;
    const collapsed = Math.random() < 0.4;
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) {
      if (x < 1 || x > W-2 || y < 1 || y > H-2) continue;
      t[y][x] = { type: collapsed ? TILE.RUBBLE : TILE.FLOOR };
    }
    // Door cut into bottom wall of intact buildings
    if (!collapsed && y2+1 < H-1) {
      const doorX = Math.min(W-2, Math.max(1, x1+Math.floor((x2-x1)/2)));
      t[y2][doorX] = { type: TILE.FLOOR };
    }
  }
  // Ensure spawn/exit clear
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const fx=1+dx,fy=H-2+dy; if(fx>0&&fx<W-1&&fy>0&&fy<H-1) t[fy][fx]={type:TILE.FLOOR};
    const fx2=W-2+dx,fy2=1+dy; if(fx2>0&&fx2<W-1&&fy2>0&&fy2<H-1) t[fy2][fx2]={type:TILE.FLOOR};
  }
  for (let i = 0; i < 5+danger*2; i++) {
    for (let a = 0; a < 50; a++) { const lx=1+Math.floor(Math.random()*(W-2)),ly=1+Math.floor(Math.random()*(H-2)); if(t[ly][lx].type===TILE.FLOOR){t[ly][lx]={type:TILE.LOOT};break;} }
  }
  for (let i = 0; i < 2+danger; i++) {
    for (let a = 0; a < 50; a++) { const lx=1+Math.floor(Math.random()*(W-2)),ly=1+Math.floor(Math.random()*(H-2)); if(t[ly][lx].type===TILE.FLOOR){t[ly][lx]={type:TILE.TRAP};break;} }
  }
  // Elevated rubble mounds — high ground among the ruins
  for (let i = 0; i < 2; i++) {
    for (let a = 0; a < 30; a++) { const lx=1+Math.floor(Math.random()*(W-2)),ly=1+Math.floor(Math.random()*(H-2)); if(t[ly][lx].type===TILE.RUBBLE){t[ly][lx]={type:TILE.ELEVATED};break;} }
  }
  // Town square shrine
  if (Math.random() < 0.5) t[sr[0]][sc[0]] = { type: TILE.HOLY };
  t[1][W-2] = { type: TILE.EXIT };
  return t;
}

// Raider camp: open ground, tent clusters, rear stash, perimeter traps
export function genRaiderCamp(danger, mapW, mapH) {
  const W = mapW ?? 18, H = mapH ?? 14;
  // Camps are open — start with floor, add border walls and tent walls
  const t = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) =>
      (x===0||x===W-1||y===0||y===H-1) ? { type: TILE.WALL } : { type: TILE.FLOOR }
    )
  );
  // Tent clusters (small walled rooms scattered around camp)
  const tentSpots = [
    [2,2],[W-6,2],[2,H-6],[W-6,H-6],[Math.floor(W/2)-2,Math.floor(H/2)-2],
  ];
  for (const [tx,ty] of tentSpots) {
    if (Math.random() < 0.7) {
      const tw=3, th=2;
      for (let y=ty; y<=ty+th+1&&y<H-1; y++) for (let x=tx; x<=tx+tw+1&&x<W-1; x++) {
        if(y===ty||y===ty+th+1||x===tx||x===tx+tw+1) t[y][x]={type:TILE.WALL};
      }
      // Door cut in tent wall
      const openY = ty+1;
      if (openY < H-1 && tx > 0) t[openY][tx] = { type: TILE.FLOOR };
    }
  }
  // Clear spawn/exit
  for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
    const fx=1+dx,fy=H-2+dy; if(fx>0&&fx<W-1&&fy>0&&fy<H-1) t[fy][fx]={type:TILE.FLOOR};
    const fx2=W-2+dx,fy2=1+dy; if(fx2>0&&fx2<W-1&&fy2>0&&fy2<H-1) t[fy2][fx2]={type:TILE.FLOOR};
  }
  // Loot stash in back-right quadrant
  for (let i = 0; i < 4+danger; i++) {
    for (let a = 0; a < 40; a++) {
      const lx=Math.floor(W*0.55)+Math.floor(Math.random()*Math.floor(W*0.4));
      const ly=Math.floor(H*0.55)+Math.floor(Math.random()*Math.floor(H*0.4));
      if(lx>0&&lx<W-1&&ly>0&&ly<H-1&&t[ly][lx].type===TILE.FLOOR){t[ly][lx]={type:TILE.LOOT};break;}
    }
  }
  for (let i = 0; i < 1+danger; i++) {
    for (let a = 0; a < 40; a++) { const lx=1+Math.floor(Math.random()*(W-2)),ly=1+Math.floor(Math.random()*(H-2)); if(t[ly][lx].type===TILE.FLOOR){t[ly][lx]={type:TILE.TRAP};break;} }
  }
  // Campfire in the center of the camp
  const cfx=Math.floor(W/2), cfy=Math.floor(H/2);
  if(t[cfy]?.[cfx]?.type===TILE.FLOOR) t[cfy][cfx] = { type: TILE.FIRE };
  t[1][W-2] = { type: TILE.EXIT };
  return t;
}

// Swamp: open muddy terrain, scattered debris and sinkholes
export function genSwamp(danger, mapW, mapH) {
  const W = mapW ?? 20, H = mapH ?? 16;
  const t = [];
  for (let y = 0; y < H; y++) {
    t[y] = [];
    for (let x = 0; x < W; x++) {
      if (x===0||x===W-1||y===0||y===H-1) { t[y][x]={type:TILE.WALL}; continue; }
      const r = Math.random();
      t[y][x] = { type: r < 0.07 ? TILE.WALL : r < 0.17 ? TILE.RUBBLE : TILE.FLOOR };
    }
  }
  for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
    const fx=1+dx,fy=H-2+dy; if(fx>0&&fx<W-1&&fy>0&&fy<H-1) t[fy][fx]={type:TILE.FLOOR};
    const fx2=W-2+dx,fy2=1+dy; if(fx2>0&&fx2<W-1&&fy2>0&&fy2<H-1) t[fy2][fx2]={type:TILE.FLOOR};
  }
  for (let i = 0; i < 4+danger; i++) {
    for (let a = 0; a < 40; a++) { const lx=1+Math.floor(Math.random()*(W-2)),ly=1+Math.floor(Math.random()*(H-2)); if(t[ly][lx].type===TILE.FLOOR){t[ly][lx]={type:TILE.LOOT};break;} }
  }
  for (let i = 0; i < 2+danger; i++) {
    for (let a = 0; a < 40; a++) { const lx=1+Math.floor(Math.random()*(W-2)),ly=1+Math.floor(Math.random()*(H-2)); if(t[ly][lx].type===TILE.FLOOR){t[ly][lx]={type:TILE.TRAP};break;} }
  }
  // Water patches — flooded ground
  for (let i = 0; i < 3+Math.floor(Math.random()*2); i++) {
    for (let a = 0; a < 40; a++) { const lx=1+Math.floor(Math.random()*(W-2)),ly=1+Math.floor(Math.random()*(H-2)); if(t[ly][lx].type===TILE.FLOOR){t[ly][lx]={type:TILE.WATER};break;} }
  }
  t[1][W-2] = { type: TILE.EXIT };
  return t;
}

// Battlefield: open crater-filled field, rich loot, holy memorial patches, no live enemies
export function genBattlefield(_danger, mapW, mapH) {
  const W = mapW ?? 24, H = mapH ?? 18;
  const t = [];
  for (let y = 0; y < H; y++) {
    t[y] = [];
    for (let x = 0; x < W; x++) {
      if (x===0||x===W-1||y===0||y===H-1) { t[y][x]={type:TILE.WALL}; continue; }
      t[y][x] = { type: Math.random() < 0.14 ? TILE.RUBBLE : TILE.FLOOR };
    }
  }
  for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
    const fx=1+dx,fy=H-2+dy; if(fx>0&&fx<W-1&&fy>0&&fy<H-1) t[fy][fx]={type:TILE.FLOOR};
    const fx2=W-2+dx,fy2=1+dy; if(fx2>0&&fx2<W-1&&fy2>0&&fy2<H-1) t[fy2][fx2]={type:TILE.FLOOR};
  }
  // Rich loot from fallen soldiers
  for (let i = 0; i < 12; i++) {
    for (let a = 0; a < 50; a++) { const lx=1+Math.floor(Math.random()*(W-2)),ly=1+Math.floor(Math.random()*(H-2)); if(t[ly][lx].type===TILE.FLOOR){t[ly][lx]={type:TILE.LOOT};break;} }
  }
  // Memorial holy ground patches (2-4)
  for (let i = 0; i < 2+Math.floor(Math.random()*3); i++) {
    for (let a = 0; a < 40; a++) { const lx=1+Math.floor(Math.random()*(W-2)),ly=1+Math.floor(Math.random()*(H-2)); if(t[ly][lx].type===TILE.FLOOR){t[ly][lx]={type:TILE.HOLY};break;} }
  }
  // Elevated earthworks — defensive berms and high ground
  for (let i = 0; i < 2+Math.floor(Math.random()*2); i++) {
    for (let a = 0; a < 30; a++) { const lx=1+Math.floor(Math.random()*(W-2)),ly=1+Math.floor(Math.random()*(H-2)); if(t[ly][lx].type===TILE.FLOOR){t[ly][lx]={type:TILE.ELEVATED};break;} }
  }
  // Water — shell craters filled with rain
  for (let i = 0; i < 2; i++) {
    for (let a = 0; a < 30; a++) { const lx=1+Math.floor(Math.random()*(W-2)),ly=1+Math.floor(Math.random()*(H-2)); if(t[ly][lx].type===TILE.FLOOR){t[ly][lx]={type:TILE.WATER};break;} }
  }
  t[1][W-2] = { type: TILE.EXIT };
  return t;
}

// Abandoned village: mix of intact and collapsed buildings around a central square
export function genAbandonedVillage(danger, mapW, mapH) {
  const W = mapW ?? 18, H = mapH ?? 16;
  const t = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => ({ type: TILE.WALL }))
  );
  // Central square
  const qx=Math.floor(W/2)-2, qy=Math.floor(H/2)-2;
  for (let y=qy; y<qy+5&&y<H-1; y++) for (let x=qx; x<qx+5&&x<W-1; x++)
    if (x>0&&y>0) t[y][x]={type:TILE.FLOOR};
  // Buildings scattered around square
  for (let i = 0; i < 5+Math.floor(Math.random()*2); i++) {
    const bw=3+Math.floor(Math.random()*3), bh=2+Math.floor(Math.random()*3);
    const bx=1+Math.floor(Math.random()*(W-bw-2)), by=1+Math.floor(Math.random()*(H-bh-2));
    const collapsed = Math.random() < 0.35;
    for (let y=by; y<by+bh; y++) for (let x=bx; x<bx+bw; x++) {
      if (x<1||x>W-2||y<1||y>H-2) continue;
      if (y===by||y===by+bh-1||x===bx||x===bx+bw-1)
        t[y][x] = { type: collapsed ? TILE.RUBBLE : TILE.WALL };
      else
        t[y][x] = { type: collapsed ? TILE.RUBBLE : TILE.FLOOR };
    }
    // Door on bottom wall of intact buildings
    if (!collapsed && by+bh < H-1) {
      const doorX = Math.min(W-2, Math.max(1, bx+Math.floor(bw/2)));
      t[by+bh-1][doorX] = { type: TILE.FLOOR };
    }
  }
  // Carve path: spawn → square center → exit
  const cx=qx+2, cy=qy+2;
  let px=1, py=H-2;
  while(px!==cx){if(px>0&&px<W-1&&py>0&&py<H-1)t[py][px]={type:TILE.FLOOR};px+=px<cx?1:-1;}
  while(py!==cy){if(px>0&&px<W-1&&py>0&&py<H-1)t[py][px]={type:TILE.FLOOR};py+=py<cy?1:-1;}
  px=W-2; py=1;
  while(px!==cx){if(px>0&&px<W-1&&py>0&&py<H-1)t[py][px]={type:TILE.FLOOR};px+=px<cx?1:-1;}
  while(py!==cy){if(px>0&&px<W-1&&py>0&&py<H-1)t[py][px]={type:TILE.FLOOR};py+=py<cy?1:-1;}
  // Clear spawn/exit zones
  for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
    const fx=1+dx,fy=H-2+dy; if(fx>0&&fx<W-1&&fy>0&&fy<H-1) t[fy][fx]={type:TILE.FLOOR};
    const fx2=W-2+dx,fy2=1+dy; if(fx2>0&&fx2<W-1&&fy2>0&&fy2<H-1) t[fy2][fx2]={type:TILE.FLOOR};
  }
  for (let i = 0; i < 4+danger; i++) {
    for (let a = 0; a < 50; a++) { const lx=1+Math.floor(Math.random()*(W-2)),ly=1+Math.floor(Math.random()*(H-2)); if(t[ly][lx].type===TILE.FLOOR){t[ly][lx]={type:TILE.LOOT};break;} }
  }
  for (let i = 0; i < 1+danger; i++) {
    for (let a = 0; a < 40; a++) { const lx=1+Math.floor(Math.random()*(W-2)),ly=1+Math.floor(Math.random()*(H-2)); if(t[ly][lx].type===TILE.FLOOR){t[ly][lx]={type:TILE.TRAP};break;} }
  }
  t[1][W-2] = { type: TILE.EXIT };
  return t;
}

// Crypt: a long central corridor flanked by symmetric burial alcoves — patterned, like the cabin but linear
export function genCryptMap(danger, mapW, mapH) {
  const W = mapW ?? DEF_W, H = mapH ?? DEF_H;
  const t = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => ({ type: TILE.WALL }))
  );

  // Central horizontal corridor
  const midY = Math.floor(H / 2);
  for (let x = 1; x < W - 1; x++) t[midY][x] = { type: TILE.FLOOR };

  // Symmetric burial alcoves branching above and below the corridor
  for (let x = 2; x < W - 2; x += 3) {
    for (let y = Math.max(1, midY - 2); y < midY; y++)
      for (let ax = x; ax < x + 2 && ax < W - 1; ax++) t[y][ax] = { type: TILE.FLOOR };
    for (let y = midY + 1; y <= Math.min(H - 2, midY + 2); y++)
      for (let ax = x; ax < x + 2 && ax < W - 1; ax++) t[y][ax] = { type: TILE.FLOOR };
  }

  // Loot tucked into alcoves
  for (let i = 0; i < 8 + danger * 2; i++) {
    for (let a = 0; a < 50; a++) {
      const x = 1 + Math.floor(Math.random() * (W - 2));
      const y = 1 + Math.floor(Math.random() * (H - 2));
      if (y !== midY && t[y][x].type === TILE.FLOOR) { t[y][x] = { type: TILE.LOOT }; break; }
    }
  }
  // Traps along the corridor
  for (let i = 0; i < 2 + danger; i++) {
    for (let a = 0; a < 40; a++) {
      const x = 1 + Math.floor(Math.random() * (W - 2));
      if (t[midY][x].type === TILE.FLOOR) { t[midY][x] = { type: TILE.TRAP }; break; }
    }
  }
  // Holy ground — sanctified resting places
  for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) {
    for (let a = 0; a < 40; a++) {
      const x = 1 + Math.floor(Math.random() * (W - 2));
      const y = 1 + Math.floor(Math.random() * (H - 2));
      if (y !== midY && t[y][x].type === TILE.FLOOR) { t[y][x] = { type: TILE.HOLY }; break; }
    }
  }
  // Doors at alcove chokepoints along the corridor
  let doorsPlaced = 0;
  for (let x = 2; x < W - 2 && doorsPlaced < 2; x += 3) {
    if (t[midY][x].type === TILE.FLOOR && Math.random() < 0.4) {
      t[midY][x] = { type: TILE.DOOR, open: false };
      doorsPlaced++;
    }
  }

  // Connect spawn (1, H-2) and exit (W-2, 1) corners up/down to the corridor
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const sx = 1 + dx, sy = H - 2 + dy;
    if (sx > 0 && sx < W - 1 && sy > 0 && sy < H - 1) t[sy][sx] = { type: TILE.FLOOR };
    const ex = W - 2 + dx, ey = 1 + dy;
    if (ex > 0 && ex < W - 1 && ey > 0 && ey < H - 1) t[ey][ex] = { type: TILE.FLOOR };
  }
  let x = 1, y = H - 2;
  while (y !== midY) { t[y][x] = { type: TILE.FLOOR }; y += y < midY ? 1 : -1; }
  x = W - 2; y = 1;
  while (y !== midY) { t[y][x] = { type: TILE.FLOOR }; y += y < midY ? 1 : -1; }

  t[1][W - 2] = { type: TILE.EXIT };
  return t;
}

// Vault: an outer ring corridor wrapped around a sealed central treasure room — patterned, symmetric
export function genVaultMap(danger, mapW, mapH) {
  const W = mapW ?? DEF_W, H = mapH ?? DEF_H;
  const t = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => ({ type: TILE.WALL }))
  );

  // Outer ring corridor, one tile in from the border
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (x === 1 || x === W - 2 || y === 1 || y === H - 2) t[y][x] = { type: TILE.FLOOR };
  }

  // Central vault room, sealed behind a single locked door
  const vw = Math.max(4, Math.floor(W * 0.4));
  const vh = Math.max(3, Math.floor(H * 0.4));
  const vx = Math.floor((W - vw) / 2), vy = Math.floor((H - vh) / 2);
  for (let y = vy; y < vy + vh; y++) for (let x = vx; x < vx + vw; x++) t[y][x] = { type: TILE.FLOOR };
  for (let x = vx; x < vx + vw; x++) { t[vy][x] = { type: TILE.WALL }; t[vy + vh - 1][x] = { type: TILE.WALL }; }
  for (let y = vy; y < vy + vh; y++) { t[y][vx] = { type: TILE.WALL }; t[y][vx + vw - 1] = { type: TILE.WALL }; }
  const doorX = vx + Math.floor(vw / 2);
  t[vy + vh - 1][doorX] = { type: TILE.DOOR, open: false, locked: true, keyId: 'key_1' };
  // Corridor stub connecting the vault door down to the outer ring
  for (let y = vy + vh; y < H - 1; y++) t[y][doorX] = { type: TILE.FLOOR };

  // Loot concentrated inside the vault
  for (let i = 0; i < 6 + danger * 3; i++) {
    for (let a = 0; a < 40; a++) {
      const x = vx + 1 + Math.floor(Math.random() * (vw - 2));
      const y = vy + 1 + Math.floor(Math.random() * (vh - 2));
      if (t[y][x].type === TILE.FLOOR) { t[y][x] = { type: TILE.LOOT }; break; }
    }
  }
  // A few scraps in the outer ring
  for (let i = 0; i < 2 + danger; i++) {
    for (let a = 0; a < 40; a++) {
      const x = 1 + Math.floor(Math.random() * (W - 2));
      const y = 1 + Math.floor(Math.random() * (H - 2));
      if (t[y][x].type === TILE.FLOOR) { t[y][x] = { type: TILE.LOOT }; break; }
    }
  }
  // Traps guarding the vault door
  for (let i = 0; i < 2 + Math.floor(danger / 2); i++) {
    for (let a = 0; a < 40; a++) {
      const x = doorX + (Math.random() < 0.5 ? -1 : 1);
      const y = vy + vh + Math.floor(Math.random() * Math.max(1, H - 1 - (vy + vh)));
      if (t[y]?.[x]?.type === TILE.FLOOR) { t[y][x] = { type: TILE.TRAP }; break; }
    }
  }

  t[1][W - 2] = { type: TILE.EXIT };
  return t;
}

// Barracks: two symmetric rows of cells along a central corridor — patterned, grid-like
export function genBarracksMap(danger, mapW, mapH) {
  const W = mapW ?? DEF_W, H = mapH ?? DEF_H;
  const t = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => ({ type: TILE.WALL }))
  );

  const midY = Math.floor(H / 2);
  for (let x = 1; x < W - 1; x++) { t[midY - 1][x] = { type: TILE.FLOOR }; t[midY][x] = { type: TILE.FLOOR }; }

  // Cells along the top and bottom of the corridor
  for (let x = 2; x < W - 3; x += 4) {
    for (let y = Math.max(1, midY - 4); y < midY - 1; y++)
      for (let cx = x; cx < x + 3 && cx < W - 1; cx++) t[y][cx] = { type: TILE.FLOOR };
    if (Math.random() < 0.5) t[midY - 2][x + 1] = { type: TILE.DOOR, open: false };

    for (let y = midY + 1; y < Math.min(H - 1, midY + 4); y++)
      for (let cx = x; cx < x + 3 && cx < W - 1; cx++) t[y][cx] = { type: TILE.FLOOR };
    if (Math.random() < 0.5) t[midY + 1][x + 1] = { type: TILE.DOOR, open: false };
  }

  // Loot scattered through the cells
  for (let i = 0; i < 8 + danger * 2; i++) {
    for (let a = 0; a < 50; a++) {
      const x = 1 + Math.floor(Math.random() * (W - 2));
      const y = 1 + Math.floor(Math.random() * (H - 2));
      if (t[y][x].type === TILE.FLOOR) { t[y][x] = { type: TILE.LOOT }; break; }
    }
  }
  // Traps
  for (let i = 0; i < 2 + danger; i++) {
    for (let a = 0; a < 50; a++) {
      const x = 1 + Math.floor(Math.random() * (W - 2));
      const y = 1 + Math.floor(Math.random() * (H - 2));
      if (t[y][x].type === TILE.FLOOR) { t[y][x] = { type: TILE.TRAP }; break; }
    }
  }
  // Campfire near the spawn end of the corridor
  if (t[midY]?.[2]?.type === TILE.FLOOR) t[midY][2] = { type: TILE.FIRE };

  // Connect spawn (1, H-2) and exit (W-2, 1) to the corridor
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const sx = 1 + dx, sy = H - 2 + dy;
    if (sx > 0 && sx < W - 1 && sy > 0 && sy < H - 1) t[sy][sx] = { type: TILE.FLOOR };
    const ex = W - 2 + dx, ey = 1 + dy;
    if (ex > 0 && ex < W - 1 && ey > 0 && ey < H - 1) t[ey][ex] = { type: TILE.FLOOR };
  }
  let x = 1, y = H - 2;
  while (y !== midY) { t[y][x] = { type: TILE.FLOOR }; y += y < midY ? 1 : -1; }
  x = W - 2; y = 1;
  while (y !== midY) { t[y][x] = { type: TILE.FLOOR }; y += y < midY ? 1 : -1; }

  t[1][W - 2] = { type: TILE.EXIT };
  return t;
}

// Hunting Lodge: a great hall flanked by side rooms — patterned like the cabin, but bigger (deep-floor variant)
export function genHuntingLodgeMap(_danger, mapW, mapH) {
  const W = mapW ?? DEF_W, H = mapH ?? DEF_H;
  const t = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => ({ type: TILE.WALL }))
  );

  // Great hall — large central room
  const hw = 6, hh = 5, sw = 3;
  const hx = Math.floor((W - hw) / 2), hy = Math.floor((H - hh) / 2);
  for (let y = hy; y < hy + hh; y++) for (let x = hx; x < hx + hw; x++) t[y][x] = { type: TILE.FLOOR };

  // Side rooms with doors into the hall, when there's space
  if (hx - sw - 1 > 0) {
    for (let y = hy + 1; y < hy + hh - 1; y++) for (let x = hx - sw - 1; x < hx - 1; x++) t[y][x] = { type: TILE.FLOOR };
    t[hy + Math.floor(hh / 2)][hx - 1] = { type: TILE.DOOR, open: false };
  }
  if (hx + hw + sw + 1 < W) {
    for (let y = hy + 1; y < hy + hh - 1; y++) for (let x = hx + hw + 1; x < hx + hw + sw + 1; x++) t[y][x] = { type: TILE.FLOOR };
    t[hy + Math.floor(hh / 2)][hx + hw] = { type: TILE.DOOR, open: false };
  }

  // Hearth at the center of the hall
  t[hy + Math.floor(hh / 2)][hx + Math.floor(hw / 2)] = { type: TILE.FIRE };

  // Lots of loot — a hunter's stockpile
  for (let i = 0; i < 10; i++) {
    for (let a = 0; a < 50; a++) {
      const x = 1 + Math.floor(Math.random() * (W - 2));
      const y = 1 + Math.floor(Math.random() * (H - 2));
      if (t[y][x].type === TILE.FLOOR) { t[y][x] = { type: TILE.LOOT }; break; }
    }
  }
  // Traps — bear traps and snares
  for (let i = 0; i < 3; i++) {
    for (let a = 0; a < 40; a++) {
      const x = 1 + Math.floor(Math.random() * (W - 2));
      const y = 1 + Math.floor(Math.random() * (H - 2));
      if (t[y][x].type === TILE.FLOOR) { t[y][x] = { type: TILE.TRAP }; break; }
    }
  }

  // Connect spawn (1, H-2) to the hall
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const sx = 1 + dx, sy = H - 2 + dy;
    if (sx > 0 && sx < W - 1 && sy > 0 && sy < H - 1) t[sy][sx] = { type: TILE.FLOOR };
  }
  const cx = hx + Math.floor(hw / 2), cy = hy + Math.floor(hh / 2);
  let x = 1, y = H - 2;
  while (x !== cx) { t[y][x] = { type: TILE.FLOOR }; x += x < cx ? 1 : -1; }
  while (y !== cy) { t[y][x] = { type: TILE.FLOOR }; y += y < cy ? 1 : -1; }

  // Connect exit (W-2, 1) to the hall
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const ex = W - 2 + dx, ey = 1 + dy;
    if (ex > 0 && ex < W - 1 && ey > 0 && ey < H - 1) t[ey][ex] = { type: TILE.FLOOR };
  }
  x = W - 2; y = 1;
  while (x !== cx) { t[y][x] = { type: TILE.FLOOR }; x += x < cx ? 1 : -1; }
  while (y !== cy) { t[y][x] = { type: TILE.FLOOR }; y += y < cy ? 1 : -1; }

  t[1][W - 2] = { type: TILE.EXIT };
  return t;
}
