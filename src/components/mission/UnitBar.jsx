export default function UnitBar({ units, sel, onSelect }) {
  const friendly = units.filter(u => u.type !== 'enemy');
  return (
    <div style={{ display:'flex', gap:5, flexWrap:'wrap', maxWidth:510, margin:'0 auto 5px' }}>
      {friendly.map(u => (
        <div key={u.id}
          onClick={() => onSelect(u)}
          style={{
            background: sel===u.id ? '#0f2a0f' : '#080d18',
            border: `1px solid ${sel===u.id ? '#2a5a2a' : '#1a1a2a'}`,
            borderRadius:4, padding:'4px 7px',
            cursor: u.fallen ? 'default' : 'pointer',
            opacity: u.fallen ? .3 : 1, fontSize:10,
          }}>
          {u.emoji}{' '}
          <span style={{ color:'#d0c0a0' }}>{u.name}</span>
          <span style={{ color:'#4a5a4a', marginLeft:4 }}>{u.hp}/{u.maxHp}</span>
          <span style={{ color:u.movementPoints>0?'#3a7a3a':'#3a2a2a', marginLeft:4 }}>👟{u.movementPoints>0?1:0}</span>
          <span style={{ color:u.actionPoints>0?'#3a7a3a':'#3a2a2a', marginLeft:2 }}>⚔{u.actionPoints>0?1:0}</span>
          {u.fallen && <span style={{ color:'#7a2a2a', marginLeft:4 }}>fallen</span>}
        </div>
      ))}
    </div>
  );
}
