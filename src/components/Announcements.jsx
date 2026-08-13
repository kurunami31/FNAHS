import { useEffect, useState } from 'react'
import { Megaphone, Pin, Pencil, Trash2, Plus, X, Send } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { can } from '../rbac'
import { api } from '../lib/api'
import { initials, timeAgo, fullDate } from '../lib/format'

export default function Announcements() {
  const { user, toast } = useApp()
  const [items, setItems] = useState(null)
  const [composing, setComposing] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', pinned: false })

  const canPost = can(user, 'announcements.post')

  const load = async () => {
    try {
      const rows = await api.getAnnouncements()
      setItems(rows)
    } catch {
      setItems([])
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (items === null) return null
  if (!items.length && !canPost) return null

  const submit = async () => {
    if (!form.title.trim()) {
      toast('An announcement needs a title', 'err')
      return
    }
    try {
      const row = await api.createAnnouncement({ title: form.title.trim(), body: form.body.trim(), pinned: form.pinned })
      setItems((a) => [row, ...a])
      setForm({ title: '', body: '', pinned: false })
      setComposing(false)
      toast('Announcement posted')
    } catch (e) {
      console.error(e)
      toast(e.message?.includes('announcer') ? 'Only announcers can post announcements' : 'Could not post', 'err')
    }
  }

  const togglePin = async (a) => {
    try {
      await api.updateAnnouncement(a.id, { pinned: !a.pinned })
      setItems((list) => list.map((x) => (x.id === a.id ? { ...x, pinned: !x.pinned } : x)))
    } catch (e) {
      console.error(e)
      toast('Could not update the announcement', 'err')
    }
  }

  const remove = async (a) => {
    if (!window.confirm(`Delete this announcement?`)) return
    try {
      await api.deleteAnnouncement(a.id)
      setItems((list) => list.filter((x) => x.id !== a.id))
      toast('Announcement deleted')
    } catch (e) {
      console.error(e)
      toast('Could not delete', 'err')
    }
  }

  const author = (a) => (a.profiles ? `${a.profiles.full_name || 'FNAHS'}` : 'FNAHS')

  return (
    <section className="sec ann-sec" aria-labelledby="h-ann">
      <div className="sec-head">
        <h2 id="h-ann"><Megaphone size={17} /> Announcements</h2>
        <span className="chip chip--gold">{items.length} active</span>
        {canPost && !composing && (
          <button className="btn btn--ghost btn--sm" onClick={() => setComposing(true)}>
            <Plus size={14} /> Post
          </button>
        )}
      </div>

      {composing && (
        <div className="panel ann-composer">
          <div className="field">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Headline (required)"
              maxLength={200}
            />
          </div>
          <div className="field">
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Details…"
              rows={3}
              maxLength={2000}
            />
          </div>
          <div className="ann-composer-actions">
            <label className="ann-pin">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
              Pin to top
            </label>
            <button className="btn btn--ghost btn--sm" onClick={() => setComposing(false)}>
              <X size={14} /> Cancel
            </button>
            <button className="btn btn--primary btn--sm" onClick={submit}>
              <Send size={14} /> Post
            </button>
          </div>
        </div>
      )}

      <div className="ann-list">
        {items.map((a) => {
          const mine = a.author_id === user?.id
          return (
            <article key={a.id} className={`ann${a.pinned ? ' ann--pinned' : ''}`}>
              <div className="ann-pin-icon">{a.pinned && <Pin size={13} />}</div>
              <div className="ann-body">
                <div className="ann-title">{a.title}</div>
                {a.body && <div className="ann-text">{a.body}</div>}
                <div className="ann-meta">
                  <span className="ann-avatar">
                    {a.profiles?.avatar_url ? <img src={a.profiles.avatar_url} alt="" /> : initials(author(a))}
                  </span>
                  {author(a)} · {timeAgo(a.created_at)} · <span title={fullDate(a.created_at)}>{fullDate(a.created_at)}</span>
                </div>
              </div>
              {(canPost || mine) && (
                <div className="ann-actions">
                  <button className="icon-btn" title={a.pinned ? 'Unpin' : 'Pin'} onClick={() => togglePin(a)}>
                    <Pin size={14} />
                  </button>
                  <button className="icon-btn icon-btn--danger" title="Delete" onClick={() => remove(a)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}