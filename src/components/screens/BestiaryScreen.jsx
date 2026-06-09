import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { ARCHETYPES, CLASS_STATS } from '../../data/archetypes';
import { CLASSES } from '../../data/classes';
import { BOOKS } from '../../data/books';
import { ABILITIES } from '../../data/abilities';
import { BOSS_PASSIVES, BOSS_ACTIVES, BOSS_CONDITIONALS } from '../../data/bosses';

const pg   = { background:'#040810', minHeight:'100vh', fontFamily:'Georgia,serif', color:'#c4a882', padding:14 };
const card = { background:'#090e1a', border:'1px solid #1a1a2a', borderRadius:8, padding:'10px 12px', marginBottom:8 };

const TAB_ENEMIES = 'enemies';
const TAB_BOSSES  = 'bosses';
const TAB_UNDEAD  = 'undead';

// Base undead classes — always visible in the undead tab
const BASE_UNDEAD = [
  { id:'skeleton_warrior', name:'Skeleton Warrior', emoji:'💀', dc:'Skeleton Warrior', stats: CLASS_STATS['Skeleton Warrior'], desc:'Melee combatant raised from fallen warriors. Balanced stats.' },
  { id:'grave_stalker',    name:'Grave Stalker',    emoji:'🏹', dc:'Grave Stalker',    stats: CLASS_STATS['Grave Stalker'],    desc:'Ranged undead raised from scouts. Fast, fragile, long range.' },
  { id:'grave_warden',     name:'Grave Warden',     emoji:'🛡', dc:'Grave Warden',     stats: CLASS_STATS['Grave Warden'],     desc:'Heavy undead raised from brutes. Slow, high HP and defense.' },
];

const BOSS_TYPES = [
  { key:'dungeon_lord',      name:'Dungeon Lord',      emoji:'👑', locType:'dungeon' },
  { key:'skeletal_champion', name:'Skeletal Champion', emoji:'💀', locType:'dungeon' },
  { key:'lich',              name:'Lich',              emoji:'🔮', locType:'dungeon' },
  { key:'raid_captain',      name:'Raid Captain',      emoji:'⚔️',  locType:'camp' },
  { key:'warlord',           name:'Warlord',           emoji:'🪓',  locType:'camp' },
];

const BOOK_ORDER = ['pale', 'flesh', 'verdant', 'tinker'];

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

