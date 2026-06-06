import { supabase, hasSupabase } from './supabase'

const lsKey = (slot) => `sanctuary-save-slot${slot}`

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
    unlocked_locs:    state.unlockedLocs,
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
    if (error) console.warn('[save] Supabase error:', error.message)
  }

  try { localStorage.setItem(lsKey(slot), JSON.stringify({ slot, ...payload })) } catch {}
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
