import { useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { item } from '../../data/items';

const page = {
  minHeight:'100vh', background:'#040810', color:'#c4a882', fontFamily:'Georgia,serif',
  padding:20, boxSizing:'border-box', display:'flex', justifyContent:'center', alignItems:'center',
};
const panel = {
  width:760, maxWidth:'96vw', maxHeight:'92vh', overflow:'auto', background:'#06090f',
  border:'1px solid #20203a', borderRadius:8, padding:'22px 20px', boxShadow:'0 12px 40px #0008',
};
const muted = { color:'#5a5a4a', fontSize:11 };
const btn = (enabled, color = '#5a7a5a') => ({
  background: enabled ? `${color}22` : '#07080c', border:`1px solid ${enabled ? color : '#1a1a2a'}`,
  color: enabled ? '#c4a882' : '#2a2a34', borderRadius:5, padding:'8px 11px', cursor:enabled ? 'pointer' : 'default',
  fontSize:11, fontFamily:'Georgia,serif',
});

function gearName(id, fallback) {
  if (!id) return fallback;
  const it = item(id);
  return `${it?.emoji ?? ''} ${it?.name ?? id}`.trim();
}

function unitType(unit) {
  return unit.classId ?? unit.dc ?? unit.baseClass ?? 'undead';
}

export default function SquadSelectionScreen() {
  const pending = useGameStore(s => s.pendingSquad);
  const selectedSquadIds = useGameStore(s => s.selectedSquadIds ?? []);
  const roster = useGameStore(s => s.roster ?? []);
  const vp = useGameStore(s => s.vp);
  const toggleSquadUnit = useGameStore(s => s.toggleSquadUnit);
  const confirmSquad = useGameStore(s => s.confirmSquad);
  const cancelSquadSelection = useGameStore(s => s.cancelSquadSelection);
  const saveSquadPreference = useGameStore(s => s.saveSquadPreference);

  const selected = new Set(selectedSquadIds);
  const cap = pending?.cap ?? 0;
  const location = pending?.location;

  const typeSummary = useMemo(() => {
    const counts = {};
    selectedSquadIds.forEach(id => {
      const u = roster.find(r => r.id === id);
      if (!u) return;
      const key = unitType(u).replaceAll('_', ' ');
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(' · ');
  }, [roster, selectedSquadIds]);

  if (!pending) return null;
  const canConfirm = selectedSquadIds.length <= cap;

  return (
    <div style={page}>
      <div style={panel}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:16, alignItems:'flex-start', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:10, color:'#4a5a4a', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>
              {pending.mode === 'scavenge' ? 'Scavenge' : 'Raid'} Squad
            </div>
            <h1 style={{ margin:'0 0 4px', color:'#e8d5b0', fontSize:22 }}>{location?.name ?? 'Encounter'}</h1>
            <div style={muted}>Varek deploys automatically · {selectedSquadIds.length}/{cap} undead selected</div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
            <button onClick={() => saveSquadPreference('unit')} disabled={!selectedSquadIds.length} style={btn(!!selectedSquadIds.length, '#5a6a9a')}>Save Units</button>
            <button onClick={() => saveSquadPreference('type')} disabled={!selectedSquadIds.length} style={btn(!!selectedSquadIds.length, '#6a5a9a')}>Save Types</button>
            <button onClick={cancelSquadSelection} style={btn(true, '#5a4a4a')}>Cancel</button>
          </div>
        </div>

        <div style={{ background:'#070b12', border:'1px solid #151522', borderRadius:6, padding:10, marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap', fontSize:12 }}>
            <span>🧙 Varek</span>
            <span>Lv{vp.level ?? 1}</span>
            <span>❤️ {vp.hp}/{vp.maxHp}</span>
            <span>⚔️ {gearName(vp.weapon, 'Unarmed')}</span>
            <span>🛡 {gearName(vp.armor, 'No armor')}</span>
            <span>{gearName(vp.accessory, 'No accessory')}</span>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(230px, 1fr))', gap:10 }}>
          {roster.map(u => {
            const active = selected.has(u.id);
            const disabled = !active && selectedSquadIds.length >= cap;
            return (
              <button key={u.id} onClick={() => !disabled && toggleSquadUnit(u.id)} style={{
                textAlign:'left', background:active ? '#0d1420' : '#07090f', border:`1px solid ${active ? '#5a8a5a' : '#1a1a2a'}`,
                borderRadius:7, padding:11, cursor:disabled ? 'default' : 'pointer', opacity:disabled ? 0.45 : 1,
                color:'#c4a882', fontFamily:'Georgia,serif', minHeight:132,
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginBottom:7 }}>
                  <strong style={{ color:'#e8d5b0', fontSize:13 }}>{active ? '✓ ' : ''}{u.emoji} {u.pname ?? u.name}</strong>
                  <span style={{ color:active ? '#7ab87a' : '#3a4a3a', fontSize:11 }}>{active ? 'Selected' : 'Bench'}</span>
                </div>
                <div style={{ fontSize:10, color:'#6a5a8a', marginBottom:6 }}>{u.cls ?? u.dc ?? 'Undead'} · T{u.tier ?? 1} · Lv{u.level ?? 1}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 8px', fontSize:10, color:'#6a7a6a' }}>
                  <span>❤️ {u.hp}/{u.maxHp}</span>
                  <span>XP {u.xp ?? 0}</span>
                  <span>⚔️ {gearName(u.weapon, 'Unarmed')}</span>
                  <span>🛡 {gearName(u.armor, 'No armor')}</span>
                  <span style={{ gridColumn:'1 / -1' }}>{gearName(u.accessory, 'No accessory')}</span>
                  {(u.statusEffects ?? []).length > 0 && <span style={{ gridColumn:'1 / -1', color:'#9a6a4a' }}>{u.statusEffects.map(s => s.id ?? s).join(', ')}</span>}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginTop:16, flexWrap:'wrap' }}>
          <div style={{ ...muted, maxWidth:420 }}>{typeSummary || 'No undead selected'}</div>
          <button disabled={!canConfirm} onClick={() => confirmSquad(selectedSquadIds)} style={btn(canConfirm, '#4a8a4a')}>
            Confirm Squad
          </button>
        </div>
      </div>
    </div>
  );
}
