import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Download, ShieldCheck, Loader2, HandCoins, ClipboardCheck, Printer } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { can } from '../rbac'
import { api } from '../lib/api'
import { monthDay, timeAgo, fullDate } from '../lib/format'
import { drawIdCanvas } from '../lib/idCanvas'
import { currentSchoolYear, feeSummary, fmtPeso } from '../lib/fees'
import { clearanceSummary, remarkLabel, fmtHours, semesterLabel } from '../lib/clearance'

export default function IdCard() {
  const { user, toast } = useApp()
  const canvasRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [err, setErr] = useState(null)
  const [saving, setSaving] = useState(false)
  const [format, setFormat] = useState('png')
  const [saveImage, setSaveImage] = useState(null)
  const [history, setHistory] = useState([])
  const [fee, setFee] = useState(null)
  const [annualFee, setAnnualFee] = useState(200)
  const [clearance, setClearance] = useState([])

  useEffect(() => {
    api
      .getMyAttendance()
      .then(setHistory)
      .catch(() => {})
    Promise.all([api.getFeePayments(currentSchoolYear()), api.getAnnualFee()])
      .then(([payments, annual]) => {
        setFee(payments.filter((p) => p.member_id === user?.id))
        setAnnualFee(annual)
      })
      .catch(() => {})
    api
      .getMyClearance()
      .then(setClearance)
      .catch(() => {})
  }, [user?.id])

  const name = user?.full_name || 'Student Member'
  const qrValue = JSON.stringify({ t: 'fnahs-id', id: user?.id || 'demo', n: name, v: 1 })

  const draw = async () => {
    const c = document.createElement('canvas')
    try {
      const qr = await QRCode.toDataURL(qrValue, {
        width: 600,
        margin: 1,
        color: { dark: '#2b2410', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      })
      await drawIdCanvas(c, { profile: user, avatarUrl: user?.avatar_url, qr })
      canvasRef.current = c
      setPreview(c.toDataURL('image/png'))
      setErr(null)
    } catch (e) {
      console.error(e)
      setErr('Could not render your ID. Pull to refresh and try again.')
    }
  }

  const profileKey = JSON.stringify([
    user?.id,
    user?.full_name,
    user?.avatar_url,
    user?.program,
    user?.year_level,
    user?.section,
    user?.role,
    user?.positions,
  ])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        await Promise.allSettled([
          document.fonts.load('700 40px Fraunces'),
          document.fonts.load('700 26px "Share Tech Mono"'),
          document.fonts.load('700 14px "Share Tech Mono"'),
        ])
      } catch {
        /* fonts optional */
      }
      if (alive) await draw()
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileKey])

  const download = async () => {
    const c = canvasRef.current
    if (!c || saving) return
    setSaving(true)
    try {
      const isJpeg = format === 'jpeg'
      const mime = isJpeg ? 'image/jpeg' : 'image/png'
      const ext = isJpeg ? 'jpg' : 'png'
      const fileName = `FNAHS-ID.${ext}`

      const blob = await new Promise((res) => c.toBlob(res, mime, 0.92))
      if (!blob) throw new Error('Could not render the image.')
      const url = URL.createObjectURL(blob)
      const file = new File([blob], fileName, { type: mime })
      const ua = navigator.userAgent || ''
      const isIOS = /iPad|iPhone|iPod/.test(ua)
      const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|Edg|OPR/.test(ua)

      const revokeLater = (ms = 60_000) => setTimeout(() => URL.revokeObjectURL(url), ms)

      const saveToDownloads = () => {
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
        revokeLater()
        toast(`Saved — check your downloads folder (${ext.toUpperCase()})`)
      }

      // Mobile / Safari: native share sheet when supported, otherwise show the image
      // full-screen so it can be long-pressed / right-clicked to save.
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'FNAHS PULSO ID', text: 'My FNAHS PULSO digital ID.' })
          revokeLater()
        } catch (shareErr) {
          if (shareErr.name !== 'AbortError') {
            if (isIOS || isSafari) setSaveImage(url)
            else saveToDownloads()
          }
        }
      } else if (isIOS || isSafari) {
        setSaveImage(url)
      } else {
        saveToDownloads()
      }
    } catch (e) {
      console.error(e)
      toast('Could not export the ID image', 'err')
    } finally {
      setSaving(false)
    }
  }

  const isStaff = can(user, 'feed.moderate') || can(user, 'events.manage') || can(user, 'attendance.scan')

  return (
    <div className="page-c">
      <h1 className="page-title">
        MY ID <span className="page-kicker">digital id pass</span>
      </h1>
      <p className="page-sub">One QR ID for every FNAHS PULSO event — scan at the door and attendance is logged on the fly.</p>

      <div className="id-stage">
        {preview ? (
          <img src={preview} alt="Your FNAHS digital ID" className="id-preview" />
        ) : (
          <div className="id-card-loading">{err || 'Rendering your ID…'}</div>
        )}

        <div className="id-actions">
          <div className="id-format" role="group" aria-label="Image format">
            <button type="button" className={format === 'png' ? 'is-on' : ''} onClick={() => setFormat('png')} disabled={saving}>
              PNG
            </button>
            <button type="button" className={format === 'jpeg' ? 'is-on' : ''} onClick={() => setFormat('jpeg')} disabled={saving}>
              JPEG
            </button>
          </div>
          <button className="btn btn--primary" onClick={download} disabled={saving || !preview}>
            {saving ? <Loader2 size={16} className="spin" /> : <Download size={16} />} Save as {format === 'jpeg' ? 'JPEG' : 'PNG'}
          </button>
          {isStaff && (
            <span className="chip chip--ok">
              <ShieldCheck size={14} /> Verified by org staff
            </span>
          )}
        </div>
      </div>

      {saveImage && (
        <div className="id-save-overlay" role="dialog" aria-modal="true" onClick={() => setSaveImage(null)}>
          <div className="id-save-pop" onClick={(e) => e.stopPropagation()}>
            <img src={saveImage} alt="Your FNAHS digital ID — press and hold to save" />
            <p>
              <b>Press and hold</b> the image, then choose <b>Save Image</b> or <b>Add to Photos</b>.
            </p>
            <button type="button" className="btn" onClick={() => setSaveImage(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      <section className="sec" aria-labelledby="h-fees" style={{ maxWidth: 640, margin: '26px auto 0', width: '100%' }}>
        <div className="sec-head">
          <h2 id="h-fees"><HandCoins size={18} /> Membership Fees</h2>
          <span className="sec-kicker">{currentSchoolYear()}</span>
        </div>
        {!fee || fee.length === 0 ? (
          <p className="panel-muted">No membership fee record for this school year yet — check in with the treasurer.</p>
        ) : (
          <div className="mm-chips">
            {(() => {
              const s = feeSummary(fee, annualFee)
              return (
                <span className={`chip${s.status === 'paid' ? ' chip--ok' : s.status === 'partial' ? ' chip--warn' : ''}`}>
                  {s.status === 'paid'
                    ? `PAID — ₱${fmtPeso(s.paid)}`
                    : s.status === 'partial'
                      ? `PARTIAL — ₱${fmtPeso(s.paid)} of ₱${fmtPeso(s.annual)}`
                      : 'UNPAID'}
                </span>
              )
            })()}
            <span className="chip">Annual fee ₱{fmtPeso(annualFee)}</span>
            {fee.map((p) => (
              <span key={p.id} className={`chip${p.payment_type === 'full' ? ' chip--ok' : ''}`}>
                {p.payment_type === 'full' ? 'FULL' : '½'} ₱{fmtPeso(p.amount)}
                {p.receipt ? ` · OR ${p.receipt}` : ''}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="sec" aria-labelledby="h-history" style={{ maxWidth: 640, margin: '34px auto 0', width: '100%' }}>
        <div className="sec-head">
          <h2 id="h-history">Attendance History</h2>
          <span className="sec-kicker">{history.length} scan{history.length === 1 ? '' : 's'}</span>
        </div>
        {history.length === 0 ? (
          <p className="panel-muted">You haven't been scanned into any event yet — your next one is a great start.</p>
        ) : (
          <div className="ledger">
            {history.map((h) => (
              <div key={`${h.event_id}-${h.scanned_at}`} className="ledger-row">
                <div className="round-date" style={{ borderRight: 'none', width: 44 }}>
                  <b style={{ fontSize: '1.15rem' }}>{monthDay(h.starts_at).day}</b>
                  <span>{monthDay(h.starts_at).month}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.93rem' }}>{h.title}</div>
                  <div className="ledger-meta">{h.location || '—'} · scanned {timeAgo(h.scanned_at)}</div>
                </div>
                <span className="badge badge--ok">present</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="sec" aria-labelledby="h-clearance" style={{ maxWidth: 860, margin: '34px auto 0', width: '100%' }}>
        <div className="sec-head">
          <h2 id="h-clearance"><ClipboardCheck size={18} /> Rotational Clearance</h2>
          <span className="sec-kicker">
            {clearance.length} form{clearance.length === 1 ? '' : 's'}
            {clearance.length > 0 && (
              <button className="btn btn--tiny" style={{ marginLeft: 10 }} onClick={() => window.print()}>
                <Printer size={13} /> Print
              </button>
            )}
          </span>
        </div>
        {clearance.length === 0 ? (
          <p className="panel-muted">
            Your Clinical Instructors record your rotational clearance here once they start signing your duties. Nothing on file yet.
          </p>
        ) : (
          <div className="clearance-forms">
            {clearance.map((form) => (
              <StudentClearanceForm key={form.id} form={form} student={user} />
            ))}
          </div>
        )}
      </section>

      {clearance.length > 0 && (
        <div className="print-clearance-area">
          <div className="clearance-print-doc">
            {clearance.map((form) => (
              <StudentClearanceForm key={form.id} form={form} student={user} print />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StudentClearanceForm({ form, student, print }) {
  const summary = clearanceSummary(form.rows)
  return (
    <article className={`clearance-form${print ? ' clearance-form--print' : ''}`}>
      <div className="clearance-form-head">
        <div className="clearance-print-logos">
          <img src="/dorsu-logo.png" alt="DORSU" />
          <img src="/FNAHS.png" alt="FNAHS" />
        </div>
        <div className="clearance-print-institution">
          <b>Bachelor of Science in Nursing</b>
          <span>Related Learning Experience Manual</span>
        </div>
      </div>
      <h3 className="clearance-form-title">INDIVIDUAL CLINICAL ROTATION CLEARANCE</h3>
      <div className="clearance-form-meta">
        <span><b>NAME:</b> {student?.full_name || form.member_id?.slice(0, 8)}</span>
        <span><b>PLACEMENT:</b> {form.placement}</span>
        <span><b>SCHOOL YEAR / SEMESTER:</b> {form.school_year} · {semesterLabel(form.semester)}</span>
      </div>
      <div className="clearance-scroll">
        <table className="clearance-table">
          <colgroup>
            <col style={{ width: '16%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Inclusive Date of Assignment</th>
              <th>Concept</th>
              <th>Number of Hours</th>
              <th>Agency</th>
              <th>Date of Clearance</th>
              <th>Clinical Instructor's Signature</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {form.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="clearance-empty">No duties recorded on this form yet.</td>
              </tr>
            )}
            {form.rows.map((row) => (
              <tr key={row.id}>
                <td>{row.dates}</td>
                <td>{row.concept}</td>
                <td>{fmtHours(row.hours)}</td>
                <td>{row.agency || ''}</td>
                <td>{row.cleared_at ? fullDate(row.cleared_at) : ''}</td>
                <td>{row.recorded_by_name || ''}</td>
                <td>{row.remark ? remarkLabel(row.remark) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!print && (
        <div className="clearance-form-tally">
          <span className="chip chip--ok">{summary.cleared} cleared</span>
          <span className="chip">{summary.pending} pending</span>
          <span className="chip chip--gold">Merit total {summary.meritTotal}</span>
          {summary.demeritTotal > 0 && <span className="chip chip--warn">Demerit {summary.demeritTotal}</span>}
          {summary.daysExtension > 0 && <span className="chip chip--hn">Extension {summary.daysExtension}</span>}
        </div>
      )}
    </article>
  )
}