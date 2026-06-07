import { useGameStore } from '../../store/gameStore';
import { item } from '../../data/items';
import { xpNext } from '../../systems/combat';
import EquipModal from '../sanctuary/EquipModal';

const pg = { background:'#040810', minHeight:'100vh', fontFamily:'Georgia,serif', color:'#c4a882', padding:14 };
const card = { background:'#090e1a', border:'1px solid #1a1a2a', borderRadius:8, padding:13, marginBottom:11 };

function btn(on, c) {
  return {
    background: on ? `${c}18` : '#0b0f1c',
    border: `1px solid ${on ? c : '#222233'}`,
    borderRadius:5, padding:'5px 10px',
    color: on ? c : '#5a5a6a',
    cursor: on ? 'pointer' : 'default', fontSize:11,
  };
}

export default function SanctuaryScreen() {
  const { vp, roster, inv, travelBag, sanctuaryPos,
          setScreen, setEquipTgt, ti, depositLoot } = useGameStore();
  const set = useGameStore.setState;
  const t = ti(null);
  const baseCount  = t.baseCount;
  const fieldCount = t.fieldCount;
  const established = !!sanctuaryPos;

  function setRost(fn) { set(s => ({ roster: fn(s.roster) })); }

  const bagCount = Object.values(travelBag||{}).reduce((a,b)=>a+b,0);

  return (
    <div style={pg}>
      <div style={{ maxWidth:480, margin:'0 auto' }}>
        <h2 style={{ color:'#e8d5b0', margin:'0 0 3px', fontSize:16, letterSpacing:2 }}>⌂ SANCTUARY</h2>
        <p style={{ color:'#2a3a2a', fontSize:11, marginBottom:13 }}>
          {established ? 'Home. Such as it is.' : 'Sanctuary not yet established.'}
        </p>

        {/* Undeposited loot warning */}
        {bagCount > 0 && (
          <div style={{ ...card, borderColor:'#4a3a1a', background:'#120e06' }}>
            <div style={{ fontWeight:'bold', color:'#c4a882', marginBottom:6, fontSize:12 }}>
              🎒 Travel Bag ({bagCount} item{bagCount!==1?'s':''})
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
              {Object.entries(travelBag).map(([id,cnt]) => {
                const it = item(id); return it ? (
                  <div key={id} style={{ background:'#1a1206', borderRadius:4, padding:'3px 8px', fontSize:11 }}>
                    {it.emoji} {it.name} ×{cnt}
                  </div>
                ) : null;
              })}
            </div>
            {established ? (
              <button onClick={depositLoot} style={btn(true,'#7a6a3a')}>
                📥 Deposit into Sanctuary
              </button>
            ) : (
              <div style={{ fontSize:10, color:'#5a4a2a' }}>
                ⚠ Establish Sanctuary on the world map to deposit supplies.
              </div>
            )}
          </div>
        )}

        {/* Varek */}
        <div style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ fontWeight:'bold', color:'#e8d5b0' }}>🧙 Varek Lv{vp.level}</span>
            <span style={{ fontSize:10, color:'#4a5a4a' }}>XP {vp.xp}/{xpNext(vp.level)}</span>
          </div>
          <div style={{ fontSize:11, color:'#7a7a5a', marginBottom:8, display:'flex', gap:10, flexWrap:'wrap' }}>
            <span>❤️ {vp.hp}/{vp.maxHp}</span>
            <span style={{ color:baseCount<t.baseCap?'#5a8a5a':'#8a3a3a' }}
              title="Base slots used/cap">⌂ {baseCount}/{t.baseCap}</span>
            <span style={{ color:fieldCount<t.fieldCap?'#5a8a5a':'#8a3a3a' }}
              title="Field slots used/cap">⛓ {fieldCount}/{t.fieldCap}</span>
            <span>🪄 {vp.raiseRange}</span>
            <span>🧿 {vp.drainRange}</span>
          </div>
          <div style={{ fontSize:11, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ color:'#5a6a7a' }}>⚔️ {vp.weapon ? item(vp.weapon)?.name : 'Unarmed'}</span>
            <span style={{ color:'#5a6a7a' }}>🛡 {vp.armor ? item(vp.armor)?.name : 'None'}</span>
            <button onClick={() => setEquipTgt('varek')} style={btn(true,'#6a6aaa')}>Equip</button>
          </div>
        </div>

        {/* Roster */}
        {roster.length > 0 && (
          <div style={card}>
            <div style={{ fontWeight:'bold', color:'#c4a882', marginBottom:8, fontSize:12 }}>
              💀 Undead Roster ({roster.length}/{t.cap})
            </div>
            {roster.map(u => (
              <div key={u.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'5px 0', borderBottom:'1px solid #0f1220', fontSize:11 }}>
                <div>
                  {u.emoji} {u.name}
                  <span style={{ color:'#4a5a4a' }}> Lv{u.level} ❤️{u.hp}/{u.maxHp} ⚔️{u.dmg}</span>
                </div>
                <div style={{ display:'flex', gap:5 }}>
                  <button onClick={() => setEquipTgt(u.id)} style={btn(true,'#6a6aaa')}>Equip</button>
                  {(() => {
                    const canSendToBase  = !u.atBase  && baseCount  < t.baseCap;
                    const canSendToField = u.atBase   && fieldCount < t.fieldCap;
                    const canToggle      = established && (u.atBase ? canSendToField : canSendToBase);
                    const title = !established ? 'Establish Sanctuary first'
                      : (!u.atBase && !canSendToBase)  ? `Base full (${t.baseCap})`
                      : (u.atBase  && !canSendToField) ? `Field full (${t.fieldCap})`
                      : undefined;
                    return (
                      <button disabled={!canToggle} title={title}
                        onClick={() => canToggle && setRost(r => r.map(r2 => r2.id===u.id ? { ...r2, atBase:!r2.atBase } : r2))}
                        style={btn(canToggle, u.atBase ? '#8a6a3a' : '#3a6a3a')}>
                        {u.atBase ? '🏠 Base' : '⚔️ Mission'}
                      </button>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Inventory */}
        <div style={card}>
          <div style={{ fontWeight:'bold', color:'#c4a882', marginBottom:8, fontSize:12 }}>📦 Inventory</div>
          {Object.keys(inv).length === 0
            ? <div style={{ color:'#2a2a3a', fontSize:12 }}>Empty.</div>
            : <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                {Object.entries(inv).map(([id, cnt]) => {
                  const it = item(id);
                  return it ? (
                    <div key={id} style={{ background:'#0f1320', borderRadius:4, padding:'3px 8px', fontSize:11 }}>
                      {it.emoji} {it.name} ×{cnt}
                    </div>
                  ) : null;
                })}
              </div>
          }
        </div>

        {/* Healing */}
        <div style={card}>
          <div style={{ fontWeight:'bold', color:'#c4a882', marginBottom:7, fontSize:12 }}>🩹 Rest & Recover</div>
          {!established ? (
            <div style={{ fontSize:11, color:'#3a3a2a' }}>Establish Sanctuary to rest and recover.</div>
          ) : (
          <>
          <div style={{ fontSize:10, color:'#3a4a3a', marginBottom:8 }}>
            🥩 Dried Food heals Varek +1hp · 🦴 Bone heals undead +2hp
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            {(() => {
              const full = vp.hp >= vp.maxHp;
              const has  = (inv.food||0) >= 1;
              return (
                <button disabled={full||!has} onClick={() => {
                  if (full||!has) return;
                  set(s => ({
                    inv: { ...s.inv, food:s.inv.food-1 },
                    vp:  { ...s.vp, hp:Math.min(s.vp.maxHp, s.vp.hp+1) },
                    log: [`Varek eats — +1hp. (${(s.inv.food||0)-1} food left)`, ...s.log].slice(0,14),
                  }));
                }} style={btn(!full&&has,'#5a8a5a')}>
                  🧙 Varek {vp.hp}/{vp.maxHp}{full ? ' ✓' : ` (🥩${inv.food||0})`}
                </button>
              );
            })()}
            {roster.map(u => {
              const full = u.hp >= u.maxHp;
              const has  = (inv.bone||0) >= 1;
              return (
                <button key={u.id} disabled={full||!has} onClick={() => {
                  if (full||!has) return;
                  set(s => ({
                    inv:    { ...s.inv, bone:s.inv.bone-1 },
                    roster: s.roster.map(r => r.id===u.id ? { ...r, hp:Math.min(r.maxHp, r.hp+2) } : r),
                    log:    [`${u.name} knits bone — +2hp. (${(s.inv.bone||0)-1} bone left)`, ...s.log].slice(0,14),
                  }));
                }} style={btn(!full&&has,'#5a8a5a')}>
                  {u.emoji} {u.name.split(' ')[0]} {u.hp}/{u.maxHp}{full ? ' ✓' : ` (🦴${inv.bone||0})`}
                </button>
              );
            })}
            {roster.length === 0 && <span style={{ fontSize:10, color:'#2a3a2a' }}>No undead in roster.</span>}
          </div>
          </>)}
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setScreen('world')} style={{
            ...btn(true,'#6a6aaa'), flex:1, padding:12, fontSize:12,
          }}>
            ⬡ World Map
          </button>
          <button onClick={() => setScreen('sanctuarymap')} style={{
            ...btn(true,'#4a8a4a'), flex:1, padding:12, fontSize:12,
          }}>
            🗺 View Map
          </button>
          <button onClick={() => setScreen('home')} style={{
            ...btn(true,'#4a4a6a'), padding:'12px 18px', fontSize:12,
          }}>
            🏚 Home
          </button>
        </div>
      </div>

      <EquipModal />
    </div>
  );
}
