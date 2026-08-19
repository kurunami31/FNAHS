import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  QrCode,
  Camera,
  CameraOff,
  ClipboardCheck,
  Plus,
  Check,
  Trash2,
  FileSignature,
  X,
  Loader2,
} from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { enumerateCameras, cameraConstraints } from '../lib/scanner'
import { useApp } from '../context/AppContext'
import { can } from '../rbac'
import { api } from '../lib/api'
import { fullDate, initials } from '../lib/format'
import { currentSchoolYear } from '../lib/fees'
import {
  currentSemester,
  clearanceSummary,
  remarkLabel,
  fmtHours,
  SEMESTERS,
  semesterLabel,
} from '../lib/clearance'
import Select from '../components/Select'

const REMARK_OPTIONS = [
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'ir', label: 'IR' },
]

export default function Clearance() {
  const { user, toast, online } = useApp()
  const [scanning, setScanning] = useState(false)
  const scannerRef = useRef(null)
  const lastScanRef = useRef({ id: null, at: 0 })
  const [student, setStudent] = useState(null)
  const [forms, setForms] = useState([])
  const [selYear, setSelYear] = useState(currentSchoolYear())
  const [selSem, setSelSem] = useState(currentSemester())
  const [placement, setPlacement] = useState('')
  const [creating, setCreating] = useState(false)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rowForm, setRowForm] = useState({ dates: '', concept: '', hours: '', agency: '' })
  const [busyRow, setBusyRow] = useState(null)

  const isOfficer = can(user, 'clearance.scan')
  const yearOptions = useMemo(() => {
    const parts = (currentSchoolYear() || '2026-2027').split('-').map(Number)
    const a = Number(parts[0]) || 2026
    const b = a + 1
    return [`${a - 1}-${b - 1}`, `${a}-${b}`, `${a + 1}-${b + 1}`]
  }, [])

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

  const loadForms = useCallback(
    async (studentId) => {
      try {
        setForms(await api.getClearanceForms(studentId))
      } catch {
        toast('Could not load the clearance record', 'err')
      }
    },
    [toast]
  )

  const startScan = async () => {
    try {
      let list = cams
      if (!list) {
        list = await enumerateCameras()
        setCams(list)
      }
      const h5 = new Html5Qrcode('fnahs-clearance-scan-box')
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
    // Dedupe repeated reads of the same card while it stays in frame.
    const now = Date.now()
    const prev = lastScanRef.current
    if (prev.id === userId && now - prev.at < 3000) return
    lastScanRef.current = { id: userId, at: now }
    try {
      const p = await api.getProfile(userId)
      if (!p) throw new Error('No member found for that ID')
      setStudent(p)
      await loadForms(p.id)
      toast(online ? `${p.full_name || 'Member'} — clearance opened` : 'Member found — showing saved clearance')
    } catch (e) {
      console.error(e)
      toast('Could not find that member', 'err')
    }
  }

  const activeForm = forms.find((f) => f.school_year === selYear && f.semester === selSem) || null
  const summary = clearanceSummary(activeForm?.rows)

  const canEditRow = (row) => !row.cleared_at || row.recorded_by === user?.id || user?.role === 'superadmin'

  const createForm = async (e) => {
    e.preventDefault()
    if (!placement.trim()) {
      toast('Enter the placement / center first', 'info')
      return
    }
    if (!student) return
    setCreating(true)
    try {
      await api.createClearanceForm(student.id, { school_year: selYear, semester: selSem, placement: placement.trim() })
      toast('Clearance form created')
      setPlacement('')
      await loadForms(student.id)
    } catch (err) {
      toast(err?.message || 'Could not create the form', 'err')
    } finally {
      setCreating(false)
    }
  }

  const addRow = async (e) => {
    e.preventDefault()
    if (!rowForm.dates.trim() || !rowForm.concept.trim()) {
      toast('Dates and concept are required', 'info')
      return
    }
    if (!activeForm) return
    setSaving(true)
    let ok = false
    try {
      await api.addClearanceRow(activeForm.id, {
        dates: rowForm.dates.trim(),
        concept: rowForm.concept.trim(),
        hours: Number(rowForm.hours) || 0,
        agency: rowForm.agency.trim(),
      })
      toast('Duty row added')
      setRowForm({ dates: '', concept: '', hours: '', agency: '' })
      ok = true
    } catch (err) {
      toast(err?.message || 'Could not add the row', 'err')
    } finally {
      setSaving(false)
    }
    if (ok && student) loadForms(student.id)
  }

  const clearRow = async (row) => {
    if (!window.confirm(`Sign and clear "${row.concept}" for this student? This records you as the Clinical Instructor.`)) return
    setBusyRow(row.id)
    try {
      await api.clearClearanceRow(row.id)
      toast('Row signed — clearance recorded')
      await loadForms(student.id)
    } catch (err) {
      toast(err?.message || 'Could not sign this row', 'err')
    } finally {
      setBusyRow(null)
    }
  }

  const updateRow = async (row, patch) => {
    setBusyRow(row.id)
    try {
      await api.updateClearanceRow(row.id, patch)
      await loadForms(student.id)
    } catch (err) {
      toast(err?.message || 'Could not update the row', 'err')
    } finally {
      setBusyRow(null)
    }
  }

  const toggleRemark = (row, value) => updateRow(row, { remark: row.remark === value ? null : value })
  const toggleDemerit = (row, value) => updateRow(row, { demerit: row.demerit === value ? null : value })
  const toggleExtension = (row, value) => updateRow(row, { days_extension: row.days_extension === value ? null : value })
  const addMerit = (row, amount) => updateRow(row, { merit: (Number(row.merit) || 0) + amount })

  const deleteRow = async (row) => {
    if (!window.confirm(`Delete the row "${row.concept}"? This cannot be undone.`)) return
    setBusyRow(row.id)
    try {
      await api.deleteClearanceRow(row.id)
      toast('Row deleted')
      await loadForms(student.id)
    } catch (err) {
      toast(err?.message || 'Could not delete the row', 'err')
    } finally {
      setBusyRow(null)
    }
  }

  if (!isOfficer) {
    return (
      <div className="empty-state">
        <ClipboardCheck size={44} />
        <h3>Rotational clearance</h3>
        <p>This page is reserved for Clinical Instructors and faculty supervisors.</p>
      </div>
    )
  }

  return (
    <div className="page-c">
      <h1 className="page-title">
        ROTATIONAL CLEARANCE <span className="page-kicker">clinical instructors</span>
      </h1>
      <p className="page-sub">
        Scan a student's ID QR to open their clearance form, add duty rows, then sign each row when their duty is cleared.
      </p>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title"><QrCode size={16} /> Scanner</h2>
        </div>
        <div className="scan-stage">
          <div className="scan-box" id="fnahs-clearance-scan-box" />
          {!scanning && (
            <div className="scan-placeholder">
              Camera off<br /><br />Press start to scan a student ID
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
        {!online && (
          <div className="form-ok" style={{ marginTop: 12, marginBottom: 0 }}>
            Offline mode — changes are saved to this device and sync when the connection returns.
          </div>
        )}
      </section>

      {student && (
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title"><ClipboardCheck size={16} /> Student clearance</h2>
          </div>

          <div className="ledger-row" style={{ border: 'none', padding: '0 0 16px' }}>
            <div className="avatar">
              {student.avatar_url ? <img src={student.avatar_url} alt="" /> : initials(student.full_name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.98rem' }}>{student.full_name}</div>
              <div className="ledger-meta">
                {student.id_no ? `ID ${student.id_no} · ` : ''}
                {student.program || 'No program'}
                {student.year_level ? ` · Yr ${student.year_level}` : ''}
                {student.section ? ` · Sec ${student.section}` : ''}
              </div>
            </div>
            <button className="btn btn--ghost btn--sm" onClick={() => { setStudent(null); setForms([]) }}>
              <X size={14} /> Clear
            </button>
          </div>

          <div className="form-grid" style={{ marginBottom: 16 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>School year</label>
              <Select value={selYear} onChange={setSelYear} options={yearOptions.map((y) => ({ value: y, label: y }))} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Semester</label>
              <Select value={selSem} onChange={setSelSem} options={SEMESTERS.map((s) => ({ value: s, label: semesterLabel(s) }))} />
            </div>
          </div>

          {!activeForm ? (
            <div className="empty-state">
              <ClipboardCheck size={36} />
              <h3>No clearance form for {selYear} · {semesterLabel(selSem)}</h3>
              <p>Start one for this student — the placement / center is set once here.</p>
              <form onSubmit={createForm} style={{ width: '100%', maxWidth: 360, marginTop: 10 }}>
                <div className="field">
                  <label>Placement / Center</label>
                  <input
                    value={placement}
                    onChange={(e) => setPlacement(e.target.value)}
                    placeholder="e.g. DOrSU University Hospital — Ward B"
                    maxLength={200}
                  />
                </div>
                <button className="btn btn--primary btn--block" disabled={creating}>
                  {creating ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} Create clearance form
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="clearance-summary">
                <b className="clearance-summary-placement">{activeForm.placement}</b>
                <div className="clearance-chips">
                  <span className="chip chip--ok">{summary.cleared} cleared</span>
                  <span className="chip">{summary.pending} pending</span>
                  <span className="chip chip--gold">Merit total {summary.meritTotal}</span>
                  {summary.demeritTotal > 0 && <span className="chip chip--warn">Demerit {summary.demeritTotal}</span>}
                  {summary.daysExtension > 0 && <span className="chip chip--hn">Extension {summary.daysExtension}</span>}
                </div>
              </div>

              {adding && (
                <form onSubmit={addRow} className="clearance-add-row">
                  <div className="field">
                    <label>Inclusive dates</label>
                    <input
                      value={rowForm.dates}
                      onChange={(e) => setRowForm({ ...rowForm, dates: e.target.value })}
                      placeholder="e.g. Oct 5 – Oct 16"
                      maxLength={200}
                    />
                  </div>
                  <div className="field">
                    <label>Concept</label>
                    <input
                      value={rowForm.concept}
                      onChange={(e) => setRowForm({ ...rowForm, concept: e.target.value })}
                      placeholder="e.g. OB Ward"
                      maxLength={200}
                    />
                  </div>
                  <div className="field">
                    <label>Hours</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={rowForm.hours}
                      onChange={(e) => setRowForm({ ...rowForm, hours: e.target.value })}
                      placeholder="e.g. 80"
                    />
                  </div>
                  <div className="field">
                    <label>Agency</label>
                    <input
                      value={rowForm.agency}
                      onChange={(e) => setRowForm({ ...rowForm, agency: e.target.value })}
                      placeholder="e.g. DDH District Hospital"
                      maxLength={200}
                    />
                  </div>
                  <div className="clearance-add-row-actions">
                    <button className="btn btn--primary" disabled={saving}>
                      {saving ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} Add row
                    </button>
                    <button type="button" className="btn btn--ghost" disabled={saving} onClick={() => setAdding(false)}>Cancel</button>
                  </div>
                </form>
              )}
              {!adding && (
                <button className="btn btn--ghost btn--sm" style={{ marginBottom: 14 }} onClick={() => setAdding(true)}>
                  <Plus size={14} /> Add duty row
                </button>
              )}

              <div className="clearance-scroll">
                <table className="clearance-table">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Inclusive Dates of Assignment</th>
                      <th>Concept</th>
                      <th>Hours</th>
                      <th>Agency</th>
                      <th>Date of Clearance</th>
                      <th>Clinical Instructor's Signature</th>
                      <th>Merit</th>
                      <th>Demerit</th>
                      <th>Remarks</th>
                      <th>Days Extension</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {activeForm.rows.length === 0 && (
                      <tr>
                        <td colSpan={12} className="clearance-empty">No duty rows yet — add the first one above.</td>
                      </tr>
                    )}
                    {activeForm.rows.map((row, i) => {
                      const editable = canEditRow(row)
                      return (
                        <tr key={row.id} className={row.cleared_at ? '' : 'clearance-row--pending'}>
                          <td>{i + 1}</td>
                          <td>{row.dates}</td>
                          <td>{row.concept}</td>
                          <td>{fmtHours(row.hours)}</td>
                          <td>{row.agency || ''}</td>
                          <td>{row.cleared_at ? fullDate(row.cleared_at) : <span className="clearance-pending-tag">pending</span>}</td>
                          <td>{row.recorded_by_name || (row.cleared_at ? '—' : '')}</td>
                          <td>
                            <div className="clearance-ctrl">
                              {editable ? (
                                <>
                                  <button className="btn btn--tiny" onClick={() => addMerit(row, 1)} disabled={busyRow === row.id}>+1</button>
                                  <button className="btn btn--tiny" onClick={() => addMerit(row, 2)} disabled={busyRow === row.id}>+2</button>
                                  <button className="btn btn--tiny" onClick={() => addMerit(row, 3)} disabled={busyRow === row.id}>+3</button>
                                </>
                              ) : null}
                              <span className="clearance-val">{Number(row.merit) || 0}</span>
                            </div>
                          </td>
                          <td>
                            {editable ? (
                              <div className="clearance-ctrl">
                                {[1, 2, 3].map((d) => (
                                  <button
                                    key={d}
                                    className={`btn btn--tiny${row.demerit === d ? ' btn--on' : ''}`}
                                    onClick={() => toggleDemerit(row, d)}
                                    disabled={busyRow === row.id}
                                  >
                                    {d}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="clearance-val">{row.demerit || ''}</span>
                            )}
                          </td>
                          <td>
                            {editable ? (
                              <div className="clearance-ctrl">
                                {REMARK_OPTIONS.map((r) => (
                                  <button
                                    key={r.value}
                                    className={`btn btn--tiny${row.remark === r.value ? ' btn--on' : ''}`}
                                    onClick={() => toggleRemark(row, r.value)}
                                    disabled={busyRow === row.id}
                                  >
                                    {r.label}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="clearance-val">{row.remark ? remarkLabel(row.remark) : ''}</span>
                            )}
                          </td>
                          <td>
                            {editable ? (
                              <div className="clearance-ctrl">
                                {[1, 2, 3].map((d) => (
                                  <button
                                    key={d}
                                    className={`btn btn--tiny${row.days_extension === d ? ' btn--on' : ''}`}
                                    onClick={() => toggleExtension(row, d)}
                                    disabled={busyRow === row.id}
                                  >
                                    {d}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="clearance-val">{row.days_extension || ''}</span>
                            )}
                          </td>
                          <td>
                            <div className="clearance-ctrl">
                              {!row.cleared_at && (
                                <button
                                  className="btn btn--tiny btn--primary"
                                  onClick={() => clearRow(row)}
                                  disabled={busyRow === row.id}
                                >
                                  {busyRow === row.id ? <Loader2 size={12} className="spin" /> : <FileSignature size={12} />} Clear
                                </button>
                              )}
                              {editable && (
                                <button className="btn btn--tiny btn--danger" onClick={() => deleteRow(row)} disabled={busyRow === row.id}>
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <p className="page-sub" style={{ marginTop: 12, marginBottom: 0 }}>
                <Check size={12} /> A scan signs one row at a time. Signed rows can only be edited by the CI who cleared them (or a superadmin).
              </p>
            </>
          )}
        </section>
      )}

      {!student && (
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title"><ClipboardCheck size={16} /> How it works</h2>
          </div>
          <ol className="panel-muted" style={{ paddingLeft: 18, lineHeight: 1.8, margin: 0 }}>
            <li>Scan the student's ID QR to open their clearance form.</li>
            <li>Add duty rows with the inclusive dates, concept, and number of hours.</li>
            <li>When the student completes a duty, scan again and press <b>Clear</b> on that row — only that row is signed, with you recorded as the Clinical Instructor.</li>
            <li>Mark remarks (Absent / Late / IR), demerit, days extension, and merit points per row — these stay editable by the CI who cleared the row.</li>
            <li>The student sees the same form read-only on their My ID page, with a printable copy.</li>
          </ol>
        </section>
      )}
    </div>
  )
}