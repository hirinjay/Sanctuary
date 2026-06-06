import { useState } from 'react';
import { LOCS } from '../../data/locations';
import { useGameStore } from '../../store/gameStore';

const DANGER_COLOR = ['','#4a7a4a','#8a7a2a','#8a3a3a'];
const DANGER_LABEL = ['','Low','Medium','High'];

export default function NodeMap() {
  const startMission = useGameStore(s => s.startMission);
  const [active, setActive] = useState(null);

  const W = 480, H = 280;

  // Build edge list
  const edges = [];
  const seen = new Set();
  for (const loc of LOCS) {
    for (const lid of loc.links) {
      const key = [loc.id, lid].sort().join('-');
      if (!seen.has(key)) {
        seen.add(key);
        const other = LOCS.find(l => l.id === lid);
        if (other) edges.push([loc, other]);
      }
    }
  }

  function nodePos(loc) {
    return { x:(loc.x/100)*W, y:(loc.y/100)*H };
  }

  const activeLoc = LOCS.find(l => l.id === active);

  return (
    <div style={{ position:'relative', width:W, height:H, maxWidth:'100%', margin:'0 auto',
      background:'#060a10', borderRadius:10, border:'1px solid #1a1a2a', overflow:'hidden' }}>

      {/* Atmospheric gradient */}
      <div style={{ position:'absolute', inset:0, background:
        'radial-gradient(ellipse at 85% 15%, #0f0a1e 0%, transparent 55%), radial-gradient(ellipse at 15% 80%, #0a100a 0%, transparent 55%)',
        pointerEvents:'none' }} />

      {/* SVG connection lines */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {edges.map(([a, b]) => {
          const pa = nodePos(a), pb = nodePos(b);
          return (
            <line key={`${a.id}-${b.id}`}
              x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
              stroke="#2a2a3a" strokeWidth="1.5" strokeDasharray="5 4"
              opacity="0.7"
            />
          );
        })}
      </svg>

      {/* Nodes */}
      {LOCS.map(loc => {
        const { x, y } = nodePos(loc);
        const isActive = active === loc.id;
        return (
          <div key={loc.id} style={{ position:'absolute', left:x, top:y, transform:'translate(-50%,-50%)',
            zIndex:isActive ? 10 : 5 }}>
            {/* Pulse ring */}
            {isActive && (
              <div style={{ position:'absolute', inset:-8, borderRadius:'50%',
                border:`1px solid ${DANGER_COLOR[loc.danger]}`,
                animation:'pulse 1.8s ease-in-out infinite', opacity:0.5 }} />
            )}
            <button
              onClick={() => setActive(isActive ? null : loc.id)}
              style={{
                background: isActive ? '#12101e' : '#0b0f1c',
                border:`1px solid ${isActive ? DANGER_COLOR[loc.danger] : '#2a2a3a'}`,
                borderRadius:7, padding:'7px 11px', cursor:'pointer',
                color:'#c4a882', minWidth:110, textAlign:'center',
                boxShadow: isActive ? `0 0 12px ${DANGER_COLOR[loc.danger]}44` : 'none',
              }}>
              <div style={{ fontSize:10, color:DANGER_COLOR[loc.danger], marginBottom:2, letterSpacing:1 }}>
                {'▲'.repeat(loc.danger)} {DANGER_LABEL[loc.danger]}
              </div>
              <div style={{ fontSize:11, fontWeight:'bold', color:'#e8d5b0' }}>{loc.name}</div>
              <div style={{ fontSize:9, color:'#4a5a4a', marginTop:2 }}>{loc.desc}</div>
            </button>

            {/* Expanded action panel */}
            {isActive && (
              <div style={{ position:'absolute', top:'calc(100% + 8px)', left:'50%', transform:'translateX(-50%)',
                background:'#0b0f1c', border:`1px solid ${DANGER_COLOR[loc.danger]}`, borderRadius:7,
                padding:'10px 12px', whiteSpace:'nowrap', zIndex:20,
                boxShadow:`0 4px 20px ${DANGER_COLOR[loc.danger]}33` }}>
                <div style={{ fontSize:10, color:'#4a5a4a', marginBottom:8, textAlign:'center' }}>
                  Loot: <span style={{ color:'#c4a882' }}>{loc.lq}</span>
                </div>
                <div style={{ display:'flex', gap:7 }}>
                  <button onClick={() => startMission(loc, 'scavenge')} style={{
                    background:'#0a1a0a', border:'1px solid #3a6a3a', borderRadius:5,
                    padding:'6px 11px', color:'#5a9a5a', cursor:'pointer', fontSize:11,
                  }}>
                    🤫 Scavenge
                  </button>
                  <button onClick={() => startMission(loc, 'raid')} style={{
                    background:'#1a0a0a', border:'1px solid #6a3a3a', borderRadius:5,
                    padding:'6px 11px', color:'#9a5a5a', cursor:'pointer', fontSize:11,
                  }}>
                    ⚔️ Raid
                  </button>
                </div>
                <div style={{ fontSize:9, color:'#2a3a2a', marginTop:7, textAlign:'center' }}>
                  Scavenge: quiet, containers only<br/>
                  Raid: +50% XP, reinforcements
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Legend */}
      <div style={{ position:'absolute', bottom:10, left:12, fontSize:9, color:'#2a3a3a' }}>
        ▲ Low &nbsp; ▲▲ Medium &nbsp; ▲▲▲ High danger
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity:.3; transform:scale(.95); } 50% { opacity:.7; transform:scale(1.05); } }`}</style>
    </div>
  );
}
