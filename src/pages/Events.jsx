import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, MapPin, Clock, Plus, Check, X, Users, HandCoins, QrCode, ChevronLeft, ChevronRight, List } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { can } from '../rbac'
import { api } from '../lib/api'
import { fmtDateTime, monthDay, getDaysInMonth, getFirstDayOfMonth, getDaysInPrevMonth, formatMonthYear, formatFullDate, isSameDay, startOfDay } from '../lib/format'
import { fmtPeso } from '../lib/fees'
import EventModal from '../components/EventModal'

export default function Events() {
  const { user, toast } = useApp()
  const [events, setEvents] = useState([])
  const [tallies, setTallies] = useState({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [params, setParams] = useSearchParams()

  const [viewMode, setViewMode] = useState('calendar')
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [dayModal, setDayModal] = useState({ open: false, date: null, events: [] })

  const canCreate = can(user, 'events.manage')

  const load = useCallback(async () => {
    try {
      const [evs, t] = await Promise.all([api.getEvents(), api.getEventTallies()])
      setEvents(evs)
      setTallies(Object.fromEntries((t || []).map((x) => [x.event_id, x.count])))
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

  const openId = params.get('open')
  useEffect(() => {
    if (!openId || !events.length) return
    const ev = events.find((e) => e.id === openId)
    if (ev) setSelected(ev)
  }, [openId, events])

  const onRsvp = async (id, status) => {
    try {
      await api.setRsvp(id, status)
      toast(status === 'none' ? 'RSVP cancelled' : 'Marked as going')
      await load()
    } catch {
      toast('RSVP failed', 'err')
    }
  }

  const created = async (ev) => {
    try {
      await api.createEvent(ev)
      toast('Event created')
      setModal(false)
      await load()
    } catch {
      toast('Could not create event', 'err')
    }
  }

  const prevMonth = () => {
    const d = new Date(currentMonth)
    d.setMonth(d.getMonth() - 1)
    setCurrentMonth(d)
  }

  const nextMonth = () => {
    const d = new Date(currentMonth)
    d.setMonth(d.getMonth() + 1)
    setCurrentMonth(d)
  }

  const getEventsForDay = (date) => {
    const day = startOfDay(date)
    return events.filter((e) => {
      const evDate = startOfDay(new Date(e.starts_at))
      return isSameDay(evDate, day)
    })
  }

  const onDayClick = (date) => {
    const dayEvents = getEventsForDay(date)
    setDayModal({ open: true, date, events: dayEvents })
  }

  return (
    <div className="page-c">
      <div className="events-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">EVENTS</h1>
          <p className="page-sub">Org events — scan your ID QR at the door to log attendance.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'calendar' ? 'view-toggle-btn--on' : ''}`}
              onClick={() => setViewMode('calendar')}
              title="Calendar view"
            >
              <CalendarDays size={16} />
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'list' ? 'view-toggle-btn--on' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <List size={16} />
            </button>
          </div>
          {canCreate && (
            <button className="btn btn--primary" onClick={() => setModal(true)}>
              <Plus size={16} /> Create event
            </button>
          )}
        </div>
      </div>

      {loading && <div className="empty-state"><div className="typing" style={{ justifyContent: 'center' }}><i /><i /><i /></div></div>}

      {!loading && events.length === 0 && (
        <div className="empty-state">
          <CalendarDays size={44} />
          <h3>No events yet</h3>
          <p>Create the first org event to get the ball rolling.</p>
        </div>
      )}

      {!loading && events.length > 0 && viewMode === 'calendar' && (
        <CalendarView
          currentMonth={currentMonth}
          events={events}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          onDayClick={onDayClick}
        />
      )}

      {!loading && viewMode === 'list' && events.map((e) => {
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
                <span><QrCode size={14} /> {tallies[e.id] || 0} attended</span>
                {Number(e.fee_amount) > 0 && (
                  <span className="chip chip--gold"><HandCoins size={12} /> ₱{fmtPeso(e.fee_amount)}</span>
                )}
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

      {dayModal.open && (
        <DayModal
          date={dayModal.date}
          events={dayModal.events}
          onClose={() => setDayModal({ open: false, date: null, events: [] })}
          onSelectEvent={(ev) => {
            setDayModal({ open: false, date: null, events: [] })
            setSelected(ev)
          }}
        />
      )}

      {modal && <CreateEventModal onClose={() => setModal(false)} onCreate={created} />}
      {selected && (
        <EventModal
          event={selected}
          onClose={() => {
            setSelected(null)
            if (openId) {
              const next = new URLSearchParams(params)
              next.delete('open')
              setParams(next, { replace: true })
            }
          }}
          onChanged={load}
        />
      )}
    </div>
  )
}

function CalendarView({ currentMonth, events, onPrevMonth, onNextMonth, onDayClick }) {
  const today = startOfDay(new Date())
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const daysInMonth = getDaysInMonth(currentMonth)
  const firstDay = getFirstDayOfMonth(currentMonth)
  const daysInPrev = getDaysInPrevMonth(currentMonth)

  const cells = []

  for (let i = 0; i < firstDay; i++) {
    const dayNum = daysInPrev - firstDay + 1 + i
    const d = new Date(year, month - 1, dayNum)
    cells.push({ date: d, dim: true, num: dayNum })
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i)
    const isToday = isSameDay(d, today)
    const hasEvent = events.some((e) => isSameDay(startOfDay(new Date(e.starts_at)), d))
    cells.push({ date: d, dim: false, num: i, today: isToday, hasEvent })
  }

  const remaining = 42 - cells.length
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i)
    cells.push({ date: d, dim: true, num: i })
  }

  return (
    <div className="cal-wrap">
      <div className="cal-nav">
        <button className="btn btn--ghost btn--sm" onClick={onPrevMonth}>
          <ChevronLeft size={18} />
        </button>
        <span className="cal-nav-label">{formatMonthYear(currentMonth)}</span>
        <button className="btn btn--ghost btn--sm" onClick={onNextMonth}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="cal-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div className="cal-dow" key={d}>{d}</div>
        ))}
        {cells.map((c, i) => (
          <div
            key={i}
            className={`cal-day${c.dim ? ' cal-day--dim' : ''}${c.today ? ' cal-day--today' : ''}${c.hasEvent ? ' cal-day--has-event' : ''}`}
            onClick={() => !c.dim && onDayClick(c.date)}
          >
            <span className="cal-day-num">{c.num}</span>
            {c.hasEvent && <span className="cal-day-dot" />}
          </div>
        ))}
      </div>
    </div>
  )
}

function DayModal({ date, events, onClose, onSelectEvent }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="day-modal-head">
          <h3>{formatFullDate(date)}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {events.length === 0 ? (
          <div className="day-modal-empty">
            <CalendarDays size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p>No activities on this day.</p>
          </div>
        ) : (
          <div className="day-modal-list">
            {events.map((e) => {
              const going = Object.values(e.rsvps || {}).filter((s) => s === 'going').length
              return (
                <div className="day-modal-event" key={e.id} onClick={() => onSelectEvent(e)}>
                  <div className="day-modal-event-stub">
                    <b>{monthDay(e.starts_at).day}</b>
                    <span>{monthDay(e.starts_at).month}</span>
                  </div>
                  <div className="day-modal-event-body">
                    <h4>{e.title}</h4>
                    <div className="ev-meta">
                      <span><Clock size={12} /> {fmtDateTime(e.starts_at)}</span>
                      <span><MapPin size={12} /> {e.location}</span>
                      <span><Users size={12} /> {going} going</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
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
    fee_amount: '',
    morning_time_in: '',
    morning_time_out: '',
    afternoon_time_in: '',
    afternoon_time_out: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!form.title.trim() || !form.location.trim() || !form.starts_at) {
      setError('Title, location, and start time are required.')
      return
    }
    const fee = Number(form.fee_amount)
    if (form.fee_amount.trim() && (!Number.isFinite(fee) || fee < 0)) {
      setError('Enter a valid contribution fee.')
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
        fee_amount: form.fee_amount.trim() ? fee : 0,
        morning_time_in: form.morning_time_in || null,
        morning_time_out: form.morning_time_out || null,
        afternoon_time_in: form.afternoon_time_in || null,
        afternoon_time_out: form.afternoon_time_out || null,
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
          <label>Morning time in</label>
          <input type="time" value={form.morning_time_in} onChange={(e) => setForm({ ...form, morning_time_in: e.target.value })} />
          <div className="field-note" style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
            Morning session start time
          </div>
        </div>
        <div className="field">
          <label>Morning time out</label>
          <input type="time" value={form.morning_time_out} onChange={(e) => setForm({ ...form, morning_time_out: e.target.value })} />
          <div className="field-note" style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
            Morning session end time
          </div>
        </div>
        <div className="field">
          <label>Afternoon time in</label>
          <input type="time" value={form.afternoon_time_in} onChange={(e) => setForm({ ...form, afternoon_time_in: e.target.value })} />
          <div className="field-note" style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
            Afternoon session start time
          </div>
        </div>
        <div className="field">
          <label>Afternoon time out</label>
          <input type="time" value={form.afternoon_time_out} onChange={(e) => setForm({ ...form, afternoon_time_out: e.target.value })} />
          <div className="field-note" style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
            Afternoon session end time
          </div>
        </div>
        <div className="field">
          <label>Ends at <span className="hint">(optional)</span></label>
          <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
        </div>
        <div className="field">
          <label>Contribution fee <span className="field-hint">(₱, optional — 0 for free)</span></label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.fee_amount}
            onChange={(e) => setForm({ ...form, fee_amount: e.target.value })}
            placeholder="0.00"
          />
          <p className="field-note" style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
            If set, the door scanner records each attendee's payment and the event page tracks who has contributed.
          </p>
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
