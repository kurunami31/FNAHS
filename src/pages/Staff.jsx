import { useCallback, useEffect, useRef, useState } from 'react'
import { ShieldCheck, Camera, CameraOff, Users, QrCode, Trash2, Download, HandCoins, Search } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { enumerateCameras, cameraId, cameraFor, cameraLabel } from '../lib/scanner'
import { useApp } from '../context/AppContext'
import { can } from '../rbac'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'
import { attendanceWorkbook, downloadWorkbook } from '../lib/exportXlsx'
import { currentSchoolYear, feeSummary, fmtPeso } from '../lib/fees'
import Select from '../components/Select'

export default function Staff() {
  const { user, toast, online, pendingCount } = useApp()
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [attendance, setAttendance] = useState([])
  const [scanning, setScanning] = useState(false)
  const scannerRef = useRef(null)
  const [last, setLast] = useState(null)
  const [tallies, setTallies] = useState([])
  const [payments, setPayments] = useState([])
  const [attQ, setAttQ] = useState('')
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

  // event contribution payments for the active event (events with a fee only)
  const loadPayments = useCallback(async () => {
    const id = eventIdRef.current
    if (!id) return
    try {
      setPayments(await api.getEventPayments(id))
    } catch {
      /* not a fee event or not visible — ignore */
    }
  }, [])

  useEffect(() => {
    loadAttendance()
    loadPayments()
  }, [loadAttendance, loadPayments, eventId])

  const activeEvent = events.find((e) => e.id === eventId)
  const eventFee = Number(activeEvent?.fee_amount) || 0
  const canManagePayments = can(user, 'events.manage')

  const markPaid = async (memberId, name) => {
    try {
      await api.markEventPayment(eventIdRef.current, memberId)
      toast(`${name} marked as paid`)
      await loadPayments()
    } catch (e) {
      console.error(e)
      toast(e.message?.includes('no contribution') ? 'This event has no contribution fee' : 'Could not mark payment', 'err')
    }
  }

  const unmarkPaid = async (memberId, name) => {
    try {
      await api.unmarkEventPayment(eventIdRef.current, memberId)
      toast(`${name}'s payment voided`)
      await loadPayments()
    } catch {
      toast('Could not void payment', 'err')
    }
  }

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

  const [cams, setCams] = useState(null)
  const [camIndex, setCamIndex] = useState(0)

  const startScan = async () => {
    if (!eventId) {
      toast('Pick an event first', 'info')
      return
    }
    try {
      let list = cams
      if (!list) {
        list = await enumerateCameras()
        setCams(list)
      }
      const h5 = new Html5Qrcode('fnahs-scan-box')
      await h5.start(
        cameraId(list, camIndex),
        { fps: 10, qrbox: { width: 220, height: 220 }, videoConstraints: cameraFor(list, camIndex) },
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

  const flipCam = async () => {
    let list = cams
    if (!list) {
      list = await enumerateCameras()
      setCams(list)
    }
    if (!list || list.length < 2) {
      toast('Only one camera is available on this device', 'info')
      return
    }
    const h5 = scannerRef.current
    if (h5) {
      try {
        await h5.stop()
        h5.clear()
      } catch {
        /* ignore */
      }
      scannerRef.current = null
    }
    setScanning(false)
    const next = (camIndex + 1) % list.length
    setCamIndex(next)
    try {
      const n = new Html5Qrcode('fnahs-scan-box')
      await n.start(
        cameraId(list, next),
        { fps: 10, qrbox: { width: 220, height: 220 }, videoConstraints: cameraFor(list, next) },
        (decoded) => handleScan(decoded),
        () => {}
      )
      scannerRef.current = n
      setScanning(true)
    } catch (e) {
      console.error(e)
      toast('Could not switch the camera', 'err')
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
      if (eventFee > 0) loadPayments()
      // show the member's fee status next to the scan (fee viewers only)
      if (can(user, 'fees.view')) {
        Promise.all([api.getFeePayments(currentSchoolYear()), api.getAnnualFee()])
          .then(([payments, annual]) => {
            const own = payments.filter((p) => p.member_id === userId)
            setLast((prev) => (prev?.id === userId ? { ...prev, fee: own, annual } : prev))
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

  const exportXlsx = async () => {
    try {
      const ev = events.find((e) => e.id === eventId)
      // Fresh payment confirmations at export time (screen state may lag
      // behind marks made on other devices).
      let freshPayments = payments
      try {
        freshPayments = await api.getEventPayments(eventId)
      } catch (e) {
        console.error(e)
      }
      const { workbook, filename } = await attendanceWorkbook(ev, attendance, freshPayments)
      await downloadWorkbook(workbook, filename)
      toast(`Exported ${attendance.length} record${attendance.length === 1 ? '' : 's'}`)
    } catch (e) {
      console.error(e)
      toast('Could not export attendance', 'err')
    }
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
          <Select
            value={eventId}
            onChange={setEventId}
            options={events.map((e) => ({ value: e.id, label: e.title }))}
            placeholder="Select an event…"
          />
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
        <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
          {!scanning ? (
            <button className="btn btn--primary btn--block" onClick={startScan}>
              <Camera size={16} /> Start scanner
            </button>
          ) : (
            <button className="btn btn--danger btn--block" onClick={stopScan}>
              <CameraOff size={16} /> Stop scanner
            </button>
          )}
          {scanning && (
            <button className="btn btn--block" onClick={flipCam} style={{ flex: 'none' }} title="Switch camera">
              <Camera size={16} /> Flip
            </button>
          )}
        </div>
        {scanning && cams && cams.length > 0 && (
          <div className="panel-muted" style={{ marginTop: 8, fontSize: '0.78rem', textAlign: 'center' }}>
            Active camera: <b>{cameraLabel(cams, camIndex) || `Camera ${camIndex + 1} of ${cams.length}`}</b>
          </div>
        )}
        {last && (
          <div className="form-ok" style={{ marginTop: 14, marginBottom: 0 }}>
            Last scan: <b>{last.id.slice(0, 8)}</b> · {timeAgo(last.at)}
            {can(user, 'fees.view') && (
              <div style={{ marginTop: 8 }}>
                {last.fee?.length ? (
                  (() => {
                    const s = feeSummary(last.fee, last.annual)
                    return (
                      <>
                        <span
                          className={`chip${s.status === 'paid' ? ' chip--ok' : s.status === 'partial' ? ' chip--warn' : ''}`}
                        >
                          {s.status === 'paid'
                            ? `Paid ₱${fmtPeso(s.paid)}`
                            : s.status === 'partial'
                              ? `Partial ₱${fmtPeso(s.paid)} of ₱${fmtPeso(s.annual)}`
                              : 'Unpaid'}
                        </span>
                        {last.fee.slice(0, 3).map((p) => (
                          <span key={p.id} className={`chip${p.payment_type === 'full' ? ' chip--ok' : ''}`}>
                            {p.payment_type === 'full' ? 'FULL' : '½'} ₱{fmtPeso(p.amount)}
                            {p.receipt ? ` · ${p.receipt}` : ''}
                          </span>
                        ))}
                      </>
                    )
                  })()
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
          {eventFee > 0 && <span className="chip chip--gold">{payments.length} paid · ₱{fmtPeso(eventFee)}</span>}
          <button className="btn btn--tiny" onClick={exportXlsx} disabled={attendance.length === 0}>
            <Download size={13} /> Export XLSX
          </button>
        </div>
        {attendance.length === 0 ? (
          <p className="panel-muted">No scans recorded for this event yet.</p>
        ) : (
          <>
            <div className="search-field" style={{ marginBottom: 12, maxWidth: 360 }}>
              <Search size={14} />
              <input
                type="search"
                placeholder="Search by name or ID no…"
                value={attQ}
                onChange={(e) => setAttQ(e.target.value)}
              />
            </div>
            <div className="ledger ledger-scroll">
              {attendance
                .filter((a) => {
                  const n = attQ.trim().toLowerCase()
                  if (!n) return true
                  const name = a.profiles?.full_name || ''
                  const id = a.profiles?.id_no || ''
                  return name.toLowerCase().includes(n) || id.toLowerCase().includes(n)
                })
                .map((a) => {
                  const paidRow = eventFee > 0 && payments.some((p) => p.member_id === a.user_id)
                  return (
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
                          {a.profiles?.id_no ? `ID ${a.profiles.id_no} · ` : ''}
                          {a.profiles?.program
                            ? `${a.profiles.program}${a.profiles.year_level ? ` (Yr ${a.profiles.year_level})` : ''}`
                            : ''}{' '}
                          · scanned {timeAgo(a.scanned_at)}
                        </div>
                      </div>
                      <span className="badge badge--ok">present</span>
                      {eventFee > 0 &&
                        (paidRow ? (
                          <>
                            <span className="chip chip--ok">paid</span>
                            {canManagePayments && (
                              <button
                                className="icon-btn"
                                title="Void this payment"
                                onClick={() => unmarkPaid(a.user_id, a.profiles?.full_name || 'member')}
                              >
                                <HandCoins size={15} />
                              </button>
                            )}
                          </>
                        ) : (
                          canManagePayments && (
                            <button
                              className="icon-btn"
                              title={`Mark paid — ₱${fmtPeso(eventFee)}`}
                              onClick={() => markPaid(a.user_id, a.profiles?.full_name || 'member')}
                            >
                              <HandCoins size={15} />
                            </button>
                          )
                        ))}
                      <button
                        className="icon-btn icon-btn--danger"
                        title="Remove from attendance"
                        onClick={() => removeAttendance(a.user_id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )
                })}
            </div>
            {attQ.trim() && (
              <p className="page-sub" style={{ marginTop: 10 }}>
                Showing {attendance.filter((a) => {
                  const n = attQ.trim().toLowerCase()
                  return (a.profiles?.full_name || '').toLowerCase().includes(n) || (a.profiles?.id_no || '').toLowerCase().includes(n)
                }).length}{' '}
                of {attendance.length} — total {attendance.length} attended
              </p>
            )}
          </>
        )}
      </section>
    </div>
  )
}
