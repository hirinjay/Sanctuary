import { useGameStore } from '../../store/gameStore';

export default function GameOverScreen() {
  const resetGame = useGameStore(s => s.resetGame);
  return (
    <div style={{ background:'#040810', minHeight:'100vh', fontFamily:'Georgia,serif', color:'#c4a882',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center' }}>
      <div style={{ fontSize:48, marginBottom:12 }}>💀</div>
      <h2 style={{ color:'#7a2a2a', fontSize:26, letterSpacing:4, margin:'0 0 10px' }}>VAREK FALLS</h2>
      <p style={{ color:'#4a4a4a', marginBottom:28, fontSize:13 }}>
        The tether breaks. Sanctuary remains a dream.
      </p>
      <button onClick={resetGame} style={{
        background:'#0b0f1c', border:'1px solid #c4a882', borderRadius:5,
        padding:'8px 18px', color:'#c4a882', cursor:'pointer', fontSize:12,
      }}>
        Begin Again
      </button>
    </div>
  );
}
