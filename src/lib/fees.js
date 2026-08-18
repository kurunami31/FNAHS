/* Membership fee helpers shared by Admin, Directory, My ID, and Staff.
   Model: one annual fee amount per school year; each payment is FULL (100%)
   or HALF (50%) of it. A member is 'paid' once the sum of payments reaches
   the annual fee, 'partial' below it, 'unpaid' with nothing recorded. */

/** school year covering the given date — PH academic year starts in July */
export function currentSchoolYear(d = new Date()) {
  const y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1
  return `${y}-${y + 1}`
}

/** roll up a member's payments for a year */
export function feeSummary(payments, annualFee = 200) {
  const paid = (payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const annual = Math.max(Number(annualFee) || 0, 0)
  return {
    paid,
    annual,
    balance: Math.max(annual - paid, 0),
    status: annual > 0 && paid >= annual ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
  }
}

/** 'paid' | 'partial' | 'unpaid' */
export function feeStatus(payments, annualFee = 200) {
  return feeSummary(payments, annualFee).status
}

/** short human label, e.g. "Partial — ₱100 of ₱200" */
export function feeLabel(payments, annualFee = 200) {
  const s = feeSummary(payments, annualFee)
  if (s.status === 'paid') return `Paid — ₱${fmtPeso(s.paid)}`
  if (s.status === 'partial') return `Partial — ₱${fmtPeso(s.paid)} of ₱${fmtPeso(s.annual)}`
  return `Unpaid — ₱${fmtPeso(s.annual)} due`
}

export function fmtPeso(n) {
  return Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}