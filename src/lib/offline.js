/* ============================================================
   Offline engine — connectivity state, local mirror, write queue.
   The demo store (fnahs-db-v2) doubles as the offline mirror: every
   successful Supabase read is mirrored into it, so the demo twins in
   api.js serve the user's REAL data when the network disappears.
   ============================================================ */

import { supabase, SUPABASE_ENABLED } from '../supabase'
import { uid } from './format'

const LS_QUEUE = 'fnahs-pending-queue'
const LS_IDMAP = 'fnahs-id-map'
const LS_SESSION = 'fnahs-session-cache'

let online = typeof navigator !== 'undefined' ? navigator.onLine : true
const listeners = new Set()

function emit() {
  const payload = { online, pending: queueCount() }
  for (const fn of listeners) fn(payload)
}

function setOnline(v) {
  if (online === v) return
  online = v
  emit()
}

/** subscribe to connectivity/pending-count changes — returns unsubscribe */
export function onStatus(fn) {
  listeners.add(fn)
  fn({ online, pending: queueCount() })
  return () => listeners.delete(fn)
}

export function isOnline() {
  return online
}

export function initOffline() {
  if (typeof window === 'undefined') return
  window.addEventListener('online', () => {
    setOnline(true)
    flushQueue()
  })
  window.addEventListener('offline', () => setOnline(false))
}

/** network-failure detection — real errors (RLS, constraints) rethrow */
export function isOfflineError(e) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const msg = String(e?.message || e?.name || e || '').toLowerCase()
  if (/permission denied|violates|constraint|rls|insufficient|not found/i.test(msg)) return false
  return /failed to fetch|network error|networkerror|internet disconnected|load failed|fetch failed|abort|timed out|timeout/i.test(msg)
}

/* ---------------- write queue ---------------- */

export function queueCount() {
  try {
    return JSON.parse(localStorage.getItem(LS_QUEUE) || '[]').length
  } catch {
    return 0
  }
}

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(LS_QUEUE) || '[]')
  } catch {
    return []
  }
}

function writeQueue(q) {
  try {
    localStorage.setItem(LS_QUEUE, JSON.stringify(q))
  } catch {
    /* storage full — ignore */
  }
  emit()
}

export function queueOp(method, args, localId) {
  const q = readQueue()
  // An unsynced create followed by its own delete is a net zero — drop the
  // create so neither is replayed (delete/remove ops for OTHER local ids,
  // e.g. attendance against a locally-created event, stay queued).
  const counterpart = { deletePost: 'createPost', deleteEvent: 'createEvent', deleteComment: 'addComment' }[method]
  if (counterpart && typeof args[0] === 'string') {
    const created = q.find((op) => op.method === counterpart && op.localId === args[0])
    if (created) {
      writeQueue(q.filter((op) => op !== created))
      return
    }
  }
  q.push({ id: uid(), method, args, localId: localId || null, at: new Date().toISOString() })
  writeQueue(q)
}

/* ---------------- local → server id map ---------------- */

function readMap() {
  try {
    return JSON.parse(localStorage.getItem(LS_IDMAP) || '{}')
  } catch {
    return {}
  }
}

export function rememberId(localId, serverId) {
  if (!localId || !serverId || localId === serverId) return
  const m = readMap()
  m[localId] = serverId
  if (Object.keys(m).length > 500) delete m[Object.keys(m)[0]]
  try {
    localStorage.setItem(LS_IDMAP, JSON.stringify(m))
  } catch {
    /* ignore */
  }
}

/** swap local ids for server ids across op args (posts, events, …) */
function remapArgs(args) {
  const m = readMap()
  return args.map((a) => (typeof a === 'string' && m[a] ? m[a] : a))
}

/* ---------------- sync ---------------- */

const syncRegistry = new Map()

/** register the server-side implementation used when replaying the queue */
export function registerSync(method, supImpl) {
  syncRegistry.set(method, supImpl)
}

/** replay queued writes in order; returns how many were applied/dropped */
export async function flushQueue() {
  if (!SUPABASE_ENABLED || !supabase) return 0
  const q = readQueue()
  if (!q.length) return 0
  let handled = 0
  const failures = []
  for (const op of q) {
    const impl = syncRegistry.get(op.method)
    if (!impl) {
      failures.push(op)
      continue
    }
    try {
      const result = await impl(...remapArgs(op.args))
      if (op.localId) rememberId(op.localId, result?.id || op.localId)
      handled++
    } catch (e) {
      // Permanent errors (unregistered member, permission) drop the op so it
      // can never block the rest of the queue; anything else retries later.
      if (/violates foreign key|permission denied|insufficient|not found/i.test(String(e?.message || ''))) {
        handled++
        continue
      }
      failures.push(op)
      break
    }
  }
  writeQueue(failures)
  if (handled) {
    try {
      window.dispatchEvent(new CustomEvent('fnahs:synced', { detail: { count: handled } }))
    } catch {
      /* ignore */
    }
  }
  return handled
}

/* ---------------- session cache (offline auto-restore) ---------------- */

export function cacheSession(profile) {
  if (!profile?.id) return
  try {
    localStorage.setItem(LS_SESSION, JSON.stringify({ profile, at: Date.now() }))
  } catch {
    /* ignore */
  }
}

export function restoreSession() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_SESSION) || 'null')
    return s?.profile || null
  } catch {
    return null
  }
}

export function clearSessionCache() {
  try {
    localStorage.removeItem(LS_SESSION)
  } catch {
    /* ignore */
  }
}

/* ---------------- api wrappers ---------------- */

/**
 * Read path: Supabase first (mirroring the result into the local demo store
 * so offline reads serve real data), then the demo twin when offline.
 * When Supabase is disabled entirely this behaves exactly like before.
 */
export function offlineRead(method, supImpl, demoImpl, mirror) {
  if (!SUPABASE_ENABLED || !supabase) return demoImpl
  return async (...args) => {
    try {
      const data = await supImpl(...args)
      setOnline(true)
      if (mirror) {
        try {
          mirror(data, ...args)
        } catch (e) {
          console.warn(`offline mirror "${method}" failed:`, e)
        }
      }
      return data
    } catch (e) {
      if (isOfflineError(e)) {
        setOnline(false)
        return demoImpl(...args)
      }
      throw e
    }
  }
}

/**
 * Write path: Supabase first; when the network is gone, apply optimistically
 * through the demo twin and queue the op for replay on reconnect.
 */
export function offlineWrite(method, supImpl, demoImpl, opts = {}) {
  if (!SUPABASE_ENABLED || !supabase) return demoImpl
  registerSync(method, supImpl)
  return async (...args) => {
    try {
      const r = await supImpl(...args)
      setOnline(true)
      return r
    } catch (e) {
      if (isOfflineError(e)) {
        setOnline(false)
        const local = await demoImpl(...args)
        queueOp(method, args, opts.localId ? opts.localId(local, ...args) : null)
        return local
      }
      throw e
    }
  }
}

initOffline()