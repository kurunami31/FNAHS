import { useEffect, useMemo, useState } from 'react'
import { Users, Search } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { initials } from '../lib/format'
import { positionLabel } from '../rbac'
import MemberModal from '../components/MemberModal'

export default function Directory() {
  const { toast } = useApp()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    api
      .getMembers()
      .then(setMembers)
      .catch((e) => {
        console.error(e)
        toast('Could not load members', 'err')
      })
      .finally(() => setLoading(false))
  }, [toast])

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return members.filter(
      (m) =>
        !needle ||
        m.full_name?.toLowerCase().includes(needle) ||
        m.program?.toLowerCase().includes(needle)
    )
  }, [members, q])

  return (
    <div className="page-c">
      <h1 className="page-title">
        DIRECTORY <span className="page-kicker">members</span>
      </h1>
      <p className="page-sub">The students and faculty of the Faculty of Nursing and Allied Health Sciences.</p>

      <div className="dir-tools">
        <div className="dir-search">
          <Search size={17} />
          <input placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="member-count">
        {loading ? '…' : visible.length} <b>members</b>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="typing" style={{ justifyContent: 'center' }}><i /><i /><i /></div>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <Users size={36} />
          <h3>No members found</h3>
          <p>Try a different name or program.</p>
        </div>
      ) : (
        <div className="dir-grid">
          {visible.map((m) => (
            <div
              key={m.id}
              className="member-card"
              role="button"
              tabIndex={0}
              onClick={() => setSelected(m)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSelected(m)
                }
              }}
            >
              <div className="member-av">{m.avatar_url ? <img src={m.avatar_url} alt="" /> : initials(m.full_name)}</div>
              <div style={{ minWidth: 0 }}>
                <div className="member-name">{m.full_name}</div>
                <div className="member-meta">{m.program || 'Student'} · YR {m.year_level || '—'}{m.section ? ` · SEC ${m.section}` : ''}</div>
                {!!m.positions?.length && (
                  <div className="dir-positions">
                    {m.positions.map((p) => (
                      <span key={p} className="badge">{positionLabel(p)}</span>
                    ))}
                  </div>
                )}
              </div>
              {m.role === 'moderator' && !m.positions?.length && (
                <span className="badge badge--done" style={{ marginLeft: 'auto' }}>moderator</span>
              )}
            </div>
          ))}
        </div>
      )}

      {selected && <MemberModal member={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}