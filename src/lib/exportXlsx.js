/* Branded .xlsx export helpers built on exceljs (loaded on demand so it
   stays in its own lazy chunk). Layout follows the FNAHS PULSO identity:
   seal navy #100e60, gold #c09000, cream #faf7ee, alternating zebra rows. */

const NAVY = '100E60'
const GOLD = 'C09000'
const CREAM = 'FAF7EE'
const LIGHT = 'F4F1E8'
const WHITE = 'FFFFFF'
const GREY = '7A7894'

const FONT = { name: 'Calibri', size: 10 }
const TITLE_FONT = { name: 'Calibri', size: 16, bold: true, color: { argb: NAVY } }
const SUB_FONT = { name: 'Calibri', size: 9, color: { argb: GREY } }
const HEAD_FONT = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } }

async function excel() {
  return import('exceljs')
}

function styledHeader(row, labels) {
  row.height = 20
  labels.forEach((l, i) => {
    const c = row.getCell(i + 1)
    c.value = l
    c.font = HEAD_FONT
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    c.border = { top: { style: 'thin', color: { argb: NAVY } }, bottom: { style: 'thin', color: { argb: NAVY } } }
  })
}

function styledBody(sheet, startRow, rows, widths) {
  const zebra = (i) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 1 ? CREAM : WHITE } })
  rows.forEach((r, i) => {
    const row = sheet.getRow(startRow + i)
    row.height = 17
    r.forEach((v, j) => {
      const c = row.getCell(j + 1)
      c.value = v
      c.font = FONT
      c.fill = zebra(i)
      c.border = { bottom: { style: 'hair', color: { argb: 'D8D4C0' } } }
    })
  })
  widths.forEach((w, j) => {
    sheet.getColumn(j + 1).width = w
    sheet.getColumn(j + 1).alignment = { vertical: 'middle', wrapText: w > 20 }
  })
}

function brandHeader(ws, title, subtitle) {
  const t = ws.getCell('A1')
  t.value = title
  t.font = TITLE_FONT
  const s = ws.getCell('A2')
  s.value = subtitle
  s.font = SUB_FONT
  ws.getRow(1).height = 24
  ws.getRow(2).height = 14
  ws.getCell('A1').alignment = { vertical: 'middle' }
  ws.getCell('A2').alignment = { vertical: 'middle' }
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10)
}

function pht(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
}

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function downloadWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** Attendance roster for a single event, sorted by scan time. When the
    event has a contribution fee, adds a per-member fee status column and a
    Contributions worksheet with the payments collected. */
export async function attendanceWorkbook(event, attendance, eventPayments = []) {
  const { Workbook } = await excel()
  const wb = new Workbook()
  const ws = wb.addWorksheet('Attendance', { views: [{ showGridLines: false }] })
  const sorted = [...attendance].sort((a, b) => new Date(a.scanned_at || 0) - new Date(b.scanned_at || 0))

  const fee = Number(event?.fee_amount) || 0
  const hasFee = fee > 0
  const paidBy = new Set((eventPayments || []).map((p) => p.member_id))

  brandHeader(
    ws,
    'FNAHS PULSO — Attendance Log',
    `${event?.title || 'Event'} · ${event?.starts_at ? pht(event.starts_at) : ''}${event?.location ? ` · ${event.location}` : ''} · ${sorted.length} member(s) present${hasFee ? ` · contribution fee ₱${fee.toLocaleString('en-PH')}` : ''}`,
  )
  const headers = ['#', 'Name', 'ID No', 'Program', 'Year Level', 'Email', 'Scanned At (PHT)', 'Status']
  if (hasFee) headers.push('Contribution (₱)', 'Fee Status')
  styledHeader(ws.getRow(4), headers)
  const widths = [5, 28, 12, 16, 12, 26, 20, 10]
  if (hasFee) widths.push(16, 12)
  styledBody(
    ws,
    5,
    sorted.map((a, i) => {
      const p = a.profiles || {}
      const row = [
        i + 1,
        p.full_name || a.user_id.slice(0, 10),
        p.id_no || '',
        p.program || '',
        p.year_level ? `Year ${p.year_level}` : '',
        p.email || '',
        pht(a.scanned_at),
        'Present',
      ]
      if (hasFee) {
        const paid = paidBy.has(a.user_id)
        row.push(paid ? fee.toLocaleString('en-PH') : 0, paid ? 'PAID' : 'UNPAID')
      }
      return row
    }),
    widths,
  )

  if (hasFee) {
    const cws = wb.addWorksheet('Contributions', { views: [{ showGridLines: false }] })
    const paidCount = (eventPayments || []).length
    const collected = (eventPayments || []).reduce((t, p) => t + Number(p.amount || 0), 0)
    brandHeader(
      cws,
      'FNAHS PULSO — Event Contributions',
      `${event?.title || 'Event'} · fee ₱${fee.toLocaleString('en-PH')} · ${paidCount} paid · ₱${collected.toLocaleString('en-PH')} collected`,
    )
    const unpaid = sorted.length - paidCount
    cws.getCell('A3').value =
      unpaid > 0
        ? `${unpaid} of ${sorted.length} present member(s) have not paid the contribution yet.`
        : 'All present members have paid the contribution.'
    cws.getCell('A3').font = SUB_FONT
    styledHeader(cws.getRow(5), ['#', 'Name', 'ID No', 'Amount (₱)', 'Paid At (PHT)'])
    styledBody(
      cws,
      6,
      (eventPayments || [])
        .slice()
        .sort((a, b) => new Date(a.paid_at || 0) - new Date(b.paid_at || 0))
        .map((p, i) => [
          i + 1,
          p.profiles?.full_name || p.member_id.slice(0, 10),
          p.profiles?.id_no || '',
          Number(p.amount || 0).toLocaleString('en-PH'),
          pht(p.paid_at),
        ]),
      [5, 28, 12, 12, 20],
    )
  }

  const stamp = todayStamp()
  return {
    workbook: wb,
    filename: `attendance-${slug(event?.title || 'event')}-${stamp}.xlsx`,
  }
}

