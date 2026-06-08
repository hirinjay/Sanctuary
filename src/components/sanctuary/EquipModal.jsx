import { useGameStore } from '../../store/gameStore';
import { item } from '../../data/items';

export default function EquipModal() {
  const { vp, roster, inv, equipTgt, setEquipTgt, equipItem } = useGameStore();

  if (!equipTgt) return null;

  const tgtName = equipTgt === 'varek'
    ? 'Varek'
    : roster.find(u => u.id === equipTgt)?.name || '?';

  const equippable = Object.entries(inv).filter(([id]) => {
    const it = item(id);
    return it?.type === 'weapon' || it?.type === 'armor';
  });

  function holderNames(iid) {
    const h = [];
    if (vp.weapon===iid || vp.armor===iid) h.push('Varek');
    roster.forEach(u => { if (u.weapon===iid || u.armor===iid) h.push(u.pname||u.name); });
    return h;
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'#000c',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:99 }}>
      <div style={{ background:'#0b0f1c', border:'1px solid #2a2a4a', borderRadius:10,
        padding:20, width:320, maxHeight:'75vh', overflowY:'auto' }}>
        <div style={{ fontWeight:'bold', color:'#e8d5b0', marginBottom:13 }}>
          Equip — {tgtName}
        </div>
        {equippable.length === 0 && (
          <div style={{ color:'#3a3a4a', fontSize:12 }}>No equippable items.</div>
        )}
        {equippable.map(([id]) => {
          const it = item(id);
          if (!it) return null;
          const slot = it.type === 'weapon' ? 'weapon' : 'armor';
          const holders = holderNames(id);
          return (
            <div key={id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, gap:8 }}>
              <div>
                <div style={{ fontSize:12 }}>
                  {it.emoji} {it.name} <span style={{ color:'#4a7a4a', fontSize:10 }}>{it.desc}</span>
                </div>
                {holders.length > 0 && (
                  <div style={{ fontSize:10, color:'#7a6a3a', marginTop:2 }}>
                    Equipped: {holders.join(', ')}
                  </div>
                )}
              </div>
              <button onClick={() => equipItem(equipTgt, id, slot)} style={{
                background:'#0a1a0a', border:'1px solid #3a6a3a', borderRadius:4,
                padding:'4px 9px', color:'#5a9a5a', cursor:'pointer', fontSize:10, flexShrink:0,
              }}>
                Equip
              </button>
            </div>
          );
        })}
        <button onClick={() => setEquipTgt(null)} style={{
          marginTop:10, width:'100%', background:'#140a0a', border:'1px solid #4a2a2a',
          borderRadius:5, padding:'7px 0', color:'#7a4a4a', cursor:'pointer', fontSize:11,
        }}>
          Close
        </button>
      </div>
    </div>
  );
}
