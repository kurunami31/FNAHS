import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Heart, MessageCircle, Archive, Trash2, ImagePlus, Send, ChevronDown, ChevronUp, Newspaper, Pencil, X,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { can } from '../rbac'
import { api } from '../lib/api'
import { pickImageFile } from '../lib/image'
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
  const [hasMore, setHasMore] = useState(false)
  const fileRef = useRef(null)

  const load = useCallback(async (start = 0, append = false) => {
    try {
      const rows = await api.getPosts({ from: start, to: start + 59 })
      setPosts((prev) => (append ? [...prev, ...rows] : rows))
      setHasMore(rows.length === 60)
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
    pickImageFile(e.target.files?.[0], toast, (dataUrl, name) => {
      setImageData(dataUrl)
      setImage(name)
    })
    e.target.value = ''
  }

  const onLike = async (id) => {
    try {
      const likes = await api.toggleLike(id)
      setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, likes } : p)))
    } catch (e) {
      console.error(e)
    }
  }

  const onComment = async (id, text, image, parentId) => {
    if (!text.trim() && !image) return
    try {
      await api.addComment(id, text.trim(), image, parentId)
      toast(parentId ? 'Reply posted' : 'Comment posted')
      await load()
    } catch (e) {
      console.error('comment failed', e)
      toast(e?.message ? `Could not comment: ${e.message}` : 'Could not comment', 'err')
    }
  }

  const onEditComment = async (id, text, image) => {
    if (!text.trim()) return
    try {
      await api.updateComment(id, text.trim(), image)
      toast('Comment updated')
      await load()
    } catch (e) {
      console.error(e)
      toast('Could not update comment', 'err')
    }
  }

  const onDeleteComment = async (c) => {
    if (!window.confirm('Delete this comment?')) return
    try {
      await api.deleteComment(c.id)
      toast('Comment deleted')
      await load()
    } catch (e) {
      console.error(e)
      toast('Could not delete comment', 'err')
    }
  }

  const onArchive = async (id) => {
    try {
      await api.archivePost(id)
      toast('Archived')
      await load()
    } catch {
      toast('Could not archive', 'err')
    }
  }

  const onDelete = async (id) => {
    try {
      await api.deletePost(id)
      toast('Deleted')
      await load()
    } catch {
      toast('Could not delete', 'err')
    }
  }

  const onEditPost = async (id, content) => {
    try {
      await api.updatePost(id, { content })
      toast('Post updated')
      await load()
    } catch (e) {
      console.error(e)
      toast('Could not update the post', 'err')
    }
  }

  return (
    <div className="page-c">
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
            placeholder="Share something with the FNAHS PULSO community…"
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
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={pickImage} />
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
          canModerate={isDemo || user?.id === p.user_id || can(user, 'feed.moderate')}
          onLike={onLike}
          onComment={onComment}
          onEditComment={onEditComment}
          onDeleteComment={onDeleteComment}
          onArchive={onArchive}
          onDelete={onDelete}
          onEdit={onEditPost}
          onZoom={setLightbox}
        />
      ))}

      {hasMore && !q && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
          <button className="btn btn--ghost" onClick={() => load(posts.length, true)}>
            Load older posts
          </button>
        </div>
      )}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Post" />
        </div>
      )}
    </div>
  )
}

