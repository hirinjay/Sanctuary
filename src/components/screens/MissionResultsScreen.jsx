import { useGameStore } from '../../store/gameStore';
import { item } from '../../data/items';
import LevelUpModal from '../mission/LevelUpModal';

export default function MissionResultsScreen() {
  const result = useGameStore(s => s.missionResult);
  const luq = useGameStore(s => s.luq ?? []);
  const continueFromMissionResult = useGameStore(s => s.continueFromMissionResult);
  const returnToWorld = useGameStore(s => s.returnToWorld);
  const goDeeper = useGameStore(s => s.goDeeper);

  if (!result) {
    return (
      <div style={page}>
        <div style={panel}>
          <h2 style={title}>Encounter Resolved</h2>
          <p style={muted}>No mission summary is available.</p>
          <button onClick={() => returnToWorld()} style={primaryBtn(true)}>Return to Map</button>
        </div>
      </div>
    );
  }

  const lootCounts = (result.loot ?? []).reduce((acc, id) => {
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});
  const hasPendingLevelUp = luq.length > 0;
  const fallenUnits = result.fallenUnits ?? [];
  const gainedUnits = result.gainedUnits ?? [];
  const survivalXpUnits = result.survivalXpUnits ?? [];
  const canGoDeeper = result.canGoDeeper ?? false;
  const floor = result.floor ?? 1;
  const maxFloor = result.maxFloor ?? 1;
  const isMultiFloor = maxFloor > 1;

  return (
    <div style={page}>
      {hasPendingLevelUp && <LevelUpModal />}
      <div style={panel}>
        <div style={{ fontSize:34, marginBottom:8 }}>{result.success ? '✓' : '↩'}</div>
        <h2 style={title}>{result.success ? 'Mission Complete' : 'Mission Ended'}</h2>
        <p style={muted}>{result.locationName}</p>
        {isMultiFloor && (
          <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:12 }}>
            {Array.from({ length: maxFloor }, (_, i) => i + 1).map(f => (
              <div key={f} style={{
                width:22, height:22, borderRadius:3, fontSize:10,
                display:'flex', alignItems:'center', justifyContent:'center',
                background: f < floor ? '#1a3a1a' : f === floor ? '#2a5a2a' : '#0a0a14',
                border: `1px solid ${f < floor ? '#3a6a3a' : f === floor ? '#5a9a5a' : '#1a1a2a'}`,
                color: f < floor ? '#5a9a5a' : f === floor ? '#9aca9a' : '#2a3a2a',
              }}>{f < floor ? '✓' : f}</div>
            ))}
          </div>
        )}

        <div style={section}>
          <div style={label}>Spoils</div>
          {Object.keys(lootCounts).length > 0 ? (
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {Object.entries(lootCounts).map(([id, count]) => {
                const it = item(id);
                return <div key={id} style={row}>{it?.emoji ?? '•'} {it?.name ?? id} ×{count}</div>;
              })}
            </div>
          ) : <div style={empty}>Nothing secured</div>}
        </div>

        <div style={section}>
          <div style={label}>Company</div>
          {survivalXpUnits.length > 0 && (
            <div style={{ marginBottom:8 }}>
              <div style={subLabel}>Survived +1 XP</div>
              {survivalXpUnits.map(u => <div key={u.id} style={row}>{u.emoji} {u.name} <span style={mutedInline}>{u.className}</span></div>)}
            </div>
          )}
          {fallenUnits.length > 0 && (
            <div style={{ marginBottom:8 }}>
              <div style={{ ...subLabel, color:'#8a4a4a' }}>Fallen</div>
              {fallenUnits.map(u => <div key={u.id} style={row}>{u.emoji} {u.name} <span style={mutedInline}>{u.className}</span></div>)}
            </div>
          )}
          {gainedUnits.length > 0 && (
            <div>
              <div style={{ ...subLabel, color:'#5a8a5a' }}>Raised</div>
              {gainedUnits.map(u => <div key={u.id} style={row}>{u.emoji} {u.name} <span style={mutedInline}>{u.className}</span></div>)}
            </div>
          )}
          {survivalXpUnits.length === 0 && fallenUnits.length === 0 && gainedUnits.length === 0 && (
            <div style={empty}>No company changes</div>
          )}
        </div>

        {(result.logs ?? []).length > 0 && (
          <div style={section}>
            <div style={label}>Report</div>
            {(result.logs ?? []).slice(0, 5).map((line, i) => (
              <div key={i} style={row}>{line}</div>
            ))}
          </div>
        )}

        {result.clearedLocation && (
          <div style={{ ...notice, borderColor:'#5a4a2a', color:'#b89755' }}>
            Cleared cabin removed from the world map.
          </div>
        )}

        {hasPendingLevelUp && (
          <div style={notice}>Resolve level-up choices before returning to the world map.</div>
        )}

        {canGoDeeper ? (
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:18 }}>
            <button disabled={hasPendingLevelUp} onClick={() => { if (!hasPendingLevelUp) goDeeper(); }}
              style={primaryBtn(!hasPendingLevelUp)}>
              ↓ Go Deeper — Floor {floor + 1}
            </button>
            <button onClick={continueFromMissionResult} style={secondaryBtn}>
              ↩ Retreat with Loot
            </button>
          </div>
        ) : (
          <button disabled={hasPendingLevelUp} onClick={continueFromMissionResult} style={primaryBtn(!hasPendingLevelUp)}>
            Return to Map
          </button>
        )}
      </div>
    </div>
  );
}

const page = {
  background:'#040810', minHeight:'100vh', fontFamily:'Georgia,serif', color:'#c4a882',
  display:'flex', alignItems:'center', justifyContent:'center', padding:20, boxSizing:'border-box',
};
const panel = {
  width:420, maxWidth:'96vw', background:'#06090f', border:'1px solid #20203a', borderRadius:8,
  padding:'24px 22px', textAlign:'center', boxShadow:'0 12px 40px #0008',
};
const title = { color:'#e8d5b0', fontSize:22, margin:'0 0 4px', letterSpacing:2, textTransform:'uppercase' };
const muted = { color:'#6a6a55', fontSize:12, margin:'0 0 18px' };
const section = { borderTop:'1px solid #151522', paddingTop:12, marginTop:12, textAlign:'left' };
const label = { color:'#4a5a4a', fontSize:10, letterSpacing:1, textTransform:'uppercase', marginBottom:7 };
const row = { color:'#a89572', fontSize:12, lineHeight:1.5 };
const subLabel = { color:'#7898b8', fontSize:10, marginBottom:3 };
const mutedInline = { color:'#4a4a55', fontSize:10, marginLeft:6 };
const empty = { color:'#3a3a45', fontSize:12 };
const notice = {
  margin:'16px 0 0', border:'1px solid #27364a', background:'#080d16', borderRadius:5,
  padding:'8px 10px', color:'#7898b8', fontSize:11,
};
const primaryBtn = (enabled) => ({
  width:'100%', background: enabled ? '#0a1a14' : '#06090f',
  border: `1px solid ${enabled ? '#4a8a5a' : '#1a1a2a'}`, borderRadius:5,
  padding:'10px 0', color: enabled ? '#7ab87a' : '#2a3a2a', cursor: enabled ? 'pointer' : 'default', fontSize:13,
});
const secondaryBtn = {
  width:'100%', background:'#0a0a14', border:'1px solid #3a2a2a', borderRadius:5,
  padding:'9px 0', color:'#7a5a5a', cursor:'pointer', fontSize:12,
};
