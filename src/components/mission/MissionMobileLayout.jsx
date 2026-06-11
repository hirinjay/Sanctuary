import { useState } from 'react';
import { UT } from '../../data/constants';
import { xpNext } from '../../systems/combat';
import MissionMap from './MissionMap';
import RaisePanel from './RaisePanel';
import LevelUpModal from './LevelUpModal';
import { ABILITIES } from '../../data/abilities';

const SELF_ABILITIES = new Set([
  'intimidate','entangle','mass_entangle','mass_entangle_warden',
  'shockwave','overclock','rain_of_arrows','barrage','vanish',
  'ambush','superior_ambush','thornfield','thornfield_shot','stranglehold_field',
  'tether_pulse','desecrate','phantom_sight',
]);

export default function MissionMobileLayout(props) {
  const {
    ms, units, tiles, mapW, fv, hilight, raiseable, theme, loc, mode, turn,
    varek, t, fieldTether, noiseColor, sel, selUnit, phase, log, luq,
    abilityMode, setAbilityMode, handleSelect, handleCellClick, clearSel,
    doUseKey, disarmTrap, doOpenDoor, doBashDoor, doAbility, toggleAbilityArmed, waitUnit,
    endTurn, autoEnd, setAutoEnd, adjacentTrapTarget, adjacentKeyTarget, adjacentDoorTarget,
    adjacentLockedDoorTarget,
    handleRetreat,
  } = props;

  const [sheetOpen, setSheetOpen] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const friendly = units.filter(u => u.type !== UT.ENEMY);
  const objective = ms.objective;
  const activeAbilityIds = selUnit
    ? [selUnit.classAbility, ...(selUnit.bondedAbilities ?? [])].filter(aid => {
        const type = ABILITIES[aid]?.type;
        return type === 'active' || type === 'reactive';
      })
    : [];
  const passiveAbilityIds = selUnit
    ? [selUnit.classAbility, ...(selUnit.bondedAbilities ?? [])].filter(aid => ABILITIES[aid]?.type === 'passive')
    : [];
  const canAct = selUnit && phase === 'player' && selUnit.actionPoints > 0 && !selUnit.fallen;

  return (
    <div style={mobilePg}>
      {(luq ?? []).length > 0 && <LevelUpModal />}

      <div style={topBar}>
        <div style={{ minWidth:0 }}>
          <div style={{ color:'#e8d5b0', fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{loc?.name ?? 'Encounter'}</div>
          <div style={{ color:'#4a5a4a', fontSize:10 }}>{mode === 'scavenge' ? 'Scavenge' : 'Raid'} · Turn {turn}</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', fontSize:11, flexShrink:0 }}>
          <span style={{ color:noiseColor }}>🔊</span>
          <span>❤️ {varek?.hp}/{varek?.maxHp}</span>
          <span style={{ color:t.fieldCount < t.fieldCap ? '#5a9a5a' : '#9a4a4a' }}>⛓ {fieldTether}</span>
        </div>
      </div>

      {objective && (
        <div style={objectiveBar}>
          <span>{objective.complete ? '⭐' : objective.failed ? '✗' : '◼'}</span>
          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{objective.label}</span>
          {objective.type === 'survive' && !objective.complete && <span style={{ marginLeft:'auto' }}>{turn}/{objective.turns}</span>}
        </div>
      )}

      <div style={mapWrap}>
        <MissionMap
          tiles={tiles} units={units} W={mapW} fv={fv}
          hilight={selUnit && selUnit.movementPoints > 0 ? hilight : new Set()} raiseable={raiseable}
          onCellClick={handleCellClick} theme={theme} tileSize={42}
        />
      </div>

      <div style={unitRail}>
        {friendly.map(u => (
          <button key={u.id} onClick={() => { handleSelect(u); setSheetOpen(true); }} style={{
            ...railButton,
            borderColor: sel === u.id ? '#5a8a5a' : '#1a1a2a',
            background: sel === u.id ? '#102414' : '#070b14',
            opacity: u.fallen ? 0.35 : 1,
          }}>
            <span>{u.emoji}</span>
            <span style={{ color:'#d0c0a0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.pname ?? u.name}</span>
            <span style={{ color:u.movementPoints > 0 ? '#5a9a5a' : '#6a3a3a' }}>👟{u.movementPoints>0?1:0}</span>
            <span style={{ color:u.actionPoints > 0 ? '#5a9a5a' : '#6a3a3a' }}>⚔{u.actionPoints>0?1:0}</span>
          </button>
        ))}
      </div>

      <button onClick={() => setLogOpen(v => !v)} style={logToggle}>
        {logOpen ? 'Hide Log' : log[0] ?? 'Show Log'}
      </button>
      {logOpen && (
        <div style={logPanel}>
          {log.map((l, i) => <div key={i} style={{ color:i === 0 ? '#c4a882' : '#586070', fontSize:11, lineHeight:1.5 }}>{l}</div>)}
        </div>
      )}

      <div style={{ ...sheet, maxHeight:sheetOpen ? '58vh' : 64 }}>
        <button onClick={() => setSheetOpen(v => !v)} style={handle} aria-label={sheetOpen ? 'Collapse actions' : 'Expand actions'} />
        {selUnit && selUnit.type !== UT.ENEMY ? (
          <>
            <div style={sheetHeader}>
              <div style={{ minWidth:0 }}>
                <div style={{ color:'#e8d5b0', fontWeight:'bold', fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selUnit.emoji} {selUnit.name}</div>
                <div style={{ color:'#4a5a4a', fontSize:10 }}>Lv{selUnit.level} · XP {selUnit.xp ?? 0}/{xpNext(selUnit.level ?? 1)} · HP {selUnit.hp}/{selUnit.maxHp}</div>
              </div>
              <button onClick={() => { waitUnit(selUnit.id); clearSel(); }} disabled={!canAct} style={actionButton(canAct, '#6a6a9a')}>Wait</button>
            </div>

            {sheetOpen && (
              <div style={{ overflowY:'auto', paddingBottom:8 }}>
                <div style={statsGrid}>
                  <span>⚔ {selUnit.dmg}</span><span>🛡 {selUnit.def ?? 0}</span><span>👟 {selUnit.moveRange}</span><span>👟{selUnit.movementPoints} ⚔{selUnit.actionPoints}</span>
                </div>
                {passiveAbilityIds.length > 0 && (
                  <div style={badgeRow}>
                    {passiveAbilityIds.map(aid => <span key={aid} title={ABILITIES[aid]?.desc} style={passiveBadge}>◆ {ABILITIES[aid]?.name}</span>)}
                  </div>
                )}
                {activeAbilityIds.length > 0 && (
                  <div style={{ display:'grid', gap:7, marginTop:8 }}>
                    {activeAbilityIds.map(aid => {
                      const ab = ABILITIES[aid];
                      if (!ab) return null;
                      const usesLeft = selUnit.abilityUses?.[aid] ?? 0;
                      const targeting = abilityMode === aid;
                      const isBonded = aid !== selUnit.classAbility;
                      const isArmed = isBonded ? !!selUnit.bondedArmed?.[aid] : selUnit.abilityArmed;
                      const available = ab.type === 'reactive' ? usesLeft > 0 : usesLeft > 0 && selUnit.actionPoints > 0;
                      return (
                        <button key={aid} disabled={!available && !targeting} style={abilityButton(available || targeting, targeting, isArmed)} onClick={() => {
                          if (targeting) { setAbilityMode(null); return; }
                          if (!available) return;
                          if (ab.type === 'reactive') toggleAbilityArmed(selUnit.id, isBonded ? aid : undefined);
                          else if (SELF_ABILITIES.has(aid)) doAbility(selUnit.id, aid, null, null, null);
                          else setAbilityMode(aid);
                        }}>
                          <span style={{ fontSize:9, color:targeting ? '#d99a55' : ab.type === 'reactive' ? '#b9a45a' : '#8f79bd', textTransform:'uppercase' }}>{targeting ? 'Targeting' : ab.type}{usesLeft > 0 ? ' · ' + usesLeft + '×' : ''}</span>
                          <span style={{ color:available || targeting ? '#e8d5b0' : '#3a3a3a', fontWeight:'bold' }}>{targeting ? 'Cancel' : ab.name}{isArmed ? ' · armed' : ''}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ color:'#6a705e', fontSize:12 }}>Tap one of your units to open actions.</div>
        )}

        {sheetOpen && (
          <>
            <RaisePanel units={units} turn={turn} raiseable={raiseable} book={props.book} />
            <div style={footerActions}>
              {adjacentTrapTarget && <button onClick={() => { disarmTrap(adjacentTrapTarget.x, adjacentTrapTarget.y, sel); clearSel(); }} style={actionButton(true, '#4a8a6a')}>Disarm</button>}
              {adjacentKeyTarget && <button onClick={() => { doUseKey(adjacentKeyTarget.x, adjacentKeyTarget.y, sel); clearSel(); }} style={actionButton(true, '#aa8833')}>Use Key</button>}
              {adjacentDoorTarget && <button onClick={() => { doOpenDoor(adjacentDoorTarget.x, adjacentDoorTarget.y, sel); clearSel(); }} style={actionButton(true, '#7a8a4a')}>Open Door</button>}
              {adjacentLockedDoorTarget && <button onClick={() => { doBashDoor(adjacentLockedDoorTarget.x, adjacentLockedDoorTarget.y, sel); clearSel(); }} style={actionButton(true, '#8a5a3a')}>Bash Door</button>}
              <button onClick={() => setAutoEnd(v => !v)} style={actionButton(true, autoEnd ? '#2a8a5a' : '#5a5a5a')}>{autoEnd ? 'Auto-End On' : 'Auto-End Off'}</button>
              <button onClick={handleRetreat} style={actionButton(true, '#5a5a9a')}>Retreat</button>
              <button onClick={endTurn} disabled={phase !== 'player'} style={actionButton(phase === 'player', '#4a8a4a')}>End Turn</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const mobilePg = { background:'#040810', height:'100dvh', overflow:'hidden', position:'relative', fontFamily:'Georgia,serif', color:'#c4a882', userSelect:'none' };
const topBar = { position:'absolute', top:0, left:0, right:0, zIndex:5, minHeight:50, display:'flex', justifyContent:'space-between', gap:10, alignItems:'center', padding:'7px 10px', background:'#040810ee', borderBottom:'1px solid #141422', boxSizing:'border-box' };
const objectiveBar = { position:'absolute', top:51, left:8, right:8, zIndex:5, display:'flex', alignItems:'center', gap:6, padding:'6px 8px', background:'#080d18dd', border:'1px solid #26354c', borderRadius:5, fontSize:11, boxSizing:'border-box' };
const mapWrap = { position:'absolute', inset:'86px 0 184px 0', overflow:'auto', padding:'8px 8px 16px', boxSizing:'border-box' };
const unitRail = { position:'absolute', left:0, right:0, bottom:176, zIndex:6, display:'flex', gap:6, overflowX:'auto', padding:'6px 8px', background:'#040810dd', borderTop:'1px solid #101828', boxSizing:'border-box' };
const railButton = { minWidth:116, height:44, display:'grid', gridTemplateColumns:'18px 1fr auto', alignItems:'center', gap:5, border:'1px solid #1a1a2a', borderRadius:5, padding:'0 8px', color:'#c4a882', fontSize:10 };
const sheet = { position:'absolute', left:0, right:0, bottom:0, zIndex:7, minHeight:64, background:'#06090fee', borderTop:'1px solid #252545', borderRadius:'10px 10px 0 0', padding:'8px 10px 10px', boxSizing:'border-box', transition:'max-height 160ms ease', overflow:'hidden', boxShadow:'0 -8px 30px #0009' };
const handle = { display:'block', width:44, height:5, margin:'0 auto 8px', border:0, borderRadius:999, background:'#303044', cursor:'pointer' };
const sheetHeader = { display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:8 };
const statsGrid = { display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6, fontSize:11, color:'#8a9a8a', marginBottom:8 };
const badgeRow = { display:'flex', gap:5, flexWrap:'wrap', marginBottom:7 };
const passiveBadge = { background:'#0a140a', border:'1px solid #1a2a1a', borderRadius:3, padding:'4px 7px', color:'#5a8a5a', fontSize:10 };
const footerActions = { display:'flex', gap:7, overflowX:'auto', paddingTop:8, borderTop:'1px solid #141422' };
const logToggle = { position:'absolute', left:8, right:8, bottom:246, zIndex:6, minHeight:34, background:'#070b14ee', border:'1px solid #1c2435', borderRadius:6, color:'#8790a0', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', padding:'0 10px' };
const logPanel = { position:'absolute', left:8, right:8, bottom:284, zIndex:8, maxHeight:150, overflowY:'auto', background:'#04040a', border:'1px solid #182038', borderRadius:6, padding:8, boxShadow:'0 8px 24px #000b' };
function actionButton(on, c) { return { minHeight:44, minWidth:86, background:on ? c + '22' : '#060609', border:'1px solid ' + (on ? c : '#1a1a22'), borderRadius:6, color:on ? c : '#3a3a3a', cursor:on ? 'pointer' : 'default', fontSize:11, padding:'0 10px', flexShrink:0 }; }
function abilityButton(on, targeting, armed) { return { minHeight:46, width:'100%', display:'flex', flexDirection:'column', alignItems:'flex-start', justifyContent:'center', gap:2, background:targeting ? '#1a0a00' : armed ? '#0a1a14' : on ? '#100a18' : '#060609', border:'1px solid ' + (targeting ? '#8a4a1a' : armed ? '#2a7a5a' : on ? '#4a2a6a' : '#141414'), borderRadius:6, padding:'5px 10px', textAlign:'left' }; }
