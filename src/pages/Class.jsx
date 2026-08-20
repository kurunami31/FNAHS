import { useCallback, useEffect, useRef, useState } from 'react'
import { ShieldCheck, Camera, CameraOff, QrCode, Trash2, Download, Plus, GraduationCap, Play, Square, Search, BookOpen } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { enumerateCameras, cameraConstraints } from '../lib/scanner'
import { useApp } from '../context/AppContext'
import { can } from '../rbac'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'
import { classWorkbook, downloadWorkbook } from '../lib/exportXlsx'
import Select from '../components/Select'

export default function ClassAttendance() {
  const { user, toast, online } = useApp()
  const [subjects, setSubjects] = useState([])
  const [newSubject, setNewSubject] = useState('')
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState('')
  const [attendance, setAttendance] = useState([])
  const [scanning, setScanning] = useState(false)
  const scannerRef = useRef(null)
  const [last, setLast] = useState(null)
  const [attQ, setAttQ] = useState('')
  const scanBoxRef = useRef(null)
  const sessionIdRef = useRef('')
  const lastScanRef = useRef({ id: null, at: 0 })
  const [cams, setCams] = useState(null)

  const canClass = can(user, 'class.manage')

  const loadSubjects = useCallback(async () => {
    try {
      setSubjects(await api.getMySubjects())
    } catch (e) {
      console.error(e)
      toast('Could not load subjects', 'err')
    }
  }, [toast])

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await api.getSessions())
    } catch (e) {
      console.error(e)
      toast('Could not load sessions', 'err')
    }
  }, [toast])

  useEffect(() => {
    if (!canClass) return
    loadSubjects()
    loadSessions()
  }, [canClass, loadSubjects, loadSessions])

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  const activeSession = sessions.find((s) => s.id === sessionId)
  const activeSubject = subjects.find((s) => s.id === activeSession?.subject_id) || activeSession?.subject || null

  const loadAttendance = useCallback(async () => {
    const id = sessionIdRef.current
    if (!id) return
    try {
      setAttendance(await api.getSessionAttendance(id))
    } catch (e) {
      console.error(e)
      toast('Could not load the session log', 'err')
    }
  }, [toast])

  useEffect(() => {
    loadAttendance()
  }, [loadAttendance, sessionId])

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

  const addSubject = async () => {
    const name = newSubject.trim()
    if (!name) {
      toast('Type a subject name first', 'info')
      return
    }
    try {
      const row = await api.addSubject(name)
      setSubjects((s) => [row, ...s.filter((x) => x.id !== row.id)])
      setNewSubject('')
      toast('Subject added')
    } catch (e) {
      console.error(e)
      toast('Could not add the subject', 'err')
    }
  }

  const removeSubject = async (id, name) => {
    if (!window.confirm(`Remove ${name}? Its sessions and scans are also removed.`)) return
    try {
      await api.removeSubject(id)
      setSubjects((s) => s.filter((x) => x.id !== id))
      setSessions((s) => s.filter((x) => x.subject_id !== id))
      if (activeSession?.subject_id === id) setSessionId('')
      toast('Subject removed')
    } catch (e) {
      console.error(e)
      toast('Could not remove the subject', 'err')
    }
  }

  const startSession = async () => {
    if (!subjects.length) {
      toast('Add a subject first', 'info')
      return
    }
    const subjectId = activeSubject?.id || subjects[0].id
    if (sessionId && !activeSession?.ended_at) {
      toast('End the open session before starting a new one', 'info')
      return
    }
    try {
      const row = await api.startSession(subjectId)
      setSessions((s) => [row, ...s])
      setSessionId(row.id)
      setAttendance([])
      toast('Session started — scanner is live')
    } catch (e) {
      console.error(e)
      toast('Could not start the session', 'err')
    }
  }

  const endSession = async () => {
    if (!activeSession) return
    if (!window.confirm('End this session? Attendance stays in the log.')) return
    try {
      await api.endSession(activeSession.id)
      setSessions((s) => s.map((x) => (x.id === activeSession.id ? { ...x, ended_at: new Date().toISOString() } : x)))
      toast('Session ended')
    } catch (e) {
      console.error(e)
      toast('Could not end the session', 'err')
    }
  }

  const startScan = async () => {
    if (!sessionId) {
      toast('Start a session first', 'info')
      return
    }
    if (activeSession?.ended_at) {
      toast('This session is already ended', 'info')
      return
    }
    try {
      let list = cams
      if (!list) {
        list = await enumerateCameras()
        setCams(list)
      }
      const h5 = new Html5Qrcode('fnahs-class-scan-box')
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
    const now = Date.now()
    const prev = lastScanRef.current
    if (prev.id === userId && now - prev.at < 3000) return
    lastScanRef.current = { id: userId, at: now }
    setLast({ id: userId, at: new Date().toISOString() })
    try {
      await api.markClassAttendance(sessionIdRef.current, userId)
      toast(online ? 'Present recorded' : 'Present recorded — will sync when you’re back online')
      await loadAttendance()
    } catch (e) {
      console.error(e)
      toast('Could not record the scan', 'err')
    }
  }

  const removeAttendance = async (userId) => {
    const name = attendance.find((a) => a.user_id === userId)?.profiles?.full_name || 'this student'
    if (!window.confirm(`Remove ${name} from this session? This cannot be undone.`)) return
    try {
      await api.removeClassAttendance(sessionIdRef.current, userId)
      toast('Attendance removed')
      await loadAttendance()
    } catch (e) {
      console.error(e)
      toast('Could not remove attendance', 'err')
    }
  }

  const exportXlsx = async () => {
    try {
      const fresh = await api.getSessionAttendance(sessionIdRef.current)
      const { workbook, filename } = await classWorkbook(activeSession, activeSubject, fresh)
      await downloadWorkbook(workbook, filename)
      toast(`Exported ${fresh.length} record${fresh.length === 1 ? '' : 's'}`)
    } catch (e) {
      console.error(e)
      toast('Could not export attendance', 'err')
    }
  }

  if (!canClass) {
    return (
      <div className="empty-state">
        <ShieldCheck size={44} />
        <h3>Class attendance</h3>
        <p>This page is for faculty — add the subjects you teach, start a session, and scan student IDs.</p>
      </div>
    )
  }

  const openCount = sessions.filter((s) => !s.ended_at).length

  return (
    <div className="page-c">
      <h1 className="page-title">
        CLASS <span className="page-kicker">faculty tools</span>
      </h1>
      <p className="page-sub">Add the subjects you teach, start a session per meeting, and scan IDs as students arrive.</p>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title"><BookOpen size={16} /> Subjects I teach</h2>
          <span className="sec-kicker">{subjects.length} subject{subjects.length === 1 ? '' : 's'}</span>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div className="field" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <label htmlFor="new-subject">Subject name</label>
            <div className="search-field" style={{ marginBottom: 0 }}>
              <input
                id="new-subject"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSubject()}
                placeholder="e.g. NCM 100 — Foundations of Nursing"
              />
              <button className="btn btn--primary btn--sm" onClick={addSubject}>
                <Plus size={14} /> Add
              </button>
            </div>
          </div>
        </div>
        {subjects.length === 0 ? (
          <p className="panel-muted">No subjects yet — add the subjects you teach to start taking attendance.</p>
        ) : (
          <div className="ledger ledger-scroll">
            {subjects.map((s) => (
              <div className="ledger-row" key={s.id}>
                <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
                  <GraduationCap size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.93rem' }}>{s.name}</div>
                  <div className="ledger-meta">added {timeAgo(s.created_at)}</div>
                </div>
                <button
                  className="icon-btn icon-btn--danger"
                  title="Remove subject"
                  onClick={() => removeSubject(s.id, s.name)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title"><Play size={16} /> Class session</h2>
          {openCount > 0 && <span className="chip chip--ok">{openCount} open</span>}
        </div>
        {subjects.length === 0 ? (
          <p className="panel-muted">Add a subject above to start a session.</p>
        ) : (
          <>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Pick a subject</label>
              <Select
                value={activeSubject?.id || ''}
                onChange={(v) => {
                  const existing = sessions.find((s) => !s.ended_at && s.subject_id === v)
                  setSessionId(existing ? existing.id : '')
                }}
                options={subjects.map((s) => ({ value: s.id, label: s.name }))}
                placeholder="Select a subject…"
              />
            </div>
            <div className="scan-actions" style={{ marginTop: 12 }}>
              {!activeSession || activeSession.ended_at ? (
                <button className="btn btn--primary btn--block" onClick={startSession} disabled={!activeSubject}>
                  <Play size={16} /> Start session
                </button>
              ) : (
                <button className="btn btn--danger btn--block" onClick={endSession}>
                  <Square size={16} /> End session
                </button>
              )}
            </div>
            {sessions.length > 0 && (
              <div className="ledger ledger-scroll" style={{ marginTop: 12 }}>
                {sessions.slice(0, 20).map((s) => {
                  const name = s.subject?.name || subjects.find((x) => x.id === s.subject_id)?.name || 'Subject'
                  return (
                    <button
                      key={s.id}
                      className="ledger-row"
                      style={{ textAlign: 'left', cursor: 'pointer', width: '100%', background: s.id === sessionId ? 'var(--bg-soft, rgba(192,144,0,0.08))' : undefined }}
                      onClick={() => setSessionId(s.id)}
                    >
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
                        <BookOpen size={15} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.93rem' }}>{name}</div>
                        <div className="ledger-meta">
                          {new Date(s.started_at).toLocaleString()} · {s.attendance_count ?? 0} present
                        </div>
                      </div>
                      {!s.ended_at ? (
                        <span className="badge badge--ok">open</span>
                      ) : (
                        <span className="badge badge--done">ended</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title"><QrCode size={16} /> Scanner</h2>
        </div>
        <div className="scan-stage">
          <div className="scan-box" id="fnahs-class-scan-box" ref={scanBoxRef} />
          {!scanning && (
            <div className="scan-placeholder">
              Camera off<br /><br />Press start to scan IDs
            </div>
          )}
          {scanning && <div className="scan-overlay" />}
        </div>
        <div className="scan-actions">
          {!scanning ? (
            <button className="btn btn--primary btn--block" onClick={startScan} disabled={!activeSession || !!activeSession.ended_at}>
              <Camera size={16} /> Start scanner
            </button>
          ) : (
            <button className="btn btn--danger btn--block" onClick={stopScan}>
              <CameraOff size={16} /> Stop scanner
            </button>
          )}
        </div>
        {!activeSession && <p className="panel-muted">Start a session to unlock the scanner.</p>}
        {activeSession?.ended_at && !scanning && (
          <p className="panel-muted">This session has ended — you can still review and export the log.</p>
        )}
        {last && (
          <div className="form-ok" style={{ marginTop: 14, marginBottom: 0 }}>
            Last scan: <b>{last.id.slice(0, 8)}</b> · {timeAgo(last.at)}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title"><QrCode size={16} /> Session log</h2>
          {attendance.length > 0 && <span className="chip chip--ok">{attendance.length} present</span>}
          <button
            className="btn btn--tiny"
            onClick={exportXlsx}
            disabled={attendance.length === 0 || !activeSession}
          >
            <Download size={13} /> Export XLSX
          </button>
        </div>
        {!activeSession ? (
          <p className="panel-muted">Pick a session from the list above to view its log.</p>
        ) : attendance.length === 0 ? (
          <p className="panel-muted">No scans recorded for this session yet.</p>
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
                .map((a) => (
                  <div className="ledger-row" key={`${a.session_id}-${a.user_id}`}>
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
            {attQ.trim() && (
              <p className="page-sub" style={{ marginTop: 10 }}>
                Showing{' '}
                {attendance.filter((a) => {
                  const n = attQ.trim().toLowerCase()
                  return (a.profiles?.full_name || '').toLowerCase().includes(n) || (a.profiles?.id_no || '').toLowerCase().includes(n)
                }).length}{' '}
                of {attendance.length} — total {attendance.length} present
              </p>
            )}
          </>
        )}
      </section>
    </div>
  )
}