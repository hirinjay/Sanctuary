import { useGameStore } from '../../store/gameStore';
import NodeMap from '../overworld/NodeMap';
import { xpNext } from '../../systems/combat';

export default function OverworldScreen() {
  const { vp, enterSanctuary, ti } = useGameStore();
  const t = ti(null);

  const btn = (on, c) => ({
    background: on ? `${c}18` : '#0b0f1c',
    border: `1px solid ${on ? c : '#222233'}`,
    borderRadius:5, padding:'6px 12px',
    color: on ? c : '#7a7a8a',
    cursor: on ? 'pointer' : 'default', fontSize:11,
  });

  return (
    <div style={{ background:'#040810', minHeight:'100vh', fontFamily:'Georgia,serif', color:'#c4a882', padding:14 }}>
      <div style={{ maxWidth:520, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h2 style={{ color:'#e8d5b0', margin:0, fontSize:16, letterSpacing:2 }}>⬡ OVERWORLD</h2>
          <button onClick={() => enterSanctuary()} style={btn(true, '#6a9a6a')}>⌂ Sanctuary</button>
        </div>

        {/* Varek status bar */}
        <div style={{ background:'#090e1a', border:'1px solid #1a1a2a', borderRadius:7,
          padding:'9px 13px', marginBottom:16, fontSize:11,
          display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ color:'#e8d5b0' }}>🧙 Varek Lv{vp.level}</span>
          <span>❤️ {vp.hp}/{vp.maxHp}</span>
          <span style={{ color:t.free>0?'#5a8a5a':'#8a3a3a' }}>⛓ {t.used}/{t.cap}</span>
          <span>🪄 Raise {vp.raiseRange}</span>
          <span>🧿 Drain {vp.drainRange}</span>
          <span style={{ color:'#4a5a4a', marginLeft:'auto' }}>
            XP {vp.xp}/{xpNext(vp.level)}
          </span>
        </div>

        {/* Node map */}
        <div style={{ marginBottom:12 }}>
          <p style={{ fontSize:11, color:'#3a4a3a', marginBottom:10 }}>
            Click a location to deploy. Danger increases to the northeast.
          </p>
          <NodeMap />
        </div>
      </div>
    </div>
  );
}
