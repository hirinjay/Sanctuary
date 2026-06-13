// CSS pixel-art sprites for each unit type.
// All sizing is relative to the `size` prop so it scales with tileSize.

const PALETTE = {
  // ── Friendly ─────────────────────────────────────────────
  varek:    { head:'#5a1a7a', headBrd:'#c06adc', body:'#3a0a5a', bodyBrd:'#8a3aaa', accent:'#c4a822' },

  // T1 base classes
  sw1:      { head:'#c8c4a8', headBrd:'#9a9480', body:'#8a8070', bodyBrd:'#aaa090', accent:'#706850' },
  gs1:      { head:'#1a3a38', headBrd:'#3a7a68', body:'#122820', bodyBrd:'#2a5a48', accent:'#3a8a6a' },
  gw1:      { head:'#3a3a48', headBrd:'#6a6a7a', body:'#282838', bodyBrd:'#4a4a5a', accent:'#7a7a8a' },

  // T2 — slightly brighter than T1, accent stripe
  sw2:      { head:'#d8d4b8', headBrd:'#aaa490', body:'#9a9484', bodyBrd:'#bab0a0', accent:'#9a8060' },
  gs2:      { head:'#1e4a44', headBrd:'#4a8a78', body:'#162e28', bodyBrd:'#347060', accent:'#4aaa88' },
  gw2:      { head:'#444458', headBrd:'#7a7a8a', body:'#323245', bodyBrd:'#5a5a6a', accent:'#9a9aaa' },

  // T3 — vivid + glow
  sw3:      { head:'#eeeac8', headBrd:'#c8c09a', body:'#aaaa88', bodyBrd:'#d0c8a0', accent:'#d4aa60' },
  gs3:      { head:'#225a52', headBrd:'#5aaa98', body:'#1a3830', bodyBrd:'#3a8a70', accent:'#5adc88' },
  gw3:      { head:'#505060', headBrd:'#8a8a9a', body:'#3c3c50', bodyBrd:'#6a6a7a', accent:'#b0b0c8' },

  // ── Enemy ─────────────────────────────────────────────────
  enemy_sw: { head:'#6a1a18', headBrd:'#aa3a38', body:'#4a1010', bodyBrd:'#8a2828', accent:'#aa4a48' },
  enemy_gs: { head:'#5a2410', headBrd:'#9a5428', body:'#3a1808', bodyBrd:'#7a3818', accent:'#aa6038' },
  enemy_gw: { head:'#4a2028', headBrd:'#8a5058', body:'#301418', bodyBrd:'#6a3038', accent:'#9a6068' },

  // Boss
  boss:     { head:'#7a1a00', headBrd:'#ff5500', body:'#550d00', bodyBrd:'#cc3300', accent:'#ff8800' },
};

function getConfig(unit) {
  if (unit.isBoss) return { pal: PALETTE.boss, shape: 'boss' };
  if (unit.id === 'varek') return { pal: PALETTE.varek, shape: 'hood' };

  const isEnemy   = unit.type === 'enemy';
  const base      = unit.baseClass ?? unit.dc?.toLowerCase().replace(/ /g,'_');
  const tier      = unit.tier ?? 1;

  if (isEnemy) {
    if (base === 'grave_stalker') return { pal: PALETTE.enemy_gs, shape: 'hood' };
    if (base === 'grave_warden')  return { pal: PALETTE.enemy_gw, shape: 'helm' };
    return                               { pal: PALETTE.enemy_sw, shape: 'skull' };
  }

  // Friendly undead
  if (base === 'grave_stalker') {
    const pal = tier >= 3 ? PALETTE.gs3 : tier >= 2 ? PALETTE.gs2 : PALETTE.gs1;
    return { pal, shape: 'hood' };
  }
  if (base === 'grave_warden') {
    const pal = tier >= 3 ? PALETTE.gw3 : tier >= 2 ? PALETTE.gw2 : PALETTE.gw1;
    return { pal, shape: 'helm' };
  }
  // Skeleton Warrior (default undead)
  const pal = tier >= 3 ? PALETTE.sw3 : tier >= 2 ? PALETTE.sw2 : PALETTE.sw1;
  return { pal, shape: 'skull' };
}