/** Three-sheet membership fee report: Summary, Details, Payments. */
export async function feeReportWorkbook({ members, feePayments, annualFee, schoolYear }) {
  const { Workbook } = await excel()
  const wb = new Workbook()

  const rows = members
    .filter((m) => m.role !== 'superadmin')
    .map((m) => {
      const payments = feePayments.filter((p) => p.member_id === m.id)
      const paid = payments.reduce((t, p) => t + Number(p.amount || 0), 0)
      const status = paid >= annualFee ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID'
      return { member: m, payments, paid, status, balance: Math.max(0, annualFee - paid) }
    })

  const statusCount = (s) => rows.filter((r) => r.status === s).length
  const totals = {
    members: rows.length,
    paid: statusCount('PAID'),
    partial: statusCount('PARTIAL'),
    unpaid: statusCount('UNPAID'),
    collected: rows.reduce((t, r) => t + r.paid, 0),
    expected: rows.length * annualFee,
  }

  // ---- Summary sheet ----
  const ws = wb.addWorksheet('Summary', { views: [{ showGridLines: false }] })
  brandHeader(ws, 'FNAHS PULSO — Membership Fee Report', `School Year ${schoolYear} · Generated ${pht(new Date().toISOString())}`)
  styledHeader(ws.getRow(4), ['Metric', 'Value'])
  styledBody(
    ws,
    5,
    [
      ['Annual membership fee', `₱${annualFee.toLocaleString('en-PH')}`],
      ['Members (excl. admins)', totals.members],
      ['Fully paid', totals.paid],
      ['Partial', totals.partial],
      ['Unpaid', totals.unpaid],
      ['Amount collected', `₱${totals.collected.toLocaleString('en-PH')}`],
      ['Expected if all paid', `₱${totals.expected.toLocaleString('en-PH')}`],
      ['Collection rate', `${totals.expected ? Math.round((totals.collected / totals.expected) * 100) : 0}%`],
    ],
    [26, 20],
  )
  const collectedCell = ws.getCell('B10')
  collectedCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: GOLD } }

  // ---- Details sheet ----
  const dws = wb.addWorksheet('Details', { views: [{ showGridLines: false }] })
  brandHeader(dws, 'Member Fee Details', `School Year ${schoolYear} · FULL = ₱${annualFee.toLocaleString('en-PH')} · HALF = ₱${(annualFee / 2).toLocaleString('en-PH')}`)
  styledHeader(dws.getRow(4), ['#', 'Name', 'ID No', 'Program', 'Year Level', 'Email', 'Payments', 'Paid (₱)', 'Balance (₱)', 'Status'])
  styledBody(
    dws,
    5,
    rows
      .slice()
      .sort((a, b) => a.member.full_name?.localeCompare(b.member.full_name || '') || 0)
      .map((r, i) => [
        i + 1,
        r.member.full_name || '',
        r.member.id_no || '',
        r.member.program || '',
        r.member.year_level || '',
        r.member.email || '',
        r.payments.length,
        r.paid.toLocaleString('en-PH'),
        r.balance.toLocaleString('en-PH'),
        r.status,
      ]),
    [5, 28, 12, 16, 12, 26, 9, 12, 12, 10],
  )

  // ---- Payments sheet ----
  const pws = wb.addWorksheet('Payments', { views: [{ showGridLines: false }] })
  brandHeader(pws, 'Fee Payments', `School Year ${schoolYear} · ${feePayments.length} payment(s) recorded`)
  styledHeader(pws.getRow(4), ['#', 'Name', 'ID No', 'Type', 'Amount (₱)', 'Receipt / OR No', 'Paid At (PHT)', 'Recorded By'])
  styledBody(
    pws,
    5,
    feePayments
      .slice()
      .sort((a, b) => new Date(a.paid_at || 0) - new Date(b.paid_at || 0))
      .map((p, i) => {
        const m = members.find((x) => x.id === p.member_id)
        return [
          i + 1,
          m?.full_name || '',
          m?.id_no || '',
          p.payment_type === 'full' ? 'FULL' : 'HALF',
          Number(p.amount || 0).toLocaleString('en-PH'),
          p.receipt || '',
          pht(p.paid_at),
          p.recorded_by || '',
        ]
      }),
    [5, 28, 12, 10, 12, 18, 20, 24],
  )

  const stamp = todayStamp()
  return {
    workbook: wb,
    filename: `fee-report-${slug(schoolYear)}-${stamp}.xlsx`,
  }
}
