# Sanctuary — Map, Encounter & Movement Overhaul

Full build plan for the next phase. Sections are ordered by priority.
Each section lists status, files touched, and exact implementation notes.

---

## ✅ Section 1 — Movement Fix (CRITICAL)
**Status: DONE — code written and committed**

**Problem:** Enemies called `bfsStepToward` which returns only the next tile, so they advanced 1 tile/turn regardless of `moveRange`. A Scout (move:4) and a Brute (move:2) moved identically.

**What was done:**
- Added `bfsPath(tiles, fromX, fromY, toX, toY, units)` to `src/systems/map.js` — returns full ordered path array using BFS. Allows stepping into target tile; all intermediate steps require `walkable()`.
- Removed `bfsStepToward` import from `gameStore.js`; replaced with `bfsPath as bfsGridPath`.
- Enemy AI in `endTurn`: both the "move toward visible target" and "chase last known" branches now walk up to `u.moveRange` steps along the full BFS path per turn. Movement stops before the target tile (attack is resolved separately). Each step is re-checked with `walkable` so enemies can't stack or pass through a unit that moved earlier in the same frame.
- Patrol movement unchanged (single-step delta walk).

**Files:** `src/systems/map.js`, `src/store/gameStore.js`

---

## ✅ Section 2 — Holy Ground Terrain
**Status: DONE — code written and committed**

**Mechanic:**
- New tile type `TILE.HOLY = 'holy'` in `src/data/constants.js`
- Placement: shrines, old temples, memorials (in dungeon, ruined town, battlefield maps)
- End-of-turn damage: undead standing on holy tile take 1 dmg; Varek takes 1 dmg every 2 turns (track `varek.holyTurns` counter); living allies unaffected
- Visual: ⛪ icon on floor tile with pale yellow tint

**Files:** `src/data/constants.js`, `src/systems/map.js` (place in gen functions), `src/store/gameStore.js` (endTurn), `src/components/mission/MissionMap.jsx`

---

## ✅ Section 3 — New Map Generators
**Status: DONE — code written and committed**

Replace the single `genMap` fallback with dedicated generators per location type.
`startMission` in `gameStore.js` picks generator by `location.type` / `location.id` prefix.

### Generators to build (all in `src/systems/map.js`):

| Generator | Size | Location type | Key features |
|-----------|------|--------------|--------------|
| `genForest` | 22×18 | wild_forest | Heavy tree (WALL) scatter; winding floor paths; ambush spawn tiles (hidden enemies); roaming wildlife (sleeping state) |
| `genRuinedTown` | 20×16 | wild_ruins, ruined_town | Street grid; building interiors (rooms); rubble choke points |
| `genRaiderCamp` | 18×14 | camp | Tent clusters (rooms); central FIRE tile; watch positions at edges; rear stash; some raiders sleeping |
| `genSwamp` | 20×16 | wild_swamp | Open layout with WATER patches (-1 move, +noise); fog-heavy; twisted paths |
| `genBattlefield` | 24×18 | battlefield (new loc type) | No live enemies; rich bone loot; holy ground patches; rubble craters |
| `genAbandonedVillage` | 18×16 | village | Mix of intact and collapsed buildings; random state on entry (empty/raiders/survivors) |

Existing generators kept: `genDungeonMap`, `genCabinMap`, `genMap` (plains fallback)

### Mapping table (in `startMission`):
```
location.id starts with 'wild_forest' → genForest
location.id starts with 'wild_ruins'  → genRuinedTown
location.id starts with 'wild_swamp'  → genSwamp
location.type === 'camp'              → genRaiderCamp
location.type === 'village'           → genAbandonedVillage
location.type === 'dungeon'           → genDungeonMap (existing)
location.type === 'cabin'             → genCabinMap (existing)
everything else                       → genMap (plains fallback)
```

**Files:** `src/systems/map.js`, `src/store/gameStore.js`

---

## ✅ Section 4 — Enemy Placement Archetypes
**Status: DONE — code written and committed**

Each spawned enemy gets a `placement` field that drives their AI:

| Placement | Behaviour |
|-----------|-----------|
| `patrol`  | Follows waypoints array `{ wx, wy }[]`. Walks to each wp in order, loops. |
| `guard`   | Stationary. Watches `watchTile: {x,y}`. Only alerted by sight/noise. |
| `sleep`   | `sleeping: true`. Spot chance halved. Awakens when noise ≥ 60 or enemy steps adjacent. Shows 💤 in MissionMap. |
| `roam`    | Random-walks. Aggressive on approach. |
| `ambush`  | Invisible on FLOOR tile until player crosses trigger line (row threshold). Spawns on trigger. |

