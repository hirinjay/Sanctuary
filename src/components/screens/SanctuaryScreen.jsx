import { useGameStore } from '../../store/gameStore';
import { item, RECIPES, ITEMS } from '../../data/items';
import { xpNext } from '../../systems/combat';
import EquipModal from '../sanctuary/EquipModal';

const NODES_DEF = [
  { id:'farm',   name:'Farm Plot', emoji:'🌱', cost:{ cloth:2, bone:1 },          builtDesc:'Yields 2 🥩 food on return' },
  { id:'quarry', name:'Quarry',    emoji:'⛏',  cost:{ scrap_iron:2 },              builtDesc:'Yields 2 🔩 scrap iron on return' },
  { id:'forge',  name:'Forge',     emoji:'🔥', cost:{ scrap_iron:3, bone:2 },      builtDesc:'Craft weapons & armor' },
];

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
  const { vp, roster, inv, nodes, setScreen, setEquipTgt, setRoster, setInv, setNodes, addLog, ti } = useGameStore();
  const set = useGameStore.setState;
  const t = ti(null);

  function setRost(fn) { set(s => ({ roster: fn(s.roster) })); }
  function setI(fn) { set(s => ({ inv: fn(s.inv) })); }
  function setN(fn) { set(s => ({ nodes: fn(s.nodes) })); }

  return (
    <div style={pg}>
      <div style={{ maxWidth:480, margin:'0 auto' }}>
        <h2 style={{ color:'#e8d5b0', margin:'0 0 3px', fontSize:16, letterSpacing:2 }}>⌂ SANCTUARY</h2>
        <p style={{ color:'#2a3a2a', fontSize:11, marginBottom:13 }}>Home. Such as it is.</p>

        {/* Varek */}
        <div style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ fontWeight:'bold', color:'#e8d5b0' }}>🧙 Varek Lv{vp.level}</span>
            <span style={{ fontSize:10, color:'#4a5a4a' }}>XP {vp.xp}/{xpNext(vp.level)}</span>
          </div>
          <div style={{ fontSize:11, color:'#7a7a5a', marginBottom:8, display:'flex', gap:10, flexWrap:'wrap' }}>
            <span>❤️ {vp.hp}/{vp.maxHp}</span>
            <span style={{ color:t.free>0?'#5a8a5a':'#8a3a3a' }}>⛓ {t.used}/{t.cap}</span>
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
                  <button
                    onClick={() => setRost(r => r.map(r2 => r2.id===u.id ? { ...r2, atBase:!r2.atBase } : r2))}
                    style={btn(true, u.atBase ? '#8a6a3a' : '#3a6a3a')}>
                    {u.atBase ? '🏠 Base' : '⚔️ Mission'}
                  </button>
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
        </div>

        {/* Resource Nodes */}
        <div style={card}>
          <div style={{ fontWeight:'bold', color:'#c4a882', marginBottom:8, fontSize:12 }}>🌐 Resource Nodes</div>
          {NODES_DEF.map(n => {
            const built  = nodes.includes(n.id);
            const afford = Object.entries(n.cost).every(([id, a]) => (inv[id]||0) >= a);
            return (
              <div key={n.id} style={{ padding:'7px 0', borderBottom:'1px solid #0f1220' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:11 }}>
                  <span style={{ color:built?'#c4a882':'#6a6a5a' }}>
                    {n.emoji} {n.name}
                    {built && <span style={{ color:'#3a6a3a', fontSize:10 }}> — {n.builtDesc}</span>}
                  </span>
                  {!built && (
                    <button disabled={!afford} onClick={() => {
                      if (!afford) return;
                      const ni = { ...inv };
                      Object.entries(n.cost).forEach(([id, a]) => { ni[id]=(ni[id]||0)-a; if(!ni[id])delete ni[id]; });
                      set(s => ({
                        inv: ni, nodes:[...s.nodes, n.id],
                        log:[`Built ${n.name}!`,...s.log].slice(0,14),
                      }));
                    }} style={btn(afford,'#5a8a5a')}>
                      Build ({Object.entries(n.cost).map(([id,a]) => `${a}${item(id)?.emoji||''}`).join(' ')})
                    </button>
                  )}
                </div>
                {/* Forge craft panel */}
                {built && n.id==='forge' && (
                  <div style={{ marginTop:8 }}>
                    <div style={{ fontSize:10, color:'#4a5a4a', marginBottom:5 }}>Craft:</div>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {RECIPES.map(r => {
                        const can = Object.entries(r.cost).every(([id,a]) => (inv[id]||0)>=a);
                        return (
                          <button key={r.id} disabled={!can} onClick={() => {
                            if (!can) return;
                            const ni = { ...inv };
                            Object.entries(r.cost).forEach(([id,a]) => { ni[id]=(ni[id]||0)-a; if(!ni[id])delete ni[id]; });
                            ni[r.id] = (ni[r.id]||0)+1;
                            set(s => ({ inv:ni, log:[`Crafted ${r.name}!`,...s.log].slice(0,14) }));
                          }} style={{ ...btn(can,'#8a6a3a'), fontSize:10 }}>
                            {r.emoji} {r.name} ({Object.entries(r.cost).map(([id,a])=>`${a}${item(id)?.emoji||''}`).join(' ')})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={() => setScreen('world')} style={{
          ...btn(true,'#6a6aaa'), width:'100%', padding:12, fontSize:12,
        }}>
          ⬡ World Map
        </button>
      </div>

      <EquipModal />
    </div>
  );
}
