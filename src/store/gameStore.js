import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_VP, UT, TILE, UNAMES } from '../data/constants';
import { item, LOOT, BODY_LOOT } from '../data/items';
import { genMap, genDungeonMap, genCabinMap, genForest, genRuinedTown, genRaiderCamp, genSwamp, genBattlefield, genAbandonedVillage, revealTraps, walkable, hasLOS, dist, bfsPath as bfsGridPath } from '../systems/map';
import { spawnEnemies, applyXpToUnits } from '../systems/combat';
import { ARCHETYPES } from '../data/archetypes';
import { generateWorld, revealAround } from '../world/worldGen';
import { hexesInRange } from '../world/hexMath';
import { TERRAIN, rollWildEncounter, rollForageLoot } from '../world/tileTypes';
import { bfsPath } from '../world/hexMath';
import { BUILDINGS } from '../data/buildings';
import { generateObjective } from '../systems/objectives';
import { saveRun, saveBestiary, loadBestiary } from '../lib/persistence';
import { CLASSES, isPromotionEligible } from '../data/classes';
import { ABILITIES } from '../data/abilities';
import { spawnBoss } from '../data/bosses';

// Debounced save — calls get() at fire time to capture most recent state
let _saveTimer = null
function debouncedSave(get) {
  clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    const state = get()
    const { currentUser, activeSlot } = state
    if (activeSlot) saveRun(state, currentUser?.id ?? null, activeSlot)
  }, 1500)
}

