/* ============================================================
   Vault — WebCrypto AES-GCM encryption for sensitive localStorage.
   Security Level 1: the offline write queue (queued ops may carry
   member ids, emails, receipts) and the session cache (full profile)
   are encrypted at rest. The AES-256 key never touches localStorage:
   it lives as a non-extractable CryptoKey in IndexedDB, so even a
   script that can read the storage cannot decrypt it.
   ============================================================ */

const KEY_DB = 'fnahs-vault'
const KEY_STORE = 'keys'
const KEY_ID = 'fnahs-aes256'

const enc = new TextEncoder()
const dec = new TextDecoder()

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEY_DB, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(KEY_STORE)) req.result.createObjectStore(KEY_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readonly')
    const req = tx.objectStore(KEY_STORE).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readwrite')
    tx.objectStore(KEY_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

let cachedKey = null

async function getKey() {
  if (cachedKey) return cachedKey
  if (!window.crypto?.subtle || !window.indexedDB) return null
  const db = await idbOpen()
  const existing = await idbGet(db, KEY_ID)
  if (existing) {
    cachedKey = existing
    return existing
  }
  const fresh = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await idbPut(db, KEY_ID, fresh)
  cachedKey = fresh
  return fresh
}

export function vaultAvailable() {
  return Boolean(window.crypto?.subtle && window.indexedDB)
}

/** JSON-encrypts a value. Returns null when crypto is unavailable. */
export async function vaultEncrypt(value) {
  try {
    const key = await getKey()
    if (!key) return null
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)))
    const buf = new Uint8Array(iv.length + cipher.byteLength)
    buf.set(iv, 0)
    buf.set(new Uint8Array(cipher), iv.length)
    return btoa(String.fromCharCode(...buf))
  } catch {
    return null
  }
}

/** Decrypts a vault blob. Returns null for any failure (incl. plaintext). */
export async function vaultDecrypt(blob) {
  try {
    const key = await getKey()
    if (!key || typeof blob !== 'string') return null
    const buf = Uint8Array.from(atob(blob), (c) => c.charCodeAt(0))
    const iv = buf.slice(0, 12)
    const cipher = buf.slice(12)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
    return JSON.parse(dec.decode(plain))
  } catch {
    return null
  }
}
