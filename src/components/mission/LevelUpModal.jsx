import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { CLASSES, getAvailablePromotions } from '../../data/classes';
import { defenseTypeFor } from '../../systems/combat';
import { ABILITIES } from '../../data/abilities';

export default function LevelUpModal() {
  const luq = useGameStore(s => s.luq ?? []);
  const ms = useGameStore(s => s.ms);
  const roster = useGameStore(s => s.roster ?? []);
  const vp = useGameStore(s => s.vp);
  const book = useGameStore(s => s.book);
  const applyLu = useGameStore(s => s.applyLu);
  const applyPromotionFromLu = useGameStore(s => s.applyPromotionFromLu);
  const dismissLevelUp = useGameStore(s => s.dismissLevelUp);
  const [selClassId, setSelClassId] = useState(null);

  if (!luq.length) return null;

  const { uid, opts, type } = luq[0];
  const varekUnit = uid === 'varek' ? { ...vp, id:'varek', type:'varek', name:'Varek', emoji:'🧙' } : null;
  const u = ms?.units?.find(x => x.id === uid) ?? roster.find(x => x.id === uid) ?? varekUnit;

  const overlay = {
    position:'fixed', inset:0, background:'#000d', display:'flex',
    flexDirection:'column', alignItems:'center', justifyContent:'center',
    textAlign:'center', zIndex:50, fontFamily:'Georgia,serif', color:'#c4a882', padding:16,
  };
  const panel = {
    background:'#06090f', border:'1px solid #2a2a4a', borderRadius:10,
    padding:'22px 20px', maxWidth:'94vw', boxShadow:'0 12px 40px #000a',
  };
  const recoverButton = (label = 'Continue') => (
    <button onClick={dismissLevelUp} style={{
      marginTop:16, background:'#0a141e', border:'1px solid #3a5a8a', borderRadius:5,
      padding:'9px 18px', color:'#7aa0c8', cursor:'pointer', fontSize:12,
    }}>{label}</button>
  );

  if (!u) {
    return (
      <div style={overlay}>
        <div style={panel}>
          <h2 style={{ color:'#e8d5b0', margin:'0 0 8px', fontSize:18 }}>Level Up Interrupted</h2>
          <p style={{ color:'#7a7a5a', margin:0, fontSize:12 }}>This level-up entry no longer matches a unit in the encounter.</p>
          {recoverButton()}
        </div>
      </div>
    );
  }

  // ── Class promotion at level 2 ─────────────────────────────────────────
  if (type === 'class_promotion') {
    const bookId = book?.id ?? 'pale';
    const classes = getAvailablePromotions(u ?? {}, bookId);

    if (!selClassId) {
      return (
        <div style={overlay}>
          <div style={panel}>
          <div style={{ fontSize:32, marginBottom:8 }}>⬆️</div>
          <h2 style={{ color:'#e8d5b0', marginBottom:4, fontSize:20 }}>Choose a Class</h2>
          <p style={{ color:'#7a7a5a', marginBottom:16, fontSize:12 }}>
            {u?.name ?? '...'} reached level 2. Choose a path.
          </p>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center', maxWidth:460 }}>
            {classes.map(cls => (
              <button key={cls.id} onClick={() => setSelClassId(cls.id)} style={{
                background:'#0b0f1c', border:'1px solid #2a2a4a', borderRadius:7,
                padding:'14px 16px', color:'#c4a882', cursor:'pointer', width:190, textAlign:'left',
              }}>
                <div style={{ fontSize:22, marginBottom:4 }}>{cls.emoji}</div>
                <div style={{ fontWeight:'bold', fontSize:13, color:'#e8d5b0', marginBottom:3 }}>{cls.name}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 8px', fontSize:10, color:'#4a6a5a', marginBottom:8 }}>
                  <span>❤️ {cls.stats.hp}</span>
                  <span>⚔️ {cls.stats.dmg}</span>
                  <span>🛡 {cls.stats.def}</span>
                  <span>👟 {cls.stats.move}</span>
                  {(cls.stats.range ?? 1) > 1 && <span>🏹 rng {cls.stats.range}</span>}
                </div>
                <div style={{ fontSize:9, color:'#3a4a3a' }}>
                  {cls.abilityChoice?.map(aid => ABILITIES[aid]?.name).filter(Boolean).join(' / ')}
                </div>
              </button>
            ))}
            {classes.length === 0 && (
              <div style={{ color:'#5a3a3a', fontSize:12 }}>No classes unlocked for this unit type.</div>
            )}
          </div>
          {classes.length === 0 && recoverButton()}
          </div>
        </div>
      );
    }

    const cls = CLASSES[selClassId];
    return (
      <div style={overlay}>
        <div style={panel}>
        <div style={{ fontSize:28, marginBottom:6 }}>{cls?.emoji}</div>
        <h2 style={{ color:'#e8d5b0', marginBottom:4, fontSize:18 }}>{cls?.name}</h2>
        <p style={{ color:'#7a7a5a', marginBottom:16, fontSize:12 }}>Choose a class ability:</p>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center' }}>
          {(cls?.abilityChoice ?? []).map(aid => {
            const ab = ABILITIES[aid];
            if (!ab) return null;
            const c = ab.type === 'active' ? '#3a6a9a' : ab.type === 'reactive' ? '#8a6a2a' : '#3a7a3a';
            return (
              <button key={aid} onClick={() => { applyPromotionFromLu(uid, selClassId, aid); setSelClassId(null); }} style={{
                background:'#0b0f1c', border:`1px solid ${c}44`, borderRadius:7,
                padding:'12px 15px', color:'#c4a882', cursor:'pointer', width:160, textAlign:'center',
              }}>
                <div style={{ fontSize:10, color:c, marginBottom:3, textTransform:'uppercase', letterSpacing:0.5 }}>{ab.type}</div>
                <div style={{ fontWeight:'bold', fontSize:12, color:'#e8d5b0', marginBottom:4 }}>{ab.name}</div>
                <div style={{ fontSize:10, color:'#4a5a4a' }}>{ab.desc}</div>
              </button>
            );
          })}
        </div>
        {(cls?.abilityChoice ?? []).length === 0 && recoverButton()}
        <button onClick={() => setSelClassId(null)} style={{
          marginTop:16, background:'none', border:'1px solid #2a2a3a', borderRadius:4,
          padding:'5px 12px', color:'#4a4a5a', cursor:'pointer', fontSize:11,
        }}>← Back</button>
        </div>
      </div>
    );
  }

  // ── Normal stat boost ──────────────────────────────────────────────────
  const isVerdantVarek = u?.type === 'varek' && book?.id === 'verdant';
  const dmgCap = u?.isTinker ? 2 : 1;
  const defenseLabels = { dodge:'Dodge', counter:'Counter', defend:'Defend' };
  const filteredOpts = (opts ?? []).filter(o => {
    if (o.id === 'evasion') return (u?.evasionBonus||0) < 5;
    if (o.id !== 'dmg') return true;
    if (isVerdantVarek) return (u?.dmg || 2) < 6;
    return (u?.dmgUpgrades||0) < dmgCap;
  }).map(o => {
    if (o.id !== 'evasion') return o;
    const dType = defenseTypeFor(u ?? {});
    return { ...o, label:`${defenseLabels[dType]} +3%`, desc:`Improve your ${dType} chance (cap 35%)` };
  });

  return (
    <div style={overlay}>
      <div style={panel}>
      <div style={{ fontSize:32, marginBottom:8 }}>⬆️</div>
      <h2 style={{ color:'#e8d5b0', marginBottom:5, fontSize:20 }}>Level Up!</h2>
      <p style={{ color:'#7a7a5a', marginBottom:8, fontSize:12 }}>
        {u?.name ?? '...'} — Lv{u?.level}. Choose:
      </p>
      {u?.type === 'varek' && (
        <p style={{ color:'#4a5a4a', marginBottom:16, fontSize:10 }}>
          +1 Tether is automatic this level. Choose an additional bonus:
        </p>
      )}
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
      {filteredOpts.length === 0 && recoverButton()}
      </div>
    </div>
  );
}
