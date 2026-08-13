import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, MapPin, Clock, Plus, Check, X, Users } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { can } from '../rbac'
import { api } from '../lib/api'
import { fmtDateTime, monthDay } from '../lib/format'
import EventModal from '../components/EventModal'

export default function Events() {
  const { user, toast } = useApp()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [selected, setSelected] = useState(null)

  const canCreate = can(user, 'events.manage')

  const load = useCallback(async () => {
    try {
      const evs = await api.getEvents()
      setEvents(evs)
      setSelected((s) => (s ? evs.find((e) => e.id === s.id) || null : s))
    } catch (e) {
      console.error(e)
      toast('Could not load events', 'err')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const onRsvp = async (id, status) => {
    try {
      await api.setRsvp(id, status)
      toast(status === 'none' ? 'RSVP cancelled' : 'Marked as going')
      await load()
    } catch (e) {
      toast('RSVP failed', 'err')
    }
  }

  const created = async (ev) => {
    try {
      await api.createEvent(ev)
      toast('Event created')
      setModal(false)
      await load()
    } catch (e) {
      toast('Could not create event', 'err')
    }
  }

  return (
    <div className="page-c">
      <div className="events-head">
        <h1 className="page-title">EVENTS</h1>
        <p className="page-sub">Org events — scan your ID QR at the door to log attendance.</p>
        {canCreate && (
          <button className="btn btn--primary" onClick={() => setModal(true)}>
            <Plus size={16} /> Create event
          </button>
        )}
      </div>

      {loading && <div className="empty-state"><div className="typing" style={{ justifyContent: 'center' }}><i /><i /><i /></div></div>}

      {!loading && events.length === 0 && (
        <div className="empty-state">
          <CalendarDays size={44} />
          <h3>No events yet</h3>
          <p>Create the first org event to get the ball rolling.</p>
        </div>
      )}

      {events.map((e) => {
        const mine = e.rsvps?.[user?.id]
        const going = Object.values(e.rsvps || {}).filter((s) => s === 'going').length
        return (
          <div className="event-ticket" key={e.id} onClick={() => setSelected(e)}>
            <div className="event-stub">
              <b>{monthDay(e.starts_at).day}</b>
              <span>{monthDay(e.starts_at).month}</span>
            </div>
            <div className="event-body">
              <h3>{e.title}</h3>
              <div className="ev-meta">
                <span><Clock size={14} /> {fmtDateTime(e.starts_at)}</span>
                <span><MapPin size={14} /> {e.location}</span>
                <span><Users size={14} /> {going} going</span>
              </div>
              <p className="event-desc">{e.description}</p>
            </div>
            <div className="event-side">
              {mine === 'going' ? (
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={(ev) => {
                    ev.stopPropagation()
                    onRsvp(e.id, 'none')
                  }}
                >
                  <X size={14} /> Cancel RSVP
                </button>
              ) : (
                <button
                  className="btn btn--primary btn--sm"
                  onClick={(ev) => {
                    ev.stopPropagation()
                    onRsvp(e.id, 'going')
                  }}
                >
                  <Check size={14} /> Mark as going
                </button>
              )}
              <span className="chip">{new Date(e.starts_at) < Date.now() ? 'happening now / past' : 'upcoming'}</span>
            </div>
          </div>
        )
      })}

      {modal && <CreateEventModal onClose={() => setModal(false)} onCreate={created} />}
      {selected && <EventModal event={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  )
}

function CreateEventModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    starts_at: '',
    ends_at: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!form.title.trim() || !form.location.trim() || !form.starts_at) {
      setError('Title, location, and start time are required.')
      return
    }
    setSaving(true)
    try {
      await onCreate({
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : new Date(new Date(form.starts_at).getTime() + 2 * 3600e3).toISOString(),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>CREATE EVENT</h2>
        {error && <div className="form-error">{error}</div>}
        <div className="field">
          <label>Event title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. FNAHS PULSO General Assembly" />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What's this event about?" />
        </div>
        <div className="field">
          <label>Location</label>
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Main Auditorium" />
        </div>
        <div className="field">
          <label>Starts at</label>
          <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
        </div>
        <div className="field">
          <label>Ends at <span className="hint">(optional)</span></label>
          <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
        </div>
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={saving} onClick={submit}>
            {saving ? 'Saving…' : 'Publish event'}
          </button>
        </div>
      </div>
    </div>
  )
}

