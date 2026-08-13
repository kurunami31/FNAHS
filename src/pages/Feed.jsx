import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Heart, MessageCircle, Archive, Trash2, ImagePlus, Send, ChevronDown, ChevronUp, Newspaper,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { initials, timeAgo } from '../lib/format'

export default function Feed() {
  const { user, toast, isDemo } = useApp()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [image, setImage] = useState(null)
  const [imageData, setImageData] = useState(null)
  const [posting, setPosting] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    try {
      setPosts(await api.getPosts())
    } catch (e) {
      console.error(e)
      toast('Could not load the feed', 'err')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => {
    if (!q.trim()) return posts
    const needle = q.toLowerCase()
    return posts.filter(
      (p) =>
        p.content?.toLowerCase().includes(needle) ||
        p.author?.full_name?.toLowerCase().includes(needle) ||
        p.comments?.some((c) => c.content?.toLowerCase().includes(needle))
    )
  }, [posts, q])

  const submit = async () => {
    if (!content.trim() && !imageData) return
    setPosting(true)
    try {
      await api.createPost({ content: content.trim(), image_url: imageData })
      toast('Posted')
      setContent('')
      setImageData(null)
      setImage(null)
      await load()
    } catch (e) {
      console.error(e)
      toast('Could not post', 'err')
    } finally {
      setPosting(false)
    }
  }

  const pickImage = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      toast('Image too large (max 4MB)', 'err')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setImageData(reader.result)
      setImage(file.name)
    }
    reader.readAsDataURL(file)
  }

  const onLike = async (id) => {
    try {
      const likes = await api.toggleLike(id)
      setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, likes } : p)))
    } catch (e) {
      console.error(e)
    }
  }

  const onComment = async (id, text) => {
    if (!text.trim()) return
    try {
      await api.addComment(id, text.trim())
      toast('Comment posted')
      await load()
    } catch (e) {
      toast('Could not comment', 'err')
    }
  }

  const onArchive = async (id) => {
    try {
      await api.archivePost(id)
      toast('Archived')
      await load()
    } catch (e) {
      toast('Could not archive', 'err')
    }
  }

  const onDelete = async (id) => {
    try {
      await api.deletePost(id)
      toast('Deleted')
      await load()
    } catch (e) {
      toast('Could not delete', 'err')
    }
  }

  return (
    <div>
      <h1 className="page-title">FEED</h1>
      <p className="page-sub">
        {q ? `Results for “${q}”` : 'Org announcements, study tips, and community posts.'}
        {q && (
          <button className="btn btn--ghost btn--sm" style={{ marginLeft: 10 }} onClick={() => setParams({})}>
            Clear
          </button>
        )}
      </p>

      <div className="composer">
        <div className="avatar">
          {user?.avatar_url ? <img src={user.avatar_url} alt="" /> : initials(user?.full_name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <textarea
            placeholder="Share something with the FNAHS community…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          {image && (
            <span className="chip chip--accent" style={{ marginTop: 6 }}>
              📎 {image}
              <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => { setImage(null); setImageData(null) }}>
                <Trash2 size={13} />
              </button>
            </span>
          )}
        </div>
        <div className="composer-side">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImage} />
          <button className="icon-btn" title="Attach an image" onClick={() => fileRef.current?.click()}>
            <ImagePlus size={20} />
          </button>
          <button className="btn btn--primary btn--sm" disabled={posting || (!content.trim() && !imageData)} onClick={submit}>
            <Send size={14} /> Post
          </button>
        </div>
      </div>

      {loading && (
        <div className="empty-state">
          <div className="typing" style={{ justifyContent: 'center' }}><i /><i /><i /></div>
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="empty-state">
          <Newspaper size={44} />
          <h3>{q ? 'No matches' : 'Feed is empty'}</h3>
          <p>{q ? `Nothing found for “${q}”.` : 'Be the first to post something for the org.'}</p>
        </div>
      )}

      {visible.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          meId={user?.id}
          canModerate={isDemo || user?.id === p.user_id || ['staff', 'superadmin'].includes(user?.role)}
          onLike={onLike}
          onComment={onComment}
          onArchive={onArchive}
          onDelete={onDelete}
          onZoom={setLightbox}
        />
      ))}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Post" />
        </div>
      )}
    </div>
  )
}

function PostCard({ post, meId, canModerate, onLike, onComment, onArchive, onDelete, onZoom }) {
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comment, setComment] = useState('')
  const liked = post.likes?.includes(meId)

  return (
    <article className="post-card">
      <div className="post-head">
        <div className="avatar" style={{ width: 40, height: 40 }}>
          {post.author?.avatar_url ? <img src={post.author.avatar_url} alt="" /> : initials(post.author?.full_name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="post-author">{post.author?.full_name || 'FNAHS'}</div>
          <div className="post-time">{timeAgo(post.created_at)} · {post.author?.program || 'student'}</div>
        </div>
        {canModerate && (
          <div style={{ display: 'flex', gap: 2 }}>
            <button className="icon-btn" title="Archive" onClick={() => onArchive(post.id)}>
              <Archive size={16} />
            </button>
            <button className="icon-btn" title="Delete" onClick={() => onDelete(post.id)}>
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      <p className="post-body">{post.content}</p>
      {post.image_url && (
        <img className="post-img" src={post.image_url} alt="Post attachment" onClick={() => onZoom(post.image_url)} />
      )}

      <div className="post-actions">
        <button className={`post-action ${liked ? 'post-action--on' : ''}`} onClick={() => onLike(post.id)}>
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} /> {post.likes?.length || 0}
        </button>
        <button className="post-action" onClick={() => setCommentsOpen((o) => !o)}>
          <MessageCircle size={16} /> {post.comments?.length || 0}
          {commentsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {commentsOpen && (
        <div style={{ marginTop: 8 }}>
          {post.comments?.map((c) => (
            <div className="comment" key={c.id}>
              <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                {initials(c.user_id === meId ? 'You' : c.user_id?.slice(0, 1))}
              </div>
              <div className="c-body">
                <span className="c-author">{c.user_id === meId ? 'You' : 'Member'}</span>
                {c.content}
                <div className="c-time">{timeAgo(c.created_at)}</div>
              </div>
            </div>
          ))}
          <form
            className="comment-input"
            onSubmit={(e) => {
              e.preventDefault()
              onComment(post.id, comment)
              setComment('')
            }}
          >
            <input placeholder="Write a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
            <button className="btn btn--primary btn--sm" disabled={!comment.trim()}>
              <Send size={13} />
            </button>
          </form>
        </div>
      )}
    </article>
  )
}
