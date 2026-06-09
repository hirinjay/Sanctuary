import { supabase, hasSupabase } from './supabase'

const NO_SB = { error: { message: 'Supabase not configured — add env vars' } }

export async function signUp(email, password) {
  if (!hasSupabase) return NO_SB
  return supabase.auth.signUp({ email, password })
}

export async function signIn(email, password) {
  if (!hasSupabase) return NO_SB
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  if (!hasSupabase) return
  return supabase.auth.signOut()
}

export async function getSession() {
  if (!hasSupabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session ?? null
}

// Returns an unsubscribe function
export function onAuthStateChange(callback) {
  if (!hasSupabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(session, event))
  return () => data.subscription.unsubscribe()
}
