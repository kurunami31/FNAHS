import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ShieldCheck, Camera, CameraOff, Users, QrCode, Trash2, Download, HandCoins, Search, RefreshCw, Lock, Unlock } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { enumerateCameras, cameraConstraints } from '../lib/scanner'
import { useApp } from '../context/AppContext'
import { can } from '../rbac'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'
import PopulationBreakdown from '../components/PopulationBreakdown'
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
  const [scanType, setScanType] = useState('auto')
  const eventPollRef = useRef(null)
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
      const evs = await api.getEvents({ includePast: true })
      setEvents(evs)
      setEventId((prev) => {
        if (prev) return prev
        if (evs.length === 0) return ''
        const now = Date.now()
        const upcoming = evs.filter((e) => new Date(e.ends_at).getTime() > now)
        const best = upcoming.length > 0 ? upcoming[0] : evs[evs.length - 1]
        return best.id
      })
    } catch {
      toast('Could not load events', 'err')
    }
  }, [toast])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  // Poll events every 30s so new events appear in the dropdown
  useEffect(() => {
    eventPollRef.current = setInterval(loadEvents, 30_000)
    return () => clearInterval(eventPollRef.current)
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
  const canManageLocks = can(user, 'events.manage')

  const isLocked = (type) => activeEvent?.[`${type}_locked`] || false

  const toggleLock = async (type) => {
    if (!eventId || !canManageLocks) return
    const field = `${type}_locked`
    const newVal = !isLocked(type)
    try {
      await api.updateEventLocks(eventId, { [field]: newVal })
      setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, [field]: newVal } : e)))
      toast(`${type === 'time_in' ? 'Time-in' : 'Time-out'} ${newVal ? 'locked' : 'unlocked'}`)
    } catch (e) {
      console.error(e)
      toast('Could not update lock', 'err')
    }
  }

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
        'any',
        { fps: 10, qrbox: { width: 220, height: 220 }, videoConstraints: cameraConstraints(list, 0, true) },
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
    setLast({ id: userId, at: new Date().toISOString(), scanType })

    if (scanType === 'time_in' && isLocked('time_in')) { toast('Time-in is locked for this event', 'err'); return }
    if (scanType === 'time_out' && isLocked('time_out')) { toast('Time-out is locked for this event', 'err'); return }

    try {
      let status
      if (scanType === 'auto') {
        status = await api.markAttendance(eventIdRef.current, userId)
      } else {
        status = await api.markAttendanceManual(eventIdRef.current, userId, scanType)
      }
      const msg = status === 'out' ? 'Time-out recorded' : status === 'already-out' ? 'Already timed out for this event' : 'Time-in recorded'
      toast(online ? msg : `${msg} — will sync when you’re back online`)
      await loadAttendance()
      if (eventFee > 0) loadPayments()
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

  const compliance = useMemo(() => {
    const map = {}
    for (const a of attendance) {
      if (!map[a.user_id]) {
        map[a.user_id] = {
          user_id: a.user_id,
          name: a.profiles?.full_name || a.user_id.slice(0, 10),
          program: a.profiles?.program,
          year_level: a.profiles?.year_level,
          id_no: a.profiles?.id_no,
          time_in: a.scanned_at || null,
          time_out: a.time_out || null,
        }
      }
      if (a.time_out && !map[a.user_id].time_out) map[a.user_id].time_out = a.time_out
    }
    return Object.values(map).sort((a, b) => {
      const sa = a.time_in && a.time_out ? 0 : a.time_in ? 1 : 2
      const sb = b.time_in && b.time_out ? 0 : b.time_in ? 1 : 2
      return sa - sb
    })
  }, [attendance])

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

      <PopulationBreakdown title="Population by Year Level" kicker="members" />

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Event on duty</h2>
          <button className="btn btn--ghost" onClick={loadEvents} title="Refresh events">
            <RefreshCw size={14} />
          </button>
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
        {canManageLocks && activeEvent && (
          <div className="lock-row">
            <button type="button" className={`lock-btn${isLocked('time_in') ? ' lock-btn--locked' : ''}`} onClick={() => toggleLock('time_in')}>
              {isLocked('time_in') ? <Lock size={14} /> : <Unlock size={14} />}
              Time-in {isLocked('time_in') ? 'locked' : 'open'}
            </button>
            <button type="button" className={`lock-btn${isLocked('time_out') ? ' lock-btn--locked' : ''}`} onClick={() => toggleLock('time_out')}>
              {isLocked('time_out') ? <Lock size={14} /> : <Unlock size={14} />}
              Time-out {isLocked('time_out') ? 'locked' : 'open'}
            </button>
          </div>
        )}
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
        <div className="scan-type-row">
          <span className="scan-type-label">Scanning as:</span>
          <div className="scan-type-toggle" role="group" aria-label="Scan type">
            <button type="button" className={scanType === 'auto' ? 'is-on' : ''} onClick={() => setScanType('auto')} disabled={scanning}>Auto</button>
            <button type="button" className={scanType === 'time_in' ? 'is-on' : ''} onClick={() => setScanType('time_in')} disabled={scanning}>Time In</button>
            <button type="button" className={scanType === 'time_out' ? 'is-on' : ''} onClick={() => setScanType('time_out')} disabled={scanning}>Time Out</button>
          </div>
          {scanType !== 'auto' && isLocked(scanType) && (
            <span className="chip chip--warn"><Lock size={12} /> {scanType === 'time_in' ? 'Time-in' : 'Time-out'} locked</span>
          )}
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
        <div className="scan-actions">
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
            Last scan: <b>{last.id.slice(0, 8)}</b> · {last.scanType === 'auto' ? '' : `${last.scanType === 'time_in' ? 'Time-in' : 'Time-out'} · `}{timeAgo(last.at)}
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
          <h2 className="panel-title"><Users size={16} /> Attendance compliance</h2>
          {compliance.length > 0 && (
            <span className="chip chip--ok">{compliance.filter((c) => c.time_in && c.time_out).length}/{compliance.length} compliant</span>
          )}
        </div>
        {compliance.length === 0 ? (
          <p className="panel-muted">No scans recorded for this event yet.</p>
        ) : (
          <div className="ledger">
            {compliance.map((c) => {
              const both = c.time_in && c.time_out
              return (
                <div className="ledger-row" key={c.user_id}>
                  <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
                    {c.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.93rem' }}>{c.name}</div>
                    <div className="ledger-meta">
                      {c.id_no ? `ID ${c.id_no} · ` : ''}
                      {c.program ? `${c.program}${c.year_level ? ` (Yr ${c.year_level})` : ''}` : ''}
                    </div>
                  </div>
                  <div className="compliance-chips">
                    <span className={`chip chip--sm ${c.time_in ? 'chip--ok' : 'chip--muted'}`}>
                      {c.time_in ? '\u2713 In' : '\u2717 In'}
                    </span>
                    <span className={`chip chip--sm ${c.time_out ? 'chip--ok' : 'chip--muted'}`}>
                      {c.time_out ? '\u2713 Out' : '\u2717 Out'}
                    </span>
                    <span className={`badge ${both ? 'badge--ok' : 'badge--pending'}`}>
                      {both ? 'compliant' : 'partial'}
                    </span>
                  </div>
                </div>
              )
            })}
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
                          · in {timeAgo(a.scanned_at)}{a.time_out ? ` · out ${timeAgo(a.time_out)}` : ''}
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
