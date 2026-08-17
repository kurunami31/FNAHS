import { useCallback, useEffect, useRef, useState } from 'react'
import { ShieldCheck, Camera, CameraOff, Users, QrCode, Trash2, Download } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { useApp } from '../context/AppContext'
import { can } from '../rbac'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'
import { downloadCsv, attendanceCsv } from '../lib/exportCsv'
import { currentSchoolYear, feeStatus } from '../lib/fees'

export default function Staff() {
  const { user, toast, online, pendingCount } = useApp()
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [attendance, setAttendance] = useState([])
  const [scanning, setScanning] = useState(false)
  const scannerRef = useRef(null)
  const [last, setLast] = useState(null)
  const [tallies, setTallies] = useState([])
  const scanBoxRef = useRef(null)
  // Mirrors the current eventId so the scan handler never goes stale mid-scan.
  const eventIdRef = useRef('')
  // html5-qrcode fires the success callback on every decoded frame while a QR
  // stays in view, so dedupe repeated reads of the same card.
  const lastScanRef = useRef({ id: null, at: 0 })

  const isStaff = can(user, 'attendance.scan')

  const loadTallies = useCallback(async () => {
    try {
      setTallies(await api.getAttendanceSummary())
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    loadTallies()
  }, [loadTallies])

  const loadEvents = useCallback(async () => {
    try {
      const evs = await api.getEvents()
      setEvents(evs)
      if (!eventId && evs.length) setEventId(evs[0].id)
    } catch {
      toast('Could not load events', 'err')
    }
  }, [toast, eventId])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  useEffect(() => {
    eventIdRef.current = eventId
  }, [eventId])

  const loadAttendance = useCallback(async () => {
    const id = eventIdRef.current
    if (!id) return
    try {
      setAttendance(await api.getAttendance(id))
    } catch {
      toast('Could not load attendance', 'err')
    }
  }, [toast])

  useEffect(() => {
    loadAttendance()
  }, [loadAttendance, eventId])

  // Stop the camera when leaving the page, but never on the stopScan state
  // change — calling stop() twice throws synchronously and would crash React.
  useEffect(() => {
    return () => {
      try {
        scannerRef.current?.stop().catch(() => {})
      } catch {
        /* already stopped */
      }
    }
  }, [])

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
      scannerRef.current = h5
      setScanning(true)
    } catch (e) {
      console.error(e)
      toast('Could not start the camera — check permissions', 'err')
    }
  }

  const stopScan = async () => {
    const h5 = scannerRef.current
    scannerRef.current = null
    if (h5) {
      try {
        await h5.stop()
        h5.clear()
      } catch {
        /* ignore */
      }
    }
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
    // The scanner decodes ~10x/sec while the card is held in frame — record
    // the same card at most once per 3s to avoid duplicate upserts/toasts.
    const now = Date.now()
    const prev = lastScanRef.current
    if (prev.id === userId && now - prev.at < 3000) return
    lastScanRef.current = { id: userId, at: now }
    setLast({ id: userId, at: new Date().toISOString() })
    try {
      await api.markAttendance(eventIdRef.current, userId)
      toast(online ? 'Attendance recorded' : 'Attendance recorded — will sync when you’re back online')
      await loadAttendance()
      // show the member's fee status next to the scan (fee viewers only)
      if (can(user, 'fees.view')) {
        api
          .getMembershipFees(currentSchoolYear())
          .then((rows) => {
            const f = rows.find((r) => r.member_id === userId) || null
            setLast((prev) => (prev?.id === userId ? { ...prev, fee: f } : prev))
          })
          .catch(() => {})
      }
    } catch {
      toast('Could not record attendance', 'err')
    }
  }

  const removeAttendance = async (userId) => {
    const name = attendance.find((a) => a.user_id === userId)?.profiles?.full_name || 'this member'
    if (!window.confirm(`Remove ${name} from the attendance log? This cannot be undone.`)) return
    try {
      await api.removeAttendance(eventIdRef.current, userId)
      toast('Attendance removed')
      await loadAttendance()
    } catch {
      toast('Could not remove attendance', 'err')
    }
  }

  const exportCsv = () => {
    const ev = events.find((e) => e.id === eventId)
    const { filename, headers, rows } = attendanceCsv(ev, attendance)
    downloadCsv(filename, headers, rows)
    toast(`Exported ${rows.length} record${rows.length === 1 ? '' : 's'}`)
  }

  if (!isStaff) {
    return (
      <div className="empty-state">
        <ShieldCheck size={44} />
        <h3>Staff tools</h3>
        <p>This page is reserved for FNAHS PULSO officers on door duty.</p>
      </div>
    )
  }

  return (
    <div className="page-c">
      <h1 className="page-title">
        ATTENDANCE <span className="page-kicker">staff tools</span>
      </h1>
      <p className="page-sub">Pick the event on duty, start the scanner, and the door log fills in live.</p>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Event on duty</h2>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Pick the active event</label>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.length === 0 && <option value="">No events yet…</option>}
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
        </div>
        {tallies.length > 0 && (
          <div className="tally-strip">
            {tallies.map((t) => (
              <span key={t.event_id} className={`chip${t.event_id === eventId ? ' chip--ok' : ''}`}>
                <b style={{ marginRight: 5 }}>{t.count}</b> {t.title}
              </span>
            ))}
          </div>
        )}
        {!online && (
          <div className="form-ok" style={{ marginTop: 12, marginBottom: 0 }}>
            Offline mode — scans are saved to this device and sync when the connection returns
            {pendingCount > 0 ? ` (${pendingCount} pending)` : ''}.
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title"><QrCode size={16} /> Scanner</h2>
        </div>
        {/* html5-qrcode must own the scan-box DOM (it wipes innerHTML on start and
            appends video/canvas). React children live in the stage as siblings so
            re-renders can never fight the library over the container. */}
        <div className="scan-stage">
          <div className="scan-box" id="fnahs-scan-box" ref={scanBoxRef} />
          {!scanning && (
            <div className="scan-placeholder">
              Camera off<br /><br />Press start to scan IDs
            </div>
          )}
          {scanning && <div className="scan-overlay" />}
        </div>
        <div style={{ marginTop: 14 }}>
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
            {can(user, 'fees.view') && (
              <div style={{ marginTop: 8 }}>
                {last.fee ? (
                  <>
                    <span className={`chip${feeStatus(last.fee).sem1 === 'paid' ? ' chip--ok' : ''}`}>
                      Sem 1 {feeStatus(last.fee).sem1 ? (feeStatus(last.fee).sem1 === 'paid' ? 'paid' : 'unpaid') : 'not set'}
                    </span>
                    <span className={`chip${feeStatus(last.fee).sem2 === 'paid' ? ' chip--ok' : ''}`}>
                      Sem 2 {feeStatus(last.fee).sem2 ? (feeStatus(last.fee).sem2 === 'paid' ? 'paid' : 'unpaid') : 'not set'}
                    </span>
                  </>
                ) : (
                  <span className="chip">No fee record for {currentSchoolYear()}</span>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title"><Users size={16} /> Attendance log</h2>
          {attendance.length > 0 && <span className="chip chip--ok">{attendance.length} present</span>}
          <button className="btn btn--tiny" onClick={exportCsv} disabled={attendance.length === 0}>
            <Download size={13} /> Export CSV
          </button>
        </div>
        {attendance.length === 0 ? (
          <p className="panel-muted">No scans recorded for this event yet.</p>
        ) : (
          <div className="ledger">
            {attendance.map((a) => (
              <div className="ledger-row" key={`${a.event_id}-${a.user_id}`}>
                <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
                  {(a.profiles?.full_name || '?')
                    .split(' ')
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.93rem' }}>
                    {a.profiles?.full_name || a.user_id.slice(0, 10)}
                  </div>
                  <div className="ledger-meta">
                    {a.profiles?.program
                      ? `${a.profiles.program}${a.profiles.year_level ? ` (Yr ${a.profiles.year_level})` : ''}`
                      : ''}{' '}
                    · scanned {timeAgo(a.scanned_at)}
                  </div>
                </div>
                <span className="badge badge--ok">present</span>
                <button
                  className="icon-btn icon-btn--danger"
                  title="Remove from attendance"
                  onClick={() => removeAttendance(a.user_id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
