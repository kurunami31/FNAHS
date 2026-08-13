import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** true when real Supabase credentials are configured */
export const isSupabase = Boolean(url && anonKey)

export const supabase = isSupabase
  ? createClient(url, anonKey, { auth: { persistSession: true } })
  : null

export const SUPABASE_ENABLED = isSupabase
