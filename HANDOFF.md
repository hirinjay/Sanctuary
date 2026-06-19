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

## ✅ Section 5 — New Terrain Types
**Status: DONE — code written and committed**

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

## ✅ Section 6 — Objective Pool
**Status: DONE — code written and committed**

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

**Implemented objective types:** `exit`, `eliminate`, `loot_named`, `survive`, `silent_bonus`
Skipped for now: `escort`, `defend`, `investigate`, `rescue`, `sabotage` (require additional mechanics)

**What was built:**
- `src/systems/objectives.js` — `generateObjective(locType, tiles, units, danger)` picks from weighted pool per location type
- `startMission`: generates objective, marks loot tile (`marked:true`) for `loot_named`, logs objective at mission start
- `doMove`: checks loot_named on cache open, checks survive/silent_bonus on exit, fails silent_bonus on full alert
- `doAttack`: checks eliminate on target kill, adds bonus loot to `ms.loot`
- `endTurn`: fails silent_bonus if new enemy alerts during sight check
- `MissionMap.jsx`: gold border + glow on marked cache tile
- `MissionScreen.jsx`: objective bar between header and map (⭐/✗/◼ + label + survive counter)

**Files:** `src/systems/objectives.js` (new), `src/store/gameStore.js`, `src/components/screens/MissionScreen.jsx`, `src/components/mission/MissionMap.jsx`

---

## ✅ Section 7 — Doors & Keys
**Status: DONE — code written and committed**

**What was built:**
- `TILE.CAGE` added to `src/data/constants.js`
- `TILE.DOOR` locked state: `{ type:'door', open:false, locked:true, keyId:'key_1' }`
- `genDungeonMap`: places 0–2 locked doors in deeper corridors (danger ≥ 2, 25% chance per valid corridor tile); places 0–1 cage in upper-right quadrant (danger ≥ 2, 40% chance)
- `startMission`: scans map for locked door `keyId`s, assigns each to a random eligible (non-sleeping, non-key-holding) enemy via `holdsKey: true, keyId`
- `doAttack`: on kill, if enemy had `holdsKey`, key is auto-collected into `ms.keys[]`; logs "🔑 finds a key!"
- `doUseKey(x, y, sel)`: costs 1 AP; unlocks adjacent locked door (opens it) or breaks cage (becomes floor); validates correct keyId in inventory; logs outcome
- `walkable()`: cage blocks movement; `moveRange()`: locked doors excluded from green highlight
- `MissionScreen.jsx`: key count in header (🔑×N); `adjacentKeyTarget` detection; Use Key button appears when armed unit is adjacent to a valid target
- `MissionMap.jsx`: cage tile icon ⛓ / bg `#0a0a14`; locked door shows 🔒 with dark-red bg; open door shows 🚪
- Encounter legend: locked door and cage entries added

**Additional fixes in this session:**
- `handleCellClick`: fallen units are now walkable (treated as empty tile) — movement highlight and move action work correctly over them
- `endMission`: reads `ms.objective` before clearing; complete objective gives Varek +5 XP (pushed to `luq`); failed critical objective (eliminate/loot_named/survive) randomly drops ~half of mission loot
- `subscribeWithSelector` middleware added to store — fixes Pixi world map not updating on Varek movement (all subscription callbacks were silently dead in Zustand v5 without this)

**Files:** `src/data/constants.js`, `src/systems/map.js`, `src/store/gameStore.js`, `src/components/screens/MissionScreen.jsx`, `src/components/mission/MissionMap.jsx`

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

## ⬜ Section 9 — Class Promotion System (PRIORITY)
**Status: NOT STARTED**

Units feel identical right now. This is the priority build before Section 8.

### Promotion tiers

| Level | Trigger | Cost | Requirement |
|-------|---------|------|-------------|
| 2 | Modal popup after encounter | None | — |
| 5 | Modal popup after encounter | Arcane dust + bones (TBD in balance pass) | Ascension Forge at Sanctuary |

Level 2: player chooses one of two grimoire-gated branches. Level 5: player chooses one ability upgrade based on their tier-2 ability choice. Promotions are permanent. Ability choice at promotion is permanent.

### Ability types

| Type | Behaviour |
|------|-----------|
| `active` | Player triggers during turn, no AP cost, use-limit per encounter |
| `reactive` | Player arms it; fires automatically when trigger condition met; stays armed until triggered; resets at encounter start if unused |
| `passive` | Always on, no activation |

### Architecture — data-driven class trees

Store all class definitions in `src/data/classes.js` as config objects. No promotion logic should be hardcoded in the store.

```js
// Shape of one class entry
{
  id: 'death_knight',
  name: 'Death Knight',
  base: 'skeleton_warrior',   // base unit type it promotes from
  tier: 2,
  grimoires: ['pale', 'verdant', 'tinker'],  // null = all, array = allowlist
  replaces: null,              // id of class it replaces for specific grimoire
  stats: { hp:8, dmg:4, def:1, move:3 },
  tether: 1,
  abilityChoice: ['bone_shield', 'intimidate'],  // player picks one at promotion
}

// Shape of one ability entry
{
  id: 'bone_shield',
  name: 'Bone Shield',
  type: 'reactive',           // active | reactive | passive
  trigger: 'on_hit',          // reactive only
  effect: 'negate_damage',
  duration: null,
  usesPerEncounter: 1,
  upgradesTo: 'fortress_shell',  // tier-3 upgrade, null if terminal
}
```

