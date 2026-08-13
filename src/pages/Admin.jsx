import { useCallback, useEffect, useState } from 'react'
import { ShieldAlert, Users, Newspaper, CalendarDays, Plus, Pencil, Trash2, X, Search } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { initials, timeAgo, monthDay } from '../lib/format'
import { PROGRAMS } from '../lib/mock'

const ROLES = ['student', 'moderator', 'staff', 'superadmin']
const ADMIN_ROLES = ['superadmin', 'staff', 'moderator']

export default function Admin() {
  const { user, toast } = useApp()
  const [tab, setTab] = useState('members')
  const [members, setMembers] = useState([])
  const [posts, setPosts] = useState([])
  const [events, setEvents] = useState([])
  const [q, setQ] = useState('')
  const [memberModal, setMemberModal] = useState(null)
  const [postModal, setPostModal] = useState(null)
  const [eventModal, setEventModal] = useState(null)

  const load = useCallback(async () => {
    try {
      const [ms, ps, evs] = await Promise.all([api.getUsers(), api.getPosts(), api.getEvents()])
      setMembers(ms)
      setPosts(ps)
      setEvents(evs)
    } catch (e) {
      console.error(e)
      toast('Could not load admin data', 'err')
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  if (!ADMIN_ROLES.includes(user?.role)) {
    return (
      <div className="empty-state">
        <ShieldAlert size={44} />
        <h3>Admin console</h3>
        <p>This page is reserved for FNAHS moderators, staff, and administrators.</p>
      </div>
    )
  }

  const needle = q.trim().toLowerCase()
  const visibleMembers = members.filter(
    (m) => !needle || m.full_name?.toLowerCase().includes(needle) || m.email?.toLowerCase().includes(needle)
  )

  const changeRole = async (m, role) => {
    if (m.id === user.id && role !== 'superadmin') {
      toast('You cannot demote your own account', 'err')
      return
    }
    try {
      await api.updateUser(m.id, { role })
      setMembers((ms) => ms.map((x) => (x.id === m.id ? { ...x, role } : x)))
      toast(`${m.full_name} is now ${role}`)
    } catch (e) {
      console.error(e)
      toast('Role update failed', 'err')
    }
  }

  const removeMember = async (m) => {
    if (m.id === user.id) {
      toast('You cannot delete your own account', 'err')
      return
    }
    if (!window.confirm(`Delete ${m.full_name} and their posts?`)) return
    try {
      await api.deleteUser(m.id)
      setMembers((ms) => ms.filter((x) => x.id !== m.id))
      toast('Member deleted')
    } catch (e) {
      console.error(e)
      toast('Could not delete member', 'err')
    }
  }

  const removePost = async (p, archive) => {
    if (archive && !window.confirm('Archive this post? It disappears from the feed.')) return
    if (!archive && !window.confirm('Permanently delete this post?')) return
    try {
      if (archive) await api.archivePost(p.id)
      else await api.deletePost(p.id)
      setPosts((ps) => ps.filter((x) => x.id !== p.id))
      toast(archive ? 'Post archived' : 'Post deleted')
    } catch (e) {
      console.error(e)
      toast('Could not remove post', 'err')
    }
  }

  const removeEvent = async (e) => {
    if (!window.confirm(`Delete the event "${e.title}"?`)) return
    try {
      await api.deleteEvent(e.id)
      setEvents((evs) => evs.filter((x) => x.id !== e.id))
      toast('Event deleted')
    } catch (err) {
      console.error(err)
      toast('Could not delete event', 'err')
    }
  }

  return (
    <div className="page-c">
      <h1 className="page-title">
        ADMIN <span className="page-kicker">moderation console</span>
      </h1>
      <p className="page-sub">Create, edit, and remove members, posts, and events. Changes apply immediately.</p>

      <div className="tabs" role="tablist" aria-label="Admin sections">
        <button className={`tab-btn${tab === 'members' ? ' tab-btn--on' : ''}`} onClick={() => setTab('members')}>
          <Users size={15} /> Members
        </button>
        <button className={`tab-btn${tab === 'posts' ? ' tab-btn--on' : ''}`} onClick={() => setTab('posts')}>
          <Newspaper size={15} /> Posts
        </button>
        <button className={`tab-btn${tab === 'events' ? ' tab-btn--on' : ''}`} onClick={() => setTab('events')}>
          <CalendarDays size={15} /> Events
        </button>
      </div>

      {tab === 'members' && (
        <section className="panel">
          <div className="admin-toolbar">
            <div className="dir-search">
              <Search size={17} />
              <input placeholder="Search members…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className="btn btn--primary" onClick={() => setMemberModal({ mode: 'create' })}>
              <Plus size={15} /> Add member
            </button>
          </div>
          <div className="ledger">
            {visibleMembers.map((m) => (
              <div className="ledger-row" key={m.id}>
                <div className="avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
                  {m.avatar_url ? <img src={m.avatar_url} alt="" /> : initials(m.full_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.93rem' }}>{m.full_name}</div>
                  <div className="ledger-meta">{m.email} · {m.program || '—'} · YR {m.year_level || '—'}</div>
                </div>
                <select
                  className="role-select"
                  value={m.role}
                  aria-label={`Role of ${m.full_name}`}
                  onChange={(e) => changeRole(m, e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <div className="admin-actions">
                  <button className="icon-btn" title="Edit" onClick={() => setMemberModal({ mode: 'edit', m })}>
                    <Pencil size={15} />
                  </button>
                  <button className="icon-btn icon-btn--danger" title="Delete" onClick={() => removeMember(m)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'posts' && (
        <section className="panel">
          <div className="admin-toolbar">
            <div className="dir-search">
              <Search size={17} />
              <input placeholder="Search posts…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="ledger">
            {posts
              .filter((p) => !needle || p.content?.toLowerCase().includes(needle) || p.author?.full_name?.toLowerCase().includes(needle))
              .map((p) => (
                <div className="ledger-row" key={p.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="post-clamp">{p.content}</div>
                    <div className="ledger-meta">{p.author?.full_name || 'unknown'} · {timeAgo(p.created_at)} · {p.likes?.length || 0} likes</div>
                  </div>
                  <div className="admin-actions">
                    <button className="icon-btn" title="Edit" onClick={() => setPostModal(p)}>
                      <Pencil size={15} />
                    </button>
                    <button className="icon-btn" title="Archive" onClick={() => removePost(p, true)}>
                      <X size={15} />
                    </button>
                    <button className="icon-btn icon-btn--danger" title="Delete" onClick={() => removePost(p, false)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {tab === 'events' && (
        <section className="panel">
          <div className="ledger">
            {events.map((e) => (
              <div className="ledger-row" key={e.id}>
                <div className="round-date" style={{ borderRight: 'none', width: 44 }}>
                  <b style={{ fontSize: '1.15rem' }}>{monthDay(e.starts_at).day}</b>
                  <span>{monthDay(e.starts_at).month}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.93rem' }}>{e.title}</div>
                  <div className="ledger-meta">{e.location} · {timeAgo(e.starts_at)}</div>
                </div>
                <div className="admin-actions">
                  <button className="icon-btn" title="Edit" onClick={() => setEventModal(e)}>
                    <Pencil size={15} />
                  </button>
                  <button className="icon-btn icon-btn--danger" title="Delete" onClick={() => removeEvent(e)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {memberModal && (
        <MemberFormModal
          mode={memberModal.mode}
          member={memberModal.m}
          onClose={() => setMemberModal(null)}
          onSaved={(row) => {
            setMembers((ms) => (memberModal.mode === 'edit' ? ms.map((x) => (x.id === row.id ? row : x)) : [row, ...ms]))
            setMemberModal(null)
            toast(memberModal.mode === 'edit' ? 'Member updated' : 'Member created')
          }}
        />
      )}
      {postModal && (
        <PostEditModal
          post={postModal}
          onClose={() => setPostModal(null)}
          onSaved={() => {
            load()
            setPostModal(null)
            toast('Post updated')
          }}
        />
      )}
      {eventModal && (
        <EventEditModal
          event={eventModal}
          onClose={() => setEventModal(null)}
          onSaved={() => {
            load()
            setEventModal(null)
            toast('Event updated')
          }}
        />
      )}
    </div>
  )
}

function MemberFormModal({ mode, member, onClose, onSaved }) {
  const { toast } = useApp()
  const [form, setForm] = useState(() =>
    mode === 'edit'
      ? { full_name: member.full_name || '', email: member.email || '', program: member.program || PROGRAMS[0], year_level: member.year_level || '1', role: member.role || 'student' }
      : { full_name: '', email: '', program: PROGRAMS[0], year_level: '1', role: 'student' }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!form.full_name.trim() || !form.email.trim()) {
      setError('Name and email are required.')
      return
    }
    setSaving(true)
    try {
      if (mode === 'edit') {
        const row = await api.updateUser(member.id, form)
        onSaved(row || { ...member, ...form })
      } else {
        const row = await api.createUser(form)
        onSaved(row)
      }
    } catch (e) {
      console.error(e)
      setError(e.message || 'Could not save the member.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{mode === 'edit' ? 'EDIT MEMBER' : 'ADD MEMBER'}</h2>
        {error && <div className="form-error">{error}</div>}
        <div className="field">
          <label>Full name</label>
          <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Juan Dela Cruz" />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="student@fnahs.edu.ph" />
        </div>
        <div className="field">
          <label>Program</label>
          <select value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })}>
            {PROGRAMS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Year level</label>
          <select value={form.year_level} onChange={(e) => setForm({ ...form, year_level: e.target.value })}>
            {['1', '2', '3', '4', '—'].map((y) => (
              <option key={y} value={y}>{y === '—' ? 'Faculty' : `Year ${y}`}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Role</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={saving} onClick={submit}>
            {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create member'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PostEditModal({ post, onClose, onSaved }) {
  const [content, setContent] = useState(post.content || '')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!content.trim()) return
    setSaving(true)
    try {
      await api.updatePost(post.id, { content: content.trim() })
      onSaved()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>EDIT POST</h2>
        <div className="field">
          <label>Content</label>
          <textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={saving || !content.trim()} onClick={submit}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EventEditModal({ event, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: event.title || '',
    description: event.description || '',
    location: event.location || '',
    starts_at: event.starts_at ? event.starts_at.slice(0, 16) : '',
    ends_at: event.ends_at ? event.ends_at.slice(0, 16) : '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!form.title.trim() || !form.location.trim() || !form.starts_at) {
      setError('Title, location, and start time are required.')
      return
    }
    setSaving(true)
    try {
      await api.updateEvent(event.id, {
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : new Date(new Date(form.starts_at).getTime() + 2 * 3600e3).toISOString(),
      })
      onSaved()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Could not save the event.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>EDIT EVENT</h2>
        {error && <div className="form-error">{error}</div>}
        <div className="field">
          <label>Event title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="field">
          <label>Location</label>
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </div>
        <div className="field">
          <label>Starts at</label>
          <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
        </div>
        <div className="field">
          <label>Ends at <span className="hint">(optional)</span></label>
          <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
        </div>
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={saving} onClick={submit}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}