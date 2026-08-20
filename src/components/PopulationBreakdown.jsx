import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { api } from '../lib/api'

const YEARS = ['1', '2', '3', '4']

export default function PopulationBreakdown({ title = 'Population by Year Level' }) {
  const [pop, setPop] = useState([])

  useEffect(() => {
    api
      .getPopulationBreakdown()
      .then(setPop)
      .catch(() => {})
  }, [])

  const total = pop.reduce((s, p) => s + Number(p.count), 0)
  if (total === 0) return null

  const max = Math.max(1, ...pop.map((p) => Number(p.count)))
  const otherCount = pop
    .filter((p) => !YEARS.includes(String(p.year_level)))
    .reduce((s, p) => s + Number(p.count), 0)
  const cells = [
    ...YEARS.map((y) => ({ year_level: y, count: Number((pop.find((p) => String(p.year_level) === y) || {}).count) || 0 })),
    ...(otherCount > 0 ? [{ year_level: 'Other', count: otherCount }] : []),
  ]

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title"><Users size={16} /> {title}</h2>
        <span className="chip">{total.toLocaleString()} students</span>
      </div>
      <div className="pop-grid">
        {cells.map((c) => {
          const pct = total ? Math.round((c.count / total) * 100) : 0
          return (
            <div key={c.year_level} className="pop-cell">
              <b>{YEARS.includes(String(c.year_level)) ? `Year ${c.year_level}` : c.year_level}</b>
              <span>{c.count.toLocaleString()} · {pct}%</span>
              <div className="pop-bar"><i style={{ width: `${(c.count / max) * 100}%` }} /></div>
            </div>
          )
        })}
      </div>
    </section>
  )
}