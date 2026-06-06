import { useState } from 'react';
import { LOCS } from '../../data/locations';
import { useGameStore } from '../../store/gameStore';

const DANGER_COLOR = ['','#4a7a4a','#8a7a2a','#8a3a3a'];
const DANGER_LABEL = ['','Low','Medium','High'];

export default function NodeMap() {
  const startMission   = useGameStore(s => s.startMission);
  const unlockedLocs   = useGameStore(s => s.unlockedLocs);
  const [active, setActive] = useState(null);

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

  return (
    // Outer wrapper: overflow visible so action panels can pop out
    <div style={{ position:'relative', width:'100%', margin:'0 auto', paddingBottom:80 }}>

      {/* Map canvas — fixed height, clipped background */}
      <div style={{ position:'relative', width:'100%', height:300 }}>

        {/* Clipped background (rounded corners stay intact) */}
        <div style={{ position:'absolute', inset:0, borderRadius:10,
          background:'#060a10', border:'1px solid #1a1a2a', overflow:'hidden', pointerEvents:'none' }}>
          <div style={{ position:'absolute', inset:0, background:
            'radial-gradient(ellipse at 85% 15%, #100a1e 0%, transparent 60%), radial-gradient(ellipse at 12% 85%, #0a120a 0%, transparent 55%)' }} />
          {/* Subtle terrain texture lines */}
          <svg width="100%" height="100%" style={{ opacity:.07 }}>
            {Array.from({length:8},(_,i)=>(
              <line key={i} x1="0" y1={`${10+i*12}%`} x2="100%" y2={`${10+i*12}%`}
                stroke="#6a7a6a" strokeWidth="0.5" strokeDasharray="3 8" />
            ))}
          </svg>
        </div>

        {/* SVG connection lines (percentage-based, fully responsive) */}
        <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}>
          {edges.map(([a, b]) => {
            const unlA = unlockedLocs.includes(a.id);
            const unlB = unlockedLocs.includes(b.id);
            const visible = unlA || unlB;
            return (
              <line key={`${a.id}-${b.id}`}
                x1={`${a.x}%`} y1={`${a.y}%`}
                x2={`${b.x}%`} y2={`${b.y}%`}
                stroke={visible ? '#2a2a4a' : '#151520'}
                strokeWidth="1.5" strokeDasharray="5 5"
                opacity={visible ? 0.8 : 0.3}
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {LOCS.map(loc => {
          const unlocked = unlockedLocs.includes(loc.id);
          const isActive = active === loc.id && unlocked;
          // Flip popup above node if it's in the lower portion of the map
          const popupAbove = loc.y > 52;

          return (
            <div key={loc.id} style={{
              position:'absolute',
              left:`${loc.x}%`, top:`${loc.y}%`,
              transform:'translate(-50%,-50%)',
              zIndex: isActive ? 20 : 5,
            }}>
              {/* Active pulse ring */}
              {isActive && (
                <div style={{ position:'absolute', inset:-10, borderRadius:10,
                  border:`1px solid ${DANGER_COLOR[loc.danger]}`,
                  animation:'pulse 1.8s ease-in-out infinite', opacity:0.5,
                  pointerEvents:'none' }} />
              )}

              <button
                onClick={() => unlocked && setActive(isActive ? null : loc.id)}
                style={{
                  background: isActive ? '#12101e' : unlocked ? '#0b0f1c' : '#080a10',
                  border: `1px solid ${isActive ? DANGER_COLOR[loc.danger] : unlocked ? '#2a2a3a' : '#151520'}`,
                  borderRadius:8, padding:'8px 12px',
                  cursor: unlocked ? 'pointer' : 'not-allowed',
                  color: unlocked ? '#c4a882' : '#2a2a3a',
                  minWidth:112, textAlign:'center',
                  boxShadow: isActive ? `0 0 16px ${DANGER_COLOR[loc.danger]}44` : 'none',
                  filter: unlocked ? 'none' : 'grayscale(1)',
                }}>
                {unlocked ? (
                  <>
                    <div style={{ fontSize:10, color:DANGER_COLOR[loc.danger], marginBottom:2, letterSpacing:1 }}>
                      {'▲'.repeat(loc.danger)} {DANGER_LABEL[loc.danger]}
                    </div>
                    <div style={{ fontSize:11, fontWeight:'bold', color:'#e8d5b0' }}>{loc.name}</div>
                    <div style={{ fontSize:9, color:'#4a5a4a', marginTop:2 }}>{loc.desc}</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize:14, marginBottom:3 }}>🔒</div>
                    <div style={{ fontSize:10, color:'#2a2a3a' }}>Unknown</div>
                    <div style={{ fontSize:9, color:'#1a1a2a', marginTop:2 }}>Complete prior area</div>
                  </>
                )}
              </button>

              {/* Action panel — flips above/below based on map position */}
              {isActive && (
                <div style={{
                  position:'absolute',
                  ...(popupAbove
                    ? { bottom:'calc(100% + 10px)', top:'auto' }
                    : { top:'calc(100% + 10px)', bottom:'auto' }),
                  left:'50%', transform:'translateX(-50%)',
                  background:'#0b0f1c',
                  border:`1px solid ${DANGER_COLOR[loc.danger]}`,
                  borderRadius:8, padding:'11px 14px',
                  whiteSpace:'nowrap', zIndex:30,
                  boxShadow:`0 4px 24px ${DANGER_COLOR[loc.danger]}44`,
                  minWidth:190,
                }}>
                  <div style={{ fontSize:10, color:'#4a5a4a', marginBottom:9, textAlign:'center' }}>
                    Loot: <span style={{ color:'#c4a882' }}>{loc.lq}</span>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => { startMission(loc,'scavenge'); setActive(null); }} style={{
                      background:'#0a1a0a', border:'1px solid #3a6a3a', borderRadius:5,
                      padding:'7px 12px', color:'#5a9a5a', cursor:'pointer', fontSize:11, flex:1,
                    }}>
                      🤫 Scavenge
                    </button>
                    <button onClick={() => { startMission(loc,'raid'); setActive(null); }} style={{
                      background:'#1a0a0a', border:'1px solid #6a3a3a', borderRadius:5,
                      padding:'7px 12px', color:'#9a5a5a', cursor:'pointer', fontSize:11, flex:1,
                    }}>
                      ⚔️ Raid
                    </button>
                  </div>
                  <div style={{ fontSize:9, color:'#2a3a2a', marginTop:8, textAlign:'center' }}>
                    Scavenge: quiet · containers only<br/>
                    Raid: +50% XP · reinforcements every 10t
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Legend */}
        <div style={{ position:'absolute', bottom:10, left:12, fontSize:9, color:'#2a3a3a', pointerEvents:'none' }}>
          ▲ Low &nbsp;▲▲ Medium &nbsp;▲▲▲ High
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%,100% { opacity:.3; transform:scale(.9); }
          50%      { opacity:.6; transform:scale(1.1); }
        }
      `}</style>
    </div>
  );
}
