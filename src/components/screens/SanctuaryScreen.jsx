import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { item, RECIPES } from '../../data/items';
import { xpNext, calcSacrificeBonus, defenseTypeFor } from '../../systems/combat';
import { getTier3Class, CLASSES } from '../../data/classes';
import { ABILITIES } from '../../data/abilities';
import { CLASS_STATS, ARCHETYPES } from '../../data/archetypes';
import EquipModal from '../sanctuary/EquipModal';

const pg = { background:'#040810', minHeight:'100vh', fontFamily:'Georgia,serif', color:'#c4a882', padding:14 };
const card = { background:'#090e1a', border:'1px solid #1a1a2a', borderRadius:8, padding:13, marginBottom:11 };

function hasLegacy(u) {
  return !!u.t4 || (u.legacy_abilities ?? []).length > 0 || (u.legacy_traits ?? []).length > 0 || (u.legacy_immunities ?? []).length > 0;
}

const TRAIT_LABEL = { dodge:'Dodge', counter:'Counter', defend:'Defend' };
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function LegacySection(u) {
  if (!hasLegacy(u)) return null;
  return (
    <div style={{ background:'#0a0e16', border:'1px solid #2a2438', borderRadius:5, padding:'6px 8px',
      marginTop:4, marginBottom:6, fontSize:10, color:'#9a8aba', maxHeight:120, overflowY:'auto' }}>
      <div style={{ fontWeight:'bold', marginBottom:3, color:'#bda8e8' }}>📜 Legacy{u.t4 ? ' · T4' : ''}</div>
      {(u.legacy_abilities ?? []).map(aid => (
        <div key={aid}>✦ {ABILITIES[aid]?.name ?? aid}</div>
      ))}
      {(u.legacy_traits ?? []).map(tr => (
        <div key={tr}>◆ {TRAIT_LABEL[tr] ?? cap(tr)} (legacy trait)</div>
      ))}
      {(u.legacy_immunities ?? []).map(im => (
        <div key={im}>⛨ Immune: {cap(im)}</div>
      ))}
    </div>
  );
}