export const useGameStore = create(
  subscribeWithSelector(
  persist(
    (set, get) => ({
      // ── Persistent state ──────────────────────────────────────────────
      screen:       'home',
      book:         null,
      vp:           { ...DEFAULT_VP },
      roster:       [],
      inv:          {},
      nodes:        [],
      ms:           null,
      noise:        0,
      luq:          [],
      log:          [],
      phase:        'player',
      equipTgt:     null,
      loc:          null,
      mode:         'scavenge',
      unlockedLocs: ['town'],
      // ── World map ─────────────────────────────────────────────────────
      world:                 null,  // { seed, tiles, width, height }
      worldPos:              null,  // { col, row } — Varek on world map
      sanctuaryPos:          null,  // { col, row }
      selectedHex:           null,  // { col, row } — UI selection
      pendingSanctuaryTile:  null,  // { col, row } — awaiting confirmation
      worldPath:             [],    // [{ col, row }] — movement queue
      // ── Inventory split ───────────────────────────────────────────────
      travelBag:    {},     // loot Varek carries on the world map
      // ── Sanctuary grid ────────────────────────────────────────────────
      sanctuaryGrid: null,  // { width, height, tiles[] } — initialized on first map view
      // ── Auth & save slots ─────────────────────────────────────────────
      currentUser:  null,   // { id, email } from Supabase
      saveSlots:    [],     // summary rows for the home screen
      activeSlot:   null,   // 1 | 2 | 3
      // ── Promotion queue ───────────────────────────────────────────────
      promotionQueue: [],   // [{ unit, level }] — resolved on WorldScreen after mission
      // ── Location visit tracking ───────────────────────────────────────
      locationVisits: {},   // { [locId]: { visits: N, bossDefeated: bool } }
      // ── Bestiary (account-scoped — never wiped on resetGame) ──────────
      bestiary: {},         // { [entityId]: { encounters: N, abilitiesSeen: bool } }

      // ── Simple setters ────────────────────────────────────────────────
      setScreen:   (screen)   => set({ screen }),
      setEquipTgt: (id)       => set({ equipTgt: id }),
      setPhase:    (phase)    => set({ phase }),

      addLog: (msg) => set(s => ({ log: [msg, ...s.log].slice(0, 14) })),

      // ── Tether info (helper) ─────────────────────────────────────────
      // fieldCap = baseCap = tetherCap. Total roster cap = tetherCap * 2.
      ti(mUnits) {
        const { vp, roster } = get();
        const fieldCap = vp.tetherCap;
        const baseCap  = vp.tetherCap;
        const cap      = fieldCap + baseCap;

        let baseCount, fieldCount;
        if (!mUnits) {
          // Sanctuary view: use atBase flag on roster directly
          baseCount  = roster.filter(u => u.atBase).length;
          fieldCount = roster.filter(u => !u.atBase).length;
        } else {
          // Mission view: roster not in mission = at sanctuary
          const mIds = new Set(mUnits.filter(u => u.type === UT.UNDEAD).map(u => u.id));
          baseCount  = roster.filter(u => !mIds.has(u.id)).length;
          fieldCount = mUnits.filter(u => u.type === UT.UNDEAD && !u.fallen).length;
        }

        const used = baseCount + fieldCount;
        return { cap, used, free: cap - used, fieldCap, baseCap, fieldCount, baseCount };
      },

      // ── Mission lifecycle ─────────────────────────────────────────────
      startMission(location, md) {
        const { vp, roster, locationVisits, bestiary } = get();
        const danger  = location.danger ?? 1;
        const locId   = location.id ?? '';
        const locType = location.type ?? '';
        // Pick generator + map size by location type / id prefix
        let mapFn, mapW, mapH;
        if      (locType==='dungeon'||locId.startsWith('dungeon_'))  { mapFn=genDungeonMap;       mapW=18+Math.floor(Math.random()*9);  mapH=12+Math.floor(Math.random()*7); }
        else if (locType==='cabin')                                   { mapFn=genCabinMap;         mapW=16; mapH=12; }
        else if (locId.startsWith('wild_forest'))                     { mapFn=genForest;           mapW=22; mapH=18; }
        else if (locId.startsWith('wild_ruins')||locId.startsWith('ruined_')) { mapFn=genRuinedTown; mapW=20; mapH=16; }
        else if (locId.startsWith('wild_swamp'))                      { mapFn=genSwamp;            mapW=20; mapH=16; }
        else if (locType==='camp')                                    { mapFn=genRaiderCamp;       mapW=18; mapH=14; }
        else if (locType==='village')                                 { mapFn=genAbandonedVillage; mapW=18; mapH=16; }
        else if (locType==='battlefield')                             { mapFn=genBattlefield;      mapW=24; mapH=18; }
        else                                                          { mapFn=genMap;              mapW=16+Math.floor(Math.random()*7); mapH=12+Math.floor(Math.random()*5); }
        const spawnX = 1, spawnY = mapH - 2;
        const tiles  = mapFn(danger, mapW, mapH);
        const varek = {
          id:'varek', type:UT.VAREK, name:'Varek', emoji:'🧙',
          x:spawnX, y:spawnY, ...vp,
          moveRange: vp.moveRange || 3,
          trapReveal: vp.trapReveal || 1,
          ap:2, fallen:false, raiseTurn:null,
          statusEffects: [],
        };
        const activeUndead = roster
          .filter(u => !u.atBase)
          .map((u, i) => ({
            ...u, x:spawnX+1+i, y:spawnY, ap:2, fallen:false, raiseTurn:null, atBase:false,
            // Reset per-encounter state
            statusEffects: [],
            abilityUses: u.classAbility
              ? { [u.classAbility]: ABILITIES[u.classAbility]?.usesPerEncounter ?? 0 }
              : {},
            abilityArmed: ABILITIES[u.classAbility]?.type === 'reactive' ? true : false,
            encounterKills: 0,
            encounterBonusDmg: 0,
            encounterBonusMove: 0,
            surviveUsed: false,
          }));
        // ── Visit tracking ─────────────────────────────────────────────
        const visitInfo    = locationVisits[locId] ?? { visits: 0, bossDefeated: false };
        const newVisitCount = visitInfo.visits + 1;
        const newLocationVisits = {
          ...locationVisits,
          [locId]: { ...visitInfo, visits: newVisitCount },
        };

        // ── Enemy spawn ────────────────────────────────────────────────
        const enemies = locType === 'battlefield' ? [] : spawnEnemies(danger, md, tiles, spawnX, spawnY, location.threats ?? null, locType);

        // ── Boss spawn: dungeon/camp on 3rd+ visit, once per location ──
        const bossLocTypes = ['dungeon', 'camp'];
        const isBossLocation = bossLocTypes.some(t => locType === t || locId.startsWith(t));
        const shouldSpawnBoss = isBossLocation && newVisitCount >= 3 && !visitInfo.bossDefeated;
        const boss = shouldSpawnBoss ? spawnBoss(danger, tiles, spawnX, spawnY, locType || 'dungeon') : null;

        const objective = generateObjective(locType || 'default', tiles, enemies, danger);
        // Mark the target loot tile on the map for loot_named objectives
        const missionTiles = (objective.type === 'loot_named' && objective.targetX !== undefined)
          ? tiles.map((row, y) => row.map((t, x) =>
              x === objective.targetX && y === objective.targetY ? { ...t, marked: true } : t))
          : tiles;
        // Assign key items to guard enemies for each locked door in the map
        const lockedKeyIds = [];
        missionTiles.forEach(row => row.forEach(t => {
          if (t.type === TILE.DOOR && t.locked && t.keyId) lockedKeyIds.push(t.keyId);
        }));
        let missionEnemies = [...enemies, ...(boss ? [boss] : [])];
        lockedKeyIds.forEach(keyId => {
          const eligible = missionEnemies.filter(e => !e.holdsKey && !e.sleeping && !e.isBoss);
          if (!eligible.length) return;
          const tgt = eligible[Math.floor(Math.random() * eligible.length)];
          missionEnemies = missionEnemies.map(e => e.id === tgt.id ? { ...e, holdsKey: true, keyId } : e);
        });

        // ── Bestiary: unlock enemy entries on first/second encounter ──
        const seenDcs = [...new Set(enemies.map(e => e.dc).filter(Boolean))];
        const newBestiary = { ...bestiary };
        seenDcs.forEach(dc => {
          const prev2 = newBestiary[dc] ?? { encounters: 0, abilitiesSeen: false };
          newBestiary[dc] = { encounters: prev2.encounters + 1, abilitiesSeen: prev2.encounters >= 1 };
        });
        if (boss) {
          const pb = newBestiary[boss.bossType] ?? { encounters: 0, abilitiesSeen: false };
          newBestiary[boss.bossType] = { encounters: pb.encounters + 1, abilitiesSeen: pb.encounters >= 1 };
        }

        const initialUnits = [varek, ...activeUndead, ...missionEnemies];
        const revealedTiles = revealTraps(missionTiles, initialUnits);
        const bossLog = boss ? [`⚠️ A powerful presence stirs — ${boss.name} lurks within!`] : [];
        set({
          ms:    { tiles:revealedTiles, units:initialUnits, turn:1, loot:[], keys:[], width:mapW, height:mapH, objective, locationId:locId },
          noise: md === 'raid' ? 30 : 0,
          loc:   location,
          mode:  md,
          luq:   [],
          log:   [...bossLog, `${location.name} — ${md==='raid'?'Raid: enemies alerted.':'Scavenge: stay quiet.'}`, `◼ ${objective.label}`],
          phase: 'player',
          screen:'mission',
          locationVisits: newLocationVisits,
          bestiary: newBestiary,
        });
      },

      endMission(units, loot, success = false) {
        const { roster, vp, inv, travelBag, sanctuaryGrid, ms: currentMs, locationVisits, bestiary } = get();
        const objective = currentMs?.objective ?? null;

        // ── Objective outcome ─────────────────────────────────────────────
        const CRITICAL = ['eliminate', 'loot_named', 'survive'];
        let finalLoot = [...loot];
        let varekXpBonus = 0;
        const objLogs = [];

        if (success && objective) {
          if (objective.complete) {
            varekXpBonus = 5;
            objLogs.push(`⭐ Objective complete — Varek +5 XP.`);
          } else if (CRITICAL.includes(objective.type)) {
            // Randomly drop roughly half the mission loot as a failure penalty
            const before = finalLoot.length;
            finalLoot = finalLoot.filter(() => Math.random() > 0.5);
            const dropped = before - finalLoot.length;
            objLogs.push(dropped > 0
              ? `✗ Objective failed — lost ${dropped} item${dropped !== 1 ? 's' : ''} in the chaos.`
              : `✗ Objective failed.`);
          }
        }

        // ── Unit / roster resolution ──────────────────────────────────────
        const surv  = units.filter(u => u.type === UT.UNDEAD && !u.fallen);
        const luqExtra = [];
        let varek = units.find(u => u.id === 'varek');

        if (varek && varekXpBonus > 0) {
          const updated = applyXpToUnits([varek], 'varek', varekXpBonus, luqExtra);
          varek = updated[0];
        }

        const newVp = varek
          ? { ...vp, hp:varek.hp, xp:varek.xp, level:varek.level, raiseRange:varek.raiseRange,
              drainRange:varek.drainRange, tetherCap:varek.tetherCap,
              moveRange:varek.moveRange||3, weapon:varek.weapon, armor:varek.armor }
          : vp;
        const newRoster = [...roster.filter(u => u.atBase), ...surv.map(u => ({ ...u, atBase:false }))];

        // Scan for promotion-eligible survivors
        const bookId = get().book?.id ?? 'pale';
        const newPromotions = newRoster
          .filter(u => isPromotionEligible(u, bookId))
          .map(u => ({
            unit: u,
            level: (u.level >= 5 && u.classId) ? 5 : 2,
          }));

        // Loot goes into travelBag — Varek carries it; must return to Sanctuary to deposit
        const newBag = { ...travelBag };
        finalLoot.forEach(id => { newBag[id] = (newBag[id]||0) + 1; });

        // Node yields — count placed tiles; each farm=2 food, each quarry=2 iron
        const newInv = { ...inv };
        const logs = [...objLogs];
        const farmCount   = sanctuaryGrid?.tiles?.filter(t => t.building === 'farm')?.length ?? 0;
        const quarryCount = sanctuaryGrid?.tiles?.filter(t => t.building === 'quarry')?.length ?? 0;
        if (farmCount > 0)   { newInv.food = (newInv.food||0)+farmCount*2; logs.push(`🌱 ${farmCount} farm${farmCount!==1?'s':''} yield${farmCount===1?'s':''} ${farmCount*2} food.`); }
        if (quarryCount > 0) { newInv.scrap_iron = (newInv.scrap_iron||0)+quarryCount*2; logs.push(`⛏ ${quarryCount} quarr${quarryCount!==1?'ies':'y'} yield${quarryCount===1?'s':''} ${quarryCount*2} scrap iron.`); }

        if (success) logs.push(`✓ Secured ${finalLoot.length} item${finalLoot.length!==1?'s':''} — return to Sanctuary to deposit.`);

        // ── Boss kill: mark location cleared, unlock bestiary abilities ──
        const killedBoss = units.find(u => u.isBoss && u.fallen);
        const locId2 = currentMs?.locationId;
        const newLocationVisits = killedBoss && locId2
          ? { ...locationVisits, [locId2]: { ...(locationVisits[locId2] ?? {}), bossDefeated: true } }
          : locationVisits;
        const newBestiary = { ...bestiary };
        if (killedBoss) {
          const pb = newBestiary[killedBoss.bossType] ?? { encounters: 1, abilitiesSeen: false };
          newBestiary[killedBoss.bossType] = { ...pb, abilitiesSeen: true };
          logs.push(`💀 ${killedBoss.name} defeated — bestiary updated.`);
        }

        set(s => ({
          vp:newVp, roster:newRoster, inv:newInv, travelBag:newBag,
          luq: [...s.luq, ...luqExtra],
          promotionQueue: [...s.promotionQueue, ...newPromotions],
          locationVisits: newLocationVisits,
          bestiary: newBestiary,
          ms:null, worldPath:[], screen:'world',
          log: [...logs, ...s.log].slice(0, 14),
        }));
        debouncedSave(get);
        const { currentUser: cu } = get();
        if (Object.keys(newBestiary).length) saveBestiary(newBestiary, cu?.id ?? null);
      },

      // Apply a class promotion to a roster unit (called from PromotionModal)
      applyPromotion(unitId, classId, abilityId) {
        const cls = CLASSES[classId];
        if (!cls) return;
        const ab = ABILITIES[abilityId];
        set(s => {
          const newRoster = s.roster.map(u => {
            if (u.id !== unitId) return u;
            const promotedName = `${u.pname} the ${cls.name}`;
            return {
              ...u,
              cls:           cls.name,
              classId:       cls.id,
              emoji:         cls.emoji,
              name:          promotedName,
              // Full stat replacement
              hp:            cls.stats.hp,
              maxHp:         cls.stats.hp,
              dmg:           cls.stats.dmg,
              def:           cls.stats.def ?? 0,
              moveRange:     cls.stats.move,
              attackRange:   cls.stats.range ?? 1,
              trapReveal:    cls.stats.trapReveal ?? 1,
              // Class flags
              silentAttacks:       cls.silentAttacks ?? false,
              untargetableInShadow:cls.untargetableInShadow ?? false,
              cannotInteract:      cls.cannotInteract ?? false,
              forestCostZero:      cls.forestCostZero ?? false,
              fullMapRevealOnEntry:cls.fullMapRevealOnEntry ?? false,
              boneExplosion:       cls.boneExplosion ?? false,
              surviveOnce:         cls.surviveOnce ?? false,
              regenPerTurn:        cls.regenPerTurn ?? 0,
              immunities:          cls.immunities ?? [],
              // Ability
              classAbility:  abilityId,
              abilityUses:   { [abilityId]: ab?.usesPerEncounter ?? 0 },
              abilityArmed:  ab?.type === 'reactive',
              // Per-encounter counters reset
              encounterKills: 0, encounterBonusDmg: 0, encounterBonusMove: 0,
              surviveUsed: false,
              // Bone Explosion tracking
              lifetime_levels: u.lifetime_levels ?? u.level ?? 1,
            };
          });
          // Remove only the first matching entry from the queue
          const idx = s.promotionQueue.findIndex(p => p.unit.id === unitId);
          const trimmedQueue = idx >= 0
            ? [...s.promotionQueue.slice(0, idx), ...s.promotionQueue.slice(idx + 1)]
            : s.promotionQueue;

          const pname = newRoster.find(u => u.id === unitId)?.pname ?? '?';
          return {
            roster: newRoster,
            promotionQueue: trimmedQueue,
            log: [`${cls.emoji} ${pname} promoted to ${cls.name}!`, ...s.log].slice(0, 14),
          };
        });
        debouncedSave(get);
      },

      resetGame() {
        set({ screen:'home', book:null, vp:{ ...DEFAULT_VP }, roster:[], inv:{},
          nodes:[], ms:null, noise:0, luq:[], log:[], phase:'player',
          equipTgt:null, loc:null, mode:'scavenge', unlockedLocs:['town'],
          world:null, worldPos:null, sanctuaryPos:null, selectedHex:null,
          pendingSanctuaryTile:null, worldPath:[], travelBag:{},
          sanctuaryGrid:null, activeSlot:null, promotionQueue:[],
          locationVisits:{} });
        // bestiary intentionally NOT cleared — it is account-scoped
      },

      // ── World map ─────────────────────────────────────────────────────
      initWorld(seed) {
        const s = seed ?? (Math.random() * 0xFFFFFFFF) | 0;
        const world = generateWorld(s);
        // Start at center, reveal 3-hex radius
        const startCol = Math.floor(world.width / 2);
        const startRow = Math.floor(world.height / 2);
        // Find nearest passable tile to center
        let col = startCol, row = startRow;
        if (!TERRAIN[world.tiles[row * world.width + col]?.terrain]?.passable) {
          for (const n of hexesInRange(startCol, startRow, 3, world.width, world.height)) {
            if (TERRAIN[world.tiles[n.row * world.width + n.col]?.terrain]?.passable) {
              col = n.col; row = n.row; break;
            }
          }
        }
        const revealedTiles = revealAround(world.tiles, col, row, 3, hexesInRange, world.width, world.height);
        set({ world:{ ...world, tiles:revealedTiles }, worldPos:{ col, row }, sanctuaryPos:null, selectedHex:null, screen:'world' });
        // Save immediately so the world record exists from day one of a new game
        debouncedSave(get);
      },

      // Show confirmation panel before committing sanctuary placement
      requestSanctuaryPlacement(col, row) {
        const { world } = get();
        if (!world) return;
        const tile = world.tiles[row * world.width + col];
        if (!tile || tile.fog === 'hidden' || !TERRAIN[tile.terrain]?.passable) return;
        set({ pendingSanctuaryTile:{ col, row }, selectedHex:{ col, row } });
      },

      confirmSanctuaryPlacement() {
        const { world, pendingSanctuaryTile: p } = get();
        if (!world || !p) return;
        const newTiles = world.tiles.map(t =>
          t.col === p.col && t.row === p.row ? { ...t, hasSanctuary:true } : t
        );
        const newTiles2 = revealAround(newTiles, p.col, p.row, 3, hexesInRange, world.width, world.height);
        set(s => ({
          world:{ ...world, tiles:newTiles2 },
          sanctuaryPos:{ col:p.col, row:p.row },
          worldPos:{ col:p.col, row:p.row },
          pendingSanctuaryTile:null, selectedHex:null,
          log:['⌂ Sanctuary established. The work begins.', ...s.log].slice(0,14),
        }));
        debouncedSave(get);
      },

      cancelSanctuaryPlacement() { set({ pendingSanctuaryTile:null, selectedHex:null }); },

      // Queue a path; WorldMapView steps through it
      setWorldPath(path) { set({ worldPath: path ?? [] }); },

      // Called each auto-step from WorldMapView. Returns { encounter } or null.
      consumeStep() {
        const { world, worldPath } = get();
        if (!world || !worldPath.length) { set({ worldPath:[] }); return null; }

        const [next, ...rest] = worldPath;
        const tile = world.tiles[next.row * world.width + next.col];
        if (!tile) { set({ worldPath:[] }); return null; }

        const newTiles = revealAround(world.tiles, next.col, next.row, 3, hexesInRange, world.width, world.height);
        set({ world:{ ...world, tiles:newTiles }, worldPos:{ col:next.col, row:next.row }, worldPath:rest, selectedHex:null });

        // Wild encounter check
        const enc = rollWildEncounter(tile.terrain);
        if (enc) {
          set({ worldPath:[] });
          // Small delay so position updates render before mission starts
          setTimeout(() => get().startMission(enc, 'raid'), 100);
          return { encounter: enc };
        }
        return null;
      },

      moveOnWorld(col, row) {
        const { world, worldPos } = get();
        if (!world || !worldPos) return;
        const tile = world.tiles[row * world.width + col];
        if (!tile || tile.fog === 'hidden' || !TERRAIN[tile.terrain]?.passable) return;
        // Single-step: just move directly (WorldMapView calls setWorldPath for multi-step)
        const newTiles = revealAround(world.tiles, col, row, 3, hexesInRange, world.width, world.height);
        set({ world:{ ...world, tiles:newTiles }, worldPos:{ col, row }, selectedHex:null });
        debouncedSave(get);
      },

      depositLoot() {
        const { travelBag, inv, worldPos, sanctuaryPos } = get();
        if (!sanctuaryPos || !worldPos) return;
        if (worldPos.col !== sanctuaryPos.col || worldPos.row !== sanctuaryPos.row) return;
        if (!Object.keys(travelBag).length) return;
        const newInv = { ...inv };
        Object.entries(travelBag).forEach(([id, cnt]) => { newInv[id] = (newInv[id]||0) + cnt; });
        const total = Object.values(travelBag).reduce((a,b)=>a+b,0);
        set(s => ({
          inv: newInv, travelBag:{},
          log:[`⌂ Deposited ${total} item${total!==1?'s':''} into Sanctuary.`, ...s.log].slice(0,14),
        }));
        debouncedSave(get);
      },

      selectHex(col, row) { set({ selectedHex: col != null ? { col, row } : null }); },

      // Walk the full BFS path instantly, stopping at first wild encounter
      travelTo(col, row) {
        const { world, worldPos } = get();
        if (!world || !worldPos) return;
        const tile = world.tiles[row * world.width + col];
        if (!tile || tile.fog === 'hidden' || !TERRAIN[tile.terrain]?.passable) return;
        if (worldPos.col === col && worldPos.row === row) return;
        const path = bfsPath(
          world.tiles, worldPos, { col, row },
          t => TERRAIN[t.terrain]?.passable && t.fog !== 'hidden',
          world.width, world.height
        );
        if (!path?.length) return;
        let curTiles = world.tiles;
        let finalPos = worldPos;
        let encounter = null;
        for (const step of path) {
          const stepTile = curTiles[step.row * world.width + step.col];
          if (!stepTile) break;
          curTiles = revealAround(curTiles, step.col, step.row, 3, hexesInRange, world.width, world.height);
          finalPos = { col: step.col, row: step.row };
          const enc = rollWildEncounter(stepTile.terrain);
          if (enc) { encounter = enc; break; }
        }
        set({ world: { ...world, tiles: curTiles }, worldPos: finalPos, worldPath: [] });
        console.log('[travelTo] worldPos updated →', finalPos);
        if (encounter) {
          setTimeout(() => get().startMission(encounter, 'raid'), 100);
        } else {
          debouncedSave(get);
        }
      },

      // Forage the current tile for materials; chance to discover a hidden cabin
      forageCurrentTile() {
        const { world, worldPos, travelBag } = get();
        if (!world || !worldPos) return;
        const tile = world.tiles[worldPos.row * world.width + worldPos.col];
        if (!tile) return;

        const { items: found, hiddenFind } = rollForageLoot(tile.terrain);
        const newBag = { ...travelBag };
        found.forEach(id => { newBag[id] = (newBag[id] || 0) + 1; });

        const names = found.map(id => item(id)?.name || id).join(', ');
        const logs = [`🌿 Foraged: ${names || 'nothing of use'}.`];

        let newWorld = world;
        if (hiddenFind && !tile.location) {
          const newTiles = world.tiles.map(t =>
            t.col === worldPos.col && t.row === worldPos.row
              ? { ...t, location: { type:'cabin', name:'Abandoned Cabin', danger:1, lq:'common' } }
              : t
          );
          newWorld = { ...world, tiles: newTiles };
          logs.push('🛖 You find signs of an abandoned structure. Investigate?');
        }

        set(s => ({ travelBag: newBag, world: newWorld, log: [...logs, ...s.log].slice(0, 14) }));
        debouncedSave(get);
      },

      // ── Sanctuary grid ────────────────────────────────────────────────
      initSanctuaryGrid() {
        const { nodes } = get();
        const GW = 16, GH = 10;
        const tiles = [];
        for (let row = 0; row < GH; row++)
          for (let col = 0; col < GW; col++)
            tiles.push({ col, row, type: 'ground', building: null });

        // Seed existing nodes at preset positions
        const presets = { farm:[3,4], quarry:[5,4], forge:[7,4], storage:[9,4], barracks:[11,4], workshop:[13,4] };
        for (const nodeId of nodes) {
          const pos = presets[nodeId];
          if (pos) {
            const t = tiles.find(t => t.col === pos[0] && t.row === pos[1]);
            if (t) { t.building = nodeId; t.type = 'floor'; }
          }
        }
        set({ sanctuaryGrid: { width: GW, height: GH, tiles } });
      },

      placeBuilding(col, row, buildingId) {
        const { sanctuaryGrid, inv, nodes } = get();
        if (!sanctuaryGrid) return;
        const bld = BUILDINGS.find(b => b.id === buildingId);
        if (!bld) return;

        const canAfford = Object.entries(bld.cost).every(([id, amt]) => (inv[id] || 0) >= amt);
        const { baseCount } = get().ti(null);
        const hasWorkers = baseCount >= bld.workers;
        if (!canAfford || !hasWorkers) return;
        if (bld.workerCost) {
          const existingCount = sanctuaryGrid.tiles.filter(t => t.building === buildingId).length;
          if (existingCount >= baseCount) return;
        }

        const newInv = { ...inv };
        Object.entries(bld.cost).forEach(([id, amt]) => {
          newInv[id] = (newInv[id] || 0) - amt;
          if (!newInv[id]) delete newInv[id];
        });

        const newTiles = sanctuaryGrid.tiles.map(t =>
          (t.col === col && t.row === row) ? { ...t, building: buildingId, type: 'floor' } : t
        );
        const newNodes = (!bld.multi && !nodes.includes(buildingId)) ? [...nodes, buildingId] : nodes;

        set(s => ({
          inv: newInv, nodes: newNodes,
          sanctuaryGrid: { ...sanctuaryGrid, tiles: newTiles },
          log: [`⌂ Built ${bld.name}!`, ...s.log].slice(0, 14),
        }));
        debouncedSave(get);
      },

      demolishBuilding(col, row) {
        const { sanctuaryGrid, nodes, inv } = get();
        if (!sanctuaryGrid) return;
        const tile = sanctuaryGrid.tiles.find(t => t.col === col && t.row === row);
        if (!tile?.building) return;
        const bld = BUILDINGS.find(b => b.id === tile.building);

        const newTiles = sanctuaryGrid.tiles.map(t =>
          (t.col === col && t.row === row) ? { ...t, building: null, type: 'ground' } : t
        );
        const newNodes = bld?.multi ? nodes : nodes.filter(n => n !== tile.building);
        const newInv = { ...inv };
        if (bld) Object.entries(bld.cost).forEach(([id, amt]) => {
          const ret = Math.floor(amt / 2);
          if (ret > 0) newInv[id] = (newInv[id] || 0) + ret;
        });

        set(s => ({
          nodes: newNodes, sanctuaryGrid: { ...sanctuaryGrid, tiles: newTiles }, inv: newInv,
          log: [`Demolished ${bld?.name || 'structure'} (50% back).`, ...s.log].slice(0, 14),
        }));
        debouncedSave(get);
      },

      // ── Auth ──────────────────────────────────────────────────────────
      setCurrentUser(user) {
        set({ currentUser: user });
        if (user?.id) {
          loadBestiary(user.id).then(data => {
            if (data && Object.keys(data).length) set({ bestiary: data });
          });
        }
      },
      setSaveSlots(slots)  { set({ saveSlots: slots }); },

      // ── Load a full save into the store ───────────────────────────────
      loadSaveIntoStore(data, slot) {
        set({
          vp:             data.vp              ?? { ...DEFAULT_VP },
          roster:         data.roster          ?? [],
          inv:            data.inv             ?? {},
          travelBag:      data.travel_bag      ?? {},
          nodes:          data.nodes           ?? [],
          book:           data.book            ?? null,
          world:          data.world           ?? null,
          worldPos:       data.world_pos       ?? null,
          sanctuaryPos:   data.sanctuary_pos   ?? null,
          unlockedLocs:   data.unlocked_locs   ?? ['town'],
          log:            data.log             ?? [],
          sanctuaryGrid:  data.sanctuary_grid  ?? null,
          locationVisits: data.location_visits ?? {},
          activeSlot:     slot,
          // Reset transient state
          ms: null, phase:'player', luq:[], noise:0, selectedHex:null,
          equipTgt:null, loc:null, worldPath:[], pendingSanctuaryTile:null,
          screen: data.world ? 'world' : 'title',
        });
        // Bestiary is account-scoped — load separately via loadBestiary()
      },

      // Start a brand-new game in the given slot (goes to book selection)
      newGameInSlot(slot) {
        set({
          vp:{ ...DEFAULT_VP }, roster:[], inv:{}, nodes:[], book:null,
          world:null, worldPos:null, sanctuaryPos:null, unlockedLocs:['town'],
          ms:null, phase:'player', luq:[], noise:0, log:[], selectedHex:null,
          equipTgt:null, loc:null, travelBag:{}, worldPath:[], sanctuaryGrid:null,
          pendingSanctuaryTile:null, activeSlot:slot, screen:'title',
        });
      },

      // ── Level-up ──────────────────────────────────────────────────────
      applyLu(choice) {
        set(s => {
          if (!s.luq.length) return s;
          const { uid } = s.luq[0];
          const newMs = s.ms ? {
            ...s.ms,
            units: s.ms.units.map(u => {
              if (u.id !== uid) return u;
              // Varek always gains +1 tether per level up (automatic base gain)
              const autoTether = uid === 'varek' ? 1 : 0;
              const base = { ...u, tetherCap: (u.tetherCap||1) + autoTether };
              if (choice==='tether') return { ...base, tetherCap: base.tetherCap + 1 };
              if (choice==='drain')  return { ...base, drainRange:u.drainRange+1 };
              if (choice==='hp')     return { ...base, maxHp:u.maxHp+4, hp:u.hp+4 };
              if (choice==='raise')  return { ...base, raiseRange:u.raiseRange+1 };
              if (choice==='dmg')    return { ...base, dmg:u.dmg+1, dmgUpgrades:(u.dmgUpgrades||0)+1 };
              if (choice==='move')   return { ...base, moveRange:u.moveRange+1 };
              return base;
            }),
          } : null;
          return { ms:newMs, luq:s.luq.slice(1),
            log:['Level up applied!', ...s.log].slice(0, 14) };
        });
      },

      // ── Equipment ─────────────────────────────────────────────────────
      equipItem(tgtId, iid, slot) {
        const { vp, roster, inv } = get();
        const tgt  = tgtId === 'varek' ? vp : roster.find(u => u.id === tgtId);
        const old  = tgt?.[slot];
        const newInv = { ...inv };
        if (old) newInv[old] = (newInv[old]||0) + 1;
        newInv[iid] = Math.max(0, (newInv[iid]||1) - 1);
        if (!newInv[iid]) delete newInv[iid];
        const it = item(iid);
        if (tgtId === 'varek') {
          set({ vp:{ ...vp, [slot]:iid }, inv:newInv, equipTgt:null,
            log:[`Equipped ${it?.name} on Varek.`, ...get().log].slice(0, 14) });
        } else {
          set({ roster:roster.map(u => u.id===tgtId ? { ...u, [slot]:iid } : u),
            inv:newInv, equipTgt:null,
            log:[`Equipped ${it?.name}.`, ...get().log].slice(0, 14) });
        }
      },

      // ── Raise ─────────────────────────────────────────────────────────
      doRaise(fallen) {
        const { ms, roster, book } = get();
        const varek = ms.units.find(u => u.id === 'varek');
        const { fieldCount, fieldCap } = get().ti(ms.units);
        if (fieldCount >= fieldCap)             { get().addLog('Field tether full! Return to base to expand.'); return; }
        if (dist(varek, fallen) > varek.raiseRange) { get().addLog('Too far to raise.'); return; }
        const rw    = book?.ap?.raiseWindow || 3;
        const turns = ms.turn - fallen.raiseTurn;
        if (turns > rw) { get().addLog('Too far gone.'); return; }
        const fresh  = turns <= 2;
        const usedN  = new Set([...roster.map(u => u.pname), ...ms.units.filter(u => u.type===UT.UNDEAD).map(u => u.pname)]);
        const avail  = UNAMES.filter(n => !usedN.has(n));
        const pname  = avail.length ? avail[Math.floor(Math.random()*avail.length)] : `Shade${Math.floor(Math.random()*99)}`;
        const ub     = book?.ub || null;
        const hpBase = Math.ceil(fallen.maxHp * (fresh ? 1.0 : 0.6));
        const stats  = {
          hp:          hpBase + (ub?.hp||0),
          maxHp:       hpBase + (ub?.hp||0),
          dmg:         (fresh ? fallen.dmg : Math.max(1, fallen.dmg-1)) + (ub?.dmg||0),
          def:         0,
          moveRange:   fallen.moveRange || 3,
          trapReveal:  1,
          attackRange: fallen.attackRange || 1,
        };
        const cls    = fresh ? `Risen ${fallen.name}` : `Broken ${fallen.name}`;
        const raised = {
          id:`u${Date.now()}`, type:UT.UNDEAD,
          name:`${pname} the ${cls}`, pname, cls,
          emoji: fresh ? '💀' : '🪦',
          x:fallen.x, y:fallen.y, ...stats,
          ap:0, fallen:false, raiseTurn:null, atBase:false,
          xp:0, level:1, weapon:null, armor:null, dmgUpgrades:0,
          isTinker: !!(ub?.tinker),
        };
        set(s => ({
          ms: { ...s.ms, units:[...s.ms.units.filter(u => u.id!==fallen.id), raised] },
          log: [`${varek.name} raises ${raised.name}!${!fresh?' (degraded)':''}`, ...s.log].slice(0, 14),
        }));
      },

      // ── Move (called from MissionScreen with sel + hilight Set) ───────
      doMove(x, y, sel, hilight) {
        const s = get();
        if (!sel || s.phase !== 'player') return;
        if (!hilight.has(`${x},${y}`)) return;

        const ms   = s.ms;
        const unit = ms.units.find(u => u.id === sel);

        // Status effect movement blocks
        if (unit?.statusEffects?.length) {
          const hasBind = unit.statusEffects.some(fx => fx.id === 'bind');
          const hasRoot = unit.statusEffects.some(fx => fx.id === 'root');
          const hasStun = unit.statusEffects.some(fx => fx.id === 'stun');
          if (hasBind || hasRoot || hasStun) {
            get().addLog(`${unit.name} cannot move!`);
            return;
          }
        }
        let nn     = s.noise;
        const logs = [];
        let loot   = [...ms.loot];
        let tiles  = ms.tiles.map(r => r.map(t => ({ ...t })));
        let units  = ms.units.map(u => ({ ...u }));
        let esc    = false;
        let over   = false;
        let objective = ms.objective ? { ...ms.objective } : null;
        const t    = tiles[y][x];

        if (t.type === TILE.TRAP) {
          tiles[y][x] = { type:TILE.TRAP_X };
          const roll = Math.random();
          const base = Math.max(1, 3-(unit.def||0));
          let dmg = 0;
          if      (roll < 0.02) { dmg=base*2; logs.push(`💥 Trap! CRITICAL — ${unit.name} -${dmg}hp!`); }
          else if (roll < 0.22) { dmg=0;      logs.push(`💨 Trap! ${unit.name} dodges clean — no damage!`); }
          else if (roll < 0.42) { dmg=Math.floor(base/2); logs.push(`💥 Trap! ${unit.name} grazes it — -${dmg}hp.`); }
          else                  { dmg=base;   logs.push(`💥 Trap! ${unit.name} -${dmg}hp.`); }
          nn += 20;
          units = units.map(u => u.id===sel ? { ...u, hp:u.hp-dmg, x, y, ap:u.ap-1 } : u);
          const af = units.find(u => u.id === sel);
          if (af.hp <= 0) {
            if (sel === 'varek') { over=true; logs.push('Varek falls.'); }
            else { units=units.map(u => u.id===sel ? { ...u, fallen:true, raiseTurn:ms.turn } : u); logs.push(`${unit.name} falls!`); }
          }
        } else if (t.type === TILE.LOOT) {
          tiles[y][x] = { type:TILE.LOOT_OPEN };
          const tbl = LOOT[s.loc.lq];
          const iid = tbl[Math.floor(Math.random()*tbl.length)];
          loot.push(iid);
          logs.push(`${unit.emoji} Found ${item(iid)?.emoji} ${item(iid)?.name}!`);
          nn += 5;
          units = units.map(u => u.id===sel ? { ...u, x, y, ap:u.ap-1 } : u);
          // loot_named objective: opening the marked cache completes it
          if (objective?.type === 'loot_named' && objective.targetX === x && objective.targetY === y && !objective.complete) {
            objective = { ...objective, complete: true };
            loot.push(...(objective.bonus || []));
            logs.push(`⭐ Marked cache recovered — objective complete!`);
          }
        } else if (t.type === TILE.RUBBLE) {
          nn += 3;
          units = units.map(u => u.id===sel ? { ...u, x, y, ap:u.ap-1 } : u);
          logs.push(`${unit.name} crunches through rubble...`);
        } else if (t.type === TILE.EXIT) {
          esc = true;
          logs.push(`🚪 ${unit.name} reaches the exit!`);
          if (objective && !objective.complete) {
            if (objective.type === 'survive') {
              if (ms.turn >= objective.turns) {
                objective = { ...objective, complete: true };
                loot.push(...(objective.bonus || []));
                logs.push(`⭐ Survived ${objective.turns} turns — objective complete!`);
              }
            } else if (objective.type === 'silent_bonus' && !objective.failed) {
              objective = { ...objective, complete: true };
              loot.push(...(objective.bonus || []));
              logs.push(`⭐ Silent extraction — bonus loot!`);
            } else if (objective.type === 'exit') {
              objective = { ...objective, complete: true };
            }
          }
        } else if (t.type === TILE.WATER) {
          nn += 5;
          logs.push(`${unit.name} wades through water.`);
          units = units.map(u => u.id===sel ? { ...u, x, y, ap:u.ap-1 } : u);
        } else if (t.type === TILE.FIRE) {
          logs.push(`🔥 ${unit.name} runs through fire! (-1hp)`);
          nn += 10;
          units = units.map(u => u.id===sel ? { ...u, hp:u.hp-1, x, y, ap:u.ap-1 } : u);
          const af = units.find(u => u.id === sel);
          if (af && af.hp <= 0) {
            if (sel === 'varek') { over=true; logs.push('Varek burns!'); }
            else { units=units.map(u => u.id===sel ? { ...u, fallen:true, raiseTurn:ms.turn } : u); logs.push(`${unit.name} burns!`); }
          }
        } else if (t.type === TILE.DOOR) {
          if (!t.open) {
            tiles[y][x] = { ...t, open: true };
            logs.push(`${unit.name} opens the door.`);
            units = units.map(u => u.id===sel ? { ...u, ap:u.ap-1 } : u);
          } else {
            units = units.map(u => u.id===sel ? { ...u, x, y, ap:u.ap-1 } : u);
          }
        } else {
          units = units.map(u => u.id===sel ? { ...u, x, y, ap:u.ap-1 } : u);
        }

        if (nn >= 50) {
          const was = ms.units.some(u => u.type===UT.ENEMY && u.alerted);
          units = units.map(u => u.type===UT.ENEMY ? { ...u, alerted:true } : u);
          if (!was) {
            logs.push('⚠️ Enemies alerted!');
            if (objective?.type === 'silent_bonus' && !objective.failed) {
              objective = { ...objective, failed: true };
              logs.push('✗ Silent extraction failed.');
            }
          }
        }

        tiles = revealTraps(tiles, units);

        set(prev => ({
          ms:    { ...ms, tiles, units, loot, objective },
          noise: nn,
          log:   [...logs.reverse(), ...prev.log].slice(0, 14),
        }));

        if (over) setTimeout(() => get().setScreen('gameover'), 500);
        if (esc)  setTimeout(() => get().endMission(units, loot, true), 400);
      },

      // ── Attack ────────────────────────────────────────────────────────
      doAttack(enemy, sel) {
        const s = get();
        if (!sel || s.phase !== 'player') return;
        const att = s.ms.units.find(u => u.id === sel);
        if (!att || att.ap <= 0) return;
        const range = att.type === UT.VAREK ? att.drainRange : (att.attackRange||1);
        if (dist(att, enemy) > range) { get().addLog('Too far!'); return; }

        set(prev => {
          let units     = prev.ms.units.map(u => ({ ...u }));
          let luq       = [...prev.luq];
          let objective = prev.ms.objective ? { ...prev.ms.objective } : null;
          let bonusLoot = [...prev.ms.loot];
          let newKeys   = prev.ms.keys ? [...prev.ms.keys] : [];
          const logs    = [];

          const attUnit = units.find(u => u.id === sel);
          const defUnit = units.find(u => u.id === enemy.id);
          if (!attUnit || !defUnit || defUnit.fallen) return prev;

          const weaponItem = attUnit.weapon ? item(attUnit.weapon) : null;
          const wb = weaponItem ? (weaponItem.dmg||0) : (attUnit.type===UT.UNDEAD ? -1 : 0);
          const isMelee = dist(attUnit, defUnit) <= 1;

          // Ghost Arrow / True Aim: ignore DEF
          const ignoreDef = attUnit.classAbility === 'ghost_arrow' || attUnit.classAbility === 'true_aim';
          const defVal    = ignoreDef ? 0 : (defUnit.def||0);

          // Bonus DMG from bloodlust/carnage accumulation
          const bonusDmg = attUnit.encounterBonusDmg ?? 0;

          // Marked status: +magnitude damage
          const markedFx = defUnit.statusEffects?.find(fx => fx.id === 'marked');
          const markBonus = markedFx ? (markedFx.magnitude ?? 1) : 0;

          // Ambush / Superior Ambush primed bonus (set by doAbility)
          const ambushBonus = attUnit.ambushBonus ?? 0;

          // Boss passive: armored reduces all incoming damage by 2
          const armoredReduction = defUnit.isBoss && defUnit.bossPassive === 'armored' ? 2 : 0;

          let dmg = Math.max(1, (attUnit.dmg||2) + wb + bonusDmg + ambushBonus - defVal + markBonus - armoredReduction);

          // Incorporeal: 30% dodge
          if (defUnit.classAbility === 'incorporeal' && Math.random() < 0.3) {
            logs.push(`👻 ${defUnit.name} phases through the attack!`);
            units = units.map(u => u.id === sel ? { ...u, ap:u.ap-1 } : u);
            return { ms:{ ...prev.ms, units, loot:bonusLoot, keys:newKeys, objective }, luq,
              log:[...logs, ...prev.log].slice(0,14) };
          }

          // Shielded status: negate damage
          const shieldedFx = defUnit.statusEffects?.find(fx => fx.id === 'shielded');
          if (shieldedFx) {
            const newShield = shieldedFx.magnitude - dmg;
            logs.push(`🛡 ${defUnit.name}'s shield absorbs the hit!`);
            units = units.map(u => {
              if (u.id !== enemy.id) return u;
              const newFx = newShield <= 0
                ? u.statusEffects.filter(fx => fx.id !== 'shielded')
                : u.statusEffects.map(fx => fx.id === 'shielded' ? { ...fx, magnitude: newShield } : fx);
              return { ...u, statusEffects: newFx };
            });
            units = units.map(u => u.id === sel ? { ...u, ap:u.ap-1 } : u);
            return { ms:{ ...prev.ms, units, loot:bonusLoot, keys:newKeys, objective }, luq,
              log:[...logs, ...prev.log].slice(0,14) };
          }

          // Reactive: bone_shield / shield_wall / fortress_shell / immovable / construct_armor
          const reactiveShields = ['bone_shield','shield_wall','construct_armor'];
          const reactiveReflect = ['fortress_shell','immovable'];
          const defAbility = defUnit.classAbility;
          if (defUnit.abilityArmed && defAbility) {
            if (reactiveShields.includes(defAbility) || reactiveReflect.includes(defAbility)) {
              const usesLeft = defUnit.abilityUses?.[defAbility] ?? 0;
              if (usesLeft > 0) {
                if (defAbility === 'construct_armor') {
                  dmg = 1; // reduced to 1, not fully negated
                  logs.push(`🤖 ${defUnit.name}'s Construct Armor reduces hit to 1!`);
                } else {
                  logs.push(`🛡 ${defUnit.name}'s ${ABILITIES[defAbility]?.name} triggers — hit negated!`);
                  // Reflect damage for fortress_shell / immovable
                  if (reactiveReflect.includes(defAbility)) {
                    const rfl = defAbility === 'fortress_shell' ? 2 : 2;
                    logs.push(`↩️ ${defUnit.name} reflects ${rfl} dmg!`);
                    units = units.map(u => {
                      if (u.id !== sel) return u;
                      const nh = u.hp - rfl;
                      if (nh <= 0) {
                        if (sel==='varek') { setTimeout(()=>get().setScreen('gameover'),300); return {...u,hp:0}; }
                        return {...u,hp:0,fallen:true,raiseTurn:prev.ms.turn};
                      }
                      return {...u,hp:nh};
                    });
                  }
                  units = units.map(u => u.id===sel ? {...u,ap:u.ap-1} : u);
                  units = units.map(u => u.id===enemy.id ? {
                    ...u,
                    abilityArmed:false,
                    abilityUses:{...u.abilityUses,[defAbility]:usesLeft-1},
                  } : u);
                  return { ms:{...prev.ms,units,loot:bonusLoot,keys:newKeys,objective}, luq,
                    log:[...logs,...prev.log].slice(0,14) };
                }
                units = units.map(u => u.id===enemy.id ? {
                  ...u, abilityArmed:false,
                  abilityUses:{...u.abilityUses,[defAbility]:usesLeft-1},
                } : u);
              }
            }
          }

          // Apply hit
          logs.push(`${attUnit.emoji} ${attUnit.name} → ${defUnit.name} for ${dmg}!`);
          units = units.map(u => {
            if (u.id === enemy.id) {
              const nh = u.hp - dmg;
              if (nh <= 0) { logs.push(`${defUnit.name} falls! Raise within 3 turns.`); return { ...u, hp:0, fallen:true, raiseTurn:prev.ms.turn }; }
              return { ...u, hp:nh, alerted:true };
            }
            if (u.id === sel) return { ...u, ap:u.ap-1 };
            return u;
          });

          // ── Boss conditionals triggered on taking damage ──────────────
          const bossNow = units.find(u => u.id === enemy.id && u.isBoss && !u.fallen);
          if (bossNow) {
            // enrage: first hit → attacks twice per turn for 2 turns
            if (bossNow.bossConditional === 'enrage' && !bossNow.bossCondTriggered) {
              units = units.map(u => u.id===enemy.id ? {...u, bossCondTriggered:true, enrageTurns:2} : u);
              logs.push(`💢 ${bossNow.name} Enrages!`);
            }
            // death_burst: handled in endTurn attack resolution on fall
            // sacrifice: below 25% hp → kill nearest non-boss enemy to restore half HP
            if (bossNow.bossConditional === 'sacrifice' && bossNow.hp <= Math.ceil(bossNow.maxHp * 0.25)) {
              const nearMob = units
                .filter(u => u.type===UT.ENEMY && !u.isBoss && !u.fallen)
                .sort((a,b) => dist(bossNow,a) - dist(bossNow,b))[0];
              if (nearMob) {
                const heal = Math.ceil(bossNow.maxHp / 2);
                units = units.map(u => {
                  if (u.id===enemy.id) return {...u, hp:Math.min(u.maxHp, u.hp+heal)};
                  if (u.id===nearMob.id) return {...u, hp:0, fallen:true, raiseTurn:prev.ms.turn};
                  return u;
                });
                logs.push(`🩸 ${bossNow.name} Sacrifices ${nearMob.name} to heal ${heal} HP!`);
              }
            }
          }

          // Thornwall reactive (attacker's tile becomes impassable)
          if (defUnit.abilityArmed && (defUnit.classAbility === 'thornwall' || defUnit.classAbility === 'briarvine' || defUnit.classAbility === 'briarvine_warden') && isMelee) {
            const tw = defUnit.classAbility;
            const twUses = defUnit.abilityUses?.[tw] ?? 0;
            if (twUses > 0) {
              if (tw === 'briarvine' || tw === 'briarvine_warden') {
                logs.push(`🌿 ${defUnit.name}'s Briarvine snares attacker!`);
                units = units.map(u => u.id===sel ? {
                  ...u, statusEffects:[...(u.statusEffects||[]),{id:'bind',duration:1,magnitude:1,sourceId:enemy.id}]
                } : u);
                const defNow = units.find(u=>u.id===enemy.id);
                if (defNow && !defNow.fallen) {
                  units = units.map(u=>u.id===sel ? {...u,hp:Math.max(0,u.hp-1)} : u);
                }
              } else {
                logs.push(`🌿 ${defUnit.name}'s Thornwall triggers!`);
              }
              units = units.map(u => u.id===enemy.id ? {
                ...u, abilityArmed:false, abilityUses:{...u.abilityUses,[tw]:twUses-1}
              } : u);
            }
          }

          // Thornmail / Briarwall passive: reflect on melee hit
          if (isMelee && !units.find(u=>u.id===enemy.id)?.fallen) {
            const reflectAb = defUnit.classAbility;
            if (reflectAb === 'thornmail') {
              logs.push(`🌿 ${defUnit.name}'s Thornmail: 1 dmg reflected!`);
              units = units.map(u => { if(u.id!==sel) return u; const nh=u.hp-1; return nh<=0?{...u,hp:0,fallen:true,raiseTurn:prev.ms.turn}:{...u,hp:nh}; });
            }
            if (reflectAb === 'briarwall') {
              logs.push(`🌿 ${defUnit.name}'s Briarwall: 2 dmg + Slow!`);
              units = units.map(u => { if(u.id!==sel) return u; const nh=u.hp-2; return nh<=0?{...u,hp:0,fallen:true,raiseTurn:prev.ms.turn}:{...u,hp:nh,statusEffects:[...(u.statusEffects||[]),{id:'slow',duration:1,magnitude:1,sourceId:enemy.id}]}; });
            }
          }

          // drain_touch passive: heal attacker 1hp on melee hit
          if (attUnit.classAbility === 'drain_touch' && isMelee) {
            units = units.map(u => u.id===sel ? {...u,hp:Math.min(u.maxHp,u.hp+1)} : u);
          }

          // XP
          units = applyXpToUnits(units, sel, 1, luq);
          const killed = units.find(u => u.id===enemy.id && u.fallen && u.raiseTurn===prev.ms.turn);
          if (killed) {
            const killXp = 1 + Math.floor((enemy.maxHp||5)/5);
            units = applyXpToUnits(units, sel, killXp, luq);
            if (killed.holdsKey && killed.keyId) { newKeys = [...newKeys, killed.keyId]; logs.push(`🔑 ${attUnit.name} finds a key!`); }
            if (objective?.type==='eliminate' && objective.targetId===enemy.id && !objective.complete) {
              objective = {...objective,complete:true}; bonusLoot=[...bonusLoot,...(objective.bonus||[])];
              logs.push(`⭐ Target eliminated — objective complete!`);
            }
            // bloodlust / carnage: +DMG per kill
            if (attUnit.classAbility==='bloodlust' || attUnit.classAbility==='carnage') {
              units = units.map(u => u.id===sel ? {
                ...u,
                encounterKills:(u.encounterKills||0)+1,
                encounterBonusDmg:(u.encounterBonusDmg||0)+1,
                ...(attUnit.classAbility==='carnage'?{encounterBonusMove:(u.encounterBonusMove||0)+1}:{}),
              } : u);
            }
          }

          if (attUnit.type === UT.VAREK) {
            units = units.map(u => u.id==='varek' ? { ...u, hp:Math.min(u.maxHp, u.hp+1) } : u);
            logs.push('Varek drains +1hp');
          }

          // Clear ambush prime after it fires
          if (ambushBonus > 0) {
            units = units.map(u => u.id === sel ? { ...u, ambushBonus: 0 } : u);
          }

          // Retaliate (skip if ambush / superior_ambush active)
          const surv   = units.find(u => u.id===enemy.id && !u.fallen);
          const attNow = units.find(u => u.id===sel);
          const noRetaliation = attUnit.abilityUses?.ambush === 0 || attUnit.abilityUses?.superior_ambush === 0;
          if (surv && attNow && !noRetaliation && dist(surv,attNow)<=(surv.attackRange||1) && Math.random()<0.6) {
            const ad   = attNow.armor ? (item(attNow.armor)?.def||0) : 0;
            let rdmg   = Math.max(1, (surv.dmg||2) - ad);
            // hold_the_line / bastion: reduce retaliation damage
            const protectors = units.filter(p => !p.fallen && p.type!==UT.ENEMY &&
              (p.classAbility==='hold_the_line'||p.classAbility==='bastion') && dist(p,attNow)<=1);
            if (protectors.some(p=>p.classAbility==='bastion')) rdmg = Math.max(0, rdmg-2);
            else if (protectors.length) rdmg = Math.max(0, rdmg-1);
            if (rdmg > 0) {
              logs.push(`↩️ ${surv.name} retaliates on ${attNow.name} for ${rdmg}!`);
              units = units.map(u => {
                if (u.id !== sel) return u;
                const nh = u.hp - rdmg;
                if (nh <= 0) {
                  if (sel==='varek') { setTimeout(()=>get().setScreen('gameover'),300); return {...u,hp:0}; }
                  logs.push(`${u.name} falls!`);
                  return {...u,hp:0,fallen:true,raiseTurn:prev.ms.turn};
                }
                return {...u,hp:nh};
              });
            }
          }

          return {
            ms:  { ...prev.ms, units, loot: bonusLoot, keys: newKeys, objective },
            luq,
            log: [...logs.reverse(), ...prev.log].slice(0, 14),
          };
        });
      },

      // ── Use Key ───────────────────────────────────────────────────────
      doUseKey(x, y, sel) {
        const s = get();
        if (!sel || s.phase !== 'player') return;
        const ms = s.ms;
        const unit = ms.units.find(u => u.id === sel);
        if (!unit || unit.fallen || unit.ap <= 0) return;
        const tile = ms.tiles[y]?.[x];
        if (!tile) return;
        const isCage = tile.type === TILE.CAGE;
        const isLockedDoor = tile.type === TILE.DOOR && tile.locked && !tile.open;
        if (!isCage && !isLockedDoor) return;
        const keyId = tile.keyId;
        const keys = ms.keys || [];
        if (keyId && !keys.includes(keyId)) {
          get().addLog(`🔒 You don't have the right key.`);
          return;
        }
        if (!keyId && keys.length === 0) {
          get().addLog('🔒 No key to use.');
          return;
        }
        const idx = keyId ? keys.indexOf(keyId) : 0;
        const newKeys = [...keys.slice(0, idx), ...keys.slice(idx + 1)];
        const newTiles = ms.tiles.map((row, ry) => row.map((t, rx) => {
          if (rx !== x || ry !== y) return t;
          if (isCage) return { type: TILE.FLOOR };
          return { ...t, open: true, locked: false };
        }));
        const newUnits = ms.units.map(u => u.id === sel ? { ...u, ap: u.ap - 1 } : u);
        const label = isCage ? 'Cage broken open!' : 'Door unlocked!';
        set(prev => ({
          ms: { ...prev.ms, tiles: newTiles, units: newUnits, keys: newKeys },
          log: [`🔑 ${label}`, ...prev.log].slice(0, 14),
        }));
      },

      // ── Disarm trap (2 AP, unit must be adjacent) ────────────────────
      disarmTrap(x, y, sel) {
        const s = get();
        if (!sel || s.phase !== 'player') return;
        const ms = s.ms;
        const unit = ms.units.find(u => u.id === sel);
        if (!unit || unit.fallen || unit.ap < 2) return;
        const tile = ms.tiles[y]?.[x];
        if (!tile || tile.type !== TILE.TRAP) return;
        const dx = Math.abs(unit.x - x), dy = Math.abs(unit.y - y);
        if (dx + dy !== 1) return;
        const newTiles = ms.tiles.map((row, ry) =>
          row.map((t, rx) => (rx === x && ry === y) ? { type: TILE.FLOOR } : t)
        );
        const newUnits = ms.units.map(u => u.id === sel ? { ...u, ap: u.ap - 2 } : u);
        set(prev => ({
          ms: { ...prev.ms, tiles: newTiles, units: newUnits },
          log: [`🔧 ${unit.name} disarms the trap.`, ...prev.log].slice(0, 14),
        }));
      },

      // ── Toggle reactive ability armed ────────────────────────────────
      toggleAbilityArmed(unitId) {
        set(prev => ({
          ms: {
            ...prev.ms,
            units: prev.ms.units.map(u =>
              u.id === unitId ? { ...u, abilityArmed: !u.abilityArmed } : u
            ),
          },
        }));
      },

      // ── Active ability activation ─────────────────────────────────────
      doAbility(unitId, abilityId, tx, ty, targetUnitId) {
        if (get().phase !== 'player') return;
        const ms = get().ms;
        if (!ms) return;

        set(prev => {
          let units = prev.ms.units.map(u => ({ ...u }));
          let luq   = [...prev.luq];
          const logs = [];

          const actor = units.find(u => u.id === unitId);
          if (!actor || actor.fallen) return prev;
          if (actor.ap <= 0) return prev;

          const usesLeft = actor.abilityUses?.[abilityId] ?? 0;
          if (usesLeft <= 0) return prev;

          // Ambush/superior_ambush are free primes — don't cost AP
          const freeAction = abilityId === 'ambush' || abilityId === 'superior_ambush';
          if (!freeAction) actor.ap = Math.max(0, actor.ap - 1);
          actor.abilityUses = { ...actor.abilityUses, [abilityId]: usesLeft - 1 };

          // spellshield: boss immune to ability effects — log and bail
          if (targetUnitId) {
            const aTarget = units.find(u => u.id === targetUnitId);
            if (aTarget?.isBoss && aTarget.bossPassive === 'spellshield') {
              logs.push(`🛡 ${aTarget.name}'s Spellshield blocks the ability!`);
              return { ms: { ...prev.ms, units }, log: [...logs, ...prev.log].slice(0, 14) };
            }
          }

          switch (abilityId) {
            case 'intimidate': {
              const adj = units.filter(u => u.type === UT.ENEMY && !u.fallen && dist(actor, u) <= 1);
              adj.forEach(u => { u.ap = Math.max(0, u.ap - 1); });
              logs.push(`💀 ${actor.name} Intimidates — ${adj.length} enemies lose 1 AP`);
              break;
            }
            case 'shove': {
              const t2 = units.find(u => u.id === targetUnitId);
              if (!t2 || dist(actor, t2) > 1) break;
              const sdx = Math.sign(t2.x - actor.x), sdy = Math.sign(t2.y - actor.y);
              let nx = t2.x, ny = t2.y, hitDmg = 0;
              for (let step = 0; step < 2; step++) {
                const cx = nx + sdx, cy = ny + sdy;
                const tile = prev.ms.tiles[cy]?.[cx];
                if (!tile || tile.type === TILE.WALL || (tile.type === TILE.DOOR && !tile.open)) { hitDmg = 1; break; }
                const blk = units.find(u => u.x === cx && u.y === cy && !u.fallen && u.id !== t2.id);
                if (blk) { hitDmg = 1; blk.hp = Math.max(0, blk.hp - 1); if (blk.hp <= 0) blk.fallen = true; break; }
                nx = cx; ny = cy;
              }
              t2.x = nx; t2.y = ny;
              if (hitDmg) { t2.hp = Math.max(0, t2.hp - hitDmg); if (t2.hp <= 0) t2.fallen = true; }
              logs.push(`💀 ${actor.name} shoves ${t2.name}!`);
              break;
            }
            case 'rend': {
              const t2 = units.find(u => u.id === targetUnitId);
              if (!t2 || dist(actor, t2) > (actor.attackRange||1)) break;
              const d = Math.max(1, actor.dmg - (t2.def||0));
              t2.hp = Math.max(0, t2.hp - d);
              t2.def = Math.max(0, (t2.def||0) - 1);
              if (t2.hp <= 0) { t2.fallen = true; logs.push(`${t2.name} falls!`); }
              logs.push(`💀 Rend — ${t2.name} takes ${d} dmg, DEF → ${t2.def}`);
              break;
            }
            case 'consume': case 'consume_gw': {
              const t2 = units.find(u => u.id === targetUnitId);
              if (!t2 || dist(actor, t2) > 1) break;
              const d = Math.max(1, actor.dmg - (t2.def||0));
              t2.hp = Math.max(0, t2.hp - d);
              actor.hp = Math.min(actor.maxHp, actor.hp + d);
              if (t2.hp <= 0) { t2.fallen = true; logs.push(`${t2.name} falls!`); }
              logs.push(`🩸 Consume — ${actor.name} deals ${d} and heals ${d}`);
              break;
            }
            case 'devour': {
              const t2 = units.find(u => u.id === targetUnitId);
              if (!t2 || dist(actor, t2) > 1) break;
              const d = Math.max(1, actor.dmg - (t2.def||0));
              t2.hp = Math.max(0, t2.hp - d);
              t2.def = Math.max(0, (t2.def||0) - 2);
              actor.hp = Math.min(actor.maxHp, actor.hp + 2);
              if (t2.hp <= 0) { t2.fallen = true; logs.push(`${t2.name} falls!`); }
              logs.push(`🩸 Devour — ${t2.name} takes ${d} dmg, DEF -2`);
              break;
            }
            case 'devour_titan': {
              const t2 = units.find(u => u.id === targetUnitId);
              if (!t2 || dist(actor, t2) > 1) break;
              const d = Math.max(1, actor.dmg + 2 - (t2.def||0));
              t2.hp = Math.max(0, t2.hp - d);
              t2.def = Math.max(0, (t2.def||0) - 1);
              actor.hp = Math.min(actor.maxHp, actor.hp + d);
              if (t2.hp <= 0) { t2.fallen = true; logs.push(`${t2.name} falls!`); }
              logs.push(`🩸 Devour — ${t2.name} takes ${d}, heals all`);
              break;
            }
            case 'frenzy': {
              const t2 = units.find(u => u.id === targetUnitId);
              if (!t2 || dist(actor, t2) > (actor.attackRange||1)) break;
              const d = Math.max(1, actor.dmg - 1 - (t2.def||0));
              t2.hp = Math.max(0, t2.hp - d * 2);
              if (t2.hp <= 0) { t2.fallen = true; logs.push(`${t2.name} falls!`); }
              logs.push(`⚡ Frenzy — ${t2.name} hit twice for ${d} each`);
              break;
            }
            case 'entangling_shot': {
              const t2 = units.find(u => u.id === targetUnitId);
              if (!t2 || dist(actor, t2) > (actor.attackRange||3)) break;
              const d = Math.max(1, actor.dmg - (t2.def||0));
              t2.hp = Math.max(0, t2.hp - d);
              t2.statusEffects = [...(t2.statusEffects||[]), { id:'root', duration:1, magnitude:0, sourceId:unitId }];
              if (t2.hp <= 0) { t2.fallen = true; logs.push(`${t2.name} falls!`); }
              logs.push(`🌿 Entangling Shot — ${t2.name} Rooted!`);
              break;
            }
            case 'overgrowth_strike': {
              const t2 = units.find(u => u.id === targetUnitId);
              if (!t2 || dist(actor, t2) > (actor.attackRange||1)) break;
              const d = Math.max(1, actor.dmg - (t2.def||0));
              t2.hp = Math.max(0, t2.hp - d);
              t2.statusEffects = [...(t2.statusEffects||[]), { id:'slow', duration:1, magnitude:0, sourceId:unitId }];
              if (t2.hp <= 0) { t2.fallen = true; logs.push(`${t2.name} falls!`); }
              logs.push(`🐢 Overgrowth Strike — ${t2.name} Slowed!`);
              break;
            }
            case 'stranglehold': {
              const t2 = units.find(u => u.id === targetUnitId);
              if (!t2 || dist(actor, t2) > 1) break;
              const d = Math.max(1, actor.dmg + 1 - (t2.def||0));
              t2.hp = Math.max(0, t2.hp - d);
              t2.statusEffects = [...(t2.statusEffects||[]), { id:'bind', duration:1, magnitude:0, sourceId:unitId }];
              if (t2.hp <= 0) { t2.fallen = true; logs.push(`${t2.name} falls!`); }
              logs.push(`⛓ Stranglehold — ${t2.name} Bound!`);
              break;
            }
            case 'entangle': case 'mass_entangle': case 'mass_entangle_warden': {
              const radius = abilityId === 'entangle' ? 2 : 3;
              const duration = abilityId === 'entangle' ? 1 : 2;
              const enemies = units.filter(u => u.type === UT.ENEMY && !u.fallen && dist(actor, u) <= radius);
              enemies.forEach(u => {
                u.statusEffects = [...(u.statusEffects||[]), { id:'root', duration, magnitude:0, sourceId:unitId }];
              });
              logs.push(`🌿 Entangle — ${enemies.length} enemies Rooted`);
              break;
            }
            case 'death_mark': {
              const t2 = units.find(u => u.id === targetUnitId);
              if (!t2) break;
              t2.statusEffects = [...(t2.statusEffects||[]), { id:'marked', duration:2, magnitude:3, sourceId:unitId }];
              logs.push(`🎯 Death Mark — ${t2.name} marked (+3 dmg from all sources)`);
              break;
            }
            case 'shockwave': {
              const adj = units.filter(u => u.type === UT.ENEMY && !u.fallen && dist(actor, u) <= 1);
              adj.forEach(u => {
                u.hp = Math.max(0, u.hp - 2);
                const nx = u.x + Math.sign(u.x - actor.x), ny = u.y + Math.sign(u.y - actor.y);
                const tile = prev.ms.tiles[ny]?.[nx];
                const blk = units.find(b => b.x===nx && b.y===ny && !b.fallen && b.id!==u.id);
                if (!tile || tile.type===TILE.WALL || blk) {
                  u.statusEffects = [...(u.statusEffects||[]), { id:'stun', duration:1, magnitude:0, sourceId:unitId }];
                } else { u.x = nx; u.y = ny; }
                if (u.hp <= 0) u.fallen = true;
              });
              logs.push(`💥 Shockwave — ${adj.length} enemies hit`);
              break;
            }
            case 'overclock': {
              actor.hp = Math.max(1, actor.hp - 2);
              const adj = units.filter(u => u.type === UT.ENEMY && !u.fallen && dist(actor, u) <= 1);
              adj.forEach(u => { u.hp = Math.max(0, u.hp - actor.dmg); if (u.hp <= 0) u.fallen = true; });
              logs.push(`⚡ Overclock — self -2 HP, hit ${adj.length} adj enemies`);
              break;
            }
            case 'vanish': {
              actor.vanishActive = true;
              logs.push(`👻 ${actor.name} vanishes!`);
              break;
            }
            case 'phase': {
              if (tx !== undefined && ty !== undefined) { actor.x = tx; actor.y = ty; }
              logs.push(`👻 ${actor.name} phases through!`);
              break;
            }
            case 'ambush': case 'superior_ambush': {
              actor.ambushBonus = abilityId === 'superior_ambush' ? 2 : 1;
              logs.push(`🗡 ${actor.name} primes ${abilityId === 'superior_ambush' ? 'Superior Ambush' : 'Ambush'}`);
              break;
            }
            case 'rain_of_arrows': {
              const inRange = units.filter(u => !u.fallen && u.id !== unitId && dist(actor, u) <= 3);
              inRange.forEach(u => {
                const d = Math.max(1, actor.dmg - (u.def||0));
                u.hp = Math.max(0, u.hp - d);
                if (u.hp <= 0) u.fallen = true;
              });
              logs.push(`🏹 Rain of Arrows — ${inRange.length} units hit`);
              break;
            }
            case 'barrage': {
              const inRange = units.filter(u => u.type === UT.ENEMY && !u.fallen && dist(actor, u) <= (actor.attackRange||3));
              inRange.forEach(u => {
                const d = Math.max(1, actor.dmg - 1 - (u.def||0));
                u.hp = Math.max(0, u.hp - d);
                if (u.hp <= 0) u.fallen = true;
              });
              logs.push(`🏹 Barrage — ${inRange.length} enemies hit`);
              break;
            }
            default:
              logs.push(`${actor.name} uses ${ABILITIES[abilityId]?.name ?? abilityId}`);
          }

          // Grant XP for kills caused by this ability
          const freshKills = units.filter(u => u.type === UT.ENEMY && u.fallen && u.raiseTurn === undefined);
          freshKills.forEach(k => {
            k.raiseTurn = prev.ms.turn;
            const kxp = 1 + Math.floor((k.maxHp||5)/5);
            units = applyXpToUnits(units, unitId, kxp, luq);
          });

          return {
            ms:  { ...prev.ms, units },
            luq,
            log: [...logs, ...prev.log].slice(0, 14),
          };
        });
      },

      // ── End turn (enemy AI) ──────────────────────────────────────────
      endTurn() {
        if (get().phase !== 'player') return;
        set({ phase:'enemy' });

        set(prev => {
          const ms       = prev.ms;
          const noiseMod = prev.noise < 30 ? -1 : prev.noise < 60 ? 0 : 1;
          let units      = ms.units.map(u => ({ ...u, ap:u.fallen?0:2 }));
          const logs     = [];
          let luq        = [...prev.luq];
          let objective  = ms.objective ? { ...ms.objective } : null;

          const friendlies = () => units.filter(f => f.type!==UT.ENEMY && !f.fallen);

          // ── Boss start-of-turn passives ────────────────────────────────
          units = units.map(u => {
            if (!u.isBoss || u.fallen) return u;
            let b = { ...u };
            // swift: already handled by base AP=3 on spawn; nothing extra needed
            // regeneration: handled by passive regen section below (regenPerTurn check)
            if (b.bossPassive === 'regeneration') b = { ...b, regenPerTurn: 2 };
            // swift: extra AP
            if (b.bossPassive === 'swift') b = { ...b, ap: Math.min(b.ap + 1, 3) };
            // commanding: one nearby regular enemy gets free move toward nearest friendly
            if (b.bossPassive === 'commanding') {
              const fr = friendlies();
              if (fr.length) {
                const tgt = fr.reduce((a, c) => dist(b, a) <= dist(b, c) ? a : c);
                const nearbyMobs = units.filter(m => m.type === UT.ENEMY && !m.isBoss && !m.fallen && dist(b, m) <= 3);
                if (nearbyMobs.length) {
                  const mob = nearbyMobs[0];
                  const path = bfsGridPath(ms.tiles, mob.x, mob.y, tgt.x, tgt.y, units);
                  if (path.length) {
                    const step = path[0];
                    if (walkable(ms.tiles, step.x, step.y, units)) {
                      units = units.map(m => m.id === mob.id ? { ...m, x: step.x, y: step.y, alerted: true } : m);
                    }
                  }
                }
              }
            }
            // last_stand conditional: below 25% hp → permanent buff (once)
            if (b.bossConditional === 'last_stand' && !b.bossCondTriggered && b.hp <= Math.ceil(b.maxHp * 0.25)) {
              b = { ...b, dmg: b.dmg + 2, moveRange: b.moveRange + 1, bossCondTriggered: true };
              logs.push(`💢 ${b.name} enters Last Stand! +2 DMG +1 Move.`);
            }
            // unstoppable: strip bind/root/slow at turn start
            if (b.bossPassive === 'unstoppable' && b.statusEffects?.length) {
              b = { ...b, statusEffects: b.statusEffects.filter(fx => !['bind','root','slow'].includes(fx.id)) };
            }
            return b;
          });

          // ── Boss passive: pack_leader — nearby enemies +1 dmg while boss lives ─
          const bossAlive = units.find(u => u.isBoss && !u.fallen);
          if (bossAlive?.bossPassive === 'pack_leader') {
            units = units.map(u => {
              if (u.type !== UT.ENEMY || u.isBoss || u.fallen) return u;
              return dist(bossAlive, u) <= 3 ? { ...u, dmg: u.dmg + 1 } : u;
            });
          }

          // ── Boss passive: terrifying — adjacent friendlies lose 1 AP ──
          if (bossAlive?.bossPassive === 'terrifying') {
            units = units.map(u => {
              if (u.type === UT.ENEMY || u.fallen) return u;
              return dist(bossAlive, u) <= 1 ? { ...u, ap: Math.max(0, u.ap - 1) } : u;
            });
          }

          // Sight check (ambush hidden; sleeping halves spot; shadow tiles reduce enemy sight range)
          const preAlertCount = units.filter(u => u.type===UT.ENEMY && u.alerted).length;
          units = units.map(u => {
            if (u.type!==UT.ENEMY || u.fallen || u.alerted) return u;
            if (u.placement === 'ambush' && !u.ambushTriggered) return u;
            const spotted = friendlies().find(f => {
              const shadowPen = ms.tiles[f.y]?.[f.x]?.type === TILE.SHADOW ? 1 : 0;
              return dist(u,f) <= (u.sight||3)+noiseMod-shadowPen && hasLOS(ms.tiles,u.x,u.y,f.x,f.y);
            });
            if (!spotted) return u;
            const spotChance = (u.spot||0.6) * (u.sleeping ? 0.5 : 1);
            if (Math.random() < spotChance) {
              logs.push(`👁 ${u.name} spots ${spotted.name}!`);
              return { ...u, alerted:true };
            }
            return u;
          });
          if (units.filter(u => u.type===UT.ENEMY && u.alerted).length > preAlertCount) {
            if (objective?.type === 'silent_bonus' && !objective.failed) {
              objective = { ...objective, failed: true };
              logs.push('✗ Detected — silent extraction failed.');
            }
          }

          const pendingAttacks = [];

          units = units.map(u => {
            if (u.type!==UT.ENEMY || u.fallen) return u;
            const fr  = friendlies();
            if (!fr.length) return u;

            // Sleep: check wake conditions; if still asleep, skip turn
            if (u.placement === 'sleep' && u.sleeping) {
              const adj2 = fr.find(f => dist(u, f) <= 1);
              if (prev.noise >= 60 || adj2) {
                logs.push(`💀 ${u.name} jolts awake!`);
                return { ...u, sleeping: false, alerted: true };
              }
              return u;
            }

            // Ambush: hidden until player crosses trigger row
            if (u.placement === 'ambush' && !u.ambushTriggered) {
              const trigY = u.triggerRow ?? Math.floor(ms.tiles.length / 2);
              if (fr.some(f => f.y <= trigY)) {
                logs.push(`⚠️ ${u.name} springs from hiding!`);
                return { ...u, ambushTriggered: true, alerted: true };
              }
              return u;
            }

            const adj = fr.find(f => dist(u,f) <= 1);

            if (adj || u.alerted) {
              if (!u.alerted) logs.push(`👁 ${u.name} spots ${adj.name}!`);
              const visibleTgt = fr.find(f => dist(u,f)<=(u.sight||3)+noiseMod && hasLOS(ms.tiles,u.x,u.y,f.x,f.y));
              const lastKnown  = visibleTgt ? { x:visibleTgt.x, y:visibleTgt.y } : (u.lastKnown||null);
              const canSee     = !!visibleTgt;

              if (u.alerted && !canSee && !adj) {
                if (lastKnown) {
                  if (u.x===lastKnown.x && u.y===lastKnown.y) {
                    const nc = (u.chaseTurns||0)+1;
                    if (nc >= 2) { logs.push(`${u.name} finds nothing — resuming patrol.`); return { ...u, alerted:false, chaseTurns:0, lastKnown:null }; }
                    return { ...u, chaseTurns:nc, lastKnown:null };
                  }
                  const path = bfsGridPath(ms.tiles, u.x, u.y, lastKnown.x, lastKnown.y, units);
                  if (path.length) {
                    let nx = u.x, ny = u.y, steps = 0;
                    for (const step of path) {
                      if (steps >= (u.moveRange || 1)) break;
                      if (!walkable(ms.tiles, step.x, step.y, units)) break;
                      nx = step.x; ny = step.y; steps++;
                    }
                    if (nx !== u.x || ny !== u.y) return { ...u, x:nx, y:ny, chaseTurns:0, lastKnown };
                  }
                  return { ...u, chaseTurns:(u.chaseTurns||0)+1, lastKnown };
                }
                const nc = (u.chaseTurns||0)+1;
                if (nc >= 2) { logs.push(`${u.name} loses the trail.`); return { ...u, alerted:false, chaseTurns:0, lastKnown:null }; }
                return { ...u, chaseTurns:nc };
              }

              const tgt   = adj || visibleTgt || fr.reduce((a,b) => dist(u,a)<=dist(u,b)?a:b);
              const aRange = u.attackRange || 1;
              if (dist(u,tgt) <= aRange) {
                pendingAttacks.push({ attacker:u, target:tgt });
                return { ...u, alerted:true, chaseTurns:0, lastKnown };
              }
              const path = bfsGridPath(ms.tiles, u.x, u.y, tgt.x, tgt.y, units);
              if (path.length) {
                let nx = u.x, ny = u.y, steps = 0;
                for (const step of path) {
                  if (steps >= (u.moveRange || 1)) break;
                  if (step.x === tgt.x && step.y === tgt.y) break;
                  if (!walkable(ms.tiles, step.x, step.y, units)) break;
                  nx = step.x; ny = step.y; steps++;
                }
                if (nx !== u.x || ny !== u.y) {
                  const movedU = { ...u, x:nx, y:ny, alerted:true, chaseTurns:0, lastKnown };
                  // If movement brought enemy into attack range, queue attack
                  const newAdj = fr.find(f => dist(movedU, f) <= aRange);
                  if (newAdj) pendingAttacks.push({ attacker: movedU, target: newAdj });
                  return movedU;
                }
              }
              return { ...u, alerted:true, chaseTurns:0, lastKnown };
            }
            // Unalerted movement by placement type
            if (u.placement === 'guard') return u; // stationary

            if (u.placement === 'patrol' && u.waypoints?.length) {
              const wi = u.wi ?? 0;
              const wp = u.waypoints[wi % u.waypoints.length];
              if (u.x === wp.x && u.y === wp.y) return { ...u, wi: (wi+1) % u.waypoints.length };
              const path = bfsGridPath(ms.tiles, u.x, u.y, wp.x, wp.y, units);
              if (path.length) {
                let nx = u.x, ny = u.y, steps = 0;
                for (const step of path) {
                  if (steps >= (u.moveRange||1)) break;
                  if (!walkable(ms.tiles, step.x, step.y, units)) break;
                  nx = step.x; ny = step.y; steps++;
                }
                if (nx !== u.x || ny !== u.y) return { ...u, x:nx, y:ny };
              }
              return { ...u, wi: (wi+1) % u.waypoints.length };
            }

            // Roam / fallback: delta patrol
            const p  = u.patrol?.[u.pi % (u.patrol?.length||1)] ?? { dx:1, dy:0 };
            const nx = u.x+p.dx, ny = u.y+p.dy;
            return walkable(ms.tiles,nx,ny,units) ? { ...u, x:nx, y:ny, pi:(u.pi||0)+1 } : { ...u, pi:(u.pi||0)+1 };
          });

          const newTiles = revealTraps(ms.tiles, units);

          // ── Boss active ability ────────────────────────────────────────
          const bossUnit = units.find(u => u.isBoss && !u.fallen);
          if (bossUnit?.bossActiveUses > 0) {
            const fr2 = friendlies();
            const inRange2 = fr2.filter(f => dist(bossUnit, f) <= (bossUnit.attackRange||1) + 1);
            const nearFr = fr2.filter(f => dist(bossUnit, f) <= 3);
            const ablId  = bossUnit.bossActive;
            let useAbility = false;

            if (ablId === 'cleave' && inRange2.length >= 2)   useAbility = true;
            if (ablId === 'whirlwind' && nearFr.length >= 2)  useAbility = true;
            if (ablId === 'war_cry'   && units.filter(u=>u.type===UT.ENEMY&&!u.isBoss&&!u.fallen&&dist(bossUnit,u)<=3).length >= 2) useAbility = true;
            if (ablId === 'rally'     && units.some(u=>u.type===UT.ENEMY&&!u.isBoss&&!u.fallen&&u.hp<u.maxHp&&dist(bossUnit,u)<=3)) useAbility = true;
            if (ablId === 'summon'    && units.filter(u=>u.type===UT.ENEMY&&!u.fallen).length <= 2) useAbility = true;
            if (!useAbility && ['pinning_strike','terrify','charge','barrier','execute_order'].includes(ablId) && nearFr.length > 0) useAbility = true;

            if (useAbility) {
              units = units.map(u => u.id === bossUnit.id ? { ...u, bossActiveUses: 0 } : u);
              const boss2 = units.find(u => u.id === bossUnit.id);
              if (!boss2) { /* skip */ }
              else if (ablId === 'cleave') {
                const adj = fr2.filter(f => dist(boss2, f) <= 1);
                adj.forEach(tgt => {
                  const d = Math.max(1, boss2.dmg - (tgt.def||0));
                  units = units.map(v => v.id !== tgt.id ? v : v.hp - d <= 0
                    ? { ...v, hp:0, fallen:true, raiseTurn:ms.turn }
                    : { ...v, hp: v.hp - d });
                });
                logs.push(`⚔️ ${boss2.name} Cleaves ${adj.length} units!`);
              } else if (ablId === 'whirlwind') {
                const near = fr2.filter(f => dist(boss2, f) <= 2);
                near.forEach(tgt => {
                  const d = Math.max(1, Math.floor(boss2.dmg / 2) - (tgt.def||0));
                  units = units.map(v => v.id !== tgt.id ? v : v.hp - d <= 0
                    ? { ...v, hp:0, fallen:true, raiseTurn:ms.turn }
                    : { ...v, hp: v.hp - d });
                });
                logs.push(`🌀 ${boss2.name} Whirlwinds — ${near.length} units hit!`);
              } else if (ablId === 'war_cry') {
                const mobs = units.filter(u=>u.type===UT.ENEMY&&!u.isBoss&&!u.fallen&&dist(boss2,u)<=3);
                units = units.map(u => mobs.some(m=>m.id===u.id) ? {...u, moveRange:(u.moveRange||3)+1} : u);
                logs.push(`📣 ${boss2.name}'s War Cry — ${mobs.length} allies +1 move!`);
              } else if (ablId === 'rally') {
                const mobs = units.filter(u=>u.type===UT.ENEMY&&!u.isBoss&&!u.fallen&&dist(boss2,u)<=3);
                units = units.map(u => mobs.some(m=>m.id===u.id) ? {...u, hp:Math.min(u.maxHp, u.hp+2)} : u);
                logs.push(`💚 ${boss2.name} Rallies nearby allies (+2 HP)!`);
              } else if (ablId === 'summon') {
                const a = ARCHETYPES[Math.floor(Math.random()*ARCHETYPES.length)];
                const ex = 1 + Math.floor(Math.random() * (ms.width - 2));
                const newE = {
                  id:`bs${Date.now()}`, type:UT.ENEMY, name:a.name, emoji:a.emoji,
                  x:ex, y:1, hp:a.hp, maxHp:a.hp, dmg:a.dmg, def:0, ap:2,
                  moveRange:a.move, attackRange:a.attackRange||1,
                  fallen:false, raiseTurn:null, alerted:true, placement:'roam',
                  patrol:[{dx:1,dy:0},{dx:-1,dy:0}], pi:0,
                  xp:a.xp, dc:a.dc, sight:a.sight, spot:a.spot,
                  weapon:null, armor:null, level:1, xpVal:0, chaseTurns:0, lastKnown:null, statusEffects:[],
                };
                units = [...units, newE];
                logs.push(`⚠️ ${boss2.name} Summons reinforcements!`);
              } else if (ablId === 'pinning_strike' && nearFr.length) {
                const tgt = nearFr[0];
                const d = Math.max(1, boss2.dmg - (tgt.def||0));
                units = units.map(v => v.id !== tgt.id ? v : {
                  ...v, hp: Math.max(0, v.hp - d),
                  statusEffects: [...(v.statusEffects||[]), {id:'slow',duration:1,magnitude:0,sourceId:boss2.id}],
                  ...(v.hp - d <= 0 ? {fallen:true,raiseTurn:ms.turn} : {}),
                });
                logs.push(`📌 ${boss2.name}'s Pinning Strike — ${tgt.name} Slowed!`);
              } else if (ablId === 'terrify' && nearFr.length) {
                const tgt = nearFr[0];
                units = units.map(v => v.id !== tgt.id ? v : {
                  ...v, statusEffects:[...(v.statusEffects||[]),{id:'stun',duration:1,magnitude:0,sourceId:boss2.id}],
                });
                logs.push(`😱 ${boss2.name} Terrifies ${tgt.name}!`);
              } else if (ablId === 'charge' && nearFr.length) {
                const tgt = nearFr.reduce((a,b3)=>dist(boss2,a)<=dist(boss2,b3)?a:b3);
                const path = bfsGridPath(ms.tiles, boss2.x, boss2.y, tgt.x, tgt.y, units);
                if (path.length) {
                  let nx2=boss2.x,ny2=boss2.y,steps2=0;
                  for (const step of path) {
                    if (steps2>=(boss2.moveRange||2)||step.x===tgt.x&&step.y===tgt.y) break;
                    if (!walkable(ms.tiles,step.x,step.y,units)) break;
                    nx2=step.x;ny2=step.y;steps2++;
                  }
                  units=units.map(v=>v.id===boss2.id?{...v,x:nx2,y:ny2}:v);
                  const boss3=units.find(v=>v.id===boss2.id);
                  if (boss3&&dist(boss3,tgt)<=1) {
                    const d=Math.max(1,boss3.dmg-(tgt.def||0));
                    units=units.map(v=>v.id!==tgt.id?v:v.hp-d<=0?{...v,hp:0,fallen:true,raiseTurn:ms.turn}:{...v,hp:v.hp-d});
                    logs.push(`⚡ ${boss3.name} Charges ${tgt.name} for ${d}!`);
                  }
                }
              }
            }
          }

          // ── Boss passive: death_burst conditional ─────────────────────
          // Handled below in attack resolution when boss hp hits 0

          // Resolve attacks (with boss passive hooks)
          for (const { attacker, target } of pendingAttacks) {
            const tgt = units.find(u => u.id===target.id);
            if (!tgt || tgt.fallen) continue;
            const ad    = tgt.armor ? (item(tgt.armor)?.def||0) : 0;
            const ignoreDef = attacker.bossPassive === 'brutal';
            let dmg = Math.max(1, (attacker.dmg||2) - (ignoreDef ? 0 : ad));
            // armored passive: attacker is the target's passive doesn't apply here (it's the enemy attacking player)
            // but when a boss IS the target (player attacks boss in doAttack) it's handled there
            // For enemy attacking player: check if attacker is boss with brutal
            logs.push(`⚔️ ${attacker.name} hits ${tgt.name} for ${dmg}!`);
            units = units.map(v => {
              if (v.id !== tgt.id) return v;
              const nh = v.hp - dmg;
              if (nh <= 0) {
                if (v.id==='varek') { setTimeout(() => get().setScreen('gameover'), 300); return { ...v, hp:0 }; }
                logs.push(`${v.name} falls!`);
                // death_burst conditional: boss deals 2 dmg to all adjacent on death
                if (v.isBoss && v.bossConditional === 'death_burst') {
                  const adjFr = units.filter(f => f.type !== UT.ENEMY && !f.fallen && dist(v, f) <= 1);
                  adjFr.forEach(f => {
                    units = units.map(u => u.id !== f.id ? u : {
                      ...u, hp: Math.max(0, u.hp - 2),
                      ...(u.hp - 2 <= 0 && u.id !== 'varek' ? {fallen:true,raiseTurn:ms.turn} : {}),
                    });
                  });
                  if (adjFr.length) logs.push(`💥 ${v.name}'s Death Burst — ${adjFr.length} units hit!`);
                }
                return { ...v, hp:0, fallen:true, raiseTurn:ms.turn };
              }
              // undying passive: survive once at 1hp
              if (v.isBoss && v.bossPassive === 'undying' && !v.bossCondTriggered && nh <= 0) {
                logs.push(`☠ ${v.name}'s Undying — survives at 1 HP!`);
                return { ...v, hp:1, bossCondTriggered:true };
              }
              // phase_shift conditional: teleport to random tile at 1hp instead of dying (once)
              if (v.isBoss && v.bossConditional === 'phase_shift' && !v.bossCondTriggered && nh <= 0) {
                let px=v.x,py=v.y;
                for (let a=0;a<40;a++) {
                  const tx=1+Math.floor(Math.random()*(ms.width-2)),ty=1+Math.floor(Math.random()*(ms.tiles.length-2));
                  if (ms.tiles[ty]?.[tx]?.type!=='wall'&&!units.some(u2=>u2.x===tx&&u2.y===ty&&!u2.fallen)){px=tx;py=ty;break;}
                }
                logs.push(`👻 ${v.name} Phase Shifts away!`);
                return { ...v, hp:1, x:px, y:py, bossCondTriggered:true };
              }
              return { ...v, hp:nh };
            });
          }

          // Holy ground — damages undead each turn, Varek every 2 turns; living enemies unaffected
          units = units.map(u => {
            if (u.fallen) return u;
            if (newTiles[u.y]?.[u.x]?.type !== TILE.HOLY) return u;
            if (u.type === UT.UNDEAD) {
              const nh = u.hp - 1;
              if (nh <= 0) { logs.push(`☩ ${u.name} is destroyed by holy ground!`); return { ...u, hp:0, fallen:true, raiseTurn:ms.turn }; }
              logs.push(`☩ ${u.name} burns on holy ground (-1hp).`);
              return { ...u, hp:nh };
            }
            if (u.type === UT.VAREK) {
              const ht = (u.holyTurns || 0) + 1;
              if (ht % 2 === 0) {
                const nh = u.hp - 1;
                logs.push(`☩ Holy ground weakens Varek (-1hp).`);
                if (nh <= 0) { setTimeout(() => get().setScreen('gameover'), 300); return { ...u, hp:0, holyTurns:ht }; }
                return { ...u, hp:nh, holyTurns:ht };
              }
              return { ...u, holyTurns:ht };
            }
            return u;
          });

          // ── Status effect ticks ──────────────────────────────────────────
          units = units.map(u => {
            if (u.fallen || !(u.statusEffects?.length)) return u;
            let { hp } = u;
            const nextEffects = [];
            for (const fx of u.statusEffects) {
              // Apply per-turn damage effects
              if (fx.id === 'burning') {
                hp -= 1;
                logs.push(`🔥 ${u.name} burns (-1hp).`);
              }
              if (fx.id === 'poison' && !(u.type === UT.UNDEAD && !fx.arcane)) {
                hp -= (fx.magnitude ?? 1);
                logs.push(`☠ ${u.name} is poisoned (-${fx.magnitude ?? 1}hp).`);
              }
              // Decrement duration; keep if still active
              const remaining = fx.duration - 1;
              if (remaining > 0) nextEffects.push({ ...fx, duration: remaining });
            }
            const fallen2 = hp <= 0 && !u.fallen;
            if (fallen2 && u.type === UT.VAREK) { setTimeout(() => get().setScreen('gameover'), 300); }
            return {
              ...u, hp: Math.max(0, hp),
              statusEffects: nextEffects,
              ...(fallen2 ? { fallen: true, raiseTurn: ms.turn } : {}),
            };
          });

          // ── Passive regen (class ability or regenPerTurn flag) ────────────
          units = units.map(u => {
            if (u.fallen) return u;
            let heal = u.regenPerTurn ?? 0;
            if (u.classAbility === 'regenerate') heal = Math.max(heal, 1);
            if (u.classAbility === 'undying')    heal = Math.max(heal, 2);
            if (!heal) return u;
            const newHp = Math.min(u.maxHp, u.hp + heal);
            return { ...u, hp: newHp };
          });

          // ── fear_aura: Dread Knight alive → adjacent enemies lose 1 AP ────
          const fearSources = units.filter(u =>
            !u.fallen && u.classAbility === 'fear_aura'
          );
          if (fearSources.length) {
            units = units.map(u => {
              if (u.type !== UT.ENEMY || u.fallen) return u;
              const inRange = fearSources.some(src => dist(src, u) <= 1);
              return inRange ? { ...u, ap: Math.max(0, u.ap - 1) } : u;
            });
          }

          // ── strangling_vines / living_fortress: adjacent enemies take dmg + lose move ──
          const vinesSources = units.filter(u =>
            !u.fallen && (u.classAbility === 'strangling_vines' || u.classAbility === 'living_fortress')
          );
          if (vinesSources.length) {
            units = units.map(u => {
              if (u.type !== UT.ENEMY || u.fallen) return u;
              const inRange = vinesSources.some(src => dist(src, u) <= 1);
              if (!inRange) return u;
              const nh = u.hp - 1;
              if (nh <= 0) { logs.push(`🌿 ${u.name} is strangled!`); return { ...u, hp:0, fallen:true, raiseTurn:ms.turn }; }
              logs.push(`🌿 ${u.name} takes 1 dmg from vines.`);
              return { ...u, hp:nh, moveRange: Math.max(1, (u.moveRange||3) - 1) };
            });
          }

          // Fire spread — each FIRE tile has 40% chance to ignite one adjacent FLOOR tile
          const finalTiles = newTiles.map(r => r.map(c => ({...c})));
          for (let fy = 0; fy < finalTiles.length; fy++) {
            for (let fx = 0; fx < (finalTiles[0]?.length||0); fx++) {
              if (finalTiles[fy]?.[fx]?.type !== TILE.FIRE) continue;
              if (Math.random() >= 0.4) continue;
              const adj = [[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy]) => finalTiles[fy+dy]?.[fx+dx]?.type === TILE.FLOOR);
              if (adj.length) {
                const [dx,dy] = adj[Math.floor(Math.random()*adj.length)];
                finalTiles[fy+dy][fx+dx] = { type: TILE.FIRE };
              }
            }
          }

          const newTurn = ms.turn + 1;

          // Raid reinforcements every 10 turns
          if (prev.mode==='raid' && newTurn%10===0) {
            const a   = ARCHETYPES[Math.floor(Math.random()*ARCHETYPES.length)];
            const rx  = 2+Math.floor(Math.random()*12);
            const reinf = {
              id:`r${Date.now()}`, type:UT.ENEMY, name:a.name, emoji:a.emoji,
              x:rx, y:1, hp:a.hp, maxHp:a.hp, dmg:a.dmg, def:0, ap:2,
              moveRange:a.move, attackRange:a.attackRange||1,
              fallen:false, raiseTurn:null, alerted:true,
              patrol:[{dx:1,dy:0},{dx:-1,dy:0}], pi:0,
              xp:a.xp, dc:a.dc, sight:a.sight, spot:a.spot,
              weapon:null, armor:null, level:1, xpVal:0, chaseTurns:0, lastKnown:null,
            };
            logs.push(`⚠️ Reinforcements arrive! A ${a.name} enters.`);
            units = [...units, reinf];
          }

          return {
            ms:  { ...ms, tiles:finalTiles, units, turn:newTurn, objective },
            luq,
            log: [...logs.reverse(), ...prev.log].slice(0, 14),
          };
        });

        setTimeout(() => set({ phase:'player' }), 200);
      },

      // ── Body looting ──────────────────────────────────────────────────
      doGather(fe, gatherer, guaranteed) {
        set(prev => {
          const ms = prev.ms;
          const gatherCount = fe.gatherCount || 0;
          const removeChance = Math.min(1, 0.3 + gatherCount * 0.3);
          const stripped = Math.random() < removeChance;
          const logs = [];
          let newLoot = [...(ms.loot||[])];

          if (guaranteed) {
            newLoot.push('bone');
            logs.push(stripped
              ? `${gatherer.name} carefully strips 1🦴 — body gone.`
              : `${gatherer.name} carefully strips 1🦴. (${Math.round(Math.min(1,0.3+(gatherCount+1)*0.3)*100)}% gone next)`);
          } else {
            const picked = BODY_LOOT[Math.floor(Math.random()*BODY_LOOT.length)];
            if (picked) newLoot.push(picked);
            const nextPct = Math.round(Math.min(1,0.3+(gatherCount+1)*0.3)*100);
            if (picked) {
              logs.push(stripped
                ? `${gatherer.name} finds 1🦴 — body gone.`
                : `${gatherer.name} finds 1🦴. (${nextPct}% gone next)`);
            } else {
              logs.push(stripped
                ? `${gatherer.name} finds nothing — body gone.`
                : `${gatherer.name} finds nothing. (${nextPct}% gone next)`);
            }
          }

          const apCost = guaranteed ? gatherer.ap : 1;
          const newUnits = ms.units
            .map(u => {
              if (u.id === gatherer.id) return { ...u, ap:u.ap-apCost };
              if (u.id === fe.id) return stripped ? null : { ...u, gatherCount:(u.gatherCount||0)+1 };
              return u;
            })
            .filter(Boolean);

          return {
            ms: { ...ms, loot:newLoot, units:newUnits },
            log: [...logs.reverse(), ...prev.log].slice(0, 14),
          };
        });
      },
    }),
    { name: 'sanctuary-save' }
  )
  )
);
