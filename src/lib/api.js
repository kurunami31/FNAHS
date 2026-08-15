import { supabase, isSupabase, SUPABASE_ENABLED } from '../supabase'
import { demoDb, DEMO_USER_ID, PROGRAMS, streamMockReply, seedFeeds } from './mock'
import { uid, fmtDateTime } from './format'

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
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href
    // Uploads are client-side resized to data:image URLs (jpeg/png/webp/gif).
    // Cap the payload so a stray huge blob can't bloat the profiles/posts rows.
    if (url.protocol === 'data:' && /^data:image\/(jpeg|png|webp|gif);base64,/i.test(value) && value.length <= 2_500_000) {
      return value
    }
    return null
  } catch {
    return null
  }
}

function eventPostContent(ev) {
  const lines = [`📅 New event: ${sanitizeText(ev.title, 200)}`]
  const when = ev.starts_at ? fmtDateTime(ev.starts_at) : ''
  const until = ev.ends_at && ev.ends_at !== ev.starts_at ? ` → ${fmtDateTime(ev.ends_at)}` : ''
  if (when) lines.push(`🗓 ${when}${until}`)
  if (ev.location) lines.push(`📍 ${sanitizeText(ev.location, 200)}`)
  const desc = sanitizeText(ev.description, 300)
  if (desc) lines.push('', desc)
  return lines.join('\n')
}

