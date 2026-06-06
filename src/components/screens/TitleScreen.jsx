import { BOOKS } from '../../data/books';
import { DEFAULT_VP } from '../../data/constants';
import { useGameStore } from '../../store/gameStore';

export default function TitleScreen() {
  const { setScreen, setBook: _setBook, setVp: _setVp } = useGameStore();
  const set = useGameStore.setState;

  function chooseBook(b) {
    set({ book:b, vp:{ ...DEFAULT_VP, ...b.ap, xp:0, level:1, weapon:null, armor:null }, screen:'overworld' });
  }

  return (
    <div style={{ background:'#040810', minHeight:'100vh', fontFamily:'Georgia,serif', color:'#c4a882',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:20 }}>
      <div style={{ fontSize:52, marginBottom:8 }}>🏚</div>
      <h1 style={{ fontSize:30, color:'#e8d5b0', letterSpacing:6, margin:'0 0 4px', textTransform:'uppercase' }}>
        Sanctuary
      </h1>
      <p style={{ color:'#3a4a3a', fontSize:11, letterSpacing:3, marginBottom:20 }}>
        A Necromancer's Burden
      </p>
      <p style={{ maxWidth:380, lineHeight:1.8, fontSize:13, color:'#9a8a6a', marginBottom:28 }}>
        You are Varek. Escaped with nothing but a stolen book and hollow memories.
        Build Sanctuary. Raise the fallen.
      </p>
      <p style={{ fontSize:11, color:'#4a5a4a', marginBottom:16 }}>Choose your grimoire:</p>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center' }}>
        {BOOKS.map(b => (
          <button key={b.id} onClick={() => chooseBook(b)} style={{
            background:'#0b0f1c', border:'1px solid #2a2540', borderRadius:8,
            padding:'13px 14px', color:'#c4a882', cursor:'pointer', width:140, textAlign:'center',
          }}>
            <div style={{ fontSize:22 }}>{b.emoji}</div>
            <div style={{ fontSize:11, fontWeight:'bold', marginTop:4 }}>{b.name}</div>
            <div style={{ fontSize:10, color:'#5a8a5a', marginTop:3 }}>{b.bonus}</div>
            <div style={{ fontSize:10, color:'#7a4a4a' }}>{b.trade}</div>
            <div style={{ fontSize:10, color:'#4a5a4a', marginTop:4, fontStyle:'italic' }}>{b.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