Bestiary reads from the same `classes.js` config — single source of truth.

### Grimoire locks

- **Pale Codex**: standard Skeleton Warrior tree + Pale Warden exclusive (branches from base, not from Siege/Eternal)
- **Whispers of the Flesh**: replaces Death Knight → Flesh Knight; Grave Archer → Bone Berserker; Siege Warden → Flesh Warden; Eternal Warden → Flesh Eternal
- **Verdant Rite**: replaces Death Knight → Verdant Knight; Grave Archer → Verdant Archer; Phantom → Grove Phantom; Ranger → Verdant Ranger; Siege Warden → Grove Warden; Eternal Warden → Grove Eternal
- **Tinker's Grimoire**: standard trees, DMG cap +2 per upgrade instead of +1. Exclusive: Iron Revenant (built at Workshop, not raised; no tether cost; Sanctuary-only defender)

---

### SKELETON WARRIOR TREE

**Base:** HP 6, DMG 3, DEF 0, Move 3, Tether 1. No ability.

#### Standard branches (Pale Codex, Verdant Rite, Tinker)

**Tier 2A — Death Knight**
Stats: HP 8, DMG 4, DEF 1, Move 3
Ability choice: `bone_shield` (reactive — negates damage from one hit, once per encounter) OR `intimidate` (active — adjacent enemies lose 1 AP next turn, once per encounter)

**Tier 2B — Grave Archer**
Stats: HP 5, DMG 3, DEF 0, Move 3, Range 2
Ability choice: `true_aim` (passive — attacks ignore cover and shadow bonuses) OR `volley` (active — hits all units in a straight line up to range, hits friendlies, once per encounter)

**Tier 3 from Death Knight — Dread Knight**
Stats: HP 12, DMG 5, DEF 2, Move 3
Upgrades: `bone_shield` → `fortress_shell` (reactive — negates damage AND reflects 2dmg to attacker) OR `intimidate` → `fear_aura` (passive — adjacent enemies always have -1 AP at turn start while alive)

**Tier 3 from Grave Archer — Shadow Archer**
Stats: HP 6, DMG 4, DEF 0, Move 3, Range 3. Silent attacks generate no noise.
Upgrades: `true_aim` → `ghost_arrow` (passive — attacks ignore DEF in addition to cover) OR `volley` → `rain_of_arrows` (active — hits 3-tile radius circle, hits friendlies, once per encounter)

#### Whispers of the Flesh replacements

**Tier 2A — Flesh Knight** (replaces Death Knight)
Stats: HP 10, DMG 4, DEF 1, Move 3
Ability choice: `drain_touch` (passive — melee attacks restore 1hp to self) OR `rend` (active — permanently reduces target DEF by 1, once per encounter)

**Tier 2B — Bone Berserker** (replaces Grave Archer — melee only, no ranged)
Stats: HP 7, DMG 5, DEF 0, Move 4
Ability choice: `bloodlust` (passive — +1 DMG per kill this encounter, resets next encounter) OR `frenzy` (active — attacks twice at DMG -1 each, once per encounter)

**Tier 3 from Flesh Knight — Flesh Warden**
Stats: HP 15, DMG 5, DEF 2, Move 3
Upgrades: `drain_touch` → `consume` (active — one attack restores HP equal to full damage dealt, once per encounter) OR `rend` → `devour` (active — reduces DEF by 2 AND restores 2hp to self, once per encounter)

**Tier 3 from Bone Berserker — Chaos Knight**
Stats: HP 9, DMG 7, DEF 0, Move 4
Upgrades: `bloodlust` → `carnage` (passive — +1 DMG and +1 Move per kill, both reset next encounter) OR `frenzy` → `rampage` (active — moves through line of enemies dealing DMG -1 to each, once per encounter)

#### Verdant Rite replacements

**Tier 2A — Verdant Knight** (replaces Death Knight)
Stats: HP 8, DMG 4, DEF 1, Move 4
Ability choice: `thornmail` (passive — attackers take 1dmg when hitting in melee) OR `overgrowth_strike` (active — attack applies Slow for 1 turn, once per encounter)

**Tier 2B — Verdant Archer** (replaces Grave Archer)
Stats: HP 5, DMG 3, DEF 0, Move 4, Range 3
Ability choice: `entangling_shot` (active — ranged attack applies Root for 1 turn, once per encounter) OR `scatter_shot` (active — fires at up to 3 targets in range at DMG -1 each, once per encounter)

**Tier 3 from Verdant Knight — Grove Champion**
Stats: HP 12, DMG 5, DEF 2, Move 4
Upgrades: `thornmail` → `briarwall` (passive — attackers take 2dmg and are Slowed 1 turn) OR `overgrowth_strike` → `stranglehold` (active — applies Bind AND +1dmg, once per encounter)

**Tier 3 from Verdant Archer — Grove Warden**
Stats: HP 7, DMG 4, DEF 0, Move 4, Range 3
Upgrades: `entangling_shot` → `thornfield` (active — Slow terrain in 3-tile radius for 3 turns, enemies take 1dmg on entry, once per encounter) OR `scatter_shot` → `barrage` (active — fires at all visible enemies in range at DMG -1, no target limit, once per encounter)

