import { clearanceSummary, remarkLabel, fmtHours, semesterLabel } from '../lib/clearance'
import { fullDateTime } from '../lib/format'

/*
 * Printable individual clinical rotation clearance — shared by the student's
 * My ID page and the Clinical Instructor's clearance screen. Renders the
 * official-style form incl. the student's ID number so a scanned / searched
 * student stays traceable on the paper copy.
 */

export default function ClearancePrintDoc({ form, student }) {
  const summary = clearanceSummary(form.rows)
  return (
    <article className="clearance-form clearance-form--print">
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
        <div className="clearance-meta-item"><b>NAME</b><span>{student?.full_name || '—'}</span></div>
        <div className="clearance-meta-item"><b>STUDENT ID</b><span>{student?.id_no || '—'}</span></div>
        <div className="clearance-meta-item"><b>PLACEMENT</b><span>{form.placement || '—'}</span></div>
        <div className="clearance-meta-item">
          <b>SCHOOL YEAR / SEMESTER</b>
          <span>{form.school_year} · {semesterLabel(form.semester)}</span>
        </div>
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
                <td>{row.cleared_at ? fullDateTime(row.cleared_at) : ''}</td>
                <td>{row.recorded_by_name || ''}</td>
                <td>{row.remark ? remarkLabel(row.remark) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="clearance-form-tally">
        <span className="chip chip--ok">{summary.cleared} cleared</span>
        <span className="chip">{summary.pending} pending</span>
        {summary.meritTotal > 0 && <span className="chip chip--gold">Merit {summary.meritTotal}</span>}
        {summary.demeritTotal > 0 && <span className="chip chip--warn">Demerit {summary.demeritBalance} of {summary.demeritTotal}</span>}
        {summary.autoDays > 0 && (
          <span className="chip chip--hn">Extension {summary.autoDays} day{summary.autoDays === 1 ? '' : 's'}</span>
        )}
      </div>
    </article>
  )
}