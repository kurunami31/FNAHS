import { useEffect, useState } from 'react'
import { X, Clock, MapPin, Users, QrCode, Check, BarChart3, Plus } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { canAny } from '../rbac'
import { api } from '../lib/api'
import { initials, monthDay, fmtDateTime } from '../lib/format'

export default function EventModal({ event, onClose, onChanged }) {
  const { user, toast } = useApp()
  const [scanned, setScanned] = useState(null)
  const [busy, setBusy] = useState(false)
  const [polls, setPolls] = useState(null)
  const [pollForm, setPollForm] = useState({ question: '', options: ['', ''] })

  const isStaff = canAny(user, ['attendance.scan', 'events.manage'])
  const canPoll = canAny(user, ['polls.manage', 'events.manage'])

  useEffect(() => {
    api
      .getAttendance(event.id)
      .then((rows) => setScanned(rows.length))
      .catch(() => {})
    api
      .getPolls(event.id)
      .then(setPolls)
      .catch(() => setPolls([]))
  }, [event.id])

  const castVote = async (pollId, optionId) => {
    try {
      await api.castVote(pollId, optionId)
      api
        .getPolls(event.id)
        .then(setPolls)
        .catch(() => {})
    } catch (e) {
      console.error(e)
      toast('Could not save your vote', 'err')
    }
  }

  const submitPoll = async () => {
    const labels = pollForm.options.map((o) => o.trim()).filter(Boolean)
    if (!pollForm.question.trim() || labels.length < 2) {
      toast('Add a question and at least two options', 'err')
      return
    }
    try {
      await api.createPoll(event.id, pollForm.question.trim(), labels)
      setPollForm({ question: '', options: ['', ''] })
      api
        .getPolls(event.id)
        .then(setPolls)
        .catch(() => {})
      toast('Poll created')
    } catch (e) {
      console.error(e)
      toast('Could not create the poll', 'err')
    }
  }

  const myId = user?.id
  const myVote = (p) => {
    for (const o of p.options) if (o.votes.includes(myId)) return o.id
    return null
  }

  const goingIds = Object.entries(event.rsvps || {})
    .filter(([, s]) => s === 'going')
    .map(([id]) => id)
  const byName = event.attendees || {}
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

        {polls && polls.length > 0 && (
          <div className="evm-sec">
            <h5><BarChart3 size={14} /> Polls</h5>
            {polls.map((p) => {
              const voted = myVote(p)
              const total = p.options.reduce((s, o) => s + o.votes.length, 0)
              return (
                <div key={p.id} className="poll">
                  <div className="poll-q">{p.question}</div>
                  <div className="poll-options">
                    {p.options.map((o) => {
                      const n = o.votes.length
                      const pct = total ? Math.round((n / total) * 100) : 0
                      const isMine = voted === o.id
                      return (
                        <button
                          key={o.id}
                          className={`poll-opt${isMine ? ' poll-opt--mine' : ''}`}
                          disabled={!!voted}
                          onClick={() => castVote(p.id, o.id)}
                        >
                          <span className="poll-fill" style={{ width: voted ? `${pct}%` : 0 }} />
                          <span className="poll-label">{o.label}</span>
                          {voted && <span className="poll-pct">{n} · {pct}%</span>}
                          {isMine && <Check size={14} />}
                        </button>
                      )
                    })}
                  </div>
                  <div className="poll-meta">
                    {voted ? `${total} vote${total === 1 ? '' : 's'} — you voted` : 'Pick one — results show after you vote'}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {canPoll && (
          <div className="evm-sec">
            <h5><Plus size={14} /> New poll</h5>
            <div className="field" style={{ marginBottom: 8 }}>
              <input
                value={pollForm.question}
                onChange={(e) => setPollForm({ ...pollForm, question: e.target.value })}
                placeholder="Question (e.g. Which date works for the outreach?)"
                maxLength={300}
              />
            </div>
            {pollForm.options.map((o, i) => (
              <div className="field" style={{ marginBottom: 6 }} key={i}>
                <input
                  value={o}
                  onChange={(e) => {
                    const options = [...pollForm.options]
                    options[i] = e.target.value
                    setPollForm({ ...pollForm, options })
                  }}
                  placeholder={`Option ${i + 1}`}
                  maxLength={120}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setPollForm({ ...pollForm, options: [...pollForm.options, ''] })}
              >
                <Plus size={13} /> Add option
              </button>
              <button className="btn btn--primary btn--sm" onClick={submitPoll}>
                Create poll
              </button>
            </div>
          </div>
        )}

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