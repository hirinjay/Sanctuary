import { UT } from './constants';

// ── Ability pools ─────────────────────────────────────────────────────

export const BOSS_PASSIVES = {
  regeneration: { id:'regeneration', name:'Regeneration',   desc:'Recovers 2 HP per turn.' },
  pack_leader:  { id:'pack_leader',  name:'Pack Leader',    desc:'Nearby enemies deal +1 DMG while this boss lives.' },
  armored:      { id:'armored',      name:'Armored',        desc:'All incoming damage reduced by 2.' },
  terrifying:   { id:'terrifying',   name:'Terrifying',     desc:'Adjacent player units lose 1 AP at the start of each turn.' },
  undying:      { id:'undying',      name:'Undying',        desc:'Survives lethal damage once, remaining at 1 HP.' },
  unstoppable:  { id:'unstoppable',  name:'Unstoppable',    desc:'Immune to Bind, Root, and Slow.' },
  spellshield:  { id:'spellshield',  name:'Spellshield',    desc:'Immune to ability effects; raw damage only.' },
  swift:        { id:'swift',        name:'Swift',          desc:'+1 AP each turn.' },
  brutal:       { id:'brutal',       name:'Brutal',         desc:'Attacks ignore DEF.' },
  commanding:   { id:'commanding',   name:'Commanding',     desc:'On turn start, one nearby enemy gets a free move toward the nearest friendly.' },
};

export const BOSS_ACTIVES = {
  war_cry:        { id:'war_cry',        name:'War Cry',         desc:'All enemies within 3 tiles gain +1 move this turn.' },
  cleave:         { id:'cleave',         name:'Cleave',          desc:'Attacks all adjacent units in one action.' },
  charge:         { id:'charge',         name:'Charge',          desc:'Moves full move range and attacks in the same action.' },
  summon:         { id:'summon',         name:'Summon',          desc:'Calls 1–2 enemies from the map edges.' },
  pinning_strike: { id:'pinning_strike', name:'Pinning Strike',  desc:'Attack also applies Slow to the target for 1 turn.' },
  whirlwind:      { id:'whirlwind',      name:'Whirlwind',       desc:'Hits all units within 2 tiles for half of base damage.' },
  rally:          { id:'rally',          name:'Rally',           desc:'Heals all nearby enemies for 2 HP.' },
  terrify:        { id:'terrify',        name:'Terrify',         desc:'Targeted unit cannot attack next turn.' },
  barrier:        { id:'barrier',        name:'Barrier',         desc:'Adjacent tiles become impassable for 2 turns.' },
  execute_order:  { id:'execute_order',  name:'Execute Order',   desc:'One nearby enemy immediately moves and attacks the nearest friendly.' },
};

export const BOSS_CONDITIONALS = {
  last_stand:  { id:'last_stand',  name:'Last Stand',   desc:'Below 25% HP: permanently gains +2 DMG and +1 move.' },
  enrage:      { id:'enrage',      name:'Enrage',       desc:'On first hit received, attacks twice per turn for 2 turns.' },
  death_burst: { id:'death_burst', name:'Death Burst',  desc:'On death, deals 2 DMG to all adjacent units.' },
  sacrifice:   { id:'sacrifice',   name:'Sacrifice',    desc:'Below 25% HP: kills nearest enemy to restore half max HP.' },
  phase_shift: { id:'phase_shift', name:'Phase Shift',  desc:'Once per mission: when a lethal hit would land, teleport to a random tile at 1 HP.' },
};

// ── Boss unit templates ───────────────────────────────────────────────

