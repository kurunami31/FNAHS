/* ============================================================
   Offline engine — connectivity state, local mirror, write queue.
   The demo store (fnahs-db-v2) doubles as the offline mirror: every
   successful Supabase read is mirrored into it, so the demo twins in
   api.js serve the user's REAL data when the network disappears.
   ============================================================ */

import { supabase, SUPABASE_ENABLED } from '../supabase'
import { uid } from './format'
import { vaultEncrypt, vaultDecrypt } from './vault'

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
  readQueue().then((q) => {
    knownQueueLength = q.length
    emit()
  })
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

let knownQueueLength = 0

// Queue payloads are encrypted at rest, so the count can't be read
// synchronously — it's recomputed after every write and served from memory.
export function queueCount() {
  return knownQueueLength
}

// The queue may hold member ids, emails and receipt numbers — encrypt it at
// rest. A plaintext payload is always tolerated (encrypted roll-out), and a
// null value means the write was skipped only when crypto is unavailable.
async function readQueue() {
  const raw = localStorage.getItem(LS_QUEUE) || '[]'
  if (raw.startsWith('[')) return JSON.parse(raw)
  const plain = await vaultDecrypt(raw)
  return plain || []
}

async function writeQueue(q) {
  knownQueueLength = q.length
  const blob = await vaultEncrypt(q)
  try {
    if (blob) localStorage.setItem(LS_QUEUE, blob)
    else if (q.length === 0) localStorage.removeItem(LS_QUEUE)
  } catch {
    /* storage full — ignore */
  }
  emit()
}

export async function queueOp(method, args, localId) {
  const q = await readQueue()
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
  await writeQueue(q)
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
  const q = await readQueue()
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
  await writeQueue(failures)
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

export async function cacheSession(profile) {
  if (!profile?.id) return
  try {
    const blob = await vaultEncrypt({ profile, at: Date.now() })
    if (blob) localStorage.setItem(LS_SESSION, blob)
  } catch {
    /* ignore */
  }
}

export async function restoreSession() {
  try {
    const raw = localStorage.getItem(LS_SESSION)
    if (!raw) return null
    const s = raw.startsWith('{') ? JSON.parse(raw) : await vaultDecrypt(raw)
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

// No Supabase request may hang the UI forever on a flaky connection: if a
// call does not settle in time it rejects with a "timed out" error, which
// isOfflineError() treats as an offline condition (fall through to the demo
// twin / write queue) instead of leaving spinners stuck.
function withTimeout(p, method, ms = 20000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${method} timed out`)), ms)
    p.then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) }
    )
  })
}

/**
 * Read path: Supabase first (mirroring the result into the local demo store
 * so offline reads serve real data), then the demo twin when offline.
 * When Supabase is disabled entirely this behaves exactly like before.
 */
export function offlineRead(method, supImpl, demoImpl, mirror) {
  if (!SUPABASE_ENABLED || !supabase) return demoImpl
  return async (...args) => {
    try {
      const data = await withTimeout(supImpl(...args), method)
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
      const r = await withTimeout(supImpl(...args), method)
      setOnline(true)
      return r
    } catch (e) {
      if (isOfflineError(e)) {
        setOnline(false)
        const local = await demoImpl(...args)
        await queueOp(method, args, opts.localId ? opts.localId(local, ...args) : null)
        return local
      }
      throw e
    }
  }
}

initOffline()