function EnemyCard({ archetype, info }) {
  const encountered = (info?.encounters ?? 0) > 0;
  return (
    <div style={{ ...card, opacity: encountered ? 1 : 0.5 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
        <span style={{ fontSize:20 }}>{encountered ? archetype.emoji : '❓'}</span>
        <div>
          <div style={{ color:'#e8d5b0', fontWeight:'bold', fontSize:13 }}>
            {encountered ? archetype.name : '???'}
          </div>
          {encountered
            ? <div style={{ fontSize:9, color:'#3a5a3a' }}>Encountered {info.encounters}× · Raises as {archetype.dc}</div>
            : <div style={{ fontSize:9, color:'#3a3a3a' }}>Not yet encountered</div>}
        </div>
        {encountered && (
          <div style={{ marginLeft:'auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 10px', fontSize:9, color:'#4a6a5a' }}>
            <span>❤️ {archetype.hp}</span>
            <span>⚔️ {archetype.dmg}</span>
            <span>👟 {archetype.move}</span>
            <span>👁 {archetype.sight}</span>
          </div>
        )}
      </div>
      {encountered && (info?.encounters ?? 0) >= 2 && (
        <div style={{ fontSize:10, color:'#4a5a4a' }}>
          Defeat to raise as <span style={{ color:'#c4a882' }}>{archetype.dc}</span> — unlock class tree in Ascension Forge.
        </div>
      )}
      {encountered && (info?.encounters ?? 0) < 2 && (
        <div style={{ fontSize:10, color:'#3a4a3a', fontStyle:'italic' }}>Encounter again to learn more.</div>
      )}
    </div>
  );
}

function BaseUndeadCard({ entry }) {
  return (
    <div style={{ ...card }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
        <span style={{ fontSize:18 }}>{entry.emoji}</span>
        <div>
          <div style={{ color:'#e8d5b0', fontWeight:'bold', fontSize:12 }}>{entry.name}</div>
          <div style={{ fontSize:9, color:'#3a5a4a' }}>Tier 1 base — raised from fallen {entry.dc}s</div>
        </div>
        <div style={{ marginLeft:'auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 10px', fontSize:9, color:'#4a6a5a' }}>
          <span>❤️ {entry.stats.hp}</span>
          <span>⚔️ {entry.stats.dmg}</span>
          <span>🛡️ {entry.stats.def}</span>
          <span>👟 {entry.stats.moveRange}</span>
        </div>
      </div>
      <div style={{ fontSize:10, color:'#4a5a4a' }}>{entry.desc}</div>
    </div>
  );
}

function BossCard({ boss, info }) {
  const encountered = (info?.encounters ?? 0) > 0;
  const showAbilities = info?.abilitiesSeen;
  return (
    <div style={{ ...card, opacity: encountered ? 1 : 0.35, borderColor: encountered ? '#3a2a1a' : '#1a1a2a' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
        <span style={{ fontSize:22 }}>{encountered ? boss.emoji : '❓'}</span>
        <div>
          <div style={{ color:'#e8d5b0', fontWeight:'bold', fontSize:13 }}>
            {encountered ? boss.name : '???'}
          </div>
          <div style={{ fontSize:9, color:'#5a4a3a' }}>
            {encountered
              ? `${boss.locType === 'dungeon' ? 'Dungeon boss' : 'Camp boss'} — Encountered ${info.encounters}×`
              : `Lurks in ${boss.locType}s after multiple raids.`}
          </div>
        </div>
      </div>
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

function ClassCard({ cls, unlocked }) {
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

function ClassGroup({ label, classes, promotedClasses }) {
  if (!classes.length) return null;
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:10, color:'#5a6a5a', marginBottom:6, letterSpacing:1, textTransform:'uppercase' }}>
        {label}
      </div>
      {classes.map(cls => (
        <ClassCard key={cls.id} cls={cls} unlocked={promotedClasses.has(cls.id)} />
      ))}
    </div>
  );
}

export default function BestiaryScreen() {
  const { bestiary, roster, enterSanctuary } = useGameStore();
  const [tab, setTab] = useState(TAB_ENEMIES);

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

  // Split classes into general (multi-book) and specialized (single-book)
  const allClasses = Object.values(CLASSES).filter(c => !c.noMissions && !c.sanctuaryOnly);
  const generalClasses = allClasses
    .filter(c => c.grimoires && c.grimoires.length > 1)
    .sort((a, b) => a.tier - b.tier);
  const specializedByBook = {};
  for (const cls of allClasses.filter(c => c.grimoires && c.grimoires.length === 1)) {
    const bookId = cls.grimoires[0];
    if (!specializedByBook[bookId]) specializedByBook[bookId] = [];
    specializedByBook[bookId].push(cls);
  }
  // Sort each group tier 2 → tier 3
  for (const arr of Object.values(specializedByBook)) arr.sort((a, b) => a.tier - b.tier);

  return (
    <div style={pg}>
      <div style={{ maxWidth:500, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h2 style={{ color:'#e8d5b0', margin:0, fontSize:16, letterSpacing:2 }}>📖 BESTIARY</h2>
          <button onClick={() => enterSanctuary()} style={{
            background:'none', border:'1px solid #2a2a3a', borderRadius:5,
            padding:'5px 10px', color:'#4a5a4a', cursor:'pointer', fontSize:11,
          }}>← Back</button>
        </div>

        <div style={{ display:'flex', gap:6, marginBottom:12 }}>
          {tabBtn(TAB_ENEMIES, '⚔️ Enemies')}
          {tabBtn(TAB_BOSSES,  '👑 Bosses')}
          {tabBtn(TAB_UNDEAD,  '💀 Undead Classes')}
        </div>

        {tab === TAB_ENEMIES && ARCHETYPES.map(a => (
          <EnemyCard key={a.name} archetype={a} info={bestiary[a.dc]} />
        ))}

        {tab === TAB_BOSSES && BOSS_TYPES.map(boss => (
          <BossCard key={boss.key} boss={boss} info={bestiary[boss.key]} />
        ))}

        {tab === TAB_UNDEAD && (
          <>
            <div style={{ fontSize:10, color:'#3a4a3a', marginBottom:10 }}>
              Promote units to unlock class details. Abilities unlock on first promotion.
            </div>

            <div style={{ fontSize:10, color:'#5a6a5a', marginBottom:6, letterSpacing:1, textTransform:'uppercase' }}>
              Base Undead
            </div>
            {BASE_UNDEAD.map(e => <BaseUndeadCard key={e.id} entry={e} />)}

            <div style={{ marginTop:12 }} />
            <ClassGroup
              label="General — available to multiple grimoires"
              classes={generalClasses}
              promotedClasses={promotedClasses}
            />

            {BOOK_ORDER.map(bookId => {
              const classes = specializedByBook[bookId];
              if (!classes?.length) return null;
              const book = BOOKS.find(b => b.id === bookId);
              return (
                <ClassGroup
                  key={bookId}
                  label={`${book?.emoji ?? ''} ${book?.name ?? bookId} exclusive`}
                  classes={classes}
                  promotedClasses={promotedClasses}
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
