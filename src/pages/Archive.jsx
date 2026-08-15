import { useCallback, useEffect, useState } from 'react'
import { Archive as ArchiveIcon, Clock3, Inbox, RotateCcw, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { can } from '../rbac'
import { api } from '../lib/api'
import { initials, timeAgo, monthDay } from '../lib/format'

export default function Archive() {
  const { user, toast, isDemo } = useApp()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState(null)

  const load = useCallback(async () => {
    try {
      setPosts(await api.getArchivedPosts())
    } catch (e) {
      console.error(e)
      toast('Could not load the archive', 'err')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const onUnarchive = async (p) => {
    try {
      await api.unarchivePost(p.id)
      toast('Post restored to the feed')
      setPosts((ps) => ps.filter((x) => x.id !== p.id))
    } catch (e) {
      console.error(e)
      toast('Could not restore the post', 'err')
    }
  }

  const onDelete = async (p) => {
    if (!window.confirm('Permanently delete this post and its comments?')) return
    try {
      await api.deletePost(p.id)
      toast('Post permanently deleted')
      setPosts((ps) => ps.filter((x) => x.id !== p.id))
    } catch (e) {
      console.error(e)
      toast('Could not delete the post', 'err')
    }
  }

  return (
    <div className="page-c">
      <h1 className="page-title">
        ARCHIVE <span className="page-kicker">moderated posts</span>
      </h1>
      <p className="page-sub">Posts that have been archived still live here, read-only — they are just no longer in the feed.</p>

      {loading && (
        <div className="empty-state">
          <div className="typing" style={{ justifyContent: 'center' }}><i /><i /><i /></div>
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="empty-state">
          <Inbox size={44} />
          <h3>Archive is empty</h3>
          <p>Nothing has been archived yet — posts stay in the feed until an admin tucks them away.</p>
        </div>
      )}

      {posts.map((p) => (
        <article className="post-card" key={p.id}>
          <div className="post-head">
            <div className="avatar" style={{ width: 40, height: 40 }}>
              {p.author?.avatar_url ? <img src={p.author.avatar_url} alt="" /> : initials(p.author?.full_name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="post-author">{p.author?.full_name || 'FNAHS'}</div>
              <div className="post-time">{timeAgo(p.created_at)} · {p.author?.program || 'student'}</div>
            </div>
            <span className="chip chip--archived" title={`Archived ${timeAgo(p.archived_at)}`}>
              <Clock3 size={12} /> Archived {monthDay(p.archived_at).day} {monthDay(p.archived_at).month}
            </span>
          </div>

          <p className="post-body">{p.content}</p>
          {p.image_url && (
            <img className="post-img" src={p.image_url} alt="Post attachment" onClick={() => setLightbox(p.image_url)} />
          )}

          {(isDemo || user?.id === p.user_id || can(user, 'feed.moderate')) && (
            <div className="post-actions">
              <button className="post-action" title="Restore to the feed" onClick={() => onUnarchive(p)}>
                <RotateCcw size={16} /> Unarchive
              </button>
              <button className="post-action" title="Delete permanently" onClick={() => onDelete(p)}>
                <Trash2 size={16} /> Delete permanently
              </button>
            </div>
          )}
        </article>
      ))}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Post" />
        </div>
      )}
    </div>
  )
}