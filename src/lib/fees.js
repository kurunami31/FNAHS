/* Membership fee helpers shared by Admin, Directory, My ID, and Staff. */

/** school year covering the given date — PH academic year starts in July */
export function currentSchoolYear(d = new Date()) {
  const y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1
  return `${y}-${y + 1}`
}

/** 'paid' | 'unpaid' | null per semester (null = nothing set yet) */
export function feeStatus(f) {
  return {
    sem1: f?.sem1_paid_at ? 'paid' : f?.sem1_amount > 0 ? 'unpaid' : null,
    sem2: f?.sem2_paid_at ? 'paid' : f?.sem2_amount > 0 ? 'unpaid' : null,
  }
}

export function isFeePaid(f) {
  const { sem1, sem2 } = feeStatus(f)
  if (sem1 === 'unpaid' || sem2 === 'unpaid') return false
  return sem1 === 'paid' || sem2 === 'paid'
}

/** short human label, e.g. "1st sem paid · 2nd sem unpaid" */
export function feeLabel(f) {
  const { sem1, sem2 } = feeStatus(f)
  const parts = []
  if (sem1) parts.push(`1st sem ${sem1}`)
  if (sem2) parts.push(`2nd sem ${sem2}`)
  return parts.join(' · ') || null
}