Each map generator places enemies via placement archetype functions instead of random positions.

**Files:** `src/systems/combat.js` (spawnEnemies), `src/systems/map.js` (per-generator placement), `src/store/gameStore.js` (AI loop), `src/components/mission/MissionMap.jsx` (💤 / ⭐ display)

---

## ⬜ Section 5 — New Terrain Types
**Status: NOT STARTED**

### Tiles to add to `constants.js`:
```js
HOLY:    'holy',    // ⛪  — covered in Section 2
SHADOW:  'shadow',  // 🌑  — deep shadow, -1 enemy spot
WATER:   'water',   // 💧  — costs +1 move to cross, +noise
ELEVATED:'elevated',// 🪨  — +1 sight, ranged attack bonus
FIRE:    'fire',    // 🔥  — damage on entry, spreads each turn
DOOR:    'door',    // 🚪  — passable; starts closed (blocks), opened by adjacent unit
```

### Mechanical effects (all in `gameStore.js` endTurn / doMove):
- **SHADOW**: when spotting, enemies standing in shadow subtract 1 from their spot roll
- **WATER**: entering costs 2 move (instead of 1), noise +5
- **ELEVATED**: units on elevated add +1 to sight range for fog calc
- **FIRE**: on entry, unit takes 1 dmg; at end of each turn, spreads to one adjacent non-wall floor tile
- **DOOR**: closed = impassable. Player or enemy moving adjacent can "open" as free action (costs 0 move but leaves door open). Locked door requires key item.

### Visual in `MissionMap.jsx`:
Each new tile gets icon + distinct background colour from THEME_FLOOR_BG.

**Files:** `src/data/constants.js`, `src/systems/map.js`, `src/store/gameStore.js`, `src/components/mission/MissionMap.jsx`

---

## ⬜ Section 6 — Objective Pool
**Status: NOT STARTED**

Every map has one active `objective` stored in `ms.objective`.
Generated in `startMission` by a weighted random draw from the location-type pool.

### Objective types:
| ID | Description |
|----|-------------|
| `exit`      | Reach the exit tile (current default) |
| `survive`   | Survive N turns, then exit opens |
| `loot_named`| Open specific named container |
| `eliminate` | Kill specific named target unit |
| `escort`    | Get survivor or item to exit |
| `defend`    | Hold tile for N turns |
| `investigate` | Visit 3 marked tiles then exit |
| `rescue`    | Free captive from cage, escort to exit |
| `sabotage`  | Destroy 2–3 marked structures |
| `silent_bonus` | No full alert = bonus loot on exit |

### State tracking in `ms`:
```js
ms.objective = { type, label, progress, target, complete }
```

**Files:** New `src/systems/objectives.js`, `src/store/gameStore.js`, `src/components/screens/MissionScreen.jsx`

---

## ⬜ Section 7 — Doors & Keys
**Status: NOT STARTED**

- `TILE.DOOR` state machine: `{ type:'door', state:'closed'|'open'|'locked', keyId }`
- `TILE.CAGE` for captive holding areas
- Key items drop from specific guard units (flagged with `holdsKey: true`)
- Picking up key: auto-added to `ms.keys[]` (array of keyIds player holds)
- Using key: move adjacent to locked door/cage → "Use Key" action appears in action panel

**Files:** `src/data/constants.js`, `src/store/gameStore.js`, `src/components/screens/MissionScreen.jsx`

---

## ⬜ Section 8 — Group Ambush Behaviours
**Status: NOT STARTED**

When the first enemy is alerted, check if any enemy has `ambushGroup: true`. If so, on the NEXT enemy turn, ambush group activates:

| Type | Effect |
|------|--------|
| `pincer` | Group A approaches from one side, Group B from opposite |
| `surround` | Enemies pathfind to cut off exit tile |
| `delayed_entry` | After turn 5, enemies enter from map edges |
| `leader_rally` | If leader reaches rally tile, sleeping enemies fully activate |

**Files:** `src/store/gameStore.js`, `src/systems/map.js` (group placement during gen)

---

## Implementation Order

1. ✅ **Section 1** — Movement Fix (done)
2. ✅ **Section 2** — Holy Ground (done)
3. ✅ **Section 3** — Map Generators (done)
4. ✅ **Section 4** — Enemy Placement Archetypes (done)
4b. ✅ **AP Glow** — Unit border glow by AP: green=2, yellow=1, red=0 (done)
5. ⬜ **Section 5** — New Terrain Types (~45 mins)
6. ⬜ **Section 6** — Objectives (~1.5 hrs)
7. ⬜ **Section 7** — Doors & Keys (~45 mins)
8. ⬜ **Section 8** — Group Ambush (~1 hr)
