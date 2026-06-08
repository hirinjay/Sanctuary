import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { ARCHETYPES } from '../../data/archetypes';
import { CLASSES } from '../../data/classes';
import { ABILITIES } from '../../data/abilities';
import { BOSS_PASSIVES, BOSS_ACTIVES, BOSS_CONDITIONALS } from '../../data/bosses';

const pg   = { background:'#040810', minHeight:'100vh', fontFamily:'Georgia,serif', color:'#c4a882', padding:14 };
const card = { background:'#090e1a', border:'1px solid #1a1a2a', borderRadius:8, padding:'10px 12px', marginBottom:8 };

const TAB_ENEMIES  = 'enemies';
const TAB_BOSSES   = 'bosses';
const TAB_UNDEAD   = 'undead';

// Flat enemy entries: one per dc, listing all archetypes that share it
const DC_ENTRIES = [
  { dc:'Skeleton Warrior', emoji:'💀', archetypes: ARCHETYPES.filter(a => a.dc === 'Skeleton Warrior') },
  { dc:'Grave Stalker',    emoji:'🏹', archetypes: ARCHETYPES.filter(a => a.dc === 'Grave Stalker') },
  { dc:'Grave Warden',     emoji:'🛡', archetypes: ARCHETYPES.filter(a => a.dc === 'Grave Warden') },
];

// Boss types collected from bosses.js templates
const BOSS_TYPES = [
  { key:'dungeon_lord',      name:'Dungeon Lord',      emoji:'👑', locType:'dungeon' },
  { key:'skeletal_champion', name:'Skeletal Champion', emoji:'💀', locType:'dungeon' },
  { key:'lich',              name:'Lich',              emoji:'🔮', locType:'dungeon' },
  { key:'raid_captain',      name:'Raid Captain',      emoji:'⚔️',  locType:'camp' },
  { key:'warlord',           name:'Warlord',           emoji:'🪓',  locType:'camp' },
];

function tag(color, label) {
  return (
    <span style={{
      background:`${color}22`, border:`1px solid ${color}44`,
      borderRadius:3, padding:'1px 6px', fontSize:9, color, marginRight:4,
    }}>{label}</span>
  );
}

function AbilityLine({ abilityId }) {
  const ab = ABILITIES[abilityId];
  if (!ab) return null;
  const c = ab.type === 'active' ? '#3a6a9a' : ab.type === 'reactive' ? '#8a6a2a' : '#3a7a3a';
  return (
    <div style={{ fontSize:10, color:'#4a5a4a', marginBottom:2 }}>
      {tag(c, ab.type)} <span style={{ color:'#c4a882' }}>{ab.name}</span>
      {' — '}{ab.desc}
    </div>
  );
}

