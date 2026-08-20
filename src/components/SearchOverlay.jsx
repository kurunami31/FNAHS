import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { api } from '../lib/api'
import { initials } from '../lib/format'
import { useApp } from '../context/AppContext'
import { can } from '../rbac'

export default function SearchOverlay({ onClose }) {
  const { user } = useApp()
  const canDirectory = can(user, 'directory.view')
  const [q, setQ] = useState('')
  const [results, setResults] = useState({ posts: [], members: [] })
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) {
      setResults({ posts: [], members: [] })
      return
    }
    let alive = true
    const timer = setTimeout(() => {
      Promise.all([
        api.getPosts().catch(() => []),
        canDirectory ? api.getMembers().catch(() => []) : Promise.resolve([]),
      ]).then(([posts, members]) => {
        if (!alive) return
        setResults({
          posts: posts
            .filter((p) => p.content?.toLowerCase().includes(needle) || p.author?.full_name?.toLowerCase().includes(needle))
            .slice(0, 4),
          members: members
            .filter((m) => m.full_name?.toLowerCase().includes(needle) || m.program?.toLowerCase().includes(needle))
            .slice(0, 4),
        })
      })
    }, 250)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [q, canDirectory])

  const go = (to) => {
    onClose()
    navigate(to)
  }

  const total = results.posts.length + results.members.length

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-field" onClick={(e) => e.stopPropagation()}>
        <Search size={18} style={{ color: 'var(--gold)' }} />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={canDirectory ? 'Search posts, members, programs…' : 'Search posts, events, programs…'}
          aria-label="Search the community"
        />
        <button className="icon-btn" onClick={onClose} aria-label="Close search">
          <X size={18} />
        </button>
      </div>
      <div className="search-hint">
        {q.trim() ? `${total} result${total === 1 ? '' : 's'} — press Esc to close` : 'type to search the community · Ctrl+K to open'}
      </div>
      <div className="search-results">
        {results.members.map((m) => (
          <button key={m.id} className="member-card" onClick={() => go('/app/directory')} style={{ textAlign: 'left', cursor: 'pointer' }}>
            <div className="member-av">{m.avatar_url ? <img src={m.avatar_url} alt="" /> : initials(m.full_name)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="member-name">{m.full_name}</div>
              <div className="member-meta">{m.program || 'Student'}{m.role !== 'faculty' ? ` · YR ${m.year_level || '—'}` : ''}</div>
            </div>
            <span className="chip" style={{ marginLeft: 'auto' }}>directory</span>
          </button>
        ))}
        {results.posts.map((p) => (
          <button key={p.id} className="member-card" onClick={() => go('/app/feed')} style={{ textAlign: 'left', cursor: 'pointer' }}>
            <div className="member-av">{initials(p.author?.full_name)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="member-name">{p.author?.full_name}</div>
              <div className="member-meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.content}</div>
            </div>
            <span className="chip" style={{ marginLeft: 'auto' }}>post</span>
          </button>
        ))}
      </div>
    </div>
  )
}