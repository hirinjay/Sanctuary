import { Component } from 'react';
import { useGameStore } from '../../store/gameStore';

class Boundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error:null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[screen]', error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error:null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return this.props.fallback(this.state.error);
  }
}

export default function ScreenErrorBoundary({ resetKey, children }) {
  const recoverHome = () => {
    useGameStore.setState({ screen:'home', ms:null, luq:[], missionResult:null, worldPath:[] });
  };

  return (
    <Boundary resetKey={resetKey} fallback={(error) => (
      <div style={{ background:'#040810', minHeight:'100vh', fontFamily:'Georgia,serif', color:'#c4a882',
        display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center', padding:20 }}>
        <div style={{ maxWidth:420, background:'#06090f', border:'1px solid #4a2222', borderRadius:8, padding:'24px 22px' }}>
          <h2 style={{ color:'#d08a8a', margin:'0 0 8px', fontSize:20 }}>Screen Failed</h2>
          <p style={{ color:'#7a6a6a', fontSize:12, lineHeight:1.6, margin:'0 0 16px' }}>
            The current screen hit a render error. Your save state is still available from the home screen.
          </p>
          <pre style={{ whiteSpace:'pre-wrap', textAlign:'left', color:'#6a5555', fontSize:10, maxHeight:120, overflow:'auto' }}>
            {error?.message ?? String(error)}
          </pre>
          <button onClick={recoverHome} style={{ marginTop:16, background:'#0a141e', border:'1px solid #3a5a8a', borderRadius:5,
            padding:'9px 18px', color:'#7aa0c8', cursor:'pointer', fontSize:12 }}>
            Return Home
          </button>
        </div>
      </div>
    )}>
      {children}
    </Boundary>
  );
}
