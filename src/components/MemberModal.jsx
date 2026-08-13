import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Newspaper, CalendarDays } from 'lucide-react'
import { api } from '../lib/api'
import { initials, timeAgo } from '../lib/format'
import { roleLabel, positionLabel } from '../rbac'

export default function MemberModal({ member, onClose }) {
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])
  const [going, setGoing] = useState([])

  useEffect(() => {
    if (!member) return
    let alive = true
    api.getPosts().then((all) => alive && setPosts(all.filter((p) => p.author?.id === member.id).slice(0, 4))).catch(() => {})
    api.getEvents().then((evs) => alive && setGoing(evs.filter((e) => e.rsvps?.[member.id] === 'going').slice(0, 3))).catch(() => {})
    return () => {
      alive = false
    }
  }, [member])

  if (!member) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal member-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Profile of ${member.full_name}`}>
        <div className="mm-head">
          <div className="mm-avatar">
            {member.avatar_url ? <img src={member.avatar_url} alt="" /> : initials(member.full_name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 className="mm-name">{member.full_name}</h3>
            <div className="mm-role">
              <span className="badge badge--done">{roleLabel(member.role)}</span>
              <span className="chip">{member.program || '—'} · YR {member.year_level || '—'}</span>
            </div>
            {!!member.positions?.length && (
              <div className="mm-positions">
                {member.positions.map((p) => (
                  <span key={p} className="badge">{positionLabel(p)}</span>
                ))}
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close profile">
            <X size={18} />
          </button>
        </div>

        <div className="mm-stats">
          <div className="mm-stat">
            <b>{posts.length}</b>
            <span>posts</span>
          </div>
          <div className="mm-stat">
            <b>{going.length}</b>
            <span>events going</span>
          </div>
          <div className="mm-stat">
            <b>{roleLabel(member.role)}</b>
            <span>role</span>
          </div>
        </div>

        {going.length > 0 && (
          <div className="mm-sec">
            <h5><CalendarDays size={14} /> On the rounds</h5>
            <div className="mm-chips">
              {going.map((e) => (
                <span key={e.id} className="chip chip--ok">{e.title}</span>
              ))}
            </div>
          </div>
        )}

        {posts.length > 0 && (
          <div className="mm-sec">
            <h5><Newspaper size={14} /> Recent posts</h5>
            {posts.map((p) => (
              <button
                key={p.id}
                className="mm-post"
                onClick={() => {
                  onClose()
                  navigate('/app/feed')
                }}
              >
                <div className="mm-post-title">{p.content}</div>
                <div className="mm-post-meta">{timeAgo(p.created_at)} · {p.likes?.length || 0} likes</div>
              </button>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>Close</button>
          <button
            className="btn btn--primary"
            onClick={() => {
              onClose()
              navigate('/app/directory')
            }}
          >
            Directory
          </button>
        </div>
      </div>
    </div>
  )
}