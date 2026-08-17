/* CSV export helpers — hand-rolled, no dependencies. A UTF-8 BOM is prepended
   so Excel opens the file with proper letter rendering. */

function csvCell(v) {
  const s = String(v ?? '')
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function rowsToCsv(headers, rows) {
  return [headers.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n')
}

export function downloadCsv(filename, headers, rows) {
  const csv = rowsToCsv(headers, rows)
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** attendance roster for one event, sorted by scan time */
export function attendanceCsv(event, attendance) {
  const when = (s) => (s ? new Date(s) : null)
  const sorted = [...attendance].sort((a, b) => (when(a.scanned_at) || 0) - (when(b.scanned_at) || 0))
  const rows = sorted.map((a) => {
    const p = a.profiles || {}
    return [
      p.full_name || '',
      p.program || '',
      p.year_level ? `Year ${p.year_level}` : '',
      p.email || '',
      when(a.scanned_at) ? when(a.scanned_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '',
      'Present',
    ]
  })
  const stamp = new Date().toISOString().slice(0, 10)
  const slug = (event?.title || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return { filename: `attendance-${slug}-${stamp}.csv`, headers: ['Name', 'Program', 'Year Level', 'Email', 'Scanned At (PHT)', 'Status'], rows }
}