const BOSS_TYPES = {
  dungeon: [
    { key:'dungeon_lord',       name:'Dungeon Lord',       emoji:'👑', hp:22, dmg:5, def:2, move:2, attackRange:1, boss_loot:'dungeon_sigil' },
    { key:'skeletal_champion',  name:'Skeletal Champion',  emoji:'💀', hp:16, dmg:4, def:1, move:3, attackRange:1, boss_loot:'bone_plate' },
    { key:'lich',               name:'Lich',               emoji:'🔮', hp:14, dmg:6, def:0, move:2, attackRange:3, boss_loot:'lich_phylactery' },
  ],
  camp: [
    { key:'raid_captain',       name:'Raid Captain',       emoji:'⚔️',  hp:20, dmg:5, def:1, move:3, attackRange:1, boss_loot:'iron_sword' },
    { key:'warlord',            name:'Warlord',            emoji:'🪓',  hp:24, dmg:4, def:2, move:2, attackRange:1, boss_loot:'warlord_axe' },
    { key:'raider_warchief',    name:'Raider Warchief',    emoji:'🏴',  hp:28, dmg:5, def:2, move:2, attackRange:1, boss_loot:'warchief_banner' },
  ],
  wizard_tower: [
    { key:'tower_keeper',       name:'Tower Keeper',       emoji:'🗼',  hp:20, dmg:5, def:1, move:2, attackRange:3, boss_loot:'arcane_focus' },
    { key:'arcane_warden',      name:'Arcane Warden',      emoji:'🔮',  hp:16, dmg:6, def:0, move:3, attackRange:4, boss_loot:'arcane_tome' },
    { key:'void_architect',     name:'Void Architect',     emoji:'👁️',  hp:18, dmg:7, def:0, move:2, attackRange:5, boss_loot:'void_shard' },
  ],
  cabin: [
    { key:'angry_hunter',       name:'Angry Hunter',       emoji:'🏹',  hp:14, dmg:5, def:0, move:3, attackRange:3, dc:'Grave Stalker', boss_loot:'hunters_bow' },
    { key:'vengeful_trapper',   name:'Vengeful Trapper',   emoji:'🪤',  hp:12, dmg:4, def:1, move:2, attackRange:2, dc:'Grave Stalker', boss_loot:'trappers_kit' },
  ],
};

// Companion units that flank cabin bosses — hunting dogs from the surrounding wilds.
const CABIN_COMPANIONS = [
  { name:'Hunting Dog',  emoji:'🐕', hp:5, dmg:3, move:4, attackRange:1, dc:'Skeleton Warrior', sight:5, spot:0.6, xp:5 },
  { name:'Tracker Hound',emoji:'🐺', hp:6, dmg:3, move:4, attackRange:1, dc:'Skeleton Warrior', sight:5, spot:0.6, xp:5 },
];

const BOSS_NAMES = [
  'Grak', 'Mordeth', 'Vaeloth', 'Skarrik', 'Druvash',
  'Nekron', 'Galthas', 'Voreth', 'Thrax', 'Malgoth',
  'Durash', 'Skethis', 'Vroth', 'Keldrath',
];

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Spawn a boss unit ─────────────────────────────────────────────────

