import { supabase, isSupabase, SUPABASE_ENABLED } from '../supabase'
import { demoDb, DEMO_USER_ID, PROGRAMS, streamMockReply, seedFeeds } from './mock'
import { uid } from './format'

/* ---------------- input guards ---------------- */

const MAX_TEXT = 4000

function sanitizeText(value, max = MAX_TEXT) {
  const text = String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim()
  return text.slice(0, max)
}

function sanitizeUrl(value) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

/* ---------------- database health flag ---------------- */

let dbStatus = 'ok' // 'ok' | 'missing'

function setDbStatus(s) {
  if (dbStatus === s) return
  dbStatus = s
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('fnahs:dbstatus'))
}

function markDbError(error) {
  const code = error?.code
  if (code === 'PGRST202' || code === '42501' || error?.status === 404 || error?.status === 403) {
    setDbStatus('missing')
  }
}

/* ---------------- demo store (localStorage) ---------------- */

const LS_KEY = 'fnahs-db-v2'

function loadDb() {
  try {
    const raw = localStorage.getItem(LS_KEY) || localStorage.getItem('fnahs-codex-db-v2')
    if (raw) {
      const db = JSON.parse(raw)
      // lazily merge missing seeds on schema bumps
      const fresh = demoDb()
      return {
        profiles: { ...fresh.profiles, ...(db.profiles || {}) },
        posts: db.posts?.length ? db.posts : fresh.posts,
        events: db.events?.length ? db.events : fresh.events,
        feeds: db.feeds || fresh.feeds,
        attendance: db.attendance || {},
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return demoDb()
}

function saveDb(db) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(db))
  } catch {
    /* storage full / private mode — ignore */
  }
}

const db = loadDb()

/* ---------------- demo auth ---------------- */

const ADMIN_PASSWORD = 'dorsufnahs2026'

function demoLogin(id) {
  localStorage.setItem('fnahs-user', id)
}

function demoLogout() {
  localStorage.removeItem('fnahs-user')
  localStorage.removeItem('fnahs-codex-user')
}

function demoCurrentUserId() {
  return localStorage.getItem('fnahs-user') || localStorage.getItem('fnahs-codex-user') || null
}

/* ---------------- profile helpers ---------------- */

async function demoUpsertProfile(p) {
  db.profiles[p.id] = { ...db.profiles[p.id], ...p }
  saveDb(db)
  return db.profiles[p.id]
}

async function demoGetProfile(id) {
  return db.profiles[id] || null
}

/* ---------------- posts ---------------- */

