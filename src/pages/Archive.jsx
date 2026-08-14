import { useCallback, useEffect, useState } from 'react'
import { Archive as ArchiveIcon, Clock3, Inbox } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { initials, timeAgo, monthDay } from '../lib/format'

export default function Archive() {
  const { toast } = useApp()
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