#### Tinker exclusive

**Iron Revenant** — Built at Workshop (not raised). Costs iron + bone + one sacrifice unit.
Stats: HP 12, DMG 4, DEF 2, Move 2. No tether cost. Cannot go on missions or expeditions. Assigned to Sanctuary nodes at 1.5x production. Defends Sanctuary during raids.
Ability: `construct_armor` (reactive — first hit each encounter reduced to 1dmg regardless of source)

---

### GRAVE STALKER TREE

**Base:** HP 4, DMG 2, DEF 0, Move 4, TrapReveal 3, Tether 1. No ability.

#### Standard branches (Pale Codex, Whispers, Tinker)

**Tier 2A — Phantom**
Stats: HP 6, DMG 2, DEF 0, Move 4, TrapReveal 4
Ability choice: `phase` (active — pass through one wall tile, once per mission) OR `shadow_meld` (reactive — if attacked while in shadow tile, dodge automatically, once per encounter)

**Tier 2B — Ranger**
Stats: HP 5, DMG 3, DEF 0, Move 4, Range 2, TrapReveal 4
Ability choice: `ambush` (active — attack from hidden position, +1dmg, no retaliation, once per encounter) OR `tracker` (reactive — when enemy enters vision range their patrol route highlights on map, permanent once chosen)

**Tier 3 from Phantom — Wraith**
Stats: HP 8, DMG 3, DEF 0, Move 4. Untargetable in shadow tiles.
Upgrades: `phase` → `death_mark` (active — target takes double damage from all sources for 2 turns, once per encounter) OR `shadow_meld` → `incorporeal` (passive — 30% chance to dodge any hit)

**Tier 3 from Ranger — Pathfinder**
Stats: HP 6, DMG 4, DEF 0, Move 4, Range 3. Full map reveal on entry.
Upgrades: `ambush` → `superior_ambush` (active — +2dmg, no retaliation, once per encounter) OR `tracker` → `wayfinder` (passive — when leading expedition, duration reduced by 2 moves)

#### Verdant Rite replacements

