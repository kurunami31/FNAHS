import { supabase, isSupabase, SUPABASE_ENABLED } from '../supabase'
import { demoDb, DEMO_USER_ID, DEMO_STAFF_ID, PROGRAMS, streamMockReply, seedFeeds, seedAnnouncements } from './mock'
import { offlineRead, offlineWrite, isOfflineError, cacheSession, restoreSession, clearSessionCache } from './offline'
import { uid, fmtDateTime } from './format'

/* ---------------- input guards ---------------- */

const MAX_TEXT = 4000

function sanitizeText(value, max = MAX_TEXT) {
  // eslint-disable-next-line no-control-regex
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

/* plain-text body for the announcement mirror of an event */
function eventAnnouncementBody(ev) {
  const lines = []
  const when = ev.starts_at ? fmtDateTime(ev.starts_at) : ''
  const until = ev.ends_at && ev.ends_at !== ev.starts_at ? ` → ${fmtDateTime(ev.ends_at)}` : ''
  if (when) lines.push(`When: ${when}${until}`)
  if (ev.location) lines.push(`Where: ${sanitizeText(ev.location, 200)}`)
  const desc = sanitizeText(ev.description, 2000)
  if (desc) lines.push(desc)
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
/* Keep the offline mirror comfortably inside localStorage's ~5MB quota so
   Supabase's own auth-token write (sb-<ref>-auth-token) always has room.
   The mirror is just an offline cache — overflow is trimmed to the most
   recent/important rows instead of being allowed to fill the whole quota. */
const DB_MAX_BYTES = 1_500_000

function pruneDb(db) {
  for (const p of Object.values(db.profiles || {})) {
    if (p.avatar_url) p.avatar_url = null
  }
  if (Array.isArray(db.posts) && db.posts.length > 120) db.posts = db.posts.slice(0, 120)
  if (Array.isArray(db.events) && db.events.length > 120) db.events = db.events.slice(0, 120)
  if (Array.isArray(db.eventPayments) && db.eventPayments.length > 900) db.eventPayments = db.eventPayments.slice(-900)
  if (Array.isArray(db.feePayments) && db.feePayments.length > 900) db.feePayments = db.feePayments.slice(-900)
  if (Array.isArray(db.clearanceForms) && db.clearanceForms.length > 400) db.clearanceForms = db.clearanceForms.slice(-400)
  if (Array.isArray(db.classSessions) && db.classSessions.length > 200) db.classSessions = db.classSessions.slice(-200)
}

function loadDb() {
  try {
    const raw = localStorage.getItem(LS_KEY) || localStorage.getItem('fnahs-codex-db-v2')
    if (raw) {
      const db = JSON.parse(raw)
      // lazily merge missing seeds on schema bumps
      const fresh = demoDb()
      const merged = {
        profiles: { ...fresh.profiles, ...(db.profiles || {}) },
        posts: db.posts?.length ? db.posts : fresh.posts,
        events: db.events?.length ? db.events : fresh.events,
        feeds: db.feeds || fresh.feeds,
        attendance: db.attendance || {},
        subjects: db.subjects || [],
        classSessions: db.classSessions || [],
        classAttendance: db.classAttendance || {},
        membershipFees: db.membershipFees || {},
        feePayments: db.feePayments || [],
        eventPayments: db.eventPayments || [],
        clearanceForms: db.clearanceForms || [],
      }
      // trim a mirror that already blew past the cap (e.g. pre-fix devices)
      if (JSON.stringify(merged).length > DB_MAX_BYTES) {
        pruneDb(merged)
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(merged))
        } catch {
          /* ignore */
        }
      }
      return merged
    }
  } catch {
    /* ignore corrupt storage */
  }
  return demoDb()
}

function saveDb(db) {
  let json = JSON.stringify(db)
  if (json.length > DB_MAX_BYTES) {
    pruneDb(db)
    json = JSON.stringify(db)
  }
  try {
    localStorage.setItem(LS_KEY, json)
  } catch {
    try {
      pruneDb(db)
      localStorage.setItem(LS_KEY, JSON.stringify(db))
    } catch {
      /* storage still full / private mode — mirror lives in memory only */
    }
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    // quota full — drop the app's replaceable demo caches, then retry once
    for (const k of ['fnahs-demo-chat', 'fnahs-demo-polls', 'fnahs-demo-notifs', 'fnahs-demo-announcements']) {
      if (k === key) continue
      try {
        localStorage.removeItem(k)
      } catch {
        /* ignore */
      }
    }
    try {
      localStorage.setItem(key, value)
      return true
    } catch {
      return false
    }
  }
}

const db = loadDb()

/* ---------------- demo auth ---------------- */

const ADMIN_PASSWORD = 'dorsufnahs2026'

function demoLogin(id) {
  safeSet('fnahs-user', id)
}

function demoLogout() {
  localStorage.removeItem('fnahs-user')
  localStorage.removeItem('fnahs-codex-user')
}

function demoCurrentUserId() {
  return localStorage.getItem('fnahs-user') || localStorage.getItem('fnahs-codex-user') || null
}

/* ---- egress control ----
   get_directory ships every member's base64 avatar (~9 MB and growing),
   so cache the result briefly instead of re-downloading it on each
   directory/search mount. Invalidated whenever a profile changes. */
const MEMBERS_CACHE_TTL = 5 * 60 * 1000
let membersCache = null
let membersCacheAt = 0
function invalidateMembersCache() {
  membersCache = null
  membersCacheAt = 0
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
  safeSet('fnahs-demo-notifs', JSON.stringify(all))
}

/* Mirrors the is_directory_viewer() SQL helper — demo mode only. */
const CONSOLE_POSITIONS = ['governor', 'v-governor', 'secretary', 'treasurer', 'auditor', 'business-manager']

function demoCanViewDirectory() {
  const me = demoCurrentUserId() ? db.profiles[demoCurrentUserId()] : null
  if (!me) return false
  if (me.role === 'superadmin' || me.role === 'moderator') return true
  return (me.positions || []).some((p) => CONSOLE_POSITIONS.includes(p))
}

/* ---------------- posts ---------------- */

const FEED_PAGE = 60

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

