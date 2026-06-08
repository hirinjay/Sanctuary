import { useState, useRef, useCallback, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { UT, TILE } from '../../data/constants';
import { item } from '../../data/items';
import { moveRange, fog, dist } from '../../systems/map';
import MissionMap from '../mission/MissionMap';
import UnitBar from '../mission/UnitBar';
import RaisePanel from '../mission/RaisePanel';
import LevelUpModal from '../mission/LevelUpModal';
import { ABILITIES } from '../../data/abilities';

// Abilities that need a target enemy click before firing
const UNIT_TARGET_ABILITIES = new Set([
  'rend','consume','consume_gw','devour','devour_titan','frenzy',
  'overgrowth_strike','entangling_shot','stranglehold','death_mark','shove',
]);
// Abilities that need a target cell click (e.g. phase destination)
const CELL_TARGET_ABILITIES = new Set(['phase']);
// Abilities that fire immediately with no targeting
const SELF_ABILITIES = new Set([
  'intimidate','entangle','mass_entangle','mass_entangle_warden',
  'shockwave','overclock','rain_of_arrows','barrage','vanish',
  'ambush','superior_ambush',
]);

const pg = { background:'#040810', height:'100vh', overflow:'hidden', display:'flex', flexDirection:'column', fontFamily:'Georgia,serif', color:'#c4a882', boxSizing:'border-box', userSelect:'none' };

function btn(on, c) {
  return {
    background: on ? `${c}18` : '#0b0f1c',
    border: `1px solid ${on ? c : '#222233'}`,
    borderRadius:5, padding:'6px 11px',
    color: on ? c : '#7a7a8a',
    cursor: on ? 'pointer' : 'default', fontSize:11,
  };
}

export default function MissionScreen() {
  const { ms, noise, phase, luq, log, loc, mode, book, ti, travelBag, sanctuaryPos,
          doMove, doAttack, doUseKey, disarmTrap, doAbility, toggleAbilityArmed,
          endTurn, endMission, addLog } = useGameStore();

  // sel & hilight are local — they don't need persistence and use the hilightRef pattern
  // to avoid stale closures on grid click
  const [sel, setSel]               = useState(null);
  const [hilight, setHilight]       = useState(new Set());
  const hilightRef                  = useRef(new Set());
  const [abilityMode, setAbilityMode] = useState(null);
  const [autoEnd, setAutoEnd]       = useState(true);

  // Auto-end: fire when units or toggle change — if all friendlies are out of AP, end the turn
  useEffect(() => {
    if (!autoEnd) return;
    const { ms: cur, phase: curPhase } = useGameStore.getState();
    if (!cur || curPhase !== 'player') return;
    const friendlies = cur.units.filter(u => u.type !== 'enemy' && !u.fallen);
    if (friendlies.length > 0 && friendlies.every(u => u.ap <= 0)) endTurn();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms?.units, autoEnd]);

  const clearSel = useCallback(() => {
    setSel(null);
    setHilight(new Set());
    hilightRef.current = new Set();
    setAbilityMode(null);
  }, []);

  function setHL(s) { setHilight(s); hilightRef.current = s; }

  if (!ms) return null;

  const { tiles, units, turn } = ms;
  const mapW = ms.width ?? tiles[0]?.length ?? 16;

  // Derive visual theme from location type or wild-encounter terrain
  const locId = loc?.id ?? '';
  const theme = loc?.type === 'cabin'       ? 'cabin'
    : loc?.type === 'dungeon' || locId.startsWith('dungeon') ? 'dungeon'
    : loc?.type === 'battlefield'           ? 'battlefield'
    : locId.startsWith('wild_forest')       ? 'forest'
    : locId.startsWith('wild_swamp')        ? 'swamp'
    : locId.startsWith('wild_ruins')        ? 'ruins'
    : locId.startsWith('wild_plains')       ? 'plains'
    : locId.startsWith('ruined_')           ? 'ruins'
    : loc?.type === 'camp'                  ? 'plains'
    : loc?.type === 'village'               ? 'plains'
    : 'dungeon';
  const varek    = units.find(u => u.id === 'varek');
  const t        = ti(units);
  const fieldTether = `${t.fieldCount}/${t.fieldCap}`;
  const fv       = fog(units, noise, tiles);
  const rw       = book?.ap?.raiseWindow || 3;
  const raiseable = units.filter(u =>
    u.type === UT.ENEMY && u.fallen && varek &&
    dist(varek, u) <= varek.raiseRange && (turn - u.raiseTurn) <= rw
  );

  if (luq.length > 0) return <LevelUpModal />;

  function handleSelect(u) {
    if (u.fallen) return;
    if (u.ap <= 0) { addLog(`${u.name} has no AP.`); return; }
    if (sel === u.id) { clearSel(); return; }
    setSel(u.id);
    // Apply slow: halve move range (rounded down)
    const hasSlow = u.statusEffects?.some(fx => fx.id === 'slow');
    const hasStun = u.statusEffects?.some(fx => fx.id === 'stun');
    const hasBind = u.statusEffects?.some(fx => fx.id === 'bind');
    const hasRoot = u.statusEffects?.some(fx => fx.id === 'root');
    const effectiveMoveRange = (hasSlow && !(hasBind||hasRoot||hasStun))
      ? Math.max(1, Math.floor((u.moveRange||3) / 2))
      : (u.moveRange||3);
    const uEff = (hasBind||hasRoot||hasStun) ? { ...u, moveRange:0 } : { ...u, moveRange:effectiveMoveRange };
    setHL(moveRange(uEff, tiles, units));
  }

  function handleCellClick(x, y, u, vis, hi) {
    if (!vis) return;
    const live = u && !u.fallen ? u : null;

    // Ability targeting mode
    if (abilityMode && sel) {
      if (UNIT_TARGET_ABILITIES.has(abilityMode)) {
        if (live?.type === UT.ENEMY) {
          doAbility(sel, abilityMode, null, null, live.id);
          setAbilityMode(null);
        } else if (live && live.id !== sel) {
          setAbilityMode(null); // clicked wrong unit — cancel
        }
        return;
      }
      if (CELL_TARGET_ABILITIES.has(abilityMode)) {
        doAbility(sel, abilityMode, x, y, null);
        setAbilityMode(null);
        return;
      }
      setAbilityMode(null);
      return;
    }

    if (live) {
      if (live.type === UT.ENEMY && sel) {
        doAttack(live, sel);
        clearSel();
      } else if (live.type !== UT.ENEMY) {
        handleSelect(live);
      }
    } else if (hi) {
      doMove(x, y, sel, hilightRef.current);
      clearSel();
    }
  }

  const selUnit = sel ? units.find(u => u.id === sel) : null;
  const keys = ms.keys || [];

  // Find adjacent revealed trap when unit has 2+ AP
  const adjacentTrapTarget = (selUnit && phase === 'player' && selUnit.ap >= 2) ? (() => {
    const { x, y } = selUnit;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const ax = x + dx, ay = y + dy;
      const t = tiles[ay]?.[ax];
      if (t?.type === TILE.TRAP && t.revealed) return { x: ax, y: ay };
    }
    return null;
  })() : null;

  // Find adjacent locked door or cage when a unit is selected and has AP
  const adjacentKeyTarget = (selUnit && phase === 'player' && selUnit.ap > 0 && keys.length > 0) ? (() => {
    const { x, y } = selUnit;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const ax = x + dx, ay = y + dy;
      const t = tiles[ay]?.[ax];
      if (!t) continue;
      const isCage = t.type === TILE.CAGE;
      const isLockedDoor = t.type === TILE.DOOR && t.locked && !t.open;
      if (isCage || isLockedDoor) {
        const keyId = t.keyId;
        if (!keyId || keys.includes(keyId)) return { x: ax, y: ay };
      }
    }
    return null;
  })() : null;

  const noiseColor = noise < 30 ? '#3a7a3a' : noise < 60 ? '#7a6a2a' : '#7a2a2a';
  const noiseLabel = noise < 30 ? 'Quiet (👁3)' : noise < 60 ? 'Tense (👁4)' : 'Alert! (👁5)';

  // ── Build legend entries for this encounter ──────────────────────────
  const legendEntries = (() => {
    const out = [];

    // Units present
    const varekU  = units.find(u => u.id === 'varek');
    const undeadU = units.filter(u => u.type === UT.UNDEAD && !u.fallen);
    const enemyU  = units.filter(u => u.type === UT.ENEMY  && !u.fallen);
    const fallenU = units.filter(u => u.fallen && u.type !== UT.VAREK);

    if (varekU)      out.push({ icon: varekU.emoji,    label: 'You',     bg: '#1a0e00', border: '#ff880055' });
    if (undeadU.length) out.push({ icon: undeadU[0].emoji, label: 'Undead', bg: '#060e14', border: '#3a6a8a55' });
    if (enemyU.length)  out.push({ icon: enemyU[0].emoji,  label: 'Enemy',  bg: '#140606', border: '#8a3a3a55' });
    if (fallenU.length) out.push({ icon: '⊗',            label: 'Fallen',  bg: '#0a0a0a', border: '#3a3a3a55', dim: true });

    out.push({ divider: true });

    // Tile types — scan the full tile grid
    const tileDefs = {
      [TILE.EXIT]:      { icon: '🚪', label: 'Exit',     bg: '#0c1c28', border: '#2a4a6a' },
      [TILE.LOOT]:      { icon: '📦', label: 'Cache',    bg: '#0c240c', border: '#2a5a2a' },
      [TILE.LOOT_OPEN]: { icon: '📭', label: 'Looted',   bg: '#091509', border: '#1a3a1a' },
      [TILE.TRAP_X]:    { icon: '💥', label: 'Trap',     bg: '#340d0d', border: '#5a2a2a' },
      [TILE.HOLY]:      { icon: '⛪', label: 'Holy gnd', bg: '#1e1c08', border: '#4a4a1a' },
      [TILE.SHADOW]:    { icon: '🌑', label: 'Shadow',   bg: '#07070f', border: '#1a1a3a' },
      [TILE.WATER]:     { icon: '💧', label: 'Water',    bg: '#081e30', border: '#1a3a5a' },
      [TILE.ELEVATED]:  { icon: '⛰', label: 'High gnd', bg: '#1c1508', border: '#3a3a1a' },
      [TILE.FIRE]:      { icon: '🔥', label: 'Fire',     bg: '#2c0800', border: '#5a2a0a' },
      [TILE.CAGE]:      { icon: '⛓', label: 'Cage',     bg: '#0a0a14', border: '#2a2a3a' },
    };

    const seen = new Set();
    let hasRevealedTrap = false, hasLockedDoor = false, hasRegularDoor = false;

    tiles.forEach(row => row.forEach(t => {
      if (t.type === TILE.TRAP && t.revealed) { hasRevealedTrap = true; return; }
      if (t.type === TILE.DOOR) {
        if (t.locked && !t.open) hasLockedDoor = true;
        else if (!t.open) hasRegularDoor = true;
        return;
      }
      if (tileDefs[t.type] && !seen.has(t.type)) seen.add(t.type);
    }));

    seen.forEach(type => out.push(tileDefs[type]));
    if (hasRevealedTrap)  out.push({ icon: '⚠',  label: 'Trap!',  bg: '#240c0c', border: '#5a2a1a' });
    if (hasLockedDoor)    out.push({ icon: '🔒', label: 'Locked',  bg: '#1c0305', border: '#5a1a1a' });
    if (hasRegularDoor)   out.push({ icon: '🚪', label: 'Door',    bg: '#1c0e06', border: '#3a2a1a' });

    return out;
  })();

  return (
    <div style={pg}>

      {/* ── Top: header + objective ───────────────────────────────────── */}
      <div style={{ flexShrink:0, padding:'6px 9px 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          flexWrap:'wrap', gap:5, fontSize:11, marginBottom:4 }}>
          <div>
            <span style={{ color:'#e8d5b0' }}>{loc?.name}</span>
            <span style={{ color:'#3a4a3a', marginLeft:8 }}>
              {mode==='scavenge'?'🤫':'⚔️'} Turn {turn}
            </span>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <span style={{ color:noiseColor }}>🔊 {noiseLabel}</span>
            <span>❤️ {varek?.hp}/{varek?.maxHp}</span>
            <span style={{ color:t.fieldCount<t.fieldCap?'#3a7a3a':'#7a2a2a' }}>⛓ {fieldTether}</span>
            <span style={{ color:'#4a5a4a' }}>Lv{varek?.level}</span>
            {keys.length > 0 && <span style={{ color:'#aa8833' }}>🔑×{keys.length}</span>}
          </div>
        </div>
        {ms.objective && (() => {
          const obj = ms.objective;
          const done = obj.complete, fail = obj.failed;
          return (
            <div style={{ padding:'3px 8px', borderRadius:4, fontSize:10, marginBottom:4,
              background: done ? '#091509' : fail ? '#150909' : '#090e1a',
              border: `1px solid ${done ? '#3a6a3a' : fail ? '#6a2a2a' : '#2a3a5a'}`,
              color: done ? '#5a9a5a' : fail ? '#8a4a4a' : '#c4a882',
              display:'flex', gap:8, alignItems:'center',
            }}>
              <span>{done ? '⭐' : fail ? '✗' : '◼'}</span>
              <span>{obj.label}</span>
              {obj.type === 'survive' && !done && (
                <span style={{ color:'#4a5a6a', marginLeft:'auto' }}>turn {turn}/{obj.turns}</span>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Middle: map (scrollable) + sidebar (fixed) ───────────────── */}
      <div style={{ flex:1, minHeight:0, display:'flex', gap:6, padding:'0 9px', overflow:'hidden' }}>

        {/* Map — scrolls freely in both axes */}
        <div style={{ flex:1, overflow:'auto', minWidth:0 }}>
          <MissionMap
            tiles={tiles} units={units} W={mapW} fv={fv}
            hilight={hilight} raiseable={raiseable}
            onCellClick={handleCellClick} theme={theme}
          />
        </div>

        {/* Legend sidebar — fixed width, never scrolls with the map */}
        <div style={{ flexShrink:0, width:88, overflowY:'auto',
          background:'#04040a', border:'1px solid #0e0e1a', borderRadius:4, padding:'6px 6px 4px',
          alignSelf:'flex-start', maxHeight:'100%' }}>
          <div style={{ fontSize:8, color:'#2a3a2a', letterSpacing:1, marginBottom:5, textTransform:'uppercase' }}>Key</div>
          {legendEntries.map((e, i) =>
            e.divider
              ? <div key={i} style={{ height:1, background:'#0e0e1a', margin:'4px 0' }} />
              : (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4 }}>
                  <span style={{
                    display:'inline-flex', alignItems:'center', justifyContent:'center',
                    width:18, height:18, fontSize:10, flexShrink:0,
                    background: e.bg, border:`1px solid ${e.border}`, borderRadius:2,
                    opacity: e.dim ? 0.45 : 1,
                  }}>{e.icon}</span>
                  <span style={{ fontSize:9, color:'#5a6a5a', lineHeight:1.2 }}>{e.label}</span>
                </div>
              )
          )}
        </div>
      </div>

      {/* ── Bottom: unit bar, raise panel, log, buttons ───────────────── */}
      <div style={{ flexShrink:0, padding:'0 9px 7px' }}>

        {/* Unit bar */}
        <UnitBar units={units} sel={sel} onSelect={handleSelect} />

        {/* Raise / gather panel */}
        <RaisePanel units={units} turn={turn} raiseable={raiseable} book={book} />

        {/* Hint */}
        <div style={{ fontSize:10, color:'#2a3a2a', marginBottom:4 }}>
          {abilityMode
            ? `${ABILITIES[abilityMode]?.name}: ${UNIT_TARGET_ABILITIES.has(abilityMode) ? 'tap an enemy' : CELL_TARGET_ABILITIES.has(abilityMode) ? 'tap destination cell' : '...'}`
            : selUnit ? `${selUnit.name} — tap green to move, tap enemy to attack` : 'Tap a unit to select'}
        </div>

        {/* Combat log */}
        <div style={{ background:'#04040a', border:'1px solid #111120', borderRadius:4, padding:6,
          height:58, overflowY:'auto', marginBottom:6 }}>
          {log.map((l, i) => (
            <div key={i} style={{ fontSize:10, color:i===0?'#c4a882':'#333345', lineHeight:1.6 }}>{l}</div>
          ))}
        </div>

        {/* Ability buttons */}
        {selUnit && phase === 'player' && selUnit.type !== UT.ENEMY && (() => {
          const allAbilityIds = [
            selUnit.classAbility,
            ...(selUnit.bondedAbilities ?? []),
          ].filter(Boolean);
          if (allAbilityIds.length === 0) return null;
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:5 }}>
              {allAbilityIds.map((aid, idx) => {
                const ab = ABILITIES[aid];
                if (!ab) return null;
                const usesLeft = selUnit.abilityUses?.[aid] ?? 0;
                const isBonded = idx > 0;
                const isArmed = isBonded ? !!(selUnit.bondedArmed?.[aid]) : selUnit.abilityArmed;
                const accentColor = isBonded ? '#7a4a9a' : '#6a3a9a';
                const armColor = isArmed ? '#2a6a5a' : '#5a3a2a';
                return (
                  <div key={aid} style={{ display:'flex', gap:6, alignItems:'center' }}>
                    {idx === 0 && (
                      <span style={{ fontSize:9, color:'#3a4a3a', flexShrink:0 }}>
                        {selUnit.name.split(' ')[0]}:
                      </span>
                    )}
                    {isBonded && (
                      <span style={{ fontSize:9, color:'#4a2a5a', flexShrink:0 }}>bonded:</span>
                    )}
                    {ab.type === 'active' && (
                      abilityMode === aid
                        ? <button onClick={() => setAbilityMode(null)} style={btn(true,'#8a5a2a')}>
                            ✕ Cancel {ab.name}
                          </button>
                        : <button
                            disabled={usesLeft <= 0 || selUnit.ap <= 0}
                            onClick={() => {
                              if (usesLeft <= 0 || selUnit.ap <= 0) return;
                              if (SELF_ABILITIES.has(aid)) {
                                doAbility(selUnit.id, aid, null, null, null);
                              } else {
                                setAbilityMode(aid);
                              }
                            }}
                            style={btn(usesLeft > 0 && selUnit.ap > 0, accentColor)}>
                            ✦ {ab.name} {usesLeft > 0 ? `(${usesLeft}×)` : '(spent)'}
                          </button>
                    )}
                    {ab.type === 'reactive' && (
                      <button
                        disabled={usesLeft <= 0}
                        onClick={() => usesLeft > 0 && toggleAbilityArmed(selUnit.id, isBonded ? aid : undefined)}
                        style={btn(usesLeft > 0, armColor)}>
                        {isArmed ? `🛡 Disarm ${ab.name}` : `⚡ Arm ${ab.name}`}
                        {usesLeft > 0 ? ` (${usesLeft}×)` : ' (spent)'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Action buttons */}
        <div style={{ display:'flex', gap:7, justifyContent:'flex-end' }}>
        {adjacentTrapTarget && (
          <button onClick={() => { disarmTrap(adjacentTrapTarget.x, adjacentTrapTarget.y, sel); clearSel(); }}
            style={btn(true,'#4a8a6a')}>
            🔧 Disarm Trap (2AP)
          </button>
        )}
        {adjacentKeyTarget && (
          <button onClick={() => { doUseKey(adjacentKeyTarget.x, adjacentKeyTarget.y, sel); clearSel(); }}
            style={btn(true,'#aa8833')}>
            🔑 Use Key
          </button>
        )}
        <button onClick={() => {
          const kept = [], dropped = [];
          // Current mission loot always at risk
          ms.loot.forEach(id => { (Math.random()<0.25 ? dropped : kept).push(id); });
          // No sanctuary: travelBag is also at risk — everything Varek carries can be lost
          const bagLost = [];
          if (!sanctuaryPos && travelBag) {
            Object.entries(travelBag).forEach(([id, cnt]) => {
              for (let i = 0; i < cnt; i++) {
                if (Math.random() < 0.25) bagLost.push(id);
              }
            });
            if (bagLost.length) {
              // Remove lost items from the travelBag via endMission's bag update
              bagLost.forEach(id => {
                if (!travelBag[id]) return;
                useGameStore.setState(s => {
                  const nb = { ...s.travelBag };
                  nb[id] = Math.max(0, (nb[id]||0) - 1);
                  if (!nb[id]) delete nb[id];
                  return { travelBag: nb };
                });
              });
            }
          }
          const allDropped = [...dropped, ...bagLost];
          const msg = allDropped.length > 0
            ? `🏃 Retreating! Lost: ${allDropped.map(id => item(id)?.name||id).join(', ')}`
            : '🏃 Retreating — nothing lost this time.';
          addLog(msg);
          if (!sanctuaryPos && bagLost.length)
            addLog('⚠ No sanctuary — travel bag was also at risk.');
          endMission(ms.units, kept);
        }} style={btn(true,'#4a4a8a')}>
          🏃 Retreat
        </button>
        <button
          onClick={() => setAutoEnd(v => !v)}
          style={{
            ...btn(true, autoEnd ? '#2a6a4a' : '#4a4a4a'),
            marginRight:'auto', order:-1,
          }}>
          {autoEnd ? '⚡ Auto-End: ON' : '○ Auto-End: OFF'}
        </button>
        <button onClick={endTurn} disabled={phase!=='player'} style={btn(phase==='player','#3a7a3a')}>
          ⏭ End Turn
        </button>
        </div>
      </div>
    </div>
  );
}
