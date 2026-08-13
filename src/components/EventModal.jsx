import { useEffect, useState } from 'react'
import { X, Clock, MapPin, Users, QrCode, Check } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { initials, monthDay, fmtDateTime } from '../lib/format'

export default function EventModal({ event, onClose, onChanged }) {
  const { user, toast } = useApp()
  const [members, setMembers] = useState([])
  const [scanned, setScanned] = useState(null)
  const [busy, setBusy] = useState(false)

  const isStaff = ['staff', 'moderator', 'superadmin'].includes(user?.role)

  useEffect(() => {
    api.getMembers().then(setMembers).catch(() => {})
    api
      .getAttendance(event.id)
      .then((rows) => setScanned(rows.length))
      .catch(() => {})
  }, [event.id])

  const goingIds = Object.entries(event.rsvps || {})
    .filter(([, s]) => s === 'going')
    .map(([id]) => id)
  const byName = Object.fromEntries(members.map((m) => [m.id, m]))
  const goingList = goingIds.map((id) => byName[id]).filter(Boolean)
  const mine = event.rsvps?.[user?.id]

  const toggleRsvp = async () => {
    setBusy(true)
    try {
      await api.setRsvp(event.id, mine === 'going' ? 'none' : 'going')
      toast(mine === 'going' ? 'RSVP cancelled' : 'Marked as going')
      onChanged?.()
    } catch (e) {
      console.error(e)
      toast('RSVP failed', 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal event-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={event.title}>
        <div className="evm-head">
          <div className="evm-date">
            <b>{monthDay(event.starts_at).day}</b>
            <span>{monthDay(event.starts_at).month}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>{event.title}</h3>
            <div className="evm-tags">
              {isStaff && scanned != null && (
                <span className="chip chip--ok"><QrCode size={12} /> {scanned} scanned</span>
              )}
              <span className="chip">{new Date(event.starts_at) < Date.now() ? 'ongoing / past' : 'upcoming'}</span>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close event">
            <X size={18} />
          </button>
        </div>

        <div className="evm-meta">
          <span><Clock size={14} /> {fmtDateTime(event.starts_at)} → {fmtDateTime(event.ends_at)}</span>
          <span><MapPin size={14} /> {event.location}</span>
          <span><Users size={14} /> {goingIds.length} going</span>
        </div>

        {event.description && <p className="event-desc" style={{ marginTop: 16 }}>{event.description}</p>}

        <div className="evm-sec">
          <h5>Attendees</h5>
          {goingList.length === 0 ? (
            <p className="panel-muted">No one has RSVP'd yet — be the first.</p>
          ) : (
            <div className="evm-go">
              {goingList.slice(0, 14).map((m) => (
                <div key={m.id} className="evm-go-item" title={m.full_name}>
                  <div className="member-av">{m.avatar_url ? <img src={m.avatar_url} alt="" /> : initials(m.full_name)}</div>
                  <span>{m.full_name}</span>
                </div>
              ))}
              {goingList.length > 14 && (
                <div className="evm-go-item"><span className="chip">+{goingList.length - 14} more</span></div>
              )}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>Close</button>
          <button className={`btn ${mine === 'going' ? 'btn--danger' : 'btn--primary'}`} disabled={busy} onClick={toggleRsvp}>
            {mine === 'going' ? <Check size={15} /> : <Check size={15} />}{' '}
            {busy ? 'Saving…' : mine === 'going' ? 'Cancel RSVP' : 'Mark as going'}
          </button>
        </div>
      </div>
    </div>
  )
}