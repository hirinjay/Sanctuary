import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { CLASSES, getTier3Class } from '../../data/classes';
import { ABILITIES } from '../../data/abilities';

const overlay = {
  position:'fixed', inset:0, background:'#000e',
  display:'flex', alignItems:'center', justifyContent:'center',
  zIndex:60, fontFamily:'Georgia,serif',
};
const panel = {
  background:'#06090f', border:'1px solid #2a2a4a', borderRadius:10,
  padding:'24px 20px', width:480, maxWidth:'96vw', color:'#c4a882',
};

function ClassCard({ cls, selected, onClick }) {
  const border = selected ? '#c4a882' : '#1e1e3a';
  return (
    <div onClick={onClick} style={{
      flex:1, background: selected ? '#0d1020' : '#08090f',
      border:`1px solid ${border}`, borderRadius:7, padding:'12px 10px',
      cursor:'pointer', textAlign:'center',
      boxShadow: selected ? `0 0 10px 1px #c4a88244` : 'none',
    }}>
      <div style={{ fontSize:26, marginBottom:4 }}>{cls.emoji}</div>
      <div style={{ color:'#e8d5b0', fontWeight:'bold', fontSize:13, marginBottom:6 }}>{cls.name}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 8px', fontSize:9, color:'#4a6a5a', marginBottom:6 }}>
        <span>❤️ {cls.stats.hp}</span>
        <span>⚔️ {cls.stats.dmg}</span>
        <span>🛡️ {cls.stats.def}</span>
        <span>👟 {cls.stats.move}</span>
        {cls.stats.range > 1 && <span>🎯 {cls.stats.range}</span>}
        {cls.tether !== 1 && <span>⛓ ×{cls.tether}</span>}
      </div>
      {cls.immunities?.length > 0 && (
        <div style={{ fontSize:8, color:'#4a5a3a', marginBottom:4 }}>
          Immune: {cls.immunities.join(', ')}
        </div>
      )}
      {cls.note && (
        <div style={{ fontSize:8, color:'#7a6a3a', marginBottom:4, textAlign:'left' }}>{cls.note}</div>
      )}
    </div>
  );
}

function AbilityCard({ abilityId, selected, onClick }) {
  const ab = ABILITIES[abilityId];
  if (!ab) return null;
  const typeColor = ab.type === 'active' ? '#3a6a9a' : ab.type === 'reactive' ? '#8a6a2a' : '#3a7a3a';
  const border = selected ? '#c4a882' : '#1e1e3a';
  return (
    <div onClick={onClick} style={{
      flex:1, background: selected ? '#0d1020' : '#08090f',
      border:`1px solid ${border}`, borderRadius:7, padding:'12px 10px',
      cursor:'pointer', textAlign:'center',
      boxShadow: selected ? `0 0 10px 1px #c4a88244` : 'none',
    }}>
      <div style={{
        display:'inline-block', fontSize:8, color:typeColor,
        border:`1px solid ${typeColor}44`, borderRadius:3, padding:'1px 5px',
        marginBottom:5, textTransform:'uppercase', letterSpacing:1,
      }}>{ab.type}</div>
      <div style={{ color:'#e8d5b0', fontWeight:'bold', fontSize:12, marginBottom:5 }}>{ab.name}</div>
      <div style={{ fontSize:10, color:'#4a5a4a', lineHeight:1.5 }}>{ab.desc}</div>
      {ab.usesPerEncounter && (
        <div style={{ fontSize:8, color:'#3a4a3a', marginTop:5 }}>
          {ab.usesPerEncounter}× per encounter
        </div>
      )}
    </div>
  );
}

