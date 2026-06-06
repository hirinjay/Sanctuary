import { useGameStore } from '../../store/gameStore';

export default function LevelUpModal() {
  const { luq, ms, applyLu } = useGameStore();
  if (!luq.length) return null;

  const { uid, opts } = luq[0];
  const u = ms?.units.find(x => x.id === uid);
  const dmgCap = u?.isTinker ? 2 : 1;
  const filteredOpts = opts.filter(o => o.id !== 'dmg' || (u?.dmgUpgrades||0) < dmgCap);

  return (
    <div style={{ position:'fixed', inset:0, background:'#000d', display:'flex',
      flexDirection:'column', alignItems:'center', justifyContent:'center',
      textAlign:'center', zIndex:50, fontFamily:'Georgia,serif', color:'#c4a882' }}>
      <div style={{ fontSize:32, marginBottom:8 }}>⬆️</div>
      <h2 style={{ color:'#e8d5b0', marginBottom:5, fontSize:20 }}>Level Up!</h2>
      <p style={{ color:'#7a7a5a', marginBottom:20, fontSize:12 }}>
        {u?.name} — Lv{u?.level}. Choose:
      </p>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center' }}>
        {filteredOpts.map(o => (
          <button key={o.id} onClick={() => applyLu(o.id)} style={{
            background:'#0b0f1c', border:'1px solid #2a2a4a', borderRadius:7,
            padding:'12px 15px', color:'#c4a882', cursor:'pointer', width:130, textAlign:'center',
          }}>
            <div style={{ fontWeight:'bold', fontSize:12 }}>{o.label}</div>
            <div style={{ fontSize:10, color:'#4a5a4a', marginTop:4 }}>{o.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