**Tier 2A — Grove Phantom** (replaces Phantom)
Stats: HP 6, DMG 2, DEF 0, Move 4, TrapReveal 5. Forest tiles cost 0 move.
**Restriction:** Cannot loot, cannot interact with doors, cages, or objects. Combat and scouting only.
Ability choice: `natures_veil` (passive — invisible in forest and shadow tiles until attacking) OR `thornwall` (reactive — when attacked, attacker's tile becomes impassable for 2 turns, once per encounter)

**Tier 2B — Verdant Ranger** (replaces Ranger)
Stats: HP 5, DMG 3, DEF 0, Move 4, Range 3. Foraging yields double.
Ability choice: `entangle` (active — Roots all enemies in 2-tile radius for 1 turn, once per encounter) OR `overgrowth` (passive — enemies moving adjacent lose 1 move remaining that turn)

**Tier 3 from Grove Phantom — Grove Wraith**
Stats: HP 8, DMG 3, DEF 0, Move 4, TrapReveal 6. Untargetable in shadow. Forest movement free.
Upgrades: `natures_veil` → `vanish` (active — untargetable for 1 full turn, cannot attack while active, once per encounter) OR `thornwall` → `briarvine` (reactive — attacker Bound for 1 turn AND takes 1dmg)

**Tier 3 from Verdant Ranger — Grove Pathfinder**
Stats: HP 6, DMG 4, DEF 0, Move 4, Range 3. Full map reveal. Foraging yields triple.
Upgrades: `entangle` → `mass_entangle` (active — radius 3 tiles, Roots for 2 turns, once per encounter) OR `overgrowth` → `strangling_vines` (passive — enemies adjacent take 1dmg per turn AND lose 1 move)

---

### GRAVE WARDEN TREE

**Base:** HP 10, DMG 4, DEF 1, Move 2, Tether 1. No ability.

#### Standard branches (Pale Codex, Tinker)

**Tier 2A — Siege Warden**
Stats: HP 12, DMG 4, DEF 2, Move 2
Ability choice: `shove` (active — pushes adjacent enemy back 2 tiles, 1dmg if stopped by wall, 1dmg to both if pushed into another unit, once per encounter) OR `shield_wall` (reactive — negates all damage from next hit, once per encounter)

**Tier 2B — Eternal Warden**
Stats: HP 14, DMG 4, DEF 1, Move 2
Ability choice: `hold_the_line` (passive — adjacent friendlies take -1dmg from all sources) OR `guardian` (reactive — when adjacent friendly is targeted, intercept attack and take damage instead, once per encounter)

**Tier 3 from Siege Warden — Fortress**
Stats: HP 16, DMG 5, DEF 3, Move 2. Immune to Shove, Push, Root, Slow.
Upgrades: `shove` → `shockwave` (active — 2dmg to all adjacent enemies, pushes all back 1 tile, stuns any pushed into wall or unit for 1 turn, once per encounter) OR `shield_wall` → `immovable` (reactive — negates damage AND deals 2dmg back to attacker when triggered)

**Tier 3 from Eternal Warden — Immortal**
Stats: HP 18, DMG 4, DEF 2, Move 2. Once per encounter when HP hits 0, survives at 1hp automatically — no arming required.
Upgrades: `hold_the_line` → `bastion` (passive — adjacent friendlies take -2dmg, applies to Immortal itself) OR `guardian` → `sacrifice` (reactive — fully absorbs lethal damage targeting adjacent ally; Immortal survival triggers if this would kill it, once per encounter)

#### Whispers of the Flesh replacements

**Tier 2A — Flesh Warden** (replaces Siege Warden)
Stats: HP 16, DMG 4, DEF 1, Move 2
Ability choice: `consume` (active — melee attack restores HP equal to full damage dealt, once per encounter) OR `undying_hunger` (reactive — when lethal damage would be taken, drain 3hp from nearest living enemy and survive at that HP, once per encounter)

**Tier 2B — Flesh Eternal** (replaces Eternal Warden)
Stats: HP 18, DMG 4, DEF 1, Move 2
Ability choice: `blood_pact` (reactive — when adjacent friendly would take damage, split damage evenly between them and Flesh Eternal, once per encounter) OR `regenerate` (passive — recover 1hp per turn while in combat)

**Tier 3 from Flesh Warden — Flesh Titan**
Stats: HP 22, DMG 5, DEF 2, Move 2
Upgrades: `consume` → `devour` (active — +2dmg, restores full damage dealt as HP, permanently reduces target DEF by 1, once per encounter) OR `undying_hunger` → `death_denied` (reactive — drains from ALL living enemies in 2-tile radius when triggered, survives at combined total)

**Tier 3 from Flesh Eternal — Flesh Immortal**
Stats: HP 24, DMG 4, DEF 2, Move 2. Passive 2hp regen per turn. Once per encounter when HP hits 0, revives at 25% maxHP automatically.
Upgrades: `blood_pact` → `life_link` (reactive — fully absorbs all damage targeting adjacent ally, passive regen offsets cost, once per encounter) OR `regenerate` → `undying` (passive — recovers 2hp per turn AND revives once per encounter at 25% maxHP)

#### Verdant Rite replacements

**Tier 2A — Grove Warden** (replaces Siege Warden)
Stats: HP 12, DMG 4, DEF 1, Move 3
Ability choice: `thornfield` (active — Slow terrain in 2-tile radius for 3 turns, enemies lose 1 move on entry, friendlies unaffected, once per encounter) OR `root_strike` (reactive — when attacked in melee, attacker is Rooted for 1 turn after hit, once per encounter)

**Tier 2B — Grove Eternal** (replaces Eternal Warden)
Stats: HP 14, DMG 4, DEF 1, Move 3
Ability choice: `overgrowth` (passive — enemies moving adjacent lose 1 move remaining that turn) OR `entangle` (active — Roots all enemies in 2-tile radius for 1 turn, once per encounter)

**Tier 3 from Grove Warden — Ancient Warden**
Stats: HP 16, DMG 5, DEF 2, Move 3
Upgrades: `thornfield` → `stranglehold` (active — radius 3 tiles, lasts 5 turns, enemies take 1dmg AND are Slowed on entry, once per encounter) OR `root_strike` → `briarvine` (reactive — attacker Bound for 1 turn AND takes 1dmg when triggered)

**Tier 3 from Grove Eternal — Grove Immortal**
Stats: HP 18, DMG 4, DEF 2, Move 3
Upgrades: `overgrowth` → `living_fortress` (passive — enemies adjacent take 1dmg per turn AND lose 1 move) OR `entangle` → `mass_entangle` (active — radius 3 tiles, Roots for 2 turns, once per encounter)

#### Pale Codex exclusive

**Pale Warden** (branches from Grave Warden base, not from Siege or Eternal)
Stats: HP 7, DMG 3, DEF 0, Move 3, Tether 0.5
Ability choice: `frenzy` (active — attacks twice at DMG -1 each, once per encounter) OR `death_charge` (reactive — when HP drops below 25%, immediately moves toward nearest enemy and attacks before falling, once per encounter)
**On death:** Bone Explosion deals damage equal to `lifetime_levels` stat to all adjacent units including friendlies. Does NOT reset on rebirth — `lifetime_levels` tracks total levels accumulated across all lives.

#### Tinker exclusive additions at Tier 3

- **Tinker Fortress** gains: `overclock` (active — sacrifice 2hp to deal full DMG to all adjacent enemies simultaneously, once per encounter)
- **Tinker Immortal** gains: `failsafe` (passive — when HP hits 0, triggers survival AND deals 3dmg to all adjacent enemies)
- All Tinker trees: DMG cap applies +2 per tier upgrade instead of +1

---

## ⬜ Section 10 — Status Effects Framework
**Status: NOT STARTED**

Implement as a formal system. Per-unit effects stored as `unit.statusEffects: []`.

| ID | Effect | Notes |
|----|--------|-------|
| `root` | Cannot move; can attack and use abilities | — |
| `slow` | Move range halved (rounded down) | — |
| `bind` | Cannot move or attack; abilities usable | — |
| `stun` | Cannot move, attack, or use abilities | 1 turn only |
| `poison` | Lose X hp per turn | Standard does not affect undead; arcane variant affects all |
| `burning` | 1hp per turn; spreads to adjacent tiles each turn | — |
| `marked` | Takes +X dmg from all sources | — |
| `shielded` | Negates next X damage | — |

**Architecture:**
- Each effect is an object `{ id, duration, magnitude, sourceId }` stored in `unit.statusEffects`
- `endTurn` processes all active effects on each unit, decrements durations, removes expired
- Per-unit immunities live in the unit/class definition as `immunities: ['root', 'slow']` — do NOT hardcode globally
- No immunities assigned yet — framework only; immunities added per class definition later

**Files:** `src/data/constants.js` (STATUS enum), `src/store/gameStore.js` (endTurn processing, doMove/doAttack application), `src/components/mission/MissionMap.jsx` (status icons on units)

---

## ⬜ Section 11 — Boss Ability Pools
**Status: NOT STARTED**

Bosses are generated with one passive, one active, and one conditional ability drawn from their pools.

**Conditional abilities are NOT transferable to player units through raise** — only passive and active can be absorbed.

**Boss raised as undead:** retains passive + active, loses conditional. Raises at 60% stats. Keeps personal name and signature abilities. Stat ceiling is original boss stats, reached through leveling and promotion.

### Passive pool
`regeneration`, `pack_leader`, `armored`, `terrifying`, `undying`, `unstoppable`, `spellshield`, `swift`, `brutal`, `commanding`

| ID | Effect |
|----|--------|
| `regeneration` | Recover 2hp per turn |
| `pack_leader` | Nearby enemies +1dmg while boss lives |
| `armored` | Reduce all incoming damage by 2 |
| `terrifying` | Adjacent units lose 1 AP per turn |
| `undying` | First time HP hits 0 survive at 1hp, once |
| `unstoppable` | Immune to Bind, Root, Slow |
| `spellshield` | Immune to ability effects, raw damage only |
| `swift` | Always acts before player units |
| `brutal` | Attacks ignore DEF |
| `commanding` | On turn start, one nearby enemy gets free move toward player |

### Active pool
`war_cry`, `cleave`, `charge`, `summon`, `pinning_strike`, `whirlwind`, `rally`, `terrify`, `barrier`, `execute_order`

| ID | Effect |
|----|--------|
| `war_cry` | All enemies in range +1 move this turn |
| `cleave` | Attacks all adjacent units in one action |
| `charge` | Moves full range and attacks same action |
| `summon` | Calls 1–2 enemies from map edges |
| `pinning_strike` | Attack halves target move next turn |
| `whirlwind` | AOE hits all units within 2 tiles for half damage |
| `rally` | Heals all nearby enemies 2hp |
| `terrify` | Targeted unit cannot attack next turn |
| `barrier` | Impassable terrain on adjacent tiles for 2 turns |
| `execute_order` | One nearby enemy immediately moves and attacks player unit |

### Conditional pool (not transferable on raise)

| ID | Effect |
|----|--------|
| `last_stand` | Below 25% HP gains +2dmg and +1 move permanently |
| `enrage` | First time damaged, attacks twice per turn for 2 turns |
| `death_burst` | On death 2dmg to all adjacent |
| `sacrifice` | On low HP kills nearby enemy to restore half HP |
| `phase_shift` | Once per mission when hit for lethal damage, teleport to random tile at 1hp |

**Files:** `src/data/bosses.js` (new), `src/systems/combat.js` (boss spawn), `src/store/gameStore.js` (boss AI in endTurn)

---

## ⬜ Section 12 — Bestiary
**Status: NOT STARTED**

Accessible from main menu and Sanctuary HUD. Add Bestiary button to Sanctuary screen.

**Unlock progression:**
- Enemy type entry unlocked on first encounter (name + base stats visible)
- Enemy abilities revealed on second encounter
- Undead class entries: visible immediately (name shows, details locked until promoted to that class)
- Boss entries: unlocked on first encounter; abilities revealed on observation

**State:** Bestiary is **account-scoped, not save-slot-scoped.** Stored in a separate `bestiary` table in Supabase keyed by `user_id` only (no slot column). localStorage fallback key `sanctuary-bestiary-{userId}`. Each key is the entity id, value is `{ encounters: N, abilitiesSeen: bool }`. Loaded once on login alongside save slots; never wiped on new game.

**Reads from:** `src/data/classes.js` (single source of truth for class stats/abilities), `src/data/bosses.js` (boss pools), enemy definitions in `src/data/archetypes.js`.

**Files:** `src/data/classes.js` (new — must exist before Bestiary), `src/store/gameStore.js` (bestiary state + unlock actions), `src/components/screens/BestiaryScreen.jsx` (new)

---

## ⬜ Section 13 — Varek Achievement Abilities
**Status: NOT STARTED**

Varek gains abilities through achievements, not leveling. Track achievement conditions; fire popup on unlock.

Achievement state: `varekAchievements: {}` in persistent store. Each key is achievement id, value is `{ unlocked: bool, progress: N }`.

| Achievement | Condition | Ability Unlocked |
|------------|-----------|-----------------|
| First raise | First enemy raised | `raise` (existing — retroactive) |
| Build Soul Anchor | Build Soul Anchor at Sanctuary | `tether_pulse` (active — all undead within 3 tiles restore 1hp, once per encounter; cannot be used if last encounter was fled) |
| First village allied | First village interaction chosen ally | `pale_ward` (active — one adjacent unit takes no damage from next hit, once per encounter) |
| Destroy a village | First village destroyed | `desecrate` (active — drain hits all living in drain range simultaneously, once per mission; each additional village destroyed: +1dmg, +1 range every second village) |
| First boss raised | First boss unit raised | `mark` (active — target enemy takes +1dmg from all sources this turn, once per encounter) |
| 10 friendly units fallen in combat | Total fallen across run ≥ 10 | `reclaim` (active — raise own fallen unit within 3 turns at 50% HP, once per encounter) |
| Sanctuary fully built | All buildings placed | `phantom_sight` (active — reveals all living enemy positions on map, once per encounter) |
| Lose Sanctuary to raid | Sanctuary raided successfully by enemies | `grief` (passive — all undead +1dmg permanently for remainder of run) |
| Allied kingdom chosen | Ally choice made with a kingdom | `diplomat` (passive — envoy encounters have additional dialogue options) |
| 5 dungeons cleared | Dungeon cleared count ≥ 5 | `grave_knowledge` (passive — arcane dust found at +1 quantity per find) |
| First rebirth | First unit rebirthed | `unravel` (passive — on kill, 20% chance to automatically raise fallen enemy at degraded stats) |

Check achievement conditions after every meaningful game event (`endMission`, `endTurn`, building placement, etc.).

**Files:** `src/store/gameStore.js` (achievement state + check function), `src/components/screens/MissionScreen.jsx` / WorldUI (popup notification)

---

## ⬜ Section 14 — Pale Warden Bone Explosion Tracking
**Status: NOT STARTED**

Depends on Section 9 (class system must exist first).

- Add `lifetime_levels: 0` to Pale Warden unit definition
- Increment `lifetime_levels` by 1 on every level gain, including post-rebirth
- On Pale Warden death: deal `lifetime_levels` damage to all adjacent units (friendlies included)
- `lifetime_levels` does NOT reset on rebirth — persists to roster entry

**Files:** `src/store/gameStore.js` (level-up handler, death handler), `src/data/classes.js` (unit template)

---

---

## ⬜ Village Raid System (NEXT — requires NPC interactivity design session first)

Do NOT start until NPC interactivity is designed. Notes:
- Villages use `genAbandonedVillage` map (already in map.js)
- Building-by-building navigation: each building is a mini-encounter zone
- Requires: civilians NPC type, faction allegiance flags, loot-vs-rescue decision point
- Faction consequence: raiding a village raises raider faction hostility, reduces kingdom soldier faction hostility
- **Block condition:** NPC interactivity design must be completed in a dedicated session first

---

## ⬜ Claiming & Outpost Infrastructure (NEXT — requires reputation system first)

Do NOT start until reputation system is designed. Notes:
- After clearing a location (boss defeated), Varek can "Claim" it
- Claimed camps become Raider Outposts (resource gen, increases faction hostility)
- Claimed dungeons become Undead Waystations (safe rest, extend undead tether range)
- Requires: `reputationScore` per faction, faction hostility affecting encounter frequency and type
- **Block condition:** Reputation system design must be completed in a dedicated session first

---

## ✅ Session — Raid Mechanic + Enemy AI + Tier System (done)

**Files created:** `src/data/enemyDefs.js`, `HANDOFF.md` (this file)
**Files modified:** `abilities.js` (enemy abilities), `items.js` (FLOOR_LOOT + rare items), `bosses.js` (boss_loot), `enemies.js` (raider + animal bestiary entries), `combat.js` (tier spawn), `gameStore.js` (multiple), `WorldUI.jsx`, `MissionResultsScreen.jsx`

What was built:
- Multi-floor raids: Dungeons 5F, Raider Camps 3F, Wizard Towers 4F, Cabins 2F
- Go Deeper button on mission results; Retreat with Loot option; floor pip progress display
- Boss territorial: stays in room until player within 5 tiles
- Noise propagates to deeper floors at 40% — alerts enemies before you arrive
- Data-driven enemy config in `enemyDefs.js` — add enemies here without code changes
- Tier system: `calcEnemyTier(danger, floor, isBossFloor)` — determines enemy variant
- Raider faction: T1 Raider → T2 Veteran/Shaman/Captain → T3 Death Raider/Berserker
- AI roles: ranged kite (backs up, fires from range), support (heals wounded allies), territorial (room-hold), flanker (targets Varek)
- Enemy passives: e_bloodrage, e_enrage, e_battle_hardened, e_pack_tactics, e_battle_cry, e_alpha_presence
- Loot floor scaling: FLOOR_LOOT tables by depth; boss guaranteed rare drop via boss_loot field
- XP tier formula: T1=HP/5, T2=HP/4, T3=HP/3, Boss=HP/2, + comparison multiplier
- Bestiary 3-tier revelation: encounter 1=name, 2=stats, 3=abilities

**Adventuring parties:** Defined in `enemyDefs.js` but NOT spawning yet. Wire up after bounty threshold system exists.

---

## Implementation Order

1. ✅ **Section 1** — Movement Fix (done)
2. ✅ **Section 2** — Holy Ground (done)
3. ✅ **Section 3** — Map Generators (done)
4. ✅ **Section 4** — Enemy Placement Archetypes (done)
4b. ✅ **AP Glow** — Unit border glow by AP: green=2, yellow=1, red=0 (done)
5. ✅ **Section 5** — New Terrain Types (done)
6. ✅ **Section 6** — Objectives (done)
7. ✅ **Section 7** — Doors & Keys (done)
8. ⬜ **Section 9** — Class Promotion System (priority — do before Section 8)
9. ⬜ **Section 10** — Status Effects Framework (required by Section 9 abilities)
10. ⬜ **Section 8** — Group Ambush Behaviours
11. ⬜ **Section 11** — Boss Ability Pools
12. ⬜ **Section 12** — Bestiary (requires Section 9 classes.js)
13. ⬜ **Section 13** — Varek Achievement Abilities
14. ⬜ **Section 14** — Pale Warden Bone Explosion (requires Section 9)


---

## Phase 1 Session Update — Squad Selection Entry Point

**Status: DONE — code written and build verified**

**What was built:**
- Added `SCREEN.SQUAD_SELECT` and `src/components/screens/SquadSelectionScreen.jsx`.
- `startMission(location, mode, floor, prevNoise)` is now the universal pre-encounter entry point. It opens squad selection for scavenge, raid, deeper dungeon floors, world random encounters, village/location encounters, wizard towers, camps, cabins, crypts, and any future caller that uses `startMission`.
- Added `confirmSquad(selectedIds)` and `launchMission(...)`; only confirmed unit ids are placed into `ms.units` alongside Varek.
- Enforced squad caps: scavenge = 3 undead + Varek; raid = 6 undead + Varek.
- Varek is always shown as deployed and cannot be deselected.
- Squad UI shows roster unit name, class/tier, HP/max HP, level, weapon, armor, accessory placeholder, status, and select/deselect state.
- Added `squadPreferences` save state keyed by `locationType:mode`, remembering the last squad used for that encounter type/mode. The player can explicitly save either exact individual units or a reusable unit-type formation.
- Added Supabase migration `20260618000000_add_squad_preferences.sql` for `runs.squad_preferences`.
- Mission resolution now keeps unselected roster units out of the map while preserving them in roster state.
- Passive training: roster units below level 4 receive +1 passive XP after an encounter if alive/available; deployed survivors also receive +1 participation XP.

**Equipment preservation decision:**
- Equipped slots are treated as durable unit state. Added `preserveEquipped(previous, next)` covering `weapon`, `armor`, and future `accessory`.
- Promotion, level-2 promotion, tier-3 ascension, encounter entry/exit, rebirth/merge-by-spread, and Varek mission saveback preserve equipped items. Game operations should never clear equipment slots unless the player explicitly equips a replacement through `equipItem`.
- `accessory:null` was added to `DEFAULT_VP` and new raised units as a forward-compatible slot; no accessory items are designed yet.

**Explicitly deferred:**
- Artifact cache encounters may use different squad limits in a future phase. Do not hardcode those into Phase 1; add a cap override when artifact caches are implemented.
- No new enemy types were added in this phase, so Bestiary data did not need new entries. Future Ancient Guardians, kingdom soldiers, merchants, envoys, and NPC encounter types must use the standard Bestiary progression: first encounter name, second stats, third abilities.
- `PromotionModal.jsx`/`promotionQueue` still appears to be leftover or orphaned from the earlier promotion implementation. Not removed in Phase 1 because this phase only touched encounter entry and roster persistence.

**Balance TODOs:**
- Squad caps 3/6 are requested values, not rebalanced against current encounter density.
- Passive XP + participation XP may accelerate early level-2 promotions; review after several raids/scavenges.
- Remembered squad key currently uses `locationType:mode`; revisit if individual dungeons need separate saved squads.

---

## Phase 1 Session Update - Loot, Scavenge, Raid Split

**Status: DONE - code written and build verified**

**What was built:**
- Reworked encounter rewards so `scavenge` containers draw from material-only loot tables, while `raid` containers and enemy defeats are the source for weapons, armor, relics, artifacts, and body loot.
- Added location primary resource identity. Each visited location records a stable `locationResources[locationId]` value, biases scavenge/raid loot toward that identity, saves/loads it, and shows the resource marker after discovery on the world map and selected-location panel.
- Added scavenge noise events with positional suspicion: traps, rubble, fire, attacks, doors, and bashing can send nearby enemies to investigate the noise location. Sound through walls is reduced.
- Added scavenge hunting escalation: once more than half of enemies are alerted, enemies enter hunting state and the scavenge becomes extraction-only. Successful hunted extraction loses part of carried loot.
- Added raid gear drop behavior using the requested tier chances: tier 1 = 15%, tier 2 = 35%, tier 3 = 55%, boss = 100%. Adventurers always yield at least one body/gear result when gathered.
- Added accessory-slot artifact items: Pale Signet, Bone Talisman, Wraithveil, Draining Stone, Iron Heart, Arcane Focus, Grave Seal, and Soul Anchor Shard. These are excluded from scavenge tables and appear through raid/wizard-style sources.
- Wired several artifact effects where the current systems already had hooks: Pale Signet tether cap, Iron Heart max HP, Arcane Focus encounter uses, Wraithveil shadow benefit, Draining Stone drain bonus, and Grave Seal kill heal chance.

**Architectural decisions:**
- Scavenge/raid loot is now mode-keyed through `lootTableForMode(mode, lq, floor)`. Future encounter modes should use that instead of directly reading the legacy `LOOT`/`FLOOR_LOOT` shape.
- Location resource discovery is stored separately from visit count so UI can reveal the icon after first mission without changing existing location data generation.
- Enemy-carried gear is assigned at encounter creation and dropped from the defeated enemy state. This keeps drops inspectable and allows future factions/NPCs to get bespoke equipment pools.

**Explicitly deferred:**
- Merchant artifact trade remains pending reputation systems.
- Coal forge recipes remain pending the forge/crafting pass.
- Artifact cache encounters may use different squad limits in a future phase.
- No new enemy type entries were added in this pass. Future Ancient Guardians, kingdom soldiers, merchants, envoys, and NPC encounter types still need Bestiary entries with the standard first/second/third encounter unlock progression.
- Soul Anchor Shard is defined as an artifact but its fractional tether-cost behavior needs a dedicated tether accounting pass.

**Balance TODOs:**
- Tune scavenge noise radii, suspicious wait duration, hunting threshold, and hunted extraction loot loss.
- Tune primary-resource weighting and scavenge material quantities by floor/location type.
- Validate raid container gear rates against enemy gear-drop rates so raids do not overproduce equipment.
- Pass over artifact effects and drop frequency after artifact cache/merchant systems exist.

---

## Phase 1 Session Update - Sanctuary Unit Details

**Status: DONE - code written and build verified**

**What was built:**
- Added expandable unit details in Sanctuary roster cards.
- Details show class/tier, raise line, base race/source body, Sanctuary/mission status, HP, XP, damage, defense, movement, range, trap reveal, defense trait, equipped weapon, armor, accessory, item descriptions, and active/bonded abilities.
- Varek's Sanctuary card now displays accessory equipment as well as weapon and armor.
- Raised units now persist `baseRace` from the fallen enemy name at raise time. Existing saves fall back to the original `Risen/Broken ...` class label when available, otherwise display `Unknown`.
- Equip modal now includes accessory/artifact items and detects current accessory holders.

**Architectural decisions:**
- `baseRace` is intentionally separate from `dc`/`baseClass`: `dc` remains the undead raise line, while `baseRace` preserves the original body/source for future armor refitting rules.
- Rebirth, promotion, and merge continue to preserve `baseRace` through object spread, so refit eligibility can track the original raised body even after class changes.

**Explicitly deferred:**
- Armor refitting rules and restrictions are still future work.
- Older promoted units from saves that no longer have a `Risen/Broken ...` class label cannot be perfectly backfilled; they display `Unknown` until a migration/backfill strategy is designed.

**Balance TODOs:**
- None for this UI/data-tracking pass.

---

## Phase 1 Session Update - Encounter Map Visual Rework

**Status: IN PROGRESS - Prompt B priority items 1-3 complete; build verified**

**What was built:**
- Completed Prompt B priority item 1: wall icons now render for every encounter theme instead of plain black walls. Dungeon, camp, wizard tower, forest, cave, village, battlefield, ruins, swamp, crypt, cabin, and plains each have distinct wall visuals.
- Completed Prompt B priority item 2: encounter maps now pass through `prepareEncounterMap(...)`, which clears a 4x4 player spawn area, removes traps/special tiles around the entry radius before units are placed, and shows a subtle safe-zone tint for the first two turns.
- Completed Prompt B priority item 3: exits are now themed and repositioned by location type through exit metadata on `TILE.EXIT` tiles.
- Raider camps use a bottom-edge camp gate, wizard towers use a teleport circle, villages/cabins use entrance-style exits, forests/battlefields get multiple edge exits, multi-floor dungeons/crypts use descending stair icons before final-floor exits, and cave-style locations have cave-mouth exits ready for the future cave system.
- Mission logs now use the themed exit label/icon when a unit reaches an exit.

**Architectural decisions:**
- Exit variety is implemented as metadata on existing `TILE.EXIT` tiles rather than adding new tile constants. This preserves current movement, extraction, mission-result, and deeper-floor flows while changing placement and presentation.
- Map generators remain mostly untouched; a centralized post-generation preparation pass applies spawn safety and exit theming consistently across existing and future generators.

**Explicitly deferred:**
- Prompt B priority items 4-8 are still deferred: enemy spawn distance expansion, full floor tile theming, staircase confirmation prompt before descent, room connectivity validation, and objective placement distance validation.
- Full sprite art pass remains deferred until systems stabilize.
- Animated tile effects such as torch flicker and water movement are deferred.
- Unit sprites replacing emoji/icons remain deferred.

**Balance TODOs:**
- Verify that the new centralized exit placement does not make objectives too easy or too far away for each generator.
- Verify forest/battlefield multi-edge extraction behavior in playtests.
- Tune spawn safe-zone size if the first two turns feel too protected or too exposed.

