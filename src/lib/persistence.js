import { supabase, hasSupabase } from './supabase'

const lsKey      = (slot) => `sanctuary-save-slot${slot}`
const bestiaryKey = (userId) => `sanctuary-bestiary-${userId ?? 'anon'}`

// ── Bestiary (account-scoped, no slot) ───────────────────────────────
export async function saveBestiary(bestiary, userId) {
  if (hasSupabase && userId) {
    const { error } = await supabase
      .from('bestiary')
      .upsert({ user_id: userId, data: bestiary }, { onConflict: 'user_id' })
    if (error) console.warn('[bestiary] Supabase error:', error.message)
  }
  try { localStorage.setItem(bestiaryKey(userId), JSON.stringify(bestiary)) } catch (e) { console.warn('[bestiary] localStorage error:', e) }
}

export async function loadBestiary(userId) {
  if (hasSupabase && userId) {
    const { data, error } = await supabase
      .from('bestiary')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle()
    if (!error && data?.data) return data.data
    if (error) console.warn('[bestiary] Supabase error:', error.message)
  }
  try {
    const raw = localStorage.getItem(bestiaryKey(userId))
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

// ── Save ──────────────────────────────────────────────────────────────
export async function saveRun(state, userId, slot) {
  const payload = {
    vp:               state.vp,
    roster:           state.roster,
    inv:              state.inv,
    travel_bag:       state.travelBag,
    nodes:            state.nodes,
    book:             state.book,
    world:            state.world,
    world_pos:        state.worldPos,
    sanctuary_pos:    state.sanctuaryPos,
    sanctuary_grid:   state.sanctuaryGrid,
    unlocked_locs:    state.unlockedLocs,
    location_visits:  state.locationVisits ?? {},
    location_bosses:  state.locationBosses ?? {},
    location_scavenges: state.locationScavenges ?? {},
    location_resources: state.locationResources ?? {},
    squad_preferences: state.squadPreferences ?? {},
    mission_state:    state.ms ? { ms: state.ms, loc: state.loc, mode: state.mode, noise: state.noise } : null,
    log:              state.log,
    varek_level:      state.vp?.level ?? 1,
    book_id:          state.book?.id ?? null,
    sanctuary_placed: !!state.sanctuaryPos,
    updated_at:       new Date().toISOString(),
  }

  if (hasSupabase && userId) {
    const { error } = await supabase
      .from('runs')
      .upsert({ user_id: userId, slot, ...payload }, { onConflict: 'user_id,slot' })
    if (error) {
      console.error('[save] Supabase error:', error.message, error)
      // Surface schema errors so they aren't invisible during development
      if (error.code === '42703' || error.message?.includes('column')) {
        console.error('[save] Missing column — run the latest migration in supabase/migrations/')
      }
    }
  }

  try { localStorage.setItem(lsKey(slot), JSON.stringify({ slot, ...payload })) } catch (e) { console.warn('[save] localStorage error:', e) }
}

// ── Load slot summaries (for save-select screen) ──────────────────────
export async function loadSaveSlots(userId) {
  if (hasSupabase && userId) {
    const { data, error } = await supabase
      .from('runs')
      .select('slot, varek_level, book_id, book, sanctuary_placed, started_at, updated_at')
      .eq('user_id', userId)
      .order('slot')
    if (!error && data) return data
    if (error) console.warn('[slots] Supabase error:', error.message)
  }

  // localStorage fallback
  return [1, 2, 3].flatMap(s => {
    try {
      const raw = localStorage.getItem(lsKey(s))
      return raw ? [JSON.parse(raw)] : []
    } catch { return [] }
  })
}

// ── Load full save ────────────────────────────────────────────────────
export async function loadSave(userId, slot) {
  if (hasSupabase && userId) {
    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .eq('user_id', userId)
      .eq('slot', slot)
      .maybeSingle()
    if (!error && data) return data
    if (error) console.warn('[load] Supabase error:', error.message)
  }

  try {
    const raw = localStorage.getItem(lsKey(slot))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// ── Delete a save slot ────────────────────────────────────────────────
export async function deleteSave(userId, slot) {
  if (hasSupabase && userId) {
    await supabase.from('runs').delete().eq('user_id', userId).eq('slot', slot)
  }
  localStorage.removeItem(lsKey(slot))
}
