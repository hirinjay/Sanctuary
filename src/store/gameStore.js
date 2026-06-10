import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_VP, UT, TILE, UNAMES } from '../data/constants';
import { item, LOOT, FLOOR_LOOT, BODY_LOOT } from '../data/items';
import { killXpByTier, xpTierMultiplier } from '../data/enemyDefs';
import { genMap, genDungeonMap, genCabinMap, genForest, genRuinedTown, genRaiderCamp, genSwamp, genBattlefield, genAbandonedVillage, revealTraps, walkable, hasLOS, dist, bfsPath as bfsGridPath, cullUnreachable, findSpawnSlots } from '../systems/map';
import { spawnEnemies, applyXpToUnits, calcSacrificeBonus, VERDANT_VAREK_LU, resolveDefense } from '../systems/combat';
import { ARCHETYPES, CLASS_STATS } from '../data/archetypes';
import { generateWorld, revealAround } from '../world/worldGen';
import { hexesInRange } from '../world/hexMath';
import { TERRAIN, rollWildEncounter, rollForageLoot } from '../world/tileTypes';
import { bfsPath } from '../world/hexMath';
import { BUILDINGS } from '../data/buildings';
import { generateObjective } from '../systems/objectives';
import { saveRun, saveBestiary, loadBestiary } from '../lib/persistence';
import { CLASSES, DC_TO_BASE } from '../data/classes';
import { deleteSave } from '../lib/persistence';
import { ABILITIES } from '../data/abilities';
import { isPlayableWorld } from '../world/worldState';
import { SCREEN, resolveScreen } from '../state/screens';
import { spawnBoss } from '../data/bosses';

// Throttled save — fires immediately on first call, then coalesces rapid calls (400ms window)
let _saveTimer = null
function debouncedSave(get) {
  clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    const state = get()
    const { currentUser, activeSlot } = state
    if (activeSlot) saveRun(state, currentUser?.id ?? null, activeSlot)
  }, 400)
}

// Computes promoted stats as a delta from the archetype baseline rather than
// a hard replacement, so units with above/below-average starting stats carry
// that difference forward through every promotion.
function computePromotedStats(unit, cls) {
  let base;
  if (cls.tier === 2) {
    const cs = CLASS_STATS[unit.dc];
    base = cs
      ? { hp: cs.hp, dmg: cs.dmg, def: cs.def ?? 0, move: cs.moveRange, range: cs.attackRange ?? 1, trapReveal: cs.trapReveal ?? 1 }
      : { hp: 6, dmg: 3, def: 0, move: 3, range: 1, trapReveal: 1 };
  } else {
    // tier-3: baseline is the tier-2 class this unit promoted from
    const t2 = cls.fromClass ? CLASSES[cls.fromClass] : null;
    base = t2
      ? { hp: t2.stats.hp, dmg: t2.stats.dmg, def: t2.stats.def ?? 0, move: t2.stats.move, range: t2.stats.range ?? 1, trapReveal: t2.stats.trapReveal ?? 1 }
      : { hp: unit.maxHp, dmg: unit.dmg, def: unit.def ?? 0, move: unit.moveRange, range: unit.attackRange ?? 1, trapReveal: unit.trapReveal ?? 1 };
  }
  return {
    hp:          Math.max(1, unit.maxHp       + (cls.stats.hp                - base.hp)),
    dmg:         Math.max(1, unit.dmg         + (cls.stats.dmg               - base.dmg)),
    def:         Math.max(0, (unit.def ?? 0)  + ((cls.stats.def  ?? 0)       - base.def)),
    move:        Math.max(1, unit.moveRange   + (cls.stats.move              - base.move)),
    range:       Math.max(1, unit.attackRange + ((cls.stats.range ?? 1)      - base.range)),
    trapReveal:  Math.max(1, (unit.trapReveal ?? 1) + ((cls.stats.trapReveal ?? 1) - base.trapReveal)),
  };
}

