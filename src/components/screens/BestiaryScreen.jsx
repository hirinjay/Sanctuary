import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { ARCHETYPES, CLASS_STATS } from '../../data/archetypes';
import { ENEMY_TYPES } from '../../data/enemies';
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
  { id:'grave_stalker',    name:'Grave Stalker',    emoji:'🏹', dc:'Grave Stalker',    stats: CLASS_STATS['Grave Stalker'],    desc:'Ranged undead raised from giant spiders. Fast, fragile, long range.' },
  { id:'grave_warden',     name:'Grave Warden',     emoji:'🛡', dc:'Grave Warden',     stats: CLASS_STATS['Grave Warden'],     desc:'Heavy undead raised from brutes. Slow, high HP and defense.' },
];

const BOSS_TYPES = [
  { key:'dungeon_lord',      name:'Dungeon Lord',      emoji:'👑', locType:'dungeon' },
  { key:'skeletal_champion', name:'Skeletal Champion', emoji:'💀', locType:'dungeon' },
  { key:'lich',              name:'Lich',              emoji:'🔮', locType:'dungeon' },
  { key:'raid_captain',      name:'Raid Captain',      emoji:'⚔️',  locType:'camp' },
  { key:'warlord',           name:'Warlord',           emoji:'🪓',  locType:'camp' },
  { key:'raider_warchief',   name:'Raider Warchief',   emoji:'🏴',  locType:'camp' },
  { key:'tower_keeper',      name:'Tower Keeper',      emoji:'🗼',  locType:'wizard_tower' },
  { key:'arcane_warden',     name:'Arcane Warden',     emoji:'🔮',  locType:'wizard_tower' },
  { key:'void_architect',    name:'Void Architect',    emoji:'👁️', locType:'wizard_tower' },
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

function StatGrid({ a }) {
  const rangeTag = a.attackRange > 1
    ? <span style={{ background:'#1a3a5a22', border:'1px solid #3a6a9a44', borderRadius:3, padding:'0 5px', color:'#5a8aba', fontSize:9 }}>Ranged</span>
    : <span style={{ background:'#2a1a0a22', border:'1px solid #6a4a2a44', borderRadius:3, padding:'0 5px', color:'#8a6a4a', fontSize:9 }}>Melee</span>;
  return (
    <div style={{ display:'flex', gap:10, flexWrap:'wrap', fontSize:10, color:'#4a6a5a', marginTop:5 }}>
      <span>❤️ {a.hp}</span>
      <span>⚔️ {a.dmg}</span>
      <span>👟 {a.move}</span>
      <span>👁 {a.sight}</span>
      <span>🎯 {Math.round(a.spot * 100)}%</span>
      {rangeTag}
    </div>
  );
}

function EnemyCard({ tier, info }) {
  const encounters = info?.encounters ?? 0;
  const encountered = encounters > 0;
  return (
    <div style={{ ...card, opacity: encountered ? 1 : 0.38, borderColor: encountered ? '#2a2a3a' : '#111118', marginBottom:5 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:19 }}>{encountered ? tier.emoji : '❓'}</span>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
            <span style={{ color: encountered ? '#e8d5b0' : '#3a3028', fontWeight:'bold', fontSize:12 }}>
              {encountered ? tier.name : '???'}
            </span>
            <span style={{ fontSize:8, color:'#2a3a28', background:'#080e08', border:'1px solid #14201a', borderRadius:3, padding:'0 4px' }}>
              T{tier.tier}
            </span>
            {encountered
              ? <span style={{ fontSize:9, color:'#4a7a4a' }}>{encounters}×</span>
              : <span style={{ fontSize:9, color:'#242420' }}>not yet encountered</span>}
          </div>
          {encountered && (
            <div style={{ fontSize:9, color:'#3a5a3a', marginTop:1 }}>
              Raises as <span style={{ color:'#7a6a56' }}>{tier.dc}</span>
            </div>
          )}
        </div>
      </div>
      {encountered && (
        <div style={{ marginTop:5 }}>
          {tier.desc && (
            <div style={{ fontSize:10, color:'#525040', fontStyle:'italic', marginBottom:5 }}>{tier.desc}</div>
          )}
          <StatGrid a={tier} />
          {encounters >= 2 && (
            <div style={{ fontSize:10, color:'#4a5a4a', marginTop:5 }}>
              Defeat to raise as <span style={{ color:'#c4a882' }}>{tier.dc}</span> — unlock class tree in Ascension Forge.
            </div>
          )}
        </div>
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

        {tab === TAB_ENEMIES && (() => {
          const familiesByArchetype = {};
          for (const et of ENEMY_TYPES) {
            if (!familiesByArchetype[et.archetype]) familiesByArchetype[et.archetype] = [];
            familiesByArchetype[et.archetype].push(et);
          }
          return ARCHETYPES.map(arch => (
            <div key={arch.dc} style={{ marginBottom:20 }}>
              <div style={{ fontSize:9, color:'#3a5a3a', textTransform:'uppercase', letterSpacing:2,
                borderBottom:'1px solid #0e1616', paddingBottom:4, marginBottom:8 }}>
                {arch.emoji} {arch.name}
              </div>
              {(familiesByArchetype[arch.name] ?? []).map((family, fi) => (
                <div key={family.id} style={{ marginBottom: fi < (familiesByArchetype[arch.name]?.length ?? 1) - 1 ? 10 : 0 }}>
                  {family.tiers.map(t => (
                    <EnemyCard key={t.key} tier={t} info={bestiary[t.key]} />
                  ))}
                </div>
              ))}
              {!familiesByArchetype[arch.name]?.length && (
                <div style={{ fontSize:10, color:'#1e2820', fontStyle:'italic' }}>No enemies discovered.</div>
              )}
            </div>
          ));
        })()}

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
