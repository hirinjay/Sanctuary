import { useState, useRef, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { UT } from '../../data/constants';
import { item } from '../../data/items';
import { moveRange, fog, dist } from '../../systems/map';
import MissionMap from '../mission/MissionMap';
import UnitBar from '../mission/UnitBar';
import RaisePanel from '../mission/RaisePanel';
import LevelUpModal from '../mission/LevelUpModal';

const pg = { background:'#040810', minHeight:'100vh', fontFamily:'Georgia,serif', color:'#c4a882', padding:9, userSelect:'none' };

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
  const { ms, noise, phase, luq, log, vp, loc, mode, book, ti, travelBag, sanctuaryPos,
          doMove, doAttack, doRaise, endTurn, endMission, setScreen, addLog } = useGameStore();

  // sel & hilight are local — they don't need persistence and use the hilightRef pattern
  // to avoid stale closures on grid click
  const [sel, setSel]         = useState(null);
  const [hilight, setHilight] = useState(new Set());
  const hilightRef            = useRef(new Set());

  const clearSel = useCallback(() => {
    setSel(null);
    setHilight(new Set());
    hilightRef.current = new Set();
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
    setHL(moveRange(u, tiles, units));
  }

  function handleCellClick(x, y, u, vis, hi) {
    if (!vis) return;
    if (u) {
      if (u.type === UT.ENEMY && !u.fallen && sel) {
        doAttack(u, sel);
        clearSel();
      } else if (u.type !== UT.ENEMY && !u.fallen) {
        handleSelect(u);
      }
    } else if (hi) {
      doMove(x, y, sel, hilightRef.current);
      clearSel();
    }
  }

  const selUnit = sel ? units.find(u => u.id === sel) : null;

  const noiseColor = noise < 30 ? '#3a7a3a' : noise < 60 ? '#7a6a2a' : '#7a2a2a';
  const noiseLabel = noise < 30 ? 'Quiet (👁3)' : noise < 60 ? 'Tense (👁4)' : 'Alert! (👁5)';

  return (
    <div style={pg}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
        marginBottom:5, flexWrap:'wrap', gap:5, fontSize:11, maxWidth:510, margin:'0 auto 5px' }}>
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
        </div>
      </div>

      {/* Map */}
      <MissionMap
        tiles={tiles} units={units} W={mapW} fv={fv}
        hilight={hilight} raiseable={raiseable}
        onCellClick={handleCellClick} theme={theme}
      />

      {/* Unit bar */}
      <UnitBar units={units} sel={sel} onSelect={handleSelect} />

      {/* Raise / gather panel */}
      <RaisePanel units={units} turn={turn} raiseable={raiseable} book={book} />

      {/* Hint */}
      <div style={{ maxWidth:510, margin:'0 auto 5px', fontSize:10, color:'#2a3a2a' }}>
        {selUnit ? `${selUnit.name} — tap green to move, tap enemy to attack` : 'Tap a unit to select'}
      </div>

      {/* Combat log */}
      <div style={{ maxWidth:510, margin:'0 auto', background:'#04040a',
        border:'1px solid #111120', borderRadius:4, padding:6,
        height:66, overflowY:'auto', marginBottom:7 }}>
        {log.map((l, i) => (
          <div key={i} style={{ fontSize:10, color:i===0?'#c4a882':'#333345', lineHeight:1.6 }}>{l}</div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ maxWidth:510, margin:'0 auto', display:'flex', gap:7, justifyContent:'flex-end' }}>
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
        <button onClick={endTurn} disabled={phase!=='player'} style={btn(phase==='player','#3a7a3a')}>
          ⏭ End Turn
        </button>
      </div>
    </div>
  );
}
