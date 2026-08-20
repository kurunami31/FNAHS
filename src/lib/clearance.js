/* Rotational clearance helpers shared by Clearance (CI page) and My ID.
   Model: one form per student per school year + semester (PLACEMENT set
   once at creation); rows are duty assignments carrying a remark, demerit,
   days-extension and merit points. Only faculty + superadmin (clearance
   officers) can touch other students' records; students see their own
   form read-only. Mirrors supabase/migrations/20260831000000_*.sql. */

export const SEMESTERS = ['1st', '2nd', 'Summer']

/** current semester for the given date — PH academic year starts in July */
export function currentSemester(d = new Date()) {
  const m = d.getMonth()
  return m >= 6 ? '1st' : '2nd'
}

export function semesterLabel(s) {
  if (s === 'Summer') return 'Summer'
  return `${s} Semester`
}

const REMARK_LABELS = {
  absent: 'Absent',
  late: 'Late',
  ir: 'IR',
  inc: 'INC',
  deficient: 'Deficient/With Deficiency',
  good_standing: 'Good Standing',
}

export function remarkLabel(r) {
  return REMARK_LABELS[r] || ''
}

/** roll up a form's rows: counts + summed merit/demerit/extension */
export function clearanceSummary(rows = []) {
  const s = { total: 0, cleared: 0, pending: 0, meritTotal: 0, demeritTotal: 0, absent: 0, late: 0, ir: 0, daysExtension: 0 }
  for (const r of rows || []) {
    s.total++
    s.meritTotal += Number(r.merit) || 0
    s.demeritTotal += Number(r.demerit) || 0
    s.daysExtension += Number(r.days_extension) || 0
    if (r.cleared_at) s.cleared++
    else s.pending++
    if (r.remark === 'absent') s.absent++
    else if (r.remark === 'late') s.late++
    else if (r.remark === 'ir') s.ir++
  }
  return s
}

/** hours as a short string (integers stay plain) */
export function fmtHours(n) {
  const v = Number(n || 0)
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

/** the 11 column headers, in display order (matches the official form) */
export const CLEARANCE_COLUMNS = [
  { key: 'no', label: 'No.' },
  { key: 'dates', label: 'Inclusive Date of Assignment' },
  { key: 'concept', label: 'Concept' },
  { key: 'hours', label: 'Number of Hours' },
  { key: 'agency', label: 'Agency' },
  { key: 'cleared_at', label: 'Date of Clearance' },
  { key: 'recorded_by', label: "Clinical Instructor's Signature" },
  { key: 'merit', label: 'Merit' },
  { key: 'demerit', label: 'Demerit' },
  { key: 'remark', label: 'Remarks' },
  { key: 'days_extension', label: 'Days Extension' },
]