function mergeRow(checked, atCap) {
  return {
    display:'flex', alignItems:'center', gap:7, fontSize:10,
    color: checked ? '#e8d5b0' : atCap ? '#3a3a3a' : '#8a9a8a',
    cursor: atCap && !checked ? 'default' : 'pointer',
  };
}

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
  const { vp, roster, inv, nodes, travelBag, sanctuaryPos, book,
          setEquipTgt, ti, depositLoot, ascendUnit, rebirthUnit, mergeUnits, ascendVarek, returnToWorld, openSanctuaryMap, openBestiary, goHome } = useGameStore();
  const set = useGameStore.setState;
  const t = ti(null);
  const [ascendingId, setAscendingId] = useState(null);
  const [ascendSacId, setAscendSacId] = useState(null);
  const [rebirthConfirmId, setRebirthConfirmId] = useState(null);
  const [rebirthDc, setRebirthDc] = useState(null);
  const [mergeBaseId, setMergeBaseId] = useState(null);
  const [mergeDonorId, setMergeDonorId] = useState(null);
  const [mergeSel, setMergeSel] = useState({});
  const [mergeStep, setMergeStep] = useState(null); // null | 'confirm' | 'rename'
  const [mergeName, setMergeName] = useState('');
  const [legacyOpenIds, setLegacyOpenIds] = useState(new Set());
  const [varekAscendOpen, setVarekAscendOpen] = useState(false);
  const [varekAscendChoices, setVarekAscendChoices] = useState(null);
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
              <div key={u.id} style={{ padding:'5px 0', borderBottom:'1px solid #0f1220', fontSize:11 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    {u.emoji} {u.name}
                    <span style={{ color:'#4a5a4a' }}> Lv{u.level} ❤️{u.hp}/{u.maxHp} ⚔️{u.dmg}</span>
                  </div>
                  <div style={{ display:'flex', gap:5 }}>
                    {hasLegacy(u) && (
                      <button onClick={() => setLegacyOpenIds(s => {
                        const n = new Set(s); n.has(u.id) ? n.delete(u.id) : n.add(u.id); return n;
                      })} style={btn(true, '#7a5aaa')}>
                        📜 {legacyOpenIds.has(u.id) ? 'Hide' : 'Legacy'}
                      </button>
                    )}
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
                {legacyOpenIds.has(u.id) && LegacySection(u)}
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

        {/* Forge — craft weapons & armor */}
        {nodes.includes('forge') && (() => {
          const forgeIds = new Set(['rusty_blade','bone_club','iron_sword','cloth_wrap','bone_plate','leather_vest']);
          const recipes  = RECIPES.filter(r => forgeIds.has(r.id));
          return (
            <div style={card}>
              <div style={{ fontWeight:'bold', color:'#c4a882', marginBottom:5, fontSize:12 }}>🔥 Forge</div>
              <div style={{ fontSize:10, color:'#3a4a3a', marginBottom:8 }}>Craft weapons and armor.</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {recipes.map(r => {
                  const canCraft = Object.entries(r.cost).every(([id, amt]) => (inv[id]||0) >= amt);
                  const costStr  = Object.entries(r.cost).map(([id, amt]) => `${item(id)?.emoji}×${amt}`).join(' ');
                  return (
                    <button key={r.id} disabled={!canCraft} onClick={() => {
                      set(s => {
                        if (!Object.entries(r.cost).every(([id, amt]) => (s.inv[id]||0) >= amt)) return s;
                        const ni = { ...s.inv };
                        Object.entries(r.cost).forEach(([id, amt]) => { ni[id] = (ni[id]||0) - amt; });
                        ni[r.id] = (ni[r.id]||0) + 1;
                        return { inv: ni, log: [`🔥 Crafted ${r.name}!`, ...s.log].slice(0,14) };
                      });
                    }} style={{ ...btn(canCraft,'#7a4a1a'), width:90, textAlign:'center', padding:'7px 5px' }}>
                      <div style={{ fontSize:13 }}>{r.emoji}</div>
                      <div style={{ fontSize:10, fontWeight:'bold', color:'#c4a882', margin:'2px 0 3px' }}>{r.name}</div>
                      <div style={{ fontSize:9, color: canCraft ? '#6a6a4a' : '#3a3a3a' }}>{costStr}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Workshop — craft tools */}
        {nodes.includes('workshop') && (() => {
          const workshopIds = new Set(['pickaxe']);
          const recipes     = RECIPES.filter(r => workshopIds.has(r.id));
          return (
            <div style={card}>
              <div style={{ fontWeight:'bold', color:'#c4a882', marginBottom:5, fontSize:12 }}>🔧 Workshop</div>
              <div style={{ fontSize:10, color:'#3a4a3a', marginBottom:8 }}>Craft tools.</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {recipes.map(r => {
                  const canCraft = Object.entries(r.cost).every(([id, amt]) => (inv[id]||0) >= amt);
                  const costStr  = Object.entries(r.cost).map(([id, amt]) => `${item(id)?.emoji}×${amt}`).join(' ');
                  return (
                    <button key={r.id} disabled={!canCraft} onClick={() => {
                      set(s => {
                        if (!Object.entries(r.cost).every(([id, amt]) => (s.inv[id]||0) >= amt)) return s;
                        const ni = { ...s.inv };
                        Object.entries(r.cost).forEach(([id, amt]) => { ni[id] = (ni[id]||0) - amt; });
                        ni[r.id] = (ni[r.id]||0) + 1;
                        return { inv: ni, log: [`🔧 Crafted ${r.name}!`, ...s.log].slice(0,14) };
                      });
                    }} style={{ ...btn(canCraft,'#2a5a5a'), width:90, textAlign:'center', padding:'7px 5px' }}>
                      <div style={{ fontSize:13 }}>{r.emoji}</div>
                      <div style={{ fontSize:10, fontWeight:'bold', color:'#c4a882', margin:'2px 0 3px' }}>{r.name}</div>
                      <div style={{ fontSize:9, color: canCraft ? '#4a6a6a' : '#3a3a3a' }}>{costStr}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Ascension Forge */}
        {nodes.includes('ascension_forge') && (() => {
          const eligible = roster.filter(u => u.tier === 2 && u.level >= 5 && getTier3Class(u.classId));
          const sacPool = roster.filter(u => u.tier !== 3 && u.id !== ascendingId);
          const sac = ascendSacId ? roster.find(r => r.id === ascendSacId) : null;
          const bonus = sac ? calcSacrificeBonus(sac) : null;
          return (
            <div style={card}>
              <div style={{ fontWeight:'bold', color:'#c4a882', marginBottom:7, fontSize:12 }}>⚗️ Ascension Forge</div>
              {/* ── Varek Ascension ───────────────────────────────────────── */}
              {(() => {
                const ascCap = 3;
                const ascCount = vp.varekAscensions || 0;
                const maxVarekLv = 5 + ascCount * 5;
                if (ascCount >= ascCap || vp.level < maxVarekLv) return null;
                function getPool(type) {
                  const bookId = book?.id ?? 'pale';
                  const alreadyHas = vp.varekAbilities || [];
                  const seen = new Set();
                  Object.values(CLASSES).forEach(cls => {
                    if (cls.grimoires?.includes(bookId)) {
                      (cls.abilityChoice ?? []).forEach(aid => {
                        if (ABILITIES[aid]?.type === type && !alreadyHas.includes(aid)) seen.add(aid);
                      });
                    }
                  });
                  return [...seen];
                }
                function openChoices() {
                  const acts = getPool('active'), pass = getPool('passive');
                  setVarekAscendChoices({
                    activeChoice:  acts.length  ? acts[Math.floor(Math.random()  * acts.length)]  : null,
                    passiveChoice: pass.length ? pass[Math.floor(Math.random() * pass.length)] : null,
                  });
                  setVarekAscendOpen(true);
                }
                return (
                  <div style={{ borderBottom:'1px solid #1a2a3a', paddingBottom:10, marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                      marginBottom: varekAscendOpen ? 8 : 0 }}>
                      <span style={{ fontSize:11, color:'#e8d5b0' }}>🧙 Varek ready (Lv{maxVarekLv})</span>
                      <button onClick={() => varekAscendOpen ? setVarekAscendOpen(false) : openChoices()}
                        style={btn(true, varekAscendOpen ? '#4a4a6a' : '#6a4a9a')}>
                        {varekAscendOpen ? 'Cancel' : 'Ascend'}
                      </button>
                    </div>
                    {varekAscendOpen && varekAscendChoices && (
                      <div>
                        <div style={{ fontSize:10, color:'#5a5a3a', marginBottom:7 }}>
                          Ascension {ascCount + 1}/{ascCap} — choose a path:
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                          <button onClick={() => { ascendVarek('dmg'); setVarekAscendOpen(false); setVarekAscendChoices(null); }}
                            style={{ background:'#120a0a', border:'1px solid #5a2a2a', borderRadius:5,
                              padding:'8px 10px', color:'#c4a882', cursor:'pointer', textAlign:'left' }}>
                            <div style={{ fontWeight:'bold', fontSize:12, color:'#e8a050', marginBottom:2 }}>⚔️ Drain +2</div>
                            <div style={{ fontSize:10, color:'#5a4a3a' }}>
                              Drain damage increases to {(vp.dmg || 2) + 2}.
                            </div>
                          </button>
                          {varekAscendChoices.activeChoice && (() => {
                            const ab = ABILITIES[varekAscendChoices.activeChoice];
                            return (
                              <button onClick={() => { ascendVarek(varekAscendChoices.activeChoice); setVarekAscendOpen(false); setVarekAscendChoices(null); }}
                                style={{ background:'#0a0a18', border:'1px solid #2a2a6a', borderRadius:5,
                                  padding:'8px 10px', color:'#c4a882', cursor:'pointer', textAlign:'left' }}>
                                <div style={{ fontWeight:'bold', fontSize:12, color:'#8a8adc', marginBottom:2 }}>
                                  ✦ {ab.name} <span style={{ fontSize:9, color:'#4a4a8a', fontWeight:'normal' }}>ACTIVE</span>
                                </div>
                                <div style={{ fontSize:10, color:'#4a4a5a' }}>{ab.desc}</div>
                              </button>
                            );
                          })()}
                          {varekAscendChoices.passiveChoice && (() => {
                            const ab = ABILITIES[varekAscendChoices.passiveChoice];
                            return (
                              <button onClick={() => { ascendVarek(varekAscendChoices.passiveChoice); setVarekAscendOpen(false); setVarekAscendChoices(null); }}
                                style={{ background:'#0a140a', border:'1px solid #2a4a2a', borderRadius:5,
                                  padding:'8px 10px', color:'#c4a882', cursor:'pointer', textAlign:'left' }}>
                                <div style={{ fontWeight:'bold', fontSize:12, color:'#5a9a5a', marginBottom:2 }}>
                                  ◆ {ab.name} <span style={{ fontSize:9, color:'#3a6a3a', fontWeight:'normal' }}>PASSIVE</span>
                                </div>
                                <div style={{ fontSize:10, color:'#3a5a3a' }}>{ab.desc}</div>
                              </button>
                            );
                          })()}
                          {!varekAscendChoices.activeChoice && !varekAscendChoices.passiveChoice && (
                            <div style={{ fontSize:10, color:'#4a3a2a' }}>No abilities available for this book.</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              {eligible.length === 0 ? (
                <div style={{ fontSize:11, color:'#3a3a2a' }}>No units ready — reach Level 5 (Tier 2) to ascend.</div>
              ) : eligible.map(u => {
                const t3 = getTier3Class(u.classId);
                if (!t3) return null;
                const expanded = ascendingId === u.id;
                return (
                  <div key={u.id} style={{ borderBottom:'1px solid #0f1220', paddingBottom:8, marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: expanded ? 8 : 0 }}>
                      <span style={{ fontSize:11 }}>{u.emoji} {u.name} <span style={{ color:'#5a4a7a' }}>→ {t3.emoji} {t3.name}</span></span>
                      <button onClick={() => { setAscendingId(expanded ? null : u.id); setAscendSacId(null); }} style={btn(true, expanded ? '#4a4a6a' : '#6a4a9a')}>
                        {expanded ? 'Cancel' : 'Ascend'}
                      </button>
                    </div>
                    {expanded && (
                      <div>
                        {/* Step 1: pick sacrifice */}
                        <div style={{ fontSize:10, color:'#5a5a3a', marginBottom:5 }}>
                          Step 1 — Sacrifice a unit <span style={{ color:'#3a3a2a' }}>(Tier 3 not allowed)</span>:
                        </div>
                        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:10 }}>
                          {sacPool.length === 0 && (
                            <span style={{ fontSize:10, color:'#4a3a2a' }}>No eligible sacrifices.</span>
                          )}
                          {sacPool.map(s => {
                            const score = (s.tier ?? 1) * (s.level ?? 1);
                            const selected = ascendSacId === s.id;
                            return (
                              <button key={s.id} onClick={() => setAscendSacId(selected ? null : s.id)} style={{
                                ...btn(true, selected ? '#9a6a2a' : '#3a3a4a'),
                                fontSize:10, padding:'4px 8px',
                              }}>
                                {s.emoji} {s.pname} T{s.tier ?? 1}L{s.level} (score {score})
                              </button>
                            );
                          })}
                        </div>
                        {/* Step 2: pick ability with stat preview */}
                        <div style={{ fontSize:10, color:'#5a5a3a', marginBottom:5 }}>
                          Step 2 — Choose ability{sac ? ` (${sac.pname} consumed)` : ' (no sacrifice — no bonus)'}:
                        </div>
                        {bonus && (bonus.hp > 0 || bonus.dmg > 0 || bonus.move > 0) && (
                          <div style={{ fontSize:10, color:'#7a6a3a', marginBottom:6 }}>
                            Sacrifice bonus: {bonus.hp > 0 ? `+${bonus.hp} HP ` : ''}{bonus.dmg > 0 ? `+${bonus.dmg} DMG ` : ''}{bonus.move > 0 ? `+${bonus.move} MOV` : ''}
                          </div>
                        )}
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4, fontSize:10, color:'#4a6a5a', marginBottom:8 }}>
                          <span>❤️ {t3.stats.hp + (bonus?.hp ?? 0)}</span>
                          <span>⚔️ {t3.stats.dmg + (bonus?.dmg ?? 0)}</span>
                          <span>🛡 {t3.stats.def}</span>
                          <span>👟 {t3.stats.move + (bonus?.move ?? 0)}</span>
                        </div>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          {(t3.abilityChoice ?? []).map(aid => {
                            const ab = ABILITIES[aid];
                            if (!ab) return null;
                            return (
                              <button key={aid} onClick={() => {
                                ascendUnit(u.id, t3.id, aid, ascendSacId ?? undefined);
                                setAscendingId(null); setAscendSacId(null);
                              }} style={{
                                background:'#0b0f1c', border:'1px solid #3a3a5a', borderRadius:5,
                                padding:'6px 10px', color:'#c4a882', cursor:'pointer', fontSize:11, flex:1,
                              }}>
                                <div style={{ fontWeight:'bold', fontSize:11 }}>{ab.name}</div>
                                <div style={{ fontSize:9, color:'#4a5a4a', marginTop:2 }}>{ab.desc}</div>
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
          );
        })()}

        {/* T4 Merge */}
        {nodes.includes('ascension_forge') && (() => {
          const baseEligible = roster.filter(u => u.tier === 3 && (u.level ?? 1) >= 8 && u.classId !== 'pale_warden');
          const base = mergeBaseId ? roster.find(r => r.id === mergeBaseId) : null;
          const donor = mergeDonorId ? roster.find(r => r.id === mergeDonorId) : null;
          const donorPool = base ? roster.filter(u => u.id !== base.id && u.tier === 3 && u.classId !== 'pale_warden') : [];
          const cost = ['hp','dmg','move','takeActive','takePassive','takeTrait','takeImmunities']
            .filter(k => mergeSel[k]).length;

          function reset() {
            setMergeBaseId(null); setMergeDonorId(null); setMergeSel({}); setMergeStep(null); setMergeName('');
          }
          function toggle(key) {
            setMergeSel(s => {
              if (s[key]) { const n = { ...s }; delete n[key]; return n; }
              if (cost >= 3) return s;
              return { ...s, [key]: true };
            });
          }

          let donorActive = [], donorPassive = [], baseAbilityIds = [];
          if (base && donor) {
            baseAbilityIds = [base.classAbility, ...(base.bondedAbilities ?? [])].filter(Boolean);
            const donorAbilityIds = [...new Set([donor.classAbility, ...(donor.bondedAbilities ?? [])].filter(Boolean))];
            donorActive = donorAbilityIds.filter(aid => ['active','reactive'].includes(ABILITIES[aid]?.type) && !baseAbilityIds.includes(aid));
            donorPassive = donorAbilityIds.filter(aid => ABILITIES[aid]?.type === 'passive' && !baseAbilityIds.includes(aid));
          }
          const baseTrait = base ? defenseTypeFor(base) : null;
          const donorTrait = donor ? defenseTypeFor(donor) : null;
          const traitAvailable = base && donor && (base.legacy_traits ?? []).length === 0 && baseTrait !== donorTrait;
          const donorImmunities = donor ? (CLASSES[donor.classId]?.immunities ?? []) : [];

          return (
            <div style={card}>
              <div style={{ fontWeight:'bold', color:'#c4a882', marginBottom:5, fontSize:12 }}>🔮 T4 Merge</div>
              <div style={{ fontSize:10, color:'#3a4a3a', marginBottom:8 }}>
                Permanently merge a Donor into a Base unit, creating a Tier 4 unit. The Donor is consumed.
              </div>
              {baseEligible.length === 0 ? (
                <div style={{ fontSize:11, color:'#3a3a2a' }}>No units ready — reach Tier 3 Lv8 to merge.</div>
              ) : !base ? (
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {baseEligible.map(u => (
                    <button key={u.id} onClick={() => setMergeBaseId(u.id)} style={{ ...btn(true,'#3a3a4a'), fontSize:10, padding:'4px 8px' }}>
                      {u.emoji} {u.pname} T{u.tier}L{u.level}
                    </button>
                  ))}
                </div>
              ) : !donor ? (
                <div>
                  <div style={{ fontSize:11, marginBottom:6 }}>Base: {base.emoji} {base.pname}</div>
                  <div style={{ fontSize:10, color:'#5a5a3a', marginBottom:5 }}>Choose a Donor:</div>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:8 }}>
                    {donorPool.length === 0 && <span style={{ fontSize:10, color:'#4a3a2a' }}>No eligible donors.</span>}
                    {donorPool.map(u => (
                      <button key={u.id} onClick={() => setMergeDonorId(u.id)} style={{ ...btn(true,'#3a3a4a'), fontSize:10, padding:'4px 8px' }}>
                        {u.emoji} {u.pname} T{u.tier}L{u.level}
                      </button>
                    ))}
                  </div>
                  <button onClick={reset} style={btn(true,'#4a4a6a')}>Cancel</button>
                </div>
              ) : mergeStep === 'rename' ? (
                <div>
                  <div style={{ fontSize:11, color:'#9a6a2a', marginBottom:8 }}>
                    Name the merged unit:
                  </div>
                  <input value={mergeName} onChange={e => setMergeName(e.target.value)}
                    placeholder={base.pname}
                    style={{ background:'#0b0f1c', border:'1px solid #3a3a5a', borderRadius:5, color:'#c4a882', padding:'6px 8px', fontSize:11, marginBottom:8, width:'100%', boxSizing:'border-box' }} />
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => setMergeStep('confirm')} style={btn(true,'#4a4a6a')}>Back</button>
                    <button onClick={() => { mergeUnits(base.id, donor.id, mergeSel, mergeName.trim() || base.pname); reset(); }}
                      style={{ ...btn(true,'#8a3a3a'), padding:'5px 14px', fontSize:11 }}>
                      Finalize Merge
                    </button>
                  </div>
                </div>
              ) : mergeStep === 'confirm' ? (
                <div>
                  <div style={{ fontSize:11, color:'#8a3a3a', marginBottom:8, fontWeight:'bold' }}>
                    ⚠ This cannot be undone. {donor.pname} will be permanently removed from your roster.
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => setMergeStep(null)} style={btn(true,'#4a4a6a')}>Back</button>
                    <button onClick={() => setMergeStep('rename')} style={{ ...btn(true,'#8a3a3a'), padding:'5px 14px', fontSize:11 }}>
                      Yes, Merge
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize:11, marginBottom:6 }}>
                    {base.emoji} {base.pname} ⟵ {donor.emoji} {donor.pname}
                  </div>
                  <div style={{ fontSize:10, color:'#5a5a3a', marginBottom:6 }}>
                    Spend up to 3 merge points (used: {cost}/3):
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:8 }}>
                    <label style={mergeRow(mergeSel.hp, cost>=3)}>
                      <input type="checkbox" checked={!!mergeSel.hp} disabled={!mergeSel.hp && cost>=3} onChange={() => toggle('hp')} />
                      +{Math.floor((donor.maxHp ?? 0)/3)} Max HP (from {donor.pname})
                    </label>
                    <label style={mergeRow(mergeSel.dmg, cost>=3)}>
                      <input type="checkbox" checked={!!mergeSel.dmg} disabled={!mergeSel.dmg && cost>=3} onChange={() => toggle('dmg')} />
                      +{Math.floor((donor.dmg ?? 0)/3)} Damage (from {donor.pname})
                    </label>
                    <label style={mergeRow(mergeSel.move, cost>=3)}>
                      <input type="checkbox" checked={!!mergeSel.move} disabled={!mergeSel.move && cost>=3} onChange={() => toggle('move')} />
                      +{Math.floor((donor.moveRange ?? 0)/3)} Move (from {donor.pname})
                    </label>
                    {donorActive.map(aid => (
                      <label key={aid} style={mergeRow(mergeSel.takeActive, cost>=3)}>
                        <input type="checkbox" checked={!!mergeSel.takeActive} disabled={!mergeSel.takeActive && cost>=3} onChange={() => toggle('takeActive')} />
                        Learn active: {ABILITIES[aid]?.name ?? aid}
                      </label>
                    ))}
                    {donorPassive.map(aid => (
                      <label key={aid} style={mergeRow(mergeSel.takePassive, cost>=3)}>
                        <input type="checkbox" checked={!!mergeSel.takePassive} disabled={!mergeSel.takePassive && cost>=3} onChange={() => toggle('takePassive')} />
                        Learn passive: {ABILITIES[aid]?.name ?? aid}
                      </label>
                    ))}
                    {traitAvailable && (
                      <label style={mergeRow(mergeSel.takeTrait, cost>=3)}>
                        <input type="checkbox" checked={!!mergeSel.takeTrait} disabled={!mergeSel.takeTrait && cost>=3} onChange={() => toggle('takeTrait')} />
                        Gain {donor.pname}'s {donorTrait} trait (in addition to {baseTrait})
                      </label>
                    )}
                    {donorImmunities.length > 0 && (
                      <label style={mergeRow(mergeSel.takeImmunities, cost>=3)}>
                        <input type="checkbox" checked={!!mergeSel.takeImmunities} disabled={!mergeSel.takeImmunities && cost>=3} onChange={() => toggle('takeImmunities')} />
                        Gain {donor.pname}'s class immunities ({donorImmunities.join(', ')})
                      </label>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={reset} style={btn(true,'#4a4a6a')}>Cancel</button>
                    <button onClick={() => setMergeStep('confirm')} style={{ ...btn(true,'#9a6a2a'), padding:'5px 14px', fontSize:11 }}>
                      Finalize…
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Rebirth Table */}
        {nodes.includes('rebirth_table') && (() => {
          const promoted = roster.filter(u => u.classId);
          return (
            <div style={card}>
              <div style={{ fontWeight:'bold', color:'#c4a882', marginBottom:5, fontSize:12 }}>🔄 Rebirth Table</div>
              <div style={{ fontSize:10, color:'#3a4a3a', marginBottom:8 }}>
                Choose a new root class. Stats reset to its Lv1 baseline (plus a small bonus from this unit's history),
                and everything earned so far is preserved in this unit's Legacy.
              </div>
              {promoted.length === 0 ? (
                <div style={{ fontSize:11, color:'#3a3a2a' }}>No promoted units available for rebirth.</div>
              ) : promoted.map(u => {
                const isExpanded = rebirthConfirmId === u.id;
                const legacyBonus = u.legacy_stat_bonus ?? { hp:0, dmg:0, move:0 };
                const oldTrait = defenseTypeFor(u);
                const previewBase = rebirthDc ? CLASS_STATS[rebirthDc] : null;
                return (
                  <div key={u.id} style={{ borderBottom:'1px solid #0f1220', paddingBottom:8, marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: isExpanded ? 6 : 0 }}>
                      <div style={{ fontSize:11 }}>
                        {u.emoji} {u.name}
                        <span style={{ color:'#4a5a4a' }}> Lv{u.level} ❤️{u.hp}/{u.maxHp}</span>
                        {(u.bondedAbilities ?? []).length > 0 && (
                          <span style={{ color:'#5a4a7a', fontSize:9 }}> +{u.bondedAbilities.length} bonded</span>
                        )}
                      </div>
                      <button onClick={() => { setRebirthConfirmId(isExpanded ? null : u.id); setRebirthDc(null); }}
                        style={btn(true, isExpanded ? '#4a4a6a' : '#5a3a2a')}>
                        {isExpanded ? 'Cancel' : 'Rebirth'}
                      </button>
                    </div>
                    {isExpanded && (
                      <div>
                        {/* Root class picker */}
                        <div style={{ fontSize:10, color:'#5a5a3a', marginBottom:5 }}>
                          Choose new root class:
                        </div>
                        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:8 }}>
                          {ARCHETYPES.map(a => {
                            const selected = rebirthDc === a.dc;
                            return (
                              <button key={a.dc} onClick={() => setRebirthDc(selected ? null : a.dc)} style={{
                                ...btn(true, selected ? '#9a6a2a' : '#3a3a4a'),
                                fontSize:10, padding:'4px 8px',
                              }}>
                                {a.emoji} {a.dc}
                              </button>
                            );
                          })}
                        </div>
                        {/* Preview */}
                        {previewBase && (
                          <div style={{ fontSize:10, color:'#4a5a4a', marginBottom:6 }}>
                            → Lv1 ❤️{previewBase.hp + Math.floor((u.level ?? 1)/2) + (legacyBonus.hp ?? 0)}
                            {' '}⚔️{previewBase.dmg + 1 + (legacyBonus.dmg ?? 0)}
                            {' '}👟{previewBase.moveRange + (legacyBonus.move ?? 0)}
                          </div>
                        )}
                        <div style={{ fontSize:10, color:'#7a6a3a', marginBottom:8 }}>
                          📜 Moves to Legacy: {u.cls ?? u.classId}'s ability
                          {(u.bondedAbilities ?? []).length > 0 ? ` + ${u.bondedAbilities.length} bonded` : ''}
                          {(CLASSES[u.classId]?.immunities ?? []).length > 0 ? `, ${u.cls} immunities` : ''}
                          {previewBase && oldTrait !== defenseTypeFor({ ...u, dc: rebirthDc }) ? `, ${oldTrait} trait` : ''}
                        </div>
                        <button disabled={!rebirthDc} onClick={() => {
                          rebirthUnit(u.id, rebirthDc);
                          setRebirthConfirmId(null); setRebirthDc(null);
                        }} style={{ ...btn(!!rebirthDc,'#8a3a3a'), padding:'5px 14px', fontSize:11 }}>
                          Confirm Rebirth
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => returnToWorld()} style={{
            ...btn(true,'#6a6aaa'), flex:1, padding:12, fontSize:12,
          }}>
            ⬡ World Map
          </button>
          <button onClick={() => openSanctuaryMap()} style={{
            ...btn(true,'#4a8a4a'), flex:1, padding:12, fontSize:12,
          }}>
            🗺 View Map
          </button>
          <button onClick={() => openBestiary()} style={{
            ...btn(true,'#5a4a7a'), padding:'12px 18px', fontSize:12,
          }}>
            📖 Bestiary
          </button>
          <button onClick={() => goHome()} style={{
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