function EnemyCard({ entry, info }) {
  const encountered = info?.encounters > 0;
  const showAbilities = info?.encounters >= 2;
  const first = entry.archetypes[0];
  return (
    <div style={{ ...card, opacity: encountered ? 1 : 0.4 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
        <span style={{ fontSize:20 }}>{entry.emoji}</span>
        <div>
          <div style={{ color:'#e8d5b0', fontWeight:'bold', fontSize:13 }}>{entry.dc}</div>
          {encountered
            ? <div style={{ fontSize:9, color:'#3a5a3a' }}>Encountered {info.encounters}×</div>
            : <div style={{ fontSize:9, color:'#3a3a3a' }}>Not yet encountered</div>}
        </div>
        {info?.encounters >= 1 && (
          <div style={{ marginLeft:'auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 10px', fontSize:9, color:'#4a6a5a' }}>
            <span>❤️ {first?.hp}</span>
            <span>⚔️ {first?.dmg}</span>
            <span>👟 {first?.move}</span>
            <span>👁 {first?.sight}</span>
          </div>
        )}
      </div>
      {showAbilities && entry.archetypes.map(a => (
        <div key={a.name} style={{ fontSize:10, color:'#4a5a4a', marginBottom:2 }}>
          <span style={{ color:'#7a6a3a' }}>{a.name}</span> — can be raised as {entry.dc}
        </div>
      ))}
      {!encountered && <div style={{ fontSize:10, color:'#2a3a2a', fontStyle:'italic' }}>???</div>}
      {encountered && !showAbilities && (
        <div style={{ fontSize:10, color:'#3a4a3a', fontStyle:'italic' }}>Encounter again to learn more.</div>
      )}
    </div>
  );
}

function BossCard({ boss, info }) {
  const encountered = info?.encounters > 0;
  const showAbilities = info?.abilitiesSeen;
  return (
    <div style={{ ...card, opacity: encountered ? 1 : 0.35, borderColor: encountered ? '#3a2a1a' : '#1a1a2a' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
        <span style={{ fontSize:22 }}>{boss.emoji}</span>
        <div>
          <div style={{ color:'#e8d5b0', fontWeight:'bold', fontSize:13 }}>{boss.name}</div>
          <div style={{ fontSize:9, color:'#5a4a3a' }}>
            {boss.locType === 'dungeon' ? 'Dungeon boss' : 'Camp boss'}
            {encountered ? ` — Encountered ${info.encounters}×` : ' — Not yet encountered'}
          </div>
        </div>
      </div>
      {!encountered && <div style={{ fontSize:10, color:'#2a3a2a', fontStyle:'italic' }}>Appears in {boss.locType}s after multiple raids.</div>}
      {encountered && !showAbilities && (
        <div style={{ fontSize:10, color:'#3a4a3a', fontStyle:'italic' }}>Defeat to learn abilities.</div>
      )}
      {showAbilities && (
        <div style={{ marginTop:6 }}>
          <div style={{ fontSize:9, color:'#5a4a2a', marginBottom:4, textTransform:'uppercase', letterSpacing:1 }}>Ability Pool</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {Object.values(BOSS_PASSIVES).slice(0,3).map(p => (
              <div key={p.id} style={{ fontSize:10, color:'#4a5a4a' }}>
                {tag('#3a7a3a','passive')} <span style={{ color:'#c4a882' }}>{p.name}</span> — {p.desc}
              </div>
            ))}
            {Object.values(BOSS_ACTIVES).slice(0,3).map(a => (
              <div key={a.id} style={{ fontSize:10, color:'#4a5a4a' }}>
                {tag('#3a6a9a','active')} <span style={{ color:'#c4a882' }}>{a.name}</span> — {a.desc}
              </div>
            ))}
            {Object.values(BOSS_CONDITIONALS).slice(0,2).map(c => (
              <div key={c.id} style={{ fontSize:10, color:'#4a5a4a' }}>
                {tag('#6a3a3a','cond')} <span style={{ color:'#c4a882' }}>{c.name}</span> — {c.desc}
              </div>
            ))}
          </div>
          <div style={{ fontSize:9, color:'#3a4a3a', marginTop:6, fontStyle:'italic' }}>
            Each boss draws one ability from each pool on spawn.
          </div>
        </div>
      )}
    </div>
  );
}

function ClassCard({ cls, info }) {
  const unlocked = !info || !info.locked;
  return (
    <div style={{ ...card, opacity: unlocked ? 1 : 0.4 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
        <span style={{ fontSize:18 }}>{cls.emoji}</span>
        <div>
          <div style={{ color:'#e8d5b0', fontWeight:'bold', fontSize:12 }}>{cls.name}</div>
          <div style={{ fontSize:9, color:'#4a5a4a' }}>
            Tier {cls.tier} · {cls.baseClass?.replace('_',' ')}
            {cls.tier === 2 ? ' — promote at Lv2' : ' — ascend at Lv5'}
          </div>
        </div>
        {unlocked && (
          <div style={{ marginLeft:'auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 10px', fontSize:9, color:'#4a6a5a' }}>
            <span>❤️ {cls.stats.hp}</span>
            <span>⚔️ {cls.stats.dmg}</span>
            <span>🛡️ {cls.stats.def}</span>
            <span>👟 {cls.stats.move}</span>
          </div>
        )}
      </div>
      {unlocked ? (
        <div style={{ marginTop:4 }}>
          {cls.abilityChoice?.map(aid => <AbilityLine key={aid} abilityId={aid} />)}
          {cls.immunities?.length > 0 && (
            <div style={{ fontSize:9, color:'#4a5a3a', marginTop:3 }}>
              Immune: {cls.immunities.join(', ')}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize:10, color:'#2a3a2a', fontStyle:'italic' }}>Promote a unit to this class to unlock.</div>
      )}
    </div>
  );
}

export default function BestiaryScreen() {
  const { bestiary, roster, setScreen } = useGameStore();
  const [tab, setTab] = useState(TAB_ENEMIES);

  // Which classes have been promoted to (unlocked in bestiary)
  const promotedClasses = new Set(roster.map(u => u.classId).filter(Boolean));

  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)} style={{
      background: tab===id ? '#0d1020' : '#06090f',
      border: `1px solid ${tab===id ? '#3a5a8a' : '#1a1a2a'}`,
      borderRadius:5, padding:'6px 14px',
      color: tab===id ? '#6a8aba' : '#4a5a4a',
      cursor:'pointer', fontSize:11,
    }}>{label}</button>
  );

  // Tier-2 and tier-3 classes sorted
  const allClasses = Object.values(CLASSES).filter(c => !c.noMissions && !c.sanctuaryOnly);
  const t2Classes  = allClasses.filter(c => c.tier === 2);
  const t3Classes  = allClasses.filter(c => c.tier === 3);

  return (
    <div style={pg}>
      <div style={{ maxWidth:500, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h2 style={{ color:'#e8d5b0', margin:0, fontSize:16, letterSpacing:2 }}>📖 BESTIARY</h2>
          <button onClick={() => setScreen('sanctuary')} style={{
            background:'none', border:'1px solid #2a2a3a', borderRadius:5,
            padding:'5px 10px', color:'#4a5a4a', cursor:'pointer', fontSize:11,
          }}>← Back</button>
        </div>

        <div style={{ display:'flex', gap:6, marginBottom:12 }}>
          {tabBtn(TAB_ENEMIES, '⚔️ Enemies')}
          {tabBtn(TAB_BOSSES,  '👑 Bosses')}
          {tabBtn(TAB_UNDEAD,  '💀 Undead Classes')}
        </div>

        {tab === TAB_ENEMIES && DC_ENTRIES.map(entry => (
          <EnemyCard key={entry.dc} entry={entry} info={bestiary[entry.dc]} />
        ))}

        {tab === TAB_BOSSES && BOSS_TYPES.map(boss => (
          <BossCard key={boss.key} boss={boss} info={bestiary[boss.key]} />
        ))}

        {tab === TAB_UNDEAD && (
          <>
            <div style={{ fontSize:10, color:'#3a4a3a', marginBottom:10 }}>
              Promote units to unlock class details. All classes are visible — abilities unlock on first promotion.
            </div>
            <div style={{ marginBottom:8 }}>
              <div style={{ fontSize:10, color:'#5a6a5a', marginBottom:6, letterSpacing:1 }}>TIER 2</div>
              {t2Classes.map(cls => (
                <ClassCard key={cls.id} cls={cls} info={promotedClasses.has(cls.id) ? {} : { locked:true }} />
              ))}
            </div>
            <div>
              <div style={{ fontSize:10, color:'#5a6a5a', marginBottom:6, letterSpacing:1 }}>TIER 3</div>
              {t3Classes.map(cls => (
                <ClassCard key={cls.id} cls={cls} info={promotedClasses.has(cls.id) ? {} : { locked:true }} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
