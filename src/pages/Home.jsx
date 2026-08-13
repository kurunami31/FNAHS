import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HeartPulse, Lightbulb, CalendarDays, ArrowRight, ExternalLink, Stethoscope } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { ORG_TAGLINE, seedFeeds } from '../lib/mock'
import { timeAgo } from '../lib/format'

export default function Home() {
  const { user } = useApp()
  const navigate = useNavigate()
  const [feeds, setFeeds] = useState(() => ({ health: seedFeeds().health, tips: seedFeeds().tips }))
  const [events, setEvents] = useState([])

  useEffect(() => {
    api.getFeeds().then(setFeeds).catch(() => {})
    api
      .getEvents()
      .then((evs) => setEvents(evs.filter((e) => new Date(e.ends_at) > Date.now()).slice(0, 3)))
      .catch(() => {})
  }, [])

  const stats = [
    { value: '1K+', label: 'students' },
    { value: '6', label: 'programs' },
    { value: '40+', label: 'events / yr' },
    { value: '24/7', label: 'AI assistant' },
  ]

  return (
    <div>
      <section className="welcome">
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="welcome-tag cursor-blink">welcome to the community platform of</span>
          <h1 className="welcome-title">FNAHS</h1>
          <p className="welcome-desc">{ORG_TAGLINE}</p>
          <div className="welcome-actions">
            {user ? (
              <>
                <button className="btn btn--primary" onClick={() => navigate('/app/feed')}>
                  Open the feed <ArrowRight size={16} />
                </button>
                <button className="btn btn--ghost" onClick={() => window.dispatchEvent(new Event('florence:open'))}>
                  <Stethoscope size={16} /> Talk to Florence
                </button>
              </>
            ) : (
              <>
                <Link to="/signup" className="btn btn--primary">
                  Join FNAHS <ArrowRight size={16} />
                </Link>
                <Link to="/login" className="btn btn--ghost">
                  Log in
                </Link>
              </>
            )}
          </div>
          <div className="welcome-stats">
            {stats.map((s) => (
              <div className="stat" key={s.label}>
                <b>{s.value}</b>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
        <img className="welcome-mascot" src="/FNAHS.png" alt="FNAHS mascot" />
      </section>

      <h2 className="page-title" style={{ marginTop: 34 }}>RESOURCES</h2>
      <p className="page-sub">Live feeds to keep you sharp — updated in real time.</p>

      <div className="learn-grid">
        <LearnCard
          kind="health"
          title={<><HeartPulse size={17} style={{ color: 'var(--accent)' }} /> Health News</>}
          desc="Global health headlines — from WHO and the public-health desk."
          items={feeds.health}
          href="https://www.who.int/news"
        />
        <LearnCard
          kind="tips"
          title={<><Lightbulb size={17} style={{ color: 'var(--accent-2)' }} /> Health Tips</>}
          desc="Bite-sized clinical and wellness tips for every duty."
          items={feeds.tips}
        />
        <LearnCard
          kind="org"
          title={<><CalendarDays size={17} style={{ color: 'var(--accent-2)' }} /> Org events</>}
          desc="Next up on the FNAHS calendar — don't miss the scan."
          items={events.map((e) => ({
            id: e.id,
            title: e.title,
            meta: timeAgo(e.starts_at),
            to: '/app/events',
          }))}
          href="/app/events"
        />
      </div>
    </div>
  )
}

function LearnCard({ kind, title, desc, items, href }) {
  return (
    <div className={`learn-card learn-card--${kind}`}>
      <div className="learn-head">
        <h3>{title}</h3>
        {href && (
          <a href={href} target="_blank" rel="noreferrer" className="icon-btn" aria-label="Open feed">
            <ExternalLink size={15} />
          </a>
        )}
      </div>
      <p>{desc}</p>
      {items.length === 0 && <p style={{ marginTop: 8 }}>Loading feed…</p>}
      {items.map((it) => (
        <div className="learn-item" key={it.id}>
          <div className="li-title">
            <a href={it.href || href} target={it.href ? '_blank' : undefined} rel="noreferrer">
              {it.title}
            </a>
          </div>
          <div className="li-meta">{it.meta}</div>
        </div>
      ))}
    </div>
  )
}