async function demoAddComment(postId, content, imageUrl, parentId) {
  const me = demoCurrentUserId() || DEMO_USER_ID
  const post = db.posts.find((p) => p.id === postId)
  if (!post) return
  post.comments.push({ id: uid(), user_id: me, parent_id: parentId || null, content: sanitizeText(content, 1000), image_url: imageUrl || null, created_at: new Date().toISOString() })
  const notes = []
  if (post.user_id && post.user_id !== me) {
    const author = db.profiles[me]
    notes.push({
      id: uid(),
      user_id: post.user_id,
      kind: 'mention',
      title: `${author?.full_name || 'A member'} commented on your post`,
      body: sanitizeText(content, 120),
      link: '/app/feed',
      read_at: null,
      created_at: new Date().toISOString(),
    })
  }
  if (parentId) {
    const parent = post.comments.find((c) => c.id === parentId)
    if (parent && parent.user_id && parent.user_id !== me) {
      const author = db.profiles[me]
      notes.push({
        id: uid(),
        user_id: parent.user_id,
        kind: 'mention',
        title: `${author?.full_name || 'A member'} replied to your comment`,
        body: sanitizeText(content, 120),
        link: '/app/feed',
        read_at: null,
        created_at: new Date().toISOString(),
      })
    }
  }
  if (notes.length) demoNotify(notes)
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

async function demoUnarchivePost(postId) {
  const post = db.posts.find((p) => p.id === postId)
  if (!post) return
  post.archived_at = null
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
  // Mirror it onto the announcements board as well.
  try {
    const meProfile = db.profiles[me] || {}
    const annList = JSON.parse(localStorage.getItem('fnahs-demo-announcements') || '[]')
    annList.unshift({
      id: uid(),
      title: sanitizeText(ev.title, 200),
      body: eventAnnouncementBody(ev),
      pinned: false,
      author_id: me,
      created_at: new Date().toISOString(),
      profiles: { full_name: meProfile.full_name || 'FNAHS', avatar_url: meProfile.avatar_url || null },
    })
    localStorage.setItem('fnahs-demo-announcements', JSON.stringify(annList))
  } catch (e) {
    console.warn('Could not mirror event onto announcements:', e)
  }
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

async function demoRemoveAttendance(eventId, userId) {
  delete (db.attendance[eventId] || {})[userId]
  saveDb(db)
}

/* ---------------- class attendance (demo twins) ---------------- */

async function demoGetMySubjects() {
  const me = demoCurrentUserId() || DEMO_USER_ID
  return (db.subjects || []).filter((s) => s.faculty_id === me)
}

async function demoAddSubject(name) {
  const me = demoCurrentUserId() || DEMO_USER_ID
  const row = { id: uid(), faculty_id: me, name: sanitizeText(name, 60), created_at: new Date().toISOString() }
  db.subjects = [...(db.subjects || []), row]
  saveDb(db)
  return row
}

async function demoRemoveSubject(id) {
  db.subjects = (db.subjects || []).filter((s) => s.id !== id)
  db.classSessions = (db.classSessions || []).filter((s) => s.subject_id !== id)
  for (const s of db.classSessions) delete db.classAttendance[s.id]
  saveDb(db)
}

async function demoStartSession(subjectId) {
  const me = demoCurrentUserId() || DEMO_USER_ID
  const row = { id: uid(), subject_id: subjectId, faculty_id: me, started_at: new Date().toISOString(), ended_at: null }
  db.classSessions = [...(db.classSessions || []), row]
  saveDb(db)
  return row
}

async function demoEndSession(sessionId) {
  const s = (db.classSessions || []).find((x) => x.id === sessionId)
  if (s) {
    s.ended_at = new Date().toISOString()
    saveDb(db)
  }
}

async function demoGetSessions() {
  const me = demoCurrentUserId() || DEMO_USER_ID
  return (db.classSessions || [])
    .filter((s) => s.faculty_id === me)
    .map((s) => ({
      ...s,
      subject: (db.subjects || []).find((x) => x.id === s.subject_id) || null,
      attendance_count: Object.keys(db.classAttendance[s.id] || {}).length,
    }))
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
}

async function demoGetSessionAttendance(sessionId) {
  return Object.entries(db.classAttendance[sessionId] || {}).map(([user_id, scanned_at]) => ({ user_id, scanned_at }))
}

async function demoMarkClassAttendance(sessionId, userId) {
  db.classAttendance[sessionId] = db.classAttendance[sessionId] || {}
  db.classAttendance[sessionId][userId] = new Date().toISOString()
  const s = (db.classSessions || []).find((x) => x.id === sessionId)
  const sub = (db.subjects || []).find((x) => x.id === s?.subject_id)
  demoNotify([
    {
      id: uid(),
      user_id: userId,
      kind: 'attendance',
      title: 'Present!',
      body: `${sub?.name || 'Class'} — attendance recorded.`,
      link: '/app/id',
      read_at: null,
      created_at: new Date().toISOString(),
    },
  ])
  saveDb(db)
}

async function demoRemoveClassAttendance(sessionId, userId) {
  delete (db.classAttendance[sessionId] || {})[userId]
  saveDb(db)
}

async function demoMarkMyClassAttendance(sessionId) {
  const me = demoCurrentUserId() || DEMO_USER_ID
  const s = (db.classSessions || []).find((x) => x.id === sessionId)
  if (!s || s.ended_at) throw new Error('Class session not found or already ended')
  db.classAttendance[sessionId] = db.classAttendance[sessionId] || {}
  db.classAttendance[sessionId][me] = new Date().toISOString()
  const sub = (db.subjects || []).find((x) => x.id === s.subject_id)
  demoNotify([
    {
      id: uid(),
      user_id: me,
      kind: 'attendance',
      title: 'Present!',
      body: `${sub?.name || 'Class'} — attendance recorded.`,
      link: '/app/id',
      read_at: null,
      created_at: new Date().toISOString(),
    },
  ])
  saveDb(db)
}

async function demoGetMyClassAttendance() {
  const me = demoCurrentUserId() || DEMO_USER_ID
  const rows = []
  for (const [sessionId, m] of Object.entries(db.classAttendance || {})) {
    for (const [userId, scanned_at] of Object.entries(m || {})) {
      if (userId === me) {
        const s = (db.classSessions || []).find((x) => x.id === sessionId)
        const sub = (db.subjects || []).find((x) => x.id === s?.subject_id)
        rows.push({
          session_id: sessionId,
          subject_id: s?.subject_id,
          subject_name: sub?.name || 'Class',
          started_at: s?.started_at,
          scanned_at,
        })
      }
    }
  }
  return rows.sort((a, b) => new Date(b.scanned_at) - new Date(a.scanned_at))
}

/* ---------------- rotational clearance (demo twins) ---------------- */

function demoFindClearanceRow(rowId) {
  for (const f of db.clearanceForms || []) {
    const row = (f.rows || []).find((r) => r.id === rowId)
    if (row) return { form: f, row }
  }
  return { form: null, row: null }
}

async function demoGetClearanceForms(studentId) {
  const p = db.profiles[studentId]
  if (p && p.year_level === '1') return []
  return (db.clearanceForms || [])
    .filter((f) => f.member_id === studentId)
    .map((f) => ({ ...f, rows: [...(f.rows || [])] }))
    .sort((a, b) => a.school_year.localeCompare(b.school_year) || a.semester.localeCompare(b.semester))
}

async function demoSearchStudents(q) {
  if (!demoIsClearanceViewer()) throw new Error('Only Clinical Instructors or the administrator may search students.')
  const needle = (q || '').trim().toLowerCase()
  if (!needle) return []
  return Object.values(db.profiles)
    .filter((p) => p.role === 'student' && p.year_level !== '1')
    .filter((p) => [p.full_name, p.id_no, p.email].some((v) => (v ? String(v).toLowerCase().includes(needle) : false)))
    .slice(0, 20)
    .map((p) => ({ id: p.id, full_name: p.full_name, id_no: p.id_no, program: p.program, year_level: p.year_level, section: p.section, avatar_url: p.avatar_url, role: p.role }))
}

async function demoGetPopulationBreakdown() {
  const counts = {}
  for (const p of Object.values(db.profiles)) {
    if (p.role !== 'student') continue
    const y = p.year_level || '—'
    counts[y] = (counts[y] || 0) + 1
  }
  const order = { 1: 1, 2: 2, 3: 3, 4: 4 }
  return Object.entries(counts)
    .map(([year_level, count]) => ({ year_level, count }))
    .sort((a, b) => (order[a.year_level] || 5) - (order[b.year_level] || 5))
}

/* Mirrors the SQL is_clearance_officer() gate for offline mutations —
   students (and clearance-locked accounts) must not be able to
   edit/delete clearance even locally. */
function demoIsClearanceOfficer() {
  const me = demoCurrentUserId()
  const p = me ? db.profiles[me] : null
  if (!p || p.clearance_locked) return false
  return p.role === 'faculty' || p.role === 'superadmin'
}

/* Mirrors is_clearance_viewer() — faculty/superadmin may view, search and
   scan clearance even when clearance_locked (read-only access). */
function demoIsClearanceViewer() {
  const me = demoCurrentUserId()
  const p = me ? db.profiles[me] : null
  if (!p) return false
  return p.role === 'faculty' || p.role === 'superadmin'
}

function demoRequireClearanceOfficer() {
  if (!demoIsClearanceOfficer()) throw new Error('Only Clinical Instructors or the administrator may edit or delete clearance records.')
}

async function demoCreateClearanceForm(studentId, { school_year, semester, placement }) {
  demoRequireClearanceOfficer()
  const form = {
    id: uid(),
    member_id: studentId,
    school_year,
    semester,
    placement: sanitizeText(placement, 200),
    created_by: demoCurrentUserId() || null,
    created_at: new Date().toISOString(),
    rows: [],
  }
  db.clearanceForms = [...(db.clearanceForms || []).filter((f) => !(f.member_id === studentId && f.school_year === school_year && f.semester === semester)), form]
  saveDb(db)
  return form
}

async function demoAddClearanceRow(formId, { dates, concept, hours, agency }) {
  demoRequireClearanceOfficer()
  const form = (db.clearanceForms || []).find((f) => f.id === formId)
  if (!form) throw new Error('Clearance form not found')
  const row = {
    id: uid(),
    form_id: formId,
    dates: sanitizeText(dates, 200),
    concept: sanitizeText(concept, 200),
    hours: Number(hours) || 0,
    agency: sanitizeText(agency, 200) || null,
    cleared_at: null,
    remark: null,
    demerit: null,
    days_extension: null,
    merit: 0,
    recorded_by: null,
    recorded_by_name: null,
    created_by: demoCurrentUserId() || null,
    updated_by: null,
    updated_by_name: null,
    created_at: new Date().toISOString(),
  }
  form.rows = [...(form.rows || []), row]
  saveDb(db)
  demoNotify([
    {
      id: uid(),
      user_id: form.member_id,
      kind: 'clearance',
      title: `New rotation row - ${form.placement || 'your rotation'}`,
      body: `${row.concept} - ${row.dates}`,
      link: '/app/idcard',
      read_at: null,
      created_at: new Date().toISOString(),
    },
  ])
  return row
}

async function demoClearClearanceRow(rowId) {
  demoRequireClearanceOfficer()
  const me = demoCurrentUserId()
  const { form, row } = demoFindClearanceRow(rowId)
  if (!row) throw new Error('Clearance row not found')
  row.cleared_at = new Date().toISOString()
  row.recorded_by = me || null
  row.recorded_by_name = db.profiles[me]?.full_name || null
  saveDb(db)
  if (form) {
    demoNotify([
      {
        id: uid(),
        user_id: form.member_id,
        kind: 'clearance',
        title: `Clearance signed - ${form.placement || 'your rotation'}`,
        body: `${row.concept} - ${row.dates}`,
        link: '/app/idcard',
        read_at: null,
        created_at: new Date().toISOString(),
      },
    ])
  }
  return row
}

async function demoUpdateClearanceRow(rowId, patch) {
  demoRequireClearanceOfficer()
  const me = demoCurrentUserId()
  const { row } = demoFindClearanceRow(rowId)
  if (!row) throw new Error('Clearance row not found')
  if (patch.dates !== undefined) row.dates = sanitizeText(patch.dates, 200)
  if (patch.concept !== undefined) row.concept = sanitizeText(patch.concept, 200)
  if (patch.hours !== undefined) row.hours = Number(patch.hours) || 0
  if (patch.agency !== undefined) row.agency = sanitizeText(patch.agency, 200) || null
  if (patch.remark !== undefined) row.remark = patch.remark || null
  if (patch.demerit !== undefined) row.demerit = patch.demerit || null
  if (patch.days_extension !== undefined) row.days_extension = patch.days_extension || null
  if (patch.merit !== undefined) row.merit = Math.max(0, Number(patch.merit) || 0)
  row.updated_by = me || null
  row.updated_by_name = db.profiles[me]?.full_name || null
  row.updated_at = new Date().toISOString()
  saveDb(db)
  return row
}

async function demoUpdateClearanceForm(formId, { placement }) {
  demoRequireClearanceOfficer()
  const form = (db.clearanceForms || []).find((f) => f.id === formId)
  if (!form) throw new Error('Clearance form not found')
  form.placement = sanitizeText(placement, 200)
  saveDb(db)
  return form
}

async function demoDeleteClearanceForm(formId) {
  demoRequireClearanceOfficer()
  db.clearanceForms = (db.clearanceForms || []).filter((f) => f.id !== formId)
  saveDb(db)
}

async function demoDeleteClearanceRow(rowId) {
  demoRequireClearanceOfficer()
  for (const f of db.clearanceForms || []) {
    const before = f.rows?.length || 0
    f.rows = (f.rows || []).filter((r) => r.id !== rowId)
    if (f.rows.length !== before) saveDb(db)
  }
}

/* ---------------- offline mirrors: supabase data → demo store ----------------
   Every successful Supabase read runs its mirror so the demo twins below can
   serve the user's REAL data while offline. */
function mirrorProfileInto(p) {
  if (!p?.id) return
  db.profiles[p.id] = { ...db.profiles[p.id], ...p }
  saveDb(db)
}
function mirrorProfiles(list) {
  ;(list || []).forEach(mirrorProfileInto)
}
function mirrorPosts(posts) {
  const mapped = (posts || []).map((p) => ({
    id: p.id,
    user_id: p.user_id,
    content: p.content,
    image_url: p.image_url || null,
    archived_at: p.archived_at || null,
    created_at: p.created_at,
    likes: (p.likes || p.post_likes || [])
      .map((l) => (typeof l === 'string' ? l : l?.user_id))
      .filter(Boolean),
    comments: (p.comments || []).map((c) => ({
      id: c.id,
      user_id: c.user_id,
      parent_id: c.parent_id || null,
      content: c.content,
      image_url: c.image_url || null,
      created_at: c.created_at,
    })),
  }))
  db.posts = [...mapped, ...db.posts.filter((d) => !mapped.some((m) => m.id === d.id))]
  saveDb(db)
}
function mirrorEvents(events) {
  const mapped = (events || []).map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description || '',
    location: e.location || '',
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    fee_amount: Number(e.fee_amount) || 0,
    created_by: e.created_by,
    created_at: e.created_at,
    rsvps: e.rsvps || {},
  }))
  db.events = [...mapped, ...db.events.filter((d) => !mapped.some((m) => m.id === d.id))]
  saveDb(db)
}
function mirrorEventPayments(rows) {
  const mapped = (rows || []).map((r) => ({
    id: r.id,
    event_id: r.event_id,
    member_id: r.member_id,
    amount: r.amount,
    paid_at: r.paid_at,
    recorded_by: r.recorded_by || null,
    created_at: r.created_at,
  }))
  db.eventPayments = [...mapped, ...db.eventPayments.filter((d) => !mapped.some((m) => m.id === d.id))]
  for (const r of rows || []) {
    if (r.profiles) mirrorProfileInto(r.profiles)
  }
  saveDb(db)
}
function mirrorFeePayments(rows) {
  const mapped = (rows || []).map((r) => ({
    id: r.id,
    member_id: r.member_id,
    school_year: r.school_year,
    payment_type: r.payment_type,
    amount: r.amount,
    receipt: r.receipt || null,
    paid_at: r.paid_at,
    recorded_by: r.recorded_by || null,
    created_at: r.created_at,
  }))
  db.feePayments = [...mapped, ...db.feePayments.filter((d) => !mapped.some((m) => m.id === d.id))]
  for (const r of rows || []) {
    if (r.profiles) mirrorProfileInto(r.profiles)
  }
  saveDb(db)
}
function mirrorClearanceForms(forms) {
  const mapped = (forms || []).map((f) => ({
    id: f.id,
    member_id: f.member_id,
    school_year: f.school_year,
    semester: f.semester,
    placement: f.placement,
    created_by: f.created_by,
    created_at: f.created_at,
    rows: (f.rows || []).map((r) => ({
      id: r.id,
      form_id: r.form_id,
      dates: r.dates,
      concept: r.concept,
      hours: Number(r.hours) || 0,
      agency: r.agency || null,
      cleared_at: r.cleared_at || null,
      remark: r.remark || null,
      demerit: r.demerit || null,
      days_extension: r.days_extension || null,
      merit: Number(r.merit) || 0,
      recorded_by: r.recorded_by || null,
      recorded_by_name: r.recorded_by_name || null,
      created_by: r.created_by || null,
      updated_by: r.updated_by || null,
      updated_by_name: r.updated_by_name || null,
      created_at: r.created_at,
    })),
  }))
  db.clearanceForms = [...mapped, ...(db.clearanceForms || []).filter((d) => !mapped.some((m) => m.id === d.id))]
  saveDb(db)
}
function mirrorAnnouncements(list) {
  const mapped = (list || []).map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    pinned: !!a.pinned,
    author_id: a.author_id,
    created_at: a.created_at,
    profiles: a.profiles || null,
  }))
  localStorage.setItem('fnahs-demo-announcements', JSON.stringify(mapped))
}
function mirrorNotifications(data) {
  const rows = data?.list || []
  const local = JSON.parse(localStorage.getItem('fnahs-demo-notifs') || '[]')
  localStorage.setItem('fnahs-demo-notifs', JSON.stringify([...rows, ...local.filter((n) => !rows.some((r) => r.id === n.id))]))
}
function mirrorPolls(polls) {
  const all = JSON.parse(localStorage.getItem('fnahs-demo-polls') || '[]')
  const mapped = (polls || []).map((p) => ({
    id: p.id,
    event_id: p.event_id,
    question: p.question,
    created_by: p.created_by,
    created_at: p.created_at,
    options: (p.options || []).map((o) => ({ id: o.id, label: o.label, votes: o.votes || [] })),
  }))
  localStorage.setItem('fnahs-demo-polls', JSON.stringify([...mapped, ...all.filter((p) => !mapped.some((m) => m.id === p.id))]))
}
function mirrorChat(rows) {
  const me = demoCurrentUserId()
  if (!me) return
  const all = JSON.parse(localStorage.getItem('fnahs-demo-chat') || '{}')
  all[me] = (rows || []).map((r) => ({ role: r.role, content: r.content, created_at: r.created_at }))
  localStorage.setItem('fnahs-demo-chat', JSON.stringify(all))
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
    return supabase.auth.getSession().then(async ({ data }) => {
      const session = data?.session
      if (!session?.user) return { user: null }
      try {
        // An aal1 session left behind by an abandoned MFA sign-in must not
        // restore as a login — sign out so the challenge step runs again.
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
          await supabase.auth.signOut()
          return { user: null }
        }
        const profile = await api.getProfile(session.user.id)
        if (!profile) throw new Error('profile not found')
        const user = { ...profile, id: session.user.id, email: profile.email || session.user.email }
        await cacheSession(user)
        return { user }
      } catch (e) {
        // Offline: fall back to the cached session so the app opens straight
        // into the dashboard with the last-known profile.
        if (isOfflineError(e) || typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await restoreSession()
          if (cached) return { user: cached }
        }
        return { user: null }
      }
    })
  },

  async signIn(email, password) {
    const lock = api.loginLockRemaining(email)
    if (lock > 0) {
      throw new Error(`Too many attempts — try again in ${lock}s.`)
    }
    if (!SUPABASE_ENABLED) {
      // match by email so staff@fnahs.edu.ph maps to the staff account
      const found = Object.values(db.profiles).find((p) => p.email.toLowerCase() === email.toLowerCase())
      if (found && found.role === 'superadmin' && password !== ADMIN_PASSWORD) {
        api.loginFail(email)
        throw new Error('Incorrect admin password — see the README.')
      }
      if (!found) {
        // any other demo email works; create on the fly
        const id = uid()
        const p = { id, full_name: email.split('@')[0], email, program: PROGRAMS[0], year_level: '1', role: 'student', avatar_url: null, created_at: new Date().toISOString() }
        await demoUpsertProfile(p)
        demoLogin(id)
        api.loginSuccess(email)
        return { user: p }
      }
      demoLogin(found.id)
      api.loginSuccess(email)
      return { user: found }
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        api.loginFail(email)
        throw error
      }
      api.loginSuccess(email)
      // MFA enrolled on this account? Newer GoTrue keeps the session at aal1
      // and lists the verified factor on the user object; older builds returned
      // factor_id instead. The caller must complete a TOTP challenge either way.
      const mfaFactorId = data.factor_id || data.user?.factors?.find((f) => f.status === 'verified')?.id
      if (mfaFactorId) {
        return { mfa: { factorId: mfaFactorId } }
      }
      // This device is now the single active session — kill any session
      // on other devices (their refresh tokens die immediately).
      await api.claimSession()
      const profile = await api.getProfile(data.user.id)
      if (!profile) throw new Error('Your profile could not be loaded.')
      const user = { ...profile, id: data.user.id, email: profile.email || data.user.email }
      await cacheSession(user)
      return { user }
    } catch (e) {
      if (isOfflineError(e)) throw new Error('No connection — sign-in isn\u2019t available offline.', { cause: e })
      throw e
    }
  },

  /** complete MFA sign-in with a TOTP code */
  async mfaSignIn(factorId, code) {
    if (!SUPABASE_ENABLED || !supabase) throw new Error('MFA is only available in the live deployment.')
    const challengeId = await api.mfaChallenge(factorId)
    const { data, error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: String(code || '').trim() })
    if (error) throw error
    // This device is now the single active session — kill the aal1 session
    // from the sign-in step plus any sessions on other devices.
    await api.claimSession()
    const profile = await api.getProfile(data.user.id)
    if (!profile) throw new Error('Your profile could not be loaded.')
    const user = { ...profile, id: data.user.id, email: profile.email || data.user.email }
    await cacheSession(user)
    return { user }
  },

  /* single-session login: one device per account.
     claim_session() invalidates every other session of the user at
     sign-in; is_latest_session() powers the heartbeat that force-signs
     out a device whose session was superseded by a login elsewhere. */
  claimSession() {
    if (!SUPABASE_ENABLED || !supabase) return Promise.resolve()
    return supabase.rpc('claim_session').then(({ error }) => {
      if (error) throw error
    })
  },

  isLatestSession() {
    if (!SUPABASE_ENABLED || !supabase) return Promise.resolve(true)
    return supabase.rpc('is_latest_session').then(({ data, error }) => {
      if (error) throw error
      return !!data
    })
  },

  /** email a password-reset link; Supabase redirects back to /reset-password */
  async resetPassword(email) {
    if (!SUPABASE_ENABLED || !supabase) throw new Error('Password reset is only available in the live deployment.')
    const { error } = await supabase.auth.resetPasswordForEmail(String(email || '').trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  },

  /** set a new password for the session restored from the reset email */
  async updatePassword(password) {
    if (!SUPABASE_ENABLED || !supabase) throw new Error('Password reset is only available in the live deployment.')
    const { error } = await supabase.auth.updateUser({ password: String(password || '') })
    if (error) throw error
    try {
      // this device becomes the account's active session
      await api.claimSession()
    } catch {
      /* best effort */
    }
  },

  async signUp(full_name, email, password, role) {
    if (!SUPABASE_ENABLED) {
      const id = uid()
      const p = { id, full_name, email, program: PROGRAMS[0], year_level: '1', role: 'student', requested_role: role === 'faculty' ? 'faculty' : null, avatar_url: null, created_at: new Date().toISOString() }
      await demoUpsertProfile(p)
      demoLogin(id)
      return { user: p }
    }
    const data = { full_name }
    if (role === 'faculty') data.requested_role = 'faculty'
    const { data: signed, error } = await supabase.auth.signUp({ email, password, options: { data } })
    if (error) throw error
    if (!signed.session) {
      // confirmation email flow — profile will be created by trigger
      return { user: null, needsConfirmation: true }
    }
    return { user: await api.getProfile(signed.user.id) }
  },

  async signOut() {
    if (!SUPABASE_ENABLED) {
      demoLogout()
      return
    }
    clearSessionCache()
    await supabase.auth.signOut()
  },

  /* profiles */
  getProfile: offlineRead('getProfile', async (id) => {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, surname, first_name, middle_initial, id_no, program, year_level, section, role, positions, avatar_url, created_at, privacy_policy_accepted_at')
          .eq('id', id)
          .maybeSingle()
        if (error) {
          if (isOfflineError(error)) throw error
          markDbError(error)
          return null
        }
        return data
      }, demoGetProfile, mirrorProfileInto),

  upsertProfile: offlineWrite('upsertProfile', async (p) => {
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
        if (error) {
          if (error.code === '23505')
            throw new Error('That ID no. is already registered to another account — one account per member.')
          throw error
        }
        return data
      }, async (p) => {
        const clean = { ...p, full_name: composeFullName(p) || sanitizeText(p.full_name, 120), avatar_url: sanitizeUrl(p.avatar_url) }
        db.profiles[p.id] = { ...db.profiles[p.id], ...clean }
        saveDb(db)
        invalidateMembersCache()
        return db.profiles[p.id]
      }),

  /* privacy consent — the gate writes only the caller's own row */
  acceptPrivacyPolicy: offlineWrite('acceptPrivacyPolicy', async () => {
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
      }, async () => {
        const me = demoCurrentUserId()
        if (!me) throw new Error('You must be signed in.')
        await demoUpsertProfile({ id: me, privacy_policy_accepted_at: new Date().toISOString() })
        return { privacy_policy_accepted_at: demoGetProfile(me).privacy_policy_accepted_at }
      }),

  /* posts */
  getPosts: offlineRead('getPosts', async ({ from = 0, to = FEED_PAGE - 1 } = {}) => {
        const { data, error } = await supabase
          .from('posts')
          .select('*, comments(*), post_likes(user_id), profiles!posts_user_id_fkey(full_name, avatar_url, program)')
          .is('archived_at', null)
          .order('created_at', { ascending: false })
          .range(from, to)
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
      }, async ({ from = 0, to = FEED_PAGE - 1 } = {}) => {
        const posts = await demoGetPosts()
        return posts.slice(from, to + 1).map((p) => ({ ...p, author: db.profiles[p.user_id] || null }))
      }, mirrorPosts),

  getArchivedPosts: offlineRead('getArchivedPosts', async ({ from = 0, to = 99 } = {}) => {
        const { data, error } = await supabase
          .from('posts')
          .select('*, comments(*), post_likes(user_id), profiles!posts_user_id_fkey(full_name, avatar_url, program)')
          .not('archived_at', 'is', null)
          .order('archived_at', { ascending: false })
          .range(from, to)
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
      }, async ({ from = 0, to = 99 } = {}) => {
        const posts = [...db.posts]
          .filter((p) => p.archived_at)
          .sort((a, b) => new Date(b.archived_at) - new Date(a.archived_at))
        return posts.slice(from, to + 1).map((p) => ({ ...p, author: db.profiles[p.user_id] || null }))
      }, mirrorPosts),

  /* directory — served by the security-definer get_directory() RPC (no email,
     no RLS gaps); viewers only: superadmin/moderator + console officers */
  getMembers: (() => {
        const load = offlineRead('getMembers', async () => {
          const { data, error } = await supabase.rpc('get_directory').order('full_name')
          if (error) {
            markDbError(error)
            throw error
          }
          setDbStatus('ok')
          return (data || []).filter((m) => m.role !== 'superadmin')
        }, async () => {
          if (!demoCanViewDirectory()) throw new Error('insufficient privileges')
          return Object.values(db.profiles).filter((m) => m.role !== 'superadmin')
        }, mirrorProfiles)
        return async () => {
          if (membersCache && Date.now() - membersCacheAt < MEMBERS_CACHE_TTL) return [...membersCache]
          const data = await load()
          membersCache = data || []
          membersCacheAt = Date.now()
          return [...membersCache]
        }
      })(),

  /* member count — lightweight count only, visible to everyone */
  getMemberCount: offlineRead('getMemberCount', async () => {
        const { data, error } = await supabase.rpc('get_member_count')
        if (error) {
          markDbError(error)
          throw error
        }
        setDbStatus('ok')
        return Number(data || 0)
      }, async () => Object.values(db.profiles).filter((m) => m.role !== 'superadmin').length),

  createPost: offlineWrite('createPost', async ({ content, image_url }) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('You must be signed in to post.')
        const { data, error } = await supabase
          .from('posts')
          .insert({ user_id: user.id, content: sanitizeText(content, 2000), image_url: sanitizeUrl(image_url) })
          .select()
          .single()
        if (error) throw error
        return data
      }, demoCreatePost, { localId: (p) => p?.id }),

  toggleLike: offlineWrite('toggleLike', async (postId) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: existing } = await supabase.from('post_likes').select('*').eq('post_id', postId).eq('user_id', user.id).maybeSingle()
        if (existing) await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id)
        else await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id })
        return (await supabase.from('post_likes').select('user_id').eq('post_id', postId)).data.map((l) => l.user_id)
      }, demoToggleLike),

  addComment: offlineWrite('addComment', async (postId, content, imageUrl, parentId) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('You must be signed in to comment.')
        const { data, error } = await supabase
          .from('comments')
          .insert({ post_id: postId, user_id: user.id, parent_id: parentId || null, content: sanitizeText(content, 1000), image_url: imageUrl || null })
          .select()
          .single()
        if (error) throw error
        return data
      }, demoAddComment),

  updateComment: offlineWrite('updateComment', async (commentId, content, imageUrl) => {
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
      }, demoUpdateComment),

  deleteComment: offlineWrite('deleteComment', async (commentId) => {
        const { error } = await supabase.from('comments').delete().eq('id', commentId)
        if (error) throw error
      }, demoDeleteComment),

  archivePost: offlineWrite('archivePost', async (postId) => {
        const { error } = await supabase.from('posts').update({ archived_at: new Date().toISOString() }).eq('id', postId)
        if (error) throw error
      }, demoArchivePost),

  unarchivePost: offlineWrite('unarchivePost', async (postId) => {
        const { error } = await supabase.from('posts').update({ archived_at: null }).eq('id', postId)
        if (error) throw error
      }, demoUnarchivePost),

  deletePost: offlineWrite('deletePost', async (postId) => {
        const { error } = await supabase.from('posts').delete().eq('id', postId)
        if (error) throw error
      }, demoDeletePost),

  /* moderation + admin CRUD */
  updatePost: offlineWrite('updatePost', async (postId, patch) => {
        const { error } = await supabase.from('posts').update(patch).eq('id', postId)
        if (error) throw error
      }, async (postId, patch) => {
        const post = db.posts.find((p) => p.id === postId)
        if (post) Object.assign(post, patch)
        saveDb(db)
      }),

  getUsers: offlineRead('getUsers', async () => {
        // security-definer RPC — only staff/superadmin may read profiles (incl. email)
        const { data, error } = await supabase.rpc('admin_get_users')
        if (error) {
          markDbError(error)
          throw error
        }
        setDbStatus('ok')
        return data || []
      }, async () => Object.values(db.profiles), mirrorProfiles),

  /* public faculty directory for the home page — emails stay private */
  getFaculty: offlineRead('getFaculty', async () => {
        const { data, error } = await supabase.rpc('get_faculty')
        if (error) {
          markDbError(error)
          throw error
        }
        setDbStatus('ok')
        return data || []
      }, async () =>
        Object.values(db.profiles).filter(
          (p) => p.role === 'faculty' || (p.role === 'superadmin' && p.program === 'Faculty')
        ), mirrorProfiles),

  createUser: offlineWrite('createUser', async (p) => {
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
      }, async (p) => {
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
      }, { localId: (r) => r?.id }),

  updateUser: offlineWrite('updateUser', async (id, patch) => {
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
      }, async (id, patch) => {
        db.profiles[id] = { ...db.profiles[id], ...patch }
        saveDb(db)
        return db.profiles[id]
      }),

  /* roles + positions go through the superadmin-gated RPCs only
     (client-side role/positions updates are blocked by the guard trigger) */
  changeRole: offlineWrite('changeRole', async (id, role) => {
        const { error } = await supabase.rpc('change_role', { p_target: id, p_new_role: role })
        if (error) throw error
        api.logAudit('role.change', 'profile', id, { to: role })
      }, async (id, role) => {
        db.profiles[id] = { ...db.profiles[id], role }
        saveDb(db)
      }),

  setPositions: offlineWrite('setPositions', async (id, positions) => {
        const { error } = await supabase.rpc('set_positions', { p_target: id, p_positions: positions })
        if (error) throw error
        api.logAudit('positions.set', 'profile', id, { positions })
      }, async (id, positions) => {
        db.profiles[id] = { ...db.profiles[id], positions }
        saveDb(db)
      }),

  /* superadmin resolves a pending faculty signup request (approve promotes
     the member to faculty; dismiss just clears the request) */
  resolveFacultyRequest: offlineWrite('resolveFacultyRequest', async (id, approve) => {
        const { error } = await supabase.rpc('resolve_faculty_request', { p_target: id, p_approve: !!approve })
        if (error) throw error
        api.logAudit('faculty.request', 'profile', id, { approve: !!approve })
      }, async (id, approve) => {
        const p = db.profiles[id]
        if (p) {
          if (approve) p.role = 'faculty'
          p.requested_role = null
        }
        saveDb(db)
      }),

  deleteUser: offlineWrite('deleteUser', async (id) => {
        const { error } = await supabase.from('profiles').delete().eq('id', id)
        if (error) throw error
        api.logAudit('member.delete', 'profile', id)
      }, async (id) => {
        delete db.profiles[id]
        db.posts = db.posts.filter((p) => p.user_id !== id)
        saveDb(db)
      }),

  updateEvent: offlineWrite('updateEvent', async (eventId, patch) => {
        const { data, error } = await supabase.from('events').update(patch).eq('id', eventId).select().single()
        if (error) throw error
        api.logAudit('event.update', 'event', eventId, { title: patch?.title })
        return data
      }, async (eventId, patch) => {
        const ev = db.events.find((e) => e.id === eventId)
        if (ev) Object.assign(ev, patch)
        saveDb(db)
        return ev
      }),

  deleteEvent: offlineWrite('deleteEvent', async (eventId) => {
        const { error } = await supabase.from('events').delete().eq('id', eventId)
        if (error) throw error
        api.logAudit('event.delete', 'event', eventId)
      }, async (eventId) => {
        db.events = db.events.filter((e) => e.id !== eventId)
        delete db.attendance[eventId]
        saveDb(db)
      }),

  /* events */
  getEvents: offlineRead('getEvents', async () => {
        const { data, error } = await supabase
          .from('events')
          .select('*, rsvps(*, profiles(full_name, avatar_url, program))')
          .gte('ends_at', new Date(Date.now() - 24 * 3600e3).toISOString())
          .order('starts_at', { ascending: true })
        if (error) {
          markDbError(error)
          throw error
        }
        setDbStatus('ok')
        return (data || []).map((e) => {
          const attendees = {}
          for (const r of e.rsvps || []) attendees[r.user_id] = r.profiles || null
          return {
            ...e,
            rsvps: Object.fromEntries((e.rsvps || []).map((r) => [r.user_id, r.status])),
            attendees,
          }
        })
      }, async () => {
        const events = await demoGetEvents()
        return events.map((e) => ({
          ...e,
          attendees: Object.fromEntries(
            Object.keys(e.rsvps || {}).map((id) => [id, db.profiles[id] || null])
          ),
        }))
      }, (events) => {
        mirrorEvents(events)
        // rsvp rows carry profiles for the attendees map — mirror those too
        for (const e of events || []) {
          for (const u of Object.values(e.attendees || {})) if (u) mirrorProfileInto(u)
        }
      }),

  /* all events — past included (admin console needs to manage old events) */
  getAllEvents: offlineRead('getAllEvents', async () => {
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
      }, async () => {
        const evs = await demoGetEvents()
        return evs.map((e) => ({ ...e, rsvps: e.rsvps || {} }))
      }, mirrorEvents),

  createEvent: offlineWrite('createEvent', async (ev) => {
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
            fee_amount: Number(ev.fee_amount) || 0,
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
      }, demoCreateEvent, { localId: (e) => e?.id }),

  setRsvp: offlineWrite('setRsvp', async (eventId, status) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        if (status === 'none') {
          await supabase.from('rsvps').delete().eq('event_id', eventId).eq('user_id', user.id)
        } else {
          await supabase.from('rsvps').upsert({ event_id: eventId, user_id: user.id, status })
        }
      }, demoSetRsvp),

  /* event contributions — members see their own rows, event managers record */
  getEventPayments: offlineRead('getEventPayments', async (eventId) => {
        let q = supabase
          .from('event_payments')
          .select('*, profiles!member_id(full_name, id_no, program, year_level, section, email)')
          .order('paid_at', { ascending: false })
        if (eventId) q = q.eq('event_id', eventId)
        const { data, error } = await q
        if (error) throw error
        return data || []
      }, async (eventId) => {
        const rows = (db.eventPayments || [])
          .filter((p) => !eventId || p.event_id === eventId)
          .map((p) => {
            const pr = db.profiles[p.member_id]
            return {
              ...p,
              profiles: pr
                ? { full_name: pr.full_name, id_no: pr.id_no, program: pr.program, year_level: pr.year_level, section: pr.section, email: pr.email }
                : null,
            }
          })
        return rows.sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
      }, mirrorEventPayments),

  markEventPayment: offlineWrite('markEventPayment', async (eventId, memberId) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('You must be signed in.')
        const { data: ev, error: evErr } = await supabase.from('events').select('fee_amount').eq('id', eventId).single()
        if (evErr) throw evErr
        const amount = Number(ev?.fee_amount) || 0
        if (amount <= 0) throw new Error('This event has no contribution fee.')
        const { data, error } = await supabase
          .from('event_payments')
          .upsert(
            { event_id: eventId, member_id: memberId, amount, paid_at: new Date().toISOString(), recorded_by: user.id },
            { onConflict: 'event_id,member_id' }
          )
          .select('*')
          .single()
        if (error) throw error
        api.logAudit('event.fee.mark', 'event', eventId, { member_id: memberId, amount })
        return data
      }, async (eventId, memberId) => {
        const ev = db.events.find((e) => e.id === eventId)
        const amount = Number(ev?.fee_amount) || 0
        if (amount <= 0) throw new Error('This event has no contribution fee.')
        const row = {
          id: uid(),
          event_id: eventId,
          member_id: memberId,
          amount,
          paid_at: new Date().toISOString(),
          recorded_by: demoCurrentUserId() || null,
          created_at: new Date().toISOString(),
        }
        db.eventPayments = [...(db.eventPayments || []).filter((p) => !(p.event_id === eventId && p.member_id === memberId)), row]
        saveDb(db)
        return row
      }, { localId: (p) => p?.id }),

  unmarkEventPayment: offlineWrite('unmarkEventPayment', async (eventId, memberId) => {
        const { error } = await supabase
          .from('event_payments')
          .delete()
          .eq('event_id', eventId)
          .eq('member_id', memberId)
        if (error) throw error
        api.logAudit('event.fee.unmark', 'event', eventId, { member_id: memberId })
      }, async (eventId, memberId) => {
        db.eventPayments = (db.eventPayments || []).filter((p) => !(p.event_id === eventId && p.member_id === memberId))
        saveDb(db)
      }),

  getAttendance: offlineRead('getAttendance', async (eventId) => {
        const { data, error } = await supabase
          .from('attendance')
          .select('*, profiles(full_name, program, year_level, section, email, id_no)')
          .eq('event_id', eventId)
        if (error) throw error
        return data || []
      }, demoGetAttendance, (rows) => {
        for (const r of rows || []) {
          const ev = db.attendance[r.event_id] || (db.attendance[r.event_id] = {})
          ev[r.user_id] = r.scanned_at
          if (r.profiles) mirrorProfileInto(r.profiles)
        }
        saveDb(db)
      }),

  markAttendance: offlineWrite('markAttendance', async (eventId, userId) => {
        const { error } = await supabase.from('attendance').upsert({ event_id: eventId, user_id: userId, scanned_at: new Date().toISOString() })
        if (error) throw error
      }, demoMarkAttendance),

  removeAttendance: offlineWrite('removeAttendance', async (eventId, userId) => {
        const { error } = await supabase.from('attendance').delete().eq('event_id', eventId).eq('user_id', userId)
        if (error) throw error
      }, demoRemoveAttendance),

  /* ---------------- class attendance (faculty subjects & sessions) ---------------- */
  getMySubjects: offlineRead('getMySubjects', async () => {
        const { data, error } = await supabase.from('faculty_subjects').select('*').order('created_at', { ascending: false })
        if (error) throw error
        return data || []
      }, demoGetMySubjects, (rows) => {
        // Reconcile this faculty's subjects with the server list so locally
        // created rows that later gained a server id never linger as a
        // duplicate that the UI "deletes" without reaching the backend.
        const me = demoCurrentUserId() || DEMO_USER_ID
        const mine = new Set((rows || []).map((s) => s.id))
        const others = (db.subjects || []).filter((x) => x.faculty_id !== me)
        db.subjects = [...others, ...(db.subjects || []).filter((x) => x.faculty_id === me && mine.has(x.id))]
        for (const s of rows || []) {
          if (!db.subjects.some((x) => x.id === s.id)) db.subjects.push(s)
        }
        saveDb(db)
      }),

  addSubject: offlineWrite('addSubject', async (name) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not signed in')
        const { data, error } = await supabase.from('faculty_subjects').insert({ faculty_id: user.id, name }).select().single()
        if (error) throw error
        return data
      }, async (name) => demoAddSubject(name), { localId: (r) => r?.id }),

  removeSubject: offlineWrite('removeSubject', async (id) => {
        const { error } = await supabase.from('faculty_subjects').delete().eq('id', id)
        if (error) throw error
      }, async (id) => demoRemoveSubject(id), { localId: (_local, id) => id }),

  startSession: offlineWrite('startSession', async (subjectId) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not signed in')
        const { data, error } = await supabase.from('class_sessions').insert({ subject_id: subjectId, faculty_id: user.id }).select().single()
        if (error) throw error
        return data
      }, async (subjectId) => demoStartSession(subjectId), { localId: (r) => r?.id }),

  endSession: offlineWrite('endSession', async (sessionId) => {
        const { error } = await supabase.from('class_sessions').update({ ended_at: new Date().toISOString() }).eq('id', sessionId)
        if (error) throw error
      }, async (sessionId) => demoEndSession(sessionId)),

  getSessions: offlineRead('getSessions', async () => {
        const { data, error } = await supabase
          .from('class_sessions')
          .select('*, subject:subject_id(name), attendance_count:class_attendance(count)')
          .order('started_at', { ascending: false })
          .limit(60)
        if (error) throw error
        return (data || []).map((s) => ({ ...s, attendance_count: Number(s.attendance_count?.[0]?.count) || 0 }))
      }, demoGetSessions, (rows) => {
        const me = demoCurrentUserId() || DEMO_USER_ID
        const mine = new Set((rows || []).map((s) => s.id))
        const others = (db.classSessions || []).filter((x) => x.faculty_id !== me)
        db.classSessions = [...others, ...(db.classSessions || []).filter((x) => x.faculty_id === me && mine.has(x.id))]
        for (const s of rows || []) {
          if (!db.classSessions.some((x) => x.id === s.id)) {
            db.classSessions.push({ id: s.id, subject_id: s.subject_id, faculty_id: s.faculty_id, started_at: s.started_at, ended_at: s.ended_at })
          }
        }
        saveDb(db)
      }),

  getSessionAttendance: offlineRead('getSessionAttendance', async (sessionId) => {
        const { data, error } = await supabase
          .from('class_attendance')
          .select('*, profiles(full_name, program, year_level, section, email, id_no)')
          .eq('session_id', sessionId)
          .order('scanned_at', { ascending: true })
        if (error) throw error
        return data || []
      }, async (sessionId) => demoGetSessionAttendance(sessionId), (rows) => {
        for (const r of rows || []) {
          const m = db.classAttendance[r.session_id] || (db.classAttendance[r.session_id] = {})
          m[r.user_id] = r.scanned_at
          if (r.profiles) mirrorProfileInto(r.profiles)
        }
        saveDb(db)
      }),

  markClassAttendance: offlineWrite('markClassAttendance', async (sessionId, userId) => {
        const { error } = await supabase
          .from('class_attendance')
          .upsert({ session_id: sessionId, user_id: userId, scanned_at: new Date().toISOString() })
        if (error) throw error
      }, async (sessionId, userId) => demoMarkClassAttendance(sessionId, userId)),

  removeClassAttendance: offlineWrite('removeClassAttendance', async (sessionId, userId) => {
        const { error } = await supabase
          .from('class_attendance')
          .delete()
          .eq('session_id', sessionId)
          .eq('user_id', userId)
        if (error) throw error
      }, async (sessionId, userId) => demoRemoveClassAttendance(sessionId, userId)),

  /* students can always read their own class attendance rows */
  getMyClassAttendance: offlineRead('getMyClassAttendance', async () => {
        const { data, error } = await supabase.rpc('get_my_class_attendance')
        if (error) {
          markDbError(error)
          throw error
        }
        setDbStatus('ok')
        return data || []
      }, demoGetMyClassAttendance, (rows) => {
        for (const r of rows || []) {
          const m = db.classAttendance[r.session_id] || (db.classAttendance[r.session_id] = {})
          m[r.user_id] = r.scanned_at
        }
        saveDb(db)
      }),

  /* students scan the faculty's session QR to mark their own attendance */
  markMyClassAttendance: offlineWrite('markMyClassAttendance', async (sessionId) => {
        const { error } = await supabase.rpc('mark_my_class_attendance', { p_session: sessionId })
        if (error) throw error
      }, async (sessionId) => demoMarkMyClassAttendance(sessionId)),

  /* ---------------- rotational clearance (officers + the student themself) ---------------- */
  getClearanceForms: offlineRead('getClearanceForms', async (studentId) => {
        const { data, error } = await supabase.rpc('get_clearance_forms', { p_student_id: studentId })
        if (error) {
          markDbError(error)
          throw error
        }
        setDbStatus('ok')
        return data || []
      }, async (studentId) => demoGetClearanceForms(studentId), mirrorClearanceForms),

  getMyClearance: offlineRead('getMyClearance', async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return []
        const { data, error } = await supabase.rpc('get_clearance_forms', { p_student_id: user.id })
        if (error) {
          markDbError(error)
          throw error
        }
        return data || []
      }, async () => demoGetClearanceForms(demoCurrentUserId() || DEMO_USER_ID), mirrorClearanceForms),

  searchStudents: offlineRead('searchStudents', async (q) => {
        const { data, error } = await supabase.rpc('search_students', { p_q: q || '' })
        if (error) {
          markDbError(error)
          throw error
        }
        setDbStatus('ok')
        return data || []
      }, demoSearchStudents),

  getPopulationBreakdown: offlineRead('getPopulationBreakdown', async () => {
        const { data, error } = await supabase.rpc('population_breakdown')
        if (error) {
          markDbError(error)
          throw error
        }
        setDbStatus('ok')
        return data || []
      }, demoGetPopulationBreakdown),

  createClearanceForm: offlineWrite('createClearanceForm', async (studentId, { school_year, semester, placement }) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('You must be signed in.')
        const { data, error } = await supabase
          .from('clearance_forms')
          .insert({ member_id: studentId, school_year, semester, placement: sanitizeText(placement, 200), created_by: user.id })
          .select('*')
          .single()
        if (error) throw error
        api.logAudit('clearance.form.create', 'clearance_form', data.id, { member_id: studentId, school_year, semester })
        return { ...data, rows: [] }
      }, demoCreateClearanceForm, { localId: (f) => f?.id }),

  addClearanceRow: offlineWrite('addClearanceRow', async (formId, { dates, concept, hours, agency }) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('You must be signed in.')
        const { data, error } = await supabase
          .from('clearance_rows')
          .insert({ form_id: formId, dates: sanitizeText(dates, 200), concept: sanitizeText(concept, 200), hours: Number(hours) || 0, agency: sanitizeText(agency, 200) || null, created_by: user.id })
          .select('*')
          .single()
        if (error) throw error
        api.logAudit('clearance.row.add', 'clearance_row', data.id, { form_id: formId, concept })
        return data
      }, demoAddClearanceRow, { localId: (r) => r?.id }),

  clearClearanceRow: offlineWrite('clearClearanceRow', async (rowId) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('You must be signed in.')
        const { data, error } = await supabase
          .from('clearance_rows')
          .update({ cleared_at: new Date().toISOString(), recorded_by: user.id })
          .eq('id', rowId)
          .select('*')
          .single()
        if (error) throw error
        api.logAudit('clearance.row.clear', 'clearance_row', rowId, { recorded_by: user.id })
        return data
      }, demoClearClearanceRow),

  updateClearanceRow: offlineWrite('updateClearanceRow', async (rowId, patch) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('You must be signed in.')
        const clean = { updated_by: user.id, updated_at: new Date().toISOString() }
        if (patch.dates !== undefined) clean.dates = sanitizeText(patch.dates, 200)
        if (patch.concept !== undefined) clean.concept = sanitizeText(patch.concept, 200)
        if (patch.hours !== undefined) clean.hours = Number(patch.hours) || 0
        if (patch.agency !== undefined) clean.agency = sanitizeText(patch.agency, 200) || null
        if (patch.remark !== undefined) clean.remark = patch.remark || null
        if (patch.demerit !== undefined) clean.demerit = patch.demerit || null
        if (patch.days_extension !== undefined) clean.days_extension = patch.days_extension || null
        if (patch.merit !== undefined) clean.merit = Math.max(0, Number(patch.merit) || 0)
        const { data, error } = await supabase
          .from('clearance_rows')
          .update(clean)
          .eq('id', rowId)
          .select('*')
          .single()
        if (error) throw error
        api.logAudit('clearance.row.update', 'clearance_row', rowId, { dates: clean.dates, concept: clean.concept, hours: clean.hours, agency: clean.agency, remark: clean.remark, demerit: clean.demerit, days_extension: clean.days_extension, merit: clean.merit })
        return data
      }, demoUpdateClearanceRow),

  deleteClearanceRow: offlineWrite('deleteClearanceRow', async (rowId) => {
        const { error } = await supabase.from('clearance_rows').delete().eq('id', rowId)
        if (error) throw error
        api.logAudit('clearance.row.delete', 'clearance_row', rowId)
      }, demoDeleteClearanceRow),

  updateClearanceForm: offlineWrite('updateClearanceForm', async (formId, { placement }) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('You must be signed in.')
        const { data, error } = await supabase
          .from('clearance_forms')
          .update({ placement: sanitizeText(placement, 200) })
          .eq('id', formId)
          .select('*')
          .single()
        if (error) throw error
        api.logAudit('clearance.form.update', 'clearance_form', formId, { placement })
        return data
      }, demoUpdateClearanceForm, { localId: (f) => f?.id }),

  deleteClearanceForm: offlineWrite('deleteClearanceForm', async (formId) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('You must be signed in.')
        const { error } = await supabase.from('clearance_forms').delete().eq('id', formId)
        if (error) throw error
        api.logAudit('clearance.form.delete', 'clearance_form', formId)
      }, demoDeleteClearanceForm),

  /* my attendance history */
  getMyAttendance: offlineRead('getMyAttendance', async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return []
        const { data, error } = await supabase
          .from('attendance')
          .select('event_id, scanned_at, events(title, starts_at, location)')
          .eq('user_id', user.id)
          .order('scanned_at', { ascending: false })
        if (error) throw error
        return (data || []).map((r) => ({ event_id: r.event_id, scanned_at: r.scanned_at, ...(r.events || {}) }))
      }, async () => {
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
      }),

  /* attendance tallies per event */
  getAttendanceSummary: offlineRead('getAttendanceSummary', async () => {
        const { data, error } = await supabase.from('attendance').select('event_id, events(title)')
        if (error) throw error
        const counts = {}
        const titles = {}
        for (const r of data || []) {
          counts[r.event_id] = (counts[r.event_id] || 0) + 1
          titles[r.event_id] = r.events?.title
        }
        return Object.entries(counts).map(([event_id, count]) => ({ event_id, count, title: titles[event_id] || 'Event' }))
      }, async () =>
        db.events
          .map((e) => ({ event_id: e.id, count: Object.keys(db.attendance[e.id] || {}).length, title: e.title }))
          .filter((t) => t.count > 0)),

  /* member-visible per-event attendance counts (security-definer RPC) */
  getEventTallies: offlineRead('getEventTallies', async () => {
        const { data, error } = await supabase.rpc('get_event_tallies')
        if (error) throw error
        return data || []
      }, async () => {
        const counts = {}
        for (const [event_id, m] of Object.entries(db.attendance || {})) {
          counts[event_id] = Object.keys(m || {}).length
        }
        return Object.entries(counts).map(([event_id, count]) => ({ event_id, count }))
      }),

  /* ---------------- membership fees (RLS: own rows or fee viewer) ---------------- */
  getAnnualFee: offlineRead('getAnnualFee', async () => {
        const { data, error } = await supabase.rpc('get_membership_fee_amount')
        if (error) throw error
        return Number(data) || 0
      }, async () => 200),

  setAnnualFee: offlineWrite('setAnnualFee', async (amount) => {
        const { error } = await supabase.rpc('set_membership_fee_amount', { p_amount: Number(amount) || 0 })
        if (error) throw error
        api.logAudit('fee.annual.set', 'app_settings', '1', { amount: Number(amount) || 0 })
      }, async (amount) => {
        db.annualFee = Number(amount) || 0
        saveDb(db)
      }),

  getFeePayments: offlineRead('getFeePayments', async (schoolYear) => {
        let q = supabase
          .from('fee_payments')
          .select('*, profiles!member_id(full_name, program, year_level, email)')
          .order('paid_at', { ascending: false })
        if (schoolYear) q = q.eq('school_year', schoolYear)
        const { data, error } = await q
        if (error) throw error
        return data || []
      }, async (schoolYear) => {
        const rows = (db.feePayments || [])
          .filter((p) => !schoolYear || p.school_year === schoolYear)
          .map((p) => {
            const pr = db.profiles[p.member_id]
            return {
              ...p,
              profiles: pr
                ? { full_name: pr.full_name, program: pr.program, year_level: pr.year_level, email: pr.email }
                : null,
            }
          })
        return rows.sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
      }, mirrorFeePayments),

  recordFeePayment: offlineWrite('recordFeePayment', async (memberId, schoolYear, { type, receipt }) => {
        const { data: { user } } = await supabase.auth.getUser()
        const annual = await api.getAnnualFee()
        const amount = annual * (type === 'half' ? 0.5 : 1)
        const { data, error } = await supabase
          .from('fee_payments')
          .insert({
            member_id: memberId,
            school_year: schoolYear,
            payment_type: type === 'half' ? 'half' : 'full',
            amount,
            receipt: sanitizeText(receipt, 200) || null,
            paid_at: new Date().toISOString(),
            recorded_by: user?.id,
          })
          .select('*')
          .single()
        if (error) throw error
        api.logAudit('fee.record', 'fee_payment', data.id, { member_id: memberId, amount, type: type === 'half' ? 'half' : 'full' })
        return data
      }, async (memberId, schoolYear, { type, receipt }) => {
        const row = {
          id: uid(),
          member_id: memberId,
          school_year: schoolYear,
          payment_type: type === 'half' ? 'half' : 'full',
          amount: (db.annualFee || 200) * (type === 'half' ? 0.5 : 1),
          receipt: receipt || null,
          paid_at: new Date().toISOString(),
          recorded_by: demoCurrentUserId() || null,
          created_at: new Date().toISOString(),
        }
        db.feePayments = [row, ...(db.feePayments || [])]
        saveDb(db)
        return row
      }, { localId: (p) => p?.id }),

  voidFeePayment: offlineWrite('voidFeePayment', async (id) => {
        const { error } = await supabase.from('fee_payments').delete().eq('id', id)
        if (error) throw error
        api.logAudit('fee.void', 'fee_payment', id)
      }, async (id) => {
        db.feePayments = (db.feePayments || []).filter((p) => p.id !== id)
        saveDb(db)
      }),

  getFeeds,
  getWhoNews,
  aiChat,

  /* ---------------- announcements (announcer-gated by RLS) ---------------- */
  getAnnouncements: offlineRead('getAnnouncements', async () => {
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
      }, async () => {
        const list = JSON.parse(localStorage.getItem('fnahs-demo-announcements') || '[]')
        if (!list.length) {
          const staff = db.profiles[DEMO_STAFF_ID] || {}
          const seeded = seedAnnouncements().map((a) => ({
            id: uid(),
            title: a.title,
            body: a.body,
            pinned: !!a.pinned,
            author_id: DEMO_STAFF_ID,
            created_at: a.created_at,
            profiles: { full_name: staff.full_name || 'FNAHS', avatar_url: staff.avatar_url || null },
          }))
          localStorage.setItem('fnahs-demo-announcements', JSON.stringify(seeded))
          return seeded
        }
        return list.sort((a, b) => (b.pinned - a.pinned) || (new Date(b.created_at) - new Date(a.created_at)))
      }, mirrorAnnouncements),

  createAnnouncement: offlineWrite('createAnnouncement', async ({ title, body, pinned }) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('You must be signed in.')
        const { data, error } = await supabase
          .from('announcements')
          .insert({ title: sanitizeText(title, 200), body: sanitizeText(body, 2000), pinned: !!pinned, author_id: user.id })
          .select('*, profiles!announcements_author_id_fkey(full_name, avatar_url)')
          .single()
        if (error) throw error
        return data
      }, async ({ title, body, pinned }) => {
        const me = db.profiles[demoCurrentUserId()] || db.profiles[DEMO_USER_ID]
        const list = JSON.parse(localStorage.getItem('fnahs-demo-announcements') || '[]')
        const row = { id: uid(), title, body, pinned: !!pinned, author_id: me?.id, created_at: new Date().toISOString(), profiles: { full_name: me?.full_name || 'FNAHS', avatar_url: me?.avatar_url || null } }
        list.unshift(row)
        localStorage.setItem('fnahs-demo-announcements', JSON.stringify(list))
        return row
      }, { localId: (a) => a?.id }),

  updateAnnouncement: offlineWrite('updateAnnouncement', async (id, patch) => {
        const clean = {}
        if (patch.title !== undefined) clean.title = sanitizeText(patch.title, 200)
        if (patch.body !== undefined) clean.body = sanitizeText(patch.body, 2000)
        if (patch.pinned !== undefined) clean.pinned = !!patch.pinned
        if (patch.archived_at !== undefined) clean.archived_at = patch.archived_at
        const { error } = await supabase.from('announcements').update(clean).eq('id', id)
        if (error) throw error
      }, async (id, patch) => {
        const list = JSON.parse(localStorage.getItem('fnahs-demo-announcements') || '[]')
        const row = list.find((a) => a.id === id)
        if (row) Object.assign(row, patch)
        localStorage.setItem('fnahs-demo-announcements', JSON.stringify(list))
      }),

  deleteAnnouncement: offlineWrite('deleteAnnouncement', async (id) => {
        const { error } = await supabase.from('announcements').delete().eq('id', id)
        if (error) throw error
      }, async (id) => {
        const list = JSON.parse(localStorage.getItem('fnahs-demo-announcements') || '[]')
        localStorage.setItem('fnahs-demo-announcements', JSON.stringify(list.filter((a) => a.id !== id)))
      }),

  /* ---------------- notifications (own rows only) ---------------- */
  getNotifications: offlineRead('getNotifications', async () => {
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
      }, async () => {
        const me = demoCurrentUserId()
        const all = JSON.parse(localStorage.getItem('fnahs-demo-notifs') || '[]')
        const list = all.filter((n) => n.user_id === me).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 30)
        return { list, unread: list.filter((n) => !n.read_at).length }
      }, mirrorNotifications),

  markNotificationRead: offlineWrite('markNotificationRead', async (id) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id)
      }, async (id) => {
        const all = JSON.parse(localStorage.getItem('fnahs-demo-notifs') || '[]')
        const n = all.find((x) => x.id === id)
        if (n) n.read_at = new Date().toISOString()
        localStorage.setItem('fnahs-demo-notifs', JSON.stringify(all))
      }),

  markAllNotificationsRead: offlineWrite('markAllNotificationsRead', async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null)
      }, async () => {
        const me = demoCurrentUserId()
        if (!me) return
        const all = JSON.parse(localStorage.getItem('fnahs-demo-notifs') || '[]')
        const now = new Date().toISOString()
        all.forEach((n) => {
          if (n.user_id === me && !n.read_at) n.read_at = now
        })
        localStorage.setItem('fnahs-demo-notifs', JSON.stringify(all))
      }),

  /* ---------------- event polls ---------------- */
  getPolls: offlineRead('getPolls', async (eventId) => {
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
      }, async (eventId) => {
        const all = JSON.parse(localStorage.getItem('fnahs-demo-polls') || '[]')
        return all.filter((p) => p.event_id === eventId)
      }, mirrorPolls),

  createPoll: offlineWrite('createPoll', async (eventId, question, optionLabels) => {
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
      }, async (eventId, question, optionLabels) => {
        const me = demoCurrentUserId() || DEMO_USER_ID
        const all = JSON.parse(localStorage.getItem('fnahs-demo-polls') || '[]')
        const poll = { id: uid(), event_id: eventId, question, created_by: me, created_at: new Date().toISOString(), options: optionLabels.map((label) => ({ id: uid(), label, votes: [] })) }
        all.push(poll)
        localStorage.setItem('fnahs-demo-polls', JSON.stringify(all))
        return poll
      }, { localId: (p) => p?.id }),

  castVote: offlineWrite('castVote', async (pollId, optionId) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('You must be signed in.')
        const { error } = await supabase
          .from('poll_votes')
          .upsert({ poll_id: pollId, option_id: optionId, user_id: user.id }, { onConflict: 'poll_id,user_id' })
        if (error) throw error
      }, async (pollId, optionId) => {
        const me = demoCurrentUserId() || DEMO_USER_ID
        const all = JSON.parse(localStorage.getItem('fnahs-demo-polls') || '[]')
        const poll = all.find((p) => p.id === pollId)
        if (poll) {
          poll.options.forEach((o) => (o.votes = o.votes.filter((v) => v !== me)))
          poll.options.find((o) => o.id === optionId)?.votes.push(me)
        }
        localStorage.setItem('fnahs-demo-polls', JSON.stringify(all))
      }),

  /* ---------------- Florence chat history (own messages) ---------------- */
  getChatHistory: offlineRead('getChatHistory', async () => {
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
      }, async () => {
        const me = demoCurrentUserId()
        const all = JSON.parse(localStorage.getItem('fnahs-demo-chat') || '{}')
        return (all[me] || []).slice(-40)
      }, mirrorChat),

  saveChatMessage: offlineWrite('saveChatMessage', async (role, content) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('chat_messages').insert({ user_id: user.id, role, content: String(content || '').slice(0, 12000) })
      }, async (role, content) => {
        const me = demoCurrentUserId()
        if (!me) return
        const all = JSON.parse(localStorage.getItem('fnahs-demo-chat') || '{}')
        const list = all[me] || []
        list.push({ role, content, created_at: new Date().toISOString() })
        all[me] = list.slice(-100)
        localStorage.setItem('fnahs-demo-chat', JSON.stringify(all))
      }),

  PROGRAMS,

  /* ---------------- security level 1 ---------------- */

  /** client-side login throttle: 5 fails → 60s lockout per email */
  loginLockRemaining(email) {
    try {
      const raw = JSON.parse(localStorage.getItem('fnahs-login-lock') || '{}')
      const e = (email || '').trim().toLowerCase()
      const slot = raw[e]
      if (!slot) return 0
      const until = slot.until - Date.now()
      return until > 0 ? Math.ceil(until / 1000) : 0
    } catch {
      return 0
    }
  },

  loginFail(email) {
    try {
      const raw = JSON.parse(localStorage.getItem('fnahs-login-lock') || '{}')
      const e = (email || '').trim().toLowerCase()
      const slot = raw[e] || { fails: 0 }
      slot.fails = (slot.fails || 0) + 1
      if (slot.fails >= 5) slot.until = Date.now() + 60_000
      raw[e] = slot
      localStorage.setItem('fnahs-login-lock', JSON.stringify(raw))
    } catch {
      /* ignore */
    }
  },

  loginSuccess(email) {
    try {
      const raw = JSON.parse(localStorage.getItem('fnahs-login-lock') || '{}')
      delete raw[(email || '').trim().toLowerCase()]
      localStorage.setItem('fnahs-login-lock', JSON.stringify(raw))
    } catch {
      /* ignore */
    }
  },

  /** password strength 0–3; level 1 needs ≥ 8 chars with letter + number */
  passwordStrength(pw) {
    let s = 0
    if (!pw) return 0
    if (pw.length >= 8) s++
    if (/[a-zA-Z]/.test(pw) && /\d/.test(pw)) s++
    if (/[^a-zA-Z0-9]/.test(pw)) s++
    return s
  },

  /** append to the server-side audit log (fire-and-forget, never throws) */
  logAudit(action, entity, entityId = null, meta = {}) {
    if (!SUPABASE_ENABLED || !supabase) return Promise.resolve()
    return supabase
      .rpc('log_audit', { p_action: action, p_entity: entity, p_entity_id: entityId || null, p_meta: meta })
      .then(({ error }) => {
        if (error) console.warn('audit log skipped:', error.message)
      })
      .catch(() => {})
  },

  /** recent audit rows — console officers only (RPC enforces) */
  getAuditLogs: offlineRead(
    'getAuditLogs',
    async (limit = 100) => {
      const { data, error } = await supabase.rpc('get_audit_logs', { p_limit: limit })
      if (error) throw error
      return data || []
    },
    async () => []
  ),

  /* ---- MFA (TOTP) for officer accounts ---- */

  mfaListFactors() {
    if (!SUPABASE_ENABLED || !supabase) return Promise.resolve([])
    return supabase.auth.mfa.listFactors().then(({ data, error }) => (error ? [] : data.all || []))
  },

  async mfaEnroll() {
    if (!SUPABASE_ENABLED || !supabase) throw new Error('MFA is only available in the live deployment.')
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
    if (error) throw error
    return data
  },

  async mfaChallenge(factorId) {
    if (!SUPABASE_ENABLED || !supabase) throw new Error('MFA is only available in the live deployment.')
    const { data, error } = await supabase.auth.mfa.challenge({ factorId })
    if (error) throw error
    return data.id
  },

  async mfaVerify(factorId, challengeId, code) {
    if (!SUPABASE_ENABLED || !supabase) throw new Error('MFA is only available in the live deployment.')
    const { data, error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: String(code || '').trim() })
    if (error) throw error
    return data
  },

  async mfaUnenroll(factorId) {
    if (!SUPABASE_ENABLED || !supabase) return
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    if (error) throw error
  },
}