export function spawnBoss(danger, tiles, spawnX, spawnY, locType) {
  const pool    = BOSS_TYPES[locType] ?? BOSS_TYPES.dungeon;
  const btype   = pickRandom(pool);
  const pname   = pickRandom(BOSS_NAMES);

  const bossPassive     = pickRandom(Object.keys(BOSS_PASSIVES));
  const bossActive      = pickRandom(Object.keys(BOSS_ACTIVES));
  const bossConditional = pickRandom(Object.keys(BOSS_CONDITIONALS));

  const hpMult  = 1 + (danger - 1) * 0.4;
  const dmgMult = 1 + (danger - 1) * 0.3;
  const hp  = Math.round(btype.hp * hpMult);
  const dmg = Math.max(2, Math.round(btype.dmg * dmgMult));

  const mapH = tiles?.length ?? 12;
  const mapW = tiles?.[0]?.length ?? 16;
  let bx = Math.floor(mapW / 2), by = Math.floor(mapH / 4);
  for (let a = 0; a < 80; a++) {
    const tx = 2 + Math.floor(Math.random() * (mapW - 4));
    const ty = 1 + Math.floor(Math.random() * Math.max(1, Math.floor(mapH * 0.55)));
    if (Math.abs(tx - spawnX) + Math.abs(ty - spawnY) > 7 && tiles?.[ty]?.[tx]?.type !== 'wall') {
      bx = tx; by = ty; break;
    }
  }

  return {
    id:   `boss_${Date.now()}`,
    type: UT.ENEMY,
    isBoss: true,
    pname,
    name:     `${pname} the ${btype.name}`,
    emoji:    btype.emoji,
    bossType: btype.key,
    bossPassive,
    bossActive,
    bossConditional,
    bossActiveUses: 1,
    bossCondTriggered: false,
    enrageTurns: 0,
    // Stats
    x: bx, y: by,
    hp, maxHp: hp, dmg, def: btype.def,
    actionPoints: 1, movementPoints: bossPassive === 'swift' ? 2 : 1,
    moveRange: btype.move + Math.floor(danger / 2),
    attackRange: btype.attackRange,
    // Territorial: stays in room until player closes within 5 tiles
    fallen: false, raiseTurn: null,
    alerted: true, placement: 'guard',
    territorial: true, triggerRadius: 5,
    waypoints: undefined, wi: 0,
    ambushTriggered: true,
    patrol: [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }], pi: 0,
    xp: 25 + danger * 6,
    dc: btype.dc ?? 'Skeleton Warrior',
    sight: 7, spot: 1.0,
    weapon: null, armor: null,
    level: 3 + Math.floor(danger / 2),
    xpVal: 0, chaseTurns: 0, lastKnown: null,
    statusEffects: [],
  };
}

// ── Spawn companion units alongside a boss ─────────────────────────────
// Cabin bosses bring a small, variable pack of hunting dogs instead of the
// usual three-archetype guard squad.
export function spawnCabinCompanions(danger, tiles, boss) {
  const mapH = tiles?.length ?? 12;
  const mapW = tiles?.[0]?.length ?? 16;
  const count = 1 + Math.floor(Math.random() * 2); // 1-2 dogs, varies each time
  const companions = [];
  for (let i = 0; i < count; i++) {
    const c = pickRandom(CABIN_COMPANIONS);
    const hp  = Math.round(c.hp  * (1 + (danger - 1) * 0.35));
    const dmg = Math.max(1, Math.round(c.dmg * (1 + (danger - 1) * 0.25)));
    let sx = boss.x, sy = boss.y;
    for (let attempt = 0; attempt < 40; attempt++) {
      const tx = boss.x + Math.floor(Math.random() * 5) - 2;
      const ty = boss.y + Math.floor(Math.random() * 5) - 2;
      if (tx >= 1 && tx < mapW - 1 && ty >= 1 && ty < mapH - 1
          && tiles?.[ty]?.[tx]?.type !== 'wall'
          && !companions.some(s => s.x === tx && s.y === ty)
          && (tx !== boss.x || ty !== boss.y)) { sx = tx; sy = ty; break; }
    }
    companions.push({
      id: `comp${i}`, type: UT.ENEMY, name: c.name, emoji: c.emoji,
      x: sx, y: sy, hp, maxHp: hp, dmg, def: 0,
      actionPoints: 1, movementPoints: 1, moveRange: c.move, attackRange: c.attackRange,
      fallen: false, raiseTurn: null, alerted: true, placement: 'guard',
      waypoints: undefined, wi: 0, ambushTriggered: true, triggerRow: undefined,
      patrol: [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }], pi: 0,
      xp: c.xp, dc: c.dc, sight: c.sight, spot: c.spot,
      weapon: null, armor: null, level: 1, xpVal: 0, chaseTurns: 0, lastKnown: null,
      statusEffects: [],
    });
  }
  return companions;
}