function composeFullName({ first_name, middle_initial, surname, full_name }) {
  const first = sanitizeText(first_name, 60)
  const surnameClean = sanitizeText(surname, 60)
  if (first && surnameClean) {
    const mi = sanitizeText(middle_initial, 1).toUpperCase().replace(/\.$/, '')
    return [first, mi ? `${mi}.` : null, surnameClean].filter(Boolean).join(' ')
  }
  return sanitizeText(full_name, 120)
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

/* demo notifications live in their own localStorage list (same shape as the
   Supabase rows) so the bell works without a backend too. */
function demoNotify(rows) {
  const all = JSON.parse(localStorage.getItem('fnahs-demo-notifs') || '[]')
  all.push(...rows)
  localStorage.setItem('fnahs-demo-notifs', JSON.stringify(all))
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
  if (post.likes.includes(me)) {
    post.likes = post.likes.filter((l) => l !== me)
  } else {
    post.likes.push(me)
    if (post.user_id && post.user_id !== me) {
      const liker = db.profiles[me]
      demoNotify([
        {
          id: uid(),
          user_id: post.user_id,
          kind: 'mention',
          title: `${liker?.full_name || 'A member'} liked your post`,
          body: '',
          link: '/app/feed',
          read_at: null,
          created_at: new Date().toISOString(),
        },
      ])
    }
  }
  saveDb(db)
  return post.likes
}

async function demoAddComment(postId, content, imageUrl) {
  const me = demoCurrentUserId() || DEMO_USER_ID
  const post = db.posts.find((p) => p.id === postId)
  if (!post) return
  post.comments.push({ id: uid(), user_id: me, content: sanitizeText(content, 1000), image_url: imageUrl || null, created_at: new Date().toISOString() })
  if (post.user_id && post.user_id !== me) {
    const author = db.profiles[me]
    demoNotify([
      {
        id: uid(),
        user_id: post.user_id,
        kind: 'mention',
        title: `${author?.full_name || 'A member'} commented on your post`,
        body: sanitizeText(content, 120),
        link: '/app/feed',
        read_at: null,
        created_at: new Date().toISOString(),
      },
    ])
  }
  saveDb(db)
  return post.comments
}

async function demoUpdateComment(commentId, content, imageUrl) {
  for (const post of db.posts) {
    const c = post.comments?.find((x) => x.id === commentId)
    if (c) {
      c.content = sanitizeText(content, 1000)
      c.image_url = imageUrl || null
      saveDb(db)
      return c
    }
  }
}

async function demoDeleteComment(commentId) {
  for (const post of db.posts) {
    const before = post.comments?.length || 0
    post.comments = (post.comments || []).filter((c) => c.id !== commentId)
    if (post.comments.length !== before) saveDb(db)
  }
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
  // Announce the event on the community feed too.
  await demoCreatePost({ content: eventPostContent(ev) })
  // Fan out a notification to every member except the creator.
  demoNotify(
    Object.values(db.profiles)
      .filter((p) => p.id !== me)
      .map((p) => ({
        id: uid(),
        user_id: p.id,
        kind: 'event',
        title: `New event: ${ev.title}`,
        body: ev.starts_at ? fmtDateTime(ev.starts_at) : '',
        link: '/app/events',
        read_at: null,
        created_at: new Date().toISOString(),
      }))
  )
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
  const ev = db.events.find((e) => e.id === eventId)
  demoNotify([
    {
      id: uid(),
      user_id: userId,
      kind: 'attendance',
      title: 'Checked in!',
      body: `${ev?.title || 'Your event'} — attendance recorded.`,
      link: '/app/events',
      read_at: null,
      created_at: new Date().toISOString(),
    },
  ])
  saveDb(db)
}

/* ---------------- feeds ---------------- */

let feedCache = null
let feedCacheAt = 0

async function getFeeds() {
  // Memoize for the session so page visits don't refetch every time.
  if (feedCache && Date.now() - feedCacheAt < 15 * 60e3) return feedCache
  const out = { health: seedFeeds().health, tips: seedFeeds().tips, news: seedFeeds().news }
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

/* ---------------- WHO health centre ---------------- */

let whoNewsCache = null
let whoNewsCacheAt = 0

async function getWhoNews() {
  if (whoNewsCache && Date.now() - whoNewsCacheAt < 15 * 60e3) return whoNewsCache
  if (SUPABASE_ENABLED && supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('who-news')
      if (!error && Array.isArray(data?.articles) && data.articles.length) {
        whoNewsCache = data.articles
        whoNewsCacheAt = Date.now()
        return whoNewsCache
      }
      if (error) console.warn('who-news edge function:', error.message || error)
    } catch (e) {
      console.warn('who-news unavailable, using WHO RSS fallback:', e)
    }
  }
  // Fallback: WHO's official RSS headlines (same source the Feed uses).
  const feeds = await getFeeds()
  whoNewsCacheAt = Date.now()
  return (feeds.news || []).map((n) => ({
    title: n.title,
    url: n.url,
    image: null,
    source: 'WHO',
    published_at: n.created_at,
  }))
}

/* ---------------- unified API surface ---------------- */

export const api = {
  get isSupabase() {
    return isSupabase
  },

  get dbStatus() {
    return dbStatus
  },

  /* ---------------- maintenance mode (admin-toggled) ---------------- */
  getMaintenance: SUPABASE_ENABLED
    ? async () => {
        const { data, error } = await supabase.rpc('get_maintenance_mode')
        if (error) throw error
        return !!data
      }
    : async () => localStorage.getItem('fnahs-maintenance') === '1',

  setMaintenance: SUPABASE_ENABLED
    ? async (on) => {
        const { error } = await supabase.rpc('set_maintenance_mode', { p_on: !!on })
        if (error) throw error
      }
    : async (on) => {
        if (on) localStorage.setItem('fnahs-maintenance', '1')
        else localStorage.removeItem('fnahs-maintenance')
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
          .select('id, full_name, surname, first_name, middle_initial, id_no, program, year_level, section, role, positions, avatar_url, created_at, privacy_policy_accepted_at')
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
          full_name: composeFullName(p),
          surname: sanitizeText(p.surname, 60) || null,
          first_name: sanitizeText(p.first_name, 60) || null,
          middle_initial: sanitizeText(p.middle_initial, 1).toUpperCase().replace(/\.$/, '') || null,
          id_no: sanitizeText(p.id_no, 12),
          program: sanitizeText(p.program, 120),
          year_level: sanitizeText(p.year_level, 20),
          section: sanitizeText(p.section, 20),
          avatar_url: sanitizeUrl(p.avatar_url),
        }
        // The profile row always exists (created at signup), and RLS has no
        // INSERT policy — so upsert would be denied. A plain UPDATE is the
        // correct operation here and matches the self-edit policy.
        const { data, error } = await supabase
          .from('profiles')
          .update(patch)
          .eq('id', p.id)
          .select('id, full_name, surname, first_name, middle_initial, id_no, program, year_level, section, role, positions, avatar_url, created_at, privacy_policy_accepted_at')
          .maybeSingle()
        if (error) throw error
        return data
      }
    : async (p) => {
        const clean = { ...p, full_name: composeFullName(p) || sanitizeText(p.full_name, 120), avatar_url: sanitizeUrl(p.avatar_url) }
        db.profiles[p.id] = { ...db.profiles[p.id], ...clean }
        saveDb(db)
        return db.profiles[p.id]
      },

  /* privacy consent — the gate writes only the caller's own row */
  acceptPrivacyPolicy: SUPABASE_ENABLED
    ? async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) throw new Error('You must be signed in.')
        const now = new Date().toISOString()
        const { data, error } = await supabase
          .from('profiles')
          .update({ privacy_policy_accepted_at: now })
          .eq('id', user.id)
          .select('id, privacy_policy_accepted_at')
          .maybeSingle()
        if (error) throw error
        return data
      }
    : async () => {
        const me = demoCurrentUserId()
        if (!me) throw new Error('You must be signed in.')
        await demoUpsertProfile({ id: me, privacy_policy_accepted_at: new Date().toISOString() })
        return { privacy_policy_accepted_at: demoGetProfile(me).privacy_policy_accepted_at }
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

  getArchivedPosts: SUPABASE_ENABLED
    ? async () => {
        const { data, error } = await supabase
          .from('posts')
          .select('*, comments(*), post_likes(user_id), profiles!posts_user_id_fkey(full_name, avatar_url, program)')
          .not('archived_at', 'is', null)
          .order('archived_at', { ascending: false })
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
        const posts = [...db.posts]
          .filter((p) => p.archived_at)
          .sort((a, b) => new Date(b.archived_at) - new Date(a.archived_at))
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
        return (data || []).filter((m) => m.role !== 'superadmin')
      }
    : async () => Object.values(db.profiles).filter((m) => m.role !== 'superadmin'),

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
    ? async (postId, content, imageUrl) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('You must be signed in to comment.')
        const { data, error } = await supabase
          .from('comments')
          .insert({ post_id: postId, user_id: user.id, content: sanitizeText(content, 1000), image_url: imageUrl || null })
          .select()
          .single()
        if (error) throw error
        return data
      }
    : demoAddComment,

  updateComment: SUPABASE_ENABLED
    ? async (commentId, content, imageUrl) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('You must be signed in.')
        const { data, error } = await supabase
          .from('comments')
          .update({ content: sanitizeText(content, 1000), image_url: imageUrl || null })
          .eq('id', commentId)
          .select()
          .single()
        if (error) throw error
        return data
      }
    : demoUpdateComment,

  deleteComment: SUPABASE_ENABLED
    ? async (commentId) => {
        const { error } = await supabase.from('comments').delete().eq('id', commentId)
        if (error) throw error
      }
    : demoDeleteComment,

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
    : async () => Object.values(db.profiles),

  createUser: SUPABASE_ENABLED
    ? async (p) => {
        // Member creation goes through the security-definer create_member()
        // RPC: it creates the auth user (so the new member can actually log
        // in), lets the signup trigger make the profile row, and only then
        // applies the requested role/positions as postgres. A plain insert
        // would be rejected by RLS and could never grant login access.
        const { data: created, error } = await supabase.rpc('create_member', {
          p_email: p.email,
          p_password: p.password,
          p_full_name: p.full_name,
          p_role: p.role || 'student',
          p_positions: p.positions || [],
          p_program: p.program,
          p_year_level: p.year_level,
        })
        if (error) throw error
        return created
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
        if (patch.surname !== undefined) clean.surname = sanitizeText(patch.surname, 60) || null
        if (patch.first_name !== undefined) clean.first_name = sanitizeText(patch.first_name, 60) || null
        if (patch.middle_initial !== undefined) clean.middle_initial = sanitizeText(patch.middle_initial, 1).toUpperCase().replace(/\.$/, '') || null
        if (patch.id_no !== undefined) clean.id_no = sanitizeText(patch.id_no, 12)
        if (patch.surname !== undefined || patch.first_name !== undefined || patch.middle_initial !== undefined) {
          clean.full_name = composeFullName({ ...patch })
        }
        if (patch.full_name !== undefined && patch.surname === undefined && patch.first_name === undefined) {
          clean.full_name = sanitizeText(patch.full_name, 120)
        }
        if (patch.program !== undefined) clean.program = sanitizeText(patch.program, 120)
        if (patch.year_level !== undefined) clean.year_level = sanitizeText(patch.year_level, 20)
        if (patch.avatar_url !== undefined) clean.avatar_url = sanitizeUrl(patch.avatar_url)
        const { data, error } = await supabase
          .from('profiles')
          .update(clean)
          .eq('id', id)
          .select('id, full_name, surname, first_name, middle_initial, id_no, program, year_level, role, positions, avatar_url, created_at, privacy_policy_accepted_at')
          .maybeSingle()
        if (error) throw error
        return data
      }
    : async (id, patch) => {
        db.profiles[id] = { ...db.profiles[id], ...patch }
        saveDb(db)
        return db.profiles[id]
      },

  /* roles + positions go through the superadmin-gated RPCs only
     (client-side role/positions updates are blocked by the guard trigger) */
  changeRole: SUPABASE_ENABLED
    ? async (id, role) => {
        const { error } = await supabase.rpc('change_role', { p_target: id, p_new_role: role })
        if (error) throw error
      }
    : async (id, role) => {
        db.profiles[id] = { ...db.profiles[id], role }
        saveDb(db)
      },

  setPositions: SUPABASE_ENABLED
    ? async (id, positions) => {
        const { error } = await supabase.rpc('set_positions', { p_target: id, p_positions: positions })
        if (error) throw error
      }
    : async (id, positions) => {
        db.profiles[id] = { ...db.profiles[id], positions }
        saveDb(db)
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

  /* all events — past included (admin console needs to manage old events) */
  getAllEvents: SUPABASE_ENABLED
    ? async () => {
        const { data, error } = await supabase
          .from('events')
          .select('*, rsvps(*)')
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
    : async () => {
        const evs = await demoGetEvents()
        return evs.map((e) => ({ ...e, rsvps: e.rsvps || {} }))
      },

  createEvent: SUPABASE_ENABLED
    ? async (ev) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('You must be signed in.')
        // RLS requires auth.uid() = created_by, so the creator must be recorded.
        const { data, error } = await supabase
          .from('events')
          .insert({
            title: sanitizeText(ev.title, 200),
            description: sanitizeText(ev.description, 2000),
            location: sanitizeText(ev.location, 200),
            starts_at: ev.starts_at,
            ends_at: ev.ends_at,
            created_by: user.id,
          })
          .select()
          .single()
        if (error) throw error
        // Announce the event on the community feed. A feed-post failure must
        // not fail the event itself — the event is already created by now.
        try {
          await supabase
            .from('posts')
            .insert({ user_id: user.id, content: eventPostContent(ev) })
        } catch (e) {
          console.warn('Could not announce event on the feed:', e)
        }
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
  getWhoNews,
  aiChat,

  /* ---------------- announcements (announcer-gated by RLS) ---------------- */
  getAnnouncements: SUPABASE_ENABLED
    ? async () => {
        const { data, error } = await supabase
          .from('announcements')
          .select('*, profiles!announcements_author_id_fkey(full_name, avatar_url)')
          .is('archived_at', null)
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false })
        if (error) {
          markDbError(error)
          throw error
        }
        setDbStatus('ok')
        return data || []
      }
    : async () => {
        const list = JSON.parse(localStorage.getItem('fnahs-demo-announcements') || '[]')
        return list.sort((a, b) => (b.pinned - a.pinned) || (new Date(b.created_at) - new Date(a.created_at)))
      },

  createAnnouncement: SUPABASE_ENABLED
    ? async ({ title, body, pinned }) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('You must be signed in.')
        const { data, error } = await supabase
          .from('announcements')
          .insert({ title: sanitizeText(title, 200), body: sanitizeText(body, 2000), pinned: !!pinned, author_id: user.id })
          .select('*, profiles!announcements_author_id_fkey(full_name, avatar_url)')
          .single()
        if (error) throw error
        return data
      }
    : async ({ title, body, pinned }) => {
        const me = db.profiles[demoCurrentUserId()] || db.profiles[DEMO_USER_ID]
        const list = JSON.parse(localStorage.getItem('fnahs-demo-announcements') || '[]')
        const row = { id: uid(), title, body, pinned: !!pinned, author_id: me?.id, created_at: new Date().toISOString(), profiles: { full_name: me?.full_name || 'FNAHS', avatar_url: me?.avatar_url || null } }
        list.unshift(row)
        localStorage.setItem('fnahs-demo-announcements', JSON.stringify(list))
        return row
      },

  updateAnnouncement: SUPABASE_ENABLED
    ? async (id, patch) => {
        const clean = {}
        if (patch.title !== undefined) clean.title = sanitizeText(patch.title, 200)
        if (patch.body !== undefined) clean.body = sanitizeText(patch.body, 2000)
        if (patch.pinned !== undefined) clean.pinned = !!patch.pinned
        if (patch.archived_at !== undefined) clean.archived_at = patch.archived_at
        const { error } = await supabase.from('announcements').update(clean).eq('id', id)
        if (error) throw error
      }
    : async (id, patch) => {
        const list = JSON.parse(localStorage.getItem('fnahs-demo-announcements') || '[]')
        const row = list.find((a) => a.id === id)
        if (row) Object.assign(row, patch)
        localStorage.setItem('fnahs-demo-announcements', JSON.stringify(list))
      },

  deleteAnnouncement: SUPABASE_ENABLED
    ? async (id) => {
        const { error } = await supabase.from('announcements').delete().eq('id', id)
        if (error) throw error
      }
    : async (id) => {
        const list = JSON.parse(localStorage.getItem('fnahs-demo-announcements') || '[]')
        localStorage.setItem('fnahs-demo-announcements', JSON.stringify(list.filter((a) => a.id !== id)))
      },

  /* ---------------- notifications (own rows only) ---------------- */
  getNotifications: SUPABASE_ENABLED
    ? async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { list: [], unread: 0 }
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30)
        if (error) {
          markDbError(error)
          return { list: [], unread: 0 }
        }
        return { list: data || [], unread: (data || []).filter((n) => !n.read_at).length }
      }
    : async () => {
        const me = demoCurrentUserId()
        const all = JSON.parse(localStorage.getItem('fnahs-demo-notifs') || '[]')
        const list = all.filter((n) => n.user_id === me).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 30)
        return { list, unread: list.filter((n) => !n.read_at).length }
      },

  markNotificationRead: SUPABASE_ENABLED
    ? async (id) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id)
      }
    : async (id) => {
        const all = JSON.parse(localStorage.getItem('fnahs-demo-notifs') || '[]')
        const n = all.find((x) => x.id === id)
        if (n) n.read_at = new Date().toISOString()
        localStorage.setItem('fnahs-demo-notifs', JSON.stringify(all))
      },

  markAllNotificationsRead: SUPABASE_ENABLED
    ? async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null)
      }
    : async () => {
        const me = demoCurrentUserId()
        if (!me) return
        const all = JSON.parse(localStorage.getItem('fnahs-demo-notifs') || '[]')
        const now = new Date().toISOString()
        all.forEach((n) => {
          if (n.user_id === me && !n.read_at) n.read_at = now
        })
        localStorage.setItem('fnahs-demo-notifs', JSON.stringify(all))
      },

  /* ---------------- event polls ---------------- */
  getPolls: SUPABASE_ENABLED
    ? async (eventId) => {
        const { data, error } = await supabase
          .from('event_polls')
          .select('*, poll_options(*, poll_votes(user_id))')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true })
        if (error) {
          markDbError(error)
          throw error
        }
        return (data || []).map((p) => ({
          ...p,
          options: (p.poll_options || []).map((o) => ({
            ...o,
            votes: (o.poll_votes || []).map((v) => v.user_id),
          })),
        }))
      }
    : async (eventId) => {
        const all = JSON.parse(localStorage.getItem('fnahs-demo-polls') || '[]')
        return all.filter((p) => p.event_id === eventId)
      },

  createPoll: SUPABASE_ENABLED
    ? async (eventId, question, optionLabels) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('You must be signed in.')
        const { data: poll, error: pe } = await supabase
          .from('event_polls')
          .insert({ event_id: eventId, question: sanitizeText(question, 300), created_by: user.id })
          .select()
          .single()
        if (pe) throw pe
        const labels = (optionLabels || []).map((l) => sanitizeText(l, 120)).filter(Boolean)
        if (labels.length) {
          const { error: oe } = await supabase
            .from('poll_options')
            .insert(labels.map((label) => ({ poll_id: poll.id, label })))
          if (oe) throw oe
        }
        return poll
      }
    : async (eventId, question, optionLabels) => {
        const me = demoCurrentUserId() || DEMO_USER_ID
        const all = JSON.parse(localStorage.getItem('fnahs-demo-polls') || '[]')
        const poll = { id: uid(), event_id: eventId, question, created_by: me, created_at: new Date().toISOString(), options: optionLabels.map((label) => ({ id: uid(), label, votes: [] })) }
        all.push(poll)
        localStorage.setItem('fnahs-demo-polls', JSON.stringify(all))
        return poll
      },

  castVote: SUPABASE_ENABLED
    ? async (pollId, optionId) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('You must be signed in.')
        const { error } = await supabase
          .from('poll_votes')
          .upsert({ poll_id: pollId, option_id: optionId, user_id: user.id }, { onConflict: 'poll_id,user_id' })
        if (error) throw error
      }
    : async (pollId, optionId) => {
        const me = demoCurrentUserId() || DEMO_USER_ID
        const all = JSON.parse(localStorage.getItem('fnahs-demo-polls') || '[]')
        const poll = all.find((p) => p.id === pollId)
        if (poll) {
          poll.options.forEach((o) => (o.votes = o.votes.filter((v) => v !== me)))
          poll.options.find((o) => o.id === optionId)?.votes.push(me)
        }
        localStorage.setItem('fnahs-demo-polls', JSON.stringify(all))
      },

  /* ---------------- Florence chat history (own messages) ---------------- */
  getChatHistory: SUPABASE_ENABLED
    ? async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return []
        const { data, error } = await supabase
          .from('chat_messages')
          .select('role, content, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(40)
        if (error) {
          markDbError(error)
          return []
        }
        return data || []
      }
    : async () => {
        const me = demoCurrentUserId()
        const all = JSON.parse(localStorage.getItem('fnahs-demo-chat') || '{}')
        return (all[me] || []).slice(-40)
      },

  saveChatMessage: SUPABASE_ENABLED
    ? async (role, content) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('chat_messages').insert({ user_id: user.id, role, content: String(content || '').slice(0, 12000) })
      }
    : async (role, content) => {
        const me = demoCurrentUserId()
        if (!me) return
        const all = JSON.parse(localStorage.getItem('fnahs-demo-chat') || '{}')
        const list = all[me] || []
        list.push({ role, content, created_at: new Date().toISOString() })
        all[me] = list.slice(-100)
        localStorage.setItem('fnahs-demo-chat', JSON.stringify(all))
      },

  PROGRAMS,
}