export default function UnitSprite({ unit, size = 28, fallen = false }) {
  const { pal, shape } = getConfig(unit);
  const opacity = fallen ? 0.28 : 1;

  const headW = Math.round(size * 0.40);
  const headH = Math.round(size * 0.34);
  const bodyW = shape === 'helm' ? Math.round(size * 0.56) : shape === 'hood' ? Math.round(size * 0.36) : Math.round(size * 0.44);
  const bodyH = Math.round(size * 0.38);
  const staffW = 2;
  const staffH = Math.round(size * 0.68);

  // Boss gets a slightly larger head + crown-like top; elites get a smaller bump
  const isBoss = unit.isBoss;
  const bossScale = isBoss ? 1.22 : unit.isElite ? 1.12 : 1;

  const headRadius =
    shape === 'skull' ? `30% 30% 40% 40%` :  // flat-bottom skull
    shape === 'hood'  ? `50% 50% 30% 30%` :  // rounded hood
    shape === 'helm'  ? `20% 20% 10% 10%` :  // flat-top helmet
    shape === 'boss'  ? `40% 40% 30% 30%` :
    '50%';

  const bodyRadius =
    shape === 'skull' ? 2 :
    shape === 'hood'  ? `4px 4px 50% 50%` :
    shape === 'helm'  ? 2 :
    shape === 'boss'  ? 3 :
    2;

  const glowColor = isBoss ? `0 0 5px 2px ${pal.headBrd}88` :
    unit.isElite        ? `0 0 4px 2px #ffaa3388` :
    unit.tier === 3     ? `0 0 4px 1px ${pal.accent}66` : undefined;

  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'flex-end',
      width: size, height: size,
      opacity,
      position:'relative',
      filter: unit.sleeping ? 'brightness(0.5)' : undefined,
    }}>

      {/* Staff (Varek only) — positioned to the left of head */}
      {shape === 'hood' && unit.id === 'varek' && (
        <div style={{
          position:'absolute',
          left: Math.round(size * 0.14),
          bottom: Math.round(size * 0.10),
          width: staffW,
          height: staffH,
          background: `linear-gradient(to bottom, ${pal.accent}, ${pal.accent}88)`,
          borderRadius: 1,
          zIndex: 0,
        }} />
      )}

      {/* Head */}
      <div style={{
        width:  Math.round(headW * bossScale),
        height: Math.round(headH * bossScale),
        background: pal.head,
        borderRadius: headRadius,
        border: `1px solid ${pal.headBrd}`,
        boxShadow: glowColor,
        flexShrink: 0,
        zIndex: 1,
        // Eye slit on helm/skull
        position:'relative',
      }}>
        {(shape === 'skull') && (
          <div style={{
            position:'absolute',
            top:'35%', left:'20%', right:'20%',
            height:2,
            background: `${pal.headBrd}99`,
            borderRadius: 1,
          }} />
        )}
        {(shape === 'helm') && (
          <div style={{
            position:'absolute',
            top:'45%', left:'15%', right:'15%',
            height: 2,
            background: `${pal.accent}cc`,
            borderRadius: 1,
          }} />
        )}
      </div>

      {/* Body */}
      <div style={{
        width:  Math.round(bodyW * bossScale),
        height: Math.round(bodyH * bossScale),
        background: pal.body,
        borderRadius: bodyRadius,
        border: `1px solid ${pal.bodyBrd}`,
        flexShrink: 0,
        marginTop: 1,
        zIndex: 1,
        position:'relative',
      }}>
        {/* Tier stripe: T2 gets a center stripe, T3 gets two */}
        {!isBoss && (unit.tier === 2 || unit.tier === 3) && (
          <div style={{
            position:'absolute',
            top:'30%', bottom:'30%',
            left:'28%', right:'28%',
            background: `${pal.accent}55`,
            borderRadius: 1,
          }} />
        )}
        {!isBoss && unit.tier === 3 && (
          <>
            <div style={{
              position:'absolute',
              top:'15%', bottom:'15%',
              left:'10%', width: 2,
              background: `${pal.accent}88`,
              borderRadius: 1,
            }} />
            <div style={{
              position:'absolute',
              top:'15%', bottom:'15%',
              right:'10%', width: 2,
              background: `${pal.accent}88`,
              borderRadius: 1,
            }} />
          </>
        )}
      </div>

    </div>
  );
}
