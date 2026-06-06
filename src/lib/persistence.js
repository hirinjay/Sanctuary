// Persistence layer — Supabase when available, localStorage fallback.
// All save/load calls go through here so the store stays storage-agnostic.

import { supabase, hasSupabase } from './supabase'

const LS_KEY = 'sanctuary-save'

// ── Save ──────────────────────────────────────────────────────────────
export async function saveRun(state) {
  const payload = {
    vp:           state.vp,
    roster:       state.roster,
    inv:          state.inv,
    nodes:        state.nodes,
    book:         state.book,
    unlockedLocs: state.unlockedLocs,
    worldPos:     state.worldPos,
    sanctuaryPos: state.sanctuaryPos,
    world:        state.world,
    log:          state.log,
    updated_at:   new Date().toISOString(),
  }

  if (hasSupabase) {
    const { error } = await supabase
      .from('runs')
      .upsert({ id: getRunId(), ...payload })
    if (error) console.warn('[persistence] Supabase save failed:', error.message)
  }

  try { localStorage.setItem(LS_KEY, JSON.stringify(payload)) } catch {}
}

// ── Load ──────────────────────────────────────────────────────────────
export async function loadRun() {
  if (hasSupabase) {
    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .eq('id', getRunId())
      .maybeSingle()
    if (!error && data) return data
    if (error) console.warn('[persistence] Supabase load failed:', error.message)
  }

  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// ── Run ID ─────────────────────────────────────────────────────────────
// Anonymous run ID — stored in localStorage, stable per browser.
// Replaced with Supabase auth user ID once auth is added.
function getRunId() {
  const k = 'sanctuary-run-id'
  let id = localStorage.getItem(k)
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(k, id) }
  return id
}
