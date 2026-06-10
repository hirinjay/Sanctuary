import { useGameStore } from '../../store/gameStore';
import { dist } from '../../systems/map';

export default function RaisePanel({ units, turn, raiseable }) {
  const { ti, doRaise, doGather } = useGameStore();
  const t = ti(units);

  const friendly      = units.filter(u => u.type !== 'enemy' && !u.fallen);
  const fallenEnemies = units.filter(u => u.type === 'enemy' && u.fallen);
  const gatherable    = fallenEnemies.filter(fe =>
    friendly.some(f => !f.fallen && f.actionPoints > 0 && dist(f, fe) <= 1)
  );

  if (raiseable.length === 0 && gatherable.length === 0) return null;

  const btnSt = (on, c) => ({
    background: on ? `${c}18` : '#080d18',
    border: `1px solid ${on ? c : '#222233'}`,
    borderRadius:4, padding:'4px 9px',
    color: on ? c : '#4a4a5a',
    cursor: on ? 'pointer' : 'default', fontSize:10,
  });

  return (
    <div style={{ maxWidth:510, margin:'0 auto 5px', background:'#0b0b20',
      border:'1px solid #2a2a6a', borderRadius:5, padding:8 }}>

      {raiseable.length > 0 && (
        <>
          <div style={{ fontSize:10, color:'#6a6a9a', marginBottom:6 }}>
            🪄 Raise ({t.free} tether free):
          </div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:gatherable.length>0?8:0 }}>
            {raiseable.map(u => {
              const fresh = (turn - u.raiseTurn) <= 2;
              return (
                <button key={u.id} disabled={t.free<=0} onClick={() => doRaise(u)} style={btnSt(t.free>0,'#6a6a9a')}>
                  {u.emoji}→💀 {u.dc} {fresh?'(Fresh)':'(Degraded)'}
                </button>
              );
            })}
            {t.free <= 0 && <span style={{ fontSize:10, color:'#6a2a2a' }}>Tether full!</span>}
          </div>
        </>
      )}

      {gatherable.length > 0 && (
        <>
          <div style={{ fontSize:10, color:'#8a6a3a', marginBottom:5 }}>🦴 Loot Bodies (costs AP):</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {gatherable.map(fe => {
              const gatherer    = friendly.find(f => !f.fallen && f.actionPoints>0 && dist(f,fe)<=1);
              const gatherCount = fe.gatherCount || 0;
              const pct         = Math.round(Math.min(1, 0.3 + gatherCount * 0.3) * 100);
              return (
                <div key={fe.id} style={{ display:'flex', gap:5, alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ fontSize:10, color:'#5a4a3a' }}>{fe.name}:</span>
                  <button onClick={() => doGather(fe, gatherer, false)} style={btnSt(true,'#8a6a3a')}>
                    🎲 1AP <span style={{ color:'#5a4a2a', fontSize:9 }}>({pct}% gone)</span>
                  </button>
                  <button disabled={gatherer.actionPoints<=0 || gatherer.movementPoints<=0} onClick={() => doGather(fe, gatherer, true)} style={btnSt(gatherer.actionPoints>0 && gatherer.movementPoints>0,'#6a8a3a')}>
                    🦴 Full turn guaranteed
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