async function demoGetPosts() {
  return [...db.posts]
    .filter((p) => !p.archived_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

async function demoCreatePost({ content, image_url }) {
  const me = demoCurrentUserId()
  const post = {
    id: uid(),
    user_id: me || DEMO_USER_ID,
    content: sanitizeText(content, 2000),
    image_url: sanitizeUrl(image_url),
    created_at: new Date().toISOString(),
    likes: [],
    comments: [],
  }
  db.posts.unshift(post)
  saveDb(db)
  return post
}

async function demoToggleLike(postId) {
  const me = demoCurrentUserId() || DEMO_USER_ID
  const post = db.posts.find((p) => p.id === postId)
  if (!post) return
  if (post.likes.includes(me)) post.likes = post.likes.filter((l) => l !== me)
  else post.likes.push(me)
  saveDb(db)
  return post.likes
}

async function demoAddComment(postId, content) {
  const me = demoCurrentUserId() || DEMO_USER_ID
  const post = db.posts.find((p) => p.id === postId)
  if (!post) return
  post.comments.push({ id: uid(), user_id: me, content: sanitizeText(content, 1000), created_at: new Date().toISOString() })
  saveDb(db)
  return post.comments
}

async function demoArchivePost(postId) {
  const post = db.posts.find((p) => p.id === postId)
  if (!post) return
  post.archived_at = new Date().toISOString()
  saveDb(db)
}

async function demoDeletePost(postId) {
  db.posts = db.posts.filter((p) => p.id !== postId)
  saveDb(db)
}

/* ---------------- events ---------------- */

async function demoGetEvents() {
  return [...db.events].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
}

async function demoCreateEvent(ev) {
  const me = demoCurrentUserId() || DEMO_USER_ID
  const event = {
    id: uid(),
    ...ev,
    created_by: me,
    rsvps: {},
    created_at: new Date().toISOString(),
  }
  db.events.push(event)
  saveDb(db)
  return event
}

async function demoSetRsvp(eventId, status) {
  const me = demoCurrentUserId() || DEMO_USER_ID
  const event = db.events.find((e) => e.id === eventId)
  if (!event) return
  if (status === 'none') delete event.rsvps[me]
  else event.rsvps[me] = status
  saveDb(db)
  return event.rsvps
}

async function demoGetAttendance(eventId) {
  return Object.entries(db.attendance[eventId] || {}).map(([user_id, at]) => ({ user_id, scanned_at: at }))
}

async function demoMarkAttendance(eventId, userId) {
  db.attendance[eventId] = db.attendance[eventId] || {}
  db.attendance[eventId][userId] = new Date().toISOString()
  saveDb(db)
}

/* ---------------- feeds ---------------- */

let feedCache = null
let feedCacheAt = 0

async function getFeeds() {
  // Memoize for the session so page visits don't refetch every time.
  if (feedCache && Date.now() - feedCacheAt < 15 * 60e3) return feedCache
  const out = { health: seedFeeds().health, tips: seedFeeds().tips, news: seedFeeds().health }
  try {
    const res = await fetch(
      `https://api.allorigins.win/raw?url=${encodeURIComponent('https://www.who.int/rss-feeds/news-english.xml')}`,
      { signal: AbortSignal.timeout(6000) }
    )
    if (res.ok) {
      const xml = await res.text()
      const doc = new DOMParser().parseFromString(xml, 'text/xml')
      const items = [...doc.querySelectorAll('item')]
        .slice(0, 6)
        .map((it, i) => {
          const title = (it.querySelector('title')?.textContent || '').replace(/<[^>]+>/g, '').trim()
          if (!title) return null
          const date = it.querySelector('pubDate')?.textContent
          return {
            id: it.querySelector('guid')?.textContent || `w${i}`,
            title: title.slice(0, 110),
            url: it.querySelector('link')?.textContent || '',
            source: 'WHO',
            created_at: date ? new Date(date).toISOString() : new Date().toISOString(),
          }
        })
        .filter(Boolean)
      if (items.length) out.news = items
    }
  } catch {
    /* keep curated headlines */
  }
  feedCache = out
  feedCacheAt = Date.now()
  return out
}

/* ---------------- AI chat ---------------- */

async function aiChat({ messages, onChunk }) {
  if (!SUPABASE_ENABLED || !supabase) {
    const last = [...messages].reverse().find((m) => m.role === 'user')
    await streamMockReply(last?.content || '', onChunk)
    return
  }
  try {
    const { data, error } = await supabase.functions.invoke('florence-ai', {
      body: { messages: messages.slice(-10) },
    })
    if (error) throw error
    const text = typeof data === 'string' ? data : data?.reply || JSON.stringify(data)
    // Not streamed — emit in chunks for a natural feel.
    for (const chunk of text.match(/.{1,4}/gs) || [text]) {
      onChunk(chunk)
      await new Promise((r) => setTimeout(r, 12))
    }
  } catch (e) {
    // Fall back to demo answers if the edge function isn't deployed yet.
    const last = [...messages].reverse().find((m) => m.role === 'user')
    await streamMockReply(last?.content || '', onChunk)
    console.warn('florence-ai unavailable, using demo reply:', e)
  }
}

/* ---------------- unified API surface ---------------- */

export const api = {
  get isSupabase() {
    return isSupabase
  },

  get dbStatus() {
    return dbStatus
  },

  /* auth */
  getSession() {
    if (!SUPABASE_ENABLED) {
      const id = demoCurrentUserId()
      return Promise.resolve({ user: id ? db.profiles[id] || null : null })
    }
    return supabase.auth.getSession().then(({ data }) => {
      const session = data?.session
      if (!session?.user) return { user: null }
      return api.getProfile(session.user.id).then((profile) => ({
        user: { ...(profile || {}), id: session.user.id, email: profile?.email || session.user.email },
      }))
    })
  },

  async signIn(email, password) {
    if (!SUPABASE_ENABLED) {
      // match by email so staff@fnahs.edu.ph maps to the staff account
      const found = Object.values(db.profiles).find((p) => p.email.toLowerCase() === email.toLowerCase())
      if (found && found.role === 'superadmin' && password !== ADMIN_PASSWORD) {
        throw new Error('Incorrect admin password — see the README.')
      }
      if (!found) {
        // any other demo email works; create on the fly
        const id = uid()
        const p = { id, full_name: email.split('@')[0], email, program: PROGRAMS[0], year_level: '1', role: 'student', avatar_url: null, created_at: new Date().toISOString() }
        await demoUpsertProfile(p)
        demoLogin(id)
        return { user: p }
      }
      demoLogin(found.id)
      return { user: found }
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return { user: await api.getProfile(data.user.id) }
  },

  async signUp(full_name, email, password) {
    if (!SUPABASE_ENABLED) {
      const id = uid()
      const p = { id, full_name, email, program: PROGRAMS[0], year_level: '1', role: 'student', avatar_url: null, created_at: new Date().toISOString() }
      await demoUpsertProfile(p)
      demoLogin(id)
      return { user: p }
    }
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name } } })
    if (error) throw error
    if (!data.session) {
      // confirmation email flow — profile will be created by trigger
      return { user: null, needsConfirmation: true }
    }
    return { user: await api.getProfile(data.user.id) }
  },

  async signOut() {
    if (!SUPABASE_ENABLED) {
      demoLogout()
      return
    }
    await supabase.auth.signOut()
  },

  /* profiles */
  getProfile: SUPABASE_ENABLED
    ? async (id) => {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, program, year_level, role, avatar_url, created_at')
          .eq('id', id)
          .maybeSingle()
        if (error) {
          markDbError(error)
          return null
        }
        return data
      }
    : demoGetProfile,

  upsertProfile: SUPABASE_ENABLED
    ? async (p) => {
        const patch = {
          full_name: sanitizeText(p.full_name, 120),
          program: sanitizeText(p.program, 120),
          year_level: sanitizeText(p.year_level, 20),
          avatar_url: sanitizeUrl(p.avatar_url),
        }
        if (p.id) patch.id = p.id
        const { data, error } = await supabase
          .from('profiles')
          .upsert(patch, { onConflict: 'id' })
          .select('id, full_name, program, year_level, role, avatar_url, created_at')
          .maybeSingle()
        if (error) throw error
        return data
      }
    : async (p) => {
        const clean = { ...p, full_name: sanitizeText(p.full_name, 120), avatar_url: sanitizeUrl(p.avatar_url) }
        db.profiles[p.id] = { ...db.profiles[p.id], ...clean }
        saveDb(db)
        return db.profiles[p.id]
      },

  /* posts */
  getPosts: SUPABASE_ENABLED
    ? async () => {
        const { data, error } = await supabase
          .from('posts')
          .select('*, comments(*), post_likes(user_id), profiles!posts_user_id_fkey(full_name, avatar_url, program)')
          .is('archived_at', null)
          .order('created_at', { ascending: false })
        if (error) {
          markDbError(error)
          throw error
        }
        setDbStatus('ok')
        return (data || []).map((p) => ({
          ...p,
          likes: (p.post_likes || []).map((l) => l.user_id),
          author: p.profiles,
        }))
      }
    : async () => {
        const posts = await demoGetPosts()
        return posts.map((p) => ({ ...p, author: db.profiles[p.user_id] || null }))
      },

  /* directory — served by the security-definer get_directory() RPC (no email, no RLS gaps) */
  getMembers: SUPABASE_ENABLED
    ? async () => {
        const { data, error } = await supabase.rpc('get_directory').order('full_name')
        if (error) {
          markDbError(error)
          throw error
        }
        setDbStatus('ok')
        return data || []
      }
    : () => Object.values(db.profiles),

  createPost: SUPABASE_ENABLED
    ? async ({ content, image_url }) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('You must be signed in to post.')
        const { data, error } = await supabase
          .from('posts')
          .insert({ user_id: user.id, content: sanitizeText(content, 2000), image_url: sanitizeUrl(image_url) })
          .select()
          .single()
        if (error) throw error
        return data
      }
    : demoCreatePost,

  toggleLike: SUPABASE_ENABLED
    ? async (postId) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: existing } = await supabase.from('post_likes').select('*').eq('post_id', postId).eq('user_id', user.id).maybeSingle()
        if (existing) await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id)
        else await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id })
        return (await supabase.from('post_likes').select('user_id').eq('post_id', postId)).data.map((l) => l.user_id)
      }
    : demoToggleLike,

  addComment: SUPABASE_ENABLED
    ? async (postId, content) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('You must be signed in to comment.')
        const { data, error } = await supabase
          .from('comments')
          .insert({ post_id: postId, user_id: user.id, content: sanitizeText(content, 1000) })
          .select()
          .single()
        if (error) throw error
        return data
      }
    : demoAddComment,

  archivePost: SUPABASE_ENABLED
    ? async (postId) => {
        const { error } = await supabase.from('posts').update({ archived_at: new Date().toISOString() }).eq('id', postId)
        if (error) throw error
      }
    : demoArchivePost,

  deletePost: SUPABASE_ENABLED
    ? async (postId) => {
        const { error } = await supabase.from('posts').delete().eq('id', postId)
        if (error) throw error
      }
    : demoDeletePost,

  /* moderation + admin CRUD */
  updatePost: SUPABASE_ENABLED
    ? async (postId, patch) => {
        const { error } = await supabase.from('posts').update(patch).eq('id', postId)
        if (error) throw error
      }
    : async (postId, patch) => {
        const post = db.posts.find((p) => p.id === postId)
        if (post) Object.assign(post, patch)
        saveDb(db)
      },

  getUsers: SUPABASE_ENABLED
    ? async () => {
        // security-definer RPC — only staff/superadmin may read profiles (incl. email)
        const { data, error } = await supabase.rpc('admin_get_users')
        if (error) {
          markDbError(error)
          throw error
        }
        setDbStatus('ok')
        return data || []
      }
    : () => Object.values(db.profiles),

  createUser: SUPABASE_ENABLED
    ? async (p) => {
        const { data, error } = await supabase
          .from('profiles')
          .insert({ ...p, created_at: new Date().toISOString() })
          .select()
          .single()
        if (error) throw error
        return data
      }
    : async (p) => {
        const row = {
          id: uid(),
          full_name: p.full_name,
          email: p.email,
          program: p.program || PROGRAMS[0],
          year_level: p.year_level || '1',
          role: p.role || 'student',
          avatar_url: null,
          created_at: new Date().toISOString(),
        }
        db.profiles[row.id] = row
        saveDb(db)
        return row
      },

  updateUser: SUPABASE_ENABLED
    ? async (id, patch) => {
        const clean = {}
        if (patch.full_name !== undefined) clean.full_name = sanitizeText(patch.full_name, 120)
        if (patch.program !== undefined) clean.program = sanitizeText(patch.program, 120)
        if (patch.year_level !== undefined) clean.year_level = sanitizeText(patch.year_level, 20)
        if (patch.role !== undefined) clean.role = sanitizeText(patch.role, 20)
        if (patch.avatar_url !== undefined) clean.avatar_url = sanitizeUrl(patch.avatar_url)
        const { data, error } = await supabase
          .from('profiles')
          .update(clean)
          .eq('id', id)
          .select('id, full_name, program, year_level, role, avatar_url, created_at')
          .maybeSingle()
        if (error) throw error
        return data
      }
    : async (id, patch) => {
        db.profiles[id] = { ...db.profiles[id], ...patch }
        saveDb(db)
        return db.profiles[id]
      },

  deleteUser: SUPABASE_ENABLED
    ? async (id) => {
        const { error } = await supabase.from('profiles').delete().eq('id', id)
        if (error) throw error
      }
    : async (id) => {
        delete db.profiles[id]
        db.posts = db.posts.filter((p) => p.user_id !== id)
        saveDb(db)
      },

  updateEvent: SUPABASE_ENABLED
    ? async (eventId, patch) => {
        const { data, error } = await supabase.from('events').update(patch).eq('id', eventId).select().single()
        if (error) throw error
        return data
      }
    : async (eventId, patch) => {
        const ev = db.events.find((e) => e.id === eventId)
        if (ev) Object.assign(ev, patch)
        saveDb(db)
        return ev
      },

  deleteEvent: SUPABASE_ENABLED
    ? async (eventId) => {
        const { error } = await supabase.from('events').delete().eq('id', eventId)
        if (error) throw error
      }
    : async (eventId) => {
        db.events = db.events.filter((e) => e.id !== eventId)
        delete db.attendance[eventId]
        saveDb(db)
      },

  /* events */
  getEvents: SUPABASE_ENABLED
    ? async () => {
        const { data, error } = await supabase
          .from('events')
          .select('*, rsvps(*)')
          .gte('ends_at', new Date(Date.now() - 24 * 3600e3).toISOString())
          .order('starts_at', { ascending: true })
        if (error) {
          markDbError(error)
          throw error
        }
        setDbStatus('ok')
        return (data || []).map((e) => ({
          ...e,
          rsvps: Object.fromEntries((e.rsvps || []).map((r) => [r.user_id, r.status])),
        }))
      }
    : demoGetEvents,

  createEvent: SUPABASE_ENABLED
    ? async (ev) => {
        const { data, error } = await supabase.from('events').insert(ev).select().single()
        if (error) throw error
        return data
      }
    : demoCreateEvent,

  setRsvp: SUPABASE_ENABLED
    ? async (eventId, status) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        if (status === 'none') {
          await supabase.from('rsvps').delete().eq('event_id', eventId).eq('user_id', user.id)
        } else {
          await supabase.from('rsvps').upsert({ event_id: eventId, user_id: user.id, status })
        }
      }
    : demoSetRsvp,

  getAttendance: SUPABASE_ENABLED
    ? async (eventId) => {
        const { data, error } = await supabase
          .from('attendance')
          .select('*, profiles(full_name, program, year_level)')
          .eq('event_id', eventId)
        if (error) throw error
        return data || []
      }
    : demoGetAttendance,

  markAttendance: SUPABASE_ENABLED
    ? async (eventId, userId) => {
        const { error } = await supabase.from('attendance').upsert({ event_id: eventId, user_id: userId, scanned_at: new Date().toISOString() })
        if (error) throw error
      }
    : demoMarkAttendance,

  /* my attendance history */
  getMyAttendance: SUPABASE_ENABLED
    ? async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return []
        const { data, error } = await supabase
          .from('attendance')
          .select('event_id, scanned_at, events(title, starts_at, location)')
          .eq('user_id', user.id)
          .order('scanned_at', { ascending: false })
        if (error) throw error
        return (data || []).map((r) => ({ event_id: r.event_id, scanned_at: r.scanned_at, ...(r.events || {}) }))
      }
    : async () => {
        const me = demoCurrentUserId() || DEMO_USER_ID
        const rows = []
        for (const [event_id, m] of Object.entries(db.attendance || {})) {
          for (const [user_id, scanned_at] of Object.entries(m || {})) {
            if (user_id === me) {
              const ev = db.events.find((e) => e.id === event_id)
              rows.push({ event_id, scanned_at, title: ev?.title || 'Event', starts_at: ev?.starts_at, location: ev?.location })
            }
          }
        }
        return rows.sort((a, b) => new Date(b.scanned_at) - new Date(a.scanned_at))
      },

  /* attendance tallies per event */
  getAttendanceSummary: SUPABASE_ENABLED
    ? async () => {
        const { data, error } = await supabase.from('attendance').select('event_id, events(title)')
        if (error) throw error
        const counts = {}
        const titles = {}
        for (const r of data || []) {
          counts[r.event_id] = (counts[r.event_id] || 0) + 1
          titles[r.event_id] = r.events?.title
        }
        return Object.entries(counts).map(([event_id, count]) => ({ event_id, count, title: titles[event_id] || 'Event' }))
      }
    : async () =>
        db.events
          .map((e) => ({ event_id: e.id, count: Object.keys(db.attendance[e.id] || {}).length, title: e.title }))
          .filter((t) => t.count > 0),

  getFeeds,
  aiChat,
  PROGRAMS,
}