export const useGameStore = create(
  subscribeWithSelector(
  persist(
    (set, get) => ({
      // ── Persistent state ──────────────────────────────────────────────
      screen:       SCREEN.HOME,
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
      missionResult: null,   // summary shown between encounter and world map
      // ── Location visit tracking ───────────────────────────────────────
      locationVisits:    {},  // { [locId]: { visits: N, bossDefeated: bool } }
      locationScavenges: {},  // { [locId]: N } — scavenge count per location
      locationBosses:    {},  // { [locId]: bool } — active boss flag
      // ── Bestiary (account-scoped — never wiped on resetGame) ──────────
      bestiary: {},         // { [entityId]: { encounters: N, abilitiesSeen: bool } }
      // ── Achievement system (run-scoped) ───────────────────────────────
      varekAchievements: [], // ability IDs unlocked by in-run milestones
      achievements: {
        totalFallen: 0, dungeonsCleared: 0,
        firstRebirth: false, firstBossRaised: false,
        villageAllied: false, villageDestroyed: false, sanctuaryLost: false,
      },

      // ── Simple setters ────────────────────────────────────────────────
      setScreen(screen) {
        const state = get();
        const nextScreen = resolveScreen(screen, state);
        if (nextScreen === SCREEN.GAME_OVER) {
          const { currentUser, activeSlot } = state;
          if (activeSlot) deleteSave(currentUser?.id ?? null, activeSlot);
          set({ screen:nextScreen, activeSlot:null });
          return;
        }
        set({ screen:nextScreen });
      },
      goHome: () => get().setScreen(SCREEN.HOME),
      returnToWorld: () => get().setScreen(SCREEN.WORLD),
      enterSanctuary: () => get().setScreen(SCREEN.SANCTUARY),
      openSanctuaryMap: () => get().setScreen(SCREEN.SANCTUARY_MAP),
      openBestiary: () => get().setScreen(SCREEN.BESTIARY),
      setEquipTgt: (id)       => set({ equipTgt: id }),
      setPhase:    (phase)    => set({ phase }),

      addLog: (msg) => set(s => ({ log: [msg, ...s.log].slice(0, 14) })),
      dismissLevelUp: () => set(s => ({ luq: (s.luq ?? []).slice(1) })),
      continueFromMissionResult() {
        const { luq } = get();
        if ((luq ?? []).length > 0) return;
        set(s => ({ missionResult:null, screen:resolveScreen(SCREEN.WORLD, { ...s, missionResult:null }) }));
        debouncedSave(get);
      },

      goDeeper() {
        const result = get().missionResult;
        if (!result?.canGoDeeper || !result.pendingLoc) return;
        const { luq, noise } = get();
        if ((luq ?? []).length > 0) return;
        // Noise propagates to deeper floors at 40% — loud previous floor pre-alerts enemies
        const propagatedNoise = Math.floor((noise ?? 0) * 0.4);
        set({ missionResult: null });
        get().startMission(result.pendingLoc, 'raid', result.floor + 1, propagatedNoise);
      },

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
      startMission(location, md, floor = 1, prevNoise = 0) {
        const { vp, roster, locationVisits, locationScavenges, locationBosses, bestiary, varekAchievements } = get();
        const danger  = location.danger ?? 1;
        const locId   = location.id ?? '';
        const locType = location.type ?? '';
        const FLOOR_MAX_MAP = { dungeon:5, camp:3, wizard_tower:4, cabin:2 };
        const maxFloor = FLOOR_MAX_MAP[locType] ?? 1;
        const effectiveDanger = Math.min(3, danger + Math.floor((floor - 1) / 2));
        // Pick generator + map size by location type / id prefix
        let mapFn, mapW, mapH;
        if      (locType==='dungeon'||locId.startsWith('dungeon_'))  { mapFn=genDungeonMap;       mapW=18+Math.floor(Math.random()*9);  mapH=12+Math.floor(Math.random()*7); }
        else if (locType==='wizard_tower')                            { mapFn=genDungeonMap;       mapW=16+Math.floor(Math.random()*6);  mapH=14+Math.floor(Math.random()*5); }
        else if (locType==='cabin')                                   { mapFn=genCabinMap;         mapW=16; mapH=12; }
        else if (locId.startsWith('wild_forest'))                     { mapFn=genForest;           mapW=22; mapH=18; }
        else if (locId.startsWith('wild_ruins')||locId.startsWith('ruined_')) { mapFn=genRuinedTown; mapW=20; mapH=16; }
        else if (locId.startsWith('wild_swamp'))                      { mapFn=genSwamp;            mapW=20; mapH=16; }
        else if (locType==='camp')                                    { mapFn=genRaiderCamp;       mapW=18; mapH=14; }
        else if (locType==='village')                                 { mapFn=genAbandonedVillage; mapW=18; mapH=16; }
        else if (locType==='battlefield')                             { mapFn=genBattlefield;      mapW=24; mapH=18; }
        else                                                          { mapFn=genMap;              mapW=16+Math.floor(Math.random()*7); mapH=12+Math.floor(Math.random()*5); }
        const spawnX = 1, spawnY = mapH - 2;
        const activeRoster = roster.filter(u => !u.atBase);
        const rawTiles = mapFn(danger, mapW, mapH);
        // Strip loot/specials that ended up in disconnected areas, then find valid spawn slots
        const tiles = cullUnreachable(rawTiles, spawnX, spawnY);
        const spawnSlots = findSpawnSlots(tiles, spawnX, spawnY, 1 + activeRoster.length);
        const hasGrief  = (varekAchievements ?? []).includes('grief');
        const varekAbils = [...(vp.varekAbilities ?? []), ...(varekAchievements ?? [])];
        const varekAbilUses = Object.fromEntries(varekAbils.map(aid => [aid, ABILITIES[aid]?.usesPerEncounter ?? 0]));
        const varekBondedArmed = Object.fromEntries(varekAbils.map(aid => [aid, ABILITIES[aid]?.type === 'reactive']));
        const varek = {
          id:'varek', type:UT.VAREK, name:'Varek', emoji:'🧙',
          x: spawnSlots[0]?.x ?? spawnX, y: spawnSlots[0]?.y ?? spawnY, ...vp,
          dmg: (vp.dmg || 2) + (hasGrief ? 1 : 0),
          moveRange: vp.moveRange || 3,
          trapReveal: vp.trapReveal || 1,
          actionPoints:1, movementPoints:1, fallen:false, raiseTurn:null,
          statusEffects: [],
          bondedAbilities: varekAbils,
          abilityUses: varekAbilUses,
          abilityArmed: false,
          bondedArmed: varekBondedArmed,
        };
        const deployedUndeadIds = activeRoster.map(u => u.id);
        const activeUndead = activeRoster
          .map((u, i) => {
            const slot = spawnSlots[1 + i] ?? { x: spawnX+1+i, y: spawnY };
            const classUses = u.classAbility
              ? { [u.classAbility]: ABILITIES[u.classAbility]?.usesPerEncounter ?? 0 }
              : {};
            const bondedUses = Object.fromEntries(
              (u.bondedAbilities ?? []).map(aid => [aid, ABILITIES[aid]?.usesPerEncounter ?? 0])
            );
            const bondedArmed = Object.fromEntries(
              (u.bondedAbilities ?? []).map(aid => [aid, ABILITIES[aid]?.type === 'reactive'])
            );
            return {
              ...u, x:slot.x, y:slot.y, actionPoints:1, movementPoints:1, fallen:false, raiseTurn:null, atBase:false,
              statusEffects: [],
              abilityUses: { ...classUses, ...bondedUses },
              abilityArmed: ABILITIES[u.classAbility]?.type === 'reactive' ? true : false,
              bondedArmed,
              encounterKills: 0,
              encounterBonusDmg: 0,
              encounterBonusMove: 0,
              surviveUsed: false,
            };
          });
        // ── Visit tracking ─────────────────────────────────────────────
        const visitInfo    = locationVisits[locId] ?? { visits: 0, bossDefeated: false };
        const newVisitCount = visitInfo.visits + 1;
        const newLocationVisits = {
          ...locationVisits,
          [locId]: { ...visitInfo, visits: newVisitCount },
        };

        // ── Scavenge tracking + scavenge-triggered boss ────────────────
        const existingScavenges = locationScavenges ?? {};
        const newScavengeCount  = md === 'scavenge' ? (existingScavenges[locId] ?? 0) + 1 : (existingScavenges[locId] ?? 0);
        const newLocationScavenges = { ...existingScavenges, [locId]: newScavengeCount };
        const newLocationBosses = { ...(locationBosses ?? {}) };
        if (md === 'scavenge' && newScavengeCount >= 5 && locType !== 'merchant' && locType !== 'cabin') {
          newLocationBosses[locId] = true;
        }

        // ── Boss floor spawn (boss present + deepest floor) ────────────
        const hasBoss    = newLocationBosses[locId] === true;
        const isBossFloor = hasBoss && floor === maxFloor;

        // ── Enemy spawn ────────────────────────────────────────────────
        const enemies = locType === 'battlefield' ? [] : spawnEnemies(effectiveDanger, md, tiles, spawnX, spawnY, location.threats ?? null, locType, floor, isBossFloor);
        const boss = isBossFloor ? spawnBoss(effectiveDanger, tiles, spawnX, spawnY, locType || 'dungeon') : null;
        // Three support units clustered near the boss
        const bossSupport = [];
        if (boss) {
          for (let i = 0; i < 3; i++) {
            const a = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];
            const bsHp  = Math.round(a.hp  * (1 + (effectiveDanger-1) * 0.35));
            const bsDmg = Math.max(1, Math.round(a.dmg * (1 + (effectiveDanger-1) * 0.25)));
            let sx = boss.x, sy = boss.y;
            for (let attempt = 0; attempt < 40; attempt++) {
              const tx = boss.x + Math.floor(Math.random()*5) - 2;
              const ty = boss.y + Math.floor(Math.random()*5) - 2;
              if (tx>=1 && tx<mapW-1 && ty>=1 && ty<mapH-1
                  && tiles?.[ty]?.[tx]?.type !== 'wall'
                  && !bossSupport.some(s => s.x===tx && s.y===ty)
                  && (tx!==boss.x || ty!==boss.y)) { sx=tx; sy=ty; break; }
            }
            bossSupport.push({
              id:`sup${i}`, type:UT.ENEMY, name:a.name, emoji:a.emoji,
              x:sx, y:sy, hp:bsHp, maxHp:bsHp, dmg:bsDmg, def:0,
              actionPoints:1, movementPoints:1, moveRange:a.move, attackRange:a.attackRange||1,
              fallen:false, raiseTurn:null, alerted:true, placement:'guard',
              waypoints:undefined, wi:0, ambushTriggered:true, triggerRow:undefined,
              patrol:[{dx:1,dy:0},{dx:-1,dy:0}], pi:0,
              xp:a.xp, dc:a.dc, sight:a.sight, spot:a.spot,
              weapon:null, armor:null, level:1, xpVal:0, chaseTurns:0, lastKnown:null,
              statusEffects:[],
            });
          }
        }

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
        let missionEnemies = [...enemies, ...(boss ? [boss] : []), ...bossSupport];
        lockedKeyIds.forEach(keyId => {
          const eligible = missionEnemies.filter(e => !e.holdsKey && !e.sleeping && !e.isBoss);
          if (!eligible.length) return;
          const tgt = eligible[Math.floor(Math.random() * eligible.length)];
          missionEnemies = missionEnemies.map(e => e.id === tgt.id ? { ...e, holdsKey: true, keyId } : e);
        });

        // ── Bestiary: unlock enemy entries on first/second encounter ──
        const seenNames = [...new Set(enemies.map(e => e.name).filter(Boolean))];
        const newBestiary = { ...bestiary };
        seenNames.forEach(name => {
          const prev2 = newBestiary[name] ?? { encounters: 0 };
          const n = prev2.encounters + 1;
          newBestiary[name] = { encounters: n, statsRevealed: n >= 2, abilitiesSeen: n >= 3 };
        });
        if (boss) {
          const pb = newBestiary[boss.bossType] ?? { encounters: 0 };
          const nb = pb.encounters + 1;
          newBestiary[boss.bossType] = { encounters: nb, statsRevealed: nb >= 2, abilitiesSeen: nb >= 3 };
        }

        const initialUnits = [varek, ...activeUndead, ...missionEnemies];
        const revealedTiles = revealTraps(missionTiles, initialUnits);
        const bossLog = boss ? [`⚠️ ${boss.name} commands the floor — with ${bossSupport.length} guards at their side!`] : [];
        const floorLog = maxFloor > 1 ? [`📍 Floor ${floor} of ${maxFloor}.`] : [];
        set({
          ms:    { tiles:revealedTiles, units:initialUnits, turn:1, loot:[], keys:[], width:mapW, height:mapH, objective, locationId:locId, deployedUndeadIds, floor, maxFloor, isBossFloor },
          noise: prevNoise > 0 ? Math.max(30, prevNoise) : (md === 'raid' ? 30 : 0),
          loc:   location,
          mode:  md,
          luq:   [],
          log:   [...bossLog, ...floorLog, `${location.name} — ${md==='raid'?'Raid: enemies alerted.':'Scavenge: stay quiet.'}`, `◼ ${objective.label}`],
          phase: 'player',
          screen:SCREEN.MISSION,
          locationVisits:    newLocationVisits,
          locationScavenges: newLocationScavenges,
          locationBosses:    newLocationBosses,
          bestiary:          newBestiary,
        });
        const { currentUser: cu2 } = get();
        if (Object.keys(newBestiary).length) saveBestiary(newBestiary, cu2?.id ?? null);
      },

      endMission(units, loot, success = false) {
        const { roster, vp, inv, travelBag, sanctuaryGrid, ms: currentMs, locationVisits, locationBosses, bestiary, book, loc, world } = get();
        const objective    = currentMs?.objective ?? null;
        const floor        = currentMs?.floor    ?? 1;
        const maxFloor     = currentMs?.maxFloor ?? 1;
        const isBossFloor  = currentMs?.isBossFloor ?? false;

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
        const rosterIds = new Set(roster.map(u => u.id));
        const deployedUndeadIds = currentMs?.deployedUndeadIds ?? roster.filter(u => !u.atBase).map(u => u.id);
        const deployedIdSet = new Set(deployedUndeadIds);
        const luqExtra = [];
        let surv = units.filter(u => u.type === UT.UNDEAD && !u.fallen);
        const fallenDeployed = deployedUndeadIds
          .map(id => units.find(u => u.id === id) ?? roster.find(u => u.id === id))
          .filter(u => u && (u.fallen || !surv.some(su => su.id === u.id)));
        const gainedUnits = surv.filter(u => !rosterIds.has(u.id));
        const survivalUnits = surv.filter(u => deployedIdSet.has(u.id));
        survivalUnits.forEach(u => {
          surv = applyXpToUnits(surv, u.id, 1, luqExtra);
        });
        let varek = units.find(u => u.id === 'varek');

        if (varek && varekXpBonus > 0) {
          const vOpts = book?.id === 'verdant' ? VERDANT_VAREK_LU : undefined;
          const updated = applyXpToUnits([varek], 'varek', varekXpBonus, luqExtra, vOpts);
          varek = updated[0];
        }

        const newVp = varek
          ? { ...vp, hp:varek.hp, xp:varek.xp, level:varek.level, raiseRange:varek.raiseRange,
              drainRange:varek.drainRange, tetherCap:varek.tetherCap, dmg:varek.dmg??2,
              moveRange:varek.moveRange||3, weapon:varek.weapon, armor:varek.armor }
          : vp;
        const newRoster = [...roster.filter(u => u.atBase), ...surv.map(u => ({ ...u, atBase:false }))];

        // Loot goes into travelBag — Varek carries it; must return to Sanctuary to deposit
        let newBag = { ...travelBag };
        finalLoot.forEach(id => { newBag[id] = (newBag[id]||0) + 1; });

        // Node yields — count placed tiles; each farm=2 food, each quarry=2 iron
        const newInv = { ...inv };
        const logs = [...objLogs];

        // Boss floor retreat: lose 75% of the full bag (existing + new loot combined)
        if (isBossFloor && !success) {
          const allItems = Object.entries(newBag).flatMap(([id, cnt]) => Array(cnt).fill(id));
          const keepCount = Math.ceil(allItems.length * 0.25);
          const keptItems = [...allItems].sort(() => Math.random() - 0.5).slice(0, keepCount);
          newBag = {};
          keptItems.forEach(id => { newBag[id] = (newBag[id]||0)+1; });
          const lostCount = allItems.length - keepCount;
          if (lostCount > 0) logs.push(`💸 Retreated from the boss — ${lostCount} item${lostCount!==1?'s':''} scattered in the chaos.`);
        }
        const farmCount   = sanctuaryGrid?.tiles?.filter(t => t.building === 'farm')?.length ?? 0;
        const quarryCount = sanctuaryGrid?.tiles?.filter(t => t.building === 'quarry')?.length ?? 0;
        if (farmCount > 0)   { newInv.food = (newInv.food||0)+farmCount*2; logs.push(`🌱 ${farmCount} farm${farmCount!==1?'s':''} yield${farmCount===1?'s':''} ${farmCount*2} food.`); }
        if (quarryCount > 0) { newInv.scrap_iron = (newInv.scrap_iron||0)+quarryCount*2; logs.push(`⛏ ${quarryCount} quarr${quarryCount!==1?'ies':'y'} yield${quarryCount===1?'s':''} ${quarryCount*2} scrap iron.`); }

        if (success) logs.push(`✓ Secured ${finalLoot.length} item${finalLoot.length!==1?'s':''} — return to Sanctuary to deposit.`);
        if (survivalUnits.length) logs.push(`+1 survival XP: ${survivalUnits.map(u => u.pname ?? u.name).join(', ')}.`);

        // ── Boss kill + location clear ─────────────────────────────────
        const killedBoss = units.find(u => u.isBoss && u.fallen);
        const locId2 = currentMs?.locationId;
        const newLocationVisits = killedBoss && locId2
          ? { ...locationVisits, [locId2]: { ...(locationVisits[locId2] ?? {}), bossDefeated: true } }
          : locationVisits;
        const newBestiary = { ...bestiary };
        if (killedBoss) {
          const pb = newBestiary[killedBoss.bossType] ?? { encounters: 1 };
          newBestiary[killedBoss.bossType] = { ...pb, abilitiesSeen: true, statsRevealed: true };
          logs.push(`💀 ${killedBoss.name} defeated — bestiary updated.`);
          // Guaranteed rare drop from boss_loot pool
          if (killedBoss.boss_loot) {
            finalLoot.push(killedBoss.boss_loot);
            logs.push(`⭐ ${killedBoss.name} drops ${item(killedBoss.boss_loot)?.name ?? killedBoss.boss_loot}!`);
          } else {
            finalLoot.push('arcane'); // fallback rare drop
          }
        }
        // Update boss flags: clear when boss killed; set when all floors cleared (no boss this run)
        const newLocationBosses = { ...(locationBosses ?? {}) };
        if (killedBoss && locId2) {
          newLocationBosses[locId2] = false;
        } else if (success && floor === maxFloor && loc?.type !== 'cabin' && locId2) {
          newLocationBosses[locId2] = true;
          logs.push(`⚠️ The location falls silent... something powerful has taken notice.`);
        }

        const clearedCabin = success && loc?.type === 'cabin' && floor === maxFloor;
        const nextWorld = clearedCabin && world
          ? {
              ...world,
              tiles: world.tiles.map(t => {
                const isMissionTile = locId2 === `${t.location?.type}_${t.col}_${t.row}`;
                return isMissionTile && t.location?.type === 'cabin' ? { ...t, location:null } : t;
              }),
            }
          : world;
        if (clearedCabin) logs.push('🛖 The abandoned cabin is cleared from the map.');

        set(s => ({
          vp:newVp, roster:newRoster, inv:newInv, travelBag:newBag,
          luq: [...(s.luq ?? []), ...luqExtra],
          locationVisits: newLocationVisits,
          bestiary: newBestiary,
          world: nextWorld,
          ms:null, worldPath:[], selectedHex:null, loc:null,
          locationBosses: newLocationBosses,
          missionResult: {
            success,
            locationName: loc?.name ?? currentMs?.locationId ?? 'Encounter',
            locationType: loc?.type ?? null,
            loot: finalLoot,
            logs,
            leveled: luqExtra.length,
            clearedLocation: clearedCabin,
            floor,
            maxFloor,
            canGoDeeper: success && floor < maxFloor && !isBossFloor,
            pendingLoc: (success && floor < maxFloor && !isBossFloor) ? loc : null,
            fallenUnits: fallenDeployed.map(u => ({ id:u.id, name:u.pname ?? u.name, className:u.cls ?? u.dc ?? 'Undead', emoji:u.emoji ?? '☠' })),
            gainedUnits: gainedUnits.map(u => ({ id:u.id, name:u.pname ?? u.name, className:u.cls ?? u.dc ?? 'Undead', emoji:u.emoji ?? '☠' })),
            survivalXpUnits: survivalUnits.map(u => ({ id:u.id, name:u.pname ?? u.name, className:u.cls ?? u.dc ?? 'Undead', emoji:u.emoji ?? '☠' })),
          },
          screen:SCREEN.MISSION_RESULTS,
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
            const ps = computePromotedStats(u, cls);
            const promotedName = `${u.pname} the ${cls.name}`;
            return {
              ...u,
              cls:           cls.name,
              classId:       cls.id,
              tier:          cls.tier,
              baseClass:     cls.baseClass,
              emoji:         cls.emoji,
              name:          promotedName,
              hp:            ps.hp,
              maxHp:         ps.hp,
              dmg:           ps.dmg,
              def:           ps.def,
              moveRange:     ps.move,
              attackRange:   ps.range,
              trapReveal:    ps.trapReveal,
              weapon:        u.weapon ?? null,
              armor:         u.armor  ?? null,
              silentAttacks:        cls.silentAttacks ?? false,
              untargetableInShadow: cls.untargetableInShadow ?? false,
              cannotInteract:       cls.cannotInteract ?? false,
              forestCostZero:       cls.forestCostZero ?? false,
              fullMapRevealOnEntry: cls.fullMapRevealOnEntry ?? false,
              boneExplosion:        cls.boneExplosion ?? false,
              surviveOnce:          cls.surviveOnce ?? false,
              regenPerTurn:         cls.regenPerTurn ?? 0,
              immunities:           cls.immunities ?? [],
              classAbility:  abilityId,
              abilityUses:   { [abilityId]: ab?.usesPerEncounter ?? 0 },
              abilityArmed:  ab?.type === 'reactive',
              encounterKills: 0, encounterBonusDmg: 0, encounterBonusMove: 0,
              surviveUsed: false,
              lifetime_levels: u.lifetime_levels ?? u.level ?? 1,
            };
          });
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

      // Apply a class promotion from the level-up queue (level 2 class selection)
      applyPromotionFromLu(unitId, classId, abilityId) {
        const cls = CLASSES[classId];
        if (!cls) return;
        const ab = ABILITIES[abilityId];
        set(s => {
          const promote = (u) => {
            const ps = computePromotedStats(u, cls);
            const promotedName = `${u.pname} the ${cls.name}`;
            return {
              ...u,
              cls:           cls.name,
              classId:       cls.id,
              tier:          cls.tier,
              baseClass:     cls.baseClass,
              emoji:         cls.emoji,
              name:          promotedName,
              hp:            ps.hp,
              maxHp:         ps.hp,
              dmg:           ps.dmg,
              def:           ps.def,
              moveRange:     ps.move,
              attackRange:   ps.range,
              trapReveal:    ps.trapReveal,
              weapon:        u.weapon ?? null,
              armor:         u.armor  ?? null,
              silentAttacks:        cls.silentAttacks ?? false,
              untargetableInShadow: cls.untargetableInShadow ?? false,
              cannotInteract:       cls.cannotInteract ?? false,
              forestCostZero:       cls.forestCostZero ?? false,
              fullMapRevealOnEntry: cls.fullMapRevealOnEntry ?? false,
              boneExplosion:        cls.boneExplosion ?? false,
              surviveOnce:          cls.surviveOnce ?? false,
              regenPerTurn:         cls.regenPerTurn ?? 0,
              immunities:           cls.immunities ?? [],
              classAbility:  abilityId,
              abilityUses:   { [abilityId]: ab?.usesPerEncounter ?? 0 },
              abilityArmed:  ab?.type === 'reactive',
              bondedAbilities: u.bondedAbilities ?? [],
              bondedArmed:    u.bondedArmed ?? {},
              encounterKills: 0, encounterBonusDmg: 0, encounterBonusMove: 0,
              surviveUsed: false,
              lifetime_levels: u.lifetime_levels ?? u.level ?? 1,
            };
          };
          const source = s.ms?.units.find(u => u.id === unitId) ?? s.roster.find(u => u.id === unitId);
          const pname = source?.pname ?? '?';
          return {
            roster: s.roster.map(u => u.id === unitId ? promote(u) : u),
            ms: s.ms ? { ...s.ms, units: s.ms.units.map(u => u.id === unitId ? promote(u) : u) } : s.ms,
            luq: s.luq.slice(1),
            log: [`${cls.emoji} ${pname} ascends to ${cls.name}!`, ...s.log].slice(0, 14),
          };
        });
        debouncedSave(get);
      },

      // Ascend a tier-2 unit to tier-3 at the Ascension Forge
      ascendUnit(unitId, classId, abilityId, sacrificeId) {
        const cls = CLASSES[classId];
        if (!cls || cls.tier !== 3) return;
        const ab = ABILITIES[abilityId];
        set(s => {
          const u = s.roster.find(r => r.id === unitId);
          if (!u || u.level < 5 || u.tier !== 2) return s;
          const sac = sacrificeId ? s.roster.find(r => r.id === sacrificeId) : null;
          const bonus = sac ? calcSacrificeBonus(sac) : null; // null for tier-3 sac (tier-3 can't be used for Ascension)
          const ps = computePromotedStats(u, cls);
          const promotedName = `${u.pname} the ${cls.name}`;
          const promoted = {
            ...u,
            cls:           cls.name,
            classId:       cls.id,
            tier:          3,
            baseClass:     cls.baseClass,
            emoji:         cls.emoji,
            name:          promotedName,
            hp:            ps.hp  + (bonus?.hp   ?? 0),
            maxHp:         ps.hp  + (bonus?.hp   ?? 0),
            dmg:           ps.dmg + (bonus?.dmg  ?? 0),
            def:           ps.def,
            moveRange:     ps.move + (bonus?.move ?? 0),
            attackRange:   ps.range,
            trapReveal:    ps.trapReveal,
            weapon:        u.weapon ?? null,
            armor:         u.armor  ?? null,
            silentAttacks:        cls.silentAttacks ?? false,
            untargetableInShadow: cls.untargetableInShadow ?? false,
            cannotInteract:       cls.cannotInteract ?? false,
            forestCostZero:       cls.forestCostZero ?? false,
            fullMapRevealOnEntry: cls.fullMapRevealOnEntry ?? false,
            boneExplosion:        cls.boneExplosion ?? false,
            surviveOnce:          cls.surviveOnce ?? false,
            regenPerTurn:         cls.regenPerTurn ?? 0,
            immunities:           cls.immunities ?? [],
            classAbility:  abilityId,
            abilityUses:   { [abilityId]: ab?.usesPerEncounter ?? 0 },
            abilityArmed:  ab?.type === 'reactive',
            bondedAbilities: u.bondedAbilities ?? [],
            bondedArmed: {},
            encounterKills: 0, encounterBonusDmg: 0, encounterBonusMove: 0,
            surviveUsed: false,
            lifetime_levels: u.lifetime_levels ?? u.level ?? 1,
          };
          const sacLog = sac ? ` (${sac.pname} consumed)` : '';
          return {
            roster: s.roster.filter(r => r.id !== sacrificeId).map(r => r.id === unitId ? promoted : r),
            log: [`⚗️ ${u.pname} ascends to ${cls.name}!${sacLog}`, ...s.log].slice(0, 14),
          };
        });
        debouncedSave(get);
      },

      ascendVarek(choice) {
        set(s => {
          const newAscensions = (s.vp.varekAscensions || 0) + 1;
          if (choice === 'dmg') {
            return {
              vp: { ...s.vp, dmg: (s.vp.dmg || 2) + 2, varekAscensions: newAscensions },
              log: [`🧙 Varek ascends — Drain +2! (now ${(s.vp.dmg || 2) + 2})`, ...s.log].slice(0, 14),
            };
          }
          const ab = ABILITIES[choice];
          return {
            vp: { ...s.vp, varekAbilities: [...(s.vp.varekAbilities || []), choice], varekAscensions: newAscensions },
            log: [`🧙 Varek ascends — learned ${ab?.name ?? choice}!`, ...s.log].slice(0, 14),
          };
        });
        debouncedSave(get);
      },

      checkAchievements() {
        set(s => {
          const a   = s.achievements || {};
          const cur = s.varekAchievements || [];
          const unlock = [], logs = [];
          function tryUnlock(id, cond, msg) {
            if (!cur.includes(id) && cond) { unlock.push(id); logs.push(`🧙 Achievement: ${msg}`); }
          }
          const nonMulti = BUILDINGS.filter(b => !b.multi).map(b => b.id);
          tryUnlock('tether_pulse',   s.nodes.includes('ascension_forge'),  'Ascension Forge built — learned Tether Pulse');
          tryUnlock('pale_ward',      !!a.villageAllied,                    'Village allied — learned Pale Ward');
          tryUnlock('desecrate',      !!a.villageDestroyed,                 'Village destroyed — learned Desecrate');
          tryUnlock('varek_mark',     !!a.firstBossRaised,                  'First boss raised — learned Mark');
          tryUnlock('reclaim',        (a.totalFallen||0) >= 10,             '10 allies fallen — learned Reclaim');
          tryUnlock('phantom_sight',  nonMulti.every(id => s.nodes.includes(id)), 'Sanctuary complete — learned Phantom Sight');
          tryUnlock('grief',          !!a.sanctuaryLost,                    'Sanctuary lost — learned Grief');
          tryUnlock('grave_knowledge', (a.dungeonsCleared||0) >= 5,         '5 dungeons cleared — learned Grave Knowledge');
          tryUnlock('unravel',        !!a.firstRebirth,                     'First rebirth — learned Unravel');
          if (!unlock.length) return s;
          return {
            varekAchievements: [...cur, ...unlock],
            log: [...logs, ...s.log].slice(0, 14),
          };
        });
        debouncedSave(get);
      },

      // Reset a unit to level-1 baseline stats, retaining class and abilities
      rebirthUnit(unitId, sacrificeId) {
        set(s => {
          const u = s.roster.find(r => r.id === unitId);
          if (!u || !u.classId) return s;
          const sac = sacrificeId ? s.roster.find(r => r.id === sacrificeId) : null;
          const base = CLASS_STATS[u.dc] ?? { hp:6, dmg:3, def:0, moveRange:3, trapReveal:1, attackRange:1 };
          let reborn;
          let sacLog = '';
          if (sac?.tier === 3) {
            // Tier-3 sacrifice: append classAbility as bonded ability (dedup)
            const aidToAdd = sac.classAbility;
            const existing = u.bondedAbilities ?? [];
            const alreadyHas = aidToAdd && (existing.includes(aidToAdd) || aidToAdd === u.classAbility);
            const newBonded = aidToAdd && !alreadyHas ? [...existing, aidToAdd] : existing;
            sacLog = aidToAdd && !alreadyHas
              ? ` Inherited ${ABILITIES[aidToAdd]?.name ?? aidToAdd}.`
              : ` (ability already known)`;
            reborn = {
              ...u,
              level:          1,
              xp:             0,
              hp:             base.hp,
              maxHp:          base.hp,
              dmg:            base.dmg,
              def:            base.def,
              moveRange:      base.moveRange,
              attackRange:    base.attackRange,
              trapReveal:     base.trapReveal,
              dmgUpgrades:    0,
              bondedAbilities: newBonded,
              bondedArmed:    {},
              lifetime_levels: (u.lifetime_levels ?? 0) + (u.level ?? 1),
            };
          } else {
            // Tier-1/2 sacrifice: stat bonus + starting XP
            const bonus = sac ? calcSacrificeBonus(sac) : null;
            reborn = {
              ...u,
              level:       1,
              xp:          bonus?.startingXp ?? 0,
              hp:          base.hp  + (bonus?.hp   ?? 0),
              maxHp:       base.hp  + (bonus?.hp   ?? 0),
              dmg:         base.dmg + (bonus?.dmg  ?? 0),
              def:         base.def,
              moveRange:   base.moveRange + (bonus?.move ?? 0),
              attackRange: base.attackRange,
              trapReveal:  base.trapReveal,
              dmgUpgrades: 0,
              bondedAbilities: u.bondedAbilities ?? [],
              bondedArmed: {},
              lifetime_levels: (u.lifetime_levels ?? 0) + (u.level ?? 1),
            };
            if (sac) sacLog = ` (${sac.pname} consumed)`;
          }
          return {
            roster: s.roster.filter(r => r.id !== sacrificeId).map(r => r.id === unitId ? reborn : r),
            log: [`🔄 ${u.pname} reborn — stats reset, class retained.${sacLog}`, ...s.log].slice(0, 14),
          };
        });
        debouncedSave(get);
      },

      resetGame() {
        set({ screen:SCREEN.HOME, book:null, vp:{ ...DEFAULT_VP }, roster:[], inv:{},
          nodes:[], ms:null, noise:0, luq:[], log:[], phase:'player',
          equipTgt:null, loc:null, mode:'scavenge', unlockedLocs:['town'],
          world:null, worldPos:null, sanctuaryPos:null, selectedHex:null,
          pendingSanctuaryTile:null, worldPath:[], travelBag:{},
          sanctuaryGrid:null, activeSlot:null, promotionQueue:[],
          locationVisits:{}, locationScavenges:{}, locationBosses:{}, missionResult:null });
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
        set({ world:{ ...world, tiles:revealedTiles }, worldPos:{ col, row }, sanctuaryPos:null, selectedHex:null, screen:SCREEN.WORLD });
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
        debouncedSave(get);

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
        const presets = { farm:[3,4], quarry:[5,4], forge:[7,4], storage:[9,4], barracks:[11,4], workshop:[13,4], ascension_forge:[3,6], rebirth_table:[7,6] };
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
        loadBestiary(user?.id ?? null).then(data => {
          if (data && Object.keys(data).length) set({ bestiary: data });
        });
      },
      setSaveSlots(slots)  { set({ saveSlots: slots }); },

      // ── Load a full save into the store ───────────────────────────────
      loadSaveIntoStore(data, slot) {
        const world = data.world ?? null;
        const worldPos = data.world_pos ?? null;
        const canResumeWorld = isPlayableWorld(world, worldPos);
        set({
          vp:             data.vp              ?? { ...DEFAULT_VP },
          roster:         data.roster          ?? [],
          inv:            data.inv             ?? {},
          travelBag:      data.travel_bag      ?? {},
          nodes:          data.nodes           ?? [],
          book:           data.book            ?? null,
          world,
          worldPos,
          sanctuaryPos:   data.sanctuary_pos   ?? null,
          unlockedLocs:   data.unlocked_locs   ?? ['town'],
          log:            data.log             ?? [],
          sanctuaryGrid:  data.sanctuary_grid  ?? null,
          locationVisits: data.location_visits ?? {},
          activeSlot:     slot,
          // Reset transient state
          ms: null, phase:'player', luq:[], noise:0, selectedHex:null,
          equipTgt:null, loc:null, worldPath:[], pendingSanctuaryTile:null, missionResult:null,
          screen: canResumeWorld ? SCREEN.WORLD : SCREEN.TITLE,
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
          pendingSanctuaryTile:null, missionResult:null, activeSlot:slot, screen:SCREEN.TITLE,
        });
      },

      // ── Level-up ──────────────────────────────────────────────────────
      applyLu(choice) {
        set(s => {
          if (!s.luq.length) return s;
          const entry = s.luq[0];
          if (entry.type === 'class_promotion') return s;
          const { uid } = entry;
          const isVarek = uid === 'varek';
          const hpGain = isVarek ? 4 : 3;
          const boost = (u) => {
            const autoTether = isVarek ? 1 : 0;
            const base = { ...u, tetherCap: (u.tetherCap||1) + autoTether };
            if (choice==='tether') return { ...base, tetherCap: base.tetherCap + 1 };
            if (choice==='drain')  return { ...base, drainRange: u.drainRange + 1 };
            if (choice==='hp')     return { ...base, maxHp: u.maxHp + hpGain, hp: u.hp + hpGain };
            if (choice==='raise')  return { ...base, raiseRange: u.raiseRange + 1 };
            if (choice==='dmg')    return { ...base, dmg: (u.dmg||2) + 1, dmgUpgrades: (u.dmgUpgrades||0) + 1 };
            if (choice==='move')   return { ...base, moveRange: u.moveRange + 1 };
            if (choice==='evasion') return { ...base, evasionBonus: Math.min(5, (u.evasionBonus||0) + 1) };
            return base;
          };
          const newLuq = s.luq.slice(1);
          const logLine = 'Level up applied!';
          if (s.ms) {
            return {
              ms: { ...s.ms, units: s.ms.units.map(u => u.id !== uid ? u : boost(u)) },
              luq: newLuq,
              log: [logLine, ...s.log].slice(0, 14),
            };
          }
          if (isVarek) {
            const fake = { tetherCap:s.vp.tetherCap||1, drainRange:s.vp.drainRange||2, raiseRange:s.vp.raiseRange||2, hp:s.vp.hp, maxHp:s.vp.maxHp, moveRange:s.vp.moveRange||3, dmg:s.vp.dmg||2, evasionBonus:s.vp.evasionBonus||0 };
            const b = boost(fake);
            return {
              vp: { ...s.vp, tetherCap:b.tetherCap, drainRange:b.drainRange, raiseRange:b.raiseRange, hp:b.hp, maxHp:b.maxHp, moveRange:b.moveRange, dmg:b.dmg, evasionBonus:b.evasionBonus },
              luq: newLuq,
              log: [logLine, ...s.log].slice(0, 14),
            };
          }
          return {
            roster: s.roster.map(u => u.id !== uid ? u : boost(u)),
            luq: newLuq,
            log: [logLine, ...s.log].slice(0, 14),
          };
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
          dc: fallen.dc,
          baseClass: DC_TO_BASE[fallen.dc] ?? null,
          x:fallen.x, y:fallen.y, ...stats,
          actionPoints:0, movementPoints:0, fallen:false, raiseTurn:null, atBase:false,
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
        if (!unit || unit.movementPoints <= 0) return;

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
          units = units.map(u => u.id===sel ? { ...u, hp:u.hp-dmg, x, y, movementPoints:u.movementPoints-1 } : u);
          const af = units.find(u => u.id === sel);
          if (af.hp <= 0) {
            if (sel === 'varek') { over=true; logs.push('Varek falls.'); }
            else { units=units.map(u => u.id===sel ? { ...u, fallen:true, raiseTurn:ms.turn } : u); logs.push(`${unit.name} falls!`); }
          }
        } else if (t.type === TILE.LOOT) {
          tiles[y][x] = { type:TILE.LOOT_OPEN };
          const floorDepth = s.ms?.floor ?? 1;
          const floorKey = Math.min(floorDepth, 4);
          const tbl = (floorDepth > 1 && FLOOR_LOOT[floorKey]) ? FLOOR_LOOT[floorKey] : LOOT[s.loc.lq];
          const iid = tbl[Math.floor(Math.random()*tbl.length)];
          loot.push(iid);
          logs.push(`${unit.emoji} Found ${item(iid)?.emoji} ${item(iid)?.name}!`);
          nn += 5;
          units = units.map(u => u.id===sel ? { ...u, x, y, movementPoints:u.movementPoints-1 } : u);
          // loot_named objective: opening the marked cache completes it
          if (objective?.type === 'loot_named' && objective.targetX === x && objective.targetY === y && !objective.complete) {
            objective = { ...objective, complete: true };
            loot.push(...(objective.bonus || []));
            logs.push(`⭐ Marked cache recovered — objective complete!`);
          }
        } else if (t.type === TILE.RUBBLE) {
          nn += 3;
          units = units.map(u => u.id===sel ? { ...u, x, y, movementPoints:u.movementPoints-1 } : u);
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
          units = units.map(u => u.id===sel ? { ...u, x, y, movementPoints:u.movementPoints-1 } : u);
        } else if (t.type === TILE.FIRE) {
          logs.push(`🔥 ${unit.name} runs through fire! (-1hp)`);
          nn += 10;
          units = units.map(u => u.id===sel ? { ...u, hp:u.hp-1, x, y, movementPoints:u.movementPoints-1 } : u);
          const af = units.find(u => u.id === sel);
          if (af && af.hp <= 0) {
            if (sel === 'varek') { over=true; logs.push('Varek burns!'); }
            else { units=units.map(u => u.id===sel ? { ...u, fallen:true, raiseTurn:ms.turn } : u); logs.push(`${unit.name} burns!`); }
          }
        } else if (t.type === TILE.DOOR) {
          if (!t.open) {
            tiles[y][x] = { ...t, open: true };
            logs.push(`${unit.name} opens the door.`);
            units = units.map(u => u.id===sel ? { ...u, movementPoints:u.movementPoints-1 } : u);
          } else {
            units = units.map(u => u.id===sel ? { ...u, x, y, movementPoints:u.movementPoints-1 } : u);
          }
        } else {
          units = units.map(u => u.id===sel ? { ...u, x, y, movementPoints:u.movementPoints-1 } : u);
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

        if (over) setTimeout(() => get().setScreen(SCREEN.GAME_OVER), 500);
        if (esc)  setTimeout(() => get().endMission(units, loot, true), 400);
      },

      // ── Attack ────────────────────────────────────────────────────────
      doAttack(enemy, sel) {
        const s = get();
        if (!sel || s.phase !== 'player') return;
        const att = s.ms.units.find(u => u.id === sel);
        if (!att || att.actionPoints <= 0) return;
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

          // Ghost Arrow / True Aim: ignore DEF (class or bonded)
          const ignoreDef = attUnit.classAbility === 'ghost_arrow' || attUnit.classAbility === 'true_aim'
            || (attUnit.bondedAbilities ?? []).includes('ghost_arrow')
            || (attUnit.bondedAbilities ?? []).includes('true_aim');
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
          // e_battle_hardened: enemy takes -1 dmg (passive)
          const battleHardenedReduction = (defUnit.abilities ?? []).includes('e_battle_hardened') ? 1 : 0;
          // e_pack_tactics attacker bonus (player units don't have it, so always 0 here)
          let dmg = Math.max(1, (attUnit.dmg||2) + wb + bonusDmg + ambushBonus - defVal + markBonus - armoredReduction - battleHardenedReduction);

          // Incorporeal: 30% dodge (class or bonded)
          const hasIncorporeal = defUnit.classAbility === 'incorporeal'
            || (defUnit.bondedAbilities ?? []).includes('incorporeal');
          if (hasIncorporeal && Math.random() < 0.3) {
            logs.push(`👻 ${defUnit.name} phases through the attack!`);
            units = units.map(u => u.id === sel ? { ...u, actionPoints:u.actionPoints-1 } : u);
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
            units = units.map(u => u.id === sel ? { ...u, actionPoints:u.actionPoints-1 } : u);
            return { ms:{ ...prev.ms, units, loot:bonusLoot, keys:newKeys, objective }, luq,
              log:[...logs, ...prev.log].slice(0,14) };
          }

          // Reactive: bone_shield / shield_wall / fortress_shell / immovable / construct_armor
          // Checks both classAbility (abilityArmed) and bondedAbilities (bondedArmed)
          const reactiveShields = ['bone_shield','shield_wall','construct_armor'];
          const reactiveReflect = ['fortress_shell','immovable'];
          const armedReactives = [];
          if (defUnit.abilityArmed && defUnit.classAbility) armedReactives.push({ aid: defUnit.classAbility, bonded: false });
          for (const bAid of (defUnit.bondedAbilities ?? [])) {
            if (defUnit.bondedArmed?.[bAid]) armedReactives.push({ aid: bAid, bonded: true });
          }
          let reactiveHit = false;
          for (const { aid: rAid, bonded: rBonded } of armedReactives) {
            if (!reactiveShields.includes(rAid) && !reactiveReflect.includes(rAid)) continue;
            const usesLeft = defUnit.abilityUses?.[rAid] ?? 0;
            if (usesLeft <= 0) continue;
            const disarmPatch = rBonded
              ? { bondedArmed: { ...(defUnit.bondedArmed ?? {}), [rAid]: false }, abilityUses: { ...defUnit.abilityUses, [rAid]: usesLeft - 1 } }
              : { abilityArmed: false, abilityUses: { ...defUnit.abilityUses, [rAid]: usesLeft - 1 } };
            if (rAid === 'construct_armor') {
              dmg = 1;
              logs.push(`🤖 ${defUnit.name}'s Construct Armor reduces hit to 1!`);
              units = units.map(u => u.id===enemy.id ? { ...u, ...disarmPatch } : u);
              reactiveHit = true;
              break;
            } else {
              logs.push(`🛡 ${defUnit.name}'s ${ABILITIES[rAid]?.name} triggers — hit negated!`);
              if (reactiveReflect.includes(rAid)) {
                const rfl = 2;
                logs.push(`↩️ ${defUnit.name} reflects ${rfl} dmg!`);
                units = units.map(u => {
                  if (u.id !== sel) return u;
                  const nh = u.hp - rfl;
                  if (nh <= 0) {
                    if (sel==='varek') { setTimeout(()=>get().setScreen(SCREEN.GAME_OVER),300); return {...u,hp:0}; }
                    return {...u,hp:0,fallen:true,raiseTurn:prev.ms.turn};
                  }
                  return {...u,hp:nh};
                });
              }
              units = units.map(u => u.id===sel ? {...u,actionPoints:u.actionPoints-1} : u);
              units = units.map(u => u.id===enemy.id ? { ...u, ...disarmPatch } : u);
              return { ms:{...prev.ms,units,loot:bonusLoot,keys:newKeys,objective}, luq,
                log:[...logs,...prev.log].slice(0,14) };
            }
          }
          void reactiveHit;

          // ── Defender's reaction: dodge / counter / defend ──────────────
          const defenseResult = resolveDefense(attUnit, defUnit, dmg);
          if (defenseResult.outcome === 'dodge') {
            logs.push(`💨 ${defUnit.name} dodges the attack!`);
            dmg = 0;
          } else if (defenseResult.outcome === 'defend') {
            dmg = defenseResult.dmg;
            logs.push(`🛡 ${defUnit.name} braces and takes only ${dmg}!`);
          } else if (defenseResult.outcome === 'counter') {
            dmg = defenseResult.dmg;
          }

          // Apply hit
          if (defenseResult.outcome !== 'dodge') {
            logs.push(`${attUnit.emoji} ${attUnit.name} → ${defUnit.name} for ${dmg}!`);
          }
          units = units.map(u => {
            if (u.id === enemy.id) {
              if (dmg <= 0) return { ...u, alerted:true };
              const nh = u.hp - dmg;
              if (nh <= 0) { logs.push(`${defUnit.name} falls! Raise within 3 turns.`); return { ...u, hp:0, fallen:true, raiseTurn:prev.ms.turn }; }
              return { ...u, hp:nh, alerted:true };
            }
            if (u.id === sel) return { ...u, actionPoints:u.actionPoints-1 };
            return u;
          });

          // Counter-attack: defender strikes back immediately if it survived
          if (defenseResult.outcome === 'counter') {
            const survAfterHit = units.find(u => u.id === enemy.id && !u.fallen);
            if (survAfterHit) {
              const cdmg = defenseResult.counterDmg;
              logs.push(`↩️ ${defUnit.name} counters for ${cdmg}!`);
              units = units.map(u => {
                if (u.id !== sel) return u;
                const nh = u.hp - cdmg;
                if (nh <= 0) {
                  if (sel==='varek') { setTimeout(()=>get().setScreen(SCREEN.GAME_OVER),300); return {...u,hp:0}; }
                  logs.push(`${u.name} falls!`);
                  return {...u,hp:0,fallen:true,raiseTurn:prev.ms.turn};
                }
                return {...u,hp:nh};
              });
            }
          }

          // ── Enemy passive reactions to taking damage ──────────────────
          const hitUnit = units.find(u => u.id === enemy.id && !u.fallen);
          if (hitUnit) {
            if ((hitUnit.abilities ?? []).includes('e_bloodrage') && (hitUnit.bloodrageStacks ?? 0) < 3) {
              const stacks = (hitUnit.bloodrageStacks ?? 0) + 1;
              units = units.map(u => u.id===enemy.id ? { ...u, bloodrageStacks:stacks, dmg:u.dmg+1 } : u);
              logs.push(`💢 ${hitUnit.name} Bloodrage! DMG +${stacks} total.`);
            }
            if ((hitUnit.abilities ?? []).includes('e_enrage') && !hitUnit.enrageTriggered && hitUnit.hp <= Math.ceil(hitUnit.maxHp * 0.5)) {
              units = units.map(u => u.id===enemy.id ? { ...u, enrageTriggered:true, dmg:u.dmg+2, moveRange:(u.moveRange||2)+1 } : u);
              logs.push(`🐻 ${hitUnit.name} Enrages — +2 DMG +1 Move!`);
            }
          }

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
          const thornAbilities = ['thornwall','briarvine','briarvine_warden','root_strike'];
          const activeThorn = thornAbilities.find(ta =>
            (ta === defUnit.classAbility && defUnit.abilityArmed) ||
            ((defUnit.bondedAbilities ?? []).includes(ta) && defUnit.bondedArmed?.[ta])
          );
          if (activeThorn && isMelee) {
            const tw = activeThorn;
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
              } else if (tw === 'root_strike') {
                logs.push(`🌿 ${defUnit.name}'s Root Strike roots attacker!`);
                units = units.map(u => u.id===sel ? {
                  ...u, statusEffects:[...(u.statusEffects||[]),{id:'root',duration:1,magnitude:1,sourceId:enemy.id}]
                } : u);
              } else {
                logs.push(`🌿 ${defUnit.name}'s Thornwall triggers!`);
              }
              const twBonded = (defUnit.bondedAbilities ?? []).includes(tw) && tw !== defUnit.classAbility;
              units = units.map(u => u.id===enemy.id ? {
                ...u,
                ...(twBonded
                  ? { bondedArmed: { ...(u.bondedArmed ?? {}), [tw]: false }, abilityUses: { ...u.abilityUses, [tw]: twUses - 1 } }
                  : { abilityArmed: false, abilityUses: { ...u.abilityUses, [tw]: twUses - 1 } }),
              } : u);
            }
          }

          // Thornmail / Briarwall passive: reflect on melee hit (class or bonded)
          if (isMelee && !units.find(u=>u.id===enemy.id)?.fallen) {
            const allAbilities = [defUnit.classAbility, ...(defUnit.bondedAbilities ?? [])].filter(Boolean);
            if (allAbilities.includes('thornmail')) {
              logs.push(`🌿 ${defUnit.name}'s Thornmail: 1 dmg reflected!`);
              units = units.map(u => { if(u.id!==sel) return u; const nh=u.hp-1; return nh<=0?{...u,hp:0,fallen:true,raiseTurn:prev.ms.turn}:{...u,hp:nh}; });
            }
            if (allAbilities.includes('briarwall')) {
              logs.push(`🌿 ${defUnit.name}'s Briarwall: 2 dmg + Slow!`);
              units = units.map(u => { if(u.id!==sel) return u; const nh=u.hp-2; return nh<=0?{...u,hp:0,fallen:true,raiseTurn:prev.ms.turn}:{...u,hp:nh,statusEffects:[...(u.statusEffects||[]),{id:'slow',duration:1,magnitude:1,sourceId:enemy.id}]}; });
            }
          }

          // drain_touch passive: heal attacker 1hp on melee hit (class or bonded)
          const attAllAbilities = [attUnit.classAbility, ...(attUnit.bondedAbilities ?? [])].filter(Boolean);
          if (attAllAbilities.includes('drain_touch') && isMelee) {
            units = units.map(u => u.id===sel ? {...u,hp:Math.min(u.maxHp,u.hp+1)} : u);
          }

          // Verdant Rite lifesteal: Varek at dmg cap 6 heals floor(dmg/2) per drain hit
          if (attUnit.type === UT.VAREK && prev.book?.id === 'verdant' && (attUnit.dmg||2) >= 6) {
            const heal = Math.floor((attUnit.dmg||2) / 2);
            units = units.map(u => u.id===sel ? {...u,hp:Math.min(u.maxHp,u.hp+heal)} : u);
            logs.push(`🌿 Verdant drain restores ${heal} HP to Varek!`);
          }

          // XP — tier formula + tier comparison multiplier
          units = applyXpToUnits(units, sel, 1, luq);
          const killed = units.find(u => u.id===enemy.id && u.fallen && u.raiseTurn===prev.ms.turn);
          if (killed) {
            const enemyTier = enemy.xpTier ?? (enemy.isBoss ? 3 : 1);
            const baseKillXp = killXpByTier(enemy.maxHp || 5, enemyTier, !!enemy.isBoss);
            const mult = xpTierMultiplier(attUnit.level ?? 1, !!attUnit.reborn, enemyTier);
            const killXp = Math.max(1, Math.round(baseKillXp * mult));
            units = applyXpToUnits(units, sel, killXp, luq);
            if (killed.holdsKey && killed.keyId) { newKeys = [...newKeys, killed.keyId]; logs.push(`🔑 ${attUnit.name} finds a key!`); }
            if (objective?.type==='eliminate' && objective.targetId===enemy.id && !objective.complete) {
              objective = {...objective,complete:true}; bonusLoot=[...bonusLoot,...(objective.bonus||[])];
              logs.push(`⭐ Target eliminated — objective complete!`);
            }
            // bloodlust / carnage: +DMG per kill (class or bonded)
            if (attAllAbilities.includes('bloodlust') || attAllAbilities.includes('carnage')) {
              units = units.map(u => u.id===sel ? {
                ...u,
                encounterKills:(u.encounterKills||0)+1,
                encounterBonusDmg:(u.encounterBonusDmg||0)+1,
                ...(attAllAbilities.includes('carnage')?{encounterBonusMove:(u.encounterBonusMove||0)+1}:{}),
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
                  if (sel==='varek') { setTimeout(()=>get().setScreen(SCREEN.GAME_OVER),300); return {...u,hp:0}; }
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
        if (!unit || unit.fallen || unit.actionPoints <= 0) return;
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
        const newUnits = ms.units.map(u => u.id === sel ? { ...u, actionPoints: u.actionPoints - 1 } : u);
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
        if (!unit || unit.fallen || unit.actionPoints <= 0 || unit.movementPoints <= 0) return;
        const tile = ms.tiles[y]?.[x];
        if (!tile || tile.type !== TILE.TRAP) return;
        const dx = Math.abs(unit.x - x), dy = Math.abs(unit.y - y);
        if (dx + dy !== 1) return;
        const newTiles = ms.tiles.map((row, ry) =>
          row.map((t, rx) => (rx === x && ry === y) ? { type: TILE.FLOOR } : t)
        );
        const newUnits = ms.units.map(u => u.id === sel ? { ...u, actionPoints: 0, movementPoints: 0 } : u);
        set(prev => ({
          ms: { ...prev.ms, tiles: newTiles, units: newUnits },
          log: [`🔧 ${unit.name} disarms the trap.`, ...prev.log].slice(0, 14),
        }));
      },

      // ── Toggle reactive ability armed ────────────────────────────────
      // abilityId omitted → toggle classAbility arm; provided → toggle bonded ability
      toggleAbilityArmed(unitId, abilityId) {
        set(prev => ({
          ms: {
            ...prev.ms,
            units: prev.ms.units.map(u => {
              if (u.id !== unitId) return u;
              if (!abilityId || abilityId === u.classAbility) {
                return { ...u, abilityArmed: !u.abilityArmed };
              }
              return { ...u, bondedArmed: { ...(u.bondedArmed ?? {}), [abilityId]: !u.bondedArmed?.[abilityId] } };
            }),
          },
        }));
      },

      waitUnit(unitId) {
        set(prev => {
          if (!prev.ms) return prev;
          return { ms: { ...prev.ms, units: prev.ms.units.map(u => u.id === unitId ? { ...u, actionPoints:0, movementPoints:0 } : u) } };
        });
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
          if (actor.actionPoints <= 0) return prev;

          const usesLeft = actor.abilityUses?.[abilityId] ?? 0;
          if (usesLeft <= 0) return prev;

          // Ambush/superior_ambush are free primes — don't cost AP
          const freeAction = abilityId === 'ambush' || abilityId === 'superior_ambush';
          if (!freeAction) actor.actionPoints = Math.max(0, actor.actionPoints - 1);
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
              adj.forEach(u => { u.actionPoints = Math.max(0, u.actionPoints - 1); });
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
            case 'volley': {
              const t2 = units.find(u => u.id === targetUnitId);
              if (!t2 || t2.type !== UT.ENEMY || dist(actor, t2) > (actor.attackRange||3)) break;
              const dx = Math.sign(t2.x - actor.x), dy = Math.sign(t2.y - actor.y);
              const targets = units.filter(u => !u.fallen && u.id !== unitId && dist(actor, u) <= (actor.attackRange||3)
                && (dx === 0 ? u.x === actor.x : Math.sign(u.x - actor.x) === dx)
                && (dy === 0 ? u.y === actor.y : Math.sign(u.y - actor.y) === dy));
              targets.forEach(u => {
                const d = Math.max(1, actor.dmg - (u.def||0));
                u.hp = Math.max(0, u.hp - d);
                if (u.hp <= 0) u.fallen = true;
              });
              logs.push(`🏹 Volley — ${targets.length} unit${targets.length!==1?'s':''} hit`);
              break;
            }
            case 'scatter_shot': {
              const t2 = units.find(u => u.id === targetUnitId);
              if (!t2 || t2.type !== UT.ENEMY || dist(actor, t2) > (actor.attackRange||3)) break;
              const targets = units
                .filter(u => u.type === UT.ENEMY && !u.fallen && dist(actor, u) <= (actor.attackRange||3))
                .sort((a,b) => (a.id === t2.id ? -1 : b.id === t2.id ? 1 : dist(actor,a) - dist(actor,b)))
                .slice(0, 3);
              targets.forEach(u => {
                const d = Math.max(1, actor.dmg - 1 - (u.def||0));
                u.hp = Math.max(0, u.hp - d);
                if (u.hp <= 0) u.fallen = true;
              });
              logs.push(`🏹 Scatter Shot — ${targets.length} enem${targets.length===1?'y':'ies'} hit`);
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
            case 'thornfield': case 'thornfield_shot': case 'stranglehold_field': {
              const radius = abilityId === 'thornfield' ? 2 : 3;
              const duration = abilityId === 'stranglehold_field' ? 5 : 3;
              const enemies = units.filter(u => u.type === UT.ENEMY && !u.fallen && dist(actor, u) <= radius);
              enemies.forEach(u => {
                u.statusEffects = [...(u.statusEffects||[]), { id:'slow', duration, magnitude:0, sourceId:unitId }];
                if (abilityId === 'stranglehold_field') {
                  u.hp = Math.max(0, u.hp - 1);
                  if (u.hp <= 0) u.fallen = true;
                }
              });
              logs.push(`🌿 ${ABILITIES[abilityId]?.name ?? 'Field'} — ${enemies.length} enemies affected`);
              break;
            }
            case 'death_mark': case 'varek_mark': {
              const t2 = units.find(u => u.id === targetUnitId);
              if (!t2 || t2.type !== UT.ENEMY || dist(actor, t2) > 4) break;
              t2.statusEffects = [...(t2.statusEffects||[]), { id:'marked', duration:2, magnitude: abilityId === 'varek_mark' ? 1 : 3, sourceId:unitId }];
              logs.push(`🎯 ${ABILITIES[abilityId]?.name ?? 'Mark'} — ${t2.name} marked`);
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
            case 'tether_pulse': {
              const healed = units.filter(u => u.type === UT.UNDEAD && !u.fallen && dist(actor, u) <= 3 && u.hp < u.maxHp);
              healed.forEach(u => { u.hp = Math.min(u.maxHp, u.hp + 1); });
              logs.push(`⛓ Tether Pulse — ${healed.length} undead restored`);
              break;
            }
            case 'pale_ward': {
              const ally = units.find(u => u.id === targetUnitId && u.type !== UT.ENEMY && !u.fallen);
              if (!ally || dist(actor, ally) > 1) break;
              ally.statusEffects = [...(ally.statusEffects||[]), { id:'shielded', duration:99, magnitude:999, sourceId:unitId }];
              logs.push(`🛡 Pale Ward protects ${ally.name}`);
              break;
            }
            case 'desecrate': {
              const victims = units.filter(u => u.type === UT.ENEMY && !u.fallen && dist(actor, u) <= (actor.drainRange ?? 2));
              victims.forEach(u => {
                u.hp = Math.max(0, u.hp - Math.max(1, actor.dmg||2));
                if (u.hp <= 0) u.fallen = true;
              });
              logs.push(`☠ Desecrate — ${victims.length} living enemies drained`);
              break;
            }
            case 'phantom_sight': {
              units = units.map(u => u.type === UT.ENEMY ? { ...u, alerted:true, phantomRevealed:2 } : u);
              logs.push('👁 Phantom Sight reveals all enemies');
              break;
            }
            case 'reclaim': {
              const ally = units.find(u => u.id === targetUnitId && u.type === UT.UNDEAD && u.fallen);
              if (!ally || dist(actor, ally) > 3) break;
              ally.fallen = false;
              ally.raiseTurn = null;
              ally.hp = Math.max(1, Math.ceil(ally.maxHp * 0.5));
              logs.push(`⛓ Reclaim restores ${ally.name}`);
              break;
            }
            default:
              logs.push(`${actor.name} uses ${ABILITIES[abilityId]?.name ?? abilityId}`);
          }

          // Grant XP for kills caused by this ability (tier formula)
          const actor2 = units.find(u => u.id === unitId);
          const freshKills = units.filter(u => u.type === UT.ENEMY && u.fallen && u.raiseTurn === undefined);
          freshKills.forEach(k => {
            k.raiseTurn = prev.ms.turn;
            const et = k.xpTier ?? (k.isBoss ? 3 : 1);
            const km = xpTierMultiplier(actor2?.level ?? 1, !!actor2?.reborn, et);
            const kxp = Math.max(1, Math.round(killXpByTier(k.maxHp || 5, et, !!k.isBoss) * km));
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
          let units      = ms.units.map(u => ({ ...u, actionPoints:u.fallen?0:1, movementPoints:u.fallen?0:1, moveBonusThisTurn:0 }));
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
            // swift: extra movement
            if (b.bossPassive === 'swift') b = { ...b, movementPoints: Math.min((b.movementPoints ?? 1) + 1, 2) };
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
              return dist(bossAlive, u) <= 1 ? { ...u, actionPoints: Math.max(0, u.actionPoints - 1) } : u;
            });
          }

          // ── Enemy start-of-turn passives ──────────────────────────────────
          // e_battle_cry: one Veteran per encounter grants all raiders within 3 tiles +1 move
          const battleCrySource = units.find(u => u.type===UT.ENEMY && !u.fallen && (u.abilities??[]).includes('e_battle_cry') && !u.battleCryUsed);
          if (battleCrySource) {
            units = units.map(u => u.id === battleCrySource.id ? { ...u, battleCryUsed: true } : u);
            units = units.map(u => {
              if (u.type!==UT.ENEMY || u.fallen || u.faction!=='raider') return u;
              return dist(battleCrySource, u) <= 3 ? { ...u, moveBonusThisTurn: (u.moveBonusThisTurn||0)+1 } : u;
            });
            logs.push(`⚔️ ${battleCrySource.name} rallies! Raiders surge forward.`);
          }
          // e_alpha_presence: Dire Wolf alive → all animal allies within 5 tiles +1 move
          const alphaAlive = units.find(u => u.type===UT.ENEMY && !u.fallen && (u.abilities??[]).includes('e_alpha_presence'));
          if (alphaAlive) {
            units = units.map(u => {
              if (u.type!==UT.ENEMY || u.fallen || u.faction!=='animal' || u.id===alphaAlive.id) return u;
              return dist(alphaAlive, u) <= 5 ? { ...u, moveBonusThisTurn: (u.moveBonusThisTurn||0)+1 } : u;
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

              const aRange = u.attackRange || 1;
              const effMove = (u.moveRange || 1) + (u.moveBonusThisTurn || 0);

              // ── Territorial: boss/captain stays put until player is close ──
              if ((u.territorial || u.isBoss) && !adj) {
                const trigR = u.triggerRadius ?? 5;
                if (!fr.some(f => dist(u,f) <= trigR)) return u;
              }

              // ── Support: move toward most wounded ally ─────────────────────
              if (u.aiRole === 'support' && !adj) {
                const woundedAlly = units
                  .filter(a => a.type===UT.ENEMY && !a.fallen && a.id!==u.id && a.hp < a.maxHp)
                  .sort((a,b) => (a.hp/a.maxHp)-(b.hp/b.maxHp))[0];
                if (woundedAlly) {
                  const sp = bfsGridPath(ms.tiles, u.x, u.y, woundedAlly.x, woundedAlly.y, units);
                  if (sp.length) {
                    let nx=u.x, ny=u.y, steps=0;
                    for (const step of sp) {
                      if (steps >= effMove) break;
                      if (step.x===woundedAlly.x && step.y===woundedAlly.y) break;
                      if (!walkable(ms.tiles, step.x, step.y, units)) break;
                      nx=step.x; ny=step.y; steps++;
                    }
                    if (nx!==u.x || ny!==u.y) return { ...u, x:nx, y:ny, alerted:true, chaseTurns:0, lastKnown };
                  }
                }
                // No wounded ally: stay put unless adjacent to player
                return { ...u, alerted:true, chaseTurns:0, lastKnown };
              }

              // ── Ranged: maintain preferred distance, kite backwards if too close ─
              if (u.aiRole === 'ranged' && visibleTgt) {
                const distToTgt = dist(u, visibleTgt);
                if (distToTgt < aRange && distToTgt > 0) {
                  // Too close: step away
                  const dx = Math.sign(u.x - visibleTgt.x), dy = Math.sign(u.y - visibleTgt.y);
                  let nx=u.x, ny=u.y;
                  for (let step=1; step<=effMove; step++) {
                    const tx=u.x+dx*step, ty=u.y+dy*step;
                    if (tx<1||tx>=ms.width-1||ty<1||ty>=ms.tiles.length-1) break;
                    if (!walkable(ms.tiles,tx,ty,units)) break;
                    nx=tx; ny=ty;
                  }
                  if (nx!==u.x || ny!==u.y) return { ...u, x:nx, y:ny, alerted:true, chaseTurns:0, lastKnown };
                }
                if (distToTgt <= aRange) {
                  // In range: attack from here
                  pendingAttacks.push({ attacker:u, target:visibleTgt });
                  return { ...u, alerted:true, chaseTurns:0, lastKnown };
                }
                // Out of range: move closer but stop at aRange
                const rp = bfsGridPath(ms.tiles, u.x, u.y, visibleTgt.x, visibleTgt.y, units);
                if (rp.length) {
                  let nx=u.x, ny=u.y, steps=0;
                  for (const step of rp) {
                    if (steps >= effMove) break;
                    if (dist({x:step.x,y:step.y}, visibleTgt) <= aRange) break;
                    if (!walkable(ms.tiles,step.x,step.y,units)) break;
                    nx=step.x; ny=step.y; steps++;
                  }
                  const movedU = { ...u, x:nx, y:ny, alerted:true, chaseTurns:0, lastKnown };
                  if (dist(movedU, visibleTgt) <= aRange) pendingAttacks.push({ attacker:movedU, target:visibleTgt });
                  return movedU;
                }
                return { ...u, alerted:true, chaseTurns:0, lastKnown };
              }

              // ── Flanker: target Varek specifically ─────────────────────────
              const varekUnit = fr.find(f => f.type === UT.VAREK);
              const tgt = (u.aiRole === 'flanker' && varekUnit)
                ? varekUnit
                : (adj || visibleTgt || fr.reduce((a,b) => dist(u,a)<=dist(u,b)?a:b));

              if (dist(u,tgt) <= aRange) {
                pendingAttacks.push({ attacker:u, target:tgt });
                return { ...u, alerted:true, chaseTurns:0, lastKnown };
              }
              const path = bfsGridPath(ms.tiles, u.x, u.y, tgt.x, tgt.y, units);
              if (path.length) {
                let nx = u.x, ny = u.y, steps = 0;
                for (const step of path) {
                  if (steps >= effMove) break;
                  if (step.x === tgt.x && step.y === tgt.y) break;
                  if (!walkable(ms.tiles, step.x, step.y, units)) break;
                  nx = step.x; ny = step.y; steps++;
                }
                if (nx !== u.x || ny !== u.y) {
                  const movedU = { ...u, x:nx, y:ny, alerted:true, chaseTurns:0, lastKnown };
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
                  x:ex, y:1, hp:a.hp, maxHp:a.hp, dmg:a.dmg, def:0, actionPoints:1, movementPoints:1,
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
            // e_pack_tactics: attacker gains +1 dmg per adjacent faction ally
            const packBonus = (attacker.abilities ?? []).includes('e_pack_tactics')
              ? units.filter(a => a.type===UT.ENEMY && !a.fallen && a.id!==attacker.id && a.faction===attacker.faction && dist(attacker,a)<=1).length
              : 0;
            let dmg = Math.max(1, (attacker.dmg||2) + packBonus - (ignoreDef ? 0 : ad));

            const consumeReactive = (aid, bonded) => {
              const usesLeft = tgt.abilityUses?.[aid] ?? 0;
              if (usesLeft <= 0) return false;
              if (bonded) {
                tgt.bondedArmed = { ...(tgt.bondedArmed ?? {}), [aid]: false };
              } else {
                tgt.abilityArmed = false;
              }
              tgt.abilityUses = { ...(tgt.abilityUses ?? {}), [aid]: usesLeft - 1 };
              return true;
            };

            const shieldedFx = tgt.statusEffects?.find(fx => fx.id === 'shielded');
            if (shieldedFx) {
              logs.push(`🛡 ${tgt.name}'s ward absorbs the hit!`);
              units = units.map(v => v.id !== tgt.id ? v : {
                ...v,
                statusEffects: (v.statusEffects ?? []).filter(fx => fx !== shieldedFx),
              });
              continue;
            }

            const armedReactives = [];
            if (tgt.abilityArmed && tgt.classAbility) armedReactives.push({ aid:tgt.classAbility, bonded:false });
            for (const bAid of (tgt.bondedAbilities ?? [])) {
              if (tgt.bondedArmed?.[bAid]) armedReactives.push({ aid:bAid, bonded:true });
            }
            let negated = false;
            for (const { aid, bonded } of armedReactives) {
              if (!consumeReactive(aid, bonded)) continue;
              if (aid === 'construct_armor') {
                dmg = 1;
                logs.push(`🤖 ${tgt.name}'s Construct Armor reduces hit to 1!`);
                break;
              }
              if (['bone_shield','shield_wall'].includes(aid)) {
                logs.push(`🛡 ${tgt.name}'s ${ABILITIES[aid]?.name ?? aid} negates the hit!`);
                negated = true;
                break;
              }
              if (['fortress_shell','immovable'].includes(aid)) {
                logs.push(`🛡 ${tgt.name}'s ${ABILITIES[aid]?.name ?? aid} negates and reflects!`);
                units = units.map(v => v.id !== attacker.id ? v : { ...v, hp:Math.max(0, v.hp - 2), ...(v.hp - 2 <= 0 ? { fallen:true, raiseTurn:ms.turn } : {}) });
                negated = true;
                break;
              }
              if (aid === 'root_strike') {
                units = units.map(v => v.id !== attacker.id ? v : { ...v, statusEffects:[...(v.statusEffects||[]),{id:'root',duration:1,magnitude:1,sourceId:tgt.id}] });
                logs.push(`🌿 ${tgt.name}'s Root Strike roots ${attacker.name}!`);
                break;
              }
              if (['thornwall','briarvine','briarvine_warden'].includes(aid)) {
                const fxId = aid === 'thornwall' ? 'root' : 'bind';
                units = units.map(v => v.id !== attacker.id ? v : {
                  ...v,
                  hp: aid === 'thornwall' ? v.hp : Math.max(0, v.hp - 1),
                  statusEffects:[...(v.statusEffects||[]),{id:fxId,duration:1,magnitude:1,sourceId:tgt.id}],
                  ...(aid !== 'thornwall' && v.hp - 1 <= 0 ? { fallen:true, raiseTurn:ms.turn } : {}),
                });
                logs.push(`🌿 ${tgt.name}'s ${ABILITIES[aid]?.name ?? aid} snares ${attacker.name}!`);
                break;
              }
            }
            if (negated) continue;

            // ── Defender's reaction: dodge / counter / defend ──────────────
            const defenseResult = resolveDefense(attacker, tgt, dmg);
            if (defenseResult.outcome === 'dodge') {
              logs.push(`💨 ${tgt.name} dodges ${attacker.name}'s attack!`);
              continue;
            } else if (defenseResult.outcome === 'defend') {
              dmg = defenseResult.dmg;
              logs.push(`🛡 ${tgt.name} braces and takes only ${dmg}!`);
            } else if (defenseResult.outcome === 'counter') {
              dmg = defenseResult.dmg;
            }

            // armored passive: attacker is the target's passive doesn't apply here (it's the enemy attacking player)
            // but when a boss IS the target (player attacks boss in doAttack) it's handled there
            // For enemy attacking player: check if attacker is boss with brutal
            logs.push(`⚔️ ${attacker.name} hits ${tgt.name} for ${dmg}!`);
            units = units.map(v => {
              if (v.id !== tgt.id) return v;
              const nh = v.hp - dmg;
              if (nh <= 0) {
                if (v.id==='varek') { setTimeout(() => get().setScreen(SCREEN.GAME_OVER), 300); return { ...v, hp:0 }; }
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
                // Pale Warden bone explosion: deals lifetime_levels dmg to all adjacent (friendly fire included)
                if (v.boneExplosion) {
                  const beDmg = v.lifetime_levels ?? 1;
                  const adj = units.filter(u => !u.fallen && dist(v, u) <= 1 && u.id !== v.id);
                  adj.forEach(a => {
                    units = units.map(u => u.id !== a.id ? u : {
                      ...u, hp: Math.max(0, u.hp - beDmg),
                      ...(u.hp - beDmg <= 0 && u.id !== 'varek' ? { fallen:true, raiseTurn:ms.turn } : {}),
                    });
                  });
                  if (adj.length) logs.push(`💀 ${v.name} Bone Explosion — ${beDmg} dmg to ${adj.length} adjacent!`);
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

            // Counter-attack: defender strikes back at the enemy attacker
            if (defenseResult.outcome === 'counter') {
              const survAfterHit = units.find(u => u.id === tgt.id && !u.fallen);
              const enemyAlive = units.find(u => u.id === attacker.id && !u.fallen);
              if (survAfterHit && enemyAlive) {
                const cdmg = defenseResult.counterDmg;
                logs.push(`↩️ ${tgt.name} counters for ${cdmg}!`);
                units = units.map(v => {
                  if (v.id !== attacker.id) return v;
                  const nh = v.hp - cdmg;
                  if (nh <= 0) { logs.push(`${v.name} falls!`); return { ...v, hp:0, fallen:true, raiseTurn:ms.turn }; }
                  return { ...v, hp:nh };
                });
              }
            }
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
                if (nh <= 0) { setTimeout(() => get().setScreen(SCREEN.GAME_OVER), 300); return { ...u, hp:0, holyTurns:ht }; }
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
            if (fallen2 && u.type === UT.VAREK) { setTimeout(() => get().setScreen(SCREEN.GAME_OVER), 300); }
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
            const allAbilities = [u.classAbility, ...(u.bondedAbilities ?? [])].filter(Boolean);
            if (allAbilities.includes('regenerate')) heal = Math.max(heal, 1);
            if (allAbilities.includes('undying'))    heal = Math.max(heal, 2);
            if (!heal) return u;
            const newHp = Math.min(u.maxHp, u.hp + heal);
            return { ...u, hp: newHp };
          });

          // ── fear_aura: Dread Knight alive → adjacent enemies lose 1 AP ────
          const fearSources = units.filter(u =>
            !u.fallen && [u.classAbility, ...(u.bondedAbilities ?? [])].includes('fear_aura')
          );
          if (fearSources.length) {
            units = units.map(u => {
              if (u.type !== UT.ENEMY || u.fallen) return u;
              const inRange = fearSources.some(src => dist(src, u) <= 1);
              return inRange ? { ...u, actionPoints: Math.max(0, u.actionPoints - 1) } : u;
            });
          }

          // ── strangling_vines / living_fortress: adjacent enemies take dmg + lose move ──
          const vinesSources = units.filter(u =>
            !u.fallen && [u.classAbility, ...(u.bondedAbilities ?? [])].some(aid => aid === 'strangling_vines' || aid === 'living_fortress')
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
              x:rx, y:1, hp:a.hp, maxHp:a.hp, dmg:a.dmg, def:0, actionPoints:1, movementPoints:1,
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
        debouncedSave(get);
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

          const newUnits = ms.units
            .map(u => {
              if (u.id === gatherer.id) {
                return guaranteed
                  ? { ...u, actionPoints:0, movementPoints:0 }
                  : { ...u, actionPoints:u.actionPoints-1 };
              }
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
    {
      name: 'sanctuary-save',
      partialize: (state) => ({
        bestiary: state.bestiary,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.screen = 'home';
        state.currentUser = null;
        state.saveSlots = [];
        state.activeSlot = null;
        state.ms = null;
        state.worldPath = [];
        state.selectedHex = null;
        state.pendingSanctuaryTile = null;
      },
    }
  )
  )
);
