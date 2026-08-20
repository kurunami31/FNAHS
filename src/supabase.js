import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** true when real Supabase credentials are configured */
export const isSupabase = Boolean(url && anonKey)

/*
 * Storage adapter that lets Supabase's own session write
 * (sb-<ref>-auth-token) survive a full localStorage quota:
 * on quota errors it evicts the app's replaceable caches (chat / polls /
 * notifications / announcements), retries, and finally keeps the session in
 * memory only so login still works instead of throwing
 * "Failed to execute 'setItem' … exceeded the quota".
 */
const mem = new Map()
const DROP_ON_FULL = [
  'fnahs-demo-chat',
  'fnahs-demo-polls',
  'fnahs-demo-notifs',
  'fnahs-demo-announcements',
  'fnahs-codex-db-v2',
  'fnahs-db-v2',
]

const safeStorage = {
  getItem(key) {
    try {
      const v = localStorage.getItem(key)
      return v ?? mem.get(key) ?? null
    } catch {
      return mem.get(key) ?? null
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value)
      mem.set(key, value)
      return
    } catch {
      for (const k of DROP_ON_FULL) {
        if (k === key) continue
        try {
          localStorage.removeItem(k)
        } catch {
          /* ignore */
        }
      }
      try {
        localStorage.setItem(key, value)
        mem.set(key, value)
        return
      } catch {
        mem.set(key, value) // keep for this session only
      }
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    mem.delete(key)
  },
}

export const supabase = isSupabase
  ? createClient(url, anonKey, { auth: { persistSession: true, storage: safeStorage } })
  : null

export const SUPABASE_ENABLED = isSupabase