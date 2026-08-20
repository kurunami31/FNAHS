import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  QrCode,
  Camera,
  CameraOff,
  ClipboardCheck,
  Plus,
  Check,
  Trash2,
  Pencil,
  FileSignature,
  Search,
  ArrowRight,
  X,
  Loader2,
  Printer,
} from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { enumerateCameras, cameraConstraints } from '../lib/scanner'
import { useApp } from '../context/AppContext'
import { can } from '../rbac'
import { api } from '../lib/api'
import { fullDateTime, initials, timeAgo } from '../lib/format'
import { currentSchoolYear } from '../lib/fees'
import {
  currentSemester,
  clearanceSummary,
  remarkLabel,
  fmtHours,
  SEMESTERS,
  semesterLabel,
  MERIT_OPTIONS,
  DEMERIT_OPTIONS,
} from '../lib/clearance'
import Select from '../components/Select'
import ClearancePrintDoc from '../components/ClearancePrintDoc'

const REMARK_OPTIONS = [
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'ir', label: 'IR' },
  { value: 'inc', label: 'INC' },
  { value: 'deficient', label: 'Deficient/With Deficiency' },
  { value: 'good_standing', label: 'Good Standing' },
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
  const [editPlacement, setEditPlacement] = useState(false)
  const [placementDraft, setPlacementDraft] = useState('')
  const [editRowId, setEditRowId] = useState(null)
  const [editDraft, setEditDraft] = useState({ dates: '', concept: '', hours: '', agency: '' })
  const [searchQ, setSearchQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [lastScanned, setLastScanned] = useState(() => {
    try {
      const arr = JSON.parse(localStorage.getItem('fnahs-clearance-last-scans') || '[]')
      return Array.isArray(arr) ? arr.slice(0, 5) : []
    } catch {
      return []
    }
  })

  const isOfficer = can(user, 'clearance.scan')
  const canEdit = can(user, 'clearance.edit')
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

  useEffect(() => {
    const q = searchQ.trim()
    if (!q) {
      setResults([])
      return
    }
    let cancel = false
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await api.searchStudents(q)
        if (!cancel) setResults(r)
      } catch {
        if (!cancel) setResults([])
      } finally {
        if (!cancel) setSearching(false)
      }
    }, 350)
    return () => {
      cancel = true
      clearTimeout(t)
    }
  }, [searchQ])

  // Open a student's clearance: first-years are locked out entirely.
  const selectStudent = async (p) => {
    setStudent(p)
    setResults([])
    setSearchQ('')
    if (p.year_level === '1') {
      setForms([])
      return false
    }
    await loadForms(p.id)
    return true
  }

  const openResult = async (p) => {
    const ok = await selectStudent(p)
    toast(
      ok ? `${p.full_name || 'Member'} — clearance opened` : 'First-year students are not yet eligible for rotational clearance',
      ok ? '' : 'info'
    )
  }

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
      const record = { id: p.id, id_no: p.id_no || null, name: p.full_name || null, at: Date.now() }
      setLastScanned((prev) => {
        const next = [record, ...(prev || []).filter((s) => s.id !== record.id)].slice(0, 5)
        try {
          localStorage.setItem('fnahs-clearance-last-scans', JSON.stringify(next))
        } catch {
          /* storage may be full — the in-memory value still updates */
        }
        return next
      })
      openStudent(p)
    } catch (e) {
      console.error(e)
      toast('Could not find that member', 'err')
    }
  }

  const openStudent = async (p) => {
    const ok = await selectStudent(p)
    toast(
      ok
        ? online
          ? `${p.full_name || 'Member'} — clearance opened`
          : 'Member found — showing saved clearance'
        : 'First-year students are not yet eligible for rotational clearance',
      ok ? '' : 'info'
    )
  }

  const reopenScanned = async (s) => {
    try {
      const p = await api.getProfile(s.id)
      if (!p) throw new Error('No member found for that ID')
      openStudent(p)
    } catch {
      toast('Could not find that member', 'err')
    }
  }

  const activeForm = forms.find((f) => f.school_year === selYear && f.semester === selSem) || null
  const summary = clearanceSummary(activeForm?.rows)

  const canEditRow = (row) =>
    canEdit && (!row.cleared_at || row.recorded_by === user?.id || user?.role === 'superadmin')

  const createForm = async (e) => {
    e.preventDefault()
    if (!canEdit) {
      toast('You have read-only access to clearance', 'info')
      return
    }
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
    if (!canEdit) {
      toast('You have read-only access to clearance', 'info')
      return
    }
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
    if (!canEdit) {
      toast('You have read-only access to clearance', 'info')
      return
    }
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
    if (!canEdit) {
      toast('You have read-only access to clearance', 'info')
      return
    }
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

  const savePlacement = async (e) => {
    e.preventDefault()
    if (!canEdit) {
      toast('You have read-only access to clearance', 'info')
      return
    }
    if (!activeForm) return
    const value = placementDraft.trim()
    if (!value) {
      toast('Placement cannot be empty', 'info')
      return
    }
    setBusyRow('__form')
    try {
      await api.updateClearanceForm(activeForm.id, { placement: value })
      toast('Placement updated')
      setEditPlacement(false)
      await loadForms(student.id)
    } catch (err) {
      toast(err?.message || 'Could not update the placement', 'err')
    } finally {
      setBusyRow(null)
    }
  }

  const removeForm = async () => {
    if (!canEdit) {
      toast('You have read-only access to clearance', 'info')
      return
    }
    if (!activeForm) return
    if (!window.confirm(`Delete this clearance form (${activeForm.school_year} · ${semesterLabel(activeForm.semester)}) and ALL of its rows? This cannot be undone.`)) return
    setBusyRow('__form')
    try {
      await api.deleteClearanceForm(activeForm.id)
      toast('Clearance form deleted')
      await loadForms(student.id)
    } catch (err) {
      toast(err?.message || 'Could not delete the form', 'err')
    } finally {
      setBusyRow(null)
    }
  }

  const startEditRow = (row) => {
    setEditRowId(row.id)
    setEditDraft({ dates: row.dates, concept: row.concept, hours: String(row.hours ?? ''), agency: row.agency || '' })
  }

  const saveEditRow = async (row) => {
    if (!canEdit) {
      toast('You have read-only access to clearance', 'info')
      return
    }
    const patch = {
      dates: editDraft.dates.trim(),
      concept: editDraft.concept.trim(),
      hours: Number(editDraft.hours) || 0,
      agency: editDraft.agency.trim(),
    }
    if (!patch.dates || !patch.concept) {
      toast('Dates and concept are required', 'info')
      return
    }
    setBusyRow(row.id)
    try {
      await api.updateClearanceRow(row.id, patch)
      toast('Duty row updated')
      setEditRowId(null)
      await loadForms(student.id)
    } catch (err) {
      toast(err?.message || 'Could not update the row', 'err')
    } finally {
      setBusyRow(null)
    }
  }

  const toggleRemark = (row, value) => updateRow(row, { remark: row.remark === value ? null : value })
  const setMerit = (row, value) => updateRow(row, { merit: Number(value) })
  const setDemerit = (row, value) => updateRow(row, { demerit: value ? Number(value) : null })

  const deleteRow = async (row) => {
    if (!canEdit) {
      toast('You have read-only access to clearance', 'info')
      return
    }
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
        {lastScanned.length > 0 && (
          <div className="clearance-scan-history">
            <div className="clearance-scan-history-title">Previously scanned</div>
            {lastScanned.map((s) => (
              <button key={s.id} type="button" title="Reopen this student's clearance" onClick={() => reopenScanned(s)}>
                <b>ID {s.id_no || s.id?.slice(0, 8)}</b>
                {s.name ? ` — ${s.name}` : ''}
                {s.at ? ` · ${timeAgo(s.at)}` : ''}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title"><Search size={16} /> Find a student</h2>
        </div>
        <div className="dir-search" style={{ marginBottom: 10 }}>
          <Search size={17} />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search by name, ID number, or email…"
            autoComplete="off"
          />
          {searching && <Loader2 size={15} className="spin" />}
        </div>
        {results.length > 0 && (
          <div className="search-results">
            {results.map((r) => (
              <button key={r.id} className="search-result" onClick={() => openResult(r)}>
                <div className="avatar">
                  {r.avatar_url ? <img src={r.avatar_url} alt="" /> : initials(r.full_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <b>{r.full_name}</b>
                  <div className="ledger-meta">
                    {r.id_no ? `ID ${r.id_no} · ` : ''}
                    {r.program || ''}
                    {r.year_level ? ` · Yr ${r.year_level}` : ''}
                    {r.section ? ` · Sec ${r.section}` : ''}
                  </div>
                </div>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        )}
        {!searching && searchQ.trim() && results.length === 0 && (
          <p className="panel-muted">No students match “{searchQ}”.</p>
        )}
      </section>

      {student && (
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title"><ClipboardCheck size={16} /> Student clearance</h2>
            {activeForm && activeForm.rows.length > 0 && (
              <button className="btn btn--tiny" onClick={() => window.print()} title="Print this student's rotational clearance">
                <Printer size={13} /> Print
              </button>
            )}
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

          {student.year_level === '1' ? (
            <div className="empty-state" style={{ border: '1px dashed var(--line-strong)', borderRadius: 'var(--r-lg)', padding: 28 }}>
              <ClipboardCheck size={36} />
              <h3>First-year students are not yet eligible</h3>
              <p>Rotational clearance opens for them starting their second year. You can still search and scan other students.</p>
            </div>
          ) : (
            <>
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
              {canEdit ? (
                <>
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
                </>
              ) : (
                <p>Nothing on file for this period. A Clinical Instructor can start it.</p>
              )}
            </div>
          ) : (
            <>
              <div className="clearance-summary">
                {editPlacement ? (
                  <form className="clearance-placement-edit" onSubmit={savePlacement}>
                    <input
                      autoFocus
                      value={placementDraft}
                      onChange={(e) => setPlacementDraft(e.target.value)}
                      placeholder="Placement / center"
                      maxLength={200}
                    />
                    <button className="btn btn--tiny btn--primary" disabled={busyRow === '__form'}>
                      {busyRow === '__form' ? <Loader2 size={12} className="spin" /> : <Check size={12} />} Save
                    </button>
                    <button type="button" className="btn btn--tiny btn--ghost" onClick={() => setEditPlacement(false)}>Cancel</button>
                  </form>
                ) : (
                  <b className="clearance-summary-placement">{activeForm.placement}</b>
                )}
                <div className="clearance-chips">
                  <span className="chip chip--ok">{summary.cleared} cleared</span>
                  <span className="chip">{summary.pending} pending</span>
                  <span className="chip chip--gold">Merit total {summary.meritTotal}</span>
                  {summary.demeritTotal > 0 && (
                    <span className="chip chip--warn" title="Demerits after merits are deducted 1:1">
                      Demerit {summary.demeritBalance} of {summary.demeritTotal}
                    </span>
                  )}
                  {summary.autoDays > 0 && (
                    <span className="chip chip--hn">Extension {summary.autoDays} day{summary.autoDays === 1 ? '' : 's'} (auto)</span>
                  )}
                </div>
                <div className="clearance-summary-actions">
                  {canEdit && (
                    <>
                      <button
                        className="btn btn--tiny"
                        title="Edit placement"
                        disabled={busyRow === '__form'}
                        onClick={() => {
                          setPlacementDraft(activeForm.placement)
                          setEditPlacement(true)
                        }}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        className="btn btn--tiny btn--danger"
                        title="Delete this clearance form"
                        disabled={busyRow === '__form'}
                        onClick={removeForm}
                      >
                        {busyRow === '__form' ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {canEdit && adding && (
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
              {canEdit && !adding && (
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
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {activeForm.rows.length === 0 && (
                      <tr>
                        <td colSpan={11} className="clearance-empty">No duty rows yet — add the first one above.</td>
                      </tr>
                    )}
                    {activeForm.rows.map((row, i) => {
                      const editable = canEditRow(row)
                      const isEditing = editRowId === row.id
                      return (
                        <tr key={row.id} className={row.cleared_at ? '' : 'clearance-row--pending'}>
                          <td>{i + 1}</td>
                          <td>
                            {isEditing ? (
                              <input className="clearance-inline-input" value={editDraft.dates} onChange={(e) => setEditDraft({ ...editDraft, dates: e.target.value })} maxLength={200} />
                            ) : (
                              <>
                                {row.dates}
                                {row.created_at && <div className="clearance-row-stamp">Added {fullDateTime(row.created_at)}</div>}
                              </>
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input className="clearance-inline-input" value={editDraft.concept} onChange={(e) => setEditDraft({ ...editDraft, concept: e.target.value })} maxLength={200} />
                            ) : (
                              row.concept
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input className="clearance-inline-input clearance-inline-hours" type="number" min="0" step="0.5" value={editDraft.hours} onChange={(e) => setEditDraft({ ...editDraft, hours: e.target.value })} />
                            ) : (
                              fmtHours(row.hours)
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input className="clearance-inline-input" value={editDraft.agency} onChange={(e) => setEditDraft({ ...editDraft, agency: e.target.value })} maxLength={200} />
                            ) : (
                              row.agency || ''
                            )}
                          </td>
                          <td>
                            {row.cleared_at ? (
                              <>
                                {fullDateTime(row.cleared_at)}
                                {row.updated_at && row.updated_at !== row.cleared_at && (
                                  <div className="clearance-row-stamp">Edited {fullDateTime(row.updated_at)}</div>
                                )}
                              </>
                            ) : (
                              <span className="clearance-pending-tag">pending</span>
                            )}
                          </td>
                          <td>{row.recorded_by_name || (row.cleared_at ? '—' : '')}</td>
                          <td>
                            {editable ? (
                              <Select
                                compact
                                value={row.merit || 0}
                                onChange={(v) => setMerit(row, v)}
                                options={MERIT_OPTIONS}
                                ariaLabel={`Merit points for ${row.concept}`}
                                disabled={busyRow === row.id}
                              />
                            ) : (
                              <span className="clearance-val">{Number(row.merit) || 0}</span>
                            )}
                          </td>
                          <td>
                            {editable ? (
                              <Select
                                compact
                                value={row.demerit ?? null}
                                onChange={(v) => setDemerit(row, v)}
                                options={DEMERIT_OPTIONS}
                                ariaLabel={`Demerit points for ${row.concept}`}
                                disabled={busyRow === row.id}
                              />
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
                            <div className="clearance-ctrl">
                              {isEditing ? (
                                <>
                                  <button
                                    className="btn btn--tiny btn--primary"
                                    onClick={() => saveEditRow(row)}
                                    disabled={busyRow === row.id}
                                  >
                                    {busyRow === row.id ? <Loader2 size={12} className="spin" /> : <Check size={12} />} Save
                                  </button>
                                  <button className="btn btn--tiny btn--ghost" onClick={() => setEditRowId(null)} disabled={busyRow === row.id}>
                                    <X size={12} /> Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  {editable && (
                                    <button className="btn btn--tiny" title="Edit dates, concept, hours or agency" onClick={() => startEditRow(row)} disabled={busyRow === row.id}>
                                      <Pencil size={12} />
                                    </button>
                                  )}
                                  {canEdit && !row.cleared_at && (
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
                                </>
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
            <li>Mark remarks (Absent / Late / IR), and set merit / demerit points per row from 1 to 12 — these stay editable by the CI who cleared the row.</li>
            <li>Merits deduct from demerits 1:1, and every 3 demerits left over auto-convert to 1 day of extension.</li>
            <li>The student sees the same form read-only on their My ID page, with a printable copy.</li>
          </ol>
        </section>
      )}

      {student && activeForm && (
        <div className="print-clearance-area">
          <div className="clearance-print-doc">
            <ClearancePrintDoc form={activeForm} student={student} />
          </div>
        </div>
      )}
    </div>
  )
}