function PostCard({ post, meId, canModerate, onLike, onComment, onEditComment, onDeleteComment, onArchive, onDelete, onZoom, onEdit }) {
  const { toast } = useApp()
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [commentImg, setCommentImg] = useState(null)
  const [commentImgName, setCommentImgName] = useState(null)
  const commentFileRef = useRef(null)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [editImg, setEditImg] = useState(null)
  const [editImgName, setEditImgName] = useState(null)
  const [editRemoveImg, setEditRemoveImg] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const editFileRef = useRef(null)
  const [replyingTo, setReplyingTo] = useState(null)
  const liked = post.likes?.includes(meId)
  const isAuthor = post.user_id === meId

  // ---- author editing for the top-level post ----
  const [postEditing, setPostEditing] = useState(false)
  const [postText, setPostText] = useState('')
  const [savingPost, setSavingPost] = useState(false)

  const savePostEdit = async () => {
    if (!postText.trim() || savingPost) return
    setSavingPost(true)
    try {
      await onEdit(post.id, postText.trim())
      setPostEditing(false)
    } finally {
      setSavingPost(false)
    }
  }

  const commentName = (uid) => (uid === meId ? 'You' : 'Member')

  const roots = []
  const repliesByRoot = {}
  for (const c of post.comments || []) {
    if (c.parent_id && (post.comments || []).some((x) => x.id === c.parent_id)) {
      ;(repliesByRoot[c.parent_id] ||= []).push(c)
    } else {
      roots.push(c)
    }
  }

  const startReply = (c) => {
    const rootId = c.parent_id || c.id
    setReplyingTo({ rootId, name: commentName(c.user_id) })
  }

  const renderComment = (c, isReply) => {
    const isMine = c.user_id === meId
    const editing = editingId === c.id
    const replyTarget = c.parent_id ? (post.comments || []).find((x) => x.id === c.parent_id) : null
    return (
      <div className={isReply ? 'comment comment--reply' : 'comment'} key={c.id}>
        <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
          {initials(commentName(c.user_id))}
        </div>
        <div className="c-body">
          <div className="c-top">
            <span className="c-author">{commentName(c.user_id)}</span>
            <button type="button" className="c-reply-btn" onClick={() => startReply(c)}>Reply</button>
            {(isMine || canModerate) && !editing && (
              <span className="c-actions">
                {isMine && (
                  <button className="icon-btn" title="Edit" onClick={() => startEdit(c)}>
                    <Pencil size={12} />
                  </button>
                )}
                <button className="icon-btn icon-btn--danger" title="Delete" onClick={() => onDeleteComment(c)}>
                  <Trash2 size={12} />
                </button>
              </span>
            )}
          </div>
          {editing ? (
            <div className="comment-edit">
              <textarea value={editText} onChange={(e) => setEditText(e.target.value)} />
              <div className="comment-edit-row">
                <input
                  ref={editFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  hidden
                  onChange={(e) => {
                    pickImageFile(e.target.files?.[0], toast, (dataUrl, name) => {
                      setEditImg(dataUrl)
                      setEditImgName(name)
                      setEditRemoveImg(false)
                    })
                    e.target.value = ''
                  }}
                />
                <button type="button" className="icon-btn" title="Attach a photo" onClick={() => editFileRef.current?.click()}>
                  <ImagePlus size={14} />
                </button>
                {editImgName ? (
                  <span className="chip chip--accent" style={{ fontSize: 11, padding: '2px 8px' }}>
                    📎 {editImgName}
                  </span>
                ) : c.image_url && !editRemoveImg ? (
                  <span className="chip chip--accent" style={{ fontSize: 11, padding: '2px 8px' }}>
                    📷 has photo
                    <button className="icon-btn" style={{ width: 18, height: 18 }} onClick={() => setEditRemoveImg(true)}>
                      <X size={11} />
                    </button>
                  </span>
                ) : editRemoveImg && !editImg ? (
                  <span className="chip chip--archived" style={{ fontSize: 11, padding: '2px 8px' }}>photo removed</span>
                ) : null}
                <span style={{ flex: 1 }} />
                <button type="button" className="btn btn--ghost btn--sm" onClick={cancelEdit}>Cancel</button>
                <button type="button" className="btn btn--primary btn--sm" disabled={savingEdit || !editText.trim()} onClick={() => saveEdit(c)}>
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              {replyTarget && (
                <span className="c-reply-to">↪ {commentName(replyTarget.user_id)}</span>
              )}
              {c.content}
              {c.image_url && (
                <img className="comment-img" src={c.image_url} alt="Comment attachment" onClick={() => onZoom(c.image_url)} />
              )}
            </>
          )}
          <div className="c-time">{timeAgo(c.created_at)}</div>
        </div>
      </div>
    )
  }

  const startEdit = (c) => {
    setEditingId(c.id)
    setEditText(c.content || '')
    setEditImg(null)
    setEditImgName(null)
    setEditRemoveImg(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
    setEditImg(null)
    setEditImgName(null)
    setEditRemoveImg(false)
  }

  const saveEdit = async (c) => {
    if (!editText.trim() || savingEdit) return
    setSavingEdit(true)
    try {
      const image = editImg || (editRemoveImg ? null : c.image_url)
      await onEditComment(c.id, editText.trim(), image)
      cancelEdit()
    } finally {
      setSavingEdit(false)
    }
  }

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
        {(isAuthor || canModerate) && (
          <div style={{ display: 'flex', gap: 2 }}>
            {isAuthor && !postEditing && (
              <button className="icon-btn" title="Edit post" onClick={() => { setPostEditing(true); setPostText(post.content || '') }}>
                <Pencil size={16} />
              </button>
            )}
            {canModerate && (
              <>
                <button className="icon-btn" title="Archive" onClick={() => onArchive(post.id)}>
                  <Archive size={16} />
                </button>
                <button className="icon-btn" title="Delete" onClick={() => onDelete(post.id)}>
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {postEditing ? (
        <div className="comment-edit">
          <textarea value={postText} onChange={(e) => setPostText(e.target.value)} rows={3} autoFocus />
          <div className="comment-edit-row">
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setPostEditing(false); setPostText('') }}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary btn--sm" disabled={savingPost || !postText.trim()} onClick={savePostEdit}>
              Save
            </button>
          </div>
        </div>
      ) : (
        <p className="post-body">{post.content}</p>
      )}
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
          {roots.map((c) => {
            const replies = repliesByRoot[c.id] || []
            return (
              <div key={c.id}>
                {renderComment(c, false)}
                {replies.map((r) => renderComment(r, true))}
              </div>
            )
          })}
          {replyingTo && (
            <div className="c-replying">
              <span>Replying to <b>{replyingTo.name}</b></span>
              <button className="icon-btn" title="Cancel reply" onClick={() => setReplyingTo(null)}>
                <X size={12} />
              </button>
            </div>
          )}
          {commentImgName && (
            <span className="chip chip--accent" style={{ marginTop: 8 }}>
              📎 {commentImgName}
              <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => { setCommentImg(null); setCommentImgName(null) }}>
                <Trash2 size={13} />
              </button>
            </span>
          )}
          <form
            className="comment-input"
            onSubmit={(e) => {
              e.preventDefault()
              if (!comment.trim() && !commentImg) return
              onComment(post.id, comment, commentImg, replyingTo?.rootId)
              setComment('')
              setCommentImg(null)
              setCommentImgName(null)
              setReplyingTo(null)
            }}
          >
            <input placeholder="Write a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
            <input
              ref={commentFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              hidden
              onChange={(e) => {
                pickImageFile(e.target.files?.[0], toast, (dataUrl, name) => {
                  setCommentImg(dataUrl)
                  setCommentImgName(name)
                })
                e.target.value = ''
              }}
            />
            <button type="button" className="icon-btn" title="Attach a photo" onClick={() => commentFileRef.current?.click()}>
              <ImagePlus size={16} />
            </button>
            <button className="btn btn--primary btn--sm" disabled={!comment.trim() && !commentImg}>
              <Send size={13} />
            </button>
          </form>
        </div>
      )}
    </article>
  )
}
