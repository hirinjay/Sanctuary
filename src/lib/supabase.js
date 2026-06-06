import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Client is null when env vars aren't set (local dev without Supabase).
// All persistence calls check for null before using it.
export const supabase = url && key ? createClient(url, key) : null
export const hasSupabase = !!supabase