export default function PromotionModal() {
  const { promotionQueue, applyPromotion, book } = useGameStore();
  const [step, setStep] = useState(1);       // 1 = pick class, 2 = pick ability
  const [chosenClass, setChosenClass] = useState(null);
  const [chosenAbility, setChosenAbility] = useState(null);

  const item = promotionQueue[0];
  if (!item) return null;

  const { unit, level } = item;
  const bookId = book?.id ?? 'pale';

  // ── Tier-3 promotion ─────────────────────────────────────────────────
  if (level === 5) {
    const t3 = getTier3Class(unit.classId);
    if (!t3) return null;

    // TODO: check sanctuaryGrid for Ascension Forge when building system is ready

    return (
      <div style={overlay}>
        <div style={panel}>
          <div style={{ textAlign:'center', marginBottom:14 }}>
            <div style={{ fontSize:28, marginBottom:4 }}>⬆️</div>
            <div style={{ color:'#e8d5b0', fontSize:18, fontWeight:'bold' }}>Ascension</div>
            <div style={{ color:'#4a5a4a', fontSize:11, marginTop:3 }}>
              {unit.name} — Lv{unit.level}
            </div>
          </div>

          <div style={{ textAlign:'center', marginBottom:10 }}>
            <span style={{ fontSize:22 }}>{t3.emoji}</span>
            <span style={{ color:'#e8d5b0', fontSize:15, fontWeight:'bold', marginLeft:8 }}>{t3.name}</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4, fontSize:9, color:'#4a6a5a', textAlign:'center', marginBottom:14 }}>
            <span>❤️ {t3.stats.hp}</span>
            <span>⚔️ {t3.stats.dmg}</span>
            <span>🛡️ {t3.stats.def}</span>
            <span>👟 {t3.stats.move}</span>
          </div>

          <div style={{ fontSize:11, color:'#7a6a3a', textAlign:'center', marginBottom:12 }}>Choose an ability:</div>
          <div style={{ display:'flex', gap:10, marginBottom:16 }}>
            {t3.abilityChoice.map(aid => (
              <AbilityCard key={aid} abilityId={aid}
                selected={chosenAbility === aid}
                onClick={() => setChosenAbility(aid)} />
            ))}
          </div>

          <button
            disabled={!chosenAbility}
            onClick={() => { applyPromotion(unit.id, t3.id, chosenAbility); setChosenAbility(null); }}
            style={{
              width:'100%', padding:'10px 0', borderRadius:6,
              background: chosenAbility ? '#0a1a0a' : '#06090f',
              border:`1px solid ${chosenAbility ? '#4a8a4a' : '#1a1a2a'}`,
              color: chosenAbility ? '#6a9a6a' : '#2a3a2a',
              cursor: chosenAbility ? 'pointer' : 'default', fontSize:13, fontWeight:'bold',
            }}>
            Ascend
          </button>
        </div>
      </div>
    );
  }

  // ── Tier-2 promotion ─────────────────────────────────────────────────
  const availableClasses = Object.values(CLASSES).filter(c =>
    c.tier === 2 &&
    c.baseClass === (unit.baseClass || (unit.dc === 'Skeleton Warrior' ? 'skeleton_warrior' : unit.dc === 'Grave Stalker' ? 'grave_stalker' : 'grave_warden')) &&
    !c.noMissions &&
    c.grimoires.includes(bookId)
  );
  const cls = chosenClass ? CLASSES[chosenClass] : null;

  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={{ textAlign:'center', marginBottom:14 }}>
          <div style={{ fontSize:28, marginBottom:4 }}>⬆️</div>
          <div style={{ color:'#e8d5b0', fontSize:18, fontWeight:'bold' }}>Promotion</div>
          <div style={{ color:'#4a5a4a', fontSize:11, marginTop:3 }}>
            {unit.name} — Lv{unit.level}
          </div>
        </div>

        {step === 1 && (
          <>
            <div style={{ fontSize:11, color:'#7a6a3a', textAlign:'center', marginBottom:10 }}>Choose a class:</div>
            <div style={{ display:'flex', gap:10, marginBottom:16 }}>
              {availableClasses.map(c => (
                <ClassCard key={c.id} cls={c}
                  selected={chosenClass === c.id}
                  onClick={() => { setChosenClass(c.id); setChosenAbility(null); }} />
              ))}
            </div>
            <button
              disabled={!chosenClass}
              onClick={() => chosenClass && setStep(2)}
              style={{
                width:'100%', padding:'10px 0', borderRadius:6,
                background: chosenClass ? '#0a141e' : '#06090f',
                border:`1px solid ${chosenClass ? '#3a5a8a' : '#1a1a2a'}`,
                color: chosenClass ? '#6a8aba' : '#2a3a2a',
                cursor: chosenClass ? 'pointer' : 'default', fontSize:12,
              }}>
              Choose class →
            </button>
          </>
        )}

        {step === 2 && cls && (
          <>
            <div style={{ textAlign:'center', marginBottom:8 }}>
              <span style={{ fontSize:20 }}>{cls.emoji}</span>
              <span style={{ color:'#e8d5b0', fontSize:14, fontWeight:'bold', marginLeft:6 }}>{cls.name}</span>
            </div>
            <div style={{ fontSize:11, color:'#7a6a3a', textAlign:'center', marginBottom:10 }}>Choose an ability:</div>
            <div style={{ display:'flex', gap:10, marginBottom:14 }}>
              {cls.abilityChoice.map(aid => (
                <AbilityCard key={aid} abilityId={aid}
                  selected={chosenAbility === aid}
                  onClick={() => setChosenAbility(aid)} />
              ))}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => { setStep(1); setChosenAbility(null); }} style={{
                flex:1, padding:'10px 0', borderRadius:6,
                background:'#0a080a', border:'1px solid #2a1a2a',
                color:'#5a3a5a', cursor:'pointer', fontSize:11,
              }}>← Back</button>
              <button
                disabled={!chosenAbility}
                onClick={() => {
                  if (!chosenAbility) return;
                  applyPromotion(unit.id, chosenClass, chosenAbility);
                  setStep(1); setChosenClass(null); setChosenAbility(null);
                }}
                style={{
                  flex:2, padding:'10px 0', borderRadius:6,
                  background: chosenAbility ? '#0a1a0a' : '#06090f',
                  border:`1px solid ${chosenAbility ? '#4a8a4a' : '#1a1a2a'}`,
                  color: chosenAbility ? '#6a9a6a' : '#2a3a2a',
                  cursor: chosenAbility ? 'pointer' : 'default', fontSize:13, fontWeight:'bold',
                }}>
                Promote
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
