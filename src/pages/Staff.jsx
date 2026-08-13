import { useCallback, useEffect, useRef, useState } from 'react'
import { ShieldCheck, Camera, CameraOff, Users, QrCode } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'

export default function Staff() {
  const { user, toast } = useApp()
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [attendance, setAttendance] = useState([])
  const [scanning, setScanning] = useState(false)
  const [scanner, setScanner] = useState(null)
  const [last, setLast] = useState(null)
  const scanBoxRef = useRef(null)

  const loadEvents = useCallback(async () => {
    try {
      const evs = await api.getEvents()
      setEvents(evs)
      if (!eventId && evs.length) setEventId(evs[0].id)
    } catch (e) {
      toast('Could not load events', 'err')
    }
  }, [toast, eventId])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const loadAttendance = useCallback(async () => {
    if (!eventId) return
    try {
      setAttendance(await api.getAttendance(eventId))
    } catch (e) {
      toast('Could not load attendance', 'err')
    }
  }, [eventId, toast])

  useEffect(() => {
    loadAttendance()
  }, [loadAttendance])

  useEffect(() => {
    return () => {
      scanner?.stop().catch(() => {})
    }
  }, [scanner])

  const startScan = async () => {
    if (!eventId) {
      toast('Pick an event first', 'info')
      return
    }
    try {
      const h5 = new Html5Qrcode('fnahs-scan-box')
      await h5.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => handleScan(decoded),
        () => {}
      )
      setScanner(h5)
      setScanning(true)
    } catch (e) {
      console.error(e)
      toast('Could not start the camera — check permissions', 'err')
    }
  }

  const stopScan = async () => {
    if (!scanner) return
    try {
      await scanner.stop()
      scanner.clear()
    } catch {
      /* ignore */
    }
    setScanner(null)
    setScanning(false)
  }

  const handleScan = async (decoded) => {
    let userId = decoded
    try {
      const obj = JSON.parse(decoded)
      if (obj.t === 'fnahs-id' && obj.id) userId = obj.id
    } catch {
      /* raw id text */
    }
    setLast({ id: userId, at: new Date().toISOString() })
    try {
      await api.markAttendance(eventId, userId)
      toast('Attendance recorded')
      await loadAttendance()
    } catch (e) {
      toast('Could not record attendance', 'err')
    }
  }

  const isStaff = ['staff', 'superadmin'].includes(user?.role)

  if (!isStaff) {
    return (
      <div className="empty-state">
        <ShieldCheck size={44} />
        <h3>Staff tools</h3>
        <p>This page is reserved for FNAHS staff and officers.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="page-title">ATTENDANCE</h1>
      <p className="page-sub">Scan member ID QR codes to log event attendance.</p>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Event</label>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.length === 0 && <option value="">No events yet…</option>}
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="learn-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div className="card">
          <h2 className="page-title" style={{ fontSize: '0.95rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <QrCode size={17} /> SCANNER
          </h2>
          <div className="scan-box" id="fnahs-scan-box" ref={scanBoxRef} style={!scanning ? { background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}}>
            {!scanning && (
              <span style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center', padding: 20 }}>
                Camera off<br /><br />Press start to scan IDs
              </span>
            )}
            {scanning && <div className="scan-overlay" />}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            {!scanning ? (
              <button className="btn btn--primary btn--block" onClick={startScan}>
                <Camera size={16} /> Start scanner
              </button>
            ) : (
              <button className="btn btn--danger btn--block" onClick={stopScan}>
                <CameraOff size={16} /> Stop scanner
              </button>
            )}
          </div>
          {last && (
            <div className="form-ok" style={{ marginTop: 14, marginBottom: 0 }}>
              Last scan: <b>{last.id.slice(0, 8)}</b> · {timeAgo(last.at)}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="page-title" style={{ fontSize: '0.95rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={17} /> ATTENDANCE LOG
          </h2>
          {attendance.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>No scans recorded for this event yet.</p>
          )}
          {attendance.map((a) => (
            <div className="comment" key={`${a.event_id}-${a.user_id}`}>
              <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                {(a.profiles?.full_name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="c-body">
                <span className="c-author">{a.profiles?.full_name || a.user_id.slice(0, 10)}</span>
                {a.profiles?.program ? ` · ${a.profiles.program}${a.profiles.year_level ? ` (Yr ${a.profiles.year_level})` : ''}` : ''}
                <div className="c-time">scanned {timeAgo(a.scanned_at)}</div>
              </div>
              <span className="badge badge--ok">present</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
