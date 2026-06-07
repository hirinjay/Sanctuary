import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_VP, UT, TILE, UNAMES, VAREK_LU, UNDEAD_LU, H } from '../data/constants';
import { item, LOOT, BODY_LOOT } from '../data/items';
import { genMap, genDungeonMap, genCabinMap, revealTraps, walkable, hasLOS, dist } from '../systems/map';
import { spawnEnemies, classStats, xpNext, applyXpToUnits } from '../systems/combat';
import { ARCHETYPES } from '../data/archetypes';
import { LOCS } from '../data/locations';
import { generateWorld, revealAround } from '../world/worldGen';
import { hexesInRange } from '../world/hexMath';
import { TERRAIN, rollWildEncounter, rollForageLoot } from '../world/tileTypes';
import { bfsPath } from '../world/hexMath';
import { BUILDINGS } from '../data/buildings';
import { saveRun } from '../lib/persistence';

// Debounced save — only fires when user + slot are known
let _saveTimer = null
function debouncedSave(state) {
  clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    const { currentUser, activeSlot } = state
    if (activeSlot) saveRun(state, currentUser?.id ?? null, activeSlot)
  }, 1500)
}

export const useGameStore = create(
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
        const { vp, roster } = get();
        const varek = {
          id:'varek', type:UT.VAREK, name:'Varek', emoji:'🧙',
          x:1, y:H-2, ...vp,
          moveRange: vp.moveRange || 3,
          trapReveal: vp.trapReveal || 1,
          ap:2, fallen:false, raiseTurn:null,
        };
        const activeUndead = roster
          .filter(u => !u.atBase)
          .map((u, i) => ({ ...u, x:2+i, y:H-2, ap:2, fallen:false, raiseTurn:null, atBase:false }));
        const enemies = spawnEnemies(location.danger, md);
        const isDungeon = location.type === 'dungeon' || location.id?.startsWith('dungeon_');
        const isCabin   = location.type === 'cabin';
        const mapFn     = isDungeon ? genDungeonMap : isCabin ? genCabinMap : genMap;
        const danger    = location.danger ?? 1;
        set({
          ms:    { tiles: mapFn(danger), units:[varek,...activeUndead,...enemies], turn:1, loot:[] },
          noise: md === 'raid' ? 30 : 0,
          loc:   location,
          mode:  md,
          luq:   [],
          log:   [`${location.name} — ${md==='raid'?'Raid: enemies alerted.':'Scavenge: stay quiet.'}`],
          phase: 'player',
          screen:'mission',
        });
      },

      endMission(units, loot, success = false) {
        const { roster, vp, nodes, inv, travelBag, loc } = get();
        const surv  = units.filter(u => u.type === UT.UNDEAD && !u.fallen);
        const varek = units.find(u => u.id === 'varek');
        const newVp = varek
          ? { ...vp, hp:varek.hp, xp:varek.xp, level:varek.level, raiseRange:varek.raiseRange,
              drainRange:varek.drainRange, tetherCap:varek.tetherCap,
              moveRange:varek.moveRange||3, weapon:varek.weapon, armor:varek.armor }
          : vp;
        const newRoster = [...roster.filter(u => u.atBase), ...surv.map(u => ({ ...u, atBase:false }))];

        // Loot goes into travelBag — Varek carries it; must return to Sanctuary to deposit
        const newBag = { ...travelBag };
        loot.forEach(id => { newBag[id] = (newBag[id]||0) + 1; });

        // Node yields go to sanctuary inv directly (passive income from structures)
        const newInv = { ...inv };
        const logs = [];
        if (nodes.includes('farm'))   { newInv.food = (newInv.food||0)+2;             logs.push('🌱 Farm yields 2 food.'); }
        if (nodes.includes('quarry')) { newInv.scrap_iron = (newInv.scrap_iron||0)+2; logs.push('⛏ Quarry yields 2 scrap iron.'); }

        if (success) logs.push(`✓ Secured ${loot.length} item${loot.length!==1?'s':''} — return to Sanctuary to deposit.`);

        set(s => ({
          vp:newVp, roster:newRoster, inv:newInv, travelBag:newBag,
          ms:null, worldPath:[], screen:'world',
          log: [...logs, ...s.log].slice(0, 14),
        }));
        debouncedSave(get());
      },

      resetGame() {
        set({ screen:'home', book:null, vp:{ ...DEFAULT_VP }, roster:[], inv:{},
          nodes:[], ms:null, noise:0, luq:[], log:[], phase:'player',
          equipTgt:null, loc:null, mode:'scavenge', unlockedLocs:['town'],
          world:null, worldPos:null, sanctuaryPos:null, selectedHex:null,
          pendingSanctuaryTile:null, worldPath:[], travelBag:{},
          sanctuaryGrid:null, activeSlot:null });
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
        debouncedSave(get());
      },

      cancelSanctuaryPlacement() { set({ pendingSanctuaryTile:null, selectedHex:null }); },

      // Queue a path; WorldMapView steps through it
      setWorldPath(path) { set({ worldPath: path ?? [] }); },

      // Called each auto-step from WorldMapView. Returns { encounter } or null.
      consumeStep() {
        const { world, worldPath, travelBag } = get();
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
        debouncedSave(get());
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
        debouncedSave(get());
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
        if (encounter) {
          setTimeout(() => get().startMission(encounter, 'raid'), 100);
        } else {
          debouncedSave(get());
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
        debouncedSave(get());
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
        debouncedSave(get());
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
        debouncedSave(get());
      },

      // ── Auth ──────────────────────────────────────────────────────────
      setCurrentUser(user) { set({ currentUser: user }); },
      setSaveSlots(slots)  { set({ saveSlots: slots }); },

      // ── Load a full save into the store ───────────────────────────────
      loadSaveIntoStore(data, slot) {
        set({
          vp:            data.vp            ?? { ...DEFAULT_VP },
          roster:        data.roster        ?? [],
          inv:           data.inv           ?? {},
          travelBag:     data.travel_bag    ?? {},
          nodes:         data.nodes         ?? [],
          book:          data.book          ?? null,
          world:         data.world         ?? null,
          worldPos:      data.world_pos     ?? null,
          sanctuaryPos:  data.sanctuary_pos ?? null,
          unlockedLocs:  data.unlocked_locs ?? ['town'],
          log:           data.log           ?? [],
          sanctuaryGrid: data.sanctuary_grid ?? null,
          activeSlot:    slot,
          // Reset transient state
          ms: null, phase:'player', luq:[], noise:0, selectedHex:null,
          equipTgt:null, loc:null, worldPath:[], pendingSanctuaryTile:null,
          screen: data.world ? 'world' : 'title',
        });
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
        const stats  = fresh
          ? classStats(fallen.dc, true, ub)
          : { hp:Math.ceil(fallen.maxHp*.6)+(ub?.hp||0), maxHp:Math.ceil(fallen.maxHp*.6)+(ub?.hp||0),
              dmg:Math.max(1,fallen.dmg-1)+(ub?.dmg||0), def:0,
              moveRange:fallen.moveRange, trapReveal:1, attackRange:fallen.attackRange||1 };
        const cls    = fresh ? fallen.dc : `Broken ${fallen.dc}`;
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
        let nn     = s.noise;
        const logs = [];
        let loot   = [...ms.loot];
        let tiles  = ms.tiles.map(r => r.map(t => ({ ...t })));
        let units  = ms.units.map(u => ({ ...u }));
        let esc    = false;
        let over   = false;
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
        } else if (t.type === TILE.RUBBLE) {
          nn += 3;
          units = units.map(u => u.id===sel ? { ...u, x, y, ap:u.ap-1 } : u);
          logs.push(`${unit.name} crunches through rubble...`);
        } else if (t.type === TILE.EXIT) {
          esc = true;
          logs.push(`🚪 ${unit.name} reaches the exit!`);
        } else {
          units = units.map(u => u.id===sel ? { ...u, x, y, ap:u.ap-1 } : u);
        }

        if (nn >= 50) {
          const was = ms.units.some(u => u.type===UT.ENEMY && u.alerted);
          units = units.map(u => u.type===UT.ENEMY ? { ...u, alerted:true } : u);
          if (!was) logs.push('⚠️ Enemies alerted!');
        }

        tiles = revealTraps(tiles, units);

        set(prev => ({
          ms:    { ...ms, tiles, units, loot },
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

        const weaponItem = att.weapon ? item(att.weapon) : null;
        const wb  = weaponItem ? (weaponItem.dmg||0) : (att.type===UT.UNDEAD ? -1 : 0);
        const dmg = Math.max(1, (att.dmg||2) + wb - (enemy.def||0));

        set(prev => {
          let units = prev.ms.units.map(u => ({ ...u }));
          let luq   = [...prev.luq];
          const logs = [`${att.emoji} ${att.name} → ${enemy.name} for ${dmg}!`];

          units = units.map(u => {
            if (u.id === enemy.id) {
              const nh = u.hp - dmg;
              if (nh <= 0) { logs.push(`${enemy.name} falls! Raise within 3 turns.`); return { ...u, hp:0, fallen:true, raiseTurn:prev.ms.turn }; }
              return { ...u, hp:nh, alerted:true };
            }
            if (u.id === sel) return { ...u, ap:u.ap-1 };
            return u;
          });

          const killed = units.find(u => u.id===enemy.id && u.fallen && u.raiseTurn===prev.ms.turn);
          if (killed) {
            const xpGain = ((enemy.xp||6) * (prev.mode==='raid' ? 1.5 : 1)) | 0;
            units = applyXpToUnits(units, sel, xpGain, luq);
          }

          if (att.type === UT.VAREK) {
            units = units.map(u => u.id==='varek' ? { ...u, hp:Math.min(u.maxHp, u.hp+1) } : u);
            logs.push('Varek drains +1hp');
          }

          // Retaliate
          const surv   = units.find(u => u.id===enemy.id && !u.fallen);
          const attNow = units.find(u => u.id===sel);
          if (surv && attNow && dist(surv,attNow)<=(surv.attackRange||1) && Math.random()<0.6) {
            const ad   = attNow.armor ? (item(attNow.armor)?.def||0) : 0;
            const rdmg = Math.max(1, (surv.dmg||2) - ad);
            logs.push(`↩️ ${surv.name} retaliates on ${attNow.name} for ${rdmg}!`);
            units = units.map(u => {
              if (u.id !== sel) return u;
              const nh = u.hp - rdmg;
              if (nh <= 0) {
                if (sel === 'varek') { setTimeout(() => get().setScreen('gameover'), 300); return { ...u, hp:0 }; }
                logs.push(`${u.name} falls!`);
                return { ...u, hp:0, fallen:true, raiseTurn:prev.ms.turn };
              }
              return { ...u, hp:nh };
            });
          }

          return {
            ms:  { ...prev.ms, units },
            luq,
            log: [...logs.reverse(), ...prev.log].slice(0, 14),
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

          const friendlies = () => units.filter(f => f.type!==UT.ENEMY && !f.fallen);

          // Sight check
          units = units.map(u => {
            if (u.type!==UT.ENEMY || u.fallen || u.alerted) return u;
            const spotted = friendlies().find(f => dist(u,f)<=(u.sight||3)+noiseMod && hasLOS(ms.tiles,u.x,u.y,f.x,f.y));
            if (!spotted) return u;
            if (Math.random() < (u.spot||0.6)) {
              logs.push(`👁 ${u.name} spots ${spotted.name}! (${Math.round((u.spot||0.6)*100)}%)`);
              return { ...u, alerted:true };
            }
            return u;
          });

          const pendingAttacks = [];

          units = units.map(u => {
            if (u.type!==UT.ENEMY || u.fallen) return u;
            const fr  = friendlies();
            if (!fr.length) return u;
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
                  const dx=Math.sign(lastKnown.x-u.x), dy=Math.sign(lastKnown.y-u.y);
                  for (const [nx,ny] of [[u.x+dx,u.y],[u.x,u.y+dy],[u.x+dx,u.y+dy]])
                    if (walkable(ms.tiles,nx,ny,units)) return { ...u, x:nx, y:ny, chaseTurns:0, lastKnown };
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
              const dx=Math.sign(tgt.x-u.x), dy=Math.sign(tgt.y-u.y);
              for (const [nx,ny] of [[u.x+dx,u.y],[u.x,u.y+dy],[u.x+dx,u.y+dy]])
                if (walkable(ms.tiles,nx,ny,units)) return { ...u, x:nx, y:ny, alerted:true, chaseTurns:0, lastKnown };
              return { ...u, alerted:true, chaseTurns:0, lastKnown };
            }
            const p  = u.patrol[u.pi % u.patrol.length];
            const nx = u.x+p.dx, ny = u.y+p.dy;
            return walkable(ms.tiles,nx,ny,units) ? { ...u, x:nx, y:ny, pi:u.pi+1 } : { ...u, pi:u.pi+1 };
          });

          const newTiles = revealTraps(ms.tiles, units);

          // Resolve attacks
          for (const { attacker, target } of pendingAttacks) {
            const tgt = units.find(u => u.id===target.id);
            if (!tgt || tgt.fallen) continue;
            const ad  = tgt.armor ? (item(tgt.armor)?.def||0) : 0;
            const dmg = Math.max(1, (attacker.dmg||2) - ad);
            logs.push(`⚔️ ${attacker.name} hits ${tgt.name} for ${dmg}!`);
            units = units.map(v => {
              if (v.id !== tgt.id) return v;
              const nh = v.hp - dmg;
              if (nh <= 0) {
                if (v.id==='varek') { setTimeout(() => get().setScreen('gameover'), 300); return { ...v, hp:0 }; }
                logs.push(`${v.name} falls!`);
                return { ...v, hp:0, fallen:true, raiseTurn:ms.turn };
              }
              return { ...v, hp:nh };
            });
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
            ms:  { ...ms, tiles:newTiles, units, turn:newTurn },
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
);
