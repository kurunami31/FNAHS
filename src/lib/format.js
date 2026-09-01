export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const then = new Date(dateStr).getTime()
  const diff = Date.now() - then
  const s = Math.floor(diff / 1000)
  if (s < 45) {
    if (s >= 0) return 'just now'
    // Future timestamps (upcoming events) read as "in Xh" instead of "just now".
    const a = Math.floor(-s / 60)
    if (a < 60) return `in ${a}m`
    const b = Math.floor(a / 60)
    if (b < 24) return `in ${b}h`
    const c = Math.floor(b / 24)
    return `in ${c}d`
  }
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?'
}

export function monthDay(dateStr) {
  const d = new Date(dateStr)
  return { month: d.toLocaleString(undefined, { month: 'short' }).toUpperCase(), day: d.getDate() }
}

export function fmtDateTime(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function fullDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fullDateTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

export function getFirstDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
}

export function getDaysInPrevMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 0).getDate()
}

export function formatMonthYear(date) {
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

export function formatFullDate(date) {
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

export function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate()
}

export function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}
